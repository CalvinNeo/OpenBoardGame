"""大家来找茬 (Spot the Difference): an independent-progress time trial.

One game draws a random set of pictures from the generated pool and picks a
random subset of the differences on each. Every player races through exactly
the same set in the same order, but each player has their own board, their own
clock and their own marks: nobody can take a difference away from anybody else.
The ranking is by completion time, so the only thing that matters is how fast
you clear your own five pictures.

There is no way to skip a picture. If the overall deadline arrives first, whoever
has not finished is ranked behind the finishers, ordered by how much they found.

Assets and the asset pipeline: scripts/gen_find_diff.py, designs/task194.md.
"""
import copy
import itertools
import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


GAME_ID = "find_diff"
IMAGE_DIR = Path(__file__).resolve().parent.parent / ".find_diff"
MANIFEST_PATH = IMAGE_DIR / "manifest.json"
IMAGE_URL_PREFIX = "/static/find_diff/"

# How many differences each generated picture carries. A race uses a subset.
DIFFS_PER_LEVEL = 5
DEFAULT_LEVELS = 5
DEFAULT_DIFFS = 3
DEFAULT_TOTAL_SECONDS = 600
MIN_TOTAL_SECONDS = 120
MAX_TOTAL_SECONDS = 3600
MAX_LEVELS = 12

# A miss only costs the player their own time: the lockout is the penalty.
MISS_COOLDOWN_MS = 2000
# Clicks may land slightly outside a tight object box without feeling unfair.
HIT_PADDING = 0.012
# Two differences sitting almost on top of each other read as one place to look,
# so a round only picks differences at least this far apart (fraction of width).
# 0.0625 of 1600 px is 100 px, unambiguous at any sensible display size.
ROUND_MIN_GAP = 0.0625
# A difference also has to survive being scaled down to the size people actually
# play at. A 1.24x scale or a mirrored near-symmetric object is obvious across a
# 1600 px picture and can be a two-hundred-pixel smudge on a phone, which reads as
# nothing being different rather than as a difference. Both numbers are measured
# by the asset pipeline on a reference render and stored per difference.
ROUND_MIN_CHANGED_PX = 250
ROUND_MIN_MEAN_DIFF = 20.0

STAGE_RACING = "racing"
STAGE_RESULTS = "results"
STAGE_GAME_OVER = "game_over"

MAX_LOG_ENTRIES = 80


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "guess"},
                "level": {"type": "integer", "minimum": 1, "maximum": MAX_LEVELS},
                "x": {"type": "number", "minimum": 0, "maximum": 1},
                "y": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["type", "level", "x", "y"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "continue"}},
            "required": ["type"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "levels": {"type": "integer", "minimum": 1, "maximum": MAX_LEVELS},
        "diffs": {"type": "integer", "minimum": 1, "maximum": DIFFS_PER_LEVEL},
        "total_seconds": {
            "type": "integer",
            "minimum": MIN_TOTAL_SECONDS,
            "maximum": MAX_TOTAL_SECONDS,
        },
    },
    "additionalProperties": False,
}

ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)

_LEVEL_CACHE: Optional[List[Dict]] = None


def _now_ms() -> int:
    return int(time.time() * 1000)


def load_levels(force: bool = False) -> List[Dict]:
    """Read the generated level manifest. Returns [] when assets are missing."""
    global _LEVEL_CACHE
    if _LEVEL_CACHE is not None and not force:
        return _LEVEL_CACHE
    levels: List[Dict] = []
    if MANIFEST_PATH.exists():
        try:
            raw = json.loads(MANIFEST_PATH.read_text())
        except (OSError, json.JSONDecodeError):
            raw = {}
        base_size = [int(v) for v in raw.get("size", [1600, 1200])]
        for entry in raw.get("levels", []):
            diffs = entry.get("diffs") or []
            if not diffs:
                continue
            if not (IMAGE_DIR / entry.get("a", "")).exists():
                continue
            parsed = []
            broken = False
            for d in diffs:
                patch = d.get("patch")
                if not patch or not (IMAGE_DIR / patch).exists():
                    broken = True
                    break
                parsed.append({
                    "name": d.get("name", ""),
                    "kind": d.get("kind", ""),
                    "box": [float(v) for v in d["box"]],
                    "patch": patch,
                    "at": [int(v) for v in d["at"]],
                    "size": [int(v) for v in d["size"]],
                    "ref_px": int(d.get("ref_px", 0)),
                    "ref_mean": float(d.get("ref_mean", 0.0)),
                })
            if broken:
                continue
            levels.append({
                "id": entry["id"],
                "title": entry.get("title", entry["id"]),
                "a": entry["a"],
                "base_size": base_size,
                "diffs": parsed,
            })
    _LEVEL_CACHE = levels
    return levels


