"""Tests for game/bubble_shooter.py — endless, simultaneous, shared seed."""

import math
import unittest

from game.bubble_shooter import (
    BOMB,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    COLORS,
    COLS,
    DEATH_ROW,
    MAX_ANGLE,
    MAX_ROWS,
    RAINBOW,
    ROW_HEIGHT,
    SHOOTER_X,
    SHOOTER_Y,
    BubbleShooterGame,
    _board_empty,
    _center,
    _check_board_end,
    _check_match_end,
    _colors_on_board,
    _empty_grid,
    _explode_cells,
    _floating_cells,
    _in_bounds,
    _lowest_row,
    _match_group,
    _neighbors,
    _occupied,
    _parity,
    _row_width,
    _simulate,
    _snap_cell,
)


def make_players(count):
    return [
        {"player_id": "p%d" % index, "name": "P%d" % index, "seat": index, "is_bot": False}
        for index in range(count)
    ]


def make_state(seed=7, count=1, **config):
    payload = {"seed": seed}
    payload.update(config)
    return BubbleShooterGame.init_game(payload, make_players(count))


def blank(board, cells=None, parity=0):
    """Replace a board with an empty grid plus the given cells."""
    board["top_parity"] = parity
    board["grid"] = _empty_grid(parity)
    for (row, col), value in (cells or {}).items():
        board["grid"][row][col] = value
    return board


class GeometryTest(unittest.TestCase):
    def test_row_width_alternates(self):
        self.assertEqual(_row_width(0, 0), COLS)
        self.assertEqual(_row_width(1, 0), COLS - 1)
        self.assertEqual(_row_width(2, 0), COLS)

    def test_parity_flips_with_top_parity(self):
        self.assertEqual(_parity(0, 0), 0)
        self.assertEqual(_parity(0, 1), 1)

    def test_odd_rows_are_staggered_half_a_bubble(self):
        even_x, _ = _center(0, 0, 0)
        odd_x, _ = _center(1, 0, 0)
        self.assertAlmostEqual(odd_x - even_x, 0.5)

    def test_row_height_is_hex_spacing(self):
        self.assertAlmostEqual(ROW_HEIGHT, math.sqrt(3) / 2)

    def test_row_zero_centre_is_half_a_bubble_down(self):
        _, y = _center(0, 0, 0)
        self.assertAlmostEqual(y, ROW_HEIGHT / 2)

    def test_every_cell_has_six_neighbours_in_the_interior(self):
        self.assertEqual(len(_neighbors(5, 5, 0)), 6)

    def test_edge_cells_have_fewer_neighbours(self):
        self.assertLess(len(_neighbors(0, 0, 0)), 6)

    def test_neighbours_are_symmetric(self):
        for row, col in _neighbors(4, 4, 0):
            self.assertIn((4, 4), _neighbors(row, col, 0))

    def test_in_bounds_rejects_the_missing_odd_column(self):
        self.assertTrue(_in_bounds(0, COLS - 1, 0))
        self.assertFalse(_in_bounds(1, COLS - 1, 0))

    def test_empty_grid_matches_row_widths(self):
        grid = _empty_grid(0)
        self.assertEqual(len(grid), MAX_ROWS)
        for row in range(MAX_ROWS):
            self.assertEqual(len(grid[row]), _row_width(row, 0))

    def test_shooter_sits_inside_the_board(self):
        self.assertTrue(0 < SHOOTER_X < BOARD_WIDTH)
        self.assertTrue(0 < SHOOTER_Y < BOARD_HEIGHT)


