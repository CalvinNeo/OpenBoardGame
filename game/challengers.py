"""Independent capture-the-flag matches, drafting, and tournament rules."""

import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.challengers_data import CARDS, ROBOT_STARTER, ROUND_OPTIONS, SETS, STARTER, TROPHY_VALUES


ROBOT_ID = "__challengers_robot__"


def _schema(kind: str, fields: Dict) -> Dict:
    properties = {"type": {"const": kind}, "round": {"type": "integer", "minimum": 1, "maximum": 8},
                  "revision": {"type": "integer", "minimum": 0}, **fields}
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


_IDS = {"type": "array", "items": {"type": "string"}, "uniqueItems": True, "maxItems": 400}
ACTION_SCHEMA = {"oneOf": [
    _schema("choose_level", {"level": {"enum": ["A", "B", "C"]}}),
    _schema("pick", {"card_id": {"type": "string"}}),
    _schema("redraw", {}), _schema("resolve", {"card_ids": _IDS}),
    _schema("ready", {"remove_ids": _IDS}), _schema("reveal", {}), _schema("next_round", {}),
]}
CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "seed": {"type": "integer"},
        "exclude_set": {"enum": ["random", *[s for s in SETS if s not in ("city", "robot")]], "default": "random"},
        "robot_level": {"type": "integer", "minimum": 1, "maximum": 5, "default": 1},
        "solo_special": {"type": "boolean", "default": False},
    }, "additionalProperties": False,
}
_ACTIONS = Draft7Validator(ACTION_SCHEMA)
_CONFIG = Draft7Validator(CONFIG_SCHEMA)


def _tuple_tree(value):
    return tuple(_tuple_tree(item) for item in value) if isinstance(value, (list, tuple)) else value


def _shuffle(state: Dict, items: List) -> None:
    rng = random.Random()
    rng.setstate(_tuple_tree(state["rng"]))
    rng.shuffle(items)
    version, numbers, gaussian = rng.getstate()
    state["rng"] = [version, list(numbers), gaussian]


def _kind(state: Dict, uid: str) -> str:
    return state["cards"][uid]["kind"]


def _card(state: Dict, uid: str) -> Dict:
    return CARDS[_kind(state, uid)]


def _base(state: Dict, uid: str) -> int:
    return min(7, state["round"]) if _kind(state, uid) == "cyborg" else _card(state, uid)["power"]


def _new_card(state: Dict, kind: str, level: Optional[str] = None) -> str:
    uid = f"ch{len(state['cards']) + 1}"
    state["cards"][uid] = {"kind": kind, "level": level or CARDS[kind]["level"]}
    return uid


def _discard(state: Dict, uid: str) -> None:
    level = state["cards"][uid]["level"]
    target = state["discards"][level] if level in "ABC" else state["removed"]
    target.append(uid)


def _draw_market(state: Dict, level: str, count: int) -> List[str]:
    drawn = []
    for _ in range(count):
        if not state["market"][level] and state["discards"][level]:
            refill = state["discards"][level]
            _shuffle(state, refill)
            state["market"][level] = refill
            state["discards"][level] = []
        if not state["market"][level]:
            break
        drawn.append(state["market"][level].pop(0))
    return drawn


def _log(state: Dict, text: str, match: Optional[Dict] = None) -> None:
    state["log"].append(text)
    state["log"] = state["log"][-160:]
    if match is not None:
        match["log"].append(text)
        match["log"] = match["log"][-120:]


def _name(state: Dict, pid: str) -> str:
    return state["players"][pid]["name"]


def _opponent(match: Dict, pid: str) -> str:
    return next(p for p in match["seats"] if p != pid)


def _bench_names(state: Dict, lane: Dict) -> set:
    return {_kind(state, uid) for uid in lane["bench"]}


def card_power(state: Dict, match: Dict, pid: str, entry: Dict, attacking: bool) -> int:
    """Immediate bonuses are snapshots; bench and flag effects are live auras."""
    uid = entry["id"]
    card = _card(state, uid)
    lane = match["lanes"][pid]
    power = _base(state, uid) + entry["bonus"]
    if attacking:
        power += entry["attack_bonus"]
        if card["effect"] == "gangster":
            power += 2
        if card["effect"] == "knight":
            power += len(state["players"][_opponent(match, pid)]["trophies"])
    else:
        power += {"skeleton": 1, "treasure": 2}.get(card["effect"], 0)
        if card["effect"] == "illusionist":
            power += max(0, 6 - len(_bench_names(state, lane)))
    for bench_uid in lane["bench"]:
        effect = _card(state, bench_uid)["effect"]
        if effect == "blacksmith" and card["set"] == "city":
            power += 1
        elif effect == "vendor" and card["set"] == "funfair":
            power += 1
        elif effect == "band" and card["set"] == "space":
            power += 1
        elif effect == "ai" and _base(state, uid) == 2:
            power += 1
        elif attacking and effect == "makeup_artist" and _base(state, uid) == 1:
            power += 2
        elif attacking and effect == "director" and card["set"] == "studio":
            power += 1
        elif attacking and effect == "bard":
            power += 1
        elif not attacking and effect == "cook":
            power += 1
    return max(0, power)


