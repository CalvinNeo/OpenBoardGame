import json
import random
from collections import defaultdict, deque
from functools import lru_cache
from pathlib import Path
from typing import DefaultDict, Dict, List, Optional, Set, Tuple


EDGE_ORDER = ("N", "E", "S", "W")
EDGE_DELTAS = {
    "N": (0, -1),
    "E": (1, 0),
    "S": (0, 1),
    "W": (-1, 0),
}
OPPOSITE_EDGE = {"N": "S", "E": "W", "S": "N", "W": "E"}
ROTATIONS = (0, 90, 180, 270)
ROUND_LIMIT = 6
ROUND_TRACK = {
    1: {"active_slots": ["A"], "catchup_bonus": 0},
    2: {"active_slots": ["B"], "catchup_bonus": 0},
    3: {"active_slots": ["A", "C"], "catchup_bonus": 1},
    4: {"active_slots": ["B", "D"], "catchup_bonus": 2},
    5: {"active_slots": ["A", "C", "D"], "catchup_bonus": 3},
    6: {"active_slots": ["B", "C", "D"], "catchup_bonus": 4},
}

REPO_ROOT = Path(__file__).resolve().parents[1]
CURATED_TILE_MANIFEST_PATH = REPO_ROOT / "designs" / "skye" / "curated" / "base" / "tile_manifest_draft.json"

TERRAIN_CODE = {
    "P": "pasture",
    "M": "mountain",
    "W": "water",
}

ICON_LABELS = {
    "castle": "Castle",
    "whisky": "Whisky",
    "sheep": "Sheep",
    "cattle": "Cattle",
    "ship": "Ship",
    "broch": "Broch",
    "farm": "Farm",
    "lighthouse": "Lighthouse",
    "scroll": "Scroll",
}

SCROLL_TYPES = (
    "per_2_sheep",
    "per_2_whisky_tiles",
    "per_2_ships",
    "per_cattle",
    "per_broch",
    "per_farm",
    "per_lighthouse",
)

SCORING_TILE_DEFS = [
    {
        "id": "square_plots",
        "slot_name": "Square Plots",
        "description": "2 VP for each square of 4 landscape tiles.",
    },
    {
        "id": "completionist",
        "slot_name": "Completionist",
        "description": "1 VP for each completed area.",
    },
    {
        "id": "sheepy_sheep",
        "slot_name": "Sheepy Sheep",
        "description": "1 VP for each sheep in your clan territory.",
    },
    {
        "id": "ultra_completionist",
        "slot_name": "Ultra Completionist",
        "description": "3 VP for each completed area of at least 3 tiles.",
    },
    {
        "id": "brochs_in_mountains",
        "slot_name": "Brochs In The Mountains",
        "description": "1/3/6 VP for each mountain area with 1/2/3+ brochs.",
    },
    {
        "id": "buildings_of_three",
        "slot_name": "Buildings Of Three",
        "description": "5 VP for each set of broch, farm, and lighthouse.",
    },
    {
        "id": "barrels_of_whisky",
        "slot_name": "Barrels Of Whisky",
        "description": "Majority scoring for tiles with whisky barrels: 5 VP / 2 VP.",
    },
    {
        "id": "clan_armada",
        "slot_name": "Clan Armada",
        "description": "Majority scoring for ships: 5 VP / 2 VP.",
    },
    {
        "id": "animals_near_farms",
        "slot_name": "Animals Near Farms",
        "description": "1 VP for each sheep and cattle on or adjacent to a farm tile.",
    },
    {
        "id": "pot_of_gold",
        "slot_name": "Pot Of Gold",
        "description": "Majority scoring for current gold: 5 VP / 2 VP.",
    },
    {
        "id": "cattle_on_the_road",
        "slot_name": "Cattle On The Road",
        "description": "2 VP for each cattle on a tile connected to the castle via roads.",
    },
    {
        "id": "ships_beware",
        "slot_name": "Ships Beware",
        "description": "3 VP for each water area with at least 1 ship and 1 adjacent lighthouse.",
    },
    {
        "id": "all_roads_lead_to_home",
        "slot_name": "All Roads Lead To Home",
        "description": "1 VP for each tile connected to the castle via roads.",
    },
    {
        "id": "vertical_greatness",
        "slot_name": "Vertical Greatness",
        "description": "3 VP for each vertical line of at least 3 contiguous landscape tiles.",
    },
    {
        "id": "on_largest_pond",
        "slot_name": "On Largest Pond",
        "description": "2 VP for each tile in your largest completed water area.",
    },
    {
        "id": "mountain_ranges",
        "slot_name": "Mountain Ranges",
        "description": "2 VP for each completed mountain area.",
    },
]
SCORING_TILE_MAP = {tile["id"]: tile for tile in SCORING_TILE_DEFS}

START_TILE_DEF = {
    "id": "start_castle",
    "group": "start",
    "display_name": "Starting Castle",
    "source_tile_id": "start_castle",
    "edges": {edge: "pasture" for edge in EDGE_ORDER},
    "regions": [
        {
            "id": "r0",
            "terrain": "pasture",
            "edges": list(EDGE_ORDER),
        }
    ],
    "road_exits": list(EDGE_ORDER),
    "bridge_exits": [],
    "icons": [
        {
            "id": "castle_0",
            "type": "castle",
            "count": 1,
            "region_id": "r0",
        }
    ],
}

TILE_TEMPLATES = {
    "general": [
        {"edges": "PPPP", "road_exits": []},
        {"edges": "PPPM", "road_exits": ["N"]},
        {"edges": "PPMM", "road_exits": ["N", "E"]},
        {"edges": "PMPM", "road_exits": ["N", "S"]},
        {"edges": "PPWW", "road_exits": ["E", "S"]},
        {"edges": "PWPW", "road_exits": ["N", "E"]},
        {"edges": "PMWW", "road_exits": ["W"]},
        {"edges": "PMMP", "road_exits": ["N", "E", "S"]},
    ],
    "broch": [
        {"edges": "MMMP", "road_exits": ["S"]},
        {"edges": "MMPP", "road_exits": ["E"]},
        {"edges": "MMPW", "road_exits": ["N", "E"]},
        {"edges": "MMPM", "road_exits": ["N", "S"]},
        {"edges": "MMMW", "road_exits": []},
    ],
    "broch_pair": [
        {"edges": "MMMM", "road_exits": []},
        {"edges": "MMMP", "road_exits": ["N", "S"]},
        {"edges": "MMPM", "road_exits": ["E"]},
    ],
    "lighthouse": [
        {"edges": "WPPP", "road_exits": ["S"]},
        {"edges": "WWPP", "road_exits": ["S", "W"]},
        {"edges": "WPWP", "road_exits": ["N", "E"]},
        {"edges": "WPPM", "road_exits": ["E"]},
        {"edges": "WWPM", "road_exits": ["N"]},
    ],
    "ship": [
        {"edges": "WWPP", "road_exits": ["N", "E"]},
        {"edges": "WPWP", "road_exits": ["N", "S"]},
        {"edges": "WWWP", "road_exits": []},
        {"edges": "WWPM", "road_exits": ["E"]},
        {"edges": "WPWM", "road_exits": ["N", "W"]},
        {"edges": "WWMM", "road_exits": ["S"]},
    ],
}

