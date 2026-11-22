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
START_POSITION_MAX = 5
START_POSITION_TOTAL = 9

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
            "round_ready": False,
        }
    return players


def _init_round_ledger(state: Dict) -> None:
    state["round_ledger"] = {
        pid: {"earn": {}, "spend": {}} for pid in state.get("players", {}).keys()
    }


def _record_earn(state: Dict, player_id: str, amount: int, reason: str) -> None:
    if amount <= 0:
        return
    ledger = state.get("round_ledger")
    if ledger is None:
        return
    player_entry = ledger.setdefault(player_id, {"earn": {}, "spend": {}})
    earn = player_entry.setdefault("earn", {})
    earn[reason] = int(earn.get(reason, 0)) + int(amount)


def _record_spend(state: Dict, player_id: str, amount: int, reason: str) -> None:
    if amount <= 0:
        return
    ledger = state.get("round_ledger")
    if ledger is None:
        return
    player_entry = ledger.setdefault(player_id, {"earn": {}, "spend": {}})
    spend = player_entry.setdefault("spend", {})
    spend[reason] = int(spend.get(reason, 0)) + int(amount)


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
        "arrived": False,
        "arrived_slot": None,
        "arrived_by_pilot": False,
        "safe_from_pirates": False,
        "last_roll": None,
    }


def _init_arrivals_state() -> Dict[str, Optional[str]]:
    return {"A": None, "B": None, "C": None}


def _next_port_slot(state: Dict) -> Optional[str]:
    for slot in ("A", "B", "C"):
        if not state.get("port_arrivals", {}).get(slot):
            return slot
    return None


def _place_in_port(state: Dict, cargo_id: str) -> None:
    boat = state.get("boats", {}).get(cargo_id)
    if not boat or boat.get("arrived"):
        return
    slot = _next_port_slot(state)
    if slot:
        state["port_arrivals"][slot] = cargo_id
        boat["arrived_slot"] = slot
    boat["arrived"] = True
    boat["skip_roll"] = True


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
        _record_spend(state, player_id, int(bid), "Bid")
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
    loan = state["config"].get("loan_amount", 12)
    _gain_cash(state, player_id, loan)
    _record_earn(state, player_id, int(loan), "Pledge Loan")
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


