"""Hive Classic: authoritative, JSON-serializable rules on an unbounded hex grid."""

import copy
import json
from typing import Callable, Dict, List, Optional, Set, Tuple


Coord = Tuple[int, int]
Board = Dict[Coord, List[str]]
DIRECTIONS = ((1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1))
PIECE_COUNTS = {"queen": 1, "beetle": 2, "grasshopper": 3, "spider": 2, "ant": 3}
PIECE_INFO = {
    "queen": {"name": "Queen Bee", "name_zh": "蜂后", "icon": "🐝"},
    "beetle": {"name": "Beetle", "name_zh": "甲虫", "icon": "🐞"},
    "grasshopper": {"name": "Grasshopper", "name_zh": "蚱蜢", "icon": "🦗"},
    "spider": {"name": "Spider", "name_zh": "蜘蛛", "icon": "🕷️"},
    "ant": {"name": "Soldier Ant", "name_zh": "兵蚁", "icon": "🐜"},
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "tournament_opening": {"type": "boolean", "default": False},
        "ai_difficulty": {"type": "string", "enum": ["easy", "normal", "hard"], "default": "normal"},
    },
    "additionalProperties": False,
}
_TARGET_SCHEMA = {"type": "array", "items": {"type": "integer"}, "minItems": 2, "maxItems": 2}
ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"properties": {"type": {"const": "place"}, "piece": {"enum": list(PIECE_COUNTS)}, "to": _TARGET_SCHEMA},
         "required": ["type", "piece", "to"], "additionalProperties": False},
        {"properties": {"type": {"const": "move"}, "piece_id": {"type": "string"}, "to": _TARGET_SCHEMA},
         "required": ["type", "piece_id", "to"], "additionalProperties": False},
        {"properties": {"type": {"enum": ["pass", "offer_draw", "accept_draw", "decline_draw"]}},
         "required": ["type"], "additionalProperties": False},
    ],
}


def neighbors(cell: Coord) -> List[Coord]:
    return [(cell[0] + dq, cell[1] + dr) for dq, dr in DIRECTIONS]


def cell_key(cell: Coord) -> str:
    return f"{cell[0]},{cell[1]}"


def board_from_state(state: Dict) -> Board:
    return {tuple(map(int, key.split(","))): list(stack) for key, stack in state["board"].items()}


def piece_positions(board: Board) -> Dict[str, Coord]:
    return {piece_id: cell for cell, stack in board.items() for piece_id in stack}


def is_connected(board: Board) -> bool:
    if not board:
        return True
    reached = {next(iter(board))}
    queue = list(reached)
    while queue:
        for cell in neighbors(queue.pop()):
            if cell in board and cell not in reached:
                reached.add(cell)
                queue.append(cell)
    return len(reached) == len(board)


def lifted_board(board: Board, source: Coord) -> Board:
    result = dict(board)
    if len(result[source]) == 1:
        del result[source]
    else:
        result[source] = result[source][:-1]
    return result


def _flanks(source: Coord, target: Coord) -> Tuple[Coord, Coord]:
    direction = DIRECTIONS.index((target[0] - source[0], target[1] - source[1]))
    adjacent = neighbors(source)
    return adjacent[(direction - 1) % 6], adjacent[(direction + 1) % 6]


def can_slide(board: Board, source: Coord, target: Coord, height: int = 1) -> bool:
    """Board excludes the moving piece; height is its highest transit layer."""
    left, right = _flanks(source, target)
    left_height, right_height = len(board.get(left, ())), len(board.get(right, ()))
    if left_height >= height and right_height >= height:
        return False
    # Ground movement must maintain contact around a shared flank, not leap
    # between two cells which happen to touch different parts of the hive.
    return height > 1 or bool(left_height or right_height)