GENERAL_ICON_PROFILES = [
    {"sheep": 1},
    {"cattle": 1},
    {"sheep": 2},
    {"cattle": 1, "whisky": 1},
    {"sheep": 1, "cattle": 1},
    {"farm": 1},
    {"farm": 1, "sheep": 1},
    {"farm": 1, "cattle": 1},
    {"whisky": 1, "sheep": 1},
    {"whisky": 1, "cattle": 1},
    {"scroll": 1},
    {"scroll": 1, "sheep": 1},
    {"scroll": 1, "cattle": 1},
    {"farm": 1, "whisky": 1},
]

SPECIAL_ICON_PROFILES = [
    {},
    {"sheep": 1},
    {"cattle": 1},
    {"whisky": 1},
    {"farm": 1},
    {"scroll": 1},
    {"sheep": 1, "whisky": 1},
    {"cattle": 1, "scroll": 1},
]


def _ordered_player_ids(state: Dict) -> List[str]:
    return sorted(state["player_meta"].keys(), key=lambda player_id: state["player_meta"][player_id].get("seat", 0))


def _player_name(state: Dict, player_id: str) -> str:
    return state["player_meta"][player_id].get("name") or player_id


def _rotate_edge(edge: str, turns: int) -> str:
    index = EDGE_ORDER.index(edge)
    return EDGE_ORDER[(index + turns) % len(EDGE_ORDER)]


def _normalize_rotation(rotation: int) -> int:
    if rotation not in ROTATIONS:
        raise ValueError(f"invalid rotation: {rotation}")
    return rotation


def _pattern_to_edges(pattern: str) -> Dict[str, str]:
    return {edge: TERRAIN_CODE[pattern[index]] for index, edge in enumerate(EDGE_ORDER)}


def _derive_bridge_exits(edges: Dict[str, str], road_exits: List[str]) -> List[str]:
    # In the current draft, roads that terminate on water edges are rendered as bridges.
    return [edge for edge in road_exits if edges.get(edge) == "water"]


def _build_regions_from_edges(edges: Dict[str, str]) -> Tuple[List[Dict], Dict[str, str], DefaultDict[str, List[str]]]:
    terrains = [edges[edge] for edge in EDGE_ORDER]
    if len(set(terrains)) == 1:
        region_id = "r0"
        region = {"id": region_id, "terrain": terrains[0], "edges": list(EDGE_ORDER)}
        return [region], {edge: region_id for edge in EDGE_ORDER}, defaultdict(list, {terrains[0]: [region_id]})

    start_index = 0
    for index in range(len(EDGE_ORDER)):
        if terrains[index] != terrains[index - 1]:
            start_index = index
            break

    regions: List[Dict] = []
    edge_to_region: Dict[str, str] = {}
    terrain_to_regions: DefaultDict[str, List[str]] = defaultdict(list)

    current_terrain = terrains[start_index]
    current_edges = [EDGE_ORDER[start_index]]
    region_index = 0

    for step in range(1, len(EDGE_ORDER)):
        edge_index = (start_index + step) % len(EDGE_ORDER)
        terrain = terrains[edge_index]
        edge = EDGE_ORDER[edge_index]
        if terrain == current_terrain:
            current_edges.append(edge)
            continue
        region_id = f"r{region_index}"
        region = {"id": region_id, "terrain": current_terrain, "edges": list(current_edges)}
        regions.append(region)
        terrain_to_regions[current_terrain].append(region_id)
        for edge_name in current_edges:
            edge_to_region[edge_name] = region_id
        region_index += 1
        current_terrain = terrain
        current_edges = [edge]

    region_id = f"r{region_index}"
    region = {"id": region_id, "terrain": current_terrain, "edges": list(current_edges)}
    regions.append(region)
    terrain_to_regions[current_terrain].append(region_id)
    for edge_name in current_edges:
        edge_to_region[edge_name] = region_id
    return regions, edge_to_region, terrain_to_regions


def _tile_seed(code_parts: List[int]) -> int:
    total = 0
    for index, part in enumerate(code_parts):
        total += (index + 3) * (part + 1)
    return total


def _choose_region_id(tile_def: Dict, terrain: Optional[str], seed: int) -> str:
    if terrain:
        region_ids = tile_def["terrain_to_regions"].get(terrain, [])
        if region_ids:
            return region_ids[seed % len(region_ids)]
    return tile_def["regions"][seed % len(tile_def["regions"])]["id"]


def _add_icon(
    icons: List[Dict],
    *,
    icon_id: str,
    icon_type: str,
    count: int,
    tile_def: Dict,
    seed: int,
    terrain: Optional[str] = None,
    scroll_type: Optional[str] = None,
    adjacent_region_ids: Optional[List[str]] = None,
) -> None:
    if count <= 0:
        return
    icon = {
        "id": icon_id,
        "type": icon_type,
        "count": count,
        "region_id": _choose_region_id(tile_def, terrain, seed),
    }
    if scroll_type:
        icon["scroll_type"] = scroll_type
    if adjacent_region_ids:
        icon["adjacent_region_ids"] = list(adjacent_region_ids)
    icons.append(icon)


def _derive_icon_profile(entry: Dict, tile_def: Dict) -> List[Dict]:
    group = entry["group"]
    seed = _tile_seed(entry["inferred_code_parts"])
    icons: List[Dict] = []

    water_region_ids = list(tile_def["terrain_to_regions"].get("water", []))
    pasture_region_ids = list(tile_def["terrain_to_regions"].get("pasture", []))
    mountain_region_ids = list(tile_def["terrain_to_regions"].get("mountain", []))

    if group == "broch":
        _add_icon(icons, icon_id="broch_0", icon_type="broch", count=1, tile_def=tile_def, seed=seed, terrain="mountain")
        profile = SPECIAL_ICON_PROFILES[seed % len(SPECIAL_ICON_PROFILES)]
    elif group == "broch_pair":
        _add_icon(icons, icon_id="broch_0", icon_type="broch", count=2, tile_def=tile_def, seed=seed, terrain="mountain")
        profile = SPECIAL_ICON_PROFILES[(seed + 2) % len(SPECIAL_ICON_PROFILES)]
    elif group == "lighthouse":
        target_terrain = "pasture" if pasture_region_ids else None
        _add_icon(
            icons,
            icon_id="lighthouse_0",
            icon_type="lighthouse",
            count=1,
            tile_def=tile_def,
            seed=seed,
            terrain=target_terrain,
            adjacent_region_ids=water_region_ids,
        )
        profile = SPECIAL_ICON_PROFILES[(seed + 1) % len(SPECIAL_ICON_PROFILES)]
    elif group == "ship":
        ship_count = 1 + (1 if (seed % 6 == 0) else 0)
        _add_icon(icons, icon_id="ship_0", icon_type="ship", count=ship_count, tile_def=tile_def, seed=seed, terrain="water")
        profile = SPECIAL_ICON_PROFILES[(seed + 3) % len(SPECIAL_ICON_PROFILES)]
    else:
        profile = GENERAL_ICON_PROFILES[seed % len(GENERAL_ICON_PROFILES)]

    if profile.get("farm"):
        _add_icon(icons, icon_id="farm_0", icon_type="farm", count=profile["farm"], tile_def=tile_def, seed=seed + 7, terrain="pasture")
    if profile.get("sheep"):
        _add_icon(icons, icon_id="sheep_0", icon_type="sheep", count=profile["sheep"], tile_def=tile_def, seed=seed + 11, terrain="pasture")
    if profile.get("cattle"):
        _add_icon(icons, icon_id="cattle_0", icon_type="cattle", count=profile["cattle"], tile_def=tile_def, seed=seed + 13, terrain="pasture")
    if profile.get("whisky"):
        terrain = "pasture" if pasture_region_ids else "mountain" if mountain_region_ids else None
        _add_icon(icons, icon_id="whisky_0", icon_type="whisky", count=1, tile_def=tile_def, seed=seed + 17, terrain=terrain)
    if profile.get("scroll"):
        terrain_preferences = ("pasture", "mountain", "water")
        chosen_terrain = None
        for terrain_name in terrain_preferences:
            if tile_def["terrain_to_regions"].get(terrain_name):
                chosen_terrain = terrain_name
                break
        scroll_type = SCROLL_TYPES[seed % len(SCROLL_TYPES)]
        _add_icon(
            icons,
            icon_id="scroll_0",
            icon_type="scroll",
            count=1,
            tile_def=tile_def,
            seed=seed + 19,
            terrain=chosen_terrain,
            scroll_type=scroll_type,
        )
    return icons


