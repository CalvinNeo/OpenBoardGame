"""Server-authoritative Cryptid with private clues and public, truthful markers."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.cryptid_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, TILES, TERRAIN_CODES, TERRAINS, ANIMALS,
    STRUCTURES, COLORS, clue_catalog,
)


_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
_ALL_CELLS = (1 << 108) - 1


def hex_distance(a: Dict, b: Dict) -> int:
    """Distance on the flat-top odd-q board; coordinates are zero based."""
    aq, bq = a["col"], b["col"]
    ar = a["row"] - (aq - (aq & 1)) // 2
    br = b["row"] - (bq - (bq & 1)) // 2
    dq, dr = aq - bq, ar - br
    return max(abs(dq), abs(dr), abs(dq + dr))


def evaluate_clue(board: List[Dict], clue: Dict) -> List[str]:
    """Evaluate only public terrain and the supplied single clue."""
    kind, values = clue["kind"], clue["values"]
    targets = []
    for cell in board:
        matches = (
            (kind in ("terrain", "near_terrain") and cell["terrain"] in values)
            or (kind == "animal" and cell.get("animal") in values)
            or (kind == "structure" and (cell.get("structure") or {}).get("type") in values)
            or (kind == "color" and (cell.get("structure") or {}).get("color") in values)
        )
        if matches:
            targets.append(cell)
    return [cell["id"] for cell in board
            if (any(hex_distance(cell, target) <= clue["distance"] for target in targets)
                != clue["negative"])]


def build_board(rng: random.Random, advanced: bool) -> Tuple[List[Dict], List[Dict]]:
    tile_order = list(range(6))
    rng.shuffle(tile_order)
    board, layout = [], []
    for slot, tile_index in enumerate(tile_order):
        flipped = rng.choice((False, True))
        tile = TILES[tile_index]
        layout.append({"tile": tile_index + 1, "rotated": flipped})
        for row in range(3):
            for col in range(6):
                source_col, source_row = (5 - col, 2 - row) if flipped else (col, row)
                animal = next((name for name in ANIMALS if (source_col, source_row) in tile[name]), None)
                c, r = (slot % 2) * 6 + col, (slot // 2) * 3 + row
                board.append({"id": f"{chr(65 + c)}{r + 1}", "col": c, "row": r,
                              "terrain": TERRAIN_CODES[tile["rows"][source_row][source_col]],
                              "animal": animal, "structure": None})
    board.sort(key=lambda cell: (cell["row"], cell["col"]))
    spots = rng.sample(board, 8 if advanced else 6)
    for color in list(COLORS)[:4 if advanced else 3]:
        for kind in STRUCTURES:
            spots.pop()["structure"] = {"type": kind, "color": color}
    return board, layout


def generate_puzzle(rng: random.Random, count: int, advanced: bool) -> Dict:
    """Bounded independent generator; every clue contributes to a unique answer."""
    catalog = clue_catalog(advanced)
    for _ in range(100):
        board, layout = build_board(rng, advanced)
        indexes = {cell["id"]: i for i, cell in enumerate(board)}
        masks = {}
        for clue in catalog:
            mask = sum(1 << indexes[cell] for cell in evaluate_clue(board, clue))
            if 2 <= bin(mask).count("1") <= 108 - 2 * count:
                masks[clue["id"]] = mask
        clues_by_cell = [[clue for clue in catalog if masks.get(clue["id"], 0) & (1 << i)]
                         for i in range(108)]
        for _ in range(2400):
            target_index = rng.randrange(108)
            options = clues_by_cell[target_index]
            if len(options) < count:
                continue
            chosen = rng.sample(options, count)
            selected = [masks[clue["id"]] for clue in chosen]
            intersection = _ALL_CELLS
            for mask in selected:
                intersection &= mask
            if not intersection or intersection & (intersection - 1):
                continue
            essential = True
            for skip in range(count):
                partial = _ALL_CELLS
                for index, mask in enumerate(selected):
                    if index != skip:
                        partial &= mask
                if not partial or not partial & (partial - 1):
                    essential = False
                    break
            if essential:
                matches = [evaluate_clue(board, clue) for clue in chosen]
                common = set.intersection(*(set(values) for values in matches))
                if len(common) != 1:
                    raise ValueError("Cryptid puzzle validation failed")
                return {"board": board, "layout": layout, "clues": chosen,
                        "matches": matches, "solution": common.pop()}
    raise ValueError("Could not prepare a unique Cryptid puzzle. Please try again.")


def _name(state: Dict, pid: str) -> str:
    return state["players"][pid]["name"]


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    state["log"] = state["log"][-150:]
    state["round_notes"].append(message)


def _allowed_cells(state: Dict, pid: str, positive: bool) -> List[str]:
    own = set(state["matches"][pid])
    return [cell["id"] for cell in state["board"]
            if (cell["id"] in own) == positive
            and not state["markers"][cell["id"]]["cube"]
            and pid not in state["markers"][cell["id"]]["discs"]]


def _mark(state: Dict, cell: str, pid: str, positive: bool) -> None:
    if positive:
        state["markers"][cell]["discs"].append(pid)
    else:
        state["markers"][cell]["cube"] = pid
    _log(state, f"{_name(state, pid)} 在 {cell} 放置{'可能(●)' if positive else '排除(■)'}。")


def _review(state: Dict, resume: str) -> None:
    state["phase"] = "round_end"
    state["resume_phase"] = resume
    state["current_turn"] = None
    state["next_ready"] = []
    state["last_round"] = list(state["round_notes"])


def _end_turn(state: Dict) -> None:
    state["pending_search"] = None
    state["turn_index"] += 1
    if state["turn_index"] == len(state["turn_order"]):
        _review(state, "turn")
    else:
        state["phase"] = "turn"
        state["current_turn"] = state["turn_order"][state["turn_index"]]


def _compensate(state: Dict) -> None:
    pid = state["turn_order"][state["turn_index"]]
    state["phase"] = "compensate_cube"
    state["current_turn"] = pid
    if not _allowed_cells(state, pid, False):
        _log(state, f"{_name(state, pid)} 已无合法新方块位置，本次补偿免除（线上约定）。")
        _end_turn(state)


def _resolve_search(state: Dict) -> None:
    search = state["pending_search"]
    actor, cell = search["actor"], search["cell_id"]
    order = state["turn_order"]
    start = order.index(actor)
    results = [{"player_id": actor, "positive": True, "already_present": search["already_present"]}]
    for offset in range(1, len(order)):
        pid = order[(start + offset) % len(order)]
        if pid in state["markers"][cell]["discs"]:
            results.append({"player_id": pid, "positive": True, "already_present": True})
            continue
        positive = cell in state["matches"][pid]
        _mark(state, cell, pid, positive)
        results.append({"player_id": pid, "positive": positive, "already_present": False})
        if not positive:
            state["last_action"] = {"type": "search", "actor": actor, "cell_id": cell,
                                    "results": results, "success": False}
            _log(state, "搜索停止；搜索者需另放一个排除(■)，之后仍继续参与。")
            _compensate(state)
            return
    state["last_action"] = {"type": "search", "actor": actor, "cell_id": cell,
                            "results": results, "success": True}
    state["winner"] = [actor]
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None
    state["pending_search"] = None
    _log(state, f"🏆 {_name(state, actor)} 在 {cell} 找到神秘生物！")


def _hint_for(clues: List[Dict]) -> Optional[str]:
    labels = {"terrain": "两种地形", "near_terrain": "1 格内指定地形", "animal": "动物领地",
              "structure": "结构物类型", "color": "结构物颜色"}
    used = {clue["kind"] for clue in clues}
    for kind, label in labels.items():
        if kind not in used:
            return f"本局没有涉及「{label}」的线索（包括其否定）。"
    return None


class CryptidGame:
    game_id = "cryptid"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Invalid Cryptid configuration")
        if not 3 <= len(players) <= 5:
            raise ValueError("Cryptid requires 3–5 players")
        ids = [player.get("player_id") for player in players]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("Player IDs must be unique nonempty strings")
        seed = config.get("seed", secrets.token_hex(24))
        rng = random.Random(seed)
        advanced = config.get("advanced", False)
        puzzle = generate_puzzle(rng, len(players), advanced)
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        start = rng.randrange(len(ids))
        order = ids[start:] + ids[:start]
        state = {
            "game_id": "cryptid", "version": 1, "game_instance_id": secrets.token_hex(12),
            "config": {"advanced": advanced}, "seed": seed,
            "board": puzzle["board"], "layout": puzzle["layout"],
            "map_source": "Transcribed terrain · Generated puzzle",
            "solution": puzzle["solution"], "clues": {}, "matches": {},
            "players": {}, "turn_order": order, "turn_index": 0,
            "phase": "initial_clues", "current_turn": order[0], "initial_pass": 1,
            "round": 0, "resume_phase": None, "next_ready": [], "last_round": [],
            "round_notes": [], "log": [], "last_action": None, "pending_search": None,
            "markers": {cell["id"]: {"cube": None, "discs": []} for cell in puzzle["board"]},
            "hint_text": _hint_for(puzzle["clues"]), "hint_revealed": False, "hint_votes": {},
            "notes": {}, "winner": [], "game_over": False,
        }
        for i, player in enumerate(ordered):
            pid = player["player_id"]
            state["players"][pid] = {"name": str(player.get("name") or pid), "seat": i,
                                       "is_bot": bool(player.get("is_bot", False))}
            state["clues"][pid] = puzzle["clues"][i]
            state["matches"][pid] = puzzle["matches"][i]
            state["notes"][pid] = {"text": "", "cells": {}, "clues": {}}
        _log(state, "每人依次放置一个排除(■)，共两圈。")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        actions = [] if state["players"][player_id]["is_bot"] else ["update_notes"]
        if state["game_over"]:
            return []
        phase = state["phase"]
        human_requested_hint = any(agree and not state["players"][pid]["is_bot"]
                                   for pid, agree in state["hint_votes"].items())
        can_vote = "update_notes" in actions or (human_requested_hint and player_id not in state["hint_votes"])
        if can_vote and phase in ("turn", "round_end") and state["initial_pass"] == 3 and not state["hint_revealed"]:
            actions.append("vote_hint")
        if phase == "round_end":
            if player_id not in state["next_ready"]:
                actions.append("next_round")
            return actions
        if state["current_turn"] != player_id:
            return actions
        actions.extend({"initial_clues": ["place_initial_cube"], "turn": ["question", "search"],
                        "search_extra_disc": ["place_extra_disc"],
                        "compensate_cube": ["place_compensation_cube"]}.get(phase, []))
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid Cryptid action"
        kind = action["type"]
        if kind == "next_round" and state["phase"] == "round_end" and player_id in state["next_ready"]:
            return [], None
        if kind not in CryptidGame.get_legal_actions(state, player_id):
            return [], "This action is not available now"
        cell = action.get("cell_id")
        if cell is not None:
            if cell not in state["markers"] or state["markers"][cell]["cube"]:
                return [], "This space is blocked or unknown"
            if kind in ("place_initial_cube", "place_compensation_cube", "place_extra_disc"):
                if cell not in _allowed_cells(state, player_id, kind == "place_extra_disc"):
                    return [], "Choose a new space matching your clue and marker"
            if kind == "search" and cell not in state["matches"][player_id]:
                return [], "Search a space that matches your own clue"
            if kind == "question":
                target = action["target_player_id"]
                if target not in state["players"] or target == player_id or target in state["markers"][cell]["discs"]:
                    return [], "Choose another player who has not answered this space"
        if kind == "update_notes":
            notes = action["notes"]
            catalog_ids = {clue["id"] for clue in clue_catalog(state["config"]["advanced"])}
            if any(pid not in state["players"] or not set(clues) <= catalog_ids
                   for pid, clues in notes["clues"].items()):
                return [], "Invalid notebook entry"
            state["notes"][player_id] = copy.deepcopy(notes)
        elif kind == "vote_hint":
            state["hint_votes"][player_id] = action["agree"]
            required = 3 if len(state["players"]) == 3 else len(state["players"]) - 1
            if sum(state["hint_votes"].values()) >= required:
                state["hint_revealed"] = True
                if not state["hint_text"]:
                    state["hint_text"] = "本局没有可用的额外类别提示。"
                _log(state, f"💡 {state['hint_text']}")
        elif kind == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["players"]):
                state["phase"] = state["resume_phase"]
                state["resume_phase"] = None
                state["turn_index"] = 0
                state["current_turn"] = state["turn_order"][0]
                state["next_ready"] = []
                state["round_notes"] = []
                if state["phase"] == "turn":
                    state["round"] += 1
                _log(state, f"第 {state['round']} 轮开始。" if state["phase"] == "turn" else "第二圈开局方块。")
        elif kind == "place_initial_cube":
            _mark(state, cell, player_id, False)
            state["turn_index"] += 1
            if state["turn_index"] == len(state["turn_order"]):
                state["initial_pass"] += 1
                _review(state, "initial_clues" if state["initial_pass"] == 2 else "turn")
            else:
                state["current_turn"] = state["turn_order"][state["turn_index"]]
        elif kind == "question":
            target = action["target_player_id"]
            _log(state, f"❓ {_name(state, player_id)} 询问 {_name(state, target)}：{cell}？")
            positive = cell in state["matches"][target]
            _mark(state, cell, target, positive)
            state["last_action"] = {"type": "question", "actor": player_id, "cell_id": cell,
                                    "results": [{"player_id": target, "positive": positive}], "success": positive}
            _end_turn(state) if positive else _compensate(state)
        elif kind == "search":
            state["pending_search"] = {"actor": player_id, "cell_id": cell,
                                       "already_present": player_id in state["markers"][cell]["discs"]}
            _log(state, f"🔍 {_name(state, player_id)} 搜索 {cell}。")
            if player_id in state["markers"][cell]["discs"]:
                if _allowed_cells(state, player_id, True):
                    state["phase"] = "search_extra_disc"
                else:
                    _log(state, "已无合法新圆片位置，免除本次额外圆片（线上约定）。")
                    _resolve_search(state)
            else:
                _mark(state, cell, player_id, True)
                _resolve_search(state)
        elif kind == "place_extra_disc":
            _mark(state, cell, player_id, True)
            _resolve_search(state)
        elif kind == "place_compensation_cube":
            _mark(state, cell, player_id, False)
            _end_turn(state)
        # No private values, note text, or internal clue objects in shared events.
        return [{"type": "cryptid:update", "payload": {"actor": player_id, "action": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = viewer_id in state["players"]
        legal = CryptidGame.get_legal_actions(state, viewer_id)
        view = {
            "game_id": "cryptid", "game_instance_id": state["game_instance_id"], "you": viewer_id,
            "advanced": state["config"]["advanced"], "board": copy.deepcopy(state["board"]),
            "map_source": state["map_source"], "players": [
                {"player_id": pid, **state["players"][pid]} for pid in state["turn_order"]],
            "turn_order": list(state["turn_order"]), "current_turn": state["current_turn"],
            "phase": state["phase"], "round": state["round"], "initial_pass": state["initial_pass"],
            "markers": copy.deepcopy(state["markers"]), "last_action": copy.deepcopy(state["last_action"]),
            "pending_search": copy.deepcopy(state["pending_search"]),
            "next_ready": list(state["next_ready"]), "last_round": list(state["last_round"]),
            "log": list(state["log"]), "winner": list(state["winner"]), "game_over": state["game_over"],
            "legal_actions": legal, "catalog": clue_catalog(state["config"]["advanced"]),
            "terrain_defs": copy.deepcopy(TERRAINS), "animal_defs": copy.deepcopy(ANIMALS),
            "structure_defs": copy.deepcopy(STRUCTURES), "color_names": dict(COLORS),
            "hint_available": not state["hint_revealed"], "hint_votes": dict(state["hint_votes"]),
            "hint": state["hint_text"] if state["hint_revealed"] else None,
            "my_clue": copy.deepcopy(state["clues"][viewer_id]) if own else None,
            "my_matches": list(state["matches"][viewer_id]) if own else [],
            "notes": copy.deepcopy(state["notes"][viewer_id]) if own else None,
            "placement_cells": [], "search_cells": [],
        }
        if "place_initial_cube" in legal or "place_compensation_cube" in legal:
            view["placement_cells"] = _allowed_cells(state, viewer_id, False)
        if "place_extra_disc" in legal:
            view["placement_cells"] = _allowed_cells(state, viewer_id, True)
        if "search" in legal:
            view["search_cells"] = [cell for cell in state["matches"][viewer_id] if not state["markers"][cell]["cube"]]
        if state["game_over"]:
            view["solution"] = state["solution"]
            view["revealed_clues"] = copy.deepcopy(state["clues"])
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return bot_from_view(CryptidGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        if not isinstance(state, dict) or state.get("version") != 1 or state.get("game_id") != "cryptid":
            raise ValueError("Unsupported Cryptid save")
        try:
            ids = set(state["players"])
            cells = {f"{chr(65 + c)}{r + 1}" for c in range(12) for r in range(9)}
            if len(state["board"]) != 108 or {cell["id"] for cell in state["board"]} != cells:
                raise ValueError("Invalid saved map")
            if not 3 <= len(ids) <= 5 or set(state["turn_order"]) != ids or set(state["clues"]) != ids:
                raise ValueError("Invalid saved players")
            catalog = {clue["id"]: clue for clue in clue_catalog(state["config"]["advanced"])}
            for pid, clue in state["clues"].items():
                if catalog.get(clue["id"]) != clue or evaluate_clue(state["board"], clue) != state["matches"][pid]:
                    raise ValueError("Invalid saved clue")
            common = set.intersection(*(set(state["matches"][pid]) for pid in ids))
            if common != {state["solution"]} or set(state["markers"]) != cells:
                raise ValueError("Invalid saved solution")
            for cell, markers in state["markers"].items():
                cube, discs = markers["cube"], markers["discs"]
                if len(set(discs)) != len(discs) or not set(discs) <= ids:
                    raise ValueError("Invalid saved markers")
                if cube is not None and (cube not in ids or cell in state["matches"][cube] or cube in discs):
                    raise ValueError("Invalid saved cube")
                if any(cell not in state["matches"][pid] for pid in discs):
                    raise ValueError("Invalid saved disc")
            if state["phase"] not in ("initial_clues", "turn", "search_extra_disc", "compensate_cube", "round_end", "game_over"):
                raise ValueError("Invalid saved phase")
            if state["phase"] == "search_extra_disc" and not state["pending_search"]:
                raise ValueError("Missing saved search")
            if len(set(state["next_ready"])) != len(state["next_ready"]) or not set(state["next_ready"]) <= ids:
                raise ValueError("Invalid saved acknowledgements")
            phase, index = state["phase"], state["turn_index"]
            if type(index) is not int or not 0 <= index <= len(ids):
                raise ValueError("Invalid saved turn index")
            if phase in ("initial_clues", "turn", "search_extra_disc", "compensate_cube"):
                if index >= len(ids) or state["current_turn"] != state["turn_order"][index]:
                    raise ValueError("Invalid saved active player")
            elif state["current_turn"] is not None:
                raise ValueError("Unexpected saved active player")
            if phase == "round_end" and state["resume_phase"] not in ("initial_clues", "turn"):
                raise ValueError("Invalid saved review continuation")
            if bool(state["game_over"]) != (phase == "game_over"):
                raise ValueError("Invalid saved game result")
            if state["game_over"] and (len(state["winner"]) != 1 or not set(state["winner"]) <= ids):
                raise ValueError("Invalid saved winner")
            if set(state["notes"]) != ids or any(not _ACTION_VALIDATOR.is_valid({"type": "update_notes", "notes": note}) for note in state["notes"].values()):
                raise ValueError("Invalid saved notes")
        except (KeyError, TypeError, IndexError) as error:
            raise ValueError("Invalid Cryptid save") from error
        return state


def bot_from_view(view: Dict) -> Optional[Dict]:
    """Bot decisions depend exclusively on a human-equivalent private view."""
    legal, pid = view["legal_actions"], view["you"]
    if "vote_hint" in legal and any(view["hint_votes"].values()):
        return {"type": "vote_hint", "agree": True}
    if "next_round" in legal:
        return {"type": "next_round"}
    placements = view["placement_cells"]
    if placements:
        kind = next(kind for kind in ("place_initial_cube", "place_compensation_cube", "place_extra_disc") if kind in legal)
        positive = kind == "place_extra_disc"
        own_markers = [cell for cell in view["board"] if
                       (pid in view["markers"][cell["id"]]["discs"] if positive else view["markers"][cell["id"]]["cube"] == pid)]
        # Nearby public disclosures often reveal less than a different region.
        best = min((cell for cell in view["board"] if cell["id"] in placements),
                   key=lambda cell: (min((hex_distance(cell, other) for other in own_markers), default=0), cell["id"]))
        return {"type": kind, "cell_id": best["id"]}
    if "search" not in legal:
        return None
    masks = {clue["id"]: set(evaluate_clue(view["board"], clue)) for clue in view["catalog"]}
    beliefs = {}
    for other in view["turn_order"]:
        if other == pid:
            continue
        yes = {cell for cell, markers in view["markers"].items() if other in markers["discs"]}
        no = {cell for cell, markers in view["markers"].items() if markers["cube"] == other}
        beliefs[other] = [mask for clue_id, mask in masks.items()
                          if clue_id != view["my_clue"]["id"] and yes <= mask and not no & mask]
    def probability(cell: str, other: str) -> float:
        candidates = beliefs[other]
        return sum(cell in mask for mask in candidates) / len(candidates) if candidates else 0.5
    def score(cell: str) -> float:
        result = 1.0
        for other in beliefs:
            result *= probability(cell, other)
        return result
    candidates = view["search_cells"]
    if not candidates:
        return None
    best = max(candidates, key=lambda cell: (score(cell), cell))
    # Every search either reveals a new exclusion or wins, ensuring real progress.
    # Alternate low-confidence searches with informative, previously unanswered questions.
    if score(best) < 0.35 and view["round"] % 2 == 1:
        questions = [(cell, other) for cell in candidates for other in beliefs
                     if other not in view["markers"][cell]["discs"] and 0 < probability(cell, other) < 1]
        if questions:
            cell, other = min(questions, key=lambda pair: (abs(probability(*pair) - 0.5), pair))
            return {"type": "question", "cell_id": cell, "target_player_id": other}
    return {"type": "search", "cell_id": best}
