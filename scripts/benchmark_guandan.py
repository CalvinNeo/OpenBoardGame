"""Paired, versioned Guandan policy evaluation; see designs/guandan_benchmark.md.

Only the referee sees real hidden cards in public-information mode. Policies run
in separate, fresh processes for each game; Git versions load directly from blobs.
This module and its worker protocol use only the Python standard library.
"""

import argparse
import contextlib
import copy
import hashlib
import importlib
import importlib.abc
import importlib.util
import json
import math
import os
import platform
import random
import selectors
import statistics
import subprocess
import sys
import tempfile
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Sequence


REPO_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_FILES = ("game/guandan.py", "game/guandan_ai.py", "game/memories.py")
POLICIES = ("auto", "heuristic", "greedy", "random")
SCHEMA_VERSION = 2


def derived_seed(seed: int, *parts: object) -> int:
    payload = json.dumps([seed, *parts], separators=(",", ":")).encode()
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")


def fingerprint(value: object) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def _git(root: Path, *args: str) -> bytes:
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=False)
    if result.returncode:
        raise ValueError(f"git {' '.join(args)}: {result.stderr.decode(errors='replace').strip()}")
    return result.stdout


def resolve_revision(root: Path, ref: str) -> str:
    """Resolve a user ref once; every subsequent blob read uses this commit ID."""
    return _git(root, "rev-parse", "--verify", "--end-of-options", f"{ref}^{{commit}}").decode().strip()


def _runtime_sources(root: Path, revision: Optional[str] = None) -> Dict[str, bytes]:
    if revision is not None and (len(revision) not in (40, 64) or
                                 any(char not in "0123456789abcdef" for char in revision)):
        raise ValueError("runtime revision must be a resolved full commit ID")
    return {name: (_git(root, "cat-file", "blob", f"{revision}:{name}") if revision else
                   (root / name).read_bytes()) for name in RUNTIME_FILES}


def _source_identity(root: Path, sources: Dict[str, bytes], revision: Optional[str]) -> Dict:
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in sources.items()}
    dirty = False
    if revision is None:
        try:
            revision = resolve_revision(root, "HEAD")
            dirty = bool(_git(root, "status", "--porcelain", "--", *RUNTIME_FILES).strip())
        except ValueError:
            revision, dirty = None, None
        kind = "worktree"
    else:
        kind = "git_commit"
    return {"root": str(root.resolve()), "revision": revision, "dirty": dirty, "files": hashes,
            "source_sha256": fingerprint(hashes), "kind": kind, "frozen": kind == "git_commit"}


def source_identity(root: Path, revision: Optional[str] = None) -> Dict:
    return _source_identity(root, _runtime_sources(root, revision), revision)


class _RuntimeImporter(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    """Load only captured policy bytes, never worktree imports or stale pyc files."""

    def __init__(self, sources: Dict[str, bytes], origin: str):
        self.sources = {name[:-3].replace("/", "."): data for name, data in sources.items()}
        self.origin = origin

    def find_spec(self, fullname, path=None, target=None):
        if fullname == "game":
            return importlib.util.spec_from_loader(fullname, self, is_package=True)
        if fullname.startswith("game."):
            if fullname not in self.sources:
                raise ModuleNotFoundError(f"policy dependency not captured: {fullname}")
            return importlib.util.spec_from_loader(fullname, self)
        return None

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        if module.__name__ == "game":
            module.__path__ = []
            return
        module.__file__ = f"{self.origin}/{module.__name__.replace('.', '/')}.py"
        exec(compile(self.sources[module.__name__], module.__file__, "exec"), module.__dict__)


def _install_runtime(root: Path, revision: Optional[str] = None):
    """Worker/CLI only: load a coherent, isolated runtime directly into memory."""
    if any(name == "game" or name.startswith("game.") for name in sys.modules):
        raise RuntimeError("runtime must be installed in a fresh process")
    sources = _runtime_sources(root, revision)
    identity = _source_identity(root, sources, revision)
    origin = f"git:{root.resolve()}@{revision}" if revision else str(root.resolve())
    sys.meta_path.insert(0, _RuntimeImporter(sources, origin))
    core = importlib.import_module("game.guandan")
    core.__benchmark_identity__ = identity
    return core


class _SeededRandom:
    """Seed even private Random() instances, without patching global random."""

    def __init__(self, seed: int):
        self.stream = random.Random(seed)

    def Random(self, seed=None):
        return random.Random(self.stream.getrandbits(128) if seed is None else seed)

    def __getattr__(self, name: str):
        return getattr(self.stream, name)


class _FixedClock:
    """Disable wall-clock stopping; configured finite search counts still apply."""

    @staticmethod
    def perf_counter() -> float:
        return 0.0

    def __getattr__(self, name: str):
        return getattr(time, name)


def make_deal(core, seed: int, level: int) -> Dict:
    players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat, "is_bot": True}
               for seat in range(4)]
    previous_rng = core.random
    core.random = random.Random(seed)
    try:
        state = core.GuandanGame.init_game({}, players)
    finally:
        core.random = previous_rng
    for team in state["teams"].values():
        team["level"] = level
    state["level_rank"] = level
    state["game_start_time"] = 0.0
    core._start_round_memory(state)
    return state


