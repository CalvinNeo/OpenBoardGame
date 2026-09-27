"""Local Odin opponent. Decisions use only the supplied player's public view."""
import copy
from typing import Dict, Optional

from game.a_feast_for_odin_data import ACTIONS, BOARDS, GOODS, OCCUPATIONS, SHIPS
from game.a_feast_for_odin import (
    animal_count, board_bonuses, board_income, card_kind, occupied_cells,
    oriented_cells, placements_for,
)


def _food_capacity(p: Dict) -> float:
    values = {"orange": 0.0, "red": 0.0}
    for g, n in p["stock"].items():
        d = GOODS[g]
        if n and d["color"] in values and not d["points"]:
            values[d["color"]] += max(d["width"], d["height"])+(n-1)*min(d["width"], d["height"])
    # Repeated colors need separators; coins can bridge those gaps.
    return min(sum(values.values()), 2*min(values.values())+4)+p["stock"].get("silver", 0)


def good_value(p: Dict, good: str, remaining: int) -> float:
    if good in ("wood", "stone", "ore", "silver"):
        return {"wood": 2.1 if remaining else .4, "stone": 1.6 if remaining else .4,
                "ore": 2.3 if remaining else .8, "silver": 1.0}[good]
    if good in ("shed", "stone_house", "long_house"):
        return {"shed": 4.2, "stone_house": 5.5, "long_house": 8}[good]+remaining*.5
    d = GOODS[good]
    if d["points"] and not d.get("special"):
        base = good.removeprefix("pregnant_")
        return d["points"]+max(0, remaining)*(.9 if animal_count(p, base) == 1 else .45)+2
    if d["color"] in ("blue", "green"):
        return len(d["cells"])*(.9 if d["color"] == "blue" else .69)+.8+d["points"]
    need = max(0, p.get("feast_length", 8)-_food_capacity(p))
    food = max(d["width"], d["height"])
    return .55+food*(.8 if need else .32)+len(d["cells"])*(.1 if remaining else .02)


def _effect_value(view: Dict, p: Dict, e: Dict, remaining: int) -> float:
    kind = e["kind"]
    val = lambda goods: sum(good_value(p, g, remaining)*n for g, n in goods.items())
    if kind == "gain":
        return val(e["items"])
    if kind == "exchange":
        if any(p["stock"].get(g, 0) < n for g, n in e["cost"].items()):
            return 0
        return val(e["reward"])-val(e["cost"])
    if kind == "choice":
        return max((_effect_value(view, p, opt, remaining) for opt in e["options"]), default=0)
    if kind == "ship":
        kind = e["ship"]
        owned = sum(s["kind"] == kind for s in p["ships"])
        utility = (5 if kind == "knarr" and not owned else 4 if kind == "whaler" and owned < 2 else 3 if kind == "longship" and not owned else 1)*min(1, remaining/3)
        return SHIPS[kind]["points"]+utility-val(e["cost"])
    if kind == "build":
        return good_value(p, e["building"], remaining)-val(e["cost"])
    if kind == "settlement":
        return 10+remaining*.7
    if kind == "produce":
        n = animal_count(p, e["animal"])
        return good_value(p, e["good"], remaining)*(e.get("fixed", min(3, n)) if n else 0)
    if kind == "mountain":
        values = sorted((val({g: m["items"][:n].count(g) for g in set(m["items"][:n]) if g != "silver2"})+2*m["items"][:n].count("silver2")
                         for m in view["mountains"] for n in [e["counts"][0]]), reverse=True)
        return sum(values[:len(e["counts"])] or [0])
    if kind == "wood_ore":
        return good_value(p, "wood", remaining)*len(view["order"])+good_value(p, "ore", remaining)
    if kind == "upgrade":
        values = []
        for g, n in p["stock"].items():
            if not n or not GOODS[g].get("upgrade"):
                continue
            result = g
            for _ in range(e["steps"]):
                result = GOODS[result].get("upgrade") or result
            v = good_value(p, result, remaining)-good_value(p, g, remaining)+.9
            values.extend([v]*min(n, e["count"]))
        return sum(sorted(values, reverse=True)[:e["count"]])
    if kind == "overseas":
        return sum(max(1.5, len(GOODS[g]["cells"])*.35) for g, n in p["stock"].items() if n and GOODS[g]["color"] == "green")-1
    if kind == "forge":
        return 8.2-good_value(p, "ore", remaining)
    if kind == "special_sale":
        return 8
    if kind == "hunt":
        mode = e["mode"]
        if mode == "hunt":
            return good_value(p, "hide", remaining)+good_value(p, "game_meat", remaining)-1.8
        if mode == "snare":
            return good_value(p, "fur", remaining)+.5
        if mode == "whale":
            boost = sum(1+s["ore"] for s in p["ships"] if s["kind"] == "whaler")
            return good_value(p, "skin", remaining)+good_value(p, "whale_meat", remaining)+good_value(p, "oil", remaining)-max(0, 3-boost)
        return 5.2 if mode == "raid" else 8.5
    if kind == "explore":
        values = [b["points"]-len(b["negative"])+remaining*3.6+len(b["bonuses"])*1.5
                  for i in view["islands"] if not i["owner"] for b in [BOARDS[i["kind"]]]]
        return max(values or [0])
    if kind == "emigrate":
        return 13-view["round"]+remaining*1.4-(3 if len(p["ships"]) == 1 and remaining > 3 else 0)
    if kind == "convert_whaler":
        return 1.5
    if kind == "draw":
        return e["count"]*(1.7+remaining*.18)
    if kind in ("occupation", "paid_occupation"):
        values = sorted((_occupation_value(p, c, remaining) for c in p.get("hand", [])), reverse=True)
        return sum(values[:e.get("count", 1)])-(.6 if kind == "paid_occupation" else 0)
    if kind == "weapons":
        return e["count"]*.6
    return 0


