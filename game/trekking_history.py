import math
import os
import random
import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple

from game.trekking_history_data import DAY_DECKS


TOKEN_COLUMNS = ["person", "event", "innovation", "progress"]
TOKEN_COLUMN_INDEX = {token: idx for idx, token in enumerate(TOKEN_COLUMNS)}
SLOT_REWARDS = [None, "person", "event", "innovation", "progress", "crystal"]
DAY_END_TIME = 12
MAX_DAYS = 3
TREK_SCORES = {
    1: -3,
    2: 0,
    3: 2,
    4: 4,
    5: 7,
    6: 10,
    7: 14,
    8: 18,
    9: 24,
}


def _trek_score(length: int) -> int:
    if length <= 0:
        return 0
    return TREK_SCORES.get(length, 30)


def _clone_card(card: Dict) -> Dict:
    return {
        "id": card["id"],
        "day": card["day"],
        "year": int(card["year"]),
        "year_label": card["year_label"],
        "title": card["title"],
        "cost": int(card["cost"]),
        "reward_raw": card.get("reward_raw", ""),
        "tokens": list(card.get("tokens", [])),
    }


def _build_day_deck(day: int) -> List[Dict]:
    deck = [_clone_card(card) for card in DAY_DECKS.get(day, [])]
    random.shuffle(deck)
    return deck


def _draw_card(deck: List[Dict]) -> Optional[Dict]:
    if not deck:
        return None
    return deck.pop()


def _parse_svg_transform(transform: Optional[str]) -> Tuple[float, float]:
    if not transform:
        return 0.0, 0.0
    match = re.search(r"translate\(([-0-9.]+)(?:\s+|,)([-0-9.]+)\)", transform)
    if not match:
        return 0.0, 0.0
    return float(match.group(1)), float(match.group(2))


def _cluster_positions(values: List[float], dist: float) -> List[float]:
    if not values:
        return []
    clusters: List[List[float]] = [[values[0]]]
    for value in values[1:]:
        if abs(value - clusters[-1][-1]) <= dist:
            clusters[-1].append(value)
        else:
            clusters.append([value])
    return [sum(cluster) / len(cluster) for cluster in clusters]


