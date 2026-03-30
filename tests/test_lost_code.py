import unittest
from unittest.mock import patch

from game.lost_code import LostCodeGame


def _players() -> list[dict]:
    return [
        {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
        {"player_id": "p2", "name": "Bob", "seat": 1, "is_bot": False},
    ]


class LostCodeGameTests(unittest.TestCase):
    def test_init_and_hidden_visibility(self):
        state = LostCodeGame.init_game({}, _players())
        self.assertEqual(state["phase"], "roll_dice")
        self.assertEqual(len(state["logs"]), 4)
        self.assertEqual(len(state["active_symbols"]), 6)
        for symbol in state["active_symbols"]:
            self.assertEqual(len(state["symbol_draw_piles"][symbol]), 3)

        view_p1 = LostCodeGame.get_public_view(state, "p1")
        own_log = next(log for log in view_p1["logs"] if log["owner_player_id"] == "p1")
        other_log = next(log for log in view_p1["logs"] if log["owner_player_id"] == "p2")
        neutral_logs = [log for log in view_p1["logs"] if log["owner_player_id"] is None]

        self.assertTrue(all(slot["value"] is None for slot in own_log["slots"]))
        self.assertTrue(all(slot["value"] is not None for slot in other_log["slots"]))
        self.assertTrue(all(slot["value"] is not None for log in neutral_logs for slot in log["slots"]))

    def test_round_resolve_and_exchange(self):
        state = LostCodeGame.init_game({}, _players())
        p1_log = next(log for log in state["logs"] if log["owner_player_id"] == "p1")
        p2_log = next(log for log in state["logs"] if log["owner_player_id"] == "p2")
        p1_log["slots"]["bird_blue"]["value"] = 0
        p2_log["slots"]["bird_blue"]["value"] = 7
        for symbol in state["active_symbols"]:
            if symbol != "bird_blue":
                p1_log["slots"][symbol]["value"] = 0
                p2_log["slots"][symbol]["value"] = 0

        with patch("game.lost_code.random.choice", side_effect=["bird_blue", "bird_blue", "bird_blue"]):
            _, err = LostCodeGame.apply_action(state, state["current_actor"], {"type": "roll_dice"})
        self.assertIsNone(err)
        self.assertEqual(state["phase"], "modify_die")

        _, err = LostCodeGame.apply_action(state, state["current_actor"], {"type": "confirm_dice"})
        self.assertIsNone(err)
        self.assertEqual(state["phase"], "choose_wheels")

        _, err = LostCodeGame.apply_action(state, state["current_actor"], {"type": "submit_guess", "wheel_id": "W1", "min": 0, "max": 0})
        self.assertIsNone(err)
        _, err = LostCodeGame.apply_action(state, state["current_actor"], {"type": "submit_guess", "wheel_id": "W2", "min": 0, "max": 1})
        self.assertIsNone(err)

        self.assertEqual(state["phase"], "exchange_stones")
        self.assertEqual(state["current_actor"], "p2")
        self.assertEqual(state["players"]["p1"]["score"], 5)
        self.assertEqual(state["players"]["p2"]["score"], 0)

        _, err = LostCodeGame.apply_action(state, "p2", {"type": "replace_stone", "symbol": "bird_blue"})
        self.assertIsNone(err)
        self.assertEqual(state["phase"], "roll_dice")
        self.assertEqual(state["round"], 2)

    def test_final_guess_scoring_with_shortcut(self):
        state = LostCodeGame.init_game({}, _players())
        active_symbols = list(state["active_symbols"])
        for player_id in ("p1", "p2"):
            log = next(log for log in state["logs"] if log["owner_player_id"] == player_id)
            for symbol in active_symbols:
                log["slots"][symbol]["value"] = 0

        state["players"]["p1"]["shortcut_commits"] = {"bird_blue": [0]}
        state["phase"] = "final_guess_submit"
        state["final_guess_context"] = {"order": ["p1", "p2"], "index": 0}
        state["current_actor"] = "p1"

        p1_final = {symbol: [0] for symbol in active_symbols if symbol != "bird_blue"}
        _, err = LostCodeGame.apply_action(state, "p1", {"type": "submit_final_guesses", "guesses": p1_final})
        self.assertIsNone(err)
        self.assertEqual(state["current_actor"], "p2")

        p2_final = {symbol: [] for symbol in active_symbols}
        _, err = LostCodeGame.apply_action(state, "p2", {"type": "submit_final_guesses", "guesses": p2_final})
        self.assertIsNone(err)

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["winner_ids"], ["p1"])


if __name__ == "__main__":
    unittest.main()
