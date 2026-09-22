"""Cryptid's public terrain facts and independently described clue predicates."""

from itertools import combinations
from typing import Dict, List


TERRAINS = {
    "forest": {"name": "森林", "icon": "🌲", "color": "#527c62"},
    "desert": {"name": "沙漠", "icon": "🏜️", "color": "#d5b36b"},
    "water": {"name": "水域", "icon": "🌊", "color": "#6598b1"},
    "mountain": {"name": "山地", "icon": "⛰️", "color": "#a4a7ac"},
    "swamp": {"name": "沼泽", "icon": "🌿", "color": "#93819d"},
}
ANIMALS = {"bear": {"name": "熊", "icon": "🐻"}, "cougar": {"name": "美洲狮", "icon": "🐾"}}
STRUCTURES = {"stone": {"name": "立石", "icon": "🗿"}, "shack": {"name": "废弃小屋", "icon": "🏚️"}}
COLORS = {"white": "白色", "green": "绿色", "blue": "蓝色", "black": "黑色"}
TERRAIN_CODES = {"F": "forest", "D": "desert", "W": "water", "M": "mountain", "S": "swamp"}

# Rows of six flat-top hexes; odd zero-based columns are half a hex lower.
# Numerical terrain/territory transcription only; see designs/cryptid_data_sources.md.
TILES = (
    {"rows": ("WWWWFF", "SSWDFF", "SSDDDF"), "cougar": (), "bear": ()},
    {"rows": ("SFFFFF", "SSFDDD", "SMMMMD"), "cougar": ((0, 0), (1, 0), (2, 0)), "bear": ()},
    {"rows": ("SSFFFW", "SSFMWW", "MMMMWW"), "cougar": ((0, 1), (1, 1), (0, 2)), "bear": ()},
    {"rows": ("DDMMMM", "DDMWWW", "DDDFFF"), "cougar": ((5, 1), (5, 2)), "bear": ()},
    {"rows": ("SSSMMM", "SDDWMM", "DDWWWW"), "cougar": (), "bear": ((4, 1), (5, 1), (4, 2), (5, 2))},
    {"rows": ("DDSSSF", "MMSSFF", "MMWWWF"), "cougar": (), "bear": ((0, 0), (0, 1), (1, 1), (0, 2))},
)


def clue_catalog(advanced: bool = False) -> List[Dict]:
    """Return the public catalogue, independent of any particular deal."""
    positive = []
    for pair in combinations(TERRAINS, 2):
        names = "或".join(f"{TERRAINS[t]['name']}({TERRAINS[t]['icon']})" for t in pair)
        positive.append({"id": "terrain_" + "_".join(pair), "kind": "terrain", "values": list(pair),
                         "distance": 0, "description": f"位于{names}"})
    for terrain, spec in TERRAINS.items():
        positive.append({"id": f"near_{terrain}", "kind": "near_terrain", "values": [terrain],
                         "distance": 1, "description": f"距{spec['name']}({spec['icon']})不超过 1 格"})
    positive.append({"id": "near_animal", "kind": "animal", "values": list(ANIMALS), "distance": 1,
                     "description": "距熊(🐻)或美洲狮(🐾)领地不超过 1 格"})
    for kind, spec in STRUCTURES.items():
        positive.append({"id": f"structure_{kind}", "kind": "structure", "values": [kind], "distance": 2,
                         "description": f"距{spec['name']}({spec['icon']})不超过 2 格"})
    for animal, spec in ANIMALS.items():
        positive.append({"id": f"animal_{animal}", "kind": "animal", "values": [animal], "distance": 2,
                         "description": f"距{spec['name']}({spec['icon']})领地不超过 2 格"})
    for color in (list(COLORS) if advanced else list(COLORS)[:3]):
        positive.append({"id": f"color_{color}", "kind": "color", "values": [color], "distance": 3,
                         "description": f"距{COLORS[color]}结构物(🗿／🏚️)不超过 3 格"})
    clues = [{**clue, "negative": False} for clue in positive]
    if advanced:
        clues.extend({**clue, "id": "not_" + clue["id"], "negative": True,
                      "description": f"不满足：{clue['description']}"} for clue in positive)
    return clues


def _action(name: str, fields: Dict = None) -> Dict:
    properties = {"type": {"const": name}, **(fields or {})}
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


CELL_SCHEMA = {"type": "string", "pattern": "^[A-L][1-9]$"}
NOTE_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "text": {"type": "string", "maxLength": 4000},
        "cells": {"type": "object", "maxProperties": 108, "patternProperties": {
            "^[A-L][1-9]$": {"enum": ["candidate", "excluded"]}}, "additionalProperties": False},
        "clues": {"type": "object", "maxProperties": 5, "additionalProperties": {
            "type": "array", "maxItems": 48, "uniqueItems": True,
            "items": {"type": "string", "maxLength": 80}}},
    },
    "required": ["text", "cells", "clues"],
}
ACTION_SCHEMA = {"type": "object", "oneOf": [
    *[_action(name, {"cell_id": CELL_SCHEMA}) for name in (
        "place_initial_cube", "search", "place_extra_disc", "place_compensation_cube")],
    _action("question", {"cell_id": CELL_SCHEMA, "target_player_id": {"type": "string", "minLength": 1}}),
    _action("next_round"), _action("vote_hint", {"agree": {"type": "boolean"}}),
    _action("update_notes", {"notes": NOTE_SCHEMA}),
]}
CONFIG_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {
        "advanced": {"type": "boolean", "default": False},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    },
}
