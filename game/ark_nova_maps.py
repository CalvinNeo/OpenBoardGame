"""Immutable definitions for the default map and six official alternate maps."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping


ASSET_DIR = Path(__file__).resolve().parent / "assets" / "ark_nova"
MAP_IDS = ("map0", "map1a", "map2a", "map3a", "map4a", "map5a", "map6a")
MAPS = {map_id: json.loads((ASSET_DIR / f"{map_id}.json").read_text(encoding="utf-8")) for map_id in MAP_IDS}
CELLS = {map_id: {cell["id"]: cell for cell in data["cells"]} for map_id, data in MAPS.items()}
REWARDS = {map_id: {reward["id"]: reward for reward in data["conservation_rewards"]} for map_id, data in MAPS.items()}


def map_definition(player: Mapping[str, Any] | None = None) -> dict:
    return MAPS[(player or {}).get("map", {}).get("id", "map0")]


def map_cells(player: Mapping[str, Any] | None = None) -> dict:
    return CELLS[(player or {}).get("map", {}).get("id", "map0")]


def map_rewards(player: Mapping[str, Any]) -> dict:
    return REWARDS[player.get("map", {}).get("id", "map0")]


def map_ability(player: Mapping[str, Any], kind: str) -> bool:
    ability = map_definition(player).get("ability", {})
    return ability.get("type") == kind and (
        not ability.get("connected_by")
        or any(cell in player["map"]["occupancy"] for cell in ability["connected_by"])
    )


def adjacent_to_feature(player: Mapping[str, Any], cells: list[str], kind: str) -> bool:
    if not map_ability(player, kind):
        return False
    feature_cells = set(map_definition(player)["ability"].get("cells", []))
    return any(feature_cells.intersection(map_cells(player)[cell]["neighbors"]) for cell in cells)


def enclosure_capacity(player: Mapping[str, Any], building: Mapping[str, Any]) -> int:
    size = int(building.get("size", 0))
    if building.get("building_type") == "standard_enclosure" and adjacent_to_feature(player, building.get("cells", []), "outdoor_areas"):
        size += 2
    return size


def map_milestone(player: Mapping[str, Any], name: str) -> int:
    defaults = {"fourth_partner_zoo": 3, "third_university": 2, "last_worker": 0}
    return int(map_definition(player).get("milestones", defaults).get(name, 0))