def movement_targets(state: Dict, board: Board, source: Coord) -> Set[Coord]:
    piece = state["pieces"][board[source][-1]]
    remainder = lifted_board(board, source)
    if not remainder or not is_connected(remainder):
        return set()
    kind = piece["kind"]
    if kind == "grasshopper":
        result = set()
        for dq, dr in DIRECTIONS:
            target = (source[0] + dq, source[1] + dr)
            if target not in remainder:
                continue
            while target in remainder:
                target = (target[0] + dq, target[1] + dr)
            result.add(target)
        return result
    if kind == "beetle":
        result = set()
        for target in neighbors(source):
            height = max(len(board[source]), len(remainder.get(target, ())) + 1)
            if target not in remainder and not any(cell in remainder for cell in neighbors(target)):
                continue
            if can_slide(remainder, source, target, height):
                result.add(target)
        return result

    def steps(cell: Coord) -> List[Coord]:
        return [target for target in neighbors(cell)
                if target not in remainder and can_slide(remainder, cell, target)]

    if kind == "queen":
        return set(steps(source))
    if kind == "spider":
        result = set()

        def walk(cell: Coord, visited: Set[Coord], depth: int) -> None:
            if depth == 3:
                result.add(cell)
                return
            for target in steps(cell):
                if target not in visited:
                    walk(target, visited | {target}, depth + 1)

        walk(source, {source}, 0)
        return result
    if kind == "ant":
        reached = {source}
        queue = [source]
        while queue:
            for target in steps(queue.pop()):
                if target not in reached:
                    reached.add(target)
                    queue.append(target)
        return reached - {source}
    return set()


def queen_position(state: Dict, board: Board, player_id: str) -> Optional[Coord]:
    for cell, stack in board.items():
        if any(state["pieces"][pid]["owner"] == player_id and state["pieces"][pid]["kind"] == "queen"
               for pid in stack):
            return cell
    return None


def placement_targets(state: Dict, board: Board, player_id: str) -> Set[Coord]:
    if not board:
        return {(0, 0)}
    candidates = {cell for occupied in board for cell in neighbors(occupied) if cell not in board}
    if sum(state["players"][player_id]["reserve"].values()) == sum(PIECE_COUNTS.values()):
        return candidates
    result = set()
    for target in candidates:
        owners = {state["pieces"][board[cell][-1]]["owner"] for cell in neighbors(target) if cell in board}
        if owners == {player_id}:
            result.add(target)
    return result


def legal_moves(state: Dict, player_id: Optional[str] = None) -> List[Dict]:
    """Complete positional actions; draw negotiation is deliberately separate."""
    player_id = player_id or state["current_turn"]
    if state["game_over"] or player_id != state["current_turn"]:
        return []
    board = board_from_state(state)
    player = state["players"][player_id]
    queen_placed = player["reserve"]["queen"] == 0
    must_queen = not queen_placed and player["turns"] >= 3
    placements = sorted(placement_targets(state, board, player_id))
    actions = []
    for kind, count in player["reserve"].items():
        if not count or (must_queen and kind != "queen"):
            continue
        if kind == "queen" and not player["turns"] and state["config"]["tournament_opening"]:
            continue
        actions.extend({"type": "place", "piece": kind, "to": list(cell)} for cell in placements)
    if queen_placed:
        for source, stack in sorted(board.items()):
            piece_id = stack[-1]
            if state["pieces"][piece_id]["owner"] != player_id:
                continue
            actions.extend({"type": "move", "piece_id": piece_id, "to": list(cell)}
                           for cell in sorted(movement_targets(state, board, source)))
    return actions or [{"type": "pass"}]


def position_key(state: Dict) -> str:
    board = board_from_state(state)
    min_q = min((q for q, _ in board), default=0)
    min_r = min((r for _, r in board), default=0)
    cells = [(q - min_q, r - min_r, [(state["pieces"][pid]["owner"], state["pieces"][pid]["kind"])
                                  for pid in stack]) for (q, r), stack in sorted(board.items())]
    players = [(pid, [state["players"][pid]["reserve"][kind] for kind in PIECE_COUNTS],
                min(3, state["players"][pid]["turns"]) if state["players"][pid]["reserve"]["queen"] else 0)
               for pid in state["order"]]
    return json.dumps([state["current_turn"], cells, players], separators=(",", ":"))


