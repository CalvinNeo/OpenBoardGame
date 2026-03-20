import base64
import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.memories import (
    build_html_document,
    esc,
    format_bool,
    format_timestamp,
    render_image,
    render_kv_table,
    render_table,
    section,
)
DEFAULT_CONFIG = {
    "rounds": 2,
    "turn_time_sec": 8,
}

DEFAULT_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#14b8a6",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#a16207",
]

CANVAS_WIDTH = 640
CANVAS_HEIGHT = 480

_PROMPT_POOL_CACHE: Optional[List[Dict[str, str]]] = None
_PROMPT_BAG: List[Dict[str, str]] = []


def _prompt_pool_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "fake_artist_words.json"


def _normalize_int(value: object, minimum: int) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < minimum:
        return None
    return parsed


def _normalize_time(value: object) -> Optional[int]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return int(parsed)


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = dict(DEFAULT_CONFIG)
    if not isinstance(config, dict):
        return cfg
    rounds = _normalize_int(config.get("rounds"), 1)
    if rounds is not None:
        cfg["rounds"] = rounds
    turn_time = _normalize_time(config.get("turn_time_sec"))
    if turn_time is not None:
        cfg["turn_time_sec"] = turn_time
    return cfg


def _load_prompt_pool() -> List[Dict[str, str]]:
    global _PROMPT_POOL_CACHE
    if _PROMPT_POOL_CACHE is not None:
        return list(_PROMPT_POOL_CACHE)
    pool: List[Dict[str, str]] = []
    path = _prompt_pool_path()
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            data = data.get("items") or data.get("words") or data.get("prompts") or data.get("entries")
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    category = item.get("category") or item.get("cat")
                    word = item.get("word") or item.get("text")
                else:
                    category = None
                    word = None
                if not isinstance(category, str) or not isinstance(word, str):
                    continue
                category = " ".join(category.strip().split())
                word = " ".join(word.strip().split())
                if category and word:
                    pool.append({"category": category, "word": word})
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"[fake_artist] failed to load prompts: {exc}", flush=True)
    if not pool:
        pool = [{"category": "动物", "word": "大象"}]
    _PROMPT_POOL_CACHE = pool
    return list(pool)


def _draw_prompt(pool: List[Dict[str, str]]) -> Dict[str, str]:
    global _PROMPT_BAG
    if not _PROMPT_BAG:
        _PROMPT_BAG = list(pool)
        random.shuffle(_PROMPT_BAG)
    if not _PROMPT_BAG:
        return {"category": "动物", "word": "大象"}
    return _PROMPT_BAG.pop()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _assign_bot_colors(state: Dict) -> None:
    used = {pdata.get("color") for pdata in state["players"].values() if pdata.get("color")}
    available = [color for color in DEFAULT_COLORS if color not in used]
    random.shuffle(available)
    for pid in state.get("turn_order", []):
        pdata = state["players"].get(pid)
        if not pdata or not pdata.get("is_bot"):
            continue
        if pdata.get("color"):
            continue
        if available:
            pdata["color"] = available.pop()


def _all_colors_selected(state: Dict) -> bool:
    for pdata in state.get("players", {}).values():
        if not pdata.get("color"):
            return False
    return True


def _set_turn_deadline(state: Dict) -> None:
    timeout_sec = state.get("config", {}).get("turn_time_sec", DEFAULT_CONFIG["turn_time_sec"])
    if not isinstance(timeout_sec, (int, float)) or timeout_sec <= 0:
        state["turn_deadline_ms"] = None
        state["pending_timeout"] = None
        return
    deadline = _now_ms() + int(timeout_sec * 1000)
    state["turn_deadline_ms"] = deadline
    state["pending_timeout"] = {"type": "draw", "at_ms": deadline}


