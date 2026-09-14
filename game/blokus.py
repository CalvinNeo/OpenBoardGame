import math
from typing import Callable, Dict, Iterator, List, Optional, Set, Tuple


BOARD_SIZE = 20
COLORS = ["blue", "yellow", "red", "green"]
CORNER_BY_COLOR = {
    "blue": (0, 0),
    "yellow": (0, BOARD_SIZE - 1),
    "red": (BOARD_SIZE - 1, BOARD_SIZE - 1),
    "green": (BOARD_SIZE - 1, 0),
}
ADJACENT_OFFSETS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
DIAGONAL_OFFSETS = [(1, 1), (1, -1), (-1, 1), (-1, -1)]


Coord = Tuple[int, int]
Shape = Tuple[Coord, ...]


def _normalize(coords: List[Coord]) -> Shape:
    min_x = min(x for x, _ in coords)
    min_y = min(y for _, y in coords)
    normalized = sorted((x - min_x, y - min_y) for x, y in coords)
    return tuple(normalized)


def _rotate(coords: List[Coord]) -> List[Coord]:
    return [(y, -x) for x, y in coords]


def _flip(coords: List[Coord]) -> List[Coord]:
    return [(-x, y) for x, y in coords]


def _all_transforms(coords: List[Coord]) -> List[Shape]:
    transforms: List[Shape] = []
    current = coords
    for _ in range(4):
        transforms.append(_normalize(current))
        transforms.append(_normalize(_flip(current)))
        current = _rotate(current)
    return transforms


def _canonical(coords: List[Coord]) -> Shape:
    return min(_all_transforms(coords))


def _generate_polyominoes(max_size: int) -> Dict[int, List[Shape]]:
    shapes_by_size: Dict[int, set] = {1: {((0, 0),)}}
    for size in range(2, max_size + 1):
        next_shapes = set()
        for shape in shapes_by_size[size - 1]:
            cells = set(shape)
            for x, y in cells:
                for dx, dy in ADJACENT_OFFSETS:
                    new_cell = (x + dx, y + dy)
                    if new_cell in cells:
                        continue
                    new_shape = list(cells | {new_cell})
                    next_shapes.add(_canonical(new_shape))
        shapes_by_size[size] = next_shapes
    return {size: sorted(shapes) for size, shapes in shapes_by_size.items()}


def _unique_orientations(shape: Shape) -> List[Shape]:
    seen = set()
    orientations = []
    for variant in _all_transforms(list(shape)):
        if variant in seen:
            continue
        seen.add(variant)
        orientations.append(variant)
    return orientations


_SHAPES_BY_SIZE = _generate_polyominoes(5)
if (
    len(_SHAPES_BY_SIZE.get(1, [])) != 1
    or len(_SHAPES_BY_SIZE.get(2, [])) != 1
    or len(_SHAPES_BY_SIZE.get(3, [])) != 2
    or len(_SHAPES_BY_SIZE.get(4, [])) != 5
    or len(_SHAPES_BY_SIZE.get(5, [])) != 12
):
    raise ValueError("unexpected polyomino counts")

PIECE_IDS: List[str] = []
PIECE_DEFS: Dict[str, List[Coord]] = {}
PIECE_SIZES: Dict[str, int] = {}
PIECE_ORIENTATIONS: Dict[str, List[Shape]] = {}
for size in range(1, 6):
    for idx, shape in enumerate(_SHAPES_BY_SIZE[size], start=1):
        piece_id = f"p{size}_{idx}"
        PIECE_IDS.append(piece_id)
        PIECE_DEFS[piece_id] = list(shape)
        PIECE_SIZES[piece_id] = size
        PIECE_ORIENTATIONS[piece_id] = _unique_orientations(shape)

TOTAL_CELLS = sum(PIECE_SIZES[piece_id] for piece_id in PIECE_IDS)
MONOMINO_ID = next((pid for pid in PIECE_IDS if PIECE_SIZES[pid] == 1), None)

# Every legal move gets a cheap score; only this many receive the mobility and
# territory evaluation. The cap keeps bot turns comfortably below the UI budget.
BOT_CANDIDATE_WIDTH = 24
BOT_MOBILITY_MOVE_CAP = 10


def _transform_piece(base: List[Coord], rotation: int, flip: bool) -> List[Coord]:
    coords = base
    if flip:
        coords = _flip(coords)
    turns = (rotation % 360) // 90
    for _ in range(turns):
        coords = _rotate(coords)
    return list(_normalize(coords))


