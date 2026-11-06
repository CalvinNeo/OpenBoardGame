import copy
import unittest
from contextlib import ExitStack
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture
from tests.test_guandan_trick_value import make_opening_61559c


class GuandanHeuristicSimplificationTests(unittest.TestCase):
    RETIRED = {
        "lead_probe_deferral": "_lead_probe_deferral_penalty",
        "lead_support_tension": "_lead_composite_support_tension_penalty",
        "lead_low_pair_carry": "_lead_low_pair_full_house_carry_penalty",
        "global_plan": "_global_hand_decomposition_summary",
        "overlap_run_low_single": "_lead_overlap_run_low_single_bonus",
    }

    def test_non_nn_never_runs_retired_rules_even_with_complete_scoring(self):
        opening = make_opening_61559c()
        opening_cards = pick_card_ids(opening["players"]["bot"]["hand"], ["♣️4", "♥️4"])
        response = replay_fixture("88f335", 8)
        response_cards = pick_card_ids(response["players"][response["current_turn"]]["hand"], ["♣️2"])
        for mode in ("heuristic", "auto"):
            for template, cards in ((opening, opening_cards), (response, response_cards)):
                state = copy.deepcopy(template)
                state["config"]["bot_mode"] = mode
                state.pop("_ai_eval_cache", None)
                actor = state["current_turn"]
                with self.subTest(mode=mode, lead=not state.get("current_trick")), ExitStack() as stack:
                    for producer in self.RETIRED.values():
                        stack.enter_context(mock.patch.object(
                            guandan_ai, producer, side_effect=AssertionError(producer),
                        ))
                    stack.enter_context(guandan_ai.complete_heuristic_scoring())
                    if not state.get("current_trick"):
                        guandan._lead_option_score(state, actor, cards)
                    components = guandan._bot_score_components(state, actor, cards, 2)
                    self.assertTrue(self.RETIRED.keys().isdisjoint(components))
                    self.assertNotIn("anytime_partial", components)
                    self.assertAlmostEqual(components["total"], sum(
                        value for name, value in components.items() if name != "total"
                    ))
                    if state.get("current_trick"):
                        passed = guandan._bot_score_components(state, actor, None, 2)
                        self.assertTrue(self.RETIRED.keys().isdisjoint(passed))

    def test_live_refinements_exclude_retired_rules_but_keep_tactical_protection(self):
        self.assertTrue(self.RETIRED.keys().isdisjoint(guandan_ai._LEAD_REFINEMENTS))
        self.assertEqual(len(guandan_ai._LEAD_REFINEMENTS), 17)
        self.assertTrue({
            "deny_one_card_window", "deny_short_runout_window", "lead_teammate_finish",
            "lead_closeout_reply", "preserve_lighter_shape", "lead_reentry",
        }.issubset(guandan_ai._LEAD_REFINEMENTS))

    def test_nn_feature_rules_do_not_leak_through_mode_sensitive_cache(self):
        state = make_opening_61559c()
        cards = pick_card_ids(state["players"]["bot"]["hand"], ["♣️4", "♥️4"])
        hand_map = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        combo = guandan._evaluate_combo([hand_map[card_id] for card_id in cards], 2, {})
        with ExitStack() as stack:
            producers = {}
            for name, (producer, _sign, _signed) in guandan_ai._NN_LEGACY_LEAD_REFINEMENTS.items():
                producers[name] = stack.enter_context(mock.patch.object(guandan_ai, producer, return_value=2.0))
            for mode in ("heuristic", "nn", "auto", "nn"):
                state["config"]["bot_mode"] = mode
                ranked, direct = guandan_ai.call(
                    guandan, "_lead_refinement_components", state, "bot", cards, combo,
                )
                for name in producers:
                    if mode == "nn":
                        self.assertEqual(ranked[name], -2.0)
                        self.assertEqual(direct[name], -2.0)
                    else:
                        self.assertNotIn(name, ranked)
                        self.assertNotIn(name, direct)
            for producer in producers.values():
                self.assertEqual(producer.call_count, 1)

    def test_nn_keeps_legacy_plan_feature_without_reusing_non_nn_components(self):
        state = replay_fixture("88f335", 8)
        actor = state["current_turn"]
        cards = pick_card_ids(state["players"][actor]["hand"], ["♣️2"])
        with mock.patch.object(guandan_ai, "_global_hand_decomposition_summary",
                               return_value={"turns": 0.0, "low_singles": 0.0}) as legacy:
            state["config"]["bot_mode"] = "heuristic"
            normal = guandan._bot_score_components(state, actor, cards, 2)
            legacy.assert_not_called()
            self.assertNotIn("global_plan", normal)
            state["config"]["bot_mode"] = "nn"
            neural = guandan._bot_score_components(state, actor, cards, 2)
            self.assertGreater(neural.get("global_plan", 0.0), 0.0)
            self.assertGreater(legacy.call_count, 0)
            state["config"]["bot_mode"] = "heuristic"
            self.assertEqual(guandan._bot_score_components(state, actor, cards, 2), normal)


if __name__ == "__main__":
    unittest.main()
