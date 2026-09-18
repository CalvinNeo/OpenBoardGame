from __future__ import annotations

import copy
import hashlib
import random
import secrets
from collections import deque
from typing import Dict, Iterable, List, Optional, Set, Tuple

from game.catan_starfarers_data import (
    CIVILIZATIONS,
    ENCOUNTERS,
    ENCOUNTER_BY_ID,
    FRIENDSHIP_BY_ID,
    FRIENDSHIP_CARDS,
    MAP_GRAPH,
    NODE_BY_ID,
    RESOURCE_TYPES,
    SETUP_MODES,
    UPGRADE_TYPES,
)
from game.catan_starfarers_i18n import (
    BALL_ZH,
    CIVILIZATION_ZH,
    ENCOUNTER_ZH,
    FRIENDSHIP_ZH,
    RESOURCE_ZH,
    SECTOR_ZH,
    SETUP_ZH,
    SHIP_ZH,
    UPGRADE_ZH,
)


SCHEMA_VERSION = 1
WINNING_VP = 15
RESOURCE_TOTAL = 20
FAME_TOTAL = 40
UPGRADE_TOTALS = {"booster": 24, "cannon": 24, "freight": 20}
PLAYER_COLONIES = 9
PLAYER_TRADE_STATIONS = 7
PLAYER_TRANSPORTS = 3
PLAYER_SHIPYARDS = 3
MOTHERSHIP_BALLS = ("yellow", "yellow", "blue", "red", "black")
BALL_VALUES = {"blue": 1, "yellow": 2, "red": 3, "black": 0}

BUILD_COSTS = {
    "colony_ship": {"ore": 1, "fuel": 1, "carbon": 1, "food": 1},
    "trade_ship": {"ore": 1, "fuel": 1, "goods": 2},
    "spaceport": {"carbon": 3, "food": 2},
    "booster": {"fuel": 2},
    "cannon": {"carbon": 2},
    "freight": {"ore": 2},
}

PHASES = {
    "production",
    "seven_discard",
    "seven_steal",
    "trade_build",
    "encounter_reader",
    "encounter_choice",
    "encounter_reveal",
    "flight",
    "friendship_choice",
    "turn_review",
    "game_over",
}


def _empty_resources() -> Dict[str, int]:
    return {resource: 0 for resource in RESOURCE_TYPES}


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: (int(item.get("seat", 0)), str(item.get("player_id", ""))))


def _human_ids(state: Dict) -> List[str]:
    return [
        player_id
        for player_id in state["turn_order"]
        if not bool(state["player_meta"].get(player_id, {}).get("is_bot"))
    ]


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "Unknown captain"
    return str(state.get("player_meta", {}).get(player_id, {}).get("name") or player_id)


def _language(state: Dict) -> str:
    return "zh" if state.get("config", {}).get("language") == "zh" else "en"


def _localized(state: Dict, english: str, chinese: str) -> str:
    return chinese if _language(state) == "zh" else english


def _sector_name(state: Dict, sector: Dict) -> str:
    if _language(state) == "zh":
        return SECTOR_ZH.get(str(sector.get("id")), str(sector.get("name") or ""))
    return str(sector.get("name") or "")


def _resource_name(state: Dict, resource: str) -> str:
    return RESOURCE_ZH.get(resource, resource) if _language(state) == "zh" else resource


def _friendship_copy(state: Dict, card_id: str) -> Dict[str, str]:
    card = FRIENDSHIP_BY_ID[card_id]
    if _language(state) == "zh":
        translated = FRIENDSHIP_ZH[card_id]
        return {"name": translated["name"], "description": translated["description"]}
    return {"name": card["name"], "description": card["description"]}


def _encounter_copy(state: Dict, card_id: str) -> Dict:
    card = ENCOUNTER_BY_ID[card_id]
    if _language(state) == "zh":
        return ENCOUNTER_ZH[card_id]
    return {
        "title": card["title"],
        "prompt": card["prompt"],
        "options": {
            option["id"]: {"label": option["label"], "result": option["result"]}
            for option in card["options"]
        },
    }


def _next_player_id(state: Dict, player_id: str) -> str:
    order = state["turn_order"]
    return order[(order.index(player_id) + 1) % len(order)]


def _rng(state: Dict, domain: str) -> random.Random:
    counters = state.setdefault("rng_counters", {})
    counter = int(counters.get(domain, 0)) + 1
    counters[domain] = counter
    digest = hashlib.sha256(f"{state['rng_seed']}:{domain}:{counter}".encode("utf-8")).digest()
    return random.Random(int.from_bytes(digest, "big"))


def _shuffle(state: Dict, domain: str, values: Iterable) -> List:
    result = list(values)
    _rng(state, domain).shuffle(result)
    return result


def _choice(state: Dict, domain: str, values: List):
    if not values:
        return None
    return values[_rng(state, domain).randrange(len(values))]


def _record(
    state: Dict,
    events: List[Dict],
    event_type: str,
    message: str,
    *,
    message_zh: Optional[str] = None,
    **payload: object,
) -> None:
    sequence = int(state.get("activity_sequence", 0)) + 1
    state["activity_sequence"] = sequence
    localized_message = message_zh if _language(state) == "zh" and message_zh else message
    item = {"sequence": sequence, "type": event_type, "message": localized_message, **copy.deepcopy(payload)}
    state.setdefault("activity", []).append(item)
    state["activity"] = state["activity"][-120:]
    state.setdefault("turn_summary", []).append(localized_message)
    state["turn_summary"] = state["turn_summary"][-30:]
    events.append({"type": f"catan_starfarers:{event_type}", "payload": copy.deepcopy(payload)})


def _resource_count(bundle: Dict[str, int]) -> int:
    return sum(int(bundle.get(resource, 0)) for resource in RESOURCE_TYPES)


def _normalize_bundle(raw: object, *, maximum: int = 20) -> Optional[Dict[str, int]]:
    if not isinstance(raw, dict):
        return None
    if any(key not in RESOURCE_TYPES for key in raw):
        return None
    result = _empty_resources()
    for resource in RESOURCE_TYPES:
        value = raw.get(resource, 0)
        if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > maximum:
            return None
        result[resource] = value
    return result


def _can_pay(hand: Dict[str, int], cost: Dict[str, int]) -> bool:
    return all(int(hand.get(resource, 0)) >= int(cost.get(resource, 0)) for resource in RESOURCE_TYPES)


def _return_to_supply(state: Dict, player_id: str, bundle: Dict[str, int]) -> None:
    player = state["players"][player_id]
    if not _can_pay(player["hand"], bundle):
        raise ValueError("not enough resources")
    for resource in RESOURCE_TYPES:
        amount = int(bundle.get(resource, 0))
        player["hand"][resource] -= amount
        state["resource_supply"][resource] += amount


def _take_from_supply(state: Dict, player_id: str, resource: str, count: int) -> int:
    available = int(state["resource_supply"].get(resource, 0))
    actual = min(max(0, int(count)), available)
    if actual:
        state["resource_supply"][resource] -= actual
        state["players"][player_id]["hand"][resource] += actual
    return actual


def _invalidate_trade(state: Dict) -> None:
    state["trade"]["offer"] = None
    state["trade"]["responses"] = {}
    state["trade"]["epoch"] = int(state["trade"].get("epoch", 0)) + 1


def _rebuild_reserve(state: Dict) -> None:
    cards: List[str] = []
    for resource in RESOURCE_TYPES:
        count = min(8, int(state["resource_supply"][resource]))
        state["resource_supply"][resource] -= count
        cards.extend([resource] * count)
    if cards:
        state["reserve_deck"] = _shuffle(state, "reserve", cards)


def _draw_reserve(state: Dict, player_id: str, count: int) -> List[str]:
    drawn: List[str] = []
    for _ in range(max(0, int(count))):
        if not state["reserve_deck"]:
            _rebuild_reserve(state)
        if not state["reserve_deck"]:
            break
        resource = state["reserve_deck"].pop()
        state["players"][player_id]["hand"][resource] += 1
        drawn.append(resource)
    return drawn


def _friend_cards(state: Dict, player_id: str) -> List[Dict]:
    return [FRIENDSHIP_BY_ID[card_id] for card_id in state["players"][player_id]["friendship_cards"]]


def _friend_effect_total(state: Dict, player_id: str, key: str) -> int:
    return sum(int(card.get("effect", {}).get(key, 0)) for card in _friend_cards(state, player_id))


def _hand_limit(state: Dict, player_id: str) -> int:
    limits = [int(card.get("effect", {}).get("hand_limit", 0)) for card in _friend_cards(state, player_id)]
    return max([7, *limits])


def _bank_rate(state: Dict, player_id: str, resource: str) -> int:
    if resource == "goods":
        if any(card.get("effect", {}).get("goods_once_rate") == 1 for card in _friend_cards(state, player_id)):
            if not state["players"][player_id]["turn_flags"].get("goods_broker_used"):
                return 1
        return 2
    for card in _friend_cards(state, player_id):
        rate = card.get("effect", {}).get("bank_rate")
        if isinstance(rate, dict) and rate.get("resource") == resource:
            return min(3, int(rate.get("rate", 3)))
    return 3


def _effective_upgrade(state: Dict, player_id: str, upgrade: str) -> int:
    physical = int(state["players"][player_id]["upgrades"].get(upgrade, 0))
    if upgrade == "booster":
        return physical + _friend_effect_total(state, player_id, "movement_bonus")
    if upgrade == "cannon":
        return physical + _friend_effect_total(state, player_id, "cannon_bonus")
    return physical


