"""Terra Nova base game: public, turn-based rules and atomic legal choices.

The data module transcribes the published base-game components.  Actions offered
by the server are also the validation boundary; staged shovel actions retain the
reachability of the board before either terrain was transformed.
"""

import copy
import random
from collections import Counter, deque
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game import terra_nova_data as D

CONFIG_SCHEMA = {
    "type": "object", "properties": {"seed": {"type": "integer"}},
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object", "properties": {
        "type": {"type": "string"}, "round": {"type": "integer", "minimum": 1, "maximum": 5},
        "faction": {"type": "string"}, "cell_id": {"type": "string"},
        "building": {"enum": ["trading_post", "palace_left", "palace_right"]},
        "bonus_id": {"type": "string"}, "town_id": {"type": "string"},
        "source": {"type": "string"}, "bridge_id": {"type": "string"},
        "amount": {"type": "integer", "minimum": 1, "maximum": 8},
        "build": {"type": "boolean"},
    }, "required": ["type", "round"], "additionalProperties": False,
}
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
BUILDING_LIMITS = {"house": 8, "trading_post": 4, "palace_left": 1, "palace_right": 1}
BUILDING_VALUES = {"house": 1, "trading_post": 2, "palace_left": 3, "palace_right": 3}
TERRAIN_RING = ["lake", "forest", "wasteland", "desert", "swamp"]
POWER_ACTIONS = {
    "bridge_3": {"name": "🌉 Bridge", "power": 3, "kind": "bridge"},
    "bridge_4": {"name": "🌉 Bridge", "power": 4, "kind": "bridge"},
    "sailing": {"name": "⛵ Advance sailing", "power": 4, "kind": "sailing"},
    "coins": {"name": "💰 Gain 7 coins", "power": 4, "kind": "coins"},
    "spade_1": {"name": "⛏️ One free spade", "power": 4, "kind": "spade"},
    "spade_2": {"name": "⛏️ Two free spades", "power": 6, "kind": "spade"},
}


def charge_power(player: Dict, amount: int) -> int:
    """Charge I before II, retaining exactly the original eight tokens."""
    charged = 0
    for low, high in (("I", "II"), ("II", "III")):
        moved = min(amount, player["power"][low])
        player["power"][low] -= moved
        player["power"][high] += moved
        amount -= moved
        charged += moved
    return charged


def _spend_power(player: Dict, amount: int) -> None:
    player["power"]["III"] -= amount
    player["power"]["I"] += amount


def _cell_map(state: Dict) -> Dict:
    return {cell["id"]: cell for cell in state["board"]}


def _neighbors(state: Dict) -> Dict:
    coords = {(cell["row"], cell["col"]): cell["id"] for cell in state["board"]}
    result = {}
    for cell in state["board"]:
        row, col = cell["row"], cell["col"]
        diagonal = (0, 1) if row % 2 else (-1, 0)
        positions = [(row, col - 1), (row, col + 1)]
        positions += [(row + dr, col + dc) for dr in (-1, 1) for dc in diagonal]
        result[cell["id"]] = {coords[pos] for pos in positions if pos in coords}
    return result


def _adjacency(state: Dict) -> Dict:
    result = _neighbors(state)
    for bridge in state["bridges"]:
        a, b = bridge["cell_ids"]
        result[a].add(b)
        result[b].add(a)
    return result


def _owned_cells(state: Dict, pid: str) -> List[Dict]:
    return [cell for cell in state["board"] if cell["owner"] == pid and cell["building"]]


def _sailing(state: Dict, pid: str, final: bool = False) -> int:
    pdata = state["players"][pid]
    bonus = D.BONUS_TILES.get(pdata["bonus_tile"], {})
    return pdata["sailing"] + (0 if final else bonus.get("sailing_bonus", 0))


def reachable_cells(state: Dict, pid: str, final: bool = False, sources: Optional[List[str]] = None) -> set:
    """Reachable land via adjacency/bridges or a continuous chain of river hexes."""
    cells, neighbors, adjacent = _cell_map(state), _neighbors(state), _adjacency(state)
    sources = sources if sources is not None else [cell["id"] for cell in _owned_cells(state, pid)]
    reach, sailing = set(sources), _sailing(state, pid, final)
    for source in sources:
        reach.update(nid for nid in adjacent[source] if cells[nid]["terrain"] != "river")
        if sailing <= 0:
            continue
        queue = deque((nid, 1) for nid in neighbors[source] if cells[nid]["terrain"] == "river")
        visited = set()
        while queue:
            river, distance = queue.popleft()
            if river in visited:
                continue
            visited.add(river)
            for nid in neighbors[river]:
                if cells[nid]["terrain"] != "river":
                    reach.add(nid)
                elif distance < sailing and nid not in visited:
                    queue.append((nid, distance + 1))
    return reach


def _components(state: Dict, pid: str, final: bool = False) -> List[List[str]]:
    own = {cell["id"] for cell in _owned_cells(state, pid)}
    adjacent = _adjacency(state)
    if final:
        adjacent = {cid: reachable_cells(state, pid, True, [cid]) for cid in own}
    else:
        neighbors = _neighbors(state)
        for town in state["towns"]:
            if town["owner"] == pid and town.get("river"):
                shores = own & neighbors[town["river"]]
                for cid in shores:
                    adjacent[cid].update(shores)
    components = []
    while own:
        first = min(own)
        component, pending = set(), [first]
        while pending:
            cid = pending.pop()
            if cid not in own:
                continue
            own.remove(cid)
            component.add(cid)
            pending.extend(adjacent[cid] & own)
        components.append(sorted(component))
    return components


def _has_palace(player: Dict, side: str) -> bool:
    return bool(player["buildings"]["palace_" + side])


def spade_cost(state: Dict, pid: str, terrain: str) -> int:
    pdata = state["players"][pid]
    home = D.FACTIONS[pdata["faction"]]["terrain"]
    delta = abs(TERRAIN_RING.index(home) - TERRAIN_RING.index(terrain))
    amount = min(delta, len(TERRAIN_RING) - delta)
    if pdata["faction"] == "golems" and _has_palace(pdata, "left") and amount == 2:
        amount = 1
    return amount


