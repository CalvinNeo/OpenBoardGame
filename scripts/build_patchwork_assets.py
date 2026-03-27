from __future__ import annotations

import json
import re
import shutil
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DESIGN_DIR = ROOT / "designs" / "patchwork"
SVG_DIR = DESIGN_DIR / "svg"
OUT_DIR = ROOT / "game" / "assets" / "patchwork"
OUT_SVG_DIR = OUT_DIR / "svg"
OUT_JSON = OUT_DIR / "patchwork.json"

# These trigger positions are derived from the extracted board art order and
# normalized onto the official 53-step track. The final income happens on 53.
BUTTON_MARKERS = [1, 7, 11, 13, 19, 21, 28, 31, 53]
LEATHER_MARKERS = [5, 17, 24, 43, 49]


def _load_patch_rows() -> list[dict]:
    return json.loads((DESIGN_DIR / "patches.json").read_text(encoding="utf-8"))


def _load_button_counts() -> dict[str, int]:
    html = (DESIGN_DIR / "button_compare.html").read_text(encoding="utf-8")
    return {
        file_name: int(count)
        for file_name, count in re.findall(
            r'<div class="title">([^<]+)</div>\s*<div class="meta">count (\d+)</div>',
            html,
        )
    }


def _load_label_numbers() -> dict[str, dict]:
    html = (DESIGN_DIR / "label_number_compare.html").read_text(encoding="utf-8")
    rows = re.findall(
        r'<div class="title">([^<]+)</div>\s*<div class="meta">flipped (True|False) · green ([^·]+) · black (\d+)</div>',
        html,
    )
    label_map: dict[str, dict] = {}
    for file_name, flipped, green, black in rows:
        cost = 0 if green.strip() == "?" else int(green)
        label_map[file_name] = {
            "cost_buttons": cost,
            "cost_time": int(black),
            "label_flipped": flipped == "True",
        }
    return label_map


def _load_board_layout() -> dict:
    return json.loads((DESIGN_DIR / "board_layout.json").read_text(encoding="utf-8"))


def _svg_cells(svg_name: str) -> list[list[int]]:
    root = ET.fromstring((SVG_DIR / svg_name).read_text(encoding="utf-8"))
    cells: list[list[int]] = []
    for elem in root:
        tag = elem.tag.split("}")[-1]
        if tag != "rect":
            continue
        if elem.attrib.get("fill") != "#4b4b4b":
            continue
        x = int(round(float(elem.attrib["x"]) / 80))
        y = int(round(float(elem.attrib["y"]) / 80))
        cells.append([x, y])
    return sorted(cells, key=lambda item: (item[1], item[0]))


def _canonical_key(cells: list[list[int]], cost_buttons: int, cost_time: int, income_buttons: int) -> tuple:
    return (
        tuple(tuple(cell) for cell in cells),
        cost_buttons,
        cost_time,
        income_buttons,
    )


def build_assets() -> dict:
    patch_rows = _load_patch_rows()
    button_counts = _load_button_counts()
    label_numbers = _load_label_numbers()
    board_layout = _load_board_layout()

    dedupe_map: dict[tuple, str] = {}
    duplicates: list[dict] = []
    patches: list[dict] = []

    for row in patch_rows:
        file_name = row["file"]
        svg_name = file_name.replace(".png", ".svg")
        if file_name not in button_counts:
            raise ValueError(f"missing button count for {file_name}")
        if file_name not in label_numbers:
            raise ValueError(f"missing label numbers for {file_name}")

        numbers = label_numbers[file_name]
        cells = _svg_cells(svg_name)
        key = _canonical_key(cells, numbers["cost_buttons"], numbers["cost_time"], button_counts[file_name])
        if key in dedupe_map:
            duplicates.append(
                {
                    "file": file_name,
                    "svg": f"svg/{svg_name}",
                    "duplicate_of": dedupe_map[key],
                }
            )
            continue

        patch_id = f"patch_{len(patches) + 1:02d}"
        dedupe_map[key] = patch_id
        width = max(cell[0] for cell in cells) + 1
        height = max(cell[1] for cell in cells) + 1
        patches.append(
            {
                "id": patch_id,
                "file": file_name,
                "svg": f"svg/{svg_name}",
                "cells": cells,
                "width": width,
                "height": height,
                "cell_count": len(cells),
                "cost_buttons": numbers["cost_buttons"],
                "cost_time": numbers["cost_time"],
                "income_buttons": button_counts[file_name],
                "label_flipped": numbers["label_flipped"],
            }
        )

    if len(patches) != 33:
        raise ValueError(f"expected 33 canonical patches, got {len(patches)}")

    smallest_patch = next(
        (
            patch["id"]
            for patch in patches
            if patch["cell_count"] == 2
            and patch["cost_buttons"] == 2
            and patch["cost_time"] == 1
            and patch["income_buttons"] == 0
        ),
        None,
    )
    if not smallest_patch:
        raise ValueError("smallest patch not found")

    return {
        "meta": {
            "source_dir": str(DESIGN_DIR.relative_to(ROOT)),
            "canonical_patch_count": len(patches),
            "excluded_duplicates": duplicates,
            "track_marker_note": (
                "Marker positions are normalized from the extracted board art order onto the official 53-step track. "
                "The final income resolves on step 53."
            ),
        },
        "board": {
            "size": 9,
            "time_track_end": 53,
            "starting_buttons": 5,
            "special_tile_bonus": 7,
            "button_markers": BUTTON_MARKERS,
            "leather_markers": LEATHER_MARKERS,
            "board_svg": "board.svg",
            "visual_layout": {
                "buttons": board_layout.get("buttons", []),
                "leather_patches": board_layout.get("leather_patches", []),
                "track_segments": board_layout.get("track_segments", []),
            },
        },
        "patches": patches,
        "smallest_patch_id": smallest_patch,
    }


def copy_svgs(assets: dict) -> None:
    OUT_SVG_DIR.mkdir(parents=True, exist_ok=True)
    needed_svgs = {patch["svg"].split("/", 1)[1] for patch in assets["patches"]}
    for svg_name in sorted(needed_svgs):
        shutil.copy2(SVG_DIR / svg_name, OUT_SVG_DIR / svg_name)
    shutil.copy2(DESIGN_DIR / "board.svg", OUT_DIR / "board.svg")


def main() -> None:
    assets = build_assets()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(assets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    copy_svgs(assets)
    print(f"Wrote {OUT_JSON.relative_to(ROOT)}")
    print(f"Copied {len(assets['patches'])} patch SVGs and board.svg into {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
