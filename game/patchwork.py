import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple


BOARD_SIZE = 9
ROTATIONS = (0, 90, 180, 270)
Coord = Tuple[int, int]
Shape = Tuple[Coord, ...]

ASSET_PATH = Path(__file__).resolve().parent / "assets" / "patchwork" / "patchwork.json"
ASSETS = json.loads(ASSET_PATH.read_text(encoding="utf-8"))
BOARD_META = ASSETS["board"]
BOARD_SVG_PATH = ASSET_PATH.parent / BOARD_META.get("board_svg", "board.svg")
PATCH_DEFS: List[Dict] = list(ASSETS["patches"])
PATCHES_BY_ID: Dict[str, Dict] = {patch["id"]: patch for patch in PATCH_DEFS}
PATCH_IDS = [patch["id"] for patch in PATCH_DEFS]
SMALLEST_PATCH_ID = ASSETS["smallest_patch_id"]
BUTTON_MARKERS = set(BOARD_META["button_markers"])
LEATHER_MARKERS = set(BOARD_META["leather_markers"])
END_POSITION = int(BOARD_META["time_track_end"])
STARTING_BUTTONS = int(BOARD_META["starting_buttons"])
SPECIAL_TILE_BONUS = int(BOARD_META["special_tile_bonus"])


def _board_svg_url() -> str:
    version = int(BOARD_SVG_PATH.stat().st_mtime_ns)
    return f"/static/patchwork/{BOARD_SVG_PATH.name}?v={version}"


def _normalize(coords: List[Coord]) -> Shape:
    min_x = min(x for x, _ in coords)
    min_y = min(y for _, y in coords)
    normalized = sorted((x - min_x, y - min_y) for x, y in coords)
    return tuple(normalized)


def _rotate(coords: List[Coord]) -> List[Coord]:
    return [(y, -x) for x, y in coords]


def _flip(coords: List[Coord]) -> List[Coord]:
    return [(-x, y) for x, y in coords]


def _transform_shape(cells: List[Coord], rotation: int, flip: bool) -> Shape:
    coords = list(cells)
    if flip:
        coords = _flip(coords)
    turns = (rotation % 360) // 90
    for _ in range(turns):
        coords = _rotate(coords)
    return _normalize(coords)


def _build_orientations() -> Dict[str, List[Shape]]:
    orientations: Dict[str, List[Shape]] = {}
    for patch in PATCH_DEFS:
        patch_id = patch["id"]
        base = [tuple(cell) for cell in patch["cells"]]
        seen = set()
        variants: List[Shape] = []
        for rotation in ROTATIONS:
            for flip in (False, True):
                variant = _transform_shape(base, rotation, flip)
                if variant in seen:
                    continue
                seen.add(variant)
                variants.append(variant)
        orientations[patch_id] = variants
    return orientations


PATCH_ORIENTATIONS = _build_orientations()


