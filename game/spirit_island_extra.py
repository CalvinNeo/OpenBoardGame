"""Remaining base-game powers and their choice-driven effects.

The main engine owns phase timing and validation. This module returns effects
or creates explicit choices; no effect invents a player's allocation or target.
"""
from __future__ import annotations

from collections import Counter
from itertools import combinations
from typing import Dict, List
import random

from .spirit_island_data import POWERS, SPIRITS


def _core():
    # Imported at call time to keep the main engine's dispatch cycle harmless.
    from . import spirit_island
    return spirit_island


def _pieces(land: Dict, types=None) -> List[Dict]:
    kinds = types if types is not None else ("explorer", "town", "city")
    return [piece for piece in land["pieces"] if piece["type"] in kinds]


def _effect(kind: str, pid: str, lid=None, amount: int = 1, **kwargs) -> Dict:
    return {"kind": kind, "player_id": pid, "land_id": lid, "amount": amount, **kwargs}


def extra_power_effects(state: Dict, pid: str, cid: str, target: str,
                        fx, branch, move, threshold: bool) -> List[Dict]:
    land = state["lands"].get(target)
    player = state["players"][pid]
    dahan = len(_pieces(land, ["dahan"])) if land else 0
    if cid == "call_to_tend":
        return [branch(("移除 1 荒芜", [fx("remove_blight")]),
                       ("推离至多 3 达汉", [move("push", 3, ["dahan"])]))]
    if cid == "drift_down_into_slumber":
        return [fx("defend", 4 if land["terrain"] in ("jungle", "sand") else 1)]
    if cid == "drought":
        return [fx("destroy", 3, types=["town"]), fx("damage_all", 1, types=["town", "city"]),
                fx("blight")] + ([fx("destroy", types=["city"])] if threshold else [])
    if cid == "elemental_boon":
        return [fx("extra_elements", player_id=target, caster=pid, recipient=target, land_id=None)]
    if cid == "enticing_splendor":
        return [branch(("聚集 1 探索者或村镇", [move("gather", 1, ["explorer", "town"], optional=False)]),
                       ("聚集至多 2 达汉", [move("gather", 2, ["dahan"])]))]
    if cid == "gift_of_constancy":
        state["players"][target]["constancy_reclaims"] = state["players"][target].get("constancy_reclaims", 0) + 1
        if target != pid:
            player["constancy_reclaims"] = player.get("constancy_reclaims", 0) + 1
        return [fx("energy", 2, player_id=target, land_id=None)]
    if cid == "gift_of_living_energy":
        sites = sum(_core()._sacred(state, pid, lid) for lid in state["lands"])
        return [fx("energy", 1 + int(sites >= 2) + int(target != pid), player_id=target, land_id=None)]
    if cid == "gift_of_power":
        return [fx("extra_draft", player_id=target, land_id=None, power_type="minor")]
    if cid == "gnawing_rootbiters":
        return [move("push", 2, ["town"])]
    if cid == "lure_of_the_unknown":
        return [move("gather", 1, ["explorer", "town"], optional=False)]
    if cid == "quicken_the_earths_struggles":
        return [branch(("每个建筑各受 1 伤害", [fx("damage_all", 1, types=["town", "city"])]),
                       ("防御 10", [fx("defend", 10)]))]
    if cid == "rain_of_blood":
        return [fx("fear", 2 + int(len(_pieces(land, ["town", "city"])) >= 2))]
    if cid == "reaching_grasp":
        state["players"][target]["range_bonus"] += 2
        return []
    if cid == "sap_the_strength_of_multitudes":
        return [fx("defend", 5)]
    if cid == "steam_vents":
        return [fx("destroy", types=["explorer", "town"] if threshold else ["explorer"])]
    if cid == "veil_the_nights_hunt":
        return [branch(("每个达汉伤害一名不同入侵者", [fx("extra_distinct_damage", dahan)]),
                       ("推离至多 3 达汉", [move("push", 3, ["dahan"])]))]
    if cid == "blazing_renewal":
        return [fx("extra_blazing", player_id=target, caster=pid, recipient=target,
                   threshold=threshold, land_id=None)]
    if cid == "cleansing_floods":
        return [fx("damage", 4), fx("remove_blight")] + ([fx("damage", 10)] if threshold else [])
    if cid == "dissolve_the_bonds_of_kinship":
        return [fx("extra_replace", types=["city"], replacement="explorer", replacement_count=2),
                fx("replace", types=["town"], replacement="explorer"),
                fx("replace", types=["dahan"], replacement="explorer"),
                fx("card_step", step="extra_dissolve", threshold=threshold)]
    if cid == "entwined_power":
        for first, second in ((pid, target), (target, pid)):
            if second not in state["players"][first].setdefault("target_partners", []):
                state["players"][first]["target_partners"].append(second)
        return [fx("extra_draft", land_id=None, player_id=target, gift_to=pid),
                fx("card_step", step="extra_entwined_threshold", recipient=target, land_id=None)]
    if cid == "indomitable_claim":
        return [fx("extra_place_presence"), fx("defend", 20)] + (
            [fx("fear", 3 if _pieces(land) else 0), fx("skip")] if threshold else [])
    if cid == "infinite_vitality":
        land["prevent_blight"] = True
        land["dahan_health_bonus"] = land.get("dahan_health_bonus", 0) + 4
        for piece in _pieces(land, ["dahan"]):
            piece["health"] += 4
        if threshold:
            land["dahan_immune"] = True
            return [fx("extra_remove_near_blight")]
        return []
    if cid == "mists_of_oblivion":
        state["mists_serial"] = state.get("mists_serial", 0) + 1
        token = str(state["mists_serial"])
        state.setdefault("mists_fear_used", {})[token] = 0
        return [fx("extra_mists_all", token=token)] + (
            [fx("extra_mists_damage", 3, token=token)] if threshold else []) + [
            fx("extra_mists_clear", token=token)]
    if cid == "paralyzing_fright":
        return [fx("fear", 4), fx("skip")] + ([fx("fear", 4)] if threshold else [])
    if cid == "talons_of_lightning":
        return [fx("fear", 3), fx("damage", 5)] + (
            [fx("destroy", types=["town"], land_id=lid) for lid in land["adjacent"]] if threshold else [])
    if cid == "the_land_thrashes_in_furious_pain":
        amount = 2 * land["blight"] + sum(state["lands"][lid]["blight"] for lid in land["adjacent"])
        return [fx("damage", amount)] + ([fx("extra_repeat", card_id=cid, adjacent=True)]
                                         if threshold and not state.get("_resolving_repeat") else [])
    if cid == "the_trees_and_stones_speak_of_war":
        return [fx("damage", dahan), fx("defend", 2 * dahan)] + (
            [move("push", 2, ["dahan"], after=fx("card_step", step="extra_moving_defense"))]
            if threshold else [])
    if cid == "vengeance_of_the_dead":
        land.setdefault("vengeance", []).append({"player_id": pid, "adjacent": threshold})
        return [fx("fear", 3)]
    if cid == "winds_of_rust_and_atrophy":
        return [fx("fear"), fx("defend", 6), fx("replace", types=["town", "city"])] + (
            [fx("extra_repeat", card_id=cid)] if threshold and not state.get("_resolving_repeat") else [])
    if cid == "wrap_in_wings_of_sunlight":
        return ([move("gather", 3, ["dahan"])] if threshold else []) + [fx("extra_wrap")]
    raise ValueError(f"unimplemented power: {cid}")


