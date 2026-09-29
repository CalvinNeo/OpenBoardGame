"""Server-authoritative, serializable Gloomhaven tactical encounters.

All mutations are validated against the same discrete choices sent to a player.
Bots consume only that player's view. Original content lives in gloomhaven_data.
"""
import copy
import heapq
import itertools
import json
import math
import random
import secrets
from typing import Dict, List, Optional, Tuple

from game.gloomhaven_data import CARDS, CLASSES, CONDITIONS, ELEMENTS, MONSTER_CARDS, MONSTERS, SCENARIOS, build_map

CONTEXT = ("game_token", "scenario_attempt", "round", "revision")
DIRECTIONS = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))
CONFIG_SCHEMA = {"type": "object", "properties": {
    "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    "scenario": {"type": "integer", "minimum": 1, "maximum": 3},
    "difficulty": {"type": "integer", "minimum": 0, "maximum": 2},
}, "additionalProperties": False}
_FIELDS = {
    "choose_class": {"hero_id": {"type": "string"}, "class_id": {"enum": list(CLASSES)}},
    "configure": {"scenario": {"type": "integer"}, "difficulty": {"type": "integer"}},
    "ready": {}, "unready": {}, "next_round": {}, "continue": {},
    "plan": {"hero_id": {"type": "string"}, "cards": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2}},
    "undo_plan": {"hero_id": {"type": "string"}}, "long_rest": {"hero_id": {"type": "string"}},
    "short_rest": {"hero_id": {"type": "string"}}, "rest_accept": {"hero_id": {"type": "string"}},
    "rest_redraw": {"hero_id": {"type": "string"}},
    "rest_lose": {"hero_id": {"type": "string"}, "card": {"type": "string"}},
    "half": {"hero_id": {"type": "string"}, "card": {"type": "string"}, "half": {"enum": ["top", "bottom"]}, "basic": {"type": "boolean"}},
    "move": {"hero_id": {"type": "string"}, "q": {"type": "integer"}, "r": {"type": "integer"}},
    "target": {"hero_id": {"type": "string"}, "target": {"type": "string"}},
    "skip": {"hero_id": {"type": "string"}}, "end_turn": {"hero_id": {"type": "string"}},
    "consume": {"hero_id": {"type": "string"}},
    "item": {"hero_id": {"type": "string"}, "item": {"enum": ["potion", "boots"]}},
    "damage": {"hero_id": {"type": "string"}, "cards": {"type": "array", "items": {"type": "string"}, "maxItems": 2}},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {"type": {"const": kind}, **fields,
     "game_token": {"type": "string"}, **{k: {"type": "integer"} for k in CONTEXT[1:]}},
     "required": ["type", *CONTEXT, *fields], "additionalProperties": False}
    for kind, fields in _FIELDS.items()
]}


def distance(a: List[int], b: List[int]) -> int:
    dq, dr = a[0] - b[0], a[1] - b[1]
    return max(abs(dq), abs(dr), abs(dq + dr))


def _rng(state: Dict) -> random.Random:
    rng = random.Random(f'{state["seed"]}:{state["random_counter"]}')
    state["random_counter"] += 1
    return rng


def _log(state: Dict, text: str, hero_id: Optional[str] = None) -> None:
    entry = {"round": state["round"], "text": text, "hero_id": hero_id}
    state["log"].append(entry)
    if hero_id and "round_report" in state:
        state["round_report"].append(copy.deepcopy(entry))
    state["log"] = state["log"][-100:]


def _name(unit: Dict) -> str:
    return CLASSES[unit["class_id"]]["name"] if "class_id" in unit else f'{MONSTERS[unit["kind"]]["name"]} {unit["number"]}'


def _unit(state: Dict, uid: str) -> Dict:
    return state["heroes"].get(uid) or state["monsters"][uid]


def _alive(unit: Dict) -> bool:
    return not unit.get("exhausted", unit.get("dead", False))


def _units(state: Dict) -> List[Dict]:
    return [h for h in state["heroes"].values() if _alive(h)] + [
        m for m in state["monsters"].values() if _alive(m) and m["room"] in state["revealed"]]


def _cell(state: Dict, pos: List[int]) -> Optional[Dict]:
    return next((c for c in state["cells"] if [c["q"], c["r"]] == pos), None)


def _visible_cell(state: Dict, cell: Dict) -> bool:
    return cell["room"] in state["revealed"]


def _cube_round(q: float, r: float) -> List[int]:
    x, z, y = q, r, -q - r
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dz > dy:
        rz = -rx - ry
    return [rx, rz]


def line_of_sight(state: Dict, start: List[int], end: List[int]) -> bool:
    """Center-ray visibility; either infinitesimal edge nudge may clear a wall."""
    steps = distance(start, end)
    if steps < 2:
        return True
    for epsilon in (1e-6, -1e-6):
        clear = True
        for i in range(1, steps):
            t = i / steps
            pos = _cube_round(start[0] + (end[0] - start[0]) * t + epsilon,
                              start[1] + (end[1] - start[1]) * t + epsilon)
            cell = _cell(state, pos)
            if not cell or not _visible_cell(state, cell) or (cell["terrain"] == "door" and not cell["open"]):
                clear = False
                break
        if clear:
            return True
    return False


