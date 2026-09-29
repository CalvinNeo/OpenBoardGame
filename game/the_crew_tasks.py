"""Pure task evaluators. Only irreversible success is reported before hand end."""

from typing import Dict, List


def evaluate_task(task: Dict, owner: str, tricks: List[Dict], seats: List[str],
                  captain: str, total_tricks: int, prediction=None) -> str:
    won = [t for t in tricks if t["winner"] == owner]
    cards = [c["card"] for t in won for c in t["plays"]]
    all_cards = [c["card"] for t in tricks for c in t["plays"]]
    captured = {c["id"] for c in cards}
    played = {c["id"] for c in all_cards}
    end = len(tricks) >= total_tricks
    remaining = total_tricks - len(tricks)
    kind = task["kind"]
    status = lambda ok, failed=False: "failed" if failed or (end and not ok) else "complete" if ok else "pending"
    exact = lambda count, target: status(end and count == target, count > target)
    if kind == "winCards":
        targets = set(task["cards"])
        if task.get("inTrick") == 0:
            early = {c["card"]["id"] for t in tricks if t["number"] != total_tricks for c in t["plays"]}
            return status(targets <= captured and end, bool(targets & early or (targets & played) - captured))
        return status(targets <= captured, bool((targets & played) - captured))
    if kind in ("winValue", "winColor", "winSubmarines"):
        def matches(c):
            return (c["suit"] != "trump" and c["rank"] == task["value"] if kind == "winValue" else
                    c["suit"] == ("trump" if kind == "winSubmarines" else task["suit"]))
        count = sum(matches(c) for c in cards)
        available = (4 if kind in ("winValue", "winSubmarines") else 9) - sum(matches(c) for c in all_cards)
        target = task["count"]
        bad = task.get("onlyCard") and any(c["suit"] == "trump" and c["id"] != task["onlyCard"] for c in cards)
        if bad or count + available < target: return "failed"
        if task["op"] == "exact":
            return status(count == target and (end or available == 0), count > target)
        return status(count >= target)
    if kind == "winColors":
        results = [evaluate_task({"kind": "winColor", **part}, owner, tricks, seats, captain, total_tricks) for part in task["parts"]]
        return "failed" if "failed" in results else "complete" if all(r == "complete" for r in results) else "pending"
    if kind == "avoid":
        suits = task.get("suits", [task["suit"]] if "suit" in task else ["trump"] if task.get("submarines") else [])
        values = task.get("values", [task.get("value")])
        bad = lambda c: c["suit"] in suits or (c["suit"] != "trump" and c["rank"] in values)
        total = len(suits) * 9 if suits and "trump" not in suits else 4 if task.get("submarines") else len(values) * 4
        return status(end or sum(bad(c) for c in all_cards) == total, any(bad(c) for c in cards))
    if kind == "winWith":
        for trick in won:
            win = next(p["card"] for p in trick["plays"] if p["player_id"] == owner)
            tool = win["suit"] == "trump" if task.get("suit") == "trump" else win["suit"] != "trump" and win["rank"] == task["value"]
            other = [p["card"] for p in trick["plays"] if p["player_id"] != owner]
            target = (any(c["id"] == task["captureCard"] for c in other) if "captureCard" in task else
                      any(c["suit"] != "trump" and c["rank"] == task["captureValue"] for c in other) if "captureValue" in task else True)
            if tool and target: return "complete"
        return status(False, task.get("captureCard") in played)
    if kind in ("trickCount", "predictTricks"):
        target = task.get("count") if kind == "trickCount" else prediction
        if target is None: return "pending"
        return "failed" if len(won) + remaining < target else exact(len(won), target)
    if kind == "skipFirstTricks":
        return status(len(tricks) >= task["count"], any(t["number"] <= task["count"] for t in won))
    if kind == "nthTrick":
        needed = {total_tricks} if task["n"] == 0 else set(range(1, task.get("count", 1) + 1))
        if task.get("alsoLast"): needed.add(total_tricks)
        wins = {t["number"] for t in won}
        bad = any(t["number"] in needed and t["winner"] != owner for t in tricks)
        if task.get("only"): bad = bad or bool(wins - needed)
        return status(needed <= wins and (not task.get("only") or end), bad)
    if kind == "consecutiveTricks":
        streak = longest = 0
        for trick in tricks:
            streak = streak + 1 if trick["winner"] == owner else 0
            longest = max(streak, longest)
        target = task["count"]
        if task["op"] == "none": return status(end, longest >= target)
        if task["op"] == "exact":
            # Exact consecutive cards mean the only tricks won in the hand.
            gaps = len(won) >= 2 and won[-1]["number"] - won[0]["number"] + 1 != len(won)
            return status(end and len(won) == target and longest == target, len(won) > target or gaps)
        return status(longest >= target)
    if kind == "compareTricks":
        counts = {p: sum(t["winner"] == p for t in tricks) for p in seats}
        others = [counts[p] for p in seats if p != owner]
        targets = [counts[captain]] if task["vs"] == "captain" else [sum(others)] if task["vs"] == "othersCombined" else others
        compare = {"moreThan": lambda a, b: a > b, "fewerThan": lambda a, b: a < b, "equalTo": lambda a, b: a == b}[task["op"]]
        return status(end and all(compare(len(won), n) for n in targets), task["vs"] == "captain" and captain == owner)
    colors = ("blue", "green", "pink", "yellow")
    count_color = lambda cs, suit: sum(c["suit"] == suit for c in cs)
    if kind == "collectAllColors": return status(all(count_color(cards, s) for s in colors))
    if kind == "collectAllOfOneColor": return status(any(count_color(cards, s) == 9 for s in colors))
    if kind == "collectEqualColor":
        groups = [[p["card"] for p in t["plays"]] for t in won] if task["inTrick"] else [cards]
        ok = any(count_color(cs, task["a"]) == count_color(cs, task["b"]) > 0 for cs in groups)
        return status(ok and (task["inTrick"] or end))
    if kind == "collectMoreColor": return status(end and count_color(cards, task["more"]) > count_color(cards, task["less"]))
    if kind == "noLead":
        return status(end, any(t["plays"][0]["player_id"] == owner and t["plays"][0]["card"]["suit"] in task["suits"] for t in tricks))
    if kind in ("trickFilter", "trickSum"):
        for trick in won:
            cs = [p["card"] for p in trick["plays"]]
            if any(c["suit"] == "trump" for c in cs): continue
            ranks = [c["rank"] for c in cs]
            if kind == "trickSum":
                val = sum(ranks)
                limit = task.get("target", [0, 0, 0])[len(seats) - 3]
                ok = val in task["targets"] if task["op"] == "eq" else val < limit if task["op"] == "lt" else val >= limit
            else:
                f = task["filter"]
                ok = all(n % 2 == 0 for n in ranks) if f == "allEven" else all(n % 2 for n in ranks) if f == "allOdd" else all(n < task["bound"] for n in ranks) if f == "allLt" else all(n > task["bound"] for n in ranks)
            if ok: return "complete"
        return status(False)
    raise ValueError(f"unknown task kind: {kind}")