def _name(state: Dict, player_id: str) -> str:
    return state.get("player_meta", {}).get(player_id, {}).get("name", player_id)


def _log(state: Dict, message: str) -> None:
    entries = state.setdefault("log", [])
    entries.append({"at_ms": _now_ms(), "message": message})
    if len(entries) > MAX_LOG_ENTRIES:
        del entries[: len(entries) - MAX_LOG_ENTRIES]


def _hit(box: List[float], x: float, y: float) -> bool:
    return (
        box[0] - HIT_PADDING <= x <= box[2] + HIT_PADDING
        and box[1] - HIT_PADDING <= y <= box[3] + HIT_PADDING
    )


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def _box_gap(a: Dict, b: Dict) -> int:
    ax0, ay0 = a["at"]
    ax1, ay1 = ax0 + a["size"][0], ay0 + a["size"][1]
    bx0, by0 = b["at"]
    bx1, by1 = bx0 + b["size"][0], by0 + b["size"][1]
    return max(max(0, ax0 - bx1, bx0 - ax1), max(0, ay0 - by1, by0 - ay1))


def _diff_strength(diff: Dict) -> float:
    # 1.0 means the difference sits exactly on the visibility bar. Manifests
    # written before the measurement existed carry no numbers, and excluding
    # those would empty the pool, so treat a missing score as comfortably fine.
    px = float(diff.get("ref_px", ROUND_MIN_CHANGED_PX * 10))
    mean = float(diff.get("ref_mean", ROUND_MIN_MEAN_DIFF * 10))
    return min(px / ROUND_MIN_CHANGED_PX, mean / ROUND_MIN_MEAN_DIFF)


def _pick_spread_diffs(level: Dict, want: int) -> List[int]:
    # Choose which differences this round uses, keeping them both far apart and
    # clearly visible at play size.
    #
    # A plain random sample fails on both counts: about a quarter of unconstrained
    # triples put two differences almost on top of each other, and it happily picks
    # a mirrored spoon that survives full resolution but not a phone screen. That is
    # what only-two-differences and there-is-no-third-difference both were.
    diffs = level["diffs"]
    indices = list(range(len(diffs)))
    if want >= len(indices):
        return sorted(indices)
    base = level.get("base_size") or [1600, 1200]
    width = base[0] or 1600
    scored = []
    for combo in itertools.combinations(indices, want):
        gaps = [_box_gap(diffs[i], diffs[j]) for i, j in itertools.combinations(combo, 2)]
        scored.append((
            min(gaps) if gaps else width,
            min(_diff_strength(diffs[i]) for i in combo),
            combo,
        ))
    target = ROUND_MIN_GAP * width

    # separated, and every difference clears the visibility bar
    good = [combo for sep, strength, combo in scored if sep >= target and strength >= 1.0]
    if good:
        return sorted(random.choice(good))

    # no such triple: keep the separation and take the strongest on offer, rather
    # than dropping to some arbitrary looser tier that might be worse still
    separated = [(strength, combo) for sep, strength, combo in scored if sep >= target]
    if separated:
        best = max(strength for strength, _ in separated)
        near = [combo for strength, combo in separated if strength >= best * 0.9]
        return sorted(random.choice(near))

    # nothing is well separated either, so take the most separated combination
    best_sep = max(sep for sep, _, _ in scored)
    near = [combo for sep, _, combo in scored if sep >= best_sep * 0.9]
    return sorted(random.choice(near or [max(scored)[2]]))


def _new_runner() -> Dict:
    return {
        "index": 0,
        "found": [],
        "misses": 0,
        "splits": [],
        "finished_ms": None,
        "cooldown_until": 0,
    }


