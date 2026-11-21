import json
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

    def test_first_center_pick_records_next_round_starter(self):
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p2"
        state["factories"] = [["yellow"]] + [[] for _ in range(4)]
        state["center"] = ["blue", "red"]

        _, error = AzulGame.apply_action(
            state,
            "p2",
            {
                "type": "take_tiles",
                "source": "center",
                "color": "blue",
                "target_row": 0,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["next_start_player"], "p2")
        self.assertEqual(state["current_turn"], "p1")
        self.assertFalse(state["first_player_token_in_center"])
        self.assertTrue(state["players"]["p2"]["has_first_player_token"])
        self.assertEqual(state["players"]["p2"]["floor"], ["first_player"])

        _, error = AzulGame.apply_action(
            state,
            "p1",
            {
                "type": "take_tiles",
                "source": "center",
                "color": "red",
                "target_row": 0,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["next_start_player"], "p2")
        self.assertFalse(state["players"]["p1"]["has_first_player_token"])

    def test_token_holder_starts_next_round_after_save_and_load(self):
        for player_count in (2, 3, 4):
            players = self._players() + [
                {"player_id": "p3", "name": "Carol", "seat": 2},
                {"player_id": "p4", "name": "Dave", "seat": 3},
            ]
            players = players[:player_count]
            for holder_index in range(player_count):
                for floor_full in (False, True):
                    with self.subTest(
                        player_count=player_count,
                        holder_index=holder_index,
                        floor_full=floor_full,
                    ):
                        state = AzulGame.init_game({}, players)
                        holder_id = players[holder_index]["player_id"]
                        following_id = players[(holder_index + 1) % player_count]["player_id"]
                        state["current_turn"] = holder_id
                        state["factories"] = [["red"]] + [
                            [] for _ in state["factories"][1:]
                        ]
                        state["center"] = ["blue"]
                        if floor_full:
                            state["players"][holder_id]["floor"] = ["yellow"] * 7

                        _, error = AzulGame.apply_action(
                            state,
                            holder_id,
                            {
                                "type": "take_tiles",
                                "source": "center",
                                "color": "blue",
                                "target_row": 0,
                            },
                        )
                        self.assertIsNone(error)
                        self.assertEqual(state["current_turn"], following_id)
                        state = AzulGame.deserialize(json.loads(json.dumps(AzulGame.serialize(state))))

                        _, error = AzulGame.apply_action(
                            state,
                            following_id,
                            {
                                "type": "take_tiles",
                                "source": "factory",
                                "source_index": 0,
                                "color": "red",
                                "target_row": 0,
                            },
                        )

                        self.assertIsNone(error)
                        self.assertEqual(state["round"], 2)
                        self.assertEqual(state["current_turn"], holder_id)
                        self.assertIsNone(state["next_start_player"])
                        self.assertTrue(state["first_player_token_in_center"])
                        for player in players:
                            player_id = player["player_id"]
                            view = AzulGame.get_public_view(state, player_id)
                            self.assertEqual(view["current_turn"], holder_id)
                            self.assertEqual(
                                view["legal_actions"],
                                ["take_tiles"] if player_id == holder_id else [],
                            )
                            self.assertFalse(state["players"][player_id]["has_first_player_token"])
                            self.assertEqual(state["players"][player_id]["floor"], [])

                        _, error = AzulGame.apply_action(
                            state,
                            holder_id,
                            {
                                "type": "take_tiles",
                                "source": "factory",
                                "source_index": 0,
                                "color": state["factories"][0][0],
                                "target_row": -1,
                            },
                        )
                        self.assertIsNone(error)
                        self.assertEqual(state["current_turn"], following_id)

    def test_token_claimed_on_last_draft_starts_next_round(self):
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p2"
        state["factories"] = [[] for _ in state["factories"]]
        state["center"] = ["blue"]

        _, error = AzulGame.apply_action(
            state,
            "p2",
            {
                "type": "take_tiles",
                "source": "center",
                "color": "blue",
                "target_row": 0,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["current_turn"], "p2")

    def test_round_resolution_recovers_starter_from_floor_token(self):
        state = AzulGame.init_game({}, self._players())
        state["current_turn"] = "p1"
        state["factories"] = [["red"]] + [[] for _ in range(4)]
        state["center"] = []
        state["first_player_token_in_center"] = False
        state["players"]["p2"]["floor"] = ["first_player"]
        state["players"]["p2"].pop("has_first_player_token")

        _, error = AzulGame.apply_action(
            state,
            "p1",
            {
                "type": "take_tiles",
                "source": "factory",
                "source_index": 0,
                "color": "red",
                "target_row": 0,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["current_turn"], "p2")
        self.assertFalse(state["players"]["p2"]["has_first_player_token"])
        self.assertEqual(state["players"]["p2"]["floor"], [])
        self.assertNotIn("first_player", state["discard"])

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
                "wall_points_by_round": [{"round": 1, "points": 1}],
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
                "wall_points_by_round": [],
                "floor_penalty": 0,
                "floor_clamp": 0,
                "row_bonus": 10,
                "column_bonus": 35,
                "color_bonus": 50,
            },
        )

    def test_score_breakdown_lists_wall_points_for_each_round(self):
        state = AzulGame.init_game({}, self._players())
        pdata = state["players"]["p1"]
        pdata["pattern_lines"][0] = {"color": "blue", "tiles": ["blue"]}
        _resolve_round(state)

        state["round"] = 2
        pdata["pattern_lines"][1] = {"color": "yellow", "tiles": ["yellow", "yellow"]}
        _resolve_round(state)

        self.assertEqual(
            pdata["score_breakdown"]["wall_points_by_round"],
            [{"round": 1, "points": 1}, {"round": 2, "points": 1}],
        )
        public_player = AzulGame.get_public_view(state, "p1")["players"][0]
        self.assertEqual(
            public_player["score_breakdown"]["wall_points_by_round"],
            [{"round": 1, "points": 1}, {"round": 2, "points": 1}],
        )

    def test_legacy_score_breakdown_keeps_wall_total_and_marks_missing_rounds(self):
        state = AzulGame.init_game({}, self._players())
        pdata = state["players"]["p1"]
        pdata["score"] = 8
        pdata["score_breakdown"] = {
            "wall_points": 8,
            "floor_penalty": 0,
            "floor_clamp": 0,
            "row_bonus": 0,
            "column_bonus": 0,
            "color_bonus": 0,
        }

        public_player = AzulGame.get_public_view(state, "p1")["players"][0]
        self.assertEqual(public_player["score_breakdown"]["wall_points_by_round"], [])
        self.assertTrue(public_player["score_breakdown"]["legacy"])


if __name__ == "__main__":
    unittest.main()
