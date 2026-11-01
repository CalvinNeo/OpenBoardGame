import copy
import random
from collections import Counter
from typing import Dict, Iterator, List, Optional, Tuple


Coord = Tuple[int, int]
COLORS = ("red", "yellow", "green", "blue", "purple")
WILD = "wild"
DIRECTIONS = ((1, 0), (0, 1), (-1, 0), (0, -1))
ROTATIONS = (0, 90, 180, 270)
TILES = {
    f"tile_{left}_{middle}_{right}": (left, middle, right)
    for left_index, left in enumerate(COLORS)
    for middle in COLORS
    for right in COLORS[left_index:]
}
TILES.update({
    f"chameleon_{index}": (color, WILD, COLORS[(index + 1) % len(COLORS)])
    for index, color in enumerate(COLORS)
})
CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}
ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "properties": {
                "type": {"const": "place"},
                "tile_id": {"type": "string", "enum": list(TILES)},
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "rotation": {"type": "integer", "enum": list(ROTATIONS)},
            },
            "required": ["type", "tile_id", "x", "y", "rotation"],
            "additionalProperties": False,
        },
        {
            "properties": {"type": {"enum": ["draw", "keep", "pass"]}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}


def cell_key(x: int, y: int) -> str:
    return f"{x},{y}"


def tile_cells(tile_id: str, x: int, y: int, rotation: int) -> List[Tuple[int, int, str]]:
    delta_x, delta_y = DIRECTIONS[rotation // 90]
    return [
        (x + (index - 1) * delta_x, y + (index - 1) * delta_y, color)
        for index, color in enumerate(TILES[tile_id])
    ]


def board_colors(state: Dict) -> Dict[Coord, str]:
    return {
        tuple(int(value) for value in key.split(",")): cell["color"]
        for key, cell in state["board"].items()
    }


def _geometry(board: Dict[Coord, str], x: int, y: int, rotation: int) -> Tuple[List[Tuple[int, str]], Optional[str]]:
    delta_x, delta_y = DIRECTIONS[rotation // 90]
    cells = [(x + offset * delta_x, y + offset * delta_y) for offset in (-1, 0, 1)]
    if any(cell in board for cell in cells):
        return [], "Tiles cannot overlap."
    contacts = []
    for index, (cell_x, cell_y) in enumerate(cells):
        for step_x, step_y in DIRECTIONS:
            neighbor = (cell_x + step_x, cell_y + step_y)
            if neighbor in board:
                contacts.append((index, board[neighbor]))
    if len(contacts) < 2:
        return contacts, "At least two matching edge contacts are required."
    return contacts, None


def _colors_match(colors: Tuple[str, ...], contacts: List[Tuple[int, str]]) -> bool:
    return all(colors[index] == other or WILD in (colors[index], other) for index, other in contacts)


def placement_error(state: Dict, tile_id: str, x: int, y: int, rotation: int) -> Optional[str]:
    contacts, error = _geometry(board_colors(state), x, y, rotation)
    if error:
        return error
    if not _colors_match(TILES[tile_id], contacts):
        return "Every touching edge must match; extra mismatched contacts are not allowed."
    return None


def _slots(state: Dict) -> Dict[int, List[Tuple[int, int, List[Tuple[int, str]]]]]:
    board = board_colors(state)
    frontier = {
        (cell_x + step_x, cell_y + step_y)
        for cell_x, cell_y in board
        for step_x, step_y in DIRECTIONS
        if (cell_x + step_x, cell_y + step_y) not in board
    }
    result = {}
    for rotation in (0, 90):
        delta_x, delta_y = DIRECTIONS[rotation // 90]
        centers = {
            (cell_x - offset * delta_x, cell_y - offset * delta_y)
            for cell_x, cell_y in frontier
            for offset in (-1, 0, 1)
        }
        candidates = []
        for center_x, center_y in sorted(centers, key=lambda center: (center[1], center[0])):
            contacts, error = _geometry(board, center_x, center_y, rotation)
            if error is None:
                candidates.append((center_x, center_y, contacts))
        result[rotation] = candidates
    return result


def _iter_placements(state: Dict, player_id: str) -> Iterator[Dict]:
    if state["game_over"] or player_id != state["current_turn"]:
        return
    hand = state["players"][player_id]["hand"]
    available = [state["drawn_tile"]] if state["phase"] == "drawn" else hand
    slots = _slots(state)
    for tile_id in available:
        colors = TILES[tile_id]
        if len(hand) == 1 and WILD in colors:
            continue
        for rotation in ROTATIONS:
            if rotation >= 180 and colors == colors[::-1]:
                continue
            oriented = colors if rotation < 180 else colors[::-1]
            for center_x, center_y, contacts in slots[rotation % 180]:
                if _colors_match(oriented, contacts):
                    yield {
                        "type": "place", "tile_id": tile_id,
                        "x": center_x, "y": center_y, "rotation": rotation,
                    }


def legal_placements(state: Dict, player_id: str) -> List[Dict]:
    return list(_iter_placements(state, player_id))


def _public_tile(tile_id: str) -> Dict:
    return {"tile_id": tile_id, "colors": list(TILES[tile_id]), "chameleon": WILD in TILES[tile_id]}


def _put_tile(state: Dict, tile_id: str, x: int, y: int, rotation: int, player_id: Optional[str]) -> None:
    for cell_x, cell_y, color in tile_cells(tile_id, x, y, rotation):
        state["board"][cell_key(cell_x, cell_y)] = {"color": color, "tile_id": tile_id}
    state["placed_tiles"].append({
        "tile_id": tile_id, "x": x, "y": y, "rotation": rotation, "player_id": player_id,
    })


def _record(state: Dict, events: List[Dict], kind: str, player_id: str, **details: object) -> None:
    entry = {"type": kind, "player_id": player_id, "round": state["round"], **details}
    state["history"].append(entry)
    events.append({"type": f"chromino:{kind}", "payload": copy.deepcopy(entry)})


def _finish(state: Dict, events: List[Dict], reason: str) -> None:
    if reason == "blocked":
        remaining = {player_id: len(player["hand"]) for player_id, player in state["players"].items()}
        lowest = min(remaining.values())
        state["winner"] = [player_id for player_id in state["turn_order"] if remaining[player_id] == lowest]
        if len(state["turn_order"]) == 1:
            state["winner"] = []
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None
    state["drawn_tile"] = None
    state["result_reason"] = reason
    events.append({"type": "chromino:game_over", "payload": {"winner": list(state["winner"]), "reason": reason}})


def _end_turn(state: Dict, events: List[Dict], placed: bool, kept_playable: bool = False) -> None:
    player_id = state["current_turn"]
    state["players"][player_id]["turns"] += 1
    state["ply"] += 1
    state["empty_turns"] = 0 if placed or kept_playable else state["empty_turns"] + 1
    state["drawn_tile"] = None
    state["phase"] = "playing"
    turn_index = state["turn_order"].index(player_id)
    if state["finishing_round"] and turn_index == len(state["turn_order"]) - 1:
        _finish(state, events, "empty_hand")
    elif not state["bag"] and state["empty_turns"] >= len(state["turn_order"]):
        _finish(state, events, "blocked")
    else:
        next_index = (turn_index + 1) % len(state["turn_order"])
        state["current_turn"] = state["turn_order"][next_index]
        if next_index == 0:
            state["round"] += 1


class ChrominoGame:
    game_id = "chromino"
    min_players = 1
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 1 <= len(players) <= 8:
            raise ValueError("Chromino requires 1–8 players.")
        if config is not None and (not isinstance(config, dict) or config):
            raise ValueError("Chromino standard play has no configuration options.")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        player_ids = [player["player_id"] for player in ordered]
        if len(set(player_ids)) != len(player_ids):
            raise ValueError("Player IDs must be unique.")
        first_index = random.randrange(len(player_ids))
        turn_order = player_ids[first_index:] + player_ids[:first_index]
        starting_tile = random.choice([tile_id for tile_id in TILES if WILD in TILES[tile_id]])
        bag = [tile_id for tile_id in TILES if tile_id != starting_tile]
        random.shuffle(bag)
        state = {
            "game_id": "chromino", "config": {}, "board": {}, "placed_tiles": [],
            "players": {player_id: {"hand": [bag.pop() for _ in range(8)], "turns": 0} for player_id in player_ids},
            "player_meta": {
                player["player_id"]: {
                    "name": player.get("name", "Player"), "seat": player.get("seat", index),
                    "is_bot": bool(player.get("is_bot")),
                }
                for index, player in enumerate(ordered)
            },
            "bag": bag, "turn_order": turn_order, "current_turn": turn_order[0],
            "phase": "playing", "drawn_tile": None, "round": 1, "ply": 0, "revision": 0,
            "empty_turns": 0, "finishing_round": False, "winner": [],
            "game_over": False, "result_reason": None, "history": [],
        }
        _put_tile(state, starting_tile, 0, 0, 0, None)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id != state["current_turn"]:
            return []
        if state["phase"] == "drawn":
            return ["place", "keep"]
        if next(_iter_placements(state, player_id), None) is not None:
            return ["place"]
        return ["draw"] if state["bag"] else ["pass"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state["game_over"]:
            return [], "Game over."
        if player_id != state["current_turn"]:
            return [], "Not your turn."
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "Invalid action."
        kind = action["type"]
        if kind not in ("place", "draw", "keep", "pass"):
            return [], "Unknown action."
        expected = {"type", "tile_id", "x", "y", "rotation"} if kind == "place" else {"type"}
        if set(action) != expected:
            return [], "Invalid action fields."
        hand = state["players"][player_id]["hand"]
        if kind == "place":
            tile_id = action["tile_id"]
            if not isinstance(tile_id, str) or tile_id not in hand:
                return [], "That tile is not in your hand."
            if state["phase"] == "drawn" and tile_id != state["drawn_tile"]:
                return [], "Only the newly drawn tile may be played this turn."
            if len(hand) == 1 and WILD in TILES[tile_id]:
                return [], "A Chameleon cannot be your last tile; draw instead."
            if any(type(action[field]) is not int for field in ("x", "y", "rotation")):
                return [], "Coordinates and rotation must be integers."
            if action["rotation"] not in ROTATIONS:
                return [], "Invalid rotation."
            error = placement_error(state, tile_id, action["x"], action["y"], action["rotation"])
            if error:
                return [], error
        elif kind == "keep":
            if state["phase"] != "drawn":
                return [], "You may only keep a newly drawn tile."
        else:
            if state["phase"] != "playing":
                return [], "Finish your drawn-tile decision first."
            if next(_iter_placements(state, player_id), None) is not None:
                return [], "You have a legal placement and must play a tile."
            if (kind == "draw") != bool(state["bag"]):
                return [], "Draw while the bag has tiles; pass only when it is empty."
        events = []
        state["revision"] += 1
        if kind == "place":
            _put_tile(state, tile_id, action["x"], action["y"], action["rotation"], player_id)
            hand.remove(tile_id)
            _record(state, events, "place", player_id, tile_id=tile_id, x=action["x"], y=action["y"], rotation=action["rotation"])
            if not hand:
                state["winner"].append(player_id)
                state["finishing_round"] = True
            _end_turn(state, events, placed=True)
        elif kind == "draw":
            drawn = state["bag"].pop()
            hand.append(drawn)
            state["drawn_tile"] = drawn
            state["phase"] = "drawn"
            _record(state, events, "draw", player_id)
            if next(_iter_placements(state, player_id), None) is None:
                _record(state, events, "keep", player_id)
                _end_turn(state, events, placed=False)
        else:
            _record(state, events, kind, player_id)
            _end_turn(state, events, placed=False, kept_playable=kind == "keep")
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            hand = player["hand"]
            players.append({
                "player_id": player_id, **state["player_meta"][player_id],
                "hand_count": len(hand), "turns": player["turns"],
                "last_tile": _public_tile(hand[0]) if len(hand) == 1 else None,
                "revealed_hand": [_public_tile(tile_id) for tile_id in hand] if state["game_over"] else [],
                "finished": player_id in state["winner"] if state["finishing_round"] else False,
            })
        viewer = state["players"].get(viewer_id)
        return {
            "game_id": "chromino", "you": viewer_id, "config": {}, "players": players,
            "turn_order": list(state["turn_order"]), "current_turn": state["current_turn"],
            "phase": state["phase"], "round": state["round"], "ply": state["ply"], "revision": state["revision"],
            "bag_count": len(state["bag"]), "finishing_round": state["finishing_round"],
            "placed_tiles": [{**copy.deepcopy(tile), **_public_tile(tile["tile_id"])} for tile in state["placed_tiles"]],
            "hand": [_public_tile(tile_id) for tile_id in viewer["hand"]] if viewer else [],
            "drawn_tile_id": state["drawn_tile"] if viewer_id == state["current_turn"] else None,
            "legal_actions": ChrominoGame.get_legal_actions(state, viewer_id),
            "legal_placements": legal_placements(state, viewer_id),
            "history": copy.deepcopy(state["history"]), "winner": list(state["winner"]),
            "result_reason": state["result_reason"], "game_over": state["game_over"],
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        actions = ChrominoGame.get_legal_actions(state, bot_id)
        if not actions:
            return None
        moves = legal_placements(state, bot_id)
        if not moves:
            return {"type": actions[0]}
        counts = Counter(move["tile_id"] for move in moves)
        board = board_colors(state)
        hand_count = len(state["players"][bot_id]["hand"])

        def score(move: Dict) -> Tuple[float, int, int]:
            contacts, _ = _geometry(board, move["x"], move["y"], move["rotation"])
            chameleon_bonus = 20 if WILD in TILES[move["tile_id"]] and hand_count <= 3 else 0
            return (chameleon_bonus + len(contacts) * 3 - counts[move["tile_id"]] * 0.2,
                    -abs(move["x"]) - abs(move["y"]), -move["rotation"])

        return max(moves, key=score)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
