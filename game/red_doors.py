"""Red Doors: server-owned hidden information and a replayable base-set game."""

import copy
import random
import secrets
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.red_doors_data import ACTION_SCHEMA, CARD_DEFS, CONFIG_SCHEMA, ITEMS, KEYS, RULES_VERSION

_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _log(state: Dict, message: str) -> None:
    if len(state["log"]) == 80:
        state["turn_log_start"] = max(0, state["turn_log_start"] - 1)
    state["log"] = (state["log"] + [message])[-80:]


def _name(state: Dict, pid: str) -> str:
    return state["players"][pid]["name"]


def _held(state: Dict, pid: Optional[str] = None) -> List[Dict]:
    return [card for card in state["cards"].values()
            if card["zone"] == "held" and (pid is None or card["owner"] == pid)]


def _board(state: Dict) -> List[Dict]:
    return sorted((c for c in state["cards"].values() if c["zone"] == "board"), key=lambda c: c["slot"])


def _key_count(state: Dict) -> int:
    return sum(c["kind"] in KEYS for c in _held(state))


def _shuffle(state: Dict) -> None:
    cards = _board(state)
    random.Random(f"{state['seed']}:{state['shuffle_count']}").shuffle(cards)
    state["shuffle_count"] += 1
    state["board_epoch"] += 1
    for index, card in enumerate(cards):
        # Neither the internal card ID nor its old public ID survives a shuffle.
        card.update(ref=f"d{state['board_epoch']}-{index + 1}", slot=index + 1, faceup=False)
    state["knowledge"] = {pid: {} for pid in state["turn_order"]}


def _return_inventory(state: Dict, pid: str) -> None:
    for card in _held(state, pid):
        card.update(zone="board", owner=None, faceup=False)


def _damage(state: Dict, pid: str) -> None:
    vest = next((c for c in _held(state, pid) if c["kind"] == "vest"), None)
    if vest:
        vest.update(zone="removed", owner=None, faceup=True)
        _log(state, f"🦺 {_name(state, pid)} 的防弹背心挡下伤害并移除，其他持有物回场。")
    else:
        state["players"][pid]["alive"] = False
        _log(state, f"☠️ {_name(state, pid)} 死亡，持有物回场。")
    _return_inventory(state, pid)


def _review(state: Dict, ending: Optional[str] = None, winners: Optional[List[str]] = None) -> None:
    state["review_counter"] += 1
    state["review_id"] = f"r{state['round']}-v{state['review_counter']}"
    state["ready"] = []
    state["pending"] = None
    state["phase"] = "round_end" if ending else "public_review"
    state["review_notes"] = state["log"][state["turn_log_start"]:]
    if ending:
        state["ending_reason"] = ending
        state["winner"] = winners or []
        state["next_mode"] = "again"


def _check_ending(state: Dict) -> bool:
    alive = [pid for pid in state["turn_order"] if state["players"][pid]["alive"]]
    if not alive:
        _log(state, "🏁 无人生还，无人获胜。")
        _review(state, "all_dead", [])
        return True
    if len(alive) == 1 and state["players"][alive[0]]["killer"]:
        _log(state, f"🏁 {_name(state, alive[0])} 成为唯一生还的杀人鬼。")
        _review(state, "sole_killer", alive)
        return True
    return False


def _advance(state: Dict) -> None:
    if _check_ending(state):
        return
    order = state["turn_order"]
    index = order.index(state["current_turn"])
    state["current_turn"] = next(order[(index + step) % len(order)] for step in range(1, len(order) + 1)
                                 if state["players"][order[(index + step) % len(order)]]["alive"])
    state.update(phase="choose_door", pending=None, ready=[], review_id=None)
    state["turn_id"] += 1


def _public_consequence(state: Dict) -> None:
    if not _check_ending(state):
        _review(state)


