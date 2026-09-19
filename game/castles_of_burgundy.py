"""The Castles of Burgundy, original base rules with the corrected tie-break."""
import copy
import itertools
import math
import random
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator
from game.castles_of_burgundy_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, ANIMALS, BUILDINGS, DEPOT_SLOTS, KINDS,
    KIND_META, KNOWLEDGE, KNOWLEDGE_BUILDINGS, make_estate, make_supply,
)

ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def knowledge(player: Dict) -> set:
    return {cell["tile"]["number"] for cell in player["estate"]
            if cell["tile"] and cell["tile"]["kind"] == "knowledge"}


def tile_view(tile: Dict) -> Dict:
    result = dict(tile)
    name, emoji, description = KIND_META[tile["kind"]]
    if tile["kind"] == "building":
        name, emoji, description = BUILDINGS[tile["building"]]
    elif tile["kind"] == "knowledge":
        name = f"Knowledge {tile['number']}"
        description = KNOWLEDGE[tile["number"]]
    elif tile["kind"] == "animal":
        name = f"{tile['count']} {tile['animal'].title()}"
        emoji = ANIMALS[tile["animal"]]
    result.update(name=name, emoji=emoji, description=description)
    return result


def _log(state: Dict, text: str) -> None:
    state["log"].append(text)
    state["log"] = state["log"][-80:]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid].get("name") or pid


def _score(state: Dict, pid: str, amount: int, reason: str) -> None:
    state["players"][pid]["score"] += amount
    _log(state, f"{_name(state, pid)}: +{amount} VP · {reason}")


def _order(state: Dict) -> List[str]:
    return sorted(state["players"], key=lambda pid: (
        -state["players"][pid]["ships"], -state["players"][pid]["ship_stamp"]))


def _snapshot(state: Dict) -> Dict:
    return {pid: {key: p[key] for key in ("score", "silver", "workers")}
            for pid, p in state["players"].items()}


def _new_phase(state: Dict) -> None:
    count = len(state["players"])
    for depot in state["depots"]:
        state["discarded"].extend(depot["tiles"])
        depot["tiles"] = []
    for i, slots in enumerate(DEPOT_SLOTS):
        for kind in slots[:count]:
            if count == 3 and i == 5 and kind == "castle" and state["stage"] in (2, 4):
                kind = "mine"
            if state["supply"][kind]:
                state["depots"][i + 1]["tiles"].append(state["supply"][kind].pop())
    for _ in range({2: 2, 3: 5, 4: 8}[count]):
        if state["supply"]["black"]:
            state["depots"][0]["tiles"].append(state["supply"]["black"].pop())
    state["round_goods"] = [state["goods_supply"].pop() for _ in range(5)]
    _log(state, f"Phase {'ABCDE'[state['stage'] - 1]}: depots refreshed.")


def _new_round(state: Dict) -> None:
    rng = random.Random(f"{state['seed']}:round:{state['stage']}:{state['round']}")
    state["turn_order"] = _order(state)
    state["turn_index"] = 0
    state["current_turn"] = state["turn_order"][0]
    state["phase"] = "turn"
    state["ready"] = []
    state["pending"] = None
    state["round_start"] = _snapshot(state)
    for p in state["players"].values():
        p["dice"] = [rng.randint(1, 6), rng.randint(1, 6)]
        p["used"] = [False, False]
        p["bought"] = False
    state["white_die"] = rng.randint(1, 6)
    goods = state["round_goods"].pop(0)
    state["depots"][state["white_die"]]["goods"].append(goods)
    state["delivered_goods"] = goods
    _log(state, f"Round {state['round']}: goods {goods} delivered to depot {state['white_die']}.")


def worker_cost(player: Dict, die: int, target: int, action_type: str, kind: str = "") -> int:
    tech = knowledge(player)
    distance = abs(player["dice"][die] - target)
    distance = min(distance, 6 - distance)
    discount = (action_type == "take" and 12 in tech) or (action_type == "place" and (
        (kind == "building" and 9 in tech) or (kind in ("ship", "animal") and 10 in tech)
        or (kind in ("castle", "mine", "knowledge") and 11 in tech)))
    return math.ceil(max(0, distance - int(discount)) / (2 if 8 in tech else 1))


def can_place(player: Dict, tile: Dict, cell: Dict) -> bool:
    if cell["tile"] or cell["kind"] != tile["kind"]:
        return False
    if not any(player["estate"][n]["tile"] for n in cell["neighbors"]):
        return False
    if tile["kind"] == "building" and 1 not in knowledge(player):
        return not any(c["region"] == cell["region"] and c["tile"]
                       and c["tile"].get("building") == tile["building"] for c in player["estate"])
    return True


