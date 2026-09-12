#!/usr/bin/env python3

"""Expand Ark Nova zoo-map data and render an original interactive SVG.

The source JSON contains logical coordinates instead of hand-maintained pixel
positions. This script converts those coordinates into SVG positions and
derives adjacency, keeping the server model and artwork in sync.
"""

from __future__ import annotations

import html
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ALLOWED_TERRAINS = {"land", "water", "rock"}
ALLOWED_BONUSES = {"appeal", "card", "money", "x_token", "action_to_slot"}


def _number(value: float) -> int | float:
    rounded = round(value, 3)
    return int(rounded) if rounded.is_integer() else rounded


def _fmt(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


def _hex_points(center_x: float, center_y: float, radius: float) -> str:
    points = []
    for angle_degrees in (0, 60, 120, 180, 240, 300):
        angle = math.radians(angle_degrees)
        points.append(
            f"{_fmt(center_x + radius * math.cos(angle))},"
            f"{_fmt(center_y + radius * math.sin(angle))}"
        )
    return " ".join(points)


def validate_source(config: dict[str, Any]) -> None:
    layout = config["layout"]
    column_lengths = layout["column_lengths"]
    cell_ids = {
        f"{chr(65 + column)}{row + 1}"
        for column, length in enumerate(column_lengths)
        for row in range(length)
    }

    terrain_cells: list[str] = []
    for terrain, ids in config["terrain"].items():
        if terrain not in ALLOWED_TERRAINS - {"land"}:
            raise ValueError(f"unknown terrain: {terrain}")
        terrain_cells.extend(ids)
    if len(terrain_cells) != len(set(terrain_cells)):
        raise ValueError("a cell cannot have more than one non-land terrain")

    bonus_cells = [bonus["cell"] for bonus in config["placement_bonuses"]]
    if len(bonus_cells) != len(set(bonus_cells)):
        raise ValueError("a cell cannot contain more than one placement bonus")
    for bonus in config["placement_bonuses"]:
        if bonus["type"] not in ALLOWED_BONUSES:
            raise ValueError(f"unknown placement bonus: {bonus['type']}")

    referenced = set(terrain_cells + bonus_cells + config["build_ii_cells"])
    unknown = referenced - cell_ids
    if unknown:
        raise ValueError(f"unknown cell ids: {sorted(unknown)}")

    blocked = set(terrain_cells)
    if blocked.intersection(bonus_cells) or blocked.intersection(config["build_ii_cells"]):
        raise ValueError("terrain cells cannot contain bonuses or Build II conditions")


def expand_config(config: dict[str, Any]) -> dict[str, Any]:
    validate_source(config)
    layout = config["layout"]
    radius = float(layout["radius"])
    x_step = radius * 1.5
    y_step = radius * math.sqrt(3)
    origin_x = float(layout["origin"]["x"])
    origin_y = float(layout["origin"]["y"])

    terrain_by_cell = {
        cell_id: terrain
        for terrain, cell_ids in config["terrain"].items()
        for cell_id in cell_ids
    }
    bonus_by_cell = {
        bonus["cell"]: {key: value for key, value in bonus.items() if key != "cell"}
        for bonus in config["placement_bonuses"]
    }
    build_ii_cells = set(config["build_ii_cells"])

    cells: list[dict[str, Any]] = []
    for column_index, column_length in enumerate(layout["column_lengths"]):
        column = chr(65 + column_index)
        center_x = origin_x + column_index * x_step
        center_y_start = origin_y - (y_step / 2 if column_index % 2 else 0)
        for row_index in range(column_length):
            cell_id = f"{column}{row_index + 1}"
            terrain = terrain_by_cell.get(cell_id, "land")
            axial_r = row_index - ((column_index + (column_index & 1)) // 2)
            cell: dict[str, Any] = {
                "id": cell_id,
                "column": column,
                "column_index": column_index,
                "row": row_index + 1,
                "axial": {"q": column_index, "r": axial_r},
                "center": {
                    "x": _number(center_x),
                    "y": _number(center_y_start + row_index * y_step),
                },
                "terrain": terrain,
                "buildable": terrain == "land",
            }
            if cell_id in bonus_by_cell:
                cell["placement_bonus"] = bonus_by_cell[cell_id]
            if cell_id in build_ii_cells:
                cell["build_requirement"] = "build_action_upgraded"
            cells.append(cell)

    neighbor_distance = y_step * 1.01
    for cell in cells:
        center = cell["center"]
        neighbors = []
        for candidate in cells:
            if candidate is cell:
                continue
            other_center = candidate["center"]
            distance = math.dist(
                (center["x"], center["y"]),
                (other_center["x"], other_center["y"]),
            )
            if distance <= neighbor_distance:
                neighbors.append(candidate["id"])
        cell["neighbors"] = sorted(neighbors)
        cell["border"] = len(neighbors) < 6

    expanded = dict(config)
    expanded["layout"] = {
        **layout,
        "orientation": "flat_top",
        "odd_columns_shift": "up",
        "x_step": _number(x_step),
        "y_step": _number(y_step),
    }
    expanded["cells"] = cells
    expanded["counts"] = {
        "total": len(cells),
        "buildable": sum(cell["buildable"] for cell in cells),
        "land": sum(cell["terrain"] == "land" for cell in cells),
        "water": sum(cell["terrain"] == "water" for cell in cells),
        "rock": sum(cell["terrain"] == "rock" for cell in cells),
        "placement_bonuses": sum("placement_bonus" in cell for cell in cells),
        "build_ii": sum("build_requirement" in cell for cell in cells),
    }

    mismatches = {
        key: (expected_value, expanded["counts"].get(key))
        for key, expected_value in config.get("expected_counts", {}).items()
        if expanded["counts"].get(key) != expected_value
    }
    if mismatches:
        raise ValueError(f"map counts do not match the audited source: {mismatches}")

    bonus_counts = Counter(bonus["type"] for bonus in config["placement_bonuses"])
    if config.get("expected_bonus_counts") and bonus_counts != Counter(
        config["expected_bonus_counts"]
    ):
        raise ValueError(
            "placement bonus counts do not match the audited source: "
            f"{dict(bonus_counts)}"
        )
    return expanded


def _bonus_label(bonus: dict[str, Any]) -> str:
    bonus_type = bonus["type"]
    if bonus_type == "card":
        return "Take 1 card within reputation range, or draw 1 from the deck"
    if bonus_type == "money":
        return f"Gain {bonus['amount']} money"
    if bonus_type == "x_token":
        return f"Gain {bonus['amount']} X-token"
    if bonus_type == "appeal":
        return f"Gain {bonus['amount']} appeal"
    if bonus_type == "action_to_slot":
        return f"After finishing, move any Action card to slot {bonus['slot']}"
    raise ValueError(f"unsupported bonus: {bonus_type}")


def _render_bonus_icon(
    bonus: dict[str, Any], center_x: float, center_y: float, scale: float = 1.0
) -> list[str]:
    transform = f'translate({_fmt(center_x)} {_fmt(center_y)}) scale({_fmt(scale)})'
    lines = [
        f'      <g class="ark-nova-map0-bonus" transform="{transform}">',
        '        <use href="#ark-nova-map0-bonus-badge"/>',
    ]
    bonus_type = bonus["type"]
    if bonus_type == "card":
        lines.extend(
            [
                '        <rect x="-13" y="-17" width="25" height="31" rx="3" fill="#f7f2df" stroke="#272b2f" stroke-width="3"/>',
                '        <path d="M-8 -10h15M-8 -5h15" stroke="#7f8790" stroke-width="2"/>',
                '        <path d="M-7 2h14l-7 9z" fill="#272b2f"/>',
            ]
        )
    elif bonus_type == "money":
        lines.extend(
            [
                '        <rect x="-19" y="-16" width="38" height="32" rx="9" fill="#4b5860" stroke="#eef4f2" stroke-width="3"/>',
                f'        <text x="0" y="2" class="ark-nova-map0-icon-number">{bonus["amount"]}</text>',
            ]
        )
    elif bonus_type == "x_token":
        lines.extend(
            [
                '        <path d="M-17-15l8-5L0-10 9-20l8 5L8 0l9 15-8 5L0 10l-9 10-8-5 9-15z" fill="#252a2e"/>',
                '        <circle cx="-10" cy="-9" r="2" fill="#f5f0dd"/><circle cx="10" cy="-9" r="2" fill="#f5f0dd"/>',
                '        <circle cx="-10" cy="9" r="2" fill="#f5f0dd"/><circle cx="10" cy="9" r="2" fill="#f5f0dd"/>',
            ]
        )
    elif bonus_type == "appeal":
        lines.extend(
            [
                '        <path d="M-16-17h32v8c-5 1-5 9 0 10v8h-32V1c5-1 5-9 0-10z" fill="#e8816d" stroke="#2d3033" stroke-width="3"/>',
                f'        <text x="0" y="2" class="ark-nova-map0-icon-number">{bonus["amount"]}</text>',
            ]
        )
    elif bonus_type == "action_to_slot":
        lines.extend(
            [
                '        <rect x="-17" y="-19" width="34" height="39" rx="6" fill="#f8f5e8" stroke="#262a2d" stroke-width="3"/>',
                '        <path d="M-14 6h14v11h-14z" fill="#19a8d6"/><path d="M0 6h14v11H0z" fill="#c02c86"/>',
                '        <text x="-4" y="-5" class="ark-nova-map0-action-one">1</text>',
                '        <path d="M4-13h10v8M14-13L7-7" fill="none" stroke="#262a2d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
            ]
        )
    lines.append("      </g>")
    return lines


def _render_build_requirement(center_x: float, center_y: float) -> list[str]:
    return [
        f'      <g class="ark-nova-map0-build-ii" transform="translate({_fmt(center_x)} {_fmt(center_y)})">',
        '        <path d="M-48 0L0-41.57L0 41.57Z" fill="#d96045" fill-opacity=".9"/>',
        '        <circle cx="-8" cy="0" r="24" fill="#f5eee4" stroke="#713258" stroke-width="4"/>',
        '        <path d="M-20-9h13L3 1l-6 6-10-10h-7z" fill="#293136"/>',
        '        <text x="-2" y="18" class="ark-nova-map0-ii">II</text>',
        "      </g>",
    ]


def _render_reward_icon(reward: dict[str, Any], center_x: float, center_y: float) -> list[str]:
    reward_type = reward["type"]
    if reward_type in ALLOWED_BONUSES:
        bonus = {
            key: value
            for key, value in reward.items()
            if key not in {"id", "timing", "label", "short_label"}
        }
        return _render_bonus_icon(bonus, center_x, center_y, 0.76)
    if reward_type == "free_enclosure":
        return [
            f'      <g transform="translate({_fmt(center_x)} {_fmt(center_y)})">',
            '        <path d="M-20 0l10-17h20L20 0 10 17h-20z" fill="#8a6332" stroke="#f8f1d9" stroke-width="2"/>',
            f'        <text x="0" y="2" class="ark-nova-map0-icon-number">{reward["size"]}</text>',
            "      </g>",
        ]
    if reward_type == "conservation":
        return [
            f'      <g transform="translate({_fmt(center_x)} {_fmt(center_y)})">',
            '        <path d="M0-21l20 7v14c0 13-9 21-20 26-11-5-20-13-20-26v-14z" fill="#b7db9b" stroke="#35683e" stroke-width="3"/>',
            f'        <text x="0" y="2" class="ark-nova-map0-icon-number">{reward["amount"]}</text>',
            "      </g>",
        ]
    if reward_type == "association_worker":
        return [
            f'      <g transform="translate({_fmt(center_x)} {_fmt(center_y)})">',
            '        <circle cx="0" cy="-10" r="9" fill="#26292b"/>',
            '        <path d="M-17 18c1-15 7-22 17-22s16 7 17 22z" fill="#26292b"/>',
            '        <path d="M-18 7h12M-12 1v12" stroke="#f7f2df" stroke-width="4"/>',
            "      </g>",
        ]
    raise ValueError(f"unsupported conservation reward: {reward_type}")


def render_svg(config: dict[str, Any]) -> str:
    width = config["view_box"]["width"]
    height = config["view_box"]["height"]
    radius = float(config["layout"]["radius"])
    cells = config["cells"]

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="ark-nova-map0-title ark-nova-map0-desc">',
        '  <title id="ark-nova-map0-title">Ark Nova — Zoo Map 0</title>',
        '  <desc id="ark-nova-map0-desc">An original compact vector reconstruction of Zoo Map 0 with 58 addressable hexes, terrain, placement bonuses, Build II restrictions, and conservation rewards.</desc>',
        "  <defs>",
        "    <style>",
        '      text { font-family: Inter, Avenir Next, Avenir, "Segoe UI", sans-serif; }',
        '      .ark-nova-map0-subheading { fill:#33443d; font-size:14px; font-weight:800; letter-spacing:1.4px; }',
        '      .ark-nova-map0-caption { fill:#5b665f; font-size:11px; font-weight:650; }',
        '      .ark-nova-map0-small { fill:#53615a; font-size:10px; font-weight:650; }',
        '      .ark-nova-map0-icon-number { fill:#fffdf2; font-size:19px; font-weight:900; text-anchor:middle; dominant-baseline:middle; }',
        '      .ark-nova-map0-action-one { fill:#242a2d; font-size:18px; font-weight:900; text-anchor:middle; dominant-baseline:middle; }',
        '      .ark-nova-map0-ii { fill:#713258; font-size:14px; font-weight:950; text-anchor:middle; }',
        '      .ark-nova-map0-hex { stroke:#f8f0cf; stroke-width:2.2; vector-effect:non-scaling-stroke; transition:stroke .12s,opacity .12s; }',
        '      .ark-nova-map0-cell { cursor:pointer; }',
        '      .ark-nova-map0-cell:hover .ark-nova-map0-hex, .ark-nova-map0-cell.is-valid .ark-nova-map0-hex { stroke:#fff; stroke-width:5; }',
        '      .ark-nova-map0-cell.is-selected .ark-nova-map0-hex { stroke:#ff8c42; stroke-width:6; }',
        '      .ark-nova-map0-cell.is-covered { opacity:.5; }',
        '      .ark-nova-map0-debug-label { display:none; fill:#24322d; font-size:9px; font-weight:850; text-anchor:middle; dominant-baseline:middle; pointer-events:none; }',
        '      .ark-nova-map0-show-debug .ark-nova-map0-debug-label { display:block; }',
        "    </style>",
        '    <pattern id="ark-nova-map0-grass" width="24" height="24" patternUnits="userSpaceOnUse">',
        '      <rect width="24" height="24" fill="#47744d"/>',
        '      <circle cx="5" cy="7" r="1.2" fill="#6f965e"/><circle cx="18" cy="16" r="1" fill="#355f42"/>',
        "    </pattern>",
        '    <pattern id="ark-nova-map0-land" width="22" height="22" patternUnits="userSpaceOnUse">',
        '      <rect width="22" height="22" fill="#dfcf9c"/>',
        '      <circle cx="5" cy="6" r="1.3" fill="#b9b66d"/><circle cx="16" cy="15" r="1.7" fill="#c8be7e"/>',
        "    </pattern>",
        '    <pattern id="ark-nova-map0-water" width="28" height="20" patternUnits="userSpaceOnUse">',
        '      <rect width="28" height="20" fill="#4da5c9"/>',
        '      <path d="M-4 8q7-6 14 0t14 0 14 0" fill="none" stroke="#9bd7e6" stroke-width="2" opacity=".75"/>',
        "    </pattern>",
        '    <pattern id="ark-nova-map0-rock" width="24" height="24" patternUnits="userSpaceOnUse">',
        '      <rect width="24" height="24" fill="#8b8790"/>',
        '      <path d="M0 19L8 5l8 9 8-6v16H0z" fill="#696d74" opacity=".72"/>',
        "    </pattern>",
        '    <path id="ark-nova-map0-bonus-badge" d="M0-29L27-9 17 24H-17L-27-9Z" fill="#f1d252" stroke="#3e4944" stroke-width="3"/>',
        "  </defs>",
        f'  <rect width="{width}" height="{height}" fill="#e8e3d5"/>',
        '  <rect x="232" y="28" width="718" height="632" rx="22" fill="url(#ark-nova-map0-grass)" stroke="#274b38" stroke-width="5"/>',
        '  <g id="ark-nova-map0-grid" aria-label="Zoo building grid">',
    ]

    for cell in cells:
        center_x = float(cell["center"]["x"])
        center_y = float(cell["center"]["y"])
        terrain = cell["terrain"]
        attributes = [
            f'id="ark-nova-map0-cell-{cell["id"]}"',
            f'class="ark-nova-map0-cell ark-nova-map0-terrain-{terrain}"',
            'role="button"',
            'tabindex="0"',
            f'data-cell-id="{cell["id"]}"',
            f'data-terrain="{terrain}"',
            f'data-buildable="{str(cell["buildable"]).lower()}"',
            f'data-border="{str(cell["border"]).lower()}"',
            f'data-neighbors="{",".join(cell["neighbors"])}"',
        ]
        if "placement_bonus" in cell:
            attributes.append(f'data-bonus-type="{cell["placement_bonus"]["type"]}"')
        if "build_requirement" in cell:
            attributes.append(f'data-build-requirement="{cell["build_requirement"]}"')

        description = f"{cell['id']}: {terrain}"
        if not cell["buildable"]:
            description += ", not buildable"
        if "placement_bonus" in cell:
            description += f", placement bonus: {_bonus_label(cell['placement_bonus'])}"
        if "build_requirement" in cell:
            description += ", requires the Build action upgraded to side II"

        lines.extend(
            [
                f'    <g {" ".join(attributes)} aria-label="{html.escape(description, quote=True)}">',
                f"      <title>{html.escape(description)}</title>",
                f'      <polygon class="ark-nova-map0-hex" points="{_hex_points(center_x, center_y, radius)}" fill="url(#ark-nova-map0-{terrain})"/>',
            ]
        )
        if terrain == "water":
            lines.append(
                f'      <path d="M{_fmt(center_x-25)} {_fmt(center_y+4)}q13-11 26 0t26 0" fill="none" stroke="#d4f2f5" stroke-width="3" opacity=".9"/>'
            )
        elif terrain == "rock":
            lines.append(
                f'      <path d="M{_fmt(center_x-28)} {_fmt(center_y+22)}l15-35 14 18 12-25 19 42z" fill="#62666c" stroke="#bcb8bf" stroke-width="2"/>'
            )
        if "build_requirement" in cell:
            lines.extend(_render_build_requirement(center_x, center_y))
        if "placement_bonus" in cell:
            lines.extend(_render_bonus_icon(cell["placement_bonus"], center_x, center_y))
        lines.append(
            f'      <text x="{_fmt(center_x)}" y="{_fmt(center_y)}" class="ark-nova-map0-debug-label">{cell["id"]}</text>'
        )
        lines.append("    </g>")
    lines.append("  </g>")

    lines.extend(
        [
            '  <g id="ark-nova-map0-conservation-rewards" aria-label="Conservation project rewards">',
            '    <rect x="18" y="28" width="196" height="632" rx="22" fill="#f2f0e9" stroke="#455c55" stroke-width="4"/>',
            '    <text x="36" y="60" class="ark-nova-map0-subheading">CONSERVATION</text>',
            '    <text x="36" y="78" class="ark-nova-map0-small">Uncover one reward per project</text>',
        ]
    )
    for index, reward in enumerate(config["conservation_rewards"]):
        center_y = 121 + index * 75
        recurring = reward["timing"] == "immediate_and_each_break"
        fill = "#9670a5" if recurring else "#f1d252"
        timing_label = "↻" if recurring else "⚡"
        timing_description = "Immediate + each break" if recurring else "Immediate once"
        lines.extend(
            [
                f'    <g id="ark-nova-map0-reward-{reward["id"]}" data-reward-id="{reward["id"]}" data-timing="{reward["timing"]}">',
                f"      <title>{html.escape(reward['label'])} — {timing_description}</title>",
                f'      <rect x="34" y="{_fmt(center_y-28)}" width="155" height="56" rx="12" fill="{fill}" stroke="#384640" stroke-width="2.5"/>',
                f'      <circle cx="57" cy="{_fmt(center_y)}" r="16" fill="#e9e5d9" stroke="#53645d" stroke-width="2"/>',
                f'      <path d="M49 {_fmt(center_y)}h16M57 {_fmt(center_y-8)}v16" stroke="#9aa39d" stroke-width="2"/>',
            ]
        )
        lines.extend(_render_reward_icon(reward, 102, center_y))
        lines.extend(
            [
                f'      <text x="143" y="{_fmt(center_y-2)}" class="ark-nova-map0-caption" text-anchor="middle">{html.escape(reward["short_label"])}</text>',
                f'      <text x="174" y="{_fmt(center_y+17)}" class="ark-nova-map0-caption" text-anchor="middle">{timing_label}</text>',
                "    </g>",
            ]
        )
    lines.append("  </g>")

    lines.extend(
        [
            '  <g id="ark-nova-map0-info" aria-label="Map information">',
            '    <rect x="970" y="28" width="352" height="632" rx="22" fill="#f6f3e9" stroke="#455c55" stroke-width="4"/>',
            '    <text x="994" y="62" class="ark-nova-map0-heading">MAP 0</text>',
            '    <text x="1110" y="58" class="ark-nova-map0-small">INTERMEDIATE</text>',
            '    <text x="1110" y="72" class="ark-nova-map0-small">IDENTICAL FOR ALL PLAYERS</text>',
            '    <rect x="994" y="88" width="304" height="83" rx="14" fill="#d7e6cd" stroke="#54745a" stroke-width="2"/>',
            '    <text x="1012" y="111" class="ark-nova-map0-caption">COMPLETE THE ZOO MAP</text>',
            '    <path d="M1042 122h25l12 21-12 21h-25l-12-21z" fill="#e8816d" stroke="#384640" stroke-width="2"/>',
            '    <text x="1054" y="145" class="ark-nova-map0-icon-number">7</text>',
            '    <text x="1094" y="138" class="ark-nova-map0-caption">appeal</text>',
            '    <text x="1094" y="155" class="ark-nova-map0-small">cover all 39 land spaces</text>',
            '    <text x="994" y="203" class="ark-nova-map0-subheading">PLACEMENT BONUSES</text>',
        ]
    )
    legend_items = [
        ({"type": "card", "amount": 1}, "Take 1 card"),
        ({"type": "money", "amount": 5}, "Gain money"),
        ({"type": "x_token", "amount": 1}, "Gain X-token"),
        ({"type": "appeal", "amount": 2}, "Gain appeal"),
        ({"type": "action_to_slot", "slot": 1}, "Action to slot 1"),
    ]
    for index, (bonus, label) in enumerate(legend_items):
        column = index % 2
        row = index // 2
        center_x = 1020 + column * 154
        center_y = 242 + row * 69
        lines.extend(_render_bonus_icon(bonus, center_x, center_y, 0.64))
        lines.append(
            f'    <text x="{_fmt(center_x+26)}" y="{_fmt(center_y+3)}" class="ark-nova-map0-small">{html.escape(label)}</text>'
        )
    lines.extend(
        [
            '    <text x="994" y="455" class="ark-nova-map0-subheading">BUILDING CONDITIONS</text>',
            '    <g transform="translate(1024 498) scale(.7)">',
        ]
    )
    lines.extend(_render_build_requirement(0, 0))
    lines.extend(
        [
            "    </g>",
            '    <text x="1066" y="493" class="ark-nova-map0-caption">Build action side II required</text>',
            '    <text x="1066" y="510" class="ark-nova-map0-small">G3 and H3 only</text>',
            '    <polygon points="1004,557 1031,557 1045,580 1031,603 1004,603 990,580" fill="url(#ark-nova-map0-water)" stroke="#f8f0cf" stroke-width="2"/>',
            '    <text x="1058" y="577" class="ark-nova-map0-caption">Water · not buildable</text>',
            '    <text x="1058" y="594" class="ark-nova-map0-small">counts for adjacency</text>',
            '    <polygon points="1165,557 1192,557 1206,580 1192,603 1165,603 1151,580" fill="url(#ark-nova-map0-rock)" stroke="#f8f0cf" stroke-width="2"/>',
            '    <text x="1219" y="577" class="ark-nova-map0-caption">Rock</text>',
            '    <text x="1219" y="594" class="ark-nova-map0-small">not buildable</text>',
            '    <text x="994" y="632" class="ark-nova-map0-small">58 hexes · 39 land · 10 water · 9 rock · 12 bonuses</text>',
            "  </g>",
            '  <g id="ark-nova-map0-action-slots" aria-label="Action card slots">',
            '    <text x="244" y="697" class="ark-nova-map0-subheading">ACTION STRENGTH</text>',
        ]
    )
    for index in range(5):
        x = 244 + index * 142
        lines.extend(
            [
                f'    <g id="ark-nova-map0-action-slot-{index+1}" data-action-slot="{index+1}">',
                f'      <path d="M{x} 716h130l8 92H{x-8}z" fill="#704a35" stroke="#382f2a" stroke-width="3"/>',
                f'      <rect x="{x+47}" y="700" width="40" height="35" rx="6" fill="#30373a"/>',
                f'      <text x="{x+67}" y="719" class="ark-nova-map0-slot-number">{index+1}</text>',
                f'      <text x="{x+65}" y="773" class="ark-nova-map0-caption" fill="#f3e8d1" text-anchor="middle">ACTION CARD</text>',
                "    </g>",
            ]
        )
    lines.extend(
        [
            "  </g>",
            '  <g aria-label="X-token capacity">',
            '    <rect x="970" y="686" width="352" height="122" rx="18" fill="#dce8f2" stroke="#536b79" stroke-width="3"/>',
            '    <text x="994" y="719" class="ark-nova-map0-subheading">X-TOKEN STORAGE</text>',
            '    <text x="994" y="744" class="ark-nova-map0-caption">Maximum 5</text>',
            '    <g transform="translate(1168 748)">',
            '      <path d="M-17-15l8-5L0-10 9-20l8 5L8 0l9 15-8 5L0 10l-9 10-8-5 9-15z" fill="#252a2e"/>',
            '      <circle cx="-10" cy="-9" r="2" fill="#f5f0dd"/><circle cx="10" cy="-9" r="2" fill="#f5f0dd"/><circle cx="-10" cy="9" r="2" fill="#f5f0dd"/><circle cx="10" cy="9" r="2" fill="#f5f0dd"/>',
            "    </g>",
            '    <text x="1204" y="755" class="ark-nova-map0-heading">× 5</text>',
            '    <text x="994" y="788" class="ark-nova-map0-small">Cell IDs and rules are embedded as data-* attributes.</text>',
            "  </g>",
            "</svg>",
        ]
    )
    # The browser already renders Action cards and X-token storage as live UI.
    # Keep the embedded board focused on the interactive zoo area; Map rules are
    # available from the adjacent Info button instead of occupying board space.
    reference_panel_start = lines.index(
        '  <g id="ark-nova-map0-info" aria-label="Map information">'
    )
    lines[reference_panel_start:] = ["</svg>"]
    return "\n".join(lines) + "\n"


def main() -> None:
    if len(sys.argv) != 4:
        print(
            "usage: gen_arknova_map_svg.py <source.json> <expanded.json> <output.svg>",
            file=sys.stderr,
        )
        raise SystemExit(2)

    source_path = Path(sys.argv[1])
    expanded_path = Path(sys.argv[2])
    svg_path = Path(sys.argv[3])
    config = json.loads(source_path.read_text(encoding="utf-8"))
    expanded = expand_config(config)

    expanded_path.parent.mkdir(parents=True, exist_ok=True)
    svg_path.parent.mkdir(parents=True, exist_ok=True)
    expanded_path.write_text(
        json.dumps(expanded, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    svg_path.write_text(render_svg(expanded), encoding="utf-8")


if __name__ == "__main__":
    main()
