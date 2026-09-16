import re
import unittest

from app import api_list_games
from game import list_games


CHINESE_CHARACTER_RE = re.compile(r"[\u3400-\u9fff]")


class GameNameTests(unittest.IsolatedAsyncioTestCase):
    def test_every_registered_game_has_a_chinese_name(self):
        missing = [
            game.game_id
            for game in list_games()
            if not game.name_zh.strip() or not CHINESE_CHARACTER_RE.search(game.name_zh)
        ]

        self.assertEqual(missing, [], f"Missing Chinese game names for: {', '.join(missing)}")

    async def test_games_api_exposes_chinese_names(self):
        payload = await api_list_games()

        self.assertEqual(len(payload), len(list_games()))
        self.assertTrue(all(item["name_zh"] for item in payload))


if __name__ == "__main__":
    unittest.main()
