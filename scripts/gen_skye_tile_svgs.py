import importlib.util
import json
from pathlib import Path
from typing import Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
GAME_MODULE_PATH = ROOT / "game" / "isle_of_skye.py"
OUT_DIR = ROOT / "designs" / "skye" / "curated" / "base" / "svg_tiles"
REVIEW_PATH = ROOT / "designs" / "skye" / "curated" / "base" / "tile_svg_review.html"

TERRAIN_STYLE = {
    "pasture": {"fill": "#78c850", "stroke": "#3f7d29"},
    "mountain": {"fill": "#9097a1", "stroke": "#59606a"},
    "water": {"fill": "#4aa9e9", "stroke": "#176eab"},
}

ICON_STYLE = {
    "castle": {"fill": "#334155", "text": "Ca"},
    "whisky": {"fill": "#b45309", "text": "Wh"},
    "sheep": {"fill": "#e5e7eb", "text": "Sh"},
    "cattle": {"fill": "#92400e", "text": "Ct"},
    "ship": {"fill": "#ef4444", "text": "Bo"},
    "broch": {"fill": "#cbd5e1", "text": "Br"},
    "farm": {"fill": "#a16207", "text": "Fa"},
    "lighthouse": {"fill": "#facc15", "text": "Li"},
    "scroll": {"fill": "#f4e1b5", "text": "Sc"},
}

EDGE_POLYGONS = {
    "N": "0,0 100,0 68,42 32,42",
    "E": "100,0 100,100 58,68 58,32",
    "S": "0,100 100,100 68,58 32,58",
    "W": "0,0 0,100 42,68 42,32",
}

ROAD_ARMS = {
    "N": '<rect x="44" y="0" width="12" height="50" fill="#dcc28e" stroke="#8a6a3c" stroke-width="1.5" rx="5"/>',
    "E": '<rect x="50" y="44" width="50" height="12" fill="#dcc28e" stroke="#8a6a3c" stroke-width="1.5" rx="5"/>',
    "S": '<rect x="44" y="50" width="12" height="50" fill="#dcc28e" stroke="#8a6a3c" stroke-width="1.5" rx="5"/>',
    "W": '<rect x="0" y="44" width="50" height="12" fill="#dcc28e" stroke="#8a6a3c" stroke-width="1.5" rx="5"/>',
}

BRIDGE_ARMS = {
    "N": '<rect x="43" y="0" width="14" height="50" fill="#b08968" stroke="#5b4636" stroke-width="1.5" rx="5"/><rect x="46" y="0" width="8" height="50" fill="#efe4c9" rx="4"/><rect x="41" y="0" width="2" height="50" fill="#5b4636"/><rect x="57" y="0" width="2" height="50" fill="#5b4636"/>',
    "E": '<rect x="50" y="43" width="50" height="14" fill="#b08968" stroke="#5b4636" stroke-width="1.5" rx="5"/><rect x="50" y="46" width="50" height="8" fill="#efe4c9" rx="4"/><rect x="50" y="41" width="50" height="2" fill="#5b4636"/><rect x="50" y="57" width="50" height="2" fill="#5b4636"/>',
    "S": '<rect x="43" y="50" width="14" height="50" fill="#b08968" stroke="#5b4636" stroke-width="1.5" rx="5"/><rect x="46" y="50" width="8" height="50" fill="#efe4c9" rx="4"/><rect x="41" y="50" width="2" height="50" fill="#5b4636"/><rect x="57" y="50" width="2" height="50" fill="#5b4636"/>',
    "W": '<rect x="0" y="43" width="50" height="14" fill="#b08968" stroke="#5b4636" stroke-width="1.5" rx="5"/><rect x="0" y="46" width="50" height="8" fill="#efe4c9" rx="4"/><rect x="0" y="41" width="50" height="2" fill="#5b4636"/><rect x="0" y="57" width="50" height="2" fill="#5b4636"/>',
}

