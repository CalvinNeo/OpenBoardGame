"""A compact, playable implementation of Sagrada.

The implementation keeps the familiar ten-round dice draft and the core window
constraints while leaving out tool cards and the four starting window choices.
Each player gets a deterministic 4x5 window, one private colour objective, and
three public objectives shared by the table.
"""

from __future__ import annotations

import copy
import random
from typing import Dict, List, Optional, Tuple


COLORS = ("red", "yellow", "green", "blue", "purple")
COLOR_EMOJI = {
    "red": "🔴",
    "yellow": "🟡",
    "green": "🟢",
    "blue": "🔵",
    "purple": "🟣",
}
ROWS = 4
COLS = 5
TOTAL_ROUNDS = 10

# Public objectives are intentionally small and deterministic so the UI can
# explain them without embedding a second rule book.
OBJECTIVE_CATALOG = (
    {
        "id": "color_rows",
        "name": "Color Harmony",
        "description": "5 VP for each completed row containing four different colors.",
    },
    {
        "id": "shade_columns",
        "name": "Shade Rhythm",
        "description": "4 VP for each completed column containing four different shades.",
    },
    {
        "id": "rainbow",
        "name": "Rainbow",
        "description": "6 VP for each color used at least four times.",
    },
    {
        "id": "even_shades",
        "name": "Even Light",
        "description": "1 VP for each die with an even shade.",
    },
    {
        "id": "edge_frame",
        "name": "The Frame",
        "description": "2 VP for every pair of different colors on the window edge.",
    },
)
OBJECTIVES_BY_ID = {objective["id"]: objective for objective in OBJECTIVE_CATALOG}


def _action_schema(action_type: str, properties: Optional[Dict] = None, required: Tuple[str, ...] = ()) -> Dict:
    properties = properties or {}
    return {
        "type": "object",
        "properties": {"type": {"const": action_type}, **properties},
        "required": ["type", *required],
        "additionalProperties": False,
    }


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        _action_schema(
            "place_die",
            {
                "die_id": {"type": "string", "minLength": 1, "maxLength": 40},
                "row": {"type": "integer", "minimum": 0, "maximum": ROWS - 1},
                "col": {"type": "integer", "minimum": 0, "maximum": COLS - 1},
            },
            ("die_id", "row", "col"),
        ),
        _action_schema(
            "skip_die",
            {"die_id": {"type": "string", "minLength": 1, "maxLength": 40}},
            ("die_id",),
        ),
        _action_schema("next_round"),
    ],
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"seed": {"type": ["integer", "string", "null"]}},
    "additionalProperties": False,
}


def _seed_value(config: Optional[Dict]) -> object:
    config = config if isinstance(config, dict) else {}
    return config.get("seed")


def _round_rng(seed: object, round_number: int) -> random.Random:
    return random.Random(f"sagrada:{seed!r}:round:{round_number}")


def _make_restrictions(player_index: int) -> List[List[Optional[Dict[str, object]]]]:
    """Return a sparse deterministic window pattern.

    Restrictions are deliberately sparse (five cells each), leaving enough
    room for bots and new players to complete a window despite random drafts.
    """
    pattern = (
        ("color", 0),
        ("value", 5),
        (None, None),
        ("color", 3),
        ("value", 2),
        ("value", 6),
        (None, None),
        ("color", 1),
        (None, None),
        ("color", 4),
        (None, None),
        ("color", 2),
        ("value", 3),
        (None, None),
        ("value", 1),
        ("color", 3),
        (None, None),
        ("value", 4),
        ("color", 0),
        (None, None),
    )
    cells: List[List[Optional[Dict[str, object]]]] = []
    for row in range(ROWS):
        current: List[Optional[Dict[str, object]]] = []
        for col in range(COLS):
            kind, raw = pattern[(row * COLS + col + player_index * 3) % len(pattern)]
            if kind is None:
                current.append(None)
            elif kind == "color":
                current.append({"color": COLORS[int(raw) % len(COLORS)]})
            else:
                current.append({"value": int(raw)})
        cells.append(current)
    return cells


