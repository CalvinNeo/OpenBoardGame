"""A deterministic practice partner using only its player-facing view."""

from typing import Dict, Optional


def _hand(view: Dict, actor: str):
    return view["hand"] if actor == view["you"] else [c["card"] for c in view["helper"] if c["card"]]


def _strength(hand):
    return sum(c["rank"] / 9 if c["suit"] == "trump" else max(0, c["rank"] - 6) / 5 for c in hand)


def _task_fit(task, hand):
    strength = _strength(hand)
    if task["kind"] == "winCards":
        return sum(max([c["rank"] for c in hand if c["suit"] == target.rsplit("_", 1)[0]] or [0])
                   for target in task["cards"]) + strength
    if task["kind"] in ("trickCount", "predictTricks"):
        return -abs(strength - task.get("count", strength))
    if task["kind"] == "avoid": return -strength
    return strength - task.get("cost", 1) / 2


def _play_score(view, actor, card):
    plays = view["trick"] + [{"player_id": actor, "card": card}]
    lead = plays[0]["card"]["suit"]
    def power(c): return (20 if c["suit"] == "trump" else 10 if c["suit"] == lead else 0) + c["rank"]
    winner = max(plays, key=lambda p: power(p["card"]))["player_id"]
    ids = {p["card"]["id"] for p in plays}
    # Preserve high cards in neutral situations; cooperate on visible objectives.
    score = -card["rank"] / 10 - (1 if card["suit"] == "trump" else 0)
    for task in view["tasks"]:
        if task.get("hidden") or task["status"] != "pending": continue
        own, kind = task["owner"], task["kind"]
        if kind == "winCards":
            if ids.intersection(task["cards"]): score += 100 if winner == own else -100
            elif not view["trick"] and own == actor:
                if any(t.startswith(card["suit"] + "_") for t in task["cards"]): score += card["rank"] * 1.5
        if kind == "avoid" and winner == own:
            suits = task.get("suits", [task.get("suit")])
            values = task.get("values", [task.get("value")])
            if any(p["card"]["suit"] in suits or
                   (task.get("submarines") and p["card"]["suit"] == "trump") or
                   (p["card"]["suit"] != "trump" and p["card"]["rank"] in values) for p in plays): score -= 40
        if kind in ("trickCount", "predictTricks") and winner == own:
            target = task.get("count", task.get("prediction"))
            won = next(p["won"] for p in view["players"] if p["player_id"] == own)
            if target is not None: score += 10 if won < target else -50
        if kind == "nthTrick":
            number = view["trick_number"]
            needed = number == view["total_tricks"] if task["n"] == 0 else number <= task.get("count", 1)
            needed = needed or (task.get("alsoLast") and number == view["total_tricks"])
            if needed: score += 60 if winner == own else -60
            elif task.get("only") and winner == own: score -= 60
        if kind == "skipFirstTricks" and view["trick_number"] <= task["count"] and winner == own: score -= 60
        if kind == "winWith" and winner == own and actor == own:
            match = card["suit"] == "trump" if task.get("suit") == "trump" else card["suit"] != "trump" and card["rank"] == task["value"]
            if match: score += 12
    special = view["spec"]["special"]
    if special in ("balance", "balance_captain"):
        counts = {p["player_id"]: p["won"] for p in view["players"]}
        score -= counts[winner] * 30
    if special == "sick" and winner == view["target"]: score -= 100
    if special == "no_nine" and next(p["card"] for p in plays if p["player_id"] == winner)["rank"] == 9: score -= 100
    if special == "no_pink_trump_lead" and not view["trick"] and card["suit"] in ("pink", "trump"): score -= 150
    if special == "yellow_last" and card["id"] == "yellow_5" and (view["trick_number"] != view["total_tricks"] or len(plays) != len(view["players"])): score -= 200
    return score


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal: return None
    def action(kind, **fields):
        return {"type": kind, **fields, **{k: view[k] for k in ("game_token", "attempt_id", "step")}}
    for kind in ("next_round", "next_mission"):
        if kind in legal: return action(kind)
    if "keep_tokens" in legal: return action("keep_tokens")
    if "respond" in legal:
        actor = view["current_turn"] if view["phase"] == "volunteer" else next(p for p in view["controlled_seats"] if p not in view["responses"])
        strong = _strength(_hand(view, actor)) >= 2
        yes = not strong if view["spec"]["special"] in ("sick", "one_plain") else strong
        if view["phase"] == "volunteer":
            need = (2 if view["spec"]["special"] == "two_volunteers" else 1) - len(view["volunteers"])
            yes = yes or view["volunteer_remaining"] <= need
        return action("respond", actor=actor, yes=yes)
    if "assign" in legal:
        choices = view["assignable"]
        willing = [p for p in choices if view["responses"].get(p)]
        return action("assign", player_id=(willing or choices)[0])
    if "take_task" in legal:
        free = view["spec"]["special"] in ("free", "two_volunteers")
        candidates = [(actor, t) for actor, ids in view["task_choices"].items() if free or actor == view["current_turn"]
                      for t in view["tasks"] if t["id"] in ids]
        actor, task = max(candidates, key=lambda item: _task_fit(item[1], _hand(view, item[0])))
        return action("take_task", actor=actor, task_id=task["id"])
    if "pass_task" in legal: return action("pass_task")
    if "predict" in legal:
        task = next(t for t in view["tasks"] if t["kind"] == "predictTricks" and t["owner"] in view["controlled_seats"] and not t["prediction_locked"])
        return action("predict", task_id=task["id"], value=min(view["total_tricks"], round(_strength(_hand(view, task["owner"])))))
    if "distress_vote" in legal: return action("distress_vote", yes=True)
    if "exchange" in legal:
        actor = view["exchange_pending"][0]
        targets = {c for t in view["tasks"] if t.get("owner") == actor for c in t.get("cards", [])}
        card = min((c for c in _hand(view, actor) if c["suit"] != "trump"), key=lambda c: (c["id"] in targets, c["rank"]))
        return action("exchange", actor=actor, card_id=card["id"])
    if "communicate" in legal and view["phase"] == "preflight":
        options = view["communication_options"]
        best = max(options, key=lambda o: int(o["card_id"].rsplit("_", 1)[1]))
        # In shared-token scenarios reserve opportunities for the other seats.
        if not view["communications"][view["you"]]: return action("communicate", card_id=best["card_id"], marker=best["markers"][0])
    if "ready" in legal: return action("ready")
    if "play" in legal:
        actor = view["current_turn"]
        card = max((c for c in _hand(view, actor) if c["id"] in view["legal_card_ids"]), key=lambda c: _play_score(view, actor, c))
        return action("play", card_id=card["id"])
    return None
