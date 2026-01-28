import base64
import difflib
import io
import math
import os
import random
import urllib.parse
from typing import Dict, List, Optional, Tuple

try:
    from quickdraw import QuickDrawData, QuickDrawDataGroup
    from PIL import Image
except Exception:  # pragma: no cover - optional dependency
    QuickDrawData = None
    QuickDrawDataGroup = None
    Image = None

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

QUICKDRAW_AVAILABLE = QuickDrawData is not None and QuickDrawDataGroup is not None and Image is not None
QUICKDRAW_MAX_DRAWINGS = 400
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
QUICKDRAW_CACHE_DIR = os.path.join(PROJECT_ROOT, ".quickdraw_cache")
_QUICKDRAW_NAME_MAP: Optional[Dict[str, str]] = None
_QUICKDRAW_GROUPS: Dict[str, QuickDrawDataGroup] = {}
_QUICKDRAW_CACHE_READY = False

BOT_SALT_ADJECTIVES = [
    "sleepy",
    "happy",
    "grumpy",
    "tiny",
    "giant",
    "striped",
    "spotted",
    "chubby",
    "fast",
    "bouncy",
    "silly",
    "shiny",
    "noisy",
    "brave",
    "curious",
]

BOT_SALT_ACTIONS = [
    "jumping",
    "running",
    "dancing",
    "sleeping",
    "spinning",
    "waving",
]

BOT_TEMPLATES = [
    "sun",
    "moon",
    "star",
    "tree",
    "flower",
    "house",
    "creature",
    "fish",
    "vehicle",
    "boat",
    "plane",
    "balloon",
    "mountain",
    "object",
]

KEYWORD_TEMPLATES = [
    ("sun", ["sun"]),
    ("moon", ["moon"]),
    ("star", ["star"]),
    ("tree", ["tree", "forest"]),
    ("flower", ["flower", "sunflower"]),
    ("house", ["house", "home", "castle", "bridge"]),
    ("mountain", ["mountain", "island", "beach"]),
    ("vehicle", ["car", "train", "rocket", "bicycle", "bike"]),
    ("boat", ["boat", "ship", "sailboat"]),
    ("plane", ["plane", "airplane"]),
    ("balloon", ["balloon", "kite"]),
    ("fish", ["fish", "whale", "octopus"]),
    ("creature", ["cat", "dog", "dragon", "dinosaur", "robot"]),
    ("object", ["camera", "key", "lamp", "guitar", "piano", "telescope", "backpack", "umbrella"]),
]

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


def _normalize_name(value: str) -> str:
    return " ".join(value.replace("-", " ").strip().casefold().split())


def _get_quickdraw_name_map() -> Dict[str, str]:
    global _QUICKDRAW_NAME_MAP
    if _QUICKDRAW_NAME_MAP is not None:
        return _QUICKDRAW_NAME_MAP
    if not QUICKDRAW_AVAILABLE:
        _QUICKDRAW_NAME_MAP = {}
        return _QUICKDRAW_NAME_MAP
    _ensure_quickdraw_cache_dir()
    try:
        data = QuickDrawData(
            recognized=True,
            max_drawings=QUICKDRAW_MAX_DRAWINGS,
            refresh_data=False,
            jit_loading=True,
            print_messages=False,
            cache_dir=QUICKDRAW_CACHE_DIR,
        )
    except Exception:
        _QUICKDRAW_NAME_MAP = {}
        return _QUICKDRAW_NAME_MAP
    _QUICKDRAW_NAME_MAP = {_normalize_name(name): name for name in data.drawing_names}
    return _QUICKDRAW_NAME_MAP


def _match_quickdraw_category(prompt: str) -> Optional[str]:
    if not QUICKDRAW_AVAILABLE:
        return None
    normalized = _normalize_name(prompt or "")
    if not normalized:
        return None
    name_map = _get_quickdraw_name_map()
    if normalized in name_map:
        return name_map[normalized]
    if normalized.endswith("s") and normalized[:-1] in name_map:
        return name_map[normalized[:-1]]

    tokens = set(normalized.split())
    best_name = None
    best_score = 0
    for key, original in name_map.items():
        if normalized in key or key in normalized:
            score = 2 + len(key)
        else:
            overlap = len(tokens.intersection(key.split()))
            score = overlap
        if score > best_score:
            best_score = score
            best_name = original
    if best_name:
        return best_name

    matches = difflib.get_close_matches(normalized, list(name_map.keys()), n=1, cutoff=0.8)
    if matches:
        return name_map[matches[0]]
    return None


