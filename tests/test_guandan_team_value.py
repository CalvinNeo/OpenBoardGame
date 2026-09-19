import copy
import itertools
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanTeamValueTests(unittest.TestCase):
    def setUp(self):
        players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat} for seat in range(4)]
        self.state = guandan.GuandanGame.init_game({}, players)

    def test_every_finished_round_uses_zero_sum_team_upgrade_value(self):
        for order in itertools.permutations(self.state["turn_order"]):
            state = copy.deepcopy(self.state)
            state.update(phase="round_end", finish_order=list(order))
            for rank, pid in enumerate(order, 1):
                state["players"][pid].update(finished=True, finish_rank=rank)
                if rank != 4:
                    state["players"][pid]["hand"] = []
            winning_team = state["player_teams"][order[0]]
            partner_rank = next(rank for rank, pid in enumerate(order[1:], 2)
                                if state["player_teams"][pid] == winning_team)
            points = 5 - partner_rank
            with self.subTest(order=order), mock.patch.object(
                guandan_ai, "_hand_state_value_components", side_effect=AssertionError("terminal heuristic")
            ):
                values = {pid: guandan._evaluate_state_for_bot(state, pid) for pid in state["turn_order"]}
            self.assertEqual(values["p0"], values["p2"])
            self.assertEqual(values["p1"], values["p3"])
            self.assertEqual(values["p0"], -values["p1"])
            self.assertEqual(values[order[0]], points * 100)

    def test_predicted_order_uses_zero_sum_upgrade_objective_for_both_evaluators(self):
        for order in itertools.permutations(self.state["turn_order"]):
            winning_team = self.state["player_teams"][order[0]]
            partner_rank = next(rank for rank, pid in enumerate(order[1:], 2)
                                if self.state["player_teams"][pid] == winning_team)
            points = 5 - partner_rank
            with self.subTest(order=order), mock.patch.object(
                guandan_ai, "_predict_finish_order", return_value=list(order),
            ), mock.patch.object(guandan_ai, "_estimated_turns_to_finish", return_value=3.0):
                values = {}
                for pid in self.state["turn_order"]:
                    hand = self.state["players"][pid]["hand"]
                    value = guandan._team_finish_score(self.state, pid, len(hand), bot_hand=hand)
                    overridden = guandan_ai.call(
                        guandan, "_team_finish_score_with_turn_override", self.state, pid, len(hand), 2.0,
                    )
                    sign = 1 if self.state["player_teams"][pid] == winning_team else -1
                    self.assertEqual(value, sign * points * 3)
                    self.assertEqual(overridden, value)
                    values[pid] = value
                self.assertEqual(values["p0"], values["p2"])
                self.assertEqual(values["p1"], values["p3"])
                self.assertEqual(values["p0"], -values["p1"])

    def test_double_finish_is_settled_before_round_end(self):
        state = self.state
        state["finish_order"] = ["p1", "p3"]
        self.assertEqual(guandan._evaluate_state_for_bot(state, "p0"), -300)
        self.assertEqual(guandan._evaluate_state_for_bot(state, "p1"), 300)

    def test_third_finish_implies_last_place_without_mutating_state(self):
        state = self.state
        state["finish_order"] = ["p0", "p1", "p3"]
        before = copy.deepcopy(state)
        self.assertEqual(guandan._evaluate_state_for_bot(state, "p0"), 100)
        self.assertEqual(state, before)

    def test_unsettled_places_keep_searching(self):
        for order in ([], ["p0"], ["p0", "p1"]):
            self.state["finish_order"] = order
            value = guandan_ai.call(guandan, "_settled_round_value", self.state, "p0")
            self.assertIsNone(value)

    def test_match_victory_still_takes_priority(self):
        self.state.update(game_over=True, winner_team="B", finish_order=["p1", "p0", "p2", "p3"])
        self.assertEqual(guandan._evaluate_state_for_bot(self.state, "p3"), 1000)
        self.assertEqual(guandan._evaluate_state_for_bot(self.state, "p2"), -1000)

    def test_settled_value_matches_engine_before_and_after_round_settlement(self):
        for order in itertools.permutations(self.state["turn_order"]):
            for level in (2, 10, 11, 12, 13, 14):
                for require_partner in (False, True):
                    state = copy.deepcopy(self.state)
                    state["config"]["require_partner_not_last_for_a"] = require_partner
                    for team in state["teams"].values():
                        team["level"] = level
                    # First two places suffice for a double finish; other team
                    # results require the third place to infer the fourth.
                    count = 2 if state["player_teams"][order[0]] == state["player_teams"][order[1]] else 3
                    state.update(phase="playing", finish_order=list(order[:count]))
                    for rank, pid in enumerate(order[:count], 1):
                        state["players"][pid].update(hand=[], finished=True, finish_rank=rank)
                    before = copy.deepcopy(state)
                    early = guandan._evaluate_state_for_bot(state, "p0")
                    self.assertEqual(state, before)
                    guandan._advance_to_round_end(state)
                    with self.subTest(order=order, level=level, require_partner=require_partner):
                        self.assertEqual(early, guandan._evaluate_state_for_bot(state, "p0"))

    def test_search_stops_when_the_team_outcome_is_already_settled(self):
        self.state["finish_order"] = ["p0", "p2"]
        with mock.patch.object(guandan, "_candidate_actions", side_effect=AssertionError("unnecessary search")), \
             mock.patch.object(guandan_ai, "_rollout_policy_action", side_effect=AssertionError("unnecessary rollout")):
            self.assertEqual(guandan._minimax_value(self.state, "p0", 5, -1e9, 1e9, 4), 300)
            self.assertEqual(guandan._mcts_reply_tree_value(self.state, "p1", 3, 4, 5), -300)
            self.assertEqual(guandan._rollout_value(self.state, "p2", 10), 300)

    def test_fast_decomposition_consumes_each_physical_card_once(self):
        deck = guandan._full_deck()
        hands = []
        for counts in ((3, 3, 2), (3, 3, 3)):
            hands.append([card for offset, count in enumerate(counts)
                          for card in [card for card in deck if card.get("rank") == 3 + offset * 2][:count]])
        rng = random.Random(901)
        hands.extend(rng.sample(deck, size) for size in range(1, 28) for _ in range(4))
        for hand in hands:
            for level in (2, 7, 14):
                with self.subTest(hand=[card["id"] for card in hand], level=level):
                    summary = guandan_ai.call(guandan, "_fast_hand_decomposition_summary", hand, level)
                    self.assertEqual(summary["grouped_cards"] + summary["singles"], len(hand))
                    self.assertGreater(summary["turns"], 0)
                    self.assertLessEqual(summary["turns"], len(hand))
        summary = guandan_ai.call(guandan, "_fast_hand_decomposition_summary", hands[0], 2)
        self.assertEqual(summary["turns"], 2)


if __name__ == "__main__":
    unittest.main()
