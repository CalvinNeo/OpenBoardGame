import importlib.util
import json
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "designs" / "ark_nova" / "map0.source.json"
EXPANDED_PATH = ROOT / "game" / "assets" / "ark_nova" / "map0.json"
SVG_PATH = ROOT / "static" / "assets" / "ark_nova" / "map0.svg"


def _load_generator():
    path = ROOT / "scripts" / "gen_arknova_map_svg.py"
    spec = importlib.util.spec_from_file_location("gen_arknova_map_svg", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ArkNovaMap0Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generator = _load_generator()
        cls.source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
        cls.map_data = json.loads(EXPANDED_PATH.read_text(encoding="utf-8"))
        cls.cells = {cell["id"]: cell for cell in cls.map_data["cells"]}

    def test_audited_counts(self):
        self.assertEqual(
            self.map_data["counts"],
            {
                "total": 58,
                "buildable": 39,
                "land": 39,
                "water": 10,
                "rock": 9,
                "placement_bonuses": 12,
                "build_ii": 2,
            },
        )
        self.assertEqual(len(self.cells), 58)

    def test_bonus_and_condition_cells(self):
        bonuses = {
            cell_id: cell["placement_bonus"]
            for cell_id, cell in self.cells.items()
            if "placement_bonus" in cell
        }
        self.assertEqual(
            Counter(bonus["type"] for bonus in bonuses.values()),
            Counter(
                {
                    "card": 3,
                    "money": 3,
                    "x_token": 3,
                    "appeal": 2,
                    "action_to_slot": 1,
                }
            ),
        )
        self.assertEqual(
            {
                cell_id
                for cell_id, cell in self.cells.items()
                if cell.get("build_requirement") == "build_action_upgraded"
            },
            {"G3", "H3"},
        )
        self.assertEqual(bonuses["A5"], {"type": "appeal", "amount": 2})
        self.assertEqual(bonuses["H6"], {"type": "appeal", "amount": 2})

    def test_neighbors_are_symmetric_and_geometric(self):
        for cell_id, cell in self.cells.items():
            self.assertLessEqual(len(cell["neighbors"]), 6)
            for neighbor_id in cell["neighbors"]:
                self.assertIn(cell_id, self.cells[neighbor_id]["neighbors"])
        self.assertEqual(
            set(self.cells["E3"]["neighbors"]),
            {"D3", "D4", "E2", "E4", "F3", "F4"},
        )

    def test_generated_artifacts_are_current(self):
        expanded = self.generator.expand_config(self.source)
        generated_json = json.dumps(expanded, ensure_ascii=False, indent=2) + "\n"
        generated_svg = self.generator.render_svg(expanded)
        self.assertEqual(EXPANDED_PATH.read_text(encoding="utf-8"), generated_json)
        self.assertEqual(SVG_PATH.read_text(encoding="utf-8"), generated_svg)

    def test_svg_exposes_every_cell_to_the_client(self):
        svg = SVG_PATH.read_text(encoding="utf-8")
        for cell_id in self.cells:
            self.assertIn(f'id="ark-nova-map0-cell-{cell_id}"', svg)
            self.assertIn(f'data-cell-id="{cell_id}"', svg)
        self.assertNotIn("<image", svg)
        self.assertNotIn("steamusercontent", svg.lower())

    def test_svg_is_compact_and_omits_duplicate_ui(self):
        svg = SVG_PATH.read_text(encoding="utf-8")
        self.assertIn('viewBox="0 0 968 680"', svg)
        self.assertNotIn('id="ark-nova-map0-info"', svg)
        self.assertNotIn('id="ark-nova-map0-action-slots"', svg)
        self.assertNotIn("X-TOKEN STORAGE", svg)


if __name__ == "__main__":
    unittest.main()