def _orientation_actions(base: List[Coord]) -> List[Tuple[Shape, int, bool]]:
    action_orientations: List[Tuple[Shape, int, bool]] = []
    seen_orientations: Set[Shape] = set()
    for rotation in (0, 90, 180, 270):
        for flip in (False, True):
            oriented = tuple(_transform_piece(base, rotation, flip))
            if oriented in seen_orientations:
                continue
            seen_orientations.add(oriented)
            action_orientations.append((oriented, rotation, flip))
    return action_orientations


PIECE_ORIENTATION_ACTIONS: Dict[str, List[Tuple[Shape, int, bool]]] = {
    piece_id: _orientation_actions(piece_shape)
    for piece_id, piece_shape in PIECE_DEFS.items()
}


def _cells_within_bounds(cells: List[Coord]) -> bool:
    for x, y in cells:
        if x < 0 or x >= BOARD_SIZE or y < 0 or y >= BOARD_SIZE:
            return False
    return True


def _has_adjacent_same(board: List[List[Optional[str]]], color: str, cell: Coord) -> bool:
    x, y = cell
    for dx, dy in ADJACENT_OFFSETS:
        nx, ny = x + dx, y + dy
        if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
            if board[ny][nx] == color:
                return True
    return False


def _has_diagonal_same(board: List[List[Optional[str]]], color: str, cell: Coord) -> bool:
    x, y = cell
    for dx, dy in DIAGONAL_OFFSETS:
        nx, ny = x + dx, y + dy
        if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
            if board[ny][nx] == color:
                return True
    return False


def _is_valid_cells(
    board: List[List[Optional[str]]],
    color: str,
    cells: List[Coord],
    first_move: bool,
) -> Tuple[bool, Optional[str]]:
    if not _cells_within_bounds(cells):
        return False, "out of bounds"
    for x, y in cells:
        if board[y][x] is not None:
            return False, "cell occupied"

    if first_move:
        corner = CORNER_BY_COLOR[color]
        if corner not in cells:
            return False, "must cover starting corner"
        return True, None

    corner_touch = False
    for cell in cells:
        if _has_adjacent_same(board, color, cell):
            return False, "edge contact not allowed"
        if _has_diagonal_same(board, color, cell):
            corner_touch = True
    if not corner_touch:
        return False, "must touch corner"
    return True, None


def _is_valid_move(
    state: Dict, player_id: str, cells: List[Coord], first_move: bool
) -> Tuple[bool, Optional[str]]:
    board = state["board"]
    pdata = state["players"][player_id]
    color = pdata["color"]
    return _is_valid_cells(board, color, cells, first_move)


def _frontier_cells(board: List[List[Optional[str]]], color: str) -> Set[Coord]:
    frontier: Set[Coord] = set()
    for y, row in enumerate(board):
        for x, cell_color in enumerate(row):
            if cell_color != color:
                continue
            for dx, dy in DIAGONAL_OFFSETS:
                nx, ny = x + dx, y + dy
                if not (0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE):
                    continue
                if board[ny][nx] is not None:
                    continue
                if _has_adjacent_same(board, color, (nx, ny)):
                    continue
                frontier.add((nx, ny))
    return frontier


def _iter_piece_moves(
    state: Dict,
    player_id: str,
    piece_id: str,
    first_move: bool,
    *,
    board: Optional[List[List[Optional[str]]]] = None,
    anchors: Optional[Set[Coord]] = None,
) -> Iterator[Tuple[Dict, Shape]]:
    active_board = board if board is not None else state["board"]
    color = state["players"][player_id]["color"]
    if first_move:
        move_anchors = [CORNER_BY_COLOR[color]]
    else:
        if anchors is None:
            anchors = _frontier_cells(active_board, color)
        move_anchors = sorted(anchors, key=lambda coord: (coord[1], coord[0]))
    if not move_anchors:
        return

    # Every non-opening move must cover a current diagonal frontier cell, so
    # aligning each shape cell to each frontier is complete without scanning
    # all 400 board origins.
    for shape, rotation, flip in PIECE_ORIENTATION_ACTIONS[piece_id]:
        width = max(x for x, _ in shape) + 1
        height = max(y for _, y in shape) + 1
        seen_origins: Set[Coord] = set()
        for anchor_x, anchor_y in move_anchors:
            for shape_x, shape_y in shape:
                origin = (anchor_x - shape_x, anchor_y - shape_y)
                if origin in seen_origins:
                    continue
                seen_origins.add(origin)
                origin_x, origin_y = origin
                if (
                    origin_x < 0
                    or origin_y < 0
                    or origin_x + width > BOARD_SIZE
                    or origin_y + height > BOARD_SIZE
                ):
                    continue
                cells = tuple(
                    (origin_x + offset_x, origin_y + offset_y)
                    for offset_x, offset_y in shape
                )
                ok, _ = _is_valid_cells(active_board, color, list(cells), first_move)
                if not ok:
                    continue
                yield (
                    {
                        "type": "place_piece",
                        "piece_id": piece_id,
                        "rotation": rotation,
                        "flip": flip,
                        "x": origin_x,
                        "y": origin_y,
                    },
                    cells,
                )


