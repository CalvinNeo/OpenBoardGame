"""Deterministic Orloj planner using only the player's public view.

Scores legal choices by resources, worker tempo, connected construction, mastery
thresholds and final objectives. No future deck order or server RNG is inspected.
"""
import copy
from typing import Dict, Optional

from game.orloj_data import BASIC, HAMMERS, WORKSHOPS, APOSTLE_SLOTS, APOSTLES, PRIMARY_MULTIPLIER
from game.orloj import group_size, mastery_level, payment_options, construction_cost


def choose_move(view: Dict) -> Optional[Dict]:
    moves = view.get("moves", [])
    if not moves:
        return None
    p = next(p for p in view["players"] if p["player_id"] == view["you"])
    pending = view["pending"][0] if view["pending"] else {}
    early = max(0.15, 1 - view["calls"] / 4)
    if view["finishing"]:
        early = 0
    stock = p["resources"]

    def resource_value(key):
        n = stock[key]
        if key == "gold":
            return 3.6 if n == 0 else 2.4 if n < 3 else 0.8
        if key == "coin":
            return 2.5 if n < 2 else 1.2 if n < 5 else 0.6
        return 2.7 if n == 0 else 1.9 if n < 3 else .8 if n < 6 else .25

    def payment_value(payment):
        return sum(resource_value(key) * count for key, count in payment.items())

    def mastery_value(track):
        height = p["mastery"][track]
        if height == 12:
            return .8
        value = 1.3 + early * 1.5
        if height in (3, 8):
            value += 3.7
        if height == 5:
            value += 3.5
        if height == 11 and view["royals"][track]:
            value += min(10, p["metrics"][view["royals"][track]] * PRIMARY_MULTIPLIER[view["royals"][track]])
        if height == 6:
            value += min(10, p["metrics"][view["windows"][track]] * 1.5)
        if track == "blue" and height in (2, 3, 6, 9):
            value += early * 2
        if track == "pink" and height in (4, 9):
            value += early * 3
        # Prefer two developing tracks, while reacting to the public window.
        value += min(2, height * .16) + p["metrics"][view["windows"][track]] * .12
        return value

    def upgrade_value(track):
        if track == "hammer":
            return (4.7 if p["hammer_level"] == 0 else 2.8) * early + .4
        level = p["production"][track]
        if level == 3:
            return resource_value("gold") + 1
        unlock = level == min(p["production"].values()) and list(p["production"].values()).count(level) == 1
        return (3.9 + resource_value(track) * .6 + 3 * unlock) * early + .5

    def apostle_value(number=None):
        if len(p["warehouse"]) + int(p["assistant"] is not None) >= 2:
            return 0
        if number is None:
            return 4.1 + early if len(p["warehouse"]) < 1 else 2.5
        color = APOSTLES[str(number)]["color"]
        scores = []
        for i, slot in enumerate(APOSTLE_SLOTS):
            if slot["color"] != color or p["panel"][i] is not None:
                continue
            row = p["panel"][i // 4 * 4:i // 4 * 4 + 4]
            col = p["panel"][i % 4::4]
            value = 4 + sum(n is not None for n in row) + sum(n is not None for n in col) * .8
            if slot["reward"] == "worker":
                value += 2.5 * early
            if any(APOSTLES[str(n)]["color"] == color for n in p["warehouse"]):
                value -= 2
            scores.append(value)
        return max(scores, default=0)

    def effect_value(e, depth=0):
        if depth > 3:
            return 1
        kind = e["kind"]
        count = e.get("count", 1)
        if kind == "gain":
            return sum(resource_value(key) * n for key, n in e["items"].items())
        if kind == "vp":
            return count
        if kind == "repair":
            return min(p["deviation"], count) * 1.6
        if kind == "produce":
            def production(key):
                level = p["production"][key]
                return resource_value(key) * (1 if level == 0 else 2) + (max(resource_value(k) for k in BASIC) if level == 2 else resource_value("gold") if level == 3 else 0)
            return production(e["resource"]) if "resource" in e else max(production(k) for k in BASIC)
        if kind == "mastery":
            return count * (mastery_value(e["track"]) if "track" in e else max(mastery_value(t) for t in p["mastery"]))
        if kind == "paid_mastery":
            return max(0, max(mastery_value(t) for t in p["mastery"]) - resource_value("coin")) if stock["coin"] else 0
        if kind == "upgrade":
            return max(upgrade_value(k) for k in BASIC + (("hammer",) if p["hammer_level"] < 2 else ()))
        if kind == "any_resource":
            return count * max(resource_value(k) for k in BASIC)
        if kind == "apostle":
            return apostle_value()
        if kind == "rooster":
            return (4 - view["calls"]) * .7 + p["deviation"] * .4 if p["rooster"] < 4 else 1 + resource_value("gold")
        if kind == "moon":
            steps = mastery_level(p["mastery"]["yellow"]) + 2 + e.get("modifier", 0)
            value, debt = 0, p["deviation"]
            for i in range(1, max(0, steps) + 1):
                reward = view["catalog"]["moon"][(view["moon"] + i) % 12]
                if reward == "repair":
                    value += 2 if debt else .1
                    debt = max(0, debt - 1)
                else:
                    value += resource_value(reward)
            return value
        if kind in ("painter", "forced_painter"):
            positions = [(view["painter"] - n + side) % 12 for n in range(1, mastery_level(p["mastery"]["yellow"]) + 3) for side in (0, 1)]
            return max(sum(effect_value(x, depth + 1) for x in view["calendar"][pos]) for pos in positions)
        if kind == "moon_painter":
            return max(effect_value({"kind": "moon"}, depth + 1), effect_value({"kind": "painter"}, depth + 1))
        if kind == "assistant_moon":
            return max(effect_value({"kind": "assistant"}), effect_value({"kind": "moon"}))
        if kind == "assistant":
            return 6 if p["assistant"] is None and len(p["warehouse"]) < 2 and any(w["assistant"] is None for w in p["workshops"]) else 1
        if kind == "workshop":
            affordable = []
            for i, key in enumerate(view["market"]):
                if key is None:
                    continue
                card = WORKSHOPS[key]
                cost = {"paint": 1}
                cost[card["resource"]] = cost.get(card["resource"], 0) + 3 - i
                if payment_options(stock, cost):
                    affordable.append(4 + 3 * early + 2 * (i not in p["market_workers"]))
            return max(affordable, default=.3)
        if kind == "build":
            if not p["workers"]:
                return 0
            best = 0
            for zone in ("months", "zodiac"):
                for slot, cell in enumerate(view["board"][zone]):
                    if cell["built"] or not payment_options(stock, construction_cost(zone, slot)):
                        continue
                    neighbors = sum(view["board"][zone][j % 12]["owner"] == view["you"] for j in (slot - 1, slot + 1))
                    best = max(best, 9 + neighbors * 2)
            return best
        if kind == "sculptor":
            return resource_value("gold") + resource_value("coin") - (1 if p["mastery"]["pink"] < 10 else -2)
        if kind == "recover":
            available = sum(owner == view["you"] for owner in view["clock_workers"])
            return min(available, count) * (3 if p["workers"] < 2 else .5)
        if kind == "scroll":
            return 4
        return 0

    def score(m):
        kind = m["type"]
        if kind == "next_round":
            return 1000
        if kind == "skip":
            return -20
        if kind == "end_turn":
            return -10
        if kind == "claim":
            return 40 - len(view["claims"][m["objective"]]) * 3
        if kind == "exchange":
            return 1 if stock["gold"] == 0 and not view["finishing"] and m["payment"].get("coin", 0) == 0 else -30
        if kind == "place_apostle":
            slot = APOSTLE_SLOTS[m["slot"]]
            row = p["panel"][slot["row"] * 4:slot["row"] * 4 + 4]
            col = p["panel"][slot["column"]::4]
            reward = slot["reward"]
            value = 7 + sum(n is not None for n in row) * 1.8 + sum(n is not None for n in col)
            value += (5 * early if reward == "worker" else effect_value({"kind": reward, "count": 2}) if reward != "coin" else resource_value("coin"))
            return value - payment_value(m["payment"])
        if kind == "place_assistant":
            estimates = {"scholar": 6, "engineer": p["metrics"]["upgrades"] + 2 * early,
                         "master": 4 * sum(n >= 9 for n in p["mastery"].values()),
                         "carver": 5 * sum(sum(n is not None for n in p["panel"][i::4]) >= 2 for i in range(4)),
                         "calendar": 3 * p["metrics"]["months"], "astronomer": 3 * p["metrics"]["zodiac"]}
            return 6 + estimates[p["assistant"]] - payment_value(m["payment"])
        if kind == "use_scroll":
            return 1 + sum(effect_value(e) for e in view["catalog"]["scrolls"][p["scrolls"][m["index"]]["kind"]])
        if kind == "clock":
            pos = (view["hand"] + m["steps"]) % 12
            inner = (pos - view["face"] + m["rotate"]) % 12
            effects = view["catalog"]["outer"][pos] + view["catalog"]["inner"][inner]
            value = sum(effect_value(e) for e in effects)
            debt = max(0, m["steps"] - mastery_level(p["mastery"]["blue"])) + m["rotate"]
            value -= debt * (1.7 + p["deviation"] * .45 + (1 if view["rooster"] <= 1 else 0))
            if p["workers"] == 1 and any(e["kind"] == "build" for e in effects) and view["clock_workers"][pos] != view["you"]:
                value -= effect_value({"kind": "build"})
            if m["first"] == "inner":
                value += .35 if any(e["kind"] == "produce" for e in view["catalog"]["inner"][inner]) else -.1
            return value - .8
        if kind == "pass":
            recovery = sum(owner == view["you"] for owner in view["clock_workers"])
            value = effect_value({"kind": "moon"}) - 3
            value += min(recovery, 2) * (3.5 if p["workers"] <= 1 else .3)
            value += max(0, p["turns"] - 35) * 1.5
            return value
        if kind == "resolve":
            return effect_value(pending["effects"][m["index"]]) + (2 if pending["effects"][m["index"]]["kind"] == "gain" else 0)
        if kind == "accept":
            return effect_value(pending)
        if kind == "choose":
            return effect_value({"kind": m["option"]})
        if kind == "upgrade":
            return upgrade_value(m["track"])
        if kind == "mastery":
            return mastery_value(m["track"]) - (resource_value("coin") if pending["kind"] == "paid_mastery" else 0)
        if kind == "produce":
            return effect_value({"kind": "produce", "resource": m["resource"]})
        if kind == "any_resource":
            return resource_value(m["resource"])
        if kind == "painter":
            pos = (view["painter"] - m["steps"] + int(m["side"] == "left")) % 12
            return sum(effect_value(e) for e in view["calendar"][pos])
        if kind == "recover":
            if m["zone"] == "clock":
                distance = (m["slot"] - view["hand"]) % 12
                return 5 + distance * .08
            return -3 if p["workers"] else 1
        if kind == "take_apostle":
            return apostle_value(m["apostle"]) - m["steps"] * (1.6 + p["deviation"] * .3)
        if kind == "take_scroll":
            return sum(effect_value(e) for e in view["catalog"]["scrolls"][view["scroll_market"][m["index"]]])
        if kind == "take_assistant":
            values = {"scholar": 6, "engineer": p["metrics"]["upgrades"] + 2,
                      "master": 4 * sum(n >= 8 for n in p["mastery"].values()),
                      "carver": 5 * sum(sum(n is not None for n in p["panel"][i::4]) >= 2 for i in range(4)),
                      "calendar": 3 * p["metrics"]["months"] + 1,
                      "astronomer": 3 * p["metrics"]["zodiac"] + 1}
            return values[m["assistant"]]
        if kind == "workshop":
            card = WORKSHOPS[view["market"][m["index"]]]
            value = 4 + early * 3 + sum(effect_value(e) for e in card["reward"]) - payment_value(m["payment"])
            if m["index"] not in p["market_workers"]:
                value += 3 * early
            if p["workshops"]:
                neighbor = WORKSHOPS[p["workshops"][0 if m["side"] == "left" else -1]["card"]]
                seam, other = (card["right"], neighbor["left"]) if m["side"] == "left" else (card["left"], neighbor["right"])
                if seam == other:
                    value += effect_value({"kind": seam})
            return value
        if kind == "build":
            if m["zone"] == "final":
                return 8 - payment_value(m["payment"])
            board = copy.deepcopy(view["board"])
            board[m["zone"]][m["slot"]]["owner"] = view["you"]
            capacity = HAMMERS[p["hammer"]]["moves"][p["hammer_level"]]
            value = 6 + group_size(board, m["zone"], m["slot"], view["you"]) * 2
            value += sum(effect_value(e) for e in view["calendar"][m["slot"]])
            value += 2 + p["hammer_level"] - payment_value(m["payment"])
            return value - max(0, m["steps"] - capacity) * 2
        if kind == "sculptor":
            level = 3 if p["mastery"]["pink"] >= 10 else 2 if p["mastery"]["pink"] >= 5 else 1
            if m["index"] == 3:
                return effect_value({"kind": m["option"]}) + (2 if level > 1 else 0) - (1.7 if m["option"] == "painter" and level < 3 else 0)
            if m["index"] == 2:
                return resource_value("gold") + resource_value("coin") * level - (1.7 if level < 3 else -1)
            return effect_value({"kind": "workshop" if m["index"] == 0 else "build"}) + (2 if level > 1 else -2)
        return -5

    return copy.deepcopy(max(moves, key=score))
