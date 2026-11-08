"""Heuristic bot for 12 Rivers (twelve_rivers).

Deliberately shallow: the bot scores each legal placement with a one-ply
estimate of the pearls that will still be there when its marker resolves, then
plays greedily everywhere else. See designs/task187.md section 11.
"""

from typing import Dict, List, Optional

from game.twelve_rivers_data import (
    ALPACA_CARDS,
    ALPACA_SLOTS,
    BANNER,
    EARTH,
    INSTRUMENT,
    FAIRY_SPOTS_FOR_STRETCH,
    FIRE,
    LANTERN,
    LIGHT,
    MARKAYA_BY_ID,
    NET,
    PEARL_COLORS,
    PEARL_POINTS,
    RAINBOW,
    SEA_ID,
    STRETCH_BY_ID,
    SUPPLIES,
    VILLAGE_COSTS,
    VILLAGE_IDS,
    WATER,
    WIND,
)

FAIRY_VALUE = {FIRE: 2.4, EARTH: 2.2, WIND: 3.2, LIGHT: 2.4, WATER: 3.0}
CARD_VALUE = 1.15


def _me(view: Dict) -> Optional[Dict]:
    for player in view["players"]:
        if player["player_id"] == view["you"]:
            return player
    return None


def _upstream_row1(view: Dict, stretch_id: str) -> List[str]:
    """Row-1 stretches whose pearls can reach this stretch."""
    target = STRETCH_BY_ID[stretch_id]
    rivers = set(target["rivers"])
    return [sid for sid, stretch in ((s["id"], s) for s in view["board"]["stretches"])
            if stretch["row"] == 1 and stretch["rivers"][0] in rivers]


def _space_cost(view: Dict, space_id: str) -> int:
    if space_id == SEA_ID:
        return view["board"]["sea_cost"]
    if space_id in VILLAGE_IDS:
        return view["board"]["village"][VILLAGE_IDS.index(space_id)]
    stretch_id = space_id.split("#", 1)[0]
    for stretch in view["board"]["stretches"]:
        if stretch["id"] == stretch_id:
            return stretch["cost"]
    return 0


def _wanted_colors(view: Dict) -> Dict[str, int]:
    """How many pearls of each colour the bot can still usefully deliver."""
    me = _me(view)
    want = {color: 0 for color in PEARL_COLORS}
    if not me:
        return want
    for entry in me["markaya"]:
        for spot in entry["spots"]:
            if spot["pearl"] is not None:
                continue
            if spot["color"] == RAINBOW:
                for color in PEARL_COLORS:
                    want[color] += 1
            else:
                want[spot["color"]] += 1
    return want


def _pearl_value(view: Dict, color: str) -> float:
    want = _wanted_colors(view)
    value = float(PEARL_POINTS[color])
    if want.get(color, 0) > 0:
        value += 2.4
    me = _me(view)
    if me:
        held = me["alpaca"].count(color)
        for card in ALPACA_CARDS:
            if card["id"] in view["alpaca_cards"] and view["alpaca_cards"][card["id"]] is not None:
                continue
            if card["color"] == color and held + 1 >= card["count"]:
                value += 2.0
    return value


def _stretch_pearls(view: Dict, stretch_id: str) -> List[str]:
    """Pearls that can still arrive at a stretch, after strictly upstream markers."""
    pearls: List[str] = []
    for sid in _upstream_row1(view, stretch_id):
        pearls.extend(view["pools"].get(sid, []))
    stretch = STRETCH_BY_ID[stretch_id]
    blockers = 0
    for space_id in view["placements"]:
        if "#" not in space_id:
            continue
        other_id = space_id.split("#", 1)[0]
        other = STRETCH_BY_ID.get(other_id)
        if not other or other["row"] >= stretch["row"]:
            continue
        if set(other["rivers"]) & set(stretch["rivers"]):
            blockers += 1
    return pearls[blockers:] if blockers < len(pearls) else []


def _same_stretch_earlier(view: Dict, space_id: str) -> int:
    if "#" not in space_id:
        return 0
    stretch_id, _, slot = space_id.partition("#")
    slot_index = int(slot)
    count = 0
    for other_id in view["placements"]:
        if "#" not in other_id:
            continue
        other_stretch, _, other_slot = other_id.partition("#")
        if other_stretch == stretch_id and int(other_slot) < slot_index:
            count += 1
    return count


