import copy
import random
import time
from typing import Dict, List, Optional, Tuple

from game.bomb_busters_missions import (
    AUDIO_MISSIONS, CONSTRAINTS, EQUIPMENT, EQUIPMENT_BANS, MISSION_COUNT, get_mission,
)


CHALLENGES = {
    1: "Identify one teammate's red wire instead of a normal cut. A wrong guess explodes.",
    2: "Four consecutive turns successfully cut even blue values.",
    3: "A rack's remaining wires form adjacent pairs separated by cut wires.",
    4: "The first three validated numbers sum to 18.",
    5: "Two consecutive turns perform a successful Solo Cut.",
    6: "One rack has at least five isolated uncut wires, each next to cut wires.",
    7: "Three consecutive turns successfully cut consecutive ascending or descending values.",
    8: "The first two validated numbers match the displayed challenge numbers.",
    9: "One rack has at least six uncut blue wires and all its uncut blues are odd.",
    10: "One rack has at least seven cut wires while its first and last two wires remain uncut.",
}

ANYTIME_EQUIPMENT = {"not_equal", "walkie_talkies", "post_it", "rewinder", "batteries",
                     "radar", "equal", "single_label", "grappling_hook"}


def _core():
    from game import bomb_busters
    return bomb_busters


def _rng(state: Dict) -> random.Random:
    counter = int(state.get("rng_counter", 0))
    state["rng_counter"] = counter + 1
    return random.Random(f"{state['rng_seed']}:{counter}:campaign")


def _data(state: Dict) -> Dict:
    return state["campaign"]


def _number(state: Dict) -> int:
    return int(state["mission_id"])


def _order(state: Dict) -> List[str]:
    return _core()._rotated_order(state["turn_order"], state["captain_id"])


def _uncut(state: Dict, player_id: Optional[str] = None) -> List[Dict]:
    return [wire for wire in state["wires"].values()
            if wire["status"] == "uncut" and (player_id is None or wire["owner_id"] == player_id)]


def _all_remaining(state: Dict) -> List[Dict]:
    data = _data(state)
    reserve = data.get("reserve", []) if _number(state) == 43 else []
    incoming = [data["incoming_wire"]] if data.get("incoming_wire") else []
    return _uncut(state) + reserve + incoming


def _label(wire: Dict) -> str:
    return str(wire["blue_value"]) if wire["kind"] == "blue" else wire["kind"]


def _danger(wire: Dict) -> bool:
    return wire["kind"] == "red" or bool(wire.get("danger"))


def _value(state: Dict, wire: Dict) -> Optional[int]:
    if wire["kind"] == "blue":
        return int(wire["blue_value"])
    return None


def _key(state: Dict, wire: Dict) -> str:
    value = _value(state, wire)
    return str(value) if value is not None else wire["kind"]


def prepare_setup(state: Dict, rng: random.Random) -> Dict:
    mission = get_mission(state["mission_id"], len(state["turn_order"]))
    markers = {}
    for color, suffix in (("yellow", 1), ("red", 5)):
        candidates = rng.sample(range(1, mission["color_max"] + 1), mission[f"{color}_pool"])
        mission[f"{color}_ticks"] = [value * 10 + suffix for value in rng.sample(candidates, mission[f"{color}_count"])]
        markers[color] = [
            {"sort_tick": value * 10 + suffix, "sort_label": f"{value}.{suffix}",
             "certainty": "certain" if mission[f"{color}_count"] == len(candidates) else "candidate"}
            for value in sorted(candidates)
        ]
    if mission["id"] == 46:
        mission["yellow_ticks"] = [51, 61, 71, 81]
        markers["yellow"] = [{"sort_tick": tick, "sort_label": f"{tick // 10}.1", "certainty": "certain"}
                             for tick in mission["yellow_ticks"]]
    state["campaign"] = {
        "mission": mission, "markers": markers, "equipment": [], "equipment_deck": [],
        "reserve": [], "clue_notes": [], "radar": [], "sequence": [], "sequence_side": "left",
        "constraints": {}, "constraint_deck": [], "shared_constraint": None,
        "constraints_discarded": [], "choices": [], "decision": None, "history": [],
        "validations": [], "skipped": [], "stabilized": None, "number_deck": [],
        "number_cards": [], "number_hands": {}, "director": None, "forced_value": None,
        "prediction": None, "special_complete": False, "round": 1,
        "oxygen": {}, "oxygen_reserve": 0, "oxygen_total": 0,
        "nano": None, "challenges": [], "challenge_numbers": [], "links": [],
        "clock": None, "audio_started_at": None, "audio_events": [],
        "setup_queue": [], "setup_cursor": 0, "initial_remaining": {},
    }
    return mission


def _reindex(state: Dict) -> None:
    for rack in state["racks"].values():
        for index, wire_id in enumerate(rack["slots"]):
            wire = state["wires"][wire_id]
            wire.update(rack_id=rack["rack_id"], owner_id=rack["owner_id"], slot_index=index)
    state["in_play_wire_ids"] = list(state["wires"])


def _sort_rack(state: Dict, rack_id: str) -> None:
    rack = state["racks"][rack_id]
    rack["slots"].sort(key=lambda wire_id: (state["wires"][wire_id]["sort_tick"], wire_id))
    _reindex(state)


def _move_wire(state: Dict, wire: Dict, rack_id: str) -> None:
    _core()._return_info_token(state, wire)
    wire.pop("clue", None)
    old_rack = state["racks"].get(wire.get("rack_id"))
    if old_rack and wire["wire_id"] in old_rack["slots"]:
        old_rack["slots"].remove(wire["wire_id"])
    state["wires"][wire["wire_id"]] = wire
    state["racks"][rack_id]["slots"].append(wire["wire_id"])
    _sort_rack(state, rack_id)


def _forced_distribution(state: Dict, kind: str, rng: random.Random) -> None:
    special = [wire for wire in state["wires"].values() if wire["kind"] == kind]
    normal = [wire for wire in state["wires"].values() if wire["kind"] != kind]
    racks = state["rack_order"]
    for rack in state["racks"].values():
        rack["slots"] = []
    destinations = list(racks)
    if _number(state) in (13, 48) and len(state["turn_order"]) == 3:
        destinations = [state["players"][player_id]["rack_ids"][0] for player_id in _order(state)]
    if _number(state) == 41:
        owners = _order(state)[1:] if len(state["turn_order"]) == 5 else _order(state)
        destinations = [state["players"][owner]["rack_ids"][0] for owner in owners]
    rng.shuffle(special)
    for index, wire in enumerate(special):
        state["racks"][destinations[index % len(destinations)]]["slots"].append(wire["wire_id"])
    for wire in normal:
        rack_id = min(racks, key=lambda candidate: (len(state["racks"][candidate]["slots"]), racks.index(candidate)))
        state["racks"][rack_id]["slots"].append(wire["wire_id"])
    for rack_id in racks:
        _sort_rack(state, rack_id)


def _equipment_card(equipment_id: str, index: int) -> Dict:
    value, name, description = EQUIPMENT[equipment_id]
    return {"id": f"equipment-{index}", "kind": equipment_id, "value": value, "name": name,
            "description": description, "used": False, "unlocked": False, "hidden": False}


def _queue_setup(state: Dict, player_id: str, kind: str, choices: List) -> None:
    _data(state)["setup_queue"].append({"player_id": player_id, "kind": kind, "choices": choices})


def setup(state: Dict, rng: random.Random) -> None:
    data = _data(state)
    number = _number(state)
    order = _order(state)
    count = len(order)
    state["public_color_markers"] = copy.deepcopy(data["markers"])
    if number in (13, 48):
        _forced_distribution(state, "red" if number == 13 else "yellow", rng)
    if number == 41:
        _forced_distribution(state, "yellow", rng)
    if number == 11:
        data["danger_number"] = rng.randint(1, 12)
        for wire in state["wires"].values():
            if wire["blue_value"] == data["danger_number"]:
                wire["danger"] = True
    if number in (14, 17, 28):
        data["special_player"] = rng.choice(order) if number != 28 else state["captain_id"]
    if number in (20, 35):
        for rack in state["racks"].values():
            candidates = [wire_id for wire_id in rack["slots"] if number == 20 or state["wires"][wire_id]["kind"] == "blue"]
            wire_id = rng.choice(candidates)
            state["wires"][wire_id]["unsorted"] = True
            rack["slots"].remove(wire_id)
            rack["slots"].append(wire_id)
    if number in (38, 56, 64):
        owners = [state["captain_id"]] if number == 38 else order
        for owner in owners:
            owned = _uncut(state, owner)
            selected = sorted(rng.sample(owned, 2 if number == 64 else 1), key=lambda wire: wire["sort_tick"])
            for index, wire in enumerate(selected):
                wire["reversed"] = True
                source = state["racks"][wire["rack_id"]]["slots"]
                source.remove(wire["wire_id"])
                rack_id = state["players"][owner]["rack_ids"][0 if index == 0 else -1]
                destination = state["racks"][rack_id]["slots"]
                destination.insert(0, wire["wire_id"]) if number == 64 and index == 0 else destination.append(wire["wire_id"])
    _reindex(state)
    if number == 43:
        reserve_count = {2: 5, 3: 4, 4: 4, 5: 3}[count]
        for wire in rng.sample(list(state["wires"].values()), reserve_count):
            state["racks"][wire["rack_id"]]["slots"].remove(wire["wire_id"])
            data["reserve"].append(state["wires"].pop(wire["wire_id"]))
        _reindex(state)
        data["nano"] = {"position": 1, "direction": 1}
    if number == 53:
        data["nano"] = {"position": 0, "direction": 1}
        state["detonator"]["disabled"] = True
    if number == 59:
        line = rng.sample(list(range(1, 13)), 12)
        position = line.index(7)
        data["nano"] = {"position": position, "direction": 1 if position < 6 else -1, "line": line}
    if number in (9, 16, 36):
        data["sequence"] = rng.sample(list(range(1, 13)), 5 if number == 36 else 3)
        data["sequence_threshold"] = 4 if number == 16 else 2
        if number == 36:
            _queue_setup(state, state["captain_id"], "sequence_side", ["left", "right"])
    if number in (23, 39, 46):
        data["special_number"] = 7 if number == 46 else rng.randint(1, 12)
        data["special_countdown"] = 7 if number == 23 else 8
        if number == 39:
            data["reward_deck"] = rng.sample([value for value in range(1, 13) if value != data["special_number"]], 8)
    if number in (15, 18, 30, 45, 51):
        data["number_deck"] = rng.sample(list(range(1, 13)), 12)
        if number == 15:
            data["forced_value"] = data["number_deck"].pop()
    if number in (26, 47):
        data["number_cards"] = list(range(1, 13))
    if number in (29, 65):
        deck = rng.sample(list(range(1, 13)), 12)
        data["number_hands"] = {player_id: [] for player_id in order}
        if number == 29:
            for player_id in order:
                data["number_hands"][player_id] = [deck.pop(), deck.pop()]
            data["number_hands"][order[-1]].append(deck.pop())
            data["number_deck"] = deck
        else:
            for index, value in enumerate(deck):
                data["number_hands"][order[index % count]].append(value)
    if number in (31, 34, 61):
        constraints = rng.sample(list("ABCDE"), 5)
        if number == 31:
            data["available_constraints"] = list("ABCDE")
            for player_id in order:
                _queue_setup(state, player_id, "constraint", list("ABCDE"))
        else:
            data["constraints"] = dict(zip(order, constraints))
            if number == 34:
                data["weakest_link"] = rng.choice(order)
                data["roles_revealed"] = False
            else:
                data["constraint_ring"] = constraints[:max(4, count)]
                data["constraint_seats"] = ([order[0], None, order[1], None] if count == 2
                                            else [order[0], None, *order[1:]] if count == 3 else order)
                for player_id in order:
                    data["constraint_ring"][data["constraint_seats"].index(player_id)] = data["constraints"][player_id]
                unused = [constraint for constraint in constraints if constraint not in data["constraints"].values()]
                for index, seat in enumerate(data["constraint_seats"]):
                    if seat is None:
                        data["constraint_ring"][index] = unused.pop(0)
    if number in (32, 37, 57):
        deck = rng.sample(list(CONSTRAINTS), len(CONSTRAINTS))
        if number == 57:
            data["constraint_map"] = dict(zip((str(value) for value in range(1, 13)), deck))
        else:
            data["shared_constraint"] = deck.pop()
            data["constraint_deck"] = deck
    if number == 44:
        data["oxygen_total"] = data["oxygen_reserve"] = count * 2
    if number in (49, 54, 63):
        start = ({2: 7, 3: 6, 4: 5, 5: 4}[count] if number == 49
                 else {2: 9, 3: 6, 4: 3, 5: 2}[count] if number == 54
                 else {2: 14, 3: 18, 4: 24, 5: 30}[count])
        data["oxygen"] = {player_id: start if number != 63 or player_id == state["captain_id"] else 0 for player_id in order}
        data["oxygen_total"] = 32 if number == 54 else start * count if number == 49 else start
        data["oxygen_reserve"] = data["oxygen_total"] - sum(data["oxygen"].values())
    if number == 54:
        extra = {"blue_min": 1, "blue_max": 1, "copies_per_blue": 0,
                 "yellow_count": 0, "red_count": 11}
        data["reserve"] = _core()._build_wire_pool(extra, rng)
    if number in (55, 60):
        data["challenges"] = rng.sample(list(CHALLENGES), count)
        if 8 in data["challenges"]:
            data["challenge_numbers"] = rng.sample(list(range(1, 13)), 2)
    if number == 62:
        data["reward_numbers"] = rng.sample(list(range(1, 13)), count)
    if number in (41, 55, 60, 62):
        state["detonator"].update(mistakes_used=count - 1, remaining=1)
    if number == 51:
        state["detonator"].update(mistake_limit=count + 1, remaining=count + 1)
    if number == 66:
        constraints = rng.sample(list("ABCDE"), 5)
        data["bunker"] = {"floor": 0, "position": [0, 0], "directions": dict(zip(("north", "east", "south", "west"), constraints)),
                          "action_constraint": constraints[-1], "keys": 0, "actions": 0}
    available = [equipment_id for equipment_id, values in EQUIPMENT.items()
                 if values[0] <= data["mission"]["blue_max"]
                 and number not in EQUIPMENT_BANS.get(equipment_id, set())
                 and (equipment_id != "false_bottom" or number >= 9 and data["mission"]["yellow_count"])
                 and (equipment_id not in ("single_label", "emergency_drop", "fast_pass", "disintegrator", "grappling_hook") or number >= 55)]
    rng.shuffle(available)
    cards = [_equipment_card(equipment_id, index) for index, equipment_id in enumerate(available)]
    selected_count = 0 if number in (1, 2, 18, 39) else 7 if number == 23 else count
    data["equipment"], data["equipment_deck"] = cards[:selected_count], cards[selected_count:]
    if number in (15, 23):
        for card in data["equipment"]:
            card["hidden"] = True
    if number == 12:
        for card, extra_value in zip(data["equipment"], rng.sample(list(range(1, 13)), len(data["equipment"]))):
            card["extra_value"] = extra_value
    if number == 18:
        data["equipment"] = [_equipment_card("radar", 0)]
        data["equipment"][0]["unlocked"] = True
        data["equipment"][0]["permanent"] = True
    for player_id in order:
        disabled = number in (27, 34) or number == 28 and player_id == data.get("special_player")
        state["players"][player_id]["personal_detector_used"] = disabled
        state["players"][player_id]["personal_detector_disabled"] = disabled
        amount = 2 if number in (22, 52) or number == 17 and player_id == data.get("special_player") else 1
        if number in (18, 58) or count == 2 and player_id == state["captain_id"] and number in (11, 13, 27, 29, 40, 46, 51):
            amount = 0
        data["initial_remaining"][player_id] = amount
        if number in (13, 39, 41) or number == 43 and count == 2 and player_id == state["captain_id"]:
            available = [value for value in range(1, 13) for _ in range(2)
                         if list(data.get("random_initial", {}).values()).count(value) < 2]
            data.setdefault("random_initial", {})[player_id] = rng.choice(available)
    state["initial_info_order"] = [player_id for player_id in order if data["initial_remaining"][player_id]]
    if data["setup_queue"] or number in AUDIO_MISSIONS:
        if number in AUDIO_MISSIONS:
            _queue_setup(state, state["captain_id"], "audio_ready", ["ready"])
        state["phase"] = "mission_setup"
    else:
        _advance_initial(state)