def _build_board(state: Dict, setup_mode: str) -> Dict:
    nodes = {item["id"]: copy.deepcopy(item) for item in MAP_GRAPH["nodes"]}
    slots = [item["id"] for item in MAP_GRAPH["nodes"] if item.get("kind") == "sector"]
    contents = [copy.deepcopy(item) for item in MAP_GRAPH["sectors"]]
    sectors: Dict[str, Dict] = {}

    if setup_mode == "wild_space":
        shuffled = _shuffle(state, "wild-sectors", contents)
        removed = shuffled.pop()
        assignments = list(zip(slots, shuffled))
    else:
        removed = next(item for item in contents if item["id"] == "empty-far-horizon")
        assignments = [(item["node_id"], item) for item in contents if item["id"] != removed["id"]]

    for slot_id, raw in assignments:
        sector = copy.deepcopy(raw)
        sector.pop("node_id", None)
        sector["node_id"] = slot_id
        sector["revealed"] = setup_mode in {"beginner", "strategic"}
        sector["explored"] = setup_mode == "beginner" or sector["kind"] != "system"
        sector["obstacle_cleared"] = not bool(sector.get("obstacle"))
        sectors[slot_id] = sector

    adjacency = {node_id: [] for node_id in nodes}
    edges = []
    for first, second in MAP_GRAPH["edges"]:
        adjacency[first].append(second)
        adjacency[second].append(first)
        edges.append([first, second])
    for values in adjacency.values():
        values.sort()
    return {
        "nodes": nodes,
        "edges": edges,
        "adjacency": adjacency,
        "sectors": sectors,
        "removed_sector": copy.deepcopy(removed),
        "buildings": [],
        "ships": {},
    }


def _building_id(player_id: str, suffix: str) -> str:
    return f"building-{player_id}-{suffix}"


def _new_ship_id(state: Dict, player_id: str) -> str:
    state["ship_sequence"] = int(state.get("ship_sequence", 0)) + 1
    return f"ship-{player_id}-{state['ship_sequence']}"


def _initial_state(
    config: Optional[Dict], players: List[Dict], *, rng_seed: Optional[str] = None, game_index: int = 1
) -> Dict:
    ordered = _ordered_players(players)
    if not 3 <= len(ordered) <= 4:
        raise ValueError("CATAN: Starfarers requires 3 or 4 players")
    player_ids = [str(item.get("player_id") or "") for item in ordered]
    if any(not player_id for player_id in player_ids) or len(set(player_ids)) != len(player_ids):
        raise ValueError("players must have unique player ids")
    setup_mode = str((config or {}).get("setup_mode") or "beginner")
    if setup_mode not in SETUP_MODES:
        raise ValueError("invalid Starfarers setup mode")
    language = str((config or {}).get("language") or "en")
    if language not in {"en", "zh"}:
        raise ValueError("Starfarers language must be 'en' or 'zh'")

    state: Dict = {
        "schema_version": SCHEMA_VERSION,
        "game_id": "catan_starfarers",
        "game_index": int(game_index),
        "config": {"setup_mode": setup_mode, "language": language},
        "rng_seed": rng_seed or secrets.token_hex(32),
        "rng_counters": {},
        "turn_order": player_ids,
        "active_player_id": player_ids[0],
        "turn_no": 1,
        "phase": "production",
        "game_over": False,
        "winner_ids": [],
        "player_meta": {player_id: copy.deepcopy(item) for player_id, item in zip(player_ids, ordered)},
        "players": {},
        "resource_supply": {resource: RESOURCE_TOTAL for resource in RESOURCE_TYPES},
        "reserve_deck": [],
        "upgrade_supply": dict(UPGRADE_TOTALS),
        "fame_supply": FAME_TOTAL,
        "encounter_draw": [],
        "encounter_discard": [],
        "current_encounter": None,
        "friendship_available": {civilization: [] for civilization in CIVILIZATIONS},
        "friendship_marker_holder": {civilization: None for civilization in CIVILIZATIONS},
        "production": {"dice": None, "pending_discards": {}, "stolen": None},
        "trade": {"offer": None, "responses": {}, "epoch": 0},
        "flight": None,
        "pending_friendship": None,
        "turn_summary": [],
        "last_turn_summary": [],
        "review_required": [],
        "review_ready": [],
        "rematch_ready": [],
        "activity": [],
        "activity_sequence": 0,
        "ship_sequence": 0,
    }
    state["board"] = _build_board(state, setup_mode)
    state["encounter_draw"] = _shuffle(state, "encounters", [card["id"] for card in ENCOUNTERS])
    for civilization in CIVILIZATIONS:
        state["friendship_available"][civilization] = [
            card["id"] for card in FRIENDSHIP_CARDS if card["civilization"] == civilization
        ]
    _rebuild_reserve(state)

    for seat, player_id in enumerate(player_ids):
        state["players"][player_id] = {
            "hand": _empty_resources(),
            "upgrades": {"booster": 1, "cannon": 0, "freight": 0},
            "supply": {
                "colonies": PLAYER_COLONIES - 4,
                "trade_stations": PLAYER_TRADE_STATIONS,
                "transports": PLAYER_TRANSPORTS - 1,
                "shipyards": PLAYER_SHIPYARDS - 1,
            },
            "friendship_cards": [],
            "fame_pieces": 1,
            "permanent_medals": [],
            "turn_flags": {},
        }
        state["upgrade_supply"]["booster"] -= 1
        state["fame_supply"] -= 1
        port_node = f"home-{seat}-port"
        for suffix, node_id, kind in (
            ("home-port", port_node, "spaceport"),
            ("home-a", f"home-{seat}-a", "colony"),
            ("home-b", f"home-{seat}-b", "colony"),
        ):
            state["board"]["buildings"].append(
                {"id": _building_id(player_id, suffix), "player_id": player_id, "kind": kind, "node_id": node_id}
            )
        ship_id = _new_ship_id(state, player_id)
        state["board"]["ships"][ship_id] = {
            "id": ship_id,
            "player_id": player_id,
            "kind": "colony",
            "node_id": port_node,
        }
        _draw_reserve(state, player_id, 3)

    events: List[Dict] = []
    _record(
        state,
        events,
        "game_started",
        f"The {setup_mode.replace('_', ' ')} frontier is ready. {_player_name(state, player_ids[0])} begins.",
        message_zh=f"{SETUP_ZH[setup_mode]}星域已就绪，{_player_name(state, player_ids[0])}先手。",
        setup_mode=setup_mode,
        starting_player_id=player_ids[0],
    )
    state["turn_summary"] = []
    _assert_state(state)
    return state


def _buildings_at(state: Dict, node_id: str) -> List[Dict]:
    return [building for building in state["board"]["buildings"] if building["node_id"] == node_id]


def _player_buildings(state: Dict, player_id: str, kind: Optional[str] = None) -> List[Dict]:
    result = [item for item in state["board"]["buildings"] if item["player_id"] == player_id]
    return [item for item in result if item["kind"] == kind] if kind else result


def _player_ships(state: Dict, player_id: str) -> List[Dict]:
    return [item for item in state["board"]["ships"].values() if item["player_id"] == player_id]


def _outpost_station_counts(state: Dict, civilization: str) -> Dict[str, int]:
    result = {player_id: 0 for player_id in state["turn_order"]}
    for building in state["board"]["buildings"]:
        if building["kind"] != "trade_station":
            continue
        sector = state["board"]["sectors"].get(building["node_id"])
        if sector and sector.get("civilization") == civilization:
            result[building["player_id"]] += 1
    return result


def _update_friendship_marker(state: Dict, civilization: str) -> None:
    counts = _outpost_station_counts(state, civilization)
    holder = state["friendship_marker_holder"].get(civilization)
    holder_count = counts.get(holder, 0) if holder else 0
    for player_id in state["turn_order"]:
        if counts[player_id] > holder_count:
            holder = player_id
            holder_count = counts[player_id]
    state["friendship_marker_holder"][civilization] = holder


def compute_vp(state: Dict, player_id: str) -> int:
    score = 0
    for building in _player_buildings(state, player_id):
        if building["kind"] == "spaceport":
            score += 2
        elif building["kind"] in {"colony", "trade_station"}:
            score += 1
    score += 2 * sum(1 for holder in state["friendship_marker_holder"].values() if holder == player_id)
    score += len(state["players"][player_id]["permanent_medals"])
    score += int(state["players"][player_id]["fame_pieces"]) // 2
    return score


def _draw_earth_reserve(state: Dict, player_id: str) -> int:
    vp = compute_vp(state, player_id)
    requested = 2 if vp <= 7 else 1 if vp <= 9 else 0
    return len(_draw_reserve(state, player_id, requested))


def _production_sources(state: Dict) -> List[Tuple[Dict, str, int, bool]]:
    sources = []
    for building in state["board"]["buildings"]:
        if building["kind"] not in {"colony", "spaceport"}:
            continue
        node = state["board"]["nodes"][building["node_id"]]
        if node.get("kind") == "home":
            sources.append((building, node["resource"], int(node["number"]), True))
            continue
        sector = state["board"]["sectors"].get(building["node_id"])
        if sector and sector.get("kind") == "system":
            enabled = bool(sector.get("explored")) and bool(sector.get("obstacle_cleared"))
            sources.append((building, sector["resource"], int(sector["number"]), enabled))
    return sources


