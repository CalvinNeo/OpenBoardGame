import math
import random
import urllib.parse
from typing import Dict, List, Optional, Tuple

DEFAULT_PROMPTS = [
    "airplane",
    "apple",
    "backpack",
    "balloon",
    "beach",
    "bicycle",
    "bridge",
    "camera",
    "castle",
    "cat",
    "coffee",
    "cookie",
    "dinosaur",
    "dragon",
    "guitar",
    "hamburger",
    "island",
    "key",
    "kite",
    "lamp",
    "mountain",
    "octopus",
    "piano",
    "pizza",
    "rainbow",
    "robot",
    "rocket",
    "sailboat",
    "snowman",
    "spaceship",
    "sunflower",
    "telescope",
    "train",
    "treehouse",
    "umbrella",
    "whale",
]

CANVAS_WIDTH = 480
CANVAS_HEIGHT = 360
STROKE_WIDTH = 4

DEFAULT_CONFIG = {
    "prompt_pool": DEFAULT_PROMPTS,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        prompt_pool = config.get("prompt_pool")
        if isinstance(prompt_pool, list) and prompt_pool:
            cfg["prompt_pool"] = prompt_pool
    return cfg


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _assign_prompts(prompt_pool: List[str], player_ids: List[str]) -> Dict[str, str]:
    prompts = list(prompt_pool) if prompt_pool else list(DEFAULT_PROMPTS)
    if not prompts:
        prompts = ["mystery"]
    if len(prompts) >= len(player_ids):
        choices = random.sample(prompts, len(player_ids))
    else:
        choices = [random.choice(prompts) for _ in range(len(player_ids))]
    return {pid: choices[idx] for idx, pid in enumerate(player_ids)}


def _book_owner_for_player(state: Dict, player_id: str) -> Optional[str]:
    order = state["turn_order"]
    if player_id not in order:
        return None
    total = len(order)
    if total == 0:
        return None
    idx = order.index(player_id)
    owner_idx = (idx - (state["round"] - 1)) % total
    return order[owner_idx]


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(value.strip().casefold().split())


def _current_book(state: Dict, player_id: str) -> Optional[Dict]:
    owner_id = _book_owner_for_player(state, player_id)
    if owner_id is None:
        return None
    return state["books"].get(owner_id)


def _current_text_for_player(state: Dict, player_id: str) -> Optional[str]:
    book = _current_book(state, player_id)
    if not book:
        return None
    entries = book.get("entries", [])
    if not entries:
        return None
    return entries[-1].get("text")


def _last_text_entry(entries: List[Dict]) -> Optional[str]:
    for entry in reversed(entries):
        if entry.get("type") in ("prompt", "guess"):
            return entry.get("text")
    return None


def _drawing_entry_for_book(book: Optional[Dict]) -> Optional[Dict]:
    if not book:
        return None
    entries = book.get("entries", [])
    if not entries:
        return None
    last_entry = entries[-1]
    if last_entry.get("type") == "drawing":
        return last_entry
    return None


def _drawing_hint_from_book(book: Optional[Dict]) -> Optional[str]:
    if not book:
        return None
    entries = book.get("entries", [])
    if not entries:
        return None
    last_entry = entries[-1]
    if last_entry.get("type") != "drawing":
        return None
    hint = last_entry.get("hint")
    if isinstance(hint, str) and hint.strip():
        return hint.strip()
    if len(entries) > 1:
        return _last_text_entry(entries[:-1])
    return None


def _svg_data_url(svg: str) -> str:
    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def _wrap_svg(elements: List[str]) -> str:
    content = "".join(elements)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS_WIDTH}" height="{CANVAS_HEIGHT}" '
        f'viewBox="0 0 {CANVAS_WIDTH} {CANVAS_HEIGHT}">'
        f'<rect width="{CANVAS_WIDTH}" height="{CANVAS_HEIGHT}" fill="white" />'
        f'{content}</svg>'
    )


def _svg_line(x1: float, y1: float, x2: float, y2: float) -> str:
    return (
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="black" stroke-width="{STROKE_WIDTH}" />'
    )


def _svg_circle(cx: float, cy: float, r: float) -> str:
    return (
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" stroke="black" '
        f'stroke-width="{STROKE_WIDTH}" fill="none" />'
    )


def _svg_rect(x: float, y: float, w: float, h: float) -> str:
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'stroke="black" stroke-width="{STROKE_WIDTH}" fill="none" />'
    )


def _svg_polygon(points: List[Tuple[float, float]]) -> str:
    point_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return (
        f'<polygon points="{point_str}" stroke="black" stroke-width="{STROKE_WIDTH}" fill="none" />'
    )


def _svg_ellipse(cx: float, cy: float, rx: float, ry: float) -> str:
    return (
        f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
        f'stroke="black" stroke-width="{STROKE_WIDTH}" fill="none" />'
    )


