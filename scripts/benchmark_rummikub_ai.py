"""Seat-balanced Rummikub search comparison against the original greedy policy."""

import argparse
import json
import math
import statistics
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.rummikub import RummikubGame, _greedy_layout, validate_table


def baseline_move(state: Dict, player_id: str) -> Dict:
    table = _greedy_layout(state, player_id)
    if validate_table(state, player_id, table) is None:
        return {"type": "commit", "turn": state["turn"], "table": table}
    return {"type": "draw", "turn": state["turn"]}


def play_game(count: int, seed: int, new_seat: int) -> Tuple[Dict, List[float]]:
    players = [{"player_id": f"p{seat}", "name": f"Bot {seat}", "seat": seat, "is_bot": True}
               for seat in range(count)]
    state = RummikubGame.init_game({"seed": seed}, players)
    timings = []
    upgraded = f"p{new_seat}"
    for turns in range(650):
        if state["game_over"]:
            return {
                "players": count, "seed": seed, "new_seat": new_seat, "turns": turns,
                "new_win_credit": 1 / len(state["winner"]) if upgraded in state["winner"] else 0,
                "new_score": state["players"][upgraded]["score"],
                "blocked": state["round_result"]["blocked"],
            }, timings
        actor = state["turn_order"][state["turn_index"]]
        if actor == upgraded:
            started = time.perf_counter()
            action = RummikubGame.bot_move(state, actor)
            timings.append((time.perf_counter() - started) * 1000)
        else:
            action = baseline_move(state, actor)
        _, error = RummikubGame.apply_action(state, actor, action)
        if error:
            raise AssertionError((count, seed, new_seat, actor, action, error))
    raise AssertionError((count, seed, new_seat, "turn limit exceeded"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=12)
    parser.add_argument("--seed-start", type=int, default=0)
    parser.add_argument("--players", type=int, nargs="+", choices=(2, 3, 4), default=[2, 3, 4])
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    if args.seeds < 1:
        parser.error("--seeds must be positive")
    records, timings = [], []
    for count in args.players:
        for seed in range(args.seed_start, args.seed_start + args.seeds):
            for seat in range(count):
                record, elapsed = play_game(count, seed, seat)
                records.append(record)
                timings.extend(elapsed)
        rows = [record for record in records if record["players"] == count]
        print(json.dumps({
            "players": count, "games": len(rows), "random_seat_share": round(1 / count, 4),
            "new_win_share": round(statistics.mean(record["new_win_credit"] for record in rows), 4),
            "new_mean_score": round(statistics.mean(record["new_score"] for record in rows), 3),
            "blocked": sum(record["blocked"] for record in rows),
        }), flush=True)
    ordered = sorted(timings)
    latency = {"decisions": len(timings), "mean_ms": round(statistics.mean(timings), 3),
               "p95_ms": round(ordered[math.ceil(len(ordered) * 0.95) - 1], 3),
               "max_ms": round(max(timings), 3)}
    print(json.dumps({"latency": latency}), flush=True)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps({"records": records, "latency": latency}, indent=2) + "\n")


if __name__ == "__main__":
    main()
