import random
from typing import Dict, List, Optional, Tuple


CARD_SPECS = [
    ("cat_-8", "cat", -8),
    ("cat_-5", "cat", -5),
    ("cat_3", "cat", 3),
    ("cat_5", "cat", 5),
    ("cat_8", "cat", 8),
    ("cat_11", "cat", 11),
    ("cat_15", "cat", 15),
    ("rabbit_0", "rabbit", 0),
    ("big_dog", "big_dog", None),
    ("small_dog", "small_dog", None),
]

COLORS = ["red", "blue", "green", "purple", "orange"]


def _copy_card(card: Dict) -> Dict:
    return dict(card)


def _sorted_player_ids(state: Dict) -> List[str]:
    meta = state.get("player_meta", {})
    return sorted(state.get("players", {}).keys(), key=lambda pid: meta.get(pid, {}).get("seat", 0))


def _turn_order_from(state: Dict, start_player: Optional[str] = None) -> List[str]:
    order = list(state.get("turn_order", []))
    if not order:
        return []
    start = start_player or state.get("start_player")
    if start not in order:
        return order
    idx = order.index(start)
    return order[idx:] + order[:idx]


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


def _build_card_set(color: str) -> List[Dict]:
    cards = []
    for cid, kind, value in CARD_SPECS:
        cards.append(
            {
                "id": f"{color}_{cid}",
                "base_id": cid,
                "color": color,
                "kind": kind,
                "value": value,
            }
        )
    return cards


def _card_label(card: Optional[Dict]) -> str:
    if not card:
        return "-"
    kind = card.get("kind")
    value = card.get("value")
    if kind == "cat":
        return f"Cat {value:+d}"
    if kind == "rabbit":
        return "Rabbit 0"
    if kind == "big_dog":
        return "Big Dog"
    if kind == "small_dog":
        return "Small Dog"
    return str(card.get("id") or "-")


def _remove_card(cards: List[Dict], card_id: str) -> Optional[Dict]:
    for idx, card in enumerate(cards):
        if card.get("id") == card_id:
            return cards.pop(idx)
    return None


def _cat_score(cards: List[Dict]) -> int:
    return sum(int(card.get("value", 0)) for card in cards if card.get("kind") == "cat")


def _total_score(pdata: Dict) -> int:
    return _cat_score(pdata.get("won_cards", [])) + int(pdata.get("mice", 0))


def _public_card(card: Optional[Dict]) -> Optional[Dict]:
    if not card:
        return None
    result = _copy_card(card)
    result["label"] = _card_label(card)
    return result


def _setup_mouse_cards(player_count: int) -> Tuple[List[Dict], int]:
    if player_count == 3:
        values = [3, 6]
        bank = 21
    elif player_count == 4:
        values = [2, 4, 6]
        bank = 27
    else:
        values = [2, 3, 4, 6]
        bank = 33
    cards = [{"value": value, "mice": value, "active": True} for value in values]
    bank -= sum(values)
    return cards, bank


def _award_lowest_mouse_card(state: Dict, player_id: str) -> int:
    for mouse_card in sorted(state.get("mouse_cards", []), key=lambda item: int(item.get("value", 0))):
        reward = int(mouse_card.get("mice", 0))
        if reward > 0:
            mouse_card["mice"] = 0
            state["players"][player_id]["mice"] += reward
            return reward
    return 0


def _reveal_slot(state: Dict, index: int) -> Optional[Dict]:
    slots = state.get("table_slots", [])
    if 0 <= index < len(slots):
        slots[index]["face_up"] = True
        return slots[index]
    return None


def _reveal_next_face_down_slot(state: Dict) -> Optional[Dict]:
    for slot in state.get("table_slots", []):
        if not slot.get("face_up"):
            slot["face_up"] = True
            return slot
    return None


def _reveal_all_slots(state: Dict) -> None:
    for slot in state.get("table_slots", []):
        slot["face_up"] = True


