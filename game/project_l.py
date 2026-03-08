import json
import random
import time
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple

Matrix = List[List[int]]
Coord = Tuple[int, int]

BASE_DIR = Path(__file__).resolve().parent.parent
PUZZLE_PATH = BASE_DIR / "assets" / "project_l" / "project_l_puzzles_base.json"

PIECE_DEFS: Dict[str, Dict[str, object]] = {
    "L1_I": {"level": 1, "color": "#f6d65b", "shape": [[1]]},
    "L2_I": {"level": 2, "color": "#6bcb77", "shape": [[1, 1]]},
    "L3_I": {"level": 3, "color": "#f4a261", "shape": [[1, 1, 1]]},
    "L3_V": {"level": 3, "color": "#4d96ff", "shape": [[1, 1], [1, 0]]},
    "L4_I": {"level": 4, "color": "#f28482", "shape": [[1, 1, 1, 1]]},
    "L4_O": {"level": 4, "color": "#58c4dd", "shape": [[1, 1], [1, 1]]},
    "L4_T": {"level": 4, "color": "#6ee7b7", "shape": [[1, 1, 1], [0, 1, 0]]},
    "L4_L": {"level": 4, "color": "#9b5de5", "shape": [[1, 1, 1], [1, 0, 0]]},
    "L4_Z": {"level": 4, "color": "#a3b18a", "shape": [[1, 1, 0], [0, 1, 1]]},
}

PIECE_LEVELS = {piece_id: int(data["level"]) for piece_id, data in PIECE_DEFS.items()}
PIECE_IDS = list(PIECE_DEFS.keys())


def _load_puzzles() -> Dict[int, Dict[str, object]]:
    data = json.loads(PUZZLE_PATH.read_text(encoding="utf-8"))
    puzzles: Dict[int, Dict[str, object]] = {}
    for entry in data:
        card_id = int(entry["id"])
        grid = entry["grid"]
        cell_count = sum(sum(int(cell) for cell in row) for row in grid)
        deck_type = "white" if card_id <= 32 else "black"
        puzzles[card_id] = {
            "id": card_id,
            "width": int(entry["width"]),
            "height": int(entry["height"]),
            "grid": grid,
            "reward_piece_id": entry["reward_piece_id"],
            "points": int(entry["points"]),
            "deck_type": deck_type,
            "cell_count": cell_count,
        }
    return puzzles


PUZZLES = _load_puzzles()
WHITE_IDS = [card_id for card_id in sorted(PUZZLES) if PUZZLES[card_id]["deck_type"] == "white"]
BLACK_IDS = [card_id for card_id in sorted(PUZZLES) if PUZZLES[card_id]["deck_type"] == "black"]


def _rotate_matrix(matrix: Matrix) -> Matrix:
    if not matrix:
        return []
    height = len(matrix)
    width = len(matrix[0])
    rotated = [[0 for _ in range(height)] for _ in range(width)]
    for r in range(height):
        for c in range(width):
            rotated[c][height - 1 - r] = matrix[r][c]
    return rotated


def _flip_matrix(matrix: Matrix) -> Matrix:
    return [list(reversed(row)) for row in matrix]


def _transform_matrix(matrix: Matrix, rotation: int, flip: bool) -> Matrix:
    transformed = matrix
    if flip:
        transformed = _flip_matrix(transformed)
    turns = (rotation % 360) // 90
    for _ in range(turns):
        transformed = _rotate_matrix(transformed)
    return transformed


def _matrix_cells(matrix: Matrix) -> List[Coord]:
    cells: List[Coord] = []
    for r, row in enumerate(matrix):
        for c, value in enumerate(row):
            if value:
                cells.append((r, c))
    return cells


def _placement_cells(piece_id: str, rotation: int, flip: bool, row: int, col: int) -> List[Coord]:
    shape = PIECE_DEFS[piece_id]["shape"]
    transformed = _transform_matrix(shape, rotation, flip)
    cells: List[Coord] = []
    for r, c in _matrix_cells(transformed):
        cells.append((row + r, col + c))
    return cells


