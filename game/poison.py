import random
import secrets
from collections import Counter
from typing import Dict, Iterable, List, Optional, Tuple


POTION_COLORS = ("red", "blue", "purple")
POTION_VALUE_COUNTS = {1: 3, 2: 3, 4: 2, 5: 3, 7: 3}
POISON_COUNT = 8
CAULDRON_COUNT = 3
CAULDRON_LIMIT = 13
TOTAL_CARD_COUNT = 50


def _copy_card(card: Dict) -> Dict:
    return {
        "id": card["id"],
        "kind": card["kind"],
        "color": card["color"],
        "value": int(card["value"]),
    }


def _build_deck() -> List[Dict]:
    cards: List[Dict] = []
    for color in POTION_COLORS:
        for value, count in POTION_VALUE_COUNTS.items():
            for copy_number in range(1, count + 1):
                cards.append(
                    {
                        "id": f"poison-{color}-{value}-{copy_number:02d}",
                        "kind": "potion",
                        "color": color,
                        "value": value,
                    }
                )
    for copy_number in range(1, POISON_COUNT + 1):
        cards.append(
            {
                "id": f"poison-toxic-4-{copy_number:02d}",
                "kind": "poison",
                "color": "poison",
                "value": 4,
            }
        )
    return cards


EXPECTED_CARD_IDS = frozenset(card["id"] for card in _build_deck())


def _sorted_player_ids(player_meta: Dict[str, Dict], player_ids: Optional[Iterable[str]] = None) -> List[str]:
    ids = list(player_ids) if player_ids is not None else list(player_meta.keys())
    return sorted(ids, key=lambda pid: (int(player_meta.get(pid, {}).get("seat", 0)), pid))


