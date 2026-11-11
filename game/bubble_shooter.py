"""Bubble Shooter (泡泡龙): simultaneous endless runs on one shared seed.

Every player gets their own board and nobody ever waits. The seed decides the
waves, the ceiling pushes and the bubble queue, and none of those draws look at
the player id, so two players who make the same moves see exactly the same
game. That is what makes the score race fair.

Boards advance independently. A board retires when its stack crosses the
warning line, and the match ends once every board is out. Ranking is by score.
"""

import copy
import math
import random
from typing import Dict, List, Optional, Sequence, Tuple

# --- Geometry -------------------------------------------------------------
# Everything is expressed in bubble diameters, so the browser can scale the
# board to any pixel size without the rules changing.

COLS = 11
ROW_HEIGHT = math.sqrt(3.0) / 2.0
MAX_ROWS = 16
DEATH_ROW = 13
BOARD_WIDTH = float(COLS)
BOARD_HEIGHT = 14.0
DEATH_LINE_Y = 11.6
SHOOTER_X = BOARD_WIDTH / 2.0
SHOOTER_Y = 12.95
MAX_ANGLE = 82.0
RAY_STEP = 0.06
MAX_RAY_STEPS = 900
COLLIDE_DIST = 0.94
SNAP_SEARCH_ROWS = 3
BOMB_RADIUS = 2.1

COLORS: Tuple[str, ...] = ("red", "orange", "yellow", "green", "blue", "purple")
COLOR_SET = frozenset(COLORS)
RAINBOW = "rainbow"
BOMB = "bomb"

BOMB_CHANCE = 0.06
RAINBOW_CHANCE = 0.04
WAVE_HOLE_CHANCE = 0.12
QUEUE_LENGTH = 3
MAX_PLAYERS = 8

DEFAULT_CONFIG = {
    "endless_colors": 4,
    "endless_push_interval": 6,
    "hammer_charges": 3,
    "aim_charges": 3,
    "aim_shots_per_charge": 3,
    "seed": 0,
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "endless_colors": {"type": "integer", "enum": [3, 4, 5, 6]},
        "endless_push_interval": {"type": "integer", "enum": [0, 4, 6, 8]},
        "hammer_charges": {"type": "integer", "enum": [0, 1, 2, 3, 5]},
        "aim_charges": {"type": "integer", "enum": [0, 1, 2, 3, 5]},
        "aim_shots_per_charge": {"type": "integer", "minimum": 1, "maximum": 9},
        "seed": {"type": "integer"},
    },
    "additionalProperties": False,
}

ACTION_SCHEMA = {
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"enum": ["shoot"]},
                "angle": {"type": "number", "minimum": -MAX_ANGLE, "maximum": MAX_ANGLE},
            },
            "required": ["type", "angle"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"enum": ["use_item"]},
                "item": {"enum": ["hammer", "aim"]},
                "row": {"type": "integer", "minimum": 0, "maximum": MAX_ROWS - 1},
                "col": {"type": "integer", "minimum": 0, "maximum": COLS - 1},
            },
            "required": ["type", "item"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"enum": ["new_game", "play_again"]}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ]
}


# --- Grid helpers ---------------------------------------------------------


def _parity(row: int, top_parity: int) -> int:
    return (row + top_parity) % 2


def _row_width(row: int, top_parity: int) -> int:
    return COLS if _parity(row, top_parity) == 0 else COLS - 1


def _center(row: int, col: int, top_parity: int) -> Tuple[float, float]:
    offset = 0.5 if _parity(row, top_parity) else 0.0
    return (col + 0.5 + offset, (row + 0.5) * ROW_HEIGHT)


_NEIGHBOR_DELTAS = {
    0: ((0, -1), (0, 1), (-1, -1), (-1, 0), (1, -1), (1, 0)),
    1: ((0, -1), (0, 1), (-1, 0), (-1, 1), (1, 0), (1, 1)),
}


def _in_bounds(row: int, col: int, top_parity: int) -> bool:
    return 0 <= row < MAX_ROWS and 0 <= col < _row_width(row, top_parity)


def _neighbors(row: int, col: int, top_parity: int) -> List[Tuple[int, int]]:
    result = []
    for d_row, d_col in _NEIGHBOR_DELTAS[_parity(row, top_parity)]:
        candidate = (row + d_row, col + d_col)
        if _in_bounds(candidate[0], candidate[1], top_parity):
            result.append(candidate)
    return result


