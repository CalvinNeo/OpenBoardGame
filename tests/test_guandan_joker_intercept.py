"""Cover a teammate's last single before an opponent can finish over it."""

import copy
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import replay_fixture
from tests.test_guandan_history_policy import CountOnlyHand, UnreadableInitialHands


class GuandanJokerInterceptTests(unittest.TestCase):
    @staticmethod
    def call(name, state, *args):
        return guandan_ai.call(guandan, name, state, "bot2", *args)

    def make_state(self, mode="heuristic"):
        # The seat called bot2 by fixtures is displayed as Bot 3 in d00e55.
        # Bot 4 has just finished with 9; calvin passed; z still gets a turn.
        return replay_fixture("d00e55", 93, {"bot_mode": mode})

    def test_saved_position_uses_big_joker_in_heuristic_and_auto(self):
        for mode in ("heuristic", "auto"):
            with self.subTest(mode=mode):
                state = self.make_state(mode)
                self.assertEqual(len(state["players"]["z"]["hand"]), 1)
                self.assertTrue(state["players"]["bot4"]["finished"])
                action = guandan.GuandanGame.bot_move(state, "bot2")
                hand_map = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
                self.assertEqual(
                    [hand_map[cid].get("joker") for cid in action.get("card_ids", [])],
                    ["big"],
                )
                explanation = state["bot_explain"]["bot2"]
                self.assertGreater(explanation["chosen"]["components"]["block_next_closeout"], 0)
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot2", action)[1])
                self.assertEqual(state["current_turn"], "z")
                self.assertEqual(len(state["players"]["bot2"]["hand"]), 4)

    def test_pass_would_allow_a_publicly_possible_queen_to_finish(self):
        state = self.make_state()
        # Swap unseen enemy cards without changing anything visible to Bot 3.
        queen = next(card for card in state["players"]["calvin"]["hand"] if card["rank"] == 12)
        low = state["players"]["z"]["hand"][0]
        state["players"]["calvin"]["hand"].remove(queen)
        state["players"]["calvin"]["hand"].append(low)
        state["players"]["z"]["hand"] = [queen]
        passed = copy.deepcopy(state)
        self.assertIsNone(guandan.GuandanGame.apply_action(passed, "bot2", {"type": "pass"})[1])
        self.assertEqual(passed["current_turn"], "z")
        finish = {"type": "play", "card_ids": [queen["id"]]}
        self.assertIsNone(guandan.GuandanGame.apply_action(passed, "z", finish)[1])
        self.assertEqual(passed["players"]["z"]["finish_rank"], 2)

        action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(action["type"], "play")
        self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot2", action)[1])
        self.assertEqual(guandan._list_hint_options(state, "z"), [])

    def test_publicly_known_low_enemy_card_preserves_the_joker(self):
        for mode in ("heuristic", "auto"):
            with self.subTest(mode=mode):
                state = self.make_state(mode)
                low = state["players"]["z"]["hand"][0]
                state["known_card_owners"] = {str(low["id"]): "z"}
                self.assertEqual(self.call("_next_opponent_closeout_pressure", state), 0.0)
                self.assertNotIn("pass_next_enemy_closeout", self.call("_shared_pass_tactical_components", state))
                self.assertEqual(guandan.GuandanGame.bot_move(state, "bot2"), {"type": "pass"})

    def test_closed_response_window_and_unbeatable_single_have_no_threat(self):
        for variant in ("last_responder", "big_joker", "enemy_has_two"):
            state = self.make_state()
            if variant == "last_responder":
                state["pass_count"] = guandan._trick_passes_needed(state) - 1
            elif variant == "big_joker":
                state["current_trick"]["combo"]["rank_value"] = 100
            else:
                state["players"]["z"]["hand"] = CountOnlyHand(2)
            with self.subTest(variant=variant):
                self.assertEqual(self.call("_next_opponent_closeout_pressure", state), 0.0)
                self.assertNotIn("pass_next_enemy_closeout", self.call("_shared_pass_tactical_components", state))

    def test_intercept_does_not_require_the_teammate_to_have_finished(self):
        state = self.make_state()
        state["players"]["bot4"].update(hand=CountOnlyHand(1), finished=False, finish_rank=None)
        state["finish_order"] = []
        self.assertGreater(self.call("_next_opponent_closeout_pressure", state), 0.0)
        self.assertEqual(self.call("_teammate_protect_bonus", state), 0.0)

    def test_pressure_uses_public_information_without_reading_other_hands(self):
        state = self.make_state()
        names = ("_next_opponent_closeout_pressure", "_teammate_protect_bonus",
                 "_shared_pass_tactical_components")
        expected = {name: self.call(name, state) for name in names}
        self.assertEqual(expected["_next_opponent_closeout_pressure"], 16.0)
        state.pop("_ai_eval_cache", None)
        for pid, pdata in state["players"].items():
            if pid != "bot2":
                pdata["hand"] = CountOnlyHand(len(pdata["hand"]))
        for memory in state["round_memories"]:
            memory["initial_hands"] = UnreadableInitialHands()
        for name in names:
            with self.subTest(helper=name):
                self.assertEqual(self.call(name, state), expected[name])


if __name__ == "__main__":
    unittest.main()
