"""Mall of Horror: authoritative rules and viewer-specific information."""

import copy
import random
import secrets
from collections import Counter
from typing import Dict, List, Optional, Tuple

import jsonschema


CHARACTERS = {
    "pinup": {"name": "模特", "emoji": "👱", "points": 7, "strength": 1, "votes": 1},
    "tough": {"name": "壮汉", "emoji": "💪", "points": 5, "strength": 2, "votes": 1},
    "gunman": {"name": "枪手", "emoji": "🔫", "points": 3, "strength": 1, "votes": 2},
    "girl": {"name": "小女孩", "emoji": "👧", "points": 1, "strength": 1, "votes": 1},
}
LOCATIONS = (
    {"id": 1, "name": "洗手间", "emoji": "🚻", "capacity": 3},
    {"id": 2, "name": "服装店", "emoji": "👕", "capacity": 4},
    {"id": 3, "name": "玩具店", "emoji": "🧸", "capacity": 4},
    {"id": 4, "name": "停车场", "emoji": "🚗", "capacity": None},
    {"id": 5, "name": "保安室", "emoji": "📹", "capacity": 3},
    {"id": 6, "name": "超市", "emoji": "🛒", "capacity": 6},
)
CARDS = {
    "threat": {"name": "威胁", "emoji": "✊", "text": "本次投票及其重投额外 +1 票。"},
    "camera": {"name": "监控", "emoji": "📹", "text": "秘密查看本轮四枚僵尸骰子。"},
    "sprint": {"name": "冲刺", "emoji": "🏃", "text": "移动时改往有空位的地点，也可留在原处。"},
    "hardware": {"name": "加固", "emoji": "🪵", "text": "本次地点防御 +1；停车场和超市四只以上僵尸不适用。"},
    "weapon1": {"name": "单杀武器", "emoji": "🔪", "text": "立即消灭当前受攻击地点的一只僵尸。"},
    "weapon2": {"name": "双杀武器", "emoji": "🪓", "text": "立即消灭当前受攻击地点的至多两只僵尸。"},
    "hide": {"name": "躲藏", "emoji": "🫥", "text": "自己的一个角色本轮不能被牺牲，也不能投票，仍提供防御。"},
}
CONFIG_SCHEMA = {
    "type": "object", "properties": {"seed": {"type": ["integer", "string"]}},
    "additionalProperties": False,
}
_ID = {"type": "string", "minLength": 1}
_NULL_ID = {"type": ["string", "null"]}
_DEST = {"type": "integer", "minimum": 1, "maximum": 6}
_FIELDS = {
    "place": {"character_id": _ID, "destination": _DEST},
    "play_card": {"card_id": _ID, "character_id": _NULL_ID},
    "pass": {},
    "vote": {"target_id": _ID},
    "distribute": {"keep_id": _ID, "give_id": _NULL_ID, "recipient_id": _NULL_ID},
    "choose_destination": {"destination": _DEST},
    "place_zombie": {"destination": _DEST},
    "move": {"character_id": _ID, "destination": _DEST, "sprint_card_id": _NULL_ID},
    "sacrifice": {"character_id": _ID},
    "next_round": {},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {
        "type": {"const": kind}, "game_token": _ID,
        "step": {"type": "integer", "minimum": 0}, **fields,
    }, "required": ["type", "game_token", "step", *fields], "additionalProperties": False}
    for kind, fields in _FIELDS.items()
]}
_VALIDATOR = jsonschema.Draft7Validator(ACTION_SCHEMA)


def build_deck() -> List[Dict]:
    return [{"id": f"{kind}_{i}", "kind": kind} for kind in CARDS for i in range(3)]


def _rng(state: Dict) -> random.Random:
    rng = random.Random(f'{state["seed"]}:{state["random_counter"]}')
    state["random_counter"] += 1
    return rng


def _dice(state: Dict, count: int) -> List[int]:
    rng = _rng(state)
    return [rng.randint(1, 6) for _ in range(count)]


def _characters(state: Dict, owner: Optional[str] = None, location: Optional[int] = None) -> List[Dict]:
    return [c for c in state["characters"] if c["alive"]
            and (owner is None or c["owner"] == owner)
            and (location is None or c["location"] == location)]


def _living(state: Dict) -> List[str]:
    return [p for p in state["turn_order"] if _characters(state, p)]


def _order(state: Dict) -> List[str]:
    order = state["turn_order"]
    i = order.index(state["chief"])
    return order[i:] + order[:i]


