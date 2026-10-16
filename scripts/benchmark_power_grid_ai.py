"""Compare Power Grid policies on seeded games with every candidate seat.

Example:
    python3 scripts/benchmark_power_grid_ai.py \
        --baseline tmp/power_grid_ai/legacy_policy.py --counts 3 --seeds 6 \
        --json tmp/power_grid_ai/benchmark.json

Policy files must export choose_bot_action(view). The default candidate is the
current game.power_grid policy. Each seed also runs an all-baseline reference.
Only public views reach policies; every action passes the normal game validator.
Win credit is split on ties. Wall-clock decision timings exclude view generation.
"""

import argparse
import importlib.util
import json
import math
import random
import statistics
import sys
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.power_grid import PowerGridGame as Game, choose_bot_action


Policy = Callable[[Dict], Optional[Dict]]


def load_policy(path: Path, name: str) -> Policy:
    spec = importlib.util.spec_from_file_location(name, path.resolve())
    if spec is None or spec.loader is None:
        raise ValueError(f"Cannot load Python policy: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    policy = getattr(module, "choose_bot_action", None)
    if not callable(policy):
        raise ValueError(f"Policy must export choose_bot_action(view): {path}")
    return policy


def play_game(count: int, seed: int, candidate_seat: Optional[int],
              candidate: Policy, baseline: Policy, max_actions: int) -> Tuple[Dict, Dict]:
    random.seed(seed)
    players = [{"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat,
                "is_bot": True} for seat in range(count)]
    state = Game.init_game({"seed": seed}, players)
    record = {"players": count, "seed": seed, "candidate_seat": candidate_seat}
    timings = {"candidate": {}, "baseline": {}}
    actions = 0
    failure = None
    while not state["game_over"] and actions < max_actions:
        pid = state["current_turn"]
        if state["phase"] == "round_end":
            pid = next((pid for pid in state["seat_order"]
                        if Game.get_legal_actions(state, pid)), None)
        if pid is None:
            failure = {"kind": "stalled", "message": "No active player before game end"}
            break
        side = "candidate" if pid == f"p{candidate_seat}" else "baseline"
        policy = candidate if side == "candidate" else baseline
        view = Game.get_public_view(state, pid)
        action = None
        started = time.perf_counter()
        try:
            action = policy(view)
        except Exception as error:
            failure = {"kind": "policy_exception", "message": repr(error)}
        finally:
            elapsed = (time.perf_counter() - started) * 1000
            timings[side].setdefault(state["phase"], []).append(elapsed)
        if failure is None:
            if isinstance(action, dict):
                action = {**action, "round": view["round"]}
                if action.get("type") != "next_round":
                    action["revision"] = view["revision"]
            try:
                _, error = Game.apply_action(state, pid, action)
                if error:
                    failure = {"kind": "illegal_action", "message": error}
            except Exception as error:
                failure = {"kind": "apply_exception", "message": repr(error)}
        if failure is not None:
            failure.update(player_id=pid, policy=side, action=action)
            break
        actions += 1
    if not state["game_over"] and failure is None:
        failure = {"kind": "action_limit", "message": f"Exceeded {max_actions} actions"}
    record.update(status="failed" if failure else "completed", actions=actions,
                  rounds=state["round"], phase=state["phase"],
                  winners=state["winner_ids"], results=state["final_results"])
    if failure:
        record["failure"] = {**failure, "revision": state["revision"],
                             "recent_log": state["log"][-5:]}
    return record, timings


def latency(samples: List[float]) -> Dict:
    if not samples:
        return {"decisions": 0}
    ordered = sorted(samples)
    return {"decisions": len(samples), "mean_ms": round(statistics.mean(samples), 3),
            "median_ms": round(statistics.median(samples), 3),
            "p95_ms": round(ordered[math.ceil(0.95 * len(ordered)) - 1], 3),
            "max_ms": round(ordered[-1], 3)}


def summarize(records: List[Dict], timings: Dict) -> Dict:
    complete = [record for record in records if record["status"] == "completed"]
    report = {"games": len(records), "completed": len(complete),
              "failed": len(records) - len(complete)}
    report["mean_rounds"] = round(statistics.mean(g["rounds"] for g in complete), 3) if complete else None
    report["mean_actions"] = round(statistics.mean(g["actions"] for g in complete), 3) if complete else None
    outcomes = {"candidate": [], "baseline": []}
    paired_powered, paired_money = [], []
    for game in complete:
        candidate_id = f"p{game['candidate_seat']}"
        for result in game["results"]:
            side = "candidate" if result["player_id"] == candidate_id else "baseline"
            won = result["player_id"] in game["winners"]
            outcomes[side].append({**result, "won": won, "win_credit": (
                1 / len(game["winners"]) if won else 0)})
            reference = game.get("baseline_reference", {}).get(result["player_id"])
            if side == "candidate" and reference:
                paired_powered.append(result["powered"] - reference["powered"])
                paired_money.append(result["money"] - reference["money"])
    for side, rows in outcomes.items():
        report[side] = {"player_games": len(rows)}
        report[side]["wins"] = sum(row["won"] for row in rows)
        report[side]["win_rate"] = round(statistics.mean(row["won"] for row in rows), 4) if rows else None
        for field in ("win_credit", "powered", "money", "cities"):
            name = "win_share_per_player" if field == "win_credit" else f"mean_{field}"
            report[side][name] = round(statistics.mean(row[field] for row in rows), 4) if rows else None
        samples = [sample for group in timings[side].values() for sample in group]
        report[side]["latency"] = {"all": latency(samples), **{
            phase: latency(samples) for phase, samples in timings[side].items()}}
    report["candidate"]["paired_games"] = len(paired_powered)
    report["candidate"]["mean_paired_powered_gain"] = round(statistics.mean(paired_powered), 3) if paired_powered else None
    report["candidate"]["mean_paired_money_gain"] = round(statistics.mean(paired_money), 3) if paired_money else None
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path,
                        help="Python file exporting the comparison choose_bot_action")
    parser.add_argument("--candidate", type=Path,
                        help="Override current policy, e.g. for baseline-versus-itself checks")
    parser.add_argument("--counts", type=int, nargs="+", choices=range(2, 7), default=[3])
    parser.add_argument("--seeds", type=int, default=4, help="Number of consecutive random seeds")
    parser.add_argument("--seed-start", type=int, default=0)
    parser.add_argument("--max-actions", type=int, default=10000)
    parser.add_argument("--json", type=Path, help="Also save the full JSON report to this file")
    args = parser.parse_args()
    if args.seeds < 1 or args.max_actions < 1:
        parser.error("--seeds and --max-actions must be positive")
    try:
        default_path = ROOT / "tmp" / "power_grid_ai" / "legacy_policy.py"
        if args.baseline:
            baseline = load_policy(args.baseline, "power_grid_benchmark_baseline")
            baseline_name = str(args.baseline.resolve())
        elif default_path.exists():
            baseline = load_policy(default_path, "power_grid_benchmark_baseline")
            baseline_name = str(default_path.resolve())
        else:
            baseline = choose_bot_action
            baseline_name = "game.power_grid.choose_bot_action"
        candidate = load_policy(args.candidate, "power_grid_benchmark_candidate") if args.candidate else choose_bot_action
    except (OSError, ValueError, ImportError) as error:
        parser.error(str(error))
    started = time.perf_counter()
    records, references, reports = [], [], []
    for count in dict.fromkeys(args.counts):
        group, timings = [], {"candidate": {}, "baseline": {}}
        for seed in range(args.seed_start, args.seed_start + args.seeds):
            reference, _ = play_game(count, seed, None, candidate, baseline, args.max_actions)
            references.append(reference)
            if reference["status"] == "failed":
                print(f"FAILED reference: players={count}, seed={seed}: {reference['failure']}",
                      file=sys.stderr, flush=True)
            baseline_results = {row["player_id"]: row for row in reference["results"]}
            for seat in range(count):
                result, measured = play_game(count, seed, seat, candidate, baseline, args.max_actions)
                result["baseline_reference"] = baseline_results
                group.append(result)
                for side, phases in measured.items():
                    for phase, samples in phases.items():
                        timings[side].setdefault(phase, []).extend(samples)
                if result["status"] == "failed":
                    print(f"FAILED: players={count}, seed={seed}, seat={seat}: {result['failure']}",
                          file=sys.stderr, flush=True)
            print(f"Completed {count} players, seed {seed}: reference + {count} seat rotations",
                  file=sys.stderr, flush=True)
        reports.append({"players": count, **summarize(group, timings)})
        records.extend(group)
    output = {
        "method": "Seeded games, every candidate seat, public views, validated actions; "
                  "split tie credits; paired gains use the same seat in an all-baseline replay. "
                  "Outcome averages exclude failed games; timing includes failed decisions.",
        "config": {"baseline": baseline_name,
                   "candidate": str(args.candidate.resolve()) if args.candidate else "game.power_grid.choose_bot_action",
                   "counts": args.counts, "seeds": args.seeds, "seed_start": args.seed_start,
                   "max_actions": args.max_actions},
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "summary": reports, "reference_games": references, "games": records,
    }
    encoded = json.dumps(output, ensure_ascii=False, indent=2)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    return int(any(record["status"] == "failed" for record in references + records))


if __name__ == "__main__":
    raise SystemExit(main())
