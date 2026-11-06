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

from game.incan_gold import HAZARD_TYPES, TREASURE_VALUES, IncanGoldGame as Game
from game.incan_gold_ai import choose_decision


def load_baseline(revision: str) -> Callable:
    source = subprocess.check_output(
        ["git", "show", f"{revision}:game/incan_gold_ai.py"], cwd=ROOT, text=True,
    )
    namespace = {}
    exec(compile(source, f"{revision}:game/incan_gold_ai.py", "exec"), namespace)
    return namespace["choose_decision"]


def play_game(count: int, seed: int, new_seat: int, baseline: Callable) -> Tuple[Dict, List[float]]:
    players = [dict(player_id=f"p{seat}", name=f"Explorer {seat}", seat=seat, is_bot=True)
               for seat in range(count)]
    round_number = 0

    def shuffle_round(deck):
        nonlocal round_number
        round_number += 1
        random.Random(seed * 1009 + round_number).shuffle(deck)

    timings = []
    with patch("game.incan_gold.random.shuffle", side_effect=shuffle_round):
        state = Game.init_game({}, players)
        for step in range(500):
            if state["game_over"]:
                new_id = f"p{new_seat}"
                score = lambda player: player["banked_gems"] + player["artifact_points"]
                return {
                    "seed": seed, "seat": new_seat, "players": count,
                    "win_credit": 1 / len(state["winner"]) if new_id in state["winner"] else 0,
                    "score": score(state["players"][new_id]),
                    "opponent_score": statistics.mean(score(player) for player_id, player in state["players"].items() if player_id != new_id),
                    "artifacts": state["players"][new_id]["artifact_count"],
                }, timings
            actions = []
            for seat, player_id in enumerate(state["turn_order"]):
                legal = Game.get_legal_actions(state, player_id)
                if "next_round" in legal:
                    actions.append((player_id, {"type": "next_round"}))
                elif "decide" in legal:
                    policy = choose_decision if seat == new_seat else baseline
                    started = time.perf_counter()
                    choice = policy(Game.get_public_view(state, player_id), TREASURE_VALUES, HAZARD_TYPES)
                    if seat == new_seat:
                        timings.append((time.perf_counter() - started) * 1000)
                    actions.append((player_id, {"type": "decide", "choice": choice}))
            if not actions:
                raise AssertionError("game stalled")
            for player_id, action in actions:
                _, error = Game.apply_action(state, player_id, action)
                if error:
                    raise AssertionError((step, player_id, action, error))
    raise AssertionError("action limit exceeded")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-ref", default="ca30f7e513ca21125275d1fcc7af91cbc53bd4d5")
    parser.add_argument("--seeds", type=int, default=20)
    parser.add_argument("--seed-start", type=int, default=0)
    parser.add_argument("--counts", type=int, nargs="+", default=[3, 5, 8])
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
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
            "new_win_share": round(statistics.mean(result["win_credit"] for result in results), 4),
            "new_mean_score": round(statistics.mean(result["score"] for result in results), 2),
            "opponent_mean_score": round(statistics.mean(result["opponent_score"] for result in results), 2),
            "new_mean_artifacts": round(statistics.mean(result["artifacts"] for result in results), 2),
            "mean_ms": round(statistics.mean(timings), 2),
            "p95_ms": round(timings[math.ceil(len(timings) * 0.95) - 1], 2),
            "max_ms": round(max(timings), 2),
        }
        reports.append(report)
        records.extend(results)
        print(json.dumps(report), flush=True)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps({"baseline_ref": args.baseline_ref,
            "seed_start": args.seed_start, "seeds": args.seeds,
            "method": "One new bot against old bots, every seat rotation, seeded round decks, split ties; public information only.",
            "reports": reports, "games": records}, indent=2) + "\n")


if __name__ == "__main__":
    main()
