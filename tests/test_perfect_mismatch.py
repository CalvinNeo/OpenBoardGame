import unittest

from game.perfect_mismatch import PerfectMismatchGame


class PerfectMismatchTests(unittest.TestCase):
    def _make_players(self, count=3):
        return [
            {"player_id": f"p{idx}", "name": f"Player {idx}", "seat": idx, "is_bot": False}
            for idx in range(count)
        ]

    def _prepare_state(self, target_index=0):
        players = self._make_players(3)
        state = PerfectMismatchGame.init_game({"slider_count": 1}, players)
        state["current_card"]["words"] = ["A", "B", "C", "D", "E"]
        state["current_card"]["target_index"] = target_index
        leader_id = state["leader_id"]
        events, error = PerfectMismatchGame.apply_action(
            state, leader_id, {"type": "set_slider", "slider_index": 0, "value": 7}
        )
        self.assertIsNone(error)
        self.assertTrue(events)
        return state, players

    def test_scoring_respects_order_when_first_guess_wrong(self):
        state, players = self._prepare_state(target_index=1)
        leader_id = state["leader_id"]
        guesser_1 = players[1]["player_id"]
        guesser_2 = players[2]["player_id"]

        _, error = PerfectMismatchGame.apply_action(state, guesser_1, {"type": "submit_guess", "choice_index": 0})
        self.assertIsNone(error)
        _, error = PerfectMismatchGame.apply_action(state, guesser_2, {"type": "submit_guess", "choice_index": 1})
        self.assertIsNone(error)
        _, error = PerfectMismatchGame.apply_action(state, leader_id, {"type": "reveal"})
        self.assertIsNone(error)

        self.assertEqual(state["players"][guesser_1]["score"], 0)
        self.assertEqual(state["players"][guesser_2]["score"], 2)
        self.assertEqual(state["players"][leader_id]["score"], 1)

    def test_leader_bonus_when_all_correct(self):
        state, players = self._prepare_state(target_index=2)
        leader_id = state["leader_id"]
        guesser_1 = players[1]["player_id"]
        guesser_2 = players[2]["player_id"]

        PerfectMismatchGame.apply_action(state, guesser_1, {"type": "submit_guess", "choice_index": 2})
        PerfectMismatchGame.apply_action(state, guesser_2, {"type": "submit_guess", "choice_index": 2})
        _, error = PerfectMismatchGame.apply_action(state, leader_id, {"type": "reveal"})
        self.assertIsNone(error)

        self.assertEqual(state["players"][leader_id]["score"], 3)
        self.assertEqual(state["players"][guesser_1]["score"], 3)
        self.assertEqual(state["players"][guesser_2]["score"], 2)

    def test_leader_penalty_when_none_correct(self):
        state, players = self._prepare_state(target_index=4)
        leader_id = state["leader_id"]
        guesser_1 = players[1]["player_id"]
        guesser_2 = players[2]["player_id"]

        PerfectMismatchGame.apply_action(state, guesser_1, {"type": "submit_guess", "choice_index": 0})
        PerfectMismatchGame.apply_action(state, guesser_2, {"type": "submit_guess", "choice_index": 1})
        _, error = PerfectMismatchGame.apply_action(state, leader_id, {"type": "reveal"})
        self.assertIsNone(error)

        self.assertEqual(state["players"][leader_id]["score"], -1)

    def test_play_again_resets_scores(self):
        state, players = self._prepare_state(target_index=0)
        leader_id = state["leader_id"]
        guesser_1 = players[1]["player_id"]
        guesser_2 = players[2]["player_id"]

        PerfectMismatchGame.apply_action(state, guesser_1, {"type": "submit_guess", "choice_index": 0})
        PerfectMismatchGame.apply_action(state, guesser_2, {"type": "submit_guess", "choice_index": 1})
        PerfectMismatchGame.apply_action(state, leader_id, {"type": "reveal"})
        self.assertTrue(state.get("game_over") or state.get("phase") == "reveal")

        state["game_over"] = True
        events, error = PerfectMismatchGame.apply_action(state, leader_id, {"type": "play_again"})
        self.assertIsNone(error)
        self.assertTrue(events)
        for pid in [leader_id, guesser_1, guesser_2]:
            self.assertEqual(state["players"][pid]["score"], 0)