def paths(state: Dict, unit: Dict, budget: int, jump: bool = False, avoid_traps: bool = False) -> Dict:
    """Dijkstra paths; friendly figures are traversable but never destinations.

    Doors are terminal nodes so hidden terrain cannot influence a player's path.
    Monsters cannot cross closed doors. Obstacles block movement, not sight.
    """
    start = tuple(unit["pos"])
    cells = {(c["q"], c["r"]): c for c in state["cells"] if _visible_cell(state, c)}
    hero = "class_id" in unit
    occupied = {tuple(u["pos"]): u for u in _units(state) if u["id"] != unit["id"]}
    best, routes, queue = {start: 0}, {start: []}, [(0, start)]
    while queue:
        cost, here = heapq.heappop(queue)
        if cost != best[here]:
            continue
        cell = cells[here]
        if here != start and cell["terrain"] == "door" and not cell["open"]:
            continue
        for dq, dr in DIRECTIONS:
            dest = (here[0] + dq, here[1] + dr)
            cell = cells.get(dest)
            if not cell or (not jump and cell["terrain"] == "obstacle"):
                continue
            if cell["terrain"] == "door" and not cell["open"] and not hero:
                continue
            if avoid_traps and cell["terrain"] == "trap":
                continue
            blocker = occupied.get(dest)
            if blocker and ("class_id" in blocker) != hero and not jump:
                continue
            new = cost + (2 if cell["terrain"] == "difficult" and not jump else 1)
            if new <= budget and new < best.get(dest, math.inf):
                best[dest], routes[dest] = new, routes[here] + [list(dest)]
                heapq.heappush(queue, (new, dest))
    return {pos: {"cost": best[pos], "path": path} for pos, path in routes.items()
            if pos != start and pos not in occupied and cells[pos]["terrain"] != "obstacle"}


def _modifier_deck(state: Dict) -> Dict:
    draw = [0] * 6 + [-1] * 5 + [1] * 5 + [-2, 2, "miss", "double"]
    _rng(state).shuffle(draw)
    return {"draw": draw, "discard": [], "shuffle": False}


def _shuffle_deck(state: Dict, deck: Dict) -> None:
    deck["draw"].extend(deck["discard"])
    deck["discard"] = []
    _rng(state).shuffle(deck["draw"])
    deck["shuffle"] = False


def _draw_modifier(state: Dict, deck: Dict) -> object:
    if not deck["draw"]:
        _shuffle_deck(state, deck)
    card = deck["draw"].pop()
    deck["discard"].append(card)
    if card in ("miss", "double"):
        deck["shuffle"] = True
    return card


def _modified(value: int, modifier: object) -> int:
    return 0 if modifier == "miss" else value * 2 if modifier == "double" else max(0, value + modifier)


def _condition(unit: Dict, kind: str) -> None:
    unit["conditions"][kind] = None if kind in ("poison", "wound") else unit["turns"] + 1


def _heal(state: Dict, unit: Dict, value: int) -> None:
    poisoned = "poison" in unit["conditions"]
    unit["conditions"].pop("poison", None)
    unit["conditions"].pop("wound", None)
    before = unit["hp"]
    if not poisoned:
        unit["hp"] = min(unit["max_hp"], unit["hp"] + value)
    _log(state, f'{_name(unit)} 治疗：恢复 {unit["hp"] - before} ❤️' + ("，清除中毒" if poisoned else ""))


def _exhaust(state: Dict, hero: Dict) -> None:
    if hero["exhausted"]:
        return
    hero["exhausted"] = True
    hero["lost"] = list(hero["deck"])
    hero["hand"], hero["discard"], hero["played"] = [], [], []
    hero["plan"], hero["rest_pending"] = None, None
    if state.get("active") and state["active"]["hero_id"] == hero["id"]:
        state["active"] = None
    _log(state, f'{_name(hero)} 耗尽', hero["id"])


def _hurt_monster(state: Dict, monster: Dict, amount: int, killer: Optional[Dict] = None) -> None:
    monster["hp"] = max(0, monster["hp"] - amount)
    if monster["hp"] == 0 and not monster["dead"]:
        monster["dead"] = True
        _cell(state, monster["pos"])["coins"] += 1
        if killer:
            killer["kills"] += 1
        _log(state, f'{_name(monster)} 被击败，掉落 💰')


def _hurt(state: Dict, unit: Dict, amount: int, source: str) -> None:
    if amount <= 0:
        return
    if "class_id" in unit:
        state["damage"] = {"hero_id": unit["id"], "amount": amount, "source": source}
    else:
        _hurt_monster(state, unit, amount)


