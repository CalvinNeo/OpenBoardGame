import unittest

from game.gizmos import GizmosGame


def _players():
    return [
        {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
        {"player_id": "p2", "name": "Bob", "seat": 1, "is_bot": False},
    ]


class GizmosGameTests(unittest.TestCase):
    def test_init_sets_up_display_and_energy_row(self):
        state = GizmosGame.init_game({"seed": 7}, _players())

        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(len(state["display"]["1"]), 4)
        self.assertEqual(len(state["display"]["2"]), 3)
        self.assertEqual(len(state["display"]["3"]), 2)
        self.assertTrue(all(card_id for card_id in state["display"]["1"]))
        self.assertEqual(len(state["energy_row"]), 6)
        self.assertEqual(state["players"]["p1"]["active"], ["start_file_draw_1"])

    def test_file_then_starting_gizmo_draws_random_energy(self):
        state = GizmosGame.init_game({"seed": 3}, _players())
        starting_bag_count = len(state["energy_bag"])
        card_id = state["display"]["1"][0]

        events, error = GizmosGame.apply_action(state, "p1", {"type": "file_display", "card_id": card_id})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "gizmos:file_display" for evt in events))
        self.assertEqual(state["phase"], "choose_effect")
        self.assertEqual(state["players"]["p1"]["archive"], [card_id])
        self.assertEqual(len(state["pending_effects"]), 1)

        effect_id = state["pending_effects"][0]["effect_id"]
        _, error = GizmosGame.apply_action(state, "p1", {"type": "resolve_effect", "effect_id": effect_id})
        self.assertIsNone(error)

        self.assertEqual(len(state["players"]["p1"]["storage"]), 1)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["phase"], "action")
        self.assertEqual(len(state["energy_row"]), 6)
        self.assertEqual(len(state["energy_bag"]), starting_bag_count - 1)

    def test_build_from_archive_triggers_pick_two_effect(self):
        state = GizmosGame.init_game({"seed": 1}, _players())
        state["display"] = {"1": [None, None, None, None], "2": [None, None, None], "3": [None, None]}
        state["energy_row"] = ["red", "yellow", "blue", "black", "red", "yellow"]
        state["players"]["p1"]["archive"] = ["l1_pick_red_draw_1"]
        state["players"]["p1"]["active"].append("l2_build_archive_pick2_red")
        state["players"]["p1"]["storage"] = ["red"]

        _, error = GizmosGame.apply_action(state, "p1", {"type": "build_archive", "card_id": "l1_pick_red_draw_1"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "choose_effect")
        self.assertEqual(len(state["pending_effects"]), 1)

        effect_id = state["pending_effects"][0]["effect_id"]
        _, error = GizmosGame.apply_action(state, "p1", {"type": "resolve_effect", "effect_id": effect_id})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "bonus_action")
        self.assertEqual(state["bonus_context"]["kind"], "pick")
        self.assertEqual(state["bonus_context"]["remaining"], 2)

        _, error = GizmosGame.apply_action(state, "p1", {"type": "pick_energy", "color": "blue"})
        self.assertIsNone(error)
        self.assertEqual(state["bonus_context"]["remaining"], 1)

        _, error = GizmosGame.apply_action(state, "p1", {"type": "pick_energy", "color": "yellow"})
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["phase"], "action")
        self.assertGreaterEqual(len(state["players"]["p1"]["storage"]), 2)

    def test_research_build_returns_remaining_cards_to_bottom(self):
        state = GizmosGame.init_game({"seed": 2}, _players())
        state["decks"]["1"] = ["deck_bottom", "l1_upgrade_storage_red", "l1_pick_red_draw_1", "l1_file_pick_red"]
        state["players"]["p1"]["research_amount"] = 3
        state["players"]["p1"]["storage"] = ["red"]

        _, error = GizmosGame.apply_action(state, "p1", {"type": "research", "level": 1})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "research")
        self.assertEqual(
            state["research_context"]["drawn"],
            ["l1_file_pick_red", "l1_pick_red_draw_1", "l1_upgrade_storage_red"],
        )

        _, error = GizmosGame.apply_action(
            state,
            "p1",
            {
                "type": "resolve_research",
                "choice": "build",
                "card_id": "l1_file_pick_red",
                "return_order": ["l1_upgrade_storage_red", "l1_pick_red_draw_1"],
            },
        )
        self.assertIsNone(error)
        self.assertIn("l1_file_pick_red", state["players"]["p1"]["active"])
        self.assertEqual(state["decks"]["1"][:3], ["l1_upgrade_storage_red", "l1_pick_red_draw_1", "deck_bottom"])
        self.assertEqual(state["current_turn"], "p2")

    def test_generic_build_counts_as_all_colors_for_build_triggers(self):
        state = GizmosGame.init_game({"seed": 4}, _players())
        state["display"] = {"1": [None, None, None, None], "2": [None, None, None], "3": [None, None]}
        state["players"]["p1"]["archive"] = ["l3_generic_1"]
        state["players"]["p1"]["active"].append("l1_build_red_pick_1")
        state["players"]["p1"]["storage"] = ["red", "yellow", "blue", "black", "red", "yellow", "blue"]

        _, error = GizmosGame.apply_action(state, "p1", {"type": "build_archive", "card_id": "l3_generic_1"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "choose_effect")
        labels = [item["label"] for item in state["pending_effects"]]
        self.assertTrue(any("Build" in label or "Pick" in label for label in labels))
        self.assertGreaterEqual(len(state["pending_effects"]), 2)

        source_ids = {item["source_card_id"] for item in state["pending_effects"]}
        self.assertIn("l1_build_red_pick_1", source_ids)
        self.assertIn("l3_generic_1", source_ids)


if __name__ == "__main__":
    unittest.main()
