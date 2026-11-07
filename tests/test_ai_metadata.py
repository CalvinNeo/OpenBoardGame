import unittest
from pathlib import Path

import app
from game import list_games
from game.ai_metadata import STRATEGIC_AI_GAME_IDS


class StrategicAiMetadataTests(unittest.IsolatedAsyncioTestCase):
    def test_marked_games_are_registered_and_have_bots(self):
        games = {game.game_id: game for game in list_games()}
        self.assertFalse(STRATEGIC_AI_GAME_IDS - games.keys())
        for game_id in STRATEGIC_AI_GAME_IDS:
            with self.subTest(game=game_id):
                self.assertTrue(callable(getattr(games[game_id].module, "bot_move", None)))

    def test_dedicated_strategy_modules_are_marked(self):
        directory = Path(__file__).resolve().parent.parent / "game"
        dedicated = {path.stem.removesuffix("_ai") for path in directory.glob("*_ai.py")}
        self.assertFalse(dedicated - STRATEGIC_AI_GAME_IDS)

    def test_embedded_evaluation_and_inference_policies_are_marked(self):
        embedded = {"isle_of_skye", "moshimo_yusha", "spirit_island", "tacta", "turing_machine"}
        self.assertTrue(embedded <= STRATEGIC_AI_GAME_IDS)

    async def test_catalog_exposes_strategy_flags_not_generic_bot_support(self):
        catalog = {game["game_id"]: game for game in await app.api_list_games()}
        for game_id, entry in catalog.items():
            with self.subTest(game=game_id):
                self.assertIs(entry["has_strategic_ai"], game_id in STRATEGIC_AI_GAME_IDS)
        self.assertTrue(catalog["abraca_what"]["has_strategic_ai"])
        self.assertTrue(catalog["felix"]["has_strategic_ai"])
        self.assertTrue(catalog["six_nimmt"]["has_strategic_ai"])
        self.assertFalse(catalog["hanabi"]["has_strategic_ai"])


if __name__ == "__main__":
    unittest.main()