def _resolve_production(state: Dict, roll: int) -> Dict[str, Dict[str, int]]:
    demands = {resource: {player_id: 0 for player_id in state["turn_order"]} for resource in RESOURCE_TYPES}
    produced_by_player = {player_id: set() for player_id in state["turn_order"]}
    for building, resource, number, enabled in _production_sources(state):
        if enabled and number == roll:
            player_id = building["player_id"]
            demands[resource][player_id] += 1
            produced_by_player[player_id].add(resource)
    for player_id, produced_resources in produced_by_player.items():
        for card in _friend_cards(state, player_id):
            bonus = card.get("effect", {}).get("production_bonus")
            if bonus in produced_resources:
                demands[bonus][player_id] += 1

    awards = {player_id: _empty_resources() for player_id in state["turn_order"]}
    for resource in RESOURCE_TYPES:
        total = sum(demands[resource].values())
        if total <= int(state["resource_supply"][resource]):
            for player_id, amount in demands[resource].items():
                if amount:
                    state["resource_supply"][resource] -= amount
                    state["players"][player_id]["hand"][resource] += amount
                    awards[player_id][resource] = amount
    return awards


def _discard_requirements(state: Dict) -> Dict[str, int]:
    result = {}
    for player_id in state["turn_order"]:
        hand_count = _resource_count(state["players"][player_id]["hand"])
        if hand_count > _hand_limit(state, player_id):
            result[player_id] = hand_count // 2
    return result


def _finish_seven_after_discards(state: Dict) -> None:
    active = state["active_player_id"]
    targets = [
        player_id
        for player_id in state["turn_order"]
        if player_id != active and _resource_count(state["players"][player_id]["hand"]) > 0
    ]
    if targets:
        state["phase"] = "seven_steal"
    else:
        _finish_seven(state)


def _finish_seven(state: Dict) -> None:
    active = state["active_player_id"]
    cursor = _next_player_id(state, active)
    while cursor != active:
        _draw_reserve(state, cursor, 1)
        cursor = _next_player_id(state, cursor)
    _draw_earth_reserve(state, active)
    state["phase"] = "trade_build"
    state["production"]["pending_discards"] = {}


def _draw_encounter(state: Dict) -> Dict:
    if not state["encounter_draw"]:
        state["encounter_draw"] = _shuffle(state, "encounter-reshuffle", state["encounter_discard"])
        state["encounter_discard"] = []
    encounter_id = state["encounter_draw"].pop()
    return {
        "id": encounter_id,
        "reader_id": _next_player_id(state, state["active_player_id"]),
        "prompt_read": False,
        "selected_option_id": None,
        "result_revealed": False,
    }


def _option_available(state: Dict, player_id: str, option: Dict) -> bool:
    requirements = option.get("requires", {})
    if not _can_pay(state["players"][player_id]["hand"], requirements.get("resources", {})):
        return False
    if _resource_count(state["players"][player_id]["hand"]) < int(requirements.get("hand_count", 0)):
        return False
    for upgrade, amount in requirements.get("upgrade", {}).items():
        if _effective_upgrade(state, player_id, upgrade) < int(amount):
            return False
    return True


def _gain_fame(state: Dict, player_id: str, count: int) -> int:
    actual = min(max(0, int(count)), int(state["fame_supply"]))
    state["fame_supply"] -= actual
    state["players"][player_id]["fame_pieces"] += actual
    return actual


def _lose_random_resources(state: Dict, player_id: str, count: int) -> int:
    lost = 0
    for _ in range(max(0, int(count))):
        choices = [resource for resource in RESOURCE_TYPES if state["players"][player_id]["hand"][resource] > 0]
        resource = _choice(state, "encounter-resource-loss", choices)
        if resource is None:
            break
        state["players"][player_id]["hand"][resource] -= 1
        state["resource_supply"][resource] += 1
        lost += 1
    return lost


def _apply_encounter_effects(state: Dict, option: Dict) -> None:
    player_id = state["active_player_id"]
    for effect in option.get("effects", []):
        op = effect["op"]
        if op == "spend":
            _return_to_supply(state, player_id, {effect["resource"]: int(effect["count"])})
        elif op == "gain_resource":
            _take_from_supply(state, player_id, effect["resource"], int(effect["count"]))
        elif op == "gain_fame":
            _gain_fame(state, player_id, int(effect["count"]))
        elif op == "speed_bonus" and state.get("flight"):
            amount = int(effect["count"])
            state["flight"]["speed"] += amount
            for ship_id in state["flight"]["movement_remaining"]:
                if ship_id not in state["flight"]["finished_ship_ids"]:
                    state["flight"]["movement_remaining"][ship_id] += amount
        elif op == "lose_resource":
            _lose_random_resources(state, player_id, int(effect["count"]))
        elif op == "free_upgrade":
            upgrade = effect["upgrade"]
            if state["upgrade_supply"][upgrade] > 0:
                state["upgrade_supply"][upgrade] -= 1
                state["players"][player_id]["upgrades"][upgrade] += 1
        elif op == "lose_upgrade":
            for upgrade in ("booster", "cannon", "freight"):
                if state["players"][player_id]["upgrades"][upgrade] > 0:
                    state["players"][player_id]["upgrades"][upgrade] -= 1
                    state["upgrade_supply"][upgrade] += 1
                    break
        elif op == "lock_ship" and state.get("flight"):
            unfinished = [
                ship["id"]
                for ship in sorted(_player_ships(state, player_id), key=lambda item: item["id"])
                if ship["id"] not in state["flight"]["finished_ship_ids"]
            ]
            if unfinished:
                state["flight"]["finished_ship_ids"].append(unfinished[0])


def _start_flight(state: Dict, events: List[Dict]) -> None:
    player_id = state["active_player_id"]
    ships = sorted(_player_ships(state, player_id), key=lambda item: item["id"])
    if not ships:
        _begin_turn_review(state, events)
        return
    balls = _shuffle(state, "mothership", MOTHERSHIP_BALLS)[:2]
    encounter = "black" in balls
    base_speed = 3 if encounter else sum(BALL_VALUES[ball] for ball in balls)
    speed = base_speed + _effective_upgrade(state, player_id, "booster")
    state["flight"] = {
        "balls": balls,
        "base_speed": base_speed,
        "speed": speed,
        "movement_remaining": {ship["id"]: speed for ship in ships},
        "finished_ship_ids": [],
        "revealed_sector_ids": [],
        "cleared_sector_ids": [],
    }
    _record(
        state,
        events,
        "mothership",
        f"{_player_name(state, player_id)} shook {balls[0]} + {balls[1]} for speed {speed}.",
        message_zh=(
            f"{_player_name(state, player_id)}摇出{BALL_ZH[balls[0]]} + "
            f"{BALL_ZH[balls[1]]}，航速为{speed}。"
        ),
        player_id=player_id,
        balls=list(balls),
        speed=speed,
    )
    if encounter:
        state["current_encounter"] = _draw_encounter(state)
        state["phase"] = "encounter_reader"
    else:
        state["phase"] = "flight"


def _sector_terminal_kind(state: Dict, node_id: str) -> str:
    node = state["board"]["nodes"].get(node_id, {})
    if node.get("kind") == "home":
        return "home"
    sector = state["board"]["sectors"].get(node_id)
    if sector:
        return str(sector.get("kind"))
    return "space"


def _ship_can_finish_at(state: Dict, ship: Dict) -> bool:
    kind = _sector_terminal_kind(state, ship["node_id"])
    if ship["kind"] == "colony" and kind == "outpost":
        return False
    if ship["kind"] == "trade" and kind == "system":
        return False
    return True


def _known_terminal_is_compatible(state: Dict, ship_kind: str, node_id: str) -> bool:
    sector = state["board"]["sectors"].get(node_id)
    if not sector or not sector.get("revealed"):
        return True
    if ship_kind == "colony" and sector.get("kind") == "outpost":
        return False
    if ship_kind == "trade" and sector.get("kind") == "system":
        return False
    return True


def _settleable(state: Dict, ship: Dict) -> bool:
    if ship["kind"] != "colony":
        return False
    sector = state["board"]["sectors"].get(ship["node_id"])
    if not sector or sector.get("kind") != "system" or not sector.get("revealed") or not sector.get("explored"):
        return False
    if not sector.get("obstacle_cleared"):
        return False
    player_id = ship["player_id"]
    buildings = _buildings_at(state, ship["node_id"])
    if any(item["player_id"] == player_id and item["kind"] in {"colony", "spaceport"} for item in buildings):
        return False
    capacity = 2 if len(state["turn_order"]) == 3 else 3
    return sum(item["kind"] in {"colony", "spaceport"} for item in buildings) < capacity


def _stationable(state: Dict, ship: Dict) -> bool:
    if ship["kind"] != "trade":
        return False
    sector = state["board"]["sectors"].get(ship["node_id"])
    if not sector or sector.get("kind") != "outpost" or not sector.get("revealed"):
        return False
    player_id = ship["player_id"]
    if any(item["player_id"] == player_id and item["kind"] == "trade_station" for item in _buildings_at(state, ship["node_id"])):
        return False
    stations = sum(item["kind"] == "trade_station" for item in _buildings_at(state, ship["node_id"]))
    return int(state["players"][player_id]["upgrades"]["freight"]) > stations


