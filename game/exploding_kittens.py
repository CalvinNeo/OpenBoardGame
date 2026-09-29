"""Exploding Kittens, Original Edition (2022), with explicit online reactions."""

import copy
import random
import secrets
from collections import Counter
from typing import Dict, List, Optional, Tuple


CARD_TYPES = {
    "exploding_kitten": {"name": "Exploding Kitten", "zh": "爆炸猫", "emoji": "💥", "count": 4},
    "defuse": {"name": "Defuse", "zh": "拆弹", "emoji": "🧯", "count": 6},
    "nope": {"name": "Nope", "zh": "否决", "emoji": "🙅", "count": 5},
    "attack": {"name": "Attack", "zh": "攻击", "emoji": "⚡", "count": 4},
    "skip": {"name": "Skip", "zh": "跳过", "emoji": "⏭️", "count": 4},
    "favor": {"name": "Favor", "zh": "索取", "emoji": "🎁", "count": 4},
    "shuffle": {"name": "Shuffle", "zh": "洗牌", "emoji": "🔀", "count": 4},
    "see_future": {"name": "See the Future", "zh": "预知未来", "emoji": "🔮", "count": 5},
    "tacocat": {"name": "Tacocat", "zh": "墨西哥卷猫", "emoji": "🌮", "count": 4},
    "cattermelon": {"name": "Cattermelon", "zh": "西瓜猫", "emoji": "🍉", "count": 4},
    "hairy_potato_cat": {"name": "Hairy Potato Cat", "zh": "毛毛土豆猫", "emoji": "🥔", "count": 4},
    "beard_cat": {"name": "Beard Cat", "zh": "胡子猫", "emoji": "🧔", "count": 4},
    "rainbow_cat": {"name": "Rainbow-Ralphing Cat", "zh": "彩虹猫", "emoji": "🌈", "count": 4},
}
SINGLE_CARDS = ("attack", "skip", "favor", "shuffle", "see_future")
CAT_CARDS = tuple(list(CARD_TYPES)[8:])
ACTION_FIELDS = {
    "draw": set(), "play": {"card_ids"}, "pass": set(), "nope": set(),
    "give": {"card_id"}, "continue": set(), "defuse": set(),
    "reinsert": {"position"}, "next_round": set(),
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": list(ACTION_FIELDS)},
        "game_token": {"type": "string"}, "window_id": {"type": "integer", "minimum": 0},
        "card_ids": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 3, "uniqueItems": True},
        "card_id": {"type": "string"}, "target_id": {"type": "string"},
        "requested_kind": {"enum": list(CARD_TYPES)},
        "position": {"type": "integer", "minimum": 0},
    },
    "required": ["type", "game_token", "window_id"], "additionalProperties": False,
}
CONFIG_SCHEMA = {
    "type": "object", "properties": {"seed": {"oneOf": [
        {"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80},
    ]}}, "additionalProperties": False,
}


def _rng(state: Dict) -> random.Random:
    state["rng_counter"] += 1
    return random.Random("{}:{}".format(state["seed"], state["rng_counter"]))


def _alive(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if state["players"][pid]["alive"]]


def _next_alive(state: Dict, player_id: str) -> str:
    order = state["turn_order"]
    start = order.index(player_id)
    return next(order[(start + offset) % len(order)] for offset in range(1, len(order) + 1)
                if state["players"][order[(start + offset) % len(order)]]["alive"])


def _phase(state: Dict, phase: str) -> None:
    state["phase"] = phase
    state["window_id"] += 1


def _log(state: Dict, kind: str, player_id: str, **extra) -> None:
    state["log_serial"] += 1
    state["history"].append({"number": state["log_serial"], "type": kind, "player_id": player_id, **extra})
    state["history"] = state["history"][-80:]


def _invalidate_future(state: Dict) -> None:
    # Do not silently refresh a remembered peek from hidden deck information.
    state["future"] = {}


def _finish_turn(state: Dict) -> None:
    state["turns_left"] -= 1
    state["turn_number"] += 1
    if state["turns_left"] == 0:
        state["future"].pop(state["current_turn"], None)
        state["current_turn"] = _next_alive(state, state["current_turn"])
        state["turns_left"] = 1
        state["under_attack"] = False
    _phase(state, "playing")


def _eliminate(state: Dict, player_id: str) -> None:
    player = state["players"][player_id]
    player["alive"] = False
    state["discard"].extend(player["hand"])
    player["hand"] = []
    state["discard"].append(state["held_kitten"])
    state["held_kitten"] = None
    state["eliminated"].append(player_id)
    _log(state, "exploded", player_id)
    survivors = _alive(state)
    state["review_player"] = player_id
    state["ready"] = []
    state["under_attack"] = False
    state["turns_left"] = 1
    if len(survivors) == 1:
        state["winner_ids"] = survivors
        state["current_turn"] = None
        state["game_over"] = True
        _phase(state, "game_over")
        _log(state, "winner", survivors[0])
    else:
        state["current_turn"] = _next_alive(state, player_id)
        _phase(state, "elimination_review")


def _resolve(state: Dict) -> None:
    pending = state["pending"]
    state["pending"] = None
    actor, effect = pending["actor"], pending["effect"]
    _phase(state, "playing")
    if pending["nope_count"] % 2:
        _log(state, "cancelled", actor, effect=effect)
        return
    _log(state, "resolved", actor, effect=effect)
    if effect == "attack":
        state["future"].pop(actor, None)
        state["turns_left"] = state["turns_left"] + 2 if state["under_attack"] else 2
        state["under_attack"] = True
        state["current_turn"] = _next_alive(state, actor)
        state["turn_number"] += 1
    elif effect == "skip":
        _finish_turn(state)
    elif effect == "shuffle":
        _rng(state).shuffle(state["deck"])
        _invalidate_future(state)
    elif effect == "see_future":
        state["future"][actor] = copy.deepcopy(state["deck"][:3])
        _phase(state, "future")
    elif effect == "favor":
        state["favor"] = {"actor": actor, "target_id": pending["target_id"]}
        _phase(state, "favor")
    elif effect in ("pair", "triple"):
        target = pending["target_id"]
        hand = state["players"][target]["hand"]
        card = _rng(state).choice(hand) if effect == "pair" else next(
            (card for card in hand if card["kind"] == pending["requested_kind"]), None)
        if card:
            hand.remove(card)
            state["players"][actor]["hand"].append(card)
        _log(state, "stolen" if card else "missed", actor, target_id=target,
             **({"requested_kind": pending["requested_kind"]} if effect == "triple" else {}))


def _validate_play(state: Dict, player_id: str, action: Dict) -> Optional[str]:
    ids = action.get("card_ids")
    if (not isinstance(ids, list) or not 1 <= len(ids) <= 3
            or not all(isinstance(cid, str) for cid in ids) or len(ids) != len(set(ids))):
        return "select one card or two / three matching cards"
    own = {card["id"]: card for card in state["players"][player_id]["hand"]}
    if any(cid not in own for cid in ids):
        return "card is not in your hand"
    kinds = [own[cid]["kind"] for cid in ids]
    if len(ids) == 1 and kinds[0] not in SINGLE_CARDS:
        return "this card cannot be played on its own now"
    if len(ids) > 1 and (len(set(kinds)) != 1 or kinds[0] == "exploding_kitten"):
        return "a combo needs matching card names"
    fields = {"type", "game_token", "window_id", "card_ids"}
    if len(ids) > 1 or kinds[0] == "favor":
        fields.add("target_id")
        target = action.get("target_id")
        if not isinstance(target, str) or target == player_id or target not in _alive(state):
            return "choose another living player"
        if not state["players"][target]["hand"]:
            return "target has no cards"
    if len(ids) == 3:
        fields.add("requested_kind")
        requested = action.get("requested_kind")
        if not isinstance(requested, str) or requested not in CARD_TYPES or requested == "exploding_kitten":
            return "choose a card name to request"
    if set(action) != fields:
        return "invalid play fields"
    return None


class ExplodingKittensGame:
    game_id = "exploding_kittens"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else config
        if not isinstance(cfg, dict) or set(cfg) - {"seed"}:
            raise ValueError("invalid Exploding Kittens configuration")
        seed = cfg.get("seed", secrets.token_hex(20))
        if type(seed) is not int and not (isinstance(seed, str) and 1 <= len(seed) <= 80):
            raise ValueError("invalid seed")
        if not 2 <= len(players) <= 5:
            raise ValueError("Exploding Kittens requires 2 to 5 players")
        meta = {p["player_id"]: dict(p) for p in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        state = {
            "version": 1, "config": {}, "seed": seed, "rng_counter": 0,
            "game_token": secrets.token_hex(16), "window_id": 0, "revision": 0,
            "player_meta": meta, "turn_order": order,
            "players": {pid: {"hand": [], "alive": True} for pid in order},
            "deck": [], "discard": [], "removed": [], "future": {},
            "held_kitten": None, "pending": None, "favor": None,
            "phase": "playing", "turn_number": 1, "turns_left": 1, "under_attack": False,
            "history": [], "log_serial": 0, "ready": [], "review_player": None,
            "eliminated": [], "winner_ids": [], "game_over": False,
        }
        cards = {kind: [{"id": secrets.token_hex(10), "kind": kind} for _ in range(data["count"])]
                 for kind, data in CARD_TYPES.items()}
        deck = [card for kind, group in cards.items() if kind not in ("defuse", "exploding_kitten") for card in group]
        rng = _rng(state)
        rng.shuffle(deck)
        for pid in order:
            state["players"][pid]["hand"] = [cards["defuse"].pop()] + [deck.pop() for _ in range(7)]
        extras = 2 if len(order) <= 3 else len(cards["defuse"])
        deck.extend(cards["defuse"][:extras])
        deck.extend(cards["exploding_kitten"][:len(order) - 1])
        state["removed"] = cards["defuse"][extras:] + cards["exploding_kitten"][len(order) - 1:]
        rng.shuffle(deck)
        state["deck"] = deck
        state["current_turn"] = rng.choice(order)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        player = state["players"].get(player_id)
        if not player or state["game_over"]:
            return []
        phase = state["phase"]
        if phase == "elimination_review":
            return [] if player_id in state["ready"] else ["next_round"]
        if not player["alive"]:
            return []
        if phase == "reaction":
            result = [] if player_id in state["pending"]["passed"] else ["pass"]
            if any(card["kind"] == "nope" for card in player["hand"]):
                result.append("nope")
            return result
        if phase == "favor":
            return ["give"] if player_id == state["favor"]["target_id"] else []
        if player_id != state["current_turn"]:
            return []
        if phase in ("future", "defuse", "reinsert"):
            return [{"future": "continue", "defuse": "defuse", "reinsert": "reinsert"}[phase]]
        if phase == "playing":
            return ["draw", "play"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        if (action.get("game_token") != state["game_token"] or type(action.get("window_id")) is not int
                or action["window_id"] != state["window_id"]):
            return [], "stale action; use the current game state"
        if kind not in ExplodingKittensGame.get_legal_actions(state, player_id):
            return [], "action not available"
        if kind == "play":
            error = _validate_play(state, player_id, action)
            if error:
                return [], error
        elif set(action) != {"type", "game_token", "window_id"} | ACTION_FIELDS[kind]:
            return [], "invalid action fields"
        if kind == "reinsert" and (type(action["position"]) is not int or not 0 <= action["position"] <= len(state["deck"])):
            return [], "choose a valid insertion position"
        hand = state["players"][player_id]["hand"]
        if kind == "give" and (not isinstance(action["card_id"], str) or not any(card["id"] == action["card_id"] for card in hand)):
            return [], "card is not in your hand"
        # Validation ends here. No invalid request may partially mutate state.
        first_log = state["log_serial"]
        if kind == "draw":
            if not state["deck"]:
                return [], "draw pile is empty"
            card = state["deck"].pop(0)
            _invalidate_future(state)
            if card["kind"] == "exploding_kitten":
                state["held_kitten"] = card
                _log(state, "kitten", player_id)
                if any(item["kind"] == "defuse" for item in hand):
                    _phase(state, "defuse")
                else:
                    _eliminate(state, player_id)
            else:
                hand.append(card)
                _log(state, "draw", player_id)
                _finish_turn(state)
        elif kind == "play":
            selected = [next(card for card in hand if card["id"] == cid) for cid in action["card_ids"]]
            for card in selected:
                hand.remove(card)
            state["discard"].extend(selected)
            effect = selected[0]["kind"] if len(selected) == 1 else "pair" if len(selected) == 2 else "triple"
            state["pending"] = {
                "actor": player_id, "effect": effect, "cards": copy.deepcopy(selected),
                "target_id": action.get("target_id"), "requested_kind": action.get("requested_kind"),
                "nope_count": 0, "passed": [player_id],
            }
            _phase(state, "reaction")
            _log(state, "play", player_id, effect=effect, card_kind=selected[0]["kind"], count=len(selected),
                 target_id=action.get("target_id"), requested_kind=action.get("requested_kind"))
        elif kind in ("pass", "nope"):
            pending = state["pending"]
            if kind == "nope":
                card = next(card for card in hand if card["kind"] == "nope")
                hand.remove(card)
                state["discard"].append(card)
                pending["nope_count"] += 1
                pending["passed"] = [player_id]
                _phase(state, "reaction")
                _log(state, "nope", player_id, cancelled=bool(pending["nope_count"] % 2))
            else:
                pending["passed"].append(player_id)
            if set(pending["passed"]) == set(_alive(state)):
                _resolve(state)
        elif kind == "give":
            card = next(card for card in hand if card["id"] == action["card_id"])
            hand.remove(card)
            actor = state["favor"]["actor"]
            state["players"][actor]["hand"].append(card)
            state["favor"] = None
            _log(state, "given", player_id, target_id=actor)
            _phase(state, "playing")
        elif kind == "continue":
            _phase(state, "playing")
        elif kind == "defuse":
            card = next(card for card in hand if card["kind"] == "defuse")
            hand.remove(card)
            state["discard"].append(card)
            _log(state, "defused", player_id)
            _phase(state, "reinsert")
        elif kind == "reinsert":
            state["deck"].insert(action["position"], state["held_kitten"])
            state["held_kitten"] = None
            _invalidate_future(state)
            _log(state, "reinserted", player_id)
            _finish_turn(state)
        elif kind == "next_round":
            state["ready"].append(player_id)
            if set(state["ready"]) == set(state["turn_order"]):
                state["review_player"] = None
                state["ready"] = []
                state["turn_number"] += 1
                _phase(state, "playing")
        state["revision"] += 1
        logs = [row for row in state["history"] if row["number"] > first_log]
        return [{"type": "exploding_kittens:update", "payload": {"moves": copy.deepcopy(logs)}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id)
        return {
            "game_id": ExplodingKittensGame.game_id, "you": viewer_id, "config": {},
            "game_token": state["game_token"], "window_id": state["window_id"], "revision": state["revision"],
            "phase": state["phase"], "current_turn": state["current_turn"],
            "turn_number": state["turn_number"], "turns_left": state["turns_left"], "under_attack": state["under_attack"],
            "players": [{"player_id": pid, "name": state["player_meta"][pid].get("name", pid),
                         "seat": state["player_meta"][pid].get("seat", 0),
                         "is_bot": bool(state["player_meta"][pid].get("is_bot")),
                         "alive": state["players"][pid]["alive"], "hand_count": len(state["players"][pid]["hand"])}
                        for pid in state["turn_order"]],
            "hand": copy.deepcopy(own["hand"]) if own else [],
            "future": copy.deepcopy(state["future"].get(viewer_id, [])),
            "deck_count": len(state["deck"]), "kitten_count": len(_alive(state)) - 1,
            "discard": copy.deepcopy(state["discard"]), "pending": copy.deepcopy(state["pending"]),
            "favor": copy.deepcopy(state["favor"]), "history": copy.deepcopy(state["history"]),
            "ready": list(state["ready"]), "review_player": state["review_player"],
            "winner_ids": list(state["winner_ids"]), "game_over": state["game_over"],
            "legal_actions": ExplodingKittensGame.get_legal_actions(state, viewer_id),
            "card_types": copy.deepcopy(CARD_TYPES),
        }

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        return ExplodingKittensGame.bot_move_from_view(ExplodingKittensGame.get_public_view(state, player_id))

    @staticmethod
    def bot_move_from_view(view: Dict) -> Optional[Dict]:
        legal, hand, me = view["legal_actions"], view["hand"], view["you"]
        if not legal:
            return None
        def action(kind: str, **fields) -> Dict:
            return {"type": kind, "game_token": view["game_token"], "window_id": view["window_id"], **fields}
        kinds = Counter(card["kind"] for card in hand)
        for kind in ("next_round", "continue", "defuse"):
            if kind in legal:
                return action(kind)
        if "reinsert" in legal:
            # During an Attack, protect our remaining draw; otherwise threaten the next seat.
            return action("reinsert", position=view["deck_count"] if view["turns_left"] > 1 else 0)
        if "give" in legal:
            priority = {kind: 0 for kind in CAT_CARDS}
            priority.update(shuffle=2, see_future=3, favor=4, skip=5, attack=6, nope=7, defuse=20)
            card = min(hand, key=lambda card: priority.get(card["kind"], 10))
            return action("give", card_id=card["id"])
        if view["phase"] == "reaction":
            pending = view["pending"]
            cancelled = pending["nope_count"] % 2
            alive = [p["player_id"] for p in view["players"] if p["alive"]]
            attack_target = alive[(alive.index(pending["actor"]) + 1) % len(alive)]
            threatened = pending["target_id"] == me or pending["effect"] == "attack" and attack_target == me
            defend = threatened and not cancelled
            restore = pending["actor"] == me and cancelled
            if "nope" in legal and (defend or restore):
                return action("nope")
            return action("pass") if "pass" in legal else None
        targets = [p for p in view["players"] if p["player_id"] != me and p["alive"] and p["hand_count"]]
        target = max(targets, key=lambda p: p["hand_count"])["player_id"] if targets else None
        def play(kind: str, count: int = 1, **fields) -> Dict:
            return action("play", card_ids=[c["id"] for c in hand if c["kind"] == kind][:count], **fields)
        if target:
            for kind in CAT_CARDS:
                if kinds[kind] >= 3:
                    return play(kind, 3, target_id=target, requested_kind="defuse")
                if kinds[kind] >= 2:
                    return play(kind, 2, target_id=target)
            if kinds["favor"] and not kinds["defuse"]:
                return play("favor", target_id=target)
        dangerous = bool(view["future"] and view["future"][0]["kind"] == "exploding_kitten")
        risk = view["kitten_count"] / max(1, view["deck_count"])
        if dangerous or view["under_attack"] or risk >= 0.3:
            for kind in ("attack", "skip"):
                if kinds[kind]:
                    return play(kind)
            if dangerous and kinds["shuffle"] and view["deck_count"] > view["kitten_count"]:
                return play("shuffle")
        if not view["future"] and risk >= 0.12 and kinds["see_future"]:
            return play("see_future")
        return action("draw")

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(data: Dict) -> Dict:
        state = copy.deepcopy(data)
        if not isinstance(state, dict) or state.get("version") != 1:
            raise ValueError("invalid Exploding Kittens save")
        try:
            if (not 2 <= len(state["turn_order"]) <= 5 or set(state["turn_order"]) != set(state["players"])
                    or state["phase"] not in {"playing", "reaction", "favor", "future", "defuse", "reinsert", "elimination_review", "game_over"}):
                raise ValueError("invalid players or phase")
            cards = state["deck"] + state["discard"] + state["removed"]
            cards += [card for p in state["players"].values() for card in p["hand"]]
            if state["held_kitten"]:
                cards.append(state["held_kitten"])
            if (len({card["id"] for card in cards}) != 56 or Counter(card["kind"] for card in cards)
                    != Counter({kind: info["count"] for kind, info in CARD_TYPES.items()})):
                raise ValueError("invalid saved cards")
            ExplodingKittensGame.get_public_view(state, state["turn_order"][0])
        except (KeyError, TypeError, AttributeError) as exc:
            raise ValueError("invalid Exploding Kittens save") from exc
        return state
