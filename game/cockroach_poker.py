import copy
import json
import math
import random
import secrets
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


CREATURES = json.loads((Path(__file__).parent / "assets/cockroach_poker/creatures.json").read_text())
KINDS = [creature["id"] for creature in CREATURES]
CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}
ACTION_SCHEMA = {
    "type": "object",
    "required": ["type", "revision"],
    "properties": {
        "type": {"enum": ["offer", "judge", "peek", "pass", "continue", "confirm"]},
        "revision": {"type": "integer", "minimum": 0},
        "card": {"type": "string"},
        "target": {"type": "string"},
        "claim": {"enum": KINDS},
        "believe": {"type": "boolean"},
    },
    "additionalProperties": False,
}
ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _targets(state: Dict, actor: str) -> List[str]:
    seen = state["pending"]["seen"] if state["pending"] else [actor]
    return [player_id for player_id in state["turn_order"] if player_id not in seen and player_id != actor]


def _finish(state: Dict, loser: str, reason: str) -> None:
    state["loser"] = loser
    state["loss_reason"] = reason
    state["winners"] = [player_id for player_id in state["turn_order"] if player_id != loser]
    state["phase"] = "final_review"
    state["ready"] = []
    state["review_revision"] = state["revision"] + 1


def _next_offer(state: Dict) -> None:
    state["pending"] = None
    state["ready"] = []
    state["phase"] = "offer"
    if not state["players"][state["active_player"]]["hand"]:
        _finish(state, state["active_player"], "empty_hand")


def _resolve(state: Dict, believe: bool) -> None:
    pending = state["pending"]
    truthful = pending["card"]["kind"] == pending["claim"]
    correct = believe == truthful
    collector = pending["sender"] if correct else pending["receiver"]
    state["players"][collector]["collection"].append(pending["card"])
    result = {
        "round": state["round"], "card": copy.deepcopy(pending["card"]),
        "sender": pending["sender"], "receiver": pending["receiver"],
        "claim": pending["claim"], "believe": believe, "correct": correct,
        "collector": collector, "trail": copy.deepcopy(pending["trail"]),
    }
    state["last_result"] = result
    for step in pending["trail"]:
        profile = state["profiles"][step["sender"]]
        profile["truth" if step["claim"] == pending["card"]["kind"] else "lie"] += 1
    state["profiles"][pending["receiver"]]["believe" if believe else "doubt"] += 1
    state["log"].append(copy.deepcopy(result))
    state["log"] = state["log"][-64:]
    state["active_player"] = collector
    state["pending"] = None
    state["ready"] = []
    state["phase"] = "review"
    state["review_revision"] = state["revision"] + 1
    counts = Counter(card["kind"] for card in state["players"][collector]["collection"])
    if counts[pending["card"]["kind"]] >= state["loss_limit"]:
        _finish(state, collector, "same_kind")
    elif not state["players"][collector]["hand"]:
        _finish(state, collector, "empty_hand")


def _collection_risk(player: Dict, kind: str, limit: int) -> float:
    count = player["counts"][kind]
    return 140.0 if count + 1 >= limit else 1.0 + 1.8 * count + count ** 2


def _truth_probability(view: Dict, receiver: str, sender: str, claim: str) -> float:
    known = Counter(card["kind"] for card in view["hand"])
    for player in view["players"]:
        known.update(player["counts"])
    remaining = {kind: max(0, 8 - known[kind]) for kind in KINDS}
    total = sum(remaining.values())
    if not remaining[claim]:
        return 0.0
    if remaining[claim] == total:
        return 1.0
    sender_profile = view["profiles"][sender]
    honesty = (sender_profile["truth"] + 2.5) / (sender_profile["truth"] + sender_profile["lie"] + 5)
    base = remaining[claim] / max(1, total)
    prior = (honesty + 2 * base) / 3
    target = next(player for player in view["players"] if player["player_id"] == receiver)
    pressure = target["counts"][claim] / view["loss_limit"]
    return min(0.94, max(0.06, prior - 0.12 * pressure))