def _new_grid(player_index: int) -> List[List[Dict[str, object]]]:
    restrictions = _make_restrictions(player_index)
    return [
        [
            {"restriction": copy.deepcopy(restrictions[row][col]), "die": None}
            for col in range(COLS)
        ]
        for row in range(ROWS)
    ]


def _all_neighbours(row: int, col: int):
    for row_delta in (-1, 0, 1):
        for col_delta in (-1, 0, 1):
            if not row_delta and not col_delta:
                continue
            neighbour_row = row + row_delta
            neighbour_col = col + col_delta
            if 0 <= neighbour_row < ROWS and 0 <= neighbour_col < COLS:
                yield neighbour_row, neighbour_col


def _grid_dice(grid: List[List[Dict[str, object]]]) -> List[Dict[str, object]]:
    return [cell["die"] for row in grid for cell in row if cell.get("die")]


def _can_place(grid: List[List[Dict[str, object]]], die: Dict[str, object], row: int, col: int) -> Tuple[bool, str]:
    if not (0 <= row < ROWS and 0 <= col < COLS):
        return False, "cell out of range"
    cell = grid[row][col]
    if cell.get("die"):
        return False, "cell occupied"
    restriction = cell.get("restriction")
    if restriction:
        if "color" in restriction and restriction["color"] != die.get("color"):
            return False, "color does not match window restriction"
        if "value" in restriction and restriction["value"] != die.get("value"):
            return False, "shade does not match window restriction"
    neighbours = list(_all_neighbours(row, col))
    occupied = [grid[nrow][ncol]["die"] for nrow, ncol in neighbours if grid[nrow][ncol].get("die")]
    # The first die must touch the border. Later dice must touch an existing die.
    has_edge = row in (0, ROWS - 1) or col in (0, COLS - 1)
    if occupied:
        pass
    elif _grid_dice(grid):
        return False, "must touch an existing die"
    elif not has_edge:
        return False, "first die must be on the window edge"
    for neighbour_row, neighbour_col in neighbours:
        neighbour = grid[neighbour_row][neighbour_col].get("die")
        if not neighbour:
            continue
        row_delta = abs(neighbour_row - row)
        col_delta = abs(neighbour_col - col)
        if row_delta == 0 or col_delta == 0:
            if neighbour["color"] == die["color"]:
                return False, "adjacent dice cannot share a color"
            if neighbour["value"] == die["value"]:
                return False, "adjacent dice cannot share a shade"
    return True, ""


def _objective_score(player: Dict[str, object], objective_ids: List[str]) -> int:
    grid = player["grid"]
    dice = _grid_dice(grid)
    score = 0
    for objective_id in objective_ids:
        if objective_id == "color_rows":
            for row in grid:
                row_dice = [cell["die"] for cell in row if cell.get("die")]
                if len(row_dice) == COLS and len({die["color"] for die in row_dice}) == COLS - 1:
                    score += 5
        elif objective_id == "shade_columns":
            for col in range(COLS):
                col_dice = [grid[row][col]["die"] for row in range(ROWS) if grid[row][col].get("die")]
                if len(col_dice) == ROWS and len({die["value"] for die in col_dice}) == ROWS:
                    score += 4
        elif objective_id == "rainbow":
            for color in COLORS:
                if sum(1 for die in dice if die["color"] == color) >= 4:
                    score += 6
        elif objective_id == "even_shades":
            score += sum(1 for die in dice if int(die["value"]) % 2 == 0)
        elif objective_id == "edge_frame":
            edge_dice = []
            for row in range(ROWS):
                for col in range(COLS):
                    if row in (0, ROWS - 1) or col in (0, COLS - 1):
                        die = grid[row][col].get("die")
                        if die:
                            edge_dice.append(die)
            score += sum(2 for first, second in zip(edge_dice, edge_dice[1:]) if first["color"] != second["color"])
    return score


def _private_score(player: Dict[str, object]) -> int:
    color = player.get("private_color")
    return sum(int(die["value"]) for die in _grid_dice(player["grid"]) if die["color"] == color)


def _score_preview(state: Dict, player_id: str) -> int:
    player = state["players"][player_id]
    return _objective_score(player, state["objectives"]) + _private_score(player) + int(player.get("favor_tokens", 0))


