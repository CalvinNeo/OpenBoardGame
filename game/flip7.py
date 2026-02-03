import random
from typing import Dict, List, Optional, Tuple

CARD_NUMBER = "number"
CARD_ACTION = "action"
CARD_MODIFIER = "modifier"

ACTION_SECOND_CHANCE = "second_chance"
ACTION_FREEZE = "freeze"
ACTION_FLIP_THREE = "flip_three"

DEFAULT_CONFIG = {
    "target_score": 200,
}

MODIFIER_POINTS = [2, 4, 6, 8, 10]

ACTION_LABELS = {
    ACTION_SECOND_CHANCE: "Second Chance",
    ACTION_FREEZE: "Freeze",
    ACTION_FLIP_THREE: "Flip Three",
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck() -> List[Dict]:
    deck: List[Dict] = []
    deck.append({"type": CARD_NUMBER, "value": 0})
    for value in range(1, 13):
        for _ in range(value):
            deck.append({"type": CARD_NUMBER, "value": value})
    for _ in range(3):
        deck.append({"type": CARD_ACTION, "action": ACTION_SECOND_CHANCE})
        deck.append({"type": CARD_ACTION, "action": ACTION_FREEZE})
        deck.append({"type": CARD_ACTION, "action": ACTION_FLIP_THREE})
    for points in MODIFIER_POINTS:
        deck.append({"type": CARD_MODIFIER, "points": points})
    deck.append({"type": CARD_MODIFIER, "multiplier": 2})
    random.shuffle(deck)
    return deck


def _card_label(card: Optional[Dict]) -> Optional[str]:
    if not card:
        return None
    card_type = card.get("type")
    if card_type == CARD_NUMBER:
        return str(card.get("value"))
    if card_type == CARD_ACTION:
        return ACTION_LABELS.get(card.get("action"), "Action")
    if card_type == CARD_MODIFIER:
        if "points" in card:
            return f"+{card.get('points')}"
        if card.get("multiplier") == 2:
            return "x2"
    return None


def _card_view(card: Dict) -> Dict:
    return {
        "type": card.get("type"),
        "label": _card_label(card) or "?",
        "value": card.get("value"),
        "points": card.get("points"),
        "multiplier": card.get("multiplier"),
        "action": card.get("action"),
    }


def _active_player_ids(state: Dict) -> List[str]:
    return [
        pid
        for pid in state["turn_order"]
        if state["players"][pid]["status"] == "active"
    ]


def _next_active_after(state: Dict, player_id: Optional[str]) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    active = _active_player_ids(state)
    if not active:
        return None
    if player_id not in order:
        return active[0]
    idx = order.index(player_id)
    for offset in range(1, len(order) + 1):
        candidate = order[(idx + offset) % len(order)]
        if state["players"][candidate]["status"] == "active":
            return candidate
    return None


def _ensure_current_turn(state: Dict) -> None:
    current = state.get("current_turn")
    if current and state["players"][current]["status"] == "active":
        return
    state["current_turn"] = _next_active_after(state, current)


def _unique_numbers(pdata: Dict) -> List[int]:
    return list(
        {
            card.get("value")
            for card in pdata["tableau"]
            if card.get("type") == CARD_NUMBER
        }
    )


def _has_second_chance(pdata: Dict) -> bool:
    return any(
        card.get("type") == CARD_ACTION and card.get("action") == ACTION_SECOND_CHANCE
        for card in pdata["tableau"]
    )


def _consume_second_chance(pdata: Dict) -> Optional[Dict]:
    for idx, card in enumerate(pdata["tableau"]):
        if card.get("type") == CARD_ACTION and card.get("action") == ACTION_SECOND_CHANCE:
            return pdata["tableau"].pop(idx)
    return None


def _score_breakdown(tableau: List[Dict], flip7_bonus: bool) -> Dict:
    numbers = [card["value"] for card in tableau if card.get("type") == CARD_NUMBER]
    numbers_sum = sum(numbers)
    modifier_points = sum(
        card.get("points", 0)
        for card in tableau
        if card.get("type") == CARD_MODIFIER and "points" in card
    )
    x2_count = sum(
        1
        for card in tableau
        if card.get("type") == CARD_MODIFIER and card.get("multiplier") == 2
    )
    bonus = 15 if flip7_bonus else 0
    total = numbers_sum * (2**x2_count) + modifier_points + bonus
    return {
        "numbers": numbers,
        "numbers_sum": numbers_sum,
        "modifier_points": modifier_points,
        "x2_count": x2_count,
        "bonus": bonus,
        "total": total,
    }


def _bank_player(state: Dict, player_id: str, flip7_bonus: bool = False) -> None:
    pdata = state["players"][player_id]
    if pdata["banked"]:
        return
    breakdown = _score_breakdown(pdata["tableau"], flip7_bonus)
    pdata["round_score"] = breakdown["total"]
    pdata["round_breakdown"] = breakdown
    pdata["score"] += breakdown["total"]
    pdata["banked"] = True
    if pdata["status"] == "active":
        pdata["status"] = "stayed"


def _handle_bust(state: Dict, player_id: str, drawn_card: Dict, extra_discards: Optional[List[Dict]] = None) -> None:
    pdata = state["players"][player_id]
    state["discard"].extend(pdata["tableau"])
    pdata["tableau"] = []
    state["discard"].append(drawn_card)
    if extra_discards:
        state["discard"].extend(extra_discards)
    pdata["status"] = "busted"
    pdata["banked"] = True
    pdata["round_score"] = 0
    pdata["round_breakdown"] = {
        "numbers": [],
        "numbers_sum": 0,
        "modifier_points": 0,
        "x2_count": 0,
        "bonus": 0,
        "total": 0,
    }


def _eligible_targets(state: Dict, action_type: str) -> List[str]:
    active = _active_player_ids(state)
    if action_type == ACTION_SECOND_CHANCE:
        return [pid for pid in active if not _has_second_chance(state["players"][pid])]
    return active


def _ensure_deck(state: Dict) -> bool:
    if state["deck"]:
        return True
    if not state["discard"]:
        return False
    state["deck"] = state["discard"]
    state["discard"] = []
    random.shuffle(state["deck"])
    return True


def _queue_action(state: Dict, entry: Dict) -> None:
    if state["pending_action"] is None:
        state["pending_action"] = entry
        state["phase"] = "action_target"
    else:
        state["action_queue"].append(entry)


def _advance_pending_action(state: Dict) -> None:
    if state["action_queue"]:
        state["pending_action"] = state["action_queue"].pop(0)
        state["phase"] = "action_target"
        return
    state["pending_action"] = None
    if not state.get("game_over") and state.get("phase") == "action_target":
        state["phase"] = "playing"


def _round_should_end(state: Dict) -> bool:
    if state.get("flip7_winner"):
        return True
    return not _active_player_ids(state)


def _end_round(state: Dict, reason: str) -> None:
    flip7_winner = state.get("flip7_winner")
    for pid, pdata in state["players"].items():
        if pdata["status"] == "active":
            _bank_player(state, pid, flip7_bonus=(pid == flip7_winner))
        elif pdata["status"] == "busted" and not pdata["banked"]:
            pdata["banked"] = True
            pdata["round_score"] = 0
    summary_scores = {}
    summary_totals = {}
    summary_status = {}
    summary_breakdowns = {}
    summary_flips = {}
    for pid, pdata in state["players"].items():
        summary_scores[pid] = pdata.get("round_score", 0)
        summary_totals[pid] = pdata.get("score", 0)
        summary_status[pid] = pdata.get("status")
        breakdown = pdata.get("round_breakdown")
        if isinstance(breakdown, dict):
            summary_breakdowns[pid] = breakdown
        flips = pdata.get("round_flips")
        if isinstance(flips, list):
            summary_flips[pid] = list(flips)
        else:
            summary_flips[pid] = []

    state["last_round_summary"] = {
        "round": state["round"],
        "reason": reason,
        "flip7_winner": flip7_winner,
        "round_scores": summary_scores,
        "total_scores": summary_totals,
        "status": summary_status,
        "breakdowns": summary_breakdowns,
        "flips": summary_flips,
    }

    for pdata in state["players"].values():
        if pdata["tableau"]:
            state["discard"].extend(pdata["tableau"])
            pdata["tableau"] = []

    if state.get("pending_action"):
        state["discard"].append(state["pending_action"]["card"])
    for entry in state.get("action_queue", []):
        state["discard"].append(entry["card"])
    state["pending_action"] = None
    state["action_queue"] = []

    scores = [pdata.get("score", 0) for pdata in state["players"].values()]
    if scores:
        max_score = max(scores)
    else:
        max_score = 0
    target = int(state["config"]["target_score"])
    winners = [pid for pid, pdata in state["players"].items() if pdata.get("score", 0) == max_score]
    if max_score >= target and len(winners) == 1:
        state["game_over"] = True
        state["winner"] = winners[0]
        state["phase"] = "game_over"
        return
    state["phase"] = "round_end"


def _draw_card(state: Dict, player_id: str, deferred_actions: Optional[List[Dict]] = None) -> Tuple[List[Dict], bool, bool, Optional[str]]:
    if not _ensure_deck(state):
        return [], False, False, "deck empty"
    card = state["deck"].pop()
    pdata = state["players"][player_id]
    pdata.setdefault("round_flips", []).append(_card_view(card))
    card_label = _card_label(card)
    events = [{"type": "flip7:draw", "payload": {"player_id": player_id, "card": card_label}}]
    card_type = card.get("type")

    if card_type == CARD_NUMBER:
        numbers = _unique_numbers(pdata)
        value = card.get("value")
        if value in numbers:
            if _has_second_chance(pdata):
                saved = _consume_second_chance(pdata)
                state["discard"].append(card)
                if saved:
                    state["discard"].append(saved)
                events.append({"type": "flip7:second_chance", "payload": {"player_id": player_id}})
                return events, False, False, None
            extra_cards = None
            if deferred_actions:
                extra_cards = [entry["card"] for entry in deferred_actions]
            _handle_bust(state, player_id, card, extra_discards=extra_cards)
            events.append({"type": "flip7:bust", "payload": {"player_id": player_id}})
            return events, True, False, None
        pdata["tableau"].append(card)
        if len(set(_unique_numbers(pdata))) >= 7:
            pdata["flip7"] = True
            state["flip7_winner"] = player_id
            events.append({"type": "flip7:flip7", "payload": {"player_id": player_id}})
            return events, False, True, None
        return events, False, False, None

    if card_type == CARD_MODIFIER:
        pdata["tableau"].append(card)
        return events, False, False, None

    if card_type == CARD_ACTION:
        action_type = card.get("action")
        if action_type == ACTION_FLIP_THREE:
            eligible = _eligible_targets(state, action_type)
            if not eligible:
                state["discard"].append(card)
                events.append({"type": "flip7:action_discard", "payload": {"player_id": player_id}})
                return events, False, False, None
            events.append(
                {"type": "flip7:action_drawn", "payload": {"player_id": player_id, "action": action_type}}
            )
            state["discard"].append(card)
            draw_events, error, queued_actions = _resolve_flip_three(state, player_id)
            events.extend(draw_events)
            if error:
                return events, False, False, error
            if deferred_actions is not None:
                deferred_actions.extend(queued_actions)
            else:
                for entry in queued_actions:
                    _queue_action(state, entry)
            events.append(
                {
                    "type": "flip7:flip_three",
                    "payload": {"player_id": player_id, "target_id": player_id},
                }
            )
            busted = state["players"][player_id]["status"] == "busted"
            flip7_hit = state.get("flip7_winner") == player_id
            return events, busted, flip7_hit, None
        eligible = _eligible_targets(state, action_type)
        if not eligible:
            state["discard"].append(card)
            events.append({"type": "flip7:action_discard", "payload": {"player_id": player_id}})
            return events, False, False, None
        entry = {"card": card, "actor_id": player_id}
        if deferred_actions is not None:
            deferred_actions.append(entry)
        else:
            _queue_action(state, entry)
        events.append(
            {"type": "flip7:action_drawn", "payload": {"player_id": player_id, "action": action_type}}
        )
        return events, False, False, None

    return events, False, False, None


def _resolve_flip_three(state: Dict, target_id: str) -> Tuple[List[Dict], Optional[str], List[Dict]]:
    events: List[Dict] = []
    deferred_actions: List[Dict] = []
    for _ in range(3):
        draw_events, busted, flip7_hit, error = _draw_card(
            state, target_id, deferred_actions=deferred_actions
        )
        events.extend(draw_events)
        if error:
            return events, error, []
        if busted or flip7_hit:
            if deferred_actions:
                for entry in deferred_actions:
                    state["discard"].append(entry["card"])
            return events, None, []
    return events, None, deferred_actions


def _start_round(state: Dict) -> None:
    state["flip7_winner"] = None
    state["pending_action"] = None
    state["action_queue"] = []
    for pdata in state["players"].values():
        pdata["tableau"] = []
        pdata["status"] = "active"
        pdata["banked"] = False
        pdata["round_score"] = None
        pdata["round_breakdown"] = None
        pdata["round_flips"] = []
        pdata["flip7"] = False

    for pid in state["turn_order"]:
        draw_events, _, flip7_hit, error = _draw_card(state, pid)
        if error:
            raise ValueError(error)
        if flip7_hit:
            break

    if state.get("pending_action"):
        state["phase"] = "action_target"
    else:
        state["phase"] = "playing"
    state["current_turn"] = state["turn_order"][0] if state["turn_order"] else None


class Flip7Game:
    game_id = "flip7"
    min_players = 2
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        deck = _build_deck()
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "tableau": [],
                "status": "active",
                "score": 0,
                "round_score": None,
                "round_breakdown": None,
                "round_flips": [],
                "banked": False,
                "flip7": False,
            }

        state = {
            "deck": deck,
            "discard": [],
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "playing",
            "round": 1,
            "config": cfg,
            "player_meta": player_meta,
            "pending_action": None,
            "action_queue": [],
            "flip7_winner": None,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }
        _start_round(state)
        return state

    @staticmethod
    def start_new_round(state: Dict) -> None:
        state["round"] += 1
        _start_round(state)

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        if state.get("game_over"):
            return []
        phase = state.get("phase")
        if phase == "round_end":
            return ["next_round"]
        if phase == "action_target":
            pending = state.get("pending_action")
            if pending and pending.get("actor_id") == player_id:
                return ["choose_target"]
            return []
        if phase != "playing":
            return []
        if player_id != state.get("current_turn"):
            return []
        if state["players"][player_id]["status"] != "active":
            return []
        return ["flip", "stay"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if state.get("game_over"):
            return [], "game over"

        action_type = action.get("type")
        events: List[Dict] = []

        if state.get("phase") == "round_end":
            if action_type != "next_round":
                return [], "only next_round allowed"
            Flip7Game.start_new_round(state)
            events.append({"type": "flip7:next_round", "payload": {"round": state["round"]}})
            return events, None

        if state.get("phase") == "action_target":
            pending = state.get("pending_action")
            if not pending:
                return [], "no pending action"
            if pending.get("actor_id") != player_id:
                return [], "not your action"
            if action_type != "choose_target":
                return [], "choose_target required"
            card = pending.get("card") or {}
            pending_action = card.get("action")
            if pending_action == ACTION_FLIP_THREE:
                target_id = player_id
            else:
                target_id = action.get("target_player_id")
                if target_id not in state["players"]:
                    return [], "invalid target"
                eligible = _eligible_targets(state, pending_action)
                if target_id not in eligible:
                    return [], "target not eligible"

            if pending_action == ACTION_SECOND_CHANCE:
                state["players"][target_id]["tableau"].append(card)
                events.append(
                    {
                        "type": "flip7:second_chance_given",
                        "payload": {"player_id": player_id, "target_id": target_id},
                    }
                )
            elif pending_action == ACTION_FREEZE:
                _bank_player(state, target_id)
                state["players"][target_id]["status"] = "stayed"
                state["discard"].append(card)
                events.append(
                    {
                        "type": "flip7:freeze",
                        "payload": {"player_id": player_id, "target_id": target_id},
                    }
                )
            elif pending_action == ACTION_FLIP_THREE:
                state["discard"].append(card)
                draw_events, error, deferred_actions = _resolve_flip_three(state, target_id)
                events.extend(draw_events)
                if error:
                    return events, error
                for entry in deferred_actions:
                    _queue_action(state, entry)
                events.append(
                    {
                        "type": "flip7:flip_three",
                        "payload": {"player_id": player_id, "target_id": target_id},
                    }
                )
            else:
                return [], "unknown action card"

            state["pending_action"] = None
            if _round_should_end(state):
                reason = "flip7" if state.get("flip7_winner") else "all_done"
                _end_round(state, reason)
                events.append({"type": "flip7:round_end", "payload": {"reason": reason}})
                return events, None

            _ensure_current_turn(state)
            _advance_pending_action(state)
            return events, None

        if state.get("phase") != "playing":
            return [], "game not ready"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if state["players"][player_id]["status"] != "active":
            return [], "not active"

        if action_type == "stay":
            _bank_player(state, player_id)
            events.append({"type": "flip7:stay", "payload": {"player_id": player_id}})
            _ensure_current_turn(state)
            if _round_should_end(state):
                reason = "flip7" if state.get("flip7_winner") else "all_done"
                _end_round(state, reason)
                events.append({"type": "flip7:round_end", "payload": {"reason": reason}})
            return events, None

        if action_type == "flip":
            draw_events, busted, flip7_hit, error = _draw_card(state, player_id)
            events.extend(draw_events)
            if error:
                return events, error
            if busted:
                _ensure_current_turn(state)
            if _round_should_end(state):
                reason = "flip7" if state.get("flip7_winner") else "all_done"
                _end_round(state, reason)
                events.append({"type": "flip7:round_end", "payload": {"reason": reason}})
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "status": pdata.get("status"),
                    "score": pdata.get("score", 0),
                    "round_score": pdata.get("round_score"),
                    "flip7": pdata.get("flip7", False),
                    "has_second_chance": _has_second_chance(pdata),
                    "numbers_count": len(_unique_numbers(pdata)),
                    "tableau": [_card_view(card) for card in pdata.get("tableau", [])],
                }
            )

        pending_view = None
        pending = state.get("pending_action")
        if pending and isinstance(pending, dict):
            card = pending.get("card") or {}
            action_type = card.get("action")
            eligible_targets = _eligible_targets(state, action_type)
            if action_type == ACTION_FLIP_THREE:
                actor_id = pending.get("actor_id")
                if actor_id in state["players"]:
                    eligible_targets = [actor_id]
            pending_view = {
                "actor_id": pending.get("actor_id"),
                "action": action_type,
                "label": ACTION_LABELS.get(action_type, "Action"),
                "eligible_targets": eligible_targets,
            }

        return {
            "game_id": Flip7Game.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "current_turn": state.get("current_turn"),
            "deck_count": len(state.get("deck", [])),
            "discard_count": len(state.get("discard", [])),
            "pending_action": pending_view,
            "flip7_winner": state.get("flip7_winner"),
            "players": players_view,
            "legal_actions": Flip7Game.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": {"target_score": state["config"]["target_score"]},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state["players"]:
            return None
        if state.get("phase") == "round_end":
            return {"type": "next_round"}
        if state.get("phase") == "action_target":
            pending = state.get("pending_action")
            if pending and pending.get("actor_id") == bot_id:
                action_type = (pending.get("card") or {}).get("action")
                if action_type == ACTION_FLIP_THREE:
                    return {"type": "choose_target", "target_player_id": bot_id}
                eligible = _eligible_targets(state, action_type)
                if not eligible:
                    return None
                return {"type": "choose_target", "target_player_id": random.choice(eligible)}
            return None
        if state.get("phase") != "playing":
            return None
        if bot_id != state.get("current_turn"):
            return None
        pdata = state["players"][bot_id]
        if pdata.get("status") != "active":
            return None
        unique_count = len(_unique_numbers(pdata))
        if unique_count >= 5 and random.random() < 0.6:
            return {"type": "stay"}
        if random.random() < 0.2:
            return {"type": "stay"}
        return {"type": "flip"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
