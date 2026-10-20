import copy
from contextlib import ExitStack
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests import test_guandan_response_priors as response_fixtures
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


def set_penalty(state, player_id, cards, response=0.0, overbomb=0.0):
    key = (player_id, guandan._cards_key(cards))
    cache = state.setdefault("_ai_eval_cache", {})
    cache.setdefault("response_soft_penalties", {})[key] = response
    cache.setdefault("overbomb_soft_penalties", {})[key] = overbomb


class GuandanBlacklistSearchCostsTests(unittest.TestCase):
    def run_costs(self, cached_kind=None, expanded_penalty=None, separate=True):
        state = {
            "config": {"bot_blacklist_separate_value": separate},
            "current_trick": {"player_id": "p3"}, "_ai_eval_cache": {},
        }
        actions = [{"type": "play", "card_ids": [1]}, {"type": "play", "card_ids": [2]}]
        set_penalty(state, "p0", [1], response=4.0)
        base_values = {1: 10.0, 2: 20.0}
        cached = []
        for action in actions:
            cards = action["card_ids"]
            penalty = 4.0 if cards == [1] else 0.0
            score = base_values[cards[0]] - penalty
            components = {"total": score, "soft_candidate_prior": -penalty}
            if cached_kind == "quick":
                components = {"total": score, "anytime_quick_score": score}
            if cached_kind == "partial":
                components["anytime_partial"] = 1.0
            cached.append((cards, score, components))
        modes = []

        def quick(_state, _player, cards):
            modes.append(guandan_ai._blacklist_value_mode())
            return base_values[cards[0]] if modes[-1] else base_values[cards[0]] - 4.0

        def expand(_state, _player, options):
            if expanded_penalty is not None:
                set_penalty(_state, "p0", [1], response=expanded_penalty)
            return options

        with ExitStack() as stack:
            rank = stack.enter_context(mock.patch.object(
                guandan_ai, "_rank_response_options", side_effect=lambda s, p, options: options,
            ))
            stack.enter_context(mock.patch.object(guandan_ai, "_filter_overbomb_options", side_effect=expand))
            stack.enter_context(mock.patch.object(
                guandan_ai, "_get_cached_heuristic_scored_candidates",
                return_value=[] if cached_kind is None else cached,
            ))
            stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", side_effect=quick))
            stack.enter_context(mock.patch.object(guandan_ai, "_candidate_features", return_value={"combo": {"type": "single"}}))
            stack.enter_context(mock.patch.object(guandan_ai, "_shared_response_tactical_components", return_value={}))
            costs = guandan_ai.call(guandan, "_blacklist_search_costs", state, "p0", actions)
        return costs, modes, rank

    def test_complete_cached_scores_restore_value_before_normalization(self):
        costs, modes, _rank = self.run_costs("complete")
        first = costs[guandan_ai._action_identity({"type": "play", "card_ids": [1]})]
        self.assertAlmostEqual(first["scale"], 3.8 / 5.0)
        self.assertAlmostEqual(first["score_penalty"], 4.0 * 3.8 / 5.0)
        self.assertEqual(modes, [])

    def test_quick_and_partial_caches_recompute_unpenalized_value(self):
        for kind in (None, "quick", "partial"):
            with self.subTest(kind=kind):
                costs, modes, _rank = self.run_costs(kind)
                self.assertEqual(modes, [True, True])
                self.assertEqual({cost["scale"] for cost in costs.values()}, {3.8 / 5.0})
                self.assertFalse(guandan_ai._blacklist_value_mode())

    def test_candidate_expansion_refreshes_cost_without_changing_value_scale(self):
        costs, modes, _rank = self.run_costs("complete", expanded_penalty=12.0)
        first = costs[guandan_ai._action_identity({"type": "play", "card_ids": [1]})]
        self.assertEqual(first["penalty"], 12.0)
        self.assertAlmostEqual(first["score_penalty"], 12.0 * 3.8 / 5.0)
        self.assertEqual(modes, [])

    def test_legacy_mode_does_not_publish_or_compute_costs(self):
        costs, modes, rank = self.run_costs("quick", separate=False)
        self.assertEqual(costs, {})
        self.assertEqual(modes, [])
        rank.assert_not_called()


