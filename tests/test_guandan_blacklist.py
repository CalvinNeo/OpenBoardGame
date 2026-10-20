import copy
import unittest
from unittest import mock

from game import guandan, guandan_ai, guandan_endgame
from tests import test_guandan_response_priors as response_fixtures
from tests import test_guandan_trick_boundary as trick_fixtures
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanBlacklistTests(unittest.TestCase):
    def fixture(self, ranks=(7, 9, 9, 11)):
        state = response_fixtures.GuandanResponsePriorTests().fixture(ranks)
        state["config"].update(
            bot_blacklist_separate_value=True,
            bot_trick_boundary_mode="off",
        )
        return state

    @staticmethod
    def call(name, state, *args, **kwargs):
        return guandan_ai.call(guandan, name, state, "p0", *args, **kwargs)

    @staticmethod
    def set_penalties(state, cards, response=0.0, overbomb=0.0, player_id="p0"):
        key = (player_id, guandan._cards_key(cards))
        cache = state.setdefault("_ai_eval_cache", {})
        cache.setdefault("response_soft_penalties", {})[key] = response
        cache.setdefault("overbomb_soft_penalties", {})[key] = overbomb

    @staticmethod
    def cards_of_rank(state, rank):
        return [card["id"] for card in state["players"]["p0"]["hand"]
                if card["rank"] == rank]

    def test_rule_profile_keeps_both_reasons_and_relay_only_waives_response(self):
        state = self.fixture((7, 13, 13, 13, 13, 8))
        cards = self.cards_of_rank(state, 13)
        self.set_penalties(state, cards, response=10.0, overbomb=18.0)
        before = copy.deepcopy(state)
        self.assertEqual(self.call("_candidate_blacklist_penalties", state, cards), {
            "response_material_prior": 10.0,
            "overbomb_prior": 18.0,
        })
        self.assertEqual(self.call("_candidate_blacklist_penalties", state, cards,
                                   relay_bonus=4.0), {"overbomb_prior": 18.0})
        self.assertEqual(state, before)

    def test_component_penalty_counts_only_the_two_policy_components(self):
        components = {"soft_candidate_prior": -10.0, "soft_overbomb_prior": -18.0,
                      "response_material": -40.0, "opp_risk": -7.0, "total": 25.0}
        self.assertEqual(guandan_ai._blacklist_component_penalty(components), 28.0)
        self.assertEqual(guandan_ai._blacklist_component_penalty({"opp_risk": -7.0}), 0.0)

    def test_rankers_keep_penalized_legal_actions_available(self):
        state = self.fixture((7, 13, 13, 13, 13, 8))
        options = guandan._list_hint_options(state, "p0")
        before = {tuple(sorted(cards)) for cards in options}
        for cards in options:
            self.set_penalties(state, cards, response=10.0, overbomb=18.0)
        ranked = self.call("_rank_response_options", state, options)
        filtered = self.call("_filter_overbomb_options", state, ranked)
        self.assertEqual({tuple(sorted(cards)) for cards in filtered}, before)
        actions = self.call("_candidate_actions", state, len(options) + 1)
        self.assertEqual({tuple(sorted(action["card_ids"])) for action in actions
                          if action["type"] == "play"}, before)
        self.assertTrue(any(action["type"] == "pass" for action in actions))

    def test_value_context_is_nested_and_restored_after_exception(self):
        self.assertFalse(guandan_ai._blacklist_value_mode())
        with self.assertRaisesRegex(RuntimeError, "test interruption"):
            with guandan_ai._blacklist_value_scoring():
                self.assertTrue(guandan_ai._blacklist_value_mode())
                with guandan_ai._blacklist_value_scoring():
                    self.assertTrue(guandan_ai._blacklist_value_mode())
                self.assertTrue(guandan_ai._blacklist_value_mode())
                raise RuntimeError("test interruption")
        self.assertFalse(guandan_ai._blacklist_value_mode())

    def test_real_detail_and_quick_values_do_not_change_with_policy_penalty(self):
        state = self.fixture()
        cards = self.cards_of_rank(state, 9)[:1]
        with guandan_ai._blacklist_value_scoring():
            base = self.call("_bot_score_components", state, cards, 1)
            quick_base = self.call("_quick_candidate_score", state, cards)
        self.assertNotIn("anytime_partial", base)
        self.set_penalties(state, cards, response=10.0)
        adjusted = self.call("_bot_score_components", state, cards, 1)
        self.assertAlmostEqual(adjusted["total"], base["total"] - 10.0)
        self.assertEqual(adjusted["soft_candidate_prior"], -10.0)
        self.assertAlmostEqual(self.call("_quick_candidate_score", state, cards), quick_base - 10.0)
        with guandan_ai._blacklist_value_scoring():
            self.assertEqual(self.call("_bot_score_components", state, cards, 1), base)
            self.assertAlmostEqual(self.call("_quick_candidate_score", state, cards), quick_base)

    def test_pass_opportunity_cost_uses_response_value_without_policy_penalties(self):
        state = self.fixture()
        before = self.call("_bot_score_components", state, None, 1)
        self.assertNotIn("anytime_partial", before)
        options = guandan._list_hint_options(state, "p0")
        for cards in options:
            self.set_penalties(state, cards, response=80.0, overbomb=80.0)
        after = self.call("_bot_score_components", state, None, 1)
        fresh = copy.deepcopy(state)
        fresh["_ai_eval_cache"] = {
            name: copy.deepcopy(state["_ai_eval_cache"][name])
            for name in ("response_soft_penalties", "overbomb_soft_penalties")
        }
        cold = self.call("_bot_score_components", fresh, None, 1)
        self.assertEqual(after, before)
        self.assertEqual(cold, before)
        self.assertEqual(guandan_ai._blacklist_component_penalty(after), 0.0)

    def test_public_finish_samples_ignore_policy_cost_and_value_context(self):
        state = self.fixture()
        before = self.call("_public_finish_turn_panels", state)
        cards = self.cards_of_rank(state, 9)[:1]
        self.set_penalties(state, cards, response=10.0, overbomb=18.0)
        with guandan_ai._blacklist_value_scoring():
            self.assertEqual(self.call("_public_finish_turn_panels", state), before)
        state["_ai_eval_cache"].pop("public_finish_turns")
        self.assertEqual(self.call("_public_finish_turn_panels", state), before)
        state["config"]["bot_blacklist_separate_value"] = False
        state["_ai_eval_cache"].pop("public_finish_turns")
        self.assertEqual(self.call("_public_finish_turn_panels", state), before)

    def test_bomb_upgrade_floor_uses_base_value_without_its_policy_penalty(self):
        state = replay_fixture("b0a262", 72, {
            "bot_blacklist_separate_value": True, "bot_trick_boundary_mode": "off",
        })
        hand = state["players"]["bot4"]["hand"]
        natural = [card["id"] for card in hand if card.get("rank") == 6]
        upgraded = natural + pick_card_ids(hand, ("♥️2",))

        def score(cards):
            return guandan_ai.call(guandan, "_bot_score_components", state, "bot4", cards, 2)

        with guandan_ai._blacklist_value_scoring():
            base_value = score(natural)
            upgraded_value = score(upgraded)
        self.assertGreater(upgraded_value["bomb_closeout_upgrade"], 0)
        self.assertAlmostEqual(upgraded_value["total"], base_value["total"] + 0.5)
        self.set_penalties(state, natural, response=10.0, overbomb=18.0, player_id="bot4")
        self.set_penalties(state, upgraded, response=4.0, overbomb=6.0, player_id="bot4")
        # Recompute the recursion from cold value caches, retaining only policy.
        state["_ai_eval_cache"] = {
            name: state["_ai_eval_cache"][name]
            for name in ("response_soft_penalties", "overbomb_soft_penalties")
        }
        with guandan_ai._blacklist_value_scoring():
            self.assertEqual(score(natural), base_value)
            self.assertEqual(score(upgraded), upgraded_value)
        self.assertAlmostEqual(score(natural)["total"], base_value["total"] - 28.0)
        self.assertAlmostEqual(score(upgraded)["total"], upgraded_value["total"] - 10.0)

    def test_interleaved_value_and_decision_caches_never_double_charge(self):
        state = self.fixture()
        cards = self.cards_of_rank(state, 9)[:1]
        self.set_penalties(state, cards, response=10.0, overbomb=18.0)
        with guandan_ai._blacklist_value_scoring():
            base = self.call("_bot_score_components", state, cards, 1)
        for response in (10.0, 4.0, 10.0):
            with self.subTest(response=response):
                self.set_penalties(state, cards, response=response, overbomb=18.0)
                first = self.call("_bot_score_components", state, cards, 1)
                with guandan_ai._blacklist_value_scoring():
                    self.assertEqual(self.call("_bot_score_components", state, cards, 1), base)
                second = self.call("_bot_score_components", state, cards, 1)
                self.assertEqual(first, second)
                self.assertAlmostEqual(first["total"], base["total"] - response - 18.0)
                self.assertAlmostEqual(guandan_ai._blacklist_component_penalty(first), response + 18.0)

    def choose_with_values(self, state, values):
        # Isolate policy preference from the tactical evaluator, while retaining
        # real legal actions, score wrapping and the ordinary final selector.
        def base_score(_state, _pid, cards, _depth):
            value = values.get(tuple(sorted(cards or [])), -100.0)
            return {"test_value": value, "total": value}

        with (
            mock.patch.object(guandan_ai, "_compute_bot_score_components", side_effect=base_score),
            mock.patch.object(guandan_ai, "_rank_response_options", side_effect=lambda _s, _p, opts: opts),
            mock.patch.object(guandan_ai, "_filter_overbomb_options", side_effect=lambda _s, _p, opts: opts),
        ):
            action = self.call("_heuristic_best_action", state, 1)
        trial = copy.deepcopy(state)
        _, error = guandan.GuandanGame.apply_action(trial, "p0", action)
        self.assertIsNone(error)
        return action

    def test_finite_penalty_prefers_other_action_only_until_value_compensates(self):
        for marked_value, expected_rank in ((19.0, 7), (40.0, 9)):
            with self.subTest(marked_value=marked_value):
                state = self.fixture()
                marked = self.cards_of_rank(state, 9)[:1]
                ordinary = self.cards_of_rank(state, 7)
                self.set_penalties(state, marked, response=10.0)
                action = self.choose_with_values(state, {
                    tuple(sorted(marked)): marked_value,
                    tuple(sorted(ordinary)): 15.0,
                })
                self.assertEqual(action["type"], "play")
                expected = marked if expected_rank == 9 else ordinary
                self.assertEqual(set(action["card_ids"]), set(expected))

    def test_all_play_candidates_penalized_still_selects_best_legal_play(self):
        state = self.fixture()
        options = guandan._list_hint_options(state, "p0")
        for cards in options:
            self.set_penalties(state, cards, response=10.0)
        best = self.cards_of_rank(state, 11)
        values = {tuple(sorted(cards)): 20.0 for cards in options}
        values[tuple(sorted(best))] = 40.0
        action = self.choose_with_values(state, values)
        self.assertEqual(action, {"type": "play", "card_ids": best})
        self.assertGreater(sum(self.call("_candidate_blacklist_penalties", state, best).values()), 0)

    def set_panel(self, state, entries):
        depth = state["config"]["bot_search_depth"]
        self.call("_store_heuristic_scored_candidates", state, depth, entries)
        state["_ai_eval_cache"]["heuristic_anytime"] = {
            "cache_key": self.call("_heuristic_score_cache_key", state, depth),
            "bounded_scoring": False, "interrupted": False, "deadline_limited": False,
            "evaluated": len(entries), "total": len(entries), "stop_reason": "candidates_exhausted",
        }

    def test_policy_gap_cannot_create_confidence_and_disabled_mode_is_compatible(self):
        for enabled, expected in ((True, False), (False, True)):
            with self.subTest(enabled=enabled):
                state = self.fixture()
                state["config"]["bot_blacklist_separate_value"] = enabled
                cards = self.cards_of_rank(state, 9)[:1]
                self.set_panel(state, [(None, 40.0, {}),
                                       (cards, 29.0, {"soft_candidate_prior": -10.0})])
                result = self.call("_heuristic_search_confidence", state,
                                   state["config"]["bot_search_depth"], {"type": "pass"})
                self.assertEqual(result["confident"], expected)

    def test_confidence_checks_candidate_beyond_original_runner_up(self):
        state = self.fixture()
        first = self.cards_of_rank(state, 7)
        second = self.cards_of_rank(state, 9)[:1]
        self.set_panel(state, [(None, 50.0, {}), (first, 35.0, {}),
                               (second, 29.0, {"soft_overbomb_prior": -18.0})])
        result = self.call("_heuristic_search_confidence", state,
                           state["config"]["bot_search_depth"], {"type": "pass"})
        self.assertFalse(result["confident"])

    def test_clearly_better_unpenalized_value_still_establishes_confidence(self):
        state = self.fixture()
        cards = self.cards_of_rank(state, 9)[:1]
        self.set_panel(state, [(None, 40.0, {}), (cards, 15.0, {})])
        result = self.call("_heuristic_search_confidence", state,
                           state["config"]["bot_search_depth"], {"type": "pass"})
        self.assertTrue(result["confident"])

    def test_penalties_do_not_change_terminal_utilities_or_exact_root_values(self):
        state = trick_fixtures.make_state({"bot": [3], "opp": [4], "mate": [5], "opp2": [6]})
        state["config"]["bot_blacklist_separate_value"] = True
        solver = guandan_endgame.EndgameSolver(guandan, state, "bot")
        actions = solver.root_actions()
        before = solver.root_values(actions)
        for actor, data in state["players"].items():
            key = (actor, guandan._cards_key([card["id"] for card in data["hand"]]))
            for name in ("response_soft_penalties", "overbomb_soft_penalties"):
                state["_ai_eval_cache"].setdefault(name, {})[key] = 5000.0
        after = guandan_endgame.EndgameSolver(guandan, state, "bot").root_values(actions)
        self.assertEqual(before, after)
        self.assertTrue(all(value in (-300.0, -200.0, -100.0, 100.0, 200.0, 300.0)
                            for value in after))
        for level, expected in ((2, 300.0), (14, 1000.0)):
            with self.subTest(level=level):
                settled = copy.deepcopy(state)
                settled["dealer_team"] = settled["player_teams"]["bot"]
                settled["teams"][settled["dealer_team"]]["level"] = level
                settled["finish_order"] = ["bot", "mate"]
                for rank, actor in enumerate(settled["finish_order"], 1):
                    settled["players"][actor].update(hand=[], finished=True, finish_rank=rank)
                self.assertEqual(guandan._evaluate_state_for_bot(settled, "bot"), expected)
                self.assertEqual(guandan._evaluate_state_for_bot(settled, "opp"), -expected)


if __name__ == "__main__":
    unittest.main()
