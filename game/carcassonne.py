import base64
import csv
import json
import math
import os
import random
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from game.memories import (
    build_html_document,
    esc,
    format_timestamp,
    render_kv_table,
    render_table,
    section,
)

SIDES = ["N", "E", "S", "W"]
SIDE_DELTAS = {
    "N": (0, -1),
    "E": (1, 0),
    "S": (0, 1),
    "W": (-1, 0),
}
OPPOSITE_SIDE = {"N": "S", "S": "N", "E": "W", "W": "E"}

SLOT_NAMES = ["N0", "N1", "E0", "E1", "S0", "S1", "W0", "W1"]
SLOT_POS = {
    "N0": (0.25, 0.0),
    "N1": (0.75, 0.0),
    "E0": (1.0, 0.25),
    "E1": (1.0, 0.75),
    "S0": (0.25, 1.0),
    "S1": (0.75, 1.0),
    "W0": (0.0, 0.25),
    "W1": (0.0, 0.75),
}
SLOT_BY_POS = {pos: name for name, pos in SLOT_POS.items()}
OPPOSITE_SLOT = {
    "N0": "S0",
    "N1": "S1",
    "S0": "N0",
    "S1": "N1",
    "E0": "W0",
    "E1": "W1",
    "W0": "E0",
    "W1": "E1",
}

TILE_SEGMENT_MAPS: Dict[str, Dict[str, bytes]] = {}
TEMPLATE_PUBLIC_CACHE: Optional[Dict] = None

FIELD_COLOR = "#7fbf7f"
ROAD_COLOR = "#c9b07a"
CITY_COLOR = "#8a8a8a"
MONASTERY_COLOR = "#d9c49a"
SHIELD_COLOR = "#c43c3c"

GRID_SIZE = 100
GRID_MID = GRID_SIZE // 2
NONE_BYTE = 255

PATH_TOKEN_RE = re.compile(r"[MLQZmlqz]|-?\d+(?:\.\d+)?")


@dataclass
class TileSegment:
    edges: Set[str]
    has_shield: bool = False


@dataclass
class FieldSegment:
    slots: Set[str]
    adjacent_cities: Set[int]


@dataclass
class TileTemplate:
    edges: Dict[str, str]
    road_segments: List[TileSegment]
    city_segments: List[TileSegment]
    field_segments: List[FieldSegment]
    edge_to_road: Dict[str, int]
    edge_to_city: Dict[str, int]
    slot_to_field: Dict[str, int]
    has_monastery: bool
    road_centers: List[Tuple[float, float]]
    city_centers: List[Tuple[float, float]]
    field_centers: List[Tuple[float, float]]
    monastery_center: Optional[Tuple[float, float]]


def _strip_ns(tag: str) -> str:
    return tag.split("}")[-1]


def _normalize_color(value: str) -> str:
    return value.strip().lower()


def _rotate_point(x: float, y: float, turns: int) -> Tuple[float, float]:
    for _ in range(turns % 4):
        x, y = (1 - y, x)
    return (round(x, 4), round(y, 4))


def _rotate_slot(slot: str, turns: int) -> str:
    x, y = SLOT_POS[slot]
    rx, ry = _rotate_point(x, y, turns)
    mapped = SLOT_BY_POS.get((rx, ry))
    if not mapped:
        raise ValueError(f"no slot mapping for {slot} -> {(rx, ry)}")
    return mapped


def _rotate_side(side: str, turns: int) -> str:
    idx = SIDES.index(side)
    return SIDES[(idx + turns) % 4]


def _parse_path_points(d: str) -> List[Tuple[float, float]]:
    tokens = PATH_TOKEN_RE.findall(d)
    points: List[Tuple[float, float]] = []
    cursor = (0.0, 0.0)
    start = None
    idx = 0
    cmd = None

    def add_point(pt: Tuple[float, float]) -> None:
        points.append(pt)

    while idx < len(tokens):
        token = tokens[idx]
        if re.fullmatch(r"[MLQZmlqz]", token):
            cmd = token
            idx += 1
            if cmd in ("Z", "z"):
                if start and (not points or points[-1] != start):
                    add_point(start)
                cmd = None
            continue
        if cmd is None:
            idx += 1
            continue
        if cmd in ("M", "m"):
            x = float(tokens[idx])
            y = float(tokens[idx + 1])
            idx += 2
            if cmd == "m":
                x += cursor[0]
                y += cursor[1]
            cursor = (x, y)
            start = cursor
            add_point(cursor)
            cmd = "L" if cmd == "M" else "l"
            continue
        if cmd in ("L", "l"):
            x = float(tokens[idx])
            y = float(tokens[idx + 1])
            idx += 2
            if cmd == "l":
                x += cursor[0]
                y += cursor[1]
            cursor = (x, y)
            add_point(cursor)
            continue
        if cmd in ("Q", "q"):
            cx = float(tokens[idx])
            cy = float(tokens[idx + 1])
            x = float(tokens[idx + 2])
            y = float(tokens[idx + 3])
            idx += 4
            if cmd == "q":
                cx += cursor[0]
                cy += cursor[1]
                x += cursor[0]
                y += cursor[1]
            segments = 20
            for step in range(1, segments + 1):
                t = step / segments
                mt = 1 - t
                px = mt * mt * cursor[0] + 2 * mt * t * cx + t * t * x
                py = mt * mt * cursor[1] + 2 * mt * t * cy + t * t * y
                add_point((px, py))
            cursor = (x, y)
            continue
        idx += 1
    if start and points and points[-1] != start:
        points.append(start)
    return points


