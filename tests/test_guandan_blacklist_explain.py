import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests import test_guandan_response_priors as fixtures


class GuandanBlacklistExplainTests(unittest.TestCase):
    def fixture(self):
        state = fixtures.GuandanResponsePriorTests().fixture((7, 9, 9, 11))
        state["config"]["bot_blacklist_separate_value"] = True
        cards = [state["players"]["p0"]["hand"][0]["id"]]
        state["_ai_eval_cache"] = {
            "response_soft_penalties": {("p0", guandan._cards_key(cards)): 10.0},
        }
        return state, cards

    def explain(self, state, cards, method, scores=None):
        return guandan_ai.call(guandan, "_build_bot_explain", state, "p0", cards,
                               method, 1, method_scores=scores)

    def test_heuristic_explains_value_penalty_and_net_without_rescoring(self):
        state, cards = self.fixture()
        guandan_ai.call(guandan, "_store_heuristic_scored_candidates", state, "p0", 1, [
            (cards, 20.0, {"test_value": 30.0, "soft_candidate_prior": -10.0, "total": 20.0}),
            (None, 15.0, {"test_value": 15.0, "total": 15.0}),
        ])
        with mock.patch.object(guandan_ai, "_bot_score_components", side_effect=AssertionError("rescore")):
            result = self.explain(state, cards, "heuristic")
        detail = result["chosen"]["blacklist"]
        self.assertEqual((detail["value_score"], detail["penalty"], detail["decision_score"]),
                         (30.0, 10.0, 20.0))
        self.assertEqual(detail["rules"][0]["id"], "response_material_prior")
        self.assertEqual(detail["decision_margin_vs_shown_alternatives"], 5.0)
        self.assertTrue(all(isinstance(value, (int, float))
                            for value in result["chosen"]["components"].values()))

    def test_mcts_explains_converted_cost_without_changing_raw_samples(self):
        state, cards = self.fixture()
        action = {"type": "play", "card_ids": cards}
        stats = {"avg": 100.0, "value_adjusted": 99.0, "adjusted": 98.0,
                 "blacklist_penalty": 10.0, "blacklist_score_penalty": 1.0}
        with mock.patch.object(guandan_ai, "_bot_score_components", side_effect=AssertionError("rescore")):
            result = self.explain(state, cards, "mcts", [(action, 98.0, 4, stats)])
        detail = result["chosen"]["blacklist"]
        self.assertEqual((detail["value_score"], detail["penalty"], detail["decision_score"]),
                         (99.0, 1.0, 98.0))
        self.assertEqual(detail["heuristic_penalty"], 10.0)
        self.assertEqual(result["chosen"]["components"]["mcts_avg"], 100.0)

    def test_quick_only_checkpoint_does_not_invent_an_unpenalized_value(self):
        state, cards = self.fixture()
        guandan_ai.call(guandan, "_store_heuristic_scored_candidates", state, "p0", 1, [
            (cards, 20.0, {"anytime_quick_score": 20.0, "total": 20.0}),
        ])
        with mock.patch.object(guandan_ai, "_bot_score_components", side_effect=AssertionError("rescore")):
            detail = self.explain(state, cards, "heuristic")["chosen"]["blacklist"]
        self.assertIsNone(detail["value_score"])
        self.assertIsNone(detail["penalty"])
        self.assertEqual(detail["decision_score"], 20.0)
        self.assertEqual(detail["scope"], "quick_decision_only")

    def test_public_proof_reports_waived_cost_without_reducing_terminal_value(self):
        state, cards = self.fixture()
        state["_ai_eval_cache"]["exact_endgame"] = {
            "scope": "public_determined_endgame",
            "blacklist_policy": {"status": "exempt", "reason": "public_hands_determined"},
            "candidates": [{"action": {"type": "play", "card_ids": cards}, "value": 100.0}],
        }
        result = self.explain(state, cards, "exact_endgame")
        detail = result["chosen"]["blacklist"]
        self.assertEqual((detail["value_score"], detail["penalty"], detail["decision_score"]),
                         (100.0, 0.0, 100.0))
        self.assertEqual(detail["rules"][0]["penalty"], 0.0)
        self.assertEqual(detail["rules"][0]["waived_penalty"], 10.0)

    def test_sampled_relay_exemption_does_not_report_an_uncharged_rule(self):
        state, cards = self.fixture()
        state["_ai_eval_cache"]["exact_endgame"] = {
            "scope": "public_sampled_endgame",
            "blacklist_policy": {"status": "applied"},
            "candidates": [{"action": {"type": "play", "card_ids": cards}, "value": 100.0,
                            "decision_value": 100.0, "blacklist_penalty": 0.0,
                            "blacklist_score_penalty": 0.0}],
        }
        result = self.explain(state, cards, "exact_endgame")
        self.assertEqual(result["chosen"]["blacklist"]["rules"], [])


if __name__ == "__main__":
    unittest.main()
