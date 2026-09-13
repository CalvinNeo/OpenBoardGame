import random
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

    def test_bot_finishes_nearly_complete_pattern_line(self):
        random.seed(1)
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p1"
        state["factories"] = [
            ["red", "blue", "yellow", "black"],
            ["white", "blue", "yellow", "black"],
            [],
            [],
            [],
        ]
        state["center"] = []
        state["players"]["p1"]["pattern_lines"][0] = {"color": "white", "tiles": ["white"]}
        state["players"]["p1"]["pattern_lines"][4] = {"color": "red", "tiles": ["red"] * 4}

        action = AzulGame.bot_move(state, "p1")

        self.assertEqual(action["color"], "red")
        self.assertEqual(action["target_row"], 4)

    def test_bot_avoids_overflow_when_same_tiles_fit_an_empty_line(self):
        random.seed(2)
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p1"
        state["factories"] = [["yellow", "yellow", "yellow", "blue"], [], [], [], []]
        state["center"] = []
        state["players"]["p1"]["pattern_lines"][1] = {"color": "yellow", "tiles": ["yellow"]}

        action = AzulGame.bot_move(state, "p1")

        self.assertEqual(action["color"], "yellow")
        self.assertEqual(action["target_row"], 2)

    def test_bot_search_does_not_consume_game_randomness(self):
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p1"
        state["factories"] = [["blue", "red", "yellow", "black"], [], [], [], []]
        state["center"] = []
        state["bag"] = []
        state["discard"] = ["white", "blue", "red", "yellow", "black"] * 4
        random.seed(99)
        random_state = random.getstate()

        action = AzulGame.bot_move(state, "p1")

        self.assertIsNotNone(action)
        self.assertEqual(random.getstate(), random_state)

    def test_bots_finish_a_full_game(self):
        random.seed(7)
        players = [
            {"player_id": "p1", "name": "Bot 1", "seat": 0, "is_bot": True},
            {"player_id": "p2", "name": "Bot 2", "seat": 1, "is_bot": True},
        ]
        state = AzulGame.init_game({}, players)

        for _ in range(200):
            if state.get("game_over"):
                break
            actor = state["current_turn"]
            action = AzulGame.bot_move(state, actor)
            self.assertIsNotNone(action)
            _, error = AzulGame.apply_action(state, actor, action)
            self.assertIsNone(error)

        self.assertTrue(state["game_over"])
        self.assertTrue(state["winner"])


if __name__ == "__main__":
    unittest.main()