def _location(state: Dict, number: int) -> Dict:
    if type(number) is not int or not 1 <= number <= 6:
        raise ValueError("invalid location")
    return state["locations"][number - 1]


def _available(state: Dict, number: int, moving_id: Optional[str] = None) -> bool:
    loc = _location(state, number)
    count = sum(c["id"] != moving_id for c in _characters(state, location=number))
    return not loc["closed"] and (loc["capacity"] is None or count < loc["capacity"])


def _transition(state: Dict, phase: str, actor: Optional[str] = None) -> None:
    state.update(phase=phase, current_turn=actor, step=state["step"] + 1)


def _log(state: Dict, text: str) -> None:
    item = {"round": state["round"], "text": text}
    state["log"].append(item)
    state["log"] = state["log"][-100:]
    state["round_log"].append(item)


def _name(state: Dict, pid: str) -> str:
    return state["player_meta"][pid].get("name", pid)


def _add_zombie(state: Dict, number: int) -> None:
    loc = _location(state, number)
    if not loc["closed"]:
        loc["zombies"] += 1


def _start_round(state: Dict) -> None:
    state.update(round=state["round"] + 1, elected=False, forecast=[], forecast_viewers=[],
                 revealed=False, destinations={}, ready=[], round_log=[], round_result=None,
                 last_vote=None, vote=None, loot=[], looter=None, revenge_queue=[], moves=[],
                 attack_location=None, defense_bonus=0, noise=[])
    for char in state["characters"]:
        char["hidden"] = False
    if state["deck"] and _characters(state, location=4):
        _start_vote(state, "truck", 4)
    else:
        _start_election(state)


def _start_election(state: Dict) -> None:
    if _characters(state, location=5):
        _start_vote(state, "chief", 5)
    else:
        _start_camera(state)


def _start_camera(state: Dict) -> None:
    state["vote"] = None
    state["revealed"] = False
    state["forecast"] = _dice(state, 4)
    state["forecast_viewers"] = [state["chief"]] if state["elected"] else []
    state["queue"] = [p for p in _order(state) if p in _living(state)]
    _transition(state, "camera", state["queue"][0])


def _start_destinations(state: Dict) -> None:
    state["queue"] = []
    if state["elected"] and state["chief"] in _living(state):
        _transition(state, "chief_destination", state["chief"])
    else:
        _transition(state, "destinations")


def _destination_options(state: Dict, pid: str) -> List[int]:
    chars = _characters(state, pid)
    sprint = any(c["kind"] == "sprint" for c in state["players"][pid]["hand"])
    return [loc["id"] for loc in state["locations"] if not loc["closed"]
            and (sprint or any(c["location"] != loc["id"] for c in chars))]


def _start_revenge(state: Dict) -> None:
    state["revenge_queue"] = [p for p in _order(state)
                              if state["players"][p]["eliminated_round"] == state["round"] - 1
                              and not state["players"][p]["revenge_used"]]
    if state["revenge_queue"]:
        _transition(state, "revenge", state["revenge_queue"][0])
    else:
        _reveal_destinations(state)


def _reveal_destinations(state: Dict) -> None:
    state["revealed"] = True
    for number in state["forecast"]:
        _add_zombie(state, number)
    _log(state, f'僵尸骰子揭晓：{"、".join(map(str, state["forecast"]))}。')
    for loc in state["locations"]:
        if loc["id"] != 4 and loc["zombies"] >= 8 and not _characters(state, location=loc["id"]):
            loc.update(closed=True, zombies=0)
            _log(state, f'{loc["name"]}被封锁。')
    state["queue"] = [p for p in _order(state) if p in _living(state)]
    _transition(state, "move", state["queue"][0])


def _start_attacks(state: Dict) -> None:
    for kind in (None, "pinup"):
        counts = Counter(c["location"] for c in _characters(state) if kind is None or c["kind"] == kind)
        if counts:
            most = max(counts.values())
            leaders = [loc for loc, n in counts.items() if n == most]
            if len(leaders) == 1:
                number = leaders[0]
                _add_zombie(state, number)
                state["noise"].append({"location": number, "kind": "crowd" if kind is None else "pinup"})
                _log(state, f'{_location(state, number)["name"]}因{"人群" if kind is None else "模特"}最多，吸引 1 只僵尸。')
    state["attack_location"] = 0
    _advance_attack(state)


