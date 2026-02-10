import base64
import copy
import json
import random
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.memories import (
    build_html_document,
    esc,
    format_bool,
    format_timestamp,
    render_image,
    render_json,
    render_kv_table,
    render_table,
    section,
)
TOTAL_ROUNDS = 5
TOOL_KEYS = [
    "shoelaces",
    "pixel_grid",
    "icon_set",
    "aeiou",
    "shape_stacker",
    "thruster",
    "synthesizer",
]
TOOL_LABELS = {
    "shoelaces": "Shoelaces",
    "pixel_grid": "Pixel Grid",
    "icon_set": "Icon Set",
    "aeiou": "AEIOU Collage",
    "shape_stacker": "Shape Stacker",
    "thruster": "Thruster",
    "synthesizer": "Synthesizer",
}

DEFAULT_CONFIG = {
    "allow_duplicate_targets": False,
    "disabled_tools": [],
}

_ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
_IMAGE_DIR = Path(__file__).resolve().parent.parent / ".cyber_pictures"
_IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def _normalize_disabled_tools(value: object) -> List[str]:
    if not isinstance(value, list):
        return []
    cleaned: List[str] = []
    for entry in value:
        if isinstance(entry, str) and entry in TOOL_KEYS and entry not in cleaned:
            cleaned.append(entry)
    return cleaned


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if isinstance(config, dict):
        allow_dupes = config.get("allow_duplicate_targets")
        if isinstance(allow_dupes, bool):
            cfg["allow_duplicate_targets"] = allow_dupes
        cfg["disabled_tools"] = _normalize_disabled_tools(config.get("disabled_tools"))
    return cfg


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _load_image_files() -> List[str]:
    if not _IMAGE_DIR.exists():
        return []
    images = []
    for entry in _IMAGE_DIR.iterdir():
        if not entry.is_file():
            continue
        if entry.suffix.lower() not in _ALLOWED_EXTS:
            continue
        images.append(entry.name)
    images.sort()
    return images


def _image_data_url(filename: Optional[str]) -> Optional[str]:
    if not filename:
        return None
    path = _IMAGE_DIR / filename
    if not path.exists() or not path.is_file():
        return None
    mime = _IMAGE_MIME.get(path.suffix.lower(), "application/octet-stream")
    try:
        raw = path.read_bytes()
    except OSError:
        return None
    encoded = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _build_pool(all_images: List[str]) -> List[str]:
    pool = list(all_images)
    random.shuffle(pool)
    return pool


def _coords() -> List[str]:
    rows = ["A", "B", "C", "D"]
    cols = ["1", "2", "3", "4"]
    return [f"{row}{col}" for row in rows for col in cols]


def _active_tool_indices(config: Optional[Dict]) -> List[int]:
    if not isinstance(config, dict):
        return list(range(len(TOOL_KEYS)))
    disabled = set(config.get("disabled_tools") or [])
    return [idx for idx, key in enumerate(TOOL_KEYS) if key not in disabled]


def _build_tool_queue(order: List[str], tool_indices: List[int]) -> List[int]:
    if not order or not tool_indices:
        return []
    count = min(len(order), len(tool_indices))
    return random.sample(tool_indices, count)


