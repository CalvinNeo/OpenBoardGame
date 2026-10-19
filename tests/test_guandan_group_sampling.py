import copy
import itertools
import math
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.test_guandan_trick_boundary import make_state, play


class GuandanGroupSamplingTests(unittest.TestCase):
    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    def take(self, labels):
        deck = guandan._full_deck()
        cards = []
        for label in labels:
            card = next(card for card in deck if guandan._card_label(card) == label)
            deck.remove(card)
            cards.append(card)
        return cards

    def profile(self, free, locked, size, level=2, deadline=None):
        return self.call("_retained_group_proposal_profile", free, locked, size, level, deadline)

    def assert_physical_count(self, pool, locked_count, size, level):
        locked, free = pool[:locked_count], pool[locked_count:]
        hands = list(itertools.combinations(free, size - locked_count))
        expected = sum(bool(guandan._evaluate_combo(locked + list(hand), level, {})) for hand in hands)
        profile = self.profile(free, locked, size, level)
        self.assertEqual(profile["ways"], expected)
        self.assertAlmostEqual(profile["probability"], expected / len(hands))

    def test_histogram_counts_match_independent_physical_subsets(self):
        rng = random.Random(123)
        for level in (2, 7, 14):
            for size in range(2, 7):
                for index in range(6):
                    with self.subTest(level=level, size=size, locked=index % 3):
                        pool = rng.sample(guandan._full_deck(), 10)
                        self.assert_physical_count(pool, index % 3, size, level)

    def test_ambiguous_wild_groups_and_flushes_are_not_double_counted(self):
        for labels, size, level in (
            (["♠️5", "♣️5", "♠️6", "♣️6", "♥️2", "♥️2", "♦️7"], 6, 2),
            (["♠️3", "♠️4", "♠️5", "♠️6", "♥️2", "♥️2", "♦️7"], 5, 2),
            (["♠️A", "♣️A", "♠️2", "♣️2", "♠️3", "♣️3", "♥️7"], 6, 7),
            (["♠️A", "♣️A", "♦️A", "♠️2", "♣️2", "♦️2", "♥️7"], 6, 7),
            (["🃏B", "🃏B", "🃏S", "🃏S", "♥️2", "♠️4", "♣️4"], 4, 2),
            (["🃏B", "🃏B", "♠️4", "♣️4", "♥️2", "♥️2", "♦️5"], 5, 2),
        ):
            pool = self.take(labels)
            for locked in (0, 1, 2):
                self.assert_physical_count(pool, locked, size, level)

    def test_class_weights_count_physical_copies(self):
        pool = self.take(["♠️4", "♣️4", "♦️4", "♠️5", "♣️5"])
        profile = self.profile(pool, [], 2)
        self.assertEqual(profile["ways"], 4)  # Three distinct fours pairs and one fives pair.
        self.assertAlmostEqual(profile["probability"], 4 / 10)
        rng = random.Random(19)
        counts = {}
        for _ in range(2000):
            hand = self.call("_draw_retained_group", profile, rng)
            key = tuple(sorted(card["id"] for card in hand))
            counts[key] = counts.get(key, 0) + 1
        self.assertEqual(len(counts), 4)
        self.assertTrue(all(400 < value < 600 for value in counts.values()))

    def test_group_draw_keeps_locks_and_does_not_duplicate_cards(self):
        pool = self.take(["♠️4", "♣️4", "♦️4", "♥️4", "♥️2", "♥️2", "♠️5"])
        profile = self.profile(pool[1:], pool[:1], 4)
        for seed in range(30):
            hand = self.call("_draw_retained_group", profile, random.Random(seed))
            self.assertEqual(len({card["id"] for card in hand}), 4)
            self.assertIn(pool[0], hand)
            self.assertIsNotNone(guandan._evaluate_combo(hand, 2, {}))

    def test_joint_mixture_density_and_importance_correction_are_exact(self):
        pool = self.take(["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4", "♠️5", "♣️5"])
        profiles = {"first": self.profile(pool, [], 2), "second": self.profile(pool, [], 3)}
        assignments = []
        for first in itertools.combinations(range(8), 2):
            remaining = [index for index in range(8) if index not in first]
            for second in itertools.combinations(remaining, 3):
                groups = {pid: bool(guandan._evaluate_combo([pool[index] for index in hand], 2, {}))
                          for pid, hand in (("first", first), ("second", second))}
                assignments.append(groups)
        mass = corrected_mass = corrected_first = exact_mass = exact_first = 0.0
        for groups in assignments:
            ratio = self.call("_retained_group_proposal_density", groups, profiles, 0.5)
            probability = ratio / len(assignments)
            likelihood = math.prod(16 if grouped else 1 for grouped in groups.values())
            mass += probability
            corrected_mass += probability * likelihood / ratio
            corrected_first += probability * likelihood / ratio * groups["first"]
            exact_mass += likelihood / len(assignments)
            exact_first += likelihood / len(assignments) * groups["first"]
            self.assertGreaterEqual(ratio, 0.5)  # Every legal nongroup deal remains supported.
        self.assertAlmostEqual(mass, 1.0)
        self.assertAlmostEqual(corrected_mass, exact_mass)
        self.assertAlmostEqual(corrected_first, exact_first)

    def test_interrupted_profile_is_not_cached(self):
        pool = self.take(["♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5", "♥️2"])
        guandan_ai._RETAINED_GROUP_PROFILES.clear()
        self.call("_retained_group_shapes", 6)
        with mock.patch.object(guandan_ai, "_deadline_expired", side_effect=[False, True]):
            self.assertIsNone(self.profile(pool, [], 6))
        self.assertFalse(guandan_ai._RETAINED_GROUP_PROFILES)
        self.assertGreater(self.profile(pool, [], 6)["ways"], 0)

    def test_interrupted_shape_enumeration_is_not_cached(self):
        guandan_ai._RETAINED_GROUP_SHAPES.clear()
        with mock.patch.object(guandan_ai, "_deadline_expired", side_effect=[False, True]):
            self.assertIsNone(self.call("_retained_group_shapes", 5))
        self.assertFalse(guandan_ai._RETAINED_GROUP_SHAPES)
        self.assertTrue(self.call("_retained_group_shapes", 5))

    def test_profile_cache_distinguishes_locks_and_level(self):
        pool = self.take(["♠️4", "♣️4", "♦️4", "♥️2", "♠️5"])
        self.assertGreater(self.profile(pool, [], 4, 2)["ways"], 0)
        self.assertEqual(self.profile(pool, [], 4, 7)["ways"], 0)
        self.assertEqual(self.profile(pool[:-1], pool[-1:], 4, 2)["ways"], 0)

    def state(self):
        state = make_state({"bot": [3], "opp": [4, 4, 4, 4, 9], "mate": [5, 6], "opp2": [7, 8]})
        state["current_turn"] = "opp"
        card = next(card for card in state["players"]["opp"]["hand"] if card["rank"] == 9)
        _, error = guandan.GuandanGame.apply_action(state, "opp", play([card["id"]]))
        self.assertIsNone(error)
        state.pop("_ai_sampled_world")
        state["current_turn"] = "bot"
        state["config"].update(bot_determinize_retained_group_odds=16.0,
                               bot_determinize_group_proposal_fraction=0.5,
                               bot_determinize_samples=5)
        return state

    def test_sampler_preserves_physical_partition_public_locks_and_hidden_invariance(self):
        state = self.state()
        known = state["players"]["opp"]["hand"][0]["id"]
        state["known_card_owners"] = {str(known): "opp"}
        expected_ids = {card["id"] for data in state["players"].values() for card in data["hand"]}
        before = copy.deepcopy(state)
        protected = copy.deepcopy(state)
        for pid in ("opp", "mate", "opp2"):
            protected["players"][pid]["hand"] = [None] * len(protected["players"][pid]["hand"])
        group_seen = ungrouped_seen = False
        for seed in range(20):
            world = self.call("_determinize_state", state, "bot", random.Random(seed))
            other = self.call("_determinize_state", protected, "bot", random.Random(seed))
            self.assertEqual(world["players"], other["players"])
            all_ids = [card["id"] for data in world["players"].values() for card in data["hand"]]
            self.assertEqual(set(all_ids), expected_ids)
            self.assertEqual(len(all_ids), len(expected_ids))
            self.assertIn(known, [card["id"] for card in world["players"]["opp"]["hand"]])
            grouped = bool(guandan._evaluate_combo(world["players"]["opp"]["hand"], 2, {}))
            group_seen |= grouped
            ungrouped_seen |= not grouped
        self.assertTrue(group_seen)
        self.assertTrue(ungrouped_seen)
        self.assertEqual(state, before)

    def test_absent_or_stale_public_play_uses_original_uniform_proposal(self):
        for stale in (False, True):
            state = self.state()
            if stale:
                for trick in state["round_memories"][-1]["tricks"]:
                    for action in trick.get("actions", []):
                        action["hand_count_after"] = 5
            else:
                state["round_memories"] = []
            with mock.patch.object(guandan_ai, "_draw_retained_group", side_effect=AssertionError("no public tail")):
                self.call("_determinize_state", state, "bot", random.Random(0))

    def test_incomplete_profile_falls_back_without_partial_proposal_family(self):
        state = self.state()
        with mock.patch.object(guandan_ai, "_retained_group_proposal_profile", return_value=None), \
                mock.patch.object(guandan_ai, "_draw_retained_group", side_effect=AssertionError("partial family")):
            world = self.call("_determinize_state", state, "bot", random.Random(0))
        self.assertTrue(world["_ai_sampled_world"])

    def test_zero_fraction_preserves_the_uniform_rng_call_sequence(self):
        state = self.state()
        state["config"]["bot_determinize_group_proposal_fraction"] = 0.0
        rng = mock.Mock(wraps=random.Random(321))
        with mock.patch.object(guandan_ai, "_retained_group_proposal_profile",
                               side_effect=AssertionError("disabled proposal")):
            self.call("_determinize_state", state, "bot", rng)
        self.assertEqual(rng.shuffle.call_count, 5)
        self.assertEqual(rng.random.call_count, 1)  # Original posterior selection only.
        rng.choice.assert_not_called()
        rng.randrange.assert_not_called()
        rng.sample.assert_not_called()


if __name__ == "__main__":
    unittest.main()
