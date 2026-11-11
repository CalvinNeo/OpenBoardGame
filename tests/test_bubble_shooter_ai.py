"""Tests for game/bubble_shooter_ai.py — the strategic search bot."""

import random
import unittest

from game.bubble_shooter import (
    BOMB,
    DEATH_ROW,
    MAX_ANGLE,
    RAINBOW,
    BubbleShooterGame,
    _empty_grid,
    _lowest_row,
    _neighbors,
)
from game.bubble_shooter_ai import (
    FATAL,
    best_hammer,
    best_shot,
    candidate_cells,
    choose_action,
    evaluate_hammer,
    evaluate_shot,
)

PALETTE = ["red", "orange", "yellow", "green"]


def make_board(cells=None, queue=("red", "red", "red"), combo=0, parity=0, items=None):
    grid = _empty_grid(parity)
    for (row, col), value in (cells or {}).items():
        grid[row][col] = value
    return {
        "player_id": "p0",
        "seed": 1,
        "palette": list(PALETTE),
        "top_parity": parity,
        "grid": grid,
        "queue": list(queue),
        "queue_counter": 0,
        "items": items or {"hammer": 0, "aim": 0},
        "aim_left": 0,
        "score": 0,
        "combo": combo,
        "best_combo": 0,
        "shots": 0,
        "wave": 1,
        "push_countdown": 6,
        "push_index": 0,
        "popped_total": 0,
        "dropped_total": 0,
        "shot_id": 0,
        "last_shot": None,
        "phase": "playing",
        "game_over": False,
        "result": None,
    }


def column(col, bottom, colour, top=0):
    """A vertical run from the ceiling, which is always anchored."""
    return {(row, col): colour for row in range(top, bottom + 1)}


def make_state(seed=5, count=1):
    players = [
        {"player_id": "p%d" % i, "name": "P%d" % i, "seat": i, "is_bot": True}
        for i in range(count)
    ]
    return BubbleShooterGame.init_game({"seed": seed}, players)


class CandidateTest(unittest.TestCase):
    def test_candidates_are_empty_cells(self):
        board = make_board({(0, 4): "red", (0, 5): "blue", (1, 4): "red"})
        for row, col in candidate_cells(board):
            self.assertIsNone(board["grid"][row][col])

    def test_candidates_are_always_anchored(self):
        board = make_board({(0, 4): "red", (0, 5): "blue", (1, 4): "red"})
        found = candidate_cells(board)
        self.assertTrue(found)
        parity = board["top_parity"]
        for row, col in found:
            if row == 0:
                continue
            self.assertTrue(
                any(board["grid"][r][c] is not None for r, c in _neighbors(row, col, parity)),
                "candidate %d,%d would hang in the air" % (row, col),
            )

    def test_candidate_angles_are_in_range(self):
        board = make_board({(0, 4): "red"})
        for angle in candidate_cells(board).values():
            self.assertLessEqual(abs(angle), MAX_ANGLE)

    def test_candidates_are_deterministic(self):
        board = make_board({(0, 4): "red", (1, 3): "blue", (2, 5): "green"})
        self.assertEqual(candidate_cells(board), candidate_cells(board))

    def test_a_full_board_has_no_candidates(self):
        board = make_board()
        for row in range(len(board["grid"])):
            for col in range(len(board["grid"][row])):
                board["grid"][row][col] = "red"
        self.assertEqual(candidate_cells(board), {})


