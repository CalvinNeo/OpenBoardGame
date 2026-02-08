import random
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

TOTAL_ROUNDS = 5
TOOL_KEYS = ["shoelaces", "pixel_grid", "icon_set", "aeiou", "shape_stacker"]
TOOL_LABELS = {
    "shoelaces": "Shoelaces",
    "pixel_grid": "Pixel Grid",
    "icon_set": "Icon Set",
    "aeiou": "AEIOU Collage",
    "shape_stacker": "Shape Stacker",
}

DEFAULT_CONFIG = {
    "allow_duplicate_targets": False,
}

_ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
_IMAGE_DIR = Path(__file__).resolve().parent.parent / ".cyber_pictures"


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if isinstance(config, dict):
        allow_dupes = config.get("allow_duplicate_targets")
        if isinstance(allow_dupes, bool):
            cfg["allow_duplicate_targets"] = allow_dupes
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


def _build_pool(all_images: List[str]) -> List[str]:
    pool = list(all_images)
    random.shuffle(pool)
    return pool


def _coords() -> List[str]:
    rows = ["A", "B", "C", "D"]
    cols = ["1", "2", "3", "4"]
    return [f"{row}{col}" for row in rows for col in cols]


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
    tool_queue = state.get("tool_queue", [])
    for idx, pid in enumerate(order):
        tool_index = tool_queue[idx] if idx < len(tool_queue) else idx % len(TOOL_KEYS)
        state["players"][pid]["tool_index"] = tool_index


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

    if state.get("round", 1) >= TOTAL_ROUNDS:
        state["phase"] = "ended"
        state["game_over"] = True
    else:
        state["phase"] = "scoring"


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

        state_players = {
            pid: {
                "score": 0,
                "tool_index": None,
                "target": None,
            }
            for pid in order
        }

        state = {
            "config": cfg,
            "round": 1,
            "total_rounds": TOTAL_ROUNDS,
            "phase": "crafting",
            "turn_order": order,
            "players": state_players,
            "player_meta": player_meta,
            "tool_queue": list(range(len(TOOL_KEYS))),
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
            "game_over": False,
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
