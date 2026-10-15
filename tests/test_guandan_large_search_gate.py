import copy
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import replay_fixture
from tests.test_guandan_retained_bomb import make_five_card_tail_state


class GuandanLargeSearchGateTests(unittest.TestCase):
    def test_gate_counts_every_active_hand_and_root_action(self):
        for counts, candidates, expected in (
            ((25, 20, 20, 20), 4, False),
            ((5, 27, 10, 8), 4, False),
            ((18, 8, 10, 8), 4, False),
            ((17, 17, 17, 17), 5, True),
            ((9, 27, 20, 20), 3, True),
        ):
            with self.subTest(counts=counts, candidates=candidates):
                state = replay_fixture("38c", 53)
                pid = state["current_turn"]
                for player, count in zip(state["turn_order"], counts):
                    state["players"][player].update(hand=[{}] * count, finished=False)
                state["current_trick"]["combo"]["type"] = "bomb"
                actions = [{"type": "play", "card_ids": [n]} for n in range(candidates - 1)]
                actions.append({"type": "pass"})
                with (
                    mock.patch.object(guandan_ai, "_teammate_lead_context", return_value=False),
                    mock.patch.object(guandan_ai, "_get_cached_heuristic_scored_candidates", return_value=None),
                    mock.patch.object(guandan_ai, "_candidate_actions", return_value=actions),
                    mock.patch.object(guandan_ai, "_filter_overbomb_actions", side_effect=lambda _s, _p, a: a),
                    mock.patch.object(guandan_ai, "_mcts_root_candidate_subset", return_value=actions),
                ):
                    self.assertEqual(guandan._should_use_mcts(state, pid, 5), expected)
                if not expected:
                    self.assertEqual(state["_ai_eval_cache"]["mcts_gate"]["reason"],
                                     "large_hands_many_actions")

    def test_saved_expensive_position_keeps_heuristic_without_entering_mcts(self):
        state = replay_fixture("38c", 5, {"bot_mcts_gate_score_gap": float("inf")})
        pid = state["current_turn"]
        stages = []
        with mock.patch.object(guandan, "_mcts_pick_action") as search:
            action = guandan.GuandanGame.bot_move(
                state, pid, progress_callback=lambda stage, *_args: stages.append(stage))
        search.assert_not_called()
        self.assertNotIn("mcts", stages)
        self.assertEqual(state["bot_explain"][pid]["method"], "heuristic")
        self.assertEqual(state["bot_explain"][pid]["method_details"]["mcts_gate"]["reason"],
                         "large_hands_many_actions")
        self.assertEqual(action["type"], "play")

    def test_narrow_bomb_decision_without_a_decisive_margin_still_searches(self):
        state = replay_fixture("38c", 53, {"bot_mcts_gate_score_gap": float("inf")})
        stages = []
        with mock.patch.object(guandan, "_mcts_pick_action", return_value=(None, [])) as search:
            guandan.GuandanGame.bot_move(
                state, state["current_turn"],
                progress_callback=lambda stage, *_args: stages.append(stage))
        search.assert_called_once()
        self.assertIn("mcts", stages)