def _clear_obstacle_if_possible(state: Dict, player_id: str, node_id: str, events: List[Dict]) -> None:
    sector = state["board"]["sectors"].get(node_id)
    if not sector or sector.get("kind") != "system" or sector.get("obstacle_cleared"):
        return
    obstacle = sector.get("obstacle") or {}
    strength = int(obstacle.get("strength", 999))
    if obstacle.get("kind") == "pirate":
        ready = _effective_upgrade(state, player_id, "cannon") >= strength
    else:
        ready = int(state["players"][player_id]["upgrades"]["freight"]) >= strength
    if not ready:
        return
    sector["obstacle_cleared"] = True
    medal_id = f"{obstacle['kind']}:{sector['id']}"
    state["players"][player_id]["permanent_medals"].append(medal_id)
    state["flight"]["cleared_sector_ids"].append(sector["id"])
    _record(
        state,
        events,
        "obstacle_cleared",
        f"{_player_name(state, player_id)} cleared {sector['name']} and secured a permanent medal.",
        message_zh=f"{_player_name(state, player_id)}清除了{_sector_name(state, sector)}的障碍，并获得一枚永久勋章。",
        player_id=player_id,
        sector_id=sector["id"],
        obstacle=obstacle["kind"],
    )


def _reveal_node(state: Dict, player_id: str, node_id: str, events: List[Dict]) -> None:
    sector = state["board"]["sectors"].get(node_id)
    if not sector:
        return
    newly_revealed = not bool(sector.get("revealed"))
    if newly_revealed:
        sector["revealed"] = True
        state["flight"]["revealed_sector_ids"].append(sector["id"])
        _record(
            state,
            events,
            "sector_discovered",
            f"{_player_name(state, player_id)} discovered {sector['name']}.",
            message_zh=f"{_player_name(state, player_id)}发现了{_sector_name(state, sector)}。",
            player_id=player_id,
            sector_id=sector["id"],
            sector_kind=sector["kind"],
        )
    if sector.get("kind") == "system" and not sector.get("explored"):
        sector["explored"] = True
        _record(
            state,
            events,
            "system_explored",
            f"{sector['name']} now produces {sector['resource'].title()} on {sector['number']}.",
            message_zh=(
                f"{_sector_name(state, sector)}现可在掷出{sector['number']}时"
                f"生产{_resource_name(state, sector['resource'])}。"
            ),
            player_id=player_id,
            sector_id=sector["id"],
        )
    _clear_obstacle_if_possible(state, player_id, node_id, events)


def _all_flight_ships_done(state: Dict) -> bool:
    active = state["active_player_id"]
    remaining_ids = {ship["id"] for ship in _player_ships(state, active)}
    finished = set((state.get("flight") or {}).get("finished_ship_ids", []))
    return remaining_ids <= finished


def _begin_turn_review(state: Dict, events: List[Dict]) -> None:
    state["phase"] = "turn_review"
    state["current_encounter"] = None
    state["pending_friendship"] = None
    state["trade"]["offer"] = None
    state["trade"]["responses"] = {}
    state["review_required"] = list(state["turn_order"])
    state["review_ready"] = []
    _record(
        state,
        events,
        "turn_complete",
        f"{_player_name(state, state['active_player_id'])}'s flight is complete. Review before the next turn.",
        message_zh=f"{_player_name(state, state['active_player_id'])}的飞行结束。请检查局面后进入下一回合。",
        player_id=state["active_player_id"],
        turn_no=state["turn_no"],
    )


def _start_next_turn(state: Dict) -> None:
    previous = state["active_player_id"]
    state["last_turn_summary"] = list(state.get("turn_summary", []))
    state["turn_summary"] = []
    state["active_player_id"] = _next_player_id(state, previous)
    state["turn_no"] += 1
    state["phase"] = "production"
    state["production"] = {"dice": None, "pending_discards": {}, "stolen": None}
    state["flight"] = None
    state["review_required"] = []
    state["review_ready"] = []
    state["players"][state["active_player_id"]]["turn_flags"] = {}
    _invalidate_trade(state)


def _check_win(state: Dict, events: List[Dict]) -> None:
    if state.get("game_over"):
        return
    active = state["active_player_id"]
    if compute_vp(state, active) < WINNING_VP:
        return
    state["phase"] = "game_over"
    state["game_over"] = True
    state["winner_ids"] = [active]
    state["review_required"] = list(state["turn_order"])
    state["review_ready"] = []
    state["rematch_ready"] = []
    _record(
        state,
        events,
        "game_over",
        f"{_player_name(state, active)} reached {compute_vp(state, active)} VP and won the frontier.",
        message_zh=f"{_player_name(state, active)}达到{compute_vp(state, active)}分，赢得了这片星际边疆！",
        winner_id=active,
        vp=compute_vp(state, active),
    )


def _trade_response_terms(offer: Dict, response: Dict) -> Tuple[Dict[str, int], Dict[str, int]]:
    if response.get("kind") == "accept":
        return offer["want"], offer["give"]
    return response["give"], response["want"]


def _apply_friendship_card(state: Dict, player_id: str, card_id: str) -> None:
    card = FRIENDSHIP_BY_ID[card_id]
    effect = card.get("effect", {})
    if effect.get("immediate_fame"):
        _gain_fame(state, player_id, int(effect["immediate_fame"]))
    if effect.get("immediate_reserve"):
        _draw_reserve(state, player_id, int(effect["immediate_reserve"]))