def _piece_has_move(
    state: Dict,
    player_id: str,
    piece_id: str,
    first_move: bool,
    *,
    board: Optional[List[List[Optional[str]]]] = None,
    anchors: Optional[Set[Coord]] = None,
) -> bool:
    for _action, _cells in _iter_piece_moves(
        state,
        player_id,
        piece_id,
        first_move,
        board=board,
        anchors=anchors,
    ):
        return True
    return False


def _has_any_move(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    if pdata["passed"]:
        return False
    first_move = not pdata["has_placed"]
    anchors = None
    if not first_move:
        anchors = _frontier_cells(state["board"], pdata["color"])
        if not anchors:
            return False
    for piece_id in pdata["pieces"]:
        if _piece_has_move(
            state,
            player_id,
            piece_id,
            first_move,
            anchors=anchors,
        ):
            return True
    return False


def _board_with_cells(
    board: List[List[Optional[str]]], color: str, cells: Shape
) -> List[List[Optional[str]]]:
    next_board = [row[:] for row in board]
    for x, y in cells:
        next_board[y][x] = color
    return next_board


def _distance_from_start(color: str, cell: Coord) -> Tuple[int, int]:
    x, y = cell
    start_x, start_y = CORNER_BY_COLOR[color]
    return abs(x - start_x), abs(y - start_y)


def _frontier_openness(board: List[List[Optional[str]]], frontier: Set[Coord]) -> int:
    openness = 0
    for x, y in frontier:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
                    if board[ny][nx] is None:
                        openness += 1
    return openness


def _opponent_frontiers(
    state: Dict, player_id: str, board: List[List[Optional[str]]]
) -> List[Tuple[Set[Coord], float]]:
    order = state.get("turn_order", [])
    if player_id in order:
        player_index = order.index(player_id)
    else:
        player_index = 0
    opponents: List[Tuple[Set[Coord], float]] = []
    for offset in range(1, len(order)):
        opponent_id = order[(player_index + offset) % len(order)]
        opponent = state["players"][opponent_id]
        if opponent.get("passed"):
            continue
        if opponent.get("has_placed"):
            frontier = _frontier_cells(board, opponent["color"])
        else:
            corner = CORNER_BY_COLOR[opponent["color"]]
            frontier = {corner} if board[corner[1]][corner[0]] is None else set()
        # Blocking the player who moves immediately after us is most valuable.
        weight = 1.45 if offset == 1 else (1.2 if offset == 2 else 1.0)
        opponents.append((frontier, weight))
    return opponents


def _quick_candidate_score(
    state: Dict,
    player_id: str,
    piece_id: str,
    cells: Shape,
    own_frontier_before: Set[Coord],
    opponent_frontiers: List[Tuple[Set[Coord], float]],
) -> float:
    pdata = state["players"][player_id]
    color = pdata["color"]
    board = _board_with_cells(state["board"], color, cells)
    frontier = _frontier_cells(board, color)
    pieces_played = len(PIECE_IDS) - len(pdata["pieces"])
    phase = min(1.0, max(0.0, pieces_played / max(1, len(PIECE_IDS) - 1)))

    progress_points = frontier or set(cells)
    progress = [_distance_from_start(color, cell) for cell in progress_points]
    forward_reach = max((dx + dy for dx, dy in progress), default=0)
    inward_reach = max((min(dx, dy) for dx, dy in progress), default=0)
    max_x_reach = max((dx for dx, _ in progress), default=0)
    max_y_reach = max((dy for _, dy in progress), default=0)
    directional_balance = -abs(max_x_reach - max_y_reach)

    blocked_frontier = 0.0
    cell_set = set(cells)
    for opponent_frontier, weight in opponent_frontiers:
        blocked_frontier += len(cell_set & opponent_frontier) * weight

    opponent_contacts = 0
    for x, y in cells:
        for dx, dy in ADJACENT_OFFSETS + DIAGONAL_OFFSETS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE):
                continue
            neighbor = board[ny][nx]
            if neighbor is not None and neighbor != color:
                opponent_contacts += 1

    starting_corner = CORNER_BY_COLOR[color]
    edge_cells = sum(
        1
        for cell_x, cell_y in cells
        if (cell_x in (0, BOARD_SIZE - 1) or cell_y in (0, BOARD_SIZE - 1))
        and (cell_x, cell_y) != starting_corner
    )
    frontier_gain = len(frontier) - len(own_frontier_before)
    openness = _frontier_openness(board, frontier)
    piece_size = PIECE_SIZES[piece_id]

    score = piece_size * (92.0 + 26.0 * phase)
    score += len(frontier) * (7.0 + 4.0 * phase)
    score += frontier_gain * (5.0 + 3.0 * phase)
    score += openness * (0.75 + 0.35 * phase)
    score += forward_reach * (1.4 - 0.5 * phase)
    score += inward_reach * (5.5 - 2.0 * phase)
    score += directional_balance * (1.3 - 0.8 * phase)
    score += blocked_frontier * (18.0 + 8.0 * phase)
    score += opponent_contacts * (1.0 + phase)
    score -= edge_cells * (4.5 - 3.0 * phase)

    if piece_id == MONOMINO_ID and len(pdata["pieces"]) > 1:
        score -= 75.0 * (1.0 - 0.55 * phase)
    elif piece_size == 2 and len(pdata["pieces"]) > 4:
        score -= 20.0 * (1.0 - phase)
    return score


