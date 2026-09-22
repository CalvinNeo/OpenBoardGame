"""Cheaty Mages, classic 72-card edition; authoritative private-information game."""

import copy
import itertools
import random
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.cheaty_mages_data import FIGHTERS, JUDGES, SPELLS


CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}
_PROPERTIES = {
    "type": {"enum": ["bet", "cast", "peek", "pass", "discard", "next_round"]},
    "round": {"type": "integer", "minimum": 1},
    "turn": {"type": "integer", "minimum": 1},
    "card_id": {"type": "string"}, "spell_id": {"type": "string"},
    "player_id": {"type": "string"},
    "target": {"type": "integer", "minimum": 1, "maximum": 5},
    "from_slot": {"type": "integer", "minimum": 1, "maximum": 5},
    "to_slot": {"type": "integer", "minimum": 1, "maximum": 5},
    "slots": {"type": "array", "minItems": 1, "maxItems": 3, "uniqueItems": True,
              "items": {"type": "integer", "minimum": 1, "maximum": 5}},
    "cards": {"type": "array", "uniqueItems": True, "items": {"type": "string"}},
    "bribe": {"const": True},
    "face_down": {"const": True},
}
ACTION_SCHEMA = {"type": "object", "properties": _PROPERTIES,
                 "required": ["type", "round"], "additionalProperties": False}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "turn": state["turn"], "text": text})
    del state["log"][:-100]


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid].get("name") or pid


def _build_deck() -> List[Dict]:
    return [dict(copy.deepcopy(card), key=key, id=f"{key}-{i + 1}")
            for key, card in SPELLS.items() for i in range(card["count"])]


def _draw(state: Dict) -> Optional[Dict]:
    if not state["deck"] and state["discard"]:
        state["deck"], state["discard"] = state["discard"], []
        random.shuffle(state["deck"])
    return state["deck"].pop() if state["deck"] else None


def _new_judge(state: Dict) -> None:
    if not state["judge_deck"]:
        state["judge_deck"], state["judge_discard"] = state["judge_discard"], []
        random.shuffle(state["judge_deck"])
    state["judge"] = copy.deepcopy(JUDGES[state["judge_deck"].pop()])


def _all_entries(state: Dict) -> List[Dict]:
    return [entry for fighter in state["fighters"] for entry in fighter["spells"]] + state["effects"]


def _effect(state: Dict, key: str, pid: Optional[str] = None) -> bool:
    return any(entry["card"]["effect"] == key and (pid is None or entry["owner"] == pid)
               for entry in state["effects"])


def _blocked(fighter: Dict) -> bool:
    return any(entry["card"]["effect"] == "reflection" for entry in fighter["spells"])


def _remove_entry(state: Dict, entry: Dict) -> None:
    for group in [fighter["spells"] for fighter in state["fighters"]] + [state["effects"]]:
        if entry in group:
            group.remove(entry)
            state["discard"].append(entry["card"])
            return


def _cleanup_arena(state: Dict) -> None:
    state["discard"].extend(entry["card"] for entry in _all_entries(state))
    for fighter in state["fighters"]:
        fighter["spells"] = []
    state["effects"] = []
    state["judge_discard"].append(state["judge"]["id"])


def _start_round(state: Dict, starter: str) -> None:
    fighters = list(FIGHTERS)
    random.shuffle(fighters)
    state["fighters"] = [dict(copy.deepcopy(FIGHTERS[fighters.pop()]), slot=slot, spells=[])
                         for slot in range(1, 6)]
    state["fighter_deck"] = fighters
    state["fighter_discard"] = []
    _new_judge(state)
    for player in state["players"].values():
        player.update(bets=None, passed=False, known=[], refill_done=False)
    state.update(phase="betting", current_turn=starter, start_player=starter,
                 next_ready=[], round_summary=None, pending_discard=None)
    _log(state, f"第 {state['round']} 场开始，裁判：{state['judge']['name_zh']}。")


def _clockwise(state: Dict, pid: str) -> List[str]:
    order = state["turn_order"]
    start = order.index(pid)
    return [order[(start + offset) % len(order)] for offset in range(1, len(order) + 1)]


def _entry(state: Dict, pid: str, card: Dict, **kwargs) -> Dict:
    state["spell_serial"] += 1
    return dict(id=f"s{state['spell_serial']}", owner=pid, card=card, hidden=False,
                attachments=[], **kwargs)