def extra_card_step(state: Dict, effect: Dict, fx) -> List[Dict]:
    land = state["lands"].get(effect.get("land_id"))
    step = effect["step"]
    if step == "extra_dissolve":
        explorers = len(_pieces(land, ["explorer"]))
        buildings_damage = sum({"town": 2, "city": 3}[p["type"]] for p in _pieces(land, ["town", "city"]))
        effects = []
        if effect["threshold"]:
            effects = [fx("damage", explorers, types=["town", "city"]),
                       fx("destroy", buildings_damage, types=["explorer"])]
        return effects + [fx("extra_scatter")]
    if step == "extra_moving_defense":
        destinations = Counter(effect.get("destinations", []))
        land["defend"] -= 2 * sum(destinations.values())
        return [fx("defend", 2 * count, land_id=lid) for lid, count in destinations.items()]
    if step == "extra_entwined_threshold":
        # A gained Major can cause the caster to Forget this card before its
        # threshold is reached, immediately losing its printed elements.
        pid, target = effect["player_id"], effect["recipient"]
        if not _core()._threshold(_core()._elements(state, pid), POWERS["entwined_power"]["threshold"]):
            return []
        return [fx("energy", 3, land_id=None), fx("energy", 3, player_id=target, land_id=None),
                fx("extra_gift_card", land_id=None, recipient=target),
                fx("extra_gift_card", land_id=None, player_id=target, recipient=pid)]
    raise ValueError(f"unimplemented card step: {step}")