def _occupied_cells(puzzle_state: Dict, puzzle_def: Dict[str, object]) -> Dict[Coord, str]:
    occupied: Dict[Coord, str] = {}
    for placement in puzzle_state.get("placed", []):
        piece_id = placement["piece_id"]
        rotation = placement["rotation"]
        flip = placement["flip"]
        row = placement["row"]
        col = placement["col"]
        for cell in _placement_cells(piece_id, rotation, flip, row, col):
            occupied[cell] = piece_id
    return occupied


def _is_valid_rotation(rotation: object) -> bool:
    return rotation in (0, 90, 180, 270)


def _can_place_piece(
    puzzle_state: Dict,
    piece_id: str,
    rotation: int,
    flip: bool,
    row: int,
    col: int,
) -> Tuple[bool, str]:
    if piece_id not in PIECE_DEFS:
        return False, "unknown piece"
    if not _is_valid_rotation(rotation):
        return False, "invalid rotation"
    if not isinstance(flip, bool):
        return False, "invalid flip"
    if not isinstance(row, int) or not isinstance(col, int):
        return False, "invalid origin"
    puzzle_def = PUZZLES.get(puzzle_state.get("card_id"))
    if not puzzle_def:
        return False, "unknown puzzle"

    shape = PIECE_DEFS[piece_id]["shape"]
    transformed = _transform_matrix(shape, rotation, flip)
    height = len(transformed)
    width = len(transformed[0]) if transformed else 0
    if row < 0 or col < 0 or row + height > puzzle_def["height"] or col + width > puzzle_def["width"]:
        return False, "out of bounds"

    grid = puzzle_def["grid"]
    occupied = _occupied_cells(puzzle_state, puzzle_def)
    for r, c in _matrix_cells(transformed):
        gr = row + r
        gc = col + c
        if grid[gr][gc] != 1:
            return False, "invalid cell"
        if (gr, gc) in occupied:
            return False, "cell occupied"
    return True, ""


def _puzzle_completed(puzzle_state: Dict) -> bool:
    puzzle_def = PUZZLES.get(puzzle_state.get("card_id"))
    if not puzzle_def:
        return False
    occupied = _occupied_cells(puzzle_state, puzzle_def)
    return len(occupied) == puzzle_def["cell_count"]


def _complete_puzzle(
    player_id: str,
    player_state: Dict,
    puzzle_index: int,
    reward_allowed: bool,
    events: List[Dict],
) -> None:
    puzzle_state = player_state["active_puzzles"].pop(puzzle_index)
    card_id = puzzle_state["card_id"]
    puzzle_def = PUZZLES[card_id]
    placed = puzzle_state.get("placed", [])
    returned = [placement["piece_id"] for placement in placed]
    player_state["inventory"].extend(returned)
    reward_piece = None
    if reward_allowed:
        reward_piece = puzzle_def["reward_piece_id"]
        player_state["inventory"].append(reward_piece)
    player_state["completed_puzzles"].append(card_id)
    player_state["score"] += puzzle_def["points"]
    events.append(
        {
            "type": "project_l:complete_puzzle",
            "payload": {
                "player_id": player_id,
                "card_id": card_id,
                "points": puzzle_def["points"],
                "reward_piece_id": reward_piece,
            },
        }
    )


def _take_from_deck(deck: List[int]) -> Optional[int]:
    if not deck:
        return None
    return deck.pop()


def _maybe_trigger_end(state: Dict, events: List[Dict]) -> None:
    if state.get("end_triggered"):
        return
    if len(state.get("black_deck", [])) == 0:
        state["end_triggered"] = True
        events.append({"type": "project_l:end_triggered", "payload": {}})


def _end_turn(state: Dict, finished_player_id: str, events: List[Dict]) -> None:
    if state.get("phase") != "main":
        return
    if state.get("end_triggered") and finished_player_id == state.get("end_after_player"):
        state["phase"] = "finishing"
        state["current_turn"] = None
        state["current_ap"] = 0
        state["master_used"] = False
        for pdata in state["players"].values():
            pdata["finishing_done"] = False
        events.append({"type": "project_l:finishing_start", "payload": {}})
        return

    order = state.get("turn_order", [])
    if not order:
        state["current_turn"] = None
        return
    try:
        idx = order.index(finished_player_id)
    except ValueError:
        idx = 0
    next_player = order[(idx + 1) % len(order)]
    state["current_turn"] = next_player
    state["current_ap"] = 3
    state["master_used"] = False