def _bot_svg_for_prompt(prompt: str) -> str:
    lowered = (prompt or "").strip().casefold()
    elements: List[str] = []

    if "sun" in lowered:
        cx, cy, r = 240, 170, 45
        elements.append(_svg_circle(cx, cy, r))
        for angle in range(0, 360, 45):
            rad = math.radians(angle)
            x1 = cx + (r + 10) * math.cos(rad)
            y1 = cy + (r + 10) * math.sin(rad)
            x2 = cx + (r + 35) * math.cos(rad)
            y2 = cy + (r + 35) * math.sin(rad)
            elements.append(_svg_line(x1, y1, x2, y2))
    elif "moon" in lowered:
        elements.append(_svg_circle(240, 180, 60))
        elements.append(_svg_circle(265, 170, 50))
    elif "star" in lowered:
        points = [
            (240, 120),
            (262, 170),
            (315, 175),
            (275, 210),
            (290, 260),
            (240, 230),
            (190, 260),
            (205, 210),
            (165, 175),
            (218, 170),
        ]
        elements.append(_svg_polygon(points))
    elif "tree" in lowered:
        elements.append(_svg_rect(220, 200, 40, 90))
        elements.append(_svg_circle(240, 170, 60))
    elif "house" in lowered or "home" in lowered:
        elements.append(_svg_rect(170, 180, 140, 110))
        elements.append(_svg_polygon([(170, 180), (240, 120), (310, 180)]))
    elif "cat" in lowered:
        elements.append(_svg_circle(240, 180, 55))
        elements.append(_svg_polygon([(205, 130), (220, 95), (235, 130)]))
        elements.append(_svg_polygon([(245, 130), (260, 95), (275, 130)]))
        elements.append(_svg_line(200, 185, 170, 175))
        elements.append(_svg_line(200, 195, 170, 205))
        elements.append(_svg_line(280, 185, 310, 175))
        elements.append(_svg_line(280, 195, 310, 205))
    elif "fish" in lowered:
        elements.append(_svg_ellipse(220, 180, 70, 35))
        elements.append(_svg_polygon([(290, 180), (340, 150), (340, 210)]))
    elif "car" in lowered:
        elements.append(_svg_rect(160, 190, 160, 60))
        elements.append(_svg_rect(200, 150, 90, 40))
        elements.append(_svg_circle(200, 255, 18))
        elements.append(_svg_circle(300, 255, 18))
    elif "boat" in lowered or "ship" in lowered or "sail" in lowered:
        elements.append(_svg_polygon([(170, 240), (310, 240), (280, 280), (200, 280)]))
        elements.append(_svg_line(240, 140, 240, 240))
        elements.append(_svg_polygon([(240, 150), (300, 210), (240, 210)]))
    elif "plane" in lowered or "airplane" in lowered:
        elements.append(_svg_line(140, 200, 340, 200))
        elements.append(_svg_line(210, 160, 240, 200))
        elements.append(_svg_line(210, 240, 240, 200))
        elements.append(_svg_line(280, 170, 240, 200))
        elements.append(_svg_line(280, 230, 240, 200))
    elif "balloon" in lowered:
        elements.append(_svg_circle(240, 150, 50))
        elements.append(_svg_line(240, 200, 240, 280))
        elements.append(_svg_polygon([(232, 280), (248, 280), (240, 300)]))
    else:
        rng = random.Random(prompt)
        for _ in range(7):
            x1 = rng.randint(60, 420)
            y1 = rng.randint(60, 300)
            x2 = rng.randint(60, 420)
            y2 = rng.randint(60, 300)
            elements.append(_svg_line(x1, y1, x2, y2))

    return _svg_data_url(_wrap_svg(elements))


def _bot_guess_from_hint(hint: Optional[str], prompt_pool: List[str]) -> str:
    cleaned = hint.strip() if isinstance(hint, str) else ""
    if not cleaned:
        return random.choice(prompt_pool) if prompt_pool else "unknown"
    if random.random() < 0.15:
        return random.choice(prompt_pool) if prompt_pool else cleaned
    return cleaned


def _submission_complete(state: Dict) -> bool:
    return len(state["submissions"]) >= len(state["turn_order"])


def _apply_round(state: Dict) -> None:
    phase = state["phase"]
    round_num = state["round"]
    entry_type = "drawing" if phase == "draw" else "guess"

    for player_id in state["turn_order"]:
        submission = state["submissions"].get(player_id)
        if not submission:
            continue
        owner_id = _book_owner_for_player(state, player_id)
        if owner_id is None:
            continue
        book = state["books"].get(owner_id)
        source_text = None
        if entry_type == "drawing" and book and book.get("entries"):
            source_text = book["entries"][-1].get("text")
        entry = {
            "round": round_num,
            "type": entry_type,
            "author_id": player_id,
            "text": submission.get("text"),
            "image_data": submission.get("image_data"),
        }
        if entry_type == "drawing":
            entry["hint"] = source_text.strip() if isinstance(source_text, str) else None
        state["books"][owner_id]["entries"].append(entry)

    state["submissions"] = {}
    if round_num >= state["total_rounds"]:
        state["phase"] = "review"
        state["game_over"] = True
        return

    state["round"] = round_num + 1
    state["phase"] = "guess" if phase == "draw" else "draw"


