import random
import time
from typing import Dict, List, Optional, Tuple

CARDS_PER_PLAYER = 10
ROW_COUNT = 4
ROW_LIMIT = 5
TARGET_SCORE = 66

DEFAULT_CONFIG = {
    "selection_timeout_sec": 30,
    "row_choice_timeout_sec": 15,
}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _bullheads_for_value(value: int) -> int:
    if value == 55:
        return 7
    if value % 11 == 0:
        return 5
    if value % 10 == 0:
        return 3
    if value % 5 == 0:
        return 2
    return 1


def _build_deck() -> List[Dict]:
    return [
        {"value": value, "bulls": _bullheads_for_value(value)}
        for value in range(1, 105)
    ]


def _row_bullheads(cards: List[Dict]) -> int:
    return sum(int(card.get("bulls", 0)) for card in cards)


def _sort_hand(hand: List[Dict]) -> None:
    hand.sort(key=lambda card: int(card.get("value", 0)))


def _player_order(state: Dict) -> List[str]:
    meta = state.get("player_meta", {})
    return sorted(meta.keys(), key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _active_players(state: Dict) -> List[str]:
    return [pid for pid, pdata in state.get("players", {}).items() if pdata.get("hand")]


def _turn_participants(state: Dict) -> List[str]:
    participants = []
    for pid, pdata in state.get("players", {}).items():
        if pdata.get("hand") or pdata.get("selected_card") is not None:
            participants.append(pid)
    return participants


def _all_selected(state: Dict) -> bool:
    for pid in _turn_participants(state):
        if state["players"][pid].get("selected_card") is None:
            return False
    return True


def _clear_selections(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["selected_card"] = None


def _mark_row_taken(state: Dict, player_id: str, row_index: int, cards: List[Dict], penalty: int) -> None:
    taken = state.get("row_taken_this_turn")
    if not isinstance(taken, dict):
        taken = {}
    taken[player_id] = {
        "row_index": int(row_index),
        "cards": [dict(card) for card in cards],
        "penalty": int(penalty),
    }
    state["row_taken_this_turn"] = taken


def _record_placement(
    state: Dict,
    player_id: str,
    card: Dict,
    row_index: int,
    took_row: bool = False,
    penalty: int = 0,
    taken_cards: Optional[List[Dict]] = None,
) -> None:
    placements = state.get("turn_placements")
    if not isinstance(placements, list):
        placements = []
    entry = {
        "player_id": player_id,
        "card": dict(card) if isinstance(card, dict) else {},
        "row_index": int(row_index),
        "took_row": bool(took_row),
    }
    if took_row:
        entry["penalty"] = int(penalty)
        entry["taken_cards"] = [
            dict(tcard) for tcard in (taken_cards or []) if isinstance(tcard, dict)
        ]
    placements.append(entry)
    state["turn_placements"] = placements


def _summary_ack_map(state: Dict) -> Dict[str, bool]:
    ack = state.get("summary_ack")
    if not isinstance(ack, dict):
        ack = {}
    return ack


def _all_summary_acknowledged(state: Dict) -> bool:
    ack = _summary_ack_map(state)
    for pid in state.get("players", {}).keys():
        if not ack.get(pid):
            return False
    return True


def _resume_after_summary(state: Dict) -> None:
    pending = state.get("summary_pending")
    pending_type = pending.get("type") if isinstance(pending, dict) else "next_turn"
    state["summary_pending"] = None
    state["summary_ack"] = {}

    if pending_type == "game_over":
        state["game_over"] = True
        state["phase"] = "game_over"
        _assign_winners(state)
        return

    if pending_type == "new_round":
        _start_new_round(state)
        return

    state["phase"] = "selection"
    state["pending_index"] = 0
    state["pending_plays"] = []
    state["waiting_for"] = None
    state["pending_timeout"] = None
    if _active_players(state):
        state["turn"] = int(state.get("turn", 1)) + 1
        _schedule_timeout(state, "selection")
        return

    if any(int(pdata.get("score", 0)) >= TARGET_SCORE for pdata in state.get("players", {}).values()):
        state["game_over"] = True
        state["phase"] = "game_over"
        _assign_winners(state)
    else:
        _start_new_round(state)


def _timeout_ms(state: Dict, timeout_type: str) -> int:
    cfg = state.get("config", {})
    key = "selection_timeout_sec" if timeout_type == "selection" else "row_choice_timeout_sec"
    raw = cfg.get(key, 0)
    try:
        timeout_sec = float(raw)
    except (TypeError, ValueError):
        timeout_sec = 0
    if timeout_sec <= 0:
        return 0
    return int(timeout_sec * 1000)


def _schedule_timeout(state: Dict, timeout_type: str, player_id: Optional[str] = None) -> None:
    timeout_ms = _timeout_ms(state, timeout_type)
    if timeout_ms <= 0:
        state["pending_timeout"] = None
        return
    state["pending_timeout"] = {
        "type": timeout_type,
        "at_ms": _now_ms() + timeout_ms,
        "player_id": player_id,
    }


def _deal_round(state: Dict) -> None:
    deck = _build_deck()
    random.shuffle(deck)
    for pid in _player_order(state):
        hand = [deck.pop() for _ in range(CARDS_PER_PLAYER)]
        _sort_hand(hand)
        state["players"][pid]["hand"] = hand
        state["players"][pid]["selected_card"] = None
    state["rows"] = [[deck.pop()] for _ in range(ROW_COUNT)]
    state["deck"] = deck
    state["turn"] = 1
    state["phase"] = "selection"
    state["pending_plays"] = []
    state["pending_index"] = 0
    state["waiting_for"] = None
    state["last_reveal_order"] = None
    state["row_taken_this_turn"] = {}
    state["turn_placements"] = []
    state["summary_ack"] = {}
    state["summary_pending"] = None
    _schedule_timeout(state, "selection")


def _start_new_round(state: Dict) -> None:
    state["round"] = int(state.get("round", 1)) + 1
    _deal_round(state)


def _start_selection_phase(state: Dict) -> None:
    state["phase"] = "selection"
    state["pending_plays"] = []
    state["pending_index"] = 0
    state["waiting_for"] = None
    state["summary_ack"] = {}
    state["summary_pending"] = None
    _clear_selections(state)
    _schedule_timeout(state, "selection")


def _assign_reveal_order(state: Dict) -> None:
    plays: List[Dict] = []
    for pid, pdata in state.get("players", {}).items():
        card = pdata.get("selected_card")
        if card:
            plays.append({"player_id": pid, "card": card})
    plays.sort(key=lambda entry: int(entry["card"]["value"]))
    state["pending_plays"] = plays
    state["pending_index"] = 0
    state["last_reveal_order"] = [
        {"player_id": entry["player_id"], "card": dict(entry["card"])} for entry in plays
    ]
    _clear_selections(state)


def _choose_best_row(state: Dict, card: Dict) -> Optional[int]:
    best_index = None
    best_diff = None
    for idx, row in enumerate(state.get("rows", [])):
        if not row:
            continue
        last_value = int(row[-1].get("value", 0))
        card_value = int(card.get("value", 0))
        if last_value < card_value:
            diff = card_value - last_value
            if best_diff is None or diff < best_diff:
                best_diff = diff
                best_index = idx
    return best_index


def _place_card(state: Dict, player_id: str, card: Dict, events: List[Dict]) -> bool:
    target_index = _choose_best_row(state, card)
    if target_index is None:
        state["waiting_for"] = {"player_id": player_id, "card": card}
        state["phase"] = "row_choice"
        _schedule_timeout(state, "row_choice", player_id)
        return False

    row = state["rows"][target_index]
    if len(row) >= ROW_LIMIT:
        taken_cards = [dict(card) for card in row]
        penalty = _row_bullheads(row)
        state["players"][player_id]["score"] += penalty
        row[:] = [card]
        _mark_row_taken(state, player_id, target_index, taken_cards, penalty)
        _record_placement(
            state, player_id, card, target_index, took_row=True, penalty=penalty, taken_cards=taken_cards
        )
        events.append(
            {
                "type": "six_nimmt:take_row",
                "payload": {"player_id": player_id, "row_index": target_index, "penalty": penalty},
            }
        )
        return True

    row.append(card)
    _record_placement(state, player_id, card, target_index)
    events.append(
        {
            "type": "six_nimmt:place",
            "payload": {"player_id": player_id, "row_index": target_index, "card": card},
        }
    )
    return True


def _continue_placement(state: Dict, events: List[Dict]) -> None:
    plays = state.get("pending_plays", [])
    index = int(state.get("pending_index", 0))
    while index < len(plays):
        play = plays[index]
        player_id = play["player_id"]
        card = play["card"]
        if not _place_card(state, player_id, card, events):
            state["pending_index"] = index
            return
        index += 1
    state["pending_index"] = index
    state["pending_plays"] = []
    state["waiting_for"] = None
    _finish_turn(state, events)


def _finish_turn(state: Dict, events: List[Dict]) -> None:
    round_number = int(state.get("round", 1))
    turn_number = int(state.get("turn", 1))
    placements = state.get("turn_placements")
    summary_placements = []
    if isinstance(placements, list):
        for entry in placements:
            if not isinstance(entry, dict):
                continue
            summary_entry = {
                "player_id": entry.get("player_id"),
                "card": dict(entry.get("card", {})) if isinstance(entry.get("card"), dict) else {},
                "row_index": entry.get("row_index"),
                "took_row": bool(entry.get("took_row")),
            }
            if entry.get("took_row"):
                summary_entry["penalty"] = int(entry.get("penalty", 0))
                taken_cards = entry.get("taken_cards", [])
                summary_entry["taken_cards"] = [
                    dict(card) for card in taken_cards if isinstance(card, dict)
                ]
            summary_placements.append(summary_entry)
    state["last_turn_summary"] = {
        "round": round_number,
        "turn": turn_number,
        "placements": summary_placements,
    }
    state["turn_placements"] = []
    last_taken = state.get("row_taken_this_turn")
    if isinstance(last_taken, dict):
        state["row_taken_last_turn"] = {
            pid: {
                "row_index": entry.get("row_index")
                if isinstance(entry, dict) and entry.get("row_index") is not None
                else None,
                "cards": [dict(card) for card in entry.get("cards", [])]
                if isinstance(entry, dict)
                else [],
                "penalty": int(entry.get("penalty", 0)) if isinstance(entry, dict) else 0,
            }
            for pid, entry in last_taken.items()
        }
    else:
        state["row_taken_last_turn"] = {}
    state["row_taken_this_turn"] = {}
    state["phase"] = "turn_summary"
    state["pending_index"] = 0
    state["pending_plays"] = []
    state["waiting_for"] = None
    state["pending_timeout"] = None
    state["summary_ack"] = {}

    if _active_players(state):
        pending_type = "next_turn"
    elif any(int(pdata.get("score", 0)) >= TARGET_SCORE for pdata in state.get("players", {}).values()):
        pending_type = "game_over"
    else:
        pending_type = "new_round"
    state["summary_pending"] = {"type": pending_type}


def _assign_winners(state: Dict) -> None:
    scores = {pid: int(pdata.get("score", 0)) for pid, pdata in state.get("players", {}).items()}
    if not scores:
        state["winners"] = []
        return
    min_score = min(scores.values())
    winners = [pid for pid, score in scores.items() if score == min_score]
    ordered = _player_order(state)
    state["winners"] = [pid for pid in ordered if pid in winners]


def _apply_row_choice(state: Dict, player_id: str, row_index: int, card: Dict, events: List[Dict]) -> None:
    row = state["rows"][row_index]
    taken_cards = [dict(card) for card in row]
    penalty = _row_bullheads(row)
    state["players"][player_id]["score"] += penalty
    row[:] = [card]
    _mark_row_taken(state, player_id, row_index, taken_cards, penalty)
    _record_placement(
        state, player_id, card, row_index, took_row=True, penalty=penalty, taken_cards=taken_cards
    )
    events.append(
        {
            "type": "six_nimmt:take_row",
            "payload": {"player_id": player_id, "row_index": row_index, "penalty": penalty},
        }
    )


def _advance_pending_play(state: Dict) -> None:
    try:
        index = int(state.get("pending_index", 0))
    except (TypeError, ValueError):
        index = 0
    if index < len(state.get("pending_plays", [])):
        state["pending_index"] = index + 1


def _auto_select_missing(state: Dict, events: List[Dict]) -> None:
    for pid in _active_players(state):
        pdata = state["players"][pid]
        if pdata.get("selected_card") is not None:
            continue
        hand = pdata.get("hand", [])
        if not hand:
            continue
        card = random.choice(hand)
        hand.remove(card)
        pdata["selected_card"] = card
        events.append({"type": "six_nimmt:auto_select", "payload": {"player_id": pid, "card": card}})


def _auto_pick_row(state: Dict, player_id: str, card: Dict, events: List[Dict]) -> None:
    best_index = None
    best_penalty = None
    for idx, row in enumerate(state.get("rows", [])):
        penalty = _row_bullheads(row)
        if best_penalty is None or penalty < best_penalty:
            best_penalty = penalty
            best_index = idx
    if best_index is None:
        return
    _apply_row_choice(state, player_id, best_index, card, events)


class SixNimmtGame:
    game_id = "six_nimmt"
    min_players = 2
    max_players = 10

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_meta = {p["player_id"]: p for p in players}
        players_state = {}
        for pid in player_meta.keys():
            players_state[pid] = {"hand": [], "score": 0, "selected_card": None}
        state = {
            "players": players_state,
            "player_meta": player_meta,
            "turn_order": _player_order({"player_meta": player_meta}),
            "rows": [],
            "deck": [],
            "round": 1,
            "turn": 1,
            "phase": "selection",
            "pending_plays": [],
            "pending_index": 0,
            "waiting_for": None,
            "last_reveal_order": None,
            "config": cfg,
            "pending_timeout": None,
            "row_taken_last_turn": {},
            "row_taken_this_turn": {},
            "turn_placements": [],
            "last_turn_summary": None,
            "summary_ack": {},
            "summary_pending": None,
            "winners": [],
            "game_over": False,
        }
        _deal_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        pdata = state["players"][player_id]
        if phase == "selection":
            if pdata.get("hand") and pdata.get("selected_card") is None:
                return ["select_card"]
            return []
        if phase == "row_choice":
            waiting = state.get("waiting_for")
            if isinstance(waiting, dict) and waiting.get("player_id") == player_id:
                return ["choose_row"]
        if phase == "turn_summary":
            return ["ack_turn_summary"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "select_card":
            if state.get("phase") != "selection":
                return [], "not in selection phase"
            pdata = state["players"][player_id]
            if pdata.get("selected_card") is not None:
                return [], "already selected"
            try:
                value = int(action.get("value"))
            except (TypeError, ValueError):
                return [], "invalid card"
            hand = pdata.get("hand", [])
            card = next((c for c in hand if int(c.get("value", 0)) == value), None)
            if not card:
                return [], "card not in hand"
            hand.remove(card)
            pdata["selected_card"] = card
            events.append({"type": "six_nimmt:select", "payload": {"player_id": player_id, "card": card}})
            if _all_selected(state):
                state["pending_timeout"] = None
                _assign_reveal_order(state)
                state["phase"] = "placement"
                _continue_placement(state, events)
            return events, None

        if action_type == "choose_row":
            if state.get("phase") != "row_choice":
                return [], "not waiting for row choice"
            waiting = state.get("waiting_for")
            if not isinstance(waiting, dict) or waiting.get("player_id") != player_id:
                return [], "not your row choice"
            try:
                row_index = int(action.get("row_index"))
            except (TypeError, ValueError):
                return [], "invalid row"
            if row_index < 0 or row_index >= ROW_COUNT:
                return [], "invalid row"
            card = waiting.get("card")
            if not isinstance(card, dict):
                return [], "invalid card"
            _apply_row_choice(state, player_id, row_index, card, events)
            _advance_pending_play(state)
            state["waiting_for"] = None
            state["pending_timeout"] = None
            state["phase"] = "placement"
            _continue_placement(state, events)
            return events, None

        if action_type == "ack_turn_summary":
            if state.get("phase") != "turn_summary":
                return [], "not in summary phase"
            ack = _summary_ack_map(state)
            if not ack.get(player_id):
                ack[player_id] = True
                state["summary_ack"] = ack
            if _all_summary_acknowledged(state):
                _resume_after_summary(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def resolve_timeout(state: Dict, now_ms: int) -> Optional[List[Dict]]:
        pending = state.get("pending_timeout")
        if not isinstance(pending, dict):
            return None
        try:
            at_ms = int(pending.get("at_ms", 0))
        except (TypeError, ValueError):
            at_ms = 0
        if at_ms <= 0 or now_ms < at_ms:
            return None
        timeout_type = pending.get("type")
        events: List[Dict] = []
        if timeout_type == "selection" and state.get("phase") == "selection":
            _auto_select_missing(state, events)
            state["pending_timeout"] = None
            if _all_selected(state):
                _assign_reveal_order(state)
                state["phase"] = "placement"
                _continue_placement(state, events)
            else:
                _schedule_timeout(state, "selection")
            return events if events else None
        if timeout_type == "row_choice" and state.get("phase") == "row_choice":
            waiting = state.get("waiting_for")
            player_id = None
            card = None
            if isinstance(waiting, dict):
                player_id = waiting.get("player_id")
                card = waiting.get("card")
            if isinstance(player_id, str) and isinstance(card, dict):
                _auto_pick_row(state, player_id, card, events)
                _advance_pending_play(state)
                state["waiting_for"] = None
                state["pending_timeout"] = None
                state["phase"] = "placement"
                _continue_placement(state, events)
                return events if events else None
        state["pending_timeout"] = None
        return None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        meta = state.get("player_meta", {})
        last_taken = state.get("row_taken_last_turn")
        if not isinstance(last_taken, dict):
            last_taken = {}
        for pid in _player_order(state):
            pdata = state["players"][pid]
            info = meta.get(pid, {})
            taken_entry = last_taken.get(pid)
            took_last_row = isinstance(taken_entry, dict)
            taken_cards = []
            if took_last_row:
                taken_cards = [
                    dict(card) for card in taken_entry.get("cards", []) if isinstance(card, dict)
                ]
            players_view.append(
                {
                    "player_id": pid,
                    "name": info.get("name"),
                    "seat": info.get("seat"),
                    "is_bot": info.get("is_bot"),
                    "score": pdata.get("score", 0),
                    "hand_count": len(pdata.get("hand", [])),
                    "selected": pdata.get("selected_card") is not None,
                    "took_last_row": took_last_row,
                    "took_last_row_cards": taken_cards,
                }
            )

        rows_view = []
        for idx, row in enumerate(state.get("rows", [])):
            rows_view.append(
                {
                    "id": idx,
                    "cards": [dict(card) for card in row],
                    "bulls_total": _row_bullheads(row),
                }
            )

        your_hand = []
        selected_card = None
        pdata = state.get("players", {}).get(viewer_id)
        if pdata:
            your_hand = [dict(card) for card in pdata.get("hand", [])]
            selected_card = pdata.get("selected_card")

        reveal_order = state.get("last_reveal_order") or []
        reveal_view = []
        if isinstance(reveal_order, list):
            for entry in reveal_order:
                if not isinstance(entry, dict):
                    continue
                pid = entry.get("player_id")
                card = entry.get("card")
                if pid in meta and isinstance(card, dict):
                    reveal_view.append({"player_id": pid, "name": meta[pid].get("name"), "card": dict(card)})

        waiting = state.get("waiting_for")
        waiting_view = None
        if isinstance(waiting, dict):
            pid = waiting.get("player_id")
            card = waiting.get("card")
            if pid in meta and isinstance(card, dict):
                waiting_view = {"player_id": pid, "name": meta[pid].get("name"), "card": dict(card)}

        winners = state.get("winners") or []
        winner_names = [meta.get(pid, {}).get("name") for pid in winners if pid in meta]
        summary_ack = list(_summary_ack_map(state).keys())

        summary_view = None
        summary = state.get("last_turn_summary")
        if isinstance(summary, dict):
            placements = summary.get("placements")
            view_placements = []
            if isinstance(placements, list):
                for entry in placements:
                    if not isinstance(entry, dict):
                        continue
                    pid = entry.get("player_id")
                    card = entry.get("card")
                    row_index = entry.get("row_index")
                    placement_view = {
                        "player_id": pid,
                        "name": meta.get(pid, {}).get("name") if pid in meta else None,
                        "card": dict(card) if isinstance(card, dict) else None,
                        "row_index": int(row_index) if row_index is not None else None,
                        "took_row": bool(entry.get("took_row")),
                    }
                    if entry.get("took_row"):
                        placement_view["penalty"] = int(entry.get("penalty", 0))
                        taken_cards = entry.get("taken_cards")
                        placement_view["taken_cards"] = [
                            dict(card) for card in taken_cards if isinstance(card, dict)
                        ] if isinstance(taken_cards, list) else []
                    view_placements.append(placement_view)
            summary_view = {
                "round": summary.get("round"),
                "turn": summary.get("turn"),
                "placements": view_placements,
            }

        return {
            "game_id": SixNimmtGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "turn": state.get("turn"),
            "rows": rows_view,
            "hand": your_hand,
            "selected_card": dict(selected_card) if isinstance(selected_card, dict) else None,
            "players": players_view,
            "reveal_order": reveal_view,
            "waiting_for": waiting_view,
            "pending_timeout": state.get("pending_timeout"),
            "legal_actions": SixNimmtGame.get_legal_actions(state, viewer_id),
            "winners": winners,
            "winner_names": winner_names,
            "last_turn_summary": summary_view,
            "summary_ack": summary_ack,
            "game_over": state.get("game_over", False),
            "server_time_ms": _now_ms(),
            "config": {
                "selection_timeout_sec": state.get("config", {}).get("selection_timeout_sec"),
                "row_choice_timeout_sec": state.get("config", {}).get("row_choice_timeout_sec"),
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        pdata = state["players"][bot_id]
        if phase == "selection":
            if pdata.get("selected_card") is not None:
                return None
            hand = pdata.get("hand", [])
            if not hand:
                return None
            card = random.choice(hand)
            return {"type": "select_card", "value": card.get("value")}
        if phase == "row_choice":
            waiting = state.get("waiting_for")
            if isinstance(waiting, dict) and waiting.get("player_id") == bot_id:
                best_index = None
                best_penalty = None
                for idx, row in enumerate(state.get("rows", [])):
                    penalty = _row_bullheads(row)
                    if best_penalty is None or penalty < best_penalty:
                        best_penalty = penalty
                        best_index = idx
                if best_index is not None:
                    return {"type": "choose_row", "row_index": best_index}
        if phase == "turn_summary":
            ack = state.get("summary_ack")
            if isinstance(ack, dict) and ack.get(bot_id):
                return None
            return {"type": "ack_turn_summary"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