def _parse_itinerary_svg(path: str) -> Dict:
    root = ET.fromstring(open(path, "r", encoding="utf-8").read())
    circles = []
    texts = []

    def walk(node, offset):
        dx, dy = _parse_svg_transform(node.attrib.get("transform"))
        ox, oy = offset
        new_offset = (ox + dx, oy + dy)
        tag = node.tag.split("}")[-1]
        if tag == "circle":
            fill = (node.attrib.get("fill") or "").lower()
            cx = float(node.attrib.get("cx", "0")) + new_offset[0]
            cy = float(node.attrib.get("cy", "0")) + new_offset[1]
            r = float(node.attrib.get("r", "0"))
            circles.append({"fill": fill, "cx": cx, "cy": cy, "r": r})
        elif tag == "text":
            x = float(node.attrib.get("x", "0")) + new_offset[0]
            y = float(node.attrib.get("y", "0")) + new_offset[1]
            text_val = "".join(node.itertext()).strip()
            texts.append({"x": x, "y": y, "text": text_val})
        for child in list(node):
            walk(child, new_offset)

    walk(root, (0.0, 0.0))

    dark = [c for c in circles if c["fill"] == "#1b0f0a"]
    xs = sorted(c["cx"] for c in dark)
    ys = sorted(c["cy"] for c in dark)
    if not xs or not ys:
        return {"grid": [[None] * 4 for _ in range(6)], "row_rewards": {}}

    x_range = max(xs) - min(xs)
    y_range = max(ys) - min(ys)
    x_dist = x_range / 6 if x_range else 10
    y_dist = y_range / 10 if y_range else 10
    grid_x = sorted(_cluster_positions(xs, dist=x_dist))
    grid_y = sorted(_cluster_positions(ys, dist=y_dist))

    if len(grid_x) != 4 and grid_x:
        idxs = [
            round(0),
            round((len(grid_x) - 1) / 3),
            round(2 * (len(grid_x) - 1) / 3),
            round(len(grid_x) - 1),
        ]
        grid_x = [grid_x[int(i)] for i in idxs]
    if len(grid_y) != 6 and grid_y:
        idxs = [
            round(0),
            round((len(grid_y) - 1) / 5),
            round(2 * (len(grid_y) - 1) / 5),
            round(3 * (len(grid_y) - 1) / 5),
            round(4 * (len(grid_y) - 1) / 5),
            round(len(grid_y) - 1),
        ]
        grid_y = [grid_y[int(i)] for i in idxs]

    if len(grid_x) > 1:
        x_tol = min(abs(grid_x[i + 1] - grid_x[i]) for i in range(len(grid_x) - 1)) * 0.35
    else:
        x_tol = 10
    if len(grid_y) > 1:
        y_tol = min(abs(grid_y[i + 1] - grid_y[i]) for i in range(len(grid_y) - 1)) * 0.35
    else:
        y_tol = 10

    def near(cx, cy, x, y):
        return abs(cx - x) <= x_tol and abs(cy - y) <= y_tol

    teal = [c for c in circles if c["fill"] == "#4aa7b2"]
    purple = [c for c in circles if c["fill"] == "#8a3d8f"]

    def nearest_text(x, y, tol):
        best = None
        for t in texts:
            if not t["text"].isdigit():
                continue
            dist = math.hypot(t["x"] - x, t["y"] - y)
            if dist <= tol and (best is None or dist < best[0]):
                best = (dist, int(t["text"]))
        return best[1] if best else None

    grid = [[None for _ in range(4)] for _ in range(6)]
    for row_idx, y in enumerate(grid_y):
        for col_idx, x in enumerate(grid_x):
            if not any(near(d["cx"], d["cy"], x, y) for d in dark):
                continue
            if any(near(p["cx"], p["cy"], x, y) for p in purple):
                grid[row_idx][col_idx] = {"type": "gem"}
            elif any(near(t["cx"], t["cy"], x, y) for t in teal):
                value = nearest_text(x, y, tol=max(x_tol, y_tol) * 1.2) or 0
                grid[row_idx][col_idx] = {"type": "swirl", "value": value}
            else:
                grid[row_idx][col_idx] = {"type": "empty"}

    max_x = max(grid_x) if grid_x else 0
    if len(grid_x) > 1:
        spacing = sum(abs(grid_x[i + 1] - grid_x[i]) for i in range(len(grid_x) - 1)) / (len(grid_x) - 1)
    else:
        spacing = 20
    reward_circles = [c for c in teal if c["cx"] > max_x + spacing * 0.6]
    row_rewards: Dict[str, int] = {}
    for rc in reward_circles:
        value = nearest_text(rc["cx"], rc["cy"], tol=spacing * 0.6)
        if value is None:
            continue
        row_idx = min(range(len(grid_y)), key=lambda i: abs(grid_y[i] - rc["cy"]))
        row_rewards[str(row_idx)] = value

    return {"grid": grid, "row_rewards": row_rewards}


def _load_itinerary_templates() -> List[Dict]:
    base_dir = os.path.join("assets", "histroy_itinerary")
    if not os.path.isdir(base_dir):
        return []
    templates = []
    for filename in sorted(os.listdir(base_dir)):
        if not filename.endswith(".svg"):
            continue
        template_id = filename.replace(".svg", "")
        data = _parse_itinerary_svg(os.path.join(base_dir, filename))
        templates.append({
            "id": template_id,
            "grid": data["grid"],
            "row_rewards": data.get("row_rewards", {}),
        })
    return templates


ITINERARY_TEMPLATES = _load_itinerary_templates()
ITINERARY_TEMPLATE_MAP = {tpl["id"]: tpl for tpl in ITINERARY_TEMPLATES}