class GuandanBlacklistMinimaxPanelTests(unittest.TestCase):
    def run_panel(self, penalties, *, terminal=True, shortcut=None, separate=True,
                  outcomes=((10.0, 14.0), (7.0, 9.0))):
        actions = [{"type": "play", "card_ids": [1]}, {"type": "play", "card_ids": [2]}]
        keys = [guandan_ai._action_identity(action) for action in actions]
        state = {
            "config": {"bot_blacklist_separate_value": separate, "bot_minimax_particles": 2},
            "players": {"p0": {"hand": [{"id": 1}, {"id": 2}, {"id": 3}]}},
            "level_rank": 2, "current_trick": {"player_id": "p3", "combo": {"type": "single"}},
            "_ai_eval_cache": {}, "_test_world": 0,
        }
        public_state = copy.deepcopy(state)
        second_world = copy.deepcopy(state)
        second_world["_test_world"] = 1
        costs = {key: {"penalty": value, "score_penalty": value, "scale": 1.0}
                 for key, value in zip(keys, penalties)} if separate else {}

        def apply_action(trial, _player, action):
            trial["_test_action"] = keys.index(guandan_ai._action_identity(action))
            return [], None

        def terminal_values(_worlds, _player, options, _deadline):
            return ([list(outcomes[keys.index(guandan_ai._action_identity(action))]) for action in options]
                    if terminal else None), {}

        shortcut_names = {
            "forced_relay": "_forced_endgame_control_relay_action",
            "teammate_control_defer": "_deferred_teammate_bomb_pass",
            "public_closeout": "_public_endgame_closeout_action",
        }
        with ExitStack() as stack:
            stack.enter_context(mock.patch.object(guandan.GuandanGame, "get_legal_actions", return_value=["play"]))
            stack.enter_context(mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=apply_action))
            stack.enter_context(mock.patch.object(guandan_ai, "_can_play_all", return_value=False))
            stack.enter_context(mock.patch.object(guandan_ai, "_clone_search_state", side_effect=lambda s, **k: copy.deepcopy(s)))
            stack.enter_context(mock.patch.object(guandan, "_candidate_actions", return_value=actions))
            stack.enter_context(mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda s, p, a: a))
            stack.enter_context(mock.patch.object(guandan, "_determinize_state", return_value=second_world))
            stack.enter_context(mock.patch.object(guandan_ai, "_blacklist_search_costs", return_value=costs))
            stack.enter_context(mock.patch.object(guandan_ai, "_minimax_root_lead_single_penalty", return_value=0.0))
            stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", return_value=0.0))
            stack.enter_context(mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}))
            stack.enter_context(mock.patch.object(guandan_ai, "_minimax_terminal_root_values", side_effect=terminal_values))
            stack.enter_context(mock.patch.object(
                guandan_ai, "_minimax_value",
                side_effect=lambda trial, *a, **k: outcomes[trial["_test_action"]][trial["_test_world"]],
            ))
            for kind, name in shortcut_names.items():
                result = None
                if kind == shortcut:
                    result = (actions[1], 1.0, 0.0) if kind == "public_closeout" else actions[1]
                stack.enter_context(mock.patch.object(guandan_ai, name, return_value=result))
            chosen = guandan_ai.call(
                guandan, "_minimax_pick_action", state, "p0", 1, 2,
                incumbent_action=actions[0], public_state=public_state,
            )
        return chosen, state["_ai_eval_cache"]["minimax_anytime"]

    def test_penalty_changes_terminal_and_depth_choices_not_raw_evidence(self):
        for terminal in (True, False):
            with self.subTest(terminal=terminal):
                plain, before = self.run_panel([0.0, 0.0], terminal=terminal)
                chosen, after = self.run_panel([5.0, 0.0], terminal=terminal)
                self.assertEqual(plain["card_ids"], [1])
                self.assertEqual(chosen["card_ids"], [2])
                original = {guandan_ai._action_identity(row["action"]): row for row in before["root_values"]}
                self.assertEqual(len(after["root_values"]), 2)
                for row in after["root_values"]:
                    prior = original[guandan_ai._action_identity(row["action"])]
                    for field in ("mean", "std", "paired_std", "world_values", "value_score"):
                        self.assertEqual(row[field], prior[field], field)
                    self.assertEqual(row["value"], row["value_score"] - row["blacklist_score_penalty"])

    def test_all_penalized_roots_stay_selectable_and_value_can_compensate(self):
        for terminal in (True, False):
            with self.subTest(terminal=terminal):
                chosen, status = self.run_panel([100.0, 2.0], terminal=terminal,
                                                outcomes=((120.0, 124.0), (7.0, 9.0)))
                self.assertEqual(chosen["card_ids"], [1])
                self.assertEqual(len(status["root_values"]), 2)
                self.assertTrue(all(row["blacklist_penalty"] > 0 for row in status["root_values"]))

    def test_penalized_shortcuts_must_finish_root_comparison(self):
        for kind in ("forced_relay", "teammate_control_defer", "public_closeout"):
            with self.subTest(kind=kind):
                chosen, status = self.run_panel([0.0, 10.0], shortcut=kind)
                self.assertEqual(chosen["card_ids"], [1])
                self.assertEqual(status["stop_reason"], "sampled_terminal")
                self.assertEqual(len(status["root_values"]), 2)

    def test_legacy_shortcuts_keep_previous_behavior(self):
        for kind in ("forced_relay", "teammate_control_defer", "public_closeout"):
            with self.subTest(kind=kind):
                chosen, status = self.run_panel([0.0, 10.0], shortcut=kind, separate=False)
                self.assertEqual(chosen["card_ids"], [2])
                self.assertEqual(status["stop_reason"], kind)


