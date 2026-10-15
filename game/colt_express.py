"""Colt Express base game, with private programming and explicit action windows.

Only public views are passed to the bot policy. All gameplay mutations are
validated against a complete legal action list on a copy before committing.
"""
import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["play", "draw", "move", "climb", "rob", "shoot", "punch", "marshal", "fizzle", "next_round", "event_loot", "skip_event"]},
        "game_token": {"type": "string"}, "window_id": {"type": "integer", "minimum": 0},
        "label": {"type": "string", "maxLength": 250}, "card_id": {"type": "string"},
        "car": {"type": "integer", "minimum": 0, "maximum": 6}, "target": {"type": "string"},
        "loot_id": {"type": "string"}, "loot_type": {"enum": ["purse", "gem", "strongbox", "none"]},
        "hidden": {"type": "boolean"}, "steal": {"type": "boolean"},
    },
    "required": ["type", "game_token", "window_id"], "additionalProperties": False,
}
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
ROLES = {
    "ghost": {"name": "Ghost · 幽灵", "emoji": "👻", "color": "#dce5ed", "ability": "每轮第一个策划机会可以将行动牌暗置；抽牌会消耗这次机会。"},
    "doc": {"name": "Doc · 博士", "emoji": "🎩", "color": "#64b8df", "ability": "每轮开始抽七张牌。"},
    "tuco": {"name": "Tuco · 图科", "emoji": "🤠", "color": "#d75b5d", "ability": "还可射击同一车厢另一层的匪徒。"},
    "cheyenne": {"name": "Cheyenne · 夏延", "emoji": "🦊", "color": "#63b184", "ability": "拳击使对方掉落钱袋时，可直接拿走该钱袋。"},
    "belle": {"name": "Belle · 贝尔", "emoji": "🌹", "color": "#b27bd1", "ability": "若攻击者还有其他合法目标，不能射击或拳击你。"},
    "django": {"name": "Django · 姜戈", "emoji": "🧨", "color": "#40404a", "ability": "射中对手后将其沿射击方向推远一节，列车边缘不移动。"},
}
ACTIONS = {
    "move": {"name": "移动", "emoji": "👣", "count": 2},
    "climb": {"name": "攀爬", "emoji": "🪜", "count": 2},
    "shoot": {"name": "射击", "emoji": "🔫", "count": 2},
    "rob": {"name": "抢劫", "emoji": "💰", "count": 2},
    "punch": {"name": "拳击", "emoji": "👊", "count": 1},
    "marshal": {"name": "移动警长", "emoji": "⭐", "count": 1},
}
LOOT = {"purse": {"name": "钱袋", "emoji": "💰"}, "gem": {"name": "宝石", "emoji": "💎"}, "strongbox": {"name": "保险箱", "emoji": "🧳"}}
EVENTS = {
    "none": ("平静驶过", "没有额外事件。"),
    "angry_marshal": ("愤怒的警长", "警长所在车厢车顶的所有匪徒收到中立子弹；警长随后向车尾移动一节并驱赶车内匪徒。"),
    "braking": ("紧急刹车", "车顶所有匪徒向车头移动一节。"),
    "take_it_all": ("全部拿走", "在警长所在车厢的车内放置第二个 $1,000 保险箱。"),
    "rebellion": ("乘客反抗", "车内所有匪徒收到一张中立子弹。"),
    "swivel": ("摇臂吊车", "车顶所有匪徒被移到末节车厢的车顶。"),
    "pickpocket": ("扒窃", "独处于某车厢某一层的匪徒可拿走当地一个钱袋。"),
    "revenge": ("警长的复仇", "警长所在车厢车顶的匪徒各将一个最便宜的钱袋掉落到当地车顶。"),
    "hostage": ("劫持列车长", "在车头内或车头顶的匪徒各获得 $250。"),
}
# Official 2016 base rules and printed components:
# https://www.data.ludonaute.fr/Colt_Express/RULES/Colt_Express_Rules_2016_EN.pdf
# https://www.data.ludonaute.fr/Colt_Express/CONTENTS/CARDS/Colt_Express_Cards_BACK.pdf
# Public event descriptions are attached only to the current round card.
ROUND_CARDS = {
    "small": [
        {"id": "s1", "turns": ["normal", "normal", "tunnel", "reverse"], "event": "angry_marshal"},
        {"id": "s2", "turns": ["normal", "tunnel", "double", "normal"], "event": "take_it_all"},
        {"id": "s3", "turns": ["normal", "tunnel", "normal", "tunnel", "normal"], "event": "none"},
        {"id": "s4", "turns": ["normal", "tunnel", "normal", "normal"], "event": "swivel"},
        {"id": "s5", "turns": ["normal", "double", "normal"], "event": "none"},
        {"id": "s6", "turns": ["normal", "normal", "normal", "normal"], "event": "braking"},
        {"id": "s7", "turns": ["normal", "normal", "tunnel", "normal", "normal"], "event": "rebellion"},
    ],
    "large": [
        {"id": "l1", "turns": ["normal", "normal", "reverse"], "event": "angry_marshal"},
        {"id": "l2", "turns": ["normal", "double", "reverse"], "event": "take_it_all"},
        {"id": "l3", "turns": ["normal", "tunnel", "normal", "tunnel"], "event": "none"},
        {"id": "l4", "turns": ["normal", "tunnel", "normal"], "event": "swivel"},
        {"id": "l5", "turns": ["normal", "double"], "event": "none"},
        {"id": "l6", "turns": ["normal", "tunnel", "normal", "normal"], "event": "braking"},
        {"id": "l7", "turns": ["normal", "tunnel", "normal", "reverse"], "event": "rebellion"},
    ],
}
STATIONS = [{"id": "station_" + event, "turns": ["normal", "normal", "tunnel", "normal"], "event": event}
            for event in ("pickpocket", "revenge", "hostage")]

