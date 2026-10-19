import copy
import itertools
import time
import unittest
from unittest import mock

from game import guandan, guandan_endgame
from tests.test_guandan_endgame import legal_actions, reference_value
from tests.test_guandan_trick_boundary import make_state, play
from tests.test_guandan_trick_responses import CountOnlyHand


class GuandanPublicRunoutTests(unittest.TestCase):
    def state(self, enemy_rank=12):
        state = make_state({"bot": [2, 2, 2, 12], "opp": [3], "mate": [5], "opp2": [enemy_rank]})
        deck = guandan._full_deck()
        state["players"]["bot"]["hand"].extend(card for card in deck if card.get("joker") == "small")
        state["players"]["opp"].update(hand=[], finished=True, finish_rank=1)
        state.update(level_rank=7, dealer_team="A", finish_order=["opp"], current_turn="bot",
                     known_card_owners={}, pass_count=1, trick_plays={"mate": [], "opp2": "pass"})
        state["config"].update(bot_mode="auto", bot_exact_endgame_enabled=True,
                               bot_exact_endgame_public_only=True)
        held = {card["id"] for data in state["players"].values() for card in data["hand"]}
        queen = next(card for card in deck if card["rank"] == 12 and card["id"] not in held)
        state["current_trick"] = {"player_id": "mate", "cards": [queen["id"]],
                                  "combo": guandan._evaluate_combo([queen], 7, state["config"])}
        state["seen_cards"] = [card["id"] for card in deck if card["id"] not in held]
        state["round_memories"] = []
        state.pop("_ai_sampled_world", None)
        return state

    def panel(self, state, reference=None, deadline=None):
        return guandan_endgame.compare_actions(guandan, state, "bot", reference or {"type": "pass"}, deadline)

    def test_real_trace_joker_takeover_has_a_common_public_runout(self):
        state = self.state()
        before = copy.deepcopy(state)
        panel = self.panel(state)
        self.assertEqual(panel["scope"], "proven_public_runout")
        self.assertEqual(panel["reason"], "public_runout_proven")
        self.assertTrue(panel["applied"])
        self.assertTrue(panel["changed"])
        by_id = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        self.assertEqual([by_id[cid].get("joker") for cid in panel["selected"]["card_ids"]], ["small"])
        cover = panel["certificate"]["runout"]
        self.assertCountEqual([cid for group in cover for cid in group], by_id)
        self.assertEqual(state, before)

        # Execute the identical certificate in both feasible allocations.
        # Other players have no legal reply to any group, including the last.
        others = [state["players"][pid]["hand"][0] for pid in ("mate", "opp2")]
        for allocation in itertools.permutations(others):
            world = copy.deepcopy(state)
            for pid, card in zip(("mate", "opp2"), allocation):
                world["players"][pid]["hand"] = [card]
            for cards in cover:
                self.assertEqual(world["current_turn"], "bot")
                _, error = guandan.GuandanGame.apply_action(world, "bot", play(cards))
                self.assertIsNone(error)
                while world["phase"] == "playing" and world["current_trick"]:
                    self.assertEqual(legal_actions(world), [{"type": "pass"}])
                    _, error = guandan.GuandanGame.apply_action(world, world["current_turn"], {"type": "pass"})
                    self.assertIsNone(error)
            self.assertEqual(world["current_turn"], "mate")
            _, error = guandan.GuandanGame.apply_action(
                world, "mate", play([world["players"]["mate"]["hand"][0]["id"]]))
            self.assertIsNone(error)
            self.assertEqual(world["finish_order"], ["opp", "bot", "mate", "opp2"])
            self.assertEqual(reference_value(world, "bot", {}), -100.0)

    def test_reference_with_the_same_proof_is_retained(self):
        state = self.state()
        selected = self.panel(state)["selected"]
        panel = self.panel(state, selected)
        self.assertTrue(panel["applied"])
        self.assertFalse(panel["changed"])
        self.assertEqual(panel["selected"], selected)
        self.assertEqual(panel["reason"], "public_runout_reference")

    def test_hidden_faces_and_soft_pass_evidence_are_not_used(self):
        state = self.state()
        expected = self.panel(state)
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = CountOnlyHand([None] * len(state["players"][pid]["hand"]))
        state["pass_limits"] = {"mate": {"single": 1}, "opp2": {"single": 1}}
        actual = self.panel(state)
        for key in ("selected", "certificate", "candidates", "reason"):
            self.assertEqual(actual[key], expected[key])

    def test_unseen_higher_single_breaks_the_certificate(self):
        panel = self.panel(self.state(enemy_rank=13))
        self.assertFalse(panel["applied"])
        self.assertEqual(panel["reason"], "unresolved_hidden_ownership")

    def test_multi_card_other_hands_are_outside_the_proof(self):
        for pid, extra in (("mate", 1), ("opp2", 3), ("opp2", 4)):
            with self.subTest(pid=pid, extra=extra):
                state = self.state()
                held = {card["id"] for data in state["players"].values() for card in data["hand"]}
                added = [card for card in guandan._full_deck() if card["id"] not in held
                         and card["id"] not in state["current_trick"]["cards"]][:extra]
                state["players"][pid]["hand"].extend(added)
                state["seen_cards"] = [cid for cid in state["seen_cards"] if cid not in {c["id"] for c in added}]
                self.assertFalse(self.panel(state)["applied"])

    def test_incomplete_public_pool_cannot_prove_a_runout(self):
        state = self.state()
        state["seen_cards"].pop()
        self.assertFalse(self.panel(state)["applied"])

    def test_already_decided_match_is_not_assigned_a_round_loss_value(self):
        state = self.state()
        state["teams"]["B"]["level"] = 14
        state["dealer_team"] = "B"
        self.assertFalse(self.panel(state)["applied"])

    def test_timeout_does_not_publish_a_partial_certificate(self):
        state = self.state()
        panel = self.panel(state, deadline=time.perf_counter() - 1)
        self.assertEqual(panel["status"], "incomplete")
        self.assertEqual(panel["reason"], "deadline")
        self.assertFalse(panel["applied"])
        self.assertNotIn("selected", panel)
        self.assertEqual(panel["candidates"], [])

    def test_expiry_during_partition_construction_discards_partial_work(self):
        state = self.state()
        with mock.patch.object(guandan_endgame.time, "perf_counter", side_effect=[0.0, 0.0, 3.0, 3.0]):
            panel = self.panel(state)
        self.assertEqual(panel["status"], "incomplete")
        self.assertFalse(panel["applied"])
        self.assertEqual(panel["candidates"], [])

    def test_configured_exact_card_scope_is_respected(self):
        state = self.state()
        state["config"]["bot_exact_endgame_max_cards"] = 4
        self.assertFalse(self.panel(state)["applied"])

    def test_bot_uses_proof_before_the_clear_heuristic_margin_gate(self):
        state = self.state()
        with mock.patch.object(guandan, "_heuristic_best_action", return_value={"type": "pass"}), \
                mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("proved result")):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action["type"], "play")
        self.assertEqual(state["bot_explain"]["bot"]["method"], "exact_endgame")
        self.assertEqual(state["bot_explain"]["bot"]["score_model"], "proven_terminal")
        self.assertEqual(state["bot_explain"]["bot"]["chosen"]["score"], -100.0)
        self.assertEqual(state["bot_explain"]["bot"]["chosen"]["components"],
                         {"proven_terminal_team_value": -100.0})


if __name__ == "__main__":
    unittest.main()
