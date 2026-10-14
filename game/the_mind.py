"""The Mind: standard cooperative play, with explicit online focus/review windows."""
import copy
import random
import secrets
import time
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


MAX_LEVEL = {2: 12, 3: 10, 4: 8}
REWARDS = {2: "stars", 3: "lives", 5: "stars", 6: "lives", 8: "stars", 9: "lives"}
LIMITS = {"lives": 5, "stars": 3}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["ready", "play", "pause", "request_star", "vote_star", "next_round"]},
        "game_token": {"type": "string"},
        "window_id": {"type": "integer", "minimum": 0},
        "card": {"type": "integer", "minimum": 1, "maximum": 100},
        "agree": {"type": "boolean"},
    },
    "required": ["type", "game_token", "window_id"],
    "additionalProperties": False,
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["window_id"] += 1
    state["ready"] = []


def _record(state: Dict, kind: str, **fields) -> Dict:
    entry = {"kind": kind, "level": state["level"], **fields}
    state["log"].append(entry)
    state["log"] = state["log"][-100:]
    return entry


def _focus(state: Dict, reason: str, notice: Optional[Dict] = None) -> None:
    _phase(state, "focus")
    state.update(focus_reason=reason, notice=notice, star_votes={}, star_requester=None)


def _deal(state: Dict) -> None:
    deck = list(range(1, 101))
    random.Random(f"{state['seed']}:{state['level']}").shuffle(deck)
    for player in state["players"].values():
        player["hand"] = sorted(deck.pop() for _ in range(state["level"]))
    state.update(deck=deck, pile=[], discarded=[], round_summary=None, round_lost_lives=0,
                 round_stars_used=0, clock_anchor_ms=0, next_ready=[])
    _focus(state, "new_level")
    _record(state, "new_level")


def _summary(state: Dict, reward: Optional[Dict] = None) -> Dict:
    return {
        "level": state["level"], "lost_lives": state["round_lost_lives"],
        "stars_used": state["round_stars_used"], "reward": reward,
        "players": [{
            "player_id": pid,
            "played": [e["card"] for e in state["pile"] if e["player_id"] == pid],
            "missed": [e["card"] for e in state["discarded"] if e["player_id"] == pid and e["reason"] == "mistake"],
            "starred": [e["card"] for e in state["discarded"] if e["player_id"] == pid and e["reason"] == "star"],
        } for pid in state["turn_order"]],
    }


def _check_end(state: Dict) -> bool:
    if state["lives"] == 0:
        _phase(state, "game_over")
        state.update(game_over=True, won=False, winner=[], round_summary=_summary(state))
        _record(state, "defeat")
        return True
    if any(p["hand"] for p in state["players"].values()):
        return False
    resource = REWARDS.get(state["level"])
    reward = None
    if resource:
        gain = int(state[resource] < LIMITS[resource])
        state[resource] += gain
        reward = {"resource": resource, "amount": gain, "at_cap": not gain}
    state["round_summary"] = _summary(state, reward)
    state["next_ready"] = []
    if state["level"] == state["max_level"]:
        _phase(state, "game_over")
        state.update(game_over=True, won=True, winner=state["turn_order"][:])
        _record(state, "victory")
    else:
        _phase(state, "round_end")
        _record(state, "level_complete", reward=reward)
    return True


def _play(state: Dict, pid: str, card: int) -> None:
    state["players"][pid]["hand"].remove(card)
    played = {"player_id": pid, "card": card}
    state["pile"].append(played)
    _record(state, "play", **played)
    missed = []
    for other, player in state["players"].items():
        missed.extend({"player_id": other, "card": c, "reason": "mistake"} for c in player["hand"] if c < card)
        player["hand"] = [c for c in player["hand"] if c > card]
    if missed:
        missed.sort(key=lambda e: e["card"])
        state["discarded"].extend(missed)
        state["lives"] -= 1
        state["round_lost_lives"] += 1
        notice = _record(state, "mistake", played=played, cards=missed)
        _focus(state, "mistake", notice)
    else:
        state["clock_anchor_ms"] = _now_ms()
    _check_end(state)


def _use_star(state: Dict) -> None:
    cards = [{"player_id": pid, "card": p["hand"].pop(0), "reason": "star"}
             for pid, p in state["players"].items() if p["hand"]]
    state["stars"] -= 1
    state["round_stars_used"] += 1
    state["discarded"].extend(cards)
    notice = _record(state, "star", cards=cards)
    _focus(state, "star", notice)
    _check_end(state)