def _apply_action_mutating(state: Dict, player_id: str, action: Dict, events: List[Dict]) -> Optional[str]:
    action_type = action["type"]
    active = state["active_player_id"]

    if action_type == "roll_production":
        die_a = _rng(state, "production-die-a").randrange(1, 7)
        die_b = _rng(state, "production-die-b").randrange(1, 7)
        roll = die_a + die_b
        state["production"]["dice"] = [die_a, die_b]
        if roll == 7:
            requirements = _discard_requirements(state)
            state["production"]["pending_discards"] = requirements
            state["phase"] = "seven_discard" if requirements else "seven_steal"
            _record(
                state,
                events,
                "production_roll",
                f"{_player_name(state, active)} rolled 7. Tribute is due.",
                message_zh=f"{_player_name(state, active)}掷出7，开始缴纳贡税。",
                roll=7,
            )
            if not requirements:
                _finish_seven_after_discards(state)
        else:
            awards = _resolve_production(state, roll)
            reserve_count = _draw_earth_reserve(state, active)
            state["phase"] = "trade_build"
            _record(
                state,
                events,
                "production_roll",
                f"{_player_name(state, active)} rolled {roll}; Earth sent {reserve_count} reserve card(s).",
                message_zh=f"{_player_name(state, active)}掷出{roll}；地球送来{reserve_count}张后备牌。",
                roll=roll,
                awards=awards,
                reserve_count=reserve_count,
            )

    elif action_type == "discard_resources":
        needed = int(state["production"]["pending_discards"].get(player_id, 0))
        bundle = _normalize_bundle(action.get("resources"))
        if bundle is None or _resource_count(bundle) != needed:
            return f"discard exactly {needed} resources"
        if not _can_pay(state["players"][player_id]["hand"], bundle):
            return "not enough resources"
        _return_to_supply(state, player_id, bundle)
        state["production"]["pending_discards"].pop(player_id, None)
        _record(
            state,
            events,
            "tribute_paid",
            f"{_player_name(state, player_id)} paid {needed} tribute card(s).",
            message_zh=f"{_player_name(state, player_id)}缴纳了{needed}张贡税牌。",
            player_id=player_id,
            count=needed,
        )
        if not state["production"]["pending_discards"]:
            _finish_seven_after_discards(state)

    elif action_type == "choose_steal_target":
        target_id = action.get("target_player_id")
        if target_id == player_id or target_id not in state["players"]:
            return "invalid steal target"
        choices = [resource for resource in RESOURCE_TYPES if state["players"][target_id]["hand"][resource] > 0]
        resource = _choice(state, "tribute-steal", choices)
        if resource is None:
            return "target has no resources"
        state["players"][target_id]["hand"][resource] -= 1
        state["players"][player_id]["hand"][resource] += 1
        state["production"]["stolen"] = {"from": target_id, "to": player_id, "resource": resource}
        _record(
            state,
            events,
            "tribute_stolen",
            f"{_player_name(state, player_id)} took one random card from {_player_name(state, target_id)}.",
            message_zh=f"{_player_name(state, player_id)}从{_player_name(state, target_id)}处随机拿走了1张牌。",
            player_id=player_id,
            target_player_id=target_id,
        )
        _finish_seven(state)

    elif action_type == "open_trade_offer":
        give = _normalize_bundle(action.get("give"))
        want = _normalize_bundle(action.get("want"))
        if give is None or want is None or not _resource_count(give) or not _resource_count(want):
            return "both sides of an offer must contain resources"
        if not _can_pay(state["players"][player_id]["hand"], give):
            return "not enough resources"
        state["trade"]["epoch"] += 1
        state["trade"]["offer"] = {"owner_id": player_id, "give": give, "want": want, "epoch": state["trade"]["epoch"]}
        state["trade"]["responses"] = {}
        _record(
            state,
            events,
            "trade_opened",
            f"{_player_name(state, player_id)} opened a trade offer.",
            message_zh=f"{_player_name(state, player_id)}发起了一项交易。",
            player_id=player_id,
            give=give,
            want=want,
        )

    elif action_type == "submit_trade_response":
        offer = state["trade"]["offer"]
        response_kind = action.get("response", "accept")
        if response_kind == "accept":
            give, want = offer["want"], offer["give"]
        elif response_kind == "counter":
            give = _normalize_bundle(action.get("give"))
            want = _normalize_bundle(action.get("want"))
            if give is None or want is None or not _resource_count(give) or not _resource_count(want):
                return "both sides of a counteroffer must contain resources"
        else:
            return "invalid trade response"
        if not _can_pay(state["players"][player_id]["hand"], give):
            return "not enough resources"
        state["trade"]["responses"][player_id] = {"kind": response_kind, "give": give, "want": want}
        _record(
            state,
            events,
            "trade_response",
            f"{_player_name(state, player_id)} responded to the offer.",
            message_zh=f"{_player_name(state, player_id)}回应了交易。",
            player_id=player_id,
        )

    elif action_type == "withdraw_trade_response":
        state["trade"]["responses"].pop(player_id, None)

    elif action_type == "accept_trade_response":
        responder_id = action.get("response_player_id")
        offer = state["trade"]["offer"]
        response = state["trade"]["responses"].get(responder_id)
        if not response:
            return "trade response not found"
        responder_gives, responder_wants = _trade_response_terms(offer, response)
        if not _can_pay(state["players"][responder_id]["hand"], responder_gives):
            return "responder no longer has those resources"
        if not _can_pay(state["players"][player_id]["hand"], responder_wants):
            return "you no longer have those resources"
        for resource in RESOURCE_TYPES:
            first = responder_wants[resource]
            second = responder_gives[resource]
            state["players"][player_id]["hand"][resource] += second - first
            state["players"][responder_id]["hand"][resource] += first - second
        _invalidate_trade(state)
        _record(
            state,
            events,
            "trade_completed",
            f"{_player_name(state, player_id)} traded with {_player_name(state, responder_id)}.",
            message_zh=f"{_player_name(state, player_id)}与{_player_name(state, responder_id)}完成了交易。",
            player_id=player_id,
            responder_id=responder_id,
        )

    elif action_type == "cancel_trade_offer":
        _invalidate_trade(state)

    elif action_type == "trade_with_supply":
        give_resource = action.get("give_resource")
        receive_resource = action.get("receive_resource")
        if give_resource not in RESOURCE_TYPES or receive_resource not in RESOURCE_TYPES or give_resource == receive_resource:
            return "choose two different resources"
        rate = _bank_rate(state, player_id, give_resource)
        if state["players"][player_id]["hand"][give_resource] < rate:
            return f"this trade requires {rate} {give_resource}"
        if state["resource_supply"][receive_resource] < 1:
            return "requested resource is unavailable"
        state["players"][player_id]["hand"][give_resource] -= rate
        state["resource_supply"][give_resource] += rate
        state["resource_supply"][receive_resource] -= 1
        state["players"][player_id]["hand"][receive_resource] += 1
        if give_resource == "goods" and rate == 1:
            state["players"][player_id]["turn_flags"]["goods_broker_used"] = True
        _invalidate_trade(state)
        _record(
            state,
            events,
            "supply_trade",
            f"{_player_name(state, player_id)} traded {rate} {give_resource} for 1 {receive_resource}.",
            message_zh=(
                f"{_player_name(state, player_id)}用{rate}份{_resource_name(state, give_resource)}"
                f"换取了1份{_resource_name(state, receive_resource)}。"
            ),
            player_id=player_id,
        )

    elif action_type == "build_ship":
        ship_kind = action.get("ship_type")
        spaceport_id = action.get("spaceport_id")
        if ship_kind not in {"colony", "trade"}:
            return "invalid ship type"
        port = next((item for item in _player_buildings(state, player_id, "spaceport") if item["id"] == spaceport_id), None)
        if not port:
            return "spaceport not found"
        cost_key = f"{ship_kind}_ship"
        if not _can_pay(state["players"][player_id]["hand"], BUILD_COSTS[cost_key]):
            return "not enough resources"
        supply_key = "colonies" if ship_kind == "colony" else "trade_stations"
        if state["players"][player_id]["supply"]["transports"] <= 0 or state["players"][player_id]["supply"][supply_key] <= 0:
            return "required ship pieces are unavailable"
        _return_to_supply(state, player_id, BUILD_COSTS[cost_key])
        state["players"][player_id]["supply"]["transports"] -= 1
        state["players"][player_id]["supply"][supply_key] -= 1
        ship_id = _new_ship_id(state, player_id)
        state["board"]["ships"][ship_id] = {"id": ship_id, "player_id": player_id, "kind": ship_kind, "node_id": port["node_id"]}
        state["players"][player_id]["turn_flags"]["build_count"] = int(
            state["players"][player_id]["turn_flags"].get("build_count", 0)
        ) + 1
        _invalidate_trade(state)
        _record(
            state,
            events,
            "ship_built",
            f"{_player_name(state, player_id)} built a {ship_kind.title()} Ship.",
            message_zh=f"{_player_name(state, player_id)}建造了一艘{SHIP_ZH[ship_kind]}。",
            player_id=player_id,
            ship_id=ship_id,
            ship_type=ship_kind,
        )

    elif action_type == "build_spaceport":
        colony_id = action.get("colony_id")
        colony = next((item for item in _player_buildings(state, player_id, "colony") if item["id"] == colony_id), None)
        if not colony:
            return "colony not found"
        if not _can_pay(state["players"][player_id]["hand"], BUILD_COSTS["spaceport"]):
            return "not enough resources"
        if state["players"][player_id]["supply"]["shipyards"] <= 0:
            return "no shipyard piece remains"
        _return_to_supply(state, player_id, BUILD_COSTS["spaceport"])
        colony["kind"] = "spaceport"
        state["players"][player_id]["supply"]["shipyards"] -= 1
        state["players"][player_id]["turn_flags"]["build_count"] = int(
            state["players"][player_id]["turn_flags"].get("build_count", 0)
        ) + 1
        _invalidate_trade(state)
        _record(
            state,
            events,
            "spaceport_built",
            f"{_player_name(state, player_id)} upgraded a Colony to a Spaceport.",
            message_zh=f"{_player_name(state, player_id)}将一座殖民地升级为空间港。",
            player_id=player_id,
            building_id=colony_id,
        )

    elif action_type == "build_upgrade":
        upgrade = action.get("upgrade_type")
        if upgrade not in UPGRADE_TYPES:
            return "invalid upgrade type"
        if not _can_pay(state["players"][player_id]["hand"], BUILD_COSTS[upgrade]):
            return "not enough resources"
        if state["upgrade_supply"][upgrade] <= 0:
            return "that upgrade is unavailable"
        _return_to_supply(state, player_id, BUILD_COSTS[upgrade])
        state["upgrade_supply"][upgrade] -= 1
        state["players"][player_id]["upgrades"][upgrade] += 1
        state["players"][player_id]["turn_flags"]["build_count"] = int(
            state["players"][player_id]["turn_flags"].get("build_count", 0)
        ) + 1
        _invalidate_trade(state)
        _record(
            state,
            events,
            "upgrade_built",
            f"{_player_name(state, player_id)} installed a {upgrade.title()}.",
            message_zh=f"{_player_name(state, player_id)}安装了{UPGRADE_ZH[upgrade]}。",
            player_id=player_id,
            upgrade_type=upgrade,
        )

    elif action_type == "start_flight":
        _invalidate_trade(state)
        _start_flight(state, events)

    elif action_type == "read_encounter_prompt":
        state["current_encounter"]["prompt_read"] = True
        state["phase"] = "encounter_choice"
        card = ENCOUNTER_BY_ID[state["current_encounter"]["id"]]
        localized_card = _encounter_copy(state, card["id"])
        _record(
            state,
            events,
            "encounter_prompt",
            f"Encounter: {card['prompt']}",
            message_zh=f"遭遇：{localized_card['prompt']}",
            encounter_id=card["id"],
        )

    elif action_type == "choose_encounter":
        card = ENCOUNTER_BY_ID[state["current_encounter"]["id"]]
        option = next((item for item in card["options"] if item["id"] == action.get("choice")), None)
        if not option:
            return "invalid encounter choice"
        if not _option_available(state, player_id, option):
            return "encounter choice requirements are not met"
        state["current_encounter"]["selected_option_id"] = option["id"]
        state["phase"] = "encounter_reveal"

    elif action_type == "reveal_encounter_result":
        current = state["current_encounter"]
        card = ENCOUNTER_BY_ID[current["id"]]
        option = next(item for item in card["options"] if item["id"] == current["selected_option_id"])
        _apply_encounter_effects(state, option)
        current["result_revealed"] = True
        state["encounter_discard"].append(current["id"])
        localized_option = _encounter_copy(state, card["id"])["options"][option["id"]]
        _record(
            state,
            events,
            "encounter_result",
            option["result"],
            message_zh=localized_option["result"],
            encounter_id=card["id"],
            option_id=option["id"],
        )
        state["current_encounter"] = None
        state["phase"] = "flight"
        if _all_flight_ships_done(state):
            _begin_turn_review(state, events)

    elif action_type == "move_ship_step":
        ship_id = action.get("ship_id")
        node_id = action.get("node_id")
        ship = state["board"]["ships"].get(ship_id)
        if not ship or ship["player_id"] != player_id:
            return "ship not found"
        if ship_id in state["flight"]["finished_ship_ids"]:
            return "ship has already finished moving"
        if state["flight"]["movement_remaining"].get(ship_id, 0) <= 0:
            return "ship has no movement remaining"
        if node_id not in state["board"]["adjacency"].get(ship["node_id"], []):
            return "destination is not adjacent"
        if state["flight"]["movement_remaining"].get(ship_id, 0) == 1 and not _known_terminal_is_compatible(
            state, ship["kind"], node_id
        ):
            return "that ship type cannot end its flight at this destination"
        was_hidden = bool(
            state["board"]["sectors"].get(node_id)
            and not state["board"]["sectors"][node_id].get("revealed")
        )
        ship["node_id"] = node_id
        state["flight"]["movement_remaining"][ship_id] -= 1
        _reveal_node(state, player_id, node_id, events)
        if (
            was_hidden
            and state["flight"]["movement_remaining"][ship_id] == 0
            and not _known_terminal_is_compatible(state, ship["kind"], node_id)
        ):
            state["flight"]["movement_remaining"][ship_id] = 1

    elif action_type == "finish_ship_move":
        ship_id = action.get("ship_id")
        ship = state["board"]["ships"].get(ship_id)
        if not ship or ship["player_id"] != player_id:
            return "ship not found"
        if not _ship_can_finish_at(state, ship):
            return "this ship cannot finish at that destination"
        if ship_id not in state["flight"]["finished_ship_ids"]:
            state["flight"]["finished_ship_ids"].append(ship_id)
        if _all_flight_ships_done(state):
            _begin_turn_review(state, events)

    elif action_type == "establish_colony":
        ship_id = action.get("ship_id")
        ship = state["board"]["ships"].get(ship_id)
        if not ship or ship["player_id"] != player_id or not _settleable(state, ship):
            return "colony cannot be established here"
        node_id = ship["node_id"]
        state["board"]["ships"].pop(ship_id)
        state["players"][player_id]["supply"]["transports"] += 1
        state["board"]["buildings"].append({
            "id": _building_id(player_id, f"colony-{state['ship_sequence']}-{len(state['board']['buildings'])}"),
            "player_id": player_id,
            "kind": "colony",
            "node_id": node_id,
        })
        sector = state["board"]["sectors"][node_id]
        _record(
            state,
            events,
            "colony_established",
            f"{_player_name(state, player_id)} established a Colony at {sector['name']}.",
            message_zh=f"{_player_name(state, player_id)}在{_sector_name(state, sector)}建立了一座殖民地。",
            player_id=player_id,
            node_id=node_id,
        )
        if _all_flight_ships_done(state):
            _begin_turn_review(state, events)

    elif action_type == "establish_trade_station":
        ship_id = action.get("ship_id")
        ship = state["board"]["ships"].get(ship_id)
        if not ship or ship["player_id"] != player_id or not _stationable(state, ship):
            return "trade station cannot be established here"
        node_id = ship["node_id"]
        sector = state["board"]["sectors"][node_id]
        state["board"]["ships"].pop(ship_id)
        state["players"][player_id]["supply"]["transports"] += 1
        state["board"]["buildings"].append({
            "id": _building_id(player_id, f"station-{state['ship_sequence']}-{len(state['board']['buildings'])}"),
            "player_id": player_id,
            "kind": "trade_station",
            "node_id": node_id,
        })
        civilization = sector["civilization"]
        _update_friendship_marker(state, civilization)
        state["pending_friendship"] = {"player_id": player_id, "civilization": civilization}
        state["phase"] = "friendship_choice"
        _record(
            state,
            events,
            "trade_station_established",
            f"{_player_name(state, player_id)} established a Trade Station at {sector['name']}.",
            message_zh=f"{_player_name(state, player_id)}在{_sector_name(state, sector)}建立了一座贸易站。",
            player_id=player_id,
            civilization=civilization,
        )

    elif action_type == "choose_friendship_card":
        pending = state["pending_friendship"]
        card_id = action.get("card_id")
        civilization = pending["civilization"]
        if card_id not in state["friendship_available"][civilization]:
            return "friendship card is unavailable"
        state["friendship_available"][civilization].remove(card_id)
        state["players"][player_id]["friendship_cards"].append(card_id)
        _apply_friendship_card(state, player_id, card_id)
        state["pending_friendship"] = None
        state["phase"] = "flight"
        _record(
            state,
            events,
            "friendship_card",
            f"{_player_name(state, player_id)} received {FRIENDSHIP_BY_ID[card_id]['name']}.",
            message_zh=f"{_player_name(state, player_id)}获得了“{FRIENDSHIP_ZH[card_id]['name']}”友谊卡。",
            player_id=player_id,
            card_id=card_id,
        )
        if _all_flight_ships_done(state):
            _begin_turn_review(state, events)

    elif action_type == "end_flight":
        for ship in _player_ships(state, player_id):
            if ship["id"] not in state["flight"]["finished_ship_ids"] and not _ship_can_finish_at(state, ship):
                return "a ship must settle, establish a station, or leave its current destination"
        _begin_turn_review(state, events)

    elif action_type == "next_turn":
        if player_id not in state["review_ready"]:
            state["review_ready"].append(player_id)
        _record(
            state,
            events,
            "review_ready",
            f"{_player_name(state, player_id)} is ready for the next turn.",
            message_zh=f"{_player_name(state, player_id)}已准备进入下一回合。",
            player_id=player_id,
        )
        if set(state["review_ready"]) >= set(state["review_required"]):
            _start_next_turn(state)

    elif action_type == "play_again":
        if player_id not in state["rematch_ready"]:
            state["rematch_ready"].append(player_id)
        if set(state["rematch_ready"]) >= set(state["turn_order"]):
            meta = [copy.deepcopy(state["player_meta"][pid]) for pid in state["turn_order"]]
            fresh = _initial_state(state["config"], meta, game_index=int(state.get("game_index", 1)) + 1)
            state.clear()
            state.update(fresh)

    return None


