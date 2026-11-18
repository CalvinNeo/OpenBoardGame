"""工厂乐翻天 Factory Funner — a simultaneous machine-placement puzzle for 1-6 players.

Every round reveals one machine that all players must install in their own
factory. A machine has ports on its four edges; an output port facing a
neighbouring input port of the same material forms a link. A factory's money is
recomputed from the whole board after every placement, so building next to an
older machine improves that machine too. The server owns the board, the machine
deck and every scoring rule.
"""
from __future__ import annotations

import random
import time
from typing import Dict, List, Optional, Tuple

BOARD_SIZE = 6
DEFAULT_ROUNDS = 12
MIN_ROUNDS = 6
MAX_ROUNDS = 20

MATERIALS: Tuple[str, ...] = ("red", "blue", "yellow", "green")
MATERIAL_EMOJI: Dict[str, str] = {"red": "🔴", "blue": "🔵", "yellow": "🟡", "green": "🟢"}

IN_KIND = "in"
OUT_KIND = "out"

NORTH, EAST, SOUTH, WEST = 0, 1, 2, 3
DELTA = {NORTH: (-1, 0), EAST: (0, 1), SOUTH: (1, 0), WEST: (0, -1)}
OPPOSITE = {NORTH: SOUTH, EAST: WEST, SOUTH: NORTH, WEST: EAST}
ROTATIONS = (0, 90, 180, 270)

# One matched port pays a bonus, an input left unfed costs a bought raw
# material, and an output nobody consumes costs waste handling.
MATCH_BONUS = 1
UNFED_INPUT_COST = 2
UNUSED_OUTPUT_COST = 1


def _machine(machine_id: str, value: int, ports: List[Tuple[int, str, str]]) -> Dict:
    return {
        "id": machine_id,
        "value": value,
        "ports": [{"edge": edge, "kind": kind, "color": color} for edge, kind, color in ports],
    }


# edge: 0 north, 1 east, 2 south, 3 west. At most one port per edge.
MACHINE_CATALOG: List[Dict] = [
    _machine("m01", 3, [(EAST, OUT_KIND, "red")]),
    _machine("m02", 4, [(WEST, IN_KIND, "red")]),
    _machine("m03", 4, [(NORTH, IN_KIND, "blue"), (SOUTH, OUT_KIND, "blue")]),
    _machine("m04", 5, [(EAST, OUT_KIND, "red"), (SOUTH, OUT_KIND, "blue")]),
    _machine("m05", 5, [(NORTH, IN_KIND, "red"), (EAST, IN_KIND, "blue")]),
    _machine("m06", 6, [(NORTH, IN_KIND, "red"), (SOUTH, OUT_KIND, "yellow"), (EAST, OUT_KIND, "green")]),
    _machine("m07", 5, [(WEST, IN_KIND, "yellow"), (EAST, OUT_KIND, "red")]),
    _machine("m08", 6, [(NORTH, IN_KIND, "green"), (EAST, IN_KIND, "green"), (SOUTH, OUT_KIND, "blue")]),
    _machine("m09", 7, [(NORTH, IN_KIND, "red"), (EAST, IN_KIND, "blue"), (SOUTH, OUT_KIND, "yellow"), (WEST, OUT_KIND, "green")]),
    _machine("m10", 4, [(SOUTH, OUT_KIND, "yellow")]),
    _machine("m11", 5, [(NORTH, IN_KIND, "yellow"), (WEST, OUT_KIND, "green")]),
    _machine("m12", 6, [(NORTH, IN_KIND, "red"), (EAST, OUT_KIND, "blue"), (WEST, OUT_KIND, "yellow")]),
    _machine("m13", 4, [(EAST, IN_KIND, "green")]),
    _machine("m14", 5, [(SOUTH, IN_KIND, "blue"), (NORTH, OUT_KIND, "green")]),
    _machine("m15", 6, [(SOUTH, IN_KIND, "yellow"), (NORTH, OUT_KIND, "red"), (EAST, OUT_KIND, "green")]),
    _machine("m16", 7, [(WEST, IN_KIND, "red"), (NORTH, IN_KIND, "yellow"), (EAST, OUT_KIND, "blue"), (SOUTH, OUT_KIND, "blue")]),
    _machine("m17", 3, [(NORTH, OUT_KIND, "green")]),
    _machine("m18", 5, [(EAST, IN_KIND, "red"), (WEST, IN_KIND, "blue")]),
    _machine("m19", 6, [(SOUTH, IN_KIND, "green"), (EAST, OUT_KIND, "yellow"), (WEST, OUT_KIND, "red")]),
    _machine("m20", 5, [(SOUTH, IN_KIND, "red"), (NORTH, OUT_KIND, "blue")]),
    _machine("m21", 7, [(NORTH, IN_KIND, "blue"), (SOUTH, IN_KIND, "green"), (EAST, OUT_KIND, "red"), (WEST, OUT_KIND, "yellow")]),
    _machine("m22", 4, [(WEST, OUT_KIND, "yellow")]),
    _machine("m23", 6, [(EAST, IN_KIND, "yellow"), (SOUTH, IN_KIND, "green"), (NORTH, OUT_KIND, "red")]),
    _machine("m24", 5, [(SOUTH, OUT_KIND, "red"), (NORTH, OUT_KIND, "yellow")]),
    _machine("m25", 6, [(WEST, IN_KIND, "green"), (EAST, IN_KIND, "blue"), (SOUTH, OUT_KIND, "yellow")]),
    _machine("m26", 8, [(NORTH, IN_KIND, "red"), (EAST, IN_KIND, "green"), (SOUTH, OUT_KIND, "blue"), (WEST, OUT_KIND, "yellow")]),
    _machine("m27", 4, [(EAST, OUT_KIND, "green")]),
    _machine("m28", 5, [(NORTH, IN_KIND, "blue"), (WEST, OUT_KIND, "red")]),
]
MACHINES_BY_ID: Dict[str, Dict] = {machine["id"]: machine for machine in MACHINE_CATALOG}


