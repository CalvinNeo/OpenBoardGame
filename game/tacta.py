import copy
import itertools
import json
import math
import random
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


Point = Tuple[float, float]
Matrix = Tuple[float, float, float, float, float, float]

COLORS = ["blue", "green", "orange", "pink", "purple", "red"]
COLOR_SYMBOLS = {
    "blue": "◆",
    "green": "✚",
    "orange": "║",
    "pink": "●",
    "purple": "▲",
    "red": "×",
}
SUITS = ["circle", "square", "triangle"]
FACES = ["front", "back"]
AREA_EPSILON = 0.08
POINT_EPSILON = 0.02
WORLD_LIMIT = 20000.0


def _load_catalog() -> Dict:
    path = Path(__file__).with_name("assets") / "tacta_cards.json"
    with path.open("r", encoding="utf-8") as handle:
        catalog = json.load(handle)
    _validate_catalog(catalog)
    return catalog


def _validate_catalog(catalog: Dict) -> None:
    templates = catalog.get("templates", [])
    slots = catalog.get("slots", {})
    if len(templates) != 18:
        raise ValueError("TACTA catalog must contain exactly 18 card templates")
    ids = [item.get("template_id") for item in templates]
    if len(set(ids)) != len(ids):
        raise ValueError("TACTA template ids must be unique")
    expected = {(suit, value) for suit in ("circle", "square", "triangle") for value in range(1, 7)}
    actual = {(item.get("suit"), item.get("value")) for item in templates}
    if actual != expected:
        raise ValueError("TACTA catalog must contain values 1-6 in all three suits")
    for template in templates + [catalog.get("starting_card", {})]:
        connectors = template.get("connectors", [])
        if not connectors:
            raise ValueError(f"TACTA template has no connectors: {template.get('template_id')}")
        total = 0
        for connector in connectors:
            slot = slots.get(connector.get("slot"))
            if not slot:
                raise ValueError(f"TACTA template references an unknown slot: {connector.get('slot')}")
            dots = connector.get("dots")
            if not isinstance(dots, int) or dots < 0 or dots > len(slot.get("dot_positions", [])):
                raise ValueError("TACTA connector dot count is outside its slot capacity")
            total += dots
        if template.get("template_id") != "start" and total != template.get("value"):
            raise ValueError(f"TACTA printed value does not match dots: {template.get('template_id')}")


CATALOG = _load_catalog()
CARD_WIDTH = float(CATALOG["card_size"]["width"])
CARD_HEIGHT = float(CATALOG["card_size"]["height"])
TEMPLATES = {item["template_id"]: item for item in CATALOG["templates"]}
TEMPLATES["start"] = CATALOG["starting_card"]


def _round_number(value: float) -> float:
    rounded = round(float(value), 6)
    return 0.0 if abs(rounded) < 0.0000005 else rounded


def _matrix_list(matrix: Matrix) -> List[float]:
    return [_round_number(value) for value in matrix]


def _apply_matrix(matrix: Sequence[float], point: Sequence[float]) -> Point:
    a, b, c, d, tx, ty = matrix
    x, y = point
    return (a * x + c * y + tx, b * x + d * y + ty)


def _face_point(point: Sequence[float], face: str) -> Point:
    x, y = point
    return (CARD_WIDTH - float(x), float(y)) if face == "back" else (float(x), float(y))


def _signed_area(polygon: Sequence[Point]) -> float:
    return 0.5 * sum(
        polygon[index][0] * polygon[(index + 1) % len(polygon)][1]
        - polygon[(index + 1) % len(polygon)][0] * polygon[index][1]
        for index in range(len(polygon))
    )


def _polygon_area(polygon: Sequence[Point]) -> float:
    return abs(_signed_area(polygon))


def _line_intersection(start: Point, end: Point, clip_start: Point, clip_end: Point) -> Point:
    sx, sy = start
    ex, ey = end
    ax, ay = clip_start
    bx, by = clip_end
    dx1, dy1 = ex - sx, ey - sy
    dx2, dy2 = bx - ax, by - ay
    denominator = dx1 * dy2 - dy1 * dx2
    if abs(denominator) < 1e-12:
        return end
    t = ((ax - sx) * dy2 - (ay - sy) * dx2) / denominator
    return (sx + t * dx1, sy + t * dy1)


