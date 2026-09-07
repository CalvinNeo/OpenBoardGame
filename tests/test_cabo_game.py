import unittest

from jsonschema import Draft7Validator

from game.cabo import CaboGame
from game.definitions import CABO_ACTION_SCHEMA


def _players():
    return [
        {"player_id": "p1", "name": "Player 1", "seat": 0, "is_bot": False},
        {"player_id": "p2", "name": "Player 2", "seat": 1, "is_bot": True},
    ]


def _card(value):
    return {"value": value, "choice": None}


class CaboGameTests(unittest.TestCase):
    def setUp(self):
        self.state = CaboGame.init_game(None, _players())

    def test_successful_match_discards_drawn_card(self):
        self.state["phase"] = "drawn"
        self.state["current_turn"] = "p1"
        self.state["players"]["p1"]["hand"] = [_card(4), _card(4), _card(1), _card(2)]
        self.state["last_drawn"] = _card(9)

        events, error = CaboGame.apply_action(
            self.state, "p1", {"type": "attempt_match", "slots": [0, 1]}
        )

        self.assertIsNone(error)
        self.assertEqual([event["type"] for event in events], ["game:match_success"])
        self.assertEqual(sum(card is not None for card in self.state["players"]["p1"]["hand"]), 2)
        self.assertEqual(self.state["discard"][-1]["value"], 9)
        self.assertIsNone(self.state["last_drawn"])

    def test_actions_allow_slots_added_after_failed_match(self):
        validator = Draft7Validator(CABO_ACTION_SCHEMA)

        for action in (
            {"type": "replace_card", "slot": 4},
            {"type": "draw_discard", "slot": 4},
            {"type": "attempt_match", "slots": [0, 4]},
        ):
            self.assertEqual(list(validator.iter_errors(action)), [])

    def test_next_round_waits_for_every_player(self):
        self.state["phase"] = "round_end"
        self.state["last_round_summary"] = {"round_scores": {"p1": 3, "p2": 7}}

        events, error = CaboGame.apply_action(self.state, "p1", {"type": "next_round"})

        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "round_end")
        self.assertTrue(self.state["players"]["p1"]["round_ready"])
        self.assertEqual(CaboGame.get_legal_actions(self.state, "p1"), [])
        self.assertEqual([event["type"] for event in events], ["game:next_round_ready"])

        events, error = CaboGame.apply_action(self.state, "p2", {"type": "next_round"})

        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "initial_peek")
        self.assertEqual(self.state["round"], 2)
        self.assertIsNone(self.state["last_round_summary"])
        self.assertTrue(all(not player["round_ready"] for player in self.state["players"].values()))
        self.assertEqual(
            [event["type"] for event in events],
            ["game:next_round_ready", "game:next_round"],
        )

    def test_bot_confirms_next_round(self):
        self.state["phase"] = "round_end"

        action = CaboGame.bot_move(self.state, "p2")

        self.assertEqual(action, {"type": "next_round", "delay_ms": 300})


if __name__ == "__main__":
    unittest.main()
