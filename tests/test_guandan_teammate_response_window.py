import copy
import random
import time
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanTeammateResponseWindowTests(unittest.TestCase):
    def make_state(self, lead="🃏S", pool_labels=None, teammate_count=2):
        deck = guandan._full_deck()

        def take(label):
            card = next(card for card in deck if guandan._card_label(card) == label)
            deck.remove(card)
            return card

        own = [take("♠️3")]
        lead_cards = [take(lead)]
        pool = [take(label) for label in (pool_labels or ["🃏B", "🃏B", "♠️4", "♠️5"])]
        state = {
            "level_rank": 2,
            "config": {},
            "turn_order": ["leader", "bot", "other", "mate"],
            "player_teams": {"leader": "A", "other": "A", "bot": "B", "mate": "B"},
            "teams": {"A": {"players": ["leader", "other"]},
                      "B": {"players": ["bot", "mate"]}},
            "players": {
                "bot": {"hand": own, "finished": False},
                "leader": {"hand": [{"hidden": True}], "finished": False},
                "other": {"hand": [{"hidden": True}], "finished": False},
                "mate": {"hand": [{"hidden": True} for _ in range(teammate_count)], "finished": False},
            },
            "current_turn": "bot",
            "current_trick": {
                "player_id": "leader", "cards": [card["id"] for card in lead_cards],
                "combo": guandan._evaluate_combo(lead_cards, 2, {}),
            },
            "pass_count": 0,
            "trick_plays": {},
            "seen_cards": [card["id"] for card in deck],
            "known_card_owners": {},
            "round_memories": [],
            "pass_limits": {},
        }
        return state, pool

    def call(self, name, state, *args):
        return guandan_ai.call(guandan, name, state, "bot", *args)

    def test_old_pass_or_play_does_not_close_new_small_joker_window(self):
        state, _pool = self.make_state()
        for old_action in ("pass", [{"rank": 14}]):
            with self.subTest(old_action=old_action):
                state["trick_plays"] = {"mate": old_action}
                self.assertTrue(self.call("_teammate_response_window_open", state))
                self.assertAlmostEqual(self.call("_teammate_future_control_probability", state), 5 / 6)
                self.assertGreater(self.call("_teammate_backstop_confidence", state), 0.0)

    def test_teammate_already_passed_current_top_play_has_no_window(self):
        state, _pool = self.make_state()
        # Other led; Mate and Leader passed; Bot is the final defender.
        state["current_trick"]["player_id"] = "other"
        state["pass_count"] = 2
        state["trick_plays"] = {"mate": "pass", "leader": "pass"}
        self.assertFalse(self.call("_teammate_response_window_open", state))
        self.assertEqual(self.call("_teammate_future_control_probability", state), 0.0)
        self.assertEqual(self.call("_teammate_single_response_probability", state, 90), 0.0)
        self.assertEqual(self.call("_teammate_backstop_confidence", state), 0.0)

    def test_seat_order_rejects_old_leader_before_teammate_even_without_pass_display(self):
        state, _pool = self.make_state()
        state["current_trick"]["player_id"] = "other"
        self.assertFalse(self.call("_teammate_response_window_open", state))

    def test_finished_intervening_seat_is_skipped(self):
        state, _pool = self.make_state()
        state["players"]["other"].update(hand=[], finished=True)
        self.assertTrue(self.call("_teammate_response_window_open", state))
        state["pass_count"] = 1
        self.assertFalse(self.call("_teammate_response_window_open", state))

    def test_no_future_response_when_teammate_finished_or_turn_has_moved(self):
        state, _pool = self.make_state()
        for change in ("finished", "other_turn", "teammate_leads", "no_trick"):
            variant = copy.deepcopy(state)
            if change == "finished":
                variant["players"]["mate"].update(hand=[], finished=True)
            elif change == "other_turn":
                variant["current_turn"] = "other"
            elif change == "teammate_leads":
                variant["current_trick"]["player_id"] = "mate"
            else:
                variant["current_trick"] = None
            with self.subTest(change=change):
                self.assertEqual(self.call("_teammate_future_control_probability", variant), 0.0)

    def test_ace_level_and_small_joker_allow_control_response_but_big_joker_does_not(self):
        for lead in ("♠️A", "♠️2", "🃏S", "🃏B"):
            labels = ["🃏B", "♠️4", "♠️5", "♠️6"]
            state, _pool = self.make_state(lead=lead, pool_labels=labels, teammate_count=1)
            with self.subTest(lead=lead):
                self.assertEqual(self.call("_teammate_future_control_probability", state),
                                 0.0 if lead == "🃏B" else 0.25)

    def test_known_joker_owner_and_known_nonwinning_cards_constrain_probability(self):
        state, pool = self.make_state(teammate_count=1)
        state["known_card_owners"] = {str(pool[0]["id"]): "mate"}
        self.assertEqual(self.call("_teammate_future_control_probability", state), 1.0)
        state["known_card_owners"] = {pool[2]["id"]: "mate"}
        self.assertEqual(self.call("_teammate_future_control_probability", state), 0.0)
        state["known_card_owners"] = {card["id"]: "other" for card in pool[:2]}
        self.assertEqual(self.call("_teammate_future_control_probability", state), 0.0)

    def test_known_nonwinning_teammate_card_consumes_one_draw(self):
        state, pool = self.make_state()
        state["known_card_owners"] = {pool[2]["id"]: "mate"}
        self.assertAlmostEqual(self.call("_teammate_future_control_probability", state), 2 / 3)

    def test_already_played_known_joker_cannot_be_counted_in_teammate_hand(self):
        state, pool = self.make_state(teammate_count=1)
        state["known_card_owners"] = {pool[0]["id"]: "mate"}
        state["seen_cards"].append(pool[0]["id"])
        self.assertAlmostEqual(self.call("_teammate_future_control_probability", state), 1 / 3)

    def test_single_belief_ignores_all_other_private_card_faces(self):
        state, _pool = self.make_state()
        before = self.call("_teammate_future_control_probability", state)
        confidence = self.call("_teammate_backstop_confidence", state)
        for pid in ("leader", "other", "mate"):
            state["players"][pid]["hand"] = [
                {"id": -999, "rank": 2, "suit": "hearts", "joker": "big"}
                for _ in state["players"][pid]["hand"]
            ]
        self.assertEqual(self.call("_teammate_future_control_probability", state), before)
        self.assertEqual(self.call("_teammate_backstop_confidence", state), confidence)

    def test_structured_backstop_uses_public_pool_instead_of_hidden_hand_faces(self):
        state, _pool = self.make_state(
            pool_labels=["♠️5", "♣️5", "♥️5", "♠️4", "♣️4"], teammate_count=5,
        )
        state["current_trick"]["combo"] = {
            "type": "full_house", "size": 5, "rank_value": guandan._point_order_value(3, 2),
        }
        confidence = self.call("_teammate_backstop_confidence", state)
        self.assertGreater(confidence, 0.0)
        state["players"]["mate"]["hand"] = [
            {"id": -idx, "rank": idx + 7, "suit": "spades", "joker": None}
            for idx in range(5)
        ]
        self.assertEqual(self.call("_teammate_backstop_confidence", state), confidence)
        state["known_card_owners"] = {card["id"]: "other" for card in _pool}
        self.assertEqual(self.call("_teammate_backstop_confidence", state), 0.0)

    def test_pair_and_three_backstop_cannot_gain_from_unrelated_plays_or_passes(self):
        for combo_type, size in (("pair", 2), ("three", 3)):
            state, _pool = self.make_state(
                pool_labels=["♠️5", "♣️5", "♥️5", "♠️4", "♣️4"], teammate_count=3,
            )
            state["current_trick"]["combo"] = {
                "type": combo_type, "size": size, "rank_value": guandan._point_order_value(4, 2),
            }
            before = self.call("_teammate_backstop_confidence", state)
            state["round_memories"] = [{"tricks": [{"actions": [
                {"player_id": "mate", "type": "play", "combo_type": "straight", "hand_count_after": 8},
                {"player_id": "mate", "type": "play", "combo_type": "straight", "hand_count_after": 3},
            ] + [{"player_id": "mate", "type": "pass"} for _ in range(7)]}]}]
            with self.subTest(combo_type=combo_type):
                self.assertEqual(self.call("_teammate_backstop_confidence", state), before)
                state["pass_limits"] = {"mate": {combo_type: state["current_trick"]["combo"]["rank_value"]}}
                after_pass = self.call("_teammate_backstop_confidence", state)
                self.assertLessEqual(after_pass, before)
                self.assertGreater(after_pass, 0.0)

    def test_pair_backstop_is_capped_by_public_reply_and_ignores_hidden_cards(self):
        state, pool = self.make_state(teammate_count=2)
        combo = {"type": "pair", "size": 2, "rank_value": guandan._point_order_value(2, 2)}
        state["current_trick"]["combo"] = combo
        # Only the two big jokers in the four-card public pool can beat 22.
        physical_probability = guandan_ai.call(
            guandan, "_history_lane_reply_probability", state, "mate", combo, pool, [],
        )
        self.assertAlmostEqual(physical_probability, 1 / 6)
        for known_owner in (None, "other"):
            if known_owner:
                state["known_card_owners"] = {pool[0]["id"]: known_owner}
            before = self.call("_teammate_backstop_confidence", state)
            self.assertLessEqual(before, physical_probability)
            state["players"]["mate"]["hand"] = [dict(pool[0]), dict(pool[1])]
            self.assertEqual(self.call("_teammate_backstop_confidence", state), before)
            if known_owner:
                self.assertEqual(before, 0.0)

    def test_matching_pair_history_can_help_but_stays_below_public_probability(self):
        state, pool = self.make_state(
            pool_labels=["🃏B", "🃏B", "♠️4", "♠️5", "♠️6", "♠️7", "♠️8", "♠️9", "♠️10", "♠️J", "♠️Q"],
            teammate_count=7,
        )
        combo = {"type": "pair", "size": 2, "rank_value": guandan._point_order_value(2, 2)}
        state["current_trick"]["combo"] = combo
        state["round_memories"] = [{"tricks": [{"actions": [
            {"player_id": "mate", "type": "play", "combo_type": "pair", "hand_count_after": 7},
        ]}]}]
        probability = guandan_ai.call(
            guandan, "_history_lane_reply_probability", state, "mate", combo, pool, [],
        )
        with_history = self.call("_teammate_backstop_confidence", state)
        state["round_memories"] = []
        self.assertGreater(with_history, self.call("_teammate_backstop_confidence", state))
        self.assertLessEqual(with_history, probability)