def _finish(state: Dict, winners: List[str], reason: str) -> None:
    state.update(game_over=True, phase="game_over", winner=winners, result_reason=reason, draw_offer=None)


def advance_position(state: Dict, action: Dict) -> None:
    """Apply a prevalidated positional move; shared by the server and AI copies."""
    player_id = state["current_turn"]
    player = state["players"][player_id]
    move = dict(action, player_id=player_id, from_cell=None)
    if action["type"] == "place":
        kind = action["piece"]
        number = PIECE_COUNTS[kind] - player["reserve"][kind] + 1
        piece_id = f"{player['color']}-{kind}-{number}"
        state["board"][cell_key(tuple(action["to"]))] = [piece_id]
        player["reserve"][kind] -= 1
        move["piece_id"] = piece_id
    elif action["type"] == "move":
        piece_id = action["piece_id"]
        source = next(key for key, stack in state["board"].items() if stack[-1] == piece_id)
        move["from_cell"] = list(map(int, source.split(",")))
        state["board"][source].pop()
        if not state["board"][source]:
            del state["board"][source]
        state["board"].setdefault(cell_key(tuple(action["to"])), []).append(piece_id)
    state["consecutive_passes"] = state["consecutive_passes"] + 1 if action["type"] == "pass" else 0
    if state["draw_offer"] != player_id:
        state["draw_offer"] = None
    player["turns"] += 1
    state["ply"] += 1
    state["last_move"] = move
    state["current_turn"] = next(pid for pid in state["order"] if pid != player_id)
    board = board_from_state(state)
    surrounded = []
    for pid in state["order"]:
        queen = queen_position(state, board, pid)
        if queen is not None and all(cell in board for cell in neighbors(queen)):
            surrounded.append(pid)
    if surrounded:
        _finish(state, [pid for pid in state["order"] if pid not in surrounded],
                "both_queens_surrounded" if len(surrounded) == 2 else "queen_surrounded")
        return
    if state["consecutive_passes"] >= 2:
        _finish(state, [], "no_moves")
        return
    key = position_key(state)
    state["position_counts"][key] = state["position_counts"].get(key, 0) + 1
    if state["position_counts"][key] >= 3:
        _finish(state, [], "threefold_repetition")


def simulate_move(state: Dict, action: Dict) -> Dict:
    child = dict(state)
    child["board"] = {key: list(stack) for key, stack in state["board"].items()}
    child["players"] = {pid: dict(player, reserve=dict(player["reserve"])) for pid, player in state["players"].items()}
    child["position_counts"] = dict(state["position_counts"])
    advance_position(child, action)
    return child