def _roll_pool(state: Dict) -> None:
    player_count = len(state["turn_order"])
    rng = _round_rng(state["config"].get("seed"), state["round"])
    state["pool"] = [
        {
            "id": f"r{state['round']}-d{index}",
            "color": rng.choice(COLORS),
            "value": rng.randint(1, 6),
        }
        for index in range(player_count * 2 + 1)
    ]
    start_index = (state["round"] - 1) % player_count
    order = state["turn_order"]
    forward = order[start_index:] + order[:start_index]
    state["draft_order"] = forward + list(reversed(forward))
    state["draft_index"] = 0
    state["current_turn"] = state["draft_order"][0]
    state["round_picks"] = {pid: 0 for pid in order}
    state["round_summary"] = []


def _finish_game(state: Dict) -> None:
    results = {}
    for pid in state["turn_order"]:
        player = state["players"][pid]
        objective = _objective_score(player, state["objectives"])
        private = _private_score(player)
        empty = ROWS * COLS - len(_grid_dice(player["grid"]))
        player["score"] = objective + private + int(player.get("favor_tokens", 0)) - empty
        player["objective_score"] = objective
        player["private_score"] = private
        results[pid] = player["score"]
    high = max(results.values(), default=0)
    state["winner"] = [pid for pid, score in results.items() if score == high]
    state["phase"] = "game_over"
    state["game_over"] = True
    state["current_turn"] = None
    state["ready"] = []


def _advance_draft(state: Dict) -> None:
    state["draft_index"] += 1
    if state["draft_index"] >= len(state["draft_order"]):
        # One die remains in the pool by design (2 dice per player + 1).
        state["discarded"] = state.get("discarded", []) + list(state.get("pool", []))
        state["pool"] = []
        state["phase"] = "round_end"
        state["current_turn"] = None
        state["ready"] = []
        return
    state["current_turn"] = state["draft_order"][state["draft_index"]]


