import copy
import json
import random
import secrets
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional, Tuple


BEANS = json.loads((Path(__file__).parent / "assets/bohnanza/beans.json").read_text())
BEAN_TYPES = {bean["id"]: bean for bean in BEANS}
CONFIG_SCHEMA = {
    "type": "object", "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "maxLength": 80}]}
    }, "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object", "properties": {
        "type": {"enum": ["plant", "harvest", "reveal", "offer", "accept", "reject",
                           "cancel", "finish_trade", "end_turn", "next_round", "confirm", "play_again"]},
        "revision": {"type": "integer", "minimum": 0},
        "field": {"type": "integer", "minimum": 0, "maximum": 2},
        "card": {"type": "string"}, "target": {"type": "string"},
        "give": {"type": "array", "items": {"type": "string"}, "maxItems": 104,
                 "uniqueItems": True},
        "want": {"type": "array", "items": {"enum": list(BEAN_TYPES)}, "maxItems": 104},
    }, "required": ["type"], "additionalProperties": False,
}


def bean_kind(card: str) -> str:
    return card.rsplit(":", 1)[0]


def harvest_value(kind: str, count: int) -> int:
    return max([0] + [value for value, threshold in enumerate(BEAN_TYPES[kind]["thresholds"], 1)
                      if threshold is not None and count >= threshold])


def _harvestable(player: Dict, index: int) -> bool:
    field = player["fields"][index]
    return bool(field) and (len(field) > 1 or all(len(other) <= 1 for other in player["fields"]))


def _harvest(state: Dict, player_id: str, index: int) -> int:
    player = state["players"][player_id]
    field = player["fields"][index]
    value = harvest_value(bean_kind(field[0]), len(field)) if field else 0
    player["gold"].extend(field[:value])
    state["discard"].extend(field[value:])
    player["fields"][index] = []
    return value


def _draw(state: Dict) -> Optional[str]:
    if not state["deck"] or state["exhaustions"] >= 3:
        return None
    card = state["deck"].pop(0)
    if not state["deck"]:
        state["exhaustions"] += 1
        if state["exhaustions"] < 3:
            state["deck"], state["discard"] = state["discard"], []
            random.Random(f'{state["seed"]}:shuffle:{state["exhaustions"]}').shuffle(state["deck"])
    return card


def _finish(state: Dict) -> None:
    state["final_fields"] = {pid: copy.deepcopy(player["fields"])
                             for pid, player in state["players"].items()}
    state["final_scores"] = []
    for player_id in state["turn_order"]:
        before = len(state["players"][player_id]["gold"])
        fields = []
        for index in range(len(state["players"][player_id]["fields"])):
            field = state["players"][player_id]["fields"][index]
            kind, count = (bean_kind(field[0]) if field else None), len(field)
            fields.append({"bean": kind, "count": count, "gold": _harvest(state, player_id, index)})
        state["final_scores"].append({"player_id": player_id, "previous_gold": before,
                                      "fields": fields, "total": len(state["players"][player_id]["gold"])})
    best = max(len(player["gold"]) for player in state["players"].values())
    state["winner_ids"] = [next(pid for pid in reversed(state["turn_order"])
                                if len(state["players"][pid]["gold"]) == best)]
    state.update(phase="final_review", current_turn=None, offer=None, final_ready=[],
                 review_revision=state["revision"] + 1)


def _start_turn(state: Dict) -> None:
    state["planted"] = 0
    state["market"] = []
    state["offer"] = None
    player = state["players"][state["current_turn"]]
    state["phase"] = "plant_hand" if player["hand"] else "reveal"


def _plant_complete(state: Dict) -> None:
    if any(player["pending"] for player in state["players"].values()):
        return
    if state["exhaustions"] >= 3 or not state["deck"]:
        _finish(state)
    else:
        state["phase"] = "draw"


def _available(state: Dict, player_id: str) -> List[str]:
    cards = list(state["players"][player_id]["hand"])
    if player_id == state["current_turn"]:
        cards += state["market"]
    return cards