def _intersection_polygon(subject: Sequence[Point], clip: Sequence[Point]) -> List[Point]:
    output = list(subject)
    clip_points = list(clip)
    if len(output) < 3 or len(clip_points) < 3:
        return []
    if _signed_area(clip_points) < 0:
        clip_points.reverse()
    for index, clip_start in enumerate(clip_points):
        clip_end = clip_points[(index + 1) % len(clip_points)]
        source = output
        output = []
        if not source:
            break

        def inside(point: Point) -> bool:
            return (
                (clip_end[0] - clip_start[0]) * (point[1] - clip_start[1])
                - (clip_end[1] - clip_start[1]) * (point[0] - clip_start[0])
            ) >= -1e-7

        previous = source[-1]
        previous_inside = inside(previous)
        for current in source:
            current_inside = inside(current)
            if current_inside:
                if not previous_inside:
                    output.append(_line_intersection(previous, current, clip_start, clip_end))
                output.append(current)
            elif previous_inside:
                output.append(_line_intersection(previous, current, clip_start, clip_end))
            previous = current
            previous_inside = current_inside
    return output


def _intersection_area(first: Sequence[Point], second: Sequence[Point]) -> float:
    return _polygon_area(_intersection_polygon(first, second))


def _card_polygon(matrix: Sequence[float]) -> List[Point]:
    return [
        _apply_matrix(matrix, point)
        for point in [(0.0, 0.0), (CARD_WIDTH, 0.0), (CARD_WIDTH, CARD_HEIGHT), (0.0, CARD_HEIGHT)]
    ]


def _template_connectors(template_id: str, face: str = "front") -> List[Dict]:
    template = TEMPLATES[template_id]
    connectors = []
    for index, spec in enumerate(template["connectors"]):
        slot = CATALOG["slots"][spec["slot"]]
        connectors.append(
            {
                "connector_id": f"c{index}",
                "slot": spec["slot"],
                "shape_id": slot["shape_id"],
                "dots": int(spec["dots"]),
                "polygon": [_face_point(point, face) for point in slot["polygon"]],
                "dot_positions": [
                    _face_point(point, face) for point in slot["dot_positions"][: int(spec["dots"])]
                ],
            }
        )
    return connectors


def _connector(template_id: str, connector_id: str, face: str = "front") -> Optional[Dict]:
    return next(
        (item for item in _template_connectors(template_id, face) if item["connector_id"] == connector_id),
        None,
    )


def _world_connector(card: Dict, connector_id: str) -> Optional[Dict]:
    connector = _connector(card["template_id"], connector_id, card.get("face", "front"))
    if not connector:
        return None
    result = dict(connector)
    result["polygon"] = [_apply_matrix(card["matrix"], point) for point in connector["polygon"]]
    result["dot_positions"] = [_apply_matrix(card["matrix"], point) for point in connector["dot_positions"]]
    return result


def _point_distance(first: Point, second: Point) -> float:
    return math.hypot(first[0] - second[0], first[1] - second[1])


def _matching_matrices(source_polygon: Sequence[Point], target_polygon: Sequence[Point]) -> List[Matrix]:
    if len(source_polygon) != len(target_polygon) or len(source_polygon) < 2:
        return []
    source = list(source_polygon)
    target = list(target_polygon)
    source_edge = (source[1][0] - source[0][0], source[1][1] - source[0][1])
    source_length = math.hypot(*source_edge)
    if source_length < POINT_EPSILON:
        return []
    results: Dict[Tuple[float, ...], Matrix] = {}
    for permutation in itertools.permutations(target):
        target_edge = (permutation[1][0] - permutation[0][0], permutation[1][1] - permutation[0][1])
        target_length = math.hypot(*target_edge)
        if abs(source_length - target_length) > POINT_EPSILON:
            continue
        dot = source_edge[0] * target_edge[0] + source_edge[1] * target_edge[1]
        cross = source_edge[0] * target_edge[1] - source_edge[1] * target_edge[0]
        cosine = dot / (source_length * target_length)
        sine = cross / (source_length * target_length)
        matrix: Matrix = (
            cosine,
            sine,
            -sine,
            cosine,
            permutation[0][0] - cosine * source[0][0] + sine * source[0][1],
            permutation[0][1] - sine * source[0][0] - cosine * source[0][1],
        )
        if all(_point_distance(_apply_matrix(matrix, source[index]), permutation[index]) <= POINT_EPSILON for index in range(len(source))):
            key = tuple(_round_number(value) for value in matrix)
            results[key] = matrix
    return [results[key] for key in sorted(results)]


