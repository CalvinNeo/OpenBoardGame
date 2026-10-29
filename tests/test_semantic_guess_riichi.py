import unittest
from unittest.mock import patch

from game import semantic_guess
from game.semantic_guess import SemanticGuessGame


class _Store:
    mode = "indexed"

    def ensure_ready(self):
        return self

    def filter_words(self, words):
        return list(words)

    def contains(self, word):
        return word in {"苹果", "月亮", "火车"}

    def similarity(self, left, right):
        return {("月亮", "苹果"): -0.25, ("火车", "苹果"): 0.25}.get((left, right), 0.0)


def _players(count):
    return [{"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": False}
            for i in range(count)]


class SemanticGuessRiichiTests(unittest.TestCase):
    def setUp(self):
        self.patches = [
            patch.object(semantic_guess, "get_store", return_value=_Store()),
            patch.object(semantic_guess, "_load_vocabulary", return_value=["苹果", "月亮", "火车"]),
        ]
        for item in self.patches:
            item.start()
        semantic_guess._AVAILABLE_WORDS = None
        semantic_guess.prepare_game({})

    def tearDown(self):
        semantic_guess._AVAILABLE_WORDS = None
        for item in reversed(self.patches):
            item.stop()

    @staticmethod
    def action(state, kind, **fields):
        return {"type": kind, "game_token": state["game_token"],
                "turn_number": state["turn_number"], **fields}

    def test_solo_pass_reveals_answer(self):
        state = SemanticGuessGame.init_game({}, _players(1))
        state["secret_word"] = "苹果"
        events, error = SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "skip_turn"))
        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "semantic_guess:round_end")
        self.assertTrue(state["game_over"])
        self.assertEqual(SemanticGuessGame.get_public_view(state, "p0")["secret_word"], "苹果")

    def test_riichi_hides_words_in_both_directions_until_round_end(self):
        state = SemanticGuessGame.init_game({}, _players(3))
        state["secret_word"] = "苹果"
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "declare_riichi"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "submit_guess", word="月亮"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "submit_guess", word="火车"))[1])
        p0_view = SemanticGuessGame.get_public_view(state, "p0")
        p1_view = SemanticGuessGame.get_public_view(state, "p1")
        p0_other = next(row for row in p0_view["guesses"] if row["player_id"] == "p1")
        p1_riichi = next(row for row in p1_view["guesses"] if row["player_id"] == "p0")
        self.assertIsNone(p0_other["word"])
        self.assertIsNone(p1_riichi["word"])
        self.assertEqual(p1_riichi["similarity"], -0.25)
        self.assertEqual(next(row for row in p0_view["guesses"] if row["player_id"] == "p0")["word"], "月亮")
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p2", self.action(state, "skip_turn"))[1])
        self.assertFalse(state["players"]["p0"]["riichi"])
        self.assertEqual(next(row for row in SemanticGuessGame.get_public_view(state, "p1")["guesses"]
                              if row["player_id"] == "p0")["word"], "月亮")

    def test_riichi_cannot_be_declared_twice(self):
        state = SemanticGuessGame.init_game({}, _players(2))
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "declare_riichi"))[1])
        events, error = SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "declare_riichi"))
        self.assertEqual(events, [])
        self.assertEqual(error, "riichi already declared")

    def test_solo_wrong_guess_then_pass_reveals_answer(self):
        state = SemanticGuessGame.init_game({}, _players(1))
        state["secret_word"] = "苹果"
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "submit_guess", word="月亮"))[1])
        self.assertFalse(state["game_over"])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "skip_turn"))[1])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["end_reason"], "all_passed")
        self.assertEqual(SemanticGuessGame.get_public_view(state, "p0")["secret_word"], "苹果")

    def test_two_player_all_pass_ends_after_the_second_pass(self):
        state = SemanticGuessGame.init_game({}, _players(2))
        state["secret_word"] = "苹果"
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "skip_turn"))[1])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["round_passed_players"], ["p0"])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "skip_turn"))[1])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["end_reason"], "all_passed")

    def test_mixed_round_then_all_pass_starts_a_clean_round(self):
        state = SemanticGuessGame.init_game({}, _players(2))
        state["secret_word"] = "苹果"
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "submit_guess", word="月亮"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "skip_turn"))[1])
        self.assertEqual(state["round_number"], 2)
        self.assertEqual(state["round_acted_players"], [])
        self.assertEqual(state["round_passed_players"], [])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "skip_turn"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "skip_turn"))[1])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["end_reason"], "all_passed")

    def test_duplicate_guess_is_rejected_without_consuming_the_new_turn(self):
        state = SemanticGuessGame.init_game({}, _players(2))
        state["secret_word"] = "苹果"
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "submit_guess", word="月亮"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "skip_turn"))[1])
        turn_number = state["turn_number"]
        events, error = SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "submit_guess", word="月亮"))
        self.assertEqual(events, [])
        self.assertEqual(error, "word already guessed")
        self.assertEqual(state["turn_number"], turn_number)
        self.assertEqual(state["current_turn_player_id"], "p0")

    def test_all_history_words_are_visible_after_game_end(self):
        state = SemanticGuessGame.init_game({}, _players(2))
        state["secret_word"] = "苹果"
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "declare_riichi"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "submit_guess", word="月亮"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "skip_turn"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p0", self.action(state, "skip_turn"))[1])
        self.assertIsNone(SemanticGuessGame.apply_action(
            state, "p1", self.action(state, "skip_turn"))[1])
        self.assertTrue(state["game_over"])
        for viewer in ("p0", "p1"):
            row = next(row for row in SemanticGuessGame.get_public_view(state, viewer)["guesses"]
                       if row["player_id"] == "p0")
            self.assertEqual(row["word"], "月亮")
            self.assertFalse(row["word_hidden"])


if __name__ == "__main__":
    unittest.main()