def _next_seated_player(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if player_id not in order:
        return order[0]
    return order[(order.index(player_id) + 1) % len(order)]


def _next_player_with_cards(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    start_index = order.index(player_id) if player_id in order else -1
    for offset in range(1, len(order) + 1):
        candidate = order[(start_index + offset) % len(order)]
        if state.get("players", {}).get(candidate, {}).get("hand"):
            return candidate
    return None


def _derive_cauldron_color(cards: List[Dict]) -> Optional[str]:
    colors = {card.get("color") for card in cards if card.get("kind") == "potion"}
    if len(colors) > 1:
        raise ValueError("cauldron contains multiple potion colors")
    return next(iter(colors), None)


def _cauldron_total(cards: List[Dict]) -> int:
    return sum(int(card.get("value", 0)) for card in cards)


def _legal_cauldron_indices(state: Dict, card: Dict) -> List[int]:
    if card.get("kind") == "poison":
        return list(range(CAULDRON_COUNT))

    card_color = card.get("color")
    matching: List[int] = []
    unassigned: List[int] = []
    for index, cauldron in enumerate(state.get("cauldrons", [])):
        derived_color = _derive_cauldron_color(cauldron.get("cards", []))
        if derived_color == card_color:
            matching.append(index)
        elif derived_color is None:
            unassigned.append(index)
    if len(matching) > 1:
        raise ValueError("potion color assigned to multiple cauldrons")
    return matching or unassigned


def _resolve_play(cards: List[Dict], played_card: Dict) -> Tuple[List[Dict], List[Dict], int]:
    previous = list(cards)
    new_total = _cauldron_total(previous) + int(played_card.get("value", 0))
    if new_total <= CAULDRON_LIMIT:
        return previous + [played_card], [], new_total
    return [played_card], previous, int(played_card.get("value", 0))


def _all_cards_in_state(state: Dict) -> List[Dict]:
    cards: List[Dict] = []
    for pdata in state.get("players", {}).values():
        cards.extend(pdata.get("hand", []))
        cards.extend(pdata.get("captured", []))
    for cauldron in state.get("cauldrons", []):
        cards.extend(cauldron.get("cards", []))
    cards.extend(state.get("removed_hand", []))
    return cards


def _assert_card_conservation(state: Dict) -> None:
    cards = _all_cards_in_state(state)
    card_ids = [card.get("id") for card in cards]
    if len(cards) != TOTAL_CARD_COUNT:
        raise AssertionError(f"expected {TOTAL_CARD_COUNT} cards, found {len(cards)}")
    if len(card_ids) != len(set(card_ids)):
        raise AssertionError("duplicate poison card instance")
    if set(card_ids) != EXPECTED_CARD_IDS:
        raise AssertionError("poison card catalog mismatch")


def _collect_round_cards(state: Dict) -> List[Dict]:
    _assert_card_conservation(state)
    return list(_all_cards_in_state(state))


def _round_seed(state: Dict) -> str:
    return f"{state.get('base_seed')}:{state.get('game_index', 1)}:{state.get('round_number', 1)}"


def _dealer_seed(state: Dict) -> str:
    return f"{state.get('base_seed')}:{state.get('game_index', 1)}:dealer"


def _select_dealer(state: Dict) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    return random.Random(_dealer_seed(state)).choice(order)


def _deal_order(state: Dict) -> List[str]:
    order = state.get("turn_order", [])
    dealer_id = state.get("dealer_id")
    if not order:
        return []
    dealer_index = order.index(dealer_id) if dealer_id in order else 0
    return [order[(dealer_index + offset) % len(order)] for offset in range(1, len(order) + 1)]


def _start_round(state: Dict, cards: List[Dict]) -> None:
    if len(cards) != TOTAL_CARD_COUNT or {card.get("id") for card in cards} != EXPECTED_CARD_IDS:
        raise ValueError("cannot start round with invalid card catalog")

    shuffled = list(cards)
    random.Random(_round_seed(state)).shuffle(shuffled)
    order = _deal_order(state)
    if not order:
        raise ValueError("cannot start Poison without players")

    hand_count = 4 if len(order) == 3 else len(order)
    dealt_hands: List[List[Dict]] = [[] for _ in range(hand_count)]
    for index, card in enumerate(shuffled):
        dealt_hands[index % hand_count].append(card)

    for index, player_id in enumerate(order):
        pdata = state["players"][player_id]
        pdata["hand"] = dealt_hands[index]
        pdata["captured"] = []
        pdata["round_score"] = None
        pdata["round_breakdown"] = None

    state["removed_hand"] = dealt_hands[-1] if len(order) == 3 else []
    state["cauldrons"] = [{"cards": []} for _ in range(CAULDRON_COUNT)]
    state["start_player_id"] = order[0]
    state["current_turn"] = order[0]
    state["phase"] = "playing"
    state["round_summary"] = None
    state["next_round_ready"] = []
    state["rematch_ready"] = []
    state["last_action"] = None
    state["winner_ids"] = []
    state["game_over"] = False
    state["turn_number"] = 0
    _assert_card_conservation(state)


def _score_round(state: Dict) -> Dict:
    player_ids = state.get("turn_order", [])
    counts: Dict[str, Counter] = {}
    for player_id in player_ids:
        counts[player_id] = Counter(card.get("color") for card in state["players"][player_id].get("captured", []))

    immune_by_color: Dict[str, Optional[str]] = {}
    for color in POTION_COLORS:
        max_count = max((int(counts[pid].get(color, 0)) for pid in player_ids), default=0)
        leaders = [pid for pid in player_ids if max_count > 0 and int(counts[pid].get(color, 0)) == max_count]
        immune_by_color[color] = leaders[0] if len(leaders) == 1 else None

    players_summary: Dict[str, Dict] = {}
    for player_id in player_ids:
        color_breakdown: Dict[str, Dict] = {}
        round_score = 0
        immune_colors: List[str] = []
        for color in POTION_COLORS:
            count = int(counts[player_id].get(color, 0))
            immune = immune_by_color[color] == player_id
            points = 0 if immune else count
            if immune:
                immune_colors.append(color)
            color_breakdown[color] = {"count": count, "immune": immune, "points": points}
            round_score += points
        poison_count = int(counts[player_id].get("poison", 0))
        poison_points = poison_count * 2
        round_score += poison_points
        color_breakdown["poison"] = {
            "count": poison_count,
            "immune": False,
            "points": poison_points,
        }

        pdata = state["players"][player_id]
        pdata["round_score"] = round_score
        pdata["round_breakdown"] = color_breakdown
        pdata["total_score"] = int(pdata.get("total_score", 0)) + round_score
        players_summary[player_id] = {
            "breakdown": color_breakdown,
            "immune_colors": immune_colors,
            "round_score": round_score,
            "total_score": pdata["total_score"],
            "captured_count": len(pdata.get("captured", [])),
        }

    return {
        "round_number": int(state.get("round_number", 1)),
        "dealer_id": state.get("dealer_id"),
        "players": players_summary,
        "immune_by_color": immune_by_color,
        "unscored_cauldron_count": sum(len(c.get("cards", [])) for c in state.get("cauldrons", [])),
        "cauldrons": [
            {
                "cards": [_copy_card(card) for card in cauldron.get("cards", [])],
                "total": _cauldron_total(cauldron.get("cards", [])),
                "derived_color": _derive_cauldron_color(cauldron.get("cards", [])),
            }
            for cauldron in state.get("cauldrons", [])
        ],
    }


def _finish_round(state: Dict) -> Dict:
    summary = _score_round(state)
    state["round_summary"] = summary
    state["current_turn"] = None
    state["next_round_ready"] = []
    if int(state.get("round_number", 1)) >= int(state.get("total_rounds", 1)):
        lowest_score = min((int(pdata.get("total_score", 0)) for pdata in state.get("players", {}).values()), default=0)
        state["winner_ids"] = [
            player_id
            for player_id in state.get("turn_order", [])
            if int(state["players"][player_id].get("total_score", 0)) == lowest_score
        ]
        state["phase"] = "game_over"
        state["game_over"] = True
        state["rematch_ready"] = [
            player_id
            for player_id in state.get("turn_order", [])
            if bool(state.get("player_meta", {}).get(player_id, {}).get("is_bot"))
        ]
    else:
        state["phase"] = "round_summary"
        state["game_over"] = False
    return summary


def _start_next_round(state: Dict) -> None:
    cards = _collect_round_cards(state)
    next_dealer = _next_seated_player(state, state.get("dealer_id"))
    state["dealer_id"] = next_dealer
    state["round_number"] = int(state.get("round_number", 1)) + 1
    _start_round(state, cards)


def _start_rematch(state: Dict) -> None:
    cards = _collect_round_cards(state)
    state["game_index"] = int(state.get("game_index", 1)) + 1
    state["round_number"] = 1
    state["dealer_id"] = _select_dealer(state)
    for pdata in state.get("players", {}).values():
        pdata["total_score"] = 0
        pdata["round_score"] = None
        pdata["round_breakdown"] = None
    _start_round(state, cards)


def _find_card_index(cards: List[Dict], card_id: object) -> Optional[int]:
    if not isinstance(card_id, str):
        return None
    for index, card in enumerate(cards):
        if card.get("id") == card_id:
            return index
    return None


def _legal_play_views(state: Dict, player_id: str) -> List[Dict]:
    if state.get("phase") != "playing" or state.get("current_turn") != player_id:
        return []
    result: List[Dict] = []
    hand = state.get("players", {}).get(player_id, {}).get("hand", [])
    for card in hand:
        outcomes: Dict[str, Dict] = {}
        indices = _legal_cauldron_indices(state, card)
        for cauldron_index in indices:
            cards = state["cauldrons"][cauldron_index]["cards"]
            raw_total = _cauldron_total(cards) + int(card.get("value", 0))
            outcomes[str(cauldron_index)] = {
                "new_total": raw_total,
                "will_overflow": raw_total > CAULDRON_LIMIT,
                "captured_count": len(cards) if raw_total > CAULDRON_LIMIT else 0,
            }
        result.append(
            {
                "card_id": card["id"],
                "cauldron_indices": indices,
                "outcomes": outcomes,
            }
        )
    return result


def _safe_config(config: Optional[Dict]) -> Dict:
    if not isinstance(config, dict):
        return {}
    result: Dict = {}
    if isinstance(config.get("seed"), (int, str)) and not isinstance(config.get("seed"), bool):
        result["seed"] = config["seed"]
    return result


class PoisonGame:
    game_id = "poison"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not (PoisonGame.min_players <= len(players) <= PoisonGame.max_players):
            raise ValueError("Poison requires 3 to 6 players")
        player_meta = {player["player_id"]: dict(player) for player in players}
        turn_order = _sorted_player_ids(player_meta)
        clean_config = _safe_config(config)
        base_seed = clean_config.get("seed")
        if base_seed is None:
            base_seed = secrets.token_hex(16)
        state = {
            "version": 1,
            "config": clean_config,
            "base_seed": base_seed,
            "game_index": 1,
            "round_number": 1,
            "total_rounds": len(turn_order),
            "turn_order": turn_order,
            "player_meta": player_meta,
            "players": {
                player_id: {
                    "hand": [],
                    "captured": [],
                    "round_score": None,
                    "round_breakdown": None,
                    "total_score": 0,
                }
                for player_id in turn_order
            },
            "cauldrons": [{"cards": []} for _ in range(CAULDRON_COUNT)],
            "removed_hand": [],
            "dealer_id": None,
            "start_player_id": None,
            "current_turn": None,
            "phase": "setup",
            "round_summary": None,
            "next_round_ready": [],
            "rematch_ready": [],
            "last_action": None,
            "winner_ids": [],
            "game_over": False,
            "turn_number": 0,
        }
        state["dealer_id"] = _select_dealer(state)
        _start_round(state, _build_deck())
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "playing":
            if player_id == state.get("current_turn") and state["players"][player_id].get("hand"):
                return ["play_card"]
            return []
        if phase == "round_summary":
            if player_id not in state.get("next_round_ready", []):
                return ["next_round"]
            return []
        if phase == "game_over":
            if player_id not in state.get("rematch_ready", []):
                return ["play_again"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"
        action_type = action.get("type")
        phase = state.get("phase")

        if phase == "playing":
            if action_type != "play_card":
                return [], "invalid action"
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            cauldron_index = action.get("cauldron_index")
            if isinstance(cauldron_index, bool) or not isinstance(cauldron_index, int):
                return [], "invalid cauldron"
            if not 0 <= cauldron_index < CAULDRON_COUNT:
                return [], "invalid cauldron"

            hand = state["players"][player_id].get("hand", [])
            card_index = _find_card_index(hand, action.get("card_id"))
            if card_index is None:
                return [], "card not in hand"
            card = hand[card_index]
            if cauldron_index not in _legal_cauldron_indices(state, card):
                return [], "illegal cauldron for that potion"

            card = hand.pop(card_index)
            previous_cards = state["cauldrons"][cauldron_index].get("cards", [])
            new_cards, captured, displayed_total = _resolve_play(previous_cards, card)
            state["cauldrons"][cauldron_index]["cards"] = new_cards
            if captured:
                state["players"][player_id]["captured"].extend(captured)
            state["turn_number"] = int(state.get("turn_number", 0)) + 1
            raw_total = _cauldron_total(previous_cards) + int(card.get("value", 0))
            state["last_action"] = {
                "player_id": player_id,
                "card": _copy_card(card),
                "cauldron_index": cauldron_index,
                "overflow": bool(captured),
                "captured_count": len(captured),
                "raw_total": raw_total,
                "cauldron_total": displayed_total,
            }
            _assert_card_conservation(state)

            events: List[Dict] = [
                {
                    "type": "poison:play",
                    "payload": {
                        "player_id": player_id,
                        "card": _copy_card(card),
                        "cauldron_index": cauldron_index,
                        "overflow": bool(captured),
                        "captured_count": len(captured),
                    },
                }
            ]
            if captured:
                events.append(
                    {
                        "type": "poison:overflow",
                        "payload": {
                            "player_id": player_id,
                            "cauldron_index": cauldron_index,
                            "captured_count": len(captured),
                        },
                    }
                )

            next_player = _next_player_with_cards(state, player_id)
            if next_player is None:
                summary = _finish_round(state)
                events.append(
                    {
                        "type": "poison:round_scored",
                        "payload": {
                            "round_number": summary["round_number"],
                            "final_round": state.get("game_over", False),
                        },
                    }
                )
                if state.get("game_over"):
                    events.append(
                        {
                            "type": "poison:game_over",
                            "payload": {"winner_ids": list(state.get("winner_ids", []))},
                        }
                    )
            else:
                state["current_turn"] = next_player
            return events, None

        if phase == "round_summary":
            if action_type != "next_round":
                return [], "invalid action"
            ready = state.setdefault("next_round_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events = [{"type": "poison:ready", "payload": {"player_id": player_id}}]
            if set(ready) >= set(state.get("turn_order", [])):
                _start_next_round(state)
                events.append(
                    {
                        "type": "poison:round_started",
                        "payload": {
                            "round_number": state.get("round_number"),
                            "dealer_id": state.get("dealer_id"),
                            "start_player_id": state.get("start_player_id"),
                        },
                    }
                )
            return events, None

        if phase == "game_over":
            if action_type != "play_again":
                return [], "invalid action"
            ready = state.setdefault("rematch_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events = [{"type": "poison:rematch_ready", "payload": {"player_id": player_id}}]
            if set(ready) >= set(state.get("turn_order", [])):
                _start_rematch(state)
                events.append(
                    {
                        "type": "poison:round_started",
                        "payload": {
                            "round_number": 1,
                            "dealer_id": state.get("dealer_id"),
                            "start_player_id": state.get("start_player_id"),
                        },
                    }
                )
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        reveal_round = state.get("phase") in ("round_summary", "game_over")
        players_view: List[Dict] = []
        for player_id in state.get("turn_order", []):
            pdata = state["players"][player_id]
            meta = state.get("player_meta", {}).get(player_id, {})
            players_view.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "hand_count": len(pdata.get("hand", [])),
                    "captured_count": len(pdata.get("captured", [])),
                    "round_score": pdata.get("round_score") if reveal_round else None,
                    "round_breakdown": pdata.get("round_breakdown") if reveal_round else None,
                    "total_score": int(pdata.get("total_score", 0)),
                    "next_round_ready": player_id in state.get("next_round_ready", []),
                    "rematch_ready": player_id in state.get("rematch_ready", []),
                }
            )

        cauldrons_view = []
        for index, cauldron in enumerate(state.get("cauldrons", [])):
            cards = cauldron.get("cards", [])
            cauldrons_view.append(
                {
                    "index": index,
                    "cards": [_copy_card(card) for card in cards],
                    "total": _cauldron_total(cards),
                    "derived_color": _derive_cauldron_color(cards),
                }
            )

        your_hand = []
        if viewer_id in state.get("players", {}):
            your_hand = [_copy_card(card) for card in state["players"][viewer_id].get("hand", [])]
            your_hand.sort(key=lambda card: (card["kind"] == "poison", POTION_COLORS.index(card["color"]) if card["color"] in POTION_COLORS else 9, card["value"], card["id"]))

        return {
            "game_id": PoisonGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round_number": int(state.get("round_number", 1)),
            "total_rounds": int(state.get("total_rounds", 1)),
            "dealer_id": state.get("dealer_id"),
            "start_player_id": state.get("start_player_id"),
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "cauldrons": cauldrons_view,
            "removed_count": len(state.get("removed_hand", [])),
            "your_hand": your_hand,
            "legal_actions": PoisonGame.get_legal_actions(state, viewer_id),
            "legal_plays": _legal_play_views(state, viewer_id),
            "last_action": state.get("last_action"),
            "round_summary": state.get("round_summary") if reveal_round else None,
            "next_round_ready": list(state.get("next_round_ready", [])),
            "rematch_ready": list(state.get("rematch_ready", [])),
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
            "cauldron_limit": CAULDRON_LIMIT,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        if phase == "round_summary":
            if bot_id not in state.get("next_round_ready", []):
                return {"type": "next_round", "delay_ms": 250}
            return None
        if phase != "playing" or bot_id != state.get("current_turn"):
            return None

        options: List[Tuple[Tuple[int, int, int, int], Dict]] = []
        for card in state["players"][bot_id].get("hand", []):
            for cauldron_index in _legal_cauldron_indices(state, card):
                cauldron_cards = state["cauldrons"][cauldron_index].get("cards", [])
                new_total = _cauldron_total(cauldron_cards) + int(card.get("value", 0))
                overflow = new_total > CAULDRON_LIMIT
                poison_cards = sum(1 for item in cauldron_cards if item.get("kind") == "poison")
                if overflow:
                    score = (0, -len(cauldron_cards), -poison_cards, -new_total)
                elif card.get("kind") == "poison":
                    score = (1, CAULDRON_LIMIT - new_total, 0, -cauldron_index)
                else:
                    score = (1, new_total, 0, -cauldron_index)
                options.append(
                    (
                        score,
                        {
                            "type": "play_card",
                            "card_id": card["id"],
                            "cauldron_index": cauldron_index,
                            "delay_ms": 350,
                        },
                    )
                )
        if not options:
            return None
        best_score = max(score for score, _ in options)
        best_actions = [action for score, action in options if score == best_score]
        rng = random.Random(
            f"{state.get('base_seed')}:{state.get('game_index')}:{state.get('round_number')}:"
            f"{state.get('turn_number')}:{bot_id}"
        )
        return rng.choice(best_actions)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
