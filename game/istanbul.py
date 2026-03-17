import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple


GOODS = ["red", "green", "yellow", "blue"]
WAREHOUSE_GOODS = {
    2: "red",  # Fabric Warehouse
    3: "green",  # Spice Warehouse
    4: "yellow",  # Fruit Warehouse
}

PLACE_DEFS = {
    1: {"name": "Wainwright", "type": "wainwright"},
    2: {"name": "Fabric Warehouse", "type": "warehouse", "good": "red"},
    3: {"name": "Spice Warehouse", "type": "warehouse", "good": "green"},
    4: {"name": "Fruit Warehouse", "type": "warehouse", "good": "yellow"},
    5: {"name": "Post Office", "type": "post_office"},
    6: {"name": "Caravansary", "type": "caravansary"},
    7: {"name": "Fountain", "type": "fountain"},
    8: {"name": "Black Market", "type": "black_market"},
    9: {"name": "Tea House", "type": "tea_house"},
    10: {"name": "Large Market", "type": "market_large"},
    11: {"name": "Small Market", "type": "market_small"},
    12: {"name": "Police Station", "type": "police_station"},
    13: {"name": "Sultan's Palace", "type": "sultan_palace"},
    14: {"name": "Gemstone Dealer", "type": "gemstone_dealer"},
    15: {"name": "Small Mosque", "type": "small_mosque"},
    16: {"name": "Great Mosque", "type": "great_mosque"},
}

BONUS_TYPES = {
    "BC_GOOD",
    "BC_LIRA5",
    "BC_SULTAN_2X",
    "BC_POST_2X",
    "BC_GEM_2X",
    "BC_FAMILY_POLICE_REWARD",
    "BC_NO_MOVE",
    "BC_MOVE_3_4",
    "BC_RETURN_ASSISTANT",
    "BC_SMALL_MARKET_WILD",
}

DEFAULT_CONFIG: Dict = {
    "layout": "standard",  # standard = place_id order, random = shuffled
}


ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets" / "istanbul"
DEMAND_PATH = ASSETS_DIR / "base_demand_tiles.json"
GAME_DATA_PATH = ASSETS_DIR / "base_game_data.json"


def _load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _roll_2d6() -> int:
    return random.randint(1, 6) + random.randint(1, 6)


def _shuffle(items: List[Dict]) -> List[Dict]:
    cloned = list(items)
    random.shuffle(cloned)
    return cloned


def _clone_goods(goods: Dict) -> Dict[str, int]:
    return {color: int(goods.get(color, 0)) for color in GOODS}


def _goods_total(goods: Dict) -> int:
    return sum(int(goods.get(color, 0)) for color in GOODS)


def _goods_can_pay(goods: Dict, cost: Dict) -> bool:
    return all(int(goods.get(color, 0)) >= int(cost.get(color, 0)) for color in GOODS)


def _goods_apply_cost(goods: Dict, cost: Dict) -> None:
    for color in GOODS:
        amount = int(cost.get(color, 0))
        if amount:
            goods[color] -= amount


def _apply_goods_gain(goods: Dict, color: str, amount: int, capacity: int) -> int:
    if color not in goods or amount <= 0:
        return 0
    before = goods[color]
    goods[color] = min(capacity, before + amount)
    return goods[color] - before


def _assistant_count(state: Dict, player_id: str) -> int:
    pdata = state["players"][player_id]
    return pdata["assistants_in_stack"] + len(pdata["assistants_on_board"])


def _merchant_positions(state: Dict) -> Dict[int, List[str]]:
    positions: Dict[int, List[str]] = {}
    for pid, pdata in state["players"].items():
        pos = pdata["merchant_pos"]
        positions.setdefault(pos, []).append(pid)
    return positions


def _family_positions(state: Dict) -> Dict[int, List[str]]:
    positions: Dict[int, List[str]] = {}
    for pid, pdata in state["players"].items():
        pos = pdata["family_pos"]
        positions.setdefault(pos, []).append(pid)
    return positions


def _neighbor_map(board: List[Dict]) -> Dict[int, List[int]]:
    neighbors: Dict[int, List[int]] = {}
    pos_to_coord = {tile["pos"]: (tile["row"], tile["col"]) for tile in board}
    coord_to_pos = {(tile["row"], tile["col"]): tile["pos"] for tile in board}
    for pos, (row, col) in pos_to_coord.items():
        opts = []
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            target = coord_to_pos.get((row + dr, col + dc))
            if target is not None:
                opts.append(target)
        neighbors[pos] = opts
    return neighbors


def _tile_by_place(board: List[Dict], place_id: int) -> Optional[Dict]:
    for tile in board:
        if tile["place_id"] == place_id:
            return tile
    return None


def _draw_bonus(state: Dict, count: int = 1) -> List[Dict]:
    drawn: List[Dict] = []
    for _ in range(count):
        if not state["bonus_deck"]:
            if state["bonus_discard"]:
                state["bonus_deck"] = _shuffle(state["bonus_discard"])
                state["bonus_discard"] = []
            else:
                break
        if state["bonus_deck"]:
            drawn.append(state["bonus_deck"].pop())
    return drawn


def _pay_any_goods(player: Dict, cost: Dict, any_count: int) -> Optional[Dict[str, int]]:
    goods = player["goods"]
    payment = {color: int(cost.get(color, 0)) for color in GOODS}
    if not _goods_can_pay(goods, payment):
        return None
    remaining = any_count
    for color in GOODS:
        if remaining <= 0:
            break
        available = goods[color] - payment.get(color, 0)
        if available <= 0:
            continue
        take = min(available, remaining)
        payment[color] += take
        remaining -= take
    if remaining > 0:
        return None
    return payment


