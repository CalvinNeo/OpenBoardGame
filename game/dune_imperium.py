"""Authoritative Dune: Imperium base-game state machine."""
import copy
import itertools
import json
import random
from typing import Dict, List, Optional, Tuple

from game.dune_imperium_data import (
    ACTION_SCHEMA, CONFIG_SCHEMA, CARDS, CONFLICTS, FACTIONS, FACTION_BONUS,
    FACTION_NAMES, HAGAL_CARDS, INTRIGUES, LEADERS, MARKET, RESERVE, SPACES, STARTER,
    effect, gain, influence, pay,
)


def _shuffle(state: Dict, items: List) -> None:
    rng = random.Random(f"{state['seed']}:{state['random_step']}")
    state["random_step"] += 1
    rng.shuffle(items)


def _log(state: Dict, text: str) -> None:
    state["log"] = (state["log"] + [{"round": state["round"], "text": text}])[-90:]


def _kind(state: Dict, uid: str) -> str:
    return state["cards"][uid]


def _card(state: Dict, uid: str) -> Dict:
    return CARDS[_kind(state, uid)]


def _queue(state: Dict, pid: str, effects: List[Dict], source: Optional[str] = None) -> None:
    for item in effects:
        state["effects"].append(dict(copy.deepcopy(item), owner=pid, source=source))


def _afford(player: Dict, cost: Dict) -> bool:
    return all(player.get(k, 0) >= n for k, n in cost.items())


def _pay(player: Dict, cost: Dict) -> None:
    for key, amount in cost.items():
        player[key] -= amount


def _draw(state: Dict, pid: str, count: int) -> None:
    player = state["players"][pid]
    for _ in range(count):
        if not player["deck"]:
            player["deck"], player["discard"] = player["discard"], []
            _shuffle(state, player["deck"])
        if not player["deck"]:
            break
        uid = player["deck"].pop()
        if state["turn"] and state["turn"]["mode"] == "reveal" and state["current_turn"] == pid:
            player["revealed"].append(uid)
            _queue(state, pid, _card(state, uid)["reveal"], uid)
        else:
            player["hand"].append(uid)


def _intrigue_draw(state: Dict, pid: str, count: int) -> None:
    for _ in range(count):
        if not state["intrigue_deck"]:
            state["intrigue_deck"], state["intrigue_discard"] = state["intrigue_discard"], []
            _shuffle(state, state["intrigue_deck"])
        if state["intrigue_deck"]:
            state["players"][pid]["intrigues"].append(state["intrigue_deck"].pop())


def _recruit(state: Dict, pid: str, count: int) -> int:
    p = state["players"][pid]
    actual = min(count, 12 - p["garrison"] - p["troops"])
    p["garrison"] += actual
    if state["phase"] == "agent" and state["current_turn"] == pid:
        if state["turn"] and state["turn"]["mode"] == "agent":
            state["turn"]["recruited"] += actual
        elif not state["turn"]:
            state["pre_turn"]["recruited"] += actual
    return actual


def _deployed(state: Dict, pid: str, amount: int) -> None:
    if state["phase"] == "agent" and state["current_turn"] == pid:
        turn = state["turn"] or state["pre_turn"]
        turn["deployed"] += amount
        if amount:
            turn["baron_checked"] = False


def strength(player: Dict) -> int:
    return 2 * player["troops"] + player["swords"] if player["troops"] else 0


def _gain(state: Dict, pid: str, values: Dict) -> None:
    p = state["players"][pid]
    for key, amount in values.items():
        if key == "draw":
            _draw(state, pid, amount)
        elif key == "intrigue":
            _intrigue_draw(state, pid, amount)
        elif key == "troops":
            _recruit(state, pid, amount)
        else:
            p[key] += amount


def _alliance(state: Dict, faction: str, new_owner: Optional[str]) -> None:
    old = state["alliances"][faction]
    if old == new_owner:
        return
    if old and old != "hagal":
        state["players"][old]["vp"] -= 1
    state["alliances"][faction] = new_owner
    if new_owner and new_owner != "hagal":
        state["players"][new_owner]["vp"] += 1
    _log(state, f"{FACTION_NAMES[faction]}联盟 → {state['players'][new_owner]['name'] if new_owner else '—'}")


def _influence(state: Dict, pid: str, faction: str, amount: int) -> None:
    p = state["players"][pid]
    old = p["influence"][faction]
    new = max(0, min(6, old + amount))
    p["influence"][faction] = new
    if pid != "hagal":
        p["vp"] += int(new >= 2) - int(old >= 2)
        if old < 4 <= new:
            _gain(state, pid, FACTION_BONUS[faction])
    owner = state["alliances"][faction]
    high = max(v["influence"][faction] for v in state["players"].values())
    candidates = [i for i, v in state["players"].items() if v["influence"][faction] == high]
    if high < 4:
        _alliance(state, faction, None)
    elif owner not in candidates:
        if len(candidates) == 1:
            _alliance(state, faction, candidates[0])
        else:
            # The owner who loses a tied alliance chooses its new holder (FAQ).
            _queue(state, pid, [effect("alliance_choice", faction=faction, candidates=candidates)])


def _in_play(p: Dict) -> List[str]:
    return p["played"] + p["revealed"]


def _trashable(p: Dict) -> List[str]:
    return p["hand"] + p["discard"] + _in_play(p)


def _trash(state: Dict, pid: str, uid: str) -> None:
    p = state["players"][pid]
    for zone in ("hand", "discard", "played", "revealed", "deck"):
        if uid in p[zone]:
            p[zone].remove(uid)
            kind = _kind(state, uid)
            if kind in RESERVE:
                state["reserve"][kind].append(uid)
            else:
                state["trashed"].append(uid)
            if kind == "assassination_mission":
                p["solari"] += 4
            _log(state, f"{p['name']}移除：{CARDS[kind]['name_zh']}")
            return


def _refill_market(state: Dict) -> None:
    while len(state["market"]) < 5 and state["market_deck"]:
        state["market"].append(state["market_deck"].pop())


