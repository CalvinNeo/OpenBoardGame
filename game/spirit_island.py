"""Cooperative Spirit Island introductory game with explicit, serializable choices.

All submitted actions are selected from the same public choices rendered by the
client. Resolution runs on a copy, making malformed or stale actions atomic.
"""
from __future__ import annotations

from collections import Counter, deque
from copy import deepcopy
import random
from typing import Dict, List, Optional, Tuple

from .spirit_island_data import BOARDS, FEAR_CARDS, POWERS, SPIRITS

ACTION_SCHEMA = {"type": "object", "required": ["type"], "properties": {
    "type": {"type": "string", "enum": ["choose_spirit", "growth", "play_card", "unplay_card", "reclaim_one", "ready", "use_power", "use_innate", "repeat_power", "pass", "choose", "next_round"]},
    "spirit_id": {"type": "string"}, "growth_id": {"type": "string"},
    "card_id": {"type": "string"}, "level": {"type": "integer"}, "offer": {"type": "integer"}, "value": {},
}, "additionalProperties": False}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": ["integer", "string"]}}, "additionalProperties": False}

TERRAINS = ("jungle", "mountain", "sand", "wetland")
PIECE_HEALTH = {"explorer": 1, "town": 2, "city": 3, "dahan": 2}
PIECE_LABELS = {"explorer": "🚶 探索者", "town": "🏘️ 村镇", "city": "🏙️ 城市", "dahan": "🛖 达汉"}
ELEMENTS = ("sun", "moon", "fire", "air", "water", "earth", "plant", "animal")


def _log(state: Dict, text: str) -> None:
    state["log"].append(text)
    state["log"] = state["log"][-160:]


def _name(state: Dict, pid: str) -> str:
    return state["players"][pid]["name"]


def _land(state: Dict, lid: str) -> Dict:
    return state["lands"][lid]


def _pieces(land: Dict, kinds=None) -> List[Dict]:
    kinds = kinds or ("explorer", "town", "city")
    return [piece for piece in land["pieces"] if piece["type"] in kinds]


def _add_piece(state: Dict, lid: str, kind: str, count: int = 1) -> None:
    for _ in range(count):
        state["piece_serial"] += 1
        _land(state, lid)["pieces"].append({"id": f"p{state['piece_serial']}", "type": kind,
                                             "health": PIECE_HEALTH[kind] + (_land(state, lid).get("dahan_health_bonus", 0) if kind == "dahan" else 0)})


def _elements(state: Dict, pid: str) -> Counter:
    counts = Counter(e for cid in state["players"][pid]["played"] for e in POWERS[cid]["elements"])
    counts.update(state["players"][pid].get("extra_elements", {}))
    return counts


def _threshold(elements: Dict, required: Dict) -> bool:
    return all(elements.get(key, 0) >= value for key, value in required.items())


def _sacred(state: Dict, pid: str, lid: str) -> bool:
    land = _land(state, lid)
    amount = land["presence"].get(pid, 0)
    return amount >= 2 or (amount >= 1 and state["players"][pid]["spirit_id"] == "river"
                            and land["terrain"] == "wetland")


def _distance(state: Dict, start: str, end: str) -> int:
    if start == end:
        return 0
    seen = {start}
    pending = deque([(start, 0)])
    while pending:
        here, distance = pending.popleft()
        for neighbour in _land(state, here)["adjacent"]:
            if neighbour == end:
                return distance + 1
            if neighbour not in seen:
                seen.add(neighbour)
                pending.append((neighbour, distance + 1))
    return 99


def _in_range(state: Dict, pid: str, lid: str, distance: int, sacred: bool = False) -> bool:
    return any(land["presence"].get(pid, 0) > 0 and (not sacred or _sacred(state, pid, source))
               and _distance(state, source, lid) <= distance
               for source, land in state["lands"].items())


def _terrain_matches(land: Dict, card: Dict) -> bool:
    return land["coastal"] if "coastal" in card["terrains"] else land["terrain"] in card["terrains"]


def _card_view(cid: str) -> Dict:
    card = deepcopy(POWERS[cid])
    card["id"] = cid
    card.setdefault("name_zh", card.get("name", cid))
    card.setdefault("text", card.get("description", ""))
    return card


def _option(action_type: str, label: str, kind: str = "choice", **fields) -> Dict:
    action = {"type": action_type, **deepcopy(fields)}
    option = {"action": action, "label": label, "kind": kind}
    for key in ("land_id", "card_id", "spirit_id", "player_id"):
        if key in fields:
            option[key] = fields[key]
    return option


def _choice(value, label: str, **meta) -> Dict:
    return {"value": value, "label": label, **meta}


def _ask(state: Dict, pid: str, kind: str, prompt: str, choices: List[Dict], **context) -> None:
    if not choices:
        return
    state["pending"] = {"player_id": pid, "kind": kind, "prompt": prompt,
                        "choices": choices, **context}


def _queue(state: Dict, effects: List[Dict], front: bool = True) -> None:
    if front:
        state["effects"] = effects + state["effects"]
    else:
        state["effects"].extend(effects)


def _finish(state: Dict, victory: bool, reason: str) -> None:
    state["game_over"] = True
    state["phase"] = "game_over"
    state["victory"] = victory
    state["end_reason"] = reason
    state["winner"] = "spirits" if victory else "invaders"
    state["pending"] = None
    state["effects"] = []
    _log(state, ("🏆 精灵胜利：" if victory else "💀 精灵败北：") + reason)


def _check_victory(state: Dict) -> None:
    if state["game_over"] or state["phase"] == "choose_spirit":
        return
    invaders = [p for land in state["lands"].values() for p in _pieces(land)]
    level = state["terror_level"]
    target_types = {1: {"explorer", "town", "city"}, 2: {"town", "city"}, 3: {"city"}}
    victory = level >= 4 or not any(piece["type"] in target_types[level] for piece in invaders)
    if state.get("action_depth", 0):
        state["pending_victory"] = state.get("pending_victory", False) or victory
        return
    if victory or state.get("pending_victory"):
        _finish(state, True, "达到当前恐惧等级的胜利条件。" + ("（精灵付出了牺牲）" if state.get("pending_loss") else ""))
    elif state.get("pending_loss"):
        _finish(state, False, state["pending_loss"])


