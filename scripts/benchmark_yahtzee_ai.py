"""Deterministic complete-game comparison of the original and DP Yahtzee bots."""

import argparse
import json
import random
import statistics
import sys
import time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.yahtzee import YahtzeeGame, _total_score


def benchmark(strategy: str, games: int, seed: int) -> dict:
    scores, times = [], []
    for game in range(games):
        dice_rng = random.Random(seed + game)
        decision_rng = random.Random(seed + game + 1_000_000)
        state = YahtzeeGame.init_game({"bot_strategy": strategy}, [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
        ])
        # Isolate the original bot's random decisions from the dice stream.
        with patch("game.yahtzee._roll_die", side_effect=lambda: dice_rng.randint(1, 6)), \
                patch("game.yahtzee.random.random", side_effect=decision_rng.random):
            for _ in range(13 * 14):
                if state["game_over"]:
                    break
                started = time.perf_counter()
                action = YahtzeeGame.bot_move(state, "bot")
                times.append((time.perf_counter() - started) * 1000)
                if action is None:
                    raise AssertionError(f"{strategy}: bot stalled")
                _, error = YahtzeeGame.apply_action(state, "bot", action)
                if error:
                    raise AssertionError((strategy, action, error))
            if not state["game_over"]:
                raise AssertionError(f"{strategy}: game did not finish")
        scores.append(_total_score(state["players"]["bot"]))
    ordered_times = sorted(times)
    return {
        "games": games,
        "mean_score": round(statistics.mean(scores), 3),
        "median_score": statistics.median(scores),
        "score_standard_error": round(statistics.stdev(scores) / games ** 0.5, 3) if games > 1 else 0,
        "min_score": min(scores),
        "max_score": max(scores),
        "move_ms_mean": round(statistics.mean(times), 3),
        "move_ms_p95": round(ordered_times[int(0.95 * (len(times) - 1))], 3),
        "move_ms_max": round(max(times), 3),
        "scores": scores,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--games", type=int, default=300)
    parser.add_argument("--seed", type=int, default=20260929)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.games < 1:
        parser.error("--games must be positive")
    result = {"seed": args.seed}
    for strategy in ("classic", "dynamic_programming"):
        result[strategy] = benchmark(strategy, args.games, args.seed)
        print(strategy, json.dumps({key: value for key, value in result[strategy].items() if key != "scores"}))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
