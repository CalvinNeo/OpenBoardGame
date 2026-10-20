"""Two-player Dice Throne digital adaptation with the eight Season One heroes."""
from __future__ import annotations

import copy
import random
from typing import Dict, List, Optional, Tuple

from .dice_throne_data import CARDS, DECKS, HEROES, RULES, RULES_NOTE, STATUSES

_ACTIONS = ["choose_hero", "roll", "toggle_keep", "confirm_roll", "use_ability",
            "play_card", "buy_upgrade", "sell_card", "defend", "pass", "end_phase", "next_round"]
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": ["integer", "string", "null"]}}, "additionalProperties": False}
ACTION_SCHEMA = {"type": "object", "properties": {
    "type": {"enum": _ACTIONS}, "revision": {"type": "integer", "minimum": 0},
    "hero": {"enum": list(HEROES)}, "index": {"type": "integer", "minimum": 0, "maximum": 4},
    "value": {"type": "integer", "minimum": 1, "maximum": 6},
    "source_index": {"type": "integer", "minimum": 0, "maximum": 4},
    "status": {"type": "string"}, "ability_id": {"type": "string"},
    "card_id": {"type": "string"}, "target": {"type": "string"},
    "level": {"type": "integer", "minimum": 2, "maximum": 3},
}, "required": ["type", "revision"], "additionalProperties": False}


def _seeded(state: Dict) -> random.Random:
    rng = random.Random()
    rng.setstate(state["rng_state"])
    return rng


def _roll_values(state: Dict, count: int) -> List[int]:
    rng = _seeded(state)
    values = [rng.randint(1, 6) for _ in range(count)]
    state["rng_state"] = rng.getstate()
    return values


def _die(hero: str, value: int) -> Dict:
    return {"value": value, "face": HEROES[hero]["dice_faces"][value - 1]}


def _roll_dice(state: Dict, hero: str, count: int) -> List[Dict]:
    return [_die(hero, value) for value in _roll_values(state, count)]


def _dice_text(hero: str, dice: List[Dict]) -> str:
    icons = HEROES[hero]["symbol_icons"]
    return " · ".join(f"{die['value']}{icons[die['face']]}" for die in dice)


def _other(state: Dict, pid: str) -> str:
    return next(other for other in state["turn_order"] if other != pid)


def _log(state: Dict, pid: str, text: str) -> None:
    state.setdefault("log", []).append({"player_id": pid, "text": text})
    state["log"] = state["log"][-40:]


def _cp(player: Dict, amount: int) -> None:
    player["combat_points"] = max(0, min(RULES["max_cp"], player["combat_points"] + amount))


def _heal(player: Dict, amount: int) -> None:
    player["health"] = min(RULES["max_health"], player["health"] + max(0, int(amount)))


def _draw(state: Dict, pid: str, count: int = 1) -> None:
    player = state["players"][pid]
    for _ in range(count):
        if len(player["hand"]) >= RULES["max_hand"]:
            break
        if not player["deck"]:
            player["deck"] = list(player["discard"])
            player["discard"] = []
        if not player["deck"]:
            break
        rng = _seeded(state)
        index = rng.randrange(len(player["deck"]))
        state["rng_state"] = rng.getstate()
        player["hand"].append(player["deck"].pop(index))


def _hero_abilities(hero: str, upgrades: List[Dict]) -> List[Tuple[Dict, int]]:
    result = []
    for original in HEROES[hero]["abilities"]:
        level = max([u["level"] for u in upgrades if u.get("ability") == original["id"]] or [1])
        result.append((original, level))
    return result


def _counts(dice: List) -> Dict[str, int]:
    counts = {}
    for die in dice:
        face = die.get("face") if isinstance(die, dict) else die
        counts[face] = counts.get(face, 0) + 1
    return counts


def _condition(ability: Dict, dice: List) -> bool:
    if len(dice) != RULES["dice"]:
        return False
    condition, counts = ability.get("condition", {}), _counts(dice)
    if any(counts.get(symbol, 0) < needed for symbol, needed in condition.get("counts", {}).items()):
        return False
    if "straight" in condition:
        values = {die.get("value") for die in dice if isinstance(die, dict)}
        needed = condition["straight"]
        if not any(set(range(start, start + needed)) <= values for start in range(1, 8 - needed)):
            return False
    return True


def _ability_cost(ability_id: str) -> int:
    # Abilities activate from dice patterns; CP is spent on cards.
    return 0