def _breached(state: Dict, number: int) -> bool:
    zombies = _location(state, number)["zombies"]
    chars = _characters(state, location=number)
    if not zombies or not chars:
        return False
    if number == 4 or (number == 6 and zombies >= 4):
        return True
    defense = sum(CHARACTERS[c["kind"]]["strength"] for c in chars)
    bonus = state["defense_bonus"] if state["attack_location"] == number else 0
    return zombies >= defense + bonus


def _advance_attack(state: Dict) -> None:
    state["vote"] = None
    for number in range(state["attack_location"] + 1, 7):
        state["attack_location"] = number
        state["defense_bonus"] = 0
        if _breached(state, number):
            _start_vote(state, "victim", number)
            return
        if number == 4:
            _location(state, 4)["zombies"] = 0
    _finish_round(state)


def _vote_characters(state: Dict) -> List[Dict]:
    return [c for c in _characters(state, location=state["vote"]["location"]) if not c["hidden"]]


def _start_vote(state: Dict, kind: str, number: int) -> None:
    state["vote"] = {"kind": kind, "location": number, "runoff": False,
                     "candidates": [], "weights": {}, "ballots": {}, "threats": {}, "history": []}
    # Everyone gets a threat window for elections; attack cards require presence.
    present = {c["owner"] for c in _characters(state, location=number)}
    state["queue"] = [p for p in _order(state)
                      if p in _living(state) and (kind != "victim" or p in present)]
    _transition(state, "cards", state["queue"][0])


def _open_vote(state: Dict) -> None:
    vote = state["vote"]
    number = vote["location"]
    if vote["kind"] == "victim" and not _breached(state, number):
        _log(state, f'{_location(state, number)["name"]}成功抵挡僵尸。')
        _advance_attack(state)
        return
    chars = _vote_characters(state)
    vote["candidates"] = [p for p in state["turn_order"] if any(c["owner"] == p for c in chars)]
    vote["weights"] = {
        p: sum(CHARACTERS[c["kind"]]["votes"] for c in chars if c["owner"] == p) + vote["threats"].get(p, 0)
        for p in vote["candidates"]
    }
    if not vote["candidates"]:
        if number == 4 and vote["kind"] == "victim":
            _location(state, 4)["zombies"] = 0
        _log(state, f'{_location(state, number)["name"]}没有可被选择的角色。')
        _after_vote(state, None)
    elif len(vote["candidates"]) == 1:
        winner = vote["candidates"][0]
        state["last_vote"] = {"kind": vote["kind"], "location": number, "winner": winner,
                              "random": False, "unopposed": True, "history": []}
        _after_vote(state, winner)
    else:
        _transition(state, "vote")


def _resolve_vote(state: Dict) -> None:
    vote = state["vote"]
    counts = {p: 0 for p in vote["candidates"]}
    for pid, target in vote["ballots"].items():
        counts[target] += vote["weights"][pid]
    best = max(counts.values())
    tied = [p for p, n in counts.items() if n == best]
    vote["history"].append({"ballots": dict(vote["ballots"]), "weights": dict(vote["weights"]), "totals": counts})
    state["last_vote"] = {"kind": vote["kind"], "location": vote["location"],
                          "winner": None, "random": False, "unopposed": False,
                          "history": copy.deepcopy(vote["history"])}
    if len(tied) > 1 and not vote["runoff"]:
        vote.update(runoff=True, candidates=tied, ballots={})
        present = {c["owner"] for c in _characters(state, location=vote["location"])}
        for pid in state["turn_order"]:
            if pid not in present:
                vote["weights"][pid] = 1 + vote["threats"].get(pid, 0)
        _log(state, "投票平手：仅最高票候选人重投，地点外玩家各增加一票。")
        _transition(state, "vote")
        return
    winner = tied[0] if len(tied) == 1 else None
    if winner is None and vote["kind"] == "victim":
        winner = _rng(state).choice(tied)
        state["last_vote"]["random"] = True
    state["last_vote"]["winner"] = winner
    _after_vote(state, winner)