class DrawGuessGame:
    game_id = "draw_guess"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        total_rounds = len(order) if len(order) % 2 == 0 else max(len(order) - 1, 2)

        prompts = _assign_prompts(cfg.get("prompt_pool", []), order)
        books = {}
        for owner_id in order:
            books[owner_id] = {
                "owner_id": owner_id,
                "entries": [
                    {
                        "round": 0,
                        "type": "prompt",
                        "author_id": owner_id,
                        "text": prompts.get(owner_id, "mystery"),
                        "image_data": None,
                    }
                ],
            }

        players_state = {pid: {} for pid in order}

        return {
            "players": players_state,
            "turn_order": order,
            "round": 1,
            "total_rounds": total_rounds,
            "phase": "draw",
            "submissions": {},
            "books": books,
            "config": cfg,
            "player_meta": player_meta,
            "prompt_pool": cfg.get("prompt_pool", []),
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        if player_id in state.get("submissions", {}):
            return []
        if state["phase"] == "draw":
            return ["submit_drawing"]
        if state["phase"] == "guess":
            return ["submit_guess"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        if player_id in state.get("submissions", {}):
            return [], "already submitted"

        phase = state.get("phase")
        action_type = action.get("type")
        if phase == "draw":
            if action_type != "submit_drawing":
                return [], "invalid action"
            image_data = action.get("image_data")
            if not isinstance(image_data, str) or not image_data.strip():
                return [], "image_data required"
            state["submissions"][player_id] = {
                "type": "drawing",
                "text": None,
                "image_data": image_data,
            }
        elif phase == "guess":
            if action_type != "submit_guess":
                return [], "invalid action"
            text = action.get("text")
            if not isinstance(text, str) or not text.strip():
                return [], "text required"
            state["submissions"][player_id] = {
                "type": "guess",
                "text": text.strip(),
                "image_data": None,
            }
        else:
            return [], "invalid phase"

        if _submission_complete(state):
            _apply_round(state)

        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = state["turn_order"]
        player_map = state.get("player_meta", {})
        players_view = []
        for pid in player_ids:
            meta = player_map.get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "submitted": pid in state.get("submissions", {}),
                }
            )

        current_prompt = None
        current_drawing = None
        if viewer_id in state.get("players", {}):
            owner_id = _book_owner_for_player(state, viewer_id)
            if owner_id is not None:
                book = state["books"].get(owner_id)
                if book and book.get("entries"):
                    last_entry = book["entries"][-1]
                    if state["phase"] == "draw":
                        current_prompt = last_entry.get("text")
                    elif state["phase"] == "guess":
                        current_drawing = last_entry.get("image_data")

        review = None
        if state["phase"] == "review":
            books_view = []
            for owner_id in player_ids:
                meta = player_map.get(owner_id, {})
                book = state["books"].get(owner_id, {})
                entries = []
                for entry in book.get("entries", []):
                    author_meta = player_map.get(entry.get("author_id"), {})
                    entries.append(
                        {
                            "round": entry.get("round"),
                            "type": entry.get("type"),
                            "author_id": entry.get("author_id"),
                            "author_name": author_meta.get("name"),
                            "text": entry.get("text"),
                            "image_data": entry.get("image_data"),
                        }
                    )
                prompt = entries[0].get("text") if entries else None
                final_guess = None
                for entry in reversed(entries):
                    if entry.get("type") == "guess":
                        final_guess = entry.get("text")
                        break
                final_match = False
                if prompt and final_guess:
                    final_match = _normalize_text(prompt) == _normalize_text(final_guess)

                books_view.append(
                    {
                        "owner_id": owner_id,
                        "owner_name": meta.get("name"),
                        "entries": entries,
                        "prompt": prompt,
                        "final_guess": final_guess,
                        "final_match": final_match,
                    }
                )
            review = {"books": books_view}

        return {
            "game_id": DrawGuessGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "total_rounds": state["total_rounds"],
            "submitted": viewer_id in state.get("submissions", {}),
            "players": players_view,
            "current_prompt": current_prompt,
            "current_drawing": current_drawing,
            "review": review,
            "legal_actions": DrawGuessGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        if bot_id in state.get("submissions", {}):
            return None

        if state["phase"] == "draw":
            prompt = _current_text_for_player(state, bot_id)
            image_data = _bot_svg_for_prompt(prompt or "")
            return {"type": "submit_drawing", "image_data": image_data}
        if state["phase"] == "guess":
            book = _current_book(state, bot_id)
            drawing_entry = _drawing_entry_for_book(book)
            hint = None
            if drawing_entry:
                hint = drawing_entry.get("hint")
            if not hint:
                hint = _drawing_hint_from_book(book)
            prompt_pool = state.get("prompt_pool") or DEFAULT_PROMPTS
            guess = _bot_guess_from_hint(hint, prompt_pool)
            return {"type": "submit_guess", "text": guess}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
