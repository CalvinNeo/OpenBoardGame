"""Server-authoritative A Feast for Odin digital ruleset."""
import copy
import json
import random
import secrets
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from game.a_feast_for_odin_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, ACTIONS, BOARDS, CROPS, GOODS, HARVEST,
    HOUSE_SUPPLY, ISLAND_PAIRS, MOUNTAINS, OCCUPATIONS, SHIPS, SPECIALS, WEAPONS,
    effect, gain,
)


def _tuples(value):
    return tuple(_tuples(v) for v in value) if isinstance(value, (tuple, list)) else value


def _rng(state: Dict) -> random.Random:
    rng = random.Random()
    rng.setstate(_tuples(state["_rng"]))
    return rng


def _roll(state: Dict, sides: int) -> int:
    rng = _rng(state)
    result = rng.randint(1, sides)
    state["_rng"] = rng.getstate()
    return result


def _log(state: Dict, pid: Optional[str], text: str) -> None:
    state["log"].append({"round": state["round"], "player_id": pid, "text": text})
    state["log"] = state["log"][-100:]


def card_kind(card: str) -> str:
    return card.split(":", 1)[0]


def professions(player: Dict) -> List[Dict]:
    return [OCCUPATIONS[card_kind(c)] for c in player["occupations"]]


def _trait(player: Dict, key: str) -> int:
    return sum(int(c.get(key, 0)) for c in professions(player))


def _hooks(player: Dict, name: str) -> int:
    return sum(c.get("hook") == name for c in professions(player))


def animal_count(player: Dict, kind: str) -> int:
    return player["stock"].get(kind, 0) + player["stock"].get("pregnant_" + kind, 0)


def new_board(kind: str) -> Dict:
    return {"kind": kind, "tiles": [], "materials": {"wood": 0, "stone": 0}}


@lru_cache(maxsize=512)
def oriented_cells(good: str, rotation: int = 0, flip: bool = False) -> tuple:
    coords = [(x * (-1 if flip else 1), y) for x, y in GOODS[good]["cells"]]
    for _ in range(rotation):
        coords = [(-y, x) for x, y in coords]
    low_x, low_y = min(x for x, _ in coords), min(y for _, y in coords)
    return tuple(sorted((x-low_x, y-low_y) for x, y in coords))


def occupied_cells(board: Dict) -> Dict:
    return {(x, y): (i, tile["good"]) for i, tile in enumerate(board["tiles"]) for x, y in tile["cells"]}


def board_income(board: Dict, extra: set = None) -> int:
    data, occupied = BOARDS[board["kind"]], set(occupied_cells(board)) | (extra or set())
    return sum(next((step["value"] for step in track["steps"] if (step["x"], step["y"]) not in occupied), track["cap"])
               for track in data["tracks"])


