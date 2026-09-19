from __future__ import annotations

import copy
import json
import random
from collections import Counter
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Set, Tuple


ASSET_DIR = Path(__file__).resolve().parent / "assets" / "ark_nova"


class _VenomUndo(ValueError):
    """The entire turn must be undone when its final Venom fee cannot be paid."""


def _load_json(name: str) -> Any:
    return json.loads((ASSET_DIR / name).read_text(encoding="utf-8"))


CARD_DATA: Dict[str, Any] = _load_json("cards.json")
MAP0: Dict[str, Any] = _load_json("map0.json")
ACTION_DEFS: Dict[str, Dict[str, Any]] = {
    item["id"]: item for item in CARD_DATA["action_cards"]
}
ANIMAL_CARDS: Dict[str, Dict[str, Any]] = {
    item["id"]: item for item in CARD_DATA["animal_cards"]
}
SPONSOR_CARDS: Dict[str, Dict[str, Any]] = {
    item["id"]: item for item in CARD_DATA["sponsor_cards"]
}
PROJECT_CARDS: Dict[str, Dict[str, Any]] = {
    item["id"]: item for item in CARD_DATA["conservation_projects"]
}
FINAL_CARDS: Dict[str, Dict[str, Any]] = {
    item["id"]: item for item in CARD_DATA["final_scoring_cards"]
}
ZOO_CARDS: Dict[str, Dict[str, Any]] = {
    **ANIMAL_CARDS,
    **SPONSOR_CARDS,
    **{
        card_id: card
        for card_id, card in PROJECT_CARDS.items()
        if card.get("deck_group") == "zoo_deck"
    },
}
MAP_CELLS: Dict[str, Dict[str, Any]] = {item["id"]: item for item in MAP0["cells"]}
MAP_REWARDS: Dict[str, Dict[str, Any]] = {
    item["id"]: item for item in MAP0["conservation_rewards"]
}

ACTION_IDS = ("cards", "build", "animals", "association", "sponsors")
CONTINENTS = ("africa", "americas", "asia", "australia", "europe")
ANIMAL_CATEGORIES = (
    "bird", "herbivore", "predator", "primate", "reptile", "bear", "petting_zoo_animal",
)
REPEATED_PASSIVE_EFFECT_TAGS = {
    "210-printed-1": "americas",
    "211-printed-1": "europe",
    "212-printed-1": "australia",
    "213-printed-1": "asia",
    "214-printed-1": "africa",
    "249-printed-1": "bird",
    "250-printed-1": "reptile",
    "252-printed-1": "predator",
}
BREAK_LIMITS = {2: 15, 3: 12, 4: 10}
DONATION_COSTS = (2, 5, 7, 10, 12)
MAX_APPEAL = 113
MAX_CONSERVATION = 41
MAX_REPUTATION = 15
MAX_X_TOKENS = 5
ARK_NOVA_SCHEMA_VERSION = 3
BUILDING_SIZES = {
    "kiosk": 1,
    "pavilion": 1,
    "petting_zoo": 3,
    "reptile_house": 5,
    "large_bird_aviary": 5,
}
# Axial polyhexes are normalized around the printed anchor and may rotate, but
# never reflect. These shapes match the base-game enclosure pieces.
BUILDING_FOOTPRINTS: Dict[str, Set[Tuple[int, int]]] = {
    "standard_enclosure_1": {(0, 0)},
    "standard_enclosure_2": {(0, 0), (1, 0)},
    "standard_enclosure_3": {(0, 0), (1, 0), (0, 1)},
    "standard_enclosure_4": {(0, 0), (1, 0), (0, 1), (1, 1)},
    "standard_enclosure_5": {(0, 0), (1, 0), (2, 0), (0, 1), (1, 1)},
    "petting_zoo": {(0, 0), (0, -1), (1, -2)},
    "reptile_house": {(0, 0), (0, -1), (1, -1), (2, -2), (2, -1)},
    "large_bird_aviary": {(0, 0), (0, -1), (1, -2), (1, -1), (2, -1)},
}
SPECIAL_ENCLOSURES = {"petting_zoo", "reptile_house", "large_bird_aviary"}
BUILDING_SUPPLY = {
    "standard_enclosure_1": 28,
    "standard_enclosure_2": 24,
    "standard_enclosure_3": 15,
    "standard_enclosure_4": 13,
    "standard_enclosure_5": 10,
    "kiosk": 34,
    "pavilion": 34,
}
UNIVERSITIES = (
    {"id": "university_science", "name": "Research university", "science": 2},
    {"id": "university_reputation", "name": "Reputation university", "science": 1, "reputation": 2},
    {"id": "university_hand_limit", "name": "Hand-limit university", "reputation": 1, "hand_limit": 5},
)
BONUS_TOKEN_DEFS: Dict[str, Dict[str, Any]] = {
    "reputation_2": {"label": "Gain 2 reputation", "kind": "reputation", "amount": 2},
    "money_10": {"label": "Gain 10 money", "kind": "money", "amount": 10},
    "enclosure_3": {"label": "Build a free size-3 enclosure", "kind": "free_enclosure", "size": 3},
    "multiplier": {"label": "Gain an Action multiplier", "kind": "multiplier", "amount": 1},
    "x_tokens_3": {"label": "Gain 3 X-tokens", "kind": "x_token", "amount": 3},
    "card_2": {"label": "Draw 2 cards", "kind": "card", "amount": 2},
    "worker": {"label": "Activate an association worker", "kind": "worker", "amount": 1},
    "appeal_5": {"label": "Gain 5 appeal", "kind": "appeal", "amount": 5},
    "upgrade": {"label": "Upgrade an Action card", "kind": "upgrade"},
}


def _canonical_donation_slots(player_count: int) -> List[Dict[str, Any]]:
    slots = [
        {"id": "donation-2", "cost": 2, "occupied_by": None, "blocked": False},
        *[
            {"id": f"donation-{cost}-{column}", "cost": cost, "occupied_by": None, "blocked": False}
            for cost in (5, 7, 10) for column in ("left", "right")
        ],
    ]
    if player_count == 2:
        for slot in slots:
            if slot["id"].endswith("-left"):
                slot["blocked"] = True
    return slots


def _migrate_state_in_place(state: MutableMapping[str, Any]) -> None:
    """Bring saved Ark Nova rooms forward without changing earned rewards."""

    forced = state.get("forced_action")
    if isinstance(forced, MutableMapping):
        if forced.get("player_id") != state.get("current_player"):
            state.pop("forced_action", None)
        elif not forced.get("from_multiplier"):
            forced.setdefault("optional", True)
    player_count = len(state.get("turn_order", [])) or len(state.get("players", {}))
    association_supply = state.setdefault("association_supply", {})
    current_slots = association_supply.get("donation_slots", [])
    canonical_slots = _canonical_donation_slots(player_count)
    canonical_ids = [slot["id"] for slot in canonical_slots]
    current_ids = [str(slot.get("id", "")) for slot in current_slots if isinstance(slot, Mapping)]

    if current_ids == canonical_ids:
        occupied_by_id = {
            str(slot.get("id")): slot.get("occupied_by")
            for slot in current_slots if isinstance(slot, Mapping)
        }
        for slot in canonical_slots:
            slot["occupied_by"] = occupied_by_id.get(slot["id"])
    else:
        # Early saves incorrectly contained two 2-money spaces. Preserve the
        # number/order of donations already made, then fit them into the
        # actual board's usable spaces. Any overflow has already paid and
        # scored; a full canonical board correctly makes later donations 12.
        occupants = [
            slot.get("occupied_by")
            for slot in sorted(
                (slot for slot in current_slots if isinstance(slot, Mapping)),
                key=lambda slot: int(slot.get("cost", 99)),
            )
            if slot.get("occupied_by") is not None
        ]
        available_slots = [slot for slot in canonical_slots if not slot["blocked"]]
        for slot, occupant in zip(available_slots, occupants):
            slot["occupied_by"] = occupant
    association_supply["donation_slots"] = canonical_slots

    for player in state.get("players", {}).values():
        if not isinstance(player, MutableMapping):
            continue
        player.setdefault("reputation_milestones_resolved", [])
        zoo_map = player.get("map", {})
        if "claimed_bonuses" in zoo_map:
            zoo_map["claimed_bonuses"] = [
                cell_id for cell_id in zoo_map["claimed_bonuses"]
                if cell_id in zoo_map.get("occupancy", {})
            ]
        player.setdefault(
            "conservation_markers_remaining",
            max(0, 7 - len(player.get("claimed_map_rewards", []))),
        )

    # Assertion/Dominance draw from a separate pile of unused base projects.
    # Early saves did not persist that pile, which allowed the same project to
    # be taken by more than one player while the first copy was still in hand.
    base_project_ids = {
        card_id for card_id, card in PROJECT_CARDS.items()
        if card.get("deck_group") == "base_setup"
    }
    used_base_projects = {
        str(card_id) for card_id in state.get("projects", [])
        if str(card_id) in base_project_ids
    }
    used_base_projects.update(
        str(card_id)
        for player in state.get("players", {}).values()
        if isinstance(player, Mapping)
        for card_id in player.get("hand", [])
        if str(card_id) in base_project_ids
    )
    used_base_projects.update(
        str(card_id) for card_id in state.get("discard", [])
        if str(card_id) in base_project_ids
    )
    current_unused = state.get("unused_base_projects")
    if isinstance(current_unused, list):
        seen: Set[str] = set()
        migrated_unused = []
        for raw_card_id in current_unused:
            card_id = str(raw_card_id)
            if (
                card_id not in base_project_ids
                or card_id in used_base_projects
                or card_id in seen
            ):
                continue
            seen.add(card_id)
            migrated_unused.append(card_id)
        state["unused_base_projects"] = migrated_unused
    else:
        state["unused_base_projects"] = sorted(base_project_ids - used_base_projects)
    state["schema_version"] = ARK_NOVA_SCHEMA_VERSION


def _event(kind: str, **payload: Any) -> Dict[str, Any]:
    return {"type": f"ark_nova:{kind}", "payload": payload}


def _ordered_player_ids(state: Mapping[str, Any]) -> List[str]:
    return list(state.get("turn_order", []))


def _player(state: MutableMapping[str, Any], player_id: str) -> MutableMapping[str, Any]:
    return state["players"][player_id]


def _clamp(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, int(value)))