def policy_observation(core, state: Dict, player_id: str, seed: int, information: str) -> Dict:
    if information == "full":
        return copy.deepcopy(state)
    if information != "public":
        raise ValueError(f"unknown information mode: {information}")
    # Explicit allowlist: caches, explanations and initial/final hands must not
    # become a back door into hidden information when new state fields appear.
    public_keys = (
        "config", "turn_order", "player_meta", "player_teams", "teams", "dealer_team",
        "level_rank", "round_number", "phase", "current_turn", "current_trick",
        "pass_count", "trick_plays", "finish_order", "last_round_summary",
        "visible_card_id", "seen_cards", "pass_limits", "known_card_owners",
        "game_over", "winner_team",
    )
    view = {key: copy.deepcopy(state[key]) for key in public_keys if key in state}
    view.update(game_start_time=0.0, tribute=None, bot_explain={}, bot_explain_history={})
    view["round_memories"] = []
    for entry in state.get("round_memories", []):
        public_entry = {key: copy.deepcopy(entry[key]) for key in
                        ("round_number", "dealer_team", "level_rank", "status") if key in entry}
        public_entry["tricks"] = []
        for trick in entry.get("tricks", []):
            public_trick = {key: copy.deepcopy(trick[key]) for key in
                            ("index", "leader_id", "winner_id", "status") if key in trick}
            public_trick["actions"] = [
                {key: copy.deepcopy(action[key]) for key in
                 ("player_id", "type", "cards", "combo_type", "combo_size", "hand_count_after", "finished_rank")
                 if key in action}
                for action in trick.get("actions", [])
            ]
            public_entry["tricks"].append(public_trick)
        view["round_memories"].append(public_entry)
    view["players"] = {
        pid: {"hand": [], "finished": data["finished"], "finish_rank": data.get("finish_rank"),
              "round_ready": False}
        for pid, data in state["players"].items()
    }
    own_hand = copy.deepcopy(state["players"][player_id]["hand"])
    view["players"][player_id]["hand"] = own_hand
    unavailable = set(state.get("seen_cards", [])) | {card["id"] for card in own_hand}
    unavailable.update((state.get("current_trick") or {}).get("cards", []))
    unseen = {card["id"]: card for card in core._full_deck() if card["id"] not in unavailable}
    # Known owners are public (e.g. the opening exposed card). Passes are soft
    # evidence, so the adapter must not forbid hands that could legally pass.
    for raw_id, owner in sorted(state.get("known_card_owners", {}).items(), key=lambda item: int(item[0])):
        card_id = int(raw_id)
        if owner != player_id and owner in view["players"] and card_id in unseen:
            view["players"][owner]["hand"].append(unseen.pop(card_id))
    pool = [unseen[card_id] for card_id in sorted(unseen)]
    random.Random(seed).shuffle(pool)
    for pid in state["turn_order"]:
        if pid == player_id:
            continue
        hand = view["players"][pid]["hand"]
        needed = len(state["players"][pid]["hand"]) - len(hand)
        if needed < 0 or needed > len(pool):
            raise ValueError("inconsistent public card counts")
        hand.extend(pool[:needed])
        del pool[:needed]
    if pool:
        raise ValueError("unaccounted cards in public observation")
    return view


