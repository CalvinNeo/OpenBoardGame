import copy
import itertools
import json
import math
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple


CATALOG = json.loads((Path(__file__).parent / "assets" / "town77" / "catalog.json").read_text(encoding="utf-8"))
SIZE = 7
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["place", "exchange", "discard", "keep", "pass", "acknowledge"]},
        "tile": {"type": "integer", "minimum": 0, "maximum": 48},
        "x": {"type": "integer", "minimum": 0, "maximum": 6},
        "y": {"type": "integer", "minimum": 0, "maximum": 6},
        "tiles": {"type": "array", "minItems": 3, "maxItems": 3, "uniqueItems": True,
                  "items": {"type": "integer", "minimum": 0, "maximum": 48}},
    },
    "required": ["type"], "additionalProperties": False,
}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}


def available_cells(board: List[List[Optional[int]]]) -> List[Tuple[int, int]]:
    if not any(tile is not None for row in board for tile in row):
        return [(0, 0)]
    return [(column, row) for row in range(SIZE) for column in range(SIZE)
            if board[row][column] is None and any(
                0 <= column + delta_x < SIZE and 0 <= row + delta_y < SIZE
                and board[row + delta_y][column + delta_x] is not None
                for delta_x, delta_y in ((0, 1), (1, 0), (0, -1), (-1, 0)))]


