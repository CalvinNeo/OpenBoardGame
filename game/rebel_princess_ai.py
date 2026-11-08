from itertools import combinations
from random import Random
from typing import Dict, List, Optional, Tuple

from game.rebel_princess import SUITS, _determine_winner, _legal_cards, _make_card, _score_cards


SAMPLE_COUNT = 12


def _effect(view: Dict) -> str:
    return view["round_card"]["id"]


def _scoring_state(view: Dict) -> Dict:
    lowest = min(player["score"] for player in view["players"])
    return {
        "round_card_id": _effect(view),
        "round_score_leaders": [player["player_id"] for player in view["players"] if player["score"] == lowest],
    }


def _card_risk(view: Dict, card: Dict) -> float:
    maximum = 12 if len(view["players"]) == 6 else 10
    strength = card["rank"] / maximum
    points = _score_cards(_scoring_state(view), view["you"], [card])
    risk = 2.4 * strength ** 2 + 1.4 * points
    if _effect(view) == "royal_decree" and card["suit"] == "queen":
        risk += 1.5 * strength
    if _effect(view) == "dancing_queens" and card["suit"] == "queen":
        risk += 0.8
    if _effect(view) == "single_fairy" and card["suit"] == "fairy":
        risk -= 3.0 * strength
    return risk


def _hand_risk(view: Dict, hand: List[Dict]) -> float:
    suits = {card["suit"] for card in hand}
    return sum(_card_risk(view, card) for card in hand) + 0.65 * len(suits)


def _without(hand: List[Dict], card_ids: List[str]) -> List[Dict]:
    removed = set(card_ids)
    return [card for card in hand if card["id"] not in removed]


def _discard(view: Dict, count: int) -> List[str]:
    hand = view["hand"]
    choices = combinations(hand, count)
    chosen = min(choices, key=lambda cards: (
        _hand_risk(view, _without(hand, [card["id"] for card in cards])),
        tuple(card["id"] for card in cards),
    ))
    return [card["id"] for card in chosen]


def _assign_unknown(pool: List[Dict], slots: List[Dict], random: Random) -> List[Dict]:
    random.shuffle(pool)
    candidates = [
        [index for index, card in enumerate(pool)
         if card["suit"] != slot.get("excluded_suit")
         and (not slot.get("required_suit") or card["suit"] == slot["required_suit"])
         and (not slot.get("snow_zero") or card["rank"] <= 7)]
        for slot in slots
    ]
    assigned: Dict[int, int] = {}

    def assign(slot_index: int, visited: set) -> bool:
        for card_index in candidates[slot_index]:
            if card_index in visited:
                continue
            visited.add(card_index)
            if card_index not in assigned or assign(assigned[card_index], visited):
                assigned[card_index] = slot_index
                return True
        return False

    for slot_index in sorted(range(len(slots)), key=lambda index: len(candidates[index])):
        if not assign(slot_index, set()):
            raise ValueError("inconsistent visible cards")
    result = {slot_index: pool[card_index] for card_index, slot_index in assigned.items()}
    return [result[index] for index in range(len(slots))]


