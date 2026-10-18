import copy
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
    def test_guess_preview_is_shared_without_revealing_target_or_locking_guess(self):
        state = WavelengthGame.init_game(None, _players())
        WavelengthGame.apply_action(state, "p1", {"type": "submit_clue", "clue": "冰淇淋"})

        events, error = WavelengthGame.apply_action(state, "p3", {"type": "update_team_guess", "pos": -0.625})

        self.assertIsNone(error)
        self.assertEqual(events, [{"type": "wavelength:team_guess_updated", "payload": {"player_id": "p3", "pos": -0.625}}])
        self.assertEqual(state["phase"], "team_guess")
        self.assertIsNone(state["current_round"]["guess_pos"])
        self.assertEqual(WavelengthGame.get_legal_actions(state, "p3"), ["submit_team_guess"])
        for viewer in ("p1", "p2", "p3", "p4", "spectator"):
            with self.subTest(viewer=viewer):
                view = WavelengthGame.get_public_view(state, viewer)
                self.assertEqual(view["team_guess_preview_pos"], -0.625)
                self.assertEqual(view["preview_player_id"], "p3")
                self.assertIsNone(view["team_guess_pos"])
                if viewer != "p1":
                    self.assertIsNone(view["target_center"])

    def test_guess_preview_requires_an_active_non_psychic_teammate(self):
        state = WavelengthGame.init_game(None, _players())
        preview = {"type": "update_team_guess", "pos": 0.5}
        before = copy.deepcopy(state)
        events, error = WavelengthGame.apply_action(state, "p3", preview)
        self.assertEqual(events, [])
        self.assertEqual(error, "invalid action")
        self.assertEqual(state, before)
        WavelengthGame.apply_action(state, "p1", {"type": "submit_clue", "clue": "warm"})

        for player_id in ("p1", "p2", "p4", "spectator"):
            with self.subTest(player_id=player_id):
                before = copy.deepcopy(state)
                events, error = WavelengthGame.apply_action(state, player_id, preview)
                self.assertEqual(events, [])
                self.assertEqual(error, "invalid action")
                self.assertEqual(state, before)

        for pos in (None, "not a number", float("nan")):
            with self.subTest(pos=pos):
                before = copy.deepcopy(state)
                events, error = WavelengthGame.apply_action(state, "p3", {"type": "update_team_guess", "pos": pos})
                self.assertEqual(events, [])
                self.assertEqual(error, "invalid pos")
                self.assertEqual(state, before)

    def test_guess_preview_clears_when_locked_and_on_next_round(self):
        state = WavelengthGame.init_game({"target_score": 20}, _players())
        initial_view = WavelengthGame.get_public_view(state, "p3")
        self.assertIsNone(initial_view["team_guess_preview_pos"])
        self.assertIsNone(initial_view["preview_player_id"])
        WavelengthGame.apply_action(state, "p1", {"type": "submit_clue", "clue": "warm"})
        WavelengthGame.apply_action(state, "p3", {"type": "update_team_guess", "pos": 0.25})
        WavelengthGame.apply_action(state, "p3", {"type": "submit_team_guess", "pos": 0.4})

        view = WavelengthGame.get_public_view(state, "p2")
        self.assertEqual(view["team_guess_pos"], 0.4)
        self.assertIsNone(view["team_guess_preview_pos"])
        self.assertIsNone(view["preview_player_id"])
        before = copy.deepcopy(state)
        events, error = WavelengthGame.apply_action(state, "p3", {"type": "update_team_guess", "pos": 0.6})
        self.assertEqual(events, [])
        self.assertEqual(error, "invalid action")
        self.assertEqual(state, before)

        WavelengthGame.apply_action(state, "p2", {"type": "submit_side_guess", "side": "LEFT"})
        for player in _players():
            WavelengthGame.apply_action(state, player["player_id"], {"type": "continue_next_round"})
        self.assertEqual(state["round_number"], 2)
        view = WavelengthGame.get_public_view(state, "p3")
        self.assertIsNone(view["team_guess_preview_pos"])
        self.assertIsNone(view["preview_player_id"])
        self.assertIsNone(view["team_guess_pos"])

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
        self.assertFalse(any(evt["type"] == "wavelength:round_continued" for evt in events))
        WavelengthGame.apply_action(state, "p2", {"type": "continue_next_round"})
        WavelengthGame.apply_action(state, "p3", {"type": "continue_next_round"})
        events, error = WavelengthGame.apply_action(state, "p4", {"type": "continue_next_round"})
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
        WavelengthGame.apply_action(state, "p1", {"type": "continue_next_round"})
        WavelengthGame.apply_action(state, "p2", {"type": "continue_next_round"})
        WavelengthGame.apply_action(state, "p3", {"type": "continue_next_round"})
        events, error = WavelengthGame.apply_action(state, "p4", {"type": "continue_next_round"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "wavelength:round_continued" for evt in events))
        self.assertEqual(state["current_round"]["active_team"], "B")
