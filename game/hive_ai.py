"""Budgeted Hive search. Every candidate comes from the authoritative rules."""

import time
from typing import Callable, Dict, Optional, Tuple

from game.hive import (
    HiveGame, board_from_state, is_connected, legal_moves, lifted_board,
    movement_targets, neighbors, position_key, queen_position, simulate_move,
)


WIN = 100000.0
LEVELS = {
    "easy": {"seconds": 0.18, "nodes": 200, "depth": 1, "width": 10},
    "normal": {"seconds": 0.85, "nodes": 1500, "depth": 3, "width": 16},
    "hard": {"seconds": 2.0, "nodes": 4500, "depth": 4, "width": 24},
}
DEPLOYMENT = {"queen": 8, "beetle": 38, "grasshopper": 32, "spider": 30, "ant": 45}
PRESSURE = (0, 8, 25, 65, 180, 620, WIN)


def _distance(a: Tuple[int, int], b: Tuple[int, int]) -> int:
    dq, dr = a[0] - b[0], a[1] - b[1]
    return (abs(dq) + abs(dr) + abs(dq + dr)) // 2


def evaluate(state: Dict, player_id: str) -> float:
    if state["game_over"]:
        return 0.0 if not state["winner"] else WIN if player_id in state["winner"] else -WIN
    board = board_from_state(state)
    queens = {pid: queen_position(state, board, pid) for pid in state["order"]}
    scores = {pid: 0.0 for pid in state["order"]}
    for pid, queen in queens.items():
        if queen is None:
            scores[pid] -= 14 + state["players"][pid]["turns"] * 5
            continue
        scores[pid] -= PRESSURE[sum(cell in board for cell in neighbors(queen))]
        top = state["pieces"][board[queen][-1]]
        if top["owner"] != pid:
            scores[pid] -= 75
        if top["kind"] == "queen":
            scores[pid] += 7 * len(movement_targets(state, board, queen))
    for cell, stack in board.items():
        for piece_id in stack:
            piece = state["pieces"][piece_id]
            scores[piece["owner"]] += DEPLOYMENT[piece["kind"]]
        piece = state["pieces"][stack[-1]]
        owner, kind = piece["owner"], piece["kind"]
        enemy = next(pid for pid in state["order"] if pid != owner)
        mobile = len(stack) > 1 or is_connected(lifted_board(board, cell))
        scores[owner] += (7 if mobile else -9) * (1.5 if kind == "ant" else 1)
        if queens[enemy] is not None and kind != "queen":
            distance = _distance(cell, queens[enemy])
            scores[owner] += max(0, 5 - distance) * (3 if kind == "beetle" else 1.5)
        if len(stack) > 1:
            covered = state["pieces"][stack[-2]]
            scores[owner] += 22 if covered["owner"] != owner else 3
    opponent = next(pid for pid in state["order"] if pid != player_id)
    return scores[player_id] - scores[opponent]


def _loses_next_turn(state: Dict, player_id: str) -> bool:
    if state["game_over"]:
        return bool(state["winner"] and player_id not in state["winner"])
    board = board_from_state(state)
    queen = queen_position(state, board, player_id)
    if queen is None:
        return False
    gaps = [cell for cell in neighbors(queen) if cell not in board]
    if len(gaps) != 1:
        return False
    for reply in legal_moves(state):
        if reply.get("to") != list(gaps[0]):
            continue
        child = simulate_move(state, reply)
        if child["game_over"] and child["winner"] and player_id not in child["winner"]:
            return True
    return False


class _BudgetExpired(Exception):
    pass


def choose_move(state: Dict, bot_id: str, progress_callback: Optional[Callable] = None) -> Optional[Dict]:
    if state["game_over"] or bot_id not in state["players"]:
        return None
    if state["draw_offer"] and state["draw_offer"] != bot_id:
        return {"type": "accept_draw" if evaluate(state, bot_id) <= 0 else "decline_draw"}
    if bot_id != state["current_turn"]:
        return None
    actions = legal_moves(state, bot_id)
    if len(actions) == 1:
        return actions[0]
    limits = LEVELS[state["config"]["ai_difficulty"]]
    deadline = time.monotonic() + limits["seconds"]
    nodes = 0
    table = {}

    def report(stage: str, progress: float, detail: str) -> None:
        if progress_callback:
            progress_callback(stage, progress, detail)

    def check_budget() -> None:
        if nodes >= limits["nodes"] or time.monotonic() >= deadline:
            raise _BudgetExpired

    # Complete this tactical pass even when the search budget is exhausted.
    # In base Hive the opponent can surround our queen in one turn only by
    # filling its single remaining gap, so the safety check is inexpensive.
    report("tactics", 0.08, "Checking winning moves and queen safety")
    roots = []
    for action in actions:
        child = simulate_move(state, action)
        value = evaluate(child, bot_id)
        if value == WIN:
            report("complete", 0.99, "Found a winning move")
            return action
        unsafe = _loses_next_turn(child, bot_id)
        roots.append((value - (WIN / 2 if unsafe else 0), action, child, unsafe))
    roots.sort(key=lambda row: row[0], reverse=True)
    safe = [row for row in roots if not row[3]]
    if safe:
        roots = safe
    best_action = roots[0][1]

    def search(node: Dict, depth: int, alpha: float, beta: float, distance: int) -> float:
        nonlocal nodes
        check_budget()
        nodes += 1
        value = evaluate(node, node["current_turn"])
        if node["game_over"]:
            return value - distance if value > 0 else value + distance if value < 0 else 0.0
        if depth == 0:
            return value
        # Repetition is path-dependent. Include previous counts in the cache
        # instead of reusing an evaluation that might turn a draw into a win.
        key = (position_key(node), tuple(sorted(node["position_counts"].items())), depth, distance)
        cached = table.get(key)
        if cached is not None:
            return cached
        ranked = []
        for action in legal_moves(node):
            check_budget()
            child = simulate_move(node, action)
            ranked.append((evaluate(child, node["current_turn"]), child))
        ranked.sort(key=lambda row: row[0], reverse=True)
        original_alpha = alpha
        best, cutoff = -WIN * 2, False
        # The width limit is a deliberate heuristic, not an exact solver.
        for _, child in ranked[:limits["width"]]:
            score = -search(child, depth - 1, -beta, -alpha, distance + 1)
            best = max(best, score)
            alpha = max(alpha, score)
            if alpha >= beta:
                cutoff = True
                break
        if not cutoff and original_alpha < best < beta:
            table[key] = best
        return best

    for depth in range(2, limits["depth"] + 1):
        report("search", min(0.9, 0.25 + depth * 0.15), f"Searching depth {depth}")
        completed = []
        try:
            alpha = -WIN * 2
            for _, action, child, unsafe in roots[:limits["width"] * 2]:
                score = -search(child, depth - 1, -WIN * 2, -alpha, 1)
                if unsafe:
                    score -= WIN / 2
                completed.append((score, action, child, unsafe))
                alpha = max(alpha, score)
        except _BudgetExpired:
            break
        if completed:
            completed.sort(key=lambda row: row[0], reverse=True)
            best_action = completed[0][1]
            roots = completed
    report("complete", 0.99, f"Evaluated {nodes} search positions")
    return best_action
