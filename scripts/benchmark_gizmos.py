"""Seat-rotated Gizmos evaluation with immutable, in-memory Git baselines.

Run from the repository root. Policy modules have separate globals and receive
only public information. All actions are applied by one shared current referee.
"""

import argparse
import builtins
import copy
import hashlib
import json
import random
import statistics
import subprocess
import sys
import time
import types
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.benchmark_guandan import derived_seed, fingerprint, paired_metric

RUNTIME_FILES = ("game/gizmos.py", "game/gizmos_data.py")


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def capture_sources(ref: Optional[str] = None):
    revision = git("rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}").decode().strip() if ref else None
    sources = {path: git("cat-file", "blob", f"{revision}:{path}") if revision else (ROOT / path).read_bytes()
               for path in RUNTIME_FILES}
    hashes = {path: hashlib.sha256(data).hexdigest() for path, data in sources.items()}
    return sources, {"revision": revision, "kind": "git_commit" if revision else "worktree",
                     "files": hashes, "source_sha256": fingerprint(hashes)}


def load_policy(sources: Dict[str, bytes], name: str):
    """Route the only game import to private captured data, without rewriting it.

    No historical files are written and no checkout/import of the live game
    package is needed. Fail closed if a future policy adds uncaptured imports.
    """
    data = types.ModuleType(f"{name}.gizmos_data")
    exec(compile(sources["game/gizmos_data.py"], f"{name}/gizmos_data.py", "exec"), data.__dict__)

    def private_import(module, globals=None, locals=None, fromlist=(), level=0):
        if module == "game.gizmos_data" and not level:
            return data
        if level or module == "game" or module.startswith("game."):
            raise ImportError(f"uncaptured Gizmos dependency: {module}")
        return builtins.__import__(module, globals, locals, fromlist, level)

    core = types.ModuleType(f"{name}.gizmos")
    core.__dict__["__builtins__"] = dict(vars(builtins), __import__=private_import)
    exec(compile(sources["game/gizmos.py"], f"{name}/gizmos.py", "exec"), core.__dict__)
    return core


def public_state(state: Dict, actor: str) -> Dict:
    """Preserve public counts and own research, erase hidden identities and RNG."""
    observation = copy.deepcopy(state)
    observation["decks"] = {level: [None] * len(cards) for level, cards in state["decks"].items()}
    observation["energy_bag"] = [None] * len(state["energy_bag"])
    observation["rng_seed"] = 0
    observation["rng_counter"] = 0
    observation["config"] = {"seed": None}
    research = observation.get("research_context")
    if research and research.get("player_id") != actor:
        research["drawn"] = [None] * len(research.get("drawn", []))
    return observation


def play_game(referee, candidate, baseline, seed: int, players: int, candidate_seat: int,
              max_actions: int = 1200, traces: Optional[List] = None) -> Dict:
    metadata = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat, "is_bot": True}
                for seat in range(players)]
    state = referee.GizmosGame.init_game({"seed": seed}, metadata)
    initial_hash = fingerprint(state)
    latencies = {"candidate": [], "baseline": []}
    action_counts = {"candidate": Counter(), "baseline": Counter()}
    trajectory = []
    for step in range(max_actions):
        if state["game_over"]:
            break
        actor = state["current_turn"]
        side = "candidate" if actor == f"p{candidate_seat}" else "baseline"
        policy = candidate if side == "candidate" else baseline
        observation = public_state(state, actor)
        before = fingerprint(observation)
        start = time.perf_counter()
        action = policy.GizmosGame.bot_move(observation, actor)
        latencies[side].append((time.perf_counter() - start) * 1000.0)
        if fingerprint(observation) != before:
            raise RuntimeError(f"{side} mutated its observation")
        if not action:
            raise RuntimeError(f"no action: seed={seed} seat={candidate_seat} step={step} phase={state['phase']}")
        _, error = referee.GizmosGame.apply_action(state, actor, action)
        if error:
            raise RuntimeError(f"illegal {side} action: seed={seed} step={step} {action}: {error}")
        action_counts[side][action["type"]] += 1
        trajectory.append({"actor": actor, "action": action})
    if not state["game_over"]:
        raise RuntimeError(f"action limit: seed={seed} seat={candidate_seat}")
    scores = {pid: referee._player_total_score(player) for pid, player in state["players"].items()}
    candidate_id = f"p{candidate_seat}"
    if traces is not None:
        traces.extend(trajectory)
    return {"deal_seed": seed, "candidate_seat": candidate_seat, "initial_sha256": initial_hash,
            "trajectory_sha256": fingerprint(trajectory), "actions": len(trajectory),
            "winner": state["winner"], "scores": scores,
            "win": int(candidate_id in state["winner"]),
            "score_margin": scores[candidate_id] - max(score for pid, score in scores.items() if pid != candidate_id),
            "latencies": latencies, "action_counts": {side: dict(counts) for side, counts in action_counts.items()}}


