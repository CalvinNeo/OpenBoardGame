import unittest

from game.patchwork import END_POSITION, PATCHES_BY_ID, PatchworkGame, _board_empty_count, _maybe_finalize_game


class PatchworkGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    def test_init_sets_seat_zero_as_first_actor(self):
        state = PatchworkGame.init_game({"seed": 7}, self._players())
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(len(state["patch_circle"]), 33)
        self.assertTrue(state["special_tile_available"])

    def test_patch_catalog_matches_audited_size_cost_time_and_income(self):
        expected = {
            "patch_01": (6, 0, 3, 1),
            "patch_02": (5, 2, 3, 1),
            "patch_03": (6, 4, 2, 0),
            "patch_04": (8, 5, 3, 1),
            "patch_05": (6, 10, 5, 3),
            "patch_06": (6, 8, 6, 3),
            "patch_07": (6, 7, 4, 2),
            "patch_08": (3, 2, 2, 0),
            "patch_09": (6, 1, 5, 1),
            "patch_10": (4, 2, 2, 0),
            "patch_11": (4, 4, 2, 1),
            "patch_12": (2, 2, 1, 0),
            "patch_13": (6, 3, 6, 2),
            "patch_14": (5, 3, 4, 1),
            "patch_15": (4, 7, 6, 3),
            "patch_16": (6, 2, 1, 0),
            "patch_17": (5, 2, 2, 0),
            "patch_18": (5, 5, 4, 2),
            "patch_19": (7, 1, 4, 1),
            "patch_20": (3, 1, 3, 0),
            "patch_21": (4, 4, 6, 2),
            "patch_22": (5, 10, 3, 2),
            "patch_23": (3, 3, 1, 0),
            "patch_24": (4, 3, 3, 1),
            "patch_25": (5, 5, 5, 2),
            "patch_26": (6, 1, 2, 0),
            "patch_27": (5, 7, 1, 1),
            "patch_28": (7, 2, 3, 0),
            "patch_29": (5, 10, 4, 3),
            "patch_30": (6, 7, 2, 2),
            "patch_31": (4, 3, 2, 1),
            "patch_32": (4, 6, 5, 2),
            "patch_33": (5, 1, 2, 0),
        }
        actual = {
            patch_id: (
                patch["cell_count"],
                patch["cost_buttons"],
                patch["cost_time"],
                patch["income_buttons"],
            )
            for patch_id, patch in PATCHES_BY_ID.items()
        }
        self.assertEqual(actual, expected)

        for patch_id, patch in PATCHES_BY_ID.items():
            cells = [tuple(cell) for cell in patch["cells"]]
            with self.subTest(patch_id=patch_id):
                self.assertEqual(patch["cell_count"], len(set(cells)))
                self.assertEqual(patch["width"], max(x for x, _ in cells) + 1)
                self.assertEqual(patch["height"], max(y for _, y in cells) + 1)

    def test_advance_grants_buttons_and_turn_passes(self):
        state = PatchworkGame.init_game({"seed": 7}, self._players())
        state["players"]["p1"]["time_position"] = 0
        state["players"]["p2"]["time_position"] = 2
        state["players"]["p1"]["buttons"] = 5
        state["players"]["p1"]["arrival_order"] = 2
        state["players"]["p2"]["arrival_order"] = 1
        state["current_turn"] = "p1"

        events, error = PatchworkGame.apply_action(state, "p1", {"type": "advance"})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["time_position"], 3)
        self.assertEqual(state["players"]["p1"]["buttons"], 8)
        self.assertEqual(state["current_turn"], "p2")
        self.assertTrue(any(evt["type"] == "patchwork:advance" for evt in events))

    def test_bot_buy_patch_places_cells_and_removes_market_patch(self):
        state = PatchworkGame.init_game({"seed": 3}, self._players())
        actor = state["current_turn"]
        action = PatchworkGame.bot_move(state, actor)
        self.assertIsNotNone(action)
        self.assertEqual(action["type"], "buy_patch")
        patch_id = action["patch_id"]
        patch = PATCHES_BY_ID[patch_id]

        events, error = PatchworkGame.apply_action(state, actor, action)
        self.assertIsNone(error)
        self.assertEqual(len(state["patch_circle"]), 32)
        self.assertNotIn(patch_id, state["patch_circle"])
        self.assertGreaterEqual(state["players"][actor]["button_income"], patch["income_buttons"])
        self.assertEqual(len(state["players"][actor]["placed_patches"]), 1)
        self.assertTrue(any(evt["type"] == "patchwork:buy_patch" for evt in events))

        filled = 81 - _board_empty_count(state["players"][actor]["quilt_board"])
        self.assertEqual(filled, patch["cell_count"])

        view = PatchworkGame.get_public_view(state, actor)
        public_player = next(player for player in view["players"] if player["player_id"] == actor)
        self.assertEqual(len(public_player["placed_patches"]), 1)

    def test_claimed_leather_requires_bonus_patch_placement(self):
        state = PatchworkGame.init_game({"seed": 9}, self._players())
        state["players"]["p1"]["time_position"] = 0
        state["players"]["p2"]["time_position"] = 4
        state["players"]["p1"]["arrival_order"] = 2
        state["players"]["p2"]["arrival_order"] = 1
        state["current_turn"] = "p1"

        events, error = PatchworkGame.apply_action(state, "p1", {"type": "advance"})
        self.assertIsNone(error)
        self.assertIsNotNone(state["pending_special_patch"])
        self.assertEqual(state["pending_special_patch"]["player_id"], "p1")
        self.assertEqual(state["current_turn"], "p1")
        self.assertTrue(any(evt["type"] == "patchwork:claim_leather" for evt in events))

        events, error = PatchworkGame.apply_action(state, "p1", {"type": "place_bonus_patch", "x": 0, "y": 0})
        self.assertIsNone(error)
        self.assertIsNone(state["pending_special_patch"])
        self.assertEqual(state["players"]["p1"]["quilt_board"][0][0], "leather_5")
        self.assertEqual(state["current_turn"], "p2")
        self.assertTrue(any(evt["type"] == "patchwork:place_leather" for evt in events))

    def test_bot_places_leather_to_complete_seven_by_seven_area(self):
        state = PatchworkGame.init_game({"seed": 9}, self._players())
        board = [[f"filled_{x}_{y}" for x in range(9)] for y in range(9)]
        board[3][3] = None
        board[8][8] = None
        state["players"]["p1"]["quilt_board"] = board
        state["pending_special_patch"] = {
            "player_id": "p1",
            "remaining_target": 1,
            "position": 1,
        }

        action = PatchworkGame.bot_move(state, "p1")

        self.assertEqual(action, {"type": "place_bonus_patch", "x": 3, "y": 3})

    def test_bots_finish_a_full_game(self):
        players = [
            {"player_id": "p1", "name": "Bot 1", "seat": 0, "is_bot": True},
            {"player_id": "p2", "name": "Bot 2", "seat": 1, "is_bot": True},
        ]
        state = PatchworkGame.init_game({"seed": 4}, players)

        for _ in range(100):
            if state.get("game_over"):
                break
            actor = state["current_turn"]
            action = PatchworkGame.bot_move(state, actor)
            self.assertIsNotNone(action)
            _, error = PatchworkGame.apply_action(state, actor, action)
            self.assertIsNone(error)

        self.assertTrue(state["game_over"])
        self.assertTrue(state["winner"])

    def test_final_tie_uses_first_to_finish(self):
        state = PatchworkGame.init_game({"seed": 1}, self._players())
        for player_id in ("p1", "p2"):
            state["players"][player_id]["time_position"] = END_POSITION
            state["players"][player_id]["buttons"] = 10
            state["players"][player_id]["quilt_board"] = [[None for _ in range(9)] for _ in range(9)]
        state["first_to_finish"] = "p2"

        events = []
        _maybe_finalize_game(state, events)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p2"])
        self.assertTrue(any(evt["type"] == "patchwork:game_over" for evt in events))


if __name__ == "__main__":
    unittest.main()
