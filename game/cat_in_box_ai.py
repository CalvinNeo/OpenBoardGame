"""Deterministic Cat in the Box decisions based only on a player's view."""

from collections import Counter
from math import comb
from typing import Dict, List, Optional

from game.cat_in_box import (
    BID_OPTIONS,
    CARDS_PER_NUMBER,
    COLORS,
    TRUMP_COLOR,
    _largest_group,
    _resolve_trick,
)


def _hand_risk(hand: Counter, board: List[List[Optional[str]]], available: Dict[str, bool]) -> float:
    risk = 0.0
    for value, count in hand.items():
        if count <= 0:
            continue
        slots = sum(
            available.get(color, False) and board[row][value - 1] is None
            for row, color in enumerate(COLORS)
        )
        deficit = max(0, count - slots)
        risk += 8.0 * deficit
        if not slots:
            risk += 4.0 * count
        else:
            risk += count / max(1, slots - count + 1)
    return risk


def _estimate_tricks(view: Dict, hand: Counter) -> float:
    board = view["board"]
    available = view["your_colors"]
    playable = {}
    for value, count in hand.items():
        slots = sum(
            available.get(color, False) and board[row][value - 1] is None
            for row, color in enumerate(COLORS)
        )
        playable[value] = min(count, slots)
    total = sum(playable.values())
    if not total:
        return 0.0
    strength = sum(value * count for value, count in playable.items()) / (total * view["max_number"])
    estimate = total / len(view["players"]) * (0.25 + 1.35 * strength) * 0.85
    if view.get("round_start_player") == view["you"]:
        estimate += 0.15
    return max(0.0, estimate - 0.08 * _hand_risk(hand, board, available))


def _unseen_counts(view: Dict, hand: Counter) -> Counter:
    return Counter({
        value: max(0, CARDS_PER_NUMBER - hand[value] - sum(
            row[value - 1] is not None for row in view["board"]
        ))
        for value in range(1, view["max_number"] + 1)
    })


def _chance_of_any(unseen: Counter, values: List[int], hand_count: int) -> float:
    total = sum(unseen.values())
    draws = min(total, hand_count)
    matching = sum(unseen[value] for value in values)
    if not draws or not matching:
        return 0.0
    if total - matching < draws:
        return 1.0
    return 1.0 - comb(total - matching, draws) / comb(total, draws)


def _win_probability(
    view: Dict, value: int, color: str, board: List[List[Optional[str]]], unseen: Counter
) -> float:
    trick = list(view["current_trick"])
    lead_color = view.get("lead_color") if trick else color
    trick.append({"player_id": view["you"], "value": value, "color": color})
    if _resolve_trick({"current_trick": trick, "lead_color": lead_color}) != view["you"]:
        return 0.0

    played = {entry["player_id"] for entry in trick}
    probability = 1.0
    for opponent in view["players"]:
        if opponent["player_id"] in played:
            continue
        need = opponent["bid"] - opponent["tricks_won"]
        desire = 0.20 if need == 0 else 0.90
        if need >= opponent["hand_count"]:
            desire = 1.0
        response = 0.0
        for row, response_color in enumerate(COLORS):
            if not opponent["color_available"].get(response_color, False):
                continue
            if response_color == TRUMP_COLOR:
                minimum = value + 1 if color == TRUMP_COLOR else 1
            elif response_color == lead_color and color != TRUMP_COLOR:
                minimum = value + 1
            else:
                continue
            beating = [
                rank for rank in range(minimum, view["max_number"] + 1)
                if board[row][rank - 1] is None
            ]
            willingness = desire
            if response_color != lead_color and opponent["color_available"].get(lead_color, False):
                willingness *= 0.45
            response = max(response, willingness * _chance_of_any(unseen, beating, opponent["hand_count"]))
        probability *= 1.0 - response
    return probability


def _frontier(
    board: List[List[Optional[str]]], hand: Counter, available: Dict[str, bool], player_id: str
) -> int:
    frontier = 0
    for row, color in enumerate(COLORS):
        if not available.get(color, False):
            continue
        for value, count in hand.items():
            column = value - 1
            if count <= 0 or board[row][column] is not None:
                continue
            neighbors = ((row - 1, column), (row + 1, column), (row, column - 1), (row, column + 1))
            if any(
                0 <= other_row < len(board) and 0 <= other_column < len(board[other_row])
                and board[other_row][other_column] == player_id
                for other_row, other_column in neighbors
            ):
                frontier += 1
    return frontier


def _play_score(view: Dict, player: Dict, hand: Counter, value: int, color: str, unseen: Counter) -> float:
    remaining = hand.copy()
    remaining[value] -= 1
    board = [list(row) for row in view["board"]]
    board[COLORS.index(color)][value - 1] = view["you"]
    available = dict(view["your_colors"])
    if view["current_trick"] and color != view["lead_color"]:
        available[view["lead_color"]] = False

    risk = _hand_risk(remaining, board, available)
    probability = _win_probability(view, value, color, board, unseen)
    group = _largest_group(board, view["you"])
    cards_left = sum(remaining.values())
    need = player["bid"] - player["tricks_won"]

    if not cards_left:
        exact_probability = probability if need == 1 else 1.0 - probability if need == 0 else 0.0
        return probability + group * exact_probability

    attainable = 0 <= need <= cards_left + 1
    if need == 0:
        win_value = 1.0 - max(2.5, group + 0.25 * cards_left)
    elif attainable:
        win_value = 2.0 + min(2.5, 3.0 * need / (cards_left + 1))
    else:
        win_value = 2.0

    score = win_value * probability - 3.0 * risk
    if attainable:
        score += 1.1 * group + 0.08 * _frontier(board, remaining, available, view["you"])
    rank_cost = value / view["max_number"] * 0.12
    score += -rank_cost if need > 0 else rank_cost
    return score


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if view.get("game_over") or not legal:
        return None
    player = next((entry for entry in view["players"] if entry["player_id"] == view["you"]), None)
    if player is None:
        return None
    hand = Counter(view["hand"])
    if not hand:
        return None

    if "discard" in legal:
        def discard_score(value: int) -> float:
            remaining = hand.copy()
            remaining[value] -= 1
            strength = sum(rank * count for rank, count in remaining.items()) / view["max_number"]
            neighbors = sum(min(count, remaining[rank + 1]) for rank, count in remaining.items())
            return -4.0 * _hand_risk(remaining, view["board"], view["your_colors"]) + 0.15 * (strength + neighbors)

        value = max(sorted(hand), key=discard_score)
        return {"type": "discard", "card_value": value}

    if "bid" in legal:
        estimate = _estimate_tricks(view, hand)
        return {"type": "bid", "bid": min(BID_OPTIONS, key=lambda bid: abs(bid - estimate))}

    if "play_card" not in legal or view.get("current_turn") != view["you"]:
        return None
    unseen = _unseen_counts(view, hand)
    options = [
        (value, color)
        for value in sorted(hand)
        for row, color in enumerate(COLORS)
        if view["your_colors"].get(color, False) and view["board"][row][value - 1] is None
    ]
    if not options:
        return None
    value, color = max(options, key=lambda option: _play_score(view, player, hand, *option, unseen))
    return {"type": "play_card", "card_value": value, "color": color}