class TheMindGame:
    game_id = "the_mind"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config) or ("seed" in config and type(config["seed"]) is not int):
            raise ValueError("Invalid The Mind configuration.")
        if len(players) not in MAX_LEVEL:
            raise ValueError("The Mind needs 2–4 players.")
        players = sorted(players, key=lambda p: p.get("seat", 0))
        ids = [p["player_id"] for p in players]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("Player IDs must be unique nonempty strings.")
        state = {
            "game_id": TheMindGame.game_id, "version": 1, "config": copy.deepcopy(config),
            "game_token": secrets.token_hex(16), "seed": config.get("seed", secrets.token_hex(16)),
            "window_id": 0, "revision": 0, "level": 1, "max_level": MAX_LEVEL[len(ids)],
            "lives": len(ids), "stars": 1, "turn_order": ids,
            "players": {pid: {"hand": []} for pid in ids},
            "player_meta": {p["player_id"]: {"name": p.get("name") or p["player_id"],
                                               "seat": p.get("seat", 0), "is_bot": bool(p.get("is_bot"))} for p in players},
            "game_over": False, "won": False, "winner": [], "current_turn": None, "log": [],
        }
        _deal(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        phase = state["phase"]
        if phase == "focus":
            return [] if player_id in state["ready"] else ["ready"]
        if phase == "round_end":
            return [] if player_id in state["next_ready"] else ["next_round"]
        if phase == "star_vote":
            return [] if player_id in state["star_votes"] else ["vote_star"]
        if phase == "playing":
            return (["play"] if state["players"][player_id]["hand"] else []) + ["pause"] + (["request_star"] if state["stars"] else [])
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if any(type(action[key]) is not int for key in ("window_id", "card") if key in action):
            return [], "Action numbers must be integers."
        if action["game_token"] != state["game_token"] or action["window_id"] != state["window_id"]:
            return [], "This action belongs to an old game or phase."
        kind = action["type"]
        if kind not in TheMindGame.get_legal_actions(state, player_id):
            return [], "Action unavailable, or already submitted."
        fields = {"card"} if kind == "play" else {"agree"} if kind == "vote_star" else set()
        if set(action) != {"type", "game_token", "window_id"} | fields:
            return [], "Unexpected or missing action fields."
        if kind == "play" and action["card"] != state["players"][player_id]["hand"][0]:
            return [], "Play only the lowest card in your hand."
        if kind == "ready":
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["players"]):
                _phase(state, "playing")
                state.update(clock_anchor_ms=_now_ms(), notice=None)
        elif kind == "play":
            _play(state, player_id, action["card"])
        elif kind == "pause":
            _focus(state, "pause", _record(state, "pause", player_id=player_id))
        elif kind == "request_star":
            _phase(state, "star_vote")
            state.update(star_votes={player_id: True}, star_requester=player_id, notice=None)
            _record(state, "request_star", player_id=player_id)
        elif kind == "vote_star":
            state["star_votes"][player_id] = action["agree"]
            if not action["agree"]:
                _focus(state, "star_declined", _record(state, "star_declined", player_id=player_id))
            elif len(state["star_votes"]) == len(state["players"]):
                _use_star(state)
        elif kind == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["players"]):
                state["level"] += 1
                _deal(state)
        state["revision"] += 1
        # Actions never echo private cards, seed, or a bot's planned wait.
        return [{"type": "the_mind:action", "payload": {"player_id": player_id, "type": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        keys = ("game_id", "game_token", "window_id", "revision", "level", "max_level", "phase",
                "lives", "stars", "pile", "discarded", "ready", "next_ready", "star_votes", "star_requester",
                "focus_reason", "notice", "round_summary", "game_over", "won", "winner", "log")
        view = {key: state[key] for key in keys}
        view.update(you=viewer_id, hand=state["players"].get(viewer_id, {}).get("hand", []),
                    legal_actions=TheMindGame.get_legal_actions(state, viewer_id),
                    players=[{"player_id": pid, **state["player_meta"][pid], "hand_count": len(state["players"][pid]["hand"])}
                             for pid in state["turn_order"]])
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        # Timing is public game activity, kept out of browser views to avoid a
        # counting aid. No opponent hand, deck, or seed is used by the policy.
        view = TheMindGame.get_public_view(state, bot_id)
        return _choose_bot_action(view, _now_ms() - state["clock_anchor_ms"])

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        if not isinstance(state, dict) or state.get("version") != 1 or state.get("game_id") != TheMindGame.game_id:
            raise ValueError("Invalid The Mind save.")
        try:
            ids = state["turn_order"]
            if len(ids) not in MAX_LEVEL or len(set(ids)) != len(ids) or set(ids) != set(state["players"]):
                raise ValueError("Invalid saved players.")
            if state["phase"] not in ("focus", "playing", "star_vote", "round_end", "game_over"):
                raise ValueError("Invalid saved phase.")
            if state["max_level"] != MAX_LEVEL[len(ids)] or not 1 <= state["level"] <= state["max_level"]:
                raise ValueError("Invalid saved level.")
            if not 0 <= state["lives"] <= 5 or not 0 <= state["stars"] <= 3:
                raise ValueError("Invalid saved resources.")
            cards = state["deck"] + [e["card"] for e in state["pile"] + state["discarded"]]
            for player in state["players"].values():
                if player["hand"] != sorted(player["hand"]):
                    raise ValueError("Invalid saved hand.")
                cards += player["hand"]
            if any(type(c) is not int for c in cards) or sorted(cards) != list(range(1, 101)):
                raise ValueError("Invalid saved deck.")
            TheMindGame.get_public_view(state, ids[0])
        except (KeyError, TypeError, IndexError) as exc:
            raise ValueError("Invalid The Mind save.") from exc
        return state


def _choose_bot_action(view: Dict, elapsed_ms: int) -> Optional[Dict]:
    legal = view["legal_actions"]
    action = {"game_token": view["game_token"], "window_id": view["window_id"]}
    for kind in ("ready", "next_round", "vote_star"):
        if kind in legal:
            return {**action, "type": kind, **({"agree": True} if kind == "vote_star" else {})}
    if "play" not in legal:
        return None
    public_cards = [e["card"] for e in view["pile"] + view["discarded"]]
    gap = max(1, view["hand"][0] - max(public_cards, default=0))
    # Slightly different private tempos imitate fallible practice partners.
    seat = next(p["seat"] for p in view["players"] if p["player_id"] == view["you"])
    delay = max(650, gap * (190 + (seat % 4) * 17))
    if elapsed_ms < delay:
        return None
    return {**action, "type": "play", "card": view["hand"][0]}