def _choice(state: Dict, match: Dict, pid: str, kind: str, candidates: List[str],
            minimum: int, maximum: int, source: str, target: Optional[str] = None,
            optional: bool = False) -> None:
    if not candidates:
        return
    maximum = min(maximum, len(candidates))
    match["pending"] = {"player_id": pid, "kind": kind, "candidates": list(candidates),
                        "min": min(minimum, maximum), "max": maximum, "source": source,
                        "target": target or pid, "optional": optional}
    match["turn"] = None
    state["players"][pid]["revision"] += 1


def _fans(state: Dict, pid: str, count: int, match: Optional[Dict] = None) -> None:
    # A multiplayer substitute is never a scoring tournament entrant.
    if pid == ROBOT_ID and len(state["order"]) > 1:
        return
    state["players"][pid]["fans"] += count
    _log(state, f"{_name(state, pid)} · ⭐ +{count}", match)


def _market_to_lane(state: Dict, match: Dict, pid: str, level: str, count: int, zone: str,
                    top: bool = False) -> None:
    added = _draw_market(state, level, count)
    state["players"][pid]["deck"].extend(added)
    lane = match["lanes"][pid]
    if top:
        lane[zone][0:0] = added
    else:
        lane[zone].extend(added)
    if added:
        _log(state, f"{_name(state, pid)} · +{len(added)} {level} 级牌", match)


def _immediate(state: Dict, match: Dict, pid: str, uid: str) -> None:
    effect = _card(state, uid)["effect"]
    lane = match["lanes"][pid]
    other_id = _opponent(match, pid)
    other = match["lanes"][other_id]
    bench = lane["bench"]
    entry = lane["field"][-1]
    own_sets = {_card(state, cid)["set"] for cid in bench}
    if effect == "hermit":
        entry["bonus"] = 2 if "city" not in own_sets else 0
    elif effect == "jester":
        entry["bonus"] = 3 if any(_base(state, cid) == 1 for cid in bench) else 0
    elif effect == "stable_boy":
        entry["bonus"] = sum(_base(state, cid) == 3 for cid in bench)
    elif effect == "mascot":
        entry["bonus"] = len(own_sets)
    elif effect == "mime":
        entry["bonus"] = max(0, 6 - len(_bench_names(state, lane)))
    elif effect == "teenager":
        entry["bonus"] = sum(_card(state, cid)["set"] == "haunted" for cid in bench)
    elif effect == "merman":
        entry["bonus"] = 3 if "shipwreck" in own_sets else 0
    elif effect == "lifeguard":
        entry["bonus"] = 2 if len(lane["draw"]) <= 1 else 0
    elif effect == "cyborg_friend":
        entry["bonus"] = sum(_kind(state, cid) == "cyborg" for cid in bench)
    elif effect == "mechanic":
        entry["bonus"] = sum(state["cards"][cid]["level"] == "B" for cid in other["bench"])
    elif effect == "autocorrect":
        entry["bonus"] = -len({_card(state, cid)["set"] for cid in other["bench"]})
    elif effect == "fan_bus" and len(state["players"][pid]["trophies"]) <= 3:
        _fans(state, pid, 2, match)
    elif effect == "pyrotechnician" and len(lane["draw"]) <= 1:
        _fans(state, pid, 2, match)
    elif effect == "ghost" and other["draw"]:
        exhausted = other["draw"].pop(0)
        other["exhaust"].append(exhausted)
        _log(state, f"{_name(state, other_id)} · 💤 {_card(state, exhausted)['name_zh']}", match)
    elif effect == "submarine" and lane["draw"]:
        lane["exhaust"].append(lane["draw"].pop())
    elif effect == "villain":
        _market_to_lane(state, match, pid, "A", 1, "draw", top=True)
    elif effect == "ufo":
        _market_to_lane(state, match, pid, "A", 2, "draw")
    elif effect in ("hologram", "robogram"):
        _market_to_lane(state, match, other_id, "B" if effect == "hologram" else "A", 1, "draw", top=True)
    elif effect in ("reporter", "juggler"):
        count = 2 if effect == "reporter" else 3
        if len(lane["draw"]) > 1:
            _choice(state, match, pid, "split" if count == 2 else "order", lane["draw"][:count],
                    1 if count == 2 else count, 1 if count == 2 else count, uid)
    elif effect == "sailor" and len(lane["draw"]) > 1:
        _choice(state, match, pid, "bottom", sorted(lane["draw"]), 1, 1, uid)
    elif effect in ("butler", "sorcerer"):
        candidates = [cid for cid in bench if effect == "butler" or _base(state, cid) <= 3]
        _choice(state, match, pid, "exhaust", candidates, 0, 2 if effect == "butler" else 1, uid)
    elif effect == "siren":
        _choice(state, match, pid, "exhaust", other["bench"], 0, 1, uid, target=other_id)
    elif effect == "movie_star":
        _choice(state, match, pid, "recover", [cid for cid in bench if _kind(state, cid) == "newcomer"], 0, 2, uid)
    elif effect in ("necromancer", "vampire"):
        candidates = [cid for cid in bench if (_base(state, cid) == 2 if effect == "necromancer"
                                               else state["cards"][cid]["level"] == "B")]
        _choice(state, match, pid, "recover", candidates, 1, 1, uid)
    elif effect == "drone":
        _choice(state, match, other_id, "exhaust", other["bench"], 1, 1, uid)
    elif effect == "necromech":
        _choice(state, match, other_id, "recover", [cid for cid in other["bench"] if _base(state, cid) == 2], 0, 1, uid)