def _finalize_game(state: Dict) -> None:
    scores: Dict[str, int] = {}
    for pid, pdata in state["players"].items():
        scores[pid] = pdata["score"] - pdata.get("finishing_placed", 0)
    state["scores"] = scores

    if not scores:
        state["winner"] = []
    else:
        max_score = max(scores.values())
        candidates = [pid for pid, score in scores.items() if score == max_score]
        if len(candidates) > 1:
            max_completed = max(len(state["players"][pid]["completed_puzzles"]) for pid in candidates)
            candidates = [pid for pid in candidates if len(state["players"][pid]["completed_puzzles"]) == max_completed]
        if len(candidates) > 1:
            max_inventory = max(len(state["players"][pid]["inventory"]) for pid in candidates)
            candidates = [pid for pid in candidates if len(state["players"][pid]["inventory"]) == max_inventory]
        state["winner"] = candidates

    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None


def _can_upgrade(piece_id: str, target_id: str) -> bool:
    if piece_id not in PIECE_LEVELS or target_id not in PIECE_LEVELS:
        return False
    if piece_id == target_id:
        return False
    from_level = PIECE_LEVELS[piece_id]
    to_level = PIECE_LEVELS[target_id]
    if from_level == 4:
        return to_level == 4
    if to_level == from_level + 1:
        return True
    if to_level == from_level and from_level >= 3:
        return True
    return False


def _has_any_upgrade(inventory: List[str]) -> bool:
    if not inventory:
        return False
    available = set(inventory)
    for piece_id in available:
        for target_id in PIECE_IDS:
            if _can_upgrade(piece_id, target_id):
                return True
    return False


def _player_by_id(state: Dict, player_id: str) -> Optional[Dict]:
    return state.get("players", {}).get(player_id)


