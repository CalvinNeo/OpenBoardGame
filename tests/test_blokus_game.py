import copy
import unittest
from unittest.mock import patch

import game.blokus as blokus
from game.blokus import BlokusGame


class BlokusGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {
                "player_id": f"p{seat + 1}",
                "name": f"Player {seat + 1}",
                "seat": seat,
                "is_bot": True,
            }
            for seat in range(4)
        ]

    @staticmethod
    def _first_legal_action(state, player_id):
        player = state["players"][player_id]
        first_move = not player["has_placed"]
        for piece_id in player["pieces"]:
            for action, _cells in blokus._iter_piece_moves(
                state, player_id, piece_id, first_move
            ):
                return action
        return {"type": "give_up"}

    def test_bot_opens_with_an_inward_pentomino(self):
        state = BlokusGame.init_game({}, self._players())
        original = copy.deepcopy(state)
        progress = []

        action = BlokusGame.bot_move(
            state,
            "p1",
            progress_callback=lambda stage, value, detail: progress.append(
                (stage, value, detail)
            ),
        )

        self.assertEqual(state, original)
        self.assertIsNotNone(action)
        self.assertEqual(blokus.PIECE_SIZES[action["piece_id"]], 5)
        shape = blokus._transform_piece(
            blokus.PIECE_DEFS[action["piece_id"]],
            action["rotation"],
            action["flip"],
        )
        cells = [(action["x"] + x, action["y"] + y) for x, y in shape]
        self.assertIn((0, 0), cells)
        self.assertGreaterEqual(max(min(x, y) for x, y in cells), 2)
        self.assertEqual(progress[-1][0], "selected")

        _events, error = BlokusGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        self.assertEqual(len(state["players"]["p1"]["pieces"]), 20)

    def test_bot_returns_give_up_when_no_piece_can_be_placed(self):
        state = BlokusGame.init_game({}, self._players())
        state["board"] = [
            ["yellow" for _x in range(blokus.BOARD_SIZE)]
            for _y in range(blokus.BOARD_SIZE)
        ]

        action = BlokusGame.bot_move(state, "p1")

        self.assertEqual(action, {"type": "give_up"})

    def test_blokus_strategy_defaults_to_heuristic_and_accepts_territory(self):
        heuristic_state = BlokusGame.init_game({}, self._players())
        territory_state = BlokusGame.init_game(
            {"bot_strategy": "territory"}, self._players()
        )

        self.assertEqual(
            heuristic_state["config"]["bot_strategy"], blokus.BOT_STRATEGY_HEURISTIC
        )
        self.assertEqual(
            territory_state["config"]["bot_strategy"], blokus.BOT_STRATEGY_TERRITORY
        )

    def test_both_strategies_deep_evaluate_global_top_candidates(self):
        candidates = [
            (
                1000 - index,
                {
                    "piece_id": "p5_1",
                    "rotation": 0,
                    "flip": False,
                    "x": index,
                    "y": 0,
                },
                ((0, 0),),
            )
            for index in range(25)
        ]
        candidates.extend(
            (
                100 - index,
                {
                    "piece_id": piece_id,
                    "rotation": 0,
                    "flip": False,
                    "x": 0,
                    "y": index + 1,
                },
                ((0, 0),),
            )
            for index, piece_id in enumerate(blokus.PIECE_IDS)
            if piece_id != "p5_1"
        )

        heuristic_shortlist = blokus._bot_candidate_shortlist(
            candidates, 24, blokus.BOT_STRATEGY_HEURISTIC
        )
        territory_shortlist = blokus._bot_candidate_shortlist(
            candidates, 24, blokus.BOT_STRATEGY_TERRITORY
        )

        self.assertEqual(len(heuristic_shortlist), 24)
        self.assertEqual(
            {candidate[1]["piece_id"] for candidate in heuristic_shortlist}, {"p5_1"}
        )
        self.assertEqual(
            {candidate[1]["piece_id"] for candidate in territory_shortlist},
            {"p5_1"},
        )

    def test_next_opponent_largest_move_size_uses_real_legal_moves(self):
        state = BlokusGame.init_game({"bot_strategy": "territory"}, self._players())
        self.assertEqual(
            blokus._next_opponent_largest_move_size(state, "p1", state["board"]), 5
        )

        board = [
            ["blocked" for _x in range(blokus.BOARD_SIZE)]
            for _y in range(blokus.BOARD_SIZE)
        ]
        p2_corner = blokus.CORNER_BY_COLOR["yellow"]
        board[p2_corner[1]][p2_corner[0]] = None
        self.assertEqual(blokus._next_opponent_largest_move_size(state, "p1", board), 1)

        state["players"]["p2"]["passed"] = True
        board[p2_corner[1]][p2_corner[0]] = "blue"
        p3_corner = blokus.CORNER_BY_COLOR["red"]
        board[p3_corner[1]][p3_corner[0]] = None
        self.assertEqual(blokus._next_opponent_largest_move_size(state, "p1", board), 1)

    def test_territory_pressure_scores_reduction_in_largest_opponent_piece(self):
        state = BlokusGame.init_game({"bot_strategy": "territory"}, self._players())
        board = [
            ["blocked" for _x in range(blokus.BOARD_SIZE)]
            for _y in range(blokus.BOARD_SIZE)
        ]
        p2_corner = blokus.CORNER_BY_COLOR["yellow"]
        board[p2_corner[1]][p2_corner[0]] = None

        blocked_pressure = blokus._next_opponent_pressure(
            state, "p1", board, baseline_largest_piece=5
        )
        with patch(
            "game.blokus._next_opponent_largest_move_size", return_value=5
        ):
            open_pressure = blokus._next_opponent_pressure(
                state, "p1", state["board"], baseline_largest_piece=5
            )

        self.assertEqual(
            blocked_pressure,
            4 * blokus.BOT_OPPONENT_BLOCK_SCORE_PER_CELL,
        )
        self.assertEqual(open_pressure, 0.0)
        with patch(
            "game.blokus._next_opponent_largest_move_size", return_value=5
        ):
            opened_larger_piece = blokus._next_opponent_pressure(
                state, "p1", state["board"], baseline_largest_piece=4
            )
        self.assertEqual(
            opened_larger_piece, -blokus.BOT_OPPONENT_BLOCK_SCORE_PER_CELL
        )

    def test_territory_strategy_uses_a_calibrated_territory_weight(self):
        state = BlokusGame.init_game({}, self._players())
        action = self._first_legal_action(state, "p1")
        shape = blokus._transform_piece(
            blokus.PIECE_DEFS[action["piece_id"]], action["rotation"], action["flip"]
        )
        cells = tuple((action["x"] + x, action["y"] + y) for x, y in shape)
        with patch("game.blokus._territory_area_score", return_value=10.0), patch(
            "game.blokus._next_opponent_largest_move_size", return_value=5
        ):
            territory_score = blokus._deep_candidate_score(
                state,
                "p1",
                action["piece_id"],
                cells,
                strategy="territory",
                baseline_largest_opponent_piece=5,
            )
            heuristic_score = blokus._deep_candidate_score(
                state, "p1", action["piece_id"], cells, strategy="heuristic"
            )

        self.assertAlmostEqual(
            territory_score - heuristic_score,
            10.0
            * 0.34
            * (blokus.BOT_TERRITORY_WEIGHT_MULTIPLIER - 1.0),
        )

    def test_territory_scores_opponent_pressure_without_changing_heuristic(self):
        state = BlokusGame.init_game({}, self._players())
        action = self._first_legal_action(state, "p1")
        shape = blokus._transform_piece(
            blokus.PIECE_DEFS[action["piece_id"]], action["rotation"], action["flip"]
        )
        cells = tuple((action["x"] + x, action["y"] + y) for x, y in shape)

        with patch(
            "game.blokus._next_opponent_largest_move_size", return_value=1
        ):
            territory_blocked = blokus._deep_candidate_score(
                state,
                "p1",
                action["piece_id"],
                cells,
                strategy="territory",
                baseline_largest_opponent_piece=5,
            )
            heuristic_blocked = blokus._deep_candidate_score(
                state, "p1", action["piece_id"], cells, strategy="heuristic"
            )
        with patch(
            "game.blokus._next_opponent_largest_move_size", return_value=5
        ):
            territory_open = blokus._deep_candidate_score(
                state,
                "p1",
                action["piece_id"],
                cells,
                strategy="territory",
                baseline_largest_opponent_piece=5,
            )
            heuristic_open = blokus._deep_candidate_score(
                state, "p1", action["piece_id"], cells, strategy="heuristic"
            )

        self.assertAlmostEqual(
            territory_blocked - territory_open,
            4 * blokus.BOT_OPPONENT_BLOCK_SCORE_PER_CELL,
        )
        self.assertEqual(heuristic_blocked, heuristic_open)

    def test_candidate_shortlist_keeps_each_piece_represented(self):
        candidates = []
        next_x = 0
        dominant_piece_id = blokus.PIECE_IDS[-1]
        for index in range(30):
            candidates.append(
                (
                    1000 - index,
                    {
                        "type": "place_piece",
                        "piece_id": dominant_piece_id,
                        "rotation": 0,
                        "flip": False,
                        "x": next_x,
                        "y": 0,
                    },
                    ((next_x, 0),),
                )
            )
            next_x += 1
        for piece_id in blokus.PIECE_IDS[:-1]:
            candidates.append(
                (
                    100 + blokus.PIECE_SIZES[piece_id],
                    {
                        "type": "place_piece",
                        "piece_id": piece_id,
                        "rotation": 0,
                        "flip": False,
                        "x": next_x,
                        "y": 0,
                    },
                    ((next_x, 0),),
                )
            )
            next_x += 1

        shortlist = blokus._shortlist_candidates(candidates, 24)
        narrow_shortlist = blokus._shortlist_candidates(candidates, 1)

        self.assertEqual(len(shortlist), 24)
        self.assertEqual(
            {
                action["piece_id"]
                for _score, action, _cells in shortlist
            },
            set(blokus.PIECE_IDS),
        )
        self.assertEqual(narrow_shortlist[0][1]["piece_id"], dominant_piece_id)

    def test_optimized_bot_outplays_first_legal_policy(self):
        state = BlokusGame.init_game({}, self._players())
        optimized_player = "p1"

        for _turn in range(120):
            if state["game_over"]:
                break
            player_id = state["current_turn"]
            if player_id == optimized_player:
                action = BlokusGame.bot_move(state, player_id)
            else:
                action = self._first_legal_action(state, player_id)
            self.assertIsNotNone(action)
            _events, error = BlokusGame.apply_action(state, player_id, action)
            self.assertIsNone(error)

        self.assertTrue(state["game_over"])
        optimized_score = state["scores"][optimized_player]
        opponent_scores = [
            score
            for player_id, score in state["scores"].items()
            if player_id != optimized_player
        ]
        self.assertGreater(optimized_score, max(opponent_scores))
        self.assertGreaterEqual(optimized_score, 0)


if __name__ == "__main__":
    unittest.main()