class GuandanBlacklistMinimaxOverrideTests(unittest.TestCase):
    def run_override(self, before, after, penalties=(0.0, 0.0), *, shortcut=None,
                     with_records=True, relay_bonus=0.0, overbomb=False, separate=True,
                     terminal=False):
        state = response_fixtures.GuandanResponsePriorTests().fixture()
        state["config"]["bot_blacklist_separate_value"] = separate
        hand = state["players"]["p0"]["hand"]
        actions = [{"type": "play", "card_ids": [hand[index]["id"]]} for index in (0, 1)]
        for action, penalty in zip(actions, penalties):
            set_penalty(state, "p0", action["card_ids"],
                        response=0.0 if overbomb else penalty,
                        overbomb=penalty if overbomb else 0.0)
        status = {"stop_reason": shortcut or "completed", "completed_depth": 1,
                  "terminal_complete": terminal, "root_values": []}
        if with_records:
            status["root_values"] = [
                {"action": action, "world_values": values, "blacklist_score_penalty": penalty}
                for action, values, penalty in zip(actions, (before, after), penalties)
            ]
        with ExitStack() as stack:
            stack.enter_context(mock.patch.object(guandan_ai, "_retained_bomb_override_is_unsafe", return_value=False))
            stack.enter_context(mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}))
            stack.enter_context(mock.patch.object(guandan_ai, "_minimax_incomplete_resource_risk", return_value=0.0))
            stack.enter_context(mock.patch.object(guandan_ai, "_forced_endgame_control_relay_action", return_value=actions[1]))
            stack.enter_context(mock.patch.object(guandan_ai, "_deferred_teammate_bomb_pass", return_value=actions[1]))
            stack.enter_context(mock.patch.object(guandan_ai, "_public_endgame_closeout_action", return_value=(actions[1], 1.0, 0.0)))
            stack.enter_context(mock.patch.object(
                guandan_ai, "_shared_response_tactical_components", return_value={"clean_single_relay": relay_bonus},
            ))
            accepted = guandan_ai.call(
                guandan, "_should_accept_minimax_override", state, "p0", actions[0], actions[1], status,
            )
        return accepted, state["_ai_eval_cache"]["minimax_override"]

    def test_penalty_changes_acceptance_without_changing_raw_gain_or_ci(self):
        plain, before = self.run_override([10.0, 12.0], [14.0, 20.0])
        accepted, after = self.run_override([10.0, 12.0], [14.0, 20.0], (0.0, 7.0))
        self.assertTrue(plain)
        self.assertFalse(accepted)
        self.assertEqual(after["paired_gain"], before["paired_gain"])
        self.assertEqual(after["paired_gain_lower"], before["paired_gain_lower"])
        self.assertEqual(after["decision_paired_gain"], -1.0)

    def test_strong_raw_gain_can_pay_a_finite_penalty(self):
        accepted, decision = self.run_override([10.0, 12.0], [20.0, 22.0], (2.0, 8.0), terminal=True)
        self.assertTrue(accepted)
        self.assertEqual(decision["decision_paired_gain"], 4.0)

    def test_policy_savings_cannot_manufacture_raw_search_gain(self):
        accepted, decision = self.run_override([10.0, 12.0], [10.0, 12.0], (20.0, 0.0), terminal=True)
        self.assertFalse(accepted)
        self.assertEqual(decision["paired_gain"], 0.0)
        self.assertEqual(decision["decision_paired_gain"], 20.0)

    def test_penalized_shortcut_without_evidence_cannot_bypass_guard(self):
        for shortcut in ("forced_relay", "teammate_control_defer", "public_closeout"):
            with self.subTest(shortcut=shortcut):
                accepted, decision = self.run_override([], [], (0.0, 10.0), shortcut=shortcut, with_records=False)
                self.assertFalse(accepted)
                self.assertEqual(decision["reason"], "incomplete_search_comparison")

    def test_penalized_shortcut_uses_completed_raw_and_decision_comparison(self):
        for shortcut in ("forced_relay", "teammate_control_defer", "public_closeout"):
            with self.subTest(shortcut=shortcut):
                accepted, decision = self.run_override([1.0, 1.0], [2.0, 2.0], (0.0, 10.0), shortcut=shortcut)
                self.assertFalse(accepted)
                self.assertEqual(decision["paired_gain"], 1.0)
                self.assertEqual(decision["decision_paired_gain"], -9.0)

    def test_relay_exemption_can_allow_shortcut_but_does_not_waive_overbomb(self):
        for overbomb, expected in ((False, True), (True, False)):
            with self.subTest(overbomb=overbomb):
                accepted, _decision = self.run_override(
                    [], [], (0.0, 10.0), shortcut="forced_relay", with_records=False,
                    relay_bonus=5.0, overbomb=overbomb,
                )
                self.assertEqual(accepted, expected)

    def test_legacy_shortcut_remains_compatible(self):
        accepted, decision = self.run_override([], [], (0.0, 10.0), shortcut="forced_relay",
                                               with_records=False, separate=False)
        self.assertTrue(accepted)
        self.assertEqual(decision["reason"], "forced_relay")


