import random
from typing import Dict, List, Optional, Tuple

from game.kobayakawa_ai import choose_action

DEFAULT_CONFIG = {
    "starting_tokens": 4,
    "end_mode": "rounds",
    "round_limit": 7,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    if cfg.get("end_mode") not in ("bankrupt", "rounds"):
        cfg["end_mode"] = DEFAULT_CONFIG["end_mode"]
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
    state["turn_order"] = [pid for pid in _sorted_player_ids(state)
                           if int(state["players"][pid].get("tokens", 0)) > 0]
    deck = _build_deck()
    for pdata in state["players"].values():
        pdata["hand"] = None
        pdata["drawn_card"] = None
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
    state["bets"] = {}
    if not carry_pot:
        state["pot"] = 0
    order = state.get("turn_order", [])
    if start_player not in order:
        start_player = order[0] if order else None
    state["start_player"] = start_player
    state["current_turn"] = start_player
    state["phase"] = "action"
    state["round"] = round_number
    state["round_ready"] = []


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
    if (sum(int(player.get("tokens", 0)) > 0 for player in state["players"].values()) <= 1
            or int(state.get("reserve", 0)) == 0):
        _finalize_winner(state)
        return True
    end_mode = cfg.get("end_mode", "rounds")
    if end_mode == "bankrupt":
        for pdata in state.get("players", {}).values():
            if int(pdata.get("tokens", 0)) <= 0:
                _finalize_winner(state)
                return True
    return False


def _compute_showdown(state: Dict, fighters: List[str]) -> Tuple[str, List[Dict], str]:
    order = state.get("turn_order", fighters)
    start = order.index(state["start_player"]) if state.get("start_player") in order else 0
    ranks = {pid: index for index, pid in enumerate(order[start:] + order[:start])}
    fighters = sorted(fighters, key=lambda pid: ranks.get(pid, len(order)))
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
    state["review_id"] = state.get("review_id", 0) + 1
    summary = state["last_round_summary"]
    summary["tokens"] = []
    for pid, pdata in state["players"].items():
        paid = state.get("bets", {}).get(pid, 1 if state["betting_choices"].get(pid) == "fight" else 0)
        received = summary["pot"] if summary.get("winner") == pid else 0
        reward = summary.get("reserve_reward", 0) if summary.get("winner") == pid else 0
        summary["tokens"].append({
            "player_id": pid,
            "before": pdata["tokens"] + paid - received - reward,
            "paid": paid,
            "received": received,
            "reward": reward,
            "after": pdata["tokens"],
        })
    if _check_game_over(state):
        return
    state["phase"] = "round_end"
    state["current_turn"] = None
    state["round_ready"] = []
    state["next_start_player"] = next_start_player
    state["carry_pot"] = carry_pot


def _round_reward(state: Dict) -> int:
    reserve = int(state.get("reserve", 0))
    return min(reserve, 2 if reserve <= 2 else 1)


def _fight_cost(state: Dict, player_id: str) -> int:
    return min(int(state["players"][player_id].get("tokens", 0)),
               2 if int(state.get("reserve", 0)) <= 2 else 1)


def _award_pot(state: Dict, summary: Dict, winner: str) -> None:
    reward = _round_reward(state)
    state["players"][winner]["tokens"] += summary["pot"] + reward
    state["pot"] = 0
    state["reserve"] -= reward
    summary.update(reserve_reward=reward, reserve_after=state["reserve"])


def _resolve_betting(state: Dict) -> None:
    fighters = [pid for pid, choice in state.get("betting_choices", {}).items() if choice == "fight"]
    pot_value = int(state.get("pot", 0))
    summary: Dict = {
        "round": state.get("round"),
        "pot": pot_value,
        "kobayakawa": state.get("kobayakawa"),
        "reserve_before": state["reserve"],
        "reserve_after": state["reserve"],
        "reserve_reward": 0,
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
        _award_pot(state, summary, winner)
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
    _award_pot(state, summary, winner)
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
            "reserve": cfg["round_limit"] + 1,
            "bets": {},
            "review_id": 0,
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
            _check_game_over(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state.get("players", {}).get(player_id)
        if not pdata:
            return []

        phase = state.get("phase")
        if phase == "round_end":
            return [] if player_id in state.get("round_ready", []) else ["next_round"]
        if int(pdata.get("tokens", 0)) <= 0:
            return []
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
        if state.get("phase") == "round_end":
            if action_type != "next_round":
                return [], "only next_round allowed"
            if action.get("round") != state.get("round"):
                return [], "round changed"
            if action.get("review_id") != state.get("review_id", 0):
                return [], "review changed"
            ready = state.setdefault("round_ready", [])
            if player_id in ready:
                return [], "already ready"
            ready.append(player_id)
            events = [{"type": "kobayakawa:ready", "payload": {"player_id": player_id}}]
            if all(pid in ready for pid in state["players"]):
                next_round = state["round"] + (state["last_round_summary"]["result"] != "all_pass")
                _start_round(state, state.get("next_start_player"), next_round,
                             state.get("carry_pot", False))
                events.append({"type": "kobayakawa:next_round", "payload": {"round": state["round"]}})
            return events, None
        if int(pdata.get("tokens", 0)) <= 0:
            return [], "player eliminated"
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
                cost = _fight_cost(state, player_id)
                pdata["tokens"] -= cost
                state["pot"] = int(state.get("pot", 0)) + cost
                state.setdefault("bets", {})[player_id] = cost
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
                    "bet_amount": state.get("bets", {}).get(pid, 1 if betting_choices.get(pid) == "fight" else 0),
                    "eliminated": int(pdata.get("tokens", 0)) <= 0 and not (
                        state.get("phase") == "betting" and betting_choices.get(pid) == "fight"),
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
            "reserve": state["reserve"],
            "round_reward": _round_reward(state),
            "final_round": state["reserve"] <= 2,
            "fight_cost": _fight_cost(state, viewer_id) if viewer_id in state["players"] else 0,
            "kobayakawa": state.get("kobayakawa"),
            "deck_count": len(state.get("deck", [])),
            "discard_pile": list(state.get("discard_pile", [])),
            "your_hand": your_hand,
            "your_drawn": your_drawn,
            "players": players_view,
            "legal_actions": KobayakawaGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "round_ready": list(state.get("round_ready", [])),
            "review_id": state.get("review_id", 0),
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
        return choose_action(KobayakawaGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        legacy = "reserve" not in payload
        if legacy:
            limit = int(payload.get("config", {}).get("round_limit", 7))
            payload["reserve"] = max(2, limit - int(payload.get("round", 1)) + 2)
            if payload.get("phase") == "round_end" and payload.get("last_round_summary", {}).get("winner"):
                payload["reserve"] = max(0, payload["reserve"] - (2 if payload["reserve"] <= 2 else 1))
            if payload.get("game_over"):
                payload["reserve"] = 0
        payload.setdefault("bets", {pid: 1 for pid, choice in payload.get("betting_choices", {}).items()
                                    if choice == "fight"})
        payload.setdefault("review_id", 0)
        if legacy and payload.get("phase") in ("action", "betting"):
            previous_turn = payload.get("current_turn")
            previous_order = payload.get("turn_order", [])
            choices = payload.get("betting_choices", {})
            payload["turn_order"] = [
                pid for pid in previous_order if payload["players"][pid]["tokens"] > 0
                or (payload["phase"] == "betting" and choices.get(pid) == "fight")
            ]
            order = payload["turn_order"]
            if payload.get("start_player") not in order:
                payload["start_player"] = order[0] if order else None
            payload["actions_taken"] = [pid for pid in payload.get("actions_taken", []) if pid in order]
            if payload["phase"] == "action" and len(payload["actions_taken"]) == len(order):
                payload["phase"] = "betting"
                payload["betting_choices"] = {}
                payload["bets"] = {}
                payload["current_turn"] = payload["start_player"]
            elif previous_turn not in order:
                start = previous_order.index(previous_turn) if previous_turn in previous_order else 0
                rotated = previous_order[start:] + previous_order[:start]
                payload["current_turn"] = next((pid for pid in rotated if pid in order), None)
            if payload["phase"] == "action":
                _check_game_over(payload)
            elif payload["phase"] == "betting":
                start = previous_order.index(payload["current_turn"]) if payload["current_turn"] in previous_order else 0
                rotated = previous_order[start:] + previous_order[:start]
                pending = [pid for pid in rotated if pid in order and pid not in payload["betting_choices"]]
                if pending:
                    payload["current_turn"] = pending[0]
                else:
                    _resolve_betting(payload)
        elif legacy and payload.get("phase") == "round_end":
            _check_game_over(payload)
        return payload