def _ask_effect(state: Dict, effect: Dict, kind: str, text: str, options: List[Dict]) -> None:
    if options:
        _core()._ask(state, effect["player_id"], kind, text, options, effect=effect)


def _draft(state: Dict, effect: Dict, power_type: str) -> None:
    core = _core()
    deck, discard = state[power_type + "_deck"], state[power_type + "_discard"]
    if len(deck) < 4 and discard:
        rng = random.Random()
        rng.setstate(core._tuple_state(state["rng_state"]))
        rng.shuffle(discard)
        deck.extend(discard)
        discard.clear()
        state["rng_state"] = rng.getstate()
    drawn = deck[:4]
    del deck[:4]
    if drawn:
        _ask_effect(state, {**effect, "power_type": power_type, "cards": drawn}, "extra_draft_card",
                    "从抽到的力量中保留 1 张", [core._choice(cid, POWERS[cid]["name"], card_id=cid) for cid in drawn])


def _mists_damage(state: Dict, effect: Dict, piece: Dict) -> None:
    """Count only destruction caused by this power, excluding triggered powers."""
    piece["health"] -= 1
    if piece["health"] > 0:
        return
    token = effect["token"]
    bonus = piece["type"] in ("town", "city") and state["mists_fear_used"][token] < 4
    _core()._destroy(state, effect["land_id"], piece["id"])
    if bonus:
        state["mists_fear_used"][token] += 1
        _core()._fear(state, 1)


