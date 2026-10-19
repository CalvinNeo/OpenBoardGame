"""Ownership boundaries for the incremental lead-score migration."""

import unittest
from contextlib import ExitStack
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids
from tests.test_guandan_trick_value import make_opening_61559c


class GuandanScoreOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.state = make_opening_61559c()
        self.cards = pick_card_ids(self.state["players"]["bot"]["hand"], ["♣️4", "♥️4"])
        hand_map = guandan._map_hand_by_id(self.state["players"]["bot"]["hand"])
        self.combo = guandan._evaluate_combo([hand_map[c] for c in self.cards], 2, {})

    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, self.state, "bot", *args, **kwargs)

    def patch_refinements(self, stack, **values):
        producers = {}
        for name, (source, _sign, _signed) in guandan_ai._LEAD_REFINEMENTS.items():
            self.assertNotIn(source, producers, "one producer must not own two refinements")
            producers[source] = stack.enter_context(mock.patch.object(
                guandan_ai, source, return_value=values.get(name, 0.0),
            ))
        return producers

    def test_completed_exact_route_owns_recovery_without_duplicate_reward(self):
        for complete, exact, expected in (
            (True, True, 0.0), (True, False, 4.0), (False, True, 4.0),
        ):
            with self.subTest(complete=complete, exact=exact), ExitStack() as stack:
                self.state["_ai_eval_cache"] = {"hand_route_status": {"complete": complete}}
                self.patch_refinements(stack, lead_reentry=4.0)
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_current_hand_routes",
                    return_value={guandan._cards_key(self.cards): {"exact": exact}},
                ))
                ranked, direct = self.call("_lead_refinement_components", self.cards, self.combo)
                self.assertEqual(ranked["lead_reentry"], expected)
                self.assertEqual(direct.get("lead_reentry", 0.0), expected)

    def test_recovery_mode_changes_invalidate_lead_cache(self):
        with ExitStack() as stack:
            self.state["_ai_eval_cache"] = {"hand_route_status": {"complete": True}}
            self.patch_refinements(stack, lead_reentry=4.0)
            stack.enter_context(mock.patch.object(
                guandan_ai, "_current_hand_routes",
                return_value={guandan._cards_key(self.cards): {"exact": True}},
            ))
            self.state["config"]["bot_lead_reentry_mode"] = "legacy"
            before = self.call("_lead_option_score", self.cards)
            self.state["config"]["bot_lead_reentry_mode"] = "route_only"
            after = self.call("_lead_option_score", self.cards)
            self.assertAlmostEqual(before - after, 4.0)

    def test_finished_race_preserves_tactical_reentry_for_either_team(self):
        for finish in ("opp", "mate"):
            with self.subTest(finish=finish), ExitStack() as stack:
                self.state["finish_order"] = [finish]
                self.state["_ai_eval_cache"] = {"hand_route_status": {"complete": True}}
                self.patch_refinements(stack, lead_reentry=4.0)
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_current_hand_routes",
                    return_value={guandan._cards_key(self.cards): {"exact": True}},
                ))
                ranked, direct = self.call("_lead_refinement_components", self.cards, self.combo)
                self.assertEqual(ranked["lead_reentry"], 4.0)
                self.assertEqual(direct["lead_reentry"], 4.0)

    def test_finish_order_change_invalidates_route_reentry_cache(self):
        with ExitStack() as stack:
            self.state["_ai_eval_cache"] = {"hand_route_status": {"complete": True}}
            self.patch_refinements(stack, lead_reentry=4.0)
            stack.enter_context(mock.patch.object(
                guandan_ai, "_current_hand_routes",
                return_value={guandan._cards_key(self.cards): {"exact": True}},
            ))
            ranked, _direct = self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertEqual(ranked["lead_reentry"], 0.0)
            self.state["finish_order"] = ["opp"]
            ranked, direct = self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertEqual(ranked["lead_reentry"], 4.0)
            self.assertEqual(direct["lead_reentry"], 4.0)

    def test_ranking_and_final_score_reuse_the_same_recovery_estimate(self):
        with ExitStack() as stack:
            producers = self.patch_refinements(stack, lead_reentry=2.0)
            recovery = producers["_lead_same_type_reentry_bonus"]
            self.call("_lead_option_score", self.cards)
            recovery.return_value = 99.0
            components = self.call("_compute_bot_score_components", self.cards, 4)
        self.assertEqual(recovery.call_count, 1)
        self.assertAlmostEqual(components["lead_reentry"], 2.36)
        self.assertAlmostEqual(components["total"], sum(
            value for name, value in components.items() if name != "total"
        ))

    def test_recovery_changes_its_own_component_without_hiding_in_lead_plan(self):
        results = []
        for recovery in (0.0, 5.0):
            self.state["_ai_eval_cache"] = {}
            with ExitStack() as stack:
                self.patch_refinements(stack, lead_reentry=recovery)
                results.append(self.call("_compute_bot_score_components", self.cards, 4))
        self.assertAlmostEqual(results[0]["lead_plan"], results[1]["lead_plan"])
        self.assertAlmostEqual(results[1]["lead_reentry"], 5.9)
        self.assertAlmostEqual(results[1]["total"] - results[0]["total"], 5.9)

    def test_retained_bomb_discount_preserves_its_direct_credit_basis(self):
        with ExitStack() as stack:
            self.patch_refinements(stack, lead_reentry=2.0, lead_retake_stock=3.0)
            stack.enter_context(mock.patch.object(
                guandan_ai, "_retained_bomb_takeover_profile",
                return_value={"risk": 0.5, "penalty": 4.0},
            ))
            components = self.call("_compute_bot_score_components", self.cards, 4)
        self.assertAlmostEqual(components["lead_reentry"], 2.36)
        self.assertAlmostEqual(components["lead_retake_stock"], 3.54)
        self.assertAlmostEqual(components["retained_bomb_tempo_discount"], -2.5)

    def test_signed_priors_and_direct_thresholds_survive_the_migration(self):
        with ExitStack() as stack:
            self.patch_refinements(
                stack, lead_hold=-3.0, lead_opening_commitment=-2.0,
                lead_teammate=-1.0, lead_reentry=0.0005,
            )
            ranked, direct = self.call("_lead_refinement_components", self.cards, self.combo)
        self.assertEqual(direct["lead_hold"], -3.0)
        self.assertEqual(direct["lead_teammate"], -1.0)
        self.assertEqual(direct["lead_opening_patience"], 2.0)
        self.assertNotIn("lead_opening_commitment", direct)
        self.assertNotIn("lead_reentry", direct)
        merged = guandan_ai._merge_lead_score_components(10 + sum(ranked.values()), ranked, direct)
        self.assertAlmostEqual(merged["lead_plan"], 1.8)
        self.assertAlmostEqual(merged["lead_reentry"], 0.00009)
        self.assertAlmostEqual(merged["lead_opening_patience"], 2.36)
        self.assertNotIn("lead_closeout_reply", merged)

    def test_direct_finish_does_not_claim_ranked_priors(self):
        merged = guandan_ai._merge_lead_score_components(
            1000.0, {}, {"lead_shape": 2.0, "lead_hold": -3.0},
        )
        self.assertEqual(merged, {"lead_plan": 180.0, "lead_shape": 2.0, "lead_hold": -3.0})

    def test_legacy_plan_cutoff_does_not_create_offsetting_new_terms(self):
        merged = guandan_ai._merge_lead_score_components(
            2.0005, {"lead_shape": 2.0, "lead_reentry": 5.0},
            {"lead_shape": 2.0, "lead_reentry": 5.0},
        )
        self.assertNotIn("lead_plan", merged)
        self.assertEqual(merged["lead_reentry"], 5.0)
        self.assertAlmostEqual(merged["lead_shape"], 2.36)

    def test_new_refinements_require_an_explicit_producer(self):
        with self.assertRaisesRegex(ValueError, "Unregistered"):
            guandan_ai._merge_lead_score_components(2.0, {"extra_recovery": 2.0}, {})

    def test_refinement_cache_is_defensive_and_tracks_public_evidence(self):
        with ExitStack() as stack:
            producers = self.patch_refinements(stack, lead_reentry=2.0)
            recovery = producers["_lead_same_type_reentry_bonus"]
            ranked, direct = self.call("_lead_refinement_components", self.cards, self.combo)
            ranked["lead_reentry"] = direct["lead_reentry"] = 100.0
            cached = self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertEqual(cached[0]["lead_reentry"], 2.0)
            self.assertEqual(cached[1]["lead_reentry"], 2.0)
            recovery.return_value = 4.0
            self.state["seen_cards"].append(self.state["players"]["opp"]["hand"][0]["id"])
            updated = self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertEqual(updated[0]["lead_reentry"], 4.0)
            self.assertEqual(recovery.call_count, 2)

    def test_expired_refinements_are_not_reused_for_complete_scoring(self):
        with ExitStack() as stack:
            producers = self.patch_refinements(stack, lead_reentry=2.0)
            with mock.patch.object(guandan_ai, "_deadline_expired", return_value=True):
                self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertFalse(self.state["_ai_eval_cache"]["lead_refinements"])
            producers["_lead_same_type_reentry_bonus"].return_value = 4.0
            ranked, _direct = self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertEqual(ranked["lead_reentry"], 4.0)

    def test_search_particles_do_not_inherit_root_refinements(self):
        self.state["_ai_eval_cache"]["lead_refinements"] = {"root": "only"}
        particle = guandan_ai._clone_search_state(self.state, preserve_eval_cache=True)
        self.assertNotIn("lead_refinements", particle["_ai_eval_cache"])

    def test_bounded_estimates_are_not_reused_for_full_scoring(self):
        with ExitStack() as stack:
            producers = self.patch_refinements(stack, lead_reentry=2.0)
            with mock.patch.object(guandan_ai, "_bounded_finalist_scoring", return_value=True):
                self.call("_lead_option_score", self.cards)
            producers["_lead_same_type_reentry_bonus"].return_value = 4.0
            with mock.patch.object(guandan_ai, "_bounded_finalist_scoring", return_value=False):
                ranked, _direct = self.call("_lead_refinement_components", self.cards, self.combo)
            self.assertEqual(ranked["lead_reentry"], 4.0)

    def test_abandoned_route_refresh_also_invalidates_its_scoring_breakdown(self):
        with ExitStack() as stack:
            self.patch_refinements(stack, lead_reentry=2.0)
            self.call("_lead_option_score", self.cards)
        self.assertTrue(self.state["_ai_eval_cache"]["lead_refinements"])
        # Exceed the panel budget: no partially refreshed panel may leave its
        # old scalar score or its old breakdown available to the next scorer.
        self.call("_prepare_hand_route_scores", [self.cards] * 513)
        cache = self.state["_ai_eval_cache"]
        self.assertNotIn("lead_refinements", cache)
        self.assertNotIn("lead_option_scores", cache)
        self.assertEqual(cache["hand_route_status"]["reason"], "option_limit")


if __name__ == "__main__":
    unittest.main()
