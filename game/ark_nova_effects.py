"""Executable card effects for the base game of Ark Nova.

The game engine deliberately keeps this module independent from ``ArkNovaGame``.
It operates on the public mapping-shaped game state and returns serialisable
events/choices, so Socket.IO clients and bots can use the same rule path.

Card text is never parsed at runtime.  The JSON catalog is used only for card
identity and coverage validation; executable rules live in the registries below.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
from pathlib import Path
import random
from typing import Any, Callable, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple


ASSET_DIR = Path(__file__).with_name("assets") / "ark_nova"


def _load_json(name: str) -> Any:
    return json.loads((ASSET_DIR / name).read_text(encoding="utf-8"))


ANIMAL_CARDS: List[Dict[str, Any]] = _load_json("animal_cards.json")
SPONSOR_CARDS: List[Dict[str, Any]] = _load_json("sponsor_cards.json")
CONSERVATION_PROJECTS: List[Dict[str, Any]] = _load_json("conservation_projects.json")
FINAL_SCORING_CARDS: List[Dict[str, Any]] = _load_json("final_scoring_cards.json")
ABILITY_CATALOG: Dict[str, Dict[str, Any]] = _load_json("abilities.json")
ACTION_CARDS: List[Dict[str, Any]] = _load_json("action_cards.json")
MAP0: Dict[str, Any] = _load_json("map0.json")

ANIMAL_BY_ID = {card["id"]: card for card in ANIMAL_CARDS}
SPONSOR_BY_ID = {card["id"]: card for card in SPONSOR_CARDS}
PROJECT_BY_ID = {card["id"]: card for card in CONSERVATION_PROJECTS}
FINAL_BY_ID = {card["id"]: card for card in FINAL_SCORING_CARDS}
ACTION_CARD_REGISTRY = {card["id"]: card for card in ACTION_CARDS}
MAP_CELL_BY_ID = {cell["id"]: cell for cell in MAP0["cells"]}

ANIMAL_TAGS = ("bird", "herbivore", "predator", "primate", "reptile")
CONTINENT_TAGS = ("africa", "americas", "asia", "australia", "europe")
ACTION_IDS = ("cards", "build", "animals", "association", "sponsors")
TRACK_KEYS = ("money", "appeal", "conservation", "reputation", "x_tokens")


@dataclass
class PendingChoice:
    """A serialisable, resumable choice requested by a card effect."""

    kind: str
    player_id: str
    effect_ref: str
    prompt: str
    options: List[Dict[str, Any]] = field(default_factory=list)
    minimum: int = 1
    maximum: int = 1
    optional: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EffectResult:
    """The complete observable result of one effect dispatch."""

    events: List[Dict[str, Any]] = field(default_factory=list)
    pending_choice: Optional[Dict[str, Any]] = None
    state_updates: Dict[str, Any] = field(default_factory=dict)
    completed: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EffectContext:
    """Minimal bridge between the rule registry and the core game state."""

    state: MutableMapping[str, Any]
    player_id: str
    card_id: str = ""
    timing: str = "immediate"
    action: Optional[str] = None
    target_player_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


def _event(event_type: str, player_id: str, **data: Any) -> Dict[str, Any]:
    return {"type": event_type, "player_id": player_id, **data}


def _done(*events: Dict[str, Any]) -> EffectResult:
    return EffectResult(events=list(events))


def _pending(
    context: EffectContext,
    effect_ref: str,
    kind: str,
    prompt: str,
    options: Sequence[Mapping[str, Any]],
    minimum: int = 1,
    maximum: int = 1,
    optional: bool = False,
    metadata: Optional[Mapping[str, Any]] = None,
) -> EffectResult:
    value = PendingChoice(
        kind=kind,
        player_id=context.player_id,
        effect_ref=effect_ref,
        prompt=prompt,
        options=[dict(option) for option in options],
        minimum=minimum,
        maximum=maximum,
        optional=optional,
        metadata=dict(metadata or {}),
    ).to_dict()
    return EffectResult(pending_choice=value, completed=False)


def _combine(results: Iterable[EffectResult]) -> EffectResult:
    combined = EffectResult()
    for result in results:
        combined.events.extend(result.events)
        combined.state_updates.update(result.state_updates)
        if result.pending_choice is not None:
            combined.pending_choice = result.pending_choice
            combined.completed = False
            break
    return combined


def _players(state: Mapping[str, Any]) -> MutableMapping[str, MutableMapping[str, Any]]:
    players = state.get("players")
    if not isinstance(players, MutableMapping):
        raise ValueError("Ark Nova effect state requires a players mapping")
    return players  # type: ignore[return-value]


def _player(context: EffectContext, player_id: Optional[str] = None) -> MutableMapping[str, Any]:
    pid = player_id or context.player_id
    try:
        return _players(context.state)[pid]
    except KeyError as exc:
        raise ValueError(f"unknown player: {pid}") from exc


def _card_id(value: Any) -> str:
    if isinstance(value, Mapping):
        return str(value.get("id") or value.get("card_id") or "")
    return str(value)


def _sequence(player: Mapping[str, Any], key: str) -> List[Any]:
    value = player.get(key, [])
    return list(value) if isinstance(value, (list, tuple)) else []


def _played_ids(context: EffectContext, player_id: Optional[str] = None, key: str = "played_animals") -> List[str]:
    return [_card_id(value) for value in _sequence(_player(context, player_id), key)]


def _icons_for_card(card_id: str) -> List[Dict[str, Any]]:
    card = ANIMAL_BY_ID.get(card_id) or SPONSOR_BY_ID.get(card_id) or {}
    return list(card.get("icons", []))


def _count_tag(context: EffectContext, tag: str, player_id: Optional[str] = None) -> int:
    player = _player(context, player_id)
    tags = player.get("tags")
    if isinstance(tags, Mapping) and tag in tags:
        return int(tags.get(tag, 0))
    total = 0
    for key in ("played_animals", "played_sponsors"):
        for card_id in _played_ids(context, player_id, key):
            total += sum(int(icon.get("count", 0)) for icon in _icons_for_card(card_id) if icon.get("tag") == tag)
            if key == "played_animals" and tag in {"water", "rock"}:
                total += int(ANIMAL_BY_ID.get(card_id, {}).get("placement", {}).get("adjacent_to", {}).get(tag, 0))
    return total


def _all_tag_count(context: EffectContext, tag: str) -> int:
    return sum(_count_tag(context, tag, pid) for pid in _players(context.state))


def _animal_card(value: Any) -> Optional[Dict[str, Any]]:
    if isinstance(value, Mapping) and value.get("card_type") == "animal":
        return dict(value)
    return ANIMAL_BY_ID.get(_card_id(value))


def _is_small_animal(card: Mapping[str, Any]) -> bool:
    if any(icon.get("tag") == "petting_zoo_animal" for icon in card.get("icons", [])):
        return True
    return int(card.get("animal_size") or 0) in (1, 2)


def _is_large_animal(card: Mapping[str, Any]) -> bool:
    has_standard_option = any(option.get("type") == "standard" for option in card.get("enclosure_options", []))
    return has_standard_option and int(card.get("animal_size") or 0) in (4, 5)


def _metric(context: EffectContext, metric: str, player_id: Optional[str] = None) -> int:
    player = _player(context, player_id)
    metrics = player.get("metrics")
    if isinstance(metrics, Mapping) and metric in metrics:
        return int(metrics[metric])
    if metric in player and isinstance(player[metric], (int, bool)):
        return int(player[metric])
    map_state = player.get("map", {})
    if isinstance(map_state, Mapping):
        map_metrics = map_state.get("metrics", {})
        if isinstance(map_metrics, Mapping) and metric in map_metrics:
            return int(map_metrics[metric])
        conditions = map_state.get("conditions", {})
        if isinstance(conditions, Mapping) and metric in conditions:
            return int(bool(conditions[metric]))

    if metric in ANIMAL_TAGS or metric in CONTINENT_TAGS or metric in {"science", "water", "rock", "bear", "petting_zoo_animal"}:
        return _count_tag(context, metric, player_id)
    if metric == "any_animal_category":
        return sum(_count_tag(context, tag, player_id) > 0 for tag in ANIMAL_TAGS)
    if metric == "any_continent":
        return sum(_count_tag(context, tag, player_id) > 0 for tag in CONTINENT_TAGS)
    if metric in {"distinct_animal_categories", "animal_category_count"}:
        return sum(_count_tag(context, tag, player_id) > 0 for tag in ANIMAL_TAGS)
    if metric in {"distinct_continents", "continent_count"}:
        return sum(_count_tag(context, tag, player_id) > 0 for tag in CONTINENT_TAGS)
    if metric in {"small_animal", "small_animal_count"}:
        return sum(bool(card and _is_small_animal(card)) for card in map(_animal_card, _played_ids(context, player_id)))
    if metric in {"large_animal", "large_animal_count"}:
        records = player.get("animal_records", [])
        if isinstance(records, Mapping):
            records = list(records.values())
        if isinstance(records, Sequence) and records:
            total = 0
            for record in records:
                if not isinstance(record, Mapping):
                    continue
                card = ANIMAL_BY_ID.get(_record_card_id(record))
                enclosure_type = str(record.get("enclosure_type", "standard_enclosure"))
                total += bool(card and _is_large_animal(card) and enclosure_type.startswith("standard"))
            return total
        return sum(bool(card and _is_large_animal(card)) for card in map(_animal_card, _played_ids(context, player_id)))
    if metric in {"science_icon_count", "science"}:
        return _count_tag(context, "science", player_id)
    if metric == "supported_conservation_project_count":
        return len(_sequence(player, "supported_projects"))
    if metric == "sponsor_card_count":
        return len(_sequence(player, "played_sponsors"))
    if metric == "universities":
        return len(_sequence(player, "universities"))
    if metric == "partner_zoos":
        return len(_sequence(player, "partner_zoos"))
    if metric == "reputation":
        return int(player.get("reputation", 0))
    if metric == "rock_icon_count":
        return _count_tag(context, "rock", player_id)
    if metric == "water_icon_count":
        return _count_tag(context, "water", player_id)
    if metric == "empty_buildable_hex_count":
        occupied = set((map_state or {}).get("occupancy", {})) if isinstance(map_state, Mapping) else set()
        return sum(cell.get("buildable") and cell["id"] not in occupied for cell in MAP0["cells"])
    if metric in {
        "all_water_spaces_connected",
        "all_rock_spaces_connected",
        "all_buildable_border_spaces_covered",
        "all_buildable_spaces_covered",
    }:
        return int(_map_condition(context, metric, player_id))
    if metric in {
        "connected_water_hex_count",
        "isolated_water_hex_count",
        "connected_rock_hex_count",
        "isolated_rock_hex_count",
    }:
        occupied = set((map_state or {}).get("occupancy", {})) if isinstance(map_state, Mapping) else set()
        terrain = "water" if "water" in metric else "rock"
        connected = "connected_" in metric and not metric.startswith("isolated")
        return sum(
            cell.get("terrain") == terrain
            and bool(any(neighbor in occupied for neighbor in cell.get("neighbors", []))) == connected
            for cell in MAP0["cells"]
        )
    if metric == "connected_bonus_hex_count":
        occupied = set((map_state or {}).get("occupancy", {})) if isinstance(map_state, Mapping) else set()
        bonus_cells = {str(bonus.get("cell", bonus.get("cell_id"))) for bonus in MAP0.get("placement_bonuses", [])}
        return len(occupied.intersection(bonus_cells))
    if metric == "isolated_bonus_hex_count":
        occupied = set((map_state or {}).get("occupancy", {})) if isinstance(map_state, Mapping) else set()
        bonus_cells = {str(bonus.get("cell", bonus.get("cell_id"))) for bonus in MAP0.get("placement_bonuses", [])}
        return len(bonus_cells - occupied)
    if metric == "water_and_rock_requirements":
        total = 0
        for card_id in _played_ids(context, player_id):
            adjacent = ANIMAL_BY_ID.get(card_id, {}).get("placement", {}).get("adjacent_to", {})
            total += int(adjacent.get("water", 0) > 0) + int(adjacent.get("rock", 0) > 0)
        return total
    if metric.endswith("_count") and isinstance(map_state, Mapping):
        buildings = map_state.get("buildings", [])
        values = buildings.values() if isinstance(buildings, Mapping) else buildings if isinstance(buildings, Sequence) else []
        if metric == "kiosk_count":
            return sum(isinstance(building, Mapping) and building.get("type") == "kiosk" for building in values)
        if metric == "occupied_size_1_enclosure_count":
            return sum(
                isinstance(building, Mapping)
                and building.get("type") in {"standard_enclosure", "standard_enclosure_1"}
                and int(building.get("size", building.get("cell_count", 1))) == 1
                and bool(building.get("occupied", building.get("animal_ids")))
                for building in values
            )
    return 0


def _add(context: EffectContext, key: str, amount: int, player_id: Optional[str] = None, source: str = "") -> Dict[str, Any]:
    pid = player_id or context.player_id
    player = _player(context, pid)
    before = int(player.get(key, 0))
    after = before + int(amount)
    if key == "x_tokens":
        after = max(0, min(5, after))
    else:
        after = max(0, after)
    player[key] = after
    return _event("track_changed", pid, track=key, amount=after - before, value=after, source=source)


def _grant(context: EffectContext, source: str, player_id: Optional[str] = None, **rewards: int) -> EffectResult:
    events = []
    for key, amount in rewards.items():
        if amount:
            events.append(_add(context, key, int(amount), player_id, source))
    return EffectResult(events=events)


def _draw_cards(context: EffectContext, count: int, source: str, player_id: Optional[str] = None) -> EffectResult:
    pid = player_id or context.player_id
    deck = context.state.setdefault("deck", [])
    if not isinstance(deck, list):
        raise ValueError("state.deck must be a list")
    hand = _player(context, pid).setdefault("hand", [])
    if not isinstance(hand, list):
        raise ValueError("player.hand must be a list")
    drawn = []
    for _ in range(max(0, int(count))):
        if not deck:
            break
        card = deck.pop()
        hand.append(card)
        drawn.append(_card_id(card))
    return _done(_event("cards_drawn", pid, card_ids=drawn, count=len(drawn), source=source))


def _selected_ids(choice: Optional[Mapping[str, Any]]) -> List[str]:
    if not choice:
        return []
    value: Any = choice.get("selected_ids", choice.get("card_ids", choice.get("selection", choice.get("card_id"))))
    if value is None:
        return []
    if isinstance(value, (str, int)):
        return [str(value)]
    if isinstance(value, Sequence):
        return [str(item) for item in value]
    return []


def _choice_value(choice: Optional[Mapping[str, Any]], key: str, default: Any = None) -> Any:
    if not choice:
        return default
    if key in choice:
        return choice[key]
    return choice.get("value", default)


def _pending_from_context(context: EffectContext) -> Mapping[str, Any]:
    pending = context.metadata.get("pending_choice")
    if isinstance(pending, Mapping):
        return pending
    state_pending = context.state.get("pending_choice")
    return state_pending if isinstance(state_pending, Mapping) else {}


def _reveal_from_deck(context: EffectContext, count: int) -> List[Any]:
    pending = _pending_from_context(context)
    candidates = pending.get("metadata", {}).get("candidates", []) if isinstance(pending.get("metadata"), Mapping) else []
    if candidates:
        return list(candidates)
    deck = context.state.setdefault("deck", [])
    if not isinstance(deck, list):
        raise ValueError("state.deck must be a list")
    return [deck.pop() for _ in range(min(max(0, count), len(deck)))]


def _discard(context: EffectContext, cards: Iterable[Any]) -> None:
    discard = context.state.setdefault("discard", [])
    if not isinstance(discard, list):
        raise ValueError("state.discard must be a list")
    discard.extend(cards)


def _register_rule(context: EffectContext, effect_ref: str, rule: Mapping[str, Any]) -> EffectResult:
    player = _player(context)
    active = player.setdefault("active_effects", {})
    if not isinstance(active, MutableMapping):
        raise ValueError("player.active_effects must be a mapping")
    active[effect_ref] = dict(rule)
    return _done(_event("effect_registered", context.player_id, effect_ref=effect_ref, rule=dict(rule)))


def apply_printed_rewards(card_id: str, context: EffectContext) -> EffectResult:
    """Apply a card's printed track icons, independently of its text effects."""

    card = ANIMAL_BY_ID.get(str(card_id)) or SPONSOR_BY_ID.get(str(card_id))
    if card is None:
        raise ValueError(f"unknown animal/sponsor card: {card_id}")
    rewards = {key: int(value) for key, value in card.get("printed_rewards", {}).items() if int(value)}
    return _grant(context, f"card:{card_id}:printed", **rewards)


