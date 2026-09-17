from __future__ import annotations

import copy
import hashlib
import json
import random
import secrets
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


CATALOG_PATH = Path(__file__).resolve().parent / "assets" / "kronologic_cases.json"
CATALOG_ID = "original-compatible-v1"
MAX_PUBLIC_LOG = 120
MAX_PUBLIC_CLUES = 96
MAX_PRIVATE_CLUES = 96
NOTE_MARKS = {"unknown", "possible", "excluded", "confirmed"}
PHASES = {
    "investigation",
    "clue_review",
    "accusation_collect",
    "accusation_review",
    "case_result",
}


def _load_catalog() -> Dict:
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    _validate_catalog(payload)
    return payload


def _validate_catalog(catalog: Dict) -> None:
    if not isinstance(catalog, dict):
        raise ValueError("invalid Kronologic catalog")
    if catalog.get("schema_version") != 1:
        raise ValueError("unsupported Kronologic catalog schema")
    if catalog.get("catalog_id") != CATALOG_ID:
        raise ValueError("unexpected Kronologic catalog id")
    if catalog.get("catalog_status") != "original-compatible":
        raise ValueError("Kronologic catalog must be original-compatible")
    if catalog.get("commercial_scenarios_included") is not False:
        raise ValueError("commercial Kronologic scenarios are not accepted")

    characters = catalog.get("characters")
    locations = catalog.get("locations")
    edges = catalog.get("edges")
    cases = catalog.get("cases")
    if not isinstance(characters, list) or len(characters) != 6:
        raise ValueError("Kronologic requires exactly 6 characters")
    if not isinstance(locations, list) or len(locations) != 6:
        raise ValueError("Kronologic requires exactly 6 locations")
    if not isinstance(edges, list) or not edges:
        raise ValueError("Kronologic venue graph is missing")
    if not isinstance(cases, list) or len(cases) != 5:
        raise ValueError("Kronologic original catalog requires exactly 5 cases")

    character_ids = [item.get("id") for item in characters if isinstance(item, dict)]
    location_ids = [item.get("id") for item in locations if isinstance(item, dict)]
    if len(character_ids) != 6 or len(set(character_ids)) != 6 or not all(isinstance(value, str) and value for value in character_ids):
        raise ValueError("invalid Kronologic character ids")
    if len(location_ids) != 6 or len(set(location_ids)) != 6 or not all(isinstance(value, str) and value for value in location_ids):
        raise ValueError("invalid Kronologic location ids")

    edge_set = set()
    neighbors = {location_id: set() for location_id in location_ids}
    for raw_edge in edges:
        if not isinstance(raw_edge, list) or len(raw_edge) != 2:
            raise ValueError("invalid Kronologic venue edge")
        left, right = raw_edge
        if left not in neighbors or right not in neighbors or left == right:
            raise ValueError("invalid Kronologic venue edge endpoint")
        key = tuple(sorted((left, right)))
        if key in edge_set:
            raise ValueError("duplicate Kronologic venue edge")
        edge_set.add(key)
        neighbors[left].add(right)
        neighbors[right].add(left)

    visited = set()
    stack = [location_ids[0]]
    while stack:
        current = stack.pop()
        if current in visited:
            continue
        visited.add(current)
        stack.extend(neighbors[current] - visited)
    if visited != set(location_ids):
        raise ValueError("Kronologic venue graph must be connected")

    case_ids = set()
    signatures = set()
    for case in cases:
        if not isinstance(case, dict):
            raise ValueError("invalid Kronologic case")
        case_id = case.get("case_id")
        if not isinstance(case_id, str) or not case_id or case_id in case_ids:
            raise ValueError("invalid or duplicate Kronologic case id")
        case_ids.add(case_id)
        if not isinstance(case.get("title"), str) or not case["title"].strip():
            raise ValueError("Kronologic case title is required")
        if not isinstance(case.get("story"), str) or not case["story"].strip():
            raise ValueError("Kronologic case story is required")
        if case.get("difficulty") not in (1, 2, 3):
            raise ValueError("invalid Kronologic case difficulty")
        anchor_id = case.get("anchor_character_id")
        if anchor_id not in character_ids:
            raise ValueError("invalid Kronologic anchor character")
        thresholds = case.get("solo_thresholds")
        if not isinstance(thresholds, dict):
            raise ValueError("Kronologic solo thresholds are required")
        gold_max = thresholds.get("gold_max")
        silver_max = thresholds.get("silver_max")
        if (
            isinstance(gold_max, bool)
            or not isinstance(gold_max, int)
            or isinstance(silver_max, bool)
            or not isinstance(silver_max, int)
            or gold_max < 1
            or silver_max <= gold_max
        ):
            raise ValueError("invalid Kronologic solo thresholds")

        paths = case.get("paths")
        if not isinstance(paths, dict) or set(paths) != set(character_ids):
            raise ValueError("Kronologic case must contain all character paths")
        signature_rows = []
        for character_id in character_ids:
            path = paths.get(character_id)
            if not isinstance(path, list) or len(path) != 6 or any(location_id not in location_ids for location_id in path):
                raise ValueError("invalid Kronologic character path")
            for left, right in zip(path, path[1:]):
                if left == right or right not in neighbors[left]:
                    raise ValueError("Kronologic characters must move along an edge every time")
            signature_rows.append(tuple(path))
        signature = tuple(signature_rows)
        if signature in signatures:
            raise ValueError("duplicate Kronologic case path signature")
        signatures.add(signature)
        if len(_meeting_solutions(case, character_ids)) != 1:
            raise ValueError("Kronologic case objective must have exactly one solution")