def _full_card(card_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if card_id is None:
        return None
    card = ZOO_CARDS.get(str(card_id)) or PROJECT_CARDS.get(str(card_id)) or FINAL_CARDS.get(str(card_id))
    return copy.deepcopy(card) if card else None


def _draw(state: MutableMapping[str, Any]) -> Optional[str]:
    deck = state["deck"]
    if not deck:
        discard = state.get("discard", [])
        if not discard:
            return None
        # The initial seed is stored so re-shuffles remain deterministic after persistence.
        counter = int(state.get("reshuffle_count", 0)) + 1
        state["reshuffle_count"] = counter
        rng = random.Random(f"{state.get('rng_seed')}:{counter}")
        deck.extend(discard)
        discard.clear()
        rng.shuffle(deck)
    return deck.pop()


def _refill_display(state: MutableMapping[str, Any]) -> None:
    compact = [card_id for card_id in state.get("display", []) if card_id]
    while len(compact) < 6:
        card_id = _draw(state)
        if card_id is None:
            break
        compact.append(card_id)
    state["display"] = compact + [None] * (6 - len(compact))


def _remove_display_card(state: MutableMapping[str, Any], card_id: str) -> int:
    matches = [idx for idx, value in enumerate(state["display"]) if value == card_id]
    if len(matches) != 1:
        raise ValueError("card is not uniquely present in display")
    index = matches[0]
    state["display"][index] = None
    state["display_dirty"] = True
    return index


def _display_range(player: Mapping[str, Any]) -> int:
    # The printed Reputation track is not divided into equal two-space bands:
    # folders 1-6 begin at reputation 0, 2, 4, 7, 10, and 13.
    reputation = _clamp(int(player.get("reputation", 0)), 0, MAX_REPUTATION)
    folder_starts = (0, 2, 4, 7, 10, 13)
    return next(
        folder for folder, minimum in reversed(tuple(enumerate(folder_starts, start=1)))
        if reputation >= minimum
    )


def _display_accessible(state: Mapping[str, Any], player_id: str, card_id: str) -> bool:
    try:
        index = list(state["display"]).index(card_id)
    except ValueError:
        return False
    return index < _display_range(state["players"][player_id])


def _card_icons(card: Mapping[str, Any]) -> Counter:
    return Counter({item["tag"]: int(item.get("count", 1)) for item in card.get("icons", [])})


def _card_zoo_icons(card: Mapping[str, Any]) -> Counter:
    """Icons contributed by a card, including printed water/rock requirements."""

    icons = _card_icons(card)
    adjacency = card.get("placement", {}).get("adjacent_to", {})
    if card.get("unique_building"):
        adjacency = card.get("unique_building", {}).get("placement", {}).get("adjacent_to", {})
    for terrain in ("water", "rock"):
        icons[terrain] += int(adjacency.get(terrain, 0))
    return icons


def _recompute_tags(player: MutableMapping[str, Any]) -> None:
    tags: Counter = Counter()
    for card_id in player.get("played_animals", []):
        card = ANIMAL_CARDS.get(card_id)
        if card:
            tags.update(_card_zoo_icons(card))
    for card_id in player.get("played_sponsors", []):
        card = SPONSOR_CARDS.get(card_id)
        if card:
            tags.update(_card_zoo_icons(card))
    for continent in player.get("partner_zoos", []):
        tags[continent] += 1
    for university_id in player.get("universities", []):
        university = next((item for item in UNIVERSITIES if item["id"] == university_id), None)
        if university:
            tags["science"] += int(university.get("science", 0))
    player["tags"] = dict(tags)


def _track_value(player: Mapping[str, Any], track: str) -> int:
    aliases = {"appeal": "appeal", "reputation": "reputation", "conservation": "conservation"}
    return int(player.get(aliases.get(track, track), 0))


def _condition_met(player: Mapping[str, Any], condition: Mapping[str, Any]) -> bool:
    kind = condition.get("kind")
    if kind == "tag_count":
        return int(player.get("tags", {}).get(condition.get("tag"), 0)) >= int(condition.get("minimum", 0))
    if kind == "partner_zoo":
        return len(player.get("partner_zoos", [])) >= int(condition.get("minimum", 1))
    if kind == "action_upgrade":
        action_id = str(condition.get("action", ""))
        return (
            action_id in player.get("action_cards", {})
            and _action_level(player, action_id) >= int(condition.get("minimum_level", 2))
        )
    if kind == "track_threshold":
        actual = _track_value(player, str(condition.get("track")))
        expected = int(condition.get("value", 0))
        operator = condition.get("operator")
        return actual >= expected if operator == ">=" else actual <= expected if operator == "<=" else actual == expected
    return False


def _active_rules(player: Mapping[str, Any], rule_name: str) -> List[Mapping[str, Any]]:
    """Return registered passive rules without coupling core to effect ids."""

    active = player.get("active_effects", {})
    if not isinstance(active, Mapping):
        return []
    return [
        rule for rule in active.values()
        if isinstance(rule, Mapping)
        and (rule.get("modifier") == rule_name or rule.get("type") == rule_name)
    ]


def _has_active_rule(player: Mapping[str, Any], rule_name: str) -> bool:
    return bool(_active_rules(player, rule_name))


def _animal_size_class(card: Mapping[str, Any]) -> str:
    option_types = {str(option.get("type")) for option in card.get("enclosure_options", [])}
    if "petting_zoo" in option_types:
        return "small"
    size = int(card.get("animal_size", 0) or 0)
    if not size:
        standard = next(
            (option for option in card.get("enclosure_options", []) if option.get("type") == "standard"),
            {},
        )
        size = int(standard.get("required_spaces", 0) or 0)
    if size in (1, 2):
        return "small"
    if size in (4, 5):
        return "large"
    return "medium"


def _printed_standard_enclosure_size(card: Mapping[str, Any]) -> int:
    """Return the enclosure size printed for the card's standard option."""

    option = next(
        (item for item in card.get("enclosure_options", []) if item.get("type") == "standard"),
        None,
    )
    return int(option.get("required_spaces", 0)) if option else 0


def _card_conditions_met(
    player: Mapping[str, Any], card: Mapping[str, Any], *, ignore_count: int = 0
) -> bool:
    failed = 0
    for condition in card.get("play", {}).get("conditions", []):
        if _condition_met(player, condition):
            continue
        if condition.get("kind") == "tag_count":
            failed += max(0, int(condition.get("minimum", 0)) - int(
                player.get("tags", {}).get(condition.get("tag"), 0)
            ))
        else:
            failed += 1
    return failed <= max(0, int(ignore_count))


def _action_slot(player: Mapping[str, Any], action_id: str) -> int:
    return int(player["action_cards"][action_id]["slot"])


def _action_level(player: Mapping[str, Any], action_id: str) -> int:
    override = player.get("_action_level_overrides", {})
    if isinstance(override, Mapping) and action_id in override:
        return int(override[action_id])
    return 2 if player["action_cards"][action_id].get("upgraded") else 1


def _action_strength(
    state: Mapping[str, Any], player_id: str, action_id: str, x_tokens: int
) -> int:
    forced = state.get("forced_action")
    if isinstance(forced, Mapping) and forced.get("player_id") == player_id and forced.get("action") == action_id:
        owner_id = str(forced.get("action_card_owner", player_id))
        owner = state["players"].get(owner_id, state["players"][player_id])
        entry = owner["action_cards"][action_id]
        base = int(forced.get("strength") or _action_slot(owner, action_id))
        strength = base + (x_tokens if forced.get("allow_x_alternative", False) else 0)
    else:
        entry = state["players"][player_id]["action_cards"][action_id]
        strength = _action_slot(state["players"][player_id], action_id) + x_tokens
    if int(entry.get("constriction_tokens", 0)):
        strength -= 2
    return strength


def _validate_x_tokens(player: Mapping[str, Any], value: Any) -> Tuple[Optional[int], Optional[str]]:
    if value is None:
        return 0, None
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        return None, "invalid X-token count"
    if value > int(player.get("x_tokens", 0)):
        return None, "not enough X-tokens"
    return value, None


def _validate_multiplier_tokens(
    action: Mapping[str, Any], available: int,
) -> Tuple[Optional[int], Optional[str]]:
    value = action.get("use_multiplier_tokens", action.get("use_multiplier"))
    if value is None:
        return 0, None
    if isinstance(value, bool):
        value = available if value else 0
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= available:
        return None, "invalid Multiplier token count"
    return value, None


def _use_action_card(player: MutableMapping[str, Any], action_id: str) -> int:
    old_slot = _action_slot(player, action_id)
    for other_id, card in player["action_cards"].items():
        if other_id != action_id and int(card["slot"]) < old_slot:
            card["slot"] = int(card["slot"]) + 1
    player["action_cards"][action_id]["slot"] = 1
    return old_slot


def _apply_rewards(
    state: MutableMapping[str, Any],
    player_id: str,
    rewards: Mapping[str, Any],
    events: List[Dict[str, Any]],
    source: str,
) -> None:
    player = _player(state, player_id)
    for key, maximum in (("appeal", MAX_APPEAL), ("conservation", MAX_CONSERVATION), ("reputation", MAX_REPUTATION)):
        amount = int(rewards.get(key, 0) or 0)
        if not amount:
            continue
        old_value = int(player.get(key, 0))
        raw_value = old_value + amount
        overflow_appeal = 0
        if key == "reputation" and amount > 0:
            # The Reputation track stops at 9 until Cards has been upgraded.
            # Once the player can reach 15, every excess reputation becomes
            # appeal instead of being lost.
            reputation_cap = MAX_REPUTATION if _action_level(player, "cards") == 2 else 9
            player[key] = _clamp(raw_value, 0, reputation_cap)
            if reputation_cap == MAX_REPUTATION:
                overflow_appeal = max(0, raw_value - MAX_REPUTATION)
        else:
            player[key] = _clamp(raw_value, 0, maximum)
        events.append(_event("track", player_id=player_id, track=key, amount=player[key] - old_value, source=source))
        if overflow_appeal:
            old_appeal = int(player.get("appeal", 0))
            player["appeal"] = _clamp(old_appeal + overflow_appeal, 0, MAX_APPEAL)
            events.append(_event(
                "track", player_id=player_id, track="appeal",
                amount=int(player["appeal"]) - old_appeal, source=f"{source}:reputation_overflow",
            ))
        if key == "reputation" and player[key] > old_value:
            _queue_reputation_milestones(
                state, player_id, old_value, int(player[key]), events,
            )
        if key == "conservation" and player[key] > old_value:
            _queue_conservation_milestones(state, player_id, old_value, int(player[key]))


def _gain_x(player: MutableMapping[str, Any], amount: int) -> int:
    old = int(player.get("x_tokens", 0))
    player["x_tokens"] = _clamp(old + int(amount), 0, MAX_X_TOKENS)
    return int(player["x_tokens"]) - old


def _target_appeal(conservation: int) -> int:
    cp = _clamp(conservation, 0, MAX_CONSERVATION)
    target = 114 - 2 * min(cp, 10) - 3 * max(0, cp - 10)
    return max(1, target)


def _appeal_income(appeal: int) -> int:
    # The printed Appeal track uses six income bands at each step size: six
    # single spaces, then six groups of 2, 3, 4, and 5 spaces, followed by
    # four groups of 6 spaces through the end of the track.
    appeal = _clamp(appeal, 0, MAX_APPEAL)
    if appeal <= 5:
        return 5 + appeal
    if appeal <= 17:
        return 11 + (appeal - 6) // 2
    if appeal <= 35:
        return 17 + (appeal - 18) // 3
    if appeal <= 59:
        return 23 + (appeal - 36) // 4
    if appeal <= 89:
        return 29 + (appeal - 60) // 5
    return 35 + (appeal - 90) // 6


def _new_player_state(seat: int, rng: random.Random) -> Dict[str, Any]:
    other_actions = [action_id for action_id in ACTION_IDS if action_id != "animals"]
    rng.shuffle(other_actions)
    action_cards = {"animals": {"slot": 1, "upgraded": False}}
    for slot, action_id in enumerate(other_actions, start=2):
        action_cards[action_id] = {"slot": slot, "upgraded": False}
    return {
        "money": 25,
        "appeal": seat,
        "conservation": 0,
        "reputation": 0,
        "x_tokens": 0,
        "hand": [],
        "final_cards": [],
        "played_animals": [],
        "animal_records": [],
        "played_sponsors": [],
        "supported_projects": [],
        "conservation_markers_remaining": 7,
        "claimed_map_rewards": [],
        "action_cards": action_cards,
        "map": {"id": "map0", "buildings": [], "occupancy": {}, "claimed_bonuses": [], "completed": False},
        "building_supply": {
            "petting_zoo": 1,
            "reptile_house": 1,
            "large_bird_aviary": 1,
        },
        "association_workers_total": 1,
        "available_workers": 1,
        "association_worker_placements": [],
        "partner_zoos": [],
        "universities": [],
        "hand_limit": 3,
        "tags": {},
        "active_effects": {},
        "card_tokens": {},
        "final_card_discarded": False,
        "milestones_resolved": [],
        "reputation_milestones_resolved": [],
    }


def _queue_choice(state: MutableMapping[str, Any], choice: Mapping[str, Any]) -> None:
    normalized = copy.deepcopy(dict(choice))
    state.setdefault("pending_queue", []).append(normalized)
    _activate_next_choice(state)


def _activate_next_choice(state: MutableMapping[str, Any]) -> None:
    if state.get("pending_choice") is not None:
        return
    queue = state.setdefault("pending_queue", [])
    if queue:
        state["pending_choice"] = queue.pop(0)
        state["phase"] = "pending_choice"


def _choice_options(values: Iterable[Any], labels: Optional[Mapping[Any, str]] = None) -> List[Dict[str, Any]]:
    return [
        {"value": value, "label": (labels or {}).get(value, str(value))}
        for value in values
    ]


def _queue_conservation_milestones(
    state: MutableMapping[str, Any], player_id: str, old_value: int, new_value: int
) -> None:
    player = _player(state, player_id)
    resolved = set(player.get("milestones_resolved", []))
    if old_value < 2 <= new_value and 2 not in resolved:
        choices = [action_id for action_id in ACTION_IDS if not player["action_cards"][action_id]["upgraded"]]
        options = [{"value": {"kind": "upgrade", "action": value}, "label": f"Upgrade {value.title()}"} for value in choices]
        if int(player.get("association_workers_total", 1)) < 4:
            options.append({"value": {"kind": "worker"}, "label": "Activate an association worker"})
        if options:
            _queue_choice(state, {
                "choice_id": f"cp2-{player_id}", "type": "conservation_2", "player_id": player_id,
                "prompt": "Choose the 2-conservation reward", "options": options, "min": 1, "max": 1,
            })
        resolved.add(2)
    for threshold in (5, 8):
        if old_value < threshold <= new_value and threshold not in resolved:
            token_options = [
                {
                    "value": {"kind": "token", "token_id": token_id},
                    "label": BONUS_TOKEN_DEFS[token_id]["label"],
                }
                for token_id in state.get("bonus_tokens", {}).get(str(threshold), [])
                if not (
                    BONUS_TOKEN_DEFS[token_id]["kind"] == "worker"
                    and int(player.get("association_workers_total", 1)) >= 4
                )
                and not (
                    BONUS_TOKEN_DEFS[token_id]["kind"] == "upgrade"
                    and all(player["action_cards"][action_id].get("upgraded") for action_id in ACTION_IDS)
                )
            ]
            _queue_choice(state, {
                "choice_id": f"cp{threshold}-{player_id}", "type": "conservation_bonus", "player_id": player_id,
                "threshold": threshold, "prompt": f"Choose the {threshold}-conservation reward",
                "options": [{"value": {"kind": "money", "amount": 5}, "label": "Gain 5 money"}] + token_options,
                "min": 1, "max": 1,
            })
            resolved.add(threshold)
    if old_value < 10 <= new_value and not state.get("final_card_gate_reached"):
        state["final_card_gate_reached"] = True
        for pid in _ordered_player_ids(state):
            pdata = _player(state, pid)
            if len(pdata.get("final_cards", [])) > 1 and not pdata.get("final_card_discarded"):
                _queue_choice(state, {
                    "choice_id": f"final-card-{pid}", "type": "discard_final_card", "player_id": pid,
                    "prompt": "Discard one Final Scoring card", "options": _choice_options(pdata["final_cards"]),
                    "min": 1, "max": 1,
                })
    player["milestones_resolved"] = sorted(resolved)


def _queue_reputation_milestones(
    state: MutableMapping[str, Any], player_id: str, old_value: int, new_value: int,
    events: List[Dict[str, Any]],
) -> None:
    """Resolve the one-time bonuses printed beside the Reputation track."""

    player = _player(state, player_id)
    resolved = {int(value) for value in player.get("reputation_milestones_resolved", [])}
    crossed = [
        threshold for threshold in (5, 8, 11, 12, 13, 14, 15)
        if old_value < threshold <= new_value and threshold not in resolved
    ]
    for threshold in crossed:
        if threshold == 5:
            available = [
                action_id for action_id in ACTION_IDS
                if not player["action_cards"][action_id].get("upgraded")
            ]
            if available:
                _queue_choice(state, {
                    "choice_id": f"reputation-5-upgrade-{player_id}",
                    "type": "upgrade_action", "player_id": player_id,
                    "prompt": "Upgrade an Action card for reaching 5 reputation",
                    "options": _choice_options(available), "min": 1, "max": 1,
                })
        elif threshold == 8:
            old_workers = int(player.get("association_workers_total", 1))
            player["association_workers_total"] = min(4, old_workers + 1)
            player["available_workers"] = int(player.get("available_workers", 0)) + (
                int(player["association_workers_total"]) - old_workers
            )
        elif threshold in {11, 14}:
            _apply_rewards(
                state, player_id, {"conservation": 1}, events,
                f"reputation_milestone:{threshold}",
            )
        elif threshold in {12, 15}:
            gained = _gain_x(player, 1)
            events.append(_event(
                "gain_x", player_id=player_id, amount=gained,
                source=f"reputation_milestone:{threshold}",
            ))
        elif threshold == 13:
            available_cards = [card_id for card_id in state.get("display", []) if card_id]
            if available_cards:
                _queue_choice(state, {
                    "choice_id": f"reputation-13-snap-{player_id}",
                    "type": "reputation_snap", "player_id": player_id,
                    "prompt": "Take any card from the display for reaching 13 reputation",
                    "options": _choice_options(
                        available_cards,
                        {
                            card_id: f"{card_id} · {ZOO_CARDS.get(card_id, {}).get('name', {}).get('en', card_id)}"
                            for card_id in available_cards
                        },
                    ),
                    "min": 1, "max": 1,
                })
        resolved.add(threshold)
        events.append(_event(
            "reputation_milestone", player_id=player_id, threshold=threshold,
        ))
    player["reputation_milestones_resolved"] = sorted(resolved)


def _cells_connected(cell_ids: Sequence[str]) -> bool:
    cells = set(cell_ids)
    if not cells:
        return False
    seen: Set[str] = set()
    pending = [next(iter(cells))]
    while pending:
        cell_id = pending.pop()
        if cell_id in seen:
            continue
        seen.add(cell_id)
        pending.extend(
            neighbor for neighbor in MAP_CELLS[cell_id]["neighbors"]
            if neighbor in cells and neighbor not in seen
        )
    return seen == cells


def _rotate_axial(cell: Tuple[int, int]) -> Tuple[int, int]:
    q, r = cell
    return -r, q + r


def _axial_distance(first: Tuple[int, int], second: Tuple[int, int]) -> int:
    dq = first[0] - second[0]
    dr = first[1] - second[1]
    return (abs(dq) + abs(dr) + abs(dq + dr)) // 2


def _rotate_shape(shape: Iterable[Tuple[int, int]], steps: int) -> Set[Tuple[int, int]]:
    result = set(shape)
    for _ in range(steps % 6):
        result = {_rotate_axial(cell) for cell in result}
    return result


def _matches_footprint(cell_ids: Sequence[str], footprint: Iterable[Tuple[int, int]]) -> bool:
    selected = {
        (int(MAP_CELLS[cell_id]["axial"]["q"]), int(MAP_CELLS[cell_id]["axial"]["r"]))
        for cell_id in cell_ids
    }
    base = set(footprint)
    if len(selected) != len(base):
        return False
    for steps in range(6):
        rotated = _rotate_shape(base, steps)
        for selected_anchor in selected:
            for base_anchor in rotated:
                dq = selected_anchor[0] - base_anchor[0]
                dr = selected_anchor[1] - base_anchor[1]
                translated = {(q + dq, r + dr) for q, r in rotated}
                if translated == selected:
                    return True
    return False


def _touches_border(cell_ids: Sequence[str]) -> bool:
    return any(bool(MAP_CELLS[cell_id].get("border")) for cell_id in cell_ids)


def _touches_building(occupancy: Mapping[str, str], cell_ids: Sequence[str]) -> bool:
    own = set(cell_ids)
    return any(
        neighbor in occupancy and neighbor not in own
        for cell_id in cell_ids
        for neighbor in MAP_CELLS[cell_id]["neighbors"]
    )


def _adjacent_terrain(cell_ids: Sequence[str], terrain: str) -> int:
    own = set(cell_ids)
    neighbors = {
        neighbor
        for cell_id in cell_ids
        for neighbor in MAP_CELLS[cell_id]["neighbors"]
        if neighbor not in own and MAP_CELLS[neighbor].get("terrain") == terrain
    }
    return len(neighbors)


def _border_space_count(cell_ids: Sequence[str]) -> int:
    return sum(1 for cell_id in cell_ids if MAP_CELLS[cell_id].get("border"))


def _building_size(spec: Mapping[str, Any]) -> int:
    building_type = str(spec.get("building_type", ""))
    if building_type == "standard_enclosure":
        value = spec.get("size", len(spec.get("cells", [])))
        return int(value) if isinstance(value, int) and not isinstance(value, bool) else -1
    return int(BUILDING_SIZES.get(building_type, len(spec.get("cells", []))))


def _building_supply_key(building_type: str, size: int) -> Optional[str]:
    if building_type == "standard_enclosure":
        return f"standard_enclosure_{size}"
    if building_type in ("kiosk", "pavilion"):
        return building_type
    return None


def _validate_building_placement(
    state: Mapping[str, Any],
    player_id: str,
    spec: Mapping[str, Any],
    *,
    free: bool = False,
    unique: Optional[Mapping[str, Any]] = None,
) -> Optional[str]:
    player = state["players"][player_id]
    zoo_map = player["map"]
    building_type = str(spec.get("building_type", ""))
    cell_ids = spec.get("cells")
    if not isinstance(cell_ids, list) or not cell_ids or not all(isinstance(value, str) for value in cell_ids):
        return "invalid building cells"
    if len(set(cell_ids)) != len(cell_ids):
        return "duplicate building cell"
    if any(cell_id not in MAP_CELLS for cell_id in cell_ids):
        return "unknown map cell"
    may_cover_terrain = _has_active_rule(player, "ignore_water_rock_rules")
    if any(
        not MAP_CELLS[cell_id].get("buildable")
        and not (may_cover_terrain and MAP_CELLS[cell_id].get("terrain") in {"water", "rock"})
        for cell_id in cell_ids
    ):
        return "building must use buildable land"
    if any(cell_id in zoo_map["occupancy"] for cell_id in cell_ids):
        return "map cell occupied"
    if not _cells_connected(cell_ids):
        return "building cells must be connected"

    size = _building_size(spec)
    if size != len(cell_ids) or size < 1:
        return "building size does not match its cells"
    if building_type == "standard_enclosure" and size not in range(1, 6):
        return "standard enclosure size must be 1-5"
    if building_type in BUILDING_SIZES and BUILDING_SIZES[building_type] != size:
        return "incorrect building size"
    if building_type not in {"standard_enclosure", *BUILDING_SIZES} and unique is None:
        return "unknown building type"

    if unique:
        raw_shape = {
            (int(cell["q"]), int(cell["r"]))
            for cell in unique.get("footprint", {}).get("cells", [])
        }
        if not raw_shape or not _matches_footprint(cell_ids, raw_shape):
            return "unique building cells do not match its footprint"
    else:
        footprint_key = f"standard_enclosure_{size}" if building_type == "standard_enclosure" else building_type
        footprint = BUILDING_FOOTPRINTS.get(footprint_key)
        if footprint and not _matches_footprint(cell_ids, footprint):
            return "building cells do not match the component footprint"

    if any(MAP_CELLS[cell_id].get("build_requirement") == "build_action_upgraded" for cell_id in cell_ids):
        if not player["action_cards"]["build"].get("upgraded"):
            return "Build II is required for a marked space"

    placement_rules = (unique or {}).get("placement", {})
    ignore_adjacency = bool(placement_rules.get("may_ignore_existing_building_adjacency"))
    if zoo_map["buildings"]:
        if not ignore_adjacency and not _touches_building(zoo_map["occupancy"], cell_ids):
            return "new building must be adjacent to an existing building"
    elif not _touches_border(cell_ids):
        return "first building must touch the map border"

    if building_type == "kiosk":
        kiosk_cells = {
            cell_id
            for building in zoo_map["buildings"] if building["building_type"] == "kiosk"
            for cell_id in building["cells"]
        }
        if any(
            _axial_distance(
                (int(MAP_CELLS[cell_id]["axial"]["q"]), int(MAP_CELLS[cell_id]["axial"]["r"])),
                (int(MAP_CELLS[kiosk_id]["axial"]["q"]), int(MAP_CELLS[kiosk_id]["axial"]["r"])),
            ) < 3
            for cell_id in cell_ids
            for kiosk_id in kiosk_cells
        ):
            return "kiosks must be at least three spaces apart"

    if unique:
        footprint = unique.get("footprint", {})
        if int(footprint.get("cell_count", size)) != size:
            return "unique building footprint size mismatch"
        adjacent = placement_rules.get("adjacent_to", {})
        if not may_cover_terrain:
            for terrain in ("water", "rock"):
                if _adjacent_terrain(cell_ids, terrain) < int(adjacent.get(terrain, 0)):
                    return f"unique building needs more adjacent {terrain}"
        if _border_space_count(cell_ids) < int(placement_rules.get("minimum_border_spaces", 0)):
            return "unique building needs more border spaces"

    # Standard enclosures, kiosks, and pavilions are not a gameplay limit.
    # The rulebook explicitly permits a substitute if the shared component
    # supply runs out.  The three special enclosures remain limited to one of
    # each per zoo and are therefore checked against the player's supply.
    if building_type in SPECIAL_ENCLOSURES and int(player.get("building_supply", {}).get(building_type, 0)) <= 0:
        return "special enclosure already built"
    reservations = [item for item in state.get("pending_unique_buildings", [])
                    if item["player_id"] == player_id and item["building_type"] != building_type]
    if reservations:
        trial = copy.deepcopy(state)
        trial["pending_unique_buildings"] = reservations
        trial_map = trial["players"][player_id]["map"]
        trial_map["occupancy"].update({cell_id: "reserved-build" for cell_id in cell_ids})
        trial_map["buildings"].append({"id": "reserved-build", "building_type": building_type, "cells": cell_ids})
        # Validating this reserved building recursively checks the remaining
        # reservations, so nested sponsor chains must fit together on the map.
        reservation = reservations[0]
        reserved_unique = SPONSOR_CARDS[reservation["card_id"]]["unique_building"]
        placement = reservation.get("placement")
        if placement:
            unavailable = _validate_building_placement(trial, player_id, {
                "building_type": reserved_unique["id"], "cells": placement["cells"],
            }, free=True, unique=reserved_unique)
        else:
            unavailable = _find_placement(trial, player_id, reserved_unique["id"],
                                          int(reserved_unique["footprint"]["cell_count"]), reserved_unique) is None
        if unavailable:
            return "leave a legal placement for the pending unique building"
    return None


def _apply_placement_bonus(
    state: MutableMapping[str, Any], player_id: str, cell_id: str, events: List[Dict[str, Any]],
    *, allow_archaeologist: bool = True, copy_bonus: bool = False,
) -> None:
    player = _player(state, player_id)
    zoo_map = player["map"]
    if not copy_bonus and cell_id in zoo_map["claimed_bonuses"]:
        return
    bonus = MAP_CELLS[cell_id].get("placement_bonus")
    if not bonus:
        return
    if not copy_bonus:
        zoo_map["claimed_bonuses"].append(cell_id)
    bonus_type = bonus.get("type")
    amount = int(bonus.get("amount", 1))
    if bonus_type == "money":
        player["money"] += amount
    elif bonus_type == "x_token":
        _gain_x(player, amount)
    elif bonus_type == "appeal":
        _apply_rewards(state, player_id, {"appeal": amount}, events, f"map:{cell_id}")
    elif bonus_type == "card":
        # Map 0's card icon is a choice, not a blind top-deck draw: the player
        # may take from the deck or from any display folder in reputation range.
        for index in range(amount):
            _queue_take_card_choice(state, player_id, f"map-{cell_id}-{index + 1}")
    elif bonus_type == "action_to_slot":
        options = sorted(player["action_cards"], key=lambda value: _action_slot(player, value))
        queue = "effect_queue" if state.get("resolving_break") else "after_action_core_effects"
        state.setdefault(queue, []).append({
            "type": "core", "operation": "choice", "player_id": player_id,
            "label": "Map bonus: move an Action card to slot 1",
            "choice": {
                "choice_id": f"map-slot-{player_id}-{cell_id}", "type": "action_to_slot", "player_id": player_id,
                "prompt": "Move an Action card to slot 1", "options": _choice_options(options), "min": 1, "max": 1,
            },
        })
    events.append(_event("placement_bonus", player_id=player_id, cell_id=cell_id, bonus=copy.deepcopy(bonus)))
    if (
        allow_archaeologist
        and MAP_CELLS[cell_id].get("border")
        and _has_active_rule(player, "duplicate_border_placement_bonus")
    ):
        available = [
            other_id for other_id, other in MAP_CELLS.items()
            if other.get("placement_bonus") and other_id not in zoo_map["occupancy"]
        ]
        if available:
            _queue_choice(state, {
                "choice_id": f"archaeologist-{player_id}-{cell_id}-{len(state.get('pending_queue', []))}",
                "type": "claim_placement_bonus", "player_id": player_id,
                "prompt": "Choose an additional uncovered placement bonus",
                "options": _choice_options(available), "min": 1, "max": 1,
            })


def _queue_unique_follow_up(
    state: MutableMapping[str, Any], player_id: str, card_id: Optional[str]
) -> None:
    if str(card_id or "") != "254":
        return
    key = f"{player_id}:254:take_card"
    resolved = state.setdefault("resolved_follow_ups", [])
    if key in resolved:
        return
    resolved.append(key)
    _queue_take_card_choice(state, player_id, "zoo-school")


def _place_building(
    state: MutableMapping[str, Any],
    player_id: str,
    spec: Mapping[str, Any],
    events: List[Dict[str, Any]],
    *,
    free: bool = False,
    unique: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    error = _validate_building_placement(state, player_id, spec, free=free, unique=unique)
    if error:
        raise ValueError(error)
    player = _player(state, player_id)
    zoo_map = player["map"]
    building_type = str(spec["building_type"])
    cells = list(spec["cells"])
    size = _building_size(spec)
    building_id = str(spec.get("building_id") or f"{building_type}-{len(zoo_map['buildings']) + 1}")
    if any(item["id"] == building_id for item in zoo_map["buildings"]):
        raise ValueError("duplicate building id")
    capacity = size if building_type in SPECIAL_ENCLOSURES else (size if building_type == "standard_enclosure" else 0)
    building = {
        "id": building_id,
        "building_type": building_type,
        "size": size,
        "cells": cells,
        "capacity": capacity,
        "used_capacity": 0,
        "occupied_by": [],
        "unique_card_id": str(spec.get("unique_card_id")) if spec.get("unique_card_id") else None,
    }
    zoo_map["buildings"].append(building)
    if unique:
        state["pending_unique_buildings"] = [
            item for item in state.get("pending_unique_buildings", [])
            if not (item["player_id"] == player_id and item["building_type"] == building_type)
        ]
    for cell_id in cells:
        zoo_map["occupancy"][cell_id] = building_id
    if building_type in SPECIAL_ENCLOSURES:
        player["building_supply"][building_type] -= 1
    if building_type == "pavilion":
        _apply_rewards(state, player_id, {"appeal": 1}, events, "pavilion")
    placement_refs = []
    for cell_id in cells:
        if state.get("choose_effect_order") and MAP_CELLS[cell_id].get("placement_bonus"):
            placement_refs.append({"type": "core", "operation": "placement_bonus", "player_id": player_id,
                                   "cell_id": cell_id, "label": f"Map bonus: {cell_id}"})
        else:
            _apply_placement_bonus(state, player_id, cell_id, events)
    terrain_refs: List[Dict[str, Any]] = []
    for cell_id in cells:
        for terrain in ("water", "rock"):
            if any(
                MAP_CELLS[neighbor].get("terrain") == terrain
                and neighbor not in zoo_map["occupancy"]
                for neighbor in MAP_CELLS[cell_id]["neighbors"]
            ):
                for sponsor_id in player.get("played_sponsors", []):
                    terrain_refs.extend(_sponsor_effect_refs(
                        player_id, SPONSOR_CARDS[sponsor_id], "passive",
                        {"trigger": "hex_covered_adjacent_to", "terrain": terrain},
                    ))
    if state.get("choose_effect_order"):
        state.setdefault("effect_queue", []).append(_effect_group(player_id, placement_refs + terrain_refs))
    else:
        state.setdefault("effect_queue", []).extend(terrain_refs)
    if building_type in {"reptile_house", "large_bird_aviary"}:
        state["effect_queue"].append({"type": "core", "operation": "move_animals",
                                      "player_id": player_id, "building_id": building_id, "moved": []})
    _queue_unique_follow_up(state, player_id, building.get("unique_card_id"))
    buildable_land = {cell_id for cell_id, cell in MAP_CELLS.items() if cell.get("buildable")}
    if buildable_land.issubset(zoo_map["occupancy"]) and not zoo_map.get("completed"):
        zoo_map["completed"] = True
        _apply_rewards(state, player_id, MAP0["completion_bonus"], events, "map_completion")
    _update_derived_metrics(player)
    events.append(_event("build", player_id=player_id, building=copy.deepcopy(building), free=free))
    return building


def _animal_enclosures(player: Mapping[str, Any]) -> List[Mapping[str, Any]]:
    buildings = list(player["map"].get("buildings", []))
    if any(_card_icons(ANIMAL_CARDS.get(card_id, {})).get("herbivore") for card_id in player.get("played_animals", [])):
        buildings.append({"id": "flock", "building_type": "flock", "size": 0, "cells": [],
                          "capacity": 0, "used_capacity": 0, "occupied_by": []})
    return buildings


def _enclosure_for_animal(
    player: Mapping[str, Any], card: Mapping[str, Any], enclosure_id: str
) -> Tuple[Optional[Mapping[str, Any]], Optional[Mapping[str, Any]], Optional[str]]:
    building = next((item for item in _animal_enclosures(player) if item["id"] == enclosure_id), None)
    if not building:
        return None, None, "unknown enclosure"
    building_type = building["building_type"]
    occupants = list(building.get("occupied_by", []))
    flock = next(
        (ability for ability in card.get("abilities", []) if ability.get("ability") == "flock_animal"),
        None,
    )
    if (occupants or _building_occupied(building) or enclosure_id == "flock") and flock:
        minimum_host = int((flock or {}).get("parameters", {}).get("minimum_host_enclosure_size", 99))
        eligible_host = any(
            _card_icons(ANIMAL_CARDS.get(host_id, {})).get("herbivore", 0)
            and _printed_standard_enclosure_size(ANIMAL_CARDS.get(host_id, {})) >= minimum_host
            for host_id in player.get("played_animals", [])
        )
        if eligible_host:
            return building, {"type": "flock_share", "required_spaces": 0, "shared_enclosure": True}, None
    option_type = "standard" if building_type == "standard_enclosure" else building_type
    options = [item for item in card.get("enclosure_options", []) if item.get("type") == option_type]
    if not options:
        return building, None, "animal cannot use that enclosure type"
    option = options[0]
    required = int(option.get("required_spaces", 0))
    if building_type == "standard_enclosure":
        if _building_occupied(building):
            return building, option, "standard enclosure is occupied"
        if int(building.get("size", 0)) < required:
            return building, option, "standard enclosure is too small"
    elif int(building.get("used_capacity", 0)) + required > int(building.get("capacity", 0)):
        return building, option, "special enclosure has insufficient capacity"
    if not _has_active_rule(player, "ignore_water_rock_rules"):
        adjacency = card.get("placement", {}).get("adjacent_to", {})
        for terrain in ("water", "rock"):
            if _adjacent_terrain(building["cells"], terrain) < int(adjacency.get(terrain, 0)):
                return building, option, f"enclosure needs more adjacent {terrain}"
    return building, option, None


def _animal_cost(player: Mapping[str, Any], card: Mapping[str, Any]) -> int:
    cost = int(card.get("play", {}).get("base_money_cost", 0))
    icons = _card_icons(card)
    for continent in player.get("partner_zoos", []):
        cost -= 3 * int(icons.get(continent, 0))
    size_class = _animal_size_class(card)
    for rule in _active_rules(player, "animal_discount"):
        if rule.get("size") == size_class:
            cost -= int(rule.get("money", 0))
    return max(0, cost)


def _metric_count(player: Mapping[str, Any], metric: str) -> int:
    tags = player.get("tags", {})
    if metric == "any_animal_category":
        return sum(1 for tag in ANIMAL_CATEGORIES if int(tags.get(tag, 0)) > 0)
    if metric == "any_continent":
        return sum(1 for tag in CONTINENTS if int(tags.get(tag, 0)) > 0)
    if metric in {"water", "rock"}:
        return int(tags.get(metric, 0))
    if metric == "small_animal":
        return sum(
            _animal_size_class(ANIMAL_CARDS[card_id]) == "small"
            for card_id in player.get("played_animals", [])
            if card_id in ANIMAL_CARDS
        )
    if metric == "large_animal":
        return sum(
            _animal_size_class(ANIMAL_CARDS[card_id]) == "large"
            for card_id in player.get("played_animals", [])
            if card_id in ANIMAL_CARDS
        )
    return int(tags.get(metric, 0))


def _project_slot_blocked(state: Mapping[str, Any], project_id: str, position: int) -> bool:
    return any(
        item.get("project_id") == project_id and int(item.get("position", 0)) == position
        for item in state.get("blocked_project_slots", [])
    )


def _occupied_project_positions(state: Mapping[str, Any], project_id: str) -> Set[int]:
    return {int(item["position"]) for item in state.get("project_slots", {}).get(project_id, [])}


def _release_requirement_matches_printed_size(
    requirement: Mapping[str, Any], printed_size: int,
) -> bool:
    minimum = int(requirement.get("minimum", requirement.get("value", 0)))
    maximum = int(requirement.get("maximum", requirement.get("value", minimum)))
    return minimum <= printed_size <= maximum


def _project_requirement_met(
    state: Mapping[str, Any], player_id: str, project: Mapping[str, Any], slot: Mapping[str, Any],
    release_animal_id: Optional[str] = None, wild_icons: int = 0,
) -> bool:
    player = state["players"][player_id]
    requirement = slot.get("requirement", {})
    kind = requirement.get("kind")
    if kind == "metric_count":
        return _metric_count(player, str(requirement.get("metric"))) + int(wild_icons) >= int(requirement.get("value", 0))
    if kind == "released_animal_enclosure_size":
        if not release_animal_id:
            return False
        record = next((item for item in player.get("animal_records", []) if item["card_id"] == release_animal_id), None)
        if not record:
            return False
        card = ANIMAL_CARDS[release_animal_id]
        tag = project.get("release_rules", {}).get("animal_must_have_tag")
        printed_size = int(
            record.get("printed_enclosure_size", _printed_standard_enclosure_size(card))
        )
        return (
            _release_requirement_matches_printed_size(requirement, printed_size)
            and int(_card_icons(card).get(tag, 0)) > 0
        )
    if kind == "breeding_match":
        rules = project.get("breeding_rules") or {}
        tag = rules.get("animal_must_have_tag")
        for card_id in player.get("played_animals", []):
            icons = _card_icons(ANIMAL_CARDS[card_id])
            if not icons.get(tag):
                continue
            if any(icons.get(continent) and continent in player.get("partner_zoos", []) for continent in CONTINENTS):
                return True
        return False
    return False


def _enclosure_label(building: Mapping[str, Any]) -> str:
    kind = building.get("building_type", building.get("type"))
    name = {"standard_enclosure": f"{building.get('size', 0)} 格围栏", "reptile_house": "爬行馆",
            "large_bird_aviary": "大型鸟类馆", "petting_zoo": "萌宠馆", "flock": "群集（无需新围栏）"}.get(kind, str(kind))
    cells = " ".join(building.get("cells", []))
    return f"{name} ({cells})" if cells else name


def _building_occupied(building: Mapping[str, Any]) -> bool:
    return bool(building.get("occupied", building.get("occupied_by", [])))


def _standard_enclosures_to_empty(player: Mapping[str, Any], card: Mapping[str, Any]) -> List[Mapping[str, Any]]:
    required = _printed_standard_enclosure_size(card)
    if not required:
        return []
    sized = [building for building in player["map"].get("buildings", [])
             if building.get("building_type", building.get("type")) == "standard_enclosure"
             and _building_occupied(building) and int(building.get("size", 0)) >= required]
    adjacency = card.get("placement", {}).get("adjacent_to", {})
    fitting = [building for building in sized if _has_active_rule(player, "ignore_water_rock_rules") or all(
        _adjacent_terrain(building.get("cells", []), terrain) >= int(adjacency.get(terrain, 0))
        for terrain in ("water", "rock")
    )]
    candidates = fitting or sized
    minimum = min((int(building["size"]) for building in candidates), default=0)
    return [building for building in candidates if int(building["size"]) == minimum]


def _release_enclosure_options(player: Mapping[str, Any], card: Mapping[str, Any]) -> List[Mapping[str, Any]]:
    options = []
    for building in player["map"].get("buildings", []):
        kind = building.get("building_type", building.get("type"))
        option = next((item for item in card.get("enclosure_options", []) if item["type"] == kind), None)
        if kind in SPECIAL_ENCLOSURES and option and int(building.get("used_capacity", 0)) >= int(option["required_spaces"]):
            options.append(building)
    return options or list(_standard_enclosures_to_empty(player, card))


def _empty_animal_space(
    player: MutableMapping[str, Any], card: Mapping[str, Any], enclosure_id: str, *, release: bool = True,
) -> None:
    options = _release_enclosure_options(player, card) if release else _standard_enclosures_to_empty(player, card)
    building = next((item for item in options if item["id"] == enclosure_id), None)
    if building is None:
        raise ValueError("choose a smallest eligible occupied enclosure or available special-enclosure tokens")
    kind = building.get("building_type", building.get("type"))
    if kind == "standard_enclosure":
        building["occupied"] = False
        building["occupied_by"] = []
        building["used_capacity"] = 0
        records = player.get("animal_records", [])
        for record in (records.values() if isinstance(records, Mapping) else records):
            if record.get("enclosure_id") == enclosure_id:
                record["enclosure_id"] = None
    else:
        option = next(item for item in card["enclosure_options"] if item["type"] == kind)
        building["used_capacity"] -= int(option["required_spaces"])


def _detach_animal_record(player: MutableMapping[str, Any], card_id: str) -> None:
    # Standard tiles represent occupied space, not a permanent assignment of a
    # particular animal. Releasing/moving an animal does not empty its old tile.
    for building in player["map"].get("buildings", []):
        if building.get("building_type", building.get("type")) == "standard_enclosure":
            building.setdefault("occupied", bool(building.get("occupied_by")))
        if card_id in building.get("occupied_by", []):
            building["occupied_by"].remove(card_id)


def _migration_options(state: Mapping[str, Any], ref: Mapping[str, Any]) -> List[Dict[str, Any]]:
    player = state["players"][str(ref["player_id"])]
    target = next(item for item in player["map"]["buildings"] if item["id"] == ref["building_id"])
    options = []
    for card_id in player.get("played_animals", []):
        if card_id in ref.get("moved", []):
            continue
        card = ANIMAL_CARDS[card_id]
        option = next((item for item in card.get("enclosure_options", []) if item["type"] == target["building_type"]), None)
        if not option or int(target.get("used_capacity", 0)) + int(option["required_spaces"]) > int(target["capacity"]):
            continue
        if not _has_active_rule(player, "ignore_water_rock_rules") and any(
            _adjacent_terrain(target["cells"], terrain) < int(card.get("placement", {}).get("adjacent_to", {}).get(terrain, 0))
            for terrain in ("water", "rock")
        ):
            continue
        for enclosure in _standard_enclosures_to_empty(player, card) or [None]:
            enclosure_id = enclosure["id"] if enclosure else None
            options.append({
                "value": {"card_id": card_id, "enclosure_id": enclosure_id},
                "label": str(card['name']['zh']),
                "detail": f"迁入{_enclosure_label(target)}" + (f"；腾空{_enclosure_label(enclosure)}" if enclosure else ""),
            })
    return options


def _move_animal(state: MutableMapping[str, Any], ref: Mapping[str, Any], value: Mapping[str, Any], events: List[Dict[str, Any]]) -> None:
    if value not in [item["value"] for item in _migration_options(state, ref)]:
        raise ValueError("animal cannot move to this new special enclosure")
    player_id = str(ref["player_id"])
    player = _player(state, player_id)
    card_id = str(value["card_id"])
    card = ANIMAL_CARDS[card_id]
    _detach_animal_record(player, card_id)
    if value.get("enclosure_id"):
        _empty_animal_space(player, card, str(value["enclosure_id"]), release=False)
    target = next(item for item in player["map"]["buildings"] if item["id"] == ref["building_id"])
    option = next(item for item in card["enclosure_options"] if item["type"] == target["building_type"])
    required = int(option["required_spaces"])
    target["used_capacity"] += required
    target["occupied_by"].append(card_id)
    record = next(item for item in player["animal_records"] if item["card_id"] == card_id)
    record.update({"enclosure_id": target["id"], "enclosure_type": target["building_type"],
                   "enclosure_size": target["size"], "capacity_used": required})
    _update_derived_metrics(player)
    events.append(_event("animal_moved", player_id=player_id, card_id=card_id,
                         enclosure_id=target["id"], emptied_enclosure_id=value.get("enclosure_id")))
    next_ref = copy.deepcopy(dict(ref))
    next_ref.setdefault("moved", []).append(card_id)
    state.setdefault("effect_queue", []).insert(0, next_ref)


def _remove_released_animal(
    state: MutableMapping[str, Any], player_id: str, card_id: str, events: List[Dict[str, Any]]
) -> None:
    player = _player(state, player_id)
    record = next((item for item in player["animal_records"] if item["card_id"] == card_id), None)
    if not record:
        raise ValueError("release animal is not in zoo")
    card = ANIMAL_CARDS[card_id]
    options = _release_enclosure_options(player, card)
    _detach_animal_record(player, card_id)
    if len(options) == 1:
        _empty_animal_space(player, card, str(options[0]["id"]))
    elif options:
        _queue_choice(state, {
            "choice_id": f"release-enclosure-{player_id}-{card_id}", "type": "release_enclosure",
            "player_id": player_id, "card_id": card_id,
            "prompt": "Choose the enclosure to empty or special-enclosure tokens to remove",
            "options": [{"value": item["id"], "label": _enclosure_label(item)} for item in options],
            "min": 1, "max": 1,
        })
    player["animal_records"].remove(record)
    player["played_animals"].remove(card_id)
    tucked = player.get("tucked_cards", {}).pop(card_id, [])
    if tucked:
        state["discard"].extend(tucked)
        events.append(_event(
            "tucked_cards_discarded", player_id=player_id, card_id=card_id,
            tucked_card_ids=list(tucked),
        ))
    printed_appeal = int(ANIMAL_CARDS[card_id].get("printed_rewards", {}).get("appeal", 0))
    player["appeal"] = max(0, int(player["appeal"]) - printed_appeal)
    state["discard"].append(card_id)
    _recompute_tags(player)
    _update_derived_metrics(player)
    events.append(_event("release_animal", player_id=player_id, card_id=card_id, appeal_lost=printed_appeal))


def _claim_map_reward(
    state: MutableMapping[str, Any], player_id: str, reward_id: str, events: List[Dict[str, Any]]
) -> None:
    player = _player(state, player_id)
    if reward_id not in MAP_REWARDS:
        raise ValueError("unknown Map 0 conservation reward")
    if reward_id in player["claimed_map_rewards"]:
        raise ValueError("Map 0 conservation reward already claimed")
    if len(player["claimed_map_rewards"]) >= 7:
        raise ValueError("no conservation marker remains")
    reward = MAP_REWARDS[reward_id]
    player["claimed_map_rewards"].append(reward_id)
    player["conservation_markers_remaining"] = 7 - len(player["claimed_map_rewards"])
    reward_type = reward["type"]
    if reward_type == "money":
        player["money"] += int(reward.get("amount", 0))
    elif reward_type == "conservation":
        _apply_rewards(state, player_id, {"conservation": reward.get("amount", 0)}, events, f"map_reward:{reward_id}")
    elif reward_type == "x_token":
        _gain_x(player, int(reward.get("amount", 0)))
    elif reward_type == "association_worker":
        old = int(player["association_workers_total"])
        player["association_workers_total"] = min(4, old + int(reward.get("amount", 1)))
        player["available_workers"] += int(player["association_workers_total"]) - old
    elif reward_type == "card":
        _queue_take_card_choice(state, player_id, f"map-reward-{reward_id}")
    elif reward_type == "free_enclosure":
        size = int(reward.get("size", 2))
        if _find_placement(state, player_id, "standard_enclosure", size) is not None:
            _queue_choice(state, {
                "choice_id": f"free-enclosure-{player_id}-{len(player['claimed_map_rewards'])}",
                "type": "place_free_enclosure", "player_id": player_id, "size": size,
                "prompt": f"Place a free size-{size} enclosure",
                "options": [], "min": 1, "max": 1,
            })
        else:
            events.append(_event(
                "map_reward_no_target", player_id=player_id, reward_id=reward_id,
            ))
    events.append(_event("map_reward", player_id=player_id, reward_id=reward_id))


def _queue_take_card_choice(state: MutableMapping[str, Any], player_id: str, source: str) -> None:
    player = _player(state, player_id)
    accessible = [
        card_id for index, card_id in enumerate(state.get("display", []))
        if card_id and index < _display_range(player)
    ]
    options = [{"value": "deck", "label": "Draw from deck"}]
    options.extend({"value": f"display:{card_id}", "label": str(_full_card(card_id)["name"].get("zh", card_id))} for card_id in accessible)
    _queue_choice(state, {
        "choice_id": f"take-card-{player_id}-{source}-{len(state.get('pending_queue', []))}",
        "type": "take_card", "player_id": player_id, "source": source,
        "prompt": "Take a card from the deck or within reputation range", "options": options,
        "min": 1, "max": 1,
    })


def _normalize_effect_result(result: Any) -> Dict[str, Any]:
    if result is None:
        return {"events": [], "pending_choice": None, "state_updates": {}}
    if is_dataclass(result):
        result = asdict(result)
    if isinstance(result, Mapping):
        return {
            "events": list(result.get("events", [])),
            "pending_choice": result.get("pending_choice"),
            "state_updates": dict(result.get("state_updates", {})),
        }
    return {"events": [], "pending_choice": None, "state_updates": {}}


def _deep_update(target: MutableMapping[str, Any], updates: Mapping[str, Any]) -> None:
    for key, value in updates.items():
        if isinstance(value, Mapping) and isinstance(target.get(key), MutableMapping):
            _deep_update(target[key], value)
        else:
            target[key] = copy.deepcopy(value)


def _attack_family(attack: str) -> str:
    return "pilfering" if str(attack).startswith("pilfering") else str(attack)


def _attack_immune(player: Mapping[str, Any], attack: str) -> bool:
    family = _attack_family(attack)
    return any(family in set(rule.get("attacks", [])) for rule in _active_rules(player, "attack_immunity"))


def _add_action_token(player: MutableMapping[str, Any], token: str, count: int, *, lowest: bool) -> List[str]:
    ordered = sorted(
        player["action_cards"], key=lambda action_id: _action_slot(player, action_id), reverse=not lowest
    )
    affected: List[str] = []
    key = f"{token}_tokens"
    for action_id in ordered:
        if len(affected) >= count:
            break
        entry = player["action_cards"][action_id]
        if int(entry.get(key, 0)):
            continue
        entry[key] = 1
        affected.append(action_id)
    return affected


def _attack_assignments(effect_event: Mapping[str, Any]) -> List[Mapping[str, Any]]:
    return [item for item in effect_event.get("assignments", []) if isinstance(item, Mapping)]


def _selected_attack_target(
    candidates: Sequence[str], assignments: Sequence[Mapping[str, Any]], criterion: Optional[str] = None
) -> Optional[str]:
    for assignment in assignments:
        if criterion and assignment.get("criterion") not in {None, criterion}:
            continue
        target = str(assignment.get("target_player_id", assignment.get("player_id", "")))
        if target in candidates:
            return target
    # A unique legal target needs no tie-breaking input.  When several players
    # tie, however, silently choosing by player id would override the active
    # player's choice.
    return candidates[0] if len(candidates) == 1 else None


def _ranked_attack_targets(
    state: Mapping[str, Any], source_player_id: str, track: str, attack: str, *, minimum: int = 0
) -> List[str]:
    ranked = [source_player_id]
    ranked.extend(
        player_id for player_id in _ordered_player_ids(state)
        if (
            player_id != source_player_id
            and int(state["players"][player_id].get("appeal", 0)) >= 5
            and not _attack_immune(state["players"][player_id], attack)
        )
    )
    if not ranked:
        return []
    top = max(int(state["players"][player_id].get(track, 0)) for player_id in ranked)
    if top < minimum:
        return []
    return [
        player_id for player_id in ranked
        if int(state["players"][player_id].get(track, 0)) == top
    ]


def _queue_pilfer_choice(
    state: MutableMapping[str, Any], attacker_id: str, victim_id: str, criterion: str
) -> None:
    victim = _player(state, victim_id)
    options: List[Dict[str, Any]] = []
    if int(victim.get("money", 0)) >= 5 or not victim.get("hand"):
        options.append({"value": "money", "label": "Give 5 money"})
    if victim.get("hand"):
        options.append({"value": "card", "label": "Give a random hand card"})
    _queue_choice(state, {
        "choice_id": f"pilfer-{attacker_id}-{victim_id}-{criterion}-{len(state.get('pending_queue', []))}",
        "type": "pilfering", "player_id": victim_id, "attacker_id": attacker_id,
        "criterion": criterion, "prompt": "Choose what the pilfering player takes",
        "options": options, "min": 1, "max": 1,
    })


def _consume_attack_event(
    state: MutableMapping[str, Any], effect_event: Mapping[str, Any], events: List[Dict[str, Any]]
) -> None:
    attack = str(effect_event.get("attack", ""))
    source_player_id = str(effect_event.get("player_id", ""))
    if source_player_id not in state.get("players", {}):
        return
    source = _player(state, source_player_id)
    assignments = _attack_assignments(effect_event)
    if attack == "venom":
        amount = int(effect_event.get("parameters", {}).get("tokens_per_target", 1))
        for target_id in _ordered_player_ids(state):
            target = _player(state, target_id)
            if (
                target_id == source_player_id or int(target.get("appeal", 0)) < 5
                or int(target.get("appeal", 0)) <= int(source.get("appeal", 0))
                or _attack_immune(target, attack)
            ):
                continue
            affected = _add_action_token(target, "venom", amount, lowest=True)
            events.append(_event("attack_tokens", player_id=target_id, attack=attack, action_cards=affected))
    elif attack == "constriction":
        for target_id in _ordered_player_ids(state):
            target = _player(state, target_id)
            if target_id == source_player_id or int(target.get("appeal", 0)) < 5 or _attack_immune(target, attack):
                continue
            amount = int(int(target.get("appeal", 0)) > int(source.get("appeal", 0)))
            amount += int(int(target.get("conservation", 0)) > int(source.get("conservation", 0)))
            affected = _add_action_token(target, "constriction", amount, lowest=False)
            if affected:
                events.append(_event("attack_tokens", player_id=target_id, attack=attack, action_cards=affected))
    elif attack == "hypnosis":
        if not assignments:
            events.append(_event(
                "optional_effect_skipped", player_id=source_player_id,
                source="hypnosis",
            ))
            return
        ranked = _ranked_attack_targets(state, source_player_id, "appeal", attack, minimum=5)
        candidates = [player_id for player_id in ranked if player_id != source_player_id]
        if not candidates:
            events.append(_event(
                "effect_no_target", player_id=source_player_id, source="hypnosis",
            ))
            return
        target_id = next(
            (
                str(assignment.get("target_player_id", assignment.get("player_id", "")))
                for assignment in assignments
                if str(assignment.get("target_player_id", assignment.get("player_id", "")))
                in candidates
            ),
            None,
        )
        if target_id is None:
            raise ValueError("choose a zoo tied for the highest appeal for Hypnosis")
        target = _player(state, target_id)
        action_ids = [
            action_id for action_id in ACTION_IDS if _action_slot(target, action_id) <= 3
        ]
        _queue_choice(state, {
            "choice_id": f"hypnosis-{source_player_id}-{target_id}", "type": "hypnosis_action",
            "player_id": source_player_id, "target_player_id": target_id,
            "prompt": "Choose one of the target zoo's Action cards in slots 1-3",
            "options": _choice_options(action_ids), "min": 0, "max": 1,
            "allow_skip": True,
        })
    elif attack in {"pilfering_1", "pilfering_2"}:
        criteria = [("appeal", 5)]
        if attack == "pilfering_2":
            criteria.append(("conservation", 1))
        for criterion, minimum in criteria:
            ranked = _ranked_attack_targets(state, source_player_id, criterion, attack, minimum=minimum)
            candidates = [player_id for player_id in ranked if player_id != source_player_id]
            target_id = _selected_attack_target(candidates, assignments, criterion)
            if not candidates:
                continue
            if target_id is None:
                raise ValueError(f"choose a zoo tied for the highest {criterion} for Pilfering")
            _queue_pilfer_choice(state, source_player_id, target_id, criterion)


def _dispatch_effect(
    state: MutableMapping[str, Any], effect_ref: Mapping[str, Any], choice: Any = None
) -> Dict[str, Any]:
    try:
        from game.ark_nova_effects import EffectContext, dispatch_effect
    except (ImportError, ModuleNotFoundError):
        return {"events": [_event("effect_unavailable", effect_ref=dict(effect_ref))], "pending_choice": None, "state_updates": {}}
    context = EffectContext(
        state=state,
        player_id=str(effect_ref["player_id"]),
        card_id=str(effect_ref["card_id"]),
        timing=str(effect_ref.get("timing", "immediate")),
        action=effect_ref.get("action"),
        target_player_id=effect_ref.get("target_player_id"),
        metadata=copy.deepcopy(effect_ref.get("metadata", {})),
    )
    return _normalize_effect_result(dispatch_effect(dict(effect_ref), context, choice=choice))


def _reposition_action_card(player: MutableMapping[str, Any], action_id: str, target_slot: int) -> None:
    if action_id not in player.get("action_cards", {}) or target_slot not in range(1, 6):
        raise ValueError("invalid Action-card reposition")
    old_slot = _action_slot(player, action_id)
    if old_slot == target_slot:
        return
    for other_id, card in player["action_cards"].items():
        if other_id == action_id:
            continue
        slot = int(card["slot"])
        if target_slot < old_slot and target_slot <= slot < old_slot:
            card["slot"] = slot + 1
        elif target_slot > old_slot and old_slot < slot <= target_slot:
            card["slot"] = slot - 1
    player["action_cards"][action_id]["slot"] = target_slot


def _consume_effect_events(
    state: MutableMapping[str, Any], effect_events: Sequence[Mapping[str, Any]], events: List[Dict[str, Any]]
) -> None:
    for effect_event in effect_events:
        kind = effect_event.get("type")
        player_id = str(effect_event.get("player_id", ""))
        if kind == "track_changed" and player_id in state["players"]:
            player = _player(state, player_id)
            track = effect_event.get("track")
            if track == "conservation":
                new_value = _clamp(int(player.get("conservation", 0)), 0, MAX_CONSERVATION)
                old_value = new_value - int(effect_event.get("amount", 0))
                player["conservation"] = new_value
                _queue_conservation_milestones(state, player_id, old_value, new_value)
            elif track == "appeal":
                player["appeal"] = _clamp(int(player.get("appeal", 0)), 0, MAX_APPEAL)
            elif track == "reputation":
                raw_value = int(player.get("reputation", 0))
                raw_amount = int(effect_event.get("amount", 0))
                old_value = raw_value - raw_amount
                reputation_cap = MAX_REPUTATION if _action_level(player, "cards") == 2 else 9
                player["reputation"] = _clamp(raw_value, 0, reputation_cap)
                overflow = max(0, raw_value - MAX_REPUTATION) if reputation_cap == MAX_REPUTATION else 0
                if overflow:
                    old_appeal = int(player.get("appeal", 0))
                    player["appeal"] = _clamp(old_appeal + overflow, 0, MAX_APPEAL)
                    events.append(_event(
                        "track", player_id=player_id, track="appeal",
                        amount=int(player["appeal"]) - old_appeal,
                        source=f"{effect_event.get('source', 'effect')}:reputation_overflow",
                    ))
                effect_event = {
                    **dict(effect_event),
                    "amount": int(player["reputation"]) - old_value,
                    "value": int(player["reputation"]),
                }
                if int(player["reputation"]) > old_value:
                    _queue_reputation_milestones(
                        state, player_id, old_value, int(player["reputation"]), events,
                    )
        elif kind == "action_reposition_requested" and player_id in state["players"]:
            _reposition_action_card(_player(state, player_id), str(effect_event.get("action", "")), int(effect_event.get("slot", 0)))
        elif kind == "free_build_requested" and player_id in state["players"]:
            placements = effect_event.get("placements")
            if not isinstance(placements, list):
                placement = effect_event.get("placement", {})
                placements = [{"building_type": effect_event.get("building_type"), **dict(placement)}]
            for placement in placements:
                if not isinstance(placement, Mapping):
                    raise ValueError("invalid free building command")
                building_type = str(placement.get("building_type", ""))
                size = int(placement.get("size", BUILDING_SIZES.get(building_type, 1)))
                spec = {"building_type": building_type, "size": size, "cells": list(placement.get("cells", []))}
                _place_building(state, player_id, spec, events, free=True)
        elif kind == "unique_build_requested" and player_id in state["players"]:
            card_id = str(effect_event.get("card_id", ""))
            card = SPONSOR_CARDS.get(card_id)
            placement = effect_event.get("placement", {})
            if card and card.get("unique_building") and isinstance(placement, Mapping):
                unique = card["unique_building"]
                spec = {
                    "building_type": unique["id"], "unique_card_id": card_id,
                    "building_id": unique["id"], "cells": list(placement.get("cells", [])),
                }
                _place_building(state, player_id, spec, events, free=True, unique=unique)
        elif kind == "extra_action_requested" and player_id in state["players"]:
            state.setdefault("queued_extra_actions", []).append({
                "player_id": player_id, "action": effect_event.get("action"),
                "strength": effect_event.get("strength"), "move_after": bool(effect_event.get("move_after", False)),
                "allow_x_alternative": bool(effect_event.get("allow_x_alternative", False)),
                "optional": True,
            })
        elif kind == "attack_resolution_requested":
            _consume_attack_event(state, effect_event, events)
        elif kind == "digging_requested" and player_id in state["players"]:
            player = _player(state, player_id)
            for raw_operation in effect_event.get("operations", []):
                operation = raw_operation if isinstance(raw_operation, str) else raw_operation.get("operation")
                card_id = None if isinstance(raw_operation, str) else str(raw_operation.get("card_id", ""))
                if operation == "discard_display":
                    if card_id not in state.get("display", []):
                        raise ValueError("invalid Digging display card")
                    _remove_display_card(state, card_id)
                    state["discard"].append(card_id)
                    _refill_display(state)
                    state["display_dirty"] = False
                elif operation == "cycle_hand":
                    if card_id not in player.get("hand", []):
                        raise ValueError("invalid Digging hand card")
                    player["hand"].remove(card_id)
                    state["discard"].append(card_id)
                    drawn = _draw(state)
                    if drawn:
                        player["hand"].append(drawn)
                elif operation not in {"stop", None}:
                    raise ValueError("invalid Digging operation")
        elif kind == "follow_up_effect_requested" and player_id in state["players"]:
            if effect_event.get("effect") == "take_card":
                _queue_unique_follow_up(state, player_id, "254")
        elif kind == "display_refill_requested":
            # Snapping 2 may refill between its two takes. This happens before
            # the follow-up choice is normalized, so its options see the new
            # cards in their actual display folders.
            _refill_display(state)
            state["display_dirty"] = False
        elif kind == "display_cards_taken":
            if effect_event.get("refill_immediately"):
                _refill_display(state)
                state["display_dirty"] = False
            elif effect_event.get("refill_after_action"):
                state["display_dirty"] = True
        events.append(copy.deepcopy(dict(effect_event)))


def _effect_label(ref: Mapping[str, Any]) -> str:
    if ref.get("label"):
        return str(ref["label"])
    card = ZOO_CARDS.get(str(ref.get("card_id", "")), {})
    name = card.get("name", {}).get("zh", ref.get("card_id", ""))
    if ref.get("ability_id"):
        ability = next((item for item in card.get("abilities", []) if item["ability"] == ref["ability_id"]), {})
        return f"{name}: {ability.get('name_zh', ref['ability_id'])}"
    effect = next((item for item in card.get("effects", []) if item["id"] == ref.get("effect_id")), {})
    return f"{name}: {effect.get('text_zh', 'effect')}"


def _run_core_effect(
    state: MutableMapping[str, Any], ref: Mapping[str, Any], events: List[Dict[str, Any]],
) -> None:
    operation = ref["operation"]
    player_id = str(ref["player_id"])
    if operation == "reward":
        _apply_rewards(state, player_id, ref["rewards"], events, str(ref["source"]))
        player = _player(state, player_id)
        if ref["rewards"].get("money"):
            amount = int(ref["rewards"]["money"])
            player["money"] += amount
            events.append(_event("income", player_id=player_id, amount=amount, source=ref["source"]))
        if ref["rewards"].get("x_tokens"):
            _gain_x(player, int(ref["rewards"]["x_tokens"]))
    elif operation == "effect_order":
        refs = list(ref["effects"])
        if state.get("choose_effect_order") and len(refs) > 1:
            # Each zoo orders its own simultaneous effects. Resolve one completely
            # before offering the remaining effects, including all nested choices.
            owner = str(refs[0].get("player_id", player_id))
            indices = [index for index, item in enumerate(refs) if item.get("player_id") == owner]
            if len(indices) > 1:
                state["effect_order_counter"] = int(state.get("effect_order_counter", 0)) + 1
                _queue_choice(state, {
                    "choice_id": f"effect-order-{owner}-{state['effect_order_counter']}", "type": "effect_order", "player_id": owner,
                    "prompt": "Choose the next effect to resolve",
                    "options": [{"value": index, "label": _effect_label(refs[index])} for index in indices]
                               + [{"value": "all", "label": "Resolve in the listed order"}],
                    "min": 1, "max": 1, "_effects": refs,
                })
                return
            if indices:
                first = refs.pop(indices[0])
                state.setdefault("effect_queue", [])[0:0] = [first] + ([_effect_group(player_id, refs)] if refs else [])
                return
        state.setdefault("effect_queue", [])[0:0] = refs
    elif operation == "okapi":
        trigger_card = ({"icons": [{"tag": "herbivore", "count": ref["icon_count"]}]}
                        if "icon_count" in ref else ZOO_CARDS[str(ref["card_id"])])
        _queue_okapi_trigger(state, player_id, trigger_card)
    elif operation == "small_program":
        pending = _small_animal_program_choice(state, player_id)
        if pending:
            _queue_choice(state, pending)
    elif operation == "small_display":
        _queue_small_display_choice(state, player_id)
    elif operation == "take_card":
        _queue_take_card_choice(state, player_id, str(ref["source"]))
    elif operation == "unique_building":
        card = SPONSOR_CARDS[str(ref["card_id"])]
        placement = ref.get("placement")
        if placement:
            unique = card["unique_building"]
            _place_building(state, player_id, {
                "building_type": unique["id"], "unique_card_id": card["id"],
                "cells": list(placement.get("cells", [])),
                "building_id": placement.get("building_id", unique["id"]),
            }, events, free=True, unique=unique)
        else:
            _unique_building_choice(state, player_id, card)
    elif operation == "map_income":
        reward_id = str(ref["reward_id"])
        reward = MAP_REWARDS[reward_id]
        if reward["type"] == "card":
            _queue_take_card_choice(state, player_id, f"break-{state['break_count']}-{reward_id}")
        elif reward["type"] == "conservation":
            _apply_rewards(state, player_id, {"conservation": reward.get("amount", 0)}, events, f"break:{reward_id}")
        elif reward["type"] == "free_enclosure":
            size = int(reward.get("size", 2))
            if _find_placement(state, player_id, "standard_enclosure", size) is not None:
                _queue_choice(state, {
                    "choice_id": f"break-enclosure-{state['break_count']}-{player_id}",
                    "type": "place_free_enclosure", "player_id": player_id, "size": size,
                    "prompt": "Place the free Break enclosure", "options": [], "min": 1, "max": 1,
                })
    elif operation == "break_income":
        player = _player(state, player_id)
        refs = [{"type": "core", "operation": "zoo_income", "player_id": player_id,
                 "label": "领取吸引力、贩售亭及固定收入"}]
        for reward_id in player.get("claimed_map_rewards", []):
            reward = MAP_REWARDS[reward_id]
            if reward.get("timing") != "immediate_and_each_break":
                continue
            if reward["type"] == "money":
                refs.extend(_reward_effects(player_id, {"money": int(reward.get("amount", 0))}, f"break:{reward_id}"))
            else:
                refs.append({"type": "core", "operation": "map_income", "player_id": player_id,
                             "reward_id": reward_id, "label": str(reward.get("label", reward_id))})
        for sponsor_id in player.get("played_sponsors", []):
            refs.extend(_sponsor_effect_refs(player_id, SPONSOR_CARDS[sponsor_id], "income"))
        state.setdefault("effect_queue", []).extend([
            _effect_group(player_id, refs),
            {"type": "core", "operation": "refill_display", "player_id": player_id},
        ])
    elif operation == "zoo_income":
        player = _player(state, player_id)
        income = _appeal_income(int(player["appeal"])) + _kiosk_income(player) + int(player.get("permanent_income", 0))
        player["money"] += income
        events.append(_event("income", player_id=player_id, amount=income))
    elif operation == "end_break":
        state.pop("resolving_break", None)
    elif operation == "refill_display":
        _refill_display(state)
        state["display_dirty"] = False
    elif operation == "move_animals":
        options = _migration_options(state, ref)
        if options:
            _queue_choice(state, {
                "choice_id": f"move-animals-{player_id}-{ref['building_id']}-{len(ref.get('moved', []))}",
                "type": "move_animals", "player_id": player_id,
                "prompt": "Move an animal into the new special enclosure, or finish moving",
                "options": options, "min": 0, "max": 1, "allow_skip": True, "_migration": copy.deepcopy(dict(ref)),
            })
    elif operation in {"build_step", "association_step", "donation"}:
        if state.get("cancel_action_plan"):
            return
        trial = copy.deepcopy(state)
        step_events: List[Dict[str, Any]] = []
        try:
            if operation == "build_step":
                spec = ref["spec"]
                cost = _building_size(spec) * int(ACTION_DEFS["build"]["common"]["money_per_hex"])
                player = _player(trial, player_id)
                if int(player["money"]) < cost:
                    raise ValueError("not enough money")
                player["money"] -= cost
                _place_building(trial, player_id, spec, step_events)
            elif operation == "association_step":
                _perform_association_task(trial, player_id, ref["task"], str(ref["name"]), step_events)
            else:
                _perform_donation(trial, player_id, ref["amount"], step_events)
        except (ValueError, KeyError, TypeError, IndexError) as exc:
            if not state.get("completed_action_steps"):
                raise
            # Earlier steps may have committed through an interactive choice.
            # An optional later task/build must never trap that completed action.
            state["cancel_action_plan"] = True
            _queue_choice(state, {
                "choice_id": f"finish-plan-{player_id}", "type": "finish_action_plan", "player_id": player_id,
                "prompt": "The remaining plan cannot be completed. Finish this action.",
                "detail": str(exc), "options": [{"value": "finish", "label": "Finish action"}], "min": 1, "max": 1,
            })
            return
        state.clear()
        state.update(trial)
        state["completed_action_steps"] = int(state.get("completed_action_steps", 0)) + 1
        events.extend(step_events)
    elif operation == "finish_action":
        state.pop("completed_action_steps", None)
        state.pop("cancel_action_plan", None)
        _defer_turn_end(state, player_id, str(ref["action"]), int(ref["x_tokens"]), events, resume=False)
    elif operation == "placement_bonus":
        _apply_placement_bonus(state, player_id, str(ref["cell_id"]), events)
    elif operation == "choice":
        _queue_choice(state, ref["choice"])
    else:
        raise ValueError(f"unknown core effect: {operation}")


def _run_effect_queue(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    while state.get("effect_queue") and state.get("pending_choice") is None:
        effect_ref = state["effect_queue"].pop(0)
        # Nested effects belong to this effect, before the next queued effect.
        tail = state["effect_queue"]
        state["effect_queue"] = []
        if effect_ref.get("type") == "core":
            _run_core_effect(state, effect_ref, events)
            state["effect_queue"].extend(tail)
            _activate_next_choice(state)
            continue
        break_before = int(state.get("break_position", 0))
        effect_player_id = str(effect_ref.get("player_id", ""))
        result = _dispatch_effect(state, effect_ref)
        break_events = [event for event in result["events"] if event.get("type") == "break_advanced"]
        if break_events:
            limit = int(state.get("break_limit", 999))
            raw_position = int(state.get("break_position", break_before))
            state["break_position"] = min(limit, raw_position)
            if break_before < limit <= raw_position and effect_player_id in state.get("players", {}):
                state["break_due"] = True
                state.setdefault("break_triggered_by", effect_player_id)
            for event in break_events:
                event["value"] = int(state["break_position"])
                event["steps"] = int(state["break_position"]) - break_before
        _consume_effect_events(state, result["events"], events)
        if result["state_updates"]:
            _deep_update(state, result["state_updates"])
        if int(state.get("break_position", 0)) >= int(state.get("break_limit", 999)):
            state["break_due"] = True
            state.setdefault("break_triggered_by", str(effect_ref["player_id"]))
        state["effect_queue"].extend(tail)
        pending = result.get("pending_choice")
        if pending:
            if is_dataclass(pending):
                pending = asdict(pending)
            if (
                pending.get("kind") == "resolve_attack"
                and effect_ref.get("ability_id") in {"venom", "constriction"}
            ):
                automatic = _dispatch_effect(state, effect_ref, {"assignments": []})
                _consume_effect_events(state, automatic["events"], events)
                if automatic["state_updates"]:
                    _deep_update(state, automatic["state_updates"])
                continue
            pending = _normalize_pending_choice(dict(pending), effect_ref)
            pending["player_id"] = str(effect_ref["player_id"])
            _queue_choice(state, pending)
            return


def _enqueue_card_effects(
    state: MutableMapping[str, Any], refs: Sequence[Mapping[str, Any]], events: List[Dict[str, Any]]
) -> None:
    state.setdefault("effect_queue", [])[0:0] = copy.deepcopy(list(refs))
    _run_effect_queue(state, events)


def _animal_effect_refs(
    state: Mapping[str, Any], player_id: str, card: Mapping[str, Any], action_strength: int,
) -> List[Dict[str, Any]]:
    refs = []
    player = state["players"][player_id]
    tags = player.get("tags", {})
    for ability in card.get("abilities", []):
        params = copy.deepcopy(ability.get("parameters", {}))
        ability_id = str(ability["ability"])
        if ability_id == "pack":
            params["metric_value"] = int(tags.get("predator", 0))
        elif ability_id == "inventive_bear":
            params["metric_value"] = sum(
                int(other.get("tags", {}).get("bear", 0))
                for other in state.get("players", {}).values()
            )
        elif ability_id == "inventive_primate":
            params["metric_value"] = int(tags.get("primate", 0))
        elif ability_id == "iconic_animal":
            continent = str(params.get("continent", ""))
            params["metric_value"] = sum(
                int(other.get("tags", {}).get(continent, 0))
                for other in state.get("players", {}).values()
            )
        elif ability_id == "petting_zoo_animal":
            params["metric_value"] = int(tags.get("petting_zoo_animal", 0))
        refs.append({
            "type": "ability", "ability_id": ability_id, "player_id": player_id,
            "card_id": card["id"], "timing": ability.get("timing", "immediate"),
            "params": params, "action": "animals",
            "metadata": {"card": copy.deepcopy(card), "action_strength": action_strength},
        })
    return refs


def _sponsor_effect_refs(
    player_id: str, card: Mapping[str, Any], timing: Optional[str] = None, metadata: Optional[Mapping[str, Any]] = None
) -> List[Dict[str, Any]]:
    refs = []
    for index, effect in enumerate(card.get("effects", [])):
        if timing is not None and effect.get("timing") != timing:
            continue
        if timing == "passive" and metadata and metadata.get("trigger"):
            from game.ark_nova_effects import SPONSOR_EFFECT_SPECS
            spec = SPONSOR_EFFECT_SPECS.get(str(effect["id"]), {})
            if spec.get("op") != "trigger" or spec.get("trigger") != metadata["trigger"]:
                continue
            if spec.get("terrain") and spec["terrain"] != metadata.get("terrain"):
                continue
        if effect.get("kind") == "build_or_placement" and card.get("unique_building"):
            continue
        refs.append({
            "type": "sponsor", "effect_index": index, "player_id": player_id, "card_id": card["id"],
            "effect_id": effect["id"],
            "timing": effect.get("timing", "immediate"), "action": "sponsors",
            "metadata": {"card": copy.deepcopy(card), **copy.deepcopy(dict(metadata or {}))},
        })
    return refs


def _passive_sponsor_refs(
    state: Mapping[str, Any], player_id: str, trigger_card: Mapping[str, Any]
) -> List[Dict[str, Any]]:
    refs: List[Dict[str, Any]] = []
    for sponsor_id in state["players"][player_id].get("played_sponsors", []):
        refs.extend(_sponsor_effect_refs(
            player_id, SPONSOR_CARDS[sponsor_id], "passive", {"trigger_card": copy.deepcopy(trigger_card)}
        ))
    return refs


def _all_passive_sponsor_refs(
    state: Mapping[str, Any], source_player_id: str, trigger_card: Mapping[str, Any]
) -> List[Dict[str, Any]]:
    refs: List[Dict[str, Any]] = []
    trigger_icons = _card_zoo_icons(trigger_card)
    source_tags = state["players"][source_player_id].get("tags", {})
    new_unique_tags = [
        tag for tag in (*ANIMAL_CATEGORIES, *CONTINENTS)
        if int(trigger_icons.get(tag, 0)) > 0
        and int(source_tags.get(tag, 0)) == int(trigger_icons.get(tag, 0))
    ]
    trigger_tags = [
        tag for tag, count in trigger_icons.items() for _ in range(int(count))
    ]
    for owner_id in _ordered_player_ids(state):
        for sponsor_id in state["players"][owner_id].get("played_sponsors", []):
            sponsor_refs = _sponsor_effect_refs(
                owner_id,
                SPONSOR_CARDS[sponsor_id],
                "passive",
                {
                    "trigger_card": copy.deepcopy(trigger_card),
                    "source_player_id": source_player_id,
                    "tags": trigger_tags,
                    "new_unique_tags": new_unique_tags,
                },
            )
            for ref in sponsor_refs:
                from game.ark_nova_effects import SPONSOR_EFFECT_SPECS
                spec = SPONSOR_EFFECT_SPECS.get(str(ref.get("effect_id", "")), {})
                trigger = spec.get("trigger")
                if spec.get("op") != "trigger" or trigger not in {"own_icon_played", "any_icon_played", "new_unique_icon"}:
                    continue
                if trigger != "any_icon_played" and owner_id != source_player_id:
                    continue
                if spec.get("tag") and spec["tag"] not in trigger_tags:
                    continue
                matching = new_unique_tags if trigger == "new_unique_icon" else trigger_tags
                if spec.get("tags") and not set(spec["tags"]).intersection(matching):
                    continue
                repeat_tag = REPEATED_PASSIVE_EFFECT_TAGS.get(str(ref.get("effect_id", "")))
                repeat_count = max(1, int(trigger_icons.get(repeat_tag, 0))) if repeat_tag else 1
                if spec.get("after_action"):
                    ref["timing"] = "after_action"
                refs.extend(copy.deepcopy(ref) for _ in range(repeat_count))
    return refs


def _card_trigger_effects(
    state: MutableMapping[str, Any], player_id: str, card: Mapping[str, Any],
) -> List[Dict[str, Any]]:
    refs = _all_passive_sponsor_refs(state, player_id, card)
    state.setdefault("after_action_core_effects", []).extend(
        ref for ref in refs if ref.get("timing") == "after_action"
    )
    return [ref for ref in refs if ref.get("timing") != "after_action"]


def _kiosk_income(player: Mapping[str, Any]) -> int:
    buildings = player["map"]["buildings"]
    by_id = {item["id"]: item for item in buildings}
    occupancy = player["map"]["occupancy"]
    total = 0
    for kiosk in (item for item in buildings if item["building_type"] == "kiosk"):
        adjacent_ids = {
            occupancy[neighbor]
            for cell_id in kiosk["cells"]
            for neighbor in MAP_CELLS[cell_id]["neighbors"]
            if neighbor in occupancy and occupancy[neighbor] != kiosk["id"]
        }
        for building_id in adjacent_ids:
            building = by_id[building_id]
            if building["building_type"] == "standard_enclosure" and not _building_occupied(building):
                continue
            total += 1
    return total


def _advance_break(
    state: MutableMapping[str, Any], steps: int, events: List[Dict[str, Any]], source: str,
    player_id: Optional[str] = None,
) -> None:
    if steps <= 0:
        return
    before = int(state["break_position"])
    state["break_position"] = min(int(state["break_limit"]), before + int(steps))
    reached_break = before < int(state["break_limit"]) <= int(state["break_position"])
    if state["break_position"] >= int(state["break_limit"]):
        state["break_due"] = True
        if reached_break and state.get("break_triggered_by") is None and player_id:
            state["break_triggered_by"] = player_id
            gained = _gain_x(_player(state, player_id), 1)
            events.append(_event("break_trigger_x", player_id=player_id, amount=gained))
    events.append(_event("break_advance", steps=state["break_position"] - before, position=state["break_position"], source=source))


def _resolve_break(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    break_triggered_by = state.get("break_triggered_by")
    state["resolving_break"] = True
    state["break_position"] = 0
    state["break_due"] = False
    state["break_count"] = int(state.get("break_count", 0)) + 1

    for player_id in _ordered_player_ids(state):
        player = _player(state, player_id)
        excess = len(player["hand"]) - int(player.get("hand_limit", 3))
        if excess > 0:
            _queue_choice(state, {
                "choice_id": f"break-discard-{state['break_count']}-{player_id}", "type": "discard_cards",
                "player_id": player_id, "prompt": f"Discard {excess} card(s) for the Break hand limit",
                "options": _choice_options(player["hand"]), "min": excess, "max": excess,
            })
        player["available_workers"] = int(player.get("association_workers_total", 1))
        player["association_worker_placements"] = []
        player.pop("action_tokens", None)
        for action_card in player.get("action_cards", {}).values():
            for token_key in ("multiplier_tokens", "venom_tokens", "constriction_tokens", "hypnosis_tokens"):
                action_card.pop(token_key, None)

    # Refill the shared Association-board display. A tile type does not return
    # once every player already owns its corresponding tile.
    association_supply = state.setdefault("association_supply", {})
    players = list(state.get("players", {}).values())
    association_supply["partner_zoos"] = [
        continent for continent in CONTINENTS
        if not all(continent in player.get("partner_zoos", []) for player in players)
    ]
    association_supply["universities"] = [
        item["id"] for item in UNIVERSITIES
        if not all(item["id"] in player.get("universities", []) for player in players)
    ]
    state.pop("break_triggered_by", None)
    removed = [card_id for card_id in state["display"][:2] if card_id]
    state["discard"].extend(removed)
    state["display"] = list(state["display"])[2:]
    _refill_display(state)

    income_order = _ordered_player_ids(state)
    if break_triggered_by in income_order:
        start = income_order.index(str(break_triggered_by))
        income_order = income_order[start:] + income_order[:start]
    _enqueue_card_effects(state, [
        {"type": "core", "operation": "break_income", "player_id": player_id}
        for player_id in income_order
    ] + [{"type": "core", "operation": "end_break", "player_id": income_order[-1]}], events)
    events.append(_event("break", number=state["break_count"], discarded_display=removed))


def _check_end_trigger(state: Mapping[str, Any], active_player_id: Optional[str] = None) -> Optional[str]:
    for player_id in ([active_player_id] if active_player_id else _ordered_player_ids(state)):
        player = state["players"][player_id]
        if int(player["appeal"]) >= _target_appeal(int(player["conservation"])):
            return player_id
    return None


def _next_clockwise(state: Mapping[str, Any], player_id: str) -> str:
    order = _ordered_player_ids(state)
    return order[(order.index(player_id) + 1) % len(order)]


def _set_current_player(state: MutableMapping[str, Any], player_id: Optional[str]) -> None:
    state["current_player"] = player_id
    state["current_turn"] = player_id


def _fallback_final_score(player: Mapping[str, Any], card: Mapping[str, Any]) -> int:
    rule = card.get("scoring_rule", {})
    kind = rule.get("kind")
    if kind == "metric_ladder":
        metric = str(rule.get("metric", ""))
        aliases = {
            "large_animal_count": "large_animal", "small_animal_count": "small_animal",
            "supported_projects": "supported_projects", "reputation": "reputation",
            "universities": "universities", "partner_zoos": "partner_zoos",
        }
        canonical = aliases.get(metric, metric)
        if canonical == "supported_projects":
            value = len(player.get("supported_projects", []))
        elif canonical == "universities":
            value = len(player.get("universities", []))
        elif canonical == "partner_zoos":
            value = len(player.get("partner_zoos", []))
        elif canonical == "reputation":
            value = int(player.get("reputation", 0))
        else:
            value = _metric_count(player, canonical)
        score = 0
        for step in card.get("scoring_steps", []):
            if value >= int(step.get("requirement", 0)):
                score = max(score, int(step.get("reward", {}).get("conservation", 0)))
        return min(4, score)
    if kind == "independent_conditions":
        # The effects module has the exact conditions. The fallback remains conservative.
        return 0
    return 0


def _score_final_card(state: MutableMapping[str, Any], player_id: str, card_id: str) -> Tuple[int, List[Dict[str, Any]]]:
    try:
        from game.ark_nova_effects import EffectContext, score_final_card
    except (ImportError, ModuleNotFoundError):
        return _fallback_final_score(state["players"][player_id], FINAL_CARDS[card_id]), []
    context = EffectContext(
        state=state, player_id=player_id, card_id=card_id, timing="endgame",
        metadata={"card": copy.deepcopy(FINAL_CARDS[card_id])},
    )
    result = score_final_card(card_id, context, player_id=player_id)
    if isinstance(result, (int, float)):
        return min(4, max(0, int(result))), []
    normalized = _normalize_effect_result(result)
    value = normalized.get("state_updates", {}).get("conservation", 0)
    if isinstance(result, Mapping):
        value = result.get("score", result.get("conservation", value))
    return min(4, max(0, int(value or 0))), normalized["events"]


def _finalize_scores(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    # Resolve brown end-game sponsor effects before Final Scoring cards.
    refs: List[Dict[str, Any]] = []
    for player_id in _ordered_player_ids(state):
        for sponsor_id in state["players"][player_id].get("played_sponsors", []):
            refs.extend(_sponsor_effect_refs(player_id, SPONSOR_CARDS[sponsor_id], "endgame"))
    _enqueue_card_effects(state, refs, events)
    if state.get("pending_choice") or state.get("effect_queue"):
        state["deferred_turn_end"] = {"stage": "finish_scoring"}
        return
    _finish_scoring(state, events)


def _finish_scoring(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    scores: Dict[str, int] = {}
    for player_id in _ordered_player_ids(state):
        player = _player(state, player_id)
        bonus = 0
        for card_id in player.get("final_cards", []):
            value, card_events = _score_final_card(state, player_id, card_id)
            bonus += value
            events.extend(card_events)
        player["conservation"] = _clamp(int(player["conservation"]) + bonus, 0, MAX_CONSERVATION)
        scores[player_id] = int(player["appeal"]) - _target_appeal(int(player["conservation"]))
    top_score = max(scores.values()) if scores else 0
    tied = [player_id for player_id, score in scores.items() if score == top_score]
    if len(tied) > 1:
        best_projects = max(len(state["players"][player_id].get("supported_projects", [])) for player_id in tied)
        tied = [player_id for player_id in tied if len(state["players"][player_id].get("supported_projects", [])) == best_projects]
    state["scores"] = scores
    state["winner"] = tied
    state["game_over"] = True
    state["phase"] = "game_over"
    _set_current_player(state, None)
    state["deferred_turn_end"] = None
    events.append(_event("game_over", scores=copy.deepcopy(scores), winner=list(tied)))


def _begin_final_scoring(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    if not state.get("final_card_gate_reached"):
        for player_id in _ordered_player_ids(state):
            player = _player(state, player_id)
            if len(player.get("final_cards", [])) > 1 and not player.get("final_card_discarded"):
                _queue_choice(state, {
                    "choice_id": f"final-discard-{player_id}", "type": "discard_final_card", "player_id": player_id,
                    "prompt": "Discard one Final Scoring card before scoring", "options": _choice_options(player["final_cards"]),
                    "min": 1, "max": 1,
                })
        if state.get("pending_choice"):
            state["deferred_turn_end"] = {"stage": "start_scoring"}
            return
    _finalize_scores(state, events)


def _start_extra_action(
    state: MutableMapping[str, Any], extra: Mapping[str, Any], events: List[Dict[str, Any]],
) -> None:
    player_id = str(extra["player_id"])
    _set_current_player(state, player_id)
    state["forced_action"] = copy.deepcopy(dict(extra))
    if extra.get("action_level"):
        _player(state, player_id).setdefault("_action_level_overrides", {})[
            str(extra["action"])
        ] = int(extra["action_level"])
    state["phase"] = "action"
    events.append(_event("extra_action", **copy.deepcopy(dict(extra))))


# A Hypnosis action resolves inside the current animal card. Keep the outer
# action's queues and repetition state intact while the borrowed action runs.
SUSPENDED_ACTION_KEYS = (
    "effect_queue", "pending_queue", "card_sequence", "cards_draw_sequence",
    "deferred_turn_end", "after_action_core_effects", "deferred_after_action_effects",
    "multiplier_action", "forced_action", "choose_effect_order", "queued_extra_actions",
    "completed_action_steps", "cancel_action_plan",
)


def _suspend_for_extra_action(
    state: MutableMapping[str, Any], extra: Mapping[str, Any], events: List[Dict[str, Any]],
) -> None:
    context = {key: state.pop(key) for key in SUSPENDED_ACTION_KEYS if key in state}
    player = _player(state, str(extra["player_id"]))
    context["level_overrides"] = player.pop("_action_level_overrides", {})
    state.setdefault("suspended_actions", []).append(context)
    _start_extra_action(state, extra, events)


def _resume_suspended_action(state: MutableMapping[str, Any], player_id: str) -> None:
    context = state["suspended_actions"].pop()
    if not state["suspended_actions"]:
        state.pop("suspended_actions")
    for key in SUSPENDED_ACTION_KEYS:
        state.pop(key, None)
    overrides = context.pop("level_overrides")
    player = _player(state, player_id)
    player.pop("_action_level_overrides", None)
    if overrides:
        player["_action_level_overrides"] = overrides
    state.update(context)


def _skip_extra_action(state: MutableMapping[str, Any], player_id: str, events: List[Dict[str, Any]]) -> None:
    forced = state.get("forced_action")
    if not isinstance(forced, Mapping) or not forced.get("optional") or forced.get("from_multiplier"):
        raise ValueError("there is no optional extra action to skip")
    state.pop("forced_action")
    _player(state, player_id).pop("_action_level_overrides", None)
    state["deferred_turn_end"] = {"stage": "finish_action", "player_id": player_id}
    events.append(_event("optional_effect_skipped", player_id=player_id, source="extra_action"))
    _resume_if_clear(state, events)


def _advance_after_turn(
    state: MutableMapping[str, Any], player_id: str, events: List[Dict[str, Any]],
    *, end_triggered_during_break: bool = False,
) -> None:
    queued_extra = state.get("queued_extra_actions", [])
    if queued_extra:
        extra = queued_extra.pop(0)
        _start_extra_action(state, extra, events)
        return
    final_round = state["final_round"]
    if not final_round.get("active"):
        trigger = _check_end_trigger(state, None if end_triggered_during_break else player_id)
        if trigger:
            order = _ordered_player_ids(state)
            start = order.index(player_id)
            final_turn_count = len(order) if end_triggered_during_break else len(order) - 1
            remaining = [
                order[(start + offset) % len(order)]
                for offset in range(1, final_turn_count + 1)
            ]
            final_round.update({"active": True, "triggered_by": trigger, "remaining": remaining})
            events.append(_event(
                "final_round", triggered_by=trigger, remaining=list(remaining),
                during_break=end_triggered_during_break,
            ))

    if final_round.get("active"):
        remaining = final_round.get("remaining", [])
        if remaining:
            _set_current_player(state, remaining.pop(0))
            state["phase"] = "action"
            return
        _begin_final_scoring(state, events)
        return
    _set_current_player(state, _next_clockwise(state, player_id))
    state["phase"] = "action"


def _resume_if_clear(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    while not state.get("game_over"):
        _activate_next_choice(state)
        if state.get("pending_choice"):
            return
        if state.get("effect_queue"):
            _run_effect_queue(state, events)
            if state.get("pending_choice"):
                return
            continue
        if state.get("cards_draw_sequence"):
            _advance_cards_draw_sequence(state, events)
            continue
        if state.get("card_sequence"):
            _advance_card_sequence(state, events)
            continue
        deferred = state.get("deferred_turn_end")
        if not deferred:
            if state.get("phase") == "pending_choice":
                state["phase"] = "action"
            return
        stage = deferred.get("stage")
        if stage == "finish_action" and state.get("after_action_core_effects"):
            refs = state.pop("after_action_core_effects")
            state.setdefault("effect_queue", []).append(_effect_group(str(deferred["player_id"]), refs))
            continue
        if stage == "repeat_action":
            multiplier = state.get("multiplier_action")
            if not isinstance(multiplier, Mapping):
                raise ValueError("missing Multiplier action state")
            player_id = str(multiplier["player_id"])
            action_id = str(multiplier["action"])
            state["deferred_turn_end"] = None
            _set_current_player(state, player_id)
            state["forced_action"] = {
                "player_id": player_id, "action": action_id,
                "strength": int(multiplier["base_strength"]), "move_after": False,
                "allow_x_alternative": True, "from_multiplier": True,
            }
            state["phase"] = "action"
            events.append(_event(
                "multiplier_repeat", player_id=player_id, action_card=action_id,
                remaining=int(multiplier.get("remaining", 0)) + 1,
            ))
            return
        if stage == "finish_action":
            if state.get("queued_extra_actions"):
                player_id = str(deferred["player_id"])
                state["deferred_turn_end"] = None
                _advance_after_turn(state, player_id, events)
                return
            if state.get("suspended_actions"):
                _resume_suspended_action(state, str(deferred["player_id"]))
                continue
            if state.get("display_dirty"):
                _refill_display(state)
                state["display_dirty"] = False
            turn_player_id = str(deferred["player_id"])
            turn_player = _player(state, turn_player_id)
            has_venom = any(
                int(card.get("venom_tokens", 0))
                for card in turn_player.get("action_cards", {}).values()
            )
            if (
                has_venom and not state.get("turn_venom_removed")
                and not _attack_immune(turn_player, "venom")
            ):
                if int(turn_player.get("money", 0)) < 2:
                    raise _VenomUndo("this action cannot pay the Venom penalty; choose a different action")
                turn_player["money"] -= 2
                events.append(_event("venom_penalty", player_id=turn_player_id, money=2))
            state.pop("turn_venom_removed", None)
            state.pop("_venom_turn_start", None)
            state.pop("_venom_first_action", None)
            state.pop("venom_failed_actions", None)
            deferred["stage"] = "after_break"
            if state.get("break_due"):
                deferred["break_resolved"] = True
                deferred["end_trigger_before_break"] = _check_end_trigger(state, turn_player_id)
                _resolve_break(state, events)
                continue
        if stage == "after_break" or deferred.get("stage") == "after_break":
            player_id = str(deferred["player_id"])
            end_triggered_during_break = bool(
                deferred.get("break_resolved")
                and not deferred.get("end_trigger_before_break")
                and _check_end_trigger(state)
            )
            state["deferred_turn_end"] = None
            _advance_after_turn(
                state, player_id, events,
                end_triggered_during_break=end_triggered_during_break,
            )
            return
        if stage == "start_scoring":
            state["deferred_turn_end"] = None
            _finalize_scores(state, events)
            return
        if stage == "finish_scoring":
            state["deferred_turn_end"] = None
            _finish_scoring(state, events)
            return
        return


def _defer_turn_end(
    state: MutableMapping[str, Any], player_id: str, action_id: str, x_tokens: int,
    events: List[Dict[str, Any]], *, resume: bool = True,
) -> None:
    player = _player(state, player_id)
    forced = state.get("forced_action")
    is_forced = (isinstance(forced, Mapping) and forced.get("player_id") == player_id
                 and forced.get("action") in {action_id, "gain_x"})
    action_card_owner_id = str(forced.get("action_card_owner", player_id)) if is_forced else player_id
    action_card_owner = _player(state, action_card_owner_id)
    multiplier = state.get("multiplier_action")
    is_multiplier = (
        isinstance(multiplier, MutableMapping)
        and multiplier.get("player_id") == player_id
        and multiplier.get("action") == action_id
    )
    repeats_remaining = int(multiplier.get("remaining", 0)) if is_multiplier else 0
    if repeats_remaining > 0:
        old_slot = _action_slot(action_card_owner, action_id)
        multiplier["remaining"] = repeats_remaining - 1
        stage = "repeat_action"
    elif is_forced and not forced.get("move_after") and not is_multiplier:
        old_slot = _action_slot(action_card_owner, action_id)
        stage = "finish_action"
    else:
        old_slot = _use_action_card(action_card_owner, action_id)
        stage = "finish_action"
    used_entry = action_card_owner["action_cards"][action_id]
    if stage == "finish_action":
        if int(used_entry.pop("venom_tokens", 0)):
            state["turn_venom_removed"] = True
        used_entry.pop("constriction_tokens", None)
        if is_multiplier:
            used_entry["multiplier_tokens"] = max(
                0,
                int(used_entry.get("multiplier_tokens", 0)) - int(multiplier.get("tokens_used", 0)),
            )
            if not used_entry["multiplier_tokens"]:
                used_entry.pop("multiplier_tokens", None)
            state.pop("multiplier_action", None)
    if is_forced:
        state.pop("forced_action", None)
    overrides = player.get("_action_level_overrides")
    if isinstance(overrides, MutableMapping):
        overrides.pop(action_id, None)
        if not overrides:
            player.pop("_action_level_overrides", None)
    state["deferred_turn_end"] = {"stage": stage, "player_id": player_id, "action_card": action_id}
    events.append(_event(
        "action_card", player_id=player_id, action_card=action_id, from_slot=old_slot,
        x_tokens=x_tokens, repeated=stage == "repeat_action",
    ))
    if resume:
        _resume_if_clear(state, events)


def _advance_cards_draw_sequence(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    sequence = state["cards_draw_sequence"]
    player_id = str(sequence["player_id"])
    player = _player(state, player_id)
    if sequence["remaining"]:
        options = ([{"value": "deck", "label": "Draw from deck"}]
                   if state.get("deck") or state.get("discard") else [])
        options.extend({"value": f"display:{card_id}", "label": _full_card(card_id)["name"].get("zh", card_id)}
                       for card_id in state["display"] if card_id and _display_accessible(state, player_id, card_id))
        if options:
            _queue_choice(state, {
                "choice_id": f"cards-source-{player_id}-{sequence['remaining']}",
                "type": "draw_card", "player_id": player_id,
                "prompt": f"Choose the next card source ({sequence['remaining']} remaining)",
                "detail": "Look at each drawn card before choosing the next source. Display gaps stay empty until the turn ends.",
                "options": options, "min": 1, "max": 1,
            })
            return
        sequence["remaining"] = 0
    if not sequence.get("discard_started"):
        sequence["discard_started"] = True
        discard_count = min(sequence["discard_count"], len(player["hand"]))
        events.append(_event("cards", player_id=player_id, strength=sequence["strength"],
                             drawn=sequence["drawn"], market_cards=sequence["market_cards"], discard_count=discard_count))
        if discard_count:
            _queue_choice(state, {
                "choice_id": f"cards-discard-{player_id}-{state.get('break_count', 0)}", "type": "discard_cards",
                "player_id": player_id, "prompt": f"Discard {discard_count} card(s)",
                "options": _choice_options(player["hand"]), "min": discard_count, "max": discard_count,
            })
            return
    state.pop("cards_draw_sequence")
    _defer_turn_end(state, player_id, "cards", int(sequence["x_tokens"]), events, resume=False)


def _perform_cards_action(
    state: MutableMapping[str, Any], player_id: str, action: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    x_tokens, error = _validate_x_tokens(player, action.get("x_tokens", 0))
    if error:
        return error
    assert x_tokens is not None
    strength = _action_strength(state, player_id, "cards", x_tokens)
    if strength < 1:
        return "Constriction leaves this action below strength 1"
    player["x_tokens"] -= x_tokens
    table_strength = min(5, strength)
    level = _action_level(player, "cards")
    face = ACTION_DEFS["cards"]["sides"]["II" if level == 2 else "I"]
    mode = action.get("mode", "draw")
    _advance_break(state, 2, events, "cards", player_id)

    if mode == "snap":
        if table_strength not in face.get("snap_at_strength", []):
            return "Cards action is not strong enough to Snap"
        card_id = str(action.get("display_card_id", ""))
        if card_id not in state["display"]:
            return "Snap card is not in the display"
        _remove_display_card(state, card_id)
        player["hand"].append(card_id)
        events.append(_event("snap", player_id=player_id, card_id=card_id))
    elif mode == "draw":
        rule = face["draw_discard_by_strength"][str(table_strength)]
        draw_count = int(rule["draw"])
        # An explicit list remains a valid preplanned draw for saved clients and
        # bots. Interactive Cards II lets each source depend on the previous draw.
        interactive = action.get("choose_card_sources", "market_card_ids" not in action and "discard_ids" not in action)
        if level == 2 and interactive:
            if action.get("market_card_ids") or action.get("discard_ids") is not None:
                return "choose card sources individually or submit a complete draw plan"
            state["cards_draw_sequence"] = {
                "player_id": player_id, "remaining": draw_count, "discard_count": int(rule["discard"]),
                "strength": strength, "x_tokens": x_tokens, "drawn": [], "market_cards": [],
            }
            _resume_if_clear(state, events)
            return None
        market_ids = action.get("market_card_ids", [])
        if market_ids is None:
            market_ids = []
        if not isinstance(market_ids, list) or not all(isinstance(value, str) for value in market_ids):
            return "invalid market card selection"
        if len(set(market_ids)) != len(market_ids) or len(market_ids) > draw_count:
            return "too many market cards selected"
        if market_ids and level != 2:
            return "Cards II is required to draw from the display"
        for card_id in market_ids:
            if not _display_accessible(state, player_id, card_id):
                return "display card is outside your reputation range"
        for card_id in market_ids:
            _remove_display_card(state, card_id)
            player["hand"].append(card_id)
        drawn: List[str] = []
        for _ in range(draw_count - len(market_ids)):
            card_id = _draw(state)
            if card_id:
                player["hand"].append(card_id)
                drawn.append(card_id)
        discard_count = min(int(rule["discard"]), len(player["hand"]))
        supplied_discards = action.get("discard_ids")
        if supplied_discards is not None:
            if (
                not isinstance(supplied_discards, list)
                or len(supplied_discards) != discard_count
                or len(set(supplied_discards)) != len(supplied_discards)
                or any(card_id not in player["hand"] for card_id in supplied_discards)
            ):
                return "invalid Cards discard"
            for card_id in supplied_discards:
                player["hand"].remove(card_id)
                state["discard"].append(card_id)
        elif discard_count:
            _queue_choice(state, {
                "choice_id": f"cards-discard-{player_id}-{state.get('break_count', 0)}", "type": "discard_cards",
                "player_id": player_id, "prompt": f"Discard {discard_count} card(s)",
                "options": _choice_options(player["hand"]), "min": discard_count, "max": discard_count,
            })
        events.append(_event(
            "cards", player_id=player_id, strength=strength, drawn=drawn,
            market_cards=list(market_ids), discard_count=discard_count,
        ))
    else:
        return "invalid Cards mode"
    _defer_turn_end(state, player_id, "cards", x_tokens, events)
    return None


def _perform_build_action(
    state: MutableMapping[str, Any], player_id: str, action: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    x_tokens, error = _validate_x_tokens(player, action.get("x_tokens", 0))
    if error:
        return error
    assert x_tokens is not None
    strength = _action_strength(state, player_id, "build", x_tokens)
    if strength < 1:
        return "Constriction leaves this action below strength 1"
    level = _action_level(player, "build")
    specs = action.get("buildings")
    if not isinstance(specs, list) or not specs or not all(isinstance(value, Mapping) for value in specs):
        return "Build requires one or more buildings"
    building_types = [str(spec.get("building_type", "")) for spec in specs]
    engineer = _has_active_rule(player, "extra_same_building")
    extra_index: Optional[int] = None
    if level == 1:
        if len(specs) == 2 and engineer:
            first_signature = (building_types[0], _building_size(specs[0]))
            second_signature = (building_types[1], _building_size(specs[1]))
            if first_signature != second_signature or building_types[1] in SPECIAL_ENCLOSURES:
                return "Engineer must copy the same non-special building"
            extra_index = 1
        elif len(specs) != 1:
            return "Build I constructs exactly one building"
    else:
        signatures = [(kind, _building_size(spec)) for kind, spec in zip(building_types, specs)]
        counts = Counter(signatures)
        repeated = [kind for kind, count in counts.items() if count > 1]
        if repeated:
            if not engineer or len(repeated) != 1 or counts[repeated[0]] != 2:
                return "Build II buildings must be different types or enclosure sizes"
            signature = repeated[0]
            kind = signature[0]
            indices = [index for index, value in enumerate(signatures) if value == signature]
            if kind in SPECIAL_ENCLOSURES or _building_size(specs[indices[0]]) != _building_size(specs[indices[1]]):
                return "Engineer must copy the same non-special building"
            extra_index = indices[1]
    side = ACTION_DEFS["build"]["sides"]["II" if level == 2 else "I"]
    allowed = set(side["allowed"])
    if any(building_type not in allowed for building_type in building_types):
        return "building type is not available on this Build side"
    strength_size = sum(
        _building_size(spec) for index, spec in enumerate(specs)
        if index != extra_index
    )
    if strength_size > strength:
        return "buildings exceed action strength"
    player["x_tokens"] -= x_tokens
    refs = [{"type": "core", "operation": "build_step", "player_id": player_id, "spec": copy.deepcopy(spec)} for spec in specs]
    refs.append({"type": "core", "operation": "finish_action", "player_id": player_id,
                 "action": "build", "x_tokens": x_tokens})
    events.append(_event("build_action", player_id=player_id, strength=strength,
                         cost=sum(_building_size(spec) * 2 for spec in specs)))
    _enqueue_card_effects(state, refs, events)
    _resume_if_clear(state, events)
    return None


def _source_for_card(
    state: Mapping[str, Any], player_id: str, card_id: str, requested: Optional[str]
) -> Tuple[Optional[str], Optional[int], Optional[str]]:
    player = state["players"][player_id]
    source = requested
    if source is None:
        source = "hand" if card_id in player["hand"] else "display" if card_id in state["display"] else None
    if source == "hand":
        return ("hand", 0, None) if card_id in player["hand"] else (None, None, "card is not in hand")
    if source == "display":
        if not _display_accessible(state, player_id, card_id):
            return None, None, "display card is outside your reputation range"
        return "display", list(state["display"]).index(card_id) + 1, None
    return None, None, "unknown card source"


def _reward_effects(player_id: str, rewards: Mapping[str, Any], source: str) -> List[Dict[str, Any]]:
    return [
        {"type": "core", "operation": "reward", "player_id": player_id,
         "rewards": {track: amount}, "source": source, "label": f"{track} +{amount}"}
        for track, amount in rewards.items() if amount
    ]


def _effect_group(player_id: str, refs: Sequence[Mapping[str, Any]]) -> Dict[str, Any]:
    return {"type": "core", "operation": "effect_order", "player_id": player_id,
            "effects": copy.deepcopy(list(refs))}


def _animal_play_error(
    state: Mapping[str, Any], player_id: str, play: Mapping[str, Any], level: int,
) -> Optional[str]:
    player = state["players"][player_id]
    card_id = str(play.get("card_id", ""))
    card = ANIMAL_CARDS.get(card_id)
    if not card:
        return "unknown animal card"
    size_class = _animal_size_class(card)
    chosen = _active_rules(player, "chosen_animal_size")
    if chosen and size_class in {"small", "large"} and size_class != chosen[-1].get("size"):
        return "WAZA Special Assignment forbids this animal size"
    source, surcharge, error = _source_for_card(state, player_id, card_id, play.get("source"))
    if error:
        return error
    if source == "display" and level != 2:
        return "Animals II is required to play from the display"
    ignore = int(size_class == "large" and _has_active_rule(player, "large_animal_ignore_condition"))
    if not _card_conditions_met(player, card, ignore_count=ignore):
        return "animal card conditions are not met"
    _, _, error = _enclosure_for_animal(player, card, str(play.get("enclosure_id", "")))
    if error:
        return error
    if int(player["money"]) < _animal_cost(player, card) + int(surcharge or 0):
        return "not enough money for animal"
    return None


def _play_animal_card(
    state: MutableMapping[str, Any], player_id: str, play: Mapping[str, Any],
    level: int, strength: int, events: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    error = _animal_play_error(state, player_id, play, level)
    if error:
        raise ValueError(error)
    player = _player(state, player_id)
    card_id = str(play["card_id"])
    card = ANIMAL_CARDS[card_id]
    source, surcharge, _ = _source_for_card(state, player_id, card_id, play.get("source"))
    building, option, _ = _enclosure_for_animal(player, card, str(play["enclosure_id"]))
    assert building is not None and option is not None
    cost = _animal_cost(player, card) + int(surcharge or 0)
    player["money"] -= cost
    if source == "hand":
        player["hand"].remove(card_id)
    else:
        _remove_display_card(state, card_id)
    required = int(option.get("required_spaces", 0))
    building["occupied_by"].append(card_id)
    building["used_capacity"] = int(building.get("used_capacity", 0)) + required
    if building["building_type"] == "standard_enclosure":
        building["occupied"] = True
    player["played_animals"].append(card_id)
    player["animal_records"].append({
        "card_id": card_id, "enclosure_id": building["id"], "enclosure_type": building["building_type"],
        "enclosure_size": int(building["size"]),
        "printed_enclosure_size": _printed_standard_enclosure_size(card), "capacity_used": required,
    })
    _recompute_tags(player)
    _update_derived_metrics(player)
    refs = _reward_effects(player_id, card.get("printed_rewards", {}), f"animal:{card_id}")
    chosen = _active_rules(player, "chosen_animal_size")
    if chosen and _animal_size_class(card) == chosen[-1].get("size"):
        refs.extend(_reward_effects(player_id, {"appeal": int(chosen[-1].get("appeal", 0))}, "waza_special_assignment"))
    abilities = _animal_effect_refs(state, player_id, card, strength)
    refs.extend(ref for ref in abilities if ref.get("timing") != "after_action")
    refs.extend(_card_trigger_effects(state, player_id, card))
    if int(_card_icons(card).get("herbivore", 0)) and (card_id == "253" or (
        _has_active_rule(player, "okapi_sponsor_chain") and int(player.get("card_tokens", {}).get("253", 0))
    )):
        refs.append({"type": "core", "operation": "okapi", "player_id": player_id, "card_id": card_id,
                     "label": "Okapi Stable"})
    events.append(_event("animal", player_id=player_id, card_id=card_id,
                         enclosure_id=building["id"], source=source, cost=cost))
    return refs, [ref for ref in abilities if ref.get("timing") == "after_action"]


def _sponsor_play_error(
    state: Mapping[str, Any], player_id: str, card_id: str, level: int, budget: int,
    placement: Optional[Mapping[str, Any]] = None,
) -> Optional[str]:
    player = state["players"][player_id]
    card = SPONSOR_CARDS.get(card_id)
    if not card:
        return "unknown sponsor card"
    if int(card["play"]["strength_required"]) > budget:
        return "sponsor cards exceed action strength"
    source, surcharge, error = _source_for_card(state, player_id, card_id, None)
    if error:
        return error
    if source == "display" and level != 2:
        return "Sponsors II is required to play from display"
    if not _card_conditions_met(player, card):
        return "sponsor card conditions are not met"
    if int(player["money"]) < int(card.get("play", {}).get("base_money_cost", 0)) + int(surcharge or 0):
        return "not enough money for sponsors"
    unique = card.get("unique_building")
    if unique and placement:
        if not isinstance(placement, Mapping):
            return "invalid unique building placement"
        error = _validate_building_placement(state, player_id, {
            "building_type": unique["id"], "unique_card_id": card_id,
            "cells": list(placement.get("cells", [])),
            "building_id": placement.get("building_id", unique["id"]),
        }, free=True, unique=unique)
        if error:
            return error
    if unique and _find_placement(state, player_id, str(unique["id"]),
                                  int(unique.get("footprint", {}).get("cell_count", 0)), unique) is None:
        return "unique building has no legal placement"
    return None


def _play_sponsor_card(
    state: MutableMapping[str, Any], player_id: str, card_id: str, sequence: Mapping[str, Any],
    events: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    placement = sequence.get("placements", {}).get(card_id)
    error = _sponsor_play_error(state, player_id, card_id, int(sequence["level"]), int(sequence["budget"]), placement)
    if error:
        raise ValueError(error)
    player = _player(state, player_id)
    card = SPONSOR_CARDS[card_id]
    source, surcharge, _ = _source_for_card(state, player_id, card_id, None)
    player["money"] -= int(card.get("play", {}).get("base_money_cost", 0)) + int(surcharge or 0)
    if source == "hand":
        player["hand"].remove(card_id)
    else:
        _remove_display_card(state, card_id)
    player["played_sponsors"].append(card_id)
    _recompute_tags(player)
    _update_derived_metrics(player)
    refs = _reward_effects(player_id, card.get("printed_rewards", {}), f"sponsor:{card_id}")
    if card.get("unique_building"):
        refs.append(_reserve_unique_building(state, player_id, card, placement))
    refs.extend(_sponsor_effect_refs(player_id, card, "immediate"))
    refs.extend(_sponsor_effect_refs(player_id, card, "setup_and_passive"))
    for ref in _sponsor_effect_refs(player_id, card, "passive", {"register_only": True}):
        result = _dispatch_effect(state, ref)
        _consume_effect_events(state, result["events"], events)
        if result["state_updates"]:
            _deep_update(state, result["state_updates"])
    refs.extend(_card_trigger_effects(state, player_id, card))
    if int(_card_icons(card).get("herbivore", 0)) and (card_id == "253" or (
        _has_active_rule(player, "okapi_sponsor_chain") and int(player.get("card_tokens", {}).get("253", 0))
    )):
        refs.append({"type": "core", "operation": "okapi", "player_id": player_id, "card_id": card_id,
                     "label": "Okapi Stable"})
    events.append(_event("sponsor", player_id=player_id, card_id=card_id, source=source, surcharge=surcharge))
    return refs


def _continue_card_options(state: Mapping[str, Any], sequence: Mapping[str, Any]) -> List[Dict[str, Any]]:
    player_id = str(sequence["player_id"])
    player = state["players"][player_id]
    options = []
    cards = list(player["hand"])
    if int(sequence["level"]) == 2:
        cards.extend(card_id for card_id in state["display"] if card_id)
    for card_id in cards:
        if sequence["action"] == "animals":
            if card_id not in ANIMAL_CARDS:
                continue
            for building in _animal_enclosures(player):
                play = {"card_id": card_id, "enclosure_id": building["id"]}
                if not _animal_play_error(state, player_id, play, int(sequence["level"])):
                    options.append({"value": play, "label": f"{ANIMAL_CARDS[card_id]['name']['zh']} → {_enclosure_label(building)}"})
        elif card_id in SPONSOR_CARDS and not _sponsor_play_error(
            state, player_id, card_id, int(sequence["level"]), int(sequence["budget"])
        ):
            options.append({"value": card_id, "label": SPONSOR_CARDS[card_id]["name"]["zh"]})
    return options


def _advance_card_sequence(state: MutableMapping[str, Any], events: List[Dict[str, Any]]) -> None:
    sequence = state["card_sequence"]
    player_id = str(sequence["player_id"])
    action_id = str(sequence["action"])
    planned = sequence["planned"]
    if planned:
        play = planned.pop(0)
        if action_id == "animals":
            error = _animal_play_error(state, player_id, play, int(sequence["level"]))
        else:
            error = _sponsor_play_error(state, player_id, str(play), int(sequence["level"]), int(sequence["budget"]),
                                        sequence.get("placements", {}).get(str(play)))
        if error:
            if not sequence["played"]:
                raise ValueError(error)
            # A choice on the previous card can change the proposed second play.
            # Keep the completed card and let the player choose a legal continuation.
            planned.clear()
            sequence["interactive"] = True
            events.append(_event("card_plan_changed", player_id=player_id, reason=error))
        else:
            if action_id == "animals":
                refs, after = _play_animal_card(state, player_id, play, int(sequence["level"]), int(sequence["strength"]), events)
                sequence["after"].extend(after)
                sequence["sizes"].append(_animal_size_class(ANIMAL_CARDS[str(play["card_id"])]))
            else:
                refs = _play_sponsor_card(state, player_id, str(play), sequence, events)
                sequence["budget"] -= int(SPONSOR_CARDS[str(play)]["play"]["strength_required"])
            sequence["played"] += 1
            state.setdefault("effect_queue", []).append(_effect_group(player_id, refs))
            return
    if sequence["interactive"] and sequence["played"] < sequence["maximum"]:
        options = _continue_card_options(state, sequence)
        if options:
            _queue_choice(state, {
                "choice_id": f"continue-{action_id}-{player_id}-{sequence['played']}",
                "type": "continue_cards", "player_id": player_id,
                "prompt": "Play the next card, or finish this action",
                "options": options, "min": 0, "max": 1, "allow_skip": True,
            })
            return
    state.pop("card_sequence")
    _defer_turn_end(state, player_id, action_id, int(sequence["x_tokens"]), events, resume=False)
    after = list(sequence["after"])
    if (action_id == "animals" and sequence["sizes"] and all(size == "small" for size in sequence["sizes"])
            and _has_active_rule(_player(state, player_id), "small_animal_action_chain")):
        after.append({"type": "core", "operation": "small_program", "player_id": player_id,
                      "label": "WAZA Small Animal Program"})
    if state.get("multiplier_action"):
        state.setdefault("deferred_after_action_effects", []).extend(after)
    else:
        after = list(state.pop("deferred_after_action_effects", [])) + after
        after.extend(state.pop("after_action_core_effects", []))
        if after:
            state.setdefault("effect_queue", []).append(_effect_group(player_id, after))


def _perform_animals_action(
    state: MutableMapping[str, Any], player_id: str, action: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    x_tokens, error = _validate_x_tokens(player, action.get("x_tokens", 0))
    if error:
        return error
    assert x_tokens is not None
    strength = _action_strength(state, player_id, "animals", x_tokens)
    if strength < 1:
        return "Constriction leaves this action below strength 1"
    level = _action_level(player, "animals")
    face = ACTION_DEFS["animals"]["sides"]["II" if level == 2 else "I"]
    maximum = int(face["maximum_cards_by_strength"][str(min(5, strength))])
    plays = action.get("plays")
    if not isinstance(plays, list) or not plays or not all(isinstance(play, Mapping) for play in plays):
        return "Animals requires at least one card"
    if len(plays) > maximum:
        return "too many animal cards for this action strength"
    if not isinstance(action.get("gain_reputation", True), bool):
        return "invalid Animals reputation choice"
    player["x_tokens"] -= x_tokens
    state["card_sequence"] = {
        "player_id": player_id, "action": "animals", "strength": strength, "level": level,
        "maximum": maximum, "played": 0, "planned": copy.deepcopy(plays),
        "interactive": bool(action.get("continue_action", False)), "x_tokens": x_tokens,
        "after": [], "sizes": [],
    }
    if level == 2 and strength >= 5 and action.get("gain_reputation", True):
        _apply_rewards(state, player_id, face.get("strength_5_bonus", {}), events, "animals_II_strength_5")
    _resume_if_clear(state, events)
    return None


def _small_animal_program_choice(
    state: Mapping[str, Any], player_id: str
) -> Optional[Dict[str, Any]]:
    player = state["players"][player_id]
    if not _has_active_rule(player, "small_animal_action_chain"):
        return None
    options: List[Dict[str, Any]] = [{"value": "skip", "label": "Do not play an extra small animal"}]
    for card_id in player.get("hand", []):
        card = ANIMAL_CARDS.get(card_id)
        if not card or _animal_size_class(card) != "small" or not _card_conditions_met(player, card):
            continue
        if _animal_cost(player, card) > int(player.get("money", 0)):
            continue
        for building in _animal_enclosures(player):
            _, _, error = _enclosure_for_animal(player, card, str(building["id"]))
            if error is None:
                options.append({
                    "value": {"card_id": card_id, "enclosure_id": building["id"]},
                    "label": f"{card.get('name', {}).get('zh', card_id)} → {_enclosure_label(building)}",
                })
    return {
        "choice_id": f"small-animal-program-{player_id}", "type": "small_animal_program",
        "player_id": player_id, "prompt": "Optionally play one extra small animal",
        "options": options, "min": 1, "max": 1,
    }


def _queue_small_display_choice(state: MutableMapping[str, Any], player_id: str) -> None:
    available = [
        card_id for card_id in state.get("display", [])
        if card_id and card_id in ANIMAL_CARDS and _animal_size_class(ANIMAL_CARDS[card_id]) == "small"
    ]
    if not available:
        return
    _queue_choice(state, {
        "choice_id": f"small-display-{player_id}", "type": "take_small_display",
        "player_id": player_id, "prompt": "Take one small animal from the display",
        "options": _choice_options(available), "min": 1, "max": 1,
    })


def _okapi_sponsor_options(state: Mapping[str, Any], player_id: str) -> List[str]:
    player = state["players"][player_id]
    options = []
    for card_id in player.get("hand", []):
        card = SPONSOR_CARDS.get(card_id)
        if not card or not _card_conditions_met(player, card):
            continue
        if int(card.get("play", {}).get("strength_required", 0)) > int(player.get("money", 0)):
            continue
        unique = card.get("unique_building")
        if unique and _find_placement(
            state, player_id, str(unique["id"]), int(unique.get("footprint", {}).get("cell_count", 0)), unique
        ) is None:
            continue
        options.append(card_id)
    return options


def _queue_okapi_trigger(
    state: MutableMapping[str, Any], player_id: str, trigger_card: Mapping[str, Any]
) -> None:
    player = _player(state, player_id)
    icon_count = int(_card_icons(trigger_card).get("herbivore", 0))
    tokens = int(player.get("card_tokens", {}).get("253", 0))
    if not icon_count or not tokens or not _has_active_rule(player, "okapi_sponsor_chain"):
        return
    sponsors = _okapi_sponsor_options(state, player_id)
    if not sponsors:
        return
    options = [{"value": "skip", "label": "Do not use an Okapi Stable token"}]
    options.extend({
        "value": card_id,
        "label": f"{SPONSOR_CARDS[card_id].get('name', {}).get('zh', card_id)} "
        f"({SPONSOR_CARDS[card_id]['play']['strength_required']} money)",
    } for card_id in sponsors)
    state.setdefault("pending_queue", []).append({
        "choice_id": f"okapi-{player_id}-{len(state.get('pending_queue', []))}",
        "type": "okapi_sponsor", "player_id": player_id,
        "remaining": min(icon_count, tokens), "prompt": "Optionally use Okapi Stable",
        "options": options, "min": 1, "max": 1,
    })


def _play_okapi_sponsor(
    state: MutableMapping[str, Any], player_id: str, card_id: str, events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    if card_id not in _okapi_sponsor_options(state, player_id):
        return "sponsor is not legal for Okapi Stable"
    card = SPONSOR_CARDS[card_id]
    cost = int(card["play"]["strength_required"])
    player["money"] -= cost
    player["hand"].remove(card_id)
    player["played_sponsors"].append(card_id)
    if card_id == "253":
        player.setdefault("card_tokens", {}).setdefault("253", 3)
        player.setdefault("active_effects", {}).setdefault("253-printed-1", {
            "op": "setup_tokens", "count": 3, "modifier": "okapi_sponsor_chain", "card_id": "253",
        })
    _recompute_tags(player)
    _update_derived_metrics(player)
    refs = _reward_effects(player_id, card.get("printed_rewards", {}), f"sponsor:{card_id}")
    if card.get("unique_building"):
        refs.append(_reserve_unique_building(state, player_id, card))
    refs.extend(_sponsor_effect_refs(player_id, card, "immediate"))
    refs.extend(_sponsor_effect_refs(player_id, card, "setup_and_passive"))
    for ref in _sponsor_effect_refs(player_id, card, "passive", {"register_only": True}):
        result = _dispatch_effect(state, ref)
        _consume_effect_events(state, result["events"], events)
        if result["state_updates"]:
            _deep_update(state, result["state_updates"])
    refs.extend(_card_trigger_effects(state, player_id, card))
    if int(_card_icons(card).get("herbivore", 0)):
        refs.append({"type": "core", "operation": "okapi", "player_id": player_id,
                     "card_id": card_id, "label": "Okapi Stable"})
    events.append(_event("sponsor", player_id=player_id, card_id=card_id, source="okapi", cost=cost))
    _enqueue_card_effects(state, [_effect_group(player_id, refs)], events)
    return None


def _play_program_animal(
    state: MutableMapping[str, Any], player_id: str, value: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    card = ANIMAL_CARDS.get(str(value.get("card_id", "")))
    if not card or str(card["id"]) not in _player(state, player_id)["hand"] or _animal_size_class(card) != "small":
        return "invalid WAZA small-animal choice"
    refs, after = _play_animal_card(state, player_id, value, 1, 0, events)
    _enqueue_card_effects(state, [_effect_group(player_id, refs), _effect_group(player_id, after)], events)
    return None


def _reserve_unique_building(
    state: MutableMapping[str, Any], player_id: str, card: Mapping[str, Any],
    placement: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    unique = card["unique_building"]
    state.setdefault("pending_unique_buildings", []).append({
        "player_id": player_id, "card_id": card["id"], "building_type": unique["id"],
        "placement": copy.deepcopy(placement),
    })
    return {"type": "core", "operation": "unique_building", "player_id": player_id,
            "card_id": card["id"], "placement": copy.deepcopy(placement),
            "label": f"Place {unique.get('name_zh', unique['id'])}"}


def _unique_building_choice(
    state: MutableMapping[str, Any], player_id: str, card: Mapping[str, Any]
) -> None:
    unique = card["unique_building"]
    _queue_choice(state, {
        "choice_id": f"unique-{player_id}-{card['id']}", "type": "place_unique_building", "player_id": player_id,
        "card_id": card["id"], "building": copy.deepcopy(unique),
        "prompt": f"Place {unique.get('name_zh', unique['id'])}",
        "options": [{"value": {"building_type": unique["id"]}, "label": unique.get("name_zh", unique["id"])}],
        "min": 1, "max": 1,
    })


def _perform_sponsors_action(
    state: MutableMapping[str, Any], player_id: str, action: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    x_tokens, error = _validate_x_tokens(player, action.get("x_tokens", 0))
    if error:
        return error
    assert x_tokens is not None
    strength = _action_strength(state, player_id, "sponsors", x_tokens)
    if strength < 1:
        return "Constriction leaves this action below strength 1"
    player["x_tokens"] -= x_tokens
    level = _action_level(player, "sponsors")
    mode = action.get("mode", "play")
    if mode == "break":
        multiplier = 2 if level == 2 else 1
        player["money"] += multiplier * strength
        _advance_break(state, strength, events, "sponsors", player_id)
        events.append(_event("sponsors_break", player_id=player_id, strength=strength, money=multiplier * strength))
        _defer_turn_end(state, player_id, "sponsors", x_tokens, events)
        return None
    if mode != "play":
        return "invalid Sponsors mode"
    card_ids = action.get("card_ids")
    if not isinstance(card_ids, list) or not card_ids or not all(isinstance(value, str) for value in card_ids):
        return "Sponsors requires one or more cards"
    if len(set(card_ids)) != len(card_ids):
        return "duplicate sponsor card"
    if level == 1 and len(card_ids) != 1:
        return "Sponsors I plays exactly one card"
    cards = [SPONSOR_CARDS.get(card_id) for card_id in card_ids]
    if any(card is None for card in cards):
        return "unknown sponsor card"
    typed_cards: List[Dict[str, Any]] = [card for card in cards if card is not None]
    total_strength = sum(int(card["play"]["strength_required"]) for card in typed_cards)
    maximum = strength + (1 if level == 2 else 0)
    if total_strength > maximum:
        return "sponsor cards exceed action strength"

    supplied_placements = action.get("unique_building_placements", {})
    if not isinstance(supplied_placements, Mapping):
        return "invalid unique building placements"
    state["card_sequence"] = {
        "player_id": player_id, "action": "sponsors", "strength": strength, "level": level,
        "budget": maximum, "maximum": 1 if level == 1 else maximum, "played": 0,
        "planned": list(card_ids), "interactive": bool(action.get("continue_action", False)),
        "x_tokens": x_tokens, "after": [], "placements": copy.deepcopy(supplied_placements),
    }
    _resume_if_clear(state, events)
    return None


def _association_worker_cost(player: Mapping[str, Any], task: str) -> int:
    used = sum(1 for item in player.get("association_worker_placements", []) if item.get("task") == task)
    return used + 1


def _queue_association_tile_upgrade(
    state: MutableMapping[str, Any], player_id: str, source: str
) -> None:
    """Grant the printed upgrade under the second tile space on Map 0."""

    player = _player(state, player_id)
    available = [
        action_id for action_id in ACTION_IDS
        if not player["action_cards"][action_id].get("upgraded")
    ]
    if not available:
        return
    _queue_choice(state, {
        "choice_id": f"association-{source}-upgrade-{player_id}",
        "type": "upgrade_action", "player_id": player_id,
        "prompt": "Upgrade an Action card for your second Association tile",
        "options": _choice_options(available), "min": 1, "max": 1,
    })


def _queue_association_tile_icon_effects(
    state: MutableMapping[str, Any], player_id: str, tile_id: str, icons: Mapping[str, int]
) -> None:
    """Broadcast icons gained from partner zoos and universities."""

    trigger_tile = {
        "id": tile_id,
        "card_type": "association_tile",
        "icons": [
            {"tag": tag, "count": int(count)}
            for tag, count in icons.items() if int(count) > 0
        ],
    }
    state.setdefault("effect_queue", []).extend(
        _card_trigger_effects(state, player_id, trigger_tile)
    )


def _take_partner_zoo(
    state: MutableMapping[str, Any], player_id: str, continent: str, events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    if continent not in CONTINENTS:
        return "unknown partner zoo continent"
    if continent in player["partner_zoos"]:
        return "partner zoo already owned"
    supply = state.setdefault("association_supply", {}).setdefault("partner_zoos", [])
    if continent not in supply:
        return "partner zoo is not on the Association board"
    limit = 4 if _action_level(player, "association") == 2 else 2
    if len(player["partner_zoos"]) >= limit:
        return "Association II is required for more partner zoos"
    player["partner_zoos"].append(continent)
    supply.remove(continent)
    _recompute_tags(player)
    _queue_association_tile_icon_effects(state, player_id, f"partner_zoo:{continent}", {continent: 1})
    if len(player["partner_zoos"]) == 2:
        _queue_association_tile_upgrade(state, player_id, "partner-zoo")
    elif len(player["partner_zoos"]) == 3:
        old_workers = int(player.get("association_workers_total", 1))
        player["association_workers_total"] = min(4, old_workers + 1)
        player["available_workers"] = int(player.get("available_workers", 0)) + (
            int(player["association_workers_total"]) - old_workers
        )
        events.append(_event(
            "association_tile_bonus", player_id=player_id,
            source="third_partner_zoo", reward="worker",
        ))
    elif len(player["partner_zoos"]) == 4:
        _apply_rewards(
            state, player_id, {"conservation": 3}, events,
            "fourth_partner_zoo",
        )
    events.append(_event("partner_zoo", player_id=player_id, continent=continent))
    return None


def _take_university(
    state: MutableMapping[str, Any], player_id: str, university_id: str, events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    university = next((item for item in UNIVERSITIES if item["id"] == university_id), None)
    if not university:
        return "unknown university"
    if university_id in player["universities"]:
        return "university already owned"
    supply = state.setdefault("association_supply", {}).setdefault("universities", [])
    if university_id not in supply:
        return "university is not on the Association board"
    if len(player["universities"]) >= 3:
        return "all university spaces are occupied"
    player["universities"].append(university_id)
    supply.remove(university_id)
    if university.get("hand_limit"):
        player["hand_limit"] = max(int(player["hand_limit"]), int(university["hand_limit"]))
    _apply_rewards(state, player_id, {"reputation": university.get("reputation", 0)}, events, university_id)
    _recompute_tags(player)
    science_icons = int(university.get("science", 0))
    if science_icons:
        _queue_association_tile_icon_effects(
            state, player_id, university_id, {"science": science_icons},
        )
    if len(player["universities"]) == 2:
        _queue_association_tile_upgrade(state, player_id, "university")
    elif len(player["universities"]) == 3:
        _apply_rewards(
            state, player_id, {"conservation": 2}, events,
            "third_university",
        )
    events.append(_event("university", player_id=player_id, university_id=university_id))
    return None


def _add_project_to_board(
    state: MutableMapping[str, Any], player_id: str, card_id: str, source: str
) -> Optional[str]:
    player = _player(state, player_id)
    if card_id not in PROJECT_CARDS:
        return "unknown conservation project"
    if source == "hand":
        if card_id not in player["hand"]:
            return "project card is not in hand"
        player["hand"].remove(card_id)
    elif source == "display":
        if _action_level(player, "association") != 2:
            return "Association II is required to play a project from display"
        if not _display_accessible(state, player_id, card_id):
            return "project card is outside your reputation range"
        surcharge = list(state["display"]).index(card_id) + 1
        if player["money"] < surcharge:
            return "not enough money for display surcharge"
        player["money"] -= surcharge
        _remove_display_card(state, card_id)
    else:
        return "invalid project source"
    dynamic = state.setdefault("dynamic_projects", [])
    limit = len(state["turn_order"])
    if len(dynamic) >= limit:
        removed = dynamic.pop(0)
        if removed in state["projects"]:
            state["projects"].remove(removed)
        state.setdefault("discard", []).append(removed)
        state.setdefault("project_slots", {}).pop(removed, None)
    dynamic.append(card_id)
    state["projects"].append(card_id)
    state["project_slots"][card_id] = []
    return None


def _is_original_base_project(state: Mapping[str, Any], project_id: str) -> bool:
    return (project_id in state.get("projects", [])
            and project_id not in state.get("dynamic_projects", [])
            and PROJECT_CARDS.get(project_id, {}).get("deck_group") == "base_setup")


def _support_project(
    state: MutableMapping[str, Any], player_id: str, task: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    markers_remaining = int(
        player.get(
            "conservation_markers_remaining",
            max(0, 7 - len(player.get("claimed_map_rewards", []))),
        )
    )
    if markers_remaining <= 0:
        return "no conservation marker remains"
    project_id = str(task.get("project_id") or task.get("project_card_id") or "")
    newly_added = False
    if project_id not in state["projects"]:
        source = "hand" if project_id in player["hand"] else "display" if project_id in state["display"] else ""
        error = _add_project_to_board(state, player_id, project_id, source)
        if error:
            return error
        newly_added = True
    project = PROJECT_CARDS.get(project_id)
    if not project:
        return "unknown conservation project"
    already_supported = any(
        item.get("project_id", item.get("card_id")) == project_id
        for item in player["supported_projects"]
    )
    repeat_release = (
        project.get("project_type") == "release"
        and _has_active_rule(player, "release_project_bonus")
    )
    if already_supported and not repeat_release:
        return "you already supported this project"
    occupied = _occupied_project_positions(state, project_id)
    requested_slot = task.get("slot", task.get("slot_position"))
    release_animal_id = task.get("release_animal_id", task.get("animal_id"))
    wild_token_card_id = str(task.get("wild_token_card_id", "") or "")
    wild_icons = 0
    if wild_token_card_id:
        if not _is_original_base_project(state, project_id):
            return "wild project token only applies to the original base projects"
        rule = next(
            (
                value for value in _active_rules(player, "base_project_wild_icon")
                if str(value.get("card_id", "")) == wild_token_card_id
            ),
            None,
        )
        if rule is None or int(player.get("card_tokens", {}).get(wild_token_card_id, 0)) <= 0:
            return "base-project wild token is unavailable"
        if any(
            item.get("card_id") == wild_token_card_id and item.get("project_id") == project_id
            for item in player.get("wild_project_uses", [])
        ):
            return "this card cannot spend two wild tokens on the same project"
        wild_icons = 1
    eligible = [
        slot for slot in project["support_slots"]
        if int(slot["position"]) not in occupied
        and not _project_slot_blocked(state, project_id, int(slot["position"]))
        and _project_requirement_met(
            state, player_id, project, slot,
            str(release_animal_id) if release_animal_id else None, wild_icons,
        )
    ]
    if requested_slot is None:
        if not eligible:
            return "no eligible project support slot"
        slot = eligible[0]
    else:
        if not isinstance(requested_slot, int) or isinstance(requested_slot, bool):
            return "invalid project slot"
        slot = next((item for item in eligible if int(item["position"]) == requested_slot), None)
        if slot is None:
            return "project support slot is not eligible"
    if project.get("project_type") == "release":
        if not release_animal_id:
            return "release project requires an animal"
        _remove_released_animal(state, player_id, str(release_animal_id), events)
    rewards = dict(slot.get("reward", {}))
    if project.get("project_type") == "release":
        for rule in _active_rules(player, "release_project_bonus"):
            rewards["conservation"] = int(rewards.get("conservation", 0)) + int(rule.get("conservation", 0))
    if newly_added:
        for key, amount in project.get("new_project_bonus", {}).items():
            rewards[key] = int(rewards.get(key, 0)) + int(amount)
    state["project_slots"].setdefault(project_id, []).append({
        "position": int(slot["position"]), "player_id": player_id,
    })
    player["supported_projects"].append({"project_id": project_id, "position": int(slot["position"])})
    if wild_token_card_id:
        player["card_tokens"][wild_token_card_id] -= 1
        player.setdefault("wild_project_uses", []).append({
            "card_id": wild_token_card_id, "project_id": project_id,
        })
    _update_derived_metrics(player)
    _apply_rewards(state, player_id, rewards, events, f"project:{project_id}")
    reward_id = task.get("reward_id")
    if reward_id:
        try:
            _claim_map_reward(state, player_id, str(reward_id), events)
        except ValueError as exc:
            return str(exc)
    else:
        available = [value for value in MAP_REWARDS if value not in player["claimed_map_rewards"]]
        _queue_choice(state, {
            "choice_id": f"map-reward-{player_id}-{len(player['supported_projects'])}", "type": "choose_map_reward",
            "player_id": player_id, "prompt": "Choose a Map 0 conservation reward",
            "options": _choice_options(available, {value: MAP_REWARDS[value]["label"] for value in available}),
            "min": 1, "max": 1,
        })
    events.append(_event("project", player_id=player_id, project_id=project_id, position=int(slot["position"]), rewards=rewards))
    return None


def _perform_association_action(
    state: MutableMapping[str, Any], player_id: str, action: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    x_tokens, error = _validate_x_tokens(player, action.get("x_tokens", 0))
    if error:
        return error
    assert x_tokens is not None
    strength = _action_strength(state, player_id, "association", x_tokens)
    if strength < 1:
        return "Constriction leaves this action below strength 1"
    level = _action_level(player, "association")
    tasks = action.get("tasks")
    if not isinstance(tasks, list) or not tasks or not all(isinstance(value, Mapping) for value in tasks):
        return "Association requires at least one task"
    if level == 1 and len(tasks) != 1:
        return "Association I performs exactly one task"
    task_strengths = {
        "reputation": 2, "gain_2_reputation": 2,
        "partner_zoo": 3, "take_partner_zoo": 3,
        "university": 4, "take_university": 4,
        "support_project": 5, "support_conservation_project": 5,
    }
    canonical = {
        "gain_2_reputation": "reputation", "take_partner_zoo": "partner_zoo",
        "take_university": "university", "support_conservation_project": "support_project",
    }
    task_names = [canonical.get(str(task.get("task")), str(task.get("task"))) for task in tasks]
    if any(name not in {"reputation", "partner_zoo", "university", "support_project"} for name in task_names):
        return "unknown association task"
    if len(set(task_names)) != len(task_names):
        return "Association II tasks must be different"
    project_strength = 5
    for rule in _active_rules(player, "project_task_strength"):
        project_strength = min(project_strength, int(rule.get("value", 5)))
    task_strengths["support_project"] = project_strength
    if sum(task_strengths[name] for name in task_names) > strength:
        return "association tasks exceed action strength"
    player["x_tokens"] -= x_tokens

    donate = action.get("donate", False)
    if donate and level != 2:
        return "Association II is required to donate"
    refs = [{"type": "core", "operation": "association_step", "player_id": player_id,
             "task": copy.deepcopy(task), "name": name} for task, name in zip(tasks, task_names)]
    if donate:
        refs.append({"type": "core", "operation": "donation", "player_id": player_id, "amount": donate})
    refs.append({"type": "core", "operation": "finish_action", "player_id": player_id,
                 "action": "association", "x_tokens": x_tokens})
    _enqueue_card_effects(state, refs, events)
    _resume_if_clear(state, events)
    return None


def _perform_association_task(state: MutableMapping[str, Any], player_id: str, task: Mapping[str, Any], name: str, events: List[Dict[str, Any]]) -> None:
    player = _player(state, player_id)
    worker_cost = _association_worker_cost(player, name)
    if worker_cost > 3:
        raise ValueError("association task is blocked by your workers")
    if worker_cost > int(player["available_workers"]):
        raise ValueError("not enough available association workers")
    if name == "reputation":
        _apply_rewards(state, player_id, {"reputation": 2}, events, "association")
    elif name == "partner_zoo":
        task_error = _take_partner_zoo(state, player_id, str(task.get("continent", "")), events)
        if task_error:
            raise ValueError(task_error)
    elif name == "university":
        task_error = _take_university(state, player_id, str(task.get("university_id", "")), events)
        if task_error:
            raise ValueError(task_error)
    else:
        task_error = _support_project(state, player_id, task, events)
        if task_error:
            raise ValueError(task_error)
    player["available_workers"] -= worker_cost
    player["association_worker_placements"].extend({"task": name} for _ in range(worker_cost))
    events.append(_event("association_task", player_id=player_id, task=name, workers=worker_cost))


def _perform_donation(state: MutableMapping[str, Any], player_id: str, donate: Any, events: List[Dict[str, Any]]) -> None:
    player = _player(state, player_id)
    available_slots = [
        slot for slot in state["association_supply"].get("donation_slots", [])
        if not slot.get("blocked") and slot.get("occupied_by") is None
    ]
    chosen_slot = min(available_slots, key=lambda item: int(item["cost"])) if available_slots else None
    cost = int(chosen_slot["cost"]) if chosen_slot else 12
    if isinstance(donate, int) and not isinstance(donate, bool) and donate != cost:
        raise ValueError("donation amount does not match the smallest space")
    if player["money"] < cost:
        raise ValueError("not enough money to donate")
    player["money"] -= cost
    if chosen_slot:
        chosen_slot["occupied_by"] = player_id
    _apply_rewards(state, player_id, {"conservation": 1}, events, "donation")
    events.append(_event("donation", player_id=player_id, amount=cost, slot_id=chosen_slot and chosen_slot["id"]))


def _selection_from_action(action: Mapping[str, Any]) -> Any:
    if "selection" in action:
        return action["selection"]
    for key in ("selected_ids", "card_ids", "card_id", "value"):
        if key in action:
            return action[key]
    return None


def _as_selected_list(selection: Any) -> List[Any]:
    if selection is None:
        return []
    if isinstance(selection, list):
        return list(selection)
    return [selection]


def _effect_choice_payload(pending: Mapping[str, Any], selection: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"selection": selection}
    selected = _as_selected_list(selection)
    if (
        not selected
        and int(pending.get("min", pending.get("minimum", 1))) == 0
        and bool(pending.get("allow_skip", pending.get("optional", False)))
    ):
        # The browser represents Skip as an empty selection.  Effect handlers
        # use an explicit flag so they can distinguish an optional skip from a
        # malformed placement payload.
        payload["skip"] = True
    ids = []
    for value in selected:
        if isinstance(value, Mapping):
            payload.update(value)
            identifier = value.get("id", value.get("value", value.get("card_id")))
        else:
            identifier = value
        if identifier is not None:
            ids.append(str(identifier))
    payload["selected_ids"] = ids
    options = pending.get("options", [])
    for identifier in ids:
        option = next(
            (item for item in options if str(item.get("id", item.get("value", ""))) == identifier), None
        )
        if isinstance(option, Mapping):
            payload.update(option)
    kind = pending.get("type", pending.get("kind"))
    if isinstance(selection, Mapping):
        if kind == "place_unique_building":
            payload["placement"] = dict(selection)
        elif kind == "place_free_building":
            placement = dict(selection)
            payload["placement"] = placement
            payload["placements"] = [placement]
        elif kind == "resolve_attack" and "assignments" not in payload:
            payload["assignments"] = list(selection.get("assignments", []))
    elif kind == "place_free_building" and isinstance(selection, list):
        payload["placements"] = [dict(value) for value in selection if isinstance(value, Mapping)]
    if kind == "resolve_attack" and "assignments" not in payload:
        assignments = []
        for identifier in ids:
            option = next(
                (
                    item for item in options
                    if str(item.get("id", item.get("value", ""))) == identifier
                ),
                {},
            )
            assignments.append({
                "target_player_id": str(option.get("target_player_id", identifier)),
                **({"criterion": option["criterion"]} if option.get("criterion") else {}),
            })
        payload["assignments"] = assignments
    return payload


def _apply_bonus_token(
    state: MutableMapping[str, Any], player_id: str, token_id: str, events: List[Dict[str, Any]]
) -> Optional[str]:
    player = _player(state, player_id)
    token = BONUS_TOKEN_DEFS.get(token_id)
    if not token:
        return "unknown bonus token"
    kind = token["kind"]
    amount = int(token.get("amount", 0))
    if kind == "money":
        player["money"] += amount
    elif kind == "reputation":
        _apply_rewards(state, player_id, {"reputation": amount}, events, f"bonus_token:{token_id}")
    elif kind == "appeal":
        _apply_rewards(state, player_id, {"appeal": amount}, events, f"bonus_token:{token_id}")
    elif kind == "x_token":
        _gain_x(player, amount)
    elif kind == "card":
        for _ in range(amount):
            card_id = _draw(state)
            if card_id:
                player["hand"].append(card_id)
    elif kind == "worker":
        if int(player["association_workers_total"]) >= 4:
            return "all association workers are active"
        player["association_workers_total"] += 1
        player["available_workers"] += 1
    elif kind == "free_enclosure":
        size = int(token.get("size", 3))
        if _find_placement(state, player_id, "standard_enclosure", size) is not None:
            _queue_choice(state, {
                "choice_id": f"bonus-enclosure-{player_id}-{token_id}", "type": "place_free_enclosure",
                "player_id": player_id, "size": size, "prompt": "Place the free enclosure",
                "options": [], "min": 1, "max": 1,
            })
    elif kind == "multiplier":
        _queue_choice(state, {
            "choice_id": f"bonus-multiplier-{player_id}", "type": "place_multiplier",
            "player_id": player_id, "prompt": "Place the multiplier on an Action card",
            "options": _choice_options(ACTION_IDS), "min": 1, "max": 1,
        })
    elif kind == "upgrade":
        available = [action_id for action_id in ACTION_IDS if not player["action_cards"][action_id].get("upgraded")]
        if not available:
            return "all Action cards are already upgraded"
        _queue_choice(state, {
            "choice_id": f"bonus-upgrade-{player_id}", "type": "upgrade_action",
            "player_id": player_id, "prompt": "Upgrade an Action card",
            "options": _choice_options(available), "min": 1, "max": 1,
        })
    events.append(_event("bonus_token", player_id=player_id, token_id=token_id))
    return None


def _queue_digging_operation(
    state: MutableMapping[str, Any], player_id: str, remaining: int
) -> None:
    options = [{"value": "stop", "label": "Stop digging"}]
    if any(state.get("display", [])):
        options.insert(0, {"value": "discard_display", "label": "Discard and refill a display card"})
    if state["players"][player_id].get("hand"):
        options.insert(0, {"value": "cycle_hand", "label": "Discard a hand card and draw one"})
    _queue_choice(state, {
        "choice_id": f"digging-{player_id}-{remaining}", "type": "digging_operation",
        "player_id": player_id, "remaining": int(remaining),
        "prompt": f"Choose a digging operation ({remaining} remaining)",
        "options": options, "min": 1, "max": 1,
    })


def _selected_choice_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return value.get("value", value.get("id", value.get("card_id")))
    return value


def _resolve_choice(
    state: MutableMapping[str, Any], player_id: str, action: Mapping[str, Any], events: List[Dict[str, Any]]
) -> Optional[str]:
    pending = state.get("pending_choice")
    if not isinstance(pending, Mapping):
        return "no pending choice"
    if pending.get("player_id") != player_id:
        return "not your choice"
    if action.get("choice_id") is not None and action.get("choice_id") != pending.get("choice_id"):
        return "choice id does not match"
    selection = _selection_from_action(action)
    selected = _as_selected_list(selection)
    minimum = int(pending.get("min", pending.get("minimum", 1)))
    maximum = int(pending.get("max", pending.get("maximum", 1)))
    if not minimum <= len(selected) <= maximum:
        return "wrong number of selections"
    choice_type = str(pending.get("type", pending.get("kind", "")))
    player = _player(state, player_id)
    suspended_effects = state.get("effect_queue", [])
    suspended_choices = state.get("pending_queue", [])
    state["effect_queue"] = []
    state["pending_queue"] = []

    if choice_type == "finish_action_plan":
        if _selected_choice_value(selected[0]) != "finish":
            return "finish the remaining action plan"
        state["pending_choice"] = None
    elif choice_type == "release_enclosure":
        state["pending_choice"] = None
        _empty_animal_space(player, ANIMAL_CARDS[str(pending["card_id"])], str(_selected_choice_value(selected[0])))
        _update_derived_metrics(player)
    elif choice_type == "move_animals":
        state["pending_choice"] = None
        if selected:
            value = selected[0]
            if isinstance(value, Mapping) and "value" in value:
                value = value["value"]
            if not isinstance(value, Mapping):
                return "invalid animal movement"
            _move_animal(state, pending["_migration"], value, events)
    elif choice_type == "effect_order":
        value = _selected_choice_value(selected[0])
        refs = list(pending["_effects"])
        state["pending_choice"] = None
        if value == "all":
            own = [ref for ref in refs if ref["player_id"] == player_id]
            others = [ref for ref in refs if ref["player_id"] != player_id]
            state.setdefault("effect_queue", [])[0:0] = own + ([_effect_group(player_id, others)] if others else [])
        elif isinstance(value, int) and not isinstance(value, bool) and 0 <= value < len(refs) and refs[value]["player_id"] == player_id:
            chosen = refs.pop(value)
            remaining = [_effect_group(player_id, refs)] if refs else []
            state.setdefault("effect_queue", [])[0:0] = [chosen] + remaining
        else:
            return "invalid effect order"
    elif choice_type == "draw_card":
        sequence = state.get("cards_draw_sequence")
        value = str(_selected_choice_value(selected[0]))
        if not sequence or sequence["player_id"] != player_id or not sequence["remaining"]:
            return "no Cards draw to continue"
        if value not in [option["value"] for option in pending["options"]]:
            return "invalid card source"
        if value == "deck":
            card_id = _draw(state)
            if not card_id:
                return "no card remains in the deck"
            sequence["drawn"].append(card_id)
        else:
            card_id = value.removeprefix("display:")
            if not _display_accessible(state, player_id, card_id):
                return "display card is outside your reputation range"
            _remove_display_card(state, card_id)
            sequence["market_cards"].append(card_id)
        player["hand"].append(card_id)
        sequence["remaining"] -= 1
        state["pending_choice"] = None
    elif choice_type == "continue_cards":
        sequence = state.get("card_sequence")
        if not sequence or sequence["player_id"] != player_id:
            return "no card action to continue"
        state["pending_choice"] = None
        if not selected:
            sequence["interactive"] = False
        else:
            value = selected[0]
            if isinstance(value, Mapping) and "value" in value:
                value = value["value"]
            if value not in [option["value"] for option in _continue_card_options(state, sequence)]:
                return "card is no longer a legal continuation"
            sequence["planned"].append(value)
    elif choice_type in {"digging", "digging_operation"}:
        operation = str(_selected_choice_value(selected[0]))
        remaining = int(pending.get("remaining", 0))
        state["pending_choice"] = None
        if operation == "stop":
            events.append(_event("digging_stop", player_id=player_id))
        elif operation in {"discard_display", "cycle_hand"}:
            values = (
                [card_id for card_id in state.get("display", []) if card_id]
                if operation == "discard_display" else list(player.get("hand", []))
            )
            _queue_choice(state, {
                "choice_id": f"digging-card-{player_id}-{remaining}", "type": "digging_card",
                "player_id": player_id, "remaining": remaining, "operation": operation,
                "prompt": "Choose the card for Digging", "options": _choice_options(values),
                "min": 1, "max": 1,
            })
        else:
            return "invalid digging operation"
    elif choice_type == "digging_card":
        card_id = str(_selected_choice_value(selected[0]))
        operation = str(pending.get("operation", ""))
        if operation == "discard_display":
            if card_id not in state.get("display", []):
                return "Digging card is no longer in the display"
            _remove_display_card(state, card_id)
            state["discard"].append(card_id)
            _refill_display(state)
            state["display_dirty"] = False
        elif operation == "cycle_hand":
            if card_id not in player.get("hand", []):
                return "Digging card is no longer in hand"
            player["hand"].remove(card_id)
            state["discard"].append(card_id)
            drawn = _draw(state)
            if drawn:
                player["hand"].append(drawn)
        else:
            return "invalid digging operation"
        state["pending_choice"] = None
        remaining = int(pending.get("remaining", 1)) - 1
        events.append(_event("digging", player_id=player_id, operation=operation, card_id=card_id))
        if remaining > 0:
            _queue_digging_operation(state, player_id, remaining)
    elif choice_type == "pilfering":
        choice = str(_selected_choice_value(selected[0]))
        attacker_id = str(pending.get("attacker_id", ""))
        if attacker_id not in state["players"]:
            return "unknown pilfering player"
        attacker = _player(state, attacker_id)
        if choice == "money":
            if player.get("hand") and int(player.get("money", 0)) < 5:
                return "must give a random card when unable to pay 5 money"
            amount = min(5, int(player.get("money", 0)))
            player["money"] -= amount
            attacker["money"] += amount
            card_id = None
        elif choice == "card":
            if not player.get("hand"):
                return "no hand card available for pilfering"
            counter = int(state.get("effect_random_counter", 0)) + 1
            state["effect_random_counter"] = counter
            rng = random.Random(f"{state.get('rng_seed')}:{counter}:pilfering")
            card_id = rng.choice(list(player["hand"]))
            player["hand"].remove(card_id)
            attacker["hand"].append(card_id)
            amount = 0
        else:
            return "invalid pilfering choice"
        state["pending_choice"] = None
        events.append(_event(
            "pilfering", player_id=attacker_id, target_player_id=player_id,
            money=amount, card_id=card_id, criterion=pending.get("criterion"),
        ))
    elif choice_type == "hypnosis_action":
        if not selected:
            state["pending_choice"] = None
            events.append(_event(
                "optional_effect_skipped", player_id=player_id, source="hypnosis",
            ))
            state["effect_queue"].extend(suspended_effects)
            state["pending_queue"].extend(suspended_choices)
            _resume_if_clear(state, events)
            return None
        action_id = str(_selected_choice_value(selected[0]))
        target_id = str(pending.get("target_player_id", ""))
        if target_id not in state["players"]:
            return "unknown hypnosis target"
        target = _player(state, target_id)
        if action_id not in target["action_cards"] or _action_slot(target, action_id) > 3:
            return "hypnosis must use a target Action card in slots 1-3"
        extra = {
            "player_id": player_id, "action": action_id,
            "strength": _action_slot(target, action_id), "move_after": True,
            "allow_x_alternative": True, "action_card_owner": target_id,
            "action_level": _action_level(target, action_id), "hypnosis": True, "optional": True,
        }
        state["pending_choice"] = None
        events.append(_event(
            "hypnosis", player_id=player_id, target_player_id=target_id, action_card=action_id,
        ))
        state["effect_queue"].extend(suspended_effects)
        state["pending_queue"].extend(suspended_choices)
        _suspend_for_extra_action(state, extra, events)
        return None
    elif choice_type == "small_animal_program":
        value = selected[0]
        if isinstance(value, Mapping) and "value" in value:
            value = value["value"]
        state["pending_choice"] = None
        if value != "skip":
            if not isinstance(value, Mapping):
                return "invalid WAZA small-animal choice"
            error = _play_program_animal(state, player_id, value, events)
            if error:
                return error
        state.setdefault("effect_queue", []).append({
            "type": "core", "operation": "small_display", "player_id": player_id,
        })
    elif choice_type == "take_small_display":
        card_id = str(_selected_choice_value(selected[0]))
        if (
            card_id not in state.get("display", []) or card_id not in ANIMAL_CARDS
            or _animal_size_class(ANIMAL_CARDS[card_id]) != "small"
        ):
            return "small animal is no longer available in the display"
        _remove_display_card(state, card_id)
        player["hand"].append(card_id)
        state["pending_choice"] = None
        events.append(_event("small_animal_taken", player_id=player_id, card_id=card_id))
    elif choice_type == "okapi_sponsor":
        card_id = str(_selected_choice_value(selected[0]))
        remaining = int(pending.get("remaining", 1)) - 1
        state["pending_choice"] = None
        if card_id != "skip":
            tokens = int(player.get("card_tokens", {}).get("253", 0))
            if tokens <= 0:
                return "no Okapi Stable token remains"
            player["card_tokens"]["253"] = tokens - 1
            error = _play_okapi_sponsor(state, player_id, card_id, events)
            if error:
                return error
        if remaining > 0:
            state.setdefault("effect_queue", []).append({
                "type": "core", "operation": "okapi", "player_id": player_id, "icon_count": remaining,
            })
    elif pending.get("_effect_ref"):
        payload = _effect_choice_payload(pending, selection)
        ref = copy.deepcopy(pending["_effect_ref"])
        ref.setdefault("metadata", {})["pending_choice"] = copy.deepcopy(dict(pending))
        state["pending_choice"] = None
        result = _dispatch_effect(state, ref, payload)
        _consume_effect_events(state, result["events"], events)
        if result["state_updates"]:
            _deep_update(state, result["state_updates"])
        next_pending = result.get("pending_choice")
        if next_pending:
            if is_dataclass(next_pending):
                next_pending = asdict(next_pending)
            value = copy.deepcopy(dict(next_pending))
            metadata = value.get("metadata", {})
            if isinstance(metadata, Mapping) and metadata.get("refresh_display"):
                value["options"] = [
                    {"id": str(card_id), "card_id": str(card_id)}
                    for card_id in state.get("display", []) if card_id
                ]
            if (
                value.get("kind") == "take_display_cards"
                and not value.get("options")
                and int(value.get("minimum", value.get("min", 1))) > 0
            ):
                events.append(_event(
                    "effect_no_target", player_id=player_id,
                    source=str(pending["_effect_ref"].get("ability_id", pending["_effect_ref"].get("card_id", "effect"))),
                ))
            else:
                value["_effect_ref"] = copy.deepcopy(pending["_effect_ref"])
                _queue_choice(state, _normalize_pending_choice(value, pending["_effect_ref"]))
    elif choice_type == "discard_cards":
        card_ids = [str(value) for value in selected]
        if len(set(card_ids)) != len(card_ids) or any(card_id not in player["hand"] for card_id in card_ids):
            return "invalid discard selection"
        for card_id in card_ids:
            player["hand"].remove(card_id)
            state["discard"].append(card_id)
        state["pending_choice"] = None
        events.append(_event("discard", player_id=player_id, card_ids=card_ids))
    elif choice_type == "action_to_slot":
        action_id = str(selected[0])
        if action_id not in player["action_cards"]:
            return "unknown action card"
        _use_action_card(player, action_id)
        state["pending_choice"] = None
    elif choice_type == "conservation_2":
        value = selected[0]
        if not isinstance(value, Mapping):
            return "invalid conservation reward"
        if value.get("kind") == "worker":
            if int(player["association_workers_total"]) >= 4:
                return "all association workers are active"
            player["association_workers_total"] += 1
            player["available_workers"] += 1
        elif value.get("kind") == "upgrade":
            action_id = str(value.get("action", ""))
            if action_id not in player["action_cards"] or player["action_cards"][action_id].get("upgraded"):
                return "invalid action upgrade"
            player["action_cards"][action_id]["upgraded"] = True
        else:
            return "invalid conservation reward"
        state["pending_choice"] = None
    elif choice_type == "conservation_bonus":
        value = selected[0]
        if not isinstance(value, Mapping):
            return "invalid conservation bonus"
        kind = value.get("kind")
        if kind == "money":
            player["money"] += int(value.get("amount", 5))
        elif kind == "token":
            threshold = str(pending.get("threshold"))
            token_id = str(value.get("token_id", ""))
            available = state.get("bonus_tokens", {}).get(threshold, [])
            if token_id not in available:
                return "bonus token is no longer available"
            token_error = _apply_bonus_token(state, player_id, token_id, events)
            if token_error:
                return token_error
            available.remove(token_id)
        else:
            return "invalid conservation bonus"
        state["pending_choice"] = None
    elif choice_type == "reputation_snap":
        card_id = str(_selected_choice_value(selected[0]))
        if card_id not in state.get("display", []):
            return "reputation bonus card is no longer in the display"
        _remove_display_card(state, card_id)
        player["hand"].append(card_id)
        state["pending_choice"] = None
        events.append(_event(
            "reputation_snap", player_id=player_id, card_id=card_id,
        ))
    elif choice_type == "take_card":
        value = str(selected[0])
        if value == "deck":
            card_id = _draw(state)
            if card_id:
                player["hand"].append(card_id)
        elif value.startswith("display:"):
            card_id = value.split(":", 1)[1]
            if not _display_accessible(state, player_id, card_id):
                return "display card is outside your reputation range"
            _remove_display_card(state, card_id)
            player["hand"].append(card_id)
        else:
            return "invalid card source"
        state["pending_choice"] = None
    elif choice_type in {"place_multiplier", "upgrade_action"}:
        action_id = str(selected[0])
        if action_id not in player["action_cards"]:
            return "unknown action card"
        if choice_type == "place_multiplier":
            entry = player["action_cards"][action_id]
            entry["multiplier_tokens"] = int(entry.get("multiplier_tokens", 0)) + 1
        else:
            if player["action_cards"][action_id].get("upgraded"):
                return "action card is already upgraded"
            player["action_cards"][action_id]["upgraded"] = True
        state["pending_choice"] = None
    elif choice_type == "discard_final_card":
        card_id = str(selected[0])
        if card_id not in player["final_cards"]:
            return "invalid Final Scoring card"
        player["final_cards"].remove(card_id)
        state.setdefault("final_deck", []).insert(0, card_id)
        player["final_card_discarded"] = True
        state["pending_choice"] = None
    elif choice_type == "choose_map_reward":
        reward_id = str(selected[0])
        state["pending_choice"] = None
        try:
            _claim_map_reward(state, player_id, reward_id, events)
        except ValueError as exc:
            return str(exc)
    elif choice_type == "place_free_enclosure":
        value = selected[0]
        cells = value.get("cells") if isinstance(value, Mapping) else value
        if not isinstance(cells, list):
            return "free enclosure choice requires cells"
        spec = {"building_type": "standard_enclosure", "size": int(pending.get("size", 2)), "cells": cells}
        state["pending_choice"] = None
        try:
            _place_building(state, player_id, spec, events, free=True)
        except ValueError as exc:
            return str(exc)
    elif choice_type == "place_unique_building":
        value = selected[0]
        if not isinstance(value, Mapping) or not isinstance(value.get("cells"), list):
            return "unique building choice requires cells"
        card_id = str(pending.get("card_id", ""))
        card = SPONSOR_CARDS.get(card_id)
        if not card or not card.get("unique_building"):
            return "unknown unique building"
        unique = card["unique_building"]
        spec = {
            "building_type": unique["id"], "unique_card_id": card_id, "cells": value["cells"],
            "building_id": value.get("building_id", unique["id"]),
        }
        state["pending_choice"] = None
        try:
            _place_building(state, player_id, spec, events, free=True, unique=unique)
        except ValueError as exc:
            return str(exc)
    elif choice_type == "claim_placement_bonus":
        cell_id = str(selected[0])
        if (
            cell_id not in MAP_CELLS
            or not MAP_CELLS[cell_id].get("placement_bonus")
            or cell_id in player["map"]["occupancy"]
        ):
            return "placement bonus is no longer available"
        state["pending_choice"] = None
        _apply_placement_bonus(state, player_id, cell_id, events, allow_archaeologist=False, copy_bonus=True)
    else:
        return "unsupported pending choice"
    state["effect_queue"].extend(suspended_effects)
    state["pending_queue"].extend(suspended_choices)
    _resume_if_clear(state, events)
    return None


def _normalize_pending_choice(pending: Mapping[str, Any], effect_ref: Mapping[str, Any]) -> Dict[str, Any]:
    value = copy.deepcopy(dict(pending))
    value.setdefault("choice_id", str(value.get("effect_ref") or f"effect-{effect_ref.get('card_id', 'card')}"))
    value.setdefault("type", value.get("kind", "effect"))
    value.setdefault("prompt", "Resolve card effect")
    value["min"] = int(value.get("min", value.get("minimum", 1)))
    value["max"] = int(value.get("max", value.get("maximum", 1)))
    value["allow_skip"] = bool(value.get("allow_skip", value.get("optional", False)))
    options = []
    for option in value.get("options", []):
        item = copy.deepcopy(dict(option))
        item.setdefault("value", item.get("id", item.get("card_id")))
        item.setdefault("label", str(item.get("name", item.get("card_id", item.get("id", item.get("value", "Option"))))))
        options.append(item)
    value["options"] = options
    metadata = value.get("metadata", {})
    if isinstance(metadata, Mapping):
        for key in (
            "size", "building_type", "building", "maximum_buildings",
            "normal_placement_rules", "after",
        ):
            if key in metadata and key not in value:
                value[key] = copy.deepcopy(metadata[key])
        if value.get("type") == "digging":
            value["remaining"] = int(metadata.get("maximum_repetitions", 0))
    value["_effect_ref"] = copy.deepcopy(dict(effect_ref))
    return value


def _update_derived_metrics(player: MutableMapping[str, Any]) -> None:
    occupancy = player["map"]["occupancy"]
    buildable = {cell_id for cell_id, cell in MAP_CELLS.items() if cell.get("buildable")}
    border_buildable = {cell_id for cell_id in buildable if MAP_CELLS[cell_id].get("border")}
    empty_buildable = buildable - set(occupancy)
    connected_empty_border = sum(
        1 for cell_id in border_buildable - set(occupancy)
        if any(neighbor in occupancy for neighbor in MAP_CELLS[cell_id]["neighbors"])
    )
    unseen = set(empty_buildable)
    empty_six_hex_regions = 0
    while unseen:
        component = {unseen.pop()}
        frontier = list(component)
        while frontier:
            cell_id = frontier.pop()
            for neighbor in MAP_CELLS[cell_id]["neighbors"]:
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    component.add(neighbor)
                    frontier.append(neighbor)
        empty_six_hex_regions += len(component) // 6
    side_entrance = next(
        (
            building for building in player["map"].get("buildings", [])
            if building.get("unique_card_id") == "257" or building.get("id") == "sponsor-257"
        ),
        None,
    )
    side_entrance_adjacent: Set[str] = set()
    if side_entrance:
        by_id = {building["id"]: building for building in player["map"].get("buildings", [])}
        side_entrance_adjacent = {
            occupancy[neighbor]
            for cell_id in side_entrance.get("cells", [])
            for neighbor in MAP_CELLS[cell_id]["neighbors"]
            if neighbor in occupancy and occupancy[neighbor] != side_entrance["id"]
            and not (
                by_id[occupancy[neighbor]].get("building_type") == "standard_enclosure"
                and not _building_occupied(by_id[occupancy[neighbor]])
            )
        }
    terrain_metrics: Dict[str, int] = {}
    for terrain in ("water", "rock"):
        remaining = {
            cell_id for cell_id, cell in MAP_CELLS.items()
            if cell.get("terrain") == terrain and cell_id not in occupancy
        }
        connected = {
            cell_id for cell_id in remaining
            if any(neighbor in occupancy for neighbor in MAP_CELLS[cell_id]["neighbors"])
        }
        terrain_metrics[f"connected_{terrain}_hex_count"] = len(connected)
        terrain_metrics[f"isolated_{terrain}_hex_count"] = len(remaining - connected)
    bonus_cells = {
        cell_id for cell_id, cell in MAP_CELLS.items() if cell.get("placement_bonus")
    } - set(occupancy)
    connected_bonus = {
        cell_id for cell_id in bonus_cells
        if any(neighbor in occupancy for neighbor in MAP_CELLS[cell_id]["neighbors"])
    }
    buildings = list(player["map"].get("buildings", []))
    building_metrics = {
        "kiosk_count": sum(building.get("building_type") == "kiosk" for building in buildings),
        "occupied_size_1_enclosure_count": sum(
            building.get("building_type") == "standard_enclosure"
            and int(building.get("size", 0)) == 1
            and _building_occupied(building)
            for building in buildings
        ),
        "connected_bonus_hex_count": len(connected_bonus),
        "isolated_bonus_hex_count": len(bonus_cells - connected_bonus),
    }
    conditions = {
        "all_water_spaces_connected": terrain_metrics["isolated_water_hex_count"] == 0,
        "all_rock_spaces_connected": terrain_metrics["isolated_rock_hex_count"] == 0,
        "all_buildable_border_spaces_covered": border_buildable.issubset(occupancy),
        "all_buildable_spaces_covered": buildable.issubset(occupancy),
    }
    player["map"]["conditions"] = conditions
    player["map"]["empty_buildable_hex_count"] = len(empty_buildable)
    player["map"]["metrics"] = {
        "empty_buildable_hex_count": len(empty_buildable),
        "connected_empty_border_hex_count": connected_empty_border,
        "empty_six_hex_regions": empty_six_hex_regions,
        "side_entrance_adjacent_building_count": len(side_entrance_adjacent),
        **terrain_metrics,
        **building_metrics,
    }
    player["metrics"] = {
        "large_animal_count": _metric_count(player, "large_animal"),
        "small_animal_count": _metric_count(player, "small_animal"),
        "science_icon_count": int(player.get("tags", {}).get("science", 0)),
        "supported_conservation_project_count": len(player.get("supported_projects", [])),
        "sponsor_card_count": len(player.get("played_sponsors", [])),
        "rock_icon_count": int(player.get("tags", {}).get("rock", 0)),
        "water_icon_count": int(player.get("tags", {}).get("water", 0)),
        "empty_buildable_hex_count": len(empty_buildable),
        "connected_empty_border_hex_count": connected_empty_border,
        "empty_six_hex_regions": empty_six_hex_regions,
        "side_entrance_adjacent_building_count": len(side_entrance_adjacent),
        **terrain_metrics,
        **building_metrics,
    }


def _public_choice(pending: Optional[Mapping[str, Any]], viewer_id: str) -> Optional[Dict[str, Any]]:
    if not pending:
        return None
    if pending.get("player_id") != viewer_id:
        return {
            "choice_id": pending.get("choice_id"), "type": pending.get("type", pending.get("kind")),
            "player_id": pending.get("player_id"), "prompt": "Waiting for another player",
        }
    return {
        key: copy.deepcopy(value)
        for key, value in pending.items()
        if not str(key).startswith("_") and key not in {"effect_ref", "metadata"}
    }


def _card_with_context(card_id: str, player: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
    card = _full_card(card_id) or {"id": card_id, "card_type": "unknown"}
    if player is not None and card.get("card_type") in {"animal", "sponsor"}:
        ignore = int(card.get("card_type") == "animal" and _animal_size_class(card) == "large"
                     and _has_active_rule(player, "large_animal_ignore_condition"))
        card["conditions_met"] = _card_conditions_met(player, card, ignore_count=ignore)
        if card.get("card_type") == "animal":
            card["cost"] = _animal_cost(player, card)
        else:
            card["cost"] = int(card.get("play", {}).get("base_money_cost", 0))
    return card


def _project_public_view(state: Mapping[str, Any], project_id: str, viewer_id: str) -> Dict[str, Any]:
    card = copy.deepcopy(PROJECT_CARDS[project_id])
    card["is_base_project"] = _is_original_base_project(state, project_id)
    card["occupied_slots"] = copy.deepcopy(state.get("project_slots", {}).get(project_id, []))
    card["blocked_slots"] = [
        int(item["position"]) for item in state.get("blocked_project_slots", [])
        if item.get("project_id") == project_id
    ]
    if viewer_id in state.get("players", {}):
        player = state["players"][viewer_id]
        already_supported = any(
            item.get("project_id", item.get("card_id")) == project_id
            for item in player.get("supported_projects", [])
        )
        repeat_release = (
            card.get("project_type") == "release"
            and _has_active_rule(player, "release_project_bonus")
        )
        has_marker = int(
            player.get(
                "conservation_markers_remaining",
                max(0, 7 - len(player.get("claimed_map_rewards", []))),
            )
        ) > 0
        eligible = []
        release_candidates: Dict[str, List[str]] = {}
        for slot in card.get("support_slots", []):
            position = int(slot["position"])
            candidates: List[str] = []
            if slot.get("requirement", {}).get("kind") == "released_animal_enclosure_size":
                candidates = [
                    str(record.get("card_id"))
                    for record in player.get("animal_records", [])
                    if _project_requirement_met(
                        state, viewer_id, card, slot, str(record.get("card_id"))
                    )
                ]
                release_candidates[str(position)] = candidates
                requirement_met = bool(candidates)
            else:
                requirement_met = _project_requirement_met(state, viewer_id, card, slot)
            if (
                has_marker
                and (not already_supported or repeat_release)
                and position not in _occupied_project_positions(state, project_id)
                and not _project_slot_blocked(state, project_id, position)
                and requirement_met
            ):
                eligible.append(position)
        card["eligible_slots"] = eligible
        if release_candidates:
            card["candidate_animal_ids_by_slot"] = release_candidates
    return card


def _supportable_project_views(
    state: Mapping[str, Any], viewer_id: str
) -> List[Dict[str, Any]]:
    if viewer_id not in state.get("players", {}):
        return []
    player = state["players"][viewer_id]
    sources: Dict[str, Dict[str, Any]] = {}
    for project_id in state.get("projects", []):
        if project_id in PROJECT_CARDS:
            sources[str(project_id)] = {"source": "board"}
    for card_id in player.get("hand", []):
        if card_id in PROJECT_CARDS:
            sources.setdefault(str(card_id), {"source": "hand"})
    if not state.get("setup_pending") and _action_level(player, "association") == 2:
        for index, card_id in enumerate(state.get("display", [])):
            if (
                card_id in PROJECT_CARDS
                and index < _display_range(player)
            ):
                sources.setdefault(str(card_id), {"source": "display", "folder": index + 1})
    return [
        {**_project_public_view(state, project_id, viewer_id), **source}
        for project_id, source in sources.items()
    ]


def _find_placement(
    state: Mapping[str, Any], player_id: str, building_type: str, size: int,
    unique: Optional[Mapping[str, Any]] = None,
) -> Optional[List[str]]:
    footprint = (
        {(int(cell["q"]), int(cell["r"])) for cell in unique.get("footprint", {}).get("cells", [])}
        if unique else BUILDING_FOOTPRINTS.get(f"standard_enclosure_{size}" if building_type == "standard_enclosure" else building_type)
    )
    if building_type in {"pavilion", "kiosk"} and size == 1:
        footprint = {(0, 0)}
    if not footprint:
        return None
    axial_to_id = {
        (int(cell["axial"]["q"]), int(cell["axial"]["r"])): cell_id
        for cell_id, cell in MAP_CELLS.items()
    }
    for steps in range(6):
        rotated = _rotate_shape(footprint, steps)
        for anchor in axial_to_id:
            for base_anchor in rotated:
                dq, dr = anchor[0] - base_anchor[0], anchor[1] - base_anchor[1]
                coords = {(q + dq, r + dr) for q, r in rotated}
                if not coords.issubset(axial_to_id):
                    continue
                cells = [axial_to_id[coord] for coord in sorted(coords)]
                spec = {"building_type": building_type, "size": size, "cells": cells}
                if _validate_building_placement(state, player_id, spec, free=True, unique=unique) is None:
                    return cells
    return None


def _has_affordable_building(
    state: Mapping[str, Any], player_id: str, strength: int,
) -> bool:
    """Return whether the player can legally start a Build action.

    Checking only a size-1 standard enclosure hid otherwise legal Build
    actions when that exact piece did not fit.  This mirrors the available
    side of the player's Build card and checks every affordable piece.
    """

    if strength < 1:
        return False
    player = state["players"][player_id]
    level = _action_level(player, "build")
    side = ACTION_DEFS["build"]["sides"]["II" if level == 2 else "I"]
    money_per_hex = int(ACTION_DEFS["build"]["common"]["money_per_hex"])
    for building_type in side["allowed"]:
        sizes = range(1, 6) if building_type == "standard_enclosure" else (BUILDING_SIZES[building_type],)
        for size in sizes:
            if size > strength or size * money_per_hex > int(player.get("money", 0)):
                continue
            if _find_placement(state, player_id, building_type, size):
                return True
    return False


def _has_playable_animal(
    state: Mapping[str, Any], player_id: str, strength: int,
) -> bool:
    """Return whether at least one animal can actually be played now."""

    if strength < 1:
        return False
    player = state["players"][player_id]
    level = _action_level(player, "animals")
    face = ACTION_DEFS["animals"]["sides"]["II" if level == 2 else "I"]
    table_strength = min(5, strength)
    if int(face["maximum_cards_by_strength"][str(table_strength)]) < 1:
        return False

    # Animals II gains its strength-5 reputation before selecting/playing a
    # card, so both requirements and display range must use that new value.
    prospective = copy.deepcopy(player)
    if level == 2 and table_strength == 5:
        reputation_cap = MAX_REPUTATION if _action_level(prospective, "cards") == 2 else 9
        prospective["reputation"] = min(reputation_cap, int(prospective.get("reputation", 0)) + 1)

    candidates: List[Tuple[str, int]] = [(str(card_id), 0) for card_id in prospective.get("hand", [])]
    if level == 2:
        candidates.extend(
            (str(card_id), index + 1)
            for index, card_id in enumerate(state.get("display", []))
            if card_id and index < _display_range(prospective)
        )
    chosen_size_rules = _active_rules(prospective, "chosen_animal_size")
    for card_id, surcharge in candidates:
        card = ANIMAL_CARDS.get(card_id)
        if not card:
            continue
        size_class = _animal_size_class(card)
        if chosen_size_rules:
            chosen_size = str(chosen_size_rules[-1].get("size", ""))
            if size_class in {"small", "large"} and size_class != chosen_size:
                continue
        ignore_conditions = (
            1
            if size_class == "large" and _has_active_rule(prospective, "large_animal_ignore_condition")
            else 0
        )
        if not _card_conditions_met(prospective, card, ignore_count=ignore_conditions):
            continue
        if _animal_cost(prospective, card) + surcharge > int(prospective.get("money", 0)):
            continue
        if any(
            _enclosure_for_animal(prospective, card, str(building.get("id", "")))[2] is None
            for building in _animal_enclosures(prospective)
        ):
            return True
    return False


def _public_action_availability(
    state: Mapping[str, Any], player_id: str, legal_actions: Sequence[str]
) -> Dict[str, Dict[str, Any]]:
    """Describe why a top-level action is disabled in the current public view.

    The client can validate draft-specific details (selected cards, cells, and
    tasks) as they are entered.  These reasons cover the server-owned gates so
    a disabled action never has to be presented without an explanation.
    """
    legal = set(legal_actions)
    action_types = (*ACTION_IDS, "gain_x", "skip_extra_action", "keep_initial_cards", "resolve_choice")
    player = state.get("players", {}).get(player_id)
    pending = state.get("pending_choice")

    def maximum_strength(action_type: str) -> int:
        if player is None or action_type not in ACTION_IDS:
            return 0
        return _action_strength(
            state, player_id, action_type, int(player.get("x_tokens", 0)),
        )

    def global_reason(action_type: str) -> Optional[str]:
        if action_type in legal:
            return None
        if state.get("game_over"):
            return "The game is over."
        if player is None:
            return "This player is not part of the game."
        if player_id in state.get("setup_pending", []):
            return "Choose exactly four starting cards first."
        if state.get("setup_pending"):
            return "Waiting for all players to choose their starting cards."
        if pending:
            if pending.get("player_id") == player_id:
                return "Resolve the pending choice before taking another action."
            return "Waiting for another player to resolve a pending choice."
        if state.get("current_player") != player_id:
            return "It is not your turn."
        if state.get("phase") != "action":
            return "The game is not accepting an action right now."
        forced = state.get("forced_action")
        if isinstance(forced, Mapping):
            required = str(forced.get("action", "the granted"))
            return f"You must perform the granted {required} action."
        return None

    result: Dict[str, Dict[str, Any]] = {}
    for action_type in action_types:
        reason = global_reason(action_type)
        if reason is None and action_type not in legal and player is not None:
            if action_type == "build":
                if maximum_strength("build") < 1:
                    reason = "Commit more ✕-tokens to overcome Constriction."
                elif int(player.get("money", 0)) < 2:
                    reason = "You need at least 💰2 to build."
                else:
                    reason = "No affordable building has a legal placement."
            elif action_type == "animals":
                level = _action_level(player, "animals")
                face = ACTION_DEFS["animals"]["sides"]["II" if level == 2 else "I"]
                strength = maximum_strength("animals")
                table_strength = min(5, max(1, strength))
                if strength < 1 or int(face["maximum_cards_by_strength"][str(table_strength)]) < 1:
                    reason = "This Animals card needs more action strength."
                else:
                    reason = "No Animal card currently meets its cost, conditions, and enclosure requirements."
            elif action_type == "association":
                if int(player.get("available_workers", 0)) < 1:
                    reason = "No association worker is available."
                else:
                    reason = "Association needs at least action strength 2."
            elif action_type in {"cards", "sponsors"}:
                reason = "Commit more ✕-tokens to overcome Constriction."
            elif action_type == "gain_x":
                reason = "Your ✕-token storage is full."
            elif action_type == "keep_initial_cards":
                reason = "Your starting hand has already been chosen."
            elif action_type == "resolve_choice":
                reason = "There is no pending choice for you."
            else:
                reason = f"{action_type.title()} cannot be used right now."
        result[action_type] = {"available": action_type in legal, "reason": reason}
    return result


class ArkNovaGame:
    game_id = "ark_nova"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 4:
            raise ValueError("Ark Nova requires 2-4 players")
        ordered = sorted(players, key=lambda item: item.get("seat", 0))
        player_ids = [item["player_id"] for item in ordered]
        if len(set(player_ids)) != len(player_ids):
            raise ValueError("duplicate player id")
        cfg = dict(config or {})
        seed = cfg.get("seed")
        rng = random.Random(seed)

        zoo_deck = list(ZOO_CARDS)
        rng.shuffle(zoo_deck)
        final_deck = list(FINAL_CARDS)
        rng.shuffle(final_deck)
        all_base_projects = [
            card_id for card_id, card in PROJECT_CARDS.items()
            if card.get("deck_group") == "base_setup"
        ]
        rng.shuffle(all_base_projects)
        base_project_count = 4 if len(players) == 4 else 3
        base_projects = all_base_projects[:base_project_count]
        unused_base_projects = all_base_projects[base_project_count:]
        bonus_token_ids = list(BONUS_TOKEN_DEFS)
        rng.shuffle(bonus_token_ids)
        donation_slots = _canonical_donation_slots(len(players))

        state: Dict[str, Any] = {
            "schema_version": ARK_NOVA_SCHEMA_VERSION,
            "config": cfg,
            "rng_seed": seed,
            "reshuffle_count": 0,
            "turn_order": player_ids,
            "player_meta": {item["player_id"]: copy.deepcopy(item) for item in ordered},
            "players": {},
            "current_player": player_ids[0],
            "current_turn": player_ids[0],
            "phase": "setup",
            "setup_pending": list(player_ids),
            "deck": zoo_deck,
            "discard": [],
            "display": [],
            "display_dirty": False,
            "final_deck": final_deck,
            "projects": list(base_projects),
            "unused_base_projects": list(unused_base_projects),
            "project_slots": {card_id: [] for card_id in base_projects},
            "blocked_project_slots": [],
            "break_position": 0,
            "break_limit": BREAK_LIMITS[len(players)],
            "break_due": False,
            "break_count": 0,
            "association_supply": {
                "partner_zoos": list(CONTINENTS),
                "universities": [item["id"] for item in UNIVERSITIES],
                "donation_slots": donation_slots,
            },
            "building_supply": dict(BUILDING_SUPPLY),
            "bonus_tokens": {"5": bonus_token_ids[:2], "8": bonus_token_ids[2:4]},
            "pending_choice": None,
            "pending_queue": [],
            "deferred_turn_end": None,
            "effect_queue": [],
            "final_card_gate_reached": False,
            "final_round": {"active": False, "triggered_by": None, "remaining": []},
            "game_over": False,
            "scores": {},
            "winner": [],
        }
        if len(players) == 2:
            state["blocked_project_slots"] = [
                {"project_id": base_projects[0], "position": 1},
                {"project_id": base_projects[1], "position": 2},
                {"project_id": base_projects[2], "position": 3},
            ]

        for seat, player_id in enumerate(player_ids):
            pdata = _new_player_state(seat, rng)
            for _ in range(8):
                card_id = _draw(state)
                if card_id:
                    pdata["hand"].append(card_id)
            for _ in range(2):
                if state["final_deck"]:
                    pdata["final_cards"].append(state["final_deck"].pop())
            state["players"][player_id] = pdata
            _update_derived_metrics(pdata)
        _refill_display(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        _migrate_state_in_place(state)
        if state.get("game_over") or player_id not in state.get("players", {}):
            return []
        if player_id in state.get("setup_pending", []):
            return ["keep_initial_cards"]
        pending = state.get("pending_choice")
        if pending:
            return ["resolve_choice"] if pending.get("player_id") == player_id else []
        if state.get("phase") != "action" or state.get("current_player") != player_id:
            return []
        player = state["players"][player_id]
        forced = state.get("forced_action")
        if isinstance(forced, Mapping) and forced.get("player_id") == player_id:
            return [str(forced.get("action"))] + (["skip_extra_action"] if forced.get("optional") else [])
        available_x = int(player.get("x_tokens", 0))

        def maximum_strength(action_id: str) -> int:
            return _action_strength(state, player_id, action_id, available_x)

        actions = []
        if maximum_strength("cards") >= 1:
            actions.append("cards")
        if _has_affordable_building(state, player_id, maximum_strength("build")):
            actions.append("build")
        if _has_playable_animal(state, player_id, maximum_strength("animals")):
            actions.append("animals")
        if player["available_workers"] and maximum_strength("association") >= 2:
            actions.append("association")
        if maximum_strength("sponsors") >= 1:
            actions.append("sponsors")
        if player["x_tokens"] < MAX_X_TOKENS:
            actions.append("gain_x")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, Mapping):
            return [], "invalid action"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if state.get("game_over"):
            return [], "game over"
        candidate = copy.deepcopy(state)
        _migrate_state_in_place(candidate)
        events: List[Dict[str, Any]] = []
        action_type = action.get("type")
        aliases = {
            "take_cards": "cards", "play_animals": "animals", "play_sponsors": "sponsors",
            "perform_build": "build", "perform_association": "association",
        }
        action_type = aliases.get(action_type, action_type)

        try:
            if player_id in candidate.get("setup_pending", []):
                if action_type != "keep_initial_cards":
                    return [], "must choose initial hand"
                card_ids = action.get("card_ids")
                hand = candidate["players"][player_id]["hand"]
                if (
                    not isinstance(card_ids, list) or len(card_ids) != 4 or len(set(card_ids)) != 4
                    or any(card_id not in hand for card_id in card_ids)
                ):
                    return [], "keep exactly four dealt cards"
                discarded = [card_id for card_id in hand if card_id not in card_ids]
                candidate["players"][player_id]["hand"] = list(card_ids)
                candidate["discard"].extend(discarded)
                candidate["setup_pending"].remove(player_id)
                events.append(_event("initial_hand", player_id=player_id, discarded_count=len(discarded)))
                if not candidate["setup_pending"]:
                    candidate["phase"] = "action"
                    _set_current_player(candidate, candidate["turn_order"][0])
                    events.append(_event("game_ready", current_player=candidate["current_player"]))
                state.clear()
                state.update(candidate)
                return events, None

            if candidate.get("setup_pending"):
                return [], "waiting for initial hands"
            if candidate.get("pending_choice"):
                if action_type != "resolve_choice":
                    return [], "must resolve pending choice"
                error = _resolve_choice(candidate, player_id, action, events)
                if error:
                    return [], error
            else:
                if player_id != candidate.get("current_player"):
                    return [], "not your turn"
                if candidate.get("phase") != "action":
                    return [], "game is not accepting an action"
                forced = candidate.get("forced_action")
                if action_type == "skip_extra_action":
                    _skip_extra_action(candidate, player_id, events)
                    state.clear()
                    state.update(candidate)
                    return events, None
                if isinstance(forced, Mapping) and action_type != forced.get("action"):
                    return [], "must perform the granted extra action"
                if "_venom_turn_start" not in candidate and any(
                    card.get("venom_tokens") for card in candidate["players"][player_id]["action_cards"].values()
                ):
                    candidate["_venom_turn_start"] = copy.deepcopy(candidate)
                    candidate["_venom_first_action"] = json.dumps(action, sort_keys=True)
                candidate["choose_effect_order"] = bool(action.get("choose_effect_order", False))
                if (
                    isinstance(forced, Mapping)
                    and not forced.get("allow_x_alternative", False)
                    and int(action.get("x_tokens", 0) or 0) != 0
                ):
                    return [], "X-tokens cannot modify this granted extra action"
                multiplier_allowed = not isinstance(forced, Mapping) or not (
                    forced.get("from_multiplier") or forced.get("hypnosis")
                )
                if not multiplier_allowed:
                    raw_multiplier = action.get("use_multiplier_tokens", action.get("use_multiplier"))
                    if raw_multiplier is True:
                        return [], "Multiplier tokens cannot modify this granted action"
                    disallowed_multiplier, disallowed_error = _validate_multiplier_tokens(action, 0)
                    if disallowed_error or disallowed_multiplier:
                        return [], "Multiplier tokens cannot modify this granted action"
                if action_type in ACTION_IDS and multiplier_allowed:
                    entry = candidate["players"][player_id]["action_cards"][action_type]
                    available_multiplier = int(entry.get("multiplier_tokens", 0))
                    requested_multiplier, multiplier_error = _validate_multiplier_tokens(
                        action, available_multiplier,
                    )
                    if multiplier_error:
                        return [], multiplier_error
                    assert requested_multiplier is not None
                    if requested_multiplier:
                        candidate["multiplier_action"] = {
                            "player_id": player_id, "action": action_type,
                            "base_strength": _action_slot(candidate["players"][player_id], action_type),
                            "remaining": requested_multiplier, "tokens_used": requested_multiplier,
                        }
                if action_type == "cards":
                    error = _perform_cards_action(candidate, player_id, action, events)
                elif action_type == "build":
                    error = _perform_build_action(candidate, player_id, action, events)
                elif action_type == "animals":
                    error = _perform_animals_action(candidate, player_id, action, events)
                elif action_type == "association":
                    error = _perform_association_action(candidate, player_id, action, events)
                elif action_type == "sponsors":
                    error = _perform_sponsors_action(candidate, player_id, action, events)
                elif action_type == "gain_x":
                    player = candidate["players"][player_id]
                    action_id = str(action.get("action_card", ""))
                    if action_id not in player["action_cards"]:
                        return [], "choose an Action card for the X-token action"
                    if player["x_tokens"] >= MAX_X_TOKENS:
                        return [], "X-token limit reached"
                    entry = player["action_cards"][action_id]
                    available_multiplier = int(entry.get("multiplier_tokens", 0))
                    requested_multiplier, multiplier_error = _validate_multiplier_tokens(
                        action, available_multiplier,
                    )
                    if multiplier_error:
                        return [], multiplier_error
                    assert requested_multiplier is not None
                    gained = _gain_x(player, 1 + requested_multiplier)
                    if requested_multiplier:
                        remaining = available_multiplier - requested_multiplier
                        if remaining:
                            entry["multiplier_tokens"] = remaining
                        else:
                            entry.pop("multiplier_tokens", None)
                    events.append(_event("gain_x", player_id=player_id, amount=gained))
                    _defer_turn_end(candidate, player_id, action_id, 0, events)
                    error = None
                else:
                    return [], "invalid action"
                if error:
                    return [], error
        except _VenomUndo as exc:
            if "_venom_turn_start" not in state:
                return [], str(exc)
            restored = copy.deepcopy(candidate["_venom_turn_start"])
            failed = candidate.get("_venom_first_action")
            if failed and failed not in restored.setdefault("venom_failed_actions", []):
                restored["venom_failed_actions"].append(failed)
            state.clear()
            state.update(restored)
            return [_event("turn_undone", player_id=restored["current_player"], reason="Cannot pay 2 money for Venom; choose a different action")], None
        except (ValueError, KeyError, TypeError, IndexError) as exc:
            return [], str(exc) or "invalid action"
        state.clear()
        state.update(candidate)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        _migrate_state_in_place(state)
        viewer = state.get("players", {}).get(viewer_id)
        legal_actions = ArkNovaGame.get_legal_actions(state, viewer_id)
        association_supply = copy.deepcopy(state.get("association_supply", {}))
        universities_on_board = set(association_supply.get("universities", []))
        association_supply["university_options"] = [
            {
                **copy.deepcopy(item),
                "available": (
                    item["id"] in universities_on_board
                    and bool(viewer)
                    and item["id"] not in viewer.get("universities", [])
                ),
                "owned_by_you": bool(viewer and item["id"] in viewer.get("universities", [])),
                "on_board": item["id"] in universities_on_board,
            }
            for item in UNIVERSITIES
        ]
        if viewer:
            association_supply["available_partner_zoos"] = [
                continent for continent in association_supply.get("partner_zoos", [])
                if continent not in viewer.get("partner_zoos", [])
            ]
            association_supply["available_universities"] = [
                option["id"] for option in association_supply["university_options"] if option["available"]
            ]
        display = []
        for index, card_id in enumerate(state.get("display", [])):
            if not card_id or state.get("setup_pending"):
                display.append(None)
                continue
            card = _card_with_context(card_id, viewer)
            card["folder"] = index + 1
            card["within_reputation_range"] = bool(viewer and index < _display_range(viewer))
            display.append(card)

        players_view = []
        for player_id in _ordered_player_ids(state):
            player = state["players"][player_id]
            meta = state.get("player_meta", {}).get(player_id, {})
            records = {item["card_id"]: item for item in player.get("animal_records", [])}
            action_cards = []
            for action_id, value in player["action_cards"].items():
                action_cards.append({
                    "id": action_id, "slot": int(value["slot"]), "upgraded": bool(value.get("upgraded")),
                    "side": "II" if value.get("upgraded") else "I",
                    "multiplier_tokens": int(value.get("multiplier_tokens", 0)),
                    "venom_tokens": int(value.get("venom_tokens", 0)),
                    "constriction_tokens": int(value.get("constriction_tokens", 0)),
                })
            action_cards.sort(key=lambda item: item["slot"])
            players_view.append({
                "player_id": player_id, "name": meta.get("name"), "seat": meta.get("seat"),
                "is_bot": bool(meta.get("is_bot", False)), "money": int(player["money"]),
                "appeal": int(player["appeal"]), "conservation": int(player["conservation"]),
                "reputation": int(player["reputation"]), "x_tokens": int(player["x_tokens"]),
                "appeal_income": _appeal_income(int(player["appeal"])),
                "target_appeal": _target_appeal(int(player["conservation"])),
                "hand_count": len(player["hand"]), "final_card_count": len(player["final_cards"]),
                "action_cards": action_cards, "played_animal_ids": list(player["played_animals"]),
                "played_animals": [
                    {**_card_with_context(card_id), "enclosure": copy.deepcopy(records.get(card_id))}
                    for card_id in player["played_animals"]
                ],
                "played_sponsor_ids": list(player["played_sponsors"]),
                "played_sponsors": [_card_with_context(card_id) for card_id in player["played_sponsors"]],
                "supported_projects": copy.deepcopy(player["supported_projects"]),
                "claimed_map_rewards": list(player["claimed_map_rewards"]),
                "association_workers_total": int(player["association_workers_total"]),
                "available_workers": int(player["available_workers"]),
                "association_worker_placements": copy.deepcopy(player["association_worker_placements"]),
                "partner_zoos": list(player["partner_zoos"]), "universities": list(player["universities"]),
                "hand_limit": int(player["hand_limit"]), "tags": copy.deepcopy(player["tags"]),
                "card_tokens": copy.deepcopy(player.get("card_tokens", {})),
                "wild_project_uses": copy.deepcopy(player.get("wild_project_uses", [])),
                "conservation_markers_remaining": int(player.get(
                    "conservation_markers_remaining",
                    max(0, 7 - len(player.get("claimed_map_rewards", []))),
                )),
                "association_project_strength": min(
                    [5] + [
                        int(rule.get("value", 5))
                        for rule in _active_rules(player, "project_task_strength")
                    ]
                ),
                "map": copy.deepcopy(player["map"]),
                "flock_available": any(item["id"] == "flock" for item in _animal_enclosures(player)),
            })

        return {
            "game_id": ArkNovaGame.game_id, "you": viewer_id,
            "current_player": state.get("current_player"), "current_turn": state.get("current_player"),
            "phase": state.get("phase"), "setup_pending": list(state.get("setup_pending", [])),
            "break_position": int(state.get("break_position", 0)), "break_limit": int(state.get("break_limit", 0)),
            "break_count": int(state.get("break_count", 0)), "deck_count": len(state.get("deck", [])),
            "discard_count": len(state.get("discard", [])), "display": display,
            "projects": [_project_public_view(state, project_id, viewer_id) for project_id in state.get("projects", [])],
            "supportable_projects": _supportable_project_views(state, viewer_id),
            "project_slots": copy.deepcopy(state.get("project_slots", {})),
            "association_supply": association_supply,
            "bonus_tokens": {
                threshold: [{"id": token_id, **copy.deepcopy(BONUS_TOKEN_DEFS[token_id])} for token_id in token_ids]
                for threshold, token_ids in state.get("bonus_tokens", {}).items()
            },
            "building_supply": copy.deepcopy(state.get("building_supply", {})),
            "players": players_view,
            "your_hand": [_card_with_context(card_id, viewer) for card_id in (viewer or {}).get("hand", [])],
            "your_final_cards": [_full_card(card_id) for card_id in (viewer or {}).get("final_cards", [])],
            "pending_choice": _public_choice(state.get("pending_choice"), viewer_id),
            "forced_action": copy.deepcopy(state.get("forced_action")),
            "multiplier_action": copy.deepcopy(state.get("multiplier_action")),
            "legal_actions": legal_actions,
            "action_availability": _public_action_availability(state, viewer_id, legal_actions),
            "action_definitions": copy.deepcopy(CARD_DATA["action_cards"]),
            "map_definition": copy.deepcopy(MAP0),
            "final_round": copy.deepcopy(state.get("final_round", {})),
            "game_over": bool(state.get("game_over")), "scores": copy.deepcopy(state.get("scores", {})),
            "winner": list(state.get("winner", [])),
        }

    @staticmethod
    def bot_move(
        state: Dict,
        bot_id: str,
        *,
        progress_callback: Optional[Callable[[str, float, Optional[str]], None]] = None,
    ) -> Optional[Dict]:
        _migrate_state_in_place(state)
        # Imported lazily so the AI can use this module's validation helpers as
        # its legality oracle without creating an import cycle at startup.
        from game.ark_nova_ai import choose_ark_nova_action

        return choose_ark_nova_action(
            state,
            bot_id,
            progress_callback=progress_callback,
        )

    @staticmethod
    def serialize(state: Dict) -> Dict:
        _migrate_state_in_place(state)
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        _migrate_state_in_place(payload)
        return payload