def _get_quickdraw_group(category: str) -> Optional[QuickDrawDataGroup]:
    if not QUICKDRAW_AVAILABLE:
        return None
    if not category:
        return None
    group = _QUICKDRAW_GROUPS.get(category)
    if group is not None:
        return group
    _ensure_quickdraw_cache_dir()
    try:
        group = QuickDrawDataGroup(
            category,
            recognized=True,
            max_drawings=QUICKDRAW_MAX_DRAWINGS,
            refresh_data=False,
            print_messages=False,
            cache_dir=QUICKDRAW_CACHE_DIR,
        )
    except Exception:
        return None
    _QUICKDRAW_GROUPS[category] = group
    return group


def _quickdraw_to_data_url(category: str, rng: random.Random) -> Optional[str]:
    group = _get_quickdraw_group(category)
    if not group or group.drawing_count == 0:
        return None
    try:
        index = rng.randrange(group.drawing_count)
        drawing = group.get_drawing(index)
        stroke_width = max(2, rng.randint(2, 4))
        image = drawing.get_image(stroke_width=stroke_width)
        image = image.convert("RGB")
    except Exception:
        return None

    angle = rng.uniform(-10.0, 10.0)
    image = image.rotate(angle, expand=True, fillcolor=(255, 255, 255))
    scale = rng.uniform(0.85, 1.15)
    width = max(1, int(image.width * scale))
    height = max(1, int(image.height * scale))
    image = image.resize((width, height))

    canvas = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), color=(255, 255, 255))
    offset_x = (CANVAS_WIDTH - width) // 2 + rng.randint(-30, 30)
    offset_y = (CANVAS_HEIGHT - height) // 2 + rng.randint(-30, 30)
    canvas.paste(image, (offset_x, offset_y))

    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _salt_prompt(prompt: str) -> str:
    base = prompt.strip() if isinstance(prompt, str) and prompt.strip() else "mystery"
    adjective_count = 1 if random.random() < 0.6 else 2
    adjectives = random.sample(BOT_SALT_ADJECTIVES, k=adjective_count)
    action = random.choice(BOT_SALT_ACTIONS) if random.random() < 0.5 else ""
    parts = []
    if action:
        parts.append(action)
    parts.extend(adjectives)
    parts.append(base)
    return " ".join(parts)


def _ensure_quickdraw_cache_dir() -> None:
    global _QUICKDRAW_CACHE_READY
    if _QUICKDRAW_CACHE_READY:
        return
    try:
        os.makedirs(QUICKDRAW_CACHE_DIR, exist_ok=True)
        _QUICKDRAW_CACHE_READY = True
    except Exception:
        return


def _select_template(prompt: str, rng: random.Random) -> str:
    lowered = (prompt or "").casefold()
    for template, keywords in KEYWORD_TEMPLATES:
        if any(keyword in lowered for keyword in keywords):
            return template
    return rng.choice(BOT_TEMPLATES)


def _jitter(rng: random.Random, value: float, amount: float) -> float:
    return value + rng.uniform(-amount, amount)


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


def _svg_line(x1: float, y1: float, x2: float, y2: float, stroke_width: int = STROKE_WIDTH) -> str:
    return (
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="black" stroke-width="{stroke_width}" />'
    )


def _svg_circle(cx: float, cy: float, r: float, stroke_width: int = STROKE_WIDTH) -> str:
    return (
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" stroke="black" '
        f'stroke-width="{stroke_width}" fill="none" />'
    )


def _svg_rect(x: float, y: float, w: float, h: float, stroke_width: int = STROKE_WIDTH) -> str:
    return (
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'stroke="black" stroke-width="{stroke_width}" fill="none" />'
    )