def _acquire(state: Dict, pid: str, uid: str, top: bool = False) -> None:
    p = state["players"][pid]
    if uid in state["market"]:
        state["market"].remove(uid)
        _refill_market(state)
    elif uid in p["reserved"]:
        p["reserved"].remove(uid)
    else:
        state["reserve"][_kind(state, uid)].remove(uid)
    p["deck" if top else "discard"].append(uid)
    _queue(state, pid, _card(state, uid)["acquire"], uid)
    _log(state, f"{p['name']}获得：{_card(state, uid)['name_zh']}")


def _condition(state: Dict, pid: str, e: Dict) -> bool:
    p, condition = state["players"][pid], e["condition"]
    if condition in ("bond", "sister"):
        faction = "fremen" if condition == "bond" else "bene"
        return any(uid != e["source"] and faction in _card(state, uid)["factions"] for uid in _in_play(p))
    if condition == "alliance":
        return state["alliances"][e["faction"]] == pid
    if condition == "influence":
        return p["influence"][e["faction"]] >= e["amount"]
    raise ValueError(f"unknown condition: {condition}")


def _prompt(state: Dict, e: Dict, options: List, mode: Optional[str] = None, **extra) -> None:
    state["choice"] = {"owner": e["owner"], "effect": e, "mode": mode or e["kind"], "options": options, **extra}


def _resolve_effect(state: Dict, e: Dict) -> None:
    pid, kind, source = e["owner"], e["kind"], e.get("source")
    p = state["players"][pid]
    if kind == "gain":
        _gain(state, pid, e["values"])
    elif kind == "influence":
        if e["faction"] in FACTIONS:
            _influence(state, pid, e["faction"], e["amount"])
        else:
            options = [f for f in FACTIONS if f != e.get("exclude")]
            if e.get("behind"):
                options = [f for f in options if any(q["influence"][f] > p["influence"][f] for q in state["players"].values())]
            if options:
                _prompt(state, e, options)
    elif kind == "conditional":
        if _condition(state, pid, e):
            _queue(state, pid, e["effects"], source)
    elif kind == "pay":
        _prompt(state, e, [False, True] if _afford(p, e["cost"]) else [False])
    elif kind == "choice":
        _prompt(state, e, list(range(len(e["options"]))))
    elif kind in ("trash", "breeding"):
        _prompt(state, e, [None] + _trashable(p))
    elif kind == "trash_self":
        if source in _trashable(p):
            _trash(state, pid, source)
    elif kind == "spy":
        _prompt(state, e, [False, True] if source in _trashable(p) else [False])
    elif kind == "harvest":
        space_id = state["turn"]["space"]
        amount = e["amount"] + state["spice_bonus"][space_id]
        # Carryall's doubling is a separate gain and does not double accumulated spice.
        state["spice_bonus"][space_id] = 0
        if p["leader"] == "ariana":
            amount -= 1
            _draw(state, pid, 1)
        p["spice"] += amount
    elif kind == "carryall":
        space_id = state["turn"]["space"]
        if SPACES[space_id].get("maker"):
            p["spice"] += next(x["amount"] for x in SPACES[space_id]["effects"] if x["kind"] == "harvest")
    elif kind == "foldspace":
        if state["reserve"]["foldspace"]:
            _acquire(state, pid, state["reserve"]["foldspace"][-1])
    elif kind == "swordmaster":
        p["swordmaster"] = True
        p["agents"].append("swordmaster")
    elif kind == "mentat":
        if state["mentat"] is None:
            state["mentat"] = pid
            p["agents"].append("mentat")
    elif kind == "council":
        p["council"] = True
        if p["leader"] == "memnon":
            _queue(state, pid, [influence()])
    elif kind == "ring":
        rings = {"paul": [gain(draw=1)], "leto": [pay({"spice": 1}, influence(behind=True))],
                 "baron": [pay({"solari": 1}, gain(intrigue=1))],
                 "rabban": [gain(troops=2 if pid in state["alliances"].values() else 1)],
                 "helena": [effect("reserve_card")], "ilban": [gain(solari=1)],
                 "ariana": [gain(water=1)], "memnon": [gain(spice=1)]}
        _queue(state, pid, rings[p["leader"]], source)
    elif kind == "steal":
        for other, q in state["players"].items():
            if other != pid and len(q["intrigues"]) >= 4:
                pool = list(q["intrigues"])
                _shuffle(state, pool)
                q["intrigues"].remove(pool[0])
                p["intrigues"].append(pool[0])
    elif kind == "enemy_garrison":
        for other, q in state["players"].items():
            if other != pid:
                q["garrison"] = max(0, q["garrison"] - 1)
    elif kind in ("enemy_discard", "test_humanity"):
        order = state["order"]
        idx = order.index(pid)
        state["interrupts"] += [dict(e, owner=other, kind="discard", remaining=e.get("amount", 1), alternative=kind == "test_humanity")
                                for other in order[idx + 1:] + order[:idx]]
        if kind == "test_humanity" and "hagal" in state["players"]:
            state["players"]["hagal"]["troops"] = max(0, state["players"]["hagal"]["troops"] - 1)
    elif kind == "discard":
        if e["remaining"] and p["hand"]:
            options = list(p["hand"])
            if e.get("alternative") and p["troops"]:
                options.append("lose_troop")
            _prompt(state, e, options)
        elif e.get("alternative") and p["troops"]:
            p["troops"] -= 1
    elif kind in ("deploy", "retreat", "deployment"):
        maximum = min(p["garrison"] if kind != "retreat" else p["troops"], e["amount"])
        _prompt(state, e, list(range(maximum + 1)))
    elif kind in ("recruit_deploy", "reinforcements"):
        actual = _recruit(state, pid, e["amount"])
        if kind == "recruit_deploy" or (state["turn"] and state["turn"]["mode"] == "reveal"):
            _prompt(state, dict(e, amount=actual), list(range(actual + 1)), mode="deploy")
    elif kind == "memory":
        options = ["draw"] + [c for c in p["discard"] if "bene" in _card(state, c)["factions"]]
        _prompt(state, e, options)
    elif kind == "shift":
        options = [None]
        if p["spice"] >= 2:
            options += [[a, b] for a in FACTIONS if p["influence"][a] for b in FACTIONS]
        _prompt(state, e, options)
    elif kind == "voice":
        _prompt(state, e, list(SPACES))
    elif kind == "discount":
        p["discount"] += e["amount"]
    elif kind == "liet":
        p["persuasion"] += 2 * sum("fremen" in _card(state, c)["factions"] for c in _in_play(p))
    elif kind == "reserve_card":
        _prompt(state, e, [None] + list(state["market"]))
    elif kind == "two_factions":
        _prompt(state, e, [list(pair) for pair in itertools.combinations(FACTIONS, 2)])
    elif kind == "alliance_choice":
        _prompt(state, e, e["candidates"])
    elif kind == "baron_power":
        _prompt(state, e, [False, True])
    elif kind == "envoy":
        p["envoy"] = True
    elif kind == "infiltrate":
        p["infiltrate"] = True
    elif kind == "recruitment":
        p["recruitment"] = True
    elif kind == "bindu":
        _prompt(state, e, [False, True])
    elif kind == "bypass":
        options = []
        for uid in _purchasable(state, pid):
            cost = _card(state, uid)["cost"]
            if cost <= 3:
                options.append({"card": uid, "top": False, "spice": 0})
                if p["recruitment"] and state["turn"] and state["turn"]["mode"] == "reveal":
                    options.append({"card": uid, "top": True, "spice": 0})
            if cost <= 5 and p["spice"] >= 2:
                options.append({"card": uid, "top": True, "spice": 2})
        if options:
            _prompt(state, e, options)
    elif kind == "double_cross":
        _prompt(state, e, [i for i, q in state["players"].items() if i != pid and q["troops"]])
    elif kind == "snooper":
        if not p["deck"] and p["discard"]:
            p["deck"], p["discard"] = p["discard"], []
            _shuffle(state, p["deck"])
        if p["deck"]:
            _prompt(state, e, ["draw", "trash"], peek=p["deck"][-1])
    elif kind == "refocus":
        p["deck"] += p["discard"]
        p["discard"] = []
        _shuffle(state, p["deck"])
        _draw(state, pid, 1)
    elif kind == "recall":
        options = [{"space": s, "agent": a["agent"]} for s, agents in state["occupied"].items() for a in agents if a["owner"] == pid]
        if options:
            _prompt(state, e, options)
    elif kind == "staged":
        p["troops"] -= 3
        p["vp"] += 1
    elif kind == "next_mentat":
        state["next_mentat"] = pid
    elif kind == "corner_market":
        counts = {i: sum(_kind(state, c) == "spice_must_flow" for c in q["deck"] + _trashable(q)) for i, q in state["players"].items()}
        p["vp"] += int(counts[pid] >= 2) + int(all(counts[pid] > n for i, n in counts.items() if i != pid))
    elif kind == "plans":
        count = sum(v >= 3 for v in p["influence"].values())
        p["vp"] += max(0, count - 2)
    else:
        raise ValueError(f"unimplemented effect: {kind}")


