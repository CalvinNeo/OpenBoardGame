"""Strategic bot for Bubble Shooter (泡泡龙).

The generic bot shipped inside the game module only sampled random angles. This
module actually plays: it enumerates every landing cell the shooter can reach,
plays each one out on a copy of the board, and keeps the best result.

That makes it a purpose-built search policy rather than a random or
first-legal bot, which is why `bubble_shooter` is listed in
`STRATEGIC_AI_GAME_IDS`.

The search is deliberately shallow — one ply over the reachable cells, plus a
hammer check — but the evaluation is what carries the strategy:

* points, with dropped bubbles worth far more than popped ones, so the bot
  hunts for support bubbles instead of settling for a lazy three-in-a-row;
* colour reduction, because the queue only ever hands out colours that are
  still on the board, so wiping a colour out makes every later shot easier;
* survival, as a hard tier, since a shot that pushes the stack onto the death
  row ends the run no matter how many points it scored;
* setup, so a shot that clears nothing still parks the bubble next to its own
  colour and next to whatever the queue is about to hand over.

Everything is deterministic: the angle sweep runs in a fixed order, ties keep
the earlier candidate, and no random draw is involved.
"""

import math
from typing import Dict, List, Optional, Tuple

from game.bubble_shooter import (
    BOMB,
    BOARD_WIDTH,
    COLLIDE_DIST,
    COLOR_SET,
    DEATH_ROW,
    MAX_ANGLE,
    MAX_RAY_STEPS,
    RAINBOW,
    RAY_STEP,
    SHOOTER_X,
    SHOOTER_Y,
    _board_empty,
    _clear_cells,
    _colors_on_board,
    _explode_cells,
    _floating_cells,
    _lowest_row,
    _match_group,
    _neighbors,
    _occupied,
    _snap_cell,
)

# --- Tunables -------------------------------------------------------------

ANGLE_STEP = 1.25          # degrees between sweep samples
COLOUR_BONUS = 200.0       # per colour wiped off the board
DEATH_PENALTY = 320.0      # per row inside the last three before the death line
REMAIN_PENALTY = 2.0       # per bubble still on the board
CLUSTER_BONUS = 26.0       # per same-colour neighbour when nothing cleared
SETUP_BONUS = 34.0         # per next-colour neighbour when nothing cleared
WAVE_BONUS = 300.0         # clearing the board rolls straight into a new wave
HAMMER_COST = 150.0        # spending a charge has to be worth it
FATAL = -1_000_000.0


# --- Ray tracing ----------------------------------------------------------


def _trace_end(cells, angle_deg: float) -> Tuple[float, float]:
    """Where a shot stops, without building the path the animation needs."""
    radians = math.radians(angle_deg)
    vx = math.sin(radians)
    vy = -math.cos(radians)
    x, y = SHOOTER_X, SHOOTER_Y
    left = 0.5
    right = BOARD_WIDTH - 0.5
    limit = COLLIDE_DIST * COLLIDE_DIST
    for _ in range(MAX_RAY_STEPS):
        x += vx * RAY_STEP
        y += vy * RAY_STEP
        if x < left:
            x = 1.0 - x
            vx = -vx
        elif x > right:
            x = 2.0 * right - x
            vx = -vx
        if y <= 0.5:
            return x, 0.5
        hit = False
        for _, _, cx, cy in cells:
            if abs(cy - y) > COLLIDE_DIST:
                continue
            if (cx - x) ** 2 + (cy - y) ** 2 < limit:
                hit = True
                break
        if hit:
            return x, y
    return x, y


def candidate_cells(board: Dict) -> Dict[Tuple[int, int], float]:
    """Every cell the shooter can reach, mapped to one angle that reaches it."""
    grid = board["grid"]
    parity = int(board["top_parity"])
    cells = _occupied(grid, parity)
    found: Dict[Tuple[int, int], float] = {}
    steps = int((2 * MAX_ANGLE) / ANGLE_STEP) + 1
    for index in range(steps + 1):
        angle = -MAX_ANGLE + index * ANGLE_STEP
        if angle > MAX_ANGLE:
            break
        x, y = _trace_end(cells, angle)
        target = _snap_cell(grid, parity, x, y)
        if target is None:
            continue
        key = (target[0], target[1])
        if key not in found:
            found[key] = round(angle, 2)
    return found


# --- Evaluation -----------------------------------------------------------


def _structure_score(grid, before_colours: int, lowest: int, remaining: int) -> float:
    score = 0.0
    score += COLOUR_BONUS * (before_colours - len(_colors_on_board(grid)))
    if lowest >= DEATH_ROW - 3:
        score -= DEATH_PENALTY * (lowest - (DEATH_ROW - 4))
    score -= REMAIN_PENALTY * remaining
    return score


def _count_cells(grid) -> int:
    return sum(1 for line in grid for cell in line if cell is not None)