def _empty_grid(top_parity: int) -> List[List[Optional[str]]]:
    return [[None] * _row_width(row, top_parity) for row in range(MAX_ROWS)]


def _occupied(grid: List[List[Optional[str]]], top_parity: int) -> List[Tuple[int, int, float, float]]:
    cells = []
    for row in range(MAX_ROWS):
        line = grid[row]
        for col in range(len(line)):
            if line[col] is not None:
                x, y = _center(row, col, top_parity)
                cells.append((row, col, x, y))
    return cells


def _board_empty(grid: List[List[Optional[str]]]) -> bool:
    return all(cell is None for line in grid for cell in line)


def _lowest_row(grid: List[List[Optional[str]]]) -> int:
    lowest = -1
    for row in range(MAX_ROWS):
        if any(cell is not None for cell in grid[row]):
            lowest = row
    return lowest


def _colors_on_board(grid: List[List[Optional[str]]]) -> List[str]:
    found = {cell for line in grid for cell in line if cell in COLOR_SET}
    return [color for color in COLORS if color in found]


# --- Shot simulation ------------------------------------------------------


def _collides(cells: Sequence[Tuple[int, int, float, float]], x: float, y: float):
    limit = COLLIDE_DIST * COLLIDE_DIST
    for row, col, cx, cy in cells:
        if abs(cy - y) > COLLIDE_DIST:
            continue
        if (cx - x) ** 2 + (cy - y) ** 2 < limit:
            return (row, col)
    return None


def _simulate(cells, angle_deg: float) -> Tuple[List[List[float]], Tuple[float, float]]:
    """Trace the shot, bouncing off the side walls, until it hits something."""
    radians = math.radians(angle_deg)
    vx = math.sin(radians)
    vy = -math.cos(radians)
    x, y = SHOOTER_X, SHOOTER_Y
    path: List[List[float]] = [[round(x, 4), round(y, 4)]]
    for _ in range(MAX_RAY_STEPS):
        x += vx * RAY_STEP
        y += vy * RAY_STEP
        if x < 0.5:
            x = 1.0 - x
            vx = -vx
            path.append([round(x, 4), round(y, 4)])
        elif x > BOARD_WIDTH - 0.5:
            x = 2.0 * (BOARD_WIDTH - 0.5) - x
            vx = -vx
            path.append([round(x, 4), round(y, 4)])
        if y <= 0.5:
            y = 0.5
            path.append([round(x, 4), round(y, 4)])
            break
        if _collides(cells, x, y):
            path.append([round(x, 4), round(y, 4)])
            break
    return path, (x, y)


def _snap_cell(grid, top_parity: int, x: float, y: float) -> Optional[Tuple[int, int]]:
    """Pick the empty cell the shot should settle into."""
    anchor = int(y / ROW_HEIGHT)
    best = None
    best_distance = None
    for row in range(max(0, anchor - SNAP_SEARCH_ROWS), min(MAX_ROWS, anchor + SNAP_SEARCH_ROWS + 2)):
        for col in range(_row_width(row, top_parity)):
            if grid[row][col] is not None:
                continue
            if row != 0 and not any(
                grid[n_row][n_col] is not None
                for n_row, n_col in _neighbors(row, col, top_parity)
            ):
                continue
            cx, cy = _center(row, col, top_parity)
            distance = (cx - x) ** 2 + (cy - y) ** 2
            if best_distance is None or distance < best_distance:
                best_distance = distance
                best = (row, col)
    return best


def _match_group(grid, top_parity: int, row: int, col: int) -> List[Tuple[int, int]]:
    """Connected same-colour run containing the freshly landed bubble."""
    seed = grid[row][col]
    if seed is None or seed == BOMB:
        return []
    if seed == RAINBOW:
        counts: Dict[str, int] = {}
        for n_row, n_col in _neighbors(row, col, top_parity):
            value = grid[n_row][n_col]
            if value in COLOR_SET:
                counts[value] = counts.get(value, 0) + 1
        if not counts:
            return []
        target = max(sorted(counts), key=lambda key: counts[key])
    else:
        target = seed

    group: List[Tuple[int, int]] = []
    seen = {(row, col)}
    stack = [(row, col)]
    while stack:
        current = stack.pop()
        value = grid[current[0]][current[1]]
        if value != target and value != RAINBOW:
            continue
        group.append(current)
        for neighbor in _neighbors(current[0], current[1], top_parity):
            if neighbor in seen:
                continue
            neighbor_value = grid[neighbor[0]][neighbor[1]]
            if neighbor_value is None:
                continue
            if neighbor_value == target or neighbor_value == RAINBOW:
                seen.add(neighbor)
                stack.append(neighbor)
    return group if len(group) >= 3 else []