def _runner_level(state: Dict, runner: Dict) -> Optional[Dict]:
    if runner["index"] >= len(state["run"]):
        return None
    return state["levels"][state["run"][runner["index"]]]


def _slots(state: Dict, level_id: str) -> List[int]:
    return state["plan"][level_id]


def _found_total(state: Dict, runner: Dict) -> int:
    per = state["config"]["diffs"]
    if runner["finished_ms"] is not None:
        return len(state["run"]) * per
    return runner["index"] * per + len(runner["found"])


def _rank_rows(state: Dict) -> List[Dict]:
    per = state["config"]["diffs"]
    total = len(state["run"]) * per
    rows = []
    for pid in state["turn_order"]:
        runner = state["players"][pid]
        done = runner["finished_ms"] is not None
        rows.append({
            "player_id": pid,
            "name": _name(state, pid),
            "is_bot": bool(state["player_meta"].get(pid, {}).get("is_bot", False)),
            "finished": done,
            "elapsed_ms": (runner["finished_ms"] - state["started_ms"]) if done else None,
            "levels_done": runner["index"] if not done else len(state["run"]),
            "found": _found_total(state, runner),
            "total": total,
            "misses": runner["misses"],
            "splits": [s - state["started_ms"] for s in runner["splits"]],
        })
    rows.sort(key=lambda row: (
        0 if row["finished"] else 1,
        row["elapsed_ms"] if row["finished"] else 0,
        -row["found"],
        row["name"],
    ))
    place = 0
    previous = None
    for index, row in enumerate(rows):
        key = (row["finished"], row["elapsed_ms"], -row["found"])
        if key != previous:
            place = index + 1
            previous = key
        row["place"] = place
    return rows


def _next_base_url(state: Dict, index: int) -> Optional[str]:
    if index + 1 >= len(state["run"]):
        return None
    return IMAGE_URL_PREFIX + state["levels"][state["run"][index + 1]]["a"]


def _patch_payload(level: Dict, slots: List[int]) -> List[Dict]:
    """The rectangles the browser stacks on the clean base to build this round."""
    return [
        {
            "slot": slot_index,
            "url": IMAGE_URL_PREFIX + level["diffs"][slot]["patch"],
            "at": level["diffs"][slot]["at"],
            "size": level["diffs"][slot]["size"],
        }
        for slot_index, slot in enumerate(slots)
    ]


def _review(state: Dict) -> List[Dict]:
    """Every picture of this race with the differences that were in play."""
    out = []
    for index, level_id in enumerate(state["run"]):
        level = state["levels"][level_id]
        slots = _slots(state, level_id)
        out.append({
            "index": index,
            "id": level["id"],
            "title": level["title"],
            "a_url": IMAGE_URL_PREFIX + level["a"],
            "base_size": level["base_size"],
            "patches": _patch_payload(level, slots),
            "diffs": [
                {
                    "slot": slot_index,
                    "box": level["diffs"][slot]["box"],
                    "name": level["diffs"][slot]["name"],
                    "kind": level["diffs"][slot]["kind"],
                }
                for slot_index, slot in enumerate(slots)
            ],
        })
    return out


def _finish_race(state: Dict, reason: str) -> List[Dict]:
    state["stage"] = STAGE_RESULTS
    state["pending_timeout"] = None
    state["continue_ready"] = []
    state["ranking"] = _rank_rows(state)
    if reason == "timeout":
        _log(state, "时间到，按完成进度排名")
    else:
        _log(state, "所有人都跑完了")
    return [{"type": "find_diff:race_end", "reason": reason}]


def _continue_target(state: Dict) -> int:
    humans = [
        pid for pid in state["turn_order"]
        if not state["player_meta"].get(pid, {}).get("is_bot", False)
    ]
    return len(humans) or len(state["turn_order"])