def _attack(state: Dict, attacker: Dict, target: Dict, ability: Dict) -> None:
    attack = ability["value"] + int("poison" in target["conditions"])
    advantage = "strengthen" in attacker["conditions"]
    disadvantage = "muddle" in attacker["conditions"] or (ability.get("range", 1) > 1 and distance(attacker["pos"], target["pos"]) == 1)
    deck = attacker["modifier"] if "class_id" in attacker else state["monster_modifier"]
    drawn = [_draw_modifier(state, deck)]
    if advantage != disadvantage:
        drawn.append(_draw_modifier(state, deck))
    modifier = (max if advantage and not disadvantage else min)(drawn, key=lambda card: _modified(attack, card))
    shield = target.get("shield", 0) + target["round_shield"]
    damage = max(0, _modified(attack, modifier) - max(0, shield - ability.get("pierce", 0)))
    state["last_attack"] = {"attacker": attacker["id"], "target": target["id"], "base": attack,
                            "attacker_name": _name(attacker), "target_name": _name(target),
                            "drawn": drawn, "modifier": modifier, "damage": damage}
    _log(state, f'{_name(attacker)} → {_name(target)}：⚔️ {damage}（修正 {modifier}）', attacker["id"] if "class_id" in attacker else target["id"])
    if ability.get("condition"):
        _condition(target, ability["condition"])
    if "class_id" in target:
        _hurt(state, target, damage, _name(attacker))
    else:
        _hurt_monster(state, target, damage, attacker if "class_id" in attacker else None)


def _draw_monster(state: Dict, kind: str) -> Dict:
    if kind in state["monster_cards"]:
        return state["monster_cards"][kind]
    deck = state["monster_decks"][kind]
    if not deck["draw"]:
        _shuffle_deck(state, deck)
    index = deck["draw"].pop()
    deck["discard"].append(index)
    card = copy.deepcopy(MONSTER_CARDS[index])
    if card.get("shuffle"):
        deck["shuffle"] = True
    state["monster_cards"][kind] = card
    return card


def _initiative(state: Dict, unit: Dict) -> tuple:
    if "class_id" in unit:
        return (unit["initiative"], 0, unit.get("secondary_initiative", 99), unit["id"])
    return (state["monster_cards"][unit["kind"]]["initiative"], 1, unit["kind"], not unit["elite"], unit["number"])


def _reveal(state: Dict) -> None:
    if 2 in state["revealed"]:
        return
    state["revealed"].append(2)
    _log(state, "🚪 门已开启：第二间房间出现")
    fresh = [m for m in state["monsters"].values() if m["room"] == 2 and _alive(m)]
    for monster in fresh:
        _draw_monster(state, monster["kind"])
    # Lower-initiative newly revealed monsters act immediately after the opener.
    tail = state["queue"][state["queue_index"] + 1:] + [m["id"] for m in fresh]
    tail.sort(key=lambda uid: _initiative(state, _unit(state, uid)))
    state["queue"] = state["queue"][:state["queue_index"] + 1] + tail


def _monster_focus(state: Dict, monster: Dict, attack_range: int) -> Optional[Tuple[Dict, List[List[int]]]]:
    targets = [h for h in state["heroes"].values() if _alive(h)]
    for safe in (True, False):
        routes = paths(state, monster, 100, avoid_traps=safe)
        routes[tuple(monster["pos"])] = {"cost": 0, "path": []}
        candidates = []
        for target in targets:
            firing = [(data["cost"], pos, data["path"]) for pos, data in routes.items()
                      if distance(list(pos), target["pos"]) <= attack_range and line_of_sight(state, list(pos), target["pos"])]
            if firing:
                cost, pos, route = min(firing)
                candidates.append((cost, distance(monster["pos"], target["pos"]), _initiative(state, target), target["id"], route))
        if candidates:
            best = min(candidates)
            target, route = state["heroes"][best[3]], best[4]
            return target, route
    return None


def _monster_turn(state: Dict, monster: Dict) -> None:
    card = state["monster_cards"][monster["kind"]]
    if "stun" in monster["conditions"]:
        return
    monster["round_shield"] = card.get("shield", 0)
    attack_range = 1 if "disarm" in monster["conditions"] else monster["range"]
    focus = _monster_focus(state, monster, attack_range if "disarm" not in monster["conditions"] else 1)
    if not focus:
        return
    target, route = focus
    budget = 0 if card["move"] is None or "immobilize" in monster["conditions"] else max(0, monster["move"] + card["move"])
    if budget:
        reachable = paths(state, monster, budget, avoid_traps=True)
        in_range = [(int(attack_range > 1 and distance(list(pos), target["pos"]) == 1), data["cost"], pos, data["path"])
                    for pos, data in reachable.items() if distance(list(pos), target["pos"]) <= attack_range
                    and line_of_sight(state, list(pos), target["pos"])]
        if distance(monster["pos"], target["pos"]) <= attack_range and line_of_sight(state, monster["pos"], target["pos"]):
            in_range.append((int(attack_range > 1 and distance(monster["pos"], target["pos"]) == 1), 0, tuple(monster["pos"]), []))
        if in_range:
            route = min(in_range)[3]
        spent, destination = 0, None
        occupied = {tuple(u["pos"]) for u in _units(state) if u["id"] != monster["id"]}
        for pos in route:
            cell = _cell(state, pos)
            spent += 2 if cell["terrain"] == "difficult" else 1
            if spent > budget:
                break
            if tuple(pos) not in occupied:
                destination = pos
        if destination:
            for pos in route[:route.index(destination) + 1]:
                monster["pos"] = pos
                cell = _cell(state, pos)
                if cell["terrain"] == "trap":
                    cell["terrain"] = "floor"
                    _hurt_monster(state, monster, 2 + state["difficulty"])
                    if not _alive(monster):
                        return
    if "disarm" not in monster["conditions"] and distance(monster["pos"], target["pos"]) <= attack_range and line_of_sight(state, monster["pos"], target["pos"]):
        _attack(state, monster, target, {"value": max(0, monster["attack"] + card["attack"]), "range": attack_range,
                                       **({"condition": card["condition"]} if card.get("condition") else {})})