def _explode_cells(grid, top_parity: int, row: int, col: int) -> List[Tuple[int, int]]:
    origin_x, origin_y = _center(row, col, top_parity)
    limit = BOMB_RADIUS * BOMB_RADIUS
    cells = []
    for other_row in range(MAX_ROWS):
        line = grid[other_row]
        for other_col in range(len(line)):
            if line[other_col] is None:
                continue
            cx, cy = _center(other_row, other_col, top_parity)
            if (cx - origin_x) ** 2 + (cy - origin_y) ** 2 <= limit:
                cells.append((other_row, other_col))
    return cells


def _floating_cells(grid, top_parity: int) -> List[Tuple[int, int]]:
    anchored = set()
    stack = [(0, col) for col in range(_row_width(0, top_parity)) if grid[0][col] is not None]
    anchored.update(stack)
    while stack:
        row, col = stack.pop()
        for neighbor in _neighbors(row, col, top_parity):
            if neighbor in anchored:
                continue
            if grid[neighbor[0]][neighbor[1]] is None:
                continue
            anchored.add(neighbor)
            stack.append(neighbor)
    floating = []
    for row in range(MAX_ROWS):
        line = grid[row]
        for col in range(len(line)):
            if line[col] is not None and (row, col) not in anchored:
                floating.append((row, col))
    return floating


def _clear_cells(grid, cells: Sequence[Tuple[int, int]]) -> None:
    for row, col in cells:
        grid[row][col] = None


# --- Deterministic draws --------------------------------------------------
# No player id ever enters the seed. Identical play therefore replays an
# identical game on every board, which is what makes the race comparable.


def _rng(seed: int, kind: str, index: int) -> random.Random:
    return random.Random("%s:%s:%s" % (seed, kind, index))


def _queue_color(board: Dict, rng: random.Random) -> str:
    roll = rng.random()
    if roll < BOMB_CHANCE:
        return BOMB
    if roll < BOMB_CHANCE + RAINBOW_CHANCE:
        return RAINBOW
    palette = _colors_on_board(board["grid"]) or list(board["palette"])
    return rng.choice(palette)


def _refill_queue(board: Dict) -> None:
    if len(board["queue"]) >= QUEUE_LENGTH:
        return
    board["queue_counter"] = int(board.get("queue_counter", 0)) + 1
    rng = _rng(board["seed"], "queue", board["queue_counter"])
    while len(board["queue"]) < QUEUE_LENGTH:
        board["queue"].append(_queue_color(board, rng))


def _new_wave(board: Dict) -> None:
    """Fill a fresh wave at the top of an otherwise empty board."""
    rng = _rng(board["seed"], "wave", int(board["wave"]))
    palette = list(board["palette"])
    rows = min(4 + int(board["wave"]), 7)
    parity = board["top_parity"]
    for row in range(rows):
        width = _row_width(row, parity)
        line: List[Optional[str]] = []
        for _ in range(width):
            if row >= 2 and rng.random() < WAVE_HOLE_CHANCE:
                line.append(None)
            else:
                line.append(rng.choice(palette))
        board["grid"][row] = line
    for row in range(rows, MAX_ROWS):
        board["grid"][row] = [None] * _row_width(row, parity)