def _samples(view: Dict) -> List[Dict]:
    player_count = len(view["players"])
    ranks = range(2, 11) if player_count == 3 else range(1, 13 if player_count == 6 else 11)
    deck = [_make_card(suit, rank) for suit in SUITS for rank in ranks]
    known = list(view["hand"]) + list(view.get("_your_won_cards", []))
    known.extend(view.get("_your_set_aside", []))
    if view.get("_your_reserved_card"):
        known.append(view["_your_reserved_card"])
    known.extend(entry["card"] for entry in view["current_trick"] if entry.get("card"))
    for player in view["players"]:
        known.extend(player["revealed_cards"])
    known_ids = {card["id"] for card in known}
    unknown = [card for card in deck if card["id"] not in known_ids]
    slots = []
    for index, entry in enumerate(view["current_trick"]):
        if not entry.get("card"):
            slots.append({
                "trick_index": index,
                "required_suit": None if entry.get("was_void") else view["lead_suit"],
                "snow_zero": entry.get("snow_zero"),
            })
    for player in view["players"]:
        if player["player_id"] != view["you"]:
            slots.extend({"player_id": player["player_id"], "excluded_suit": player["revealed_suit"]}
                         for _ in range(player["hand_count"] - len(player["revealed_cards"])))
    slots.extend({"gift": True} for _ in range(view["gift_count"]))
    random = Random(f'{view["you"]}:{view["round"]}:{view["tricks_played"]}:{_effect(view)}')
    samples = []
    for _ in range(SAMPLE_COUNT):
        position = {
            **_scoring_state(view),
            "turn_order": [player["player_id"] for player in view["players"]],
            "leader": view["leader"],
            "lead_suit": view["lead_suit"],
            "current_required_suit": view["current_required_suit"],
            "princes_sneaked_in": view["princes_sneaked_in"],
            "rank_inversions": view.get("rank_inversions", 0),
            "forced_lead_suit": view.get("forced_lead_suit"),
            "random_lead": view.get("random_lead", False),
            "pea_constraint": view.get("pea_constraint", False),
            "current_trick": [{**entry, "order": index} for index, entry in enumerate(view["current_trick"])],
            "gift_cards": [],
            "players": {
                player["player_id"]: {
                    "hand": list(view["hand"] if player["player_id"] == view["you"] else player["revealed_cards"]),
                    "won_cards": list(view.get("_your_won_cards", [])) if player["player_id"] == view["you"] else [],
                }
                for player in view["players"]
            },
        }
        for slot, card in zip(slots, _assign_unknown(list(unknown), slots, random)):
            if "trick_index" in slot:
                position["current_trick"][slot["trick_index"]]["card"] = card
            elif slot.get("gift"):
                position["gift_cards"].append(card)
            else:
                position["players"][slot["player_id"]]["hand"].append(card)
        position["random_leads"] = {
            player_id: random.choice(player["hand"]) for player_id, player in position["players"].items() if player["hand"]
        }
        samples.append(position)
    return samples


def _play(position: Dict, player_id: str, card: Dict, action: Optional[Dict] = None) -> Dict:
    action = action or {}
    hand = _without(position["players"][player_id]["hand"], [card["id"]])
    result = {
        **position,
        "players": {**position["players"], player_id: {**position["players"][player_id], "hand": hand}},
        "current_trick": list(position["current_trick"]),
    }
    was_void = False
    if result["current_trick"]:
        required = result["current_required_suit"] or result["lead_suit"]
        was_void = not any(
            item["suit"] == required or (result["round_card_id"] == "midnight_makeover" and item["suit"] == "fairy")
            for item in hand
        )
        if result["round_card_id"] == "pass_the_bouquet" and card["suit"] != required:
            result["current_required_suit"] = card["suit"]
    else:
        result["lead_suit"] = card["suit"]
        result["current_required_suit"] = card["suit"]
    if card["suit"] == "prince" and (was_void or not result["current_trick"]):
        result["princes_sneaked_in"] = True
    result["current_trick"].append({
        "player_id": player_id, "card": card, "was_void": was_void,
        "order": len(result["current_trick"]),
        "snow_zero": bool(action.get("use_snow_white") and card["rank"] <= 7),
    })
    if action.get("use_pea_princess"):
        result["pea_constraint"] = True
    return result


def _trick_size(position: Dict) -> int:
    return len(position["turn_order"]) * (2 if position["round_card_id"] == "prince_always_rings_twice" else 1)


def _capture_cost(position: Dict, player_id: str) -> int:
    won = position["players"][player_id]["won_cards"]
    cards = [entry["card"] for entry in position["current_trick"]] + position["gift_cards"]
    return _score_cards(position, player_id, won + cards) - _score_cards(position, player_id, won)


def _quick_play(view: Dict, position: Dict, player_id: str) -> Dict:
    options = _legal_cards(position, player_id)
    if position["random_lead"] and not position["current_trick"]:
        return _play(position, player_id, position["random_leads"][player_id])
    choices = []
    for card in options:
        after = _play(position, player_id, card)
        winning = _determine_winner(after) == player_id
        remaining = _trick_size(after) - len(after["current_trick"])
        inversions = after["rank_inversions"]
        if after["round_card_id"] == "upside_down":
            inversions += sum(entry["card"]["rank"] == 6 for entry in after["current_trick"])
        strength = card["rank"] / (12 if len(view["players"]) == 6 else 10)
        if inversions % 2:
            strength = 1 - strength
        probability = (0.2 + 0.8 * strength if remaining else 1) if winning else 0
        cost = probability * (_capture_cost(after, player_id) + 0.45 + 0.3 * remaining)
        cost -= 0.22 * _card_risk(view, card)
        choices.append((cost, card["id"], after))
    return min(choices, key=lambda choice: choice[:2])[2]