def extra_effect(state: Dict, effect: Dict) -> bool:
    core = _core()
    kind, pid, lid = effect["kind"], effect["player_id"], effect.get("land_id")
    land = state["lands"].get(lid)
    amount = effect.get("amount", 1)
    choice = core._choice
    if kind == "extra_elements":
        names = {"sun": "☀️ 日", "moon": "🌙 月", "fire": "🔥 火", "air": "💨 风", "water": "💧 水",
                 "earth": "⛰️ 土", "plant": "🌿 植", "animal": "🐾 兽"}
        options = [choice(list(triple), " · ".join(names[e] for e in triple)) for triple in combinations(names, 3)]
        _ask_effect(state, effect, "extra_elements", "选择 3 种不同元素", options)
    elif kind == "extra_distinct_damage":
        if amount <= 0:
            return True
        options = [choice(p["id"], core.PIECE_LABELS[p["type"]]) for p in _pieces(land)
                   if p["id"] not in effect.get("selected", [])]
        _ask_effect(state, effect, "extra_distinct_damage", "选择一名尚未被本力量伤害的入侵者", options)
    elif kind == "extra_blazing":
        if state["players"][effect["recipient"]]["destroyed_presence"] <= 0:
            return True
        caster = effect["caster"]
        distance = 2 + state["players"][caster].get("range_bonus", 0)
        options = [choice(other, other, land_id=other) for other in state["lands"]
                   if core._in_range(state, caster, other, distance)]
        _ask_effect(state, effect, "extra_blazing", "选择放回被摧毁灵迹的土地", options)
    elif kind == "extra_replace":
        options = [choice(p["id"], core.PIECE_LABELS[p["type"]]) for p in _pieces(land, effect["types"])]
        _ask_effect(state, effect, "extra_replace", "选择替换的单位", options)
    elif kind == "extra_draft":
        if effect.get("power_type"):
            _draft(state, effect, effect["power_type"])
        else:
            options = [choice(t, "🌿 小力量" if t == "minor" else "🔥 大力量（需遗忘）")
                       for t in ("minor", "major") if state[t + "_deck"] or state[t + "_discard"]]
            _ask_effect(state, effect, "extra_draft_type", "选择学习的力量牌组", options)
    elif kind == "extra_draft_leftover":
        _ask_effect(state, effect, "extra_draft_leftover", "选择对方未保留的 1 张力量",
                    [choice(cid, POWERS[cid]["name"], card_id=cid) for cid in effect["cards"]])
    elif kind == "extra_gift_card":
        options = [choice(cid, POWERS[cid]["name"], card_id=cid) for cid in state["players"][pid]["hand"]]
        if options:
            options.append(choice("skip", "不赠送手牌"))
            _ask_effect(state, effect, "extra_gift_card", "可赠送对方 1 张手牌", options)
    elif kind == "extra_place_presence":
        player, spirit = state["players"][pid], SPIRITS[state["players"][pid]["spirit_id"]]
        options = [choice(track, "⚡ 能量轨" if track == "energy_track" else "🃏 出牌轨")
                   for track in ("energy_track", "plays_track") if player[track] < len(spirit[track]) - 1]
        options += [choice("move:" + source, "移动 " + source + " 的灵迹") for source, site in state["lands"].items()
                    if site["presence"].get(pid)]
        options.append(choice("skip", "不放置灵迹"))
        _ask_effect(state, effect, "extra_place_presence", "选择放置于 " + lid + " 的灵迹来源", options)
    elif kind == "extra_remove_near_blight":
        options = [choice(other, other, land_id=other) for other in [lid] + land["adjacent"]
                   if state["lands"][other]["blight"]]
        _ask_effect(state, effect, "extra_remove_near_blight", "从目标或邻地移除 1 荒芜", options)
    elif kind == "extra_scatter":
        explorers = _pieces(land, ["explorer"])
        if not explorers:
            return True
        destinations = [other for other in land["adjacent"] if other not in effect.get("visited", [])]
        if not destinations:
            destinations = land["adjacent"]
        options = [choice({"piece_id": piece["id"], "to": other}, "🚶 探索者 → " + other, land_id=other)
                   for piece in explorers for other in destinations]
        _ask_effect(state, effect, "extra_scatter", "将探索者尽量分散至不同邻地", options)
    elif kind == "extra_repeat":
        if effect.get("adjacent"):
            options = [choice({"land_id": other, "shadows": False}, other, land_id=other) for other in land["adjacent"]]
        else:
            options = core._power_targets(state, pid, POWERS[effect["card_id"]],
                                          state["players"][pid].get("range_bonus", 0))
        _ask_effect(state, effect, "extra_repeat", "选择重复力量的目标", options)
    elif kind == "extra_mists_all":
        for piece in list(_pieces(land)):
            _mists_damage(state, effect, piece)
    elif kind == "extra_mists_damage":
        if amount > 0:
            options = [choice(p["id"], core.PIECE_LABELS[p["type"]]) for p in _pieces(land)]
            _ask_effect(state, effect, "extra_mists_damage", "分配迷雾的伤害，剩余 " + str(amount), options)
    elif kind == "extra_mists_clear":
        state["mists_fear_used"].pop(effect["token"], None)
    elif kind == "extra_wrap":
        if not _pieces(land, ["dahan"]):
            return True
        options = [choice(other, other, land_id=other) for other in state["lands"]]
        options.append(choice("skip", "不移动达汉"))
        _ask_effect(state, effect, "extra_wrap_land", "达汉可飞往任意同一土地", options)
    elif kind == "extra_constancy":
        available = [cid for cid in effect["cards"] if cid in state["players"][pid]["discard"]]
        options = [choice(cid, POWERS[cid]["name"], card_id=cid) for cid in available]
        if options and amount > 0:
            options.append(choice("skip", "不收回"))
            _ask_effect(state, effect, "extra_constancy", "恒常赐福：收回本轮使用的力量", options)
    elif kind == "extra_vengeance":
        if effect.get("adjacent"):
            options = [choice(other, other, land_id=other) for other in [lid] + land["adjacent"] if _pieces(state["lands"][other])]
            _ask_effect(state, effect, "extra_vengeance", "分配亡者复仇的 1 点伤害", options)
        else:
            core._queue(state, [_effect("damage", pid, lid, amount, no_vengeance=True)])
    else:
        return False
    return True


