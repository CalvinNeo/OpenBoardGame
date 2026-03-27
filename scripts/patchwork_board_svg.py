from __future__ import annotations

import json
from pathlib import Path


ROOT = Path("designs/patchwork")
BOARD_SVG = ROOT / "board.svg"
BOARD_JSON = ROOT / "board_layout.json"
BOARD_HTML = ROOT / "board_compare.html"

WIDTH = 1000
HEIGHT = 999
GRID_X = [24, 144, 262, 381, 500, 619, 740, 859, 978]
GRID_Y = [19, 139, 260, 380, 500, 619, 740, 860, 976]

PATTERNS = [
    ["cream_medallion", "green_stripes", "blue_blocks", "starburst", "lime_swirl", "teal_cross", "gold_stripes", "tan_dots"],
    ["purple_diamond", "green_diag", "teal_cross", "lime_swirl", "blue_blocks", "starburst", "blue_diag", "lime_rings"],
    ["lime_rings", "cream_medallion", "blue_diag", "tan_dots", "tan_dots", "lime_rings", "tan_dots", "lime_rings"],
    ["tan_dots", "purple_diamond", "starburst", "orange_rosette", "orange_rosette", "purple_diamond", "lime_rings", "purple_diamond"],
    ["blue_vertical", "purple_diamond", "blue_blocks", "orange_rosette", "orange_rosette", "cream_medallion", "purple_diamond", "cream_medallion"],
    ["starburst", "lime_rings", "lime_swirl", "teal_cross", "tan_dots", "gold_stripes", "cream_medallion", "gold_vertical"],
    ["blue_blocks", "tan_dots", "blue_vertical", "starburst", "blue_blocks", "blue_blocks", "lime_swirl", "teal_cross"],
    ["lime_swirl", "teal_cross", "gold_stripes", "cream_medallion", "purple_diamond", "finish_orange", "finish_orange", "finish_orange"],
]

BUTTONS = [
    {"x": 617, "y": 82, "r": 30},
    {"x": 336, "y": 196, "r": 30},
    {"x": 70, "y": 291, "r": 30},
    {"x": 302, "y": 488, "r": 30},
    {"x": 588, "y": 557, "r": 30},
    {"x": 807, "y": 488, "r": 30},
    {"x": 931, "y": 628, "r": 30},
    {"x": 286, "y": 807, "r": 30},
    {"x": 124, "y": 925, "r": 30},
]

LEATHER_PATCHES = [
    {"x": 918, "y": 210, "size": 51, "angle": 2},
    {"x": 535, "y": 337, "size": 51, "angle": 12},
    {"x": 190, "y": 447, "size": 53, "angle": 9},
    {"x": 541, "y": 663, "size": 53, "angle": -8},
    {"x": 683, "y": 793, "size": 53, "angle": -14},
]

TRACK_SEGMENTS = [
    [(142, 861), (142, 139), (858, 139), (858, 619)],
    [(142, 740), (858, 740)],
    [(262, 619), (262, 260), (740, 260), (740, 740)],
    [(381, 619), (381, 380), (619, 380), (619, 619)],
    [(500, 619), (619, 619)],
]

TAIL_PATH = "M124 924 C114 901 113 875 120 851 C123 839 133 828 142 819"
CENTER_SWIRL = "M569 429 C631 429 647 503 599 512 C563 518 552 478 580 468 C603 460 608 483 591 492"

SPECIAL_RECTS = [
    {"x": GRID_X[3], "y": GRID_Y[3], "w": GRID_X[5] - GRID_X[3], "h": GRID_Y[5] - GRID_Y[3], "pattern": "orange_rosette", "radius": 28},
    {"x": GRID_X[5], "y": GRID_Y[7], "w": GRID_X[8] - GRID_X[5], "h": GRID_Y[8] - GRID_Y[7], "pattern": "finish_orange", "radius": 0},
]


def rect(x: float, y: float, w: float, h: float, **attrs: str) -> str:
    attr_text = " ".join(f'{key}="{value}"' for key, value in attrs.items())
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" {attr_text} />'


def circle(cx: float, cy: float, r: float, **attrs: str) -> str:
    attr_text = " ".join(f'{key}="{value}"' for key, value in attrs.items())
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" {attr_text} />'


def path(d: str, **attrs: str) -> str:
    attr_text = " ".join(f'{key}="{value}"' for key, value in attrs.items())
    return f'<path d="{d}" {attr_text} />'