def _fear(state: Dict, amount: int) -> None:
    if amount <= 0 or state["game_over"]:
        return
    state["fear_generated"] += amount
    _log(state, f"😨 产生 {amount} 恐惧。")
    while state["fear_generated"] >= state["fear_pool"] and state["fear_deck"]:
        state["fear_generated"] -= state["fear_pool"]
        earned_card = state["fear_deck"].pop(0)
        if state["phase"] == "fear":
            state.setdefault("fear_waiting", []).append(earned_card)
            position = next((index for index, effect in enumerate(state["effects"])
                             if effect.get("kind") == "phase" and effect.get("phase") == "ravage"), len(state["effects"]))
            state["effects"].insert(position, {"kind": "fear_card", "card_id": earned_card})
        else:
            state["earned_fear"].append(earned_card)
        earned = 9 - len(state["fear_deck"])
        state["terror_level"] = min(4, 1 + earned // 3)
        _log(state, "😨 获得一张恐惧牌。")
    _check_victory(state)


def _destroy(state: Dict, lid: str, piece_id: str, fear: bool = True, no_vengeance: bool = False) -> None:
    land = _land(state, lid)
    piece = next(piece for piece in land["pieces"] if piece["id"] == piece_id)
    if piece["type"] == "dahan" and land.get("dahan_immune") and fear:
        return
    land["pieces"].remove(piece)
    if fear and not no_vengeance:
        from .spirit_island_extra import extra_on_destroy
        triggers = extra_on_destroy(state, lid, piece)
        if state.get("action_triggers"):
            state["action_triggers"][-1].extend(triggers)
        else:
            _queue(state, triggers)
    if fear and piece["type"] in ("town", "city"):
        _fear(state, 1 if piece["type"] == "town" else 2)
    _check_victory(state)


def _defense(state: Dict, lid: str) -> int:
    land = _land(state, lid)
    earth = any(state["players"][pid]["spirit_id"] == "earth" and _sacred(state, pid, lid)
                for pid in state["players"] if state["players"][pid]["spirit_id"])
    dahan = len(_pieces(land, ["dahan"]))
    dynamic = sum((dahan if level == 1 else 1 + dahan if level == 2 else 2 * dahan) for level in land.get("dahan_guard", []) if dahan)
    dynamic += sum(player.get("ward_defend", 0) for owner, player in state["players"].items() if land["presence"].get(owner, 0))
    if any(land["presence"].values()):
        dynamic += sum(2 for rule in state.get("fear_rules", []) if rule["id"] == "belief_takes_root" and rule["level"] <= 2)
    return land["defend"] + (3 if earth else 0) + dynamic



def _skip_action(state: Dict, lid: str, action: str) -> bool:
    land = _land(state, lid)
    if action in land["skip"]:
        return True
    for rule in state.get("fear_rules", []):
        cid, level = rule["id"], rule["level"]
        dahan = len(_pieces(land, ["dahan"]))
        towns, cities = len(_pieces(land, ["town"])), len(_pieces(land, ["city"]))
        if cid == "avoid_the_dahan":
            if level == 1 and action == "explore" and dahan >= 2:
                return True
            if action == "build" and ((level == 2 and dahan > towns + cities) or (level == 3 and dahan)):
                return True
        if cid == "trade_suffers" and level == 1 and action == "build" and cities:
            return True
        if cid == "overseas_trade_seems_safer" and land["coastal"] and action == "build":
            if level == 3 or (level == 2 and towns > cities):
                return True
    return False

def _power_targets(state: Dict, pid: str, card: Dict, range_bonus: int = 0, energy_cost: int = 0) -> List[Dict]:
    if card["target"] in ("spirit", "other_spirit"):
        return [_choice(other, _name(state, other), player_id=other)
                for other in state["turn_order"] if card["target"] == "spirit" or other != pid
                or len(state["turn_order"]) == 1]
    targets = []
    for lid, land in state["lands"].items():
        restriction = card.get("target_filter") or {}
        if restriction.get("blight") and not land["blight"]:
            continue
        if restriction.get("no_invaders") and _pieces(land):
            continue
        if restriction.get("terrain") and land["terrain"] not in restriction["terrain"]:
            continue
        if restriction.get("coastal") and not land["coastal"]:
            continue
        if restriction.get("dahan") and not _pieces(land, ("dahan",)):
            continue
        if restriction.get("invaders") and not _pieces(land):
            continue
        if restriction.get("no_blight") and land["blight"]:
            continue
        distance = (card.get("range") or 0) + range_bonus
        if card.get("name_en") == "Sap the Strength of Multitudes" and _elements(state, pid).get("air", 0) >= 1:
            distance += 1
        if card.get("name_en") == "Talons of Lightning" and _threshold(_elements(state, pid), {"fire": 3, "air": 3}):
            distance += 2
        owners = list(dict.fromkeys([pid] + state["players"][pid].get("target_partners", [])))
        normal = any(sum(site["presence"].get(owner, 0) for owner in owners) >= (1 if not card.get("sacred_site") or (state["players"][pid]["spirit_id"] == "river" and site["terrain"] == "wetland") else 2)
                     and (not card.get("source_terrain") or site["terrain"] == card["source_terrain"])
                     and _distance(state, source, lid) <= distance
                     for source, site in state["lands"].items())
        source_exists = any(sum(site["presence"].get(owner, 0) for owner in owners) >= (2 if card.get("sacred_site") else 1)
                            and (not card.get("source_terrain") or site["terrain"] == card["source_terrain"])
                            for site in state["lands"].values())
        shadows = (state["players"][pid]["spirit_id"] == "shadows" and source_exists
                   and _pieces(land, ("dahan",)) and state["players"][pid]["energy"] - energy_cost >= 1)
        if normal:
            targets.append(_choice({"land_id": lid, "shadows": False}, lid, land_id=lid))
        elif shadows:
            targets.append(_choice({"land_id": lid, "shadows": True}, f"{lid}（影随达汉：支付 1 能量）", land_id=lid))
    return targets


def _invader_card(stage: int, terrains: List[str]) -> Dict:
    names = {"jungle": "丛林", "mountain": "山地", "sand": "沙地", "wetland": "湿地", "coastal": "沿海"}
    return {"stage": stage, "terrains": terrains, "name": " / ".join(names[t] for t in terrains)}


def _explore(state: Dict, card: Dict) -> None:
    # Sources are evaluated before placing explorers; newly placed explorers
    # never become exploration sources.
    sources = {lid for lid, land in state["lands"].items() if land["coastal"] or _pieces(land, ("town", "city"))}
    eligible = [lid for lid, land in state["lands"].items()
                if _terrain_matches(land, card) and not _skip_action(state, lid, "explore")
                and (lid in sources or any(neighbour in sources and _pieces(_land(state, neighbour), ("town", "city"))
                                           for neighbour in land["adjacent"]))]
    for lid in eligible:
        _add_piece(state, lid, "explorer")


def _growth_complete(state: Dict, pid: str) -> None:
    state["players"][pid]["growth_done"] = True
    if all(p["growth_done"] for p in state["players"].values()):
        for player in state["players"].values():
            spirit = SPIRITS[player["spirit_id"]]
            player["energy"] += spirit["energy_track"][player["energy_track"]]
        state["phase"] = "play"
        state["phase_done"] = []
        _log(state, "⚡ 所有精灵获得能量；选择并支付本轮力量牌。")


def _enter_phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["phase_done"] = []
    if phase == "fear":
        state["revealed_fear"] = []
        state["fear_waiting"] = list(state["earned_fear"])
        state["earned_fear"] = []
        effects = [{"kind": "fear_card", "card_id": cid} for cid in state["fear_waiting"]]
        _queue(state, effects + [{"kind": "phase", "phase": "ravage"}])
    elif phase == "ravage":
        card = state["invaders"]["ravage"]
        lids = [lid for lid, land in state["lands"].items() if card and _terrain_matches(land, card)]
        _queue(state, [{"kind": "ravage_batch", "remaining": lids}, {"kind": "phase", "phase": "build"}])
    elif phase == "build":
        card = state["invaders"]["build"]
        for lid, land in state["lands"].items():
            if card and _terrain_matches(land, card) and _pieces(land) and not _skip_action(state, lid, "build"):
                kind = "city" if len(_pieces(land, ("town",))) > len(_pieces(land, ("city",))) else "town"
                _add_piece(state, lid, kind)
        _log(state, "🏗️ 建造结算完成。")
        _queue(state, [{"kind": "phase", "phase": "explore"}])
    elif phase == "explore":
        if not state["invader_deck"]:
            _finish(state, False, "入侵者牌堆耗尽，无法探索。")
            return
        card = state["invader_deck"].pop(0)
        state["invaders"]["explore"] = card
        _explore(state, card)
        _log(state, f"🚶 探索：{card['name']}。")
        # Invader cards advance before Slow Powers.
        state["invader_discard"].append(state["invaders"]["ravage"])
        state["invaders"]["ravage"] = state["invaders"]["build"]
        state["invaders"]["build"] = card
        _queue(state, [{"kind": "phase", "phase": "slow"}])
    elif phase == "round_end":
        from .spirit_island_extra import extra_time_passes
        _queue(state, extra_time_passes(state))
        for player in state["players"].values():
            player["discard"].extend(player["played"])
            player["played"] = []
            player["ward_defend"] = 0
        state["fear_rules"] = []
        for land in state["lands"].values():
            for piece in land["pieces"]:
                piece["health"] = PIECE_HEALTH[piece["type"]]
            land["defend"] = 0
            land["skip"] = []
            land["damage_reduction"] = 0
            land["dahan_protected"] = False
            land["dahan_immune"] = False
            land["dahan_health_bonus"] = 0
            land["prevent_blight"] = False
            land["vengeance"] = []
            land["dahan_guard"] = []
        state["ready_players"] = []
        _log(state, "🌙 时间流逝：伤害与临时效果清除。所有人点击 Next Round 后继续。")
    elif phase in ("fast", "slow"):
        _log(state, "⚡ 快速力量阶段。" if phase == "fast" else "🐢 慢速力量阶段。")


def _new_round(state: Dict) -> None:
    state["round"] += 1
    state["phase"] = "growth"
    state["phase_done"] = []
    state["ready_players"] = []
    state["revealed_fear"] = []
    for player in state["players"].values():
        player.update(growth_done=False, ready=False, used=[], innate_used=False,
                      fast_used=0, fast_granted=0, reclaim_one_used=False, repeat_offers=[], range_bonus=0,
                      card_speeds={}, extra_elements={}, target_partners=[])
    _log(state, f"🌱 第 {state['round']} 轮成长。")


def _run(state: Dict) -> None:
    """Drain deterministic effects until a player has a genuine choice."""
    for _ in range(1000):
        if state["game_over"] or state["pending"] or not state["effects"]:
            if not state["pending"] and not state["effects"]:
                _check_victory(state)
            return
        effect = state["effects"].pop(0)
        kind = effect["kind"]
        pid = effect.get("player_id", state["turn_order"][0])
        lid = effect.get("land_id")
        land = state["lands"].get(lid)
        amount = effect.get("amount", 1)
        if kind == "phase":
            _enter_phase(state, effect["phase"])
        elif kind == "growth_complete":
            _growth_complete(state, pid)
        elif kind == "presence":
            player = state["players"][pid]
            spirit = SPIRITS[player["spirit_id"]]
            choices = [_choice(track, "⚡ 能量轨" if track == "energy_track" else "🃏 出牌轨")
                       for track in ("energy_track", "plays_track")
                       if player[track] < len(spirit[track]) - 1]
            if any(land["presence"].get(pid, 0) for land in state["lands"].values()):
                # Adding Presence may instead move an existing Presence.
                choices.append(_choice("move", "移动岛上已有灵迹"))
            choices.append(_choice("skip", "不放置灵迹"))
            _ask(state, pid, "presence_track", "选择放置灵迹的来源", choices, effect=effect)
        elif kind == "gain_power":
            player = state["players"][pid]
            progression = SPIRITS[player["spirit_id"]]["progression"]
            if player["progression_index"] < len(progression):
                cid = progression[player["progression_index"]]
                player["progression_index"] += 1
                player["hand"].append(cid)
                _log(state, f"{_name(state, pid)} 获得 {POWERS[cid]['name']}。")
                if POWERS[cid].get("type", POWERS[cid].get("card_type", "")).lower() == "major":
                    _queue(state, [{"kind": "forget", "player_id": pid}])
            else:
                choices = [_choice(t, "🌿 次级力量" if t == "minor" else "🔥 高级力量（遗忘一张）")
                           for t in ("minor", "major") if state[t + "_deck"] or state[t + "_discard"]]
                _ask(state, pid, "gain_type", "选择获得的力量类型（抽 4 张保留 1 张）", choices)
        elif kind == "forget":
            player = state["players"][pid]
            choices = [_choice(cid, POWERS[cid]["name"], card_id=cid)
                       for cid in player["hand"] + player["discard"] + player["played"]]
            _ask(state, pid, "forget", "获得高级力量：遗忘一张力量牌（可以遗忘刚获得的牌）", choices)
        elif kind == "power":
            state["action_depth"] = state.get("action_depth", 0) + 1
            state.setdefault("action_triggers", []).append([])
            state["_resolving_repeat"] = effect.get("is_repeat", False)
            resolved = _power_effects(state, pid, effect["card_id"], effect["target"], effect.get("innate", False))
            state["_resolving_repeat"] = False
            # A Repeat is a separate action, after this power and its triggers.
            repeats = [item for item in resolved if item["kind"] == "extra_repeat"]
            resolved = [item for item in resolved if item["kind"] != "extra_repeat"]
            _queue(state, resolved + [{"kind": "action_end"}] + repeats)
        elif kind == "action_end":
            stack = state.setdefault("action_triggers", [])
            if stack and stack[-1]:
                triggers = stack[-1]
                stack[-1] = []
                _queue(state, triggers + [{"kind": "action_end"}])
                continue
            if stack:
                stack.pop()
            state["action_depth"] = max(0, state.get("action_depth", 0) - 1)
            _check_victory(state)
        elif kind == "fear":
            _fear(state, amount)
        elif kind == "energy":
            state["players"][pid]["energy"] += amount
        elif kind == "defend":
            land["defend"] += amount
        elif kind == "skip":
            land["skip"].extend(effect.get("actions", ["ravage", "build", "explore"]))
        elif kind == "remove_blight":
            take = min(amount, land["blight"])
            land["blight"] -= take
            state["blight_remaining"] += take
        elif kind == "blight":
            if land.get("prevent_blight"):
                continue
            if state["blight_remaining"] <= 0:
                state["pending_loss"] = "荒芜储备耗尽。"
                continue
            cascade = land["blight"] > 0
            land["blight"] += 1
            state["blight_remaining"] -= 1
            _log(state, f"{lid} 增加 🟣 荒芜。")
            for owner in list(land["presence"]):
                if land["presence"][owner]:
                    land["presence"][owner] -= 1
                    state["players"][owner]["destroyed_presence"] += 1
            if state["blight_remaining"] == 0:
                state["pending_loss"] = "荒芜储备耗尽。"
            lost = [owner for owner in state["turn_order"]
                    if not any(site["presence"].get(owner, 0) for site in state["lands"].values())]
            if lost:
                state["pending_loss"] = f"{_name(state, lost[0])} 的灵迹全部被摧毁。"
            if cascade and state["blight_remaining"] > 0:
                choices = [_choice(other, other, land_id=other) for other in land["adjacent"]]
                _ask(state, pid, "cascade", "荒芜连锁：选择一块相邻土地增加荒芜", choices)
        elif kind == "damage_all":
            for piece in list(_pieces(land, effect.get("types"))):
                piece["health"] -= amount
                if piece["health"] <= 0:
                    _destroy(state, lid, piece["id"], no_vengeance=effect.get("no_vengeance", False))
        elif kind in ("damage", "destroy", "remove", "replace", "remove_health", "damage_dahan"):
            kinds = effect.get("types", ("dahan",) if kind == "damage_dahan" else ("explorer", "town", "city"))
            candidates = _pieces(land, kinds)
            if land.get("dahan_immune") and kind in ("destroy", "damage", "damage_dahan"):
                candidates = [piece for piece in candidates if piece["type"] != "dahan"]
            if amount <= 0 or not candidates:
                continue
            if kind == "remove_health":
                candidates = [piece for piece in candidates if PIECE_HEALTH[piece["type"]] <= amount]
            if kind == "damage_dahan":
                killable = [piece for piece in candidates if piece["health"] <= amount]
                if killable:
                    candidates = killable
            if not candidates:
                continue
            choices = [_choice(piece["id"], f"{PIECE_LABELS[piece['type']]}（生命 {piece['health']}）") for piece in candidates]
            if effect.get("optional", False):
                choices.append(_choice("skip", "完成 / 不再选择"))
            verb = {"damage": "分配 1 伤害", "destroy": "摧毁", "remove": "移除（不产生恐惧）",
                    "replace": "替换", "remove_health": "移除（按总生命）", "damage_dahan": "分配达汉伤害"}[kind]
            _ask(state, pid, "piece", f"{lid}：{verb}，剩余 {amount}", choices, effect=effect)
        elif kind in ("push", "gather"):
            if amount <= 0:
                continue
            choices = []
            moved = effect.get("moved", [])
            if kind == "push":
                for piece in _pieces(land, effect.get("types")):
                    if piece["id"] in moved:
                        continue
                    for destination in land["adjacent"]:
                        if effect.get("seek_safety") and len(_pieces(_land(state, destination), ("town", "city"))) <= len(_pieces(land, ("town", "city"))):
                            continue
                        choices.append(_choice({"piece_id": piece["id"], "from": lid, "to": destination},
                                               f"{PIECE_LABELS[piece['type']]} → {destination}", land_id=destination))
            else:
                for source in land["adjacent"]:
                    for piece in _pieces(_land(state, source), effect.get("types")):
                        if piece["id"] not in moved:
                            choices.append(_choice({"piece_id": piece["id"], "from": source, "to": lid},
                                                   f"{source} 的 {PIECE_LABELS[piece['type']]} → {lid}", land_id=source))
            if choices:
                if effect.get("optional", True):
                    choices.append(_choice("skip", "完成移动"))
                _ask(state, pid, "move", ("推出" if kind == "push" else "聚集") + f"：还可移动 {amount} 个", choices, effect=effect)
            elif effect.get("after"):
                _queue(state, [{**effect["after"], "destinations": effect.get("destinations", [])}])
        elif kind == "branch":
            choices = [_choice(index, branch["label"]) for index, branch in enumerate(effect["branches"])]
            _ask(state, pid, "branch", effect.get("prompt", "选择力量效果"), choices, effect=effect)
        elif kind == "card_step":
            _queue(state, _card_step(state, effect))
        elif kind == "add_dahan":
            _add_piece(state, lid, "dahan", amount)
        elif kind == "ravage_batch":
            remaining = [site for site in effect["remaining"] if _pieces(_land(state, site)) and not _skip_action(state, site, "ravage")]
            if len(remaining) == 1:
                _queue(state, [{"kind": "ravage", "land_id": remaining[0]}])
            elif remaining:
                _ask(state, pid, "ravage_order", "选择下一块劫掠的土地（结算顺序可能影响荒芜连锁）",
                     [_choice(site, site, land_id=site) for site in remaining], remaining=remaining)
        elif kind == "ravage":
            if _skip_action(state, lid, "ravage") or not _pieces(land):
                continue
            damage = max(0, sum(max(0, PIECE_HEALTH[p["type"]] - land["damage_reduction"])
                                for p in _pieces(land)) - _defense(state, lid))
            owner = next((owner for owner in state["turn_order"] if land["presence"].get(owner)), state["turn_order"][0])
            effects = []
            if damage >= 2:
                effects.append({"kind": "blight", "land_id": lid, "player_id": owner})
            if damage > 0 and not land.get("dahan_protected"):
                effects.append({"kind": "damage_dahan", "land_id": lid, "player_id": owner, "amount": damage})
            effects.append({"kind": "card_step", "step": "counterattack", "land_id": lid, "player_id": owner})
            state["action_depth"] = state.get("action_depth", 0) + 1
            state.setdefault("action_triggers", []).append([])
            effects.append({"kind": "action_end"})
            _queue(state, effects)
            _log(state, f"⚔️ {lid} 劫掠：{damage} 点伤害（防御 {_defense(state, lid)}）。")
        elif kind == "fear_card":
            if effect["card_id"] in state.get("fear_waiting", []):
                state["fear_waiting"].remove(effect["card_id"])
            state["revealed_fear"].append(effect["card_id"])
            state["action_depth"] = state.get("action_depth", 0) + 1
            state.setdefault("action_triggers", []).append([])
            _queue(state, _fear_effects(state, effect["card_id"]) + [{"kind": "action_end"}])
        elif kind == "fear_choice":
            _fear_choice(state, effect)
        else:
            from .spirit_island_extra import extra_effect
            if not extra_effect(state, effect):
                raise ValueError(f"unimplemented effect: {kind}")
    raise RuntimeError("effect resolution exceeded safety limit")


def _resolve_choice(state: Dict, pid: str, value) -> None:
    pending = state["pending"]
    state["pending"] = None
    kind = pending["kind"]
    effect = pending.get("effect", {})
    player = state["players"][pid]
    if kind == "presence_track":
        if value == "skip":
            return
        if value == "move":
            choices = [_choice(lid, lid, land_id=lid) for lid, land in state["lands"].items() if land["presence"].get(pid, 0)]
            _ask(state, pid, "presence_source", "选择移动灵迹的起点", choices, effect=effect)
        else:
            choices = [_choice(lid, lid, land_id=lid) for lid in state["lands"] if _in_range(state, pid, lid, effect["range"])]
            _ask(state, pid, "presence_land", "选择放置灵迹的土地", choices, track=value)
    elif kind == "presence_source":
        choices = [_choice(lid, lid, land_id=lid) for lid in state["lands"] if _in_range(state, pid, lid, effect["range"])]
        _ask(state, pid, "presence_land", "选择灵迹移动终点", choices, track="move", source=value)
    elif kind == "presence_land":
        if pending["track"] == "move":
            _land(state, pending["source"])["presence"][pid] -= 1
        else:
            player[pending["track"]] += 1
        _land(state, value)["presence"][pid] = _land(state, value)["presence"].get(pid, 0) + 1
    elif kind == "ravage_order":
        _queue(state, [{"kind": "ravage", "land_id": value},
                       {"kind": "ravage_batch", "remaining": [lid for lid in pending["remaining"] if lid != value]}])
    elif kind == "cascade":
        _queue(state, [{"kind": "blight", "player_id": pid, "land_id": value}])
    elif kind == "forget":
        for zone in ("hand", "discard", "played"):
            if value in player[zone]:
                player[zone].remove(value)
                break
        power_type = POWERS[value].get("type", POWERS[value].get("card_type", "unique")).lower()
        if power_type in ("minor", "major"):
            state[power_type + "_discard"].append(value)
        _log(state, f"{_name(state, pid)} 遗忘 {POWERS[value]['name']}。")
    elif kind == "gain_type":
        deck, discard = state[value + "_deck"], state[value + "_discard"]
        if len(deck) < 4 and discard:
            rng = random.Random()
            rng.setstate(_tuple_state(state["rng_state"]))
            rng.shuffle(discard)
            deck.extend(discard)
            discard.clear()
            state["rng_state"] = rng.getstate()
        drawn = deck[:4]
        del deck[:4]
        _ask(state, pid, "gain_card", "保留一张力量牌", [_choice(cid, POWERS[cid]["name"], card_id=cid) for cid in drawn],
             cards=drawn, power_type=value)
    elif kind == "gain_card":
        player["hand"].append(value)
        state[pending["power_type"] + "_discard"].extend(cid for cid in pending["cards"] if cid != value)
        if pending["power_type"] == "major":
            _queue(state, [{"kind": "forget", "player_id": pid}])
    elif kind == "target":
        if isinstance(value, dict) and value.get("shadows"):
            player["energy"] -= 1
        target = value["land_id"] if isinstance(value, dict) else value
        _queue(state, [{"kind": "power", "player_id": pid, "card_id": pending["card_id"],
                        "target": target, "innate": pending.get("innate", False), "is_repeat": pending.get("is_repeat", False)}])
    elif kind == "piece":
        if value == "skip":
            return
        land = _land(state, effect["land_id"])
        piece = next(piece for piece in land["pieces"] if piece["id"] == value)
        continuation = deepcopy(effect)
        if effect["kind"] in ("damage", "damage_dahan"):
            amount = 1 if effect["kind"] == "damage" else min(effect["amount"], piece["health"])
            piece["health"] -= amount
            continuation["amount"] -= amount
            if piece["health"] <= 0:
                _destroy(state, effect["land_id"], value, no_vengeance=effect.get("no_vengeance", False))
                if effect.get("extra_fear"):
                    _fear(state, effect["extra_fear"])
        elif effect["kind"] == "replace":
            _destroy(state, effect["land_id"], value, fear=False)
            replacement = effect.get("replacement") or {"city": "town", "town": "explorer"}[piece["type"]]
            _add_piece(state, effect["land_id"], replacement)
            continuation["amount"] -= 1
        else:
            continuation["amount"] -= PIECE_HEALTH[piece["type"]] if effect["kind"] == "remove_health" else 1
            _destroy(state, effect["land_id"], value, fear=effect["kind"] == "destroy")
            if effect.get("extra_fear"):
                _fear(state, effect["extra_fear"])
        _queue(state, [continuation])
    elif kind == "move":
        if value == "skip":
            if effect.get("after"):
                _queue(state, [{**effect["after"], "destinations": effect.get("destinations", [])}])
            return
        source, target = _land(state, value["from"]), _land(state, value["to"])
        piece = next(piece for piece in source["pieces"] if piece["id"] == value["piece_id"])
        from .spirit_island_extra import extra_on_move
        extra_on_move(state, piece, value["from"], value["to"])
        source["pieces"].remove(piece)
        target["pieces"].append(piece)
        if piece["health"] <= 0:
            _destroy(state, value["to"], piece["id"])
        continuation = deepcopy(effect)
        continuation["amount"] -= 1
        continuation.setdefault("moved", []).append(piece["id"])
        continuation.setdefault("destinations", []).append(value["to"])
        if effect.get("harbingers") and not effect.get("harbingers_triggered") and _pieces(target, ("town", "city")):
            _fear(state, 1)
            continuation["harbingers_triggered"] = True
        if continuation["amount"] <= 0 and effect.get("after"):
            _queue(state, [{**effect["after"], "destinations": continuation["destinations"]}])
        else:
            _queue(state, [continuation])
    elif kind == "branch":
        _queue(state, effect["branches"][value]["effects"])
    elif kind == "fear_land":
        if value == "skip":
            return
        _resolve_fear_land(state, effect, value)
    else:
        from .spirit_island_extra import extra_choice
        if not extra_choice(state, pending, value):
            raise ValueError(f"unimplemented choice: {kind}")


def _tuple_state(value):
    return tuple(_tuple_state(item) for item in value) if isinstance(value, (tuple, list)) else value


def _power_effects(state: Dict, pid: str, cid: str, target: str, innate: bool = False) -> List[Dict]:
    """Translate a resolved power into small effects with explicit choices."""
    land = state["lands"].get(target)
    elements = _elements(state, pid)
    def fx(kind, amount=1, **kwargs):
        return {"kind": kind, "player_id": pid, "land_id": target, "amount": amount, **kwargs}
    def branch(*options):
        return fx("branch", branches=[{"label": label, "effects": effects} for label, effects in options])
    def move(kind, amount, types, **kwargs):
        return fx(kind, amount, types=types, **kwargs)
    dahan = len(_pieces(land, ("dahan",))) if land else 0
    if innate:
        spirit_id, tier_text = cid.split(":")
        tier = int(tier_text)
        if spirit_id == "lightning":
            return [fx("destroy", 1 + max(0, tier - 2), types=["town"] if tier == 1 else ["town", "city"])]
        if spirit_id == "river":
            if tier == 1:
                return [move("push", 1, ["explorer", "town"], optional=False)]
            if tier == 2:
                return [fx("damage", 2), move("push", 3, ["explorer", "town"])]
            return [fx("damage_all", 2)]
        if spirit_id == "earth":
            state["players"][target]["repeat_offers"].append({"source": "gift_of_strength", "remaining": 1,
                                                            "limit": (1, 3, 6)[tier - 1], "paid": False, "used": []})
            return []
        if spirit_id == "shadows":
            effects = [move("gather", 1, ["explorer"], optional=False)]
            if tier >= 2:
                effects.append(fx("destroy", 2, types=["explorer"], optional=True, extra_fear=1))
            if tier >= 3:
                effects.append(fx("damage", 3, extra_fear=1))
            return effects
        raise ValueError(f"unimplemented innate: {cid}")
    card = POWERS[cid]
    threshold = bool(card.get("threshold")) and _threshold(elements, card["threshold"])
    if cid == "raging_storm":
        return [fx("damage_all", 1)]
    if cid == "shatter_homesteads":
        return [fx("fear", 1), fx("destroy", 1, types=["town"])]
    if cid == "lightnings_boon":
        state["players"][target]["fast_granted"] += 2
        return []
    if cid == "harbingers_of_the_lightning":
        return [move("push", 2, ["dahan"], harbingers=True)]
    if cid == "boon_of_vigor":
        return [fx("energy", 1 if target == pid else len(state["players"][target]["played"]), player_id=target)]
    if cid == "rivers_bounty":
        return [move("gather", 2, ["dahan"]), fx("card_step", step="rivers_bounty")]
    if cid == "wash_away":
        return [move("push", 3, ["explorer", "town"])]
    if cid == "flash_floods":
        return [fx("damage", 1 + int(land["coastal"]))]
    if cid == "a_year_of_perfect_stillness":
        return [fx("skip")]
    if cid == "draw_of_the_fruitful_earth":
        return [move("gather", 2, ["explorer"]), move("gather", 2, ["dahan"])]
    if cid == "guard_the_healing_land":
        return [fx("remove_blight"), fx("defend", 4)]
    if cid == "rituals_of_destruction":
        return [fx("damage", 2 + (3 if dahan >= 3 else 0))] + ([fx("fear", 2)] if dahan >= 3 else [])
    if cid == "concealing_shadows":
        land["dahan_protected"] = True
        return [fx("fear")]
    if cid == "crops_wither_and_fade":
        return [fx("fear", 2), fx("replace", types=["town", "city"])]
    if cid == "favors_called_due":
        return [move("gather", 4, ["dahan"]), fx("card_step", step="favors_called_due")]
    if cid == "mantle_of_dread":
        return [fx("fear", 2), fx("fear_choice", player_id=target, mode="mantle", level=1)]
    if cid == "delusions_of_danger":
        return [branch(("推离 1 探索者", [move("push", 1, ["explorer"], optional=False)]), ("产生 2 恐惧", [fx("fear", 2)]))]
    if cid == "call_to_bloodshed":
        return [branch(("按达汉数量造成伤害", [fx("damage", dahan)]), ("聚集至多 3 达汉", [move("gather", 3, ["dahan"])]))]
    if cid == "powerstorm":
        if state.get("_resolving_repeat"):
            return [fx("energy", 3, player_id=target)]
        state["players"][target]["repeat_offers"].append({"source": "powerstorm", "remaining": 3 if threshold else 1,
                                                        "limit": 99, "paid": True, "used": []})
        return [fx("energy", 3, player_id=target)]
    if cid == "purifying_flame":
        damage = [fx("damage", land["blight"])]
        if land["terrain"] in ("mountain", "sand"):
            return [branch(("按荒芜数量造成伤害", damage), ("移除 1 荒芜", [fx("remove_blight")]))]
        return damage
    if cid == "pillar_of_living_flame":
        effects = [fx("fear", 3), fx("damage", 5)]
        if land["terrain"] in ("jungle", "wetland"):
            effects.append(fx("blight"))
        if threshold:
            effects.extend([fx("fear", 2), fx("damage", 5)])
        return effects
    if cid == "entrancing_apparitions":
        return [fx("defend", 2)] + ([move("gather", 2, ["explorer"])] if not _pieces(land) else [])
    if cid == "call_to_isolation":
        return [branch(("按达汉数量推离探索者 / 村镇", [move("push", dahan, ["explorer", "town"], optional=False)]),
                       ("推离 1 达汉", [move("push", 1, ["dahan"], optional=False)]))]
    if cid == "uncanny_melting":
        return ([fx("fear")] if _pieces(land) else []) + ([fx("remove_blight")] if land["terrain"] in ("sand", "wetland") else [])
    if cid == "natures_resilience":
        return [branch(("防御 6", [fx("defend", 6)]), ("移除 1 荒芜", [fx("remove_blight")]))] if threshold else [fx("defend", 6)]
    if cid == "pull_beneath_the_hungry_earth":
        return ([fx("fear")] if land["presence"].get(pid) else []) + [fx("damage", int(bool(land["presence"].get(pid))) + int(land["terrain"] in ("sand", "wetland")))]
    if cid == "accelerated_rot":
        return [fx("fear", 2), fx("damage", 4)] + ([fx("damage", 5), fx("remove_blight")] if threshold else [])
    if cid == "song_of_sanctity":
        return [move("push", len(_pieces(land, ["explorer"])), ["explorer"], optional=False)] if _pieces(land, ["explorer"]) else [fx("remove_blight")]
    if cid == "tsunami":
        effects = [fx("fear", 2), fx("damage", 8), fx("destroy", 2, types=["dahan"])]
        if threshold:
            for other, site in state["lands"].items():
                if site["board"] == land["board"] and site["coastal"] and other != target:
                    effects.extend([fx("fear", 1, land_id=other), fx("damage", 4, land_id=other), fx("destroy", 1, types=["dahan"], land_id=other)])
        return effects
    if cid == "encompassing_ward":
        state["players"][target]["ward_defend"] = state["players"][target].get("ward_defend", 0) + 2
        return []
    if cid == "rouse_the_trees_and_stones":
        return [fx("damage", 2), move("push", 1, ["explorer"], optional=False)]
    if cid == "call_to_migrate":
        return [move("gather", 3, ["dahan"]), move("push", 3, ["dahan"])]
    if cid == "poisoned_land":
        return [fx("fear"), fx("damage", 7), fx("blight"), fx("destroy", dahan, types=["dahan"])] + ([fx("card_step", step="poisoned_land")] if threshold else [])
    if cid == "devouring_ants":
        return [fx("fear"), fx("damage", 1 + int(land["terrain"] in ("jungle", "sand"))), fx("destroy", types=["dahan"])]
    if cid == "vigor_of_the_breaking_dawn":
        return [fx("damage", 2 * dahan)] + ([move("push", 2, ["dahan"], after=fx("card_step", step="vigor"))] if threshold else [])
    if cid == "voracious_growth":
        return [branch(("造成 2 伤害", [fx("damage", 2)]), ("移除 1 荒芜", [fx("remove_blight")]))]
    if cid == "savage_mawbeasts":
        return ([fx("fear"), fx("damage")] if land["terrain"] in ("jungle", "wetland") else []) + ([fx("damage")] if threshold else [])
    if cid == "dark_and_tangled_woods":
        return [fx("fear", 2)] + ([fx("defend", 3)] if land["terrain"] in ("mountain", "jungle") else [])
    if cid == "shadows_of_the_burning_forest":
        return [fx("fear", 2)] + ([move("push", 1, ["explorer"], optional=False), move("push", 1, ["town"], optional=False)] if land["terrain"] in ("mountain", "jungle") else [])
    if cid == "the_jungle_hungers":
        return [fx("destroy", len(_pieces(land, ["explorer", "town"])), types=["explorer", "town"])] + ([fx("destroy", types=["city"])] if threshold else [fx("destroy", dahan, types=["dahan"])])
    if cid == "land_of_haunts_and_embers":
        times = 2 if land["blight"] else 1
        return [fx("fear", 2 * times), move("push", 2 * times, ["explorer", "town"]), fx("blight")]
    if cid == "terrifying_nightmares":
        return [fx("fear", 2), move("push", 4, ["explorer", "town"])] + ([fx("fear", 4)] if threshold else [])
    if cid == "call_of_the_dahan_ways":
        return [fx("replace", types=["explorer", "town"] if threshold else ["explorer"], replacement="dahan")]
    if cid == "visions_of_fiery_doom":
        return [fx("fear", 1 + int(threshold)), move("push", 1, ["explorer", "town"], optional=False)]
    # Additional base-game powers are maintained separately so their individual
    # effects can be reviewed against the official card data.
    from .spirit_island_extra import extra_power_effects
    return extra_power_effects(state, pid, cid, target, fx, branch, move, threshold)


def _card_step(state: Dict, effect: Dict) -> List[Dict]:
    lid = effect.get("land_id")
    land = state["lands"].get(lid)
    pid = effect["player_id"]
    def fx(kind, amount=1, **kwargs):
        return {"kind": kind, "player_id": pid, "land_id": lid, "amount": amount, **kwargs}
    step = effect["step"]
    if step == "counterattack":
        return [fx("damage", 2 * len(_pieces(land, ["dahan"])))]
    if step == "rivers_bounty":
        return [fx("add_dahan"), fx("energy")] if len(_pieces(land, ["dahan"])) >= 2 else []
    if step == "favors_called_due":
        return [fx("fear", 3)] if _pieces(land) and len(_pieces(land, ["dahan"])) > len(_pieces(land)) else []
    if step == "poisoned_land":
        return [fx("fear", land["blight"]), fx("damage", 4 * land["blight"])]
    if step == "vigor":
        return [fx("damage", 2 * len(_pieces(_land(state, other), ["dahan"])), land_id=other)
                for other in sorted(set(effect.get("destinations", [])))]
    if step == "fear_dahan_damage":
        amount = len(_pieces(land, ["dahan"])) if effect["level"] == 3 else int(bool(_pieces(land, ["dahan"])))
        return [fx("damage", amount)]
    from .spirit_island_extra import extra_card_step
    return extra_card_step(state, effect, fx)


def _fear_effects(state: Dict, cid: str) -> List[Dict]:
    level = min(3, state["terror_level"])
    state["fear_used_lands"] = []
    _log(state, f"😨 {FEAR_CARDS[cid]['name']}（恐惧等级 {level}）")
    effects = []
    def fx(kind, lid, amount=1, **kwargs):
        return {"kind": kind, "player_id": state["turn_order"][0], "land_id": lid, "amount": amount, **kwargs}
    if cid == "avoid_the_dahan":
        state.setdefault("fear_rules", []).append({"id": cid, "level": level})
    elif cid == "belief_takes_root" and level <= 2:
        state.setdefault("fear_rules", []).append({"id": cid, "level": level})
        for lid, land in state["lands"].items():
            if level == 2 and _pieces(land):
                for pid in state["turn_order"]:
                    if _sacred(state, pid, lid):
                        effects.append(fx("energy", lid, player_id=pid))
    elif cid == "dahan_on_their_guard":
        for lid, land in state["lands"].items():
            land.setdefault("dahan_guard", []).append(level)
    elif cid == "overseas_trade_seems_safer":
        state.setdefault("fear_rules", []).append({"id": cid, "level": level})
        for lid, land in state["lands"].items():
            if land["coastal"]:
                effects.append(fx("defend", lid, 3 * level))

    elif cid == "scapegoats":
        for lid, land in state["lands"].items():
            towns, cities = len(_pieces(land, ["town"])), len(_pieces(land, ["city"]))
            count = towns if level == 1 else towns + 2 * cities if level == 2 else len(_pieces(land, ["explorer"])) if towns + cities else 0
            effects.append(fx("destroy", lid, count, types=["explorer"]))
            if level == 3:
                effects.append(fx("destroy", lid, cities, types=["town"]))
    elif cid == "tall_tales_of_savagery" and level == 3:
        for lid, land in state["lands"].items():
            if _pieces(land, ["dahan"]):
                effects.append({"kind": "fear_choice", "player_id": state["turn_order"][0],
                                "mode": cid, "level": level, "fixed_land": lid})
    elif cid == "trade_suffers" and level == 1:
        state.setdefault("fear_rules", []).append({"id": cid, "level": level})
    else:
        for pid in state["turn_order"]:
            effects.append({"kind": "fear_choice", "player_id": pid, "mode": cid, "level": level})
    return effects


def _fear_choice(state: Dict, effect: Dict) -> None:
    pid, mode, level = effect["player_id"], effect["mode"], effect["level"]
    if effect.get("fixed_land"):
        _resolve_fear_land(state, effect, effect["fixed_land"])
        return
    choices = []
    for lid, land in state["lands"].items():
        invaders = _pieces(land)
        dahan = _pieces(land, ["dahan"])
        buildings = _pieces(land, ["town", "city"])
        small = _pieces(land, ["explorer", "town"])
        explorer = _pieces(land, ["explorer"])
        presence = any(land["presence"].values())
        sacred = any(_sacred(state, owner, lid) for owner in state["turn_order"])
        unique = mode in ("belief_takes_root", "dahan_raid") or (mode == "dahan_enheartened" and level >= 2)
        if unique and lid in state["fear_used_lands"]:
            continue
        valid = False
        if mode == "belief_takes_root":
            valid = bool(presence and invaders)
        elif mode == "dahan_enheartened":
            valid = bool(invaders) if level == 1 else True
        elif mode == "dahan_raid":
            valid = bool(dahan)
        elif mode == "emigration_accelerates":
            valid = bool((land["coastal"] or level == 3) and (explorer if level == 1 else small))
        elif mode == "wary_of_the_interior":
            valid = bool((not land["coastal"] or level == 3) and (explorer if level == 1 else small))
        elif mode == "fear_of_the_unseen":
            valid = bool((sacred if level == 1 else presence) and small) or bool(level == 3 and sacred and _pieces(land, ["city"]))
        elif mode == "isolation":
            valid = len(invaders) <= (1 if level == 1 else 2) and bool(invaders if level == 3 else small)
        elif mode == "retreat":
            valid = (not land["coastal"] or level == 3) and bool(explorer if level == 1 else small)
        elif mode == "seek_safety":
            if level == 1:
                valid = bool(explorer) and any(len(_pieces(_land(state, other), ["town", "city"])) > len(buildings) for other in land["adjacent"])
            elif level == 2:
                valid = bool(buildings)
            else:
                valid = not _pieces(land, ["city"]) and bool(invaders)
        elif mode == "tall_tales_of_savagery":
            valid = bool(dahan and (explorer if level == 1 else small))
        elif mode == "trade_suffers":
            valid = bool(land["coastal"] and _pieces(land, ["town"] if level == 2 else ["town", "city"]))
        elif mode == "mantle":
            valid = bool(land["presence"].get(pid))
        else:
            raise ValueError(f"unimplemented fear card: {mode}")
        if valid:
            choices.append(_choice(lid, lid, land_id=lid))
    if choices:
        if mode in ("retreat", "seek_safety", "trade_suffers", "mantle") or (mode == "dahan_enheartened" and level == 1):
            choices.append(_choice("skip", "不使用此效果"))
        _ask(state, pid, "fear_land", ("恐惧披风" if mode == "mantle" else FEAR_CARDS[mode]["name"]) + "：选择土地", choices, effect=effect)


def _resolve_fear_land(state: Dict, effect: Dict, lid: str) -> None:
    pid, mode, level = effect["player_id"], effect["mode"], effect["level"]
    land = _land(state, lid)
    dahan = len(_pieces(land, ["dahan"]))
    def fx(kind, amount=1, **kwargs):
        return {"kind": kind, "player_id": pid, "land_id": lid, "amount": amount, **kwargs}
    def branch(*options):
        return fx("branch", branches=[{"label": name, "effects": effects} for name, effects in options])
    state["fear_used_lands"].append(lid)
    effects = []
    if mode == "belief_takes_root":
        effects = [fx("remove_health", 2 * sum(land["presence"].values()), optional=True)]
    elif mode == "dahan_enheartened":
        if level == 1:
            effects = [branch(("推离 1 达汉", [fx("push", types=["dahan"])]), ("聚集 1 达汉", [fx("gather", types=["dahan"])]))]
        else:
            effects = [fx("gather", 2, types=["dahan"]), fx("card_step", step="fear_dahan_damage", level=level)]
    elif mode == "dahan_raid":
        effects = [fx("damage", 1 if level == 1 else dahan if level == 2 else 2 * dahan)]
    elif mode in ("emigration_accelerates", "wary_of_the_interior"):
        effects = [fx("remove", types=["explorer"] if level == 1 else ["explorer", "town"])]
    elif mode == "fear_of_the_unseen":
        types = ["explorer", "town"]
        if level == 3 and any(_sacred(state, owner, lid) for owner in state["turn_order"]):
            types.append("city")
        effects = [fx("remove", types=types)]
    elif mode == "isolation":
        effects = [fx("remove", types=["explorer", "town", "city"] if level == 3 else ["explorer", "town"])]
    elif mode == "retreat":
        effects = [fx("push", 2 if level == 1 else 3 if level == 2 else len(_pieces(land)), types=["explorer"] if level == 1 else ["explorer", "town"])]
    elif mode == "seek_safety":
        if level == 1:
            effects = [fx("push", types=["explorer"], seek_safety=True)]
        elif level == 2:
            branches = [("聚集 1 探索者", [fx("gather", types=["explorer"])])]
            if _pieces(land, ["city"]):
                branches.append(("聚集 1 村镇", [fx("gather", types=["town"])]))
            effects = [branch(*branches)]
        else:
            effects = [fx("remove_health", 3, optional=True)]
    elif mode == "tall_tales_of_savagery":
        if level == 1:
            effects = [fx("remove", types=["explorer"])]
        else:
            effects = [branch(("移除至多 2 探索者", [fx("remove", 2, types=["explorer"])]), ("移除 1 村镇", [fx("remove", types=["town"])]))]
            if level == 3 and dahan >= 2:
                effects.append(fx("remove", types=["city"]))
    elif mode == "trade_suffers":
        effects = [fx("replace", types=["town"] if level == 2 else ["town", "city"])]
    elif mode == "mantle":
        effects = [fx("push", types=["explorer"]), fx("push", types=["town"])]
    _queue(state, effects)


def _speed_available(state: Dict, pid: str, speed: str) -> bool:
    if state["phase"] == "slow":
        return speed == "slow"
    if speed == "fast":
        return True
    player = state["players"][pid]
    air = _elements(state, pid).get("air", 0) if player["spirit_id"] == "lightning" else 0
    return player["fast_used"] < air + player["fast_granted"]


def _options(state: Dict, pid: str) -> List[Dict]:
    if state["game_over"] or pid not in state["players"]:
        return []
    pending = state["pending"]
    if pending:
        if pending["player_id"] != pid:
            return []
        result = []
        for item in pending["choices"]:
            option = _option("choose", item["label"], "land" if "land_id" in item else "card" if "card_id" in item else "choice", value=item["value"])
            option.update({key: item[key] for key in ("land_id", "card_id", "player_id") if key in item})
            result.append(option)
        return result
    player = state["players"][pid]
    phase = state["phase"]
    if phase == "choose_spirit":
        if player["spirit_id"]:
            return []
        chosen = {p["spirit_id"] for p in state["players"].values()}
        return [_option("choose_spirit", spirit["name"], "spirit", spirit_id=sid)
                for sid, spirit in SPIRITS.items() if sid not in chosen]
    if phase == "round_end":
        return [] if pid in state["ready_players"] else [_option("next_round", "Next Round", "confirm")]
    spirit = SPIRITS[player["spirit_id"]]
    if phase == "growth":
        if player["growth_done"]:
            return []
        return [_option("growth", growth["name"], "growth", growth_id=growth["id"]) for growth in spirit["growth"]]
    if phase == "play":
        if player["ready"]:
            return []
        result = []
        if len(player["played"]) < spirit["plays_track"][player["plays_track"]]:
            result.extend(_option("play_card", f"打出 {POWERS[cid]['name']}（{POWERS[cid]['cost']} ⚡）", "card", card_id=cid)
                          for cid in player["hand"] if POWERS[cid]["cost"] <= player["energy"])
        result.extend(_option("unplay_card", f"收回 {POWERS[cid]['name']}", "card", card_id=cid) for cid in player["played"])
        if spirit.get("reclaim_one_at") is not None and player["plays_track"] >= spirit["reclaim_one_at"] and not player["reclaim_one_used"]:
            result.extend(_option("reclaim_one", f"收回一张：{POWERS[cid]['name']}", "card", card_id=cid) for cid in player["discard"])
        result.append(_option("ready", "Ready — 完成出牌", "confirm"))
        return result
    if phase in ("fast", "slow"):
        result = []
        for cid in player["played"]:
            if cid not in player["used"] and _speed_available(state, pid, POWERS[cid]["speed"]) and _power_targets(state, pid, POWERS[cid], player["range_bonus"]):
                result.append(_option("use_power", f"使用 {POWERS[cid]['name']}", "power", card_id=cid))
        innate = spirit["innate"]
        if not player["innate_used"] and _speed_available(state, pid, innate["speed"]) and _power_targets(state, pid, innate, player["range_bonus"]):
            for index, threshold in enumerate(innate["thresholds"]):
                if _threshold(_elements(state, pid), threshold["elements"]):
                    result.append(_option("use_innate", f"{innate['name']} · 等级 {index + 1}", "power", level=index + 1))
        for index, offer in enumerate(player["repeat_offers"]):
            if offer["remaining"] <= 0:
                continue
            for cid in player["played"]:
                if cid in player["used"] and cid not in offer["used"] and POWERS[cid]["cost"] <= offer["limit"] and (not offer["paid"] or player["energy"] >= POWERS[cid]["cost"]):
                    speed = player["card_speeds"].get(cid, POWERS[cid]["speed"])
                    repeat_cost = POWERS[cid]["cost"] if offer["paid"] else 0
                    if phase == speed and _power_targets(state, pid, POWERS[cid], player["range_bonus"], repeat_cost):
                        result.append(_option("repeat_power", f"重复 {POWERS[cid]['name']}" + (f"（{POWERS[cid]['cost']} ⚡）" if offer["paid"] else "（免费）"), "power", card_id=cid, offer=index))
        if pid not in state["phase_done"]:
            result.append(_option("pass", "Done — 完成本阶段", "confirm"))
        return result
    return []


def _apply(state: Dict, pid: str, action: Dict) -> None:
    kind = action["type"]
    player = state["players"][pid]
    if kind == "choose":
        _resolve_choice(state, pid, action["value"])
    elif kind == "choose_spirit":
        sid = action["spirit_id"]
        spirit = SPIRITS[sid]
        player["spirit_id"] = sid
        player["hand"] = list(spirit["starting_powers"])
        for setup in spirit["setup"]:
            if "land_number" in setup:
                lid = player["board"] + str(setup["land_number"])
            else:
                lands = [land for land in state["lands"].values() if land["board"] == player["board"] and land["terrain"] == setup["terrain"]]
                lid = max(lands, key=lambda land: land["number"])["id"]
            _land(state, lid)["presence"][pid] = _land(state, lid)["presence"].get(pid, 0) + setup["count"]
        # Only the selected spirits' progression cards are reserved.
        for cid in spirit["progression"]:
            deck = state[POWERS[cid]["type"] + "_deck"]
            if cid in deck:
                deck.remove(cid)
        _log(state, f"{_name(state, pid)} 选择 {spirit['name']}（岛板 {player['board']}）。")
        if all(p["spirit_id"] for p in state["players"].values()):
            state["phase"] = "growth"
    elif kind == "growth":
        growth = next(item for item in SPIRITS[player["spirit_id"]]["growth"] if item["id"] == action["growth_id"])
        if growth["reclaim"]:
            player["hand"].extend(player["discard"])
            player["discard"] = []
        player["energy"] += growth["energy"]
        effects = [{"kind": "gain_power", "player_id": pid}] if growth["gain_power"] else []
        effects.extend({"kind": "presence", "player_id": pid, "range": distance} for distance in growth["presence_ranges"])
        effects.append({"kind": "growth_complete", "player_id": pid})
        _queue(state, effects)
    elif kind == "play_card":
        cid = action["card_id"]
        player["hand"].remove(cid)
        player["played"].append(cid)
        player["energy"] -= POWERS[cid]["cost"]
    elif kind == "unplay_card":
        cid = action["card_id"]
        player["played"].remove(cid)
        player["hand"].append(cid)
        player["energy"] += POWERS[cid]["cost"]
    elif kind == "reclaim_one":
        cid = action["card_id"]
        player["discard"].remove(cid)
        player["hand"].append(cid)
        player["reclaim_one_used"] = True
    elif kind == "ready":
        player["ready"] = True
        if all(p["ready"] for p in state["players"].values()):
            _enter_phase(state, "fast")
    elif kind in ("use_power", "use_innate", "repeat_power"):
        if pid in state["phase_done"]:
            state["phase_done"].remove(pid)
        innate = kind == "use_innate"
        cid = f"{player['spirit_id']}:{action['level']}" if innate else action["card_id"]
        card = SPIRITS[player["spirit_id"]]["innate"] if innate else POWERS[cid]
        if kind == "repeat_power":
            offer = player["repeat_offers"][action["offer"]]
            offer["remaining"] -= 1
            offer["used"].append(cid)
            if offer["paid"]:
                player["energy"] -= POWERS[cid]["cost"]
        else:
            if state["phase"] == "fast" and card["speed"] == "slow":
                player["fast_used"] += 1
            if innate:
                player["innate_used"] = True
            else:
                player["used"].append(cid)
                player["card_speeds"][cid] = state["phase"]
        _ask(state, pid, "target", f"{card['name']}：选择目标", _power_targets(state, pid, card, player["range_bonus"]),
             card_id=cid, innate=innate, is_repeat=kind == "repeat_power")
    elif kind == "pass":
        state["phase_done"].append(pid)
        if len(state["phase_done"]) == len(state["turn_order"]):
            _enter_phase(state, "fear" if state["phase"] == "fast" else "round_end")
    elif kind == "next_round":
        state["ready_players"].append(pid)
        if len(state["ready_players"]) == len(state["turn_order"]):
            _new_round(state)
    else:
        raise ValueError(f"unsupported action: {kind}")
    _run(state)
    _check_victory(state)


class SpiritIslandGame:
    game_id = "spirit_island"
    min_players = 1
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        from .spirit_island_data import BOARD_LAYOUTS, CROSS_BOARD_EDGES
        if not isinstance(players, list) or not 1 <= len(players) <= 4:
            raise ValueError("Spirit Island requires 1–4 players")
        if config is not None and not isinstance(config, dict):
            raise ValueError("Spirit Island config must be an object")
        if any(not isinstance(player, dict) or not isinstance(player.get("player_id"), str) or not player["player_id"].strip() for player in players):
            raise ValueError("player ids must be nonempty strings")
        if any(not isinstance(player.get("seat", 0), int) or isinstance(player.get("seat", 0), bool) for player in players):
            raise ValueError("player seats must be integers")
        players = sorted(players, key=lambda player: player.get("seat", 0))
        config = config or {}
        unknown = set(config) - {"seed"}
        if unknown:
            raise ValueError("unknown Spirit Island configuration")
        seed = config.get("seed")
        if seed is not None and (isinstance(seed, bool) or not isinstance(seed, (int, str))):
            raise ValueError("seed must be a string or integer")
        rng = random.Random(seed)
        order = [player["player_id"] for player in players]
        if len(set(order)) != len(order):
            raise ValueError("duplicate player id")
        stage1 = [_invader_card(1, [terrain]) for terrain in TERRAINS]
        stage2 = [_invader_card(2, [terrain]) for terrain in TERRAINS + ("coastal",)]
        stage3 = [_invader_card(3, [left, right]) for i, left in enumerate(TERRAINS) for right in TERRAINS[i + 1:]]
        for deck in (stage1, stage2, stage3):
            rng.shuffle(deck)
        invader_deck = stage1[:3] + stage2[:4] + stage3[:5]
        fear_deck = list(FEAR_CARDS)
        rng.shuffle(fear_deck)
        state = {"phase": "choose_spirit", "round": 1, "game_over": False, "victory": None,
                 "winner": None, "end_reason": None, "turn_order": order, "players": {}, "lands": {},
                 "pending": None, "effects": [], "piece_serial": 0, "phase_done": [], "ready_players": [],
                 "fear_pool": 4 * len(players), "fear_generated": 0, "fear_deck": fear_deck[:9],
                 "earned_fear": [], "fear_waiting": [], "revealed_fear": [], "terror_level": 1, "fear_used_lands": [],
                 "blight_total": 5 * len(players) + 1, "blight_remaining": 5 * len(players) + 1,
                 "invader_deck": invader_deck, "invader_discard": [],
                 "invaders": {"ravage": None, "build": None, "explore": None}, "log": [],
                 "fear_rules": [], "action_depth": 0, "action_triggers": [], "pending_loss": None, "pending_victory": False}
        for power_type in ("minor", "major"):
            deck = [cid for cid, card in POWERS.items() if card["type"] == power_type]
            rng.shuffle(deck)
            state[power_type + "_deck"] = deck
            state[power_type + "_discard"] = []
        layout = BOARD_LAYOUTS[len(players)]
        for index, meta in enumerate(players):
            pid = meta["player_id"]
            state["players"][pid] = {"id": pid, "name": meta.get("name", pid), "board": layout[index],
                "spirit_id": None, "energy": 0, "energy_track": 0, "plays_track": 0,
                "hand": [], "played": [], "discard": [], "growth_done": False, "ready": False,
                "used": [], "innate_used": False, "progression_index": 0, "destroyed_presence": 0,
                "fast_used": 0, "fast_granted": 0, "reclaim_one_used": False, "repeat_offers": [],
                "range_bonus": 0, "card_speeds": {}, "extra_elements": {}}
        for board in layout:
            for source in BOARDS[board]["lands"]:
                lid = board + str(source["id"])
                state["lands"][lid] = {"id": lid, "board": board, "number": source["id"],
                    "terrain": source["terrain"], "coastal": source["coastal"],
                    "adjacent": [board + str(n) for n in source["adjacent"]],
                    "presence": {}, "pieces": [], "blight": source.get("blight", 0),
                    "defend": 0, "skip": [], "damage_reduction": 0, "dahan_protected": False}
                for kind in PIECE_HEALTH:
                    _add_piece(state, lid, kind, source.get(kind, 0))
        for first, second in CROSS_BOARD_EDGES[len(players)]:
            state["lands"][first]["adjacent"].append(second)
            state["lands"][second]["adjacent"].append(first)
        initial_explore = state["invader_deck"].pop(0)
        state["invaders"]["build"] = initial_explore
        state["invaders"]["explore"] = initial_explore
        _explore(state, initial_explore)
        state["rng_state"] = rng.getstate()
        _log(state, f"🌴 岛屿建立；初始探索 {initial_explore['name']}。请选择精灵。")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return list(dict.fromkeys(option["action"]["type"] for option in _options(state, player_id)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        import json
        if not isinstance(action, dict) or not isinstance(player_id, str):
            return [], "invalid action"
        try:
            encoded = json.dumps(action, sort_keys=True, ensure_ascii=False)
            legal = {json.dumps(option["action"], sort_keys=True, ensure_ascii=False) for option in _options(state, player_id)}
        except (TypeError, ValueError):
            return [], "invalid action"
        if encoded not in legal:
            return [], "action is not currently legal"
        next_state = deepcopy(state)
        _apply(next_state, player_id, action)
        state.clear()
        state.update(next_state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["turn_order"]:
            source = state["players"][pid]
            player = {key: deepcopy(source[key]) for key in ("id", "name", "board", "spirit_id", "energy", "energy_track", "plays_track", "growth_done", "ready", "used", "innate_used", "destroyed_presence", "progression_index")}
            for zone in ("hand", "played", "discard"):
                player[zone] = [_card_view(cid) for cid in source[zone]]
            player["elements"] = dict(_elements(state, pid))
            if source["spirit_id"]:
                spirit = SPIRITS[source["spirit_id"]]
                player["income"] = spirit["energy_track"][source["energy_track"]]
                player["card_plays"] = spirit["plays_track"][source["plays_track"]]
            players.append(player)
        lands = []
        for lid, source in state["lands"].items():
            land = {key: deepcopy(source[key]) for key in ("id", "board", "number", "terrain", "coastal", "adjacent", "presence", "blight", "skip", "pieces")}
            land["skip"] = [action for action in ("ravage", "build", "explore") if _skip_action(state, lid, action)]
            land["defend"] = _defense(state, lid)
            for kind, key in (("explorer", "explorers"), ("town", "towns"), ("city", "cities"), ("dahan", "dahan")):
                land[key] = len(_pieces(source, [kind]))
            land["sacred_sites"] = [pid for pid in state["turn_order"] if _sacred(state, pid, lid)]
            lands.append(land)
        pending = state["pending"]
        return {"game_id": SpiritIslandGame.game_id, "viewer_id": viewer_id, "you": viewer_id,
                "phase": state["phase"], "round": state["round"], "players": players, "lands": lands,
                "spirits": [{"id": sid, **deepcopy(spirit)} for sid, spirit in SPIRITS.items()],
                "current_turn": pending["player_id"] if pending else None,
                "pending": {key: deepcopy(pending[key]) for key in ("kind", "prompt", "player_id")} if pending else None,
                "choice_cards": [_card_view(item["card_id"]) for item in pending["choices"] if item.get("card_id")] if pending else [],
                "action_options": _options(state, viewer_id), "legal_actions": SpiritIslandGame.get_legal_actions(state, viewer_id),
                "fear": {"pool": state["fear_pool"], "generated": state["fear_generated"], "terror_level": state["terror_level"],
                         "earned": len(state["earned_fear"]) + len(state.get("fear_waiting", [])), "deck_remaining": len(state["fear_deck"]),
                         "revealed": [{"id": cid, **deepcopy(FEAR_CARDS[cid])} for cid in state["revealed_fear"]]},
                "blight": {"remaining": state["blight_remaining"], "total": state["blight_total"]},
                "invaders": {**deepcopy(state["invaders"]), "deck_remaining": len(state["invader_deck"])},
                "phase_done": list(state["phase_done"]), "ready_players": list(state["ready_players"]),
                "log": list(state["log"]), "game_over": state["game_over"], "victory": state["victory"],
                "winner": state["winner"], "end_reason": state["end_reason"], "config": {"mode": "introductory"}}

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        # No hidden deck, seed, future Fear, or opponent-private reads.
        view = SpiritIslandGame.get_public_view(state, bot_id)
        options = view["action_options"]
        if not options:
            return None
        priorities = {"choose_spirit": 100, "growth": 90, "choose": 80, "reclaim_one": 75,
                      "play_card": 70, "use_innate": 65, "use_power": 60, "repeat_power": 55,
                      "ready": 20, "pass": 10, "next_round": 10, "unplay_card": -10}
        def score(option):
            action = option["action"]
            result = priorities.get(action["type"], 0)
            player = next(player for player in view["players"] if player["id"] == bot_id)
            if action["type"] == "growth":
                reclaim = "收回" in option["label"]
                result += 15 if reclaim and len(player["hand"]) < player.get("card_plays", 2) else 0
                result += 2 if not reclaim and len(player["hand"]) >= 2 else 0
            if action["type"] == "choose" and action.get("value") in ("skip", "move"):
                result -= 50
            if action["type"] == "use_innate":
                result += action["level"]
            lid = option.get("land_id")
            if lid:
                land = next(land for land in view["lands"] if land["id"] == lid)
                pending_kind = (view["pending"] or {}).get("kind")
                if pending_kind == "cascade":
                    result -= land["blight"] * 20 + sum(land["presence"].values()) * 2
                else:
                    result += land["cities"] * 2 + land["towns"] + land["explorers"] * 0.1
            return result
        return deepcopy(max(options, key=score)["action"])

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return deepcopy(payload)