def _occupation_value(p: Dict, card: str, remaining: int) -> float:
    data = OCCUPATIONS[card_kind(card)]
    value = data["points"]
    if data.get("immediate"):
        value += 3 if data["immediate"] not in ("miner", "houses", "arms", "fisher", "outfitter") else len(p["ships"])*1.7
    if data.get("hook") or data.get("trade") or data.get("trades") or data.get("shop") or data.get("tutor"):
        value += remaining*.7
    if data.get("migration_discount") or data.get("rolls") or data.get("hunt_discount"):
        value += remaining*.6
    return value


def _placement_value(p: Dict, index: int, move: Dict, remaining: int, phase: str, prepared: Dict) -> float:
    board = p["boards"][index]
    data = BOARDS[board["kind"]]
    good = move["good"]
    coords = {(move["x"]+x, move["y"]+y) for x, y in oriented_cells(good, move["rotation"], move["flip"])}
    before_income, before_bonus, occupied, negative, symbol_neighbors = prepared[index]
    new_income = board_income(board, coords)-before_income
    payments_left = remaining + int(phase in ("action", "prepare"))
    score = len(coords & negative) + new_income*payments_left*1.7
    after_bonus = board_bonuses(board, coords)
    bonus_rounds = max(0, remaining)
    for g in before_bonus.keys() | after_bonus.keys():
        score += (after_bonus.get(g, 0)-before_bonus.get(g, 0))*good_value(p, g, remaining)*bonus_rounds*.7
    # Reward progress toward surrounding a symbol even before it is completed.
    for pos, neighbors, value in symbol_neighbors:
        if pos in occupied:
            continue
        if pos in coords:
            score -= value*bonus_rounds*.17
        elif neighbors:
            before = len(neighbors & occupied)/len(neighbors)
            after = len(neighbors & (occupied | coords))/len(neighbors)
            score += (after**3-before**3)*value*bonus_rounds*.55
    # Lower-left progress helps the next tile complete an income square.
    for track in data["tracks"]:
        for step in track["steps"]:
            if (step["x"], step["y"]) not in occupied:
                ox, oy = step["origin"]
                in_square = sum(ox <= x <= step["x"] and step["y"] <= y <= oy for x, y in coords)
                score += in_square*.25*min(4, payments_left)
                break
    if good == "silver":
        score -= 1.05
        if _food_capacity(p) <= p.get("feast_length", 8) and phase not in ("final_placement",):
            score -= 2
    elif good in ("ore", "wood"):
        score -= .8 if not remaining else 1.6
    elif GOODS[good]["color"] in ("red", "orange"):
        score -= good_value(p, good, remaining)*(.9 if phase in ("action", "prepare", "feast") else .1)
    else:
        score -= .5 if not remaining else 1
    # Avoid spending a whole tile simply to cover a bonus already worth points.
    score -= len(coords)*.015
    return score