def _push_row(board: Dict) -> List[Tuple[int, int]]:
    """Drop the ceiling by one row, flipping the stagger like the arcade does."""
    board["push_index"] = int(board.get("push_index", 0)) + 1
    rng = _rng(board["seed"], "push", board["push_index"])
    grid = board["grid"]
    top_parity = 1 - board["top_parity"]
    crushed: List[Tuple[int, int]] = []
    new_top = [rng.choice(list(board["palette"])) for _ in range(_row_width(0, top_parity))]
    shifted: List[List[Optional[str]]] = [new_top]
    for row in range(MAX_ROWS - 1):
        source = grid[row]
        width = _row_width(row + 1, top_parity)
        line = list(source[:width])
        for col in range(width, len(source)):
            if source[col] is not None:
                crushed.append((row + 1, col))
        while len(line) < width:
            line.append(None)
        shifted.append(line)
    board["grid"] = shifted
    board["top_parity"] = top_parity
    return crushed


# --- Board lifecycle ------------------------------------------------------


def _new_board(config: Dict, player_id: str) -> Dict:
    board = {
        "player_id": player_id,
        "seed": int(config["seed"]),
        "palette": list(COLORS[: int(config["endless_colors"])]),
        "top_parity": 0,
        "grid": _empty_grid(0),
        "queue": [],
        "queue_counter": 0,
        "items": {
            "hammer": int(config["hammer_charges"]),
            "aim": int(config["aim_charges"]),
        },
        "aim_left": 0,
        "score": 0,
        "combo": 0,
        "best_combo": 0,
        "shots": 0,
        "wave": 1,
        "push_countdown": int(config["endless_push_interval"]),
        "push_index": 0,
        "popped_total": 0,
        "dropped_total": 0,
        "shot_id": 0,
        "last_shot": None,
        "phase": "playing",
        "game_over": False,
        "result": None,
    }
    _new_wave(board)
    _refill_queue(board)
    return board


def _start_match(state: Dict) -> None:
    config = state["config"]
    state["boards"] = {pid: _new_board(config, pid) for pid in state["turn_order"]}
    for pid in state["turn_order"]:
        state["players"][pid] = {"score": 0, "shots": 0}
    state["phase"] = "playing"
    state["game_over"] = False
    state["result"] = None
    state["winner_ids"] = []


def _merge_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if config:
        unknown = set(config) - set(DEFAULT_CONFIG)
        if unknown:
            raise ValueError("unknown Bubble Shooter configuration")
        merged.update(config)
    for key in DEFAULT_CONFIG:
        if type(merged[key]) is not int:
            raise ValueError("%s must be an integer" % key)
    if merged["endless_colors"] not in (3, 4, 5, 6):
        raise ValueError("endless_colors must be 3, 4, 5 or 6")
    if merged["endless_push_interval"] not in (0, 4, 6, 8):
        raise ValueError("endless_push_interval must be 0, 4, 6 or 8")
    for key in ("hammer_charges", "aim_charges"):
        if merged[key] not in (0, 1, 2, 3, 5):
            raise ValueError("%s must be 0, 1, 2, 3 or 5" % key)
    if not 1 <= merged["aim_shots_per_charge"] <= 9:
        raise ValueError("aim_shots_per_charge must be between 1 and 9")
    return merged


# --- Scoring --------------------------------------------------------------


def _score_for(popped: int, exploded: int, dropped: int, combo: int) -> int:
    multiplier = max(1, min(combo, 5))
    return (10 * popped + 10 * exploded + 25 * dropped) * multiplier


def _check_board_end(board: Dict, config: Dict) -> bool:
    """Roll a cleared board into the next wave, or retire one that crossed the line."""
    grid = board["grid"]
    if _board_empty(grid):
        board["score"] = int(board["score"]) + 300
        board["wave"] = int(board["wave"]) + 1
        _new_wave(board)
        board["push_countdown"] = int(config["endless_push_interval"])
        return False
    if _lowest_row(grid) >= DEATH_ROW:
        board["phase"] = "game_over"
        board["game_over"] = True
        board["result"] = "lose"
        return True
    return False


def _check_match_end(state: Dict) -> bool:
    """The match ends once every board is out. Ranking is by score."""
    boards = state["boards"]
    if not boards or not all(board["game_over"] for board in boards.values()):
        return False
    state["phase"] = "game_over"
    state["game_over"] = True
    state["result"] = "win"
    best = max(int(board["score"]) for board in boards.values())
    state["winner_ids"] = [
        pid for pid in state["turn_order"] if int(boards[pid]["score"]) == best
    ]
    return True