# Printed purse/jewel counts; the six cars are shuffled before selecting.
CAR_LAYOUTS = [(1, 0), (1, 1), (0, 3), (3, 0), (4, 1), (3, 1)]


def _rng(state: Dict) -> random.Random:
    state["rng_counter"] += 1
    return random.Random(f"{state['seed']}:{state['rng_counter']}")


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid]["name"]


def _log(state: Dict, text: str, players: Optional[List[str]] = None) -> None:
    entry = {"round": state["round"], "text": text, "players": players or []}
    state["log"].append(entry)
    state["round_log"].append(copy.deepcopy(entry))
    state["log"] = state["log"][-160:]


def _new_loot(state: Dict, kind: str, value: int) -> Dict:
    state["loot_serial"] += 1
    return {"id": f"loot_{state['loot_serial']}", "type": kind, "value": value}


def _loot_view(loot: Dict, reveal: bool = False) -> Dict:
    return {**{k: loot[k] for k in ("id", "type")}, **LOOT[loot["type"]],
            "value": loot["value"] if reveal or loot["type"] != "purse" else None}


def _round_card(state: Dict) -> Dict:
    card = copy.deepcopy(state["round_cards"][state["round"] - 1])
    name, description = EVENTS[card["event"]]
    card.update(name=f"第 {state['round']} 轮" + (" · 终点站" if state["round"] == 5 else ""),
                event_name=name, event_description=description)
    return card


def _turn_sequence(state: Dict) -> List[Dict]:
    order = state["turn_order"]
    first = state["first_index"]
    sequence = []
    for turn, kind in enumerate(_round_card(state)["turns"]):
        direction = -1 if kind == "reverse" else 1
        for offset in range(len(order)):
            pid = order[(first + direction * offset) % len(order)]
            for sub in range(2 if kind == "double" else 1):
                sequence.append({"player_id": pid, "turn": turn, "kind": kind, "sub": sub})
    return sequence


def _start_round(state: Dict) -> None:
    state.update(phase="program", next_ready=[], round_summary=None, round_log=[], program=[], program_index=0,
                 execute_index=0, active_card=None, event_pending=[])
    for pid, player in state["players"].items():
        deck = player["hand"] + player["deck"] + player["discard"]
        _rng(state).shuffle(deck)
        amount = 7 if player["role"] == "doc" else 6
        player.update(hand=deck[:amount], deck=deck[amount:], discard=[], ghost_available=True)
    state["round_start"] = {pid: {"loot": len(p["loots"]), "bullets": p["bullets_received"], "shots": p["shots"]}
                            for pid, p in state["players"].items()}
    state["schedule"] = _turn_sequence(state)
    state["current_turn"] = state["schedule"][0]["player_id"]
    _log(state, f"第 {state['round']} 轮开始：{_name(state, state['current_turn'])} 先策划。")


def _bullet(state: Dict, pid: str, source: str = "marshal") -> None:
    if source == "marshal":
        if state["neutral_bullets"] == 0:
            _log(state, f"中立子弹已用完，{_name(state, pid)} 未收到子弹。", [pid])
            return
        state["neutral_bullets"] -= 1
    state["bullet_serial"] += 1
    state["players"][pid]["deck"].insert(0, {"id": f"bullet_{state['bullet_serial']}", "kind": "bullet", "source": source})
    state["players"][pid]["bullets_received"] += 1


def _neutral_volley(state: Dict, targets: List[str]) -> bool:
    """The finite neutral stack treats a simultaneous group equally."""
    if state["neutral_bullets"] < len(targets):
        _log(state, "中立子弹不足以分给全体，本次所有人均不收到子弹。", targets)
        return False
    for pid in targets:
        _bullet(state, pid)
    return True


def _marshal_encounter(state: Dict) -> None:
    targets = [pid for pid in state["turn_order"] if state["players"][pid]["car"] == state["marshal"]
               and state["players"][pid]["level"] == "inside"]
    armed = _neutral_volley(state, targets)
    for pid in targets:
        state["players"][pid]["level"] = "roof"
        _log(state, f"{_name(state, pid)} 遇见警长，{'收到中立子弹并' if armed else ''}逃上车顶。", [pid])


