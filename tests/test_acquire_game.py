import unittest

from game.acquire import AcquireGame, _can_end_game


class AcquireGameTests(unittest.TestCase):
    @staticmethod
    def _players(count=3):
        names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank"]
        return [
            {"player_id": f"p{index + 1}", "name": names[index], "seat": index}
            for index in range(count)
        ]

    def test_init_places_start_tiles_and_deals_hands(self):
        state = AcquireGame.init_game({"seed": 7}, self._players(3))
        self.assertEqual(len(state["board"]), 3)
        self.assertEqual(state["turn_stage"], "play_tile")
        self.assertEqual(len(state["turn_order"]), 3)
        for player_id in state["turn_order"]:
            self.assertEqual(len(state["players"][player_id]["hand"]), 6)
            self.assertEqual(state["players"][player_id]["money"], 6000)

    def test_founding_chain_grants_free_share(self):
        state = AcquireGame.init_game({"seed": 1}, self._players(2))
        state["board"] = {"5D": "orphan"}
        state["draw_pile"] = []
        state["turn_order"] = ["p1", "p2"]
        state["current_turn_index"] = 0
        state["current_turn"] = "p1"
        state["turn_stage"] = "play_tile"
        state["players"]["p1"]["hand"] = ["5C"]
        state["players"]["p2"]["hand"] = []

        events, error = AcquireGame.apply_action(state, "p1", {"type": "play_tile", "tile": "5C"})
        self.assertIsNone(error)
        self.assertEqual(state["pending"]["type"], "founding")

        events, error = AcquireGame.apply_action(state, "p1", {"type": "choose_chain", "chain_id": "worldwide"})
        self.assertIsNone(error)
        self.assertEqual(state["board"]["5C"], "worldwide")
        self.assertEqual(state["board"]["5D"], "worldwide")
        self.assertTrue(state["chains"]["worldwide"]["active"])
        self.assertEqual(state["players"]["p1"]["stocks"]["worldwide"], 1)
        self.assertEqual(state["turn_stage"], "buy")

    def test_merge_pays_bonus_and_trades_stock(self):
        state = AcquireGame.init_game({"seed": 1}, self._players(3))
        state["board"] = {
            "5D": "worldwide",
            "5E": "worldwide",
            "7D": "festival",
            "7E": "festival",
            "8E": "festival",
        }
        state["draw_pile"] = []
        state["turn_order"] = ["p1", "p2", "p3"]
        state["current_turn_index"] = 0
        state["current_turn"] = "p1"
        state["turn_stage"] = "play_tile"
        for player in state["players"].values():
            player["hand"] = []
            for chain_id in player["stocks"]:
                player["stocks"][chain_id] = 0
            player["money"] = 6000
        state["players"]["p1"]["hand"] = ["6D"]
        state["players"]["p1"]["stocks"]["worldwide"] = 3
        state["players"]["p2"]["stocks"]["worldwide"] = 2
        state["players"]["p3"]["stocks"]["festival"] = 1
        state["chains"]["worldwide"]["active"] = True
        state["chains"]["festival"]["active"] = True
        state["chains"]["worldwide"]["size"] = 2
        state["chains"]["festival"]["size"] = 3

        events, error = AcquireGame.apply_action(state, "p1", {"type": "play_tile", "tile": "6D"})
        self.assertIsNone(error)
        self.assertEqual(state["pending"]["type"], "merge")
        self.assertEqual(state["pending"]["acquirer"], "festival")

        bonus_events = [event for event in events if event["type"] == "acquire:bonus_paid"]
        self.assertTrue(bonus_events)
        self.assertEqual(state["players"]["p1"]["money"], 8000)
        self.assertEqual(state["players"]["p2"]["money"], 7000)

        events, error = AcquireGame.apply_action(state, "p1", {"type": "dispose_stock", "sell": 1, "trade": 1, "hold": 0})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["stocks"]["festival"], 1)
        self.assertEqual(state["players"]["p1"]["money"], 8200)

        events, error = AcquireGame.apply_action(state, "p2", {"type": "dispose_stock", "sell": 2, "trade": 0, "hold": 0})
        self.assertIsNone(error)
        self.assertIsNone(state["pending"])
        self.assertEqual(state["board"]["6D"], "festival")
        self.assertEqual(state["board"]["5D"], "festival")
        self.assertEqual(state["turn_stage"], "buy")

    def test_safe_merge_tile_is_dead(self):
        state = AcquireGame.init_game({"seed": 1}, self._players(2))
        state["draw_pile"] = []
        state["turn_order"] = ["p1", "p2"]
        state["current_turn_index"] = 0
        state["current_turn"] = "p1"
        state["turn_stage"] = "play_tile"
        state["players"]["p1"]["hand"] = ["6A"]
        state["players"]["p2"]["hand"] = []
        state["board"] = {}
        for column in range(1, 6):
            state["board"][f"{column}A"] = "worldwide"
            state["board"][f"{column}B"] = "worldwide"
            state["board"][f"{column}C"] = "worldwide"
            state["board"][f"{column}D"] = "worldwide"
        for column in range(7, 11):
            state["board"][f"{column}A"] = "festival"
            state["board"][f"{column}B"] = "festival"
            state["board"][f"{column}C"] = "festival"
        state["chains"]["worldwide"]["active"] = True
        state["chains"]["festival"]["active"] = True
        state["chains"]["worldwide"]["size"] = 20
        state["chains"]["worldwide"]["safe"] = True
        state["chains"]["festival"]["size"] = 12
        state["chains"]["festival"]["safe"] = True

        events, error = AcquireGame.apply_action(state, "p1", {"type": "play_tile", "tile": "6A"})
        self.assertEqual(events, [])
        self.assertEqual(error, "tile cannot be played")

    def test_end_game_scores_richest_player(self):
        state = AcquireGame.init_game({"seed": 1}, self._players(2))
        state["turn_order"] = ["p1", "p2"]
        state["current_turn"] = "p1"
        state["turn_stage"] = "end_turn"
        state["pending"] = None
        state["players"]["p1"]["money"] = 5000
        state["players"]["p2"]["money"] = 4000
        state["players"]["p1"]["stocks"]["worldwide"] = 3
        state["players"]["p2"]["stocks"]["worldwide"] = 1
        state["chains"]["worldwide"]["active"] = True
        state["chains"]["worldwide"]["size"] = 41
        state["chains"]["worldwide"]["safe"] = True

        self.assertTrue(_can_end_game(state))
        events, error = AcquireGame.apply_action(state, "p1", {"type": "end_turn", "declare_end": True})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])
        self.assertTrue(any(event["type"] == "acquire:game_over" for event in events))


if __name__ == "__main__":
    unittest.main()
