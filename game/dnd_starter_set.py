"""Server-authoritative, DM-led Chinese Heroes of the Borderlands table."""
import copy
import heapq
import random
import secrets
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator
from game.dnd_starter_set_data import (
    ABILITIES, BACKGROUNDS, CLASSES, CONDITIONS, MONSTERS, REGIONS, SCENES,
    SKILLS, SPECIES, SPELLS, WEAPONS,
)

_STRING = {"type": "string", "minLength": 1, "maxLength": 100}
_TEXT = {"type": "string", "minLength": 1, "maxLength": 1200}
_ACTION_FIELDS = {
    "choose": {"class_id": {"enum": list(CLASSES)}, "species": {"enum": list(SPECIES)}, "background": {"enum": list(BACKGROUNDS)}},
    "ready": {}, "next_round": {}, "encounter": {}, "end_turn": {}, "dodge": {}, "disengage": {}, "dash": {},
    "second_wind": {}, "action_surge": {}, "cunning_dash": {}, "cunning_disengage": {}, "stand": {},
    "travel": {"scene": {"enum": list(SCENES)}},
    "attack": {"target": _STRING, "weapon": {"enum": [*WEAPONS, "monster"]}},
    "move": {"x": {"type": "integer", "minimum": 0, "maximum": 9}, "y": {"type": "integer", "minimum": 0, "maximum": 7}},
    "cast": {"spell": {"enum": list(SPELLS)}, "target": _STRING, "slot": {"type": "integer", "minimum": 0, "maximum": 2}},
    "potion": {"target": _STRING}, "stabilize": {"target": _STRING},
    "rest": {"kind": {"enum": ["short", "long"]}}, "buy_potion": {},
    "request_check": {"target": _STRING, "ability": {"enum": [*ABILITIES, *SKILLS]}, "kind": {"enum": ["check", "save"]},
                      "dc": {"type": "integer", "minimum": 5, "maximum": 30}, "mode": {"type": "integer", "minimum": -1, "maximum": 1}},
    "roll_check": {}, "cancel_check": {},
    "narrate": {"text": _TEXT}, "note": {"text": {"type": "string", "maxLength": 4000}},
    "resolve": {"outcome": {"enum": ["peace", "retreat", "victory"]}, "reason": _TEXT},
    "adjust_hp": {"target": _STRING, "delta": {"type": "integer", "minimum": -100, "maximum": 100}, "reason": _TEXT},
    "condition": {"target": _STRING, "condition": {"enum": list(CONDITIONS)}, "enabled": {"type": "boolean"}},
    "level_up": {}, "finish": {"reason": _TEXT},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {"type": {"const": kind}, "game_instance_id": _STRING,
     "window_id": {"type": "integer", "minimum": 0}, **fields},
     "required": ["type", "game_instance_id", "window_id", *fields], "additionalProperties": False}
    for kind, fields in _ACTION_FIELDS.items()
]}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
REVIEW_PHASES = ("round_review", "encounter_review", "final_review")
PHASES = ("setup", "exploration", "combat", *REVIEW_PHASES, "game_over")


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _log(state: Dict, text: str, actors: Optional[List[str]] = None, kind: str = "action") -> None:
    row = {"seq": state["log_seq"], "text": text, "actors": actors or [], "kind": kind}
    state["log_seq"] += 1
    state["history"].append(row)
    state["history"] = state["history"][-100:]
    state["round_log"].append(row)
    state["round_log"] = state["round_log"][-100:]


def _die(state: Dict, sides: int) -> int:
    rng = random.Random(f'{state["seed"]}:{state["rng_step"]}')
    state["rng_step"] += 1
    return rng.randint(1, sides)


def _dice(state: Dict, count: int, sides: int) -> int:
    return sum(_die(state, sides) for _ in range(count))


def _d20(state: Dict, actor: Dict, mode: int = 0) -> Tuple[int, List[int]]:
    rolls = [_die(state, 20) for _ in range(2 if mode else 1)]
    if actor.get("species") == "halfling":
        rolls = [_die(state, 20) if value == 1 else value for value in rolls]
    return (max(rolls) if mode > 0 else min(rolls)), rolls


def _phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["window_id"] += 1
    state["ready"] = []
    if phase != "combat":
        state["current_turn"] = None


def _units(state: Dict) -> Dict:
    return {**state["heroes"], **state["monsters"]}


def _unit(state: Dict, uid: str) -> Dict:
    _require(uid in _units(state), "目标不存在")
    return _units(state)[uid]


def _distance(a: List[int], b: List[int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]))


def _enemy(a: Dict, b: Dict) -> bool:
    return a["side"] != b["side"]


def _conscious(unit: Dict) -> bool:
    return unit["hp"] > 0 and "stunned" not in unit["conditions"]


def _map(scene_id: str) -> Dict:
    terrain = SCENES[scene_id]["terrain"]
    walls, rough = [], []
    if terrain == "cave":
        walls = [[4, 0], [4, 1], [4, 6], [4, 7], [8, 0], [8, 7]]
        rough = [[4, 2], [5, 5]]
    elif terrain == "woods":
        walls = [[4, 1], [5, 5], [7, 6]]
        rough = [[3, 3], [3, 4], [6, 2], [6, 3]]
    elif terrain == "marsh":
        rough = [[x, y] for x in range(3, 7) for y in range(1, 7) if y != 4]
    return {"width": 10, "height": 8, "walls": walls, "rough": rough, "terrain": terrain}


def _visible(state: Dict, a: List[int], b: List[int]) -> bool:
    steps = max(abs(a[0] - b[0]), abs(a[1] - b[1]))
    if not steps:
        return True
    walls = state["map"]["walls"]
    return all([round(a[0] + (b[0] - a[0]) * i / steps),
                round(a[1] + (b[1] - a[1]) * i / steps)] not in walls for i in range(1, steps + 1))