class SimulationTest(unittest.TestCase):
    def test_straight_up_reaches_the_ceiling(self):
        path, (x, y) = _simulate([], 0)
        self.assertAlmostEqual(x, SHOOTER_X, places=3)
        self.assertAlmostEqual(y, 0.5, places=3)
        self.assertGreater(len(path), 1)

    def test_wall_bounce_records_a_corner(self):
        path, _ = _simulate([], 80)
        self.assertGreaterEqual(len(path), 3)

    def test_ray_never_leaves_the_board(self):
        for angle in (-MAX_ANGLE, -30, 0, 30, MAX_ANGLE):
            path, _ = _simulate([], angle)
            for x, y in path:
                self.assertGreaterEqual(x, 0.0)
                self.assertLessEqual(x, BOARD_WIDTH)
                self.assertGreaterEqual(y, 0.0)

    def test_shot_stops_on_the_first_bubble(self):
        cells = [(0, 5, 5.5, ROW_HEIGHT / 2)]
        _, (x, y) = _simulate(cells, 0)
        self.assertGreater(y, ROW_HEIGHT / 2)

    def test_snap_prefers_a_cell_touching_the_stack(self):
        grid = _empty_grid(0)
        grid[0][5] = "red"
        target = _snap_cell(grid, 0, 5.5, 1.3)
        self.assertIsNotNone(target)
        row, col = target
        self.assertNotEqual((row, col), (0, 5))
        self.assertIn((0, 5), _neighbors(row, col, 0))

    def test_snap_never_returns_an_occupied_cell(self):
        grid = _empty_grid(0)
        for col in range(COLS):
            grid[0][col] = "red"
        target = _snap_cell(grid, 0, 5.5, 1.3)
        self.assertIsNotNone(target)
        self.assertIsNone(grid[target[0]][target[1]])

    def test_snap_returns_none_when_the_board_is_sealed(self):
        grid = _empty_grid(0)
        for row in range(MAX_ROWS):
            for col in range(len(grid[row])):
                grid[row][col] = "red"
        self.assertIsNone(_snap_cell(grid, 0, 5.5, 1.3))


class MatchTest(unittest.TestCase):
    def test_three_connected_colours_pop(self):
        grid = _empty_grid(0)
        grid[0][4] = grid[0][5] = "red"
        grid[1][4] = "red"
        self.assertEqual(len(_match_group(grid, 0, 1, 4)), 3)

    def test_two_connected_colours_do_not_pop(self):
        grid = _empty_grid(0)
        grid[0][5] = "red"
        grid[1][4] = "red"
        self.assertEqual(_match_group(grid, 0, 1, 4), [])

    def test_different_colours_do_not_merge(self):
        grid = _empty_grid(0)
        grid[0][4] = "red"
        grid[0][5] = "blue"
        grid[1][4] = "red"
        self.assertEqual(_match_group(grid, 0, 1, 4), [])

    def test_rainbow_adopts_the_commonest_neighbour_colour(self):
        grid = _empty_grid(0)
        grid[0][4] = grid[0][5] = "red"
        grid[1][4] = RAINBOW
        self.assertEqual(len(_match_group(grid, 0, 1, 4)), 3)

    def test_rainbow_with_no_colour_neighbour_does_nothing(self):
        grid = _empty_grid(0)
        grid[0][5] = BOMB
        grid[1][4] = RAINBOW
        self.assertEqual(_match_group(grid, 0, 1, 4), [])

    def test_bomb_never_matches(self):
        grid = _empty_grid(0)
        grid[0][4] = grid[0][5] = BOMB
        grid[1][4] = BOMB
        self.assertEqual(_match_group(grid, 0, 1, 4), [])

    def test_bomb_clears_a_radius(self):
        grid = _empty_grid(0)
        for row in range(3):
            for col in range(len(grid[row])):
                grid[row][col] = "red"
        exploded = _explode_cells(grid, 0, 1, 5)
        self.assertGreater(len(exploded), 3)
        self.assertIn((1, 5), exploded)


class FloatingTest(unittest.TestCase):
    def test_bubbles_hanging_off_the_anchor_fall(self):
        grid = _empty_grid(0)
        grid[0][0] = "red"
        grid[1][0] = "red"
        grid[2][0] = "blue"
        grid[1][0] = None
        self.assertEqual(_floating_cells(grid, 0), [(2, 0)])

    def test_connected_bubbles_stay(self):
        grid = _empty_grid(0)
        grid[0][0] = "red"
        grid[1][0] = "red"
        grid[2][0] = "blue"
        self.assertEqual(_floating_cells(grid, 0), [])

    def test_a_chain_hanging_off_row_zero_stays(self):
        grid = _empty_grid(0)
        for col in range(COLS):
            grid[0][col] = "red"
        grid[1][2] = grid[2][2] = grid[3][2] = "blue"
        self.assertEqual(_floating_cells(grid, 0), [])

    def test_an_island_below_a_full_row_still_falls(self):
        grid = _empty_grid(0)
        for col in range(COLS):
            grid[0][col] = "red"
        grid[3][2] = "blue"
        self.assertEqual(_floating_cells(grid, 0), [(3, 2)])


