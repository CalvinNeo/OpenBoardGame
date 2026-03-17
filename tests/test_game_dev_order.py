import unittest
import json
from pathlib import Path

from game import list_games


class GameDevOrderTests(unittest.TestCase):
    @staticmethod
    def _load_game_dev_order():
        path = Path(__file__).resolve().parent.parent / "game" / "dev_order.json"
        return json.loads(path.read_text(encoding="utf-8"))

    def test_every_registered_game_has_dev_order(self):
        game_dev_order = self._load_game_dev_order()
        game_ids = [g.game_id for g in list_games()]
        missing = [game_id for game_id in game_ids if game_id not in game_dev_order]
        self.assertEqual(
            missing,
            [],
            f"Missing dev order entries for: {', '.join(missing)}",
        )

    def test_dev_order_values_are_unique(self):
        game_dev_order = self._load_game_dev_order()
        game_ids = [g.game_id for g in list_games()]
        values = [game_dev_order[game_id] for game_id in game_ids if game_id in game_dev_order]
        self.assertEqual(
            len(values),
            len(set(values)),
            "game/dev_order.json contains duplicate order values.",
        )

