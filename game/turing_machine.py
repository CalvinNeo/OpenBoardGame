from __future__ import annotations

import random
import uuid
from typing import Callable, Dict, List, Optional, Sequence, Tuple


Code = Tuple[int, int, int]
CriterionPredicate = Callable[[Code], bool]

COLOR_KEYS = ("yellow", "blue", "purple")
COLOR_NAMES = {"yellow": "Yellow", "blue": "Blue", "purple": "Purple"}
COLOR_INDEX = {"yellow": 0, "blue": 1, "purple": 2}
COLOR_BADGES = {"yellow": "🟨 ▲", "blue": "🟦 ■", "purple": "🟣 ●"}
CODE_VALUES = (1, 2, 3, 4, 5)
VARIANT_IDS = ("A", "B", "C", "D")
NOTE_MARKS = {"unknown", "exclude", "keep", "confirm"}
MAX_PUBLIC_LOG = 80
MAX_PRIVATE_HISTORY = 120

ALL_CODES: Tuple[Code, ...] = tuple(
    (yellow, blue, purple)
    for yellow in CODE_VALUES
    for blue in CODE_VALUES
    for purple in CODE_VALUES
)

DEFAULT_CONFIG: Dict = {
    "mode": "simple",
    "scenario_source": "preset",
    "difficulty": "standard",
    "preset_id": "relay-standard-01",
    "seed": "",
}

PRESET_SCENARIOS: Tuple[Dict[str, str], ...] = (
    {"preset_id": "calibration-easy-01", "name": "Calibration 01", "difficulty": "easy", "seed": "tm-easy-01"},
    {"preset_id": "calibration-easy-02", "name": "Calibration 02", "difficulty": "easy", "seed": "tm-easy-02"},
    {"preset_id": "calibration-easy-03", "name": "Calibration 03", "difficulty": "easy", "seed": "tm-easy-03"},
    {"preset_id": "relay-standard-01", "name": "Relay 01", "difficulty": "standard", "seed": "tm-standard-01"},
    {"preset_id": "relay-standard-02", "name": "Relay 02", "difficulty": "standard", "seed": "tm-standard-02"},
    {"preset_id": "relay-standard-03", "name": "Relay 03", "difficulty": "standard", "seed": "tm-standard-03"},
    {"preset_id": "circuit-hard-01", "name": "Circuit 01", "difficulty": "hard", "seed": "tm-hard-01"},
    {"preset_id": "circuit-hard-02", "name": "Circuit 02", "difficulty": "hard", "seed": "tm-hard-02"},
    {"preset_id": "circuit-hard-03", "name": "Circuit 03", "difficulty": "hard", "seed": "tm-hard-03"},
    {"preset_id": "omega-expert-01", "name": "Omega 01", "difficulty": "expert", "seed": "tm-expert-01"},
    {"preset_id": "omega-expert-02", "name": "Omega 02", "difficulty": "expert", "seed": "tm-expert-02"},
    {"preset_id": "omega-expert-03", "name": "Omega 03", "difficulty": "expert", "seed": "tm-expert-03"},
)
PRESET_LOOKUP = {entry["preset_id"]: entry for entry in PRESET_SCENARIOS}

DIFFICULTY_SETTINGS: Dict[str, Dict] = {
    "easy": {
        "card_count": 4,
        "min_total_complexity": 4,
        "max_total_complexity": 6,
        "max_card_complexity": 2,
        "require_non_redundant": False,
        "search_branch_limit": 14,
    },
    "standard": {
        "card_count": 5,
        "min_total_complexity": 7,
        "max_total_complexity": 10,
        "max_card_complexity": 3,
        "require_non_redundant": False,
        "search_branch_limit": 12,
    },
    "hard": {
        "card_count": 6,
        "min_total_complexity": 11,
        "max_total_complexity": 14,
        "max_card_complexity": 3,
        "require_non_redundant": True,
        "search_branch_limit": 10,
    },
    "expert": {
        "card_count": 6,
        "min_total_complexity": 15,
        "max_total_complexity": 18,
        "max_card_complexity": 3,
        "require_non_redundant": True,
        "search_branch_limit": 8,
    },
}


def _code_to_list(code: Code) -> List[int]:
    return [int(code[0]), int(code[1]), int(code[2])]


def _as_code(raw_code: object) -> Optional[Code]:
    if not isinstance(raw_code, (list, tuple)) or len(raw_code) != 3:
        return None
    values: List[int] = []
    for value in raw_code:
        if not isinstance(value, int) or value not in CODE_VALUES:
            return None
        values.append(value)
    return int(values[0]), int(values[1]), int(values[2])


def _code_label(code: Sequence[int]) -> str:
    yellow = int(code[0])
    blue = int(code[1])
    purple = int(code[2])
    return f"🟨{yellow} · 🟦{blue} · 🟣{purple}"


def _slot_number(slot: str) -> int:
    digits = "".join(ch for ch in slot if ch.isdigit())
    return int(digits) if digits else 0


def _variant(variant_id: str, label: str, description: str, predicate: CriterionPredicate) -> Dict:
    return {
        "variant_id": variant_id,
        "label": label,
        "description": description,
        "predicate": predicate,
    }


def _card(
    criterion_id: str,
    title: str,
    prompt: str,
    category: str,
    complexity: int,
    variants: Sequence[Dict],
) -> Dict:
    return {
        "criterion_id": criterion_id,
        "title": title,
        "prompt": prompt,
        "category": category,
        "complexity": complexity,
        "variants": list(variants),
    }


def _get_value(code: Code, color: str) -> int:
    return int(code[COLOR_INDEX[color]])


def _sorted_values(code: Code) -> List[int]:
    return sorted(int(value) for value in code)