class GuandanBlacklistBombUpgradeTests(unittest.TestCase):
    def upgrade(self, before_penalty, after_penalty, separate=True):
        state = replay_fixture("b0a262", 72, {"bot_blacklist_separate_value": separate})
        hand = state["players"]["bot4"]["hand"]
        natural = [card["id"] for card in hand if card.get("rank") == 6]
        upgraded = natural + pick_card_ids(hand, ("♥️2",))
        set_penalty(state, "bot4", natural, overbomb=before_penalty)
        set_penalty(state, "bot4", upgraded, overbomb=after_penalty)
        chosen = guandan._prefer_bomb_closeout_upgrade(state, "bot4", natural)
        return chosen, natural, upgraded

    def test_final_upgrade_rejects_uncompensated_extra_penalty(self):
        chosen, natural, _upgraded = self.upgrade(0.0, 0.6)
        self.assertEqual(chosen, natural)

    def test_final_upgrade_pays_only_incremental_penalty(self):
        for before, after in ((0.0, 0.4), (0.0, 0.5), (10.0, 10.4), (10.0, 2.0)):
            with self.subTest(before=before, after=after):
                chosen, _natural, upgraded = self.upgrade(before, after)
                self.assertEqual(set(chosen), set(upgraded))

    def test_legacy_final_upgrade_keeps_previous_allocation(self):
        chosen, _natural, upgraded = self.upgrade(0.0, 100.0, separate=False)
        self.assertEqual(set(chosen), set(upgraded))


if __name__ == "__main__":
    unittest.main()