def _remove_status(player: Dict, status: str, count: int = 1) -> None:
    remaining = player["statuses"].get(status, 0) - count
    if remaining > 0:
        player["statuses"][status] = remaining
    else:
        player["statuses"].pop(status, None)


def _status(player: Dict, status: str, count: int = 1, unstoppable: bool = False) -> None:
    if status not in STATUSES or count <= 0:
        return
    info = STATUSES[status]
    if not info["positive"] and not unstoppable:
        blocked = min(count, player["statuses"].get("cleanse", 0))
        _remove_status(player, "cleanse", blocked)
        count -= blocked
    if count:
        player["statuses"][status] = min(info["limit"], player["statuses"].get(status, 0) + count)


def _damage(state: Dict, target: str, amount: int, kind: str = "normal", attack: bool = False) -> int:
    """Apply one instance; attack modifiers are snapshotted at activation."""
    player = state["players"][target]
    amount = max(0, int(amount))
    if not amount:
        return 0
    if kind != "ultimate":
        if attack and player["statuses"].get("shadows"):
            _log(state, target, "🌑 暗影避免了本次进攻伤害。")
            return 0
        for status, success in (("evasive", 2), ("smoke_bomb", 3)):
            if player["statuses"].get(status):
                _remove_status(player, status)
                value = _roll_values(state, 1)[0]
                _log(state, target, f"{STATUSES[status]['icon']} {STATUSES[status]['name_zh']}：掷出 {value}。")
                if value <= success:
                    return 0
        if attack and player["statuses"].get("protect"):
            _remove_status(player, "protect")
            amount //= 2
        chi = min(amount, player["statuses"].get("chi", 0))
        _remove_status(player, "chi", chi)
        amount -= chi
    player["health"] = max(0, player["health"] - amount)
    if player["health"] == 0 and player["statuses"].get("blessing"):
        _remove_status(player, "blessing")
        player["health"] = 1
        _log(state, target, "🌟 神佑触发，生命恢复为 1。")
    return amount


def _apply_effects(state: Dict, pid: str, target: str, data: Dict, level: int = 1) -> None:
    player, opponent = state["players"][pid], state["players"][target]
    healing = data.get("heal", 0)
    if data.get("heal_scales"):
        key, scale = next(iter(data["heal_scales"].items()))
        index = max(0, min(len(scale) - 1, _counts(state["dice"]).get(key, 0) - data["condition"]["counts"][key]))
        healing = scale[index]
    if healing:
        _heal(player, healing + level - 1)
    gain = data.get("gain_cp", 0)
    if not data.get("damage") and not healing:
        gain += level - 1
    _cp(player, gain)
    if data.get("draw"):
        _draw(state, pid, data["draw"])
    for status in data.get("self_status", []):
        _status(player, status)
    for status in data.get("opponent_status", []):
        _status(opponent, status, unstoppable=data.get("damage_type") == "ultimate")


def _check_winner(state: Dict) -> None:
    alive = [pid for pid in state["turn_order"] if state["players"][pid]["health"] > 0]
    if len(alive) < len(state["turn_order"]):
        state["game_over"] = True
        state["phase"] = "game_over"
        state["current_player"] = None
        state["winner"] = alive  # Empty means simultaneous knockout / draw.


def _begin_turn(state: Dict, pid: str, first: bool = False) -> None:
    player = state["players"][pid]
    state.update(phase="main_1", current_player=pid, turn_player=pid, dice=[],
                 kept=[False] * 5, rolls=0, roll_limit=RULES["roll_attempts"], defense_dice=[], pending_attack=None)
    player["shadows_started_turn"] = bool(player["statuses"].get("shadows"))
    _remove_status(player, "fire_mastery")
    upkeep = player["statuses"].get("poison", 0) + (2 if player["statuses"].get("burn") else 0)
    if upkeep:
        dealt = _damage(state, pid, upkeep, "persistent")
        _log(state, pid, f"☠️ 维护阶段受到 {dealt} 点持续伤害。")
        _check_winner(state)
        if state["game_over"]:
            return
    if player["statuses"].get("sapling"):
        _remove_status(player, "sapling")
        _heal(player, 2)
        _cp(player, 1)
    if player["statuses"].get("wellspring"):
        _heal(player, player["statuses"].pop("wellspring"))
    if player["statuses"].get("concussion"):
        _remove_status(player, "concussion")
        _log(state, pid, "💥 脑震荡：跳过收入。")
    elif not first:
        _cp(player, 1)
        _draw(state, pid)


