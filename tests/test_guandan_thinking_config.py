import unittest
from unittest import mock

from jsonschema import Draft7Validator

from game import guandan, guandan_ai
from game.definitions import GUANDAN_CONFIG_SCHEMA
from tests.guandan_history_fixtures import replay_fixture


class GuandanThinkingConfigTests(unittest.TestCase):
    def test_search_maximum_survives_adaptive_budget_expansion(self):
        for stage in ("mcts", "minimax"):
            for maximum, expected_ms in ((None, 3965), (300, 300), (9000, 3965)):
                with self.subTest(stage=stage, maximum=maximum):
                    state = replay_fixture("38c", 53, {
                        "bot_mode": "auto", "bot_think_time_ms": 6000,
                        "bot_endgame_threshold": 0 if stage == "mcts" else 999,
                        f"bot_{stage}_max_time_ms": maximum,
                    })
                    clock = [100.0]

                    def heuristic(*_args, **_kwargs):
                        self.assertFalse(guandan_ai._deadline_expired(1.0))
                        clock[0] += 2.0
                        return {"type": "pass"}

                    with (
                        mock.patch.object(guandan.time, "perf_counter", side_effect=lambda: clock[0]),
                        mock.patch.object(guandan, "_heuristic_best_action", side_effect=heuristic),
                        mock.patch.object(guandan, "_should_use_mcts", return_value=True),
                        mock.patch.object(guandan, "_mcts_pick_action", return_value=(None, [])) as mcts,
                        mock.patch.object(guandan, "_determinize_state", side_effect=lambda s, *_a, **_kw: s),
                        mock.patch.object(guandan, "_minimax_pick_action", return_value=None) as minimax,
                        mock.patch.object(guandan, "_build_bot_explain", return_value={}),
                        mock.patch.object(guandan, "_append_bot_explain_history"),
                    ):
                        action = guandan.GuandanGame.bot_move(state, state["current_turn"])
                    self.assertEqual(action, {"type": "pass"})
                    search = mcts if stage == "mcts" else minimax
                    search.assert_called_once()
                    self.assertAlmostEqual(search.call_args.kwargs["deadline"], 102.0 + expected_ms / 1000)

    def test_room_schema_accepts_defaults_and_explicit_maxima(self):
        validator = Draft7Validator(GUANDAN_CONFIG_SCHEMA)
        for config in ({}, {"bot_mode": "auto", "bot_think_time_ms": 6000,
                            "bot_mcts_max_time_ms": None, "bot_minimax_max_time_ms": None},
                       {"bot_think_time_ms": 120000, "bot_mcts_max_time_ms": 25,
                        "bot_minimax_max_time_ms": 10000}):
            self.assertEqual(list(validator.iter_errors(config)), [])
        for key in ("bot_think_time_ms", "bot_mcts_max_time_ms", "bot_minimax_max_time_ms"):
            for value in (-1, 0, 24, 120001, "6", True):
                with self.subTest(key=key, value=value):
                    self.assertTrue(list(validator.iter_errors({key: value})))


if __name__ == "__main__":
    unittest.main()
