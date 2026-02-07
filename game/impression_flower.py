import base64
import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "word_pool": ["mystery"],
    "rounds_per_guesser": 2,
    "base_stamps": 5,
    "score_mode": "round",
    "score_per_correct": 2,
    "allow_review_votes": False,
    "stamp_shapes": ["circle", "triangle", "square", "bar"],
    "stamp_colors": ["#ef4444", "#22c55e", "#3b82f6", "#eab308"],
    "stamp_size": 64,
    "bar_ratio": 0.25,
    "canvas_size": 600,
    "mask_size": 180,
}

_ALLOWED_SHAPES = {"circle", "triangle", "square", "bar"}
_CONFIG_CACHE: Optional[Dict] = None


def _config_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "impression_flower.json"


def _normalize_int(value: object, minimum: int) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < minimum:
        return None
    return parsed


def _normalize_float(value: object, minimum: float) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < minimum:
        return None
    return parsed


def _normalize_bool(value: object) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    return None


def _normalize_word_pool(value: object) -> List[str]:
    if not isinstance(value, list):
        return []
    pool: List[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        cleaned = " ".join(item.strip().split())
        if cleaned:
            pool.append(cleaned)
    return pool


def _normalize_shapes(value: object) -> List[str]:
    if not isinstance(value, list):
        return []
    shapes = []
    for item in value:
        if isinstance(item, str):
            cleaned = item.strip().casefold()
            if cleaned in _ALLOWED_SHAPES:
                shapes.append(cleaned)
    return shapes


def _normalize_colors(value: object) -> List[str]:
    if not isinstance(value, list):
        return []
    colors = []
    for item in value:
        if isinstance(item, str) and item.strip():
            colors.append(item.strip())
    return colors


def _normalize_config(raw: Optional[Dict], base: Optional[Dict] = None) -> Dict:
    cfg = dict(base or DEFAULT_CONFIG)
    if not isinstance(raw, dict):
        raw = {}

    word_pool = _normalize_word_pool(raw.get("word_pool"))
    if word_pool:
        cfg["word_pool"] = word_pool

    rounds_per_guesser = _normalize_int(raw.get("rounds_per_guesser"), 1)
    if rounds_per_guesser is not None:
        cfg["rounds_per_guesser"] = rounds_per_guesser

    base_stamps = _normalize_int(raw.get("base_stamps"), 1)
    if base_stamps is not None:
        cfg["base_stamps"] = base_stamps

    score_mode = raw.get("score_mode")
    if isinstance(score_mode, str):
        score_mode = score_mode.strip().casefold()
        if score_mode in ("round", "fixed"):
            cfg["score_mode"] = score_mode

    score_per_correct = _normalize_int(raw.get("score_per_correct"), 1)
    if score_per_correct is not None:
        cfg["score_per_correct"] = score_per_correct

    allow_review_votes = _normalize_bool(raw.get("allow_review_votes"))
    if allow_review_votes is not None:
        cfg["allow_review_votes"] = allow_review_votes

    shapes = _normalize_shapes(raw.get("stamp_shapes"))
    if shapes:
        cfg["stamp_shapes"] = shapes

    colors = _normalize_colors(raw.get("stamp_colors"))
    if colors:
        cfg["stamp_colors"] = colors

    stamp_size = _normalize_int(raw.get("stamp_size"), 1)
    if stamp_size is not None:
        cfg["stamp_size"] = stamp_size

    bar_ratio = _normalize_float(raw.get("bar_ratio"), 0.01)
    if bar_ratio is not None:
        cfg["bar_ratio"] = bar_ratio

    canvas_size = _normalize_int(raw.get("canvas_size"), 1)
    if canvas_size is not None:
        cfg["canvas_size"] = canvas_size

    mask_size = _normalize_int(raw.get("mask_size"), 1)
    if mask_size is not None:
        cfg["mask_size"] = mask_size

    if not cfg.get("word_pool"):
        cfg["word_pool"] = ["mystery"]

    if not cfg.get("stamp_shapes"):
        cfg["stamp_shapes"] = ["circle", "triangle", "square", "bar"]

    if not cfg.get("stamp_colors"):
        cfg["stamp_colors"] = ["#ef4444", "#22c55e", "#3b82f6", "#eab308"]

    shape_list = list(cfg.get("stamp_shapes") or [])
    color_list = list(cfg.get("stamp_colors") or [])
    if shape_list and color_list:
        if len(color_list) < len(shape_list):
            color_list = color_list + [color_list[-1]] * (len(shape_list) - len(color_list))
        elif len(color_list) > len(shape_list):
            color_list = color_list[: len(shape_list)]
    cfg["stamp_shapes"] = shape_list
    cfg["stamp_colors"] = color_list

    return cfg


def _load_base_config() -> Dict:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return dict(_CONFIG_CACHE)

    raw: Optional[Dict] = None
    path = _config_path()
    if path.exists():
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            raw = data
    cfg = _normalize_config(raw)
    _CONFIG_CACHE = cfg
    return dict(cfg)


def _merge_config(config: Optional[Dict]) -> Dict:
    base = _load_base_config()
    if not isinstance(config, dict) or not config:
        return base
    merged = dict(base)
    merged.update(config)
    return _normalize_config(merged, base=base)


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _current_guesser_id(state: Dict) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    idx = int(state.get("guesser_index") or 0) % len(order)
    return order[idx]


def _score_value(state: Dict) -> int:
    cfg = state.get("config", {})
    if cfg.get("score_mode") == "fixed":
        return int(cfg.get("score_per_correct") or 1)
    return max(1, int(state.get("round") or 1))


def _refill_word_bag(state: Dict) -> None:
    pool = list(state.get("config", {}).get("word_pool") or [])
    if not pool:
        pool = ["mystery"]
    random.shuffle(pool)
    state["word_bag"] = pool


def _draw_words(state: Dict, count: int) -> List[str]:
    words: List[str] = []
    while len(words) < count:
        if not state.get("word_bag"):
            _refill_word_bag(state)
        bag = state["word_bag"]
        take = min(count - len(words), len(bag))
        start = len(bag) - take
        words.extend(bag[start:])
        del bag[start:]
    return words


def _start_round(state: Dict) -> None:
    guesser_id = _current_guesser_id(state)
    state["guesser_id"] = guesser_id
    state["assignments"] = {}
    state["decoys"] = []
    state["drawings"] = {}
    state["drawing_order"] = []
    state["word_bank"] = []
    state["round_end_by"] = None
    state["review_votes"] = {}

    if not guesser_id:
        state["phase"] = "game_over"
        state["game_over"] = True
        return

    setters = [pid for pid in state["turn_order"] if pid != guesser_id]
    words = _draw_words(state, len(setters) + 2)
    random.shuffle(words)
    assignments = {pid: words[idx] for idx, pid in enumerate(setters)}
    state["assignments"] = assignments
    state["decoys"] = words[len(setters) :]
    state["phase"] = "draw"


def _enter_guess_phase(state: Dict) -> None:
    setters = list(state.get("assignments", {}).keys())
    order = list(setters)
    random.shuffle(order)
    state["drawing_order"] = order
    bank = list(state.get("assignments", {}).values()) + list(state.get("decoys", []))
    random.shuffle(bank)
    state["word_bank"] = bank
    state["phase"] = "guess"


def _review_vote_counts(votes: Dict[str, int]) -> Tuple[int, int, int]:
    up = sum(1 for vote in votes.values() if vote > 0)
    down = sum(1 for vote in votes.values() if vote < 0)
    total = sum(votes.values()) if votes else 0
    return up, down, total


def _build_review_drawings(state: Dict, viewer_id: str) -> List[Dict]:
    drawings = []
    assignments = state.get("assignments", {})
    drawings_map = state.get("drawings", {})
    order = state.get("drawing_order") or list(assignments.keys())
    meta = state.get("player_meta", {})
    matches: Dict[str, str] = {}
    last_result = state.get("last_result")
    if isinstance(last_result, dict):
        matches = last_result.get("matches", {}) or {}
    vote_state = state.get("review_votes", {}) or {}

    for setter_id in order:
        image_data = drawings_map.get(setter_id)
        if not image_data:
            continue
        votes_for_drawing = vote_state.get(setter_id, {}) or {}
        votes_up, votes_down, vote_total = _review_vote_counts(votes_for_drawing)
        actual_word = assignments.get(setter_id)
        guessed_word = matches.get(setter_id)
        drawings.append(
            {
                "drawing_id": setter_id,
                "image_data": image_data,
                "author_id": setter_id,
                "author_name": meta.get(setter_id, {}).get("name"),
                "actual_word": actual_word,
                "guessed_word": guessed_word,
                "is_correct": guessed_word == actual_word if guessed_word is not None else None,
                "votes_up": votes_up,
                "votes_down": votes_down,
                "vote_total": vote_total,
                "your_vote": votes_for_drawing.get(viewer_id, 0),
            }
        )
    return drawings


def _all_drawings_submitted(state: Dict) -> bool:
    return len(state.get("drawings", {})) >= len(state.get("assignments", {}))


def _advance_round(state: Dict) -> None:
    rounds_per_guesser = int(state.get("config", {}).get("rounds_per_guesser") or 1)
    if state.get("round", 1) < rounds_per_guesser:
        state["round"] = int(state.get("round") or 1) + 1
        _start_round(state)
        return

    state["guesser_index"] = int(state.get("guesser_index") or 0) + 1
    if state["guesser_index"] >= len(state.get("turn_order", [])):
        state["phase"] = "game_over"
        state["game_over"] = True
        return
    state["round"] = 1
    _start_round(state)


def _stamps_this_round(state: Dict) -> int:
    base_stamps = int(state.get("config", {}).get("base_stamps") or 0)
    round_num = int(state.get("round") or 1)
    return max(0, base_stamps - (round_num - 1))


def _bot_svg_image(config: Dict) -> str:
    canvas_size = int(config.get("canvas_size") or 600)
    stamp_size = int(config.get("stamp_size") or 64)
    bar_ratio = float(config.get("bar_ratio") or 0.25)
    shapes = config.get("stamp_shapes") or ["circle", "square", "triangle", "bar"]
    colors = config.get("stamp_colors") or ["#ef4444"]

    rng = random.Random()
    stamps = []
    for _ in range(rng.randint(3, 6)):
        shape = rng.choice(shapes)
        color = rng.choice(colors)
        x = rng.randint(stamp_size, canvas_size - stamp_size)
        y = rng.randint(stamp_size, canvas_size - stamp_size)
        rotation = rng.randint(0, 360)
        alpha = rng.uniform(0.3, 0.9)
        if shape == "circle":
            element = f"<circle cx=\"0\" cy=\"0\" r=\"{stamp_size / 2:.1f}\" fill=\"{color}\" fill-opacity=\"{alpha:.2f}\" />"
        elif shape == "square":
            half = stamp_size / 2
            element = f"<rect x=\"{-half:.1f}\" y=\"{-half:.1f}\" width=\"{stamp_size:.1f}\" height=\"{stamp_size:.1f}\" fill=\"{color}\" fill-opacity=\"{alpha:.2f}\" />"
        elif shape == "triangle":
            height = stamp_size * 0.866
            x1, y1 = 0.0, -height * 2 / 3
            x2, y2 = -stamp_size / 2, height / 3
            x3, y3 = stamp_size / 2, height / 3
            element = (
                "<polygon points=\""
                f"{x1:.1f},{y1:.1f} {x2:.1f},{y2:.1f} {x3:.1f},{y3:.1f}\" "
                f"fill=\"{color}\" fill-opacity=\"{alpha:.2f}\" />"
            )
        else:
            width = stamp_size
            height = stamp_size * bar_ratio
            element = f"<rect x=\"{-width / 2:.1f}\" y=\"{-height / 2:.1f}\" width=\"{width:.1f}\" height=\"{height:.1f}\" fill=\"{color}\" fill-opacity=\"{alpha:.2f}\" />"
        stamps.append(
            f"<g transform=\"translate({x:.1f},{y:.1f}) rotate({rotation})\">{element}</g>"
        )
    svg = (
        f"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{canvas_size}\" height=\"{canvas_size}\" "
        f"viewBox=\"0 0 {canvas_size} {canvas_size}\">"
        f"<rect width=\"100%\" height=\"100%\" fill=\"white\" />"
        f"{''.join(stamps)}"
        "</svg>"
    )
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


class ImpressionFlowerGame:
    game_id = "impression_flower"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        players_state = {pid: {"score": 0} for pid in order}

        state = {
            "players": players_state,
            "player_meta": player_meta,
            "turn_order": order,
            "guesser_index": 0,
            "guesser_id": order[0] if order else None,
            "round": 1,
            "phase": "draw",
            "assignments": {},
            "decoys": [],
            "drawings": {},
            "drawing_order": [],
            "word_bank": [],
            "last_result": None,
            "word_bag": [],
            "round_end_by": None,
            "review_votes": {},
            "config": cfg,
            "game_over": False,
        }
        _refill_word_bag(state)
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        guesser_id = state.get("guesser_id")
        if phase == "draw":
            if player_id == guesser_id:
                return []
            if player_id in state.get("assignments", {}) and player_id not in state.get("drawings", {}):
                return ["submit_drawing"]
            return []
        if phase == "guess":
            if player_id == guesser_id:
                return ["submit_matches"]
            return []
        if phase == "round_end" and not state.get("round_end_by"):
            actions = ["continue_game", "end_game"]
            if state.get("config", {}).get("allow_review_votes"):
                actions.append("review_vote")
            return actions
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
        guesser_id = state.get("guesser_id")

        if phase == "draw":
            if action_type != "submit_drawing":
                return [], "invalid action"
            if player_id == guesser_id:
                return [], "guesser cannot draw"
            if player_id not in state.get("assignments", {}):
                return [], "not a setter"
            if player_id in state.get("drawings", {}):
                return [], "already submitted"
            image_data = action.get("image_data")
            if not isinstance(image_data, str) or not image_data.strip():
                return [], "image_data required"
            state["drawings"][player_id] = image_data
            if _all_drawings_submitted(state):
                _enter_guess_phase(state)
            return [], None

        if phase == "guess":
            if action_type != "submit_matches":
                return [], "invalid action"
            if player_id != guesser_id:
                return [], "only guesser can match"
            raw_matches = action.get("matches")
            if not isinstance(raw_matches, list) or not raw_matches:
                return [], "matches required"
            expected = len(state.get("assignments", {}))
            if len(raw_matches) != expected:
                return [], "matches incomplete"
            seen_drawings = set()
            seen_words = set()
            matches: Dict[str, str] = {}
            for entry in raw_matches:
                if not isinstance(entry, dict):
                    return [], "invalid match entry"
                drawing_id = entry.get("drawing_id")
                word = entry.get("word")
                if drawing_id not in state.get("assignments", {}):
                    return [], "invalid drawing_id"
                if drawing_id in seen_drawings:
                    return [], "duplicate drawing_id"
                if not isinstance(word, str) or not word.strip():
                    return [], "invalid word"
                if word not in state.get("word_bank", []):
                    return [], "word not in bank"
                if word in seen_words:
                    return [], "duplicate word"
                seen_drawings.add(drawing_id)
                seen_words.add(word)
                matches[drawing_id] = word

            score_value = _score_value(state)
            correct: List[str] = []
            scores_delta: Dict[str, int] = {}
            assignments = state.get("assignments", {})
            for setter_id, word in matches.items():
                if assignments.get(setter_id) == word:
                    correct.append(setter_id)
                    scores_delta[guesser_id] = scores_delta.get(guesser_id, 0) + score_value
                    scores_delta[setter_id] = scores_delta.get(setter_id, 0) + score_value

            for pid, delta in scores_delta.items():
                if pid in state["players"]:
                    state["players"][pid]["score"] += delta

            state["last_result"] = {
                "round": state.get("round"),
                "guesser_id": guesser_id,
                "matches": matches,
                "correct": correct,
                "scores_delta": scores_delta,
            }
            state["phase"] = "round_end"
            state["round_end_by"] = None
            return [], None

        if phase == "round_end":
            if action_type == "review_vote":
                if not state.get("config", {}).get("allow_review_votes"):
                    return [], "review votes disabled"
                if state.get("round_end_by"):
                    return [], "round already decided"
                drawing_id = action.get("drawing_id")
                vote = action.get("vote")
                if drawing_id not in state.get("assignments", {}):
                    return [], "invalid drawing_id"
                if vote not in (-1, 0, 1):
                    return [], "invalid vote"
                if drawing_id == player_id:
                    return [], "cannot vote for yourself"
                votes_state = state.setdefault("review_votes", {})
                votes_for_drawing = votes_state.setdefault(drawing_id, {})
                previous = votes_for_drawing.get(player_id, 0)
                next_vote = 0 if vote == previous else vote
                if next_vote == 0:
                    votes_for_drawing.pop(player_id, None)
                else:
                    votes_for_drawing[player_id] = next_vote
                delta = next_vote - previous
                if delta and drawing_id in state.get("players", {}):
                    state["players"][drawing_id]["score"] += delta
                return [], None
            if action_type not in ("continue_game", "end_game"):
                return [], "invalid action"
            if state.get("round_end_by"):
                return [], "round already decided"
            state["round_end_by"] = player_id
            if action_type == "end_game":
                state["phase"] = "game_over"
                state["game_over"] = True
            else:
                _advance_round(state)
            return [], None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        guesser_id = state.get("guesser_id")
        player_ids = list(state.get("turn_order", []))
        meta_map = state.get("player_meta", {})
        players_view = []
        scores = {}
        for pid in player_ids:
            meta = meta_map.get(pid, {})
            pdata = state.get("players", {}).get(pid, {})
            score = pdata.get("score", 0)
            scores[pid] = score
            submitted = pid in state.get("drawings", {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": score,
                    "submitted": submitted if pid in state.get("assignments", {}) else False,
                    "is_guesser": pid == guesser_id,
                }
            )

        prompt_word = None
        if viewer_id in state.get("assignments", {}):
            prompt_word = state["assignments"].get(viewer_id)

        phase = state.get("phase")
        show_drawings = phase == "guess" or (
            viewer_id == guesser_id and phase in ("round_end", "game_over")
        )
        show_word_bank = phase == "guess" or (
            viewer_id == guesser_id and phase in ("round_end", "game_over")
        )
        drawings = None
        word_bank = None
        review_drawings = None
        if show_drawings:
            drawings = []
            order = state.get("drawing_order") or list(state.get("assignments", {}).keys())
            for setter_id in order:
                image_data = state.get("drawings", {}).get(setter_id)
                if not image_data:
                    continue
                setter_meta = meta_map.get(setter_id, {})
                drawings.append(
                    {
                        "drawing_id": setter_id,
                        "image_data": image_data,
                        "author_id": setter_id,
                        "author_name": setter_meta.get("name"),
                    }
                )
        if show_word_bank:
            word_bank = list(state.get("word_bank", []))
        if phase in ("round_end", "game_over"):
            review_drawings = _build_review_drawings(state, viewer_id)

        cfg = state.get("config", {})
        config_view = {
            "rounds_per_guesser": cfg.get("rounds_per_guesser"),
            "base_stamps": cfg.get("base_stamps"),
            "score_mode": cfg.get("score_mode"),
            "score_per_correct": cfg.get("score_per_correct"),
            "allow_review_votes": cfg.get("allow_review_votes"),
            "stamp_shapes": cfg.get("stamp_shapes"),
            "stamp_colors": cfg.get("stamp_colors"),
            "stamp_size": cfg.get("stamp_size"),
            "bar_ratio": cfg.get("bar_ratio"),
            "canvas_size": cfg.get("canvas_size"),
            "mask_size": cfg.get("mask_size"),
        }

        return {
            "game_id": ImpressionFlowerGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "rounds_per_guesser": cfg.get("rounds_per_guesser"),
            "guesser_id": guesser_id,
            "guesser_name": meta_map.get(guesser_id, {}).get("name") if guesser_id else None,
            "players": players_view,
            "scores": scores,
            "prompt_word": prompt_word,
            "drawings": drawings,
            "word_bank": word_bank,
            "review_drawings": review_drawings,
            "last_result": state.get("last_result"),
            "round_end_by": state.get("round_end_by"),
            "stamps_this_round": _stamps_this_round(state),
            "config": config_view,
            "legal_actions": ImpressionFlowerGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        phase = state.get("phase")
        guesser_id = state.get("guesser_id")

        if phase == "draw":
            if bot_id == guesser_id:
                return None
            if bot_id in state.get("drawings", {}):
                return None
            if bot_id not in state.get("assignments", {}):
                return None
            image_data = _bot_svg_image(state.get("config", {}))
            return {"type": "submit_drawing", "image_data": image_data}

        if phase == "guess":
            if bot_id != guesser_id:
                return None
            drawings = list(state.get("drawing_order") or state.get("assignments", {}).keys())
            if not drawings:
                return None
            words = list(state.get("word_bank", []))
            if not words:
                return None
            random.shuffle(drawings)
            random.shuffle(words)
            matches = []
            for idx, drawing_id in enumerate(drawings):
                if idx >= len(words):
                    break
                matches.append({"drawing_id": drawing_id, "word": words[idx]})
            if len(matches) != len(state.get("assignments", {})):
                return None
            return {"type": "submit_matches", "matches": matches}

        if phase == "round_end":
            meta = state.get("player_meta", {})
            order = state.get("turn_order", [])
            has_human = any(not meta.get(pid, {}).get("is_bot") for pid in order)
            if has_human:
                return None
            return {"type": "continue_game"}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