class ShotTest(unittest.TestCase):
    def setUp(self):
        self.state = make_state(seed=3)
        self.board = self.state["boards"]["p0"]

    def shoot(self, angle):
        return BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": angle})

    def test_angle_must_be_a_number(self):
        _, err = self.shoot("left")
        self.assertIsNotNone(err)

    def test_angle_is_range_checked(self):
        _, err = self.shoot(MAX_ANGLE + 1)
        self.assertIsNotNone(err)

    def test_a_shot_consumes_one_queue_entry(self):
        before = list(self.board["queue"])
        self.shoot(0)
        self.assertNotEqual(self.board["queue"], before)
        self.assertEqual(len(self.board["queue"]), 3)

    def test_a_shot_increments_the_shot_counter(self):
        self.shoot(0)
        self.assertEqual(self.board["shots"], 1)

    def test_three_in_a_row_pops_the_group(self):
        blank(self.board, {(0, 0): "blue", (0, 4): "red", (0, 5): "red"})
        self.board["queue"] = ["red", "red", "red"]
        wave = self.board["wave"]
        events, err = self.shoot(0)
        self.assertIsNone(err)
        shot = self.board["last_shot"]
        self.assertEqual(len(shot["popped"]), 3)
        self.assertIsNone(self.board["grid"][0][4])
        self.assertIsNone(self.board["grid"][0][5])
        self.assertEqual(self.board["grid"][0][0], "blue")
        self.assertEqual(self.board["wave"], wave)
        self.assertEqual(events[0]["type"], "bubble_shooter:shot")

    def test_clearing_the_last_bubble_rolls_into_the_next_wave(self):
        blank(self.board, {(0, 4): "red", (0, 5): "red"})
        self.board["queue"] = ["red", "red", "red"]
        wave = self.board["wave"]
        self.shoot(0)
        self.assertEqual(self.board["wave"], wave + 1)
        self.assertFalse(_board_empty(self.board["grid"]))

    def test_a_miss_resets_the_combo(self):
        blank(self.board, {(0, 5): "red"})
        self.board["queue"] = ["blue", "blue", "blue"]
        self.board["combo"] = 4
        self.shoot(0)
        self.assertEqual(self.board["combo"], 0)

    def test_a_pop_builds_the_combo(self):
        blank(self.board, {(0, 4): "red", (0, 5): "red"})
        self.board["queue"] = ["red", "red", "red"]
        self.shoot(0)
        self.assertEqual(self.board["combo"], 1)

    def test_score_uses_the_combo_multiplier(self):
        blank(self.board, {(0, 4): "red", (0, 5): "red"})
        self.board["queue"] = ["red", "red", "red"]
        self.board["combo"] = 2
        self.shoot(0)
        # three popped at 10 each, times a multiplier of three
        self.assertEqual(self.board["last_shot"]["gain"], 90)

    def test_the_path_is_recorded_for_the_client(self):
        self.shoot(35)
        self.assertGreater(len(self.board["last_shot"]["path"]), 1)

    def test_a_bomb_shot_explodes(self):
        cells = {(0, col): "red" for col in range(4, 8)}
        blank(self.board, cells)
        self.board["queue"] = [BOMB, "red", "red"]
        self.shoot(0)
        self.assertTrue(self.board["last_shot"]["exploded"])

    def test_the_ceiling_pushes_on_schedule(self):
        blank(self.board, {(0, 5): "red"})
        self.board["queue"] = ["red", "red", "red"]
        self.board["push_countdown"] = 1
        self.shoot(0)
        self.assertTrue(self.board["last_shot"]["pushed"])
        self.assertEqual(self.board["top_parity"], 1)
        self.assertEqual(self.board["push_countdown"], self.state["config"]["endless_push_interval"])

    def test_push_can_be_switched_off(self):
        state = make_state(seed=3, endless_push_interval=0)
        board = state["boards"]["p0"]
        blank(board, {(0, 5): "red"})
        board["queue"] = ["red", "red", "red"]
        BubbleShooterGame.apply_action(state, "p0", {"type": "shoot", "angle": 0})
        self.assertFalse(board["last_shot"]["pushed"])


