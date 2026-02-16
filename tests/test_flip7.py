import unittest

from game.flip7 import CARD_NUMBER, Flip7Game, _end_round


class Flip7GameTests(unittest.TestCase):
    def _make_state(self):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]
        state = Flip7Game.init_game({}, players)
        state["deck"] = []
        state["discard"] = []
        state["pending_action"] = None
        state["action_queue"] = []
        state["flip7_winner"] = None
        state["phase"] = "playing"
        state["current_turn"] = "p1"
        for pdata in state["players"].values():
            pdata["tableau"] = []
            pdata["status"] = "active"
            pdata["banked"] = False
            pdata["round_score"] = None
            pdata["round_breakdown"] = None
            pdata["round_flips"] = []
            pdata["flip7"] = False
        return state

    def test_bust_skips_to_next_player(self):
        state = self._make_state()
        state["deck"] = [{"type": CARD_NUMBER, "value": 5}]
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 5}]

        events, error = Flip7Game.apply_action(state, "p1", {"type": "flip"})

        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:bust" for evt in events))
        self.assertEqual(state["players"]["p1"]["status"], "out")
        self.assertEqual(state["players"]["p1"]["round_score"], 0)
        self.assertTrue(state["players"]["p1"]["banked"])
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["phase"], "playing")
        self.assertIsNone(state["last_round_summary"])

    def test_game_ends_when_target_reached_even_with_tie(self):
        state = self._make_state()
        state["config"]["target_score"] = 10
        for pdata in state["players"].values():
            pdata["status"] = "out"
            pdata["banked"] = True
        state["players"]["p1"]["score"] = 10
        state["players"]["p2"]["score"] = 10

        _end_round(state, "all_done")

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertCountEqual(state["winner"], ["p1", "p2"])

    def test_round_auto_advances_when_all_players_done(self):
        state = self._make_state()
        state["deck"] = [
            {"type": CARD_NUMBER, "value": 1},
            {"type": CARD_NUMBER, "value": 2},
        ]

        events, error = Flip7Game.apply_action(state, "p1", {"type": "stay"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:stay" for evt in events))
        self.assertEqual(state["current_turn"], "p2")

        events, error = Flip7Game.apply_action(state, "p2", {"type": "stay"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:round_end" for evt in events))
        self.assertTrue(any(evt["type"] == "flip7:next_round" for evt in events))
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["current_turn"], "p1")


if __name__ == "__main__":
    unittest.main()
