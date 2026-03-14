import json
import os
from typing import Dict, List

REGULAR_COLORS = ["red", "blue", "yellow", "green", "pink"]
MASTER_COLOR = "purple"
TOKEN_COLORS = REGULAR_COLORS + [MASTER_COLOR]

TIER_KEYS = {
    "LV1": "lv1",
    "LV2": "lv2",
    "LV3": "lv3",
    "Rare": "rare",
    "Legendary": "legendary",
}

TIER_LABELS = {value: key for key, value in TIER_KEYS.items()}


def _map_color(color: str) -> str:
    if color == "black":
        return "green"
    return color


def _load_cards() -> Dict[str, List[Dict]]:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(base_dir, "assets", "pokemon_splendor", "cards.json")
    with open(path, "r", encoding="utf-8") as handle:
        raw_cards = json.load(handle)

    decks: Dict[str, List[Dict]] = {tier: [] for tier in TIER_LABELS}
    for entry in raw_cards:
        tier_raw = entry.get("tier")
        tier_key = TIER_KEYS.get(tier_raw)
        if not tier_key:
            continue

        cost_raw = entry.get("cost") or {}
        cost: Dict[str, int] = {}
        for color, value in cost_raw.items():
            if color == MASTER_COLOR:
                if isinstance(value, int) and value > 0:
                    cost[MASTER_COLOR] = value
                continue
            mapped = _map_color(color)
            if mapped in REGULAR_COLORS and isinstance(value, int) and value > 0:
                cost[mapped] = value

        bonus_raw = entry.get("bonus")
        bonus = _map_color(bonus_raw) if isinstance(bonus_raw, str) else None
        if bonus not in REGULAR_COLORS:
            bonus = None

        evolution = entry.get("evolution") or {}
        targets_raw = evolution.get("target_en")
        if isinstance(targets_raw, list):
            targets = [t for t in targets_raw if isinstance(t, str)]
        elif isinstance(targets_raw, str):
            targets = [targets_raw]
        else:
            targets = []

        requirements_raw = evolution.get("requirements") or {}
        requirements: Dict[str, int] = {}
        for color, value in requirements_raw.items():
            mapped = _map_color(color)
            if mapped in REGULAR_COLORS and isinstance(value, int) and value > 0:
                requirements[mapped] = value

        card = {
            "id": entry.get("id"),
            "name": entry.get("name"),
            "name_en": entry.get("name_en"),
            "tier": tier_key,
            "tier_label": TIER_LABELS.get(tier_key, tier_raw),
            "points": int(entry.get("vp", 0)),
            "bonus": bonus,
            "cost": cost,
            "evolution_targets": targets,
            "evolution_requirements": requirements,
        }
        decks[tier_key].append(card)

    return decks


TIER_DECKS = _load_cards()
