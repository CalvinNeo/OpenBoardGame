import unittest

from game.poison_ai import choose_action


def _card(card_id, kind, color, value):
    return {"id": card_id, "kind": kind, "color": color, "value": value}


def _view(hand, cauldrons, legal_plays, captured=None):
    return {
        "legal_actions": ["play_card"],
        "your_hand": hand,
        "cauldrons": [
            {
                "index": index,
                "cards": cards,
                "total": sum(card["value"] for card in cards),
                "derived_color": next(
                    (card["color"] for card in cards if card["kind"] == "potion"), None
                ),
            }
            for index, cards in enumerate(cauldrons)
        ],
        "players": [{"player_id": f"p{index}"} for index in range(3)],
        "legal_plays": legal_plays,
        "_your_captured": captured or [],
    }


class PoisonAiTests(unittest.TestCase):
    def test_safe_poison_pressures_the_fullest_cauldron(self):
        poison = _card("poison", "poison", "poison", 4)
        hand = [poison]
        cauldrons = [
            [_card("red-7", "potion", "red", 7), _card("red-2", "potion", "red", 2)],
            [_card("blue-5", "potion", "blue", 5)],
            [],
        ]
        legal = [{
            "card_id": "poison",
            "cauldron_indices": [0, 1, 2],
            "outcomes": {
                "0": {"new_total": 13, "will_overflow": False},
                "1": {"new_total": 9, "will_overflow": False},
                "2": {"new_total": 4, "will_overflow": False},
            },
        }]

        action = choose_action(_view(hand, cauldrons, legal))

        self.assertEqual(action, {"type": "play_card", "card_id": "poison", "cauldron_index": 0})

    def test_overflow_avoids_cauldron_containing_poison(self):
        poison = _card("poison", "poison", "poison", 4)
        hand = [poison]
        cauldrons = [
            [poison, _card("red-7", "potion", "red", 7), _card("red-4", "potion", "red", 4)],
            [_card("blue-7", "potion", "blue", 7), _card("blue-5", "potion", "blue", 5), _card("blue-2", "potion", "blue", 2)],
            [],
        ]
        legal = [{
            "card_id": "poison",
            "cauldron_indices": [0, 1, 2],
            "outcomes": {
                "0": {"new_total": 19, "will_overflow": True},
                "1": {"new_total": 18, "will_overflow": True},
                "2": {"new_total": 4, "will_overflow": False},
            },
        }]
        # The empty cauldron is safe, so it is still preferred over either
        # overflow.  Remove it to exercise the forced-overflow tie breaker.
        legal[0]["cauldron_indices"] = [0, 1]
        legal[0]["outcomes"].pop("2")

        action = choose_action(_view(hand, cauldrons, legal))

        self.assertEqual(action["cauldron_index"], 1)

    def test_captured_majority_is_accounted_for_when_overflow_is_forced(self):
        poison = _card("poison", "poison", "poison", 4)
        hand = [poison]
        cauldrons = [
            [_card("red-7", "potion", "red", 7), _card("red-5", "potion", "red", 5)],
            [_card("blue-7", "potion", "blue", 7), _card("blue-5", "potion", "blue", 5)],
            [_card("purple-7", "potion", "purple", 7), _card("purple-5", "potion", "purple", 5)],
        ]
        legal = [{
            "card_id": "poison",
            "cauldron_indices": [0, 1, 2],
            "outcomes": {
                str(index): {"new_total": 16, "will_overflow": True}
                for index in range(3)
            },
        }]
        captured = [
            _card(f"red-captured-{index}", "potion", "red", 1)
            for index in range(3)
        ]

        action = choose_action(_view(hand, cauldrons, legal, captured))

        self.assertEqual(action["cauldron_index"], 0)

    def test_safe_play_uses_public_next_hand_pressure(self):
        poison = _card("poison", "poison", "poison", 4)
        # Both targets end at 13, but only the colour left at 9 remains safe
        # for the next player.  The known red card makes leaving blue open
        # the stronger pressure play without inspecting the hidden hand.
        red_card = _card("red-known", "potion", "red", 1)
        cauldrons = [
            [_card("red-5", "potion", "red", 5), _card("red-4", "potion", "red", 4)],
            [_card("blue-5", "potion", "blue", 5), _card("blue-4", "potion", "blue", 4)],
            [
                _card("purple-7", "potion", "purple", 7),
                _card("purple-5", "potion", "purple", 5),
                _card("purple-1", "potion", "purple", 1),
            ],
        ]
        legal = [{
            "card_id": "poison",
            "cauldron_indices": [0, 1],
            "outcomes": {
                "0": {"new_total": 13, "will_overflow": False},
                "1": {"new_total": 13, "will_overflow": False},
            },
        }]
        view = _view([poison, red_card], cauldrons, legal)
        view["current_turn"] = "p0"
        view["players"] = [
            {"player_id": "p0", "hand_count": 2},
            {"player_id": "p1", "hand_count": 1},
            {"player_id": "p2", "hand_count": 1},
        ]

        action = choose_action(view)

        self.assertEqual(action["cauldron_index"], 1)


if __name__ == "__main__":
    unittest.main()
