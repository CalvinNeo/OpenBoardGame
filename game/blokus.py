from typing import Dict, List, Optional, Tuple


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


def _transform_piece(base: List[Coord], rotation: int, flip: bool) -> List[Coord]:
    coords = base
    if flip:
        coords = _flip(coords)
    turns = (rotation % 360) // 90
    for _ in range(turns):
        coords = _rotate(coords)
    return list(_normalize(coords))


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


def _is_valid_move(
    state: Dict, player_id: str, cells: List[Coord], first_move: bool
) -> Tuple[bool, Optional[str]]:
    board = state["board"]
    pdata = state["players"][player_id]
    color = pdata["color"]

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


def _piece_has_move(state: Dict, player_id: str, piece_id: str, first_move: bool) -> bool:
    board = state["board"]
    for shape in PIECE_ORIENTATIONS[piece_id]:
        width = max(x for x, _ in shape) + 1
        height = max(y for _, y in shape) + 1
        for x in range(BOARD_SIZE - width + 1):
            for y in range(BOARD_SIZE - height + 1):
                cells = [(x + dx, y + dy) for dx, dy in shape]
                if not _cells_within_bounds(cells):
                    continue
                occupied = False
                for cx, cy in cells:
                    if board[cy][cx] is not None:
                        occupied = True
                        break
                if occupied:
                    continue
                ok, _ = _is_valid_move(state, player_id, cells, first_move)
                if ok:
                    return True
    return False


def _has_any_move(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    if pdata["passed"]:
        return False
    first_move = not pdata["has_placed"]
    for piece_id in pdata["pieces"]:
        if _piece_has_move(state, player_id, piece_id, first_move):
            return True
    return False


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
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata.get("passed"):
            return None
        for piece_id in pdata["pieces"]:
            base = PIECE_DEFS[piece_id]
            for rotation in (0, 90, 180, 270):
                for flip in (False, True):
                    shape = _transform_piece(base, rotation, flip)
                    width = max(x for x, _ in shape) + 1
                    height = max(y for _, y in shape) + 1
                    for x in range(BOARD_SIZE - width + 1):
                        for y in range(BOARD_SIZE - height + 1):
                            cells = [(x + dx, y + dy) for dx, dy in shape]
                            ok, _ = _is_valid_move(state, bot_id, cells, not pdata["has_placed"])
                            if ok:
                                return {
                                    "type": "place_piece",
                                    "piece_id": piece_id,
                                    "rotation": rotation,
                                    "flip": flip,
                                    "x": x,
                                    "y": y,
                                }
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
