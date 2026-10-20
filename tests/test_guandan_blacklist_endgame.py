import unittest
from unittest import mock

from game import guandan, guandan_ai, guandan_endgame, guandan_trick
from tests import test_guandan_endgame as endgame_fixtures
from tests import test_guandan_public_runout as runout_fixtures


class GuandanBlacklistEndgameTests(unittest.TestCase):
    def setUp(self):
        fixture = endgame_fixtures.GuandanPublicExactTests()
        fixture.setUp()
        self.state = fixture.state
        self.reference = fixture.reference
        self.proposal = fixture.proposal
        self.state["config"]["bot_blacklist_separate_value"] = True

    def sampled_panel(self, reference_cost=0.0, proposal_cost=0.0,
                      selection=(200.0,) * 4, confirmation=(200.0,) * 4):
        reference, proposal = self.reference, self.proposal
        phases = []

        def worlds(_state, _observer, count, _budget, phase):
            phases.append(phase)
            return [{"phase": phase, "index": index} for index in range(count)]

        class FakeSolver:
            nodes = 1
            hits = 0

            def __init__(self, _rules, world, _observer, _deadline, _node_limit):
                self.world = world

            def root_actions(self):
                return [reference, proposal]

            def root_values(self, actions):
                panel = selection if self.world["phase"] == "exact_selection" else confirmation
                return [panel[self.world["index"]] if action == proposal else 100.0
                        for action in actions]

        costs = {
            guandan_ai._action_identity(action): {
                "penalty": cost * 10.0, "score_penalty": cost, "scale": 0.1,
            }
            for action, cost in ((reference, reference_cost), (proposal, proposal_cost))
        }
        with (
            mock.patch.object(guandan_trick, "public_worlds", side_effect=worlds),
            mock.patch.object(guandan_endgame, "_world_key",
                              side_effect=lambda world: (world["phase"], world["index"])),
            mock.patch.object(guandan_endgame, "EndgameSolver", FakeSolver),
            mock.patch.object(guandan_ai, "_blacklist_search_costs", return_value=costs),
        ):
            result = guandan_endgame.compare_actions(guandan, self.state, "bot", reference)
        self.assertEqual(result["scope"], "public_sampled_endgame")
        self.assertEqual(result["blacklist_policy"]["status"], "applied")
        return result, phases

    def test_sampled_policy_is_finite_and_leaves_terminal_samples_unchanged(self):
        for penalty, expected in ((120.0, self.reference), (50.0, self.proposal)):
            with self.subTest(penalty=penalty):
                panel, phases = self.sampled_panel(proposal_cost=penalty)
                self.assertEqual(panel["selected"], expected)
                challenger = panel["candidates"][1]
                self.assertEqual(challenger["value"], 200.0)
                self.assertEqual(challenger["world_values"], [200.0] * 4)
                self.assertEqual(challenger["decision_value"], 200.0 - penalty)
                self.assertEqual(len(phases), 1 if expected == self.reference else 2)

    def test_all_roots_can_have_policy_costs_without_preventing_selection(self):
        panel, _ = self.sampled_panel(reference_cost=50.0, proposal_cost=80.0)
        self.assertEqual(panel["selected"], self.proposal)
        self.assertEqual(panel["paired_gain"], 100.0)
        self.assertEqual(panel["decision_paired_gain"], 70.0)
        self.assertTrue(panel["verification"]["passed"])

    def test_cheaper_policy_cannot_manufacture_value_confidence(self):
        panel, phases = self.sampled_panel(reference_cost=50.0, selection=(100.0,) * 4)
        self.assertEqual(panel["proposed"], self.proposal)
        self.assertEqual(panel["paired_gain_lower"], 0.0)
        self.assertEqual(panel["decision_paired_gain_lower"], 50.0)
        self.assertEqual(panel["selected"], self.reference)
        self.assertEqual(phases, ["exact_selection"])

    def test_confirmation_requires_support_after_policy_cost_too(self):
        panel, phases = self.sampled_panel(proposal_cost=50.0,
                                          confirmation=(100.0, 200.0, 200.0, 300.0))
        verification = panel["verification"]
        self.assertEqual(phases, ["exact_selection", "exact_confirmation"])
        self.assertGreater(verification["paired_gain_lower"], 0.0)
        self.assertLess(verification["decision_paired_gain_lower"], 0.0)
        self.assertFalse(verification["passed"])
        self.assertEqual(panel["selected"], self.reference)
        self.assertEqual(verification["candidates"][1]["world_values"], [100.0, 200.0, 200.0, 300.0])

    def assert_proof_exemption(self, state, reference, scope):
        baseline = guandan_endgame.compare_actions(guandan, state, "bot", reference)
        state["config"]["bot_blacklist_separate_value"] = True
        options = guandan._list_hint_options(state, "bot")
        for name in ("response_soft_penalties", "overbomb_soft_penalties"):
            state.setdefault("_ai_eval_cache", {})[name] = {
                ("bot", guandan._cards_key(cards)): 5000.0 for cards in options
            }
        with mock.patch.object(guandan_ai, "_blacklist_search_costs",
                               side_effect=AssertionError("public proof needs no policy conversion")):
            panel = guandan_endgame.compare_actions(guandan, state, "bot", reference)
        self.assertEqual(panel["scope"], scope)
        self.assertEqual(panel["selected"], baseline["selected"])
        self.assertEqual(panel["candidates"], baseline["candidates"])
        self.assertEqual(panel["blacklist_policy"]["status"], "exempt")
        self.assertEqual(set(panel["blacklist_policy"]["rules"]),
                         {"response_material_prior", "overbomb_prior"})

    def test_public_exact_proof_explicitly_waives_resource_priors(self):
        state = endgame_fixtures.GuandanPublicProofTests().duel()
        reference = {"type": "play", "card_ids": [card["id"] for card in
                     state["players"]["bot"]["hand"] if card["rank"] == 3]}
        self.assert_proof_exemption(state, reference, "public_determined_endgame")

    def test_common_public_runout_proof_explicitly_waives_resource_priors(self):
        state = runout_fixtures.GuandanPublicRunoutTests().state()
        self.assert_proof_exemption(state, {"type": "pass"}, "proven_public_runout")


if __name__ == "__main__":
    unittest.main()