def _start_round(state: Dict) -> None:
    cards = {}
    for kind, spec in CARD_DEFS.items():
        for index in range(spec["count"]):
            cards[f"{kind}:{index}"] = {"kind": kind, "zone": "board", "owner": None,
                                         "faceup": False, "slot": len(cards) + 1, "ref": ""}
    for player in state["players"].values():
        player.update(alive=True, killer=False, exposed=False)
    state.update(cards=cards, phase="choose_door", current_turn=state["turn_order"][0],
                 pending=None, ready=[], review_id=None, review_notes=[], next_mode="again",
                 ending_reason=None, winner=[], game_over=False, log=[], turn_log_start=0)
    _shuffle(state)
    _log(state, f"🚪 第 {state['round']} 局开始。16 张基础牌，首席先行动。")


def _targets(state: Dict) -> List[Dict]:
    pending = state["pending"]
    if not pending:
        return []
    pid, kind = state["current_turn"], state["cards"][pending["card"]]["kind"]
    if kind == "inspect":
        return [{"target_id": c["ref"], "player_id": c["owner"], "label": f"{_name(state, c['owner'])} · 暗钥匙 {i + 1}"}
                for i, c in enumerate(_held(state)) if c["owner"] != pid and c["kind"] in KEYS and not c["faceup"]]
    if kind == "ammo":
        if not any(c["kind"] == "gun" for c in _held(state, pid)):
            return []
        return [{"target_id": other, "player_id": other, "label": _name(state, other)}
                for other in state["turn_order"] if state["players"][other]["alive"]]
    if kind == "clue":
        return [{"target_id": c["ref"], "label": f"门 {c['slot']:02d}"} for c in _board(state)
                if not c["faceup"] and c is not state["cards"][pending["card"]]]
    return []


def _choices(state: Dict) -> List[str]:
    kind = state["cards"][state["pending"]["card"]]["kind"]
    killer = state["players"][state["current_turn"]]["killer"]
    if kind == "empty":
        return ["return"]
    if kind == "exit":
        return ["return"] + (["escape"] if _key_count(state) == 3 else [])
    if kind in ("inspect", "ammo"):
        return ["return"] + (["use"] if _targets(state) else [])
    return ["use"] + (["return"] if killer else [])


def _resolve(state: Dict, choice: str) -> None:
    pid = state["current_turn"]
    card = state["cards"][state["pending"]["card"]]
    kind = card["kind"]
    if choice == "return":
        _log(state, f"{_name(state, pid)} 将门牌暗置放回，声称是空房。")
        _advance(state)
    elif choice == "escape":
        card["faceup"] = True
        keys = [c for c in _held(state) if c["kind"] in KEYS]
        for key in keys:
            key["faceup"] = True
        failed = any(c["kind"] == "killer_key" for c in keys)
        winners = [p for p in state["turn_order"] if state["players"][p]["killer"] == failed]
        _log(state, "🚪✨ 逃脱失败：钥匙中藏着杀人鬼的钥匙！" if failed else "🚪✨ 三把银钥匙，逃脱成功！")
        _review(state, "tainted_escape" if failed else "silver_escape", winners)
    elif kind in KEYS + ITEMS:
        card.update(zone="held", owner=pid, faceup=kind in ITEMS)
        if kind == "killer_key":
            state["players"][pid]["killer"] = True
        for memory in state["knowledge"].values():
            memory.pop(card["ref"], None)
        label = "一把暗钥匙" if kind in KEYS else f"{CARD_DEFS[kind]['icon']} {CARD_DEFS[kind]['name']}"
        _log(state, f"{_name(state, pid)} 取得{label}。")
        if _key_count(state) == 4:
            for key in _held(state):
                if key["kind"] in KEYS:
                    key.update(zone="removed" if key["kind"] == "killer_key" else "board", owner=None, faceup=False)
            _shuffle(state)
            _log(state, "🌀 第四把钥匙出现：匿名回收全部钥匙，移除杀人鬼钥匙，其余钥匙回场；迷宫重排。")
            _public_consequence(state)
        else:
            _advance(state)
    elif kind in ("trap", "gas"):
        card["faceup"] = True
        _log(state, f"{_name(state, pid)} 公开 {CARD_DEFS[kind]['icon']} {CARD_DEFS[kind]['name']}。")
        if kind == "trap":
            _damage(state, pid)
        else:
            card.update(zone="removed", owner=None)
            _return_inventory(state, pid)
        _shuffle(state)
        _log(state, "🌀 迷宫重排，旧门号与私人记忆失效。")
        _public_consequence(state)
    else:
        card["faceup"] = True
        _log(state, f"{_name(state, pid)} 公开 {CARD_DEFS[kind]['icon']} {CARD_DEFS[kind]['name']}。")
        state["pending"]["public"] = True
        state["phase"] = "choose_target"
        if not _targets(state):
            _log(state, "没有可用目标。")
            _advance(state)