def _start_offense(state: Dict, pid: str) -> None:
    player = state["players"][pid]
    state.update(dice=[], kept=[False] * 5, rolls=0, roll_limit=RULES["roll_attempts"], defense_dice=[])
    if player["statuses"].get("stun"):
        _remove_status(player, "stun")
        state["phase"] = "main_2"
        _log(state, pid, "💫 眩晕：跳过本次进攻。")
        return
    if player["statuses"].get("knockdown"):
        _remove_status(player, "knockdown")
        if player["combat_points"] < 2:
            state["phase"] = "main_2"
            _log(state, pid, "⬇️ 击倒：CP 不足，跳过进攻。")
            return
        _cp(player, -2)
        _log(state, pid, "⬇️ 支付 2 CP 解除击倒。")
    if player["statuses"].get("entangle"):
        _remove_status(player, "entangle")
        state["roll_limit"] -= 1
    if player["statuses"].get("seedling"):
        _remove_status(player, "seedling")
        state["roll_limit"] += 1
    state["phase"] = "offensive_roll"


def _finish_turn(state: Dict, pid: str) -> None:
    player = state["players"][pid]
    if player["statuses"].get("delayed_poison"):
        amount = player["statuses"].pop("delayed_poison") * 3
        dealt = _damage(state, pid, amount, "persistent")
        _log(state, pid, f"🧪 延迟毒素造成 {dealt} 点伤害。")
    if player.get("shadows_started_turn"):
        _remove_status(player, "shadows")
        player["shadows_started_turn"] = False
    state["turn_player"] = pid
    state["phase"] = "round_review"
    state["current_player"] = None
    state["next_round_ready"] = []
    state["round_review"] = copy.deepcopy(state.get("log", [])[-6:])
    if not state["round_review"]:
        state["round_review"] = [{"player_id": pid, "text": "回合结束。"}]


def _finish_offense(state: Dict, pid: str) -> None:
    """Settle effects owed by rolling even when the player skips the attack."""
    player = state["players"][pid]
    if player["statuses"].get("barbed_vine"):
        _remove_status(player, "barbed_vine")
        dealt = _damage(state, pid, max(0, state["rolls"] - 1), "persistent")
        _log(state, pid, f"🌵 荆棘造成 {dealt} 点伤害。")