# Every ability is an explicit executable opcode.  Parameters printed on the
# animal card are supplied by ``execute_ability``; no localized text is read.
ABILITY_SPECS: Dict[str, Dict[str, Any]] = {
    "sprint": {"op": "draw"},
    "pack": {"op": "metric_reward", "metric": "predator", "appeal_per": 1},
    "hunter": {"op": "reveal_keep_animal", "keep": 1},
    "clever": {"op": "move_action", "actions": list(ACTION_IDS), "slots": [1], "optional": True},
    "boost_association": {"op": "move_action", "actions": ["association"], "slots": [1, 5], "optional": True},
    "boost_building": {"op": "move_action", "actions": ["build"], "slots": [1, 5], "optional": True},
    "boost_cards": {"op": "move_action", "actions": ["cards"], "slots": [1, 5], "optional": True},
    "boost_sponsors": {"op": "move_action", "actions": ["sponsors"], "slots": [1, 5], "optional": True},
    "boost_animal": {"op": "move_action", "actions": ["animals"], "slots": [1, 5], "optional": True},
    "action_association": {"op": "extra_action", "action": "association"},
    "action_building": {"op": "extra_action", "action": "build"},
    "action_cards": {"op": "extra_action", "action": "cards"},
    "action_sponsors": {"op": "extra_action", "action": "sponsors"},
    "inventive": {"op": "gain_x"},
    "inventive_bear": {"op": "global_metric_reward", "metric": "bear", "x_tokens_per": 1, "cap": 3},
    "inventive_primate": {"op": "ladder_reward", "metric": "primate", "ladder": [(1, 1), (3, 2), (5, 3)], "track": "x_tokens"},
    "full_throated": {"op": "hire_worker"},
    "jumping": {"op": "advance_break"},
    "multiplier_association": {"op": "multiplier", "action": "association"},
    "multiplier_building": {"op": "multiplier", "action": "build"},
    "multiplier_cards": {"op": "multiplier", "action": "cards"},
    "multiplier_sponsors": {"op": "multiplier", "action": "sponsors"},
    "iconic_animal": {"op": "iconic"},
    "sun_bathing": {"op": "discard_for_money"},
    "pouch": {"op": "tuck"},
    "resistance": {"op": "final_card_choice"},
    "assertion": {"op": "base_project_choice"},
    "digging": {"op": "digging"},
    "sponsor_magnet": {"op": "sponsor_magnet"},
    "flock_animal": {"op": "placement_modifier", "modifier": "shared_enclosure"},
    "venom": {"op": "attack", "attack": "venom"},
    "dominance": {"op": "specific_base_project"},
    "pilfering_1": {"op": "attack", "attack": "pilfering_1"},
    "pilfering_2": {"op": "attack", "attack": "pilfering_2"},
    "snapping_1": {"op": "take_display", "count": 1},
    "snapping_2": {"op": "take_display", "count": 2},
    "constriction": {"op": "attack", "attack": "constriction"},
    "hypnosis": {"op": "attack", "attack": "hypnosis"},
    "scavenging": {"op": "discard_choice"},
    "posturing": {"op": "free_build", "building_types": ["kiosk", "pavilion"]},
    "perception_2": {"op": "reveal_keep", "draw": 2, "keep": 1},
    "perception_4": {"op": "reveal_keep", "draw": 4, "keep": 2},
    "determination": {"op": "extra_any_action"},
    "peacocking": {"op": "free_build", "building_types": ["large_bird_aviary"], "maximum": 1},
    "petting_zoo_animal": {"op": "metric_reward", "metric": "petting_zoo_animal", "appeal_per": 3},
}


