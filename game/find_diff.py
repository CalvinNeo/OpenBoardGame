"""大家来找茬 (Spot the Difference): a real-time race over generated photo pairs.

Every level is a pair of photographs that differ in exactly five places. The
pictures and the five ground-truth boxes are produced by
scripts/gen_find_diff.py and read from .find_diff/manifest.json.

All players look at the same pair at the same time and click what they spot.
The first player to click inside an unfound difference claims it; a click that
lands nowhere costs a point and locks that player out for a short moment. A round
ends when all five differences are claimed or when the round timer expires, and
then the table pauses so everybody can read the result before the next picture.

Rules source: designs/task194.md.
"""
import copy
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

DIFFS_PER_LEVEL = 5
DEFAULT_ROUNDS = 4
DEFAULT_ROUND_SECONDS = 120
MIN_ROUND_SECONDS = 45
MAX_ROUND_SECONDS = 600

POINTS_PER_FIND = 3
MISS_PENALTY = 1
MISS_COOLDOWN_MS = 2000
# Clicks may land slightly outside a tight object box without feeling unfair.
HIT_PADDING = 0.012

STAGE_PLAYING = "playing"
STAGE_ROUND_RESULT = "round_result"
STAGE_GAME_OVER = "game_over"

MAX_LOG_ENTRIES = 80


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "guess"},
                "round": {"type": "integer", "minimum": 1},
                "x": {"type": "number", "minimum": 0, "maximum": 1},
                "y": {"type": "number", "minimum": 0, "maximum": 1},
            },
            "required": ["type", "round", "x", "y"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "continue"},
                "round": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "round"],
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
        "rounds": {"type": "integer", "minimum": 1, "maximum": 12},
        "round_seconds": {
            "type": "integer",
            "minimum": MIN_ROUND_SECONDS,
            "maximum": MAX_ROUND_SECONDS,
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
        for entry in raw.get("levels", []):
            diffs = entry.get("diffs") or []
            if len(diffs) != DIFFS_PER_LEVEL:
                continue
            if not (IMAGE_DIR / entry.get("a", "")).exists():
                continue
            if not (IMAGE_DIR / entry.get("b", "")).exists():
                continue
            levels.append({
                "id": entry["id"],
                "title": entry.get("title", entry["id"]),
                "a": entry["a"],
                "b": entry["b"],
                "diffs": [
                    {
                        "name": d.get("name", ""),
                        "kind": d.get("kind", ""),
                        "box": [float(v) for v in d["box"]],
                    }
                    for d in diffs
                ],
            })
    _LEVEL_CACHE = levels
    return levels


def _name(state: Dict, player_id: str) -> str:
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name", player_id)


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


def _found_indices(state: Dict) -> List[int]:
    return [entry["index"] for entry in state.get("found", [])]


def _start_round(state: Dict) -> None:
    # level_pool holds ids, levels maps an id to the full server-side truth.
    pool = state["level_pool"]
    if not pool:
        raise ValueError("no find_diff levels available")
    if not state["level_queue"]:
        queue = list(pool)
        random.shuffle(queue)
        # Never show the same picture twice in a row across a queue refill.
        last = state.get("last_level_id")
        if len(queue) > 1 and queue[0] == last:
            queue[0], queue[1] = queue[1], queue[0]
        state["level_queue"] = queue
    level_id = state["level_queue"].pop(0)
    level = state["levels"][level_id]
    state["level"] = copy.deepcopy(level)
    state["last_level_id"] = level_id
    state["found"] = []
    state["cooldown_until"] = {}
    state["round_started_ms"] = _now_ms()
    seconds = int(state["config"].get("round_seconds", DEFAULT_ROUND_SECONDS))
    state["deadline_ms"] = state["round_started_ms"] + seconds * 1000
    state["pending_timeout"] = {"at_ms": state["deadline_ms"]}
    state["stage"] = STAGE_PLAYING
    state["continue_ready"] = []
    state["round_summary"] = None
    _log(state, f"第 {state['round_index'] + 1} 轮：{level['title']}")


def _finish_round(state: Dict, reason: str) -> List[Dict]:
    level = state["level"]
    found = state["found"]
    claimed = {entry["index"] for entry in found}
    missed = [
        {"index": i, "box": d["box"], "name": d["name"], "kind": d["kind"]}
        for i, d in enumerate(level["diffs"])
        if i not in claimed
    ]
    per_player: Dict[str, int] = {}
    for entry in found:
        per_player[entry["player_id"]] = per_player.get(entry["player_id"], 0) + 1
    state["round_summary"] = {
        "round": state["round_index"] + 1,
        "level_id": level["id"],
        "title": level["title"],
        "reason": reason,
        "found": copy.deepcopy(found),
        "missed": missed,
        "per_player": per_player,
    }
    state["stage"] = STAGE_ROUND_RESULT
    state["pending_timeout"] = None
    state["continue_ready"] = []
    if reason == "timeout":
        _log(state, f"时间到，本轮找到 {len(found)}/{DIFFS_PER_LEVEL} 处")
    else:
        _log(state, f"本轮全部 {DIFFS_PER_LEVEL} 处差异都已找到")
    return [{"type": "find_diff:round_end", "reason": reason}]


def _advance_after_result(state: Dict) -> None:
    if state["round_index"] + 1 >= int(state["config"].get("rounds", DEFAULT_ROUNDS)):
        state["stage"] = STAGE_GAME_OVER
        state["game_over"] = True
        best = max(state["scores"].values()) if state["scores"] else 0
        state["winners"] = sorted(
            pid for pid, score in state["scores"].items() if score == best and best > 0
        )
        _log(state, "游戏结束")
        return
    state["round_index"] += 1
    _start_round(state)


def _continue_target(state: Dict) -> int:
    return len([
        pid for pid in state["turn_order"]
        if not state["player_meta"].get(pid, {}).get("is_bot", False)
    ]) or len(state["turn_order"])


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
        rounds = int(cfg.get("rounds", DEFAULT_ROUNDS))
        rounds = max(1, min(12, rounds))
        seconds = int(cfg.get("round_seconds", DEFAULT_ROUND_SECONDS))
        seconds = max(MIN_ROUND_SECONDS, min(MAX_ROUND_SECONDS, seconds))
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        state = {
            "game_id": GAME_ID,
            "version": 1,
            "config": {"rounds": rounds, "round_seconds": seconds},
            "turn_order": ids,
            "player_meta": {p["player_id"]: copy.deepcopy(p) for p in ordered},
            "player_count": len(ids),
            "scores": {pid: 0 for pid in ids},
            "misses": {pid: 0 for pid in ids},
            "level_pool": [lv["id"] for lv in levels],
            "levels": {lv["id"]: lv for lv in levels},
            "level_queue": [],
            "last_level_id": None,
            "level": None,
            "found": [],
            "cooldown_until": {},
            "round_index": 0,
            "round_started_ms": 0,
            "deadline_ms": 0,
            "pending_timeout": None,
            "round_summary": None,
            "continue_ready": [],
            "rematch_ready": [],
            "stage": STAGE_PLAYING,
            "game_over": False,
            "winners": [],
            "seq": 0,
            "log": [],
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("scores", {}):
            return []
        if state["stage"] == STAGE_GAME_OVER:
            if state["player_meta"].get(player_id, {}).get("is_bot", False):
                return []
            return [] if player_id in state["rematch_ready"] else ["play_again"]
        if state["stage"] == STAGE_ROUND_RESULT:
            return [] if player_id in state["continue_ready"] else ["continue"]
        if state["cooldown_until"].get(player_id, 0) > _now_ms():
            return []
        return ["guess"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state.get("scores", {}):
            return [], "player not found"
        action_type = action["type"]

        if action_type == "play_again":
            if state["stage"] != STAGE_GAME_OVER:
                return [], "game is not over"
            if player_id in state["rematch_ready"]:
                return [], "already ready"
            state["rematch_ready"].append(player_id)
            if len(state["rematch_ready"]) >= _continue_target(state):
                FindDiffGame._reset_for_rematch(state)
            return [], None

        if action.get("round") != state["round_index"] + 1:
            return [], "stale round"

        if action_type == "continue":
            if state["stage"] != STAGE_ROUND_RESULT:
                return [], "round is not finished"
            if player_id in state["continue_ready"]:
                return [], "already ready"
            state["continue_ready"].append(player_id)
            if len(state["continue_ready"]) >= _continue_target(state):
                _advance_after_result(state)
            return [], None

        if state["stage"] != STAGE_PLAYING:
            return [], "round is not running"
        now = _now_ms()
        if state["cooldown_until"].get(player_id, 0) > now:
            return [], "locked out after a miss"
        if now > state.get("deadline_ms", 0):
            return _finish_round(state, "timeout"), None

        x = float(action["x"])
        y = float(action["y"])
        level = state["level"]
        found_indices = set(_found_indices(state))

        for index, diff in enumerate(level["diffs"]):
            if index in found_indices:
                if _hit(diff["box"], x, y):
                    return [], None
        for index, diff in enumerate(level["diffs"]):
            if index in found_indices:
                continue
            if _hit(diff["box"], x, y):
                state["found"].append({
                    "index": index,
                    "player_id": player_id,
                    "player_name": _name(state, player_id),
                    "at_ms": now,
                    "box": diff["box"],
                    "name": diff["name"],
                    "kind": diff["kind"],
                })
                state["found"].sort(key=lambda entry: entry["at_ms"])
                state["scores"][player_id] += POINTS_PER_FIND
                state["seq"] += 1
                _log(state, f"{_name(state, player_id)} 找到第 {index + 1} 处差异 (+{POINTS_PER_FIND})")
                events = [{
                    "type": "find_diff:found",
                    "player_id": player_id,
                    "index": index,
                }]
                if len(state["found"]) >= len(level["diffs"]):
                    events.extend(_finish_round(state, "complete"))
                return events, None

        state["misses"][player_id] = state["misses"].get(player_id, 0) + 1
        state["scores"][player_id] = max(0, state["scores"][player_id] - MISS_PENALTY)
        state["cooldown_until"][player_id] = now + MISS_COOLDOWN_MS
        state["seq"] += 1
        _log(state, f"{_name(state, player_id)} 点错了 (-{MISS_PENALTY})")
        return [{
            "type": "find_diff:miss",
            "player_id": player_id,
            "cooldown_until_ms": state["cooldown_until"][player_id],
        }], None

    @staticmethod
    def resolve_timeout(state: Dict, now_ms: int) -> List[Dict]:
        pending = state.get("pending_timeout")
        if not isinstance(pending, dict) or state.get("stage") != STAGE_PLAYING:
            return []
        if now_ms < int(pending.get("at_ms", 0)):
            return []
        return _finish_round(state, "timeout")

    @staticmethod
    def _reset_for_rematch(state: Dict) -> None:
        ids = state["turn_order"]
        state["scores"] = {pid: 0 for pid in ids}
        state["misses"] = {pid: 0 for pid in ids}
        state["level_queue"] = []
        state["last_level_id"] = None
        state["round_index"] = 0
        state["rematch_ready"] = []
        state["game_over"] = False
        state["winners"] = []
        state["log"] = []
        _start_round(state)

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        level = state.get("level") or {}
        stage = state["stage"]
        found = [
            {
                "index": entry["index"],
                "player_id": entry["player_id"],
                "player_name": entry["player_name"],
                "box": entry["box"],
                "at_ms": entry["at_ms"],
            }
            for entry in state.get("found", [])
        ]
        players = [
            {
                "player_id": pid,
                "name": _name(state, pid),
                "score": state["scores"].get(pid, 0),
                "misses": state["misses"].get(pid, 0),
                "is_bot": bool(state["player_meta"].get(pid, {}).get("is_bot", False)),
            }
            for pid in state["turn_order"]
        ]
        view = {
            "game_id": GAME_ID,
            "stage": stage,
            "round": state["round_index"] + 1,
            "rounds": int(state["config"].get("rounds", DEFAULT_ROUNDS)),
            "round_seconds": int(state["config"].get("round_seconds", DEFAULT_ROUND_SECONDS)),
            "level": {
                "id": level.get("id"),
                "title": level.get("title"),
                "a_url": IMAGE_URL_PREFIX + level.get("a", ""),
                "b_url": IMAGE_URL_PREFIX + level.get("b", ""),
                "total": len(level.get("diffs", [])),
            },
            "found": found,
            "remaining": max(0, len(level.get("diffs", [])) - len(found)),
            "players": players,
            "scores": dict(state["scores"]),
            "deadline_ms": state.get("deadline_ms", 0),
            "server_now_ms": _now_ms(),
            "cooldown_until_ms": state.get("cooldown_until", {}).get(viewer_id, 0),
            "legal_actions": FindDiffGame.get_legal_actions(state, viewer_id),
            "game_over": bool(state.get("game_over")),
            "winners": list(state.get("winners", [])),
            "continue_ready": list(state.get("continue_ready", [])),
            "rematch_ready": list(state.get("rematch_ready", [])),
            "continue_target": _continue_target(state),
            "log": list(state.get("log", []))[-30:],
            "points_per_find": POINTS_PER_FIND,
            "miss_penalty": MISS_PENALTY,
        }
        if stage in (STAGE_ROUND_RESULT, STAGE_GAME_OVER) and state.get("round_summary"):
            summary = copy.deepcopy(state["round_summary"])
            view["round_summary"] = summary
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if bot_id not in state.get("scores", {}):
            return None
        if state["stage"] == STAGE_ROUND_RESULT:
            if bot_id in state["continue_ready"]:
                return None
            return {"type": "continue", "round": state["round_index"] + 1}
        if state["stage"] != STAGE_PLAYING:
            return None
        if state["cooldown_until"].get(bot_id, 0) > _now_ms():
            return None
        level = state.get("level") or {}
        diffs = level.get("diffs") or []
        open_indices = [i for i in range(len(diffs)) if i not in set(_found_indices(state))]
        if not open_indices:
            return None
        # A plain random hunter: no evaluation, no planning, so this stays out of
        # the strategic-AI catalog.
        if random.random() < 0.25:
            return {
                "type": "guess",
                "round": state["round_index"] + 1,
                "x": round(random.random(), 4),
                "y": round(random.random(), 4),
            }
        target = diffs[random.choice(open_indices)]["box"]
        return {
            "type": "guess",
            "round": state["round_index"] + 1,
            "x": round(random.uniform(target[0], target[2]), 4),
            "y": round(random.uniform(target[1], target[3]), 4),
        }

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("game_id") != GAME_ID:
            raise ValueError("invalid find_diff save")
        state = copy.deepcopy(payload)
        for key in ("turn_order", "scores", "player_meta", "level", "levels", "level_pool"):
            if key not in state:
                raise ValueError(f"find_diff save missing {key}")
        state.setdefault("found", [])
        state.setdefault("cooldown_until", {})
        state.setdefault("misses", {pid: 0 for pid in state["turn_order"]})
        state.setdefault("log", [])
        state.setdefault("rematch_ready", [])
        state.setdefault("continue_ready", [])
        return state