def _choose(state: Dict, value) -> None:
    prompt = state["choice"]
    e, pid, kind = prompt["effect"], prompt["owner"], prompt["mode"]
    source = e.get("source")
    p = state["players"][pid]
    state["choice"] = None
    if kind == "influence":
        _influence(state, pid, value, e["amount"])
    elif kind == "pay" and value:
        _pay(p, e["cost"])
        _queue(state, pid, e["effects"], source)
    elif kind == "choice":
        _queue(state, pid, [e["options"][value]], source)
    elif kind in ("trash", "breeding") and value:
        _trash(state, pid, value)
        if kind == "breeding":
            _draw(state, pid, 2)
    elif kind == "spy" and value:
        _trash(state, pid, source)
        _intrigue_draw(state, pid, 1)
    elif kind == "discard":
        if value == "lose_troop":
            p["troops"] -= 1
        else:
            p["hand"].remove(value)
            p["discard"].append(value)
            if e["remaining"] > 1:
                state["interrupts"].insert(0, dict(e, remaining=e["remaining"] - 1))
    elif kind in ("deploy", "deployment"):
        p["garrison"] -= value
        p["troops"] += value
        _deployed(state, pid, value)
        if state["turn"] and state["turn"]["mode"] == "agent" and pid == state["current_turn"]:
            if kind == "deployment":
                state["turn"]["normal_deployed"] += value
    elif kind == "retreat":
        p["troops"] -= value
        p["garrison"] += value
    elif kind == "memory":
        if value == "draw":
            _draw(state, pid, 1)
        else:
            p["discard"].remove(value)
            p["hand"].append(value)
    elif kind == "shift" and value:
        p["spice"] -= 2
        _influence(state, pid, value[0], -1)
        _influence(state, pid, value[1], 2)
    elif kind == "voice":
        state["blocked"].append({"space": value, "owner": pid})
    elif kind == "reserve_card" and value:
        state["market"].remove(value)
        p["reserved"].append(value)
        _refill_market(state)
    elif kind == "two_factions":
        for f in value:
            _influence(state, pid, f, 1)
    elif kind == "alliance_choice":
        _alliance(state, e["faction"], value)
    elif kind == "baron_power" and value:
        p["baron_used"] = True
        for f in p["baron_factions"]:
            _influence(state, pid, f, 1)
        _log(state, f"{p['name']}发动妙计")
    elif kind == "bindu" and value:
        state["bindu_pass"] = True
    elif kind == "bypass":
        p["spice"] -= value["spice"]
        _acquire(state, pid, value["card"], value["top"])
    elif kind == "double_cross":
        state["players"][value]["troops"] -= 1
        if p["garrison"] + p["troops"] < 12:
            p["troops"] += 1
            _deployed(state, pid, 1)
    elif kind == "snooper":
        if value == "draw":
            _draw(state, pid, 1)
        else:
            _trash(state, pid, prompt["peek"])
    elif kind == "recall":
        state["occupied"][value["space"]].remove({"owner": pid, "agent": value["agent"]})
        p["agents"].append(value["agent"])