def _store_options(player: Dict, action: Dict) -> List[Dict]:
    if len(player["storage"]) < 3:
        return [action]
    return [{**action, "discard": tile["id"]} for tile in player["storage"]]


def _ship_options(state: Dict, player: Dict) -> List[Dict]:
    tech = knowledge(player)
    choices = [[i] for i in range(1, 7)]
    if 5 in tech:
        choices.extend([[i, i + 1] for i in range(1, 6)] + [[1, 6]])
    held = {i + 1 for i, count in enumerate(player["goods"]) if count}
    result = []
    for depots in choices:
        available = {g for d in depots for g in state["depots"][d]["goods"]}
        existing = available & held
        new = sorted(available - held)
        for selected in itertools.combinations(new, min(3 - len(held), len(new))):
            result.append({"action": {"type": "ship_goods", "depots": depots,
                                      "goods": sorted(existing | set(selected))}, "workers": 0})
    return result


def legal_options(state: Dict, pid: str) -> List[Dict]:
    if state["game_over"] or pid not in state["players"]:
        return []
    if state["phase"] == "round_end":
        return [] if pid in state["ready"] else [{"action": {"type": "next_round"}, "workers": 0}]
    if pid != state["current_turn"]:
        return []
    p = state["players"][pid]
    pending = state["pending"]
    result = []
    # Buying is permitted at any point in one's turn, also during an immediate effect.
    if p["silver"] >= 2 and not p["bought"]:
        for depot in state["depots"][:7 if 6 in knowledge(p) else 1]:
            for tile in depot["tiles"]:
                for action in _store_options(p, {"type": "buy", "depot": depot["id"], "tile": tile["id"]}):
                    result.append({"action": action, "workers": 0})
    if pending and pending["kind"] == "ship":
        return result + _ship_options(state, p)
    bonus = pending["kind"] if pending else None
    if pending and bonus != "castle":
        result.append({"action": {"type": "skip_bonus"}, "workers": 0})
    dice = [None] if pending else [i for i, used in enumerate(p["used"]) if not used]
    allowed = {
        None: ("take", "place", "sell", "workers"),
        "castle": ("take", "place", "sell", "workers"),
        "city_hall": ("place",), "warehouse": ("sell",),
        "workshop": ("take",), "church": ("take",), "market": ("take",),
    }[bonus]
    filters = {"workshop": ("building",), "church": ("castle", "mine", "knowledge"),
               "market": ("ship", "animal")}
    for die in dice:
        base = {} if die is None else {"die": die}
        if "take" in allowed:
            for depot in state["depots"][1:]:
                cost = 0 if pending else worker_cost(p, die, depot["id"], "take")
                if cost > p["workers"]:
                    continue
                for tile in depot["tiles"]:
                    if bonus in filters and tile["kind"] not in filters[bonus]:
                        continue
                    for action in _store_options(p, {"type": "take", **base, "depot": depot["id"], "tile": tile["id"]}):
                        result.append({"action": action, "workers": cost})
        if "place" in allowed:
            for tile in p["storage"]:
                for cell in p["estate"]:
                    if not can_place(p, tile, cell):
                        continue
                    cost = 0 if pending else worker_cost(p, die, cell["number"], "place", tile["kind"])
                    if cost <= p["workers"]:
                        result.append({"action": {"type": "place", **base, "tile": tile["id"], "cell": cell["id"]}, "workers": cost})
        if "sell" in allowed:
            for number, count in enumerate(p["goods"], 1):
                if not count:
                    continue
                cost = 0 if pending else worker_cost(p, die, number, "sell")
                if cost <= p["workers"]:
                    result.append({"action": {"type": "sell", **base, "goods": number}, "workers": cost})
        if "workers" in allowed:
            result.append({"action": {"type": "workers", **base}, "workers": 0})
    if not pending and all(p["used"]):
        result.append({"action": {"type": "end_turn"}, "workers": 0})
    return result


