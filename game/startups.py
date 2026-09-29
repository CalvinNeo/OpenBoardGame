"""Startups: company majorities, the market and optional four-round scoring."""

import copy
import random
import secrets
from typing import Dict, List, Optional, Tuple


COMPANIES = (
    {"id": "giraffe", "name": "Giraffe Beer", "emoji": "🦒", "supply": 5},
    {"id": "bowwow", "name": "Bowwow Games", "emoji": "🐶", "supply": 6},
    {"id": "flamingo", "name": "Flamingo Soft", "emoji": "🦩", "supply": 7},
    {"id": "octo", "name": "Octo Coffee", "emoji": "🐙", "supply": 8},
    {"id": "hippo", "name": "Hippo Powertech", "emoji": "🦛", "supply": 9},
    {"id": "elephant", "name": "Elephant Mars Travel", "emoji": "🐘", "supply": 10},
)
COMPANY_IDS = tuple(company["id"] for company in COMPANIES)
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "rounds": {"type": "integer", "enum": [1, 4], "default": 1},
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    },
    "additionalProperties": False,
}
_CONTEXT = {
    "game_token": {"type": "string"},
    "round_number": {"type": "integer", "minimum": 1},
    "turn_number": {"type": "integer", "minimum": 1},
}
ACTION_SCHEMA = {"oneOf": [
    {"type": "object", "properties": {**_CONTEXT, "type": {"const": kind}, **fields},
     "required": ["type", *_CONTEXT, *fields], "additionalProperties": False}
    for kind, fields in (
        ("draw", {}), ("take_market", {"card_id": {"type": "string"}}),
        ("invest", {"card_id": {"type": "string"}}),
        ("discard", {"card_id": {"type": "string"}}), ("next_round", {}),
    )
]}


def build_deck() -> List[Dict]:
    return [{"id": f"{company['id']}_{index}", "company": company["id"]}
            for company in COMPANIES for index in range(company["supply"])]


def _config(config: Optional[Dict]) -> Dict:
    config = {} if config is None else config
    if not isinstance(config, dict) or set(config) - {"rounds", "seed"}:
        raise ValueError("invalid Startups configuration")
    rounds = config.get("rounds", 1)
    if type(rounds) is not int or rounds not in (1, 4):
        raise ValueError("rounds must be 1 or 4")
    if "seed" in config and not (type(config["seed"]) is int or
                                (isinstance(config["seed"], str) and 1 <= len(config["seed"]) <= 80)):
        raise ValueError("invalid seed")
    return {"rounds": rounds, **config}


def share_counts(cards: List[Dict]) -> Dict[str, int]:
    return {company: sum(card["company"] == company for card in cards) for company in COMPANY_IDS}


def draw_cost(state: Dict, player_id: str) -> int:
    return sum(state["anti_monopoly"][entry["card"]["company"]] != player_id
               for entry in state["market"])


def _start_round(state: Dict) -> None:
    deck = build_deck()
    random.Random(f"{state['base_seed']}:{state['round_number']}").shuffle(deck)
    state["removed_cards"], state["deck"] = deck[:5], deck[5:]
    for player in state["players"].values():
        player.update(hand=[state["deck"].pop() for _ in range(3)], portfolio=[],
                      capital=10, round_score=None, income_chips=0, paid_chips=0, last_turn=0)
    state.update(market=[], anti_monopoly={company: None for company in COMPANY_IDS},
                 phase="take", current_turn=state["start_player"], turn_number=1,
                 taken_company=None, ready=[], round_summary=None, history=[])


def _update_marker(state: Dict, player_id: str, company: str) -> None:
    holder = state["anti_monopoly"][company]
    own_count = share_counts(state["players"][player_id]["portfolio"])[company]
    holder_count = share_counts(state["players"][holder]["portfolio"])[company] if holder else 0
    if own_count > holder_count:
        state["anti_monopoly"][company] = player_id


