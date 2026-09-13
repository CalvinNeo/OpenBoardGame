import random
import unittest

from game.splendor import SplendorGame
from game.splendor_pokemon import PokemonSplendorGame, _available_evolutions


def _players():
    return [
        {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
        {"player_id": "opponent", "name": "Opponent", "seat": 1, "is_bot": True},
    ]


def _classic_card(card_id, tier, points, bonus, cost):
    return {
        "id": card_id,
        "tier": tier,
        "points": points,
        "bonus": bonus,
        "cost": dict(cost),
    }


def _pokemon_card(card_id, name, tier, points, bonus, *, targets=None):
    return {
        "id": card_id,
        "name": name,
        "name_en": name,
        "tier": tier,
        "tier_label": tier,
        "points": points,
        "bonus": bonus,
        "cost": {},
        "evolution_targets": list(targets or []),
        "evolution_targets_zh": [],
        "evolution_requirements": {},
    }


class SplendorAiTests(unittest.TestCase):
    def test_classic_bot_collects_colors_for_its_best_target(self):
        state = SplendorGame.init_game({}, _players())
        state["current_turn"] = "bot"
        state["market"] = {
            "tier1": [],
            "tier2": [],
            "tier3": [
                _classic_card(
                    "goal",
                    3,
                    4,
                    "white",
                    {"red": 2, "blue": 2, "green": 2},
                )
            ],
        }
        state["decks"] = {tier: [] for tier in state["decks"]}
        state["tokens_supply"] = {
            "white": 4,
            "blue": 4,
            "green": 4,
            "red": 4,
            "black": 4,
            "gold": 5,
        }

        action = SplendorGame.bot_move(state, "bot")

        self.assertEqual(action["type"], "take_tokens")
        self.assertEqual(set(action["colors"]), {"red", "blue", "green"})

    def test_classic_bot_buys_a_card_that_wins_immediately(self):
        state = SplendorGame.init_game({"target_score": 15}, _players())
        state["current_turn"] = "bot"
        state["players"]["bot"]["score"] = 13
        state["players"]["bot"]["tokens"]["red"] = 4
        state["market"] = {
            "tier1": [_classic_card("engine", 1, 0, "blue", {"red": 1})],
            "tier2": [_classic_card("winner", 2, 2, "green", {"red": 4})],
            "tier3": [],
        }
        state["decks"] = {tier: [] for tier in state["decks"]}

        action = SplendorGame.bot_move(state, "bot")

        self.assertEqual(action, {"type": "buy_market", "tier": "tier2", "index": 0})

    def test_classic_bot_reserves_an_opponents_winning_card(self):
        state = SplendorGame.init_game({"target_score": 15}, _players())
        state["current_turn"] = "bot"
        opponent = state["players"]["opponent"]
        opponent["score"] = 14
        opponent["tokens"]["red"] = 4
        state["market"] = {
            "tier1": [_classic_card("threat", 1, 1, "blue", {"red": 4})],
            "tier2": [],
            "tier3": [],
        }
        state["decks"] = {tier: [] for tier in state["decks"]}

        action = SplendorGame.bot_move(state, "bot")

        self.assertEqual(action, {"type": "reserve_market", "tier": "tier1", "index": 0})

    def test_discard_keeps_wild_tokens_and_target_colors(self):
        state = SplendorGame.init_game({}, _players())
        state["current_turn"] = "bot"
        state["phase"] = "discard_tokens"
        state["players"]["bot"]["tokens"].update(
            {"white": 2, "blue": 3, "green": 2, "red": 3, "black": 1, "gold": 1}
        )
        state["market"] = {
            "tier1": [],
            "tier2": [_classic_card("goal", 2, 3, "white", {"blue": 5, "red": 5})],
            "tier3": [],
        }
        state["decks"] = {tier: [] for tier in state["decks"]}

        action = SplendorGame.bot_move(state, "bot")

        self.assertEqual(action["type"], "discard_tokens")
        self.assertEqual(sum(action["tokens"].values()), 2)
        self.assertEqual(action["tokens"]["gold"], 0)
        self.assertEqual(action["tokens"]["blue"], 0)
        self.assertEqual(action["tokens"]["red"], 0)

    def test_pokemon_bot_selects_the_strongest_evolution(self):
        state = PokemonSplendorGame.init_game({}, _players())
        state["current_turn"] = "bot"
        state["phase"] = "evolution"
        base = _pokemon_card("base", "Base", "lv1", 0, "red", targets=["Weak", "Strong"])
        weak = _pokemon_card("weak", "Weak", "lv2", 1, "red")
        strong = _pokemon_card("strong", "Strong", "lv3", 5, "blue")
        state["players"]["bot"]["captured"] = [base]
        state["players"]["bot"]["bonuses"]["red"] = 1
        state["market"] = {tier: [] for tier in state["market"]}
        state["market"]["lv2"] = [weak]
        state["market"]["lv3"] = [strong]

        options = _available_evolutions(state, "bot")
        self.assertEqual([option["target_id"] for option in options], ["weak", "strong"])

        action = PokemonSplendorGame.bot_move(state, "bot")

        self.assertEqual(action, {"type": "evolve", "base_id": "base", "target_id": "strong"})

    def test_previous_deadlock_seeds_finish_with_legal_bot_moves(self):
        cases = (
            (SplendorGame, (13, 19)),
            (PokemonSplendorGame, (1, 9, 14, 15)),
        )
        for game, seeds in cases:
            for seed in seeds:
                with self.subTest(game=game.game_id, seed=seed):
                    random.seed(seed)
                    state = game.init_game({"seed": seed}, _players())
                    for _ in range(180):
                        if state.get("game_over"):
                            break
                        player_id = state["current_turn"]
                        action = game.bot_move(state, player_id)
                        self.assertIsNotNone(action)
                        _, error = game.apply_action(state, player_id, action)
                        self.assertIsNone(error)
                    self.assertTrue(state.get("game_over"))


if __name__ == "__main__":
    unittest.main()
