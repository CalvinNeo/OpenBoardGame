"""Authoritative Orloj digital adaptation, including queued choices and scoring."""
import copy
import json
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.orloj_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, APOSTLES, APOSTLE_SLOTS, ASSISTANTS, BASIC,
    CALENDAR, HAMMER_CELLS, HAMMERS, INNER, METRICS, METRIC_NAMES, MOON, OBJECTIVES,
    OUTER, PRESETS, PRIMARY_MULTIPLIER, RESOURCES, ROOSTER_ROUNDS, SCROLLS, TRACKS,
    WORKSHOPS, ZODIAC, effect, gain,
)


def mastery_level(position: int) -> int:
    return min(4, (position - 1) // 3 + 1) if position else 1


def sculptor_level(position: int) -> int:
    return 3 if position >= 10 else 2 if position >= 5 else 1


def payment_options(resources: Dict, cost: Dict) -> List[Dict]:
    """Enumerate distinct payments, including optional coin/gold substitutions."""
    remaining = dict(resources)
    fixed = {}
    for key in ("gold", "coin"):
        amount = cost.get(key, 0)
        if remaining[key] < amount:
            return []
        remaining[key] -= amount
        if amount:
            fixed[key] = amount
    found = {}

    def visit(index, stock, paid):
        if index == len(BASIC):
            clean = {key: paid[key] for key in RESOURCES if paid.get(key)}
            found[json.dumps(clean, sort_keys=True)] = clean
            return
        key = BASIC[index]
        amount = cost.get(key, 0)
        for native in range(min(amount, stock[key]), -1, -1):
            for coins in range(min(amount - native, stock["coin"]) + 1):
                gold = amount - native - coins
                if gold > stock["gold"]:
                    continue
                next_stock, next_paid = dict(stock), dict(paid)
                for resource, n in ((key, native), ("coin", coins), ("gold", gold)):
                    next_stock[resource] -= n
                    next_paid[resource] = next_paid.get(resource, 0) + n
                visit(index + 1, next_stock, next_paid)

    visit(0, remaining, fixed)
    return list(found.values())


def construction_cost(zone: str, slot: int) -> Dict:
    if zone == "final":
        return {"gold": 1, "paint": 1, "wood": 1, "iron": 1}
    # Explicit digital component table, see 125.md; base gold + zone material + dial.
    material = ("wood", "paint", "iron", "paint", "wood", "iron",
                "paint", "iron", "wood", "iron", "wood", "paint")[slot]
    cost = {"gold": 1, "wood" if zone == "months" else "paint": 1}
    cost[material] = cost.get(material, 0) + 1
    return cost


def group_size(board: Dict, zone: str, slot: int, pid: str) -> int:
    """Connected component of the two twelve-cell rings, with radial edges."""
    visited, todo = set(), [(zone, slot)]
    while todo:
        current, index = todo.pop()
        if (current, index) in visited or board[current][index]["owner"] != pid:
            continue
        visited.add((current, index))
        other = "zodiac" if current == "months" else "months"
        todo.extend(((current, (index - 1) % 12), (current, (index + 1) % 12), (other, index)))
    return len(visited)


def metrics(state: Dict, pid: str) -> Dict:
    p = state["players"][pid]
    return {"scrolls": len(p["scrolls"]) + len(p["royals"]),
            "apostles": sum(n is not None for n in p["panel"]),
            "upgrades": sum(p["production"].values()) + p["hammer_level"],
            "months": sum(cell["owner"] == pid for cell in state["board"]["months"]),
            "zodiac": sum(cell["owner"] == pid for cell in state["board"]["zodiac"]),
            "workshops": len(p["workshops"])}


def objective_met(state: Dict, pid: str, objective: str) -> bool:
    p, counts = state["players"][pid], metrics(state, pid)
    if objective in ("purple", "orange", "green"):
        return sum(n is not None and APOSTLES[str(n)]["color"] == objective for n in p["panel"]) >= 3
    if objective == "assistants":
        return sum(w["assistant"] is not None for w in p["workshops"]) >= 2
    if objective == "mastery":
        return max(p["mastery"].values()) >= 7
    if objective in ("months", "zodiac"):
        other = "months" if objective == "zodiac" else "zodiac"
        return counts[objective] >= 2 and counts[other] >= 1
    return counts[objective] >= (5 if objective == "upgrades" else 3)


def surplus_gold(resources: Dict) -> int:
    """Optimal conversion of three equal basics, with coins as wild resources."""
    best = 0
    for paint_coins in range(resources["coin"] + 1):
        for wood_coins in range(resources["coin"] - paint_coins + 1):
            iron_coins = resources["coin"] - paint_coins - wood_coins
            best = max(best, (resources["paint"] + paint_coins) // 3
                       + (resources["wood"] + wood_coins) // 3
                       + (resources["iron"] + iron_coins) // 3)
    return resources["gold"] + best


def score_breakdown(state: Dict, pid: str) -> Dict:
    p, count = state["players"][pid], metrics(state, pid)
    windows = {}
    for track, metric in state["windows"].items():
        height = p["mastery"][track]
        highest = max(other["mastery"][track] for other in state["players"].values())
        rate = PRIMARY_MULTIPLIER[metric] if height == highest else 1
        windows[track] = min(15, rate * count[metric]) if height >= 7 else 0
    columns = sum(all(p["panel"][row * 4 + col] is not None for row in range(3)) for col in range(4))
    assistant_values = {"scholar": 6, "engineer": count["upgrades"],
                        "master": 4 * sum(pos >= 10 for pos in p["mastery"].values()),
                        "carver": 5 * columns, "calendar": 3 * count["months"],
                        "astronomer": 3 * count["zodiac"]}
    assistants = {w["assistant"]: assistant_values[w["assistant"]]
                  for w in p["workshops"] if w["assistant"]}
    objectives = sum(claim["points"] for claims in state["claims"].values()
                     for claim in claims if claim["player_id"] == pid)
    gold = surplus_gold(p["resources"])
    total = p["score"] + sum(windows.values()) + gold - p["deviation"] + sum(assistants.values()) + objectives
    return {"immediate": p["score"], "windows": windows, "gold": gold,
            "deviation": -p["deviation"], "assistants": assistants, "objectives": objectives,
            "total": total, "apostles": count["apostles"]}


def _log(state: Dict, pid: Optional[str], message: str) -> None:
    name = state["player_meta"][pid]["name"] + " · " if pid else ""
    state["log"] = (state["log"] + [{"round": state["round"], "text": name + message}])[-80:]


def _queue(state: Dict, effects: List[Dict]) -> None:
    state["pending"] = copy.deepcopy(list(effects)) + state["pending"]


def _pay(player: Dict, payment: Dict) -> None:
    for key, amount in payment.items():
        player["resources"][key] -= amount


def _rooster_step(state: Dict) -> None:
    if state["call_pending"] or state["calls"] >= 4:
        return
    state["rooster"] = max(0, state["rooster"] - 1)
    if state["rooster"] == 0:
        state["call_pending"] = True


def _rotate_gears(state: Dict, steps: int) -> None:
    for _ in range(steps):
        state["gears"] = (state["gears"] + 1) % 6
        if state["gears"] % 2 == 0:
            _rooster_step(state)


def available_apostles(gear: int) -> Tuple[int, int]:
    # Left gear clockwise, right gear counterclockwise.
    return ((1, 11, 9, 7, 5, 3)[gear], (2, 12, 10, 8, 6, 4)[gear])


def _advance_mastery(state: Dict, pid: str, track: str) -> None:
    p = state["players"][pid]
    if p["mastery"][track] == 12:
        p["score"] += 1
        return
    p["mastery"][track] += 1
    height = p["mastery"][track]
    if height in (4, 9):
        _queue(state, [effect("scroll")])
    elif height == 6:
        _queue(state, [effect("assistant_moon")])
    elif height == 12 and state["royals"][track] is not None:
        metric = state["royals"][track]
        p["royals"].append(metric)
        value = min(10, PRIMARY_MULTIPLIER[metric] * metrics(state, pid)[metric])
        p["score"] += value
        state["royals"][track] = None
        _log(state, pid, f"皇家卷轴 · {METRIC_NAMES[metric]} +{value}⭐")


def _upgrade(player: Dict, track: str) -> None:
    if track == "hammer":
        player["hammer_level"] += 1
        return
    if player["production"][track] == 3:
        player["resources"]["gold"] += 1
        player["score"] += 1
        return
    player["production"][track] += 1
    minimum = min(player["production"].values())
    player["workers"] += minimum - player["production_workers"]
    player["production_workers"] = minimum


def _moon(state: Dict, pid: str, modifier: int = 0) -> None:
    p = state["players"][pid]
    steps = max(0, mastery_level(p["mastery"]["yellow"]) + 2 + modifier)
    for _ in range(steps):
        state["moon"] = (state["moon"] + 1) % 12
        reward = MOON[state["moon"]]
        if reward == "repair":
            p["deviation"] = max(0, p["deviation"] - 1)
        else:
            p["resources"][reward] += 1


def _produce(state: Dict, pid: str, resource: str) -> None:
    p = state["players"][pid]
    level = p["production"][resource]
    p["resources"][resource] += 1 if level == 0 else 2
    if level == 2:
        _queue(state, [effect("any_resource")])
    if level == 3:
        p["resources"]["gold"] += 1


def _hammer_rewards(player: Dict) -> List[Dict]:
    level, hammer = player["hammer_level"], player["hammer"]
    if level == 0:
        return []
    if hammer == "coin":
        return [gain(coin=1), effect("vp", count=2 * (level == 2))]
    if hammer == "rooster":
        return [effect("rooster"), effect("vp", count=2 * (level == 2))]
    if hammer == "moon":
        return [effect("repair")] if level == 1 else [effect("moon", modifier=-1)]
    if hammer == "mastery":
        return [effect("mastery")] + ([gain(coin=1)] if level == 2 else [])
    if hammer == "apostle":
        return [effect("apostle")] + ([effect("repair")] if level == 2 else [])
    return [effect("forced_painter")] if level == 1 else [effect("painter")]


def _settle(state: Dict) -> None:
    """Resolve deterministic rewards; suspend at every player-owned choice."""
    pid = state["current_turn"]
    p = state["players"][pid]
    while state["pending"]:
        item = state["pending"][0]
        kind, count = item["kind"], item.get("count", 1)
        if kind == "bundle" and len(item["effects"]) == 1:
            state["pending"].pop(0)
            _queue(state, item["effects"])
            continue
        immediate = kind in ("gain", "vp", "repair", "rooster", "rooster_step", "moon")
        immediate |= kind == "mastery" and "track" in item
        immediate |= kind == "produce" and "resource" in item
        if not immediate:
            break
        # Even beneficial actions may be declined: moving a shared moon or
        # reaching a royal scroll early can change a player's plan.
        if kind not in ("vp", "rooster_step") and not item.get("accepted"):
            break
        state["pending"].pop(0)
        if kind == "gain":
            for key, amount in item["items"].items():
                p["resources"][key] += amount
        elif kind == "vp":
            p["score"] += count
        elif kind == "repair":
            p["deviation"] = max(0, p["deviation"] - count)
        elif kind == "rooster":
            for _ in range(count):
                if p["rooster"] == 4:
                    p["resources"]["gold"] += 1
                    p["score"] += 1
                else:
                    p["rooster"] += 1
        elif kind == "rooster_step":
            _rooster_step(state)
        elif kind == "moon":
            _moon(state, pid, item.get("modifier", 0))
        elif kind == "produce":
            _produce(state, pid, item["resource"])
        elif kind == "mastery":
            if count > 1:
                _queue(state, [effect("mastery", track=item["track"], count=count - 1, accepted=True)])
            _advance_mastery(state, pid, item["track"])
    if state["phase"] == "setup" and not state["pending"]:
        state["setup_index"] += 1
        if state["setup_index"] < len(state["order"]):
            pid = state["order"][state["setup_index"]]
            state["current_turn"] = pid
            state["pending"] = [effect("upgrade", mandatory=True)] * state["players"][pid]["initial_upgrades"]
            _settle(state)
        else:
            state["phase"] = "turn"
            state["current_turn"] = state["order"][0]
            _log(state, None, "工坊开工 · 每回合选择 Clock 或 Pass")


def _recover_moves(state: Dict, pid: str) -> List[Dict]:
    moves = [{"type": "recover", "zone": "clock", "slot": i}
             for i, owner in enumerate(state["clock_workers"]) if owner == pid]
    moves.extend({"type": "recover", "zone": zone, "slot": i}
                 for zone in ("months", "zodiac") for i, cell in enumerate(state["board"][zone])
                 if cell["owner"] == pid)
    return moves


def _pending_moves(state: Dict, pid: str) -> List[Dict]:
    p = state["players"][pid]
    item = state["pending"][0]
    kind = item["kind"]
    moves = [] if item.get("mandatory") else [{"type": "skip"}]
    if kind in ("gain", "repair", "rooster", "moon") or (kind in ("mastery", "produce") and ("track" in item or "resource" in item)):
        return moves + [{"type": "accept"}]
    if kind == "bundle":
        return moves + [{"type": "resolve", "index": i} for i in range(len(item["effects"]))]
    if kind == "upgrade":
        moves += [{"type": "upgrade", "track": key} for key in BASIC]
        if p["hammer_level"] < 2:
            moves.append({"type": "upgrade", "track": "hammer"})
    elif kind in ("mastery", "paid_mastery"):
        if kind != "paid_mastery" or p["resources"]["coin"]:
            moves += [{"type": "mastery", "track": track} for track in TRACKS]
    elif kind in ("any_resource", "produce"):
        moves += [{"type": kind, "resource": key} for key in BASIC]
    elif kind in ("moon_painter", "assistant_moon"):
        choices = ("moon", "painter") if kind == "moon_painter" else ("assistant", "moon")
        moves += [{"type": "choose", "option": option} for option in choices]
    elif kind == "forced_painter":
        if p["deviation"] < 5:
            moves.append({"type": "choose", "option": "painter"})
    elif kind == "painter":
        moves += [{"type": "painter", "steps": n, "side": side}
                  for n in range(1, mastery_level(p["mastery"]["yellow"]) + 3) for side in ("left", "right")]
    elif kind == "recover":
        moves += _recover_moves(state, pid)
    elif kind == "scroll":
        moves += [{"type": "take_scroll", "index": i} for i in range(len(state["scroll_market"]))]
    elif kind == "assistant":
        owned = [w["assistant"] for w in p["workshops"]] + [p["assistant"]]
        if p["assistant"] is None and len(p["warehouse"]) < 2:
            moves += [{"type": "take_assistant", "assistant": key} for key, n in state["assistants"].items()
                      if n > 0 and key not in owned]
    elif kind == "apostle":
        if len(p["warehouse"]) + int(p["assistant"] is not None) < 2:
            used = p["warehouse"] + p["panel"]
            for steps in range(6 - p["deviation"]):
                moves += [{"type": "take_apostle", "steps": steps, "apostle": number}
                          for number in available_apostles((state["gears"] + steps) % 6) if number not in used]
    elif kind == "workshop":
        for i, key in enumerate(state["market"]):
            if key is None:
                continue
            card = WORKSHOPS[key]
            cost = {"paint": 1}
            cost[card["resource"]] = cost.get(card["resource"], 0) + 3 - i
            for payment in payment_options(p["resources"], cost):
                for side in (("right", "left") if p["workshops"] else ("right",)):
                    moves.append({"type": "workshop", "index": i, "side": side, "payment": payment})
    elif kind == "build":
        if all(cell["built"] for cells in state["board"].values() for cell in cells):
            moves += [{"type": "build", "zone": "final", "slot": 0, "steps": 0, "payment": payment}
                      for payment in payment_options(p["resources"], construction_cost("final", 0))]
        elif p["workers"]:
            capacity = HAMMERS[p["hammer"]]["moves"][p["hammer_level"]]
            for zone in ("months", "zodiac"):
                for steps in range(min(5, capacity + 5 - p["deviation"]) + 1):
                    position = (state["hammers"][zone] + steps) % 6
                    for slot in HAMMER_CELLS[position]:
                        if state["board"][zone][slot]["built"]:
                            continue
                        for payment in payment_options(p["resources"], construction_cost(zone, slot)):
                            moves.append({"type": "build", "zone": zone, "slot": slot, "steps": steps, "payment": payment})
    elif kind == "sculptor":
        level = sculptor_level(p["mastery"]["pink"])
        for index in range(4):
            if state["sculptors"][index] == pid:
                continue
            variants = ("moon", "painter") if index == 3 else ("action",)
            for option in variants:
                deviation = 0 if level == 3 or option == "moon" else 2 if index == 1 and level == 1 else 1
                if p["deviation"] + deviation <= 5:
                    moves.append({"type": "sculptor", "index": index, "option": option})
    return moves


def _extra_moves(state: Dict, pid: str) -> List[Dict]:
    p = state["players"][pid]
    moves = []
    for number in p["warehouse"]:
        for i, slot in enumerate(APOSTLE_SLOTS):
            if p["panel"][i] is None and slot["color"] == APOSTLES[str(number)]["color"]:
                moves += [{"type": "place_apostle", "apostle": number, "slot": i, "payment": pay}
                          for pay in payment_options(p["resources"], {slot["cost"]: 1})]
    for i, scroll in enumerate(p["scrolls"]):
        if not scroll["used"]:
            moves.append({"type": "use_scroll", "index": i})
    if p["assistant"]:
        for i, workshop in enumerate(p["workshops"]):
            if workshop["assistant"] is None:
                resource = WORKSHOPS[workshop["card"]]["resource"]
                moves += [{"type": "place_assistant", "index": i, "payment": pay}
                          for pay in payment_options(p["resources"], {resource: 1})]
    for oid in state["objectives"]:
        claims = state["claims"][oid]
        capacity = min(3, len(state["order"]))
        if p["workers"] and len(claims) < capacity and not any(c["player_id"] == pid for c in claims) and objective_met(state, pid, oid):
            moves.append({"type": "claim", "objective": oid})
    for key in BASIC:
        for native in range(min(3, p["resources"][key]), -1, -1):
            coins = 3 - native
            if p["resources"]["coin"] >= coins:
                pay = {k: n for k, n in ((key, native), ("coin", coins)) if n}
                moves.append({"type": "exchange", "resource": key, "payment": pay})
    return moves


def legal_moves(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["players"] or state["game_over"]:
        return []
    if state["phase"] == "round_end":
        return [] if pid in state["next_ready"] else [{"type": "next_round"}]
    if pid != state["current_turn"]:
        return []
    if state["phase"] == "setup":
        return _pending_moves(state, pid) if state["pending"] else []
    moves = _extra_moves(state, pid)
    if state["pending"]:
        return _pending_moves(state, pid) + moves
    if state["main_done"]:
        return [{"type": "end_turn"}] + moves
    moves.append({"type": "pass"})
    p = state["players"][pid]
    if p["workers"]:
        capacity = mastery_level(p["mastery"]["blue"])
        for steps in range(1, min(11, capacity + 5 - p["deviation"]) + 1):
            for rotate in range(6 - p["deviation"] - max(0, steps - capacity)):
                for first in ("outer", "inner"):
                    moves.append({"type": "clock", "steps": steps, "rotate": rotate, "first": first})
    return moves


def _construct(state: Dict, pid: str, move: Dict) -> None:
    p = state["players"][pid]
    zone, slot = move["zone"], move["slot"]
    _pay(p, move["payment"])
    if zone == "final":
        p["score"] += 8
        _queue(state, _hammer_rewards(p))
        _log(state, pid, "完成中心装饰 +8⭐")
        return
    capacity = HAMMERS[p["hammer"]]["moves"][p["hammer_level"]]
    p["deviation"] += max(0, move["steps"] - capacity)
    state["hammers"][zone] = (state["hammers"][zone] + move["steps"]) % 6
    state["board"][zone][slot].update(built=True, owner=pid)
    p["workers"] -= 1
    points = 2 * (sum(move["payment"].values()) + group_size(state["board"], zone, slot, pid))
    p["score"] += points
    _log(state, pid, f"建造 {'月份' if zone == 'months' else '星座'} {slot + 1} · +{points}⭐")
    _queue(state, list(state["calendar"][slot]) + _hammer_rewards(p))
    if all(cell["built"] for cells in state["board"].values() for cell in cells):
        state["finishing"] = "calendar"


def _place_apostle(state: Dict, pid: str, move: Dict) -> None:
    p, slot = state["players"][pid], move["slot"]
    _pay(p, move["payment"])
    p["warehouse"].remove(move["apostle"])
    p["panel"][slot] = move["apostle"]
    reward = APOSTLE_SLOTS[slot]["reward"]
    effects = []
    if reward == "worker":
        p["workers"] += 1
    elif reward == "coin":
        effects.append(gain(coin=1))
    else:
        effects.append(effect(reward, **({"count": 2} if reward == "recover" else {})))
    row, col = divmod(slot, 4)
    if all(p["panel"][row * 4 + i] is not None for i in range(4)):
        p["score"] += 7
        effects.append(effect("produce"))
    if all(p["panel"][i * 4 + col] is not None for i in range(3)):
        effects.append(effect("assistant_moon"))
    _queue(state, effects)
    _log(state, pid, f"放置使徒 {move['apostle']} · 第 {row + 1} 行")


def _workshop(state: Dict, pid: str, move: Dict) -> None:
    p, index = state["players"][pid], move["index"]
    key = state["market"].pop(index)
    card = WORKSHOPS[key]
    _pay(p, move["payment"])
    if index not in p["market_workers"]:
        p["market_workers"].append(index)
        p["workers"] += 1
    rewards = list(card["reward"])
    if p["workshops"]:
        neighbor = WORKSHOPS[p["workshops"][0 if move["side"] == "left" else -1]["card"]]
        seam = card["right"] if move["side"] == "left" else card["left"]
        other = neighbor["left"] if move["side"] == "left" else neighbor["right"]
        if seam == other:
            rewards.append(effect(seam))
    if move["side"] == "left":
        p["workshops"].insert(0, {"card": key, "assistant": None})
    else:
        p["workshops"].append({"card": key, "assistant": None})
    state["market"].insert(0, state["workshop_deck"].pop() if state["workshop_deck"] else None)
    _queue(state, rewards)
    _log(state, pid, f"扩建 {card['name']}")


def _sculpt(state: Dict, pid: str, move: Dict) -> None:
    p, index, option = state["players"][pid], move["index"], move["option"]
    level = sculptor_level(p["mastery"]["pink"])
    state["sculptors"] = [None if owner == pid else owner for owner in state["sculptors"]]
    state["sculptors"][index] = pid
    if option == "moon":
        _queue(state, ([gain(coin=1)] if level >= 2 else []) + [effect("moon", modifier=level - 1)])
        return
    if level == 3:
        p["deviation"] = max(0, p["deviation"] - 1)
    else:
        p["deviation"] += 2 if index == 1 and level == 1 else 1
    rewards = []
    if index in (0, 1):
        if level == 2:
            rewards.append(effect("any_resource"))
        elif level == 3:
            rewards.append(gain(gold=1))
        rewards.append(effect("workshop" if index == 0 else "build"))
    elif index == 2:
        rewards.append(gain(gold=1, coin=level))
    else:
        rewards += ([gain(coin=1)] if level >= 2 else []) + [effect("painter")]
    _queue(state, rewards)


def _finish(state: Dict) -> None:
    rows = [{"player_id": pid, **score_breakdown(state, pid)} for pid in state["order"]]
    rows.sort(key=lambda row: (row["total"], row["apostles"]), reverse=True)
    best = (rows[0]["total"], rows[0]["apostles"])
    state["result"] = {"scores": rows, "winners": [r["player_id"] for r in rows if (r["total"], r["apostles"]) == best],
                       "reason": state["finishing"]}
    state.update(phase="game_over", game_over=True, current_turn=None)


def _advance_turn(state: Dict) -> None:
    position = state["order"].index(state["current_turn"])
    if state["finishing"] and position == len(state["order"]) - 1:
        _finish(state)
        return
    state["current_turn"] = state["order"][(position + 1) % len(state["order"])]
    state["phase"] = "turn"
    state["main_done"] = False
    state["pending"] = []


def _end_turn(state: Dict, pid: str) -> None:
    state["players"][pid]["turns"] += 1
    if not state["call_pending"]:
        _advance_turn(state)
        return
    review = []
    for player_id in state["order"]:
        p = state["players"][player_id]
        before = p["deviation"]
        repaired = min(p["rooster"], before)
        p["deviation"] -= repaired
        bonus = p["rooster"] - repaired
        points = bonus - p["deviation"]
        p["score"] += points
        review.append({"player_id": player_id, "before": before, "repaired": repaired,
                       "remaining": p["deviation"], "bonus": bonus, "points": points})
    state["calls"] += 1
    if state["calls"] == 4:
        state["finishing"] = state["finishing"] or "rooster"
    state.update(phase="round_end", review=review, next_ready=[], call_pending=False)
    _log(state, None, f"第 {state['calls']} 次报晓 · 等待所有人 Next Round")


def _apply(state: Dict, pid: str, move: Dict) -> None:
    p, kind = state["players"][pid], move["type"]
    if kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["order"]):
            state["round"] = min(4, state["calls"] + 1)
            state["rooster"] = ROOSTER_ROUNDS[len(state["order"])][min(3, state["calls"])]
            _advance_turn(state)
        return
    if kind == "clock":
        state["hand"] = (state["hand"] + move["steps"]) % 12
        state["face"] = (state["face"] - move["rotate"]) % 12
        p["deviation"] += max(0, move["steps"] - mastery_level(p["mastery"]["blue"])) + move["rotate"]
        occupant = state["clock_workers"][state["hand"]]
        if occupant:
            state["players"][occupant]["workers"] += 1
        p["workers"] -= 1
        state["clock_workers"][state["hand"]] = pid
        outer, inner = OUTER[state["hand"]], INNER[(state["hand"] - state["face"]) % 12]
        sections = (outer, inner) if move["first"] == "outer" else (inner, outer)
        _queue(state, [effect("bundle", effects=list(section)) for section in sections])
        state["main_done"] = True
        _log(state, pid, f"钟盘 → {state['hand'] + 1} · 内盘逆转 {move['rotate']} 格")
    elif kind == "pass":
        recover = (2, 3, 4, 4)[mastery_level(p["mastery"]["pink"]) - 1]
        _queue(state, [effect("recover", count=recover), effect("moon"), effect("rooster_step")])
        state["main_done"] = True
        _log(state, pid, "Pass · 回收工人 / 月亮 / 报晓")
    elif kind == "end_turn":
        _end_turn(state, pid)
        return
    elif kind == "place_apostle":
        _place_apostle(state, pid, move)
    elif kind == "use_scroll":
        scroll = p["scrolls"][move["index"]]
        scroll["used"] = True
        _queue(state, SCROLLS[scroll["kind"]])
    elif kind == "place_assistant":
        _pay(p, move["payment"])
        workshop = p["workshops"][move["index"]]
        workshop["assistant"], p["assistant"] = p["assistant"], None
        _queue(state, WORKSHOPS[workshop["card"]]["assistant"])
    elif kind == "claim":
        oid = move["objective"]
        claims = state["claims"][oid]
        points = 8 if not claims else 4 if len(state["order"]) == 2 else (6 if len(claims) == 1 else 4)
        claims.append({"player_id": pid, "points": points})
        p["workers"] -= 1
        if len(claims) == 1:
            _queue(state, OBJECTIVES[oid]["bonus"])
        _log(state, pid, f"认领目标 · 终局 {points}⭐")
    elif kind == "exchange":
        _pay(p, move["payment"])
        p["resources"]["gold"] += 1
    else:
        item = state["pending"].pop(0)
        count = item.get("count", 1)
        if kind == "resolve":
            rewards = item["effects"]
            chosen = rewards.pop(move["index"])
            chosen["accepted"] = True
            _queue(state, [chosen] + ([effect("bundle", effects=rewards)] if rewards else []))
        elif kind == "accept":
            item["accepted"] = True
            _queue(state, [item])
        elif kind == "skip":
            pass
        elif kind == "choose":
            if item["kind"] == "forced_painter":
                p["deviation"] += 1
            _queue(state, [effect(move["option"], accepted=True)])
        elif kind == "upgrade":
            _upgrade(p, move["track"])
        elif kind == "mastery":
            if item["kind"] == "paid_mastery":
                p["resources"]["coin"] -= 1
            if count > 1:
                _queue(state, [effect("mastery", count=count - 1)])
            _advance_mastery(state, pid, move["track"])
        elif kind == "any_resource":
            p["resources"][move["resource"]] += 1
            if count > 1:
                _queue(state, [effect("any_resource", count=count - 1)])
        elif kind == "produce":
            _produce(state, pid, move["resource"])
        elif kind == "painter":
            state["painter"] = (state["painter"] - move["steps"]) % 12
            slot = (state["painter"] + int(move["side"] == "left")) % 12
            _queue(state, state["calendar"][slot])
        elif kind == "recover":
            if move["zone"] == "clock":
                state["clock_workers"][move["slot"]] = None
            else:
                state["board"][move["zone"]][move["slot"]]["owner"] = None
            p["workers"] += 1
            if count > 1:
                _queue(state, [effect("recover", count=count - 1)])
        elif kind == "take_scroll":
            scroll = state["scroll_market"].pop(move["index"])
            p["scrolls"].append({"kind": scroll, "used": False})
            if state["scroll_deck"]:
                state["scroll_market"].insert(move["index"], state["scroll_deck"].pop())
        elif kind == "take_assistant":
            p["assistant"] = move["assistant"]
            state["assistants"][move["assistant"]] -= 1
        elif kind == "take_apostle":
            p["deviation"] += move["steps"]
            _rotate_gears(state, move["steps"])
            p["warehouse"].append(move["apostle"])
            _rotate_gears(state, 1)
        elif kind == "workshop":
            _workshop(state, pid, move)
        elif kind == "build":
            _construct(state, pid, move)
        elif kind == "sculptor":
            _sculpt(state, pid, move)
    _settle(state)


class OrlojGame:
    game_id = "orloj"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or set(config) - {"seed"} or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("invalid Orloj configuration")
        if not 2 <= len(players) <= 4:
            raise ValueError("Orloj requires 2–4 players; add a bot to play alone")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p.get("player_id") for p in ordered]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        seed = config.get("seed", secrets.randbits(128))
        rng = random.Random(seed)
        deck = list(WORKSHOPS)
        rng.shuffle(deck)
        scrolls = list(SCROLLS) * len(players)
        rng.shuffle(scrolls)
        windows, royals = rng.sample(list(METRICS), 3), rng.sample(list(METRICS), 3)
        state = {"game_id": "orloj", "version": 1, "seed": seed, "revision": 0,
                 "phase": "setup", "setup_index": 0, "round": 1, "calls": 0,
                 "order": ids, "current_turn": ids[0], "players": {}, "player_meta": {},
                 "hand": 0, "face": rng.randrange(12), "moon": 11, "gears": 0,
                 "clock_workers": [None] * 12, "sculptors": [None] * 4,
                 "painter": 11, "calendar": [copy.deepcopy(list(rewards)) for rewards in CALENDAR], "hammers": {"months": 0, "zodiac": 0},
                 "board": {}, "market": deck[:3], "workshop_deck": deck[3:],
                 "scroll_market": scrolls[:3 if len(ids) == 2 else 4],
                 "scroll_deck": scrolls[3 if len(ids) == 2 else 4:],
                 "assistants": dict.fromkeys(ASSISTANTS, len(ids) - 1),
                 "windows": dict(zip(TRACKS, windows)), "royals": dict(zip(TRACKS, royals)),
                 "objectives": [rng.choice([key for key, o in OBJECTIVES.items() if o["group"] == group]) for group in range(3)],
                 "rooster": ROOSTER_ROUNDS[len(ids)][0], "call_pending": False, "finishing": None,
                 "main_done": False, "pending": [], "next_ready": [], "review": [],
                 "log": [], "game_over": False, "result": None}
        state["claims"] = {key: [] for key in state["objectives"]}
        for zone in ("months", "zodiac"):
            prebuilt = rng.sample(range(12), 9 - len(ids))
            state["board"][zone] = [{"built": i in prebuilt, "owner": None, "blocked": i in prebuilt[:-1]} for i in range(12)]
        presets = rng.sample(list(PRESETS), len(ids))
        for metadata, preset in zip(ordered, presets):
            pid = metadata["player_id"]
            state["player_meta"][pid] = {"name": metadata.get("name", pid), "is_bot": bool(metadata.get("is_bot")), "seat": metadata.get("seat", 0)}
            state["players"][pid] = {"resources": {key: preset["resources"].get(key, 0) for key in RESOURCES},
                                     "score": 10, "workers": 5 if len(ids) == 2 else 4,
                                     "production": dict.fromkeys(BASIC, 0), "production_workers": 0,
                                     "hammer": preset["hammer"], "hammer_level": 0,
                                     "mastery": dict(zip(TRACKS, preset["mastery"])),
                                     "rooster": preset["rooster"], "deviation": preset["deviation"],
                                     "warehouse": list(preset["apostles"]), "assistant": None,
                                     "panel": [None] * 12, "scrolls": [], "royals": [], "workshops": [],
                                     "market_workers": [], "initial_upgrades": preset["upgrades"], "turns": 0}
        state["pending"] = [effect("upgrade", mandatory=True)] * state["players"][ids[0]]["initial_upgrades"]
        _settle(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return list(dict.fromkeys(m["type"] for m in legal_moves(state, player_id)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict):
            return [], "invalid action"
        try:
            key = json.dumps(action, sort_keys=True, allow_nan=False)
            available = {json.dumps({**move, "revision": state["revision"]}, sort_keys=True)
                         for move in legal_moves(state, player_id)}
            if key not in available:
                return [], "action unavailable or stale; refresh your selection"
        except (TypeError, ValueError):
            return [], "invalid action"
        trial = copy.deepcopy(state)
        _apply(trial, player_id, action)
        trial["revision"] += 1
        state.clear()
        state.update(trial)
        return [{"type": "orloj:update", "payload": {"actor": player_id, "action": action["type"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        private = {"seed", "workshop_deck", "scroll_deck", "players", "player_meta", "setup_index"}
        view = {key: copy.deepcopy(value) for key, value in state.items() if key not in private}
        view["players"] = [{"player_id": pid, **copy.deepcopy(state["player_meta"][pid]),
                            **copy.deepcopy(state["players"][pid]), "metrics": metrics(state, pid),
                            "projected": score_breakdown(state, pid)} for pid in state["order"]]
        view["you"] = viewer_id
        view["moves"] = [{**move, "revision": state["revision"]} for move in legal_moves(state, viewer_id)]
        view["legal_actions"] = list(dict.fromkeys(m["type"] for m in view["moves"]))
        view["workshop_deck_count"], view["scroll_deck_count"] = len(state["workshop_deck"]), len(state["scroll_deck"])
        view["gear_apostles"] = list(available_apostles(state["gears"]))
        view["catalog"] = copy.deepcopy({"outer": OUTER, "inner": INNER, "moon": MOON,
                                         "workshops": WORKSHOPS, "apostles": APOSTLES, "slots": APOSTLE_SLOTS,
                                         "hammers": HAMMERS, "hammer_cells": HAMMER_CELLS,
                                         "assistants": ASSISTANTS, "objectives": OBJECTIVES, "scrolls": SCROLLS,
                                         "metric_names": METRIC_NAMES, "primary": PRIMARY_MULTIPLIER,
                                         "zodiac": ZODIAC, "ruleset": "digital_workshops_v1",
                                         "costs": {zone: [construction_cost(zone, i) for i in range(12)] for zone in ("months", "zodiac")}})
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.orloj_ai import choose_move
        return choose_move(OrlojGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            if payload["game_id"] != "orloj" or payload["version"] != 1:
                raise ValueError("invalid Orloj save version")
            ids = payload["order"]
            if not isinstance(ids, list) or not 2 <= len(ids) <= 4 or len(set(ids)) != len(ids) or set(ids) != set(payload["players"]):
                raise ValueError("invalid Orloj players")
            if payload["phase"] not in ("setup", "turn", "round_end", "game_over"):
                raise ValueError("invalid Orloj phase")
            for p in payload["players"].values():
                if any(type(p["resources"][k]) is not int or p["resources"][k] < 0 for k in RESOURCES):
                    raise ValueError("invalid resources")
                if type(p["deviation"]) is not int or not 0 <= p["deviation"] <= 5 or not 0 <= p["workers"] <= 14:
                    raise ValueError("invalid player counters")
            for zone in ("months", "zodiac"):
                if len(payload["board"][zone]) != 12:
                    raise ValueError("invalid calendar")
            # Validate the remaining public structure without returning aliases.
            restored = copy.deepcopy(payload)
            OrlojGame.get_public_view(restored, ids[0])
            json.dumps(restored, allow_nan=False)
            return restored
        except (KeyError, TypeError, IndexError, AttributeError) as exc:
            raise ValueError("invalid Orloj save") from exc
