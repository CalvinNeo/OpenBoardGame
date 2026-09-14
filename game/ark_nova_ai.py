"""Deterministic heuristic bot for Ark Nova.

The game has a large, structured action space: a top-level action is only the
start of a move, and cards can add placements, follow-up choices, attacks, and
extra actions.  The bot therefore uses the rules engine as its legality oracle.
It builds a bounded set of useful actions, applies every candidate to a copy of
the state, and scores the resulting position.  This keeps the AI aligned with
the same validation path used for human players and makes new card effects fail
closed instead of producing malformed actions.
"""

from __future__ import annotations

import copy
import itertools
import json
from collections import Counter
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

import game.ark_nova as rules


ProgressCallback = Callable[[str, float, Optional[str]], None]

MAX_ACTION_CANDIDATES = 720
MAX_PENDING_CANDIDATES = 120
PLACEMENTS_PER_BUILDING = 6


def _notify(
    callback: Optional[ProgressCallback], stage: str, progress: float, detail: Optional[str] = None
) -> None:
    if callback is None:
        return
    try:
        callback(stage, progress, detail)
    except Exception:
        # UI progress is best effort and must never make a legal bot move fail.
        return


def _action_key(action: Mapping[str, Any]) -> str:
    return json.dumps(action, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def _dedupe(actions: Iterable[Mapping[str, Any]], limit: int) -> List[Dict[str, Any]]:
    unique: Dict[str, Dict[str, Any]] = {}
    for raw in actions:
        action = copy.deepcopy(dict(raw))
        unique.setdefault(_action_key(action), action)
        if len(unique) >= limit:
            break
    return list(unique.values())


def _option_value(option: Any) -> Any:
    if not isinstance(option, Mapping):
        return copy.deepcopy(option)
    for key in ("value", "id", "card_id", "action", "size"):
        if key in option:
            return copy.deepcopy(option[key])
    return copy.deepcopy(dict(option))


def _card_icons(card: Mapping[str, Any]) -> Counter:
    return Counter(
        {
            str(icon.get("tag")): int(icon.get("count", 1))
            for icon in card.get("icons", [])
            if icon.get("tag")
        }
    )


def _project_metrics(state: Mapping[str, Any]) -> Counter:
    metrics: Counter = Counter()
    for project_id in state.get("projects", []):
        project = rules.PROJECT_CARDS.get(str(project_id), {})
        metric = project.get("metric")
        if metric:
            metrics[str(metric)] += 1
    return metrics


def _card_value(state: Mapping[str, Any], player_id: str, card_id: str) -> float:
    """Estimate a known card's medium-term value without changing state."""

    player = state["players"][player_id]
    card_id = str(card_id)
    project_metrics = _project_metrics(state)
    if card_id in rules.ANIMAL_CARDS:
        card = rules.ANIMAL_CARDS[card_id]
        rewards = card.get("printed_rewards", {})
        value = (
            float(rewards.get("appeal", 0))
            + 5.0 * float(rewards.get("conservation", 0))
            + 1.8 * float(rewards.get("reputation", 0))
        )
        icons = _card_icons(card)
        value += 0.45 * sum(icons.values())
        value += sum(1.25 * count * project_metrics.get(tag, 0) for tag, count in icons.items())
        if project_metrics.get("any_animal_category"):
            value += 1.2 * sum(tag in rules.ANIMAL_CATEGORIES for tag in icons)
        if project_metrics.get("any_continent"):
            value += 1.0 * sum(tag in rules.CONTINENTS for tag in icons)
        ability_values = {
            "sprint": 2.0,
            "hunter": 2.2,
            "clever": 1.2,
            "inventive": 1.8,
            "full_throated": 3.0,
            "resistance": 2.5,
            "determination": 3.5,
            "action_association": 2.8,
            "action_building": 2.4,
            "action_cards": 1.8,
            "action_sponsors": 2.0,
            "pilfering_1": 1.4,
            "pilfering_2": 2.4,
        }
        value += sum(
            ability_values.get(str(ability.get("ability")), 0.8)
            for ability in card.get("abilities", [])
        )
        value -= 0.10 * rules._animal_cost(player, card)
        unmet = sum(
            not rules._condition_met(player, condition)
            for condition in card.get("play", {}).get("conditions", [])
        )
        value -= 2.5 * unmet
        return value

    if card_id in rules.SPONSOR_CARDS:
        card = rules.SPONSOR_CARDS[card_id]
        rewards = card.get("printed_rewards", {})
        value = (
            2.0
            + float(rewards.get("appeal", 0))
            + 5.0 * float(rewards.get("conservation", 0))
            + 1.8 * float(rewards.get("reputation", 0))
        )
        icons = _card_icons(card)
        value += 0.6 * sum(icons.values())
        value += sum(0.9 * count * project_metrics.get(tag, 0) for tag, count in icons.items())
        value += min(4.5, 0.8 * len(card.get("effects", [])))
        if card.get("unique_building"):
            value += 2.0
        value -= 0.12 * int(card.get("play", {}).get("strength_required", 0))
        value -= 0.08 * int(card.get("play", {}).get("base_money_cost", 0))
        if not rules._card_conditions_met(player, card):
            value -= 3.0
        return value

    if card_id in rules.PROJECT_CARDS:
        project = rules.PROJECT_CARDS[card_id]
        rewards = [int(slot.get("reward", {}).get("conservation", 0)) for slot in project.get("support_slots", [])]
        value = 2.0 + 2.4 * (max(rewards) if rewards else 0)
        if project.get("project_type") == "release":
            value -= 1.0
        return value
    return 0.0


def _final_card_value(state: Mapping[str, Any], player_id: str, card_id: str) -> float:
    try:
        score, _ = rules._score_final_card(copy.deepcopy(dict(state)), player_id, str(card_id))
    except (KeyError, TypeError, ValueError):
        score = 0
    return 3.1 * int(score)


def _animal_can_use_building(
    player: Mapping[str, Any], card: Mapping[str, Any], building: Mapping[str, Any]
) -> bool:
    building_type = str(building.get("building_type", ""))
    option_type = "standard" if building_type == "standard_enclosure" else building_type
    options = [option for option in card.get("enclosure_options", []) if option.get("type") == option_type]
    if not options:
        return False
    required = int(options[0].get("required_spaces", 0))
    if building_type == "standard_enclosure":
        if building.get("occupied_by"):
            return False
        if int(building.get("size", 0)) < required:
            return False
    elif int(building.get("used_capacity", 0)) + required > int(building.get("capacity", 0)):
        return False
    if not rules._has_active_rule(player, "ignore_water_rock_rules"):
        adjacent = card.get("placement", {}).get("adjacent_to", {})
        for terrain in ("water", "rock"):
            if rules._adjacent_terrain(building.get("cells", []), terrain) < int(adjacent.get(terrain, 0)):
                return False
    return True


def _action_demand(state: Mapping[str, Any], player_id: str) -> Dict[str, float]:
    player = state["players"][player_id]
    hand = list(player.get("hand", []))
    buildings = list(player.get("map", {}).get("buildings", []))
    playable_animals = 0
    for card_id in hand:
        card = rules.ANIMAL_CARDS.get(str(card_id))
        if not card or not rules._card_conditions_met(player, card):
            continue
        if rules._animal_cost(player, card) > int(player.get("money", 0)):
            continue
        if any(_animal_can_use_building(player, card, building) for building in buildings):
            playable_animals += 1
    sponsors = sum(
        str(card_id) in rules.SPONSOR_CARDS
        and rules._card_conditions_met(player, rules.SPONSOR_CARDS[str(card_id)])
        for card_id in hand
    )
    projects = sum(
        not any(
            item.get("project_id", item.get("card_id")) == str(project_id)
            for item in player.get("supported_projects", [])
        )
        for project_id in state.get("projects", [])
    )
    return {
        "cards": 0.7 + 0.35 * max(0, 4 - len(hand)),
        "build": 0.8 + 0.45 * sum(str(card_id) in rules.ANIMAL_CARDS for card_id in hand),
        "animals": 0.8 + min(2.0, 0.8 * playable_animals),
        "association": 0.9 + 0.25 * projects + 0.3 * int(player.get("available_workers", 0) > 0),
        "sponsors": 0.7 + min(1.5, 0.5 * sponsors),
    }


def _project_progress_value(state: Mapping[str, Any], player_id: str) -> float:
    player = state["players"][player_id]
    supported = {
        str(item.get("project_id", item.get("card_id", "")))
        for item in player.get("supported_projects", [])
    }
    value = 0.0
    for project_id in state.get("projects", []):
        project_id = str(project_id)
        if project_id in supported:
            continue
        project = rules.PROJECT_CARDS.get(project_id, {})
        if project.get("project_type") not in {"base", "standard"}:
            continue
        metric = str(project.get("metric", ""))
        current = rules._metric_count(player, metric)
        targets = sorted(
            (
                int(slot.get("requirement", {}).get("value", 0)),
                int(slot.get("reward", {}).get("conservation", 0)),
            )
            for slot in project.get("support_slots", [])
            if slot.get("requirement", {}).get("kind") == "metric_count"
            and not rules._project_slot_blocked(state, project_id, int(slot.get("position", 0)))
            and int(slot.get("position", 0)) not in rules._occupied_project_positions(state, project_id)
        )
        if not targets:
            continue
        attainable = [(target, reward) for target, reward in targets if current < target]
        if not attainable:
            value += 2.0
            continue
        target, reward = min(attainable, key=lambda item: item[0] - current)
        value += max(0.0, 1.2 * reward - 0.75 * (target - current))
    return value


def _player_value(state: Mapping[str, Any], player_id: str) -> float:
    player = state["players"][player_id]
    appeal = int(player.get("appeal", 0))
    conservation = int(player.get("conservation", 0))
    money = int(player.get("money", 0))
    value = appeal + 5.0 * conservation + 1.55 * int(player.get("reputation", 0))
    value += 0.18 * min(money, 35) + 0.06 * max(0, money - 35)
    value -= 0.75 * max(0, 5 - money)
    value += 1.45 * int(player.get("x_tokens", 0))
    value += 2.8 * int(player.get("association_workers_total", 1))
    value += 0.45 * int(player.get("available_workers", 0))
    value += 2.0 * len(player.get("partner_zoos", []))
    value += 2.5 * len(player.get("universities", []))
    value += 6.0 * sum(bool(card.get("upgraded")) for card in player.get("action_cards", {}).values())
    value += 1.4 * len(player.get("supported_projects", []))
    value += 0.35 * len(player.get("active_effects", {}))

    tags = player.get("tags", {})
    value += 0.45 * sum(min(5, int(tags.get(tag, 0))) for tag in rules.ANIMAL_CATEGORIES)
    value += 0.35 * sum(min(5, int(tags.get(tag, 0))) for tag in rules.CONTINENTS)
    value += _project_progress_value(state, player_id)

    hand_values = sorted(
        (_card_value(state, player_id, str(card_id)) for card_id in player.get("hand", [])),
        reverse=True,
    )
    value += 0.16 * sum(hand_values[:6]) + 0.05 * sum(hand_values[6:])
    if state.get("break_position", 0) >= max(0, int(state.get("break_limit", 0)) - 3):
        value -= 0.7 * max(0, len(player.get("hand", [])) - int(player.get("hand_limit", 3)))

    buildings = list(player.get("map", {}).get("buildings", []))
    hand_animals = [
        rules.ANIMAL_CARDS[str(card_id)]
        for card_id in player.get("hand", [])
        if str(card_id) in rules.ANIMAL_CARDS
    ]
    for building in buildings:
        kind = building.get("building_type")
        if kind in {"standard_enclosure", *rules.SPECIAL_ENCLOSURES}:
            remaining = int(building.get("capacity", 0)) - int(building.get("used_capacity", 0))
            if kind == "standard_enclosure" and building.get("occupied_by"):
                remaining = 0
            value += 0.28 * max(0, remaining)
            matching = [card for card in hand_animals if _animal_can_use_building(player, card, building)]
            if matching:
                value += 1.5 + 0.12 * max(
                    _card_value(state, player_id, str(card["id"])) for card in matching
                )
        elif kind == "kiosk":
            value += 1.2
        elif kind == "pavilion":
            value += 0.8
        else:
            value += 0.18 * int(building.get("size", 1))

    demand = _action_demand(state, player_id)
    for action_id, entry in player.get("action_cards", {}).items():
        value += 0.28 * demand.get(action_id, 0.5) * (int(entry.get("slot", 1)) - 1)
        value += 0.8 * int(entry.get("multiplier_tokens", 0))

    value += sum(_final_card_value(state, player_id, str(card_id)) for card_id in player.get("final_cards", []))
    if appeal >= rules._target_appeal(conservation):
        value += 1500.0
    return value


def _state_value(state: Mapping[str, Any], player_id: str) -> float:
    if state.get("game_over"):
        winners = set(state.get("winner", []))
        return 100000.0 if player_id in winners else -100000.0
    own = _player_value(state, player_id)
    # Rival valuation only uses information visible at the table.  In
    # particular, never let private hands or Final Scoring cards influence a
    # bot's move just because the authoritative server state contains them.
    opponents = []
    for other_id in state.get("turn_order", []):
        if other_id == player_id or other_id not in state.get("players", {}):
            continue
        opponent = state["players"][other_id]
        opponents.append(
            int(opponent.get("appeal", 0))
            + 5.0 * int(opponent.get("conservation", 0))
            + 1.55 * int(opponent.get("reputation", 0))
            + 0.08 * int(opponent.get("money", 0))
            + 1.4 * len(opponent.get("supported_projects", []))
        )
    return own - (0.12 * max(opponents) if opponents else 0.0)


def _placement_bonus_score(state: Mapping[str, Any], player_id: str, cells: Sequence[str]) -> float:
    player = state["players"][player_id]
    claimed = set(player.get("map", {}).get("claimed_bonuses", []))
    weights = {"money": 0.22, "x_token": 1.6, "appeal": 1.0, "card": 1.8, "action_to_slot": 1.2}
    score = 0.0
    for cell_id in cells:
        if cell_id in claimed:
            continue
        bonus = rules.MAP_CELLS.get(cell_id, {}).get("placement_bonus", {})
        score += weights.get(str(bonus.get("type")), 0.0) * int(bonus.get("amount", 1))
    hand_animals = [
        rules.ANIMAL_CARDS[str(card_id)]
        for card_id in player.get("hand", [])
        if str(card_id) in rules.ANIMAL_CARDS
    ]
    for card in hand_animals:
        adjacent = card.get("placement", {}).get("adjacent_to", {})
        score += 0.35 * min(
            rules._adjacent_terrain(cells, "water"), int(adjacent.get("water", 0))
        )
        score += 0.35 * min(
            rules._adjacent_terrain(cells, "rock"), int(adjacent.get("rock", 0))
        )
    return score


def _normalize_building(building_type: str, size: int) -> Tuple[str, int]:
    if building_type.startswith("standard_enclosure_"):
        suffix = building_type.rsplit("_", 1)[-1]
        if suffix.isdigit():
            return "standard_enclosure", int(suffix)
    return building_type, size


def _all_placements(
    state: Mapping[str, Any],
    player_id: str,
    building_type: str,
    size: int,
    unique: Optional[Mapping[str, Any]] = None,
    *,
    limit: int = PLACEMENTS_PER_BUILDING,
) -> List[List[str]]:
    building_type, size = _normalize_building(str(building_type), int(size))
    if unique:
        footprint = {
            (int(cell["q"]), int(cell["r"]))
            for cell in unique.get("footprint", {}).get("cells", [])
        }
    else:
        footprint_key = (
            f"standard_enclosure_{size}" if building_type == "standard_enclosure" else building_type
        )
        footprint = set(rules.BUILDING_FOOTPRINTS.get(footprint_key, {(0, 0)} if size == 1 else set()))
    if not footprint:
        return []
    axial_to_id = {
        (int(cell["axial"]["q"]), int(cell["axial"]["r"])): cell_id
        for cell_id, cell in rules.MAP_CELLS.items()
    }
    found: Dict[Tuple[str, ...], List[str]] = {}
    for steps in range(6):
        rotated = rules._rotate_shape(footprint, steps)
        for anchor in axial_to_id:
            for base_anchor in rotated:
                dq = anchor[0] - base_anchor[0]
                dr = anchor[1] - base_anchor[1]
                coords = {(q + dq, r + dr) for q, r in rotated}
                if not coords.issubset(axial_to_id):
                    continue
                cells = sorted(axial_to_id[coord] for coord in coords)
                key = tuple(cells)
                if key in found:
                    continue
                spec = {"building_type": building_type, "size": size, "cells": cells}
                if rules._validate_building_placement(
                    state, player_id, spec, free=True, unique=unique
                ) is None:
                    found[key] = cells
    ranked = sorted(
        found.values(),
        key=lambda cells: (-_placement_bonus_score(state, player_id, cells), tuple(cells)),
    )
    return ranked[: max(1, int(limit))]


def _available_x(state: Mapping[str, Any], player_id: str, action_id: str) -> int:
    forced = state.get("forced_action")
    if (
        isinstance(forced, Mapping)
        and forced.get("player_id") == player_id
        and forced.get("action") == action_id
        and not forced.get("allow_x_alternative", False)
    ):
        return 0
    return int(state["players"][player_id].get("x_tokens", 0))


def _x_for_strength(
    state: Mapping[str, Any], player_id: str, action_id: str, required_strength: int
) -> Optional[int]:
    base = rules._action_strength(state, player_id, action_id, 0)
    needed = max(0, int(required_strength) - base)
    return needed if needed <= _available_x(state, player_id, action_id) else None


def _cards_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    candidates: List[Dict[str, Any]] = []
    for x_tokens in range(_available_x(state, player_id, "cards") + 1):
        strength = rules._action_strength(state, player_id, "cards", x_tokens)
        if strength < 1:
            continue
        table_strength = min(5, strength)
        level = rules._action_level(player, "cards")
        side = rules.ACTION_DEFS["cards"]["sides"]["II" if level == 2 else "I"]
        draw_count = int(side["draw_discard_by_strength"][str(table_strength)]["draw"])
        base: Dict[str, Any] = {"type": "cards", "mode": "draw"}
        if x_tokens:
            base["x_tokens"] = x_tokens
        candidates.append(base)
        if level == 2:
            accessible = [
                str(card_id)
                for index, card_id in enumerate(state.get("display", []))
                if card_id and index < rules._display_range(player)
            ]
            for count in range(1, min(draw_count, len(accessible)) + 1):
                for chosen in itertools.combinations(accessible, count):
                    candidates.append({**base, "market_card_ids": list(chosen)})
        if table_strength in side.get("snap_at_strength", []):
            for card_id in state.get("display", []):
                if card_id:
                    snap = {"type": "cards", "mode": "snap", "display_card_id": str(card_id)}
                    if x_tokens:
                        snap["x_tokens"] = x_tokens
                    candidates.append(snap)
    return candidates


def _build_specs(state: Mapping[str, Any], player_id: str) -> List[Tuple[int, Dict[str, Any]]]:
    player = state["players"][player_id]
    level = rules._action_level(player, "build")
    allowed = rules.ACTION_DEFS["build"]["sides"]["II" if level == 2 else "I"]["allowed"]
    specs: List[Tuple[int, Dict[str, Any]]] = []
    for building_type in allowed:
        sizes = range(1, 6) if building_type == "standard_enclosure" else [rules.BUILDING_SIZES[building_type]]
        for size in sizes:
            if int(player.get("money", 0)) < 2 * size:
                continue
            for cells in _all_placements(state, player_id, building_type, size):
                specs.append((size, {"building_type": building_type, "size": size, "cells": cells}))
    return specs


def _build_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    specs = _build_specs(state, player_id)
    candidates: List[Dict[str, Any]] = []
    for size, spec in specs:
        x_tokens = _x_for_strength(state, player_id, "build", size)
        if x_tokens is None:
            continue
        action: Dict[str, Any] = {"type": "build", "buildings": [spec]}
        if x_tokens:
            action["x_tokens"] = x_tokens
        candidates.append(action)

    if rules._action_level(player, "build") == 2:
        # Multi-build is strategically important, but a compact top slice is
        # enough; the rules engine filters overlaps and second-placement issues.
        top_specs = sorted(
            specs,
            key=lambda item: (
                -_placement_bonus_score(state, player_id, item[1]["cells"]),
                item[0],
                _action_key(item[1]),
            ),
        )[:18]
        for (size_a, spec_a), (size_b, spec_b) in itertools.combinations(top_specs, 2):
            if spec_a["building_type"] == spec_b["building_type"]:
                continue
            if set(spec_a["cells"]).intersection(spec_b["cells"]):
                continue
            total_size = size_a + size_b
            if int(player.get("money", 0)) < 2 * total_size:
                continue
            x_tokens = _x_for_strength(state, player_id, "build", total_size)
            if x_tokens is None:
                continue
            action = {"type": "build", "buildings": [spec_a, spec_b]}
            if x_tokens:
                action["x_tokens"] = x_tokens
            candidates.append(action)
    return candidates


def _animal_entries(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    entries = [
        {"card_id": str(card_id), "source": "hand", "card": rules.ANIMAL_CARDS[str(card_id)]}
        for card_id in player.get("hand", [])
        if str(card_id) in rules.ANIMAL_CARDS
    ]
    if rules._action_level(player, "animals") == 2:
        entries.extend(
            {
                "card_id": str(card_id),
                "source": "display",
                "card": rules.ANIMAL_CARDS[str(card_id)],
                "surcharge": index + 1,
            }
            for index, card_id in enumerate(state.get("display", []))
            if card_id
            and index < rules._display_range(player)
            and str(card_id) in rules.ANIMAL_CARDS
        )
    entries.sort(
        key=lambda entry: (
            -_card_value(state, player_id, entry["card_id"]),
            entry["source"] != "hand",
            entry["card_id"],
        )
    )
    return entries[:12]


def _animal_plays(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    buildings = list(player.get("map", {}).get("buildings", []))
    plays: List[Dict[str, Any]] = []
    for entry in _animal_entries(state, player_id):
        card = entry["card"]
        if not rules._card_conditions_met(player, card):
            continue
        total_cost = rules._animal_cost(player, card) + int(entry.get("surcharge", 0))
        if total_cost > int(player.get("money", 0)):
            continue
        for building in buildings:
            _, _, error = rules._enclosure_for_animal(player, card, str(building.get("id", "")))
            if error is None:
                plays.append(
                    {
                        "card_id": entry["card_id"],
                        "source": entry["source"],
                        "enclosure_id": str(building["id"]),
                        "_cost": total_cost,
                        "_value": _card_value(state, player_id, entry["card_id"]),
                    }
                )
    plays.sort(key=lambda play: (-float(play["_value"]), int(play["_cost"]), _action_key(play)))
    return plays[:20]


def _minimum_animal_x(
    state: Mapping[str, Any], player_id: str, count: int, *, require_strength_five: bool = False
) -> Optional[int]:
    player = state["players"][player_id]
    level = rules._action_level(player, "animals")
    side = rules.ACTION_DEFS["animals"]["sides"]["II" if level == 2 else "I"]
    for x_tokens in range(_available_x(state, player_id, "animals") + 1):
        strength = rules._action_strength(state, player_id, "animals", x_tokens)
        if strength < 1 or (require_strength_five and strength < 5):
            continue
        maximum = int(side["maximum_cards_by_strength"][str(min(5, strength))])
        if maximum >= count:
            return x_tokens
    return None


def _clean_play(play: Mapping[str, Any]) -> Dict[str, Any]:
    return {key: copy.deepcopy(value) for key, value in play.items() if not key.startswith("_")}


def _animals_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    plays = _animal_plays(state, player_id)
    candidates: List[Dict[str, Any]] = []
    single_x = _minimum_animal_x(state, player_id, 1)
    if single_x is not None:
        for play in plays:
            action: Dict[str, Any] = {"type": "animals", "plays": [_clean_play(play)]}
            if single_x:
                action["x_tokens"] = single_x
            candidates.append(action)

    pair_x = _minimum_animal_x(state, player_id, 2)
    if pair_x is not None:
        top = plays[:12]
        for first, second in itertools.permutations(top, 2):
            if first["card_id"] == second["card_id"]:
                continue
            if int(first["_cost"]) + int(second["_cost"]) > int(state["players"][player_id].get("money", 0)):
                continue
            action = {"type": "animals", "plays": [_clean_play(first), _clean_play(second)]}
            if pair_x:
                action["x_tokens"] = pair_x
            candidates.append(action)

    if rules._action_level(state["players"][player_id], "animals") == 2:
        strength_five_x = _minimum_animal_x(state, player_id, 1, require_strength_five=True)
        if strength_five_x is not None and strength_five_x != single_x:
            for play in plays[:6]:
                action = {"type": "animals", "plays": [_clean_play(play)]}
                if strength_five_x:
                    action["x_tokens"] = strength_five_x
                candidates.append(action)
    return candidates


def _project_tasks(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    project_ids = [str(value) for value in state.get("projects", [])]
    if rules._action_level(player, "association") == 2:
        project_ids.extend(
            str(card_id)
            for card_id in player.get("hand", [])
            if str(card_id) in rules.PROJECT_CARDS
        )
        project_ids.extend(
            str(card_id)
            for index, card_id in enumerate(state.get("display", []))
            if card_id
            and index < rules._display_range(player)
            and str(card_id) in rules.PROJECT_CARDS
        )
    tasks: List[Dict[str, Any]] = []
    wild_cards = [
        str(effect.get("card_id"))
        for effect in rules._active_rules(player, "base_project_wild_icon")
        if int(player.get("card_tokens", {}).get(str(effect.get("card_id")), 0)) > 0
    ]
    for project_id in dict.fromkeys(project_ids):
        project = rules.PROJECT_CARDS.get(project_id)
        if not project:
            continue
        already_supported = any(
            item.get("project_id", item.get("card_id")) == project_id
            for item in player.get("supported_projects", [])
        )
        if already_supported and not (
            project.get("project_type") == "release"
            and rules._has_active_rule(player, "release_project_bonus")
        ):
            continue
        occupied = rules._occupied_project_positions(state, project_id)
        release_ids: Sequence[Optional[str]] = [None]
        if project.get("project_type") == "release":
            release_ids = [str(record.get("card_id")) for record in player.get("animal_records", [])]
        for slot in project.get("support_slots", []):
            position = int(slot.get("position", 0))
            if position in occupied or rules._project_slot_blocked(state, project_id, position):
                continue
            for animal_id in release_ids:
                if rules._project_requirement_met(state, player_id, project, slot, animal_id):
                    task: Dict[str, Any] = {
                        "task": "support_project",
                        "project_id": project_id,
                        "slot": position,
                        "_value": 5.0 * int(slot.get("reward", {}).get("conservation", 0)),
                    }
                    if animal_id:
                        task["release_animal_id"] = animal_id
                        task["_value"] -= float(
                            rules.ANIMAL_CARDS.get(animal_id, {}).get("printed_rewards", {}).get("appeal", 0)
                        )
                    tasks.append(task)
                if project.get("project_type") == "base":
                    for wild_card_id in wild_cards:
                        if rules._project_requirement_met(
                            state, player_id, project, slot, animal_id, wild_icons=1
                        ):
                            task = {
                                "task": "support_project",
                                "project_id": project_id,
                                "slot": position,
                                "wild_token_card_id": wild_card_id,
                                "_value": 5.0 * int(slot.get("reward", {}).get("conservation", 0)) - 1.0,
                            }
                            tasks.append(task)
    tasks.sort(key=lambda task: (-float(task.get("_value", 0)), _action_key(task)))
    return tasks[:14]


def _association_task_options(state: Mapping[str, Any], player_id: str) -> Dict[str, List[Dict[str, Any]]]:
    player = state["players"][player_id]
    options: Dict[str, List[Dict[str, Any]]] = {
        "reputation": [{"task": "reputation", "_strength": 2, "_value": 3.1}],
        "partner_zoo": [],
        "university": [],
        "support_project": [],
    }
    partner_limit = 4 if rules._action_level(player, "association") == 2 else 2
    if len(player.get("partner_zoos", [])) < partner_limit:
        wanted = Counter()
        for card_id in player.get("hand", []):
            card = rules.ANIMAL_CARDS.get(str(card_id), {})
            icons = _card_icons(card)
            cost = int(card.get("play", {}).get("base_money_cost", 0))
            for continent in rules.CONTINENTS:
                wanted[continent] += int(icons.get(continent, 0)) * max(1, cost // 8)
        options["partner_zoo"] = [
            {
                "task": "partner_zoo",
                "continent": continent,
                "_strength": 3,
                "_value": 3.0 + 0.5 * wanted[continent],
            }
            for continent in rules.CONTINENTS
            if continent not in player.get("partner_zoos", [])
        ]
    if len(player.get("universities", [])) < 3:
        claims = Counter(
            university_id
            for other in state.get("players", {}).values()
            for university_id in other.get("universities", [])
        )
        university_values = {
            "university_science": 4.2,
            "university_reputation": 4.5,
            "university_hand_limit": 3.8,
        }
        options["university"] = [
            {
                "task": "university",
                "university_id": university["id"],
                "_strength": 4,
                "_value": university_values.get(university["id"], 3.5),
            }
            for university in rules.UNIVERSITIES
            if university["id"] not in player.get("universities", [])
            and claims[university["id"]] < rules.UNIVERSITY_COPIES_PER_TYPE
        ]
    project_strength = 5
    for effect in rules._active_rules(player, "project_task_strength"):
        project_strength = min(project_strength, int(effect.get("value", 5)))
    options["support_project"] = [
        {**task, "_strength": project_strength} for task in _project_tasks(state, player_id)
    ]
    for values in options.values():
        values.sort(key=lambda item: (-float(item.get("_value", 0)), _action_key(item)))
    return options


def _clean_task(task: Mapping[str, Any]) -> Dict[str, Any]:
    return {key: copy.deepcopy(value) for key, value in task.items() if not key.startswith("_")}


def _association_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    task_options = _association_task_options(state, player_id)
    task_names = [name for name, values in task_options.items() if values]
    level = rules._action_level(player, "association")
    available_workers = int(player.get("available_workers", 0))
    candidates: List[Dict[str, Any]] = []
    maximum_types = 1 if level == 1 else min(4, len(task_names))
    for count in range(1, maximum_types + 1):
        for names in itertools.combinations(task_names, count):
            pools = [task_options[name][:6] for name in names]
            for selected in itertools.product(*pools):
                worker_cost = sum(rules._association_worker_cost(player, name) for name in names)
                if worker_cost > available_workers:
                    continue
                strength = sum(int(task["_strength"]) for task in selected)
                x_tokens = _x_for_strength(state, player_id, "association", strength)
                if x_tokens is None:
                    continue
                action: Dict[str, Any] = {
                    "type": "association",
                    "tasks": [_clean_task(task) for task in selected],
                }
                if x_tokens:
                    action["x_tokens"] = x_tokens
                candidates.append(action)

                if level == 2:
                    slots = [
                        slot
                        for slot in state.get("association_supply", {}).get("donation_slots", [])
                        if not slot.get("blocked") and slot.get("occupied_by") is None
                    ]
                    donation_cost = min((int(slot["cost"]) for slot in slots), default=12)
                    if int(player.get("money", 0)) >= donation_cost:
                        candidates.append({**action, "donate": True})
    candidates.sort(
        key=lambda action: (
            -sum(
                float(next(
                    (
                        item.get("_value", 0)
                        for item in task_options.get(str(task.get("task")), [])
                        if _clean_task(item) == task
                    ),
                    0,
                ))
                for task in action["tasks"]
            ),
            _action_key(action),
        )
    )
    return candidates[:210]


def _sponsor_entries(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    entries = [
        {"card_id": str(card_id), "source": "hand", "card": rules.SPONSOR_CARDS[str(card_id)], "surcharge": 0}
        for card_id in player.get("hand", [])
        if str(card_id) in rules.SPONSOR_CARDS
    ]
    if rules._action_level(player, "sponsors") == 2:
        entries.extend(
            {
                "card_id": str(card_id),
                "source": "display",
                "card": rules.SPONSOR_CARDS[str(card_id)],
                "surcharge": index + 1,
            }
            for index, card_id in enumerate(state.get("display", []))
            if card_id
            and index < rules._display_range(player)
            and str(card_id) in rules.SPONSOR_CARDS
        )
    usable = []
    for entry in entries:
        card = entry["card"]
        if not rules._card_conditions_met(player, card):
            continue
        total_cost = int(card.get("play", {}).get("base_money_cost", 0)) + int(entry["surcharge"])
        if total_cost > int(player.get("money", 0)):
            continue
        unique = card.get("unique_building")
        placements = []
        if unique:
            placements = _all_placements(
                state,
                player_id,
                str(unique["id"]),
                int(unique.get("footprint", {}).get("cell_count", 1)),
                unique,
                limit=2,
            )
            if not placements:
                continue
        usable.append({**entry, "cost": total_cost, "placements": placements})
    usable.sort(key=lambda entry: (-_card_value(state, player_id, entry["card_id"]), entry["card_id"]))
    return usable[:10]


def _sponsors_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    level = rules._action_level(player, "sponsors")
    entries = _sponsor_entries(state, player_id)
    candidates: List[Dict[str, Any]] = []
    maximum_cards = 1 if level == 1 else min(3, len(entries))
    for count in range(1, maximum_cards + 1):
        for selected in itertools.combinations(entries, count):
            total_strength = sum(int(entry["card"]["play"]["strength_required"]) for entry in selected)
            required_action_strength = total_strength - (1 if level == 2 else 0)
            x_tokens = _x_for_strength(state, player_id, "sponsors", required_action_strength)
            if x_tokens is None:
                continue
            if sum(int(entry["cost"]) for entry in selected) > int(player.get("money", 0)):
                continue
            action: Dict[str, Any] = {
                "type": "sponsors",
                "mode": "play",
                "card_ids": [entry["card_id"] for entry in selected],
            }
            placements = {
                entry["card_id"]: {"cells": entry["placements"][0]}
                for entry in selected
                if entry["placements"]
            }
            if placements:
                action["unique_building_placements"] = placements
            if x_tokens:
                action["x_tokens"] = x_tokens
            candidates.append(action)
    for x_tokens in range(_available_x(state, player_id, "sponsors") + 1):
        if rules._action_strength(state, player_id, "sponsors", x_tokens) < 1:
            continue
        action = {"type": "sponsors", "mode": "break"}
        if x_tokens:
            action["x_tokens"] = x_tokens
        candidates.append(action)
    return candidates


def _gain_x_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    player = state["players"][player_id]
    demand = _action_demand(state, player_id)
    action_ids = sorted(
        rules.ACTION_IDS,
        key=lambda action_id: (
            rules._action_slot(player, action_id) * demand.get(action_id, 1.0),
            action_id,
        ),
    )
    return [{"type": "gain_x", "action_card": action_id} for action_id in action_ids]


def _main_candidates(
    state: Mapping[str, Any], player_id: str, legal: Sequence[str]
) -> List[Dict[str, Any]]:
    actions: List[Dict[str, Any]] = []
    allowed = set(legal)
    if "cards" in allowed:
        actions.extend(_cards_candidates(state, player_id))
    if "build" in allowed:
        actions.extend(_build_candidates(state, player_id))
    if "animals" in allowed:
        actions.extend(_animals_candidates(state, player_id))
    if "association" in allowed:
        actions.extend(_association_candidates(state, player_id))
    if "sponsors" in allowed:
        actions.extend(_sponsors_candidates(state, player_id))
    if "gain_x" in allowed:
        actions.extend(_gain_x_candidates(state, player_id))
    expanded: List[Dict[str, Any]] = []
    forced = state.get("forced_action")
    for action in actions:
        expanded.append(action)
        action_type = str(action.get("type", ""))
        if isinstance(forced, Mapping):
            continue
        if action_type in rules.ACTION_IDS:
            entry = state["players"][player_id]["action_cards"].get(action_type, {})
        elif action_type == "gain_x":
            chosen = str(action.get("action_card", ""))
            entry = state["players"][player_id]["action_cards"].get(chosen, {})
        else:
            entry = {}
        if int(entry.get("multiplier_tokens", 0)):
            # Omitting this field spends all multiplier tokens.  Always retain
            # the normal, non-repeated action as an alternative as well.
            expanded.append({**action, "use_multiplier_tokens": 0})
    return _dedupe(expanded, MAX_ACTION_CANDIDATES)


def _setup_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    hand = [str(card_id) for card_id in state["players"][player_id].get("hand", [])]
    return [
        {"type": "keep_initial_cards", "card_ids": list(card_ids)}
        for card_ids in itertools.combinations(hand, 4)
    ]


def _pending_build_candidates(
    state: Mapping[str, Any], player_id: str, pending: Mapping[str, Any]
) -> List[Dict[str, Any]]:
    choice_type = str(pending.get("type", pending.get("kind", "")))
    choice_id = pending.get("choice_id")
    actions: List[Dict[str, Any]] = []
    if choice_type == "place_free_enclosure":
        size = int(pending.get("size", 2))
        for cells in _all_placements(state, player_id, "standard_enclosure", size, limit=12):
            actions.append(
                {"type": "resolve_choice", "choice_id": choice_id, "selection": {"cells": cells}}
            )
        return actions

    if choice_type == "place_unique_building":
        effect_ref = pending.get("_effect_ref", {})
        card_id = str(pending.get("card_id") or (effect_ref.get("card_id") if isinstance(effect_ref, Mapping) else ""))
        card = rules.SPONSOR_CARDS.get(card_id, {})
        unique = card.get("unique_building") or pending.get("building")
        if isinstance(unique, Mapping):
            building_type = str(unique.get("id", f"sponsor-{card_id}"))
            size = int(unique.get("footprint", {}).get("cell_count", 1))
            for cells in _all_placements(state, player_id, building_type, size, unique, limit=12):
                actions.append(
                    {"type": "resolve_choice", "choice_id": choice_id, "selection": {"cells": cells}}
                )
        return actions

    # Effect-driven free buildings encode their type in the option/metadata.
    raw_types: List[str] = []
    if pending.get("building_type"):
        raw_types.append(str(pending["building_type"]))
    building = pending.get("building")
    if isinstance(building, Mapping) and building.get("id"):
        raw_types.append(str(building["id"]))
    for option in pending.get("options", []):
        if isinstance(option, Mapping):
            raw = option.get("building_type", option.get("id", option.get("value")))
            if raw:
                raw_types.append(str(raw))
    size_hint = int(pending.get("size", 1))
    for raw_type in dict.fromkeys(raw_types):
        building_type, size = _normalize_building(raw_type, size_hint)
        if building_type in rules.BUILDING_SIZES:
            size = rules.BUILDING_SIZES[building_type]
        for cells in _all_placements(state, player_id, building_type, size, limit=8):
            selection = {"building_type": building_type, "size": size, "cells": cells}
            actions.append({"type": "resolve_choice", "choice_id": choice_id, "selection": selection})
    return actions


def _pending_option_rank(
    state: Mapping[str, Any], player_id: str, pending: Mapping[str, Any], option: Any
) -> Tuple[float, str]:
    value = _option_value(option)
    choice_type = str(pending.get("type", pending.get("kind", "")))
    card_id = ""
    if isinstance(value, str):
        card_id = value.split(":", 1)[1] if value.startswith("display:") else value
    elif isinstance(value, Mapping):
        card_id = str(value.get("card_id", value.get("id", "")))
    score = _card_value(state, player_id, card_id) if card_id else 0.0
    if choice_type in {"discard_cards", "tuck_cards", "digging_card"}:
        score = -score
    if choice_type == "pilfering":
        score = 2.0 if value == "card" else 0.9 * min(5, int(state["players"][player_id].get("money", 0)))
    return score, _action_key({"value": value})


def _pending_candidates(state: Mapping[str, Any], player_id: str) -> List[Dict[str, Any]]:
    pending = state.get("pending_choice")
    if not isinstance(pending, Mapping) or pending.get("player_id") != player_id:
        return []
    choice_type = str(pending.get("type", pending.get("kind", "")))
    choice_id = pending.get("choice_id")
    if choice_type in {"place_free_enclosure", "place_free_building", "place_unique_building"}:
        actions = _pending_build_candidates(state, player_id, pending)
        if int(pending.get("min", pending.get("minimum", 1))) == 0 and pending.get(
            "allow_skip", pending.get("optional", False)
        ):
            actions.append({"type": "resolve_choice", "choice_id": choice_id, "selection": []})
        return _dedupe(actions, MAX_PENDING_CANDIDATES)

    options = list(pending.get("options", []))
    minimum = max(0, int(pending.get("min", pending.get("minimum", 1))))
    maximum = max(minimum, int(pending.get("max", pending.get("maximum", 1))))
    maximum = min(maximum, len(options))
    ranked = sorted(
        options,
        key=lambda option: (
            -_pending_option_rank(state, player_id, pending, option)[0],
            _pending_option_rank(state, player_id, pending, option)[1],
        ),
    )
    if len(ranked) > 12:
        # Break discards can occasionally be very large after chained draw
        # effects.  Never trim the option pool below the mandatory count.
        keep = max(12, minimum)
        ranked = ranked[: max(8, keep - 4)] + ranked[-min(4, len(ranked)):]
        ranked = list({_action_key({"value": _option_value(item)}): item for item in ranked}.values())
    actions: List[Dict[str, Any]] = []
    if minimum == 0:
        actions.append({"type": "resolve_choice", "choice_id": choice_id, "selection": []})

    counts = range(max(1, minimum), maximum + 1)
    for count in counts:
        combinations = itertools.combinations(ranked, count)
        for chosen in itertools.islice(combinations, MAX_PENDING_CANDIDATES):
            values = [_option_value(option) for option in chosen]
            selection: Any = values[0] if count == 1 else values
            actions.append({"type": "resolve_choice", "choice_id": choice_id, "selection": selection})
            if len(actions) >= MAX_PENDING_CANDIDATES:
                break
        if len(actions) >= MAX_PENDING_CANDIDATES:
            break
    return _dedupe(actions, MAX_PENDING_CANDIDATES)


def _setup_shape_bonus(state: Mapping[str, Any], player_id: str) -> float:
    hand = [str(card_id) for card_id in state["players"][player_id].get("hand", [])]
    animal_count = sum(card_id in rules.ANIMAL_CARDS for card_id in hand)
    sponsor_count = sum(card_id in rules.SPONSOR_CARDS for card_id in hand)
    project_count = sum(card_id in rules.PROJECT_CARDS for card_id in hand)
    bonus = 0.0
    if animal_count == 0:
        bonus -= 20.0
    else:
        bonus += min(3, animal_count) * 1.4
    if sponsor_count:
        bonus += 1.0
    if project_count > 1:
        bonus -= 1.0 * (project_count - 1)
    return bonus


def _forced_continuation_available(state: Mapping[str, Any]) -> bool:
    forced = state.get("forced_action")
    if not isinstance(forced, Mapping):
        return True
    player_id = str(forced.get("player_id", ""))
    if player_id not in state.get("players", {}):
        return False
    legal = rules.ArkNovaGame.get_legal_actions(dict(state), player_id)
    candidates = _main_candidates(state, player_id, legal)
    for action in candidates:
        candidate_state = copy.deepcopy(state)
        _, error = rules.ArkNovaGame.apply_action(candidate_state, player_id, action)
        if error is None:
            return True
    return False


def _candidate_score(
    before: Mapping[str, Any],
    after: Mapping[str, Any],
    player_id: str,
    action: Mapping[str, Any],
    *,
    before_value: Optional[float] = None,
) -> Optional[float]:
    if not _forced_continuation_available(after):
        return None
    baseline = _state_value(before, player_id) if before_value is None else before_value
    score = _state_value(after, player_id) - baseline
    action_type = str(action.get("type", ""))
    if action_type == "keep_initial_cards":
        score += _setup_shape_bonus(after, player_id)
    elif action_type == "animals":
        score += 0.8 * len(action.get("plays", []))
    elif action_type == "association":
        score += 0.45 * len(action.get("tasks", []))
    elif action_type == "cards":
        score += 0.25
    elif action_type == "sponsors" and action.get("mode") == "break":
        # Income is useful, but repeatedly rushing the break should not beat a
        # productive animal/project action by a tiny resource margin.
        score -= 0.35

    pending = after.get("pending_choice")
    if isinstance(pending, Mapping) and pending.get("player_id") == player_id:
        continuation = _pending_candidates(after, player_id)
        if not continuation and int(pending.get("min", pending.get("minimum", 1))) > 0:
            return None
        score += 0.25 if continuation else 0.0
    return score


def choose_ark_nova_action(
    state: Dict[str, Any],
    player_id: str,
    *,
    progress_callback: Optional[ProgressCallback] = None,
) -> Optional[Dict[str, Any]]:
    """Return the highest-valued legal Ark Nova action for ``player_id``.

    The input is never mutated.  Ties are resolved by a canonical JSON key so
    seeded games and tests remain reproducible.
    """

    legal = rules.ArkNovaGame.get_legal_actions(state, player_id)
    if not legal:
        return None
    _notify(progress_callback, "generating", 0.08, "Enumerating legal plans")
    if "keep_initial_cards" in legal:
        candidates = _setup_candidates(state, player_id)
    elif "resolve_choice" in legal:
        candidates = _pending_candidates(state, player_id)
    else:
        candidates = _main_candidates(state, player_id, legal)

    candidates = _dedupe(candidates, MAX_ACTION_CANDIDATES)
    _notify(progress_callback, "evaluating", 0.22, f"Evaluating {len(candidates)} plans")
    best: Optional[Tuple[float, str, Dict[str, Any]]] = None
    before_value = _state_value(state, player_id)
    total = max(1, len(candidates))
    for index, action in enumerate(candidates):
        candidate_state = copy.deepcopy(state)
        _, error = rules.ArkNovaGame.apply_action(candidate_state, player_id, action)
        if error is not None:
            continue
        score = _candidate_score(
            state,
            candidate_state,
            player_id,
            action,
            before_value=before_value,
        )
        if score is None:
            continue
        key = _action_key(action)
        if best is None or score > best[0] + 1e-9 or (abs(score - best[0]) <= 1e-9 and key < best[1]):
            best = (score, key, action)
        if index % 24 == 0:
            _notify(
                progress_callback,
                "evaluating",
                0.22 + 0.72 * ((index + 1) / total),
                f"Evaluated {index + 1}/{len(candidates)} plans",
            )

    if best is None:
        _notify(progress_callback, "blocked", 0.96, "No valid plan found")
        return None
    _notify(progress_callback, "ready", 0.98, f"Selected {best[2].get('type', 'action')}")
    return copy.deepcopy(best[2])


__all__ = ["choose_ark_nova_action"]
