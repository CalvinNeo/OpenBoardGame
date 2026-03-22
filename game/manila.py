import json
import math
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ASSET_PATH = Path(__file__).resolve().parent / "assets" / "manila.json"


def _load_assets() -> Dict:
    with ASSET_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


ASSETS = _load_assets()
CARGO_LIST = list(ASSETS.get("cargo_list", []))
CARGO_DATA = ASSETS.get("cargo", {})
BOARD_DATA = ASSETS.get("board", {})
PRICE_TRACK = ASSETS.get("price_track", [0, 5, 10, 20, 30])

DEFAULT_CONFIG: Dict = {
    "starting_cash": 30,
    "initial_stocks": 2,
    "loan_amount": 12,
    "loan_repay": 15,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_stock_deck() -> List[str]:
    deck: List[str] = []
    for cargo_id in CARGO_LIST:
        deck.extend([cargo_id] * 5)
    random.shuffle(deck)
    return deck


def _init_player_state(cfg: Dict, player_ids: List[str], player_meta: Dict) -> Dict:
    workers_total = 4 if len(player_ids) == 3 else 3
    players: Dict[str, Dict] = {}
    for pid in player_ids:
        players[pid] = {
            "cash": cfg["starting_cash"],
            "stocks": {cargo_id: 0 for cargo_id in CARGO_LIST},
            "pledged": {cargo_id: 0 for cargo_id in CARGO_LIST},
            "workers_total": workers_total,
            "workers_available": workers_total,
        }
    return players


def _deal_initial_stocks(state: Dict) -> None:
    deck = state.get("stock_deck", [])
    for pid in state.get("turn_order", []):
        for _ in range(state["config"].get("initial_stocks", 2)):
            if not deck:
                break
            cargo_id = deck.pop()
            state["players"][pid]["stocks"][cargo_id] += 1
            state["stock_bank"][cargo_id] -= 1


def _init_board_state() -> Dict:
    return {
        "port": {"A": None, "B": None, "C": None},
        "shipyard": {"A": None, "B": None, "C": None},
        "pirates": {"captain": None, "pirate": None},
        "pilots": {"small": None, "big": None},
        "insurance": None,
    }


def _init_boat(cargo_id: str, position: int) -> Dict:
    cargo = CARGO_DATA[cargo_id]
    seat_costs = list(cargo.get("seat_costs", []))
    return {
        "cargo": cargo_id,
        "position": position,
        "capacity": len(seat_costs),
        "seat_costs": seat_costs,
        "seats": [None for _ in seat_costs],
        "total_value": int(cargo.get("total_value", 0)),
        "plundered": False,
        "plunderer": None,
        "skip_roll": False,
        "arrived_by_pilot": False,
        "safe_from_pirates": False,
        "last_roll": None,
    }


def _start_auction(state: Dict) -> None:
    order = state.get("turn_order", [])
    if not order:
        return
    start_pid = state.get("auction_start")
    if start_pid not in order:
        start_pid = order[0]
    state["phase"] = "auction"
    state["auction"] = {
        "active": list(order),
        "highest_bid": 0,
        "leader": None,
        "start_player": start_pid,
        "bids": {pid: 0 for pid in order},
    }
    state["current_player"] = start_pid


def _advance_player(state: Dict, current: str) -> str:
    order = state.get("turn_order", [])
    if not order:
        return current
    if current not in order:
        return order[0]
    idx = order.index(current)
    return order[(idx + 1) % len(order)]


def _advance_auction_turn(state: Dict) -> None:
    auction = state.get("auction", {})
    active = auction.get("active", [])
    if not active:
        return
    next_pid = _advance_player(state, state.get("current_player"))
    while next_pid not in active:
        next_pid = _advance_player(state, next_pid)
    state["current_player"] = next_pid


def _set_harbormaster(state: Dict, player_id: str) -> None:
    state["harbormaster"] = player_id
    bid = state.get("auction", {}).get("highest_bid", 0)
    state["harbormaster_bid"] = bid
    if state["players"][player_id]["cash"] >= bid:
        _pay_cash(state, player_id, bid)
        state["phase"] = "harbormaster_buy"
    else:
        state["phase"] = "harbormaster_pay"
    state["current_player"] = player_id


def _price_for_cargo(state: Dict, cargo_id: str) -> int:
    price = state.get("price_track", {}).get(cargo_id, 0)
    if price <= 0:
        return 5
    return price


def _ensure_cash(state: Dict, player_id: str, amount: int) -> bool:
    return state["players"][player_id]["cash"] >= amount


def _pay_cash(state: Dict, player_id: str, amount: int) -> None:
    state["players"][player_id]["cash"] -= amount


def _gain_cash(state: Dict, player_id: str, amount: int) -> None:
    state["players"][player_id]["cash"] += amount


def _auto_pledge_one(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    available = []
    for cargo_id in CARGO_LIST:
        if pdata["stocks"].get(cargo_id, 0) > 0:
            price = int(state.get("price_track", {}).get(cargo_id, 0))
            available.append((price, CARGO_LIST.index(cargo_id), cargo_id))
    if not available:
        return False
    available.sort()
    _, _, cargo_id = available[0]
    pdata["stocks"][cargo_id] -= 1
    pdata["pledged"][cargo_id] += 1
    _gain_cash(state, player_id, state["config"].get("loan_amount", 12))
    return True


def _force_pay(state: Dict, player_id: str, amount: int) -> None:
    while state["players"][player_id]["cash"] < amount:
        if not _auto_pledge_one(state, player_id):
            break
    _pay_cash(state, player_id, amount)


def _place_worker(state: Dict, player_id: str, cost: int) -> Optional[str]:
    pdata = state["players"][player_id]
    if pdata.get("workers_available", 0) <= 0:
        return "no workers"
    if not _ensure_cash(state, player_id, cost):
        return "insufficient cash"
    _pay_cash(state, player_id, cost)
    pdata["workers_available"] -= 1
    return None


def _reset_workers(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["workers_available"] = pdata.get("workers_total", 0)


def _setup_round(state: Dict) -> None:
    state["cargo_slots"] = []
    state["boats"] = {}
    state["board"] = _init_board_state()
    state["placement_round"] = 1
    state["placement_acted"] = []
    state["pirate_targets"] = []
    state["pirate_pending"] = []
    state["pending_pilots"] = []


def _start_placement_round(state: Dict) -> None:
    state["phase"] = "placement"
    state["placement_acted"] = []
    state["current_player"] = state.get("harbormaster")


def _roll_and_move(state: Dict) -> List[str]:
    pirate_targets: List[str] = []
    for cargo_id, boat in state.get("boats", {}).items():
        if boat.get("skip_roll") or boat.get("plundered"):
            continue
        if int(boat.get("position", 0)) >= 13:
            boat["skip_roll"] = True
            continue
        roll = random.randint(1, 6)
        boat["last_roll"] = roll
        pos = int(boat.get("position", 0))
        new_pos = pos + roll
        exact_hit = new_pos == 13
        overshoot = new_pos > 13
        boat["position"] = 13 if new_pos >= 13 else new_pos
        if new_pos >= 13:
            boat["skip_roll"] = True
        boat["exact_hit"] = exact_hit
        boat["overshoot"] = overshoot
        if exact_hit and not boat.get("safe_from_pirates"):
            pirate_targets.append(cargo_id)
    return pirate_targets


def _maybe_start_pilot_phase(state: Dict) -> bool:
    pilots = state.get("board", {}).get("pilots", {})
    pending: List[str] = []
    if pilots.get("big"):
        pending.append("big")
    if pilots.get("small"):
        pending.append("small")
    if pending:
        state["pending_pilots"] = pending
        state["phase"] = "pilot"
        first = pending[0]
        state["current_player"] = pilots.get(first)
        return True
    return False


def _maybe_start_pirate_phase(state: Dict, targets: List[str]) -> bool:
    if not targets:
        return False
    pirates = state.get("board", {}).get("pirates", {})
    pending: List[str] = []
    if pirates.get("captain"):
        pending.append("captain")
    if pirates.get("pirate"):
        pending.append("pirate")
    if not pending:
        return False
    state["pirate_targets"] = targets
    state["pirate_pending"] = pending
    state["phase"] = "pirate"
    first_role = pending[0]
    state["current_player"] = pirates.get(first_role)
    return True


def _advance_after_movement(state: Dict) -> None:
    round_no = state.get("placement_round", 1)
    if round_no < 3:
        state["placement_round"] = round_no + 1
        _start_placement_round(state)
        return
    _resolve_round(state)


def _resolve_round(state: Dict) -> None:
    cargo_order = state.get("cargo_slots", [])
    port_slots = ["A", "B", "C"]
    shipyard_slots = ["A", "B", "C"]

    successes: List[str] = []
    failures: List[str] = []
    for cargo_id in cargo_order:
        boat = state["boats"].get(cargo_id)
        if not boat:
            continue
        if boat.get("plundered"):
            failures.append(cargo_id)
            continue
        if int(boat.get("position", 0)) >= 13:
            successes.append(cargo_id)
        else:
            failures.append(cargo_id)

    for cargo_id in successes:
        boat = state["boats"][cargo_id]
        _distribute_ship_value(state, boat)

    board = state.get("board", {})
    for idx, cargo_id in enumerate(successes):
        if idx >= len(port_slots):
            break
        slot = port_slots[idx]
        occupant = board.get("port", {}).get(slot)
        payout = BOARD_DATA.get("port", {}).get(slot, {}).get("payout", 0)
        if occupant:
            _gain_cash(state, occupant, payout)

    for idx, cargo_id in enumerate(failures):
        if idx >= len(shipyard_slots):
            break
        slot = shipyard_slots[idx]
        occupant = board.get("shipyard", {}).get(slot)
        payout = BOARD_DATA.get("shipyard", {}).get(slot, {}).get("payout", 0)
        if occupant:
            _gain_cash(state, occupant, payout)

    insurance_holder = board.get("insurance")
    if insurance_holder:
        per_ship = int(BOARD_DATA.get("insurance", {}).get("per_ship_cost", 10))
        _force_pay(state, insurance_holder, per_ship * len(failures))

    for cargo_id in successes:
        _advance_price(state, cargo_id)

    _cleanup_round(state)

    if _check_game_end(state):
        _finalize_game(state)
        return

    state["round"] = state.get("round", 1) + 1
    _setup_round(state)
    if state.get("harbormaster") in state.get("turn_order", []):
        state["auction_start"] = _advance_player(state, state.get("harbormaster"))
    _start_auction(state)


def _cleanup_round(state: Dict) -> None:
    _reset_workers(state)
    state["board"] = _init_board_state()
    state["boats"] = {}
    state["cargo_slots"] = []
    state["placement_round"] = 1
    state["placement_acted"] = []
    state["pirate_targets"] = []
    state["pirate_pending"] = []
    state["pending_pilots"] = []


def _advance_price(state: Dict, cargo_id: str) -> None:
    track = PRICE_TRACK
    current = state.get("price_track", {}).get(cargo_id, 0)
    if current not in track:
        current = track[0]
    idx = track.index(current)
    if idx < len(track) - 1:
        state["price_track"][cargo_id] = track[idx + 1]


def _check_game_end(state: Dict) -> bool:
    for value in state.get("price_track", {}).values():
        if value >= max(PRICE_TRACK):
            return True
    return False


def _finalize_game(state: Dict) -> None:
    scores: Dict[str, int] = {}
    for pid, pdata in state.get("players", {}).items():
        cash = int(pdata.get("cash", 0))
        score = cash
        for cargo_id in CARGO_LIST:
            price = int(state["price_track"].get(cargo_id, 0))
            score += int(pdata["stocks"].get(cargo_id, 0)) * price
            score -= int(pdata["pledged"].get(cargo_id, 0)) * state["config"].get("loan_repay", 15)
        scores[pid] = score
    if scores:
        max_score = max(scores.values())
        winners = [pid for pid, score in scores.items() if score == max_score]
    else:
        winners = []
    state["winner"] = winners
    state["game_over"] = True
    state["phase"] = "game_over"


def _distribute_ship_value(state: Dict, boat: Dict) -> None:
    seats = boat.get("seats", [])
    counts: Dict[str, int] = {}
    for pid in seats:
        if not pid:
            continue
        counts[pid] = counts.get(pid, 0) + 1
    total_workers = sum(counts.values())
    if total_workers <= 0:
        return
    total_value = int(boat.get("total_value", 0))
    for pid, count in counts.items():
        payout = math.ceil(total_value * (count / total_workers))
        _gain_cash(state, pid, payout)


def _player_view(state: Dict, player_id: str, viewer_id: str) -> Dict:
    pdata = state["players"][player_id]
    view = {
        "player_id": player_id,
        "cash": pdata.get("cash", 0),
        "workers_available": pdata.get("workers_available", 0),
        "workers_total": pdata.get("workers_total", 0),
    }
    if player_id == viewer_id:
        view["stocks"] = dict(pdata.get("stocks", {}))
        view["pledged"] = dict(pdata.get("pledged", {}))
    else:
        view["stock_count"] = sum(pdata.get("stocks", {}).values())
        view["pledged_count"] = sum(pdata.get("pledged", {}).values())
    return view


def _bot_total_stock_count(state: Dict, player_id: str) -> int:
    pdata = state.get("players", {}).get(player_id, {})
    return sum(pdata.get("stocks", {}).values())


def _bot_max_bid(state: Dict, player_id: str) -> int:
    cash = int(state["players"][player_id].get("cash", 0))
    loan_amount = int(state.get("config", {}).get("loan_amount", 12))
    return cash + loan_amount * _bot_total_stock_count(state, player_id)


def _bot_choose_pledge_cargo(state: Dict, player_id: str) -> Optional[str]:
    pdata = state["players"][player_id]
    candidates = [cargo_id for cargo_id, count in pdata.get("stocks", {}).items() if count > 0]
    if not candidates:
        return None
    candidates.sort(key=lambda cargo_id: int(state.get("price_track", {}).get(cargo_id, 0)))
    return candidates[0]


def _bot_choose_buy_stock(state: Dict, player_id: str) -> Optional[str]:
    cash = int(state["players"][player_id].get("cash", 0))
    options: List[Tuple[int, str]] = []
    for cargo_id in CARGO_LIST:
        if state.get("stock_bank", {}).get(cargo_id, 0) <= 0:
            continue
        cost = _price_for_cargo(state, cargo_id)
        if cost <= cash:
            options.append((cost, cargo_id))
    if not options:
        return None
    options.sort()
    return options[0][1]


def _bot_choose_cargo_selection() -> List[str]:
    if len(CARGO_LIST) <= 3:
        return list(CARGO_LIST)
    return random.sample(CARGO_LIST, 3)


def _bot_choose_positions() -> List[int]:
    positions = [0, 4, 5]
    random.shuffle(positions)
    return positions


def _bot_choose_placement(state: Dict, player_id: str) -> Optional[Dict]:
    pdata = state["players"][player_id]
    if pdata.get("workers_available", 0) <= 0:
        return {"type": "pass"}
    cash = int(pdata.get("cash", 0))
    board = state.get("board", {})
    options: List[Tuple[float, Dict]] = []

    for cargo_id, boat in state.get("boats", {}).items():
        seats = boat.get("seats", [])
        costs = boat.get("seat_costs", [])
        total_value = int(boat.get("total_value", 0))
        for idx, cost in enumerate(costs):
            if idx >= len(seats) or seats[idx] is not None:
                continue
            if cost > cash:
                continue
            score = (total_value / (cost + 1)) + 2
            options.append(
                (
                    score,
                    {"type": "place_worker", "location": {"type": "ship", "cargo": cargo_id, "seat": idx}},
                )
            )

    for slot in ("A", "B", "C"):
        if board.get("port", {}).get(slot):
            continue
        info = BOARD_DATA.get("port", {}).get(slot, {})
        cost = int(info.get("place_cost", 0))
        payout = int(info.get("payout", 0))
        if cost <= cash:
            options.append(
                (
                    payout - cost + 1,
                    {"type": "place_worker", "location": {"type": "port", "slot": slot}},
                )
            )

    for slot in ("A", "B", "C"):
        if board.get("shipyard", {}).get(slot):
            continue
        info = BOARD_DATA.get("shipyard", {}).get(slot, {})
        cost = int(info.get("place_cost", 0))
        payout = int(info.get("payout", 0))
        if cost <= cash:
            options.append(
                (
                    payout - cost + 0.5,
                    {"type": "place_worker", "location": {"type": "shipyard", "slot": slot}},
                )
            )

    pirates = board.get("pirates", {})
    pirate_cost = int(BOARD_DATA.get("pirates", {}).get("place_cost", 0))
    if pirates.get("captain") is None and pirate_cost <= cash:
        options.append((7.5, {"type": "place_worker", "location": {"type": "pirate", "slot": "captain"}}))
    if pirates.get("pirate") is None and pirate_cost <= cash:
        options.append((6.0, {"type": "place_worker", "location": {"type": "pirate", "slot": "pirate"}}))

    pilots = board.get("pilots", {})
    small_cost = int(BOARD_DATA.get("pilots", {}).get("small_cost", 0))
    big_cost = int(BOARD_DATA.get("pilots", {}).get("big_cost", 0))
    if pilots.get("small") is None and small_cost <= cash:
        options.append((6.0, {"type": "place_worker", "location": {"type": "pilot", "size": "small"}}))
    if pilots.get("big") is None and big_cost <= cash:
        options.append((8.0, {"type": "place_worker", "location": {"type": "pilot", "size": "big"}}))

    if board.get("insurance") is None:
        ins_cost = int(BOARD_DATA.get("insurance", {}).get("place_cost", 0))
        if ins_cost <= cash:
            options.append((5.5, {"type": "place_worker", "location": {"type": "insurance"}}))

    if not options:
        return {"type": "pass"}

    options.sort(key=lambda item: item[0], reverse=True)
    top_score = options[0][0]
    top_options = [action for score, action in options if abs(score - top_score) < 0.01]
    return random.choice(top_options)


def _bot_choose_pilot_action(state: Dict, player_id: str) -> Optional[Dict]:
    pending = state.get("pending_pilots", [])
    board = state.get("board", {})
    size = None
    for entry in pending:
        if board.get("pilots", {}).get(entry) == player_id:
            size = entry
            break
    if not size:
        return None

    boats = [
        (cargo_id, boat)
        for cargo_id, boat in state.get("boats", {}).items()
        if int(boat.get("position", 0)) < 13
    ]
    if not boats:
        return None

    boats.sort(key=lambda item: int(item[1].get("position", 0)), reverse=True)

    if size == "big" and len(boats) >= 2:
        cargo_a = boats[0][0]
        cargo_b = boats[1][0]
        return {
            "type": "pilot_split",
            "size": "big",
            "cargo_a": cargo_a,
            "delta_a": 1,
            "cargo_b": cargo_b,
            "delta_b": 1,
        }

    cargo_id, boat = boats[0]
    pos = int(boat.get("position", 0))
    delta = 1
    if size == "big" and pos <= 11:
        delta = 2
    return {"type": "pilot_move", "size": size, "cargo": cargo_id, "delta": delta}


def _bot_choose_pirate_action(state: Dict, player_id: str) -> Optional[Dict]:
    targets = list(state.get("pirate_targets", []))
    if not targets:
        return {"type": "pirate_action", "mode": "skip"}
    pending = state.get("pirate_pending", [])
    role = pending[0] if pending else None
    if role == "captain":
        best_target = max(targets, key=lambda cargo: int(state["boats"][cargo].get("total_value", 0)))
        return {"type": "pirate_action", "mode": "plunder", "cargo": best_target}

    for cargo_id in targets:
        boat = state["boats"].get(cargo_id)
        if not boat:
            continue
        seats = boat.get("seats", [])
        if any(seat is None for seat in seats):
            return {"type": "pirate_action", "mode": "board", "cargo": cargo_id}
    return {"type": "pirate_action", "mode": "skip"}


class ManilaGame:
    game_id = "manila"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = _init_player_state(cfg, player_ids, player_meta)
        stock_deck = _build_stock_deck()
        stock_bank = {cargo_id: 5 for cargo_id in CARGO_LIST}
        state = {
            "config": cfg,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_player": None,
            "round": 1,
            "phase": "auction",
            "auction": {},
            "harbormaster": None,
            "harbormaster_bid": 0,
            "cargo_slots": [],
            "boats": {},
            "board": _init_board_state(),
            "placement_round": 1,
            "placement_acted": [],
            "price_track": {cargo_id: 0 for cargo_id in CARGO_LIST},
            "stock_deck": stock_deck,
            "stock_bank": stock_bank,
            "pirate_targets": [],
            "pirate_pending": [],
            "pending_pilots": [],
            "winner": [],
            "game_over": False,
        }
        _deal_initial_stocks(state)
        state["auction_start"] = random.choice(player_ids) if player_ids else None
        _start_auction(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]

        phase = state.get("phase")
        if phase == "auction":
            if player_id != state.get("current_player"):
                return []
            return ["bid", "pass_bid", "pledge_stock"]
        if phase == "harbormaster_pay":
            if player_id != state.get("harbormaster"):
                return []
            return ["pledge_stock"]
        if phase == "harbormaster_buy":
            if player_id != state.get("harbormaster"):
                return []
            return ["buy_stock", "skip_buy", "pledge_stock"]
        if phase == "harbormaster_cargo":
            if player_id != state.get("harbormaster"):
                return []
            return ["select_cargo", "pledge_stock"]
        if phase == "harbormaster_position":
            if player_id != state.get("harbormaster"):
                return []
            return ["set_positions", "pledge_stock"]
        if phase == "placement":
            if player_id != state.get("current_player"):
                return []
            return ["place_worker", "pass", "pledge_stock"]
        if phase == "pilot":
            return ["pilot_move", "pilot_split", "pledge_stock"]
        if phase == "pirate":
            if player_id != state.get("current_player"):
                return []
            return ["pirate_action", "pledge_stock"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "pledge_stock":
            cargo_id = action.get("cargo")
            if cargo_id not in CARGO_LIST:
                return [], "invalid cargo"
            pdata = state["players"][player_id]
            if pdata["stocks"].get(cargo_id, 0) <= 0:
                return [], "no stock to pledge"
            pdata["stocks"][cargo_id] -= 1
            pdata["pledged"][cargo_id] += 1
            _gain_cash(state, player_id, state["config"].get("loan_amount", 12))
            if state.get("phase") == "harbormaster_pay" and player_id == state.get("harbormaster"):
                bid = int(state.get("harbormaster_bid", 0))
                if state["players"][player_id]["cash"] >= bid:
                    _pay_cash(state, player_id, bid)
                    state["phase"] = "harbormaster_buy"
            return events, None

        phase = state.get("phase")

        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "game not over"
            new_state = ManilaGame.init_game(state.get("config"), list(state.get("player_meta", {}).values()))
            state.clear()
            state.update(new_state)
            return events, None

        if phase == "auction":
            if player_id != state.get("current_player"):
                return [], "not your turn"
            auction = state.get("auction", {})
            if action_type == "bid":
                bid = int(action.get("amount", 0))
                if bid <= auction.get("highest_bid", 0):
                    return [], "bid too low"
                auction["highest_bid"] = bid
                auction["leader"] = player_id
                if "bids" in auction:
                    auction["bids"][player_id] = bid
                _advance_auction_turn(state)
                return events, None
            if action_type == "pass_bid":
                active = auction.get("active", [])
                if player_id in active:
                    active.remove(player_id)
                if len(active) == 1:
                    _set_harbormaster(state, active[0])
                    return events, None
                _advance_auction_turn(state)
                return events, None
            return [], "invalid action"

        if phase == "harbormaster_buy":
            if player_id != state.get("harbormaster"):
                return [], "not harbormaster"
            if action_type == "buy_stock":
                cargo_id = action.get("cargo")
                if cargo_id not in CARGO_LIST:
                    return [], "invalid cargo"
                if state["stock_bank"].get(cargo_id, 0) <= 0:
                    return [], "stock unavailable"
                price = _price_for_cargo(state, cargo_id)
                if not _ensure_cash(state, player_id, price):
                    return [], "insufficient cash"
                _pay_cash(state, player_id, price)
                state["players"][player_id]["stocks"][cargo_id] += 1
                state["stock_bank"][cargo_id] -= 1
                state["phase"] = "harbormaster_cargo"
                return events, None
            if action_type == "skip_buy":
                state["phase"] = "harbormaster_cargo"
                return events, None
            return [], "invalid action"

        if phase == "harbormaster_pay":
            if player_id != state.get("harbormaster"):
                return [], "not harbormaster"
            return [], "invalid action"

        if phase == "harbormaster_cargo":
            if player_id != state.get("harbormaster"):
                return [], "not harbormaster"
            if action_type != "select_cargo":
                return [], "invalid action"
            cargo_list = action.get("cargo")
            if not isinstance(cargo_list, list) or len(cargo_list) != 3:
                return [], "invalid cargo selection"
            if len(set(cargo_list)) != 3:
                return [], "duplicate cargo"
            for cargo_id in cargo_list:
                if cargo_id not in CARGO_LIST:
                    return [], "invalid cargo"
            state["cargo_slots"] = list(cargo_list)
            state["phase"] = "harbormaster_position"
            return events, None

        if phase == "harbormaster_position":
            if player_id != state.get("harbormaster"):
                return [], "not harbormaster"
            if action_type != "set_positions":
                return [], "invalid action"
            positions = action.get("positions")
            if not isinstance(positions, list) or len(positions) != 3:
                return [], "invalid positions"
            if sum(int(p) for p in positions) != 9:
                return [], "positions must sum to 9"
            boats: Dict[str, Dict] = {}
            for cargo_id, pos in zip(state.get("cargo_slots", []), positions):
                if int(pos) < 0 or int(pos) > 13:
                    return [], "invalid position"
                boats[cargo_id] = _init_boat(cargo_id, int(pos))
            state["boats"] = boats
            state["board"] = _init_board_state()
            state["placement_round"] = 1
            _start_placement_round(state)
            return events, None

        if phase == "placement":
            if player_id != state.get("current_player"):
                return [], "not your turn"
            if action_type == "pass":
                state["placement_acted"].append(player_id)
            elif action_type == "place_worker":
                location = action.get("location", {})
                loc_type = location.get("type")
                err = _handle_place_worker(state, player_id, loc_type, location)
                if err:
                    return [], err
                state["placement_acted"].append(player_id)
            else:
                return [], "invalid action"

            if len(state["placement_acted"]) >= len(state.get("turn_order", [])):
                if state.get("placement_round", 1) == 3:
                    if _maybe_start_pilot_phase(state):
                        return events, None
                targets = _roll_and_move(state)
                if state.get("placement_round", 1) >= 2 and _maybe_start_pirate_phase(state, targets):
                    return events, None
                _advance_after_movement(state)
                return events, None

            state["current_player"] = _advance_player(state, state.get("current_player"))
            return events, None

        if phase == "pilot":
            if action_type not in ("pilot_move", "pilot_split"):
                return [], "invalid action"
            size = action.get("size")
            if size not in ("small", "big"):
                return [], "invalid pilot size"
            pending = state.get("pending_pilots", [])
            if size not in pending:
                return [], "pilot already used"
            pilot_holder = state.get("board", {}).get("pilots", {}).get(size)
            if pilot_holder != player_id:
                return [], "not your pilot"

            moves: List[Tuple[str, int]] = []
            if action_type == "pilot_split":
                if size != "big":
                    return [], "split move requires big pilot"
                cargo_a = action.get("cargo_a")
                cargo_b = action.get("cargo_b")
                delta_a = int(action.get("delta_a", 0))
                delta_b = int(action.get("delta_b", 0))
                if cargo_a == cargo_b:
                    return [], "duplicate cargo"
                if abs(delta_a) != 1 or abs(delta_b) != 1:
                    return [], "invalid split delta"
                moves = [(cargo_a, delta_a), (cargo_b, delta_b)]
            else:
                cargo_id = action.get("cargo")
                delta = int(action.get("delta", 0))
                limit = 1 if size == "small" else 2
                if abs(delta) > limit:
                    return [], "delta too large"
                moves = [(cargo_id, delta)]

            for cargo_id, delta in moves:
                if cargo_id not in state.get("boats", {}):
                    return [], "invalid cargo"
                boat = state["boats"][cargo_id]
                if int(boat.get("position", 0)) >= 13:
                    return [], "ship already arrived"
            for cargo_id, delta in moves:
                boat = state["boats"][cargo_id]
                pos = int(boat.get("position", 0))
                new_pos = pos + delta
                if new_pos < 0:
                    new_pos = 0
                if new_pos >= 13:
                    new_pos = 13
                    boat["arrived_by_pilot"] = True
                    boat["skip_roll"] = True
                    boat["safe_from_pirates"] = True
                boat["position"] = new_pos

            pending.remove(size)
            state["pending_pilots"] = pending
            if pending:
                next_size = pending[0]
                state["current_player"] = state.get("board", {}).get("pilots", {}).get(next_size)
                return events, None
            targets = _roll_and_move(state)
            if _maybe_start_pirate_phase(state, targets):
                return events, None
            _advance_after_movement(state)
            return events, None

        if phase == "pirate":
            if action_type != "pirate_action":
                return [], "invalid action"
            pending = state.get("pirate_pending", [])
            if not pending:
                return [], "no pirate action"
            role = pending[0]
            actor = state.get("board", {}).get("pirates", {}).get(role)
            if actor != player_id:
                return [], "not your turn"
            mode = action.get("mode")
            cargo_id = action.get("cargo")
            targets = state.get("pirate_targets", [])
            if mode == "skip":
                pass
            elif mode == "plunder":
                if role != "captain":
                    return [], "only captain can plunder"
                if cargo_id not in targets:
                    return [], "invalid target"
                boat = state["boats"][cargo_id]
                boat["plundered"] = True
                boat["plunderer"] = player_id
                boat["seats"] = [None for _ in boat.get("seats", [])]
                boat["skip_roll"] = True
                _gain_cash(state, player_id, int(boat.get("total_value", 0)))
                if cargo_id in targets:
                    targets.remove(cargo_id)
            elif mode == "board":
                if cargo_id not in targets:
                    return [], "invalid target"
                boat = state["boats"][cargo_id]
                if boat.get("plundered"):
                    return [], "invalid target"
                seats = boat.get("seats", [])
                if player_id not in seats:
                    try:
                        idx = seats.index(None)
                    except ValueError:
                        return [], "no seat available"
                    seats[idx] = player_id
            else:
                return [], "invalid pirate mode"

            pending.pop(0)
            state["pirate_pending"] = pending
            state["pirate_targets"] = targets
            if pending and targets:
                next_role = pending[0]
                state["current_player"] = state.get("board", {}).get("pirates", {}).get(next_role)
                return events, None

            state["pirate_pending"] = []
            state["pirate_targets"] = []
            _advance_after_movement(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = state.get("turn_order", [])
        player_meta = state.get("player_meta", {})
        players_view = []
        for pid in player_ids:
            meta = player_meta.get(pid, {})
            entry = _player_view(state, pid, viewer_id)
            entry.update(
                {
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                }
            )
            players_view.append(entry)

        return {
            "game_id": ManilaGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "current_player": state.get("current_player"),
            "harbormaster": state.get("harbormaster"),
            "harbormaster_bid": state.get("harbormaster_bid", 0),
            "auction": state.get("auction", {}),
            "cargo_slots": state.get("cargo_slots", []),
            "boats": state.get("boats", {}),
            "board": state.get("board", {}),
            "pirate_targets": state.get("pirate_targets", []),
            "pirate_pending": state.get("pirate_pending", []),
            "pending_pilots": state.get("pending_pilots", []),
            "price_track": state.get("price_track", {}),
            "players": players_view,
            "winner": state.get("winner", []),
            "game_over": state.get("game_over", False),
            "legal_actions": ManilaGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        phase = state.get("phase")

        if phase == "auction":
            if bot_id != state.get("current_player"):
                return None
            auction = state.get("auction", {})
            current_bid = int(auction.get("highest_bid", 0))
            max_bid = _bot_max_bid(state, bot_id)
            if current_bid + 1 > max_bid:
                return {"type": "pass_bid"}
            if current_bid == 0 and random.random() < 0.7:
                return {"type": "bid", "amount": 1}
            if random.random() < 0.4:
                return {"type": "bid", "amount": current_bid + 1}
            return {"type": "pass_bid"}

        if phase == "harbormaster_pay":
            if bot_id != state.get("harbormaster"):
                return None
            bid = int(state.get("harbormaster_bid", 0))
            cash = int(state["players"][bot_id].get("cash", 0))
            if cash >= bid:
                return {"type": "pay_bid"}
            cargo_id = _bot_choose_pledge_cargo(state, bot_id)
            if cargo_id:
                return {"type": "pledge_stock", "cargo": cargo_id}
            return None

        if phase == "harbormaster_buy":
            if bot_id != state.get("harbormaster"):
                return None
            cargo_id = _bot_choose_buy_stock(state, bot_id)
            if cargo_id:
                return {"type": "buy_stock", "cargo": cargo_id}
            return {"type": "skip_buy"}

        if phase == "harbormaster_cargo":
            if bot_id != state.get("harbormaster"):
                return None
            return {"type": "select_cargo", "cargo": _bot_choose_cargo_selection()}

        if phase == "harbormaster_position":
            if bot_id != state.get("harbormaster"):
                return None
            return {"type": "set_positions", "positions": _bot_choose_positions()}

        if phase == "placement":
            if bot_id != state.get("current_player"):
                return None
            return _bot_choose_placement(state, bot_id)

        if phase == "pilot":
            if bot_id != state.get("current_player"):
                return None
            return _bot_choose_pilot_action(state, bot_id)

        if phase == "pirate":
            if bot_id != state.get("current_player"):
                return None
            return _bot_choose_pirate_action(state, bot_id)

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload


def _handle_place_worker(state: Dict, player_id: str, loc_type: str, location: Dict) -> Optional[str]:
    if loc_type == "port":
        slot = location.get("slot")
        if slot not in ("A", "B", "C"):
            return "invalid port slot"
        board = state["board"]["port"]
        if board.get(slot):
            return "slot occupied"
        cost = BOARD_DATA.get("port", {}).get(slot, {}).get("place_cost", 0)
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        board[slot] = player_id
        return None
    if loc_type == "shipyard":
        slot = location.get("slot")
        if slot not in ("A", "B", "C"):
            return "invalid shipyard slot"
        board = state["board"]["shipyard"]
        if board.get(slot):
            return "slot occupied"
        cost = BOARD_DATA.get("shipyard", {}).get(slot, {}).get("place_cost", 0)
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        board[slot] = player_id
        return None
    if loc_type == "pirate":
        slot = location.get("slot")
        if slot not in ("captain", "pirate"):
            return "invalid pirate slot"
        board = state["board"]["pirates"]
        if board.get(slot):
            return "slot occupied"
        cost = BOARD_DATA.get("pirates", {}).get("place_cost", 0)
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        board[slot] = player_id
        return None
    if loc_type == "pilot":
        size = location.get("size")
        if size not in ("small", "big"):
            return "invalid pilot size"
        board = state["board"]["pilots"]
        if board.get(size):
            return "slot occupied"
        cost_key = "small_cost" if size == "small" else "big_cost"
        cost = BOARD_DATA.get("pilots", {}).get(cost_key, 0)
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        board[size] = player_id
        return None
    if loc_type == "insurance":
        board = state["board"]
        if board.get("insurance"):
            return "slot occupied"
        cost = BOARD_DATA.get("insurance", {}).get("place_cost", 0)
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        board["insurance"] = player_id
        immediate = BOARD_DATA.get("insurance", {}).get("immediate_gain", 10)
        _gain_cash(state, player_id, int(immediate))
        return None
    if loc_type == "ship":
        cargo_id = location.get("cargo")
        seat_index = location.get("seat")
        if cargo_id not in state.get("boats", {}):
            return "invalid cargo"
        boat = state["boats"][cargo_id]
        seats = boat.get("seats", [])
        if seat_index is None or not isinstance(seat_index, int):
            return "invalid seat"
        if seat_index < 0 or seat_index >= len(seats):
            return "invalid seat"
        if seats[seat_index]:
            return "seat occupied"
        cost = boat.get("seat_costs", [])[seat_index]
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        seats[seat_index] = player_id
        return None
    return "invalid location"