class ItemTest(unittest.TestCase):
    def setUp(self):
        self.state = make_state(seed=5)
        self.board = self.state["boards"]["p0"]

    def test_hammer_removes_the_target(self):
        blank(self.board, {(0, 0): "red", (1, 0): "red"})
        _, err = BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "hammer", "row": 1, "col": 0}
        )
        self.assertIsNone(err)
        self.assertIsNone(self.board["grid"][1][0])

    def test_hammer_drops_what_loses_its_anchor(self):
        blank(self.board, {(0, 0): "red", (1, 0): "red", (2, 0): "blue"})
        BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "hammer", "row": 1, "col": 0}
        )
        self.assertIsNone(self.board["grid"][2][0])
        self.assertEqual(len(self.board["last_shot"]["dropped"]), 1)

    def test_hammer_needs_a_target(self):
        _, err = BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "hammer"}
        )
        self.assertIsNotNone(err)

    def test_hammer_rejects_an_empty_cell(self):
        blank(self.board, {(0, 0): "red"})
        _, err = BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "hammer", "row": 5, "col": 5}
        )
        self.assertIsNotNone(err)

    def test_hammer_spends_a_charge(self):
        blank(self.board, {(0, 0): "red"})
        before = self.board["items"]["hammer"]
        BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "hammer", "row": 0, "col": 0}
        )
        self.assertEqual(self.board["items"]["hammer"], before - 1)

    def test_hammer_runs_out(self):
        blank(self.board, {(0, 0): "red"})
        self.board["items"]["hammer"] = 0
        _, err = BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "hammer", "row": 0, "col": 0}
        )
        self.assertIsNotNone(err)

    def test_aim_grants_the_configured_number_of_shots(self):
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "use_item", "item": "aim"})
        self.assertEqual(self.board["aim_left"], self.state["config"]["aim_shots_per_charge"])

    def test_aim_counts_down_per_shot(self):
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "use_item", "item": "aim"})
        granted = self.board["aim_left"]
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": 0})
        self.assertEqual(self.board["aim_left"], granted - 1)

    def test_unknown_item_is_rejected(self):
        _, err = BubbleShooterGame.apply_action(
            self.state, "p0", {"type": "use_item", "item": "drill"}
        )
        self.assertIsNotNone(err)


class BoardEndTest(unittest.TestCase):
    def setUp(self):
        self.state = make_state(seed=11)
        self.board = self.state["boards"]["p0"]

    def test_clearing_the_board_starts_a_thicker_wave(self):
        blank(self.board)
        wave = self.board["wave"]
        self.assertFalse(_check_board_end(self.board, self.state["config"]))
        self.assertEqual(self.board["wave"], wave + 1)
        self.assertGreater(self.board["score"], 0)
        self.assertFalse(_board_empty(self.board["grid"]))

    def test_waves_grow_until_they_cap(self):
        blank(self.board)
        for _ in range(10):
            blank(self.board)
            _check_board_end(self.board, self.state["config"])
        rows = sum(1 for row in self.board["grid"] if any(cell is not None for cell in row))
        self.assertLessEqual(rows, 7)

    def test_crossing_the_death_row_retires_the_board(self):
        blank(self.board, {(DEATH_ROW, 0): "red"})
        self.assertTrue(_check_board_end(self.board, self.state["config"]))
        self.assertTrue(self.board["game_over"])
        self.assertEqual(self.board["result"], "lose")

    def test_a_retired_board_accepts_no_more_shots(self):
        blank(self.board, {(DEATH_ROW, 0): "red"})
        _check_board_end(self.board, self.state["config"])
        _, err = BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": 0})
        self.assertIsNotNone(err)

    def test_a_retired_board_only_offers_a_restart(self):
        blank(self.board, {(DEATH_ROW, 0): "red"})
        _check_board_end(self.board, self.state["config"])
        self.assertEqual(BubbleShooterGame.get_legal_actions(self.state, "p0"), ["new_game"])


