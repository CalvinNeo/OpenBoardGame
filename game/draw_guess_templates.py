import math
import random
import urllib.parse
from typing import List, Tuple

CANVAS_WIDTH = 480
CANVAS_HEIGHT = 360
STROKE_WIDTH = 4

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


def _select_template(prompt: str, rng: random.Random) -> str:
    lowered = (prompt or "").casefold()
    for template, keywords in KEYWORD_TEMPLATES:
        if any(keyword in lowered for keyword in keywords):
            return template
    return rng.choice(BOT_TEMPLATES)


def _jitter(rng: random.Random, value: float, amount: float) -> float:
    return value + rng.uniform(-amount, amount)


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