def simple_action(core, state: Dict, player_id: str, mode: str, rng: random.Random) -> Dict:
    """Diagnostic opponents, using no tactical ranking or scoring functions."""
    options = core._list_hint_options(state, player_id)
    hand = state["players"][player_id]["hand"]
    trick = state.get("current_trick")
    combo = trick["combo"] if trick else None
    if core._can_play_all(hand, state["level_rank"], state["config"], combo):
        return {"type": "play", "card_ids": [card["id"] for card in hand]}
    actions = [{"type": "play", "card_ids": cards} for cards in options]
    if trick:
        actions.append({"type": "pass"})
    if not actions:
        raise ValueError("no legal candidates")
    if mode == "random":
        return rng.choice(actions)
    if trick and core._team_of(state, trick["player_id"]) == core._team_of(state, player_id):
        return {"type": "pass"}
    if not options:
        return {"type": "pass"}
    by_id = core._map_hand_by_id(hand)

    def cost(cards: List[int]):
        shape = core._evaluate_combo([by_id[cid] for cid in cards], state["level_rank"], state["config"])
        bomb = shape["type"] in core.BOMB_TYPES
        # Lead a large ordinary group; respond as cheaply as possible.
        return (bomb, len(cards) if trick else -len(cards), core._combo_value(shape), tuple(sorted(cards)))

    return {"type": "play", "card_ids": min(options, key=cost)}


def _worker_main(root: Path, revision: Optional[str] = None) -> int:
    core = _install_runtime(root, revision)
    ai = core._guandan_ai
    print(json.dumps({"defaults": core.DEFAULT_CONFIG, "source": core.__benchmark_identity__}), flush=True)
    for line in sys.stdin:
        try:
            request = json.loads(line)
            state, player_id = request["state"], request["player_id"]
            overrides = request["config"]
            state["config"] = {**core.DEFAULT_CONFIG, **{
                key: value for key, value in state["config"].items() if not key.startswith("bot_")
            }, **overrides, "bot_mode": request["mode"]}
            seeded = _SeededRandom(request["seed"])
            core.random = ai.random = seeded
            core.time = ai.time = _FixedClock() if request["clock"] == "fixed" else time
            started = time.perf_counter()
            # stdout is reserved for the protocol, including if a policy prints.
            with contextlib.redirect_stdout(sys.stderr):
                if request["mode"] in ("random", "greedy"):
                    action = simple_action(core, state, player_id, request["mode"], seeded.stream)
                else:
                    action = core.GuandanGame.bot_move(state, player_id)
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            response = {"action": action, "elapsed_ms": elapsed_ms,
                        "explain": state.get("bot_explain", {}).get(player_id, {})}
        except Exception as exc:
            response = {"error": f"{type(exc).__name__}: {exc}"}
        print(json.dumps(response, allow_nan=False), flush=True)
    return 0


