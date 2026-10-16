"""Sagrada, classic 2017 base game (2–4 players), with all twelve tools.

The server owns dice, randomness and every placement check. Random tools reserve
one die until the player resolves the revealed result. Actions are transactional:
a rejected action cannot spend favors, reveal another roll or change the turn.
"""
from __future__ import annotations

import copy
import json
import random
import uuid
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.sagrada_reference_data import COLORS, OBJECTIVE_CATALOG, PATTERN_CATALOG, TOOL_CATALOG

ROWS, COLS, TOTAL_ROUNDS = 4, 5, 10
COLOR_EMOJI = dict(zip(COLORS, ("🔴", "🟡", "🟢", "🔵", "🟣")))
OBJECTIVES_BY_ID = {item["id"]: item for item in OBJECTIVE_CATALOG}
TOOLS_BY_ID = {item["id"]: item for item in TOOL_CATALOG}
PATTERNS_BY_ID = {item["id"]: item for item in PATTERN_CATALOG}


def _schema(kind: str, fields: Optional[Dict] = None, required: Tuple = ()) -> Dict:
    return {"type": "object", "properties": {
        "type": {"const": kind}, "revision": {"type": "integer", "minimum": 0}, **(fields or {})},
        "required": ["type", "revision", *required], "additionalProperties": False}


_ID = {"type": "string", "minLength": 1, "maxLength": 80}
_ROW = {"type": "integer", "minimum": 0, "maximum": 3}
_COL = {"type": "integer", "minimum": 0, "maximum": 4}
_MOVE = {"type": "object", "properties": {"from_row": _ROW, "from_col": _COL, "to_row": _ROW, "to_col": _COL},
         "required": ["from_row", "from_col", "to_row", "to_col"], "additionalProperties": False}
ACTION_SCHEMA = {"oneOf": [
    _schema("choose_pattern", {"pattern_id": _ID}, ("pattern_id",)),
    _schema("place_die", {"die_id": _ID, "row": _ROW, "col": _COL}, ("die_id", "row", "col")),
    _schema("end_turn"),
    _schema("next_round"),
    _schema("use_tool", {"tool_id": {"enum": list(TOOLS_BY_ID)}, "die_id": _ID,
                         "track_die_id": _ID, "delta": {"enum": [-1, 1]}, "row": _ROW, "col": _COL,
                         "moves": {"type": "array", "items": _MOVE, "minItems": 1, "maxItems": 2}}, ("tool_id",)),
    _schema("resolve_tool", {"row": _ROW, "col": _COL, "value": {"type": "integer", "minimum": 1, "maximum": 6},
                             "return_die": {"type": "boolean"}}),
]}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": ["integer", "string", "null"]}},
                 "additionalProperties": False}
_VALIDATOR = Draft7Validator(ACTION_SCHEMA)


def _empty_grid(restrictions: Optional[List] = None) -> List:
    return [[{"restriction": copy.deepcopy(restrictions[r][c]) if restrictions else None, "die": None}
             for c in range(COLS)] for r in range(ROWS)]


def _rng(state: Dict) -> random.Random:
    """A JSON-safe deterministic random stream, including after reconnect."""
    result = random.Random(f"{state['rng_seed']!r}:{state['rng_counter']}")
    state["rng_counter"] += 1
    return result


def _placement_error(grid: List, die: Dict, row: int, col: int, *, ignore_color: bool = False,
                     ignore_value: bool = False, isolated: bool = False) -> Optional[str]:
    if type(row) is not int or type(col) is not int or not (0 <= row < ROWS and 0 <= col < COLS):
        return "cell is outside the window"
    if grid[row][col]["die"]:
        return "cell already contains a die"
    restriction = grid[row][col].get("restriction") or {}
    if not ignore_color and restriction.get("color") and restriction["color"] != die["color"]:
        return "die does not match the window color"
    if not ignore_value and restriction.get("value") and restriction["value"] != die["value"]:
        return "die does not match the window shade"
    count, touches = 0, False
    for r in range(ROWS):
        for c in range(COLS):
            other = grid[r][c]["die"]
            if not other:
                continue
            count += 1
            dr, dc = abs(r - row), abs(c - col)
            if max(dr, dc) == 1:
                touches = True
            if dr + dc == 1 and other["color"] == die["color"]:
                return "adjacent dice cannot share a color"
            if dr + dc == 1 and other["value"] == die["value"]:
                return "adjacent dice cannot share a shade"
    if not count and row not in (0, ROWS - 1) and col not in (0, COLS - 1):
        return "first die must be on the window edge"
    if isolated and touches:
        return "this tool requires a die touching no other dice"
    if not isolated and count and not touches:
        return "die must touch an existing die"
    return None


