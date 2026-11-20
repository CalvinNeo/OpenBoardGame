import copy
import secrets
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


ROLE_INFO = {
    "werewolf": {"name": "狼人", "icon": "🐺", "team": "wolves"},
    "wolf_king": {"name": "狼王", "icon": "👑", "team": "wolves"},
    "white_wolf": {"name": "白狼王", "icon": "⚪", "team": "wolves"},
    "villager": {"name": "平民", "icon": "🏠", "team": "good"},
    "seer": {"name": "预言家", "icon": "🔮", "team": "good"},
    "witch": {"name": "女巫", "icon": "🧪", "team": "good"},
    "hunter": {"name": "猎人", "icon": "🎯", "team": "good"},
    "guard": {"name": "守卫", "icon": "🛡️", "team": "good"},
    "idiot": {"name": "白痴", "icon": "🃏", "team": "good"},
    "knight": {"name": "骑士", "icon": "⚔️", "team": "good"},
}
WOLVES = ("werewolf", "wolf_king", "white_wolf")
NIGHT_STEPS = ("guard", "wolves", "witch", "seer")
ACTION_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["type", "game_token", "window_id"],
    "properties": {
        "type": {"enum": ["deal", "ready", "guard", "wolf_vote", "witch", "inspect",
                            "end_speech", "vote", "shoot", "explode", "duel", "next_round"]},
        "game_token": {"type": "string"}, "window_id": {"type": "integer", "minimum": 0},
        "target": {"type": ["string", "null"]},
        "choice": {"enum": ["save", "poison", "pass"]},
        "roles": {"type": "object", "additionalProperties": False,
                  "properties": {role: {"type": "integer", "minimum": 0, "maximum": 16} for role in ROLE_INFO}},
        "win_rule": {"enum": ["side", "all"]},
        "self_save": {"enum": ["never", "first_night"]},
        "allow_wolf_self_attack": {"type": "boolean"},
    },
}
CONFIG_SCHEMA = {"type": "object", "additionalProperties": False, "properties": {}}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)