def make_defs() -> str:
    return """
  <defs>
    <linearGradient id="button-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9fe4ff" />
      <stop offset="100%" stop-color="#4fb5de" />
    </linearGradient>
    <linearGradient id="leather-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#90724c" />
      <stop offset="100%" stop-color="#645035" />
    </linearGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.28" />
    </filter>
    <filter id="button-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0f3551" flood-opacity="0.35" />
    </filter>
    <pattern id="cream_medallion" patternUnits="userSpaceOnUse" width="56" height="56">
      <rect width="56" height="56" fill="#efe2bf" />
      <path d="M0 0 L56 56 M56 0 L0 56" stroke="#d8c8a0" stroke-width="1.2" opacity="0.55" />
      <circle cx="28" cy="28" r="9" fill="none" stroke="#b7afb6" stroke-width="2" opacity="0.85" />
      <circle cx="28" cy="28" r="3" fill="#b7afb6" opacity="0.85" />
    </pattern>
    <pattern id="green_stripes" patternUnits="userSpaceOnUse" width="48" height="48">
      <rect width="48" height="48" fill="#657e46" />
      <rect y="0" width="48" height="8" fill="#93a65e" />
      <rect y="16" width="48" height="8" fill="#93a65e" />
      <rect y="32" width="48" height="8" fill="#93a65e" />
      <path d="M0 8 H48 M0 24 H48 M0 40 H48" stroke="#43552d" stroke-width="1.5" opacity="0.65" />
    </pattern>
    <pattern id="gold_stripes" patternUnits="userSpaceOnUse" width="48" height="48">
      <rect width="48" height="48" fill="#859238" />
      <rect y="4" width="48" height="6" fill="#b2bf59" />
      <rect y="20" width="48" height="6" fill="#b2bf59" />
      <rect y="36" width="48" height="6" fill="#b2bf59" />
      <path d="M0 0 H48 M0 16 H48 M0 32 H48 M0 48 H48" stroke="#5a6722" stroke-width="1.2" opacity="0.55" />
    </pattern>
    <pattern id="gold_vertical" patternUnits="userSpaceOnUse" width="48" height="48">
      <rect width="48" height="48" fill="#859238" />
      <rect x="4" width="6" height="48" fill="#b2bf59" />
      <rect x="20" width="6" height="48" fill="#b2bf59" />
      <rect x="36" width="6" height="48" fill="#b2bf59" />
      <path d="M0 0 V48 M16 0 V48 M32 0 V48 M48 0 V48" stroke="#5a6722" stroke-width="1.2" opacity="0.55" />
    </pattern>
    <pattern id="blue_blocks" patternUnits="userSpaceOnUse" width="56" height="56">
      <rect width="56" height="56" fill="#78abc7" />
      <path d="M10 8 h14 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-14 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 z
               M32 30 h14 a4 4 0 0 1 4 4 v8 a4 4 0 0 1 -4 4 h-14 a4 4 0 0 1 -4 -4 v-8 a4 4 0 0 1 4 -4 z
               M10 30 h8 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 z
               M32 8 h8 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-8 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 z"
            fill="none" stroke="#4d738a" stroke-width="3" opacity="0.75" />
    </pattern>
    <pattern id="starburst" patternUnits="userSpaceOnUse" width="64" height="64">
      <rect width="64" height="64" fill="#f2deaa" />
      <path d="M16 10 L20 24 L34 28 L20 32 L16 46 L12 32 L-2 28 L12 24 Z" fill="#d77e36" opacity="0.88" />
      <path d="M48 18 L52 30 L64 34 L52 38 L48 50 L44 38 L32 34 L44 30 Z" fill="#6e3b22" opacity="0.88" />
      <path d="M34 2 L36 10 L44 12 L36 14 L34 22 L32 14 L24 12 L32 10 Z" fill="#98b44f" opacity="0.88" />
    </pattern>
    <pattern id="lime_swirl" patternUnits="userSpaceOnUse" width="60" height="60">
      <rect width="60" height="60" fill="#b4c33a" />
      <path d="M8 42 C14 30 20 30 24 40 M28 18 C34 8 42 10 44 18 M42 44 C50 36 54 38 56 46" stroke="#f5efca" stroke-width="2" fill="none" opacity="0.6" />
      <path d="M16 12 C22 6 26 8 28 16 M6 20 C10 16 16 16 18 22 M30 50 C36 44 42 44 46 52" stroke="#d8e29c" stroke-width="1.5" fill="none" opacity="0.45" />
    </pattern>
    <pattern id="teal_cross" patternUnits="userSpaceOnUse" width="64" height="64">
      <rect width="64" height="64" fill="#7db4a6" />
      <path d="M0 0 L32 32 L64 0 M0 64 L32 32 L64 64" stroke="#ccb57b" stroke-width="3" opacity="0.85" />
      <path d="M32 4 L32 28 M4 32 L28 32 M36 32 L60 32 M32 36 L32 60" stroke="#e4d5ae" stroke-width="1.4" opacity="0.65" />
    </pattern>
    <pattern id="tan_dots" patternUnits="userSpaceOnUse" width="52" height="52">
      <rect width="52" height="52" fill="#b9a54f" />
      <circle cx="14" cy="14" r="3.4" fill="#875d3f" opacity="0.72" />
      <circle cx="39" cy="12" r="3.2" fill="#e8ddb6" opacity="0.7" />
      <circle cx="27" cy="34" r="3.4" fill="#dbc893" opacity="0.78" />
      <circle cx="8" cy="40" r="3.2" fill="#6d4b35" opacity="0.45" />
    </pattern>
    <pattern id="purple_diamond" patternUnits="userSpaceOnUse" width="60" height="60">
      <rect width="60" height="60" fill="#81706e" />
      <path d="M30 4 L56 30 L30 56 L4 30 Z" fill="none" stroke="#d7c392" stroke-width="2" opacity="0.85" />
      <path d="M30 14 L46 30 L30 46 L14 30 Z" fill="none" stroke="#b89fc0" stroke-width="1.8" opacity="0.7" />
      <path d="M30 24 L36 30 L30 36 L24 30 Z" fill="#6b5a59" opacity="0.8" />
    </pattern>
    <pattern id="green_diag" patternUnits="userSpaceOnUse" width="48" height="48" patternTransform="rotate(45)">
      <rect width="48" height="48" fill="#687334" />
      <rect x="0" width="10" height="48" fill="#b1b85e" />
      <rect x="20" width="10" height="48" fill="#b1b85e" />
      <rect x="40" width="10" height="48" fill="#b1b85e" />
    </pattern>
    <pattern id="blue_diag" patternUnits="userSpaceOnUse" width="48" height="48" patternTransform="rotate(45)">
      <rect width="48" height="48" fill="#bed4d0" />
      <rect x="0" width="12" height="48" fill="#8db8c8" />
      <rect x="24" width="12" height="48" fill="#8db8c8" />
    </pattern>
    <pattern id="blue_vertical" patternUnits="userSpaceOnUse" width="48" height="48">
      <rect width="48" height="48" fill="#bed4d0" />
      <rect x="6" width="10" height="48" fill="#8db8c8" />
      <rect x="28" width="10" height="48" fill="#8db8c8" />
    </pattern>
    <pattern id="lime_rings" patternUnits="userSpaceOnUse" width="54" height="54">
      <rect width="54" height="54" fill="#8daf37" />
      <circle cx="14" cy="14" r="8" fill="none" stroke="#b7d06d" stroke-width="2" opacity="0.72" />
      <circle cx="38" cy="18" r="7" fill="none" stroke="#b7d06d" stroke-width="2" opacity="0.72" />
      <circle cx="22" cy="38" r="8" fill="none" stroke="#b7d06d" stroke-width="2" opacity="0.72" />
    </pattern>
    <pattern id="orange_rosette" patternUnits="userSpaceOnUse" width="64" height="64">
      <rect width="64" height="64" fill="#e67842" />
      <circle cx="16" cy="16" r="10" fill="none" stroke="#f1b18a" stroke-width="1.5" opacity="0.42" />
      <circle cx="48" cy="16" r="10" fill="none" stroke="#f1b18a" stroke-width="1.5" opacity="0.42" />
      <circle cx="16" cy="48" r="10" fill="none" stroke="#f1b18a" stroke-width="1.5" opacity="0.42" />
      <circle cx="48" cy="48" r="10" fill="none" stroke="#f1b18a" stroke-width="1.5" opacity="0.42" />
      <path d="M16 6 L16 26 M6 16 L26 16 M48 6 L48 26 M38 16 L58 16 M16 38 L16 58 M6 48 L26 48 M48 38 L48 58 M38 48 L58 48"
            stroke="#f5c8a4" stroke-width="1.1" opacity="0.32" />
    </pattern>
    <pattern id="finish_orange" patternUnits="userSpaceOnUse" width="40" height="40">
      <rect width="40" height="40" fill="#e26f36" />
      <path d="M0 8 H40 M0 20 H40 M0 32 H40" stroke="#e88d62" stroke-width="1.3" opacity="0.32" />
      <path d="M8 0 V40 M20 0 V40 M32 0 V40" stroke="#d4632b" stroke-width="1" opacity="0.18" />
    </pattern>
  </defs>
""".strip()


