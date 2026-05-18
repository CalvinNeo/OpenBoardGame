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


if __name__ == "__main__":
    unittest.main()
