"""Server-authoritative classic Power Grid with an information-limited bot."""

import copy
import heapq
import itertools
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.power_grid_data import (
    CITIES, EDGES, INITIAL_MARKET, PAYMENTS, PLANTS, PLAYER_RULES, REFILL,
    REGIONS, REGION_COLORS, RESOURCES, TOTAL_RESOURCES,
)

CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "regions": {"type": "array", "items": {"enum": list(REGIONS)},
                    "uniqueItems": True, "maxItems": 5},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "maxLength": 80}]},
    }, "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object", "properties": {
        "type": {"enum": ["auction", "bid", "pass", "buy_resources", "build", "done",
                            "replace", "power", "next_round"]},
        "round": {"type": "integer", "minimum": 1},
        "revision": {"type": "integer", "minimum": 0},
        "plant": {"type": "integer"}, "amount": {"type": "integer", "minimum": 1},
        "city": {"type": "string"},
        "resources": {"type": "object", "properties": {
            r: {"type": "integer", "minimum": 0, "maximum": 24} for r in RESOURCES},
            "additionalProperties": False},
        "plants": {"type": "array", "items": {"type": "integer"}, "uniqueItems": True,
                   "maxItems": 4},
        "hybrid_coal": {"type": "integer", "minimum": 0, "maximum": 12},
    }, "required": ["type", "round"], "additionalProperties": False,
}
STEP_THREE = 99


def empty_resources() -> Dict:
    return dict.fromkeys(RESOURCES, 0)


def resource_prices(resource: str, count: int) -> List[int]:
    """The occupied market slots, cheapest first."""
    slots = list(range(1, 9)) + [10, 12, 14, 16] if resource == "uranium" else [p for p in range(1, 9) for _ in range(3)]
    return slots[len(slots) - count:]


def storage_valid(plants: List[int], resources: Dict) -> bool:
    capacity = dict.fromkeys((*RESOURCES, "hybrid"), 0)
    for number in plants:
        plant = PLANTS[number]
        if plant["intake"]:
            capacity[plant["resource"]] += 2 * plant["intake"]
    return (resources["garbage"] <= capacity["garbage"]
            and resources["uranium"] <= capacity["uranium"]
            and max(0, resources["coal"] - capacity["coal"])
            + max(0, resources["oil"] - capacity["oil"]) <= capacity["hybrid"])


def dispatch_options(plants: List[int], resources: Dict, city_count: int) -> List[Dict]:
    options = []
    for size in range(len(plants) + 1):
        for chosen in itertools.combinations(plants, size):
            base = empty_resources()
            hybrid = output = 0
            for number in chosen:
                plant = PLANTS[number]
                output += plant["output"]
                if plant["resource"] == "hybrid":
                    hybrid += plant["intake"]
                elif plant["intake"]:
                    base[plant["resource"]] += plant["intake"]
            for coal in range(hybrid + 1):
                fuel = dict(base)
                fuel["coal"] += coal
                fuel["oil"] += hybrid - coal
                if all(fuel[r] <= resources[r] for r in RESOURCES):
                    powered = min(city_count, output)
                    options.append({"plants": list(chosen), "hybrid_coal": coal, "fuel": fuel,
                                    "output": output, "powered": powered,
                                    "income": PAYMENTS[min(powered, 20)]})
    return options