def _end_turn(state: Dict, unit: Dict) -> None:
    for kind, expiry in list(unit["conditions"].items()):
        if expiry is not None and expiry <= unit["turns"]:
            del unit["conditions"][kind]
    if "class_id" in unit:
        if _alive(unit):
            _loot(state, unit, 0)
            for element in unit["infusions"]:
                state["elements"][element] = 2
        unit["infusions"] = []
        for card in unit["played"][:]:
            unit["discard"].append(card)
        unit["played"] = []
    state["active"] = None
    state["current"] = None
    state["queue_index"] += 1


def _loot(state: Dict, hero: Dict, radius: int) -> None:
    found = 0
    for cell in state["cells"]:
        pos = [cell["q"], cell["r"]]
        if _visible_cell(state, cell) and distance(hero["pos"], pos) <= radius and line_of_sight(state, hero["pos"], pos):
            found += cell["coins"]
            cell["coins"] = 0
    if found:
        hero["gold"] += found * (2 + state["difficulty"])
        _log(state, f'{_name(hero)} 拾取 {found} 💰', hero["id"])


def _finish_scenario(state: Dict, won: bool) -> None:
    if state["phase"] in ("scenario_review", "game_over"):
        return
    if won:
        for hero in state["heroes"].values():
            hero["xp"] += 4 + 2 * state["difficulty"]
    result = {"scenario": state["scenario"], "attempt": state["scenario_attempt"], "won": won, "rounds": state["round"],
              "heroes": [{"id": h["id"], "class_id": h["class_id"], "xp": h["xp"], "gold": h["gold"], "kills": h["kills"]} for h in state["heroes"].values()]}
    state["results"].append(result)
    state.update(result=result, ready=[], current=None, active=None, damage=None)
    final = won and state["scenario"] == len(SCENARIOS)
    state.update(phase="game_over" if final else "scenario_review", game_over=final,
                 winner_ids=list(state["player_meta"]) if final else [])
    _log(state, "🏆 遭遇胜利" if won else "所有佣兵耗尽，遭遇失败")


def _end_round(state: Dict) -> None:
    for element in ELEMENTS:
        state["elements"][element] = max(0, state["elements"][element] - 1)
    for unit in _units(state):
        unit["round_shield"] = 0
    decks = [h["modifier"] for h in state["heroes"].values()] + [state["monster_modifier"], *state["monster_decks"].values()]
    for deck in decks:
        if deck["shuffle"]:
            _shuffle_deck(state, deck)
    if all(m["dead"] for m in state["monsters"].values()):
        _finish_scenario(state, True)
    else:
        state.update(phase="round_review", ready=[], current=None, active=None)
        _log(state, "本轮结束，等待全员 Next Round")


def _pump(state: Dict) -> None:
    """Resolve automatic work until a human decision or a review barrier."""
    if state["phase"] != "acting" or state["damage"]:
        return
    while state["phase"] == "acting" and not state["damage"]:
        if not any(_alive(h) for h in state["heroes"].values()):
            _finish_scenario(state, False)
            return
        if state["queue_index"] >= len(state["queue"]):
            _end_round(state)
            return
        unit = _unit(state, state["queue"][state["queue_index"]])
        if not _alive(unit):
            state["queue_index"] += 1
            state["current"] = None
            continue
        if state["current"] is None:
            state["current"] = unit["id"]
            unit["turns"] += 1
            if "wound" in unit["conditions"]:
                _hurt(state, unit, 1, "创伤 🩸")
                if state["damage"]:
                    return
                if not _alive(unit):
                    continue
        if "class_id" in unit:
            if state["active"]:
                _progress_active(state)
            return
        _monster_turn(state, unit)
        _end_turn(state, unit)


def _start_round(state: Dict) -> None:
    state.update(phase="planning", ready=[], current=None, active=None, damage=None, queue=[], queue_index=0, monster_cards={}, round_report=[])
    for hero in state["heroes"].values():
        hero.update(plan=None, played=[], used=[], infusions=[], initiative=None)
        if _alive(hero) and len(hero["hand"]) < 2 and len(hero["discard"]) < 2:
            _exhaust(state, hero)
    if not any(_alive(h) for h in state["heroes"].values()):
        _finish_scenario(state, False)


