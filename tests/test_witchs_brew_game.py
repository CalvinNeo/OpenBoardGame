import unittest

from game.witchs_brew import WitchsBrewGame


def players(count=3):
    return [
        {"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": False}
        for i in range(count)
    ]


class WitchsBrewGameTests(unittest.TestCase):
    def setUp(self):
        self.state = WitchsBrewGame.init_game({}, players(3))
        self.state["starter_player"] = "p0"
        self.state["disabled_roles"] = []
        self.select("p0", ["wizard", "wolf_keeper", "assistant", "cutpurse", "warlock"])
        self.select("p1", ["wizard", "snake_hunter", "assistant", "begging_monk", "warlock"])
        self.select("p2", ["herb_collector", "alchemist", "fortune_teller", "druid", "witch"])

    def select(self, player_id, roles):
        events, error = WitchsBrewGame.apply_action(self.state, player_id, {"type": "select_roles", "roles": roles})
        self.assertIsNone(error)
        return events

    def test_later_claimant_gets_full_action(self):
        self.assertEqual(self.state["phase"], "play_role")
        events, error = WitchsBrewGame.apply_action(self.state, "p0", {"type": "play_role", "role": "wizard"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "respond")
        self.assertEqual(self.state["current_player"], "p1")

        events, error = WitchsBrewGame.apply_action(self.state, "p1", {"type": "respond", "response": "claim_full"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "resolve_action")
        self.assertEqual(self.state["pending_action"]["player_id"], "p1")

        events, error = WitchsBrewGame.apply_action(self.state, "p1", {"type": "resolve_action"})
        self.assertIsNone(error)
        self.assertEqual(len(self.state["players"]["p1"]["potions"]), 1)
        self.assertEqual(self.state["players"]["p1"]["resources"]["white"], 0)
        self.assertEqual(self.state["phase"], "round_pause")

    def test_favor_resolves_before_full_action(self):
        WitchsBrewGame.apply_action(self.state, "p0", {"type": "play_role", "role": "wizard"})
        events, error = WitchsBrewGame.apply_action(self.state, "p1", {"type": "respond", "response": "take_favor"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "resolve_action")
        self.assertEqual(self.state["pending_action"]["strength"], "favor")

        events, error = WitchsBrewGame.apply_action(self.state, "p1", {"type": "resolve_action"})
        self.assertIsNone(error)
        self.assertEqual(len(self.state["players"]["p1"]["potions"]), 1)
        self.assertEqual(self.state["phase"], "resolve_action")
        self.assertEqual(self.state["pending_action"]["player_id"], "p0")

    def test_begging_monk_waits_for_loss_choice(self):
        self.state["phase"] = "play_role"
        self.state["current_player"] = "p1"
        self.state["players"]["p1"]["hand_roles"] = ["begging_monk"]
        self.state["players"]["p0"]["resources"].update({"red": 2, "green": 2, "white": 0})
        self.state["players"]["p2"]["resources"].update({"red": 0, "green": 0, "white": 4})

        events, error = WitchsBrewGame.apply_action(self.state, "p1", {"type": "play_role", "role": "begging_monk"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "resolve_action")
        events, error = WitchsBrewGame.apply_action(self.state, "p1", {"type": "resolve_action"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "choose_loss")
        self.assertEqual(self.state["current_player"], "p0")

        events, error = WitchsBrewGame.apply_action(self.state, "p0", {"type": "choose_loss", "loss": {"red": 1}})
        self.assertIsNone(error)
        self.assertEqual(self.state["current_player"], "p2")
        events, error = WitchsBrewGame.apply_action(self.state, "p2", {"type": "choose_loss", "loss": {"white": 1}})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "round_pause")
        self.assertEqual(self.state["shelf_stored"]["ingredient_shelf"]["red"], 1)
        self.assertEqual(self.state["shelf_stored"]["ingredient_shelf"]["white"], 1)


if __name__ == "__main__":
    unittest.main()