def _paths(state: Dict, actor: Dict, budget: Optional[int] = None) -> Dict:
    if not _conscious(actor) or "restrained" in actor["conditions"]:
        return {}
    limit = actor.get("move_left", 0) if budget is None else budget
    start = tuple(actor["pos"])
    walls = {tuple(p) for p in state["map"]["walls"]}
    rough = {tuple(p) for p in state["map"]["rough"]}
    blocked = {tuple(u["pos"]) for u in _units(state).values() if u["hp"] > 0 and u["id"] != actor["id"]}
    queue, costs, paths = [(0, start)], {start: 0}, {start: []}
    while queue:
        cost, pos = heapq.heappop(queue)
        if cost != costs[pos]:
            continue
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nxt = pos[0] + dx, pos[1] + dy
            if not (0 <= nxt[0] < 10 and 0 <= nxt[1] < 8) or nxt in walls or nxt in blocked:
                continue
            if dx and dy and ((pos[0] + dx, pos[1]) in walls or (pos[0], pos[1] + dy) in walls):
                continue
            step = (2 if nxt in rough else 1) + (1 if "prone" in actor["conditions"] else 0)
            new_cost = cost + step
            if new_cost > limit or new_cost >= costs.get(nxt, 999):
                continue
            costs[nxt], paths[nxt] = new_cost, paths[pos] + [list(nxt)]
            heapq.heappush(queue, (new_cost, nxt))
    return {pos: {"cost": costs[pos], "path": path} for pos, path in paths.items() if pos != start}


def _new_hero(pid: str, name: str, class_id: str, species: str, background: str) -> Dict:
    base = CLASSES[class_id]
    hp = base["hp"] + (species == "dwarf")
    skills = set(base["skills"]) | set(BACKGROUNDS[background]["skills"])
    if species == "elf":
        skills.add("perception")
    return {"id": pid, "owner": pid, "name": name, "class_id": class_id, "species": species, "background": background,
            "side": "heroes", "emoji": base["emoji"], "level": 1, "hp": hp, "max_hp": hp, "ac": base["ac"],
            "mods": dict(base["mods"]), "skills": sorted(skills), "saves": list(base["saves"]), "speed": 6,
            "pos": [1, 2], "conditions": [], "dead": False, "stable": False, "death_success": 0, "death_fail": 0,
            "hit_dice": 1, "slots": [2, 0] if base["spells"] else [0, 0], "potions": 1,
            "second_wind": 2 if class_id == "fighter" else 0, "surge": 0, "concentration": None,
            "mage_armor": False, "reaction": True, "dodge": False, "guiding": None}


def _check_bonus(hero: Dict, ability: str, kind: str = "check") -> int:
    attr = SKILLS[ability][1] if ability in SKILLS else ability
    bonus = hero["mods"][attr]
    if kind == "save" and ability in hero["saves"]:
        bonus += 2
    elif kind == "check" and ability in hero["skills"]:
        bonus += 4 if hero["class_id"] == "rogue" and ability in ("stealth", "sleight") else 2
    return bonus


def _heal(state: Dict, target: Dict, amount: int) -> None:
    _require(not target.get("dead"), "角色已经死亡，普通治疗无法复活")
    actual = min(target["max_hp"] - target["hp"], max(0, amount))
    target["hp"] += actual
    if target["hp"] > 0 and target["side"] == "heroes":
        target.update(death_success=0, death_fail=0, stable=False)
    _log(state, f'{target["name"]} 恢复 {actual} 点生命。', [target["id"]], "heal")