def _finish_trick(view: Dict, position: Dict, action: Optional[Dict]) -> Dict:
    if action:
        card = next(card for card in position["players"][view["you"]]["hand"] if card["id"] == action["card_id"])
        if position["random_lead"] and not position["current_trick"]:
            card = position["random_leads"][view["you"]]
        position = _play(position, view["you"], card, action)
    while len(position["current_trick"]) < _trick_size(position):
        if position["current_trick"]:
            last = position["current_trick"][-1]["player_id"]
            order = position["turn_order"]
            player_id = order[(order.index(last) + 1) % len(order)]
        else:
            player_id = position["leader"]
        position = _quick_play(view, position, player_id)
    return position


def _position_cost(view: Dict, position: Dict) -> float:
    player_id = view["you"]
    winning = _determine_winner(position) == player_id
    cost = _capture_cost(position, player_id) + 0.45 if winning else 0.0
    return cost + 0.22 * _hand_risk(view, position["players"][player_id]["hand"])


def _evaluate(view: Dict, samples: List[Dict], action: Optional[Dict] = None) -> float:
    return sum(_position_cost(view, _finish_trick(view, position, action)) for position in samples) / len(samples)


def _ability_price(view: Dict) -> float:
    return 0.3 if len(view["hand"]) > 2 else 0.05


def _best_play(view: Dict, samples: List[Dict]) -> Tuple[float, Dict]:
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    choices = []
    for card in _legal_cards(samples[0], view["you"]):
        action = {"type": "play_card", "card_id": card["id"]}
        variants = [action]
        if not own["princess_used"]:
            if own["princess"]["id"] == "snow_white" and card["rank"] <= 7:
                variants.append({**action, "use_snow_white": True})
            elif own["princess"]["id"] == "pea_princess":
                variants.append({**action, "use_pea_princess": True})
        for variant in variants:
            cost = _evaluate(view, samples, variant)
            if len(variant) > 2:
                cost += _ability_price(view)
            choices.append((cost, variant))
    return min(choices, key=lambda choice: choice[0])


def _before_trick(view: Dict, samples: List[Dict], baseline: float) -> Optional[Dict]:
    princess = view["your_princess"]["id"]
    opponents = [player for player in view["players"] if player["player_id"] != view["you"] and player["hand_count"]]
    worst = max((_card_risk(view, card) for card in view["hand"]), default=0)
    if princess == "sleeping_beauty" and worst >= 2.5 and opponents:
        return {"type": "use_princess"}
    if princess == "scheherazade" and worst >= 2.5 and opponents:
        target = min(opponents, key=lambda player: (
            sum(_card_risk(view, card) for card in player["revealed_cards"])
            + 2.0 * (player["hand_count"] - len(player["revealed_cards"]))
        ) / player["hand_count"])
        return {"type": "use_princess", "target_player_id": target["player_id"]}
    variants = []
    if princess == "cinderella":
        variants.append(({"type": "use_princess"}, {"rank_inversions": samples[0]["rank_inversions"] + 1}))
    elif princess == "little_mermaid":
        for suit in SUITS:
            if suit != "prince" or view["princes_sneaked_in"]:
                variants.append(({"type": "use_princess", "suit": suit}, {"forced_lead_suit": suit}))
    elif princess == "ice_princess":
        variants.append(({"type": "use_princess"}, {"random_lead": True}))
    best = None
    for action, changes in variants:
        changed = [{**position, **changes} for position in samples]
        cost = _best_play(view, changed)[0] if view["current_turn"] == view["you"] else _evaluate(view, changed)
        cost += _ability_price(view)
        if cost < baseline:
            baseline, best = cost, action
    return best


def _mulan(view: Dict) -> Dict:
    samples = _samples(view)
    baseline = _evaluate(view, samples)
    played_index = next(index for index, entry in enumerate(view["current_trick"]) if entry["player_id"] == view["you"])
    played = view["current_trick"][played_index]["card"]
    best = {"type": "skip"}
    for card in view["hand"]:
        if card["suit"] != played["suit"] or card.get("is_frog"):
            continue
        changed = []
        for position in samples:
            trick = list(position["current_trick"])
            trick[played_index] = {**trick[played_index], "card": card}
            own = position["players"][view["you"]]
            changed.append({
                **position, "current_trick": trick,
                "players": {**position["players"], view["you"]: {
                    **own, "hand": _without(own["hand"], [card["id"]]) + [played],
                }},
            })
        cost = _evaluate(view, changed) + _ability_price(view)
        if cost < baseline:
            baseline, best = cost, {"type": "use_princess", "card_id": card["id"]}
    return best