def _reveal_plans(state: Dict) -> None:
    heroes = [h for h in state["heroes"].values() if _alive(h)]
    if any(h["plan"] is None for h in heroes):
        return
    state["phase"] = "acting"
    for hero in heroes:
        hero["initiative"] = 99 if hero["plan"]["rest"] else CARDS[hero["played"][0]]["initiative"]
        hero["secondary_initiative"] = 99 if hero["plan"]["rest"] else CARDS[hero["played"][1]]["initiative"]
    monsters = [m for m in state["monsters"].values() if _alive(m) and m["room"] in state["revealed"]]
    for kind in sorted({m["kind"] for m in monsters}):
        _draw_monster(state, kind)
    state["queue"] = [u["id"] for u in sorted(heroes + monsters, key=lambda u: _initiative(state, u))]
    _log(state, "双卡与怪物行动已公开，按先攻开始行动")
    _pump(state)


def _start_scenario(state: Dict) -> None:
    party = len(state["heroes"])
    board = build_map(state["scenario"], party, state["difficulty"])
    state.update(**board, round=1, revealed=[1], elements={e: 0 for e in ELEMENTS},
                 log=[], last_attack=None, result=None)
    for index, hero in enumerate(state["heroes"].values()):
        cls = CLASSES[hero["class_id"]]
        cards = [cid for cid, card in CARDS.items() if card["class_id"] == hero["class_id"]]
        hero.update(hp=cls["hp"], max_hp=cls["hp"], deck=cards, hand=cards[:], discard=[], lost=[],
                    pos=[0, index], exhausted=False, conditions={}, turns=0, round_shield=0,
                    items={"potion": "ready", "boots": "ready"}, rest_pending=None, rested_round=None, modifier=_modifier_deck(state),
                    plan=None, played=[], used=[], infusions=[], initiative=None)
    state["monster_modifier"] = _modifier_deck(state)
    state["monster_decks"] = {}
    for kind in MONSTERS:
        draw = list(range(len(MONSTER_CARDS)))
        _rng(state).shuffle(draw)
        state["monster_decks"][kind] = {"draw": draw, "discard": [], "shuffle": False}
    _log(state, f'进入 {SCENARIOS[state["scenario"] - 1]["name"]}')
    _start_round(state)


def _active_effect(state: Dict) -> Optional[Dict]:
    active = state["active"]
    return active["effects"][active["index"]] if active and active["index"] < len(active["effects"]) else None


def _mark_effect(state: Dict, hero: Dict, effect: Dict) -> None:
    active = state["active"]
    active["performed"] = True
    if effect.get("infuse") and effect["infuse"] not in hero["infusions"]:
        hero["infusions"].append(effect["infuse"])


def _finish_half(state: Dict) -> None:
    active = state["active"]
    hero = state["heroes"][active["hero_id"]]
    card = CARDS[active["card"]]
    if active["card"] in hero["played"]:
        hero["played"].remove(active["card"])
        lost = not active["basic"] and active["performed"] and card[active["half"] + "_loss"]
        hero["lost" if lost else "discard"].append(card["id"])
        if active["performed"] and not active["basic"]:
            hero["xp"] += card["xp"]
    state["active"] = None


def _progress_active(state: Dict) -> None:
    active = state["active"]
    if not active:
        return
    hero = state["heroes"][active["hero_id"]]
    if not _alive(hero):
        state["active"] = None
        return
    while active["index"] < len(active["effects"]):
        effect = _active_effect(state)
        kind = effect["kind"]
        if active.get("path"):
            pos = active["path"].pop(0)
            cell = _cell(state, pos)
            hero["pos"] = pos
            _log(state, f'{_name(hero)} 👣 → [{pos[0]}, {pos[1]}]', hero["id"])
            active["remaining"] -= 2 if cell["terrain"] == "difficult" and not effect.get("jump") else 1
            _mark_effect(state, hero, effect)
            if cell["terrain"] == "door" and not cell["open"]:
                cell["open"] = True
                _reveal(state)
            # Jump ignores intermediate traps, but landing on a trap triggers it.
            if cell["terrain"] == "trap" and (not effect.get("jump") or not active["path"]):
                cell["terrain"] = "floor"
                _hurt(state, hero, 2 + state["difficulty"], "陷阱 ⚠️")
                if state["damage"]:
                    return
            continue
        if active["remaining"] is None:
            active["remaining"] = effect["value"] if kind == "move" else effect.get("targets", 1)
            active["targets"] = []
            active["consumed"] = False
        if kind in ("move", "attack", "heal"):
            disabled = ((kind == "move" and "immobilize" in hero["conditions"]) or
                        (kind == "attack" and "disarm" in hero["conditions"]))
            if active["remaining"] > 0 and not disabled:
                return
        else:
            if kind == "shield":
                hero["round_shield"] += effect["value"]
            elif kind == "strengthen":
                _condition(hero, "strengthen")
            elif kind == "loot":
                _loot(state, hero, effect["value"])
            elif kind == "recover":
                hero["hand"].extend(hero["lost"])
                hero["lost"] = []
            _mark_effect(state, hero, effect)
        active["index"] += 1
        active["remaining"] = None
    _finish_half(state)


