from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from game.cabo import CHOICE_VALUES


Distribution = List[Tuple[int, float]]


def _known_value(card: Dict) -> Optional[int]:
    return card.get("value") if card.get("known") and not card.get("empty") else None


def _distribution(view: Dict) -> Distribution:
    configured = view.get("config", {}).get("deck_counts", {})
    counts = [int(configured.get(str(value), 4)) for value in range(14)]
    remaining = counts[:]
    visible = [
        _known_value(card)
        for player in view["players"]
        for card in player["hand"]
    ]
    visible.extend([view.get("discard_top"), view.get("last_drawn")])
    for value in visible:
        if value is not None:
            remaining[value] = max(0, remaining[value] - 1)
    if not any(remaining):
        remaining = counts if any(counts) else [1] * 14
    total = sum(remaining)
    return [(value, count / total) for value, count in enumerate(remaining) if count]


def _mean(distribution: Distribution) -> float:
    return sum(value * probability for value, probability in distribution)


def _matches(hand: List[Dict]) -> List[List[int]]:
    groups = defaultdict(list)
    for slot, card in enumerate(hand):
        value = _known_value(card)
        if value is not None:
            groups[value].append(slot)
    return [slots[:4] for slots in groups.values() if len(slots) >= 2]


def _is_moon(hand: List[Dict], view: Dict) -> bool:
    if not view.get("config", {}).get("shooting_moon"):
        return False
    values = [_known_value(card) for card in hand if not card.get("empty")]
    return len(values) == 4 and None not in values and sorted(values) == [12, 12, 13, 13]


def _hand_utility(hand: List[Dict], view: Dict, distribution: Distribution) -> float:
    if _is_moon(hand, view):
        return 75.0
    average = _mean(distribution)
    final_turn = bool(view.get("cabo_called_by"))
    utility = 0.0
    for card in hand:
        if card.get("empty"):
            continue
        value = _known_value(card)
        utility -= (average if value is None else value) + 0.15
        if value is None and not final_turn:
            utility -= 0.7
    if not final_turn:
        for slots in _matches(hand):
            utility += 0.45 * _known_value(hand[slots[0]]) * (len(slots) - 1)
    return utility


def _replaced_hand(hand: List[Dict], slot: int, value: Optional[int]) -> List[Dict]:
    result = list(hand)
    result[slot] = {"value": value, "known": value is not None, "empty": False}
    return result


def _replacement_options(
    own: Dict, view: Dict, distribution: Distribution, value: int, action_type: str
) -> List[Tuple[float, Dict]]:
    current = _hand_utility(own["hand"], view, distribution)
    return [
        (
            _hand_utility(_replaced_hand(own["hand"], slot, value), view, distribution) - current,
            {"type": action_type, "slot": slot},
        )
        for slot, card in enumerate(own["hand"])
        if not card.get("empty")
    ]


def _best_choice(
    own: Dict, view: Dict, distribution: Distribution, choice: Optional[str]
) -> Tuple[float, Optional[Dict]]:
    own_hand = own["hand"]
    current = _hand_utility(own_hand, view, distribution)
    average = _mean(distribution)
    options = []
    final_turn = bool(view.get("cabo_called_by"))
    if choice == "peek" and not final_turn:
        for slot, card in enumerate(own_hand):
            if card.get("empty") or _known_value(card) is not None:
                continue
            gain = sum(
                probability * (
                    _hand_utility(_replaced_hand(own_hand, slot, value), view, distribution)
                    - current + 0.2 * max(0.0, value - average)
                )
                for value, probability in distribution
            )
            options.append((gain, {"slot": slot}))
    if choice in ("spy", "swap"):
        for opponent in view["players"]:
            if opponent["player_id"] == own["player_id"]:
                continue
            for slot, card in enumerate(opponent["hand"]):
                if card.get("empty"):
                    continue
                target = {"player_id": opponent["player_id"], "slot": slot}
                target_value = _known_value(card)
                if choice == "spy" and not final_turn and target_value is None:
                    highest = max(
                        (
                            _known_value(own_card) if _known_value(own_card) is not None else average
                            for own_card in own_hand if not own_card.get("empty")
                        ),
                        default=0.0,
                    )
                    gain = 0.35 + 0.2 * sum(
                        probability * max(0.0, highest - value)
                        for value, probability in distribution
                    )
                    options.append((gain, target))
                if choice == "swap":
                    for self_slot, own_card in enumerate(own_hand):
                        if own_card.get("empty"):
                            continue
                        own_value = _known_value(own_card)
                        harm = (average if own_value is None else own_value) - (
                            average if target_value is None else target_value
                        )
                        gain = _hand_utility(
                            _replaced_hand(own_hand, self_slot, target_value), view, distribution
                        ) - current
                        options.append((gain + 0.3 * harm, {**target, "self_slot": self_slot}))
    if not options:
        return 0.0, None
    gain, target = max(options, key=lambda option: option[0])
    return gain, {"type": "use_choice_action", "choice_type": choice, "target": target}


