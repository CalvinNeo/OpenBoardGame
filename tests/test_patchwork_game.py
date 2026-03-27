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