class GuandanHeuristicSearchGateTests(unittest.TestCase):
    @staticmethod
    def _call(name, *args):
        return guandan_ai.call(guandan, name, *args)

    def _panel(self, state, entries):
        pid = state["current_turn"]
        depth = state["config"]["bot_search_depth"]
        self._call("_store_heuristic_scored_candidates", state, pid, depth, entries)
        state["_ai_eval_cache"]["heuristic_anytime"] = {
            "cache_key": self._call("_heuristic_score_cache_key", state, pid, depth),
            "bounded_scoring": False, "interrupted": False, "deadline_limited": False,
            "evaluated": len(entries), "total": len(entries), "stop_reason": "candidates_exhausted",
        }

    def _confidence(self, state, action=None):
        return guandan._heuristic_search_confidence(
            state, state["current_turn"], state["config"]["bot_search_depth"], action
        )

    def _state(self):
        state = make_five_card_tail_state()
        pid = state["current_turn"]
        cards = next(action["card_ids"] for action in guandan._candidate_actions(state, pid, 8)
                     if action["type"] == "play")
        return state, cards

    def test_complete_bomb_comparison_skips_mcts_before_critical_gate(self):
        state, cards = self._state()
        self._panel(state, [(None, 30.0, {}), (cards, 0.0, {})])
        self.assertTrue(self._confidence(state, {"type": "pass"})["confident"])
        self.assertFalse(guandan._should_use_mcts(state, state["current_turn"], 5))
        self.assertEqual(state["_ai_eval_cache"]["mcts_gate"]["reason"], "clear_heuristic_margin")

    def test_close_comparison_still_allows_bomb_search(self):
        state, cards = self._state()
        self._panel(state, [(None, 30.0, {}), (cards, 29.0, {})])
        self.assertFalse(self._confidence(state)["confident"])
        self.assertTrue(guandan._should_use_mcts(state, state["current_turn"], 5))

    def test_incomplete_or_stale_scores_never_establish_confidence(self):
        original, cards = self._state()
        self._panel(original, [(None, 30.0, {}), (cards, 0.0, {})])
        for update in (
            {"bounded_scoring": True}, {"interrupted": True}, {"deadline_limited": True},
            {"evaluated": 1}, {"stop_reason": "target_reached"}, {"cache_key": ()},
        ):
            with self.subTest(update=update):
                state = copy.deepcopy(original)
                state["_ai_eval_cache"]["heuristic_anytime"].update(update)
                self.assertFalse(self._confidence(state)["confident"])
        state = copy.deepcopy(original)
        state["pass_count"] += 1
        self.assertFalse(self._confidence(state)["confident"])

    def test_partial_quick_nonfinite_or_missing_pass_scores_are_not_confidence(self):
        state, cards = self._state()
        for entries in (
            [(None, 30.0, {"anytime_quick_score": 30.0}), (cards, 0.0, {})],
            [(None, 30.0, {}), (cards, 0.0, {"anytime_partial": 1.0})],
            [(None, float("inf"), {}), (cards, 0.0, {})],
            [(cards, 30.0, {}), (cards[:1], 0.0, {})],
            [(None, 30.0, {})],
        ):
            with self.subTest(entries=entries):
                self._panel(state, entries)
                self.assertFalse(self._confidence(state)["confident"])

    def test_duplicate_order_does_not_hide_margin_but_other_material_stays_distinct(self):
        state, cards = self._state()
        self._panel(state, [(cards, 30.0, {}), (list(reversed(cards)), 30.0, {}), (None, 0.0, {})])
        self.assertTrue(self._confidence(state)["confident"])
        self._panel(state, [(cards, 30.0, {}), (list(reversed(cards)), 31.0, {}), (None, 0.0, {})])
        self.assertFalse(self._confidence(state)["confident"])
        # Distinct physical cards must not be merged on rank or combo alone.
        other = [card["id"] for card in state["players"][state["current_turn"]]["hand"]
                 if card["id"] not in cards][0]
        self._panel(state, [(cards, 30.0, {}), (cards[:-1] + [other], 29.0, {}), (None, 0.0, {})])
        self.assertFalse(self._confidence(state)["confident"])

    def test_legalization_cannot_transfer_margin_to_a_different_action(self):
        state, cards = self._state()
        self._panel(state, [(None, 30.0, {}), (cards, 0.0, {})])
        result = self._confidence(state, {"type": "play", "card_ids": cards})
        self.assertFalse(result["confident"])
        self.assertEqual(result["reason"], "incumbent_changed")

    def test_auto_dispatch_searches_only_when_comparison_is_ambiguous(self):
        for endgame in (False, True):
            for gap in (1.0, 30.0):
                with self.subTest(endgame=endgame, gap=gap):
                    state, cards = self._state()
                    pid = state["current_turn"]
                    state["config"].update(bot_mode="auto", bot_endgame_threshold=108 if endgame else 0)

                    def baseline(current, _pid, _depth, **_kwargs):
                        self._panel(current, [(None, 30.0, {}), (cards, 30.0 - gap, {})])
                        return {"type": "pass"}

                    with (
                        mock.patch.object(guandan, "_heuristic_best_action", side_effect=baseline),
                        mock.patch.object(guandan, "_should_use_mcts", return_value=True),
                        mock.patch.object(guandan, "_determinize_state", return_value=state),
                        mock.patch.object(guandan, "_mcts_pick_action", return_value=(None, [])) as mcts,
                        mock.patch.object(guandan, "_minimax_pick_action", return_value=None) as minimax,
                    ):
                        self.assertEqual(guandan.GuandanGame.bot_move(state, pid), {"type": "pass"})
                    self.assertEqual(mcts.call_count, int(not endgame and gap < 10.0))
                    self.assertEqual(minimax.call_count, int(endgame and gap < 10.0))
                    details = state["bot_explain"][pid]["method_details"]
                    self.assertEqual(details["heuristic_search_gate"]["confident"], gap >= 10.0)

    def test_saved_five_card_bomb_tail_passes_without_search_in_auto(self):
        state = make_five_card_tail_state()
        state["config"]["bot_mode"] = "auto"
        pid = state["current_turn"]
        stages = []
        with (
            mock.patch.object(guandan, "_mcts_pick_action") as mcts,
            mock.patch.object(guandan, "_minimax_pick_action") as minimax,
        ):
            action = guandan.GuandanGame.bot_move(state, pid, lambda stage, *_args: stages.append(stage))
        self.assertEqual(action, {"type": "pass"})
        mcts.assert_not_called()
        minimax.assert_not_called()
        self.assertNotIn("mcts", stages)
        explain = state["bot_explain"][pid]
        self.assertEqual(explain["method"], "heuristic")
        self.assertEqual(explain["method_details"]["heuristic_search_gate"]["reason"], "clear_heuristic_margin")

    def test_auto_mcts_gate_uses_the_actual_legalized_incumbent(self):
        state, cards = self._state()
        state["config"].update(bot_mode="auto", bot_endgame_threshold=0)
        pid = state["current_turn"]

        def baseline(current, _pid, _depth, **_kwargs):
            self._panel(current, [(None, 30.0, {}), (cards, 0.0, {})])
            return {"type": "play", "card_ids": cards}

        with (
            mock.patch.object(guandan, "_heuristic_best_action", side_effect=baseline),
            mock.patch.object(guandan, "_mcts_pick_action", return_value=(None, [])) as mcts,
        ):
            guandan.GuandanGame.bot_move(state, pid)
        mcts.assert_called_once()
        self.assertEqual(state["bot_explain"][pid]["method_details"]["heuristic_search_gate"]["reason"],
                         "incumbent_changed")


if __name__ == "__main__":
    unittest.main()
