import copy
import itertools
import random
from typing import Dict, List, Optional, Tuple

VEGGIES = ["Lettuce", "Pepper", "Tomato", "Carrot", "Onion", "Cabbage"]
VEGGIE_COUNT_BY_PLAYERS = {
    2: 6,
    3: 9,
    4: 12,
    5: 15,
    6: 18,
}


def _get_veggie(base_index: int, offset: int) -> str:
    return VEGGIES[(base_index + offset) % len(VEGGIES)]


def _rule_label(rule: Dict) -> str:
    rtype = rule.get("type")
    if rtype == "WEIGHT":
        parts = []
        weights = rule.get("weights", {})
        for veg in VEGGIES:
            if veg in weights:
                value = int(weights[veg])
                sign = "+" if value >= 0 else ""
                parts.append(f"{sign}{value} {veg}")
        return ", ".join(parts)
    if rtype == "SUM":
        targets = rule.get("targets", [])
        return " + ".join(targets) if targets else "-"
    if rtype == "SET":
        targets = rule.get("targets", [])
        points = rule.get("points", 0)
        return f"Set ({', '.join(targets)}) = {points}"
    if rtype == "VARIETY":
        min_types = rule.get("min_types", 0)
        points = rule.get("points", 0)
        return f"Variety >= {min_types} = {points}"
    if rtype == "PARITY":
        target = rule.get("target", "-")
        mode = rule.get("mode")
        points = rule.get("points", 0)
        fallback = rule.get("fallback", 0)
        if mode == "EVEN":
            return f"Even {target} = {points}, Odd = {fallback}"
        return f"Odd {target} = {points}, Even = {fallback}"
    if rtype == "COMPARE":
        mode = rule.get("mode")
        target = rule.get("target", "-")
        points = rule.get("points", 0)
        label = "Most" if mode == "MOST" else "Fewest"
        return f"{label} {target} = {points}"
    if rtype == "THRESHOLD":
        target = rule.get("target", "-")
        count = rule.get("count", 0)
        points = rule.get("points", 0)
        return f"Every {count} {target} = {points}"
    return "-"


def _make_card(card_id: int, veggie: str, rule: Dict) -> Dict:
    return {"id": card_id, "veggie": veggie, "rule": rule}


def _build_full_deck() -> List[Dict]:
    deck: List[Dict] = []
    card_id = 1
    for i, base in enumerate(VEGGIES):
        deck.append(_make_card(card_id, base, {"type": "WEIGHT", "weights": {base: 2, _get_veggie(i, 1): -1}}))
        card_id += 1
        deck.append(_make_card(card_id, base, {"type": "WEIGHT", "weights": {base: 2, _get_veggie(i, 2): -1}}))
        card_id += 1
        deck.append(_make_card(card_id, base, {"type": "WEIGHT", "weights": {base: 2, _get_veggie(i, 3): -1}}))
        card_id += 1

        deck.append(_make_card(card_id, base, {"type": "SUM", "targets": [base, _get_veggie(i, 1)]}))
        card_id += 1
        deck.append(_make_card(card_id, base, {"type": "SUM", "targets": [base, _get_veggie(i, 2)]}))
        card_id += 1
        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "SUM", "targets": [base, _get_veggie(i, 1), _get_veggie(i, 2)]},
            )
        )
        card_id += 1

        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "SET", "targets": [base, _get_veggie(i, 3), _get_veggie(i, 4)], "points": 8},
            )
        )
        card_id += 1

        deck.append(_make_card(card_id, base, {"type": "VARIETY", "min_types": 3, "points": 5}))
        card_id += 1
        deck.append(_make_card(card_id, base, {"type": "VARIETY", "min_types": 6, "points": 12}))
        card_id += 1

        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "PARITY", "target": base, "mode": "EVEN", "points": 7, "fallback": 3},
            )
        )
        card_id += 1
        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "PARITY", "target": base, "mode": "ODD", "points": 7, "fallback": 3},
            )
        )
        card_id += 1

        deck.append(_make_card(card_id, base, {"type": "COMPARE", "mode": "MOST", "target": base, "points": 10}))
        card_id += 1
        deck.append(_make_card(card_id, base, {"type": "COMPARE", "mode": "FEWEST", "target": base, "points": 7}))
        card_id += 1

        deck.append(_make_card(card_id, base, {"type": "THRESHOLD", "target": base, "count": 2, "points": 5}))
        card_id += 1

        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "THRESHOLD", "target": _get_veggie(i, 1), "count": 2, "points": 5},
            )
        )
        card_id += 1
        deck.append(
            _make_card(card_id, base, {"type": "COMPARE", "mode": "MOST", "target": _get_veggie(i, 1), "points": 10})
        )
        card_id += 1
        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "THRESHOLD", "target": _get_veggie(i, 2), "count": 2, "points": 5},
            )
        )
        card_id += 1
        deck.append(
            _make_card(
                card_id,
                base,
                {"type": "WEIGHT", "weights": {_get_veggie(i, 4): 3, base: -2}},
            )
        )
        card_id += 1
    return deck