def _empty_board() -> List[List[Optional[str]]]:
    return [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def _ordered_player_ids(state: Dict) -> List[str]:
    return sorted(
        state["player_meta"].keys(),
        key=lambda pid: state["player_meta"][pid].get("seat", 0),
    )


def _board_has_empty(board: List[List[Optional[str]]]) -> bool:
    for row in board:
        for cell in row:
            if cell is None:
                return True
    return False


def _board_empty_count(board: List[List[Optional[str]]]) -> int:
    total = 0
    for row in board:
        for cell in row:
            if cell is None:
                total += 1
    return total


def _board_score_preview(player_state: Dict) -> int:
    return (
        int(player_state["buttons"])
        + (SPECIAL_TILE_BONUS if player_state.get("has_special_tile") else 0)
        - (_board_empty_count(player_state["quilt_board"]) * 2)
    )


def _placement_cells(shape: Shape, x: int, y: int) -> List[Coord]:
    return [(x + dx, y + dy) for dx, dy in shape]


def _can_place_cells(board: List[List[Optional[str]]], cells: List[Coord]) -> bool:
    for x, y in cells:
        if x < 0 or x >= BOARD_SIZE or y < 0 or y >= BOARD_SIZE:
            return False
        if board[y][x] is not None:
            return False
    return True


def _can_place_patch(
    board: List[List[Optional[str]]],
    patch_id: str,
    rotation: int,
    flip: bool,
    x: int,
    y: int,
) -> bool:
    if patch_id not in PATCHES_BY_ID:
        return False
    if rotation not in ROTATIONS:
        return False
    if not isinstance(flip, bool):
        return False
    shape = _transform_shape([tuple(cell) for cell in PATCHES_BY_ID[patch_id]["cells"]], rotation, flip)
    return _can_place_cells(board, _placement_cells(shape, x, y))


def _write_patch(board: List[List[Optional[str]]], cells: List[Coord], patch_id: str) -> None:
    for x, y in cells:
        board[y][x] = patch_id


def _find_legal_placement(board: List[List[Optional[str]]], patch_id: str) -> Optional[Dict]:
    for rotation in ROTATIONS:
        for flip in (False, True):
            shape = _transform_shape([tuple(cell) for cell in PATCHES_BY_ID[patch_id]["cells"]], rotation, flip)
            width = max(x for x, _ in shape) + 1
            height = max(y for _, y in shape) + 1
            for y in range(BOARD_SIZE - height + 1):
                for x in range(BOARD_SIZE - width + 1):
                    cells = _placement_cells(shape, x, y)
                    if _can_place_cells(board, cells):
                        return {
                            "rotation": rotation,
                            "flip": flip,
                            "x": x,
                            "y": y,
                        }
    return None


def _check_special_tile(board: List[List[Optional[str]]]) -> bool:
    for top in range(BOARD_SIZE - 6):
        for left in range(BOARD_SIZE - 6):
            ok = True
            for y in range(top, top + 7):
                for x in range(left, left + 7):
                    if board[y][x] is None:
                        ok = False
                        break
                if not ok:
                    break
            if ok:
                return True
    return False


def _maybe_award_special_tile(state: Dict, player_id: str, events: List[Dict]) -> None:
    if not state.get("special_tile_available", True):
        return
    player_state = state["players"][player_id]
    if player_state.get("has_special_tile"):
        return
    if not _check_special_tile(player_state["quilt_board"]):
        return
    state["special_tile_available"] = False
    player_state["has_special_tile"] = True
    events.append({"type": "patchwork:special_tile", "payload": {"player_id": player_id}})


def _update_current_turn(state: Dict) -> None:
    if state.get("game_over"):
        state["current_turn"] = None
        return
    pending = state.get("pending_special_patch")
    if pending:
        state["current_turn"] = pending["player_id"]
        return
    player_ids = _ordered_player_ids(state)
    if not player_ids:
        state["current_turn"] = None
        return
    if all(state["players"][pid]["time_position"] >= END_POSITION for pid in player_ids):
        state["current_turn"] = None
        return
    state["current_turn"] = min(
        player_ids,
        key=lambda pid: (
            state["players"][pid]["time_position"],
            -state["players"][pid]["arrival_order"],
            state["player_meta"][pid].get("seat", 0),
        ),
    )


def _finalize_game(state: Dict, events: List[Dict]) -> None:
    scores: Dict[str, int] = {}
    for player_id, player_state in state["players"].items():
        scores[player_id] = _board_score_preview(player_state)
    state["scores"] = scores
    max_score = max(scores.values()) if scores else 0
    candidates = [player_id for player_id, score in scores.items() if score == max_score]
    if len(candidates) > 1 and state.get("first_to_finish") in candidates:
        winner = [state["first_to_finish"]]
    else:
        winner = candidates
    state["winner"] = winner
    state["game_over"] = True
    state["current_turn"] = None
    events.append(
        {
            "type": "patchwork:game_over",
            "payload": {"winner": winner, "scores": scores},
        }
    )


def _maybe_finalize_game(state: Dict, events: List[Dict]) -> None:
    if state.get("pending_special_patch"):
        return
    if all(player_state["time_position"] >= END_POSITION for player_state in state["players"].values()):
        _finalize_game(state, events)
        return
    _update_current_turn(state)


def _resolve_movement(state: Dict, player_id: str, target_position: int, events: List[Dict]) -> None:
    player_state = state["players"][player_id]
    if target_position < player_state["time_position"]:
        target_position = player_state["time_position"]
    target_position = min(target_position, END_POSITION)
    for position in range(player_state["time_position"] + 1, target_position + 1):
        player_state["time_position"] = position
        state["arrival_counter"] += 1
        player_state["arrival_order"] = state["arrival_counter"]
        if position >= END_POSITION and state.get("first_to_finish") is None:
            state["first_to_finish"] = player_id
            events.append({"type": "patchwork:first_finish", "payload": {"player_id": player_id}})
        if position in BUTTON_MARKERS:
            income = int(player_state["button_income"])
            if income > 0:
                player_state["buttons"] += income
            events.append(
                {
                    "type": "patchwork:button_income",
                    "payload": {"player_id": player_id, "position": position, "amount": income},
                }
            )
        if position in LEATHER_MARKERS and position not in state["claimed_leathers"]:
            state["claimed_leathers"].append(position)
            if _board_has_empty(player_state["quilt_board"]):
                state["pending_special_patch"] = {
                    "player_id": player_id,
                    "remaining_target": target_position,
                    "position": position,
                }
                events.append(
                    {
                        "type": "patchwork:claim_leather",
                        "payload": {"player_id": player_id, "position": position},
                    }
                )
                _update_current_turn(state)
                return
            events.append(
                {
                    "type": "patchwork:skip_leather",
                    "payload": {"player_id": player_id, "position": position},
                }
            )
    _maybe_finalize_game(state, events)


def _selectable_patch_ids(state: Dict) -> List[str]:
    circle = state["patch_circle"]
    if not circle:
        return []
    start = state["neutral_index"]
    count = min(3, len(circle))
    return [circle[(start + offset) % len(circle)] for offset in range(count)]


class PatchworkGame:
    game_id = "patchwork"
    min_players = 2
    max_players = 2

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) != 2:
            raise ValueError("Patchwork requires exactly 2 players")
        ordered_players = sorted(players, key=lambda player: player.get("seat", 0))
        player_ids = [player["player_id"] for player in ordered_players]
        player_meta = {player["player_id"]: player for player in ordered_players}
        seed = (config or {}).get("seed")
        rng = random.Random(seed)
        patch_circle = list(PATCH_IDS)
        rng.shuffle(patch_circle)
        smallest_index = patch_circle.index(SMALLEST_PATCH_ID)
        neutral_index = (smallest_index + 1) % len(patch_circle)

        state_players: Dict[str, Dict] = {}
        arrival_counter = len(player_ids)
        for idx, player_id in enumerate(player_ids):
            # Seat 0 acts first by being treated as the later arrival on the start space.
            arrival_order = arrival_counter - idx
            state_players[player_id] = {
                "buttons": STARTING_BUTTONS,
                "time_position": 0,
                "arrival_order": arrival_order,
                "button_income": 0,
                "quilt_board": _empty_board(),
                "has_special_tile": False,
                "placed_patches": [],
            }

        state = {
            "patch_circle": patch_circle,
            "neutral_index": neutral_index,
            "players": state_players,
            "player_meta": player_meta,
            "current_turn": None,
            "arrival_counter": arrival_counter,
            "special_tile_available": True,
            "first_to_finish": None,
            "claimed_leathers": [],
            "pending_special_patch": None,
            "config": dict(config or {}),
            "game_over": False,
            "winner": [],
            "scores": {},
        }
        _update_current_turn(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pending = state.get("pending_special_patch")
        if pending:
            if pending["player_id"] != player_id:
                return []
            return ["place_bonus_patch"]
        if player_id != state.get("current_turn"):
            return []
        actions = ["advance"]
        player_state = state["players"][player_id]
        for patch_id in _selectable_patch_ids(state):
            patch = PATCHES_BY_ID[patch_id]
            if player_state["buttons"] < patch["cost_buttons"]:
                continue
            if _find_legal_placement(player_state["quilt_board"], patch_id):
                actions.append("buy_patch")
                break
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"

        action_type = action.get("type")
        pending = state.get("pending_special_patch")
        if pending:
            if player_id != pending["player_id"]:
                return [], "not your turn"
            if action_type != "place_bonus_patch":
                return [], "must place special patch"
            x = action.get("x")
            y = action.get("y")
            if not isinstance(x, int) or not isinstance(y, int):
                return [], "invalid position"
            if x < 0 or x >= BOARD_SIZE or y < 0 or y >= BOARD_SIZE:
                return [], "invalid position"
            player_state = state["players"][player_id]
            if player_state["quilt_board"][y][x] is not None:
                return [], "cell occupied"
            events = [
                {
                    "type": "patchwork:place_leather",
                    "payload": {"player_id": player_id, "x": x, "y": y, "position": pending["position"]},
                }
            ]
            player_state["quilt_board"][y][x] = f"leather_{pending['position']}"
            player_state["placed_patches"].append(
                {
                    "patch_id": f"leather_{pending['position']}",
                    "type": "leather",
                    "x": x,
                    "y": y,
                    "rotation": 0,
                    "flip": False,
                    "cells": [[0, 0]],
                }
            )
            _maybe_award_special_tile(state, player_id, events)
            remaining_target = pending["remaining_target"]
            state["pending_special_patch"] = None
            if remaining_target > player_state["time_position"]:
                _resolve_movement(state, player_id, remaining_target, events)
            else:
                _maybe_finalize_game(state, events)
            return events, None

        if player_id != state.get("current_turn"):
            return [], "not your turn"

        player_state = state["players"][player_id]
        events: List[Dict] = []

        if action_type == "advance":
            opponent_id = next(pid for pid in _ordered_player_ids(state) if pid != player_id)
            target_position = min(END_POSITION, state["players"][opponent_id]["time_position"] + 1)
            moved = max(0, target_position - player_state["time_position"])
            player_state["buttons"] += moved
            events.append(
                {
                    "type": "patchwork:advance",
                    "payload": {"player_id": player_id, "target_position": target_position, "gained_buttons": moved},
                }
            )
            _resolve_movement(state, player_id, target_position, events)
            return events, None

        if action_type != "buy_patch":
            return [], "invalid action"

        patch_id = action.get("patch_id")
        if patch_id not in _selectable_patch_ids(state):
            return [], "patch not selectable"
        if patch_id not in PATCHES_BY_ID:
            return [], "unknown patch"
        rotation = action.get("rotation")
        flip = action.get("flip")
        x = action.get("x")
        y = action.get("y")
        if rotation not in ROTATIONS:
            return [], "invalid rotation"
        if not isinstance(flip, bool):
            return [], "invalid flip"
        if not isinstance(x, int) or not isinstance(y, int):
            return [], "invalid position"
        patch = PATCHES_BY_ID[patch_id]
        if player_state["buttons"] < patch["cost_buttons"]:
            return [], "not enough buttons"
        if not _can_place_patch(player_state["quilt_board"], patch_id, rotation, flip, x, y):
            return [], "invalid placement"

        shape = _transform_shape([tuple(cell) for cell in patch["cells"]], rotation, flip)
        cells = _placement_cells(shape, x, y)
        player_state["buttons"] -= patch["cost_buttons"]
        _write_patch(player_state["quilt_board"], cells, patch_id)
        player_state["button_income"] += patch["income_buttons"]
        player_state["placed_patches"].append(
            {
                "patch_id": patch_id,
                "type": "patch",
                "x": x,
                "y": y,
                "rotation": rotation,
                "flip": flip,
                "cells": [[cell_x - x, cell_y - y] for cell_x, cell_y in cells],
            }
        )

        circle = state["patch_circle"]
        chosen_index = circle.index(patch_id)
        circle.pop(chosen_index)
        if circle:
            state["neutral_index"] = chosen_index % len(circle)
        else:
            state["neutral_index"] = 0

        events.append(
            {
                "type": "patchwork:buy_patch",
                "payload": {
                    "player_id": player_id,
                    "patch_id": patch_id,
                    "rotation": rotation,
                    "flip": flip,
                    "x": x,
                    "y": y,
                },
            }
        )
        _maybe_award_special_tile(state, player_id, events)
        _resolve_movement(state, player_id, player_state["time_position"] + patch["cost_time"], events)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        ordered_ids = _ordered_player_ids(state)
        players_view = []
        for player_id in ordered_ids:
            meta = state["player_meta"][player_id]
            player_state = state["players"][player_id]
            players_view.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot", False),
                    "buttons": player_state["buttons"],
                    "time_position": player_state["time_position"],
                    "arrival_order": player_state["arrival_order"],
                    "button_income": player_state["button_income"],
                    "has_special_tile": player_state["has_special_tile"],
                    "empty_spaces": _board_empty_count(player_state["quilt_board"]),
                    "score_preview": _board_score_preview(player_state),
                    "quilt_board": player_state["quilt_board"],
                    "placed_patches": list(player_state.get("placed_patches", [])),
                }
            )

        patch_defs = {
            patch["id"]: {
                "id": patch["id"],
                "cell_count": patch["cell_count"],
                "cost_buttons": patch["cost_buttons"],
                "cost_time": patch["cost_time"],
                "income_buttons": patch["income_buttons"],
                "cells": patch["cells"],
                "width": patch["width"],
                "height": patch["height"],
                "svg_url": f"/static/patchwork/{patch['svg']}",
            }
            for patch in PATCH_DEFS
        }

        circle = state["patch_circle"]
        selectable = _selectable_patch_ids(state)
        ordered_circle = []
        if circle:
            start = state["neutral_index"]
            for offset in range(len(circle)):
                patch_id = circle[(start + offset) % len(circle)]
                ordered_circle.append(
                    {
                        "patch_id": patch_id,
                        "offset": offset,
                        "selectable": offset < min(3, len(circle)),
                    }
                )

        return {
            "game_id": PatchworkGame.game_id,
            "you": viewer_id,
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "special_tile_available": state.get("special_tile_available", True),
            "first_to_finish": state.get("first_to_finish"),
            "claimed_leathers": list(state.get("claimed_leathers", [])),
            "pending_special_patch": state.get("pending_special_patch"),
            "patch_circle": ordered_circle,
            "selectable_patches": selectable,
            "patch_defs": patch_defs,
            "track_end": END_POSITION,
            "button_markers": sorted(BUTTON_MARKERS),
            "leather_markers": sorted(LEATHER_MARKERS),
            "board_size": BOARD_SIZE,
            "starting_buttons": STARTING_BUTTONS,
            "special_tile_bonus": SPECIAL_TILE_BONUS,
            "board_svg_url": _board_svg_url(),
            "board_visual_layout": BOARD_META.get("visual_layout", {}),
            "legal_actions": PatchworkGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "scores": dict(state.get("scores", {})),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pending = state.get("pending_special_patch")
        if pending:
            if pending["player_id"] != bot_id:
                return None
            board = state["players"][bot_id]["quilt_board"]
            for y in range(BOARD_SIZE):
                for x in range(BOARD_SIZE):
                    if board[y][x] is None:
                        return {"type": "place_bonus_patch", "x": x, "y": y}
            return None

        if bot_id != state.get("current_turn"):
            return None

        player_state = state["players"][bot_id]
        for patch_id in _selectable_patch_ids(state):
            patch = PATCHES_BY_ID[patch_id]
            if player_state["buttons"] < patch["cost_buttons"]:
                continue
            placement = _find_legal_placement(player_state["quilt_board"], patch_id)
            if placement:
                return {"type": "buy_patch", "patch_id": patch_id, **placement}
        return {"type": "advance"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
