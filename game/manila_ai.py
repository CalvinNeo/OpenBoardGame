import math
from copy import deepcopy
from functools import lru_cache
from itertools import combinations, product
from typing import Dict, List, Optional, Tuple

from game.manila import BOARD_DATA, CARGO_DATA, CARGO_LIST, PRICE_TRACK, START_POSITION_MAX, START_POSITION_TOTAL, _price_for_cargo


@lru_cache(maxsize=256)
def _voyage(position: int, rolls: int, pirates: bool, safe: bool = False) -> Tuple[float, float]:
    if rolls == 0:
        return (float(position >= 13), 0.0)
    success = 0.0
    plunder = 0.0
    for die in range(1, 7):
        destination = position + die
        if destination > 13 or (destination == 13 and (rolls == 1 or safe)):
            if destination == 13 and rolls == 1 and pirates and not safe:
                plunder += 1 / 6
            else:
                success += 1 / 6
        else:
            later_success, later_plunder = _voyage(min(13, destination), rolls - 1, pirates, safe)
            success += later_success / 6
            plunder += later_plunder / 6
    return success, plunder


def _probabilities(state: Dict) -> Dict[str, Tuple[float, float]]:
    pirates = any(state.get("board", {}).get("pirates", {}).values())
    rolls = max(1, 4 - int(state.get("placement_round", 1)))
    if state.get("phase") == "pirate" and state.get("pirate_day") == 3:
        rolls = 0
    elif state.get("phase") == "pirate" and state.get("pirate_day") == 2:
        rolls = 1
    result = {}
    for cargo_id, boat in state.get("boats", {}).items():
        if boat.get("plundered"):
            result[cargo_id] = (float(boat.get("plunder_result") == "port"), 0.0)
        elif boat.get("arrived"):
            result[cargo_id] = (1.0, 0.0)
        else:
            result[cargo_id] = _voyage(int(boat["position"]), rolls, pirates, bool(boat.get("safe_from_pirates")))
    return result


def _count_distribution(probabilities: List[float]) -> List[float]:
    distribution = [1.0]
    for probability in probabilities:
        updated = [0.0] * (len(distribution) + 1)
        for count, chance in enumerate(distribution):
            updated[count] += chance * (1 - probability)
            updated[count + 1] += chance * probability
        distribution = updated
    return distribution


def _price_gain(state: Dict, cargo_id: str) -> int:
    price = int(state.get("price_track", {}).get(cargo_id, 0))
    index = PRICE_TRACK.index(price)
    return PRICE_TRACK[min(index + 1, len(PRICE_TRACK) - 1)] - price


def _future_opponent_turns(state: Dict, player_id: str) -> int:
    if state.get("phase") != "placement":
        return 0
    acted = state.get("placement_acted", [])
    later_rounds = 3 - int(state.get("placement_round", 1))
    return sum(
        min(int(player.get("workers_available", 0)), later_rounds + int(other_id not in acted))
        for other_id, player in state["players"].items() if other_id != player_id
    )


def _crew_income(state: Dict, boat: Dict, player_id: str, success: float, project: bool) -> float:
    seats = boat.get("seats", [])
    owned = seats.count(player_id)
    if not owned or boat.get("plundered"):
        return 0.0
    occupied = sum(seat is not None for seat in seats)
    empty = len(seats) - occupied
    fill_chance = 0.0
    if project and empty:
        vacancies = sum(other.get("seats", []).count(None) for other in state["boats"].values())
        demand = _future_opponent_turns(state, player_id) / max(1, vacancies)
        attractiveness = min(1.0, success * boat["total_value"] / (occupied + 1) / 10)
        fill_chance = min(0.9, demand * attractiveness)
    return success * sum(
        math.comb(empty, additions) * fill_chance ** additions * (1 - fill_chance) ** (empty - additions)
        * math.ceil(boat["total_value"] * owned / (occupied + additions))
        for additions in range(empty + 1)
    )


