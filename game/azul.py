import copy
import random
from typing import Dict, List, Optional, Tuple

COLORS = ["blue", "yellow", "red", "black", "white"]

FACTORY_COUNT_BY_PLAYERS = {
    2: 5,
    3: 7,
    4: 9,
}

FLOOR_PENALTIES = [-1, -1, -2, -2, -2, -3, -3]

WALL_PATTERN = [
    ["blue", "yellow", "red", "black", "white"],
    ["white", "blue", "yellow", "red", "black"],
    ["black", "white", "blue", "yellow", "red"],
    ["red", "black", "white", "blue", "yellow"],
    ["yellow", "red", "black", "white", "blue"],
]


def _build_bag() -> List[str]:
    bag: List[str] = []
    for color in COLORS:
        bag.extend([color] * 20)
    random.shuffle(bag)
    return bag


def _draw_tiles(state: Dict, count: int) -> List[str]:
    drawn: List[str] = []
    for _ in range(count):
        if not state["bag"]:
            if state["discard"]:
                state["bag"] = list(state["discard"])
                state["discard"] = []
                random.shuffle(state["bag"])
            else:
                break
        drawn.append(state["bag"].pop())
    return drawn


def _init_factories(state: Dict, player_count: int) -> List[List[str]]:
    factory_count = FACTORY_COUNT_BY_PLAYERS[player_count]
    factories: List[List[str]] = []
    for _ in range(factory_count):
        factories.append(_draw_tiles(state, 4))
    return factories


def _wall_col_for_color(row: int, color: str) -> Optional[int]:
    if row < 0 or row >= len(WALL_PATTERN):
        return None
    try:
        return WALL_PATTERN[row].index(color)
    except ValueError:
        return None


def _is_row_placeable(state: Dict, player_id: str, color: str, row: int) -> Tuple[bool, str]:
    pdata = state["players"][player_id]
    if row < 0 or row >= 5:
        return False, "invalid row"
    line = pdata["pattern_lines"][row]
    if line["color"] and line["color"] != color:
        return False, "row color mismatch"
    if len(line["tiles"]) >= row + 1:
        return False, "row full"
    col = _wall_col_for_color(row, color)
    if col is None:
        return False, "invalid color"
    if pdata["wall"][row][col]:
        return False, "color already on wall"
    return True, ""


def _add_to_floor(state: Dict, player_id: str, tiles: List[str]) -> None:
    pdata = state["players"][player_id]
    for tile in tiles:
        if len(pdata["floor"]) < 7:
            pdata["floor"].append(tile)
        else:
            if tile != "first_player":
                state["discard"].append(tile)


def _score_placement(wall: List[List[bool]], row: int, col: int) -> int:
    horizontal = 1
    c = col - 1
    while c >= 0 and wall[row][c]:
        horizontal += 1
        c -= 1
    c = col + 1
    while c < 5 and wall[row][c]:
        horizontal += 1
        c += 1

    vertical = 1
    r = row - 1
    while r >= 0 and wall[r][col]:
        vertical += 1
        r -= 1
    r = row + 1
    while r < 5 and wall[r][col]:
        vertical += 1
        r += 1

    if horizontal == 1 and vertical == 1:
        return 1
    score = 0
    if horizontal > 1:
        score += horizontal
    if vertical > 1:
        score += vertical
    return score


def _complete_rows(wall: List[List[bool]]) -> int:
    return sum(1 for row in wall if all(row))


def _complete_cols(wall: List[List[bool]]) -> int:
    total = 0
    for col in range(5):
        if all(wall[row][col] for row in range(5)):
            total += 1
    return total


def _complete_colors(wall: List[List[bool]]) -> int:
    total = 0
    for color in COLORS:
        count = 0
        for row in range(5):
            col = _wall_col_for_color(row, color)
            if col is not None and wall[row][col]:
                count += 1
        if count == 5:
            total += 1
    return total


def _drafting_complete(state: Dict) -> bool:
    if any(factory for factory in state["factories"]):
        return False
    return len(state["center"]) == 0


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    if not order:
        state["current_turn"] = None
        return
    if state["current_turn"] not in order:
        state["current_turn"] = order[0]
        return
    idx = order.index(state["current_turn"])
    state["current_turn"] = order[(idx + 1) % len(order)]