def _future_mobility_score(
    state: Dict,
    player_id: str,
    piece_id: str,
    board: List[List[Optional[str]]],
    frontier: Set[Coord],
) -> float:
    remaining = [
        remaining_id
        for remaining_id in state["players"][player_id]["pieces"]
        if remaining_id != piece_id
    ]
    if not remaining:
        return 240.0 + (45.0 if piece_id == MONOMINO_ID else 0.0)
    if not frontier:
        stranded = sum(PIECE_SIZES[remaining_id] for remaining_id in remaining)
        return -75.0 * stranded

    stranded_cells = 0
    scarce_options = 0.0
    flexibility = 0.0
    monomino_options = 0
    for remaining_id in remaining:
        move_count = 0
        for _action, _cells in _iter_piece_moves(
            state,
            player_id,
            remaining_id,
            False,
            board=board,
            anchors=frontier,
        ):
            move_count += 1
            if move_count >= BOT_MOBILITY_MOVE_CAP:
                break
        size = PIECE_SIZES[remaining_id]
        if move_count == 0:
            stranded_cells += size
            continue
        if remaining_id == MONOMINO_ID:
            monomino_options = move_count
        scarce_options += size / (move_count + 1.0)
        flexibility += math.log2(move_count + 1.0) * (0.7 + size * 0.12)

    pieces_played = len(PIECE_IDS) - len(state["players"][player_id]["pieces"])
    phase = min(1.0, max(0.0, pieces_played / max(1, len(PIECE_IDS) - 1)))
    score = flexibility * (1.2 + phase)
    score -= scarce_options * (4.0 + 5.0 * phase)
    score -= stranded_cells * (42.0 + 55.0 * phase)
    if len(remaining) == 1 and remaining[0] == MONOMINO_ID and monomino_options:
        score += 55.0
    return score


def _territory_control_score(
    state: Dict,
    player_id: str,
    board: List[List[Optional[str]]],
    own_frontier: Set[Coord],
) -> float:
    if not own_frontier:
        return -float(BOARD_SIZE * BOARD_SIZE)
    opponent_points = [
        point
        for frontier, _weight in _opponent_frontiers(state, player_id, board)
        for point in frontier
    ]
    if not opponent_points:
        return float(BOARD_SIZE * BOARD_SIZE)

    controlled = 0.0
    for y, row in enumerate(board):
        for x, value in enumerate(row):
            if value is not None:
                continue
            own_distance = min(abs(x - fx) + abs(y - fy) for fx, fy in own_frontier)
            opponent_distance = min(
                abs(x - fx) + abs(y - fy) for fx, fy in opponent_points
            )
            if own_distance < opponent_distance:
                controlled += 1.0
            elif own_distance == opponent_distance:
                controlled += 0.3
    return controlled