def _reset_round_ready(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["round_ready"] = False


def _setup_round(state: Dict) -> None:
    state["cargo_slots"] = []
    state["boats"] = {}
    state["board"] = _init_board_state()
    state["placement_round"] = 1
    state["placement_acted"] = []
    state["pirate_targets"] = []
    state["pirate_pending"] = []
    state["pirate_day"] = None
    state["pending_pilots"] = []
    state["port_arrivals"] = _init_arrivals_state()
    _init_round_ledger(state)


def _start_placement_round(state: Dict) -> None:
    state["phase"] = "placement"
    state["placement_acted"] = []
    state["current_player"] = state.get("harbormaster")


def _roll_and_move(state: Dict, day: int) -> List[str]:
    pirate_targets: List[str] = []
    for cargo_id, boat in state.get("boats", {}).items():
        if boat.get("skip_roll") or boat.get("plundered") or boat.get("arrived"):
            continue
        roll = random.randint(1, 6)
        boat["last_roll"] = roll
        pos = int(boat.get("position", 0))
        new_pos = pos + roll
        exact_hit = new_pos == 13
        overshoot = new_pos > 13
        if new_pos >= 13:
            boat["position"] = 13
        else:
            boat["position"] = new_pos
        boat["exact_hit"] = exact_hit
        boat["overshoot"] = overshoot
        if overshoot:
            _place_in_port(state, cargo_id)
        elif exact_hit and not boat.get("safe_from_pirates"):
            pirate_targets.append(cargo_id)
    return pirate_targets


def _maybe_start_pilot_phase(state: Dict) -> bool:
    if not any(not boat.get("arrived") for boat in state.get("boats", {}).values()):
        return False
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


def _maybe_start_pirate_phase(state: Dict, targets: List[str], day: int) -> bool:
    if not targets or day not in (2, 3):
        return False
    pirates = state.get("board", {}).get("pirates", {})
    captain_id = pirates.get("captain")
    pirate_id = pirates.get("pirate")
    if not captain_id:
        return False
    if day == 2:
        pending = [pid for pid in (captain_id, pirate_id) if pid]
    else:
        pending = [captain_id]
    if not pending:
        return False
    state["pirate_targets"] = targets
    state["pirate_pending"] = pending
    state["pirate_day"] = day
    state["phase"] = "pirate"
    state["current_player"] = pending[0]
    return True


def _finalize_no_pirate_arrivals(state: Dict) -> None:
    pirates = state.get("board", {}).get("pirates", {})
    if pirates.get("captain") or pirates.get("pirate"):
        return
    for cargo_id in state.get("cargo_slots", []):
        boat = state.get("boats", {}).get(cargo_id)
        if not boat or boat.get("arrived") or boat.get("plundered"):
            continue
        if int(boat.get("position", 0)) == 13:
            _place_in_port(state, cargo_id)


def _advance_after_movement(state: Dict) -> None:
    round_no = state.get("placement_round", 1)
    if round_no < 3:
        state["placement_round"] = round_no + 1
        _start_placement_round(state)
        return
    _finalize_no_pirate_arrivals(state)
    _resolve_round(state)


def _enter_round_end(state: Dict) -> None:
    _reset_round_ready(state)
    state["phase"] = "round_end"
    state["current_player"] = None


def _begin_next_round(state: Dict) -> None:
    _cleanup_round(state)
    _reset_round_ready(state)
    state["round"] = state.get("round", 1) + 1
    _setup_round(state)
    if state.get("harbormaster") in state.get("turn_order", []):
        state["auction_start"] = _advance_player(state, state.get("harbormaster"))
    _start_auction(state)


def _resolve_round(state: Dict) -> None:
    cargo_order = state.get("cargo_slots", [])
    port_slots = ["A", "B", "C"]
    shipyard_slots = ["A", "B", "C"]

    successes: List[str] = []
    failures: List[str] = []
    port_candidates: List[str] = []
    for cargo_id in cargo_order:
        boat = state["boats"].get(cargo_id)
        if not boat:
            continue
        if boat.get("plundered"):
            result = boat.get("plunder_result")
            if result == "port":
                successes.append(cargo_id)
                port_candidates.append(cargo_id)
            else:
                failures.append(cargo_id)
            continue
        if boat.get("arrived"):
            successes.append(cargo_id)
            port_candidates.append(cargo_id)
        else:
            failures.append(cargo_id)

    for cargo_id in successes:
        boat = state["boats"][cargo_id]
        if boat.get("plundered"):
            continue
        _distribute_ship_value(state, boat)

    for cargo_id in port_candidates:
        _place_in_port(state, cargo_id)

    board = state.get("board", {})
    for slot in port_slots:
        if not state.get("port_arrivals", {}).get(slot):
            continue
        occupant = board.get("port", {}).get(slot)
        payout = BOARD_DATA.get("port", {}).get(slot, {}).get("payout", 0)
        if occupant:
            _gain_cash(state, occupant, payout)
            _record_earn(state, occupant, int(payout), f"Port {slot}")

    for idx, cargo_id in enumerate(failures):
        if idx >= len(shipyard_slots):
            break
        slot = shipyard_slots[idx]
        occupant = board.get("shipyard", {}).get(slot)
        payout = BOARD_DATA.get("shipyard", {}).get(slot, {}).get("payout", 0)
        if occupant:
            _gain_cash(state, occupant, payout)
            _record_earn(state, occupant, int(payout), f"Shipyard {slot}")

    insurance_holder = board.get("insurance")
    if insurance_holder:
        per_ship = int(BOARD_DATA.get("insurance", {}).get("per_ship_cost", 10))
        insurance_cost = per_ship * len(failures)
        _force_pay(state, insurance_holder, insurance_cost)
        _record_spend(state, insurance_holder, int(insurance_cost), "Insurance Payout")

    for cargo_id in successes:
        _advance_price(state, cargo_id)

    if _check_game_end(state):
        _finalize_game(state)
        return
    _enter_round_end(state)


def _cleanup_round(state: Dict) -> None:
    _reset_workers(state)
    state["board"] = _init_board_state()
    state["boats"] = {}
    state["cargo_slots"] = []
    state["placement_round"] = 1
    state["placement_acted"] = []
    state["pirate_targets"] = []
    state["pirate_pending"] = []
    state["pirate_day"] = None
    state["pending_pilots"] = []
    state["port_arrivals"] = _init_arrivals_state()


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


def _score_breakdown(state: Dict, player_id: str) -> Dict:
    pdata = state["players"][player_id]
    cash = int(pdata.get("cash", 0))
    stocks = {}
    for cargo_id in CARGO_LIST:
        count = int(pdata.get("stocks", {}).get(cargo_id, 0))
        price = int(state.get("price_track", {}).get(cargo_id, 0))
        stocks[cargo_id] = {"count": count, "price": price, "value": count * price}
    stock_value = sum(stock["value"] for stock in stocks.values())
    pledged_count = sum(int(pdata.get("pledged", {}).get(cargo_id, 0)) for cargo_id in CARGO_LIST)
    loan_repay = int(state.get("config", {}).get("loan_repay", 15))
    debt = pledged_count * loan_repay
    return {
        "cash": cash,
        "stocks": stocks,
        "stock_value": stock_value,
        "pledged_count": pledged_count,
        "loan_repay": loan_repay,
        "debt": debt,
        "total": cash + stock_value - debt,
    }


def _finalize_game(state: Dict) -> None:
    scores = {pid: _score_breakdown(state, pid)["total"] for pid in state.get("players", {})}
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
    cargo_id = boat.get("cargo", "")
    for pid, count in counts.items():
        payout = math.ceil(total_value * (count / total_workers))
        _gain_cash(state, pid, payout)
        label = f"Ship {cargo_id.title()}" if cargo_id else "Ship"
        _record_earn(state, pid, int(payout), label)


def _player_view(state: Dict, player_id: str, viewer_id: str) -> Dict:
    pdata = state["players"][player_id]
    view = {
        "player_id": player_id,
        "cash": pdata.get("cash", 0),
        "workers_available": pdata.get("workers_available", 0),
        "workers_total": pdata.get("workers_total", 0),
        "round_ready": pdata.get("round_ready", False),
    }
    if player_id == viewer_id:
        view["stocks"] = dict(pdata.get("stocks", {}))
        view["pledged"] = dict(pdata.get("pledged", {}))
    else:
        view["stock_count"] = sum(pdata.get("stocks", {}).values())
        view["pledged_count"] = sum(pdata.get("pledged", {}).values())
    if state.get("game_over"):
        view["score_breakdown"] = _score_breakdown(state, player_id)
    return view


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
            "port_arrivals": _init_arrivals_state(),
            "placement_round": 1,
            "placement_acted": [],
            "price_track": {cargo_id: 0 for cargo_id in CARGO_LIST},
            "stock_deck": stock_deck,
            "stock_bank": stock_bank,
            "pirate_targets": [],
            "pirate_pending": [],
            "pirate_day": None,
            "pending_pilots": [],
            "winner": [],
            "game_over": False,
        }
        _init_round_ledger(state)
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
        if phase == "round_end":
            if state["players"][player_id].get("round_ready"):
                return []
            return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if state.get("game_over") and action_type != "play_again":
            return [], "game over"

        if action_type == "pledge_stock":
            cargo_id = action.get("cargo")
            if cargo_id not in CARGO_LIST:
                return [], "invalid cargo"
            pdata = state["players"][player_id]
            if pdata["stocks"].get(cargo_id, 0) <= 0:
                return [], "no stock to pledge"
            pdata["stocks"][cargo_id] -= 1
            pdata["pledged"][cargo_id] += 1
            loan = state["config"].get("loan_amount", 12)
            _gain_cash(state, player_id, loan)
            _record_earn(state, player_id, int(loan), "Pledge Loan")
            if state.get("phase") == "harbormaster_pay" and player_id == state.get("harbormaster"):
                bid = int(state.get("harbormaster_bid", 0))
                if state["players"][player_id]["cash"] >= bid:
                    _record_spend(state, player_id, int(bid), "Bid")
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
                _record_spend(state, player_id, int(price), f"Buy {cargo_id.title()}")
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
            if any(type(position) is not int or not 0 <= position <= START_POSITION_MAX for position in positions):
                return [], "starting positions must be integers from 0 to 5"
            if sum(positions) != START_POSITION_TOTAL:
                return [], "positions must sum to 9"
            boats: Dict[str, Dict] = {}
            for cargo_id, pos in zip(state.get("cargo_slots", []), positions):
                boats[cargo_id] = _init_boat(cargo_id, pos)
            state["boats"] = boats
            state["board"] = _init_board_state()
            state["port_arrivals"] = _init_arrivals_state()
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
                targets = _roll_and_move(state, state.get("placement_round", 1))
                if state.get("placement_round", 1) >= 2 and _maybe_start_pirate_phase(
                    state, targets, state.get("placement_round", 1)
                ):
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
                if boat.get("arrived"):
                    return [], "ship already arrived"
            for cargo_id, delta in moves:
                boat = state["boats"][cargo_id]
                pos = int(boat.get("position", 0))
                new_pos = pos + delta
                if new_pos < 0:
                    new_pos = 0
                if new_pos >= 13:
                    boat["position"] = 13
                    boat["arrived_by_pilot"] = True
                    boat["safe_from_pirates"] = True
                    if new_pos > 13:
                        _place_in_port(state, cargo_id)
                else:
                    boat["position"] = new_pos

            pending.remove(size)
            if all(boat.get("arrived") for boat in state.get("boats", {}).values()):
                pending = []
            state["pending_pilots"] = pending
            if pending:
                next_size = pending[0]
                state["current_player"] = state.get("board", {}).get("pilots", {}).get(next_size)
                return events, None
            targets = _roll_and_move(state, state.get("placement_round", 1))
            if _maybe_start_pirate_phase(state, targets, state.get("placement_round", 1)):
                return events, None
            _advance_after_movement(state)
            return events, None

        if phase == "pirate":
            if action_type != "pirate_action":
                return [], "invalid action"
            pending = state.get("pirate_pending", [])
            if not pending:
                return [], "no pirate action"
            actor = pending[0]
            if actor != player_id:
                return [], "not your turn"
            mode = action.get("mode")
            cargo_id = action.get("cargo")
            targets = state.get("pirate_targets", [])
            day = state.get("pirate_day", 3)

            if day == 2:
                if mode == "board":
                    if cargo_id not in targets:
                        return [], "invalid target"
                    boat = state["boats"][cargo_id]
                    seats = boat.get("seats", [])
                    try:
                        idx = seats.index(None)
                    except ValueError:
                        return [], "no seat available"
                    seats[idx] = player_id
                    pirates = state.get("board", {}).get("pirates", {})
                    if player_id == pirates.get("captain"):
                        if pirates.get("pirate"):
                            pirates["captain"] = pirates.get("pirate")
                            pirates["pirate"] = None
                        else:
                            pirates["captain"] = None
                    elif player_id == pirates.get("pirate"):
                        pirates["pirate"] = None
                elif mode == "skip":
                    pass
                else:
                    return [], "invalid pirate mode"

                pending.pop(0)
                state["pirate_pending"] = pending
                if pending:
                    state["current_player"] = pending[0]
                    return events, None
                state["pirate_pending"] = []
                state["pirate_targets"] = []
                state["pirate_day"] = None
                _advance_after_movement(state)
                return events, None

            if day == 3:
                if mode != "plunder":
                    return [], "plunder required"
                if cargo_id not in targets:
                    return [], "invalid target"
                boat = state["boats"][cargo_id]
                boat["plundered"] = True
                boat["plunderer"] = player_id
                result = action.get("result")
                if result not in ("port", "shipyard"):
                    result = "port"
                boat["plunder_result"] = result
                boat["seats"] = [None for _ in boat.get("seats", [])]
                boat["skip_roll"] = True
                pirates = state.get("board", {}).get("pirates", {})
                pirate_ids = [pid for pid in pirates.values() if pid]
                total_value = int(boat.get("total_value", 0))
                if pirate_ids:
                    share = total_value // len(pirate_ids)
                    for pid in pirate_ids:
                        _gain_cash(state, pid, share)
                        _record_earn(state, pid, int(share), "Pirate Plunder")
                targets = [cid for cid in targets if cid != cargo_id]
                state["pirate_targets"] = targets
                if targets:
                    state["current_player"] = actor
                    return events, None
                state["pirate_pending"] = []
                state["pirate_targets"] = []
                state["pirate_day"] = None
                _advance_after_movement(state)
                return events, None

            return [], "invalid pirate day"

        if phase == "round_end":
            if action_type != "next_round":
                return [], "invalid action"
            pdata = state["players"][player_id]
            if pdata.get("round_ready"):
                return [], "already ready"
            pdata["round_ready"] = True
            if all(p.get("round_ready") for p in state.get("players", {}).values()):
                _begin_next_round(state)
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
            "port_arrivals": state.get("port_arrivals", {}),
            "round_ledger": state.get("round_ledger", {}),
            "pirate_targets": state.get("pirate_targets", []),
            "pirate_pending": state.get("pirate_pending", []),
            "pirate_day": state.get("pirate_day"),
            "pending_pilots": state.get("pending_pilots", []),
            "price_track": state.get("price_track", {}),
            "players": players_view,
            "winner": state.get("winner", []),
            "game_over": state.get("game_over", False),
            "legal_actions": ManilaGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.manila_ai import choose_action

        return choose_action(state, bot_id)

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
        _record_spend(state, player_id, int(cost), f"Port {slot}")
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
        _record_spend(state, player_id, int(cost), f"Shipyard {slot}")
        board[slot] = player_id
        return None
    if loc_type == "pirate":
        board = state["board"]["pirates"]
        if board.get("captain") and board.get("pirate"):
            return "slot occupied"
        slot = "captain" if not board.get("captain") else "pirate"
        cost = BOARD_DATA.get("pirates", {}).get("place_cost", 0)
        err = _place_worker(state, player_id, int(cost))
        if err:
            return err
        _record_spend(state, player_id, int(cost), "Pirates")
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
        _record_spend(state, player_id, int(cost), f"Pilot {size.title()}")
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
        _record_spend(state, player_id, int(cost), "Insurance")
        board["insurance"] = player_id
        immediate = BOARD_DATA.get("insurance", {}).get("immediate_gain", 10)
        _gain_cash(state, player_id, int(immediate))
        _record_earn(state, player_id, int(immediate), "Insurance Bonus")
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
        _record_spend(state, player_id, int(cost), f"Seat {cargo_id.title()} #{seat_index + 1}")
        seats[seat_index] = player_id
        return None
    return "invalid location"
