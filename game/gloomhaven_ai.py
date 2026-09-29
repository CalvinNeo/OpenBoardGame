"""Deterministic practice companion; only receives the owner's public view."""
from typing import Dict, Optional


def _distance(a, b):
    dq, dr = a[0] - b[0], a[1] - b[1]
    return max(abs(dq), abs(dr), abs(dq + dr))


def choose_action(view: Dict) -> Optional[Dict]:
    options = view["options"]
    if not options:
        return None
    if view["phase"] == "setup" and not any(o["type"] == "ready" for o in options):
        return None
    if view["phase"] == "planning" and not any(o["type"] in ("plan", "long_rest") for o in options):
        return None
    heroes = {h["id"]: h for h in view["heroes"]}
    cards = view["cards"]
    by_type = {}
    for action in options:
        by_type.setdefault(action["type"], []).append(action)
    for kind in ("ready", "continue", "rest_accept"):
        if kind in by_type:
            return by_type[kind][0]
    if "damage" in by_type:
        hero = heroes[view["damage"]["hero_id"]]
        if hero["hp"] > view["damage"]["amount"] + 1:
            return next(o for o in options if not o["cards"])
        burns = [o for o in options if o["cards"]]
        return min(burns, key=lambda o: (len(o["cards"]), any(cards[c]["top"][0]["kind"] == "recover" for c in o["cards"]), sum(cards[c]["initiative"] for c in o["cards"]))) if burns else options[0]
    if "rest_lose" in by_type:
        return min(by_type["rest_lose"], key=lambda o: (cards[o["card"]]["top"][0]["kind"] == "recover", -cards[o["card"]]["initiative"]))
    if "next_round" in by_type:
        # Prefer long rest for healing; short rest preserves a combat turn.
        for action in by_type.get("short_rest", []):
            hero = heroes[action["hero_id"]]
            if hero["hand_count"] < 2 and hero["hp"] >= hero["max_hp"] - 2:
                return action
        return by_type["next_round"][0]
    if "plan" in by_type or "long_rest" in by_type:
        for action in by_type.get("long_rest", []):
            hero = heroes[action["hero_id"]]
            if hero["hand_count"] < 2 or hero["hp"] <= hero["max_hp"] / 2:
                return action
        def plan_score(action):
            hero = heroes[action["hero_id"]]
            a, b = [cards[cid] for cid in action["cards"]]
            near = min((_distance(hero["pos"], m["pos"]) for m in view["monsters"]), default=5)
            def ability_score(card, half):
                value = 0
                for effect in card[half]:
                    kind, amount = effect["kind"], effect["value"]
                    if kind == "attack":
                        value += amount + min(effect.get("targets", 1), len(view["monsters"])) * .7 + effect.get("range", 1) * .4
                    elif kind == "move":
                        value += min(amount, near + 1) * 1.15
                    elif kind == "recover":
                        value += hero["lost_count"] * 3 - 7
                    elif kind == "heal":
                        value += min(amount, hero["max_hp"] - hero["hp"]) * 1.4
                    elif kind == "shield":
                        value += amount * .5
                return value - (3 if card[half + "_loss"] else 0)
            value = max(ability_score(a, "top") + ability_score(b, "bottom"), ability_score(b, "top") + ability_score(a, "bottom"))
            return value - a["initiative"] * .01
        if "plan" in by_type:
            return max(by_type["plan"], key=plan_score)
        return by_type["long_rest"][0]
    hero = heroes.get(view["current"])
    if not hero:
        return options[0]
    potions = [o for o in by_type.get("item", []) if o["item"] == "potion"]
    if potions and (hero["hp"] <= hero["max_hp"] - 3 or "poison" in hero["conditions"]):
        return potions[0]
    if "consume" in by_type:
        return by_type["consume"][0]
    if "target" in by_type:
        effect = view["active"]["effects"][view["active"]["index"]]
        if effect["kind"] == "attack":
            monsters = {m["id"]: m for m in view["monsters"]}
            return min(by_type["target"], key=lambda o: monsters[o["target"]]["hp"])
        return max(by_type["target"], key=lambda o: heroes[o["target"]]["max_hp"] - heroes[o["target"]]["hp"] + 2 * ("poison" in heroes[o["target"]]["conditions"]))
    if "move" in by_type:
        remaining = [cards[cid] for cid in hero["played"] if cid != view["active"]["card"]]
        attack_range = max([e.get("range", 1) for card in remaining for e in card["top"] if e["kind"] == "attack"] or [1])
        targets = [m["pos"] for m in view["monsters"]]
        if not targets:
            targets = [[c["q"], c["r"]] for c in view["cells"] if c["terrain"] == "door" and not c["open"]]
            attack_range = 0
        if targets:
            def desirability(pos):
                dist = min(_distance(pos, target) for target in targets)
                return max(0, dist - attack_range) * 4 + (2 if attack_range > 1 and dist <= 1 else 0)
            def move_score(o):
                pos = [o["q"], o["r"]]
                cell = next(c for c in view["cells"] if [c["q"], c["r"]] == pos)
                return desirability(pos) + (5 if cell["terrain"] == "trap" else 0) + _distance(hero["pos"], pos) * .05
            best = min(by_type["move"], key=move_score)
            if move_score(best) < desirability(hero["pos"]):
                return best
        if "skip" in by_type:
            return by_type["skip"][0]
    if "half" in by_type:
        def half_score(o):
            if o["basic"]:
                effects = [{"kind": "attack" if o["half"] == "top" else "move", "value": 2, "range": 1}]
            else:
                effects = cards[o["card"]][o["half"]]
            score = 0
            for effect in effects:
                kind, amount = effect["kind"], effect["value"]
                if kind == "attack":
                    in_range = sum(_distance(hero["pos"], m["pos"]) <= effect.get("range", 1) for m in view["monsters"])
                    score += (8 + amount + min(in_range, effect.get("targets", 1))) if in_range else -4
                elif kind == "heal":
                    score += max((min(amount, h["max_hp"] - h["hp"]) * 3 for h in heroes.values() if not h["exhausted"] and _distance(hero["pos"], h["pos"]) <= effect.get("range", 0)), default=0)
                elif kind == "recover":
                    score += hero["lost_count"] * 4 - 8
                elif kind == "move":
                    score += 5 + amount * .1
                elif kind in ("shield", "strengthen"):
                    score += 2
            if not o["basic"] and cards[o["card"]][o["half"] + "_loss"]:
                score -= 3
            return score
        return max(by_type["half"], key=half_score)
    for kind in ("skip", "end_turn", "short_rest"):
        if kind in by_type:
            return by_type[kind][0]
    return options[0]
