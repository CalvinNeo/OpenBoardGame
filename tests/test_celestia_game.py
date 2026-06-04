import unittest

from game.celestia import CelestiaGame


class CelestiaGameTests(unittest.TestCase):
    def _players(self, count=3):
        names = ["Alice", "Bob", "Caro", "Drew", "Eli", "Faye"]
        return [
            {"player_id": f"p{i+1}", "name": names[i], "seat": i}
            for i in range(count)
        ]

    def test_init_deals_correct_hand_size(self):
        two_player_state = CelestiaGame.init_game({}, self._players(2))
        four_player_state = CelestiaGame.init_game({}, self._players(4))

        self.assertEqual(len(two_player_state["players"]["p1"]["hand"]), 8)
        self.assertEqual(len(two_player_state["players"]["p2"]["hand"]), 8)
        self.assertEqual(len(four_player_state["players"]["p1"]["hand"]), 6)
        self.assertEqual(len(four_player_state["players"]["p4"]["hand"]), 6)

    def test_captain_cannot_fail_when_normal_cards_cover_hazards(self):
        state = CelestiaGame.init_game({}, self._players(3))
        state["phase"] = "captain_action"
        state["captain"] = "p1"
        state["hazard_counts"] = {"cloud": 1, "lightning": 0, "bird": 0, "pirate": 0}
        state["players"]["p1"]["hand"] = [
            {"id": "c1", "category": "equipment", "kind": "compass"},
            {"id": "t1", "category": "wild", "kind": "turbo"},
        ]

        events, error = CelestiaGame.apply_action(state, "p1", {"type": "captain_fail"})

        self.assertEqual(events, [])
        self.assertEqual(error, "must use normal equipment")

    def test_crash_with_jetpack_awards_treasure_and_waits_for_all_ready(self):
        state = CelestiaGame.init_game({}, self._players(3))
        state["phase"] = "captain_action"
        state["captain"] = "p1"
        state["current_city"] = 4
        state["hazard_counts"] = {"cloud": 2, "lightning": 1, "bird": 0, "pirate": 0}
        for pid in state["turn_order"]:
            state["players"][pid]["on_ship"] = True
        state["players"]["p1"]["hand"] = []
        state["players"]["p2"]["hand"] = [{"id": "j1", "category": "power", "kind": "jetpack"}]
        state["players"]["p3"]["hand"] = []
        state["treasure_decks"][4] = [{"id": "tx", "city": 4, "kind": "points", "points": 7}]

        events, error = CelestiaGame.apply_action(state, "p1", {"type": "captain_fail"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "jetpack_window")

        events, error = CelestiaGame.apply_action(state, "p2", {"type": "jetpack_decision", "use": True})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "journey_end")
        self.assertEqual(len(state["players"]["p2"]["treasures"]), 1)
        self.assertEqual(state["players"]["p2"]["treasures"][0]["points"], 7)

        events, error = CelestiaGame.apply_action(state, "p1", {"type": "next_journey"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "journey_end")

        events, error = CelestiaGame.apply_action(state, "p2", {"type": "next_journey"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "journey_end")

        events, error = CelestiaGame.apply_action(state, "p3", {"type": "next_journey"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "roll")
        self.assertEqual(state["journey_no"], 2)

    def test_finish_game_only_after_journey_end_ready_votes(self):
        state = CelestiaGame.init_game({}, self._players(3))
        state["phase"] = "journey_end"
        state["journey_end_captain"] = "p1"
        state["next_ready"] = []
        state["journey_summary"] = {"reason": "solo_leave", "city": 6, "captain": "p1", "rewards": []}
        state["players"]["p1"]["treasures"] = [{"id": "t1", "city": 6, "kind": "points", "points": 50}]
        state["players"]["p2"]["treasures"] = [{"id": "t2", "city": 4, "kind": "points", "points": 12}]
        state["players"]["p3"]["treasures"] = [{"id": "t3", "city": 5, "kind": "points", "points": 10}]

        events, error = CelestiaGame.apply_action(state, "p1", {"type": "next_journey"})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])

        events, error = CelestiaGame.apply_action(state, "p2", {"type": "next_journey"})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])

        events, error = CelestiaGame.apply_action(state, "p3", {"type": "next_journey"})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["winner"], ["p1"])


if __name__ == "__main__":
    unittest.main()