def _targets(state: Dict, pid: str, kind: str) -> List[str]:
    own = state["players"][pid]
    others = [other for other in state["turn_order"] if other != pid]
    if kind == "punch":
        targets = [other for other in others if all(state["players"][other][key] == own[key] for key in ("car", "level"))]
    else:
        if own["bullets_left"] == 0:
            return []
        targets = []
        for direction in (-1, 1):
            distance = 1
            while 0 <= own["car"] + direction * distance < len(state["cars"]):
                car = own["car"] + direction * distance
                found = [other for other in others if state["players"][other]["level"] == own["level"] and state["players"][other]["car"] == car]
                if found:
                    targets.extend(found)
                    break
                if own["level"] == "inside":
                    break
                distance += 1
        if own["role"] == "tuco":
            targets.extend(other for other in others if state["players"][other]["car"] == own["car"] and state["players"][other]["level"] != own["level"])
    if len(targets) > 1:
        targets = [other for other in targets if state["players"][other]["role"] != "belle"]
    return targets


def _adjacent(car: int, count: int) -> List[int]:
    return [dest for dest in (car - 1, car + 1) if 0 <= dest < count]


def _legal(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["players"] or state["game_over"]:
        return []
    actions = []
    def add(kind: str, label: str, **fields) -> None:
        actions.append({"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], "label": label[:250], **fields})
    if state["phase"] == "round_end":
        if pid not in state["next_ready"]:
            add("next_round", "Show Results" if state["round"] == 5 else "Next Round")
        return actions
    if state["current_turn"] != pid:
        return []
    own = state["players"][pid]
    if state["phase"] == "event":
        for loot in state["cars"][own["car"]]["loot"][own["level"]]:
            if loot["type"] == "purse":
                add("event_loot", "💰 扒窃这个钱袋", loot_id=loot["id"])
        add("skip_event", "Skip · 放弃扒窃")
        return actions
    if state["phase"] == "program":
        slot = state["schedule"][state["program_index"]]
        for card in own["hand"]:
            if card["kind"] == "bullet":
                continue
            info = ACTIONS[card["kind"]]
            forced = slot["kind"] == "tunnel"
            ghost = own["role"] == "ghost" and own["ghost_available"]
            if ghost and not forced:
                add("play", f"暗置 {info['emoji']} {info['name']}", card_id=card["id"], hidden=True)
            add("play", f"{'暗置' if forced else '策划'} {info['emoji']} {info['name']}", card_id=card["id"], hidden=forced)
        add("draw", f"抽取 {min(3, len(own['deck']))} 张牌")
        return actions
    if state["phase"] != "execute":
        return []
    kind = state["active_card"]["kind"]
    if kind == "move":
        reach = 3 if own["level"] == "roof" else 1
        for car in range(len(state["cars"])):
            if 1 <= abs(car - own["car"]) <= reach:
                add(kind, f"👣 移动到{'车头' if car == 0 else str(car) + ' 号车厢'}", car=car)
    elif kind == "climb":
        add(kind, "🪜 爬上车顶" if own["level"] == "inside" else "🪜 进入车内")
    elif kind == "marshal":
        for car in _adjacent(state["marshal"], len(state["cars"])):
            add(kind, f"⭐ 警长前往{'车头' if car == 0 else str(car) + ' 号车厢'}", car=car)
    elif kind == "rob":
        for loot in state["cars"][own["car"]]["loot"][own["level"]]:
            info = LOOT[loot["type"]]
            add(kind, f"{info['emoji']} 拿取{info['name']}", loot_id=loot["id"])
    elif kind == "shoot":
        for target in _targets(state, pid, kind):
            add(kind, f"🔫 射击 {_name(state, target)}", target=target)
    elif kind == "punch":
        for target in _targets(state, pid, kind):
            types = sorted({loot["type"] for loot in state["players"][target]["loots"]}) or ["none"]
            for car in _adjacent(own["car"], len(state["cars"])):
                for loot_type in types:
                    loss = "（无战利品）" if loot_type == "none" else f"，使其掉落{LOOT[loot_type]['name']}"
                    label = f"👊 拳击 {_name(state, target)} 至{'车头' if car == 0 else str(car) + ' 号车厢'}{loss}"
                    if own["role"] == "cheyenne" and loot_type == "purse":
                        add(kind, label + "并拿走钱袋", target=target, car=car, loot_type=loot_type, steal=True)
                        add(kind, label + "到原处", target=target, car=car, loot_type=loot_type, steal=False)
                    else:
                        add(kind, label, target=target, car=car, loot_type=loot_type)
    if not actions:
        add("fizzle", f"{ACTIONS[kind]['emoji']} {ACTIONS[kind]['name']}落空，继续")
    return actions


def _activate_next(state: Dict) -> None:
    if state["execute_index"] >= len(state["program"]):
        state["active_card"] = None
        _end_round(state)
        return
    entry = state["program"][state["execute_index"]]
    entry["status"] = "active"
    state.update(active_card=copy.deepcopy(entry), current_turn=entry["player_id"], phase="execute")
    _log(state, f"{_name(state, entry['player_id'])} 执行 {ACTIONS[entry['kind']]['emoji']} {ACTIONS[entry['kind']]['name']}。", [entry["player_id"]])


def _execute(state: Dict, pid: str, action: Dict) -> None:
    own = state["players"][pid]
    kind = action["type"]
    if kind == "move":
        own["car"] = action["car"]
        _log(state, f"{_name(state, pid)} 移动到 {own['car']} 号车厢。", [pid])
    elif kind == "climb":
        own["level"] = "roof" if own["level"] == "inside" else "inside"
        _log(state, f"{_name(state, pid)} {'爬上车顶' if own['level'] == 'roof' else '进入车内'}。", [pid])
    elif kind == "marshal":
        state["marshal"] = action["car"]
        _log(state, f"{_name(state, pid)} 将警长移到 {state['marshal']} 号车厢。", [pid])
    elif kind == "rob":
        pool = state["cars"][own["car"]]["loot"][own["level"]]
        loot = next(token for token in pool if token["id"] == action["loot_id"])
        pool.remove(loot)
        own["loots"].append(loot)
        _log(state, f"{_name(state, pid)} 拿到{LOOT[loot['type']]['emoji']} {LOOT[loot['type']]['name']}。", [pid])
    elif kind == "shoot":
        target = action["target"]
        other = state["players"][target]
        own["bullets_left"] -= 1
        own["shots"] += 1
        _bullet(state, target, pid)
        _log(state, f"{_name(state, pid)} 射中 {_name(state, target)}，送出一张子弹。", [pid, target])
        if own["role"] == "django":
            direction = 1 if other["car"] > own["car"] else -1
            destination = other["car"] + direction
            if 0 <= destination < len(state["cars"]):
                other["car"] = destination
                _log(state, f"姜戈将 {_name(state, target)} 击退到 {destination} 号车厢。", [pid, target])
    elif kind == "punch":
        target = action["target"]
        other = state["players"][target]
        if action["loot_type"] != "none":
            loot = _rng(state).choice([token for token in other["loots"] if token["type"] == action["loot_type"]])
            other["loots"].remove(loot)
            if own["role"] == "cheyenne" and loot["type"] == "purse" and action["steal"]:
                own["loots"].append(loot)
                _log(state, f"夏延从 {_name(state, target)} 手中拿走一个钱袋。", [pid, target])
            else:
                state["cars"][other["car"]]["loot"][other["level"]].append(loot)
                _log(state, f"{_name(state, target)} 掉落{LOOT[loot['type']]['emoji']} {LOOT[loot['type']]['name']}。", [pid, target])
        other["car"] = action["car"]
        _log(state, f"{_name(state, pid)} 将 {_name(state, target)} 打到 {action['car']} 号车厢。", [pid, target])
    else:
        _log(state, f"{_name(state, pid)} 的{ACTIONS[state['active_card']['kind']]['name']}没有合法目标，行动落空。", [pid])
    _marshal_encounter(state)
    entry = state["program"][state["execute_index"]]
    entry["status"] = "done"
    own["discard"].append({"id": entry["card_id"], "kind": entry["kind"]})
    state["execute_index"] += 1
    _activate_next(state)


def _apply_event(state: Dict, event: str) -> None:
    _log(state, f"轮末事件：{EVENTS[event][0]}。")
    if event == "angry_marshal":
        targets = [pid for pid, p in state["players"].items() if p["car"] == state["marshal"] and p["level"] == "roof"]
        if _neutral_volley(state, targets):
            for pid in targets:
                _log(state, f"{_name(state, pid)} 被愤怒的警长射中。", [pid])
        state["marshal"] = min(len(state["cars"]) - 1, state["marshal"] + 1)
        _marshal_encounter(state)
    elif event == "braking":
        for pid, player in state["players"].items():
            if player["level"] == "roof":
                player["car"] = max(0, player["car"] - 1)
                _log(state, f"{_name(state, pid)} 被刹车惯性带到 {player['car']} 号车厢。", [pid])
    elif event == "swivel":
        for pid, player in state["players"].items():
            if player["level"] == "roof":
                player["car"] = len(state["cars"]) - 1
                _log(state, f"{_name(state, pid)} 被移到末节车顶。", [pid])
    elif event == "rebellion":
        targets = [pid for pid, p in state["players"].items() if p["level"] == "inside"]
        if _neutral_volley(state, targets):
            for pid in targets:
                _log(state, f"{_name(state, pid)} 遭到乘客反抗，收到中立子弹。", [pid])
    elif event == "take_it_all":
        if not state["second_strongbox"]:
            state["cars"][state["marshal"]]["loot"]["inside"].append(_new_loot(state, "strongbox", 1000))
            state["second_strongbox"] = True
    elif event == "pickpocket":
        state["event_pending"] = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            location = (player["car"], player["level"])
            occupants = [p for p in state["players"].values() if (p["car"], p["level"]) == location]
            pool = state["cars"][location[0]]["loot"][location[1]]
            if len(occupants) == 1 and any(loot["type"] == "purse" for loot in pool):
                state["event_pending"].append(pid)
    elif event == "revenge":
        for pid, player in state["players"].items():
            purses = [loot for loot in player["loots"] if loot["type"] == "purse"]
            if player["level"] == "roof" and player["car"] == state["marshal"] and purses:
                loot = min(purses, key=lambda token: token["value"])
                player["loots"].remove(loot)
                state["cars"][player["car"]]["loot"]["roof"].append(loot)
                _log(state, f"{_name(state, pid)} 因警长复仇将最低的钱袋掉落在车顶。", [pid])
    elif event == "hostage":
        for pid, player in state["players"].items():
            if player["car"] == 0:
                player["loots"].append(_new_loot(state, "purse", 250))
                _log(state, f"{_name(state, pid)} 劫持列车长获得 $250。", [pid])


def _end_round(state: Dict) -> None:
    event = _round_card(state)["event"]
    state["active_card"] = None
    _apply_event(state, event)
    if state["event_pending"]:
        state.update(phase="event", current_turn=state["event_pending"][0])
        return
    _build_round_summary(state)


def _build_round_summary(state: Dict) -> None:
    event = _round_card(state)["event"]
    state.update(phase="round_end", current_turn=None, next_ready=[])
    state["round_summary"] = {"round": state["round"], "event_name": EVENTS[event][0], "event_description": EVENTS[event][1],
        "entries": copy.deepcopy(state["round_log"]), "final": state["round"] == 5,
        "players": [{"player_id": pid, "loot_change": len(p["loots"]) - state["round_start"][pid]["loot"],
                     "bullets_change": p["bullets_received"] - state["round_start"][pid]["bullets"],
                     "shots_change": p["shots"] - state["round_start"][pid]["shots"]} for pid, p in state["players"].items()]}


def _score(state: Dict) -> None:
    maximum_shots = max(p["shots"] for p in state["players"].values())
    board = []
    for pid, player in state["players"].items():
        loot_total = sum(loot["value"] for loot in player["loots"])
        bonus = 1000 if player["shots"] == maximum_shots else 0
        board.append({"player_id": pid, "name": _name(state, pid), "loot_total": loot_total, "event_bonus": player["bonus_money"],
                      "shots": player["shots"], "shooter_bonus": bonus, "bullets_received": player["bullets_received"],
                      "total": loot_total + bonus + player["bonus_money"]})
    board.sort(key=lambda row: (-row["total"], row["bullets_received"]))
    best = (board[0]["total"], board[0]["bullets_received"])
    for row in board:
        row["winner"] = (row["total"], row["bullets_received"]) == best
    state.update(scoreboard=board, winner=[row["player_id"] for row in board if row["winner"]], game_over=True,
                 phase="game_over", current_turn=None)
    _log(state, "旅程结束，" + "、".join(_name(state, pid) for pid in state["winner"]) + " 赢得胜利！", state["winner"])


def _apply(state: Dict, pid: str, action: Dict) -> None:
    kind = action["type"]
    if kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["turn_order"]):
            if state["round"] == 5:
                _score(state)
            else:
                state["round"] += 1
                state["first_index"] = (state["first_index"] + 1) % len(state["turn_order"])
                _start_round(state)
        return
    if state["phase"] == "event":
        if kind == "event_loot":
            player = state["players"][pid]
            pool = state["cars"][player["car"]]["loot"][player["level"]]
            loot = next(token for token in pool if token["id"] == action["loot_id"])
            pool.remove(loot)
            player["loots"].append(loot)
            _log(state, f"{_name(state, pid)} 趁独处扒窃到一个钱袋。", [pid])
        else:
            _log(state, f"{_name(state, pid)} 放弃了扒窃机会。", [pid])
        state["event_pending"].pop(0)
        if state["event_pending"]:
            state["current_turn"] = state["event_pending"][0]
        else:
            _build_round_summary(state)
        return
    if state["phase"] == "execute":
        _execute(state, pid, action)
        return
    player = state["players"][pid]
    if kind == "play":
        card = next(c for c in player["hand"] if c["id"] == action["card_id"])
        player["hand"].remove(card)
        state["program"].append({"index": len(state["program"]), "player_id": pid, "card_id": card["id"],
                                 "kind": card["kind"], "hidden": action["hidden"], "status": "queued"})
        description = "一张隐藏行动" if action["hidden"] else ACTIONS[card["kind"]]["name"]
        _log(state, f"{_name(state, pid)} 策划了{description}。", [pid])
    else:
        count = min(3, len(player["deck"]))
        player["hand"].extend(player["deck"][:count])
        del player["deck"][:count]
        _log(state, f"{_name(state, pid)} 抽取 {count} 张牌。", [pid])
    player["ghost_available"] = False
    state["program_index"] += 1
    if state["program_index"] == len(state["schedule"]):
        for bandit in state["players"].values():
            bandit["deck"] = bandit["hand"] + bandit["deck"]
            bandit["hand"] = []
        state["execute_index"] = 0
        _activate_next(state)
    else:
        state["current_turn"] = state["schedule"][state["program_index"]]["player_id"]


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    """A deterministic policy using only the acting player's redacted view."""
    legal = view["legal_actions"]
    if not legal:
        return None
    if view["phase"] != "program":
        def execution_value(action: Dict) -> float:
            if action["type"] == "rob":
                for car in view["cars"]:
                    for tokens in car["loot"].values():
                        for loot in tokens:
                            if loot["id"] == action["loot_id"]:
                                return loot["value"] if loot["value"] is not None else 300
            if action["type"] == "punch":
                return {"strongbox": 1000, "gem": 500, "purse": 300, "none": 0}[action["loot_type"]]
            if action["type"] == "move":
                own = next(p for p in view["players"] if p["player_id"] == view["you"])
                return sum(100 if token["value"] is None else token["value"] for token in view["cars"][action["car"]]["loot"][own["level"]]) - action["car"]
            return 0
        return copy.deepcopy(max(legal, key=execution_value))
    own = next(p for p in view["players"] if p["player_id"] == view["you"])
    hand = {card["id"]: card for card in view["hand"]}
    local_loot = view["cars"][own["car"]]["loot"][own["level"]]
    used = [entry["kind"] for entry in view["program"] if entry["player_id"] == view["you"] and entry["kind"]]
    def program_value(action: Dict) -> float:
        if action["type"] == "draw":
            return 0 if len(hand) > 2 or own["deck_count"] == 0 else 6
        kind = hand[action["card_id"]]["kind"]
        weights = {"rob": 9 if local_loot else 2, "shoot": 6 if own["bullets_left"] else -2,
                   "move": 5, "climb": 4, "punch": 5, "marshal": 2}
        return weights[kind] - used.count(kind) * 4 + (0.1 if action.get("hidden") else 0)
    return copy.deepcopy(max(legal, key=program_value))


class ColtExpressGame:
    game_id = "colt_express"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config) or isinstance(config.get("seed"), bool):
            raise ValueError("Invalid Colt Express configuration.")
        if not 3 <= len(players) <= 6:
            raise ValueError("Colt Express needs 3–6 players.")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player.get("player_id") for player in ordered]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("Player IDs must be unique nonempty strings.")
        state = {"game_id": "colt_express", "version": 1, "config": copy.deepcopy(config), "game_token": secrets.token_hex(16),
                 "seed": config.get("seed", secrets.token_hex(16)), "rng_counter": 0, "window_id": 1, "revision": 0,
                 "turn_order": ids, "players": {}, "player_meta": {p["player_id"]: {**p, "name": str(p.get("name") or p["player_id"])} for p in ordered},
                 "round": 1, "cars": [], "marshal": 0, "neutral_bullets": 13, "bullet_serial": 0, "loot_serial": 0,
                 "second_strongbox": False, "lost_loot": [], "log": [], "round_log": [], "game_over": False, "winner": [], "scoreboard": []}
        rng = _rng(state)
        roles = rng.sample(list(ROLES), len(ids))
        state["first_index"] = rng.randrange(len(ids))
        cards = ROUND_CARDS["small" if len(ids) <= 4 else "large"]
        state["round_cards"] = copy.deepcopy(rng.sample(cards, 4) + [rng.choice(STATIONS)])
        # A shuffled finite purse pool prevents token IDs from encoding values.
        # Digital distribution: 8 x $250 and 2 each of $300/$350/$400/$450/$500.
        # The rulebook states 18 purses and the range, but not each frequency.
        # Remove the players' starting purses before drawing train loot.
        purses = [250] * (8 - len(ids)) + [value for value in (300, 350, 400, 450, 500) for _ in range(2)]
        rng.shuffle(purses)
        layouts = list(CAR_LAYOUTS)
        rng.shuffle(layouts)
        state["cars"].append({"index": 0, "name": "车头", "loot": {"inside": [_new_loot(state, "strongbox", 1000)], "roof": []}})
        for index, (purse_count, gem_count) in enumerate(layouts[:len(ids)], start=1):
            tokens = [_new_loot(state, "purse", purses.pop()) for _ in range(purse_count)]
            tokens.extend(_new_loot(state, "gem", 500) for _ in range(gem_count))
            state["cars"].append({"index": index, "name": f"{index} 号车厢", "loot": {"inside": tokens, "roof": []}})
        for seat, (pid, role) in enumerate(zip(ids, roles)):
            offset = (seat - state["first_index"]) % len(ids)
            deck = [{"id": f"{seat}_{kind}_{number}", "kind": kind} for kind, info in ACTIONS.items() for number in range(info["count"])]
            state["players"][pid] = {"role": role, "car": len(ids) - (offset % 2), "level": "inside",
                                      "hand": [], "deck": deck, "discard": [], "loots": [_new_loot(state, "purse", 250)],
                                      "bullets_left": 6, "bullets_received": 0, "shots": 0, "bonus_money": 0}
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[Dict]:
        return _legal(state, player_id)

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if any(type(action[key]) is not int for key in ("window_id", "car") if key in action):
            return [], "Action numbers must be integers."
        if action["game_token"] != state["game_token"] or action["window_id"] != state["window_id"]:
            return [], "This action belongs to an old game or window."
        canonical = {key: value for key, value in action.items() if key != "label"}
        options = _legal(state, player_id)
        if canonical not in [{key: value for key, value in legal.items() if key != "label"} for legal in options]:
            return [], "Action unavailable or illegal target."
        candidate = copy.deepcopy(state)
        _apply(candidate, player_id, action)
        candidate["revision"] += 1
        # Readiness uses one shared window, so several players may acknowledge
        # the same rendered summary without invalidating each other's clicks.
        if action["type"] != "next_round" or candidate["phase"] != "round_end":
            candidate["window_id"] += 1
        state.clear()
        state.update(candidate)
        return [{"type": "colt_express:updated", "payload": {"player_id": player_id}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id, {})
        final = state["game_over"]
        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            role = ROLES[player["role"]]
            players.append({"player_id": pid, "name": _name(state, pid), "seat": state["player_meta"][pid].get("seat", 0),
                "role": player["role"], "role_name": role["name"], "emoji": role["emoji"], "color": role["color"], "ability": role["ability"],
                "car": player["car"], "level": player["level"], "hand_count": len(player["hand"]), "deck_count": len(player["deck"]),
                "bullets_left": player["bullets_left"], "bullets_received": player["bullets_received"], "shots": player["shots"],
                "loot_count": len(player["loots"]), "loots": [_loot_view(loot, pid == viewer_id or final) for loot in player["loots"]],
                "score": sum(loot["value"] for loot in player["loots"]) + player["bonus_money"] if final or pid == viewer_id else None})
        program = []
        for entry in state["program"]:
            hidden = entry["hidden"] and entry["status"] == "queued"
            kind = None if hidden else entry["kind"]
            program.append({"index": entry["index"], "player_id": entry["player_id"], "hidden": hidden,
                            "kind": kind, "name": "隐藏行动" if hidden else ACTIONS[kind]["name"],
                            "emoji": "🂠" if hidden else ACTIONS[kind]["emoji"], "status": entry["status"]})
        slot = state["schedule"][state["program_index"]] if state["phase"] == "program" else None
        hand = [{"id": card["id"], "kind": card["kind"], "name": "子弹" if card["kind"] == "bullet" else ACTIONS[card["kind"]]["name"],
                 "emoji": "🔫" if card["kind"] == "bullet" else ACTIONS[card["kind"]]["emoji"], "bullet": card["kind"] == "bullet"}
                for card in own.get("hand", [])]
        view = {"game_id": "colt_express", "you": viewer_id, "game_token": state["game_token"], "window_id": state["window_id"],
                "revision": state["revision"], "phase": state["phase"], "round": state["round"], "total_rounds": 5,
                "current_turn": state["current_turn"], "players": players, "marshal": state["marshal"], "neutral_bullets": state["neutral_bullets"],
                "hand": hand, "loots": [_loot_view(loot, True) for loot in own.get("loots", [])],
                "role_info": ROLES.get(own.get("role")), "program": program,
                "active_card": program[state["execute_index"]] if state["active_card"] else None,
                "round_card": _round_card(state), "program_turn": slot["turn"] if slot else None,
                "turn_kind": slot["kind"] if slot else None, "program_actions_left": (2 - slot["sub"] if slot["kind"] == "double" else 1) if slot else 0,
                "round_summary": state["round_summary"], "next_ready": state["next_ready"], "event_pending": state["event_pending"], "game_over": final,
                "winner": state["winner"], "scoreboard": state["scoreboard"], "log": state["log"], "legal_actions": _legal(state, viewer_id),
                "cars": [{"index": car["index"], "name": car["name"], "loot": {level: [_loot_view(loot, final) for loot in tokens]
                          for level, tokens in car["loot"].items()}} for car in state["cars"]]}
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        return _choose_bot_action(ColtExpressGame.get_public_view(state, player_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            state = copy.deepcopy(payload)
            if state["game_id"] != "colt_express" or state["version"] != 1:
                raise ValueError("Unsupported Colt Express save.")
            ids = state["turn_order"]
            if not isinstance(state["game_token"], str) or not state["game_token"] or not _CONFIG_VALIDATOR.is_valid(state["config"]) or isinstance(state["config"].get("seed"), bool):
                raise ValueError("Invalid saved game identity or configuration.")
            if not 3 <= len(ids) <= 6 or len(set(ids)) != len(ids) or set(ids) != set(state["players"]) or set(ids) != set(state["player_meta"]):
                raise ValueError("Invalid saved players.")
            if state["phase"] not in ("program", "execute", "event", "round_end", "game_over") or state["game_over"] != (state["phase"] == "game_over"):
                raise ValueError("Invalid saved phase.")
            if type(state["round"]) is not int or not 1 <= state["round"] <= 5 or len(state["round_cards"]) != 5 or len(state["cars"]) != len(ids) + 1:
                raise ValueError("Invalid saved round or train.")
            if len({p["role"] for p in state["players"].values()}) != len(ids):
                raise ValueError("Duplicate saved characters.")
            for key in ("window_id", "revision", "rng_counter", "bullet_serial", "loot_serial", "neutral_bullets"):
                if type(state[key]) is not int or state[key] < 0:
                    raise ValueError("Invalid saved counter.")
            if len(set(state["next_ready"])) != len(state["next_ready"]) or not set(state["next_ready"]) <= set(ids):
                raise ValueError("Invalid saved readiness.")
            if state["phase"] == "round_end" and len(state["next_ready"]) == len(ids):
                raise ValueError("Completed readiness cannot remain at round end.")
            if len(set(state["event_pending"])) != len(state["event_pending"]) or not set(state["event_pending"]) <= set(ids):
                raise ValueError("Invalid saved event queue.")
            if state["phase"] == "event":
                if not state["event_pending"] or state["current_turn"] != state["event_pending"][0] or state["active_card"] is not None or _round_card(state)["event"] != "pickpocket":
                    raise ValueError("Invalid active event.")
            elif state["event_pending"]:
                raise ValueError("Unexpected saved event queue.")
            if type(state["marshal"]) is not int or not 0 <= state["marshal"] < len(state["cars"]):
                raise ValueError("Invalid saved marshal.")
            if type(state["first_index"]) is not int or not 0 <= state["first_index"] < len(ids):
                raise ValueError("Invalid saved first player.")
            if type(state["program_index"]) is not int or type(state["execute_index"]) is not int:
                raise ValueError("Invalid saved action progress.")
            if not 0 <= state["program_index"] <= len(state["schedule"]) or not 0 <= state["execute_index"] <= len(state["program"]):
                raise ValueError("Invalid saved action progress.")
            for card in state["round_cards"]:
                if card["event"] not in EVENTS or not card["turns"] or any(turn not in ("normal", "tunnel", "double", "reverse") for turn in card["turns"]):
                    raise ValueError("Invalid saved round card.")
            for index, entry in enumerate(state["program"]):
                if entry["index"] != index or entry["player_id"] not in ids or entry["kind"] not in ACTIONS or type(entry["hidden"]) is not bool or entry["status"] not in ("queued", "active", "done"):
                    raise ValueError("Invalid saved program.")
            all_loot = list(state["lost_loot"])
            for index, car in enumerate(state["cars"]):
                if car["index"] != index or set(car["loot"]) != {"inside", "roof"}:
                    raise ValueError("Invalid saved train car.")
                for tokens in car["loot"].values():
                    all_loot.extend(tokens)
            for pid, player in state["players"].items():
                if player["role"] not in ROLES or player["level"] not in ("inside", "roof") or type(player["car"]) is not int or not 0 <= player["car"] < len(state["cars"]):
                    raise ValueError("Invalid saved player position.")
                if any(type(player[key]) is not int or player[key] < 0 for key in ("bullets_left", "shots", "bullets_received", "bonus_money")):
                    raise ValueError("Invalid saved player counter.")
                if player["bullets_left"] + player["shots"] != 6 or not 0 <= player["shots"] <= 6:
                    raise ValueError("Invalid saved ammunition.")
                cards = player["hand"] + player["deck"] + player["discard"]
                if any(card["kind"] not in ACTIONS and card["kind"] != "bullet" for card in cards):
                    raise ValueError("Invalid saved card type.")
                pending = [entry for entry in state["program"] if entry["player_id"] == pid and entry["status"] != "done"]
                card_ids = [card["id"] for card in cards] + [entry["card_id"] for entry in pending]
                if len(card_ids) != len(set(card_ids)) or sum(card["kind"] != "bullet" for card in cards) + len(pending) != 10:
                    raise ValueError("Invalid saved action cards.")
                for kind, info in ACTIONS.items():
                    if sum(card["kind"] == kind for card in cards) + sum(entry["kind"] == kind for entry in pending) != info["count"]:
                        raise ValueError("Invalid saved action card distribution.")
                if any(card.get("source") not in ids + ["marshal"] for card in cards if card["kind"] == "bullet"):
                    raise ValueError("Invalid saved bullet source.")
                if sum(card["kind"] == "bullet" for card in cards) != player["bullets_received"]:
                    raise ValueError("Invalid saved bullet cards.")
                all_loot.extend(player["loots"])
            for token in all_loot:
                if token["type"] not in LOOT or type(token["value"]) is not int or token["value"] not in {"purse": (250, 300, 350, 400, 450, 500), "gem": (500,), "strongbox": (1000,)}[token["type"]]:
                    raise ValueError("Invalid saved loot.")
            loot_ids = [token["id"] for token in all_loot]
            if len(loot_ids) != len(set(loot_ids)):
                raise ValueError("Duplicate saved loot.")
            if state["phase"] == "program":
                if state["schedule"] != _turn_sequence(state) or state["current_turn"] != state["schedule"][state["program_index"]]["player_id"]:
                    raise ValueError("Invalid saved programming order.")
            if state["phase"] == "execute":
                entry = state["program"][state["execute_index"]]
                if state["active_card"] != entry or entry["status"] != "active" or state["current_turn"] != entry["player_id"]:
                    raise ValueError("Invalid active action.")
            for pid in ids:
                ColtExpressGame.get_public_view(state, pid)
            return state
        except (KeyError, TypeError, IndexError, AttributeError) as exc:
            raise ValueError("Invalid Colt Express save.") from exc
