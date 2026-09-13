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

    def test_drawn_spy_can_be_used_directly_on_an_opponent_card(self):
        self.state["phase"] = "drawn"
        self.state["current_turn"] = "p1"
        self.state["last_drawn"] = {"value": 10, "choice": "spy"}
        self.state["players"]["p2"]["hand"][2] = _card(3)

        self.assertIn("use_choice_action", CaboGame.get_legal_actions(self.state, "p1"))

        events, error = CaboGame.apply_action(
            self.state,
            "p1",
            {
                "type": "use_choice_action",
                "choice_type": "spy",
                "target": {"player_id": "p2", "slot": 2},
            },
        )

        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertEqual(self.state["discard"][-1]["value"], 10)
        self.assertTrue(self.state["knowledge"]["p1"]["p2"][2])
        self.assertEqual(
            CaboGame.get_public_view(self.state, "p1")["players"][1]["hand"][2]["value"],
            3,
        )
        self.assertIsNone(self.state["last_drawn"])
        self.assertEqual(self.state["phase"], "turn")
        self.assertEqual(self.state["current_turn"], "p2")

    def test_drawn_peek_can_be_used_directly_on_your_card(self):
        self.state["phase"] = "drawn"
        self.state["current_turn"] = "p1"
        self.state["last_drawn"] = {"value": 7, "choice": "peek"}
        self.state["players"]["p1"]["hand"][1] = _card(4)

        events, error = CaboGame.apply_action(
            self.state,
            "p1",
            {
                "type": "use_choice_action",
                "choice_type": "peek",
                "target": {"slot": 1},
            },
        )

        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertEqual(self.state["discard"][-1]["value"], 7)
        self.assertTrue(self.state["knowledge"]["p1"]["p1"][1])
        self.assertIsNone(self.state["last_drawn"])
        self.assertEqual(self.state["current_turn"], "p2")

    def test_drawn_swap_can_be_used_directly_with_an_opponent_card(self):
        self.state["phase"] = "drawn"
        self.state["current_turn"] = "p1"
        self.state["last_drawn"] = {"value": 11, "choice": "swap"}
        self.state["players"]["p1"]["hand"][0] = _card(2)
        self.state["players"]["p2"]["hand"][3] = _card(12)
        self.state["knowledge"]["p1"]["p1"][0] = True
        self.state["knowledge"]["p1"]["p2"][3] = True

        events, error = CaboGame.apply_action(
            self.state,
            "p1",
            {
                "type": "use_choice_action",
                "choice_type": "swap",
                "target": {"player_id": "p2", "slot": 3, "self_slot": 0},
            },
        )

        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertEqual(self.state["discard"][-1]["value"], 11)
        self.assertEqual(self.state["players"]["p1"]["hand"][0]["value"], 12)
        self.assertEqual(self.state["players"]["p2"]["hand"][3]["value"], 2)
        self.assertFalse(self.state["knowledge"]["p1"]["p1"][0])
        self.assertFalse(self.state["knowledge"]["p1"]["p2"][3])
        self.assertIsNone(self.state["last_drawn"])
        self.assertEqual(self.state["current_turn"], "p2")

    def test_invalid_direct_spy_keeps_drawn_card_available(self):
        self.state["phase"] = "drawn"
        self.state["current_turn"] = "p1"
        self.state["last_drawn"] = {"value": 10, "choice": "spy"}
        discard_count = len(self.state["discard"])

        events, error = CaboGame.apply_action(
            self.state,
            "p1",
            {
                "type": "use_choice_action",
                "choice_type": "spy",
                "target": {"player_id": "missing", "slot": 0},
            },
        )

        self.assertEqual(events, [])
        self.assertEqual(error, "invalid target player")
        self.assertEqual(len(self.state["discard"]), discard_count)
        self.assertEqual(self.state["last_drawn"], {"value": 10, "choice": "spy"})
        self.assertEqual(self.state["phase"], "drawn")

    def test_choice_can_still_be_resolved_after_discarding_first(self):
        self.state["phase"] = "drawn"
        self.state["current_turn"] = "p1"
        self.state["last_drawn"] = {"value": 9, "choice": "spy"}

        events, error = CaboGame.apply_action(
            self.state, "p1", {"type": "discard_drawn"}
        )

        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertEqual(self.state["phase"], "choice_pending")
        self.assertEqual(self.state["pending_choice"], {"type": "spy"})

        events, error = CaboGame.apply_action(
            self.state,
            "p1",
            {
                "type": "use_choice_action",
                "choice_type": "spy",
                "target": {"player_id": "p2", "slot": 0},
            },
        )

        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertTrue(self.state["knowledge"]["p1"]["p2"][0])
        self.assertIsNone(self.state["pending_choice"])
        self.assertEqual(self.state["current_turn"], "p2")

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