def best_placement(view: Dict, p: Dict) -> Optional[Dict]:
    if not view["can_place"]:
        return None
    remaining = view["rounds"]-view["round"]
    prepared = {}
    for index, b in enumerate(p["boards"]):
        data = BOARDS[b["kind"]]
        layout = {tuple(c) for c in data["cells"]}
        occupied = set(occupied_cells(b))
        symbols = {(s["x"], s["y"]) for s in data["bonuses"]}
        neighbors = []
        for s in data["bonuses"]:
            pos = (s["x"], s["y"])
            surrounding = {(pos[0]+dx, pos[1]+dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy} & layout
            value = sum(good_value(p, g, remaining)*n for g, n in s["goods"].items())
            neighbors.append((pos, surrounding-symbols, value))
        prepared[index] = (board_income(b), board_bonuses(b), occupied, {tuple(c) for c in data["negative"]}, neighbors)
    best, best_value = None, .2
    for good, count in p["stock"].items():
        if not count:
            continue
        for index, b in enumerate(p["boards"]):
            kind = BOARDS[b["kind"]]["kind"]
            color = GOODS[good]["color"]
            if kind == "shed" or (kind in ("home", "island") and color not in ("green", "blue", "ore", "silver")):
                continue
            for move in placements_for(p, good, index):
                value = _placement_value(p, index, move, remaining, view["phase"], prepared)
                if value > best_value:
                    best, best_value = move, value
    return best


def _move_value(view: Dict, p: Dict, move: Dict, remaining: int) -> float:
    t = move["type"]
    e = view["pending"][0] if view["pending"] else {}
    if t == "occupy":
        a = ACTIONS[move.get("copy", move["space"])]
        v = sum(max(0, _effect_value(view, p, ef, remaining)) for ef in a["effects"])
        if a["workers"] == 3:
            v += 1.5+remaining*.1
        if a["workers"] == 4 and p.get("hand"):
            v += max(_occupation_value(p, c, remaining) for c in p["hand"])
        return v/(a["workers"]**.85)
    if t in ("accept", "choose"):
        if t == "choose" and "index" in move:
            return _effect_value(view, p, e["options"][move["index"]], remaining)+1
        return 5
    if t == "upgrade":
        g, result = move["good"], move["good"]
        for _ in range(e["steps"]):
            result = GOODS[result].get("upgrade") or result
        return good_value(p, result, remaining)-good_value(p, g, remaining)+2
    if t == "take_mountain":
        m = next(x for x in view["mountains"] if x["id"] == move["index"])
        return sum(2 if g == "silver2" else good_value(p, g, remaining) for g in m["items"][:move["count"]])
    if t == "take_good":
        return good_value(p, move["good"], remaining)-(GOODS[move["good"]].get("price", 0) or 0 if e["kind"] == "special_sale" else 0)
    if t == "explore":
        island = view["islands"][move["index"]]
        data = BOARDS[island["kind"]]
        return data["points"]-len(data["negative"])+remaining*(len(data["bonuses"])+2)+island["silver"]
    if t in ("play_occupation", "tutor"):
        return _occupation_value(p, move["card"], remaining)-int(t == "tutor")
    if t == "timing":
        return 3 if move["option"] == "before" else 2 if move["option"] == "after" else 0
    if t == "pay_occupation":
        return 5-good_value(p, move["good"], remaining)
    if t in ("emigrate", "convert_whaler"):
        return 5 if p["ships"][move["index"]]["kind"] == "knarr" else 4
    if t == "succeed":
        cost = sum(n*(.65 if g in ("bow", "snare", "spear", "sword") else good_value(p, g, remaining)) for g, n in move["payment"].items())
        reward = good_value(p, move["good"], remaining) if "good" in move else {"hunt": 6, "snare": 7.5, "whale": 12}[e["mode"]]
        return reward-cost
    if t == "reroll":
        return {"hunt": 3.3, "snare": 4.4, "whale": 7, "raid": 4.5, "pillage": 6.5}[e["mode"]]
    if t == "fail":
        return 2.8
    if t == "skip":
        return -.2
    if t == "profession_trade":
        data = OCCUPATIONS[card_kind(move["card"])]
        trade = (data.get("trades", [])+([data["trade"]] if "trade" in data else []))[move["index"]]
        return _effect_value(view, p, trade, remaining)-.5
    if t == "shop":
        return good_value(p, GOODS[move["good"]]["upgrade"], remaining)-good_value(p, move["good"], remaining)-1.2
    if t == "arm":
        return 2 if remaining > 1 else -.5
    if t == "buy_ship":
        kind = move["ship"]
        owned = sum(s["kind"] == kind for s in p["ships"])
        food_safe = _food_capacity(p)-SHIPS[kind]["cost"] >= p["feast_length"]
        if remaining >= 2 and owned == 0 and food_safe:
            return 1.5 if kind == "knarr" else .6
        return -1
    if t == "store":
        return .5 if view["phase"] == "final_placement" else -.5
    if t in ("end_turn", "ready"):
        return 0
    if t == "pass":
        return -5
    return 0


def choose_move(view: Dict) -> Optional[Dict]:
    """Return one legal action without changing view or observing hidden state."""
    p = next((p for p in view["players"] if p["player_id"] == view["you"]), None)
    if p is None or view["game_over"]:
        return None
    if view["phase"] == "action" and view["current_turn"] != view["you"]:
        return None
    moves = view["moves"]
    if not moves:
        return None
    if view["phase"] == "round_end":
        return copy.deepcopy(moves[0])
    if view["phase"] == "feast":
        no_mead = next((m for m in moves if m["type"] == "no_mead"), None)
        if no_mead and not p["stock"].get("mead", 0):
            return copy.deepcopy(no_mead)
        return copy.deepcopy(next(m for m in moves if m["type"] in ("auto_feast", "finish_feast")))
    remaining = view["rounds"]-view["round"]
    if not view["pending"]:
        placement = best_placement(view, p)
        if placement:
            return {**placement, "revision": view["revision"]}
    ranked = sorted(enumerate(moves), key=lambda pair: (-_move_value(view, p, pair[1], remaining), pair[0]))
    return copy.deepcopy(ranked[0][1])
