import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import FIXTURES, pick_card_ids, replay_fixture


class GuandanCloseoutRecoveryTests(unittest.TestCase):
    def call(self, name, state, *args):
        return guandan_ai.call(guandan, name, state, state["current_turn"], *args)

    def cards(self, state, labels):
        return pick_card_ids(state["players"][state["current_turn"]]["hand"], labels)

    def combo(self, state, cards):
        return self.call("_action_combo", state, {"type": "play", "card_ids": cards})

    def make_lead(self, own, enemy):
        state = replay_fixture("fd4", 53)
        deck = guandan._full_deck()
        for player_id, labels in (("bot4", own), ("calvin", enemy), ("bot2", ("🃏S", "🃏B"))):
            selected = set(pick_card_ids(deck, labels))
            state["players"][player_id]["hand"] = [card for card in deck if card["id"] in selected]
            deck = [card for card in deck if card["id"] not in selected]
        state.update(seen_cards=[card["id"] for card in deck], round_memories=[],
                     known_card_owners={}, pass_limits={})
        return state

    def test_saved_round_replays_to_recorded_finish(self):
        state = replay_fixture("fd4", len(FIXTURES["fd4"]["actions"]) + 1)
        self.assertEqual(state["finish_order"], ["z", "calvin", "bot2", "bot4"])

    def test_large_hand_counterbomb_keeps_straight_flush_through_candidates(self):
        for step in (30, 41):
            with self.subTest(step=step):
                state = replay_fixture("fd4", step)
                expected = self.cards(state, ("♦️3", "♦️4", "♦️5", "♦️6", "♥️2"))
                frontier = self.call("_bomb_response_frontier", state)
                self.assertIn(set(expected), [set(cards) for cards in frontier])
                self.assertEqual({self.combo(state, cards)["type"] for cards in frontier},
                                 {"bomb", "straight_flush"})
                actions = guandan._candidate_actions(state, state["current_turn"], 8)
                self.assertIn(set(expected), [set(action.get("card_ids", [])) for action in actions])
                for cards in frontier:
                    _, error = guandan.GuandanGame.apply_action(
                        copy.deepcopy(state), state["current_turn"], {"type": "play", "card_ids": cards})
                    self.assertIsNone(error)

    def test_counterbomb_reserves_control_slot_among_natural_alternatives(self):
        state = replay_fixture("fd4", 41)
        faces = ("♠️8", "♥️8", "♣️8", "♥️2", "♠️9", "♥️9", "♣️9", "♦️9",
                 "♠️10", "♥️10", "♣️10", "♦️10", "♦️3", "♦️4", "♦️5", "♦️6", "♣️A")
        deck = guandan._full_deck()
        selected = set(pick_card_ids(deck, faces))
        state["players"]["bot4"]["hand"] = [card for card in deck if card["id"] in selected]
        frontier = self.call("_bomb_response_frontier", state, 3)
        self.assertEqual(len(frontier), 3)
        self.assertTrue(self.combo(state, frontier[0])["uses_wild"])
        self.assertFalse(self.combo(state, frontier[1])["uses_wild"])
        self.assertEqual(self.combo(state, frontier[2])["type"], "straight_flush")

    def test_counterbomb_frontier_obeys_width_and_legality(self):
        for step in (30, 41, 50):
            for limit in (1, 2, 3):
                with self.subTest(step=step, limit=limit):
                    state = replay_fixture("fd4", step)
                    frontier = self.call("_bomb_response_frontier", state, limit)
                    self.assertLessEqual(len(frontier), limit)
                    self.assertEqual(len(frontier), len({tuple(sorted(cards)) for cards in frontier}))
                    for cards in frontier:
                        self.assertTrue(guandan._compare_combos(
                            state["current_trick"]["combo"], self.combo(state, cards),
                            state["level_rank"], state["config"]))

    def test_saved_lead_prices_unrecoverable_reply_above_pair_probe(self):
        state = replay_fixture("fd4", 53)
        full_house = self.cards(state, ("♠️Q", "♣️Q", "♦️Q", "♠️3", "♥️3"))
        pair = self.cards(state, ("♠️3", "♥️3"))
        unsafe = self.call("_bot_score_components", state, full_house, 2)
        safe = self.call("_bot_score_components", state, pair, 2)
        self.assertLess(unsafe["lead_closeout_reply"], -5.0)
        self.assertNotIn("lead_closeout_reply", safe)
        self.assertGreater(safe["total"], unsafe["total"])

    def test_reply_penalty_uses_public_information_only(self):
        state = replay_fixture("fd4", 53)
        cards = self.cards(state, ("♠️Q", "♣️Q", "♦️Q", "♠️3", "♥️3"))
        expected = self.call("_lead_closeout_reply_penalty", state, cards, self.combo(state, cards))
        public = guandan.GuandanGame.get_public_view(state, "bot4")
        unknown = state["players"]["calvin"]["hand"] + state["players"]["bot2"]["hand"]
        for seed in (0, 7, 19):
            changed = copy.deepcopy(state)
            shuffled = random.Random(seed).sample(unknown, len(unknown))
            changed["players"]["calvin"]["hand"] = shuffled[:7]
            changed["players"]["bot2"]["hand"] = shuffled[7:]
            self.assertEqual(guandan.GuandanGame.get_public_view(changed, "bot4"), public)
            self.assertEqual(self.call("_lead_closeout_reply_penalty", changed, cards,
                                       self.combo(changed, cards)), expected)

    def test_same_lane_control_does_not_remove_immediate_finish_penalty(self):
        own = ("♠️Q", "♥️Q", "♣️Q", "♠️3", "♥️3", "♠️A", "♥️A", "♣️A", "♠️4", "♥️4")
        enemy = ("♠️K", "♥️K", "♣️K", "♠️6", "♥️6", "♠️8", "♥️8")
        for tail_count in (0, 2):
            with self.subTest(tail_count=tail_count):
                state = self.make_lead(own, enemy[:5 + tail_count])
                cards = self.cards(state, own[:5])
                penalty = self.call("_lead_closeout_reply_penalty", state, cards, self.combo(state, cards))
                if tail_count:
                    self.assertEqual(penalty, 0.0)
                else:
                    self.assertGreater(self.call("_lead_short_escape_window_penalty", state, cards,
                                                 self.combo(state, cards)), 0.0)

    def test_reply_penalty_is_reserved_for_preventing_enemy_one_two_finish(self):
        state = replay_fixture("fd4", 53)
        state["finish_order"] = []
        cards = self.cards(state, ("♠️Q", "♣️Q", "♦️Q", "♠️3", "♥️3"))
        self.assertEqual(self.call("_lead_closeout_reply_penalty", state, cards,
                                   self.combo(state, cards)), 0.0)

    def test_no_penalty_for_unbeatable_lead_or_playing_entire_hand(self):
        own = ("♠️A", "♥️A", "♣️A", "♠️3", "♥️3", "♠️4", "♥️4")
        enemy = ("♠️K", "♥️K", "♣️K", "♠️6", "♥️6", "♠️8", "♥️8")
        for hand in (own, own[:5]):
            state = self.make_lead(hand, enemy)
            cards = self.cards(state, own[:5])
            self.assertEqual(self.call("_lead_closeout_reply_penalty", state, cards,
                                       self.combo(state, cards)), 0.0)

    def test_critical_lead_search_keeps_bounded_different_lanes(self):
        state = replay_fixture("fd4", 53)
        self.assertTrue(guandan._should_use_mcts(state, "bot4", 5))
        actions = guandan._candidate_actions(state, "bot4", 10)
        finalists = self.call("_mcts_root_candidate_subset", state, actions, 5)
        self.assertLessEqual(len(finalists), 3)
        self.assertGreaterEqual(len({self.combo(state, action["card_ids"])["type"]
                                    for action in finalists}), 2)
        state["finish_order"] = []
        self.assertFalse(guandan._should_use_mcts(state, "bot4", 5))

    def test_saved_lead_runs_search_and_keeps_pair_reentry(self):
        state = replay_fixture("fd4", 53)
        with mock.patch.object(guandan_ai.random, "Random", return_value=random.Random(7)):
            action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(self.combo(state, action["card_ids"])["type"], "pair")
        remaining = guandan._remove_cards(state["players"]["bot4"]["hand"], action["card_ids"])
        self.assertEqual(sum(card.get("rank") == 14 for card in remaining), 2)
        explain = state["bot_explain"]["bot4"]
        self.assertIn("mcts", explain["timing"]["stages_ms"])
        self.assertEqual(explain["method_details"]["mcts_gate"]["reason"], "enemy_closeout_lead")

    def test_search_needs_supported_gain_to_abandon_reentry(self):
        for lower_gain, samples, expected in ((2.0, 3, False), (30.0, 1, False), (30.0, 3, True)):
            with self.subTest(lower_gain=lower_gain, samples=samples):
                state = replay_fixture("fd4", 53)
                reference = {"type": "play", "card_ids": self.cards(state, ("♠️3", "♥️3"))}
                proposal = {"type": "play", "card_ids": self.cards(
                    state, ("♠️Q", "♣️Q", "♦️Q", "♠️3", "♥️3"))}
                state["_ai_eval_cache"] = {"mcts_anytime": {"completed_depth": 2}}
                scores = [(reference, 0.0, samples, {"paired_reference": 1.0}),
                          (proposal, 1.0, samples, {"paired_lcb": lower_gain, "paired_count": samples})]
                self.assertEqual(guandan._should_accept_mcts_override(
                    state, "bot4", reference, proposal, 2, search_scores=scores), expected)
                self.assertIn("closeout_reentry", self.call("_minimax_plan_risks", state, reference, proposal))

    def test_finished_enemy_has_no_urgent_bomb_takeover_bonus(self):
        state = replay_fixture("fd4", 41)
        state["players"]["calvin"]["finished"] = True
        for cards in self.call("_bomb_response_frontier", state):
            remaining = guandan._remove_cards(state["players"]["bot4"]["hand"], cards)
            self.assertEqual(self.call("_short_enemy_bomb_takeover_bonus", state, cards,
                                       self.combo(state, cards), remaining), 0.0)

    def legacy_finished_leader_state(self):
        """Old saves could await replies after the second teammate finished."""
        state = replay_fixture("fd4", 57)
        leader = "calvin"
        cards = list(state["players"][leader]["hand"])
        state["current_trick"] = {
            "player_id": leader, "cards": [card["id"] for card in cards],
            "combo": guandan._evaluate_combo(cards, state["level_rank"], state["config"]),
        }
        state["seen_cards"].extend(card["id"] for card in cards)
        state["players"][leader]["hand"] = []
        guandan._finish_player(state, leader)
        state.update(current_turn="bot2", trick_plays={leader: cards}, round_memories=[])
        return state

    def test_finished_leader_has_no_closeout_rewards_or_pass_penalties(self):
        forbidden = {"deny_enemy_double_down", "deny_short_lead", "block_closeout",
                     "pass_enemy_double_down_threat", "pass_closeout_threat", "pass_short_enemy_prior"}
        for marker in ("all", "empty_hand", "finish_order", "finished"):
            with self.subTest(marker=marker):
                state = self.legacy_finished_leader_state()
                if marker == "empty_hand":
                    state["players"]["calvin"].update(finished=False, finish_rank=None)
                    state["finish_order"] = ["z"]
                elif marker in ("finish_order", "finished"):
                    state["players"]["calvin"]["hand"] = [{"id": -1, "suit": "spades", "rank": 3}]
                    if marker == "finish_order":
                        state["players"]["calvin"]["finished"] = False
                    else:
                        state["finish_order"] = ["z"]
                cards = [card["id"] for card in state["players"]["bot2"]["hand"]
                         if card.get("rank") == 12][:2]
                for option in (None, cards):
                    components = self.call("_bot_score_components", state, option, 2)
                    self.assertFalse(forbidden.intersection(components))

    def test_live_enemy_closeout_pressure_remains(self):
        state = self.legacy_finished_leader_state()
        state["players"]["calvin"].update(
            hand=[{"id": -1, "suit": "spades", "rank": 3}], finished=False, finish_rank=None)
        state["finish_order"] = ["z"]
        cards = [card["id"] for card in state["players"]["bot2"]["hand"]
                 if card.get("rank") == 12][:2]
        self.assertGreater(self.call("_enemy_double_down_closeout_pressure", state), 0.0)
        self.assertGreater(self.call("_opponent_one_card_closeout_bonus", state, cards,
                                    self.combo(state, cards)), 0.0)


if __name__ == "__main__":
    unittest.main()