def _meeting_solutions(case: Dict, character_ids: Optional[Sequence[str]] = None) -> List[Dict]:
    paths = case.get("paths", {})
    if character_ids is None:
        character_ids = tuple(paths.keys())
    anchor_id = case.get("anchor_character_id")
    anchor_path = paths.get(anchor_id, [])
    results: List[Dict] = []
    for time_index in range(1, min(len(anchor_path), 6)):
        location_id = anchor_path[time_index]
        occupants = [
            character_id
            for character_id in character_ids
            if paths.get(character_id, [None] * 6)[time_index] == location_id
        ]
        if len(occupants) == 2 and anchor_id in occupants:
            results.append(
                {
                    "character_id": next(character_id for character_id in occupants if character_id != anchor_id),
                    "location_id": location_id,
                    "time": time_index + 1,
                }
            )
    return results


CATALOG = _load_catalog()
CHARACTERS: Tuple[Dict, ...] = tuple(copy.deepcopy(CATALOG["characters"]))
LOCATIONS: Tuple[Dict, ...] = tuple(copy.deepcopy(CATALOG["locations"]))
EDGES: Tuple[Tuple[str, str], ...] = tuple(tuple(edge) for edge in CATALOG["edges"])
CASES: Tuple[Dict, ...] = tuple(copy.deepcopy(CATALOG["cases"]))
CHARACTER_IDS: Tuple[str, ...] = tuple(item["id"] for item in CHARACTERS)
LOCATION_IDS: Tuple[str, ...] = tuple(item["id"] for item in LOCATIONS)
CHARACTER_LOOKUP = {item["id"]: item for item in CHARACTERS}
LOCATION_LOOKUP = {item["id"]: item for item in LOCATIONS}
CASE_LOOKUP = {item["case_id"]: item for item in CASES}
NEIGHBORS: Dict[str, Tuple[str, ...]] = {location_id: tuple() for location_id in LOCATION_IDS}
_neighbor_sets = {location_id: set() for location_id in LOCATION_IDS}
for _left, _right in EDGES:
    _neighbor_sets[_left].add(_right)
    _neighbor_sets[_right].add(_left)
NEIGHBORS = {location_id: tuple(sorted(values)) for location_id, values in _neighbor_sets.items()}


def _sorted_player_ids(player_meta: Dict[str, Dict], player_ids: Optional[Iterable[str]] = None) -> List[str]:
    ids = list(player_ids) if player_ids is not None else list(player_meta.keys())
    return sorted(ids, key=lambda player_id: (int(player_meta.get(player_id, {}).get("seat", 0)), player_id))


def _safe_config(config: Optional[Dict]) -> Dict:
    raw = config if isinstance(config, dict) else {}
    source = raw.get("case_source", "random")
    if source not in ("random", "preset"):
        raise ValueError("invalid Kronologic case source")

    raw_difficulty = raw.get("difficulty", "any")
    if isinstance(raw_difficulty, int) and not isinstance(raw_difficulty, bool):
        raw_difficulty = str(raw_difficulty)
    if raw_difficulty not in ("any", "1", "2", "3"):
        raise ValueError("invalid Kronologic difficulty")

    case_id = raw.get("case_id", CASES[0]["case_id"])
    if not isinstance(case_id, str) or case_id not in CASE_LOOKUP:
        raise ValueError("unknown Kronologic case")

    seed = raw.get("seed", "")
    if isinstance(seed, bool) or not isinstance(seed, (int, str)):
        raise ValueError("invalid Kronologic seed")
    if isinstance(seed, str) and len(seed) > 80:
        raise ValueError("Kronologic seed is too long")

    return {
        "case_source": source,
        "difficulty": raw_difficulty,
        "case_id": case_id,
        "seed": seed,
    }


def _case_solution(case: Dict) -> Dict:
    solutions = _meeting_solutions(case, CHARACTER_IDS)
    if len(solutions) != 1:
        raise ValueError("case has no unique solution")
    return dict(solutions[0])


def _choose_case(config: Dict, base_seed: object, game_index: int, previous_case_id: Optional[str] = None) -> Dict:
    if config.get("case_source") == "preset":
        return copy.deepcopy(CASE_LOOKUP[config["case_id"]])

    difficulty = config.get("difficulty", "any")
    choices = [case for case in CASES if difficulty == "any" or str(case["difficulty"]) == difficulty]
    if not choices:
        raise ValueError("no Kronologic cases match that difficulty")
    if len(choices) > 1 and previous_case_id:
        choices = [case for case in choices if case["case_id"] != previous_case_id] or choices
    choices = sorted(choices, key=lambda case: case["case_id"])
    rng = random.Random(f"{base_seed}:case:{game_index}")
    return copy.deepcopy(rng.choice(choices))