def _loss_effect(state: Dict, match: Dict, pid: str) -> None:
    lane = match["lanes"][pid]
    uid = lane["field"][-1]["id"]
    effect = _card(state, uid)["effect"]
    if effect == "prince":
        lane["field"].pop()
        lane["exhaust"].append(uid)
    elif effect == "rescue_pod":
        lane["field"].pop()
        state["players"][pid]["deck"].remove(uid)
        _discard(state, uid)
        _market_to_lane(state, match, pid, "B", 1, "exhaust")
    elif effect == "comic_character":
        lane["next_attack_bonus"] += 2
    elif effect == "clairvoyant" and len(lane["draw"]) > 1:
        _choice(state, match, pid, "top", sorted(lane["draw"]), 1, 1, uid)
    elif effect == "navigator" and len(lane["draw"]) > 1:
        _choice(state, match, pid, "split", lane["draw"][:2], 1, 1, uid)
    elif effect == "chatbot":
        _fans(state, _opponent(match, pid), 1, match)


def _flag_effect(state: Dict, match: Dict, pid: str) -> None:
    uid = match["lanes"][pid]["field"][-1]["id"]
    effect = _card(state, uid)["effect"]
    if effect in ("clown", "heroine"):
        _fans(state, pid, 2 if effect == "clown" else 3, match)
    elif effect == "cowboy":
        other_id = _opponent(match, pid)
        other = match["lanes"][other_id]
        if other["draw"]:
            benched = other["draw"].pop(0)
            other["bench"].append(benched)
            _log(state, f"{_name(state, other_id)} · 🪑 {_card(state, benched)['name_zh']}", match)
            if len(_bench_names(state, other)) > 6:
                _end_match(state, match, pid, "bench_full")


def _total(state: Dict, pid: str) -> int:
    player = state["players"][pid]
    return player["fans"] + sum(t["fans"] for t in player["trophies"])


def _rank_key(state: Dict, pid: str) -> Tuple[int, int, int]:
    trophies = state["players"][pid]["trophies"]
    return _total(state, pid), len(trophies), max([t["round"] for t in trophies], default=0)


def _end_match(state: Dict, match: Dict, winner: str, reason: str) -> None:
    match.update(status="done", winner=winner, reason=reason, turn=None, pending=None, queue=[])
    if state["round"] <= 7 and (winner != ROBOT_ID or len(state["order"]) == 1):
        state["players"][winner]["trophies"].append({"round": state["round"], "fans": match["trophy"]})
    for pid in match["seats"]:
        state["players"][pid]["stage"] = "finished"
        state["players"][pid]["revision"] += 1
    _log(state, f"🏆 {_name(state, winner)} · {'对手替补席已满' if reason == 'bench_full' else '对手无法夺旗'}", match)
    if all(m["status"] == "done" for m in state["matches"]):
        state["phase"] = "round_end"
        state["next_ready"] = []
        if state["round"] == 8:
            state["winner"] = [winner]
            state["game_over"] = True
            state["phase"] = "game_over"
        elif len(state["order"]) <= 2:
            ranking = sorted(state["players"], key=lambda p: _rank_key(state, p), reverse=True)
            if state["round"] == 7 or _total(state, ranking[0]) - _total(state, ranking[1]) >= 11:
                state["winner"] = [p for p in ranking if _rank_key(state, p) == _rank_key(state, ranking[0])]
                state["game_over"] = True
                state["phase"] = "game_over"
        elif state["round"] == 7:
            ranking = sorted(state["order"], key=lambda p: _rank_key(state, p), reverse=True)
            state["finalists"] = ranking[:2]