def _load_tile_definitions() -> Dict[str, Dict]:
    manifest = json.loads(CURATED_TILE_MANIFEST_PATH.read_text(encoding="utf-8"))
    tile_defs: Dict[str, Dict] = {
        START_TILE_DEF["id"]: START_TILE_DEF,
    }

    for entry in manifest:
        group = entry["group"]
        code_parts = entry["inferred_code_parts"]
        template_pool = TILE_TEMPLATES[group]
        seed = _tile_seed(code_parts)
        template = template_pool[seed % len(template_pool)]
        edges = _pattern_to_edges(template["edges"])
        regions, edge_to_region, terrain_to_regions = _build_regions_from_edges(edges)
        tile_def = {
            "id": entry["tile_id"],
            "group": group,
            "display_name": entry["tile_id"].replace("-", " "),
            "source_tile_id": entry["tile_id"],
            "tile_no": entry["tile_no"],
            "edges": edges,
            "regions": regions,
            "edge_to_region": edge_to_region,
            "terrain_to_regions": dict(terrain_to_regions),
            "road_exits": list(template["road_exits"]),
            "bridge_exits": _derive_bridge_exits(edges, list(template["road_exits"])),
            "icons": [],
        }
        tile_def["icons"] = _derive_icon_profile(entry, tile_def)
        tile_defs[tile_def["id"]] = tile_def
    return tile_defs


TILE_DEFS_BY_ID = _load_tile_definitions()
LANDSCAPE_TILE_IDS = [tile_id for tile_id, tile_def in TILE_DEFS_BY_ID.items() if tile_def["group"] != "start"]


@lru_cache(maxsize=None)
def _rotated_tile(tile_id: str, rotation: int) -> Dict:
    rotation = _normalize_rotation(rotation)
    tile_def = TILE_DEFS_BY_ID[tile_id]
    turns = rotation // 90
    edges = {_rotate_edge(edge, turns): terrain for edge, terrain in tile_def["edges"].items()}
    regions: List[Dict] = []
    edge_to_region: Dict[str, str] = {}
    terrain_to_regions: DefaultDict[str, List[str]] = defaultdict(list)
    for region in tile_def["regions"]:
        rotated_edges = [_rotate_edge(edge, turns) for edge in region["edges"]]
        rotated_region = {
            "id": region["id"],
            "terrain": region["terrain"],
            "edges": rotated_edges,
        }
        regions.append(rotated_region)
        terrain_to_regions[region["terrain"]].append(region["id"])
        for edge in rotated_edges:
            edge_to_region[edge] = region["id"]
    road_exits = [_rotate_edge(edge, turns) for edge in tile_def["road_exits"]]
    bridge_exits = [_rotate_edge(edge, turns) for edge in tile_def.get("bridge_exits", [])]
    icons = [dict(icon) for icon in tile_def["icons"]]
    return {
        "id": tile_def["id"],
        "group": tile_def["group"],
        "display_name": tile_def["display_name"],
        "edges": edges,
        "regions": regions,
        "edge_to_region": edge_to_region,
        "terrain_to_regions": dict(terrain_to_regions),
        "road_exits": road_exits,
        "bridge_exits": bridge_exits,
        "icons": icons,
    }


def _new_player_round_state() -> Dict:
    return {
        "drawn_tile_ids": [],
        "discard_tile_id": None,
        "prices": {},
        "sale_tiles": [],
        "reserved_gold": 0,
        "submitted_pricing": False,
        "bought_tile_id": None,
        "acquired_tile_ids": [],
        "build_queue": [],
        "build_done": False,
    }


def _territory_map(player_state: Dict) -> Dict[Tuple[int, int], Dict]:
    return {(tile["x"], tile["y"]): tile for tile in player_state["territory"]}


def _territory_bounds(territory: Dict[Tuple[int, int], Dict]) -> Tuple[int, int, int, int]:
    xs = [coord[0] for coord in territory]
    ys = [coord[1] for coord in territory]
    return min(xs), max(xs), min(ys), max(ys)


def _available_gold(player_state: Dict) -> int:
    return player_state["gold"] - player_state["round"]["reserved_gold"]


def _build_buy_order(state: Dict) -> List[str]:
    player_ids = _ordered_player_ids(state)
    start_index = state["start_player_index"]
    return [player_ids[(start_index + offset) % len(player_ids)] for offset in range(len(player_ids))]


def _draw_tile(state: Dict) -> str:
    bag = state["bag"]
    if not bag:
        raise ValueError("tile bag is empty")
    return bag.pop()


def _income_breakdown_for_player(state: Dict, player_id: str) -> Dict:
    player_state = state["players"][player_id]
    territory_analysis = _analyze_territory(player_state)
    connected_whisky_tiles = len(territory_analysis["connected_whisky_tiles"])
    round_meta = ROUND_TRACK[state["round"]]
    players_ahead = 0
    if round_meta["catchup_bonus"] > 0:
        my_score = player_state["score"]
        for other_player_id, other_state in state["players"].items():
            if other_player_id == player_id:
                continue
            if other_state["score"] > my_score:
                players_ahead += 1
    catchup_gold = players_ahead * round_meta["catchup_bonus"]
    return {
        "castle_gold": 5,
        "connected_whisky_tiles": connected_whisky_tiles,
        "catchup_gold": catchup_gold,
        "players_ahead": players_ahead,
        "total_gold": 5 + connected_whisky_tiles + catchup_gold,
    }


def _start_round(state: Dict, events: List[Dict]) -> None:
    next_round = state["round"] + 1
    if next_round > ROUND_LIMIT:
        _finalize_game(state, events)
        return

    state["round"] = next_round
    state["phase"] = "price_secret"
    state["buy_order"] = _build_buy_order(state)
    state["buy_index"] = 0
    state["current_turn"] = None
    state["last_income"] = {}

    for player_id in _ordered_player_ids(state):
        player_state = state["players"][player_id]
        player_state["round"] = _new_player_round_state()
        income = _income_breakdown_for_player(state, player_id)
        player_state["gold"] += income["total_gold"]
        state["last_income"][player_id] = income
        player_state["round"]["drawn_tile_ids"] = [_draw_tile(state) for _ in range(3)]

    events.append(
        {
            "type": "isle_of_skye:round_start",
            "payload": {
                "round": state["round"],
                "active_slots": ROUND_TRACK[state["round"]]["active_slots"],
                "start_player_id": state["buy_order"][0],
            },
        }
    )


