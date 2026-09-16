import unittest

from game.ra import RaGame


def players(count=3):
    return [{"player_id": f"p{idx}", "name": f"P{idx}", "seat": idx} for idx in range(count)]


class RaGameTest(unittest.TestCase):
    def test_setup_assigns_disks_and_scores(self):
        state = RaGame.init_game({}, players(3))

        self.assertEqual(state["center_disk"], 1)
        self.assertEqual([disk["value"] for disk in state["players"]["p0"]["sun_disks"]], [2, 5, 8, 13])
        self.assertEqual([disk["value"] for disk in state["players"]["p1"]["sun_disks"]], [3, 6, 9, 14])
        self.assertEqual(state["players"]["p0"]["score"], 10)
        self.assertEqual(state["epoch"], 1)
        self.assertEqual(state["phase"], "turn")

    def test_voluntary_auction_winner_takes_tiles_and_spends_disk(self):
        state = RaGame.init_game({}, players(3))
        state["current_turn"] = "p0"
        state["auction_track"] = [{"id": "gold_1", "kind": "gold", "group": "gold", "label": "Gold"}]

        events, error = RaGame.apply_action(state, "p0", {"type": "invoke_ra"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "auction")
        self.assertEqual(state["current_turn"], "p1")

        events, error = RaGame.apply_action(state, "p1", {"type": "pass"})
        self.assertIsNone(error)
        events, error = RaGame.apply_action(state, "p2", {"type": "bid", "disk": 4})
        self.assertIsNone(error)
        events, error = RaGame.apply_action(state, "p0", {"type": "bid", "disk": 5})
        self.assertIsNone(error)

        self.assertEqual(state["center_disk"], 5)
        self.assertEqual(state["auction_track"], [])
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual([tile["kind"] for tile in state["players"]["p0"]["tiles"]], ["gold"])
        disks = {disk["value"]: disk["ready"] for disk in state["players"]["p0"]["sun_disks"]}
        self.assertNotIn(5, disks)
        self.assertFalse(disks[1])

    def test_disaster_requires_matching_discards(self):
        state = RaGame.init_game({}, players(3))
        state["current_turn"] = "p0"
        state["auction_track"] = [
            {"id": "war_1", "kind": "war", "group": "disaster", "label": "War"},
            {"id": "pharaoh_1", "kind": "pharaoh", "group": "pharaoh", "label": "Pharaoh"},
        ]
        state["players"]["p0"]["tiles"] = [
            {"id": "pharaoh_old_1", "kind": "pharaoh", "group": "pharaoh", "label": "Pharaoh"},
            {"id": "pharaoh_old_2", "kind": "pharaoh", "group": "pharaoh", "label": "Pharaoh"},
        ]

        RaGame.apply_action(state, "p0", {"type": "invoke_ra"})
        RaGame.apply_action(state, "p1", {"type": "pass"})
        RaGame.apply_action(state, "p2", {"type": "pass"})
        events, error = RaGame.apply_action(state, "p0", {"type": "bid", "disk": 2})

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "disaster")
        self.assertEqual(state["pending_disaster"]["requirements"], {"war": 2})

        events, error = RaGame.apply_action(
            state,
            "p0",
            {"type": "resolve_disaster", "tile_ids": ["pharaoh_old_1", "pharaoh_old_2"]},
        )

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "turn")
        self.assertEqual([tile["id"] for tile in state["players"]["p0"]["tiles"]], ["pharaoh_1"])

    def test_disaster_view_recommends_a_low_loss_monument_pair(self):
        state = RaGame.init_game({}, players(3))
        state["phase"] = "disaster"
        state["current_turn"] = "p0"
        state["players"]["p0"]["tiles"] = [
            {"id": "statue_1", "kind": "statue", "group": "monument", "label": "Statue"},
            {"id": "temple_1", "kind": "temple", "group": "monument", "label": "Temple"},
            {"id": "fortress_1", "kind": "fortress", "group": "monument", "label": "Fortress"},
            {"id": "sphinx_1", "kind": "sphinx", "group": "monument", "label": "Sphinx"},
            {"id": "palace_1", "kind": "palace", "group": "monument", "label": "Palace"},
            {"id": "palace_2", "kind": "palace", "group": "monument", "label": "Palace"},
            {"id": "step_1", "kind": "step_pyramid", "group": "monument", "label": "Step Pyramid"},
            {"id": "obelisk_1", "kind": "obelisk", "group": "monument", "label": "Obelisk"},
            {"id": "gold_1", "kind": "gold", "group": "gold", "label": "Gold"},
        ]
        state["pending_disaster"] = {
            "player_id": "p0",
            "disasters": [
                {"id": "earthquake_1", "kind": "earthquake", "group": "disaster", "label": "Earthquake"}
            ],
            "requirements": {"earthquake": 2},
            "bid_disk": 2,
            "trigger_player": "p0",
        }

        pending = RaGame.get_public_view(state, "p0")["pending_disaster"]
        guide = pending["guide"]
        group = guide["groups"][0]
        recommended = set(guide["recommended_tile_ids"])

        self.assertEqual(guide["required_total"], 2)
        self.assertEqual(group["target_label"], "Monument")
        self.assertNotIn("gold_1", guide["eligible_tile_ids"])
        self.assertEqual(len(recommended), 2)
        self.assertTrue(recommended & {"palace_1", "palace_2"})
        self.assertIn("Keeps 6 Monument", group["recommendation"])
        self.assertGreater(group["alternative_count"], 0)

    def test_drought_recommendation_keeps_the_last_flood(self):
        state = RaGame.init_game({}, players(3))
        state["phase"] = "disaster"
        state["current_turn"] = "p0"
        state["players"]["p0"]["tiles"] = [
            {"id": "flood_1", "kind": "flood", "group": "river", "label": "Flood"},
            {"id": "nile_1", "kind": "nile", "group": "river", "label": "Nile"},
            {"id": "nile_2", "kind": "nile", "group": "river", "label": "Nile"},
        ]
        state["pending_disaster"] = {
            "player_id": "p0",
            "disasters": [
                {"id": "drought_1", "kind": "drought", "group": "disaster", "label": "Drought"}
            ],
            "requirements": {"drought": 2},
            "bid_disk": 2,
            "trigger_player": "p0",
        }

        guide = RaGame.get_public_view(state, "p0")["pending_disaster"]["guide"]

        self.assertEqual(set(guide["recommended_tile_ids"]), {"nile_1", "nile_2"})
        self.assertIn("Keeps a Flood active", guide["groups"][0]["recommendation"])

    def test_epoch_scoring_pauses_until_all_players_ready(self):
        state = RaGame.init_game({}, players(3))
        state["epoch"] = 1
        state["ra_track"] = [{"id": f"ra_{idx}", "kind": "ra", "group": "ra", "label": "Ra"} for idx in range(7)]
        state["bag"] = [{"id": "ra_last", "kind": "ra", "group": "ra", "label": "Ra"}]
        state["current_turn"] = "p0"

        events, error = RaGame.apply_action(state, "p0", {"type": "draw_tile"})

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "epoch_pause")
        self.assertEqual(state["last_epoch_summary"]["reason"], "ra_track_full")

        RaGame.apply_action(state, "p0", {"type": "next_round"})
        RaGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertEqual(state["phase"], "epoch_pause")
        RaGame.apply_action(state, "p2", {"type": "next_round"})
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(state["epoch"], 2)

    def test_public_view_includes_projected_epoch_score(self):
        state = RaGame.init_game({}, players(3))
        state["players"]["p0"]["tiles"] = [
            {"id": "god_1", "kind": "god", "group": "god", "label": "God"},
            {"id": "gold_1", "kind": "gold", "group": "gold", "label": "Gold"},
            {"id": "flood_1", "kind": "flood", "group": "river", "label": "Flood"},
            {"id": "nile_1", "kind": "nile", "group": "river", "label": "Nile"},
            {"id": "pharaoh_1", "kind": "pharaoh", "group": "pharaoh", "label": "Pharaoh"},
        ]

        view = RaGame.get_public_view(state, "p0")
        p0 = next(player for player in view["players"] if player["player_id"] == "p0")

        self.assertEqual(p0["projected_epoch_score"]["total"], 7)
        self.assertEqual(p0["projected_epoch_score"]["projected_total_score"], 17)
        self.assertEqual(
            [(item["type"], item["points"]) for item in p0["projected_epoch_score"]["details"]],
            [("Gods", 2), ("Gold", 3), ("River", 2), ("Civilization", -5), ("Pharaohs", 5)],
        )


if __name__ == "__main__":
    unittest.main()