def public_info(wire: Dict) -> Optional[str]:
    clue = wire.get("clue")
    if not clue:
        return None
    prefix = "≠ " if clue.get("negative") else ""
    return prefix + str(clue["label"])


def _constraint(state: Dict, player_id: str) -> Optional[str]:
    data = _data(state)
    number = _number(state)
    if number == 34 and not data.get("roles_revealed"):
        return data["constraints"].get(player_id) if data.get("weakest_link") == player_id else None
    return data["constraints"].get(player_id) or data.get("shared_constraint")


def _constraint_value(constraint: Optional[str], value: Optional[int]) -> bool:
    if constraint and constraint in "ABCDEF":
        if value is None:
            return False
        return {"A": value % 2 == 0, "B": value % 2 == 1, "C": value <= 6,
                "D": value >= 7, "E": 4 <= value <= 9, "F": value < 4 or value > 9}[constraint]
    return True


def _clue(state: Dict, wire: Dict, declared: Optional[str] = None, chosen: Optional[str] = None) -> Optional[Dict]:
    data = _data(state)
    number = _number(state)
    if number == 58 or _constraint(state, wire["owner_id"]) == "H":
        return None
    negative = number == 52 or number == 17 and wire["owner_id"] == data.get("special_player")
    label = chosen if chosen is not None else declared if negative else _label(wire)
    if label is None or label == "red":
        return None
    if negative and label == _label(wire):
        raise ValueError("negative clues must name a different value")
    if number in (21, 33) and wire["kind"] == "blue":
        label = "even" if wire["blue_value"] % 2 == 0 else "odd"
    if number in (24, 40):
        count = sum(_key(state, state["wires"][wire_id]) == _key(state, wire)
                    for wire_id in state["racks"][wire["rack_id"]]["slots"])
        if not 1 <= count <= 3:
            return None
        label = f"×{count}"
    clue = {"label": str(label), "negative": negative, "mode": "token"}
    if number == 50:
        return {**clue, "mode": "spoken"}
    if str(label) in _core().INFO_LABELS:
        previous = wire.get("info_token_id")
        if previous and state["info_tokens"][previous]["label"] == str(label) and wire.get("clue") == clue:
            return {**clue, "mode": "existing"}
        available = next((token for token in state["info_tokens"].values()
                          if token["label"] == str(label) and token["attached_wire_id"] is None
                          and not token.get("reserved_for")), None)
        if available is None:
            return {**clue, "mode": "spoken"}
        _core()._return_info_token(state, wire)
        available["attached_wire_id"] = wire["wire_id"]
        wire["info_token_id"] = available["token_id"]
    if wire["status"] == "uncut" or number in (24, 40):
        wire["clue"] = clue
    else:
        return None
    return clue


def _clue_events(wire: Dict, clue: Optional[Dict], actor_id: Optional[str] = None) -> List[Dict]:
    if not clue or clue.get("mode") == "existing":
        return []
    return [_event("spoken_info" if clue.get("mode") == "spoken" else "info_placed",
                   player_id=actor_id or wire["owner_id"], target_wire_id=wire["wire_id"],
                   label=("≠ " if clue["negative"] else "") + clue["label"])]


def _note(state: Dict, player_id: str, label: str, absent: bool = False) -> None:
    token = next((token for token in state["info_tokens"].values()
                  if token["label"] == label and token["attached_wire_id"] is None
                  and not token.get("reserved_for")), None)
    if token:
        token["reserved_for"] = player_id
        _data(state)["clue_notes"].append({"player_id": player_id, "label": label,
                                        "absent": absent, "token_id": token["token_id"]})


def _activity(state: Dict, actor: Optional[str], message: str) -> None:
    _core()._record_activity(state, "campaign", actor, message)


def _radar(state: Dict, value: int) -> None:
    data = _data(state)
    data["radar"] = [{"rack_id": rack["rack_id"], "has_value": any(
        state["wires"][wire_id]["status"] == "uncut" and state["wires"][wire_id]["blue_value"] == value
        and not state["wires"][wire_id].get("unsorted") for wire_id in rack["slots"])}
        for rack in state["racks"].values()]
    data["radar_value"] = value


def _draw_number(state: Dict) -> Optional[int]:
    data = _data(state)
    remaining = [value for value in range(1, 13) if not state["validation_complete"].get(str(value))]
    data["number_deck"] = [value for value in data["number_deck"] if value in remaining]
    if not data["number_deck"]:
        data["number_deck"] = _rng(state).sample(remaining, len(remaining))
    return data["number_deck"].pop() if data["number_deck"] else None


def _begin_play(state: Dict) -> None:
    state["phase"] = "playing"
    state["current_turn"] = state["captain_id"]
    if _number(state) == 10 and not _data(state)["clock"]:
        duration = 720 if len(state["turn_order"]) == 2 else 900
        _data(state)["clock"] = {"duration": duration, "deadline": time.time() + duration}
    _prepare_turn(state)


def _decision(state: Dict, player_id: str, kind: str, choices: List, **extra) -> None:
    state["phase"] = "mission_decision"
    _data(state)["decision"] = {"player_id": player_id, "kind": kind, "choices": choices, **extra}


def _prepare_turn(state: Dict) -> None:
    if state["phase"] != "playing":
        return
    data = _data(state)
    number = _number(state)
    actor = state["current_turn"]
    if actor is None:
        return
    data["stabilized"] = None
    if number == 58:
        state["players"][actor]["personal_detector_used"] = False
    if number == 26 and not data["number_cards"]:
        data["number_cards"] = [value for value in range(1, 13) if not state["validation_complete"].get(str(value))]
    if number == 47 and len(data["number_cards"]) < 2:
        data["number_cards"] = list(range(1, 13))
    if number == 31:
        constraint = _constraint(state, actor)
        if constraint and not any(_constraint_value(constraint, _value(state, wire)) for wire in _uncut(state, actor) if not _danger(wire)):
            data["constraints"].pop(actor, None)
    if actor == state["captain_id"]:
        if number == 44:
            data["oxygen_reserve"] = data["oxygen_total"]
        if number == 63:
            data["oxygen"][actor] += data["oxygen_reserve"]
            data["oxygen_reserve"] = 0
    if number == 45 and not data.get("nominee"):
        data["director"] = state["captain_id"]
        data["forced_value"] = _draw_number(state)
        _decision(state, state["captain_id"], "volunteer", [player_id for player_id in _order(state) if _uncut(state, player_id)])
    if number in (18, 51) and not data.get("nominee") and not _only_danger(state, actor):
        data["director"] = actor
        data["forced_value"] = _draw_number(state)
        if number == 18 and data["forced_value"] is not None:
            _radar(state, data["forced_value"])
        _decision(state, actor, "nominate", [player_id for player_id in _order(state) if _uncut(state, player_id)])
    if number == 29 and len([value for value in range(1, 13) if not state["validation_complete"].get(str(value))]) > 1:
        order = state["turn_order"]
        position = order.index(actor)
        for offset in range(1, len(order) + 1):
            predictor = order[(position - offset) % len(order)]
            cards = [value for value in data["number_hands"].get(predictor, []) if not state["validation_complete"].get(str(value))]
            if cards:
                _decision(state, predictor, "predict", cards, actor_id=actor)
                break


def _only_danger(state: Dict, player_id: str) -> bool:
    wires = _uncut(state, player_id)
    return bool(wires) and all(_danger(wire) for wire in wires)