def _begin_choose_card(state: Dict) -> None:
    state["round"] = int(state.get("round", 0)) + 1
    state["phase"] = "choose_card"
    state["choose_order"] = _turn_order_from(state)
    state["choose_index"] = 0
    state["current_turn"] = state["choose_order"][0] if state["choose_order"] else None
    state["active_players"] = []
    state["current_bid"] = 0
    state["current_bidder"] = None
    state["last_round_summary"] = None
    state["next_ready"] = []
    state["table_slots"] = []
    for pdata in state.get("players", {}).values():
        pdata["chosen_card_id"] = None
        pdata["round_bid"] = 0
        pdata["passed"] = False
    if len(state.get("turn_order", [])) == 3:
        dummy_deck = state.get("dummy_deck", [])
        if dummy_deck:
            card = dummy_deck.pop()
            state["table_slots"].append(
                {
                    "index": 0,
                    "source": "dummy",
                    "player_id": None,
                    "position": "cat_in_sack",
                    "card": card,
                    "face_up": False,
                    "resolution": None,
                }
            )


def _start_auction(state: Dict) -> None:
    player_count = len(state.get("turn_order", []))
    if player_count == 3:
        _reveal_slot(state, 0)
    else:
        _reveal_slot(state, 0)
    state["phase"] = "auction"
    state["active_players"] = list(state.get("turn_order", []))
    state["current_turn"] = state.get("start_player")
    state["current_bid"] = 0
    state["current_bidder"] = None


def _slot_position_for_index(state: Dict, index: int) -> str:
    if index == 0:
        return "cat_in_sack"
    mouse_cards = state.get("mouse_cards", [])
    mouse_idx = index - 1
    if 0 <= mouse_idx < len(mouse_cards):
        return f"mouse_{mouse_cards[mouse_idx].get('value')}"
    return f"slot_{index}"


def _all_players_ready(state: Dict) -> bool:
    return set(state.get("next_ready", [])) >= set(state.get("turn_order", []))


def _resolve_dogs(state: Dict) -> Tuple[List[Dict], List[Dict]]:
    slots = state.get("table_slots", [])
    cards = [slot.get("card") for slot in slots if slot.get("card")]
    dogs = [card for card in cards if card.get("kind") in ("big_dog", "small_dog")]
    cats = [card for card in cards if card.get("kind") == "cat"]
    removed: List[Dict] = []

    def slot_index(card: Dict) -> int:
        for slot in slots:
            if slot.get("card", {}).get("id") == card.get("id"):
                return int(slot.get("index", 0))
        return 0

    if len(dogs) >= 2:
        removed.extend(dogs)
    elif len(dogs) == 1:
        dog = dogs[0]
        removed.append(dog)
        target = None
        if dog.get("kind") == "big_dog" and cats:
            positive = [card for card in cats if int(card.get("value", 0)) > 0]
            if positive:
                target = max(positive, key=lambda card: (int(card.get("value", 0)), -slot_index(card)))
            else:
                target = min(cats, key=lambda card: (int(card.get("value", 0)), slot_index(card)))
        elif dog.get("kind") == "small_dog" and cats:
            negative = [card for card in cats if int(card.get("value", 0)) < 0]
            if negative:
                target = min(negative, key=lambda card: (int(card.get("value", 0)), slot_index(card)))
            else:
                target = min(cats, key=lambda card: (int(card.get("value", 0)), slot_index(card)))
        if target:
            removed.append(target)

    removed_ids = {card.get("id") for card in removed}
    remaining = [card for card in cards if card.get("id") not in removed_ids]
    for slot in slots:
        card = slot.get("card")
        if not card:
            continue
        if card.get("id") in removed_ids:
            slot["resolution"] = "removed"
        else:
            slot["resolution"] = "awarded"
    state.setdefault("removed_cards", []).extend([_copy_card(card) for card in removed])
    return remaining, removed


def _resolve_round_win(state: Dict, winner_id: str, bid: int) -> Dict:
    _reveal_all_slots(state)
    winner = state["players"][winner_id]
    winner["mice"] -= bid
    state["bank_mice"] = int(state.get("bank_mice", 0)) + bid
    remaining, removed = _resolve_dogs(state)
    won = [_copy_card(card) for card in remaining]
    winner["won_cards"].extend(won)
    for pdata in state.get("players", {}).values():
        pdata["round_bid"] = 0
        pdata["passed"] = False
    old_start = state.get("start_player")
    state["start_player"] = winner_id
    state["phase"] = "round_summary"
    state["current_turn"] = None
    state["active_players"] = []
    state["current_bid"] = 0
    state["current_bidder"] = None
    state["next_ready"] = []
    summary = {
        "result": "won",
        "round": state.get("round"),
        "winner": winner_id,
        "paid": bid,
        "won_cards": won,
        "removed_cards": [_copy_card(card) for card in removed],
        "old_start_player": old_start,
        "next_start_player": winner_id,
    }
    state["last_round_summary"] = summary
    _finalize_if_done(state)
    return summary