def _build_itinerary_state(template_id: str) -> Dict:
    template = ITINERARY_TEMPLATE_MAP.get(template_id)
    grid = template["grid"] if template else [[None for _ in range(4)] for _ in range(6)]
    filled = []
    for row in grid:
        filled.append([False if cell is not None else None for cell in row])
    return {
        "template_id": template_id,
        "filled": filled,
        "row_rewards_claimed": [False] * 6,
    }


def _current_player_id(state: Dict) -> Optional[str]:
    players = state.get("players", {})
    if not players:
        return None
    min_time = min(players[pid]["time"] for pid in players)
    candidates = [pid for pid in players if players[pid]["time"] == min_time]
    if len(candidates) == 1:
        return candidates[0]
    return max(candidates, key=lambda pid: players[pid]["time_order"])


def _next_time_order(state: Dict) -> int:
    state["time_order_counter"] += 1
    return state["time_order_counter"]


def _apply_time_cost(state: Dict, player: Dict, cost: int) -> None:
    player["time"] += cost
    player["time_order"] = _next_time_order(state)


def _maybe_record_arrival(state: Dict, player_id: str) -> None:
    player = state["players"][player_id]
    if player["time"] < DAY_END_TIME:
        return
    arrivals = state.get("day_arrivals", [])
    if player_id in arrivals:
        return
    arrivals.append(player_id)
    state["day_arrivals"] = arrivals


def _place_token_on_itinerary(state: Dict, player_id: str, column_index: int) -> None:
    player = state["players"][player_id]
    day_index = state["day"] - 1
    if day_index < 0 or day_index >= len(player["itineraries"]):
        return
    itinerary = player["itineraries"][day_index]
    template_id = itinerary["template_id"]
    template = ITINERARY_TEMPLATE_MAP.get(template_id)
    if not template:
        return
    grid = template["grid"]
    filled = itinerary["filled"]
    target_row = None
    for row_idx in range(len(grid)):
        if grid[row_idx][column_index] is None:
            continue
        if filled[row_idx][column_index] is False:
            target_row = row_idx
            break
    if target_row is None:
        return

    filled[target_row][column_index] = True
    cell = grid[target_row][column_index]
    if cell and cell.get("type") == "swirl":
        player["score"] += int(cell.get("value", 0))
    elif cell and cell.get("type") == "gem":
        player["crystals"] += 1

    row_rewards = template.get("row_rewards", {})
    if row_rewards and not itinerary["row_rewards_claimed"][target_row]:
        row_complete = True
        for col_idx in range(len(grid[target_row])):
            if grid[target_row][col_idx] is None:
                continue
            if filled[target_row][col_idx] is not True:
                row_complete = False
                break
        if row_complete:
            reward_value = row_rewards.get(str(target_row))
            if reward_value is not None:
                player["score"] += int(reward_value)
                itinerary["row_rewards_claimed"][target_row] = True


def _gain_tokens(state: Dict, player_id: str, tokens: List[str], wild_choices: List[int]) -> Optional[str]:
    player = state["players"][player_id]
    wild_index = 0
    for token in tokens:
        if token == "crystal":
            player["crystals"] += 1
            continue
        if token == "wild":
            if wild_index >= len(wild_choices):
                return "wild choice required"
            column_index = wild_choices[wild_index]
            wild_index += 1
        else:
            column_index = TOKEN_COLUMN_INDEX.get(token)
            if column_index is None:
                continue
        _place_token_on_itinerary(state, player_id, column_index)
    if wild_index != len(wild_choices):
        return "extra wild choices"
    return None


def _apply_trek_card(player: Dict, card: Dict) -> None:
    treks = player["treks"]
    if not treks:
        treks.append([])
    current = treks[-1]
    if not current:
        current.append(card)
        return
    last_year = current[-1]["year"]
    if card["year"] >= last_year:
        current.append(card)
    else:
        treks.append([card])