def _targets(state: Dict, hero: Dict, effect: Dict) -> List[Dict]:
    units = state["heroes"].values() if effect["kind"] == "heal" else state["monsters"].values()
    return [u for u in units if _alive(u) and ("class_id" in u or u["room"] in state["revealed"])
            and distance(hero["pos"], u["pos"]) <= effect.get("range", 1)
            and line_of_sight(state, hero["pos"], u["pos"])]


def legal_options(state: Dict, player_id: str) -> List[Dict]:
    if player_id not in state["player_meta"] or state["game_over"]:
        return []
    options = []
    def add(kind: str, hero: Optional[Dict] = None, **fields) -> None:
        options.append({"type": kind, **({"hero_id": hero["id"]} if hero else {}), **fields})
    own = [h for h in state["heroes"].values() if h["owner"] == player_id]
    phase = state["phase"]
    if phase == "setup":
        if player_id in state["ready"]:
            add("unready")
        else:
            add("ready")
            taken = {h["class_id"] for h in state["heroes"].values()}
            for hero in own:
                for class_id in CLASSES:
                    if class_id not in taken:
                        add("choose_class", hero, class_id=class_id)
            if player_id == state["turn_order"][0] and not state["ready"]:
                for scenario in range(1, 4):
                    for difficulty in range(3):
                        add("configure", scenario=scenario, difficulty=difficulty)
        return options
    if phase == "scenario_review":
        return [] if player_id in state["ready"] else [{"type": "continue"}]
    if state.get("damage"):
        hero = state["heroes"][state["damage"]["hero_id"]]
        if hero["owner"] == player_id:
            add("damage", hero, cards=[])
            for cid in hero["hand"]:
                add("damage", hero, cards=[cid])
            for cards in itertools.combinations(hero["discard"], 2):
                add("damage", hero, cards=list(cards))
        return options
    if phase == "round_review":
        if player_id in state["ready"]:
            return []
        for hero in own:
            if not _alive(hero):
                continue
            if hero["rest_pending"]:
                add("rest_accept", hero)
                if not hero["rest_pending"]["redrawn"]:
                    add("rest_redraw", hero)
            elif len(hero["discard"]) >= 2 and not hero.get("rested_round") == state["round"]:
                add("short_rest", hero)
        if not any(h["rest_pending"] for h in own):
            add("next_round")
        return options
    if phase == "planning":
        for hero in own:
            if not _alive(hero):
                continue
            if hero["plan"]:
                add("undo_plan", hero)
            else:
                for cards in itertools.permutations(hero["hand"], 2):
                    add("plan", hero, cards=list(cards))
                if len(hero["discard"]) >= 2:
                    add("long_rest", hero)
        return options
    if phase != "acting" or state["current"] not in state["heroes"]:
        return []
    hero = state["heroes"][state["current"]]
    if hero["owner"] != player_id:
        return []
    if hero["plan"]["rest"]:
        for cid in hero["discard"] if len(hero["discard"]) >= 2 else []:
            add("rest_lose", hero, card=cid)
        if len(hero["discard"]) < 2:
            # Negating damage may have consumed the planned resting discard pile.
            add("end_turn", hero)
        return options
    if "stun" in hero["conditions"]:
        return [{"type": "end_turn", "hero_id": hero["id"]}]
    active = state["active"]
    if active:
        effect = _active_effect(state)
        add("skip", hero)
        if effect.get("consume") and state["elements"][effect["consume"]] and not active["consumed"] and not active["targets"]:
            add("consume", hero)
        if effect["kind"] == "move":
            for q, r in sorted(paths(state, hero, active["remaining"], effect.get("jump", False))):
                add("move", hero, q=q, r=r)
            if hero["items"]["boots"] == "ready":
                add("item", hero, item="boots")
        else:
            for target in _targets(state, hero, effect):
                if target["id"] not in active["targets"]:
                    add("target", hero, target=target["id"])
    else:
        add("end_turn", hero)
        for cid in hero["played"]:
            for half in ("top", "bottom"):
                if half not in hero["used"]:
                    for basic in (False, True):
                        add("half", hero, card=cid, half=half, basic=basic)
    if hero["items"]["potion"] == "ready" and (hero["hp"] < hero["max_hp"] or "poison" in hero["conditions"] or "wound" in hero["conditions"]):
        add("item", hero, item="potion")
    return options