def _placements(grid: List, die: Dict, **options) -> List[Tuple[int, int]]:
    return [(r, c) for r in range(ROWS) for c in range(COLS) if not _placement_error(grid, die, r, c, **options)]


def _objective_score(grid: List, objective: Dict) -> int:
    kind, attribute, points = objective["kind"], objective["attribute"], objective["points"]
    dice = [cell["die"] for row in grid for cell in row if cell["die"]]
    if kind in ("row", "column"):
        lines = grid if kind == "row" else [[grid[r][c] for r in range(ROWS)] for c in range(COLS)]
        return points * sum(all(cell["die"] for cell in line) and
                            len({cell["die"][attribute] for cell in line}) == len(line) for line in lines)
    if kind == "set":
        counts = Counter(die[attribute] for die in dice)
        return points * min(counts[value] for value in objective["values"])
    if kind == "diagonal":
        return sum(1 for r in range(ROWS) for c in range(COLS) if grid[r][c]["die"] and any(
            0 <= r + dr < ROWS and 0 <= c + dc < COLS and grid[r + dr][c + dc]["die"] and
            grid[r + dr][c + dc]["die"]["color"] == grid[r][c]["die"]["color"]
            for dr, dc in ((-1, -1), (-1, 1), (1, -1), (1, 1))))
    return 0


def _score_player(state: Dict, pid: str) -> Dict:
    player = state["players"][pid]
    grid = player["grid"]
    scores = {objective["id"]: _objective_score(grid, objective) for objective in state["objectives"]}
    private = sum(cell["die"]["value"] for row in grid for cell in row
                  if cell["die"] and cell["die"]["color"] == player["private_color"])
    empty = sum(cell["die"] is None for row in grid for cell in row)
    public = sum(scores.values())
    return {"objective_scores": scores, "objective_score": public, "public_score": public,
            "private_score": private, "empty_penalty": empty,
            "score": public + private + player["favor_tokens"] - empty}


def _log(state: Dict, pid: Optional[str], kind: str, **details) -> Dict:
    entry = {"player_id": pid, "type": kind, "round": state["round"], **copy.deepcopy(details)}
    state["round_actions"].append(entry)
    state["log"].append(entry)
    state["log"] = state["log"][-200:]
    return {"type": f"sagrada:{kind}", "payload": copy.deepcopy(entry)}


def _start_round(state: Dict) -> None:
    n = len(state["turn_order"])
    start = (state["start_index"] + state["round"] - 1) % n
    order = state["turn_order"][start:] + state["turn_order"][:start]
    state["round_order"] = order
    state["draft_order"] = order + list(reversed(order))
    state["draft_index"] = 0
    state["current_turn"] = order[0]
    state["turn_state"] = {"drafted": False, "tool_used": False}
    state["skip_second"] = []
    state["ready"] = []
    state["round_actions"] = []
    state["round_summary"] = []
    state["phase"] = "drafting"
    state["pool"] = []
    roller = _rng(state)
    for _ in range(2 * n + 1):
        die = state["bag"].pop(roller.randrange(len(state["bag"])))
        die["value"] = roller.randint(1, 6)
        state["pool"].append(die)


def _advance(state: Dict) -> None:
    state["draft_index"] += 1
    n = len(state["turn_order"])
    while (state["draft_index"] < len(state["draft_order"]) and state["draft_index"] >= n
           and state["draft_order"][state["draft_index"]] in state["skip_second"]):
        state["draft_index"] += 1
    state["turn_state"] = {"drafted": False, "tool_used": False}
    if state["draft_index"] < len(state["draft_order"]):
        state["current_turn"] = state["draft_order"][state["draft_index"]]
        return
    state["round_track"].append(state["pool"])
    state["pool"] = []
    state["round_summary"] = copy.deepcopy(state["round_actions"])
    state["current_turn"] = None
    state["phase"] = "round_end"
    state["ready"] = []


