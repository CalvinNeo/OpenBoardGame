import unittest

from game.pokemon_splendor_data import TIER_DECKS
from game.splendor_pokemon import PokemonSplendorGame


def _players():
    return [
        {"player_id": "p1", "name": "Player 1", "seat": 0, "is_bot": False},
        {"player_id": "p2", "name": "Player 2", "seat": 1, "is_bot": False},
    ]


class PokemonSplendorTests(unittest.TestCase):
    def test_evolution_target_chinese_names_are_loaded(self):
        bulbasaur = next(card for card in TIER_DECKS["lv1"] if card["name_en"] == "Bulbasaur")

        self.assertEqual(bulbasaur["evolution_targets"], ["Ivysaur"])
        self.assertEqual(bulbasaur["evolution_targets_zh"], ["妙蛙草"])

        evolving_cards = [card for cards in TIER_DECKS.values() for card in cards if card["evolution_targets"]]
        self.assertTrue(evolving_cards)
        for card in evolving_cards:
            self.assertEqual(len(card["evolution_targets_zh"]), len(card["evolution_targets"]))
            self.assertTrue(all(card["evolution_targets_zh"]))

    def test_public_view_includes_bilingual_evolution_targets(self):
        state = PokemonSplendorGame.init_game({}, _players())
        bulbasaur = next(card for card in TIER_DECKS["lv1"] if card["name_en"] == "Bulbasaur")
        state["market"]["lv1"] = [dict(bulbasaur)]

        view = PokemonSplendorGame.get_public_view(state, "p1")

        self.assertEqual(view["market"]["lv1"][0]["evolution"]["targets"], ["Ivysaur"])
        self.assertEqual(view["market"]["lv1"][0]["evolution"]["targets_zh"], ["妙蛙草"])


if __name__ == "__main__":
    unittest.main()
