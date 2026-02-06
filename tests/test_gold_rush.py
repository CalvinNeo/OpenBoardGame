import unittest

from game.gold_rush import GoldRushGame, _finalize_game


class GoldRushGameTests(unittest.TestCase):
    def _make_state(self, mode="classic"):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]
        state = GoldRushGame.init_game({"mode": mode}, players)
        state["deck"] = []
        for pdata in state["players"].values():
            pdata["hand"] = []
        return state

    def test_scoring_distribution(self):
        state = self._make_state()
        mine = state["mines"][0]
        mine["gold"] = [{"type": "gold", "value": 6}, {"type": "gold", "value": 4}]
        mine["tokens"] = {"p1": 2, "p2": 1}
        _finalize_game(state)
        self.assertEqual(state["players"]["p1"]["score"], 6)
        self.assertEqual(state["players"]["p2"]["score"], 3)
        breakdown = state["score_breakdown"][0]
        self.assertEqual(breakdown["share"], 3)
        self.assertEqual(breakdown["remainder"], 1)

    def test_two_player_setup_removes_mines(self):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]
        state = GoldRushGame.init_game({"mode": "hand"}, players)
        mine_ids = [mine["id"] for mine in state["mines"]]
        self.assertEqual(mine_ids, [0, 1, 2])
        all_cards = list(state["deck"])
        for pdata in state["players"].values():
            all_cards.extend(pdata["hand"])
        miner_counts = {}
        for card in all_cards:
            if card.get("type") == "miner":
                miner_counts[card.get("mine_id")] = miner_counts.get(card.get("mine_id"), 0) + 1
        self.assertEqual(miner_counts.get(3, 0), 0)
        self.assertEqual(miner_counts.get(4, 0), 0)
        self.assertEqual(miner_counts.get(0, 0), 10)
        self.assertEqual(miner_counts.get(1, 0), 10)
        self.assertEqual(miner_counts.get(2, 0), 10)

    def test_hand_mode_endgame(self):
        state = self._make_state(mode="hand")
        state["players"]["p1"]["hand"] = [{"type": "miner", "mine_id": 0}]
        state["players"]["p2"]["hand"] = [{"type": "miner", "mine_id": 1}]
        state["players"]["p1"]["tokens_available"] = 0
        state["players"]["p2"]["tokens_available"] = 0
        state["current_turn"] = "p1"
        state["phase"] = "turn"

        events, error = GoldRushGame.apply_action(state, "p1", {"type": "play_card", "hand_index": 0})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "p2")
        self.assertTrue(any(evt["type"] == "gold_rush:play_card" for evt in events))

        events, error = GoldRushGame.apply_action(state, "p2", {"type": "play_card", "hand_index": 0})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")

    def test_burn_gold_when_full(self):
        state = self._make_state(mode="hand")
        for mine in state["mines"]:
            mine["gold"] = [{"type": "gold", "value": 0}] * state["max_gold_cards"]
        current = state["current_turn"]
        state["players"][current]["hand"] = [{"type": "gold", "value": 5}]

        events, error = GoldRushGame.apply_action(state, current, {"type": "play_card", "hand_index": 0})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "gold_rush:burn_gold" for evt in events))
        self.assertEqual(len(state["mines"][0]["gold"]), state["max_gold_cards"])

    def test_tie_breaker_unused_tokens(self):
        state = self._make_state()
        state["players"]["p1"]["tokens_available"] = 2
        state["players"]["p2"]["tokens_available"] = 1
        _finalize_game(state)
        self.assertEqual(state["winner"], ["p1"])


if __name__ == "__main__":
    unittest.main()