def board_bonuses(board: Dict, extra: set = None) -> Dict:
    data = BOARDS[board["kind"]]
    occupied = set(occupied_cells(board)) | (extra or set())
    cells = {tuple(c) for c in data["cells"]}
    symbols = {(b["x"], b["y"]) for b in data["bonuses"]}
    covered = occupied | symbols
    goods = {}
    for bonus in data["bonuses"]:
        x, y = bonus["x"], bonus["y"]
        if (x, y) in occupied:
            continue
        neighbors = {(x+dx, y+dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy} & cells
        if neighbors <= covered:
            for good, count in bonus["goods"].items():
                goods[good] = goods.get(good, 0) + count
    return goods


def placement_error(player: Dict, board_index: int, good: str, x: int, y: int,
                    rotation: int = 0, flip: bool = False) -> Optional[str]:
    if any(type(n) is not int for n in (board_index, x, y, rotation)) or type(flip) is not bool:
        return "invalid placement coordinates"
    if good not in GOODS or not 0 <= board_index < len(player["boards"]) or not 0 <= rotation < 4:
        return "invalid board or good"
    if player["stock"].get(good, 0) < 1:
        return "good is not in your supply"
    board = player["boards"][board_index]
    data, color = BOARDS[board["kind"]], GOODS[good]["color"]
    if data["kind"] in ("home", "island"):
        allowed, restricted = ("green", "blue", "silver", "ore"), {"green"}
    elif data["kind"] == "house":
        allowed = ("orange", "red", "green", "blue", "silver") + (("wood",) if _trait(player, "wood_house") else ())
        restricted = {"orange", "red"}
    else:
        return "store building materials in a shed"
    if color not in allowed:
        return "this good cannot be placed on this board"
    cells = {(x+dx, y+dy) for dx, dy in oriented_cells(good, rotation, flip)}
    layout, occupied = {tuple(c) for c in data["cells"]}, occupied_cells(board)
    if not cells <= layout:
        return "tile crosses the board edge or a pillar"
    if cells & occupied.keys():
        return "tiles cannot overlap"
    if color in restricted:
        for cx, cy in cells:
            for pos in ((cx-1, cy), (cx+1, cy), (cx, cy-1), (cx, cy+1)):
                if pos in occupied and GOODS[occupied[pos][1]]["color"] == color:
                    return "tiles of this color cannot share an edge"
    covered = set(occupied) | cells | {(b["x"], b["y"]) for b in data["bonuses"]}
    for track in data["tracks"]:
        for step in track["steps"]:
            if (step["x"], step["y"]) not in cells:
                continue
            ox, oy = step["origin"]
            required = {(cx, cy) for cx, cy in layout if ox <= cx <= step["x"] and step["y"] <= cy <= oy}
            if not required <= covered:
                return "fill the lower-left income area first"
    return None


def placements_for(player: Dict, good: str, board_index: int) -> List[Dict]:
    board = BOARDS[player["boards"][board_index]["kind"]]
    found, seen = [], set()
    for flip in (False, True):
        for rotation in range(4):
            coords = oriented_cells(good, rotation, flip)
            if coords in seen:
                continue
            seen.add(coords)
            width, height = max(x for x, _ in coords)+1, max(y for _, y in coords)+1
            for y in range(board["height"]-height+1):
                for x in range(board["width"]-width+1):
                    if placement_error(player, board_index, good, x, y, rotation, flip) is None:
                        found.append({"type": "place", "board": board_index, "good": good, "x": x, "y": y,
                                      "rotation": rotation, "flip": flip})
    return found


def score_breakdown(player: Dict) -> Dict:
    score = {"ships": sum(SHIPS[s["kind"]]["points"] for s in player["ships"]),
             "emigration": sum(18 if kind == "knarr" else 21 for kind in player["emigrations"]),
             "islands": sum(BOARDS[b["kind"]]["points"] for b in player["boards"] if BOARDS[b["kind"]]["kind"] == "island"),
             "houses": sum(BOARDS[b["kind"]]["points"] for b in player["boards"] if BOARDS[b["kind"]]["kind"] in ("house", "shed")),
             "animals": sum(player["stock"].get(g, 0)*GOODS[g]["points"] for g in ("sheep", "cattle", "pregnant_sheep", "pregnant_cattle")),
             "occupations": sum(c["points"] for c in professions(player)), "silver": player["stock"].get("silver", 0),
             "crown": 2 if "crown" in player["specials"] else 0, "uncovered": 0,
             "penalties": -3*player["penalties"]}
    for b in player["boards"]:
        data, occupied = BOARDS[b["kind"]], occupied_cells(b)
        score["uncovered"] -= sum(tuple(cell) not in occupied for cell in data["negative"])
        score["uncovered"] -= sum(max(0, n-b["materials"].get(k, 0)) for k, n in data["materials"].items())
    score["total"] = sum(score.values())
    return score


def _gain(state: Dict, pid: str, goods: Dict) -> Dict:
    p, received = state["players"][pid], {}
    for key, amount in goods.items():
        if amount <= 0:
            continue
        if key in HOUSE_SUPPLY:
            amount = min(amount, state["houses"][key])
            state["houses"][key] -= amount
            p["boards"].extend(new_board(key) for _ in range(amount))
        elif key in SPECIALS:
            if key not in state["specials"]:
                continue
            state["specials"].remove(key)
            p["specials"].append(key)
            p["stock"][key] = p["stock"].get(key, 0)+1
            amount = 1
        else:
            p["stock"][key] = p["stock"].get(key, 0)+amount
        received[key] = amount
        if state.get("active") and state["current_turn"] == pid:
            gains = state["active"]["gains"]
            gains[key] = gains.get(key, 0)+amount
    return received


def _can_pay(p: Dict, cost: Dict) -> bool:
    return all(p["stock"].get(k, 0) >= n for k, n in cost.items())


def _pay(p: Dict, cost: Dict) -> None:
    for key, amount in cost.items():
        p["stock"][key] = p["stock"].get(key, 0)-amount


def _draw_weapons(state: Dict, pid: str, count: int, specific: str = None) -> None:
    rng = _rng(state)
    for _ in range(count):
        if specific:
            key = specific
            if key in state["weapon_discard"]:
                state["weapon_discard"].remove(key)
            elif key in state["weapon_deck"]:
                state["weapon_deck"].remove(key)
                rng.shuffle(state["weapon_deck"])
        else:
            if not state["weapon_deck"]:
                state["weapon_deck"] = state["weapon_discard"] or list(WEAPONS)*3
                state["weapon_discard"] = []
                rng.shuffle(state["weapon_deck"])
            key = state["weapon_deck"].pop()
        state["players"][pid]["weapons"][key] += 1
    state["_rng"] = rng.getstate()


def _draw_occupations(state: Dict, pid: str, count: int) -> None:
    for _ in range(min(count, len(state["occupation_deck"]))):
        state["players"][pid]["hand"].append(state["occupation_deck"].pop())


def _breed(player: Dict) -> Dict:
    result = {}
    stock = player["stock"]
    for kind in ("sheep", "cattle"):
        pregnant = stock.get("pregnant_" + kind, 0)
        if pregnant:
            stock["pregnant_"+kind] = 0
            stock[kind] = stock.get(kind, 0)+pregnant+1
            result[kind] = "birth"
        elif stock.get(kind, 0) >= 2:
            stock[kind] -= 1
            stock["pregnant_"+kind] = 1
            result[kind] = "pregnant"
    return result


def ship_room(player: Dict, kind: str) -> bool:
    return sum((s["kind"] == "whaler") == (kind == "whaler") for s in player["ships"]) < (3 if kind == "whaler" else 4)


def _add_ship(player: Dict, kind: str) -> None:
    player["ships"].append({"kind": kind, "ore": 0})


def feast_length(state: Dict, player: Dict) -> int:
    return max(0, 12-state["rounds"]+state["round"]-3*len(player["emigrations"]))


def _food_choices(p: Dict, remaining: int, previous: str, used: set) -> List[Dict]:
    choices = []
    for good, count in p["stock"].items():
        if not count or good not in GOODS:
            continue
        data = GOODS[good]
        color = data["color"]
        if color not in ("orange", "red", "silver") or (color == previous and color != "silver"):
            continue
        family = good.removeprefix("pregnant_")
        widths = [(False, min(data["width"], data["height"]))]
        if family not in used and data["width"] != data["height"]:
            widths.append((True, max(data["width"], data["height"])))
        for wide, width in widths:
            if width <= remaining:
                choices.append({"type": "serve", "good": good, "wide": wide})
    return choices


def feast_plan(player: Dict, length: int) -> List[Dict]:
    """Bounded beam search over table length, color, supply and horizontal uses.

    Keeping 100 alternatives per filled length avoids factorial food orderings
    while preserving diverse table states. A gap always gives a valid fallback.
    """
    table = player["feast"]
    start = sum(t["width"] for t in table)
    if start >= length:
        return []
    used = frozenset(t["good"].removeprefix("pregnant_") for t in table if t.get("wide"))
    previous = GOODS[table[-1]["good"]]["color"] if table and table[-1]["good"] != "gap" else "gap"
    layers = {start: [(0.0, (), dict(player["stock"]), previous, used)]}
    for filled in range(start, length):
        entries = sorted(layers.get(filled, []), key=lambda row: row[0])[:100]
        for cost, plan, stock, prior, wide_used in entries:
            p = {"stock": stock}
            options = _food_choices(p, length-filled, prior, wide_used)+[{"type": "serve_gap"}]
            for move in options:
                next_stock, next_used = dict(stock), wide_used
                if move["type"] == "serve_gap":
                    width, color, expense = 1, "gap", 100
                else:
                    good, wide = move["good"], move["wide"]
                    data = GOODS[good]
                    width = max(data["width"], data["height"]) if wide else min(data["width"], data["height"])
                    color = data["color"]
                    expense = 1 if good == "silver" else .3 + len(data["cells"])*.11 + data["points"]*1.5
                    next_stock[good] -= 1
                    if wide:
                        next_used = wide_used | {good.removeprefix("pregnant_")}
                target = filled+width
                layers.setdefault(target, []).append((cost+expense, plan+(move,), next_stock, color, next_used))
        # Deduplicate equivalent states, then prune in the next layer.
        for target in range(filled+1, min(length, filled+4)+1):
            if len(layers.get(target, [])) > 300:
                unique = {}
                for row in sorted(layers[target], key=lambda v: v[0]):
                    key = (row[3], row[4], tuple(sorted((k, n) for k, n in row[2].items() if n)))
                    unique.setdefault(key, row)
                layers[target] = list(unique.values())[:100]
    return list(min(layers[length], key=lambda row: row[0])[1])


def _serve(player: Dict, move: Dict) -> None:
    if move["type"] == "serve_gap":
        player["feast"].append({"good": "gap", "width": 1, "wide": False})
        player["penalties"] += 1
        return
    good, wide = move["good"], move["wide"]
    data = GOODS[good]
    width = max(data["width"], data["height"]) if wide else min(data["width"], data["height"])
    player["stock"][good] -= 1
    player["feast"].append({"good": good, "width": width, "wide": wide})


def _cost(player: Dict, e: Dict) -> Dict:
    cost = dict(e.get("cost", {}))
    if e.get("livestock") and "silver" in cost:
        cost["silver"] = max(0, cost["silver"]-_trait(player, "livestock_discount"))
    return cost


def _explore_available(state: Dict, player: Dict, island: Dict, tier: int) -> bool:
    ships = [s["kind"] for s in player["ships"]]
    return not island["owner"] and BOARDS[island["kind"]]["tier"] == tier and bool(
        ships if tier == 1 else [s for s in ships if s != "whaler"] if tier == 2 else [s for s in ships if s == "longship"])


def _migration_cost(state: Dict, p: Dict) -> int:
    return max(0, state["round"]-_trait(p, "migration_discount"))


def _effect_possible(state: Dict, pid: str, e: Dict) -> bool:
    p, kind = state["players"][pid], e["kind"]
    if kind == "choice":
        return any(_effect_possible(state, pid, option) for option in e["options"])
    if kind == "exchange":
        return _can_pay(p, _cost(p, e))
    if kind == "build":
        return bool(state["houses"][e["building"]] and _can_pay(p, e["cost"]))
    if kind == "ship":
        return ship_room(p, e["ship"]) and _can_pay(p, e["cost"])
    if kind == "settlement":
        return _can_pay(p, {"wood": 2, "stone": 2}) and ship_room(p, "knarr") and bool(state["houses"]["stone_house"] or state["houses"]["long_house"])
    if kind == "produce":
        return animal_count(p, e["animal"]) > 0
    if kind == "mountain":
        return any(m["items"] and m["id"] not in e.get("used", []) for m in state["mountains"])
    if kind == "upgrade":
        return any(n and GOODS[g].get("upgrade") and e.get("eligible", p["stock"]).get(g, 0) for g, n in p["stock"].items())
    if kind == "forge":
        return p["stock"].get("ore", 0) > 0
    if kind == "overseas":
        return p["stock"].get("silver", 0) > 0
    if kind == "special_sale":
        return any(GOODS[g]["price"] is not None and p["stock"].get("silver", 0) >= GOODS[g]["price"] for g in state["specials"])
    if kind == "explore":
        return any(_explore_available(state, p, i, e["tier"]) for i in state["islands"])
    if kind == "emigrate":
        return (len(p["emigrations"])*3+3 <= 12-state["rounds"]+state["round"] and
                p["stock"].get("silver", 0) >= _migration_cost(state, p) and any(s["kind"] != "whaler" for s in p["ships"]))
    if kind == "convert_whaler":
        return ship_room(p, "knarr") and any(s["kind"] == "whaler" for s in p["ships"])
    if kind == "occupation":
        return bool(p["hand"])
    if kind == "paid_occupation":
        return bool(p["hand"]) and bool(p["stock"].get("stone", 0) or p["stock"].get("ore", 0))
    return True


def _mark(e: Dict, main: bool, livestock: bool = False) -> Dict:
    result = copy.deepcopy(e)
    result["main"] = main
    if livestock:
        result["livestock"] = True
    if result["kind"] == "choice":
        result["options"] = [_mark(v, main, livestock) for v in result["options"]]
    return result


def _action_available(state: Dict, pid: str, key: str) -> bool:
    p, a = state["players"][pid], ACTIONS[key]
    if p["workers"] < a["workers"]:
        return False
    if a.get("ship") and sum(s["kind"] == a["ship"] for s in p["ships"]) < a.get("ships", 1):
        return False
    if key == "play_four" and state["occupation_deck"]:
        return True
    if key == "emigrate4":
        return (len(p["emigrations"])*3+3 <= 12-state["rounds"]+state["round"] and
                p["stock"].get("silver", 0) >= _migration_cost(state, p) and
                (any(s["kind"] != "whaler" for s in p["ships"]) or _effect_possible(state, pid, effect("convert_whaler"))))
    return any(_effect_possible(state, pid, _mark(e, True, a.get("livestock", False))) for e in a["effects"])


def _dice_value(player: Dict, e: Dict) -> int:
    if e["mode"] in ("raid", "pillage"):
        return e["roll"]+e["boost"]
    return max(0, e["roll"]-e["boost"]-_trait(player, e["mode"]+"_discount"))


def _dice_moves(state: Dict, pid: str, e: Dict) -> List[Dict]:
    p, moves = state["players"][pid], []
    value, high = _dice_value(p, e), e["mode"] in ("raid", "pillage")
    if high or value > 0:
        moves.append({"type": "fail"})
        if e["rolls"] < max([3]+[c.get("rolls", 3) for c in professions(p)]):
            moves.append({"type": "reroll"})
    material, weapon = ("stone", "sword") if high else ("wood", {"hunt": "bow", "snare": "snare", "whale": "spear"}[e["mode"]])
    rewards = [g for g, data in GOODS.items() if data["color"] == "blue" and (not data.get("special") or g in state["specials"])] if high else [None]
    for good in rewards:
        need = max(0, GOODS[good]["sword"]-value) if high else value
        for weapons in range(max(0, need-p["stock"].get(material, 0)), min(need, p["weapons"][weapon])+1):
            payment = {k: v for k, v in ((material, need-weapons), (weapon, weapons)) if v}
            move = {"type": "succeed", "payment": payment}
            if good:
                move["good"] = good
            moves.append(move)
    return moves


def _pending_moves(state: Dict, pid: str) -> List[Dict]:
    p, e = state["players"][pid], state["pending"][0]
    kind, moves = e["kind"], []
    if kind == "dice":
        return _dice_moves(state, pid, e)
    if kind == "timing":
        return [{"type": "timing", "option": "before"}, {"type": "timing", "option": "after"}, {"type": "timing", "option": "skip"}]
    if kind == "choice":
        moves = [{"type": "choose", "index": i} for i, opt in enumerate(e["options"]) if _effect_possible(state, pid, opt)]
    elif kind in ("exchange", "build", "ship", "overseas"):
        if _effect_possible(state, pid, e):
            moves = [{"type": "accept"}]
    elif kind == "settlement":
        moves = [{"type": "choose", "option": k} for k in ("stone_house", "long_house") if state["houses"][k]]
    elif kind == "mountain":
        moves = [{"type": "take_mountain", "index": m["id"], "count": n} for m in state["mountains"]
                 if m["id"] not in e["used"] for n in range(1, min(e["counts"][0], len(m["items"]))+1)]
    elif kind == "upgrade":
        moves = [{"type": "upgrade", "good": good} for good, n in e["eligible"].items()
                 if n and p["stock"].get(good, 0) and GOODS[good].get("upgrade")]
    elif kind == "forge":
        moves = [{"type": "take_good", "good": g} for g in ["jewelry"]+state["specials"] if g == "jewelry" or GOODS[g]["forge"]]
    elif kind == "special_sale":
        moves = [{"type": "take_good", "good": g} for g in state["specials"]
                 if GOODS[g]["price"] is not None and GOODS[g]["price"] <= p["stock"].get("silver", 0)]
    elif kind == "explore":
        moves = [{"type": "explore", "index": i} for i, island in enumerate(state["islands"]) if _explore_available(state, p, island, e["tier"])]
    elif kind in ("emigrate", "convert_whaler"):
        moves = [{"type": kind, "index": i} for i, s in enumerate(p["ships"]) if (s["kind"] == "whaler") == (kind == "convert_whaler")]
    elif kind == "occupation":
        moves = [{"type": "play_occupation", "card": c} for c in p["hand"]]
    elif kind == "paid_occupation":
        moves = [{"type": "pay_occupation", "good": g} for g in ("stone", "ore") if p["stock"].get(g, 0)]
    may_skip = (not e.get("main") or not state["active"] or state["active"]["used"] or
                any(n.get("main") and _effect_possible(state, pid, n) for n in state["pending"][1:]))
    if may_skip:
        moves.append({"type": "skip"})
    return moves


def _can_free(state: Dict, pid: str) -> bool:
    if pid not in state["players"] or state["game_over"] or pid in state["ready"]:
        return False
    if state["phase"] not in ("action", "prepare", "feast", "final_placement"):
        return False
    if state["phase"] == "action" and state["current_turn"] == pid and state["pending"]:
        return False
    if state["phase"] == "feast" and pid in state["feast_done"]:
        return False
    return True


def _free_moves(state: Dict, pid: str) -> List[Dict]:
    if not _can_free(state, pid):
        return []
    p, moves = state["players"][pid], []
    for kind, data in SHIPS.items():
        if ship_room(p, kind) and p["stock"].get("silver", 0) >= data["cost"]:
            moves.append({"type": "buy_ship", "ship": kind})
    # Arming is forbidden during an action, including any unresolved die roll.
    if not (state["active"] and state["current_turn"] == pid):
        moves += [{"type": "arm", "index": i} for i, s in enumerate(p["ships"])
                  if p["stock"].get("ore", 0) and s["ore"] < SHIPS[s["kind"]]["capacity"]]
    for i, b in enumerate(p["boards"]):
        for good, n in BOARDS[b["kind"]]["materials"].items():
            if b["materials"][good] < n and p["stock"].get(good, 0):
                moves.append({"type": "store", "board": i, "good": good})
    for card in p["occupations"]:
        data = OCCUPATIONS[card_kind(card)]
        trades = data.get("trades", [])+([data["trade"]] if "trade" in data else [])
        for i, trade in enumerate(trades):
            if _can_pay(p, trade["cost"]):
                moves.append({"type": "profession_trade", "card": card, "index": i})
            if "cattle" in trade["cost"] and p["stock"].get("pregnant_cattle", 0):
                moves.append({"type": "profession_trade", "card": card, "index": i, "option": "pregnant"})
        if data.get("shop") and p["stock"].get("silver", 0):
            moves += [{"type": "shop", "good": g} for g, n in p["stock"].items() if n and GOODS[g]["color"] == "orange"]
    if _trait(p, "tutor") and p["stock"].get("silver", 0):
        # Card resolutions use the turn queue, so a tutor is used on your turn.
        if state["phase"] == "action" and state["current_turn"] == pid:
            moves += [{"type": "tutor", "card": card} for card in p["hand"]]
    return moves


def legal_moves(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["players"] or state["game_over"]:
        return []
    p, phase = state["players"][pid], state["phase"]
    if phase == "round_end":
        return [] if pid in state["ready"] else [{"type": "next_round"}]
    moves = _free_moves(state, pid)
    if phase in ("prepare", "final_placement"):
        return moves+([] if pid in state["ready"] else [{"type": "ready"}])
    if phase == "feast":
        if pid in state["feast_done"]:
            return []
        table = p["feast"]
        remaining = feast_length(state, p)-sum(t["width"] for t in table)
        used = {t["good"].removeprefix("pregnant_") for t in table if t["wide"]}
        prev = GOODS[table[-1]["good"]]["color"] if table and table[-1]["good"] != "gap" else "gap"
        if remaining:
            moves += _food_choices(p, remaining, prev, used)+[{"type": "serve_gap"}, {"type": "auto_feast"}]
        moves.append({"type": "finish_feast"})
        if _hooks(p, "no_mead") and not p["clear_mind_used"] and not any(t["good"] == "mead" for t in table):
            moves.append({"type": "no_mead"})
        if p["clear_mind_used"]:
            moves = [m for m in moves if m.get("good") != "mead"]
        return moves
    if state["current_turn"] != pid:
        return moves
    if state["pending"]:
        return _pending_moves(state, pid)
    if state["active"]:
        return moves+[{"type": "end_turn"}]
    moves.append({"type": "pass"})
    for key in ACTIONS:
        if key not in state["occupied"] and _action_available(state, pid, key):
            moves.append({"type": "occupy", "space": key})
    for column in state["imitation"]:
        slot = "imitate"+str(column)
        if slot in state["occupied"]:
            continue
        for key, owner in state["occupied"].items():
            if key in ACTIONS and owner["player_id"] != pid and ACTIONS[key]["workers"] == column and _action_available(state, pid, key):
                moves.append({"type": "occupy", "space": slot, "copy": key})
    return moves


def _used(state: Dict, e: Dict) -> None:
    if state["active"] and e.get("main"):
        state["active"]["used"] = True


def _settle(state: Dict) -> None:
    pid = state["current_turn"]
    if not pid:
        return
    p = state["players"][pid]
    while state["pending"]:
        e = state["pending"][0]
        kind = e["kind"]
        if kind == "gain":
            _gain(state, pid, e["items"])
        elif kind == "draw":
            _draw_occupations(state, pid, e["count"])
        elif kind == "weapons":
            _draw_weapons(state, pid, e["count"])
        elif kind == "wood_ore":
            _gain(state, pid, {"wood": len(state["order"]), "ore": 1})
        elif kind == "produce":
            count = animal_count(p, e["animal"])
            if count:
                _gain(state, pid, {e["good"]: e.get("fixed", min(count, e.get("maximum", 3)))})
        elif not _effect_possible(state, pid, e):
            state["pending"].pop(0)
            continue
        else:
            if kind == "mountain":
                e.setdefault("used", [])
            elif kind == "upgrade":
                e.setdefault("eligible", {g: n for g, n in p["stock"].items() if n and GOODS[g].get("upgrade")})
            elif kind == "hunt":
                mode = e["mode"]
                e["kind"], e["rolls"] = "dice", 1
                e["sides"] = 12 if mode in ("whale", "pillage") else 8
                if mode == "whale":
                    boats = sorted((1+s["ore"] for s in p["ships"] if s["kind"] == "whaler"), reverse=True)
                    e["boost"] = sum(boats[:e["boats"]])
                elif mode == "pillage":
                    e["boost"] = max((s["ore"] for s in p["ships"] if s["kind"] == "longship"), default=0)
                else:
                    e["boost"] = 0
                e["roll"] = _roll(state, e["sides"])
                _log(state, pid, f"🎲 {e['roll']} / {e['sides']}")
            break
        _used(state, e)
        state["pending"].pop(0)


def _play_occupation(state: Dict, pid: str, card: str) -> None:
    p, data = state["players"][pid], OCCUPATIONS[card_kind(card)]
    p["hand"].remove(card)
    p["occupations"].append(card)
    _log(state, pid, "📜 "+data["name"])
    immediate = data.get("immediate")
    if immediate == "fruit":
        _gain(state, pid, {"fruit": 1})
    elif immediate == "bow":
        _draw_weapons(state, pid, 1, "bow")
    elif immediate == "breed":
        _breed(p)
    elif immediate == "orient":
        state["pending"].insert(0, effect("upgrade", count=1, steps=3, main=False))
    elif immediate == "milkman":
        n = int(animal_count(p, "sheep") > 0)+int(animal_count(p, "cattle") > 0)
        _gain(state, pid, {"milk": n, "silver": n})
    elif immediate == "miner":
        n = sum(s["kind"] == "longship" for s in p["ships"])
        _gain(state, pid, {"stone": n, "ore": n, "silver": n})
    elif immediate == "houses":
        _gain(state, pid, {"silver": 2*sum(BOARDS[b["kind"]]["kind"] == "house" for b in p["boards"])})
    elif immediate == "outfitter":
        _gain(state, pid, {"oil": sum(s["kind"] == "knarr" for s in p["ships"]), "wood": sum(s["kind"] == "whaler" for s in p["ships"])})
    elif immediate == "fisher":
        _gain(state, pid, {"fish": sum(s["kind"] == "whaler" for s in p["ships"])})
    elif immediate == "arms":
        _draw_weapons(state, pid, (0, 2, 5, 10, 10)[sum(s["kind"] == "longship" for s in p["ships"])])


def _advance_turn(state: Dict) -> None:
    current = state["current_turn"]
    start = state["order"].index(current)
    if not state["players"][current]["workers"]:
        state["players"][current]["passed"] = True
    for step in range(1, len(state["order"])+1):
        pid = state["order"][(start+step) % len(state["order"])]
        if not state["players"][pid]["passed"] and state["players"][pid]["workers"]:
            state["current_turn"] = pid
            return
    state["current_turn"] = None
    state["phase"] = "prepare"
    state["ready"] = []
    if state["last_worker"]:
        state["first_player"] = state["last_worker"]
    for pid, p in state["players"].items():
        craft = sum(n["workers"] for key, n in state["occupied"].items() if n["player_id"] == pid and n["round"] == state["round"] and ACTIONS[n["action"]]["group"] == "craft")
        if craft >= 5:
            _gain(state, pid, {"oil": _hooks(p, "craft5")})
    _log(state, None, "Income · 完成拼板后点击 Ready，所有人准备完毕再发收入。")


def _end_turn(state: Dict, pid: str) -> None:
    p, active = state["players"][pid], state["active"]
    gains = active["gains"]
    bonus = (_hooks(p, "wood2") if gains.get("wood", 0) >= 2 else 0)+(_hooks(p, "stone1") if gains.get("stone", 0) else 0)
    _gain(state, pid, {"silver": bonus})
    p["turns"] += 1
    state["active"] = None
    _advance_turn(state)


def _begin_income(state: Dict) -> None:
    state["phase"], state["ready"], state["feast_done"] = "feast", [], []
    state["review"] = []
    for pid in state["order"]:
        p = state["players"][pid]
        income = sum(board_income(b) for b in p["boards"])
        _gain(state, pid, {"silver": income})
        p["last_income"] = income
        breeding = _breed(p)
        state["review"].append({"player_id": pid, "income": income, "breeding": breeding, "feast": [], "penalties": 0, "bonus": {}})
        p["feast"], p["clear_mind_used"] = [], False
    _log(state, None, "Feast · 收入已发放，家畜已繁殖。")


def _finish_feast(state: Dict, pid: str) -> None:
    p = state["players"][pid]
    remaining = feast_length(state, p)-sum(t["width"] for t in p["feast"])
    for _ in range(remaining):
        _serve(p, {"type": "serve_gap"})
    if _hooks(p, "no_mead") and not p["clear_mind_used"] and not any(t["good"] == "mead" for t in p["feast"]):
        _gain(state, pid, {"silver": _hooks(p, "no_mead")})
    _gain(state, pid, {"silver": _hooks(p, "grain")*min(2, p["stock"].get("grain", 0))})
    row = next(r for r in state["review"] if r["player_id"] == pid)
    row["feast"], row["penalties"] = copy.deepcopy(p["feast"]), sum(t["good"] == "gap" for t in p["feast"])
    state["feast_done"].append(pid)
    if len(state["feast_done"]) != len(state["order"]):
        return
    if state["round"] == state["rounds"]:
        state["phase"], state["ready"] = "final_placement", []
        _log(state, None, "Final placement · 可做最后的拼板；末轮收入已计入银币，不重复加分。")
        return
    # Snapshot every board before awarding anything (no cascading bonuses).
    rewards = {}
    for player_id in state["order"]:
        goods = {}
        for board in state["players"][player_id]["boards"]:
            for good, n in board_bonuses(board).items():
                goods[good] = goods.get(good, 0)+n
        rewards[player_id] = goods
    for row in state["review"]:
        row["bonus"] = _gain(state, row["player_id"], rewards[row["player_id"]])
    for m in state["mountains"]:
        if m["items"]:
            m["items"].pop(0)
        if m["items"] == ["silver2"]:
            m["items"] = []
    state["mountains"] = [m for m in state["mountains"] if m["items"]]
    if state["mountain_deck"]:
        state["mountains"].append(state["mountain_deck"].pop())
    state["phase"], state["ready"] = "round_end", []
    _log(state, None, "Round complete · 等待所有玩家点击 Next Round。")


def _start_round(state: Dict) -> None:
    state["phase"], state["ready"], state["active"], state["pending"] = "action", [], None, []
    state["occupied"] = {k: v for k, v in state["occupied"].items() if len(state["order"]) == 1 and v["round"] == state["round"]-1}
    state["current_turn"], state["last_worker"] = state["first_player"], None
    round_no = state["round"]
    for pid, p in state["players"].items():
        p["workers"], p["passed"] = 12-state["rounds"]+round_no, False
        p["feast"], p["clear_mind_used"] = [], False
        level = HARVEST[state["rounds"]][round_no-1]
        crops = {g: 1 for level_id, goods in CROPS.items() if level_id <= level for g in goods}
        _gain(state, pid, crops)
        _draw_weapons(state, pid, 1)
    flip_at = round_no-(3 if state["rounds"] == 7 else 2)
    if 0 <= flip_at < 4:
        for i, island in enumerate(state["islands"]):
            if island["owner"]:
                continue
            if i == flip_at:
                island["kind"], island["silver"] = ISLAND_PAIRS[i][1], 0
            else:
                island["silver"] += 2
    _log(state, None, f"Round {round_no} · 新工人、收获和武器已结算。")


def _finish_game(state: Dict) -> None:
    scores = [{"player_id": pid, **score_breakdown(state["players"][pid])} for pid in state["order"]]
    top = max(s["total"] for s in scores)
    state["result"] = {"scores": scores, "winners": [s["player_id"] for s in scores if s["total"] == top]}
    state["game_over"], state["phase"] = True, "game_over"
    _log(state, None, "Game over · 终局计分完成。")


def _resolve(state: Dict, pid: str, move: Dict) -> None:
    p, e = state["players"][pid], state["pending"][0]
    t, kind = move["type"], e["kind"]
    if t == "skip":
        state["pending"].pop(0)
        return
    if t == "timing":
        state["pending"].pop(0)
        if move["option"] != "skip":
            state["pending"].insert(0 if move["option"] == "before" else len(state["pending"]), effect("occupation", count=1, main=False))
        return
    if t == "choose" and kind == "choice":
        state["pending"][0] = copy.deepcopy(e["options"][move["index"]])
        return
    if t == "reroll":
        e["roll"], e["rolls"] = _roll(state, e["sides"]), e["rolls"]+1
        _log(state, pid, f"🎲 {e['roll']} / {e['sides']} · roll {e['rolls']}")
        return
    _used(state, e)
    if t == "accept":
        if kind == "exchange":
            _pay(p, _cost(p, e))
            _gain(state, pid, e["reward"])
        elif kind == "build":
            _pay(p, e["cost"])
            _gain(state, pid, {e["building"]: 1})
        elif kind == "ship":
            _pay(p, e["cost"])
            _add_ship(p, e["ship"])
        elif kind == "overseas":
            _pay(p, {"silver": 1})
            state["pending"][0] = effect("upgrade", count=8, steps=1, main=True,
                                          eligible={g: 1 for g, n in p["stock"].items() if n and GOODS[g]["color"] == "green"})
            return
    elif kind == "settlement":
        _pay(p, {"wood": 2, "stone": 2})
        _gain(state, pid, {move["option"]: 1})
        _add_ship(p, "longship" if move["option"] == "stone_house" else "knarr")
    elif t == "take_mountain":
        m = next(m for m in state["mountains"] if m["id"] == move["index"])
        items, m["items"] = m["items"][:move["count"]], m["items"][move["count"]:]
        for item in items:
            _gain(state, pid, {"silver": 2} if item == "silver2" else {item: 1})
        _gain(state, pid, {"silver": items.count("stone")*_hooks(p, "mountain_stone")})
        e["used"].append(m["id"])
        e["counts"].pop(0)
        if e["counts"]:
            return
    elif t == "upgrade":
        good = move["good"]
        p["stock"][good] -= 1
        e["eligible"][good] -= 1
        result = good
        for _ in range(e["steps"]):
            result = GOODS[result].get("upgrade") or result
        _gain(state, pid, {result: 1})
        e["count"] -= 1
        if e["count"]:
            return
    elif t == "take_good":
        good = move["good"]
        _pay(p, {"ore": 1} if kind == "forge" else {"silver": GOODS[good]["price"]})
        _gain(state, pid, {good: 1})
        if kind == "special_sale":
            e["count"] -= 1
            if e["count"]:
                return
    elif t == "explore":
        island = state["islands"][move["index"]]
        island["owner"] = pid
        p["boards"].append(new_board(island["kind"]))
        _gain(state, pid, {"silver": island["silver"]})
        island["silver"] = 0
    elif t == "emigrate":
        _pay(p, {"silver": _migration_cost(state, p)})
        p["emigrations"].append(p["ships"].pop(move["index"])["kind"])
    elif t == "convert_whaler":
        p["ships"].pop(move["index"])
        _add_ship(p, "knarr")
    elif t == "pay_occupation":
        _pay(p, {move["good"]: 1})
        _gain(state, pid, {"silver": 1})
        state["pending"][0] = effect("occupation", count=1, main=True)
        return
    elif t == "play_occupation":
        e["count"] -= 1
        if not e["count"]:
            state["pending"].pop(0)
        _play_occupation(state, pid, move["card"])
        return
    elif t in ("succeed", "fail"):
        high = e["mode"] in ("raid", "pillage")
        weapon = "sword" if high else {"hunt": "bow", "snare": "snare", "whale": "spear"}[e["mode"]]
        if t == "succeed":
            for good, n in move["payment"].items():
                if good in WEAPONS:
                    p["weapons"][good] -= n
                    state["weapon_discard"].extend([good]*n)
                else:
                    p["stock"][good] -= n
            if high:
                _gain(state, pid, {move["good"]: 1})
            elif e["mode"] == "hunt":
                _gain(state, pid, {"hide": 1, "game_meat": 1, "silver": _hooks(p, "hunt")})
            elif e["mode"] == "snare":
                _gain(state, pid, {"fur": 1})
                _draw_weapons(state, pid, 1, "snare")
            else:
                _gain(state, pid, {"oil": 1+_hooks(p, "whale"), "skin": 1, "whale_meat": 1})
        else:
            _gain(state, pid, {"stone" if high else "wood": 1})
            _draw_weapons(state, pid, 1, weapon)
            refund = {"snare": 1, "whale": 2, "pillage": 1}.get(e["mode"], 0)
            p["workers"] += refund
            state["occupied"][state["active"]["space"]]["workers"] -= refund
        _log(state, pid, "🎲 "+("成功" if t == "succeed" else "失败，获得补偿"))
    state["pending"].pop(0)


def _apply(state: Dict, pid: str, move: Dict) -> None:
    p, t = state["players"][pid], move["type"]
    if t == "place":
        good, x, y = move["good"], move["x"], move["y"]
        p["stock"][good] -= 1
        p["boards"][move["board"]]["tiles"].append({"good": good, "cells": [[x+dx, y+dy] for dx, dy in oriented_cells(good, move["rotation"], move["flip"])]})
        return
    if t == "occupy":
        key, space = move.get("copy", move["space"]), move["space"]
        action = ACTIONS[key]
        p["workers"] -= action["workers"]
        state["last_worker"] = pid
        state["occupied"][space] = {"player_id": pid, "workers": action["workers"], "round": state["round"], "action": key}
        state["active"] = {"space": space, "action": key, "used": False, "gains": {}}
        state["pending"] = [_mark(e, True, action.get("livestock", False)) for e in action["effects"]]
        if action["workers"] == 3:
            _draw_occupations(state, pid, 1)
        if key.startswith("overseas"):
            _gain(state, pid, {"oil": _hooks(p, "overseas")})
        if action["workers"] == 4 and p["hand"]:
            state["pending"].insert(0, effect("timing"))
        _log(state, pid, f"🧑‍🌾 {action['workers']} · {action['name']}")
    elif state["phase"] == "action" and state["current_turn"] == pid and state["pending"]:
        _resolve(state, pid, move)
    elif t == "pass":
        p["passed"] = True
        _log(state, pid, "Pass")
        _advance_turn(state)
    elif t == "end_turn":
        _end_turn(state, pid)
    elif t == "buy_ship":
        _pay(p, {"silver": SHIPS[move["ship"]]["cost"]})
        _add_ship(p, move["ship"])
    elif t == "arm":
        _pay(p, {"ore": 1})
        p["ships"][move["index"]]["ore"] += 1
    elif t == "store":
        _pay(p, {move["good"]: 1})
        p["boards"][move["board"]]["materials"][move["good"]] += 1
    elif t == "profession_trade":
        data = OCCUPATIONS[card_kind(move["card"])]
        trade = (data.get("trades", [])+([data["trade"]] if "trade" in data else []))[move["index"]]
        cost = dict(trade["cost"])
        if move.get("option") == "pregnant":
            cost["pregnant_cattle"] = cost.pop("cattle")
        _pay(p, cost)
        _gain(state, pid, trade["reward"])
    elif t == "shop":
        _pay(p, {"silver": 1, move["good"]: 1})
        _gain(state, pid, {GOODS[move["good"]]["upgrade"]: 1})
    elif t == "tutor":
        _pay(p, {"silver": 1})
        _play_occupation(state, pid, move["card"])
    elif t == "ready":
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["order"]):
            if state["phase"] == "prepare":
                _begin_income(state)
            else:
                _finish_game(state)
    elif t in ("serve", "serve_gap"):
        _serve(p, move)
    elif t == "no_mead":
        p["clear_mind_used"] = True
        _gain(state, pid, {"silver": _hooks(p, "no_mead")})
    elif t == "auto_feast":
        planning = copy.deepcopy(p)
        if p["clear_mind_used"]:
            planning["stock"]["mead"] = 0
        for part in feast_plan(planning, feast_length(state, p)):
            _serve(p, part)
        _finish_feast(state, pid)
    elif t == "finish_feast":
        _finish_feast(state, pid)
    elif t == "next_round":
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["order"]):
            state["round"] += 1
            _start_round(state)
    _settle(state)


