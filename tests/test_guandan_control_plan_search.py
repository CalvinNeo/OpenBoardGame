import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import FIXTURES, pick_card_ids, replay_fixture


class GuandanControlPlanSearchTests(unittest.TestCase):
    def action(self, state, labels):
        return {"type": "play", "card_ids": pick_card_ids(state["players"]["bot2"]["hand"], labels)}

    def call(self, name, *args):
        return guandan_ai.call(guandan, name, *args)

    def status(self, reference, proposal, before, after):
        return {"completed_depth": 5, "root_values": [
            {"action": reference, "world_values": before},
            {"action": proposal, "world_values": after},
        ]}

    def test_saved_game_replays_to_recorded_finish(self):
        state = replay_fixture("964", len(FIXTURES["964"]["actions"]) + 1)
        self.assertEqual(state["finish_order"], ["z", "bot4", "bot2", "calvin"])

    def test_forced_actions_skip_scoring_determinization_and_search(self):
        for step in (63, 67, 71, 73, 75, 77, 79, 83, 85, 87, 89, 95):
            with self.subTest(step=step):
                state = replay_fixture("964", step)
                actor = state["current_turn"]
                with (
                    mock.patch.object(guandan, "_heuristic_best_action", side_effect=AssertionError("forced scoring")),
                    mock.patch.object(guandan, "_determinize_state", side_effect=AssertionError("forced sampling")),
                    mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("forced search")),
                ):
                    action = guandan.GuandanGame.bot_move(state, actor)
                _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), actor, action)
                self.assertIsNone(error)
                explain = state["bot_explain"][actor]
                self.assertTrue(explain["method_details"]["forced_action"])
                self.assertEqual(explain["score_model"], "none")
                self.assertIsNone(explain["chosen"]["score"])
                self.assertEqual(len(state["bot_explain_history"][actor]), 1)
                self.assertNotIn("_ai_eval_cache", state)

    def test_sampled_small_gain_cannot_spend_wild_control_reserve(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [20.0, 20.0, 20.0], [22.0, 19.0, 25.0])
        self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertIn("wild_control_reserve", decision["plan_risks"])
        self.assertEqual(decision["reason"], "preserve_control_plan")

    def test_consistent_large_search_gain_can_spend_wild(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [-100.0] * 3, [100.0] * 3)
        self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))
        self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["reason"], "supported_plan_change")

    def test_one_favorable_world_does_not_justify_breaking_control(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [-100.0], [100.0])
        self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))

    def test_wild_response_leaving_one_complete_group_is_allowed(self):
        state = replay_fixture("964", 65)
        hand = state["players"]["bot2"]["hand"]
        removed = [card for card in hand if card["rank"] == 14 or guandan._card_label(card) == "♣️2"]
        state["seen_cards"].extend(card["id"] for card in removed)
        state["players"]["bot2"]["hand"] = [card for card in hand if card not in removed]
        proposal = self.action(state, ("♠️J", "♥️2"))
        self.assertEqual(self.call("_minimax_plan_risks", state, "bot2", {"type": "pass"}, proposal), {})

    def test_short_enemy_takeover_is_not_abandoned_for_tiny_sample_gain(self):
        state = replay_fixture("964", 61)
        reference = self.action(state, ("♠️K", "♣️K", "♦️K", "♥️2"))
        proposal = {"type": "pass"}
        status = self.status(reference, proposal, [20.0] * 3, [22.0] * 3)
        self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))
        self.assertIn("keep_takeover", state["_ai_eval_cache"]["minimax_override"]["plan_risks"])

    def test_public_strong_group_protection_ignores_hidden_allocations(self):
        state = replay_fixture("964", 69)
        reference = self.action(state, ("♠️K", "♣️K", "♦️K"))
        proposal = self.action(state, ("♥️A",))
        expected = self.call("_minimax_plan_risks", state, "bot2", reference, proposal)
        self.assertIn("cash_unbeaten_group", expected)
        opponents = [pid for pid in state["turn_order"] if pid != "bot2"]
        cards = [card for pid in opponents for card in state["players"][pid]["hand"]]
        rng = random.Random(19)
        for _ in range(5):
            changed = copy.deepcopy(state)
            rng.shuffle(cards)
            offset = 0
            for actor in opponents:
                count = len(changed["players"][actor]["hand"])
                changed["players"][actor]["hand"] = cards[offset:offset + count]
                offset += count
            self.assertEqual(self.call("_minimax_plan_risks", changed, "bot2", reference, proposal), expected)

    def test_public_strong_group_is_not_an_unconditional_single_ban(self):
        state = replay_fixture("964", 69)
        reference = self.action(state, ("♠️K", "♣️K", "♦️K"))
        proposal = self.action(state, ("♥️A",))
        status = self.status(reference, proposal, [-100.0] * 3, [100.0] * 3)
        self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))

    def test_saved_strong_group_leads_before_vulnerable_single(self):
        state = replay_fixture("964", 69)
        rng = random.Random(7)
        with mock.patch.object(guandan_ai.random, "Random", return_value=rng):
            action = guandan.GuandanGame.bot_move(state, "bot2")
        hand = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
        self.assertCountEqual([guandan._card_label(hand[card_id]) for card_id in action["card_ids"]],
                              ["♠️K", "♣️K", "♦️K"])
        explain = state["bot_explain"]["bot2"]
        search = explain["search"]
        self.assertEqual(search["decision"]["reason"], "preserve_control_plan")
        self.assertGreater(search["completed_depth"], state["config"]["bot_minimax_depth"])
        self.assertEqual(sum(record["selected"] for record in search["candidates"]), 1)
        for record in search["candidates"]:
            self.assertEqual(record["samples"], 3)
            self.assertEqual(record["mean"], sum(record["world_values"]) / 3)
        self.assertAlmostEqual(explain["chosen"]["score"], sum(explain["chosen"]["components"].values()))

    def test_saved_level_two_response_keeps_the_wildcard_plan(self):
        state = replay_fixture("964", 65)
        with mock.patch.object(guandan_ai.random, "Random", return_value=random.Random(7)):
            action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(action, {"type": "pass"})
        explain = state["bot_explain"]["bot2"]
        self.assertEqual(explain["chosen"]["cards"], ["Pass"])
        self.assertEqual(explain["search"]["decision"]["reason"], "agreement")


if __name__ == "__main__":
    unittest.main()