def extra_choice(state: Dict, pending: Dict, value) -> bool:
    core = _core()
    kind, effect = pending["kind"], pending["effect"]
    pid, lid = effect["player_id"], effect.get("land_id")
    land = state["lands"].get(lid)
    player = state["players"][pid]
    if kind == "extra_elements":
        for recipient in set((effect["caster"], effect["recipient"])):
            elements = state["players"][recipient].setdefault("extra_elements", {})
            for element in value:
                elements[element] = elements.get(element, 0) + 1
    elif kind == "extra_distinct_damage":
        piece = next(p for p in land["pieces"] if p["id"] == value)
        piece["health"] -= 1
        if piece["health"] <= 0:
            core._destroy(state, lid, value)
        core._queue(state, [{**effect, "amount": effect["amount"] - 1,
                             "selected": effect.get("selected", []) + [value]}])
    elif kind == "extra_blazing":
        recipient = effect["recipient"]
        count = min(2, state["players"][recipient]["destroyed_presence"])
        state["players"][recipient]["destroyed_presence"] -= count
        site = state["lands"][value]
        site["presence"][recipient] = site["presence"].get(recipient, 0) + count
        effects = [_effect("damage_all", effect["caster"], value, 2, types=["town", "city"])]
        if effect["threshold"]:
            effects.append(_effect("damage", effect["caster"], value, 4))
        core._queue(state, effects)
    elif kind == "extra_replace":
        core._destroy(state, lid, value, fear=False)
        core._add_piece(state, lid, effect["replacement"], effect.get("replacement_count", 1))
    elif kind == "extra_draft_type":
        _draft(state, effect, value)
    elif kind == "extra_draft_card":
        player["hand"].append(value)
        remaining = [cid for cid in effect["cards"] if cid != value]
        next_effects = []
        if effect["power_type"] == "major":
            next_effects.append(_effect("forget", pid))
        if effect.get("gift_to") and remaining:
            recipient = effect["gift_to"]
            next_effects.append({**effect, "kind": "extra_draft_leftover", "player_id": recipient,
                                 "cards": remaining, "gift_to": None})
        else:
            state[effect["power_type"] + "_discard"].extend(remaining)
        core._queue(state, next_effects)
    elif kind == "extra_draft_leftover":
        player["hand"].append(value)
        state[effect["power_type"] + "_discard"].extend(cid for cid in effect["cards"] if cid != value)
        if effect["power_type"] == "major":
            core._queue(state, [_effect("forget", pid)])
    elif kind == "extra_gift_card":
        if value != "skip":
            player["hand"].remove(value)
            state["players"][effect["recipient"]]["hand"].append(value)
    elif kind == "extra_place_presence":
        if value == "skip":
            return True
        if value.startswith("move:"):
            state["lands"][value[5:]]["presence"][pid] -= 1
        else:
            player[value] += 1
        land["presence"][pid] = land["presence"].get(pid, 0) + 1
    elif kind == "extra_remove_near_blight":
        core._queue(state, [_effect("remove_blight", pid, value)])
    elif kind == "extra_scatter":
        piece = next(p for p in land["pieces"] if p["id"] == value["piece_id"])
        land["pieces"].remove(piece)
        state["lands"][value["to"]]["pieces"].append(piece)
        core._queue(state, [{**effect, "visited": effect.get("visited", []) + [value["to"]]}])
    elif kind == "extra_repeat":
        if value.get("shadows"):
            player["energy"] -= 1
        core._queue(state, [{"kind": "power", "player_id": pid, "card_id": effect["card_id"],
                             "target": value["land_id"], "is_repeat": True}])
    elif kind == "extra_mists_damage":
        piece = next(p for p in land["pieces"] if p["id"] == value)
        _mists_damage(state, effect, piece)
        core._queue(state, [{**effect, "amount": effect["amount"] - 1}])
    elif kind == "extra_wrap_land":
        if value == "skip":
            return True
        count = min(5, len(_pieces(land, ["dahan"])))
        _ask_effect(state, {**effect, "destination": value}, "extra_wrap_count", "选择飞行的达汉数量",
                    [core._choice(n, str(n) + " 个达汉") for n in range(count + 1)])
    elif kind == "extra_wrap_count":
        if value:
            _ask_effect(state, {**effect, "amount": value}, "extra_wrap_piece", "选择飞行的达汉",
                        [core._choice(p["id"], "🛖 达汉（生命 " + str(p["health"]) + "）") for p in _pieces(land, ["dahan"])])
    elif kind == "extra_wrap_piece":
        piece = next(p for p in land["pieces"] if p["id"] == value)
        destination = state["lands"][effect["destination"]]
        extra_on_move(state, piece, lid, effect["destination"])
        land["pieces"].remove(piece)
        destination["pieces"].append(piece)
        if piece["health"] <= 0:
            core._destroy(state, effect["destination"], piece["id"])
        left = effect["amount"] - 1
        moved = effect.get("moved", []) + [value]
        if left:
            _ask_effect(state, {**effect, "amount": left, "moved": moved}, "extra_wrap_piece", "选择飞行的达汉",
                        [core._choice(p["id"], "🛖 达汉（生命 " + str(p["health"]) + "）") for p in _pieces(land, ["dahan"])
                         if p["id"] not in moved])
        else:
            core._queue(state, [_effect("defend", pid, effect["destination"], 5)])
    elif kind == "extra_constancy":
        if value != "skip":
            player["discard"].remove(value)
            player["hand"].append(value)
            core._queue(state, [{**effect, "amount": effect["amount"] - 1}])
    elif kind == "extra_vengeance":
        core._queue(state, [_effect("damage", pid, value, 1, no_vengeance=True)])
    else:
        return False
    return True


def extra_on_destroy(state: Dict, lid: str, piece: Dict) -> List[Dict]:
    if piece["type"] not in ("town", "city", "dahan"):
        return []
    return [_effect("extra_vengeance", entry["player_id"], lid, adjacent=entry["adjacent"])
            for entry in state["lands"][lid].get("vengeance", [])]


def extra_on_move(state: Dict, piece: Dict, source: str, destination: str) -> None:
    if piece["type"] == "dahan":
        before = state["lands"][source].get("dahan_health_bonus", 0)
        after = state["lands"][destination].get("dahan_health_bonus", 0)
        piece["health"] += after - before


def extra_time_passes(state: Dict) -> List[Dict]:
    effects = []
    for pid, player in state["players"].items():
        count = player.pop("constancy_reclaims", 0)
        if count:
            effects.append(_effect("extra_constancy", pid, amount=count, cards=list(player["played"])))
        player["extra_elements"] = {}
        player["target_partners"] = []
        player["range_bonus"] = 0
    for land in state["lands"].values():
        land["prevent_blight"] = False
        land["dahan_immune"] = False
        land["dahan_health_bonus"] = 0
        land["vengeance"] = []
    return effects