class EvaluationTest(unittest.TestCase):
    def test_a_drop_beats_a_plain_pop(self):
        board = make_board({
            (0, 0): "red", (1, 0): "red",
            (2, 0): "blue", (3, 0): "blue",
            (0, 4): "red", (0, 5): "red",
        })
        # (1,1) completes the left reds and drops the two blues hanging below.
        with_drop = evaluate_shot(board, 1, 1, "red")
        # (1,4) completes the right reds but nothing loses its anchor.
        without_drop = evaluate_shot(board, 1, 4, "red")
        self.assertGreater(with_drop, without_drop)

    def test_points_scale_with_the_combo(self):
        board = make_board({(0, 4): "red", (0, 5): "red", (0, 0): "blue"}, combo=0)
        plain = evaluate_shot(board, 1, 4, "red")
        board["combo"] = 3
        boosted = evaluate_shot(board, 1, 4, "red")
        self.assertGreater(boosted, plain)

    def test_wiping_a_colour_is_rewarded(self):
        board = make_board({
            (0, 0): "red", (0, 1): "red", (0, 2): "red",
            (0, 6): "blue", (0, 7): "blue", (0, 8): "blue",
        })
        wipe = evaluate_shot(board, 1, 0, "red")
        keep = evaluate_shot(board, 5, 5, "red")
        self.assertGreater(wipe, keep)

    def test_a_fatal_shot_is_scored_as_fatal(self):
        board = make_board({**column(0, 12, "blue"), **column(6, 4, "green")})
        fatal = evaluate_shot(board, 13, 0, "red")
        safe = evaluate_shot(board, 5, 6, "red")
        self.assertLess(fatal, FATAL / 2)
        self.assertGreater(safe, fatal)

    def test_the_best_candidate_is_never_fatal(self):
        board = make_board({**column(0, 12, "blue"), **column(6, 4, "green")})
        scored = [
            (evaluate_shot(board, row, col, "red"), (row, col))
            for (row, col) in candidate_cells(board)
        ]
        self.assertTrue(scored)
        best = max(scored)[1]
        after = [list(line) for line in board["grid"]]
        after[best[0]][best[1]] = "red"
        self.assertLess(_lowest_row(after), DEATH_ROW)

    def test_a_bomb_prefers_the_dense_side(self):
        board = make_board({
            (0, 0): "red", (0, 1): "red", (1, 0): "red", (1, 1): "red",
            (0, 8): "blue",
        })
        dense = evaluate_shot(board, 2, 0, BOMB)
        empty = evaluate_shot(board, 2, 6, BOMB)
        self.assertGreater(dense, empty)

    def test_a_rainbow_uses_the_neighbouring_colour(self):
        board = make_board({
            (0, 0): "red", (0, 1): "red", (0, 6): "blue", (0, 7): "blue",
        })
        left = evaluate_shot(board, 1, 0, RAINBOW)
        middle = evaluate_shot(board, 1, 4, RAINBOW)
        self.assertGreater(left, middle)

    def test_a_quiet_shot_still_clusters(self):
        board = make_board(
            {(0, 0): "red", (0, 6): "red", (1, 6): "blue"},
            queue=("red", "green", "green"),
        )
        beside_own = evaluate_shot(board, 1, 0, "red")
        beside_other = evaluate_shot(board, 2, 6, "red")
        self.assertGreater(beside_own, beside_other)

    def test_an_empty_board_is_scored(self):
        board = make_board()
        self.assertIsInstance(evaluate_shot(board, 0, 0, "red"), float)


class HammerTest(unittest.TestCase):
    def test_the_hammer_takes_the_anchor_that_drops_the_most(self):
        board = make_board(
            {**column(0, 3, "blue"), (0, 6): "green"},
            items={"hammer": 1, "aim": 0},
        )
        action = best_hammer(board)
        self.assertEqual(action["item"], "hammer")
        # Knocking out the ceiling anchor drops the whole run below it.
        self.assertEqual((action["row"], action["col"]), (0, 0))

    def test_the_hammer_scores_the_drop(self):
        board = make_board({(0, 0): "red", (1, 0): "red", (2, 0): "blue", (3, 0): "blue"})
        useful = evaluate_hammer(board, 1, 0)
        useless = evaluate_hammer(board, 3, 0)
        self.assertGreater(useful, useless)

    def test_the_hammer_is_not_free(self):
        board = make_board({(0, 0): "red"})
        self.assertLess(evaluate_hammer(board, 0, 0), evaluate_shot(board, 1, 0, "red"))