def _finish(state: Dict) -> None:
    state["game_over"] = True
    state["phase"] = "game_over"
    order = state["round_order"]
    state["scores"] = {pid: _score_player(state, pid) for pid in state["turn_order"]}
    state["ranking"] = sorted(state["turn_order"], key=lambda pid: (
        state["scores"][pid]["score"], state["scores"][pid]["private_score"],
        state["players"][pid]["favor_tokens"], order.index(pid)), reverse=True)
    state["winner"] = state["ranking"][:1]


def _take_pool(state: Dict, die_id: str) -> Dict:
    for index, die in enumerate(state["pool"]):
        if die["id"] == die_id:
            return state["pool"].pop(index)
    raise ValueError("die is no longer in the draft pool")


def _place(state: Dict, pid: str, die: Dict, action: Dict, **options) -> Dict:
    if "row" not in action or "col" not in action:
        raise ValueError("choose a destination cell")
    grid = state["players"][pid]["grid"]
    error = _placement_error(grid, die, action["row"], action["col"], **options)
    if error:
        raise ValueError(error)
    grid[action["row"]][action["col"]]["die"] = die
    return _log(state, pid, "place_die", die=die, row=action["row"], col=action["col"])


def _move_dice(state: Dict, pid: str, tool_id: str, moves: List) -> None:
    minimum = 2 if tool_id == "lathekin" else 1
    maximum = 2 if tool_id in ("lathekin", "tap_wheel") else 1
    if not isinstance(moves, list) or not minimum <= len(moves) <= maximum:
        raise ValueError(f"choose {minimum}–{maximum} moves")
    grid = state["players"][pid]["grid"]
    moved, color = set(), None
    track_colors = {die["color"] for dice in state["round_track"] for die in dice}
    for move in moves:
        fr, fc, tr, tc = (move[key] for key in ("from_row", "from_col", "to_row", "to_col"))
        if (fr, fc) == (tr, tc):
            raise ValueError("move a die to a different cell")
        die = grid[fr][fc]["die"]
        if not die or die["id"] in moved:
            raise ValueError("choose a different existing die for each move")
        if tool_id == "tap_wheel":
            if die["color"] not in track_colors or (color and die["color"] != color):
                raise ValueError("moved dice must share a color present on the round track")
            color = die["color"]
        grid[fr][fc]["die"] = None
        error = _placement_error(grid, die, tr, tc, ignore_color=tool_id == "eglomise_brush",
                                 ignore_value=tool_id == "copper_foil_burnisher")
        if error:
            raise ValueError(error)
        grid[tr][tc]["die"] = die
        moved.add(die["id"])


def _use_tool(state: Dict, pid: str, action: Dict) -> List:
    tool_id = action["tool_id"]
    tool = next((tool for tool in state["tools"] if tool["id"] == tool_id), None)
    if not tool:
        raise ValueError("tool is not available in this game")
    turn = state["turn_state"]
    if turn["tool_used"]:
        raise ValueError("only one tool may be used per turn")
    player = state["players"][pid]
    cost = 1 if tool["uses"] == 0 else 2
    if player["favor_tokens"] < cost:
        raise ValueError("not enough Favor Tokens")
    moves_tool = tool_id in ("eglomise_brush", "copper_foil_burnisher", "lathekin", "tap_wheel")
    second = state["draft_index"] >= len(state["turn_order"])
    expected = set(TOOLS_BY_ID[tool_id]["needs"])
    supplied = set(action) - {"type", "revision", "tool_id"}
    if supplied != expected:
        raise ValueError("choose exactly the targets required by this tool")
    if tool_id == "glazing_hammer" and (not second or turn["drafted"]):
        raise ValueError("Glazing Hammer requires your second turn before drafting")
    if tool_id == "running_pliers" and second:
        raise ValueError("Running Pliers requires your first turn")
    if not moves_tool and tool_id not in ("glazing_hammer", "running_pliers") and turn["drafted"]:
        raise ValueError("you have already drafted this turn")
    events = []
    if moves_tool:
        _move_dice(state, pid, tool_id, action["moves"])
    elif tool_id == "glazing_hammer":
        roller = _rng(state)
        for die in state["pool"]:
            die["value"] = roller.randint(1, 6)
    else:
        die = _take_pool(state, action["die_id"])
        if tool_id == "grozing_pliers":
            if type(action["delta"]) is not int or not 1 <= die["value"] + action["delta"] <= 6:
                raise ValueError("the die cannot wrap between 1 and 6")
            die["value"] += action["delta"]
        elif tool_id == "grinding_stone":
            die["value"] = 7 - die["value"]
        elif tool_id == "lens_cutter":
            target = None
            for dice in state["round_track"]:
                for index, track_die in enumerate(dice):
                    if track_die["id"] == action["track_die_id"]:
                        target = track_die
                        dice[index] = die
                        break
            if not target:
                raise ValueError("choose a die from a completed round")
            die = target
        elif tool_id == "flux_brush":
            die["value"] = _rng(state).randint(1, 6)
        elif tool_id == "flux_remover":
            state["bag"].append(die)
            die = state["bag"].pop(_rng(state).randrange(len(state["bag"])))
            die["value"] = None
        turn["drafted"] = True
        if tool_id in ("flux_brush", "flux_remover"):
            state["pending_tool"] = {"tool_id": tool_id, "player_id": pid, "die": die}
            if tool_id == "flux_brush" and not _placements(player["grid"], die):
                state["pool"].append(die)
                state["pending_tool"] = None
                events.append(_log(state, pid, "return_die", die=die, message=f"{player['name']} returned an unplaceable rerolled die to the pool."))
        else:
            events.append(_place(state, pid, die, action, isolated=tool_id == "cork_backed_straightedge"))
    player["favor_tokens"] -= cost
    tool["uses"] += 1
    tool["tokens"] += cost
    turn["tool_used"] = True
    events.append(_log(state, pid, "use_tool", tool_id=tool_id, cost=cost,
                       moves=action.get("moves", [])))
    if tool_id == "running_pliers":
        state["skip_second"].append(pid)
        events.append(_log(state, pid, "end_turn"))
        _advance(state)
    return events


