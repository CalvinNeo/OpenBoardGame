import argparse
import json
import math
import random
import statistics
import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Dict, List, Tuple
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.manila import ManilaGame as Game, _roll_and_move


def load_baseline(revision: str) -> Callable:
    source = subprocess.check_output(["git", "show", f"{revision}:game/manila.py"], cwd=ROOT, text=True)
    namespace = {"__file__": str(ROOT / "game" / "manila.py")}
    exec(compile(source, f"{revision}:game/manila.py", "exec"), namespace)
    return namespace["ManilaGame"].bot_move


def play_game(count: int, seed: int, candidate_seat: int, baseline: Callable) -> Tuple[Dict, List[float]]:
    initialization_random = random.Random(seed)
    players = [{"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat, "is_bot": True}
               for seat in range(count)]
    with patch("game.manila.random.shuffle", initialization_random.shuffle), patch("game.manila.random.choice", initialization_random.choice):
        state = Game.init_game({}, players)
    decision_random = random.Random(seed * 1009 + candidate_seat)

    def roll_and_move(current_state, day):
        dice = []
        for cargo_id, boat in current_state["boats"].items():
            if boat.get("skip_roll") or boat.get("plundered") or boat.get("arrived"):
                continue
            generator = random.Random(f"{seed}:{current_state['round']}:{day}:{cargo_id}")
            dice.append(generator.randint(1, 6))
        with patch("game.manila.random.randint", side_effect=dice):
            return _roll_and_move(current_state, day)

    timings = []
    candidate_id = f"p{candidate_seat}"
    with patch("game.manila._roll_and_move", side_effect=roll_and_move):
        for step in range(3000):
            if state["game_over"]:
                scores = {player_id: player["cash"] + sum(
                    player["stocks"][cargo_id] * state["price_track"][cargo_id]
                    - player["pledged"][cargo_id] * state["config"]["loan_repay"]
                    for cargo_id in state["price_track"]
                ) for player_id, player in state["players"].items()}
                return {
                    "players": count, "seed": seed, "seat": candidate_seat,
                    "win_credit": 1 / len(state["winner"]) if candidate_id in state["winner"] else 0,
                    "score": scores[candidate_id],
                    "opponent_score": statistics.mean(score for player_id, score in scores.items() if player_id != candidate_id),
                    "pledges": sum(state["players"][candidate_id]["pledged"].values()),
                }, timings
            player_id = state["current_player"]
            if state["phase"] == "round_end":
                player_id = next(player_id for player_id in state["turn_order"]
                                 if not state["players"][player_id]["round_ready"])
            started = time.perf_counter()
            if player_id == candidate_id:
                action = Game.bot_move(state, player_id)
                timings.append((time.perf_counter() - started) * 1000)
            else:
                with patch("random.random", decision_random.random), patch("random.choice", decision_random.choice), patch("random.sample", decision_random.sample), patch("random.shuffle", decision_random.shuffle):
                    action = baseline(state, player_id)
            if action is None:
                raise AssertionError((count, seed, candidate_seat, step, state["phase"], "stalled"))
            _, error = Game.apply_action(state, player_id, action)
            if error:
                raise AssertionError((count, seed, candidate_seat, step, action, error))
    raise AssertionError((count, seed, candidate_seat, "action limit exceeded"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-ref", default="349edd89fc56fc611ccc84b6128c1398967113bc")
    parser.add_argument("--seeds", type=int, default=10)
    parser.add_argument("--seed-start", type=int, default=0)
    parser.add_argument("--counts", nargs="+", type=int, choices=(3, 4, 5), default=[3, 4, 5])
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    if args.seeds <= 0:
        parser.error("--seeds must be positive")
    baseline = load_baseline(args.baseline_ref)
    records, reports = [], []
    for count in args.counts:
        results, timings = [], []
        for seed in range(args.seed_start, args.seed_start + args.seeds):
            for seat in range(count):
                result, samples = play_game(count, seed, seat, baseline)
                results.append(result)
                timings.extend(samples)
        timings.sort()
        report = {
            "players": count, "games": len(results), "equal_strength_win_share": round(1 / count, 4),
            "candidate_win_share": round(statistics.mean(result["win_credit"] for result in results), 4),
            "candidate_mean_score": round(statistics.mean(result["score"] for result in results), 2),
            "opponent_mean_score": round(statistics.mean(result["opponent_score"] for result in results), 2),
            "candidate_mean_pledges": round(statistics.mean(result["pledges"] for result in results), 2),
            "mean_ms": round(statistics.mean(timings), 2),
            "p95_ms": round(timings[math.ceil(len(timings) * 0.95) - 1], 2), "max_ms": round(max(timings), 2),
        }
        reports.append(report)
        records.extend(results)
        print(json.dumps(report), flush=True)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps({"baseline_ref": args.baseline_ref, "reports": reports, "games": records}, indent=2) + "\n")


if __name__ == "__main__":
    main()