def _card_permit(state: Dict, pid: str, card: Dict) -> Optional[Dict]:
    bans = state["judge"]["bans"]
    banned = card["kind"] in bans or (card["forbidden"] and "forbidden" in bans)
    if not banned or _effect(state, "invisibility", pid):
        return {}
    if state["round"] == state["total_rounds"] and state["players"][pid]["coins"] >= 2:
        return {"bribe": True}
    return None


def _spell_targets(state: Dict) -> List[Dict]:
    # Reflection protects its fighter and other attached spells, but not itself.
    return [entry for fighter in state["fighters"] for entry in fighter["spells"]
            if not _blocked(fighter) or entry["card"]["effect"] == "reflection"] + state["effects"]


def _cast_parameters(state: Dict, pid: str, card: Dict) -> List[Dict]:
    effect = card["effect"]
    open_fighters = [fighter for fighter in state["fighters"] if not _blocked(fighter)]
    if card["kind"] != "support":
        return [{"target": fighter["slot"]} for fighter in open_fighters]
    if effect in ("detect_magic", "metamorphosis"):
        return [{"target": fighter["slot"]} for fighter in open_fighters
                if effect != "detect_magic" or any(entry["hidden"] for entry in fighter["spells"])]
    if effect == "anti_magic_field":
        return [{"target": fighter["slot"]} for fighter in state["fighters"] if fighter["spells"]]
    if effect == "dispel_magic":
        return [{"spell_id": entry["id"]} for entry in _spell_targets(state)]
    if effect == "alteration":
        return [{"spell_id": entry["id"], "target": destination["slot"]}
                for source in state["fighters"] for entry in source["spells"]
                if not _blocked(source) or entry["card"]["effect"] == "reflection"
                for destination in open_fighters if destination["slot"] != source["slot"]]
    if effect == "amnesia":
        return [{"player_id": target} for target in state["turn_order"]
                if len(state["players"][target]["hand"]) > (1 if target == pid else 0)]
    if effect == "imitation":
        bets = state["players"][pid]["bets"]
        return [{"from_slot": old, "to_slot": new} for old in bets for new in range(1, 6)
                if len(bets) > 1 and new not in bets]
    return [{}]


def _legal_moves(state: Dict, pid: str) -> List[Dict]:
    if pid not in state["players"] or state["game_over"]:
        return []
    player = state["players"][pid]
    base = {"round": state["round"], "turn": state["turn"]}
    phase = state["phase"]
    if phase == "round_end":
        return [{"type": "next_round", "round": state["round"]}] if pid not in state["next_ready"] else []
    if pid != state["current_turn"]:
        return []
    if phase == "betting":
        return [dict(base, type="bet", slots=list(slots)) for count in range(1, 4)
                for slots in itertools.combinations(range(1, 6), count)]
    if phase in ("discarding", "refill"):
        ids = [card["id"] for card in player["hand"]]
        counts = [1] if phase == "discarding" else range(len(ids) + 1)
        return [dict(base, type="discard", cards=list(cards)) for count in counts
                for cards in itertools.combinations(ids, count)]
    if phase != "casting":
        return []
    moves = [dict(base, type="pass")]
    for card in player["hand"]:
        permit = _card_permit(state, pid, card)
        if permit is not None:
            casts = [dict(base, type="cast", card_id=card["id"], **permit, **params)
                     for params in _cast_parameters(state, pid, card)]
            moves.extend(casts)
            if card["kind"] == "direct" and _effect(state, "prismatic_ray", pid):
                moves.extend(dict(move, face_down=True) for move in casts)
        # Peeking is an alternative action, not casting a banned spell.
        moves.extend(dict(base, type="peek", card_id=card["id"], target=fighter["slot"])
                     for fighter in state["fighters"] if any(entry["hidden"] for entry in fighter["spells"]))
    return moves


def _peek(state: Dict, pid: str, fighter: Dict) -> None:
    known = state["players"][pid]["known"]
    for entry in fighter["spells"]:
        if entry["hidden"] and entry["id"] not in known:
            known.append(entry["id"])
    _log(state, f"{_name(state, pid)} 窥探了 {fighter['slot']} 号斗士的暗牌。")


