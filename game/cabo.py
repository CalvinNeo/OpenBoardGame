import random
from typing import Dict, List, Optional, Tuple

CHOICE_VALUES = {
    7: "peek",
    8: "peek",
    9: "spy",
    10: "spy",
    11: "swap",
    12: "swap",
}

DEFAULT_CONFIG = {
    "target_score": 100,
    "shooting_moon": False,
    "score_reset": False,
    "double_swap": False,
    "deck_counts": {str(v): 4 for v in range(14)},
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            if key == "deck_counts" and isinstance(value, dict):
                merged_counts = {**cfg["deck_counts"], **value}
                cfg["deck_counts"] = merged_counts
            else:
                cfg[key] = value
    return cfg


def _choice_type(value: int) -> Optional[str]:
    return CHOICE_VALUES.get(value)


def _build_deck(config: Dict) -> List[Dict]:
    deck = []
    counts = config["deck_counts"]
    for value in range(14):
        count = int(counts.get(str(value), 0))
        for _ in range(count):
            deck.append({"value": value, "choice": _choice_type(value)})
    random.shuffle(deck)
    return deck


def _init_knowledge(player_ids: List[str]) -> Dict[str, Dict[str, List[bool]]]:
    knowledge = {}
    for viewer_id in player_ids:
        knowledge[viewer_id] = {}
        for target_id in player_ids:
            knowledge[viewer_id][target_id] = [False, False, False, False]
    return knowledge


def _clear_slot_knowledge(state: Dict, player_id: str, slot: int) -> None:
    state["players"][player_id]["public_known"][slot] = False
    for viewer_id in state["knowledge"].keys():
        state["knowledge"][viewer_id][player_id][slot] = False


def _add_card_to_hand(state: Dict, player_id: str, card: Dict) -> int:
    hand = state["players"][player_id]["hand"]
    try:
        slot = hand.index(None)
    except ValueError:
        slot = len(hand)
        hand.append(card)
        state["players"][player_id]["public_known"].append(False)
        for viewer_id in state["knowledge"].keys():
            state["knowledge"][viewer_id][player_id].append(False)
        return slot
    hand[slot] = card
    _clear_slot_knowledge(state, player_id, slot)
    return slot


def _deck_reshuffle_if_needed(state: Dict) -> bool:
    if state["deck"]:
        return True
    if len(state["discard"]) <= 1:
        return False
    top = state["discard"].pop()
    state["deck"] = state["discard"]
    state["discard"] = [top]
    random.shuffle(state["deck"])
    return True


def _advance_turn(state: Dict, ended_player_id: str) -> Optional[Dict]:
    if state["cabo_called_by"] and ended_player_id != state["cabo_called_by"]:
        state["cabo_turns_left"] -= 1
        if state["cabo_turns_left"] <= 0:
            summary = CaboGame._end_round(state)
            return summary

    order = state["turn_order"]
    idx = order.index(state["current_turn"])
    next_idx = (idx + 1) % len(order)
    state["current_turn"] = order[next_idx]
    state["phase"] = "turn"
    state["last_drawn"] = None
    state["pending_choice"] = None
    return None


def _hand_values(hand: List[Optional[Dict]]) -> List[int]:
    values = []
    for card in hand:
        if card is None:
            continue
        values.append(card["value"])
    return values


def _score_round(state: Dict) -> Dict:
    players = state["players"]
    round_scores = {}
    hands = {}
    for pid, pdata in players.items():
        values = _hand_values(pdata["hand"])
        hands[pid] = values
        round_scores[pid] = sum(values)

    summary = {
        "hands": hands,
        "round_scores": round_scores,
        "cabo_called_by": state["cabo_called_by"],
        "shooting_moon": False,
    }

    if state["config"]["shooting_moon"]:
        shooters = []
        for pid, values in hands.items():
            if sorted(values) == [12, 12, 13, 13]:
                shooters.append(pid)
        if shooters:
            summary["shooting_moon"] = True
            for pid in players.keys():
                add = 0 if pid in shooters else 50
                players[pid]["score"] += add
            return summary

    lowest = min(round_scores.values()) if round_scores else 0
    lowest_players = [pid for pid, val in round_scores.items() if val == lowest]

    for pid, score in round_scores.items():
        add = 0 if pid in lowest_players else score
        players[pid]["score"] += add

    caller = state["cabo_called_by"]
    if caller and caller not in lowest_players:
        players[caller]["score"] += 5

    if state["config"]["score_reset"]:
        for pid, pdata in players.items():
            if pdata["score"] == 100 and not pdata["score_reset_used"]:
                pdata["score"] = 50
                pdata["score_reset_used"] = True

    return summary


class CaboGame:
    game_id = "cabo"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        deck = _build_deck(cfg)
        if len(deck) < len(players) * 4 + 1:
            raise ValueError("deck too small for player count")

        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            hand = [deck.pop() for _ in range(4)]
            state_players[pid] = {
                "hand": hand,
                "public_known": [False, False, False, False],
                "score": 0,
                "score_reset_used": False,
                "initial_peek_done": False,
            }

        discard = [deck.pop()]

        return {
            "deck": deck,
            "discard": discard,
            "players": state_players,
            "knowledge": _init_knowledge(player_ids),
            "turn_order": player_ids,
            "current_turn": player_ids[0],
            "phase": "initial_peek",
            "last_drawn": None,
            "pending_choice": None,
            "cabo_called_by": None,
            "cabo_turns_left": 0,
            "config": cfg,
            "round": 1,
            "player_meta": player_meta,
            "last_round_summary": None,
            "game_over": False,
        }

    @staticmethod
    def start_new_round(state: Dict) -> None:
        cfg = state["config"]
        deck = _build_deck(cfg)
        player_ids = list(state["players"].keys())
        if len(deck) < len(player_ids) * 4 + 1:
            raise ValueError("deck too small for player count")

        for pid in player_ids:
            hand = [deck.pop() for _ in range(4)]
            state["players"][pid]["hand"] = hand
            state["players"][pid]["public_known"] = [False, False, False, False]
            state["players"][pid]["initial_peek_done"] = False

        state["knowledge"] = _init_knowledge(player_ids)
        state["discard"] = [deck.pop()]
        state["deck"] = deck
        state["phase"] = "initial_peek"
        state["last_drawn"] = None
        state["pending_choice"] = None
        state["cabo_called_by"] = None
        state["cabo_turns_left"] = 0
        state["round"] += 1
        state["current_turn"] = state["turn_order"][0]
        state["game_over"] = False

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []

        if state["phase"] == "initial_peek":
            if not state["players"][player_id]["initial_peek_done"]:
                return ["initial_peek"]
            return []

        if state["phase"] == "round_end":
            if state.get("game_over"):
                return []
            return ["next_round"]

        if player_id != state["current_turn"]:
            return []

        phase = state["phase"]
        if phase == "turn":
            actions = ["draw_deck", "draw_discard", "call_cabo"]
            if state["cabo_called_by"]:
                actions = [a for a in actions if a != "call_cabo"]
            if not state["discard"]:
                actions = [a for a in actions if a != "draw_discard"]
            return actions
        if phase == "drawn":
            return ["replace_card", "discard_drawn", "attempt_match"]
        if phase == "choice_pending":
            return ["use_choice_action"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if state["phase"] == "initial_peek":
            if action_type != "initial_peek":
                return [], "only initial_peek allowed"
            slots = action.get("slots")
            if not isinstance(slots, list) or len(slots) != 2:
                return [], "initial_peek requires two slots"
            if len(set(slots)) != 2 or any(not isinstance(s, int) for s in slots):
                return [], "invalid slots"
            hand = state["players"][player_id]["hand"]
            max_slot = len(hand) - 1
            if any(s < 0 or s > max_slot for s in slots):
                return [], "slots out of range"
            if state["players"][player_id]["initial_peek_done"]:
                return [], "initial_peek already done"
            for slot in slots:
                state["knowledge"][player_id][player_id][slot] = True
            state["players"][player_id]["initial_peek_done"] = True
            if all(p["initial_peek_done"] for p in state["players"].values()):
                state["phase"] = "turn"
            events.append({"type": "game:initial_peek", "payload": {"player_id": player_id}})
            return events, None

        if state["phase"] == "round_end":
            if state.get("game_over"):
                return [], "game over"
            if action_type != "next_round":
                return [], "only next_round allowed"
            CaboGame.start_new_round(state)
            events.append({"type": "game:next_round", "payload": {"round": state["round"]}})
            return events, None

        if player_id != state["current_turn"]:
            return [], "not your turn"

        phase = state["phase"]
        if phase == "turn":
            if action_type == "draw_deck":
                if not _deck_reshuffle_if_needed(state):
                    return [], "deck empty"
                state["last_drawn"] = state["deck"].pop()
                state["phase"] = "drawn"
                events.append({"type": "game:draw_deck", "payload": {"player_id": player_id}})
                return events, None

            if action_type == "draw_discard":
                slot = action.get("slot")
                hand = state["players"][player_id]["hand"]
                if not isinstance(slot, int) or slot < 0 or slot >= len(hand):
                    return [], "invalid slot"
                if not state["discard"]:
                    return [], "discard empty"
                if hand[slot] is None:
                    return [], "slot empty"
                drawn = state["discard"].pop()
                replaced = hand[slot]
                state["discard"].append(replaced)
                hand[slot] = drawn
                _clear_slot_knowledge(state, player_id, slot)
                state["players"][player_id]["public_known"][slot] = True
                state["knowledge"][player_id][player_id][slot] = True
                summary = _advance_turn(state, player_id)
                if summary:
                    events.append({"type": "game:round_end", "payload": summary})
                return events, None

            if action_type == "call_cabo":
                if state["cabo_called_by"]:
                    return [], "cabo already called"
                state["cabo_called_by"] = player_id
                state["cabo_turns_left"] = len(state["turn_order"]) - 1
                summary = _advance_turn(state, player_id)
                if summary:
                    events.append({"type": "game:round_end", "payload": summary})
                events.append({"type": "game:call_cabo", "payload": {"player_id": player_id}})
                return events, None

            return [], "invalid action for phase"

        if phase == "drawn":
            if action_type == "replace_card":
                slot = action.get("slot")
                hand = state["players"][player_id]["hand"]
                if not isinstance(slot, int) or slot < 0 or slot >= len(hand):
                    return [], "invalid slot"
                if hand[slot] is None:
                    return [], "slot empty"
                drawn = state["last_drawn"]
                if drawn is None:
                    return [], "no drawn card"
                replaced = hand[slot]
                state["discard"].append(replaced)
                hand[slot] = drawn
                state["last_drawn"] = None
                _clear_slot_knowledge(state, player_id, slot)
                summary = _advance_turn(state, player_id)
                if summary:
                    events.append({"type": "game:round_end", "payload": summary})
                return events, None

            if action_type == "discard_drawn":
                drawn = state["last_drawn"]
                if drawn is None:
                    return [], "no drawn card"
                state["discard"].append(drawn)
                state["last_drawn"] = None
                choice = drawn.get("choice")
                if choice:
                    state["phase"] = "choice_pending"
                    state["pending_choice"] = {"type": choice}
                    return events, None
                summary = _advance_turn(state, player_id)
                if summary:
                    events.append({"type": "game:round_end", "payload": summary})
                return events, None

            if action_type == "attempt_match":
                slots = action.get("slots")
                if not isinstance(slots, list) or len(slots) < 2 or len(slots) > 4:
                    return [], "invalid slots"
                if len(set(slots)) != len(slots):
                    return [], "slots must be unique"
                drawn = state["last_drawn"]
                if drawn is None:
                    return [], "no drawn card"
                hand = state["players"][player_id]["hand"]
                if any(not isinstance(s, int) or s < 0 or s >= len(hand) for s in slots):
                    return [], "invalid slot"
                if any(hand[s] is None for s in slots):
                    return [], "slot empty"
                values = [hand[s]["value"] for s in slots]
                if len(set(values)) == 1:
                    for s in slots:
                        state["discard"].append(hand[s])
                        hand[s] = None
                        _clear_slot_knowledge(state, player_id, s)
                    _add_card_to_hand(state, player_id, drawn)
                    events.append({"type": "game:match_success", "payload": {"player_id": player_id}})
                else:
                    for s in slots:
                        state["players"][player_id]["public_known"][s] = True
                        state["knowledge"][player_id][player_id][s] = True
                    _add_card_to_hand(state, player_id, drawn)
                    events.append({"type": "game:match_fail", "payload": {"player_id": player_id}})
                state["last_drawn"] = None
                summary = _advance_turn(state, player_id)
                if summary:
                    events.append({"type": "game:round_end", "payload": summary})
                return events, None

            return [], "invalid action for phase"

        if phase == "choice_pending":
            if action_type != "use_choice_action":
                return [], "must resolve choice action"
            pending = state["pending_choice"]
            if not pending:
                return [], "no pending choice"
            choice_type = action.get("choice_type")
            if choice_type != pending.get("type"):
                return [], "choice type mismatch"
            target = action.get("target", {})
            if choice_type == "peek":
                slot = target.get("slot")
                hand = state["players"][player_id]["hand"]
                if not isinstance(slot, int) or slot < 0 or slot >= len(hand):
                    return [], "invalid slot"
                state["knowledge"][player_id][player_id][slot] = True
            elif choice_type == "spy":
                target_id = target.get("player_id")
                slot = target.get("slot")
                if target_id not in state["players"]:
                    return [], "invalid target player"
                target_hand = state["players"][target_id]["hand"]
                if not isinstance(slot, int) or slot < 0 or slot >= len(target_hand):
                    return [], "invalid slot"
                if target_hand[slot] is None:
                    return [], "slot empty"
                state["knowledge"][player_id][target_id][slot] = True
            elif choice_type == "swap":
                target_id = target.get("player_id")
                slot = target.get("slot")
                self_slot = target.get("self_slot")
                if target_id not in state["players"]:
                    return [], "invalid target player"
                target_hand = state["players"][target_id]["hand"]
                if not isinstance(slot, int) or slot < 0 or slot >= len(target_hand):
                    return [], "invalid slot"
                self_hand = state["players"][player_id]["hand"]
                if not isinstance(self_slot, int) or self_slot < 0 or self_slot >= len(self_hand):
                    return [], "invalid self_slot"
                if target_hand[slot] is None:
                    return [], "slot empty"
                if self_hand[self_slot] is None:
                    return [], "self slot empty"
                self_hand[self_slot], target_hand[slot] = (
                    target_hand[slot],
                    self_hand[self_slot],
                )
                _clear_slot_knowledge(state, player_id, self_slot)
                _clear_slot_knowledge(state, target_id, slot)
            else:
                return [], "unknown choice type"

            state["phase"] = "turn"
            state["pending_choice"] = None
            summary = _advance_turn(state, player_id)
            if summary:
                events.append({"type": "game:round_end", "payload": summary})
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = state["turn_order"]
        reveal_all = state["phase"] == "round_end"
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            hand_view = []
            for idx, card in enumerate(pdata["hand"]):
                known = pdata["public_known"][idx]
                if viewer_id in state["knowledge"]:
                    known = known or state["knowledge"][viewer_id][pid][idx]
                if reveal_all and card is not None:
                    known = True
                value = card["value"] if (card is not None and known) else None
                hand_view.append({"known": known, "value": value, "empty": card is None})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": pdata["score"],
                    "hand": hand_view,
                    "hand_count": len([c for c in pdata["hand"] if c is not None]),
                    "initial_peek_done": pdata["initial_peek_done"],
                }
            )

        last_drawn = None
        if viewer_id == state["current_turn"] and state["last_drawn"]:
            last_drawn = state["last_drawn"]["value"]

        top_discard = state["discard"][-1]["value"] if state["discard"] else None

        return {
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "current_turn": state["current_turn"],
            "players": players_view,
            "deck_count": len(state["deck"]),
            "discard_top": top_discard,
            "last_drawn": last_drawn,
            "cabo_called_by": state["cabo_called_by"],
            "cabo_turns_left": state["cabo_turns_left"],
            "pending_choice": state["pending_choice"],
            "legal_actions": CaboGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "game_over": state.get("game_over", False),
            "config": {
                "target_score": state["config"]["target_score"],
                "shooting_moon": state["config"]["shooting_moon"],
                "score_reset": state["config"]["score_reset"],
                "double_swap": state["config"]["double_swap"],
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state["phase"] == "initial_peek":
            if not state["players"][bot_id]["initial_peek_done"]:
                slots = random.sample([0, 1, 2, 3], 2)
                return {"type": "initial_peek", "slots": slots}
            return None

        if bot_id != state["current_turn"]:
            return None

        phase = state["phase"]
        if phase == "turn":
            options = ["draw_deck", "draw_discard"]
            if not state["discard"]:
                options = ["draw_deck"]
            choice = random.choice(options)
            if choice == "draw_discard":
                slots = [i for i, c in enumerate(state["players"][bot_id]["hand"]) if c is not None]
                if not slots:
                    return {"type": "draw_deck"}
                return {"type": "draw_discard", "slot": random.choice(slots)}
            return {"type": "draw_deck"}

        if phase == "drawn":
            drawn = state["last_drawn"]
            if not drawn:
                return {"type": "discard_drawn"}
            hand = state["players"][bot_id]["hand"]
            matches = {}
            for i, card in enumerate(hand):
                if card is None:
                    continue
                matches.setdefault(card["value"], []).append(i)
            match_candidates = [slots for slots in matches.values() if len(slots) >= 2]
            if match_candidates:
                slots = random.choice(match_candidates)
                slots = slots[: min(4, len(slots))]
                return {"type": "attempt_match", "slots": slots}
            slots = [i for i, c in enumerate(hand) if c is not None]
            if not slots:
                return {"type": "discard_drawn"}
            if random.random() < 0.5:
                return {"type": "replace_card", "slot": random.choice(slots)}
            return {"type": "discard_drawn"}

        if phase == "choice_pending":
            pending = state["pending_choice"]
            if not pending:
                return None
            choice = pending["type"]
            if choice == "peek":
                return {"type": "use_choice_action", "choice_type": "peek", "target": {"slot": random.randint(0, 3)}}
            if choice == "spy":
                others = [pid for pid in state["players"] if pid != bot_id]
                if not others:
                    return {"type": "use_choice_action", "choice_type": "peek", "target": {"slot": random.randint(0, 3)}}
                target_id = random.choice(others)
                return {
                    "type": "use_choice_action",
                    "choice_type": "spy",
                    "target": {"player_id": target_id, "slot": random.randint(0, 3)},
                }
            if choice == "swap":
                others = [pid for pid in state["players"] if pid != bot_id]
                if not others:
                    return {"type": "use_choice_action", "choice_type": "peek", "target": {"slot": random.randint(0, 3)}}
                target_id = random.choice(others)
                return {
                    "type": "use_choice_action",
                    "choice_type": "swap",
                    "target": {
                        "player_id": target_id,
                        "slot": random.randint(0, 3),
                        "self_slot": random.randint(0, 3),
                    },
                }

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

    @staticmethod
    def _end_round(state: Dict) -> Dict:
        summary = _score_round(state)
        summary["total_scores"] = {pid: pdata["score"] for pid, pdata in state["players"].items()}
        state["last_round_summary"] = summary

        target = state["config"]["target_score"]
        state["game_over"] = any(pdata["score"] >= target for pdata in state["players"].values())
        state["phase"] = "round_end"
        return summary