def _resolve_round(state: Dict) -> None:
    for pid in state["turn_order"]:
        pdata = state["players"][pid]
        wall = pdata["wall"]
        for row in range(5):
            line = pdata["pattern_lines"][row]
            capacity = row + 1
            if len(line["tiles"]) == capacity and line["color"]:
                color = line["color"]
                col = _wall_col_for_color(row, color)
                if col is not None and not wall[row][col]:
                    wall[row][col] = True
                    pdata["score"] += _score_placement(wall, row, col)
                leftovers = line["tiles"][:-1]
                if leftovers:
                    state["discard"].extend(leftovers)
                line["tiles"] = []
                line["color"] = None

        penalty = 0
        for idx in range(min(len(pdata["floor"]), len(FLOOR_PENALTIES))):
            penalty += FLOOR_PENALTIES[idx]
        pdata["score"] = max(0, pdata["score"] + penalty)

        for tile in pdata["floor"]:
            if tile != "first_player":
                state["discard"].append(tile)
        pdata["floor"] = []
        if pdata.get("has_first_player_token"):
            state["next_start_player"] = pid
            pdata["has_first_player_token"] = False

    state["first_player_token_in_center"] = True


def _check_game_over(state: Dict) -> bool:
    for pdata in state["players"].values():
        if any(all(row) for row in pdata["wall"]):
            return True
    return False


def _apply_end_game_bonuses(state: Dict) -> None:
    row_counts: Dict[str, int] = {}
    for pid, pdata in state["players"].items():
        wall = pdata["wall"]
        rows = _complete_rows(wall)
        cols = _complete_cols(wall)
        colors = _complete_colors(wall)
        bonus = rows * 2 + cols * 7 + colors * 10
        pdata["score"] += bonus
        row_counts[pid] = rows

    scores = {pid: pdata["score"] for pid, pdata in state["players"].items()}
    if not scores:
        state["winner"] = []
        return
    max_score = max(scores.values())
    candidates = [pid for pid, score in scores.items() if score == max_score]
    if len(candidates) > 1:
        max_rows = max(row_counts.get(pid, 0) for pid in candidates)
        candidates = [pid for pid in candidates if row_counts.get(pid, 0) == max_rows]
    state["winner"] = candidates


def _bot_candidate_actions(state: Dict, player_id: str) -> List[Dict]:
    actions: List[Dict] = []
    for source_index, factory in enumerate(state.get("factories", [])):
        for color in sorted(set(factory)):
            for row in range(5):
                placeable, _ = _is_row_placeable(state, player_id, color, row)
                if placeable:
                    actions.append(
                        {
                            "type": "take_tiles",
                            "source": "factory",
                            "source_index": source_index,
                            "color": color,
                            "target_row": row,
                        }
                    )
            actions.append(
                {
                    "type": "take_tiles",
                    "source": "factory",
                    "source_index": source_index,
                    "color": color,
                    "target_row": -1,
                }
            )

    for color in sorted(set(state.get("center", []))):
        for row in range(5):
            placeable, _ = _is_row_placeable(state, player_id, color, row)
            if placeable:
                actions.append(
                    {
                        "type": "take_tiles",
                        "source": "center",
                        "color": color,
                        "target_row": row,
                    }
                )
        actions.append(
            {
                "type": "take_tiles",
                "source": "center",
                "color": color,
                "target_row": -1,
            }
        )
    return actions


def _bot_taken_count(state: Dict, action: Dict) -> int:
    color = action["color"]
    if action["source"] == "center":
        return state.get("center", []).count(color)
    source_index = int(action.get("source_index", -1))
    factories = state.get("factories", [])
    if source_index < 0 or source_index >= len(factories):
        return 0
    return factories[source_index].count(color)


def _bot_projected_player_value(state: Dict, player_id: str) -> float:
    pdata = state["players"][player_id]
    wall = [list(row) for row in pdata["wall"]]
    guaranteed_points = 0

    for row, line in enumerate(pdata["pattern_lines"]):
        capacity = row + 1
        if len(line["tiles"]) != capacity or not line.get("color"):
            continue
        col = _wall_col_for_color(row, line["color"])
        if col is None or wall[row][col]:
            continue
        wall[row][col] = True
        guaranteed_points += _score_placement(wall, row, col)

    floor_count = min(len(pdata.get("floor", [])), len(FLOOR_PENALTIES))
    floor_penalty = sum(FLOOR_PENALTIES[:floor_count])
    projected_score = max(0, int(pdata.get("score", 0)) + guaranteed_points + floor_penalty)
    value = projected_score * 4.0

    # A floor tile still wastes a draft even when the score cannot fall below zero.
    value += floor_penalty * 0.65
    if pdata.get("has_first_player_token"):
        value += 0.75

    for row, line in enumerate(pdata["pattern_lines"]):
        capacity = row + 1
        count = len(line["tiles"])
        if not count or count == capacity:
            continue
        completion = count / capacity
        value += count * 0.62 + completion * completion * 1.25

    # Value end-game bonus progress without treating a nearly complete set as
    # already scored.  Cubing the ratio makes the fourth/fifth wall tile matter.
    for row in range(5):
        count = sum(1 for occupied in wall[row] if occupied)
        value += 2.0 * (count / 5.0) ** 3
    for col in range(5):
        count = sum(1 for row in range(5) if wall[row][col])
        value += 7.0 * (count / 5.0) ** 3
    for color in COLORS:
        count = 0
        for row in range(5):
            col = _wall_col_for_color(row, color)
            if col is not None and wall[row][col]:
                count += 1
        value += 10.0 * (count / 5.0) ** 3

    return value


