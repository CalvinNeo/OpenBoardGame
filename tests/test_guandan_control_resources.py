import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanControlResourceTests(unittest.TestCase):
    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    def combo(self, state, cards):
        hand = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
        return guandan._evaluate_combo([hand[cid] for cid in cards], state["level_rank"], state["config"])

    def test_same_triple_prefers_lower_cargo_in_quick_and_full_scoring(self):
        cases = (
            ("38c", 17, ("♠️K", "♥️K", "♦️K"), ("♠️2", "♣️2"), ("♠️8", "♣️8")),
            ("8b1", 2, ("♥️5", "♥️5", "♣️5"), ("♠️A", "♣️A"), ("♠️6", "♥️6")),
        )
        for case, turn, triple, high, low in cases:
            for lead in (False, True):
                with self.subTest(case=case, lead=lead):
                    state = replay_fixture(case, turn)
                    if lead:
                        state.update(current_trick=None, trick_plays={}, pass_count=0)
                    hand = state["players"]["bot2"]["hand"]
                    expensive = pick_card_ids(hand, triple + high)
                    cheap = pick_card_ids(hand, triple + low)
                    penalty = self.call("_full_house_control_pair_penalty", state, "bot2",
                                        expensive, self.combo(state, expensive))
                    self.assertGreaterEqual(penalty, 16.0)
                    self.assertEqual(self.call("_full_house_control_pair_penalty", state, "bot2",
                                               cheap, self.combo(state, cheap)), 0.0)
                    self.assertGreater(self.call("_quick_candidate_score", state, "bot2", cheap),
                                       self.call("_quick_candidate_score", state, "bot2", expensive))
                    full = guandan._bot_score_components(state, "bot2", expensive, 4)
                    self.assertEqual(full["full_house_control_pair"], -penalty)

    def test_saved_decisions_keep_control_pairs_in_both_modes(self):
        for case, turn in (("38c", 17), ("8b1", 2)):
            for mode in ("heuristic", "auto"):
                with self.subTest(case=case, mode=mode):
                    state = replay_fixture(case, turn, {"bot_mode": mode})
                    action = guandan.GuandanGame.bot_move(state, "bot2")
                    if action["type"] == "play":
                        cards = action["card_ids"]
                        self.assertEqual(self.call("_full_house_control_pair_penalty", state, "bot2",
                                                   cards, self.combo(state, cards)), 0.0)

    def test_expired_budget_keeps_control_pairs_on_lead_and_response(self):
        for case, turn in (("38c", 17), ("8b1", 2)):
            for lead in (False, True):
                with self.subTest(case=case, lead=lead):
                    state = replay_fixture(case, turn)
                    if lead:
                        state.update(current_trick=None, trick_plays={}, pass_count=0)
                    action = guandan._heuristic_best_action(state, "bot2", 4, deadline=0.0)
                    if action["type"] == "play":
                        cards = action["card_ids"]
                        self.assertEqual(self.call("_full_house_control_pair_penalty", state, "bot2",
                                                   cards, self.combo(state, cards)), 0.0)

    def test_control_cargo_is_allowed_to_finish_and_discounted_to_block(self):
        state = replay_fixture("38c", 17)
        hand = state["players"]["bot2"]["hand"]
        cards = pick_card_ids(hand, ("♠️K", "♥️K", "♦️K", "♠️2", "♣️2"))
        combo = self.combo(state, cards)
        leader = state["current_trick"]["player_id"]
        enemy_hand = state["players"][leader]["hand"]
        state["players"][leader]["hand"] = enemy_hand[:1]
        state["seen_cards"].extend(card["id"] for card in enemy_hand[1:])
        self.assertAlmostEqual(self.call("_full_house_control_pair_penalty", state, "bot2", cards, combo),
                               22.0 * 0.35)
        state["players"]["bot2"]["hand"] = [card for card in hand if card["id"] in cards]
        state["seen_cards"].extend(card["id"] for card in hand if card["id"] not in cards)
        self.assertEqual(self.call("_full_house_control_pair_penalty", state, "bot2", cards, combo), 0.0)
        self.assertEqual(set(guandan.GuandanGame.bot_move(state, "bot2")["card_ids"]), set(cards))

    def test_wild_triplet_is_not_mistaken_for_attachment_and_nonlevel_two_is_small(self):
        from tests.test_guandan_hand_routes import GuandanHandRouteTests
        for labels, level in (
            (["♠️A", "♣️A", "♥️2", "♠️5", "♣️5", "♠️9"], 2),
            (["♠️5", "♣️5", "♥️5", "♠️2", "♣️2", "♠️9"], 7),
        ):
            state = GuandanHandRouteTests().make_state(labels, level=level)
            cards = pick_card_ids(state["players"]["bot"]["hand"], labels[:5])
            hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
            combo = guandan._evaluate_combo([hand[cid] for cid in cards], level, {})
            self.assertEqual(self.call("_full_house_control_pair_penalty", state, "bot", cards, combo), 0.0)

    def bomb_case(self):
        state = replay_fixture("38c", 53)
        cards = [c["id"] for c in state["players"]["bot2"]["hand"] if c.get("rank") == 11]
        return state, cards

    def test_bomb_plus_last_full_house_reclaims_lead_in_both_modes_and_at_timeout(self):
        for mode in ("heuristic", "auto", "expired"):
            with self.subTest(mode=mode):
                state, bomb = self.bomb_case()
                state["config"]["bot_mode"] = mode if mode != "expired" else "heuristic"
                action = (guandan._heuristic_best_action(state, "bot2", 4, deadline=0.0)
                          if mode == "expired" else guandan.GuandanGame.bot_move(state, "bot2"))
                self.assertEqual(action["type"], "play")
                self.assertEqual(set(action["card_ids"]), set(bomb))

    def test_bomb_closeout_needs_only_current_bomb_to_hold(self):
        state, cards = self.bomb_case()
        remaining = guandan._remove_cards(state["players"]["bot2"]["hand"], cards)
        with (
            mock.patch.object(guandan_ai, "_choose_lead_play", side_effect=AssertionError("nested lead search")),
            mock.patch.object(guandan_ai, "_opponent_same_type_reply_probability", side_effect=AssertionError("already finished")),
            mock.patch.object(guandan_ai, "_opponent_bomb_reply_probability", side_effect=AssertionError("already finished")),
        ):
            for overbomb, expected in ((0.0, 34.0), (1.0, 0.0)):
                with mock.patch.object(guandan_ai, "_opponent_overbomb_reply_probability", return_value=overbomb):
                    self.assertEqual(self.call("_bomb_response_closeout_bonus", state, "bot2", cards,
                                               self.combo(state, cards), remaining), expected)
        parts = guandan._bot_score_components(state, "bot2", cards, 4)
        passed = guandan._bot_score_components(state, "bot2", None, 4)
        self.assertGreater(parts["total"], passed["total"])
        self.assertNotIn("strategic_enemy_pass", passed)

    def test_closeout_does_not_apply_to_teammate_or_nonfinal_tail(self):
        state, cards = self.bomb_case()
        remaining = guandan._remove_cards(state["players"]["bot2"]["hand"], cards)
        for change in ("teammate", "broken_tail"):
            changed = copy.deepcopy(state)
            tail = remaining
            if change == "teammate":
                changed["current_trick"]["player_id"] = "bot4"
            else:
                tail = remaining[:-1]
            self.assertEqual(self.call("_bomb_response_closeout_bonus", changed, "bot2", cards,
                                       self.combo(state, cards), tail), 0.0)

    def test_saved_bomb_then_full_house_finishes_before_any_reply(self):
        state, cards = self.bomb_case()
        _, error = guandan.GuandanGame.apply_action(state, "bot2", {"type": "play", "card_ids": cards})
        self.assertIsNone(error)
        for pid in ("z", "bot4", "calvin"):
            _, error = guandan.GuandanGame.apply_action(state, pid, {"type": "pass"})
            self.assertIsNone(error)
        tail = state["players"]["bot2"]["hand"]
        self.assertEqual(guandan._evaluate_combo(tail, 2, {})["type"], "full_house")
        _, error = guandan.GuandanGame.apply_action(state, "bot2", {
            "type": "play", "card_ids": [c["id"] for c in tail],
        })
        self.assertIsNone(error)
        self.assertEqual(state["players"]["bot2"]["finish_rank"], 1)

    def test_closeout_bonus_uses_public_information_only(self):
        state, cards = self.bomb_case()
        def bonus(current):
            return self.call("_bomb_response_closeout_bonus", current, "bot2", cards,
                             self.combo(current, cards),
                             guandan._remove_cards(current["players"]["bot2"]["hand"], cards))
        expected = bonus(state)
        shuffled = copy.deepcopy(state)
        opponents = ("calvin", "z", "bot4")
        pool = sum((shuffled["players"][pid]["hand"] for pid in opponents), [])
        random.Random(38).shuffle(pool)
        for pid in opponents:
            count = len(shuffled["players"][pid]["hand"])
            shuffled["players"][pid]["hand"] = pool[:count]
            del pool[:count]
        shuffled["_ai_eval_cache"] = {}
        self.assertEqual(bonus(shuffled), expected)


if __name__ == "__main__":
    unittest.main()
