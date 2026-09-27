"""Deterministic, information-fair hotel planning over the player's public view."""
from typing import Dict, Optional


def choose_move(view: Dict) -> Optional[Dict]:
    moves = view["moves"]
    if not moves:
        return None
    own = next(p for p in view["players"] if p["player_id"] == view["you"])
    guests, staff, rooms = (view["catalog"][key] for key in ("guests", "staff", "rooms"))
    remaining_rounds = 8 - view["round"]
    pending = view["pending"] or {}
    next_emperor = next((r for r in (3, 5, 7) if r >= view["round"]), 7)
    turns_to_emperor = (next_emperor - view["round"]) * 2 + 1
    crown_goal = next_emperor + 3

    def need(g):
        return {key: n - g["served"].get(key, 0) for key, n in guests[g["id"]]["order"].items()}

    def room_available(color):
        return any(status == 1 and (color == "green" or rooms[i]["color"] == color)
                   for i, status in enumerate(own["rooms"]))

    def guest_value(gid):
        g = guests[gid]
        missing = sum(max(0, n - own["kitchen"][key]) for key, n in g["order"].items())
        ready = room_available(g["color"])
        reward = sum({"money": 1.7, "emperor": 2.3, "hire": 3, "draw": 1.5,
                      "occupy": 4, "prepare": 2.3, "extra_die": 6, "food": 2}.get(e["kind"], 1) * e["count"]
                     for e in g["effects"])
        return 10 + g["vp"] * .8 + reward - missing * 2.4 + (5 if ready else -7) - sum(g["order"].values()) * .35

    def occupied(color=None):
        return sum(status == 2 and (color is None or rooms[i]["color"] == color)
                   for i, status in enumerate(own["rooms"]))

    def employee_value(sid):
        fixed = {"5": 3, "6": 4, "7": 2, "8": 3, "9": 2.8, "10": 2.8, "11": 2.8,
                 "12": 3, "13": 4, "14": 4, "15": 7, "16": 4, "17": 7, "18": 2,
                 "19": 4, "20": 4, "22": 3, "23": 5, "24": 4.5, "25": 3, "26": 2,
                 "33": 3, "42": 2}
        if staff[sid]["timing"] == "round":
            return remaining_rounds * (3.2 if sid in ("2", "4") else 2.5)
        if staff[sid]["timing"] == "permanent":
            return fixed.get(sid, 2) * remaining_rounds * .65 + 1
        if staff[sid]["timing"] == "end":
            estimates = {"27": occupied("red") * 3, "28": occupied("blue") * 3,
                         "30": occupied("yellow") * 3, "31": occupied(), "32": (len(own["staff"]) + 1) * 2,
                         "34": sum(bool(x) for x in own["rooms"]), "40": len(own["objectives"]) * 5,
                         "41": max(0, own["emperor"] - 7) * 2,
                         "48": min(occupied(c) for c in ("red", "yellow", "blue")) * 4}
            if sid == "29":
                return max([employee_value(s) for p in view["players"] if p["player_id"] != view["you"]
                            for s in p["staff"] if s != "29" and staff[s]["timing"] == "end"] or [0])
            if sid in ("37", "46", "47"):
                groups = ([r["id"] for r in rooms if r["group"] == i] for i in range(10)) if sid == "37" else (
                    ([r["id"] for r in rooms if r["floor"] == i] for i in range(4)) if sid == "46" else
                    ([r["id"] for r in rooms if r["column"] == i] for i in range(5)))
                return sum(all(own["rooms"][i] == 2 for i in group) for group in groups) * (2 if sid == "37" else 5) + (remaining_rounds - 1) * .4
            return estimates.get(sid, 0) + (remaining_rounds - 1) * .5
        if sid == "35":
            return min(2, own["rooms"].count(1)) * 6
        if sid == "38":
            return max([sum(need(g).values()) * 3 for g in own["cafe"]] or [0])
        if sid == "45":
            return 4 + 3 * (own["emperor"] < crown_goal)
        return 6 + min(6, sum(sum(need(g).values()) for g in own["cafe"]))

    def room_value(rid, occupying=False):
        r = rooms[rid]
        group = [x["id"] for x in rooms if x["group"] == r["group"]]
        completed = sum(own["rooms"][i] == 2 for i in group)
        waiting = sum(guests[g["id"]]["color"] in (r["color"], "green") for g in own["cafe"])
        vacant = sum(status == 1 and rooms[i]["color"] == r["color"] for i, status in enumerate(own["rooms"]))
        color_bonus = 2 if r["color"] == "yellow" and own["emperor"] < crown_goal else 0
        adjacency = sum(own["rooms"][j] == 0 and abs(r["floor"] - rooms[j]["floor"]) + abs(r["column"] - rooms[j]["column"]) == 1 for j in range(20))
        if occupying:
            return 4 + r["floor"] + (10 + color_bonus if completed == len(group) - 1 else completed * 1.5)
        cost = max(0, r["floor"] - pending.get("discount", 0))
        if {"blue": "9", "red": "10", "yellow": "11"}[r["color"]] in own["staff"]:
            cost = 0
        return 5 + max(0, waiting - vacant) * 5 + (3 if not vacant else -vacant * 2) + completed * 2 + r["bonus"] - cost * 2 + adjacency * .5 + color_bonus

    def food_value(resource):
        demand = sum(need(g).get(resource, 0) for g in own["cafe"])
        stocked = own["kitchen"][resource]
        return 4.5 if demand > 0 else 1.4 if stocked < 2 and remaining_rounds > 1 else .6

    def score(move):
        kind = move["type"]
        if kind == "next_round":
            return 1000
        if kind == "claim":
            return 990
        if kind == "check_in":
            return 950 + room_value(move["room"], True)
        if kind == "use_staff":
            return 800
        if kind == "resolve":
            e = pending["effects"][move["effect"]]
            return {"money": 12 if own["money"] < 15 else 0, "emperor": 5, "draw": 8,
                    "hire": 7, "food": 6, "prepare": 4, "occupy": 3, "guest": 2}.get(e["kind"], 1)
        if kind in ("gain_food", "serve_item"):
            if move["guest"] is None:
                return food_value(move["food"])
            guest = next(g for g in own["cafe"] if g["id"] == move["guest"])
            return 70 - sum(need(guest).values()) * 3 + (10 if room_available(guests[guest["id"]]["color"]) else 0)
        if kind == "store_food":
            return 0
        if kind == "serve":
            useful = max([sum(min(n, own["kitchen"][key]) for key, n in need(g).items()) for g in own["cafe"]] or [0])
            can_complete = any(sum(need(g).values()) <= 3 and all(n <= own["kitchen"][k] for k, n in need(g).items())
                               and room_available(guests[g["id"]]["color"]) for g in own["cafe"])
            return 600 if can_complete else 100 if useful >= 2 or "24" in own["staff"] else -5
        if kind in ("recruit", "take_guest"):
            value = guest_value(view["market"][move["slot"]])
            if view["phase"] == "setup_guest":
                return value
            fee = 0 if kind == "take_guest" or "25" in own["staff"] else (3, 2, 1, 0, 0)[move["slot"]]
            # Do not clog the cafe with impossible final-round contracts.
            if remaining_rounds == 1:
                g = guests[view["market"][move["slot"]]]
                if any(own["kitchen"][k] < n for k, n in g["order"].items()) or not room_available(g["color"]):
                    return -20
            return (65 if not own["cafe"] else 27 if len(own["cafe"]) == 1 else -10) + value - fee * 3
        if kind == "prepare":
            return room_value(move["room"])
        if kind == "occupy":
            return 100 + room_value(move["room"], True)
        if kind == "hire":
            cost = max(0, staff[move["staff"]]["cost"] - pending.get("discount", 0))
            return employee_value(move["staff"]) - cost * (2 if own["money"] < 6 else 1.2)
        if kind == "complete":
            guest = next(g for g in own["cafe"] if g["id"] == move["guest"])
            return sum(need(guest).values()) * 3 + (5 if room_available(guests[guest["id"]]["color"]) else 0)
        if kind == "return_staff" or kind == "remove_staff":
            return -employee_value(move["staff"])
        if kind == "remove_room":
            return -room_value(move["room"], pending.get("status") == 2)
        if kind == "avoid_penalty":
            return 10
        if kind in ("dice", "bonus_die"):
            face, target = move["face"], move["action"]
            applicable = own["staff"] if kind == "dice" else []
            strength = view["dice"][face - 1] + int(move["boost"])
            strength += int(face in (1, 2) and "13" in applicable) + int(face == 6 and "17" in applicable) + 2 * int(face == 5 and "18" in applicable)
            fee = int(move["boost"]) + int(face == 6 and "17" not in applicable)
            value = -fee * (3 if own["money"] < 5 else 1.5)
            if target in (1, 2):
                pair = ("strudel", "cake") if target == 1 else ("wine", "coffee")
                for key, amount in zip(pair, (strength - move["split"], move["split"])):
                    demand = sum(need(g).get(key, 0) for g in own["cafe"])
                    value += min(amount, demand) * 5 + max(0, amount - demand) * .8
                if "14" in applicable and face in (1, 2):
                    value += 4
            elif target == 3:
                deficit = sum(not room_available(guests[g["id"]]["color"]) for g in own["cafe"])
                value += min(strength, deficit + max(0, 3 - own["rooms"].count(1))) * 4 + deficit * 5
                if "19" in applicable and face == 3:
                    value += 5
            elif target == 4:
                both = face == 4 and "15" in applicable
                crowns = strength if both else move["split"]
                money = strength if both else strength - move["split"]
                danger = max(0, next_emperor + 1 - own["emperor"])
                valuable = max(0, crown_goal - own["emperor"])
                value += min(crowns, danger) * (5.5 / turns_to_emperor + 1)
                value += min(max(0, crowns - danger), max(0, valuable - danger)) * 2.2
                value += max(0, crowns - valuable) * .5
                value += min(money, max(0, 8 - own["money"])) * 2.9 + max(0, min(money, 20 - own["money"]) - max(0, 8 - own["money"]))
                if "16" in applicable and face == 4:
                    value += 4
            else:
                value += max([employee_value(sid) - max(0, staff[sid]["cost"] - strength) * 1.8
                              for sid in own["hand"] if max(0, staff[sid]["cost"] - strength) <= own["money"] - fee] or [0])
                if "20" in applicable and face == 5:
                    value += 4
            if face in (3, 4) and "12" in applicable:
                value += 2
            return value + (0.1 if move["timing"] == "before" else 0)
        if kind == "pass":
            return 2 if sum(view["dice"]) > 2 else -10
        if kind == "end_turn":
            return -1
        if kind in ("skip", "accept_penalty"):
            return -.5
        return 0

    return max(moves, key=score)