def _resolve_round_no_sale(state: Dict) -> Dict:
    _reveal_all_slots(state)
    removed = []
    for slot in state.get("table_slots", []):
        slot["resolution"] = "removed"
        if slot.get("card"):
            removed.append(_copy_card(slot["card"]))
    state.setdefault("removed_cards", []).extend(removed)
    for pdata in state.get("players", {}).values():
        pdata["round_bid"] = 0
        pdata["passed"] = False
    state["phase"] = "round_summary"
    state["current_turn"] = None
    state["active_players"] = []
    state["current_bid"] = 0
    state["current_bidder"] = None
    state["next_ready"] = []
    state["skip_refill"] = True
    summary = {
        "result": "no_sale",
        "round": state.get("round"),
        "removed_cards": removed,
        "next_start_player": state.get("start_player"),
    }
    state["last_round_summary"] = summary
    _finalize_if_done(state)
    return summary


def _finalize_if_done(state: Dict) -> None:
    if int(state.get("round", 0)) < 9:
        return
    scores = {}
    max_total: Optional[int] = None
    for pid, pdata in state.get("players", {}).items():
        cat_score = _cat_score(pdata.get("won_cards", []))
        total = cat_score + int(pdata.get("mice", 0))
        pdata["final_cat_score"] = cat_score
        pdata["final_score"] = total
        scores[pid] = {"cat_score": cat_score, "mice": int(pdata.get("mice", 0)), "score": total}
        max_total = total if max_total is None else max(max_total, total)
    tied = [pid for pid, row in scores.items() if row["score"] == max_total]
    if len(tied) > 1:
        max_cat = max(scores[pid]["cat_score"] for pid in tied)
        tied = [pid for pid in tied if scores[pid]["cat_score"] == max_cat]
    state["winner"] = tied
    state["final_results"] = {"scores": scores, "winners": tied}
    state["game_over"] = True
    state["phase"] = "game_over"


def _refill_mouse_cards(state: Dict) -> None:
    if state.get("skip_refill"):
        state["skip_refill"] = False
        return
    needed_total = sum(max(0, int(card.get("value", 0)) - int(card.get("mice", 0))) for card in state.get("mouse_cards", []))
    if int(state.get("bank_mice", 0)) >= needed_total:
        for card in state.get("mouse_cards", []):
            needed = max(0, int(card.get("value", 0)) - int(card.get("mice", 0)))
            card["mice"] = int(card.get("mice", 0)) + needed
            state["bank_mice"] = int(state.get("bank_mice", 0)) - needed
    else:
        for card in state.get("mouse_cards", []):
            card["mice"] = 0