def _ability_parameters(ability_id: str, context: EffectContext, supplied: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    if supplied is not None:
        return dict(supplied)
    card = ANIMAL_BY_ID.get(str(context.card_id), {})
    for ability in card.get("abilities", []):
        if ability.get("ability") == ability_id:
            return dict(ability.get("parameters", {}))
    return {}


def _move_action(
    context: EffectContext,
    ability_id: str,
    spec: Mapping[str, Any],
    choice: Optional[Mapping[str, Any]],
) -> EffectResult:
    actions = list(spec["actions"])
    slots = list(spec["slots"])
    options = [{"id": f"{action}:{slot}", "action": action, "slot": slot} for action in actions for slot in slots]
    if choice is not None and bool(choice.get("skip")) and spec.get("optional"):
        return _done(_event("optional_effect_skipped", context.player_id, source=f"ability:{ability_id}"))
    selected = _selected_ids(choice)
    if choice is not None and not selected and spec.get("optional"):
        return _done(_event("optional_effect_skipped", context.player_id, source=f"ability:{ability_id}"))
    if choice is None:
        return _pending(context, f"ability:{ability_id}", "move_action_card", "选择要移动的行动牌和槽位", options, 0 if spec.get("optional") else 1, 1, bool(spec.get("optional")))
    if not selected:
        raise ValueError("an action-card movement must be selected")
    selected_option = next((option for option in options if option["id"] == selected[0]), None)
    if selected_option is None:
        raise ValueError("invalid action-card movement choice")
    # Repositioning changes every displaced slot, so the core owns the atomic
    # reorder.  Returning a complete command avoids ever creating duplicate
    # slots in shared state.
    return _done(_event("action_reposition_requested", context.player_id, source=f"ability:{ability_id}", **selected_option))


def _reveal_and_keep(
    context: EffectContext,
    effect_ref: str,
    draw_count: int,
    keep_count: int,
    choice: Optional[Mapping[str, Any]],
    animals_only: bool = False,
) -> EffectResult:
    revealed = _reveal_from_deck(context, draw_count)
    eligible = [card for card in revealed if not animals_only or _animal_card(card) is not None]
    maximum = min(keep_count, len(eligible))
    if not eligible or maximum == 0:
        _discard(context, revealed)
        return _done(_event("cards_revealed_and_discarded", context.player_id, card_ids=[_card_id(card) for card in revealed], source=effect_ref))
    selected = _selected_ids(choice)
    if choice is None:
        return _pending(
            context,
            effect_ref,
            "keep_revealed_cards",
            "选择要保留的牌",
            [{"id": _card_id(card), "card_id": _card_id(card)} for card in eligible],
            0 if animals_only else maximum,
            maximum,
            animals_only,
            {"candidates": revealed},
        )
    if len(selected) > maximum or any(card_id not in {_card_id(card) for card in eligible} for card_id in selected):
        raise ValueError("invalid revealed-card choice")
    kept = [card for card in revealed if _card_id(card) in selected]
    rejected = [card for card in revealed if _card_id(card) not in selected]
    hand = _player(context).setdefault("hand", [])
    hand.extend(kept)
    _discard(context, rejected)
    return _done(_event("revealed_cards_kept", context.player_id, kept=[_card_id(card) for card in kept], discarded=[_card_id(card) for card in rejected], source=effect_ref))


def _display_choice(
    context: EffectContext,
    effect_ref: str,
    count: int,
    choice: Optional[Mapping[str, Any]],
    card_type: Optional[str] = None,
) -> EffectResult:
    display = context.state.setdefault("display", [])
    if not isinstance(display, list):
        raise ValueError("state.display must be a list")
    eligible = []
    for value in display:
        cid = _card_id(value)
        card = ANIMAL_BY_ID.get(cid) or SPONSOR_BY_ID.get(cid)
        if card_type is None or (card and card.get("card_type") == card_type):
            eligible.append(value)
    if not eligible:
        return _done(_event("effect_no_target", context.player_id, source=effect_ref))
    selected = _selected_ids(choice)
    if choice is None:
        return _pending(context, effect_ref, "take_display_cards", "选择展示区卡牌", [{"id": _card_id(card), "card_id": _card_id(card)} for card in eligible], min(1, count), min(count, len(eligible)))
    if len(selected) > count or any(cid not in {_card_id(card) for card in eligible} for cid in selected):
        raise ValueError("invalid display-card choice")
    taken = []
    for card_id in selected:
        card = next(value for value in display if _card_id(value) == card_id)
        display.remove(card)
        taken.append(card)
    _player(context).setdefault("hand", []).extend(taken)
    return _done(_event("display_cards_taken", context.player_id, card_ids=selected, source=effect_ref, refill_after_action=True))


def execute_ability(
    ability_id: str,
    context: EffectContext,
    params: Optional[Mapping[str, Any]] = None,
    choice: Optional[Mapping[str, Any]] = None,
) -> EffectResult:
    """Execute one of the 45 base-game animal ability definitions."""

    if ability_id not in ABILITY_REGISTRY:
        raise ValueError(f"unknown Ark Nova ability: {ability_id}")
    spec = ABILITY_SPECS[ability_id]
    parameters = _ability_parameters(ability_id, context, params)
    op = spec["op"]
    ref = f"ability:{ability_id}"

    if op == "draw":
        return _draw_cards(context, int(parameters.get("draw_count", 0)), ref)
    if op == "metric_reward":
        amount = _metric(context, str(spec["metric"])) * int(spec.get("appeal_per", 0))
        return _grant(context, ref, appeal=amount)
    if op == "global_metric_reward":
        value = _all_tag_count(context, str(spec["metric"]))
        amount = min(value * int(spec.get("x_tokens_per", 1)), int(spec.get("cap", value)))
        return _grant(context, ref, x_tokens=amount)
    if op == "ladder_reward":
        value = _metric(context, str(spec["metric"]))
        amount = max((reward for threshold, reward in spec["ladder"] if value >= threshold), default=0)
        return _grant(context, ref, **{str(spec["track"]): amount})
    if op == "reveal_keep_animal":
        return _reveal_and_keep(context, ref, int(parameters.get("reveal_count", 0)), int(spec["keep"]), choice, True)
    if op == "reveal_keep":
        return _reveal_and_keep(context, ref, int(spec["draw"]), int(spec["keep"]), choice)
    if op == "move_action":
        return _move_action(context, ability_id, spec, choice)
    if op == "extra_action":
        action = str(spec["action"])
        strength = int(_player(context).get("action_cards", {}).get(action, {}).get("slot", 0))
        return _done(_event("extra_action_requested", context.player_id, action=action, strength=strength, source=ref, allow_x_alternative=False))
    if op == "extra_any_action":
        options = [{"id": action, "action": action} for action in ACTION_IDS if action != context.action]
        selected = _selected_ids(choice)
        if choice is None:
            return _pending(context, ref, "extra_action", "选择另一张行动牌执行", options)
        if selected[0] not in {option["id"] for option in options}:
            raise ValueError("invalid extra-action choice")
        return _done(_event("extra_action_requested", context.player_id, action=selected[0], source=ref, move_after=True))
    if op == "gain_x":
        return _grant(context, ref, x_tokens=int(parameters.get("x_tokens", 0)))
    if op == "hire_worker":
        player = _player(context)
        total = int(player.get("association_workers_total", player.get("total_workers", 1)))
        maximum = int(player.get("association_workers_max", player.get("maximum_workers", 4)))
        if total >= maximum:
            return _done(_event("effect_no_target", context.player_id, source=ref))
        player["association_workers_total"] = total + 1
        player["total_workers"] = total + 1
        player["available_workers"] = int(player.get("available_workers", 0)) + 1
        return _done(_event("worker_hired", context.player_id, source=ref, available_workers=player["available_workers"], total_workers=total + 1))
    if op == "advance_break":
        steps = int(parameters.get("break_steps", 0))
        before = int(context.state.get("break_position", 0))
        limit = int(context.state.get("break_limit", 99))
        context.state["break_position"] = before + steps
        reached_break = before < limit <= int(context.state["break_position"])
        if reached_break:
            context.state["break_due"] = True
        result = _grant(context, ref, money=int(parameters.get("money", steps)))
        if reached_break:
            x_result = _grant(context, ref, x_tokens=1)
            result.events.extend(x_result.events)
        result.events.insert(0, _event("break_advanced", context.player_id, steps=context.state["break_position"] - before, value=context.state["break_position"], source=ref))
        return result
    if op == "multiplier":
        action = str(spec["action"])
        entry = _player(context).setdefault("action_cards", {}).setdefault(action, {})
        entry["multiplier_tokens"] = int(entry.get("multiplier_tokens", 0)) + 1
        return _done(_event("multiplier_added", context.player_id, action=action, count=entry["multiplier_tokens"], source=ref))
    if op == "iconic":
        amount = min(_all_tag_count(context, str(parameters.get("continent", ""))), int(parameters.get("maximum_appeal", 8)))
        return _grant(context, ref, appeal=amount)
    if op == "discard_for_money":
        hand = _player(context).setdefault("hand", [])
        maximum = min(int(parameters.get("maximum_cards", 0)), len(hand))
        selected = _selected_ids(choice)
        if choice is None:
            return _pending(context, ref, "discard_cards", "选择要卖出的手牌", [{"id": _card_id(card), "card_id": _card_id(card)} for card in hand], 0, maximum, True)
        if len(selected) > maximum:
            raise ValueError("too many cards selected")
        removed = []
        for cid in selected:
            card = next((item for item in hand if _card_id(item) == cid), None)
            if card is None:
                raise ValueError("selected card is not in hand")
            hand.remove(card)
            removed.append(card)
        _discard(context, removed)
        return _combine([_grant(context, ref, money=len(removed) * int(parameters.get("money_per_card", 4))), _done(_event("cards_sold", context.player_id, card_ids=selected, source=ref))])
    if op == "tuck":
        hand = _player(context).setdefault("hand", [])
        maximum = min(int(parameters.get("maximum_cards", 0)), len(hand))
        selected = _selected_ids(choice)
        if choice is None:
            return _pending(context, ref, "tuck_cards", "选择压在动物牌下的手牌", [{"id": _card_id(card), "card_id": _card_id(card)} for card in hand], 0, maximum, True)
        tucked = []
        for cid in selected[:maximum]:
            card = next((item for item in hand if _card_id(item) == cid), None)
            if card is None:
                raise ValueError("selected card is not in hand")
            hand.remove(card)
            tucked.append(card)
        _player(context).setdefault("tucked_cards", {}).setdefault(context.card_id, []).extend(tucked)
        return _combine([_grant(context, ref, appeal=2 * len(tucked)), _done(_event("cards_tucked", context.player_id, card_ids=[_card_id(card) for card in tucked], source=ref))])
    if op == "final_card_choice":
        deck = context.state.setdefault("final_deck", context.state.get("final_scoring_deck", []))
        candidates = list(deck[-2:])
        if not candidates:
            return _done(_event("effect_no_target", context.player_id, source=ref))
        selected = _selected_ids(choice)
        if choice is None:
            return _pending(context, ref, "keep_final_scoring_card", "从两张终局计分牌中保留一张", [{"id": _card_id(card), "card_id": _card_id(card)} for card in candidates], 1, 1, False, {"candidates": candidates})
        if len(selected) != 1:
            raise ValueError("exactly one final scoring card must be selected")
        if selected[0] not in {_card_id(card) for card in candidates}:
            raise ValueError("invalid final scoring card")
        for card in candidates:
            if card in deck:
                deck.remove(card)
        kept = next(card for card in candidates if _card_id(card) == selected[0])
        _player(context).setdefault("final_cards", _player(context).get("final_scoring_cards", [])).append(kept)
        context.state.setdefault("discarded_final_scoring_cards", []).extend(card for card in candidates if card is not kept)
        return _done(_event("final_scoring_card_kept", context.player_id, card_id=selected[0], source=ref))
    if op in {"base_project_choice", "specific_base_project"}:
        in_game = {_card_id(value) for value in context.state.get("projects", [])}
        default_projects = [
            card["id"]
            for card in CONSERVATION_PROJECTS
            if card["project_type"] == "base" and card["id"] not in in_game
        ]
        projects = context.state.get("unused_base_projects", default_projects)
        if op == "specific_base_project":
            metric = str(parameters.get("project_tag", ""))
            projects = [cid for cid in projects if PROJECT_BY_ID.get(_card_id(cid), {}).get("metric") == metric]
        selected = _selected_ids(choice)
        if not projects:
            return _done(_event("effect_no_target", context.player_id, source=ref))
        if choice is None:
            return _pending(context, ref, "take_base_project", "选择一张未使用的基础保育项目", [{"id": _card_id(card), "card_id": _card_id(card)} for card in projects])
        if len(selected) != 1:
            raise ValueError("exactly one base project must be selected")
        card = next((item for item in projects if _card_id(item) == selected[0]), None)
        if card is None:
            raise ValueError("invalid base project")
        if isinstance(context.state.get("unused_base_projects"), list):
            context.state["unused_base_projects"].remove(card)
        _player(context).setdefault("hand", []).append(card)
        return _done(_event("base_project_taken", context.player_id, card_id=selected[0], source=ref))
    if op == "sponsor_magnet":
        display = context.state.setdefault("display", [])
        sponsors = [card for card in display if _card_id(card) in SPONSOR_BY_ID]
        for card in sponsors:
            display.remove(card)
        _player(context).setdefault("hand", []).extend(sponsors)
        return _done(_event("display_cards_taken", context.player_id, card_ids=[_card_id(card) for card in sponsors], source=ref, refill_after_action=True))
    if op == "placement_modifier":
        rule = {"type": spec["modifier"], **parameters, "card_id": context.card_id}
        return _register_rule(context, ref, rule)
    if op == "take_display":
        return _display_choice(context, ref, int(spec["count"]), choice)
    if op == "discard_choice":
        discard = context.state.get("discard", [])
        count = int(parameters.get("draw_count", 0))
        pending = _pending_from_context(context)
        pending_meta = pending.get("metadata", {}) if isinstance(pending, Mapping) else {}
        persisted = pending_meta.get("candidates", []) if isinstance(pending_meta, Mapping) else []
        if persisted:
            candidates = list(persisted)
        elif isinstance(discard, list):
            counter = int(context.state.get("effect_random_counter", 0)) + 1
            context.state["effect_random_counter"] = counter
            shuffled = list(discard)
            random.Random(f"{context.state.get('rng_seed')}:{counter}:scavenging").shuffle(shuffled)
            candidates = shuffled[:count]
        else:
            candidates = []
        selected = _selected_ids(choice)
        if not candidates:
            return _done(_event("effect_no_target", context.player_id, source=ref))
        if choice is None:
            return _pending(context, ref, "take_discard_card", "从随机展示的弃牌中保留一张", [{"id": _card_id(card), "card_id": _card_id(card)} for card in candidates], metadata={"candidates": candidates})
        card = next((item for item in candidates if _card_id(item) == selected[0]), None)
        if card is None:
            raise ValueError("invalid discard choice")
        context.state["discard"].remove(card)
        _player(context).setdefault("hand", []).append(card)
        return _done(_event("discard_card_taken", context.player_id, card_id=selected[0], source=ref))
    if op == "free_build":
        maximum = int(parameters.get("maximum_buildings", spec.get("maximum", 1)))
        if choice is None:
            return _pending(context, ref, "place_free_building", "选择免费建筑及放置位置", [{"id": kind, "building_type": kind} for kind in spec["building_types"]], 0, maximum, True, {"maximum_buildings": maximum, "normal_placement_rules": True})
        placements = choice.get("placements", [])
        if choice.get("skip"):
            placements = []
        if not isinstance(placements, list) or len(placements) > maximum:
            raise ValueError("invalid free-building placements")
        allowed = set(spec["building_types"])
        if any(not isinstance(item, Mapping) or item.get("building_type") not in allowed for item in placements):
            raise ValueError("invalid free-building type")
        return _done(_event("free_build_requested", context.player_id, source=ref, placements=list(placements), normal_placement_rules=True))
    if op == "digging":
        if choice is None:
            return _pending(context, ref, "digging", "选择弃展示牌或弃手牌后抽牌，可重复执行", [{"id": "discard_display"}, {"id": "cycle_hand"}, {"id": "stop"}], 1, 1, False, {"maximum_repetitions": int(parameters.get("maximum_repetitions", 0))})
        operations = choice.get("operations", [])
        if not isinstance(operations, list) or len(operations) > int(parameters.get("maximum_repetitions", 0)):
            raise ValueError("invalid digging operations")
        return _done(_event("digging_requested", context.player_id, source=ref, operations=list(operations)))
    if op == "attack":
        targets = [pid for pid in _players(context.state) if pid != context.player_id]
        if choice is None:
            return _pending(context, ref, "resolve_attack", "结算互动动物能力", [{"id": pid, "target_player_id": pid} for pid in targets], 0, max(1, len(targets)), True, {"attack": spec["attack"], **parameters})
        assignments = choice.get("assignments", choice.get("targets", []))
        if not isinstance(assignments, list):
            raise ValueError("attack assignments must be a list")
        return _done(_event("attack_resolution_requested", context.player_id, source=ref, attack=spec["attack"], assignments=list(assignments), parameters=parameters))
    raise RuntimeError(f"unimplemented ability opcode: {op}")


ABILITY_REGISTRY: Dict[str, Callable[..., EffectResult]] = {
    ability_id: execute_ability for ability_id in ABILITY_SPECS
}


# Sponsor effects use a compact declarative vocabulary.  Each generated effect
# id receives one explicit spec below (directly or through a card-family table).
SPONSOR_EFFECT_SPECS: Dict[str, Dict[str, Any]] = {}


def _sponsor(effect_id: str, op: str, **values: Any) -> None:
    SPONSOR_EFFECT_SPECS[effect_id] = {"op": op, **values}


_sponsor("201-glossary-1", "take_card", sources=["deck", "display"])
_sponsor("201-printed-1", "take_card", sources=["deck", "display"])
_sponsor("201-printed-2", "ladder", metric="science", ladder=[(3, 1), (6, 2)], track="conservation")
_sponsor("202-printed-1", "trigger", trigger="own_icon_played", tag="science", reward={"reputation": 1})
_sponsor("203-glossary-1", "ladder", metric="universities", ladder=[(1, 2), (2, 5), (3, 10)], track="money")
_sponsor("203-printed-1", "modifier", modifier="project_task_strength", value=4)
_sponsor("203-glossary-2", "threshold", metric="universities", threshold=3, reward={"conservation": 1})
_sponsor("204-glossary-1", "metric_reward", metric="science", reward={"money": 2})
_sponsor("204-printed-1", "trigger", trigger="own_icon_played", tag="science", reward={"conservation": 1})
_sponsor("206-glossary-1", "metric_reward", metric="supported_conservation_project_count", reward={"appeal": 2})
_sponsor("206-printed-1", "grant", conservation=1)
_sponsor("207-printed-1", "custom", rule="basic_research")
_sponsor("208-glossary-1", "metric_reward", metric="science", reward={"appeal": 1})
_sponsor("208-printed-1", "trigger", trigger="any_icon_played", tag="science", reward={"money": 2})
_sponsor("208-printed-2", "threshold", metric="distinct_animal_categories", threshold=5, reward={"conservation": 1})
_sponsor("209-glossary-1", "grant", x_tokens=1)
_sponsor("209-printed-1", "grant", x_tokens=1)
_sponsor("209-glossary-2", "threshold", metric="universities", threshold=3, reward={"conservation": 1})

for card_id, tag, building, end_metric in (
    ("210", "americas", "kiosk", "kiosk_count"),
    ("211", "europe", "standard_enclosure_1", "occupied_size_1_enclosure_count"),
    ("212", "australia", None, None),
    ("213", "asia", "pavilion", None),
    ("214", "africa", None, None),
):
    _sponsor(f"{card_id}-glossary-1", "metric_reward", metric=tag, reward={"appeal": 1})
    if card_id == "212":
        _sponsor("212-printed-1", "trigger", trigger="own_icon_played", tag=tag, ability="pouch", params={"maximum_cards": 1})
    elif card_id == "214":
        _sponsor("214-printed-1", "trigger", trigger="own_icon_played", tag=tag, ability="clever", params={})
        _sponsor("214-glossary-2", "metric_reward", metric="x_tokens", reward={"appeal": 1})
    else:
        _sponsor(f"{card_id}-printed-1", "trigger", trigger="own_icon_played", tag=tag, free_build=building)
    if end_metric:
        _sponsor(f"{card_id}-glossary-2", "threshold", metric=end_metric, threshold=5, reward={"conservation": 1})

for card_id in ("215", "218"):
    _sponsor(f"{card_id}-printed-1", "setup_tokens", count=2, modifier="base_project_wild_icon")
    _sponsor(f"{card_id}-printed-2", "threshold", metric="supported_conservation_project_count", threshold=5, reward={"conservation": 1})

_sponsor("216-printed-1", "ability", ability="full_throated", params={})
_sponsor("216-glossary-1", "threshold", metric="reputation", threshold=9, reward={"conservation": 1})
_sponsor("217-printed-1", "modifier", modifier="extra_same_building", paid=True, excludes=["special_enclosure"])
_sponsor("217-glossary-1", "threshold", metric="all_buildable_spaces_covered", threshold=1, reward={"appeal": 5})
_sponsor("219-printed-2", "metric_reward", metric="water_and_rock_requirements", reward={"money": 2})
_sponsor("219-printed-1", "modifier", modifier="ignore_water_rock_rules", may_cover=True)
_sponsor("219-glossary-1", "custom", rule="water_rock_pairs")
_sponsor("220-glossary-1", "grant", money=3)
_sponsor("220-printed-1", "grant", money=3)
_sponsor("220-glossary-2", "threshold", metric="reputation", threshold=9, reward={"conservation": 1})
_sponsor("221-printed-1", "modifier", modifier="duplicate_border_placement_bonus")
_sponsor("221-glossary-1", "threshold", metric="all_buildable_border_spaces_covered", threshold=1, reward={"conservation": 1})
_sponsor("222-printed-1", "custom", rule="publish_patent")
_sponsor("224-glossary-1", "grant", x_tokens=1)
_sponsor("224-printed-1", "modifier", modifier="release_project_bonus", conservation=1, repeatable_project_support=True)
_sponsor("225-glossary-1", "grant", x_tokens=1)
_sponsor("225-printed-1", "modifier", modifier="attack_immunity", attacks=["venom", "constriction", "hypnosis", "pilfering"])
_sponsor("225-printed-2", "threshold", metric="distinct_continents", threshold=5, reward={"conservation": 1})
_sponsor("226-printed-1", "threshold", metric="distinct_continents", threshold=5, reward={"conservation": 1})
_sponsor("227-printed-1", "custom", rule="choose_animal_size")
_sponsor("227-printed-2", "modifier", modifier="chosen_animal_size_only", rewards={"small": 2, "large": 4})
_sponsor("228-glossary-1", "metric_reward", metric="small_animal_count", reward={"money": 2})
_sponsor("228-printed-1", "modifier", modifier="small_animal_action_chain")
_sponsor("229-glossary-1", "metric_reward", metric="small_animal_count", reward={"appeal": 1})
_sponsor("229-printed-1", "modifier", modifier="animal_discount", size="small", money=3)
_sponsor("230-glossary-1", "metric_reward", metric="large_animal_count", reward={"appeal": 2})
_sponsor("230-printed-1", "modifier", modifier="animal_discount", size="large", money=4)

for card_id, tag in (("231", "primate"), ("232", "reptile"), ("233", "bird"), ("234", "predator"), ("235", "herbivore")):
    _sponsor(f"{card_id}-glossary-1", "metric_reward", metric=tag, reward={"appeal": 1})
    _sponsor(f"{card_id}-printed-1", "ladder", metric=tag, ladder=[(1, 3), (3, 6), (5, 9)], track="money")

for card_id, tag in (("236", "primate"), ("237", "reptile"), ("238", "bird"), ("239", "predator"), ("240", "herbivore")):
    _sponsor(f"{card_id}-printed-1", "trigger", trigger="any_icon_played", tag=tag, reward={"money": 3})

_sponsor("241-glossary-1", "metric_reward", metric="water", reward={"appeal": 1})
_sponsor("241-printed-1", "trigger", trigger="hex_covered_adjacent_to", terrain="water", reward={"money": 1})
_sponsor("241-printed-2", "threshold", metric="all_water_spaces_connected", threshold=1, reward={"conservation": 1})
_sponsor("242-glossary-1", "group_reward", metric="rock", group_size=2, reward={"appeal": 3})
_sponsor("242-printed-1", "trigger", trigger="hex_covered_adjacent_to", terrain="rock", reward={"money": 1})
_sponsor("242-printed-2", "threshold", metric="all_rock_spaces_connected", threshold=1, reward={"conservation": 1})

for card_id, tag, terrain, adjacent in (
    ("243", "herbivore", "rock", 1),
    ("244", "bird", "water", 1),
    ("245", "water", "water", 2),
    ("246", "rock", "rock", 2),
    ("247", "primate", "rock", 1),
):
    _sponsor(f"{card_id}-printed-2", "place_unique", terrain=terrain, adjacent=adjacent)
    _sponsor(f"{card_id}-printed-1", "trigger", trigger="own_icon_played", tag=tag, reward={"appeal": 2})
    _sponsor(f"{card_id}-glossary-1", "threshold", metric=tag, threshold=6, reward={"conservation": 1})

for card_id in ("248", "249", "250", "252", "253"):
    _sponsor(f"{card_id}-unique-building", "place_unique")
_sponsor("248-printed-1", "trigger", trigger="own_icon_played", tag="primate", reward={"x_tokens": 1})
_sponsor("249-printed-1", "trigger", trigger="own_icon_played", tag="bird", ability="perception_2", params={})
_sponsor("250-printed-1", "trigger", trigger="own_icon_played", tag="reptile", ability="sun_bathing", params={"maximum_cards": 2, "money_per_card": 4})
_sponsor("251-printed-2", "place_unique", terrain="water", adjacent=1)
_sponsor("251-printed-1", "trigger", trigger="any_icon_played", tag="bear", reward={"appeal": 2})
_sponsor("251-printed-3", "ladder", metric="bear", ladder=[(3, 1), (6, 2)], track="conservation")
_sponsor("252-printed-1", "trigger", trigger="own_icon_played", tag="predator", ability="hunter_dynamic")
_sponsor("253-printed-1", "setup_tokens", count=3, modifier="okapi_sponsor_chain")
_sponsor("254-printed-1", "place_unique", after="take_card", minimum_border_spaces=2)
_sponsor("255-printed-1", "place_unique", terrain="rock", adjacent=1)
_sponsor("256-printed-1", "place_unique", terrain="water", adjacent=1)
_sponsor("257-printed-1", "place_unique", minimum_border_spaces=2, ignore_adjacency=True)
_sponsor("257-printed-2", "metric_reward", metric="side_entrance_adjacent_building_count", reward={"money": 2})
_sponsor("257-printed-3", "threshold", metric="all_buildable_spaces_covered", threshold=1, reward={"appeal": 5})
_sponsor("258-printed-1", "metric_reward", metric="connected_water_hex_count", reward={"appeal": 1})
_sponsor("258-printed-2", "group_reward", metric="isolated_water_hex_count", group_size=2, reward={"conservation": 1})
_sponsor("259-printed-1", "metric_reward", metric="connected_rock_hex_count", reward={"appeal": 1})
_sponsor("259-printed-2", "group_reward", metric="isolated_rock_hex_count", group_size=2, reward={"conservation": 1})
_sponsor("260-printed-1", "metric_reward", metric="connected_empty_border_hex_count", reward={"appeal": 1})
_sponsor("260-printed-2", "metric_reward", metric="empty_six_hex_regions", reward={"conservation": 1})
_sponsor("261-printed-1", "threshold", metric="distinct_animal_categories", threshold=5, reward={"conservation": 1})
_sponsor("262-printed-2", "custom", rule="explorer_immediate")
_sponsor("262-printed-1", "trigger", trigger="new_unique_icon", tags=list(ANIMAL_TAGS + CONTINENT_TAGS), reward={"appeal": 1, "money": 2})
_sponsor("263-printed-2", "free_build", building="standard_enclosure", size=5)
_sponsor("263-printed-1", "modifier", modifier="large_animal_ignore_condition", count=1)
_sponsor("264-printed-1", "metric_reward", metric="connected_bonus_hex_count", reward={"appeal": 1})
_sponsor("264-printed-2", "group_reward", metric="isolated_bonus_hex_count", group_size=2, reward={"conservation": 1})


def _execute_trigger(
    effect_id: str,
    spec: Mapping[str, Any],
    context: EffectContext,
    choice: Optional[Mapping[str, Any]],
) -> EffectResult:
    if context.metadata.get("register_only"):
        return _register_rule(context, effect_id, spec)
    trigger = context.metadata.get("trigger")
    trigger_card = context.metadata.get("trigger_card")
    inferred_tags: List[str] = []
    if isinstance(trigger_card, Mapping):
        for icon in trigger_card.get("icons", []):
            inferred_tags.extend([str(icon.get("tag"))] * int(icon.get("count", 1)))
        if not trigger and spec.get("trigger") in {"own_icon_played", "any_icon_played"}:
            trigger = spec.get("trigger")
    if not trigger:
        return _register_rule(context, effect_id, spec)
    if trigger != spec.get("trigger"):
        return _done()
    tag = spec.get("tag")
    event_tags = context.metadata.get("tags", inferred_tags or [context.metadata.get("tag")])
    if not isinstance(event_tags, Sequence) or isinstance(event_tags, str):
        event_tags = [event_tags]
    if tag and tag not in event_tags:
        return _done()
    tags = spec.get("tags")
    if tags and context.metadata.get("tag") not in tags:
        return _done()
    terrain = spec.get("terrain")
    if terrain and context.metadata.get("terrain") != terrain:
        return _done()
    if spec.get("ability"):
        ability = str(spec["ability"])
        params = dict(spec.get("params", {}))
        if ability == "hunter_dynamic":
            ability = "hunter"
            params = {"reveal_count": _metric(context, "predator")}
        return execute_ability(ability, context, params, choice)
    if spec.get("free_build"):
        building = str(spec["free_build"])
        if choice is not None:
            if choice.get("skip"):
                return _done(_event("optional_effect_skipped", context.player_id, source=effect_id))
            placement = choice.get("placement", choice)
            if not isinstance(placement, Mapping):
                raise ValueError("free-building placement must be a mapping")
            return _done(_event(
                "free_build_requested",
                context.player_id,
                source=effect_id,
                building_type=building,
                placement=dict(placement),
                normal_placement_rules=True,
            ))
        return _pending(context, effect_id, "place_free_building", "放置免费建筑", [{"id": building, "building_type": building}], 0, 1, True, {"normal_placement_rules": True})
    count = max(1, int(context.metadata.get("count", event_tags.count(tag) if tag else 1)))
    return _grant(context, effect_id, **{key: int(value) * count for key, value in spec.get("reward", {}).items()})


def _custom_sponsor(
    effect_id: str,
    rule: str,
    context: EffectContext,
    choice: Optional[Mapping[str, Any]],
) -> EffectResult:
    if rule == "basic_research":
        distinct = _metric(context, "distinct_animal_categories") + _metric(context, "distinct_continents")
        conservation = distinct // 2
        results = [_grant(context, effect_id, conservation=conservation)]
        for pid in _players(context.state):
            if pid != context.player_id:
                results.append(_grant(context, effect_id, pid, money=2 * conservation))
        return _combine(results)
    if rule == "publish_patent":
        conservation = min(3, _metric(context, "science"))
        results = [_grant(context, effect_id, conservation=conservation)]
        for pid in _players(context.state):
            if pid != context.player_id:
                results.append(_grant(context, effect_id, pid, money=2 * conservation))
        return _combine(results)
    if rule == "water_rock_pairs":
        appeal = 2 * min(3, _metric(context, "water"), _metric(context, "rock"))
        return _grant(context, effect_id, appeal=appeal)
    if rule == "explorer_immediate":
        value = _metric(context, "distinct_animal_categories") + _metric(context, "distinct_continents")
        return _grant(context, effect_id, money=2 * value)
    if rule == "choose_animal_size":
        value = _choice_value(choice, "size")
        if value not in {"small", "large"}:
            return _pending(context, effect_id, "choose_animal_size", "选择小型或大型动物", [{"id": "small", "size": "small"}, {"id": "large", "size": "large"}])
        rule_state = {"type": "chosen_animal_size", "size": value, "appeal": 2 if value == "small" else 4}
        _register_rule(context, effect_id, rule_state)
        deck = context.state.get("deck", [])
        revealed: List[Any] = []
        selected_card: Any = None
        while isinstance(deck, list) and deck:
            card = deck.pop()
            card_data = _animal_card(card)
            matches = bool(card_data and (_is_small_animal(card_data) if value == "small" else _is_large_animal(card_data)))
            if matches:
                selected_card = card
                break
            revealed.append(card)
        if isinstance(deck, list) and revealed:
            # The cards passed over are tucked under the bottom of the deck.
            deck[0:0] = reversed(revealed)
        if selected_card is not None:
            _player(context).setdefault("hand", []).append(selected_card)
            return _done(_event("animal_fetched", context.player_id, card_id=_card_id(selected_card), size=value, source=effect_id, cards_moved_to_bottom=len(revealed)))
        return _done(_event("effect_no_target", context.player_id, source=effect_id))
    raise RuntimeError(f"unknown sponsor custom rule: {rule}")


def execute_sponsor_effect(
    card_id: str,
    effect_index: Any,
    context: EffectContext,
    choice: Optional[Mapping[str, Any]] = None,
) -> EffectResult:
    """Execute one sponsor effect by zero-based index or stable effect id."""

    card_id = str(card_id)
    card = SPONSOR_BY_ID.get(card_id)
    if card is None:
        raise ValueError(f"unknown sponsor card: {card_id}")
    if isinstance(effect_index, str) and effect_index in SPONSOR_EFFECT_REGISTRY:
        effect_id = effect_index
    else:
        try:
            effect_id = str(card["effects"][int(effect_index)]["id"])
        except (IndexError, KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"unknown effect {effect_index!r} for sponsor {card_id}") from exc
    spec = SPONSOR_EFFECT_SPECS[effect_id]
    op = spec["op"]

    if op == "grant":
        return _grant(context, effect_id, **{key: int(spec[key]) for key in TRACK_KEYS if key in spec})
    if op == "metric_reward":
        value = _metric(context, str(spec["metric"]))
        return _grant(context, effect_id, **{key: value * int(amount) for key, amount in spec["reward"].items()})
    if op == "group_reward":
        groups = _metric(context, str(spec["metric"])) // int(spec["group_size"])
        return _grant(context, effect_id, **{key: groups * int(amount) for key, amount in spec["reward"].items()})
    if op == "ladder":
        value = _metric(context, str(spec["metric"]))
        amount = max((reward for threshold, reward in spec["ladder"] if value >= threshold), default=0)
        return _grant(context, effect_id, **{str(spec["track"]): amount})
    if op == "threshold":
        reward = dict(spec["reward"]) if _metric(context, str(spec["metric"])) >= int(spec["threshold"]) else {}
        return _grant(context, effect_id, **reward)
    if op == "take_card":
        sources = list(spec["sources"])
        options = []
        if "deck" in sources and context.state.get("deck"):
            options.append({"id": "deck", "source": "deck"})
        if "display" in sources:
            options.extend({"id": f"display:{_card_id(card)}", "source": "display", "card_id": _card_id(card)} for card in context.state.get("display", []))
        selected = _selected_ids(choice)
        if not options:
            return _done(_event("effect_no_target", context.player_id, source=effect_id))
        if choice is None:
            return _pending(context, effect_id, "take_card", "从牌库或声望范围展示牌中拿取一张", options)
        if len(selected) != 1:
            raise ValueError("exactly one card source must be selected")
        if selected[0] == "deck":
            return _draw_cards(context, 1, effect_id)
        if selected[0].startswith("display:"):
            return _display_choice(context, effect_id, 1, {"card_id": selected[0].split(":", 1)[1]})
        raise ValueError("invalid card source")
    if op == "trigger":
        return _execute_trigger(effect_id, spec, context, choice)
    if op == "modifier":
        return _register_rule(context, effect_id, spec)
    if op == "setup_tokens":
        player = _player(context)
        counters = player.setdefault("card_tokens", {})
        counters.setdefault(card_id, int(spec["count"]))
        return _register_rule(context, effect_id, {**spec, "card_id": card_id})
    if op == "ability":
        return execute_ability(str(spec["ability"]), context, spec.get("params", {}), choice)
    if op == "place_unique":
        building = SPONSOR_BY_ID[card_id].get("unique_building", {})
        if choice is not None:
            if choice.get("skip"):
                raise ValueError("placing this unique building is mandatory")
            placement = choice.get("placement", choice)
            if not isinstance(placement, Mapping):
                raise ValueError("unique-building placement must be a mapping")
            events = [_event("unique_build_requested", context.player_id, source=effect_id, card_id=card_id, building_type=f"sponsor-{card_id}", placement=dict(placement), building=building)]
            if spec.get("after"):
                events.append(_event("follow_up_effect_requested", context.player_id, source=effect_id, effect=spec["after"]))
            return EffectResult(events=events)
        result = _pending(context, effect_id, "place_unique_building", "选择独特建筑的放置位置与方向", [{"id": f"sponsor-{card_id}", "building_type": f"sponsor-{card_id}"}], 1, 1, False, {"building": building, **{key: value for key, value in spec.items() if key not in {"op", "after"}}})
        if spec.get("after"):
            result.pending_choice["metadata"]["after"] = spec["after"]  # type: ignore[index]
        return result
    if op == "free_build":
        if choice is not None:
            if choice.get("skip"):
                return _done(_event("optional_effect_skipped", context.player_id, source=effect_id))
            placement = choice.get("placement", choice)
            if not isinstance(placement, Mapping):
                raise ValueError("free-building placement must be a mapping")
            return _done(_event("free_build_requested", context.player_id, source=effect_id, building_type=str(spec["building"]), placement=dict(placement), normal_placement_rules=True))
        return _pending(context, effect_id, "place_free_building", "选择免费建筑放置位置", [{"id": str(spec["building"]), "building_type": str(spec["building"])}], 0, 1, True, {key: value for key, value in spec.items() if key != "op"})
    if op == "custom":
        return _custom_sponsor(effect_id, str(spec["rule"]), context, choice)
    raise RuntimeError(f"unimplemented sponsor opcode: {op}")


SPONSOR_EFFECT_REGISTRY: Dict[str, Callable[..., EffectResult]] = {
    effect_id: execute_sponsor_effect for effect_id in SPONSOR_EFFECT_SPECS
}


def _occupied_project_positions(context: EffectContext, card_id: str) -> set:
    slots = context.state.get("project_slots", {})
    blocked = {
        int(item.get("position", 0))
        for item in context.state.get("blocked_project_slots", [])
        if isinstance(item, Mapping) and str(item.get("project_id")) == card_id
    }
    if not isinstance(slots, Mapping):
        return blocked
    value = slots.get(card_id, [])
    if isinstance(value, Mapping):
        return blocked | {int(position) for position, owner in value.items() if owner is not None}
    if isinstance(value, Sequence):
        occupied = set()
        for item in value:
            if isinstance(item, Mapping):
                occupied.add(int(item.get("position", 0)))
            elif isinstance(item, int):
                occupied.add(item)
        return blocked | occupied
    return blocked


def _animal_records(context: EffectContext) -> List[MutableMapping[str, Any]]:
    records = _player(context).get("animal_records", [])
    if isinstance(records, MutableMapping):
        normalized = []
        for record_id, record in records.items():
            if isinstance(record, MutableMapping):
                record.setdefault("record_id", record_id)
                normalized.append(record)
        return normalized
    return [record for record in records if isinstance(record, MutableMapping)] if isinstance(records, Sequence) else []


def _building_by_id(context: EffectContext, building_id: Any) -> Optional[MutableMapping[str, Any]]:
    buildings = _player(context).get("map", {}).get("buildings", [])
    if isinstance(buildings, MutableMapping):
        building = buildings.get(building_id) or buildings.get(str(building_id))
        return building if isinstance(building, MutableMapping) else None
    if isinstance(buildings, Sequence):
        return next(
            (
                building
                for building in buildings
                if isinstance(building, MutableMapping)
                and str(building.get("id", building.get("building_id", ""))) == str(building_id)
            ),
            None,
        )
    return None


def _record_card_id(record: Mapping[str, Any]) -> str:
    return str(record.get("card_id", record.get("animal_id", record.get("id", ""))))


def _record_enclosure_size(context: EffectContext, record: Mapping[str, Any]) -> int:
    for key in ("enclosure_size", "occupied_enclosure_size", "printed_enclosure_size"):
        if key in record:
            return int(record[key])
    building = _building_by_id(context, record.get("enclosure_id"))
    if building:
        return int(building.get("size", building.get("cell_count", len(building.get("cells", [])))))
    return 0


def _release_candidates(context: EffectContext, project: Mapping[str, Any], required_size: int) -> List[str]:
    metric = str(project["metric"])
    candidates = []
    for record in _animal_records(context):
        card_id = _record_card_id(record)
        card = ANIMAL_BY_ID.get(card_id)
        if not card:
            continue
        tags = {icon["tag"] for icon in card.get("icons", [])}
        # Release reward slots use the exact printed size of the occupied
        # enclosure, not a minimum animal-size comparison.
        if metric not in tags or _record_enclosure_size(context, record) != required_size:
            continue
        candidates.append(card_id)
    return candidates


def _breeding_candidates(context: EffectContext, project: Mapping[str, Any]) -> List[str]:
    metric = str(project["metric"])
    partner_zoos = set(_sequence(_player(context), "partner_zoos"))
    candidates = []
    for card_id in _played_ids(context):
        card = ANIMAL_BY_ID.get(card_id)
        if not card:
            continue
        tags = {icon["tag"] for icon in card.get("icons", [])}
        continents = tags.intersection(CONTINENT_TAGS)
        if metric in tags and continents.intersection(partner_zoos):
            candidates.append(card_id)
    return candidates


def _release_animal(context: EffectContext, animal_id: str, project_id: str) -> List[Dict[str, Any]]:
    player = _player(context)
    record = next((entry for entry in _animal_records(context) if _record_card_id(entry) == animal_id), None)
    if record is None:
        raise ValueError("release requires an animal record with its occupied enclosure")
    card = ANIMAL_BY_ID[animal_id]
    enclosure_id = record.get("enclosure_id")
    enclosure_size = _record_enclosure_size(context, record)
    played = player.setdefault("played_animals", [])
    played_entry = next((item for item in played if _card_id(item) == animal_id), None)
    if played_entry is None:
        raise ValueError("released animal is not in the zoo")
    played.remove(played_entry)

    records = player.get("animal_records", [])
    if isinstance(records, MutableMapping):
        key = next((key for key, value in records.items() if value is record), None)
        if key is not None:
            del records[key]
    elif isinstance(records, list):
        records.remove(record)

    # Released cards leave the zoo and game; they never return to hand/deck.
    player.setdefault("released_animals", []).append({
        "card_id": animal_id,
        "project_id": project_id,
        "enclosure_id": enclosure_id,
        "enclosure_size": enclosure_size,
    })
    events = [
        _add(context, "appeal", -int(card.get("printed_rewards", {}).get("appeal", 0)), source=f"project:{project_id}:release")
    ]

    tags = player.get("tags")
    if isinstance(tags, MutableMapping):
        for icon in card.get("icons", []):
            tag = str(icon["tag"])
            tags[tag] = max(0, int(tags.get(tag, 0)) - int(icon.get("count", 1)))

    tucked = player.setdefault("tucked_cards", {}).pop(animal_id, [])
    if tucked:
        _discard(context, tucked)

    building = _building_by_id(context, enclosure_id)
    if building is not None:
        animal_ids = building.get("occupied_by", building.get("animal_ids"))
        if isinstance(animal_ids, list):
            remaining = [value for value in animal_ids if _card_id(value) != animal_id]
            if "occupied_by" in building:
                building["occupied_by"] = remaining
            else:
                building["animal_ids"] = remaining
            building["occupied"] = bool(remaining)
        elif building.get("animal_id") == animal_id:
            building["animal_id"] = None
            building["occupied"] = False
        else:
            building["occupied"] = False
        capacity_key = "used_capacity" if "used_capacity" in building else "capacity_used"
        capacity_used = building.get(capacity_key)
        if isinstance(capacity_used, int):
            used = int(record.get("capacity_used", record.get("animal_size", card.get("animal_size", 0))))
            building[capacity_key] = max(0, capacity_used - used)
    events.append(
        _event(
            "animal_released",
            context.player_id,
            card_id=animal_id,
            project_id=project_id,
            printed_appeal_lost=int(card.get("printed_rewards", {}).get("appeal", 0)),
            enclosure_id=enclosure_id,
            enclosure_size=enclosure_size,
            tucked_cards_discarded=[_card_id(value) for value in tucked],
        )
    )
    return events


def evaluate_conservation_project(
    card_id: str,
    context: EffectContext,
    player_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Return currently eligible slots and candidates for one project."""

    card_id = str(card_id)
    project = PROJECT_BY_ID.get(card_id)
    if project is None:
        raise ValueError(f"unknown conservation project: {card_id}")
    if player_id is not None and player_id != context.player_id:
        context = EffectContext(context.state, player_id, card_id, context.timing, context.action, context.target_player_id, dict(context.metadata))
    occupied = _occupied_project_positions(context, card_id)
    slots = []
    for slot in project["support_slots"]:
        position = int(slot["position"])
        requirement = slot["requirement"]
        if position in occupied:
            eligible = False
            candidates: List[str] = []
            value = 0
        elif requirement["kind"] == "metric_count":
            value = _metric(context, str(requirement["metric"]))
            candidates = []
            eligible = value >= int(requirement["value"])
        elif requirement["kind"] == "released_animal_enclosure_size":
            candidates = _release_candidates(context, project, int(requirement["value"]))
            value = int(requirement["value"]) if candidates else 0
            eligible = bool(candidates)
        elif requirement["kind"] == "breeding_match":
            candidates = _breeding_candidates(context, project)
            value = len(candidates)
            eligible = bool(candidates)
        else:
            raise ValueError(f"unknown conservation requirement: {requirement['kind']}")
        slots.append({
            "position": position,
            "eligible": eligible,
            "occupied": position in occupied,
            "metric_value": value,
            "candidate_animal_ids": candidates,
            "requirement": dict(requirement),
            "reward": dict(slot["reward"]),
        })
    return {
        "card_id": card_id,
        "project_type": project["project_type"],
        "metric": project["metric"],
        "eligible": any(slot["eligible"] for slot in slots),
        "eligible_slots": [slot["position"] for slot in slots if slot["eligible"]],
        "slots": slots,
    }


def support_conservation_project(
    card_id: str,
    context: EffectContext,
    slot_position: Optional[int] = None,
    animal_id: Optional[str] = None,
    choice: Optional[Mapping[str, Any]] = None,
) -> EffectResult:
    """Validate and apply one support marker, including release/breeding rules."""

    evaluation = evaluate_conservation_project(card_id, context)
    if not evaluation["eligible"]:
        raise ValueError("no eligible support slot")
    selected_slot = slot_position or _choice_value(choice, "slot_position")
    if selected_slot is None:
        return _pending(context, f"project:{card_id}", "choose_project_slot", "选择保育项目奖励槽", [{"id": str(position), "slot_position": position} for position in evaluation["eligible_slots"]])
    slot = next((entry for entry in evaluation["slots"] if entry["position"] == int(selected_slot)), None)
    if not slot or not slot["eligible"]:
        raise ValueError("ineligible project support slot")
    project = PROJECT_BY_ID[str(card_id)]
    chosen_animal = animal_id or _choice_value(choice, "animal_id")
    if project["project_type"] in {"release", "breeding"}:
        candidates = slot["candidate_animal_ids"]
        if chosen_animal is None:
            return _pending(context, f"project:{card_id}:{selected_slot}", "choose_project_animal", "选择用于该保育项目的动物", [{"id": cid, "card_id": cid} for cid in candidates])
        if str(chosen_animal) not in candidates:
            raise ValueError("animal is not eligible for this project")
    events: List[Dict[str, Any]] = []
    if project["project_type"] == "release" and chosen_animal is not None:
        events.extend(_release_animal(context, str(chosen_animal), str(card_id)))
    rewards = dict(slot["reward"])
    projects = context.state.setdefault("projects", [])
    project_was_new = str(card_id) not in {_card_id(value) for value in projects}
    if project_was_new:
        projects.append(str(card_id))
        for key, amount in project.get("new_project_bonus", {}).items():
            rewards[key] = int(rewards.get(key, 0)) + int(amount)
    if project["project_type"] == "release" and "224" in _played_ids(context, key="played_sponsors"):
        rewards["conservation"] = int(rewards.get("conservation", 0)) + 1
    reward_result = _grant(context, f"project:{card_id}", **rewards)
    events.extend(reward_result.events)
    supported = _player(context).setdefault("supported_projects", [])
    supported.append({"card_id": str(card_id), "position": int(selected_slot)})
    slots = context.state.setdefault("project_slots", {}).setdefault(str(card_id), {})
    if isinstance(slots, MutableMapping):
        slots[str(selected_slot)] = context.player_id
    elif isinstance(slots, list):
        slots.append({"position": int(selected_slot), "player_id": context.player_id})
    events.append(_event("project_supported", context.player_id, card_id=str(card_id), position=int(selected_slot), reward=rewards))
    return EffectResult(events=events)


CONSERVATION_PROJECT_REGISTRY: Dict[str, Callable[..., Dict[str, Any]]] = {
    card_id: evaluate_conservation_project for card_id in PROJECT_BY_ID
}


def _map_condition(context: EffectContext, condition_id: str, player_id: Optional[str] = None) -> bool:
    player = _player(context, player_id)
    map_state = player.get("map", {})
    if isinstance(map_state, Mapping):
        conditions = map_state.get("conditions", {})
        if isinstance(conditions, Mapping) and condition_id in conditions:
            return bool(conditions[condition_id])
        if condition_id in map_state:
            return bool(map_state[condition_id])
    metrics = player.get("metrics", {})
    if isinstance(metrics, Mapping) and condition_id in metrics:
        return bool(metrics[condition_id])
    occupancy = map_state.get("occupancy", {}) if isinstance(map_state, Mapping) else {}
    covered = set(occupancy) if isinstance(occupancy, Mapping) else set()
    if condition_id == "all_buildable_spaces_covered":
        return all(not cell.get("buildable") or cell["id"] in covered for cell in MAP0["cells"])
    if condition_id == "all_buildable_border_spaces_covered":
        return all(not (cell.get("buildable") and cell.get("border")) or cell["id"] in covered for cell in MAP0["cells"])
    if condition_id in {"all_water_spaces_connected", "all_rock_spaces_connected"}:
        terrain = "water" if "water" in condition_id else "rock"
        return all(
            any(neighbor in covered for neighbor in cell.get("neighbors", []))
            for cell in MAP0["cells"]
            if cell.get("terrain") == terrain
        )
    return False


def score_final_card(card_id: str, context: EffectContext, player_id: Optional[str] = None) -> int:
    """Calculate (without mutating) one final scoring card's conservation."""

    card_id = str(card_id).zfill(3)
    card = FINAL_BY_ID.get(card_id)
    if card is None:
        raise ValueError(f"unknown final scoring card: {card_id}")
    pid = player_id or context.player_id
    rule = card["scoring_rule"]
    kind = rule["kind"]
    if kind == "metric_ladder":
        value = _metric(context, str(rule["metric"]), pid)
        return max((int(step["reward"]["conservation"]) for step in card["scoring_steps"] if value >= int(step["requirement"])), default=0)
    if kind == "independent_conditions":
        return sum(int(condition["reward"]["conservation"]) for condition in rule["conditions"] if _map_condition(context, str(condition["id"]), pid))
    if kind == "compare_right_hand_neighbor":
        order = list(context.state.get("turn_order") or _players(context.state))
        if pid not in order or len(order) < 2:
            return 0
        neighbor_id = context.metadata.get("right_hand_player_id")
        if neighbor_id not in _players(context.state):
            neighbor_id = order[(order.index(pid) + 1) % len(order)]
        wins = sum(_metric(context, metric, pid) > _metric(context, metric, str(neighbor_id)) for metric in rule["metrics"])
        return min(int(rule["maximum_conservation"]), wins * int(rule["reward_per_won_metric"]["conservation"]))
    raise ValueError(f"unknown final scoring rule: {kind}")


def apply_final_card(card_id: str, context: EffectContext, player_id: Optional[str] = None) -> EffectResult:
    pid = player_id or context.player_id
    amount = score_final_card(card_id, context, pid)
    return _grant(context, f"final:{str(card_id).zfill(3)}", pid, conservation=amount)


FINAL_SCORING_REGISTRY: Dict[str, Callable[..., int]] = {
    card_id: score_final_card for card_id in FINAL_BY_ID
}


def get_action_rule(action_id: str, side: str, strength: int) -> Dict[str, Any]:
    """Return an immutable-by-copy executable action-card face description."""

    if action_id not in ACTION_CARD_REGISTRY:
        raise ValueError(f"unknown action card: {action_id}")
    side = side.upper()
    if side not in {"I", "II"}:
        raise ValueError("action side must be I or II")
    if int(strength) not in range(1, 6):
        raise ValueError("action strength must be between 1 and 5")
    card = ACTION_CARD_REGISTRY[action_id]
    face = json.loads(json.dumps(card["sides"][side]))
    face.update({"action_id": action_id, "side": side, "strength": int(strength)})
    return face


def execute_card_effects(
    card_id: str,
    context: EffectContext,
    timing: Optional[str] = None,
    choice: Optional[Mapping[str, Any]] = None,
    include_printed_rewards: bool = True,
) -> EffectResult:
    """Execute the matching effects of any animal or sponsor card.

    When an effect requests input, execution stops at that effect.  Resume by
    dispatching its stable ``effect_ref`` with the player's choice.
    """

    card_id = str(card_id)
    wanted = timing or context.timing
    results: List[EffectResult] = []
    if include_printed_rewards and wanted == "immediate":
        results.append(apply_printed_rewards(card_id, context))
    if card_id in ANIMAL_BY_ID:
        for ability in ANIMAL_BY_ID[card_id].get("abilities", []):
            if ability["timing"] == wanted:
                results.append(execute_ability(ability["ability"], context, ability.get("parameters", {}), choice))
                if results[-1].pending_choice:
                    break
    elif card_id in SPONSOR_BY_ID:
        for index, effect in enumerate(SPONSOR_BY_ID[card_id].get("effects", [])):
            effect_timing = effect["timing"]
            should_execute = effect_timing == wanted or (
                wanted == "immediate" and effect_timing in {"passive", "setup_and_passive"}
            ) or (wanted == "passive" and effect_timing == "setup_and_passive")
            if should_execute:
                results.append(execute_sponsor_effect(card_id, index, context, choice))
                if results[-1].pending_choice:
                    break
    else:
        raise ValueError(f"unknown animal/sponsor card: {card_id}")
    return _combine(results)


def dispatch_effect(
    effect_ref: Any,
    context: EffectContext,
    choice: Optional[Mapping[str, Any]] = None,
) -> EffectResult:
    """Dispatch a stable string/dict effect reference without game imports."""

    if isinstance(effect_ref, Mapping):
        effect_type = effect_ref.get("type")
        if effect_type == "ability":
            return execute_ability(str(effect_ref["ability_id"]), context, effect_ref.get("params"), choice)
        if effect_type == "sponsor":
            return execute_sponsor_effect(str(effect_ref["card_id"]), effect_ref.get("effect_id", effect_ref.get("effect_index", 0)), context, choice)
        if effect_type == "project":
            return support_conservation_project(str(effect_ref["card_id"]), context, choice=choice)
        if effect_type == "final":
            return apply_final_card(str(effect_ref["card_id"]), context)
        raise ValueError(f"unknown effect reference type: {effect_type}")
    value = str(effect_ref)
    if value.startswith("ability:"):
        return execute_ability(value.split(":", 1)[1], context, choice=choice)
    if value in ABILITY_REGISTRY:
        return execute_ability(value, context, choice=choice)
    if value in SPONSOR_EFFECT_REGISTRY:
        card_id = value.split("-", 1)[0]
        return execute_sponsor_effect(card_id, value, context, choice)
    if value.startswith("project:"):
        return support_conservation_project(value.split(":", 1)[1], context, choice=choice)
    if value.startswith("final:"):
        return apply_final_card(value.split(":", 1)[1], context)
    raise ValueError(f"unknown effect reference: {effect_ref}")


def validate_registry_coverage(strict: bool = True) -> Dict[str, Any]:
    """Validate executable coverage against every source-data identity."""

    catalog_abilities = set(ABILITY_CATALOG)
    animal_uses = {ability["ability"] for card in ANIMAL_CARDS for ability in card.get("abilities", [])}
    sponsor_effects = {effect["id"] for card in SPONSOR_CARDS for effect in card.get("effects", [])}
    expected_projects = set(PROJECT_BY_ID)
    expected_finals = set(FINAL_BY_ID)
    expected_actions = set(ACTION_CARD_REGISTRY)
    missing = {
        "abilities": sorted(catalog_abilities - set(ABILITY_REGISTRY)),
        "used_abilities": sorted(animal_uses - set(ABILITY_REGISTRY)),
        "sponsor_effects": sorted(sponsor_effects - set(SPONSOR_EFFECT_REGISTRY)),
        "projects": sorted(expected_projects - set(CONSERVATION_PROJECT_REGISTRY)),
        "final_scoring": sorted(expected_finals - set(FINAL_SCORING_REGISTRY)),
        "action_cards": sorted(expected_actions - set(ACTION_CARD_REGISTRY)),
    }
    extra = {
        "abilities": sorted(set(ABILITY_REGISTRY) - catalog_abilities),
        "sponsor_effects": sorted(set(SPONSOR_EFFECT_REGISTRY) - sponsor_effects),
        "projects": sorted(set(CONSERVATION_PROJECT_REGISTRY) - expected_projects),
        "final_scoring": sorted(set(FINAL_SCORING_REGISTRY) - expected_finals),
    }
    report = {
        "counts": {
            "abilities": len(ABILITY_REGISTRY),
            "animal_cards": len(ANIMAL_CARDS),
            "animal_ability_instances": sum(len(card.get("abilities", [])) for card in ANIMAL_CARDS),
            "sponsor_cards": len(SPONSOR_CARDS),
            "sponsor_effects": len(SPONSOR_EFFECT_REGISTRY),
            "conservation_projects": len(CONSERVATION_PROJECT_REGISTRY),
            "final_scoring_cards": len(FINAL_SCORING_REGISTRY),
            "action_cards": len(ACTION_CARD_REGISTRY),
        },
        "missing": missing,
        "extra": extra,
        "complete": not any(missing.values()) and not any(extra.values()),
    }
    if strict and not report["complete"]:
        raise AssertionError(f"Ark Nova effect registry coverage mismatch: {report}")
    return report


__all__ = [
    "ABILITY_REGISTRY",
    "ACTION_CARD_REGISTRY",
    "CONSERVATION_PROJECT_REGISTRY",
    "EffectContext",
    "EffectResult",
    "FINAL_SCORING_REGISTRY",
    "PendingChoice",
    "SPONSOR_EFFECT_REGISTRY",
    "apply_final_card",
    "apply_printed_rewards",
    "dispatch_effect",
    "evaluate_conservation_project",
    "execute_ability",
    "execute_card_effects",
    "execute_sponsor_effect",
    "get_action_rule",
    "score_final_card",
    "support_conservation_project",
    "validate_registry_coverage",
]
