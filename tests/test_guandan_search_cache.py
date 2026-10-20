import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanBoundedHandCacheTests(unittest.TestCase):
    def setUp(self):
        self.hand = random.Random(23).sample(guandan._full_deck(), 17)

    def evaluate_leaf(self, exercise):
        def evaluate(_state, _bot_id):
            exercise()
            return 0.0

        with mock.patch.object(guandan_ai, "_evaluate_state_for_bot", side_effect=evaluate):
            guandan_ai.call(guandan, "_mcts_leaf_value", {}, "bot")

    def test_repeated_values_are_exact_and_metrics_cannot_mutate_cache(self):
        def exercise():
            cache = guandan_ai._CORE_LOCAL.bounded_hand_values
            metrics = guandan_ai._hand_structure_metrics(self.hand, 2)
            expected = dict(metrics)
            metrics["decomp_score"] = -999.0
            self.assertEqual(guandan_ai._hand_structure_metrics(self.hand, 2), expected)
            strength = guandan_ai._hand_strength_score(self.hand, 2)
            turns = guandan_ai._estimated_turns_to_finish(self.hand, 2)
            self.assertEqual(len(cache), 3)
            self.assertEqual(guandan_ai._hand_strength_score(self.hand, 2), strength)
            self.assertEqual(guandan_ai._estimated_turns_to_finish(self.hand, 2), turns)
            self.assertEqual(len(cache), 3)

            # Recompute without the per-call cache, including a different level.
            with mock.patch.object(guandan_ai._CORE_LOCAL, "bounded_hand_values", None):
                self.assertEqual(guandan_ai._hand_structure_metrics(self.hand, 2), expected)
                self.assertEqual(guandan_ai._hand_strength_score(self.hand, 2), strength)
                self.assertEqual(guandan_ai._estimated_turns_to_finish(self.hand, 2), turns)
                other_level = guandan_ai._hand_structure_metrics(self.hand, 7)
            self.assertEqual(guandan_ai._hand_structure_metrics(self.hand, 7), other_level)
            self.assertEqual(len(cache), 4)

        self.evaluate_leaf(exercise)
        self.assertFalse(hasattr(guandan_ai._CORE_LOCAL, "bounded_hand_values"))

    def test_cache_preserves_card_identity_order_and_scoring_mode(self):
        def exercise():
            cache = guandan_ai._CORE_LOCAL.bounded_hand_values
            guandan_ai._hand_structure_metrics(self.hand, 2)
            guandan_ai._hand_structure_metrics(list(reversed(self.hand)), 2)
            changed = [dict(card) for card in self.hand]
            changed[0]["id"] += 1000
            guandan_ai._hand_structure_metrics(changed, 2)
            self.assertEqual(len(cache), 3)
            with mock.patch.object(guandan_ai._CORE_LOCAL, "bounded_finalist_scoring", False):
                guandan_ai._hand_structure_metrics(self.hand, 2)
                guandan_ai._hand_strength_score(self.hand, 2)
                guandan_ai._estimated_turns_to_finish(self.hand, 2)
            self.assertEqual(len(cache), 3)

        self.evaluate_leaf(exercise)

    def test_expired_computation_is_not_cached(self):
        def exercise():
            with mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", -1.0, create=True):
                guandan_ai._hand_structure_metrics(self.hand, 2)
                guandan_ai._hand_strength_score(self.hand, 2)
                guandan_ai._estimated_turns_to_finish(self.hand, 2)
            self.assertEqual(guandan_ai._CORE_LOCAL.bounded_hand_values, {})

        self.evaluate_leaf(exercise)

    def test_nested_calls_share_cache_and_exception_cleans_up(self):
        def exercise():
            cache = guandan_ai._CORE_LOCAL.bounded_hand_values
            expected = guandan_ai._hand_structure_metrics(self.hand, 2)
            self.assertEqual(guandan_ai.call(guandan, "_hand_structure_metrics", self.hand, 2), expected)
            self.assertIs(guandan_ai._CORE_LOCAL.bounded_hand_values, cache)
            self.assertEqual(len(cache), 1)
            raise ValueError("interrupted leaf")

        with self.assertRaisesRegex(ValueError, "interrupted leaf"):
            self.evaluate_leaf(exercise)
        self.assertFalse(hasattr(guandan_ai._CORE_LOCAL, "bounded_hand_values"))


if __name__ == "__main__":
    unittest.main()