def cell_svg() -> list[str]:
    parts: list[str] = []
    skip_cells = {(3, 3), (3, 4), (4, 3), (4, 4), (7, 5), (7, 6), (7, 7)}
    for row in range(8):
        for col in range(8):
            if (row, col) in skip_cells:
                continue
            x0, x1 = GRID_X[col], GRID_X[col + 1]
            y0, y1 = GRID_Y[row], GRID_Y[row + 1]
            parts.append(rect(x0, y0, x1 - x0, y1 - y0, fill=f"url(#{PATTERNS[row][col]})"))
            parts.append(rect(x0, y0, x1 - x0, y1 - y0, fill="none", stroke="#6d5a45", **{"stroke-width": "2"}))
            parts.append(rect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6, fill="none", stroke="#ceb99a", **{"stroke-width": "1", "stroke-dasharray": "1 7", "stroke-linecap": "round", "opacity": "0.55"}))
    return parts


def merged_rects_svg() -> list[str]:
    parts: list[str] = []
    for item in SPECIAL_RECTS:
        parts.append(rect(item["x"], item["y"], item["w"], item["h"], rx=str(item["radius"]), ry=str(item["radius"]), fill=f"url(#{item['pattern']})", filter="url(#soft-shadow)"))
        parts.append(rect(item["x"], item["y"], item["w"], item["h"], rx=str(item["radius"]), ry=str(item["radius"]), fill="none", stroke="#6b3f2f", **{"stroke-width": "4"}))
        parts.append(rect(item["x"] + 6, item["y"] + 6, item["w"] - 12, item["h"] - 12, rx=str(max(item["radius"] - 4, 0)), ry=str(max(item["radius"] - 4, 0)), fill="none", stroke="#d6b18a", **{"stroke-width": "1.6", "stroke-dasharray": "1 7", "stroke-linecap": "round", "opacity": "0.55"}))
    parts.append(path(CENTER_SWIRL, fill="none", stroke="#6b2f1d", **{"stroke-width": "6", "stroke-linecap": "round"}))
    parts.append(path(CENTER_SWIRL, fill="none", stroke="#3b160f", **{"stroke-width": "2.4", "stroke-linecap": "round", "opacity": "0.7"}))
    return parts