class BohnanzaGame:
    game_id = "bohnanza"
    min_players = 3
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or set(config) - {"seed"}:
            raise ValueError("Invalid Bohnanza configuration")
        seed = config.get("seed", secrets.token_hex(16))
        if type(seed) is not int and not (isinstance(seed, str) and len(seed) <= 80):
            raise ValueError("Invalid seed")
        if not 3 <= len(players) <= 5:
            raise ValueError("Bohnanza requires 3–5 players")
        meta = {player["player_id"]: dict(player) for player in players}
        if len(meta) != len(players):
            raise ValueError("Player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        deck = [f'{bean["id"]}:{index}' for bean in BEANS for index in range(bean["count"])]
        random.Random(seed).shuffle(deck)
        state = {
            "version": 1, "seed": seed, "config": {}, "players": {}, "player_meta": meta,
            "turn_order": order, "current_turn": order[0], "deck": deck, "discard": [],
            "market": [], "exhaustions": 0, "revision": 0, "turn_number": 1,
            "round_number": 1, "next_round_ready": [], "history": [], "offer": None,
            "game_over": False, "winner_ids": [], "final_fields": {}, "final_scores": [],
            "final_ready": [], "review_revision": None,
        }
        for player_id in order:
            state["players"][player_id] = {
                "hand": deck[:5], "fields": [[] for _ in range(3 if len(order) == 3 else 2)],
                "gold": [], "pending": [],
            }
            del deck[:5]
        _start_turn(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        if state["game_over"]:
            return ["play_again"]
        phase = state["phase"]
        if phase == "round_summary":
            return [] if player_id in state["next_round_ready"] else ["next_round"]
        if phase == "final_review":
            return [] if player_id in state["final_ready"] else ["confirm"]
        player = state["players"][player_id]
        actions = ["harvest"] if any(_harvestable(player, index)
                                    for index in range(len(player["fields"]))) else []
        active = player_id == state["current_turn"]
        if phase == "plant_hand" and active:
            actions += ["plant"] if player["hand"] and state["planted"] < 2 else []
            if state["planted"] or not player["hand"]:
                actions.append("reveal")
        elif phase == "reveal" and active:
            actions.append("reveal")
        elif phase == "trade":
            offer = state["offer"]
            if offer:
                if player_id == offer["to"]:
                    actions += ["accept", "reject"]
                if player_id == offer["from"]:
                    actions.append("cancel")
            else:
                actions.append("offer")
                if active:
                    actions.append("finish_trade")
        elif phase == "plant_traded" and player["pending"]:
            actions.append("plant")
        elif phase == "draw" and active:
            actions.append("end_turn")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "Invalid action"
        kind = action["type"]
        fields = {
            "plant": {"field", "card"}, "harvest": {"field"},
            "offer": {"target", "give", "want"}, "accept": {"give"},
        }.get(kind, set())
        if set(action) - fields - {"type", "revision"}:
            return [], "Unexpected action fields"
        if "revision" in action:
            revision = action["revision"]
            independent = (kind in ("next_round", "confirm") and state["review_revision"] is not None
                           and type(revision) is int and state["review_revision"] <= revision <= state["revision"])
            if type(revision) is not int or (revision != state["revision"] and not independent):
                return [], "The table changed. Please try again."
        if kind not in BohnanzaGame.get_legal_actions(state, player_id):
            return [], "Action not available"
        if kind == "play_again":
            revision = state["revision"] + 1
            fresh = BohnanzaGame.init_game({}, list(state["player_meta"].values()))
            state.clear()
            state.update(fresh, revision=revision)
            return [{"type": "bohnanza:play_again", "payload": {"player_id": player_id}}], None
        player = state["players"][player_id]
        record = {"type": kind, "player_id": player_id, "turn": state["turn_number"]}
        if kind in ("plant", "harvest"):
            index = action.get("field")
            if type(index) is not int or not 0 <= index < len(player["fields"]):
                return [], "Choose a field"
            if kind == "harvest":
                if not _harvestable(player, index):
                    return [], "A single bean is protected while another field has multiple beans"
                record.update(bean=bean_kind(player["fields"][index][0]),
                              count=len(player["fields"][index]), gold=_harvest(state, player_id, index))
            else:
                source = player["hand"] if state["phase"] == "plant_hand" else player["pending"]
                card = action.get("card")
                if not isinstance(card, str) or card not in source:
                    return [], "Choose an available bean"
                if state["phase"] == "plant_hand" and card != source[0]:
                    return [], "You must plant the first card in your hand"
                field = player["fields"][index]
                if field and bean_kind(field[0]) != bean_kind(card):
                    return [], "Harvest this field before planting a different bean"
                source.remove(card)
                field.append(card)
                record["bean"] = bean_kind(card)
                if state["phase"] == "plant_hand":
                    state["planted"] += 1
                    if state["planted"] == 2 or not player["hand"]:
                        state["phase"] = "reveal"
                else:
                    _plant_complete(state)
        elif kind == "reveal":
            state["market"] = []
            for _ in range(2):
                card = _draw(state)
                if card is not None:
                    state["market"].append(card)
            state["phase"] = "trade"
        elif kind == "offer":
            target, give, want = action.get("target"), action.get("give"), action.get("want")
            if not isinstance(target, str) or target not in state["players"] or target == player_id:
                return [], "Choose another player"
            if state["current_turn"] not in (player_id, target):
                return [], "Every trade must involve the active player"
            if (not isinstance(give, list) or not isinstance(want, list) or
                    len(give) > 104 or len(want) > 104 or not (give or want) or
                    any(not isinstance(card, str) for card in give) or len(set(give)) != len(give) or
                    any(not isinstance(bean, str) or bean not in BEAN_TYPES for bean in want)):
                return [], "Invalid trade"
            if any(card not in _available(state, player_id) for card in give):
                return [], "You can only trade your hand and your own revealed beans"
            state["offer"] = {"from": player_id, "to": target, "give": list(give), "want": list(want)}
            record.update(target=target, give=[bean_kind(card) for card in give], want=list(want))
        elif kind == "accept":
            offer = state["offer"]
            available = _available(state, player_id)
            received = []
            if "give" in action:
                received = action["give"]
                if (not isinstance(received, list) or len(received) > 104 or
                        any(not isinstance(card, str) for card in received) or
                        len(set(received)) != len(received) or
                        any(card not in available for card in received) or
                        Counter(bean_kind(card) for card in received) != Counter(offer["want"])):
                    return [], "Choose exactly the requested beans from your available cards"
            else:
                for bean in offer["want"]:
                    card = next((item for item in available if bean_kind(item) == bean), None)
                    if card is None:
                        return [], "You do not have the requested beans"
                    available.remove(card)
                    received.append(card)
            for owner, recipient, cards in ((offer["from"], player_id, offer["give"]),
                                             (player_id, offer["from"], received)):
                for card in cards:
                    source = state["market"] if card in state["market"] else state["players"][owner]["hand"]
                    source.remove(card)
                    state["players"][recipient]["pending"].append(card)
            record["offer"] = copy.deepcopy(offer)
            state["offer"] = None
        elif kind in ("reject", "cancel"):
            state["offer"] = None
        elif kind == "finish_trade":
            player["pending"].extend(state["market"])
            state["market"] = []
            state["phase"] = "plant_traded"
            _plant_complete(state)
        elif kind == "end_turn":
            for _ in range(3):
                card = _draw(state)
                if card is not None:
                    player["hand"].append(card)
            if state["exhaustions"] >= 3 or not state["deck"]:
                _finish(state)
            else:
                order = state["turn_order"]
                state["current_turn"] = order[(order.index(player_id) + 1) % len(order)]
                state["turn_number"] += 1
                if (state["turn_number"] - 1) % len(order) == 0:
                    state.update(phase="round_summary", next_round_ready=[], review_revision=state["revision"] + 1)
                else:
                    _start_turn(state)
        elif kind == "next_round":
            state["next_round_ready"].append(player_id)
            if set(state["next_round_ready"]) == set(state["turn_order"]):
                state["round_number"] += 1
                state["next_round_ready"] = []
                _start_turn(state)
        elif kind == "confirm":
            state["final_ready"].append(player_id)
            if set(state["final_ready"]) == set(state["turn_order"]):
                state.update(phase="game_over", game_over=True)
        state["revision"] += 1
        state["history"].append(record)
        state["history"] = state["history"][-60:]
        return [{"type": "bohnanza:" + kind, "payload": record}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            own = player_id == viewer_id
            fields = []
            for index, field in enumerate(player["fields"]):
                kind = bean_kind(field[0]) if field else None
                fields.append({"bean": kind, "count": len(field),
                               "gold": harvest_value(kind, len(field)) if kind else 0,
                               "harvestable": _harvestable(player, index)})
            players.append({
                "player_id": player_id, "name": state["player_meta"][player_id].get("name", player_id),
                "fields": fields, "hand_count": len(player["hand"]),
                "hand": list(player["hand"]) if own else [],
                "gold": len(player["gold"]) if own or state["phase"] in ("final_review", "game_over") else None,
                "pending": list(player["pending"]),
                "final_fields": [[bean_kind(card) for card in field]
                                 for field in state["final_fields"].get(player_id, [])],
            })
        return {
            "game_id": "bohnanza", "you": viewer_id, "players": players,
            "beans": copy.deepcopy(BEANS), "phase": state["phase"], "revision": state["revision"],
            "current_turn": state["current_turn"], "round_number": state["round_number"],
            "turn_number": state["turn_number"], "exhaustions": state["exhaustions"],
            "deck_count": len(state["deck"]), "discard_count": len(state["discard"]),
            "market": list(state["market"]), "offer": copy.deepcopy(state["offer"]),
            "legal_actions": BohnanzaGame.get_legal_actions(state, viewer_id),
            "next_round_ready": list(state["next_round_ready"]),
            "history": copy.deepcopy(state["history"]), "game_over": state["game_over"],
            "winner_ids": list(state["winner_ids"]), "planted": state["planted"],
            "final_scores": copy.deepcopy(state["final_scores"]), "final_ready": list(state["final_ready"]),
        }

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(data: Dict) -> Dict:
        return copy.deepcopy(data)

    @staticmethod
    def bot_move(state: Dict, player_id: str) -> Optional[Dict]:
        view = BohnanzaGame.get_public_view(state, player_id)
        actions = view["legal_actions"]
        if not actions:
            return None
        if actions == ["play_again"]:
            return None
        player = next(player for player in view["players"] if player["player_id"] == player_id)
        active = view["current_turn"] == player_id

        def value(bean: str) -> float:
            scores = []
            for field in player["fields"]:
                count = field["count"] if field["bean"] == bean else 0
                marginal = harvest_value(bean, count + 1) - harvest_value(bean, count)
                threshold = next((threshold for threshold in BEAN_TYPES[bean]["thresholds"]
                                  if threshold is not None and threshold > count), count + 1)
                cost = 0 if field["bean"] in (None, bean) else 0.7 + field["count"] * 0.12
                scores.append(marginal + 1 / max(1, threshold - count) - cost)
            return max(scores)

        if "confirm" in actions or "next_round" in actions:
            return {"type": "confirm" if "confirm" in actions else "next_round"}
        if "accept" in actions:
            offer = view["offer"]
            counts = Counter(bean_kind(card) for card in _available(state, player_id))
            affordable = not (Counter(offer["want"]) - counts)
            gain = sum(value(bean_kind(card)) for card in offer["give"])
            cost = sum(max(0.15, value(bean)) for bean in offer["want"])
            return {"type": "accept" if affordable and gain >= cost else "reject"}
        if "cancel" in actions:
            return None
        if "plant" in actions:
            cards = player["hand"][:1] if view["phase"] == "plant_hand" else player["pending"]
            cards = sorted(cards, key=lambda card: value(bean_kind(card)), reverse=True)
            for card in cards:
                for index, field in sorted(enumerate(player["fields"]),
                                           key=lambda item: item[1]["bean"] != bean_kind(card)):
                    if field["bean"] in (None, bean_kind(card)):
                        if view["phase"] == "plant_hand" and view["planted"] and value(bean_kind(card)) < 0.2:
                            return {"type": "reveal"}
                        return {"type": "plant", "card": card, "field": index}
            if view["phase"] == "plant_hand" and view["planted"]:
                return {"type": "reveal"}
            choices = [(index, field) for index, field in enumerate(player["fields"]) if field["harvestable"]]
            index, _ = min(choices, key=lambda item: item[1]["count"] - item[1]["gold"] * 1.7)
            return {"type": "harvest", "field": index}
        if "reveal" in actions:
            return {"type": "reveal"}
        if "finish_trade" in actions and active:
            for card in view["market"]:
                bean = bean_kind(card)
                if value(bean) > 0.1:
                    continue
                candidates = [other for other in view["players"] if other["player_id"] != player_id
                              and any(field["bean"] == bean for field in other["fields"])]
                rejected = any(record["type"] == "offer" and record["turn"] == view["turn_number"]
                               and bean in record.get("give", []) for record in view["history"])
                if candidates and not rejected:
                    return {"type": "offer", "target": candidates[0]["player_id"], "give": [card], "want": []}
            return {"type": "finish_trade"}
        if "end_turn" in actions:
            return {"type": "end_turn"}
        return None
