import unittest

from game.catan_starfarers_data import (
    CIVILIZATIONS,
    ENCOUNTERS,
    FRIENDSHIP_CARDS,
    MAP_GRAPH,
    RESOURCE_TYPES,
    validate_data,
)


class CatanStarfarersDataTests(unittest.TestCase):
    def test_assets_validate(self):
        validate_data()

    def test_component_sets_have_expected_sizes(self):
        sector_counts = {kind: 0 for kind in ("system", "outpost", "empty")}
        for sector in MAP_GRAPH["sectors"]:
            sector_counts[sector["kind"]] += 1

        self.assertEqual(sector_counts, {"system": 8, "outpost": 4, "empty": 4})
        self.assertEqual(len(ENCOUNTERS), 32)
        self.assertEqual(len(FRIENDSHIP_CARDS), 20)
        self.assertEqual(set(RESOURCE_TYPES), {"ore", "fuel", "carbon", "food", "goods"})

    def test_each_civilization_has_five_cards(self):
        counts = {
            civilization: sum(card["civilization"] == civilization for card in FRIENDSHIP_CARDS)
            for civilization in CIVILIZATIONS
        }

        self.assertEqual(counts, {civilization: 5 for civilization in CIVILIZATIONS})

    def test_map_edges_reference_existing_nodes(self):
        node_ids = {node["id"] for node in MAP_GRAPH["nodes"]}

        for first, second in MAP_GRAPH["edges"]:
            self.assertIn(first, node_ids)
            self.assertIn(second, node_ids)
            self.assertNotEqual(first, second)


if __name__ == "__main__":
    unittest.main()