def recommended_roles(count: int) -> Dict:
    wolves = max(2, count // 3)
    roles = {"werewolf": wolves, "seer": 1, "witch": 1, "hunter": int(count >= 7),
             "guard": int(count >= 12)}
    roles["villager"] = count - sum(roles.values())
    return {role: roles.get(role, 0) for role in ROLE_INFO}


def _alive(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if state["players"][pid]["alive"]]


def _wolf(state: Dict, player_id: str) -> bool:
    return state["players"][player_id]["role"] in WOLVES


def _name(state: Dict, player_id: str) -> str:
    return state["players"][player_id]["name"]


def _log(state: Dict, text: str) -> None:
    state["log"].append(text)


def _phase(state: Dict, phase: str, current_turn: Optional[str] = None) -> None:
    state.update(phase=phase, current_turn=current_turn, window_id=state["window_id"] + 1)


def _check_win(state: Dict) -> bool:
    alive = _alive(state)
    wolves = [pid for pid in alive if _wolf(state, pid)]
    good = [pid for pid in alive if not _wolf(state, pid)]
    winner = None
    if not wolves:
        winner = "good" if good else "draw"
    elif not good:
        winner = "wolves"
    elif state["win_rule"] == "side":
        villagers = [pid for pid in good if state["players"][pid]["role"] == "villager"]
        gods = [pid for pid in good if state["players"][pid]["role"] != "villager"]
        if not villagers or not gods:
            winner = "wolves"
    if winner:
        state.update(winning_team=winner, game_over=True,
                     winner=[pid for pid in state["turn_order"]
                             if ROLE_INFO[state["players"][pid]["role"]]["team"] == winner])
        _phase(state, "game_over")
        _log(state, {"good": "好人阵营获胜。", "wolves": "狼人阵营获胜。", "draw": "双方全部出局，平局。"}[winner])
        return True
    return False


def _night(state: Dict) -> None:
    state.update(night_step=-1, night={"guard": None, "kill": None, "poison": None, "saved": False},
                 wolf_votes={}, ready=[], vote_candidates=[], ballots={}, pk_round=False)
    _phase(state, "night")
    _log(state, f"第 {state['day']} 夜，请闭眼。")
    _next_night_step(state)


def _next_night_step(state: Dict) -> None:
    state["night_step"] += 1
    if state["night_step"] >= len(NIGHT_STEPS):
        _dawn(state)
        return
    step = NIGHT_STEPS[state["night_step"]]
    actors = [pid for pid in _alive(state) if (_wolf(state, pid) if step == "wolves"
                                              else state["players"][pid]["role"] == step)]
    state["night_actors"] = actors
    if not actors:
        _next_night_step(state)
    else:
        _phase(state, "night")


def _deaths(state: Dict, deaths: Dict, resume: str, words: List[str]) -> None:
    state.update(resume=resume, death_queue=[], words_queue=words[:], ready=[])
    state["last_deaths"] = [pid for pid in state["turn_order"] if pid in deaths]
    for player_id in state["last_deaths"]:
        player = state["players"][player_id]
        player.update(alive=False, death_reason=deaths[player_id])
        if player["role"] in ("hunter", "wolf_king") and deaths[player_id] != "poison":
            if player["role"] == "hunter" or deaths[player_id] not in ("eaten", "milk_pierce", "explode"):
                state["death_queue"].append(player_id)
    if deaths:
        _log(state, "出局：" + "、".join(_name(state, pid) for pid in state["last_deaths"]) + "。")
    _next_death(state)


def _next_death(state: Dict) -> None:
    if state["death_queue"]:
        player_id = state["death_queue"].pop(0)
        state["players"][player_id]["revealed"] = True
        _phase(state, "death_skill", player_id)
    elif state["words_queue"]:
        _phase(state, "last_words", state["words_queue"].pop(0))
    else:
        _phase(state, state["resume"])


def _dawn(state: Dict) -> None:
    night = state["night"]
    deaths = {}
    target = night["kill"]
    if target:
        protected = night["guard"] == target
        if protected == night["saved"]:
            deaths[target] = "milk_pierce" if protected else "eaten"
    if night["poison"]:
        deaths[night["poison"]] = "poison"
    _log(state, f"第 {state['day']} 天天亮。" + ("昨夜平安。" if not deaths else ""))
    words = [pid for pid in state["turn_order"] if pid in deaths] if state["day"] == 1 else []
    _deaths(state, deaths, "dawn_review", words)


def _speeches(state: Dict, candidates: Optional[List[str]] = None) -> None:
    state["speech_queue"] = list(candidates if candidates is not None else _alive(state))
    _next_speech(state)


def _next_speech(state: Dict) -> None:
    while state["speech_queue"] and not state["players"][state["speech_queue"][0]]["alive"]:
        state["speech_queue"].pop(0)
    if state["speech_queue"]:
        _phase(state, "discussion", state["speech_queue"].pop(0))
    else:
        state["ballots"] = {}
        _phase(state, "vote")
        if not _voters(state):
            _resolve_vote(state)


def _voters(state: Dict) -> List[str]:
    return [pid for pid in _alive(state) if state["players"][pid]["can_vote"]
            and not (state["pk_round"] and pid in state["vote_candidates"])]


def _resolve_vote(state: Dict) -> None:
    counts = Counter(target for target in state["ballots"].values() if target is not None)
    leaders = [pid for pid in state["turn_order"] if counts.get(pid, 0) == max(counts.values(), default=0) and counts.get(pid)]
    state["vote_history"].append({"day": state["day"], "pk": state["pk_round"],
                                  "ballots": copy.deepcopy(state["ballots"]), "leaders": leaders[:]})
    if len(leaders) > 1 and not state["pk_round"]:
        state.update(pk_round=True, vote_candidates=leaders)
        _log(state, "放逐平票，平票玩家依座次进行 PK 发言，其余有票玩家复投。")
        _speeches(state, leaders)
    elif len(leaders) == 1:
        target = leaders[0]
        player = state["players"][target]
        if player["role"] == "idiot" and not player["revealed"]:
            player.update(revealed=True, can_vote=False)
            _log(state, f"{_name(state, target)} 亮出白痴身份，免于本次放逐，此后失去投票权。")
            state.update(last_deaths=[], ready=[])
            _phase(state, "dusk_review")
        else:
            _deaths(state, {target: "banished"}, "dusk_review", [target])
    else:
        _log(state, "无人被放逐。" + ("复投仍平票。" if leaders else ""))
        state.update(last_deaths=[], ready=[])
        _phase(state, "dusk_review")


class WerewolfGame:
    game_id = "werewolf"
    min_players = 6
    max_players = 16

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not Draft7Validator(CONFIG_SCHEMA).is_valid({} if config is None else config):
            raise ValueError("Invalid Werewolf configuration.")
        if not 6 <= len(players) <= 16:
            raise ValueError("Werewolf needs 6–16 players.")
        players = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in players]
        if any(not isinstance(player_id, str) or not player_id for player_id in ids) or len(set(ids)) != len(ids):
            raise ValueError("Player IDs must be unique nonempty strings.")
        return {"game_id": "werewolf", "version": 1, "game_token": secrets.token_hex(16),
                "window_id": 0, "revision": 0, "config": {}, "turn_order": ids, "dealer": ids[0],
                "players": {player["player_id"]: {"name": player.get("name") or player["player_id"],
                            "role": None, "alive": True, "can_vote": True, "revealed": False,
                            "save": True, "poison": True, "last_guard": None, "inspections": []} for player in players},
                "phase": "setup", "current_turn": ids[0], "day": 1, "ready": [], "log": [],
                "role_counts": recommended_roles(len(ids)), "win_rule": "side", "self_save": "first_night",
                "allow_wolf_self_attack": False,
                "last_deaths": [], "vote_history": [], "ballots": {}, "wolf_votes": {},
                "night_actors": [], "vote_candidates": [], "pk_round": False,
                "winning_team": None, "winner": [], "game_over": False}

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        phase = state["phase"]
        player = state["players"][player_id]
        if phase == "setup":
            return ["deal"] if player_id == state["dealer"] else []
        if phase == "identity":
            return ["ready"] if player_id not in state["ready"] else []
        if phase in ("dawn_review", "dusk_review"):
            return ["next_round"] if player_id not in state["ready"] else []
        if phase == "night" and player_id in state["night_actors"]:
            step = NIGHT_STEPS[state["night_step"]]
            return [] if player_id in state["wolf_votes"] else [{"wolves": "wolf_vote", "seer": "inspect"}.get(step, step)]
        if phase == "death_skill":
            return ["shoot"] if player_id == state["current_turn"] else []
        if phase == "last_words":
            return ["end_speech"] if player_id == state["current_turn"] else []
        if not player["alive"]:
            return []
        if phase == "vote":
            return ["vote"] if player_id in _voters(state) and player_id not in state["ballots"] else []
        if phase == "discussion":
            actions = ["end_speech"] if player_id == state["current_turn"] else []
            if player["role"] in WOLVES:
                actions.append("explode")
            elif player["role"] == "knight" and not player["revealed"]:
                actions.append("duel")
            return actions
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action) or type(action.get("window_id")) is not int:
            return [], "Invalid action schema."
        if action["game_token"] != state["game_token"] or action["window_id"] != state["window_id"]:
            return [], "This action belongs to an old game or phase."
        kind = action["type"]
        if kind not in WerewolfGame.get_legal_actions(state, player_id):
            return [], "It is not your turn, or this action is already submitted."
        player = state["players"][player_id]
        target = action.get("target")
        if kind in ("guard", "wolf_vote", "inspect", "vote", "shoot", "explode", "duel", "witch"):
            if target is not None and target not in _alive(state):
                return [], "Choose a living player."
        if kind in ("inspect", "vote", "shoot", "explode", "duel") and target == player_id:
            return [], "You cannot target yourself."
        if kind in ("inspect", "duel") and target is None:
            return [], "Choose a target."
        if kind == "wolf_vote" and target is not None and _wolf(state, target) and not state.get("allow_wolf_self_attack", False):
            return [], "Wolf self-attacks and attacks on teammates are disabled for this game."
        if kind == "guard" and target is not None and player["last_guard"] == target:
            return [], "You cannot guard the same player on consecutive nights."
        if kind == "vote" and target is not None and target not in (state["vote_candidates"] if state["pk_round"] else _alive(state)):
            return [], "Choose a player in this ballot."
        if kind == "explode" and ((player["role"] == "white_wolf") != (target is not None)):
            return [], "White Wolf must take one other player. Other wolves explode without a target."
        if kind == "deal":
            roles = action.get("roles", state["role_counts"])
            if any(type(count) is not int for count in roles.values()) or sum(roles.values()) != len(state["turn_order"]):
                return [], "Role counts must exactly match the number of players."
            wolf_count = sum(roles.get(role, 0) for role in WOLVES)
            if not 1 <= wolf_count < len(state["turn_order"]) / 2 or not roles.get("villager") or not any(roles.get(role) for role in ROLE_INFO if role not in (*WOLVES, "villager")):
                return [], "Include villagers, at least one god and wolves fewer than half the table."
            if any(roles.get(role, 0) > 1 for role in ROLE_INFO if role not in ("werewolf", "villager")):
                return [], "Each special role may appear only once."
            deck = [role for role, count in roles.items() for index in range(count)]
            secrets.SystemRandom().shuffle(deck)
            for member_id, role in zip(state["turn_order"], deck):
                state["players"][member_id]["role"] = role
            state.update(role_counts={role: roles.get(role, 0) for role in ROLE_INFO},
                         win_rule=action.get("win_rule", "side"), self_save=action.get("self_save", "first_night"),
                         allow_wolf_self_attack=action.get("allow_wolf_self_attack", False), ready=[])
            _phase(state, "identity")
            _log(state, "身份已私密发放，请各自确认。")
        elif kind == "ready":
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["turn_order"]):
                _night(state)
        elif kind == "next_round":
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["turn_order"]):
                state["ready"] = []
                if not _check_win(state):
                    if state["phase"] == "dawn_review":
                        _speeches(state)
                    else:
                        state["day"] += 1
                        _night(state)
        elif kind == "guard":
            player["last_guard"] = target
            state["night"]["guard"] = target
            _next_night_step(state)
        elif kind == "wolf_vote":
            state["wolf_votes"][player_id] = target
            if len(state["wolf_votes"]) == len(state["night_actors"]):
                counts = Counter(vote for vote in state["wolf_votes"].values() if vote is not None)
                leaders = [member_id for member_id, votes in counts.items() if votes == max(counts.values())]
                state["night"]["kill"] = leaders[0] if len(leaders) == 1 else None
                _next_night_step(state)
        elif kind == "witch":
            choice = action.get("choice")
            victim = state["night"]["kill"]
            if choice not in ("save", "poison", "pass"):
                return [], "Choose one potion or pass."
            if choice == "save":
                if not player["save"] or victim is None or (victim == player_id and not (state["self_save"] == "first_night" and state["day"] == 1)):
                    return [], "Antidote is unavailable, or self-save is forbidden tonight."
                player["save"] = False
                state["night"]["saved"] = True
            elif choice == "poison":
                if not player["poison"] or target is None or target == player_id:
                    return [], "Choose another living player and an unused poison potion."
                player["poison"] = False
                state["night"]["poison"] = target
            _next_night_step(state)
        elif kind == "inspect":
            player["inspections"].append({"day": state["day"], "target": target, "team": "wolves" if _wolf(state, target) else "good"})
            _next_night_step(state)
        elif kind == "end_speech":
            if state["phase"] == "last_words":
                _next_death(state)
            else:
                _next_speech(state)
        elif kind == "vote":
            state["ballots"][player_id] = target
            if len(state["ballots"]) == len(_voters(state)):
                _resolve_vote(state)
        elif kind == "shoot":
            if target:
                victim = state["players"][target]
                victim.update(alive=False, death_reason="shot")
                state["last_deaths"].append(target)
                _log(state, f"{_name(state, player_id)} 发动技能，带走 {_name(state, target)}。")
                if victim["role"] in ("hunter", "wolf_king"):
                    state["death_queue"].append(target)
            else:
                _log(state, f"{_name(state, player_id)} 放弃发动出局技能。")
            _next_death(state)
        elif kind == "explode":
            player["revealed"] = True
            deaths = {player_id: "explode"}
            if target:
                deaths[target] = "taken"
            _log(state, f"{_name(state, player_id)} 自爆，白天结束。")
            _deaths(state, deaths, "dusk_review", [])
        elif kind == "duel":
            player["revealed"] = True
            _log(state, f"{_name(state, player_id)} 发起骑士决斗，目标为 {_name(state, target)}。")
            if _wolf(state, target):
                state["players"][target]["revealed"] = True
                _deaths(state, {target: "duel"}, "dusk_review", [])
            else:
                state.update(speech_queue=[member_id for member_id in state["speech_queue"] if member_id != player_id])
                player.update(alive=False, death_reason="duel")
                state["last_deaths"] = [player_id]
                _log(state, f"{_name(state, player_id)} 决斗失败并出局，继续发言。")
                if not _check_win(state) and state["current_turn"] == player_id:
                    _next_speech(state)
        state["revision"] += 1
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id)
        legal = WerewolfGame.get_legal_actions(state, viewer_id)
        view = {key: copy.deepcopy(state[key]) for key in (
            "game_id", "game_token", "window_id", "revision", "phase", "day", "dealer", "ready", "role_counts",
            "win_rule", "self_save", "last_deaths", "vote_history", "vote_candidates", "pk_round", "log",
            "game_over", "winning_team", "winner")}
        view.update(you=viewer_id, legal_actions=legal, allow_wolf_self_attack=state.get("allow_wolf_self_attack", False),
                    current_turn=None if state["phase"] == "night" else state["current_turn"],
                    players=[{"player_id": player_id, "name": state["players"][player_id]["name"], "seat": index + 1,
                              "alive": state["players"][player_id]["alive"], "can_vote": state["players"][player_id]["can_vote"],
                              "role": state["players"][player_id]["role"] if state["game_over"] or state["players"][player_id]["revealed"] else None}
                             for index, player_id in enumerate(state["turn_order"])],
                    role_info=copy.deepcopy(ROLE_INFO), own=None, submitted=[], wolf_team=[], wolf_votes={}, victim=None)
        if own:
            view["own"] = {key: copy.deepcopy(own[key]) for key in ("role", "save", "poison", "last_guard", "inspections")}
            if own["role"] in WOLVES:
                view["wolf_team"] = [{"player_id": player_id, "role": state["players"][player_id]["role"]}
                                     for player_id in state["turn_order"] if _wolf(state, player_id)]
                if state["phase"] == "night":
                    view["wolf_votes"] = copy.deepcopy(state["wolf_votes"])
            if "witch" in legal and own["save"]:
                view["victim"] = state["night"]["kill"]
        if state["phase"] == "vote":
            view["submitted"] = list(state["ballots"])
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        kind = next((kind for kind in WerewolfGame.get_legal_actions(state, bot_id)
                     if kind not in ("explode", "duel")), None)
        if kind is None:
            return None
        action = {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"]}
        if kind in ("wolf_vote", "inspect", "vote"):
            targets = [player_id for player_id in _alive(state) if player_id != bot_id]
            if kind == "wolf_vote":
                targets = [player_id for player_id in targets if not _wolf(state, player_id)]
            elif kind == "vote" and state["pk_round"]:
                targets = [player_id for player_id in targets if player_id in state["vote_candidates"]]
            action["target"] = next(iter(targets), None)
        elif kind in ("guard", "shoot"):
            action["target"] = None
        elif kind == "witch":
            action["choice"] = "pass"
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        try:
            state.setdefault("allow_wolf_self_attack", False)
            if state["game_id"] != "werewolf" or state["version"] != 1:
                raise ValueError("Invalid Werewolf save version.")
            if not 6 <= len(state["turn_order"]) <= 16 or len(set(state["turn_order"])) != len(state["turn_order"]) or set(state["players"]) != set(state["turn_order"]):
                raise ValueError("Invalid saved players.")
            if state["phase"] not in ("setup", "identity", "night", "discussion", "vote", "death_skill", "last_words", "dawn_review", "dusk_review", "game_over"):
                raise ValueError("Invalid saved phase.")
            if any(player["role"] not in (None, *ROLE_INFO) for player in state["players"].values()):
                raise ValueError("Invalid saved roles.")
            if state["phase"] != "setup" and any(player["role"] is None for player in state["players"].values()):
                raise ValueError("Missing saved roles.")
            if state["phase"] == "night" and not 0 <= state["night_step"] < len(NIGHT_STEPS):
                raise ValueError("Invalid saved night.")
            ids = set(state["turn_order"])
            if any(type(state[key]) is not int or state[key] < minimum
                   for key, minimum in (("window_id", 0), ("revision", 0), ("day", 1))):
                raise ValueError("Invalid saved counters.")
            if not isinstance(state["game_token"], str) or not state["game_token"] or state["dealer"] not in ids:
                raise ValueError("Invalid saved game identity.")
            if state["win_rule"] not in ("side", "all") or state["self_save"] not in ("never", "first_night"):
                raise ValueError("Invalid saved rules.")
            if type(state["allow_wolf_self_attack"]) is not bool:
                raise ValueError("Invalid saved wolf self-attack rule.")
            if type(state["game_over"]) is not bool or state["game_over"] != (state["phase"] == "game_over"):
                raise ValueError("Invalid saved game status.")
            if state["phase"] in ("discussion", "last_words", "death_skill") and state["current_turn"] not in ids:
                raise ValueError("Invalid saved actor.")
            if state["phase"] == "discussion" and not state["players"][state["current_turn"]]["alive"]:
                raise ValueError("Invalid saved speaker.")
            for key in ("ready", "vote_candidates", "night_actors", "last_deaths"):
                if not isinstance(state[key], list) or len(state[key]) != len(set(state[key])) or not set(state[key]) <= ids:
                    raise ValueError("Invalid saved player list.")
            for player in state["players"].values():
                if any(type(player[key]) is not bool for key in ("alive", "can_vote", "revealed", "save", "poison")):
                    raise ValueError("Invalid saved player status.")
                if player["last_guard"] is not None and player["last_guard"] not in ids:
                    raise ValueError("Invalid saved guard target.")
                if not isinstance(player["inspections"], list) or any(
                    record["target"] not in ids or record["team"] not in ("good", "wolves")
                    or type(record["day"]) is not int or not 1 <= record["day"] <= state["day"]
                    for record in player["inspections"]
                ):
                    raise ValueError("Invalid saved inspections.")
            if state["phase"] == "night":
                step = NIGHT_STEPS[state["night_step"]]
                actors = [player_id for player_id in _alive(state)
                          if (_wolf(state, player_id) if step == "wolves"
                              else state["players"][player_id]["role"] == step)]
                if state["night_actors"] != actors or not actors:
                    raise ValueError("Invalid saved night actors.")
                if any(state["night"][key] is not None and state["night"][key] not in ids for key in ("guard", "kill", "poison")):
                    raise ValueError("Invalid saved night target.")
            WerewolfGame.get_public_view(state, state["turn_order"][0])
        except (KeyError, TypeError, IndexError, AttributeError) as exc:
            raise ValueError("Invalid Werewolf save.") from exc
        return state