def _matrix_from_files(files: List[str]) -> List[Dict]:
    rows = ["A", "B", "C", "D"]
    cols = ["1", "2", "3", "4"]
    matrix = []
    for idx, filename in enumerate(files):
        row = rows[idx // 4]
        col = cols[idx % 4]
        coord = f"{row}{col}"
        matrix.append(
            {
                "id": coord,
                "filename": filename,
                "url": f"/static/cards/{filename}",
            }
        )
    return matrix


def _assign_tools(state: Dict) -> None:
    order = state.get("turn_order", [])
    active_indices = _active_tool_indices(state.get("config"))
    if not active_indices:
        raise ValueError("at least one tool must be enabled")
    tool_queue = state.get("tool_queue", [])
    if tool_queue:
        for idx, pid in enumerate(order):
            state["players"][pid]["tool_index"] = tool_queue[idx % len(tool_queue)]
        return
    for idx, pid in enumerate(order):
        state["players"][pid]["tool_index"] = active_indices[idx % len(active_indices)]


def _assign_targets(state: Dict) -> None:
    order = state.get("turn_order", [])
    coords = _coords()
    allow_dupes = state.get("config", {}).get("allow_duplicate_targets") is True
    if allow_dupes:
        picks = [random.choice(coords) for _ in order]
    else:
        picks = random.sample(coords, len(order)) if order else []
    for pid, coord in zip(order, picks):
        state["players"][pid]["target"] = coord


def _draw_matrix(state: Dict) -> None:
    all_images = state.get("all_images", [])
    if len(all_images) < 16:
        raise ValueError("not enough images in .cyber_pictures (need at least 16)")
    pool = state.get("image_pool", [])
    index = state.get("image_pool_index", 0)
    if len(pool) < 16 or len(pool) - index < 16:
        pool = _build_pool(all_images)
        index = 0
    batch = pool[index : index + 16]
    state["image_pool"] = pool
    state["image_pool_index"] = index + 16
    state["matrix"] = _matrix_from_files(batch)


def _reset_round_state(state: Dict) -> None:
    state["submissions"] = {}
    state["guesses"] = {}
    state["work_order"] = []
    state["work_map"] = {}
    state["owner_work"] = {}
    state["reveal"] = []
    state["round_scores"] = []


def _deal_round(state: Dict) -> None:
    state["phase"] = "crafting"
    _reset_round_state(state)
    _assign_tools(state)
    _assign_targets(state)
    _draw_matrix(state)


def _start_guessing(state: Dict) -> None:
    order = list(state.get("turn_order", []))
    random.shuffle(order)
    work_order = []
    work_map = {}
    owner_work = {}
    for pid in order:
        work_id = uuid.uuid4().hex[:8]
        work_order.append(work_id)
        work_map[work_id] = pid
        owner_work[pid] = work_id
    state["work_order"] = work_order
    state["work_map"] = work_map
    state["owner_work"] = owner_work
    state["guesses"] = {}
    state["phase"] = "guessing"


def _valid_coord(coord: object) -> bool:
    if not isinstance(coord, str):
        return False
    coord = coord.strip().upper()
    if len(coord) != 2:
        return False
    return coord in _coords()


def _score_round(state: Dict) -> None:
    order = state.get("turn_order", [])
    work_order = state.get("work_order", [])
    work_map = state.get("work_map", {})
    submissions = state.get("submissions", {})
    guesses = state.get("guesses", {})
    player_meta = state.get("player_meta", {})

    score_map = {
        pid: {"guess_points": 0, "artist_points": 0, "delta": 0, "total_score": 0}
        for pid in order
    }
    reveal_entries = []

    for work_id in work_order:
        owner_id = work_map.get(work_id)
        if not owner_id:
            continue
        target = state["players"][owner_id].get("target")
        submission = submissions.get(owner_id)
        guesses_list = []
        for guesser_id, guess_map in guesses.items():
            if guesser_id == owner_id:
                continue
            guess = guess_map.get(work_id)
            if guess is None:
                continue
            correct = guess == target
            guesses_list.append(
                {
                    "player_id": guesser_id,
                    "name": player_meta.get(guesser_id, {}).get("name"),
                    "guess": guess,
                    "correct": correct,
                }
            )
            if correct:
                score_map[guesser_id]["guess_points"] += 1
                score_map[owner_id]["artist_points"] += 1
        reveal_entries.append(
            {
                "work_id": work_id,
                "owner_id": owner_id,
                "owner_name": player_meta.get(owner_id, {}).get("name"),
                "target": target,
                "submission": submission,
                "guesses": guesses_list,
            }
        )

    round_scores = []
    for pid in order:
        points = score_map[pid]
        points["delta"] = points["guess_points"] + points["artist_points"]
        state["players"][pid]["score"] += points["delta"]
        points["total_score"] = state["players"][pid]["score"]
        round_scores.append(
            {
                "player_id": pid,
                "name": player_meta.get(pid, {}).get("name"),
                "guess_points": points["guess_points"],
                "artist_points": points["artist_points"],
                "delta": points["delta"],
                "total_score": points["total_score"],
            }
        )

    state["reveal"] = reveal_entries
    state["round_scores"] = round_scores
    _record_round_history(state)

    if state.get("round", 1) >= TOTAL_ROUNDS:
        state["phase"] = "ended"
        state["game_over"] = True
    else:
        state["phase"] = "scoring"


def _record_round_history(state: Dict) -> None:
    history = state.setdefault("round_history", [])
    player_meta = state.get("player_meta", {})
    players_snapshot = []
    for pid in state.get("turn_order", []):
        pdata = state.get("players", {}).get(pid, {})
        meta = player_meta.get(pid, {})
        players_snapshot.append(
            {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "tool_index": pdata.get("tool_index"),
                "target": pdata.get("target"),
                "score": pdata.get("score", 0),
            }
        )
    history.append(
        {
            "round": state.get("round"),
            "matrix": copy.deepcopy(state.get("matrix", [])),
            "players": players_snapshot,
            "submissions": copy.deepcopy(state.get("submissions", {})),
            "guesses": copy.deepcopy(state.get("guesses", {})),
            "reveal": copy.deepcopy(state.get("reveal", [])),
            "round_scores": copy.deepcopy(state.get("round_scores", [])),
            "scores_after": {pid: state.get("players", {}).get(pid, {}).get("score", 0) for pid in state.get("turn_order", [])},
        }
    )


class CyberPicturesGame:
    game_id = "cyber_pictures"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        all_images = _load_image_files()
        if len(all_images) < 16:
            raise ValueError("not enough images in .cyber_pictures (need at least 16)")
        active_indices = _active_tool_indices(cfg)
        if not active_indices:
            raise ValueError("at least one tool must be enabled")

        state_players = {
            pid: {
                "score": 0,
                "tool_index": None,
                "target": None,
            }
            for pid in order
        }

        tool_queue = _build_tool_queue(order, active_indices)
        state = {
            "config": cfg,
            "round": 1,
            "total_rounds": TOTAL_ROUNDS,
            "phase": "crafting",
            "turn_order": order,
            "players": state_players,
            "player_meta": player_meta,
            "tool_queue": tool_queue,
            "all_images": all_images,
            "image_pool": _build_pool(all_images),
            "image_pool_index": 0,
            "matrix": [],
            "submissions": {},
            "guesses": {},
            "work_order": [],
            "work_map": {},
            "owner_work": {},
            "reveal": [],
            "round_scores": [],
            "round_history": [],
            "game_over": False,
            "game_start_time": time.time(),
        }
        _deal_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "crafting":
            if player_id in state.get("submissions", {}):
                return []
            return ["submit_crafting"]
        if phase == "guessing":
            if player_id in state.get("guesses", {}):
                return []
            return ["submit_guesses"]
        if phase == "scoring":
            if state.get("round", 1) < TOTAL_ROUNDS:
                return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        if not isinstance(action, dict):
            return [], "invalid action"

        phase = state.get("phase")
        action_type = action.get("type")

        if phase == "crafting":
            if action_type != "submit_crafting":
                return [], "invalid action"
            if player_id in state.get("submissions", {}):
                return [], "already submitted"
            submission = action.get("submission")
            if not isinstance(submission, dict):
                return [], "submission required"
            tool = submission.get("tool")
            tool_index = state["players"][player_id].get("tool_index")
            expected = TOOL_KEYS[tool_index] if tool_index is not None else None
            if tool != expected:
                return [], "tool mismatch"
            state["submissions"][player_id] = submission
            if len(state["submissions"]) == len(state.get("turn_order", [])):
                _start_guessing(state)
            return [], None

        if phase == "guessing":
            if action_type != "submit_guesses":
                return [], "invalid action"
            if player_id in state.get("guesses", {}):
                return [], "already guessed"
            guesses = action.get("guesses")
            if not isinstance(guesses, dict):
                return [], "guesses required"
            required = [
                work_id
                for work_id in state.get("work_order", [])
                if state.get("work_map", {}).get(work_id) != player_id
            ]
            cleaned = {}
            for work_id in required:
                if work_id not in guesses:
                    return [], "missing guess"
                guess = guesses.get(work_id)
                if not _valid_coord(guess):
                    return [], "invalid guess"
                cleaned[work_id] = guess.strip().upper()
            state["guesses"][player_id] = cleaned
            if len(state["guesses"]) == len(state.get("turn_order", [])):
                _score_round(state)
            return [], None

        if phase == "scoring":
            if action_type != "next_round":
                return [], "invalid action"
            if state.get("round", 1) >= TOTAL_ROUNDS:
                return [], "game over"
            state["round"] += 1
            queue = state.get("tool_queue", [])
            if queue:
                state["tool_queue"] = [queue[-1]] + queue[:-1]
            _deal_round(state)
            return [], None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        order = state.get("turn_order", [])
        player_meta = state.get("player_meta", {})
        players_view = []
        for pid in order:
            pdata = state["players"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": player_meta.get(pid, {}).get("name"),
                    "seat": player_meta.get(pid, {}).get("seat"),
                    "is_bot": player_meta.get(pid, {}).get("is_bot"),
                    "score": pdata.get("score", 0),
                    "tool_index": pdata.get("tool_index"),
                    "submitted": pid in state.get("submissions", {}),
                    "guessed": pid in state.get("guesses", {}),
                }
            )

        view = {
            "round": state.get("round"),
            "total_rounds": state.get("total_rounds"),
            "phase": state.get("phase"),
            "matrix": state.get("matrix", []),
            "players": players_view,
            "you": viewer_id if viewer_id in state.get("players", {}) else None,
        }

        if viewer_id in state.get("players", {}):
            view["your_tool"] = state["players"][viewer_id].get("tool_index")
            view["your_target"] = state["players"][viewer_id].get("target")
            view["submitted"] = viewer_id in state.get("submissions", {})
            view["guessed"] = viewer_id in state.get("guesses", {})
            if viewer_id in state.get("submissions", {}):
                view["your_submission"] = state.get("submissions", {}).get(viewer_id)

        if state.get("phase") == "guessing":
            works = []
            for work_id in state.get("work_order", []):
                owner_id = state.get("work_map", {}).get(work_id)
                submission = state.get("submissions", {}).get(owner_id)
                works.append(
                    {
                        "work_id": work_id,
                        "submission": submission,
                        "is_self": owner_id == viewer_id,
                    }
                )
            view["works"] = works
            if viewer_id in state.get("guesses", {}):
                view["your_guesses"] = state.get("guesses", {}).get(viewer_id)

        if state.get("phase") in ("scoring", "ended"):
            view["reveal"] = state.get("reveal", [])
            view["round_scores"] = state.get("round_scores", [])
            view["allow_next_round"] = state.get("phase") == "scoring" and state.get("round", 1) < TOTAL_ROUNDS

        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")
        if phase == "crafting":
            if bot_id in state.get("submissions", {}):
                return None
            tool_index = state["players"][bot_id].get("tool_index")
            tool_key = TOOL_KEYS[tool_index] if tool_index is not None else "shoelaces"
            submission = _bot_submission(tool_key)
            return {"type": "submit_crafting", "submission": submission, "delay_ms": random.randint(400, 900)}
        if phase == "guessing":
            if bot_id in state.get("guesses", {}):
                return None
            coords = _coords()
            guesses = {}
            for work_id in state.get("work_order", []):
                if state.get("work_map", {}).get(work_id) == bot_id:
                    continue
                guesses[work_id] = random.choice(coords)
            return {"type": "submit_guesses", "guesses": guesses, "delay_ms": random.randint(400, 900)}
        if phase == "scoring":
            if state.get("round", 1) < TOTAL_ROUNDS:
                return {"type": "next_round", "delay_ms": random.randint(500, 1000)}
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