def legal_placements(board: List[List[Optional[int]]], tiles: List[int]) -> List[Dict]:
    moves = []
    for column, row in available_cells(board):
        neighbors = [tile for tile in board[row] + [line[column] for line in board] if tile is not None]
        colors = {tile // SIZE for tile in neighbors}
        shapes = {tile % SIZE for tile in neighbors}
        for tile in tiles:
            if tile // SIZE not in colors and tile % SIZE not in shapes:
                moves.append({"type": "place", "tile": tile, "x": column, "y": row})
    return moves


def exchange_groups(hand: List[int]) -> List[List[int]]:
    return [list(group) for group in itertools.combinations(sorted(hand), 3)
            if len({tile // SIZE for tile in group}) == 1 or len({tile % SIZE for tile in group}) == 1]


def _tiles(state: Dict, player_id: str) -> List[int]:
    if state["solo"]:
        return [pile[-1] for pile in state["piles"] if pile]
    return state["players"][player_id]["hand"]


def _finish(state: Dict) -> None:
    state["phase"] = "final_review"
    if state["solo"]:
        state["players"][state["turn_order"][0]]["retired"] = True
    state["current_turn"] = None
    state["ranking"] = sorted(state["turn_order"], key=lambda player_id: (
        len(state["players"][player_id]["hand"]), -state["players"][player_id]["finished_at"]))
    state["winner"] = state["ranking"][:1]


def _advance(state: Dict) -> None:
    current = state["current_turn"]
    player = state["players"][current]
    if not player["hand"] and not state["solo"]:
        player["retired"] = True
        player["finished_at"] = state["turn_number"]
    if state["solo"]:
        if not legal_placements(state["board"], _tiles(state, current)):
            _finish(state)
            return
    elif all(item["retired"] for item in state["players"].values()):
        _finish(state)
        return
    start = state["turn_order"].index(current)
    for offset in range(1, len(state["turn_order"]) + 1):
        candidate = state["turn_order"][(start + offset) % len(state["turn_order"])]
        if not state["players"][candidate]["retired"]:
            state["current_turn"] = candidate
            break
    state["turn_number"] += 1
    state["phase"] = "place"


def _mobility(board: List[List[Optional[int]]], tiles: List[int]) -> float:
    moves = legal_placements(board, tiles)
    counts = {tile: 0 for tile in tiles}
    for move in moves:
        counts[move["tile"]] += 1
    return sum(2.5 + math.log1p(count) if count else -7 for count in counts.values())


def choose_move(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    if "acknowledge" in legal:
        return {"type": "acknowledge"}
    hand = view["hand"]
    board = view["board"]
    if "keep" in legal:
        best_tile = max(hand, key=lambda tile: _mobility(board, [item for item in hand if item != tile]))
        remaining = [tile for tile in hand if tile != best_tile]
        moves = legal_placements(board, remaining)
        active_counts = [player["remaining"] for player in view["players"]
                         if player["player_id"] != view["you"] and not player["retired"]]
        filled = sum(tile is not None for row in board for tile in row)
        urgency = filled / 49 + (0.35 if active_counts and min(active_counts) < len(hand) else 0)
        dead = len({move["tile"] for move in legal_placements(board, hand)}) < len(hand)
        if remaining and (dead or urgency > 0.42 or filled >= 12 and len(moves) < 3 * len(hand)):
            return {"type": "discard", "tile": best_tile}
        return {"type": "keep"}
    moves = view["legal_placements"]
    if "exchange" in legal:
        playable = {move["tile"] for move in moves}
        group = max(view["exchange_groups"], key=lambda group: sum(tile not in playable for tile in group))
        previous = [entry for entry in view["history"] if entry["type"] == "exchange"
                    and entry["player_id"] == view["you"] and entry["turn"] == view["turn_number"]]
        repeated = any(sorted(entry["tiles"]) == group for entry in previous)
        if sum(tile not in playable for tile in group) >= 2 and len(previous) < 3 and not repeated:
            return {"type": "exchange", "tiles": group}
    if not moves:
        return {"type": "pass"}
    opponents = [player for player in view["players"] if player["player_id"] != view["you"] and not player["retired"]]
    public_tiles = {tile for row in board for tile in row if tile is not None} | set(hand)
    unknown = [tile for tile in range(49) if tile not in public_tiles]
    scored = []
    for move in moves:
        trial = [list(row) for row in board]
        trial[move["y"]][move["x"]] = move["tile"]
        remaining = [tile for tile in hand if tile != move["tile"]]
        mobility = _mobility(trial, remaining)
        future = legal_placements(trial, unknown)
        by_color = [0] * SIZE
        for option in future:
            by_color[option["tile"] // SIZE] += 1
        pressure = sum(by_color[color] for player in opponents for color in player["colors"])
        score = mobility - pressure * 0.035 + len(future) * (0.012 if view["solo"] else 0.002)
        scored.append((score, move, trial, remaining))
    scored.sort(key=lambda entry: entry[0], reverse=True)
    for index, (score, move, trial, remaining) in enumerate(scored[:10]):
        followups = legal_placements(trial, remaining)
        continuation = -10 if remaining and not followups else 0
        for followup in followups:
            trial[followup["y"]][followup["x"]] = followup["tile"]
            continuation = max(continuation, _mobility(trial, [tile for tile in remaining if tile != followup["tile"]]))
            trial[followup["y"]][followup["x"]] = None
        scored[index] = (score + continuation * 0.45, move, trial, remaining)
    return max(scored[:10], key=lambda entry: entry[0])[1]


class Town77Game:
    game_id = "town77"
    min_players = 1
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = dict(config or {})
        if not 1 <= len(players) <= 5 or set(config) - {"seed"} or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("Town 77 requires 1–5 players and an optional integer seed")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        order = [player["player_id"] for player in ordered]
        if len(set(order)) != len(order):
            raise ValueError("duplicate player")
        seed = config.get("seed", random.SystemRandom().randrange(2**63))
        tiles = list(range(49))
        random.Random(seed).shuffle(tiles)
        state = {
            "config": dict(config), "seed": seed, "shuffle_number": 0, "solo": len(order) == 1,
            "turn_order": order, "current_turn": order[0], "turn_number": 1,
            "phase": "place", "board": [[None] * SIZE for _ in range(SIZE)],
            "players": {player["player_id"]: {"name": player.get("name", player["player_id"]),
                        "hand": [], "retired": False, "finished_at": 0, "placed": 0} for player in ordered},
            "bag": [], "piles": [], "history": [], "game_over": False,
            "winner": [], "ranking": [], "acknowledged": [], "results_ready": False,
        }
        if state["solo"]:
            state["piles"] = [tiles[::3], tiles[1::3], tiles[2::3]]
        else:
            state["board"][0][0] = tiles.pop()
            for player in state["players"].values():
                player["hand"] = [tiles.pop() for _ in range(4)]
            state["bag"] = tiles
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        if state["game_over"]:
            return []
        if state["phase"] == "final_review":
            return [] if player_id in state["acknowledged"] else ["acknowledge"]
        if state["current_turn"] != player_id:
            return []
        if state["phase"] == "discard":
            return ["keep", "discard"]
        actions = ["place"] if legal_placements(state["board"], _tiles(state, player_id)) else ["pass"]
        if not state["solo"] and exchange_groups(state["players"][player_id]["hand"]):
            actions.append("exchange")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or action.get("type") not in Town77Game.get_legal_actions(state, player_id):
            return [], "action not available"
        action_type = action["type"]
        turn_number = state["turn_number"]
        fields = {"place": {"type", "tile", "x", "y"}, "exchange": {"type", "tiles"},
                  "discard": {"type", "tile"}, "keep": {"type"}, "pass": {"type"}, "acknowledge": {"type"}}
        if set(action) != fields[action_type]:
            return [], "invalid action fields"
        if any(type(action[key]) is not int for key in ("tile", "x", "y") if key in action):
            return [], "tile and coordinates must be integers"
        player = state["players"][player_id]
        if action_type == "place":
            if action not in legal_placements(state["board"], _tiles(state, player_id)):
                return [], "choose an adjacent empty square without repeated row or column colors or shapes"
            state["board"][action["y"]][action["x"]] = action["tile"]
            player["placed"] += 1
            if state["solo"]:
                next(pile for pile in state["piles"] if pile and pile[-1] == action["tile"]).pop()
                _advance(state)
            else:
                player["hand"].remove(action["tile"])
                if player["hand"] and state["bag"]:
                    player["hand"].append(state["bag"].pop())
                    state["phase"] = "discard"
                else:
                    _advance(state)
        elif action_type == "exchange":
            group = action["tiles"]
            if not isinstance(group, list) or any(type(tile) is not int for tile in group) or sorted(group) not in exchange_groups(player["hand"]):
                return [], "exchange exactly three tiles of the same color or shape"
            for tile in group:
                player["hand"].remove(tile)
            state["bag"].extend(group)
            state["shuffle_number"] += 1
            random.Random(f"{state['seed']}:exchange:{state['shuffle_number']}").shuffle(state["bag"])
            player["hand"].extend(state["bag"].pop() for _ in range(3))
        elif action_type == "discard":
            if action["tile"] not in player["hand"]:
                return [], "tile is not in your hand"
            player["hand"].remove(action["tile"])
            state["bag"].append(action["tile"])
            state["shuffle_number"] += 1
            random.Random(f"{state['seed']}:discard:{state['shuffle_number']}").shuffle(state["bag"])
            _advance(state)
        elif action_type == "keep":
            _advance(state)
        elif action_type == "pass":
            player["retired"] = True
            player["finished_at"] = state["turn_number"]
            _advance(state)
        else:
            state["acknowledged"].append(player_id)
            state["results_ready"] = len(state["acknowledged"]) == len(state["players"])
            if state["results_ready"]:
                state["game_over"] = True
                state["phase"] = "game_over"
        if action_type != "acknowledge":
            entry = {"type": action_type, "player_id": player_id, "turn": turn_number}
            if action_type == "place":
                entry.update(action)
            if action_type == "exchange":
                entry["tiles"] = list(action["tiles"])
            state["history"].append(entry)
        return [{"type": f"town77:{action_type}", "player_id": player_id}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        legal = Town77Game.get_legal_actions(state, viewer_id)
        hand = list(_tiles(state, viewer_id)) if viewer_id in state["players"] else []
        return {
            "game_id": "town77", "you": viewer_id, "solo": state["solo"], "phase": state["phase"],
            "current_turn": state["current_turn"], "turn_number": state["turn_number"],
            "board": copy.deepcopy(state["board"]), "hand": hand, "catalog": copy.deepcopy(CATALOG),
            "bag_count": len(state["bag"]),
            "piles": [{"top": pile[-1] if pile else None, "count": len(pile)} for pile in state["piles"]],
            "players": [{"player_id": player_id, "name": player["name"], "remaining": len(player["hand"]),
                         "colors": sorted(tile // SIZE for tile in player["hand"]), "retired": player["retired"],
                         "placed": player["placed"], "finished_at": player["finished_at"],
                         "hand": list(player["hand"]) if player_id == viewer_id or state["phase"] in ("final_review", "game_over") else None}
                        for player_id, player in state["players"].items()],
            "legal_actions": legal,
            "legal_placements": legal_placements(state["board"], hand) if "place" in legal else [],
            "exchange_groups": exchange_groups(hand) if "exchange" in legal else [],
            "history": copy.deepcopy(state["history"]), "game_over": state["game_over"],
            "winner": list(state["winner"]), "ranking": list(state["ranking"]),
            "acknowledged": list(state["acknowledged"]), "results_ready": state["results_ready"],
            "score": sum(tile is not None for row in state["board"] for tile in row),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return choose_move(Town77Game.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
