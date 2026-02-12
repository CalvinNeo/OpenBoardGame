import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "starting_tokens": 4,
    "end_mode": "bankrupt",
    "round_limit": 7,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    if cfg.get("end_mode") not in ("bankrupt", "rounds"):
        cfg["end_mode"] = "bankrupt"
    try:
        cfg["starting_tokens"] = int(cfg.get("starting_tokens", DEFAULT_CONFIG["starting_tokens"]))
    except (TypeError, ValueError):
        cfg["starting_tokens"] = DEFAULT_CONFIG["starting_tokens"]
    try:
        cfg["round_limit"] = int(cfg.get("round_limit", DEFAULT_CONFIG["round_limit"]))
    except (TypeError, ValueError):
        cfg["round_limit"] = DEFAULT_CONFIG["round_limit"]
    if cfg["round_limit"] < 1:
        cfg["round_limit"] = DEFAULT_CONFIG["round_limit"]
    if cfg["starting_tokens"] < 0:
        cfg["starting_tokens"] = 0
    return cfg


def _build_deck() -> List[int]:
    deck = list(range(1, 16))
    random.shuffle(deck)
    return deck


def _sorted_player_ids(state: Dict, player_ids: Optional[List[str]] = None) -> List[str]:
    meta = state.get("player_meta", {})
    ids = list(player_ids) if player_ids is not None else list(meta.keys())
    return sorted(ids, key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _next_player_id(state: Dict, current_pid: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if current_pid not in order:
        return order[0]
    idx = order.index(current_pid)
    return order[(idx + 1) % len(order)]


def _start_round(state: Dict, start_player: Optional[str], round_number: int, carry_pot: bool) -> None:
    deck = _build_deck()
    for pid in state.get("turn_order", []):
        pdata = state["players"][pid]
        pdata["hand"] = deck.pop()
        pdata["drawn_card"] = None
        pdata["bet_choice"] = None
    state["kobayakawa"] = deck.pop() if deck else None
    state["deck"] = deck
    state["discard_pile"] = []
    state["actions_taken"] = []
    state["betting_choices"] = {}
    if not carry_pot:
        state["pot"] = 0
    order = state.get("turn_order", [])
    if start_player not in order:
        start_player = order[0] if order else None
    state["start_player"] = start_player
    state["current_turn"] = start_player
    state["phase"] = "action"
    state["round"] = round_number


def _finalize_winner(state: Dict) -> None:
    tokens = {pid: int(pdata.get("tokens", 0)) for pid, pdata in state.get("players", {}).items()}
    winners: List[str] = []
    if tokens:
        max_tokens = max(tokens.values())
        winners = [pid for pid, count in tokens.items() if count == max_tokens]
    state["winner"] = _sorted_player_ids(state, winners)
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None


def _check_game_over(state: Dict) -> bool:
    cfg = state.get("config", {})
    end_mode = cfg.get("end_mode", "bankrupt")
    if end_mode == "bankrupt":
        for pdata in state.get("players", {}).values():
            if int(pdata.get("tokens", 0)) <= 0:
                _finalize_winner(state)
                return True
    elif end_mode == "rounds":
        if int(state.get("round", 0)) >= int(cfg.get("round_limit", 0)):
            _finalize_winner(state)
            return True
    return False


def _compute_showdown(state: Dict, fighters: List[str]) -> Tuple[str, List[Dict], str]:
    min_hand = None
    for pid in fighters:
        value = state["players"][pid]["hand"]
        if min_hand is None or value < min_hand:
            min_hand = value
    min_holders = [pid for pid in fighters if state["players"][pid]["hand"] == min_hand]
    if len(min_holders) != 1:
        raise ValueError("critical error: duplicate hand cards detected")
    bonus_holder = min_holders[0]
    winner = None
    winner_score = None
    winner_hand = None
    fighters_summary: List[Dict] = []
    for pid in fighters:
        hand_value = state["players"][pid]["hand"]
        final_score = hand_value
        got_bonus = pid == bonus_holder
        if got_bonus:
            final_score += int(state.get("kobayakawa") or 0)
        fighters_summary.append(
            {
                "player_id": pid,
                "hand": hand_value,
                "final_score": final_score,
                "got_bonus": got_bonus,
            }
        )
        if winner is None or final_score > winner_score:
            winner = pid
            winner_score = final_score
            winner_hand = hand_value
        elif final_score == winner_score and hand_value > winner_hand:
            winner = pid
            winner_score = final_score
            winner_hand = hand_value
    if winner is None:
        raise ValueError("critical error: unable to determine showdown winner")
    return winner, fighters_summary, bonus_holder


def _next_betting_player(state: Dict, current_pid: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if current_pid not in order:
        current_pid = order[0]
    idx = order.index(current_pid)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if pid not in state.get("betting_choices", {}):
            return pid
    return None


def _complete_action_turn(state: Dict, player_id: str) -> None:
    if player_id not in state.get("actions_taken", []):
        state["actions_taken"].append(player_id)
    if len(state["actions_taken"]) >= len(state.get("turn_order", [])):
        state["phase"] = "betting"
        state["betting_choices"] = {}
        state["current_turn"] = state.get("start_player")
    else:
        state["current_turn"] = _next_player_id(state, player_id)


def _finish_round(state: Dict, next_start_player: Optional[str], carry_pot: bool) -> None:
    if _check_game_over(state):
        return
    next_round = int(state.get("round", 0)) + 1
    _start_round(state, next_start_player, next_round, carry_pot)


def _resolve_betting(state: Dict) -> None:
    fighters = [pid for pid, choice in state.get("betting_choices", {}).items() if choice == "fight"]
    pot_value = int(state.get("pot", 0))
    summary: Dict = {
        "round": state.get("round"),
        "pot": pot_value,
        "kobayakawa": state.get("kobayakawa"),
    }

    if not fighters:
        summary.update({"result": "all_pass", "winner": None})
        state["last_round_summary"] = summary
        next_start = _next_player_id(state, state.get("start_player"))
        _finish_round(state, next_start, carry_pot=True)
        return

    if len(fighters) == 1:
        winner = fighters[0]
        summary.update({"result": "solo", "winner": winner})
        state["players"][winner]["tokens"] += pot_value
        state["pot"] = 0
        state["last_round_summary"] = summary
        _finish_round(state, winner, carry_pot=False)
        return

    winner, fighters_summary, bonus_holder = _compute_showdown(state, fighters)
    summary.update(
        {
            "result": "showdown",
            "winner": winner,
            "bonus_holder": bonus_holder,
            "fighters": fighters_summary,
        }
    )
    state["players"][winner]["tokens"] += pot_value
    state["pot"] = 0
    state["last_round_summary"] = summary
    _finish_round(state, winner, carry_pot=False)


class KobayakawaGame:
    game_id = "kobayakawa"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "hand": None,
                "drawn_card": None,
                "tokens": cfg["starting_tokens"],
                "bet_choice": None,
            }

        start_player = random.choice(player_ids) if player_ids else None
        state = {
            "players": state_players,
            "turn_order": player_ids,
            "start_player": start_player,
            "current_turn": start_player,
            "phase": "action",
            "round": 1,
            "pot": 0,
            "kobayakawa": None,
            "deck": [],
            "discard_pile": [],
            "actions_taken": [],
            "betting_choices": {},
            "config": cfg,
            "player_meta": player_meta,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }
        if player_ids:
            _start_round(state, start_player, 1, carry_pot=False)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state.get("players", {}).get(player_id)
        if not pdata:
            return []

        phase = state.get("phase")
        if phase == "action":
            if player_id != state.get("current_turn"):
                return []
            if pdata.get("drawn_card") is not None:
                return ["keep_drawn", "discard_drawn"]
            return ["draw_card", "replace_kobayakawa"]

        if phase == "betting":
            if player_id != state.get("current_turn"):
                return []
            if player_id in state.get("betting_choices", {}):
                return []
            actions = ["pass"]
            if int(pdata.get("tokens", 0)) > 0:
                actions.insert(0, "fight")
            return actions

        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state.get("players", {}).get(player_id)
        if not pdata:
            return [], "unknown player"

        action_type = action.get("type")
        phase = state.get("phase")
        events: List[Dict] = []

        if phase == "action":
            if player_id != state.get("current_turn"):
                return [], "not your turn"

            drawn_card = pdata.get("drawn_card")
            if drawn_card is not None:
                if action_type == "keep_drawn":
                    discard_card = pdata.get("hand")
                    if discard_card is None:
                        return [], "no hand to discard"
                    state.setdefault("discard_pile", []).append(discard_card)
                    pdata["hand"] = drawn_card
                    pdata["drawn_card"] = None
                    events.append(
                        {
                            "type": "kobayakawa:discard",
                            "payload": {"player_id": player_id, "card": discard_card, "kept": "drawn"},
                        }
                    )
                    _complete_action_turn(state, player_id)
                    return events, None

                if action_type == "discard_drawn":
                    state.setdefault("discard_pile", []).append(drawn_card)
                    pdata["drawn_card"] = None
                    events.append(
                        {
                            "type": "kobayakawa:discard",
                            "payload": {"player_id": player_id, "card": drawn_card, "kept": "hand"},
                        }
                    )
                    _complete_action_turn(state, player_id)
                    return events, None

                return [], "must keep or discard drawn card"

            if action_type == "draw_card":
                if not state.get("deck"):
                    return [], "deck empty"
                drawn = state["deck"].pop()
                pdata["drawn_card"] = drawn
                events.append({"type": "kobayakawa:draw", "payload": {"player_id": player_id}})
                return events, None

            if action_type == "replace_kobayakawa":
                if not state.get("deck"):
                    return [], "deck empty"
                new_card = state["deck"].pop()
                old_card = state.get("kobayakawa")
                if old_card is not None:
                    state.setdefault("discard_pile", []).append(old_card)
                state["kobayakawa"] = new_card
                events.append(
                    {
                        "type": "kobayakawa:replace",
                        "payload": {"player_id": player_id, "old": old_card, "new": new_card},
                    }
                )
                _complete_action_turn(state, player_id)
                return events, None

            return [], "invalid action"

        if phase == "betting":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if player_id in state.get("betting_choices", {}):
                return [], "already decided"

            if action_type == "fight":
                if int(pdata.get("tokens", 0)) <= 0:
                    return [], "no tokens"
                pdata["tokens"] -= 1
                state["pot"] = int(state.get("pot", 0)) + 1
                state.setdefault("betting_choices", {})[player_id] = "fight"
                events.append(
                    {
                        "type": "kobayakawa:bet",
                        "payload": {"player_id": player_id, "choice": "fight"},
                    }
                )
            elif action_type == "pass":
                state.setdefault("betting_choices", {})[player_id] = "pass"
                events.append(
                    {
                        "type": "kobayakawa:bet",
                        "payload": {"player_id": player_id, "choice": "pass"},
                    }
                )
            else:
                return [], "invalid action"

            next_player = _next_betting_player(state, player_id)
            if next_player:
                state["current_turn"] = next_player
                return events, None

            try:
                _resolve_betting(state)
            except ValueError as exc:
                return [], str(exc)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = _sorted_player_ids(state)
        players_view = []
        betting_choices = state.get("betting_choices", {})
        actions_taken = set(state.get("actions_taken", []))
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "tokens": pdata.get("tokens", 0),
                    "bet_choice": betting_choices.get(pid),
                    "action_done": pid in actions_taken,
                }
            )

        your_hand = None
        your_drawn = None
        if viewer_id in state.get("players", {}):
            your_hand = state["players"][viewer_id].get("hand")
            your_drawn = state["players"][viewer_id].get("drawn_card")

        return {
            "game_id": KobayakawaGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "current_turn": state.get("current_turn"),
            "start_player": state.get("start_player"),
            "pot": state.get("pot", 0),
            "kobayakawa": state.get("kobayakawa"),
            "deck_count": len(state.get("deck", [])),
            "discard_pile": list(state.get("discard_pile", [])),
            "your_hand": your_hand,
            "your_drawn": your_drawn,
            "players": players_view,
            "legal_actions": KobayakawaGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": {
                "starting_tokens": state.get("config", {}).get("starting_tokens"),
                "end_mode": state.get("config", {}).get("end_mode"),
                "round_limit": state.get("config", {}).get("round_limit"),
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state.get("players", {}).get(bot_id)
        if not pdata or bot_id != state.get("current_turn"):
            return None
        phase = state.get("phase")
        if phase == "action":
            drawn = pdata.get("drawn_card")
            if drawn is not None:
                hand = pdata.get("hand")
                if hand is None:
                    return {"type": "discard_drawn"}
                if drawn >= hand:
                    return {"type": "keep_drawn"}
                return {"type": "discard_drawn"}
            if random.random() < 0.7:
                return {"type": "draw_card"}
            return {"type": "replace_kobayakawa"}
        if phase == "betting":
            if int(pdata.get("tokens", 0)) <= 0:
                return {"type": "pass"}
            hand = pdata.get("hand")
            kobayakawa = state.get("kobayakawa")
            if hand is None or kobayakawa is None:
                return {"type": "pass"}
            if hand <= 3 and kobayakawa >= 11:
                return {"type": "fight"}
            if hand < 7 and kobayakawa <= 4:
                return {"type": "pass"}
            if hand >= 10:
                return {"type": "fight"}
            return {"type": "fight"} if random.random() < 0.5 else {"type": "pass"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