def _start_new_day(state: Dict, day: int, arrival_order: List[str]) -> None:
    deck = _build_day_deck(day)
    market: List[Optional[Dict]] = [None] * 6
    for idx in range(6):
        market[idx] = _draw_card(deck)
    state["deck"] = deck
    state["market"] = market
    state["day"] = day
    state["day_arrivals"] = []

    order_values = {}
    for idx, pid in enumerate(arrival_order):
        order_values[pid] = idx + 1
    state["time_order_counter"] = max(order_values.values(), default=0)
    for pid, pdata in state["players"].items():
        pdata["time"] = 0
        pdata["time_order"] = order_values.get(pid, 0)

    for pid, pdata in state["players"].items():
        pool = pdata.get("itinerary_pool", [])
        if pool:
            template_id = pool.pop()
            pdata["itineraries"].append(_build_itinerary_state(template_id))

    state["current_turn"] = _current_player_id(state)


def _finish_game(state: Dict) -> None:
    for pid, pdata in state["players"].items():
        trek_score = sum(_trek_score(len(trek)) for trek in pdata.get("treks", []))
        pdata["score"] += trek_score
        pdata["score"] += int(pdata.get("crystals", 0))

    scores = {pid: pdata["score"] for pid, pdata in state["players"].items()}
    max_score = max(scores.values()) if scores else 0
    state["winner"] = [pid for pid, score in scores.items() if score == max_score]
    state["game_over"] = True
    state["phase"] = "game_over"


def _bot_itinerary_context(state: Dict, bot_id: str) -> Tuple[Optional[Dict], Optional[Dict]]:
    player = state.get("players", {}).get(bot_id)
    if not player:
        return None, None
    day_index = int(state.get("day", 1)) - 1
    itineraries = player.get("itineraries", [])
    if day_index < 0 or day_index >= len(itineraries):
        return None, None
    itinerary = itineraries[day_index]
    template_id = itinerary.get("template_id")
    template = ITINERARY_TEMPLATE_MAP.get(template_id)
    if not template:
        return None, None
    return itinerary, template


def _bot_next_open_row(grid: List[List[Optional[Dict]]], filled: List[List[Optional[bool]]], col: int) -> Optional[int]:
    for row_idx in range(len(grid)):
        if grid[row_idx][col] is None:
            continue
        if filled[row_idx][col] is False:
            return row_idx
    return None


def _bot_peek_column_value(
    template: Dict, filled: List[List[Optional[bool]]], row_rewards_claimed: List[bool], col: int
) -> Optional[float]:
    grid = template.get("grid") or []
    if not grid or col < 0 or col >= len(grid[0]):
        return None
    target_row = _bot_next_open_row(grid, filled, col)
    if target_row is None:
        return None

    value = 0.0
    cell = grid[target_row][col]
    if cell and cell.get("type") == "swirl":
        value += float(cell.get("value", 0))
    elif cell and cell.get("type") == "gem":
        value += 1.0

    if target_row < len(row_rewards_claimed) and not row_rewards_claimed[target_row]:
        row_complete = True
        for col_idx in range(len(grid[target_row])):
            if grid[target_row][col_idx] is None:
                continue
            if col_idx == col:
                continue
            if not filled[target_row][col_idx]:
                row_complete = False
                break
        if row_complete:
            reward = template.get("row_rewards", {}).get(str(target_row))
            if reward is not None:
                value += float(reward)
    return value


def _bot_apply_column(
    template: Dict, filled: List[List[Optional[bool]]], row_rewards_claimed: List[bool], col: int
) -> Tuple[int, int, bool]:
    grid = template.get("grid") or []
    if not grid or col < 0 or col >= len(grid[0]):
        return 0, 0, False
    target_row = _bot_next_open_row(grid, filled, col)
    if target_row is None:
        return 0, 0, False

    filled[target_row][col] = True
    cell = grid[target_row][col]
    score_gain = 0
    crystal_gain = 0
    if cell and cell.get("type") == "swirl":
        score_gain += int(cell.get("value", 0))
    elif cell and cell.get("type") == "gem":
        crystal_gain += 1

    if target_row < len(row_rewards_claimed) and not row_rewards_claimed[target_row]:
        row_complete = True
        for col_idx in range(len(grid[target_row])):
            if grid[target_row][col_idx] is None:
                continue
            if not filled[target_row][col_idx]:
                row_complete = False
                break
        if row_complete:
            reward = template.get("row_rewards", {}).get(str(target_row))
            if reward is not None:
                score_gain += int(reward)
            row_rewards_claimed[target_row] = True

    return score_gain, crystal_gain, True


