"""Check that Select Game filter and sort options stay wired to the shared client."""
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class GamePickerContractTests(unittest.TestCase):
    @staticmethod
    def _read(relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def setUp(self):
        self.index = self._read("static/index.html")
        self.room = self._read("static/room.js")

    def _select_values(self, select_id: str) -> list:
        block = re.search(rf'<select id="{select_id}">(.*?)</select>', self.index, re.S)
        self.assertIsNotNone(block, f"static/index.html has no select #{select_id}")
        return re.findall(r'<option value="([^"]*)"', block.group(1))

    def _sort_keys(self) -> set:
        keys = re.search(r"const GAME_SORT_KEYS = new Set\(\[(.*?)\]\);", self.room, re.S)
        self.assertIsNotNone(keys, "static/room.js has no GAME_SORT_KEYS set")
        return set(re.findall(r'"([^"]+)"', keys.group(1)))

    def test_player_filter_offers_eleven_or_more(self):
        self.assertIn("11+", self._select_values("playerCountFilter"))

    def test_sort_offers_recently_updated(self):
        self.assertIn("updated", self._select_values("gameSortSelect"))

    def test_every_sort_option_is_a_known_sort_key(self):
        offered = {value for value in self._select_values("gameSortSelect") if value}
        self.assertEqual(offered - self._sort_keys(), set())

    def test_player_filter_reads_open_ended_counts(self):
        self.assertIn('raw.endsWith("+")', self.room)
        self.assertIn("count >= playerFilter.count", self.room)

    def test_recently_updated_sorts_newest_first(self):
        self.assertIn('if (sortKey === "updated")', self.room)
        self.assertIn("const diff = bUpdated - aUpdated;", self.room)


if __name__ == "__main__":
    unittest.main()
