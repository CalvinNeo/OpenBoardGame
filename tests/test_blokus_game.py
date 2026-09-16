import copy
import unittest

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