def _target(state: Dict, target_id: str) -> None:
    pid = state["current_turn"]
    pending = state["pending"]
    kind = state["cards"][pending["card"]]["kind"]
    if kind == "ammo":
        _log(state, f"🔫 {_name(state, pid)} 射击 {_name(state, target_id)}。")
        _damage(state, target_id)
        _shuffle(state)
        _log(state, "🌀 子弹房间与场地牌重洗；射击者的手枪仍保留，除非它也因命中回场。")
        _public_consequence(state)
        return
    card = next(c for c in state["cards"].values() if c["ref"] == target_id)
    if kind == "inspect":
        card["faceup"] = True
        owner = card["owner"]
        _log(state, f"👁️ {_name(state, owner)} 的钥匙被公开：{CARD_DEFS[card['kind']]['name']}。")
        if card["kind"] == "killer_key":
            state["players"][owner]["exposed"] = True
            card.update(zone="removed", owner=None)
            _log(state, "杀人鬼钥匙移除；已成为杀人鬼的身份不会解除。")
        _public_consequence(state)
    else:
        state["knowledge"][pid][card["ref"]] = card["kind"]
        pending["result"] = {"door_id": card["ref"], "slot": card["slot"], "kind": card["kind"]}
        state["phase"] = "private_result"


class RedDoorsGame:
    game_id = "red_doors"
    min_players = 4
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Red Doors configuration")
        if "seed" in config and type(config["seed"]) not in (int, str):
            raise ValueError("seed must be an integer or string")
        if not 4 <= len(players) <= 6:
            raise ValueError("Red Doors base rules require 4–6 players")
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p.get("player_id") for p in ordered]
        if any(not isinstance(p, str) or not p for p in ids) or len(ids) != len(set(ids)):
            raise ValueError("player IDs must be unique nonempty strings")
        state = {"game_id": "red_doors", "schema_version": 1, "rules_version": RULES_VERSION,
                 "config": {}, "seed": config.get("seed", secrets.token_hex(24)), "shuffle_count": 0,
                 "board_epoch": 0, "turn_order": ids, "round": 1, "turn_id": 1,
                 "effect_counter": 0, "review_counter": 0,
                 "players": {p["player_id"]: {"name": p.get("name", p["player_id"]), "seat": i,
                                              "is_bot": bool(p.get("is_bot", False))} for i, p in enumerate(ordered)}}
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase = state["phase"]
        if phase == "round_end":
            return ["set_next_mode"] + ([] if player_id in state["ready"] else ["next_round"])
        if phase == "public_review":
            return [] if player_id in state["ready"] else ["ack_review"]
        if state["current_turn"] != player_id or not state["players"][player_id]["alive"]:
            return []
        return {"choose_door": ["open_door"], "resolve_door": ["resolve_door"],
                "choose_target": ["choose_target"], "private_result": ["ack_private"]}.get(phase, [])

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid Red Doors action"
        kind = action["type"]
        if kind not in RedDoorsGame.get_legal_actions(state, player_id):
            return [], "This action is not available now"
        if "review_id" in action and action["review_id"] != state["review_id"]:
            return [], "This review has expired"
        if "effect_id" in action and action["effect_id"] != state["pending"]["id"]:
            return [], "This effect has expired"
        if kind == "open_door":
            if (type(action["turn_id"]) is not int or type(action["board_epoch"]) is not int
                    or action["turn_id"] != state["turn_id"] or action["board_epoch"] != state["board_epoch"]):
                return [], "The turn or maze has changed"
            if not any(c["ref"] == action["door_id"] and not c["faceup"] for c in _board(state)):
                return [], "Choose a face-down door in the current maze"
        if kind == "resolve_door" and action["choice"] not in _choices(state):
            return [], "That choice is not allowed for this card"
        if kind == "choose_target" and action["target_id"] not in [t["target_id"] for t in _targets(state)]:
            return [], "Choose a valid target"
        # Work on a copy so no failed/stale request can partially move hidden cards.
        work = copy.deepcopy(state)
        if kind == "open_door":
            cid, card = next((cid, c) for cid, c in work["cards"].items() if c["ref"] == action["door_id"])
            work["turn_log_start"] = len(work["log"])
            work["effect_counter"] += 1
            work["pending"] = {"id": f"e{work['effect_counter']}", "card": cid, "public": False}
            work["knowledge"][player_id][card["ref"]] = card["kind"]
            work["phase"] = "resolve_door"
            _log(work, f"{_name(work, player_id)} 打开门 {card['slot']:02d}，正在私下查看。")
        elif kind == "resolve_door":
            _resolve(work, action["choice"])
        elif kind == "choose_target":
            _target(work, action["target_id"])
        elif kind == "ack_private":
            _advance(work)
        elif kind == "set_next_mode":
            if action["mode"] != work["next_mode"]:
                work["next_mode"] = action["mode"]
                work["ready"] = []
                work["review_counter"] += 1
                work["review_id"] = f"r{work['round']}-v{work['review_counter']}"
        elif kind in ("next_round", "ack_review"):
            work["ready"].append(player_id)
            if len(work["ready"]) == len(work["turn_order"]):
                if kind == "ack_review":
                    _advance(work)
                elif work["next_mode"] == "finish":
                    work.update(phase="game_over", game_over=True)
                else:
                    work["round"] += 1
                    work["turn_id"] += 1
                    _start_round(work)
        state.clear()
        state.update(work)
        return [{"type": "red_doors:update", "payload": {"actor": player_id}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        finished = state["phase"] in ("round_end", "game_over")
        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            players.append({"player_id": pid, **{k: player[k] for k in ("name", "seat", "is_bot", "alive")},
                            "role": ("killer" if player["killer"] else "civilian") if finished or pid == viewer_id
                                    else ("killer" if player["exposed"] else None),
                            "exposed": player["exposed"],
                            "inventory": [{"id": c["ref"], "faceup": c["faceup"],
                                           "kind": c["kind"] if finished or pid == viewer_id or c["faceup"] else None}
                                          for c in _held(state, pid)]})
        pending = state["pending"]
        own_effect = pending and state["current_turn"] == viewer_id
        phase = state["phase"]
        if pending and not own_effect:
            phase = "resolving"
        private = None
        if own_effect:
            card = state["cards"][pending["card"]]
            private = {"effect_id": pending["id"], "kind": card["kind"], "door_id": card["ref"],
                       "choices": _choices(state) if phase == "resolve_door" else [],
                       "targets": _targets(state) if phase == "choose_target" else [],
                       "result": copy.deepcopy(pending.get("result"))}
        view = {"game_id": "red_doors", "you": viewer_id, "round": state["round"], "phase": phase,
                "rules_version": RULES_VERSION, "current_turn": state["current_turn"], "turn_id": state["turn_id"],
                "board_epoch": state["board_epoch"], "players": players, "card_defs": copy.deepcopy(CARD_DEFS),
                "doors": [{"door_id": c["ref"], "slot": c["slot"], "faceup": c["faceup"],
                           "kind": c["kind"] if finished or c["faceup"] else None,
                           "known_kind": state["knowledge"].get(viewer_id, {}).get(c["ref"])} for c in _board(state)],
                "removed": dict(Counter(c["kind"] for c in state["cards"].values() if c["zone"] == "removed")),
                "held_key_count": _key_count(state), "private": private,
                "public_effect": state["cards"][pending["card"]]["kind"] if pending and pending["public"] else None,
                "review_id": state["review_id"], "ready": list(state["ready"]), "next_mode": state["next_mode"],
                "review_notes": list(state["review_notes"]), "ending_reason": state["ending_reason"],
                "winner": list(state["winner"]), "game_over": state["game_over"], "log": list(state["log"]),
                "legal_actions": RedDoorsGame.get_legal_actions(state, viewer_id)}
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _bot_from_view(RedDoorsGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        try:
            assert state["schema_version"] == 1 and state["rules_version"] == RULES_VERSION
            assert state["game_id"] == "red_doors"
            assert 4 <= len(state["turn_order"]) <= 6
            assert len(state["turn_order"]) == len(set(state["turn_order"])) == len(state["players"])
            assert set(state["turn_order"]) == set(state["players"])
            assert Counter(c["kind"] for c in state["cards"].values()) == Counter({k: v["count"] for k, v in CARD_DEFS.items()})
            assert len({c["ref"] for c in state["cards"].values()}) == 16
            for card in state["cards"].values():
                assert card["zone"] in ("board", "held", "removed")
                assert (card["owner"] in state["players"]) if card["zone"] == "held" else card["owner"] is None
                assert card["zone"] != "held" or card["kind"] in KEYS + ITEMS
            assert state["phase"] in ("choose_door", "resolve_door", "choose_target", "private_result", "public_review", "round_end", "game_over")
            assert state["current_turn"] in state["players"]
            assert len(state["ready"]) == len(set(state["ready"])) and set(state["ready"]) <= set(state["players"])
            if state["phase"] in ("resolve_door", "choose_target", "private_result"):
                assert state["cards"][state["pending"]["card"]]["zone"] == "board"
            else:
                assert state["pending"] is None
        except (AssertionError, KeyError, TypeError, AttributeError) as exc:
            raise ValueError("Invalid Red Doors save") from exc
        return state


def _bot_from_view(view: Dict) -> Optional[Dict]:
    """The strategy accepts ONLY the same information a human client receives."""
    legal = view["legal_actions"]
    own = next((p for p in view["players"] if p["player_id"] == view["you"]), None)
    for kind in ("next_round", "ack_review"):
        if kind in legal:
            return {"type": kind, "review_id": view["review_id"]}
    if "ack_private" in legal:
        return {"type": "ack_private", "effect_id": view["private"]["effect_id"]}
    if "resolve_door" in legal:
        private = view["private"]
        choices = private["choices"]
        choice = "escape" if "escape" in choices else "use" if "use" in choices else "return"
        if own["role"] == "killer" and private["kind"] in ("trap", "gas"):
            choice = "return"
        return {"type": "resolve_door", "choice": choice, "effect_id": private["effect_id"]}
    if "choose_target" in legal:
        private = view["private"]
        targets = private["targets"]
        if private["kind"] == "ammo":
            others = [t for t in targets if t["player_id"] != view["you"]]
            def priority(target):
                player = next(p for p in view["players"] if p["player_id"] == target["player_id"])
                return (player["role"] == "killer", not any(c["kind"] == "vest" for c in player["inventory"]))
            target = max(others or targets, key=priority)
        elif private["kind"] == "clue":
            known = {d["door_id"] for d in view["doors"] if d["known_kind"]}
            target = next((t for t in targets if t["target_id"] not in known), targets[0])
        else:
            target = targets[0]
        return {"type": "choose_target", "target_id": target["target_id"], "effect_id": private["effect_id"]}
    if "open_door" in legal:
        gun = any(c["kind"] == "gun" for c in own["inventory"])
        doors = [d for d in view["doors"] if not d["faceup"]]
        def priority(door):
            kind = door["known_kind"]
            if kind == "exit" and view["held_key_count"] == 3:
                return 100
            if kind == "ammo" and gun:
                return 90
            if kind in KEYS or kind in ITEMS:
                return 80
            if kind is None:
                return 70
            if kind == "clue":
                return 60
            if kind == "inspect" and any(p["player_id"] != view["you"] and any(not c["faceup"] for c in p["inventory"]) for p in view["players"]):
                return 50
            if kind == "gas":
                return 40
            if kind == "trap" and own["role"] != "killer":
                return 30
            return 0
        door = max(doors, key=priority)
        return {"type": "open_door", "door_id": door["door_id"], "board_epoch": view["board_epoch"], "turn_id": view["turn_id"]}
    return None