def _stable_pick(case_id: str, query_key: str, candidates: Sequence[object]) -> Optional[object]:
    if not candidates:
        return None
    digest = hashlib.sha256(f"{CATALOG_ID}|{case_id}|{query_key}".encode("utf-8")).digest()
    index = int.from_bytes(digest[:8], "big") % len(candidates)
    return list(candidates)[index]


def _query_response(case: Dict, query_type: str, location_id: str, selector: object) -> Dict:
    paths = case["paths"]
    case_id = case["case_id"]
    if query_type == "time":
        time = int(selector)
        occupants = sorted(
            character_id
            for character_id in CHARACTER_IDS
            if paths[character_id][time - 1] == location_id
        )
        count = len(occupants)
        private_value = None if count in (0, 6) else _stable_pick(case_id, f"time|{location_id}|{time}", occupants)
        return {
            "count": count,
            "private_character_id": private_value,
            "private_time": None,
            "bonus_turn": count in (0, 6),
        }

    character_id = str(selector)
    times = [index + 1 for index, value in enumerate(paths[character_id]) if value == location_id]
    count = len(times)
    private_value = None if count in (0, 6) else _stable_pick(case_id, f"character|{location_id}|{character_id}", times)
    return {
        "count": count,
        "private_character_id": None,
        "private_time": private_value,
        "bonus_turn": count in (0, 6),
    }


def _append_limited(items: List[Dict], value: Dict, limit: int) -> None:
    items.append(value)
    if len(items) > limit:
        del items[:-limit]


def _player_name(state: Dict, player_id: str) -> str:
    return str(state.get("player_meta", {}).get(player_id, {}).get("name") or player_id)


def _add_log(state: Dict, entry_type: str, message: str, **extra: object) -> None:
    entry = {
        "index": int(state.get("log_serial", 0)) + 1,
        "type": entry_type,
        "message": message,
    }
    state["log_serial"] = entry["index"]
    entry.update(extra)
    _append_limited(state.setdefault("public_log", []), entry, MAX_PUBLIC_LOG)


def _active_player_ids(state: Dict) -> List[str]:
    return [
        player_id
        for player_id in state.get("turn_order", [])
        if state.get("players", {}).get(player_id, {}).get("status") == "active"
    ]


def _next_active_player(state: Dict, after_player_id: str) -> Optional[str]:
    order = state.get("turn_order", [])
    active = set(_active_player_ids(state))
    if not order or not active:
        return None
    start_index = order.index(after_player_id) if after_player_id in order else -1
    for offset in range(1, len(order) + 1):
        candidate = order[(start_index + offset) % len(order)]
        if candidate in active:
            return candidate
    return None


def _initial_notes(case: Dict) -> Dict:
    marks: Dict[str, str] = {}
    for character_id in CHARACTER_IDS:
        start_location = case["paths"][character_id][0]
        for location_id in LOCATION_IDS:
            mark = "confirmed" if location_id == start_location else "excluded"
            marks[f"1|{location_id}|{character_id}"] = mark
    return {"marks": marks, "counts": {}}


def _select_first_player(state: Dict) -> str:
    order = state["turn_order"]
    rng = random.Random(f"{state['base_seed']}:first:{state['game_index']}:{state['case']['case_id']}")
    return rng.choice(order)


def _bot_ids(state: Dict, player_ids: Iterable[str]) -> List[str]:
    return [
        player_id
        for player_id in player_ids
        if bool(state.get("player_meta", {}).get(player_id, {}).get("is_bot"))
    ]


def _start_case(state: Dict, previous_case_id: Optional[str] = None) -> None:
    case = _choose_case(state["config"], state["base_seed"], int(state["game_index"]), previous_case_id)
    state["catalog_id"] = CATALOG_ID
    state["case"] = case
    state["phase"] = "investigation"
    state["active_player_id"] = None
    state["pending_next_player_id"] = None
    state["bonus_turn"] = False
    state["review_ready"] = []
    state["public_clues"] = []
    state["question_serial"] = 0
    state["turn_number"] = 1
    state["accusation"] = None
    state["winner_ids"] = []
    state["game_over"] = False
    state["solo_rating"] = None
    state["rematch_ready"] = []
    state["public_log"] = []
    state["log_serial"] = 0

    for player_id in state["turn_order"]:
        state["players"][player_id] = {
            "status": "active",
            "private_clues": [],
            "notes": _initial_notes(case),
            "question_count": 0,
            "last_accusation_correct": None,
        }

    state["active_player_id"] = _select_first_player(state)
    _add_log(
        state,
        "case_started",
        f"{case['title']} began. {_player_name(state, state['active_player_id'])} investigates first.",
        case_id=case["case_id"],
        active_player_id=state["active_player_id"],
    )


