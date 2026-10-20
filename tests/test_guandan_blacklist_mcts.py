import copy
from contextlib import ExitStack
import math
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanBlacklistMctsAggregationTests(unittest.TestCase):
    def setUp(self):
        self.actions = [{"type": "play", "card_ids": [1]}, {"type": "pass"}]
        self.keys = [guandan_ai._mcts_action_key(action) for action in self.actions]

    def aggregate(self, outcomes, heuristics, penalties=None, risk=0.0):
        samples = {}
        paired = {}
        for key, values in zip(self.keys, outcomes):
            samples[key] = {
                "count": len(values), "total": sum(values),
                "total_sq": sum(value * value for value in values),
                "wins": sum(value > 0 for value in values),
                "min": min(values) if values else None,
                "max": max(values) if values else None,
            }
            deltas = [value - baseline for value, baseline in zip(values, outcomes[0])]
            paired[key] = {
                "count": len(deltas), "total": sum(deltas),
                "total_sq": sum(delta * delta for delta in deltas),
            }
        center = sum(heuristics) / len(heuristics)
        scale = max(1.0, max(abs(value - center) for value in heuristics))
        return guandan_ai._mcts_finalize_scores(
            self.actions, samples, paired, self.keys[0],
            dict(zip(self.keys, heuristics)), center, scale, 2.0, risk,
            1, 1, 1, 1.64,
            blacklist_penalties=None if penalties is None else dict(zip(self.keys, penalties)),
        )

    def test_penalty_changes_selection_without_changing_sample_evidence(self):
        outcomes = [[11.0, 13.0], [9.0, 11.0]]
        plain = self.aggregate(outcomes, [10.0, 10.0], [0.0, 0.0])
        penalized = self.aggregate(outcomes, [10.0, 10.0], [2.0, 0.0])
        self.assertEqual(plain[0][0], self.actions[0])
        self.assertEqual(penalized[0][0], self.actions[1])
        plain_stats = {guandan_ai._mcts_action_key(row[0]): row[3] for row in plain}
        for action, score, _count, stats in penalized:
            original = plain_stats[guandan_ai._mcts_action_key(action)]
            for name in ("avg", "std", "win_rate", "paired_delta", "paired_std",
                         "paired_lcb", "paired_ucb", "paired_count", "heuristic_norm"):
                self.assertEqual(stats[name], original[name], name)
            self.assertEqual(score, stats["value_adjusted"] - stats["blacklist_score_penalty"])

    def test_sufficient_value_can_outweigh_finite_penalty(self):
        scored = self.aggregate([[19.0, 21.0], [9.0, 11.0]], [10.0, 10.0], [2.0, 0.0])
        self.assertEqual(scored[0][0], self.actions[0])
        self.assertEqual(scored[0][3]["blacklist_score_penalty"], 4.0)

    def test_no_samples_falls_back_to_decision_score_not_normalized_prior(self):
        scored = self.aggregate([[], []], [10.0, 9.0], [2.0, 0.0])
        self.assertEqual(scored[0][0], self.actions[1])
        by_key = {guandan_ai._mcts_action_key(row[0]): row for row in scored}
        self.assertEqual(by_key[self.keys[0]][1], 8.0)
        self.assertEqual(by_key[self.keys[0]][3]["blacklist_score_penalty"], 2.0)

    def test_legacy_aggregation_retains_previous_formula_and_metadata(self):
        scored = self.aggregate([[1.0, 3.0], [0.0, 0.0]], [4.0, 2.0], risk=0.5)
        self.assertEqual(scored[0][1], 2.0 - 0.5 * 1.0 + 2.0)
        self.assertEqual(scored[1][1], -2.0)
        self.assertNotIn("blacklist_penalty", scored[0][3])
        self.assertAlmostEqual(scored[1][3]["paired_std"], math.sqrt(2.0))