def _has_build_option(state: Dict, player_id: str, kind: str) -> bool:
    if kind in UPGRADE_TYPES:
        return state["upgrade_supply"][kind] > 0 and _can_pay(state["players"][player_id]["hand"], BUILD_COSTS[kind])
    if kind == "spaceport":
        return bool(_player_buildings(state, player_id, "colony")) and state["players"][player_id]["supply"]["shipyards"] > 0 and _can_pay(state["players"][player_id]["hand"], BUILD_COSTS[kind])
    supply_key = "colonies" if kind == "colony_ship" else "trade_stations"
    return (
        bool(_player_buildings(state, player_id, "spaceport"))
        and state["players"][player_id]["supply"]["transports"] > 0
        and state["players"][player_id]["supply"][supply_key] > 0
        and _can_pay(state["players"][player_id]["hand"], BUILD_COSTS[kind])
    )


def _legal_actions(state: Dict, player_id: str) -> List[str]:
    if player_id not in state.get("players", {}):
        return []
    phase = state.get("phase")
    active = state.get("active_player_id")
    actions: List[str] = []
    if phase == "production" and player_id == active:
        return ["roll_production"]
    if phase == "seven_discard" and player_id in state["production"].get("pending_discards", {}):
        return ["discard_resources"]
    if phase == "seven_steal" and player_id == active:
        return ["choose_steal_target"]
    if phase == "trade_build":
        offer = state["trade"].get("offer")
        if player_id == active:
            actions.extend(["open_trade_offer", "trade_with_supply", "start_flight"])
            for kind in ("colony_ship", "trade_ship", "spaceport", *UPGRADE_TYPES):
                if _has_build_option(state, player_id, kind):
                    actions.append("build_ship" if kind.endswith("_ship") else "build_spaceport" if kind == "spaceport" else "build_upgrade")
            if offer:
                actions.append("cancel_trade_offer")
                if state["trade"].get("responses"):
                    actions.append("accept_trade_response")
        elif offer:
            if player_id in state["trade"].get("responses", {}):
                actions.append("withdraw_trade_response")
            else:
                actions.append("submit_trade_response")
        return list(dict.fromkeys(actions))
    if phase == "encounter_reader" and state.get("current_encounter", {}).get("reader_id") == player_id:
        return ["read_encounter_prompt"]
    if phase == "encounter_choice" and player_id == active:
        return ["choose_encounter"]
    if phase == "encounter_reveal" and state.get("current_encounter", {}).get("reader_id") == player_id:
        return ["reveal_encounter_result"]
    if phase == "friendship_choice" and state.get("pending_friendship", {}).get("player_id") == player_id:
        return ["choose_friendship_card"]
    if phase == "flight" and player_id == active:
        actions.append("end_flight")
        for ship in _player_ships(state, player_id):
            if ship["id"] in state["flight"]["finished_ship_ids"]:
                continue
            if state["flight"]["movement_remaining"].get(ship["id"], 0) > 0:
                actions.append("move_ship_step")
            if _ship_can_finish_at(state, ship):
                actions.append("finish_ship_move")
            if _settleable(state, ship):
                actions.append("establish_colony")
            if _stationable(state, ship):
                actions.append("establish_trade_station")
        return list(dict.fromkeys(actions))
    if phase == "turn_review" and player_id in state.get("review_required", []) and player_id not in state.get("review_ready", []):
        return ["next_turn"]
    if phase == "game_over" and player_id not in state.get("rematch_ready", []):
        return ["play_again"]
    return []


def _public_sector(state: Dict, sector: Dict) -> Dict:
    if not sector.get("revealed"):
        return {"node_id": sector["node_id"], "kind": "hidden", "revealed": False, "explored": False}
    view = {
        "id": sector["id"],
        "node_id": sector["node_id"],
        "kind": sector["kind"],
        "name": _sector_name(state, sector),
        "revealed": True,
        "explored": bool(sector.get("explored")),
        "obstacle_cleared": bool(sector.get("obstacle_cleared")),
    }
    if sector["kind"] == "system":
        view["resource"] = sector["resource"]
        view["number"] = sector["number"] if sector.get("explored") else None
        view["obstacle"] = copy.deepcopy(sector.get("obstacle"))
    elif sector["kind"] == "outpost":
        view["civilization"] = sector["civilization"]
    return view


