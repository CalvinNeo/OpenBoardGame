import copy
import json
import random
import secrets
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


PRESET_PATH = Path(__file__).resolve().parent / "assets" / "bomb_busters" / "practice_presets.json"
INFO_LABELS = tuple(str(value) for value in range(1, 13)) + ("yellow",)
WIRE_STATUSES = {"uncut", "cut", "secured"}
PHASES = {"initial_info", "playing", "awaiting_detector_choice", "mission_result"}
PRESET_KEYS = {
    "id",
    "name",
    "description",
    "blue_min",
    "blue_max",
    "copies_per_blue",
    "yellow_count",
    "red_count",
    "shared_equipment",
}


def _load_practice_presets(path: Path = PRESET_PATH) -> Dict[str, Dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or set(payload) != {"version", "presets"}:
        raise ValueError("invalid Bomb Busters practice preset document")
    if payload.get("version") != 1 or not isinstance(payload.get("presets"), list):
        raise ValueError("unsupported Bomb Busters practice preset version")

    presets: Dict[str, Dict] = {}
    for raw in payload["presets"]:
        if not isinstance(raw, dict) or set(raw) != PRESET_KEYS:
            raise ValueError("invalid Bomb Busters practice preset fields")
        preset_id = raw.get("id")
        if not isinstance(preset_id, str) or not preset_id or preset_id in presets:
            raise ValueError("duplicate or invalid Bomb Busters practice preset id")
        if not isinstance(raw.get("name"), str) or not isinstance(raw.get("description"), str):
            raise ValueError("practice preset name and description are required")
        integer_fields = ("blue_min", "blue_max", "copies_per_blue", "yellow_count", "red_count")
        if any(isinstance(raw.get(key), bool) or not isinstance(raw.get(key), int) for key in integer_fields):
            raise ValueError("practice preset counts must be integers")
        if not 1 <= raw["blue_min"] <= raw["blue_max"] <= 12:
            raise ValueError("practice preset blue range is invalid")
        if raw["copies_per_blue"] != 4:
            raise ValueError("practice presets require four copies of each blue wire")
        if not 0 <= raw["yellow_count"] <= 11 or raw["yellow_count"] % 2:
            raise ValueError("practice preset yellow count must be an even number from 0 to 10")
        if not 0 <= raw["red_count"] <= 11:
            raise ValueError("practice preset red count must be from 0 to 11")
        if raw.get("shared_equipment") is not False:
            raise ValueError("shared equipment is unavailable in Core Practice")
        presets[preset_id] = dict(raw)

    required = {"short_practice", "standard_practice", "high_risk_practice"}
    if set(presets) != required:
        raise ValueError("Bomb Busters Core Practice requires exactly three presets")
    return presets


PRACTICE_PRESETS = _load_practice_presets()


def _seat_order(player_meta: Dict[str, Dict]) -> List[str]:
    return sorted(
        player_meta,
        key=lambda player_id: (int(player_meta[player_id].get("seat", 0)), player_id),
    )


def _rotated_order(order: List[str], first_player_id: str) -> List[str]:
    if not order:
        return []
    index = order.index(first_player_id) if first_player_id in order else 0
    return order[index:] + order[:index]


def _next_seat(order: List[str], player_id: str) -> Optional[str]:
    if not order:
        return None
    if player_id not in order:
        return order[0]
    return order[(order.index(player_id) + 1) % len(order)]


def _sort_label(sort_tick: int) -> str:
    whole, decimal = divmod(int(sort_tick), 10)
    return str(whole) if decimal == 0 else f"{whole}.{decimal}"


def _wire_match_key(wire: Dict) -> str:
    kind = wire.get("kind")
    if kind == "blue":
        return f"blue:{int(wire['blue_value'])}"
    if kind in ("yellow", "red"):
        return kind
    raise ValueError("unknown wire kind")


def _wire_label(wire: Dict) -> Optional[str]:
    if wire.get("kind") == "blue":
        return str(int(wire["blue_value"]))
    if wire.get("kind") == "yellow":
        return "yellow"
    return None


def _declared_label(wire: Dict) -> str:
    if wire.get("kind") == "blue":
        return f"BLUE {int(wire['blue_value'])}"
    if wire.get("kind") == "yellow":
        return "YELLOW"
    return "RED"


def _build_wire_pool(preset: Dict, rng: random.Random) -> List[Dict]:
    pool: List[Dict] = []
    for value in range(int(preset["blue_min"]), int(preset["blue_max"]) + 1):
        for _ in range(int(preset["copies_per_blue"])):
            pool.append({"kind": "blue", "blue_value": value, "sort_tick": value * 10})

    yellow_ticks = rng.sample([value * 10 + 1 for value in range(1, 12)], int(preset["yellow_count"]))
    red_ticks = rng.sample([value * 10 + 5 for value in range(1, 12)], int(preset["red_count"]))
    pool.extend({"kind": "yellow", "blue_value": None, "sort_tick": tick} for tick in yellow_ticks)
    pool.extend({"kind": "red", "blue_value": None, "sort_tick": tick} for tick in red_ticks)
    rng.shuffle(pool)

    used_ids = set()
    for wire in pool:
        wire_id = ""
        while not wire_id or wire_id in used_ids:
            wire_id = f"w-{rng.getrandbits(64):016x}"
        used_ids.add(wire_id)
        wire.update(
            {
                "wire_id": wire_id,
                "owner_id": None,
                "rack_id": None,
                "slot_index": None,
                "status": "uncut",
                "info_token_id": None,
            }
        )
    return pool


def _new_info_tokens() -> Dict[str, Dict]:
    tokens: Dict[str, Dict] = {}
    for label in INFO_LABELS:
        for suffix in ("a", "b"):
            token_id = f"info-{label}-{suffix}"
            tokens[token_id] = {
                "token_id": token_id,
                "label": label,
                "attached_wire_id": None,
            }
    return tokens


def _rack_counts(state: Dict) -> Dict[str, int]:
    player_count = len(state["turn_order"])
    if player_count == 2:
        return {player_id: 2 for player_id in state["turn_order"]}
    if player_count == 3:
        return {
            player_id: (2 if player_id == state["captain_id"] else 1)
            for player_id in state["turn_order"]
        }
    return {player_id: 1 for player_id in state["turn_order"]}


def _deal_and_sort(state: Dict, pool: List[Dict]) -> None:
    racks: Dict[str, Dict] = {}
    rack_order: List[str] = []
    counts = _rack_counts(state)
    for player_id in _rotated_order(state["turn_order"], state["captain_id"]):
        for rack_index in range(counts[player_id]):
            rack_id = f"rack-{player_id}-{rack_index + 1}"
            racks[rack_id] = {
                "rack_id": rack_id,
                "owner_id": player_id,
                "rack_index": rack_index,
                "slots": [],
            }
            rack_order.append(rack_id)
            state["players"][player_id]["rack_ids"].append(rack_id)

    for index, wire in enumerate(pool):
        rack_id = rack_order[index % len(rack_order)]
        wire["rack_id"] = rack_id
        wire["owner_id"] = racks[rack_id]["owner_id"]
        racks[rack_id]["slots"].append(wire["wire_id"])

    wires = {wire["wire_id"]: wire for wire in pool}
    for rack in racks.values():
        rack["slots"].sort(key=lambda wire_id: (int(wires[wire_id]["sort_tick"]), wire_id))
        for slot_index, wire_id in enumerate(rack["slots"]):
            wires[wire_id]["slot_index"] = slot_index

    state["racks"] = racks
    state["rack_order"] = rack_order
    state["wires"] = wires
    state["in_play_wire_ids"] = [wire["wire_id"] for wire in pool]


def _start_mission(state: Dict) -> None:
    preset = PRACTICE_PRESETS[state["practice_preset"]]
    rng = random.Random(f"{state['rng_seed']}:{state['rng_counter']}:mission")
    state["rng_counter"] = int(state.get("rng_counter", 0)) + 1

    state["players"] = {
        player_id: {
            "rack_ids": [],
            "personal_detector_used": False,
            "initial_info_placed": False,
            "result_ready": False,
        }
        for player_id in state["turn_order"]
    }
    pool = _build_wire_pool(preset, rng)
    _deal_and_sort(state, pool)
    state["public_color_markers"] = {
        "yellow": [
            {"sort_tick": wire["sort_tick"], "sort_label": _sort_label(wire["sort_tick"]), "certainty": "certain"}
            for wire in sorted(pool, key=lambda item: item["sort_tick"])
            if wire["kind"] == "yellow"
        ],
        "red": [
            {"sort_tick": wire["sort_tick"], "sort_label": _sort_label(wire["sort_tick"]), "certainty": "certain"}
            for wire in sorted(pool, key=lambda item: item["sort_tick"])
            if wire["kind"] == "red"
        ],
    }
    state["info_tokens"] = _new_info_tokens()
    state["in_play_blue_counts"] = {
        str(value): sum(1 for wire in pool if wire["kind"] == "blue" and wire["blue_value"] == value)
        for value in range(1, 13)
    }
    state["cut_blue_counts"] = {str(value): 0 for value in range(1, 13)}
    state["validation_complete"] = {str(value): False for value in range(1, 13)}
    state["detonator"] = {
        "mistake_limit": len(state["turn_order"]),
        "mistakes_used": 0,
        "remaining": len(state["turn_order"]),
    }
    state["phase"] = "initial_info"
    state["initial_info_order"] = _rotated_order(state["turn_order"], state["captain_id"])
    state["initial_info_cursor"] = 0
    state["current_turn"] = None
    state["current_responder_id"] = None
    state["pending_resolution"] = None
    state["result_ready_ids"] = []
    state["last_result"] = None
    state["public_activity"] = []
    state["private_audit"] = []
    state["action_number"] = 0
    state["game_over"] = False
    _assert_state_invariants(state)


def _player_uncut_wires(state: Dict, player_id: str) -> List[Dict]:
    return [
        wire
        for wire in state.get("wires", {}).values()
        if wire.get("owner_id") == player_id and wire.get("status") == "uncut"
    ]


def _all_uncut_wires(state: Dict) -> List[Dict]:
    return [wire for wire in state.get("wires", {}).values() if wire.get("status") == "uncut"]


def _record_activity(state: Dict, activity_type: str, actor_id: Optional[str], message: str) -> None:
    state.setdefault("public_activity", []).append(
        {
            "type": activity_type,
            "actor_id": actor_id,
            "message": message,
            "action_number": int(state.get("action_number", 0)),
        }
    )
    state["public_activity"] = state["public_activity"][-24:]


def _player_name(state: Dict, player_id: str) -> str:
    return str(state.get("player_meta", {}).get(player_id, {}).get("name") or "A player")


def _allocate_info(state: Dict, wire: Dict) -> Dict:
    label = _wire_label(wire)
    if label is None:
        raise ValueError("red wires cannot receive Info tokens")
    existing_id = wire.get("info_token_id")
    if existing_id:
        token = state["info_tokens"].get(existing_id)
        if not token or token.get("label") != label:
            raise AssertionError("wire has an invalid Info token")
        return {"mode": "existing", "label": label, "wire_id": wire["wire_id"]}

    for token in state["info_tokens"].values():
        if token.get("label") == label and token.get("attached_wire_id") is None:
            token["attached_wire_id"] = wire["wire_id"]
            wire["info_token_id"] = token["token_id"]
            return {
                "mode": "token",
                "label": label,
                "wire_id": wire["wire_id"],
                "token_id": token["token_id"],
            }
    return {"mode": "spoken", "label": label, "wire_id": wire["wire_id"]}


def _info_events(result: Dict, actor_id: str) -> List[Dict]:
    if result["mode"] == "existing":
        return []
    if result["mode"] == "spoken":
        return [
            {
                "type": "bomb_busters:spoken_info",
                "payload": {
                    "player_id": actor_id,
                    "target_wire_id": result["wire_id"],
                    "label": result["label"],
                },
            }
        ]
    return [
        {
            "type": "bomb_busters:info_placed",
            "payload": {
                "player_id": actor_id,
                "target_wire_id": result["wire_id"],
                "label": result["label"],
            },
        }
    ]


def _return_info_token(state: Dict, wire: Dict) -> None:
    token_id = wire.get("info_token_id")
    if not token_id:
        return
    token = state.get("info_tokens", {}).get(token_id)
    if token:
        token["attached_wire_id"] = None
    wire["info_token_id"] = None


def _cut_wire(state: Dict, wire: Dict, status: str = "cut") -> None:
    if wire.get("status") != "uncut":
        raise AssertionError("wire is already processed")
    if status == "secured" and wire.get("kind") != "red":
        raise AssertionError("only red wires can be secured")
    _return_info_token(state, wire)
    wire["status"] = status


def _refresh_validation(state: Dict) -> List[int]:
    previous = dict(state.get("validation_complete", {}))
    counts = {str(value): 0 for value in range(1, 13)}
    for wire in state.get("wires", {}).values():
        if wire.get("kind") == "blue" and wire.get("status") == "cut":
            counts[str(int(wire["blue_value"]))] += 1
    state["cut_blue_counts"] = counts
    completed: List[int] = []
    for value in range(1, 13):
        key = str(value)
        in_play = int(state.get("in_play_blue_counts", {}).get(key, 0))
        is_complete = in_play == 4 and counts[key] == in_play
        state["validation_complete"][key] = is_complete
        if is_complete and not previous.get(key):
            completed.append(value)
    return completed


def _validation_events(values: Iterable[int]) -> List[Dict]:
    return [
        {"type": "bomb_busters:validation_complete", "payload": {"blue_value": int(value)}}
        for value in values
    ]


def _advance_turn(state: Dict, actor_id: str) -> None:
    order = state.get("turn_order", [])
    if not order:
        state["current_turn"] = None
        return
    start = order.index(actor_id) if actor_id in order else -1
    for offset in range(1, len(order) + 1):
        candidate = order[(start + offset) % len(order)]
        if _player_uncut_wires(state, candidate):
            state["current_turn"] = candidate
            return
    state["current_turn"] = None


def _finish_mission(state: Dict, result: str, reason: str) -> Dict:
    if state.get("phase") == "mission_result" and state.get("last_result"):
        return state["last_result"]
    bots = [
        player_id
        for player_id in state.get("turn_order", [])
        if bool(state.get("player_meta", {}).get(player_id, {}).get("is_bot"))
    ]
    for player_id, pdata in state.get("players", {}).items():
        pdata["result_ready"] = player_id in bots
    state["phase"] = "mission_result"
    state["current_turn"] = None
    state["current_responder_id"] = None
    state["pending_resolution"] = None
    state["result_ready_ids"] = bots
    state["last_result"] = {
        "result": result,
        "reason": reason,
        "mission_number": int(state.get("mission_number", 1)),
        "attempt_number": int(state.get("attempt_number", 1)),
        "mistakes_used": int(state.get("detonator", {}).get("mistakes_used", 0)),
        "completed_blue_values": [
            value
            for value in range(1, 13)
            if state.get("validation_complete", {}).get(str(value))
        ],
    }
    state.setdefault("mission_history", []).append(copy.deepcopy(state["last_result"]))
    state["mission_history"] = state["mission_history"][-20:]
    message = "Mission defused." if result == "success" else "The bomb exploded."
    _record_activity(state, "mission_result", None, message)
    return state["last_result"]


def _finish_or_advance(state: Dict, actor_id: str, events: List[Dict]) -> None:
    if not _all_uncut_wires(state):
        result = _finish_mission(state, "success", "all_wires_cleared")
        events.append({"type": "bomb_busters:mission_result", "payload": copy.deepcopy(result)})
        return
    _advance_turn(state, actor_id)


def _use_detonator(state: Dict) -> None:
    detonator = state["detonator"]
    detonator["mistakes_used"] = int(detonator.get("mistakes_used", 0)) + 1
    detonator["remaining"] = max(0, int(detonator["mistake_limit"]) - detonator["mistakes_used"])


def _legal_solo_sets(state: Dict, player_id: str) -> List[List[str]]:
    result: List[List[str]] = []
    global_by_key: Dict[str, List[Dict]] = {}
    for wire in _all_uncut_wires(state):
        if wire.get("kind") == "red":
            continue
        global_by_key.setdefault(_wire_match_key(wire), []).append(wire)
    for wires in global_by_key.values():
        if len(wires) not in (2, 4):
            continue
        if all(wire.get("owner_id") == player_id for wire in wires):
            result.append(
                [
                    wire["wire_id"]
                    for wire in sorted(
                        wires,
                        key=lambda item: (item["rack_id"], int(item["slot_index"])),
                    )
                ]
            )
    result.sort(key=lambda group: tuple(group))
    return result


def _can_reveal_red(state: Dict, player_id: str) -> bool:
    wires = _player_uncut_wires(state, player_id)
    return bool(wires) and all(wire.get("kind") == "red" for wire in wires)


def _can_use_detector(state: Dict, player_id: str) -> bool:
    pdata = state.get("players", {}).get(player_id, {})
    if pdata.get("personal_detector_used"):
        return False
    if not any(wire.get("kind") == "blue" for wire in _player_uncut_wires(state, player_id)):
        return False
    for rack in state.get("racks", {}).values():
        if rack.get("owner_id") == player_id:
            continue
        count = sum(
            1
            for wire_id in rack.get("slots", [])
            if state["wires"][wire_id].get("status") == "uncut"
        )
        if count >= 2:
            return True
    return False


def _validate_dual_selection(
    state: Dict,
    player_id: str,
    own_wire_id: object,
    target_wire_id: object,
) -> Tuple[Optional[Dict], Optional[Dict], Optional[str]]:
    if not isinstance(own_wire_id, str) or not isinstance(target_wire_id, str):
        return None, None, "invalid wire selection"
    if own_wire_id == target_wire_id:
        return None, None, "choose two different wires"
    own_wire = state.get("wires", {}).get(own_wire_id)
    target_wire = state.get("wires", {}).get(target_wire_id)
    if not own_wire or own_wire.get("owner_id") != player_id:
        return None, None, "own wire not found"
    if own_wire.get("status") != "uncut":
        return None, None, "own wire is already processed"
    if own_wire.get("kind") == "red":
        return None, None, "red wires cannot be declared"
    if not target_wire or target_wire.get("owner_id") == player_id:
        return None, None, "target must be a teammate wire"
    if target_wire.get("status") != "uncut":
        return None, None, "target wire is already processed"
    return own_wire, target_wire, None


def _public_wire(state: Dict, wire: Dict, viewer_id: str, reveal_all: bool) -> Dict:
    public_info = None
    token_id = wire.get("info_token_id")
    if token_id:
        token = state.get("info_tokens", {}).get(token_id)
        public_info = token.get("label") if token else None
    result = {
        "wire_id": wire["wire_id"],
        "rack_id": wire["rack_id"],
        "slot_index": int(wire["slot_index"]),
        "status": wire["status"],
        "hidden": True,
        "public_info": public_info,
    }
    may_reveal = reveal_all or wire.get("owner_id") == viewer_id or wire.get("status") != "uncut"
    if may_reveal:
        result.update(
            {
                "hidden": False,
                "kind": wire["kind"],
                "blue_value": wire.get("blue_value"),
                "sort_tick": int(wire["sort_tick"]),
                "sort_label": _sort_label(wire["sort_tick"]),
                "match_label": _declared_label(wire),
            }
        )
    return result


def _assert_state_invariants(state: Dict) -> None:
    if state.get("phase") not in PHASES:
        raise AssertionError("invalid Bomb Busters phase")
    wires = state.get("wires", {})
    racks = state.get("racks", {})
    listed_ids: List[str] = []
    for rack_id, rack in racks.items():
        if rack.get("rack_id") != rack_id:
            raise AssertionError("rack id mismatch")
        for slot_index, wire_id in enumerate(rack.get("slots", [])):
            if wire_id not in wires:
                raise AssertionError("rack references an unknown wire")
            wire = wires[wire_id]
            if wire.get("wire_id") != wire_id:
                raise AssertionError("wire id mismatch")
            if wire.get("rack_id") != rack_id or wire.get("owner_id") != rack.get("owner_id"):
                raise AssertionError("wire rack ownership mismatch")
            if int(wire.get("slot_index", -1)) != slot_index:
                raise AssertionError("wire slot index mismatch")
            listed_ids.append(wire_id)
    if len(listed_ids) != len(set(listed_ids)):
        raise AssertionError("wire appears in multiple rack slots")
    if set(listed_ids) != set(wires) or set(listed_ids) != set(state.get("in_play_wire_ids", [])):
        raise AssertionError("wire component conservation failed")

    attached_ids = set()
    for token_id, token in state.get("info_tokens", {}).items():
        if token.get("token_id") != token_id or token.get("label") not in INFO_LABELS:
            raise AssertionError("invalid Info token")
        wire_id = token.get("attached_wire_id")
        if wire_id is None:
            continue
        if wire_id in attached_ids or wire_id not in wires:
            raise AssertionError("Info token attachment is invalid")
        attached_ids.add(wire_id)
        wire = wires[wire_id]
        if wire.get("status") != "uncut" or wire.get("info_token_id") != token_id:
            raise AssertionError("Info token reverse link is invalid")
        if _wire_label(wire) != token.get("label"):
            raise AssertionError("Info token label does not match wire")

    for wire_id, wire in wires.items():
        if wire.get("status") not in WIRE_STATUSES:
            raise AssertionError("invalid wire status")
        if wire.get("status") == "secured" and wire.get("kind") != "red":
            raise AssertionError("only red wires may be secured")
        if wire.get("kind") == "red" and wire.get("status") == "cut" and state.get("phase") != "mission_result":
            raise AssertionError("a cut red wire requires a mission result")
        token_id = wire.get("info_token_id")
        if token_id and token_id not in state.get("info_tokens", {}):
            raise AssertionError("wire references an unknown Info token")

    rack_sizes = [len(rack.get("slots", [])) for rack in racks.values()]
    if rack_sizes and max(rack_sizes) - min(rack_sizes) > 1:
        raise AssertionError("rack sizes differ by more than one wire")


class BombBustersGame:
    game_id = "bomb_busters"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not BombBustersGame.min_players <= len(players) <= BombBustersGame.max_players:
            raise ValueError("Bomb Busters requires 2 to 5 players")
        if not all(isinstance(player, dict) and isinstance(player.get("player_id"), str) for player in players):
            raise ValueError("invalid Bomb Busters player list")
        player_ids = [player["player_id"] for player in players]
        if len(player_ids) != len(set(player_ids)):
            raise ValueError("duplicate Bomb Busters player id")

        raw_config = config if isinstance(config, dict) else {}
        preset_id = raw_config.get("practice_preset", "standard_practice")
        if preset_id not in PRACTICE_PRESETS:
            raise ValueError("unknown Bomb Busters practice preset")
        test_seed = raw_config.get("seed")
        if isinstance(test_seed, bool) or not isinstance(test_seed, (str, int)):
            test_seed = None
        rng_seed = test_seed if test_seed is not None else secrets.token_hex(16)

        player_meta = {player["player_id"]: dict(player) for player in players}
        turn_order = _seat_order(player_meta)
        captain_id = random.Random(f"{rng_seed}:captain").choice(turn_order)
        state = {
            "version": 1,
            "game_id": BombBustersGame.game_id,
            "mode": "practice",
            "practice_preset": preset_id,
            "config": {"practice_preset": preset_id},
            "player_meta": player_meta,
            "turn_order": turn_order,
            "captain_id": captain_id,
            "mission_number": 1,
            "attempt_number": 1,
            "mission_history": [],
            "rng_seed": rng_seed,
            "rng_counter": 0,
        }
        _start_mission(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "initial_info":
            order = state.get("initial_info_order", [])
            cursor = int(state.get("initial_info_cursor", 0))
            if cursor < len(order) and order[cursor] == player_id:
                return ["place_initial_info"]
            return []
        if phase == "awaiting_detector_choice":
            if state.get("current_responder_id") == player_id:
                return ["resolve_detector_choice"]
            return []
        if phase == "mission_result":
            if player_id not in state.get("result_ready_ids", []):
                return ["continue_mission"]
            return []
        if phase != "playing" or state.get("current_turn") != player_id:
            return []

        actions: List[str] = []
        own_action_wires = [
            wire for wire in _player_uncut_wires(state, player_id) if wire.get("kind") != "red"
        ]
        teammate_wires = [
            wire for wire in _all_uncut_wires(state) if wire.get("owner_id") != player_id
        ]
        if own_action_wires and teammate_wires:
            actions.append("dual_cut")
        if _can_use_detector(state, player_id):
            actions.append("double_detector_cut")
        if _legal_solo_sets(state, player_id):
            actions.append("solo_cut")
        if _can_reveal_red(state, player_id):
            actions.append("reveal_red_wires")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        action_type = action["type"]
        phase = state.get("phase")

        if phase == "initial_info":
            if action_type != "place_initial_info":
                return [], "choose an initial clue first"
            order = state.get("initial_info_order", [])
            cursor = int(state.get("initial_info_cursor", 0))
            if cursor >= len(order) or order[cursor] != player_id:
                return [], "not your initial clue turn"
            wire_id = action.get("wire_id")
            wire = state.get("wires", {}).get(wire_id) if isinstance(wire_id, str) else None
            if not wire or wire.get("owner_id") != player_id:
                return [], "wire not in your rack"
            if wire.get("status") != "uncut" or wire.get("kind") != "blue":
                return [], "initial clues require one of your blue wires"
            if state["players"][player_id].get("initial_info_placed"):
                return [], "initial clue already placed"

            state["action_number"] += 1
            info = _allocate_info(state, wire)
            state["players"][player_id]["initial_info_placed"] = True
            state["initial_info_cursor"] = cursor + 1
            _record_activity(state, "initial_info", player_id, f"{_player_name(state, player_id)} shared an initial clue.")
            events = [
                {
                    "type": "bomb_busters:initial_info",
                    "payload": {"player_id": player_id, "target_wire_id": wire["wire_id"]},
                }
            ] + _info_events(info, player_id)
            if state["initial_info_cursor"] >= len(order):
                state["phase"] = "playing"
                state["current_turn"] = state["captain_id"]
                events.append(
                    {
                        "type": "bomb_busters:mission_started",
                        "payload": {"captain_id": state["captain_id"]},
                    }
                )
            _assert_state_invariants(state)
            return events, None

        if phase == "awaiting_detector_choice":
            if action_type != "resolve_detector_choice":
                return [], "waiting for a detector choice"
            pending = state.get("pending_resolution") or {}
            if state.get("current_responder_id") != player_id or pending.get("responder_id") != player_id:
                return [], "not your detector choice"
            wire_id = action.get("wire_id")
            if not isinstance(wire_id, str) or wire_id not in pending.get("allowed_wire_ids", []):
                return [], "wire is not an allowed detector choice"
            wire = state["wires"].get(wire_id)
            if not wire or wire.get("status") != "uncut":
                return [], "chosen wire is already processed"

            actor_id = pending["actor_id"]
            state["action_number"] += 1
            events: List[Dict] = []
            if pending.get("kind") == "cut":
                own_wire = state["wires"].get(pending.get("own_wire_id"))
                if not own_wire or own_wire.get("status") != "uncut":
                    return [], "detector declaration wire is no longer available"
                _cut_wire(state, own_wire)
                _cut_wire(state, wire)
                events.append(
                    {
                        "type": "bomb_busters:detector_cut",
                        "payload": {
                            "player_id": actor_id,
                            "target_player_id": player_id,
                            "cut_wire_ids": [own_wire["wire_id"], wire["wire_id"]],
                        },
                    }
                )
                events.extend(_validation_events(_refresh_validation(state)))
                _record_activity(state, "detector_cut", actor_id, f"{_player_name(state, actor_id)} completed a detector cut.")
            elif pending.get("kind") == "info":
                info = _allocate_info(state, wire)
                events.append(
                    {
                        "type": "bomb_busters:detector_choice",
                        "payload": {"player_id": actor_id, "responder_id": player_id},
                    }
                )
                events.extend(_info_events(info, actor_id))
                _record_activity(state, "detector_miss", actor_id, f"{_player_name(state, actor_id)} used the detector. Detonator -1.")
            else:
                return [], "invalid pending detector choice"
            state["pending_resolution"] = None
            state["current_responder_id"] = None
            state["phase"] = "playing"
            _finish_or_advance(state, actor_id, events)
            _assert_state_invariants(state)
            return events, None

        if phase == "mission_result":
            if action_type != "continue_mission":
                return [], "mission is complete"
            state["action_number"] = int(state.get("action_number", 0)) + 1
            ready = state.setdefault("result_ready_ids", [])
            if player_id not in ready:
                ready.append(player_id)
                state["players"][player_id]["result_ready"] = True
            events = [
                {
                    "type": "bomb_busters:result_ready",
                    "payload": {"player_id": player_id},
                }
            ]
            if set(ready) >= set(state.get("turn_order", [])):
                previous_result = (state.get("last_result") or {}).get("result")
                state["captain_id"] = _next_seat(state["turn_order"], state["captain_id"])
                if previous_result == "success":
                    state["mission_number"] = int(state.get("mission_number", 1)) + 1
                    state["attempt_number"] = 1
                else:
                    state["attempt_number"] = int(state.get("attempt_number", 1)) + 1
                _start_mission(state)
                events.append(
                    {
                        "type": "bomb_busters:new_mission",
                        "payload": {
                            "captain_id": state["captain_id"],
                            "mission_number": state["mission_number"],
                            "attempt_number": state["attempt_number"],
                        },
                    }
                )
            _assert_state_invariants(state)
            return events, None

        if phase != "playing":
            return [], "invalid game phase"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        if action_type == "dual_cut":
            own_wire, target_wire, error = _validate_dual_selection(
                state, player_id, action.get("own_wire_id"), action.get("target_wire_id")
            )
            if error:
                return [], error
            state["action_number"] += 1
            declaration = _declared_label(own_wire)
            if _wire_match_key(own_wire) == _wire_match_key(target_wire):
                _cut_wire(state, own_wire)
                _cut_wire(state, target_wire)
                events = [
                    {
                        "type": "bomb_busters:duo_cut",
                        "payload": {
                            "player_id": player_id,
                            "declaration": declaration,
                            "cut_wire_ids": [own_wire["wire_id"], target_wire["wire_id"]],
                        },
                    }
                ]
                events.extend(_validation_events(_refresh_validation(state)))
                _record_activity(state, "duo_cut", player_id, f"{_player_name(state, player_id)} completed a Duo Cut.")
                _finish_or_advance(state, player_id, events)
                _assert_state_invariants(state)
                return events, None

            if target_wire.get("kind") == "red":
                _cut_wire(state, target_wire)
                result = _finish_mission(state, "failure", "red_wire")
                _record_activity(state, "red_wire", player_id, f"{_player_name(state, player_id)} hit a red wire.")
                events = [
                    {
                        "type": "bomb_busters:red_wire",
                        "payload": {
                            "player_id": player_id,
                            "declaration": declaration,
                            "target_wire_id": target_wire["wire_id"],
                        },
                    },
                    {"type": "bomb_busters:mission_result", "payload": copy.deepcopy(result)},
                ]
                _assert_state_invariants(state)
                return events, None

            _use_detonator(state)
            info = _allocate_info(state, target_wire)
            _record_activity(state, "duo_miss", player_id, f"{_player_name(state, player_id)} attempted a cut. Detonator -1.")
            events = [
                {
                    "type": "bomb_busters:duo_miss",
                    "payload": {
                        "player_id": player_id,
                        "declaration": declaration,
                        "target_wire_id": target_wire["wire_id"],
                        "mistakes_used": state["detonator"]["mistakes_used"],
                        "remaining": state["detonator"]["remaining"],
                    },
                }
            ] + _info_events(info, player_id)
            if state["detonator"]["remaining"] <= 0:
                result = _finish_mission(state, "failure", "detonator")
                events.append({"type": "bomb_busters:mission_result", "payload": copy.deepcopy(result)})
            else:
                _advance_turn(state, player_id)
            _assert_state_invariants(state)
            return events, None

        if action_type == "solo_cut":
            wire_ids = action.get("wire_ids")
            if not isinstance(wire_ids, list) or len(wire_ids) not in (2, 4):
                return [], "Solo Cut requires exactly 2 or 4 wires"
            if len(set(wire_ids)) != len(wire_ids) or not all(isinstance(item, str) for item in wire_ids):
                return [], "Solo Cut wires must be unique"
            selected = [state.get("wires", {}).get(wire_id) for wire_id in wire_ids]
            if any(not wire for wire in selected):
                return [], "unknown Solo Cut wire"
            if any(wire.get("owner_id") != player_id or wire.get("status") != "uncut" for wire in selected):
                return [], "Solo Cut wires must be your uncut wires"
            keys = {_wire_match_key(wire) for wire in selected}
            if len(keys) != 1 or any(wire.get("kind") == "red" for wire in selected):
                return [], "Solo Cut wires must share one blue value or be yellow"
            match_key = next(iter(keys))
            remaining_ids = {
                wire["wire_id"]
                for wire in _all_uncut_wires(state)
                if _wire_match_key(wire) == match_key
            }
            if set(wire_ids) != remaining_ids:
                return [], "Solo Cut must include every remaining matching wire"

            state["action_number"] += 1
            for wire in selected:
                _cut_wire(state, wire)
            events = [
                {
                    "type": "bomb_busters:solo_cut",
                    "payload": {
                        "player_id": player_id,
                        "declaration": _declared_label(selected[0]),
                        "cut_wire_ids": list(wire_ids),
                    },
                }
            ]
            events.extend(_validation_events(_refresh_validation(state)))
            _record_activity(state, "solo_cut", player_id, f"{_player_name(state, player_id)} completed a Solo Cut.")
            _finish_or_advance(state, player_id, events)
            _assert_state_invariants(state)
            return events, None

        if action_type == "reveal_red_wires":
            if not _can_reveal_red(state, player_id):
                return [], "you may secure red wires only when no other wires remain"
            wires = _player_uncut_wires(state, player_id)
            state["action_number"] += 1
            for wire in wires:
                _cut_wire(state, wire, status="secured")
            events = [
                {
                    "type": "bomb_busters:red_secured",
                    "payload": {
                        "player_id": player_id,
                        "secured_wire_ids": [wire["wire_id"] for wire in wires],
                    },
                }
            ]
            _record_activity(state, "red_secured", player_id, f"{_player_name(state, player_id)} secured the remaining red wires.")
            _finish_or_advance(state, player_id, events)
            _assert_state_invariants(state)
            return events, None

        if action_type == "double_detector_cut":
            own_wire_id = action.get("own_wire_id")
            target_ids = action.get("target_wire_ids")
            if not isinstance(own_wire_id, str):
                return [], "choose one of your blue wires"
            own_wire = state.get("wires", {}).get(own_wire_id)
            if (
                not own_wire
                or own_wire.get("owner_id") != player_id
                or own_wire.get("status") != "uncut"
                or own_wire.get("kind") != "blue"
            ):
                return [], "Double Detector requires one of your uncut blue wires"
            if state["players"][player_id].get("personal_detector_used"):
                return [], "Double Detector has already been used"
            if (
                not isinstance(target_ids, list)
                or len(target_ids) != 2
                or len(set(target_ids)) != 2
                or not all(isinstance(item, str) for item in target_ids)
            ):
                return [], "Double Detector requires two different target wires"
            targets = [state.get("wires", {}).get(wire_id) for wire_id in target_ids]
            if any(not wire or wire.get("status") != "uncut" for wire in targets):
                return [], "detector target is unavailable"
            target_owner = targets[0].get("owner_id")
            target_rack = targets[0].get("rack_id")
            if target_owner == player_id or any(wire.get("owner_id") != target_owner for wire in targets):
                return [], "detector targets must belong to one teammate"
            if any(wire.get("rack_id") != target_rack for wire in targets):
                return [], "detector targets must be on the same rack"

            state["action_number"] += 1
            state["players"][player_id]["personal_detector_used"] = True
            declaration = _declared_label(own_wire)
            matches = [wire for wire in targets if _wire_match_key(wire) == _wire_match_key(own_wire)]
            if len(matches) == 1:
                _cut_wire(state, own_wire)
                _cut_wire(state, matches[0])
                events = [
                    {
                        "type": "bomb_busters:detector_cut",
                        "payload": {
                            "player_id": player_id,
                            "target_player_id": target_owner,
                            "declaration": declaration,
                            "cut_wire_ids": [own_wire["wire_id"], matches[0]["wire_id"]],
                        },
                    }
                ]
                events.extend(_validation_events(_refresh_validation(state)))
                _record_activity(state, "detector_cut", player_id, f"{_player_name(state, player_id)} completed a detector cut.")
                _finish_or_advance(state, player_id, events)
                _assert_state_invariants(state)
                return events, None

            if len(matches) == 2:
                state["phase"] = "awaiting_detector_choice"
                state["current_responder_id"] = target_owner
                state["pending_resolution"] = {
                    "kind": "cut",
                    "actor_id": player_id,
                    "responder_id": target_owner,
                    "own_wire_id": own_wire["wire_id"],
                    "target_wire_ids": list(target_ids),
                    "allowed_wire_ids": list(target_ids),
                    "declaration": declaration,
                }
                _record_activity(state, "detector_pending", player_id, f"{_player_name(state, player_id)} used the Double Detector.")
                events = [
                    {
                        "type": "bomb_busters:detector_choice_required",
                        "payload": {
                            "player_id": player_id,
                            "responder_id": target_owner,
                            "declaration": declaration,
                            "target_wire_ids": list(target_ids),
                        },
                    }
                ]
                _assert_state_invariants(state)
                return events, None

            red_targets = [wire for wire in targets if wire.get("kind") == "red"]
            if len(red_targets) == 2:
                result = _finish_mission(state, "failure", "red_wire")
                _record_activity(state, "red_wire", player_id, f"{_player_name(state, player_id)} found two red wires with the detector.")
                events = [
                    {
                        "type": "bomb_busters:detector_miss",
                        "payload": {
                            "player_id": player_id,
                            "responder_id": target_owner,
                            "declaration": declaration,
                            "target_wire_ids": list(target_ids),
                        },
                    },
                    {"type": "bomb_busters:mission_result", "payload": copy.deepcopy(result)},
                ]
                _assert_state_invariants(state)
                return events, None

            _use_detonator(state)
            events = [
                {
                    "type": "bomb_busters:detector_miss",
                    "payload": {
                        "player_id": player_id,
                        "responder_id": target_owner,
                        "declaration": declaration,
                        "target_wire_ids": list(target_ids),
                        "mistakes_used": state["detonator"]["mistakes_used"],
                        "remaining": state["detonator"]["remaining"],
                    },
                }
            ]
            if state["detonator"]["remaining"] <= 0:
                result = _finish_mission(state, "failure", "detonator")
                events.append({"type": "bomb_busters:mission_result", "payload": copy.deepcopy(result)})
                _record_activity(state, "detector_miss", player_id, f"{_player_name(state, player_id)} used the detector. Detonator -1.")
                _assert_state_invariants(state)
                return events, None

            if len(red_targets) == 1:
                non_red = next(wire for wire in targets if wire.get("kind") != "red")
                info = _allocate_info(state, non_red)
                events.extend(_info_events(info, player_id))
                _record_activity(state, "detector_miss", player_id, f"{_player_name(state, player_id)} used the detector. Detonator -1.")
                _advance_turn(state, player_id)
                _assert_state_invariants(state)
                return events, None

            state["phase"] = "awaiting_detector_choice"
            state["current_responder_id"] = target_owner
            state["pending_resolution"] = {
                "kind": "info",
                "actor_id": player_id,
                "responder_id": target_owner,
                "target_wire_ids": list(target_ids),
                "allowed_wire_ids": list(target_ids),
                "declaration": declaration,
            }
            _record_activity(state, "detector_pending", player_id, f"{_player_name(state, player_id)} used the Double Detector. Detonator -1.")
            events.append(
                {
                    "type": "bomb_busters:detector_choice_required",
                    "payload": {
                        "player_id": player_id,
                        "responder_id": target_owner,
                        "declaration": declaration,
                        "target_wire_ids": list(target_ids),
                    },
                }
            )
            _assert_state_invariants(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        reveal_all = state.get("phase") == "mission_result"
        players_view = []
        for player_id in state.get("turn_order", []):
            meta = state.get("player_meta", {}).get(player_id, {})
            pdata = state.get("players", {}).get(player_id, {})
            remaining_count = len(_player_uncut_wires(state, player_id))
            players_view.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "is_captain": player_id == state.get("captain_id"),
                    "rack_ids": list(pdata.get("rack_ids", [])),
                    "remaining_count": remaining_count,
                    "processed_count": sum(
                        len(state["racks"][rack_id].get("slots", []))
                        for rack_id in pdata.get("rack_ids", [])
                    )
                    - remaining_count,
                    "personal_detector_used": bool(pdata.get("personal_detector_used")),
                    "initial_info_placed": bool(pdata.get("initial_info_placed")),
                    "result_ready": player_id in state.get("result_ready_ids", []),
                }
            )

        racks_view = []
        for rack_id in state.get("rack_order", []):
            rack = state["racks"][rack_id]
            racks_view.append(
                {
                    "rack_id": rack_id,
                    "owner_id": rack["owner_id"],
                    "rack_index": int(rack["rack_index"]),
                    "slots": [
                        _public_wire(state, state["wires"][wire_id], viewer_id, reveal_all)
                        for wire_id in rack.get("slots", [])
                    ],
                }
            )

        initial_candidates: List[str] = []
        if state.get("phase") == "initial_info":
            order = state.get("initial_info_order", [])
            cursor = int(state.get("initial_info_cursor", 0))
            if cursor < len(order) and order[cursor] == viewer_id:
                initial_candidates = [
                    wire["wire_id"]
                    for wire in _player_uncut_wires(state, viewer_id)
                    if wire.get("kind") == "blue"
                ]

        pending_choice_ids: List[str] = []
        pending_choice_purpose = None
        pending = state.get("pending_resolution") or {}
        if state.get("phase") == "awaiting_detector_choice" and pending.get("responder_id") == viewer_id:
            pending_choice_ids = list(pending.get("allowed_wire_ids", []))
            pending_choice_purpose = "cut" if pending.get("kind") == "cut" else "info"

        info_supply = {}
        for label in INFO_LABELS:
            info_supply[label] = sum(
                1
                for token in state.get("info_tokens", {}).values()
                if token.get("label") == label and token.get("attached_wire_id") is None
            )

        preset = PRACTICE_PRESETS[state["practice_preset"]]
        return {
            "game_id": BombBustersGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "mode": "practice",
            "practice": {
                "id": preset["id"],
                "name": preset["name"],
                "description": preset["description"],
                "original": True,
                "shared_equipment": False,
            },
            "mission_number": int(state.get("mission_number", 1)),
            "attempt_number": int(state.get("attempt_number", 1)),
            "captain_id": state.get("captain_id"),
            "current_turn": state.get("current_turn"),
            "initial_info_player_id": (
                state.get("initial_info_order", [])[int(state.get("initial_info_cursor", 0))]
                if state.get("phase") == "initial_info"
                and int(state.get("initial_info_cursor", 0)) < len(state.get("initial_info_order", []))
                else None
            ),
            "current_responder_id": state.get("current_responder_id"),
            "players": players_view,
            "racks": racks_view,
            "public_color_markers": copy.deepcopy(state.get("public_color_markers", {})),
            "detonator": copy.deepcopy(state.get("detonator", {})),
            "in_play_blue_counts": dict(state.get("in_play_blue_counts", {})),
            "cut_blue_counts": dict(state.get("cut_blue_counts", {})),
            "validation_complete": dict(state.get("validation_complete", {})),
            "info_supply": info_supply,
            "legal_actions": BombBustersGame.get_legal_actions(state, viewer_id),
            "legal_solo_sets": _legal_solo_sets(state, viewer_id) if state.get("phase") == "playing" else [],
            "can_reveal_red": state.get("phase") == "playing" and _can_reveal_red(state, viewer_id),
            "can_use_double_detector": state.get("phase") == "playing" and _can_use_detector(state, viewer_id),
            "initial_info_candidate_wire_ids": initial_candidates,
            "pending_choice_wire_ids": pending_choice_ids,
            "pending_choice_purpose": pending_choice_purpose,
            "pending_public": (
                {
                    "actor_id": pending.get("actor_id"),
                    "responder_id": pending.get("responder_id"),
                    "declaration": pending.get("declaration"),
                    "target_wire_ids": list(pending.get("target_wire_ids", [])),
                }
                if pending
                else None
            ),
            "public_activity": copy.deepcopy(state.get("public_activity", [])),
            "last_result": copy.deepcopy(state.get("last_result")) if reveal_all else None,
            "result_ready_ids": list(state.get("result_ready_ids", [])),
            "game_over": False,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        view = BombBustersGame.get_public_view(state, bot_id)
        legal = view.get("legal_actions", [])
        if not legal:
            return None
        if "place_initial_info" in legal:
            candidates = view.get("initial_info_candidate_wire_ids", [])
            if candidates:
                return {"type": "place_initial_info", "wire_id": candidates[len(candidates) // 2], "delay_ms": 350}
            return None
        if "resolve_detector_choice" in legal:
            choices = view.get("pending_choice_wire_ids", [])
            if choices:
                return {"type": "resolve_detector_choice", "wire_id": choices[0], "delay_ms": 350}
            return None
        if "reveal_red_wires" in legal:
            return {"type": "reveal_red_wires", "delay_ms": 350}
        solo_sets = view.get("legal_solo_sets", [])
        if "solo_cut" in legal and solo_sets:
            return {"type": "solo_cut", "wire_ids": list(solo_sets[0]), "delay_ms": 400}

        own_wires: List[Dict] = []
        target_racks: List[Dict] = []
        for rack in view.get("racks", []):
            available = [wire for wire in rack.get("slots", []) if wire.get("status") == "uncut"]
            if rack.get("owner_id") == bot_id:
                own_wires.extend(
                    wire for wire in available if not wire.get("hidden") and wire.get("kind") in ("blue", "yellow")
                )
            elif available:
                target_racks.append({"rack": rack, "wires": available})
        own_wires.sort(key=lambda wire: (wire.get("sort_tick", 0), wire["wire_id"]))
        target_racks.sort(key=lambda item: (item["rack"].get("owner_id", ""), item["rack"].get("rack_index", 0)))

        for own_wire in own_wires:
            desired = str(own_wire.get("blue_value")) if own_wire.get("kind") == "blue" else "yellow"
            for item in target_racks:
                for target in item["wires"]:
                    if target.get("public_info") == desired and "dual_cut" in legal:
                        return {
                            "type": "dual_cut",
                            "own_wire_id": own_wire["wire_id"],
                            "target_wire_id": target["wire_id"],
                            "delay_ms": 450,
                        }

        blue_wires = [wire for wire in own_wires if wire.get("kind") == "blue"]
        if "double_detector_cut" in legal and blue_wires:
            rack_with_pair = next((item for item in target_racks if len(item["wires"]) >= 2), None)
            if rack_with_pair:
                return {
                    "type": "double_detector_cut",
                    "own_wire_id": blue_wires[0]["wire_id"],
                    "target_wire_ids": [wire["wire_id"] for wire in rack_with_pair["wires"][:2]],
                    "delay_ms": 500,
                }

        if "dual_cut" in legal and own_wires and target_racks:
            return {
                "type": "dual_cut",
                "own_wire_id": own_wires[0]["wire_id"],
                "target_wire_id": target_racks[0]["wires"][0]["wire_id"],
                "delay_ms": 450,
            }
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("game_id") != BombBustersGame.game_id:
            raise ValueError("invalid Bomb Busters save payload")
        state = copy.deepcopy(payload)
        _assert_state_invariants(state)
        return state