def _resolve_tool(state: Dict, pid: str, action: Dict) -> List:
    pending = state.get("pending_tool")
    if not pending:
        raise ValueError("there is no tool result to resolve")
    die = pending["die"]
    grid = state["players"][pid]["grid"]
    remover = pending["tool_id"] == "flux_remover"
    if remover:
        if "value" not in action and not action.get("return_die"):
            raise ValueError("choose the replacement die's value")
        die["value"] = action.get("value", 1)
    elif "value" in action:
        raise ValueError("a rerolled die's value cannot be changed")
    if action.get("return_die"):
        if "row" in action or "col" in action:
            raise ValueError("choose a placement or return the die")
        choices = [dict(die, value=value) for value in range(1, 7)] if remover else [die]
        if any(_placements(grid, choice) for choice in choices):
            raise ValueError("the die must be placed when a legal placement exists")
        state["pool"].append(die)
        event = _log(state, pid, "return_die", die=die)
    else:
        event = _place(state, pid, die, action)
    state["pending_tool"] = None
    return [event]


def _apply(state: Dict, pid: str, action: Dict) -> List:
    kind = action["type"]
    if kind not in SagradaGame.get_legal_actions(state, pid):
        raise ValueError("action is not available now")
    if kind == "choose_pattern":
        player = state["players"][pid]
        if action["pattern_id"] not in player["pattern_choices"]:
            raise ValueError("choose one of your four window patterns")
        pattern = PATTERNS_BY_ID[action["pattern_id"]]
        player.update(pattern_id=pattern["id"], pattern_name=pattern["name"],
                      favor_tokens=pattern["difficulty"], grid=_empty_grid(pattern["restrictions"]))
        events = [_log(state, pid, "choose_pattern", message=f"{player['name']} chose {pattern['name']}.")]
        if all(player["pattern_id"] for player in state["players"].values()):
            _start_round(state)
        return events
    if kind == "next_round":
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["turn_order"]):
            if state["round"] == TOTAL_ROUNDS:
                _finish(state)
            else:
                state["round"] += 1
                _start_round(state)
        return []
    if kind == "use_tool":
        return _use_tool(state, pid, action)
    if kind == "resolve_tool":
        return _resolve_tool(state, pid, action)
    if kind == "place_die":
        die = _take_pool(state, action["die_id"])
        event = _place(state, pid, die, action)
        state["turn_state"]["drafted"] = True
        return [event]
    event = _log(state, pid, "end_turn")
    _advance(state)
    return [event]


