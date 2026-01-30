import unittest

from game.coyote import CARD_DOUBLE, CARD_MAX_ZERO, CARD_MYSTERY, CARD_NUMBER, _evaluate_total


def _number(value):
    return {"type": CARD_NUMBER, "value": value}


def _special(card_type):
    return {"type": card_type}


class CoyoteGameTests(unittest.TestCase):
    def test_max_zero_applies_to_highest_positive(self):
        state = {
            "turn_order": ["a", "b", "c"],
            "players": {
                "a": {"card": _number(20), "eliminated": False},
                "b": {"card": _special(CARD_MAX_ZERO), "eliminated": False},
                "c": {"card": _number(5), "eliminated": False},
            },
            "deck": [],
        }
        result = _evaluate_total(state)
        self.assertEqual(result["total"], 5)
        self.assertEqual(result["max_zero_applied"], [20])

    def test_mystery_draw_can_double_total(self):
        state = {
            "turn_order": ["a", "b", "c"],
            "players": {
                "a": {"card": _number(10), "eliminated": False},
                "b": {"card": _special(CARD_MYSTERY), "eliminated": False},
                "c": {"card": _number(1), "eliminated": False},
            },
            "deck": [_special(CARD_DOUBLE)],
        }
        result = _evaluate_total(state)
        self.assertEqual(result["total"], 22)
        self.assertEqual(result["x2_count"], 1)

    def test_max_zero_before_mystery_draw(self):
        state = {
            "turn_order": ["a", "b", "c", "d"],
            "players": {
                "a": {"card": _special(CARD_MAX_ZERO), "eliminated": False},
                "b": {"card": _number(10), "eliminated": False},
                "c": {"card": _number(5), "eliminated": False},
                "d": {"card": _special(CARD_MYSTERY), "eliminated": False},
            },
            "deck": [_number(20)],
        }
        result = _evaluate_total(state)
        self.assertEqual(result["total"], 25)
        self.assertEqual(result["max_zero_applied"], [10])

