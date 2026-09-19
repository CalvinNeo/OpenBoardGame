from contextlib import ExitStack
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanNestedScoringTests(unittest.TestCase):
    def setUp(self):
        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        self.state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()

        def take(rank):
            card = next(card for card in deck if card.get("rank") == rank)
            deck.remove(card)
            return card

        hand = [take(rank) for rank in (5, 7, 9)]
        lead = take(6)
        self.state.update(
            phase="playing", level_rank=2, current_turn="bot", finish_order=[],
            round_memories=[], pass_limits={}, known_card_owners={}, _ai_eval_cache={},
            current_trick={"player_id": "opp2", "cards": [lead["id"]],
                           "combo": guandan._evaluate_combo([lead], 2, {})},
            trick_plays={"opp2": [lead]},
        )
        self.state["players"]["bot"]["hand"] = hand
        for pid in ("opp", "mate", "opp2"):
            self.state["players"][pid]["hand"] = deck[:15]
            del deck[:15]
        self.state["seen_cards"] = [lead["id"]] + [card["id"] for card in deck]
        self.options = [[hand[1]["id"]], [hand[2]["id"]]]

    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, self.state, "bot", *args, **kwargs)

    def option_mocks(self, stack):
        stack.enter_context(mock.patch.object(guandan, "_list_hint_options", return_value=self.options))
        for name in ("_rank_response_options", "_filter_overbomb_options"):
            stack.enter_context(mock.patch.object(guandan_ai, name, side_effect=lambda _s, _p, cards: cards))

    def test_partial_components_are_recomputed_then_complete_results_are_cached(self):
        partial = {"anytime_partial": 1.0, "total": 999.0}
        complete = {"total": 7.0}
        with mock.patch.object(guandan_ai, "_compute_bot_score_components", side_effect=[partial, complete]) as compute:
            first = self.call("_bot_score_components", self.options[0], 3)
            self.assertTrue(first.get("anytime_partial"))
            self.assertEqual(self.state["_ai_eval_cache"]["bot_score_components"], {})
            second = self.call("_bot_score_components", self.options[0], 3)
            second["total"] = -99.0
            self.assertEqual(self.call("_bot_score_components", self.options[0], 3), {"total": 7.0})
            self.assertEqual(compute.call_count, 2)

    def test_response_query_distinguishes_absence_from_incomplete_panel(self):
        with ExitStack() as stack:
            self.option_mocks(stack)
            stack.enter_context(mock.patch.object(
                guandan_ai, "_bot_score_components",
                side_effect=[{"total": 5.0}, {"anytime_partial": 1.0, "total": 999.0}],
            ))
            self.assertEqual(self.call("_best_response_play_score_result", 3), (None, False))
        with mock.patch.object(guandan, "_list_hint_options", return_value=[]):
            self.assertEqual(self.call("_best_response_play_score_result", 3), (None, True))
        with ExitStack() as stack:
            self.option_mocks(stack)
            stack.enter_context(mock.patch.object(guandan_ai, "_bot_score_components", return_value={"total": 5.0}))
            self.assertEqual(self.call("_best_response_play_score_result", 3), (5.0, True))
            self.assertEqual(self.call("_best_response_play_score", 3), 5.0)

    def test_soft_budget_result_can_finish_with_a_later_deadline(self):
        with mock.patch.object(guandan_ai.time, "perf_counter", return_value=0.95):
            with mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", 1.0, create=True):
                partial = self.call("_bot_score_components", self.options[0], 1)
            self.assertTrue(partial.get("anytime_partial"))
            self.assertEqual(self.state["_ai_eval_cache"]["bot_score_components"], {})
            with mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", 2.0, create=True):
                complete = self.call("_bot_score_components", self.options[0], 1)
            self.assertNotIn("anytime_partial", complete)
            self.assertTrue(self.state["_ai_eval_cache"]["bot_score_components"])

    def test_soft_budget_partial_response_cannot_make_pass_win(self):
        clock = [0.0]
        original_compute = guandan_ai._compute_bot_score_components
        seen_pass_components = []

        def compute(state, pid, cards, depth):
            if cards == self.options[0]:
                return {"total": 10.0}
            if cards == self.options[1]:
                clock[0] = 0.95
            result = original_compute(state, pid, cards, depth)
            if cards is None:
                seen_pass_components.append(result)
            return result

        def quick(_state, _pid, cards):
            return 20.0 if cards == self.options[0] else (10.0 if cards is None else 5.0)

        with ExitStack() as stack:
            self.option_mocks(stack)
            stack.enter_context(mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]))
            stack.enter_context(mock.patch.object(guandan_ai, "_compute_bot_score_components", side_effect=compute))
            stack.enter_context(mock.patch.object(
                guandan_ai, "_hand_state_value_components", side_effect=lambda *_args: {"stock": 100.0}
            ))
            stack.enter_context(mock.patch.object(guandan_ai, "_shared_pass_tactical_components", return_value={}))
            stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", side_effect=quick))
            for name in ("_must_contest_short_enemy_as_last_defender", "_must_contest_structured_enemy_runout"):
                stack.enter_context(mock.patch.object(guandan_ai, name, return_value=False))
            chosen = self.call("_bot_select_play", 3, deadline=1.0)

        self.assertEqual(chosen, self.options[0])
        self.assertLess(clock[0], 1.0)
        self.assertTrue(seen_pass_components[0].get("anytime_partial"))
        self.assertNotIn("pass_opportunity_cost", seen_pass_components[0])
        cached = self.state["_ai_eval_cache"]["bot_score_components"]
        self.assertEqual(list(cached.values()), [{"total": 10.0}])
        status = self.state["_ai_eval_cache"]["heuristic_anytime"]
        self.assertEqual(status["stop_reason"], "partial_candidate")
        self.assertEqual(status["evaluated"], 1)

    def test_partial_bomb_panel_is_not_a_complete_best_score(self):
        with mock.patch.object(guandan_ai, "_short_enemy_pressure_bomb_options", return_value=self.options), \
             mock.patch.object(guandan_ai, "_bot_score_components", side_effect=[
                 {"total": 5.0}, {"anytime_partial": 1.0, "total": 999.0},
             ]):
            self.assertEqual(self.call("_best_short_enemy_pressure_bomb_score_result", 3), (None, False))
        with mock.patch.object(guandan_ai, "_short_enemy_pressure_bomb_options", return_value=[]):
            self.assertEqual(self.call("_best_short_enemy_pressure_bomb_score_result", 3), (None, True))

    def test_partial_bomb_dependency_marks_outer_pass_partial(self):
        with ExitStack() as stack:
            stack.enter_context(mock.patch.object(guandan_ai, "_hand_state_value_components", return_value={"stock": 10.0}))
            stack.enter_context(mock.patch.object(guandan_ai, "_shared_pass_tactical_components", return_value={}))
            stack.enter_context(mock.patch.object(guandan_ai, "_best_response_play_score_result", return_value=(None, True)))
            stack.enter_context(mock.patch.object(guandan_ai, "_best_short_enemy_pressure_bomb_score_result", return_value=(None, False)))
            stack.enter_context(mock.patch.object(guandan_ai, "_high_single_bomb_profile", return_value=None))
            for name in ("_teammate_future_control_probability", "_best_takeover_opportunity", "_short_enemy_defer_bomb_risk_penalty"):
                stack.enter_context(mock.patch.object(guandan_ai, name, return_value=0.0))
            components = self.call("_bot_score_components", None, 3)
        self.assertTrue(components.get("anytime_partial"))
        self.assertNotIn("pass_best_bomb_gap", components)
        self.assertEqual(self.state["_ai_eval_cache"]["bot_score_components"], {})

    def test_leaf_incomplete_response_interrupts_before_no_natural_response_fallback(self):
        with ExitStack() as stack:
            stack.enter_context(mock.patch.object(guandan_ai, "_hand_state_value_components", return_value={"stock": 10.0}))
            stack.enter_context(mock.patch.object(guandan_ai, "_best_response_play_score_result", return_value=(None, False)))
            fallback = stack.enter_context(mock.patch.object(guandan_ai, "_high_single_bomb_profile"))
            for name in ("_opponent_finish_pressure_penalty", "_single_lead_finish_window_penalty", "_active_lead_escape_window_penalty"):
                stack.enter_context(mock.patch.object(guandan_ai, name, return_value=0.0))
            with self.assertRaises(guandan_ai._IncompleteStateEvaluation):
                self.call("_evaluate_state_for_bot")
        fallback.assert_not_called()

    def soft_leaf_patches(self, stack, clock):
        """Keep the real nested scoring cutoff, with cheap unrelated features."""
        stack.enter_context(mock.patch.object(
            guandan_ai.time, "perf_counter", side_effect=lambda: clock[0],
        ))
        stack.enter_context(mock.patch.object(
            guandan_ai, "_hand_state_value_components", return_value={"stock": 10.0},
        ))
        for name in ("_opponent_finish_pressure_penalty", "_single_lead_finish_window_penalty",
                     "_active_lead_escape_window_penalty"):
            stack.enter_context(mock.patch.object(guandan_ai, name, return_value=0.0))
        self.option_mocks(stack)

    def test_mcts_soft_partial_leaf_keeps_completed_layer_before_hard_deadline(self):
        actions = [{"type": "play", "card_ids": cards} for cards in self.options]
        actions.append({"type": "pass"})
        self.state["config"]["bot_mcts_early_stop_gap"] = 9999.0
        clock = [0.0]
        worlds = [0]
        original_evaluate = guandan_ai._evaluate_state_for_bot

        def determinize(source, *_args):
            particle = guandan._clone_search_state(source)
            particle["test_world"] = worlds[0]
            worlds[0] += 1
            return particle

        def tree_value(child, bot_id, ply, _width, rollout_depth):
            depth = ply + rollout_depth
            played = child["current_trick"]["cards"]
            is_pass = child["current_trick"]["player_id"] != "bot"
            if depth == 1 and child["test_world"] == 2 and is_pass:
                clock[0] = 0.95
            child["test_value"] = (
                40.0 if depth == 0 and played == self.options[1]
                else 1000.0 if depth == 1 and played == self.options[0]
                else 0.0
            )
            return guandan_ai._mcts_leaf_value(child, bot_id)

        def evaluate(child, bot_id):
            if clock[0] > 0.9:
                # Real legal responses use real _bot_score_components here;
                # its <=80ms cutoff, not a mocked exception, interrupts search.
                return original_evaluate(self.state, bot_id)
            return child["test_value"]

        with ExitStack() as stack:
            self.soft_leaf_patches(stack, clock)
            for name, value in (("_candidate_actions", actions), ("_mcts_budget", (18, 1, 1, 1)),
                                ("_mcts_obvious_response_scores", None),
                                ("_mcts_high_single_bomb_scores", None)):
                stack.enter_context(mock.patch.object(guandan, name, return_value=value))
            stack.enter_context(mock.patch.object(guandan_ai, "_mcts_high_single_joker_scores", return_value=None))
            stack.enter_context(mock.patch.object(
                guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, choices: choices,
            ))
            stack.enter_context(mock.patch.object(
                guandan, "_mcts_root_heuristic_value",
                side_effect=lambda _s, _p, action, _d: 1.0 if action == actions[0] else 0.0,
            ))
            stack.enter_context(mock.patch.object(guandan, "_determinize_state", side_effect=determinize))
            stack.enter_context(mock.patch.object(guandan, "_mcts_reply_tree_value", side_effect=tree_value))
            stack.enter_context(mock.patch.object(guandan_ai, "_evaluate_state_for_bot", side_effect=evaluate))
            picked, scored = self.call("_mcts_pick_action", 18, 1, 3, 1, 1, 0.28, deadline=1.0)

        self.assertEqual(picked, actions[1])
        self.assertEqual(clock[0], 0.95)
        status = self.state["_ai_eval_cache"]["mcts_anytime"]
        self.assertEqual(status["completed_depth"], 0)
        self.assertEqual(status["interrupted_depth"], 1)
        self.assertEqual(status["attempted"], 18)
        self.assertTrue(status["deadline_limited"])
        self.assertFalse(status["fallback_to_reference"])
        self.assertTrue(all(count == 3 and stats["depth"] == 0 for _a, _s, count, stats in scored))

    def test_minimax_soft_partial_leaf_keeps_completed_depth_before_hard_deadline(self):
        actions = [{"type": "play", "card_ids": cards} for cards in self.options]
        clock = [0.0]
        evaluations = [0]
        original_evaluate = guandan_ai._evaluate_state_for_bot

        def evaluate(child, bot_id):
            evaluations[0] += 1
            if evaluations[0] == 4:
                clock[0] = 0.95
                return original_evaluate(self.state, bot_id)
            if evaluations[0] == 3:
                return 1000.0
            return 40.0 if child["current_trick"]["cards"] == self.options[1] else 0.0

        with ExitStack() as stack:
            self.soft_leaf_patches(stack, clock)
            stack.enter_context(mock.patch.object(guandan, "_candidate_actions", return_value=actions))
            stack.enter_context(mock.patch.object(
                guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, choices: choices,
            ))
            for name in ("_public_endgame_closeout_action", "_forced_endgame_control_relay_action", "_next_actor"):
                stack.enter_context(mock.patch.object(guandan_ai, name, return_value=None))
            stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", return_value=0.0))
            stack.enter_context(mock.patch.object(guandan_ai, "_evaluate_state_for_bot", side_effect=evaluate))
            picked = self.call("_minimax_pick_action", 2, 2, deadline=1.0, incumbent_action=actions[0])

        self.assertEqual(picked, actions[1])
        self.assertEqual(clock[0], 0.95)
        status = self.state["_ai_eval_cache"]["minimax_anytime"]
        self.assertEqual(status["completed_depth"], 1)
        self.assertEqual(status["interrupted_depth"], 2)
        self.assertEqual(status["attempted"], 4)
        self.assertTrue(status["deadline_limited"])
        self.assertFalse(status["used_initial_incumbent"])


if __name__ == "__main__":
    unittest.main()