class DeterminismTest(unittest.TestCase):
    def test_the_same_seed_builds_the_same_wave(self):
        first = make_state(seed=99, count=2)
        self.assertEqual(
            first["boards"]["p0"]["grid"], first["boards"]["p1"]["grid"]
        )

    def test_the_same_seed_builds_the_same_queue(self):
        state = make_state(seed=99, count=2)
        self.assertEqual(state["boards"]["p0"]["queue"], state["boards"]["p1"]["queue"])

    def test_a_different_seed_builds_a_different_wave(self):
        first = make_state(seed=1)
        second = make_state(seed=2)
        self.assertNotEqual(first["boards"]["p0"]["grid"], second["boards"]["p0"]["grid"])

    def test_identical_play_scores_identically(self):
        state = make_state(seed=4, count=2)
        for angle in (0, 20, -35, 55, -70):
            for pid in ("p0", "p1"):
                BubbleShooterGame.apply_action(state, pid, {"type": "shoot", "angle": angle})
        first = state["boards"]["p0"]
        second = state["boards"]["p1"]
        self.assertEqual(first["score"], second["score"])
        self.assertEqual(first["grid"], second["grid"])
        self.assertEqual(first["queue"], second["queue"])

    def test_queue_colours_come_from_the_board(self):
        state = make_state(seed=8)
        board = state["boards"]["p0"]
        on_board = set(_colors_on_board(board["grid"]))
        for value in board["queue"]:
            if value in COLORS:
                self.assertIn(value, on_board)


class MultiplayerTest(unittest.TestCase):
    def setUp(self):
        self.state = make_state(seed=21, count=3)

    def test_each_player_owns_a_board(self):
        self.assertEqual(len(self.state["boards"]), 3)
        self.assertEqual(
            {board["player_id"] for board in self.state["boards"].values()},
            {"p0", "p1", "p2"},
        )

    def test_one_player_cannot_touch_another_board(self):
        before = [list(row) for row in self.state["boards"]["p1"]["grid"]]
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": 30})
        self.assertEqual(self.state["boards"]["p1"]["grid"], before)
        self.assertEqual(self.state["boards"]["p1"]["shots"], 0)

    def test_the_match_survives_one_board_going_out(self):
        blank(self.state["boards"]["p0"], {(DEATH_ROW, 0): "red"})
        _check_board_end(self.state["boards"]["p0"], self.state["config"])
        self.assertFalse(_check_match_end(self.state))
        self.assertFalse(self.state["game_over"])

    def test_the_match_ends_when_every_board_is_out(self):
        for pid in ("p0", "p1", "p2"):
            blank(self.state["boards"][pid], {(DEATH_ROW, 0): "red"})
            _check_board_end(self.state["boards"][pid], self.state["config"])
        self.assertTrue(_check_match_end(self.state))
        self.assertTrue(self.state["game_over"])

    def test_the_highest_score_wins(self):
        self.state["boards"]["p0"]["score"] = 10
        self.state["boards"]["p1"]["score"] = 90
        self.state["boards"]["p2"]["score"] = 40
        for pid in ("p0", "p1", "p2"):
            blank(self.state["boards"][pid], {(DEATH_ROW, 0): "red"})
            _check_board_end(self.state["boards"][pid], self.state["config"])
        _check_match_end(self.state)
        self.assertEqual(self.state["winner_ids"], ["p1"])

    def test_a_tie_shares_the_win(self):
        for pid in ("p0", "p1", "p2"):
            self.state["boards"][pid]["score"] = 50
            blank(self.state["boards"][pid], {(DEATH_ROW, 0): "red"})
            _check_board_end(self.state["boards"][pid], self.state["config"])
        _check_match_end(self.state)
        self.assertEqual(set(self.state["winner_ids"]), {"p0", "p1", "p2"})

    def test_ranking_is_sorted_by_score(self):
        self.state["boards"]["p0"]["score"] = 10
        self.state["boards"]["p1"]["score"] = 90
        self.state["boards"]["p2"]["score"] = 40
        view = BubbleShooterGame.get_public_view(self.state, "p0")
        self.assertEqual([row["player_id"] for row in view["ranking"]], ["p1", "p2", "p0"])
        self.assertEqual([row["rank"] for row in view["ranking"]], [1, 2, 3])

    def test_ranking_marks_retired_boards(self):
        blank(self.state["boards"]["p1"], {(DEATH_ROW, 0): "red"})
        _check_board_end(self.state["boards"]["p1"], self.state["config"])
        view = BubbleShooterGame.get_public_view(self.state, "p0")
        flags = {row["player_id"]: row["out"] for row in view["ranking"]}
        self.assertTrue(flags["p1"])
        self.assertFalse(flags["p0"])

    def test_a_view_only_carries_the_viewers_board(self):
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": 0})
        view = BubbleShooterGame.get_public_view(self.state, "p1")
        self.assertEqual(view["grid"], self.state["boards"]["p1"]["grid"])
        self.assertNotIn("boards", view)
        self.assertEqual(view["player_count"], 3)

    def test_legal_actions_are_per_player(self):
        blank(self.state["boards"]["p1"], {(DEATH_ROW, 0): "red"})
        _check_board_end(self.state["boards"]["p1"], self.state["config"])
        self.assertIn("shoot", BubbleShooterGame.get_legal_actions(self.state, "p0"))
        self.assertNotIn("shoot", BubbleShooterGame.get_legal_actions(self.state, "p1"))

    def test_no_actions_after_the_match_ends(self):
        for pid in ("p0", "p1", "p2"):
            blank(self.state["boards"][pid], {(DEATH_ROW, 0): "red"})
            _check_board_end(self.state["boards"][pid], self.state["config"])
        _check_match_end(self.state)
        self.assertEqual(
            sorted(BubbleShooterGame.get_legal_actions(self.state, "p0")),
            ["new_game", "play_again"],
        )

    def test_a_stranger_gets_an_empty_board(self):
        view = BubbleShooterGame.get_public_view(self.state, "ghost")
        self.assertEqual(view["grid"], [])
        self.assertTrue(view["board_out"])
        self.assertEqual(view["legal_actions"], [])

    def test_too_many_players_is_rejected(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({}, make_players(BubbleShooterGame.max_players + 1))

    def test_no_players_is_rejected(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({}, [])

    def test_play_again_rebuilds_every_board(self):
        for pid in ("p0", "p1", "p2"):
            blank(self.state["boards"][pid], {(DEATH_ROW, 0): "red"})
            _check_board_end(self.state["boards"][pid], self.state["config"])
        _check_match_end(self.state)
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "play_again"})
        self.assertFalse(self.state["game_over"])
        for pid in ("p0", "p1", "p2"):
            self.assertFalse(self.state["boards"][pid]["game_over"])
            self.assertEqual(self.state["boards"][pid]["score"], 0)

    def test_play_again_needs_a_finished_match(self):
        _, err = BubbleShooterGame.apply_action(self.state, "p0", {"type": "play_again"})
        self.assertIsNotNone(err)

    def test_new_game_restarts_mid_match(self):
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": 0})
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "new_game"})
        self.assertEqual(self.state["boards"]["p0"]["shots"], 0)
        self.assertEqual(self.state["boards"]["p0"]["score"], 0)

    def test_restarting_keeps_the_seed(self):
        original = [list(row) for row in self.state["boards"]["p0"]["grid"]]
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "shoot", "angle": 0})
        BubbleShooterGame.apply_action(self.state, "p0", {"type": "new_game"})
        self.assertEqual(self.state["boards"]["p0"]["grid"], original)