def _point_in_polygon(x: float, y: float, poly: List[Tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _fill_rect(grid: List[List[str]], fill: str, x: float, y: float, w: float, h: float) -> None:
    x0 = max(0, int(math.floor(x)))
    y0 = max(0, int(math.floor(y)))
    x1 = min(GRID_SIZE, int(math.ceil(x + w)))
    y1 = min(GRID_SIZE, int(math.ceil(y + h)))
    for py in range(y0, y1):
        for px in range(x0, x1):
            cx = px + 0.5
            cy = py + 0.5
            if x <= cx <= x + w and y <= cy <= y + h:
                grid[py][px] = fill


def _fill_circle(grid: List[List[str]], fill: str, cx: float, cy: float, r: float) -> None:
    x0 = max(0, int(math.floor(cx - r)))
    y0 = max(0, int(math.floor(cy - r)))
    x1 = min(GRID_SIZE, int(math.ceil(cx + r)))
    y1 = min(GRID_SIZE, int(math.ceil(cy + r)))
    r2 = r * r
    for py in range(y0, y1):
        for px in range(x0, x1):
            dx = (px + 0.5) - cx
            dy = (py + 0.5) - cy
            if dx * dx + dy * dy <= r2 + 1e-6:
                grid[py][px] = fill


def _fill_polygon(grid: List[List[str]], fill: str, points: List[Tuple[float, float]]) -> None:
    if not points:
        return
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x0 = max(0, int(math.floor(min(xs))))
    y0 = max(0, int(math.floor(min(ys))))
    x1 = min(GRID_SIZE, int(math.ceil(max(xs))))
    y1 = min(GRID_SIZE, int(math.ceil(max(ys))))
    for py in range(y0, y1):
        for px in range(x0, x1):
            cx = px + 0.5
            cy = py + 0.5
            if _point_in_polygon(cx, cy, points):
                grid[py][px] = fill


def _render_svg(svg_path: Path) -> Tuple[List[List[str]], List[List[bool]], List[List[bool]], bool, List[Tuple[float, float]]]:
    import xml.etree.ElementTree as ET

    grid = [["field" for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    shield_mask = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    monastery_mask = [[False for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    monastery_present = False
    junction_markers: List[Tuple[float, float]] = []

    tree = ET.parse(svg_path)
    root = tree.getroot()

    for elem in root.iter():
        tag = _strip_ns(elem.tag)
        if tag not in ("rect", "polygon", "path", "circle"):
            continue
        if tag == "circle" and elem.attrib.get("data-node") == "junction":
            try:
                junction_markers.append((float(elem.attrib.get("cx", 0)), float(elem.attrib.get("cy", 0))))
            except ValueError:
                pass
        fill = elem.attrib.get("fill")
        if not fill or fill == "none":
            continue
        fill_color = _normalize_color(fill)
        if fill_color not in (FIELD_COLOR, ROAD_COLOR, CITY_COLOR, MONASTERY_COLOR, SHIELD_COLOR):
            continue
        if fill_color == MONASTERY_COLOR:
            monastery_present = True
            target_grid = None
        elif fill_color == SHIELD_COLOR:
            target_grid = None
        else:
            target_grid = grid

        if tag == "rect":
            x = float(elem.attrib.get("x", 0))
            y = float(elem.attrib.get("y", 0))
            w = float(elem.attrib.get("width", 0))
            h = float(elem.attrib.get("height", 0))
            if target_grid:
                if fill_color == ROAD_COLOR:
                    fill_type = "road"
                elif fill_color == CITY_COLOR:
                    fill_type = "city"
                else:
                    fill_type = "field"
                _fill_rect(target_grid, fill_type, x, y, w, h)
            elif fill_color == SHIELD_COLOR:
                _fill_rect(shield_mask, True, x, y, w, h)
            else:
                _fill_rect(monastery_mask, True, x, y, w, h)
            continue
        if tag == "circle":
            cx = float(elem.attrib.get("cx", 0))
            cy = float(elem.attrib.get("cy", 0))
            r = float(elem.attrib.get("r", 0))
            if target_grid:
                if fill_color == ROAD_COLOR:
                    fill_type = "road"
                elif fill_color == CITY_COLOR:
                    fill_type = "city"
                else:
                    fill_type = "field"
                _fill_circle(target_grid, fill_type, cx, cy, r)
            elif fill_color == SHIELD_COLOR:
                _fill_circle(shield_mask, True, cx, cy, r)
            else:
                _fill_circle(monastery_mask, True, cx, cy, r)
            continue
        if tag == "polygon":
            points_raw = elem.attrib.get("points", "").strip()
            points: List[Tuple[float, float]] = []
            for pair in points_raw.split():
                if not pair:
                    continue
                if "," in pair:
                    sx, sy = pair.split(",")
                else:
                    sx, sy = pair.split()
                points.append((float(sx), float(sy)))
            if target_grid:
                if fill_color == ROAD_COLOR:
                    fill_type = "road"
                elif fill_color == CITY_COLOR:
                    fill_type = "city"
                else:
                    fill_type = "field"
                _fill_polygon(target_grid, fill_type, points)
            elif fill_color == SHIELD_COLOR:
                _fill_polygon(shield_mask, True, points)
            else:
                _fill_polygon(monastery_mask, True, points)
            continue
        if tag == "path":
            d = elem.attrib.get("d", "")
            points = _parse_path_points(d)
            if target_grid:
                if fill_color == ROAD_COLOR:
                    fill_type = "road"
                elif fill_color == CITY_COLOR:
                    fill_type = "city"
                else:
                    fill_type = "field"
                _fill_polygon(target_grid, fill_type, points)
            elif fill_color == SHIELD_COLOR:
                _fill_polygon(shield_mask, True, points)
            else:
                _fill_polygon(monastery_mask, True, points)
            continue

    return grid, shield_mask, monastery_mask, monastery_present, junction_markers


def _label_components(grid: List[List[str]], target: str, shield_mask: Optional[List[List[bool]]] = None) -> Tuple[List[List[int]], int]:
    height = len(grid)
    width = len(grid[0]) if height else 0
    comp = [[-1 for _ in range(width)] for _ in range(height)]
    count = 0
    for y in range(height):
        for x in range(width):
            if comp[y][x] != -1:
                continue
            if target == "city":
                if grid[y][x] != "city" and not (shield_mask and shield_mask[y][x]):
                    continue
            else:
                if grid[y][x] != target:
                    continue
            queue = [(x, y)]
            comp[y][x] = count
            while queue:
                cx, cy = queue.pop()
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if nx < 0 or nx >= width or ny < 0 or ny >= height:
                        continue
                    if comp[ny][nx] != -1:
                        continue
                    if target == "city":
                        if grid[ny][nx] != "city" and not (shield_mask and shield_mask[ny][nx]):
                            continue
                    else:
                        if grid[ny][nx] != target:
                            continue
                    comp[ny][nx] = count
                    queue.append((nx, ny))
            count += 1
    return comp, count




def _compute_centroids(
    comp_grid: List[List[int]],
    count: int,
    allowed_mask: Optional[List[List[bool]]] = None,
) -> List[Tuple[float, float]]:
    totals: List[List[float]] = [[0.0, 0.0, 0.0] for _ in range(count)]
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            cid = comp_grid[y][x]
            if cid < 0:
                continue
            if allowed_mask is not None and not allowed_mask[y][x]:
                continue
            totals[cid][0] += (x + 0.5) / GRID_SIZE
            totals[cid][1] += (y + 0.5) / GRID_SIZE
            totals[cid][2] += 1.0
    centers: List[Tuple[float, float]] = []
    for sx, sy, count_cells in totals:
        if count_cells <= 0:
            centers.append((0.5, 0.5))
        else:
            centers.append((round(sx / count_cells, 4), round(sy / count_cells, 4)))
    return centers


def _compute_mask_centroid(mask: List[List[bool]]) -> Optional[Tuple[float, float]]:
    sx = 0.0
    sy = 0.0
    count = 0.0
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            if mask[y][x]:
                sx += (x + 0.5) / GRID_SIZE
                sy += (y + 0.5) / GRID_SIZE
                count += 1.0
    if count <= 0:
        return None
    return (round(sx / count, 4), round(sy / count, 4))


def _build_segment_map(
    comp_grid: List[List[int]],
    mapping: Optional[List[int]] = None,
) -> bytes:
    data = bytearray(GRID_SIZE * GRID_SIZE)
    idx = 0
    for y in range(GRID_SIZE):
        row = comp_grid[y]
        for x in range(GRID_SIZE):
            cid = row[x]
            if cid < 0:
                data[idx] = NONE_BYTE
            else:
                if mapping is not None:
                    if cid >= len(mapping):
                        data[idx] = NONE_BYTE
                    else:
                        mapped = mapping[cid]
                        data[idx] = mapped if mapped >= 0 else NONE_BYTE
                else:
                    data[idx] = cid if cid < NONE_BYTE else NONE_BYTE
            idx += 1
    return bytes(data)


def _build_monastery_map(mask: List[List[bool]]) -> bytes:
    data = bytearray(GRID_SIZE * GRID_SIZE)
    idx = 0
    for y in range(GRID_SIZE):
        row = mask[y]
        for x in range(GRID_SIZE):
            if row[x]:
                data[idx] = 0
            else:
                data[idx] = NONE_BYTE
            idx += 1
    return bytes(data)


def _apply_junction_mask(grid: List[List[str]], junction_markers: List[Tuple[float, float]]) -> None:
    if not junction_markers:
        return
    cut_size = 18
    half = cut_size // 2
    for cx, cy in junction_markers:
        center_x = int(round(cx))
        center_y = int(round(cy))
        x0 = max(0, center_x - half)
        y0 = max(0, center_y - half)
        x1 = min(GRID_SIZE, x0 + cut_size)
        y1 = min(GRID_SIZE, y0 + cut_size)
        for py in range(y0, y1):
            row = grid[py]
            for px in range(x0, x1):
                if row[px] == "road":
                    row[px] = "blocked"


def _build_tile_template(svg_path: Path) -> TileTemplate:
    tile_type = svg_path.stem
    grid, shield_mask, monastery_mask, monastery_present, junction_markers = _render_svg(svg_path)
    city_comp, city_count = _label_components(grid, "city", shield_mask)
    road_grid = [row[:] for row in grid]
    if junction_markers:
        _apply_junction_mask(road_grid, junction_markers)
    road_comp, road_count = _label_components(road_grid, "road")

    # field = everything else
    field_grid = [["field" if grid[y][x] not in ("road", "city") else "blocked" for x in range(GRID_SIZE)] for y in range(GRID_SIZE)]
    field_comp, field_count = _label_components(field_grid, "field")

    city_info = [TileSegment(edges=set(), has_shield=False) for _ in range(city_count)]
    road_info = [TileSegment(edges=set(), has_shield=False) for _ in range(road_count)]
    field_info = [FieldSegment(slots=set(), adjacent_cities=set()) for _ in range(field_count)]

    road_centers = _compute_centroids(road_comp, road_count)
    city_centers = _compute_centroids(city_comp, city_count)
    field_allowed = None
    if monastery_present:
        field_allowed = [[not monastery_mask[y][x] for x in range(GRID_SIZE)] for y in range(GRID_SIZE)]
    field_centers = _compute_centroids(field_comp, field_count, allowed_mask=field_allowed)
    monastery_center = _compute_mask_centroid(monastery_mask) if monastery_present else None
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            cid = city_comp[y][x]
            if cid >= 0:
                if y == 0:
                    city_info[cid].edges.add("N")
                if y == GRID_SIZE - 1:
                    city_info[cid].edges.add("S")
                if x == 0:
                    city_info[cid].edges.add("W")
                if x == GRID_SIZE - 1:
                    city_info[cid].edges.add("E")
                if shield_mask[y][x]:
                    city_info[cid].has_shield = True
            rid = road_comp[y][x]
            if rid >= 0:
                if y == 0:
                    road_info[rid].edges.add("N")
                if y == GRID_SIZE - 1:
                    road_info[rid].edges.add("S")
                if x == 0:
                    road_info[rid].edges.add("W")
                if x == GRID_SIZE - 1:
                    road_info[rid].edges.add("E")
            fid = field_comp[y][x]
            if fid >= 0:
                if y == 0:
                    field_info[fid].slots.add("N0" if x < GRID_MID else "N1")
                if y == GRID_SIZE - 1:
                    field_info[fid].slots.add("S0" if x < GRID_MID else "S1")
                if x == 0:
                    field_info[fid].slots.add("W0" if y < GRID_MID else "W1")
                if x == GRID_SIZE - 1:
                    field_info[fid].slots.add("E0" if y < GRID_MID else "E1")

    # field adjacency to city segments
    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            fid = field_comp[y][x]
            if fid < 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= GRID_SIZE or ny < 0 or ny >= GRID_SIZE:
                    continue
                cid = city_comp[ny][nx]
                if cid >= 0:
                    field_info[fid].adjacent_cities.add(cid)

    edge_types: Dict[str, str] = {}
    sample_min = max(0, GRID_MID - 10)
    sample_max = min(GRID_SIZE, GRID_MID + 10)
    for side in SIDES:
        if side in ("N", "S"):
            y = 0 if side == "N" else GRID_SIZE - 1
            has_road = any(grid[y][x] == "road" for x in range(sample_min, sample_max))
            has_city = any(grid[y][x] == "city" for x in range(sample_min, sample_max))
        else:
            x = 0 if side == "W" else GRID_SIZE - 1
            has_road = any(grid[y][x] == "road" for y in range(sample_min, sample_max))
            has_city = any(grid[y][x] == "city" for y in range(sample_min, sample_max))
        if has_road:
            edge_types[side] = "road"
        elif has_city:
            edge_types[side] = "city"
        else:
            edge_types[side] = "field"

    # Filter segment edges/slots by detected edge types to avoid corner artifacts.
    for seg in road_info:
        seg.edges = {side for side in seg.edges if edge_types.get(side) == "road"}
    for seg in city_info:
        seg.edges = {side for side in seg.edges if edge_types.get(side) == "city"}
    filtered_fields: List[FieldSegment] = []
    filtered_field_centers: List[Tuple[float, float]] = []
    field_id_map = [-1 for _ in range(len(field_info))]
    for idx, seg in enumerate(field_info):
        seg.slots = {slot for slot in seg.slots if edge_types.get(slot[0]) != "city"}
        if seg.slots:
            field_id_map[idx] = len(filtered_fields)
            filtered_fields.append(seg)
            filtered_field_centers.append(field_centers[idx])
    field_info = filtered_fields
    field_centers = filtered_field_centers

    edge_to_road: Dict[str, int] = {}
    for idx, seg in enumerate(road_info):
        for side in seg.edges:
            edge_to_road[side] = idx

    edge_to_city: Dict[str, int] = {}
    for idx, seg in enumerate(city_info):
        for side in seg.edges:
            edge_to_city[side] = idx

    slot_to_field: Dict[str, int] = {}
    for idx, seg in enumerate(field_info):
        for slot in seg.slots:
            slot_to_field[slot] = idx

    TILE_SEGMENT_MAPS[tile_type] = {
        "road": _build_segment_map(road_comp),
        "city": _build_segment_map(city_comp),
        "field": _build_segment_map(field_comp, field_id_map),
        "monastery": _build_monastery_map(monastery_mask),
    }

    return TileTemplate(
        edges=edge_types,
        road_segments=road_info,
        city_segments=city_info,
        field_segments=field_info,
        edge_to_road=edge_to_road,
        edge_to_city=edge_to_city,
        slot_to_field=slot_to_field,
        has_monastery=monastery_present,
        road_centers=road_centers,
        city_centers=city_centers,
        field_centers=field_centers,
        monastery_center=monastery_center,
    )


def _rotate_template(template: TileTemplate, turns: int) -> TileTemplate:
    if turns % 4 == 0:
        return template
    edges = { _rotate_side(side, turns): feature for side, feature in template.edges.items() }
    road_segments: List[TileSegment] = []
    for seg in template.road_segments:
        road_segments.append(TileSegment(edges={_rotate_side(side, turns) for side in seg.edges}))
    city_segments: List[TileSegment] = []
    for seg in template.city_segments:
        city_segments.append(TileSegment(edges={_rotate_side(side, turns) for side in seg.edges}, has_shield=seg.has_shield))
    field_segments: List[FieldSegment] = []
    for seg in template.field_segments:
        field_segments.append(FieldSegment(
            slots={_rotate_slot(slot, turns) for slot in seg.slots},
            adjacent_cities=set(seg.adjacent_cities),
        ))

    edge_to_road: Dict[str, int] = {}
    for idx, seg in enumerate(road_segments):
        for side in seg.edges:
            edge_to_road[side] = idx

    edge_to_city: Dict[str, int] = {}
    for idx, seg in enumerate(city_segments):
        for side in seg.edges:
            edge_to_city[side] = idx

    slot_to_field: Dict[str, int] = {}
    for idx, seg in enumerate(field_segments):
        for slot in seg.slots:
            slot_to_field[slot] = idx

    return TileTemplate(
        edges=edges,
        road_segments=road_segments,
        city_segments=city_segments,
        field_segments=field_segments,
        edge_to_road=edge_to_road,
        edge_to_city=edge_to_city,
        slot_to_field=slot_to_field,
        has_monastery=template.has_monastery,
        road_centers=[_rotate_point(x, y, turns) for x, y in template.road_centers],
        city_centers=[_rotate_point(x, y, turns) for x, y in template.city_centers],
        field_centers=[_rotate_point(x, y, turns) for x, y in template.field_centers],
        monastery_center=_rotate_point(*template.monastery_center, turns) if template.monastery_center else None,
    )


def _root_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def _tile_svg_path(tile_type: str) -> Path:
    return _root_dir() / "assets" / "task36_tiles_svg" / f"{tile_type}.svg"


def _load_manifest() -> List[Dict[str, str]]:
    manifest_path = _root_dir() / "assets" / "task36_tiles_72" / "manifest.csv"
    tiles: List[Dict[str, str]] = []
    with manifest_path.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            tile_id = os.path.splitext(row["file"])[0]
            tile_type = os.path.splitext(row["source_type"])[0]
            tiles.append({"id": tile_id, "type": tile_type})
    return tiles


def _load_templates() -> Dict[str, TileTemplate]:
    svg_dir = _root_dir() / "assets" / "task36_tiles_svg"
    templates: Dict[str, TileTemplate] = {}
    for svg_path in svg_dir.glob("*.svg"):
        tile_type = svg_path.stem
        templates[tile_type] = _build_tile_template(svg_path)
    return templates


TILE_DECK = _load_manifest()
TILE_TEMPLATES = _load_templates()
ROTATED_TEMPLATES: Dict[Tuple[str, int], TileTemplate] = {}
for tile_type, tmpl in TILE_TEMPLATES.items():
    for rotation in (0, 90, 180, 270):
        ROTATED_TEMPLATES[(tile_type, rotation)] = _rotate_template(tmpl, rotation // 90)


def _coord_key(x: int, y: int) -> str:
    return f"{x},{y}"


def _parse_coord(key: str) -> Tuple[int, int]:
    x_str, y_str = key.split(",")
    return int(x_str), int(y_str)


def _get_template(tile_type: str, rotation: int) -> TileTemplate:
    return ROTATED_TEMPLATES[(tile_type, rotation)]


def _meeple_position(tile: Dict) -> Optional[Tuple[float, float]]:
    meeple = tile.get("meeple")
    if not meeple:
        return None
    feature = meeple.get("feature")
    segment = meeple.get("segment")
    tmpl = _get_template(tile["type"], tile["rotation"])
    if feature == "road" and isinstance(segment, int) and 0 <= segment < len(tmpl.road_centers):
        return tmpl.road_centers[segment]
    if feature == "city" and isinstance(segment, int) and 0 <= segment < len(tmpl.city_centers):
        return tmpl.city_centers[segment]
    if feature == "field" and isinstance(segment, int) and 0 <= segment < len(tmpl.field_centers):
        return tmpl.field_centers[segment]
    if feature == "monastery":
        return tmpl.monastery_center or (0.5, 0.5)
    return None


def _list_candidate_positions(board: Dict[str, Dict]) -> Set[Tuple[int, int]]:
    candidates: Set[Tuple[int, int]] = set()
    for key in board.keys():
        x, y = _parse_coord(key)
        for dx, dy in SIDE_DELTAS.values():
            nx, ny = x + dx, y + dy
            if _coord_key(nx, ny) not in board:
                candidates.add((nx, ny))
    return candidates


def _is_valid_placement(board: Dict[str, Dict], tile_type: str, rotation: int, x: int, y: int) -> bool:
    if _coord_key(x, y) in board:
        return False
    tmpl = _get_template(tile_type, rotation)
    has_neighbor = False
    for side, (dx, dy) in SIDE_DELTAS.items():
        nx, ny = x + dx, y + dy
        neighbor_key = _coord_key(nx, ny)
        if neighbor_key not in board:
            continue
        has_neighbor = True
        neighbor = board[neighbor_key]
        neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
        if tmpl.edges[side] != neighbor_tmpl.edges[OPPOSITE_SIDE[side]]:
            return False
    return has_neighbor


def _find_legal_positions(board: Dict[str, Dict], tile_type: str) -> Dict[int, List[Tuple[int, int]]]:
    positions: Dict[int, List[Tuple[int, int]]] = {0: [], 90: [], 180: [], 270: []}
    candidates = _list_candidate_positions(board)
    for x, y in candidates:
        for rotation in (0, 90, 180, 270):
            if _is_valid_placement(board, tile_type, rotation, x, y):
                positions[rotation].append((x, y))
    return positions


def _draw_playable_tile(state: Dict) -> Optional[Dict]:
    while state["tile_bag"]:
        tile = state["tile_bag"].pop()
        legal = _find_legal_positions(state["board"], tile["type"])
        if any(legal[rot] for rot in legal):
            state["pending_tile"] = tile
            return tile
        state["discarded_tiles"].append(tile)
    state["pending_tile"] = None
    return None


def _feature_has_meeple(state: Dict, coord: Tuple[int, int], feature: str, segment_id: Optional[int]) -> bool:
    if feature == "monastery":
        key = _coord_key(*coord)
        tile = state["board"].get(key)
        if not tile:
            return False
        meeple = tile.get("meeple")
        return bool(meeple and meeple.get("feature") == "monastery")

    visited = set()
    queue = [(coord, segment_id)]
    board = state["board"]
    while queue:
        (x, y), seg = queue.pop()
        node = (x, y, seg)
        if node in visited:
            continue
        visited.add(node)
        tile = board.get(_coord_key(x, y))
        if not tile:
            continue
        meeple = tile.get("meeple")
        if meeple and meeple.get("feature") == feature and meeple.get("segment") == seg:
            return True
        tmpl = _get_template(tile["type"], tile["rotation"])
        if feature == "road":
            seg_info = tmpl.road_segments[seg]
            for side in seg_info.edges:
                dx, dy = SIDE_DELTAS[side]
                nx, ny = x + dx, y + dy
                neighbor = board.get(_coord_key(nx, ny))
                if not neighbor:
                    continue
                neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
                if neighbor_tmpl.edges[OPPOSITE_SIDE[side]] != "road":
                    continue
                nseg = neighbor_tmpl.edge_to_road.get(OPPOSITE_SIDE[side])
                if nseg is not None:
                    queue.append(((nx, ny), nseg))
        elif feature == "city":
            seg_info = tmpl.city_segments[seg]
            for side in seg_info.edges:
                dx, dy = SIDE_DELTAS[side]
                nx, ny = x + dx, y + dy
                neighbor = board.get(_coord_key(nx, ny))
                if not neighbor:
                    continue
                neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
                if neighbor_tmpl.edges[OPPOSITE_SIDE[side]] != "city":
                    continue
                nseg = neighbor_tmpl.edge_to_city.get(OPPOSITE_SIDE[side])
                if nseg is not None:
                    queue.append(((nx, ny), nseg))
        elif feature == "field":
            seg_info = tmpl.field_segments[seg]
            for slot in seg_info.slots:
                side = slot[0]
                dx, dy = SIDE_DELTAS[side]
                nx, ny = x + dx, y + dy
                neighbor = board.get(_coord_key(nx, ny))
                if not neighbor:
                    continue
                neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
                opposite_slot = OPPOSITE_SLOT[slot]
                nseg = neighbor_tmpl.slot_to_field.get(opposite_slot)
                if nseg is not None:
                    queue.append(((nx, ny), nseg))
    return False


def _collect_feature(state: Dict, coord: Tuple[int, int], feature: str, segment_id: int) -> Dict:
    board = state["board"]
    visited: Set[Tuple[int, int, int]] = set()
    queue = [(coord, segment_id)]
    tiles: Set[Tuple[int, int]] = set()
    meeples: List[Dict] = []
    open_edges = 0
    shields = 0
    while queue:
        (x, y), seg = queue.pop()
        node = (x, y, seg)
        if node in visited:
            continue
        visited.add(node)
        tile = board.get(_coord_key(x, y))
        if not tile:
            continue
        tiles.add((x, y))
        meeple = tile.get("meeple")
        if meeple and meeple.get("feature") == feature and meeple.get("segment") == seg:
            meeples.append(meeple)
        tmpl = _get_template(tile["type"], tile["rotation"])
        if feature == "road":
            seg_info = tmpl.road_segments[seg]
            for side in seg_info.edges:
                dx, dy = SIDE_DELTAS[side]
                nx, ny = x + dx, y + dy
                neighbor = board.get(_coord_key(nx, ny))
                if not neighbor:
                    open_edges += 1
                    continue
                neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
                if neighbor_tmpl.edges[OPPOSITE_SIDE[side]] != "road":
                    open_edges += 1
                    continue
                nseg = neighbor_tmpl.edge_to_road.get(OPPOSITE_SIDE[side])
                if nseg is not None:
                    queue.append(((nx, ny), nseg))
        elif feature == "city":
            seg_info = tmpl.city_segments[seg]
            if seg_info.has_shield:
                shields += 1
            for side in seg_info.edges:
                dx, dy = SIDE_DELTAS[side]
                nx, ny = x + dx, y + dy
                neighbor = board.get(_coord_key(nx, ny))
                if not neighbor:
                    open_edges += 1
                    continue
                neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
                if neighbor_tmpl.edges[OPPOSITE_SIDE[side]] != "city":
                    open_edges += 1
                    continue
                nseg = neighbor_tmpl.edge_to_city.get(OPPOSITE_SIDE[side])
                if nseg is not None:
                    queue.append(((nx, ny), nseg))
    return {
        "tiles": tiles,
        "meeples": meeples,
        "open_edges": open_edges,
        "shields": shields,
        "nodes": visited,
    }


def _collect_field(state: Dict, coord: Tuple[int, int], segment_id: int, city_components: Dict[Tuple[int, int, int], Dict]) -> Dict:
    board = state["board"]
    visited: Set[Tuple[int, int, int]] = set()
    queue = [(coord, segment_id)]
    tiles: Set[Tuple[int, int]] = set()
    meeples: List[Dict] = []
    adjacent_completed_cities: Set[int] = set()

    while queue:
        (x, y), seg = queue.pop()
        node = (x, y, seg)
        if node in visited:
            continue
        visited.add(node)
        tile = board.get(_coord_key(x, y))
        if not tile:
            continue
        tiles.add((x, y))
        meeple = tile.get("meeple")
        if meeple and meeple.get("feature") == "field" and meeple.get("segment") == seg:
            meeples.append(meeple)
        tmpl = _get_template(tile["type"], tile["rotation"])
        seg_info = tmpl.field_segments[seg]
        for local_city_id in seg_info.adjacent_cities:
            global_city = city_components.get((x, y, local_city_id))
            if global_city and global_city["completed"]:
                adjacent_completed_cities.add(global_city["id"])
        for slot in seg_info.slots:
            side = slot[0]
            dx, dy = SIDE_DELTAS[side]
            nx, ny = x + dx, y + dy
            neighbor = board.get(_coord_key(nx, ny))
            if not neighbor:
                continue
            neighbor_tmpl = _get_template(neighbor["type"], neighbor["rotation"])
            opposite_slot = OPPOSITE_SLOT[slot]
            nseg = neighbor_tmpl.slot_to_field.get(opposite_slot)
            if nseg is not None:
                queue.append(((nx, ny), nseg))

    return {
        "tiles": tiles,
        "meeples": meeples,
        "adjacent_completed_cities": adjacent_completed_cities,
        "nodes": visited,
    }


def _score_feature(state: Dict, feature: str, component: Dict, completed: bool) -> List[Dict]:
    events: List[Dict] = []
    if not component["meeples"]:
        return events
    counts: Dict[str, int] = {}
    for meeple in component["meeples"]:
        counts[meeple["player_id"]] = counts.get(meeple["player_id"], 0) + 1
    if not counts:
        return events
    max_count = max(counts.values())
    winners = [pid for pid, count in counts.items() if count == max_count]

    if feature == "road":
        points = len(component["tiles"])
    elif feature == "city":
        if completed:
            points = len(component["tiles"]) * 2 + component["shields"] * 2
        else:
            points = len(component["tiles"]) + component["shields"]
    else:
        points = 0

    for pid in winners:
        state["players"][pid]["score"] += points
    events.append({
        "type": "carcassonne:score",
        "payload": {
            "feature": feature,
            "completed": completed,
            "points": points,
            "players": winners,
        },
    })
    # return meeples
    for x, y, seg in component["nodes"]:
        tile = state["board"].get(_coord_key(x, y))
        if not tile:
            continue
        meeple = tile.get("meeple")
        if meeple and meeple.get("feature") == feature and meeple.get("segment") == seg:
            tile["meeple"] = None
            state["players"][meeple["player_id"]]["meeples"] += 1
    return events


def _score_monastery(state: Dict, coord: Tuple[int, int], end_game: bool) -> List[Dict]:
    key = _coord_key(*coord)
    tile = state["board"].get(key)
    if not tile:
        return []
    meeple = tile.get("meeple")
    if not meeple or meeple.get("feature") != "monastery":
        return []
    # count surrounding tiles
    count = 0
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            nx, ny = coord[0] + dx, coord[1] + dy
            if _coord_key(nx, ny) in state["board"]:
                count += 1
    if not end_game and count < 9:
        return []
    points = count
    state["players"][meeple["player_id"]]["score"] += points
    tile["meeple"] = None
    state["players"][meeple["player_id"]]["meeples"] += 1
    return [{
        "type": "carcassonne:score",
        "payload": {
            "feature": "monastery",
            "completed": count == 9,
            "points": points,
            "players": [meeple["player_id"]],
        },
    }]


def _resolve_completed_features(state: Dict, placed_coord: Tuple[int, int]) -> List[Dict]:
    events: List[Dict] = []
    board = state["board"]
    tile = board.get(_coord_key(*placed_coord))
    if not tile:
        return events
    tmpl = _get_template(tile["type"], tile["rotation"])
    visited_roads: Set[Tuple[int, int, int]] = set()
    visited_cities: Set[Tuple[int, int, int]] = set()

    for idx in range(len(tmpl.road_segments)):
        node = (placed_coord[0], placed_coord[1], idx)
        if node in visited_roads:
            continue
        comp = _collect_feature(state, placed_coord, "road", idx)
        visited_roads.update(comp["nodes"])
        if comp["open_edges"] == 0:
            events.extend(_score_feature(state, "road", comp, True))

    for idx in range(len(tmpl.city_segments)):
        node = (placed_coord[0], placed_coord[1], idx)
        if node in visited_cities:
            continue
        comp = _collect_feature(state, placed_coord, "city", idx)
        visited_cities.update(comp["nodes"])
        if comp["open_edges"] == 0:
            events.extend(_score_feature(state, "city", comp, True))

    # monasteries around placed tile (including itself)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            coord = (placed_coord[0] + dx, placed_coord[1] + dy)
            t = board.get(_coord_key(*coord))
            if not t:
                continue
            tmpl_neighbor = _get_template(t["type"], t["rotation"])
            if tmpl_neighbor.has_monastery:
                events.extend(_score_monastery(state, coord, False))
    return events


def _final_scoring(state: Dict) -> List[Dict]:
    events: List[Dict] = []
    board = state["board"]
    visited_roads: Set[Tuple[int, int, int]] = set()
    visited_cities: Set[Tuple[int, int, int]] = set()

    city_component_map: Dict[Tuple[int, int, int], Dict] = {}
    city_components: List[Dict] = []

    # score roads and cities (incomplete)
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        for idx in range(len(tmpl.road_segments)):
            node = (x, y, idx)
            if node in visited_roads:
                continue
            comp = _collect_feature(state, (x, y), "road", idx)
            visited_roads.update(comp["nodes"])
            events.extend(_score_feature(state, "road", comp, False))

        for idx in range(len(tmpl.city_segments)):
            node = (x, y, idx)
            if node in visited_cities:
                continue
            comp = _collect_feature(state, (x, y), "city", idx)
            city_id = len(city_components)
            city_components.append({
                "id": city_id,
                "completed": comp["open_edges"] == 0,
                "tiles": comp["tiles"],
            })
            for tx, ty, cidx in comp["nodes"]:
                visited_cities.add((tx, ty, cidx))
                city_component_map[(tx, ty, cidx)] = {
                    "id": city_id,
                    "completed": comp["open_edges"] == 0,
                }
            events.extend(_score_feature(state, "city", comp, comp["open_edges"] == 0))

    # monasteries
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        if tmpl.has_monastery:
            events.extend(_score_monastery(state, (x, y), True))

    # fields
    visited_fields: Set[Tuple[int, int, int]] = set()
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        for idx in range(len(tmpl.field_segments)):
            node = (x, y, idx)
            if node in visited_fields:
                continue
            comp = _collect_field(state, (x, y), idx, city_component_map)
            visited_fields.update(comp["nodes"])
            if not comp["meeples"]:
                continue
            counts: Dict[str, int] = {}
            for meeple in comp["meeples"]:
                counts[meeple["player_id"]] = counts.get(meeple["player_id"], 0) + 1
            max_count = max(counts.values()) if counts else 0
            winners = [pid for pid, count in counts.items() if count == max_count]
            points = len(comp["adjacent_completed_cities"]) * 3
            for pid in winners:
                state["players"][pid]["score"] += points
            events.append({
                "type": "carcassonne:score",
                "payload": {
                    "feature": "field",
                    "completed": True,
                    "points": points,
                    "players": winners,
                },
            })
    return events


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    if not order:
        state["current_turn"] = None
        return
    current = state["current_turn"]
    if current not in order:
        idx = 0
    else:
        idx = order.index(current)
    next_idx = (idx + 1) % len(order)
    state["current_turn"] = order[next_idx]


def _build_meeple_options(state: Dict, coord: Tuple[int, int], player_id: str) -> List[Dict]:
    options: List[Dict] = []
    player = state["players"].get(player_id)
    if not player or player["meeples"] <= 0:
        return options
    tile = state["board"].get(_coord_key(*coord))
    if not tile:
        return options
    tmpl = _get_template(tile["type"], tile["rotation"])
    for idx in range(len(tmpl.city_segments)):
        if _feature_has_meeple(state, coord, "city", idx):
            continue
        options.append({"feature": "city", "segment": idx, "label": f"City (segment {idx + 1})"})
    for idx in range(len(tmpl.road_segments)):
        if _feature_has_meeple(state, coord, "road", idx):
            continue
        options.append({"feature": "road", "segment": idx, "label": f"Road (segment {idx + 1})"})
    for idx in range(len(tmpl.field_segments)):
        if _feature_has_meeple(state, coord, "field", idx):
            continue
        options.append({"feature": "field", "segment": idx, "label": f"Field (segment {idx + 1})"})
    if tmpl.has_monastery:
        if not _feature_has_meeple(state, coord, "monastery", None):
            options.append({"feature": "monastery", "segment": None, "label": "Monastery"})
    return options


def _apply_scores_and_advance(state: Dict, placed_coord: Tuple[int, int]) -> List[Dict]:
    events = _resolve_completed_features(state, placed_coord)
    if not state.get("game_over"):
        _advance_turn(state)
        next_tile = _draw_playable_tile(state)
        if not next_tile:
            events.extend(_final_scoring(state))
            _finalize_game(state)
        else:
            state["phase"] = "place_tile"
    return events


def _finalize_game(state: Dict) -> None:
    scores = {pid: pdata["score"] for pid, pdata in state["players"].items()}
    max_score = max(scores.values()) if scores else 0
    winners = [pid for pid, score in scores.items() if score == max_score]
    state["scores"] = scores
    state["winner"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None


def get_carcassonne_template_payload() -> Dict:
    global TEMPLATE_PUBLIC_CACHE
    if TEMPLATE_PUBLIC_CACHE is not None:
        return TEMPLATE_PUBLIC_CACHE
    tiles: Dict[str, Dict] = {}
    for tile_type, tmpl in TILE_TEMPLATES.items():
        maps = TILE_SEGMENT_MAPS.get(tile_type)
        if not maps:
            continue
        tiles[tile_type] = {
            "road_map": base64.b64encode(maps["road"]).decode("ascii"),
            "city_map": base64.b64encode(maps["city"]).decode("ascii"),
            "field_map": base64.b64encode(maps["field"]).decode("ascii"),
            "monastery_map": base64.b64encode(maps["monastery"]).decode("ascii"),
            "road_segments": [sorted(seg.edges) for seg in tmpl.road_segments],
            "city_segments": [sorted(seg.edges) for seg in tmpl.city_segments],
            "field_segments": [sorted(seg.slots) for seg in tmpl.field_segments],
        }
    TEMPLATE_PUBLIC_CACHE = {
        "grid_size": GRID_SIZE,
        "none_value": NONE_BYTE,
        "tiles": tiles,
    }
    return TEMPLATE_PUBLIC_CACHE


class CarcassonneGame:
    game_id = "carcassonne"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered_players = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in ordered_players]
        player_meta = {p["player_id"]: p for p in ordered_players}
        colors = ["red", "blue", "green", "yellow", "black"]
        state_players: Dict[str, Dict] = {}
        for idx, pid in enumerate(player_ids):
            state_players[pid] = {
                "color": colors[idx % len(colors)],
                "score": 0,
                "meeples": 7,
            }
        tile_bag = list(TILE_DECK)
        random.shuffle(tile_bag)

        board: Dict[str, Dict] = {}
        discarded: List[Dict] = []
        # place random start tile
        start_tile = tile_bag.pop()
        start_rotation = random.choice([0, 90, 180, 270])
        board[_coord_key(0, 0)] = {
            "id": start_tile["id"],
            "type": start_tile["type"],
            "rotation": start_rotation,
            "meeple": None,
        }
        tile_history = [
            {
                "x": 0,
                "y": 0,
                "type": start_tile["type"],
                "rotation": start_rotation,
                "player_id": None,
            }
        ]

        start_player = random.choice(player_ids) if player_ids else None
        state = {
            "board": board,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": start_player,
            "tile_bag": tile_bag,
            "discarded_tiles": discarded,
            "pending_tile": None,
            "phase": "place_tile",
            "game_over": False,
            "winner": [],
            "scores": {},
            "last_placed": None,
            "config": config or {},
            "game_start_time": time.time(),
            "tile_history": tile_history,
        }
        if start_player:
            tile = _draw_playable_tile(state)
            if not tile:
                _final_scoring(state)
                _finalize_game(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        phase = state.get("phase")
        if phase == "place_tile":
            return ["place_tile"] if state.get("pending_tile") else []
        if phase == "place_meeple":
            last = state.get("last_placed")
            if not last:
                return []
            options = _build_meeple_options(state, (last["x"], last["y"]), player_id)
            if options:
                return ["place_meeple", "skip_meeple"]
            return ["skip_meeple"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        phase = state.get("phase")
        action_type = action.get("type")
        if phase == "place_tile":
            if action_type != "place_tile":
                return [], "invalid action"
            tile = state.get("pending_tile")
            if not tile:
                return [], "no pending tile"
            x = action.get("x")
            y = action.get("y")
            rotation = action.get("rotation")
            if not isinstance(x, int) or not isinstance(y, int):
                return [], "invalid position"
            if rotation not in (0, 90, 180, 270):
                return [], "invalid rotation"
            if not _is_valid_placement(state["board"], tile["type"], rotation, x, y):
                return [], "invalid placement"
            state["board"][_coord_key(x, y)] = {
                "id": tile["id"],
                "type": tile["type"],
                "rotation": rotation,
                "meeple": None,
            }
            history = state.get("tile_history")
            if isinstance(history, list):
                history.append({
                    "x": x,
                    "y": y,
                    "type": tile["type"],
                    "rotation": rotation,
                    "player_id": player_id,
                })
            state["pending_tile"] = None
            state["phase"] = "place_meeple"
            state["last_placed"] = {"x": x, "y": y}
            events = [{
                "type": "carcassonne:place_tile",
                "payload": {"player_id": player_id, "tile": tile["type"], "x": x, "y": y, "rotation": rotation},
            }]
            return events, None

        if phase == "place_meeple":
            last = state.get("last_placed")
            if not last:
                return [], "missing placement"
            coord = (last["x"], last["y"])
            if action_type == "place_meeple":
                feature = action.get("feature")
                segment = action.get("segment")
                if feature not in ("road", "city", "field", "monastery"):
                    return [], "invalid feature"
                options = _build_meeple_options(state, coord, player_id)
                valid = any(opt["feature"] == feature and opt.get("segment") == segment for opt in options)
                if not valid:
                    return [], "invalid meeple placement"
                tile = state["board"].get(_coord_key(*coord))
                if not tile:
                    return [], "missing tile"
                tile["meeple"] = {"player_id": player_id, "feature": feature, "segment": segment}
                state["players"][player_id]["meeples"] -= 1
                events = [{
                    "type": "carcassonne:place_meeple",
                    "payload": {"player_id": player_id, "feature": feature, "segment": segment, "x": coord[0], "y": coord[1]},
                }]
                events.extend(_apply_scores_and_advance(state, coord))
                return events, None
            if action_type == "skip_meeple":
                events = [{
                    "type": "carcassonne:skip_meeple",
                    "payload": {"player_id": player_id, "x": coord[0], "y": coord[1]},
                }]
                events.extend(_apply_scores_and_advance(state, coord))
                return events, None
            return [], "invalid action"

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        board = state["board"]
        coords = [_parse_coord(key) for key in board.keys()]
        if coords:
            min_x = min(x for x, _ in coords) - 1
            max_x = max(x for x, _ in coords) + 1
            min_y = min(y for _, y in coords) - 1
            max_y = max(y for _, y in coords) + 1
        else:
            min_x = max_x = min_y = max_y = 0
        width = max_x - min_x + 1
        height = max_y - min_y + 1
        grid: List[List[Optional[Dict]]] = []
        for y in range(min_y, max_y + 1):
            row: List[Optional[Dict]] = []
            for x in range(min_x, max_x + 1):
                tile = board.get(_coord_key(x, y))
                if tile:
                    cell = {
                        "type": tile["type"],
                        "rotation": tile["rotation"],
                        "meeple": None,
                    }
                    if tile.get("meeple"):
                        meeple = tile["meeple"]
                        meeple_view = {
                            "player_id": meeple["player_id"],
                            "feature": meeple["feature"],
                            "color": state["players"].get(meeple["player_id"], {}).get("color"),
                        }
                        pos = _meeple_position(tile)
                        if pos:
                            meeple_view["pos"] = {"x": pos[0], "y": pos[1]}
                        if meeple.get("segment") is not None:
                            meeple_view["segment"] = meeple.get("segment")
                        cell["meeple"] = meeple_view
                    row.append(cell)
                else:
                    row.append(None)
            grid.append(row)

        players_view = []
        for pid, meta in sorted(state["player_meta"].items(), key=lambda item: item[1].get("seat", 0)):
            pdata = state["players"][pid]
            players_view.append({
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "color": pdata["color"],
                "score": pdata["score"],
                "meeples": pdata["meeples"],
            })

        pending_tile = state.get("pending_tile")
        legal_positions = None
        if pending_tile:
            legal_positions = _find_legal_positions(board, pending_tile["type"])

        meeple_options = []
        if state.get("phase") == "place_meeple" and viewer_id == state.get("current_turn"):
            last = state.get("last_placed")
            if last:
                meeple_options = _build_meeple_options(state, (last["x"], last["y"]), viewer_id)

        return {
            "game_id": CarcassonneGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "board": grid,
            "board_origin": {"x": min_x, "y": min_y},
            "board_width": width,
            "board_height": height,
            "pending_tile": pending_tile,
            "legal_positions": legal_positions,
            "meeple_options": meeple_options,
            "remaining_tiles": len(state.get("tile_bag", [])),
            "discarded_tiles": len(state.get("discarded_tiles", [])),
            "last_placed": state.get("last_placed"),
            "legal_actions": CarcassonneGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "scores": state.get("scores", {}),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None
        phase = state.get("phase")
        if phase == "place_tile":
            tile = state.get("pending_tile")
            if not tile:
                return None
            legal = _find_legal_positions(state["board"], tile["type"])
            for rotation in (0, 90, 180, 270):
                positions = legal.get(rotation) or []
                if positions:
                    x, y = positions[0]
                    return {"type": "place_tile", "x": x, "y": y, "rotation": rotation}
            return None
        if phase == "place_meeple":
            return {"type": "skip_meeple"}
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


def _meeple_label(meeple: Optional[Dict], player_meta: Dict[str, Dict]) -> str:
    if not meeple:
        return "-"
    pid = meeple.get("player_id")
    meta = player_meta.get(pid, {})
    name = meta.get("name") or pid or "-"
    feature = meeple.get("feature") or "-"
    segment = meeple.get("segment")
    seg_label = "-" if segment is None else str(segment + 1)
    return f"{esc(name, '-')}\u00a0\u00b7\u00a0{esc(feature, '-')}\u00a0{esc(seg_label, '-')}"


def _player_name_html(player_id: str, player_meta: Dict[str, Dict], players: Dict[str, Dict]) -> str:
    meta = player_meta.get(player_id, {})
    pdata = players.get(player_id, {})
    color = pdata.get("color") or "#111827"
    name = meta.get("name") or player_id or "-"
    return f'<span style="color: {esc(color, "#111827")}">{esc(name, "-")}</span>'


def _nodes_to_tile_segments(nodes: Set[Tuple[int, int, int]]) -> List[Dict]:
    tiles: Dict[Tuple[int, int], Set[int]] = {}
    for x, y, seg in nodes:
        tiles.setdefault((x, y), set()).add(seg)
    return [
        {"x": x, "y": y, "segments": sorted(list(segs))}
        for (x, y), segs in sorted(tiles.items())
    ]


def _monastery_tile_count(state: Dict, coord: Tuple[int, int]) -> int:
    count = 0
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            nx, ny = coord[0] + dx, coord[1] + dy
            if _coord_key(nx, ny) in state.get("board", {}):
                count += 1
    return count


def _js_dump(data: object) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return payload.replace("</", "<\\/")


def _collect_component_winners(meeples: List[Dict]) -> List[str]:
    counts: Dict[str, int] = {}
    for meeple in meeples:
        pid = meeple.get("player_id")
        if not pid:
            continue
        counts[pid] = counts.get(pid, 0) + 1
    if not counts:
        return []
    max_count = max(counts.values())
    return [pid for pid, count in counts.items() if count == max_count]


def _build_score_summary_section(state: Dict, player_meta: Dict, highlight_hint: bool = True) -> Tuple[str, bool]:
    players = state.get("players", {})
    if not players:
        return section("Score Summary", '<div class="muted">No players</div>'), False

    order = state.get("turn_order", [])
    if not isinstance(order, list):
        order = []
    order = [pid for pid in order if pid in players]
    for pid in players.keys():
        if pid not in order:
            order.append(pid)

    summary: Dict[str, Dict] = {}
    for pid in order:
        pdata = players.get(pid, {})
        try:
            base_score = int(pdata.get("score", 0))
        except (TypeError, ValueError):
            base_score = 0
        summary[pid] = {"base": base_score, "potential": 0, "entries": []}

    feature_titles = {
        "road": "Road",
        "city": "City",
        "field": "Field",
        "monastery": "Monastery",
    }

    entry_counter = 1
    highlightable = False

    def add_entry(feature: str, points: int, winners: List[str], nodes: Set[Tuple[int, int, int]], detail: str) -> None:
        nonlocal entry_counter, highlightable
        if not winners:
            return
        title = feature_titles.get(feature, feature.title())
        label = f"{title} +{points}"
        if detail:
            label = f"{label} ({detail})"
        entry = {
            "id": entry_counter,
            "feature": feature,
            "points": points,
            "label": label,
            "nodes": _nodes_to_tile_segments(nodes),
        }
        entry_counter += 1
        highlightable = True
        for pid in winners:
            if pid not in summary:
                continue
            summary[pid]["potential"] += points
            summary[pid]["entries"].append(entry)

    board = state.get("board", {})
    visited_cities: Set[Tuple[int, int, int]] = set()
    visited_roads: Set[Tuple[int, int, int]] = set()
    visited_fields: Set[Tuple[int, int, int]] = set()
    city_component_map: Dict[Tuple[int, int, int], Dict] = {}
    city_id = 0

    # Cities (for adjacency and incomplete scoring)
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        for idx in range(len(tmpl.city_segments)):
            node = (x, y, idx)
            if node in visited_cities:
                continue
            comp = _collect_feature(state, (x, y), "city", idx)
            completed = comp["open_edges"] == 0
            for tx, ty, cidx in comp["nodes"]:
                visited_cities.add((tx, ty, cidx))
                city_component_map[(tx, ty, cidx)] = {
                    "id": city_id,
                    "completed": completed,
                }
            if comp["meeples"] and not completed:
                winners = _collect_component_winners(comp["meeples"])
                points = len(comp["tiles"]) + comp["shields"]
                detail_parts = [f"tiles {len(comp['tiles'])}"]
                if comp["shields"]:
                    detail_parts.append(f"shields {comp['shields']}")
                add_entry("city", points, winners, comp["nodes"], ", ".join(detail_parts))
            city_id += 1

    # Roads (incomplete only)
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        for idx in range(len(tmpl.road_segments)):
            node = (x, y, idx)
            if node in visited_roads:
                continue
            comp = _collect_feature(state, (x, y), "road", idx)
            visited_roads.update(comp["nodes"])
            if not comp["meeples"] or comp["open_edges"] == 0:
                continue
            winners = _collect_component_winners(comp["meeples"])
            points = len(comp["tiles"])
            detail = f"tiles {len(comp['tiles'])}, open {comp['open_edges']}"
            add_entry("road", points, winners, comp["nodes"], detail)

    # Monasteries (incomplete only)
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        if not tmpl.has_monastery:
            continue
        meeple = tile.get("meeple")
        if not meeple or meeple.get("feature") != "monastery":
            continue
        count = _monastery_tile_count(state, (x, y))
        if count >= 9:
            continue
        pid = meeple.get("player_id")
        winners = [pid] if pid else []
        detail = f"tiles {count}/9"
        add_entry("monastery", count, winners, {(x, y, 0)}, detail)

    # Fields (end-game scoring on current board)
    for key, tile in board.items():
        x, y = _parse_coord(key)
        tmpl = _get_template(tile["type"], tile["rotation"])
        for idx in range(len(tmpl.field_segments)):
            node = (x, y, idx)
            if node in visited_fields:
                continue
            comp = _collect_field(state, (x, y), idx, city_component_map)
            visited_fields.update(comp["nodes"])
            if not comp["meeples"]:
                continue
            winners = _collect_component_winners(comp["meeples"])
            points = len(comp["adjacent_completed_cities"]) * 3
            detail = f"cities {len(comp['adjacent_completed_cities'])}"
            add_entry("field", points, winners, comp["nodes"], detail)

    rows: List[List[str]] = []
    for pid in order:
        pdata = summary.get(pid, {})
        base = pdata.get("base", 0)
        potential = pdata.get("potential", 0)
        total = base + potential
        entries = pdata.get("entries", [])
        if entries:
            entries_html = "<div class=\"carc-summary-list\">" + "".join(
                (
                    "<div class=\"carc-summary-entry\">"
                    f"<a href=\"#\" class=\"carc-summary-link\" data-hl-id=\"{esc(entry['id'], entry['id'])}\" "
                    f"data-feature=\"{esc(entry['feature'], entry['feature'])}\" "
                    f"data-nodes=\"{esc(_js_dump(entry['nodes']), '[]')}\">"
                    f"{esc(entry['label'], entry['label'])}</a></div>"
                )
                for entry in entries
            ) + "</div>"
        else:
            entries_html = '<span class="muted">-</span>'
        rows.append(
            [
                _player_name_html(pid, player_meta, players),
                esc(base, "0"),
                esc(potential, "0"),
                esc(total, "0"),
                entries_html,
            ]
        )

    note_html = "<div class=\"small\">Potential points assume end-game scoring for incomplete features.</div>"
    if highlightable and highlight_hint:
        note_html += "<div class=\"small muted\">Click a feature to highlight it on the replay board.</div>"
    summary_html = note_html + render_table(
        ["Player", "Score", "Incomplete Points", "Total", "Incomplete Features"],
        rows,
        empty_message="No scores",
    )
    return section("Score Summary", summary_html), highlightable


def _render_board_grid(state: Dict, player_meta: Dict[str, Dict]) -> str:
    board = state.get("board", {})
    if not board:
        return '<div class="muted">No tiles placed</div>'
    coords = [_parse_coord(key) for key in board.keys()]
    min_x = min(x for x, _ in coords)
    max_x = max(x for x, _ in coords)
    min_y = min(y for _, y in coords)
    max_y = max(y for _, y in coords)
    width = max_x - min_x + 1
    cells: List[str] = [f'<div class="carc-board-grid" style="--cols: {width};">']
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            tile = board.get(_coord_key(x, y))
            if not tile:
                cells.append('<div class="carc-board-cell empty"></div>')
                continue
            meeple_html = ""
            if tile.get("meeple"):
                meeple_html = f'<div class="small">Meeple: {_meeple_label(tile.get("meeple"), player_meta)}</div>'
            cells.append(
                "<div class=\"carc-board-cell\">"
                f"<div class=\"carc-board-title\">{esc(tile.get('type'), '-')}</div>"
                f"<div class=\"small\">({x}, {y}) \u00b7 {esc(tile.get('rotation', 0), '0')}\u00b0</div>"
                f"{meeple_html}"
                "</div>"
            )
    cells.append("</div>")
    return "".join(cells)


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    game_id = CarcassonneGame.game_id
    status_label = "Game Over" if state.get("game_over") else "In Progress"
    header = [
        "<h1>Download Memories</h1>",
        f"<div class=\"meta\">Game: {esc(game_id, '-')} · Room: {esc(room_id, '-')}</div>",
        f"<div class=\"meta\">Status: {esc(status_label, status_label)}</div>",
    ]
    start_time = format_timestamp(state.get("game_start_time"))
    if start_time != "-":
        header.append(f"<div class=\"meta\">Game Start: {esc(start_time, start_time)}</div>")
    header.append(f"<div class=\"meta\">Generated: {esc(format_timestamp(time.time()), '-')}</div>")

    player_meta = state.get("player_meta", {})
    order = state.get("turn_order", [])
    players_rows: List[List[str]] = []
    for pid in order:
        meta = player_meta.get(pid, {})
        pdata = state.get("players", {}).get(pid, {})
        color = pdata.get("color") or "#111827"
        name = esc(meta.get("name"), "-")
        name_html = f'<span style="color: {esc(color, "#111827")}">{name}</span>'
        players_rows.append(
            [
                esc(pid, "-"),
                name_html,
                esc(meta.get("seat"), "-"),
                esc(pdata.get("color"), "-"),
                esc(pdata.get("score"), "0"),
                esc(pdata.get("meeples"), "0"),
                esc("Yes" if meta.get("is_bot") else "No"),
            ]
        )
    players_section = section(
        "Players",
        render_table(
            ["Player ID", "Name", "Seat", "Color", "Score", "Meeples", "Bot"],
            players_rows,
            empty_message="No players",
        ),
    )

    summary_pairs = [
        ("Current Turn", esc(state.get("current_turn"), "-")),
        ("Phase", esc(state.get("phase"), "-")),
        ("Remaining Tiles", esc(len(state.get("tile_bag", [])), "0")),
        ("Discarded Tiles", esc(len(state.get("discarded_tiles", [])), "0")),
        ("Tiles Placed", esc(len(state.get("board", {})), "0")),
    ]
    summary_section = section("Summary", render_kv_table(summary_pairs))

    winners = state.get("winner") or []
    winner_names = []
    for pid in winners:
        meta = player_meta.get(pid, {})
        pdata = state.get("players", {}).get(pid, {})
        color = pdata.get("color") or "#111827"
        name = meta.get("name") or pid or "-"
        winner_names.append(f'<span style="color: {esc(color, "#111827")}">{esc(name, "-")}</span>')
    winner_section = section(
        "Winners",
        f'<div class="card">{esc(", ".join(winner_names) if winner_names else "-", "-")}</div>',
    )

    tile_history = state.get("tile_history") if isinstance(state.get("tile_history"), list) else None
    score_summary_section, score_summary_highlightable = _build_score_summary_section(
        state,
        player_meta,
        bool(tile_history),
    )

    board_section = section(
        "Board",
        "<details open><summary>Board Grid</summary>"
        + _render_board_grid(state, player_meta)
        + "</details>",
    )

    tile_rows: List[List[str]] = []
    for key, tile in sorted(state.get("board", {}).items()):
        x, y = _parse_coord(key)
        tile_rows.append(
            [
                esc(x, "0"),
                esc(y, "0"),
                esc(tile.get("type"), "-"),
                esc(tile.get("rotation", 0), "0"),
                _meeple_label(tile.get("meeple"), player_meta),
            ]
        )
    tiles_section = section(
        "Tiles",
        render_table(
            ["X", "Y", "Tile", "Rotation", "Meeple"],
            tile_rows,
            empty_message="No tiles",
        ),
    )

    replay_section = ""
    extra_script = ""
    if tile_history:
        tile_types = {entry.get("type") for entry in tile_history if isinstance(entry, dict) and entry.get("type")}
        tile_images: Dict[str, str] = {}
        for tile_type in tile_types:
            svg_path = _tile_svg_path(tile_type)
            try:
                svg_data = svg_path.read_text(encoding="utf-8")
            except OSError:
                continue
            encoded = base64.b64encode(svg_data.encode("utf-8")).decode("ascii")
            tile_images[tile_type] = f"data:image/svg+xml;base64,{encoded}"
        coords = [(entry.get("x"), entry.get("y")) for entry in tile_history if isinstance(entry, dict)]
        coords = [(x, y) for x, y in coords if isinstance(x, int) and isinstance(y, int)]
        if coords:
            min_x = min(x for x, _ in coords)
            max_x = max(x for x, _ in coords)
            min_y = min(y for _, y in coords)
            max_y = max(y for _, y in coords)
        else:
            min_x = max_x = min_y = max_y = 0
        replay_section = section(
            "Replay",
            (
                "<div class=\"carc-replay-controls\">"
                "<button type=\"button\" id=\"carcReplayPrev\">&#8592;</button>"
                "<div id=\"carcReplayStep\" class=\"carc-replay-step\">Step 1</div>"
                "<button type=\"button\" id=\"carcReplayNext\">&#8594;</button>"
                "</div>"
                "<div id=\"carcReplayHover\" class=\"carc-replay-hover\">Hover a tile to see who placed it.</div>"
                "<div id=\"carcReplayBoard\" class=\"carc-replay-board\"></div>"
            ),
        )
        player_names = {
            pid: (player_meta.get(pid, {}).get("name") or pid)
            for pid in state.get("players", {}).keys()
        }
        extra_script = (
            f"const carcReplayHistory = {_js_dump(tile_history)};\n"
            f"const carcReplayImages = {_js_dump(tile_images)};\n"
            f"const carcReplayBounds = {{minX: {min_x}, maxX: {max_x}, minY: {min_y}, maxY: {max_y}}};\n"
            f"const carcReplayPlayers = {_js_dump(player_names)};\n"
            "const carcReplayBoard = document.getElementById('carcReplayBoard');\n"
            "const carcReplayPrev = document.getElementById('carcReplayPrev');\n"
            "const carcReplayNext = document.getElementById('carcReplayNext');\n"
            "const carcReplayStepLabel = document.getElementById('carcReplayStep');\n"
            "const carcReplayHover = document.getElementById('carcReplayHover');\n"
            "let carcReplayStep = 1;\n"
            "const carcReplayMax = carcReplayHistory.length;\n"
            "let carcMemCellMap = new Map();\n"
            "function renderCarcReplay(){\n"
            "  if(!carcReplayBoard){return;}\n"
            "  const cols = carcReplayBounds.maxX - carcReplayBounds.minX + 1;\n"
            "  const rows = carcReplayBounds.maxY - carcReplayBounds.minY + 1;\n"
            "  carcReplayBoard.style.gridTemplateColumns = `repeat(${cols}, var(--carc-cell))`;\n"
            "  carcReplayBoard.innerHTML = '';\n"
            "  carcMemCellMap = new Map();\n"
            "  const active = new Map();\n"
            "  for(let i=0;i<carcReplayStep && i<carcReplayHistory.length;i+=1){\n"
            "    const t=carcReplayHistory[i];\n"
            "    if(t && Number.isInteger(t.x) && Number.isInteger(t.y)){\n"
            "      t.step = i + 1;\n"
            "      active.set(`${t.x},${t.y}`, t);\n"
            "    }\n"
            "  }\n"
            "  for(let y=carcReplayBounds.minY;y<=carcReplayBounds.maxY;y+=1){\n"
            "    for(let x=carcReplayBounds.minX;x<=carcReplayBounds.maxX;x+=1){\n"
            "      const cell=document.createElement('div');\n"
            "      cell.className='carc-replay-cell';\n"
            "      const tile=active.get(`${x},${y}`);\n"
            "      if(tile){\n"
            "        cell.classList.add('occupied');\n"
            "        cell.dataset.worldX = `${x}`;\n"
            "        cell.dataset.worldY = `${y}`;\n"
            "        cell.dataset.tileType = tile.type || '';\n"
            "        cell.dataset.rotation = `${tile.rotation||0}`;\n"
            "        cell.dataset.step = `${tile.step||''}`;\n"
            "        cell.dataset.playerId = tile.player_id || '';\n"
            "        const tileEl=document.createElement('div');\n"
            "        tileEl.className='carc-replay-tile';\n"
            "        const img=carcReplayImages[tile.type];\n"
            "        if(img){\n"
            "          tileEl.style.backgroundImage=`url(${img})`;\n"
            "        }\n"
            "        tileEl.style.transform=`rotate(${tile.rotation||0}deg)`;\n"
            "        cell.appendChild(tileEl);\n"
            "        const playerName = tile.player_id ? (carcReplayPlayers[tile.player_id] || tile.player_id) : 'Start tile';\n"
            "        cell.title = tile.step ? `Step ${tile.step} · ${playerName}` : playerName;\n"
            "        carcMemCellMap.set(`${x},${y}`, cell);\n"
            "      } else {\n"
            "        cell.classList.add('empty');\n"
            "      }\n"
            "      carcReplayBoard.appendChild(cell);\n"
            "    }\n"
            "  }\n"
            "  if(carcReplayStepLabel){carcReplayStepLabel.textContent=`Step ${carcReplayStep} / ${carcReplayMax}`;}\n"
            "  if(carcReplayPrev){carcReplayPrev.disabled = carcReplayStep <= 1;}\n"
            "  if(carcReplayNext){carcReplayNext.disabled = carcReplayStep >= carcReplayMax;}\n"
            "}\n"
            "function formatCarcReplayHover(step, playerId){\n"
            "  if(!step){return '-';}\n"
            "  if(!playerId){return `Step ${step} · Start tile`;}\n"
            "  const name = carcReplayPlayers[playerId] || playerId;\n"
            "  return `Step ${step} · ${name}`;\n"
            "}\n"
            "function updateCarcReplayHover(cell){\n"
            "  if(!carcReplayHover){return;}\n"
            "  if(!cell){carcReplayHover.textContent='-'; return;}\n"
            "  const step = Number(cell.dataset.step || 0);\n"
            "  const playerId = cell.dataset.playerId || '';\n"
            "  carcReplayHover.textContent = formatCarcReplayHover(step, playerId);\n"
            "}\n"
            "if(carcReplayBoard){\n"
            "  carcReplayBoard.addEventListener('mousemove', (event)=>{\n"
            "    const cell = event.target.closest('.carc-replay-cell.occupied');\n"
            "    if(!cell || !carcReplayBoard.contains(cell)){updateCarcReplayHover(null); return;}\n"
            "    updateCarcReplayHover(cell);\n"
            "  });\n"
            "  carcReplayBoard.addEventListener('mouseleave', ()=>updateCarcReplayHover(null));\n"
            "}\n"
            "if(carcReplayPrev){carcReplayPrev.addEventListener('click',()=>{if(carcReplayStep>1){carcReplayStep-=1;renderCarcReplay();}});}\n"
            "if(carcReplayNext){carcReplayNext.addEventListener('click',()=>{if(carcReplayStep<carcReplayMax){carcReplayStep+=1;renderCarcReplay();}});}\n"
            "renderCarcReplay();\n"
        )
    else:
        replay_section = section("Replay", '<div class="muted">Replay data not available for this game.</div>')

    if score_summary_highlightable and tile_history:
        template_payload = _js_dump(get_carcassonne_template_payload())
        extra_script += (
            "\n"
            f"const carcMemTemplatePayload = {template_payload};\n"
            "function carcMemDecodeMap(payload){\n"
            "  if(!payload||typeof payload!=='string'){return null;}\n"
            "  const binary=atob(payload);\n"
            "  const bytes=new Uint8Array(binary.length);\n"
            "  for(let i=0;i<binary.length;i+=1){bytes[i]=binary.charCodeAt(i);}\n"
            "  return bytes;\n"
            "}\n"
            "function carcMemPrepareTemplates(data){\n"
            "  if(!data||!data.tiles){return null;}\n"
            "  const tiles=data.tiles;\n"
            "  Object.keys(tiles).forEach((tileType)=>{\n"
            "    const tile=tiles[tileType];\n"
            "    tile._roadMap=carcMemDecodeMap(tile.road_map);\n"
            "    tile._cityMap=carcMemDecodeMap(tile.city_map);\n"
            "    tile._fieldMap=carcMemDecodeMap(tile.field_map);\n"
            "    tile._monasteryMap=carcMemDecodeMap(tile.monastery_map);\n"
            "  });\n"
            "  return data;\n"
            "}\n"
            "const carcMemTemplateData = carcMemPrepareTemplates(carcMemTemplatePayload);\n"
            "const carcMemSegmentCache = new Map();\n"
            "function carcMemRotatePointToBase(x,y,rotation){\n"
            "  let px=x; let py=y;\n"
            "  const turns=((rotation%360)+360)%360/90;\n"
            "  for(let i=0;i<turns;i+=1){const nx=py; const ny=1-px; px=nx; py=ny;}\n"
            "  return {x:px, y:py};\n"
            "}\n"
            "function carcMemBuildSegmentMask(tileType, rotation, feature, segment){\n"
            "  if(!carcMemTemplateData||!carcMemTemplateData.tiles){return null;}\n"
            "  const tile=carcMemTemplateData.tiles[tileType];\n"
            "  if(!tile){return null;}\n"
            "  let sourceMap=null;\n"
            "  if(feature==='road'){sourceMap=tile._roadMap;}\n"
            "  else if(feature==='city'){sourceMap=tile._cityMap;}\n"
            "  else if(feature==='field'){sourceMap=tile._fieldMap;}\n"
            "  else if(feature==='monastery'){sourceMap=tile._monasteryMap; segment=0;}\n"
            "  if(!sourceMap){return null;}\n"
            "  const size=carcMemTemplateData.grid_size||100;\n"
            "  const mask=new Uint8Array(size*size);\n"
            "  const turns=((rotation%360)+360)%360;\n"
            "  if(turns===0){\n"
            "    for(let idx=0;idx<sourceMap.length;idx+=1){if(sourceMap[idx]===segment){mask[idx]=1;}}\n"
            "    return mask;\n"
            "  }\n"
            "  for(let y=0;y<size;y+=1){\n"
            "    for(let x=0;x<size;x+=1){\n"
            "      const nx=(x+0.5)/size; const ny=(y+0.5)/size;\n"
            "      const base=carcMemRotatePointToBase(nx, ny, rotation);\n"
            "      const bx=Math.max(0, Math.min(size-1, Math.floor(base.x*size)));\n"
            "      const by=Math.max(0, Math.min(size-1, Math.floor(base.y*size)));\n"
            "      const bidx=by*size+bx;\n"
            "      if(sourceMap[bidx]===segment){mask[y*size+x]=1;}\n"
            "    }\n"
            "  }\n"
            "  return mask;\n"
            "}\n"
            "function carcMemGetSegmentImage(tileType, rotation, feature, segment){\n"
            "  const key=`${tileType}:${rotation}:${feature}:${segment}`;\n"
            "  if(carcMemSegmentCache.has(key)){return carcMemSegmentCache.get(key);}\n"
            "  const mask=carcMemBuildSegmentMask(tileType, rotation, feature, segment);\n"
            "  if(!mask||!carcMemTemplateData){return null;}\n"
            "  const size=carcMemTemplateData.grid_size||100;\n"
            "  const canvas=document.createElement('canvas');\n"
            "  canvas.width=size; canvas.height=size;\n"
            "  const ctx=canvas.getContext('2d');\n"
            "  if(!ctx){return null;}\n"
            "  ctx.imageSmoothingEnabled=false;\n"
            "  let fill='rgba(14, 116, 144, 0.18)';\n"
            "  let stroke='rgba(14, 116, 144, 0.9)';\n"
            "  if(feature==='road'){fill='rgba(217, 119, 6, 0.22)'; stroke='rgba(217, 119, 6, 0.95)';}\n"
            "  else if(feature==='city'){fill='rgba(71, 85, 105, 0.25)'; stroke='rgba(71, 85, 105, 0.95)';}\n"
            "  else if(feature==='field'){fill='rgba(34, 197, 94, 0.2)'; stroke='rgba(34, 197, 94, 0.95)';}\n"
            "  ctx.fillStyle=fill;\n"
            "  for(let y=0;y<size;y+=1){\n"
            "    const rowStart=y*size;\n"
            "    for(let x=0;x<size;x+=1){if(mask[rowStart+x]){ctx.fillRect(x,y,1,1);}}\n"
            "  }\n"
            "  ctx.fillStyle=stroke;\n"
            "  const thickness=4;\n"
            "  const radius=Math.floor(thickness/2);\n"
            "  for(let y=0;y<size;y+=1){\n"
            "    for(let x=0;x<size;x+=1){\n"
            "      const idx=y*size+x;\n"
            "      if(!mask[idx]){continue;}\n"
            "      const north=y===0?0:mask[idx-size];\n"
            "      const south=y===size-1?0:mask[idx+size];\n"
            "      const west=x===0?0:mask[idx-1];\n"
            "      const east=x===size-1?0:mask[idx+1];\n"
            "      if(north&&south&&west&&east){continue;}\n"
            "      for(let dy=-radius;dy<=radius;dy+=1){\n"
            "        const ny=y+dy; if(ny<0||ny>=size){continue;}\n"
            "        for(let dx=-radius;dx<=radius;dx+=1){\n"
            "          const nx=x+dx; if(nx<0||nx>=size){continue;}\n"
            "          ctx.fillRect(nx, ny, 1, 1);\n"
            "        }\n"
            "      }\n"
            "    }\n"
            "  }\n"
            "  const url=canvas.toDataURL('image/png');\n"
            "  carcMemSegmentCache.set(key, url);\n"
            "  return url;\n"
            "}\n"
            "(function(){\n"
            "  const board=document.getElementById('carcReplayBoard');\n"
            "  if(!board||!carcMemTemplateData){return;}\n"
            "  let activeLink=null;\n"
            "  let activeId=null;\n"
            "  let highlighted=new Set();\n"
            "  function clearHighlight(){\n"
            "    highlighted.forEach((key)=>{\n"
            "      const cell=carcMemCellMap.get(key);\n"
            "      if(!cell){return;}\n"
            "      cell.classList.remove('carc-mem-highlighted');\n"
            "      cell.querySelectorAll('.carc-highlight-shape').forEach((el)=>el.remove());\n"
            "    });\n"
            "    highlighted.clear();\n"
            "    if(activeLink){activeLink.classList.remove('active');}\n"
            "    activeLink=null; activeId=null;\n"
            "  }\n"
            "  function applyHighlight(feature, nodes){\n"
            "    if(!nodes||!Array.isArray(nodes)){return;}\n"
            "    const next=new Set();\n"
            "    nodes.forEach((entry)=>{\n"
            "      if(!entry||!Number.isInteger(entry.x)||!Number.isInteger(entry.y)){return;}\n"
            "      const key=`${entry.x},${entry.y}`;\n"
            "      const cell=carcMemCellMap.get(key);\n"
            "      if(!cell){return;}\n"
            "      const tileType=cell.dataset.tileType;\n"
            "      const rotation=Number(cell.dataset.rotation||0);\n"
            "      const segments=Array.isArray(entry.segments)?entry.segments:[];\n"
            "      segments.forEach((seg)=>{\n"
            "        const image=carcMemGetSegmentImage(tileType, rotation, feature, seg);\n"
            "        if(!image){return;}\n"
            "        const overlay=document.createElement('div');\n"
            "        overlay.className='carc-highlight-shape carc-selected-shape';\n"
            "        overlay.style.backgroundImage=`url(${image})`;\n"
            "        cell.appendChild(overlay);\n"
            "      });\n"
            "      cell.classList.add('carc-mem-highlighted');\n"
            "      next.add(key);\n"
            "    });\n"
            "    highlighted = next;\n"
            "  }\n"
            "  document.querySelectorAll('.carc-summary-link').forEach((link)=>{\n"
            "    link.addEventListener('click', (event)=>{\n"
            "      event.preventDefault();\n"
            "      const linkId=link.dataset.hlId||'';\n"
            "      if(activeId===linkId){clearHighlight(); return;}\n"
            "      const feature=link.dataset.feature||'';\n"
            "      let nodes=[];\n"
            "      try{nodes=JSON.parse(link.dataset.nodes||'[]');}catch(err){nodes=[];}\n"
            "      if(typeof carcReplayMax==='number'){\n"
            "        carcReplayStep = carcReplayMax;\n"
            "        renderCarcReplay();\n"
            "      }\n"
            "      clearHighlight();\n"
            "      applyHighlight(feature, nodes);\n"
            "      activeId=linkId; activeLink=link; link.classList.add('active');\n"
            "    });\n"
            "  });\n"
            "})();\n"
        )

    extra_style = """
.carc-board-grid {
  --cols: 1;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(110px, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.carc-board-cell {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px;
  min-height: 64px;
  background: #ffffff;
}
.carc-board-cell.empty {
  background: #f8fafc;
  border-style: dashed;
}
.carc-board-title {
  font-weight: 600;
  margin-bottom: 2px;
}
details summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 6px;
}
.carc-replay-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.carc-replay-controls button {
  padding: 4px 10px;
}
.carc-replay-step {
  font-weight: 600;
}
.carc-replay-hover {
  font-size: 0.9em;
  color: #475569;
  margin-bottom: 6px;
}
.carc-replay-board {
  --carc-cell: 56px;
  display: grid;
  gap: 4px;
  background: #e2e8f0;
  padding: 6px;
  border-radius: 8px;
}
.carc-replay-cell {
  width: var(--carc-cell);
  height: var(--carc-cell);
  border-radius: 4px;
  background: #f8fafc;
  position: relative;
  overflow: hidden;
}
.carc-replay-cell.occupied {
  background: #e2e8f0;
}
.carc-replay-tile {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  transform-origin: center;
}
.carc-replay-cell.empty {
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
}
.carc-highlight-shape {
  position: absolute;
  inset: 0;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  pointer-events: none;
  mix-blend-mode: multiply;
  filter: drop-shadow(0 0 4px rgba(15, 23, 42, 0.35));
}
.carc-highlight-shape.carc-selected-shape {
  opacity: 0.95;
  filter: drop-shadow(0 0 6px rgba(15, 23, 42, 0.45));
}
.carc-mem-highlighted {
  outline: 2px solid rgba(29, 78, 216, 0.6);
  outline-offset: -2px;
}
.carc-summary-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.carc-summary-entry {
  margin: 0;
}
.carc-summary-link {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #1e3a8a;
  text-decoration: none;
  font-size: 0.85em;
}
.carc-summary-link:hover {
  background: #e0e7ff;
}
.carc-summary-link.active {
  background: #1d4ed8;
  border-color: #1d4ed8;
  color: #ffffff;
}
"""

    body = (
        "\n".join(header)
        + players_section
        + summary_section
        + winner_section
        + replay_section
        + board_section
        + tiles_section
        + score_summary_section
    )
    return build_html_document(f"{game_id} Memories", body, extra_style=extra_style, extra_script=extra_script)


download_memories = build_memories_html
