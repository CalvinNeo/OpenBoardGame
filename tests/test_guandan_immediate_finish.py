import copy
import time
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanImmediateFinishTests(unittest.TestCase):
    def test_saved_wildcard_pair_finishes_without_search_in_every_mode(self):
        for mode in ("auto", "heuristic", "nn"):
            with self.subTest(mode=mode):
                state = replay_fixture("b0a262", 75, {"bot_mode": mode})
                expected = {card["id"] for card in state["players"]["bot4"]["hand"]}
                with (
                    mock.patch.object(guandan, "_heuristic_best_action", side_effect=AssertionError("scoring")),
                    mock.patch.object(guandan, "_determinize_state", side_effect=AssertionError("sampling")),
                    mock.patch.object(guandan, "_nn_pick_action", side_effect=AssertionError("model")),
                    mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("search")),
                ):
                    action = guandan.GuandanGame.bot_move(state, "bot4")
                self.assertEqual(set(action["card_ids"]), expected)
                explanation = state["bot_explain"]["bot4"]
                self.assertEqual(explanation["method_details"]["search_stop_reason"], "immediate_finish")
                self.assertEqual(explanation["score_model"], "none")
                self.assertNotIn("_ai_eval_cache", state)
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", action)[1])
                self.assertEqual(state["players"]["bot4"]["finish_rank"], 2)

    def test_next_turn_closeout_helpers_cannot_split_a_finishing_hand(self):
        state = replay_fixture("b0a262", 75)
        actions = guandan._candidate_actions(state, "bot4", 12)
        for helper in ("_public_endgame_closeout_action", "_forced_endgame_control_relay_action"):
            with self.subTest(helper=helper):
                self.assertIsNone(guandan_ai.call(guandan, helper, state, "bot4", actions))

    def test_minimax_finishes_even_with_an_expired_budget_and_bad_incumbent(self):
        state = replay_fixture("b0a262", 75)
        hand = state["players"]["bot4"]["hand"]
        action = guandan._minimax_pick_action(
            state, "bot4", 5, 6, deadline=time.perf_counter() - 1,
            incumbent_action={"type": "play", "card_ids": pick_card_ids(hand, ("♥️2",))},
        )
        self.assertEqual(set(action["card_ids"]), {card["id"] for card in hand})

    def test_both_saved_bomb_allocations_have_a_one_play_tail(self):
        original = replay_fixture("b0a262", 72)
        hand = original["players"]["bot4"]["hand"]
        natural = [card["id"] for card in hand if card.get("rank") == 6]
        upgraded = natural + pick_card_ids(hand, ("♥️2",))
        frontier = guandan_ai.call(guandan, "_bomb_response_frontier", original, "bot4")
        for bomb in (natural, upgraded):
            with self.subTest(size=len(bomb)):
                self.assertIn(set(bomb), [set(cards) for cards in frontier])
                state = copy.deepcopy(original)
                self.assertIsNone(guandan.GuandanGame.apply_action(
                    state, "bot4", {"type": "play", "card_ids": bomb}
                )[1])
                for player in ("calvin", "bot2"):
                    self.assertIsNone(guandan.GuandanGame.apply_action(state, player, {"type": "pass"})[1])
                tail = {card["id"] for card in state["players"]["bot4"]["hand"]}
                action = guandan.GuandanGame.bot_move(state, "bot4")
                self.assertEqual(set(action["card_ids"]), tail)
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", action)[1])
                self.assertEqual(state["players"]["bot4"]["finish_rank"], 2)

    def test_response_finish_must_still_beat_the_current_combo(self):
        for rank, can_finish in ((3, True), (11, False)):
            with self.subTest(rank=rank):
                state = replay_fixture("b0a262", 75, {"bot_mode": "heuristic"})
                state["current_trick"] = {
                    "player_id": "calvin", "cards": [],
                    "combo": {"type": "pair", "size": 2, "rank_value": guandan._point_order_value(rank, 2)},
                }
                action = guandan.GuandanGame.bot_move(state, "bot4")
                self.assertEqual(action["type"], "play" if can_finish else "pass")
                if can_finish:
                    self.assertEqual(len(action["card_ids"]), 2)


if __name__ == "__main__":
    unittest.main()