def _round_value(state: Dict, player_id: str, project: bool = False) -> float:
    probabilities = _probabilities(state)
    board = state["board"]
    stocks = state["players"][player_id].get("stocks", {})
    successes = [chance[0] for chance in probabilities.values()]
    counts = _count_distribution(successes)
    value = sum(
        _crew_income(state, boat, player_id, probabilities[cargo_id][0], project)
        + probabilities[cargo_id][0] * stocks.get(cargo_id, 0) * _price_gain(state, cargo_id)
        for cargo_id, boat in state["boats"].items()
    )
    for area in ("port", "shipyard"):
        for index, slot in enumerate(("A", "B", "C")):
            if board[area].get(slot) != player_id:
                continue
            chance = sum(
                probability for count, probability in enumerate(counts)
                if (count if area == "port" else len(successes) - count) > index
            )
            value += chance * BOARD_DATA[area][slot]["payout"]
    if board.get("insurance") == player_id:
        value -= BOARD_DATA["insurance"]["per_ship_cost"] * (len(successes) - sum(successes))
    pirate_ids = [owner for owner in board["pirates"].values() if owner]
    if player_id in pirate_ids:
        value += sum(
            chance[1] * (state["boats"][cargo_id]["total_value"] // len(pirate_ids))
            * pirate_ids.count(player_id) for cargo_id, chance in probabilities.items()
        )
    return value


def _utility(state: Dict, player_id: str, project: bool = False) -> float:
    value = _round_value(state, player_id, project)
    opponents = [other_id for other_id in state["players"] if other_id != player_id]
    if opponents:
        public_state = {**state, "players": {
            other_id: {**player, "stocks": {}} for other_id, player in state["players"].items()
        }}
        value -= 0.35 * sum(_round_value(public_state, other_id) for other_id in opponents) / len(opponents)
    return value


def _plan(state: Dict, player_id: str, cargo_options: Optional[List[str]] = None) -> Tuple[List[str], List[int], float, float]:
    stocks = state["players"][player_id].get("stocks", {})
    selections = [tuple(cargo_options)] if cargo_options else combinations(CARGO_LIST, 3)
    best_cargo, best_positions = [], []
    best_score = -math.inf
    total_score = 0.0
    plans = 0
    for cargo in selections:
        for first in range(START_POSITION_MAX + 1):
            for second in range(START_POSITION_MAX + 1):
                third = START_POSITION_TOTAL - first - second
                if not 0 <= third <= START_POSITION_MAX:
                    continue
                positions = [first, second, third]
                chances = [_voyage(position, 3, False)[0] for position in positions]
                dividends = [CARGO_DATA[cargo_id]["total_value"] / len(CARGO_DATA[cargo_id]["seat_costs"]) for cargo_id in cargo]
                score = sum(
                    chance * (stocks.get(cargo_id, 0) * _price_gain(state, cargo_id) + 0.2 * dividend)
                    for cargo_id, chance, dividend in zip(cargo, chances, dividends)
                )
                first_investment = max(
                    chance * dividend - min(CARGO_DATA[cargo_id]["seat_costs"])
                    for cargo_id, chance, dividend in zip(cargo, chances, dividends)
                )
                score += 0.55 * first_investment
                total_score += score
                plans += 1
                if score > best_score:
                    best_cargo, best_positions, best_score = list(cargo), positions, score
    return best_cargo, best_positions, best_score, total_score / max(1, plans)


def _stock_value(state: Dict, cargo_id: str, first_success: float) -> float:
    index = PRICE_TRACK.index(int(state["price_track"][cargo_id]))
    leader_index = max(PRICE_TRACK.index(int(price)) for price in state["price_track"].values())
    horizon = 1 if leader_index >= len(PRICE_TRACK) - 2 else min(6, 2 * (len(PRICE_TRACK) - 1 - leader_index))
    distribution = {index: 1 - first_success, min(index + 1, len(PRICE_TRACK) - 1): first_success}
    if index == len(PRICE_TRACK) - 1:
        return float(PRICE_TRACK[index])
    for _ in range(horizon - 1):
        updated = {}
        for price_index, chance in distribution.items():
            updated[price_index] = updated.get(price_index, 0.0) + chance * 0.5
            next_index = min(price_index + 1, len(PRICE_TRACK) - 1)
            updated[next_index] = updated.get(next_index, 0.0) + chance * 0.5
        distribution = updated
    return sum(PRICE_TRACK[price_index] * chance for price_index, chance in distribution.items())


def _buy_stock(state: Dict, player_id: str) -> Optional[str]:
    cash = int(state["players"][player_id]["cash"])
    best_gain, best_cargo = 0.0, None
    for cargo_id in CARGO_LIST:
        cost = _price_for_cargo(state, cargo_id)
        if state["stock_bank"].get(cargo_id, 0) <= 0 or cost > cash - 6:
            continue
        candidate = {**state, "players": {**state["players"], player_id: {
            **state["players"][player_id], "stocks": {**state["players"][player_id]["stocks"]}
        }}}
        candidate["players"][player_id]["stocks"][cargo_id] += 1
        cargo, positions, _, _ = _plan(candidate, player_id)
        chance = _voyage(positions[cargo.index(cargo_id)], 3, False)[0] if cargo_id in cargo else 0.0
        gain = _stock_value(state, cargo_id, chance) - cost
        if gain > best_gain:
            best_gain, best_cargo = gain, cargo_id
    return best_cargo


def _pledge_cargo(state: Dict, player_id: str) -> Optional[str]:
    candidates = [cargo_id for cargo_id, count in state["players"][player_id]["stocks"].items() if count]
    chances = _probabilities(state)
    return min(candidates, key=lambda cargo_id: _stock_value(state, cargo_id, chances.get(cargo_id, (0.5, 0))[0]), default=None)


def _pilot_actions(state: Dict, size: str) -> List[Dict]:
    active = [cargo_id for cargo_id, boat in state["boats"].items() if not boat.get("arrived")]
    limit = 1 if size == "small" else 2
    actions = [
        {"type": "pilot_move", "size": size, "cargo": cargo_id, "delta": delta}
        for cargo_id in active for delta in range(-limit, limit + 1)
    ]
    if size == "big":
        actions.extend(
            {"type": "pilot_split", "size": size, "cargo_a": cargo_a, "delta_a": delta_a, "cargo_b": cargo_b, "delta_b": delta_b}
            for cargo_a, cargo_b in combinations(active, 2) for delta_a, delta_b in product((-1, 1), repeat=2)
        )
    return actions


def _move_pilot(state: Dict, action: Dict) -> Dict:
    candidate = {**state, "boats": {cargo_id: dict(boat) for cargo_id, boat in state["boats"].items()}}
    moves = [(action["cargo"], action["delta"])] if action["type"] == "pilot_move" else [
        (action["cargo_a"], action["delta_a"]), (action["cargo_b"], action["delta_b"])
    ]
    for cargo_id, delta in moves:
        boat = candidate["boats"][cargo_id]
        destination = int(boat["position"]) + delta
        boat["position"] = min(13, max(0, destination))
        if destination >= 13:
            boat["safe_from_pirates"] = True
            if destination > 13:
                boat["arrived"] = True
    return candidate


def _pilot_choice(state: Dict, player_id: str, size: str) -> Tuple[Optional[Dict], float]:
    baseline = _utility(state, player_id)
    best_action, best_value = None, -math.inf
    for action in _pilot_actions(state, size):
        value = _utility(_move_pilot(state, action), player_id)
        if value > best_value:
            best_action, best_value = action, value
    return best_action, max(0.0, best_value - baseline)


@lru_cache(maxsize=64)
def _pre_pilot_positions(position: int, rolls: int) -> Tuple[Tuple[int, float], ...]:
    positions = {position: 1.0}
    for _ in range(rolls):
        updated = {}
        for current, chance in positions.items():
            for die in range(1, 7):
                destination = min(14, current + die)
                updated[destination] = updated.get(destination, 0.0) + chance / 6
        positions = updated
    return tuple(positions.items())


def _pilot_option(state: Dict, player_id: str, size: str) -> float:
    remaining = 3 - int(state.get("placement_round", 1))
    if remaining == 0:
        return _pilot_choice(state, player_id, size)[1]
    gains = []
    for cargo_id, boat in state["boats"].items():
        if boat.get("arrived"):
            continue
        expected_gain = 0.0
        for position, chance in _pre_pilot_positions(int(boat["position"]), remaining):
            if position > 13:
                continue
            candidate = {**state, "phase": "pilot", "placement_round": 3, "boats": {
                other_id: {**other, "arrived": True} if other_id != cargo_id else {**other, "position": position}
                for other_id, other in state["boats"].items()
            }}
            expected_gain += chance * _pilot_choice(candidate, player_id, size)[1]
        gains.append(expected_gain)
    return max(gains, default=0.0)


def _placement(state: Dict, player_id: str) -> Dict:
    player = state["players"][player_id]
    if player.get("workers_available", 0) <= 0:
        return {"type": "pass"}
    baseline = _utility(state, player_id, project=True)
    board = state["board"]
    options = []
    for cargo_id, boat in state["boats"].items():
        if boat.get("plundered"):
            continue
        for seat, owner in enumerate(boat["seats"]):
            if owner is None:
                options.append((boat["seat_costs"][seat], {"type": "ship", "cargo": cargo_id, "seat": seat}))
    for area in ("port", "shipyard"):
        options.extend((BOARD_DATA[area][slot]["place_cost"], {"type": area, "slot": slot})
                       for slot in ("A", "B", "C") if board[area].get(slot) is None)
    if not all(board["pirates"].values()):
        options.append((BOARD_DATA["pirates"]["place_cost"], {"type": "pirate"}))
    for size in ("small", "big"):
        if board["pilots"].get(size) is None:
            options.append((BOARD_DATA["pilots"][f"{size}_cost"], {"type": "pilot", "size": size}))
    if board.get("insurance") is None:
        options.append((BOARD_DATA["insurance"]["place_cost"], {"type": "insurance"}))
    best_gain, best_action = 0.0, {"type": "pass"}
    pledge = _pledge_cargo(state, player_id)
    loan = state.get("config", {}).get("loan_amount", 12)
    for cost, location in options:
        if cost > player["cash"] and (not pledge or cost > player["cash"] + loan):
            continue
        candidate = {**state, "board": deepcopy(board), "boats": {
            cargo_id: {**boat, "seats": list(boat["seats"])} for cargo_id, boat in state["boats"].items()
        }}
        kind = location["type"]
        immediate, option = 0.0, 0.0
        if kind == "ship":
            candidate["boats"][location["cargo"]]["seats"][location["seat"]] = player_id
        elif kind in ("port", "shipyard"):
            candidate["board"][kind][location["slot"]] = player_id
        elif kind == "pirate":
            slot = "captain" if not board["pirates"].get("captain") else "pirate"
            candidate["board"]["pirates"][slot] = player_id
        elif kind == "pilot":
            candidate["board"]["pilots"][location["size"]] = player_id
            option = _pilot_option(candidate, player_id, location["size"])
        else:
            candidate["board"]["insurance"] = player_id
            immediate = BOARD_DATA["insurance"]["immediate_gain"]
        gain = _utility(candidate, player_id, project=True) - baseline + immediate + option - cost
        if cost > player["cash"]:
            chance = _probabilities(state).get(pledge, (0.5, 0))[0]
            gain -= _stock_value(state, pledge, chance) + state["config"].get("loan_repay", 15) - loan + 2
            action = {"type": "pledge_stock", "cargo": pledge}
        else:
            action = {"type": "place_worker", "location": location}
        if gain > best_gain:
            best_gain, best_action = gain, action
    return best_action


def _pirate_choice(state: Dict, player_id: str) -> Dict:
    if state["pirate_day"] == 3:
        targets = state["pirate_targets"]
        best_value, best_results = -math.inf, ()
        for results in product(("port", "shipyard"), repeat=len(targets)):
            candidate = deepcopy(state)
            for cargo_id, result in zip(targets, results):
                boat = candidate["boats"][cargo_id]
                boat.update(plundered=True, plunder_result=result)
                boat["seats"] = [None] * len(boat["seats"])
            value = _utility(candidate, player_id)
            if value > best_value:
                best_value, best_results = value, results
        if not targets:
            return {"type": "pirate_action", "mode": "skip"}
        return {"type": "pirate_action", "mode": "plunder", "cargo": targets[0], "result": best_results[0]}
    best_value = _utility(state, player_id)
    best_action = {"type": "pirate_action", "mode": "skip"}
    for cargo_id in state["pirate_targets"]:
        boat = state["boats"][cargo_id]
        if None not in boat["seats"]:
            continue
        candidate = deepcopy(state)
        seats = candidate["boats"][cargo_id]["seats"]
        seats[seats.index(None)] = player_id
        pirates = candidate["board"]["pirates"]
        if pirates.get("captain") == player_id:
            pirates["captain"], pirates["pirate"] = pirates.get("pirate"), None
        else:
            pirates["pirate"] = None
        value = _utility(candidate, player_id)
        if value > best_value:
            best_value, best_action = value, {"type": "pirate_action", "mode": "board", "cargo": cargo_id}
    return best_action


def choose_action(state: Dict, player_id: str) -> Optional[Dict]:
    if state.get("game_over") or player_id not in state.get("players", {}):
        return None
    phase = state.get("phase")
    if phase == "round_end":
        return None if state["players"][player_id].get("round_ready") else {"type": "next_round"}
    if state.get("current_player") != player_id:
        return None
    if phase == "auction":
        _, _, best, average = _plan(state, player_id)
        player = state["players"][player_id]
        reserve = 6 + (5 if any(state["stock_bank"].values()) else 0)
        limit = min(max(0, int(player["cash"]) - reserve), max(0, int(3 + best - average)))
        bid = int(state["auction"].get("highest_bid", 0)) + 1
        return {"type": "bid", "amount": bid} if bid <= limit else {"type": "pass_bid"}
    if phase == "harbormaster_pay":
        cargo_id = _pledge_cargo(state, player_id)
        return {"type": "pledge_stock", "cargo": cargo_id} if cargo_id else None
    if phase == "harbormaster_buy":
        cargo_id = _buy_stock(state, player_id)
        return {"type": "buy_stock", "cargo": cargo_id} if cargo_id else {"type": "skip_buy"}
    if phase == "harbormaster_cargo":
        return {"type": "select_cargo", "cargo": _plan(state, player_id)[0]}
    if phase == "harbormaster_position":
        return {"type": "set_positions", "positions": _plan(state, player_id, state["cargo_slots"])[1]}
    if phase == "placement":
        return _placement(state, player_id)
    if phase == "pilot":
        size = next((size for size in state["pending_pilots"] if state["board"]["pilots"].get(size) == player_id), None)
        return _pilot_choice(state, player_id, size)[0] if size else None
    if phase == "pirate":
        return _pirate_choice(state, player_id)
    return None