def _choose_deception(view: Dict, card: Dict, actor: str, targets: List[str]) -> Dict:
    candidates = []
    limit = view["loss_limit"]
    own = next(player for player in view["players"] if player["player_id"] == actor)
    own_cost = _collection_risk(own, card["kind"], limit)
    if view["hand_count"] == 0 or (view["phase"] == "offer" and view["hand_count"] == 1):
        own_cost = 160.0
    for target_id in targets:
        target = next(player for player in view["players"] if player["player_id"] == target_id)
        profile = view["profiles"][target_id]
        learned_belief = (profile["believe"] + 2) / (profile["believe"] + profile["doubt"] + 4)
        for claim in KINDS:
            pressure = target["counts"][claim] / limit
            acceptance = min(0.87, max(0.13, learned_belief - 0.22 * pressure))
            caught = 1 - acceptance if claim == card["kind"] else acceptance
            harm = _collection_risk(target, card["kind"], limit)
            if target["hand_count"] == 0:
                harm = 160.0
            score = caught * harm - (1 - caught) * own_cost
            candidates.append((score, {"target": target_id, "claim": claim}))
    best = max(score for score, _ in candidates)
    weights = [math.exp((score - best) / 2.5) / (1 if action["claim"] == card["kind"] else 7)
               for score, action in candidates]
    return random.choices([action for _, action in candidates], weights=weights, k=1)[0]