class GuandanSharedTeammateWaitTests(unittest.TestCase):
    @staticmethod
    def case(**config):
        state = replay_fixture("7a5", 15, config=config)
        cards = pick_card_ids(state["players"]["bot2"]["hand"], ["♥️3", "♣️3", "♦️3", "♥️3"])
        return state, cards

    @staticmethod
    def call(name, state, *args, **kwargs):
        return guandan_ai.call(guandan, name, state, "bot2", *args, **kwargs)

    def test_wait_components_are_shared_by_quick_and_detail_without_double_counting(self):
        state, cards = self.case()
        features = self.call("_candidate_features", state, cards)
        shared_pass = self.call("_shared_pass_tactical_components", state)
        shared_bomb = self.call("_shared_response_tactical_components", state, cards, features["combo"], features)
        self.assertGreater(shared_pass["defer_to_teammate_control"], 0.0)
        self.assertLess(shared_bomb["save_bomb_for_teammate"], 0.0)
        detailed_pass = self.call("_bot_score_components", state, None, 1)
        detailed_bomb = self.call("_bot_score_components", state, cards, 1)
        self.assertEqual(detailed_pass["defer_to_teammate_control"], shared_pass["defer_to_teammate_control"])
        self.assertEqual(detailed_bomb["save_bomb_for_teammate"], shared_bomb["save_bomb_for_teammate"])
        self.assertGreater(self.call("_quick_candidate_score", state, None),
                           self.call("_quick_candidate_score", state, cards))
        self.assertGreater(detailed_pass["total"], detailed_bomb["total"])

    def test_expired_deadline_still_waits_without_detailed_scoring(self):
        state, _cards = self.case()
        with mock.patch.object(guandan_ai, "_bot_finalist_score_components", side_effect=AssertionError("late detail")):
            chosen = self.call("_bot_select_play", state, 2, deadline=time.perf_counter() - 1)
        self.assertIsNone(chosen)
        self.assertGreater(self.call("_shared_pass_tactical_components", state)["defer_to_teammate_control"], 0.0)

    def test_auto_three_shallow_rounds_do_not_reverse_waiting_for_teammate(self):
        # The save failed after three completed depth-zero rounds. Keep the
        # same shallow search shape, but remove wall-clock and RNG variability.
        real_random = random.Random
        for seed in (0, 1, 7):
            state, _cards = self.case(
                bot_mode="auto", bot_endgame_threshold=0, bot_think_time_ms=2000,
                bot_mcts_sims=9, bot_mcts_depth=1, bot_mcts_tree_ply=0,
            )
            with self.subTest(seed=seed), \
                 mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(seed)), \
                 mock.patch.object(guandan_ai.time, "perf_counter", return_value=0.0):
                action = guandan.GuandanGame.bot_move(state, "bot2")
            self.assertEqual(action["type"], "pass")
            explain = state["bot_explain"]["bot2"]
            self.assertEqual(explain["method"], "mcts")
            self.assertEqual(explain["method_details"]["mcts_completed_depth"], 0)
            self.assertEqual(explain["method_details"]["mcts_completed_rounds"], 3)

    def test_extra_wait_preference_is_disabled_for_short_enemy_or_own_closeout(self):
        base, cards = self.case()
        self.assertGreater(self.call("_safe_teammate_control_wait_probability", base), 0.0)
        for change in ("leader_short", "intervening_enemy_one_card", "own_bomb_out", "own_near_finish"):
            state = copy.deepcopy(base)
            if change == "leader_short":
                state["players"]["calvin"]["hand"] = state["players"]["calvin"]["hand"][:5]
            elif change == "intervening_enemy_one_card":
                state["players"]["z"]["hand"] = state["players"]["z"]["hand"][:1]
            else:
                hand = state["players"]["bot2"]["hand"]
                bomb = [card for card in hand if card["id"] in cards]
                filler = [card for card in hand if card["id"] not in cards]
                state["players"]["bot2"]["hand"] = bomb + (filler[:2] if change == "own_near_finish" else [])
            with self.subTest(change=change):
                self.assertEqual(self.call("_safe_teammate_control_wait_probability", state), 0.0)
                state.pop("_ai_eval_cache", None)
                shared = self.call("_shared_pass_tactical_components", state)
                self.assertNotIn("defer_to_teammate_control", shared)
                features = self.call("_candidate_features", state, cards)
                response = self.call("_shared_response_tactical_components", state, cards, features["combo"], features)
                self.assertNotIn("save_bomb_for_teammate", response)


if __name__ == "__main__":
    unittest.main()
