"""Golden component transcription checks, independent of engine action tests."""
import unittest
from collections import Counter

from game import terra_nova_data as data
from game.terra_nova import _neighbors


class TerraNovaDataTests(unittest.TestCase):
    def test_main_board_terrain_inventory_and_row_coordinates(self):
        self.assertEqual(len(data.BOARD_CELLS), 90)
        self.assertEqual(len({c["id"] for c in data.BOARD_CELLS}), 90)
        self.assertEqual(Counter(c["terrain"] for c in data.BOARD_CELLS),
                         Counter(dict.fromkeys(data.TERRAIN_RING, 12), river=30))
        self.assertEqual([len(row) for row in data.MAP_ROWS], [10] * 9)
        neighbors = _neighbors({"board": data.BOARD_CELLS})
        for cid, adjacent in neighbors.items():
            self.assertTrue(all(cid in neighbors[other] for other in adjacent))

    def test_printed_bridgeheads_are_unique_land_to_land_crossings(self):
        self.assertEqual(len(data.BRIDGE_SITES), 25)
        cells = {cell["id"]: cell for cell in data.BOARD_CELLS}
        neighbors = _neighbors({"board": data.BOARD_CELLS})
        self.assertEqual(len({s["id"] for s in data.BRIDGE_SITES}), 25)
        self.assertEqual(len({tuple(s["cell_ids"]) for s in data.BRIDGE_SITES}), 25)
        for site in data.BRIDGE_SITES:
            a, b = site["cell_ids"]
            self.assertNotEqual(cells[a]["terrain"], "river")
            self.assertNotEqual(cells[b]["terrain"], "river")
            between = neighbors[a] & neighbors[b]
            self.assertEqual(len(between), 2)
            self.assertTrue(all(cells[cid]["terrain"] == "river" for cid in between))

    def test_ten_factions_share_five_colors_with_one_a_and_b(self):
        self.assertEqual(len(data.FACTIONS), 10)
        for terrain in data.TERRAIN_RING:
            pair = [f for f in data.FACTIONS.values() if f["terrain"] == terrain]
            self.assertEqual({f["side"] for f in pair}, {"A", "B"})
            self.assertEqual(len(pair), 2)
        for fid, faction in data.FACTIONS.items():
            self.assertEqual(faction["starting_coins"], 5 if fid == "sun_worshippers" else 7)
            self.assertEqual(faction["starting_houses"], 3 if fid == "sun_worshippers" else 2)
            self.assertEqual(faction["income_coins"], 2)
            self.assertEqual(len(faction["house_income"]), 8)
            self.assertEqual(len(faction["house_power_income"]), 8)
            self.assertEqual(len(faction["trading_post_income"]), 4)

    def test_faction_house_tracks_match_printed_asymmetry(self):
        expected = {
            "djinn": [3, 3, 3, 0, 0, 1, 0, 0],
            "merfolk": [3, 3, 3, 2, 0, 1, 0, 0],
            "golems": [3, 2, 2, 2, 0, 1, 0, 0],
            "ifrits": [3, 3, 3, 2, 0, 1, 0, 0],
            "goblins": [3, 3, 3, 3, 0, 2, 0, 0],
            "inventors": [3, 2, 2, 2, 0, 1, 0, 0],
            "fairies": [3, 3, 3, 2, 0, 1, 0, 0],
            "druids": [3, 3, 3, 2, 0, 1, 0, 0],
            "sun_worshippers": [3, 3, 3, 2, 0, 1, 0, 0],
            "felines": [3, 3, 0, 2, 0, 1, 0, 0],
        }
        for fid, track in expected.items():
            self.assertEqual(data.FACTIONS[fid]["house_income"], track, fid)
            power = [0, 0, 0, 0, 3, 0, 2, 0] if fid == "goblins" else [0, 0, 0, 0, 2, 0, 1, 0]
            self.assertEqual(data.FACTIONS[fid]["house_power_income"], power, fid)

    def test_faction_trade_tracks_match_component_images(self):
        expected = {
            "djinn": [(2, 1), (3, 1), (2, 1), (2, 1)],
            "merfolk": [(2, 1)] * 4, "golems": [(2, 1)] * 4,
            "ifrits": [(2, 2), (2, 2), (2, 1), (2, 1)],
            "goblins": [(2, 1), (2, 1), (3, 2), (3, 2)],
            "inventors": [(2, 1), (2, 1), (1, 1), (1, 1)],
            "fairies": [(3, 2), (3, 2), (3, 1), (3, 1)],
            "druids": [(3, 1), (3, 1), (2, 1), (2, 1)],
            "sun_worshippers": [(2, 2), (2, 2), (2, 1), (2, 1)],
            "felines": [(2, 2), (2, 2), (2, 1), (3, 1)],
        }
        for fid, track in expected.items():
            self.assertEqual([(i["coins"], i["power"]) for i in data.FACTIONS[fid]["trading_post_income"]], track, fid)

    def test_scoring_bonus_and_town_component_inventory(self):
        self.assertEqual(len(data.ROUND_TILES), 8)
        self.assertEqual(Counter(t["event"] for t in data.ROUND_TILES.values()),
                         Counter(house=2, trading_post=2, palace=1, town=1, sailing=1, spade=1))
        self.assertEqual(set(data.BONUS_TILES), set("ABCDEFGH"))
        self.assertEqual(sorted(t["score"] for t in data.TOWN_TILES.values()), [4, 5, 6, 9])
        self.assertEqual(data.SAILING_POINTS, [0, 2, 3, 4])
