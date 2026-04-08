import unittest
from unittest.mock import patch

from game.fake_artist import FakeArtistGame, _start_drawing


class FakeArtistRoundFakeTests(unittest.TestCase):
    def _players(self):
        return [
            {"player_id": "p1", "seat": 0, "name": "A"},
            {"player_id": "p2", "seat": 1, "name": "B"},
            {"player_id": "p3", "seat": 2, "name": "C"},
            {"player_id": "p4", "seat": 3, "name": "D"},
        ]

    def test_fake_artist_changes_each_round(self):
        pick_inputs = []

        def pick_first(order):
            pick_inputs.append(list(order))
            return order[0]

        with patch("game.fake_artist._pick_fake_id", side_effect=pick_first):
            state = FakeArtistGame.init_game({"rounds": 2}, self._players())
            for pid in state["turn_order"]:
                state["players"][pid]["color"] = "#000000"
            _start_drawing(state)

            fake_round_1 = state["fake_player_id"]
            self.assertEqual(fake_round_1, "p1")
            self.assertEqual(state["players"]["p1"]["role"], "fake")

            for _ in state["turn_order"]:
                current = state["current_turn"]
                events, err = FakeArtistGame.apply_action(
                    state,
                    current,
                    {"type": "submit_stroke", "points": [[10, 10], [20, 20]]},
                )
                self.assertIsNone(err)
                self.assertTrue(events)

            self.assertEqual(state["round"], 2)
            self.assertEqual(state["fake_player_id"], "p2")
            self.assertEqual(state["players"]["p1"]["role"], "real")
            self.assertEqual(state["players"]["p2"]["role"], "fake")
            self.assertNotIn("p1", pick_inputs[1])


if __name__ == "__main__":
    unittest.main()