def _finish_round(state: Dict) -> None:
    order, players = state["turn_order"], state["players"]
    holdings = {pid: share_counts(players[pid]["portfolio"] + players[pid]["hand"]) for pid in order}
    companies = []
    for company in COMPANY_IDS:
        maximum = max(holdings[pid][company] for pid in order)
        leaders = [pid for pid in order if holdings[pid][company] == maximum] if maximum else []
        winner = leaders[0] if len(leaders) == 1 else None
        payments = []
        if winner:
            for pid in order:
                if pid != winner and holdings[pid][company]:
                    amount = holdings[pid][company]
                    players[pid]["paid_chips"] += amount
                    players[winner]["income_chips"] += amount
                    payments.append({"from": pid, "to": winner, "chips": amount})
        companies.append({"company": company, "holdings": {pid: holdings[pid][company] for pid in order},
                          "winner_id": winner, "tied_ids": leaders if len(leaders) > 1 else [],
                          "payments": payments})
    for player in players.values():
        # A paid 1-point chip becomes a 3-point chip for its recipient. Debt is
        # allowed, so settle independently of company/seat order and cash on hand.
        player["round_score"] = player["capital"] - player["paid_chips"] + 3 * player["income_chips"]
    ranking = sorted(order, key=lambda pid: (players[pid]["round_score"],
                                            players[pid]["income_chips"], players[pid]["last_turn"]), reverse=True)
    rows = []
    for index, pid in enumerate(ranking):
        player = players[pid]
        award = 2 if index == 0 else 1 if index == 1 else -1 if index == len(order) - 1 else 0
        if state["config"]["rounds"] == 4:
            player["match_points"] += award
        player["firsts"] += index == 0
        player["seconds"] += index == 1
        rows.append({"player_id": pid, "rank": index + 1, "capital": player["capital"],
                     "paid_chips": player["paid_chips"], "income_chips": player["income_chips"],
                     "wealth": player["round_score"], "last_turn": player["last_turn"],
                     "award": award if state["config"]["rounds"] == 4 else 0,
                     "match_points": player["match_points"], "holdings": holdings[pid]})
    summary = {"round_number": state["round_number"], "companies": companies,
               "players": rows, "ranking": ranking}
    state["round_summary"] = summary
    state["score_history"].append(copy.deepcopy(summary))
    state.update(current_turn=None, ready=[], taken_company=None)
    state["game_over"] = state["round_number"] == state["config"]["rounds"]
    state["phase"] = "game_over" if state["game_over"] else "round_review"
    if state["game_over"]:
        if state["config"]["rounds"] == 1:
            state["final_ranking"] = ranking
        else:
            state["final_ranking"] = sorted(order, key=lambda pid: (
                players[pid]["match_points"], players[pid]["firsts"],
                players[pid]["seconds"], -ranking.index(pid)), reverse=True)
        state["winner_ids"] = state["final_ranking"][:1]