def _public_case(case: Dict) -> Dict:
    return {
        "case_id": case["case_id"],
        "title": case["title"],
        "story": case["story"],
        "difficulty": int(case["difficulty"]),
        "anchor_character_id": case["anchor_character_id"],
        "solo_thresholds": copy.deepcopy(case["solo_thresholds"]),
        "starting_positions": {
            character_id: case["paths"][character_id][0]
            for character_id in CHARACTER_IDS
        },
    }


def _normalize_answer(action: Dict) -> Tuple[Optional[Dict], Optional[str]]:
    character_id = action.get("character_id")
    location_id = action.get("location_id")
    time = action.get("time")
    if character_id not in CHARACTER_IDS:
        return None, "invalid character"
    if location_id not in LOCATION_IDS:
        return None, "invalid location"
    if isinstance(time, bool) or not isinstance(time, int) or not 1 <= time <= 6:
        return None, "invalid time"
    return {"character_id": character_id, "location_id": location_id, "time": time}, None


def _review_required_ids(state: Dict) -> List[str]:
    return _active_player_ids(state)


def _advance_review_if_ready(state: Dict) -> bool:
    required = set(_review_required_ids(state))
    ready = set(state.get("review_ready", []))
    if not required.issubset(ready):
        return False
    next_player = state.get("pending_next_player_id")
    if next_player not in required:
        basis = state.get("active_player_id") or (state.get("turn_order") or [""])[0]
        next_player = _next_active_player(state, basis)
    state["active_player_id"] = next_player
    state["pending_next_player_id"] = None
    state["review_ready"] = []
    state["bonus_turn"] = False
    state["accusation"] = None
    state["phase"] = "investigation"
    state["turn_number"] = int(state.get("turn_number", 1)) + 1
    return True


def _solo_rating(state: Dict, player_id: str) -> str:
    count = int(state["players"][player_id].get("question_count", 0))
    thresholds = state["case"]["solo_thresholds"]
    if count <= int(thresholds["gold_max"]):
        return "gold"
    if count <= int(thresholds["silver_max"]):
        return "silver"
    return "bronze"


def _finish_game(state: Dict, winner_ids: List[str], failed: bool = False) -> None:
    state["winner_ids"] = list(winner_ids)
    state["game_over"] = True
    state["phase"] = "case_result"
    state["active_player_id"] = None
    state["pending_next_player_id"] = None
    state["review_ready"] = []
    state["bonus_turn"] = False
    state["rematch_ready"] = _bot_ids(state, state.get("turn_order", []))
    if len(state.get("turn_order", [])) == 1 and winner_ids:
        state["solo_rating"] = _solo_rating(state, winner_ids[0])
    if winner_ids:
        names = ", ".join(_player_name(state, player_id) for player_id in winner_ids)
        _add_log(state, "case_solved", f"Case solved by {names}.", winner_ids=list(winner_ids))
    elif failed:
        _add_log(state, "case_failed", "Every investigator was eliminated. The case is lost.")


def _resolve_accusation_if_complete(state: Dict) -> Tuple[List[Dict], bool]:
    accusation = state.get("accusation")
    if not isinstance(accusation, dict):
        return [], False
    required = set(_active_player_ids(state))
    responses = accusation.get("responses", {})
    if not required.issubset(set(responses)):
        return [], False

    solution = _case_solution(state["case"])
    correct_ids: List[str] = []
    submitted_ids: List[str] = []
    declined_ids: List[str] = []
    for player_id in state.get("turn_order", []):
        response = responses.get(player_id)
        if response is None:
            continue
        if response == "declined":
            declined_ids.append(player_id)
            continue
        submitted_ids.append(player_id)
        is_correct = response == solution
        state["players"][player_id]["last_accusation_correct"] = is_correct
        if is_correct:
            correct_ids.append(player_id)

    events: List[Dict] = []
    if correct_ids:
        for player_id in correct_ids:
            state["players"][player_id]["status"] = "winner"
        for player_id in submitted_ids:
            if player_id not in correct_ids:
                state["players"][player_id]["status"] = "eliminated"
        _finish_game(state, correct_ids)
        events.append({"type": "kronologic:case_solved", "payload": {"winner_ids": list(correct_ids)}})
        return events, True

    for player_id in submitted_ids:
        state["players"][player_id]["status"] = "eliminated"
        _add_log(
            state,
            "player_eliminated",
            f"{_player_name(state, player_id)} submitted an incorrect theory and was eliminated.",
            player_id=player_id,
        )
    survivors = _active_player_ids(state)
    events.append(
        {
            "type": "kronologic:accusation_resolved",
            "payload": {"eliminated_ids": list(submitted_ids), "case_continues": bool(survivors)},
        }
    )
    if not survivors:
        _finish_game(state, [], failed=True)
        events.append({"type": "kronologic:case_failed", "payload": {}})
        return events, True

    initiator_id = accusation["initiator_id"]
    next_player = _next_active_player(state, initiator_id)
    state["phase"] = "accusation_review"
    state["pending_next_player_id"] = next_player
    state["review_ready"] = _bot_ids(state, survivors)
    _advance_review_if_ready(state)
    return events, True


