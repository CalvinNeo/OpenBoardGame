import random
from typing import Dict, List, Optional, Tuple

SPELL_NAMES = [
    "Ancient Dragon",
    "Dark Ghost",
    "Sweet Dreams",
    "Owl",
    "Lightning Storm",
    "Blizzard",
    "Fireball",
    "Magic Potion",
]

SPELL_DESCRIPTIONS = [
    "Roll 1-3. Others lose that many HP. Miscast: you lose that many HP.",
    "Others -1 HP. You +1 HP (max 6).",
    "Roll 1-3. You heal that many HP (max 6).",
    "Draw a secret card (private, unusable). Survive to score +1 per secret.",
    "Left and right neighbors -1 HP (2 players: opponent -1 HP).",
    "Left neighbor -1 HP.",
    "Right neighbor -1 HP.",
    "You +1 HP (max 6).",
]

SPELL_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8]

CARD_TO_SPELL: List[int] = []
for idx, count in enumerate(SPELL_COUNTS):
    CARD_TO_SPELL.extend([idx] * count)

DEFAULT_CONFIG = {
    "target_score": 8,
    "hand_size": 5,
    "secret_pool_by_players": {2: 12, 3: 6, 4: 4, 5: 4},
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            if key == "secret_pool_by_players" and isinstance(value, dict):
                merged = {**cfg["secret_pool_by_players"]}
                for k, v in value.items():
                    try:
                        merged[int(k)] = int(v)
                    except (TypeError, ValueError):
                        continue
                cfg["secret_pool_by_players"] = merged
            else:
                cfg[key] = value
    return cfg


def _build_deck() -> List[int]:
    deck = list(range(len(CARD_TO_SPELL)))
    random.shuffle(deck)
    return deck


def _secret_pool_size(config: Dict, player_count: int) -> int:
    mapping = config.get("secret_pool_by_players") or {}
    if player_count in mapping:
        return int(mapping[player_count])
    if str(player_count) in mapping:
        return int(mapping[str(player_count)])
    return 4


def _spell_type(card_id: int) -> int:
    return CARD_TO_SPELL[card_id]


def _remove_spell_from_hand(hand: List[int], spell_type: int) -> Optional[int]:
    for idx, card_id in enumerate(hand):
        if _spell_type(card_id) == spell_type:
            return hand.pop(idx)
    return None


def _draw_to_hand(state: Dict, player_id: str) -> None:
    hand = state["players"][player_id]["hand"]
    target_size = int(state["config"]["hand_size"])
    while len(hand) < target_size and state["deck"]:
        hand.append(state["deck"].pop())


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    if not order:
        state["current_turn"] = None
        return
    current = state["current_turn"]
    idx = order.index(current) if current in order else -1
    state["current_turn"] = order[(idx + 1) % len(order)]
    state["phase"] = "wait_use"
    state["last_spell"] = None
    state["casts_this_turn"] = 0
    state["pending"] = None


def _apply_damage(state: Dict, player_id: str, amount: int) -> bool:
    pdata = state["players"][player_id]
    pdata["hp"] = max(0, pdata["hp"] - amount)
    return pdata["hp"] <= 0


def _apply_heal(state: Dict, player_id: str, amount: int) -> None:
    pdata = state["players"][player_id]
    pdata["hp"] = min(6, pdata["hp"] + amount)


def _finish_round(state: Dict, result_type: str, actor_id: str, victims: Optional[List[str]] = None) -> None:
    players = state["players"]
    survivors = [pid for pid, pdata in players.items() if pdata["hp"] > 0]
    add_scores = {pid: 0 for pid in players}
    if result_type == "kill":
        add_scores[actor_id] += 3
        for pid in survivors:
            if pid != actor_id:
                add_scores[pid] += 1
    elif result_type == "self_death":
        for pid in survivors:
            add_scores[pid] += 1
    elif result_type == "empty_hand":
        add_scores[actor_id] += 3

    for pid in survivors:
        add_scores[pid] += len(players[pid]["secret_cards"])

    for pid, gain in add_scores.items():
        players[pid]["score"] += gain

    state["round_result"] = {
        "type": result_type,
        "actor_id": actor_id,
        "victims": victims or [],
        "add_scores": add_scores,
    }
    state["round_end_by"] = actor_id
    state["pending"] = None
    state["last_spell"] = None
    state["casts_this_turn"] = 0

    target = int(state["config"]["target_score"])
    candidates = [pid for pid, pdata in players.items() if pdata["score"] >= target]
    if candidates:
        max_gain = max(add_scores[pid] for pid in candidates)
        winners = [pid for pid in candidates if add_scores[pid] == max_gain]
        state["winner"] = winners
        state["game_over"] = True
        state["phase"] = "game_over"
        return
    state["phase"] = "round_end"


def _setup_round(state: Dict, start_player_id: Optional[str], increment_round: bool) -> None:
    if increment_round:
        state["round"] += 1
    else:
        state["round"] = 1
    for pdata in state["players"].values():
        pdata["hand"] = []
        pdata["secret_cards"] = []
        pdata["hp"] = 6
    deck = _build_deck()
    secret_count = _secret_pool_size(state["config"], len(state["turn_order"]))
    state["secret_pool"] = deck[:secret_count]
    deck = deck[secret_count:]
    for pid in state["turn_order"]:
        state["players"][pid]["hand"] = deck[: int(state["config"]["hand_size"])]
        deck = deck[int(state["config"]["hand_size"]) :]
    state["deck"] = deck
    state["discard"] = []
    state["pending"] = None
    state["round_result"] = None
    state["round_end_by"] = None
    state["last_action"] = None
    state["last_spell"] = None
    state["casts_this_turn"] = 0
    state["phase"] = "wait_use"
    state["current_turn"] = start_player_id or (state["turn_order"][0] if state["turn_order"] else None)


class AbracaWhatGame:
    game_id = "abraca_what"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "hand": [],
                "secret_cards": [],
                "hp": 6,
                "score": 0,
            }

        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "round": 1,
            "phase": "wait_use",
            "last_spell": None,
            "casts_this_turn": 0,
            "pending": None,
            "last_action": None,
            "round_result": None,
            "round_end_by": None,
            "deck": [],
            "discard": [],
            "secret_pool": [],
            "winner": [],
            "game_over": False,
            "config": cfg,
        }
        _setup_round(state, state["current_turn"], increment_round=False)
        return state

    @staticmethod
    def _legal_actions(state: Dict, viewer_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if state.get("phase") == "round_end":
            return ["start_next_round"]
        if viewer_id != state.get("current_turn"):
            return []
        phase = state.get("phase")
        if phase in ("wait_use", "wait_goon"):
            actions = ["cast_spell"]
            if phase == "wait_goon" and state.get("casts_this_turn", 0) > 0:
                actions.append("end_turn")
            return actions
        if phase == "wait_draw":
            return ["end_turn"]
        if phase == "wait_dice":
            return ["roll_dice"]
        if phase == "wait_see":
            return ["take_secret"]
        return []

    @staticmethod
    def _allowed_spells(state: Dict, viewer_id: str) -> List[int]:
        if viewer_id != state.get("current_turn"):
            return []
        if state.get("phase") not in ("wait_use", "wait_goon"):
            return []
        min_spell = 0
        if state.get("phase") == "wait_goon" and state.get("last_spell") is not None:
            min_spell = int(state["last_spell"])
        return list(range(min_spell, len(SPELL_NAMES)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        if state.get("phase") == "round_end":
            if action_type != "start_next_round":
                return [], "round ended"
            end_by = state.get("round_end_by") or state.get("current_turn")
            order = state["turn_order"]
            start_player = end_by
            if end_by in order:
                start_player = order[(order.index(end_by) + 1) % len(order)]
            _setup_round(state, start_player, increment_round=True)
            return [], None

        if player_id != state.get("current_turn"):
            return [], "not your turn"

        if action_type == "cast_spell":
            if state.get("phase") not in ("wait_use", "wait_goon"):
                return [], "invalid action"
            spell_type = action.get("spell_type")
            if not isinstance(spell_type, int) or not (0 <= spell_type < len(SPELL_NAMES)):
                return [], "invalid spell_type"
            if state.get("phase") == "wait_goon" and state.get("last_spell") is not None:
                if spell_type < int(state["last_spell"]):
                    return [], "spell too low for chain"

            pdata = state["players"][player_id]
            state["casts_this_turn"] += 1
            card_id = _remove_spell_from_hand(pdata["hand"], spell_type)
            if card_id is None:
                if spell_type == 0:
                    state["pending"] = {"spell": spell_type, "success": False}
                    state["phase"] = "wait_dice"
                    state["last_action"] = {
                        "player_id": player_id,
                        "spell_type": spell_type,
                        "success": False,
                        "dice": None,
                    }
                    return [], None
                died = _apply_damage(state, player_id, 1)
                state["last_action"] = {
                    "player_id": player_id,
                    "spell_type": spell_type,
                    "success": False,
                    "dice": None,
                }
                if died:
                    _finish_round(state, "self_death", player_id, [player_id])
                else:
                    state["phase"] = "wait_draw"
                return [], None

            state["discard"].append(card_id)
            state["last_spell"] = spell_type
            state["last_action"] = {
                "player_id": player_id,
                "spell_type": spell_type,
                "success": True,
                "dice": None,
            }

            if spell_type == 0:
                state["pending"] = {"spell": spell_type, "success": True}
                state["phase"] = "wait_dice"
                return [], None
            if spell_type == 2:
                state["pending"] = {"spell": spell_type, "success": True}
                state["phase"] = "wait_dice"
                return [], None
            if spell_type == 3:
                if state["secret_pool"]:
                    state["pending"] = {"spell": spell_type, "success": True}
                    state["phase"] = "wait_see"
                    return [], None
                state["phase"] = "wait_goon"
                if not pdata["hand"]:
                    _finish_round(state, "empty_hand", player_id)
                return [], None

            order = state["turn_order"]
            idx = order.index(player_id)
            killed = False
            victims: List[str] = []
            if spell_type == 1:
                for pid in order:
                    if pid == player_id:
                        continue
                    if _apply_damage(state, pid, 1):
                        killed = True
                        victims.append(pid)
                _apply_heal(state, player_id, 1)
            elif spell_type == 4:
                targets = set()
                if len(order) == 2:
                    targets.add(order[(idx + 1) % len(order)])
                else:
                    targets.add(order[(idx - 1) % len(order)])
                    targets.add(order[(idx + 1) % len(order)])
                for pid in targets:
                    if _apply_damage(state, pid, 1):
                        killed = True
                        victims.append(pid)
            elif spell_type == 5:
                target = order[(idx - 1) % len(order)]
                if _apply_damage(state, target, 1):
                    killed = True
                    victims.append(target)
            elif spell_type == 6:
                target = order[(idx + 1) % len(order)]
                if _apply_damage(state, target, 1):
                    killed = True
                    victims.append(target)
            elif spell_type == 7:
                _apply_heal(state, player_id, 1)

            if killed:
                _finish_round(state, "kill", player_id, victims)
                return [], None

            if not pdata["hand"]:
                _finish_round(state, "empty_hand", player_id)
                return [], None

            state["phase"] = "wait_goon"
            return [], None

        if action_type == "roll_dice":
            if state.get("phase") != "wait_dice":
                return [], "invalid action"
            pending = state.get("pending")
            if not pending:
                return [], "no pending roll"
            roll = random.randint(1, 3)
            state["last_action"] = {
                "player_id": player_id,
                "spell_type": pending["spell"],
                "success": pending.get("success", False),
                "dice": roll,
            }
            if pending["spell"] == 0:
                if pending.get("success"):
                    killed = False
                    victims: List[str] = []
                    for pid in state["turn_order"]:
                        if pid == player_id:
                            continue
                        if _apply_damage(state, pid, roll):
                            killed = True
                            victims.append(pid)
                    if killed:
                        _finish_round(state, "kill", player_id, victims)
                        return [], None
                    if not state["players"][player_id]["hand"]:
                        _finish_round(state, "empty_hand", player_id)
                        return [], None
                    state["phase"] = "wait_goon"
                    state["pending"] = None
                    return [], None
                died = _apply_damage(state, player_id, roll)
                state["pending"] = None
                if died:
                    _finish_round(state, "self_death", player_id, [player_id])
                else:
                    state["phase"] = "wait_draw"
                return [], None

            if pending["spell"] == 2:
                _apply_heal(state, player_id, roll)
                state["pending"] = None
                if not state["players"][player_id]["hand"]:
                    _finish_round(state, "empty_hand", player_id)
                    return [], None
                state["phase"] = "wait_goon"
                return [], None

            return [], "invalid pending spell"

        if action_type == "take_secret":
            if state.get("phase") != "wait_see":
                return [], "invalid action"
            if state.get("pending", {}).get("spell") != 3:
                return [], "invalid pending spell"
            if state["secret_pool"]:
                card = state["secret_pool"].pop(random.randrange(len(state["secret_pool"])))
                state["players"][player_id]["secret_cards"].append(card)
            state["pending"] = None
            if not state["players"][player_id]["hand"]:
                _finish_round(state, "empty_hand", player_id)
                return [], None
            state["phase"] = "wait_goon"
            return [], None

        if action_type == "end_turn":
            if state.get("phase") not in ("wait_goon", "wait_draw"):
                return [], "invalid action"
            if state.get("phase") == "wait_goon" and state.get("casts_this_turn", 0) < 1:
                return [], "must cast at least once"
            _draw_to_hand(state, player_id)
            _advance_turn(state)
            return [], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        order = state["turn_order"]
        reveal_all = state.get("phase") in ("round_end", "game_over") or viewer_id not in state["players"]
        players_view = []
        for pid in order:
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            hand_view = []
            for card_id in pdata["hand"]:
                if reveal_all or viewer_id != pid:
                    spell = _spell_type(card_id)
                    hand_view.append(
                        {
                            "spell": spell,
                            "number": spell + 1,
                            "name": SPELL_NAMES[spell],
                        }
                    )
                else:
                    hand_view.append({"hidden": True})
            player_view = {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "hp": pdata["hp"],
                "score": pdata["score"],
                "hand": hand_view,
                "secret_count": len(pdata["secret_cards"]),
            }
            if pid == viewer_id:
                player_view["secret_cards"] = [
                    {"spell": _spell_type(cid), "number": _spell_type(cid) + 1, "name": SPELL_NAMES[_spell_type(cid)]}
                    for cid in pdata["secret_cards"]
                ]
            players_view.append(player_view)

        discard_counts = [0 for _ in SPELL_COUNTS]
        for card_id in state["discard"]:
            discard_counts[_spell_type(card_id)] += 1

        last_action = state.get("last_action")
        round_result = state.get("round_result")

        return {
            "game_id": AbracaWhatGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "current_turn": state["current_turn"],
            "players": players_view,
            "deck_count": len(state["deck"]),
            "secret_pool_count": len(state["secret_pool"]),
            "discard_total": len(state["discard"]),
            "discard_counts": discard_counts,
            "last_action": last_action,
            "round_result": round_result,
            "legal_actions": AbracaWhatGame._legal_actions(state, viewer_id),
            "allowed_spells": AbracaWhatGame._allowed_spells(state, viewer_id),
            "min_spell": state["last_spell"] if state.get("phase") == "wait_goon" else None,
            "winner": state.get("winner", []),
            "game_over": state.get("game_over", False),
            "config": {"target_score": state["config"]["target_score"]},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id != state.get("current_turn"):
            return None
        phase = state.get("phase")
        if phase in ("wait_use", "wait_goon"):
            min_spell = 0
            if phase == "wait_goon" and state.get("last_spell") is not None:
                min_spell = int(state["last_spell"])
            hand = state["players"][bot_id]["hand"]
            candidates = [ _spell_type(cid) for cid in hand if _spell_type(cid) >= min_spell ]
            if candidates:
                return {"type": "cast_spell", "spell_type": random.choice(candidates)}
            return {"type": "cast_spell", "spell_type": random.randint(min_spell, len(SPELL_NAMES) - 1)}
        if phase == "wait_dice":
            return {"type": "roll_dice"}
        if phase == "wait_see":
            return {"type": "take_secret"}
        if phase == "wait_draw":
            return {"type": "end_turn"}
        if phase == "round_end":
            return {"type": "start_next_round"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