def _allowed_values(state: Dict, player_id: str) -> List[int]:
    data = _data(state)
    number = _number(state)
    values = list(range(1, 13))
    if number in (9, 16):
        sequence = data["sequence"]
        threshold = data["sequence_threshold"]
        blocked = [value for index, value in enumerate(sequence)
                   if any(state["cut_blue_counts"].get(str(earlier), 0) < threshold for earlier in sequence[:index])]
        values = [value for value in values if value not in blocked]
    if number == 36 and data["sequence"]:
        current = data["sequence"][0 if data["sequence_side"] == "left" else -1]
        values = [value for value in values if value not in data["sequence"] or value == current]
    if number in (23, 39, 46) and not data["special_complete"]:
        values = [value for value in values if value != data["special_number"]]
    if number == 26:
        values = [value for value in values if value in data["number_cards"]]
    if number in (18, 45, 51) and data.get("nominee"):
        values = [data["forced_value"]]
    if number == 47:
        cards = data["number_cards"]
        values = sorted({value for first_index, first in enumerate(cards) for second in cards[first_index + 1:]
                         for value in (first + second, abs(first - second)) if 1 <= value <= 12})
    if number == 59:
        nano = data["nano"]
        values = [value for index, value in enumerate(nano["line"])
                  if (index - nano["position"]) * nano["direction"] >= 0 and not state["validation_complete"].get(str(value))]
    if number == 65:
        values = [value for value in data["number_hands"].get(player_id, []) if not state["validation_complete"].get(str(value))]
    return [value for value in values if _constraint_value(_constraint(state, player_id), value)]


def _wire_allowed(state: Dict, player_id: str, wire: Dict) -> bool:
    if _danger(wire):
        return False
    number = _number(state)
    if wire.get("unsorted") and number == 35 and any(other["kind"] == "yellow" for other in _all_remaining(state)):
        return False
    if wire["kind"] == "yellow" and number in (41, 48):
        return False
    value = _value(state, wire)
    return value in _allowed_values(state, player_id) if value is not None else _constraint_value(_constraint(state, player_id), None)


def legal_solo_sets(state: Dict, player_id: str) -> List[List[str]]:
    if _constraint(state, player_id) == "K":
        return []
    grouped = {}
    for wire in _all_remaining(state):
        grouped.setdefault(_key(state, wire), []).append(wire)
    result = []
    for wires in grouped.values():
        if len(wires) in (2, 4) and all(wire.get("owner_id") == player_id and not wire.get("reversed")
                                      and _wire_allowed(state, player_id, wire) for wire in wires):
            result.append([wire["wire_id"] for wire in wires])
    return result


def _can_cut(state: Dict, player_id: str) -> bool:
    if _only_danger(state, player_id):
        return True
    known = [wire for wire in _uncut(state, player_id) if not wire.get("reversed") and _wire_allowed(state, player_id, wire)]
    return bool(known or any(wire.get("reversed") for wire in _uncut(state, player_id)))


def _special_action(state: Dict, player_id: str) -> Optional[Dict]:
    data = _data(state)
    number = _number(state)
    if number == 13 and not data["special_complete"]:
        return {"kind": "red", "count": 3, "label": "Identify three red wires"}
    if number in (23, 39) and not data["special_complete"]:
        return {"kind": str(data["special_number"]), "count": 4, "label": f"Identify all four {data['special_number']} wires"}
    if number == 46 and not data["special_complete"]:
        own = _uncut(state, player_id)
        if own and all(_value(state, wire) == 7 for wire in own):
            return {"kind": "blue7", "count": 4, "label": "Identify all four blue 7 wires"}
    if number == 41:
        return {"kind": "yellow", "count": 1, "label": "Identify one teammate tripwire"}
    if number == 48 and any(wire["kind"] == "yellow" for wire in _all_remaining(state)):
        return {"kind": "yellow", "count": 3, "label": "Identify three yellow wires"}
    if 1 in data["challenges"]:
        return {"kind": "red_challenge", "count": 1, "label": "Challenge: identify one teammate red wire"}
    return None


def _equipment_usable(state: Dict, player_id: str, card: Dict) -> bool:
    if card["used"] or not card["unlocked"] or card["hidden"]:
        return False
    if player_id not in state["players"] or state["phase"] != "playing":
        return False
    if state["current_turn"] != player_id and card["kind"] not in ANYTIME_EQUIPMENT:
        return False
    number = _number(state)
    if _constraint(state, player_id) == "G" or number in (17, 28) and player_id == _data(state).get("special_player"):
        return False
    if card["kind"] == "stabilizer" and number == 14 and player_id == _data(state).get("special_player"):
        return False
    return True


def get_legal_actions(state: Dict, player_id: str) -> List[str]:
    if player_id not in state.get("players", {}):
        return []
    data = _data(state)
    phase = state["phase"]
    if phase == "mission_setup":
        step = data["setup_queue"][data["setup_cursor"]]
        return ["mission_choice"] if step["player_id"] == player_id else []
    if phase == "mission_decision":
        if data["decision"]["kind"] == "volunteer" and _uncut(state, player_id):
            return ["mission_choice"]
        return ["mission_choice"] if data["decision"]["player_id"] == player_id else []
    if phase == "initial_info":
        order = state["initial_info_order"]
        return ["place_initial_info"] if order[state["initial_info_cursor"]] == player_id else []
    if phase == "awaiting_detector_choice":
        return ["resolve_detector_choice"] if state["current_responder_id"] == player_id else []
    if phase == "mission_result":
        return ["continue_mission"] if player_id not in state["result_ready_ids"] and not state.get("campaign_complete") else []
    if phase != "playing":
        return []
    if state["current_turn"] != player_id:
        actions = ["use_equipment"] if any(_equipment_usable(state, player_id, card) for card in data["equipment"]) else []
        if (_number(state) == 10 and _uncut(state, player_id)
                or _number(state) == 32 and player_id == state["captain_id"]
                or _number(state) == 61 or _number(state) in AUDIO_MISSIONS and player_id == state["captain_id"]):
            actions.append("mission_choice")
        return actions
    actions = []
    if any(not wire.get("reversed") and _wire_allowed(state, player_id, wire) for wire in _uncut(state, player_id)) or any(wire.get("reversed") for wire in _uncut(state, player_id)):
        if any(wire["owner_id"] != player_id for wire in _uncut(state)):
            actions.append("dual_cut")
    if legal_solo_sets(state, player_id):
        actions.append("solo_cut")
    if _only_danger(state, player_id) and _number(state) != 13:
        actions.append("reveal_red_wires")
    personal = state["players"][player_id]
    if not personal.get("personal_detector_used") and not personal.get("personal_detector_disabled") and _constraint(state, player_id) != "G":
        if any(wire["kind"] == "blue" and not wire.get("reversed") and _wire_allowed(state, player_id, wire) for wire in _uncut(state, player_id)):
            if any(sum(state["wires"][wire_id]["status"] == "uncut" and not state["wires"][wire_id].get("unsorted") and not state["wires"][wire_id].get("reversed") for wire_id in rack["slots"]) >= 2
                   for rack in state["racks"].values() if rack["owner_id"] != player_id):
                actions.append("double_detector_cut")
    if any(_equipment_usable(state, player_id, card) for card in data["equipment"]):
        actions.append("use_equipment")
    if _special_action(state, player_id):
        actions.append("special_cut")
    if _number(state) in (10, 19, 25, 30, 32, 34, 37, 41, 42, 44, 45, 47, 49, 51, 54, 57, 59, 61, 63, 65, 66) or not _can_cut(state, player_id):
        actions.append("mission_choice")
    return actions


