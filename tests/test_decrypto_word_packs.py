import json
import unittest
from pathlib import Path
from unittest.mock import patch

from game import decrypto, decrypto_ai


class DecryptoWordPackTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assets_dir = Path(__file__).resolve().parents[1] / "game" / "assets"
        cls.pack_index = json.loads(
            (cls.assets_dir / "decrypto_word_packs.json").read_text(encoding="utf-8")
        )
        cls.pack = next(pack for pack in cls.pack_index if pack["pack_id"] == "ext2")
        cls.pack_path = cls.assets_dir / cls.pack["path"]
        cls.data = json.loads(cls.pack_path.read_text(encoding="utf-8"))

    def test_ext2_contains_exactly_500_chinese_words(self):
        self.assertEqual(self.pack["language"], "zh-CN")
        self.assertEqual(self.pack["total_count"], 500)
        self.assertEqual(self.data["source"], "ext2")
        self.assertEqual(len(self.data["words"]), 500)
        for word in self.data["words"]:
            with self.subTest(word=word):
                self.assertRegex(word, r"^[\u4e00-\u9fff]+$")

    def test_ext2_is_unique_and_disjoint_from_every_other_pack(self):
        words = [decrypto._normalize_text(word) for word in self.data["words"]]
        self.assertEqual(len(words), len(set(words)))
        for pack in self.pack_index:
            if pack["pack_id"] == "ext2":
                continue
            with self.subTest(pack=pack["pack_id"]):
                previous = decrypto._load_pack_words({**pack, "path": str(self.assets_dir / pack["path"])})
                overlap = set(words) & {decrypto._normalize_text(word) for word in previous}
                self.assertEqual(overlap, set())

    def test_ext2_covers_25_equal_sized_categories(self):
        categories = self.data["categories"]
        category_size = self.data["words_per_category"]
        self.assertEqual(len(categories), 25)
        self.assertEqual(len(set(categories)), 25)
        self.assertEqual(category_size, 20)
        self.assertEqual(len(self.data["words"]), len(categories) * category_size)
        for index, category in enumerate(categories):
            with self.subTest(category=category):
                start = index * category_size
                self.assertEqual(len(self.data["words"][start:start + category_size]), 20)

    def test_game_and_bot_loaders_read_the_same_words(self):
        pack = {**self.pack, "path": str(self.pack_path)}
        self.assertEqual(decrypto._load_pack_words(pack), self.data["words"])
        self.assertEqual(decrypto_ai._load_words_from_pack(self.pack_path), self.data["words"])

    def test_ext2_registers_and_combines_without_losing_words(self):
        previous_ids = [pack["pack_id"] for pack in self.pack_index if pack["pack_id"] != "ext2"]
        with patch.object(decrypto, "_PACK_INDEX_CACHE", None):
            public_packs = decrypto.get_decrypto_word_packs()
            public_pack = next(pack for pack in public_packs if pack["pack_id"] == "ext2")
            self.assertEqual(public_pack, {
                "pack_id": "ext2", "pack_name": "Ext2", "language": "zh-CN", "total_count": 500,
            })
            previous = decrypto._build_word_pool(previous_ids)
            standalone = decrypto._build_word_pool(["ext2"])
            combined = decrypto._build_word_pool(previous_ids + ["ext2"])
        self.assertEqual(standalone, self.data["words"])
        self.assertEqual(len(combined), len(previous) + 500)
        self.assertEqual(set(combined), set(previous) | set(standalone))

    def test_game_can_start_with_only_ext2_selected(self):
        players = [
            {"player_id": f"player_{index}", "seat": index, "name": f"Player {index}"}
            for index in range(4)
        ]
        with patch.object(decrypto, "_PACK_INDEX_CACHE", None):
            state = decrypto.DecryptoGame.init_game({"word_packs": ["ext2"]}, players)
        self.assertEqual(state["config"]["word_packs"], ["ext2"])
        keywords = [word for team in state["teams"].values() for word in team["keywords"]]
        self.assertEqual(len(keywords), 8)
        self.assertEqual(len(set(keywords)), 8)
        self.assertTrue(set(keywords).issubset(self.data["words"]))


if __name__ == "__main__":
    unittest.main()