def _bot_policy(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    actor = view["you"]
    action = {"revision": view["revision"]}
    if "confirm" in legal or "continue" in legal:
        return {**action, "type": legal[0]}
    if "offer" in legal:
        own = next(player for player in view["players"] if player["player_id"] == actor)
        choices = []
        for kind in KINDS:
            if not any(card["kind"] == kind for card in view["hand"]):
                continue
            card = next(card for card in view["hand"] if card["kind"] == kind)
            worst = _collection_risk(own, kind, view["loss_limit"])
            attack = max(_collection_risk(player, kind, view["loss_limit"])
                         for player in view["players"] if player["player_id"] != actor)
            choices.append((attack - 1.25 * worst, card))
        best = max(score for score, _ in choices)
        card = random.choices([card for _, card in choices],
                              weights=[math.exp((score - best) / 3) for score, _ in choices], k=1)[0]
        return {**action, "type": "offer", "card": card["id"],
                **_choose_deception(view, card, actor, view["targets"])}
    if "pass" in legal:
        return {**action, "type": "pass",
                **_choose_deception(view, view["pending"]["card"], actor, view["targets"])}
    pending = view["pending"]
    probability = _truth_probability(view, actor, pending["sender"], pending["claim"])
    if probability in (0, 1):
        return {**action, "type": "judge", "believe": probability == 1}
    own = next(player for player in view["players"] if player["player_id"] == actor)
    sender = next(player for player in view["players"] if player["player_id"] == pending["sender"])
    claim_cost = _collection_risk(own, pending["claim"], view["loss_limit"])
    other_cost = sum(_collection_risk(own, kind, view["loss_limit"])
                     for kind in KINDS if kind != pending["claim"]) / 7
    sender_claim = _collection_risk(sender, pending["claim"], view["loss_limit"])
    sender_other = sum(_collection_risk(sender, kind, view["loss_limit"])
                       for kind in KINDS if kind != pending["claim"]) / 7
    if own["hand_count"] == 0:
        claim_cost = other_cost = 160.0
    if sender["hand_count"] == 0:
        sender_claim = sender_other = 160.0
    believe_value = probability * sender_claim - (1 - probability) * other_cost
    doubt_value = (1 - probability) * sender_other - probability * claim_cost
    confidence = max(probability, 1 - probability)
    if "peek" in legal and 0 < probability < 1 and (min(claim_cost, other_cost) >= 5 or confidence < 0.76):
        return {**action, "type": "peek"}
    probability_believe = 1 / (1 + math.exp(max(-40, min(40, (doubt_value - believe_value) / 0.7))))
    return {**action, "type": "judge", "believe": random.random() < probability_believe}


class CockroachPokerGame:
    game_id = "cockroach_poker"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not CONFIG_VALIDATOR.is_valid({} if config is None else config):
            raise ValueError("Cockroach Poker uses the classic rules without configuration.")
        order = [player["player_id"] for player in players]
        if not 2 <= len(order) <= 6 or len(set(order)) != len(order):
            raise ValueError("Cockroach Poker needs 2–6 distinct players.")
        deck = [{"id": secrets.token_hex(8), "kind": kind} for kind in KINDS for _ in range(8)]
        random.shuffle(deck)
        removed = [deck.pop() for _ in range(10)] if len(order) == 2 else []
        state = {
            "config": {}, "turn_order": order, "player_meta": copy.deepcopy(players),
            "players": {player_id: {"hand": [], "collection": []} for player_id in order},
            "removed": removed, "loss_limit": 5 if len(order) == 2 else 4,
            "active_player": random.choice(order), "phase": "offer", "round": 1,
            "revision": 0, "review_revision": None, "pending": None, "last_result": None, "log": [], "ready": [],
            "profiles": {player_id: {"truth": 0, "lie": 0, "believe": 0, "doubt": 0} for player_id in order},
            "loser": None, "loss_reason": None, "winners": [], "game_over": False,
        }
        for index, card in enumerate(deck):
            state["players"][order[index % len(order)]]["hand"].append(card)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] in ("review", "final_review"):
            return [] if player_id in state["ready"] else ["confirm" if state["phase"] == "final_review" else "continue"]
        if state["phase"] == "offer":
            return ["offer"] if player_id == state["active_player"] else []
        if player_id != state["pending"]["receiver"]:
            return []
        if state["phase"] == "pass":
            return ["pass"]
        return ["judge", "peek"] if _targets(state, player_id) else ["judge"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action."
        action_type = action["type"]
        independent_confirmation = (
            action_type in ("continue", "confirm")
            and state["phase"] in ("review", "final_review")
            and state["review_revision"] <= action["revision"] <= state["revision"]
        )
        if action["revision"] != state["revision"] and not independent_confirmation:
            return [], "This decision has already changed."
        if action_type not in CockroachPokerGame.get_legal_actions(state, player_id):
            return [], "It is not your decision."
        if action_type in ("offer", "pass"):
            if action.get("target") not in _targets(state, player_id) or action.get("claim") not in KINDS:
                return [], "Choose an eligible player and a creature claim."
            if action_type == "offer":
                card = next((card for card in state["players"][player_id]["hand"] if card["id"] == action.get("card")), None)
                if card is None:
                    return [], "Choose a card from your hand."
                state["players"][player_id]["hand"].remove(card)
                state["pending"] = {"card": card, "seen": [player_id], "trail": []}
            pending = state["pending"]
            pending.update(sender=player_id, receiver=action["target"], claim=action["claim"])
            pending["trail"].append({"sender": player_id, "receiver": action["target"], "claim": action["claim"]})
            state["phase"] = "receive"
        elif action_type == "peek":
            state["pending"]["seen"].append(player_id)
            state["phase"] = "pass"
        elif action_type == "judge":
            if "believe" not in action:
                return [], "Choose true or false before revealing."
            _resolve(state, action["believe"])
        else:
            state["ready"].append(player_id)
            if len(state["ready"]) == len(state["turn_order"]):
                if state["phase"] == "final_review":
                    state["phase"] = "game_over"
                    state["game_over"] = True
                else:
                    state["round"] += 1
                    _next_offer(state)
        state["revision"] += 1
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for meta in state["player_meta"]:
            player_id = meta["player_id"]
            player = state["players"][player_id]
            counts = Counter(card["kind"] for card in player["collection"])
            players.append({"player_id": player_id, "name": meta.get("name", "Guest"),
                            "seat": meta.get("seat"), "is_bot": bool(meta.get("is_bot")),
                            "hand_count": len(player["hand"]), "is_you": player_id == viewer_id,
                            "counts": {kind: counts[kind] for kind in KINDS},
                            "ready": player_id in state["ready"]})
        pending = None
        if state["pending"]:
            pending = {key: copy.deepcopy(value) for key, value in state["pending"].items() if key != "card"}
            pending["card"] = copy.deepcopy(state["pending"]["card"]) if viewer_id in pending["seen"] else None
        hand = state["players"].get(viewer_id, {}).get("hand", [])
        return {
            "game_id": CockroachPokerGame.game_id, "you": viewer_id, "players": players,
            "hand": copy.deepcopy(hand), "hand_count": len(hand), "creatures": copy.deepcopy(CREATURES),
            "phase": state["phase"], "round": state["round"], "revision": state["revision"],
            "active_player": state["active_player"], "loss_limit": state["loss_limit"],
            "pending": pending, "last_result": copy.deepcopy(state["last_result"]),
            "log": copy.deepcopy(state["log"]), "profiles": copy.deepcopy(state["profiles"]),
            "loser": state["loser"], "loss_reason": state["loss_reason"], "winners": state["winners"][:],
            "ready": state["ready"][:], "game_over": state["game_over"],
            "targets": _targets(state, viewer_id) if viewer_id in state["players"] else [],
            "legal_actions": CockroachPokerGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _bot_policy(CockroachPokerGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