def _cast(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    card = next(card for card in player["hand"] if card["id"] == action["card_id"])
    player["hand"].remove(card)
    if action.get("bribe"):
        player["coins"] -= 2
        _log(state, f"{_name(state, pid)} 支付 2 金币(💰)贿赂裁判。")
    effect = card["effect"]
    fighter = state["fighters"][action["target"] - 1] if "target" in action else None
    if card["kind"] != "support":
        entry = _entry(state, pid, card)
        entry["hidden"] = not card.get("face_up", False) and (
            card["kind"] == "enchant" or action.get("face_down", False))
        entry["bribed"] = bool(action.get("bribe"))
        fighter["spells"].append(entry)
        label = "一道暗置咒语(🌙)" if entry["hidden"] else f"{card['icon']} {card['name_zh']}"
        _log(state, f"{_name(state, pid)} 对 {fighter['slot']} 号施放了{label}。")
        return
    # Support names are public, but private targets such as changed bets are not.
    _log(state, f"{_name(state, pid)} 施放 {card['icon']} {card['name_zh']}。")
    if effect in ("confusion", "invisibility", "prismatic_ray"):
        state["effects"].append(_entry(state, pid, card,
            target_type="judge" if effect == "confusion" else "player",
            target_id=state["judge"]["id"] if effect == "confusion" else pid))
        return
    # Recall resolves before entering the discard pile: it cannot draw itself.
    if effect != "recall":
        state["discard"].append(card)
    if effect == "detect_magic":
        _peek(state, pid, fighter)
    elif effect == "dispel_magic":
        target = next(entry for entry in _all_entries(state) if entry["id"] == action["spell_id"])
        _remove_entry(state, target)
    elif effect == "recall":
        drawn = _draw(state)
        if drawn:
            player["hand"].append(drawn)
        state["discard"].append(card)
    elif effect == "amnesia":
        state["pending_discard"] = {"resume_after": pid}
        state.update(phase="discarding", current_turn=action["player_id"])
    elif effect == "imitation":
        player["bets"].remove(action["from_slot"])
        player["bets"].append(action["to_slot"])
        player["bets"].sort()
    elif effect == "dimension_door":
        state["judge_discard"].append(state["judge"]["id"])
        for entry in list(state["effects"]):
            if entry["target_type"] == "judge":
                _remove_entry(state, entry)
        _new_judge(state)
        _log(state, f"新裁判：{state['judge']['name_zh']}。")
    elif effect == "metamorphosis":
        if not state["fighter_deck"]:
            state["fighter_deck"], state["fighter_discard"] = state["fighter_discard"], []
            random.shuffle(state["fighter_deck"])
        key = state["fighter_deck"].pop()
        state["fighter_discard"].append(fighter["id"])
        fighter.update(copy.deepcopy(FIGHTERS[key]))
    elif effect == "alteration":
        target = next(entry for entry in _all_entries(state) if entry["id"] == action["spell_id"])
        for source in state["fighters"]:
            if target in source["spells"]:
                source["spells"].remove(target)
                break
        fighter["spells"].append(target)
    elif effect == "anti_magic_field":
        for entry in list(fighter["spells"]):
            _remove_entry(state, entry)


def _judge_verdict(state: Dict) -> Dict:
    judge = copy.deepcopy(state["judge"])
    if _effect(state, "confusion"):
        judge.update(limit=None, verdict=None, special=None, ignored=True)
    elif judge.get("special") == "random_verdict":
        card = _draw(state)
        if card:
            state["discard"].append(card)
            limit, verdict = {"direct": (10, "eject"), "enchant": (15, "dispel"),
                              "support": (5, "dispel")}[card["kind"]]
            judge.update(limit=limit, verdict=verdict, drawn_card=copy.deepcopy(card))
            _log(state, f"善变裁判抽出 {card['name_zh']}：上限 {limit}，{verdict}。")
        else:
            judge.update(limit=None, verdict=None)
    return judge


def _finish_round(state: Dict) -> None:
    judge = _judge_verdict(state)
    results = []
    for fighter in state["fighters"]:
        cards = [entry["card"] for entry in fighter["spells"]]
        mana = sum(card["mana"] for card in cards)
        verdict = None
        if judge["limit"] is not None and mana > judge["limit"]:
            verdict = judge["verdict"]
        elif judge.get("special") == "dispel_low_mana" and mana <= 4:
            verdict = "dispel"
        power = fighter["power"]
        prize = fighter["prize"]
        if verdict != "dispel":
            power += sum(card["power"] for card in cards) * (-1 if fighter["reverse"] else 1)
            prize *= 2 ** sum(card["effect"] == "double_prize" for card in cards)
        results.append({"slot": fighter["slot"], "name_zh": fighter["name_zh"], "icon": fighter["icon"],
                        "base_power": fighter["power"], "power": power, "mana": mana,
                        "verdict": verdict, "prize": prize, "spells": copy.deepcopy(fighter["spells"])})
    survivors = [fighter for fighter in results if fighter["verdict"] != "eject"]
    winning = max(survivors, key=lambda fighter: (fighter["power"], fighter["base_power"])) if survivors else None
    earnings = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        bets = player["bets"]
        amount = 0
        if winning and winning["slot"] in bets:
            amount = {1: winning["prize"] * 2, 2: winning["prize"], 3: (winning["prize"] + 1) // 2}[len(bets)]
        player["coins"] += amount
        earnings.append({"player_id": pid, "amount": amount, "bets": list(bets)})
    cancelled = winning is None
    if cancelled:
        state["total_rounds"] += 1
    state["round_summary"] = {
        "round": state["round"], "cancelled": cancelled,
        "winner_slot": winning["slot"] if winning else None, "fighters": results,
        "earnings": earnings, "judge": judge, "final": state["round"] == state["total_rounds"],
    }
    state.update(phase="round_end", current_turn=None, next_ready=[])
    _log(state, "全部斗士退场，本场取消并加赛。" if cancelled
         else f"{winning['slot']} 号 {winning['name_zh']} 赢得本场，开始结算。")


def _advance_casting(state: Dict, actor: str) -> None:
    for candidate in _clockwise(state, actor):
        player = state["players"][candidate]
        if not player["passed"] and player["hand"]:
            state["current_turn"] = candidate
            return
    _finish_round(state)


def _end_game(state: Dict) -> None:
    scores = {pid: (player["coins"], len(player["hand"])) for pid, player in state["players"].items()}
    best = max(scores.values())
    state["winner"] = [pid for pid in state["turn_order"] if scores[pid] == best]
    state["final_results"] = [{"player_id": pid, "coins": scores[pid][0], "hand_count": scores[pid][1],
                               "rank": 1 + sum(score > scores[pid] for score in scores.values())}
                              for pid in sorted(scores, key=lambda pid: scores[pid], reverse=True)]
    state.update(phase="game_over", game_over=True, current_turn=None)


def _prepare_refill(state: Dict) -> None:
    _cleanup_arena(state)
    richest = max(player["coins"] for player in state["players"].values())
    candidates = [pid for pid in state["turn_order"] if state["players"][pid]["coins"] == richest]
    state["next_starter"] = candidates[0]
    state.update(phase="refill", current_turn=state["start_player"])
    for player in state["players"].values():
        player["refill_done"] = False


def _discard_action(state: Dict, pid: str, action: Dict) -> None:
    player = state["players"][pid]
    removed = [card for card in player["hand"] if card["id"] in action["cards"]]
    player["hand"] = [card for card in player["hand"] if card["id"] not in action["cards"]]
    state["discard"].extend(removed)
    _log(state, f"{_name(state, pid)} 弃掉了 {len(removed)} 张手牌。")
    if state["phase"] == "discarding":
        actor = state["pending_discard"]["resume_after"]
        state.update(phase="casting", pending_discard=None)
        _advance_casting(state, actor)
        return
    count, maximum = (4, 8) if len(state["players"]) <= 4 else (3, 6)
    for _ in range(min(count, max(0, maximum - len(player["hand"])))):
        card = _draw(state)
        if card:
            player["hand"].append(card)
    player["refill_done"] = True
    remaining = [candidate for candidate in _clockwise(state, pid) if not state["players"][candidate]["refill_done"]]
    if remaining:
        state["current_turn"] = remaining[0]
    else:
        state["round"] += 1
        _start_round(state, state.pop("next_starter"))


def _apply(state: Dict, pid: str, action: Dict) -> None:
    kind = action["type"]
    player = state["players"][pid]
    if kind == "next_round":
        state["next_ready"].append(pid)
        if len(state["next_ready"]) == len(state["players"]):
            state["turn"] += 1
            if state["round_summary"]["final"]:
                _end_game(state)
            else:
                _prepare_refill(state)
        return
    state["turn"] += 1
    if kind == "bet":
        player["bets"] = list(action["slots"])
        _log(state, f"{_name(state, pid)} 已秘密押注 {len(player['bets'])} 名斗士。")
        remaining = [candidate for candidate in _clockwise(state, pid) if state["players"][candidate]["bets"] is None]
        if remaining:
            state["current_turn"] = remaining[0]
        else:
            state.update(phase="casting", current_turn=state["start_player"])
    elif kind == "discard":
        _discard_action(state, pid, action)
    else:
        if kind == "cast":
            _cast(state, pid, action)
        elif kind == "peek":
            card = next(card for card in player["hand"] if card["id"] == action["card_id"])
            player["hand"].remove(card)
            state["discard"].append(card)
            _peek(state, pid, state["fighters"][action["target"] - 1])
        else:
            player["passed"] = True
            _log(state, f"{_name(state, pid)} Pass，本场不再行动。")
        if state["phase"] == "casting":
            _advance_casting(state, pid)


def _entry_view(entry: Dict, pid: str, known: List[str], reveal: bool) -> Dict:
    visible = reveal or not entry["hidden"] or entry["owner"] == pid or entry["id"] in known
    result = {key: value for key, value in entry.items() if key != "card"}
    result["card"] = entry["card"] if visible else None
    return result


class CheatyMagesGame:
    game_id = "cheaty_mages"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not _CONFIG_VALIDATOR.is_valid({} if config is None else config):
            raise ValueError("invalid Cheaty Mages configuration")
        if not 3 <= len(players) <= 6:
            raise ValueError("Cheaty Mages requires 3–6 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        deck = _build_deck()
        random.shuffle(deck)
        judges = list(JUDGES)
        random.shuffle(judges)
        state = {
            "game_id": CheatyMagesGame.game_id, "version": 1, "config": {},
            "players": {pid: {"coins": 2, "hand": []} for pid in ids},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "turn_order": ids, "round": 1, "turn": 1, "total_rounds": 3,
            "deck": deck, "discard": [], "judge_deck": judges, "judge_discard": [],
            "effects": [], "spell_serial": 0, "log": [], "winner": [], "final_results": [], "game_over": False,
        }
        hand_count = 8 if len(ids) <= 4 else 6 if len(ids) == 5 else 5
        for _ in range(hand_count):
            for pid in ids:
                state["players"][pid]["hand"].append(_draw(state))
        _start_round(state, random.choice(ids))
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return list(dict.fromkeys(move["type"] for move in _legal_moves(state, player_id)))

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        numbers = [action[key] for key in ("round", "turn", "target", "from_slot", "to_slot") if key in action]
        numbers.extend(action.get("slots", []))
        if any(type(value) is not int for value in numbers) or any(
                type(action[key]) is not bool for key in ("bribe", "face_down") if key in action):
            return [], "action numbers must be integers"
        normalized = copy.deepcopy(action)
        for key in ("slots", "cards"):
            if key in normalized:
                normalized[key].sort()
        legal = _legal_moves(state, player_id)
        if not any(normalized == dict(move, **({"cards": sorted(move["cards"])} if "cards" in move else {})) for move in legal):
            return [], "action unavailable or stale; refresh your selection"
        _apply(state, player_id, normalized)
        return [{"type": "cheaty_mages:action", "payload": {"player_id": player_id, "type": action["type"]}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        reveal = state["phase"] in ("round_end", "game_over", "refill")
        own = state["players"].get(viewer_id, {})
        known = own.get("known", [])
        fighters = []
        for fighter in state["fighters"]:
            item = {key: value for key, value in fighter.items() if key != "spells"}
            item["spells"] = [_entry_view(entry, viewer_id, known, reveal) for entry in fighter["spells"]]
            visible = [entry["card"] for entry in item["spells"] if entry["card"]]
            item["known_power"] = fighter["power"] + sum(card["power"] for card in visible) * (-1 if fighter["reverse"] else 1)
            item["known_mana"] = sum(card["mana"] for card in visible)
            item["hidden_count"] = sum(entry["card"] is None for entry in item["spells"])
            fighters.append(item)
        moves = _legal_moves(state, viewer_id)
        view = {key: state[key] for key in ("phase", "round", "turn", "total_rounds", "current_turn",
                "start_player", "game_over", "winner", "next_ready", "round_summary", "log", "final_results")}
        view.update(game_id=CheatyMagesGame.game_id, you=viewer_id, config={}, fighters=fighters,
                    judge=state["judge"], effects=state["effects"], deck_count=len(state["deck"]),
                    discard=state["discard"], your_hand=own.get("hand", []), your_bets=own.get("bets") or [],
                    legal_moves=moves, legal_actions=list(dict.fromkeys(move["type"] for move in moves)))
        view["players"] = [{
            "player_id": pid, "name": _name(state, pid), "seat": state["player_meta"][pid].get("seat", 0),
            "is_bot": bool(state["player_meta"][pid].get("is_bot")), "coins": state["players"][pid]["coins"],
            "hand_count": len(state["players"][pid]["hand"]), "bet_count": len(state["players"][pid]["bets"] or []),
            "bet_ready": state["players"][pid]["bets"] is not None, "passed": state["players"][pid]["passed"],
            "bets": state["players"][pid]["bets"] if reveal or pid == viewer_id else None,
            "invisible": _effect(state, "invisibility", pid), "prismatic": _effect(state, "prismatic_ray", pid),
        } for pid in state["turn_order"]]
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _choose_bot_action(CheatyMagesGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    moves = view["legal_moves"]
    if not moves:
        return None
    if moves[0]["type"] == "next_round":
        return moves[0]
    hand = {card["id"]: card for card in view["your_hand"]}
    if view["phase"] in ("refill", "discarding"):
        if view["phase"] == "refill":
            # Leave room for all new cards, preserving stronger/versatile spells.
            count, maximum = (4, 8) if len(view["players"]) <= 4 else (3, 6)
            discard_count = max(0, len(hand) + count - maximum)
        else:
            discard_count = 1
        eligible = [move for move in moves if len(move["cards"]) == discard_count]
        return min(eligible, key=lambda move: sum(abs(hand[cid]["power"]) + (3 if hand[cid]["kind"] == "support" else 0)
                                                 for cid in move["cards"]))
    fighters = {fighter["slot"]: fighter for fighter in view["fighters"]}
    if view["phase"] == "betting":
        def appeal(slot: int) -> float:
            fighter = fighters[slot]
            sign = -1 if fighter["reverse"] else 1
            boost = sum(max(0, card["power"] * sign) for card in hand.values())
            return fighter["power"] + boost * 0.35 + fighter["prize"] * 0.35
        best = sorted(fighters, key=appeal, reverse=True)[:2]
        return next(move for move in moves if move["slots"] == sorted(best))
    bets = view["your_bets"]
    def value(move: Dict) -> float:
        if move["type"] == "pass":
            return 0
        if move["type"] == "peek":
            return -0.5
        card = hand[move["card_id"]]
        cost = 2 if move.get("bribe") else 0
        effect = card["effect"]
        fighter = fighters.get(move.get("target"))
        if effect == "power":
            change = card["power"] * (-1 if fighter["reverse"] else 1)
            desirability = change * (1 if fighter["slot"] in bets else -0.75)
            limit = view["judge"]["limit"]
            if limit is not None and fighter["known_mana"] + card["mana"] > limit:
                desirability += -12 if fighter["slot"] in bets else 5
            return desirability - cost - 0.4
        if effect == "double_prize":
            return (2 if fighter["slot"] in bets else -2) - cost
        if effect == "mana":
            return (3 if (card["mana"] < 0) == (fighter["slot"] in bets) else -1) - cost
        if effect == "recall":
            return 2
        if effect == "amnesia":
            return 1.5
        if effect in ("invisibility", "prismatic_ray"):
            return 0.5 if len(hand) > 3 else -1
        if effect == "anti_magic_field":
            deviation = fighter["known_power"] - fighter["power"]
            return deviation * (-1 if fighter["slot"] in bets else 1) - cost
        if effect == "reflection":
            return (1 if fighter["slot"] in bets and fighter["known_power"] >= max(f["known_power"] for f in fighters.values()) else -1) - cost
        return -0.2 - cost
    return max(moves, key=value)
