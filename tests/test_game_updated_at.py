import json
import unittest
from pathlib import Path

from game import list_games


class GameUpdatedAtTests(unittest.TestCase):
    @staticmethod
    def _load_game_updated_at():
        path = Path(__file__).resolve().parent.parent / "game" / "updated_at.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_every_registered_game_has_updated_at(self):
        game_updated_at = self._load_game_updated_at()
        game_ids = [g.game_id for g in list_games()]
        missing = [game_id for game_id in game_ids if game_id not in game_updated_at]
        self.assertEqual(
            missing,
            [],
            f"Missing updated_at entries for: {', '.join(missing)}. "
            "Run python scripts/gen_dev_order.py to refresh game/updated_at.json.",
        )

    def test_updated_at_values_are_timestamps(self):
        game_updated_at = self._load_game_updated_at()
        invalid = [
            game_id
            for game_id, value in game_updated_at.items()
            if not isinstance(value, int) or isinstance(value, bool) or value <= 0
        ]
        self.assertEqual(invalid, [], "game/updated_at.json must map game ids to unix timestamps.")

    def test_updated_at_is_listed_newest_first(self):
        values = list(self._load_game_updated_at().values())
        self.assertEqual(values, sorted(values, reverse=True))


class GameCatalogUpdatedAtTests(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_exposes_updated_at(self):
        import app

        catalog = await app.api_list_games()
        missing = [entry["game_id"] for entry in catalog if not entry.get("updated_at")]
        self.assertEqual(
            missing,
            [],
            f"/api/games is missing updated_at for: {', '.join(missing)}",
        )


if __name__ == "__main__":
    unittest.main()