def _score_event(state: Dict, pid: str, event: str, count: int = 1) -> None:
    tile = D.ROUND_TILES[state["round_scoring"][state["round"] - 1]]
    if tile["event"] == event:
        state["players"][pid]["score"] += tile["points"] * count


def _use_spades(state: Dict, pid: str, count: int) -> None:
    _score_event(state, pid, "spade", count)
    if state["players"][pid]["faction"] == "goblins":
        charge_power(state["players"][pid], 2 * count)


def _notify_building(state: Dict, pid: str, cell_id: str, event: str) -> None:
    cells, adjacency = _cell_map(state), _adjacency(state)
    counts = Counter(cells[nid]["owner"] for nid in adjacency[cell_id] if cells[nid]["building"] and cells[nid]["owner"] != pid)
    for other, amount in counts.items():
        charge_power(state["players"][other], amount)
    for other, player in state["players"].items():
        if other == pid:
            continue
        if event == "house" and player["faction"] == "inventors":
            charge_power(player, 2 if len(state["turn_order"]) == 2 else 1)
        if event != "house" and player["faction"] == "felines":
            player["coins"] += 2 if len(state["turn_order"]) == 2 else 1


def _build(state: Dict, pid: str, cell_id: str, building: str, setup: bool = False) -> None:
    cell, player = _cell_map(state)[cell_id], state["players"][pid]
    if cell["building"]:
        player["buildings"][cell["building"]] -= 1
    cell["owner"], cell["building"] = pid, building
    player["buildings"][building] += 1
    if setup:
        return
    event = "palace" if building.startswith("palace_") else building
    _score_event(state, pid, event)
    if event == "house" and player["faction"] == "inventors" and _has_palace(player, "right"):
        player["score"] += 2
    if event == "trading_post" and player["faction"] == "druids" and _has_palace(player, "right"):
        player["score"] += 3
    _notify_building(state, pid, cell_id, event)
    if building == "palace_left":
        if player["faction"] == "goblins":
            charge_power(player, 6)
        elif player["faction"] == "merfolk" and player["sailing"] < len(D.SAILING_POINTS) - 1:
            _advance_sailing(state, pid)
        elif player["faction"] == "ifrits":
            state["palace_pending"] = "ifrit_house"


def _advance_sailing(state: Dict, pid: str) -> None:
    player = state["players"][pid]
    if player["sailing"] < len(D.SAILING_POINTS) - 1:
        player["sailing"] += 1
        player["score"] += D.SAILING_POINTS[player["sailing"]]
        _score_event(state, pid, "sailing")


def income_for_player(state: Dict, pid: str) -> Dict:
    player = state["players"][pid]
    faction = D.FACTIONS[player["faction"]]
    coins = faction.get("income_coins", 0) + sum(faction["house_income"][:player["buildings"]["house"]])
    power = faction.get("income_power", 0) + sum(faction.get("house_power_income", [])[:player["buildings"]["house"]])
    for income in faction["trading_post_income"][:player["buildings"]["trading_post"]]:
        coins += income.get("coins", 0)
        power += income.get("power", 0)
    if _has_palace(player, "left"):
        coins += faction["palace_left_income"].get("coins", 0)
        power += faction["palace_left_income"].get("power", 0)
    bonus = D.BONUS_TILES[player["bonus_tile"]]["income"]
    return {"coins": coins + bonus.get("coins", 0), "power": power + bonus.get("power", 0)}


def _start_round(state: Dict) -> None:
    state["phase"] = "action"
    state["current_turn"] = state["start_player"]
    state["passed_order"], state["next_ready"], state["power_used"] = [], [], []
    state["round_summary"], state["pending"] = [], None
    for pid, player in state["players"].items():
        player["passed"], player["special_used"] = False, []
        income = income_for_player(state, pid)
        player["coins"] += income["coins"]
        charge_power(player, income["power"])
        player["round_start_score"] = player["score"]
        player["last_income"] = income
    state["log"].append(f"Round {state['round']}: income collected; {state['players'][state['current_turn']]['name']} begins.")


def _town_threshold(player: Dict) -> int:
    return 6 if _has_palace(player, "right") and D.FACTIONS[player["faction"]].get("town_threshold_6", False) else 7


def _check_towns(state: Dict, pid: str) -> None:
    """Existing towns absorb connected new buildings before checking fresh towns."""
    cells = _cell_map(state)
    player = state["players"][pid]
    pending = []
    for component in _components(state, pid):
        prior = {cells[cid]["town_id"] for cid in component if cells[cid]["town_id"]}
        if prior:
            for cid in component:
                if not cells[cid]["town_id"]:
                    cells[cid]["town_id"] = sorted(prior)[0]
            for town in state["towns"]:
                if town["id"] in prior:
                    town["cell_ids"] = sorted(cid for cid in component if cells[cid]["town_id"] == town["id"])
            continue
        if len(component) >= 4 and sum(BUILDING_VALUES[cells[cid]["building"]] for cid in component) >= _town_threshold(player):
            pending.append(component)
    state["town_pending"] = pending if len(player["towns"]) < len(D.TOWN_TILES) else []
    if state["town_pending"]:
        state["phase"] = "town_choice"


def _after_action(state: Dict, pid: str) -> None:
    state["phase"] = "post_action"
    _check_towns(state, pid)
    if not state["town_pending"] and state.get("palace_pending"):
        state["phase"] = "palace_choice"


def _next_turn(state: Dict) -> None:
    if len(state["passed_order"]) == len(state["turn_order"]):
        state["phase"], state["current_turn"] = "round_end", None
        state["next_ready"] = []
        state["round_summary"] = [{"player_id": pid, "name": pdata["name"], "score": pdata["score"], "round_points": pdata["score"] - pdata["round_start_score"], "coins": pdata["coins"]} for pid, pdata in state["players"].items()]
        if state["round"] < 5:
            for bonus in state["bonus_market"].values():
                bonus["coins"] += 1
        state["log"].append(f"Round {state['round']} complete. Everyone must confirm Next Round.")
        return
    order, index = state["turn_order"], state["turn_order"].index(state["current_turn"])
    while True:
        index = (index + 1) % len(order)
        if not state["players"][order[index]]["passed"]:
            state["current_turn"], state["phase"] = order[index], "action"
            return