class FelixGame:
    game_id = "felix"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        state_players: Dict[str, Dict] = {}
        removed_cards: List[Dict] = []
        for idx, pid in enumerate(player_ids):
            color = COLORS[idx]
            hand = _build_card_set(color)
            removed = hand.pop(random.randrange(len(hand)))
            removed_cards.append(_copy_card(removed))
            state_players[pid] = {
                "color": color,
                "hand": hand,
                "won_cards": [],
                "mice": 15,
                "round_bid": 0,
                "passed": False,
                "chosen_card_id": None,
            }
        mouse_cards, bank_mice = _setup_mouse_cards(len(player_ids))
        start_player = random.choice(player_ids) if player_ids else None
        dummy_deck: List[Dict] = []
        if len(player_ids) == 3:
            dummy_deck = _build_card_set("dummy")
            removed = dummy_deck.pop(random.randrange(len(dummy_deck)))
            removed_cards.append(_copy_card(removed))
            random.shuffle(dummy_deck)
        state = {
            "players": state_players,
            "turn_order": player_ids,
            "player_meta": player_meta,
            "start_player": start_player,
            "current_turn": None,
            "phase": "setup",
            "round": 0,
            "table_slots": [],
            "mouse_cards": mouse_cards,
            "bank_mice": bank_mice,
            "active_players": [],
            "current_bid": 0,
            "current_bidder": None,
            "choose_order": [],
            "choose_index": 0,
            "next_ready": [],
            "last_round_summary": None,
            "removed_cards": removed_cards,
            "dummy_deck": dummy_deck,
            "skip_refill": False,
            "winner": [],
            "final_results": None,
            "game_over": False,
        }
        if player_ids:
            _begin_choose_card(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return []
        phase = state.get("phase")
        if phase == "choose_card":
            return ["choose_card"] if player_id == state.get("current_turn") else []
        if phase == "auction":
            if player_id != state.get("current_turn") or player_id not in state.get("active_players", []):
                return []
            actions = ["pass"]
            if int(state["players"][player_id].get("mice", 0)) > int(state.get("current_bid", 0)):
                actions.insert(0, "bid")
            return actions
        if phase == "last_chance":
            if player_id != state.get("current_turn"):
                return []
            actions = ["pass"]
            if int(state["players"][player_id].get("mice", 0)) >= 1:
                actions.insert(0, "buy_for_one")
            return actions
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

        if phase == "choose_card":
            if action_type != "choose_card":
                return [], "invalid action"
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            card_id = action.get("card_id")
            card = _remove_card(state["players"][player_id]["hand"], card_id)
            if not card:
                return [], "card not in hand"
            slot_index = len(state.get("table_slots", []))
            state["players"][player_id]["chosen_card_id"] = card_id
            state["table_slots"].append(
                {
                    "index": slot_index,
                    "source": "player",
                    "player_id": player_id,
                    "position": _slot_position_for_index(state, slot_index),
                    "card": card,
                    "face_up": False,
                    "resolution": None,
                }
            )
            events.append({"type": "felix:choose_card", "payload": {"player_id": player_id}})
            state["choose_index"] = int(state.get("choose_index", 0)) + 1
            choose_order = state.get("choose_order", [])
            if state["choose_index"] >= len(choose_order):
                _start_auction(state)
                events.append({"type": "felix:auction_started", "payload": {"round": state.get("round")}})
            else:
                state["current_turn"] = choose_order[state["choose_index"]]
            return events, None

        if phase == "auction":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if player_id not in state.get("active_players", []):
                return [], "not active in auction"
            if action_type == "bid":
                amount = int(action.get("amount", 0))
                if amount <= int(state.get("current_bid", 0)):
                    return [], "bid must exceed current bid"
                if amount > int(state["players"][player_id].get("mice", 0)):
                    return [], "not enough mice"
                state["players"][player_id]["round_bid"] = amount
                state["current_bid"] = amount
                state["current_bidder"] = player_id
                state["current_turn"] = _next_player_id(state, player_id, state.get("active_players", []))
                events.append({"type": "felix:bid", "payload": {"player_id": player_id, "amount": amount}})
                return events, None
            if action_type != "pass":
                return [], "invalid action"
            reward = _award_lowest_mouse_card(state, player_id)
            state["players"][player_id]["round_bid"] = 0
            state["players"][player_id]["passed"] = True
            state["active_players"] = [pid for pid in state.get("active_players", []) if pid != player_id]
            revealed = _reveal_next_face_down_slot(state)
            events.append(
                {
                    "type": "felix:pass",
                    "payload": {"player_id": player_id, "reward": reward, "revealed_index": revealed.get("index") if revealed else None},
                }
            )
            active = state.get("active_players", [])
            if len(active) == 1:
                winner_id = active[0]
                if int(state.get("current_bid", 0)) == 0:
                    _reveal_all_slots(state)
                    state["phase"] = "last_chance"
                    state["current_turn"] = winner_id
                    events.append({"type": "felix:last_chance", "payload": {"player_id": winner_id}})
                    return events, None
                summary = _resolve_round_win(state, winner_id, int(state["players"][winner_id].get("round_bid", state.get("current_bid", 0))))
                events.append({"type": "felix:round_resolved", "payload": summary})
                return events, None
            state["current_turn"] = _next_player_id(state, player_id, active)
            return events, None

        if phase == "last_chance":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if action_type == "buy_for_one":
                if int(state["players"][player_id].get("mice", 0)) < 1:
                    return [], "not enough mice"
                state["players"][player_id]["round_bid"] = 1
                summary = _resolve_round_win(state, player_id, 1)
                events.append({"type": "felix:round_resolved", "payload": summary})
                return events, None
            if action_type == "pass":
                reward = _award_lowest_mouse_card(state, player_id)
                state["players"][player_id]["passed"] = True
                summary = _resolve_round_no_sale(state)
                summary["last_player_reward"] = reward
                events.append({"type": "felix:round_resolved", "payload": summary})
                return events, None
            return [], "invalid action"

        if phase == "round_summary":
            if action_type != "next_round":
                return [], "invalid action"
            ready = state.setdefault("next_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events.append({"type": "felix:next_round", "payload": {"player_id": player_id}})
            if _all_players_ready(state):
                _refill_mouse_cards(state)
                _begin_choose_card(state)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = _sorted_player_ids(state)
        players_view = []
        reveal_all = bool(state.get("game_over"))
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            is_self = pid == viewer_id
            won_cards = [_public_card(card) for card in pdata.get("won_cards", [])] if reveal_all else []
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "color": pdata.get("color"),
                    "hand_count": len(pdata.get("hand", [])),
                    "mice": int(pdata.get("mice", 0)) if (is_self or reveal_all) else None,
                    "mice_hidden": not (is_self or reveal_all),
                    "round_bid": int(pdata.get("round_bid", 0)),
                    "passed": bool(pdata.get("passed")),
                    "won_count": len(pdata.get("won_cards", [])),
                    "won_cards": won_cards,
                    "cat_score": _cat_score(pdata.get("won_cards", [])) if reveal_all else None,
                    "final_score": pdata.get("final_score"),
                    "final_cat_score": pdata.get("final_cat_score"),
                }
            )
        table_slots = []
        for slot in state.get("table_slots", []):
            visible = bool(slot.get("face_up") or state.get("game_over"))
            table_slots.append(
                {
                    "index": slot.get("index"),
                    "source": slot.get("source"),
                    "player_id": slot.get("player_id"),
                    "position": slot.get("position"),
                    "face_up": visible,
                    "card": _public_card(slot.get("card")) if visible else None,
                    "resolution": slot.get("resolution"),
                }
            )
        your_hand = []
        if viewer_id in state.get("players", {}):
            your_hand = [_public_card(card) for card in state["players"][viewer_id].get("hand", [])]
            your_hand.sort(key=lambda card: (str(card.get("kind")), int(card.get("value") or 0), str(card.get("id"))))
        return {
            "game_id": FelixGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "current_turn": state.get("current_turn"),
            "start_player": state.get("start_player"),
            "active_players": list(state.get("active_players", [])),
            "current_bid": int(state.get("current_bid", 0)),
            "current_bidder": state.get("current_bidder"),
            "mouse_cards": [dict(card) for card in state.get("mouse_cards", [])],
            "bank_mice": int(state.get("bank_mice", 0)),
            "table_slots": table_slots,
            "players": players_view,
            "your_hand": your_hand,
            "legal_actions": FelixGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "next_ready": list(state.get("next_ready", [])),
            "winner": state.get("winner", []),
            "final_results": state.get("final_results"),
            "game_over": state.get("game_over", False),
            "dummy_remaining": len(state.get("dummy_deck", [])),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        pdata = state["players"][bot_id]
        if phase == "choose_card" and bot_id == state.get("current_turn"):
            hand = list(pdata.get("hand", []))
            if not hand:
                return None
            chosen = random.choice(hand)
            return {"type": "choose_card", "card_id": chosen.get("id")}
        if phase == "round_summary" and bot_id not in state.get("next_ready", []):
            return {"type": "next_round"}
        if phase == "last_chance" and bot_id == state.get("current_turn"):
            return {"type": "buy_for_one"} if int(pdata.get("mice", 0)) >= 1 else {"type": "pass"}
        if phase != "auction" or bot_id != state.get("current_turn"):
            return None
        current_bid = int(state.get("current_bid", 0))
        budget = max(1, int(pdata.get("mice", 0)) // 3)
        if current_bid < budget:
            return {"type": "bid", "amount": current_bid + 1}
        return {"type": "pass"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

