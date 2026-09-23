"""Check that deferred styles and their reserved cascade positions stay in sync."""
import json
import re
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STYLE_GROUP = re.compile(r"@media\s+all,\s*(obg-game-[\w-]+)\s*\{")


class FrontendStyleAssetTests(unittest.TestCase):
    def test_every_deferred_style_group_has_one_reserved_position(self):
        loader = (ROOT / "static/game_assets.js").read_text(encoding="utf-8")
        assets, _ = json.JSONDecoder().raw_decode(loader.split("const GAME_ASSETS = ", 1)[1])
        core = (ROOT / "static/style.css").read_text(encoding="utf-8")
        core_groups = Counter(STYLE_GROUP.findall(core))
        deferred_groups = Counter()
        for game_id, game in assets.items():
            url = game.get("styleFragments")
            if not url:
                continue
            with self.subTest(game=game_id):
                path = ROOT / url.split("?", 1)[0].lstrip("/")
                self.assertTrue(path.is_file(), str(path))
                groups = STYLE_GROUP.findall(path.read_text(encoding="utf-8"))
                self.assertTrue(groups)
                self.assertTrue(all(name.startswith(f"obg-game-{game_id}-") for name in groups))
                deferred_groups.update(groups)
        self.assertTrue(core_groups)
        self.assertEqual(deferred_groups, core_groups)
        self.assertTrue(all(count == 1 for count in core_groups.values()))
        empty_groups = Counter(re.findall(r"@media\s+all,\s*(obg-game-[\w-]+)\s*\{\s*\}", core))
        self.assertEqual(empty_groups, core_groups)

    def test_shared_stylesheet_is_available_to_the_loader(self):
        index = (ROOT / "static/index.html").read_text(encoding="utf-8")
        self.assertRegex(index, r'<link id="coreStyles" rel="stylesheet" href="/static/style\.css\?v=[^"]+"')
        self.assertLess(index.index('id="coreStyles"'), index.index('/static/game_assets.js?'))
        self.assertNotRegex(index, r'<link[^>]+href="/static/games/[^"?]+\.css')


if __name__ == "__main__":
    unittest.main()