def _bot_offer_value(state: Dict, player_id: str, color: str, count: int, token_cost: bool) -> float:
    if count <= 0:
        return 0.0
    pdata = state["players"][player_id]
    best = -count * 1.1
    for row in range(5):
        placeable, _ = _is_row_placeable(state, player_id, color, row)
        if not placeable:
            continue
        line = pdata["pattern_lines"][row]
        capacity = row + 1
        free = capacity - len(line["tiles"])
        placed = min(free, count)
        overflow = count - placed
        value = placed * 0.55 - overflow * 1.0
        if len(line["tiles"]) + placed == capacity:
            col = _wall_col_for_color(row, color)
            if col is not None:
                projected_wall = [list(wall_row) for wall_row in pdata["wall"]]
                projected_wall[row][col] = True
                value += _score_placement(projected_wall, row, col) * 2.0 + 1.25
        best = max(best, value)
    if token_cost:
        best -= 0.55
    return best


def _bot_best_market_offer(state: Dict, player_id: str) -> float:
    if player_id not in state.get("players", {}):
        return 0.0
    best = 0.0
    for factory in state.get("factories", []):
        for color in set(factory):
            best = max(best, _bot_offer_value(state, player_id, color, factory.count(color), False))
    center = state.get("center", [])
    for color in set(center):
        best = max(
            best,
            _bot_offer_value(
                state,
                player_id,
                color,
                center.count(color),
                bool(state.get("first_player_token_in_center")),
            ),
        )
    return best


def _bot_state_value(state: Dict, player_id: str) -> float:
    own_value = _bot_projected_player_value(state, player_id)
    opponent_values = [
        _bot_projected_player_value(state, opponent_id)
        for opponent_id in state.get("turn_order", [])
        if opponent_id != player_id
    ]
    value = own_value - max(opponent_values, default=0.0) * 0.18

    if state.get("game_over"):
        if player_id in state.get("winner", []):
            value += 100_000.0
        else:
            value -= 100_000.0
        return value

    next_player = state.get("current_turn")
    if next_player == player_id:
        value += _bot_best_market_offer(state, player_id) * 0.22
    elif next_player in state.get("players", {}):
        value -= _bot_best_market_offer(state, next_player) * 0.42
    return value


def _bot_action_value(state: Dict, player_id: str, action: Dict) -> Optional[float]:
    taken_count = _bot_taken_count(state, action)
    target_row = int(action.get("target_row", -1))
    placed_count = 0
    completed_line = False
    if target_row >= 0:
        line = state["players"][player_id]["pattern_lines"][target_row]
        free = target_row + 1 - len(line["tiles"])
        placed_count = min(free, taken_count)
        completed_line = len(line["tiles"]) + placed_count == target_row + 1

    simulated = copy.deepcopy(state)
    random_state = random.getstate()
    try:
        _, error = AzulGame.apply_action(simulated, player_id, action)
    finally:
        # Recycling the discard can shuffle during a simulated round end.  Bot
        # deliberation must not change the real game's random stream.
        random.setstate(random_state)
    if error:
        return None

    value = _bot_state_value(simulated, player_id)
    overflow = taken_count - placed_count
    if target_row < 0:
        value -= taken_count * 0.8
    elif overflow > 0:
        value -= overflow * 0.35
    if completed_line:
        value += 0.35
    return value