def _bot_choose_wild_column(
    template: Dict, filled: List[List[Optional[bool]]], row_rewards_claimed: List[bool]
) -> Optional[int]:
    best_value = None
    best_cols: List[int] = []
    for col in range(len(TOKEN_COLUMNS)):
        value = _bot_peek_column_value(template, filled, row_rewards_claimed, col)
        if value is None:
            continue
        if best_value is None or value > best_value:
            best_value = value
            best_cols = [col]
        elif value == best_value:
            best_cols.append(col)
    if not best_cols:
        return None
    return random.choice(best_cols)


def _bot_simulate_tokens(
    template: Dict, filled: List[List[Optional[bool]]], row_rewards_claimed: List[bool], tokens: List[str]
) -> Tuple[float, List[int]]:
    score_gain = 0
    crystal_gain = 0
    progress_gain = 0
    wild_choices: List[int] = []
    for token in tokens:
        if token == "crystal":
            crystal_gain += 1
            continue
        if token == "wild":
            col = _bot_choose_wild_column(template, filled, row_rewards_claimed)
            if col is None:
                col = random.randrange(len(TOKEN_COLUMNS))
            wild_choices.append(col)
            score, crystals, placed = _bot_apply_column(template, filled, row_rewards_claimed, col)
            score_gain += score
            crystal_gain += crystals
            if placed:
                progress_gain += 1
            continue
        col = TOKEN_COLUMN_INDEX.get(token)
        if col is None:
            continue
        score, crystals, placed = _bot_apply_column(template, filled, row_rewards_claimed, col)
        score_gain += score
        crystal_gain += crystals
        if placed:
            progress_gain += 1

    value = score_gain + crystal_gain * 1.0 + progress_gain * 0.2
    return value, wild_choices