def _deep_candidate_score(
    state: Dict, player_id: str, piece_id: str, cells: Shape
) -> float:
    color = state["players"][player_id]["color"]
    board = _board_with_cells(state["board"], color, cells)
    frontier = _frontier_cells(board, color)
    pieces_played = len(PIECE_IDS) - len(state["players"][player_id]["pieces"])
    phase = min(1.0, max(0.0, pieces_played / max(1, len(PIECE_IDS) - 1)))
    mobility = _future_mobility_score(state, player_id, piece_id, board, frontier)
    territory = _territory_control_score(state, player_id, board, frontier)
    return mobility + territory * (0.34 - 0.12 * phase)


def _report_bot_progress(
    progress_callback: Optional[Callable[[str, float, Optional[str]], None]],
    stage: str,
    progress: float,
    detail: str,
) -> None:
    if progress_callback is None:
        return
    try:
        progress_callback(stage, progress, detail)
    except Exception:
        # Progress is informational and must never prevent a legal bot move.
        return


def _advance_turn(state: Dict, events: List[Dict]) -> None:
    order = state["turn_order"]
    if not order:
        state["current_turn"] = None
        return
    current = state["current_turn"]
    if current not in order:
        current_idx = 0
    else:
        current_idx = order.index(current)

    for offset in range(1, len(order) + 1):
        pid = order[(current_idx + offset) % len(order)]
        pdata = state["players"][pid]
        if pdata["passed"]:
            continue
        if _has_any_move(state, pid):
            state["current_turn"] = pid
            return
        pdata["passed"] = True
        events.append({"type": "blokus:auto_pass", "payload": {"player_id": pid}})

    _finalize_game(state)


def _finalize_game(state: Dict) -> None:
    scores: Dict[str, int] = {}
    for pid, pdata in state["players"].items():
        remaining = sum(PIECE_SIZES[piece_id] for piece_id in pdata["pieces"])
        score = -remaining
        if remaining == 0:
            score += 15
            if pdata.get("last_piece") == MONOMINO_ID:
                score += 5
        scores[pid] = score
    state["scores"] = scores
    max_score = max(scores.values()) if scores else 0
    winners = [pid for pid, score in scores.items() if score == max_score]
    state["winner"] = winners
    state["game_over"] = True
    state["current_turn"] = None


