"""No Thanks! base game, with optional cumulative scoring across rounds."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


CARD_VALUES = tuple(range(3, 36))
REMOVED_COUNT = 9
ROUND_CARD_COUNT = 24
DEFAULT_CONFIG = {"rounds": 1}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {"type": {"enum": ["pass", "take", "next_round"]}},
    "required": ["type"],
    "additionalProperties": False,
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "rounds": {"type": "integer", "minimum": 1, "maximum": 5, "default": 1},
        "seed": {"oneOf": [
            {"type": "integer"},
            {"type": "string", "minLength": 1, "maxLength": 80},
        ]},
    },
    "additionalProperties": False,
}


def starting_chips(player_count: int) -> int:
    return 11 if player_count <= 5 else 9 if player_count == 6 else 7


def card_runs(cards: List[int]) -> List[List[int]]:
    runs: List[List[int]] = []
    for card in sorted(cards):
        if runs and card == runs[-1][-1] + 1:
            runs[-1].append(card)
        else:
            runs.append([card])
    return runs


def card_points(cards: List[int]) -> int:
    values = set(cards)
    return sum(card for card in values if card - 1 not in values)


def take_delta(cards: List[int], card: int, pot: int = 0) -> int:
    """Change in net score if this card and its chips are taken (lower is better)."""
    return card_points(cards + [card]) - card_points(cards) - pot


def _config(config: Optional[Dict]) -> Dict:
    if config is None:
        config = {}
    if not isinstance(config, dict) or set(config) - {"rounds", "seed"}:
        raise ValueError("invalid No Thanks! configuration")
    rounds = config.get("rounds", 1)
    if type(rounds) is not int or not 1 <= rounds <= 5:
        raise ValueError("rounds must be an integer from 1 to 5")
    result = {"rounds": rounds}
    if "seed" in config:
        seed = config["seed"]
        if type(seed) is not int and not (isinstance(seed, str) and 1 <= len(seed) <= 80):
            raise ValueError("invalid seed")
        result["seed"] = seed
    return result


def _start_round(state: Dict) -> None:
    rng = random.Random("{}:{}".format(state["base_seed"], state["round_number"]))
    cards = list(CARD_VALUES)
    rng.shuffle(cards)
    state["removed_cards"] = cards[:REMOVED_COUNT]
    state["deck"] = cards[REMOVED_COUNT:]
    state["current_card"] = state["deck"].pop()
    state["pot"] = 0
    state["phase"] = "playing"
    state["current_turn"] = state["start_player"]
    state["next_round_ready"] = []
    state["round_summary"] = None
    state["history"] = []
    state["turn_number"] = 0
    chips = starting_chips(len(state["turn_order"]))
    for player in state["players"].values():
        player.update(cards=[], chips=chips, round_score=None)


def _finish_round(state: Dict) -> None:
    scores = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        points = card_points(player["cards"])
        player["round_score"] = points - player["chips"]
        player["total_score"] += player["round_score"]
        scores.append({
            "player_id": pid, "card_points": points, "chips": player["chips"],
            "round_score": player["round_score"], "total_score": player["total_score"],
            "runs": card_runs(player["cards"]),
        })
    state["round_summary"] = {"round_number": state["round_number"], "players": scores}
    state["score_history"].append(copy.deepcopy(state["round_summary"]))
    state["current_turn"] = None
    state["next_round_ready"] = []
    state["game_over"] = state["round_number"] == state["config"]["rounds"]
    state["phase"] = "game_over" if state["game_over"] else "round_summary"
    if state["game_over"]:
        minimum = min(player["total_score"] for player in state["players"].values())
        state["winner_ids"] = [pid for pid in state["turn_order"]
                               if state["players"][pid]["total_score"] == minimum]


class NoThanksGame:
    game_id = "no_thanks"
    min_players = 3
    max_players = 7

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not NoThanksGame.min_players <= len(players) <= NoThanksGame.max_players:
            raise ValueError("No Thanks! requires 3 to 7 players")
        meta = {p["player_id"]: dict(p) for p in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        cfg = _config(config)
        base_seed = cfg.get("seed", secrets.token_hex(16))
        start = random.Random("{}:start".format(base_seed)).choice(order)
        state = {
            "version": 1, "config": cfg, "base_seed": base_seed,
            "player_meta": meta, "turn_order": order, "start_player": start,
            "players": {pid: {"cards": [], "chips": 0, "total_score": 0,
                              "round_score": None} for pid in order},
            "round_number": 1, "score_history": [], "winner_ids": [], "game_over": False,
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_summary":
            return [] if player_id in state["next_round_ready"] else ["next_round"]
        if state["phase"] != "playing" or state["current_turn"] != player_id:
            return []
        return ["take", "pass"] if state["players"][player_id]["chips"] > 0 else ["take"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if not isinstance(action, dict) or set(action) != {"type"} or not isinstance(action["type"], str):
            return [], "invalid action"
        kind = action["type"]
        # Repeated round confirmations must neither restart the round nor add scores.
        if kind == "next_round" and state["phase"] == "round_summary" and player_id in state["next_round_ready"]:
            return [], None
        if kind not in NoThanksGame.get_legal_actions(state, player_id):
            return [], "action not available"
        if kind == "next_round":
            state["next_round_ready"].append(player_id)
            events = [{"type": "no_thanks:ready", "payload": {"player_id": player_id}}]
            if set(state["next_round_ready"]) == set(state["turn_order"]):
                order = state["turn_order"]
                state["start_player"] = order[(order.index(state["start_player"]) + 1) % len(order)]
                state["round_number"] += 1
                _start_round(state)
                events.append({"type": "no_thanks:round_started", "payload": {"round_number": state["round_number"]}})
            return events, None

        player = state["players"][player_id]
        card = state["current_card"]
        state["turn_number"] += 1
        record = {"type": kind, "player_id": player_id, "card": card, "number": state["turn_number"]}
        if kind == "pass":
            player["chips"] -= 1
            state["pot"] += 1
            record["pot"] = state["pot"]
            order = state["turn_order"]
            state["current_turn"] = order[(order.index(player_id) + 1) % len(order)]
        else:
            record["pot"] = state["pot"]
            player["cards"].append(card)
            player["cards"].sort()
            player["chips"] += state["pot"]
            state["pot"] = 0
            # Taking retains the turn, including when the player has no chips.
            state["current_card"] = state["deck"].pop() if state["deck"] else None
            if state["current_card"] is None:
                _finish_round(state)
        state["history"].append(record)
        state["history"] = state["history"][-60:]
        events = [{"type": "no_thanks:" + kind, "payload": dict(record)}]
        if state["phase"] != "playing":
            events.append({"type": "no_thanks:round_scored", "payload": copy.deepcopy(state["round_summary"])})
            if state["game_over"]:
                events.append({"type": "no_thanks:game_over", "payload": {"winner_ids": list(state["winner_ids"])}})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        reveal = state["phase"] in ("round_summary", "game_over")
        players = []
        for pid in state["turn_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            points = card_points(player["cards"])
            visible = reveal or pid == viewer_id
            players.append({
                "player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", 0),
                "is_bot": bool(meta.get("is_bot")), "cards": list(player["cards"]),
                "runs": card_runs(player["cards"]), "card_points": points,
                "chips": player["chips"] if visible else None,
                "net_score": points - player["chips"] if visible else None,
                "round_score": player["round_score"] if reveal else None,
                "total_score": player["total_score"],
            })
        own = state["players"].get(viewer_id)
        return {
            "game_id": NoThanksGame.game_id, "you": viewer_id,
            "config": {"rounds": state["config"]["rounds"]},
            "phase": state["phase"], "round_number": state["round_number"],
            "total_rounds": state["config"]["rounds"], "turn_number": state["turn_number"],
            "current_turn": state["current_turn"], "start_player": state["start_player"],
            "players": players, "current_card": state["current_card"], "pot": state["pot"],
            "deck_count": len(state["deck"]), "removed_count": REMOVED_COUNT,
            "taken_count": sum(len(player["cards"]) for player in state["players"].values()),
            "starting_chips": starting_chips(len(players)),
            "your_chips": own["chips"] if own else None,
            "take_delta": take_delta(own["cards"], state["current_card"], state["pot"])
            if own is not None and state["current_card"] is not None else None,
            "legal_actions": NoThanksGame.get_legal_actions(state, viewer_id),
            "next_round_ready": list(state["next_round_ready"]),
            "round_summary": copy.deepcopy(state["round_summary"]),
            "score_history": copy.deepcopy(state["score_history"]),
            "history": copy.deepcopy(state["history"]),
            "winner_ids": list(state["winner_ids"]), "game_over": state["game_over"],
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.no_thanks_ai import choose_action

        action = choose_action(NoThanksGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 450} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