def _encounter_view(state: Dict, viewer_id: str) -> Optional[Dict]:
    current = state.get("current_encounter")
    if not current:
        return None
    card = ENCOUNTER_BY_ID[current["id"]]
    localized_card = _encounter_copy(state, current["id"])
    is_reader = viewer_id == current["reader_id"]
    may_read_prompt = bool(current.get("prompt_read")) or is_reader
    view = {
        "id": current["id"],
        "title": localized_card["title"] if may_read_prompt else _localized(state, "Unidentified encounter", "未知遭遇"),
        "prompt": localized_card["prompt"] if may_read_prompt else None,
        "reader_id": current["reader_id"],
        "prompt_read": bool(current.get("prompt_read")),
        "selected_option_id": current.get("selected_option_id")
        if viewer_id in {current["reader_id"], state["active_player_id"]}
        else None,
    }
    if is_reader or (viewer_id == state["active_player_id"] and current.get("prompt_read")):
        view["options"] = [
            {
                "id": option["id"],
                "label": localized_card["options"][option["id"]]["label"],
                "available": _option_available(state, state["active_player_id"], option),
                **(
                    {
                        "result": localized_card["options"][option["id"]]["result"],
                        "effects": copy.deepcopy(option["effects"]),
                    }
                    if is_reader
                    else {}
                ),
            }
            for option in card["options"]
        ]
    return view


def _legal_move_targets(state: Dict, viewer_id: str) -> Dict[str, List[str]]:
    if state.get("phase") != "flight" or viewer_id != state.get("active_player_id"):
        return {}
    result = {}
    for ship in _player_ships(state, viewer_id):
        if ship["id"] in state["flight"]["finished_ship_ids"]:
            continue
        remaining = int(state["flight"]["movement_remaining"].get(ship["id"], 0))
        if remaining > 0:
            targets = list(state["board"]["adjacency"].get(ship["node_id"], []))
            if remaining == 1:
                targets = [
                    node_id
                    for node_id in targets
                    if _known_terminal_is_compatible(state, ship["kind"], node_id)
                ]
            result[ship["id"]] = targets
    return result


def _friendship_available_view(state: Dict) -> Dict[str, List[Dict]]:
    return {
        civilization: [
            {"id": card_id, **_friendship_copy(state, card_id)}
            for card_id in card_ids
        ]
        for civilization, card_ids in state["friendship_available"].items()
    }


def _assert_state(state: Dict) -> None:
    if state.get("schema_version") != SCHEMA_VERSION or state.get("game_id") != "catan_starfarers":
        raise AssertionError("invalid state schema")
    order = state.get("turn_order")
    if not isinstance(order, list) or not 3 <= len(order) <= 4 or len(order) != len(set(order)):
        raise AssertionError("invalid turn order")
    if set(order) != set(state.get("players", {})) or state.get("active_player_id") not in order:
        raise AssertionError("player state does not match turn order")
    if state.get("phase") not in PHASES:
        raise AssertionError("invalid phase")
    if state.get("config", {}).get("setup_mode") not in SETUP_MODES:
        raise AssertionError("invalid setup mode")
    if state.get("config", {}).get("language", "en") not in {"en", "zh"}:
        raise AssertionError("invalid language")
    for resource in RESOURCE_TYPES:
        counts = [int(state["resource_supply"].get(resource, -1))]
        counts.append(sum(1 for card in state.get("reserve_deck", []) if card == resource))
        counts.extend(int(state["players"][player_id]["hand"].get(resource, -1)) for player_id in order)
        if any(count < 0 for count in counts) or sum(counts) != RESOURCE_TOTAL:
            raise AssertionError(f"{resource} cards are not conserved")
    if any(card not in RESOURCE_TYPES for card in state.get("reserve_deck", [])):
        raise AssertionError("reserve deck contains an invalid card")
    for upgrade, total in UPGRADE_TOTALS.items():
        value = int(state["upgrade_supply"].get(upgrade, -1)) + sum(
            int(state["players"][player_id]["upgrades"].get(upgrade, -1)) for player_id in order
        )
        if value != total:
            raise AssertionError(f"{upgrade} pieces are not conserved")
    fame = int(state.get("fame_supply", -1)) + sum(int(state["players"][player_id]["fame_pieces"]) for player_id in order)
    if fame != FAME_TOTAL:
        raise AssertionError("fame pieces are not conserved")
    encounter_ids = list(state.get("encounter_draw", [])) + list(state.get("encounter_discard", []))
    if state.get("current_encounter"):
        encounter_ids.append(state["current_encounter"]["id"])
    expected_encounters = {card["id"] for card in ENCOUNTERS}
    if len(encounter_ids) != len(expected_encounters) or set(encounter_ids) != expected_encounters:
        raise AssertionError("encounter cards are not conserved")
    friendship_ids = [card_id for values in state["friendship_available"].values() for card_id in values]
    for player_id in order:
        friendship_ids.extend(state["players"][player_id]["friendship_cards"])
    expected_friendship = {card["id"] for card in FRIENDSHIP_CARDS}
    if len(friendship_ids) != len(expected_friendship) or set(friendship_ids) != expected_friendship:
        raise AssertionError("friendship cards are not conserved")
    board = state.get("board", {})
    node_ids = set(board.get("nodes", {}))
    if node_ids != {item["id"] for item in MAP_GRAPH["nodes"]}:
        raise AssertionError("map nodes are incomplete")
    for first, second in board.get("edges", []):
        if first not in node_ids or second not in node_ids or first == second:
            raise AssertionError("map contains an invalid edge")
    all_sector_ids = [sector["id"] for sector in board.get("sectors", {}).values()]
    all_sector_ids.append(board.get("removed_sector", {}).get("id"))
    expected_sectors = {sector["id"] for sector in MAP_GRAPH["sectors"]}
    if len(all_sector_ids) != len(expected_sectors) or set(all_sector_ids) != expected_sectors:
        raise AssertionError("sector tiles are not conserved")
    for building in board.get("buildings", []):
        if building.get("player_id") not in order or building.get("node_id") not in node_ids:
            raise AssertionError("invalid building")
    for ship_id, ship in board.get("ships", {}).items():
        if ship_id != ship.get("id") or ship.get("player_id") not in order or ship.get("node_id") not in node_ids:
            raise AssertionError("invalid ship")
    if state.get("phase") == "seven_discard":
        if not state.get("production", {}).get("pending_discards"):
            raise AssertionError("discard phase has no pending discards")
    if state.get("phase", "").startswith("encounter") and not state.get("current_encounter"):
        raise AssertionError("encounter phase has no encounter")
    if state.get("phase") == "friendship_choice" and not state.get("pending_friendship"):
        raise AssertionError("friendship phase has no pending card choice")


def _shortest_step(state: Dict, start: str, goals: Set[str]) -> Optional[str]:
    if not goals or start in goals:
        return None
    queue = deque([start])
    previous = {start: None}
    target = None
    while queue:
        current = queue.popleft()
        for neighbor in state["board"]["adjacency"].get(current, []):
            if neighbor in previous:
                continue
            previous[neighbor] = current
            if neighbor in goals:
                target = neighbor
                queue.clear()
                break
            queue.append(neighbor)
    if target is None:
        return None
    while previous[target] != start:
        target = previous[target]
        if target is None:
            return None
    return target