def build_quotes(state: Dict, player_id: str) -> List[Dict]:
    player = state["players"][player_id]
    active = set(state["cities"])
    graph = {city: [] for city in active}
    for a, b, cost in EDGES:
        if a in active and b in active:
            graph[a].append((b, cost))
            graph[b].append((a, cost))
    distances, paths, queue = {}, {}, []
    for city in player["cities"]:
        distances[city], paths[city] = 0, [city]
        heapq.heappush(queue, (0, city))
    while queue:
        distance, city = heapq.heappop(queue)
        if distance != distances[city]:
            continue
        for target, cost in graph[city]:
            if distance + cost < distances.get(target, float("inf")):
                distances[target] = distance + cost
                paths[target] = paths[city] + [target]
                heapq.heappush(queue, (distance + cost, target))
    result = []
    if len(player["cities"]) >= 22:
        return result
    for city in state["cities"]:
        owners = state["cities"][city]
        if player_id in owners or len(owners) >= state["step"]:
            continue
        connection = distances.get(city) if player["cities"] else 0
        if connection is None:
            continue
        house = 10 + 5 * len(owners)
        result.append({"city": city, "connection": connection, "house": house,
                       "cost": house + connection, "path": paths.get(city, [city]),
                       "affordable": house + connection <= player["money"]})
    return sorted(result, key=lambda q: (q["cost"], q["city"]))


def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "text": text})
    state["log"] = state["log"][-120:]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid].get("name", pid)


def _reorder(state: Dict) -> None:
    state["order"].sort(key=lambda p: (len(state["players"][p]["cities"]),
                                     max(state["players"][p]["plants"], default=0)), reverse=True)


def _draw(state: Dict) -> None:
    if not state["deck"]:
        return
    card = state["deck"].pop(0)
    state["market"].append(card)
    state["market"].sort()
    if card == STEP_THREE:
        state["step3_pending"] = True
        random.Random(f'{state["seed"]}:step3:{state["revision"]}').shuffle(state["deck"])
        _log(state, "Step 3 card drawn. Step 3 begins in the next phase.")
        if state["phase"] != "auction":
            _remove_step_card(state)


def _remove_step_card(state: Dict) -> None:
    if STEP_THREE in state["market"]:
        state["market"].remove(STEP_THREE)
        if state["market"]:
            state["discarded"].append(state["market"].pop(0))


def _activate_step3(state: Dict) -> None:
    if state["step3_pending"]:
        _remove_step_card(state)
        state["step"], state["step3_pending"] = 3, False
        _log(state, "Step 3: three companies per city; all six market plants available.")


def _purge_obsolete(state: Dict) -> None:
    largest = max(len(p["cities"]) for p in state["players"].values())
    while state["market"] and state["market"][0] <= largest:
        number = state["market"].pop(0)
        state["discarded"].append(number)
        _log(state, f"Plant #{number} removed: overtaken by the largest network.")
        _draw(state)


def _discard_low(state: Dict) -> None:
    if state["market"] and state["market"][0] != STEP_THREE:
        state["discarded"].append(state["market"].pop(0))
        _draw(state)
        _purge_obsolete(state)


def _set_phase(state: Dict, phase: str, order: List[str]) -> None:
    state["phase"], state["phase_order"], state["phase_index"] = phase, list(order), 0
    state["current_turn"] = order[0]


def _next_auction(state: Dict) -> None:
    state["phase"], state["auction"] = "auction", None
    remaining = [p for p in state["order"] if p not in state["auction_done"]]
    if remaining and state["market"]:
        state["current_turn"] = remaining[0]
        return
    if not state["purchased"]:
        _discard_low(state)
    _activate_step3(state)
    if state["round"] == 1:
        _reorder(state)
    _set_phase(state, "resources", list(reversed(state["order"])))


def _auction_next_bidder(state: Dict, after: str) -> None:
    auction = state["auction"]
    seats = state["seat_order"]
    start = seats.index(after)
    for offset in range(1, len(seats) + 1):
        pid = seats[(start + offset) % len(seats)]
        if pid in auction["active"] and pid != auction["leader"]:
            state["current_turn"] = pid
            return
    _win_auction(state)


def _win_auction(state: Dict) -> None:
    auction = state["auction"]
    pid, number = auction["leader"], auction["plant"]
    player = state["players"][pid]
    player["money"] -= auction["bid"]
    player["plants"].append(number)
    player["plants"].sort()
    state["market"].remove(number)
    state["auction_done"].append(pid)
    state["purchased"].append(pid)
    _log(state, f'{_name(state, pid)} bought plant #{number} for {auction["bid"]} 💰.')
    _draw(state)
    _purge_obsolete(state)
    if len(player["plants"]) > state["plant_limit"]:
        state["phase"], state["current_turn"], state["new_plant"] = "replace", pid, number
        state["auction"] = None
    else:
        _next_auction(state)