def _schema(kind: str, fields: Optional[Dict] = None, required: Tuple = ()) -> Dict:
    return {
        "type": "object",
        "properties": {"type": {"const": kind}, **(fields or {})},
        "required": ["type", *required],
        "additionalProperties": False,
    }


_CELL = {"type": "integer", "minimum": 0, "maximum": BOARD_SIZE - 1}
ACTION_SCHEMA = {"oneOf": [
    _schema("place_machine", {"row": _CELL, "col": _CELL, "rotation": {"enum": list(ROTATIONS)}},
            ("row", "col", "rotation")),
    _schema("pass_machine"),
    _schema("next_round"),
]}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"rounds": {"type": "integer", "minimum": MIN_ROUNDS, "maximum": MAX_ROUNDS}},
    "additionalProperties": False,
}


def _port_on_edge(machine: Dict, rotation: int, edge: int) -> Optional[Dict]:
    for port in machine["ports"]:
        if (port["edge"] + rotation) % 4 == edge:
            return port
    return None


def _neighbour_port(board: List[List[Optional[Dict]]], row: int, col: int, edge: int) -> Optional[Dict]:
    row_delta, col_delta = DELTA[edge]
    next_row, next_col = row + row_delta, col + col_delta
    if not (0 <= next_row < BOARD_SIZE and 0 <= next_col < BOARD_SIZE):
        return None
    cell = board[next_row][next_col]
    if not cell:
        return None
    machine = MACHINES_BY_ID[cell["machine_id"]]
    return _port_on_edge(machine, cell["rotation"], OPPOSITE[edge])


def machine_score(board: List[List[Optional[Dict]]], row: int, col: int) -> int:
    """Current money produced by one machine, given the whole board."""
    cell = board[row][col]
    machine = MACHINES_BY_ID[cell["machine_id"]]
    matched = unfed = unused = 0
    for port in machine["ports"]:
        edge = (port["edge"] + rotation_of(cell)) % 4
        partner = _neighbour_port(board, row, col, edge)
        if partner and partner["kind"] != port["kind"] and partner["color"] == port["color"]:
            matched += 1
        elif port["kind"] == IN_KIND:
            unfed += 1
        else:
            unused += 1
    return machine["value"] + MATCH_BONUS * matched - UNFED_INPUT_COST * unfed - UNUSED_OUTPUT_COST * unused


def rotation_of(cell: Dict) -> int:
    return int(cell["rotation"]) // 90 % 4


def board_money(board: List[List[Optional[Dict]]]) -> int:
    total = 0
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            if board[row][col]:
                total += machine_score(board, row, col)
    return total