def _haggle(view: Dict) -> Dict:
    captured = view.get("_your_won_cards", [])
    scoring = _scoring_state(view)
    baseline = _score_cards(scoring, view["you"], captured) + 0.22 * _hand_risk(view, view["hand"])
    best = {"type": "skip"}
    for given in view["hand"]:
        for taken in (view.get("pending_haggle") or {}).get("trick_cards", []):
            hand = _without(view["hand"], [given["id"]]) + [taken]
            won = _without(captured, [taken["id"]]) + [given]
            cost = _score_cards(scoring, view["you"], won) + 0.22 * _hand_risk(view, hand)
            if cost < baseline:
                baseline = cost
                best = {"type": "use_princess", "hand_card_id": given["id"], "trick_card_id": taken["id"]}
    return best


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    hand = view["hand"]
    phase = view["phase"]
    if "next_round_ready" in legal:
        return {"type": "next_round_ready"}
    if "pass_cards" in legal:
        return {"type": "pass_cards", "card_ids": _discard(view, view["pass_required"])}
    if "choose_card" in legal:
        return {"type": "choose_card", "card_id": _discard(view, 1)[0]} if hand else None
    if "setup_choice" in legal:
        if phase == "reveal_suit":
            suit = min(SUITS, key=lambda suit: sum(card["suit"] == suit for card in hand))
            return {"type": "setup_choice", "suit": suit}
        if phase == "reserve_last":
            card = min(hand, key=lambda card: (_card_risk(view, card), card["id"]))
            return {"type": "setup_choice", "card_id": card["id"]}
        count = len(hand) // 2
        if _effect(view) == "blind_mans_bluff":
            chosen = _discard(view, count)
        else:
            def split_cost(cards: Tuple[Dict, ...]) -> float:
                remaining = _without(hand, [card["id"] for card in cards])
                halves = [list(cards), remaining]
                return sum(_hand_risk(view, half) for half in halves) + 2 * max(
                    min(_card_risk(view, card) for card in half) for half in halves
                )

            chosen = [card["id"] for card in min(combinations(hand, count), key=split_cost)]
        return {"type": "setup_choice", "card_ids": chosen}
    if phase == "sleeping_beauty_keep":
        card = min((item["card"] for item in view["sleeping_beauty_pool"]),
                   key=lambda card: _hand_risk(view, hand + [card]))
        return {"type": "use_princess", "keep_card_id": card["id"]}
    if phase == "scheherazade_decide":
        drawn = view["scheherazade_drawn"]["card"]
        if hand:
            given = _discard(view, 1)[0]
            if _hand_risk(view, _without(hand, [given]) + [drawn]) < _hand_risk(view, hand):
                return {"type": "use_princess", "give_card_id": given}
        return {"type": "skip"}
    if phase == "haggle":
        return _haggle(view)
    if phase == "mulan":
        return _mulan(view)
    if phase == "pocahontas":
        if not hand:
            return {"type": "skip"}
        next_view = {**view, "current_trick": [], "lead_suit": None, "current_required_suit": None,
                     "rank_inversions": 0, "forced_lead_suit": None, "random_lead": False,
                     "pea_constraint": False, "gift_count": 0}
        samples = _samples(next_view)
        baseline = _evaluate(next_view, samples)
        best = {"type": "skip"}
        for player in view["players"]:
            if player["player_id"] == view["you"]:
                continue
            changed = [{**position, "leader": player["player_id"]} for position in samples]
            cost = _evaluate(next_view, changed) + _ability_price(view)
            if cost < baseline:
                baseline, best = cost, {"type": "use_princess", "target_player_id": player["player_id"]}
        return best
    if phase == "trick":
        if "play_card" not in legal and (view["current_trick"] or view["your_princess"]["id"] == "pea_princess"):
            return None
        samples = _samples(view)
        baseline, action = _best_play(view, samples) if "play_card" in legal else (_evaluate(view, samples), None)
        if "use_princess" in legal and not view["current_trick"]:
            ability = _before_trick(view, samples, baseline)
            if ability:
                return ability
        return action
    return {"type": "skip"} if "skip" in legal else None
