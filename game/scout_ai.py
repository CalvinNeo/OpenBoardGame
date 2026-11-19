import math
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from game.scout import _card_value, _enumerate_scout_options, _flip_pending_hand


Combo = Tuple[int, int, int]
Values = Tuple[int, ...]


@lru_cache(maxsize=8192)
def _combos(values: Values) -> Tuple[Tuple[int, int, Combo], ...]:
    moves = []
    for start_index, first_value in enumerate(values):
        moves.append((start_index, start_index + 1, (1, 0, first_value)))
        repeated = True
        ascending = True
        descending = True
        for end_index in range(start_index + 1, len(values)):
            repeated = repeated and values[end_index] == first_value
            ascending = ascending and values[end_index] == values[end_index - 1] + 1
            descending = descending and values[end_index] == values[end_index - 1] - 1
            if not (repeated or ascending or descending):
                break
            combo = (end_index - start_index + 1, 2 if repeated else 1,
                     first_value if repeated else max(first_value, values[end_index]))
            moves.append((start_index, end_index + 1, combo))
    return tuple(moves)


def _values(hand: List[Dict]) -> Values:
    return tuple(_card_value(card) for card in hand)


def _active_combo(active_set: Optional[Dict]) -> Combo:
    if not active_set:
        return (0, 0, 0)
    return (int(active_set["length"]), {"single": 0, "run": 1, "set": 2}[active_set["combo_type"]],
            int(active_set["rank_value"]))


@lru_cache(maxsize=8192)
def _hand_cost(values: Values, maximum: int) -> float:
    costs = [0.0] + [float("inf")] * len(values)
    for start_index, end_index, combo in _combos(values):
        length, combo_type, rank = combo
        weakness = (maximum - rank) / (maximum - 1)
        effort = 2.2 / length ** 0.25 + 1.6 * weakness / length
        if combo_type == 2:
            effort -= 0.15
        costs[end_index] = min(costs[end_index], costs[start_index] + effort)
    return costs[-1] + 0.7 * len(values)


@lru_cache(maxsize=4096)
def _beat_probability(combo: Combo, hand_count: int, maximum: int) -> float:
    length, combo_type, rank = combo
    if not length:
        return 1.0
    if hand_count < length:
        return 0.0
    if length == 1:
        return 1.0 - (rank / maximum) ** hand_count
    same_length = 0.0
    if combo_type == 1:
        same_length += maximum
        same_length += 2 * max(0, maximum - max(rank, length - 1))
    else:
        same_length += maximum - rank
    expectation = (hand_count - length + 1) * same_length / maximum ** length
    for larger_length in range(length + 1, min(hand_count, maximum) + 1):
        patterns = maximum + 2 * (maximum - larger_length + 1)
        expectation += (hand_count - larger_length + 1) * patterns / maximum ** larger_length
    return 1.0 - math.exp(-expectation)


def _shrink_combo(combo: Combo) -> Combo:
    length, combo_type, rank = combo
    if length <= 1:
        return (0, 0, 0)
    return (length - 1, combo_type if length > 2 else 0, rank - (combo_type == 1))


class _Decision:
    def __init__(self, state: Dict, player_id: str):
        self.state = state
        self.player_id = player_id
        self.maximum = 9 if len(state["players"]) == 3 else 10
        order = state["turn_order"]
        position = order.index(player_id)
        self.opponents = [state["players"][opponent_id]
                          for opponent_id in order[position + 1:] + order[:position]]
        self.smallest_hand = min(len(opponent.get("hand", [])) for opponent in self.opponents)

    def hand_score(self, values: Values) -> float:
        pressure = 0.3 * len(values) if self.smallest_hand <= 3 else 0.0
        return -_hand_cost(values, self.maximum) - pressure

    def hold_probability(self, combo: Combo) -> float:
        if self.state["variant"] != "base" or combo[0] <= len(self.opponents):
            return 0.0
        probability = 1.0
        for opponent in self.opponents:
            count = len(opponent.get("hand", []))
            probability *= 1.0 - _beat_probability(combo, count, self.maximum)
            combo = _shrink_combo(combo)
            if opponent.get("scout_and_show_available"):
                probability *= 1.0 - 0.65 * _beat_probability(combo, count + 1, self.maximum)
        return probability

    def show_score(self, values: Values, start_index: int, end_index: int,
                   combo: Combo, active_set: Optional[Dict]) -> float:
        remaining = values[:start_index] + values[end_index:]
        captured = int(active_set["length"]) if active_set else 0
        if not remaining:
            return 10000.0 + captured
        score = self.hand_score(remaining) + captured
        score += self.hold_probability(combo) * (len(remaining) + len(self.opponents) + 2)
        if any(start == 0 and end == len(remaining) and next_combo > combo
               for start, end, next_combo in _combos(remaining)):
            score += 1.5
        return score

    def best_show(self, hand: List[Dict], active_set: Optional[Dict]) -> Tuple[float, Optional[Dict]]:
        values = _values(hand)
        target = _active_combo(active_set)
        best_score = -float("inf")
        best_action = None
        for start_index, end_index, combo in _combos(values):
            if combo <= target:
                continue
            score = self.show_score(values, start_index, end_index, combo, active_set)
            if score > best_score:
                best_score = score
                best_action = {"type": "show", "start_index": start_index, "end_index": end_index - 1}
        return best_score, best_action

    def orientation(self, hand: List[Dict]) -> float:
        values = _values(hand)
        return max(self.hand_score(values[:start_index] + values[end_index:])
                   - (2.2 + 1.6 * (self.maximum - combo[2]) / (self.maximum - 1)) / combo[0]
                   for start_index, end_index, combo in _combos(values))


def choose_action(state: Dict, player_id: str) -> Optional[Dict]:
    decision = _Decision(state, player_id)
    player = state["players"][player_id]
    if state["phase"] == "choose_orientation":
        hand = player.get("pending_hand", [])
        return {"type": "ready_hand",
                "flip": decision.orientation(_flip_pending_hand(hand)) > decision.orientation(hand)}

    hand = player.get("hand", [])
    active_set = state.get("active_set")
    best_score, best_action = decision.best_show(hand, active_set)
    if state.get("pending_scout_and_show_player") == player_id:
        return best_action or {"type": "finish_scout_and_show"}
    if best_score >= 10000 or not active_set or active_set["owner_player_id"] == player_id:
        return best_action
    duel = state["variant"] == "duel"
    tokens = int(player.get("scout_tokens_left", 0))
    if duel and tokens <= 0:
        return best_action

    for option in _enumerate_scout_options(hand, active_set):
        next_hand = option["next_hand"]
        next_active = option["next_active_set"]
        action = {key: option[key] for key in ("take_side", "insert_index", "insert_face")}
        show_score, show_action = decision.best_show(next_hand, next_active)
        if duel:
            score = show_score - 1.0
            if show_action is None:
                score = 10000.0 if tokens == 1 else decision.hand_score(_values(next_hand)) - 2.0
            if score > best_score:
                best_score, best_action = score, {"type": "scout", **action}
            continue

        scout_score = decision.hand_score(_values(next_hand)) - 1.8
        order = state["turn_order"]
        next_player = order[(order.index(player_id) + 1) % len(order)]
        if next_active and next_player == next_active["owner_player_id"]:
            scout_score -= len(next_hand) + 3
        if scout_score > best_score:
            best_score, best_action = scout_score, {"type": "scout", **action}
        if player.get("scout_and_show_available") and show_action is not None:
            combined_score = show_score - 2.0
            if combined_score > best_score:
                best_score, best_action = combined_score, {"type": "scout_and_show", **action}
    return best_action
