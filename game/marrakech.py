import copy
import random
from typing import Dict, List, Optional, Tuple


BOARD_SIZE = 7
COLORS = ("coral", "gold", "teal", "violet")
DIRECTIONS = ((0, -1), (1, 0), (0, 1), (-1, 0))
DIE_FACES = (1, 2, 2, 3, 3, 4)
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["orient", "roll", "place"]},
        "direction": {"type": "integer", "minimum": 0, "maximum": 3},
        "cells": {
            "type": "array", "minItems": 2, "maxItems": 2,
            "items": {
                "type": "array", "minItems": 2, "maxItems": 2,
                "items": {"type": "integer", "minimum": 0, "maximum": 6},
            },
        },
    },
    "required": ["type"],
    "additionalProperties": False,
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"seed": {"type": "integer"}},
    "additionalProperties": False,
}


def advance_assam(assam: Dict, steps: int) -> Tuple[Dict, List[Dict]]:
    position = dict(assam)
    path = []
    for _ in range(steps):
        column, row, direction = position["x"], position["y"], position["direction"]
        delta_x, delta_y = DIRECTIONS[direction]
        next_x, next_y = column + delta_x, row + delta_y
        if next_y < 0:
            next_x, next_y, direction = (6, 0, 3) if column == 6 else (column ^ 1, 0, 2)
        elif next_x >= BOARD_SIZE:
            next_x, next_y, direction = (6, 0, 2) if row == 0 else (6, row + (1 if row % 2 else -1), 3)
        elif next_y >= BOARD_SIZE:
            next_x, next_y, direction = (0, 6, 1) if column == 0 else (column + (1 if column % 2 else -1), 6, 0)
        elif next_x < 0:
            next_x, next_y, direction = (0, 6, 0) if row == 6 else (0, row ^ 1, 1)
        position = {"x": next_x, "y": next_y, "direction": direction}
        path.append(dict(position))
    return position, path


def connected_area(state: Dict, column: int, row: int) -> List[List[int]]:
    tile = state["board"][row][column]
    if tile is None:
        return []
    color = tile["color"]
    visited = {(column, row)}
    pending = [(column, row)]
    while pending:
        current_x, current_y = pending.pop()
        for delta_x, delta_y in DIRECTIONS:
            neighbor_x, neighbor_y = current_x + delta_x, current_y + delta_y
            if not (0 <= neighbor_x < BOARD_SIZE and 0 <= neighbor_y < BOARD_SIZE):
                continue
            neighbor = state["board"][neighbor_y][neighbor_x]
            if neighbor and neighbor["color"] == color and (neighbor_x, neighbor_y) not in visited:
                visited.add((neighbor_x, neighbor_y))
                pending.append((neighbor_x, neighbor_y))
    return [list(cell) for cell in sorted(visited)]


def legal_placements(state: Dict) -> List[List[List[int]]]:
    assam = state["assam"]
    placements = []
    for row in range(BOARD_SIZE):
        for column in range(BOARD_SIZE):
            for delta_x, delta_y in ((1, 0), (0, 1)):
                second_x, second_y = column + delta_x, row + delta_y
                if second_x >= BOARD_SIZE or second_y >= BOARD_SIZE:
                    continue
                cells = [[column, row], [second_x, second_y]]
                if [assam["x"], assam["y"]] in cells:
                    continue
                if not any(abs(cell[0] - assam["x"]) + abs(cell[1] - assam["y"]) == 1 for cell in cells):
                    continue
                first, second = state["board"][row][column], state["board"][second_y][second_x]
                if first and second and first["rug_id"] == second["rug_id"]:
                    continue
                placements.append(cells)
    return placements


def calculate_scores(state: Dict) -> Dict[str, Dict]:
    visible = {player_id: 0 for player_id in state["turn_order"]}
    for row in state["board"]:
        for tile in row:
            if tile:
                visible[tile["owner"]] += 1
    return {
        player_id: {
            "coins": player["coins"], "visible": visible[player_id],
            "total": player["coins"] + visible[player_id],
        }
        for player_id, player in state["players"].items()
    }


def _finish(state: Dict) -> None:
    scores = calculate_scores(state)
    active = [player_id for player_id in state["turn_order"] if not state["players"][player_id]["eliminated"]]
    best = max((scores[player_id]["total"], scores[player_id]["coins"]) for player_id in active)
    state["winner"] = [player_id for player_id in active if (scores[player_id]["total"], scores[player_id]["coins"]) == best]
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None


def _next_turn(state: Dict) -> None:
    active = [player_id for player_id in state["turn_order"] if not state["players"][player_id]["eliminated"]]
    if len(active) <= 1 or not any(state["players"][player_id]["rugs"] for player_id in active):
        _finish(state)
        return
    current_index = state["turn_order"].index(state["current_turn"])
    for offset in range(1, len(state["turn_order"]) + 1):
        candidate = state["turn_order"][(current_index + offset) % len(state["turn_order"])]
        if candidate in active and state["players"][candidate]["rugs"]:
            state["current_turn"] = candidate
            state["phase"] = "orient"
            state["turn_number"] += 1
            return


