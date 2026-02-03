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


class HalliGalliRingTests(unittest.TestCase):
    def _init_game(self):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
            {"player_id": "p2", "name": "Bob", "seat": 1, "is_bot": False},
            {"player_id": "p3", "name": "Cara", "seat": 2, "is_bot": False},
        ]
        return HalliGalliGame.init_game({"flip_reveal_delay_ms": 0, "flip_wait_ms": 0}, players)

    def _card(self, fruit, count):
        return {"fruit": fruit, "count": count}

    def _set_hand(self, state, player_id, cards):
        state["players"][player_id]["hand"] = list(cards)
        state["players"][player_id]["eliminated"] = False

    def _set_pile_top(self, state, player_id, fruit, count):
        state["players"][player_id]["pile"] = [self._card(fruit, count)]
        state["players"][player_id]["eliminated"] = False

    def test_ring_success_when_fruit_total_is_five(self):
        state = self._init_game()
        self._set_hand(state, "p1", [self._card("lemon", 1)])
        self._set_hand(state, "p2", [self._card("lemon", 1)])
        self._set_hand(state, "p3", [self._card("lemon", 1)])

        self._set_pile_top(state, "p1", "banana", 3)
        self._set_pile_top(state, "p2", "banana", 2)
        self._set_pile_top(state, "p3", "cherry", 4)

        view = HalliGalliGame.get_public_view(state, "p1")
        self.assertTrue(view["bell_ready"])
        self.assertIn("banana", view["bell_fruits"])

        ringer = "p3"
        starting_hand = len(state["players"][ringer]["hand"])
        pile_total = sum(len(state["players"][pid]["pile"]) for pid in state["turn_order"])

        events, error = HalliGalliGame.apply_action(state, ringer, {"type": "ring"})
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "halli_galli:ring_success" for event in events))
        self.assertEqual(state["last_ring_result"]["result"], "success")
        self.assertIn("banana", state["last_ring_result"]["fruits"])
        self.assertEqual(sum(len(state["players"][pid]["pile"]) for pid in state["turn_order"]), 0)
        self.assertEqual(len(state["players"][ringer]["hand"]), starting_hand + pile_total)

    def test_ring_false_when_no_fruit_total_is_five(self):
        state = self._init_game()
        self._set_hand(
            state,
            "p1",
            [self._card("lemon", 1), self._card("cherry", 2), self._card("banana", 1)],
        )
        self._set_hand(state, "p2", [])
        self._set_hand(state, "p3", [])

        self._set_pile_top(state, "p1", "banana", 3)
        self._set_pile_top(state, "p2", "banana", 3)
        self._set_pile_top(state, "p3", "lemon", 1)

        view = HalliGalliGame.get_public_view(state, "p1")
        self.assertFalse(view["bell_ready"])
        self.assertEqual(view["bell_fruits"], [])

        starting_hand = len(state["players"]["p1"]["hand"])
        starting_p2 = len(state["players"]["p2"]["hand"])
        starting_p3 = len(state["players"]["p3"]["hand"])

        events, error = HalliGalliGame.apply_action(state, "p1", {"type": "ring"})
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "halli_galli:ring_false" for event in events))
        self.assertEqual(state["last_ring_result"]["result"], "false")
        self.assertEqual(state["last_action"]["penalty_given"], 2)
        self.assertEqual(state["last_ring_result"]["fruits"], ["banana"])
        self.assertEqual(len(state["players"]["p1"]["hand"]), starting_hand - 2)
        self.assertEqual(len(state["players"]["p2"]["hand"]), starting_p2 + 1)
        self.assertEqual(len(state["players"]["p3"]["hand"]), starting_p3 + 1)