def _settle(state: Dict) -> None:
    while not state["choice"] and state["interrupts"]:
        _resolve_effect(state, state["interrupts"].pop(0))
    if state["choice"] or state["effects"]:
        return
    for item in state["intrigue_resolving"]:
        p = state["players"][item["owner"]]
        target = p["intrigue_active"] if item["delayed"] else state["intrigue_discard"]
        target.append(item["card"])
    state["intrigue_resolving"] = []
    turn = state["turn"]
    if state["bindu_pass"]:
        state["bindu_pass"] = False
        _next_turn(state)
        return
    elif turn and turn["mode"] == "agent":
        if turn["deployment_offered"] != turn["recruited"]:
            turn["deployment_offered"] = turn["recruited"]
            if SPACES[turn["space"]]["combat"]:
                allowance = max(0, turn["recruited"] + 2 - turn["normal_deployed"])
                _resolve_effect(state, dict(effect("deployment", amount=allowance), owner=state["current_turn"], source=None))
    if state["phase"] == "agent" and not state["choice"]:
        turn = state["turn"] or state["pre_turn"]
        p = state["players"][state["current_turn"]]
        if not turn["baron_checked"] and turn["deployed"] >= 4:
            turn["baron_checked"] = True
            if p["leader"] == "baron" and not p["baron_used"]:
                _resolve_effect(state, dict(effect("baron_power"), owner=state["current_turn"], source=None))


def _cost(state: Dict, pid: str, space_id: str, amount: int = 0) -> Dict:
    cost = dict(SPACES[space_id]["cost"])
    if space_id == "sell_melange":
        cost = {"spice": amount}
    if state["players"][pid]["leader"] == "leto" and SPACES[space_id]["icon"] == "landsraad" and cost.get("solari"):
        cost["solari"] -= 1
    return cost


def _can_enter(state: Dict, pid: str, uid: str, space_id: str, agent: str) -> bool:
    p, s = state["players"][pid], SPACES[space_id]
    kh = _kind(state, uid) == "kwisatz_haderach"
    if not kh and s["icon"] not in _card(state, uid)["icons"] and not (p["envoy"] and s["icon"] in FACTIONS):
        return False
    if any(b["space"] == space_id and b["owner"] != pid for b in state["blocked"]):
        return False
    occupants = [a for a in state["occupied"][space_id] if not (kh and a["owner"] == pid and a["agent"] == agent)]
    if occupants:
        if any(a["owner"] == pid for a in occupants):
            if not kh:
                return False
        elif not (kh or p["infiltrate"] or (p["leader"] == "helena" and s["icon"] in ("landsraad", "city"))):
            return False
    if space_id == "swordmaster" and p["swordmaster"]:
        return False
    if space_id == "high_council" and p["council"]:
        return False
    return all(p["influence"][f] >= n for f, n in s.get("requirement", {}).items())


def _purchasable(state: Dict, pid: str) -> List[str]:
    cards = list(state["market"]) + state["players"][pid]["reserved"]
    cards += [state["reserve"][k][-1] for k in ("arrakis_liaison", "spice_must_flow") if state["reserve"][k]]
    return cards


def _buy_cost(state: Dict, pid: str, uid: str) -> int:
    p = state["players"][pid]
    discount = p["discount"] if _kind(state, uid) == "spice_must_flow" else 0
    discount += int(uid in p["reserved"])
    return max(0, _card(state, uid)["cost"] - discount)


def _intrigue_available(state: Dict, pid: str, key: str) -> bool:
    p, data = state["players"][pid], INTRIGUES[key]
    timing, phase = data["timing"], state["phase"]
    turn = state["turn"]
    if timing in ("plot", "start"):
        if phase != "agent":
            return False
        if timing == "start" and (state["started"] or turn):
            return False
        if key in ("dispatch_envoy", "infiltrate") and turn:
            return False
    elif timing == "win":
        if phase != "rewards" or state["combat_winner"] != pid:
            return False
    elif timing == "endgame":
        if phase != "endgame":
            return False
    elif timing == "combat":
        if phase != "combat" or not p["troops"]:
            return False
    elif timing == "combat_endgame":
        if phase != "endgame" and (phase != "combat" or not p["troops"]):
            return False
    if not _afford(p, data["cost"]):
        return False
    req = data["requirement"]
    if req == "alliance" and pid not in state["alliances"].values():
        return False
    if req == "council" and not p["council"]:
        return False
    if req == "mentat" and state["mentat"] is not None:
        return False
    if req == "enemy_troop" and not any(q["troops"] for i, q in state["players"].items() if i != pid):
        return False
    if req == "three_troops" and p["troops"] < 3:
        return False
    if req == "agent" and not any(a["owner"] == pid for agents in state["occupied"].values() for a in agents):
        return False
    return True