class SagradaGame:
    game_id = "sagrada"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Dict, players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 4 or len({p["player_id"] for p in players}) != len(players):
            raise ValueError("Sagrada requires 2–4 different players")
        if not Draft7Validator(CONFIG_SCHEMA).is_valid(config):
            raise ValueError("invalid Sagrada configuration")
        order = [p["player_id"] for p in sorted(players, key=lambda p: p["seat"])]
        seed = config.get("seed")
        seed = seed if seed is not None else uuid.uuid4().hex
        roller = random.Random(seed)
        cards = list(range(1, 13))
        roller.shuffle(cards)
        private = list(COLORS)
        roller.shuffle(private)
        bag = [{"id": f"{color}-{n}", "color": color, "value": None} for color in COLORS for n in range(18)]
        roller.shuffle(bag)
        state = {"config": dict(config), "rng_seed": seed, "rng_counter": 0, "revision": 0,
                 "players": {}, "turn_order": order, "round": 1, "start_index": roller.randrange(len(order)),
                 "round_order": [], "draft_order": [], "draft_index": 0, "current_turn": None,
                 "turn_state": {"drafted": False, "tool_used": False}, "skip_second": [],
                 "phase": "pattern_select", "bag": bag, "pool": [], "round_track": [],
                 "pending_tool": None, "ready": [], "round_summary": [], "round_actions": [], "log": [],
                 "game_over": False, "winner": [], "ranking": [], "scores": {},
                 "tools": [{"id": tool["id"], "uses": 0, "tokens": 0} for tool in roller.sample(list(TOOL_CATALOG), 3)],
                 "objectives": json.loads(json.dumps(roller.sample(list(OBJECTIVE_CATALOG), 3)))}
        by_id = {p["player_id"]: p for p in players}
        for index, pid in enumerate(order):
            choices = [pattern["id"] for pattern in PATTERN_CATALOG if pattern["card_id"] in cards[index * 2:index * 2 + 2]]
            state["players"][pid] = {"player_id": pid, "name": by_id[pid]["name"], "seat": by_id[pid]["seat"],
                                      "is_bot": bool(by_id[pid].get("is_bot")), "pattern_choices": choices,
                                      "pattern_id": None, "pattern_name": None, "favor_tokens": 0,
                                      "private_color": private[index], "grid": _empty_grid()}
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "pattern_select":
            return [] if state["players"][player_id]["pattern_id"] else ["choose_pattern"]
        if state["phase"] == "round_end":
            return [] if player_id in state["ready"] else ["next_round"]
        if state["current_turn"] != player_id:
            return []
        if state.get("pending_tool"):
            return ["resolve_tool"]
        turn = state["turn_state"]
        actions = ["end_turn"]
        if not turn["drafted"] and state["pool"]:
            actions.insert(0, "place_die")
        if not turn["tool_used"] and any(state["players"][player_id]["favor_tokens"] >= (1 if t["uses"] == 0 else 2)
                                          for t in state["tools"]):
            actions.insert(0, "use_tool")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _VALIDATOR.is_valid(action):
            return [], "invalid Sagrada action"
        if "revision" in action and action["revision"] != state["revision"]:
            return [], "game changed; choose your action again"
        candidate = copy.deepcopy(state)
        try:
            events = _apply(candidate, player_id, action)
        except (ValueError, KeyError, TypeError, IndexError) as error:
            return [], str(error)
        candidate["revision"] += 1
        state.clear()
        state.update(candidate)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, player_id: Optional[str]) -> Dict:
        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            private = pid == player_id or state["game_over"]
            scores = _score_player(state, pid)
            visible = {key: copy.deepcopy(player[key]) for key in ("player_id", "name", "seat", "is_bot", "pattern_id", "pattern_name", "favor_tokens", "grid")}
            visible.update(private_color=player["private_color"] if private else None,
                           private_score=scores["private_score"] if private else None,
                           score_preview=scores["score"] if private else scores["score"] - scores["private_score"],
                           objective_score=scores["objective_score"], public_score=scores["public_score"],
                           objective_scores=scores["objective_scores"], empty_penalty=scores["empty_penalty"],
                           ready=pid in state["ready"])
            if state["game_over"]:
                visible["score"] = scores["score"]
            players.append(visible)
        patterns = []
        if player_id in state["players"] and not state["players"][player_id]["pattern_id"]:
            patterns = [copy.deepcopy(PATTERNS_BY_ID[pattern_id]) for pattern_id in state["players"][player_id]["pattern_choices"]]
        tools = [{**json.loads(json.dumps(TOOLS_BY_ID[tool["id"]])), **copy.deepcopy(tool), "cost": 1 if tool["uses"] == 0 else 2} for tool in state["tools"]]
        return {"you": player_id, "revision": state["revision"], "phase": state["phase"], "round": state["round"],
                "total_rounds": TOTAL_ROUNDS, "players": players, "patterns": patterns,
                "pool": copy.deepcopy(state["pool"]), "round_track": copy.deepcopy(state["round_track"]),
                "current_turn": state["current_turn"], "current_turn_state": dict(state["turn_state"]),
                "draft_order": list(state["draft_order"]), "draft_index": state["draft_index"],
                "legal_actions": SagradaGame.get_legal_actions(state, player_id), "tools": tools,
                "objectives": copy.deepcopy(state["objectives"]), "bag_count": len(state["bag"]),
                "pending_tool": copy.deepcopy(state["pending_tool"]), "ready": list(state["ready"]),
                "round_summary": copy.deepcopy(state["round_summary"]), "log": copy.deepcopy(state["log"]),
                "game_over": state["game_over"], "winner": list(state["winner"]), "ranking": list(state["ranking"])}

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        legal = SagradaGame.get_legal_actions(state, player_id)
        if not legal:
            return None
        def action(kind: str, **fields) -> Dict:
            return {"type": kind, "revision": state["revision"], **fields, "delay_ms": 250}
        player = state["players"][player_id]
        if "choose_pattern" in legal:
            choice = min(player["pattern_choices"], key=lambda pattern_id: PATTERNS_BY_ID[pattern_id]["difficulty"])
            return action("choose_pattern", pattern_id=choice)
        if "next_round" in legal:
            return action("next_round")
        if "resolve_tool" in legal:
            pending = state["pending_tool"]
            die = pending["die"]
            values = range(1, 7) if pending["tool_id"] == "flux_remover" else [die["value"]]
            for value in values:
                choices = _placements(player["grid"], dict(die, value=value))
                if choices:
                    row, col = choices[0]
                    return action("resolve_tool", row=row, col=col, **({"value": value} if pending["tool_id"] == "flux_remover" else {}))
            return action("resolve_tool", return_die=True, **({"value": 1} if pending["tool_id"] == "flux_remover" else {}))
        choices = []
        if "place_die" in legal:
            for die in state["pool"]:
                for row, col in _placements(player["grid"], die):
                    preview = copy.deepcopy(player["grid"])
                    preview[row][col]["die"] = die
                    public = sum(_objective_score(preview, objective) for objective in state["objectives"])
                    private = die["value"] if die["color"] == player["private_color"] else 0
                    restricted = bool(preview[row][col]["restriction"])
                    choices.append((public + private + restricted * 2, die["id"], row, col))
        if choices:
            _, die_id, row, col = max(choices)
            return action("place_die", die_id=die_id, row=row, col=col)
        # Tools rescue a blocked draft. Simulate through the exact human action
        # validator; never consume randomness or favors during the search.
        if "use_tool" in legal and not state["turn_state"]["drafted"]:
            for tool in state["tools"]:
                tool_id = tool["id"]
                if tool_id not in ("grozing_pliers", "grinding_stone", "cork_backed_straightedge", "flux_brush", "flux_remover"):
                    continue
                for die in state["pool"]:
                    candidates = []
                    if tool_id in ("flux_brush", "flux_remover"):
                        candidates.append({"die_id": die["id"]})
                    else:
                        for delta in (-1, 1) if tool_id == "grozing_pliers" else (0,):
                            value = die["value"] + delta if tool_id == "grozing_pliers" else 7 - die["value"] if tool_id == "grinding_stone" else die["value"]
                            if 1 <= value <= 6:
                                for row, col in _placements(player["grid"], dict(die, value=value), isolated=tool_id == "cork_backed_straightedge"):
                                    candidates.append({"die_id": die["id"], "row": row, "col": col, **({"delta": delta} if tool_id == "grozing_pliers" else {})})
                    for fields in candidates:
                        candidate = {"type": "use_tool", "revision": state["revision"], "tool_id": tool_id, **fields}
                        if not SagradaGame.apply_action(copy.deepcopy(state), player_id, candidate)[1]:
                            return action("use_tool", tool_id=tool_id, **fields)
        return action("end_turn")

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or not all(key in payload for key in ("players", "bag", "revision", "rng_counter", "phase")):
            raise ValueError("unsupported or invalid Sagrada save")
        return copy.deepcopy(payload)