def _sultan_costs(data: Dict, player_count: int) -> List[Dict[str, int]]:
    costs: List[Dict[str, int]] = []
    for entry in data.get("sultan_palace_track", {}).get("sequence", []):
        players = entry.get("players")
        if players and player_count not in players:
            continue
        cost = entry.get("cost", {})
        costs.append({color: int(cost.get(color, 0)) for color in list(GOODS) + ["any"]})
    return costs


def _gem_costs(data: Dict, player_count: int) -> List[int]:
    sequence = [int(value) for value in data.get("gemstone_dealer_track", {}).get("sequence", [])]
    skip_map = data.get("gemstone_dealer_track", {}).get("skip_for_players", {})
    skip_target = int(skip_map.get(str(player_count), 0))
    removed = 0
    if player_count <= 3 and 13 in sequence:
        sequence.remove(13)
        removed += 1
    while removed < skip_target and sequence:
        sequence.pop(0)
        removed += 1
    return sequence


def _market_decks(data: Dict) -> Tuple[List[Dict], List[Dict], Dict[str, Dict[int, int]]]:
    small = []
    large = []
    for tile in data.get("tiles", []):
        entry = {
            "id": tile.get("id"),
            "goods": _clone_goods(tile.get("goods", {})),
        }
        if tile.get("market") == "small":
            small.append(entry)
        else:
            large.append(entry)
    revenue_raw = data.get("market_revenue", {})
    revenue = {
        "small": {int(k): int(v) for k, v in revenue_raw.get("small", {}).items()},
        "large": {int(k): int(v) for k, v in revenue_raw.get("large", {}).items()},
    }
    return _shuffle(small), _shuffle(large), revenue


def _bonus_deck(data: Dict) -> List[Dict]:
    deck: List[Dict] = []
    for entry in data.get("bonus_cards", []):
        card_id = entry.get("id")
        text = entry.get("text", "")
        count = int(entry.get("count", 0))
        for idx in range(count):
            deck.append({"uid": f"{card_id}-{idx+1}", "kind": card_id, "text": text})
    return _shuffle(deck)


def _post_office_rows(data: Dict) -> List[List[str]]:
    track = data.get("post_office_track", {})
    rows = []
    for key in ["row_I", "row_II", "row_III", "row_IV"]:
        row = track.get(key, [])
        rows.append(list(row))
    return rows


def _assign_dice_numbers(board: List[Dict]) -> None:
    base = list(range(2, 13))
    extras = [6, 7, 8, 7, 6]
    values = base + extras
    random.shuffle(values)
    for tile, dice_val in zip(board, values):
        tile["dice"] = dice_val


def _resolve_dice_target(state: Dict, roll: int) -> int:
    board = state["board"]
    matches = [tile for tile in board if tile.get("dice") == roll]
    if not matches:
        return random.choice(board)["pos"]
    return random.choice(matches)["pos"]


def _enter_encounters(state: Dict) -> None:
    current_player = state["current_player"]
    pdata = state["players"][current_player]
    location = pdata["merchant_pos"]
    encounters: List[Dict] = []

    family_positions = _family_positions(state)
    for pid in family_positions.get(location, []):
        if pid != current_player:
            encounters.append({"type": "family", "target": pid})

    if state["npc"]["governor"] == location:
        encounters.append({"type": "governor"})
    if state["npc"]["smuggler"] == location:
        encounters.append({"type": "smuggler"})

    state["encounters"] = encounters
    state["phase"] = "encounters"
    _advance_encounter(state)


def _advance_encounter(state: Dict) -> None:
    if state.get("pending"):
        return
    encounters = state.get("encounters", [])
    if not encounters:
        _end_turn(state)
        return
    current = encounters.pop(0)
    state["encounters"] = encounters
    etype = current.get("type")
    if etype == "family":
        state["pending"] = {"type": "reward", "target": current.get("target")}
        return
    if etype == "governor":
        state["pending"] = {"type": "governor"}
        return
    if etype == "smuggler":
        state["pending"] = {"type": "smuggler"}
        return
    _advance_encounter(state)


def _end_turn(state: Dict) -> None:
    current = state["current_player"]
    if not state["final_round"]["active"]:
        if state["players"][current]["rubies"] >= state["rubies_to_win"]:
            state["final_round"]["active"] = True
            state["final_round"]["triggered_by"] = current

    order = state["turn_order"]
    idx = order.index(current)
    next_player = order[(idx + 1) % len(order)]
    if state["final_round"]["active"] and next_player == state["final_round"]["triggered_by"]:
        _finish_game(state)
        return

    state["current_player"] = next_player
    state["phase"] = "movement"
    state["movement_mode"] = "normal"
    state["action_repeat"] = None
    state["small_market_wild"] = None
    state["pending"] = None
    state["encounters"] = []


