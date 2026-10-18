import copy
import itertools
import unittest
from collections import Counter

from game import guandan, guandan_ai


class GuandanWildResourceTests(unittest.TestCase):
    def hand(self, ranks, wilds=0, level=2):
        deck = guandan._full_deck()
        cards = []
        for rank in ranks:
            card = next(c for c in deck if c.get("rank") == rank and not guandan._is_wild(c, level))
            deck.remove(card)
            cards.append(card)
        for _ in range(wilds):
            card = next(c for c in deck if guandan._is_wild(c, level))
            deck.remove(card)
            cards.append(card)
        return cards

    def call(self, name, *args):
        return guandan_ai.call(guandan, name, *args)

    def reserve(self, hand, level=2):
        bombs = self.call("_find_bomb_candidates", hand, level)
        return self.call("_independent_bomb_reserve", hand, level, bombs, 1.0)

    def test_inventory_allocates_wildcards_and_natural_copies_once(self):
        low = self.hand([8] * 3, 1)
        high = self.hand([13] * 3, 1)
        shared = self.hand([8] * 3 + [13] * 3, 1)
        independent = self.hand([8] * 3 + [13] * 3, 2)
        self.assertAlmostEqual(self.reserve(shared), max(self.reserve(low), self.reserve(high)))
        self.assertAlmostEqual(self.reserve(independent), self.reserve(low) + self.reserve(high))
        # The candidate generator initially reuses canonical rank copies. A
        # residual inventory must discover the second, disjoint natural bomb.
        self.assertAlmostEqual(self.reserve(self.hand([13] * 8)),
                               2 * self.reserve(self.hand([13] * 4)))

    def test_inventory_ignores_duplicate_options_and_physical_copy_order(self):
        hand = self.hand([8] * 3 + [13] * 3, 2)
        bombs = self.call("_find_bomb_candidates", hand, 2)
        expected = self.reserve(hand)
        self.assertEqual(self.call("_independent_bomb_reserve", hand, 2, bombs * 2, 1.0), expected)
        self.assertEqual(self.reserve(list(reversed(hand))), expected)
        copies = copy.deepcopy(hand)
        for card in copies:
            card["id"] += 108
        self.assertEqual(self.reserve(copies), expected)

    def test_two_wildcards_protect_the_second_bomb_support(self):
        hand = self.hand([3] * 3 + [13] * 3 + [5] * 2 + [8] * 2 + [11] * 2, 2)
        played = hand[:3]
        ids = [card["id"] for card in played]
        combo = guandan._evaluate_combo(played, 2, {})
        penalty = self.call("_route_wild_misuse_penalty", hand, ids, combo, 2, played)
        self.assertGreater(penalty, 0.0)
        self.assertAlmostEqual(penalty, self.call("_wild_structure_opportunity_loss", hand, ids, 2))
        # Realizing either planned bomb does not destroy the other allocation.
        for rank in (3, 13):
            bomb = [card for card in hand if card.get("rank") == rank]
            bomb.append(next(card for card in hand if guandan._is_wild(card, 2)))
            combo = guandan._evaluate_combo(bomb, 2, {})
            self.assertEqual(self.call("_route_wild_misuse_penalty", hand,
                                      [card["id"] for card in bomb], combo, 2, bomb), 0.0)

    def test_run_metadata_and_value_do_not_promote_the_level_rank(self):
        for kind, ranks, high in (("three_pairs", [5, 5, 6, 6, 7], 7),
                                  ("steel_plate", [5, 5, 5, 6, 6], 6)):
            values = []
            for level in range(2, 15):
                hand = self.hand(ranks, 1, level)
                options = self.call("_wild_structure_ranked_candidates", hand, level)
                option = next(c for c in options if c["kind"] == kind and c["high_value"] == high)
                combo = guandan._evaluate_combo_for_type(hand, level, {}, kind)
                self.assertEqual(option["high_value"], combo["high_value"])
                values.append(option["score"])
            self.assertEqual(min(values), max(values))

    def test_six_card_runs_match_independent_wildcard_assignment_oracle(self):
        # Enumerate assignments without using the materializer or run evaluators
        # under test. The old 'exact enumeration' reference shared those helpers
        # and could not detect a missing interpretation.
        checked = 0
        for wilds in (0, 1, 2):
            for ranks in itertools.combinations_with_replacement(range(3, 9), 6 - wilds):
                expected = {}
                for assignment in itertools.product(range(2, 15), repeat=wilds):
                    counts = Counter(ranks + assignment)
                    ordered = sorted(counts)
                    if ordered != list(range(ordered[0], ordered[-1] + 1)):
                        continue
                    kind = None
                    if len(counts) == 3 and set(counts.values()) == {2}:
                        kind = "three_pairs"
                    elif len(counts) == 2 and set(counts.values()) == {3}:
                        kind = "steel_plate"
                    if kind:
                        expected[kind] = max(expected.get(kind, 0), ordered[-1])
                for level in (2, 7, 14):
                    hand = self.hand(ranks, wilds, level)
                    actual = {c["type"]: c["high_value"]
                              for c in guandan._evaluate_combo_options(hand, level, {})
                              if c["type"] in ("three_pairs", "steel_plate")}
                    self.assertEqual(actual, expected, (ranks, wilds, level))
                    checked += 1
        self.assertGreater(checked, 2000)

    def test_low_ace_runs_are_complete_shapes_in_fast_and_full_plans(self):
        for ranks, kind in (([14, 14, 2, 2, 3, 3], "three_pairs"),
                            ([14, 14, 14, 2, 2, 2], "steel_plate")):
            for level in (2, 7, 14):
                hand = self.hand(ranks, level=level)
                for helper in ("_fast_hand_decomposition_summary", "_hand_decomposition_summary"):
                    with self.subTest(kind=kind, level=level, helper=helper):
                        summary = self.call(helper, hand, level)
                        self.assertEqual(summary["turns"], 1)
                        self.assertEqual(summary["grouped_cards"], 6)
                        self.assertEqual(summary["plan_types"][0], kind)

    def test_low_ace_wild_plans_account_for_real_rank_material(self):
        for ranks, kind, high, support in (
            ([14, 14, 2, 2, 3], "three_pairs", 3, {14: 2, 2: 2, 3: 1}),
            ([14, 14, 14, 2, 2], "steel_plate", 2, {14: 3, 2: 2}),
        ):
            hand = self.hand(ranks, wilds=1, level=7)
            candidates = self.call("_wild_structure_ranked_candidates", hand, 7)
            candidate = next(c for c in candidates if c["kind"] == kind and c["high_value"] == high)
            self.assertEqual(candidate["needed_wilds"], 1)
            self.assertEqual({rank: count for suit, rank, count in candidate["requirements"]}, support)
            self.assertTrue(self.call("_public_pool_supports_same_type_reply", hand, 6, 7,
                                      {"type": kind, "high_value": high - 1}))
            self.assertFalse(self.call("_public_pool_supports_same_type_reply", hand, 6, 7,
                                       {"type": kind, "high_value": high}))

    def test_low_ace_pair_run_gets_the_same_break_protection_as_other_runs(self):
        for ranks in ((14, 2, 3), (2, 3, 4), (12, 13, 14)):
            hand = self.hand([rank for rank in ranks for _ in range(2)], level=7)
            for rank in ranks:
                pair = [card for card in hand if card["rank"] == rank]
                features = {"play_cards": pair, "before_counts": dict.fromkeys(ranks, 2)}
                combo = guandan._evaluate_combo(pair, 7, {})
                self.assertEqual(self.call("_lead_shared_pair_run_break_penalty", features, combo, 7), 4.2)


if __name__ == "__main__":
    unittest.main()