FULL_DECK = _build_full_deck()


def _clone_card(card: Dict) -> Dict:
    return {
        "id": card["id"],
        "veggie": card["veggie"],
        "rule": copy.deepcopy(card["rule"]),
    }


def _build_deck(player_count: int) -> List[Dict]:
    per_veggie = VEGGIE_COUNT_BY_PLAYERS[player_count]
    by_veg: Dict[str, List[Dict]] = {veg: [] for veg in VEGGIES}
    for card in FULL_DECK:
        by_veg[card["veggie"]].append(card)
    deck: List[Dict] = []
    for veg in VEGGIES:
        pool = list(by_veg[veg])
        random.shuffle(pool)
        selected = pool[:per_veggie]
        deck.extend(_clone_card(card) for card in selected)
    random.shuffle(deck)
    return deck


def _split_piles(deck: List[Dict]) -> List[List[Dict]]:
    total = len(deck)
    pile_size = total // 3 if total else 0
    return [deck[:pile_size], deck[pile_size : pile_size * 2], deck[pile_size * 2 :]]


def _draw_from_pile(pile: List[Dict]) -> Optional[Dict]:
    if not pile:
        return None
    return pile.pop()


def _market_empty_count(market: List[Optional[Dict]]) -> int:
    return sum(1 for card in market if card is None)


def _available_market_positions(market: List[Optional[Dict]]) -> List[int]:
    return [idx for idx, card in enumerate(market) if card is not None]


def _largest_pile_index(piles: List[List[Dict]]) -> Optional[int]:
    if not piles:
        return None
    counts = [len(pile) for pile in piles]
    if max(counts, default=0) == 0:
        return None
    max_count = max(counts)
    for idx, count in enumerate(counts):
        if count == max_count:
            return idx
    return None


def _refill_market_slot(state: Dict, slot_index: int) -> None:
    piles = state["draw_piles"]
    if not piles or state["market"][slot_index] is not None:
        return
    if all(len(pile) == 0 for pile in piles):
        return
    column = slot_index % 3
    target_pile = column if len(piles[column]) > 0 else _largest_pile_index(piles)
    if target_pile is None:
        return
    card = _draw_from_pile(piles[target_pile])
    if card is None:
        return
    state["market"][slot_index] = card


def _refill_market(state: Dict) -> None:
    if _market_empty_count(state["market"]) == 0:
        return
    for idx in range(len(state["market"])):
        if state["market"][idx] is None:
            _refill_market_slot(state, idx)


def _counts_for_player(state: Dict, player_id: str, override: Optional[Dict[str, int]] = None) -> Dict[str, int]:
    if override is not None:
        return override
    counts = state["players"][player_id]["veggies"]
    return {veg: int(counts.get(veg, 0)) for veg in VEGGIES}