class GuandanBlacklistMctsGateTests(unittest.TestCase):
    def test_override_guard_recomputes_incomplete_cached_scores_in_value_context(self):
        reference = {"type": "play", "card_ids": [1]}
        proposal = {"type": "play", "card_ids": [2]}
        for kind in ("quick", "partial"):
            for deadline in (None, 42.0):
                for separate in (True, False):
                    with self.subTest(kind=kind, deadline=deadline, separate=separate):
                        state = {
                            "config": {"bot_blacklist_separate_value": separate},
                            "players": {"p0": {"hand": [{"id": 1}, {"id": 2}]}},
                            "level_rank": 2,
                        }
                        partial = ({"total": 0.0, "anytime_quick_score": 0.0}
                                   if kind == "quick" else
                                   {"total": 0.0, "anytime_partial": 1.0, "soft_candidate_prior": -4.0})
                        finalists = [([1], 0.0, partial), ([2], 10.0, {"total": 10.0})]
                        modes = []

                        def score(*_args):
                            modes.append(guandan_ai._blacklist_value_mode())
                            return 20.0 if modes[-1] else 0.0

                        with ExitStack() as stack:
                            stack.enter_context(mock.patch.object(
                                guandan_ai, "_get_cached_heuristic_scored_candidates", return_value=finalists,
                            ))
                            for name in ("_retained_bomb_override_is_unsafe", "_lead_closeout_plan_risk",
                                         "_same_type_control_plan_risk", "_cards_use_special_material"):
                                stack.enter_context(mock.patch.object(guandan_ai, name, return_value=False))
                            stack.enter_context(mock.patch.object(guandan_ai, "_candidate_features", return_value={}))
                            stack.enter_context(mock.patch.object(guandan_ai, "_action_combo", return_value=None))
                            stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", side_effect=score))
                            stack.enter_context(mock.patch.object(guandan_ai, "_mcts_root_heuristic_value", side_effect=score))
                            accepted = guandan_ai.call(
                                guandan, "_should_accept_mcts_override", state, "p0", reference, proposal,
                                1, deadline=deadline,
                            )
                        self.assertEqual(accepted, not separate)
                        self.assertEqual(modes, [True] if separate else [])
                        self.assertFalse(guandan_ai._blacklist_value_mode())

    def run_panel(self, separate, base_values, penalties, *, leaf_values=None,
                  cached=True, early_gap=1.0, deadline=None, expanded_penalties=None,
                  interrupt_after=None):
        actions = [{"type": "play", "card_ids": [index + 1]} for index in range(len(base_values))]
        keys = [guandan_ai._mcts_action_key(action) for action in actions]
        state = {
            "config": {
                "bot_blacklist_separate_value": separate,
                "bot_search_depth": 1,
                "bot_mcts_confidence_min_pairs": 2,
                "bot_mcts_early_stop_min_rounds": 2,
                "bot_mcts_early_stop_stable_rounds": 1,
                "bot_mcts_early_stop_gap": early_gap,
                "bot_mcts_successive_halving_min_rounds": 2,
                "bot_mcts_cost_guard": False,
            },
            "players": {"p0": {"hand": [{"id": index + 1} for index in range(len(actions))]}},
            "level_rank": 2, "current_turn": "p0", "_ai_eval_cache": {},
            "current_trick": {"player_id": "p3", "combo": {"type": "pair", "rank_value": 6}},
        }
        decision_values = [value - penalty for value, penalty in zip(base_values, penalties)]
        state["_ai_eval_cache"]["response_soft_penalties"] = {
            ("p0", guandan._cards_key(action["card_ids"])): penalty
            for action, penalty in zip(actions, penalties)
        }
        finalists = [
            (action["card_ids"], decision,
             {"total": decision, "anytime_quick_score": decision} if cached == "quick"
             else {"total": decision, "soft_candidate_prior": -penalty})
            for action, decision, penalty in zip(actions, decision_values, penalties)
        ] if cached else []
        reference_index = max(range(len(actions)), key=lambda index: decision_values[index])
        fast_result = [(actions[reference_index], decision_values[reference_index], 0, {"fast_path": 1.0})]
        values = dict(zip(keys, leaf_values or [0.0] * len(actions)))
        mode_observations = []
        leaf_calls = 0

        def score_root(_state, _player, action, _depth):
            index = keys.index(guandan_ai._mcts_action_key(action))
            value_mode = guandan_ai._blacklist_value_mode()
            mode_observations.append(value_mode)
            return base_values[index] if value_mode else decision_values[index]

        def apply_action(trial, _player, action):
            trial["_test_action"] = guandan_ai._mcts_action_key(action)
            return [], None

        def expand_penalties(_state, _player, candidates):
            if expanded_penalties is not None:
                _state["_ai_eval_cache"]["overbomb_soft_penalties"] = {
                    ("p0", guandan._cards_key(action["card_ids"])): penalty
                    for action, penalty in zip(actions, expanded_penalties)
                }
            return candidates

        def evaluate_leaf(trial, *_args):
            nonlocal leaf_calls
            leaf_calls += 1
            if leaf_calls == interrupt_after:
                raise guandan_ai._MctsSearchInterrupted
            return values[trial["_test_action"]]

        fast_names = (
            "_mcts_structured_runout_bomb_scores", "_mcts_obvious_response_scores",
            "_mcts_natural_structure_takeover_scores", "_mcts_high_single_joker_scores",
            "_mcts_high_single_bomb_scores",
        )
        with ExitStack() as stack:
            stack.enter_context(mock.patch.object(guandan.GuandanGame, "get_legal_actions", return_value=["play"]))
            stack.enter_context(mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=apply_action))
            stack.enter_context(mock.patch.object(guandan_ai, "_get_cached_heuristic_scored_candidates", return_value=finalists))
            stack.enter_context(mock.patch.object(guandan, "_candidate_actions", return_value=actions))
            stack.enter_context(mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=expand_penalties))
            stack.enter_context(mock.patch.object(guandan_ai, "_mcts_root_candidate_subset", return_value=actions))
            budget = stack.enter_context(mock.patch.object(guandan, "_mcts_budget", return_value=(12, 0, 0, 1)))
            stack.enter_context(mock.patch.object(guandan_ai, "_evaluate_combo", return_value={"type": "single"}))
            stack.enter_context(mock.patch.object(guandan, "_determinize_state", side_effect=lambda *_a: copy.deepcopy(state)))
            stack.enter_context(mock.patch.object(guandan, "_mcts_reply_tree_value", side_effect=evaluate_leaf))
            stack.enter_context(mock.patch.object(guandan, "_mcts_root_heuristic_value", side_effect=score_root))
            stack.enter_context(mock.patch.object(
                guandan_ai, "_quick_candidate_score",
                side_effect=lambda s, p, cards: score_root(s, p, {"type": "play", "card_ids": cards}, 0),
            ))
            fast_mocks = [stack.enter_context(mock.patch.object(guandan_ai, name, return_value=fast_result))
                          for name in fast_names]
            scores = guandan_ai.call(
                guandan, "_mcts_score_actions", state, "p0", 12, 0,
                len(actions), 0, 1, 0.0, deadline=deadline,
            )
        return state, scores, fast_mocks, budget.call_args, mode_observations

    def test_penalty_gap_cannot_create_fast_path_confidence_or_halving(self):
        state, scores, fast_mocks, budget_call, _modes = self.run_panel(
            True, [10.0, 10.0, 10.0], [100.0, 0.0, 0.0],
        )
        for fast in fast_mocks:
            fast.assert_not_called()
        self.assertEqual(state["_ai_eval_cache"]["mcts_anytime"]["stop_reason"], "visit_budget")
        self.assertEqual(state["_ai_eval_cache"]["mcts_anytime"]["attempted"], 12)
        self.assertEqual([row[2] for row in scores], [4, 4, 4])
        self.assertEqual(set(budget_call.kwargs["heuristic_values"].values()), {10.0})

    def test_value_leader_penalty_can_only_tighten_early_stopping(self):
        state, scores, _fast, _budget, _modes = self.run_panel(
            True, [10.0, 10.0, 10.0], [100.0, 0.0, 0.0],
            leaf_values=[5.0, 0.0, 0.0],
        )
        self.assertEqual(state["_ai_eval_cache"]["mcts_anytime"]["stop_reason"], "visit_budget")
        self.assertNotEqual(scores[0][0]["card_ids"], [1])
        self.assertEqual([row[2] for row in scores], [4, 4, 4])

    def test_uncached_root_scores_compute_value_inside_context(self):
        _state, scores, fast_mocks, _budget, modes = self.run_panel(
            True, [10.0, 10.0], [3.0, 0.0], cached=False,
        )
        self.assertEqual(modes, [False, True, False, True])
        self.assertFalse(guandan_ai._blacklist_value_mode())
        for fast in fast_mocks:
            fast.assert_not_called()
        first = next(row for row in scores if row[0]["card_ids"] == [1])
        self.assertEqual(first[3]["heuristic"], 7.0)
        self.assertEqual(first[3]["heuristic_value"], 10.0)
        self.assertEqual(first[3]["blacklist_penalty"], 3.0)

    def test_cached_quick_fallback_recomputes_its_value_without_explicit_components(self):
        _state, scores, _fast, _budget, modes = self.run_panel(
            True, [10.0, 10.0], [3.0, 0.0], cached="quick",
        )
        self.assertEqual(modes, [False, True, False, True])
        first = next(row for row in scores if row[0]["card_ids"] == [1])
        self.assertEqual(first[3]["heuristic_value"], 10.0)
        self.assertEqual(first[3]["blacklist_penalty"], 3.0)

    def test_root_expansion_refreshes_cached_decision_penalties_without_rescoring_value(self):
        _state, scores, fast_mocks, _budget, modes = self.run_panel(
            True, [10.0, 10.0], [0.0, 0.0], expanded_penalties=[3.0, 0.0],
        )
        self.assertEqual(modes, [])
        for fast in fast_mocks:
            fast.assert_not_called()
        first = next(row for row in scores if row[0]["card_ids"] == [1])
        self.assertEqual(first[3]["heuristic_value"], 10.0)
        self.assertEqual(first[3]["heuristic"], 7.0)
        self.assertEqual(first[3]["blacklist_penalty"], 3.0)

    def test_expired_search_keeps_decision_reference_with_no_fake_samples(self):
        state, scores, _fast, _budget, _modes = self.run_panel(
            True, [20.0, 10.0], [30.0, 0.0], deadline=-1.0,
        )
        status = state["_ai_eval_cache"]["mcts_anytime"]
        self.assertEqual(status["stop_reason"], "deadline")
        self.assertTrue(status["fallback_to_reference"])
        self.assertEqual(scores[0][0]["card_ids"], [2])
        self.assertEqual([row[2] for row in scores], [0, 0])

    def test_actual_value_evidence_can_still_stop_a_penalized_panel_early(self):
        state, scores, _fast, _budget, _modes = self.run_panel(
            True, [10.0, 10.0, 10.0], [0.0, 100.0, 100.0],
            leaf_values=[5.0, 0.0, 0.0],
        )
        self.assertEqual(state["_ai_eval_cache"]["mcts_anytime"]["stop_reason"], "confidence")
        self.assertEqual(scores[0][0]["card_ids"], [1])
        self.assertEqual([row[2] for row in scores], [2, 2, 2])

    def test_interrupted_world_never_mixes_sampled_and_fallback_scores(self):
        for interrupted_call, complete_worlds in ((2, 0), (5, 1)):
            with self.subTest(interrupted_call=interrupted_call):
                state, scores, _fast, _budget, _modes = self.run_panel(
                    True, [10.0, 10.0, 10.0], [3.0, 0.0, 0.0],
                    interrupt_after=interrupted_call,
                )
                status = state["_ai_eval_cache"]["mcts_anytime"]
                self.assertEqual(status["stop_reason"], "deadline")
                self.assertTrue(status["fallback_to_reference"])
                self.assertEqual([row[2] for row in scores], [complete_worlds] * 3)
                self.assertEqual([row[3]["paired_count"] for row in scores], [complete_worlds] * 3)

    def test_disabled_flag_keeps_existing_zero_sample_fast_path(self):
        state, scores, fast_mocks, _budget, modes = self.run_panel(
            False, [10.0, 10.0], [100.0, 0.0],
        )
        fast_mocks[0].assert_called_once()
        self.assertEqual(state["_ai_eval_cache"]["mcts_anytime"]["stop_reason"], "fast_path")
        self.assertEqual(scores[0][2], 0)
        self.assertEqual(modes, [])


if __name__ == "__main__":
    unittest.main()
