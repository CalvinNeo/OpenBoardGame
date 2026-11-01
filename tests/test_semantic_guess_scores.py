import json
import unittest

from game.semantic_guess_scores import build_score_reference, relative_closeness


class SemanticGuessScoreTests(unittest.TestCase):
    def test_dense_cosine_cluster_spreads_evenly_across_reference(self):
        reference = build_score_reference([0.29, 0.22, 0.23, 0.21])
        self.assertEqual(reference, [0.21, 0.22, 0.23, 0.29])
        self.assertEqual([relative_closeness(score, reference) for score in reference],
                         [0.125, 0.375, 0.625, 0.875])

    def test_ties_have_the_same_midrank_without_random_noise(self):
        reference = build_score_reference([0.2, 0.3, 0.3, 0.4])
        self.assertEqual(relative_closeness(0.3, reference), 0.5)
        self.assertEqual(relative_closeness(0.35, reference), 0.75)

    def test_mapping_preserves_order_including_scores_outside_reference(self):
        reference = build_score_reference([-0.2, 0.2, 0.3, 0.5])
        scores = [-1.0, -0.2, 0.0, 0.2, 0.25, 0.3, 0.5, 0.7, 1.0]
        relative = [relative_closeness(score, reference) for score in scores]
        self.assertEqual(relative, sorted(relative))
        self.assertEqual(relative[0], 0.0)
        self.assertEqual(relative[-1], 0.999)
        self.assertTrue(all(value < 1.0 for value in relative))

    def test_only_correct_word_receives_one_hundred_percent(self):
        reference = build_score_reference([0.2, 0.3])
        self.assertEqual(relative_closeness(1.0, reference), 0.999)
        self.assertEqual(relative_closeness(1.0, reference, correct=True), 1.0)
        self.assertEqual(relative_closeness(1.0, [], correct=True), 1.0)

    def test_bad_reference_values_are_omitted_and_json_safe(self):
        reference = build_score_reference([None, float("nan"), float("inf"),
                                           -float("inf"), -1.01, 1.01, 0.3, -0.2])
        self.assertEqual(reference, [-0.2, 0.3])
        self.assertEqual(json.loads(json.dumps(reference, allow_nan=False)), reference)

    def test_missing_or_invalid_distribution_falls_back_to_raw_score(self):
        self.assertIsNone(relative_closeness(0.3, []))
        self.assertIsNone(relative_closeness(0.3, [0.2]))
        self.assertIsNone(relative_closeness(float("nan"), [0.2, 0.3]))

    def test_fixed_reference_stays_unchanged_across_guesses(self):
        reference = build_score_reference([0.2, 0.3, 0.4])
        before = list(reference)
        first = relative_closeness(0.3, reference)
        relative_closeness(0.9, reference)
        self.assertEqual(relative_closeness(0.3, reference), first)
        self.assertEqual(reference, before)


if __name__ == "__main__":
    unittest.main()