def _skip(state: Dict, actor_id: str, events: List[Dict]) -> None:
    data = _data(state)
    number = _number(state)
    can_cut = _can_cut(state, actor_id)
    if number == 26 and can_cut:
        raise ValueError("you must attempt an available number in your hand")
    if number in (31, 32, 37, 57, 61) and can_cut:
        raise ValueError("you have a value allowed by your constraint")
    if number in (54, 63):
        oxygen = data["oxygen"].get(actor_id, 0)
        costs = [((_value(state, wire) - 1) // 4 + 1 if number == 54 else _value(state, wire))
                 for wire in _uncut(state, actor_id) if _value(state, wire) is not None and not _danger(wire)]
        if costs and min(costs) <= oxygen:
            raise ValueError("you have enough oxygen and must attempt a cut")
    if number == 34 and not data.get("roles_revealed") and actor_id == data["weakest_link"]:
        if can_cut:
            raise ValueError("you can obey your constraint")
        _adjust_detonator(state, 2, events)
        _reveal_roles(state)
    elif number in (32, 37, 57, 61):
        data["skipped"].append(actor_id)
        active = {owner for owner in state["turn_order"] if _uncut(state, owner)}
        if set(data["skipped"]) >= active:
            data["skipped"] = []
            if number in (57, 61):
                _finish(state, "constraint_deadlock", events)
            elif number == 37:
                _adjust_detonator(state, 1, events)
                data["shared_constraint"] = data["constraint_deck"].pop() if data["constraint_deck"] else None
    elif number not in (26, 41):
        _adjust_detonator(state, 1, events)
    if number == 59:
        data["nano"]["direction"] *= -1
    if number == 63:
        recipient = _next_actor(state, actor_id)
        if recipient and recipient != actor_id:
            data["oxygen"][recipient] += data["oxygen"][actor_id]
            data["oxygen"][actor_id] = 0
    if state["phase"] != "mission_result":
        if number == 65:
            cards = [card for card in data["number_hands"][actor_id] if not state["validation_complete"].get(str(card))]
            choices = [f"{card}:{owner}" for card in cards for owner in _order(state) if owner != actor_id and _uncut(state, owner)]
            if choices:
                _decision(state, actor_id, "give_number", choices, resume_turn=actor_id)
                return
        _advance(state, actor_id, events)


def _reveal_roles(state: Dict) -> None:
    data = _data(state)
    data["roles_revealed"] = True
    data["constraints"] = {}
    for personal in state["players"].values():
        personal["personal_detector_disabled"] = False
        personal["personal_detector_used"] = False


def _mission_control(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    number = _number(state)
    choice = action.get("choice")
    if choice == "pass":
        _skip(state, actor_id, events)
    elif choice == "claim_turn" and number == 10:
        if not _uncut(state, actor_id):
            raise ValueError("you have no remaining wires")
        if actor_id == data.get("last_actor") and len(state["turn_order"]) > 2 and len({wire["owner_id"] for wire in _uncut(state)}) > 1:
            raise ValueError("you cannot take consecutive turns")
        state["current_turn"] = actor_id
    elif choice == "change_constraint" and number == 32 and actor_id == state["captain_id"]:
        data["shared_constraint"] = data["constraint_deck"].pop() if data["constraint_deck"] else None
    elif choice == "replace_constraint" and number == 61:
        data["constraints"][actor_id] = _rng(state).choice(list("FGHIJKL"))
        ring_index = data["constraint_seats"].index(actor_id)
        data["constraint_ring"][ring_index] = data["constraints"][actor_id]
        _adjust_detonator(state, 1, events)
    elif choice == "guess_link" and number == 34 and not data.get("roles_revealed"):
        if actor_id == data["weakest_link"]:
            raise ValueError("the weakest link cannot make this guess")
        if action.get("player_id") == data["weakest_link"] and action.get("constraint") == data["constraints"][data["weakest_link"]]:
            _reveal_roles(state)
        else:
            _adjust_detonator(state, 1, events)
    elif choice == "speech_mistake" and number in (25, 44, 49, 63):
        _adjust_detonator(state, 1, events)
    elif choice == "timer_expired" and number == 10:
        if data["clock"] and time.time() >= data["clock"]["deadline"]:
            _finish(state, "timer", events)
        else:
            raise ValueError("the mission timer has not expired")
    elif number in AUDIO_MISSIONS:
        _audio_control(state, actor_id, action, events)
    else:
        raise ValueError("that mission control is not available")


def _audio_control(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    if actor_id != state["captain_id"]:
        raise ValueError("only the Captain may apply recording instructions")
    choice = action.get("choice")
    if choice == "audio_detonator":
        amount = action.get("amount")
        if isinstance(amount, bool) or not isinstance(amount, int) or not -3 <= amount <= 3 or amount == 0:
            raise ValueError("choose a detonator change from -3 to 3, excluding zero")
        _adjust_detonator(state, amount, events)
    elif choice == "audio_number":
        value = _draw_number(state)
        data["audio_number"] = value
        events.append(_event("audio_number", value=value))
    elif choice == "audio_red" and _number(state) == 54:
        recipient = action.get("player_id")
        rack_id = action.get("rack_id")
        if recipient not in state["players"] or not data["reserve"]:
            raise ValueError("choose a player while red reserve wires remain")
        if rack_id not in state["players"][recipient]["rack_ids"]:
            raise ValueError("choose that player's rack")
        _move_wire(state, data["reserve"].pop(), rack_id)
    elif choice == "audio_oxygen" and _number(state) == 54:
        recipient = action.get("player_id")
        amount = action.get("amount")
        if recipient not in state["players"] or not isinstance(amount, int) or isinstance(amount, bool) or not -3 <= amount <= 3:
            raise ValueError("choose a player and oxygen change from -3 to 3")
        if amount > data["oxygen_reserve"] or data["oxygen"][recipient] + amount < 0:
            raise ValueError("oxygen is not available")
        data["oxygen"][recipient] += amount
        data["oxygen_reserve"] -= amount
    elif choice == "audio_constraint" and _number(state) in (42, 66):
        constraint = action.get("constraint")
        if constraint not in CONSTRAINTS and constraint != "none":
            raise ValueError("choose a constraint or none")
        data["shared_constraint"] = None if constraint == "none" else constraint
    elif choice == "audio_floor" and _number(state) == 66:
        bunker = data["bunker"]
        bunker["floor"] = 1 - bunker["floor"]
        bunker["position"] = [2, 2]
    elif choice == "audio_success":
        _finish(state, "audio_completed", events, success=True)
    elif choice == "audio_failure":
        _finish(state, "audio_failed", events)
    else:
        raise ValueError("that recording instruction is unavailable")
    data["audio_events"].append({"choice": choice, "elapsed": max(0, int(time.time() - (data["audio_started_at"] or time.time())))})
    data["audio_events"] = data["audio_events"][-12:]
    events.append(_event("audio_instruction", choice=choice))


def _continue_mission(state: Dict, actor_id: str, events: List[Dict]) -> None:
    if state.get("campaign_complete"):
        raise ValueError("the campaign is complete")
    ready = state["result_ready_ids"]
    if actor_id not in ready:
        ready.append(actor_id)
        state["players"][actor_id]["result_ready"] = True
    events.append(_event("result_ready", player_id=actor_id))
    if set(ready) < set(state["turn_order"]):
        return
    success = state["last_result"]["result"] == "success"
    if success and state["mission_id"] == MISSION_COUNT:
        state["campaign_complete"] = True
        state["game_over"] = True
        return
    state["captain_id"] = _core()._next_seat(state["turn_order"], state["captain_id"])
    if success:
        next_mission = state["mission_id"] + 1
        if len(state["turn_order"]) == 2 and next_mission in (34, 65):
            next_mission += 1
        state["mission_id"] = next_mission
        state["mission_number"] = next_mission
        state["attempt_number"] = 1
    else:
        state["attempt_number"] += 1
    _core()._start_mission(state)
    events.append(_event("new_mission", mission_number=state["mission_id"], attempt_number=state["attempt_number"], captain_id=state["captain_id"]))


def _apply_inplace(state: Dict, actor_id: str, action: Dict) -> List[Dict]:
    if actor_id not in state["players"]:
        raise ValueError("unknown player")
    if not isinstance(action, dict) or not isinstance(action.get("type"), str):
        raise ValueError("invalid action")
    events = []
    data = _data(state)
    number = _number(state)
    phase = state["phase"]
    kind = action["type"]
    if phase not in ("mission_result", "mission_setup") and data["clock"] and time.time() >= data["clock"]["deadline"]:
        _finish(state, "timer", events)
        return events
    if phase == "mission_setup":
        if kind != "mission_choice":
            raise ValueError("complete mission setup first")
        _handle_setup_choice(state, actor_id, action, events)
        return events
    if phase == "initial_info":
        if kind != "place_initial_info":
            raise ValueError("choose an initial clue first")
        _initial_clue(state, actor_id, action, events)
        return events
    if phase == "mission_decision":
        if kind != "mission_choice":
            raise ValueError("complete the mission choice first")
        _handle_decision(state, actor_id, action, events)
        return events
    if phase == "mission_result":
        if kind != "continue_mission":
            raise ValueError("review the mission result first")
        _continue_mission(state, actor_id, events)
        return events
    if phase == "awaiting_detector_choice":
        pending = state["pending_resolution"]
        if kind != "resolve_detector_choice" or actor_id != pending["responder_id"]:
            raise ValueError("waiting for the target owner's private detector choice")
        wire_id = action.get("wire_id")
        if wire_id not in pending["allowed_wire_ids"]:
            raise ValueError("wire is not an allowed detector choice")
        wire = state["wires"][wire_id]
        state["phase"] = "playing"
        state["current_responder_id"] = None
        state["pending_resolution"] = None
        if pending["kind"] == "campaign_cut":
            own = state["wires"][pending["own_wire_id"]]
            _cut(state, own)
            _cut(state, wire)
            events.append(_event("duo_cut", player_id=pending["actor_id"], cut_wire_ids=[own["wire_id"], wire_id]))
        else:
            events.extend(_clue_events(wire, _clue(state, wire, pending["declaration"]), pending["actor_id"]))
            events.append(_event("detector_choice", player_id=pending["actor_id"]))
        _end_turn(state, pending["actor_id"], events, pending.get("value"), pending["kind"] == "campaign_cut", pending.get("action_kind", "double_detector_cut"))
        return events
    if phase != "playing":
        raise ValueError("invalid game phase")
    out_of_turn = kind == "use_equipment" or kind == "mission_choice" and (
        number == 10 and action.get("choice") in ("claim_turn", "timer_expired")
        or number in AUDIO_MISSIONS and actor_id == state["captain_id"]
        or number == 32 and actor_id == state["captain_id"] and action.get("choice") == "change_constraint"
        or number == 61 and action.get("choice") == "replace_constraint")
    if actor_id != state["current_turn"] and not out_of_turn:
        raise ValueError("not your turn")
    if kind == "mission_choice":
        _mission_control(state, actor_id, action, events)
    elif kind == "use_equipment":
        _use_equipment(state, actor_id, action, events)
    elif kind == "special_cut":
        _special_cut(state, actor_id, action, events)
    elif kind in ("dual_cut", "double_detector_cut"):
        if kind not in get_legal_actions(state, actor_id):
            raise ValueError("that cut is not currently available")
        _cut_action(state, actor_id, action, events, 2 if kind == "double_detector_cut" else 0)
    elif kind == "solo_cut":
        ids = action.get("wire_ids")
        if not isinstance(ids, list) or not any(set(ids) == set(group) and len(ids) == len(group) for group in legal_solo_sets(state, actor_id)):
            raise ValueError("Solo Cut must contain all two or four remaining matching wires")
        wires = [state["wires"][wire_id] for wire_id in ids]
        value = _value(state, wires[0])
        _pay_cut(state, actor_id, value, action)
        for wire in wires:
            _cut(state, wire)
        state["action_number"] += 1
        events.append(_event("solo_cut", player_id=actor_id, cut_wire_ids=ids))
        _end_turn(state, actor_id, events, value, True, "solo_cut", ids)
    elif kind == "reveal_red_wires":
        if not _only_danger(state, actor_id) or number == 13:
            raise ValueError("you may reveal red only when all your remaining wires are dangerous")
        wires = _uncut(state, actor_id)
        for wire in wires:
            _cut(state, wire, secured=True)
        events.append(_event("red_secured", player_id=actor_id, secured_wire_ids=[wire["wire_id"] for wire in wires]))
        _end_turn(state, actor_id, events, None, True, "reveal_red_wires")
    else:
        raise ValueError("invalid action")
    return events


def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
    candidate = copy.deepcopy(state)
    try:
        events = _apply_inplace(candidate, player_id, action)
        _core()._assert_state_invariants(candidate)
    except (ValueError, TypeError, KeyError, IndexError) as error:
        return [], str(error) or "invalid mission action"
    state.clear()
    state.update(candidate)
    return events, None


def _event(event_type: str, **payload) -> Dict:
    return {"type": f"bomb_busters:{event_type}", "payload": payload}


def _finish(state: Dict, reason: str, events: List[Dict], success: bool = False) -> None:
    result = _core()._finish_mission(state, "success" if success else "failure", reason)
    events.append(_event("mission_result", **copy.deepcopy(result)))


def _adjust_detonator(state: Dict, amount: int, events: List[Dict]) -> None:
    data = _data(state)
    if _number(state) == 53:
        return
    if amount > 0 and data.get("stabilized") == state.get("current_turn"):
        return
    detonator = state["detonator"]
    detonator["mistakes_used"] = max(0, int(detonator["mistakes_used"]) + amount)
    detonator["remaining"] = max(0, detonator["mistake_limit"] - detonator["mistakes_used"])
    if detonator["remaining"] == 0 and state["phase"] != "mission_result":
        _finish(state, "detonator", events)


def _cut(state: Dict, wire: Dict, secured: bool = False) -> None:
    _core()._cut_wire(state, wire, "secured" if secured else "cut")
    wire.pop("clue", None)


def _unlock_equipment(state: Dict, events: List[Dict]) -> None:
    data = _data(state)
    number = _number(state)
    yellow_cut = sum(wire["kind"] == "yellow" and wire["status"] == "cut" for wire in state["wires"].values())
    changed = True
    while changed:
        changed = False
        for card in list(data["equipment"]):
            if card["unlocked"] or card["hidden"]:
                continue
            required = 4 if card["kind"] in ("single_label", "emergency_drop", "fast_pass", "disintegrator", "grappling_hook") else 2
            ready = yellow_cut >= 2 if card["kind"] == "false_bottom" else state["cut_blue_counts"].get(str(card["value"]), 0) >= required
            if card.get("extra_value"):
                ready = ready and state["cut_blue_counts"].get(str(card["extra_value"]), 0) >= 2
            if not ready:
                continue
            card["unlocked"] = True
            events.append(_event("equipment_unlocked", equipment_id=card["id"]))
            if card["kind"] == "false_bottom":
                card["used"] = True
                data["equipment"].extend(data["equipment_deck"][:2])
                del data["equipment_deck"][:2]
                changed = True
            elif card["kind"] == "emergency_drop":
                for used_card in data["equipment"]:
                    used_card["used"] = False
                card["used"] = True
                changed = True
            elif card["kind"] == "disintegrator":
                card["used"] = True
                candidates = [value for value in range(1, 13) if sum(wire.get("clue", {}).get("label") == str(value) for wire in state["wires"].values()) < 2]
                if candidates:
                    value = _rng(state).choice(candidates)
                    for wire in list(_uncut(state)):
                        if wire["blue_value"] == value and not _danger(wire):
                            _cut(state, wire)
                    _refresh(state, events)
                    events.append(_event("disintegrator", value=value))
                changed = True


def _refresh(state: Dict, events: List[Dict]) -> List[int]:
    data = _data(state)
    number = _number(state)
    completed = _core()._refresh_validation(state)
    for value in completed:
        if value not in data["validations"]:
            data["validations"].append(value)
    events.extend(_core()._validation_events(completed))
    if number == 15 and data["forced_value"] in completed:
        hidden = next((card for card in data["equipment"] if card["hidden"]), None)
        if hidden:
            hidden.update(hidden=False, unlocked=True)
        data["forced_value"] = _draw_number(state)
    if number == 37 and completed:
        for _ in completed:
            data["shared_constraint"] = data["constraint_deck"].pop() if data["constraint_deck"] else None
    if number == 57 and completed:
        data["shared_constraint"] = data["constraint_map"][str(completed[-1])]
    if number == 54 and completed:
        for _ in completed:
            for player_id in _order(state):
                if data["oxygen_reserve"]:
                    data["oxygen_reserve"] -= 1
                    data["oxygen"][player_id] += 1
    if number == 62:
        for value in completed:
            if value in data["reward_numbers"]:
                _adjust_detonator(state, -1, events)
    _unlock_equipment(state, events)
    return completed


def _check_challenges(state: Dict, events: List[Dict]) -> None:
    data = _data(state)
    history = data["history"]
    validations = data["validations"]
    successes = []
    racks = [[state["wires"][wire_id] for wire_id in rack["slots"]] for rack in state["racks"].values()]
    for challenge in data["challenges"]:
        complete = False
        if challenge == 2:
            recent = history[-4:]
            complete = len(recent) == 4 and all(item["success"] and item.get("value") and item["value"] % 2 == 0 for item in recent)
        elif challenge == 3:
            for rack in racks:
                runs = []
                current = 0
                for wire in rack + [{"status": "cut"}]:
                    if wire["status"] == "uncut":
                        current += 1
                    elif current:
                        runs.append(current)
                        current = 0
                complete = complete or len(runs) >= 2 and all(length == 2 for length in runs)
        elif challenge == 4:
            complete = len(validations) >= 3 and sum(validations[:3]) == 18
        elif challenge == 5:
            complete = len(history) >= 2 and all(item["success"] and item["kind"] == "solo_cut" for item in history[-2:])
        elif challenge == 6:
            complete = any(sum(wire["status"] == "uncut" and (index == 0 or rack[index - 1]["status"] != "uncut")
                               and (index == len(rack) - 1 or rack[index + 1]["status"] != "uncut")
                               for index, wire in enumerate(rack)) >= 5 for rack in racks)
        elif challenge == 7:
            recent = history[-3:]
            values = [item.get("value") for item in recent]
            complete = len(values) == 3 and all(item["success"] for item in recent) and all(isinstance(value, int) for value in values) and values[1] - values[0] == values[2] - values[1] and abs(values[1] - values[0]) == 1
        elif challenge == 8:
            complete = len(validations) >= 2 and set(validations[:2]) == set(data["challenge_numbers"])
        elif challenge == 9:
            complete = any(len([wire for wire in rack if wire["status"] == "uncut" and wire["kind"] == "blue"]) >= 6
                           and all(wire["blue_value"] % 2 for wire in rack if wire["status"] == "uncut" and wire["kind"] == "blue") for rack in racks)
        elif challenge == 10:
            complete = any(len(rack) >= 11 and sum(wire["status"] == "cut" for wire in rack) >= 7
                           and all(wire["status"] == "uncut" for wire in rack[:2] + rack[-2:]) for rack in racks)
        if complete:
            successes.append(challenge)
    for challenge in successes:
        data["challenges"].remove(challenge)
        _adjust_detonator(state, -1, events)
        events.append(_event("challenge_complete", challenge=challenge))


def _next_actor(state: Dict, actor_id: str) -> Optional[str]:
    order = state["turn_order"]
    start = order.index(actor_id)
    return next((order[(start + offset) % len(order)] for offset in range(1, len(order) + 1)
                 if _uncut(state, order[(start + offset) % len(order)])), None)


def _advance(state: Dict, actor_id: str, events: List[Dict]) -> None:
    if state["phase"] == "mission_result":
        return
    data = _data(state)
    number = _number(state)
    anchor = data.get("director") or actor_id
    next_actor = data.pop("next_actor_override", None) or _next_actor(state, anchor)
    if number == 45:
        next_actor = state["captain_id"]
    data["director"] = None
    data["nominee"] = None
    if number in (18, 45, 51):
        data["forced_value"] = None
    state["current_turn"] = next_actor
    state["phase"] = "playing"
    order = _order(state)
    wrapped = next_actor is not None and order.index(next_actor) <= order.index(anchor)
    if wrapped:
        data["round"] += 1
        if number == 44:
            data["oxygen_reserve"] = data["oxygen_total"]
        if number == 63:
            recipient = state["captain_id"] if _uncut(state, state["captain_id"]) else next_actor
            data["oxygen"][recipient] += data["oxygen_reserve"]
            data["oxygen_reserve"] = 0
        if number in (23, 39) and not data["special_complete"]:
            data["special_countdown"] = max(0, data["special_countdown"] - 1)
            if number == 23 and data["equipment"]:
                data["equipment"].pop()
            if number == 39 and data["reward_deck"]:
                data["reward_deck"].pop()
        if number == 61:
            _decision(state, state["captain_id"], "rotate_constraints", ["keep", "clockwise", "counterclockwise"])
            return
    _prepare_turn(state)
    if number in (9, 16) and next_actor and not _can_cut(state, next_actor):
        _finish(state, "priority_deadlock", events)


def _end_turn(state: Dict, actor_id: str, events: List[Dict], value: Optional[int], success: bool,
              kind: str, cut_ids: Optional[List[str]] = None) -> None:
    data = _data(state)
    number = _number(state)
    data["history"].append({"actor_id": actor_id, "value": value, "success": success, "kind": kind})
    data["last_actor"] = actor_id
    data["history"] = data["history"][-12:]
    data["skipped"] = []
    _refresh(state, events)
    _check_challenges(state, events)
    if data.get("prediction"):
        prediction = data["prediction"]
        if success and value == prediction["value"]:
            _adjust_detonator(state, 1, events)
        events.append(_event("prediction_revealed", value=prediction["value"]))
        data["number_hands"][actor_id].append(prediction["value"])
        data["prediction"] = None
        for owner, cards in data["number_hands"].items():
            data["number_hands"][owner] = [card for card in cards if not state["validation_complete"].get(str(card))]
            while len(data["number_hands"][owner]) < 2 and data["number_deck"]:
                card = data["number_deck"].pop()
                if not state["validation_complete"].get(str(card)):
                    data["number_hands"][owner].append(card)
    if number == 43:
        nano = data["nano"]
        if success and value == nano["position"] and data["reserve"]:
            wire = data["reserve"].pop()
            if len(state["players"][actor_id]["rack_ids"]) > 1:
                data["incoming_wire"] = wire
                data["resume_turn"] = actor_id
                _decision(state, actor_id, "insert_wire", list(state["players"][actor_id]["rack_ids"]))
            else:
                _move_wire(state, wire, state["players"][actor_id]["rack_ids"][0])
        nano["position"] += nano["direction"]
        if nano["position"] in (1, 12):
            nano["direction"] *= -1
    if number == 53:
        nano = data["nano"]
        nano["position"] += -1 if success and value == nano["position"] else 1 if success else 2
        nano["position"] = max(0, nano["position"])
        if nano["position"] >= 12:
            _finish(state, "nano", events)
    if number == 63:
        recipient = _next_actor(state, actor_id)
        if recipient and recipient != actor_id:
            data["oxygen"][recipient] += data["oxygen"][actor_id]
            data["oxygen"][actor_id] = 0
    if number == 49:
        for owner in state["turn_order"]:
            if not _uncut(state, owner):
                data["oxygen"][owner] = 0
    if state["phase"] == "mission_result":
        return
    if not _all_remaining(state):
        _finish(state, "all_wires_cleared", events, success=True)
        return
    if state["phase"] == "mission_decision":
        return
    if number == 36 and success and value in data["sequence"] and state["cut_blue_counts"].get(str(value), 0) >= 2:
        data["sequence"].remove(value)
        if data["sequence"]:
            _decision(state, actor_id, "sequence_side", ["left", "right"], resume_turn=actor_id)
            return
    if number == 59 and kind != "coffee":
        _decision(state, actor_id, "nano_direction", ["forward", "reverse"], resume_turn=actor_id)
        return
    if number == 65:
        cards = [card for card in data["number_hands"][actor_id] if not state["validation_complete"].get(str(card))]
        if cards:
            choices = [f"{card}:{owner}" for card in cards for owner in _order(state) if owner != actor_id and _uncut(state, owner)]
            if choices:
                _decision(state, actor_id, "give_number", choices, resume_turn=actor_id)
                return
    if number == 66 and value is not None:
        choices = [direction for direction, constraint in data["bunker"]["directions"].items() if _constraint_value(constraint, value)]
        _decision(state, actor_id, "bunker_move", choices, resume_turn=actor_id, value=value, success=success,
                  moves=2 if kind == "solo_cut" and len(cut_ids or []) == 4 else 1)
        return
    if number in (22, 27) and not data.get("yellow_clues_done") and sum(wire["kind"] == "yellow" and wire["status"] == "cut" for wire in state["wires"].values()) >= 2:
        data["yellow_clues_done"] = True
        data["clue_round"] = _order(state)
        data["resume_turn"] = actor_id
        if number == 27:
            data["bonus_clues"] = [_rng(state).randint(1, 12) for _ in _order(state)]
        _bonus_clue_decision(state)
        return
    if number == 39 and data.get("reward_queue"):
        data["resume_turn"] = actor_id
        _reward_clue_decision(state)
        return
    _advance(state, actor_id, events)


def _reward_clue_decision(state: Dict) -> None:
    data = _data(state)
    while data["reward_queue"]:
        owner = data["reward_queue"][0]
        choices = [value for value in data["number_hands"].get(owner, [])
                   if any(wire["kind"] == "blue" and wire["blue_value"] == value and not wire.get("clue")
                          for wire in _uncut(state, owner))
                   and any(token["label"] == str(value) and token["attached_wire_id"] is None
                           and not token.get("reserved_for") for token in state["info_tokens"].values())]
        if choices:
            _decision(state, owner, "reward_number", choices)
            return
        data["reward_queue"].pop(0)
    _advance(state, data.pop("resume_turn"), [])


def _bonus_clue_decision(state: Dict) -> None:
    data = _data(state)
    actor = data["clue_round"][0]
    choices = data.get("bonus_clues") if _number(state) == 27 else list(range(1, 13)) + ["yellow"]
    _decision(state, actor, "bonus_clue", list(choices))


def _target_error(state: Dict, player_id: str, target: Dict, equipment: bool) -> Optional[str]:
    if target["owner_id"] == player_id or target["status"] != "uncut":
        return "choose an uncut teammate wire"
    constraint = _constraint(state, player_id)
    if _number(state) == 35 and target.get("unsorted") and any(wire["kind"] == "yellow" for wire in _all_remaining(state)):
        return "X-wires cannot be cut before all yellow wires"
    if target.get("reversed") and _number(state) == 38:
        return "only the Captain may use their reversed wire"
    if equipment and (target.get("unsorted") or target.get("reversed")):
        return "special wires ignore equipment"
    if constraint == "H" and target.get("clue"):
        return "constraint H forbids marked targets"
    slots = [wire_id for wire_id in state["racks"][target["rack_id"]]["slots"] if state["wires"][wire_id]["status"] == "uncut"]
    if slots and (constraint == "I" and target["wire_id"] == slots[-1] or constraint == "J" and target["wire_id"] == slots[0]):
        return "the constraint forbids that end of the rack"
    return None


def _pay_cut(state: Dict, actor_id: str, value: Optional[int], action: Dict) -> None:
    data = _data(state)
    number = _number(state)
    if number == 26 and value in data["number_cards"]:
        data["number_cards"].remove(value)
    if number == 47:
        cards = action.get("number_cards")
        if not isinstance(cards, list) or len(cards) != 2 or len(set(cards)) != 2 or any(card not in data["number_cards"] for card in cards):
            raise ValueError("choose two available Number cards")
        if value not in (sum(cards), abs(cards[0] - cards[1])):
            raise ValueError("Number cards must add or subtract to the declaration")
        for card in cards:
            data["number_cards"].remove(card)
    if number == 59 and value is not None:
        nano = data["nano"]
        position = nano["line"].index(value)
        if (position - nano["position"]) * nano["direction"] < 0:
            raise ValueError("Nano cannot move backwards")
        nano["position"] = position
    if number in (44, 49, 54, 63) and value is not None:
        amount = (value - 1) // 4 + 1 if number in (44, 54) else value
        if number == 44:
            if data["oxygen_reserve"] < amount:
                raise ValueError("not enough oxygen in the shared reserve")
            data["oxygen_reserve"] -= amount
        else:
            if data["oxygen"].get(actor_id, 0) < amount:
                raise ValueError("not enough oxygen")
            data["oxygen"][actor_id] -= amount
            if number == 49:
                recipient = action.get("recipient_id")
                if recipient == actor_id or recipient not in state["players"] or not _uncut(state, recipient):
                    raise ValueError("choose a teammate with remaining wires to receive oxygen")
                data["oxygen"][recipient] += amount
            else:
                data["oxygen_reserve"] += amount


def _select_wire(state: Dict, wire_id: object) -> Dict:
    if not isinstance(wire_id, str) or wire_id not in state["wires"]:
        raise ValueError("unknown wire")
    return state["wires"][wire_id]


def _own_declaration(state: Dict, actor_id: str, wire_id: object, action: Dict, equipment: bool = False) -> Tuple[Dict, str, Optional[int]]:
    wire = _select_wire(state, wire_id)
    if wire["owner_id"] != actor_id or wire["status"] != "uncut":
        raise ValueError("choose your own uncut wire")
    if wire.get("reversed"):
        if equipment:
            raise ValueError("reversed wires cannot use equipment")
        label = action.get("declaration")
        if label not in [str(value) for value in range(1, 13)] + ["yellow"]:
            raise ValueError("declare the value you believe is on your reversed wire")
        value = int(label) if label.isdigit() else None
        if value is not None and value not in _allowed_values(state, actor_id):
            raise ValueError("the declaration is blocked by mission rules")
        return wire, label, value
    if not _wire_allowed(state, actor_id, wire):
        raise ValueError("that value is blocked by mission rules")
    if equipment and wire.get("unsorted"):
        raise ValueError("X-wires ignore equipment")
    return wire, _key(state, wire), _value(state, wire)


def _miss(state: Dict, actor_id: str, targets: List[Dict], label: str, events: List[Dict],
          red_fatal: bool, fatal_owner: bool = False) -> bool:
    data = _data(state)
    stabilized = data.get("stabilized") == actor_id
    fatal = fatal_owner or _number(state) in (14, 28) and actor_id == data.get("special_player")
    if (red_fatal or fatal) and not stabilized:
        _finish(state, "red_wire" if red_fatal else "fatal_mistake", events)
        return True
    if not stabilized:
        amount = 2 if _constraint(state, actor_id) == "L" else 1
        _adjust_detonator(state, amount, events)
    if state["phase"] != "mission_result":
        non_red = [wire for wire in targets if not _danger(wire)]
        if non_red:
            if len(non_red) == 1:
                if _constraint(state, actor_id) != "H":
                    clue = _clue(state, non_red[0], label)
                    if clue:
                        events.extend(_clue_events(non_red[0], clue, actor_id))
            elif _number(state) != 58 and _constraint(state, actor_id) != "H":
                state["phase"] = "awaiting_detector_choice"
                state["current_responder_id"] = non_red[0]["owner_id"]
                state["pending_resolution"] = {"kind": "campaign_info", "actor_id": actor_id,
                    "responder_id": non_red[0]["owner_id"], "target_wire_ids": [wire["wire_id"] for wire in targets],
                    "allowed_wire_ids": [wire["wire_id"] for wire in non_red], "declaration": label}
    return False


def _cut_action(state: Dict, actor_id: str, action: Dict, events: List[Dict],
                detector_count: int = 0, equipment_card: Optional[Dict] = None) -> None:
    kind = action["type"]
    own, label, value = _own_declaration(state, actor_id, action.get("own_wire_id"), action, bool(detector_count))
    if detector_count:
        target_ids = action.get("target_wire_ids")
        if not isinstance(target_ids, list) or not target_ids or len(target_ids) != len(set(target_ids)):
            raise ValueError("choose distinct detector targets")
        if detector_count > 0 and len(target_ids) != detector_count:
            raise ValueError(f"choose exactly {detector_count} detector targets")
        if own["kind"] != "blue":
            raise ValueError("detectors require a blue declaration")
    else:
        target_ids = [action.get("target_wire_id")]
    targets = [_select_wire(state, wire_id) for wire_id in target_ids]
    for target in targets:
        error = _target_error(state, actor_id, target, bool(detector_count))
        if error:
            raise ValueError(error)
    if detector_count and len({wire["rack_id"] for wire in targets}) != 1:
        raise ValueError("detector targets must be on the same rack")
    if detector_count == -1:
        rack = state["racks"][targets[0]["rack_id"]]
        eligible = {wire_id for wire_id in rack["slots"] if state["wires"][wire_id]["status"] == "uncut" and not state["wires"][wire_id].get("unsorted") and not state["wires"][wire_id].get("reversed")}
        if set(target_ids) != eligible:
            raise ValueError("Super Detector must cover every eligible wire on the rack")
    _pay_cut(state, actor_id, value, action)
    if equipment_card:
        equipment_card["used"] = True
    elif detector_count:
        state["players"][actor_id]["personal_detector_used"] = True
    state["action_number"] += 1
    if not detector_count and targets[0].get("reversed") and _number(state) in (56, 64):
        _adjust_detonator(state, 1, events)
        if state["phase"] == "mission_result":
            return
    matches = [wire for wire in targets if _key(state, wire) == label and not _danger(wire)
               and not (_number(state) in (23, 39, 46) and not _data(state)["special_complete"]
                        and wire["kind"] == "blue" and wire["blue_value"] == _data(state)["special_number"])]
    if own.get("reversed") and _key(state, own) != label:
        matches = []
    if matches and not _danger(own):
        if len(matches) > 1:
            state["phase"] = "awaiting_detector_choice"
            state["current_responder_id"] = matches[0]["owner_id"]
            state["pending_resolution"] = {"kind": "campaign_cut", "actor_id": actor_id,
                "responder_id": matches[0]["owner_id"], "own_wire_id": own["wire_id"],
                "target_wire_ids": list(target_ids), "allowed_wire_ids": [wire["wire_id"] for wire in matches],
                "declaration": label, "value": value, "action_kind": kind}
            events.append(_event("detector_choice_required", player_id=actor_id, responder_id=matches[0]["owner_id"], declaration=label, target_wire_ids=target_ids))
            return
        _cut(state, own)
        _cut(state, matches[0])
        cut_ids = [own["wire_id"], matches[0]["wire_id"]]
        events.append(_event("duo_cut", player_id=actor_id, declaration=label, cut_wire_ids=cut_ids))
        _end_turn(state, actor_id, events, value, True, kind, cut_ids)
    else:
        events.append(_event("detector_miss" if detector_count else "duo_miss", player_id=actor_id, declaration=label, target_wire_ids=target_ids))
        red_fatal = all(_danger(wire) for wire in targets)
        _miss(state, actor_id, targets, label, events, red_fatal, bool(own.get("reversed")))
        if state["phase"] == "awaiting_detector_choice":
            state["pending_resolution"].update(value=value, action_kind=kind)
        elif state["phase"] != "mission_result":
            _end_turn(state, actor_id, events, value, False, kind)


def _advance_initial(state: Dict) -> None:
    data = _data(state)
    order = state["initial_info_order"]
    while state["initial_info_cursor"] < len(order):
        actor = order[state["initial_info_cursor"]]
        if _number(state) == 22:
            owned = {_label(wire) for wire in _uncut(state, actor)}
            chosen = {note["label"] for note in data["clue_notes"] if note.get("player_id") == actor}
            available = [label for label in [str(value) for value in range(1, 13)] + ["yellow"]
                         if label not in owned and label not in chosen]
            if not available:
                data["initial_remaining"][actor] = 0
        elif actor in data.get("random_initial", {}):
            label = data["random_initial"][actor]
            if not any(wire["kind"] == "blue" and wire["blue_value"] == label and not wire.get("reversed") for wire in _uncut(state, actor)):
                _note(state, actor, str(label), absent=True)
                data["initial_remaining"][actor] = 0
        elif not any(_initial_candidate(state, wire, actor) for wire in _uncut(state, actor)):
            data["initial_remaining"][actor] = 0
        if data["initial_remaining"][actor] > 0:
            return
        state["players"][actor]["initial_info_placed"] = True
        state["initial_info_cursor"] += 1
    _begin_play(state)


def _initial_candidate(state: Dict, wire: Dict, actor_id: str) -> bool:
    if wire.get("reversed") or wire.get("clue") or wire["kind"] != "blue":
        return False
    expected = _data(state).get("random_initial", {}).get(actor_id)
    if expected is not None and wire["blue_value"] != expected:
        return False
    if _number(state) in (24, 40):
        return sum(_key(state, state["wires"][wire_id]) == _key(state, wire)
                   for wire_id in state["racks"][wire["rack_id"]]["slots"]) <= 3
    return True


def _initial_clue(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    if actor_id != state["initial_info_order"][state["initial_info_cursor"]]:
        raise ValueError("not your initial clue turn")
    if _number(state) == 22:
        label = str(action.get("label", ""))
        if label not in [str(value) for value in range(1, 13)] + ["yellow"]:
            raise ValueError("choose an absent value")
        if any(_label(wire) == label for wire in _uncut(state, actor_id)):
            raise ValueError("you have that value in your hand")
        if any(note.get("player_id") == actor_id and note["label"] == label for note in data["clue_notes"]):
            raise ValueError("choose a different absent value")
        _note(state, actor_id, label, absent=True)
    else:
        wire = _select_wire(state, action.get("wire_id"))
        negative = _number(state) == 52 or _number(state) == 17 and actor_id == data.get("special_player")
        if wire["owner_id"] != actor_id or wire["status"] != "uncut" or wire.get("reversed"):
            raise ValueError("choose your own visible uncut wire")
        if wire["kind"] != "blue" and not (negative and _number(state) == 52):
            raise ValueError("initial clues require a blue wire")
        if wire.get("clue"):
            raise ValueError("this wire already has a clue")
        expected = data.get("random_initial", {}).get(actor_id)
        if expected is not None and wire["blue_value"] != expected:
            raise ValueError("use the randomly drawn clue value")
        label = action.get("label") if negative else None
        if negative and label not in [str(value) for value in range(1, 13)] + ["yellow"]:
            raise ValueError("choose a false clue label")
        if _number(state) in (24, 40):
            multiplicity = sum(_key(state, state["wires"][wire_id]) == _key(state, wire) for wire_id in state["racks"][wire["rack_id"]]["slots"])
            if multiplicity > 3:
                raise ValueError("a four-copy rack cannot receive a multiplicity clue")
        clue = _clue(state, wire, chosen=label)
        events.extend(_clue_events(wire, clue, actor_id))
    data["initial_remaining"][actor_id] -= 1
    state["action_number"] += 1
    _activity(state, actor_id, "An initial clue was shared.")
    _advance_initial(state)


def _handle_setup_choice(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    step = data["setup_queue"][data["setup_cursor"]]
    choice = action.get("choice")
    if step["player_id"] != actor_id or choice not in step["choices"]:
        raise ValueError("choose one of your setup options")
    if step["kind"] == "constraint":
        if choice not in data["available_constraints"]:
            raise ValueError("that constraint was already chosen")
        data["constraints"][actor_id] = choice
        data["available_constraints"].remove(choice)
    elif step["kind"] == "sequence_side":
        data["sequence_side"] = choice
    elif step["kind"] == "audio_ready":
        data["audio_started_at"] = time.time()
    data["setup_cursor"] += 1
    if data["setup_cursor"] >= len(data["setup_queue"]):
        state["phase"] = "initial_info"
        _advance_initial(state)
    events.append(_event("setup_choice", player_id=actor_id, kind=step["kind"]))


def _handle_decision(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    decision = data["decision"]
    choice = action.get("choice")
    volunteering = decision["kind"] == "volunteer" and choice == "volunteer" and bool(_uncut(state, actor_id))
    if not volunteering and (decision["player_id"] != actor_id or choice not in decision["choices"]):
        raise ValueError("choose one of your available mission options")
    kind = decision["kind"]
    data["decision"] = None
    state["phase"] = "playing"
    resume = decision.get("resume_turn")
    if kind in ("nominate", "volunteer"):
        if volunteering:
            choice = actor_id
        data["nominee"] = choice
        state["current_turn"] = choice
        if not any(_value(state, wire) == data["forced_value"] or wire.get("reversed") for wire in _uncut(state, choice)) and not _only_danger(state, choice):
            if volunteering:
                _adjust_detonator(state, 1, events)
                _advance(state, actor_id, events)
                return
            candidates = [wire["wire_id"] for wire in _uncut(state, choice) if wire["kind"] == "blue" and not wire.get("reversed")]
            _decision(state, choice, "nominee_clue", candidates or ["none"], resume_turn=choice)
        return
    if kind == "nominee_clue":
        if choice != "none":
            wire = state["wires"][choice]
            events.extend(_clue_events(wire, _clue(state, wire), actor_id))
        _adjust_detonator(state, 1, events)
    elif kind == "predict":
        data["number_hands"][actor_id].remove(choice)
        data["prediction"] = {"value": choice, "predictor_id": actor_id}
        return
    elif kind == "sequence_side":
        data["sequence_side"] = choice
    elif kind == "insert_wire":
        wire = data.pop("incoming_wire")
        _move_wire(state, wire, choice)
        resume = data.pop("resume_turn")
    elif kind == "exchange_wire":
        incoming = state["wires"][decision["own_wire_id"]]
        outgoing = state["wires"][choice]
        first_rack, second_rack = incoming["rack_id"], outgoing["rack_id"]
        _move_wire(state, incoming, second_rack)
        _move_wire(state, outgoing, first_rack)
        events.append(_event("wires_exchanged", player_id=decision["initiator_id"], target_player_id=actor_id))
        return
    elif kind == "reward_number":
        candidates = [wire["wire_id"] for wire in _uncut(state, actor_id)
                      if wire["kind"] == "blue" and wire["blue_value"] == choice and not wire.get("clue")]
        _decision(state, actor_id, "reward_wire", candidates)
        return
    elif kind == "reward_wire":
        wire = state["wires"][choice]
        events.extend(_clue_events(wire, _clue(state, wire), actor_id))
        data["reward_queue"].pop(0)
        _reward_clue_decision(state)
        return
    elif kind == "nano_direction":
        if choice == "reverse":
            data["nano"]["direction"] *= -1
    elif kind == "give_number":
        number_text, recipient = choice.split(":", 1)
        value = int(number_text)
        data["number_hands"][actor_id].remove(value)
        data["number_hands"][recipient].append(value)
    elif kind == "rotate_constraints":
        if choice != "keep":
            ring = data["constraint_ring"]
            offset = 1 if choice == "clockwise" else -1
            data["constraint_ring"] = ring[-offset:] + ring[:-offset]
            data["constraints"] = {owner: data["constraint_ring"][index]
                                   for index, owner in enumerate(data["constraint_seats"]) if owner is not None}
        _prepare_turn(state)
        return
    elif kind == "bonus_clue":
        value = str(choice)
        recipient = actor_id if _number(state) == 27 else _core()._next_seat(state["turn_order"], actor_id)
        if _number(state) == 27:
            data["bonus_clues"].remove(choice)
        candidates = [wire["wire_id"] for wire in _uncut(state, recipient) if _label(wire) == value and not wire.get("reversed")]
        if candidates:
            _decision(state, recipient, "received_clue", candidates, giver_id=actor_id)
            return
        _note(state, recipient, value, absent=True)
        data["clue_round"].pop(0)
        if data["clue_round"]:
            _bonus_clue_decision(state)
            return
        resume = data.pop("resume_turn")
    elif kind == "received_clue":
        wire = state["wires"][choice]
        events.extend(_clue_events(wire, _clue(state, wire), actor_id))
        data["clue_round"].pop(0)
        if data["clue_round"]:
            _bonus_clue_decision(state)
            return
        resume = data.pop("resume_turn")
    elif kind == "bunker_move":
        bunker = data["bunker"]
        value = decision["value"]
        position = bunker["position"]
        striped = (bunker["floor"], tuple(position)) in {(0, (2, 1)), (1, (0, 1))}
        if striped and decision["success"] and _constraint_value(bunker["action_constraint"], value):
            bunker["actions"] += 1
            events.append(_event("bunker_action", action_number=bunker["actions"]))
        elif not striped:
            delta = {"north": (0, 1), "east": (1, 0), "south": (0, -1), "west": (-1, 0)}[choice]
            destination = [position[0] + delta[0], position[1] + delta[1]]
            wall = (position[1] == 1 and destination[1] == 2 or position[1] == 2 and destination[1] == 1) and position[0] != 2
            wall = wall or (position[0] == 0 and destination == [1, 3] or position == [1, 3] and destination == [0, 3])
            if 0 <= destination[0] <= 2 and 0 <= destination[1] <= 3 and not wall:
                bunker["position"] = destination
        if bunker["position"] in ([0, 1], [1, 0]):
            _adjust_detonator(state, 1, events)
        if decision["moves"] > 1 and state["phase"] != "mission_result":
            _decision(state, actor_id, "bunker_move", decision["choices"], resume_turn=resume,
                      value=value, success=decision["success"], moves=decision["moves"] - 1)
            return
    if state["phase"] != "mission_result" and resume:
        _advance(state, resume, events)


def _special_cut(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    special = _special_action(state, actor_id)
    if not special:
        raise ValueError("no special cut is available")
    wire_ids = action.get("wire_ids")
    if not isinstance(wire_ids, list) or len(wire_ids) != special["count"] or len(set(wire_ids)) != len(wire_ids):
        raise ValueError(f"choose exactly {special['count']} distinct wires")
    wires = [_select_wire(state, wire_id) for wire_id in wire_ids]
    if any(wire["status"] != "uncut" for wire in wires):
        raise ValueError("special cuts require uncut wires")
    kind = special["kind"]
    if kind in ("yellow", "red_challenge") and special["count"] == 1 and wires[0]["owner_id"] == actor_id:
        raise ValueError("identify a teammate's wire")
    success = all(wire["kind"] == ("red" if kind == "red_challenge" else kind) for wire in wires) if kind in ("red", "red_challenge", "yellow") else all(
        wire["kind"] == "blue" and wire["blue_value"] == (7 if kind == "blue7" else int(kind)) for wire in wires)
    state["action_number"] += 1
    if not success:
        if _number(state) in (13, 23, 39, 46) or kind == "red_challenge" or any(_danger(wire) for wire in wires):
            _finish(state, "special_cut", events)
            return
        _adjust_detonator(state, 1, events)
        for wire in wires:
            _clue(state, wire)
        if state["phase"] != "mission_result":
            _end_turn(state, actor_id, events, None, False, "special_cut")
        return
    for wire in wires:
        _cut(state, wire, secured=wire["kind"] == "red")
    if _number(state) == 41:
        _adjust_detonator(state, -1, events)
    elif kind == "red_challenge":
        data["challenges"].remove(1)
        _adjust_detonator(state, -1, events)
    else:
        data["special_complete"] = True
    if _number(state) == 23:
        for card in data["equipment"]:
            card.update(hidden=False, unlocked=True)
    if _number(state) == 39:
        data["number_hands"] = {owner: [] for owner in _order(state)}
        for index, value in enumerate(data["reward_deck"]):
            recipient = _order(state)[index % len(state["turn_order"])]
            data["number_hands"][recipient].append(value)
        data["reward_deck"] = []
        data["reward_queue"] = list(_order(state))
    events.append(_event("special_cut", player_id=actor_id, cut_wire_ids=wire_ids))
    _end_turn(state, actor_id, events, _value(state, wires[0]), True, "special_cut", wire_ids)


def _use_equipment(state: Dict, actor_id: str, action: Dict, events: List[Dict]) -> None:
    data = _data(state)
    card = next((card for card in data["equipment"] if card["id"] == action.get("equipment_id")), None)
    if not card or not _equipment_usable(state, actor_id, card):
        raise ValueError("equipment is not available")
    kind = card["kind"]
    if kind in ("false_bottom", "emergency_drop", "disintegrator"):
        raise ValueError("this equipment activates automatically")
    if kind == "walkie_talkies":
        own = _select_wire(state, action.get("own_wire_id"))
        recipient = action.get("recipient_id")
        if own["owner_id"] != actor_id or own["status"] != "uncut" or own.get("reversed") or own.get("unsorted"):
            raise ValueError("offer one of your eligible uncut wires")
        choices = [wire["wire_id"] for wire in _uncut(state, recipient)
                   if not wire.get("reversed") and not wire.get("unsorted")] if recipient in state["players"] and recipient != actor_id else []
        if not choices:
            raise ValueError("choose a teammate with an eligible wire to exchange")
        card["used"] = True
        _decision(state, recipient, "exchange_wire", choices, own_wire_id=own["wire_id"], initiator_id=actor_id)
        events.append(_event("exchange_requested", player_id=actor_id, target_player_id=recipient))
        return
    if kind in ("triple_detector", "super_detector"):
        _cut_action(state, actor_id, action, events, 3 if kind == "triple_detector" else -1, card)
        return
    if kind == "x_or_y":
        ids = action.get("own_wire_ids")
        if not isinstance(ids, list) or len(ids) != 2 or len(set(ids)) != 2:
            raise ValueError("choose two of your declaration wires")
        own = [_own_declaration(state, actor_id, wire_id, action, True)[0] for wire_id in ids]
        labels = {_key(state, wire) for wire in own}
        if len(labels) != 2:
            raise ValueError("choose two different declaration values")
        target = _select_wire(state, action.get("target_wire_id"))
        error = _target_error(state, actor_id, target, True)
        if error:
            raise ValueError(error)
        matching = next((wire for wire in own if _key(state, wire) == _key(state, target)), None)
        payment_value = _value(state, matching or own[0])
        _pay_cut(state, actor_id, payment_value, action)
        card["used"] = True
        if matching and not _danger(target):
            _cut(state, matching)
            _cut(state, target)
            events.append(_event("duo_cut", player_id=actor_id, cut_wire_ids=[matching["wire_id"], target["wire_id"]]))
            _end_turn(state, actor_id, events, payment_value, True, "dual_cut")
        else:
            _miss(state, actor_id, [target], " / ".join(sorted(labels)), events, _danger(target))
            if state["phase"] != "mission_result":
                _end_turn(state, actor_id, events, payment_value, False, "dual_cut")
        return
    if kind in ("equal", "not_equal", "fast_pass"):
        ids = action.get("wire_ids")
        if not isinstance(ids, list) or len(ids) != 2 or len(set(ids)) != 2:
            raise ValueError("choose two distinct wires")
        wires = [_select_wire(state, wire_id) for wire_id in ids]
        if any(wire.get("unsorted") or wire.get("reversed") for wire in wires):
            raise ValueError("special wires ignore equipment")
        if kind in ("equal", "not_equal"):
            if any(wire["owner_id"] != actor_id for wire in wires) or wires[0]["rack_id"] != wires[1]["rack_id"] or abs(wires[0]["slot_index"] - wires[1]["slot_index"]) != 1:
                raise ValueError("choose adjacent wires on one of your racks")
            if all(wire["status"] != "uncut" for wire in wires):
                raise ValueError("at least one wire must be uncut")
            if (_key(state, wires[0]) == _key(state, wires[1])) != (kind == "equal"):
                raise ValueError("the wires do not satisfy this label")
            data["links"].append({"wire_ids": ids, "relation": "=" if kind == "equal" else "≠"})
        else:
            if any(wire["owner_id"] != actor_id or wire["status"] != "uncut" or not _wire_allowed(state, actor_id, wire) for wire in wires) or _key(state, wires[0]) != _key(state, wires[1]) or _constraint(state, actor_id) == "K":
                raise ValueError("choose two matching legal wires from your hand")
            value = _value(state, wires[0])
            _pay_cut(state, actor_id, value, action)
            card["used"] = True
            for wire in wires:
                _cut(state, wire)
            _end_turn(state, actor_id, events, value, True, "solo_cut", ids)
            return
    elif kind in ("post_it", "single_label"):
        wire = _select_wire(state, action.get("wire_id"))
        if wire["owner_id"] != actor_id or wire["kind"] != "blue" or wire.get("reversed") or wire.get("unsorted") or kind == "post_it" and wire["status"] != "uncut" and _number(state) not in (24, 40):
            raise ValueError("choose an eligible blue wire from your hand")
        if _constraint(state, actor_id) == "H":
            raise ValueError("constraint H forbids Post-It")
        if kind == "single_label":
            if sum(state["wires"][wire_id]["blue_value"] == wire["blue_value"] for wire_id in state["racks"][wire["rack_id"]]["slots"]) != 1:
                raise ValueError("the value must occur once on this rack")
            wire["clue"] = {"label": "×1", "negative": False}
        else:
            _clue(state, wire)
    elif kind == "rewinder":
        _adjust_detonator(state, -1, events)
    elif kind == "batteries":
        owners = action.get("player_ids")
        if not isinstance(owners, list) or not 1 <= len(owners) <= 2 or len(set(owners)) != len(owners):
            raise ValueError("choose one or two used detectors")
        for owner in owners:
            personal = state["players"].get(owner)
            if not personal or not personal["personal_detector_used"] or personal.get("personal_detector_disabled"):
                raise ValueError("that personal detector cannot be recharged")
        for owner in owners:
            state["players"][owner]["personal_detector_used"] = False
    elif kind == "radar":
        value = action.get("value")
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 12:
            raise ValueError("choose a radar value from 1 to 12")
        _radar(state, value)
    elif kind == "stabilizer":
        if data["history"] and data["history"][-1].get("action_number") == state["action_number"]:
            raise ValueError("use Stabilizer before making a cut")
        data["stabilized"] = actor_id
    elif kind == "coffee":
        recipient = action.get("recipient_id")
        if recipient not in state["players"] or not _uncut(state, recipient):
            raise ValueError("choose a player with remaining wires")
        card["used"] = True
        data["director"] = None
        data["nominee"] = None
        data["next_actor_override"] = recipient
        _end_turn(state, actor_id, events, None, True, "coffee")
        return
    elif kind == "grappling_hook":
        wire = _select_wire(state, action.get("wire_id"))
        error = _target_error(state, actor_id, wire, True)
        rack_id = action.get("rack_id") or state["players"][actor_id]["rack_ids"][0]
        if error or rack_id not in state["players"][actor_id]["rack_ids"]:
            raise ValueError(error or "choose one of your racks")
        _move_wire(state, wire, rack_id)
    else:
        raise ValueError("unknown equipment")
    if not card.get("permanent"):
        card["used"] = True
    state["action_number"] += 1
    events.append(_event("equipment_used", player_id=actor_id, equipment_id=card["id"]))
    _activity(state, actor_id, f"{card['name']} was used.")


def _choice_label(state: Dict, kind: str, choice) -> str:
    if kind == "constraint":
        return f"{choice} · {CONSTRAINTS[choice]}"
    if kind in ("nominate", "volunteer"):
        return str(state["player_meta"][choice].get("name") or choice)
    if kind in ("nominee_clue", "received_clue", "reward_wire", "exchange_wire") and choice != "none":
        wire = state["wires"][choice]
        return f"Rack {state['racks'][wire['rack_id']]['rack_index'] + 1} · Slot {wire['slot_index'] + 1}"
    if kind == "give_number":
        value, recipient = choice.split(":", 1)
        return f"{value} → {state['player_meta'][recipient].get('name') or recipient}"
    if kind == "insert_wire":
        return f"Rack {state['racks'][choice]['rack_index'] + 1}"
    if kind == "audio_ready":
        return "Start with official recording"
    return str(choice).replace("_", " ").title()


def extend_public_view(state: Dict, viewer_id: str, view: Dict) -> None:
    data = _data(state)
    number = _number(state)
    reveal_all = state["phase"] == "mission_result"
    view["mode"] = "campaign"
    view["practice"] = None
    view["mission_number"] = number
    view["game_over"] = bool(state.get("game_over"))
    view["campaign_complete"] = bool(state.get("campaign_complete"))
    mission = data["mission"]
    public = {
        "id": number, "name": mission["name"], "rules": mission["rules"],
        "rules_zh": get_mission(number, len(state["turn_order"]))["rules_zh"],
        "total": MISSION_COUNT, "audio_companion": mission["audio_companion"],
        "source_status": "community_transcribed",
        "yellow_count": mission["yellow_count"], "red_count": mission["red_count"],
        "equipment": [], "constraints": {}, "your_constraint": None,
        "shared_constraint": data["shared_constraint"], "constraint_texts": dict(CONSTRAINTS),
        "constraint_map": dict(data.get("constraint_map", {})),
        "constraint_ring": list(data.get("constraint_ring", [])),
        "constraint_seats": list(data.get("constraint_seats", [])),
        "sequence": list(data["sequence"]), "sequence_side": data["sequence_side"],
        "sequence_threshold": data.get("sequence_threshold"), "forced_value": data["forced_value"],
        "special_player": data.get("special_player"), "danger_number": data.get("danger_number"),
        "special_number": data.get("special_number"), "special_countdown": data.get("special_countdown"),
        "special_action": _special_action(state, viewer_id) if state["phase"] == "playing" and state["current_turn"] == viewer_id else None,
        "number_cards": list(data["number_cards"]), "number_hands": {},
        "radar": copy.deepcopy(data["radar"]), "radar_value": data.get("radar_value"),
        "clue_notes": copy.deepcopy(data["clue_notes"]), "links": copy.deepcopy(data["links"]),
        "oxygen": dict(data["oxygen"]), "oxygen_reserve": data["oxygen_reserve"],
        "nano": copy.deepcopy(data["nano"]), "reserve_count": len(data["reserve"]),
        "clock": copy.deepcopy(data["clock"]), "audio_started_at": data["audio_started_at"],
        "audio_events": copy.deepcopy(data["audio_events"]), "audio_number": data.get("audio_number"),
        "challenges": [{"id": challenge, "text": CHALLENGES[challenge]} for challenge in data["challenges"]],
        "challenge_numbers": list(data["challenge_numbers"]), "reward_numbers": list(data.get("reward_numbers", [])),
        "bunker": copy.deepcopy(data.get("bunker")), "decision": None,
        "allowed_values": _allowed_values(state, viewer_id),
        "stabilized": data.get("stabilized"), "can_claim_turn": False,
        "initial_label_choices": [], "initial_negative": False,
    }
    for card in data["equipment"]:
        if card["hidden"] and not reveal_all:
            public["equipment"].append({"id": card["id"], "hidden": True, "name": "Hidden equipment", "used": False, "unlocked": False})
        else:
            visible = copy.deepcopy(card)
            visible["can_use"] = _equipment_usable(state, viewer_id, card)
            public["equipment"].append(visible)
    if number == 34 and not data.get("roles_revealed") and not reveal_all:
        public["your_constraint"] = data["constraints"].get(viewer_id)
        public["you_are_weakest_link"] = viewer_id == data.get("weakest_link")
    else:
        public["constraints"] = dict(data["constraints"])
        public["your_constraint"] = data["constraints"].get(viewer_id)
    if number == 65 or reveal_all:
        public["number_hands"] = copy.deepcopy(data["number_hands"])
    elif viewer_id in data["number_hands"]:
        public["number_hands"] = {viewer_id: list(data["number_hands"][viewer_id])}
    if state["phase"] == "mission_setup":
        step = data["setup_queue"][data["setup_cursor"]]
        public["decision"] = {"kind": step["kind"], "player_id": step["player_id"], "choices": []}
        if step["player_id"] == viewer_id:
            choices = [choice for choice in step["choices"] if step["kind"] != "constraint" or choice in data["available_constraints"]]
            public["decision"]["choices"] = [{"value": choice, "label": _choice_label(state, step["kind"], choice)} for choice in choices]
    elif state["phase"] == "mission_decision":
        decision = data["decision"]
        public["decision"] = {"kind": decision["kind"], "player_id": decision["player_id"], "choices": []}
        if decision["player_id"] == viewer_id:
            public["decision"]["choices"] = [{"value": choice, "label": _choice_label(state, decision["kind"], choice)} for choice in decision["choices"]]
    if state["phase"] == "initial_info" and view["initial_info_player_id"] == viewer_id:
        negative = number == 52 or number == 17 and viewer_id == data.get("special_player")
        public["initial_negative"] = negative
        if negative:
            public["initial_label_choices"] = [str(value) for value in range(1, 13)] + ["yellow"]
        if number == 22:
            owned = {_label(wire) for wire in _uncut(state, viewer_id)}
            already = {note["label"] for note in data["clue_notes"] if note.get("player_id") == viewer_id}
            public["initial_label_choices"] = [label for label in [str(value) for value in range(1, 13)] + ["yellow"] if label not in owned and label not in already]
            view["initial_info_candidate_wire_ids"] = []
        else:
            expected = data.get("random_initial", {}).get(viewer_id)
            view["initial_info_candidate_wire_ids"] = [wire["wire_id"] for wire in _uncut(state, viewer_id)
                if not wire.get("reversed") and not wire.get("clue") and (wire["kind"] == "blue" or negative and number == 52)
                and (expected is None or wire["blue_value"] == expected)
                and (number not in (24, 40) or _initial_candidate(state, wire, viewer_id))]
            public["random_initial_value"] = expected
    pending = state.get("pending_resolution") or {}
    if pending and pending.get("responder_id") == viewer_id:
        view["pending_choice_purpose"] = "cut" if pending["kind"] == "campaign_cut" else "info"
    if number == 50 and state["phase"] != "mission_result":
        view["public_color_markers"] = {}
        view["validation_complete"] = {}
        view["cut_blue_counts"] = {}
    if number == 10 and state["phase"] == "playing" and viewer_id in state["players"]:
        public["can_claim_turn"] = bool(_uncut(state, viewer_id)) and (len(state["turn_order"]) == 2 or data.get("last_actor") != viewer_id or len({wire["owner_id"] for wire in _uncut(state)}) == 1)
    view["campaign"] = public
    view["can_reveal_red"] = "reveal_red_wires" in view["legal_actions"]
    view["can_use_double_detector"] = "double_detector_cut" in view["legal_actions"]


def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
    view = _core().BombBustersGame.get_public_view(state, bot_id)
    actions = view["legal_actions"]
    if not actions:
        return None
    public = view["campaign"]
    decision = public["decision"]
    if "mission_choice" in actions and decision and decision["choices"]:
        choice = decision["choices"][0]["value"]
        return {"type": "mission_choice", "choice": choice, "delay_ms": 350}
    if "continue_mission" in actions:
        return {"type": "continue_mission", "delay_ms": 350}
    if "place_initial_info" in actions:
        candidates = view["initial_info_candidate_wire_ids"]
        if not candidates:
            labels = public["initial_label_choices"]
            return {"type": "place_initial_info", "label": labels[0], "delay_ms": 350} if labels else None
        wire_id = candidates[0]
        action = {"type": "place_initial_info", "wire_id": wire_id, "delay_ms": 350}
        if public["initial_negative"]:
            wire = next(wire for rack in view["racks"] for wire in rack["slots"] if wire["wire_id"] == wire_id)
            label = str(wire["blue_value"]) if wire["kind"] == "blue" else wire["kind"]
            action["label"] = next(choice for choice in public["initial_label_choices"] if choice != label)
        return action
    if "resolve_detector_choice" in actions:
        return {"type": "resolve_detector_choice", "wire_id": view["pending_choice_wire_ids"][0], "delay_ms": 350}
    if "reveal_red_wires" in actions:
        return {"type": "reveal_red_wires", "delay_ms": 350}
    own = [wire for rack in view["racks"] if rack["owner_id"] == bot_id for wire in rack["slots"]
           if wire["status"] == "uncut" and not wire["hidden"] and wire.get("kind") in ("blue", "yellow")]
    own = [wire for wire in own if wire.get("kind") == "yellow" or wire.get("blue_value") in public["allowed_values"]]
    solo = view["legal_solo_sets"]
    if "solo_cut" in actions and solo:
        action = {"type": "solo_cut", "wire_ids": solo[0], "delay_ms": 350}
    else:
        targets = [wire for rack in view["racks"] if rack["owner_id"] != bot_id for wire in rack["slots"] if wire["status"] == "uncut"]
        if "dual_cut" not in actions or not own or not targets:
            if "mission_choice" in actions:
                return {"type": "mission_choice", "choice": "pass", "delay_ms": 350}
            return None
        pair = next(((wire, target) for wire in own for target in targets if target.get("public_info") == (str(wire["blue_value"]) if wire["kind"] == "blue" else "yellow")), (own[0], targets[0]))
        action = {"type": "dual_cut", "own_wire_id": pair[0]["wire_id"], "target_wire_id": pair[1]["wire_id"], "delay_ms": 350}
    if _number(state) == 47:
        selected_id = action.get("own_wire_id") or action["wire_ids"][0]
        wire = next(wire for wire in own if wire["wire_id"] == selected_id)
        value = wire.get("blue_value")
        cards = public["number_cards"]
        pair = next(([first, second] for index, first in enumerate(cards) for second in cards[index + 1:] if value in (first + second, abs(first - second))), None)
        if not pair:
            return {"type": "mission_choice", "choice": "pass", "delay_ms": 350}
        action["number_cards"] = pair
    if _number(state) == 49:
        recipient = next((player["player_id"] for player in view["players"] if player["player_id"] != bot_id and player["remaining_count"]), None)
        action["recipient_id"] = recipient
    return action
