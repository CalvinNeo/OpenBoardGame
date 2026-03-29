#!/usr/bin/env python3

import json
import math
import sys
from pathlib import Path


ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
TERRAIN_COLORS = {
    "land": "#f4cf63",
    "water": "#4ea6d8",
    "rock": "#8c7d7d",
}
FEATURE_COLORS = {
    "water": "#0b84d8",
    "rock": "#6e5b5b",
}


def build_cells(config):
    rows = config["grid_fit"]["base_rows"]
    start_x = config["grid_fit"]["start_center"]["x"]
    start_y = config["grid_fit"]["start_center"]["y"]
    delta_x = config["grid_fit"]["delta"]["x"]
    delta_y = config["grid_fit"]["delta"]["y"]

    terrain_map = {}
    for terrain, cell_ids in config.get("terrain_hints", {}).items():
        for cell_id in cell_ids:
            terrain_map[cell_id] = terrain
    build_requirement_map = {
        item["cell"]: item["raw_type"] for item in config.get("build_ii_cells", [])
    }

    cells = []
    for row_index, count in enumerate(rows):
        row_letter = ROW_LETTERS[row_index]
        center_y = start_y + row_index * delta_y
        row_start_x = start_x - row_index * (delta_x / 2)
        for col_index in range(count):
            cell_id = f"{row_letter}{col_index + 1}"
            center_x = round(row_start_x + col_index * delta_x)
            cells.append(
                {
                    "id": cell_id,
                    "row": row_letter,
                    "col": col_index + 1,
                    "x": center_x,
                    "y": round(center_y),
                    "terrain_hint": terrain_map.get(cell_id, "land"),
                    "build_requirement": build_requirement_map.get(cell_id),
                }
            )

    for extra in config["grid_fit"].get("extra_cells", []):
        cells.append(
            {
                "id": extra["id"],
                "row": extra.get("row"),
                "col": extra.get("col"),
                "x": extra["x"],
                "y": extra["y"],
                "terrain_hint": extra.get("terrain_hint", terrain_map.get(extra["id"], "land")),
                "build_requirement": build_requirement_map.get(extra["id"]),
                "note": extra.get("note"),
            }
        )

    threshold = config["grid_fit"].get("neighbor_distance_threshold", 220)
    for current in cells:
        neighbor_pairs = []
        for other in cells:
            if current["id"] == other["id"]:
                continue
            distance = math.dist((current["x"], current["y"]), (other["x"], other["y"]))
            if distance < threshold:
                neighbor_pairs.append((distance, other["id"]))
        current["neighbors"] = [cell_id for _, cell_id in sorted(neighbor_pairs)]

    return cells