def _apply(state: Dict, player_id: str, action: Dict) -> None:
    kind = action["type"]
    hero = state["heroes"].get(action.get("hero_id"))
    if kind == "choose_class":
        hero["class_id"] = action["class_id"]
    elif kind == "configure":
        state.update(scenario=action["scenario"], difficulty=action["difficulty"])
    elif kind in ("ready", "next_round", "continue"):
        state["ready"].append(player_id)
        if len(state["ready"]) == len(state["player_meta"]):
            if kind == "next_round":
                state["round"] += 1
                _start_round(state)
            else:
                if kind == "continue":
                    if state["result"]["won"]:
                        state["scenario"] += 1
                    state["scenario_attempt"] += 1
                _start_scenario(state)
    elif kind == "unready":
        state["ready"].remove(player_id)
    elif kind == "plan":
        hero["played"] = action["cards"][:]
        for cid in hero["played"]:
            hero["hand"].remove(cid)
        hero["plan"] = {"rest": False}
        _reveal_plans(state)
    elif kind == "long_rest":
        hero["plan"] = {"rest": True}
        _reveal_plans(state)
    elif kind == "undo_plan":
        hero["hand"].extend(hero["played"])
        hero.update(played=[], plan=None)
    elif kind == "short_rest":
        hero["rest_pending"] = {"card": _rng(state).choice(hero["discard"]), "redrawn": False}
    elif kind == "rest_redraw":
        rest = hero["rest_pending"]
        rest["card"] = _rng(state).choice([c for c in hero["discard"] if c != rest["card"]])
        rest["redrawn"] = True
        # A redraw costs damage, with the same damage-negation choice as any hit.
        _hurt(state, hero, 1, "短休重抽")
    elif kind in ("rest_accept", "rest_lose"):
        cid = action.get("card") if kind == "rest_lose" else hero["rest_pending"]["card"]
        hero["discard"].remove(cid)
        hero["lost"].append(cid)
        hero["hand"].extend(hero["discard"])
        hero["discard"] = []
        hero["rest_pending"] = None
        hero["rested_round"] = state["round"]
        _log(state, f'{_name(hero)} 休息并失去一张卡牌', hero["id"])
        if kind == "rest_lose":
            _heal(state, hero, 2)
            hero["items"]["boots"] = "ready"
            _end_turn(state, hero)
    elif kind == "damage":
        damage = state["damage"]
        cards = action["cards"]
        if cards:
            source = hero["hand"] if len(cards) == 1 else hero["discard"]
            for cid in cards:
                source.remove(cid)
                hero["lost"].append(cid)
            # A short-rest redraw cannot subsequently lose a card used for negation.
            rest = hero["rest_pending"]
            if rest and rest["card"] in cards:
                if hero["discard"]:
                    rest["card"] = _rng(state).choice(hero["discard"])
                else:
                    hero["rest_pending"] = None
                    hero["rested_round"] = state["round"]
            _log(state, f'{_name(hero)} 失去 {len(cards)} 张卡抵消 {damage["amount"]} 点伤害', hero["id"])
        else:
            hero["hp"] = max(0, hero["hp"] - damage["amount"])
            if hero["hp"] == 0:
                _exhaust(state, hero)
        state["damage"] = None
        if not any(_alive(h) for h in state["heroes"].values()):
            _finish_scenario(state, False)
    elif kind == "half":
        half, basic = action["half"], action["basic"]
        effects = [{"kind": "attack", "value": 2, "range": 1}] if basic and half == "top" else [{"kind": "move", "value": 2}] if basic else copy.deepcopy(CARDS[action["card"]][half])
        hero["used"].append(half)
        _log(state, f'{_name(hero)} 使用 {CARDS[action["card"]]["name"]} {"上半" if half == "top" else "下半"}{"（基础动作）" if basic else ""}', hero["id"])
        state["active"] = {"hero_id": hero["id"], "card": action["card"], "half": half, "basic": basic,
                           "effects": effects, "index": 0, "remaining": None, "performed": False, "path": []}
        _progress_active(state)
    elif kind == "move":
        active, effect = state["active"], _active_effect(state)
        active["path"] = paths(state, hero, active["remaining"], effect.get("jump", False))[(action["q"], action["r"])]["path"]
        _progress_active(state)
    elif kind == "consume":
        active, effect = state["active"], _active_effect(state)
        state["elements"][effect["consume"]] = 0
        effect["value"] += 1
        active["consumed"] = True
    elif kind == "target":
        active, effect = state["active"], _active_effect(state)
        target = _unit(state, action["target"])
        _mark_effect(state, hero, effect)
        active["targets"].append(target["id"])
        active["remaining"] -= 1
        if effect["kind"] == "attack":
            _attack(state, hero, target, effect)
        else:
            _heal(state, target, effect["value"])
        _progress_active(state)
    elif kind == "skip":
        active = state["active"]
        active["index"] += 1
        active["remaining"] = None
        _progress_active(state)
    elif kind == "end_turn":
        _end_turn(state, hero)
    elif kind == "item":
        item = action["item"]
        hero["items"][item] = "lost" if item == "potion" else "spent"
        if item == "potion":
            _heal(state, hero, 3)
        else:
            state["active"]["remaining"] += 2
    _pump(state)