class PolicyWorker:
    def __init__(self, root: Path, mode: str, config: Dict, clock: str, timeout: float,
                 revision: Optional[str] = None, expected_identity: Optional[Dict] = None):
        self.mode, self.config, self.clock, self.timeout = mode, config, clock, timeout
        self.stderr = tempfile.TemporaryFile(mode="w+")
        command = [sys.executable, str(Path(__file__).resolve()), "_worker", "--root", str(root)]
        if revision:
            command.extend(["--revision", revision])
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.stderr, text=True, bufsize=1,
            env={**os.environ, "PYTHONHASHSEED": "0"},
        )
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)
        try:
            ready = self._read()
            self.defaults, self.identity = ready["defaults"], ready["source"]
            if expected_identity:
                # Committing unchanged worktree bytes changes HEAD, not policy identity.
                keys = ("files", "kind")
                if expected_identity["kind"] == "git_commit":
                    keys += ("revision",)
                if any(self.identity[key] != expected_identity[key] for key in keys):
                    raise RuntimeError(f"{mode} worker source changed before loading")
        except Exception:
            self.close()
            raise

    def _read(self) -> Dict:
        if not self.selector.select(self.timeout):
            raise TimeoutError(f"{self.mode} exceeded worker timeout ({self.timeout}s)")
        line = self.process.stdout.readline()
        if not line:
            self.stderr.seek(0)
            raise RuntimeError(f"{self.mode} worker exited: {self.stderr.read()[-2000:]}")
        result = json.loads(line)
        if result.get("error"):
            raise RuntimeError(result["error"])
        return result

    def choose(self, state: Dict, player_id: str, seed: int) -> Dict:
        request = {"state": state, "player_id": player_id, "seed": seed, "mode": self.mode,
                   "config": self.config, "clock": self.clock}
        self.process.stdin.write(json.dumps(request, allow_nan=False) + "\n")
        self.process.stdin.flush()
        return self._read()

    def close(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.selector.close()
        self.process.stdin.close()
        self.process.stdout.close()
        self.stderr.close()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def round_outcome(state: Dict, candidate_team: str) -> Dict:
    order = state["finish_order"]
    if len(order) != 4 or len(set(order)) != 4:
        raise ValueError("round has no complete finish order")
    winning_team = state["player_teams"][order[0]]
    partner_rank = next(i + 1 for i, pid in enumerate(order[1:], 1)
                        if state["player_teams"][pid] == winning_team)
    points = {2: 3, 3: 2, 4: 1}[partner_rank]
    win = winning_team == candidate_team
    return {"win": int(win), "net_points": points if win else -points,
            "finish_order": list(order), "candidate_ranks": [
                i + 1 for i, pid in enumerate(order) if state["player_teams"][pid] == candidate_team
            ]}


def bounded_mean(values: Sequence[float], low: float, high: float) -> Dict:
    """Two-sided 95% Hoeffding bound over independent *deal pairs*.

    Conservative, finite-sample, and nondegenerate even after all wins/losses.
    It avoids treating correlated seat-swapped games as independent samples.
    """
    if not values:
        raise ValueError("at least one complete pair is required")
    mean = statistics.mean(values)
    radius = (high - low) * math.sqrt(math.log(40.0) / (2.0 * len(values)))
    return {"mean": mean, "ci95": [max(low, mean - radius), min(high, mean + radius)],
            "standard_error": statistics.stdev(values) / math.sqrt(len(values)) if len(values) > 1 else None}


def paired_metric(values: Sequence[float], low: float, high: float) -> Dict:
    """Bootstrap complete deal pairs, retaining a conservative reference bound.

    Tiny/constant samples cannot support a useful empirical distribution; do
    not let the bootstrap turn these into spuriously exact strength estimates.
    """
    result = bounded_mean(values, low, high)
    result["conservative_ci95"] = list(result["ci95"])
    result["ci_method"] = "hoeffding_small_or_constant_sample"
    if len(values) >= 30 and len(set(values)) > 1:
        rng = random.Random(0)
        means = sorted(sum(rng.choices(values, k=len(values))) / len(values) for _ in range(5000))

        def quantile(probability: float) -> float:
            position = (len(means) - 1) * probability
            index = int(position)
            fraction = position - index
            return means[index] * (1 - fraction) + means[min(index + 1, len(means) - 1)] * fraction

        result["ci95"] = [quantile(0.025), quantile(0.975)]
        result["ci_method"] = "paired_percentile_bootstrap_5000"
    return result


def summarize(records: List[Dict]) -> Dict:
    grouped = defaultdict(list)
    for record in records:
        grouped[record["pair_index"]].append(record)
    if not grouped or any(len(pair) != 2 or {row["candidate_team"] for row in pair} != {"A", "B"}
                          for pair in grouped.values()):
        raise ValueError("summary requires complete seat-swapped pairs")
    for pair in grouped.values():
        if len({(row["deal_seed"], row["level"], row["deal_sha256"]) for row in pair}) != 1:
            raise ValueError("paired games must use the identical initial deal")
    wins = paired_metric([statistics.mean(row["win"] for row in grouped[index]) for index in sorted(grouped)], 0, 1)
    points = paired_metric([statistics.mean(row["net_points"] for row in grouped[index]) for index in sorted(grouped)], -3, 3)
    if points["ci95"][0] > 0:
        verdict = "improved"
    elif points["ci95"][1] < 0:
        verdict = "regressed"
    else:
        verdict = "inconclusive"
    return {"pairs": len(grouped), "games": len(records), "win_rate": wins,
            "win_rate_delta_pp": {"mean": 100 * (wins["mean"] - 0.5),
                                  "ci95": [100 * (value - 0.5) for value in wins["ci95"]]},
            "net_points_per_game": points, "primary_metric": "net_points_per_game",
            "verdict": verdict, "statistical_unit": "independent_deal_pair",
            "rank_counts": dict(Counter("/".join(map(str, row["candidate_ranks"])) for row in records))}


class Diagnostics:
    def __init__(self):
        self.latencies = []
        self.methods = Counter()
        self.actions = Counter()
        self.components = Counter()
        self.deadline_limited = 0
        self.hard_deadline_reached = 0
        self.mcts_attempted = 0

    def add(self, result: Dict) -> None:
        self.latencies.append(result["elapsed_ms"])
        explain = result.get("explain") or {}
        self.methods[explain.get("method", "simple")] += 1
        self.actions[(result.get("action") or {}).get("type", "missing")] += 1
        self.components.update(key for key, value in (explain.get("chosen") or {}).get("components", {}).items()
                               if abs(value) > 0.001)
        timing = explain.get("timing") or {}
        self.deadline_limited += bool(timing.get("deadline_limited"))
        self.hard_deadline_reached += bool(timing.get("hard_deadline_reached"))
        self.mcts_attempted += "mcts_candidates" in (explain.get("method_details") or {})

    def report(self) -> Dict:
        ordered = sorted(self.latencies)
        return {"decisions": len(ordered), "methods": dict(self.methods), "actions": dict(self.actions),
                "latency_ms": {"mean": statistics.mean(ordered) if ordered else None,
                               "p95": ordered[math.ceil(len(ordered) * 0.95) - 1] if ordered else None,
                               "max": max(ordered) if ordered else None},
                "deadline_limited": self.deadline_limited, "hard_deadline_reached": self.hard_deadline_reached,
                "mcts_attempted": self.mcts_attempted, "chosen_component_firings": dict(self.components)}


def play_round(core, initial: Dict, workers: Dict, candidate_team: str, seed: int,
               information: str, max_actions: int, diagnostics: Dict, on_action=None) -> Dict:
    state = copy.deepcopy(initial)
    transcript = []
    for step in range(max_actions):
        if state.get("game_over") or state["phase"] == "round_end":
            return {**round_outcome(state, candidate_team), "actions": step,
                    "trajectory_sha256": fingerprint(transcript)}
        actor = state["current_turn"]
        side = "candidate" if state["player_teams"][actor] == candidate_team else "baseline"
        # Independent streams for deals, observation completion and policy search.
        # No side/leg component: identical policies receive identical randomness
        # in the mirrored game as long as their trajectories agree.
        observation = policy_observation(core, state, actor, derived_seed(seed, "observation", step, actor), information)
        result = workers[side].choose(observation, actor, derived_seed(seed, "policy", step, actor))
        action = result.get("action")
        event = {"step": step, "actor": actor, "side": side, "action": action,
                 "observation_sha256": fingerprint(observation), **result}
        if on_action:
            on_action(event)
        if not isinstance(action, dict):
            raise ValueError(f"{side} returned no action at step {step}")
        _, error = core.GuandanGame.apply_action(state, actor, action)
        if error:
            raise ValueError(f"{side} illegal action at step {step}: {error}; {action}")
        diagnostics[side].add(result)
        transcript.append([actor, action])
    if state.get("game_over") or state["phase"] == "round_end":
        return {**round_outcome(state, candidate_team), "actions": max_actions,
                "trajectory_sha256": fingerprint(transcript)}
    raise RuntimeError(f"round exceeded {max_actions} actions; no score was imputed")


def _read_config(path: Optional[Path]) -> Dict:
    config = json.loads(path.read_text()) if path else {}
    if not isinstance(config, dict) or any(not key.startswith("bot_") for key in config):
        raise ValueError("policy config must be an object containing only bot_* settings")
    if "bot_mode" in config or "bot_think_time_ms" in config:
        raise ValueError("use --candidate/--baseline and --think-ms for mode and shared time budget")
    return config


def run_benchmark(core, args) -> Dict:
    if args.pairs < 1 or args.think_ms < 40 or args.max_actions < 1 or args.worker_timeout <= 0:
        raise ValueError("pairs/actions/timeout must be positive and think-ms must be >= 40")
    if args.pair_start < 0:
        raise ValueError("pair-start must be nonnegative")
    levels = [int(value) for value in args.levels.split(",")]
    if not levels or any(level < 2 or level > 14 for level in levels):
        raise ValueError("levels must be a comma-separated list in 2..14")
    roots = {"candidate": args.candidate_root.resolve(), "baseline": args.baseline_root.resolve()}
    refs = {side: getattr(args, f"{side}_ref") for side in roots}
    revisions = {side: resolve_revision(root, refs[side]) if refs[side] else None
                 for side, root in roots.items()}
    modes = {"candidate": args.candidate, "baseline": args.baseline}
    configs = {side: {**_read_config(getattr(args, f"{side}_config")), "bot_think_time_ms": args.think_ms}
               for side in roots}
    identities = {side: source_identity(root, revisions[side]) for side, root in roots.items()}
    referee_identity = getattr(core, "__benchmark_identity__", None) or source_identity(REPO_ROOT)
    records, diagnostics = [], {side: Diagnostics() for side in roots}
    report = {"schema_version": SCHEMA_VERSION, "status": "running",
              "benchmark_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "python": sys.version, "platform": platform.platform(), "clock": args.clock,
              "information": args.information, "seed": args.seed, "levels": levels,
              "requested_pairs": args.pairs, "pair_start": args.pair_start, "think_ms": args.think_ms,
              "max_actions": args.max_actions, "worker_timeout": args.worker_timeout,
              "referee": referee_identity, "policies": {
                  side: {"mode": modes[side], "requested_ref": refs[side],
                         "source": identities[side], "overrides": configs[side]}
                  for side in roots}, "records": records}
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    # Reserve all files before beginning; never overwrite another experiment.
    with contextlib.ExitStack() as stack:
        report_file = stack.enter_context(output.open("x"))
        games_file = stack.enter_context(output.with_suffix(".games.jsonl").open("x"))
        trace_file = stack.enter_context(output.with_suffix(".trace.jsonl").open("x")) if args.trace else None
        started = time.perf_counter()
        context = {}
        last_event = None
        try:
            for index in range(args.pair_start, args.pair_start + args.pairs):
                seed = derived_seed(args.seed, "deal", index)
                level = levels[index % len(levels)]
                initial = make_deal(core, seed, level)
                deal_hash = fingerprint(initial)
                # Alternate execution order as well as assigning both sides.
                for team in (("A", "B") if index % 2 == 0 else ("B", "A")):
                    context = {"pair_index": index, "deal_seed": seed, "level": level,
                               "candidate_team": team, "deal_sha256": deal_hash}
                    last_event = None

                    def on_action(event):
                        nonlocal last_event
                        last_event = event
                        if trace_file:
                            trace_file.write(json.dumps({**context, **event}, allow_nan=False) + "\n")
                            trace_file.flush()

                    with contextlib.ExitStack() as workers_stack:
                        workers = {side: workers_stack.enter_context(PolicyWorker(
                            roots[side], modes[side], configs[side], args.clock, args.worker_timeout,
                            revision=revisions[side], expected_identity=identities[side],
                        )) for side in roots}
                        for side, worker in workers.items():
                            unknown = configs[side].keys() - worker.defaults.keys()
                            if unknown:
                                raise ValueError(f"unknown {side} config keys: {sorted(unknown)}")
                            report["policies"][side]["effective_config"] = {
                                **worker.defaults, **configs[side], "bot_mode": modes[side],
                            }
                        result = play_round(core, initial, workers, team, seed, args.information,
                                            args.max_actions, diagnostics, on_action)
                    record = {**context, **result}
                    records.append(record)
                    games_file.write(json.dumps(record) + "\n")
                    games_file.flush()
                    if not args.quiet:
                        print(f"pair {index + 1}/{args.pair_start + args.pairs} candidate={team} level={level} "
                              f"net={result['net_points']:+d} actions={result['actions']}", file=sys.stderr)
            # A policy source changed mid-run => do not publish a mixed-version score.
            for side, root in roots.items():
                if source_identity(root, revisions[side])["files"] != identities[side]["files"]:
                    raise RuntimeError(f"{side} source changed during benchmark")
            if source_identity(REPO_ROOT)["files"] != referee_identity["files"]:
                raise RuntimeError("referee source changed during benchmark")
            if hashlib.sha256(Path(__file__).read_bytes()).hexdigest() != report["benchmark_sha256"]:
                raise RuntimeError("benchmark runner changed during benchmark")
            report["summary"] = summarize(records)
            report["by_level"] = {str(level): summarize([row for row in records if row["level"] == level])
                                  for level in sorted({row["level"] for row in records})}
            report["status"] = "completed"
        except (Exception, KeyboardInterrupt) as exc:
            report["status"] = "failed"
            report["failure"] = {"error": f"{type(exc).__name__}: {exc}", **context, "last_event": last_event}
        finally:
            report["elapsed_seconds"] = time.perf_counter() - started
            report["diagnostics"] = {side: data.report() for side, data in diagnostics.items()}
            report_file.write(json.dumps(report, indent=2, allow_nan=False) + "\n")
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="play each seeded deal twice, swapping policy teams")
    run.add_argument("--candidate", choices=POLICIES, default="auto")
    run.add_argument("--baseline", choices=POLICIES, default="heuristic")
    run.add_argument("--candidate-root", type=Path, default=REPO_ROOT, help="candidate repository/worktree")
    run.add_argument("--baseline-root", type=Path, default=REPO_ROOT, help="baseline repository/worktree")
    run.add_argument("--candidate-ref", help="Git commit/ref; omit to use candidate worktree bytes")
    run.add_argument("--baseline-ref", help="Git commit/ref; omit to use baseline worktree bytes")
    run.add_argument("--candidate-config", type=Path)
    run.add_argument("--baseline-config", type=Path)
    run.add_argument("--pairs", type=int, default=30)
    run.add_argument("--pair-start", type=int, default=0,
                     help="first global pair index (nonnegative), preserving deal seeds and levels")
    run.add_argument("--seed", type=int, default=20260919)
    run.add_argument("--levels", default="2,7,14")
    run.add_argument("--clock", choices=("fixed", "wall"), default="wall")
    run.add_argument("--think-ms", type=int, default=2000)
    run.add_argument("--information", choices=("public", "full"), default="public")
    run.add_argument("--max-actions", type=int, default=600)
    run.add_argument("--worker-timeout", type=float, default=120)
    run.add_argument("--output", type=Path, required=True)
    run.add_argument("--trace", action="store_true")
    run.add_argument("--quiet", action="store_true")
    worker = commands.add_parser("_worker", help=argparse.SUPPRESS)
    worker.add_argument("--root", type=Path, required=True)
    worker.add_argument("--revision", help=argparse.SUPPRESS)
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "_worker":
            return _worker_main(args.root, args.revision)
        report = run_benchmark(_install_runtime(REPO_ROOT), args)
        if report["status"] == "failed":
            print(report["failure"]["error"], file=sys.stderr)
            return 1
        summary = report["summary"]
        win, points = summary["win_rate"], summary["net_points_per_game"]
        print(f"{summary['pairs']} pairs / {summary['games']} games; {summary['verdict']}\n"
              f"Win rate {win['mean']:.1%}, 95% CI [{win['ci95'][0]:.1%}, {win['ci95'][1]:.1%}]\n"
              f"Net points/game {points['mean']:+.3f}, 95% CI [{points['ci95'][0]:+.3f}, {points['ci95'][1]:+.3f}]\n"
              f"Report: {args.output.resolve()}")
        return 0
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"benchmark error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
