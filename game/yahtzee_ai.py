"""Whole-game expected-score dynamic programming for the local Yahtzee rules.

The bundled table stores values before the first roll of a turn. Only the
current turn's 252 unordered rolls need to be solved online. Regenerate the
table with ``python3 scripts/build_yahtzee_policy.py`` after changing rules.
See designs/yahtzee_ai.md for the recurrence, format and sources.
"""

import gzip
import sys
from array import array
from collections import Counter
from functools import lru_cache
from itertools import combinations_with_replacement, product
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.yahtzee import CATEGORY_ORDER, _calculate_possible_scores, _upper_total

ALL_CATEGORIES = (1 << len(CATEGORY_ORDER)) - 1
YAHTZEE_BIT = 1 << CATEGORY_ORDER.index("yahtzee")
TABLE_PATH = Path(__file__).with_name("assets") / "yahtzee_policy.bin.gz"
TABLE_MAGIC = b"OBGYDP01"
TABLE_SIZE = (ALL_CATEGORIES + 1) * 64 * 2


@lru_cache(maxsize=1)
def _dice_graph() -> Tuple:
    """All 462 partial hands, their one-die extensions and legal keeps.

    Completing a hand one fair die at a time automatically gives each of the
    252 full hands its correct multinomial probability (not 1 / 252).
    """
    hands = []
    for size in range(6):
        for dice in combinations_with_replacement(range(1, 7), size):
            hands.append(tuple(dice.count(face) for face in range(1, 7)))
    indices = {hand: index for index, hand in enumerate(hands)}
    full_start = next(i for i, hand in enumerate(hands) if sum(hand) == 5)
    children = []
    for hand in hands[:full_start]:
        children.append(tuple(
            indices[hand[:face] + (hand[face] + 1,) + hand[face + 1:]]
            for face in range(6)
        ))
    keeps = []
    rolls = []
    for hand in hands[full_start:]:
        # Prefer keeping more dice when expected values are equal.
        keeps.append(tuple(sorted(
            (indices[keep] for keep in product(*(range(n + 1) for n in hand))),
            key=lambda index: (-sum(hands[index]), index),
        )))
        rolls.append(tuple(face for face, n in enumerate(hand, 1) for _ in range(n)))
    return tuple(hands), tuple(children), tuple(keeps), tuple(rolls)


def _table_index(mask: int, upper: int, bonus_active: bool) -> int:
    return (mask * 64 + min(63, upper)) * 2 + int(bonus_active)


@lru_cache(maxsize=1)
def _load_table() -> array:
    with gzip.open(TABLE_PATH, "rb") as source:
        if source.read(len(TABLE_MAGIC)) != TABLE_MAGIC:
            raise ValueError("Unsupported Yahtzee policy; regenerate the policy table")
        payload = source.read()
    values = array("f")
    values.frombytes(payload)
    if sys.byteorder != "little":
        values.byteswap()
    if len(values) != TABLE_SIZE:
        raise ValueError("Incomplete Yahtzee policy; regenerate the policy table")
    return values


def _sheet_for_state(mask: int, bonus_active: bool) -> Dict:
    sheet = {cat: None if mask & (1 << i) else 0 for i, cat in enumerate(CATEGORY_ORDER)}
    if bonus_active:
        sheet["yahtzee"] = 50
    return sheet


@lru_cache(maxsize=128)
def _score_options(mask: int, bonus_active: bool) -> Tuple:
    """Use the game engine itself for scoring and all Joker restrictions."""
    sheet = _sheet_for_state(mask, bonus_active)
    options = []
    for dice in _dice_graph()[3]:
        scores, _, joker = _calculate_possible_scores(list(dice), sheet)
        options.append((tuple((CATEGORY_ORDER.index(cat), score) for cat, score in scores.items()),
                        100 if joker else 0))
    return tuple(options)


def _roll_expectations(values: Tuple[float, ...]) -> List[float]:
    children = _dice_graph()[1]
    expected = [0.0] * len(children) + list(values)
    for index in range(len(children) - 1, -1, -1):
        expected[index] = sum(expected[child] for child in children[index]) / 6.0
    return expected


@lru_cache(maxsize=64)
def _turn_policy(mask: int, upper: int, bonus_active: bool) -> Tuple:
    """Return the best scoring boxes and keeps with zero, one or two rerolls."""
    table = _load_table()
    keeps = _dice_graph()[2]
    scores = []
    categories = []
    for options, yahtzee_bonus in _score_options(mask, bonus_active):
        best_value, best_category = float("-inf"), -1
        for category, points in options:
            next_upper = min(63, upper + (points if category < 6 else 0))
            upper_bonus = 35 if upper < 63 and next_upper == 63 else 0
            next_bonus = bonus_active or (category == 11 and points == 50)
            future = table[_table_index(mask ^ (1 << category), next_upper, next_bonus)]
            value = points + yahtzee_bonus + upper_bonus + future
            if value > best_value:
                best_value, best_category = value, category
        scores.append(best_value)
        categories.append(best_category)

    layers = [tuple(scores)]
    policies = [()]
    for _ in range(2):
        expected = _roll_expectations(layers[-1])
        best_keeps = tuple(max(options, key=expected.__getitem__) for options in keeps)
        policies.append(best_keeps)
        layers.append(tuple(expected[keep] for keep in best_keeps))
    return tuple(categories), tuple(layers), tuple(policies)


def expected_remaining_score(score_sheet: Dict) -> float:
    """Expected additional points before a turn, excluding already-earned bonuses."""
    mask, upper, bonus_active = _compressed_state(score_sheet)
    return float(_load_table()[_table_index(mask, upper, bonus_active)])


def _compressed_state(score_sheet: Dict) -> Tuple[int, int, bool]:
    mask = sum(1 << i for i, cat in enumerate(CATEGORY_ORDER) if score_sheet.get(cat) is None)
    return mask, min(63, _upper_total(score_sheet)), score_sheet.get("yahtzee") == 50


def choose_action(state: Dict, bot_id: str) -> Optional[Dict]:
    """Plan without mutating the state or consuming the game's random stream."""
    if state.get("game_over") or bot_id != state.get("current_player"):
        return None
    player = state.get("players", {}).get(bot_id)
    if player is None:
        return None
    roll_count = int(state.get("roll_count", 0))
    if roll_count <= 0:
        return {"type": "roll"}
    mask, upper, bonus_active = _compressed_state(player["score_sheet"])
    if not mask:
        return None
    categories, values, policies = _turn_policy(mask, upper, bonus_active)
    hands, _, _, rolls = _dice_graph()
    dice = state["dice"]
    roll_index = rolls.index(tuple(sorted(dice)))
    rerolls = max(0, 3 - roll_count)
    # Keeping all five is equivalent to stopping; do not waste roll actions.
    if rerolls == 0 or values[0][roll_index] >= values[rerolls][roll_index] - 1e-9:
        return {"type": "score", "category": CATEGORY_ORDER[categories[roll_index]]}

    desired = Counter({face: n for face, n in enumerate(hands[policies[rerolls][roll_index]], 1)})
    locked = state["locked"]
    target = [False] * 5
    # Reuse already locked copies of the same face before locking others.
    for index in sorted(range(5), key=lambda i: (not locked[i], i)):
        if desired[dice[index]]:
            target[index] = True
            desired[dice[index]] -= 1
    for index in range(5):
        if bool(locked[index]) != target[index]:
            return {"type": "toggle_lock", "index": index}
    return {"type": "roll"}