def _tile_sale_entry(tile_id: str, price: int) -> Dict:
    return {"tile_id": tile_id, "price": int(price), "sold": False}


def _reveal_prices_if_ready(state: Dict, events: List[Dict]) -> None:
    if state["phase"] != "price_secret":
        return
    if any(not player_state["round"]["submitted_pricing"] for player_state in state["players"].values()):
        return

    for player_state in state["players"].values():
        round_state = player_state["round"]
        discard_tile_id = round_state["discard_tile_id"]
        if discard_tile_id:
            state["bag"].append(discard_tile_id)
        sale_tiles = []
        for tile_id, price in round_state["prices"].items():
            sale_tiles.append(_tile_sale_entry(tile_id, price))
        round_state["sale_tiles"] = sale_tiles

    state["phase"] = "buy"
    state["current_turn"] = state["buy_order"][state["buy_index"]]
    events.append(
        {
            "type": "isle_of_skye:pricing_revealed",
            "payload": {"round": state["round"], "current_turn": state["current_turn"]},
        }
    )


def _finish_buy_phase(state: Dict, events: List[Dict]) -> None:
    for player_id, player_state in state["players"].items():
        round_state = player_state["round"]
        for sale_tile in round_state["sale_tiles"]:
            if sale_tile["sold"]:
                continue
            round_state["acquired_tile_ids"].append(sale_tile["tile_id"])
            player_state["gold"] -= sale_tile["price"]
            round_state["reserved_gold"] -= sale_tile["price"]
        round_state["sale_tiles"] = []
        round_state["build_queue"] = list(round_state["acquired_tile_ids"])
        round_state["build_done"] = len(round_state["build_queue"]) == 0

    state["phase"] = "build"
    state["current_turn"] = None
    events.append({"type": "isle_of_skye:build_start", "payload": {"round": state["round"]}})
    _maybe_finish_build_phase(state, events)


def _advance_buy_turn(state: Dict, events: List[Dict]) -> None:
    state["buy_index"] += 1
    if state["buy_index"] >= len(state["buy_order"]):
        _finish_buy_phase(state, events)
        return
    state["current_turn"] = state["buy_order"][state["buy_index"]]


def _placement_error(player_state: Dict, tile_id: str, x: int, y: int, rotation: int) -> Optional[str]:
    if tile_id not in TILE_DEFS_BY_ID:
        return "unknown tile"
    territory = _territory_map(player_state)
    if (x, y) in territory:
        return "occupied"

    rotated_tile = _rotated_tile(tile_id, rotation)
    adjacent = False

    for edge, (dx, dy) in EDGE_DELTAS.items():
        neighbor = territory.get((x + dx, y + dy))
        if not neighbor:
            continue
        adjacent = True
        neighbor_tile = _rotated_tile(neighbor["tile_id"], neighbor["rotation"])
        if rotated_tile["edges"][edge] != neighbor_tile["edges"][OPPOSITE_EDGE[edge]]:
            return "terrain mismatch"

    if not adjacent:
        return "tile must touch your territory"
    return None


def _place_tile(player_state: Dict, tile_id: str, x: int, y: int, rotation: int) -> None:
    player_state["territory"].append(
        {
            "tile_id": tile_id,
            "x": x,
            "y": y,
            "rotation": rotation,
            "order": len(player_state["territory"]),
        }
    )


def _find_legal_placement(player_state: Dict, tile_id: str) -> Optional[Dict]:
    territory = _territory_map(player_state)
    if not territory:
        return None
    min_x, max_x, min_y, max_y = _territory_bounds(territory)
    for rotation in ROTATIONS:
        for y in range(min_y - 1, max_y + 2):
            for x in range(min_x - 1, max_x + 2):
                if _placement_error(player_state, tile_id, x, y, rotation) is None:
                    return {"x": x, "y": y, "rotation": rotation}
    return None


def _line_score(occupied_coords: Set[Tuple[int, int]], axis: str) -> int:
    grouped: DefaultDict[int, List[int]] = defaultdict(list)
    if axis == "vertical":
        for x, y in occupied_coords:
            grouped[x].append(y)
    else:
        for x, y in occupied_coords:
            grouped[y].append(x)

    qualifying = 0
    for values in grouped.values():
        ordered_values = sorted(values)
        run_length = 1
        found = False
        for index in range(1, len(ordered_values)):
            if ordered_values[index] == ordered_values[index - 1] + 1:
                run_length += 1
            else:
                run_length = 1
            if run_length >= 3:
                found = True
                break
        if found:
            qualifying += 1
    return qualifying * 3


def _road_connected_tiles(territory: Dict[Tuple[int, int], Dict]) -> Set[Tuple[int, int]]:
    if (0, 0) not in territory:
        return set()

    connected = {(0, 0)}
    queue = deque([(0, 0)])
    while queue:
        coord = queue.popleft()
        placed_tile = territory[coord]
        rotated_tile = _rotated_tile(placed_tile["tile_id"], placed_tile["rotation"])
        for edge in rotated_tile["road_exits"]:
            dx, dy = EDGE_DELTAS[edge]
            neighbor_coord = (coord[0] + dx, coord[1] + dy)
            if neighbor_coord in connected or neighbor_coord not in territory:
                continue
            neighbor = territory[neighbor_coord]
            neighbor_tile = _rotated_tile(neighbor["tile_id"], neighbor["rotation"])
            if OPPOSITE_EDGE[edge] not in neighbor_tile["road_exits"]:
                continue
            connected.add(neighbor_coord)
            queue.append(neighbor_coord)
    return connected


