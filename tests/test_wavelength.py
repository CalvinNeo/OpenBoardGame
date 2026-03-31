import unittest

from game.wavelength import WavelengthGame


def _players():
    return [
        {"player_id": "p1", "seat": 1, "name": "Alice"},
        {"player_id": "p2", "seat": 2, "name": "Bob"},
        {"player_id": "p3", "seat": 3, "name": "Cara"},
        {"player_id": "p4", "seat": 4, "name": "Dan"},
    ]


class WavelengthGameTests(unittest.TestCase):
    def test_target_hidden_from_non_psychic_before_reveal(self):
        state = WavelengthGame.init_game(None, _players())
        psychic = state["current_round"]["psychic_player_id"]
        other = "p3" if psychic != "p3" else "p2"
        psychic_view = WavelengthGame.get_public_view(state, psychic)
        other_view = WavelengthGame.get_public_view(state, other)
        self.assertIsNotNone(psychic_view["target_center"])
        self.assertIsNone(other_view["target_center"])

    def test_center_hit_scores_four_and_blocks_side_bonus(self):
        state = WavelengthGame.init_game({"target_score": 20}, _players())
        state["scores"] = {"A": 0, "B": 1}
        state["phase"] = "opponent_guess"
        state["current_round"]["active_team"] = "A"
        state["current_round"]["opponent_team"] = "B"
        state["current_round"]["target_center"] = 0.0
        state["current_round"]["guess_pos"] = 0.0
        events, error = WavelengthGame.apply_action(state, "p2", {"type": "submit_side_guess", "side": "LEFT"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "wavelength:side_guess_submitted" for evt in events))
        self.assertEqual(state["scores"]["A"], 4)
        self.assertEqual(state["scores"]["B"], 1)

    def test_catch_up_keeps_same_active_team(self):
        state = WavelengthGame.init_game({"target_score": 20, "enable_catch_up_rule": True}, _players())
        state["scores"] = {"A": 0, "B": 6}
        state["phase"] = "opponent_guess"
        state["current_round"]["active_team"] = "A"
        state["current_round"]["opponent_team"] = "B"
        state["current_round"]["target_center"] = 0.1
        state["current_round"]["guess_pos"] = 0.1
        events, error = WavelengthGame.apply_action(state, "p2", {"type": "submit_side_guess", "side": "RIGHT"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "wavelength:side_guess_submitted" for evt in events))
        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(state["current_round"]["active_team"], "A")
        self.assertEqual(state["pending_next_team"], "A")
        events, error = WavelengthGame.apply_action(state, "p1", {"type": "continue_next_round"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "wavelength:round_continued" for evt in events))
        self.assertEqual(state["phase"], "psychic_clue")
        self.assertEqual(state["current_round"]["active_team"], "A")

    def test_tiebreak_starts_when_scores_are_tied_at_target(self):
        state = WavelengthGame.init_game({"target_score": 4}, _players())
        state["scores"] = {"A": 4, "B": 4}
        state["phase"] = "opponent_guess"
        state["current_round"]["active_team"] = "A"
        state["current_round"]["opponent_team"] = "B"
        state["current_round"]["target_center"] = -0.9
        state["current_round"]["guess_pos"] = 0.9
        events, error = WavelengthGame.apply_action(state, "p2", {"type": "submit_side_guess", "side": "RIGHT"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "wavelength:side_guess_submitted" for evt in events))
        self.assertFalse(state["game_over"])
        self.assertEqual(state["tiebreak_pending"], ["B"])
        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(state["pending_next_team"], "B")
        events, error = WavelengthGame.apply_action(state, "p1", {"type": "continue_next_round"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "wavelength:round_continued" for evt in events))
        self.assertEqual(state["current_round"]["active_team"], "B")