def _after_vote(state: Dict, winner: Optional[str]) -> None:
    vote = state["vote"]
    kind = vote["kind"]
    if kind == "truck":
        if winner is None:
            _log(state, "货车投票无结果，本轮不分配行动牌。")
            _start_election(state)
        else:
            state["looter"] = winner
            state["loot"] = state["deck"][:3]
            del state["deck"][:3]
            _log(state, f'{_name(state, winner)}获选搜索货车。')
            _transition(state, "distribute", winner)
    elif kind == "chief":
        if winner is not None:
            state.update(chief=winner, elected=True)
            _log(state, f'{_name(state, winner)}当选保安队长。')
        else:
            _log(state, "保安队长留任，本轮不获得免费查看骰子的权限。")
        _start_camera(state)
    elif winner is None:
        _advance_attack(state)
    else:
        state["victim_owner"] = winner
        choices = [c for c in _vote_characters(state) if c["owner"] == winner]
        if len(choices) == 1:
            _kill(state, choices[0])
        else:
            _transition(state, "victim", winner)


def _kill(state: Dict, char: Dict) -> None:
    number, pid = char["location"], char["owner"]
    char.update(alive=False, hidden=False)
    _log(state, f'{_name(state, pid)}的{CHARACTERS[char["kind"]]["name"]}在{_location(state, number)["name"]}被牺牲。')
    loc = _location(state, number)
    if number != 4:
        loc["zombies"] = 0
        _advance_attack(state)
    else:
        loc["zombies"] = max(0, loc["zombies"] - 1)
        if loc["zombies"] and any(not c["hidden"] for c in _characters(state, location=4)):
            _start_vote(state, "victim", 4)
        else:
            loc["zombies"] = 0
            _advance_attack(state)


def _scores(state: Dict) -> List[Dict]:
    return [{"player_id": p, "points": sum(CHARACTERS[c["kind"]]["points"] for c in _characters(state, p)),
             "survivors": len(_characters(state, p)), "cards": len(state["players"][p]["hand"])}
            for p in state["turn_order"]]


def _finish_round(state: Dict) -> None:
    for pid in state["turn_order"]:
        if not _characters(state, pid) and state["players"][pid]["eliminated_round"] is None:
            state["players"][pid]["eliminated_round"] = state["round"]
    chars = _characters(state)
    threshold = 6 if len(state["turn_order"]) == 6 else 4
    together = bool(chars) and len({c["location"] for c in chars}) == 1 and chars[0]["location"] != 4
    reason = "幸存人数达到救援条件" if len(chars) <= threshold else "所有幸存者在同一安全地点集结" if together else None
    state.update(ready=[], vote=None, queue=[], current_turn=None)
    state["round_result"] = {"reason": reason, "scores": _scores(state), "log": copy.deepcopy(state["round_log"])}
    if reason:
        scores = state["round_result"]["scores"]
        best = max((p["points"], p["cards"]) for p in scores)
        state["winner_ids"] = [p["player_id"] for p in scores if (p["points"], p["cards"]) == best]
        state["game_over"] = True
        _transition(state, "game_over")
    else:
        _transition(state, "round_review")


def _card_options(state: Dict, pid: str) -> List[Dict]:
    if state["current_turn"] != pid or state["phase"] not in ("cards", "camera"):
        return []
    options = []
    for card in state["players"][pid]["hand"]:
        kind = card["kind"]
        if state["phase"] == "camera":
            if kind == "camera" and pid not in state["forecast_viewers"]:
                options.append({"card_id": card["id"], "character_ids": []})
            continue
        vote = state["vote"]
        if kind == "threat":
            options.append({"card_id": card["id"], "character_ids": []})
        elif vote["kind"] == "victim":
            loc = _location(state, vote["location"])
            if kind in ("weapon1", "weapon2") and loc["zombies"]:
                options.append({"card_id": card["id"], "character_ids": []})
            elif kind == "hardware" and loc["id"] != 4 and not (loc["id"] == 6 and loc["zombies"] >= 4):
                options.append({"card_id": card["id"], "character_ids": []})
            elif kind == "hide":
                ids = [c["id"] for c in _characters(state, pid, loc["id"]) if not c["hidden"]]
                if ids:
                    options.append({"card_id": card["id"], "character_ids": ids})
    return options


def _move_options(state: Dict, pid: str) -> List[Dict]:
    if state["phase"] != "move" or state["current_turn"] != pid:
        return []
    options = []
    pledged = state["destinations"][pid]
    sprint_cards = [c["id"] for c in state["players"][pid]["hand"] if c["kind"] == "sprint"]
    for char in _characters(state, pid):
        if char["location"] != pledged:
            options.append({"character_id": char["id"], "destination": pledged, "sprint_card_id": None,
                            "actual_destination": pledged if _available(state, pledged) else 4})
        for card_id in sprint_cards:
            for loc in state["locations"]:
                if _available(state, loc["id"], char["id"]):
                    options.append({"character_id": char["id"], "destination": loc["id"],
                                    "sprint_card_id": card_id, "actual_destination": loc["id"]})
    return options