def legal_moves(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["order"] or state["game_over"]:
        return []
    phase, p = state["phase"], state["players"][pid]
    if phase == "round_end":
        return [] if pid in state["ready"] else [{"type": "next_round"}]
    if state["choice"]:
        c = state["choice"]
        return [{"type": "choose", "choice": copy.deepcopy(v)} for v in c["options"]] if c["owner"] == pid else []
    if pid != state["current_turn"]:
        return []
    if phase == "leader":
        return [{"type": "leader", "leader": k} for k in LEADERS if k not in [q["leader"] for q in state["players"].values()]]
    if phase == "baron":
        return [{"type": "baron", "factions": list(pair)} for pair in itertools.combinations(FACTIONS, 2)]
    moves = [{"type": "resolve", "index": i} for i, e in enumerate(state["effects"]) if e["owner"] == pid]
    moves += [{"type": "intrigue", "card": uid} for uid in p["intrigues"] if _intrigue_available(state, pid, state["intrigue_cards"][uid])]
    turn = state["turn"]
    if phase == "agent":
        if turn and turn["mode"] == "reveal":
            for uid in _purchasable(state, pid):
                if p["persuasion"] >= _buy_cost(state, pid, uid):
                    moves.append({"type": "buy", "card": uid, "top": False})
                    if p["recruitment"]:
                        moves.append({"type": "buy", "card": uid, "top": True})
        if state["effects"]:
            return moves
        if turn:
            moves.append({"type": "end_turn"})
        else:
            moves.append({"type": "reveal"})
            for uid in p["hand"]:
                if not _card(state, uid)["icons"] and not p["envoy"]:
                    continue
                agents = list(p["agents"])
                if _kind(state, uid) == "kwisatz_haderach":
                    agents += [a["agent"] for aa in state["occupied"].values() for a in aa if a["owner"] == pid]
                for agent in dict.fromkeys(agents):
                    for space_id in SPACES:
                        if not _can_enter(state, pid, uid, space_id, agent):
                            continue
                        for amount in (range(2, 6) if space_id == "sell_melange" else [0]):
                            if _afford(p, _cost(state, pid, space_id, amount)):
                                moves.append({"type": "agent", "card": uid, "space": space_id, "agent": agent, "amount": amount})
    elif not state["effects"]:
        if phase == "combat":
            moves.append({"type": "pass"})
        elif phase == "rewards":
            moves.append({"type": "end_turn"})
        elif phase == "endgame":
            moves.append({"type": "endgame_done"})
    return moves


def _agent(state: Dict, pid: str, action: Dict) -> None:
    p, uid, space_id, agent = state["players"][pid], action["card"], action["space"], action["agent"]
    if agent in p["agents"]:
        p["agents"].remove(agent)
    else:
        for agents in state["occupied"].values():
            if {"owner": pid, "agent": agent} in agents:
                agents.remove({"owner": pid, "agent": agent})
                break
    cost = _cost(state, pid, space_id, action["amount"])
    _pay(p, cost)
    p["hand"].remove(uid)
    p["played"].append(uid)
    state["occupied"][space_id].append({"owner": pid, "agent": agent})
    state["turn"] = dict(state["pre_turn"], mode="agent", space=space_id, card=uid,
                         deployment_offered=-1, normal_deployed=0)
    state["started"] = True
    p["envoy"] = p["infiltrate"] = False
    icon = SPACES[space_id]["icon"]
    if icon in FACTIONS:
        _queue(state, pid, [influence(icon, 2 if _kind(state, uid) == "power_play" else 1)], uid)
    _queue(state, pid, SPACES[space_id]["effects"], uid)
    _queue(state, pid, _card(state, uid)["agent"], uid)
    if space_id == "sell_melange":
        _queue(state, pid, [gain(solari={2: 6, 3: 8, 4: 10, 5: 12}[action["amount"]])])
    if p["leader"] == "ilban" and cost.get("solari", 0) > 0:
        _queue(state, pid, [gain(draw=1)])
    controller = state["control"].get(space_id)
    if controller:
        _gain(state, controller, {"spice" if space_id == "imperial_basin" else "solari": 1})
    _log(state, f"{p['name']} · {_card(state, uid)['name_zh']} → {SPACES[space_id]['name']}")


def _reveal(state: Dict, pid: str) -> None:
    p = state["players"][pid]
    state["turn"] = dict(state["pre_turn"], mode="reveal")
    state["started"] = True
    p["revealed"], p["hand"] = p["hand"], []
    p["persuasion"] += 2 * int(p["council"])
    p["persuasion"] += sum(a["owner"] == pid for a in state["occupied"]["hall_of_oratory"])
    for uid in p["revealed"]:
        _queue(state, pid, _card(state, uid)["reveal"], uid)
    _log(state, f"{p['name']}揭示 {len(p['revealed'])} 张牌")


def _next_turn(state: Dict) -> None:
    pid = state["current_turn"]
    state["turn"] = None
    state["pre_turn"] = {"recruited": 0, "deployed": 0, "baron_checked": False}
    state["started"] = False
    order = state["order"]
    idx = order.index(pid)
    next_ids = order[idx + 1:] + order[:idx + 1]
    active = [i for i in next_ids if not state["players"][i]["done"]]
    if active:
        state["current_turn"] = active[0]
    else:
        _begin_combat(state)


def _hagal_draw(state: Dict) -> Dict:
    # Card objects are persisted so a save never changes the rival's next draw.
    if not state["hagal_deck"]:
        state["hagal_deck"], state["hagal_discard"] = state["hagal_discard"], []
        _shuffle(state, state["hagal_deck"])
    card = state["hagal_deck"].pop()
    state["hagal_discard"].append(card)
    if card["space"] == "reshuffle":
        state["hagal_deck"] += state["hagal_discard"]
        state["hagal_discard"] = []
        _shuffle(state, state["hagal_deck"])
        return _hagal_draw(state)
    return card


def _hagal_turn(state: Dict) -> None:
    p = state["players"].get("hagal")
    if not p or not p["agents"]:
        return
    for _ in range(200):
        card = _hagal_draw(state)
        space_id = card["space"]
        if space_id == "harvest":
            options = [s for s in state["spice_bonus"] if not state["occupied"][s] and state["spice_bonus"][s] > 0
                       and not any(b["space"] == s for b in state["blocked"])]
            if not options:
                continue
            space_id = max(options, key=lambda s: (state["spice_bonus"][s], {"great_flat": 3, "hagga_basin": 2, "imperial_basin": 1}[s]))
        if state["occupied"][space_id] or any(b["space"] == space_id for b in state["blocked"]):
            continue
        state["occupied"][space_id].append({"owner": "hagal", "agent": p["agents"].pop()})
        faction = SPACES[space_id]["icon"]
        if faction in FACTIONS:
            _influence(state, "hagal", faction, 1)
        recruited = _recruit(state, "hagal", card["troops"])
        if SPACES[space_id]["combat"]:
            n = min(p["garrison"], recruited + 2)
            p["garrison"] -= n
            p["troops"] += n
        if SPACES[space_id].get("maker"):
            state["spice_bonus"][space_id] = 0
        controller = state["control"].get(space_id)
        if controller:
            _gain(state, controller, {"spice" if space_id == "imperial_basin" else "solari": 1})
        _log(state, f"House Hagal → {SPACES[space_id]['name']}")
        return
    raise RuntimeError("House Hagal has no reachable space")


def _begin_combat(state: Dict) -> None:
    state["phase"] = "combat"
    state["passes"] = []
    hagal = state["players"].get("hagal")
    if hagal and hagal["troops"]:
        bonus = _hagal_draw(state)["swords"]
        hagal["swords"] += bonus
        _log(state, f"House Hagal 战斗加成 ⚔️ {bonus}")
    active = [i for i in _round_order(state) if state["players"][i]["troops"]]
    if active:
        state["current_turn"] = active[0]
    else:
        _resolve_combat(state)


def _combat_pass(state: Dict, pid: str) -> None:
    state["passes"].append(pid)
    active = [i for i in _round_order(state) if state["players"][i]["troops"]]
    if all(i in state["passes"] for i in active):
        _resolve_combat(state)
    else:
        order = _round_order(state)
        idx = order.index(pid)
        state["current_turn"] = next(i for i in order[idx + 1:] + order[:idx + 1] if i in active)


def _resolve_combat(state: Dict) -> None:
    scores = {i: strength(p) for i, p in state["players"].items()}
    ranked = sorted([i for i in scores if scores[i] > 0], key=lambda i: -scores[i])
    card = CONFLICTS[state["conflict"]]
    awards = {}
    winner = None
    for i in ranked:
        higher = sum(scores[j] > scores[i] for j in ranked)
        tied = sum(scores[j] == scores[i] for j in ranked)
        place = higher + (1 if tied > 1 else 0)
        # Equal first drops one tier, even in a three-way tie.
        if place < (3 if len(state["order"]) == 4 else 2):
            awards[i] = place
        if higher == 0 and tied == 1:
            winner = i
    state["combat_winner"] = winner
    if winner and card["control"]:
        state["control"][card["control"]] = None if winner == "hagal" else winner
    state["round_report"] = {"round": state["round"], "conflict": state["conflict"], "strength": scores,
                             "troops": {i: p["troops"] for i, p in state["players"].items()},
                             "awards": awards, "winner": winner}
    state["phase"] = "rewards"
    state["reward_queue"] = [i for i in _round_order(state) if i in awards or i == winner]
    _log(state, "冲突结算：" + " · ".join(f"{state['players'][i]['name']} ⚔️ {scores[i]}" for i in scores))
    _next_reward(state)


def _next_reward(state: Dict) -> None:
    if state["reward_queue"]:
        pid = state["reward_queue"].pop(0)
        state["current_turn"] = pid
        state["turn"] = {"mode": "reward"}
        rank = state["round_report"]["awards"].get(pid)
        if rank is not None:
            _queue(state, pid, CONFLICTS[state["conflict"]]["rewards"][rank])
    else:
        for s in state["spice_bonus"]:
            if not state["occupied"][s]:
                state["spice_bonus"][s] += 1
        state["phase"] = "round_end"
        state["turn"] = None
        state["current_turn"] = None
        state["ready"] = []
        state["final_round"] = any(state["players"][i]["vp"] >= 10 for i in state["order"]) or not state["conflict_deck"]
        state["round_report"]["vp"] = {i: p["vp"] for i, p in state["players"].items()}


def _round_order(state: Dict) -> List[str]:
    idx, order = state["first"], state["order"]
    return order[idx:] + order[:idx]


def _start_round(state: Dict) -> None:
    state["round"] += 1
    state["phase"] = "agent"
    state["turn"] = None
    state["pre_turn"] = {"recruited": 0, "deployed": 0, "baron_checked": False}
    state["started"] = False
    state["occupied"] = {s: [] for s in SPACES}
    state["blocked"] = []
    state["ready"] = []
    state["conflict"] = state["conflict_deck"].pop(0)
    state["mentat"] = state["next_mentat"]
    state["next_mentat"] = None
    for pid, p in state["players"].items():
        p.update(troops=0, swords=0, persuasion=0, discount=0, done=False, envoy=False, infiltrate=False, recruitment=False)
        p["agents"] = ["agent1", "agent2"] + (["swordmaster"] if p["swordmaster"] or pid == "hagal" else [])
        if state["mentat"] == pid:
            p["agents"].append("mentat")
        if pid != "hagal":
            _draw(state, pid, 5)
    state["current_turn"] = _round_order(state)[0]
    controlled = CONFLICTS[state["conflict"]]["control"]
    if controlled and state["control"][controlled]:
        pid = state["control"][controlled]
        p = state["players"][pid]
        if p["garrison"] + p["troops"] < 12:
            # Optional defensive deployment is offered to the controller before turns.
            _prompt(state, dict(effect("defense"), owner=pid, source=None), [False, True])
    _log(state, f"第 {state['round']} 轮：{CONFLICTS[state['conflict']]['name']}")


def _setup_done(state: Dict) -> None:
    baron = next((i for i in state["order"] if state["players"][i]["leader"] == "baron" and not state["players"][i]["baron_factions"]), None)
    if baron:
        state["phase"], state["current_turn"] = "baron", baron
    else:
        _start_round(state)


def _finish(state: Dict) -> None:
    scores = {i: (p["vp"], p["spice"], p["solari"], p["water"], p["garrison"], p["reveal_order"])
              for i, p in state["players"].items() if i != "hagal"}
    best = max(scores.values())
    state["winner"] = [i for i, s in scores.items() if s == best]
    state["game_over"], state["phase"], state["current_turn"] = True, "game_over", None
    state["standings"] = sorted(state["order"], key=lambda i: scores[i], reverse=True)
    _log(state, "游戏结束：" + "、".join(state["players"][i]["name"] for i in state["winner"]))


class DuneImperiumGame:
    game_id = "dune_imperium"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 4 or len({p["player_id"] for p in players}) != len(players):
            raise ValueError("Dune: Imperium requires 2–4 different players")
        config = config or {}
        if set(config) - {"seed"} or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("Invalid Dune: Imperium configuration")
        players = sorted(players, key=lambda p: p.get("seat", 0))
        state = {"game_id": "dune_imperium", "config": {}, "seed": config.get("seed", random.SystemRandom().randrange(2**63)),
                 "random_step": 0, "order": [p["player_id"] for p in players], "players": {}, "round": 0,
                 "first": 0, "phase": "leader", "current_turn": players[-1]["player_id"], "turn": None,
                 "revision": 0, "effects": [], "choice": None, "interrupts": [], "started": False, "bindu_pass": False,
                 "pre_turn": {"recruited": 0, "deployed": 0, "baron_checked": False}, "intrigue_resolving": [],
                 "cards": {}, "market": [], "market_deck": [], "reserve": {k: [] for k in RESERVE}, "trashed": [],
                 "intrigue_cards": {}, "intrigue_deck": [], "intrigue_discard": [], "intrigue_played": [],
                 "alliances": {f: None for f in FACTIONS}, "occupied": {s: [] for s in SPACES}, "blocked": [],
                 "spice_bonus": {s: 0 for s in SPACES if SPACES[s].get("maker")},
                 "control": {s: None for s in ("arrakeen", "carthag", "imperial_basin")},
                 "mentat": None, "next_mentat": None, "conflict": None, "conflict_deck": [], "combat_winner": None,
                 "passes": [], "reward_queue": [], "round_report": None, "ready": [], "endgame_ready": [],
                 "final_round": False, "game_over": False, "winner": [], "standings": [], "log": [],
                 "hagal_deck": [], "hagal_discard": [], "reveal_counter": 0}

        def make_card(kind):
            uid = f"c{len(state['cards']) + 1}"
            state["cards"][uid] = kind
            return uid

        for index, meta in enumerate(players):
            pid = meta["player_id"]
            if pid == "hagal":
                raise ValueError("Reserved player identifier")
            p = {"name": meta.get("name", pid), "seat": meta.get("seat", index), "is_bot": bool(meta.get("is_bot")),
                 "leader": None, "spice": 0, "water": 1, "solari": 0, "vp": 1 if len(players) == 4 else 0,
                 "garrison": 3, "troops": 0, "swords": 0, "persuasion": 0, "discount": 0,
                 "influence": {f: 0 for f in FACTIONS}, "deck": [], "hand": [], "discard": [], "played": [], "revealed": [],
                 "intrigues": [], "intrigue_active": [], "reserved": [], "agents": ["agent1", "agent2"], "council": False, "swordmaster": False,
                 "envoy": False, "infiltrate": False, "recruitment": False, "done": False,
                 "baron_factions": [], "baron_used": False, "reveal_order": 0}
            p["deck"] = [make_card(k) for k in STARTER for _ in range(CARDS[k]["count"])]
            _shuffle(state, p["deck"])
            state["players"][pid] = p
        for kind in MARKET:
            state["market_deck"] += [make_card(kind) for _ in range(CARDS[kind]["count"])]
        _shuffle(state, state["market_deck"])
        _refill_market(state)
        for kind in RESERVE:
            state["reserve"][kind] = [make_card(kind) for _ in range(CARDS[kind]["count"])]
        for kind, data in INTRIGUES.items():
            for _ in range(data["count"]):
                uid = f"i{len(state['intrigue_cards']) + 1}"
                state["intrigue_cards"][uid] = kind
                state["intrigue_deck"].append(uid)
        _shuffle(state, state["intrigue_deck"])
        for tier, count in ((1, 1), (2, 5), (3, 4)):
            pool = [k for k, c in CONFLICTS.items() if c["tier"] == tier]
            _shuffle(state, pool)
            state["conflict_deck"] += pool[:count]
        if len(players) == 2:
            h = copy.deepcopy(state["players"][state["order"][0]])
            h.update(name="House Hagal", seat=2, is_bot=True, leader="hagal", deck=[], water=0, vp=0, garrison=0,
                     agents=["agent1", "agent2", "swordmaster"])
            state["players"]["hagal"] = h
            for space_id, troops, swords, count in HAGAL_CARDS:
                state["hagal_deck"] += [{"space": space_id, "troops": troops, "swords": swords} for _ in range(count)]
            _shuffle(state, state["hagal_deck"])
        first_players = list(range(len(players)))
        _shuffle(state, first_players)
        state["first"] = first_players[0]
        state["current_turn"] = _round_order(state)[-1]
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return list(dict.fromkeys(m["type"] for m in legal_moves(state, player_id)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict):
            return [], "Invalid action"
        try:
            encoded = json.dumps(action, sort_keys=True, allow_nan=False)
        except (TypeError, ValueError):
            return [], "Invalid action"
        if not any(encoded == json.dumps(m, sort_keys=True, allow_nan=False) for m in legal_moves(state, player_id)):
            return [], "Illegal or stale Dune: Imperium action"
        work = copy.deepcopy(state)
        DuneImperiumGame._apply(work, player_id, action)
        _settle(work)
        # Deployment with zero troops still needs to reach the post-deployment check.
        if not work["choice"] and not work["effects"]:
            _settle(work)
        work["revision"] += 1
        state.clear()
        state.update(work)
        return [{"type": "dune_imperium:updated", "payload": {"revision": state["revision"]}}], None

    @staticmethod
    def _apply(state: Dict, pid: str, action: Dict) -> None:
        kind, p = action["type"], state["players"][pid]
        if kind == "leader":
            p["leader"] = action["leader"]
            if p["leader"] == "rabban":
                p["spice"] += 1
                p["solari"] += 1
            waiting = [i for i in reversed(_round_order(state)) if not state["players"][i]["leader"]]
            if waiting:
                state["current_turn"] = waiting[0]
            else:
                _setup_done(state)
        elif kind == "baron":
            p["baron_factions"] = action["factions"]
            _setup_done(state)
        elif kind == "agent":
            _agent(state, pid, action)
        elif kind == "reveal":
            _reveal(state, pid)
        elif kind == "resolve":
            _resolve_effect(state, state["effects"].pop(action["index"]))
        elif kind == "choose":
            if state["choice"]["mode"] == "defense":
                if action["choice"]:
                    p["troops"] += 1
                state["choice"] = None
            else:
                _choose(state, action["choice"])
        elif kind == "buy":
            p["persuasion"] -= _buy_cost(state, pid, action["card"])
            _acquire(state, pid, action["card"], action["top"])
        elif kind == "intrigue":
            uid = action["card"]
            key = state["intrigue_cards"][uid]
            data = INTRIGUES[key]
            _pay(p, data["cost"])
            p["intrigues"].remove(uid)
            state["intrigue_resolving"].append({"owner": pid, "card": uid,
                                                "delayed": key in ("charisma", "recruitment_mission")})
            state["intrigue_played"].append({"player_id": pid, "card": key, "round": state["round"]})
            if key == "tiebreaker":
                _gain(state, pid, {"spice": 10} if state["phase"] == "endgame" else {"swords": 2})
            else:
                _queue(state, pid, data["effects"])
            if state["phase"] == "combat":
                state["passes"] = []
            state["started"] = True
            _log(state, f"{p['name']}使用阴谋牌：{data['name']}")
        elif kind == "end_turn":
            if state["phase"] == "rewards":
                _next_reward(state)
            else:
                mode = state["turn"]["mode"]
                if mode == "reveal":
                    p["discard"] += p["played"] + p["revealed"]
                    p["played"], p["revealed"] = [], []
                    state["trashed"] += p["reserved"]
                    p["reserved"] = []
                    p["done"] = True
                    p["persuasion"] = 0
                    state["intrigue_discard"] += p["intrigue_active"]
                    p["intrigue_active"] = []
                    state["reveal_counter"] += 1
                    p["reveal_order"] = state["reveal_counter"]
                elif pid == state["order"][state["first"]]:
                    _hagal_turn(state)
                _next_turn(state)
        elif kind == "pass":
            _combat_pass(state, pid)
        elif kind == "next_round":
            state["ready"].append(pid)
            if len(state["ready"]) == len(state["order"]):
                for q in state["players"].values():
                    q["troops"] = q["swords"] = 0
                if state["final_round"]:
                    state["phase"] = "endgame"
                    state["current_turn"] = _round_order(state)[0]
                    state["turn"] = None
                else:
                    state["first"] = (state["first"] + 1) % len(state["order"])
                    _start_round(state)
        elif kind == "endgame_done":
            state["endgame_ready"].append(pid)
            waiting = [i for i in _round_order(state) if i not in state["endgame_ready"]]
            if waiting:
                state["current_turn"] = waiting[0]
            else:
                _finish(state)

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        visible = set(state["market"] + state["trashed"])
        for stack in state["reserve"].values():
            if stack:
                visible.add(stack[-1])
        players = []
        for pid, p in state["players"].items():
            row = {k: copy.deepcopy(p[k]) for k in ("name", "seat", "is_bot", "leader", "spice", "water", "solari", "vp", "garrison", "troops", "swords", "persuasion", "influence", "council", "swordmaster", "done", "baron_used")}
            row.update(player_id=pid, deck_count=len(p["deck"]), hand_count=len(p["hand"]), intrigue_count=len(p["intrigues"]),
                       agents=list(p["agents"]), strength=strength(p), discard=list(p["discard"]), played=list(p["played"]), revealed=list(p["revealed"]), reserved=list(p["reserved"]))
            row["active_intrigues"] = [state["intrigue_cards"][uid] for uid in p["intrigue_active"]]
            if p["baron_used"]:
                row["baron_factions"] = list(p["baron_factions"])
            visible.update(p["discard"] + p["played"] + p["revealed"] + p["reserved"])
            if pid == viewer_id:
                row.update(hand=list(p["hand"]), intrigues=[{"id": i, "kind": state["intrigue_cards"][i]} for i in p["intrigues"]],
                           baron_factions=list(p["baron_factions"]), discount=p["discount"], recruitment=p["recruitment"],
                           deck_composition=sorted(_kind(state, c) for c in p["deck"]))
                visible.update(p["hand"])
                if p["leader"] == "paul" and p["deck"]:
                    row["peek"] = p["deck"][-1]
                    visible.add(row["peek"])
            players.append(row)
        choice = state["choice"]
        public_choice = None
        if choice:
            public_choice = {"owner": choice["owner"], "mode": choice["mode"]}
            if choice["owner"] == viewer_id:
                public_choice = copy.deepcopy(choice)
                if choice.get("peek"):
                    visible.add(choice["peek"])
        moves = legal_moves(state, viewer_id)
        view = {k: copy.deepcopy(state[k]) for k in ("game_id", "phase", "round", "first", "order", "current_turn", "revision", "turn", "effects", "alliances", "occupied", "blocked", "spice_bonus", "control", "mentat", "conflict", "combat_winner", "round_report", "ready", "final_round", "game_over", "winner", "standings", "log", "intrigue_played")}
        view.update(you=viewer_id, players=players, market=list(state["market"]), reserve={k: {"count": len(v), "card": v[-1] if v else None} for k, v in state["reserve"].items()},
                    cards={uid: state["cards"][uid] for uid in visible}, choice=public_choice, moves=moves,
                    legal_actions=list(dict.fromkeys(m["type"] for m in moves)),
                    catalog={"cards": CARDS, "spaces": SPACES, "leaders": LEADERS, "intrigues": INTRIGUES, "conflicts": CONFLICTS, "factions": FACTION_NAMES},
                    remaining_conflicts=len(state["conflict_deck"]))
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.dune_imperium_ai import choose_move
        return choose_move(DuneImperiumGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