def _hurt(state: Dict, target: Dict, amount: int, critical: bool = False) -> None:
    amount = max(0, amount)
    old_hp = target["hp"]
    target["hp"] = max(0, old_hp - amount)
    _log(state, f'{target["name"]} 受到 {amount} 点伤害。', [target["id"]], "damage")
    if not amount:
        return
    if target["side"] == "heroes":
        if amount - old_hp >= target["max_hp"]:
            target["dead"] = True
        elif old_hp == 0:
            target["stable"] = False
            target["death_fail"] += 2 if critical else 1
            target["dead"] = target["death_fail"] >= 3
        elif target["hp"] == 0:
            target.update(death_success=0, death_fail=0, stable=False)
            if "prone" not in target["conditions"]:
                target["conditions"].append("prone")
        if target["hp"] == 0:
            target["concentration"] = None
            _log(state, f'{target["name"]} {"已经死亡" if target["dead"] else "失去意识，倒地"}。', [target["id"]])
        elif target["concentration"]:
            roll, dice = _d20(state, target)
            dc = max(10, min(30, amount // 2))
            total = roll + _check_bonus(target, "con", "save")
            _log(state, f'{target["name"]} 专注豁免 {dice} → {total} / DC {dc}。', [target["id"]], "roll")
            if total < dc:
                _log(state, f'{target["name"]} 专注结束：{SPELLS[target["concentration"]]["name"]}；DM 请移除相应效果。')
                target["concentration"] = None


def _death_save(state: Dict, hero: Dict) -> None:
    if hero["dead"] or hero["stable"]:
        return
    roll, dice = _d20(state, hero)
    if roll == 20:
        _heal(state, hero, 1)
    elif roll < 10:
        hero["death_fail"] += 2 if roll == 1 else 1
        hero["dead"] = hero["death_fail"] >= 3
    else:
        hero["death_success"] += 1
        hero["stable"] = hero["death_success"] >= 3
    _log(state, f'{hero["name"]} 死亡豁免 {dice}：成功 {hero["death_success"]} / 失败 {hero["death_fail"]}'
         f'{" · 稳定" if hero["stable"] else ""}{" · 死亡" if hero["dead"] else ""}。', [hero["id"]], "roll")


def _attack_mode(state: Dict, actor: Dict, target: Dict, ranged: bool, distance: int, long_range: bool = False) -> int:
    advantage = bool(target.get("guiding")) or "restrained" in target["conditions"] or "stunned" in target["conditions"] or target["hp"] == 0
    disadvantage = long_range or any(c in actor["conditions"] for c in ("poisoned", "restrained", "prone"))
    if "prone" in target["conditions"]:
        advantage |= distance <= 1
        disadvantage |= distance > 1
    if target.get("dodge") and _conscious(target) and "restrained" not in target["conditions"]:
        disadvantage = True
    if ranged and any(_enemy(actor, u) and _conscious(u) and _distance(actor["pos"], u["pos"]) <= 1 for u in _units(state).values()):
        disadvantage = True
    return 0 if advantage == disadvantage else 1 if advantage else -1


def _strike(state: Dict, actor: Dict, target: Dict, bonus: int, dice: List[int], damage_bonus: int,
            ranged: bool, long_range: bool = False, sneak: bool = False) -> bool:
    distance = _distance(actor["pos"], target["pos"])
    mode = _attack_mode(state, actor, target, ranged, distance, long_range)
    natural, rolls = _d20(state, actor, mode)
    target["guiding"] = None
    hit = natural != 1 and (natural == 20 or natural + bonus >= target["ac"])
    critical = hit and (natural == 20 or (target["hp"] == 0 and distance <= 1))
    _log(state, f'{actor["name"]} → {target["name"]}：d20 {rolls} + {bonus} = {natural + bonus}，'
         f'{"重击！" if critical else "命中" if hit else "未命中"}。', [actor["id"], target["id"]], "roll")
    if not hit:
        return False
    count, sides = dice
    amount = _dice(state, count * (2 if critical else 1), sides) + damage_bonus
    adjacent_ally = any(u["id"] != actor["id"] and not _enemy(actor, u) and _conscious(u)
                        and _distance(u["pos"], target["pos"]) <= 1 for u in _units(state).values())
    if sneak and not actor.get("sneak_used") and mode >= 0 and (mode > 0 or adjacent_ally):
        amount += _dice(state, (2 if actor["level"] >= 3 else 1) * (2 if critical else 1), 6)
        actor["sneak_used"] = True
        _log(state, f'{actor["name"]} 发动偷袭。', [actor["id"]])
    _hurt(state, target, max(0, amount), critical)
    return True


def _review(state: Dict, phase: str, outcome: Optional[str] = None) -> None:
    state["report"] = copy.deepcopy(state["round_log"])
    state["outcome"] = outcome
    _phase(state, phase)


def _resolve_encounter(state: Dict, outcome: str) -> None:
    scene = SCENES[state["scene"]]
    if outcome in ("victory", "peace") and state["scene"] not in state["completed"]:
        state["completed"].append(state["scene"])
        state["gold"] += scene["reward"]
        _log(state, f'{scene["name"]} 已解决，队伍获得 💰 {scene["reward"]} 金币。')
    labels = {"victory": "战斗胜利", "peace": "和平解决", "retreat": "撤回要塞", "defeat": "队伍失去战斗能力"}
    _log(state, labels[outcome] + "。请共同回顾。")
    _review(state, "encounter_review", outcome)


def _check_end(state: Dict) -> bool:
    if state["phase"] != "combat":
        return False
    if not any(m["hp"] > 0 for m in state["monsters"].values()):
        _resolve_encounter(state, "victory")
        return True
    if not any(h["hp"] > 0 for h in state["heroes"].values()):
        _resolve_encounter(state, "defeat")
        return True
    return False


def _begin_turn(state: Dict) -> None:
    while state["turn_index"] < len(state["initiative"]):
        actor = _unit(state, state["initiative"][state["turn_index"]]["id"])
        if actor.get("dead") or (actor["side"] == "monsters" and actor["hp"] == 0):
            state["turn_index"] += 1
            continue
        actor.update(action_left=1, bonus_left=1, move_left=actor["speed"], reaction=True,
                     dodge=False, disengaged=False, sneak_used=False, slot_used=False)
        if actor["hp"] == 0:
            _death_save(state, actor)
            if actor["hp"] == 0:
                state["turn_index"] += 1
                continue
        if "stunned" in actor["conditions"]:
            _log(state, f'{actor["name"]} 处于震慑，跳过行动。', [actor["id"]])
            state["turn_index"] += 1
            continue
        state["actor"] = actor["id"]
        state["current_turn"] = actor["owner"]
        state["window_id"] += 1
        return
    _review(state, "round_review")


def _end_turn(state: Dict) -> None:
    actor_id = state["actor"]
    for unit in _units(state).values():
        if (isinstance(unit.get("guiding"), dict) and unit["guiding"]["source"] == actor_id
                and state["round"] >= unit["guiding"]["expires_round"]):
            unit["guiding"] = None
    state["turn_index"] += 1
    if not _check_end(state):
        _begin_turn(state)


def _start_encounter(state: Dict) -> None:
    scene = SCENES[state["scene"]]
    _require(scene["enemies"] and state["scene"] not in state["completed"], "此处没有待解决的遭遇")
    _require(not state["pending_check"], "请先完成或取消检定")
    _require(any(h["hp"] > 0 for h in state["heroes"].values()), "队伍无法行动")
    state["monsters"] = {}
    for i, key in enumerate(scene["enemies"]):
        base = copy.deepcopy(MONSTERS[key])
        uid = f"m{i + 1}"
        base.update(id=uid, owner=state["dm"], name=f'{base["name"]} {i + 1}', max_hp=base["hp"], side="monsters",
                    pos=[7, i + 2], conditions=[], reaction=True, dodge=False, guiding=None)
        state["monsters"][uid] = base
    for i, hero in enumerate(state["heroes"].values()):
        hero["pos"] = [1, i + 2]
    state.update(round=1, turn_index=0, round_log=[], report=[])
    initiative = []
    for uid, unit in _units(state).items():
        dex = unit["mods"]["dex"] if unit["side"] == "heroes" else unit["dex"]
        roll, _ = _d20(state, unit)
        initiative.append({"id": uid, "total": roll + dex})
    state["initiative"] = sorted(initiative, key=lambda row: -row["total"])
    _phase(state, "combat")
    _log(state, "战斗开始，已掷先攻。每轮结束后所有人确认再继续。")
    _begin_turn(state)


def _actor(state: Dict, pid: str) -> Dict:
    _require(state["phase"] == "combat" and state["current_turn"] == pid, "还未轮到你行动")
    actor = _unit(state, state["actor"])
    _require(_conscious(actor), "当前角色不能行动")
    return actor


def _spend(actor: Dict, bonus: bool = False) -> None:
    key = "bonus_left" if bonus else "action_left"
    _require(actor[key] > 0, "本回合的附赠动作已用完" if bonus else "本回合的动作已用完")
    actor[key] -= 1


def _attack(state: Dict, actor: Dict, target_id: str, weapon_id: str) -> None:
    target = _unit(state, target_id)
    _require(_enemy(actor, target) and not target.get("dead") and (target["side"] == "heroes" or target["hp"] > 0), "请选择有效的敌对目标")
    if actor["side"] == "monsters":
        _require(weapon_id == "monster", "怪物不能使用玩家武器")
        weapon = {"range": actor["range"], "long": actor["range"], "dice": actor["damage"][:2]}
        bonus, damage_bonus = actor["attack"], actor["damage"][2]
    else:
        _require(weapon_id in CLASSES[actor["class_id"]]["weapons"], "角色未装备此武器")
        weapon = WEAPONS[weapon_id]
        damage_bonus = actor["mods"][weapon["ability"]]
        bonus = damage_bonus + 2
    distance = _distance(actor["pos"], target["pos"])
    _require(distance <= weapon["long"] and _visible(state, actor["pos"], target["pos"]), "目标超出射程或被墙体阻挡")
    _spend(actor)
    _strike(state, actor, target, bonus, weapon["dice"], damage_bonus, weapon["range"] > 1,
            distance > weapon["range"], actor.get("class_id") == "rogue")
    _check_end(state)


def _move(state: Dict, actor: Dict, destination: Tuple[int, int]) -> None:
    paths = _paths(state, actor)
    _require(destination in paths, "此格不可达或移动力不足")
    path = paths[destination]
    for cell in path["path"]:
        if not actor.get("disengaged"):
            for other in _units(state).values():
                if not _enemy(actor, other) or not _conscious(other) or not other.get("reaction"):
                    continue
                if _distance(actor["pos"], other["pos"]) <= 1 < _distance(cell, other["pos"]):
                    other["reaction"] = False
                    _log(state, f'{other["name"]} 对 {actor["name"]} 发动借机攻击。', [other["id"], actor["id"]])
                    if other["side"] == "monsters":
                        _strike(state, other, actor, other["attack"], other["damage"][:2], other["damage"][2], False)
                    else:
                        weapon = WEAPONS[CLASSES[other["class_id"]]["weapons"][0]]
                        mod = other["mods"][weapon["ability"]]
                        _strike(state, other, actor, mod + 2, weapon["dice"], mod, False)
                    if actor["hp"] == 0:
                        _log(state, f'{actor["name"]} 的移动被中断。', [actor["id"]])
                        if not _check_end(state):
                            _end_turn(state)
                        return
        cost = (2 if cell in state["map"]["rough"] else 1) + (1 if "prone" in actor["conditions"] else 0)
        actor["move_left"] -= cost
        actor["pos"] = cell
    _log(state, f'{actor["name"]} 移动到 {chr(65 + destination[0])}{destination[1] + 1}。', [actor["id"]])


def _cast(state: Dict, actor: Dict, action: Dict, combat: bool) -> None:
    spell_id, slot = action["spell"], action["slot"]
    _require(actor["side"] == "heroes" and spell_id in CLASSES[actor["class_id"]]["spells"], "角色不会此法术")
    spell = SPELLS[spell_id]
    _require((spell["level"] == 0 and slot == 0) or (0 < spell["level"] <= slot <= 2), "请选择正确的法术位环级")
    _require(slot == 0 or actor["slots"][slot - 1] > 0, "法术位不足")
    _require(not combat or not slot or not actor["slot_used"], "每回合只能消耗一个法术位施法（2024）")
    target = _unit(state, action["target"])
    if spell["kind"] in ("heal", "armor"):
        _require(target["side"] == "heroes" and not target.get("dead"), "请选择存活的冒险者")
    elif spell["kind"] == "manual":
        _require(not target.get("dead") and target["hp"] > 0, "请选择存活的目标作为裁定参考")
    else:
        _require(combat and _enemy(actor, target) and target["hp"] > 0, "请选择战斗中的敌人")
    if spell["kind"] == "armor":
        _require(target["id"] == actor["id"] and actor["class_id"] == "wizard", "法师护甲仅用于自身")
    if combat:
        _require(_distance(actor["pos"], target["pos"]) <= spell["range"] and _visible(state, actor["pos"], target["pos"]), "法术目标超出范围或不可见")
        _spend(actor, spell.get("bonus", False))
    if slot:
        actor["slots"][slot - 1] -= 1
        actor["slot_used"] = True
    ability = "wis" if actor["class_id"] == "cleric" else "int"
    mod = actor["mods"][ability]
    _log(state, f'{actor["name"]} 施放 {spell["name"]}{f"（{slot}环）" if slot else "（戏法）"}。', [actor["id"], target["id"]])
    if spell["kind"] == "heal":
        _heal(state, target, _dice(state, spell["dice"][0] * slot, spell["dice"][1]) + mod)
    elif spell["kind"] == "armor":
        actor["ac"], actor["mage_armor"] = 13 + actor["mods"]["dex"], True
    elif spell["kind"] == "manual":
        if spell.get("concentration"):
            if actor["concentration"]:
                _log(state, f'{actor["name"]} 结束之前的专注；DM 请移除旧效果。')
            actor["concentration"] = spell_id
        _log(state, "DM 裁定待办：" + spell["text"], [actor["id"]], "ruling")
    elif spell["kind"] == "missile":
        # All darts use the same d4 roll, as simultaneous Magic Missile damage.
        _hurt(state, target, (_die(state, 4) + 1) * (slot + 2))
    elif spell["kind"] == "save":
        advantage = bool(target.get("dodge")) and _conscious(target) and "restrained" not in target["conditions"]
        disadvantage = "restrained" in target["conditions"]
        mode = 0 if advantage == disadvantage else 1 if advantage else -1
        roll, rolls = _d20(state, target, mode)
        bonus = target.get("dex", 0)
        success = roll + bonus >= 10 + mod and not ("stunned" in target["conditions"] and spell["save"] in ("str", "dex"))
        _log(state, f'{target["name"]} {ABILITIES[spell["save"]]}豁免 {rolls}+{bonus} / DC {10 + mod}：{"成功" if success else "失败"}。', [target["id"]], "roll")
        if not success:
            _hurt(state, target, _dice(state, *spell["dice"]))
    else:
        count = 3 if spell["kind"] == "rays" else 1
        dice = [2, 6] if spell["kind"] == "rays" else [spell["dice"][0] + max(0, slot - spell["level"]), spell["dice"][1]]
        for _ in range(count):
            if target["hp"] <= 0:
                break
            hit = _strike(state, actor, target, mod + 2, dice, 0, True)
            if hit and spell_id == "guiding_bolt":
                target["guiding"] = {"source": actor["id"], "expires_round": state["round"] + 1}
    _check_end(state)


def _rest(state: Dict, pid: str, kind: str) -> None:
    _require(not state["pending_check"], "检定期间不能休息")
    if kind == "short":
        _require(pid in state["heroes"], "DM 请让玩家选择自己的短休")
        hero = state["heroes"][pid]
        _require(hero["hp"] > 0 and hero["hit_dice"] > 0, "没有可用生命骰或无法休息")
        hero["hit_dice"] -= 1
        _heal(state, hero, max(0, _die(state, CLASSES[hero["class_id"]]["hit_die"]) + hero["mods"]["con"]))
        if hero["class_id"] == "fighter":
            hero["second_wind"] = min(2, hero["second_wind"] + 1)
            hero["surge"] = int(hero["level"] >= 2)
        _log(state, f'{hero["name"]} 完成一小时短休并花费一枚生命骰。', [pid])
    else:
        _require(pid == state["dm"] and SCENES[state["scene"]]["safe"], "只有 DM 可以在安全据点发起长休")
        _require(not state["rested"], "本次返回据点已进行长休，先继续冒险")
        for hero in state["heroes"].values():
            if hero["dead"]:
                continue
            _heal(state, hero, hero["max_hp"])
            hero.update(hit_dice=hero["level"], slots=([2, 0] if hero["level"] == 1 else [3, 0] if hero["level"] == 2 else [4, 2])
                        if CLASSES[hero["class_id"]]["spells"] else [0, 0], concentration=None, mage_armor=False,
                        ac=CLASSES[hero["class_id"]]["ac"], conditions=[], second_wind=2 if hero["class_id"] == "fighter" else 0,
                        surge=int(hero["class_id"] == "fighter" and hero["level"] >= 2))
        state["rested"] = True
        _log(state, "队伍完成八小时长休；恢复生命、生命骰和职业资源。")


def _apply(state: Dict, pid: str, action: Dict) -> None:
    kind = action["type"]
    _require(kind in DndStarterSetGame.get_legal_actions(state, pid), "当前身份或阶段不能执行此操作")
    if kind == "choose":
        _require(not any(h["class_id"] == action["class_id"] and uid != pid for uid, h in state["heroes"].items()), "该职业板已被另一位玩家选择")
        state["heroes"][pid] = _new_hero(pid, state["players"][pid]["name"], action["class_id"], action["species"], action["background"])
    elif kind == "ready":
        _require(pid == state["dm"] or pid in state["heroes"], "请先选择职业板")
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["players"]):
            _phase(state, "exploration")
            _log(state, "冒险开始：边陲要塞。请向 DM 描述你想做的事。")
    elif kind == "next_round":
        state["ready"].append(pid)
        if len(state["ready"]) == len(state["players"]):
            phase, outcome = state["phase"], state["outcome"]
            if phase == "final_review" or (phase == "encounter_review" and outcome == "defeat"):
                state["game_over"] = True
                state["winner_ids"] = [] if outcome == "defeat" else list(state["players"])
                _phase(state, "game_over")
            elif phase == "round_review":
                state.update(round=state["round"] + 1, turn_index=0, round_log=[])
                _phase(state, "combat")
                _begin_turn(state)
            else:
                if outcome == "retreat":
                    state["scene"], state["map"] = "keep", _map("keep")
                state.update(monsters={}, initiative=[], actor=None, round_log=[], pending_check=None)
                _phase(state, "exploration")
    elif kind == "travel":
        _require(not state["pending_check"] and action["scene"] in SCENES[state["scene"]]["exits"], "路线不可用或仍有待完成检定")
        state["scene"] = action["scene"]
        state["map"] = _map(state["scene"])
        if not SCENES[state["scene"]]["safe"]:
            state["rested"] = False
        if state["scene"] not in state["visited"]:
            state["visited"].append(state["scene"])
        state["window_id"] += 1
        state["round_log"] = []
        _log(state, f'队伍抵达：{SCENES[state["scene"]]["name"]}。')
    elif kind == "encounter":
        _start_encounter(state)
    elif kind == "request_check":
        _require(not state["pending_check"], "已有等待掷骰的检定")
        _require(action["target"] in state["heroes"] and state["heroes"][action["target"]]["hp"] > 0, "目标无法进行检定")
        _require(action["kind"] != "save" or action["ability"] in ABILITIES, "豁免必须选择六项属性之一")
        state["pending_check"] = {key: action[key] for key in ("target", "ability", "kind", "dc", "mode")}
        state["window_id"] += 1
    elif kind == "roll_check":
        check = state["pending_check"]
        hero = state["heroes"][pid]
        advantage, disadvantage = check["mode"] > 0, check["mode"] < 0
        if check["kind"] == "check" and "poisoned" in hero["conditions"]:
            disadvantage = True
        if check["kind"] == "save" and check["ability"] == "dex":
            advantage |= bool(hero.get("dodge")) and _conscious(hero) and "restrained" not in hero["conditions"]
            disadvantage |= "restrained" in hero["conditions"]
        mode = 0 if advantage == disadvantage else 1 if advantage else -1
        roll, rolls = _d20(state, hero, mode)
        auto_fail = check["kind"] == "save" and check["ability"] in ("str", "dex") and "stunned" in hero["conditions"]
        bonus = _check_bonus(hero, check["ability"], check["kind"])
        label = ABILITIES.get(check["ability"]) or SKILLS[check["ability"]][0]
        _log(state, f'{hero["name"]} {label}{"豁免" if check["kind"] == "save" else "检定"}：{rolls} + {bonus} = {roll + bonus} / DC {check["dc"]}，'
             f'{"成功" if roll + bonus >= check["dc"] and not auto_fail else "失败"}。', [pid], "roll")
        state["pending_check"] = None
        state["window_id"] += 1
    elif kind == "cancel_check":
        state["pending_check"] = None
        state["window_id"] += 1
    elif kind == "note":
        state["dm_note"] = action["text"]
    elif kind == "narrate":
        _log(state, action["text"].strip(), [pid], "narration")
    elif kind == "resolve":
        _require(action["reason"].strip(), "请填写裁定理由")
        _require(state["scene"] not in state["completed"] or action["outcome"] == "retreat", "此场景已解决，不会重复发放奖励")
        _require(state["phase"] == "combat" or SCENES[state["scene"]]["reward"] > 0, "此处没有待解决任务")
        _log(state, "DM 裁定：" + action["reason"].strip(), [pid], "ruling")
        state["pending_check"] = None
        _resolve_encounter(state, action["outcome"])
    elif kind == "adjust_hp":
        _require(action["reason"].strip(), "请填写裁定理由")
        target = _unit(state, action["target"])
        _log(state, "DM 生命裁定：" + action["reason"].strip(), [target["id"]], "ruling")
        if action["delta"] >= 0:
            _heal(state, target, action["delta"])
        else:
            _hurt(state, target, -action["delta"])
        ended = _check_end(state)
        if not ended and state["phase"] == "combat" and target["id"] == state["actor"] and target["hp"] <= 0:
            _end_turn(state)
    elif kind == "condition":
        target, cond = _unit(state, action["target"]), action["condition"]
        if action["enabled"] and cond not in target["conditions"]:
            target["conditions"].append(cond)
        elif not action["enabled"] and cond in target["conditions"]:
            target["conditions"].remove(cond)
        _log(state, f'DM：{target["name"]} {"获得" if action["enabled"] else "移除"}{CONDITIONS[cond]}。', [target["id"]], "ruling")
        if state["phase"] == "combat" and target["id"] == state["actor"] and cond == "stunned" and action["enabled"]:
            _end_turn(state)
    elif kind == "level_up":
        _require(not state["pending_check"], "请先处理检定")
        _require(all(h["level"] < 3 for h in state["heroes"].values()), "本入门冒险最高 3 级")
        for hero in state["heroes"].values():
            base = CLASSES[hero["class_id"]]
            gain = base["hit_die"] // 2 + 1 + hero["mods"]["con"] + int(hero["species"] == "dwarf")
            hero["level"] += 1
            hero["max_hp"] += gain
            if hero["hp"] > 0:
                hero["hp"] += gain
            hero["hit_dice"] += 1
            if base["spells"]:
                caps = [3, 0] if hero["level"] == 2 else [4, 2]
                old_caps = [2, 0] if hero["level"] == 2 else [3, 0]
                hero["slots"] = [value + caps[i] - old_caps[i] for i, value in enumerate(hero["slots"])]
            if hero["class_id"] == "fighter":
                hero["surge"] = 1
        _log(state, "DM 授予里程碑升级；角色板已更新。3 级子职业能力请由 DM 配合所用角色板裁定。", kind="ruling")
    elif kind == "finish":
        _require(state["completed"] and not state["pending_check"] and SCENES[state["scene"]]["safe"], "先完成至少一个任务，再返回安全据点结算")
        _require(action["reason"].strip(), "请填写冒险结语")
        _log(state, "冒险结语：" + action["reason"].strip(), kind="narration")
        _review(state, "final_review", "victory")
    elif kind == "rest":
        _rest(state, pid, action["kind"])
    elif kind == "buy_potion":
        _require(state["scene"] == "market" and state["gold"] >= 50 and state["heroes"][pid]["hp"] > 0, "请在集市购买，队伍需有 50 金币")
        state["gold"] -= 50
        state["heroes"][pid]["potions"] += 1
        _log(state, f'{state["heroes"][pid]["name"]} 购买治疗药水，花费队伍 💰 50。', [pid])
    else:
        combat = state["phase"] == "combat"
        actor = _actor(state, pid) if combat else state["heroes"][pid]
        _require(_conscious(actor), "角色无法行动")
        if kind == "end_turn":
            _log(state, f'{actor["name"]} 结束回合。', [actor["id"]])
            _end_turn(state)
        elif kind == "attack":
            _attack(state, actor, action["target"], action["weapon"])
        elif kind == "move":
            _move(state, actor, (action["x"], action["y"]))
        elif kind == "cast":
            _cast(state, actor, action, combat)
        elif kind in ("potion", "stabilize"):
            target = _unit(state, action["target"])
            _require(actor["side"] == target["side"] == "heroes" and not target["dead"], "请选择存活的冒险者")
            _require(not combat or _distance(actor["pos"], target["pos"]) <= 1, "需要接触目标")
            if kind == "potion":
                _require(actor["potions"] > 0, "没有治疗药水")
                if combat:
                    _spend(actor, True)
                actor["potions"] -= 1
                _heal(state, target, _dice(state, 2, 4) + 2)
            else:
                _require(target["hp"] == 0 and not target["stable"], "目标不需要稳定")
                if combat:
                    _spend(actor)
                roll, rolls = _d20(state, actor)
                total = roll + _check_bonus(actor, "medicine")
                if total >= 10:
                    target.update(stable=True, death_success=0, death_fail=0)
                _log(state, f'{actor["name"]} 医药检定 {rolls} → {total}：{"稳定目标" if total >= 10 else "未能稳定"}。', [actor["id"], target["id"]], "roll")
        elif kind in ("dodge", "dash", "disengage", "cunning_dash", "cunning_disengage"):
            cunning = kind.startswith("cunning_")
            _require(not cunning or (actor.get("class_id") == "rogue" and actor["level"] >= 2), "需要 2 级游荡者")
            _spend(actor, cunning)
            if kind.endswith("dash"):
                actor["move_left"] += actor["speed"]
            elif kind.endswith("disengage"):
                actor["disengaged"] = True
            else:
                actor["dodge"] = True
            label = "疾走" if kind.endswith("dash") else "撤离" if kind.endswith("disengage") else "闪避"
            _log(state, f'{actor["name"]} 使用{label}。', [actor["id"]])
        elif kind == "stand":
            _require("prone" in actor["conditions"] and actor["move_left"] >= actor["speed"] // 2 and "restrained" not in actor["conditions"], "无法起身")
            actor["move_left"] -= actor["speed"] // 2
            actor["conditions"].remove("prone")
        elif kind == "second_wind":
            _require(actor.get("class_id") == "fighter" and actor["second_wind"] > 0, "没有可用的回气")
            if combat:
                _spend(actor, True)
            actor["second_wind"] -= 1
            _heal(state, actor, _die(state, 10) + actor["level"])
        elif kind == "action_surge":
            _require(actor.get("class_id") == "fighter" and actor["surge"] > 0 and actor["level"] >= 2, "没有可用的动作如潮")
            actor["surge"] -= 1
            actor["action_left"] += 1
            _log(state, f'{actor["name"]} 发动动作如潮。', [actor["id"]])


class DndStarterSetGame:
    game_id = "dnd_starter_set"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        _require(_CONFIG_VALIDATOR.is_valid(config), "Invalid Borderlands configuration")
        _require(3 <= len(players) <= 5, "边陲英雄需要一名 DM 与 2–4 名冒险者")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p.get("player_id") for p in ordered]
        _require(all(isinstance(pid, str) and pid for pid in ids) and len(set(ids)) == len(ids), "Invalid player IDs")
        _require(not ordered[0].get("is_bot"), "第一席 DM 必须是真人")
        state = {"game_id": DndStarterSetGame.game_id, "version": 1, "game_instance_id": secrets.token_hex(12),
                 "window_id": 0, "revision": 0, "config": {}, "seed": config.get("seed", secrets.token_hex(16)), "rng_step": 0,
                 "players": {p["player_id"]: {"name": str(p.get("name") or p["player_id"]), "seat": i, "is_bot": bool(p.get("is_bot"))} for i, p in enumerate(ordered)},
                 "turn_order": ids, "dm": ids[0], "heroes": {}, "monsters": {}, "phase": "setup", "ready": [],
                 "scene": "keep", "map": _map("keep"), "visited": ["keep"], "completed": [], "gold": 50,
                 "rested": False, "round": 0, "turn_index": 0, "initiative": [], "actor": None, "current_turn": None,
                 "pending_check": None, "dm_note": "", "history": [], "round_log": [], "report": [], "log_seq": 0,
                 "outcome": None, "game_over": False, "winner_ids": []}
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase, dm = state["phase"], player_id == state["dm"]
        if phase == "setup":
            return [] if player_id in state["ready"] else (["ready"] if dm else ["choose", "ready"])
        if phase in REVIEW_PHASES:
            return [] if player_id in state["ready"] else ["next_round"]
        if state["pending_check"]:
            if dm:
                return ["narrate", "note", "cancel_check"]
            return ["roll_check"] if state["pending_check"]["target"] == player_id else []
        legal = ["narrate", "note", "adjust_hp", "condition", "resolve", "request_check"] if dm else []
        if phase == "exploration":
            if dm:
                return legal + ["travel", "encounter", "rest", "level_up", "finish"]
            hero = state["heroes"].get(player_id)
            return ["rest", "potion", "stabilize", "cast", "second_wind", "buy_potion"] if hero and _conscious(hero) else []
        if phase == "combat" and state["current_turn"] == player_id:
            actor = _unit(state, state["actor"])
            legal += ["end_turn", "move", "stand"]
            if actor["action_left"] > 0:
                legal += ["attack", "dodge", "dash", "disengage"]
            if actor["side"] == "heroes":
                legal += ["cast", "potion", "stabilize", "second_wind", "action_surge", "cunning_dash", "cunning_disengage"]
        return legal

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action"
        for key in ("window_id", "x", "y", "slot", "dc", "mode", "delta"):
            if key in action and type(action[key]) is not int:
                return [], "Invalid integer"
        if action["game_instance_id"] != state["game_instance_id"] or action["window_id"] != state["window_id"]:
            return [], "This action has expired. Use the current view."
        candidate = copy.deepcopy(state)
        try:
            _apply(candidate, player_id, action)
        except ValueError as exc:
            return [], str(exc)
        candidate["revision"] += 1
        state.clear()
        state.update(candidate)
        # Never broadcast a DM note, hidden DC, private seed, or input payload.
        return [{"type": "dnd_starter_set:updated", "payload": {"player_id": player_id}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        dm = viewer_id == state["dm"]
        scene = SCENES[state["scene"]]
        heroes = copy.deepcopy(list(state["heroes"].values()))
        monsters = []
        for monster in state["monsters"].values():
            if dm:
                monsters.append(copy.deepcopy(monster))
            else:
                monsters.append({key: copy.deepcopy(monster[key]) for key in ("id", "owner", "name", "side", "emoji", "pos", "conditions")})
                monsters[-1]["health"] = "击败" if monster["hp"] == 0 else "重伤" if monster["hp"] <= monster["max_hp"] / 2 else "健康"
        check = copy.deepcopy(state["pending_check"])
        if check and not dm:
            check.pop("dc")
        actor = _units(state).get(state["actor"])
        controls_actor = state["phase"] == "combat" and state["current_turn"] == viewer_id
        moves = [{"x": p[0], "y": p[1], "cost": data["cost"]} for p, data in _paths(state, actor).items()] if controls_actor else []
        view = {key: copy.deepcopy(state[key]) for key in ("game_id", "game_instance_id", "window_id", "revision", "phase", "dm", "ready", "scene", "map", "completed", "gold", "rested", "round", "initiative", "actor", "current_turn", "report", "outcome", "game_over", "winner_ids")}
        view.update(you=viewer_id, is_dm=dm, config={}, players=[{"player_id": pid, **copy.deepcopy(p)} for pid, p in state["players"].items()],
                    heroes=heroes, monsters=monsters, moves=moves, pending_check=check, history=copy.deepcopy(state["history"][-50:]),
                    scene_info={key: copy.deepcopy(scene[key]) for key in ("name", "region", "emoji", "text", "safe")},
                    routes=[{"id": sid, "name": SCENES[sid]["name"], "emoji": SCENES[sid]["emoji"], "region": SCENES[sid]["region"],
                             "visited": sid in state["visited"], "complete": sid in state["completed"]} for sid in scene["exits"]],
                    can_encounter=bool(scene["enemies"]) and state["scene"] not in state["completed"],
                    legal_actions=DndStarterSetGame.get_legal_actions(state, viewer_id),
                    classes=copy.deepcopy(CLASSES), species=copy.deepcopy(SPECIES), backgrounds=copy.deepcopy(BACKGROUNDS),
                    weapons=copy.deepcopy(WEAPONS), spells=copy.deepcopy(SPELLS), abilities=dict(ABILITIES),
                    skills={key: {"name": row[0], "ability": row[1]} for key, row in SKILLS.items()}, conditions=dict(CONDITIONS), regions=copy.deepcopy(REGIONS))
        if dm:
            view.update(dm_note=state["dm_note"], dm_scene=scene["dm"])
        return view

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        if player_id not in state["players"] or not state["players"][player_id]["is_bot"]:
            return None
        view = DndStarterSetGame.get_public_view(state, player_id)
        legal = view["legal_actions"]
        if not legal:
            return None
        action = None
        if "choose" in legal:
            hero = next((h for h in view["heroes"] if h["id"] == player_id), None)
            if hero:
                action = {"type": "ready"}
            else:
                taken = {h["class_id"] for h in view["heroes"]}
                cls = next(key for key in CLASSES if key not in taken)
                action = {"type": "choose", "class_id": cls, "species": "human", "background": "soldier"}
        elif "next_round" in legal:
            action = {"type": "next_round"}
        elif "roll_check" in legal:
            action = {"type": "roll_check"}
        elif "end_turn" in legal:
            hero = next(h for h in view["heroes"] if h["id"] == player_id)
            foes = [m for m in view["monsters"] if m.get("health") != "击败"]
            if hero["hp"] < hero["max_hp"] / 2 and hero["potions"] and hero["bonus_left"]:
                action = {"type": "potion", "target": player_id}
            elif "prone" in hero["conditions"] and hero["move_left"] >= 3:
                action = {"type": "stand"}
            elif hero["action_left"] and foes:
                target = min(foes, key=lambda m: _distance(hero["pos"], m["pos"]))
                dist = _distance(hero["pos"], target["pos"])
                if hero["class_id"] in ("cleric", "wizard") and _visible(state, hero["pos"], target["pos"]):
                    spell = "sacred_flame" if hero["class_id"] == "cleric" else "fire_bolt"
                    if dist <= SPELLS[spell]["range"]:
                        action = {"type": "cast", "spell": spell, "target": target["id"], "slot": 0}
                if not action:
                    for wid in CLASSES[hero["class_id"]]["weapons"]:
                        if dist <= WEAPONS[wid]["range"] and _visible(state, hero["pos"], target["pos"]):
                            action = {"type": "attack", "target": target["id"], "weapon": wid}
                            break
                if not action and view["moves"]:
                    move = min(view["moves"], key=lambda m: (_distance([m["x"], m["y"]], target["pos"]), m["cost"]))
                    if _distance([move["x"], move["y"]], target["pos"]) < dist:
                        action = {"type": "move", "x": move["x"], "y": move["y"]}
            action = action or {"type": "end_turn"}
        if action:
            action.update(game_instance_id=view["game_instance_id"], window_id=view["window_id"])
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            state = copy.deepcopy(payload)
            _require(state["game_id"] == DndStarterSetGame.game_id and state["version"] == 1, "Unsupported save")
            _require(state["phase"] in PHASES and state["game_over"] == (state["phase"] == "game_over"), "Invalid phase")
            _require(3 <= len(state["players"]) <= 5 and state["dm"] in state["players"] and not state["players"][state["dm"]]["is_bot"], "Invalid players")
            _require(set(state["turn_order"]) == set(state["players"]) and len(state["turn_order"]) == len(state["players"]), "Invalid seats")
            _require(state["scene"] in SCENES and state["map"] == _map(state["scene"]), "Invalid scene")
            _require(set(state["completed"]) <= set(SCENES) and len(set(state["ready"])) == len(state["ready"]) and set(state["ready"]) <= set(state["players"]), "Invalid progress")
            _require(set(state["heroes"]) <= set(state["players"]) - {state["dm"]}, "Invalid heroes")
            if state["phase"] != "setup":
                _require(set(state["heroes"]) == set(state["players"]) - {state["dm"]}, "Missing heroes")
            _require(len({h["class_id"] for h in state["heroes"].values()}) == len(state["heroes"]), "Duplicate classes")
            for key in ("revision", "window_id", "rng_step", "gold", "round", "log_seq"):
                _require(type(state[key]) is int and state[key] >= 0, "Invalid counter")
            for uid, unit in _units(state).items():
                _require(unit["id"] == uid and unit["owner"] in state["players"] and type(unit["hp"]) is int and 0 <= unit["hp"] <= unit["max_hp"], "Invalid unit")
                _require(len(unit["pos"]) == 2 and all(type(v) is int for v in unit["pos"]) and 0 <= unit["pos"][0] < 10 and 0 <= unit["pos"][1] < 8, "Invalid position")
                _require(set(unit["conditions"]) <= set(CONDITIONS), "Invalid condition")
            for hero in state["heroes"].values():
                _require(hero["class_id"] in CLASSES and hero["species"] in SPECIES and hero["background"] in BACKGROUNDS and type(hero["level"]) is int and 1 <= hero["level"] <= 3, "Invalid character")
                _require(len(hero["slots"]) == 2 and all(type(v) is int and 0 <= v <= 4 for v in hero["slots"]) and 0 <= hero["hit_dice"] <= hero["level"] and hero["potions"] >= 0, "Invalid resources")
            if state["phase"] == "combat":
                _require(state["actor"] in _units(state) and state["current_turn"] == _unit(state, state["actor"])["owner"], "Invalid actor")
                _require(state["initiative"][state["turn_index"]]["id"] == state["actor"], "Invalid initiative")
            if state["pending_check"]:
                _require(state["phase"] in ("exploration", "combat") and state["pending_check"]["target"] in state["heroes"], "Invalid check")
            return state
        except (KeyError, TypeError, IndexError, AttributeError, ValueError) as exc:
            raise ValueError("Invalid Borderlands save") from exc
