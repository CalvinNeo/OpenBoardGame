import copy
import functools
import itertools
import random
import unittest
from unittest import mock

from game import guandan, guandan_trick as trick
from tests.test_guandan_trick_boundary import make_state


def independent_pace(combo):
    if combo["type"] in ("bomb", "straight_flush", "heavenly"):
        return 0.7
    if combo["type"] in ("straight", "three_pairs", "steel_plate"):
        strength = (combo["high_value"] - 5) / 9
    else:
        strength = (combo["rank_value"] - 49) / 51
    return 1.0 - 0.3 * max(0.0, min(1.0, strength))


def exhaustive_pace(hand, level):
    options = []
    for size in range(1, len(hand) + 1):
        for indexes in itertools.combinations(range(len(hand)), size):
            combo = guandan._evaluate_combo([hand[index] for index in indexes], level, {})
            if combo:
                options.append((sum(1 << index for index in indexes), independent_pace(combo)))

    @functools.lru_cache(None)
    def best(remaining):
        if not remaining:
            return 0.0
        first = remaining & -remaining
        return min(cost + best(remaining ^ mask) for mask, cost in options
                   if mask & first and mask & remaining == mask)

    return best((1 << len(hand)) - 1)


class TrickResourcePlanTests(unittest.TestCase):
    def rank_hand(self, ranks):
        state = make_state({"bot": ranks, "opp": [14], "mate": [12], "opp2": [13]})
        return state["players"]["bot"]["hand"]

    def assert_valid_cover(self, hand, level, plan):
        by_id = guandan._map_hand_by_id(hand)
        used = [card_id for group in plan["groups"] for card_id in group["cards"]]
        self.assertCountEqual(used, by_id)
        self.assertEqual(len(used), len(set(used)))
        total = 0.0
        for group in plan["groups"]:
            combo = guandan._evaluate_combo([by_id[card_id] for card_id in group["cards"]], level, {})
            self.assertIsNotNone(combo)
            self.assertEqual(group["type"], combo["type"])
            total += independent_pace(combo)
        self.assertAlmostEqual(plan["pace"], total)

    def test_two_bombs_are_not_greedily_split_into_plate_and_singles(self):
        hand = self.rank_hand([3] * 4 + [4] * 4)
        plan = trick.resource_plan(hand, 2, trick.TrickBudget())
        self.assert_valid_cover(hand, 2, plan)
        self.assertEqual([group["type"] for group in plan["groups"]], ["bomb", "bomb"])
        self.assertAlmostEqual(plan["pace"], 1.4)

    def test_long_hand_also_compares_control_preserving_cover(self):
        hand = self.rank_hand([3] * 4 + [4] * 4 + [7, 9, 11, 13])
        plan = trick.resource_plan(hand, 2, trick.TrickBudget())
        self.assert_valid_cover(hand, 2, plan)
        self.assertEqual(sum(group["type"] == "bomb" for group in plan["groups"]), 2)
        self.assertLess(plan["pace"], 5.4)

    def test_three_bombs_can_be_reallocated_to_two_pair_runs(self):
        hand = self.rank_hand([3] * 4 + [4] * 4 + [5] * 4)
        plan = trick.resource_plan(hand, 2, trick.TrickBudget())
        self.assert_valid_cover(hand, 2, plan)
        self.assertEqual([group["type"] for group in plan["groups"]], ["three_pairs", "three_pairs"])
        self.assertLess(plan["pace"], 2.1)

    def test_small_hands_match_independent_exhaustive_partition(self):
        deck = guandan._full_deck()
        for level in (2, 7, 14):
            wilds = [card for card in deck if card["rank"] == level and card["suit"] == "hearts"]
            pool = [card for card in deck if card not in wilds]
            for seed in range(8):
                hand = random.Random(seed).sample(pool, 6) + wilds[:seed % 3]
                with self.subTest(level=level, seed=seed):
                    plan = trick.resource_plan(hand, level, trick.TrickBudget())
                    self.assert_valid_cover(hand, level, plan)
                    self.assertAlmostEqual(plan["pace"], exhaustive_pace(hand, level))

    def test_long_plan_consumes_each_wildcard_once_and_ignores_input_order(self):
        hand = self.rank_hand([3] * 3 + [7] * 3 + [4, 5, 6, 8, 9, 10])
        hand += [card for card in guandan._full_deck() if card["rank"] == 2 and card["suit"] == "hearts"]
        before = copy.deepcopy(hand)
        plan = trick.resource_plan(hand, 2, trick.TrickBudget())
        self.assert_valid_cover(hand, 2, plan)
        self.assertEqual(plan, trick.resource_plan(list(reversed(hand)), 2, trick.TrickBudget()))
        self.assertEqual(hand, before)

    def test_empty_hand_has_zero_pace(self):
        plan = trick.resource_plan([], 2, trick.TrickBudget())
        self.assertEqual(plan["groups"], [])
        self.assertEqual(plan["pace"], 0.0)

    def test_interrupted_cover_is_not_returned_or_cached(self):
        hand = self.rank_hand([3] * 4 + [4] * 4)
        budget = trick.TrickBudget()
        with mock.patch.object(budget, "check", side_effect=[None, trick.IncompleteTrick("deadline")]):
            with self.assertRaisesRegex(trick.IncompleteTrick, "deadline"):
                trick.resource_plan(hand, 2, budget)
        plan = trick.resource_plan(hand, 2, trick.TrickBudget())
        self.assertAlmostEqual(plan["pace"], 1.4)


if __name__ == "__main__":
    unittest.main()
