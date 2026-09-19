from collections import Counter
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanFeasibleTurnsTests(unittest.TestCase):
    def setUp(self):
        for name in ("_HAND_DECOMP_CACHE", "_HAND_GLOBAL_DECOMP_CACHE",
                     "_HAND_STRUCTURE_CACHE", "_HAND_STRENGTH_CACHE", "_HAND_TURNS_CACHE"):
            getattr(guandan_ai, name).clear()

    def hand(self, ranks, level_rank=2):
        deck = guandan._full_deck()
        cards = []
        for rank in ranks:
            card = next(card for card in deck
                        if card.get("rank") == rank and not card.get("joker")
                        and not (rank == level_rank and card.get("suit") == "hearts"))
            deck.remove(card)
            cards.append(card)
        return cards

    def call(self, name, *args):
        return guandan_ai.call(guandan, name, *args)

    def assert_feasible_natural_plans(self, hand, level_rank=2):
        counts = Counter(card["rank"] for card in hand)
        for full_houses_first in (False, True):
            with self.subTest(full_houses_first=full_houses_first):
                plan = self.call("_fast_natural_hand_plan", counts, level_rank, full_houses_first)
                available = list(hand)
                used_ids = []
                for combo_type, ranks in plan:
                    cards = []
                    for rank in ranks:
                        card = next(card for card in available if card["rank"] == rank)
                        available.remove(card)
                        cards.append(card)
                    used_ids.extend(card["id"] for card in cards)
                    combo = guandan._evaluate_combo(cards, level_rank, {})
                    self.assertIsNotNone(combo)
                    # A natural suited straight can also be a straight flush.
                    self.assertIn(combo["type"], ("straight", "straight_flush")
                                  if combo_type == "straight" else (combo_type,))
                self.assertFalse(available)
                self.assertEqual(len(used_ids), len(set(used_ids)))
                self.assertCountEqual(used_ids, [card["id"] for card in hand])

    def test_fast_plan_uses_two_disjoint_full_houses_when_they_save_a_turn(self):
        hand = self.hand([13] * 3 + [14] * 3 + [3] * 2 + [4] * 2)
        self.assert_feasible_natural_plans(hand)
        summary = self.call("_fast_hand_decomposition_summary", hand, 2)
        self.assertEqual(summary["turns"], 2.0)
        self.assertEqual(summary["plan_types"], ("full_house", "full_house"))
        self.assertEqual(self.call("_hand_decomposition_summary", hand, 2)["turns"], 2.0)

    def test_fast_plan_preserves_steel_and_three_pairs_when_they_save_a_turn(self):
        hand = self.hand([7] * 3 + [8] * 3 + [4] * 2 + [5] * 2 + [6] * 2)
        self.assert_feasible_natural_plans(hand)
        summary = self.call("_fast_hand_decomposition_summary", hand, 2)
        self.assertEqual(summary["turns"], 2.0)
        self.assertCountEqual(summary["plan_types"], ("steel_plate", "three_pairs"))

    def test_full_house_plans_cannot_reuse_a_pair_or_a_consumed_triple(self):
        for ranks in ([3] * 3 + [4] * 3 + [5] * 2,
                      [3] * 3 + [4] * 3 + [5] * 3,
                      [13] * 3 + [14] * 3 + [3] * 2):
            with self.subTest(ranks=ranks):
                hand = self.hand(ranks)
                self.assert_feasible_natural_plans(hand)
                self.assertGreaterEqual(self.call("_fast_hand_decomposition_summary", hand, 2)["turns"], 2.0)

    def test_overlapping_shapes_do_not_make_fifteen_cards_a_single_turn(self):
        hand = self.hand([2] * 2 + [3] * 2 + [4] * 2 + [5] * 3 + [6] * 3 + [11] * 3)
        self.assert_feasible_natural_plans(hand)
        for bounded in (False, True):
            with self.subTest(bounded=bounded), mock.patch.object(
                guandan_ai._CORE_LOCAL, "bounded_finalist_scoring", bounded, create=True
            ):
                turns = self.call("_estimated_turns_to_finish", hand, 2)
                self.assertGreaterEqual(turns, 3.0)
                self.assertLess(turns, 4.0)

    def test_saved_opening_fewer_feasible_turns_cannot_score_as_more_turns(self):
        labels = ["♣️2", "♣️2", "♣️K", "♦️K", "♠️K", "♥️K", "♦️Q",
                  "♦️J", "♥️J", "♦️J", "♠️J", "♠️10", "♦️9", "♦️9", "♠️9",
                  "♠️8", "♥️7", "♣️6", "♥️6", "♥️5", "♥️5", "♥️4", "♥️4",
                  "♠️4", "♥️3", "♣️3", "♣️3"]
        deck = guandan._full_deck()
        hand = []
        for label in labels:
            card = next(card for card in deck if guandan._card_label(card) == label)
            hand.append(card)
            deck.remove(card)
        after_steel = [card for card in hand if card["rank"] not in (3, 4)]
        after_full_house = [card for card in hand if card["rank"] not in (3, 5)]
        for bounded in (False, True):
            with self.subTest(bounded=bounded), mock.patch.object(
                guandan_ai._CORE_LOCAL, "bounded_finalist_scoring", bounded, create=True
            ):
                steel = self.call("_hand_decomposition_summary", after_steel, 2)
                full = self.call("_hand_decomposition_summary", after_full_house, 2)
                self.assertEqual((steel["turns"], full["turns"]), (8.0, 7.0))
                self.assertEqual((steel["bomb_turns"], full["bomb_turns"]), (2.0, 2.0))
                self.assertLess(self.call("_estimated_turns_to_finish", after_full_house, 2),
                                self.call("_estimated_turns_to_finish", after_steel, 2))

    def test_real_one_play_hands_remain_one_turn_in_bounded_mode(self):
        deck = guandan._full_deck()
        wild = next(card for card in deck if card["rank"] == 2 and card["suit"] == "hearts")
        heavenly = [card for card in deck if card.get("joker")]
        cases = [heavenly, self.hand([7] * 3) + [wild],
                 self.hand([3, 4, 5, 6]) + [wild], self.hand([3])]
        with mock.patch.object(guandan_ai._CORE_LOCAL, "bounded_finalist_scoring", True, create=True):
            for hand in cases:
                with self.subTest(labels=[guandan._card_label(card) for card in hand]):
                    self.assertIsNotNone(guandan._evaluate_combo(hand, 2, {}))
                    self.assertEqual(self.call("_fast_hand_decomposition_summary", hand, 2)["turns"], 1.0)
                    self.assertEqual(self.call("_estimated_turns_to_finish", hand, 2), 1.0)


if __name__ == "__main__":
    unittest.main()
