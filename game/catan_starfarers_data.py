"""Validated, original data used by the CATAN: Starfarers implementation.

The graph and prose in these assets are purpose-built for OpenBoardGame.  They
model the public mechanisms without embedding scans, card art, or copied card
text from the commercial game.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple


ASSET_DIR = Path(__file__).resolve().parent / "assets" / "catan_starfarers"
RESOURCE_TYPES: Tuple[str, ...] = ("ore", "fuel", "carbon", "food", "goods")
UPGRADE_TYPES: Tuple[str, ...] = ("booster", "cannon", "freight")
CIVILIZATIONS: Tuple[str, ...] = ("diplomats", "merchants", "green_folk", "scientists")
SETUP_MODES: Tuple[str, ...] = ("beginner", "strategic", "explorer", "wild_space")


def _load_json(name: str):
    return json.loads((ASSET_DIR / name).read_text(encoding="utf-8"))


MAP_GRAPH: Dict = _load_json("map_graph.json")
FRIENDSHIP_CARDS: List[Dict] = _load_json("friendship_cards.json")
ENCOUNTERS: List[Dict] = _load_json("encounters.json")

NODE_BY_ID: Dict[str, Dict] = {item["id"]: item for item in MAP_GRAPH["nodes"]}
SECTOR_BY_ID: Dict[str, Dict] = {item["id"]: item for item in MAP_GRAPH["sectors"]}
FRIENDSHIP_BY_ID: Dict[str, Dict] = {item["id"]: item for item in FRIENDSHIP_CARDS}
ENCOUNTER_BY_ID: Dict[str, Dict] = {item["id"]: item for item in ENCOUNTERS}


def _unique_ids(items: List[Dict], label: str) -> None:
    ids = [item.get("id") for item in items]
    if any(not isinstance(item_id, str) or not item_id for item_id in ids):
        raise ValueError(f"{label} contains an invalid id")
    if len(ids) != len(set(ids)):
        raise ValueError(f"{label} contains duplicate ids")


def _validate_map() -> None:
    nodes = MAP_GRAPH.get("nodes")
    edges = MAP_GRAPH.get("edges")
    sectors = MAP_GRAPH.get("sectors")
    if not isinstance(nodes, list) or not isinstance(edges, list) or not isinstance(sectors, list):
        raise ValueError("map graph must contain nodes, edges, and sectors")
    _unique_ids(nodes, "nodes")
    _unique_ids(sectors, "sectors")
    node_ids = {item["id"] for item in nodes}
    for node in nodes:
        if node.get("kind") not in {"home", "space", "sector"}:
            raise ValueError(f"invalid node kind: {node.get('id')}")
        if not (0 <= float(node.get("x", -1)) <= 1 and 0 <= float(node.get("y", -1)) <= 1):
            raise ValueError(f"node outside normalized map: {node.get('id')}")
        if node.get("kind") == "home":
            if node.get("resource") not in RESOURCE_TYPES or not isinstance(node.get("number"), int):
                raise ValueError(f"invalid home production node: {node.get('id')}")
    seen_edges = set()
    for edge in edges:
        if not isinstance(edge, list) or len(edge) != 2:
            raise ValueError("each edge must contain two node ids")
        first, second = edge
        if first == second or first not in node_ids or second not in node_ids:
            raise ValueError(f"invalid map edge: {edge}")
        key = tuple(sorted((first, second)))
        if key in seen_edges:
            raise ValueError(f"duplicate map edge: {edge}")
        seen_edges.add(key)
    sector_nodes = set()
    counts = {"system": 0, "outpost": 0, "empty": 0}
    for sector in sectors:
        node_id = sector.get("node_id")
        kind = sector.get("kind")
        if node_id not in node_ids or NODE_BY_ID[node_id].get("kind") != "sector":
            raise ValueError(f"sector uses an invalid slot: {sector.get('id')}")
        if node_id in sector_nodes:
            raise ValueError(f"multiple sectors use slot: {node_id}")
        sector_nodes.add(node_id)
        if kind not in counts:
            raise ValueError(f"invalid sector kind: {sector.get('id')}")
        counts[kind] += 1
        if kind == "system":
            if sector.get("resource") not in RESOURCE_TYPES:
                raise ValueError(f"invalid system resource: {sector.get('id')}")
            if not isinstance(sector.get("number"), int) or not 2 <= sector["number"] <= 12:
                raise ValueError(f"invalid system number: {sector.get('id')}")
            obstacle = sector.get("obstacle")
            if obstacle is not None:
                if obstacle.get("kind") not in {"pirate", "ice"}:
                    raise ValueError(f"invalid obstacle: {sector.get('id')}")
                if not isinstance(obstacle.get("strength"), int) or obstacle["strength"] <= 0:
                    raise ValueError(f"invalid obstacle strength: {sector.get('id')}")
        if kind == "outpost" and sector.get("civilization") not in CIVILIZATIONS:
            raise ValueError(f"invalid civilization: {sector.get('id')}")
    if counts != {"system": 8, "outpost": 4, "empty": 4}:
        raise ValueError(f"unexpected sector mix: {counts}")


def _validate_friendship_cards() -> None:
    _unique_ids(FRIENDSHIP_CARDS, "friendship cards")
    if len(FRIENDSHIP_CARDS) != 20:
        raise ValueError("friendship deck must contain 20 cards")
    counts = {civilization: 0 for civilization in CIVILIZATIONS}
    for card in FRIENDSHIP_CARDS:
        civilization = card.get("civilization")
        if civilization not in counts:
            raise ValueError(f"invalid friendship civilization: {card.get('id')}")
        counts[civilization] += 1
        if not isinstance(card.get("name"), str) or not isinstance(card.get("description"), str):
            raise ValueError(f"friendship card copy is incomplete: {card.get('id')}")
        effect = card.get("effect")
        if not isinstance(effect, dict) or not effect:
            raise ValueError(f"friendship card effect is missing: {card.get('id')}")
    if set(counts.values()) != {5}:
        raise ValueError(f"each civilization must have five cards: {counts}")


def _validate_encounters() -> None:
    _unique_ids(ENCOUNTERS, "encounters")
    if len(ENCOUNTERS) != 32:
        raise ValueError("encounter deck must contain 32 cards")
    allowed_ops = {
        "spend", "gain_resource", "gain_fame", "speed_bonus",
        "lose_resource", "free_upgrade", "lose_upgrade", "lock_ship",
    }
    for card in ENCOUNTERS:
        if not all(isinstance(card.get(key), str) and card[key] for key in ("title", "prompt")):
            raise ValueError(f"encounter copy is incomplete: {card.get('id')}")
        options = card.get("options")
        if not isinstance(options, list) or len(options) != 2:
            raise ValueError(f"encounter must have two options: {card.get('id')}")
        _unique_ids(options, f"encounter options for {card.get('id')}")
        for option in options:
            if not isinstance(option.get("label"), str) or not isinstance(option.get("result"), str):
                raise ValueError(f"encounter option copy is incomplete: {card.get('id')}")
            effects = option.get("effects")
            if not isinstance(effects, list):
                raise ValueError(f"encounter effects must be a list: {card.get('id')}")
            for effect in effects:
                if effect.get("op") not in allowed_ops:
                    raise ValueError(f"unknown encounter operation: {effect.get('op')}")
                resource = effect.get("resource")
                if resource is not None and resource not in RESOURCE_TYPES:
                    raise ValueError(f"unknown encounter resource: {resource}")
                upgrade = effect.get("upgrade")
                if upgrade is not None and upgrade not in UPGRADE_TYPES:
                    raise ValueError(f"unknown encounter upgrade: {upgrade}")
            requirements = option.get("requires", {})
            for resource in requirements.get("resources", {}):
                if resource not in RESOURCE_TYPES:
                    raise ValueError(f"unknown requirement resource: {resource}")
            for upgrade in requirements.get("upgrade", {}):
                if upgrade not in UPGRADE_TYPES:
                    raise ValueError(f"unknown requirement upgrade: {upgrade}")


def validate_data() -> None:
    _validate_map()
    _validate_friendship_cards()
    _validate_encounters()


validate_data()


__all__ = [
    "CIVILIZATIONS",
    "ENCOUNTERS",
    "ENCOUNTER_BY_ID",
    "FRIENDSHIP_BY_ID",
    "FRIENDSHIP_CARDS",
    "MAP_GRAPH",
    "NODE_BY_ID",
    "RESOURCE_TYPES",
    "SECTOR_BY_ID",
    "SETUP_MODES",
    "UPGRADE_TYPES",
    "validate_data",
]