def _all_paths_from(start_location: str) -> List[Tuple[str, ...]]:
    paths: List[Tuple[str, ...]] = []

    def walk(current: List[str]) -> None:
        if len(current) == 6:
            paths.append(tuple(current))
            return
        for location_id in NEIGHBORS[current[-1]]:
            current.append(location_id)
            walk(current)
            current.pop()

    walk([start_location])
    return paths


PATH_CACHE: Dict[str, Tuple[Tuple[str, ...], ...]] = {
    location_id: tuple(_all_paths_from(location_id))
    for location_id in LOCATION_IDS
}


def _visible_candidate_paths(state: Dict, viewer_id: str, character_id: str) -> List[Tuple[str, ...]]:
    start = state["case"]["paths"][character_id][0]
    candidates = list(PATH_CACHE[start])
    public_clues = state.get("public_clues", [])
    private_clues = state.get("players", {}).get(viewer_id, {}).get("private_clues", [])

    for clue in public_clues:
        query_type = clue.get("query_type")
        location_id = clue.get("location_id")
        count = int(clue.get("count", 0))
        if query_type == "character" and clue.get("character_id") == character_id:
            candidates = [path for path in candidates if sum(1 for value in path if value == location_id) == count]
        elif query_type == "time" and count in (0, 6):
            time_index = int(clue["time"]) - 1
            if count == 0:
                candidates = [path for path in candidates if path[time_index] != location_id]
            else:
                candidates = [path for path in candidates if path[time_index] == location_id]

    for clue in private_clues:
        location_id = clue.get("location_id")
        if clue.get("query_type") == "time" and clue.get("private_character_id") == character_id:
            time_index = int(clue["time"]) - 1
            candidates = [path for path in candidates if path[time_index] == location_id]
        elif clue.get("query_type") == "character" and clue.get("character_id") == character_id:
            private_time = clue.get("private_time")
            if isinstance(private_time, int):
                candidates = [path for path in candidates if path[private_time - 1] == location_id]
    return candidates


def _visible_meeting_cell(state: Dict, viewer_id: str) -> Optional[Tuple[str, int]]:
    anchor_id = state["case"]["anchor_character_id"]
    anchor_candidates = _visible_candidate_paths(state, viewer_id, anchor_id)
    if not anchor_candidates:
        return None
    route: List[str] = []
    for time_index in range(6):
        positions = {path[time_index] for path in anchor_candidates}
        if len(positions) != 1:
            return None
        route.append(next(iter(positions)))

    public_counts = {
        (clue.get("location_id"), clue.get("time")): int(clue.get("count", 0))
        for clue in state.get("public_clues", [])
        if clue.get("query_type") == "time"
    }
    meeting_cells: List[Tuple[str, int]] = []
    for time in range(2, 7):
        key = (route[time - 1], time)
        if key not in public_counts:
            return None
        if public_counts[key] == 2:
            meeting_cells.append(key)
    if len(meeting_cells) != 1:
        return None
    return meeting_cells[0]


def _visible_answer(state: Dict, viewer_id: str) -> Optional[Dict]:
    anchor_id = state["case"]["anchor_character_id"]
    meeting_cell = _visible_meeting_cell(state, viewer_id)
    if meeting_cell is None:
        return None
    location_id, time = meeting_cell
    candidates_by_character = {
        character_id: _visible_candidate_paths(state, viewer_id, character_id)
        for character_id in CHARACTER_IDS
    }

    for clue in state.get("players", {}).get(viewer_id, {}).get("private_clues", []):
        if clue.get("query_type") == "time" and clue.get("location_id") == location_id and clue.get("time") == time:
            private_character_id = clue.get("private_character_id")
            if private_character_id in CHARACTER_IDS and private_character_id != anchor_id:
                return {"character_id": private_character_id, "location_id": location_id, "time": time}

    possible_partners: List[str] = []
    for character_id in CHARACTER_IDS:
        if character_id == anchor_id:
            continue
        paths = candidates_by_character[character_id]
        if paths and all(path[time - 1] == location_id for path in paths):
            possible_partners.append(character_id)
    if len(possible_partners) == 1:
        return {"character_id": possible_partners[0], "location_id": location_id, "time": time}
    return None


def _asked_query_keys(state: Dict, player_id: str) -> set:
    keys = set()
    for clue in state.get("public_clues", []):
        if clue.get("asked_by") != player_id:
            continue
        if clue.get("query_type") == "time":
            keys.add(("time", clue.get("location_id"), int(clue.get("time", 0))))
        else:
            keys.add(("character", clue.get("location_id"), clue.get("character_id")))
    return keys