def _start_drawing(state: Dict) -> None:
    order = state.get("turn_order", [])
    state["phase"] = "draw"
    state["round"] = 1
    start_index = int(state.get("game_start_index", 0)) % len(order) if order else 0
    state["round_start_index"] = start_index
    state["turn_step"] = 0
    state["turn_index"] = start_index
    state["current_turn"] = order[start_index] if order else None
    _set_turn_deadline(state)


def _snapshot_game(state: Dict, in_progress: bool) -> Dict:
    return {
        "index": int(state.get("game_index") or 1),
        "start_time": state.get("current_game_start_time"),
        "end_time": state.get("current_game_end_time"),
        "category": state.get("category"),
        "word": state.get("word"),
        "fake_player_id": state.get("fake_player_id"),
        "winner_side": state.get("winner_side"),
        "vote_round": state.get("vote_round"),
        "vote_counts": state.get("last_vote_counts") or {},
        "strokes": list(state.get("strokes", []) or []),
        "in_progress": in_progress,
    }


def _record_history(state: Dict) -> None:
    history = state.setdefault("history", [])
    if not isinstance(history, list):
        history = []
        state["history"] = history
    current_index = int(state.get("game_index") or 1)
    if any(entry.get("index") == current_index for entry in history if isinstance(entry, dict)):
        return
    entry = _snapshot_game(state, in_progress=False)
    entry["end_time"] = time.time()
    history.append(entry)


def _start_voting(state: Dict) -> None:
    state["phase"] = "vote"
    state["current_turn"] = None
    state["votes"] = {}
    state["vote_round"] = 1
    state["turn_deadline_ms"] = None
    state["pending_timeout"] = None


def _advance_turn(state: Dict, skipped: bool = False) -> Optional[Dict]:
    order = state.get("turn_order", [])
    if not order:
        return None
    total_rounds = int(state.get("config", {}).get("rounds", DEFAULT_CONFIG["rounds"]))
    current_round = int(state.get("round", 1))
    previous_turn = state.get("current_turn")
    round_start_index = int(state.get("round_start_index", 0)) % len(order)
    turn_step = int(state.get("turn_step", 0)) + 1
    if turn_step >= len(order):
        turn_step = 0
        current_round += 1
    if current_round > total_rounds:
        _start_voting(state)
        return {"type": "fake_artist:phase_vote"}
    state["round"] = current_round
    state["round_start_index"] = round_start_index
    state["turn_step"] = turn_step
    turn_index = (round_start_index + turn_step) % len(order)
    state["turn_index"] = turn_index
    state["current_turn"] = order[turn_index]
    _set_turn_deadline(state)
    if skipped:
        return {"type": "fake_artist:turn_timeout", "payload": {"player_id": previous_turn}}
    return None


def _vote_counts(state: Dict) -> Dict[str, int]:
    counts = {pid: 0 for pid in state.get("turn_order", [])}
    for target in (state.get("votes") or {}).values():
        if target in counts:
            counts[target] += 1
    return counts


def _finish_voting(state: Dict) -> Tuple[List[Dict], Optional[str]]:
    counts = _vote_counts(state)
    state["last_vote_counts"] = counts
    max_votes = max(counts.values()) if counts else 0
    top = [pid for pid, count in counts.items() if count == max_votes]
    if len(top) > 1:
        if state.get("vote_round", 1) == 1:
            state["phase"] = "revote"
            state["votes"] = {}
            state["vote_round"] = 2
            return [{"type": "fake_artist:revote"}], None
        state["winner_side"] = "fake"
    else:
        fake_id = state.get("fake_player_id")
        state["winner_side"] = "real" if top and top[0] == fake_id else "fake"
    if state["winner_side"] == "real":
        for pdata in state.get("players", {}).values():
            if pdata.get("role") == "real":
                pdata["score"] = pdata.get("score", 0) + 1
    else:
        fake_id = state.get("fake_player_id")
        if fake_id and fake_id in state.get("players", {}):
            state["players"][fake_id]["score"] = state["players"][fake_id].get("score", 0) + 2
    state["phase"] = "result"
    state["game_over"] = True
    state["current_game_end_time"] = time.time()
    _record_history(state)
    return [{"type": "fake_artist:result"}], None


