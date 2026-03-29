import unittest

from game.davinci_code import DaVinciCodeGame, _build_tile


def _players(count: int):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": False,
        }
        for index in range(count)
    ]


class DaVinciCodeGameTests(unittest.TestCase):
    def test_public_view_hides_opponent_unrevealed_tiles(self):
        state = DaVinciCodeGame.init_game({"mode": "standard"}, _players(2))
        state["draw_pile"] = []
        state["phase"] = "guess"
        state["current_turn"] = "p1"
        state["turn_drawn"] = True
        state["players"]["p1"]["rack"] = [
            {"tile": _build_tile("dark", 1, False), "revealed": False},
        ]
        state["players"]["p2"]["rack"] = [
            {"tile": _build_tile("light", 7, False), "revealed": False},
        ]
        state["players"]["p1"]["pending_tile"] = None
        state["players"]["p2"]["pending_tile"] = None

        p1_view = DaVinciCodeGame.get_public_view(state, "p1")
        p2_from_p1 = next(player for player in p1_view["players"] if player["player_id"] == "p2")

        self.assertFalse(p2_from_p1["tiles"][0]["face_visible"])
        self.assertEqual(p2_from_p1["tiles"][0]["label"], "#1")

    def test_wrong_guess_reveals_drawn_tile_and_advances_turn(self):
        state = DaVinciCodeGame.init_game({"mode": "standard"}, _players(2))
        state["draw_pile"] = []
        state["phase"] = "guess"
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        state["turn_drawn"] = True
        state["players"]["p1"]["rack"] = [
            {"tile": _build_tile("dark", 0, False), "revealed": False},
        ]
        state["players"]["p1"]["pending_tile"] = _build_tile("light", 5, False)
        state["players"]["p2"]["rack"] = [
            {"tile": _build_tile("dark", 3, False), "revealed": False},
            {"tile": _build_tile("light", 9, False), "revealed": False},
        ]
        state["players"]["p2"]["pending_tile"] = None

        _, error = DaVinciCodeGame.apply_action(
            state,
            "p1",
            {
                "type": "guess_tile",
                "target_player_id": "p2",
                "target_index": 0,
                "declared_color": "light",
                "declared_value": 7,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["turn_number"], 2)
        self.assertIsNone(state["players"]["p1"]["pending_tile"])
        self.assertEqual(len(state["players"]["p1"]["rack"]), 2)
        self.assertTrue(state["players"]["p1"]["rack"][1]["revealed"])
        self.assertEqual(state["players"]["p1"]["rack"][1]["tile"]["value"], 5)

    def test_correct_guess_then_stop_keeps_drawn_tile_hidden(self):
        state = DaVinciCodeGame.init_game({"mode": "standard"}, _players(2))
        state["draw_pile"] = []
        state["phase"] = "guess"
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        state["turn_drawn"] = True
        state["players"]["p1"]["rack"] = [
            {"tile": _build_tile("dark", 0, False), "revealed": False},
        ]
        state["players"]["p1"]["pending_tile"] = _build_tile("light", 5, False)
        state["players"]["p2"]["rack"] = [
            {"tile": _build_tile("dark", 3, False), "revealed": False},
            {"tile": _build_tile("light", 9, False), "revealed": False},
        ]
        state["players"]["p2"]["pending_tile"] = None

        _, error = DaVinciCodeGame.apply_action(
            state,
            "p1",
            {
                "type": "guess_tile",
                "target_player_id": "p2",
                "target_index": 0,
                "declared_color": "dark",
                "declared_value": 3,
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "choose_continue")
        self.assertTrue(state["players"]["p2"]["rack"][0]["revealed"])

        _, error = DaVinciCodeGame.apply_action(state, "p1", {"type": "stop_turn"})
        self.assertIsNone(error)

        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["turn_number"], 2)
        self.assertIsNone(state["players"]["p1"]["pending_tile"])
        self.assertEqual(len(state["players"]["p1"]["rack"]), 2)
        self.assertFalse(state["players"]["p1"]["rack"][1]["revealed"])
        self.assertEqual(state["players"]["p1"]["rack"][1]["tile"]["value"], 5)

    def test_empty_deck_wrong_guess_forces_self_reveal_and_can_lose(self):
        state = DaVinciCodeGame.init_game({"mode": "standard"}, _players(2))
        state["draw_pile"] = []
        state["phase"] = "guess"
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        state["turn_drawn"] = True
        state["players"]["p1"]["rack"] = [
            {"tile": _build_tile("dark", 0, False), "revealed": False},
        ]
        state["players"]["p1"]["pending_tile"] = None
        state["players"]["p2"]["rack"] = [
            {"tile": _build_tile("dark", 3, False), "revealed": False},
        ]
        state["players"]["p2"]["pending_tile"] = None

        _, error = DaVinciCodeGame.apply_action(
            state,
            "p1",
            {
                "type": "guess_tile",
                "target_player_id": "p2",
                "target_index": 0,
                "declared_color": "light",
                "declared_value": 7,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "choose_self_reveal")

        _, error = DaVinciCodeGame.apply_action(state, "p1", {"type": "reveal_own_tile", "tile_index": 0})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winners"], ["p2"])
        self.assertTrue(state["players"]["p1"]["eliminated"])

    def test_advanced_mode_requires_setup_for_initial_dash_and_manual_insert(self):
        state = DaVinciCodeGame.init_game({"mode": "advanced"}, _players(2))
        state["phase"] = "setup"
        state["current_turn"] = None
        state["turn_drawn"] = False
        state["draw_pile"] = []
        state["players"]["p1"]["setup_tiles"] = [
            _build_tile("dark", 3, False),
            _build_tile("light", 6, False),
            _build_tile("dark", None, True),
        ]
        state["players"]["p1"]["rack"] = []
        state["players"]["p1"]["pending_tile"] = None
        state["players"]["p2"]["setup_tiles"] = []
        state["players"]["p2"]["rack"] = [
            {"tile": _build_tile("light", 8, False), "revealed": False},
        ]
        state["players"]["p2"]["pending_tile"] = None

        _, error = DaVinciCodeGame.apply_action(
            state,
            "p1",
            {
                "type": "arrange_initial_tiles",
                "ordered_tile_ids": ["light-6", "dark-3", "dark-dash"],
            },
        )
        self.assertEqual(error, "invalid setup order")

        _, error = DaVinciCodeGame.apply_action(
            state,
            "p1",
            {
                "type": "arrange_initial_tiles",
                "ordered_tile_ids": ["dark-3", "dark-dash", "light-6"],
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "guess")
        self.assertEqual([entry["tile"]["id"] for entry in state["players"]["p1"]["rack"]], ["dark-3", "dark-dash", "light-6"])

        state["phase"] = "choose_continue"
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        state["turn_drawn"] = True
        state["players"]["p1"]["pending_tile"] = _build_tile("light", 5, False)

        _, error = DaVinciCodeGame.apply_action(state, "p1", {"type": "stop_turn"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "place_pending_hidden")

        _, error = DaVinciCodeGame.apply_action(state, "p1", {"type": "insert_pending_tile", "insert_index": 2})
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(
            [entry["tile"]["id"] for entry in state["players"]["p1"]["rack"]],
            ["dark-3", "dark-dash", "light-5", "light-6"],
        )


if __name__ == "__main__":
    unittest.main()