def _finish_game(state: Dict) -> None:
    results = []
    for pid in state["order"]:
        player = state["players"][pid]
        powered = max(o["powered"] for o in dispatch_options(player["plants"], player["resources"], len(player["cities"])))
        results.append({"player_id": pid, "powered": powered, "cities": len(player["cities"]), "money": player["money"]})
    results.sort(key=lambda r: (r["powered"], r["money"], r["cities"]), reverse=True)
    best = tuple(results[0][key] for key in ("powered", "money", "cities"))
    state["winner_ids"] = [r["player_id"] for r in results if tuple(r[k] for k in ("powered", "money", "cities")) == best]
    state.update(game_over=True, phase="game_over", current_turn=None, final_results=results)
    _log(state, "Final networks scored. No extra income is paid in the final round.")


def _finish_building(state: Dict) -> None:
    largest = max(len(p["cities"]) for p in state["players"].values())
    if largest >= state["end_threshold"]:
        _finish_game(state)
        return
    if state["step3_pending"]:
        _activate_step3(state)
    elif state["step"] == 1 and largest >= state["step2_threshold"]:
        state["step"] = 2
        _log(state, "Step 2: two companies may now connect each city.")
        _discard_low(state)
        _activate_step3(state)
    _set_phase(state, "bureaucracy", state["order"])


def _finish_round(state: Dict) -> None:
    refill = {}
    for resource, quantity in zip(RESOURCES, REFILL[len(state["players"])][state["step"] - 1]):
        stored = sum(p["resources"][resource] for p in state["players"].values())
        amount = min(quantity, TOTAL_RESOURCES[resource] - state["resource_market"][resource] - stored)
        state["resource_market"][resource] += amount
        refill[resource] = amount
    state["round_summary"] = {"round": state["round"], "players": copy.deepcopy(state["production"]), "refill": refill}
    if state["step"] < 3 and state["market"]:
        state["deck"].append(state["market"].pop())
        _draw(state)
        _purge_obsolete(state)
    else:
        _discard_low(state)
    state.update(phase="round_end", current_turn=None, next_ready=[])


def _advance(state: Dict) -> None:
    state["phase_index"] += 1
    if state["phase_index"] < len(state["phase_order"]):
        state["current_turn"] = state["phase_order"][state["phase_index"]]
    elif state["phase"] == "resources":
        _set_phase(state, "building", list(reversed(state["order"])))
    elif state["phase"] == "building":
        _finish_building(state)
    else:
        _finish_round(state)


def _resource_dict(value: object) -> Dict:
    if not isinstance(value, dict) or set(value) - set(RESOURCES):
        raise ValueError("invalid resources")
    if any(type(v) is not int or not 0 <= v <= 24 for v in value.values()):
        raise ValueError("resource counts must be integers from 0 to 24")
    return {r: value.get(r, 0) for r in RESOURCES}


def _check_action(state: Dict, pid: str, action: Dict) -> str:
    if not isinstance(action, dict) or not isinstance(action.get("type"), str):
        raise ValueError("invalid action")
    kind = action["type"]
    fields = {"auction": {"plant", "amount"}, "bid": {"amount"}, "pass": set(),
              "buy_resources": {"resources"}, "build": {"city"}, "done": set(),
              "replace": {"plant", "resources"}, "power": {"plants", "hybrid_coal"}, "next_round": set()}
    if kind not in fields:
        raise ValueError("unknown action")
    expected = {"type", "round"} | fields[kind]
    if kind != "next_round":
        expected.add("revision")
    if set(action) != expected:
        raise ValueError("missing or unexpected action fields")
    if type(action["round"]) is not int or action["round"] != state["round"]:
        raise ValueError("stale round; refresh the game")
    if kind != "next_round" and (type(action["revision"]) is not int or action["revision"] != state["revision"]):
        raise ValueError("stale action; use the latest game state")
    if kind not in PowerGridGame.get_legal_actions(state, pid):
        raise ValueError("action is not available for this player")
    return kind