def _bot_query(state: Dict, bot_id: str) -> Optional[Dict]:
    asked = _asked_query_keys(state, bot_id)
    anchor_id = state["case"]["anchor_character_id"]

    for location_id in LOCATION_IDS:
        key = ("character", location_id, anchor_id)
        if key not in asked:
            return {"type": "ask", "query_type": "character", "location_id": location_id, "character_id": anchor_id}

    anchor_paths = _visible_candidate_paths(state, bot_id, anchor_id)
    for time in range(2, 7):
        possible_locations = sorted({path[time - 1] for path in anchor_paths})
        for location_id in possible_locations:
            key = ("time", location_id, time)
            if key not in asked:
                return {"type": "ask", "query_type": "time", "location_id": location_id, "time": time}

    meeting_cell = _visible_meeting_cell(state, bot_id)
    if meeting_cell is not None:
        meeting_location, _meeting_time = meeting_cell
        for character_id in CHARACTER_IDS:
            if character_id == anchor_id:
                continue
            key = ("character", meeting_location, character_id)
            if key not in asked:
                return {
                    "type": "ask",
                    "query_type": "character",
                    "location_id": meeting_location,
                    "character_id": character_id,
                }

    for time in range(1, 7):
        for location_id in LOCATION_IDS:
            key = ("time", location_id, time)
            if key not in asked:
                return {"type": "ask", "query_type": "time", "location_id": location_id, "time": time}

    for character_id in CHARACTER_IDS:
        for location_id in LOCATION_IDS:
            key = ("character", location_id, character_id)
            if key not in asked:
                return {
                    "type": "ask",
                    "query_type": "character",
                    "location_id": location_id,
                    "character_id": character_id,
                }
    return None