def machine_breakdown(board: List[List[Optional[Dict]]], row: int, col: int) -> Dict:
    cell = board[row][col]
    machine = MACHINES_BY_ID[cell["machine_id"]]
    matched = unfed = unused = 0
    links = []
    for port in machine["ports"]:
        edge = (port["edge"] + rotation_of(cell)) % 4
        partner = _neighbour_port(board, row, col, edge)
        if partner and partner["kind"] != port["kind"] and partner["color"] == port["color"]:
            matched += 1
            links.append({"edge": edge, "color": port["color"], "kind": port["kind"]})
        elif port["kind"] == IN_KIND:
            unfed += 1
        else:
            unused += 1
    return {
        "value": machine["value"],
        "matched": matched,
        "unfed": unfed,
        "unused": unused,
        "score": machine["value"] + MATCH_BONUS * matched - UNFED_INPUT_COST * unfed - UNUSED_OUTPUT_COST * unused,
        "links": links,
    }


def _empty_board() -> List[List[Optional[Dict]]]:
    return [[None for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def _has_free_cell(board: List[List[Optional[Dict]]]) -> bool:
    return any(cell is None for row in board for cell in row)


def _build_deck(rounds: int) -> List[str]:
    deck: List[str] = []
    while len(deck) < rounds:
        batch = [machine["id"] for machine in MACHINE_CATALOG]
        random.shuffle(batch)
        deck.extend(batch)
    return deck[:rounds]


def _player_state(state: Dict, player_id: str) -> Optional[Dict]:
    return state.get("players", {}).get(player_id)


def _order(state: Dict) -> List[str]:
    return list(state.get("order", []))


def _all_acted(state: Dict) -> bool:
    return all(state["players"][pid]["acted"] for pid in _order(state))


def _all_ready(state: Dict) -> bool:
    return all(state["players"][pid]["ready"] for pid in _order(state))


def _finalize(state: Dict) -> None:
    scores = {pid: state["players"][pid]["money"] for pid in _order(state)}
    state["scores"] = scores
    best = max(scores.values()) if scores else 0
    state["winner"] = [pid for pid, score in scores.items() if score == best]
    state["game_over"] = True
    state["phase"] = "game_over"


def _advance_round(state: Dict, events: List[Dict]) -> None:
    if state["round"] >= state["total_rounds"]:
        _finalize(state)
        events.append({"type": "factory_funner:game_over", "payload": {"winner": list(state["winner"])}})
        return
    state["round"] += 1
    state["deck_index"] += 1
    state["current_machine"] = state["deck"][state["deck_index"]]
    state["phase"] = "placing"
    state["round_summary"] = []
    for pid in _order(state):
        player = state["players"][pid]
        player["acted"] = False
        player["ready"] = False
        player["last"] = None
    events.append({"type": "factory_funner:round_start", "payload": {"round": state["round"]}})


class FactoryFunnerGame:
    game_id = "factory_funner"
    min_players = 1
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = dict(config or {})
        rounds = int(config.get("rounds") or DEFAULT_ROUNDS)
        rounds = max(MIN_ROUNDS, min(MAX_ROUNDS, rounds))
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        order = [player["player_id"] for player in ordered]
        deck = _build_deck(rounds)
        return {
            "players": {
                pid: {
                    "board": _empty_board(),
                    "money": 0,
                    "acted": False,
                    "ready": False,
                    "last": None,
                }
                for pid in order
            },
            "player_meta": {player["player_id"]: player for player in ordered},
            "order": order,
            "deck": deck,
            "deck_index": 0,
            "round": 1,
            "total_rounds": rounds,
            "phase": "placing",
            "current_machine": deck[0],
            "round_summary": [],
            "game_over": False,
            "winner": [],
            "scores": {},
            "game_start_time": time.time(),
            "config": config,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        player = _player_state(state, player_id)
        if not player:
            return []
        phase = state.get("phase")
        if phase == "placing":
            if player["acted"]:
                return []
            return ["place_machine", "pass_machine"] if _has_free_cell(player["board"]) else ["pass_machine"]
        if phase == "review":
            return [] if player["ready"] else ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        player = _player_state(state, player_id)
        if not player:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        phase = state.get("phase")

        if action_type == "place_machine":
            if phase != "placing":
                return [], "not accepting placements"
            if player["acted"]:
                return [], "already acted this round"
            row = action.get("row")
            col = action.get("col")
            rotation = action.get("rotation")
            if not isinstance(row, int) or not isinstance(col, int):
                return [], "invalid cell"
            if not (0 <= row < BOARD_SIZE and 0 <= col < BOARD_SIZE):
                return [], "cell is outside the factory"
            if rotation not in ROTATIONS:
                return [], "invalid rotation"
            if player["board"][row][col] is not None:
                return [], "cell already holds a machine"

            before = player["money"]
            player["board"][row][col] = {
                "machine_id": state["current_machine"],
                "rotation": rotation,
                "round": state["round"],
            }
            player["money"] = board_money(player["board"])
            delta = player["money"] - before
            player["acted"] = True
            player["last"] = {
                "action": "place",
                "row": row,
                "col": col,
                "rotation": rotation,
                "machine_id": state["current_machine"],
                "delta": delta,
                "money": player["money"],
            }
            events.append({
                "type": "factory_funner:place_machine",
                "payload": {"player_id": player_id, "row": row, "col": col, "rotation": rotation, "delta": delta},
            })

        elif action_type == "pass_machine":
            if phase != "placing":
                return [], "not accepting placements"
            if player["acted"]:
                return [], "already acted this round"
            player["acted"] = True
            player["last"] = {
                "action": "pass",
                "machine_id": state["current_machine"],
                "delta": 0,
                "money": player["money"],
            }
            events.append({"type": "factory_funner:pass_machine", "payload": {"player_id": player_id}})

        elif action_type == "next_round":
            if phase != "review":
                return [], "round is not finished"
            if player["ready"]:
                return [], "already ready"
            player["ready"] = True
            events.append({"type": "factory_funner:next_round", "payload": {"player_id": player_id}})
            if _all_ready(state):
                _advance_round(state, events)
            return events, None

        else:
            return [], "invalid action"

        if _all_acted(state):
            state["phase"] = "review"
            state["round_summary"] = [
                {"player_id": pid, **state["players"][pid]["last"]} for pid in _order(state)
            ]
            for pid in _order(state):
                state["players"][pid]["ready"] = False
            events.append({"type": "factory_funner:round_review", "payload": {"round": state["round"]}})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        for pid in _order(state):
            meta = state["player_meta"].get(pid, {})
            player = state["players"][pid]
            players_view.append({
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "money": player["money"],
                "acted": player["acted"],
                "ready": player["ready"],
                "board": player["board"],
                "last": player["last"],
            })
        return {
            "game_id": FactoryFunnerGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "total_rounds": state.get("total_rounds"),
            "current_machine": state.get("current_machine"),
            "machines": {machine["id"]: machine for machine in MACHINE_CATALOG},
            "board_size": BOARD_SIZE,
            "materials": list(MATERIALS),
            "material_emoji": MATERIAL_EMOJI,
            "scoring": {
                "match_bonus": MATCH_BONUS,
                "unfed_input_cost": UNFED_INPUT_COST,
                "unused_output_cost": UNUSED_OUTPUT_COST,
            },
            "players": players_view,
            "round_summary": state.get("round_summary", []),
            "legal_actions": FactoryFunnerGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "scores": state.get("scores", {}),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        player = _player_state(state, bot_id)
        if not player:
            return None
        phase = state.get("phase")
        if phase == "review":
            return None if player["ready"] else {"type": "next_round", "delay_ms": 500}
        if phase != "placing" or player["acted"]:
            return None

        machine_id = state["current_machine"]
        board = player["board"]
        best_money = None
        best_options = []
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                if board[row][col] is not None:
                    continue
                for rotation in ROTATIONS:
                    board[row][col] = {"machine_id": machine_id, "rotation": rotation, "round": state["round"]}
                    money = board_money(board)
                    board[row][col] = None
                    if best_money is None or money > best_money:
                        best_money = money
                        best_options = [(row, col, rotation)]
                    elif money == best_money:
                        best_options.append((row, col, rotation))
        if not best_options or best_money is None:
            return {"type": "pass_machine", "delay_ms": 600}
        gain = best_money - player["money"]
        if gain <= -UNFED_INPUT_COST:
            return {"type": "pass_machine", "delay_ms": 600}
        # Equally good cells are common on an open board, so pick one at
        # random instead of always taking the first; two bots would
        # otherwise mirror each other for the whole game.
        row, col, rotation = random.choice(best_options)
        return {
            "type": "place_machine",
            "row": row,
            "col": col,
            "rotation": rotation,
            "delay_ms": 700,
        }

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