class AFeastForOdinGame:
    game_id = "a_feast_for_odin"
    min_players = 1
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or set(config)-{"rounds", "seed"}:
            raise ValueError("invalid Odin configuration")
        rounds = config.get("rounds", 7)
        if type(rounds) is not int or rounds not in (6, 7) or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("rounds must be 6 or 7; seed must be an integer")
        if not 1 <= len(players) <= 4:
            raise ValueError("A Feast for Odin requires 1–4 players")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p.get("player_id") for p in ordered]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        seed = config.get("seed", secrets.randbits(128))
        rng = random.Random(seed)
        starters = [key+":0" for key, data in OCCUPATIONS.items() if data.get("start")]
        deck = [key+":"+str(i) for key, data in OCCUPATIONS.items() if not data.get("start") for i in range(2)]
        weapons = [w for w in WEAPONS for _ in range(11 if w == "sword" else 12-len(ids))]
        mountains = [{"id": i, "items": list(row)} for i, row in enumerate(MOUNTAINS)]
        for values in (starters, deck, weapons, mountains):
            rng.shuffle(values)
        state = {"game_id": AFeastForOdinGame.game_id, "version": 1, "ruleset": "odin_digital_1", "seed": seed,
                 "revision": 0, "phase": "action", "round": 1, "rounds": rounds, "order": ids,
                 "first_player": rng.choice(ids), "current_turn": None, "last_worker": None,
                 "players": {}, "player_meta": {}, "occupied": {}, "active": None, "pending": [],
                 "ready": [], "feast_done": [], "review": [], "log": [], "game_over": False, "result": None,
                 "occupation_deck": deck, "weapon_deck": weapons, "weapon_discard": [],
                 "mountains": mountains[:3 if len(ids) == 4 else 2], "mountain_deck": mountains[3 if len(ids) == 4 else 2:],
                 "islands": [{"kind": pair[0], "silver": 0, "owner": None} for pair in ISLAND_PAIRS],
                 "specials": list(SPECIALS), "houses": dict(HOUSE_SUPPLY),
                 "imitation": [rng.choice((1, 2)), rng.choice((3, 4))] if len(ids) == 4 else [], "_rng": rng.getstate()}
        for meta in ordered:
            pid = meta["player_id"]
            state["player_meta"][pid] = {"name": meta.get("name", pid), "seat": meta.get("seat", 0), "is_bot": bool(meta.get("is_bot"))}
            state["players"][pid] = {"stock": {"mead": 1}, "weapons": {"bow": 1, "snare": 1, "spear": 1, "sword": 0},
                                      "hand": [starters.pop()], "occupations": [], "ships": [], "emigrations": [],
                                      "boards": [new_board("home")], "workers": 0, "passed": False,
                                      "specials": [], "penalties": 0, "feast": [], "clear_mind_used": False,
                                      "turns": 0, "last_income": 0}
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        moves = list(dict.fromkeys(m["type"] for m in legal_moves(state, player_id)))
        if _can_free(state, player_id):
            moves.append("place")
        return moves

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or player_id not in state["players"]:
            return [], "invalid player or action"
        if type(action.get("revision")) is not int or action["revision"] != state["revision"]:
            return [], "stale action; refresh your selection"
        try:
            if action.get("type") == "place":
                if set(action) != {"type", "revision", "board", "good", "x", "y", "rotation", "flip"} or not _can_free(state, player_id):
                    return [], "placement unavailable"
                error = placement_error(state["players"][player_id], action["board"], action["good"], action["x"], action["y"], action["rotation"], action["flip"])
                if error:
                    return [], error
            else:
                key = json.dumps(action, sort_keys=True, allow_nan=False)
                options = {json.dumps({**m, "revision": state["revision"]}, sort_keys=True) for m in legal_moves(state, player_id)}
                if key not in options:
                    return [], "action unavailable; refresh your selection"
            trial = copy.deepcopy(state)
            _apply(trial, player_id, action)
            trial["revision"] += 1
        except (TypeError, ValueError, KeyError, IndexError) as exc:
            return [], "invalid action: "+str(exc)
        state.clear()
        state.update(trial)
        return [{"type": "a_feast_for_odin:update", "payload": {"actor": player_id, "action": action["type"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        private = {"seed", "_rng", "occupation_deck", "weapon_deck", "weapon_discard", "mountain_deck", "players", "player_meta"}
        view = {k: copy.deepcopy(v) for k, v in state.items() if k not in private}
        view["you"], view["players"] = viewer_id, []
        for pid in state["order"]:
            p = copy.deepcopy(state["players"][pid])
            p["hand_count"] = len(p["hand"])
            if pid != viewer_id:
                p.pop("hand")
            p.update(player_id=pid, **copy.deepcopy(state["player_meta"][pid]), projected=score_breakdown(p),
                     income=sum(board_income(b) for b in p["boards"]), feast_length=feast_length(state, p))
            view["players"].append(p)
        view["moves"] = [{**m, "revision": state["revision"]} for m in legal_moves(state, viewer_id)]
        view["can_place"] = _can_free(state, viewer_id)
        view["legal_actions"] = AFeastForOdinGame.get_legal_actions(state, viewer_id)
        view["deck_count"] = len(state["occupation_deck"])
        view["catalog"] = copy.deepcopy({"goods": GOODS, "weapons": WEAPONS, "ships": SHIPS, "boards": BOARDS,
                                         "actions": ACTIONS, "occupations": OCCUPATIONS, "harvest": HARVEST[state["rounds"]]})
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.a_feast_for_odin_ai import choose_move
        return choose_move(AFeastForOdinGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return json.loads(json.dumps(state, allow_nan=False))

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            if payload["game_id"] != AFeastForOdinGame.game_id or payload["version"] != 1:
                raise ValueError("invalid Odin save version")
            state = copy.deepcopy(payload)
            ids = state["order"]
            if not 1 <= len(ids) <= 4 or len(set(ids)) != len(ids) or set(ids) != set(state["players"]):
                raise ValueError("invalid players")
            if state["phase"] not in ("action", "prepare", "feast", "round_end", "final_placement", "game_over") or not 1 <= state["round"] <= state["rounds"] or state["rounds"] not in (6, 7):
                raise ValueError("invalid phase or round")
            for p in state["players"].values():
                if type(p["workers"]) is not int or not 0 <= p["workers"] <= 12:
                    raise ValueError("invalid workers")
                if any(k not in GOODS or type(n) is not int or n < 0 for k, n in p["stock"].items()):
                    raise ValueError("invalid supply")
                if any(type(n) is not int or n < 0 for n in p["weapons"].values()):
                    raise ValueError("invalid weapons")
                for b in p["boards"]:
                    if b["kind"] not in BOARDS:
                        raise ValueError("invalid board")
                    occupied = [tuple(c) for t in b["tiles"] for c in t["cells"]]
                    if len(occupied) != len(set(occupied)) or not set(occupied) <= {tuple(c) for c in BOARDS[b["kind"]]["cells"]}:
                        raise ValueError("invalid board coverage")
            _rng(state)
            AFeastForOdinGame.get_public_view(state, ids[0])
            json.dumps(state, allow_nan=False)
            return state
        except (KeyError, TypeError, IndexError, AttributeError) as exc:
            raise ValueError("invalid Odin save") from exc
