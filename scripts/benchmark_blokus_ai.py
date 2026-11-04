import argparse
import itertools
import statistics
import sys
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.blokus import (
    BOT_STRATEGY_HEURISTIC,
    BOT_STRATEGY_TERRITORY,
    PIECE_SIZES,
    BlokusGame,
)


STRATEGIES = (BOT_STRATEGY_HEURISTIC, BOT_STRATEGY_TERRITORY)


def _players() -> List[Dict]:
    return [
        {
            "player_id": f"p{seat + 1}",
            "name": f"Player {seat + 1}",
            "seat": seat,
            "is_bot": True,
        }
        for seat in range(4)
    ]


def _play_match(
    strategy_a: str,
    strategy_b: str,
    seats_a: Tuple[int, ...],
) -> Dict:
    state = BlokusGame.init_game({"bot_strategy": strategy_b}, _players())
    strategy_by_player = {
        f"p{seat + 1}": strategy_a if seat in seats_a else strategy_b
        for seat in range(4)
    }

    turns = 0
    while not state["game_over"]:
        player_id = state["current_turn"]
        state["config"]["bot_strategy"] = strategy_by_player[player_id]
        action = BlokusGame.bot_move(state, player_id)
        if action is None:
            raise RuntimeError(f"Bot returned no action for {player_id}")
        _events, error = BlokusGame.apply_action(state, player_id, action)
        if error:
            raise RuntimeError(f"Bot produced an illegal move for {player_id}: {error}")
        turns += 1
        if turns > 120:
            raise RuntimeError("Blokus match exceeded the turn limit")

    remaining_cells = {
        player_id: sum(PIECE_SIZES[piece_id] for piece_id in pdata["pieces"])
        for player_id, pdata in state["players"].items()
    }
    return {
        "seats_a": seats_a,
        "scores": state["scores"],
        "remaining_cells": remaining_cells,
        "winners": state["winner"],
        "turns": turns,
    }


def _summarize(matches: List[Dict], strategy: str, seats_per_match: int) -> Dict:
    scores = []
    remaining_cells = []
    win_credit = 0.0
    for match in matches:
        seats_a = set(match["seats_a"])
        for seat in range(4):
            is_a = seat in seats_a
            if (strategy == "a") != is_a:
                continue
            player_id = f"p{seat + 1}"
            scores.append(match["scores"][player_id])
            remaining_cells.append(match["remaining_cells"][player_id])
            if player_id in match["winners"]:
                win_credit += 1.0 / len(match["winners"])

    player_count = len(matches) * seats_per_match
    return {
        "mean_score": round(statistics.mean(scores), 3),
        "mean_remaining_cells": round(statistics.mean(remaining_cells), 3),
        "win_credit_per_player": round(win_credit / player_count, 3),
        "match_win_credit": round(win_credit / len(matches), 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seat-balanced Blokus bot comparison on the fixed standard board."
    )
    parser.add_argument("--a", choices=STRATEGIES, default=BOT_STRATEGY_TERRITORY)
    parser.add_argument("--b", choices=STRATEGIES, default=BOT_STRATEGY_HEURISTIC)
    parser.add_argument(
        "--a-count", type=int, default=2, help="Number of strategy A bots per match."
    )
    args = parser.parse_args()
    if not 1 <= args.a_count <= 3:
        parser.error("--a-count must be 1, 2, or 3")

    seat_layouts = list(itertools.combinations(range(4), args.a_count))
    matches = [_play_match(args.a, args.b, seats_a) for seats_a in seat_layouts]
    print({"strategy_a": args.a, "strategy_b": args.b, "matches": matches})
    print(
        {
            "strategy_a_summary": _summarize(matches, "a", args.a_count),
            "strategy_b_summary": _summarize(matches, "b", 4 - args.a_count),
        }
    )


if __name__ == "__main__":
    main()