REGION_CENTERS = {
    frozenset(["N"]): (50, 20),
    frozenset(["E"]): (80, 50),
    frozenset(["S"]): (50, 80),
    frozenset(["W"]): (20, 50),
    frozenset(["N", "E"]): (68, 30),
    frozenset(["E", "S"]): (70, 68),
    frozenset(["S", "W"]): (32, 70),
    frozenset(["W", "N"]): (30, 32),
    frozenset(["N", "S"]): (50, 50),
    frozenset(["E", "W"]): (50, 50),
    frozenset(["N", "E", "S"]): (62, 50),
    frozenset(["E", "S", "W"]): (50, 62),
    frozenset(["S", "W", "N"]): (38, 50),
    frozenset(["W", "N", "E"]): (50, 38),
    frozenset(["N", "E", "S", "W"]): (50, 50),
}


def _load_skye_module():
    spec = importlib.util.spec_from_file_location("skye_svg_source", GAME_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load Isle of Skye module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _esc(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _terrain_majority(tile_def: Dict) -> str:
    counts: Dict[str, int] = {}
    for terrain in tile_def["edges"].values():
        counts[terrain] = counts.get(terrain, 0) + 1
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _region_anchor(tile_def: Dict, region_id: str) -> Tuple[int, int]:
    for region in tile_def.get("regions", []):
        if region["id"] != region_id:
            continue
        anchor = REGION_CENTERS.get(frozenset(region.get("edges", [])))
        if anchor:
            return anchor
        break
    return (50, 50)


def _icon_layout(tile_def: Dict) -> List[Tuple[Dict, int, int]]:
    slots_by_anchor: Dict[Tuple[int, int], List[Dict]] = {}
    for icon in tile_def.get("icons", []):
        anchor = _region_anchor(tile_def, icon.get("region_id", ""))
        slots_by_anchor.setdefault(anchor, []).append(icon)

    placed: List[Tuple[Dict, int, int]] = []
    for anchor, icons in sorted(slots_by_anchor.items()):
        if len(icons) == 1:
            placed.append((icons[0], anchor[0], anchor[1]))
            continue
        spread = 10
        offsets = [(-spread, -spread), (spread, -spread), (-spread, spread), (spread, spread)]
        for icon, (dx, dy) in zip(icons, offsets):
            placed.append((icon, anchor[0] + dx, anchor[1] + dy))
    return placed


def _tile_svg(tile_id: str, tile_def: Dict) -> str:
    majority = _terrain_majority(tile_def)
    majority_style = TERRAIN_STYLE[majority]
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">',
        f'<rect x="0" y="0" width="100" height="100" fill="{majority_style["fill"]}" stroke="{majority_style["stroke"]}" stroke-width="2" rx="8"/>',
    ]

    for edge in ("N", "E", "S", "W"):
        terrain = tile_def["edges"][edge]
        style = TERRAIN_STYLE[terrain]
        parts.append(
            f'<polygon points="{EDGE_POLYGONS[edge]}" fill="{style["fill"]}" stroke="{style["stroke"]}" stroke-width="1.5"/>'
        )

    road_exits = tile_def.get("road_exits", [])
    bridge_exits = set(tile_def.get("bridge_exits", []))
    if road_exits:
        for edge in road_exits:
            parts.append(BRIDGE_ARMS[edge] if edge in bridge_exits else ROAD_ARMS[edge])
        if bridge_exits:
            parts.append('<circle cx="50" cy="50" r="11" fill="#b08968" stroke="#5b4636" stroke-width="1.5"/>')
            parts.append('<circle cx="50" cy="50" r="7" fill="#efe4c9"/>')
        else:
            parts.append('<circle cx="50" cy="50" r="10" fill="#dcc28e" stroke="#8a6a3c" stroke-width="1.5"/>')

    for icon, cx, cy in _icon_layout(tile_def):
        style = ICON_STYLE.get(icon["type"], {"fill": "#111827", "text": icon["type"][:2].title()})
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="9" fill="{style["fill"]}" stroke="#ffffff" stroke-width="1.5"/>')
        label = style["text"]
        if icon.get("count", 1) > 1:
            label = f'{label}{icon["count"]}'
        parts.append(
            f'<text x="{cx}" y="{cy + 3}" text-anchor="middle" font-family="Verdana, sans-serif" '
            f'font-size="7" font-weight="700" fill="#111111">{_esc(label)}</text>'
        )

    tile_no = tile_def.get("tile_no")
    if tile_no is not None:
        parts.append('<rect x="4" y="4" width="16" height="12" rx="3" fill="rgba(255,255,255,0.9)" stroke="#475569" stroke-width="1"/>')
        parts.append(
            f'<text x="12" y="13" text-anchor="middle" font-family="Verdana, sans-serif" font-size="8" fill="#0f172a">{tile_no}</text>'
        )

    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def _build_review_html(rows: List[Dict]) -> str:
    parts = [
        "<!doctype html>",
        "<html lang='en'>",
        "<head>",
        "  <meta charset='utf-8'>",
        "  <meta name='viewport' content='width=device-width, initial-scale=1'>",
        "  <title>Skye Tile SVG Review</title>",
        "  <style>",
        "    body { margin: 0; padding: 24px; background: #f5efe3; color: #1f2937; font-family: Georgia, serif; }",
        "    h1 { margin: 0 0 8px; }",
        "    p { margin: 0 0 20px; color: #475569; }",
        "    table { width: 100%; border-collapse: collapse; background: #fffaf2; }",
        "    th, td { border: 1px solid #d8ccb8; padding: 10px; vertical-align: top; }",
        "    th { background: #efe4cf; text-align: left; }",
        "    .name { font-weight: 700; min-width: 220px; }",
        "    img { width: 180px; height: 180px; object-fit: contain; background: #f4ead9; border-radius: 8px; display: block; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <h1>Skye Tile SVG Review</h1>",
        "  <p>Compare the curated source art with the generated semantic SVG for each tile. Blue marks ocean, green marks grassland, gray marks mountain; roads are split into ordinary roads and bridges.</p>",
        "  <table>",
        "    <thead><tr><th>Tile</th><th>Source</th><th>SVG</th></tr></thead>",
        "    <tbody>",
    ]
    for row in rows:
        parts.extend(
            [
                "      <tr>",
                f"        <td class='name'>{_esc(row['tile_id'])}</td>",
                f"        <td>{'<img src=\"' + _esc(row['source_rel']) + '\" alt=\"source\">' if row['source_rel'] else '-'}</td>",
                f"        <td><img src='{_esc(row['svg_rel'])}' alt='svg'></td>",
                "      </tr>",
            ]
        )
    parts.extend(["    </tbody>", "  </table>", "</body>", "</html>"])
    return "\n".join(parts) + "\n"


def main() -> None:
    module = _load_skye_module()
    tile_defs = module.TILE_DEFS_BY_ID
    curated_manifest = json.loads(module.CURATED_TILE_MANIFEST_PATH.read_text(encoding="utf-8"))
    source_map = {entry["tile_id"]: entry for entry in curated_manifest}
    out_dir = OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    review_rows: List[Dict] = []
    for tile_id, tile_def in sorted(tile_defs.items(), key=lambda item: (item[1].get("tile_no", -1), item[0])):
        svg_path = out_dir / f"{tile_id}.svg"
        svg_path.write_text(_tile_svg(tile_id, tile_def), encoding="utf-8")
        source_path = None
        source_rel = ""
        source_tile_id = tile_def.get("source_tile_id")
        if source_tile_id and source_tile_id != "start_castle":
            entry = source_map.get(source_tile_id)
            if entry:
                source_path = ROOT / "designs" / "skye" / "curated" / "base" / entry["curated_path"]
        if source_path and source_path.exists():
            source_rel = source_path.relative_to(REVIEW_PATH.parent).as_posix()
        review_rows.append(
            {
                "tile_id": tile_id,
                "source_rel": source_rel,
                "svg_rel": svg_path.relative_to(REVIEW_PATH.parent).as_posix(),
            }
        )

    REVIEW_PATH.write_text(_build_review_html(review_rows), encoding="utf-8")
    print(f"wrote {len(review_rows)} SVGs to {out_dir}")
    print(REVIEW_PATH)


if __name__ == "__main__":
    main()