def _terrain_components(territory: Dict[Tuple[int, int], Dict]) -> Tuple[List[Dict], Dict[Tuple[Tuple[int, int], str], int]]:
    if not territory:
        return [], {}

    region_data: Dict[Tuple[Tuple[int, int], str], Dict] = {}
    adjacency: DefaultDict[Tuple[Tuple[int, int], str], Set[Tuple[Tuple[int, int], str]]] = defaultdict(set)

    rotated_cache: Dict[Tuple[int, int], Dict] = {
        coord: _rotated_tile(placed_tile["tile_id"], placed_tile["rotation"]) for coord, placed_tile in territory.items()
    }

    for coord, rotated_tile in rotated_cache.items():
        for region in rotated_tile["regions"]:
            node = (coord, region["id"])
            region_data[node] = {
                "terrain": region["terrain"],
                "edges": list(region["edges"]),
            }

    for coord, rotated_tile in rotated_cache.items():
        for edge, region_id in rotated_tile["edge_to_region"].items():
            dx, dy = EDGE_DELTAS[edge]
            neighbor_coord = (coord[0] + dx, coord[1] + dy)
            if neighbor_coord not in territory:
                continue
            neighbor_tile = rotated_cache[neighbor_coord]
            if rotated_tile["edges"][edge] != neighbor_tile["edges"][OPPOSITE_EDGE[edge]]:
                continue
            neighbor_region_id = neighbor_tile["edge_to_region"][OPPOSITE_EDGE[edge]]
            node = (coord, region_id)
            other = (neighbor_coord, neighbor_region_id)
            adjacency[node].add(other)
            adjacency[other].add(node)

    components: List[Dict] = []
    region_to_component: Dict[Tuple[Tuple[int, int], str], int] = {}
    visited: Set[Tuple[Tuple[int, int], str]] = set()

    for node, node_data in region_data.items():
        if node in visited:
            continue
        queue = deque([node])
        visited.add(node)
        nodes: List[Tuple[Tuple[int, int], str]] = []
        tiles: Set[Tuple[int, int]] = set()
        completed = True
        terrain = node_data["terrain"]

        while queue:
            current = queue.popleft()
            nodes.append(current)
            coord, region_id = current
            tiles.add(coord)
            region_info = region_data[current]
            for edge in region_info["edges"]:
                dx, dy = EDGE_DELTAS[edge]
                neighbor_coord = (coord[0] + dx, coord[1] + dy)
                if neighbor_coord not in territory:
                    completed = False
            for neighbor in adjacency[current]:
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                queue.append(neighbor)

        component_index = len(components)
        for region_node in nodes:
            region_to_component[region_node] = component_index
        components.append(
            {
                "terrain": terrain,
                "completed": completed,
                "tiles": tiles,
                "regions": nodes,
                "icon_counts": defaultdict(int),
                "adjacent_lighthouses": 0,
            }
        )

    for coord, rotated_tile in rotated_cache.items():
        for icon in rotated_tile["icons"]:
            node = (coord, icon["region_id"])
            component_index = region_to_component.get(node)
            if component_index is not None:
                components[component_index]["icon_counts"][icon["type"]] += icon["count"]
            if icon["type"] == "lighthouse":
                for adjacent_region_id in icon.get("adjacent_region_ids", []):
                    water_component = region_to_component.get((coord, adjacent_region_id))
                    if water_component is None:
                        continue
                    components[water_component]["adjacent_lighthouses"] += icon["count"]

    return components, region_to_component


def _analyze_territory(player_state: Dict) -> Dict:
    territory = _territory_map(player_state)
    occupied_coords = set(territory.keys())
    connected_road_tiles = _road_connected_tiles(territory)
    components, region_to_component = _terrain_components(territory)

    total_icon_counts: DefaultDict[str, int] = defaultdict(int)
    tiles_with_whisky: Set[Tuple[int, int]] = set()
    tiles_with_farm: Set[Tuple[int, int]] = set()
    connected_whisky_tiles: Set[Tuple[int, int]] = set()
    scrolls: List[Dict] = []
    animal_entries: List[Dict] = []

    rotated_cache: Dict[Tuple[int, int], Dict] = {
        coord: _rotated_tile(placed_tile["tile_id"], placed_tile["rotation"]) for coord, placed_tile in territory.items()
    }

    for coord, rotated_tile in rotated_cache.items():
        for icon in rotated_tile["icons"]:
            total_icon_counts[icon["type"]] += icon["count"]
            if icon["type"] == "whisky":
                tiles_with_whisky.add(coord)
                if coord in connected_road_tiles:
                    connected_whisky_tiles.add(coord)
            if icon["type"] == "farm":
                tiles_with_farm.add(coord)
            if icon["type"] in ("sheep", "cattle"):
                animal_entries.append({"coord": coord, "type": icon["type"], "count": icon["count"]})
            if icon["type"] == "scroll":
                component_index = region_to_component.get((coord, icon["region_id"]))
                completed = False
                if component_index is not None:
                    completed = components[component_index]["completed"]
                scrolls.append(
                    {
                        "coord": coord,
                        "scroll_type": icon["scroll_type"],
                        "doubled": completed,
                    }
                )

    adjacent_offsets = (
        (-1, -1),
        (0, -1),
        (1, -1),
        (-1, 0),
        (1, 0),
        (-1, 1),
        (0, 1),
        (1, 1),
    )
    animals_near_farms = 0
    for entry in animal_entries:
        coord = entry["coord"]
        on_or_adjacent = coord in tiles_with_farm
        if not on_or_adjacent:
            for dx, dy in adjacent_offsets:
                if (coord[0] + dx, coord[1] + dy) in tiles_with_farm:
                    on_or_adjacent = True
                    break
        if on_or_adjacent:
            animals_near_farms += entry["count"]

    connected_cattle = 0
    for coord in connected_road_tiles:
        rotated_tile = rotated_cache[coord]
        for icon in rotated_tile["icons"]:
            if icon["type"] == "cattle":
                connected_cattle += icon["count"]

    return {
        "territory": territory,
        "occupied_coords": occupied_coords,
        "connected_road_tiles": connected_road_tiles,
        "components": components,
        "total_icon_counts": total_icon_counts,
        "tiles_with_whisky": tiles_with_whisky,
        "connected_whisky_tiles": connected_whisky_tiles,
        "animals_near_farms": animals_near_farms,
        "connected_cattle": connected_cattle,
        "scrolls": scrolls,
    }


def _majority_points(values: Dict[str, int]) -> Dict[str, int]:
    points = {player_id: 0 for player_id in values}
    qualified = {player_id: value for player_id, value in values.items() if value > 0}
    if not qualified:
        return points

    first_value = max(qualified.values())
    first_place = [player_id for player_id, value in qualified.items() if value == first_value]
    for player_id in first_place:
        points[player_id] = 5

    if len(first_place) > 1:
        return points

    second_candidates = {player_id: value for player_id, value in qualified.items() if value < first_value}
    if not second_candidates:
        return points
    second_value = max(second_candidates.values())
    if second_value <= 0:
        return points
    for player_id, value in second_candidates.items():
        if value == second_value:
            points[player_id] = 2
    return points