def _finish_attack(state: Dict, defend: bool) -> None:
    attack = state["pending_attack"]
    attacker_id, defender_id = attack["attacker"], attack["defender"]
    attacker, defender = state["players"][attacker_id], state["players"][defender_id]
    incoming = max(0, attack["damage"] - attack.get("prevent", 0))
    returned = 0
    if defend and attack["damage_type"] == "normal":
        defense = HEROES[defender["hero"]]["defense"]
        dice = _roll_dice(state, defender["hero"], defense["dice"])
        state["defense_dice"] = copy.deepcopy(dice)
        counts = _counts(dice)
        _heal(defender, sum(counts.get(face, 0) * n for face, n in defense.get("heal_per", {}).items()))
        _cp(defender, sum(counts.get(face, 0) * n for face, n in defense.get("cp_per", {}).items()))
        for face, status in defense.get("status_per", {}).items():
            _status(defender, status, counts.get(face, 0))
        incoming -= sum(counts.get(face, 0) * n for face, n in defense.get("prevent_per", {}).items())
        incoming = max(0, incoming)
        if defense.get("half_if") and all(counts.get(face, 0) >= n for face, n in defense["half_if"].items()):
            incoming //= 2
        returned += sum(counts.get(face, 0) * n for face, n in defense.get("return_per", {}).items())
        returned += sum(counts.get(face, 0) // n for face, n in defense.get("return_groups", {}).items())
        _log(state, defender_id, f"🛡️ {defense['name']}：" + _dice_text(defender["hero"], dice))
    if attack["damage_type"] != "ultimate" and incoming > 0 and defender["statuses"].get("retribution"):
        _remove_status(defender, "retribution")
        returned += (incoming + 1) // 2
    dealt = _damage(state, defender_id, incoming, attack["damage_type"], attack=True)
    if returned:
        _damage(state, attacker_id, returned, "return")
    if attack.get("return_damage"):
        _damage(state, attacker_id, attack["return_damage"], "return")
    ability = next((a for a in HEROES[attacker["hero"]]["abilities"] if a["id"] == attack.get("ability_id")), None)
    if ability:
        _apply_effects(state, attacker_id, defender_id, ability, attack.get("level", 1))
    if attack.get("concussion"):
        _status(defender, "concussion")
    _log(state, attacker_id, f"⚔️ {attack.get('ability_name', attack.get('ability_id', 'Attack'))}：造成 {dealt} 点伤害。")
    state.update(phase="main_2", current_player=attacker_id, pending_attack=None)


def _activate_ability(state: Dict, pid: str, action: Dict) -> None:
    player, target = state["players"][pid], action.get("target") or _other(state, pid)
    if target != _other(state, pid):
        raise ValueError("invalid ability target")
    found = next(((a, level) for a, level in _hero_abilities(player["hero"], player["upgrades"])
                  if a["id"] == action.get("ability_id")), None)
    if not found or not _condition(found[0], state["dice"]):
        raise ValueError("ability pattern not met")
    ability, level = found
    if not ability.get("damage"):
        _apply_effects(state, pid, target, ability, level)
        state["phase"] = "main_2"
        _log(state, pid, f"✨ {ability['name']}")
        return
    if player["statuses"].get("blind"):
        _remove_status(player, "blind")
        value = _roll_values(state, 1)[0]
        _log(state, pid, f"🙈 致盲检定：{value}。")
        if value <= 2:
            state["phase"] = "main_2"
            _log(state, pid, "攻击失效。")
            return
    damage = ability["damage"]
    extra_dice = []
    if damage == "sum3":
        extra_dice = _roll_dice(state, player["hero"], 3)
        damage = sum(d["value"] for d in extra_dice)
    elif damage == "cp":
        damage = player["combat_points"]
    if ability.get("scales"):
        key, scale = next(iter(ability["scales"].items()))
        index = min(len(scale) - 1, _counts(state["dice"])[key] - ability["condition"]["counts"][key])
        damage = scale[max(0, index)]
    if ability.get("roll_five"):
        extra_dice = _roll_dice(state, player["hero"], 5)
        counts = _counts(extra_dice)
        damage += counts.get("arrow", 0) + counts.get("foot", 0)
        _cp(state["players"][target], -counts.get("moon", 0))
    concussion = bool(ability.get("concussion_if") and damage >= ability["concussion_if"])
    damage += level - 1
    damage += player["statuses"].get("fire_mastery", 0)
    kind = ability["damage_type"]
    if kind != "ultimate":
        if player["statuses"].get("crit") and damage >= 5:
            _remove_status(player, "crit")
            damage += 4
        if player["statuses"].get("accuracy") and kind == "normal":
            _remove_status(player, "accuracy")
            kind = "undefendable"
        if player["statuses"].get("sneak_attack"):
            _remove_status(player, "sneak_attack")
            damage += _roll_values(state, 1)[0]
        if player["statuses"].get("ninjutsu"):
            _remove_status(player, "ninjutsu")
            value = _roll_values(state, 1)[0]
            damage += 1 if value <= 3 else 2 if value <= 5 else 3
        if player["statuses"].get("dryad"):
            _remove_status(player, "dryad")
            damage += 3
    if state["players"][target]["statuses"].get("targeted"):
        _remove_status(state["players"][target], "targeted")
        damage += 2
    state["pending_attack"] = {"attacker": pid, "defender": target, "damage": damage,
                               "damage_type": kind, "ability_id": ability["id"], "ability_name": ability["name"],
                               "level": level, "prevent": 0, "extra_dice": extra_dice,
                               "return_damage": ability.get("return_damage", 0), "concussion": concussion}
    state["defense_dice"] = []
    state["phase"] = "defensive_roll"
    state["current_player"] = target
    _log(state, pid, f"⚔️ 发动 {ability['name']}：{damage} 点待结算伤害。")


def _card_reason(state: Dict, pid: str, card: Dict) -> str:
    if state["current_player"] != pid or state["game_over"]:
        return "等待自己的行动机会"
    phase, timing = state["phase"], card["timing"]
    attack = state.get("pending_attack") or {}
    if phase == "defensive_roll" and attack.get("damage_type") == "ultimate":
        return "终极技能确认后不能使用卡牌"
    if phase in ("main_1", "main_2"):
        if timing not in ("main", "instant"):
            return "仅可在掷骰或防御时使用"
    elif phase in ("offensive_roll", "targeting"):
        if timing not in ("roll", "instant"):
            return "仅可在主要阶段或防御时使用"
        if timing == "roll" and not state["dice"]:
            return "请先掷骰"
    elif phase == "defensive_roll":
        if timing not in ("defense", "instant"):
            return "当前不能使用这张牌"
    else:
        return "当前不能使用卡牌"
    player = state["players"][pid]
    if card.get("hero") not in (None, player["hero"]):
        return "此卡属于其他英雄"
    if player["combat_points"] < card["cost"]:
        return "CP 不足"
    if card["effect"] == "upgrade" and any(u["ability"] == card["ability"] and u["level"] >= card["level"] for u in player["upgrades"]):
        return "已经拥有此等级或更高升级"
    if card["effect"] == "extra_roll" and state.get("roll_limit", 3) >= 5:
        return "已经达到 5 次掷骰上限"
    if card["effect"] in ("clean_one", "clean_all") and not any(
            _removable(sid) for p in state["players"].values() for sid in p["statuses"]):
        return "没有可以移除的状态"
    return ""


def _removable(status: str) -> bool:
    return status in STATUSES and status != "blessing" and not STATUSES[status].get("companion")


def _play_card(state: Dict, pid: str, action: Dict) -> None:
    player, cid = state["players"][pid], action.get("card_id")
    if cid not in player["hand"] or cid not in CARDS:
        raise ValueError("card not in hand")
    card = CARDS[cid]
    reason = _card_reason(state, pid, card)
    if reason:
        raise ValueError(reason)
    target = action.get("target") or (pid if card["target"] != "opponent" else _other(state, pid))
    if target not in state["players"]:
        raise ValueError("invalid card target")
    if card["target"] == "self" and target != pid or card["target"] == "opponent" and target == pid:
        raise ValueError("invalid card target")
    effect = card["effect"]
    if "die" in card["inputs"]:
        index = action.get("index")
        if type(index) is not int or not 0 <= index < len(state["dice"]):
            raise ValueError("choose a die")
    if "value" in card["inputs"]:
        value = action.get("value")
        if type(value) is not int or not 1 <= value <= 6:
            raise ValueError("choose a value from 1 to 6")
    if effect == "tip_die" and abs(state["dice"][index]["value"] - value) != 1:
        raise ValueError("die must change by exactly one")
    if effect == "copy_die":
        source = action.get("source_index")
        if type(source) is not int or not 0 <= source < len(state["dice"]) or source == index:
            raise ValueError("choose a different source die")
    if effect == "clean_one":
        status = action.get("status")
        if not _removable(status) or not state["players"][target]["statuses"].get(status):
            raise ValueError("choose a removable status on the target")
    _cp(player, -card["cost"])
    player["hand"].remove(cid)
    player["discard"].append(cid)
    if effect == "gain":
        _apply_effects(state, pid, target, card)
    elif effect == "upgrade":
        player["upgrades"] = [u for u in player["upgrades"] if u["ability"] != card["ability"]]
        player["upgrades"].append({"ability": card["ability"], "level": card["level"]})
    elif effect == "vegas":
        _cp(player, (_roll_values(state, 1)[0] + 1) // 2)
    elif effect == "clean_all":
        for status in list(state["players"][target]["statuses"]):
            if _removable(status):
                state["players"][target]["statuses"].pop(status)
    elif effect == "clean_one":
        _remove_status(state["players"][target], status)
    elif effect in ("set_die", "tip_die"):
        state["dice"][index] = _die(player["hero"], card.get("fixed_value", action.get("value")))
    elif effect == "copy_die":
        state["dice"][index] = _die(player["hero"], state["dice"][source]["value"])
    elif effect == "reroll_die":
        state["dice"][index] = _roll_dice(state, player["hero"], 1)[0]
    elif effect == "extra_roll":
        state["roll_limit"] = state.get("roll_limit", 3) + 1
        state["phase"] = "offensive_roll"
    elif effect == "prevent":
        state["pending_attack"]["prevent"] = state["pending_attack"].get("prevent", 0) + card["prevent"]
    else:
        raise ValueError("unsupported card")
    _log(state, pid, f"🃏 使用 {card['name']}。")


class DiceThroneGame:
    game_id = "dice_throne"
    min_players = 2
    max_players = 2

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) != 2:
            raise ValueError("Dice Throne requires exactly 2 players")
        seed = (config or {}).get("seed")
        if seed is None:
            seed = random.randrange(2**31)
        order = [p["player_id"] for p in sorted(players, key=lambda p: (p.get("seat", 0), p["player_id"]))]
        rng = random.Random(str(seed))
        rng.shuffle(order)
        return {
            "game_id": "dice_throne", "rules_version": 2, "config": {"seed": seed}, "revision": 0,
            "phase": "choose_hero", "current_player": order[0], "turn_player": order[0], "turn_order": order,
            "player_meta": {p["player_id"]: dict(p) for p in players},
            "players": {p["player_id"]: {"hero": None, "health": RULES["max_health"], "combat_points": RULES["starting_cp"],
                                        "statuses": {}, "hand": [], "upgrades": [], "deck": [], "discard": [],
                                        "shadows_started_turn": False} for p in players},
            "dice": [], "kept": [False] * 5, "rolls": 0, "roll_limit": RULES["roll_attempts"],
            "defense_dice": [], "rng_state": rng.getstate(), "deck": [], "discard": [], "pending_attack": None,
            "winner": [], "game_over": False, "round": 1, "turn_count": 0,
            "round_review": [], "next_round_ready": [], "log": [],
        }

    @staticmethod
    def _start(state: Dict) -> None:
        for pid in state["turn_order"]:
            state["players"][pid]["deck"] = list(DECKS[state["players"][pid]["hero"]])
            _draw(state, pid, RULES["starting_hand"])
        _begin_turn(state, state["turn_order"][0], first=True)

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}) or state.get("game_over"):
            return []
        phase, current = state["phase"], state.get("current_player")
        if phase == "choose_hero":
            return ["choose_hero"] if not state["players"][player_id]["hero"] else []
        if phase == "round_review":
            return ["next_round"] if player_id not in state["next_round_ready"] else []
        if current != player_id:
            return []
        if phase == "defensive_roll":
            kind = (state.get("pending_attack") or {}).get("damage_type", "normal")
            return (["defend"] if kind == "normal" else []) + (["play_card"] if kind != "ultimate" else []) + ["pass"]
        if phase in ("main_1", "main_2"):
            return ["play_card", "buy_upgrade", "sell_card", "end_phase", "pass"]
        if phase == "offensive_roll":
            actions = ["play_card", "pass"]
            if state.get("rolls", 0) < state.get("roll_limit", 3):
                actions.insert(0, "roll")
            if state.get("dice"):
                actions.extend(["toggle_keep", "confirm_roll"])
            return actions
        if phase == "targeting":
            return ["use_ability", "play_card", "pass"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or type(action.get("revision")) is not int or action["revision"] != state.get("revision"):
            return [], "stale revision"
        typ, pid = action.get("type"), player_id
        if pid not in state.get("players", {}) or typ not in _ACTIONS:
            return [], "invalid action"
        if typ not in DiceThroneGame.get_legal_actions(state, pid):
            return [], "action not available"
        before = copy.deepcopy(state)
        player = state["players"][pid]
        try:
            if typ == "choose_hero":
                hero = action.get("hero")
                if hero not in HEROES or any(p["hero"] == hero for p in state["players"].values()):
                    raise ValueError("hero unavailable")
                player["hero"] = hero
                if all(p["hero"] for p in state["players"].values()):
                    DiceThroneGame._start(state)
            elif typ == "roll":
                if state["rolls"] >= state.get("roll_limit", 3):
                    raise ValueError("no rolls remaining")
                dice = state["dice"] or [None] * 5
                state["dice"] = [die if state["kept"][i] else _roll_dice(state, player["hero"], 1)[0] for i, die in enumerate(dice)]
                state["rolls"] += 1
                _log(state, pid, f"🎲 进攻掷骰 {state['rolls']}/{state.get('roll_limit', 3)}：" + _dice_text(player["hero"], state["dice"]))
            elif typ == "toggle_keep":
                index = action.get("index")
                if type(index) is not int or not 0 <= index < len(state["dice"]):
                    raise ValueError("invalid die")
                state["kept"][index] = not state["kept"][index]
            elif typ == "confirm_roll":
                state["phase"] = "targeting"
                _finish_offense(state, pid)
            elif typ == "use_ability":
                _activate_ability(state, pid, action)
            elif typ == "defend":
                _finish_attack(state, defend=True)
            elif typ in ("pass", "end_phase"):
                if state["phase"] == "defensive_roll":
                    _finish_attack(state, defend=False)
                elif state["phase"] == "main_1":
                    _start_offense(state, pid)
                elif state["phase"] in ("offensive_roll", "targeting"):
                    _finish_offense(state, pid)
                    state["phase"] = "main_2"
                else:
                    _finish_turn(state, pid)
            elif typ == "sell_card":
                cid = action.get("card_id")
                if cid not in player["hand"]:
                    raise ValueError("card not in hand")
                player["hand"].remove(cid)
                player["discard"].append(cid)
                _cp(player, 1)
                _log(state, pid, "🃏 卖出 1 张牌，获得 1 CP。")
            elif typ == "play_card":
                _play_card(state, pid, action)
            elif typ == "buy_upgrade":
                level, ability = action.get("level", 2), action.get("ability_id")
                cid = next((cid for cid in player["hand"] if CARDS.get(cid, {}).get("ability") == ability and CARDS[cid].get("level") == level), None)
                if not cid:
                    raise ValueError("upgrade card not in hand")
                _play_card(state, pid, {"card_id": cid})
            elif typ == "next_round":
                state["next_round_ready"].append(pid)
                if len(state["next_round_ready"]) == 2:
                    previous = state["turn_player"]
                    state["next_round_ready"] = []
                    state["round_review"] = []
                    state["round"] += 1
                    state["turn_count"] += 1
                    _begin_turn(state, _other(state, previous))
            state["revision"] += 1
            _check_winner(state)
            return [{"type": "dice_throne:" + typ, "payload": {"player_id": pid, "type": typ}}], None
        except (ValueError, KeyError, StopIteration, TypeError, IndexError) as exc:
            state.clear()
            state.update(before)
            return [], str(exc) or "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            players.append({"player_id": pid, "name": state["player_meta"][pid].get("name", pid),
                            "hero": player["hero"], "health": player["health"], "max_health": RULES["max_health"],
                            "combat_points": player["combat_points"], "statuses": [{"id": key, "stacks": count} for key, count in player["statuses"].items()],
                            "hand_count": len(player["hand"]), "deck_count": len(player.get("deck", [])),
                            "upgrades": [f"{u['ability']}_{u['level']}" for u in player["upgrades"]],
                            "is_bot": bool(state["player_meta"][pid].get("is_bot"))})
        own = state["players"].get(viewer_id, {})
        legal = DiceThroneGame.get_legal_actions(state, viewer_id)
        hand = []
        for cid in own.get("hand", []):
            card = copy.deepcopy(CARDS.get(cid, {"name": cid, "description": "旧版卡牌，可出售。", "cost": 0, "timing": "main", "effect": "legacy", "hero": None}))
            card["id"] = cid
            reason = _card_reason(state, viewer_id, card) if cid in CARDS else "旧版卡牌仅可出售"
            card.update(can_play="play_card" in legal and not reason, can_sell="sell_card" in legal, unavailable_reason=reason)
            hand.append(card)
        abilities = []
        if own.get("hero"):
            for ability, level in _hero_abilities(own["hero"], own["upgrades"]):
                info = copy.deepcopy(ability)
                met = _condition(ability, state.get("dice", []))
                info.update(level=level, cost=0, pattern_met=met, available="use_ability" in legal and met, target="opponent")
                if level > 1:
                    info["description"] += f" 升级 {level}：基础伤害/治疗 +{level - 1}；纯资源技能额外 +{level - 1} CP。"
                abilities.append(info)
        return {"game_id": "dice_throne", "revision": state["revision"], "phase": state["phase"],
                "current_player": state.get("current_player"), "turn_player": state.get("turn_player"),
                "players": players, "you": viewer_id, "your_hand": hand,
                "hero_catalog": copy.deepcopy(HEROES), "status_catalog": copy.deepcopy(STATUSES),
                "edition_note": RULES_NOTE, "rules_note": RULES_NOTE,
                "dice": [{"index": i, "face": die["face"], "value": die["value"], "kept": state["kept"][i]} for i, die in enumerate(state.get("dice", []))],
                "roll_count": state.get("rolls", 0), "roll_limit": state.get("roll_limit", 3),
                "defense_dice": copy.deepcopy(state.get("defense_dice", [])), "abilities": abilities,
                "pending_attack": copy.deepcopy(state.get("pending_attack")),
                "discard_count": sum(len(p.get("discard", [])) for p in state["players"].values()),
                "legal_actions": legal, "winner": list(state.get("winner", [])), "game_over": state.get("game_over", False),
                "round_review": copy.deepcopy(state.get("round_review", [])), "next_round_ready": list(state.get("next_round_ready", [])),
                "round": state.get("round", 1), "log": copy.deepcopy(state.get("log", []))}

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = DiceThroneGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        action = {"revision": state["revision"], "delay_ms": 350}
        player = state["players"][bot_id]
        if "choose_hero" in legal:
            taken = {p["hero"] for p in state["players"].values()}
            # Stable variety without changing the game's random stream.
            heroes = list(HEROES)
            offset = sum(ord(char) for char in str(state["config"].get("seed")) + bot_id) % len(heroes)
            available = heroes[offset:] + heroes[:offset]
            return {**action, "type": "choose_hero", "hero": next(hero for hero in available if hero not in taken)}
        if "next_round" in legal:
            return {**action, "type": "next_round"}
        if state["phase"] == "offensive_roll":
            ready = [(ability, level) for ability, level in _hero_abilities(player["hero"], player["upgrades"])
                     if _condition(ability, state["dice"]) and ability.get("damage")]
            if ready or "roll" not in legal:
                return {**action, "type": "confirm_roll" if "confirm_roll" in legal else "pass"}
            # Keep the common damage symbol, so every hero can complete a basic attack.
            symbol = HEROES[player["hero"]]["dice_faces"][0]
            for i, die in enumerate(state["dice"]):
                if state["kept"][i] != (die["face"] == symbol):
                    return {**action, "type": "toggle_keep", "index": i}
            return {**action, "type": "roll"}
        if "use_ability" in legal:
            candidates = [(ability, level) for ability, level in _hero_abilities(player["hero"], player["upgrades"])
                          if _condition(ability, state["dice"])]
            if candidates:
                def score(item):
                    ability, level = item
                    value = ability.get("damage", 0)
                    damage = player["combat_points"] if value == "cp" else 10 if value == "sum3" else value
                    return damage + level - 1 + min(50 - player["health"], ability.get("heal", 0)) * 0.6
                ability, level = max(candidates, key=score)
                return {**action, "type": "use_ability", "ability_id": ability["id"]}
            return {**action, "type": "pass"}
        if state["phase"] == "defensive_roll":
            return {**action, "type": "defend" if "defend" in legal else "pass"}
        if "end_phase" in legal:
            for cid in player["hand"]:
                card = CARDS.get(cid)
                if card and card["effect"] in ("gain", "upgrade", "vegas") and not _card_reason(state, bot_id, card):
                    return {**action, "type": "play_card", "card_id": cid}
            if len(player["hand"]) >= RULES["max_hand"]:
                return {**action, "type": "sell_card", "card_id": player["hand"][0]}
            return {**action, "type": "end_phase"}
        return {**action, "type": "pass"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)

        def tuples(value):
            if isinstance(value, list):
                return tuple(tuples(item) for item in value)
            return value

        if isinstance(state.get("rng_state"), list):
            state["rng_state"] = tuples(state["rng_state"])
        # Upgrade old two-hero saves once. Keep hands (legacy cards remain
        # sellable), board state and RNG; replace the shared draw pool with
        # independent legal hero pools without exposing other players' cards.
        if state.get("rules_version", 1) < 2:
            for pid, player in state["players"].items():
                hero = player.get("hero")
                pool = list(DECKS.get(hero, []))
                for cid in player.get("hand", []):
                    if cid in pool:
                        pool.remove(cid)
                player["deck"], player["discard"] = pool, []
                player["shadows_started_turn"] = False
                player["upgrades"] = [u for u in player.get("upgrades", []) if hero and any(a["id"] == u.get("ability") for a in HEROES[hero]["abilities"])]
            state["deck"], state["discard"] = [], []
            attack = state.get("pending_attack") or {}
            previous = attack.get("attacker") or state.get("current_player")
            if previous is None and state.get("round_review"):
                previous = state["round_review"][-1].get("player_id")
            state["turn_player"] = previous or state["turn_order"][state.get("turn_count", 0) % 2]
            rolling = state["players"][state["turn_player"]].get("hero")
            if rolling:
                state["dice"] = [_die(rolling, d.get("value", 1) if isinstance(d, dict) else 1) for d in state.get("dice", [])]
            if attack:
                attack["damage_type"] = "normal" if attack.get("damage_type") == "combat" else attack.get("damage_type", "normal")
                attack.setdefault("prevent", 0)
            state["rules_version"] = 2
        state.setdefault("roll_limit", 3)
        state.setdefault("defense_dice", [])
        state.setdefault("log", [])
        return state
