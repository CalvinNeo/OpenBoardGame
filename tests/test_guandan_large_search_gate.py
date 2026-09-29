import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import replay_fixture


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
        state = replay_fixture("38c", 5)
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

    def test_narrow_bomb_decision_still_enters_mcts_and_reports_stage(self):
        state = replay_fixture("38c", 53)
        stages = []
        with mock.patch.object(guandan, "_mcts_pick_action", return_value=(None, [])) as search:
            guandan.GuandanGame.bot_move(
                state, state["current_turn"],
                progress_callback=lambda stage, *_args: stages.append(stage))
        search.assert_called_once()
        self.assertIn("mcts", stages)


if __name__ == "__main__":
    unittest.main()