def _setup_options(state: Dict) -> List[int]:
    available = [loc["id"] for loc in state["locations"] if _available(state, loc["id"])]
    matching = [number for number in available if number in state["setup_dice"]]
    return matching or available


class MallOfHorrorGame:
    game_id, min_players, max_players = "mall_of_horror", 3, 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 3 <= len(players) <= 6:
            raise ValueError("Mall of Horror requires 3 to 6 players")
        cfg = copy.deepcopy(config) if config is not None else {}
        if not jsonschema.Draft7Validator(CONFIG_SCHEMA).is_valid(cfg):
            raise ValueError("invalid Mall of Horror configuration")
        meta = {p["player_id"]: copy.deepcopy(p) for p in players}
        if len(meta) != len(players) or any(not isinstance(p, str) or not p for p in meta):
            raise ValueError("invalid player IDs")
        order = sorted(meta, key=lambda p: (meta[p].get("seat", 0), p))
        kinds = ["pinup", "tough", "gunman"] + (["girl"] if len(players) == 3 else [])
        state = {
            "version": 1, "config": cfg, "seed": cfg.get("seed", secrets.token_hex(16)), "random_counter": 0,
            "game_token": secrets.token_hex(16), "step": 0, "revision": 0, "phase": "setup",
            "turn_order": order, "player_meta": meta, "chief": order[0], "current_turn": order[0],
            "players": {p: {"hand": [], "eliminated_round": None, "revenge_used": False} for p in order},
            "characters": [{"id": f"s{i}_{kind}", "owner": p, "kind": kind, "location": None,
                            "alive": True, "hidden": False} for i, p in enumerate(order) for kind in kinds],
            "locations": [{**loc, "closed": loc["id"] == 2 and len(players) <= 4, "zombies": 0} for loc in LOCATIONS],
            "setup_index": 0, "setup_queue": order * len(kinds), "setup_dice": [],
            "deck": build_deck(), "discard": [], "round": 0, "ready": [], "log": [], "round_log": [],
            "game_over": False, "winner_ids": [], "round_result": None, "elected": False,
            "forecast": [], "forecast_viewers": [], "revealed": False, "destinations": {},
            "vote": None, "last_vote": None, "loot": [], "looter": None, "queue": [],
            "revenge_queue": [], "attack_location": None, "defense_bonus": 0, "noise": [], "moves": [],
        }
        _rng(state).shuffle(state["deck"])
        for p in order:
            state["players"][p]["hand"].append(state["deck"].pop())
        state["setup_dice"] = _dice(state, 2)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        phase, current = state["phase"], state["current_turn"]
        if phase == "vote":
            vote = state["vote"]
            return ["vote"] if player_id in vote["weights"] and player_id not in vote["ballots"] else []
        if phase == "destinations":
            return ["choose_destination"] if player_id in _living(state) and player_id not in state["destinations"] else []
        if phase == "round_review":
            return ["next_round"] if player_id not in state["ready"] else []
        if current != player_id:
            return []
        if phase in ("cards", "camera"):
            return (["play_card"] if _card_options(state, player_id) else []) + ["pass"]
        return {"setup": ["place"], "distribute": ["distribute"], "chief_destination": ["choose_destination"],
                "revenge": ["place_zombie"], "move": ["move"], "victim": ["sacrifice"]}.get(phase, [])

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _VALIDATOR.is_valid(action):
            return [], "Invalid action fields."
        if action["game_token"] != state["game_token"] or type(action["step"]) is not int or action["step"] != state["step"]:
            return [], "This action is stale. Refresh the game state."
        if action["type"] not in MallOfHorrorGame.get_legal_actions(state, player_id):
            return [], "This action is not available."
        candidate = copy.deepcopy(state)
        try:
            error = _apply(candidate, player_id, action)
        except (KeyError, TypeError, ValueError, IndexError, StopIteration):
            return [], "Invalid action values."
        if error:
            return [], error
        candidate["revision"] += 1
        state.clear()
        state.update(candidate)
        # Never broadcast an action payload containing a secret choice or card.
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        known = viewer_id in state["players"]
        view = {k: copy.deepcopy(state[k]) for k in (
            "game_token", "step", "revision", "phase", "round", "current_turn", "chief", "elected",
            "ready", "log", "round_result", "game_over", "winner_ids", "last_vote", "attack_location",
            "defense_bonus", "revealed", "noise", "moves",
        )}
        locations = []
        for loc in state["locations"]:
            chars = _characters(state, location=loc["id"])
            locations.append({**loc, "occupants": len(chars),
                              "strength": sum(CHARACTERS[c["kind"]]["strength"] for c in chars),
                              "breached": _breached(state, loc["id"])})
        vote = state["vote"]
        vote_view = None if vote is None else {
            k: copy.deepcopy(vote[k]) for k in ("kind", "location", "runoff", "candidates", "weights", "threats", "history")
        }
        if vote_view is not None:
            vote_view.update(submitted=list(vote["ballots"]), your_vote=vote["ballots"].get(viewer_id))
        destinations = {p: number for p, number in state["destinations"].items()
                        if state["revealed"] or p == viewer_id or (state["elected"] and p == state["chief"])}
        scores = {row["player_id"]: row for row in _scores(state)}
        view.update(
            game_id="mall_of_horror", you=viewer_id, locations=locations,
            characters=[{**c, **CHARACTERS[c["kind"]]} for c in copy.deepcopy(state["characters"])],
            players=[{"player_id": p, "name": _name(state, p), "seat": i,
                      "is_bot": bool(state["player_meta"][p].get("is_bot")),
                      "eliminated_round": state["players"][p]["eliminated_round"],
                      "revenge_used": state["players"][p]["revenge_used"], **scores[p]}
                     for i, p in enumerate(state["turn_order"])],
            hand=[{**c, **CARDS[c["kind"]]} for c in state["players"][viewer_id]["hand"]] if known else [],
            loot=[{**c, **CARDS[c["kind"]]} for c in state["loot"]] if viewer_id == state["looter"] and state["phase"] == "distribute" else [],
            looter=state["looter"] if state["phase"] == "distribute" else None,
            deck_count=len(state["deck"]), discard_count=len(state["discard"]),
            forecast=list(state["forecast"]) if state["revealed"] or viewer_id in state["forecast_viewers"] else None,
            setup_dice=list(state["setup_dice"]) if state["phase"] == "setup" else [],
            vote=vote_view, destinations=destinations, destination_submitted=list(state["destinations"]),
            legal_actions=MallOfHorrorGame.get_legal_actions(state, viewer_id),
            setup_locations=_setup_options(state) if state["phase"] == "setup" and state["current_turn"] == viewer_id else [],
            destination_options=_destination_options(state, viewer_id) if known and state["phase"] in ("chief_destination", "destinations") else [],
            card_options=_card_options(state, viewer_id) if known else [],
            move_options=_move_options(state, viewer_id) if known else [],
            victim_options=[c["id"] for c in _vote_characters(state) if c["owner"] == viewer_id]
            if state["phase"] == "victim" and state["current_turn"] == viewer_id else [],
        )
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.mall_of_horror_ai import choose_action
        action = choose_action(MallOfHorrorGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 450} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("version") != 1:
            raise ValueError("unsupported Mall of Horror save")
        return copy.deepcopy(payload)


