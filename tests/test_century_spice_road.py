import unittest

from game.century_spice_road import CenturySpiceRoadGame


def _players(count=2):
    return [
        {"player_id": f"p{i + 1}", "name": f"Player {i + 1}", "seat": i, "is_bot": False}
        for i in range(count)
    ]


class CenturySpiceRoadTests(unittest.TestCase):
    def test_init_sets_up_markets_and_starting_spices(self):
        state = CenturySpiceRoadGame.init_game({"seed": 7}, _players(5))

        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(len(state["merchant_market"]), 6)
        self.assertEqual(len(state["point_market"]), 5)
        self.assertEqual(state["gold_remaining"], 10)
        self.assertEqual(state["silver_remaining"], 10)
        self.assertEqual(state["players"]["p1"]["spices"]["yellow"], 3)
        self.assertEqual(state["players"]["p2"]["spices"]["yellow"], 4)
        self.assertEqual(state["players"]["p4"]["spices"]["red"], 1)
        self.assertEqual([card["id"] for card in state["players"]["p1"]["hand"]], ["starter_create_2", "starter_upgrade_2"])

    def test_play_spice_and_upgrade_cards(self):
        state = CenturySpiceRoadGame.init_game({"seed": 1}, _players())

        _, error = CenturySpiceRoadGame.apply_action(state, "p1", {"type": "play", "card_id": "starter_create_2"})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["spices"]["yellow"], 5)
        self.assertEqual(state["current_turn"], "p2")

        _, error = CenturySpiceRoadGame.apply_action(
            state,
            "p2",
            {"type": "play", "card_id": "starter_upgrade_2", "upgrades": ["yellow", "red"]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p2"]["spices"]["yellow"], 3)
        self.assertEqual(state["players"]["p2"]["spices"]["green"], 1)

    def test_trade_card_can_repeat(self):
        state = CenturySpiceRoadGame.init_game({"seed": 1}, _players())
        trade = {
            "id": "test_trade",
            "type": "trade",
            "cost": {"yellow": 2, "red": 0, "green": 0, "brown": 0},
            "gain": {"yellow": 0, "red": 2, "green": 0, "brown": 0},
            "upgrade_steps": 0,
        }
        state["players"]["p1"]["hand"] = [trade]
        state["players"]["p1"]["spices"] = {"yellow": 4, "red": 0, "green": 0, "brown": 0}

        _, error = CenturySpiceRoadGame.apply_action(state, "p1", {"type": "play", "card_id": "test_trade", "times": 2})

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["spices"], {"yellow": 0, "red": 4, "green": 0, "brown": 0})

    def test_acquire_merchant_places_spices_on_left_cards(self):
        state = CenturySpiceRoadGame.init_game({"seed": 1}, _players())
        first_id = state["merchant_market"][0]["card"]["id"]
        target_id = state["merchant_market"][2]["card"]["id"]

        _, error = CenturySpiceRoadGame.apply_action(
            state,
            "p1",
            {"type": "acquire", "index": 2, "payments": ["yellow", "yellow"]},
        )

        self.assertIsNone(error)
        self.assertIn(target_id, [card["id"] for card in state["players"]["p1"]["hand"]])
        self.assertEqual(state["merchant_market"][0]["card"]["id"], first_id)
        self.assertEqual(state["merchant_market"][0]["spices"]["yellow"], 1)
        self.assertEqual(state["merchant_market"][1]["spices"]["yellow"], 1)
        self.assertEqual(state["players"]["p1"]["spices"]["yellow"], 1)

    def test_claim_bonus_and_end_trigger(self):
        state = CenturySpiceRoadGame.init_game({"seed": 1}, _players())
        point = {
            "id": "test_point",
            "points": 8,
            "cost": {"yellow": 1, "red": 0, "green": 0, "brown": 0},
        }
        state["point_market"][0] = point

        _, error = CenturySpiceRoadGame.apply_action(state, "p1", {"type": "claim", "index": 0})

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["claimed_points"][0]["id"], "test_point")
        self.assertEqual(state["players"]["p1"]["gold"], 1)
        self.assertEqual(state["gold_remaining"], 3)

    def test_discard_phase_blocks_next_turn_until_resolved(self):
        state = CenturySpiceRoadGame.init_game({"seed": 1}, _players())
        state["players"]["p1"]["spices"] = {"yellow": 10, "red": 0, "green": 0, "brown": 0}

        _, error = CenturySpiceRoadGame.apply_action(state, "p1", {"type": "play", "card_id": "starter_create_2"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "discard")
        self.assertEqual(state["discard_needed"], 2)
        self.assertEqual(state["current_turn"], "p1")

        _, error = CenturySpiceRoadGame.apply_action(
            state,
            "p1",
            {"type": "discard", "spices": {"yellow": 2, "red": 0, "green": 0, "brown": 0}},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(sum(state["players"]["p1"]["spices"].values()), 10)


if __name__ == "__main__":
    unittest.main()
