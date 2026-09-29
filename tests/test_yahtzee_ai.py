import copy
import gzip
import hashlib
import json
import random
import unittest
from itertools import product
from unittest.mock import patch

from jsonschema import ValidationError, validate

from game.definitions import YAHTZEE_ACTION_SCHEMA, YAHTZEE_CONFIG_SCHEMA
from game.yahtzee import CATEGORY_ORDER, YahtzeeGame, _calculate_possible_scores, _total_score
from game.yahtzee_ai import (
    ALL_CATEGORIES, TABLE_PATH, YAHTZEE_BIT, _dice_graph, _load_table,
    _roll_expectations, _table_index, _turn_policy, expected_remaining_score,
)


def make_state(dice=(1, 2, 3, 4, 5), roll_count=1, remaining=None, strategy="dynamic_programming"):
    state = YahtzeeGame.init_game({"bot_strategy": strategy}, [
        {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
    ])
    state.update(dice=list(dice), roll_count=roll_count)
    if remaining is not None:
        state["players"]["bot"]["score_sheet"] = {
            cat: None if cat in remaining else 0 for cat in CATEGORY_ORDER
        }
    return state


def finish_locks(state):
    """Run ordinary lock actions until the bot commits to a roll or score."""
    for _ in range(6):
        action = YahtzeeGame.bot_move(state, "bot")
        validate(action, YAHTZEE_ACTION_SCHEMA)
        if action["type"] != "toggle_lock":
            return action
        _, error = YahtzeeGame.apply_action(state, "bot", action)
        if error:
            raise AssertionError(error)
    raise AssertionError("Bot did not converge on a set of kept dice")


class YahtzeeAITests(unittest.TestCase):
    def test_config_accepts_both_strategies_and_defaults_to_original(self):
        for config in ({}, {"bot_strategy": "classic"}, {"bot_strategy": "dynamic_programming"}):
            validate(config, YAHTZEE_CONFIG_SCHEMA)
        self.assertEqual(YahtzeeGame.init_game({}, [])["config"]["bot_strategy"], "classic")
        with self.assertRaises(ValidationError):
            validate({"bot_strategy": "unknown"}, YAHTZEE_CONFIG_SCHEMA)
        with self.assertRaises(ValueError):
            YahtzeeGame.init_game({"bot_strategy": "unknown"}, [])

    def test_old_save_and_classic_keep_original_random_greedy_behavior(self):
        for config in ({}, {"bot_strategy": "classic"}):
            state = make_state((6, 6, 6, 6, 1))
            state["config"] = config
            with patch("game.yahtzee.random.random", return_value=0.1):
                self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "roll"})
            with patch("game.yahtzee.random.random", return_value=0.9):
                self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "score", "category": "three_kind"})

    def test_configuration_survives_save_and_public_view(self):
        state = make_state()
        restored = YahtzeeGame.deserialize(json.loads(json.dumps(YahtzeeGame.serialize(state))))
        self.assertEqual(YahtzeeGame.get_public_view(restored, "bot")["config"]["bot_strategy"], "dynamic_programming")
        self.assertEqual(YahtzeeGame.bot_move(restored, "bot"), YahtzeeGame.bot_move(state, "bot"))
        restored.pop("config")
        self.assertEqual(YahtzeeGame.get_public_view(restored, "bot")["config"]["bot_strategy"], "classic")

    def test_first_roll_and_inactive_players(self):
        state = make_state(roll_count=0)
        self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "roll"})
        self.assertIsNone(YahtzeeGame.bot_move(state, "other"))
        state["game_over"] = True
        self.assertIsNone(YahtzeeGame.bot_move(state, "bot"))

    def test_planning_is_repeatable_and_does_not_change_state_or_rng(self):
        state = make_state((5, 5, 5, 2, 2))
        before, rng = copy.deepcopy(state), random.getstate()
        action = YahtzeeGame.bot_move(state, "bot")
        self.assertEqual(YahtzeeGame.bot_move(state, "bot"), action)
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), rng)

    def test_last_chance_keeps_five_or_six_with_two_rerolls(self):
        state = make_state((1, 3, 4, 5, 6), remaining=["chance"])
        self.assertEqual(finish_locks(state), {"type": "roll"})
        self.assertEqual(state["locked"], [False, False, False, True, True])

    def test_last_chance_keeps_four_as_well_with_one_reroll(self):
        state = make_state((1, 3, 4, 5, 6), roll_count=2, remaining=["chance"])
        self.assertEqual(finish_locks(state), {"type": "roll"})
        self.assertEqual(state["locked"], [False, False, True, True, True])

    def test_opening_four_sixes_uses_upper_box_instead_of_larger_immediate_score(self):
        state = make_state((6, 6, 6, 6, 1), roll_count=3)
        self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "score", "category": "sixes"})

    def test_opening_full_house_keeps_high_triple_with_two_rerolls(self):
        state = make_state((2, 5, 2, 5, 5))
        self.assertEqual(finish_locks(state), {"type": "roll"})
        self.assertEqual(state["locked"], [False, True, False, True, True])

    def test_made_yahtzee_scores_immediately(self):
        state = make_state((4, 4, 4, 4, 4))
        self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "score", "category": "yahtzee"})

    def test_upper_bonus_changes_final_scoring_choice(self):
        state = make_state((6, 6, 6, 2, 3), roll_count=3, remaining=["sixes", "chance"])
        sheet = state["players"]["bot"]["score_sheet"]
        sheet.update(ones=3, twos=6, threes=9, fours=12, fives=15)
        self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "score", "category": "sixes"})

    def test_joker_forced_upper_is_obeyed(self):
        state = make_state((4, 4, 4, 4, 4), roll_count=3)
        state["players"]["bot"]["score_sheet"]["yahtzee"] = 50
        self.assertEqual(YahtzeeGame.bot_move(state, "bot"), {"type": "score", "category": "fours"})

    def test_bonus_active_can_chase_yahtzee_even_when_only_straight_is_open(self):
        state = make_state((1, 2, 3, 3, 3), roll_count=2, remaining=["large_straight"])
        state["players"]["bot"]["score_sheet"]["yahtzee"] = 50
        self.assertEqual(finish_locks(state), {"type": "roll"})
        self.assertEqual(state["locked"], [False, False, True, True, True])

    def test_local_joker_zero_and_full_house_rules(self):
        # The local engine allows five of a kind as a full house but only
        # enables Joker straights if Yahtzee was previously scored as 50.
        for yahtzee_score, expected in ((0, 0), (50, 140)):
            state = make_state((2,) * 5, roll_count=3, remaining=["large_straight"])
            state["players"]["bot"]["score_sheet"]["yahtzee"] = yahtzee_score
            before = _total_score(state["players"]["bot"])
            action = YahtzeeGame.bot_move(state, "bot")
            _, error = YahtzeeGame.apply_action(state, "bot", action)
            self.assertIsNone(error)
            self.assertEqual(_total_score(state["players"]["bot"]) - before, expected)
        state = make_state((2,) * 5, roll_count=3, remaining=["full_house"])
        YahtzeeGame.apply_action(state, "bot", YahtzeeGame.bot_move(state, "bot"))
        self.assertEqual(state["players"]["bot"]["score_sheet"]["full_house"], 25)

    def test_joker_forced_zero_still_collects_bonus(self):
        state = make_state((2,) * 5, roll_count=3, remaining=["ones", "threes"])
        sheet = state["players"]["bot"]["score_sheet"]
        sheet["yahtzee"] = 50
        action = YahtzeeGame.bot_move(state, "bot")
        self.assertIn(action["category"], ("ones", "threes"))
        _, error = YahtzeeGame.apply_action(state, "bot", action)
        self.assertIsNone(error)
        self.assertEqual(sheet[action["category"]], 0)
        self.assertEqual(state["players"]["bot"]["yahtzee_bonus"], 100)

    def test_existing_locks_are_reused_or_released_without_looping(self):
        state = make_state((1, 6, 6, 4, 2), roll_count=2, remaining=["chance"])
        state["locked"] = [True, False, True, False, True]
        self.assertEqual(finish_locks(state), {"type": "roll"})
        self.assertEqual(state["locked"], [False, True, True, True, False])

    def test_all_rolls_produce_legal_moves_in_opening_and_joker_endgame(self):
        for bonus in (False, True):
            for dice in _dice_graph()[3]:
                for roll_count in (1, 2, 3):
                    state = make_state(dice, roll_count, remaining=["ones", "large_straight"] if bonus else None)
                    if bonus:
                        state["players"]["bot"]["score_sheet"]["yahtzee"] = 50
                    action = finish_locks(state)
                    _, error = YahtzeeGame.apply_action(state, "bot", action)
                    self.assertIsNone(error, (dice, roll_count, action))

    def test_complete_games_finish_with_valid_scores(self):
        rng_state = random.getstate()
        try:
            for strategy in ("classic", "dynamic_programming"):
                random.seed(73811)
                players = [{"player_id": f"p{i}", "name": f"Bot {i}", "seat": i, "is_bot": True} for i in range(4)]
                state = YahtzeeGame.init_game({"bot_strategy": strategy}, players)
                for _ in range(13 * 4 * 14):
                    if state["game_over"]:
                        break
                    bot = state["current_player"]
                    action = YahtzeeGame.bot_move(state, bot)
                    validate(action, YAHTZEE_ACTION_SCHEMA)
                    _, error = YahtzeeGame.apply_action(state, bot, action)
                    self.assertIsNone(error)
                self.assertTrue(state["game_over"], strategy)
                self.assertTrue(state["winner"])
                for player in state["players"].values():
                    self.assertTrue(all(score is not None for score in player["score_sheet"].values()))
        finally:
            random.setstate(rng_state)


