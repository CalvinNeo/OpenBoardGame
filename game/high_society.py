import random
from typing import Dict, List, Optional, Tuple


MONEY_VALUES = [1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 20000, 25000]

STATUS_CARDS = [
    {"id": "luxury_1", "type": "luxury", "value": 1, "is_end_marker": False},
    {"id": "luxury_2", "type": "luxury", "value": 2, "is_end_marker": False},
    {"id": "luxury_3", "type": "luxury", "value": 3, "is_end_marker": False},
    {"id": "luxury_4", "type": "luxury", "value": 4, "is_end_marker": False},
    {"id": "luxury_5", "type": "luxury", "value": 5, "is_end_marker": False},
    {"id": "luxury_6", "type": "luxury", "value": 6, "is_end_marker": False},
    {"id": "luxury_7", "type": "luxury", "value": 7, "is_end_marker": False},
    {"id": "luxury_8", "type": "luxury", "value": 8, "is_end_marker": False},
    {"id": "luxury_9", "type": "luxury", "value": 9, "is_end_marker": False},
    {"id": "luxury_10", "type": "luxury", "value": 10, "is_end_marker": False},
    {"id": "prestige_1", "type": "prestige", "effect": "double", "is_end_marker": True},
    {"id": "prestige_2", "type": "prestige", "effect": "double", "is_end_marker": True},
    {"id": "prestige_3", "type": "prestige", "effect": "double", "is_end_marker": True},
    {"id": "faux_pas", "type": "disgrace", "effect": "discard_luxury", "is_end_marker": False},
    {"id": "passe", "type": "disgrace", "effect": "minus_5", "is_end_marker": False},
    {"id": "scandale", "type": "disgrace", "effect": "halve", "is_end_marker": True},
]


def _copy_card(card: Dict) -> Dict:
    return dict(card)


def _build_status_deck() -> List[Dict]:
    deck = [_copy_card(card) for card in STATUS_CARDS]
    random.shuffle(deck)
    return deck