def _pay_for(view: Dict, cost: int) -> Optional[Dict[str, int]]:
    me = _me(view)
    if not me:
        return None
    hand = me["hand"] or {}
    if cost <= 0:
        return {}
    if sum(hand.values()) < cost:
        return None
    order = sorted(
        (kind for kind, count in hand.items() if count > 0),
        key=lambda kind: (0 if hand[kind] % 2 == 1 else 1, -hand[kind], kind),
    )
    pay: Dict[str, int] = {}
    left = cost
    for kind in order:
        take = min(hand[kind], left)
        if take:
            pay[kind] = take
            left -= take
        if left == 0:
            break
    return pay if left == 0 else None


def _markaya_score(view: Dict, tile_id: str) -> float:
    me = _me(view)
    tile = MARKAYA_BY_ID[tile_id]
    score = 1.6 * tile["cards"]
    alpaca = me["alpaca"] if me else []
    want = _wanted_colors(view)
    for color in tile["spots"]:
        if color == RAINBOW:
            score += 1.1
        elif alpaca.count(color):
            score += 2.2
        elif want.get(color, 0):
            score += 0.5
    objective = tile["objective"]
    if objective in ("self_full", "self_four_same", "self_five_diff"):
        score += 1.4
    if objective in ("color_most", "fairy_most", "card_most"):
        score += 1.0
    return score


def _choose_placement(view: Dict) -> Optional[Dict]:
    me = _me(view)
    if not me:
        return None
    hand_size = sum((me["hand"] or {}).values())
    scarcity = 1.0 if hand_size >= 5 else 1.9
    best = None
    best_score = float("-inf")
    for space_id in view["board"]["spaces"]:
        if space_id in view["placements"]:
            continue
        cost = _space_cost(view, space_id)
        if cost > 0 and sum((me["hand"] or {}).values()) + me["fairies"].get(FIRE, 0) < cost:
            continue
        score = 0.0
        if space_id == SEA_ID:
            loose = max(0, view["active_rivers"] - sum(
                1 for other in view["placements"] if "#" in other))
            score = loose * 1.5
        elif space_id in VILLAGE_IDS:
            display = view["markaya_display"]
            if not display:
                continue
            score = max(_markaya_score(view, tile_id) for tile_id in display)
            score += 1.2 * (VILLAGE_IDS.index(space_id) < 2)
        else:
            stretch_id, _, slot = space_id.partition("#")
            pearls = _stretch_pearls(view, stretch_id)
            earlier = _same_stretch_earlier(view, space_id)
            pearls = pearls[earlier:]
            if pearls:
                best_pearl = max(_pearl_value(view, color) for color in pearls)
                score = best_pearl + 0.35 * (len(pearls) - 1)
            else:
                score = 0.2
            fairies = []
            for spot_id in FAIRY_SPOTS_FOR_STRETCH.get(stretch_id, []):
                fairies.extend(view["fairy_spots"].get(spot_id, []))
            score += sum(FAIRY_VALUE.get(kind, 2.0) for kind in fairies)
        if cost > 0:
            score -= cost * CARD_VALUE * scarcity
        elif cost < 0:
            score += 1.4
        if score > best_score:
            best_score = score
            best = space_id
    if best is None:
        return None

    action: Dict = {"type": "place_marker", "space": best}
    cost = _space_cost(view, best)
    fairies = me["fairies"] or {}
    if cost > 0:
        pay = _pay_for(view, cost)
        if pay is None and fairies.get(FIRE, 0) > 0:
            fire = min(fairies.get(FIRE, 0), cost)
            pay = _pay_for(view, cost - fire)
            if pay is None:
                return None
            action["fire"] = fire
        elif pay is None:
            return None
        action["pay"] = pay
    pairs = _choose_pairs(view, best)
    if pairs:
        action["pairs"] = pairs
    return action


def _choose_pairs(view: Dict, chosen_space: str) -> List[Dict]:
    me = _me(view)
    if not me:
        return []
    hand = me["hand"] or {}
    pairs: List[Dict] = []
    taken_stretch = chosen_space.split("#", 1)[0] if "#" in chosen_space else None
    if hand.get(LANTERN, 0) >= 2:
        best_spot, best_value = None, 0.0
        for spot_id, stack in view["fairy_spots"].items():
            if not stack:
                continue
            if taken_stretch and spot_id in FAIRY_SPOTS_FOR_STRETCH.get(taken_stretch, []):
                # Placing here already sweeps these fairies up.
                continue
            value = sum(FAIRY_VALUE.get(kind, 2.0) for kind in stack)
            if value > best_value:
                best_spot, best_value = spot_id, value
        if best_spot is not None and best_value >= 3.0:
            pairs.append({"kind": LANTERN, "spot": best_spot})
    return pairs


