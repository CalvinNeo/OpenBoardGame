import unittest

from game.azul import AzulGame


class AzulGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    def test_rejects_placing_color_into_row_when_color_already_on_wall_row(self):
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p1"
        state["factories"] = [["blue", "blue", "red", "yellow"]] + [[] for _ in range(4)]
        state["center"] = []
        state["players"]["p1"]["wall"][0][0] = True

        _, error = AzulGame.apply_action(
            state,
            "p1",
            {
                "type": "take_tiles",
                "source": "factory",
                "source_index": 0,
                "color": "blue",
                "target_row": 0,
            },
        )

        self.assertEqual(error, "color already on wall")
        self.assertEqual(state["factories"][0].count("blue"), 2)
        self.assertEqual(state["players"]["p1"]["pattern_lines"][0]["tiles"], [])

    def test_can_still_take_same_color_to_floor(self):
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p1"
        state["factories"] = [["blue", "blue", "red", "yellow"]] + [[] for _ in range(4)]
        state["center"] = []
        state["players"]["p1"]["wall"][0][0] = True

        _, error = AzulGame.apply_action(
            state,
            "p1",
            {
                "type": "take_tiles",
                "source": "factory",
                "source_index": 0,
                "color": "blue",
                "target_row": -1,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["floor"].count("blue"), 2)


if __name__ == "__main__":
    unittest.main()