def _best_draw(
    own: Dict, view: Dict, distribution: Distribution, drawn: int, legal: List[str]
) -> Tuple[float, Dict]:
    options = [(0.0, {"type": "discard_drawn"})]
    if "replace_card" in legal:
        options.extend(_replacement_options(own, view, distribution, drawn, "replace_card"))
    if "attempt_match" in legal:
        current = _hand_utility(own["hand"], view, distribution)
        for slots in _matches(own["hand"]):
            remaining = [card for slot, card in enumerate(own["hand"]) if slot not in slots]
            gain = _hand_utility(remaining, view, distribution) - current
            options.append((gain, {"type": "attempt_match", "slots": slots}))
    if "use_choice_action" in legal and drawn in CHOICE_VALUES:
        gain, action = _best_choice(own, view, distribution, CHOICE_VALUES[drawn])
        if action is not None:
            options.append((gain, action))
    return max(options, key=lambda option: option[0])


def _score_distribution(hand: List[Dict], distribution: Distribution) -> Dict[int, float]:
    scores = {0: 1.0}
    for card in hand:
        if card.get("empty"):
            continue
        known = _known_value(card)
        values = distribution if known is None else [(known, 1.0)]
        updated = defaultdict(float)
        for total, total_probability in scores.items():
            for value, probability in values:
                updated[total + value] += total_probability * probability
        scores = dict(updated)
    return scores


def _final_turn_gain(hand: List[Dict], distribution: Distribution) -> float:
    average = _mean(distribution)
    highest = max(
        (
            _known_value(card) if _known_value(card) is not None else average
            for card in hand if not card.get("empty")
        ),
        default=0.0,
    )
    match_gain = max(
        (_known_value(hand[slots[0]]) * len(slots) for slots in _matches(hand)), default=0.0
    )
    return sum(probability * max(0.0, highest - value, match_gain) for value, probability in distribution)


def _should_call(own: Dict, view: Dict, distribution: Distribution, improvement: float) -> bool:
    if _is_moon(own["hand"], view):
        return True
    laps = view.get("turn_count", 0) / len(view["players"])
    if laps >= 24:
        return True
    opponents = [player for player in view["players"] if player["player_id"] != own["player_id"]]
    if any(_is_moon(player["hand"], view) for player in opponents):
        return False
    scores = _score_distribution(own["hand"], distribution)
    if max(scores) == 0:
        return True
    if improvement <= 0.2 and all(
        card.get("empty") or _known_value(card) is not None for card in own["hand"]
    ):
        return True
    opponent_scores = [
        (_score_distribution(player["hand"], distribution), _final_turn_gain(player["hand"], distribution))
        for player in opponents
    ]
    win_probability = 0.0
    expected_loss = 0.0
    for score, probability in scores.items():
        win_chance = 1.0
        for totals, gain in opponent_scores:
            win_chance *= sum(
                chance for total, chance in totals.items() if max(0.0, total - gain) >= score
            )
        win_probability += probability * win_chance
        expected_loss += probability * (1.0 - win_chance) * (score + 5)
    confidence = min(0.94, 0.78 + improvement * 0.012)
    confidence -= min(0.3, max(0.0, laps - 8) * 0.025)
    if own.get("score", 0) + expected_loss >= view.get("config", {}).get("target_score", 100):
        confidence += 0.05
    return win_probability >= confidence


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if not legal or view.get("game_over"):
        return None
    own = next((player for player in view["players"] if player["player_id"] == view["you"]), None)
    if own is None:
        return None
    if "initial_peek" in legal:
        slots = [slot for slot, card in enumerate(own["hand"]) if not card.get("empty")]
        return {"type": "initial_peek", "slots": slots[:2]} if len(slots) >= 2 else None
    if "next_round" in legal:
        return {"type": "next_round", "delay_ms": 300}
    distribution = _distribution(view)
    phase = view.get("phase")
    if phase == "choice_pending":
        gain, action = _best_choice(own, view, distribution, (view.get("pending_choice") or {}).get("type"))
        if "use_choice_action" in legal and action is not None and gain > 0:
            return action
        return {"type": "skip_choice"} if "skip_choice" in legal else None
    if phase == "drawn" and view.get("last_drawn") is not None:
        return _best_draw(own, view, distribution, view["last_drawn"], legal)[1]
    if phase != "turn":
        return None
    discard_options = []
    if "draw_discard" in legal and view.get("discard_top") is not None:
        discard_options = _replacement_options(own, view, distribution, view["discard_top"], "draw_discard")
    best_discard = max(discard_options, key=lambda option: option[0]) if discard_options else None
    draw_gain = 0.0
    if "draw_deck" in legal:
        drawn_actions = ["discard_drawn", "replace_card", "attempt_match", "use_choice_action"]
        draw_gain = sum(
            probability * _best_draw(own, view, distribution, value, drawn_actions)[0]
            for value, probability in distribution
        )
    improvement = max(draw_gain, best_discard[0] if best_discard else 0.0)
    if "call_cabo" in legal and _should_call(own, view, distribution, improvement):
        return {"type": "call_cabo"}
    if best_discard and ("draw_deck" not in legal or best_discard[0] > draw_gain):
        return best_discard[1]
    if "draw_deck" in legal:
        return {"type": "draw_deck"}
    return {"type": "call_cabo"} if "call_cabo" in legal else None