def _placed_lookup(state: Dict) -> Dict[str, Dict]:
    return {card["card_id"]: card for card in state.get("placed_cards", [])}


def _placement_is_valid(state: Dict, matrix: Matrix, target_card_id: str, target_connector: Dict) -> bool:
    candidate_polygon = _card_polygon(matrix)
    if any(abs(coordinate) > WORLD_LIMIT for point in candidate_polygon for coordinate in point):
        return False
    connector_area = _polygon_area(target_connector["polygon"])
    target_found = False
    allowed_ancestors = set()
    lookup = _placed_lookup(state)
    target_card = lookup.get(target_card_id)
    if target_card and target_connector.get("connector_id") == target_card.get("source_connector_id"):
        ancestor_id = target_card.get("parent_card_id")
        while ancestor_id and ancestor_id not in allowed_ancestors:
            allowed_ancestors.add(ancestor_id)
            ancestor = lookup.get(ancestor_id)
            ancestor_id = ancestor.get("parent_card_id") if ancestor else None
    for placed in state.get("placed_cards", []):
        overlap = _intersection_area(candidate_polygon, _card_polygon(placed["matrix"]))
        if placed["card_id"] == target_card_id:
            target_found = True
            # The printed connector must be completely covered.  Rectangular
            # cards also overlap in the blank area around that connector; a
            # complete card-on-card overlap is never a legal placement.
            if overlap < connector_area - AREA_EPSILON or overlap >= CARD_WIDTH * CARD_HEIGHT - AREA_EPSILON:
                return False
        elif overlap > AREA_EPSILON and placed["card_id"] not in allowed_ancestors:
            return False
    return target_found


def _outer_cards(state: Dict, player_id: str) -> List[Tuple[str, Dict]]:
    deck = state.get("players", {}).get(player_id, {}).get("deck", [])
    if not deck:
        return []
    cards = [("top", deck[0])]
    if len(deck) > 1:
        cards.append(("bottom", deck[-1]))
    return cards


def _exposed_targets(state: Dict) -> Iterable[Tuple[Dict, Dict]]:
    for card in state.get("placed_cards", []):
        covered = card.get("covered_connectors", {})
        for connector in _template_connectors(card["template_id"], card.get("face", "front")):
            if connector["connector_id"] not in covered:
                world = _world_connector(card, connector["connector_id"])
                if world:
                    yield card, world


def _candidate_key(candidate: Dict) -> Tuple:
    return (
        candidate["deck_end"],
        candidate["face"],
        candidate["source_connector_id"],
        candidate["target_card_id"],
        candidate["target_connector_id"],
        candidate["symmetry_index"],
    )


def enumerate_legal_placements(state: Dict, player_id: str) -> List[Dict]:
    if state.get("phase") != "playing" or state.get("current_turn") != player_id:
        return []
    candidates: List[Dict] = []
    seen = set()
    target_items = list(_exposed_targets(state))
    for deck_end, card in _outer_cards(state, player_id):
        for face in FACES:
            for source in _template_connectors(card["template_id"], face):
                for target_card, target in target_items:
                    if source["shape_id"] != target["shape_id"]:
                        continue
                    matrices = _matching_matrices(source["polygon"], target["polygon"])
                    for symmetry_index, matrix in enumerate(matrices):
                        if not _placement_is_valid(state, matrix, target_card["card_id"], target):
                            continue
                        matrix_key = tuple(_round_number(value) for value in matrix)
                        unique = (card["card_id"], face, source["connector_id"], target_card["card_id"], target["connector_id"], matrix_key)
                        if unique in seen:
                            continue
                        seen.add(unique)
                        candidates.append(
                            {
                                "candidate_id": f"p{len(candidates)}",
                                "deck_end": deck_end,
                                "card_id": card["card_id"],
                                "template_id": card["template_id"],
                                "owner_color": card["owner_color"],
                                "face": face,
                                "source_connector_id": source["connector_id"],
                                "target_card_id": target_card["card_id"],
                                "target_connector_id": target["connector_id"],
                                "symmetry_index": symmetry_index,
                                "matrix": _matrix_list(matrix),
                                "covered_dots": int(target["dots"]),
                            }
                        )
    candidates.sort(key=_candidate_key)
    for index, candidate in enumerate(candidates):
        candidate["candidate_id"] = f"p{index}"
    return candidates