def _apply(state: Dict, pid: str, action: Dict) -> Optional[str]:
    kind = action["type"]
    if kind == "place":
        char = next(c for c in _characters(state, pid) if c["id"] == action["character_id"] and c["location"] is None)
        number = action["destination"]
        if type(number) is not int or number not in _setup_options(state):
            return "Choose an available rolled location."
        char["location"] = number
        state["setup_index"] += 1
        if state["setup_index"] == len(state["setup_queue"]):
            for number in _dice(state, 4):
                _add_zombie(state, number)
            _start_round(state)
        else:
            state["setup_dice"] = _dice(state, 2)
            _transition(state, "setup", state["setup_queue"][state["setup_index"]])
    elif kind == "pass":
        phase = state["phase"]
        state["queue"].pop(0)
        if state["queue"]:
            _transition(state, phase, state["queue"][0])
        elif phase == "camera":
            _start_destinations(state)
        else:
            _open_vote(state)
    elif kind == "play_card":
        option = next(o for o in _card_options(state, pid) if o["card_id"] == action["card_id"])
        target = action["character_id"]
        if (option["character_ids"] and target not in option["character_ids"]) or (not option["character_ids"] and target is not None):
            return "Choose a valid card target."
        card = next(c for c in state["players"][pid]["hand"] if c["id"] == action["card_id"])
        card_kind = card["kind"]
        if card_kind == "camera":
            state["forecast_viewers"].append(pid)
        elif card_kind == "threat":
            threats = state["vote"]["threats"]
            threats[pid] = threats.get(pid, 0) + 1
        elif card_kind == "hardware":
            state["defense_bonus"] += 1
        elif card_kind in ("weapon1", "weapon2"):
            loc = _location(state, state["vote"]["location"])
            loc["zombies"] = max(0, loc["zombies"] - (1 if card_kind == "weapon1" else 2))
        elif card_kind == "hide":
            next(c for c in state["characters"] if c["id"] == target)["hidden"] = True
        state["players"][pid]["hand"].remove(card)
        state["discard"].append(card)
        _log(state, f'{_name(state, pid)}使用{CARDS[card_kind]["name"]}。')
        _transition(state, state["phase"], pid)
    elif kind == "vote":
        vote = state["vote"]
        if action["target_id"] not in vote["candidates"]:
            return "Choose a listed candidate."
        vote["ballots"][pid] = action["target_id"]
        if set(vote["ballots"]) == set(vote["weights"]):
            _resolve_vote(state)
    elif kind == "distribute":
        loot = state["loot"]
        keep = next(c for c in loot if c["id"] == action["keep_id"])
        give_id, recipient = action["give_id"], action["recipient_id"]
        if len(loot) >= 2:
            give = next(c for c in loot if c["id"] == give_id and c != keep)
            if recipient not in state["players"] or recipient == pid:
                return "Give the second card to another player."
            state["players"][recipient]["hand"].append(give)
            loot.remove(give)
            _log(state, f'{_name(state, pid)}向{_name(state, recipient)}赠送一张行动牌。')
        elif give_id is not None or recipient is not None:
            return "Only one card remains."
        state["players"][pid]["hand"].append(keep)
        loot.remove(keep)
        state["deck"].extend(loot)
        state["loot"] = []
        _start_election(state)
    elif kind == "choose_destination":
        number = action["destination"]
        if type(number) is not int or number not in _destination_options(state, pid):
            return "Choose an open destination that permits moving a character."
        state["destinations"][pid] = number
        if set(state["destinations"]) == set(_living(state)):
            _start_revenge(state)
        elif state["phase"] == "chief_destination":
            _transition(state, "destinations")
    elif kind == "place_zombie":
        number = action["destination"]
        if _location(state, number)["closed"]:
            return "This location is closed."
        _add_zombie(state, number)
        state["players"][pid]["revenge_used"] = True
        state["revenge_queue"].pop(0)
        _log(state, f'{_name(state, pid)}在{_location(state, number)["name"]}放置一只复仇僵尸。')
        if state["revenge_queue"]:
            _transition(state, "revenge", state["revenge_queue"][0])
        else:
            _reveal_destinations(state)
    elif kind == "move":
        if type(action["destination"]) is not int:
            return "Invalid destination."
        keys = ("character_id", "destination", "sprint_card_id")
        option = next(o for o in _move_options(state, pid) if all(o[k] == action[k] for k in keys))
        char = next(c for c in _characters(state, pid) if c["id"] == action["character_id"])
        if action["sprint_card_id"]:
            card = next(c for c in state["players"][pid]["hand"] if c["id"] == action["sprint_card_id"])
            state["players"][pid]["hand"].remove(card)
            state["discard"].append(card)
        origin = char["location"]
        char["location"] = option["actual_destination"]
        state["moves"].append({"owner": pid, "character_id": char["id"], "from": origin,
                               "to": char["location"], "sprint": bool(action["sprint_card_id"])})
        _log(state, f'{_name(state, pid)}的{CHARACTERS[char["kind"]]["name"]}移动至{_location(state, char["location"])["name"]}。')
        state["queue"].pop(0)
        if state["queue"]:
            _transition(state, "move", state["queue"][0])
        else:
            _start_attacks(state)
    elif kind == "sacrifice":
        char = next(c for c in _vote_characters(state) if c["owner"] == pid and c["id"] == action["character_id"])
        _kill(state, char)
    elif kind == "next_round":
        state["ready"].append(pid)
        if set(state["ready"]) == set(state["turn_order"]):
            _start_round(state)
    return None
