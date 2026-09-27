"""Authoritative Grand Austria Hotel rules and resumable effect resolution."""
import copy
import json
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.grand_austria_hotel_data import (
    COLORS, EMPERORS, EMPEROR_POINTS, FOOD, GROUP_REWARDS, GUESTS, MARKET_COST,
    OBJECTIVES, ROOMS, ROOM_GROUPS, STAFF, STAFF_EFFECTS, effect, food, hire, prepare,
)


def _log(state: Dict, text: str) -> None:
    state["log"].append(text)
    state["log"] = state["log"][-100:]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid]["name"]


def _gain(player: Dict, resource: str, amount: int) -> None:
    if resource == "money":
        player["money"] = min(20, player["money"] + amount)
    elif resource == "emperor":
        player["score"] += max(0, player["emperor"] + amount - 13)
        player["emperor"] = min(13, player["emperor"] + amount)
    else:
        player["score"] += amount


def _rng(state: Dict) -> random.Random:
    rng = random.Random(f'{state["seed"]}:{state["random_index"]}')
    state["random_index"] += 1
    return rng


def _roll(state: Dict, count: int) -> None:
    state["dice"] = [0] * 6
    rng = _rng(state)
    for _ in range(count):
        state["dice"][rng.randrange(6)] += 1


def _queue(state: Dict, pid: str, effects: List[Dict], front: bool = False) -> None:
    entries = [{**copy.deepcopy(item), "owner": pid} for item in effects]
    if front:
        state["pending"][0:0] = entries
    else:
        state["pending"].extend(entries)


def _rewards(state: Dict, pid: str, effects: List[Dict], front: bool = False) -> None:
    # A player chooses the order of the rewards printed on a card.
    if len(effects) > 1:
        _queue(state, pid, [effect("bundle", effects=effects)], front)
    else:
        _queue(state, pid, effects, front)


def _room_cost(player: Dict, room: int, discount: int = 0) -> int:
    free_staff = {"blue": "9", "red": "10", "yellow": "11"}[ROOMS[room]["color"]]
    return 0 if free_staff in player["staff"] else max(0, room // 5 - discount)


def _can_prepare(player: Dict, room: int, pending: Dict) -> bool:
    if player["rooms"][room] or room // 5 > pending.get("max_floor", 3):
        return False
    if _room_cost(player, room, pending.get("discount", 0)) > player["money"]:
        return False
    if not any(player["rooms"]):
        return room == 0
    row, col = divmod(room, 5)
    return any(player["rooms"][r * 5 + c] for r, c in
               ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1))
               if 0 <= r < 4 and 0 <= c < 5)


def _complete(guest: Dict) -> bool:
    return all(guest["served"].get(key, 0) >= count for key, count in GUESTS[guest["id"]]["order"].items())


def _needs(guest: Dict, resource: str) -> bool:
    return guest["served"].get(resource, 0) < GUESTS[guest["id"]]["order"].get(resource, 0)


def _full_groups(player: Dict) -> List[int]:
    return [i for i, group in enumerate(ROOM_GROUPS) if all(player["rooms"][r] == 2 for r in group)]


def _occupied(player: Dict, color: Optional[str] = None) -> int:
    return sum(value == 2 and (color is None or ROOMS[i]["color"] == color)
               for i, value in enumerate(player["rooms"]))


def _full_lines(player: Dict, columns: bool = False) -> int:
    lines = ([r * 5 + c for r in range(4)] for c in range(5)) if columns else (
        range(r * 5, r * 5 + 5) for r in range(4))
    return sum(all(player["rooms"][i] == 2 for i in line) for line in lines)


def objective_met(player: Dict, oid: str) -> bool:
    counts = {color: _occupied(player, color) for color in COLORS}
    return {
        "105": player["money"] >= 20, "106": player["emperor"] >= 10,
        "107": len(player["staff"]) >= 6, "108": sum(bool(x) for x in player["rooms"]) >= 12,
        "109": _full_lines(player) >= 2, "110": _full_lines(player, True) >= 2,
        "111": len(_full_groups(player)) >= 6,
        "112": any(all(player["rooms"][i] == 2 for i in range(20) if ROOMS[i]["color"] == color) for color in COLORS),
        "113": min(counts.values()) >= 3,
        "114": counts["red"] >= 4 and counts["yellow"] >= 3,
        "115": counts["yellow"] >= 4 and counts["blue"] >= 3,
        "116": counts["blue"] >= 4 and counts["red"] >= 3,
    }[oid]


