import unittest
import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parent.parent / "game" / "isle_of_skye.py"
MODULE_SPEC = importlib.util.spec_from_file_location("isle_of_skye_test_module", MODULE_PATH)
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
assert MODULE_SPEC is not None and MODULE_SPEC.loader is not None
MODULE_SPEC.loader.exec_module(MODULE)
IsleOfSkyeGame = MODULE.IsleOfSkyeGame
_find_legal_placement = MODULE._find_legal_placement


class IsleOfSkyeGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    def test_init_starts_round_with_income_and_drawn_tiles(self):
        state = IsleOfSkyeGame.init_game({"seed": 7}, self._players())

        self.assertEqual(state["phase"], "price_secret")
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["buy_order"], ["p1", "p2"])
        self.assertEqual(state["current_turn"], None)
        self.assertEqual(len(state["bag"]), 67)

        for player_id in ("p1", "p2"):
            player_state = state["players"][player_id]
            self.assertEqual(player_state["gold"], 5)
            self.assertEqual(player_state["score"], 0)
            self.assertEqual(len(player_state["territory"]), 1)
            self.assertEqual(len(player_state["round"]["drawn_tile_ids"]), 3)

    def test_pricing_is_hidden_until_all_players_submit(self):
        state = IsleOfSkyeGame.init_game({"seed": 3}, self._players())

        p1_drawn = list(state["players"]["p1"]["round"]["drawn_tile_ids"])
        events, error = IsleOfSkyeGame.apply_action(
            state,
            "p1",
            {
                "type": "submit_prices",
                "discard_tile_id": p1_drawn[2],
                "priced_tiles": [
                    {"tile_id": p1_drawn[0], "price": 1},
                    {"tile_id": p1_drawn[1], "price": 2},
                ],
            },
        )
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "isle_of_skye:submit_prices" for event in events))
        self.assertEqual(state["phase"], "price_secret")

        bob_view = IsleOfSkyeGame.get_public_view(state, "p2")
        alice_public = next(player for player in bob_view["players"] if player["player_id"] == "p1")
        self.assertEqual(alice_public["drawn_tile_ids"], [])
        self.assertEqual(alice_public["sale_tiles"], [])

        p2_drawn = list(state["players"]["p2"]["round"]["drawn_tile_ids"])
        events, error = IsleOfSkyeGame.apply_action(
            state,
            "p2",
            {
                "type": "submit_prices",
                "discard_tile_id": p2_drawn[2],
                "priced_tiles": [
                    {"tile_id": p2_drawn[0], "price": 1},
                    {"tile_id": p2_drawn[1], "price": 1},
                ],
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "buy")
        self.assertEqual(state["current_turn"], "p1")

        bob_view = IsleOfSkyeGame.get_public_view(state, "p2")
        alice_public = next(player for player in bob_view["players"] if player["player_id"] == "p1")
        self.assertEqual(len(alice_public["sale_tiles"]), 2)

    def test_buy_pass_then_build_advances_to_next_round(self):
        state = IsleOfSkyeGame.init_game({"seed": 9}, self._players())

        for player_id in ("p1", "p2"):
            drawn = list(state["players"][player_id]["round"]["drawn_tile_ids"])
            events, error = IsleOfSkyeGame.apply_action(
                state,
                player_id,
                {
                    "type": "submit_prices",
                    "discard_tile_id": drawn[2],
                    "priced_tiles": [
                        {"tile_id": drawn[0], "price": 1},
                        {"tile_id": drawn[1], "price": 1},
                    ],
                },
            )
            self.assertIsNone(error)

        events, error = IsleOfSkyeGame.apply_action(state, "p1", {"type": "pass_buy"})
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")

        events, error = IsleOfSkyeGame.apply_action(state, "p2", {"type": "pass_buy"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "build")

        for player_id in ("p1", "p2"):
            while state["phase"] == "build" and not state["players"][player_id]["round"]["build_done"]:
                tile_id = state["players"][player_id]["round"]["build_queue"][0]
                placement = _find_legal_placement(state["players"][player_id], tile_id)
                if placement:
                    events, error = IsleOfSkyeGame.apply_action(
                        state,
                        player_id,
                        {"type": "place_tile", "tile_id": tile_id, **placement},
                    )
                else:
                    events, error = IsleOfSkyeGame.apply_action(
                        state,
                        player_id,
                        {"type": "return_tile", "tile_id": tile_id},
                    )
                self.assertIsNone(error)

        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "price_secret")
        self.assertIsNotNone(state["last_scoring"])

    def test_bots_can_finish_a_full_game(self):
        players = [
            {"player_id": "p1", "name": "Bot A", "seat": 0, "is_bot": True},
            {"player_id": "p2", "name": "Bot B", "seat": 1, "is_bot": True},
        ]
        state = IsleOfSkyeGame.init_game({"seed": 5}, players)

        for _ in range(400):
            if state.get("game_over"):
                break
            progressed = False
            for player_id in ("p1", "p2"):
                action = IsleOfSkyeGame.bot_move(state, player_id)
                if not action:
                    continue
                action = dict(action)
                action.pop("delay_ms", None)
                events, error = IsleOfSkyeGame.apply_action(state, player_id, action)
                self.assertIsNone(error)
                progressed = True
                break
            self.assertTrue(progressed, "Bot loop stalled before the game finished.")

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "ended")
        self.assertTrue(state["winner"])
        self.assertIsNotNone(state["final_scoring"])
        for player_id in ("p1", "p2"):
            self.assertIn("final_score", state["final_scoring"][player_id])


if __name__ == "__main__":
    unittest.main()