def _score_scoring_tile(state: Dict, scoring_tile_id: str, analyses: Dict[str, Dict]) -> Dict[str, Dict]:
    player_ids = _ordered_player_ids(state)
    results = {
        player_id: {"points": 0, "detail": ""}
        for player_id in player_ids
    }

    if scoring_tile_id == "square_plots":
        for player_id in player_ids:
            occupied = analyses[player_id]["occupied_coords"]
            squares = 0
            for x, y in occupied:
                if (x + 1, y) in occupied and (x, y + 1) in occupied and (x + 1, y + 1) in occupied:
                    squares += 1
            results[player_id] = {"points": squares * 2, "detail": f"{squares} square(s)"}
        return results

    if scoring_tile_id == "completionist":
        for player_id in player_ids:
            completed = sum(1 for component in analyses[player_id]["components"] if component["completed"])
            results[player_id] = {"points": completed, "detail": f"{completed} completed area(s)"}
        return results

    if scoring_tile_id == "sheepy_sheep":
        for player_id in player_ids:
            sheep = analyses[player_id]["total_icon_counts"]["sheep"]
            results[player_id] = {"points": sheep, "detail": f"{sheep} sheep"}
        return results

    if scoring_tile_id == "ultra_completionist":
        for player_id in player_ids:
            completed = sum(1 for component in analyses[player_id]["components"] if component["completed"] and len(component["tiles"]) >= 3)
            results[player_id] = {"points": completed * 3, "detail": f"{completed} large completed area(s)"}
        return results

    if scoring_tile_id == "brochs_in_mountains":
        for player_id in player_ids:
            total = 0
            for component in analyses[player_id]["components"]:
                if component["terrain"] != "mountain":
                    continue
                broch_count = component["icon_counts"]["broch"]
                if broch_count <= 0:
                    continue
                if broch_count == 1:
                    total += 1
                elif broch_count == 2:
                    total += 3
                else:
                    total += 6
            results[player_id] = {"points": total, "detail": "mountain broch scoring"}
        return results

    if scoring_tile_id == "buildings_of_three":
        for player_id in player_ids:
            counts = analyses[player_id]["total_icon_counts"]
            complete_sets = min(counts["broch"], counts["farm"], counts["lighthouse"])
            results[player_id] = {"points": complete_sets * 5, "detail": f"{complete_sets} set(s)"}
        return results

    if scoring_tile_id == "barrels_of_whisky":
        values = {player_id: len(analyses[player_id]["tiles_with_whisky"]) for player_id in player_ids}
        majority = _majority_points(values)
        for player_id in player_ids:
            results[player_id] = {"points": majority[player_id], "detail": f"{values[player_id]} whisky tile(s)"}
        return results

    if scoring_tile_id == "clan_armada":
        values = {player_id: analyses[player_id]["total_icon_counts"]["ship"] for player_id in player_ids}
        majority = _majority_points(values)
        for player_id in player_ids:
            results[player_id] = {"points": majority[player_id], "detail": f"{values[player_id]} ship(s)"}
        return results

    if scoring_tile_id == "animals_near_farms":
        for player_id in player_ids:
            count = analyses[player_id]["animals_near_farms"]
            results[player_id] = {"points": count, "detail": f"{count} animal(s) on or near farms"}
        return results

    if scoring_tile_id == "pot_of_gold":
        values = {player_id: state["players"][player_id]["gold"] for player_id in player_ids}
        majority = _majority_points(values)
        for player_id in player_ids:
            results[player_id] = {"points": majority[player_id], "detail": f"{values[player_id]} gold"}
        return results

    if scoring_tile_id == "cattle_on_the_road":
        for player_id in player_ids:
            cattle = analyses[player_id]["connected_cattle"]
            results[player_id] = {"points": cattle * 2, "detail": f"{cattle} connected cattle"}
        return results

    if scoring_tile_id == "ships_beware":
        for player_id in player_ids:
            qualifying = 0
            for component in analyses[player_id]["components"]:
                if component["terrain"] != "water":
                    continue
                if component["icon_counts"]["ship"] > 0 and component["adjacent_lighthouses"] > 0:
                    qualifying += 1
            results[player_id] = {"points": qualifying * 3, "detail": f"{qualifying} qualifying water area(s)"}
        return results

    if scoring_tile_id == "all_roads_lead_to_home":
        for player_id in player_ids:
            connected_tiles = len(analyses[player_id]["connected_road_tiles"])
            results[player_id] = {"points": connected_tiles, "detail": f"{connected_tiles} connected tile(s)"}
        return results

    if scoring_tile_id == "vertical_greatness":
        for player_id in player_ids:
            points = _line_score(analyses[player_id]["occupied_coords"], axis="vertical")
            results[player_id] = {"points": points, "detail": f"{points // 3} vertical line(s)"}
        return results

    if scoring_tile_id == "on_largest_pond":
        for player_id in player_ids:
            largest = 0
            for component in analyses[player_id]["components"]:
                if component["terrain"] == "water" and component["completed"]:
                    largest = max(largest, len(component["tiles"]))
            results[player_id] = {"points": largest * 2, "detail": f"largest completed water area = {largest}"}
        return results

    if scoring_tile_id == "mountain_ranges":
        for player_id in player_ids:
            completed = 0
            for component in analyses[player_id]["components"]:
                if component["terrain"] == "mountain" and component["completed"]:
                    completed += 1
            results[player_id] = {"points": completed * 2, "detail": f"{completed} completed mountain area(s)"}
        return results

    raise ValueError(f"unsupported scoring tile: {scoring_tile_id}")


def _apply_round_scoring(state: Dict, events: List[Dict]) -> None:
    analyses = {player_id: _analyze_territory(player_state) for player_id, player_state in state["players"].items()}
    round_meta = ROUND_TRACK[state["round"]]
    active_slots = round_meta["active_slots"]
    details: Dict[str, List[Dict]] = {player_id: [] for player_id in state["players"]}

    for slot in active_slots:
        scoring_tile_id = state["scoring_slots"][slot]
        tile_def = SCORING_TILE_MAP[scoring_tile_id]
        tile_results = _score_scoring_tile(state, scoring_tile_id, analyses)
        for player_id, result in tile_results.items():
            state["players"][player_id]["score"] += result["points"]
            details[player_id].append(
                {
                    "slot": slot,
                    "tile_id": scoring_tile_id,
                    "name": tile_def["slot_name"],
                    "points": result["points"],
                    "detail": result["detail"],
                }
            )

    state["last_scoring"] = {
        "round": state["round"],
        "active_slots": list(active_slots),
        "details": details,
    }
    events.append(
        {
            "type": "isle_of_skye:round_scoring",
            "payload": {
                "round": state["round"],
                "active_slots": list(active_slots),
                "details": details,
            },
        }
    )


def _finalize_game(state: Dict, events: List[Dict]) -> None:
    final_details: Dict[str, Dict] = {}
    for player_id, player_state in state["players"].items():
        analysis = _analyze_territory(player_state)
        counts = analysis["total_icon_counts"]
        base_scroll_values = {
            "per_2_sheep": counts["sheep"] // 2,
            "per_2_whisky_tiles": len(analysis["tiles_with_whisky"]) // 2,
            "per_2_ships": counts["ship"] // 2,
            "per_cattle": counts["cattle"],
            "per_broch": counts["broch"],
            "per_farm": counts["farm"],
            "per_lighthouse": counts["lighthouse"],
        }
        scroll_breakdown = []
        scroll_points = 0
        for scroll in analysis["scrolls"]:
            points = base_scroll_values.get(scroll["scroll_type"], 0)
            if scroll["doubled"]:
                points *= 2
            scroll_points += points
            scroll_breakdown.append(
                {
                    "scroll_type": scroll["scroll_type"],
                    "doubled": scroll["doubled"],
                    "points": points,
                }
            )
        coin_points = player_state["gold"] // 5
        player_state["score"] += scroll_points + coin_points
        final_details[player_id] = {
            "scroll_points": scroll_points,
            "coin_points": coin_points,
            "gold": player_state["gold"],
            "scrolls": scroll_breakdown,
            "final_score": player_state["score"],
        }

    highest_score = max(player_state["score"] for player_state in state["players"].values())
    tied = [player_id for player_id, player_state in state["players"].items() if player_state["score"] == highest_score]
    if len(tied) == 1:
        winner = tied
    else:
        best_gold = max(state["players"][player_id]["gold"] for player_id in tied)
        winner = [player_id for player_id in tied if state["players"][player_id]["gold"] == best_gold]

    state["phase"] = "ended"
    state["game_over"] = True
    state["current_turn"] = None
    state["winner"] = winner
    state["final_scoring"] = final_details
    events.append(
        {
            "type": "isle_of_skye:game_over",
            "payload": {
                "winner": winner,
                "final_scoring": final_details,
            },
        }
    )