def _take_guest(state: Dict, pid: str, slot: int) -> None:
    gid = state["market"].pop(slot)
    state["players"][pid]["cafe"].append({"id": gid, "served": {}})
    if state["guest_deck"]:
        state["market"].insert(0, state["guest_deck"].pop(0))
    else:
        state["market"].insert(0, None)
    _log(state, f'{_name(state, pid)} · 招揽 {GUESTS[gid]["name"]}')


def _occupy_room(state: Dict, pid: str, room: int) -> List[Dict]:
    player = state["players"][pid]
    player["rooms"][room] = 2
    rewards = [effect("room_staff")]
    group = ROOMS[room]["group"]
    if all(player["rooms"][r] == 2 for r in ROOM_GROUPS[group]):
        rewards.append(effect("group_bonus", group=group))
    return rewards


def _draw_staff(state: Dict, pid: str, count: int) -> None:
    deck = state["staff_deck"]
    state["players"][pid]["hand"].extend(deck[:count])
    del deck[:count]


def _start_round(state: Dict) -> None:
    order = state["turn_order"]
    first = state["start_index"]
    order = order[first:] + order[:first]
    state.update(phase="turn", slots=order + order[::-1], done=[], passed=[], next_ready=[],
                 round_scores={pid: state["players"][pid]["score"] for pid in order})
    for player in state["players"].values():
        player["used_staff"] = []
    _roll(state, 6 + 2 * len(order))
    _log(state, f'第 {state["round"]} 轮 · 掷出 {sum(state["dice"])} 颗骰子')
    _select_turn(state)


def _select_turn(state: Dict) -> None:
    remaining = [i for i in range(len(state["slots"])) if i not in state["done"]]
    if not remaining or not sum(state["dice"]):
        _end_round(state)
        return
    eligible = [i for i in remaining if state["slots"][i] not in state["passed"]]
    if not eligible:
        count = sum(state["dice"]) - 1
        _roll(state, count)
        state["passed"] = []
        state["rerolls"] += 1
        _log(state, f'弃一骰后重掷 · 剩余 {count} 颗')
        if not count:
            _end_round(state)
            return
        eligible = remaining
    state["slot"] = eligible[0]
    state["current_turn"] = state["slots"][eligible[0]]
    state["turn"] = {"recruited": False, "die": False, "touched": False}


def _end_round(state: Dict) -> None:
    state["phase"] = "emperor"
    state["current_turn"] = None
    if state["round"] in (3, 5, 7):
        index = (3, 5, 7).index(state["round"])
        tile = state["emperors"][index]
        order = state["turn_order"][state["start_index"]:] + state["turn_order"][:state["start_index"]]
        for pid in order:
            _queue(state, pid, [effect("emperor_scoring", tile=tile)])
    _settle(state)


def staff_points(state: Dict, pid: str, sid: str) -> int:
    player = state["players"][pid]
    if sid == "29":
        return max([staff_points(state, pid, other) for oid, op in state["players"].items() if oid != pid
                    for other in op["staff"] if other != "29" and STAFF[other]["timing"] == "end"] or [0])
    return {
        "27": _occupied(player, "red") * 3, "28": _occupied(player, "blue") * 3,
        "30": _occupied(player, "yellow") * 3, "31": _occupied(player),
        "32": len(player["staff"]) * 2, "34": sum(bool(x) for x in player["rooms"]),
        "37": len(_full_groups(player)) * 2, "40": len(player["objectives"]) * 5,
        "41": player["emperor"] * 2, "46": _full_lines(player) * 5,
        "47": _full_lines(player, True) * 5,
        "48": min(_occupied(player, color) for color in COLORS) * 4,
    }.get(sid, 0)