class SagradaGame:
    game_id = "sagrada"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not players:
            raise ValueError("no players")
        if len(players) < SagradaGame.min_players or len(players) > SagradaGame.max_players:
            raise ValueError("Sagrada requires 2–4 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique")
        seed = _seed_value(config)
        state = {
            "game_id": SagradaGame.game_id,
            "version": 1,
            "config": {"seed": seed},
            "turn_order": ids,
            "current_turn": None,
            "draft_order": [],
            "draft_index": 0,
            "round_picks": {},
            "round": 1,
            "phase": "drafting",
            "pool": [],
            "discarded": [],
            "ready": [],
            "round_summary": [],
            "objectives": [objective["id"] for objective in OBJECTIVE_CATALOG[:3]],
            "players": {},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "winner": [],
            "game_over": False,
        }
        for index, player in enumerate(ordered):
            pid = player["player_id"]
            state["players"][pid] = {
                "grid": _new_grid(index),
                "private_color": COLORS[index % len(COLORS)],
                "score": 0,
                "objective_score": 0,
                "private_score": 0,
                "favor_tokens": 2,
            }
        _roll_pool(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over") or player_id not in state.get("players", {}):
            return []
        if state.get("phase") == "round_end":
            return [] if player_id in state.get("ready", []) else ["next_round"]
        if state.get("phase") != "drafting" or player_id != state.get("current_turn"):
            return []
        return ["place_die", "skip_die"] if state.get("pool") else []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict):
            return [], "invalid action"
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        action_type = action.get("type")
        legal = SagradaGame.get_legal_actions(state, player_id)
        if action_type == "next_round":
            if state.get("phase") != "round_end":
                return [], "not at round end"
            if player_id in state["ready"]:
                return [], "already ready"
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["turn_order"]):
                if state["round"] >= TOTAL_ROUNDS:
                    _finish_game(state)
                else:
                    state["round"] += 1
                    state["phase"] = "drafting"
                    _roll_pool(state)
            return [], None
        if state.get("phase") != "drafting" or player_id != state.get("current_turn"):
            return [], "not your turn"
        if action_type not in legal:
            return [], "action unavailable"
        die_id = action.get("die_id")
        die = next((candidate for candidate in state.get("pool", []) if candidate.get("id") == die_id), None)
        if die is None:
            return [], "die is not in the pool"
        row = col = None
        if action_type == "place_die":
            row, col = action.get("row"), action.get("col")
            if type(row) is not int or type(col) is not int:
                return [], "invalid cell"
            valid, reason = _can_place(state["players"][player_id]["grid"], die, row, col)
            if not valid:
                return [], reason
        state["pool"] = [candidate for candidate in state["pool"] if candidate.get("id") != die_id]
        state["round_picks"][player_id] = state["round_picks"].get(player_id, 0) + 1
        if action_type == "place_die":
            player = state["players"][player_id]
            player["grid"][row][col]["die"] = copy.deepcopy(die)
            state["round_summary"].append({"player_id": player_id, "die": copy.deepcopy(die), "row": row, "col": col})
        else:
            state["round_summary"].append({"player_id": player_id, "die": copy.deepcopy(die), "skipped": True})
        _advance_draft(state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        for pid in state["turn_order"]:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            reveal_private = pid == viewer_id or state.get("game_over")
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name", pid),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "score": pdata.get("score", 0),
                    # A live preview for opponents excludes the private colour
                    # objective; reveal the full preview only to its owner or
                    # after the final scoring.
                    "score_preview": _score_preview(state, pid) if reveal_private else _objective_score(pdata, state["objectives"]) + int(pdata.get("favor_tokens", 0)),
                    "objective_score": pdata.get("objective_score", 0),
                    "private_score": pdata.get("private_score", 0) if reveal_private else None,
                    "private_color": pdata.get("private_color") if reveal_private else None,
                    "secret_color": pdata.get("private_color") if reveal_private else None,
                    "favor_tokens": pdata.get("favor_tokens", 0),
                    "grid": copy.deepcopy(pdata["grid"]),
                    "round_picks": state.get("round_picks", {}).get(pid, 0),
                    "ready": pid in state.get("ready", []),
                }
            )
        return {
            "game_id": SagradaGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "total_rounds": TOTAL_ROUNDS,
            "current_turn": state.get("current_turn"),
            "turn_order": list(state.get("turn_order", [])),
            "draft_index": state.get("draft_index", 0),
            "pool": copy.deepcopy(state.get("pool", [])),
            "players": players_view,
            "objectives": [copy.deepcopy(OBJECTIVES_BY_ID[objective_id]) for objective_id in state.get("objectives", [])],
            "private_color": state["players"].get(viewer_id, {}).get("private_color"),
            "legal_actions": SagradaGame.get_legal_actions(state, viewer_id),
            "ready": list(state.get("ready", [])),
            "round_summary": copy.deepcopy(state.get("round_summary", [])),
            "winner": list(state.get("winner", [])),
            "game_over": bool(state.get("game_over")),
            "colors": list(COLORS),
            "color_emoji": dict(COLOR_EMOJI),
            "rows": ROWS,
            "cols": COLS,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id not in state.get("players", {}):
            return None
        if state.get("phase") == "round_end":
            return {"type": "next_round"} if bot_id not in state.get("ready", []) else None
        if bot_id != state.get("current_turn"):
            return None
        player = state["players"][bot_id]
        candidates = []
        for die in state.get("pool", []):
            for row in range(ROWS):
                for col in range(COLS):
                    valid, _ = _can_place(player["grid"], die, row, col)
                    if not valid:
                        continue
                    value = 1.0
                    if die["color"] == player["private_color"]:
                        value += 0.4
                    if die["value"] % 2 == 0:
                        value += 0.1
                    if row in (0, ROWS - 1) or col in (0, COLS - 1):
                        value += 0.05
                    candidates.append((value, die, row, col))
        if not candidates:
            die = state.get("pool", [None])[0]
            return {"type": "skip_die", "die_id": die["id"]} if die else None
        candidates.sort(key=lambda item: (item[0], item[1]["value"], item[1]["id"]), reverse=True)
        _, die, row, col = candidates[0]
        return {"type": "place_die", "die_id": die["id"], "row": row, "col": col}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