def _attack_turn(state: Dict, match: Dict, pid: str) -> None:
    if not match["lanes"][pid]["draw"]:
        _end_match(state, match, _opponent(match, pid), "deck_empty")
    else:
        match["turn"] = pid
        state["players"][pid]["revision"] += 1


def _pump(state: Dict, match: Dict) -> None:
    while match["status"] == "playing" and match["queue"] and not match["pending"]:
        event = match["queue"].pop(0)
        pid, op = event["player"], event["op"]
        other = _opponent(match, pid)
        lane = match["lanes"][pid]
        if op == "immediate":
            _immediate(state, match, pid, event["card"])
        elif op == "compare":
            if match["holder"] is None:
                match["holder"] = pid
                match["queue"][0:0] = [{"op": "flag", "player": pid}, {"op": "turn", "player": other}]
            else:
                attack = sum(card_power(state, match, pid, entry, True) for entry in lane["field"])
                defense = card_power(state, match, other, match["lanes"][other]["field"][-1], False)
                if attack >= defense:
                    _log(state, f"🚩 {_name(state, pid)} · {attack} ≥ {defense}", match)
                    match["queue"][0:0] = [
                        {"op": "loss", "player": other}, {"op": "bench", "player": other},
                        {"op": "capture", "player": pid}, {"op": "flag", "player": pid},
                        {"op": "turn", "player": other},
                    ]
                else:
                    _attack_turn(state, match, pid)
        elif op == "loss":
            _loss_effect(state, match, pid)
        elif op == "bench":
            lane["bench"].extend(entry["id"] for entry in lane["field"])
            lane["field"] = []
            match["holder"] = None
            if len(_bench_names(state, lane)) > 6:
                _end_match(state, match, other, "bench_full")
        elif op == "capture":
            match["holder"] = pid
        elif op == "flag":
            _flag_effect(state, match, pid)
        elif op == "turn":
            _attack_turn(state, match, pid)


def _reveal(state: Dict, match: Dict, pid: str) -> None:
    lane = match["lanes"][pid]
    if not lane["draw"]:
        _end_match(state, match, _opponent(match, pid), "deck_empty")
        return
    uid = lane["draw"].pop(0)
    lane["field"].append({"id": uid, "bonus": 0, "attack_bonus": lane["next_attack_bonus"]})
    lane["next_attack_bonus"] = 0
    match["turn"] = None
    _log(state, f"{_name(state, pid)} · {_card(state, uid)['icon']} {_card(state, uid)['name_zh']}", match)
    match["queue"] = [{"op": "immediate", "player": pid, "card": uid}, {"op": "compare", "player": pid}]
    _pump(state, match)


def _resolve_choice(state: Dict, match: Dict, selected: List[str]) -> None:
    choice = match["pending"]
    _validate_selection(choice, selected)
    lane = match["lanes"][choice["target"]]
    kind = choice["kind"]
    if kind in ("exhaust", "recover"):
        for uid in selected:
            lane["bench"].remove(uid)
        if kind == "recover":
            lane["draw"][0:0] = selected
        else:
            lane["exhaust"].extend(selected)
    elif kind == "order":
        lane["draw"][:len(selected)] = selected
    elif kind == "split":
        other = next(uid for uid in choice["candidates"] if uid != selected[0])
        lane["draw"] = [selected[0]] + lane["draw"][2:] + [other]
    elif kind in ("top", "bottom"):
        lane["draw"].remove(selected[0])
        if kind == "top":
            lane["draw"].insert(0, selected[0])
        else:
            lane["draw"].append(selected[0])
    match["pending"] = None
    _pump(state, match)


def _validate_selection(choice: Dict, selected: List[str]) -> None:
    if len(set(selected)) != len(selected) or not set(selected) <= set(choice["candidates"]):
        raise ValueError("Choose only the available cards, without duplicates.")
    if not choice["min"] <= len(selected) <= choice["max"]:
        if not (choice.get("optional") and not selected):
            raise ValueError("Incorrect number of selected cards.")


