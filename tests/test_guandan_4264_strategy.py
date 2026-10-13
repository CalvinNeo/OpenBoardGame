import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import FIXTURES, pick_card_ids, replay_fixture


class Guandan4264StrategyTests(unittest.TestCase):
    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    def action(self, state, labels):
        actor = state["current_turn"]
        return {"type": "play", "card_ids": pick_card_ids(state["players"][actor]["hand"], labels)}

    def test_saved_round_replays_without_future_public_information(self):
        self.assertEqual(len(FIXTURES["426"]["actions"]), 76)
        state = replay_fixture("426", 77)
        self.assertEqual(state["finish_order"], ["z", "calvin", "bot2", "bot4"])
        for step in (6, 42, 52, 54, 64):
            state = replay_fixture("426", step)
            self.assertEqual(len(state["seen_cards"]),
                             sum(len(labels) for _pid, labels in FIXTURES["426"]["actions"][:step - 1]))

    def test_lead_scores_are_invariant_under_hidden_redistribution(self):
        for step, labels in ((6, ("♠️5",)), (52, ("♠️3", "♣️3"))):
            state = replay_fixture("426", step)
            actor = state["current_turn"]
            cards = self.action(state, labels)["card_ids"]
            public = guandan.GuandanGame.get_public_view(state, actor)
            expected = guandan._bot_score_components(state, actor, cards, 2)
            for seed in (7, 19):
                changed = copy.deepcopy(state)
                owners = changed["known_card_owners"]
                targets = [pid for pid in state["turn_order"] if pid != actor]
                pool = [card for pid in targets for card in state["players"][pid]["hand"]
                        if card["id"] not in owners]
                random.Random(seed).shuffle(pool)
                for pid in targets:
                    hand = changed["players"][pid]["hand"]
                    locked = [card for card in hand if card["id"] in owners]
                    count = len(hand) - len(locked)
                    changed["players"][pid]["hand"] = locked + pool[:count]
                    pool = pool[count:]
                changed["_ai_eval_cache"] = {}
                with self.subTest(step=step, seed=seed):
                    self.assertEqual(guandan.GuandanGame.get_public_view(changed, actor), public)
                    self.assertEqual(guandan._bot_score_components(changed, actor, cards, 2), expected)

    def test_tiny_gain_cannot_spend_high_pair_but_consistent_large_gain_can(self):
        state = replay_fixture("426", 64)
        reference = self.action(state, ("♠️4", "♥️4"))
        proposal = self.action(state, ("♥️J", "♣️J"))
        for gain, accepted in ((1.014, False), (200.0, True)):
            status = {"completed_depth": 5, "root_values": [
                {"action": reference, "world_values": [-100.0] * 3},
                {"action": proposal, "world_values": [-100.0 + gain] * 3},
            ]}
            self.assertEqual(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status), accepted)
            self.assertIn("same_type_control", state["_ai_eval_cache"]["minimax_override"]["plan_risks"])

    def test_cutoff_after_pair_takeover_sees_forced_double_down(self):
        # After JJ -> 22, the three compulsory passes must not hide the
        # enemy's big joker and final triple behind a static cutoff score.
        state = replay_fixture("426", 66)
        state["_ai_sampled_world"] = True
        value = self.call("_minimax_value", state, "bot2", 2, -1e9, 1e9, 16)
        self.assertEqual(value, -300.0)
        self.assertEqual(state["current_turn"], "bot4")
        self.assertEqual(len(state["players"]["z"]["hand"]), 4)

    def test_mcts_also_requires_paired_evidence_to_spend_the_high_pair(self):
        state = replay_fixture("426", 64)
        reference = self.action(state, ("♠️4", "♥️4"))
        proposal = self.action(state, ("♥️J", "♣️J"))
        for gain, accepted in ((1.014, False), (200.0, True)):
            scores = [(reference, 0.0, 3, {"paired_reference": True}),
                      (proposal, gain, 3, {"paired_count": 3, "paired_lcb": gain})]
            with mock.patch.object(guandan_ai, "_mcts_root_heuristic_value", return_value=0.0):
                self.assertEqual(self.call("_should_accept_mcts_override", state, "bot2", reference,
                                           proposal, 2, search_scores=scores), accepted)

    def test_cutoff_extends_short_hand_lead_and_deadline_still_stops_it(self):
        state = replay_fixture("426", 73)
        state["_ai_sampled_world"] = True
        self.assertIsNone(state["current_trick"])
        self.assertEqual(self.call("_minimax_value", state, "bot2", 0, -1e9, 1e9, 8), -300.0)
        with mock.patch.object(guandan_ai.time, "perf_counter", return_value=2.0), mock.patch.object(
            guandan_ai, "_evaluate_state_for_bot", return_value=-17.0,
        ), mock.patch.object(guandan, "_candidate_actions", side_effect=AssertionError("expired search")):
            self.assertEqual(self.call("_minimax_value", state, "bot2", 0, -1e9, 1e9, 8, deadline=1.0), -17.0)

    def test_rare_overbomb_is_checked_without_adding_probability_samples(self):
        state = replay_fixture("426", 54)
        actor = state["current_turn"]
        action = self.action(state, ("♦️10", "♥️10", "♣️10", "♥️2"))
        combo = self.call("_action_combo", state, actor, action)
        remaining = guandan._remove_cards(state["players"][actor]["hand"], action["card_ids"])
        self.assertTrue(self.call("_bomb_closeout_stress_risk", state, actor, combo, remaining))
        components = guandan._bot_score_components(state, actor, action["card_ids"], 2)
        self.assertLess(components["overbomb_closeout_stress"], 0)
        self.assertGreaterEqual(components["overbomb_closeout_stress"], -6.0)
        self.assertNotIn("mcts_anytime", state["_ai_eval_cache"])
        # A strongest final card has its own route back to control. Merely
        # finding a possible counterbomb must not trigger a blanket ban.
        big = next(card for card in guandan._full_deck() if card.get("joker") == "big")
        self.assertFalse(self.call("_bomb_closeout_stress_risk", state, actor, combo, [big]))


if __name__ == "__main__":
    unittest.main()
