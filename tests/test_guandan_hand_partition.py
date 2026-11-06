import functools
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai, guandan_hand
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


def cards_from_labels(labels):
    deck = guandan._full_deck()
    selected = set(pick_card_ids(deck, labels))
    return [card for card in deck if card["id"] in selected]


def exhaustive_minimum(hand, level):
    full = (1 << len(hand)) - 1
    options = [[] for card in hand]
    for mask in range(1, full + 1):
        selected = [card for index, card in enumerate(hand) if mask & (1 << index)]
        if guandan._evaluate_combo(selected, level, {}) is not None:
            for index in range(len(hand)):
                if mask & (1 << index):
                    options[index].append(mask)

    @functools.lru_cache(maxsize=None)
    def solve(mask):
        if not mask:
            return 0
        anchor = (mask & -mask).bit_length() - 1
        return 1 + min(solve(mask ^ group) for group in options[anchor] if mask & group == group)

    return solve(full)


class GuandanHandPartitionTests(unittest.TestCase):
    def assert_feasible(self, hand, level, partition):
        remaining = list(hand)
        for group in partition.groups:
            selected = []
            for category, quantity in enumerate(group):
                matches = [card for card in remaining
                           if guandan_hand.hand_resources([card], level)[category]]
                self.assertGreaterEqual(len(matches), quantity)
                for card in matches[:quantity]:
                    remaining.remove(card)
                    selected.append(card)
            self.assertIsNotNone(guandan._evaluate_combo(selected, level, {}))
        self.assertFalse(remaining)
        self.assertLessEqual(partition.lower_bound, partition.turns)
        if partition.complete:
            self.assertEqual(partition.lower_bound, partition.turns)

    def test_overlapping_triples_pairs_and_runs_cannot_reuse_cards(self):
        hand = cards_from_labels(["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4",
                                  "♠️5", "♣️5", "♦️5"])
        partition = guandan_hand.partition_hand(hand, 2)
        self.assert_feasible(hand, 2, partition)
        self.assertTrue(partition.complete)
        self.assertEqual(partition.turns, 2)
        self.assertEqual(guandan._estimated_turns_to_finish(hand, 2), 2.0)

    def test_boundary_groups_are_legal_and_resource_conserving(self):
        cases = [
            ([], 0), (["♥️2"], 1), (["♥️2", "♥️2"], 1),
            (["🃏S", "🃏S"], 1), (["🃏S", "🃏B"], 2),
            (["🃏S", "🃏S", "🃏B", "🃏B"], 1),
            (["♠️3", "♣️3", "♦️3", "🃏B", "🃏B"], 1),
            (["♠️A", "♣️A", "♠️2", "♣️2", "♠️3", "♣️3"], 1),
            (["♠️A", "♣️A", "♦️A", "♠️2", "♣️2", "♦️2"], 1),
            (["♠️5", "♣️5", "♠️6", "♣️6", "♥️2", "♥️2"], 1),
            (["♠️3", "♠️3", "♥️3", "♥️3", "♣️3", "♣️3", "♦️3", "♦️3",
              "♥️2", "♥️2"], 1),
        ]
        for labels, expected in cases:
            with self.subTest(labels=labels):
                hand = cards_from_labels(labels)
                partition = guandan_hand.partition_hand(hand, 2)
                self.assert_feasible(hand, 2, partition)
                self.assertTrue(partition.complete)
                self.assertEqual(partition.turns, expected)

    def test_small_hands_match_independent_physical_card_oracle(self):
        deck = guandan._full_deck()
        rng = random.Random(20261106)
        for level in (2, 7, 14):
            wilds = [card for card in deck if guandan._is_wild(card, level)]
            normals = [card for card in deck if not guandan._is_wild(card, level)]
            for size in (6, 8, 10):
                for wild_count in (0, 1, 2):
                    hand = wilds[:wild_count] + rng.sample(normals, size - wild_count)
                    with self.subTest(level=level, hand=[card["id"] for card in hand]):
                        partition = guandan_hand.partition_hand(hand, level)
                        self.assert_feasible(hand, level, partition)
                        self.assertTrue(partition.complete)
                        self.assertEqual(partition.turns, exhaustive_minimum(hand, level))

    def test_node_and_deadline_fallbacks_never_invent_a_cover_or_poison_cache(self):
        hand = cards_from_labels(["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4",
                                  "♠️5", "♣️5", "♦️5", "♥️2"])
        minimum = exhaustive_minimum(hand, 2)
        for settings in ({"node_limit": 0}, {"expired": lambda: True}):
            with self.subTest(settings=settings), mock.patch.dict(guandan_hand._COMPLETE_COVERS, {}, clear=True):
                limited = guandan_hand.partition_hand(hand, 2, **settings)
                self.assert_feasible(hand, 2, limited)
                self.assertLessEqual(limited.lower_bound, minimum)
                self.assertGreaterEqual(limited.turns, minimum)
                if not limited.complete:
                    self.assertNotIn(guandan_hand.hand_resources(hand, 2), guandan_hand._COMPLETE_COVERS)
                complete = guandan_hand.partition_hand(hand, 2)
                self.assertTrue(complete.complete)
                self.assertEqual(complete.turns, minimum)

    def test_resource_cache_ignores_identity_but_respects_wild_level(self):
        hand = cards_from_labels(["♥️2", "♠️3"])
        changed = [dict(card, id=card["id"] + 1000) for card in reversed(hand)]
        self.assertEqual(guandan_hand.partition_hand(hand, 2).turns, 1)
        self.assertEqual(guandan_hand.partition_hand(changed, 2).turns, 1)
        self.assertEqual(guandan_hand.partition_hand(hand, 7).turns, 2)

    def test_opening_replay_does_not_get_more_turns_after_spending_level_single(self):
        state = replay_fixture("88f335", 8)
        hand = state["players"][state["current_turn"]]["hand"]
        remaining = guandan._remove_cards(hand, pick_card_ids(hand, ["♣️2"]))
        self.assertEqual(guandan._estimated_turns_to_finish(hand, 2), 6.0)
        self.assertEqual(guandan._estimated_turns_to_finish(remaining, 2), 5.0)

    def test_nn_legacy_turn_cache_is_separate_and_restores_context(self):
        hand = cards_from_labels(["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4",
                                  "♠️5", "♣️5", "♦️5"])
        with mock.patch.object(guandan_ai, "_hand_state_value_components",
                               side_effect=lambda state, player, cards: guandan_ai._estimated_turns_to_finish(cards, 2)):
            legacy = guandan_ai.call(guandan, "_hand_state_value_components", {"config": {"bot_mode": "nn"}}, "bot", hand)
            current = guandan_ai.call(guandan, "_hand_state_value_components", {"config": {"bot_mode": "auto"}}, "bot", hand)
        self.assertEqual(legacy, 1.0)
        self.assertEqual(current, 2.0)
        self.assertFalse(getattr(guandan_ai._CORE_LOCAL, "legacy_heuristics", False))


if __name__ == "__main__":
    unittest.main()