class StartupsGame:
    game_id = "startups"
    min_players = 3
    max_players = 7

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not 3 <= len(players) <= 7:
            raise ValueError("Startups requires 3 to 7 players")
        cfg = _config(config)
        meta = {p["player_id"]: dict(p) for p in players}
        if len(meta) != len(players):
            raise ValueError("player IDs must be unique")
        order = sorted(meta, key=lambda pid: (meta[pid].get("seat", 0), pid))
        seed = cfg.get("seed", secrets.token_hex(16))
        state = {
            "version": 1, "game_token": secrets.token_hex(12), "revision": 0,
            "config": cfg, "base_seed": seed, "player_meta": meta, "turn_order": order,
            "start_player": random.Random(f"{seed}:start").choice(order),
            "players": {pid: {"match_points": 0, "firsts": 0, "seconds": 0} for pid in order},
            "round_number": 1, "score_history": [], "game_over": False,
            "winner_ids": [], "final_ranking": [],
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_review":
            return [] if player_id in state["ready"] else ["next_round"]
        if state["current_turn"] != player_id:
            return []
        if state["phase"] == "take":
            legal = []
            if state["deck"] and state["players"][player_id]["capital"] >= draw_cost(state, player_id):
                legal.append("draw")
            if any(state["anti_monopoly"][entry["card"]["company"]] != player_id for entry in state["market"]):
                legal.append("take_market")
            return legal
        if state["phase"] == "place":
            legal = ["invest"]
            if any(card["company"] != state["taken_company"] for card in state["players"][player_id]["hand"]):
                legal.append("discard")
            return legal
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        kind = action["type"]
        fields = {"type", *_CONTEXT}
        if kind in ("take_market", "invest", "discard"):
            fields.add("card_id")
        if kind not in ("draw", "take_market", "invest", "discard", "next_round") or set(action) != fields:
            return [], "invalid action fields"
        if (action["game_token"] != state["game_token"] or
                any(type(action[key]) is not int or action[key] != state[key]
                    for key in ("round_number", "turn_number"))):
            return [], "stale action; refresh the game state"
        if "card_id" in fields and not isinstance(action["card_id"], str):
            return [], "invalid card ID"
        if kind == "next_round" and state["phase"] == "round_review" and player_id in state["ready"]:
            return [], None
        if kind not in StartupsGame.get_legal_actions(state, player_id):
            return [], "action not available"

        # Validate the complete action before any mutation, including requests
        # that bypass the room's JSON Schema validation.
        player = state["players"][player_id]
        card = None
        market_entry = None
        if kind == "take_market":
            market_entry = next((entry for entry in state["market"]
                                 if entry["card"]["id"] == action["card_id"]), None)
            if market_entry is None:
                return [], "market card not found"
            card = market_entry["card"]
            if state["anti_monopoly"][card["company"]] == player_id:
                return [], "anti-monopoly marker blocks this company"
        elif kind in ("invest", "discard"):
            card = next((card for card in player["hand"] if card["id"] == action["card_id"]), None)
            if card is None:
                return [], "card is not in your hand"
            if kind == "discard" and card["company"] == state["taken_company"]:
                return [], "cannot return the company taken from the market this turn"

        state["revision"] += 1
        if kind == "next_round":
            state["ready"].append(player_id)
            events = [{"type": "startups:ready", "payload": {"player_id": player_id}}]
            if len(state["ready"]) == len(state["turn_order"]):
                state["start_player"] = state["round_summary"]["ranking"][-1]
                state["round_number"] += 1
                _start_round(state)
                events.append({"type": "startups:round_started", "payload": {"round_number": state["round_number"]}})
            return events, None

        record = {"type": kind, "player_id": player_id, "turn_number": state["turn_number"]}
        if kind == "draw":
            cost = draw_cost(state, player_id)
            player["capital"] -= cost
            for entry in state["market"]:
                if state["anti_monopoly"][entry["card"]["company"]] != player_id:
                    entry["coins"] += 1
            player["hand"].append(state["deck"].pop())
            state.update(phase="place", taken_company=None)
            record["cost"] = cost  # Never broadcast the drawn card.
        elif kind == "take_market":
            state["market"].remove(market_entry)
            player["capital"] += market_entry["coins"]
            player["hand"].append(card)
            state.update(phase="place", taken_company=card["company"])
            record.update(company=card["company"], coins=market_entry["coins"])
        else:
            player["hand"].remove(card)
            if kind == "invest":
                player["portfolio"].append(card)
                _update_marker(state, player_id, card["company"])
            else:
                state["market"].append({"card": card, "coins": 0})
            record["company"] = card["company"]
            player["last_turn"] = state["turn_number"]
            if not state["deck"]:
                _finish_round(state)
            else:
                order = state["turn_order"]
                state.update(current_turn=order[(order.index(player_id) + 1) % len(order)],
                             phase="take", taken_company=None, turn_number=state["turn_number"] + 1)
        state["history"].append(record)
        state["history"] = state["history"][-80:]
        events = [{"type": "startups:" + kind, "payload": copy.deepcopy(record)}]
        if state["phase"] in ("round_review", "game_over"):
            events.append({"type": "startups:round_scored", "payload": copy.deepcopy(state["round_summary"])})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        revealed = state["phase"] in ("round_review", "game_over")
        players = []
        for pid in state["turn_order"]:
            player, meta = state["players"][pid], state["player_meta"][pid]
            players.append({
                "player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", 0),
                "is_bot": bool(meta.get("is_bot")), "hand_count": len(player["hand"]),
                "hand": player["hand"] if revealed else None,
                "shares": share_counts(player["portfolio"] + (player["hand"] if revealed else [])),
                **{key: player[key] for key in ("capital", "round_score", "income_chips", "paid_chips",
                                               "match_points", "firsts", "seconds")},
            })
        own = state["players"].get(viewer_id)
        legal = StartupsGame.get_legal_actions(state, viewer_id)
        return copy.deepcopy({
            "game_id": StartupsGame.game_id, "you": viewer_id, "companies": COMPANIES,
            "game_token": state["game_token"], "revision": state["revision"],
            "config": {"rounds": state["config"]["rounds"]},
            **{key: state[key] for key in ("phase", "round_number", "turn_number", "current_turn",
                "start_player", "market", "anti_monopoly", "taken_company", "round_summary",
                "score_history", "ready", "winner_ids", "final_ranking", "game_over", "history")},
            "players": players, "hand": own["hand"] if own else [], "hands_revealed": revealed,
            "deck_count": len(state["deck"]), "removed_count": 5,
            "draw_cost": draw_cost(state, viewer_id) if own else None,
            "legal_actions": legal,
            "legal_market_ids": [entry["card"]["id"] for entry in state["market"]
                                 if state["anti_monopoly"][entry["card"]["company"]] != viewer_id]
                                if "take_market" in legal else [],
            "legal_discard_ids": [card["id"] for card in own["hand"]
                                  if card["company"] != state["taken_company"]] if "discard" in legal else [],
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        from game.startups_ai import choose_action

        action = choose_action(StartupsGame.get_public_view(state, bot_id))
        return {**action, "delay_ms": 500} if action else None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
