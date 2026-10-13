"""Public-information regressions from b0a262, df8914 and 877cca."""

import copy
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import FIXTURES, pick_card_ids, replay_fixture
from tests.test_guandan_history_policy import CountOnlyHand, UnreadableInitialHands


class GuandanThreeSavesTests(unittest.TestCase):
    @staticmethod
    def call(name, *args):
        return guandan_ai.call(guandan, name, *args)

    def choose(self, case, step, mode="heuristic"):
        state = replay_fixture(case, step, {
            "bot_mode": mode, "bot_endgame_threshold": 0,
        })
        player = state["current_turn"]
        action = guandan.GuandanGame.bot_move(state, player)
        self.assertIsNone(guandan.GuandanGame.apply_action(copy.deepcopy(state), player, action)[1])
        hand_map = guandan._map_hand_by_id(state["players"][player]["hand"])
        cards = [hand_map[cid] for cid in action.get("card_ids", [])]
        combo = guandan._evaluate_combo(cards, state["level_rank"], state["config"]) or {}
        return state, action, cards, combo

    def test_protect_short_partner_when_enemy_bombs_their_full_house(self):
        for mode in ("heuristic", "auto"):
            with self.subTest(mode=mode):
                state, action, cards, combo = self.choose("b0a262", 46, mode)
                self.assertEqual(len(state["players"]["bot2"]["hand"]), 6)
                self.assertEqual(combo.get("type"), "bomb")
                self.assertEqual([card["rank"] for card in cards], [11] * 4)
                self.assertGreater(self.call(
                    "_remaining_bomb_cover_tier", state, "bot4", action["card_ids"]
                ), 0)

    def test_joker_runout_is_intercepted_without_spending_the_wildcard(self):
        for step in (65, 69):
            for mode in ("heuristic", "auto"):
                with self.subTest(step=step, mode=mode):
                    state, _action, cards, combo = self.choose("df8914", step, mode)
                    self.assertEqual(combo.get("type"), "bomb")
                    self.assertEqual([card["rank"] for card in cards], [12] * 4)
                    self.assertFalse(any(guandan._is_wild(card, 2) for card in cards))
                    chosen = state["bot_explain"]["bot4"]["chosen"]["components"]
                    self.assertNotIn("premium_bomb_spend_penalty", chosen)

    def test_use_small_joker_first_and_retain_big_joker_for_the_next_exchange(self):
        for mode in ("heuristic", "auto"):
            with self.subTest(mode=mode):
                state, action, cards, combo = self.choose("877cca", 45, mode)
                self.assertEqual(combo.get("type"), "single")
                self.assertEqual([card.get("joker") for card in cards], ["small"])
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot2", action)[1])
                # Reuse only the subsequent public prefix through the enemy A.
                # The saved big joker has become a small joker; all later plays
                # in this prefix remain legal, leaving the big joker in reserve.
                for player, labels in FIXTURES["877cca"]["actions"][45:52]:
                    reply = {"type": "pass"} if not labels else {
                        "type": "play",
                        "card_ids": pick_card_ids(state["players"][player]["hand"], labels),
                    }
                    self.assertIsNone(guandan.GuandanGame.apply_action(state, player, reply)[1])
                next_action = guandan.GuandanGame.bot_move(state, "bot2")
                hand_map = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
                self.assertEqual(
                    [hand_map[cid].get("joker") for cid in next_action.get("card_ids", [])],
                    ["small"],
                )
                remaining = guandan._remove_cards(
                    state["players"]["bot2"]["hand"], next_action["card_ids"]
                )
                self.assertTrue(any(card.get("joker") == "big" for card in remaining))

    def test_short_enemy_single_is_not_left_to_a_speculative_partner_response(self):
        for step in (53, 57):
            with self.subTest(step=step):
                _state, action, _cards, combo = self.choose("877cca", step)
                self.assertEqual(action["type"], "play")
                self.assertEqual(combo.get("type"), "single")

    def test_single_to_four_is_not_enough_to_invent_a_likely_bomb_tail(self):
        state = replay_fixture("df8914", 65)
        profile = self.call("_four_card_bomb_finish_profile", state, "bot4", "z")
        self.assertTrue(profile["bomb_possible"])
        self.assertLess(profile["bomb_probability"], 0.5)
        self.assertGreaterEqual(profile["bomb_probability"], profile["physical_probability"])

    def test_clearing_several_singles_still_supports_a_retained_bomb(self):
        state = replay_fixture("877cca", 67)
        profile = self.call("_four_card_bomb_finish_profile", state, "bot4", "calvin")
        self.assertGreaterEqual(profile["bomb_probability"], 0.5)
        self.assertEqual(guandan.GuandanGame.bot_move(state, "bot4"), {"type": "pass"})

    def test_short_partner_support_still_requires_a_lost_structured_lane(self):
        original = replay_fixture("b0a262", 46)
        self.assertTrue(self.call("_layered_bomb_intercept_context", original, "bot4"))
        for mutation in ("long_partner", "no_history", "ordinary_play"):
            state = copy.deepcopy(original)
            if mutation == "long_partner":
                state["players"]["bot2"]["hand"] = CountOnlyHand(15)
            elif mutation == "no_history":
                state["round_memories"] = []
            else:
                state["current_trick"]["combo"]["type"] = "single"
            with self.subTest(mutation=mutation):
                self.assertFalse(self.call("_layered_bomb_intercept_context", state, "bot4"))

    def test_new_policy_reads_only_own_cards_and_public_history(self):
        cases = (
            ("b0a262", 46, "_layered_bomb_intercept_context"),
            ("df8914", 65, "_short_enemy_single_pressure"),
            ("877cca", 45, "_can_save_big_joker"),
        )
        for case, step, helper in cases:
            state = replay_fixture(case, step)
            player = state["current_turn"]
            before = self.call(helper, state, player)
            state.pop("_ai_eval_cache", None)
            for pid, pdata in state["players"].items():
                if pid != player:
                    pdata["hand"] = CountOnlyHand(len(pdata["hand"]))
            for memory in state["round_memories"]:
                memory["initial_hands"] = UnreadableInitialHands()
            with self.subTest(case=case, helper=helper):
                self.assertEqual(self.call(helper, state, player), before)


if __name__ == "__main__":
    unittest.main()