def _pass_points(state: Dict, pid: str) -> int:
    player, cells = state["players"][pid], _cell_map(state)
    bonus = D.BONUS_TILES[player["bonus_tile"]]
    event, points = bonus.get("pass_event"), bonus.get("pass_points", 0)
    count = sum(player["buildings"][kind] for kind in ("palace_left", "palace_right")) if event == "palace" else player["sailing"] if event == "sailing" else player["buildings"].get(event, 0)
    result = count * points
    if player["faction"] == "golems":
        trading = player["buildings"]["trading_post"]
        result += max(2, trading) if trading else 0
    if player["faction"] == "ifrits" and _has_palace(player, "right"):
        neighbors = _neighbors(state)
        result += sum(any(len(neighbors[cid]) < 6 for cid in component) for component in _components(state, pid))
    if player["faction"] == "felines" and _has_palace(player, "right"):
        neighbors = _neighbors(state)
        result += sum(not any(cells[nid]["terrain"] == "river" for nid in neighbors[cell["id"]]) for cell in _owned_cells(state, pid))
    return result


def _finish_game(state: Dict) -> None:
    sizes = {pid: max((len(part) for part in _components(state, pid, True)), default=0) for pid in state["turn_order"]}
    awards, rank = {}, 0
    for size in sorted(set(sizes.values()), reverse=True):
        tied = [pid for pid in state["turn_order"] if sizes[pid] == size]
        points = sum(([12, 8, 4, 0] + [0] * 4)[rank:rank + len(tied)]) // len(tied)
        for pid in tied:
            awards[pid] = points
        rank += len(tied)
    state["final_scoring"] = []
    for pid, player in state["players"].items():
        in_game = player["score"]
        player["coins"] += player["power"]["III"]
        _spend_power(player, player["power"]["III"])
        coins = player["coins"]
        resources = coins // 3
        player["score"] += resources + awards[pid]
        state["final_scoring"].append({"player_id": pid, "name": player["name"], "in_game": in_game, "coins": coins, "resources": resources, "largest_area": sizes[pid], "area_points": awards[pid], "total": player["score"]})
    high = max(p["score"] for p in state["players"].values())
    state["winner"] = [pid for pid, player in state["players"].items() if player["score"] == high]
    state["phase"], state["game_over"], state["current_turn"] = "game_over", True, None
    state["log"].append("Five rounds complete. Coins and the largest connected areas have been scored.")


def _option(state: Dict, action_type: str, label: str, **fields) -> Dict:
    description = fields.pop("description", None)
    action = {"type": action_type, "round": state["round"], **fields}
    option = {"action": action, "label": label}
    if description:
        option["description"] = description
    if "cell_id" in fields:
        option["cell_id"] = fields["cell_id"]
    return option


def _power_cost(player: Dict, cost: int) -> int:
    return cost - (1 if player["faction"] == "ifrits" else 0)