def _level_can_field_round(level: Dict, want: int) -> bool:
    # Whether this picture can always supply a round that is both well spread and
    # clearly visible. A picture that cannot is kept in the manifest but never drawn,
    # because a round that has to fall back to a smudge is exactly the round where a
    # player rightly says there is no third difference.
    diffs = level["diffs"]
    if not diffs:
        return False
    strong = [i for i in range(len(diffs)) if _diff_strength(diffs[i]) >= 1.0]
    if want >= len(diffs):
        return len(strong) == len(diffs)
    base = level.get("base_size") or [1600, 1200]
    width = base[0] or 1600
    target = ROUND_MIN_GAP * width
    for combo in itertools.combinations(strong, want):
        gaps = [_box_gap(diffs[combo[a]], diffs[combo[b]])
                for a, b in itertools.combinations(range(want), 2)]
        if not gaps or min(gaps) >= target:
            return True
    return False


def _deal_race(state: Dict) -> None:
    want = state["config"]["diffs"]
    pool = [level_id for level_id in state["level_pool"]
            if _level_can_field_round(state["levels"][level_id], want)]
    if not pool:
        raise ValueError(
            "no find_diff level can field a round with %d clearly visible differences" % want
        )
    count = min(state["config"]["levels"], len(pool))
    run = random.sample(pool, count)
    plan = {}
    for level_id in run:
        level = state["levels"][level_id]
        take = min(state["config"]["diffs"], len(level["diffs"]))
        plan[level_id] = _pick_spread_diffs(level, take)
    state["run"] = run
    state["plan"] = plan
    state["players"] = {pid: _new_runner() for pid in state["turn_order"]}
    now = _now_ms()
    state["started_ms"] = now
    state["deadline_ms"] = now + state["config"]["total_seconds"] * 1000
    state["pending_timeout"] = {"at_ms": state["deadline_ms"]}
    state["stage"] = STAGE_RACING
    state["continue_ready"] = []
    state["rematch_ready"] = []
    state["ranking"] = []
    state["game_over"] = False
    state["winners"] = []
    _log(state, f"开跑：{count} 张图，每张 {state['config']['diffs']} 处差异")