def _build_criterion_library() -> List[Dict]:
    cards: List[Dict] = []
    counter = 1

    def next_id() -> str:
        nonlocal counter
        criterion_id = f"TM{counter:02d}"
        counter += 1
        return criterion_id

    def add(card: Dict) -> None:
        cards.append(card)

    for color in COLOR_KEYS:
        color_name = COLOR_NAMES[color]
        icon = COLOR_BADGES[color]
        for threshold in (2, 3, 4):
            add(
                _card(
                    next_id(),
                    f"{icon} {color_name} compared to {threshold}",
                    f"Compare the {color_name.lower()} number with {threshold}.",
                    "compare",
                    1,
                    (
                        _variant("A", "<", f"{icon} is lower than {threshold}.", lambda code, c=color, t=threshold: _get_value(code, c) < t),
                        _variant("B", "=", f"{icon} is exactly {threshold}.", lambda code, c=color, t=threshold: _get_value(code, c) == t),
                        _variant("C", ">", f"{icon} is higher than {threshold}.", lambda code, c=color, t=threshold: _get_value(code, c) > t),
                    ),
                )
            )

    for color in COLOR_KEYS:
        color_name = COLOR_NAMES[color]
        icon = COLOR_BADGES[color]
        add(
            _card(
                next_id(),
                f"{icon} {color_name} parity",
                f"Check whether the {color_name.lower()} number is odd or even.",
                "parity",
                1,
                (
                    _variant("A", "Odd", f"{icon} is odd.", lambda code, c=color: _get_value(code, c) % 2 == 1),
                    _variant("B", "Even", f"{icon} is even.", lambda code, c=color: _get_value(code, c) % 2 == 0),
                ),
            )
        )

    for left_color, right_color in (("yellow", "blue"), ("yellow", "purple"), ("blue", "purple")):
        left_name = COLOR_NAMES[left_color]
        right_name = COLOR_NAMES[right_color]
        add(
            _card(
                next_id(),
                f"{COLOR_BADGES[left_color]} {left_name} vs {COLOR_BADGES[right_color]} {right_name}",
                f"Compare the {left_name.lower()} and {right_name.lower()} numbers.",
                "compare",
                1,
                (
                    _variant(
                        "A",
                        "<",
                        f"{COLOR_BADGES[left_color]} {left_name} is lower than {COLOR_BADGES[right_color]} {right_name}.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) < _get_value(code, right),
                    ),
                    _variant(
                        "B",
                        "=",
                        f"{COLOR_BADGES[left_color]} {left_name} equals {COLOR_BADGES[right_color]} {right_name}.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) == _get_value(code, right),
                    ),
                    _variant(
                        "C",
                        ">",
                        f"{COLOR_BADGES[left_color]} {left_name} is higher than {COLOR_BADGES[right_color]} {right_name}.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) > _get_value(code, right),
                    ),
                ),
            )
        )

    for left_color, right_color in (("yellow", "blue"), ("yellow", "purple"), ("blue", "purple")):
        left_name = COLOR_NAMES[left_color]
        right_name = COLOR_NAMES[right_color]
        add(
            _card(
                next_id(),
                f"|{left_name} - {right_name}|",
                f"Measure the difference between the {left_name.lower()} and {right_name.lower()} numbers.",
                "distance",
                2,
                (
                    _variant(
                        "A",
                        "< 2",
                        f"The gap between {left_name.lower()} and {right_name.lower()} is smaller than 2.",
                        lambda code, left=left_color, right=right_color: abs(_get_value(code, left) - _get_value(code, right)) < 2,
                    ),
                    _variant(
                        "B",
                        "= 2",
                        f"The gap between {left_name.lower()} and {right_name.lower()} is exactly 2.",
                        lambda code, left=left_color, right=right_color: abs(_get_value(code, left) - _get_value(code, right)) == 2,
                    ),
                    _variant(
                        "C",
                        "> 2",
                        f"The gap between {left_name.lower()} and {right_name.lower()} is larger than 2.",
                        lambda code, left=left_color, right=right_color: abs(_get_value(code, left) - _get_value(code, right)) > 2,
                    ),
                ),
            )
        )

    for left_color, right_color in (("yellow", "blue"), ("yellow", "purple"), ("blue", "purple")):
        left_name = COLOR_NAMES[left_color]
        right_name = COLOR_NAMES[right_color]
        add(
            _card(
                next_id(),
                f"{left_name} + {right_name}",
                f"Compare the sum of the {left_name.lower()} and {right_name.lower()} numbers with 6.",
                "sum",
                2,
                (
                    _variant(
                        "A",
                        "< 6",
                        f"{left_name} + {right_name} is lower than 6.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) + _get_value(code, right) < 6,
                    ),
                    _variant(
                        "B",
                        "= 6",
                        f"{left_name} + {right_name} is exactly 6.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) + _get_value(code, right) == 6,
                    ),
                    _variant(
                        "C",
                        "> 6",
                        f"{left_name} + {right_name} is higher than 6.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) + _get_value(code, right) > 6,
                    ),
                ),
            )
        )

    for threshold in (8, 10):
        add(
            _card(
                next_id(),
                f"Total sum compared to {threshold}",
                f"Compare the total of all three numbers with {threshold}.",
                "sum",
                2,
                (
                    _variant("A", "<", f"The total is lower than {threshold}.", lambda code, t=threshold: sum(code) < t),
                    _variant("B", "=", f"The total is exactly {threshold}.", lambda code, t=threshold: sum(code) == t),
                    _variant("C", ">", f"The total is higher than {threshold}.", lambda code, t=threshold: sum(code) > t),
                ),
            )
        )

    add(
        _card(
            next_id(),
            "Total sum parity",
            "Check whether the total sum is odd or even.",
            "parity",
            1,
            (
                _variant("A", "Odd", "The total sum is odd.", lambda code: sum(code) % 2 == 1),
                _variant("B", "Even", "The total sum is even.", lambda code: sum(code) % 2 == 0),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Odd number count",
            "Count how many odd numbers appear.",
            "count",
            2,
            (
                _variant("A", "0", "There are 0 odd numbers.", lambda code: sum(1 for value in code if value % 2 == 1) == 0),
                _variant("B", "1", "There is exactly 1 odd number.", lambda code: sum(1 for value in code if value % 2 == 1) == 1),
                _variant("C", "2", "There are exactly 2 odd numbers.", lambda code: sum(1 for value in code if value % 2 == 1) == 2),
                _variant("D", "3", "There are 3 odd numbers.", lambda code: sum(1 for value in code if value % 2 == 1) == 3),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Count of digits > 3",
            "Count how many digits are higher than 3.",
            "count",
            2,
            (
                _variant("A", "0", "No digit is higher than 3.", lambda code: sum(1 for value in code if value > 3) == 0),
                _variant("B", "1", "Exactly 1 digit is higher than 3.", lambda code: sum(1 for value in code if value > 3) == 1),
                _variant("C", "2", "Exactly 2 digits are higher than 3.", lambda code: sum(1 for value in code if value > 3) == 2),
                _variant("D", "3", "All 3 digits are higher than 3.", lambda code: sum(1 for value in code if value > 3) == 3),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Count of digits < 3",
            "Count how many digits are lower than 3.",
            "count",
            2,
            (
                _variant("A", "0", "No digit is lower than 3.", lambda code: sum(1 for value in code if value < 3) == 0),
                _variant("B", "1", "Exactly 1 digit is lower than 3.", lambda code: sum(1 for value in code if value < 3) == 1),
                _variant("C", "2", "Exactly 2 digits are lower than 3.", lambda code: sum(1 for value in code if value < 3) == 2),
                _variant("D", "3", "All 3 digits are lower than 3.", lambda code: sum(1 for value in code if value < 3) == 3),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Count of digits equal to 3",
            "Count how many digits equal 3.",
            "count",
            2,
            (
                _variant("A", "0", "No digit equals 3.", lambda code: sum(1 for value in code if value == 3) == 0),
                _variant("B", "1", "Exactly 1 digit equals 3.", lambda code: sum(1 for value in code if value == 3) == 1),
                _variant("C", "2", "Exactly 2 digits equal 3.", lambda code: sum(1 for value in code if value == 3) == 2),
                _variant("D", "3", "All 3 digits equal 3.", lambda code: sum(1 for value in code if value == 3) == 3),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Distinct digit count",
            "Count how many different digits appear.",
            "count",
            2,
            (
                _variant("A", "1", "All three digits are the same.", lambda code: len(set(code)) == 1),
                _variant("B", "2", "There is exactly one matching pair.", lambda code: len(set(code)) == 2),
                _variant("C", "3", "All digits are different.", lambda code: len(set(code)) == 3),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Highest digit compared to 4",
            "Compare the largest digit with 4.",
            "extreme",
            3,
            (
                _variant("A", "< 4", "The largest digit is lower than 4.", lambda code: max(code) < 4),
                _variant("B", "= 4", "The largest digit is exactly 4.", lambda code: max(code) == 4),
                _variant("C", "> 4", "The largest digit is higher than 4.", lambda code: max(code) > 4),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Lowest digit compared to 2",
            "Compare the smallest digit with 2.",
            "extreme",
            3,
            (
                _variant("A", "< 2", "The smallest digit is lower than 2.", lambda code: min(code) < 2),
                _variant("B", "= 2", "The smallest digit is exactly 2.", lambda code: min(code) == 2),
                _variant("C", "> 2", "The smallest digit is higher than 2.", lambda code: min(code) > 2),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Digit range",
            "Measure the difference between the largest and smallest digits.",
            "distance",
            3,
            (
                _variant("A", "< 2", "The range is smaller than 2.", lambda code: max(code) - min(code) < 2),
                _variant("B", "= 2", "The range is exactly 2.", lambda code: max(code) - min(code) == 2),
                _variant("C", "> 2", "The range is larger than 2.", lambda code: max(code) - min(code) > 2),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Shape of the sequence",
            "Read the three digits in color order.",
            "order",
            3,
            (
                _variant("A", "Ascending", "Yellow < Blue < Purple.", lambda code: code[0] < code[1] < code[2]),
                _variant("B", "Descending", "Yellow > Blue > Purple.", lambda code: code[0] > code[1] > code[2]),
                _variant("C", "Other", "The sequence is neither strictly ascending nor strictly descending.", lambda code: not (code[0] < code[1] < code[2] or code[0] > code[1] > code[2])),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Middle digit compared to 3",
            "Look at the middle value after sorting the digits.",
            "order",
            3,
            (
                _variant("A", "< 3", "The middle sorted digit is lower than 3.", lambda code: _sorted_values(code)[1] < 3),
                _variant("B", "= 3", "The middle sorted digit is exactly 3.", lambda code: _sorted_values(code)[1] == 3),
                _variant("C", "> 3", "The middle sorted digit is higher than 3.", lambda code: _sorted_values(code)[1] > 3),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Which color is highest?",
            "Identify the highest color, or whether the highest value is tied.",
            "extreme",
            3,
            (
                _variant("A", "Yellow", "Yellow is the unique highest digit.", lambda code: code[0] > code[1] and code[0] > code[2]),
                _variant("B", "Blue", "Blue is the unique highest digit.", lambda code: code[1] > code[0] and code[1] > code[2]),
                _variant("C", "Purple", "Purple is the unique highest digit.", lambda code: code[2] > code[0] and code[2] > code[1]),
                _variant("D", "Tie", "The highest value is shared by at least two colors.", lambda code: len({index for index, value in enumerate(code) if value == max(code)}) >= 2),
            ),
        )
    )

    add(
        _card(
            next_id(),
            "Which color is lowest?",
            "Identify the lowest color, or whether the lowest value is tied.",
            "extreme",
            3,
            (
                _variant("A", "Yellow", "Yellow is the unique lowest digit.", lambda code: code[0] < code[1] and code[0] < code[2]),
                _variant("B", "Blue", "Blue is the unique lowest digit.", lambda code: code[1] < code[0] and code[1] < code[2]),
                _variant("C", "Purple", "Purple is the unique lowest digit.", lambda code: code[2] < code[0] and code[2] < code[1]),
                _variant("D", "Tie", "The lowest value is shared by at least two colors.", lambda code: len({index for index, value in enumerate(code) if value == min(code)}) >= 2),
            ),
        )
    )

    for left_color, right_color in (("yellow", "blue"), ("yellow", "purple"), ("blue", "purple")):
        left_name = COLOR_NAMES[left_color]
        right_name = COLOR_NAMES[right_color]
        add(
            _card(
                next_id(),
                f"{left_name} equals {right_name}?",
                f"Check whether the {left_name.lower()} and {right_name.lower()} digits match.",
                "equality",
                1,
                (
                    _variant(
                        "A",
                        "Yes",
                        f"{left_name} equals {right_name}.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) == _get_value(code, right),
                    ),
                    _variant(
                        "B",
                        "No",
                        f"{left_name} does not equal {right_name}.",
                        lambda code, left=left_color, right=right_color: _get_value(code, left) != _get_value(code, right),
                    ),
                ),
            )
        )

    for color in COLOR_KEYS:
        color_name = COLOR_NAMES[color]
        add(
            _card(
                next_id(),
                f"Is {color_name} the unique maximum?",
                f"Check whether the {color_name.lower()} digit is strictly higher than both others.",
                "extreme",
                2,
                (
                    _variant(
                        "A",
                        "Yes",
                        f"{color_name} is the unique maximum.",
                        lambda code, c=color: _get_value(code, c) == max(code) and list(code).count(max(code)) == 1,
                    ),
                    _variant(
                        "B",
                        "No",
                        f"{color_name} is not the unique maximum.",
                        lambda code, c=color: not (_get_value(code, c) == max(code) and list(code).count(max(code)) == 1),
                    ),
                ),
            )
        )

    for color in COLOR_KEYS:
        color_name = COLOR_NAMES[color]
        add(
            _card(
                next_id(),
                f"Is {color_name} the unique minimum?",
                f"Check whether the {color_name.lower()} digit is strictly lower than both others.",
                "extreme",
                2,
                (
                    _variant(
                        "A",
                        "Yes",
                        f"{color_name} is the unique minimum.",
                        lambda code, c=color: _get_value(code, c) == min(code) and list(code).count(min(code)) == 1,
                    ),
                    _variant(
                        "B",
                        "No",
                        f"{color_name} is not the unique minimum.",
                        lambda code, c=color: not (_get_value(code, c) == min(code) and list(code).count(min(code)) == 1),
                    ),
                ),
            )
        )

    for color, other_a, other_b in (("yellow", "blue", "purple"), ("blue", "yellow", "purple"), ("purple", "yellow", "blue")):
        color_name = COLOR_NAMES[color]
        other_a_name = COLOR_NAMES[other_a]
        other_b_name = COLOR_NAMES[other_b]
        add(
            _card(
                next_id(),
                f"{color_name} vs average of the other two",
                f"Compare the {color_name.lower()} digit with the average of the other two digits.",
                "balance",
                3,
                (
                    _variant(
                        "A",
                        "< avg",
                        f"{color_name} is lower than the average of {other_a_name} and {other_b_name}.",
                        lambda code, c=color, a=other_a, b=other_b: 2 * _get_value(code, c) < _get_value(code, a) + _get_value(code, b),
                    ),
                    _variant(
                        "B",
                        "= avg",
                        f"{color_name} equals the average of {other_a_name} and {other_b_name}.",
                        lambda code, c=color, a=other_a, b=other_b: 2 * _get_value(code, c) == _get_value(code, a) + _get_value(code, b),
                    ),
                    _variant(
                        "C",
                        "> avg",
                        f"{color_name} is higher than the average of {other_a_name} and {other_b_name}.",
                        lambda code, c=color, a=other_a, b=other_b: 2 * _get_value(code, c) > _get_value(code, a) + _get_value(code, b),
                    ),
                ),
            )
        )

    return cards


CRITERION_LIBRARY = _build_criterion_library()
CRITERION_LOOKUP = {card["criterion_id"]: card for card in CRITERION_LIBRARY}


def _variant_for_code(card: Dict, code: Code) -> str:
    matches = [variant["variant_id"] for variant in card["variants"] if variant["predicate"](code)]
    if len(matches) != 1:
        raise ValueError(f"criterion {card['criterion_id']} is not exhaustive for code {code}")
    return matches[0]


CRITERION_VARIANTS_BY_CODE: Dict[str, Dict[Code, str]] = {
    card["criterion_id"]: {code: _variant_for_code(card, code) for code in ALL_CODES}
    for card in CRITERION_LIBRARY
}


def _criterion_ids_for_difficulty(difficulty: str) -> List[str]:
    settings = DIFFICULTY_SETTINGS[difficulty]
    max_card_complexity = int(settings["max_card_complexity"])
    return [card["criterion_id"] for card in CRITERION_LIBRARY if int(card["complexity"]) <= max_card_complexity]


def _scenario_solution(state: Dict) -> Code:
    solution = _as_code((state.get("scenario") or {}).get("solution"))
    if not solution:
        raise ValueError("invalid scenario solution")
    return solution


def _scenario_cards(state: Dict) -> List[Dict]:
    raw_cards = (state.get("scenario") or {}).get("cards")
    return list(raw_cards) if isinstance(raw_cards, list) else []


def _scenario_card_by_slot(state: Dict, slot: str) -> Optional[Dict]:
    for card in _scenario_cards(state):
        if card.get("slot") == slot:
            return card
    return None


def _test_secret_against_proposal(secret: Code, criterion_id: str, proposal: Code) -> bool:
    secret_variant = CRITERION_VARIANTS_BY_CODE[criterion_id][secret]
    proposal_variant = CRITERION_VARIANTS_BY_CODE[criterion_id][proposal]
    return secret_variant == proposal_variant


def _matching_codes_for_conditions(conditions: Sequence[Tuple[str, str]]) -> List[Code]:
    candidates = list(ALL_CODES)
    for criterion_id, variant_id in conditions:
        variant_map = CRITERION_VARIANTS_BY_CODE[criterion_id]
        candidates = [code for code in candidates if variant_map[code] == variant_id]
        if len(candidates) <= 1:
            break
    return candidates


def _is_non_redundant(selection: Sequence[Tuple[str, str]]) -> bool:
    if len(selection) <= 1:
        return False
    for index in range(len(selection)):
        reduced = [item for idx, item in enumerate(selection) if idx != index]
        if len(_matching_codes_for_conditions(reduced)) == 1:
            return False
    return True


def _total_complexity(selection: Sequence[str]) -> int:
    return sum(int(CRITERION_LOOKUP[criterion_id]["complexity"]) for criterion_id in selection)


def _search_card_set(
    rng: random.Random,
    secret: Code,
    available_ids: Sequence[str],
    target_count: int,
    difficulty: str,
) -> Optional[List[Tuple[str, str]]]:
    settings = DIFFICULTY_SETTINGS[difficulty]
    min_total = int(settings["min_total_complexity"])
    max_total = int(settings["max_total_complexity"])
    require_non_redundant = bool(settings["require_non_redundant"])
    branch_limit = int(settings["search_branch_limit"])
    ordered_available = list(available_ids)

    def dfs(
        selected: List[Tuple[str, str]],
        selected_ids: List[str],
        candidates: List[Code],
    ) -> Optional[List[Tuple[str, str]]]:
        chosen_count = len(selected)
        if chosen_count == target_count:
            if len(candidates) != 1:
                return None
            complexity = _total_complexity(selected_ids)
            if complexity < min_total or complexity > max_total:
                return None
            if require_non_redundant and not _is_non_redundant(selected):
                return None
            return list(selected)

        if len(candidates) <= 1:
            return None

        remaining_slots = target_count - chosen_count
        remaining_cards = [criterion_id for criterion_id in ordered_available if criterion_id not in selected_ids]
        if len(remaining_cards) < remaining_slots:
            return None

        current_complexity = _total_complexity(selected_ids)
        remaining_complexities = sorted(int(CRITERION_LOOKUP[criterion_id]["complexity"]) for criterion_id in remaining_cards)
        if len(remaining_complexities) < remaining_slots:
            return None
        min_possible = current_complexity + sum(remaining_complexities[:remaining_slots])
        max_possible = current_complexity + sum(remaining_complexities[-remaining_slots:])
        if min_possible > max_total or max_possible < min_total:
            return None

        scored: List[Tuple[int, float, str, List[Code], str]] = []
        for criterion_id in remaining_cards:
            variant_id = CRITERION_VARIANTS_BY_CODE[criterion_id][secret]
            filtered = [code for code in candidates if CRITERION_VARIANTS_BY_CODE[criterion_id][code] == variant_id]
            filtered_count = len(filtered)
            if filtered_count == len(candidates):
                continue
            if remaining_slots > 1 and filtered_count == 1:
                continue
            scored.append((filtered_count, rng.random(), criterion_id, filtered, variant_id))

        if not scored:
            return None

        scored.sort(key=lambda item: (item[0], item[1]))
        for _, _, criterion_id, filtered, variant_id in scored[:branch_limit]:
            selected.append((criterion_id, variant_id))
            selected_ids.append(criterion_id)
            result = dfs(selected, selected_ids, filtered)
            if result:
                return result
            selected.pop()
            selected_ids.pop()
        return None

    return dfs([], [], list(ALL_CODES))


def _build_scenario(
    difficulty: str,
    scenario_source: str,
    share_seed: str,
    *,
    preset_id: Optional[str] = None,
    name: Optional[str] = None,
) -> Dict:
    if difficulty not in DIFFICULTY_SETTINGS:
        raise ValueError("invalid difficulty")
    settings = DIFFICULTY_SETTINGS[difficulty]
    target_count = int(settings["card_count"])
    available_ids = _criterion_ids_for_difficulty(difficulty)
    rng = random.Random(f"turing-machine|{difficulty}|{share_seed}")

    for _ in range(160):
        secret = rng.choice(ALL_CODES)
        search_ids = list(available_ids)
        rng.shuffle(search_ids)
        selection = _search_card_set(rng, secret, search_ids, target_count, difficulty)
        if not selection:
            continue
        slot_cards = []
        slot_labels = [chr(ord("A") + index) for index in range(len(selection))]
        for slot_label, (criterion_id, active_variant) in zip(slot_labels, selection):
            slot_cards.append(
                {
                    "slot": slot_label,
                    "criterion_id": criterion_id,
                    "active_variant": active_variant,
                }
            )
        return {
            "difficulty": difficulty,
            "source": scenario_source,
            "share_seed": share_seed,
            "preset_id": preset_id,
            "name": name or (preset_id or "Generated Scenario"),
            "solution": _code_to_list(secret),
            "cards": slot_cards,
        }

    raise ValueError(f"could not generate a unique {difficulty} scenario")


def _normalize_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if isinstance(config, dict):
        merged.update(config)

    mode = merged.get("mode")
    if mode not in ("simple", "expert"):
        mode = DEFAULT_CONFIG["mode"]

    scenario_source = merged.get("scenario_source")
    if scenario_source not in ("preset", "random"):
        scenario_source = DEFAULT_CONFIG["scenario_source"]

    difficulty = merged.get("difficulty")
    if difficulty not in DIFFICULTY_SETTINGS:
        difficulty = DEFAULT_CONFIG["difficulty"]

    preset_id = merged.get("preset_id")
    if not isinstance(preset_id, str) or not preset_id:
        preset_id = DEFAULT_CONFIG["preset_id"]

    seed = merged.get("seed")
    if isinstance(seed, str):
        seed = seed.strip()[:80]
    else:
        seed = ""

    if scenario_source == "preset":
        preset = PRESET_LOOKUP.get(preset_id)
        if not preset:
            preset = PRESET_LOOKUP[DEFAULT_CONFIG["preset_id"]]
        difficulty = preset["difficulty"]
        share_seed = preset["seed"]
        scenario_name = preset["name"]
        scenario = _build_scenario(
            difficulty,
            "preset",
            share_seed,
            preset_id=preset["preset_id"],
            name=scenario_name,
        )
    else:
        share_seed = seed or uuid.uuid4().hex[:8]
        scenario = _build_scenario(
            difficulty,
            "random",
            share_seed,
            name=f"Seed {share_seed}",
        )
        preset_id = ""

    return {
        "mode": mode,
        "scenario_source": scenario_source,
        "difficulty": difficulty,
        "preset_id": preset_id,
        "seed": share_seed,
        "scenario": scenario,
    }


def _default_notes(scenario: Dict) -> Dict:
    digit_marks = {color: ["unknown"] * 5 for color in COLOR_KEYS}
    variant_marks: Dict[str, List[str]] = {}
    for slot_card in scenario.get("cards", []):
        criterion_id = slot_card.get("criterion_id")
        card = CRITERION_LOOKUP.get(criterion_id)
        if not card:
            continue
        variant_marks[str(slot_card.get("slot"))] = ["unknown"] * len(card["variants"])
    return {
        "digit_marks": digit_marks,
        "variant_marks": variant_marks,
    }


def _sanitize_notes(raw_notes: object, scenario: Dict, previous: Optional[Dict]) -> Dict:
    notes = _default_notes(scenario)
    if isinstance(previous, dict):
        previous_digit_marks = previous.get("digit_marks")
        previous_variant_marks = previous.get("variant_marks")
        if isinstance(previous_digit_marks, dict):
            for color in COLOR_KEYS:
                marks = previous_digit_marks.get(color)
                if isinstance(marks, list) and len(marks) == 5:
                    notes["digit_marks"][color] = [mark if mark in NOTE_MARKS else "unknown" for mark in marks]
        if isinstance(previous_variant_marks, dict):
            for slot, marks in notes["variant_marks"].items():
                prev_marks = previous_variant_marks.get(slot)
                if isinstance(prev_marks, list) and len(prev_marks) == len(marks):
                    notes["variant_marks"][slot] = [mark if mark in NOTE_MARKS else "unknown" for mark in prev_marks]

    if not isinstance(raw_notes, dict):
        return notes

    raw_digit_marks = raw_notes.get("digit_marks")
    if isinstance(raw_digit_marks, dict):
        for color in COLOR_KEYS:
            marks = raw_digit_marks.get(color)
            if isinstance(marks, list) and len(marks) == 5:
                notes["digit_marks"][color] = [mark if mark in NOTE_MARKS else "unknown" for mark in marks]

    raw_variant_marks = raw_notes.get("variant_marks")
    if isinstance(raw_variant_marks, dict):
        for slot, marks in list(notes["variant_marks"].items()):
            next_marks = raw_variant_marks.get(slot)
            if isinstance(next_marks, list) and len(next_marks) == len(marks):
                notes["variant_marks"][slot] = [mark if mark in NOTE_MARKS else "unknown" for mark in next_marks]

    return notes


def _new_round_state() -> Dict:
    return {
        "proposal": None,
        "tests": [],
        "ended": False,
    }


def _new_player_state(scenario: Dict) -> Dict:
    return {
        "status": "active",
        "question_count": 0,
        "guess_count": 0,
        "rounds_completed": 0,
        "current_round": _new_round_state(),
        "clues": [],
        "guesses": [],
        "notes": _default_notes(scenario),
        "solved_at_round": None,
        "solved_at_question_count": None,
    }


def _append_public_log(state: Dict, entry: Dict) -> None:
    log_entries = state.setdefault("public_log", [])
    log_entries.append(entry)
    if len(log_entries) > MAX_PUBLIC_LOG:
        del log_entries[:-MAX_PUBLIC_LOG]


def _append_private_entry(entries: List[Dict], entry: Dict) -> None:
    entries.append(entry)
    if len(entries) > MAX_PRIVATE_HISTORY:
        del entries[:-MAX_PRIVATE_HISTORY]


def _active_unsolved_player_ids(state: Dict) -> List[str]:
    return [player_id for player_id, pdata in state["players"].items() if pdata.get("status") == "active"]


def _advance_round_if_ready(state: Dict) -> None:
    if state.get("game_over"):
        return
    active_unsolved = _active_unsolved_player_ids(state)
    if not active_unsolved:
        _finish_game(state)
        return
    if not all(state["players"][player_id]["current_round"].get("ended") for player_id in active_unsolved):
        return
    current_round = int(state.get("round", 1))
    for player_id in active_unsolved:
        state["players"][player_id]["rounds_completed"] = max(int(state["players"][player_id].get("rounds_completed", 0)), current_round)
        state["players"][player_id]["current_round"] = _new_round_state()
    state["round"] = current_round + 1
    _append_public_log(
        state,
        {
            "type": "round_start",
            "round": state["round"],
            "message": f"Round {state['round']} started.",
        },
    )


def _finish_game(state: Dict) -> None:
    if state.get("game_over"):
        return
    solved_players = [
        player_id
        for player_id, pdata in state["players"].items()
        if pdata.get("status") == "solved"
    ]
    if solved_players:
        best_questions = min(int(state["players"][player_id]["question_count"]) for player_id in solved_players)
        winners = [
            player_id
            for player_id in solved_players
            if int(state["players"][player_id]["question_count"]) == best_questions
        ]
    else:
        winners = []
    state["winners"] = winners
    state["game_over"] = True
    if winners:
        _append_public_log(
            state,
            {
                "type": "game_over",
                "message": "Game over. Winner decided by verifier count.",
            },
        )
    else:
        _append_public_log(
            state,
            {
                "type": "game_over",
                "message": "Game over. Nobody solved the code.",
            },
        )


def _best_solved_question_count(state: Dict) -> Optional[int]:
    solved_counts = [
        int(pdata.get("question_count", 0))
        for pdata in state.get("players", {}).values()
        if pdata.get("status") == "solved"
    ]
    if not solved_counts:
        return None
    return min(solved_counts)


def _maybe_finish_or_advance(state: Dict) -> None:
    if _active_unsolved_player_ids(state):
        _advance_round_if_ready(state)
    else:
        _finish_game(state)


def _personal_candidate_codes(state: Dict, player_id: str) -> List[Code]:
    pdata = state["players"].get(player_id)
    if not pdata:
        return list(ALL_CODES)
    clues = pdata.get("clues") or []
    if not clues:
        return list(ALL_CODES)
    candidates: List[Code] = []
    for secret in ALL_CODES:
        matches = True
        for clue in clues:
            proposal = _as_code(clue.get("proposal"))
            criterion_id = clue.get("criterion_id")
            result = clue.get("result")
            if not proposal or not isinstance(criterion_id, str) or not isinstance(result, bool):
                continue
            if _test_secret_against_proposal(secret, criterion_id, proposal) != result:
                matches = False
                break
        if matches:
            candidates.append(secret)
    return candidates


def _build_deduction_view(state: Dict, player_id: str) -> Dict:
    candidates = _personal_candidate_codes(state, player_id)
    slot_digit_counts = {}
    for color in COLOR_KEYS:
        index = COLOR_INDEX[color]
        slot_digit_counts[color] = [
            {
                "value": value,
                "count": sum(1 for code in candidates if code[index] == value),
            }
            for value in CODE_VALUES
        ]

    variant_stats = []
    for slot_card in _scenario_cards(state):
        criterion_id = slot_card.get("criterion_id")
        card = CRITERION_LOOKUP.get(criterion_id)
        if not card:
            continue
        option_counts = []
        for variant in card["variants"]:
            count = sum(
                1
                for code in candidates
                if CRITERION_VARIANTS_BY_CODE[criterion_id][code] == variant["variant_id"]
            )
            option_counts.append(
                {
                    "variant_id": variant["variant_id"],
                    "count": count,
                    "status": "certain" if count == len(candidates) and len(candidates) > 0 else ("impossible" if count == 0 else "possible"),
                }
            )
        variant_stats.append(
            {
                "slot": slot_card.get("slot"),
                "criterion_id": criterion_id,
                "options": option_counts,
            }
        )

    return {
        "candidate_count": len(candidates),
        "candidates": [_code_to_list(code) for code in candidates],
        "slot_digit_counts": slot_digit_counts,
        "variant_stats": variant_stats,
    }


def _public_player_view(state: Dict, viewer_id: str) -> List[Dict]:
    player_meta = state.get("player_meta") or {}
    ordered_ids = sorted(player_meta.keys(), key=lambda player_id: player_meta[player_id].get("seat", 0))
    blocking_ids = {
        player_id
        for player_id in _active_unsolved_player_ids(state)
        if not state["players"][player_id]["current_round"].get("ended")
    }
    players = []
    for player_id in ordered_ids:
        meta = player_meta[player_id]
        pdata = state["players"][player_id]
        players.append(
            {
                "player_id": player_id,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot", False),
                "status": pdata.get("status"),
                "question_count": pdata.get("question_count", 0),
                "guess_count": pdata.get("guess_count", 0),
                "rounds_completed": pdata.get("rounds_completed", 0),
                "waiting": player_id in blocking_ids,
                "you": player_id == viewer_id,
                "solved_at_round": pdata.get("solved_at_round"),
                "solved_at_question_count": pdata.get("solved_at_question_count"),
            }
        )
    return players


def _build_criteria_view(state: Dict, player_id: str) -> List[Dict]:
    current_round = state["players"][player_id]["current_round"]
    tested_results = {
        test["slot"]: test.get("result")
        for test in current_round.get("tests", [])
        if isinstance(test, dict)
    }
    cards = []
    for slot_card in _scenario_cards(state):
        criterion_id = slot_card.get("criterion_id")
        card = CRITERION_LOOKUP.get(criterion_id)
        if not card:
            continue
        cards.append(
            {
                "slot": slot_card.get("slot"),
                "criterion_id": criterion_id,
                "title": card["title"],
                "prompt": card["prompt"],
                "category": card["category"],
                "variants": [
                    {
                        "variant_id": variant["variant_id"],
                        "label": variant["label"],
                        "description": variant["description"],
                    }
                    for variant in card["variants"]
                ],
                "tested_this_round": slot_card.get("slot") in tested_results,
                "last_result": tested_results.get(slot_card.get("slot")),
            }
        )
    cards.sort(key=lambda item: _slot_number(str(item["slot"])))
    return cards


def _legal_actions(state: Dict, player_id: str) -> List[str]:
    if state.get("game_over"):
        return []
    pdata = state["players"].get(player_id)
    if not pdata or pdata.get("status") != "active":
        return []
    legal = ["submit_guess", "give_up", "update_notes"]
    current_round = pdata["current_round"]
    if not current_round.get("ended"):
        if not current_round.get("tests"):
            legal.append("set_proposal")
        if current_round.get("proposal") and len(current_round.get("tests", [])) < 3:
            legal.append("test_criterion")
        if current_round.get("proposal") or current_round.get("tests"):
            legal.append("next_round")
    return legal


def _status_detail(state: Dict, player_id: str) -> str:
    pdata = state["players"].get(player_id)
    if not pdata:
        return "-"
    status = pdata.get("status")
    if status == "active":
        if pdata["current_round"].get("ended"):
            blockers = [
                (state["player_meta"][candidate]["name"] or candidate)
                for candidate in _active_unsolved_player_ids(state)
                if candidate != player_id and not state["players"][candidate]["current_round"].get("ended")
            ]
            if blockers:
                return f"Waiting for {', '.join(blockers)}."
            return "Waiting for the next round."
        tests_taken = len(pdata["current_round"].get("tests", []))
        if tests_taken >= 3:
            return f"Round {state.get('round', 1)} complete. Click Next Round when ready."
        return f"Round {state.get('round', 1)}: {tests_taken}/3 verifiers checked."
    if status == "solved":
        round_no = pdata.get("solved_at_round") or "-"
        questions = pdata.get("solved_at_question_count") or 0
        return f"Solved in round {round_no} with {questions} verifier checks."
    if status == "eliminated":
        return "Wrong final guess. Eliminated."
    if status == "gave_up":
        return "Gave up."
    return "-"


class TuringMachineGame:
    game_id = "turing_machine"
    min_players = 1
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        normalized = _normalize_config(config)
        scenario = normalized["scenario"]
        player_meta = {player["player_id"]: player for player in players}
        player_ids = [player["player_id"] for player in sorted(players, key=lambda item: item.get("seat", 0))]
        state_players = {
            player_id: _new_player_state(scenario)
            for player_id in player_ids
        }
        state = {
            "config": {
                "mode": normalized["mode"],
                "scenario_source": normalized["scenario_source"],
                "difficulty": normalized["difficulty"],
                "preset_id": normalized["preset_id"],
                "seed": normalized["seed"],
            },
            "scenario": scenario,
            "round": 1,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "public_log": [
                {
                    "type": "round_start",
                    "round": 1,
                    "message": "Round 1 started.",
                }
            ],
            "winners": [],
            "game_over": False,
        }
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return _legal_actions(state, player_id)

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        meta = state["player_meta"].get(player_id, {})
        player_name = meta.get("name") or player_id

        if action_type == "update_notes":
            notes = _sanitize_notes(action.get("notes"), state["scenario"], pdata.get("notes"))
            pdata["notes"] = notes
            return events, None

        if pdata.get("status") != "active":
            return [], "player not active"

        current_round = pdata["current_round"]

        if action_type == "set_proposal":
            if current_round.get("ended"):
                return [], "round already ended"
            if current_round.get("tests"):
                return [], "proposal locked after testing begins"
            proposal = _as_code(action.get("code"))
            if not proposal:
                return [], "invalid code"
            current_round["proposal"] = _code_to_list(proposal)
            return events, None

        if action_type == "test_criterion":
            if current_round.get("ended"):
                return [], "round already ended"
            proposal = _as_code(current_round.get("proposal"))
            if not proposal:
                return [], "set a round code first"
            if len(current_round.get("tests", [])) >= 3:
                return [], "round verifier limit reached"
            slot = action.get("slot")
            if not isinstance(slot, str):
                return [], "invalid verifier slot"
            slot_card = _scenario_card_by_slot(state, slot)
            if not slot_card:
                return [], "unknown verifier slot"
            if any(test.get("slot") == slot for test in current_round.get("tests", [])):
                return [], "verifier already checked this round"

            criterion_id = str(slot_card["criterion_id"])
            secret = _scenario_solution(state)
            result = _test_secret_against_proposal(secret, criterion_id, proposal)
            test_entry = {
                "round": int(state.get("round", 1)),
                "slot": slot,
                "criterion_id": criterion_id,
                "proposal": _code_to_list(proposal),
                "result": bool(result),
            }
            current_round["tests"].append(test_entry)
            pdata["question_count"] = int(pdata.get("question_count", 0)) + 1
            _append_private_entry(pdata["clues"], test_entry)
            return events, None

        if action_type in ("next_round", "end_round"):
            if current_round.get("ended"):
                return [], "round already ended"
            if not current_round.get("proposal") and not current_round.get("tests"):
                return [], "set a round code first"
            current_round["ended"] = True
            pdata["rounds_completed"] = max(int(pdata.get("rounds_completed", 0)), int(state.get("round", 1)))
            _maybe_finish_or_advance(state)
            return events, None

        if action_type == "submit_guess":
            guess = _as_code(action.get("code"))
            if not guess:
                return [], "invalid code"
            pdata["guess_count"] = int(pdata.get("guess_count", 0)) + 1
            correct = guess == _scenario_solution(state)
            guess_entry = {
                "round": int(state.get("round", 1)),
                "guess": _code_to_list(guess),
                "correct": bool(correct),
            }
            _append_private_entry(pdata["guesses"], guess_entry)
            if correct:
                pdata["status"] = "solved"
                pdata["solved_at_round"] = int(state.get("round", 1))
                pdata["solved_at_question_count"] = int(pdata.get("question_count", 0))
                pdata["current_round"]["ended"] = True
                _append_public_log(
                    state,
                    {
                        "type": "solve",
                        "player_id": player_id,
                        "message": f"{player_name} cracked the code.",
                    },
                )
            else:
                pdata["status"] = "eliminated"
                pdata["current_round"]["ended"] = True
                _append_public_log(
                    state,
                    {
                        "type": "eliminated",
                        "player_id": player_id,
                        "message": f"{player_name} submitted a wrong final guess and is out.",
                    },
                )
            _maybe_finish_or_advance(state)
            return events, None

        if action_type == "give_up":
            pdata["status"] = "gave_up"
            pdata["current_round"]["ended"] = True
            _append_public_log(
                state,
                {
                    "type": "give_up",
                    "player_id": player_id,
                    "message": f"{player_name} gave up.",
                },
            )
            _maybe_finish_or_advance(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        pdata = state["players"].get(viewer_id)
        if not pdata:
            return {"phase": "invalid"}

        current_round = pdata["current_round"]
        current_tests = list(current_round.get("tests", []))
        proposal = current_round.get("proposal")
        active_unsolved = _active_unsolved_player_ids(state)
        blockers = [
            state["player_meta"][player_id]["name"] or player_id
            for player_id in active_unsolved
            if not state["players"][player_id]["current_round"].get("ended")
        ]
        winner_names = [
            state["player_meta"][player_id]["name"] or player_id
            for player_id in state.get("winners", [])
        ]

        view = {
            "phase": "game_over" if state.get("game_over") else "playing",
            "mode": (state.get("config") or {}).get("mode"),
            "difficulty": (state.get("scenario") or {}).get("difficulty"),
            "scenario_source": (state.get("scenario") or {}).get("source"),
            "scenario_name": (state.get("scenario") or {}).get("name"),
            "share_seed": (state.get("scenario") or {}).get("share_seed"),
            "preset_id": (state.get("scenario") or {}).get("preset_id"),
            "round": int(state.get("round", 1)),
            "you": viewer_id,
            "status": pdata.get("status"),
            "status_detail": _status_detail(state, viewer_id),
            "players": _public_player_view(state, viewer_id),
            "criteria_cards": _build_criteria_view(state, viewer_id),
            "current_round": {
                "proposal": list(proposal) if isinstance(proposal, list) else None,
                "tests": current_tests,
                "tests_remaining": max(0, 3 - len(current_tests)),
                "ended": bool(current_round.get("ended")),
            },
            "clue_history": list(pdata.get("clues", [])),
            "guess_history": list(pdata.get("guesses", [])),
            "notes": pdata.get("notes") or _default_notes(state["scenario"]),
            "public_log": list(state.get("public_log", [])),
            "blocking_players": blockers,
            "legal_actions": TuringMachineGame.get_legal_actions(state, viewer_id),
            "winners": winner_names,
        }

        if (state.get("config") or {}).get("mode") == "simple":
            view["deduction"] = _build_deduction_view(state, viewer_id)
        else:
            view["deduction"] = None

        if state.get("game_over"):
            view["solution"] = list((state.get("scenario") or {}).get("solution") or [])
        else:
            view["solution"] = None

        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata.get("status") != "active":
            return None

        candidates = _personal_candidate_codes(state, bot_id)
        best_solved_questions = _best_solved_question_count(state)
        current_questions = int(pdata.get("question_count", 0))

        if best_solved_questions is not None:
            if len(candidates) == 1 and current_questions <= best_solved_questions:
                return {"type": "submit_guess", "code": _code_to_list(candidates[0]), "delay_ms": 450}
            if current_questions > best_solved_questions:
                return {"type": "give_up", "delay_ms": 250}
            if current_questions == best_solved_questions and len(candidates) != 1:
                return {"type": "give_up", "delay_ms": 250}

        if len(candidates) == 1:
            return {"type": "submit_guess", "code": _code_to_list(candidates[0]), "delay_ms": 450}

        current_round = pdata["current_round"]
        if current_round.get("ended"):
            return None

        proposal = _as_code(current_round.get("proposal"))
        if not proposal:
            if candidates:
                return {"type": "set_proposal", "code": _code_to_list(random.choice(candidates)), "delay_ms": 180}
            return {"type": "give_up", "delay_ms": 250}

        used_slots = {test.get("slot") for test in current_round.get("tests", [])}
        available_cards = [card for card in _scenario_cards(state) if card.get("slot") not in used_slots]
        if available_cards and len(current_round.get("tests", [])) < 3:
            return {"type": "test_criterion", "slot": available_cards[0].get("slot"), "delay_ms": 220}
        return {"type": "next_round", "delay_ms": 220}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