def _bot_submission(tool_key: str) -> Dict:
    width = 360
    height = 360
    if tool_key == "shoelaces":
        paths = []
        for _ in range(random.randint(1, 2)):
            points = []
            start_x = random.randint(40, width - 40)
            start_y = random.randint(40, height - 40)
            points.append({"x": start_x, "y": start_y})
            for _ in range(random.randint(4, 8)):
                points.append(
                    {
                        "x": random.randint(20, width - 20),
                        "y": random.randint(20, height - 20),
                    }
                )
            paths.append({"points": points, "color": "#111111", "width": 4})
        return {"tool": "shoelaces", "width": width, "height": height, "paths": paths}
    if tool_key == "pixel_grid":
        palette = [
            "#ef4444",
            "#f97316",
            "#eab308",
            "#22c55e",
            "#3b82f6",
            "#8b5cf6",
            "#000000",
            "#ffffff",
            "#8b5e34",
        ]
        cells = [random.choice(palette) for _ in range(9)]
        return {"tool": "pixel_grid", "width": width, "height": height, "cells": cells}
    if tool_key == "icon_set":
        icons = ["😀", "🐱", "🌳", "🏠", "🚗", "⭐", "⚽", "🎧", "📚", "🍎", "🧩", "🎈"]
        items = []
        for _ in range(random.randint(2, 5)):
            items.append(
                {
                    "emoji": random.choice(icons),
                    "x": random.randint(40, width - 40),
                    "y": random.randint(40, height - 40),
                    "rotation": random.choice([0, 90, 180, 270]),
                }
            )
        return {"tool": "icon_set", "width": width, "height": height, "icons": items}
    if tool_key == "aeiou":
        letters = []
        for _ in range(random.randint(2, 6)):
            letters.append(
                {
                    "char": random.choice(["A", "E", "I", "O", "U"]),
                    "x": random.randint(40, width - 40),
                    "y": random.randint(40, height - 40),
                    "rotation": random.randint(0, 359),
            }
        )
        return {"tool": "aeiou", "width": width, "height": height, "letters": letters}
    if tool_key == "thruster":
        paths = []
        attempts = random.randint(1, 3)
        for _ in range(attempts):
            points = []
            x = width * 0.1
            y = height * 0.5
            points.append({"x": x, "y": y})
            for _ in range(random.randint(12, 18)):
                x += width / 14
                y += random.randint(-40, 40)
                y = max(10, min(height - 10, y))
                points.append({"x": x, "y": y})
            paths.append({"points": points, "color": "#111111", "width": 4})
        return {"tool": "thruster", "width": width, "height": height, "paths": paths}
    if tool_key == "synthesizer":
        values = [random.randint(0, 100) for _ in range(10)]
        return {"tool": "synthesizer", "width": width, "height": height, "values": values}
    shapes = ["square", "rectangle", "triangle", "circle", "arch", "ellipse", "hexagon"]
    items = []
    for _ in range(random.randint(2, 5)):
        items.append(
            {
                "shape": random.choice(shapes),
                "x": random.randint(60, width - 60),
                "y": random.randint(60, height - 60),
                "rotation": random.randint(0, 359),
            }
        )
    return {"tool": "shape_stacker", "width": width, "height": height, "shapes": items}


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    game_id = CyberPicturesGame.game_id
    status_label = "Game Over" if state.get("game_over") else "In Progress"
    header = [
        '<h1>Download Memories</h1>',
        f'<div class="meta">Game: {esc(game_id, "-")} · Room: {esc(room_id, "-")}</div>',
        f'<div class="meta">Status: {esc(status_label, status_label)}</div>',
    ]
    start_time = format_timestamp(state.get("game_start_time"))
    if start_time != "-":
        header.append(f'<div class="meta">Game Start: {esc(start_time, start_time)}</div>')
    header.append(f'<div class="meta">Generated: {esc(format_timestamp(time.time()), "-")}</div>')

    player_meta = state.get("player_meta", {})
    order = state.get("turn_order", [])
    player_rows: List[List[str]] = []
    for pid in order:
        meta = player_meta.get(pid, {})
        pdata = state.get("players", {}).get(pid, {})
        tool_index = pdata.get("tool_index")
        tool_key = TOOL_KEYS[tool_index] if tool_index is not None and tool_index < len(TOOL_KEYS) else None
        player_rows.append(
            [
                esc(pid, "-"),
                esc(meta.get("name"), "-"),
                esc(meta.get("seat"), "-"),
                format_bool(meta.get("is_bot")),
                esc(tool_key, "-"),
                esc(pdata.get("target"), "-"),
                esc(pdata.get("score", 0)),
            ]
        )
    players_section = section(
        "Players",
        render_table(
            ["Player ID", "Name", "Seat", "Bot", "Tool", "Target", "Score"],
            player_rows,
            empty_message="No players",
        ),
    )

    config_rows = [
        ("Allow Duplicate Targets", esc(format_bool(state.get("config", {}).get("allow_duplicate_targets")))),
        ("Total Rounds", esc(state.get("total_rounds"), "-")),
    ]
    config_section = section("Config", render_kv_table(config_rows))

    render_jobs: List[Dict] = []

    def add_submission_canvas(submission: Optional[Dict]) -> str:
        canvas_id = f"cyber-canvas-{len(render_jobs)}"
        render_jobs.append({"id": canvas_id, "submission": submission})
        return f'<canvas id="{canvas_id}" width="180" height="180" class="mem-image"></canvas>'

    def render_matrix(matrix: List[Dict]) -> str:
        cells = []
        for cell in matrix:
            filename = cell.get("filename")
            image_src = _image_data_url(filename)
            coord = cell.get("id") or "-"
            url = cell.get("url") or "-"
            cell_html = (
                '<div class="matrix-cell">'
                f'<div class="small">{esc(coord, coord)}</div>'
                f'<div class="small">{esc(filename, "-")}</div>'
                f'<div class="small">{esc(url, "-")}</div>'
                f'{render_image(image_src, alt=coord)}'
                '</div>'
            )
            cells.append(cell_html)
        return '<div class="grid">' + ''.join(cells) + '</div>' if cells else '<div class="muted">No matrix</div>'

    def render_round(entry: Dict, label: str) -> str:
        matrix_html = render_matrix(entry.get("matrix", []) or [])

        players_snapshot = entry.get("players", []) or []
        player_rows_round: List[List[str]] = []
        for player in players_snapshot:
            tool_index = player.get("tool_index")
            tool_key = TOOL_KEYS[tool_index] if tool_index is not None and tool_index < len(TOOL_KEYS) else None
            player_rows_round.append(
                [
                    esc(player.get("player_id"), "-"),
                    esc(player.get("name"), "-"),
                    esc(player.get("seat"), "-"),
                    format_bool(player.get("is_bot")),
                    esc(tool_key, "-"),
                    esc(player.get("target"), "-"),
                ]
            )
        player_table = render_table(
            ["Player ID", "Name", "Seat", "Bot", "Tool", "Target"],
            player_rows_round,
            empty_message="No players",
        )

        submissions = entry.get("submissions", {}) or {}
        submission_cards = []
        for pid, submission in submissions.items():
            meta = player_meta.get(pid, {})
            card = (
                '<div class="card">'
                f'<div class="small">Submission · {esc(meta.get("name") or pid, pid)}</div>'
                f'{add_submission_canvas(submission)}'
                '<details><summary class="small">Raw Submission JSON</summary>'
                f'{render_json(submission)}'
                '</details>'
                '</div>'
            )
            submission_cards.append(card)
        submissions_html = (
            ''.join(submission_cards) if submission_cards else '<div class="muted">No submissions</div>'
        )

        guesses = entry.get("guesses", {}) or {}
        guess_rows: List[List[str]] = []
        for guesser_id, guess_map in guesses.items():
            meta = player_meta.get(guesser_id, {})
            guess_rows.append(
                [
                    esc(guesser_id, "-"),
                    esc(meta.get("name"), "-"),
                    render_json(guess_map),
                ]
            )
        guesses_table = render_table(
            ["Guesser ID", "Name", "Guesses (work_id → coord)"],
            guess_rows,
            empty_message="No guesses",
        )

        reveal_cards = []
        for idx, item in enumerate(entry.get("reveal", []) or []):
            owner_name = item.get("owner_name") or item.get("owner_id") or "-"
            header = f'#{idx + 1} {esc(owner_name, owner_name)} · Target {esc(item.get("target"), "-")}'
            card = (
                '<div class="card">'
                f'<div class="small">{header}</div>'
                f'{add_submission_canvas(item.get("submission"))}'
            )
            guesses_list = item.get("guesses", []) or []
            if guesses_list:
                guess_lines = []
                for guess in guesses_list:
                    label = f'{esc(guess.get("name") or guess.get("player_id"), "-")} → {esc(guess.get("guess"), "-")}'
                    if guess.get("correct") is True:
                        label += " (correct)"
                    elif guess.get("correct") is False:
                        label += " (wrong)"
                    guess_lines.append(f'<div class="small">{label}</div>')
                card += ''.join(guess_lines)
            card += '</div>'
            reveal_cards.append(card)
        reveal_html = ''.join(reveal_cards) if reveal_cards else '<div class="muted">No reveal data</div>'

        score_rows: List[List[str]] = []
        for score in entry.get("round_scores", []) or []:
            score_rows.append(
                [
                    esc(score.get("player_id"), "-"),
                    esc(score.get("name"), "-"),
                    esc(score.get("guess_points"), "0"),
                    esc(score.get("artist_points"), "0"),
                    esc(score.get("delta"), "0"),
                    esc(score.get("total_score"), "0"),
                ]
            )
        scores_table = render_table(
            ["Player ID", "Name", "Guess Points", "Artist Points", "Round Δ", "Total"],
            score_rows,
            empty_message="No scores",
        )

        return (
            '<div class="card">'
            f'<h3>{esc(label, label)}</h3>'
            '<div class="small">Matrix</div>'
            f'{matrix_html}'
            '<div class="small">Player Tools & Targets</div>'
            f'{player_table}'
            '<div class="small">Submissions</div>'
            f'{submissions_html}'
            '<div class="small">Guesses</div>'
            f'{guesses_table}'
            '<div class="small">Reveal</div>'
            f'{reveal_html}'
            '<div class="small">Scores</div>'
            f'{scores_table}'
            '</div>'
        )

    round_blocks: List[str] = []
    history = state.get("round_history", [])
    if isinstance(history, list):
        for entry in history:
            if not isinstance(entry, dict):
                continue
            round_num = entry.get("round", "-")
            round_blocks.append(render_round(entry, f"Round {round_num}"))

    phase = state.get("phase")
    if phase in ("crafting", "guessing"):
        current_entry = {
            "round": state.get("round"),
            "matrix": copy.deepcopy(state.get("matrix", [])),
            "players": [
                {
                    "player_id": pid,
                    "name": player_meta.get(pid, {}).get("name"),
                    "seat": player_meta.get(pid, {}).get("seat"),
                    "is_bot": player_meta.get(pid, {}).get("is_bot"),
                    "tool_index": state.get("players", {}).get(pid, {}).get("tool_index"),
                    "target": state.get("players", {}).get(pid, {}).get("target"),
                }
                for pid in order
            ],
            "submissions": copy.deepcopy(state.get("submissions", {})),
            "guesses": copy.deepcopy(state.get("guesses", {})),
            "reveal": [],
            "round_scores": [],
        }
        round_blocks.append(render_round(current_entry, f"Round {state.get('round')} (In Progress · {phase})"))

    rounds_section = section(
        "Rounds",
        "".join(round_blocks) if round_blocks else '<div class="muted">No rounds recorded</div>',
    )

    jobs_json = json.dumps(render_jobs, ensure_ascii=False).replace("</", "<\/")
    script = """
const CYBER_JOBS = __CYBER_JOBS__;
const CYBER_CANVAS_SIZE = 360;
const CYBER_TEXT_SIZE = 36;
const CYBER_SYNTH_BARS = 10;
const CYBER_SHAPE_SPECS = {
  square: { w: 70, h: 70 },
  rectangle: { w: 90, h: 60 },
  triangle: { w: 90, h: 70 },
  circle: { w: 70, h: 70 },
  arch: { w: 90, h: 60 },
  ellipse: { w: 90, h: 60 },
  hexagon: { w: 90, h: 70 },
};

function drawSmoothPath(ctx, points) {
  if (!points || points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawCyberShape(ctx, shapeKey, x, y, rotation) {
  const spec = CYBER_SHAPE_SPECS[shapeKey];
  if (!spec) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((rotation || 0) * Math.PI) / 180);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 4;
  if (shapeKey === "square" || shapeKey === "rectangle") {
    ctx.strokeRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h);
  } else if (shapeKey === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(spec.w, spec.h) / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeKey === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(0, 0, spec.w / 2, spec.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeKey === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -spec.h / 2);
    ctx.lineTo(spec.w / 2, spec.h / 2);
    ctx.lineTo(-spec.w / 2, spec.h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeKey === "arch") {
    const radius = spec.w / 2;
    const arcY = -spec.h / 2 + radius;
    ctx.beginPath();
    ctx.moveTo(-spec.w / 2, spec.h / 2);
    ctx.lineTo(-spec.w / 2, arcY);
    ctx.arc(0, arcY, radius, Math.PI, 0, true);
    ctx.lineTo(spec.w / 2, spec.h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeKey === "hexagon") {
    const dx = spec.w * 0.25;
    ctx.beginPath();
    ctx.moveTo(-spec.w / 2 + dx, -spec.h / 2);
    ctx.lineTo(spec.w / 2 - dx, -spec.h / 2);
    ctx.lineTo(spec.w / 2, 0);
    ctx.lineTo(spec.w / 2 - dx, spec.h / 2);
    ctx.lineTo(-spec.w / 2 + dx, spec.h / 2);
    ctx.lineTo(-spec.w / 2, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function renderSubmission(canvas, submission) {
  if (!canvas || !submission) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sourceW = submission.width || CYBER_CANVAS_SIZE;
  const sourceH = submission.height || CYBER_CANVAS_SIZE;
  const scale = Math.min(canvas.width / sourceW, canvas.height / sourceH);
  const offsetX = (canvas.width - sourceW * scale) / 2;
  const offsetY = (canvas.height - sourceH * scale) / 2;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const tool = submission.tool;
  if (tool === "shoelaces") {
    const paths = submission.paths || [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((path) => {
      const points = path.points || [];
      if (points.length < 2) return;
      ctx.strokeStyle = path.color || "#111111";
      ctx.lineWidth = path.width || 4;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
    });
  } else if (tool === "thruster") {
    const paths = submission.paths || [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((path) => {
      const points = path.points || [];
      if (points.length < 2) return;
      ctx.strokeStyle = path.color || "#111111";
      ctx.lineWidth = path.width || 4;
      drawSmoothPath(ctx, points);
    });
  } else if (tool === "pixel_grid") {
    const cells = submission.cells || [];
    const cellW = sourceW / 3;
    const cellH = sourceH / 3;
    for (let idx = 0; idx < 9; idx += 1) {
      const color = cells[idx] || "#ffffff";
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.strokeStyle = "#e5e7eb";
      ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
    }
  } else if (tool === "icon_set") {
    const icons = submission.icons || [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = CYBER_TEXT_SIZE + "px serif";
    icons.forEach((icon) => {
      if (!icon) return;
      ctx.save();
      ctx.translate(icon.x, icon.y);
      ctx.rotate(((icon.rotation || 0) * Math.PI) / 180);
      ctx.fillText(icon.emoji || "", 0, 0);
      ctx.restore();
    });
  } else if (tool === "aeiou") {
    const letters = submission.letters || [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold " + CYBER_TEXT_SIZE + "px sans-serif";
    letters.forEach((letter) => {
      if (!letter) return;
      ctx.save();
      ctx.translate(letter.x, letter.y);
      ctx.rotate(((letter.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = "#111827";
      ctx.fillText(letter.char || "", 0, 0);
      ctx.restore();
    });
  } else if (tool === "synthesizer") {
    const values = submission.values || [];
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, sourceW, sourceH);
    const gap = Math.max(2, Math.round(sourceW * 0.01));
    const barW = (sourceW - gap * (CYBER_SYNTH_BARS - 1)) / CYBER_SYNTH_BARS;
    for (let i = 0; i < CYBER_SYNTH_BARS; i += 1) {
      const value = Math.max(0, Math.min(100, Number(values[i] || 0)));
      const barH = (sourceH * value) / 100;
      const x = i * (barW + gap);
      const y = sourceH - barH;
      ctx.fillStyle = "#39ff14";
      ctx.fillRect(x, y, barW, barH);
    }
  } else if (tool === "shape_stacker") {
    const shapes = submission.shapes || [];
    shapes.forEach((shape) => {
      if (!shape) return;
      drawCyberShape(ctx, shape.shape, shape.x, shape.y, shape.rotation || 0);
    });
  }
  ctx.restore();
}

CYBER_JOBS.forEach((job) => {
  const canvas = document.getElementById(job.id);
  if (!canvas) return;
  renderSubmission(canvas, job.submission);
});
""".replace("__CYBER_JOBS__", jobs_json)

    body = "\n".join(header) + players_section + config_section + rounds_section
    return build_html_document(f"{game_id} Memories", body, extra_script=script)


download_memories = build_memories_html