class ProjectLGame:
    game_id = "project_l"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered_players = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in ordered_players]
        player_meta = {p["player_id"]: p for p in ordered_players}

        start_player = random.choice(player_ids)
        start_index = player_ids.index(start_player)
        end_after_player = player_ids[start_index - 1] if start_index > 0 else player_ids[-1]

        white_deck = list(WHITE_IDS)
        black_deck = list(BLACK_IDS)
        random.shuffle(white_deck)
        random.shuffle(black_deck)

        market = {"white": [], "black": []}
        for _ in range(4):
            market["white"].append(_take_from_deck(white_deck))
            market["black"].append(_take_from_deck(black_deck))

        state_players: Dict[str, Dict] = {}
        for pid in player_ids:
            state_players[pid] = {
                "inventory": ["L1_I", "L2_I"],
                "active_puzzles": [],
                "completed_puzzles": [],
                "score": 0,
                "finishing_placed": 0,
                "finishing_done": False,
            }

        return {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": start_player,
            "current_ap": 3,
            "master_used": False,
            "white_deck": white_deck,
            "black_deck": black_deck,
            "market": market,
            "phase": "main",
            "game_over": False,
            "winner": [],
            "scores": {},
            "start_player": start_player,
            "end_after_player": end_after_player,
            "end_triggered": False,
            "game_start_time": time.time(),
            "config": config or {},
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        phase = state.get("phase", "main")
        pdata = _player_by_id(state, player_id)
        if not pdata:
            return []

        if phase == "finishing":
            if pdata.get("finishing_done"):
                return []
            actions = ["finishing_done"]
            if pdata.get("inventory") and pdata.get("active_puzzles"):
                actions.insert(0, "finishing_place")
            return actions

        if player_id != state.get("current_turn"):
            return []
        if state.get("current_ap", 0) <= 0:
            return []

        actions = ["take_level1"]
        if len(pdata.get("active_puzzles", [])) < 4:
            market = state.get("market", {})
            market_has = any(card is not None for card in market.get("white", [])) or any(
                card is not None for card in market.get("black", [])
            )
            deck_has = bool(state.get("white_deck")) or bool(state.get("black_deck"))
            if market_has or deck_has:
                actions.append("take_puzzle")
        if _has_any_upgrade(pdata.get("inventory", [])):
            actions.append("upgrade_piece")
        if pdata.get("inventory") and pdata.get("active_puzzles"):
            actions.append("place_piece")
            if not state.get("master_used"):
                actions.append("master_action")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"

        phase = state.get("phase", "main")
        if phase == "finishing":
            return ProjectLGame._apply_finishing(state, player_id, action)

        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if state.get("current_ap", 0) <= 0:
            return [], "turn over"

        pdata = _player_by_id(state, player_id)
        if not pdata:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "take_level1":
            pdata["inventory"].append("L1_I")
            events.append({"type": "project_l:take_level1", "payload": {"player_id": player_id}})

        elif action_type == "take_puzzle":
            if len(pdata["active_puzzles"]) >= 4:
                return [], "too many active puzzles"
            source = action.get("source")
            deck = action.get("deck")
            if deck not in ("white", "black"):
                return [], "invalid deck"
            if source == "market":
                index = action.get("index")
                if not isinstance(index, int):
                    return [], "invalid index"
                market = state.get("market", {})
                pile = market.get(deck, [])
                if index < 0 or index >= len(pile):
                    return [], "invalid index"
                card_id = pile[index]
                if card_id is None:
                    return [], "empty market slot"
                pile[index] = _take_from_deck(state[f"{deck}_deck"])
                pdata["active_puzzles"].append({"card_id": card_id, "placed": []})
                events.append(
                    {
                        "type": "project_l:take_puzzle",
                        "payload": {
                            "player_id": player_id,
                            "card_id": card_id,
                            "source": "market",
                            "deck": deck,
                            "index": index,
                        },
                    }
                )
            elif source == "deck":
                card_id = _take_from_deck(state[f"{deck}_deck"])
                if card_id is None:
                    return [], "deck empty"
                pdata["active_puzzles"].append({"card_id": card_id, "placed": []})
                events.append(
                    {
                        "type": "project_l:take_puzzle",
                        "payload": {
                            "player_id": player_id,
                            "card_id": card_id,
                            "source": "deck",
                            "deck": deck,
                        },
                    }
                )
            else:
                return [], "invalid source"
            if deck == "black":
                _maybe_trigger_end(state, events)

        elif action_type == "upgrade_piece":
            from_piece = action.get("from_piece_id")
            to_piece = action.get("to_piece_id")
            if from_piece not in pdata.get("inventory", []):
                return [], "missing piece"
            if not _can_upgrade(from_piece, to_piece):
                return [], "invalid upgrade"
            pdata["inventory"].remove(from_piece)
            pdata["inventory"].append(to_piece)
            events.append(
                {
                    "type": "project_l:upgrade_piece",
                    "payload": {
                        "player_id": player_id,
                        "from_piece_id": from_piece,
                        "to_piece_id": to_piece,
                    },
                }
            )

        elif action_type == "place_piece":
            puzzle_index = action.get("puzzle_index")
            piece_id = action.get("piece_id")
            rotation = action.get("rotation")
            flip = action.get("flip")
            row = action.get("row")
            col = action.get("col")
            if not isinstance(puzzle_index, int):
                return [], "invalid puzzle"
            if puzzle_index < 0 or puzzle_index >= len(pdata.get("active_puzzles", [])):
                return [], "invalid puzzle"
            if piece_id not in pdata.get("inventory", []):
                return [], "missing piece"
            puzzle_state = pdata["active_puzzles"][puzzle_index]
            ok, reason = _can_place_piece(puzzle_state, piece_id, rotation, flip, row, col)
            if not ok:
                return [], reason
            pdata["inventory"].remove(piece_id)
            puzzle_state.setdefault("placed", []).append(
                {
                    "piece_id": piece_id,
                    "rotation": rotation,
                    "flip": bool(flip),
                    "row": row,
                    "col": col,
                }
            )
            events.append(
                {
                    "type": "project_l:place_piece",
                    "payload": {
                        "player_id": player_id,
                        "card_id": puzzle_state["card_id"],
                        "piece_id": piece_id,
                        "rotation": rotation,
                        "flip": bool(flip),
                        "row": row,
                        "col": col,
                    },
                }
            )
            if _puzzle_completed(puzzle_state):
                _complete_puzzle(player_id, pdata, puzzle_index, True, events)

        elif action_type == "master_action":
            if state.get("master_used"):
                return [], "master already used"
            placements = action.get("placements")
            if not isinstance(placements, list) or not placements:
                return [], "invalid placements"
            if len(placements) > len(pdata.get("active_puzzles", [])):
                return [], "too many placements"

            used_puzzles: set = set()
            needed = Counter()
            for placement in placements:
                puzzle_index = placement.get("puzzle_index")
                piece_id = placement.get("piece_id")
                rotation = placement.get("rotation")
                flip = placement.get("flip")
                row = placement.get("row")
                col = placement.get("col")
                if not isinstance(puzzle_index, int):
                    return [], "invalid puzzle"
                if puzzle_index < 0 or puzzle_index >= len(pdata.get("active_puzzles", [])):
                    return [], "invalid puzzle"
                if puzzle_index in used_puzzles:
                    return [], "duplicate puzzle"
                used_puzzles.add(puzzle_index)
                if piece_id not in PIECE_DEFS:
                    return [], "unknown piece"
                ok, reason = _can_place_piece(
                    pdata["active_puzzles"][puzzle_index], piece_id, rotation, flip, row, col
                )
                if not ok:
                    return [], reason
                needed[piece_id] += 1

            inventory_counts = Counter(pdata.get("inventory", []))
            for piece_id, count in needed.items():
                if inventory_counts[piece_id] < count:
                    return [], "missing piece"

            for piece_id, count in needed.items():
                for _ in range(count):
                    pdata["inventory"].remove(piece_id)

            for placement in placements:
                puzzle_index = placement["puzzle_index"]
                pdata["active_puzzles"][puzzle_index].setdefault("placed", []).append(
                    {
                        "piece_id": placement["piece_id"],
                        "rotation": placement["rotation"],
                        "flip": bool(placement["flip"]),
                        "row": placement["row"],
                        "col": placement["col"],
                    }
                )
            state["master_used"] = True
            events.append(
                {
                    "type": "project_l:master_action",
                    "payload": {
                        "player_id": player_id,
                        "placements": placements,
                    },
                }
            )

            completed_indices = [
                idx
                for idx in range(len(pdata["active_puzzles"]))
                if _puzzle_completed(pdata["active_puzzles"][idx])
            ]
            for idx in sorted(completed_indices, reverse=True):
                _complete_puzzle(player_id, pdata, idx, True, events)

        else:
            return [], "invalid action"

        state["current_ap"] = int(state.get("current_ap", 0)) - 1
        if state["current_ap"] <= 0:
            events.append({"type": "project_l:end_turn", "payload": {"player_id": player_id}})
            _end_turn(state, player_id, events)
        return events, None

    @staticmethod
    def _apply_finishing(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        pdata = _player_by_id(state, player_id)
        if not pdata:
            return [], "unknown player"
        if pdata.get("finishing_done"):
            return [], "already finished"

        action_type = action.get("type")
        events: List[Dict] = []
        if action_type == "finishing_place":
            puzzle_index = action.get("puzzle_index")
            piece_id = action.get("piece_id")
            rotation = action.get("rotation")
            flip = action.get("flip")
            row = action.get("row")
            col = action.get("col")
            if not isinstance(puzzle_index, int):
                return [], "invalid puzzle"
            if puzzle_index < 0 or puzzle_index >= len(pdata.get("active_puzzles", [])):
                return [], "invalid puzzle"
            if piece_id not in pdata.get("inventory", []):
                return [], "missing piece"
            puzzle_state = pdata["active_puzzles"][puzzle_index]
            ok, reason = _can_place_piece(puzzle_state, piece_id, rotation, flip, row, col)
            if not ok:
                return [], reason
            pdata["inventory"].remove(piece_id)
            pdata["finishing_placed"] = pdata.get("finishing_placed", 0) + 1
            puzzle_state.setdefault("placed", []).append(
                {
                    "piece_id": piece_id,
                    "rotation": rotation,
                    "flip": bool(flip),
                    "row": row,
                    "col": col,
                }
            )
            events.append(
                {
                    "type": "project_l:finishing_place",
                    "payload": {
                        "player_id": player_id,
                        "card_id": puzzle_state["card_id"],
                        "piece_id": piece_id,
                        "rotation": rotation,
                        "flip": bool(flip),
                        "row": row,
                        "col": col,
                    },
                }
            )
            if _puzzle_completed(puzzle_state):
                _complete_puzzle(player_id, pdata, puzzle_index, False, events)

        elif action_type == "finishing_done":
            pdata["finishing_done"] = True
            events.append({"type": "project_l:finishing_done", "payload": {"player_id": player_id}})
            if all(player.get("finishing_done") for player in state.get("players", {}).values()):
                _finalize_game(state)
                events.append({"type": "project_l:game_over", "payload": {"winner": state.get("winner", [])}})

        else:
            return [], "invalid action"

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
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": pdata.get("score", 0),
                    "finishing_placed": pdata.get("finishing_placed", 0),
                    "finishing_done": pdata.get("finishing_done", False),
                    "inventory": list(pdata.get("inventory", [])),
                    "active_puzzles": list(pdata.get("active_puzzles", [])),
                    "completed_puzzles": list(pdata.get("completed_puzzles", [])),
                }
            )

        return {
            "game_id": ProjectLGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase", "main"),
            "current_turn": state.get("current_turn"),
            "ap_remaining": state.get("current_ap"),
            "master_used": state.get("master_used", False),
            "market": state.get("market", {}),
            "white_remaining": len(state.get("white_deck", [])),
            "black_remaining": len(state.get("black_deck", [])),
            "players": players_view,
            "piece_defs": PIECE_DEFS,
            "puzzle_defs": PUZZLES,
            "legal_actions": ProjectLGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "scores": state.get("scores", {}),
            "end_triggered": state.get("end_triggered", False),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        phase = state.get("phase", "main")
        pdata = _player_by_id(state, bot_id)
        if not pdata:
            return None

        if phase == "finishing":
            if pdata.get("finishing_done"):
                return None
            if pdata.get("inventory") and pdata.get("active_puzzles"):
                puzzle_index = 0
                puzzle_state = pdata["active_puzzles"][puzzle_index]
                for piece_id in pdata["inventory"]:
                    for rotation in (0, 90, 180, 270):
                        for flip in (False, True):
                            for row in range(PUZZLES[puzzle_state["card_id"]]["height"]):
                                for col in range(PUZZLES[puzzle_state["card_id"]]["width"]):
                                    ok, _ = _can_place_piece(puzzle_state, piece_id, rotation, flip, row, col)
                                    if ok:
                                        return {
                                            "type": "finishing_place",
                                            "puzzle_index": puzzle_index,
                                            "piece_id": piece_id,
                                            "rotation": rotation,
                                            "flip": flip,
                                            "row": row,
                                            "col": col,
                                        }
            return {"type": "finishing_done"}

        if bot_id != state.get("current_turn"):
            return None

        if len(pdata.get("active_puzzles", [])) < 4:
            market = state.get("market", {})
            black_market = market.get("black", [])
            white_market = market.get("white", [])
            for idx, card_id in enumerate(black_market):
                if card_id is not None:
                    return {"type": "take_puzzle", "source": "market", "deck": "black", "index": idx}
            for idx, card_id in enumerate(white_market):
                if card_id is not None:
                    return {"type": "take_puzzle", "source": "market", "deck": "white", "index": idx}
            if state.get("black_deck"):
                return {"type": "take_puzzle", "source": "deck", "deck": "black"}
            if state.get("white_deck"):
                return {"type": "take_puzzle", "source": "deck", "deck": "white"}

        if pdata.get("inventory") and pdata.get("active_puzzles"):
            puzzle_index = 0
            puzzle_state = pdata["active_puzzles"][puzzle_index]
            for piece_id in pdata["inventory"]:
                for rotation in (0, 90, 180, 270):
                    for flip in (False, True):
                        for row in range(PUZZLES[puzzle_state["card_id"]]["height"]):
                            for col in range(PUZZLES[puzzle_state["card_id"]]["width"]):
                                ok, _ = _can_place_piece(puzzle_state, piece_id, rotation, flip, row, col)
                                if ok:
                                    return {
                                        "type": "place_piece",
                                        "puzzle_index": puzzle_index,
                                        "piece_id": piece_id,
                                        "rotation": rotation,
                                        "flip": flip,
                                        "row": row,
                                        "col": col,
                                    }

        if _has_any_upgrade(pdata.get("inventory", [])):
            for from_piece in pdata.get("inventory", []):
                for target_id in PIECE_IDS:
                    if _can_upgrade(from_piece, target_id):
                        return {"type": "upgrade_piece", "from_piece_id": from_piece, "to_piece_id": target_id}

        return {"type": "take_level1"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
