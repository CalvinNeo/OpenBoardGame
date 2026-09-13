import copy
import random
import unittest

from game.carcassonne import CarcassonneGame, _coord_key


class CarcassonneGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    def _city_cap_state(self):
        random.seed(1)
        state = CarcassonneGame.init_game({}, self._players())
        state["board"] = {
            _coord_key(0, 0): {
                "id": "base",
                "type": "city1",
                "rotation": 0,
                "meeple": None,
            }
        }
        state["pending_tile"] = {"id": "next", "type": "city1"}
        state["phase"] = "place_tile"
        state["current_turn"] = "p1"
        state["last_placed"] = None
        return state

    def test_bot_closes_and_claims_an_available_city(self):
        state = self._city_cap_state()

        tile_action = CarcassonneGame.bot_move(state, "p1")

        self.assertEqual(
            tile_action,
            {"type": "place_tile", "x": 0, "y": -1, "rotation": 180},
        )
        _, error = CarcassonneGame.apply_action(state, "p1", tile_action)
        self.assertIsNone(error)

        meeple_action = CarcassonneGame.bot_move(state, "p1")
        self.assertEqual(
            meeple_action,
            {"type": "place_meeple", "feature": "city", "segment": 0},
        )
        _, error = CarcassonneGame.apply_action(state, "p1", meeple_action)

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["score"], 4)
        self.assertEqual(state["players"]["p1"]["meeples"], 7)

    def test_bot_completes_own_city_instead_of_opponents_city(self):
        state = self._city_cap_state()
        state["board"] = {
            _coord_key(0, 0): {
                "id": "own-city",
                "type": "city1",
                "rotation": 0,
                "meeple": {"player_id": "p1", "feature": "city", "segment": 0},
            },
            _coord_key(1, 0): {
                "id": "bridge",
                "type": "cloister",
                "rotation": 0,
                "meeple": None,
            },
            _coord_key(2, 0): {
                "id": "opponent-city",
                "type": "city1",
                "rotation": 0,
                "meeple": {"player_id": "p2", "feature": "city", "segment": 0},
            },
        }
        state["players"]["p1"]["meeples"] = 6
        state["players"]["p2"]["meeples"] = 6

        action = CarcassonneGame.bot_move(state, "p1")

        self.assertEqual(action["x"], 0)
        self.assertEqual(action["y"], -1)
        self.assertEqual(action["rotation"], 180)

    def test_bot_search_does_not_mutate_board(self):
        state = self._city_cap_state()
        board_before = copy.deepcopy(state["board"])

        action = CarcassonneGame.bot_move(state, "p1")

        self.assertIsNotNone(action)
        self.assertEqual(state["board"], board_before)
        self.assertEqual(state["phase"], "place_tile")
        self.assertEqual(state["pending_tile"], {"id": "next", "type": "city1"})

    def test_bots_finish_a_full_game_and_use_meeples(self):
        random.seed(7)
        players = [
            {"player_id": "p1", "name": "Bot 1", "seat": 0, "is_bot": True},
            {"player_id": "p2", "name": "Bot 2", "seat": 1, "is_bot": True},
        ]
        state = CarcassonneGame.init_game({}, players)
        meeple_actions = 0

        for _ in range(200):
            if state.get("game_over"):
                break
            actor = state["current_turn"]
            action = CarcassonneGame.bot_move(state, actor)
            self.assertIsNotNone(action)
            if action["type"] == "place_meeple":
                meeple_actions += 1
            _, error = CarcassonneGame.apply_action(state, actor, action)
            self.assertIsNone(error)

        self.assertTrue(state["game_over"])
        self.assertTrue(state["winner"])
        self.assertGreater(meeple_actions, 0)


if __name__ == "__main__":
    unittest.main()