class GloomhavenGame:
    game_id = "gloomhaven"
    min_players = 1
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"seed", "scenario", "difficulty"}:
            raise ValueError("invalid Gloomhaven configuration")
        if not 1 <= len(players) <= 4 or len({p["player_id"] for p in players}) != len(players):
            raise ValueError("Gloomhaven requires 1 to 4 unique players")
        for field, low, high in (("scenario", 1, 3), ("difficulty", 0, 2)):
            if type(cfg.get(field, low)) is not int or not low <= cfg.get(field, low) <= high:
                raise ValueError(f"invalid {field}")
        seed = cfg.get("seed", secrets.token_hex(16))
        if type(seed) is not int and not (isinstance(seed, str) and 1 <= len(seed) <= 80):
            raise ValueError("invalid seed")
        order = [p["player_id"] for p in sorted(players, key=lambda p: (p.get("seat", 0), p["player_id"]))]
        heroes = {}
        for i in range(max(2, len(players))):
            hid = f"h{i + 1}"
            heroes[hid] = {"id": hid, "owner": order[i % len(order)], "class_id": list(CLASSES)[i],
                           "xp": 0, "gold": 0, "kills": 0}
        return {"version": 1, "config": dict(cfg), "game_token": secrets.token_hex(12), "seed": seed, "random_counter": 0,
                "scenario_attempt": 1, "revision": 0, "round": 0, "phase": "setup", "ready": [], "turn_order": order,
                "player_meta": {p["player_id"]: dict(p) for p in players}, "heroes": heroes,
                "players": {pid: {"hero_ids": [h["id"] for h in heroes.values() if h["owner"] == pid]} for pid in order},
                "scenario": cfg.get("scenario", 1), "difficulty": cfg.get("difficulty", 1),
                "current": None, "current_turn": None, "active": None, "damage": None,
                "results": [], "result": None, "log": [], "game_over": False, "winner_ids": []}

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return list(dict.fromkeys(o["type"] for o in legal_options(state, player_id)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        for key in CONTEXT:
            if type(action.get(key)) is not type(state[key]) or action.get(key) != state[key]:
                return [], "stale action; use the latest game state"
        candidate = {k: v for k, v in action.items() if k not in CONTEXT}
        try:
            encoded = json.dumps(candidate, sort_keys=True, allow_nan=False)
            legal = any(encoded == json.dumps(o, sort_keys=True) for o in legal_options(state, player_id))
        except (TypeError, ValueError):
            legal = False
        if not legal:
            return [], "action not available or invalid target"
        work = copy.deepcopy(state)
        _apply(work, player_id, candidate)
        work["revision"] += 1
        current = work.get("damage", {}).get("hero_id") if work.get("damage") else work["current"]
        work["current_turn"] = work["heroes"].get(current, {}).get("owner")
        state.clear()
        state.update(work)
        # Secret selections are never placed in broadcast events or bot status.
        return [{"type": "gloomhaven:update", "payload": {"player_id": player_id, "action": candidate["type"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        view = {key: copy.deepcopy(state[key]) for key in (
            *CONTEXT, "phase", "scenario", "difficulty", "current", "current_turn", "ready", "results", "result", "log", "game_over", "winner_ids")}
        view.update(game_id=GloomhavenGame.game_id, you=viewer_id, classes=copy.deepcopy(CLASSES),
                    scenarios=[{k: spec[k] for k in ("id", "name", "subtitle")} for spec in SCENARIOS], cards=copy.deepcopy(CARDS), config={},
                    players=[{"player_id": pid, "name": state["player_meta"][pid].get("name", pid),
                              "is_bot": bool(state["player_meta"][pid].get("is_bot"))} for pid in state["turn_order"]],
                    options=legal_options(state, viewer_id), heroes=[], cells=[], monsters=[], elements={},
                    queue=[], monster_cards={}, active=None, damage=copy.deepcopy(state["damage"]), last_attack=None)
        view["legal_actions"] = list(dict.fromkeys(o["type"] for o in view["options"]))
        for hero in state["heroes"].values():
            public = {k: copy.deepcopy(hero[k]) for k in ("id", "owner", "class_id", "xp", "gold", "kills")}
            own = hero["owner"] == viewer_id
            if state["phase"] != "setup":
                public.update({k: copy.deepcopy(hero[k]) for k in (
                    "hp", "max_hp", "pos", "exhausted", "conditions", "round_shield", "items", "initiative", "used")})
                public.update(hand_count=len(hero["hand"]), discard_count=len(hero["discard"]), lost_count=len(hero["lost"]),
                              planned=hero["plan"] is not None, hand=copy.deepcopy(hero["hand"]) if own else [],
                              discard=copy.deepcopy(hero["discard"]), lost=copy.deepcopy(hero["lost"]),
                              played=copy.deepcopy(hero["played"]) if own or state["phase"] != "planning" else [],
                              resting=bool(hero["plan"] and hero["plan"]["rest"]) if own or state["phase"] != "planning" else False,
                              rest_pending=copy.deepcopy(hero["rest_pending"]) if own else None)
            view["heroes"].append(public)
        if state["phase"] != "setup":
            view.update(cells=[copy.deepcopy(c) for c in state["cells"] if _visible_cell(state, c)],
                        monsters=[copy.deepcopy(m) for m in state["monsters"].values() if m["room"] in state["revealed"] and not m["dead"]],
                        elements=copy.deepcopy(state["elements"]), queue=state["queue"][:], queue_index=state["queue_index"],
                        monster_cards=copy.deepcopy(state["monster_cards"]), active=copy.deepcopy(state["active"]),
                        last_attack=copy.deepcopy(state["last_attack"]), round_report=copy.deepcopy(state["round_report"]))
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.gloomhaven_ai import choose_action
        view = GloomhavenGame.get_public_view(state, bot_id)
        action = choose_action(view)
        return {**action, **{k: view[k] for k in CONTEXT}, "delay_ms": 250} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
