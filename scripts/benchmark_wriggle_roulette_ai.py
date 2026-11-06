"""Seat-balanced comparison against the original Wriggle Roulette policy."""

import argparse
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Dict, List
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from game.wriggle_roulette import WriggleRouletteGame as Game


def baseline(view: Dict) -> Dict:
    """Frozen original fixed-threshold policy, using public information only."""
    player = next(item for item in view["players"] if item["player_id"] == view["you"])
    saved = player["round_eels"]
    danger = view["outbreak_threshold"] - view["center_snakes"]
    maximum = view["grab_max"]
    ratio = view["bag_snakes"] / max(1, view["bag_count"])
    if saved >= 5 or (saved >= 3 and danger <= 2):
        count = 0
    elif danger <= 1:
        count = 1
    elif ratio >= 0.34:
        count = min(2, maximum)
    elif saved == 0:
        count = min(4, maximum)
    else:
        count = min(3, maximum)
    return {"type": "grab", "count": count, "cycle_no": view["cycle_no"]}


def play_game(count: int, seed: int, new_seat: int, timings: List[float]) -> Dict:
    players = [
        {"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat, "is_bot": True}
        for seat in range(count)
    ]
    with patch("game.wriggle_roulette._new_private_seed", return_value=f"benchmark:{seed}"):
        state = Game.init_game({}, players)
    new_id = f"p{new_seat}"
    for actions in range(5000):
        if state["game_over"]:
            return {
                "seed": seed,
                "new_seat": new_seat,
                "win_credit": 1 / len(state["winner_ids"]) if new_id in state["winner_ids"] else 0,
                "score": state["players"][new_id]["score"],
                "rounds": state["round_no"],
                "actions": actions,
            }
        player_id = state["current_player_id"]
        if player_id == new_id:
            started = time.perf_counter()
            action = Game.bot_move(state, player_id)
            timings.append((time.perf_counter() - started) * 1000)
        else:
            action = baseline(Game.get_public_view(state, player_id))
        if action is None:
            raise AssertionError((count, seed, new_seat, "bot returned no action"))
        _, error = Game.apply_action(state, player_id, action)
        if error:
            raise AssertionError((count, seed, new_seat, action, error))
    raise AssertionError((count, seed, new_seat, "game exceeded action limit"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=10)
    parser.add_argument("--seed-start", type=int, default=20261105)
    parser.add_argument("--counts", type=int, nargs="+", default=[2, 4, 8])
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    if args.seeds < 1 or any(count not in range(2, 9) for count in args.counts):
        parser.error("Use positive --seeds and --counts between 2 and 8")
    reports = []
    for count in args.counts:
        records, timings = [], []
        for seed in range(args.seed_start, args.seed_start + args.seeds):
            for new_seat in range(count):
                records.append(play_game(count, seed, new_seat, timings))
        ordered = sorted(timings)
        report = {
            "players": count,
            "games": len(records),
            "new_win_share": round(statistics.mean(record["win_credit"] for record in records), 4),
            "equal_strength_share": round(1 / count, 4),
            "mean_score": round(statistics.mean(record["score"] for record in records), 3),
            "move_ms_mean": round(statistics.mean(timings), 3),
            "move_ms_p95": round(ordered[int(0.95 * (len(ordered) - 1))], 3),
            "move_ms_max": round(max(timings), 3),
        }
        print(json.dumps(report), flush=True)
        reports.append({**report, "records": records})
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(reports, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