def _region_score(state: Dict, pid: str, cell: Dict) -> None:
    p = state["players"][pid]
    region = [c for c in p["estate"] if c["region"] == cell["region"]]
    if all(c["tile"] for c in region) and cell["region"] not in p["completed"]:
        p["completed"].append(cell["region"])
        size = len(region)
        _score(state, pid, size * (size + 1) // 2 + 12 - 2 * state["stage"], f"completed {size}-hex region")
    colour = cell["kind"]
    if colour not in p["colours"] and all(c["tile"] for c in p["estate"] if c["kind"] == colour):
        p["colours"].append(colour)
        claimed = state["bonuses"][colour]
        if len(claimed) < 2:
            points = len(state["players"]) + (3 if not claimed else 0)
            claimed.append(pid)
            p["bonus_tiles"].append({"kind": colour, "points": points})
            _score(state, pid, points, f"{colour} colour bonus")


def _place(state: Dict, pid: str, tile: Dict, index: int) -> None:
    p = state["players"][pid]
    cell = p["estate"][index]
    cell["tile"] = tile
    kind = tile["kind"]
    _log(state, f"{_name(state, pid)} placed {tile_view(tile)['name']} on hex {index + 1}.")
    if kind == "animal":
        matches = [c["tile"] for c in p["estate"] if c["region"] == cell["region"] and c["tile"]
                   and c["tile"].get("animal") == tile["animal"]]
        _score(state, pid, sum(t["count"] for t in matches) + (len(matches) if 7 in knowledge(p) else 0), "livestock")
    elif kind == "ship":
        state["ship_clock"] += 1
        p["ships"] += 1
        p["ship_stamp"] = state["ship_clock"]
        state["pending"] = {"kind": "ship"}
    elif kind == "castle":
        state["pending"] = {"kind": "castle"}
    elif kind == "building":
        building = tile["building"]
        if building == "bank":
            p["silver"] += 2
        elif building == "boarding_house":
            p["workers"] += 4
        elif building == "watchtower":
            _score(state, pid, 4, "watchtower")
        else:
            state["pending"] = {"kind": building}
    _region_score(state, pid, cell)


def _sell(state: Dict, pid: str, number: int) -> None:
    p = state["players"][pid]
    count = p["goods"][number - 1]
    p["sold"][number - 1] += count
    p["goods"][number - 1] = 0
    tech = knowledge(p)
    p["silver"] += 2 if 3 in tech else 1
    p["workers"] += int(4 in tech)
    _score(state, pid, count * len(state["players"]), f"sold {count} goods of type {number}")


def final_breakdown(player: Dict) -> Dict:
    tech = knowledge(player)
    tiles = [c["tile"] for c in player["estate"] if c["tile"]]
    details = {}
    for number in sorted(tech):
        value = 0
        if number == 15:
            value = 3 * sum(bool(n) for n in player["sold"])
        elif number in KNOWLEDGE_BUILDINGS:
            value = 4 * sum(t.get("building") == KNOWLEDGE_BUILDINGS[number] for t in tiles)
        elif number == 24:
            value = 4 * len({t["animal"] for t in tiles if t["kind"] == "animal"})
        elif number == 25:
            value = sum(player["sold"])
        elif number == 26:
            value = 2 * len(player["bonus_tiles"])
        if number >= 15:
            details[str(number)] = value
    return {"goods": sum(player["goods"]), "silver": player["silver"],
            "workers": player["workers"] // 2, "knowledge": sum(details.values()), "knowledge_details": details}


def _finish(state: Dict) -> None:
    state["final_scores"] = {}
    for pid, p in state["players"].items():
        breakdown = final_breakdown(p)
        breakdown["during_game"] = p["score"]
        p["score"] += sum(breakdown[key] for key in ("goods", "silver", "workers", "knowledge"))
        breakdown["total"] = p["score"]
        state["final_scores"][pid] = breakdown
    order = _order(state)
    # English first-edition erratum: MORE empty spaces, then later on turn-order track.
    winner = max(order, key=lambda pid: (state["players"][pid]["score"],
                 sum(c["tile"] is None for c in state["players"][pid]["estate"]), order.index(pid)))
    state.update(game_over=True, phase="game_over", current_turn=None, winner=[winner])
    _log(state, f"{_name(state, winner)} wins with {state['players'][winner]['score']} VP.")


def _end_round(state: Dict) -> None:
    income = {}
    if state["round"] == 5:
        for pid, p in state["players"].items():
            mines = sum(c["tile"] is not None and c["kind"] == "mine" for c in p["estate"])
            workers = mines if 2 in knowledge(p) else 0
            p["silver"] += mines
            p["workers"] += workers
            income[pid] = {"silver": mines, "workers": workers}
        _log(state, "Phase complete: mine income paid.")
    state["review"] = {"stage": state["stage"], "round": state["round"], "income": income,
                       "delta": {pid: {key: p[key] - state["round_start"][pid][key]
                                 for key in ("score", "silver", "workers")} for pid, p in state["players"].items()}}
    if state["stage"] == 5 and state["round"] == 5:
        _finish(state)
    else:
        state.update(phase="round_end", current_turn=None, ready=[])
        _log(state, "Round complete. Waiting for every player to choose Next Round.")


def _execute(state: Dict, pid: str, option: Dict) -> None:
    action = option["action"]
    kind = action["type"]
    p = state["players"][pid]
    if kind == "next_round":
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["players"]):
            if state["round"] == 5:
                state["stage"] += 1
                state["round"] = 1
                _new_phase(state)
            else:
                state["round"] += 1
            _new_round(state)
        return
    if kind == "end_turn":
        state["turn_index"] += 1
        if state["turn_index"] == len(state["turn_order"]):
            _end_round(state)
        else:
            state["current_turn"] = state["turn_order"][state["turn_index"]]
        return
    if kind == "buy":
        p["silver"] -= 2
        p["bought"] = True
    else:
        if "die" in action:
            p["used"][action["die"]] = True
            p["workers"] -= option["workers"]
        state["pending"] = None
    if kind in ("take", "buy"):
        if "discard" in action:
            discarded = next(t for t in p["storage"] if t["id"] == action["discard"])
            p["storage"].remove(discarded)
            state["discarded"].append(discarded)
        depot = state["depots"][action["depot"]]
        tile = next(t for t in depot["tiles"] if t["id"] == action["tile"])
        depot["tiles"].remove(tile)
        p["storage"].append(tile)
        _log(state, f"{_name(state, pid)} {'bought' if kind == 'buy' else 'took'} {tile_view(tile)['name']}.")
    elif kind == "place":
        tile = next(t for t in p["storage"] if t["id"] == action["tile"])
        p["storage"].remove(tile)
        _place(state, pid, tile, action["cell"])
    elif kind == "sell":
        _sell(state, pid, action["goods"])
    elif kind == "workers":
        tech = knowledge(p)
        gain = 4 if 14 in tech else 2
        p["workers"] += gain
        p["silver"] += int(13 in tech)
        _log(state, f"{_name(state, pid)} gained {gain} workers.")
    elif kind == "ship_goods":
        count = 0
        for index in action["depots"]:
            depot = state["depots"][index]
            for number in list(depot["goods"]):
                if number in action["goods"]:
                    depot["goods"].remove(number)
                    p["goods"][number - 1] += 1
                    count += 1
        _log(state, f"{_name(state, pid)} collected {count} goods.")
    elif kind == "skip_bonus":
        _log(state, f"{_name(state, pid)} declined the optional building effect.")


def _tile_value(state: Dict, p: Dict, tile: Dict, cell: Dict) -> float:
    region = [c for c in p["estate"] if c["region"] == cell["region"]]
    empty = sum(c["tile"] is None for c in region)
    value = 6 + (len(region) * (len(region) + 1) / 2 + 12 - 2 * state["stage"]) / empty
    value += sum(p["estate"][n]["tile"] is None for n in cell["neighbors"]) * .3
    if tile["kind"] == "mine":
        value += (6 - state["stage"]) * 1.8
    elif tile["kind"] == "castle":
        value += 6
    elif tile["kind"] == "ship":
        value += 3 + max((len(d["goods"]) for d in state["depots"][1:]), default=0)
    elif tile["kind"] == "animal":
        value += tile["count"] + sum(c["tile"].get("count", 0) for c in region
                                   if c["tile"] and c["tile"].get("animal") == tile["animal"])
    elif tile["kind"] == "knowledge":
        value += 4 if tile["number"] >= 15 else 6 - state["stage"]
    elif tile["kind"] == "building":
        value += {"bank": 3, "boarding_house": 3, "watchtower": 4, "city_hall": 5,
                  "warehouse": 2, "workshop": 3, "church": 3, "market": 3}[tile["building"]]
    return value


def _bot_value(state: Dict, pid: str, option: Dict) -> float:
    a = option["action"]
    p = state["players"][pid]
    kind = a["type"]
    penalty = option["workers"] * 1.8
    if kind == "place":
        tile = next(t for t in p["storage"] if t["id"] == a["tile"])
        return _tile_value(state, p, tile, p["estate"][a["cell"]]) - penalty
    if kind in ("take", "buy"):
        tile = next(t for t in state["depots"][a["depot"]]["tiles"] if t["id"] == a["tile"])
        positions = [c for c in p["estate"] if can_place(p, tile, c)]
        if not positions:
            return -5
        value = max(_tile_value(state, p, tile, c) for c in positions) * .55
        value -= len(p["storage"]) * 1.5 + (9 if "discard" in a else 0)
        if kind == "buy":
            value -= 2.5 + (2 if state["stage"] == 5 and state["round"] == 5 else 0)
        return value - penalty
    if kind == "sell":
        return p["goods"][a["goods"] - 1] * len(state["players"]) + 2 - penalty
    if kind == "workers":
        return 5 if p["workers"] < 2 else .3
    if kind == "ship_goods":
        return sum(g in a["goods"] for d in a["depots"] for g in state["depots"][d]["goods"])
    return -1 if kind == "skip_bonus" else 0


class CastlesOfBurgundyGame:
    game_id = "castles_of_burgundy"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Burgundy configuration")
        if not 2 <= len(players) <= 4 or len({p["player_id"] for p in players}) != len(players):
            raise ValueError("Burgundy requires 2–4 distinct players")
        seed = config.get("seed")
        if seed is None:
            seed = random.SystemRandom().randrange(2**53)
        rng = random.Random(seed)
        order = [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]
        start = rng.randrange(len(order))
        order = order[start:] + order[:start]
        supply = make_supply()
        for pool in supply.values():
            rng.shuffle(pool)
        goods = [number for number in range(1, 7) for _ in range(7)]
        rng.shuffle(goods)
        state = {"config": dict(config), "seed": seed, "stage": 1, "round": 1,
                 "players": {}, "player_meta": {p["player_id"]: copy.deepcopy(p) for p in players},
                 "supply": supply, "goods_supply": goods[:25], "depots": [
                     {"id": i, "tiles": [], "goods": []} for i in range(7)],
                 "discarded": [], "bonuses": {kind: [] for kind in KINDS}, "ship_clock": 0,
                 "log": [], "review": None, "final_scores": {}, "game_over": False, "winner": []}
        for i, pid in enumerate(order):
            estate = make_estate()
            estate[18]["tile"] = supply["castle"].pop()
            starting_goods = [0] * 6
            for number in goods[25 + i * 3:28 + i * 3]:
                starting_goods[number - 1] += 1
            state["players"][pid] = {"estate": estate, "storage": [], "goods": starting_goods,
                "sold": [0] * 6, "silver": 1, "workers": i + 1, "score": 0, "ships": 0,
                "ship_stamp": -i, "completed": [18], "colours": [], "bonus_tiles": []}
        _new_phase(state)
        _new_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return sorted({option["action"]["type"] for option in legal_options(state, player_id)})

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action fields or types."
        normalized = copy.deepcopy(action)
        if normalized["type"] == "ship_goods":
            normalized["depots"].sort()
            normalized["goods"].sort()
        option = next((o for o in legal_options(state, player_id) if o["action"] == normalized), None)
        if option is None:
            return [], "Action unavailable: check turn, die, workers, tile, storage and placement."
        updated = copy.deepcopy(state)
        _execute(updated, player_id, option)
        state.clear()
        state.update(updated)
        return [{"type": "castles_of_burgundy:action", "payload": {"player_id": player_id, "action": normalized}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: Optional[str]) -> Dict:
        result = {key: copy.deepcopy(state[key]) for key in (
            "stage", "round", "phase", "turn_order", "current_turn", "white_die", "delivered_goods",
            "round_goods", "pending", "ready", "bonuses", "review", "final_scores", "game_over", "winner", "log")}
        result.update(game_id=CastlesOfBurgundyGame.game_id, you=viewer_id, next_order=_order(state),
                      options=legal_options(state, viewer_id), knowledge=KNOWLEDGE.copy(), players=[])
        for pid, original in state["players"].items():
            p = copy.deepcopy(original)
            p.update(player_id=pid, name=_name(state, pid), is_bot=bool(state["player_meta"][pid].get("is_bot")))
            p["knowledge"] = sorted(knowledge(p))
            p["storage"] = [tile_view(t) for t in p["storage"]]
            for c in p["estate"]:
                if c["tile"]:
                    c["tile"] = tile_view(c["tile"])
            result["players"].append(p)
        result["depots"] = [{"id": d["id"], "tiles": [tile_view(t) for t in d["tiles"]],
                             "goods": list(d["goods"])} for d in state["depots"]]
        result["legal_actions"] = sorted({o["action"]["type"] for o in result["options"]})
        return result

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        options = legal_options(state, bot_id)
        if not options:
            return None
        return copy.deepcopy(max(options, key=lambda o: _bot_value(state, bot_id, o))["action"])

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