class FakeArtistGame:
    game_id = "fake_artist"
    min_players = 4
    max_players = 10

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        order = [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]
        player_meta = {p["player_id"]: p for p in players}
        fake_id = random.choice(order) if order else None
        pool = _load_prompt_pool()
        prompt = _draw_prompt(pool)
        state_players = {}
        for pid in order:
            state_players[pid] = {
                "role": "fake" if pid == fake_id else "real",
                "color": None,
                "score": 0,
                "is_bot": bool(player_meta.get(pid, {}).get("is_bot")),
            }
        state = {
            "players": state_players,
            "turn_order": order,
            "current_turn": None,
            "turn_index": 0,
            "round": 1,
            "phase": "color_select",
            "strokes": [],
            "votes": {},
            "vote_round": 1,
            "config": cfg,
            "prompt_pool": pool,
            "category": prompt.get("category"),
            "word": prompt.get("word"),
            "fake_player_id": fake_id,
            "game_start_index": 0,
            "game_index": 1,
            "current_game_start_time": time.time(),
            "current_game_end_time": None,
            "history": [],
            "player_meta": player_meta,
            "game_over": False,
            "winner_side": None,
            "last_vote_counts": None,
            "turn_deadline_ms": None,
            "pending_timeout": None,
            "game_start_time": time.time(),
        }
        _assign_bot_colors(state)
        if _all_colors_selected(state):
            _start_drawing(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        phase = state.get("phase")
        if phase == "color_select":
            return ["choose_color"]
        if phase == "draw":
            if player_id == state.get("current_turn"):
                return ["submit_stroke"]
            return []
        if phase in ("vote", "revote"):
            if player_id not in state.get("votes", {}):
                return ["submit_vote"]
            return []
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "player not found"
        action_type = action.get("type")
        if state.get("game_over"):
            if action_type != "play_again":
                return [], "game over"
            return FakeArtistGame._handle_play_again(state)
        phase = state.get("phase")
        if action_type == "choose_color":
            if phase != "color_select":
                return [], "color selection closed"
            color = action.get("color")
            if color not in DEFAULT_COLORS:
                return [], "invalid color"
            for pid, pdata in state.get("players", {}).items():
                if pid != player_id and pdata.get("color") == color:
                    return [], "color already taken"
            state["players"][player_id]["color"] = color
            _assign_bot_colors(state)
            if _all_colors_selected(state):
                _start_drawing(state)
                return [{"type": "fake_artist:phase_draw"}], None
            return [{"type": "fake_artist:color_pick"}], None
        if phase == "draw":
            if action_type != "submit_stroke":
                return [], "invalid action"
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            points = action.get("points")
            if not isinstance(points, list) or not points:
                return [], "points required"
            cleaned: List[List[float]] = []
            for entry in points:
                if not isinstance(entry, (list, tuple)) or len(entry) < 2:
                    return [], "invalid points"
                try:
                    x = float(entry[0])
                    y = float(entry[1])
                except (TypeError, ValueError):
                    return [], "invalid points"
                if not (x == x and y == y):
                    return [], "invalid points"
                cleaned.append([x, y])
            pdata = state["players"][player_id]
            stroke = {
                "player_id": player_id,
                "color": pdata.get("color"),
                "points": cleaned,
                "round": state.get("round"),
                "turn_index": state.get("turn_index"),
            }
            state["strokes"].append(stroke)
            event = _advance_turn(state)
            events = [{"type": "fake_artist:stroke"}]
            if event:
                events.append(event)
            return events, None
        if phase in ("vote", "revote"):
            if action_type != "submit_vote":
                return [], "invalid action"
            target_id = action.get("target_id")
            if target_id not in state.get("players", {}):
                return [], "invalid target"
            if player_id in state.get("votes", {}):
                return [], "already voted"
            state["votes"][player_id] = target_id
            if len(state["votes"]) == len(state.get("turn_order", [])):
                return _finish_voting(state)
            return [{"type": "fake_artist:vote"}], None
        return [], "invalid action"

    @staticmethod
    def _handle_play_again(state: Dict) -> Tuple[List[Dict], Optional[str]]:
        order = state.get("turn_order", [])
        fake_id = random.choice(order) if order else None
        prompt = _draw_prompt(state.get("prompt_pool") or _load_prompt_pool())
        _record_history(state)
        if order:
            current_start = int(state.get("game_start_index", 0)) % len(order)
            state["game_start_index"] = (current_start + 1) % len(order)
        state["game_index"] = int(state.get("game_index") or 1) + 1
        state["current_game_start_time"] = time.time()
        state["current_game_end_time"] = None
        for pid, pdata in state.get("players", {}).items():
            pdata["role"] = "fake" if pid == fake_id else "real"
        state["fake_player_id"] = fake_id
        state["category"] = prompt.get("category")
        state["word"] = prompt.get("word")
        state["strokes"] = []
        state["votes"] = {}
        state["vote_round"] = 1
        state["winner_side"] = None
        state["last_vote_counts"] = None
        state["game_over"] = False
        _start_drawing(state)
        return [{"type": "fake_artist:play_again"}], None

    @staticmethod
    def resolve_timeout(state: Dict, now_ms: int) -> Optional[List[Dict]]:
        pending = state.get("pending_timeout")
        if not isinstance(pending, dict):
            return None
        try:
            at_ms = int(pending.get("at_ms", 0))
        except (TypeError, ValueError):
            return None
        if at_ms <= 0 or at_ms > now_ms:
            return None
        if state.get("phase") != "draw":
            state["pending_timeout"] = None
            state["turn_deadline_ms"] = None
            return None
        event = _advance_turn(state, skipped=True)
        return [event] if event else None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_meta = state.get("player_meta", {})
        order = state.get("turn_order", [])
        votes = state.get("votes", {}) or {}
        phase = state.get("phase")
        current_turn = state.get("current_turn")
        current_meta = player_meta.get(current_turn, {}) if current_turn else {}
        viewer_data = state.get("players", {}).get(viewer_id, {})
        role = viewer_data.get("role")
        word = state.get("word") if role == "real" or state.get("game_over") else None
        view_players = []
        for pid in order:
            meta = player_meta.get(pid, {})
            pdata = state.get("players", {}).get(pid, {})
            view_players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "color": pdata.get("color"),
                    "score": pdata.get("score", 0),
                    "voted": pid in votes,
                    "is_fake": bool(state.get("game_over") and pid == state.get("fake_player_id")),
                }
            )
        return {
            "phase": phase,
            "round": state.get("round"),
            "total_rounds": state.get("config", {}).get("rounds", DEFAULT_CONFIG["rounds"]),
            "category": state.get("category"),
            "word": word,
            "mask_word": "[ X ]",
            "your_role": role,
            "your_color": viewer_data.get("color"),
            "your_vote": votes.get(viewer_id),
            "players": view_players,
            "colors": list(DEFAULT_COLORS),
            "strokes": list(state.get("strokes", [])),
            "votes_submitted": len(votes),
            "vote_round": state.get("vote_round"),
            "vote_counts": state.get("last_vote_counts") if state.get("game_over") else None,
            "winner_side": state.get("winner_side") if state.get("game_over") else None,
            "fake_player_id": state.get("fake_player_id") if state.get("game_over") else None,
            "game_over": bool(state.get("game_over")),
            "current_turn": {
                "player_id": current_turn,
                "name": current_meta.get("name"),
                "seat": current_meta.get("seat"),
                "color": state.get("players", {}).get(current_turn, {}).get("color") if current_turn else None,
            }
            if current_turn
            else None,
            "turn_deadline_ms": state.get("turn_deadline_ms"),
            "actions": FakeArtistGame.get_legal_actions(state, viewer_id),
            "canvas": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        pdata = state.get("players", {}).get(bot_id)
        if not pdata or not pdata.get("is_bot"):
            return None
        phase = state.get("phase")
        if state.get("game_over"):
            return None
        if phase == "color_select" and not pdata.get("color"):
            used = {entry.get("color") for entry in state.get("players", {}).values() if entry.get("color")}
            choices = [color for color in DEFAULT_COLORS if color not in used]
            if choices:
                return {"type": "choose_color", "color": random.choice(choices), "delay_ms": 400}
        if phase == "draw" and bot_id == state.get("current_turn"):
            x1 = random.randint(20, CANVAS_WIDTH - 20)
            y1 = random.randint(20, CANVAS_HEIGHT - 20)
            x2 = random.randint(20, CANVAS_WIDTH - 20)
            y2 = random.randint(20, CANVAS_HEIGHT - 20)
            return {"type": "submit_stroke", "points": [[x1, y1], [x2, y2]], "delay_ms": 600}
        if phase in ("vote", "revote") and bot_id not in state.get("votes", {}):
            options = list(state.get("turn_order", []))
            if options:
                return {"type": "submit_vote", "target_id": random.choice(options), "delay_ms": 500}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

    @staticmethod
    def download_memories(state: Dict, room_id: Optional[str] = None) -> str:
        return build_memories_html(state, room_id)


def _points_to_path(points: List) -> str:
    cleaned: List[Tuple[float, float]] = []
    for entry in points:
        if not isinstance(entry, (list, tuple)) or len(entry) < 2:
            continue
        try:
            x = float(entry[0])
            y = float(entry[1])
        except (TypeError, ValueError):
            continue
        if x == x and y == y:
            cleaned.append((x, y))
    if len(cleaned) < 2:
        return ""
    head = cleaned[0]
    tail = cleaned[1:]
    parts = [f"M {head[0]:.2f} {head[1]:.2f}"]
    parts.extend(f"L {x:.2f} {y:.2f}" for x, y in tail)
    return " ".join(parts)


def _svg_data_url(svg: str) -> str:
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def _render_strokes_svg(strokes: List[Dict], width: int, height: int) -> str:
    paths: List[str] = []
    for stroke in strokes:
        points = stroke.get("points") or []
        if not isinstance(points, list):
            continue
        path = _points_to_path(points)
        if not path:
            continue
        color = stroke.get("color") or "#111827"
        paths.append(
            f'<path d="{path}" stroke="{esc(color, "#111827")}" stroke-width="4" '
            'fill="none" stroke-linecap="round" stroke-linejoin="round" />'
        )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">'
        '<rect width="100%" height="100%" fill="#ffffff" />'
        + "".join(paths)
        + "</svg>"
    )
    return _svg_data_url(svg)


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    game_id = FakeArtistGame.game_id
    status_label = "Game Over" if state.get("game_over") else "In Progress"
    header = [
        "<h1>Download Memories</h1>",
        f"<div class=\"meta\">Game: {esc(game_id, '-')} · Room: {esc(room_id, '-')}</div>",
        f"<div class=\"meta\">Status: {esc(status_label, status_label)}</div>",
    ]
    start_time = format_timestamp(state.get("game_start_time"))
    if start_time != "-":
        header.append(f"<div class=\"meta\">Game Start: {esc(start_time, start_time)}</div>")
    header.append(f"<div class=\"meta\">Generated: {esc(format_timestamp(time.time()), '-')}</div>")

    player_meta = state.get("player_meta", {})
    order = state.get("turn_order", [])
    player_rows: List[List[str]] = []
    for pid in order:
        meta = player_meta.get(pid, {})
        pdata = state.get("players", {}).get(pid, {})
        role = pdata.get("role") if state.get("game_over") else None
        player_rows.append(
            [
                esc(pid, "-"),
                esc(meta.get("name"), "-"),
                esc(meta.get("seat"), "-"),
                format_bool(meta.get("is_bot")),
                esc(role or "-", "-"),
                esc(pdata.get("score", 0), "0"),
            ]
        )
    players_section = section(
        "Players",
        render_table(["Player ID", "Name", "Seat", "Bot", "Role", "Score"], player_rows, empty_message="No players"),
    )

    cfg = state.get("config", {})
    config_rows = [
        ("Rounds", esc(cfg.get("rounds"), "-")),
        ("Turn Time (sec)", esc(cfg.get("turn_time_sec"), "-")),
    ]
    config_section = section("Config", render_kv_table(config_rows))

    canvas = state.get("canvas") or {}
    width = int(canvas.get("width") or CANVAS_WIDTH)
    height = int(canvas.get("height") or CANVAS_HEIGHT)

    entries: List[Dict] = []
    history = state.get("history")
    if isinstance(history, list):
        entries.extend([entry for entry in history if isinstance(entry, dict)])
    current_index = int(state.get("game_index") or (len(entries) + 1))
    if not any(entry.get("index") == current_index for entry in entries):
        entries.append(_snapshot_game(state, in_progress=not state.get("game_over")))
    entries.sort(key=lambda entry: int(entry.get("index") or 0))

    game_sections: List[str] = []
    for entry in entries:
        index = entry.get("index") or "?"
        in_progress = bool(entry.get("in_progress"))
        status = "In Progress" if in_progress else "Finished"
        fake_id = entry.get("fake_player_id")
        fake_name = player_meta.get(fake_id, {}).get("name") if fake_id else None
        winner_side = entry.get("winner_side")
        winner_label = "Real Artists" if winner_side == "real" else "Fake Artist" if winner_side == "fake" else "-"
        summary_rows = [
            ("Status", esc(status, status)),
            ("Category", esc(entry.get("category"), "-")),
            ("Word", esc(entry.get("word"), "-")),
            ("Fake Artist", esc(fake_name or fake_id or "-", "-")),
            ("Winner", esc(winner_label, "-")),
            ("Vote Round", esc(entry.get("vote_round"), "-")),
            ("Start Time", esc(format_timestamp(entry.get("start_time")), "-")),
            ("End Time", esc(format_timestamp(entry.get("end_time")), "-")),
        ]
        summary_table = render_kv_table(summary_rows)

        strokes = entry.get("strokes", []) or []
        drawing_url = _render_strokes_svg(strokes, width, height) if strokes else None
        drawing_block = render_image(drawing_url, alt="Final drawing")

        stroke_rows: List[List[str]] = []
        for idx, stroke in enumerate(strokes, start=1):
            pid = stroke.get("player_id")
            meta = player_meta.get(pid, {})
            mini_svg = _render_strokes_svg([stroke], width, height) if stroke.get("points") else None
            stroke_rows.append(
                [
                    esc(idx, "-"),
                    esc(pid, "-"),
                    esc(meta.get("name"), "-"),
                    esc(stroke.get("round"), "-"),
                    esc(stroke.get("color"), "-"),
                    render_image(mini_svg, alt="Stroke"),
                ]
            )
        strokes_table = render_table(
            ["#", "Player ID", "Name", "Round", "Color", "Stroke"],
            stroke_rows,
            empty_message="No strokes",
        )

        vote_counts = entry.get("vote_counts") or {}
        vote_rows = []
        for pid in order:
            meta = player_meta.get(pid, {})
            vote_rows.append([esc(pid, "-"), esc(meta.get("name"), "-"), esc(vote_counts.get(pid, 0), "0")])
        votes_table = render_table(["Player ID", "Name", "Votes"], vote_rows, empty_message="No votes")

        body = (
            summary_table
            + section("Final Drawing", drawing_block)
            + section("Strokes", strokes_table)
            + section("Vote Counts", votes_table)
        )
        game_sections.append(section(f"Game {index}", body))

    body = "\n".join(
        header
        + [
            players_section,
            config_section,
        ]
        + game_sections
    )
    return build_html_document("Fake Artist Memories", body)