class HiveGame:
    game_id = "hive"
    min_players = 2
    max_players = 2

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) != 2 or len({p["player_id"] for p in players}) != 2:
            raise ValueError("Hive requires exactly two different players")
        config = config or {}
        opening = config.get("tournament_opening", False)
        difficulty = config.get("ai_difficulty", "normal")
        if type(opening) is not bool or difficulty not in ("easy", "normal", "hard"):
            raise ValueError("Invalid Hive configuration")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        state = {
            "game_id": "hive", "order": [p["player_id"] for p in ordered], "players": {}, "pieces": {},
            "board": {}, "current_turn": ordered[0]["player_id"], "ply": 0, "phase": "play",
            "config": {"tournament_opening": opening, "ai_difficulty": difficulty},
            "last_move": None, "activity": [], "draw_offer": None, "draw_offered_ply": {},
            "consecutive_passes": 0, "position_counts": {}, "game_over": False, "winner": [], "result_reason": None,
        }
        for index, meta in enumerate(ordered):
            pid, color = meta["player_id"], ("white", "black")[index]
            state["players"][pid] = {"name": meta.get("name", pid), "seat": meta.get("seat", index),
                                      "is_bot": bool(meta.get("is_bot")), "color": color,
                                      "reserve": dict(PIECE_COUNTS), "turns": 0}
            for kind, count in PIECE_COUNTS.items():
                for number in range(1, count + 1):
                    piece_id = f"{color}-{kind}-{number}"
                    state["pieces"][piece_id] = {"id": piece_id, "owner": pid, "color": color, "kind": kind, "number": number}
        state["position_counts"][position_key(state)] = 1
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        actions = list(dict.fromkeys(action["type"] for action in legal_moves(state, player_id)))
        if player_id == state["current_turn"] and not state["draw_offer"] and state["draw_offered_ply"].get(player_id) != state["ply"]:
            actions.append("offer_draw")
        if state["draw_offer"] and state["draw_offer"] != player_id:
            actions.extend(["accept_draw", "decline_draw"])
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "not a player"
        if state["game_over"]:
            return [], "game over"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        if kind in ("offer_draw", "accept_draw", "decline_draw"):
            if set(action) != {"type"} or kind not in HiveGame.get_legal_actions(state, player_id):
                return [], "draw action unavailable"
            if kind == "offer_draw":
                state["draw_offer"] = player_id
                state["draw_offered_ply"][player_id] = state["ply"]
            elif kind == "accept_draw":
                _finish(state, [], "draw_agreed")
            else:
                state["draw_offer"] = None
            message = {"offer_draw": "offered a draw", "accept_draw": "accepted the draw", "decline_draw": "declined the draw"}[kind]
        else:
            if player_id != state["current_turn"]:
                return [], "not your turn"
            if kind in ("place", "move"):
                target = action.get("to")
                if not isinstance(target, list) or len(target) != 2 or any(type(value) is not int for value in target):
                    return [], "invalid hex coordinate"
            if action not in legal_moves(state, player_id):
                return [], "illegal Hive action"
            advance_position(state, action)
            if kind == "pass":
                message = "passed (no legal moves)"
            else:
                piece = state["pieces"][state["last_move"]["piece_id"]]
                info = PIECE_INFO[piece["kind"]]
                verb = "placed" if kind == "place" else "moved"
                message = f"{verb} {info['icon']} {info['name']} to ({action['to'][0]}, {action['to'][1]})"
        entry = {"sequence": len(state["activity"]) + 1, "ply": state["ply"], "player_id": player_id,
                 "message": f"{state['players'][player_id]['name']} {message}"}
        if state["activity"]:
            entry["sequence"] = state["activity"][-1]["sequence"] + 1
        state["activity"] = (state["activity"] + [entry])[-100:]
        events = [{"type": f"hive:{kind}", "payload": copy.deepcopy(entry)}]
        if state["game_over"]:
            events.append({"type": "hive:game_over", "payload": {"winner": list(state["winner"]), "reason": state["result_reason"]}})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        board = board_from_state(state)
        moves = legal_moves(state, viewer_id) if viewer_id in state["players"] else []
        players = []
        for pid in state["order"]:
            queen = queen_position(state, board, pid)
            players.append(dict(state["players"][pid], player_id=pid, queen_position=list(queen) if queen is not None else None,
                                queen_neighbors=sum(cell in board for cell in neighbors(queen)) if queen is not None else 0))
        return copy.deepcopy({
            "game_id": "hive", "you": viewer_id, "players": players, "current_turn": state["current_turn"],
            "phase": state["phase"], "ply": state["ply"], "config": state["config"], "piece_info": PIECE_INFO,
            "board": [{"q": q, "r": r, "stack": [state["pieces"][pid] for pid in stack]} for (q, r), stack in sorted(board.items())],
            "legal_moves": moves, "legal_actions": HiveGame.get_legal_actions(state, viewer_id),
            "last_move": state["last_move"], "activity": state["activity"], "draw_offer": state["draw_offer"],
            "game_over": state["game_over"], "winner": state["winner"], "result_reason": state["result_reason"],
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str, progress_callback: Optional[Callable] = None) -> Optional[Dict]:
        from game.hive_ai import choose_move
        return choose_move(state, bot_id, progress_callback=progress_callback)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