def _exchange_options(state: Dict, pid: str) -> List[Dict]:
    player = state["players"][pid]
    options = [_option(state, "exchange_power", f"🟣 {amount} → 💰 {amount}", amount=amount) for amount in range(1, player["power"]["III"] + 1)]
    if player["faction"] == "druids":
        options += [_option(state, "druid_exchange", f"🟣 {3 * amount} → ⭐ {2 * amount}", amount=amount) for amount in range(1, player["power"]["III"] // 3 + 1)]
    return options


def _bridge_options(state: Dict, pid: str, source: str) -> List[Dict]:
    if sum(bridge["owner"] == pid for bridge in state["bridges"]) >= 3:
        return []
    existing, owned = {bridge["id"] for bridge in state["bridges"]}, {cell["id"] for cell in _owned_cells(state, pid)}
    options = []
    for site in D.BRIDGE_SITES:
        if site["id"] not in existing and owned & set(site["cell_ids"]):
            option = _option(state, "build_bridge", "🌉 Bridge " + " ↔ ".join(site["cell_ids"]), source=source, bridge_id=site["id"])
            option["cell_ids"] = list(site["cell_ids"])
            options.append(option)
    return options


def _terrain_options(state: Dict, pid: str, source: str = "paid", staged: bool = False) -> List[Dict]:
    player, cells = state["players"][pid], _cell_map(state)
    home = D.FACTIONS[player["faction"]]["terrain"]
    pending = state["pending"] if staged else None
    reachable = set(pending["reachable"]) if staged else reachable_cells(state, pid)
    if source == "djinn_house":
        reachable = {cid for cid, cell in cells.items() if cell["terrain"] == home}
    elif source == "ifrit_house":
        reachable = {cid for cid, near in _neighbors(state).items() if len(near) < 6}
    elif source == "desert_transform":
        near = _neighbors(state)
        reachable = set().union(*(near[cell["id"]] for cell in _owned_cells(state, pid)))
    options = []
    for cid in sorted(reachable):
        cell = cells[cid]
        if cell["owner"] or cell["terrain"] == "river":
            continue
        spades = spade_cost(state, pid, cell["terrain"])
        if staged:
            if spades == 0 and source == "spade_2" or spades > pending["remaining"] and not pending["top_up"]:
                continue
            cost = 6 * max(0, spades - pending["remaining"])
        else:
            cost = 6 * spades if source == "paid" else 0
        if source == "desert_transform" and spades == 0:
            continue
        build_cost = 0 if source in ("djinn_house", "ifrit_house", "inventor_post") else 4
        building = "trading_post" if source == "inventor_post" else "house"
        can_build = player["buildings"][building] < BUILDING_LIMITS[building] and (not staged or not pending["built"])
        choices = (True,) if source in ("djinn_house", "ifrit_house", "inventor_post") or spades == 0 else (False, True)
        for build in choices:
            if build and not can_build:
                continue
            total = cost + (build_cost if build else 0)
            if total > player["coins"]:
                continue
            action_type = "terraform_target" if staged else "build_transform"
            label = ("🏪 Trading post" if building == "trading_post" else "🏠 Build house") if build else "⛏️ Transform terrain"
            options.append(_option(state, action_type, f"{label} · {cid} · 💰 {total}", cell_id=cid, build=build, source=source, description=f"{spades if source not in ('desert_transform', 'ifrit_house', 'inventor_post') else 0} spade(s); {home}."))
    return options


def _terraform_build_options(state: Dict, pid: str) -> List[Dict]:
    """Two spades may transform both hexes before selecting the one house."""
    pending, player = state["pending"], state["players"][pid]
    if pending["source"] != "spade_2" or pending["built"] or player["coins"] < 4 or player["buildings"]["house"] >= BUILDING_LIMITS["house"]:
        return []
    cells = _cell_map(state)
    return [_option(state, "terraform_build", f"🏠 Build on transformed terrain · {cid} · 💰 4", cell_id=cid)
            for cid in pending["used"] if not cells[cid]["owner"]]


def _continue_terraform(state: Dict, pid: str) -> None:
    pending = state["pending"]
    can_transform = pending["remaining"] > 0 and bool(_terrain_options(state, pid, pending["source"], True))
    if not can_transform and not _terraform_build_options(state, pid):
        state["pending"] = None
        _after_action(state, pid)


def _water_town_options(state: Dict, pid: str) -> List[Dict]:
    player = state["players"][pid]
    if player["faction"] != "merfolk" or len(player["towns"]) == len(D.TOWN_TILES):
        return []
    cells, neighbors, components = _cell_map(state), _neighbors(state), _components(state, pid)
    options = []
    for river in state["board"]:
        if river["terrain"] != "river" or river.get("town_id"):
            continue
        connected = set().union(*(set(part) for part in components if set(part) & neighbors[river["id"]]))
        if len(connected) >= 4 and not any(cells[cid]["town_id"] for cid in connected) and sum(BUILDING_VALUES[cells[cid]["building"]] for cid in connected) >= _town_threshold(player):
            option = _option(state, "found_water_town", f"🏘️ Found river town · {river['id']}", cell_id=river["id"])
            option["cell_ids"] = sorted(connected)
            options.append(option)
    return options


def action_options(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["players"] or state["game_over"]:
        return []
    phase, player = state["phase"], state["players"][pid]
    if phase == "round_end":
        return [] if pid in state["next_ready"] else _exchange_options(state, pid) + [_option(state, "next_round", "Final Scoring" if state["round"] == 5 else "Next Round")]
    if state["current_turn"] != pid:
        return []
    if phase == "choose_faction":
        used = {D.FACTIONS[p["faction"]]["terrain"] for p in state["players"].values() if p["faction"]}
        return [_option(state, "choose_faction", faction["name"], faction=fid, description=faction.get("ability", "")) for fid, faction in D.FACTIONS.items() if faction["terrain"] not in used]
    if phase == "setup_house":
        home = D.FACTIONS[player["faction"]]["terrain"]
        return [_option(state, "setup_house", f"🏠 Start house · {cell['id']}", cell_id=cell["id"]) for cell in state["board"] if cell["terrain"] == home and not cell["owner"]]
    if phase == "choose_bonus":
        return [_option(state, "choose_bonus", D.BONUS_TILES[bid]["name"], bonus_id=bid) for bid in state["bonus_market"]]
    if phase == "town_choice":
        return [_option(state, "choose_town", tile["name"], town_id=tid) for tid, tile in D.TOWN_TILES.items() if tid not in player["towns"]]
    if phase == "palace_choice":
        return _terrain_options(state, pid, "ifrit_house") + [_option(state, "skip_palace", "Skip free house")]
    if phase == "terraform":
        pending = state["pending"]
        options = _terrain_options(state, pid, pending["source"], True) if pending["remaining"] else []
        options += _terraform_build_options(state, pid)
        if pending["used"]:
            options.append(_option(state, "finish_terraform", "Finish terraforming"))
        return options
    if phase == "post_action":
        return _exchange_options(state, pid) + _water_town_options(state, pid) + [_option(state, "end_turn", "End Turn")]
    if phase != "action":
        return []
    options = _exchange_options(state, pid) + _terrain_options(state, pid)
    cells, adjacency = _cell_map(state), _adjacency(state)
    for cell in _owned_cells(state, pid):
        kinds = ["trading_post"] if cell["building"] == "house" else ["palace_left", "palace_right"] if cell["building"] == "trading_post" else []
        for building in kinds:
            if player["buildings"][building] >= BUILDING_LIMITS[building]:
                continue
            neighbor = any(cells[nid]["owner"] not in (None, pid) for nid in adjacency[cell["id"]])
            feline = player["faction"] == "felines" and _has_palace(player, "left")
            cost = (5 if neighbor else 7) if feline else (7 if neighbor else 10)
            cost = cost if building == "trading_post" else 14
            if player["coins"] >= cost:
                options.append(_option(state, "upgrade", f"{'🏪 Trading post' if building == 'trading_post' else '🏰 ' + building.replace('_', ' ')} · {cell['id']} · 💰 {cost}", cell_id=cell["id"], building=building, source="paid"))
            if building == "trading_post" and player["faction"] == "merfolk" and _has_palace(player, "right") and "merfolk_upgrade" not in player["special_used"]:
                options.append(_option(state, "upgrade", f"🏪 Free trading post · {cell['id']}", cell_id=cell["id"], building=building, source="merfolk_upgrade"))
    if player["sailing"] < len(D.SAILING_POINTS) - 1 and player["coins"] >= 8:
        options.append(_option(state, "advance_sailing", "⛵ Advance sailing · 💰 8", source="paid"))
    if player["coins"] >= 10:
        options += _bridge_options(state, pid, "paid")
    for source, power in POWER_ACTIONS.items():
        cost = _power_cost(player, power["power"])
        if source in state["power_used"] or player["power"]["III"] < cost:
            continue
        kind = power["kind"]
        if kind == "bridge":
            power_options = _bridge_options(state, pid, source)
            for option in power_options:
                option["label"] += f" · 🟣 {cost}"
            options += power_options
        elif kind == "sailing" and player["sailing"] < len(D.SAILING_POINTS) - 1:
            options.append(_option(state, "advance_sailing", f"⛵ Advance sailing · 🟣 {cost}", source=source))
        elif kind == "coins":
            options.append(_option(state, "power_coins", f"💰 Gain 7 coins · 🟣 {cost}", source=source))
        elif kind == "spade" and _can_start_terraform(state, pid, source):
            options.append(_option(state, "start_terraform", f"{power['name']} · 🟣 {cost}", source=source))
    bonus = D.BONUS_TILES[player["bonus_tile"]]
    if bonus.get("special") == "spade" and "bonus_spade" not in player["special_used"] and _can_start_terraform(state, pid, "bonus_spade"):
        options.append(_option(state, "start_terraform", "⛏️ Bonus tile: one free spade", source="bonus_spade"))
    if _has_palace(player, "left"):
        faction = player["faction"]
        if faction == "fairies" and "fairy_spade" not in player["special_used"] and player["power"]["III"] >= 2 and _can_start_terraform(state, pid, "fairy_spade"):
            options.append(_option(state, "start_terraform", "⛏️ Fairy spade · 🟣 2", source="fairy_spade"))
        if faction == "djinn" and "djinn_house" not in player["special_used"]:
            options += _terrain_options(state, pid, "djinn_house")
        if faction == "sun_worshippers" and "desert_transform" not in player["special_used"]:
            options += _terrain_options(state, pid, "desert_transform")
        if faction == "inventors" and player["power"]["III"] >= 6:
            options += _terrain_options(state, pid, "inventor_post")
    for bid, market in state["bonus_market"].items():
        options.append(_option(state, "pass", f"Pass · {D.BONUS_TILES[bid]['name']} · 💰 {market['coins']}", bonus_id=bid, description=f"Gain {_pass_points(state, pid)} passing points and take this tile for the next round."))
    options += _water_town_options(state, pid)
    return options


def _terraform_pending(state: Dict, pid: str, source: str) -> Dict:
    return {"source": source, "remaining": 2 if source == "spade_2" else 1, "reachable": sorted(reachable_cells(state, pid)), "top_up": source != "spade_2", "built": False, "used": [], "owner": pid}


def _can_start_terraform(state: Dict, pid: str, source: str) -> bool:
    candidate = {**state, "pending": _terraform_pending(state, pid, source)}
    return bool(_terrain_options(candidate, pid, source, True))


def _pay_source(state: Dict, pid: str, source: str, coins: int = 0) -> None:
    player = state["players"][pid]
    if source == "paid":
        player["coins"] -= coins
    elif source in POWER_ACTIONS:
        _spend_power(player, _power_cost(player, POWER_ACTIONS[source]["power"]))
        state["power_used"].append(source)
    elif source in ("fairy_spade", "inventor_post"):
        _spend_power(player, 2 if source == "fairy_spade" else 6)
        if source == "fairy_spade":
            player["special_used"].append(source)
    else:
        player["special_used"].append(source)


def _perform_action(state: Dict, pid: str, action: Dict) -> None:
    kind, player = action["type"], state["players"][pid]
    if kind in ("exchange_power", "druid_exchange"):
        amount = action["amount"]
        _spend_power(player, amount if kind == "exchange_power" else amount * 3)
        player["coins" if kind == "exchange_power" else "score"] += amount if kind == "exchange_power" else amount * 2
        return
    if kind == "choose_faction":
        faction = D.FACTIONS[action["faction"]]
        player["faction"], player["coins"] = action["faction"], faction["starting_coins"]
        index = state["turn_order"].index(pid) + 1
        if index < len(state["turn_order"]):
            state["current_turn"] = state["turn_order"][index]
        else:
            order = state["turn_order"]
            state["setup_queue"] = order + list(reversed(order)) + [other for other in order if state["players"][other]["faction"] == "sun_worshippers"]
            state["phase"], state["current_turn"] = "setup_house", state["setup_queue"][0]
        return
    if kind == "setup_house":
        _build(state, pid, action["cell_id"], "house", True)
        state["setup_queue"].pop(0)
        if state["setup_queue"]:
            state["current_turn"] = state["setup_queue"][0]
        else:
            state["phase"], state["setup_queue"] = "choose_bonus", list(reversed(state["turn_order"]))
            state["current_turn"] = state["setup_queue"][0]
        return
    if kind == "choose_bonus":
        player["bonus_tile"] = action["bonus_id"]
        player["coins"] += state["bonus_market"].pop(action["bonus_id"])["coins"]
        state["setup_queue"].pop(0)
        if state["setup_queue"]:
            state["current_turn"] = state["setup_queue"][0]
        else:
            for tile in state["bonus_market"].values():
                tile["coins"] += 1
            _start_round(state)
        return
    if kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["turn_order"]):
            if state["round"] == 5:
                _finish_game(state)
            else:
                state["round"] += 1
                _start_round(state)
        return
    if kind == "end_turn":
        _next_turn(state)
        return
    if kind == "choose_town":
        tile_id, component = action["town_id"], state["town_pending"].pop(0)
        tile, town_id = D.TOWN_TILES[tile_id], f"town_{len(state['towns']) + 1}"
        town = {"id": town_id, "owner": pid, "tile": tile_id, "cell_ids": list(component)}
        if state.get("water_town_pending"):
            town["river"] = state.pop("water_town_pending")
            _cell_map(state)[town["river"]]["town_id"] = town_id
        state["towns"].append(town)
        for cid in component:
            _cell_map(state)[cid]["town_id"] = town_id
        player["towns"].append(tile_id)
        player["score"] += tile["score"] + (4 if player["faction"] == "djinn" else 0)
        player["coins"] += tile.get("coins", 0)
        charge_power(player, tile.get("power", 0))
        if tile.get("sailing"):
            _advance_sailing(state, pid)
        _score_event(state, pid, "town")
        if not state["town_pending"]:
            state["phase"] = "palace_choice" if state.get("palace_pending") else state.pop("town_return_phase", "post_action")
        return
    if kind == "found_water_town":
        river = action["cell_id"]
        neighbors = _neighbors(state)[river]
        parts = _components(state, pid)
        component = sorted(set().union(*(set(part) for part in parts if set(part) & neighbors)))
        state["town_return_phase"] = state["phase"]
        state["town_pending"], state["water_town_pending"], state["phase"] = [component], river, "town_choice"
        return
    if kind == "skip_palace":
        state["palace_pending"] = None
        _after_action(state, pid)
        return
    if kind == "start_terraform":
        _pay_source(state, pid, action["source"])
        state["pending"], state["phase"] = _terraform_pending(state, pid, action["source"]), "terraform"
        return
    if kind == "terraform_build":
        player["coins"] -= 4
        _build(state, pid, action["cell_id"], "house")
        state["pending"]["built"] = True
        _continue_terraform(state, pid)
        return
    if kind == "finish_terraform":
        state["pending"] = None
        _after_action(state, pid)
        return
    if kind in ("build_transform", "terraform_target"):
        source, cid = action["source"], action["cell_id"]
        cell = _cell_map(state)[cid]
        spades = spade_cost(state, pid, cell["terrain"])
        staged = kind == "terraform_target"
        if staged:
            pending = state["pending"]
            player["coins"] -= 6 * max(0, spades - pending["remaining"])
            pending["remaining"] = max(0, pending["remaining"] - spades) if spades else 0
            pending["used"].append(cid)
        elif source == "paid":
            player["coins"] -= 6 * spades
        elif source != "ifrit_house":
            _pay_source(state, pid, source)
        if source not in ("desert_transform", "ifrit_house", "inventor_post"):
            _use_spades(state, pid, spades)
        cell["terrain"] = D.FACTIONS[player["faction"]]["terrain"]
        if action["build"]:
            if source not in ("djinn_house", "ifrit_house", "inventor_post"):
                player["coins"] -= 4
            _build(state, pid, cid, "trading_post" if source == "inventor_post" else "house")
            if staged:
                state["pending"]["built"] = True
        if source == "ifrit_house":
            state["palace_pending"] = None
        if staged:
            _continue_terraform(state, pid)
            return
        state["pending"] = None
    elif kind == "upgrade":
        cell, source = _cell_map(state)[action["cell_id"]], action["source"]
        neighbor = any(_cell_map(state)[nid]["owner"] not in (None, pid) for nid in _adjacency(state)[cell["id"]])
        feline = player["faction"] == "felines" and _has_palace(player, "left")
        cost = (5 if neighbor else 7) if feline else (7 if neighbor else 10)
        _pay_source(state, pid, source, cost if action["building"] == "trading_post" else 14)
        _build(state, pid, cell["id"], action["building"])
    elif kind == "advance_sailing":
        _pay_source(state, pid, action["source"], 8)
        _advance_sailing(state, pid)
    elif kind == "build_bridge":
        _pay_source(state, pid, action["source"], 10)
        bridge = copy.deepcopy(next(site for site in D.BRIDGE_SITES if site["id"] == action["bridge_id"]))
        bridge["owner"] = pid
        state["bridges"].append(bridge)
    elif kind == "power_coins":
        _pay_source(state, pid, action["source"])
        player["coins"] += 7
    elif kind == "pass":
        player["score"] += _pass_points(state, pid)
        if player["faction"] == "druids" and _has_palace(player, "left"):
            charge_power(player, 2 * len(_components(state, pid)))
        bonus = action["bonus_id"]
        player["coins"] += state["bonus_market"].pop(bonus)["coins"]
        state["bonus_market"][player["bonus_tile"]] = {"coins": 0}
        player["bonus_tile"], player["passed"] = bonus, True
        if not state["passed_order"]:
            state["start_player"] = pid
        state["passed_order"].append(pid)
    _after_action(state, pid)


class TerraNovaGame:
    game_id = "terra_nova"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not _CONFIG_VALIDATOR.is_valid(cfg) or "seed" in cfg and type(cfg["seed"]) is not int:
            raise ValueError("invalid Terra Nova configuration")
        if not isinstance(players, list) or not 2 <= len(players) <= 4:
            raise ValueError("Terra Nova requires 2–4 players")
        seated = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p["player_id"] for p in seated]
        if len(ids) != len(set(ids)) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        start = rng.randrange(len(ids))
        ids = ids[start:] + ids[:start]
        scoring, bonuses = list(D.ROUND_TILES), list(D.BONUS_TILES)
        rng.shuffle(scoring)
        rng.shuffle(bonuses)
        board = [{**copy.deepcopy(cell), "owner": None, "building": None, "town_id": None} for cell in D.BOARD_CELLS]
        state = {
            "game_id": "terra_nova", "version": 1, "config": {}, "turn_order": ids,
            "current_turn": ids[0], "start_player": ids[0], "phase": "choose_faction", "round": 1,
            "players": {}, "board": board, "bridges": [], "towns": [], "town_pending": [],
            "bonus_market": {bid: {"coins": 0} for bid in bonuses[:len(ids) + 3]},
            "round_scoring": scoring[:5], "passed_order": [], "next_ready": [],
            "power_used": [], "pending": None, "palace_pending": None,
            "round_summary": [], "final_scoring": [], "log": [], "game_over": False, "winner": [],
        }
        meta = {p["player_id"]: p for p in seated}
        for pid in ids:
            state["players"][pid] = {
                "id": pid, "player_id": pid, "name": str(meta[pid].get("name", pid)), "seat": meta[pid].get("seat", 0),
                "is_bot": bool(meta[pid].get("is_bot", False)), "faction": None,
                "coins": 0, "power": {"I": 2, "II": 2, "III": 4}, "score": 0, "sailing": 0,
                "buildings": dict.fromkeys(BUILDING_LIMITS, 0), "towns": [], "bonus_tile": None,
                "passed": False, "special_used": [], "last_income": {}, "round_start_score": 0,
            }
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return sorted({option["action"]["type"] for option in action_options(state, player_id)})

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action) or type(action.get("round")) is not int or "amount" in action and type(action["amount"]) is not int:
            return [], "invalid action schema"
        if player_id not in state["players"]:
            return [], "player not found"
        if action["round"] != state["round"]:
            return [], "stale round"
        if action not in [option["action"] for option in action_options(state, player_id)]:
            return [], "action is not currently legal"
        candidate = copy.deepcopy(state)
        _perform_action(candidate, player_id, action)
        if action["type"] not in ("end_turn", "exchange_power", "druid_exchange", "next_round"):
            label = action["type"].replace("_", " ")
            candidate["log"].append(f"{state['players'][player_id]['name']}: {label}" + (f" · {action['cell_id']}" if "cell_id" in action else ""))
        state.clear()
        state.update(candidate)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        view = copy.deepcopy(state)
        view["you"] = viewer_id
        view["action_options"] = copy.deepcopy(action_options(state, viewer_id))
        view["legal_actions"] = sorted({item["action"]["type"] for item in view["action_options"]})
        view.update(copy.deepcopy({"factions": D.FACTIONS, "bonus_tiles": D.BONUS_TILES, "round_tiles": D.ROUND_TILES, "town_tiles": D.TOWN_TILES, "bridge_sites": D.BRIDGE_SITES, "power_actions": POWER_ACTIONS, "sailing_points": D.SAILING_POINTS, "terrain_ring": TERRAIN_RING}))
        for pid, player in view["players"].items():
            player["income"] = income_for_player(state, pid) if player["faction"] and player["bonus_tile"] else {}
            player["total"] = player["score"]
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return choose_bot_action(TerraNovaGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        _validate_saved_state(state)
        return state


def choose_bot_action(view: Dict) -> Optional[Dict]:
    options = view["action_options"]
    if not options:
        return None
    player = view["players"][view["you"]]
    phase = view["phase"]
    if phase in ("round_end", "post_action"):
        if player["faction"] == "druids" and player["power"]["III"] >= 3 and (phase == "round_end" or player["coins"] >= 8):
            conversions = [o for o in options if o["action"]["type"] == "druid_exchange"]
            if conversions:
                return max(conversions, key=lambda o: o["action"]["amount"])["action"]
        water = [o for o in options if o["action"]["type"] == "found_water_town"]
        if water:
            return water[0]["action"]
        # Empty excess charged power before the next income can replenish it.
        if phase == "round_end" and view["round"] < 5 and player["power"]["III"] > 3:
            return next(o["action"] for o in options if o["action"]["type"] == "exchange_power" and o["action"]["amount"] == player["power"]["III"] - 3)
        return next(o["action"] for o in options if o["action"]["type"] in ("end_turn", "next_round"))
    if phase == "choose_faction":
        return options[0]["action"]
    if phase == "town_choice":
        return max(options, key=lambda o: view["town_tiles"][o["action"]["town_id"]]["score"] + (3 if view["round"] < 4 and view["town_tiles"][o["action"]["town_id"]].get("coins") else 0))["action"]
    if phase == "choose_bonus":
        return max(options, key=lambda o: view["bonus_tiles"][o["action"]["bonus_id"]]["income"].get("coins", 0))["action"]
    board = {cell["id"]: cell for cell in view["board"]}
    adjacency = _adjacency(view)
    scoring = view["round_tiles"][view["round_scoring"][view["round"] - 1]]["event"]
    def desirability(option: Dict) -> float:
        action = option["action"]
        kind = action["type"]
        cid = action.get("cell_id")
        nearby = sum(board[nid]["owner"] == view["you"] for nid in adjacency[cid]) if cid else 0
        opponents = sum(board[nid]["owner"] not in (None, view["you"]) for nid in adjacency[cid]) if cid else 0
        if kind == "setup_house":
            home = view["factions"][player["faction"]]["terrain"]
            opportunities = sum(not board[nid]["owner"] and board[nid]["terrain"] == home for nid in adjacency[cid])
            return opportunities + opponents * 2 + (nearby * 1.5 if player["buildings"]["house"] else 0)
        if kind == "terraform_build":
            return 12 + nearby * 2 + opponents + (3 if scoring == "house" else 0)
        if kind == "build_transform" or kind == "terraform_target":
            if not action["build"]:
                return 0.5 if phase == "terraform" else -2
            return 12 + nearby * 2 + opponents + (3 if scoring == "house" else 0) - (spade_cost(view, view["you"], board[cid]["terrain"]) * (2 if action["source"] == "paid" else 0))
        if kind == "upgrade":
            palace = action["building"].startswith("palace")
            return (13 if palace and view["round"] <= 3 else 8) + nearby + (5 if scoring == ("palace" if palace else "trading_post") else 0) + (1 if action["building"] == "palace_left" else 0)
        if kind == "advance_sailing":
            return 13 if player["sailing"] == 0 else 3 + (3 if scoring == "sailing" else 0)
        if kind == "start_terraform":
            return 11 if action["source"] != "spade_2" else 12
        if kind == "power_coins":
            return 10 if player["coins"] < 12 else 1
        if kind == "found_water_town":
            return 30
        if kind == "exchange_power":
            return 9 if player["coins"] < 4 and action["amount"] == player["power"]["III"] else -3
        if kind == "druid_exchange":
            return 4 + action["amount"]
        if kind == "build_bridge":
            return 2
        if kind == "pass":
            bid = action["bonus_id"]
            return -1 + view["bonus_market"][bid]["coins"] * 0.01 + view["bonus_tiles"][bid]["income"].get("coins", 0) * 0.005
        return -4
    return max(options, key=desirability)["action"]


def _validate_saved_state(state: Dict) -> None:
    def require(value: bool) -> None:
        if not value:
            raise ValueError("invalid Terra Nova saved state")
    try:
        require(isinstance(state, dict) and state["game_id"] == "terra_nova" and state["version"] == 1)
        allowed_keys = {"game_id", "version", "config", "turn_order", "current_turn", "start_player", "phase", "round", "players", "board", "bridges", "towns", "town_pending", "bonus_market", "round_scoring", "passed_order", "next_ready", "power_used", "pending", "palace_pending", "round_summary", "final_scoring", "log", "game_over", "winner", "setup_queue", "water_town_pending", "town_return_phase"}
        require(set(state) <= allowed_keys)
        order = state["turn_order"]
        require(isinstance(order, list) and 2 <= len(order) <= 4 and len(set(order)) == len(order) and set(order) == set(state["players"]))
        require(state["config"] == {} and type(state["round"]) is int and 1 <= state["round"] <= 5)
        require(state["phase"] in ("choose_faction", "setup_house", "choose_bonus", "action", "post_action", "terraform", "town_choice", "palace_choice", "round_end", "game_over"))
        require(type(state["game_over"]) is bool and state["game_over"] == (state["phase"] == "game_over"))
        require(state["current_turn"] in order if state["phase"] not in ("round_end", "game_over") else state["current_turn"] is None)
        require(len(state["round_scoring"]) == 5 and len(set(state["round_scoring"])) == 5 and set(state["round_scoring"]) <= set(D.ROUND_TILES))
        require(isinstance(state["board"], list) and len(state["board"]) == len(D.BOARD_CELLS))
        original = {c["id"]: c for c in D.BOARD_CELLS}
        require({c["id"] for c in state["board"]} == set(original))
        for cell in state["board"]:
            require((cell["row"], cell["col"]) == (original[cell["id"]]["row"], original[cell["id"]]["col"]))
            require(cell["terrain"] in TERRAIN_RING + ["river"] and (cell["terrain"] == "river") == (original[cell["id"]]["terrain"] == "river"))
            require(cell["owner"] in [None] + order and cell["building"] in [None] + list(BUILDING_LIMITS))
            require(bool(cell["owner"]) == bool(cell["building"]))
        colors, bonuses = [], list(state["bonus_market"])
        for pid in order:
            player = state["players"][pid]
            require(player["id"] == pid and isinstance(player["name"], str))
            require(player["faction"] is None or player["faction"] in D.FACTIONS)
            if player["faction"]:
                colors.append(D.FACTIONS[player["faction"]]["terrain"])
            require(all(type(player[key]) is int and player[key] >= 0 for key in ("coins", "score", "sailing")))
            require(player["sailing"] < len(D.SAILING_POINTS))
            require(set(player["power"]) == {"I", "II", "III"} and all(type(v) is int and v >= 0 for v in player["power"].values()) and sum(player["power"].values()) == 8)
            counts = Counter(c["building"] for c in _owned_cells(state, pid))
            require(set(player["buildings"]) == set(BUILDING_LIMITS))
            require(all(type(player["buildings"][kind]) is int and player["buildings"][kind] == counts[kind] and counts[kind] <= maximum for kind, maximum in BUILDING_LIMITS.items()))
            require(len(set(player["towns"])) == len(player["towns"]) and set(player["towns"]) <= set(D.TOWN_TILES))
            if player["bonus_tile"]:
                require(player["bonus_tile"] in D.BONUS_TILES)
                bonuses.append(player["bonus_tile"])
        require(len(colors) == len(set(colors)))
        require(len(bonuses) == len(order) + 3 and len(bonuses) == len(set(bonuses)) and set(bonuses) <= set(D.BONUS_TILES))
        require(all(type(v["coins"]) is int and v["coins"] >= 0 for v in state["bonus_market"].values()))
        for key in ("next_ready", "passed_order", "winner"):
            require(isinstance(state[key], list) and len(set(state[key])) == len(state[key]) and set(state[key]) <= set(order))
        require(state["game_over"] == bool(state["winner"]))
        require(not state["game_over"] or state["round"] == 5)
        require(state["start_player"] in order)
        require(set(state["passed_order"]) == {pid for pid in order if state["players"][pid]["passed"]})
        require(state["phase"] not in ("round_end", "game_over") or len(state["passed_order"]) == len(order))
        require(state["phase"] != "round_end" or len(state["next_ready"]) < len(order))
        require(not state["game_over"] or set(state["next_ready"]) == set(order))
        require(state["phase"] in ("choose_faction", "setup_house", "choose_bonus") or len(colors) == len(order))
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        town_ids = {town["id"] for town in state["towns"]}
        require(len(town_ids) == len(state["towns"]))
        cells = _cell_map(state)
        for cell in state["board"]:
            require(cell["town_id"] is None or cell["town_id"] in town_ids)
            if cell["owner"]:
                require(cell["terrain"] == D.FACTIONS[state["players"][cell["owner"]]["faction"]]["terrain"])
        for town in state["towns"]:
            require(town["owner"] in order and town["tile"] in D.TOWN_TILES)
            require(town["tile"] in state["players"][town["owner"]]["towns"])
            require(isinstance(town["cell_ids"], list) and len(town["cell_ids"]) >= 4 and len(set(town["cell_ids"])) == len(town["cell_ids"]))
            require(all(cid in cells and cells[cid]["owner"] == town["owner"] and cells[cid]["town_id"] == town["id"] for cid in town["cell_ids"]))
            require(not town.get("river") or town["river"] in cells and cells[town["river"]]["terrain"] == "river" and state["players"][town["owner"]]["faction"] == "merfolk")
        require(sum(len(player["towns"]) for player in state["players"].values()) == len(state["towns"]))
        require(len(set(state["power_used"])) == len(state["power_used"]) and set(state["power_used"]) <= set(POWER_ACTIONS))
        bridge_ids = {site["id"]: site["cell_ids"] for site in D.BRIDGE_SITES}
        require(len({bridge["id"] for bridge in state["bridges"]}) == len(state["bridges"]))
        for bridge in state["bridges"]:
            require(bridge["id"] in bridge_ids and bridge["cell_ids"] == bridge_ids[bridge["id"]] and bridge["owner"] in order)
        require(all(sum(bridge["owner"] == pid for bridge in state["bridges"]) <= 3 for pid in order))
        require(state["phase"] != "terraform" or isinstance(state["pending"], dict) and state["pending"]["owner"] == state["current_turn"])
        require(state["phase"] != "town_choice" or bool(state["town_pending"]))
        if state["phase"] == "terraform":
            pending = state["pending"]
            require(pending["source"] in ("spade_1", "spade_2", "fairy_spade", "bonus_spade"))
            require(type(pending["remaining"]) is int and 0 <= pending["remaining"] <= (2 if pending["source"] == "spade_2" else 1))
            require(isinstance(pending["reachable"], list) and set(pending["reachable"]) <= set(cells))
            require(type(pending["top_up"]) is bool and pending["top_up"] == (pending["source"] != "spade_2"))
            require(type(pending["built"]) is bool and isinstance(pending["used"], list) and set(pending["used"]) <= set(cells))
            require(pending["remaining"] > 0 or bool(_terraform_build_options(state, state["current_turn"])))
        require(state["phase"] != "palace_choice" or state["palace_pending"] == "ifrit_house")
    except (KeyError, TypeError, IndexError, AttributeError) as error:
        raise ValueError("invalid Terra Nova saved state") from error