def _score_player(
    state: Dict,
    player_id: str,
    override_counts: Optional[Dict[str, int]] = None,
    override_point_cards: Optional[List[Dict]] = None,
) -> int:
    counts_by_player: Dict[str, Dict[str, int]] = {}
    for pid in state["players"]:
        counts_by_player[pid] = _counts_for_player(state, pid, override_counts if pid == player_id else None)
    counts = counts_by_player[player_id]
    point_cards = override_point_cards if override_point_cards is not None else state["players"][player_id]["point_cards"]

    total = 0
    for card in point_cards:
        rule = card.get("rule", {})
        rtype = rule.get("type")
        if rtype == "WEIGHT":
            for veg, weight in rule.get("weights", {}).items():
                total += counts.get(veg, 0) * int(weight)
        elif rtype == "SUM":
            total += sum(counts.get(veg, 0) for veg in rule.get("targets", []))
        elif rtype == "SET":
            targets = rule.get("targets", [])
            if targets:
                sets = min(counts.get(veg, 0) for veg in targets)
                total += sets * int(rule.get("points", 0))
        elif rtype == "VARIETY":
            min_types = int(rule.get("min_types", 0))
            types_owned = sum(1 for veg in VEGGIES if counts.get(veg, 0) > 0)
            if types_owned >= min_types:
                total += int(rule.get("points", 0))
        elif rtype == "PARITY":
            target = rule.get("target")
            mode = rule.get("mode")
            value = counts.get(target, 0)
            is_even = value % 2 == 0
            target_even = mode == "EVEN"
            if is_even == target_even:
                total += int(rule.get("points", 0))
            else:
                total += int(rule.get("fallback", 0))
        elif rtype == "COMPARE":
            target = rule.get("target")
            mode = rule.get("mode")
            values = [counts_by_player[pid].get(target, 0) for pid in state["players"]]
            if not values:
                continue
            ref = max(values) if mode == "MOST" else min(values)
            if counts.get(target, 0) == ref:
                total += int(rule.get("points", 0))
        elif rtype == "THRESHOLD":
            target = rule.get("target")
            count = int(rule.get("count", 0))
            if count > 0:
                total += (counts.get(target, 0) // count) * int(rule.get("points", 0))
    return total


def _update_scores(state: Dict) -> None:
    for pid in state["players"]:
        state["players"][pid]["score"] = _score_player(state, pid)


def _next_player(state: Dict, current: Optional[str]) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    if current not in order:
        return order[0]
    idx = order.index(current)
    return order[(idx + 1) % len(order)]


def _check_game_over(state: Dict) -> bool:
    piles_empty = all(len(pile) == 0 for pile in state.get("draw_piles", []))
    market_empty = all(card is None for card in state.get("market", []))
    if not piles_empty or not market_empty:
        return False
    _update_scores(state)
    scores = {pid: pdata["score"] for pid, pdata in state["players"].items()}
    max_score = max(scores.values()) if scores else 0
    state["winner"] = [pid for pid, score in scores.items() if score == max_score]
    state["game_over"] = True
    state["phase"] = "game_over"
    return True


def _point_card_view(card: Dict, include_veggie: bool) -> Dict:
    view = {
        "id": card["id"],
        "rule": card["rule"],
        "label": _rule_label(card.get("rule", {})),
    }
    if include_veggie:
        view["veggie"] = card["veggie"]
    return view


class PointSaladGame:
    game_id = "point_salad"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < PointSaladGame.min_players or len(players) > PointSaladGame.max_players:
            raise ValueError("invalid player count")

        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        deck = _build_deck(len(players))
        piles = _split_piles(deck)

        market: List[Optional[Dict]] = [None] * 6
        for col in range(3):
            for row in range(2):
                card = _draw_from_pile(piles[col])
                if card is None:
                    continue
                market[row * 3 + col] = card

        state_players: Dict[str, Dict] = {}
        for pid in player_ids:
            state_players[pid] = {
                "point_cards": [],
                "veggies": {veg: 0 for veg in VEGGIES},
                "score": 0,
            }

        state = {
            "config": {},
            "player_meta": player_meta,
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "draw_piles": piles,
            "market": market,
            "phase": "turn",
            "game_over": False,
            "winner": [],
        }
        _update_scores(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        actions: List[str] = []
        if any(len(pile) > 0 for pile in state.get("draw_piles", [])):
            actions.append("take_point")
        if any(card is not None for card in state.get("market", [])):
            actions.append("take_veggies")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        flip_ids = action.get("flip_ids")
        flips: List[int] = []
        if flip_ids is not None:
            if not isinstance(flip_ids, list) or not all(isinstance(item, int) for item in flip_ids):
                return [], "invalid flip_ids"
            if len(set(flip_ids)) != len(flip_ids):
                return [], "duplicate flip_ids"
            flips = flip_ids

        events: List[Dict] = []
        player = state["players"][player_id]

        if action_type == "take_point":
            pile_index = action.get("pile_index")
            if not isinstance(pile_index, int) or pile_index < 0 or pile_index > 2:
                return [], "invalid pile_index"
            piles = state["draw_piles"]
            if pile_index >= len(piles) or not piles[pile_index]:
                return [], "pile empty"
            preview_card = piles[pile_index][-1]
            allowed_flip_ids = {card["id"] for card in player["point_cards"]}
            allowed_flip_ids.add(preview_card["id"])
            if any(fid not in allowed_flip_ids for fid in flips):
                return [], "invalid flip card"

            card = _draw_from_pile(piles[pile_index])
            if card is None:
                return [], "pile empty"
            player["point_cards"].append(card)
            events.append(
                {
                    "type": "point_salad:take_point",
                    "payload": {"player_id": player_id, "pile_index": pile_index, "card_id": card["id"]},
                }
            )
        elif action_type == "take_veggies":
            positions = action.get("positions")
            if not isinstance(positions, list) or not positions:
                return [], "invalid positions"
            if not all(isinstance(pos, int) for pos in positions):
                return [], "invalid positions"
            if len(set(positions)) != len(positions):
                return [], "duplicate positions"
            if any(pos < 0 or pos >= len(state["market"]) for pos in positions):
                return [], "invalid positions"

            available_positions = _available_market_positions(state["market"])
            if not available_positions:
                return [], "market empty"
            if len(available_positions) == 1 and len(positions) != 1:
                return [], "must take the last veggie"
            if len(available_positions) > 1 and len(positions) != 2:
                return [], "must take two veggies"
            if any(pos not in available_positions for pos in positions):
                return [], "invalid positions"

            allowed_flip_ids = {card["id"] for card in player["point_cards"]}
            if any(fid not in allowed_flip_ids for fid in flips):
                return [], "invalid flip card"

            taken = []
            for pos in positions:
                card = state["market"][pos]
                if card is None:
                    return [], "invalid market card"
                state["market"][pos] = None
                veg = card["veggie"]
                player["veggies"][veg] = int(player["veggies"].get(veg, 0)) + 1
                taken.append({"card_id": card["id"], "veggie": veg, "position": pos})

            _refill_market(state)
            events.append(
                {
                    "type": "point_salad:take_veggies",
                    "payload": {"player_id": player_id, "taken": taken},
                }
            )
        else:
            return [], "invalid action"

        if flips:
            for fid in flips:
                idx = next((i for i, card in enumerate(player["point_cards"]) if card["id"] == fid), None)
                if idx is None:
                    return [], "invalid flip card"
                card = player["point_cards"].pop(idx)
                veg = card["veggie"]
                player["veggies"][veg] = int(player["veggies"].get(veg, 0)) + 1
            events.append({"type": "point_salad:flip", "payload": {"player_id": player_id, "card_ids": flips}})

        _update_scores(state)
        if _check_game_over(state):
            events.append({"type": "point_salad:game_over", "payload": {"winner": state.get("winner", [])}})
            return events, None

        state["current_turn"] = _next_player(state, state.get("current_turn"))
        state["phase"] = "turn"
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state.get("player_meta", {}).keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        reveal_back = bool(state.get("game_over"))
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            include_back = reveal_back or pid == viewer_id
            point_cards = [_point_card_view(card, include_back) for card in pdata["point_cards"]]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "point_cards": point_cards,
                    "veggies": {veg: int(pdata["veggies"].get(veg, 0)) for veg in VEGGIES},
                    "score": pdata.get("score", 0),
                }
            )

        piles_view = []
        for pile in state.get("draw_piles", []):
            top = pile[-1] if pile else None
            piles_view.append(
                {
                    "count": len(pile),
                    "top": _point_card_view(top, False) if top else None,
                }
            )

        market_view = []
        for card in state.get("market", []):
            if card is None:
                market_view.append(None)
            else:
                market_view.append({"id": card["id"], "veggie": card["veggie"]})

        return {
            "game_id": PointSaladGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "turn_order": list(state.get("turn_order", [])),
            "veggies": list(VEGGIES),
            "players": players_view,
            "piles": piles_view,
            "market": market_view,
            "legal_actions": PointSaladGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id != state.get("current_turn"):
            return None
        legal = PointSaladGame.get_legal_actions(state, bot_id)
        if not legal:
            return None

        player = state["players"][bot_id]

        best_actions: List[Tuple[int, Dict]] = []
        best_score = None

        if "take_point" in legal:
            for idx, pile in enumerate(state.get("draw_piles", [])):
                if not pile:
                    continue
                card = pile[-1]
                new_points = player["point_cards"] + [card]
                score = _score_player(state, bot_id, override_point_cards=new_points)
                if best_score is None or score > best_score:
                    best_score = score
                    best_actions = [(score, {"type": "take_point", "pile_index": idx})]
                elif score == best_score:
                    best_actions.append((score, {"type": "take_point", "pile_index": idx}))

        if "take_veggies" in legal:
            available = _available_market_positions(state["market"])
            if available:
                combos = (
                    [available]
                    if len(available) == 1
                    else list(itertools.combinations(available, 2))
                )
                for combo in combos:
                    new_counts = {veg: int(player["veggies"].get(veg, 0)) for veg in VEGGIES}
                    for pos in combo:
                        card = state["market"][pos]
                        if card is None:
                            continue
                        veg = card["veggie"]
                        new_counts[veg] = new_counts.get(veg, 0) + 1
                    score = _score_player(state, bot_id, override_counts=new_counts)
                    if best_score is None or score > best_score:
                        best_score = score
                        best_actions = [(score, {"type": "take_veggies", "positions": list(combo)})]
                    elif score == best_score:
                        best_actions.append((score, {"type": "take_veggies", "positions": list(combo)}))

        if not best_actions:
            return None
        candidates = [action for _, action in best_actions]
        choice = random.choice(candidates)
        return choice

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
