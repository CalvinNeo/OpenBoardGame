import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests import test_guandan_teammate_response_window as response_window
from tests.guandan_history_fixtures import replay_fixture


class CountOnlyHand(list):
    def __iter__(self):
        raise AssertionError("private teammate cards must not be read")


class GuandanTeammateIntentTests(unittest.TestCase):
    def call(self, name, state, *args):
        return guandan_ai.call(guandan, name, state, "bot", *args)

    def known_hand(self, labels, lead="♠️K"):
        state, pool = response_window.GuandanTeammateResponseWindowTests().make_state(
            lead=lead, pool_labels=labels, teammate_count=len(labels),
        )
        state["players"]["leader"]["hand"] = [{}] * 3
        state["players"]["other"]["hand"] = [{}] * 3
        state["known_card_owners"] = {card["id"]: "mate" for card in pool}
        return state

    def intent(self, state):
        return self.call("_teammate_response_intent_probability", state)

    def test_possession_is_not_willingness_when_reply_splits_bomb(self):
        expensive = self.known_hand(["♠️A", "♣️A", "♥️A", "♦️A", "♠️4", "♣️7", "♦️9"])
        loose = self.known_hand(["♠️A", "♠️4", "♣️7", "♦️9"])
        threshold = expensive["current_trick"]["combo"]["rank_value"]
        self.assertEqual(self.call("_teammate_single_response_probability", expensive, threshold), 1.0)
        self.assertGreater(self.intent(expensive), 0.0)
        self.assertLess(self.intent(expensive), 0.2)
        self.assertGreater(self.intent(loose), 0.8)

    def test_joker_pairs_and_wilds_cost_more_than_loose_control(self):
        cases = [
            ("🃏S", ["🃏B", "🃏B", "♠️4", "♣️7"], ["🃏B", "♠️4", "♣️7"]),
            ("♠️A", ["♥️2", "♠️4", "♣️7"], ["♣️2", "♠️4", "♣️7"]),
        ]
        for lead, expensive, loose in cases:
            with self.subTest(lead=lead):
                cost = self.intent(self.known_hand(expensive, lead))
                self.assertGreater(cost, 0.0)
                self.assertLess(cost, 0.5)
                self.assertGreater(self.intent(self.known_hand(loose, lead)), cost)

    def test_urgent_interception_and_immediate_finish_restore_willingness(self):
        state = self.known_hand(["♠️A", "♣️A", "♥️A", "♦️A", "♠️4", "♣️7", "♦️9"])
        ordinary = self.intent(state)
        state["players"]["leader"]["hand"] = [{}]
        self.assertGreaterEqual(self.intent(state), 0.85)
        self.assertGreater(self.intent(state), ordinary)
        self.assertEqual(self.intent(self.known_hand(["♠️A"])), 1.0)
        finishing = self.known_hand(["🃏B", "🃏B"])
        finishing["current_trick"]["combo"] = {"type": "pair", "size": 2, "rank_value": 80}
        self.assertEqual(self.intent(finishing), 1.0)

    def test_compound_reply_can_leave_a_short_hand_without_being_overdiscounted(self):
        state = self.known_hand(["♠️K", "♣️K", "♦️K", "♠️A", "♣️A", "♠️Q", "♣️Q", "♠️J"])
        state["current_trick"]["combo"] = {"type": "full_house", "size": 5, "rank_value": 50}
        self.assertEqual(self.intent(state), 1.0)

    def test_closed_response_window_and_other_known_owner_preclude_support(self):
        state = self.known_hand(["🃏B", "♠️4", "♣️7"], "🃏S")
        self.assertGreater(self.intent(state), 0.0)
        state["current_trick"]["player_id"] = "other"
        self.assertEqual(self.intent(state), 0.0)
        state["current_trick"]["player_id"] = "leader"
        for card_id in state["known_card_owners"]:
            state["known_card_owners"][card_id] = "other"
        self.assertEqual(self.intent(state), 0.0)

    def test_conditional_panel_keeps_rare_single_support_and_does_not_search(self):
        state, _pool = response_window.GuandanTeammateResponseWindowTests().make_state(
            pool_labels=["🃏B", "♠️4", "♠️5", "♠️6", "♠️7", "♠️8", "♠️9", "♠️10", "♠️J"],
            teammate_count=2,
        )
        expected = self.call("_teammate_single_response_probability", state, 90)
        with mock.patch.object(guandan_ai, "_teammate_hand_reply_willingness", return_value=1.0) as willingness, \
             mock.patch.object(guandan.GuandanGame, "bot_move", side_effect=AssertionError("recursive policy")), \
             mock.patch.object(guandan_ai, "_candidate_actions", side_effect=AssertionError("game-tree search")):
            self.assertAlmostEqual(self.intent(state), expected)
        self.assertEqual(willingness.call_count, 16)
        self.assertGreater(expected, 0.0)

    def test_public_observation_determines_intent_without_private_hands_or_global_rng(self):
        state = replay_fixture("88f335", 8)
        actor = state["current_turn"]
        before = random.getstate()
        expected = guandan_ai.call(guandan, "_teammate_response_intent_probability", state, actor)
        self.assertEqual(random.getstate(), before)
        for sampled in (False, True):
            changed = copy.deepcopy(state)
            changed.pop("_ai_eval_cache", None)
            changed["_ai_sampled_world"] = sampled
            for player, data in changed["players"].items():
                if player != actor:
                    data["hand"] = CountOnlyHand([{}] * len(data["hand"]))
            with self.subTest(sampled=sampled):
                self.assertEqual(guandan_ai.call(guandan, "_teammate_response_intent_probability", changed, actor), expected)

    def test_recent_voluntary_pass_is_soft_negative_evidence_not_impossibility(self):
        state = self.known_hand(["♠️A", "♠️4", "♣️7", "♦️9"])
        before = self.intent(state)
        state.pop("_ai_eval_cache", None)
        observation = {"value": state["current_trick"]["combo"]["rank_value"],
                       "hand_count": 4, "leader_id": "leader"}
        with mock.patch.object(guandan_ai, "_latest_public_single_pass_observation", return_value=observation):
            after = self.intent(state)
        self.assertGreater(after, 0.0)
        self.assertLess(after, before)

    def test_lane_deference_scales_with_intent_instead_of_a_possession_threshold(self):
        state = replay_fixture("88f335", 8)
        player = state["current_turn"]
        cards = [next(card["id"] for card in state["players"][player]["hand"]
                      if card.get("rank") == 2 and card.get("suit") == "clubs")]
        combo = guandan._action_combo(state, player, {"type": "play", "card_ids": cards})
        penalties = []
        for probability in (0.0, 0.25, 0.8, 1.0):
            with mock.patch.object(guandan_ai, "_teammate_response_intent_probability", return_value=probability):
                penalties.append(guandan_ai.call(guandan, "_teammate_lane_deference_penalty",
                                                 state, player, cards, combo))
        self.assertEqual(penalties[0], 0.0)
        self.assertGreater(penalties[3], 0.0)
        self.assertAlmostEqual(penalties[1], penalties[3] * 0.25)
        self.assertAlmostEqual(penalties[2], penalties[3] * 0.8)

    def test_nn_keeps_possession_feature_and_caches_do_not_cross_modes(self):
        state = self.known_hand(["♠️2", "♣️2", "♦️2", "♠️2", "♠️4", "♣️7", "♦️9"], "♠️A")
        state["current_trick"]["combo"]["rank_value"] = guandan_ai.CONTROL_SINGLE_VALUE_MIN
        state["config"]["bot_mode"] = "nn"
        legacy = self.call("_teammate_future_response_probability", state)
        legacy_key = self.call("_heuristic_score_cache_key", state, 4)
        state["config"]["bot_mode"] = "heuristic"
        current = self.call("_teammate_future_response_probability", state)
        current_key = self.call("_heuristic_score_cache_key", state, 4)
        self.assertGreater(legacy, current)
        self.assertNotEqual(legacy_key, current_key)
        state["config"]["bot_mode"] = "nn"
        self.assertEqual(self.call("_teammate_future_response_probability", state), legacy)

    def test_expired_call_and_warm_call_agree_without_poisoning_intent(self):
        state = self.known_hand(["♠️A", "♣️A", "♥️A", "♦️A", "♠️4", "♣️7", "♦️9"])
        with mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", -1.0, create=True):
            expired = self.intent(state)
        self.assertEqual(self.intent(state), expired)
        state.pop("_ai_eval_cache", None)
        self.assertEqual(self.intent(state), expired)


if __name__ == "__main__":
    unittest.main()