def render_svg(config, cells, output_path):
    width = config["image_size"]["width"]
    height = config["image_size"]["height"]
    reference_image = config["reference_image"]

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height + 270}" role="img">',
        "  <defs>",
        "    <style>",
        '      text { font-family: "Trebuchet MS", "Noto Sans", Arial, sans-serif; }',
        "      .title { font-size: 60px; font-weight: 800; fill: #2d241a; }",
        "      .subtitle { font-size: 26px; fill: #5b5147; }",
        "      .cell-label { font-size: 26px; font-weight: 800; fill: #ffffff; text-anchor: middle; dominant-baseline: middle; }",
        "      .bonus-label { font-size: 22px; font-weight: 800; fill: #231a12; text-anchor: middle; dominant-baseline: middle; }",
        "      .small { font-size: 18px; fill: #2d241a; }",
        "      .legend-label { font-size: 20px; font-weight: 700; fill: #2d241a; }",
        "    </style>",
        "  </defs>",
        f'  <rect x="0" y="0" width="{width}" height="{height + 270}" fill="#f4efe6" />',
        f'  <image href="{reference_image}" x="0" y="0" width="{width}" height="{height}" preserveAspectRatio="none" />',
        '  <rect x="18" y="18" width="760" height="108" rx="20" fill="rgba(255,248,238,0.9)" stroke="#b89563" stroke-width="4" />',
        '  <text x="42" y="66" class="title">Map 0 Annotated</text>',
        '  <text x="42" y="102" class="subtitle">Cells, terrain hints, cover bonuses, Build II cells, and left-track rewards.</text>',
    ]

    for cell in cells:
        fill = TERRAIN_COLORS.get(cell["terrain_hint"], TERRAIN_COLORS["land"])
        lines.append(
            f'  <circle cx="{cell["x"]}" cy="{cell["y"]}" r="26" fill="{fill}" fill-opacity="0.82" stroke="#fff" stroke-width="4" />'
        )
        lines.append(f'  <text x="{cell["x"]}" y="{cell["y"] + 1}" class="cell-label">{cell["id"]}</text>')

    for bonus in config.get("cover_bonuses", []):
        x = bonus["x"]
        y = bonus["y"]
        lines.append(
            f'  <rect x="{x - 44}" y="{y - 62}" width="88" height="34" rx="10" fill="rgba(255,247,210,0.96)" stroke="#8a6a1f" stroke-width="3" />'
        )
        lines.append(f'  <text x="{x}" y="{y - 45}" class="bonus-label">{bonus["code"]}</text>')

    for requirement in config.get("build_ii_cells", []):
        x = requirement["x"]
        y = requirement["y"]
        lines.append(
            f'  <rect x="{x - 42}" y="{y - 62}" width="84" height="34" rx="10" fill="rgba(255,235,220,0.96)" stroke="#b25a2b" stroke-width="3" />'
        )
        lines.append(f'  <text x="{x}" y="{y - 45}" class="bonus-label">{requirement["code"]}</text>')

    for reward in config.get("left_track_rewards", []):
        x = reward["x"]
        y = reward["y"]
        lines.append(
            f'  <rect x="{x - 58}" y="{y - 22}" width="116" height="44" rx="12" fill="rgba(255,255,255,0.9)" stroke="#6c6257" stroke-width="3" />'
        )
        lines.append(f'  <text x="{x}" y="{y + 1}" class="bonus-label">{reward["code"]}</text>')

    legend_y = height + 36
    lines.extend(
        [
            f'  <rect x="18" y="{height + 18}" width="{width - 36}" height="234" rx="20" fill="#fffaf2" stroke="#b89563" stroke-width="4" />',
            f'  <circle cx="60" cy="{legend_y}" r="18" fill="{TERRAIN_COLORS["land"]}" stroke="#fff" stroke-width="3" />',
            f'  <text x="92" y="{legend_y + 6}" class="legend-label">land cell</text>',
            f'  <circle cx="280" cy="{legend_y}" r="18" fill="{TERRAIN_COLORS["water"]}" stroke="#fff" stroke-width="3" />',
            f'  <text x="312" y="{legend_y + 6}" class="legend-label">water hint</text>',
            f'  <circle cx="520" cy="{legend_y}" r="18" fill="{TERRAIN_COLORS["rock"]}" stroke="#fff" stroke-width="3" />',
            f'  <text x="552" y="{legend_y + 6}" class="legend-label">rock hint</text>',
            f'  <text x="42" y="{legend_y + 52}" class="small">Cover bonus codes: CARD = draw card, M5/M10 = money, X = X-token, ACT1 = move one action card to slot 1, REP2 = reputation 2.</text>',
            f'  <text x="42" y="{legend_y + 84}" class="small">Build II: BII = this cell can only be covered after your Build action is upgraded to side II.</text>',
            f'  <text x="42" y="{legend_y + 116}" class="small">Left track: SNAP = take 1 card from the display, ENC2 = size-2 enclosure, M5/M12 = money, CONS1 = conservation, WRK = worker, X3 = 3 X-tokens.</text>',
            f'  <text x="42" y="{legend_y + 148}" class="small">The southeast shoreline uses manual cells SE1/SE2. Use terrain_features in the JSON when a cell hint looks ambiguous.</text>',
        ]
    )

    for index, feature in enumerate(config.get("terrain_features", [])):
        lines.append(
            f'  <text x="42" y="{legend_y + 184 + index * 24}" class="small">- {feature["id"]}: {feature["type"]} near {", ".join(feature["approx_cells"])}</text>'
        )

    lines.append("</svg>")
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    if len(sys.argv) != 4:
        print("usage: gen_arknova_map_svg.py <input.json> <output-expanded.json> <output.svg>", file=sys.stderr)
        raise SystemExit(2)

    input_path = Path(sys.argv[1])
    expanded_path = Path(sys.argv[2])
    svg_path = Path(sys.argv[3])

    config = json.loads(input_path.read_text(encoding="utf-8"))
    cells = build_cells(config)
    expanded = dict(config)
    expanded["cells"] = cells
    expanded_path.write_text(json.dumps(expanded, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    render_svg(config, cells, svg_path)


if __name__ == "__main__":
    main()