def _finish_game(state: Dict) -> None:
    scores = []
    for pid, pdata in state["players"].items():
        scores.append(
            (
                pdata["rubies"],
                pdata["lira"],
                _goods_total(pdata["goods"]),
                len(pdata["bonus_hand"]),
                pid,
            )
        )
    scores.sort(reverse=True)
    best = scores[0]
    winners = [pid for entry in scores if entry[:4] == best[:4] for pid in [entry[4]]]
    state["winner"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"


class IstanbulGame:
    game_id = "istanbul"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {**DEFAULT_CONFIG}
        if config:
            cfg.update(config)

        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}
        player_count = len(player_ids)
        demand_data = _load_json(DEMAND_PATH)
        game_data = _load_json(GAME_DATA_PATH)

        board: List[Dict] = []
        place_ids = list(PLACE_DEFS.keys())
        if cfg.get("layout") == "random":
            random.shuffle(place_ids)
        for idx, place_id in enumerate(place_ids):
            row = idx // 4
            col = idx % 4
            place_def = PLACE_DEFS[place_id]
            board.append(
                {
                    "pos": idx,
                    "row": row,
                    "col": col,
                    "place_id": place_id,
                    "name": place_def["name"],
                    "type": place_def["type"],
                }
            )
        _assign_dice_numbers(board)
        neighbors = _neighbor_map(board)

        fountain_tile = _tile_by_place(board, 7)
        police_tile = _tile_by_place(board, 12)
        if not fountain_tile or not police_tile:
            raise ValueError("missing fountain or police station")

        starting_lira = [2 + idx for idx in range(len(player_ids))]

        state_players: Dict[str, Dict] = {}
        for idx, pid in enumerate(player_ids):
            state_players[pid] = {
                "lira": starting_lira[idx] if idx < len(starting_lira) else 2,
                "rubies": 0,
                "goods": {color: 0 for color in GOODS},
                "capacity": 2,
                "assistants_in_stack": 4,
                "assistants_on_board": [],
                "merchant_pos": fountain_tile["pos"],
                "family_pos": police_tile["pos"],
                "bonus_hand": [],
                "mosque_tiles": {"red": False, "green": False, "yellow": False, "blue": False},
            }

        small_deck, large_deck, market_revenue = _market_decks(demand_data)

        bonus_deck = _bonus_deck(game_data)

        post_rows = _post_office_rows(game_data)
        sultan_costs = _sultan_costs(game_data, player_count)
        gem_costs = _gem_costs(game_data, player_count)

        rubies_to_win = 6 if player_count == 2 else 5
        mosque_rubies = min(player_count, 4)

        npc_positions = {}
        for npc in ["governor", "smuggler"]:
            while True:
                roll = _roll_2d6()
                pos = _resolve_dice_target({"board": board}, roll)
                if pos is not None:
                    npc_positions[npc] = pos
                    break

        state = {
            "config": cfg,
            "board": board,
            "neighbors": neighbors,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_player": player_ids[0] if player_ids else None,
            "phase": "movement",
            "movement_mode": "normal",
            "action_repeat": None,
            "small_market_wild": None,
            "bonus_deck": bonus_deck,
            "bonus_discard": [],
            "market_small": small_deck,
            "market_large": large_deck,
            "market_revenue": market_revenue,
            "post_office_rows": post_rows,
            "post_office_index": 0,
            "sultan_costs": sultan_costs,
            "sultan_index": 0,
            "gem_costs": gem_costs,
            "gem_index": 0,
            "mosques": {
                "small": {"red": True, "green": True, "rubies": mosque_rubies},
                "great": {"yellow": True, "blue": True, "rubies": mosque_rubies},
            },
            "wainwright_ruby": True,
            "npc": npc_positions,
            "encounters": [],
            "pending": None,
            "final_round": {"active": False, "triggered_by": None},
            "rubies_to_win": rubies_to_win,
            "winner": [],
            "game_over": False,
            "game_start_time": int(time.time()),
        }
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        pending = state.get("pending")
        if pending:
            ptype = pending.get("type")
            if ptype == "reward":
                return ["choose_reward"]
            if ptype == "governor":
                return ["governor_choice"]
            if ptype == "smuggler":
                return ["smuggler_choice"]
            if ptype == "dice":
                return ["dice_modify"]
            if ptype == "caravan_discard":
                return ["discard_bonus"]
            return []

        if player_id != state.get("current_player"):
            return []

        actions: List[str] = []
        phase = state.get("phase")
        if phase == "movement":
            actions.append("move")
            if state["players"][player_id]["bonus_hand"]:
                actions.append("play_bonus")
        elif phase == "assistant":
            actions.append("assistant")
            if state["players"][player_id]["bonus_hand"]:
                actions.append("play_bonus")
        elif phase == "action":
            actions.append("location_action")
            if state["players"][player_id]["bonus_hand"]:
                actions.append("play_bonus")
        elif phase == "encounters":
            pass
        if phase in ("movement", "assistant", "action"):
            if state["players"][player_id]["mosque_tiles"].get("red") and state["players"][player_id]["lira"] >= 2:
                if state["players"][player_id]["assistants_on_board"]:
                    actions.append("mosque_return_assistant")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if state.get("game_over"):
            return [], "game over"

        action_type = action.get("type")
        events: List[Dict] = []

        pending = state.get("pending")
        if pending:
            ptype = pending.get("type")
            if ptype == "reward":
                if action_type != "choose_reward":
                    return [], "reward choice required"
                choice = action.get("choice")
                target = pending.get("target")
                state["pending"] = None
                if target in state["players"]:
                    police_pos = _tile_by_place(state["board"], 12)["pos"]
                    state["players"][target]["family_pos"] = police_pos
                    if state["players"][target]["mosque_tiles"].get("yellow"):
                        state["players"][target]["lira"] += 2
                if choice == "card":
                    drawn = _draw_bonus(state, 1)
                    state["players"][player_id]["bonus_hand"].extend(drawn)
                elif choice == "lira":
                    state["players"][player_id]["lira"] += 3
                else:
                    return [], "invalid reward choice"
                _advance_encounter(state)
                return events, None

            if ptype == "governor":
                if action_type != "governor_choice":
                    return [], "governor choice required"
                take = bool(action.get("take"))
                state["pending"] = None
                if take:
                    drawn = _draw_bonus(state, 1)
                    state["players"][player_id]["bonus_hand"].extend(drawn)
                    payment = action.get("payment")
                    if payment == "lira":
                        if state["players"][player_id]["lira"] < 2:
                            return [], "not enough lira"
                        state["players"][player_id]["lira"] -= 2
                    elif isinstance(payment, str):
                        hand = state["players"][player_id]["bonus_hand"]
                        card = next((c for c in hand if c["uid"] == payment), None)
                        if not card:
                            return [], "invalid discard"
                        hand.remove(card)
                        state["bonus_discard"].append(card)
                    else:
                        return [], "payment required"
                    roll = _roll_2d6()
                    if _can_use_green(state, player_id):
                        state["pending"] = {
                            "type": "dice",
                            "roll": roll,
                            "context": {"type": "npc_move", "npc": "governor"},
                        }
                        return events, None
                    _move_npc(state, "governor", roll)
                _advance_encounter(state)
                return events, None

            if ptype == "smuggler":
                if action_type != "smuggler_choice":
                    return [], "smuggler choice required"
                take = bool(action.get("take"))
                state["pending"] = None
                if take:
                    gain_color = action.get("good")
                    if gain_color not in GOODS:
                        return [], "invalid good"
                    payment = action.get("payment")
                    if payment == "lira":
                        if state["players"][player_id]["lira"] < 2:
                            return [], "not enough lira"
                        state["players"][player_id]["lira"] -= 2
                    elif isinstance(payment, str) and payment in GOODS:
                        if state["players"][player_id]["goods"].get(payment, 0) <= 0:
                            return [], "not enough goods"
                        state["players"][player_id]["goods"][payment] -= 1
                    else:
                        return [], "payment required"
                    _apply_goods_gain(
                        state["players"][player_id]["goods"],
                        gain_color,
                        1,
                        state["players"][player_id]["capacity"],
                    )
                    roll = _roll_2d6()
                    if _can_use_green(state, player_id):
                        state["pending"] = {
                            "type": "dice",
                            "roll": roll,
                            "context": {"type": "npc_move", "npc": "smuggler"},
                        }
                        return events, None
                    _move_npc(state, "smuggler", roll)
                _advance_encounter(state)
                return events, None

            if ptype == "dice":
                if action_type != "dice_modify":
                    return [], "dice modify required"
                choice = action.get("choice")
                roll = int(pending.get("roll", 0))
                if choice == "accept":
                    final_roll = roll
                elif choice == "reroll":
                    if not _can_use_green(state, player_id):
                        return [], "cannot reroll"
                    state["players"][player_id]["lira"] -= 2
                    final_roll = _roll_2d6()
                elif choice == "plus_one":
                    if not _can_use_green(state, player_id):
                        return [], "cannot modify"
                    state["players"][player_id]["lira"] -= 2
                    final_roll = min(12, roll + 1)
                else:
                    return [], "invalid dice choice"
                context = pending.get("context", {})
                state["pending"] = None
                _resolve_dice_context(state, player_id, context, final_roll)
                return events, None

            if ptype == "caravan_discard":
                if action_type != "discard_bonus":
                    return [], "discard required"
                card_id = action.get("card_id")
                hand = state["players"][player_id]["bonus_hand"]
                card = next((c for c in hand if c["uid"] == card_id), None)
                if not card:
                    return [], "invalid discard"
                hand.remove(card)
                state["bonus_discard"].append(card)
                state["pending"] = None
                _enter_encounters(state)
                return events, None

        if player_id != state.get("current_player"):
            return [], "not your turn"

        phase = state.get("phase")
        if action_type == "mosque_return_assistant":
            if phase not in ("movement", "assistant", "action"):
                return [], "cannot return assistant now"
            pdata = state["players"][player_id]
            if not pdata["mosque_tiles"].get("red"):
                return [], "red mosque tile required"
            if pdata["lira"] < 2:
                return [], "not enough lira"
            pos = action.get("assistant_pos")
            if pos not in pdata["assistants_on_board"]:
                return [], "invalid assistant"
            pdata["assistants_on_board"].remove(pos)
            pdata["assistants_in_stack"] += 1
            pdata["lira"] -= 2
            return events, None
        if phase == "movement":
            if action_type == "play_bonus":
                err = _play_bonus(state, player_id, action)
                if err:
                    return [], err
                return events, None
            if action_type != "move":
                return [], "must move"
            path = action.get("path")
            if path is None:
                path = []
            if not isinstance(path, list) or any(not isinstance(p, int) for p in path):
                return [], "invalid path"
            start_pos = state["players"][player_id]["merchant_pos"]
            mode = state.get("movement_mode", "normal")
            min_steps, max_steps = (1, 2)
            if mode == "long":
                min_steps, max_steps = (3, 4)
            if mode == "stay":
                min_steps, max_steps = (0, 0)
            steps = len(path)
            if steps < min_steps or steps > max_steps:
                return [], "invalid movement length"
            current = start_pos
            for step in path:
                if step not in state["neighbors"].get(current, []):
                    return [], "invalid movement path"
                current = step
            dest = current
            if steps >= 2 and dest == start_pos:
                return [], "cannot return to start"
            state["players"][player_id]["merchant_pos"] = dest

            if _tile_by_place(state["board"], 7)["pos"] != dest:
                merchants = _merchant_positions(state).get(dest, [])
                payees = [pid for pid in merchants if pid != player_id]
                if payees:
                    total = 2 * len(payees)
                    if state["players"][player_id]["lira"] < total:
                        _end_turn(state)
                        return events, None
                    state["players"][player_id]["lira"] -= total
                    for pid in payees:
                        state["players"][pid]["lira"] += 2

            location = state["players"][player_id]["merchant_pos"]
            assistants = state["players"][player_id]["assistants_on_board"]
            in_stack = state["players"][player_id]["assistants_in_stack"]
            has_here = location in assistants
            can_drop = in_stack > 0 and not has_here
            can_pick = has_here
            if not can_drop and not can_pick and _tile_by_place(state["board"], 7)["pos"] != location:
                _enter_encounters(state)
                return events, None
            state["phase"] = "assistant"
            return events, None

        if phase == "assistant":
            if action_type == "play_bonus":
                err = _play_bonus(state, player_id, action)
                if err:
                    return [], err
                return events, None
            if action_type != "assistant":
                return [], "assistant action required"
            mode = action.get("mode")
            location = state["players"][player_id]["merchant_pos"]
            assistants = state["players"][player_id]["assistants_on_board"]
            in_stack = state["players"][player_id]["assistants_in_stack"]
            has_here = location in assistants
            can_drop = in_stack > 0 and not has_here
            can_pick = has_here
            if mode == "drop":
                if not can_drop:
                    return [], "cannot drop"
                assistants.append(location)
                state["players"][player_id]["assistants_in_stack"] -= 1
            elif mode == "pickup":
                if not can_pick:
                    return [], "cannot pick up"
                assistants.remove(location)
                state["players"][player_id]["assistants_in_stack"] += 1
            elif mode == "none":
                if _tile_by_place(state["board"], 7)["pos"] != location:
                    return [], "cannot skip assistant"
            else:
                return [], "invalid assistant mode"
            state["phase"] = "action"
            return events, None

        if phase == "action":
            if action_type == "play_bonus":
                err = _play_bonus(state, player_id, action)
                if err:
                    return [], err
                return events, None
            if action_type != "location_action":
                return [], "location action required"
            err = _handle_location_action(state, player_id, action)
            if err:
                return [], err
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        for pid in state["turn_order"]:
            pdata = state["players"][pid]
            meta = state["player_meta"].get(pid, {})
            entry = {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "lira": pdata["lira"],
                "rubies": pdata["rubies"],
                "goods": dict(pdata["goods"]),
                "capacity": pdata["capacity"],
                "assistants_in_stack": pdata["assistants_in_stack"],
                "assistants_on_board": list(pdata["assistants_on_board"]),
                "merchant_pos": pdata["merchant_pos"],
                "family_pos": pdata["family_pos"],
                "mosque_tiles": dict(pdata["mosque_tiles"]),
                "bonus_count": len(pdata["bonus_hand"]),
            }
            if pid == viewer_id:
                entry["bonus_hand"] = list(pdata["bonus_hand"])
            players_view.append(entry)

        def current_tile(deck: List[Dict]) -> Optional[Dict]:
            if not deck:
                return None
            return dict(deck[0])

        return {
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_player": state.get("current_player"),
            "movement_mode": state.get("movement_mode"),
            "players": players_view,
            "board": list(state["board"]),
            "npc": dict(state["npc"]),
            "market_small": {
                "current": current_tile(state["market_small"]),
                "remaining": len(state["market_small"]),
            },
            "market_large": {
                "current": current_tile(state["market_large"]),
                "remaining": len(state["market_large"]),
            },
            "market_revenue": state["market_revenue"],
            "post_office_rows": list(state["post_office_rows"]),
            "post_office_index": state.get("post_office_index"),
            "sultan_costs": list(state["sultan_costs"]),
            "sultan_index": state.get("sultan_index"),
            "gem_costs": list(state["gem_costs"]),
            "gem_index": state.get("gem_index"),
            "mosques": state["mosques"],
            "wainwright_ruby": state.get("wainwright_ruby"),
            "bonus_deck_remaining": len(state["bonus_deck"]),
            "bonus_discard_count": len(state["bonus_discard"]),
            "pending": state.get("pending"),
            "small_market_wild": state.get("small_market_wild") == viewer_id,
            "final_round": dict(state["final_round"]),
            "rubies_to_win": state.get("rubies_to_win"),
            "winner": list(state.get("winner", [])),
            "game_over": state.get("game_over", False),
            "legal_actions": IstanbulGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload


# Helper functions that depend on state


def _can_use_green(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    return pdata["mosque_tiles"].get("green") and pdata["lira"] >= 2


def _move_npc(state: Dict, npc: str, roll: int) -> None:
    pos = _resolve_dice_target(state, roll)
    state["npc"][npc] = pos


def _resolve_dice_context(state: Dict, player_id: str, context: Dict, roll: int) -> None:
    ctype = context.get("type")
    if ctype == "black_market":
        blue_gain = 0
        if roll >= 11:
            blue_gain = 3
        elif roll >= 9:
            blue_gain = 2
        elif roll >= 7:
            blue_gain = 1
        _apply_goods_gain(state["players"][player_id]["goods"], "blue", blue_gain, state["players"][player_id]["capacity"])
        _enter_encounters(state)
        return
    if ctype == "tea_house":
        target = int(context.get("target", 0))
        if roll >= target:
            state["players"][player_id]["lira"] += target
        else:
            state["players"][player_id]["lira"] += 2
        _enter_encounters(state)
        return
    if ctype == "npc_move":
        npc = context.get("npc")
        if npc in ("governor", "smuggler"):
            _move_npc(state, npc, roll)
        _advance_encounter(state)
        return


def _play_bonus(state: Dict, player_id: str, action: Dict) -> Optional[str]:
    card_id = action.get("card_id")
    hand = state["players"][player_id]["bonus_hand"]
    card = next((c for c in hand if c["uid"] == card_id), None)
    if not card:
        return "bonus card not found"
    kind = card.get("kind")
    if kind not in BONUS_TYPES:
        return "invalid bonus card"

    phase = state.get("phase")
    location = state["players"][player_id]["merchant_pos"]
    place_id = next((t["place_id"] for t in state["board"] if t["pos"] == location), None)

    if kind == "BC_NO_MOVE":
        if phase != "movement":
            return "no-move only before movement"
        state["movement_mode"] = "stay"
    elif kind == "BC_MOVE_3_4":
        if phase != "movement":
            return "move-3-4 only before movement"
        state["movement_mode"] = "long"
    elif kind == "BC_RETURN_ASSISTANT":
        if phase != "movement":
            return "return assistant only before movement"
        pos = action.get("assistant_pos")
        if pos not in state["players"][player_id]["assistants_on_board"]:
            return "invalid assistant"
        state["players"][player_id]["assistants_on_board"].remove(pos)
        state["players"][player_id]["assistants_in_stack"] += 1
    elif kind == "BC_GOOD":
        if phase not in ("movement", "assistant", "action"):
            return "cannot play now"
        good = action.get("good")
        if good not in GOODS:
            return "invalid good"
        _apply_goods_gain(state["players"][player_id]["goods"], good, 1, state["players"][player_id]["capacity"])
    elif kind == "BC_LIRA5":
        if phase not in ("movement", "assistant", "action"):
            return "cannot play now"
        state["players"][player_id]["lira"] += 5
    elif kind == "BC_SULTAN_2X":
        if phase != "action" or place_id != 13:
            return "must be at Sultan's Palace"
        state["action_repeat"] = "sultan"
    elif kind == "BC_POST_2X":
        if phase != "action" or place_id != 5:
            return "must be at Post Office"
        state["action_repeat"] = "post"
    elif kind == "BC_GEM_2X":
        if phase != "action" or place_id != 14:
            return "must be at Gemstone Dealer"
        state["action_repeat"] = "gem"
    elif kind == "BC_FAMILY_POLICE_REWARD":
        police_pos = _tile_by_place(state["board"], 12)["pos"]
        if state["players"][player_id]["family_pos"] == police_pos:
            return "family already at police station"
        choice = action.get("choice")
        if choice not in ("card", "lira"):
            return "reward choice required"
        state["players"][player_id]["family_pos"] = police_pos
        if state["players"][player_id]["mosque_tiles"].get("yellow"):
            state["players"][player_id]["lira"] += 2
        if choice == "card":
            drawn = _draw_bonus(state, 1)
            state["players"][player_id]["bonus_hand"].extend(drawn)
        else:
            state["players"][player_id]["lira"] += 3
    elif kind == "BC_SMALL_MARKET_WILD":
        if phase != "action" or place_id != 11:
            return "must be at Small Market"
        state["small_market_wild"] = player_id
    else:
        return "unsupported bonus card"

    hand.remove(card)
    state["bonus_discard"].append(card)
    return None


def _handle_location_action(state: Dict, player_id: str, action: Dict) -> Optional[str]:
    location = state["players"][player_id]["merchant_pos"]
    tile = next((t for t in state["board"] if t["pos"] == location), None)
    if not tile:
        return "invalid location"
    place_id = tile["place_id"]
    place_type = tile["type"]

    repeat = state.get("action_repeat")
    state["action_repeat"] = None

    if place_type == "wainwright":
        if state["players"][player_id]["capacity"] >= 5:
            return "capacity maxed"
        if state["players"][player_id]["lira"] < 7:
            return "not enough lira"
        state["players"][player_id]["lira"] -= 7
        state["players"][player_id]["capacity"] += 1
        if state["players"][player_id]["capacity"] >= 5 and state["wainwright_ruby"]:
            state["players"][player_id]["rubies"] += 1
            state["wainwright_ruby"] = False
        _enter_encounters(state)
        return None

    if place_type == "warehouse":
        good = tile.get("good")
        state["players"][player_id]["goods"][good] = state["players"][player_id]["capacity"]
        _enter_encounters(state)
        return None

    if place_type == "post_office":
        rows = state["post_office_rows"]
        idx = state["post_office_index"]
        if idx < 0 or idx >= len(rows):
            idx = 0
        for item in rows[idx]:
            if item.startswith("coin"):
                value = int(item.replace("coin", ""))
                state["players"][player_id]["lira"] += value
            else:
                _apply_goods_gain(state["players"][player_id]["goods"], item, 1, state["players"][player_id]["capacity"])
        idx = (idx + 1) % len(rows)
        state["post_office_index"] = idx
        if repeat == "post":
            # perform second time if possible
            for item in rows[idx]:
                if item.startswith("coin"):
                    value = int(item.replace("coin", ""))
                    state["players"][player_id]["lira"] += value
                else:
                    _apply_goods_gain(state["players"][player_id]["goods"], item, 1, state["players"][player_id]["capacity"])
            state["post_office_index"] = (idx + 1) % len(rows)
        _enter_encounters(state)
        return None

    if place_type == "caravansary":
        drawn = _draw_bonus(state, 2)
        state["players"][player_id]["bonus_hand"].extend(drawn)
        state["pending"] = {"type": "caravan_discard"}
        return None

    if place_type == "fountain":
        picks = action.get("return_assistants")
        assistants = state["players"][player_id]["assistants_on_board"]
        if picks is None:
            picks = list(assistants)
        if not isinstance(picks, list) or any(p not in assistants for p in picks):
            return "invalid assistants"
        for pos in list(picks):
            assistants.remove(pos)
            state["players"][player_id]["assistants_in_stack"] += 1
        _enter_encounters(state)
        return None

    if place_type == "black_market":
        good = action.get("good")
        if good not in ("red", "green", "yellow"):
            return "invalid good"
        _apply_goods_gain(state["players"][player_id]["goods"], good, 1, state["players"][player_id]["capacity"])
        roll = _roll_2d6()
        if _can_use_green(state, player_id):
            state["pending"] = {
                "type": "dice",
                "roll": roll,
                "context": {"type": "black_market"},
            }
            return None
        _resolve_dice_context(state, player_id, {"type": "black_market"}, roll)
        return None

    if place_type == "tea_house":
        target = action.get("target")
        if not isinstance(target, int) or target < 3 or target > 12:
            return "invalid target"
        roll = _roll_2d6()
        if _can_use_green(state, player_id):
            state["pending"] = {
                "type": "dice",
                "roll": roll,
                "context": {"type": "tea_house", "target": target},
            }
            return None
        _resolve_dice_context(state, player_id, {"type": "tea_house", "target": target}, roll)
        return None

    if place_type in ("market_large", "market_small"):
        deck_key = "market_large" if place_type == "market_large" else "market_small"
        deck = state[deck_key]
        if not deck:
            return "no market tiles"
        tile_def = deck[0]
        goods_to_sell = action.get("goods")
        if not isinstance(goods_to_sell, dict):
            return "goods required"
        goods_to_sell = _clone_goods(goods_to_sell)
        total_sell = _goods_total(goods_to_sell)
        if total_sell <= 0 or total_sell > 5:
            return "invalid sell count"
        if state.get("small_market_wild") == player_id and place_type == "market_small":
            pass
        else:
            required = tile_def["goods"]
            for color in GOODS:
                if goods_to_sell.get(color, 0) > required.get(color, 0):
                    return "goods not matching tile"
        if not _goods_can_pay(state["players"][player_id]["goods"], goods_to_sell):
            return "insufficient goods"
        _goods_apply_cost(state["players"][player_id]["goods"], goods_to_sell)
        revenue_table = state["market_revenue"]["large" if place_type == "market_large" else "small"]
        state["players"][player_id]["lira"] += revenue_table.get(total_sell, 0)
        deck.append(deck.pop(0))
        state["small_market_wild"] = None
        _enter_encounters(state)
        return None

    if place_type == "police_station":
        police_pos = tile["pos"]
        if state["players"][player_id]["family_pos"] != police_pos:
            _enter_encounters(state)
            return None
        dest = action.get("destination")
        if not isinstance(dest, int) or dest < 0 or dest >= len(state["board"]):
            return "invalid destination"
        state["players"][player_id]["family_pos"] = dest
        # family action uses same rules as location action, without encounters
        target_tile = next((t for t in state["board"] if t["pos"] == dest), None)
        if not target_tile:
            return "invalid destination"
        err = _handle_family_action(state, player_id, target_tile, action)
        if err:
            return err
        _enter_encounters(state)
        return None

    if place_type == "sultan_palace":
        costs = state["sultan_costs"]
        idx = state["sultan_index"]
        if idx >= len(costs):
            return "no rubies left"
        times = 2 if repeat == "sultan" else 1
        for _ in range(times):
            if idx >= len(costs):
                break
            cost = costs[idx]
            any_count = cost.get("any", 0)
            base_cost = {color: cost.get(color, 0) for color in GOODS}
            payment = _pay_any_goods(state["players"][player_id], base_cost, any_count)
            if not payment:
                if idx == state["sultan_index"]:
                    return "cannot afford"
                break
            _goods_apply_cost(state["players"][player_id]["goods"], payment)
            state["players"][player_id]["rubies"] += 1
            idx += 1
        state["sultan_index"] = idx
        _enter_encounters(state)
        return None

    if place_type == "gemstone_dealer":
        costs = state["gem_costs"]
        idx = state["gem_index"]
        if idx >= len(costs):
            return "no rubies left"
        times = 2 if repeat == "gem" else 1
        for _ in range(times):
            if idx >= len(costs):
                break
            cost = costs[idx]
            if state["players"][player_id]["lira"] < cost:
                if idx == state["gem_index"]:
                    return "not enough lira"
                break
            state["players"][player_id]["lira"] -= cost
            state["players"][player_id]["rubies"] += 1
            idx += 1
        state["gem_index"] = idx
        _enter_encounters(state)
        return None

    if place_type in ("small_mosque", "great_mosque"):
        color = action.get("color")
        if place_type == "small_mosque" and color not in ("red", "green"):
            return "invalid mosque tile"
        if place_type == "great_mosque" and color not in ("yellow", "blue"):
            return "invalid mosque tile"
        if state["players"][player_id]["goods"].get(color, 0) <= 0:
            return "not enough goods"
        mosque_key = "small" if place_type == "small_mosque" else "great"
        if not state["mosques"][mosque_key].get(color):
            return "tile not available"
        state["players"][player_id]["goods"][color] -= 1
        state["mosques"][mosque_key][color] = False
        state["players"][player_id]["mosque_tiles"][color] = True
        if mosque_key == "small":
            if state["players"][player_id]["mosque_tiles"].get("red") and state["players"][player_id]["mosque_tiles"].get("green"):
                if state["mosques"][mosque_key]["rubies"] > 0:
                    state["players"][player_id]["rubies"] += 1
                    state["mosques"][mosque_key]["rubies"] -= 1
        else:
            if state["players"][player_id]["mosque_tiles"].get("yellow") and state["players"][player_id]["mosque_tiles"].get("blue"):
                if state["mosques"][mosque_key]["rubies"] > 0:
                    state["players"][player_id]["rubies"] += 1
                    state["mosques"][mosque_key]["rubies"] -= 1
            if color == "blue" and _assistant_count(state, player_id) < 5:
                state["players"][player_id]["assistants_in_stack"] += 1
        _enter_encounters(state)
        return None

    return "unknown location"


def _handle_family_action(state: Dict, player_id: str, tile: Dict, action: Dict) -> Optional[str]:
    place_type = tile["type"]
    if place_type == "fountain":
        picks = action.get("return_assistants")
        assistants = state["players"][player_id]["assistants_on_board"]
        if picks is None:
            picks = list(assistants)
        if not isinstance(picks, list) or any(p not in assistants for p in picks):
            return "invalid assistants"
        for pos in list(picks):
            assistants.remove(pos)
            state["players"][player_id]["assistants_in_stack"] += 1
        return None
    if place_type == "warehouse":
        good = tile.get("good")
        state["players"][player_id]["goods"][good] = state["players"][player_id]["capacity"]
        return None
    if place_type == "post_office":
        rows = state["post_office_rows"]
        idx = state["post_office_index"]
        if idx < 0 or idx >= len(rows):
            idx = 0
        for item in rows[idx]:
            if item.startswith("coin"):
                value = int(item.replace("coin", ""))
                state["players"][player_id]["lira"] += value
            else:
                _apply_goods_gain(state["players"][player_id]["goods"], item, 1, state["players"][player_id]["capacity"])
        state["post_office_index"] = (idx + 1) % len(rows)
        return None
    if place_type == "caravansary":
        drawn = _draw_bonus(state, 2)
        state["players"][player_id]["bonus_hand"].extend(drawn)
        return None
    if place_type == "black_market":
        good = action.get("good")
        if good not in ("red", "green", "yellow"):
            return "invalid good"
        _apply_goods_gain(state["players"][player_id]["goods"], good, 1, state["players"][player_id]["capacity"])
        roll = _roll_2d6()
        blue_gain = 0
        if roll >= 11:
            blue_gain = 3
        elif roll >= 9:
            blue_gain = 2
        elif roll >= 7:
            blue_gain = 1
        _apply_goods_gain(state["players"][player_id]["goods"], "blue", blue_gain, state["players"][player_id]["capacity"])
        return None
    if place_type == "tea_house":
        target = action.get("target")
        if not isinstance(target, int) or target < 3 or target > 12:
            return "invalid target"
        roll = _roll_2d6()
        if roll >= target:
            state["players"][player_id]["lira"] += target
        else:
            state["players"][player_id]["lira"] += 2
        return None
    if place_type in ("market_large", "market_small"):
        deck_key = "market_large" if place_type == "market_large" else "market_small"
        deck = state[deck_key]
        if not deck:
            return "no market tiles"
        tile_def = deck[0]
        goods_to_sell = action.get("goods")
        if not isinstance(goods_to_sell, dict):
            return "goods required"
        goods_to_sell = _clone_goods(goods_to_sell)
        total_sell = _goods_total(goods_to_sell)
        if total_sell <= 0 or total_sell > 5:
            return "invalid sell count"
        required = tile_def["goods"]
        for color in GOODS:
            if goods_to_sell.get(color, 0) > required.get(color, 0):
                return "goods not matching tile"
        if not _goods_can_pay(state["players"][player_id]["goods"], goods_to_sell):
            return "insufficient goods"
        _goods_apply_cost(state["players"][player_id]["goods"], goods_to_sell)
        revenue_table = state["market_revenue"]["large" if place_type == "market_large" else "small"]
        state["players"][player_id]["lira"] += revenue_table.get(total_sell, 0)
        deck.append(deck.pop(0))
        return None
    if place_type == "sultan_palace":
        costs = state["sultan_costs"]
        idx = state["sultan_index"]
        if idx >= len(costs):
            return "no rubies left"
        cost = costs[idx]
        any_count = cost.get("any", 0)
        base_cost = {color: cost.get(color, 0) for color in GOODS}
        payment = _pay_any_goods(state["players"][player_id], base_cost, any_count)
        if not payment:
            return "cannot afford"
        _goods_apply_cost(state["players"][player_id]["goods"], payment)
        state["players"][player_id]["rubies"] += 1
        state["sultan_index"] = idx + 1
        return None
    if place_type == "gemstone_dealer":
        costs = state["gem_costs"]
        idx = state["gem_index"]
        if idx >= len(costs):
            return "no rubies left"
        cost = costs[idx]
        if state["players"][player_id]["lira"] < cost:
            return "not enough lira"
        state["players"][player_id]["lira"] -= cost
        state["players"][player_id]["rubies"] += 1
        state["gem_index"] = idx + 1
        return None
    if place_type in ("small_mosque", "great_mosque"):
        color = action.get("color")
        if place_type == "small_mosque" and color not in ("red", "green"):
            return "invalid mosque tile"
        if place_type == "great_mosque" and color not in ("yellow", "blue"):
            return "invalid mosque tile"
        if state["players"][player_id]["goods"].get(color, 0) <= 0:
            return "not enough goods"
        mosque_key = "small" if place_type == "small_mosque" else "great"
        if not state["mosques"][mosque_key].get(color):
            return "tile not available"
        state["players"][player_id]["goods"][color] -= 1
        state["mosques"][mosque_key][color] = False
        state["players"][player_id]["mosque_tiles"][color] = True
        if mosque_key == "small":
            if state["players"][player_id]["mosque_tiles"].get("red") and state["players"][player_id]["mosque_tiles"].get("green"):
                if state["mosques"][mosque_key]["rubies"] > 0:
                    state["players"][player_id]["rubies"] += 1
                    state["mosques"][mosque_key]["rubies"] -= 1
        else:
            if state["players"][player_id]["mosque_tiles"].get("yellow") and state["players"][player_id]["mosque_tiles"].get("blue"):
                if state["mosques"][mosque_key]["rubies"] > 0:
                    state["players"][player_id]["rubies"] += 1
                    state["mosques"][mosque_key]["rubies"] -= 1
            if color == "blue" and _assistant_count(state, player_id) < 5:
                state["players"][player_id]["assistants_in_stack"] += 1
        return None
    if place_type == "wainwright":
        if state["players"][player_id]["capacity"] >= 5:
            return "capacity maxed"
        if state["players"][player_id]["lira"] < 7:
            return "not enough lira"
        state["players"][player_id]["lira"] -= 7
        state["players"][player_id]["capacity"] += 1
        if state["players"][player_id]["capacity"] >= 5 and state["wainwright_ruby"]:
            state["players"][player_id]["rubies"] += 1
            state["wainwright_ruby"] = False
        return None
    return "unsupported family action"