def _board_bounds(state: Dict) -> Tuple[float, float, float, float]:
    points = [point for card in state.get("placed_cards", []) for point in _card_polygon(card["matrix"])]
    if not points:
        return (-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH / 2, CARD_HEIGHT / 2)
    return (
        min(point[0] for point in points),
        min(point[1] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
    )


def isolated_slots(state: Dict) -> List[Dict]:
    minimum_x, minimum_y, maximum_x, maximum_y = _board_bounds(state)
    gap = 55.0
    positions = [
        (minimum_x, minimum_y - CARD_HEIGHT - gap),
        (maximum_x - CARD_WIDTH, minimum_y - CARD_HEIGHT - gap),
        (maximum_x + gap, minimum_y),
        (maximum_x + gap, maximum_y - CARD_HEIGHT),
        (maximum_x - CARD_WIDTH, maximum_y + gap),
        (minimum_x, maximum_y + gap),
        (minimum_x - CARD_WIDTH - gap, maximum_y - CARD_HEIGHT),
        (minimum_x - CARD_WIDTH - gap, minimum_y),
    ]
    revision = int(state.get("board_revision", 0))
    return [
        {
            "isolated_slot_id": f"iso_{revision}_{index}",
            "matrix": [1.0, 0.0, 0.0, 1.0, _round_number(x), _round_number(y)],
        }
        for index, (x, y) in enumerate(positions)
    ]


def calculate_scores(state: Dict) -> Dict[str, int]:
    score_by_color = {color: 0 for color in COLORS}
    for card in state.get("placed_cards", []):
        owner_color = card.get("owner_color")
        if owner_color not in score_by_color or card.get("template_id") == "start":
            continue
        covered = card.get("covered_connectors", {})
        for connector in _template_connectors(card["template_id"], card.get("face", "front")):
            if connector["connector_id"] not in covered:
                score_by_color[owner_color] += int(connector["dots"])
    return {
        player_id: score_by_color.get(player.get("color"), 0)
        for player_id, player in state.get("players", {}).items()
    }


def _seeded_rng(state_or_seed, suffix: str) -> random.Random:
    seed = state_or_seed.get("seed") if isinstance(state_or_seed, dict) else state_or_seed
    return random.Random(f"tacta:{seed}:{suffix}")


def _build_deck(owner_color: str, controller_id: str, suits: Sequence[str], round_index: int) -> List[Dict]:
    return [
        {
            "card_id": f"{owner_color}_r{round_index}_{template['template_id']}",
            "template_id": template["template_id"],
            "owner_color": owner_color,
            "controller_id": controller_id,
        }
        for template in CATALOG["templates"]
        if template["suit"] in suits
    ]


def _choose_start_player(state: Dict) -> Optional[str]:
    choices = []
    for player_id in state.get("turn_order", []):
        outer = _outer_cards(state, player_id)
        values = [int(TEMPLATES[card["template_id"]]["value"]) for _, card in outer]
        if values:
            choices.append((min(values), sum(values), player_id))
    if not choices:
        return None
    best_pair = min((minimum, total) for minimum, total, _ in choices)
    tied = [player_id for minimum, total, player_id in choices if (minimum, total) == best_pair]
    return _seeded_rng(state, f"start:{state.get('round_index', 0)}").choice(tied)


def _start_card(round_index: int) -> Dict:
    return {
        "card_id": f"start_r{round_index}",
        "template_id": "start",
        "owner_color": None,
        "played_by": None,
        "face": "front",
        "matrix": [1.0, 0.0, 0.0, 1.0, -CARD_WIDTH / 2, -CARD_HEIGHT / 2],
        "z_index": 0,
        "parent_card_id": None,
        "parent_connector_id": None,
        "source_connector_id": None,
        "covered_connectors": {},
    }


def _round_suits(state: Dict) -> List[str]:
    mode = state["mode"]
    if mode == "limited_space":
        return [state["suit_schedule"][state["round_index"]]]
    if mode in ("quick", "sabotage"):
        return list(state["active_suits"])
    return list(SUITS)


def _start_round(state: Dict) -> None:
    suits = _round_suits(state)
    for player_id in state.get("turn_order", []):
        color = state["players"][player_id]["color"]
        deck = _build_deck(color, player_id, suits, int(state["round_index"]))
        _seeded_rng(state, f"deck:{state['round_index']}:{player_id}").shuffle(deck)
        state["players"][player_id]["deck"] = deck
        state["players"][player_id]["pass_suit"] = None
    state["placed_cards"] = [_start_card(int(state["round_index"]))]
    state["board_revision"] = 0
    state["live_scores"] = {player_id: 0 for player_id in state.get("turn_order", [])}
    state["next_ready"] = []
    state["last_round_summary"] = None
    state["start_player"] = _choose_start_player(state)
    state["current_turn"] = state["start_player"]
    state["phase"] = "playing"


def _finalize_sabotage_setup(state: Dict) -> None:
    order = state.get("turn_order", [])
    outgoing: Dict[str, List[Dict]] = {}
    retained: Dict[str, List[Dict]] = {}
    for player_id in order:
        chosen = state["players"][player_id]["pass_suit"]
        deck = state["players"][player_id]["deck"]
        outgoing[player_id] = [card for card in deck if TEMPLATES[card["template_id"]]["suit"] == chosen]
        retained[player_id] = [card for card in deck if TEMPLATES[card["template_id"]]["suit"] != chosen]
    for index, player_id in enumerate(order):
        incoming_from = order[(index - 1) % len(order)]
        deck = retained[player_id] + outgoing[incoming_from]
        for card in deck:
            card["controller_id"] = player_id
        _seeded_rng(state, f"sabotage:{player_id}").shuffle(deck)
        state["players"][player_id]["deck"] = deck
    state["start_player"] = _choose_start_player(state)
    state["current_turn"] = state["start_player"]
    state["phase"] = "playing"


def _finish_game(state: Dict) -> None:
    scores = state.get("cumulative_scores", {})
    maximum = max(scores.values(), default=0)
    winners = [player_id for player_id in state.get("turn_order", []) if scores.get(player_id, 0) == maximum]
    state["phase"] = "game_over"
    state["current_turn"] = None
    state["winner"] = winners
    state["game_over"] = True
    state["final_results"] = sorted(
        [
            {
                "player_id": player_id,
                "score": int(scores.get(player_id, 0)),
                "color": state["players"][player_id]["color"],
            }
            for player_id in state.get("turn_order", [])
        ],
        key=lambda item: (-item["score"], state["player_meta"].get(item["player_id"], {}).get("seat", 0)),
    )


def _finish_round(state: Dict) -> None:
    scores = calculate_scores(state)
    state["live_scores"] = scores
    state["round_scores"].append(dict(scores))
    for player_id, score in scores.items():
        state["cumulative_scores"][player_id] = int(state["cumulative_scores"].get(player_id, 0)) + int(score)
    state["last_round_summary"] = {
        "round": int(state["round_index"]) + 1,
        "suit": _round_suits(state)[0] if state["mode"] == "limited_space" else None,
        "scores": dict(scores),
        "cumulative_scores": dict(state["cumulative_scores"]),
    }
    if state["mode"] == "limited_space" and int(state["round_index"]) + 1 < len(state["suit_schedule"]):
        state["phase"] = "round_summary"
        state["current_turn"] = None
        state["next_ready"] = []
    else:
        _finish_game(state)


def _next_player_with_cards(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order", [])
    if player_id not in order:
        return None
    index = order.index(player_id)
    for offset in range(1, len(order) + 1):
        candidate = order[(index + offset) % len(order)]
        if state["players"][candidate].get("deck"):
            return candidate
    return None


def _public_template(template: Dict) -> Dict:
    return {
        "template_id": template["template_id"],
        "suit": template["suit"],
        "value": int(template["value"]),
        "connectors": [
            {
                "connector_id": f"c{index}",
                "slot": connector["slot"],
                "shape_id": CATALOG["slots"][connector["slot"]]["shape_id"],
                "dots": int(connector["dots"]),
            }
            for index, connector in enumerate(template["connectors"])
        ],
    }


def _public_card(card: Dict) -> Dict:
    template = TEMPLATES[card["template_id"]]
    return {
        "card_id": card["card_id"],
        "template_id": card["template_id"],
        "suit": template["suit"],
        "value": int(template["value"]),
        "owner_color": card.get("owner_color"),
        "controller_id": card.get("controller_id"),
    }


def _action_from_candidate(candidate: Dict, board_revision: int) -> Dict:
    return {
        "type": "place_card",
        "deck_end": candidate["deck_end"],
        "face": candidate["face"],
        "source_connector_id": candidate["source_connector_id"],
        "target_card_id": candidate["target_card_id"],
        "target_connector_id": candidate["target_connector_id"],
        "symmetry_index": candidate["symmetry_index"],
        "board_revision": board_revision,
    }


class TactaGame:
    game_id = "tacta"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not TactaGame.min_players <= len(players) <= TactaGame.max_players:
            raise ValueError("TACTA requires 2-6 players")
        config = dict(config or {})
        mode = config.get("mode", "standard")
        if mode not in ("standard", "quick", "limited_space", "sabotage"):
            raise ValueError("invalid TACTA mode")
        requested_suits = config.get("active_suits")
        active_suits = list(dict.fromkeys(requested_suits or SUITS))
        if any(suit not in SUITS for suit in active_suits):
            raise ValueError("invalid TACTA suit")
        if mode == "quick" and len(active_suits) not in (1, 2):
            raise ValueError("Quick Round requires one or two suits")
        if mode == "sabotage" and len(active_suits) != 2:
            raise ValueError("Sabotage requires exactly two suits")
        if mode in ("standard", "limited_space"):
            active_suits = list(SUITS)
        ordered_players = sorted(players, key=lambda item: item.get("seat", 0))
        player_ids = [item["player_id"] for item in ordered_players]
        seed = config.get("seed", random.SystemRandom().randrange(1, 2**63))
        schedule = list(SUITS)
        _seeded_rng(seed, "limited_schedule").shuffle(schedule)
        state = {
            "seed": seed,
            "mode": mode,
            "active_suits": active_suits,
            "suit_schedule": schedule if mode == "limited_space" else [],
            "round_index": 0,
            "players": {
                player_id: {
                    "color": COLORS[index],
                    "symbol": COLOR_SYMBOLS[COLORS[index]],
                    "deck": [],
                    "pass_suit": None,
                }
                for index, player_id in enumerate(player_ids)
            },
            "player_meta": {item["player_id"]: dict(item) for item in ordered_players},
            "turn_order": player_ids,
            "start_player": None,
            "current_turn": None,
            "phase": "setup",
            "placed_cards": [_start_card(0)],
            "board_revision": 0,
            "live_scores": {player_id: 0 for player_id in player_ids},
            "round_scores": [],
            "cumulative_scores": {player_id: 0 for player_id in player_ids},
            "next_ready": [],
            "last_round_summary": None,
            "winner": [],
            "final_results": None,
            "game_over": False,
        }
        if mode == "sabotage":
            for player_id in player_ids:
                color = state["players"][player_id]["color"]
                state["players"][player_id]["deck"] = _build_deck(color, player_id, active_suits, 0)
            state["phase"] = "sabotage_choose"
        else:
            _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over") or player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "sabotage_choose" and not state["players"][player_id].get("pass_suit"):
            return ["choose_pass_suit"]
        if phase == "round_summary" and player_id not in state.get("next_ready", []):
            return ["next_round"]
        if phase == "playing" and player_id == state.get("current_turn"):
            return ["place_card"] if enumerate_legal_placements(state, player_id) else ["place_isolated"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        phase = state.get("phase")
        action_type = action.get("type")
        events: List[Dict] = []

        if phase == "sabotage_choose":
            if action_type != "choose_pass_suit":
                return [], "invalid action"
            if state["players"][player_id].get("pass_suit"):
                return [], "choice already locked"
            suit = action.get("suit")
            if suit not in state.get("active_suits", []):
                return [], "invalid suit"
            state["players"][player_id]["pass_suit"] = suit
            events.append({"type": "tacta:sabotage_ready", "payload": {"player_id": player_id}})
            if all(state["players"][pid].get("pass_suit") for pid in state.get("turn_order", [])):
                _finalize_sabotage_setup(state)
                events.append({"type": "tacta:sabotage_started", "payload": {}})
            return events, None

        if phase == "round_summary":
            if action_type != "next_round":
                return [], "invalid action"
            if player_id not in state["next_ready"]:
                state["next_ready"].append(player_id)
            events.append({"type": "tacta:next_round", "payload": {"player_id": player_id}})
            if set(state["next_ready"]) >= set(state.get("turn_order", [])):
                state["round_index"] = int(state["round_index"]) + 1
                _start_round(state)
                events.append({"type": "tacta:round_started", "payload": {"round": int(state["round_index"]) + 1}})
            return events, None

        if phase != "playing":
            return [], "invalid phase"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if int(action.get("board_revision", -1)) != int(state.get("board_revision", 0)):
            return [], "board changed; choose a placement again"

        candidates = enumerate_legal_placements(state, player_id)
        placement = None
        deck_end = action.get("deck_end")
        face = action.get("face")
        if action_type == "place_card":
            for candidate in candidates:
                if all(
                    candidate.get(key) == action.get(key)
                    for key in (
                        "deck_end",
                        "face",
                        "source_connector_id",
                        "target_card_id",
                        "target_connector_id",
                        "symmetry_index",
                    )
                ):
                    placement = candidate
                    break
            if not placement:
                return [], "illegal placement"
        elif action_type == "place_isolated":
            if candidates:
                return [], "a connected placement is available"
            if deck_end not in {item[0] for item in _outer_cards(state, player_id)}:
                return [], "card is not on a deck end"
            if face not in FACES:
                return [], "invalid face"
            slot = next(
                (item for item in isolated_slots(state) if item["isolated_slot_id"] == action.get("isolated_slot_id")),
                None,
            )
            if not slot:
                return [], "invalid isolated slot"
            placement = {
                "deck_end": deck_end,
                "face": face,
                "matrix": slot["matrix"],
                "target_card_id": None,
                "target_connector_id": None,
                "source_connector_id": None,
                "covered_dots": 0,
            }
        else:
            return [], "invalid action"

        deck = state["players"][player_id]["deck"]
        card = deck.pop(0 if deck_end == "top" else -1)
        if action_type == "place_card" and card["card_id"] != placement["card_id"]:
            return [], "deck changed"
        placed = {
            "card_id": card["card_id"],
            "template_id": card["template_id"],
            "owner_color": card["owner_color"],
            "controller_id": player_id,
            "played_by": player_id,
            "face": face,
            "matrix": list(placement["matrix"]),
            "z_index": len(state["placed_cards"]),
            "parent_card_id": placement.get("target_card_id"),
            "parent_connector_id": placement.get("target_connector_id"),
            "source_connector_id": placement.get("source_connector_id"),
            "covered_connectors": {},
        }
        if placement.get("target_card_id"):
            target = _placed_lookup(state)[placement["target_card_id"]]
            target.setdefault("covered_connectors", {})[placement["target_connector_id"]] = card["card_id"]
        state["placed_cards"].append(placed)
        state["board_revision"] = int(state.get("board_revision", 0)) + 1
        state["live_scores"] = calculate_scores(state)
        template = TEMPLATES[card["template_id"]]
        events.append(
            {
                "type": "tacta:card_placed",
                "payload": {
                    "player_id": player_id,
                    "owner_color": card["owner_color"],
                    "suit": template["suit"],
                    "value": template["value"],
                    "covered_dots": placement.get("covered_dots", 0),
                },
            }
        )
        next_player = _next_player_with_cards(state, player_id)
        if next_player is None:
            _finish_round(state)
            events.append({"type": "tacta:round_finished", "payload": {"scores": dict(state["live_scores"])}})
        else:
            state["current_turn"] = next_player
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        legal_placements = enumerate_legal_placements(state, viewer_id)
        no_connection = (
            state.get("phase") == "playing"
            and state.get("current_turn") == viewer_id
            and not legal_placements
        )
        viewer = state.get("players", {}).get(viewer_id)
        legal_actions: List[str] = []
        if viewer and not state.get("game_over"):
            if state.get("phase") == "sabotage_choose" and not viewer.get("pass_suit"):
                legal_actions = ["choose_pass_suit"]
            elif state.get("phase") == "round_summary" and viewer_id not in state.get("next_ready", []):
                legal_actions = ["next_round"]
            elif state.get("phase") == "playing" and state.get("current_turn") == viewer_id:
                legal_actions = ["place_card"] if legal_placements else ["place_isolated"]
        players = []
        sabotage_revealed = state.get("mode") == "sabotage" and state.get("phase") != "sabotage_choose"
        for player_id in state.get("turn_order", []):
            pdata = state["players"][player_id]
            meta = state["player_meta"].get(player_id, {})
            controlled = {}
            if sabotage_revealed:
                for card in pdata.get("deck", []):
                    key = f"{card['owner_color']}:{TEMPLATES[card['template_id']]['suit']}"
                    controlled[key] = controlled.get(key, 0) + 1
            players.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name", player_id),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "color": pdata["color"],
                    "symbol": pdata["symbol"],
                    "deck_count": len(pdata.get("deck", [])),
                    "score": int(state.get("live_scores", {}).get(player_id, 0)),
                    "cumulative_score": int(state.get("cumulative_scores", {}).get(player_id, 0)),
                    "sabotage_ready": bool(pdata.get("pass_suit")),
                    "controlled_cards": controlled,
                }
            )
        outer_cards = [_public_card(card) | {"deck_end": deck_end} for deck_end, card in _outer_cards(state, viewer_id)]
        return {
            "game_id": TactaGame.game_id,
            "you": viewer_id,
            "mode": state.get("mode"),
            "phase": state.get("phase"),
            "round": int(state.get("round_index", 0)) + 1,
            "active_suits": list(state.get("active_suits", [])),
            "suit_schedule": list(state.get("suit_schedule", [])),
            "current_suit": _round_suits(state)[0] if state.get("mode") == "limited_space" else None,
            "current_turn": state.get("current_turn"),
            "start_player": state.get("start_player"),
            "board_revision": int(state.get("board_revision", 0)),
            "card_size": dict(CATALOG["card_size"]),
            "slots": copy.deepcopy(CATALOG["slots"]),
            "templates": [_public_template(item) for item in CATALOG["templates"]] + [_public_template(CATALOG["starting_card"])],
            "players": players,
            "placed_cards": copy.deepcopy(state.get("placed_cards", [])),
            "outer_cards": outer_cards,
            "legal_actions": legal_actions,
            "legal_placements": legal_placements,
            "isolated_slots": isolated_slots(state) if no_connection else [],
            "your_pass_suit": viewer.get("pass_suit") if viewer else None,
            "next_ready": list(state.get("next_ready", [])),
            "round_scores": copy.deepcopy(state.get("round_scores", [])),
            "last_round_summary": copy.deepcopy(state.get("last_round_summary")),
            "winner": list(state.get("winner", [])),
            "final_results": copy.deepcopy(state.get("final_results")),
            "game_over": bool(state.get("game_over")),
            "catalog_status": CATALOG.get("catalog_status"),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id not in state.get("players", {}):
            return None
        if state.get("phase") == "sabotage_choose" and not state["players"][bot_id].get("pass_suit"):
            return {"type": "choose_pass_suit", "suit": state["active_suits"][0]}
        if state.get("phase") == "round_summary" and bot_id not in state.get("next_ready", []):
            return {"type": "next_round"}
        if state.get("phase") != "playing" or state.get("current_turn") != bot_id:
            return None
        candidates = enumerate_legal_placements(state, bot_id)
        if candidates:
            own_color = state["players"][bot_id]["color"]
            lookup = _placed_lookup(state)
            candidates.sort(
                key=lambda candidate: (
                    -(candidate["covered_dots"] if lookup[candidate["target_card_id"]].get("owner_color") != own_color else 0),
                    candidate["covered_dots"] if lookup[candidate["target_card_id"]].get("owner_color") == own_color else 0,
                    _candidate_key(candidate),
                )
            )
            return _action_from_candidate(candidates[0], int(state["board_revision"]))
        outer = _outer_cards(state, bot_id)
        slots = isolated_slots(state)
        if outer and slots:
            return {
                "type": "place_isolated",
                "deck_end": outer[0][0],
                "face": "front",
                "isolated_slot_id": slots[0]["isolated_slot_id"],
                "board_revision": int(state["board_revision"]),
            }
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