def summarize(records: List[Dict], players: int) -> Dict:
    groups = defaultdict(list)
    for row in records:
        groups[row["block"]].append(row)
    if not groups or any(len(rows) != players or {row["candidate_seat"] for row in rows} != set(range(players))
                         or len({(row["deal_seed"], row["initial_sha256"]) for row in rows}) != 1
                         for rows in groups.values()):
        raise ValueError("summary requires complete, identical-initial-state seat rotations")
    wins = paired_metric([statistics.mean(row["win"] for row in rows) for rows in groups.values()], 0, 1)
    margins = [statistics.mean(row["score_margin"] for row in rows) for rows in groups.values()]
    margin = {"mean": statistics.mean(margins), "ci95": None}
    if len(margins) >= 30 and len(set(margins)) > 1:
        rng = random.Random(0)
        boot = sorted(statistics.mean(rng.choices(margins, k=len(margins))) for _ in range(5000))
        margin["ci95"] = [boot[125], boot[4874]]
    return {"blocks": len(groups), "games": len(records), "players": players,
            "primary_metric": "win_rate", "null_win_rate": 1.0 / players,
            "win_rate": wins, "score_margin_vs_best_opponent": margin,
            "verdict": "improved" if wins["ci95"][0] > 1.0 / players else
                       "regressed" if wins["ci95"][1] < 1.0 / players else "inconclusive",
            "identical_trajectory_blocks": sum(len({row["trajectory_sha256"] for row in rows}) == 1 for rows in groups.values()),
            "statistical_unit": "independent_seed_with_all_seat_rotations"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-ref", required=True)
    parser.add_argument("--candidate-ref")
    parser.add_argument("--seed", type=int, default=260920)
    parser.add_argument("--seeds", type=int, default=30)
    parser.add_argument("--players", type=int, choices=(2, 3, 4), default=2)
    parser.add_argument("--max-actions", type=int, default=1200)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.seeds <= 0:
        parser.error("--seeds must be positive")
    candidate_sources, candidate_identity = capture_sources(args.candidate_ref)
    baseline_sources, baseline_identity = capture_sources(args.baseline_ref)
    referee_sources, referee_identity = capture_sources()
    candidate = load_policy(candidate_sources, "candidate")
    baseline = load_policy(baseline_sources, "baseline")
    referee = load_policy(referee_sources, "referee")
    harness = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
               for path in (Path(__file__), ROOT / "scripts/benchmark_guandan.py")}
    report = {"schema_version": 1, "status": "running", "seed": args.seed,
              "requested_seeds": args.seeds, "players": args.players, "max_actions": args.max_actions,
              "information": "public", "candidate": candidate_identity, "baseline": baseline_identity,
              "referee": referee_identity, "harness": harness, "records": []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    rows_path = args.output.with_suffix(".games.jsonl")
    latencies = {"candidate": [], "baseline": []}
    counts = {"candidate": Counter(), "baseline": Counter()}
    start = time.perf_counter()
    try:
        with rows_path.open("w") as rows_file:
            for block in range(args.seeds):
                seed = derived_seed(args.seed, "gizmos", block)
                for seat in range(args.players):
                    row = play_game(referee, candidate, baseline, seed, args.players, seat, args.max_actions)
                    row["block"] = block
                    for side in latencies:
                        latencies[side].extend(row["latencies"][side])
                        counts[side].update(row["action_counts"][side])
                    del row["latencies"]
                    report["records"].append(row)
                    rows_file.write(json.dumps(row, sort_keys=True) + "\n")
                    rows_file.flush()
                print(f"seed {block + 1}/{args.seeds} completed", flush=True)
        # Compare bytes, since another task may legitimately move HEAD.
        for ref, identity in ((args.candidate_ref, candidate_identity), (args.baseline_ref, baseline_identity), (None, referee_identity)):
            if capture_sources(identity["revision"] if ref else None)[1]["files"] != identity["files"]:
                raise RuntimeError("runtime changed during benchmark")
        for path, digest in harness.items():
            if hashlib.sha256((ROOT / path).read_bytes()).hexdigest() != digest:
                raise RuntimeError("benchmark harness changed during run")
        report["summary"] = summarize(report["records"], args.players)
        report["status"] = "completed"
    except Exception as exc:
        report["status"] = "failed"
        report["failure"] = str(exc)
        raise
    finally:
        report["elapsed_seconds"] = time.perf_counter() - start
        report["diagnostics"] = {side: {"decisions": len(values), "action_counts": dict(counts[side]),
            "latency_ms": {"mean": statistics.mean(values) if values else None,
                           "p95": sorted(values)[int((len(values) - 1) * .95)] if values else None,
                           "max": max(values, default=None)}} for side, values in latencies.items()}
        args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