class AzulGame:
    game_id = "azul"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not players:
            raise ValueError("no players")
        if len(players) < AzulGame.min_players or len(players) > AzulGame.max_players:
            raise ValueError("invalid player count")
        bag = _build_bag()
        state = {
            "bag": bag,
            "discard": [],
            "factories": [],
            "center": [],
            "first_player_token_in_center": True,
            "current_turn": players[0]["player_id"],
            "turn_order": [p["player_id"] for p in players],
            "round": 1,
            "phase": "drafting",
            "next_start_player": None,
            "config": {},
            "player_meta": {p["player_id"]: p for p in players},
            "winner": [],
            "game_over": False,
            "players": {},
        }
        for p in players:
            state["players"][p["player_id"]] = {
                "score": 0,
                "pattern_lines": [
                    {"color": None, "tiles": []},
                    {"color": None, "tiles": []},
                    {"color": None, "tiles": []},
                    {"color": None, "tiles": []},
                    {"color": None, "tiles": []},
                ],
                "wall": [[False for _ in range(5)] for _ in range(5)],
                "floor": [],
                "has_first_player_token": False,
            }
        state["factories"] = _init_factories(state, len(players))
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if state.get("phase") != "drafting":
            return []
        if player_id != state.get("current_turn"):
            return []
        return ["take_tiles"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if state.get("phase") != "drafting":
            return [], "invalid phase"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        action_type = action.get("type")
        if action_type != "take_tiles":
            return [], "invalid action"

        source = action.get("source")
        color = action.get("color")
        target_row = action.get("target_row")
        if color not in COLORS:
            return [], "invalid color"
        if target_row is None:
            target_row = -1
        if not isinstance(target_row, int) or target_row < -1 or target_row > 4:
            return [], "invalid target row"

        if target_row >= 0:
            ok, reason = _is_row_placeable(state, player_id, color, target_row)
            if not ok:
                return [], reason

        taken: List[str] = []
        if source == "factory":
            source_index = action.get("source_index")
            if not isinstance(source_index, int):
                return [], "invalid source index"
            if source_index < 0 or source_index >= len(state["factories"]):
                return [], "factory out of range"
            factory = state["factories"][source_index]
            if not factory:
                return [], "factory empty"
            if color not in factory:
                return [], "color not in factory"
            taken = [tile for tile in factory if tile == color]
            remaining = [tile for tile in factory if tile != color]
            state["factories"][source_index] = []
            if remaining:
                state["center"].extend(remaining)
        elif source == "center":
            if color not in state["center"]:
                return [], "color not in center"
            taken = [tile for tile in state["center"] if tile == color]
            state["center"] = [tile for tile in state["center"] if tile != color]
            if state.get("first_player_token_in_center"):
                state["first_player_token_in_center"] = False
                pdata = state["players"][player_id]
                pdata["has_first_player_token"] = True
                if len(pdata["floor"]) < 7:
                    pdata["floor"].append("first_player")
        else:
            return [], "invalid source"

        if not taken:
            return [], "no tiles taken"

        if target_row >= 0:
            line = state["players"][player_id]["pattern_lines"][target_row]
            capacity = target_row + 1
            free = capacity - len(line["tiles"])
            place_count = min(free, len(taken))
            if place_count <= 0:
                return [], "row full"
            if line["color"] is None:
                line["color"] = color
            line["tiles"].extend([color] * place_count)
            overflow = taken[place_count:]
            if overflow:
                _add_to_floor(state, player_id, overflow)
        else:
            _add_to_floor(state, player_id, taken)

        if _drafting_complete(state):
            _resolve_round(state)
            if _check_game_over(state):
                _apply_end_game_bonuses(state)
                state["phase"] = "game_over"
                state["game_over"] = True
                state["current_turn"] = None
                return [], None

            state["round"] += 1
            state["center"] = []
            state["factories"] = _init_factories(state, len(state["turn_order"]))
            start_player = state.get("next_start_player")
            if start_player not in state["turn_order"]:
                start_player = state["turn_order"][0]
            state["current_turn"] = start_player
            state["next_start_player"] = None
            state["phase"] = "drafting"
        else:
            _advance_turn(state)

        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        for pid in state["turn_order"]:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            pattern_lines = []
            for idx, line in enumerate(pdata["pattern_lines"]):
                pattern_lines.append(
                    {
                        "color": line["color"],
                        "count": len(line["tiles"]),
                        "capacity": idx + 1,
                    }
                )
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": pdata["score"],
                    "pattern_lines": pattern_lines,
                    "wall": pdata["wall"],
                    "floor": list(pdata["floor"]),
                    "has_first_player_token": bool(pdata.get("has_first_player_token")),
                }
            )

        return {
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "current_turn": state.get("current_turn"),
            "factories": state.get("factories", []),
            "center": state.get("center", []),
            "center_token": bool(state.get("first_player_token_in_center")),
            "bag_count": len(state.get("bag", [])),
            "discard_count": len(state.get("discard", [])),
            "players": players_view,
            "legal_actions": AzulGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": state.get("winner", []),
            "colors": COLORS,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if state.get("phase") != "drafting":
            return None
        if bot_id != state.get("current_turn"):
            return None

        best_action: Optional[Dict] = None
        best_value: Optional[float] = None
        for action in _bot_candidate_actions(state, bot_id):
            value = _bot_action_value(state, bot_id, action)
            if value is None:
                continue
            if best_value is None or value > best_value:
                best_action = action
                best_value = value
        return best_action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