def _svg_polygon(points: List[Tuple[float, float]], stroke_width: int = STROKE_WIDTH) -> str:
    point_str = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return (
        f'<polygon points="{point_str}" stroke="black" stroke-width="{stroke_width}" fill="none" />'
    )


def _svg_ellipse(cx: float, cy: float, rx: float, ry: float, stroke_width: int = STROKE_WIDTH) -> str:
    return (
        f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
        f'stroke="black" stroke-width="{stroke_width}" fill="none" />'
    )


def _bot_svg_for_prompt(prompt: str, rng: random.Random) -> str:
    stroke_width = max(2, STROKE_WIDTH + rng.randint(-1, 2))
    elements: List[str] = []
    template = _select_template(prompt, rng)

    def j(value: float, amount: float = 14.0) -> float:
        return _jitter(rng, value, amount)

    def r(value: float, amount: float = 12.0, minimum: float = 6.0) -> float:
        return max(minimum, _jitter(rng, value, amount))

    if template == "sun":
        cx, cy, rad = j(240, 25), j(170, 20), r(42, 10, 30)
        elements.append(_svg_circle(cx, cy, rad, stroke_width))
        for angle in range(0, 360, 45):
            radian = math.radians(angle)
            inner = rad + rng.randint(8, 14)
            outer = inner + rng.randint(18, 28)
            x1 = cx + inner * math.cos(radian)
            y1 = cy + inner * math.sin(radian)
            x2 = cx + outer * math.cos(radian)
            y2 = cy + outer * math.sin(radian)
            elements.append(_svg_line(x1, y1, x2, y2, stroke_width))
    elif template == "moon":
        cx, cy, rad = j(240, 20), j(180, 20), r(55, 12, 35)
        offset = rng.randint(14, 24)
        elements.append(_svg_circle(cx, cy, rad, stroke_width))
        elements.append(_svg_circle(cx + offset, cy - offset * 0.4, rad - 10, stroke_width))
    elif template == "star":
        scale = rng.uniform(0.85, 1.15)
        cx, cy = j(240, 20), j(180, 20)
        base_points = [
            (0, -60),
            (22, -10),
            (75, -5),
            (35, 30),
            (50, 80),
            (0, 50),
            (-50, 80),
            (-35, 30),
            (-75, -5),
            (-22, -10),
        ]
        points = [(cx + x * scale, cy + y * scale) for x, y in base_points]
        elements.append(_svg_polygon(points, stroke_width))
    elif template == "tree":
        trunk_w, trunk_h = r(40, 8, 26), r(90, 15, 60)
        trunk_x = j(240 - trunk_w / 2, 18)
        trunk_y = j(200, 12)
        canopy_r = r(60, 12, 45)
        canopy_cx = trunk_x + trunk_w / 2
        canopy_cy = trunk_y - canopy_r * 0.6
        elements.append(_svg_rect(trunk_x, trunk_y, trunk_w, trunk_h, stroke_width))
        elements.append(_svg_circle(canopy_cx, canopy_cy, canopy_r, stroke_width))
    elif template == "flower":
        stem_x = j(240, 10)
        stem_top = j(150, 15)
        stem_bottom = j(280, 10)
        elements.append(_svg_line(stem_x, stem_top, stem_x, stem_bottom, stroke_width))
        center_r = r(16, 4, 10)
        elements.append(_svg_circle(stem_x, stem_top, center_r, stroke_width))
        for angle in range(0, 360, 60):
            radian = math.radians(angle)
            petal_x = stem_x + (center_r + 14) * math.cos(radian)
            petal_y = stem_top + (center_r + 14) * math.sin(radian)
            elements.append(_svg_circle(petal_x, petal_y, center_r, stroke_width))
    elif template == "house":
        house_w, house_h = r(150, 18, 110), r(110, 18, 80)
        house_x = j(240 - house_w / 2, 18)
        house_y = j(180, 12)
        roof_peak = (house_x + house_w / 2, house_y - r(60, 10, 40))
        elements.append(_svg_rect(house_x, house_y, house_w, house_h, stroke_width))
        elements.append(_svg_polygon([(house_x, house_y), roof_peak, (house_x + house_w, house_y)], stroke_width))
        door_w = house_w * 0.2
        door_h = house_h * 0.4
        elements.append(_svg_rect(house_x + house_w * 0.4, house_y + house_h - door_h, door_w, door_h, stroke_width))
    elif template == "creature":
        head_r = r(48, 10, 32)
        head_cx, head_cy = j(240, 20), j(170, 20)
        body_r = r(head_r + 20, 12, head_r + 8)
        body_cx, body_cy = head_cx, head_cy + head_r + body_r * 0.6
        elements.append(_svg_circle(head_cx, head_cy, head_r, stroke_width))
        elements.append(_svg_circle(body_cx, body_cy, body_r, stroke_width))
        ear_offset = head_r * 0.7
        ear_height = head_r * 0.7
        elements.append(
            _svg_polygon(
                [
                    (head_cx - ear_offset, head_cy - head_r * 0.7),
                    (head_cx - ear_offset * 0.5, head_cy - head_r - ear_height),
                    (head_cx - ear_offset * 0.1, head_cy - head_r * 0.6),
                ],
                stroke_width,
            )
        )
        elements.append(
            _svg_polygon(
                [
                    (head_cx + ear_offset, head_cy - head_r * 0.7),
                    (head_cx + ear_offset * 0.5, head_cy - head_r - ear_height),
                    (head_cx + ear_offset * 0.1, head_cy - head_r * 0.6),
                ],
                stroke_width,
            )
        )
        tail_x = body_cx + body_r
        tail_y = body_cy + body_r * 0.2
        elements.append(_svg_line(tail_x, tail_y, tail_x + r(40, 10, 20), tail_y + r(10, 8, 4), stroke_width))
    elif template == "fish":
        body_cx, body_cy = j(220, 20), j(180, 15)
        body_rx, body_ry = r(70, 12, 45), r(35, 8, 24)
        tail_w = r(45, 10, 28)
        elements.append(_svg_ellipse(body_cx, body_cy, body_rx, body_ry, stroke_width))
        elements.append(
            _svg_polygon(
                [
                    (body_cx + body_rx, body_cy),
                    (body_cx + body_rx + tail_w, body_cy - body_ry),
                    (body_cx + body_rx + tail_w, body_cy + body_ry),
                ],
                stroke_width,
            )
        )
        elements.append(_svg_circle(body_cx - body_rx * 0.3, body_cy - body_ry * 0.2, r(6, 2, 4), stroke_width))
    elif template == "vehicle":
        body_w, body_h = r(170, 20, 120), r(60, 10, 40)
        body_x = j(240 - body_w / 2, 18)
        body_y = j(200, 12)
        roof_w = body_w * 0.5
        roof_h = body_h * 0.6
        elements.append(_svg_rect(body_x, body_y, body_w, body_h, stroke_width))
        elements.append(_svg_rect(body_x + body_w * 0.25, body_y - roof_h, roof_w, roof_h, stroke_width))
        wheel_r = r(18, 3, 12)
        elements.append(_svg_circle(body_x + body_w * 0.25, body_y + body_h + wheel_r, wheel_r, stroke_width))
        elements.append(_svg_circle(body_x + body_w * 0.75, body_y + body_h + wheel_r, wheel_r, stroke_width))
    elif template == "boat":
        hull_w = r(160, 18, 110)
        hull_h = r(40, 8, 26)
        hull_x = j(240 - hull_w / 2, 18)
        hull_y = j(240, 10)
        elements.append(
            _svg_polygon(
                [
                    (hull_x, hull_y),
                    (hull_x + hull_w, hull_y),
                    (hull_x + hull_w * 0.8, hull_y + hull_h),
                    (hull_x + hull_w * 0.2, hull_y + hull_h),
                ],
                stroke_width,
            )
        )
        mast_x = hull_x + hull_w * 0.5
        mast_top = hull_y - r(90, 12, 60)
        elements.append(_svg_line(mast_x, mast_top, mast_x, hull_y, stroke_width))
        elements.append(
            _svg_polygon(
                [(mast_x, mast_top + 10), (mast_x + hull_w * 0.3, hull_y - hull_h * 0.2), (mast_x, hull_y - hull_h * 0.2)],
                stroke_width,
            )
        )
    elif template == "plane":
        body_x1, body_y = j(150, 20), j(200, 15)
        body_x2 = body_x1 + r(200, 20, 150)
        wing_span = r(60, 10, 40)
        elements.append(_svg_line(body_x1, body_y, body_x2, body_y, stroke_width))
        elements.append(_svg_line(body_x1 + 80, body_y, body_x1 + 80 - wing_span, body_y - wing_span / 2, stroke_width))
        elements.append(_svg_line(body_x1 + 80, body_y, body_x1 + 80 - wing_span, body_y + wing_span / 2, stroke_width))
        elements.append(_svg_line(body_x2 - 40, body_y, body_x2 - 80, body_y - wing_span / 3, stroke_width))
        elements.append(_svg_line(body_x2 - 40, body_y, body_x2 - 80, body_y + wing_span / 3, stroke_width))
    elif template == "balloon":
        balloon_r = r(50, 8, 36)
        balloon_cx, balloon_cy = j(240, 20), j(150, 20)
        string_bottom = balloon_cy + balloon_r + r(90, 12, 60)
        elements.append(_svg_circle(balloon_cx, balloon_cy, balloon_r, stroke_width))
        elements.append(_svg_line(balloon_cx, balloon_cy + balloon_r, balloon_cx, string_bottom, stroke_width))
        elements.append(
            _svg_polygon(
                [
                    (balloon_cx - 10, string_bottom),
                    (balloon_cx + 10, string_bottom),
                    (balloon_cx, string_bottom + 20),
                ],
                stroke_width,
            )
        )
    elif template == "mountain":
        base_y = j(260, 10)
        peak1_x = j(170, 20)
        peak2_x = j(310, 20)
        peak1_y = j(150, 15)
        peak2_y = j(170, 15)
        elements.append(_svg_polygon([(80, base_y), (peak1_x, peak1_y), (260, base_y)], stroke_width))
        elements.append(_svg_polygon([(220, base_y), (peak2_x, peak2_y), (420, base_y)], stroke_width))
        elements.append(_svg_circle(j(360, 18), j(120, 12), r(20, 4, 14), stroke_width))
    elif template == "object":
        box_w, box_h = r(120, 18, 90), r(90, 12, 60)
        box_x = j(240 - box_w / 2, 20)
        box_y = j(190, 15)
        elements.append(_svg_rect(box_x, box_y, box_w, box_h, stroke_width))
        elements.append(_svg_rect(box_x + box_w * 0.15, box_y + box_h * 0.2, box_w * 0.7, box_h * 0.25, stroke_width))
        elements.append(_svg_line(box_x + box_w * 0.2, box_y + box_h * 0.7, box_x + box_w * 0.8, box_y + box_h * 0.7, stroke_width))
    else:
        for _ in range(7):
            x1 = rng.randint(60, 420)
            y1 = rng.randint(60, 300)
            x2 = rng.randint(60, 420)
            y2 = rng.randint(60, 300)
            elements.append(_svg_line(x1, y1, x2, y2, stroke_width))

    return _svg_data_url(_wrap_svg(elements))


def _bot_image_for_prompt(prompt: str, salted_prompt: str, rng: random.Random) -> str:
    category = _match_quickdraw_category(prompt)
    if not category and QUICKDRAW_AVAILABLE:
        name_map = _get_quickdraw_name_map()
        if name_map:
            category = rng.choice(list(name_map.values()))
    if category:
        image_data = _quickdraw_to_data_url(category, rng)
        if image_data:
            return image_data
    return _bot_svg_for_prompt(salted_prompt, rng)


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
            salted_prompt = _salt_prompt(prompt or "")
            rng = random.Random(salted_prompt)
            image_data = _bot_image_for_prompt(prompt or "", salted_prompt, rng)
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