def _ranking(state: Dict) -> List[Dict]:
    boards = state["boards"]
    meta = state.get("player_meta", {})
    rows = []
    for order, pid in enumerate(state.get("turn_order", [])):
        board = boards.get(pid) or {}
        info = meta.get(pid, {})
        rows.append({
            "player_id": pid,
            "name": info.get("name"),
            "seat": info.get("seat"),
            "is_bot": info.get("is_bot", False),
            "score": int(board.get("score", 0)),
            "wave": int(board.get("wave", 0)),
            "shots": int(board.get("shots", 0)),
            "best_combo": int(board.get("best_combo", 0)),
            "popped_total": int(board.get("popped_total", 0)),
            "dropped_total": int(board.get("dropped_total", 0)),
            "out": bool(board.get("game_over", False)),
            "_order": order,
        })
    rows.sort(key=lambda row: (-row["score"], row["_order"]))
    for index, row in enumerate(rows, 1):
        row["rank"] = index
        row.pop("_order", None)
    return rows


class BubbleShooterGame:
    game_id = "bubble_shooter"
    min_players = 1
    max_players = MAX_PLAYERS

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        if not players:
            raise ValueError("Bubble Shooter needs at least one player")
        if len(players) > MAX_PLAYERS:
            raise ValueError("Bubble Shooter supports at most %d players" % MAX_PLAYERS)
        player_ids = [player["player_id"] for player in players]
        state = {
            "players": {pid: {"score": 0, "shots": 0} for pid in player_ids},
            "player_meta": {player["player_id"]: dict(player) for player in players},
            "turn_order": player_ids,
            "current_turn": None,
            "config": cfg,
            "seed": int(cfg["seed"]),
            "boards": {},
            "phase": "playing",
            "result": None,
            "winner_ids": [],
            "game_over": False,
        }
        _start_match(state)
        return state

    # -- legality ----------------------------------------------------------

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again", "new_game"]
        board = state.get("boards", {}).get(player_id)
        if board is None or board.get("game_over"):
            return ["new_game"]
        actions = ["new_game", "shoot"]
        items = board.get("items", {})
        if int(items.get("hammer", 0)) > 0:
            actions.append("use_item_hammer")
        if int(items.get("aim", 0)) > 0:
            actions.append("use_item_aim")
        return actions

    # -- actions -----------------------------------------------------------

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        action_type = action.get("type")

        if action_type == "new_game":
            _start_match(state)
            return [{"type": "bubble_shooter:new_game",
                     "payload": {"player_id": player_id}}], None

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game is not over"
            _start_match(state)
            return [{"type": "bubble_shooter:play_again",
                     "payload": {"player_id": player_id}}], None

        if state.get("game_over"):
            return [], "game is over"

        board = state.get("boards", {}).get(player_id)
        if board is None:
            return [], "unknown player"
        if board.get("game_over"):
            return [], "your board is out"

        if action_type == "use_item":
            return BubbleShooterGame._apply_item(state, board, player_id, action)
        if action_type == "shoot":
            return BubbleShooterGame._apply_shot(state, board, player_id, action)
        return [], "invalid action"

    @staticmethod
    def _apply_item(state: Dict, board: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        config = state["config"]
        item = action.get("item")
        items = board.setdefault("items", {"hammer": 0, "aim": 0})
        if item not in ("hammer", "aim"):
            return [], "unknown item"
        if int(items.get(item, 0)) <= 0:
            return [], "no %s charge left" % item

        if item == "aim":
            items["aim"] = int(items["aim"]) - 1
            board["aim_left"] = int(config["aim_shots_per_charge"])
            board["shot_id"] = int(board["shot_id"]) + 1
            board["last_shot"] = {
                "id": board["shot_id"],
                "kind": "aim",
                "path": [],
                "cell": None,
                "color": None,
                "popped": [],
                "exploded": [],
                "dropped": [],
                "crushed": [],
                "gain": 0,
                "combo": int(board["combo"]),
                "pushed": False,
                "aim_left": board["aim_left"],
            }
            return [{"type": "bubble_shooter:item",
                     "payload": {"player_id": player_id, "item": "aim",
                                 "aim_left": board["aim_left"]}}], None

        row = action.get("row")
        col = action.get("col")
        if type(row) is not int or type(col) is not int:
            return [], "hammer needs a target cell"
        top_parity = board["top_parity"]
        if not _in_bounds(row, col, top_parity):
            return [], "target cell is outside the board"
        if board["grid"][row][col] is None:
            return [], "target cell is empty"

        items["hammer"] = int(items["hammer"]) - 1
        grid = board["grid"]
        grid[row][col] = None
        floating = _floating_cells(grid, top_parity)
        _clear_cells(grid, floating)
        gain = _score_for(0, 0, len(floating), max(1, int(board["combo"])))
        board["score"] = int(board["score"]) + gain
        board["dropped_total"] = int(board["dropped_total"]) + len(floating)
        state["players"][player_id]["score"] = board["score"]
        board["shot_id"] = int(board["shot_id"]) + 1
        board["last_shot"] = {
            "id": board["shot_id"],
            "kind": "hammer",
            "path": [],
            "cell": [row, col],
            "color": None,
            "popped": [[row, col]],
            "exploded": [],
            "dropped": [[r, c] for r, c in floating],
            "crushed": [],
            "gain": gain,
            "combo": int(board["combo"]),
            "pushed": False,
            "aim_left": int(board["aim_left"]),
        }
        events = [{"type": "bubble_shooter:item",
                   "payload": {"player_id": player_id, "item": "hammer",
                               "row": row, "col": col, "dropped": len(floating)}}]
        if _check_board_end(board, config):
            events.append({"type": "bubble_shooter:board_out",
                           "payload": {"player_id": player_id, "score": board["score"]}})
        if _check_match_end(state):
            events.append({"type": "bubble_shooter:over",
                           "payload": {"winner_ids": list(state["winner_ids"])}})
        return events, None

    @staticmethod
    def _apply_shot(state: Dict, board: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        config = state["config"]
        angle = action.get("angle")
        if isinstance(angle, bool) or not isinstance(angle, (int, float)):
            return [], "angle must be a number"
        angle = float(angle)
        if not -MAX_ANGLE <= angle <= MAX_ANGLE:
            return [], "angle out of range"

        grid = board["grid"]
        top_parity = board["top_parity"]
        cells = _occupied(grid, top_parity)
        path, (end_x, end_y) = _simulate(cells, angle)
        target = _snap_cell(grid, top_parity, end_x, end_y)
        if target is None:
            return [], "there is no room for that shot"
        row, col = target

        queue = board["queue"]
        if not queue:
            _refill_queue(board)
        color = queue.pop(0)
        _refill_queue(board)
        grid[row][col] = color

        popped: List[Tuple[int, int]] = []
        exploded: List[Tuple[int, int]] = []
        if color == BOMB:
            exploded = _explode_cells(grid, top_parity, row, col)
            _clear_cells(grid, exploded)
        else:
            popped = _match_group(grid, top_parity, row, col)
            _clear_cells(grid, popped)

        floating = _floating_cells(grid, top_parity)
        _clear_cells(grid, floating)

        cleared = len(popped) + len(exploded) + len(floating)
        board["combo"] = int(board["combo"]) + 1 if cleared else 0
        board["best_combo"] = max(int(board["best_combo"]), board["combo"])
        gain = _score_for(len(popped), len(exploded), len(floating), board["combo"])
        board["score"] = int(board["score"]) + gain
        board["popped_total"] = int(board["popped_total"]) + len(popped) + len(exploded)
        board["dropped_total"] = int(board["dropped_total"]) + len(floating)
        board["shots"] = int(board["shots"]) + 1
        state["players"][player_id]["score"] = board["score"]
        state["players"][player_id]["shots"] = board["shots"]
        if int(board["aim_left"]) > 0:
            board["aim_left"] = int(board["aim_left"]) - 1

        crushed: List[Tuple[int, int]] = []
        pushed = False
        interval = int(config["endless_push_interval"])
        if interval > 0 and not _board_empty(grid):
            board["push_countdown"] = int(board["push_countdown"]) - 1
            if board["push_countdown"] <= 0:
                crushed = _push_row(board)
                board["push_countdown"] = interval
                pushed = True

        board["shot_id"] = int(board["shot_id"]) + 1
        board["last_shot"] = {
            "id": board["shot_id"],
            "kind": "shoot",
            "angle": round(angle, 2),
            "path": path,
            "cell": [row, col],
            "color": color,
            "popped": [[r, c] for r, c in popped],
            "exploded": [[r, c] for r, c in exploded],
            "dropped": [[r, c] for r, c in floating],
            "crushed": [[r, c] for r, c in crushed],
            "gain": gain,
            "combo": int(board["combo"]),
            "pushed": pushed,
            "aim_left": int(board["aim_left"]),
        }

        events = [{
            "type": "bubble_shooter:shot",
            "payload": {
                "player_id": player_id,
                "angle": round(angle, 2),
                "cell": [row, col],
                "color": color,
                "popped": len(popped) + len(exploded),
                "dropped": len(floating),
                "gain": gain,
                "combo": int(board["combo"]),
                "score": int(board["score"]),
            },
        }]
        if _check_board_end(board, config):
            events.append({"type": "bubble_shooter:board_out",
                           "payload": {"player_id": player_id, "score": board["score"]}})
        if _check_match_end(state):
            events.append({"type": "bubble_shooter:over",
                           "payload": {"winner_ids": list(state["winner_ids"])}})
        return events, None

    # -- bot ---------------------------------------------------------------
    # The strategy lives in game/bubble_shooter_ai.py: it enumerates every
    # reachable landing cell, plays each out on a copy of the board and keeps
    # the best result. That is a purpose-built search policy, so
    # `bubble_shooter` is listed in STRATEGIC_AI_GAME_IDS.

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        # Imported lazily because the AI module imports geometry from this one.
        from game.bubble_shooter_ai import choose_action

        return choose_action(state, player_id)

    # -- views -------------------------------------------------------------

    @staticmethod
    def _own_view(board: Optional[Dict], config: Dict) -> Dict:
        if board is None:
            return {
                "grid": [],
                "top_parity": 0,
                "queue": [],
                "items": {"hammer": 0, "aim": 0},
                "aim_left": 0,
                "score": 0,
                "combo": 0,
                "best_combo": 0,
                "shots": 0,
                "wave": 0,
                "push_countdown": 0,
                "push_interval": int(config["endless_push_interval"]),
                "popped_total": 0,
                "dropped_total": 0,
                "last_shot": None,
                "shot_id": 0,
                "board_out": True,
            }
        return {
            "grid": [list(line) for line in board["grid"]],
            "top_parity": int(board["top_parity"]),
            "queue": list(board["queue"]),
            "items": dict(board["items"]),
            "aim_left": int(board["aim_left"]),
            "score": int(board["score"]),
            "combo": int(board["combo"]),
            "best_combo": int(board["best_combo"]),
            "shots": int(board["shots"]),
            "wave": int(board["wave"]),
            "push_countdown": int(board["push_countdown"]),
            "push_interval": int(config["endless_push_interval"]),
            "popped_total": int(board["popped_total"]),
            "dropped_total": int(board["dropped_total"]),
            "last_shot": copy.deepcopy(board["last_shot"]),
            "shot_id": int(board["shot_id"]),
            "board_out": bool(board["game_over"]),
        }

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        config = state.get("config", dict(DEFAULT_CONFIG))
        board = state.get("boards", {}).get(viewer_id)
        view = {
            "game_id": BubbleShooterGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase", "playing"),
            "result": state.get("result"),
            "game_over": bool(state.get("game_over")),
            "winner_ids": list(state.get("winner_ids", [])),
            "ranking": _ranking(state),
            "boards": {
                pid: BubbleShooterGame._own_view(other, config)
                for pid, other in state.get("boards", {}).items()
            },
            "player_count": len(state.get("turn_order", [])),
            "current_turn": state.get("current_turn"),
            "config": dict(config),
            "geometry": {
                "cols": COLS,
                "row_height": ROW_HEIGHT,
                "max_rows": MAX_ROWS,
                "death_row": DEATH_ROW,
                "board_width": BOARD_WIDTH,
                "board_height": BOARD_HEIGHT,
                "death_line_y": DEATH_LINE_Y,
                "shooter": [SHOOTER_X, SHOOTER_Y],
                "max_angle": MAX_ANGLE,
                "colors": list(COLORS),
            },
            "legal_actions": BubbleShooterGame.get_legal_actions(state, viewer_id),
        }
        view.update(BubbleShooterGame._own_view(board, config))
        return view

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


BubbleShooterGame.__module__ = __name__
