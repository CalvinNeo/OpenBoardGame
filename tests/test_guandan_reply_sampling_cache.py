import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanReplySamplingCacheTests(unittest.TestCase):
    def setUp(self):
        players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat} for seat in range(4)]
        self.state = guandan.GuandanGame.init_game({}, players)
        self.state.update(level_rank=2, round_memories=[], pass_limits={}, _ai_eval_cache={})
        self.pool = [card for card in guandan._full_deck() if card.get("rank") in (3, 5, 7)]
        self.state["players"]["p1"]["hand"] = self.pool[:6]
        self.state["players"]["p3"]["hand"] = self.pool[6:12]
        self.state["config"].update(bot_short_hand_structured_samples=16,
                                    bot_short_hand_structured_max_attempts=64)
        self.combo = {"type": "pair", "size": 2, "rank_value": 43, "uses_wild": False}

    def _sample(self, state=None, combo=None, pool=None, opponent="p1"):
        return guandan_ai.call(
            guandan, "_short_hand_structured_reply_breakdown",
            self.state if state is None else state, opponent,
            self.combo if combo is None else combo, self.pool if pool is None else pool,
        )

    def _cache(self, state=None):
        target = self.state if state is None else state
        return target.get("_ai_eval_cache", {}).get("short_hand_reply_breakdowns", {})

    def test_completed_result_matches_uncached_sampling_and_is_defensive(self):
        fresh_state = copy.deepcopy(self.state)
        random_class = random.Random
        with mock.patch.object(guandan_ai.random, "Random", wraps=random_class) as make_rng:
            result = self._sample()
            expected = dict(result)
            result["same_type"] = -1.0
            self.assertEqual(self._sample(), expected)
            self.assertEqual(make_rng.call_count, 1)
            self.assertEqual(self._sample(state=fresh_state), expected)
            self.assertEqual(make_rng.call_count, 2)
        with mock.patch.object(guandan_ai, "_deadline_expired", return_value=True), \
             mock.patch.object(guandan_ai.random, "Random", side_effect=AssertionError("resampled cache")):
            self.assertEqual(self._sample(), expected)

    def test_completed_empty_sample_panel_is_cached_including_after_deadline(self):
        random_class = random.Random
        with mock.patch.object(guandan_ai, "_short_hand_has_structured_shape", return_value=False), \
             mock.patch.object(guandan_ai.random, "Random", wraps=random_class) as make_rng:
            self.assertIsNone(self._sample())
            self.assertEqual(list(self._cache().values()), [None])
            self.assertIsNone(self._sample())
            with mock.patch.object(guandan_ai, "_deadline_expired", return_value=True):
                self.assertIsNone(self._sample())
            self.assertEqual(make_rng.call_count, 1)

    def test_all_sampling_inputs_invalidate_completed_results(self):
        self._sample()
        random_class = random.Random
        variants = (
            "opponent", "finished", "level", "combo_rank", "combo_size", "combo_type",
            "combo_tier", "combo_wild", "combo_high", "pool_order", "pool_card_value",
            "single_pass", "history_profile", "rank_caps", "samples", "attempts", "bomb_rule",
        )
        for variant in variants:
            state, combo, pool = copy.deepcopy((self.state, self.combo, self.pool))
            opponent = "p1"
            if variant == "opponent":
                opponent = "p3"
            elif variant == "finished":
                state["players"]["p1"]["finished"] = True
            elif variant == "level":
                state["level_rank"] = 7
            elif variant.startswith("combo_"):
                field, value = {
                    "combo_rank": ("rank_value", 47), "combo_size": ("size", 3),
                    "combo_type": ("type", "three"), "combo_tier": ("tier", 2),
                    "combo_wild": ("uses_wild", True), "combo_high": ("high_value", 8),
                }[variant]
                combo[field] = value
            elif variant == "pool_order":
                pool.reverse()
            elif variant == "pool_card_value":
                pool[0]["rank"] = 14
            elif variant == "single_pass":
                state["pass_limits"] = {"p1": {"single": 60}}
            elif variant in ("history_profile", "rank_caps"):
                count = 1 if variant == "history_profile" else 2
                cards = [copy.deepcopy(card) for card in pool if card["rank"] == 3][:count]
                state["round_memories"] = [{"tricks": [{"actions": [{
                    "player_id": "p1", "type": "play", "cards": cards,
                    "combo_type": "single" if count == 1 else "pair", "hand_count_after": 6,
                }]}]}]
            else:
                key, value = {
                    "samples": ("bot_short_hand_structured_samples", 17),
                    "attempts": ("bot_short_hand_structured_max_attempts", 96),
                    "bomb_rule": ("hard_bomb_beats_soft", not state["config"]["hard_bomb_beats_soft"]),
                }[variant]
                state["config"][key] = value
            with self.subTest(variant=variant), mock.patch.object(
                guandan_ai.random, "Random", wraps=random_class,
            ) as make_rng:
                actual = self._sample(state, combo, pool, opponent)
                self.assertEqual(make_rng.call_count, 1)
                state["_ai_eval_cache"] = {}
                self.assertEqual(actual, self._sample(state, combo, pool, opponent))

    def test_non_six_card_target_does_not_reuse_six_card_result(self):
        self.assertIsNotNone(self._sample())
        self.state["players"]["p1"]["hand"] = self.pool[:7]
        self.assertIsNone(self._sample())

    def test_search_clones_drop_the_reply_sampling_cache(self):
        self._sample()
        clone = guandan._clone_search_state(self.state, preserve_eval_cache=True)
        self.assertNotIn("short_hand_reply_breakdowns", clone["_ai_eval_cache"])

    def test_interrupted_panels_are_not_cached_and_can_be_completed_later(self):
        # Cover interruption after one accepted hand, and after the last hand's
        # evaluation crosses the deadline before its panel can be published.
        for checks_before_timeout in (2, 17):
            self.state["_ai_eval_cache"] = {}
            with self.subTest(checks_before_timeout=checks_before_timeout), \
                 mock.patch.object(guandan_ai, "_short_hand_has_structured_shape", return_value=True), \
                 mock.patch.object(guandan_ai, "_short_hand_singleton_pressure_weight", return_value=1.0), \
                 mock.patch.object(guandan_ai, "_hand_has_same_type_beat", return_value=True), \
                 mock.patch.object(guandan_ai, "_hand_has_bomb_beat", return_value=False):
                with mock.patch.object(guandan_ai, "_deadline_expired",
                                       side_effect=[False] * checks_before_timeout + [True]):
                    self.assertIsNone(self._sample())
                self.assertEqual(self._cache(), {})
                with mock.patch.object(guandan_ai, "_deadline_expired", return_value=False):
                    self.assertEqual(self._sample(), {"same_type": 1.0, "bomb": 0.0, "overbomb": 0.0})
                self.assertEqual(len(self._cache()), 1)

    def test_expired_sampling_uses_each_callers_existing_analytic_fallback(self):
        rank_counts = {rank: sum(card["rank"] == rank for card in self.pool) for rank in (3, 5, 7)}
        jokers = {"small": 0, "big": 0}
        combos = (self.combo, {"type": "bomb", "size": 4, "rank_value": 43, "tier": 1})
        callers = (
            ("_opponent_same_type_reply_probability", 0),
            ("_opponent_bomb_reply_probability", jokers),
            ("_opponent_overbomb_reply_probability", jokers),
        )
        for combo in combos:
            for name, counts in callers:
                args = (self.state, "p1", combo, len(self.pool), rank_counts, counts)
                with self.subTest(caller=name, combo=combo["type"]):
                    expected = guandan_ai.call(guandan, name, *args)
                    with mock.patch.object(guandan_ai, "_deadline_expired", return_value=True), \
                         mock.patch.object(guandan_ai.random, "Random", side_effect=AssertionError("late sampling")):
                        actual = guandan_ai.call(guandan, name, *args, unknown_cards=self.pool)
                    self.assertEqual(actual, expected)
                    self.assertGreaterEqual(actual, 0)
                    self.assertLessEqual(actual, 1)
        self.assertEqual(self._cache(), {})


if __name__ == "__main__":
    unittest.main()