def _best_pearls(view: Dict, pool: List[str], limit: int, free: int) -> tuple:
    ranked = sorted(pool, key=lambda color: (-_pearl_value(view, color), color))
    take = ranked[:limit]
    me = _me(view)
    alpaca = list(me["alpaca"]) if me else []
    needed = max(0, len(take) - free)
    swap: List[str] = []
    if needed:
        keep = set()
        order = sorted(range(len(alpaca)), key=lambda i: _pearl_value(view, alpaca[i]))
        swap = [alpaca[i] for i in order[:needed]]
    return take, swap


def _take_pearl(view: Dict) -> Dict:
    space = None
    for stretch_id in view["board"]["order"]:
        for slot in range(1, STRETCH_BY_ID[stretch_id]["slots"] + 1):
            candidate = f"{stretch_id}#{slot}"
            if view["placements"].get(candidate, {}).get("pid") == view["you"]:
                space = candidate
                break
        if space:
            break
    pool: List[str] = []
    if space:
        pool = list(view["pools"].get(space.split("#", 1)[0], []))
    me = _me(view)
    hand = me["hand"] or {}
    fairies = me["fairies"] or {}
    limit = 1
    action: Dict = {"type": "take_pearl"}
    if hand.get(NET, 0) >= 2 and len(pool) >= 2:
        limit += 1
        action["net"] = True
    if fairies.get(WATER, 0) >= 1 and len(pool) >= 2:
        limit += 1
        action["water"] = True
    limit = min(limit, len(pool))
    free = ALPACA_SLOTS - len(me["alpaca"])
    take, swap = _best_pearls(view, pool, limit, free)
    action["take"] = take
    action["swap_out"] = swap
    return action


def _take_sea(view: Dict) -> Dict:
    me = _me(view)
    pool = list(view["sea"])
    free = ALPACA_SLOTS - len(me["alpaca"])
    limit = min(len(pool), free + len(me["alpaca"]))
    ranked = sorted(pool, key=lambda color: (-_pearl_value(view, color), color))
    take = ranked[:max(0, min(limit, free))]
    if not take and pool:
        take = ranked[:1]
    needed = max(0, len(take) - free)
    swap: List[str] = []
    if needed:
        order = sorted(range(len(me["alpaca"])), key=lambda i: _pearl_value(view, me["alpaca"][i]))
        swap = [me["alpaca"][i] for i in order[:needed]]
    return {"type": "take_sea_pearls", "take": take, "swap_out": swap}


def _befriend(view: Dict) -> Dict:
    display = view["markaya_display"]
    best_index, best_score = 0, float("-inf")
    for index, tile_id in enumerate(display):
        score = _markaya_score(view, tile_id)
        if score > best_score:
            best_index, best_score = index, score
    action = {"type": "befriend", "index": best_index}
    me = _me(view)
    hand = me["hand"] or {}
    occupied = [vid for vid in VILLAGE_IDS if vid in view["placements"]]
    room_right = False
    if occupied:
        leftmost = VILLAGE_IDS.index(occupied[0])
        room_right = any(vid not in view["placements"] for vid in VILLAGE_IDS[leftmost + 1:])
    if hand.get(INSTRUMENT, 0) >= 2 and room_right and len(display) > 1:
        action["instrument"] = True
    return action


def _deliver(view: Dict) -> Dict:
    me = _me(view)
    alpaca = list(me["alpaca"])
    moves = []
    used = set()
    for tile_index, entry in enumerate(me["markaya"]):
        for spot_index, spot in enumerate(entry["spots"]):
            if spot["pearl"] is not None:
                continue
            match = None
            for pearl_index, color in enumerate(alpaca):
                if pearl_index in used:
                    continue
                if spot["color"] in (RAINBOW, color):
                    match = pearl_index
                    break
            if match is not None:
                used.add(match)
                moves.append({"tile": tile_index, "spot": spot_index, "pearl": match})
    # Alpaca indices shift as pearls are removed: rebuild against the live list.
    ordered = sorted(moves, key=lambda m: -m["pearl"])
    final = []
    for move in ordered:
        final.append({"tile": move["tile"], "spot": move["spot"], "pearl": move["pearl"]})
    final.sort(key=lambda m: -m["pearl"])
    return {"type": "deliver", "moves": final}


def choose_bot_action(view: Dict) -> Optional[Dict]:
    actions = view.get("legal_actions") or []
    if not actions:
        return None
    phase = view["phase"]
    if phase == "exploration":
        if "place_marker" in actions:
            action = _choose_placement(view)
            if action:
                return action
        return None
    if phase == "collection":
        stage = view["stage"]
        if stage == "deliver":
            return _deliver(view)
        if stage == "river":
            return _take_pearl(view)
        if stage == "sea":
            return _take_sea(view)
        if stage == "village":
            return _befriend(view)
        return None
    if phase == "round_end":
        return {"type": "next_round"}
    return None