def _maybe_finish_build_phase(state: Dict, events: List[Dict]) -> None:
    if state["phase"] != "build":
        return
    if any(not player_state["round"]["build_done"] for player_state in state["players"].values()):
        return

    _apply_round_scoring(state, events)
    if state["round"] >= ROUND_LIMIT:
        _finalize_game(state, events)
        return

    state["start_player_index"] = (state["start_player_index"] + 1) % len(_ordered_player_ids(state))
    _start_round(state, events)


def _serialize_tile_defs() -> Dict[str, Dict]:
    serializable_defs: Dict[str, Dict] = {}
    for tile_id, tile_def in TILE_DEFS_BY_ID.items():
        serializable_defs[tile_id] = {
            "id": tile_def["id"],
            "group": tile_def["group"],
            "display_name": tile_def["display_name"],
            "edges": dict(tile_def["edges"]),
            "road_exits": list(tile_def["road_exits"]),
            "bridge_exits": list(tile_def.get("bridge_exits", [])),
            "regions": [dict(region) for region in tile_def["regions"]],
            "icons": [dict(icon) for icon in tile_def["icons"]],
        }
    return serializable_defs


SERIALIZED_TILE_DEFS = _serialize_tile_defs()


class IsleOfSkyeGame:
    game_id = "isle_of_skye"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < IsleOfSkyeGame.min_players or len(players) > IsleOfSkyeGame.max_players:
            raise ValueError("Isle of Skye supports 2-4 players in this implementation")

        ordered_players = sorted(players, key=lambda player: player.get("seat", 0))
        player_meta = {player["player_id"]: player for player in ordered_players}
        seed = (config or {}).get("seed")
        rng = random.Random(seed)

        scoring_tile_ids = [tile["id"] for tile in SCORING_TILE_DEFS]
        rng.shuffle(scoring_tile_ids)
        scoring_slots = {
            "A": scoring_tile_ids[0],
            "B": scoring_tile_ids[1],
            "C": scoring_tile_ids[2],
            "D": scoring_tile_ids[3],
        }

        bag = list(LANDSCAPE_TILE_IDS)
        rng.shuffle(bag)

        state_players: Dict[str, Dict] = {}
        for player in ordered_players:
            player_id = player["player_id"]
            state_players[player_id] = {
                "gold": 0,
                "score": 0,
                "territory": [
                    {
                        "tile_id": START_TILE_DEF["id"],
                        "x": 0,
                        "y": 0,
                        "rotation": 0,
                        "order": 0,
                    }
                ],
                "round": _new_player_round_state(),
            }

        state = {
            "config": dict(config or {}),
            "player_meta": player_meta,
            "players": state_players,
            "round": 0,
            "phase": "setup",
            "bag": bag,
            "start_player_index": 0,
            "buy_order": [],
            "buy_index": 0,
            "current_turn": None,
            "scoring_slots": scoring_slots,
            "game_over": False,
            "winner": [],
            "last_income": {},
            "last_scoring": None,
            "final_scoring": None,
        }

        events: List[Dict] = []
        _start_round(state, events)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        player_state = state["players"][player_id]
        phase = state["phase"]
        if phase == "price_secret":
            if player_state["round"]["submitted_pricing"]:
                return []
            return ["submit_prices"]
        if phase == "buy":
            if state.get("current_turn") != player_id:
                return []
            return ["buy_tile", "pass_buy"]
        if phase == "build":
            if player_state["round"]["build_done"]:
                return []
            actions = []
            if player_state["round"]["build_queue"]:
                actions.extend(["place_tile", "return_tile"])
            else:
                actions.append("finish_build")
            return actions
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state["players"]:
            return [], "unknown player"

        player_state = state["players"][player_id]
        phase = state["phase"]
        action_type = action.get("type")
        events: List[Dict] = []

        if phase == "price_secret":
            if action_type != "submit_prices":
                return [], "invalid action"
            if player_state["round"]["submitted_pricing"]:
                return [], "pricing already submitted"

            discard_tile_id = action.get("discard_tile_id")
            priced_tiles = action.get("priced_tiles")
            drawn_tile_ids = list(player_state["round"]["drawn_tile_ids"])
            if discard_tile_id not in drawn_tile_ids:
                return [], "discard must be one of the drawn tiles"
            if not isinstance(priced_tiles, list) or len(priced_tiles) != 2:
                return [], "must price exactly two tiles"

            prices: Dict[str, int] = {}
            seen_tiles: Set[str] = set()
            for priced_tile in priced_tiles:
                tile_id = priced_tile.get("tile_id")
                price = priced_tile.get("price")
                if tile_id == discard_tile_id:
                    return [], "discarded tile cannot be priced"
                if tile_id not in drawn_tile_ids:
                    return [], "priced tile must be drawn this round"
                if tile_id in seen_tiles:
                    return [], "duplicate priced tile"
                if not isinstance(price, int) or price < 1:
                    return [], "prices must be positive integers"
                seen_tiles.add(tile_id)
                prices[tile_id] = price

            if len(seen_tiles) != 2:
                return [], "must price exactly two distinct tiles"
            reserved_gold = sum(prices.values())
            if reserved_gold > player_state["gold"]:
                return [], "not enough gold to reserve those prices"

            player_state["round"]["discard_tile_id"] = discard_tile_id
            player_state["round"]["prices"] = prices
            player_state["round"]["reserved_gold"] = reserved_gold
            player_state["round"]["submitted_pricing"] = True
            events.append({"type": "isle_of_skye:submit_prices", "payload": {"player_id": player_id}})
            _reveal_prices_if_ready(state, events)
            return events, None

        if phase == "buy":
            if state.get("current_turn") != player_id:
                return [], "not your turn"
            if action_type == "pass_buy":
                events.append({"type": "isle_of_skye:pass_buy", "payload": {"player_id": player_id}})
                _advance_buy_turn(state, events)
                return events, None

            if action_type != "buy_tile":
                return [], "invalid action"

            seller_id = action.get("seller_id")
            tile_id = action.get("tile_id")
            if seller_id not in state["players"] or seller_id == player_id:
                return [], "invalid seller"

            seller_state = state["players"][seller_id]
            target_sale_tile = None
            for sale_tile in seller_state["round"]["sale_tiles"]:
                if sale_tile["tile_id"] == tile_id and not sale_tile["sold"]:
                    target_sale_tile = sale_tile
                    break
            if target_sale_tile is None:
                return [], "tile is not for sale"

            price = target_sale_tile["price"]
            if _available_gold(player_state) < price:
                return [], "not enough available gold"

            player_state["gold"] -= price
            seller_state["gold"] += price
            seller_state["round"]["reserved_gold"] -= price
            seller_state["round"]["acquired_tile_ids"] = [
                existing_tile_id for existing_tile_id in seller_state["round"]["acquired_tile_ids"] if existing_tile_id != tile_id
            ]
            target_sale_tile["sold"] = True
            player_state["round"]["bought_tile_id"] = tile_id
            player_state["round"]["acquired_tile_ids"].append(tile_id)

            events.append(
                {
                    "type": "isle_of_skye:buy_tile",
                    "payload": {
                        "buyer_id": player_id,
                        "seller_id": seller_id,
                        "tile_id": tile_id,
                        "price": price,
                    },
                }
            )
            _advance_buy_turn(state, events)
            return events, None

        if phase == "build":
            round_state = player_state["round"]
            if round_state["build_done"]:
                return [], "build phase already complete"

            if action_type == "finish_build":
                if round_state["build_queue"]:
                    return [], "place or return all queued tiles first"
                round_state["build_done"] = True
                events.append({"type": "isle_of_skye:finish_build", "payload": {"player_id": player_id}})
                _maybe_finish_build_phase(state, events)
                return events, None

            tile_id = action.get("tile_id")
            if tile_id not in round_state["build_queue"]:
                return [], "tile is not in your build queue"

            if action_type == "return_tile":
                if _find_legal_placement(player_state, tile_id) is not None:
                    return [], "tile still has a legal placement"
                round_state["build_queue"] = [queued_tile_id for queued_tile_id in round_state["build_queue"] if queued_tile_id != tile_id]
                state["bag"].append(tile_id)
                if not round_state["build_queue"]:
                    round_state["build_done"] = True
                events.append({"type": "isle_of_skye:return_tile", "payload": {"player_id": player_id, "tile_id": tile_id}})
                _maybe_finish_build_phase(state, events)
                return events, None

            if action_type != "place_tile":
                return [], "invalid action"

            x = action.get("x")
            y = action.get("y")
            rotation = action.get("rotation")
            if not isinstance(x, int) or not isinstance(y, int):
                return [], "invalid position"
            if rotation not in ROTATIONS:
                return [], "invalid rotation"

            error = _placement_error(player_state, tile_id, x, y, rotation)
            if error:
                return [], error

            _place_tile(player_state, tile_id, x, y, rotation)
            round_state["build_queue"] = [queued_tile_id for queued_tile_id in round_state["build_queue"] if queued_tile_id != tile_id]
            if not round_state["build_queue"]:
                round_state["build_done"] = True

            events.append(
                {
                    "type": "isle_of_skye:place_tile",
                    "payload": {
                        "player_id": player_id,
                        "tile_id": tile_id,
                        "x": x,
                        "y": y,
                        "rotation": rotation,
                    },
                }
            )
            _maybe_finish_build_phase(state, events)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        phase = state["phase"]
        for player_id in _ordered_player_ids(state):
            player_state = state["players"][player_id]
            round_state = player_state["round"]
            player_view = {
                "player_id": player_id,
                "name": _player_name(state, player_id),
                "seat": state["player_meta"][player_id].get("seat"),
                "is_bot": state["player_meta"][player_id].get("is_bot", False),
                "gold": player_state["gold"],
                "available_gold": _available_gold(player_state),
                "reserved_gold": round_state["reserved_gold"],
                "score": player_state["score"],
                "territory": [dict(tile) for tile in player_state["territory"]],
                "territory_size": len(player_state["territory"]),
                "pricing_submitted": round_state["submitted_pricing"],
                "bought_tile_id": round_state["bought_tile_id"],
                "acquired_tile_ids": list(round_state["acquired_tile_ids"]),
                "build_queue": list(round_state["build_queue"]),
                "build_done": round_state["build_done"],
            }
            if player_id == viewer_id and phase == "price_secret":
                player_view["drawn_tile_ids"] = list(round_state["drawn_tile_ids"])
                player_view["discard_tile_id"] = round_state["discard_tile_id"]
                player_view["prices"] = dict(round_state["prices"])
            else:
                player_view["drawn_tile_ids"] = []
                player_view["discard_tile_id"] = None
                player_view["prices"] = {}

            if phase in ("buy", "build", "ended"):
                player_view["sale_tiles"] = [dict(tile) for tile in round_state["sale_tiles"]]
            else:
                player_view["sale_tiles"] = []
            players_view.append(player_view)

        start_player_id = None
        if state.get("buy_order"):
            start_player_id = state["buy_order"][0]
        return {
            "game_id": IsleOfSkyeGame.game_id,
            "you": viewer_id,
            "phase": phase,
            "round": state["round"],
            "round_limit": ROUND_LIMIT,
            "current_turn": state.get("current_turn"),
            "start_player_id": start_player_id,
            "buy_order": list(state.get("buy_order", [])),
            "buy_index": state.get("buy_index", 0),
            "scoring_slots": {
                slot: dict(SCORING_TILE_MAP[tile_id])
                for slot, tile_id in state["scoring_slots"].items()
            },
            "active_scoring_slots": list(ROUND_TRACK[state["round"]]["active_slots"]) if state["round"] in ROUND_TRACK else [],
            "round_track": ROUND_TRACK,
            "players": players_view,
            "tile_defs": SERIALIZED_TILE_DEFS,
            "bag_count": len(state["bag"]),
            "last_income": dict(state.get("last_income", {})),
            "last_scoring": state.get("last_scoring"),
            "final_scoring": state.get("final_scoring"),
            "legal_actions": IsleOfSkyeGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "implementation_note": "Tile faces are now generated as semantic SVGs from the current Skye draft, but the exact per-tile data still needs validation against the source art.",
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id not in state["players"]:
            return None

        player_state = state["players"][bot_id]
        phase = state["phase"]
        if phase == "price_secret" and not player_state["round"]["submitted_pricing"]:
            drawn_tile_ids = list(player_state["round"]["drawn_tile_ids"])
            if len(drawn_tile_ids) != 3:
                return None
            discard_tile_id = drawn_tile_ids[-1]
            priced_tiles = []
            remaining_gold = player_state["gold"]
            for tile_id in drawn_tile_ids[:-1]:
                price = 1 if remaining_gold > 1 else 1
                remaining_gold -= price
                priced_tiles.append({"tile_id": tile_id, "price": price})
            return {
                "type": "submit_prices",
                "discard_tile_id": discard_tile_id,
                "priced_tiles": priced_tiles,
                "delay_ms": 300,
            }

        if phase == "buy" and state.get("current_turn") == bot_id:
            affordable_options = []
            for seller_id, seller_state in state["players"].items():
                if seller_id == bot_id:
                    continue
                for sale_tile in seller_state["round"]["sale_tiles"]:
                    if sale_tile["sold"]:
                        continue
                    if _available_gold(player_state) < sale_tile["price"]:
                        continue
                    tile_def = TILE_DEFS_BY_ID[sale_tile["tile_id"]]
                    icon_value = sum(icon["count"] for icon in tile_def["icons"])
                    affordable_options.append((icon_value, -sale_tile["price"], seller_id, sale_tile["tile_id"]))
            if not affordable_options:
                return {"type": "pass_buy", "delay_ms": 300}
            affordable_options.sort(reverse=True)
            _, _, seller_id, tile_id = affordable_options[0]
            return {"type": "buy_tile", "seller_id": seller_id, "tile_id": tile_id, "delay_ms": 300}

        if phase == "build" and not player_state["round"]["build_done"]:
            if not player_state["round"]["build_queue"]:
                return {"type": "finish_build", "delay_ms": 200}
            for tile_id in list(player_state["round"]["build_queue"]):
                placement = _find_legal_placement(player_state, tile_id)
                if placement:
                    return {"type": "place_tile", "tile_id": tile_id, **placement, "delay_ms": 250}
            return {"type": "return_tile", "tile_id": player_state["round"]["build_queue"][0], "delay_ms": 200}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
