import random
from typing import Dict, List, Optional, Tuple


DEFAULT_CONFIG = {
    "seed": None,
}

FULL_CARD_PAIRS: List[Tuple[int, int]] = [
    (low, high)
    for low in range(1, 10)
    for high in range(low + 1, 11)
]

ROUND_SETTINGS = {
    2: {"variant": "duel", "rounds": 2, "hand_size": 11},
    3: {"variant": "base", "rounds": 3, "hand_size": 12},
    4: {"variant": "base", "rounds": 4, "hand_size": 11},
    5: {"variant": "base", "rounds": 5, "hand_size": 9},
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _copy_card(card: Dict) -> Dict:
    return {
        "id": card["id"],
        "values": list(card["values"]),
        "face_up": int(card["face_up"]),
    }


def _copy_cards(cards: List[Dict]) -> List[Dict]:
    return [_copy_card(card) for card in cards]


def _card_id(low: int, high: int) -> str:
    return f"{low}-{high}"


def _make_card(pair: Tuple[int, int], rng: random.Random) -> Dict:
    low, high = pair
    return {
        "id": _card_id(low, high),
        "values": [low, high],
        "face_up": rng.randrange(2),
    }


def _card_value(card: Dict) -> int:
    return int(card["values"][int(card["face_up"])])


def _other_value(card: Dict) -> int:
    return int(card["values"][1 - int(card["face_up"])])


def _card_view(card: Dict) -> Dict:
    face_up = int(card["face_up"])
    return {
        "id": card["id"],
        "values": list(card["values"]),
        "face_up": "a" if face_up == 0 else "b",
        "current": _card_value(card),
        "back": _other_value(card),
    }


def _player_order(state: Dict) -> List[str]:
    return list(state.get("turn_order", []))


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name") or player_id


def _next_player_id(state: Dict, current_player_id: Optional[str]) -> Optional[str]:
    order = _player_order(state)
    if not order:
        return None
    if current_player_id not in order:
        return order[0]
    index = order.index(current_player_id)
    return order[(index + 1) % len(order)]


def _round_settings(player_count: int) -> Dict:
    if player_count not in ROUND_SETTINGS:
        raise ValueError("Scout supports 2-5 players")
    return ROUND_SETTINGS[player_count]


def _filtered_pairs(player_count: int) -> List[Tuple[int, int]]:
    if player_count == 2:
        return [pair for pair in FULL_CARD_PAIRS if pair != (9, 10)]
    if player_count == 3:
        return [pair for pair in FULL_CARD_PAIRS if 10 not in pair]
    if player_count == 4:
        return [pair for pair in FULL_CARD_PAIRS if pair != (9, 10)]
    return list(FULL_CARD_PAIRS)


def _build_round_decks(player_count: int, rng: random.Random) -> List[List[Dict]]:
    settings = _round_settings(player_count)
    round_count = int(settings["rounds"])
    pair_pool = _filtered_pairs(player_count)

    if player_count == 2:
        pairs = list(pair_pool)
        rng.shuffle(pairs)
        cards = [_make_card(pair, rng) for pair in pairs]
        return [cards[:22], cards[22:44]]

    decks: List[List[Dict]] = []
    for _ in range(round_count):
        pairs = list(pair_pool)
        rng.shuffle(pairs)
        decks.append([_make_card(pair, rng) for pair in pairs])
    return decks


def _deal_pending_hands(deck: List[Dict], order: List[str], hand_size: int) -> Dict[str, List[Dict]]:
    pending = {pid: [] for pid in order}
    cursor = 0
    for _ in range(hand_size):
        for pid in order:
            pending[pid].append(_copy_card(deck[cursor]))
            cursor += 1
    return pending


def _flip_pending_hand(cards: List[Dict]) -> List[Dict]:
    flipped: List[Dict] = []
    for card in reversed(cards):
        next_card = _copy_card(card)
        next_card["face_up"] = 1 - int(next_card["face_up"])
        flipped.append(next_card)
    return flipped


def _face_to_index(face: str) -> Optional[int]:
    if face == "a":
        return 0
    if face == "b":
        return 1
    return None


def _classify_cards(cards: List[Dict]) -> Optional[Dict]:
    if not cards:
        return None
    values = [_card_value(card) for card in cards]
    if len(values) == 1:
        return {
            "combo_type": "single",
            "length": 1,
            "rank_value": values[0],
            "values": values,
        }
    if all(value == values[0] for value in values):
        return {
            "combo_type": "set",
            "length": len(values),
            "rank_value": values[0],
            "values": values,
        }
    diffs = [values[index + 1] - values[index] for index in range(len(values) - 1)]
    if all(diff == 1 for diff in diffs) or all(diff == -1 for diff in diffs):
        return {
            "combo_type": "run",
            "length": len(values),
            "rank_value": max(values),
            "values": values,
        }
    return None


def _beats(candidate: Dict, active_set: Optional[Dict]) -> bool:
    if not active_set:
        return True
    candidate_length = int(candidate["length"])
    active_length = int(active_set["length"])
    if candidate_length != active_length:
        return candidate_length > active_length
    if candidate["combo_type"] != active_set["combo_type"]:
        if candidate["combo_type"] == "set" and active_set["combo_type"] == "run":
            return True
        if candidate["combo_type"] == "run" and active_set["combo_type"] == "set":
            return False
    return int(candidate["rank_value"]) > int(active_set["rank_value"])


def _combo_sort_key(combo: Dict) -> Tuple[int, int, int]:
    combo_type = combo.get("combo_type")
    type_order = 0
    if combo_type == "run":
        type_order = 1
    elif combo_type == "set":
        type_order = 2
    return (int(combo.get("length", 0)), type_order, int(combo.get("rank_value", 0)))


def _build_active_set(owner_player_id: str, cards: List[Dict]) -> Dict:
    combo = _classify_cards(cards)
    if not combo:
        raise ValueError("invalid active set")
    return {
        "owner_player_id": owner_player_id,
        "cards": _copy_cards(cards),
        "combo_type": combo["combo_type"],
        "length": combo["length"],
        "rank_value": combo["rank_value"],
        "values": list(combo["values"]),
    }


def _enumerate_show_moves(hand: List[Dict], active_set: Optional[Dict]) -> List[Dict]:
    moves: List[Dict] = []
    for start_index in range(len(hand)):
        for end_index in range(start_index, len(hand)):
            cards = hand[start_index : end_index + 1]
            combo = _classify_cards(cards)
            if not combo:
                continue
            if not _beats(combo, active_set):
                continue
            moves.append(
                {
                    "start_index": start_index,
                    "end_index": end_index,
                    "combo": combo,
                    "cards": _copy_cards(cards),
                    "remaining_count": len(hand) - len(cards),
                }
            )
    return moves


def _best_show_move(hand: List[Dict], active_set: Optional[Dict]) -> Optional[Dict]:
    moves = _enumerate_show_moves(hand, active_set)
    if not moves:
        return None
    moves.sort(
        key=lambda move: (
            1 if move["remaining_count"] == 0 else 0,
            _combo_sort_key(move["combo"]),
            -move["start_index"],
        ),
        reverse=True,
    )
    return moves[0]


def _scout_sides(active_set: Optional[Dict]) -> List[str]:
    if not active_set or not active_set.get("cards"):
        return []
    if len(active_set["cards"]) == 1:
        return ["left"]
    return ["left", "right"]


def _simulate_scout(hand: List[Dict], active_set: Dict, take_side: str, insert_index: int, face_index: int) -> Tuple[List[Dict], Optional[Dict]]:
    active_cards = _copy_cards(active_set["cards"])
    if take_side == "left":
        taken = active_cards.pop(0)
    else:
        taken = active_cards.pop()
    taken["face_up"] = face_index
    new_hand = _copy_cards(hand)
    new_hand.insert(insert_index, taken)
    if not active_cards:
        return new_hand, None
    next_active = _build_active_set(active_set["owner_player_id"], active_cards)
    return new_hand, next_active


def _enumerate_scout_options(hand: List[Dict], active_set: Optional[Dict]) -> List[Dict]:
    if not active_set or not active_set.get("cards"):
        return []
    options: List[Dict] = []
    for take_side in _scout_sides(active_set):
        for insert_index in range(len(hand) + 1):
            for face_index, face_label in ((0, "a"), (1, "b")):
                next_hand, next_active = _simulate_scout(hand, active_set, take_side, insert_index, face_index)
                options.append(
                    {
                        "take_side": take_side,
                        "insert_index": insert_index,
                        "insert_face": face_label,
                        "next_hand": next_hand,
                        "next_active_set": next_active,
                    }
                )
    return options


def _has_scout_and_show_move(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    for option in _enumerate_scout_options(pdata.get("hand", []), state.get("active_set")):
        if _best_show_move(option["next_hand"], option["next_active_set"]):
            return True
    return False


def _player_can_show(state: Dict, player_id: str) -> bool:
    pdata = state.get("players", {}).get(player_id)
    if not pdata:
        return False
    return bool(_best_show_move(pdata.get("hand", []), state.get("active_set")))


def _round_end_reason_label(reason: str) -> str:
    if reason == "empty_hand":
        return "Showed all cards"
    if reason == "returned_to_owner":
        return "Turn returned to active owner"
    if reason == "no_tokens_no_show":
        return "No Show and no Scout tokens left"
    return reason


def _clear_pending_scout_and_show(state: Dict) -> None:
    state["pending_scout_and_show_player"] = None


def _finish_round(state: Dict, winner_player_id: str, reason: str) -> None:
    _clear_pending_scout_and_show(state)
    variant = state["variant"]
    round_summary_players: List[Dict] = []
    for pid in _player_order(state):
        pdata = state["players"][pid]
        bonus = int(pdata.get("scout_tokens_left", 0)) if variant == "duel" else int(pdata.get("scout_points", 0))
        hand_penalty = 0 if pid == winner_player_id else len(pdata.get("hand", []))
        round_points = int(pdata.get("captured_count", 0)) + bonus - hand_penalty
        pdata["score"] = int(pdata.get("score", 0)) + round_points
        round_summary_players.append(
            {
                "player_id": pid,
                "name": _player_name(state, pid),
                "captured_count": int(pdata.get("captured_count", 0)),
                "scout_points": int(pdata.get("scout_points", 0)),
                "scout_tokens_left": int(pdata.get("scout_tokens_left", 0)),
                "hand_count": len(pdata.get("hand", [])),
                "hand_penalty": hand_penalty,
                "round_points": round_points,
                "total_score": int(pdata.get("score", 0)),
                "winner": pid == winner_player_id,
            }
        )

    state["last_round_summary"] = {
        "round": int(state["round"]),
        "winner": winner_player_id,
        "winner_name": _player_name(state, winner_player_id),
        "reason": reason,
        "reason_label": _round_end_reason_label(reason),
        "variant": variant,
        "players": round_summary_players,
    }

    if int(state["round"]) >= int(state["total_rounds"]):
        scores = {pid: int(state["players"][pid].get("score", 0)) for pid in _player_order(state)}
        best_score = max(scores.values()) if scores else 0
        winners = [pid for pid in _player_order(state) if scores.get(pid, 0) == best_score]
        state["winner"] = winners
        state["game_over"] = True
        state["phase"] = "game_over"
        state["current_turn"] = None
        return

    next_start_player = _next_player_id(state, state.get("start_player"))
    _setup_round(state, int(state["round"]) + 1, next_start_player)


def _all_players_ready(state: Dict) -> bool:
    return all(state["players"][pid].get("hand_ready") for pid in _player_order(state))


def _setup_round(state: Dict, round_number: int, start_player_id: Optional[str]) -> None:
    order = _player_order(state)
    deck = state["round_decks"][round_number - 1]
    hand_size = int(state["hand_size"])
    pending_hands = _deal_pending_hands(deck, order, hand_size)

    if round_number == 1:
        start_player_id = None
        for pid in order:
            if any(card["id"] == "1-2" for card in pending_hands[pid]):
                start_player_id = pid
                break
    if start_player_id not in order:
        start_player_id = order[0] if order else None

    state["round"] = round_number
    state["phase"] = "choose_orientation"
    state["start_player"] = start_player_id
    state["current_turn"] = None
    state["active_set"] = None
    state["center_scout_tokens"] = 0
    state["pending_scout_and_show_player"] = None

    for pid in order:
        pdata = state["players"][pid]
        pdata["pending_hand"] = _copy_cards(pending_hands[pid])
        pdata["hand"] = []
        pdata["hand_ready"] = False
        pdata["captured_count"] = 0
        pdata["scout_points"] = 0
        pdata["scout_tokens_left"] = 3 if state["variant"] == "duel" else 0
        pdata["scout_and_show_available"] = state["variant"] == "base"


def _ready_hand_options(pending_hand: List[Dict]) -> Dict:
    keep = _copy_cards(pending_hand)
    flipped = _flip_pending_hand(pending_hand)
    return {
        "keep": [_card_view(card) for card in keep],
        "flip": [_card_view(card) for card in flipped],
    }


def _apply_ready_hand(state: Dict, player_id: str, flip: bool) -> None:
    pdata = state["players"][player_id]
    pending_hand = pdata.get("pending_hand") or []
    hand = _flip_pending_hand(pending_hand) if flip else _copy_cards(pending_hand)
    pdata["hand"] = hand
    pdata["hand_ready"] = True
    if _all_players_ready(state):
        state["phase"] = "playing"
        state["current_turn"] = state.get("start_player")


def _advance_after_base_action(state: Dict, acting_player_id: str) -> None:
    next_player_id = _next_player_id(state, acting_player_id)
    state["current_turn"] = next_player_id
    active_set = state.get("active_set")
    if active_set and next_player_id == active_set.get("owner_player_id"):
        _finish_round(state, next_player_id, "returned_to_owner")


def _validate_show(state: Dict, player_id: str, start_index: int, end_index: int, hand_override: Optional[List[Dict]] = None, active_override: Optional[Dict] = None) -> Tuple[Optional[Dict], Optional[str]]:
    hand = hand_override if hand_override is not None else state["players"][player_id].get("hand", [])
    active_set = active_override if active_override is not None else state.get("active_set")
    if not isinstance(start_index, int) or not isinstance(end_index, int):
        return None, "invalid selection"
    if start_index < 0 or end_index < start_index or end_index >= len(hand):
        return None, "invalid hand range"
    cards = hand[start_index : end_index + 1]
    combo = _classify_cards(cards)
    if not combo:
        return None, "selected cards do not form a legal combo"
    if not _beats(combo, active_set):
        return None, "selected cards do not beat the active set"
    return {
        "cards": _copy_cards(cards),
        "combo": combo,
    }, None


def _apply_show(state: Dict, player_id: str, start_index: int, end_index: int) -> Tuple[List[Dict], Optional[str]]:
    validated, error = _validate_show(state, player_id, start_index, end_index)
    if error:
        return [], error
    pdata = state["players"][player_id]
    if state.get("pending_scout_and_show_player") == player_id:
        _clear_pending_scout_and_show(state)
    previous_active = state.get("active_set")
    if previous_active:
        pdata["captured_count"] = int(pdata.get("captured_count", 0)) + len(previous_active["cards"])
    del pdata["hand"][start_index : end_index + 1]
    state["active_set"] = _build_active_set(player_id, validated["cards"])

    events = [
        {
            "type": "scout:show",
            "payload": {
                "player_id": player_id,
                "length": validated["combo"]["length"],
                "combo_type": validated["combo"]["combo_type"],
                "rank_value": validated["combo"]["rank_value"],
            },
        }
    ]

    if not pdata["hand"]:
        _finish_round(state, player_id, "empty_hand")
        return events, None

    if state["variant"] == "duel":
        state["current_turn"] = _next_player_id(state, player_id)
    else:
        _advance_after_base_action(state, player_id)
    return events, None


def _validate_scout_action(state: Dict, player_id: str, take_side: str, insert_index: int, insert_face: str) -> Tuple[int, Optional[str]]:
    active_set = state.get("active_set")
    if not active_set or not active_set.get("cards"):
        return -1, "no active set to scout from"
    if active_set.get("owner_player_id") == player_id:
        return -1, "cannot scout your own active set"
    if take_side not in _scout_sides(active_set):
        return -1, "invalid scout side"
    pdata = state["players"][player_id]
    if not isinstance(insert_index, int) or insert_index < 0 or insert_index > len(pdata.get("hand", [])):
        return -1, "invalid insert position"
    face_index = _face_to_index(insert_face)
    if face_index is None:
        return -1, "invalid insert face"
    if state["variant"] == "duel" and int(pdata.get("scout_tokens_left", 0)) <= 0:
        return -1, "no Scout tokens left"
    return face_index, None


def _perform_scout_mutation(state: Dict, player_id: str, take_side: str, insert_index: int, insert_face: str, face_index: int) -> List[Dict]:
    pdata = state["players"][player_id]
    active_set = state["active_set"]
    next_hand, next_active = _simulate_scout(pdata["hand"], active_set, take_side, insert_index, face_index)
    pdata["hand"] = next_hand
    state["active_set"] = next_active

    if state["variant"] == "duel":
        pdata["scout_tokens_left"] = int(pdata.get("scout_tokens_left", 0)) - 1
        state["center_scout_tokens"] = int(state.get("center_scout_tokens", 0)) + 1
    else:
        owner_player_id = active_set["owner_player_id"]
        owner_data = state["players"][owner_player_id]
        owner_data["scout_points"] = int(owner_data.get("scout_points", 0)) + 1

    return [
        {
            "type": "scout:scout",
            "payload": {
                "player_id": player_id,
                "take_side": take_side,
                "insert_index": insert_index,
                "insert_face": insert_face,
            },
        }
    ]


def _apply_scout(state: Dict, player_id: str, take_side: str, insert_index: int, insert_face: str) -> Tuple[List[Dict], Optional[str]]:
    face_index, error = _validate_scout_action(state, player_id, take_side, insert_index, insert_face)
    if error:
        return [], error

    pdata = state["players"][player_id]
    events = _perform_scout_mutation(state, player_id, take_side, insert_index, insert_face, face_index)

    if state["variant"] == "duel":
        if not _player_can_show(state, player_id) and int(pdata.get("scout_tokens_left", 0)) <= 0:
            _finish_round(state, player_id, "no_tokens_no_show")
        else:
            state["current_turn"] = player_id
    else:
        _advance_after_base_action(state, player_id)
    return events, None


def _apply_scout_and_show(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
    if state["variant"] != "base":
        return [], "Scout & Show is not available in 2-player games"
    pdata = state["players"][player_id]
    if not pdata.get("scout_and_show_available"):
        return [], "Scout & Show already used this round"

    take_side = action.get("take_side")
    insert_index = action.get("insert_index")
    insert_face = action.get("insert_face")
    face_index, error = _validate_scout_action(state, player_id, take_side, insert_index, insert_face)
    if error:
        return [], error

    scout_events = _perform_scout_mutation(state, player_id, take_side, insert_index, insert_face, face_index)
    pdata["scout_and_show_available"] = False
    state["current_turn"] = player_id
    state["pending_scout_and_show_player"] = player_id

    events = list(scout_events)
    events.append(
        {
            "type": "scout:scout_and_show",
            "payload": {
                "player_id": player_id,
                "take_side": take_side,
                "insert_index": insert_index,
                "insert_face": insert_face,
                "keeps_turn": True,
            },
        }
    )
    return events, None


def _apply_finish_scout_and_show(state: Dict, player_id: str) -> Tuple[List[Dict], Optional[str]]:
    if state["variant"] != "base":
        return [], "Scout & Show is not available in 2-player games"
    if state.get("pending_scout_and_show_player") != player_id:
        return [], "no pending Scout & Show turn"

    _clear_pending_scout_and_show(state)
    _advance_after_base_action(state, player_id)
    return [{"type": "scout:finish_scout_and_show", "payload": {"player_id": player_id}}], None


def _base_bot_ready_action(state: Dict, player_id: str) -> Dict:
    pending_hand = state["players"][player_id].get("pending_hand", [])
    keep_move = _best_show_move(_copy_cards(pending_hand), None)
    flip_move = _best_show_move(_flip_pending_hand(pending_hand), None)
    keep_key = _combo_sort_key(keep_move["combo"]) if keep_move else (0, 0, 0)
    flip_key = _combo_sort_key(flip_move["combo"]) if flip_move else (0, 0, 0)
    return {"type": "ready_hand", "flip": flip_key > keep_key}


def _best_scout_action_for_bot(state: Dict, player_id: str) -> Optional[Dict]:
    pdata = state["players"][player_id]
    active_set = state.get("active_set")
    best_option = None
    best_key = None
    for option in _enumerate_scout_options(pdata.get("hand", []), active_set):
        next_show = _best_show_move(option["next_hand"], option["next_active_set"])
        next_key = _combo_sort_key(next_show["combo"]) if next_show else (0, 0, 0)
        key = (
            1 if next_show and next_show["remaining_count"] == 0 else 0,
            1 if next_show else 0,
            next_key,
            -len(option["next_hand"]),
        )
        if best_key is None or key > best_key:
            best_key = key
            best_option = option
    if not best_option:
        return None
    return {
        "type": "scout",
        "take_side": best_option["take_side"],
        "insert_index": best_option["insert_index"],
        "insert_face": best_option["insert_face"],
    }


def _best_scout_and_show_for_bot(state: Dict, player_id: str) -> Optional[Dict]:
    pdata = state["players"][player_id]
    active_set = state.get("active_set")
    best_action = None
    best_key = None
    for option in _enumerate_scout_options(pdata.get("hand", []), active_set):
        show_move = _best_show_move(option["next_hand"], option["next_active_set"])
        if not show_move:
            continue
        key = (
            1 if show_move["remaining_count"] == 0 else 0,
            _combo_sort_key(show_move["combo"]),
            -show_move["start_index"],
        )
        if best_key is None or key > best_key:
            best_key = key
            best_action = {
                "type": "scout_and_show",
                "take_side": option["take_side"],
                "insert_index": option["insert_index"],
                "insert_face": option["insert_face"],
            }
    return best_action


class ScoutGame:
    game_id = "scout"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [player["player_id"] for player in sorted(players, key=lambda item: item.get("seat", 0))]
        settings = _round_settings(len(player_ids))
        rng = random.Random(cfg.get("seed"))

        state = {
            "config": cfg,
            "variant": settings["variant"],
            "round": 1,
            "total_rounds": settings["rounds"],
            "hand_size": settings["hand_size"],
            "turn_order": player_ids,
            "player_meta": {player["player_id"]: player for player in players},
            "round_decks": _build_round_decks(len(player_ids), rng),
            "players": {},
            "phase": "choose_orientation",
            "start_player": None,
            "current_turn": None,
            "active_set": None,
            "center_scout_tokens": 0,
            "pending_scout_and_show_player": None,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }

        for pid in player_ids:
            state["players"][pid] = {
                "score": 0,
                "pending_hand": [],
                "hand": [],
                "hand_ready": False,
                "captured_count": 0,
                "scout_points": 0,
                "scout_tokens_left": 0,
                "scout_and_show_available": False,
            }

        _setup_round(state, 1, None)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state.get("players", {}).get(player_id)
        if not pdata:
            return []

        phase = state.get("phase")
        if phase == "choose_orientation":
            return [] if pdata.get("hand_ready") else ["ready_hand"]
        if phase != "playing":
            return []
        if player_id != state.get("current_turn"):
            return []

        if state.get("pending_scout_and_show_player"):
            if state.get("pending_scout_and_show_player") != player_id:
                return []
            legal: List[str] = []
            if _best_show_move(pdata.get("hand", []), state.get("active_set")):
                legal.append("show")
            legal.append("finish_scout_and_show")
            return legal

        legal: List[str] = []
        if _best_show_move(pdata.get("hand", []), state.get("active_set")):
            legal.append("show")
        active_set = state.get("active_set")
        if active_set and active_set.get("owner_player_id") != player_id:
            if state["variant"] == "duel":
                if int(pdata.get("scout_tokens_left", 0)) > 0:
                    legal.append("scout")
            else:
                legal.append("scout")
                if pdata.get("scout_and_show_available"):
                    legal.append("scout_and_show")
        return legal

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"

        action_type = action.get("type")
        phase = state.get("phase")
        if phase == "choose_orientation":
            if action_type != "ready_hand":
                return [], "must choose initial hand orientation"
            if state["players"][player_id].get("hand_ready"):
                return [], "hand already ready"
            flip = bool(action.get("flip", False))
            _apply_ready_hand(state, player_id, flip)
            return [{"type": "scout:ready_hand", "payload": {"player_id": player_id, "flip": flip}}], None

        if phase != "playing":
            return [], "invalid phase"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        legal_actions = ScoutGame.get_legal_actions(state, player_id)
        if action_type not in legal_actions:
            return [], "invalid action"

        if action_type == "show":
            return _apply_show(state, player_id, action.get("start_index"), action.get("end_index"))
        if action_type == "scout":
            return _apply_scout(
                state,
                player_id,
                action.get("take_side"),
                action.get("insert_index"),
                action.get("insert_face"),
            )
        if action_type == "scout_and_show":
            return _apply_scout_and_show(state, player_id, action)
        if action_type == "finish_scout_and_show":
            return _apply_finish_scout_and_show(state, player_id)

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view: List[Dict] = []
        for pid in _player_order(state):
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "score": int(pdata.get("score", 0)),
                    "hand_count": len(pdata.get("hand", [])) if pdata.get("hand_ready") else len(pdata.get("pending_hand", [])),
                    "captured_count": int(pdata.get("captured_count", 0)),
                    "scout_points": int(pdata.get("scout_points", 0)),
                    "scout_tokens_left": int(pdata.get("scout_tokens_left", 0)),
                    "scout_and_show_available": bool(pdata.get("scout_and_show_available")),
                    "hand_ready": bool(pdata.get("hand_ready")),
                }
            )

        your_data = state["players"].get(viewer_id, {})
        your_hand = [_card_view(card) for card in your_data.get("hand", [])] if your_data.get("hand_ready") else []
        initial_options = None
        if state.get("phase") == "choose_orientation" and viewer_id in state.get("players", {}) and not your_data.get("hand_ready"):
            initial_options = _ready_hand_options(your_data.get("pending_hand", []))

        active_set = state.get("active_set")
        active_set_view = None
        if active_set:
            active_set_view = {
                "owner_player_id": active_set["owner_player_id"],
                "owner_name": _player_name(state, active_set["owner_player_id"]),
                "combo_type": active_set["combo_type"],
                "length": active_set["length"],
                "rank_value": active_set["rank_value"],
                "values": list(active_set.get("values", [])),
                "cards": [_card_view(card) for card in active_set.get("cards", [])],
            }

        return {
            "game_id": ScoutGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "variant": state.get("variant"),
            "round": int(state.get("round", 0)),
            "total_rounds": int(state.get("total_rounds", 0)),
            "current_turn": state.get("current_turn"),
            "start_player": state.get("start_player"),
            "active_set": active_set_view,
            "center_scout_tokens": int(state.get("center_scout_tokens", 0)),
            "pending_scout_and_show_player": state.get("pending_scout_and_show_player"),
            "your_scout_and_show_pending": state.get("pending_scout_and_show_player") == viewer_id,
            "players": players_view,
            "your_hand": your_hand,
            "initial_hand_options": initial_options,
            "legal_actions": ScoutGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": bool(state.get("game_over", False)),
            "hand_size": int(state.get("hand_size", 0)),
            "config": {"seed": state.get("config", {}).get("seed")},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        phase = state.get("phase")
        if phase == "choose_orientation":
            if state["players"][bot_id].get("hand_ready"):
                return None
            return _base_bot_ready_action(state, bot_id)

        if phase != "playing" or bot_id != state.get("current_turn"):
            return None

        pdata = state["players"][bot_id]
        active_set = state.get("active_set")
        show_move = _best_show_move(pdata.get("hand", []), active_set)

        if state.get("pending_scout_and_show_player") == bot_id:
            if show_move:
                return {"type": "show", "start_index": show_move["start_index"], "end_index": show_move["end_index"]}
            return {"type": "finish_scout_and_show"}

        if state["variant"] == "base" and pdata.get("scout_and_show_available"):
            scout_and_show_action = _best_scout_and_show_for_bot(state, bot_id)
            if scout_and_show_action:
                if show_move and show_move["remaining_count"] == 0:
                    return {"type": "show", "start_index": show_move["start_index"], "end_index": show_move["end_index"]}
                if not show_move:
                    return scout_and_show_action
                next_hand, next_active = _simulate_scout(
                    pdata["hand"],
                    active_set,
                    scout_and_show_action["take_side"],
                    scout_and_show_action["insert_index"],
                    _face_to_index(scout_and_show_action["insert_face"]),
                )
                next_show_move = _best_show_move(next_hand, next_active)
                if next_show_move and _combo_sort_key(next_show_move["combo"]) > _combo_sort_key(show_move["combo"]):
                    return scout_and_show_action

        if show_move:
            return {"type": "show", "start_index": show_move["start_index"], "end_index": show_move["end_index"]}

        scout_action = _best_scout_action_for_bot(state, bot_id)
        if scout_action:
            return scout_action
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