def stitched_polyline(points: list[tuple[int, int]]) -> list[str]:
    d = "M " + " L ".join(f"{x} {y}" for x, y in points)
    return [
        path(d, fill="none", stroke="#2f1812", **{"stroke-width": "16", "stroke-linecap": "round", "stroke-linejoin": "round", "opacity": "0.9"}),
        path(d, fill="none", stroke="#8d5a3c", **{"stroke-width": "10", "stroke-linecap": "round", "stroke-linejoin": "round"}),
        path(d, fill="none", stroke="#e0b287", **{"stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-dasharray": "1 12", "opacity": "0.9"}),
    ]


def track_svg() -> list[str]:
    parts: list[str] = []
    for segment in TRACK_SEGMENTS:
        parts.extend(stitched_polyline(segment))
    parts.extend(stitched_polyline([(124, 924), (120, 900), (118, 868), (121, 843), (132, 827), (142, 819)]))
    return parts


def button_svg(cx: int, cy: int, r: int) -> str:
    return "\n".join(
        [
            f'<g filter="url(#button-shadow)">',
            circle(cx, cy, r, fill="url(#button-fill)", stroke="#2f7197", **{"stroke-width": "4"}),
            circle(cx - 9, cy - 2, 5, fill="#24445a"),
            circle(cx + 4, cy + 6, 5, fill="#24445a"),
            circle(cx - 9, cy - 2, 2.1, fill="#8ccce7"),
            circle(cx + 4, cy + 6, 2.1, fill="#8ccce7"),
            circle(cx - 10, cy - 10, r * 0.28, fill="#d9f4ff", opacity="0.25"),
            "</g>",
        ]
    )


