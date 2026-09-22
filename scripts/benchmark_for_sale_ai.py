"""Reproducible, seat-balanced comparison against the original For Sale bot.

Example:
    python3 scripts/benchmark_for_sale_ai.py --seeds 8 --json tmp/for_sale/ai-results.json

Each deal is replayed with the new policy in every seat. An all-baseline replay
of the same deal provides a paired final-wealth comparison for each new seat.
Policies receive public views only. Win credit is split for shared victories.
"""

import argparse
import json
import math
import random
import statistics
import sys
import time
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.for_sale import ForSaleGame as Game
from game.for_sale_ai import choose_action


def baseline(view):
    """Frozen original policy from the first For Sale implementation."""
    legal = view["legal_actions"]
    if "next_round" in legal:
        return {"type": "next_round", "round": view["round"]}
    if "sell" in legal:
        hand, checks = sorted(view["your_properties"]), sorted(view["market_checks"])
        spread = checks[-1] - checks[0]
        quality = (checks[-1] + spread) / 30 if spread else 0
        choice = hand[round(quality * (len(hand) - 1))]
        return {"type": "sell", "round": view["round"], "property": choice}
    if "pass" not in legal:
        return None
    action = {"type": "pass", "round": view["round"], "turn": view["turn"]}
    if "bid" in legal:
        market = view["market_properties"]
        remaining = view["rounds_per_stage"] - view["stage_round"] + 1
        average_budget = view["max_bid"] / remaining
        value = (0.55 + market[-1] / 30) * (0.5 + (market[-1] - market[0]) / 29)
        budget = min(view["max_bid"], math.ceil(average_budget * value))
        if view["min_bid"] <= budget:
            action.update(type="bid", amount=view["min_bid"])
    return action


def play_game(count, seed, new_seats):
    players = [{"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat,
                "is_bot": True} for seat in range(count)]
    source = random.Random(seed)
    with patch("game.for_sale.random.shuffle", side_effect=source.shuffle), \
            patch("game.for_sale.random.choice", side_effect=source.choice):
        state = Game.init_game({}, players)
    new_ids = {f"p{seat}" for seat in new_seats}
    timings = {"buy": [], "sell": [], "round_end": []}
    for actions in range(5000):
        if state["game_over"]:
            return {"count": count, "seed": seed, "new_seats": sorted(new_seats),
                    "winners": state["winner"], "results": state["final_results"],
                    "actions": actions}, timings
        if state["phase"] == "buy":
            pid = state["current_turn"]
        else:
            pid = next(pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid))
        view = Game.get_public_view(state, pid)
        policy = choose_action if pid in new_ids else baseline
        start = time.perf_counter()
        action = policy(view)
        if pid in new_ids:
            timings[state["phase"]].append((time.perf_counter() - start) * 1000)
        _, error = Game.apply_action(state, pid, action)
        if error:
            raise AssertionError((count, seed, new_seats, pid, action, error))
    raise AssertionError((count, seed, new_seats, "game exceeded action limit"))


def latency(samples):
    if not samples:
        return {"decisions": 0}
    ordered = sorted(samples)
    return {"decisions": len(samples), "mean_ms": round(statistics.mean(samples), 3),
            "median_ms": round(statistics.median(samples), 3),
            "p95_ms": round(ordered[math.ceil(0.95 * len(ordered)) - 1], 3),
            "max_ms": round(ordered[-1], 3)}


def summarize(records, timings):
    outcomes = {"new": [], "baseline": []}
    for game in records:
        for result in game["results"]:
            seat = int(result["player_id"][1:])
            side = "new" if seat in game["new_seats"] else "baseline"
            outcomes[side].append({
                **result,
                "win_credit": 1 / len(game["winners"]) if result["player_id"] in game["winners"] else 0,
                "paired_gain": result["total"] - game["baseline_reference"][result["player_id"]],
            })
    report = {"games": len(records)}
    for side, rows in outcomes.items():
        report[side] = {
            "player_games": len(rows),
            "mean_total_k": round(statistics.mean(row["total"] for row in rows), 3),
            "mean_cash_k": round(statistics.mean(row["cash"] for row in rows), 3),
            "mean_rank": round(statistics.mean(row["rank"] for row in rows), 3),
            "win_share_per_player": round(statistics.mean(row["win_credit"] for row in rows), 4),
        }
    report["new"]["mean_paired_gain_k"] = round(statistics.mean(row["paired_gain"] for row in outcomes["new"]), 3)
    report["new"]["latency"] = {phase: latency(samples) for phase, samples in timings.items()}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seeds", type=int, default=4, help="Distinct deals per player count")
    parser.add_argument("--seed-start", type=int, default=112000)
    parser.add_argument("--counts", type=int, nargs="+", default=[3, 4, 5, 6])
    parser.add_argument("--new-count", type=int, default=1, help="New-policy seats per game; rotate as a block")
    parser.add_argument("--json", type=Path, help="Write full results and per-game audit records")
    args = parser.parse_args()
    if args.seeds < 1 or any(count not in range(3, 7) for count in args.counts):
        parser.error("Use positive --seeds and --counts between 3 and 6")
    if any(not 1 <= args.new_count < count for count in args.counts):
        parser.error("--new-count must leave at least one baseline seat")

    started = time.perf_counter()
    records, reports = [], []
    for count in args.counts:
        group, timings = [], {"buy": [], "sell": [], "round_end": []}
        for seed in range(args.seed_start, args.seed_start + args.seeds):
            reference, _ = play_game(count, seed, set())
            baseline_totals = {row["player_id"]: row["total"] for row in reference["results"]}
            for rotation in range(count):
                new_seats = {(rotation + index) % count for index in range(args.new_count)}
                result, measured = play_game(count, seed, new_seats)
                result["baseline_reference"] = baseline_totals
                group.append(result)
                for phase, samples in measured.items():
                    timings[phase].extend(samples)
            print(f"Completed {count} players, seed {seed}: {count} seat rotations", file=sys.stderr, flush=True)
        report = {"players": count, **summarize(group, timings)}
        reports.append(report)
        records.extend(group)
        print(json.dumps(report, ensure_ascii=False), flush=True)
    output = {
        "method": "fixed deals, all seat rotations, pure public views, split tie credits; paired gain uses all-baseline replay",
        "config": {"seeds": args.seeds, "seed_start": args.seed_start, "counts": args.counts, "new_count": args.new_count},
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "summary": reports, "games": records,
    }
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Finished {len(records)} mixed-policy games in {output['elapsed_seconds']:.3f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