class FindDiffGame:
    game_id = GAME_ID
    min_players = 1
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        levels = load_levels()
        if not levels:
            raise ValueError(
                "find_diff assets are missing: run python3 scripts/gen_find_diff.py all"
            )
        cfg = dict(config or {})
        level_count = _clamp(int(cfg.get("levels", DEFAULT_LEVELS)), 1, MAX_LEVELS)
        level_count = min(level_count, len(levels))
        diff_count = _clamp(int(cfg.get("diffs", DEFAULT_DIFFS)), 1, DIFFS_PER_LEVEL)
        total_seconds = _clamp(
            int(cfg.get("total_seconds", DEFAULT_TOTAL_SECONDS)),
            MIN_TOTAL_SECONDS, MAX_TOTAL_SECONDS,
        )
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        state = {
            "game_id": GAME_ID,
            "version": 2,
            "config": {
                "levels": level_count,
                "diffs": diff_count,
                "total_seconds": total_seconds,
            },
            "turn_order": ids,
            "player_count": len(ids),
            "player_meta": {p["player_id"]: copy.deepcopy(p) for p in ordered},
            "level_pool": [lv["id"] for lv in levels],
            "levels": {lv["id"]: lv for lv in levels},
            "run": [],
            "plan": {},
            "players": {},
            "started_ms": 0,
            "deadline_ms": 0,
            "pending_timeout": None,
            "stage": STAGE_RACING,
            "continue_ready": [],
            "rematch_ready": [],
            "ranking": [],
            "game_over": False,
            "winners": [],
            "seq": 0,
            "log": [],
        }
        _deal_race(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state["stage"] == STAGE_GAME_OVER:
            if state["player_meta"].get(player_id, {}).get("is_bot", False):
                return []
            return [] if player_id in state["rematch_ready"] else ["play_again"]
        if state["stage"] == STAGE_RESULTS:
            return [] if player_id in state["continue_ready"] else ["continue"]
        runner = state["players"][player_id]
        if runner["finished_ms"] is not None:
            return []
        if runner.get("cooldown_until", 0) > _now_ms():
            return []
        return ["guess"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        action_type = action["type"]

        if action_type == "play_again":
            if state["stage"] != STAGE_GAME_OVER:
                return [], "race is not over"
            if player_id in state["rematch_ready"]:
                return [], "already ready"
            state["rematch_ready"].append(player_id)
            if len(state["rematch_ready"]) >= _continue_target(state):
                state["log"] = []
                _deal_race(state)
            return [], None

        if action_type == "continue":
            if state["stage"] != STAGE_RESULTS:
                return [], "race is not at the results stage"
            if player_id in state["continue_ready"]:
                return [], "already ready"
            state["continue_ready"].append(player_id)
            if len(state["continue_ready"]) >= _continue_target(state):
                state["stage"] = STAGE_GAME_OVER
                state["game_over"] = True
                ranking = state.get("ranking") or _rank_rows(state)
                state["ranking"] = ranking
                best = ranking[0]["place"] if ranking else None
                state["winners"] = [row["player_id"] for row in ranking if row["place"] == best]
                _log(state, "本局结束")
            return [], None

        if state["stage"] != STAGE_RACING:
            return [], "race is not running"
        runner = state["players"][player_id]
        if runner["finished_ms"] is not None:
            return [], "already finished"
        if action["level"] != runner["index"] + 1:
            return [], "stale level"
        now = _now_ms()
        if now >= state["deadline_ms"]:
            return _finish_race(state, "timeout"), None
        if runner.get("cooldown_until", 0) > now:
            return [], "locked out after a miss"

        x = float(action["x"])
        y = float(action["y"])
        level = _runner_level(state, runner)
        if level is None:
            return [], "no level in play"
        slots = _slots(state, level["id"])

        for slot_index in runner["found"]:
            if _hit(level["diffs"][slots[slot_index]]["box"], x, y):
                return [], None

        for slot_index, slot in enumerate(slots):
            if slot_index in runner["found"]:
                continue
            if not _hit(level["diffs"][slot]["box"], x, y):
                continue
            runner["found"].append(slot_index)
            runner["found"].sort()
            state["seq"] += 1
            events = [{
                "type": "find_diff:found",
                "player_id": player_id,
                "slot": slot_index,
                "level": runner["index"] + 1,
            }]
            if len(runner["found"]) < len(slots):
                return events, None
            runner["splits"].append(now)
            runner["index"] += 1
            runner["found"] = []
            if runner["index"] >= len(state["run"]):
                runner["finished_ms"] = now
                elapsed = now - state["started_ms"]
                _log(state, f"{_name(state, player_id)} 全部完成，用时 {elapsed / 1000:.1f} 秒")
                events.append({"type": "find_diff:player_finished", "player_id": player_id})
                if all(
                    state["players"][pid]["finished_ms"] is not None
                    for pid in state["turn_order"]
                ):
                    events.extend(_finish_race(state, "complete"))
            else:
                events.append({"type": "find_diff:level_cleared", "player_id": player_id})
            return events, None

        runner["misses"] += 1
        runner["cooldown_until"] = now + MISS_COOLDOWN_MS
        state["seq"] += 1
        _log(state, f"{_name(state, player_id)} 点错了，锁定 2 秒")
        return [{
            "type": "find_diff:miss",
            "player_id": player_id,
            "cooldown_until_ms": runner["cooldown_until"],
        }], None

    @staticmethod
    def resolve_timeout(state: Dict, now_ms: int) -> List[Dict]:
        pending = state.get("pending_timeout")
        if not isinstance(pending, dict) or state.get("stage") != STAGE_RACING:
            return []
        if now_ms < int(pending.get("at_ms", 0)):
            return []
        return _finish_race(state, "timeout")

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        runner = state["players"].get(viewer_id) or _new_runner()
        level = _runner_level(state, runner)
        per = state["config"]["diffs"]
        finished = runner["finished_ms"] is not None
        slots = _slots(state, level["id"]) if level else []

        # Only the viewer's own marks carry boxes. Another player's marks would
        # hand their opponent the answer, because everybody races the same plan.
        own_found = []
        if level:
            for slot_index in runner["found"]:
                diff = level["diffs"][slots[slot_index]]
                own_found.append({
                    "slot": slot_index,
                    "box": diff["box"],
                    "name": diff["name"],
                    "kind": diff["kind"],
                })

        players = []
        for pid in state["turn_order"]:
            other = state["players"][pid]
            done = other["finished_ms"] is not None
            players.append({
                "player_id": pid,
                "name": _name(state, pid),
                "is_bot": bool(state["player_meta"].get(pid, {}).get("is_bot", False)),
                "levels_done": len(state["run"]) if done else other["index"],
                "found": _found_total(state, other),
                "total": len(state["run"]) * per,
                "level_found": 0 if done else len(other["found"]),
                "misses": other["misses"],
                "finished": done,
                "elapsed_ms": (other["finished_ms"] - state["started_ms"]) if done else None,
            })

        view = {
            "game_id": GAME_ID,
            "stage": state["stage"],
            "config": dict(state["config"]),
            "levels_total": len(state["run"]),
            "diffs_per_level": per,
            "started_ms": state["started_ms"],
            "deadline_ms": state["deadline_ms"],
            "server_now_ms": _now_ms(),
            "you": {
                "level_index": runner["index"],
                "finished": finished,
                "elapsed_ms": (runner["finished_ms"] - state["started_ms"]) if finished else None,
                "misses": runner["misses"],
                "splits": [s - state["started_ms"] for s in runner["splits"]],
                "cooldown_until_ms": runner.get("cooldown_until", 0),
                "found": own_found,
                "remaining": 0 if finished else len(slots) - len(runner["found"]),
                "level": None if not level else {
                    "id": level["id"],
                    "title": level["title"],
                    "a_url": IMAGE_URL_PREFIX + level["a"],
                    "base_size": level["base_size"],
                    "patches": _patch_payload(level, slots),
                    "total": len(slots),
                    # The clean base of the next picture carries no answers, so
                    # shipping it early lets the browser warm it up and shortens
                    # the blackout between pictures.
                    "next_base_url": _next_base_url(state, runner["index"]),
                },
            },
            "players": players,
            "legal_actions": FindDiffGame.get_legal_actions(state, viewer_id),
            "continue_ready": list(state.get("continue_ready", [])),
            "rematch_ready": list(state.get("rematch_ready", [])),
            "continue_target": _continue_target(state),
            "game_over": bool(state.get("game_over")),
            "winners": list(state.get("winners", [])),
            "log": list(state.get("log", []))[-30:],
            "miss_cooldown_ms": MISS_COOLDOWN_MS,
        }
        if state["stage"] in (STAGE_RESULTS, STAGE_GAME_OVER):
            view["ranking"] = state.get("ranking") or _rank_rows(state)
            view["review"] = _review(state)
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if bot_id not in state.get("players", {}):
            return None
        if state["stage"] == STAGE_RESULTS:
            if bot_id in state["continue_ready"]:
                return None
            return {"type": "continue"}
        if state["stage"] != STAGE_RACING:
            return None
        runner = state["players"][bot_id]
        if runner["finished_ms"] is not None:
            return None
        if runner.get("cooldown_until", 0) > _now_ms():
            return None
        level = _runner_level(state, runner)
        if level is None:
            return None
        slots = _slots(state, level["id"])
        open_slots = [i for i in range(len(slots)) if i not in runner["found"]]
        if not open_slots:
            return None
        # A plain random hunter: no evaluation, no planning, so this stays out of
        # the strategic-AI catalog.
        payload = {"type": "guess", "level": runner["index"] + 1}
        if random.random() < 0.2:
            payload["x"] = round(random.random(), 4)
            payload["y"] = round(random.random(), 4)
            return payload
        box = level["diffs"][slots[random.choice(open_slots)]]["box"]
        payload["x"] = round(random.uniform(box[0], box[2]), 4)
        payload["y"] = round(random.uniform(box[1], box[3]), 4)
        return payload

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("game_id") != GAME_ID:
            raise ValueError("invalid find_diff save")
        state = copy.deepcopy(payload)
        for key in ("turn_order", "players", "player_meta", "levels", "level_pool",
                    "run", "plan"):
            if key not in state:
                raise ValueError(f"find_diff save missing {key}")
        state.setdefault("ranking", [])
        state.setdefault("continue_ready", [])
        state.setdefault("rematch_ready", [])
        state.setdefault("log", [])
        for pid in state["turn_order"]:
            state["players"].setdefault(pid, _new_runner())
        return state