class YahtzeePolicyTableTests(unittest.TestCase):
    def test_packaged_table_integrity_and_category_order(self):
        metadata = json.loads(TABLE_PATH.with_suffix("").with_suffix(".json").read_text())
        self.assertEqual(metadata["categories"], CATEGORY_ORDER)
        self.assertEqual(len(_load_table()), metadata["entries"])
        self.assertEqual(hashlib.sha256(gzip.decompress(TABLE_PATH.read_bytes())).hexdigest(), metadata["sha256_uncompressed"])

    def test_expectations_match_ordered_dice_enumeration(self):
        hands, children, _, rolls = _dice_graph()
        # A nonlinear payoff catches mistaken equal weighting of unordered rolls.
        values = tuple(float(sum(dice) ** 2 + (100 if len(set(dice)) == 1 else 0)) for dice in rolls)
        expected = _roll_expectations(values)
        payoffs = dict(zip(rolls, values))
        for kept in ((), (6,), (1, 1), (2, 3, 4), (5, 5, 5, 5)):
            total = sum(payoffs[tuple(sorted(kept + rolled))] for rolled in product(range(1, 7), repeat=5 - len(kept)))
            counts = tuple(kept.count(face) for face in range(1, 7))
            self.assertAlmostEqual(expected[hands.index(counts)], total / 6 ** (5 - len(kept)), places=10)
        self.assertEqual((len(children), len(rolls), len(hands)), (210, 252, 462))

    def test_last_box_values_have_analytic_solutions(self):
        chance = make_state(remaining=["chance"])["players"]["bot"]["score_sheet"]
        self.assertAlmostEqual(expected_remaining_score(chance), 5 * 14 / 3, places=5)
        for face, cat in enumerate(CATEGORY_ORDER[:6], 1):
            sheet = make_state(remaining=[cat])["players"]["bot"]["score_sheet"]
            self.assertAlmostEqual(expected_remaining_score(sheet), face * 5 * (1 - (5 / 6) ** 3), places=5)

    def test_upper_bonus_is_counted_only_when_newly_earned(self):
        sheet = make_state(remaining=["ones"])["players"]["bot"]["score_sheet"]
        sheet.update(twos=10, threes=12, fours=20, fives=20, sixes=0)
        ones_mean = 5 * (1 - (5 / 6) ** 3)
        # At 62, at least one 1 among the fifteen opportunities earns the bonus.
        self.assertAlmostEqual(expected_remaining_score(sheet), ones_mean + 35 * (1 - (5 / 6) ** 15), places=5)
        sheet["fives"] = 25  # Bonus already earned: never collect it a second time.
        self.assertAlmostEqual(expected_remaining_score(sheet), ones_mean, places=5)

    def test_exported_values_satisfy_bellman_equation(self):
        samples = [(ALL_CATEGORIES, 0, False), (0, 63, True)]
        rng = random.Random(612)
        for _ in range(30):
            mask = rng.randrange(1, ALL_CATEGORIES + 1)
            samples.append((mask, rng.randrange(64), bool(rng.randrange(2)) and not mask & YAHTZEE_BIT))
        for mask, upper, bonus in samples:
            stored = _load_table()[_table_index(mask, upper, bonus)]
            if not mask:
                self.assertEqual(stored, 0)
                continue
            _, values, _ = _turn_policy(mask, upper, bonus)
            recomputed = _roll_expectations(values[2])[0]
            self.assertAlmostEqual(stored, recomputed, delta=0.00005, msg=str((mask, upper, bonus)))

    def test_last_reroll_matches_independent_brute_force(self):
        # This oracle enumerates ordered rolls and uses the scoring engine;
        # it does not reuse the policy's dice graph or precomputed transitions.
        for dice, remaining, bonus in [
            ((1, 2, 2, 3, 5), "small_straight", False),
            ((1, 2, 3, 3, 3), "large_straight", True),
            ((1, 1, 2, 2, 6), "full_house", False),
        ]:
            state = make_state(dice, 2, [remaining])
            sheet = state["players"]["bot"]["score_sheet"]
            if bonus:
                sheet["yahtzee"] = 50
            def payoff(result):
                scores, _, joker = _calculate_possible_scores(list(result), sheet)
                return scores[remaining] + (100 if joker else 0)
            options = {}
            for flags in product((False, True), repeat=5):
                kept = tuple(die for die, keep in zip(dice, flags) if keep)
                if kept not in options:
                    options[kept] = sum(payoff(kept + result) for result in product(range(1, 7), repeat=5 - len(kept))) / 6 ** (5 - len(kept))
            action = finish_locks(state)
            kept = tuple(dice) if action["type"] == "score" else tuple(die for die, keep in zip(dice, state["locked"]) if keep)
            self.assertAlmostEqual(options[kept], max(options.values()), places=10)


if __name__ == "__main__":
    unittest.main()