class TrekkingHistoryGame:
    game_id = "trekking_history"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < TrekkingHistoryGame.min_players or len(players) > TrekkingHistoryGame.max_players:
            raise ValueError("invalid player count")

        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        templates = list(ITINERARY_TEMPLATES)
        template_ids = [tpl["id"] for tpl in templates]
        state_players: Dict[str, Dict] = {}
        for idx, pid in enumerate(player_ids):
            pool = list(template_ids)
            random.shuffle(pool)
            template_id = pool.pop() if pool else ""
            state_players[pid] = {
                "crystals": 1,
                "time": 0,
                "time_order": idx + 1,
                "score": 0,
                "treks": [],
                "itineraries": [_build_itinerary_state(template_id)] if template_id else [],
                "itinerary_pool": pool,
            }

        deck = _build_day_deck(1)
        market: List[Optional[Dict]] = [None] * 6
        for idx in range(6):
            market[idx] = _draw_card(deck)

        state = {
            "config": {},
            "player_meta": player_meta,
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[-1] if player_ids else None,
            "time_order_counter": len(player_ids),
            "day": 1,
            "deck": deck,
            "market": market,
            "slot_rewards": list(SLOT_REWARDS),
            "day_arrivals": [],
            "phase": "turn",
            "game_over": False,
            "winner": [],
        }
        state["current_turn"] = _current_player_id(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        actions = []
        if any(card is not None for card in state.get("market", [])):
            actions.append("take_card")
        actions.append("take_ancestor")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        player = state["players"][player_id]

        spend = action.get("spend_crystals", 0)
        if spend is None:
            spend = 0
        if not isinstance(spend, int) or spend < 0:
            return [], "invalid spend_crystals"

        wild_choices = action.get("wild_choices") or []
        if not isinstance(wild_choices, list) or not all(isinstance(x, int) for x in wild_choices):
            return [], "invalid wild_choices"
        if any(x < 0 or x >= len(TOKEN_COLUMNS) for x in wild_choices):
            return [], "invalid wild_choices"

        if action_type == "take_card":
            slot_index = action.get("slot_index")
            if not isinstance(slot_index, int) or slot_index < 0 or slot_index >= 6:
                return [], "invalid slot_index"
            market = state.get("market", [])
            if slot_index >= len(market) or market[slot_index] is None:
                return [], "card not available"
            card = market[slot_index]

            if spend > player["crystals"]:
                return [], "insufficient crystals"
            if spend > max(0, card["cost"] - 1):
                return [], "cannot reduce below 1"

            tokens = list(card.get("tokens", []))
            slot_reward = state.get("slot_rewards", SLOT_REWARDS)[slot_index]
            if slot_reward == "crystal":
                tokens.append("crystal")
            elif slot_reward:
                tokens.append(slot_reward)

            wild_needed = sum(1 for t in tokens if t == "wild")
            if len(wild_choices) != wild_needed:
                return [], "wild choice required"

            player["crystals"] -= spend
            time_cost = max(1, card["cost"] - spend)
            _apply_time_cost(state, player, time_cost)
            _maybe_record_arrival(state, player_id)

            token_error = _gain_tokens(state, player_id, tokens, wild_choices)
            if token_error:
                return [], token_error

            _apply_trek_card(player, card)

            for idx in range(slot_index, 0, -1):
                market[idx] = market[idx - 1]
            market[0] = _draw_card(state["deck"])

            events.append({"type": "trekking:take_card", "payload": {"player_id": player_id, "card_id": card["id"]}})

        elif action_type == "take_ancestor":
            if spend > player["crystals"]:
                return [], "insufficient crystals"
            if spend > max(0, 3 - 1):
                return [], "cannot reduce below 1"

            wild_needed = 1
            if len(wild_choices) != wild_needed:
                return [], "wild choice required"

            player["crystals"] -= spend
            time_cost = max(1, 3 - spend)
            _apply_time_cost(state, player, time_cost)
            _maybe_record_arrival(state, player_id)

            token_error = _gain_tokens(state, player_id, ["wild"], wild_choices)
            if token_error:
                return [], token_error

            treks = player["treks"]
            if not treks:
                treks.append([])
            current = treks[-1]
            last_year = current[-1]["year"] if current else -10**9
            ancestor_card = {"id": f"A{player_id}-{len(current)}", "year": last_year, "title": "Ancestor"}
            _apply_trek_card(player, ancestor_card)

            events.append({"type": "trekking:take_ancestor", "payload": {"player_id": player_id}})
        else:
            return [], "invalid action"

        if all(pdata["time"] >= DAY_END_TIME for pdata in state["players"].values()):
            if state["day"] >= MAX_DAYS:
                _finish_game(state)
            else:
                arrival_order = state.get("day_arrivals", [])
                _start_new_day(state, state["day"] + 1, arrival_order)
        else:
            state["current_turn"] = _current_player_id(state)

        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state.get("player_meta", {}).keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            trek_lengths = [len(trek) for trek in pdata.get("treks", [])]
            current_trek = pdata.get("treks", [])[-1] if pdata.get("treks") else []
            last_year = current_trek[-1]["year"] if current_trek else None
            current_trek_score = _trek_score(len(current_trek))
            treks_total_score = sum(_trek_score(len(trek)) for trek in pdata.get("treks", []))
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "time": pdata.get("time", 0),
                    "time_order": pdata.get("time_order", 0),
                    "crystals": pdata.get("crystals", 0),
                    "score": pdata.get("score", 0),
                    "current_trek_score": current_trek_score,
                    "treks_total_score": treks_total_score,
                    "trek_lengths": trek_lengths,
                    "current_trek_last_year": last_year,
                    "itineraries": pdata.get("itineraries", []),
                }
            )

        market_view = []
        for card in state.get("market", []):
            if card is None:
                market_view.append(None)
            else:
                market_view.append(
                    {
                        "id": card["id"],
                        "year": card["year"],
                        "year_label": card.get("year_label"),
                        "title": card.get("title"),
                        "cost": card.get("cost"),
                        "tokens": list(card.get("tokens", [])),
                    }
                )

        market = state.get("market", [])
        deck_top = market[0] if market and market[0] else None

        return {
            "game_id": TrekkingHistoryGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "day": state.get("day"),
            "current_turn": state.get("current_turn"),
            "turn_order": list(state.get("turn_order", [])),
            "slot_rewards": list(state.get("slot_rewards", SLOT_REWARDS)),
            "deck_count": len(state.get("deck", [])),
            "deck_top": {
                "id": deck_top["id"],
                "year": deck_top["year"],
                "year_label": deck_top.get("year_label"),
                "title": deck_top.get("title"),
                "cost": deck_top.get("cost"),
                "tokens": list(deck_top.get("tokens", [])),
            }
            if deck_top
            else None,
            "market": market_view,
            "players": players_view,
            "itinerary_templates": list(ITINERARY_TEMPLATES),
            "legal_actions": TrekkingHistoryGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        legal = TrekkingHistoryGame.get_legal_actions(state, bot_id)
        if not legal:
            return None

        market = state.get("market", [])
        available_slots = [idx for idx, card in enumerate(market) if card is not None]

        itinerary, template = _bot_itinerary_context(state, bot_id)

        def build_tokens(slot_index: int, card: Dict) -> List[str]:
            tokens = list(card.get("tokens", []))
            slot_reward = state.get("slot_rewards", SLOT_REWARDS)[slot_index]
            if slot_reward == "crystal":
                tokens.append("crystal")
            elif slot_reward:
                tokens.append(slot_reward)
            return tokens

        if "take_card" in legal and available_slots:
            best_slots: List[int] = []
            best_value: Optional[float] = None
            best_wild_by_slot: Dict[int, List[int]] = {}

            for slot_index in available_slots:
                card = market[slot_index]
                if not card:
                    continue
                tokens = build_tokens(slot_index, card)
                if template and itinerary:
                    filled = [list(row) for row in itinerary.get("filled", [])]
                    row_claimed = list(itinerary.get("row_rewards_claimed", []))
                    value, wild_choices = _bot_simulate_tokens(template, filled, row_claimed, tokens)
                else:
                    wild_needed = sum(1 for t in tokens if t == "wild")
                    wild_choices = [random.randrange(len(TOKEN_COLUMNS)) for _ in range(wild_needed)]
                    value = float(len(tokens)) * 0.2
                cost = max(1, int(card.get("cost", 1)))
                value = value / cost
                best_wild_by_slot[slot_index] = wild_choices
                if best_value is None or value > best_value:
                    best_value = value
                    best_slots = [slot_index]
                elif value == best_value:
                    best_slots.append(slot_index)

            if best_slots:
                chosen_slot = random.choice(best_slots)
                wild_choices = best_wild_by_slot.get(chosen_slot, [])
                return {
                    "type": "take_card",
                    "slot_index": chosen_slot,
                    "spend_crystals": 0,
                    "wild_choices": wild_choices,
                }

        if "take_ancestor" in legal:
            wild_choices: List[int] = []
            if template and itinerary:
                filled = [list(row) for row in itinerary.get("filled", [])]
                row_claimed = list(itinerary.get("row_rewards_claimed", []))
                _, wild_choices = _bot_simulate_tokens(template, filled, row_claimed, ["wild"])
            if not wild_choices:
                wild_choices = [random.randrange(len(TOKEN_COLUMNS))]
            return {"type": "take_ancestor", "spend_crystals": 0, "wild_choices": wild_choices}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