class KronologicGame:
    game_id = "kronologic"
    min_players = 1
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not (KronologicGame.min_players <= len(players) <= KronologicGame.max_players):
            raise ValueError("Kronologic requires 1 to 4 players")
        player_meta = {player["player_id"]: dict(player) for player in players}
        if len(player_meta) != len(players):
            raise ValueError("duplicate Kronologic player id")
        turn_order = _sorted_player_ids(player_meta)
        clean_config = _safe_config(config)
        supplied_seed = clean_config.get("seed", "")
        base_seed = supplied_seed if supplied_seed != "" else secrets.token_hex(16)
        state = {
            "version": 1,
            "catalog_id": CATALOG_ID,
            "config": clean_config,
            "base_seed": base_seed,
            "game_index": 1,
            "turn_order": turn_order,
            "player_meta": player_meta,
            "players": {player_id: {} for player_id in turn_order},
        }
        _start_case(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        pdata = state["players"][player_id]
        if phase == "investigation":
            if pdata.get("status") == "active" and player_id == state.get("active_player_id"):
                return ["ask", "start_accusation"]
            return []
        if phase in ("clue_review", "accusation_review"):
            if pdata.get("status") == "active" and player_id not in state.get("review_ready", []):
                return ["ready_next_turn"]
            return []
        if phase == "accusation_collect":
            accusation = state.get("accusation") or {}
            if pdata.get("status") != "active" or player_id in accusation.get("responses", {}):
                return []
            return ["join_accusation", "decline_accusation"]
        if phase == "case_result" and player_id not in state.get("rematch_ready", []):
            return ["play_again"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"
        action_type = action.get("type")

        if action_type == "set_note_mark":
            if state.get("game_over"):
                return [], "game is over"
            time = action.get("time")
            location_id = action.get("location_id")
            character_id = action.get("character_id")
            mark = action.get("mark")
            if isinstance(time, bool) or not isinstance(time, int) or not 1 <= time <= 6:
                return [], "invalid time"
            if location_id not in LOCATION_IDS or character_id not in CHARACTER_IDS or mark not in NOTE_MARKS:
                return [], "invalid note mark"
            key = f"{time}|{location_id}|{character_id}"
            marks = state["players"][player_id].setdefault("notes", {}).setdefault("marks", {})
            if mark == "unknown":
                marks.pop(key, None)
            else:
                marks[key] = mark
            return [], None

        if action_type == "set_note_count":
            if state.get("game_over"):
                return [], "game is over"
            query_type = action.get("query_type")
            location_id = action.get("location_id")
            count = action.get("count")
            if query_type not in ("time", "character") or location_id not in LOCATION_IDS:
                return [], "invalid note count"
            if count is not None and (isinstance(count, bool) or not isinstance(count, int) or not 0 <= count <= 6):
                return [], "invalid note count"
            if query_type == "time":
                selector = action.get("time")
                if isinstance(selector, bool) or not isinstance(selector, int) or not 1 <= selector <= 6:
                    return [], "invalid time"
            else:
                selector = action.get("character_id")
                if selector not in CHARACTER_IDS:
                    return [], "invalid character"
            key = f"{query_type}|{location_id}|{selector}"
            counts = state["players"][player_id].setdefault("notes", {}).setdefault("counts", {})
            if count is None:
                counts.pop(key, None)
            else:
                counts[key] = count
            return [], None

        phase = state.get("phase")
        legal = KronologicGame.get_legal_actions(state, player_id)
        if action_type not in legal:
            if phase == "investigation" and player_id != state.get("active_player_id"):
                return [], "not your turn"
            return [], "action is not legal now"

        if action_type == "ask":
            query_type = action.get("query_type")
            location_id = action.get("location_id")
            if query_type not in ("time", "character"):
                return [], "invalid query type"
            if location_id not in LOCATION_IDS:
                return [], "invalid location"
            if query_type == "time":
                time = action.get("time")
                if isinstance(time, bool) or not isinstance(time, int) or not 1 <= time <= 6:
                    return [], "invalid time"
                if action.get("character_id") is not None:
                    return [], "time query cannot include a character"
                selector = time
                character_id = None
            else:
                character_id = action.get("character_id")
                if character_id not in CHARACTER_IDS:
                    return [], "invalid character"
                if action.get("time") is not None:
                    return [], "character query cannot include a time"
                selector = character_id
                time = None

            response = _query_response(state["case"], query_type, location_id, selector)
            state["question_serial"] = int(state.get("question_serial", 0)) + 1
            clue_id = f"q{state['question_serial']}"
            public_clue = {
                "clue_id": clue_id,
                "turn_number": int(state.get("turn_number", 1)),
                "asked_by": player_id,
                "query_type": query_type,
                "location_id": location_id,
                "time": time,
                "character_id": character_id,
                "count": int(response["count"]),
                "bonus_turn": bool(response["bonus_turn"]),
            }
            _append_limited(state.setdefault("public_clues", []), public_clue, MAX_PUBLIC_CLUES)
            private_clue = {
                "clue_id": clue_id,
                "query_type": query_type,
                "location_id": location_id,
                "time": time,
                "character_id": character_id,
                "private_character_id": response["private_character_id"],
                "private_time": response["private_time"],
            }
            _append_limited(state["players"][player_id].setdefault("private_clues", []), private_clue, MAX_PRIVATE_CLUES)
            state["players"][player_id]["question_count"] = int(state["players"][player_id].get("question_count", 0)) + 1

            location_name = LOCATION_LOOKUP[location_id]["name"]
            if query_type == "time":
                message = f"{_player_name(state, player_id)} learned that {response['count']} people were in {location_name} at Time {time}."
            else:
                character_name = CHARACTER_LOOKUP[character_id]["name"]
                message = f"{_player_name(state, player_id)} learned that {character_name} visited {location_name} {response['count']} times."
            _add_log(state, "question", message, clue_id=clue_id, player_id=player_id)

            state["phase"] = "clue_review"
            state["bonus_turn"] = bool(response["bonus_turn"])
            next_player = player_id if response["bonus_turn"] else _next_active_player(state, player_id)
            state["pending_next_player_id"] = next_player
            state["review_ready"] = _bot_ids(state, _active_player_ids(state))
            advanced = _advance_review_if_ready(state)
            events = [
                {
                    "type": "kronologic:public_clue",
                    "payload": {
                        "clue_id": clue_id,
                        "asked_by": player_id,
                        "query_type": query_type,
                        "location_id": location_id,
                        "time": time,
                        "character_id": character_id,
                        "count": int(response["count"]),
                        "bonus_turn": bool(response["bonus_turn"]),
                    },
                }
            ]
            if advanced:
                events.append({"type": "kronologic:turn_started", "payload": {"player_id": state.get("active_player_id")}})
            return events, None

        if action_type == "ready_next_turn":
            ready = state.setdefault("review_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events = [{"type": "kronologic:ready", "payload": {"player_id": player_id}}]
            if _advance_review_if_ready(state):
                events.append({"type": "kronologic:turn_started", "payload": {"player_id": state.get("active_player_id")}})
            return events, None

        if action_type == "start_accusation":
            answer, error = _normalize_answer(action)
            if error:
                return [], error
            state["accusation"] = {
                "initiator_id": player_id,
                "responses": {player_id: answer},
            }
            state["phase"] = "accusation_collect"
            _add_log(
                state,
                "accusation_started",
                f"{_player_name(state, player_id)} asked everyone to lock in a theory.",
                player_id=player_id,
            )
            events = [{"type": "kronologic:accusation_started", "payload": {"initiator_id": player_id}}]
            resolved_events, _ = _resolve_accusation_if_complete(state)
            events.extend(resolved_events)
            return events, None

        if action_type == "join_accusation":
            answer, error = _normalize_answer(action)
            if error:
                return [], error
            state["accusation"]["responses"][player_id] = answer
            events = [{"type": "kronologic:accusation_response", "payload": {"player_id": player_id}}]
            resolved_events, _ = _resolve_accusation_if_complete(state)
            events.extend(resolved_events)
            return events, None

        if action_type == "decline_accusation":
            if player_id == state["accusation"].get("initiator_id"):
                return [], "the initiator cannot decline"
            state["accusation"]["responses"][player_id] = "declined"
            events = [{"type": "kronologic:accusation_response", "payload": {"player_id": player_id}}]
            resolved_events, _ = _resolve_accusation_if_complete(state)
            events.extend(resolved_events)
            return events, None

        if action_type == "play_again":
            ready = state.setdefault("rematch_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events = [{"type": "kronologic:rematch_ready", "payload": {"player_id": player_id}}]
            if set(state.get("turn_order", [])).issubset(set(ready)):
                previous_case_id = state.get("case", {}).get("case_id")
                state["game_index"] = int(state.get("game_index", 1)) + 1
                _start_case(state, previous_case_id=previous_case_id)
                events.append(
                    {
                        "type": "kronologic:case_started",
                        "payload": {
                            "case_id": state["case"]["case_id"],
                            "active_player_id": state["active_player_id"],
                        },
                    }
                )
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        case = state["case"]
        players_view: List[Dict] = []
        accusation = state.get("accusation") if isinstance(state.get("accusation"), dict) else None
        accusation_responses = accusation.get("responses", {}) if accusation else {}
        for player_id in state.get("turn_order", []):
            pdata = state["players"][player_id]
            meta = state.get("player_meta", {}).get(player_id, {})
            players_view.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "status": pdata.get("status"),
                    "question_count": int(pdata.get("question_count", 0)),
                    "review_ready": player_id in state.get("review_ready", []),
                    "accusation_responded": player_id in accusation_responses,
                    "rematch_ready": player_id in state.get("rematch_ready", []),
                }
            )

        your_data = state.get("players", {}).get(viewer_id, {})
        your_response = accusation_responses.get(viewer_id) if accusation else None
        if your_response == "declined":
            your_response_view: object = "declined"
        elif isinstance(your_response, dict):
            your_response_view = copy.deepcopy(your_response)
        else:
            your_response_view = None

        solution_view = None
        if state.get("game_over"):
            solution_view = {
                "answer": _case_solution(case),
                "paths": copy.deepcopy(case["paths"]),
            }

        return {
            "game_id": KronologicGame.game_id,
            "you": viewer_id,
            "catalog_id": CATALOG_ID,
            "content_notice": CATALOG.get("content_notice"),
            "case": _public_case(case),
            "characters": copy.deepcopy(list(CHARACTERS)),
            "locations": copy.deepcopy(list(LOCATIONS)),
            "edges": [list(edge) for edge in EDGES],
            "phase": state.get("phase"),
            "active_player_id": state.get("active_player_id"),
            "pending_next_player_id": state.get("pending_next_player_id"),
            "turn_number": int(state.get("turn_number", 1)),
            "bonus_turn": bool(state.get("bonus_turn")),
            "review_ready": list(state.get("review_ready", [])),
            "players": players_view,
            "public_clues": copy.deepcopy(state.get("public_clues", [])),
            "your_private_clues": copy.deepcopy(your_data.get("private_clues", [])),
            "your_notes": copy.deepcopy(your_data.get("notes", {"marks": {}, "counts": {}})),
            "your_last_accusation_correct": your_data.get("last_accusation_correct"),
            "your_accusation_response": your_response_view,
            "accusation": (
                {
                    "initiator_id": accusation.get("initiator_id"),
                    "responded_ids": [player_id for player_id in state.get("turn_order", []) if player_id in accusation_responses],
                    "waiting_ids": [player_id for player_id in _active_player_ids(state) if player_id not in accusation_responses],
                }
                if accusation
                else None
            ),
            "public_log": copy.deepcopy(state.get("public_log", [])),
            "winner_ids": list(state.get("winner_ids", [])),
            "solo_rating": state.get("solo_rating"),
            "solution": solution_view,
            "game_over": bool(state.get("game_over")),
            "can_edit_notes": not bool(state.get("game_over")),
            "legal_actions": KronologicGame.get_legal_actions(state, viewer_id),
            "rematch_ready": list(state.get("rematch_ready", [])),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if bot_id not in state.get("players", {}):
            return None
        legal = KronologicGame.get_legal_actions(state, bot_id)
        if "join_accusation" in legal or "decline_accusation" in legal:
            answer = _visible_answer(state, bot_id)
            if answer is not None:
                return {"type": "join_accusation", **answer, "delay_ms": 250}
            return {"type": "decline_accusation", "delay_ms": 200}
        if "ready_next_turn" in legal:
            return {"type": "ready_next_turn", "delay_ms": 120}
        if "ask" not in legal:
            return None
        answer = _visible_answer(state, bot_id)
        if answer is not None:
            return {"type": "start_accusation", **answer, "delay_ms": 300}
        query = _bot_query(state, bot_id)
        if query is None:
            return None
        query["delay_ms"] = 300
        return query

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict):
            raise ValueError("invalid Kronologic save")
        if payload.get("version") != 1 or payload.get("catalog_id") != CATALOG_ID:
            raise ValueError("unsupported Kronologic save version")
        phase = payload.get("phase")
        if phase not in PHASES:
            raise ValueError("invalid Kronologic save phase")
        case = payload.get("case")
        if not isinstance(case, dict) or case.get("case_id") not in CASE_LOOKUP:
            raise ValueError("unknown Kronologic saved case")
        canonical_case = CASE_LOOKUP[case["case_id"]]
        if case.get("paths") != canonical_case.get("paths"):
            raise ValueError("Kronologic saved case data does not match the catalog")
        turn_order = payload.get("turn_order")
        players = payload.get("players")
        if not isinstance(turn_order, list) or not isinstance(players, dict) or set(turn_order) != set(players):
            raise ValueError("invalid Kronologic saved players")
        result = copy.deepcopy(payload)
        result["case"] = copy.deepcopy(canonical_case)
        return result
