import unittest

from game.word_decode import WordDecodeGame


def _players():
    return [
        {"player_id": "p1", "name": "P1", "seat": 0, "is_bot": False},
        {"player_id": "p2", "name": "P2", "seat": 1, "is_bot": False},
        {"player_id": "p3", "name": "P3", "seat": 2, "is_bot": False},
    ]


def _submit_all_hints(state):
    for pid in state["turn_order"]:
        events, error = WordDecodeGame.apply_action(state, pid, {"type": "submit_hints", "hints": ["中", "文"]})
        assert events == []
        assert error is None


class WordDecodeTimeoutTests(unittest.TestCase):
    def test_guess_timer_off_has_no_pending_timeout(self):
        state = WordDecodeGame.init_game({"guess_time_limit_sec": 0}, _players())
        _submit_all_hints(state)
        self.assertEqual(state["phase"], "guess")
        self.assertIsNone(state.get("pending_timeout"))
        self.assertIsNone(state.get("guess_deadline_ms"))

    def test_guess_timeout_auto_submits_incomplete_drafts(self):
        state = WordDecodeGame.init_game({"guess_time_limit_sec": 60}, _players())
        _submit_all_hints(state)
        self.assertEqual(state["phase"], "guess")
        pending = state.get("pending_timeout")
        self.assertIsInstance(pending, dict)
        self.assertEqual(pending.get("type"), "guess")

        targets_p1 = [pid for pid in state["turn_order"] if pid != "p1"]
        first_target = targets_p1[0]
        second_target = targets_p1[1]
        first_word = state["assignments"][first_target]

        events, error = WordDecodeGame.apply_action(
            state,
            "p1",
            {
                "type": "update_guess_draft",
                "base_guess": "",
                "hidden_guesses": [
                    {"target_player_id": first_target, "guess": first_word},
                ],
            },
        )
        self.assertEqual(events, [])
        self.assertIsNone(error)

        events, error = WordDecodeGame.apply_action(
            state,
            "p2",
            {
                "type": "submit_guesses",
                "base_guess": "wrong",
                "hidden_guesses": [
                    {"target_player_id": "p1", "guess": "wrong"},
                    {"target_player_id": "p3", "guess": "wrong"},
                ],
            },
        )
        self.assertEqual(events, [])
        self.assertIsNone(error)

        timeout_events = WordDecodeGame.resolve_guess_timeout(state, int(pending["at_ms"]) + 1)
        self.assertIsInstance(timeout_events, list)
        self.assertEqual(state["phase"], "round_end")

        p1_guesses = state["guesses"]["p1"]["hidden_guesses"]
        self.assertEqual(p1_guesses[first_target], first_word)
        self.assertEqual(p1_guesses[second_target], "")
        self.assertEqual(state["guesses"]["p3"]["base_guess"], "")
        self.assertEqual(state["guesses"]["p3"]["hidden_guesses"]["p1"], "")
        self.assertEqual(state["guesses"]["p3"]["hidden_guesses"]["p2"], "")

    def test_manual_submit_allows_incomplete_guesses(self):
        state = WordDecodeGame.init_game({"guess_time_limit_sec": 60}, _players())
        _submit_all_hints(state)
        self.assertEqual(state["phase"], "guess")

        events, error = WordDecodeGame.apply_action(
            state,
            "p1",
            {
                "type": "submit_guesses",
                "base_guess": "",
                "hidden_guesses": [],
            },
        )
        self.assertEqual(events, [])
        self.assertIsNone(error)
        self.assertIn("p1", state["guesses"])
        self.assertEqual(state["guesses"]["p1"]["base_guess"], "")
        self.assertEqual(state["guesses"]["p1"]["hidden_guesses"]["p2"], "")
        self.assertEqual(state["guesses"]["p1"]["hidden_guesses"]["p3"], "")

    def test_first_submitter_gets_extra_point_on_correct_base(self):
        state = WordDecodeGame.init_game({"guess_time_limit_sec": 60}, _players())
        _submit_all_hints(state)
        self.assertEqual(state["phase"], "guess")
        base_word = state["current_card"]["base"]

        events, error = WordDecodeGame.apply_action(
            state,
            "p1",
            {
                "type": "submit_guesses",
                "base_guess": base_word,
                "hidden_guesses": [],
            },
        )
        self.assertEqual(events, [])
        self.assertIsNone(error)

        for pid in ("p2", "p3"):
            events, error = WordDecodeGame.apply_action(
                state,
                pid,
                {
                    "type": "submit_guesses",
                    "base_guess": "",
                    "hidden_guesses": [],
                },
            )
            self.assertEqual(events, [])
            self.assertIsNone(error)

        self.assertEqual(state["phase"], "round_end")
        summary = state["round_summary"]
        self.assertEqual(summary["base_first_bonus_player"], "p1")
        self.assertEqual(summary["scores_delta"]["p1"], 4)


if __name__ == "__main__":
    unittest.main()