class MarrakechGame:
    game_id = "marrakech"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 4:
            raise ValueError("Marrakech requires 2–4 players")
        config = dict(config or {})
        if set(config) - {"seed"} or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("invalid Marrakech configuration")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        order = [player["player_id"] for player in ordered]
        if len(set(order)) != len(order):
            raise ValueError("duplicate player")
        seed = config.get("seed", random.SystemRandom().randrange(2**63))
        generator = random.Random(seed)
        player_states = {}
        for index, player_id in enumerate(order):
            colors = list(COLORS[index * 2:index * 2 + 2]) if len(order) == 2 else [COLORS[index]]
            rugs = [color for color in colors for _ in range(15 if len(order) == 3 else 12)]
            generator.shuffle(rugs)
            player_states[player_id] = {"colors": colors, "rugs": rugs, "coins": 30, "eliminated": False}
        return {
            "seed": seed, "players": player_states,
            "player_meta": {player["player_id"]: dict(player) for player in ordered},
            "turn_order": order, "current_turn": order[0], "turn_number": 1,
            "board": [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)],
            "assam": {"x": 3, "y": 3, "direction": 0}, "phase": "orient",
            "next_rug_id": 1, "last_roll": None, "last_move": None,
            "history": [], "winner": [], "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id != state["current_turn"]:
            return []
        return [{"orient": "orient", "roll": "roll", "place": "place"}[state["phase"]]]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or action.get("type") not in MarrakechGame.get_legal_actions(state, player_id):
            return [], "action not available"
        action_type = action["type"]
        expected_keys = {"orient": {"type", "direction"}, "roll": {"type"}, "place": {"type", "cells"}}
        if set(action) != expected_keys[action_type]:
            return [], "invalid action fields"
        if action_type == "orient":
            direction = action["direction"]
            if type(direction) is not int or direction not in range(4) or direction == (state["assam"]["direction"] + 2) % 4:
                return [], "choose straight, left or right before rolling"
            state["assam"]["direction"] = direction
            state["phase"] = "roll"
        elif action_type == "roll":
            roll = random.Random(f"{state['seed']}:die:{state['turn_number']}").choice(DIE_FACES)
            start = dict(state["assam"])
            state["assam"], path = advance_assam(start, roll)
            state["last_roll"] = roll
            assam = state["assam"]
            tile = state["board"][assam["y"]][assam["x"]]
            payment = {"owner": None, "due": 0, "paid": 0, "area": []}
            player = state["players"][player_id]
            if tile and tile["owner"] != player_id and not state["players"][tile["owner"]]["eliminated"]:
                area = connected_area(state, assam["x"], assam["y"])
                due = len(area)
                paid = min(due, player["coins"])
                player["coins"] -= paid
                state["players"][tile["owner"]]["coins"] += paid
                player["eliminated"] = paid < due
                payment = {"owner": tile["owner"], "due": due, "paid": paid, "area": area}
            state["last_move"] = {"player_id": player_id, "start": start, "path": path, "roll": roll, "payment": payment}
            state["history"].append({"type": "move", **copy.deepcopy(state["last_move"])})
            state["phase"] = "place"
            if player["eliminated"]:
                player["rugs"] = []
                _next_turn(state)
        else:
            cells = action["cells"]
            if not isinstance(cells, list) or len(cells) != 2 or any(
                not isinstance(cell, list) or len(cell) != 2 or any(type(value) is not int for value in cell)
                for cell in cells
            ):
                return [], "invalid rug coordinates"
            cells = sorted(cells, key=lambda cell: (cell[1], cell[0]))
            if cells not in legal_placements(state):
                return [], "rug must border Assam without covering him or a whole rug"
            color = state["players"][player_id]["rugs"].pop(0)
            tile = {"rug_id": state["next_rug_id"], "owner": player_id, "color": color}
            for column, row in cells:
                state["board"][row][column] = dict(tile)
            state["next_rug_id"] += 1
            state["history"].append({"type": "place", "player_id": player_id, "cells": cells, "color": color})
            _next_turn(state)
        return [{"type": f"marrakech:{action_type}", "player_id": player_id}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        scores = calculate_scores(state)
        current = state["current_turn"]
        legal = MarrakechGame.get_legal_actions(state, viewer_id)
        return {
            "game_id": MarrakechGame.game_id, "you": viewer_id,
            "phase": state["phase"], "current_turn": current, "turn_number": state["turn_number"],
            "players": [
                {
                    "player_id": player_id, "name": state["player_meta"][player_id].get("name", player_id),
                    "colors": list(state["players"][player_id]["colors"]),
                    "rugs_left": len(state["players"][player_id]["rugs"]),
                    "eliminated": state["players"][player_id]["eliminated"], **scores[player_id],
                }
                for player_id in state["turn_order"]
            ],
            "board": copy.deepcopy(state["board"]), "assam": dict(state["assam"]),
            "legal_actions": legal,
            "directions": [direction for direction in range(4) if direction != (state["assam"]["direction"] + 2) % 4] if "orient" in legal else [],
            "legal_placements": legal_placements(state) if "place" in legal else [],
            "next_color": state["players"][current]["rugs"][0] if current and state["players"][current]["rugs"] else None,
            "last_roll": state["last_roll"], "last_move": copy.deepcopy(state["last_move"]),
            "history": copy.deepcopy(state["history"]),
            "winner": list(state["winner"]), "game_over": state["game_over"],
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.marrakech_ai import choose_move
        return choose_move(state, bot_id)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