def _apply(state: Dict, pid: str, action: Dict, kind: str) -> None:
    player = state["players"][pid]
    if kind in ("auction", "bid"):
        amount = action["amount"]
        if type(amount) is not int or amount > player["money"]:
            raise ValueError("bid exceeds available money or is not an integer")
        if kind == "auction":
            number = action["plant"]
            available = state["market"] if state["step"] == 3 else state["market"][:4]
            if type(number) is not int or number not in available or number == STEP_THREE or amount < number:
                raise ValueError("choose a current-market plant and meet its minimum bid")
            state["auction"] = {"plant": number, "bid": amount, "leader": pid, "initiator": pid,
                                "active": [p for p in state["seat_order"] if p not in state["auction_done"]]}
        else:
            if amount <= state["auction"]["bid"]:
                raise ValueError("raise the current bid")
            state["auction"].update(bid=amount, leader=pid)
        _log(state, f'{_name(state, pid)} bid {amount} 💰 on #{state["auction"]["plant"]}.')
        _auction_next_bidder(state, pid)
    elif kind == "pass":
        if state["auction"]:
            state["auction"]["active"].remove(pid)
            _auction_next_bidder(state, pid)
        else:
            state["auction_done"].append(pid)
            _next_auction(state)
    elif kind == "buy_resources":
        quantities = _resource_dict(action["resources"])
        if not any(quantities.values()):
            raise ValueError("select at least one resource")
        if any(quantities[r] > state["resource_market"][r] for r in RESOURCES):
            raise ValueError("not enough resources in the market")
        stored = {r: player["resources"][r] + quantities[r] for r in RESOURCES}
        if not storage_valid(player["plants"], stored):
            raise ValueError("resources exceed compatible plant storage")
        price = sum(sum(resource_prices(r, state["resource_market"][r])[:quantities[r]]) for r in RESOURCES)
        if price > player["money"]:
            raise ValueError("not enough money")
        player["money"] -= price
        player["resources"] = stored
        for resource in RESOURCES:
            state["resource_market"][resource] -= quantities[resource]
        _log(state, f'{_name(state, pid)} bought {sum(quantities.values())} fuel for {price} 💰.')
    elif kind == "build":
        city = action["city"]
        if not isinstance(city, str):
            raise ValueError("invalid city")
        quote = next((q for q in build_quotes(state, pid) if q["city"] == city and q["affordable"]), None)
        if quote is None:
            raise ValueError("city unavailable or unaffordable")
        player["money"] -= quote["cost"]
        player["cities"].append(city)
        state["cities"][city].append(pid)
        _log(state, f'{_name(state, pid)} connected {CITIES[city]["name"]} for {quote["cost"]} 💰.')
        _purge_obsolete(state)
    elif kind == "done":
        _advance(state)
    elif kind == "replace":
        number = action["plant"]
        if type(number) is not int or number not in player["plants"] or number == state["new_plant"]:
            raise ValueError("replace one of your old plants")
        retained = _resource_dict(action["resources"])
        remaining = [n for n in player["plants"] if n != number]
        if any(retained[r] > player["resources"][r] for r in RESOURCES) or not storage_valid(remaining, retained):
            raise ValueError("invalid retained resources")
        player["plants"], player["resources"] = remaining, retained
        state["discarded"].append(number)
        state["new_plant"] = None
        _log(state, f'{_name(state, pid)} retired plant #{number}.')
        _next_auction(state)
    elif kind == "power":
        plants, coal = action["plants"], action["hybrid_coal"]
        if (not isinstance(plants, list) or len(plants) > 4 or any(type(n) is not int for n in plants)
                or len(set(plants)) != len(plants) or type(coal) is not int):
            raise ValueError("invalid production selection")
        option = next((o for o in dispatch_options(player["plants"], player["resources"], len(player["cities"]))
                       if o["plants"] == sorted(plants) and o["hybrid_coal"] == coal), None)
        if option is None:
            raise ValueError("selected plants lack fuel")
        for resource in RESOURCES:
            player["resources"][resource] -= option["fuel"][resource]
        player["money"] += option["income"]
        state["production"].append({"player_id": pid, **option})
        _log(state, f'{_name(state, pid)} powered {option["powered"]} cities, earning {option["income"]} 💰.')
        _advance(state)
    elif kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["players"]):
            state["round"] += 1
            state.update(next_ready=[], production=[], auction_done=[], purchased=[], round_summary=None)
            _activate_step3(state)
            _reorder(state)
            _next_auction(state)