def _begin_match(state: Dict, match: Dict) -> None:
    if match["status"] != "waiting" or not all(state["players"][p]["stage"] == "ready" for p in match["seats"]):
        return
    match["status"] = "playing"
    for pid in match["seats"]:
        player = state["players"][pid]
        player["stage"] = "match"
        player["revision"] += 1
        draw = list(player["deck"])
        _shuffle(state, draw)
        match["lanes"][pid] = {"draw": draw, "field": [], "bench": [], "exhaust": [], "next_attack_bonus": 0}
    starters = list(match["seats"])
    _shuffle(state, starters)
    starters.sort(key=lambda p: max([t["round"] for t in state["players"][p]["trophies"]], default=0), reverse=True)
    match["turn"] = starters[0]
    # The first card is the setup reveal, including all of its immediate effects.
    _reveal(state, match, starters[0])


def _automate_robot(state: Dict) -> None:
    if ROBOT_ID not in state["players"]:
        return
    for match in state["matches"]:
        for _ in range(400):
            if match["status"] != "playing" or match["turn"] != ROBOT_ID or match["pending"]:
                break
            _reveal(state, match, ROBOT_ID)
        else:
            raise ValueError("Robot match exceeded its action limit.")


def _schedule(seats: List[str]) -> List[List[List[str]]]:
    ring = list(seats)
    cycle = []
    for _ in range(len(ring) - 1):
        cycle.append([[ring[i], ring[-1 - i]] for i in range(len(ring) // 2)])
        ring = [ring[0], ring[-1], *ring[1:-1]]
    return [copy.deepcopy(cycle[r % len(cycle)]) for r in range(7)]


def _finish_picks(state: Dict, pid: str) -> None:
    player = state["players"][pid]
    if player["choice"]:
        return
    if player["picks_left"] <= 0 or not player["offer"]:
        for uid in player["offer"]:
            _discard(state, uid)
        player["offer"] = []
        player["picks_left"] = 0
        player["stage"] = "trim"


def _choose_level(state: Dict, pid: str, level: str) -> None:
    player = state["players"][pid]
    if level not in ROUND_OPTIONS[state["round"] - 1]:
        raise ValueError("That level is not available this round.")
    player.update(level=level, picks_left=ROUND_OPTIONS[state["round"] - 1][level], stage="pick")
    player["offer"] = _draw_market(state, level, 5)
    _finish_picks(state, pid)


def _start_round(state: Dict) -> None:
    final = state["round"] == 8
    state["phase"] = "final" if final else "round"
    state["next_ready"] = []
    pairings = [state["finalists"]] if final else state["schedule"][state["round"] - 1]
    for pid, player in state["players"].items():
        stage = "ready" if pid == ROBOT_ID else "trim" if final and pid in state["finalists"] else "spectating" if final else "choose_level"
        player.update(stage=stage, offer=[], choice=None, level=None, picks_left=0, redrawn=False)
        player["revision"] += 1
    state["matches"] = [
        {"id": i, "seats": list(seats), "status": "waiting", "holder": None, "turn": None,
         "lanes": {}, "pending": None, "queue": [], "winner": None, "reason": None, "log": [],
         "trophy": None if final else state["trophies"][state["round"] - 1][i]}
        for i, seats in enumerate(pairings)
    ]
    if not final:
        options = ROUND_OPTIONS[state["round"] - 1]
        if len(options) == 1:
            for pid in state["order"]:
                _choose_level(state, pid, next(iter(options)))
    _log(state, "🏁 决赛" if final else f"🌳 第 {state['round']} 轮")


def _own_match(state: Dict, pid: str) -> Optional[Dict]:
    return next((match for match in state["matches"] if pid in match["seats"]), None)


def _apply(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    kind = action["type"]
    match = _own_match(state, pid)
    if kind == "choose_level":
        _choose_level(state, pid, action["level"])
    elif kind == "pick":
        uid = action["card_id"]
        if uid not in player["offer"]:
            raise ValueError("That card is not in your offer.")
        player["offer"].remove(uid)
        player["deck"].append(uid)
        player["picks_left"] -= 1
        effect = _card(state, uid)["effect"]
        if effect == "clones":
            _fans(state, pid, 1)
        elif effect in ("shapeshifter", "scifi_geek") and len(player["offer"]) > player["picks_left"]:
            candidates = [cid for cid in player["deck"] if effect == "shapeshifter" or _card(state, cid)["set"] == "space"]
            count = 1 if effect == "shapeshifter" else 2
            if len(candidates) >= count:
                player["choice"] = {"kind": "extra_pick", "candidates": candidates, "min": count,
                                    "max": count, "source": uid, "optional": True}
        _finish_picks(state, pid)
    elif kind == "redraw":
        count = len(player["offer"])
        # Draw before returning this offer, so a refill cannot immediately redraw it.
        replacement = _draw_market(state, player["level"], count)
        for uid in player["offer"]:
            _discard(state, uid)
        player["offer"] = replacement
        player["redrawn"] = True
        _finish_picks(state, pid)
    elif kind == "resolve":
        selected = action["card_ids"]
        if player["choice"]:
            _validate_selection(player["choice"], selected)
            for uid in selected:
                player["deck"].remove(uid)
                _discard(state, uid)
            if selected:
                player["picks_left"] += 1
            player["choice"] = None
            _finish_picks(state, pid)
        else:
            _resolve_choice(state, match, selected)
    elif kind == "ready":
        remove = action["remove_ids"]
        if len(set(remove)) != len(remove) or not set(remove) <= set(player["deck"]):
            raise ValueError("You can only remove cards from your own deck.")
        for uid in remove:
            player["deck"].remove(uid)
            _discard(state, uid)
        player["stage"] = "ready"
        _begin_match(state, match)
    elif kind == "reveal":
        _reveal(state, match, pid)
    elif kind == "next_round":
        state["next_ready"].append(pid)
        if set(state["next_ready"]) == set(state["order"]):
            state["round"] += 1
            _start_round(state)
    player["revision"] += 1
    _automate_robot(state)


def _card_view(state: Dict, uid: str) -> Dict:
    return {**CARDS[_kind(state, uid)], "id": uid, "level": state["cards"][uid]["level"], "power": _base(state, uid)}


def _choice_view(state: Dict, choice: Dict) -> Dict:
    return {"kind": choice["kind"], "min": choice["min"], "max": choice["max"],
            "optional": bool(choice.get("optional")), "source": _card_view(state, choice["source"]),
            "target": choice.get("target"), "cards": [_card_view(state, uid) for uid in choice["candidates"]]}


def validate_state(state: Dict) -> None:
    """Validate persisted IDs and ownership, including the redundant match zones."""
    try:
        assert state["game_id"] == "challengers" and state["version"] == 1
        assert type(state["round"]) is int and 1 <= state["round"] <= 8
        assert state["phase"] in ("round", "round_end", "final", "game_over")
        assert 1 <= len(state["order"]) <= 8 and len(set(state["order"])) == len(state["order"])
        assert ROBOT_ID not in state["order"]
        expected = set(state["order"]) | ({ROBOT_ID} if len(state["order"]) % 2 else set())
        assert set(state["players"]) == expected
        assert set(state["next_ready"]) <= set(state["order"])
        assert len(state["next_ready"]) == len(set(state["next_ready"]))
        assert set(state["winner"]) <= expected and set(state["finalists"]) <= set(state["order"])
        assert type(state["game_over"]) is bool
        assert state["game_over"] == (state["phase"] == "game_over")
        random.Random().setstate(_tuple_tree(state["rng"]))
        assert _CONFIG.is_valid(state["config"])
        assert len(state["schedule"]) == 7
        for pairings in state["schedule"]:
            assert Counter(p for pair in pairings for p in pair) == Counter(expected)
            assert all(len(pair) == 2 for pair in pairings)
        assert len(state["trophies"]) == 7
        for i, values in enumerate(state["trophies"]):
            assert sorted(values) == sorted(TROPHY_VALUES[i])
        locations = list(state["removed"])
        for level in "ABC":
            for zone in ("market", "discards"):
                for uid in state[zone][level]:
                    assert state["cards"][uid]["level"] == level
                locations.extend(state[zone][level])
        for player in state["players"].values():
            assert player["stage"] in ("choose_level", "pick", "trim", "ready", "match", "finished", "spectating")
            assert type(player["revision"]) is int and player["revision"] >= 0
            assert type(player["fans"]) is int and player["fans"] >= 0
            assert 0 <= player["picks_left"] <= 5 and type(player["redrawn"]) is bool
            assert all(t["round"] <= min(7, state["round"]) and t["fans"] in TROPHY_VALUES[t["round"] - 1]
                       for t in player["trophies"])
            locations.extend(player["deck"])
            locations.extend(player["offer"])
            if player["choice"]:
                assert player["choice"]["kind"] == "extra_pick"
                assert set(player["choice"]["candidates"]) <= set(player["deck"])
        assert len(locations) == len(set(locations))
        assert set(locations) == set(state["cards"])
        for card in state["cards"].values():
            assert card["kind"] in CARDS
            assert card["level"] in ("S", "A", "B", "C", "R", "SOLO")
            assert card["level"] == CARDS[card["kind"]]["level"] or (card["level"] == "S" and card["kind"] in STARTER)
        for match in state["matches"]:
            assert len(match["seats"]) == 2 and len(set(match["seats"])) == 2
            assert set(match["seats"]) <= expected
            assert match["status"] in ("waiting", "playing", "done")
            assert match["holder"] is None or match["holder"] in match["seats"]
            assert match["turn"] is None or match["turn"] in match["seats"]
            for pid, lane in match["lanes"].items():
                zones = lane["draw"] + lane["bench"] + lane["exhaust"] + [c["id"] for c in lane["field"]]
                assert Counter(zones) == Counter(state["players"][pid]["deck"])
                if match["status"] == "playing":
                    assert len(_bench_names(state, lane)) <= 6
            if match["pending"]:
                choice = match["pending"]
                assert choice["player_id"] in match["seats"] and choice["target"] in match["seats"]
                zone = "bench" if choice["kind"] in ("exhaust", "recover") else "draw"
                assert set(choice["candidates"]) <= set(match["lanes"][choice["target"]][zone])
                assert choice["source"] in state["cards"]
    except (AssertionError, KeyError, TypeError, ValueError, IndexError) as exc:
        raise ValueError("Invalid Challengers save.") from exc


class ChallengersGame:
    game_id = "challengers"
    min_players = 1
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = copy.deepcopy(config or {})
        if not _CONFIG.is_valid(cfg) or any(type(cfg[key]) is not int for key in ("seed", "robot_level") if key in cfg):
            raise ValueError("Invalid Challengers configuration.")
        if not 1 <= len(players) <= 8:
            raise ValueError("Challengers requires 1–8 players.")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p["player_id"] for p in ordered]
        if any(not isinstance(pid, str) or not pid or pid == ROBOT_ID for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("Player IDs must be unique nonempty strings.")
        rng = random.Random(cfg.pop("seed", None))
        version, numbers, gaussian = rng.getstate()
        state = {"game_id": "challengers", "version": 1, "rng": [version, list(numbers), gaussian],
                 "config": {"exclude_set": cfg.get("exclude_set", "random"), "robot_level": cfg.get("robot_level", 1),
                            "solo_special": cfg.get("solo_special", False)},
                 "order": ids, "players": {}, "cards": {}, "market": {l: [] for l in "ABC"},
                 "discards": {l: [] for l in "ABC"}, "removed": [], "round": 1, "phase": "round",
                 "next_ready": [], "matches": [], "winner": [], "game_over": False, "finalists": [], "log": [],
                 "current_turn": None}
        themes = [s for s in SETS if s not in ("city", "robot")]
        if state["config"]["exclude_set"] == "random":
            _shuffle(state, themes)
            excluded = themes[-1]
        else:
            excluded = state["config"]["exclude_set"]
        state["sets"] = ["city"] + [s for s in SETS if s not in ("city", "robot", excluded)]
        for kind, card in CARDS.items():
            if card["set"] in state["sets"] and card["level"] in "ABC":
                state["market"][card["level"]].extend(_new_card(state, kind) for _ in range(card["copies"]))
        for pile in state["market"].values():
            _shuffle(state, pile)
        for raw in ordered:
            pid = raw["player_id"]
            state["players"][pid] = {"name": raw.get("name", pid), "is_bot": bool(raw.get("is_bot")),
                                     "deck": [_new_card(state, kind, "S") for kind in STARTER],
                                     "fans": 0, "trophies": [], "revision": 0}
        seats = list(ids)
        if len(ids) % 2:
            robot = list(ROBOT_STARTER)
            upgrades = [cid for cid, card in CARDS.items() if card["level"] == "R" or
                        (len(ids) == 1 and cfg.get("solo_special") and card["level"] == "SOLO")]
            _shuffle(state, upgrades)
            level = state["config"]["robot_level"]
            for i, kind in enumerate(("alpha", "beta", "good_bot", "champ_bot"), start=2):
                if level >= i:
                    robot.remove(kind)
                    for _ in range(2 if i == 5 else 1):
                        robot.append(upgrades.pop())
            state["players"][ROBOT_ID] = {"name": "Robot", "is_bot": True,
                                           "deck": [_new_card(state, k) for k in robot],
                                           "fans": 0, "trophies": [], "revision": 0}
            seats.append(ROBOT_ID)
        _shuffle(state, seats)
        state["schedule"] = _schedule(seats)
        state["trophies"] = copy.deepcopy(TROPHY_VALUES)
        for row in state["trophies"]:
            _shuffle(state, row)
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["order"]:
            return []
        if state["phase"] == "round_end":
            return [] if player_id in state["next_ready"] else ["next_round"]
        player = state["players"][player_id]
        if player["choice"]:
            return ["resolve"]
        if player["stage"] == "choose_level":
            return ["choose_level"]
        if player["stage"] == "pick":
            return ["pick"] + ([] if player["redrawn"] else ["redraw"])
        if player["stage"] == "trim":
            return ["ready"]
        match = _own_match(state, player_id)
        if match and match["status"] == "playing":
            if match["pending"]:
                return ["resolve"] if match["pending"]["player_id"] == player_id else []
            if match["turn"] == player_id:
                return ["reveal"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTIONS.is_valid(action):
            return [], "Invalid action format."
        if any(type(action[k]) is not int for k in ("round", "revision")):
            return [], "Round and revision must be integers."
        if player_id not in state["order"]:
            return [], "Player not found."
        if action["round"] != state["round"] or action["revision"] != state["players"][player_id]["revision"]:
            return [], "This action is out of date. Please try again."
        if action["type"] not in ChallengersGame.get_legal_actions(state, player_id):
            return [], "Action unavailable."
        updated = copy.deepcopy(state)
        try:
            _apply(updated, player_id, action)
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            return [], str(exc) if isinstance(exc, ValueError) else "Invalid action target."
        state.clear()
        state.update(updated)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id) if viewer_id in state["order"] else None
        reveal_scores = len(state["order"]) <= 2 or state["round"] == 8 or state["game_over"] or (state["round"] == 7 and state["phase"] == "round_end")
        players = []
        for pid, player in state["players"].items():
            visible = reveal_scores or pid == viewer_id
            players.append({"player_id": pid, "name": player["name"], "is_bot": player["is_bot"], "robot": pid == ROBOT_ID,
                            "stage": player["stage"], "fans": player["fans"], "deck_count": len(player["deck"]),
                            "trophies": [{"round": t["round"], "fans": t["fans"] if visible else None} for t in player["trophies"]],
                            "total": _total(state, pid) if visible else None, "ready": pid in state["next_ready"]})
        choice = _choice_view(state, own["choice"]) if own and own["choice"] else None
        matches = []
        for match in state["matches"]:
            lanes = {}
            for pid, lane in match["lanes"].items():
                field = [{**_card_view(state, e["id"]), "bonus": e["bonus"],
                          "total_power": card_power(state, match, pid, e, match["holder"] != pid)} for e in lane["field"]]
                power = field[-1]["total_power"] if field and match["holder"] == pid else sum(c["total_power"] for c in field)
                lanes[pid] = {"field": field, "bench": [_card_view(state, uid) for uid in lane["bench"]],
                              "exhaust": [_card_view(state, uid) for uid in lane["exhaust"]],
                              "draw_count": len(lane["draw"]), "power": power,
                              "bench_count": len(_bench_names(state, lane))}
            pending = match["pending"]
            if own and pending and pending["player_id"] == viewer_id:
                choice = _choice_view(state, pending)
            matches.append({"id": match["id"], "seats": match["seats"], "status": match["status"],
                            "holder": match["holder"], "turn": match["turn"], "lanes": lanes,
                            "choosing": pending["player_id"] if pending else None, "winner": match["winner"],
                            "reason": match["reason"], "log": match["log"],
                            "trophy": match["trophy"] if match["status"] == "done" and
                            (reveal_scores or match["winner"] == viewer_id) else None})
        legal = ChallengersGame.get_legal_actions(state, viewer_id)
        return copy.deepcopy({
            "game_id": "challengers", "you": viewer_id, "phase": state["phase"], "round": state["round"],
            "players": players, "matches": matches, "sets": state["sets"], "set_info": SETS,
            "config": state["config"], "game_over": state["game_over"], "winner": state["winner"],
            "finalists": state["finalists"], "schedule": state["schedule"], "next_ready": state["next_ready"],
            "stage": own["stage"] if own else "spectating", "revision": own["revision"] if own else 0,
            "deck": [_card_view(state, uid) for uid in sorted(own["deck"])] if own and own["stage"] != "match" else [],
            "offer": [_card_view(state, uid) for uid in own["offer"]] if own else [],
            "level": own["level"] if own else None, "picks_left": own["picks_left"] if own else 0,
            "redrawn": own["redrawn"] if own else False,
            "level_options": ROUND_OPTIONS[state["round"] - 1] if state["round"] <= 7 else {},
            "choice": choice, "legal_actions": legal, "catalog": CARDS, "log": state["log"],
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.challengers_ai import choose_action
        return choose_action(ChallengersGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        result = copy.deepcopy(payload)
        validate_state(result)
        return result