def _next_colour(board: Dict) -> Optional[str]:
    queue = board.get("queue") or []
    return queue[1] if len(queue) > 1 else None


def evaluate_shot(board: Dict, row: int, col: int, colour: str) -> float:
    """Play one landing out on a copy of the board and score the result."""
    parity = int(board["top_parity"])
    grid = [list(line) for line in board["grid"]]
    before_colours = len(_colors_on_board(grid))
    before_remaining = _count_cells(grid)

    grid[row][col] = colour
    popped = 0
    exploded = 0
    if colour == BOMB:
        cells = _explode_cells(grid, parity, row, col)
        exploded = len(cells)
        _clear_cells(grid, cells)
    else:
        group = _match_group(grid, parity, row, col)
        popped = len(group)
        _clear_cells(grid, group)

    floating = _floating_cells(grid, parity)
    _clear_cells(grid, floating)
    dropped = len(floating)

    cleared = popped + exploded + dropped
    combo = int(board["combo"]) + 1 if cleared else 0
    multiplier = max(1, min(combo, 5))
    score = float((10 * popped + 10 * exploded + 25 * dropped) * multiplier)

    if _board_empty(grid):
        score += WAVE_BONUS

    lowest = _lowest_row(grid)
    remaining = _count_cells(grid)
    score += _structure_score(grid, before_colours, lowest, remaining)

    if not cleared:
        # Nothing scored, so at least build towards the next two shots.
        same = 0
        upcoming = 0
        nxt = _next_colour(board)
        for n_row, n_col in _neighbors(row, col, parity):
            value = grid[n_row][n_col]
            if value is None:
                continue
            if value == colour or colour == RAINBOW:
                same += 1
            if nxt is not None and value == nxt:
                upcoming += 1
        score += CLUSTER_BONUS * min(same, 2)
        score += SETUP_BONUS * min(upcoming, 2)

    if lowest >= DEATH_ROW:
        # Surviving beats everything, but among fatal shots still take the points.
        return FATAL + score
    if before_remaining and remaining > before_remaining and lowest >= DEATH_ROW - 1:
        score -= DEATH_PENALTY
    return score


def evaluate_hammer(board: Dict, row: int, col: int) -> float:
    """Score knocking one bubble out, including whatever falls with it."""
    parity = int(board["top_parity"])
    grid = [list(line) for line in board["grid"]]
    before_colours = len(_colors_on_board(grid))

    grid[row][col] = None
    floating = _floating_cells(grid, parity)
    _clear_cells(grid, floating)
    dropped = len(floating)

    multiplier = max(1, min(int(board["combo"]), 5))
    score = float(25 * dropped * multiplier)

    lowest = _lowest_row(grid)
    remaining = _count_cells(grid)
    score += _structure_score(grid, before_colours, lowest, remaining)
    score -= HAMMER_COST

    if lowest >= DEATH_ROW:
        return FATAL + score
    return score


# --- Entry point ----------------------------------------------------------


def best_shot(board: Dict) -> Optional[Dict]:
    """Pick the best angle for the loaded bubble, or None if the board is stuck."""
    queue = board.get("queue") or []
    colour = queue[0] if queue else None
    if colour is None:
        return None

    best_score = None
    best_angle = None
    for (row, col), angle in sorted(candidate_cells(board).items()):
        score = evaluate_shot(board, row, col, colour)
        if best_score is None or score > best_score:
            best_score = score
            best_angle = angle
    if best_angle is None:
        return None
    return {"type": "shoot", "angle": best_angle, "_score": best_score}


def best_hammer(board: Dict) -> Optional[Dict]:
    """Pick the bubble worth spending a hammer charge on, if any."""
    parity = int(board["top_parity"])
    grid = board["grid"]
    best_score = None
    best_cell = None
    for row in range(len(grid)):
        for col in range(len(grid[row])):
            if grid[row][col] is None:
                continue
            score = evaluate_hammer(board, row, col)
            if best_score is None or score > best_score:
                best_score = score
                best_cell = (row, col)
    if best_cell is None:
        return None
    return {
        "type": "use_item",
        "item": "hammer",
        "row": best_cell[0],
        "col": best_cell[1],
        "_score": best_score,
    }


def choose_action(state: Dict, player_id: str) -> Optional[Dict]:
    """Return the action the bot wants to take, or None when it cannot act."""
    board = (state.get("boards") or {}).get(player_id)
    if board is None or board.get("game_over") or state.get("game_over"):
        return None

    shot = best_shot(board)
    action = shot

    if board.get("items", {}).get("hammer", 0) > 0:
        hammer = best_hammer(board)
        if hammer is not None and (shot is None or hammer["_score"] > shot["_score"]):
            action = hammer

    if action is None:
        return None
    return {key: value for key, value in action.items() if key != "_score"}