def _final_score(state: Dict) -> None:
    rows = []
    for pid, player in state["players"].items():
        parts = {"during_game": player["score"],
                 "staff": sum(staff_points(state, pid, sid) for sid in player["staff"]),
                 "rooms": sum(i // 5 + 1 for i, value in enumerate(player["rooms"]) if value == 2),
                 "resources": player["money"] + sum(player["kitchen"].values()),
                 "waiting_guests": -5 * len(player["cafe"])}
        player["score"] = sum(parts.values())
        rows.append({"player_id": pid, "score": player["score"], "breakdown": parts, "tie_break": parts["resources"]})
    rows.sort(key=lambda row: (row["score"], row["tie_break"]), reverse=True)
    best = (rows[0]["score"], rows[0]["tie_break"])
    state["result"] = {"ranking": rows, "winners": [r["player_id"] for r in rows if (r["score"], r["tie_break"]) == best]}


def _review(state: Dict) -> None:
    if state["round"] == 7:
        _final_score(state)
    state.update(phase="round_end", current_turn=None, next_ready=[])
    state["review"] = [{"player_id": pid, "score": player["score"],
                        "delta": player["score"] - state["round_scores"][pid], "emperor": player["emperor"]}
                       for pid, player in state["players"].items()]
    _log(state, f'第 {state["round"]} 轮结算完毕 · 等待全员 Next Round')


def _penalty(state: Dict, pid: str, code: str) -> None:
    player = state["players"][pid]
    if code.startswith("money"):
        count = int(code[-1])
        if player["money"] >= count:
            player["money"] -= count
        else:
            player["score"] -= count + 2
    elif code in ("kitchen", "all_food"):
        player["kitchen"] = dict.fromkeys(FOOD, 0)
        if code == "all_food":
            for guest in player["cafe"]:
                guest["served"] = {}
    elif code.startswith("hand"):
        count = int(code[-1])
        if len(player["hand"]) >= count:
            _queue(state, pid, [effect("return_hand", count)], True)
        else:
            player["score"] -= 5 if count == 2 else 7
    elif code.startswith("vacant"):
        count = int(code[-1])
        if player["rooms"].count(1) >= count:
            _queue(state, pid, [effect("remove_room", count, status=1, floors=[])], True)
        else:
            player["score"] -= 5 if count == 1 else 7
    elif code == "occupied2":
        _queue(state, pid, [effect("remove_room", 2, status=2, floors=[])], True)
    elif code == "vp8":
        player["score"] -= 8
    elif code == "staff_vp":
        player["score"] -= 2 * len(player["staff"])
    elif code == "end_staff":
        if any(STAFF[sid]["timing"] == "end" for sid in player["staff"]):
            _queue(state, pid, [effect("remove_staff")], True)
        else:
            player["score"] -= 10


def _main_effect(state: Dict, pid: str, pending: Dict) -> None:
    player = state["players"][pid]
    target, strength, split = pending["action"], pending["strength"], pending["split"]
    if target in (1, 2):
        first, second = ("strudel", "cake") if target == 1 else ("wine", "coffee")
        _queue(state, pid, [effect("food", items={first: strength - split, second: split})], True)
    elif target == 3:
        _queue(state, pid, [prepare(strength)], True)
    elif target == 4:
        _gain(player, "emperor", strength if pending.get("bootblack") else split)
        _gain(player, "money", strength if pending.get("bootblack") else strength - split)
    elif target == 5:
        _queue(state, pid, [hire(strength)], True)


def _settle(state: Dict) -> None:
    """Resolve forced effects; stop at a real player decision. No private RNG leaks."""
    while state["pending"]:
        pending = state["pending"][0]
        kind, pid = pending["kind"], pending["owner"]
        player = state["players"][pid]
        count = pending["count"]
        if count <= 0:
            state["pending"].pop(0)
            continue
        if kind == "hire" and pending.get("offer") and "cards" not in pending:
            pending["cards"] = state["staff_deck"][:3]
            del state["staff_deck"][:3]
        if kind == "food":
            pending["items"] = {key: value for key, value in pending["items"].items() if value > 0}
            if pending["items"]:
                return
        elif kind == "bundle":
            if pending["effects"]:
                return
        elif kind in ("money", "emperor", "vp"):
            _gain(player, kind, count)
        elif kind == "draw":
            _draw_staff(state, pid, count)
        elif kind == "main":
            state["pending"].pop(0)
            _main_effect(state, pid, pending)
            continue
        elif kind == "staff_vp":
            player["score"] += count * len(player["staff"])
        elif kind == "room_staff":
            if "23" in player["staff"]:
                _gain(player, "money", 1)
        elif kind == "guest_staff":
            guest = GUESTS[pending["guest"]]
            color = guest["color"]
            for sid, trigger, resource, amount in (("5", "red", "money", 2), ("6", "blue", "emperor", 1),
                                                  ("7", "yellow", "money", 1), ("8", "green", "vp", 2)):
                if sid in player["staff"] and color == trigger:
                    _gain(player, resource, amount)
            if "33" in player["staff"] and sum(guest["order"].values()) >= 4:
                player["score"] += 4
        elif kind == "group_bonus":
            group = ROOM_GROUPS[pending["group"]]
            color = ROOMS[group[0]]["color"]
            value = GROUP_REWARDS[color][len(group)]
            _gain(player, {"blue": "vp", "red": "money", "yellow": "emperor"}[color], value)
            _log(state, f'{_name(state, pid)} · {color} 房间组完成，奖励 {value}')
        elif kind == "emperor_scoring":
            state["pending"].pop(0)
            points = EMPEROR_POINTS[player["emperor"]]
            player["score"] += points
            player["emperor"] = max(0, player["emperor"] - state["round"])
            tile = EMPERORS[pending["tile"]]
            outcome = "中立"
            if player["emperor"] >= 3:
                outcome = "奖励"
                if "42" in player["staff"]:
                    player["score"] += 5
                _rewards(state, pid, tile["reward"], True)
            elif player["emperor"] == 0:
                outcome = "惩罚"
                _queue(state, pid, [effect("penalty", code=tile["penalty"])], True)
            _log(state, f'{_name(state, pid)} · 皇帝 +{points} 分，退后到 {player["emperor"]}，{outcome}')
            continue
        elif kind == "penalty" and not ("26" in player["staff"] and player["money"]):
            state["pending"].pop(0)
            _penalty(state, pid, pending["code"])
            continue
        else:
            moves = _pending_moves(state, pending)
            if moves:
                return
        state["pending"].pop(0)
    if state["phase"] == "setup_rooms":
        state["setup_index"] += 1
        if state["setup_index"] == len(state["turn_order"]):
            _start_round(state)
        else:
            pid = state["turn_order"][state["setup_index"]]
            state["current_turn"] = pid
            _queue(state, pid, [{**prepare(3), "mandatory": True}])
    elif state["phase"] == "emperor":
        _review(state)


def _dice_moves(state: Dict, pid: str, bonus: bool = False) -> List[Dict]:
    player = state["players"][pid]
    staff = player["staff"] if not bonus else []
    moves = []
    for face, count in enumerate(state["dice"], 1):
        if not count:
            continue
        fee = int(face == 6 and "17" not in staff)
        for boost in ((False,) if bonus else (False, True)):
            if player["money"] < fee + int(boost):
                continue
            strength = count + int(boost)
            strength += int(face in (1, 2) and "13" in staff) + int(face == 6 and "17" in staff)
            strength += 2 * int(face == 5 and "18" in staff)
            for target in (range(1, 6) if face == 6 else (face,)):
                splits = range(strength // 2 + 1) if target in (1, 2) else (
                    range(strength + 1) if target == 4 and not (face == 4 and "15" in staff) else (0,))
                timing = ("before", "after") if not bonus and (
                    (face in (1, 2) and "14" in staff) or (face == 3 and "22" in staff) or (face == 5 and "20" in staff)) else ("after",)
                for split in splits:
                    for when in timing:
                        moves.append({"type": "bonus_die" if bonus else "dice", "face": face,
                                      "action": target, "boost": boost, "split": split, "timing": when})
    return moves


def _pending_moves(state: Dict, pending: Dict) -> List[Dict]:
    pid, kind = pending["owner"], pending["kind"]
    player = state["players"][pid]
    moves = []
    if kind == "bundle":
        return [{"type": "resolve", "effect": i} for i in range(len(pending["effects"]))]
    if kind in ("food", "any_food", "service"):
        items = pending.get("items", player["kitchen"] if kind == "service" else dict.fromkeys(FOOD, 1))
        for resource in FOOD:
            if not items.get(resource):
                continue
            for guest in player["cafe"]:
                if _needs(guest, resource):
                    moves.append({"type": "serve_item" if kind == "service" else "gain_food",
                                  "food": resource, "guest": guest["id"]})
            if kind == "any_food":
                moves.append({"type": "gain_food", "food": resource, "guest": None})
        if kind == "food":
            moves.append({"type": "store_food"})
        elif kind == "service":
            moves.append({"type": "skip"})
        return moves
    if kind == "prepare":
        moves = [{"type": "prepare", "room": i} for i in range(20) if _can_prepare(player, i, pending)]
    elif kind == "occupy":
        moves = [{"type": "occupy", "room": i} for i, value in enumerate(player["rooms"]) if value == 1]
    elif kind == "hire":
        cards = pending.get("cards", player["hand"])
        moves = [{"type": "hire", "staff": sid} for sid in cards
                 if max(0, STAFF[sid]["cost"] - pending["discount"]) <= player["money"]]
    elif kind == "guest":
        moves = [{"type": "take_guest", "slot": i} for i, gid in enumerate(state["market"]) if gid and len(player["cafe"]) < 3]
    elif kind == "complete":
        moves = [{"type": "complete", "guest": guest["id"]} for guest in player["cafe"] if not _complete(guest)]
    elif kind == "extra_die":
        moves = _dice_moves(state, pid, True)
    elif kind == "return_offer":
        return [{"type": "return_staff", "staff": sid} for sid in pending["cards"]]
    elif kind == "return_hand":
        return [{"type": "return_staff", "staff": sid} for sid in player["hand"]]
    elif kind == "remove_room":
        rooms = [i for i, value in enumerate(player["rooms"]) if value == pending["status"]
                 and (pending["status"] == 1 or i // 5 not in pending["floors"])]
        highest = max([i // 5 for i in rooms] or [-1])
        return [{"type": "remove_room", "room": i} for i in rooms if i // 5 == highest]
    elif kind == "remove_staff":
        return [{"type": "remove_staff", "staff": sid} for sid in player["staff"] if STAFF[sid]["timing"] == "end"]
    elif kind == "penalty":
        return [{"type": "avoid_penalty"}, {"type": "accept_penalty"}]
    if not pending.get("mandatory"):
        moves.append({"type": "skip"})
    return moves


def _moves(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["players"] or state["game_over"]:
        return []
    if state["pending"]:
        pending = state["pending"][0]
        return _pending_moves(state, pending) if pending["owner"] == pid else []
    if state["phase"] == "round_end":
        return [{"type": "next_round"}] if pid not in state["next_ready"] else []
    if state["current_turn"] != pid:
        return []
    if state["phase"] == "setup_guest":
        return [{"type": "recruit", "slot": i} for i, gid in enumerate(state["market"]) if gid]
    if state["phase"] != "turn":
        return []
    player, turn = state["players"][pid], state["turn"]
    moves = []
    if not turn["die"]:
        moves.extend(_dice_moves(state, pid))
        if not turn["recruited"] and len(player["cafe"]) < 3:
            moves.extend({"type": "recruit", "slot": i} for i, gid in enumerate(state["market"])
                         if gid and ("25" in player["staff"] or player["money"] >= MARKET_COST[i]))
    else:
        moves.append({"type": "end_turn"})
    if not turn["touched"]:
        moves.append({"type": "pass"})
    if player["money"] or "24" in player["staff"]:
        if any(player["kitchen"][key] and _needs(guest, key) for key in FOOD for guest in player["cafe"]):
            moves.append({"type": "serve"})
    for guest in player["cafe"]:
        if _complete(guest):
            color = GUESTS[guest["id"]]["color"]
            moves.extend({"type": "check_in", "guest": guest["id"], "room": i}
                         for i, value in enumerate(player["rooms"]) if value == 1 and (color == "green" or ROOMS[i]["color"] == color))
    moves.extend({"type": "use_staff", "staff": sid} for sid in player["staff"]
                 if STAFF[sid]["timing"] == "round" and sid not in player["used_staff"])
    moves.extend({"type": "claim", "objective": oid} for oid in state["objectives"]
                 if pid not in state["claims"][oid] and len(state["claims"][oid]) < 3 and objective_met(player, oid))
    return moves


def _use_die(state: Dict, pid: str, move: Dict, bonus: bool = False) -> None:
    player = state["players"][pid]
    face, target = move["face"], move["action"]
    staff = list(player["staff"]) if not bonus else []
    strength = state["dice"][face - 1] + int(move["boost"])
    strength += int(face in (1, 2) and "13" in staff) + int(face == 6 and "17" in staff)
    strength += 2 * int(face == 5 and "18" in staff)
    player["money"] -= int(move["boost"]) + int(face == 6 and "17" not in staff)
    if not bonus:
        state["dice"][face - 1] -= 1
        state["turn"]["die"] = True
    main = effect("main", action=target, strength=strength, split=move["split"], bootblack=face == 4 and "15" in staff)
    extra = []
    if face in (1, 2) and "14" in staff:
        extra.append(prepare())
    if face == 3 and "22" in staff:
        extra.append(hire())
    if face == 5 and "20" in staff:
        extra.append(effect("emperor", 2))
    if face in (3, 4) and "12" in staff:
        player["score"] += 2
    if face == 4 and "16" in staff:
        player["score"] += 4
    if face == 3 and "19" in staff:
        player["score"] += 5
    _queue(state, pid, extra + [main] if move["timing"] == "before" else [main] + extra, True)
    _log(state, f'{_name(state, pid)} · {"奖励行动" if bonus else "取骰"} {face} → {target}，强度 {strength}')


def _apply_pending(state: Dict, pid: str, move: Dict) -> None:
    pending = state["pending"][0]
    player, kind = state["players"][pid], move["type"]
    if kind == "resolve":
        chosen = pending["effects"].pop(move["effect"])
        _queue(state, pid, [chosen], True)
        return
    if kind == "skip":
        if pending["kind"] == "hire" and pending.get("cards"):
            cards = pending["cards"]
            state["pending"].pop(0)
            _queue(state, pid, [effect("return_offer", len(cards), cards=cards)], True)
        else:
            state["pending"].pop(0)
        return
    if kind in ("gain_food", "serve_item"):
        key = move["food"]
        if move["guest"] is None:
            player["kitchen"][key] += 1
        else:
            guest = next(g for g in player["cafe"] if g["id"] == move["guest"])
            guest["served"][key] = guest["served"].get(key, 0) + 1
        if pending["kind"] == "food":
            pending["items"][key] -= 1
        else:
            pending["count"] -= 1
        if kind == "serve_item":
            player["kitchen"][key] -= 1
        return
    if kind == "store_food":
        for key, amount in pending["items"].items():
            player["kitchen"][key] += amount
        state["pending"].pop(0)
        return
    pending["count"] -= 1
    if kind == "prepare":
        room = move["room"]
        player["money"] -= _room_cost(player, room, pending.get("discount", 0))
        player["rooms"][room] = 1
        player["score"] += ROOMS[room]["bonus"]
        if pending.get("occupy"):
            _queue(state, pid, _occupy_room(state, pid, room), True)
    elif kind == "occupy":
        _queue(state, pid, _occupy_room(state, pid, move["room"]), True)
    elif kind == "hire":
        sid = move["staff"]
        player["money"] -= max(0, STAFF[sid]["cost"] - pending["discount"])
        cards = pending.get("cards", player["hand"])
        cards.remove(sid)
        player["staff"].append(sid)
        if pending.get("offer"):
            pending["kind"] = "return_offer"
            pending["count"] = len(cards)
        if STAFF[sid]["timing"] == "once":
            _rewards(state, pid, STAFF_EFFECTS[sid], True)
        _log(state, f'{_name(state, pid)} · 雇用 {STAFF[sid]["name"]}')
    elif kind == "take_guest":
        _take_guest(state, pid, move["slot"])
    elif kind == "complete":
        guest = next(g for g in player["cafe"] if g["id"] == move["guest"])
        guest["served"] = dict(GUESTS[guest["id"]]["order"])
    elif kind == "bonus_die":
        _use_die(state, pid, move, True)
    elif kind == "return_staff":
        cards = pending.get("cards", player["hand"])
        cards.remove(move["staff"])
        state["staff_deck"].append(move["staff"])
    elif kind == "remove_room":
        player["rooms"][move["room"]] = 0
        pending["floors"].append(move["room"] // 5)
    elif kind == "remove_staff":
        player["staff"].remove(move["staff"])
        state["retired_staff"].append(move["staff"])
    elif kind == "avoid_penalty":
        player["money"] -= 1
    elif kind == "accept_penalty":
        _penalty(state, pid, pending["code"])


def _apply(state: Dict, pid: str, move: Dict) -> None:
    if state["pending"]:
        _apply_pending(state, pid, move)
        _settle(state)
        return
    kind, player = move["type"], state["players"][pid]
    if kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["players"]):
            if state["round"] == 7:
                state.update(phase="game_over", game_over=True)
            else:
                state["round"] += 1
                state["start_index"] = (state["start_index"] + 1) % len(state["players"])
                _start_round(state)
        return
    if state["phase"] == "setup_guest":
        _take_guest(state, pid, move["slot"])
        state["setup_index"] -= 1
        if state["setup_index"] >= 0:
            state["current_turn"] = state["turn_order"][state["setup_index"]]
        else:
            state.update(phase="setup_rooms", setup_index=0, current_turn=state["turn_order"][0])
            _queue(state, state["current_turn"], [{**prepare(3), "mandatory": True}])
        return
    if kind == "pass":
        state["passed"].append(pid)
        _log(state, f'{_name(state, pid)} · Pass')
        _select_turn(state)
        return
    state["turn"]["touched"] = True
    if kind == "recruit":
        player["money"] -= 0 if "25" in player["staff"] else MARKET_COST[move["slot"]]
        _take_guest(state, pid, move["slot"])
        state["turn"]["recruited"] = True
    elif kind == "dice":
        _use_die(state, pid, move)
    elif kind == "end_turn":
        state["done"].append(state["slot"])
        _select_turn(state)
    elif kind == "serve":
        player["money"] -= int("24" not in player["staff"])
        _queue(state, pid, [effect("service", 3)])
    elif kind == "check_in":
        guest = next(g for g in player["cafe"] if g["id"] == move["guest"])
        player["cafe"].remove(guest)
        state["guest_discard"].append(guest["id"])
        player["completed_guests"] += 1
        player["score"] += GUESTS[guest["id"]]["vp"]
        room_effects = _occupy_room(state, pid, move["room"])
        _rewards(state, pid, GUESTS[guest["id"]]["effects"])
        _queue(state, pid, [effect("guest_staff", guest=guest["id"])] + room_effects)
        _log(state, f'{_name(state, pid)} · {GUESTS[guest["id"]]["name"]} 入住 {move["room"] // 5 + 1}{move["room"] % 5 + 1}，+{GUESTS[guest["id"]]["vp"]} 分')
    elif kind == "use_staff":
        player["used_staff"].append(move["staff"])
        _rewards(state, pid, STAFF_EFFECTS[move["staff"]])
    elif kind == "claim":
        oid = move["objective"]
        points = (15, 10, 5)[len(state["claims"][oid])]
        state["claims"][oid].append(pid)
        player["objectives"].append(oid)
        player["score"] += points
        _log(state, f'{_name(state, pid)} · 完成目标，+{points} 分')
    _settle(state)


class GrandAustriaHotelGame:
    game_id = "grand_austria_hotel"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or set(config) - {"seed"} or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("invalid Grand Austria Hotel configuration")
        if not 2 <= len(players) <= 4:
            raise ValueError("Grand Austria Hotel requires 2–4 players")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p.get("player_id") for p in ordered]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        seed = config.get("seed", secrets.randbits(128))
        rng = random.Random(seed)
        guests, staff = list(GUESTS), list(STAFF)
        rng.shuffle(guests)
        rng.shuffle(staff)
        state = {"game_id": GrandAustriaHotelGame.game_id, "seed": seed, "random_index": 0,
                 "revision": 0, "phase": "setup_guest", "round": 1, "turn_order": ids,
                 "start_index": 0, "setup_index": len(ids) - 1, "current_turn": ids[-1],
                 "players": {}, "player_meta": {}, "market": guests[:5], "guest_deck": guests[5:],
                 "staff_deck": staff, "guest_discard": [], "retired_staff": [], "pending": [],
                 "dice": [0] * 6, "slots": [], "done": [], "passed": [], "turn": {},
                 "next_ready": [], "rerolls": 0, "log": [], "review": [], "result": None, "game_over": False,
                 "objectives": [rng.choice([key for key, item in OBJECTIVES.items() if item["category"] == group]) for group in "ABC"],
                 "emperors": [rng.choice([key for key in EMPERORS if key.startswith(group)]) for group in "ABC"]}
        state["claims"] = {oid: [] for oid in state["objectives"]}
        for p in ordered:
            pid = p["player_id"]
            state["player_meta"][pid] = {"name": p.get("name", pid), "is_bot": bool(p.get("is_bot")), "seat": p.get("seat", 0)}
            state["players"][pid] = {"money": 10, "emperor": 0, "score": 0, "kitchen": dict.fromkeys(FOOD, 1),
                                     "rooms": [0] * 20, "cafe": [], "hand": [], "staff": [], "used_staff": [],
                                     "objectives": [], "completed_guests": 0}
            _draw_staff(state, pid, 6)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return list(dict.fromkeys(move["type"] for move in _moves(state, player_id)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict):
            return [], "invalid action"
        try:
            key = json.dumps(action, sort_keys=True, allow_nan=False)
            legal = [{**move, "revision": state["revision"]} for move in _moves(state, player_id)]
            if key not in {json.dumps(move, sort_keys=True) for move in legal}:
                return [], "action unavailable or stale; refresh your selection"
        except (TypeError, ValueError):
            return [], "invalid action"
        trial = copy.deepcopy(state)
        _apply(trial, player_id, action)
        trial["revision"] += 1
        state.clear()
        state.update(trial)
        # No card IDs or private effect parameters in public events.
        return [{"type": "grand_austria_hotel:update", "payload": {"actor": player_id, "action": action["type"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["turn_order"]:
            player = copy.deepcopy(state["players"][pid])
            player["hand_count"] = len(player["hand"])
            if pid != viewer_id:
                player["hand"] = []
            players.append({"player_id": pid, **state["player_meta"][pid], **player})
        pending = None
        if state["pending"]:
            first = state["pending"][0]
            pending = copy.deepcopy(first) if first["owner"] == viewer_id else {"kind": first["kind"], "owner": first["owner"]}
        moves = [{**move, "revision": state["revision"]} for move in _moves(state, viewer_id)]
        keys = ("game_id", "revision", "phase", "round", "current_turn", "turn_order", "start_index",
                "dice", "market", "objectives", "claims", "emperors", "next_ready", "review", "log", "result", "game_over",
                "slots", "done", "passed", "turn", "rerolls")
        view = {key: copy.deepcopy(state[key]) for key in keys}
        view.update(you=viewer_id, players=players, pending=pending, moves=moves,
                    legal_actions=list(dict.fromkeys(move["type"] for move in moves)),
                    guest_deck_count=len(state["guest_deck"]), staff_deck_count=len(state["staff_deck"]),
                    catalog={"guests": copy.deepcopy(GUESTS), "staff": copy.deepcopy(STAFF), "rooms": copy.deepcopy(ROOMS),
                             "objectives": copy.deepcopy(OBJECTIVES), "emperors": copy.deepcopy(EMPERORS)})
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.grand_austria_hotel_ai import choose_move
        return choose_move(GrandAustriaHotelGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("game_id") != GrandAustriaHotelGame.game_id:
            raise ValueError("invalid Grand Austria Hotel save")
        return copy.deepcopy(payload)