def _sorted_player_ids(state: Dict, player_ids: Optional[List[str]] = None) -> List[str]:
    meta = state.get("player_meta", {})
    ids = list(player_ids) if player_ids is not None else list(meta.keys())
    return sorted(ids, key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _next_player_id(state: Dict, current_pid: str, candidates: Optional[List[str]] = None) -> Optional[str]:
    order = state.get("turn_order", [])
    allowed = set(candidates if candidates is not None else order)
    if not order or not allowed:
        return None
    start_idx = order.index(current_pid) if current_pid in order else -1
    for offset in range(1, len(order) + 1):
        pid = order[(start_idx + offset) % len(order)]
        if pid in allowed:
            return pid
    return None


def _money_total(values: List[int]) -> int:
    return sum(int(value) for value in values)


def _card_label(card: Optional[Dict]) -> str:
    if not card:
        return "-"
    cid = card.get("id")
    if card.get("type") == "luxury":
        return f"Luxury {card.get('value')}"
    if cid and cid.startswith("prestige"):
        return "Prestige x2"
    names = {"faux_pas": "Faux Pas", "passe": "Passe", "scandale": "Scandale"}
    return names.get(cid, cid or "-")


def _find_card(cards: List[Dict], card_id: str) -> Optional[Dict]:
    for card in cards:
        if card.get("id") == card_id:
            return card
    return None


def _remove_card(cards: List[Dict], card_id: str) -> Optional[Dict]:
    for idx, card in enumerate(cards):
        if card.get("id") == card_id:
            return cards.pop(idx)
    return None


def _score_status_cards(cards: List[Dict]) -> float:
    score = sum(int(card.get("value", 0)) for card in cards if card.get("type") == "luxury")
    if any(card.get("id") == "passe" for card in cards):
        score -= 5
    prestige_count = sum(1 for card in cards if card.get("type") == "prestige")
    score *= 2**prestige_count
    if any(card.get("id") == "scandale" for card in cards):
        score /= 2
    return score


def _highest_luxury_value(cards: List[Dict]) -> int:
    values = [int(card.get("value", 0)) for card in cards if card.get("type") == "luxury"]
    return max(values) if values else 0


def _reset_auction(state: Dict, phase: str) -> None:
    for pdata in state.get("players", {}).values():
        pdata["table_money"] = []
    state["phase"] = phase
    state["active_players"] = list(state.get("turn_order", []))
    state["current_turn"] = state.get("start_player")
    state["current_high_bid"] = 0
    state["current_high_bidder"] = None
    state["next_ready"] = []


def _begin_round_summary(state: Dict, summary: Dict) -> None:
    state["phase"] = "round_summary"
    state["current_turn"] = None
    state["active_players"] = []
    state["current_high_bid"] = 0
    state["current_high_bidder"] = None
    state["last_round_summary"] = summary
    state["next_ready"] = []
    state["current_status"] = None


def _reveal_next_status(state: Dict) -> None:
    state["round"] = int(state.get("round", 0)) + 1
    state["next_ready"] = []
    state["pending_summary"] = None
    for pdata in state.get("players", {}).values():
        pdata["table_money"] = []
    if not state.get("status_deck"):
        _finalize_game(state, unauctioned_card=None)
        return
    card = state["status_deck"].pop()
    state["current_status"] = card
    if card.get("is_end_marker"):
        state["end_marker_revealed_count"] = int(state.get("end_marker_revealed_count", 0)) + 1
    if int(state.get("end_marker_revealed_count", 0)) >= 4:
        _finalize_game(state, unauctioned_card=card)
        return
    if card.get("type") == "disgrace":
        _reset_auction(state, "disgrace_auction")
    else:
        _reset_auction(state, "normal_auction")


def _finalize_game(state: Dict, unauctioned_card: Optional[Dict]) -> None:
    money_totals: Dict[str, int] = {}
    scores: Dict[str, float] = {}
    highest_luxury: Dict[str, int] = {}
    for pid, pdata in state.get("players", {}).items():
        money_totals[pid] = _money_total(pdata.get("hand_money", []))
        scores[pid] = _score_status_cards(pdata.get("status_cards", []))
        highest_luxury[pid] = _highest_luxury_value(pdata.get("status_cards", []))
    min_money = min(money_totals.values()) if money_totals else 0
    eliminated = [pid for pid, total in money_totals.items() if total == min_money]
    contenders = [pid for pid in state.get("turn_order", []) if pid not in set(eliminated)]
    winners: List[str] = []
    if contenders:
        max_score = max(scores[pid] for pid in contenders)
        tied = [pid for pid in contenders if scores[pid] == max_score]
        if len(tied) > 1:
            max_money = max(money_totals[pid] for pid in tied)
            tied = [pid for pid in tied if money_totals[pid] == max_money]
        if len(tied) > 1:
            max_luxury = max(highest_luxury[pid] for pid in tied)
            tied = [pid for pid in tied if highest_luxury[pid] == max_luxury]
        winners = tied
    for pid, pdata in state.get("players", {}).items():
        pdata["final_money_total"] = money_totals.get(pid, 0)
        pdata["final_status_score"] = scores.get(pid, 0)
        pdata["eliminated"] = pid in eliminated
    state["final_results"] = {
        "money_totals": money_totals,
        "scores": scores,
        "highest_luxury": highest_luxury,
        "eliminated": eliminated,
        "winners": winners,
        "unauctioned_card": unauctioned_card,
    }
    state["winner"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None
    state["current_status"] = None


def _player_can_bid(pdata: Dict, current_high_bid: int) -> bool:
    table_total = _money_total(pdata.get("table_money", []))
    hand = list(pdata.get("hand_money", []))
    return any(table_total + value > current_high_bid for value in hand)


def _validate_bid(state: Dict, player_id: str, money_values: List[int]) -> Tuple[Optional[int], Optional[str]]:
    if player_id != state.get("current_turn"):
        return None, "not your turn"
    if player_id not in state.get("active_players", []):
        return None, "not active in auction"
    if not money_values:
        return None, "choose at least one money card"
    pdata = state["players"][player_id]
    hand = list(pdata.get("hand_money", []))
    for value in money_values:
        if value not in hand:
            return None, "money card not in hand"
        hand.remove(value)
    new_total = _money_total(pdata.get("table_money", [])) + _money_total(money_values)
    if new_total <= int(state.get("current_high_bid", 0)):
        return None, "bid must exceed current high bid"
    return new_total, None


def _apply_bid(state: Dict, player_id: str, money_values: List[int], new_total: int) -> None:
    pdata = state["players"][player_id]
    for value in money_values:
        pdata["hand_money"].remove(value)
        pdata["table_money"].append(value)
    state["current_high_bid"] = new_total
    state["current_high_bidder"] = player_id
    next_player = _next_player_id(state, player_id, state.get("active_players", []))
    state["current_turn"] = next_player


def _resolve_normal_auction(state: Dict, winner_id: str) -> Dict:
    winner = state["players"][winner_id]
    card = state.get("current_status")
    paid = list(winner.get("table_money", []))
    winner["spent_money_count"] = int(winner.get("spent_money_count", 0)) + len(paid)
    winner["table_money"] = []
    gained_card = _copy_card(card) if card else None
    discarded_luxury = None
    if gained_card:
        winner["status_cards"].append(gained_card)
        if winner.get("pending_faux_pas") and gained_card.get("type") == "luxury":
            discarded_luxury = _remove_card(winner["status_cards"], gained_card["id"])
            faux = _remove_card(winner["status_cards"], "faux_pas")
            if faux:
                state.setdefault("removed_status_cards", []).append(faux)
            if discarded_luxury:
                state.setdefault("removed_status_cards", []).append(discarded_luxury)
            winner["pending_faux_pas"] = False
    state["start_player"] = winner_id
    return {
        "result": "normal_win",
        "winner": winner_id,
        "card": gained_card,
        "paid_count": len(paid),
        "paid_total": _money_total(paid),
        "discarded_luxury": discarded_luxury,
    }


def _apply_disgrace(state: Dict, taker_id: str, card: Dict) -> Tuple[Optional[Dict], bool]:
    taker = state["players"][taker_id]
    taker["status_cards"].append(_copy_card(card))
    if card.get("id") != "faux_pas":
        return None, False
    luxuries = [c for c in taker.get("status_cards", []) if c.get("type") == "luxury"]
    if luxuries:
        return None, True
    taker["pending_faux_pas"] = True
    return None, False


def _resolve_disgrace_pass(state: Dict, taker_id: str) -> Tuple[Dict, bool]:
    card = state.get("current_status")
    taker = state["players"][taker_id]
    returned = list(taker.get("table_money", []))
    taker["hand_money"].extend(returned)
    taker["table_money"] = []
    discarded_total = 0
    discarded_count = 0
    for pid, pdata in state.get("players", {}).items():
        if pid == taker_id:
            continue
        table = list(pdata.get("table_money", []))
        discarded_total += _money_total(table)
        discarded_count += len(table)
        pdata["spent_money_count"] = int(pdata.get("spent_money_count", 0)) + len(table)
        pdata["table_money"] = []
    needs_choice = False
    if card:
        _, needs_choice = _apply_disgrace(state, taker_id, card)
    state["start_player"] = taker_id
    summary = {
        "result": "disgrace_taken",
        "taker": taker_id,
        "card": _copy_card(card) if card else None,
        "returned_count": len(returned),
        "returned_total": _money_total(returned),
        "discarded_count": discarded_count,
        "discarded_total": discarded_total,
    }
    return summary, needs_choice


class HighSocietyGame:
    game_id = "high_society"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        state_players = {
            pid: {
                "hand_money": list(MONEY_VALUES),
                "table_money": [],
                "status_cards": [],
                "pending_faux_pas": False,
                "spent_money_count": 0,
                "eliminated": False,
            }
            for pid in player_ids
        }
        start_player = random.choice(player_ids) if player_ids else None
        state = {
            "players": state_players,
            "turn_order": player_ids,
            "player_meta": player_meta,
            "status_deck": _build_status_deck(),
            "current_status": None,
            "start_player": start_player,
            "current_turn": None,
            "phase": "setup",
            "round": 0,
            "active_players": [],
            "current_high_bid": 0,
            "current_high_bidder": None,
            "end_marker_revealed_count": 0,
            "next_ready": [],
            "last_round_summary": None,
            "pending_summary": None,
            "removed_status_cards": [],
            "winner": [],
            "game_over": False,
        }
        if player_ids:
            _reveal_next_status(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase in ("normal_auction", "disgrace_auction"):
            if player_id != state.get("current_turn"):
                return []
            actions = ["pass"]
            if _player_can_bid(state["players"][player_id], int(state.get("current_high_bid", 0))):
                actions.insert(0, "bid")
            return actions
        if phase == "choose_faux_pas":
            return ["choose_faux_pas_discard"] if player_id == state.get("current_turn") else []
        if phase == "round_summary":
            if player_id not in state.get("next_ready", []):
                return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        action_type = action.get("type")
        phase = state.get("phase")
        events: List[Dict] = []

        if phase in ("normal_auction", "disgrace_auction"):
            if action_type == "bid":
                money_values = action.get("money_values") or []
                new_total, error = _validate_bid(state, player_id, money_values)
                if error:
                    return [], error
                _apply_bid(state, player_id, money_values, int(new_total))
                events.append(
                    {
                        "type": "high_society:bid",
                        "payload": {"player_id": player_id, "count": len(money_values), "total": new_total},
                    }
                )
                return events, None

            if action_type != "pass":
                return [], "invalid action"
            if player_id != state.get("current_turn"):
                return [], "not your turn"

            if phase == "normal_auction":
                pdata = state["players"][player_id]
                returned = list(pdata.get("table_money", []))
                pdata["hand_money"].extend(returned)
                pdata["table_money"] = []
                state["active_players"] = [pid for pid in state.get("active_players", []) if pid != player_id]
                events.append({"type": "high_society:pass", "payload": {"player_id": player_id}})
                if len(state.get("active_players", [])) == 1:
                    winner_id = state["active_players"][0]
                    summary = _resolve_normal_auction(state, winner_id)
                    _begin_round_summary(state, summary)
                    return events, None
                state["current_turn"] = _next_player_id(state, player_id, state.get("active_players", []))
                return events, None

            summary, needs_choice = _resolve_disgrace_pass(state, player_id)
            events.append({"type": "high_society:disgrace_taken", "payload": {"player_id": player_id}})
            if needs_choice:
                state["phase"] = "choose_faux_pas"
                state["current_turn"] = player_id
                state["pending_summary"] = summary
            else:
                _begin_round_summary(state, summary)
            return events, None

        if phase == "choose_faux_pas":
            if action_type != "choose_faux_pas_discard":
                return [], "invalid action"
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            card_id = action.get("card_id")
            pdata = state["players"][player_id]
            card = _find_card(pdata.get("status_cards", []), card_id)
            if not card or card.get("type") != "luxury":
                return [], "choose one of your luxury cards"
            discarded = _remove_card(pdata["status_cards"], card_id)
            faux = _remove_card(pdata["status_cards"], "faux_pas")
            if discarded:
                state.setdefault("removed_status_cards", []).append(discarded)
            if faux:
                state.setdefault("removed_status_cards", []).append(faux)
            summary = state.get("pending_summary") or {}
            summary["discarded_luxury"] = discarded
            state["pending_summary"] = None
            _begin_round_summary(state, summary)
            events.append(
                {
                    "type": "high_society:faux_pas_discard",
                    "payload": {"player_id": player_id, "card_id": card_id},
                }
            )
            return events, None

        if phase == "round_summary":
            if action_type != "next_round":
                return [], "invalid action"
            ready = state.setdefault("next_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events.append({"type": "high_society:next_round", "payload": {"player_id": player_id}})
            if set(ready) >= set(state.get("turn_order", [])):
                _reveal_next_status(state)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = _sorted_player_ids(state)
        players_view = []
        reveal_money = bool(state.get("game_over"))
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            status_cards = [_copy_card(card) for card in pdata.get("status_cards", [])]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": len(pdata.get("hand_money", [])),
                    "hand_money": list(pdata.get("hand_money", [])) if reveal_money else None,
                    "table_money": list(pdata.get("table_money", [])),
                    "table_total": _money_total(pdata.get("table_money", [])),
                    "status_cards": status_cards,
                    "pending_faux_pas": bool(pdata.get("pending_faux_pas")),
                    "eliminated": bool(pdata.get("eliminated")),
                    "final_money_total": pdata.get("final_money_total"),
                    "final_status_score": pdata.get("final_status_score"),
                }
            )
        your_hand = []
        if viewer_id in state.get("players", {}):
            your_hand = sorted(state["players"][viewer_id].get("hand_money", []))
        return {
            "game_id": HighSocietyGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "current_turn": state.get("current_turn"),
            "start_player": state.get("start_player"),
            "current_status": _copy_card(state.get("current_status")) if state.get("current_status") else None,
            "current_high_bid": state.get("current_high_bid", 0),
            "current_high_bidder": state.get("current_high_bidder"),
            "active_players": list(state.get("active_players", [])),
            "status_deck_count": len(state.get("status_deck", [])),
            "end_marker_revealed_count": state.get("end_marker_revealed_count", 0),
            "your_hand_money": your_hand,
            "players": players_view,
            "legal_actions": HighSocietyGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "next_ready": list(state.get("next_ready", [])),
            "winner": state.get("winner", []),
            "final_results": state.get("final_results"),
            "game_over": state.get("game_over", False),
            "card_labels": {
                card.get("id"): _card_label(card)
                for card in STATUS_CARDS
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        pdata = state["players"][bot_id]
        if phase == "round_summary":
            if bot_id not in state.get("next_ready", []):
                return {"type": "next_round"}
            return None
        if phase == "choose_faux_pas" and bot_id == state.get("current_turn"):
            luxuries = [c for c in pdata.get("status_cards", []) if c.get("type") == "luxury"]
            if not luxuries:
                return None
            chosen = min(luxuries, key=lambda c: int(c.get("value", 0)))
            return {"type": "choose_faux_pas_discard", "card_id": chosen.get("id")}
        if phase not in ("normal_auction", "disgrace_auction") or bot_id != state.get("current_turn"):
            return None
        hand = sorted(pdata.get("hand_money", []))
        current_high = int(state.get("current_high_bid", 0))
        table_total = _money_total(pdata.get("table_money", []))
        card = state.get("current_status") or {}
        max_budget = max(0, _money_total(hand) // 4)
        if card.get("type") == "disgrace":
            max_budget = max(0, _money_total(hand) // 5)
        for value in hand:
            if table_total + value > current_high and table_total + value <= max_budget:
                return {"type": "bid", "money_values": [value]}
        return {"type": "pass"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