class CatanStarfarersGame:
    game_id = "catan_starfarers"
    min_players = 3
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        return _initial_state(config, players)

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return _legal_actions(state, player_id)

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        action_type = action["type"]
        if action_type not in _legal_actions(state, player_id):
            return [], "action is not legal now"
        candidate = copy.deepcopy(state)
        events: List[Dict] = []
        try:
            error = _apply_action_mutating(candidate, player_id, action, events)
            if error:
                return [], error
            _check_win(candidate, events)
            _assert_state(candidate)
        except (AssertionError, KeyError, TypeError, ValueError) as exc:
            return [], str(exc) or "invalid action"
        state.clear()
        state.update(candidate)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id)
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            meta = state["player_meta"].get(player_id, {})
            players.append({
                "player_id": player_id,
                "name": meta.get("name") or player_id,
                "seat": meta.get("seat"),
                "is_bot": bool(meta.get("is_bot")),
                "hand_count": _resource_count(player["hand"]),
                "vp": compute_vp(state, player_id),
                "upgrades": copy.deepcopy(player["upgrades"]),
                "fame_pieces": int(player["fame_pieces"]),
                "permanent_medals": list(player["permanent_medals"]),
                "friendship_cards": [
                    {
                        "id": card_id,
                        **_friendship_copy(state, card_id),
                    }
                    for card_id in player["friendship_cards"]
                ],
                "ready": player_id in state.get("review_ready", []),
                "rematch_ready": player_id in state.get("rematch_ready", []),
            })
        sectors = [_public_sector(state, sector) for sector in state["board"]["sectors"].values()]
        occupied_sector_nodes = {sector["node_id"] for sector in sectors}
        for node in state["board"]["nodes"].values():
            if node.get("kind") == "sector" and node["id"] not in occupied_sector_nodes:
                sectors.append({
                    "node_id": node["id"],
                    "kind": "void",
                    "name": _localized(state, "Uncharted Void", "未勘测虚空"),
                    "revealed": True,
                    "explored": True,
                })
        legal = _legal_actions(state, viewer_id)
        pending_discard = int(state.get("production", {}).get("pending_discards", {}).get(viewer_id, 0))
        pending_friendship = state.get("pending_friendship")
        pending_friendship_view = None
        if pending_friendship and pending_friendship.get("player_id") == viewer_id:
            pending_friendship_view = copy.deepcopy(pending_friendship)
            civilization = str(pending_friendship_view.get("civilization") or "")
            pending_friendship_view["civilization_name"] = (
                CIVILIZATION_ZH.get(civilization, civilization)
                if _language(state) == "zh"
                else civilization.replace("_", " ").title()
            )
        return {
            "game_id": CatanStarfarersGame.game_id,
            "you": viewer_id,
            "game_index": int(state.get("game_index", 1)),
            "setup_mode": state["config"]["setup_mode"],
            "language": _language(state),
            "turn_no": int(state["turn_no"]),
            "phase": state["phase"],
            "active_player_id": state["active_player_id"],
            "players": players,
            "your_hand": copy.deepcopy(own["hand"]) if own else _empty_resources(),
            "your_supply": copy.deepcopy(own["supply"]) if own else {},
            "resource_supply": copy.deepcopy(state["resource_supply"]),
            "upgrade_supply": copy.deepcopy(state["upgrade_supply"]),
            "fame_supply": int(state["fame_supply"]),
            "reserve_count": len(state["reserve_deck"]),
            "encounter_counts": {"draw": len(state["encounter_draw"]), "discard": len(state["encounter_discard"])},
            "production": {
                "dice": copy.deepcopy(state["production"].get("dice")),
                "pending_discard_count": pending_discard,
                "pending_player_ids": list(state["production"].get("pending_discards", {})),
                "steal_targets": [
                    player_id
                    for player_id in state["turn_order"]
                    if player_id != viewer_id and _resource_count(state["players"][player_id]["hand"]) > 0
                ] if state["phase"] == "seven_steal" and viewer_id == state["active_player_id"] else [],
            },
            "board": {
                "nodes": [copy.deepcopy(node) for node in state["board"]["nodes"].values()],
                "edges": copy.deepcopy(state["board"]["edges"]),
                "sectors": sorted(sectors, key=lambda item: item["node_id"]),
                "buildings": copy.deepcopy(state["board"]["buildings"]),
                "ships": copy.deepcopy(list(state["board"]["ships"].values())),
            },
            "flight": copy.deepcopy(state.get("flight")),
            "legal_move_targets": _legal_move_targets(state, viewer_id),
            "settleable_ship_ids": [ship["id"] for ship in _player_ships(state, viewer_id) if _settleable(state, ship)],
            "stationable_ship_ids": [ship["id"] for ship in _player_ships(state, viewer_id) if _stationable(state, ship)],
            "your_spaceports": copy.deepcopy(_player_buildings(state, viewer_id, "spaceport")),
            "your_colonies": copy.deepcopy(_player_buildings(state, viewer_id, "colony")),
            "trade": copy.deepcopy(state["trade"]),
            "encounter": _encounter_view(state, viewer_id),
            "friendship_available": _friendship_available_view(state),
            "pending_friendship": pending_friendship_view,
            "friendship_marker_holder": copy.deepcopy(state["friendship_marker_holder"]),
            "review_progress": {
                "done": len(set(state.get("review_ready", [])) & set(state.get("review_required", []))),
                "total": len(state.get("review_required", [])),
            },
            "review_ready": list(state.get("review_ready", [])),
            "last_turn_summary": list(state.get("last_turn_summary", [])),
            "turn_summary": list(state.get("turn_summary", [])),
            "activity": copy.deepcopy(state.get("activity", [])),
            "game_over": bool(state.get("game_over")),
            "winner_ids": list(state.get("winner_ids", [])),
            "winning_vp": WINNING_VP,
            "legal_actions": legal,
            "build_costs": copy.deepcopy(BUILD_COSTS),
            "bank_rates": {resource: _bank_rate(state, viewer_id, resource) for resource in RESOURCE_TYPES} if own else {},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = _legal_actions(state, bot_id)
        if not legal:
            return None
        if "discard_resources" in legal:
            needed = int(state["production"]["pending_discards"][bot_id])
            bundle = _empty_resources()
            resources = sorted(RESOURCE_TYPES, key=lambda item: (-state["players"][bot_id]["hand"][item], item))
            for resource in resources:
                amount = min(needed, state["players"][bot_id]["hand"][resource])
                bundle[resource] = amount
                needed -= amount
            return {"type": "discard_resources", "resources": bundle, "delay_ms": 250}
        if "roll_production" in legal:
            return {"type": "roll_production", "delay_ms": 300}
        if "choose_steal_target" in legal:
            targets = [pid for pid in state["turn_order"] if pid != bot_id and _resource_count(state["players"][pid]["hand"]) > 0]
            target = max(targets, key=lambda pid: (_resource_count(state["players"][pid]["hand"]), pid))
            return {"type": "choose_steal_target", "target_player_id": target, "delay_ms": 250}
        if "read_encounter_prompt" in legal:
            return {"type": "read_encounter_prompt", "delay_ms": 350}
        if "choose_encounter" in legal:
            card = ENCOUNTER_BY_ID[state["current_encounter"]["id"]]
            available = [option for option in card["options"] if _option_available(state, bot_id, option)]
            option = max(available, key=lambda item: (sum(1 for effect in item["effects"] if effect["op"] in {"gain_fame", "free_upgrade", "speed_bonus"}), item["id"]))
            return {"type": "choose_encounter", "choice": option["id"], "delay_ms": 350}
        if "reveal_encounter_result" in legal:
            return {"type": "reveal_encounter_result", "delay_ms": 350}
        if "choose_friendship_card" in legal:
            civilization = state["pending_friendship"]["civilization"]
            card_id = state["friendship_available"][civilization][0]
            return {"type": "choose_friendship_card", "card_id": card_id, "delay_ms": 250}
        if state["phase"] == "trade_build" and bot_id == state["active_player_id"]:
            player = state["players"][bot_id]
            built = int(player["turn_flags"].get("build_count", 0))
            if built < 1:
                for upgrade in ("booster", "freight", "cannon"):
                    if "build_upgrade" in legal and _has_build_option(state, bot_id, upgrade):
                        return {"type": "build_upgrade", "upgrade_type": upgrade, "delay_ms": 250}
                for ship_kind in ("colony", "trade"):
                    if "build_ship" in legal and _has_build_option(state, bot_id, f"{ship_kind}_ship"):
                        return {"type": "build_ship", "ship_type": ship_kind, "spaceport_id": _player_buildings(state, bot_id, "spaceport")[0]["id"], "delay_ms": 250}
            return {"type": "start_flight", "delay_ms": 250}
        if state["phase"] == "trade_build" and "submit_trade_response" in legal:
            offer = state["trade"]["offer"]
            if _can_pay(state["players"][bot_id]["hand"], offer["want"]):
                return {"type": "submit_trade_response", "response": "accept", "delay_ms": 250}
            return None
        if state["phase"] == "flight" and bot_id == state["active_player_id"]:
            for ship in sorted(_player_ships(state, bot_id), key=lambda item: item["id"]):
                if ship["id"] in state["flight"]["finished_ship_ids"]:
                    continue
                if _settleable(state, ship):
                    return {"type": "establish_colony", "ship_id": ship["id"], "delay_ms": 250}
                if _stationable(state, ship):
                    return {"type": "establish_trade_station", "ship_id": ship["id"], "delay_ms": 250}
                if state["flight"]["movement_remaining"].get(ship["id"], 0) > 0:
                    hidden_goals = {
                        node_id
                        for node_id, sector in state["board"]["sectors"].items()
                        if not sector.get("revealed")
                    }
                    if ship["kind"] == "colony":
                        goals = {
                            node_id
                            for node_id, sector in state["board"]["sectors"].items()
                            if sector.get("revealed")
                            and sector.get("kind") == "system"
                            and sector.get("obstacle_cleared")
                            and len(_buildings_at(state, node_id)) < (2 if len(state["turn_order"]) == 3 else 3)
                        } | hidden_goals
                    else:
                        goals = {
                            node_id
                            for node_id, sector in state["board"]["sectors"].items()
                            if sector.get("revealed")
                            and sector.get("kind") == "outpost"
                            and state["players"][bot_id]["upgrades"]["freight"]
                            > sum(item["kind"] == "trade_station" for item in _buildings_at(state, node_id))
                        } | hidden_goals
                    step = _shortest_step(state, ship["node_id"], goals)
                    if step:
                        return {"type": "move_ship_step", "ship_id": ship["id"], "node_id": step, "delay_ms": 180}
                if _ship_can_finish_at(state, ship):
                    return {"type": "finish_ship_move", "ship_id": ship["id"], "delay_ms": 150}
            return {"type": "end_flight", "delay_ms": 150}
        if "next_turn" in legal:
            return {"type": "next_turn", "delay_ms": 150}
        if "play_again" in legal:
            return {"type": "play_again", "delay_ms": 150}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict):
            raise ValueError("invalid CATAN: Starfarers save payload")
        state = copy.deepcopy(payload)
        try:
            _assert_state(state)
        except (AssertionError, KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"invalid CATAN: Starfarers save payload: {exc}") from exc
        return state


__all__ = ["CatanStarfarersGame", "compute_vp"]