class ChoiceTest(unittest.TestCase):
    def test_it_returns_a_known_action_type(self):
        state = make_state()
        action = choose_action(state, "p0")
        self.assertIn(action["type"], ("shoot", "use_item"))

    def test_it_is_deterministic(self):
        first = make_state(seed=9)
        second = make_state(seed=9)
        self.assertEqual(choose_action(first, "p0"), choose_action(second, "p0"))

    def test_the_action_is_accepted_by_the_game(self):
        state = make_state(seed=9)
        action = choose_action(state, "p0")
        _, err = BubbleShooterGame.apply_action(state, "p0", action)
        self.assertIsNone(err)

    def test_it_never_walks_into_the_death_row_when_it_can_help_it(self):
        state = make_state(seed=4)
        board = state["boards"]["p0"]
        board["grid"] = _empty_grid(0)
        for (row, col), value in {**column(0, 12, "blue"), **column(6, 4, "green")}.items():
            board["grid"][row][col] = value
        board["queue"] = ["red", "red", "red"]
        action = best_shot(board)
        self.assertIsNotNone(action)
        _, err = BubbleShooterGame.apply_action(state, "p0", action)
        self.assertIsNone(err)
        self.assertFalse(board["game_over"])
        self.assertLess(_lowest_row(board["grid"]), DEATH_ROW)

    def test_an_out_board_gets_no_action(self):
        state = make_state()
        state["boards"]["p0"]["game_over"] = True
        self.assertIsNone(choose_action(state, "p0"))

    def test_a_stranger_gets_no_action(self):
        self.assertIsNone(choose_action(make_state(), "ghost"))

    def test_a_finished_match_gets_no_action(self):
        state = make_state()
        state["game_over"] = True
        self.assertIsNone(choose_action(state, "p0"))

    def test_a_full_board_gets_no_shot(self):
        board = make_board()
        for row in range(len(board["grid"])):
            for col in range(len(board["grid"][row])):
                board["grid"][row][col] = "red"
        self.assertIsNone(best_shot(board))

    def test_the_hammer_is_spent_only_when_it_pays(self):
        state = make_state(seed=3)
        board = state["boards"]["p0"]
        first = choose_action(state, "p0")
        self.assertEqual(first["type"], "shoot")

    def test_it_spends_the_hammer_to_escape_the_death_line(self):
        # Every landing is fatal here, but pulling a ceiling anchor drops a
        # whole run and buys the board back.
        board = make_board(
            {
                **column(0, 12, "blue"),
                **column(2, 12, "blue"),
                **column(4, 12, "blue"),
            },
            items={"hammer": 2, "aim": 0},
        )
        state = {"boards": {"p0": board}, "game_over": False}
        action = choose_action(state, "p0")
        self.assertEqual(action["type"], "use_item")
        self.assertEqual(action["item"], "hammer")


class StrengthTest(unittest.TestCase):
    """The point of the module: it has to actually play better than noise."""

    def _play(self, smart, seed, rounds):
        state = make_state(seed=seed)
        rng = random.Random(seed)
        for _ in range(rounds):
            board = state["boards"]["p0"]
            if board["game_over"]:
                break
            if smart:
                action = choose_action(state, "p0")
            else:
                action = {"type": "shoot", "angle": round(rng.uniform(-MAX_ANGLE, MAX_ANGLE), 2)}
            if action is None:
                break
            _, err = BubbleShooterGame.apply_action(state, "p0", action)
            if err:
                break
        return state["boards"]["p0"]

    def test_it_outscores_a_random_bot(self):
        for seed in (5, 11, 42):
            with self.subTest(seed=seed):
                smart = self._play(True, seed, 60)
                noisy = self._play(False, seed, 60)
                self.assertGreater(smart["score"], noisy["score"] * 3)

    def test_it_keeps_the_stack_shallow(self):
        board = self._play(True, 5, 60)
        self.assertLess(_lowest_row(board["grid"]), DEATH_ROW - 4)

    def test_it_survives_where_a_random_bot_dies(self):
        smart = self._play(True, 11, 60)
        noisy = self._play(False, 11, 60)
        self.assertFalse(smart["game_over"])
        self.assertTrue(noisy["game_over"])


if __name__ == "__main__":
    unittest.main()
