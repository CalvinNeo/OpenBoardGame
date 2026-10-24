import random
import unittest

from game.azul import AzulGame, _apply_end_game_bonuses, _resolve_round


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

    def test_score_breakdown_tracks_wall_points_and_floor_penalties(self):
        state = AzulGame.init_game({}, self._players())
        pdata = state["players"]["p1"]
        pdata["score"] = 10
        pdata["score_breakdown"]["wall_points"] = 10
        pdata["pattern_lines"][0] = {"color": "blue", "tiles": ["blue"]}
        pdata["floor"] = ["red"]
        state["factories"] = [[] for _ in range(5)]
        state["center"] = []

        _resolve_round(state)

        self.assertEqual(pdata["score"], 10)
        self.assertEqual(
            pdata["score_breakdown"],
            {
                "wall_points": 11,
                "floor_penalty": -1,
                "floor_clamp": 0,
                "row_bonus": 0,
                "column_bonus": 0,
                "color_bonus": 0,
            },
        )
        public_player = AzulGame.get_public_view(state, "p1")["players"][0]
        self.assertEqual(public_player["score_breakdown"]["total"], 10)
        self.assertEqual(public_player["score_breakdown"]["pending_floor_penalty"], 0)

    def test_score_breakdown_tracks_end_game_bonuses(self):
        state = AzulGame.init_game({}, self._players())
        state["players"]["p1"]["wall"] = [[True] * 5 for _ in range(5)]

        _apply_end_game_bonuses(state)

        self.assertEqual(state["players"]["p1"]["score"], 95)
        self.assertEqual(
            state["players"]["p1"]["score_breakdown"],
            {
                "wall_points": 0,
                "floor_penalty": 0,
                "floor_clamp": 0,
                "row_bonus": 10,
                "column_bonus": 35,
                "color_bonus": 50,
            },
        )


if __name__ == "__main__":
    unittest.main()