def leather_patch_svg(x: int, y: int, size: int, angle: int) -> str:
    half = size / 2
    inner = size - 10
    return "\n".join(
        [
            f'<g transform="translate({x} {y}) rotate({angle})" filter="url(#soft-shadow)">',
            rect(-half, -half, size, size, fill="url(#leather-fill)", stroke="#4e3c27", **{"stroke-width": "2"}),
            rect(-(inner / 2), -(inner / 2), inner, inner, fill="none", stroke="#a58b65", **{"stroke-width": "1.2", "stroke-dasharray": "1 5", "stroke-linecap": "round", "opacity": "0.55"}),
            "</g>",
        ]
    )


def outer_border_svg() -> list[str]:
    x0 = GRID_X[0]
    y0 = GRID_Y[0]
    w = GRID_X[-1] - GRID_X[0]
    h = GRID_Y[-1] - GRID_Y[0]
    return [
        rect(x0, y0, w, h, fill="none", stroke="#5d4530", **{"stroke-width": "5"}),
        rect(x0 + 6, y0 + 6, w - 12, h - 12, fill="none", stroke="#d0b187", **{"stroke-width": "1.6", "stroke-dasharray": "1 8", "stroke-linecap": "round", "opacity": "0.6"}),
    ]


def board_svg() -> str:
    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
        make_defs(),
        rect(0, 0, WIDTH, HEIGHT, fill="#efe7d6"),
    ]
    parts.extend(cell_svg())
    parts.extend(merged_rects_svg())
    parts.extend(track_svg())
    for item in LEATHER_PATCHES:
        parts.append(leather_patch_svg(item["x"], item["y"], item["size"], item["angle"]))
    for item in BUTTONS:
        parts.append(button_svg(item["x"], item["y"], item["r"]))
    parts.extend(outer_border_svg())
    parts.append("</svg>")
    return "\n".join(parts)


def board_layout() -> dict:
    return {
        "source_image": "designs/patchwork/time.jpg",
        "view_box": [0, 0, WIDTH, HEIGHT],
        "grid_x": GRID_X,
        "grid_y": GRID_Y,
        "patterns": PATTERNS,
        "buttons": BUTTONS,
        "leather_patches": LEATHER_PATCHES,
        "track_segments": TRACK_SEGMENTS,
        "special_rects": SPECIAL_RECTS,
        "recognition_summary": {
            "grid": "8x8 patch background",
            "buttons": 9,
            "leather_patches": 5,
            "center_patch": "2x2 orange patch with spiral",
            "finish_strip": "bottom-right orange strip spanning 3 cells",
        },
    }


def preview_html() -> str:
    return """<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <title>Patchwork Board Compare</title>
  <style>
    :root {
      --bg: #f3eee5;
      --card: #fffaf3;
      --ink: #2f241d;
      --muted: #7b6a58;
      --line: #d8ccbd;
    }
    body {
      margin: 0;
      padding: 24px;
      background: radial-gradient(circle at top, #faf5eb 0%, var(--bg) 60%);
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 28px;
    }
    p {
      margin: 0 0 20px;
      color: var(--muted);
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 18px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px;
      box-shadow: 0 12px 30px rgba(58, 37, 22, 0.08);
    }
    .label {
      margin-bottom: 10px;
      font-size: 14px;
      color: var(--muted);
    }
    img, object {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 12px;
      background: linear-gradient(135deg, #f8f1e6, #ede3d3);
    }
  </style>
</head>
<body>
  <h1>Patchwork 时间棋盘对照</h1>
  <p>左边是原图，右边是根据识别结果重建的 SVG 棋盘。</p>
  <div class="grid">
    <div class="card">
      <div class="label">原图 `time.jpg`</div>
      <img src="time.jpg" alt="Patchwork time board original" />
    </div>
    <div class="card">
      <div class="label">识别后的 `board.svg`</div>
      <object data="board.svg" type="image/svg+xml"></object>
    </div>
  </div>
</body>
</html>
"""


def main() -> None:
    BOARD_SVG.write_text(board_svg(), encoding="utf-8")
    BOARD_JSON.write_text(json.dumps(board_layout(), indent=2, ensure_ascii=False), encoding="utf-8")
    BOARD_HTML.write_text(preview_html(), encoding="utf-8")


if __name__ == "__main__":
    main()
