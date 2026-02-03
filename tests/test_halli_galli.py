import unittest

from game.halli_galli import HalliGalliGame


class HalliGalliFlipWaitTests(unittest.TestCase):
    def _init_game(self, config=None):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
            {"player_id": "p2", "name": "Bob", "seat": 1, "is_bot": False},
        ]
        return HalliGalliGame.init_game(config or {}, players)

    def test_flip_wait_blocks_flip(self):
        state = self._init_game({"flip_wait_ms": 5000, "flip_reveal_delay_ms": 0})
        first_player = state["current_turn"]
        _, error = HalliGalliGame.apply_action(state, first_player, {"type": "flip"})
        self.assertIsNone(error)

        next_player = state["current_turn"]
        actions = HalliGalliGame.get_legal_actions(state, next_player)
        self.assertIn("ring", actions)
        self.assertNotIn("flip", actions)

        _, error = HalliGalliGame.apply_action(state, next_player, {"type": "flip"})
        self.assertEqual(error, "wait to flip")

    def test_flip_wait_allows_flip_after_ready(self):
        state = self._init_game({"flip_wait_ms": 5000, "flip_reveal_delay_ms": 0})
        first_player = state["current_turn"]
        _, error = HalliGalliGame.apply_action(state, first_player, {"type": "flip"})
        self.assertIsNone(error)

        next_player = state["current_turn"]
        state["flip_ready_at_ms"] = 0
        actions = HalliGalliGame.get_legal_actions(state, next_player)
        self.assertIn("flip", actions)
