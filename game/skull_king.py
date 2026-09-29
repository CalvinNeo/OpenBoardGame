"""Skull King: 70-card base game, classic scoring and Graybeard for two players."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


SUITS = ("green", "yellow", "purple", "black")
GHOST_ID = "__skull_king_graybeard__"
DEFAULT_CONFIG = {"schedule": "standard"}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "schedule": {"enum": ["standard", "quick"], "default": "standard"},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    },
    "additionalProperties": False,
}
_CONTEXT = {
    "game_token": {"type": "string"},
    "round_number": {"type": "integer", "minimum": 1},
    "trick_number": {"type": "integer", "minimum": 1},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {**_CONTEXT, "type": {"const": kind}, **fields},
     "required": ["type", *_CONTEXT, *required], "additionalProperties": False}
    for kind, fields, required in [
        ("bid", {"bid": {"type": "integer", "minimum": 0, "maximum": 10}}, ["bid"]),
        ("play", {"card_id": {"type": "string"}, "mode": {"enum": ["pirate", "escape"]}}, ["card_id"]),
        ("next_trick", {}, []), ("next_round", {}, []),
    ]
]}


def build_deck() -> List[Dict]:
    cards = [{"id": f"{suit}_{rank}", "kind": "number", "suit": suit, "rank": rank}
             for suit in SUITS for rank in range(1, 15)]
    for kind, count in (("escape", 5), ("pirate", 5), ("mermaid", 2), ("tigress", 1), ("skull_king", 1)):
        cards.extend({"id": f"{kind}_{index}", "kind": kind} for index in range(1, count + 1))
    return cards


def effective_kind(play: Dict) -> str:
    return play.get("mode", "escape") if play["card"]["kind"] == "tigress" else play["card"]["kind"]


def led_suit(trick: List[Dict]) -> Optional[str]:
    """Escapes defer the lead; a leading character prevents a later suit lead."""
    for play in trick:
        kind = effective_kind(play)
        if kind != "escape":
            return play["card"]["suit"] if kind == "number" else None
    return None


def resolve_trick(trick: List[Dict]) -> Dict:
    """Resolve a nonempty public trick; also used by the view-only practice bot."""
    if not trick:
        raise ValueError("cannot resolve an empty trick")
    kinds = [effective_kind(play) for play in trick]
    if "skull_king" in kinds:
        winner = kinds.index("mermaid") if "mermaid" in kinds else kinds.index("skull_king")
    elif "pirate" in kinds:
        winner = kinds.index("pirate")
    elif "mermaid" in kinds:
        winner = kinds.index("mermaid")
    else:
        numbers = [(i, play["card"]) for i, play in enumerate(trick) if kinds[i] == "number"]
        trumps = [(i, card) for i, card in numbers if card["suit"] == "black"]
        suit = led_suit(trick)
        candidates = trumps or [(i, card) for i, card in numbers if card["suit"] == suit]
        winner = max(candidates, key=lambda item: item[1]["rank"])[0] if candidates else 0
    bonuses = []
    for play in trick:
        card = play["card"]
        if card.get("rank") == 14:
            bonuses.append({"kind": "fourteen", "card_id": card["id"],
                            "points": 20 if card["suit"] == "black" else 10})
    capture = {"pirate": ("mermaid", 20), "skull_king": ("pirate", 30), "mermaid": ("skull_king", 40)}
    if kinds[winner] in capture:
        target, points = capture[kinds[winner]]
        for i, kind in enumerate(kinds):
            if i != winner and kind == target:
                bonuses.append({"kind": "capture", "card_id": trick[i]["card"]["id"], "points": points})
    return {"winner_id": trick[winner]["player_id"], "winning_card_id": trick[winner]["card"]["id"],
            "bonus": sum(bonus["points"] for bonus in bonuses), "bonuses": bonuses}


def score_round(bid: int, won: int, cards_dealt: int, bonus: int) -> Dict:
    exact = bid == won
    if bid == 0:
        base = cards_dealt * (10 if exact else -10)
    else:
        base = 20 * bid if exact else -10 * abs(bid - won)
    earned = bonus if exact else 0
    return {"bid": bid, "won": won, "exact": exact, "base": base,
            "bonus_available": bonus, "bonus": earned, "round_score": base + earned}


def _config(config: Optional[Dict]) -> Dict:
    config = {} if config is None else config
    if not isinstance(config, dict) or set(config) - {"schedule", "seed"}:
        raise ValueError("invalid Skull King configuration")
    if config.get("schedule", "standard") not in ("standard", "quick"):
        raise ValueError("schedule must be standard or quick")
    if "seed" in config and not (type(config["seed"]) is int or
                                (isinstance(config["seed"], str) and 1 <= len(config["seed"]) <= 80)):
        raise ValueError("invalid seed")
    return {**DEFAULT_CONFIG, **config}


def _sort_hand(cards: List[Dict]) -> List[Dict]:
    specials = {"escape": 4, "mermaid": 5, "pirate": 6, "tigress": 7, "skull_king": 8}
    return sorted(cards, key=lambda card: (
        SUITS.index(card["suit"]) if card["kind"] == "number" else specials[card["kind"]],
        card.get("rank", 0), card["id"],
    ))


def _start_round(state: Dict) -> None:
    deck = build_deck()
    random.Random(f"{state['base_seed']}:{state['round_number']}").shuffle(deck)
    order = state["turn_order"]
    count = 3 if len(order) == 2 else len(order)
    size = 5 if state["config"]["schedule"] == "quick" else min(state["round_number"], len(deck) // count)
    for pid in order:
        hand = [deck.pop() for _ in range(size)]
        state["players"][pid].update(hand=_sort_hand(hand), bid=None, won=0, bonus=0, round_score=None)
    state.update(
        ghost_hand=[deck.pop() for _ in range(size)] if len(order) == 2 else [],
        ghost_won=0, deck=deck, cards_dealt=size, phase="bidding", current_turn=None,
        trick_number=1, trick=[], trick_order=[], ready=[], round_summary=None,
        trick_result=None, trick_history=[],
    )


def _begin_trick(state: Dict, leader: str) -> None:
    order = state["turn_order"]
    if len(order) == 2:
        if leader == GHOST_ID:
            previous = state["trick_order"]
            index = previous.index(GHOST_ID)
            trick_order = previous[index:] + previous[:index]
        else:
            trick_order = [leader, GHOST_ID, next(pid for pid in order if pid != leader)]
    else:
        index = order.index(leader)
        trick_order = order[index:] + order[:index]
    state.update(phase="playing", trick_order=trick_order, current_turn=leader,
                 trick=[], trick_result=None, ready=[])
    _advance_ghost(state)


def _advance_ghost(state: Dict) -> None:
    if state["current_turn"] != GHOST_ID:
        return
    card = state["ghost_hand"].pop()
    play = {"player_id": GHOST_ID, "card": card}
    if card["kind"] == "tigress":
        play["mode"] = "escape"
    state["trick"].append(play)
    state["current_turn"] = state["trick_order"][len(state["trick"])]


def _finish_round(state: Dict) -> None:
    rows = []
    for pid in state["turn_order"]:
        player = state["players"][pid]
        row = score_round(player["bid"], player["won"], state["cards_dealt"], player["bonus"])
        player["round_score"] = row["round_score"]
        player["total_score"] += row["round_score"]
        rows.append({"player_id": pid, **row, "total_score": player["total_score"]})
    state["round_summary"] = {"round_number": state["round_number"], "cards_dealt": state["cards_dealt"], "players": rows}
    state["score_history"].append(copy.deepcopy(state["round_summary"]))
    state["game_over"] = state["round_number"] == state["total_rounds"]
    state["phase"] = "game_over" if state["game_over"] else "round_review"
    if state["game_over"]:
        high = max(player["total_score"] for player in state["players"].values())
        state["winner_ids"] = [pid for pid in state["turn_order"] if state["players"][pid]["total_score"] == high]


def _finish_trick(state: Dict) -> None:
    result = resolve_trick(state["trick"])
    result.update(trick_number=state["trick_number"], cards=copy.deepcopy(state["trick"]))
    state["trick_result"] = result
    state["trick_history"].append(copy.deepcopy(result))
    winner = result["winner_id"]
    if winner == GHOST_ID:
        state["ghost_won"] += 1
    else:
        state["players"][winner]["won"] += 1
        state["players"][winner]["bonus"] += result["bonus"]
    state.update(current_turn=None, ready=[], phase="trick_review")
    if state["trick_number"] == state["cards_dealt"]:
        _finish_round(state)


def legal_card_ids(state: Dict, player_id: str) -> List[str]:
    if state["phase"] != "playing" or state["current_turn"] != player_id or player_id not in state["players"]:
        return []
    hand = state["players"][player_id]["hand"]
    suit = led_suit(state["trick"])
    must_follow = suit and any(card.get("suit") == suit for card in hand)
    return [card["id"] for card in hand if not must_follow or card["kind"] != "number" or card["suit"] == suit]


class SkullKingGame:
    game_id = "skull_king"
    min_players = 2
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 2 <= len(players) <= 8:
            raise ValueError("Skull King requires 2 to 8 players")
        meta = {player["player_id"]: dict(player) for player in players}
        if len(meta) != len(players) or GHOST_ID in meta:
            raise ValueError("invalid or duplicate player IDs")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        cfg = _config(config)
        seed = cfg.get("seed", secrets.token_hex(16))
        state = {
            "version": 1, "config": cfg, "base_seed": seed, "game_token": secrets.token_hex(16),
            "player_meta": meta, "turn_order": order,
            "players": {pid: {"total_score": 0} for pid in order},
            "round_number": 1, "total_rounds": 5 if cfg["schedule"] == "quick" else 10,
            "round_start": random.Random(f"{seed}:start").choice(order),
            "score_history": [], "winner_ids": [], "game_over": False, "revision": 0,
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "bidding":
            return ["bid"] if state["players"][player_id]["bid"] is None else []
        if state["phase"] in ("trick_review", "round_review"):
            if player_id in state["ready"]:
                return []
            return ["next_trick" if state["phase"] == "trick_review" else "next_round"]
        return ["play"] if state["current_turn"] == player_id else []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(player_id, str) or player_id not in state["players"]:
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        required = {"type", *_CONTEXT}
        allowed = required.copy()
        if kind == "bid":
            required.add("bid")
            allowed.add("bid")
        elif kind == "play":
            required.add("card_id")
            allowed.update(("card_id", "mode"))
        elif kind not in ("next_trick", "next_round"):
            return [], "unknown action"
        if not required <= set(action) <= allowed:
            return [], "invalid action fields"
        if (action["game_token"] != state["game_token"] or
                any(type(action[key]) is not int or action[key] != state[key]
                    for key in ("round_number", "trick_number"))):
            return [], "stale action; refresh the game state"
        review = {"next_trick": "trick_review", "next_round": "round_review"}
        if kind in review and state["phase"] == review[kind] and player_id in state["ready"]:
            return [], None
        if kind not in SkullKingGame.get_legal_actions(state, player_id):
            return [], "action not available"
        player = state["players"][player_id]
        events = []
        if kind == "bid":
            if type(action["bid"]) is not int or not 0 <= action["bid"] <= state["cards_dealt"]:
                return [], "bid must be between zero and the number of cards dealt"
            player["bid"] = action["bid"]
            events.append({"type": "skull_king:bid_locked", "payload": {"player_id": player_id}})
            if all(p["bid"] is not None for p in state["players"].values()):
                events.append({"type": "skull_king:bids_revealed", "payload": {
                    "bids": {pid: p["bid"] for pid, p in state["players"].items()}}})
                _begin_trick(state, state["round_start"])
        elif kind == "play":
            card_id = action["card_id"]
            if not isinstance(card_id, str) or card_id not in legal_card_ids(state, player_id):
                return [], "choose a legal card; numbered cards must follow suit"
            card = next(card for card in player["hand"] if card["id"] == card_id)
            if card["kind"] == "tigress":
                if action.get("mode") not in ("pirate", "escape"):
                    return [], "choose Pirate or Escape for the Tigress"
            elif "mode" in action:
                return [], "only the Tigress has a mode"
            play = {"player_id": player_id, "card": card}
            if "mode" in action:
                play["mode"] = action["mode"]
            player["hand"].remove(card)
            state["trick"].append(play)
            events.append({"type": "skull_king:card_played", "payload": copy.deepcopy(play)})
            if len(state["trick"]) == len(state["trick_order"]):
                _finish_trick(state)
                events.append({"type": "skull_king:trick_resolved", "payload": copy.deepcopy(state["trick_result"])})
            else:
                state["current_turn"] = state["trick_order"][len(state["trick"])]
                _advance_ghost(state)
        else:
            state["ready"].append(player_id)
            events.append({"type": "skull_king:ready", "payload": {"player_id": player_id}})
            if len(state["ready"]) == len(state["turn_order"]):
                if kind == "next_trick":
                    winner = state["trick_result"]["winner_id"]
                    state["trick_number"] += 1
                    _begin_trick(state, winner)
                else:
                    order = state["turn_order"]
                    state["round_start"] = order[(order.index(state["round_start"]) + 1) % len(order)]
                    state["round_number"] += 1
                    _start_round(state)
        state["revision"] += 1
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["turn_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            players.append({
                "player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", 0),
                "is_bot": bool(meta.get("is_bot")), "hand_count": len(player["hand"]),
                "bid": player["bid"] if state["phase"] != "bidding" or pid == viewer_id else None,
                "bid_locked": player["bid"] is not None, "won": player["won"],
                "bonus": player["bonus"], "round_score": player["round_score"],
                "total_score": player["total_score"],
            })
        own = state["players"].get(viewer_id)
        return copy.deepcopy({
            "game_id": SkullKingGame.game_id, "you": viewer_id,
            "game_token": state["game_token"], "revision": state["revision"],
            "config": {"schedule": state["config"]["schedule"]},
            **{key: state[key] for key in (
                "phase", "round_number", "total_rounds", "cards_dealt", "trick_number",
                "current_turn", "round_start", "trick_order", "trick", "trick_result", "trick_history",
                "round_summary", "score_history", "ready", "winner_ids", "game_over",
            )},
            "players": players, "hand": own["hand"] if own else [],
            "led_suit": led_suit(state["trick"]),
            "legal_actions": SkullKingGame.get_legal_actions(state, viewer_id),
            "legal_card_ids": legal_card_ids(state, viewer_id),
            "ghost": {"player_id": GHOST_ID, "name": "Graybeard", "won": state["ghost_won"],
                      "hand_count": len(state["ghost_hand"])} if len(players) == 2 else None,
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.skull_king_ai import choose_action

        action = choose_action(SkullKingGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 550} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