class ConfigTest(unittest.TestCase):
    def test_defaults_are_accepted(self):
        state = make_state()
        self.assertEqual(state["config"]["endless_colors"], 4)

    def test_unknown_keys_are_rejected(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({"nope": 1}, make_players(1))

    def test_colour_count_is_validated(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({"endless_colors": 9}, make_players(1))

    def test_push_interval_is_validated(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({"endless_push_interval": 5}, make_players(1))

    def test_item_charges_are_validated(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({"hammer_charges": 4}, make_players(1))

    def test_non_integer_seed_is_rejected(self):
        with self.assertRaises(ValueError):
            BubbleShooterGame.init_game({"seed": "x"}, make_players(1))

    def test_palette_follows_the_colour_setting(self):
        state = make_state(endless_colors=3)
        self.assertEqual(len(state["boards"]["p0"]["palette"]), 3)

    def test_zero_charges_start_empty(self):
        state = make_state(hammer_charges=0, aim_charges=0)
        self.assertEqual(state["boards"]["p0"]["items"], {"hammer": 0, "aim": 0})


class SerializationTest(unittest.TestCase):
    def test_round_trip_preserves_every_board(self):
        state = make_state(seed=13, count=2)
        BubbleShooterGame.apply_action(state, "p0", {"type": "shoot", "angle": 25})
        restored = BubbleShooterGame.deserialize(BubbleShooterGame.serialize(state))
        self.assertEqual(restored["boards"]["p0"]["grid"], state["boards"]["p0"]["grid"])
        self.assertEqual(restored["boards"]["p1"]["queue"], state["boards"]["p1"]["queue"])

    def test_round_trip_is_a_deep_copy(self):
        state = make_state(seed=13)
        original = state["boards"]["p0"]["grid"][0][0]
        self.assertIsNotNone(original)
        restored = BubbleShooterGame.deserialize(BubbleShooterGame.serialize(state))
        restored["boards"]["p0"]["grid"][0][0] = "purple"
        self.assertEqual(state["boards"]["p0"]["grid"][0][0], original)
        self.assertNotEqual(restored["boards"]["p0"]["grid"][0][0], original)

    def test_a_restored_match_still_accepts_actions(self):
        state = make_state(seed=13)
        restored = BubbleShooterGame.deserialize(BubbleShooterGame.serialize(state))
        _, err = BubbleShooterGame.apply_action(restored, "p0", {"type": "shoot", "angle": 0})
        self.assertIsNone(err)


class BotTest(unittest.TestCase):
    """The strategy itself is covered by tests/test_bubble_shooter_ai.py."""

    def test_the_bot_returns_a_known_action(self):
        state = make_state(seed=17, count=2)
        action = BubbleShooterGame.bot_move(state, "p1")
        self.assertIn(action["type"], ("shoot", "use_item"))

    def test_the_bot_action_is_accepted(self):
        state = make_state(seed=17, count=2)
        action = BubbleShooterGame.bot_move(state, "p1")
        _, err = BubbleShooterGame.apply_action(state, "p1", action)
        self.assertIsNone(err)
        board = state["boards"]["p1"]
        self.assertEqual(board["shots"] + (0 if board["items"]["hammer"] == 3 else 1), 1)

    def test_the_bot_only_touches_its_own_board(self):
        state = make_state(seed=17, count=2)
        before = [list(row) for row in state["boards"]["p0"]["grid"]]
        BubbleShooterGame.apply_action(state, "p1", BubbleShooterGame.bot_move(state, "p1"))
        self.assertEqual(state["boards"]["p0"]["grid"], before)

    def test_the_bot_is_deterministic(self):
        first = make_state(seed=17, count=2)
        second = make_state(seed=17, count=2)
        self.assertEqual(
            BubbleShooterGame.bot_move(first, "p1"),
            BubbleShooterGame.bot_move(second, "p1"),
        )

    def test_an_out_board_stops_the_bot(self):
        state = make_state(seed=17)
        blank(state["boards"]["p0"], {(DEATH_ROW, 0): "red"})
        _check_board_end(state["boards"]["p0"], state["config"])
        self.assertIsNone(BubbleShooterGame.bot_move(state, "p0"))

    def test_a_stranger_gets_no_bot_move(self):
        state = make_state(seed=17)
        self.assertIsNone(BubbleShooterGame.bot_move(state, "ghost"))

    def test_the_bot_survives_a_long_run(self):
        state = make_state(seed=17, count=2)
        for _ in range(40):
            for pid in ("p0", "p1"):
                action = BubbleShooterGame.bot_move(state, pid)
                if action is None:
                    continue
                _, err = BubbleShooterGame.apply_action(state, pid, action)
                self.assertIsNone(err)


class HelperTest(unittest.TestCase):
    def test_lowest_row_of_an_empty_board(self):
        self.assertEqual(_lowest_row(_empty_grid(0)), -1)

    def test_board_empty_detects_a_single_bubble(self):
        grid = _empty_grid(0)
        grid[4][2] = "red"
        self.assertFalse(_board_empty(grid))

    def test_colors_on_board_is_ordered(self):
        grid = _empty_grid(0)
        grid[0][0] = "purple"
        grid[0][1] = "red"
        self.assertEqual(_colors_on_board(grid), ["red", "purple"])

    def test_occupied_lists_every_bubble_with_its_centre(self):
        grid = _empty_grid(0)
        grid[0][0] = "red"
        cells = _occupied(grid, 0)
        self.assertEqual(len(cells), 1)
        row, col, x, y = cells[0]
        self.assertEqual((row, col), (0, 0))
        self.assertAlmostEqual(x, 0.5)
        self.assertAlmostEqual(y, ROW_HEIGHT / 2)


if __name__ == "__main__":
    unittest.main()
