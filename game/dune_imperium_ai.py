"""Local, deterministic strategy using only the requesting player's view.

No rule-state import, hidden decks, opponents' hands, or random generator access.
"""
from typing import Dict, Optional


def choose_move(view: Dict) -> Optional[Dict]:
    moves = view["moves"]
    if not moves:
        return None
    pid = view["you"]
    own = next(p for p in view["players"] if p["player_id"] == pid)
    opponents = [p for p in view["players"] if p["player_id"] != pid]
    cards, spaces = view["catalog"]["cards"], view["catalog"]["spaces"]
    round_no = view["round"]
    remaining = max(1, 11 - round_no)
    phase = view["phase"]
    vp_value = 17 + min(10, round_no)

    def card(uid):
        return cards[view["cards"][uid]]

    def resource(key, n=1):
        values = {"vp": vp_value, "water": 5.5 if own["water"] < 2 else 2.5,
                  "spice": 2.2 if own["spice"] < 6 else 1.2,
                  "solari": 2.1 if not own["swordmaster"] and own["solari"] < 8 and round_no <= 6 else 1.2,
                  "troops": 1.8 if own["garrison"] + own["troops"] < 8 else .6,
                  "intrigue": 4.5, "draw": 4.4 if own["agents"] else 2.8,
                  "persuasion": 1.3, "swords": .75 if own["troops"] else .1}
        if key == "troops":
            n = min(n, 12 - own["garrison"] - own["troops"])
        return values.get(key, 0) * n

    def faction_value(f, amount=1):
        start = own["influence"][f]
        finish = min(6, start + amount)
        if finish <= start:
            return 0
        rivals = max(p["influence"][f] for p in opponents)
        value = (finish - start) * (3.6 if finish <= 4 else 1)
        if start < 2 <= finish:
            value += vp_value
        elif finish == 1:
            value += 5 if remaining > 2 else 1
        owner = view["alliances"][f]
        if finish >= 4 and owner != pid and (owner is None or finish > rivals):
            value += vp_value + 4
        elif finish == 3 and rivals < 5:
            value += 5
        if owner == pid and start == rivals:
            value += 3
        return value

    def effect_value(e):
        kind = e["kind"]
        if kind == "gain":
            return sum(resource(k, v) for k, v in e["values"].items())
        if kind == "influence":
            fs = [e["faction"]] if e["faction"] != "any" else [f for f in own["influence"] if f != e.get("exclude")]
            if e.get("behind"):
                fs = [f for f in fs if any(p["influence"][f] > own["influence"][f] for p in opponents)]
            return max([faction_value(f, e["amount"]) for f in fs] or [0])
        if kind == "conditional":
            condition = e["condition"]
            if condition == "alliance":
                factor = int(view["alliances"][e["faction"]] == pid)
            elif condition == "influence":
                factor = int(own["influence"][e["faction"]] >= e["amount"])
            else:
                f = "fremen" if condition == "bond" else "bene"
                factor = int(any(c != e.get("source") and f in card(c)["factions"] for c in own["played"] + own["revealed"]))
            return factor * sum(effect_value(x) for x in e["effects"])
        if kind == "pay":
            if not all(own.get(k, 0) >= n for k, n in e["cost"].items()):
                return 0
            return max(0, sum(effect_value(x) for x in e["effects"]) - sum(resource(k, n) for k, n in e["cost"].items()))
        if kind == "choice":
            return max(effect_value(x) for x in e["options"])
        if kind == "harvest":
            return resource("spice", e["amount"])
        if kind == "swordmaster":
            return max(8, remaining * 6.2)
        if kind == "council":
            return remaining * 3.2 + 4
        if kind == "mentat":
            return 7 if own["hand_count"] >= len(own["agents"]) + 1 else 2
        if kind == "ring":
            return {"paul": 4.4, "leto": 14, "rabban": 3.6, "baron": 3, "ilban": 2.1,
                    "ariana": resource("water"), "memnon": resource("spice"), "helena": 3}.get(own["leader"], 2)
        if kind == "trash":
            return 3.4 if round_no < 7 else 1
        if kind == "breeding":
            return 11
        if kind == "two_factions":
            return sum(sorted([faction_value(f) for f in own["influence"]], reverse=True)[:2])
        if kind == "discount":
            return 5
        if kind == "deploy":
            return 3 if own["garrison"] else 0
        if kind == "recruit_deploy":
            return 7
        if kind in ("trash_self", "retreat"):
            return 0
        return {"foldspace": 3, "memory": 5, "shift": 8, "voice": 3, "spy": 3,
                "enemy_discard": 5, "test_humanity": 4, "steal": 2, "carryall": 4,
                "corner_market": 25, "plans": 25, "staged": vp_value - 5}.get(kind, 2)

    def reward_value(rank):
        if not view["conflict"]:
            return 0
        if rank >= (3 if len(view["order"]) == 4 else 2):
            return 0
        c = view["catalog"]["conflicts"][view["conflict"]]
        result = sum(effect_value(e) for e in c["rewards"][rank])
        if rank == 0 and c["control"]:
            result += remaining * 1.1
        return result

    def combat_value(total):
        if total <= 0:
            return 0
        others = [p["strength"] for p in opponents]
        higher = sum(s > total for s in others)
        tied = any(s == total for s in others)
        return reward_value(higher + int(tied))

    def purchase_value(uid):
        c, k = card(uid), view["cards"][uid]
        if k == "spice_must_flow":
            return vp_value + (7 if own["vp"] >= 8 else 0)
        value = c["cost"] * .8 + len(c["icons"]) * .9
        value += sum(effect_value(e) for e in c["reveal"]) * .55
        value += sum(effect_value(e) for e in c["agent"]) * .45
        value += sum(effect_value(e) for e in c["acquire"])
        if k in ("kwisatz_haderach", "lady_jessica"):
            value += remaining * 1.7
        owned = own.get("deck_composition", []) + [view["cards"][u] for u in own["hand"] + own["discard"] + own["played"] + own["revealed"]]
        for faction in c["factions"]:
            value += min(3, sum(faction in cards[t]["factions"] for t in owned)) * .45
        if not c["acquire"]:
            value *= min(1, remaining / 4)
        return value - 3

    def trash_value(uid):
        k = view["cards"][uid]
        weights = {"assassination_mission": 11, "dagger": 7, "convincing_argument": 5,
                   "dune": 6, "reconnaissance": 4, "seek_allies": 1,
                   "spice_must_flow": 2, "signet_ring": -5, "diplomacy": -2, "foldspace": -3}
        value = weights.get(k, -card(uid)["cost"] - 3)
        if uid in own["hand"] and own["agents"]:
            value -= 3
        return value

    def choose_score(value):
        c = view["choice"]
        e, mode = c["effect"], c["mode"]
        if mode == "pay":
            return effect_value(e) if value else .01
        if mode == "choice":
            return effect_value(e["options"][value])
        if mode == "influence":
            return faction_value(value, e["amount"])
        if mode in ("trash", "breeding"):
            return (trash_value(value) + (7 if mode == "breeding" else 0)) if value else 0
        if mode in ("deploy", "deployment"):
            current = own["strength"]
            total = (own["troops"] + value) * 2 + own["swords"] if own["troops"] + value else 0
            expected = combat_value(total) - combat_value(current)
            # Early commitments should reserve a small margin against visible rivals.
            margin = min(value, 2) * 1.1 if any(not p["done"] and p["player_id"] != "hagal" for p in opponents) else 0
            return expected + margin - value * (1.1 if round_no < 6 else .55)
        if mode == "retreat":
            total = (own["troops"] - value) * 2 + own["swords"] if own["troops"] > value else 0
            return combat_value(total) + value * 1.3
        if mode == "discard":
            return (4 if combat_value(own["strength"] - 2) == combat_value(own["strength"]) else -8) if value == "lose_troop" else trash_value(value)
        if mode == "spy":
            return 4 if value else 0
        if mode == "baron_power":
            return 20 if value else 0
        if mode == "defense":
            return int(value)
        if mode == "memory":
            return 4 if value == "draw" else purchase_value(value)
        if mode == "shift":
            if value is None:
                return 0
            a, b = value
            lost = vp_value if own["influence"][a] == 2 else 3
            if view["alliances"][a] == pid and (own["influence"][a] == 4 or any(p["influence"][a] >= own["influence"][a] for p in opponents)):
                lost += vp_value
            return faction_value(b, 2) - lost - resource("spice", 2)
        if mode == "voice":
            return {"heighliner": 9, "swordmaster": 7, "stillsuits": 5, "arrakeen": 4}.get(value, 0) - 12 * bool(view["occupied"][value])
        if mode == "reserve_card":
            return purchase_value(value) if value else 0
        if mode == "two_factions":
            return sum(faction_value(f) for f in value)
        if mode == "alliance_choice":
            return -next(p["vp"] for p in view["players"] if p["player_id"] == value)
        if mode == "bindu":
            return 0 if value else 1
        if mode == "bypass":
            return purchase_value(value["card"]) - resource("spice", 2) * value["top"]
        if mode == "double_cross":
            return next(p["strength"] for p in opponents if p["player_id"] == value)
        if mode == "snooper":
            if value == "draw":
                return 4
            return trash_value(c["peek"])
        if mode == "recall":
            return 3 if value["space"] == "arrakeen" else 2 if value["space"] == "stillsuits" else 1
        return 0

    def score(m):
        kind = m["type"]
        if kind in ("next_round", "endgame_done"):
            return -50 if kind == "endgame_done" else 100
        if kind == "leader":
            return {"leto": 10, "helena": 9, "baron": 8, "paul": 7, "ilban": 6, "rabban": 5, "memnon": 4, "ariana": 3}[m["leader"]]
        if kind == "baron":
            return sum({"emperor": 2, "guild": 3, "bene": 1, "fremen": 4}[f] for f in m["factions"])
        if kind == "choose":
            return choose_score(m["choice"])
        if kind == "resolve":
            e = view["effects"][m["index"]]
            priority = {"gain": 100, "influence": 95, "harvest": 95, "conditional": 93,
                        "liet": 93, "ring": 90, "trash_self": 10, "trash": 20, "deployment": 0}.get(e["kind"], 60)
            return 200 + priority + effect_value(e) * .1
        if kind == "intrigue":
            key = next(i["kind"] for i in own["intrigues"] if i["id"] == m["card"])
            d = view["catalog"]["intrigues"][key]
            if phase == "endgame":
                return 500
            if phase == "combat":
                if key == "staged_incident":
                    return 30 + combat_value(own["strength"] - 6) - combat_value(own["strength"])
                boost = {"ambush": 4, "allied_armada": 7, "private_army": 5, "master_tactician": 3, "tiebreaker": 2}.get(key, 0)
                improvement = combat_value(own["strength"] + boost) - combat_value(own["strength"])
                return improvement - sum(resource(k, n) for k, n in d["cost"].items()) - 1.5
            if phase == "rewards":
                return 100
            if view["effects"]:
                return 0
            value = sum(effect_value(e) for e in d["effects"]) - sum(resource(k, n) for k, n in d["cost"].items())
            if key in ("dispatch_envoy", "infiltrate"):
                return -10  # Save access tricks until the usual options are exhausted.
            if key == "urgent_mission":
                return 70 if own["hand_count"] >= 2 and not own["agents"] else -10
            if key in ("charisma", "recruitment_mission"):
                return 80 if view["turn"] and view["turn"]["mode"] == "reveal" else -5
            return 60 + value if value > 1 else -5
        if kind == "buy":
            # Best immediate pair from the visible row; never inspects the next card.
            cost = max(0, card(m["card"])["cost"] - (own.get("discount", 0) if view["cards"][m["card"]] == "spice_must_flow" else 0) - int(m["card"] in own["reserved"]))
            value = purchase_value(m["card"])
            alternatives = [x for x in moves if x["type"] == "buy" and x["card"] != m["card"] and card(x["card"])["cost"] <= own["persuasion"] - cost]
            value += max([max(0, purchase_value(x["card"])) for x in alternatives] or [0]) * .65
            return value + (1 if m["top"] else 0)
        if kind in ("end_turn", "pass"):
            return 0
        if kind == "reveal":
            persuasion = own["persuasion"] + 2 * own["council"] + sum(sum(e.get("values", {}).get("persuasion", 0) for e in card(u)["reveal"]) for u in own["hand"])
            return 8 if persuasion >= 9 and round_no >= 6 else -5
        if kind == "agent":
            s, c = spaces[m["space"]], card(m["card"])
            cost = dict(s["cost"])
            if own["leader"] == "leto" and s["icon"] == "landsraad" and cost.get("solari"):
                cost["solari"] -= 1
            value = 5 + sum(effect_value(e) for e in s["effects"] + c["agent"])
            if s["icon"] in own["influence"]:
                value += faction_value(s["icon"], 2 if view["cards"][m["card"]] == "power_play" else 1)
            value -= sum(resource(k, n) for k, n in cost.items())
            if m["space"] == "sell_melange":
                value += resource("solari", {2: 6, 3: 8, 4: 10, 5: 12}[m["amount"]]) - resource("spice", m["amount"])
            if s.get("maker"):
                value += resource("spice", view["spice_bonus"][m["space"]])
            if s["combat"] and own["garrison"]:
                total = own["strength"] + 2 * min(2, own["garrison"])
                value += max(0, combat_value(total) - combat_value(own["strength"])) * .5
            value -= sum(effect_value(e) for e in c["reveal"]) * .5
            if own["leader"] == "ilban" and cost.get("solari"):
                value += 4.4
            # Preserve the only faction-access card for an available scoring visit.
            if len(c["icons"]) >= 4 and s["icon"] not in own["influence"]:
                value -= 4
            return value
        return 0

    return max(moves, key=score)