class BlokusGame:
    game_id = "blokus"
    min_players = 4
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) != 4:
            raise ValueError("Blokus requires exactly 4 players")
        ordered_players = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in ordered_players]
        player_meta = {p["player_id"]: p for p in ordered_players}
        board = [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]

        state_players: Dict[str, Dict] = {}
        for idx, pid in enumerate(player_ids):
            color = COLORS[idx]
            state_players[pid] = {
                "color": color,
                "pieces": list(PIECE_IDS),
                "passed": False,
                "has_placed": False,
                "last_piece": None,
            }

        return {
            "board": board,
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0],
            "player_meta": player_meta,
            "config": config or {},
            "game_over": False,
            "winner": [],
            "scores": {},
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata or pdata.get("passed"):
            return []
        actions = ["give_up"]
        if _has_any_move(state, player_id):
            actions.insert(0, "place_piece")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        pdata = state["players"].get(player_id)
        if not pdata or pdata.get("passed"):
            return [], "player not active"

        action_type = action.get("type")
        if action_type == "give_up":
            pdata["passed"] = True
            events = [{"type": "blokus:give_up", "payload": {"player_id": player_id}}]
            _advance_turn(state, events)
            return events, None
        if action_type != "place_piece":
            return [], "invalid action"
        piece_id = action.get("piece_id")
        if piece_id not in pdata["pieces"]:
            return [], "invalid piece"
        rotation = action.get("rotation")
        flip = action.get("flip")
        x = action.get("x")
        y = action.get("y")
        if rotation not in (0, 90, 180, 270):
            return [], "invalid rotation"
        if not isinstance(flip, bool):
            return [], "invalid flip"
        if not isinstance(x, int) or not isinstance(y, int):
            return [], "invalid position"

        base = PIECE_DEFS[piece_id]
        shape = _transform_piece(base, rotation, flip)
        cells = [(x + dx, y + dy) for dx, dy in shape]
        first_move = not pdata["has_placed"]
        ok, error = _is_valid_move(state, player_id, cells, first_move)
        if not ok:
            return [], error or "invalid move"

        for cx, cy in cells:
            state["board"][cy][cx] = pdata["color"]
        pdata["pieces"].remove(piece_id)
        pdata["has_placed"] = True
        pdata["last_piece"] = piece_id
        events = [
            {
                "type": "blokus:place_piece",
                "payload": {
                    "player_id": player_id,
                    "piece_id": piece_id,
                    "rotation": rotation,
                    "flip": flip,
                    "x": x,
                    "y": y,
                },
            }
        ]
        _advance_turn(state, events)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            meta = state["player_meta"][pid]
            pdata = state["players"][pid]
            remaining_cells = sum(PIECE_SIZES[piece_id] for piece_id in pdata["pieces"])
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "color": pdata["color"],
                    "remaining_pieces": len(pdata["pieces"]),
                    "remaining_cells": remaining_cells,
                    "passed": pdata["passed"],
                    "start_corner": list(CORNER_BY_COLOR[pdata["color"]]),
                    "score": state.get("scores", {}).get(pid),
                }
            )

        piece_defs = {
            pid: {
                "size": PIECE_SIZES[pid],
                "cells": [list(coord) for coord in PIECE_DEFS[pid]],
            }
            for pid in PIECE_IDS
        }
        viewer_pieces = state["players"].get(viewer_id, {}).get("pieces", [])

        return {
            "game_id": BlokusGame.game_id,
            "you": viewer_id,
            "board_size": BOARD_SIZE,
            "board": state["board"],
            "players": players_view,
            "current_turn": state.get("current_turn"),
            "turn_order": state.get("turn_order", []),
            "remaining_pieces": list(viewer_pieces),
            "piece_defs": piece_defs,
            "legal_actions": BlokusGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "scores": state.get("scores", {}),
            "total_cells": TOTAL_CELLS,
        }

    @staticmethod
    def bot_move(
        state: Dict,
        bot_id: str,
        *,
        progress_callback: Optional[Callable[[str, float, Optional[str]], None]] = None,
    ) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata.get("passed"):
            return None

        first_move = not pdata["has_placed"]
        own_frontier = (
            set() if first_move else _frontier_cells(state["board"], pdata["color"])
        )
        opponents = _opponent_frontiers(state, bot_id, state["board"])
        candidates: List[Tuple[float, Dict, Shape]] = []
        piece_count = len(pdata["pieces"])
        _report_bot_progress(
            progress_callback,
            "generating",
            0.08,
            f"Scanning {piece_count} remaining pieces",
        )
        for index, piece_id in enumerate(pdata["pieces"]):
            for action, cells in _iter_piece_moves(
                state,
                bot_id,
                piece_id,
                first_move,
                anchors=own_frontier,
            ):
                score = _quick_candidate_score(
                    state,
                    bot_id,
                    piece_id,
                    cells,
                    own_frontier,
                    opponents,
                )
                candidates.append((score, action, cells))
            if index % 4 == 3 or index + 1 == piece_count:
                _report_bot_progress(
                    progress_callback,
                    "generating",
                    0.08 + 0.27 * ((index + 1) / max(1, piece_count)),
                    f"Found {len(candidates)} legal placements",
                )

        if not candidates:
            _report_bot_progress(
                progress_callback,
                "selected",
                0.98,
                "No placement remains; passing",
            )
            return {"type": "give_up"}

        candidates.sort(key=lambda candidate: candidate[0], reverse=True)
        shortlist = candidates[:BOT_CANDIDATE_WIDTH]
        best_score = -float("inf")
        best_action: Optional[Dict] = None
        report_every = max(1, len(shortlist) // 8)
        for index, (quick_score, action, cells) in enumerate(shortlist):
            score = quick_score + _deep_candidate_score(
                state,
                bot_id,
                action["piece_id"],
                cells,
            )
            if score > best_score:
                best_score = score
                best_action = action
            if index % report_every == 0 or index + 1 == len(shortlist):
                _report_bot_progress(
                    progress_callback,
                    "evaluating",
                    0.35 + 0.6 * ((index + 1) / len(shortlist)),
                    f"Comparing the best {len(shortlist)} placements",
                )

        _report_bot_progress(
            progress_callback,
            "selected",
            0.98,
            f"Selected from {len(candidates)} legal placements",
        )
        return best_action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