class PowerGridGame:
    game_id = "power_grid"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 6:
            raise ValueError("Power Grid requires 2–6 players")
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"regions", "seed"}:
            raise ValueError("invalid Power Grid configuration")
        seed = cfg.get("seed", secrets.token_hex(16))
        if type(seed) is not int and not (isinstance(seed, str) and len(seed) <= 80):
            raise ValueError("invalid seed")
        count, removed, limit, step2, end = PLAYER_RULES[len(players)]
        regions = cfg.get("regions", [])
        if not isinstance(regions, list) or any(not isinstance(r, str) or r not in REGIONS for r in regions):
            raise ValueError("invalid regions")
        regions = regions or list(REGIONS[:count])
        if len(regions) != count or len(set(regions)) != count:
            raise ValueError(f"select exactly {count} different regions")
        cities = {c: [] for c, data in CITIES.items() if data["region"] in regions}
        reached = {next(iter(cities))}
        while True:
            expanded = reached | {b for a, b, _ in EDGES if a in reached and b in cities} | {a for a, b, _ in EDGES if b in reached and a in cities}
            if expanded == reached:
                break
            reached = expanded
        if len(reached) != len(cities):
            raise ValueError("selected regions must be connected")
        meta = {p["player_id"]: {k: p[k] for k in ("player_id", "name", "seat", "is_bot") if k in p} for p in players}
        if len(meta) != len(players) or any(not isinstance(pid, str) or not pid for pid in meta):
            raise ValueError("player IDs must be unique non-empty strings")
        seats = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        rng = random.Random(seed)
        order = list(seats)
        rng.shuffle(order)
        deck = [n for n in PLANTS if n > 10 and n != 13]
        rng.shuffle(deck)
        state = {"version": 1, "seed": seed, "config": {"regions": list(regions)},
                 "player_meta": meta, "seat_order": seats, "order": order,
                 "players": {pid: {"money": 50, "plants": [], "cities": [], "resources": empty_resources()} for pid in seats},
                 "cities": cities, "market": list(range(3, 11)), "deck": [13] + deck[removed:] + [STEP_THREE],
                 "removed": deck[:removed], "discarded": [], "resource_market": dict(INITIAL_MARKET),
                 "round": 1, "revision": 0, "step": 1, "step3_pending": False,
                 "plant_limit": limit, "step2_threshold": step2, "end_threshold": end,
                 "auction": None, "auction_done": [], "purchased": [], "new_plant": None,
                 "phase": "auction", "current_turn": order[0], "phase_order": [], "phase_index": 0,
                 "production": [], "round_summary": None, "next_ready": [], "log": [],
                 "game_over": False, "winner_ids": [], "final_results": []}
        _log(state, "Classic Germany · each company starts with 50 💰.")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_end":
            return [] if player_id in state["next_ready"] else ["next_round"]
        if player_id != state["current_turn"]:
            return []
        if state["phase"] == "auction":
            if state["auction"]:
                return ["bid", "pass"] if state["players"][player_id]["money"] > state["auction"]["bid"] else ["pass"]
            return ["auction"] if state["round"] == 1 else ["auction", "pass"]
        return {"resources": ["buy_resources", "done"], "building": ["build", "done"],
                "bureaucracy": ["power"], "replace": ["replace"]}.get(state["phase"], [])

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        try:
            kind = _check_action(state, player_id, action)
            draft = copy.deepcopy(state)
            _apply(draft, player_id, action, kind)
        except ValueError as error:
            return [], str(error)
        draft["revision"] += 1
        state.clear()
        state.update(draft)
        return [{"type": "power_grid:update", "payload": {"phase": state["phase"], "round": state["round"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["seat_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            players.append({"player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", 0),
                            "is_bot": bool(meta.get("is_bot")), "cities": player["cities"],
                            "plants": [PLANTS[n] for n in player["plants"]], "resources": player["resources"],
                            "capacity": sum(PLANTS[n]["output"] for n in player["plants"]),
                            "money": player["money"] if pid == viewer_id or state["game_over"] else None})
        own = state["players"].get(viewer_id)
        market = [{**PLANTS[n], "available": state["step"] == 3 or i < 4}
                  for i, n in enumerate(state["market"]) if n != STEP_THREE]
        buy_limits = empty_resources()
        if own:
            for resource in RESOURCES:
                for amount in range(1, state["resource_market"][resource] + 1):
                    test = {**own["resources"], resource: own["resources"][resource] + amount}
                    if not storage_valid(own["plants"], test):
                        break
                    if sum(resource_prices(resource, state["resource_market"][resource])[:amount]) > own["money"]:
                        break
                    buy_limits[resource] = amount
        view = {key: state[key] for key in ("config", "round", "revision", "step", "step3_pending", "phase", "current_turn",
                "order", "seat_order", "auction", "auction_done", "purchased", "new_plant", "plant_limit", "step2_threshold",
                "end_threshold", "next_ready", "round_summary", "production", "winner_ids", "final_results", "game_over", "log")}
        view.update(game_id=PowerGridGame.game_id, you=viewer_id, players=players, market=market,
                    cities=[{**CITIES[c], "owners": owners} for c, owners in state["cities"].items()],
                    edges=[{"a": a, "b": b, "cost": cost} for a, b, cost in EDGES if a in state["cities"] and b in state["cities"]],
                    region_colors=REGION_COLORS, deck_count=sum(n != STEP_THREE for n in state["deck"]),
                    resources={r: {"count": state["resource_market"][r], "prices": resource_prices(r, state["resource_market"][r]),
                                   "refill": REFILL[len(players)][state["step"] - 1][i]} for i, r in enumerate(RESOURCES)},
                    buy_limits=buy_limits, build_quotes=build_quotes(state, viewer_id) if own else [],
                    dispatch_options=dispatch_options(own["plants"], own["resources"], len(own["cities"])) if own else [],
                    legal_actions=PowerGridGame.get_legal_actions(state, viewer_id))
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        view = PowerGridGame.get_public_view(state, bot_id)
        action = choose_bot_action(view)
        if action is None:
            return None
        action["round"] = view["round"]
        if action["type"] != "next_round":
            action["revision"] = view["revision"]
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def choose_bot_action(view: Dict) -> Optional[Dict]:
    """Pure policy: deliberately receives no deck, seed, or opponents' cash."""
    if not view["legal_actions"]:
        return None
    if "next_round" in view["legal_actions"]:
        return {"type": "next_round"}
    own = next(p for p in view["players"] if p["player_id"] == view["you"])
    plants = [p["id"] for p in own["plants"]]
    money, city_count = own["money"], len(own["cities"])
    prices = {r: view["resources"][r]["prices"] for r in RESOURCES}

    def fuel_value(fuel):
        return sum(fuel[r] * (prices[r][0] if prices[r] else 9) for r in RESOURCES)

    def plant_limit(plant):
        worst = min((p["output"] for p in own["plants"]), default=0) if len(plants) >= view["plant_limit"] else 0
        gain = plant["output"] - worst
        if gain <= 0 and plant["resource"] != "green":
            return 0
        if not plants:
            return min(money, plant["id"] + 5)
        if own["capacity"] >= view["end_threshold"] and gain <= 1:
            return 0
        reserve = 8 if city_count < 2 else 12
        return max(0, min(money - reserve, plant["id"] + max(0, gain * 3)))

    if view["phase"] == "auction":
        if view["auction"]:
            plant = next(p for p in view["market"] if p["id"] == view["auction"]["plant"])
            bid = view["auction"]["bid"] + 1
            return {"type": "bid", "amount": bid} if bid <= plant_limit(plant) and "bid" in view["legal_actions"] else {"type": "pass"}
        choices = [p for p in view["market"] if p["available"] and p["id"] <= money]
        choices = [p for p in choices if view["round"] == 1 or p["id"] <= plant_limit(p)]
        if not choices:
            return {"type": "pass"}
        if view["round"] == 1:
            chosen = min(choices, key=lambda p: (p["id"] + p["intake"] * (7 if p["resource"] == "garbage" else 2), p["id"]))
        else:
            chosen = max(choices, key=lambda p: (p["output"] * 9 - p["id"] * .35 - p["intake"] * 2, p["id"]))
        return {"type": "auction", "plant": chosen["id"], "amount": chosen["id"]}
    if view["phase"] == "replace":
        retired = min((p for p in own["plants"] if p["id"] != view["new_plant"]), key=lambda p: (p["output"], -p["intake"], p["id"]))
        remaining = [p for p in plants if p != retired["id"]]
        keep = empty_resources()
        for resource in sorted(RESOURCES, key=lambda r: prices[r][0] if prices[r] else 9, reverse=True):
            for _ in range(own["resources"][resource]):
                keep[resource] += 1
                if not storage_valid(remaining, keep):
                    keep[resource] -= 1
                    break
        return {"type": "replace", "plant": retired["id"], "resources": keep}
    if view["phase"] == "resources":
        # Enumerate full production plans using the finite market; choose net income
        # while reserving a first house and funding a little expansion.
        supply = {r: own["resources"][r] + view["resources"][r]["count"] for r in RESOURCES}
        target = min(own["capacity"], max(city_count + 2, 1))
        choices = []
        for option in dispatch_options(plants, supply, target):
            buy = {r: max(0, option["fuel"][r] - own["resources"][r]) for r in RESOURCES}
            total = {r: buy[r] + own["resources"][r] for r in RESOURCES}
            cost = sum(sum(prices[r][:buy[r]]) for r in RESOURCES)
            reserve = 10 if not city_count else 0
            if cost <= money - reserve and storage_valid(plants, total):
                choices.append((option["income"] - cost, option["powered"], -cost, buy))
        buy = max(choices, key=lambda row: row[:3])[3] if choices else empty_resources()
        return {"type": "buy_resources", "resources": buy} if any(buy.values()) else {"type": "done"}
    if view["phase"] == "building":
        affordable = [q for q in view["build_quotes"] if q["affordable"]]
        target = min(22, own["capacity"] + 1)
        if affordable and city_count < target:
            if not city_count:
                degree = {c["id"]: sum(e["cost"] <= 11 and c["id"] in (e["a"], e["b"]) for e in view["edges"]) for c in view["cities"]}
                chosen = max(affordable, key=lambda q: (degree[q["city"]], -q["cost"]))
            else:
                chosen = affordable[0]
            return {"type": "build", "city": chosen["city"]}
        return {"type": "done"}
    if view["phase"] == "bureaucracy":
        option = max(view["dispatch_options"], key=lambda o: (o["powered"], -fuel_value(o["fuel"]), -len(o["plants"])))
        return {"type": "power", "plants": option["plants"], "hybrid_coal": option["hybrid_coal"]}
    return None
