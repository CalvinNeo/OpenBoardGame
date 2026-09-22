"""For Sale, using the Eagle-Gryphon base-game rules and private hands."""

import copy
import random
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


PROPERTIES = tuple(range(1, 31))
CHECKS = tuple(value for value in (0, *range(2, 16)) for _ in range(2))
STARTING_CASH = {3: 18, 4: 18, 5: 14, 6: 14}
REMOVED_CARDS = {3: 6, 4: 2, 5: 0, 6: 0}
CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}


def _action_schema(action_type: str, fields: Dict) -> Dict:
    properties = {"type": {"const": action_type}, "round": {"type": "integer", "minimum": 1}}
    properties.update(fields)
    return {"type": "object", "properties": properties,
            "required": list(properties), "additionalProperties": False}


ACTION_SCHEMA = {"oneOf": [
    _action_schema("bid", {"turn": {"type": "integer", "minimum": 1},
                           "amount": {"type": "integer", "minimum": 1}}),
    _action_schema("pass", {"turn": {"type": "integer", "minimum": 1}}),
    _action_schema("sell", {"property": {"type": "integer", "minimum": 1, "maximum": 30}}),
    _action_schema("next_round", {}),
]}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"][player_id].get("name") or player_id


def _log(state: Dict, text: str) -> None:
    state["log"].append({"round": state["round"], "text": text})


def _escrow(state: Dict, player_id: str) -> int:
    player = state["players"].get(player_id)
    return player["bid"] if player and state["phase"] == "buy" and not player["passed"] else 0


def _start_round(state: Dict) -> None:
    buying = state["stage"] == "buy"
    count = len(state["turn_order"])
    deck = state["property_deck"] if buying else state["check_deck"]
    market = sorted(deck.pop() for _ in range(count))
    for player in state["players"].values():
        player.update(bid=0, passed=False, selection=None)
    state.update(phase=state["stage"], round_summary=None, next_ready=[], buy_results=[],
                 high_bid=0, high_bidder=None,
                 current_turn=state["start_player"] if buying else None,
                 active_players=list(state["turn_order"]) if buying else [],
                 market_properties=market if buying else [],
                 market_checks=[] if buying else market)
    label = "买房" if buying else "售房"
    _log(state, f"{label}第 {state['stage_round']} 轮开始。")


def _award_property(state: Dict, player_id: str, property_value: int, refund: int) -> None:
    player = state["players"][player_id]
    paid = player["bid"] - refund
    player["cash"] += refund
    player["properties"].append(property_value)
    player["properties"].sort()
    state["buy_results"].append({"player_id": player_id, "property": property_value,
                                 "bid": player["bid"], "paid": paid, "refund": refund})
    _log(state, f"{_name(state, player_id)} 获得地产 (🏠 {property_value})，"
                f"支付 {paid} 千元，退回 {refund} 千元 (🪙)。")


def _end_round(state: Dict, rows: List[Dict], winner: Optional[str] = None) -> None:
    state.update(phase="round_end", current_turn=None, next_ready=[],
                 round_summary={"stage": state["stage"], "stage_round": state["stage_round"],
                                "rows": rows, "winner": winner})
    state.setdefault("history", []).append(copy.deepcopy(state["round_summary"]))


def _advance_auction(state: Dict, actor: str) -> None:
    state["turn"] += 1
    if len(state["active_players"]) == 1:
        winner = state["active_players"][0]
        _award_property(state, winner, state["market_properties"].pop(), 0)
        state["start_player"] = winner
        _end_round(state, copy.deepcopy(state["buy_results"]), winner)
        return
    order = state["turn_order"]
    index = order.index(actor)
    for offset in range(1, len(order) + 1):
        candidate = order[(index + offset) % len(order)]
        if candidate in state["active_players"]:
            state["current_turn"] = candidate
            return


def _settle_sales(state: Dict) -> None:
    order = sorted(state["turn_order"], key=lambda pid: state["players"][pid]["selection"])
    rows = []
    for player_id, check in zip(order, state["market_checks"]):
        player = state["players"][player_id]
        property_value = player["selection"]
        player["properties"].remove(property_value)
        player["sold_properties"].append(property_value)
        player["checks"].append(check)
        rows.append({"player_id": player_id, "property": property_value, "check": check})
        _log(state, f"{_name(state, player_id)} 售出地产 (🏠 {property_value})，"
                    f"获得支票 (💵 {check} 千元)。")
    _end_round(state, rows)


def _finish_game(state: Dict) -> None:
    results = [{"player_id": pid, "cash": state["players"][pid]["cash"],
                "checks": sum(state["players"][pid]["checks"]),
                "total": state["players"][pid]["cash"] + sum(state["players"][pid]["checks"])}
               for pid in state["turn_order"]]
    results.sort(key=lambda row: (row["total"], row["cash"]), reverse=True)
    previous, rank = None, 0
    for index, row in enumerate(results, 1):
        score = (row["total"], row["cash"])
        if score != previous:
            rank = index
        row["rank"] = rank
        previous = score
    state.update(phase="game_over", game_over=True, final_results=results,
                 winner=[row["player_id"] for row in results if row["rank"] == 1])
    names = "、".join(_name(state, pid) for pid in state["winner"])
    _log(state, f"游戏结束，{names} 获胜！")


def _continue_game(state: Dict) -> None:
    if state["stage"] == "sell" and state["stage_round"] == state["rounds_per_stage"]:
        _finish_game(state)
        return
    state["round"] += 1
    if state["stage"] == "buy" and state["stage_round"] == state["rounds_per_stage"]:
        state.update(stage="sell", stage_round=1)
    else:
        state["stage_round"] += 1
    _start_round(state)


class ForSaleGame:
    game_id = "for_sale"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid For Sale configuration")
        if not isinstance(players, list) or not 3 <= len(players) <= 6:
            raise ValueError("For Sale requires 3–6 players")
        if any(not isinstance(player, dict) or not isinstance(player.get("player_id"), str)
               or not player["player_id"] for player in players):
            raise ValueError("player IDs must be unique nonempty strings")
        if any(type(player.get("seat", 0)) is not int for player in players):
            raise ValueError("player seats must be integers")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        count = len(ids)
        property_deck, check_deck = list(PROPERTIES), list(CHECKS)
        random.shuffle(property_deck)
        random.shuffle(check_deck)
        removed_count = REMOVED_CARDS[count]
        removed_properties = [property_deck.pop() for _ in range(removed_count)]
        removed_checks = [check_deck.pop() for _ in range(removed_count)]
        state = {
            "game_id": ForSaleGame.game_id, "version": 1, "config": {},
            "players": {pid: {"cash": STARTING_CASH[count], "properties": [],
                              "checks": [], "sold_properties": []} for pid in ids},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "turn_order": ids, "round": 1, "stage_round": 1, "turn": 1, "stage": "buy",
            "rounds_per_stage": (30 - removed_count) // count,
            "property_deck": property_deck, "check_deck": check_deck,
            "removed_properties": removed_properties, "removed_checks": removed_checks,
            "start_player": random.choice(ids), "log": [], "history": [], "winner": [],
            "game_over": False, "final_results": [],
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if not isinstance(player_id, str) or player_id not in state["players"] or state["game_over"]:
            return []
        if state["phase"] == "round_end" and player_id not in state["next_ready"]:
            return ["next_round"]
        player = state["players"][player_id]
        if state["phase"] == "buy" and state["current_turn"] == player_id:
            actions = ["bid"] if player["cash"] + player["bid"] > state["high_bid"] else []
            return actions + ["pass"]
        if state["phase"] == "sell" and player["selection"] is None:
            return ["sell"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if any(type(action[key]) is not int for key in ("round", "turn", "amount", "property")
               if key in action):
            return [], "action numbers must be integers"
        if action["type"] not in ForSaleGame.get_legal_actions(state, player_id):
            return [], "action unavailable"
        if action["round"] != state["round"]:
            return [], "stale round"
        action_type = action["type"]
        if action_type == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                _continue_game(state)
            return [{"type": "for_sale:ready", "payload": {"player_id": player_id}}], None
        player = state["players"][player_id]
        if action_type == "sell":
            if action["property"] not in player["properties"]:
                return [], "property unavailable"
            player["selection"] = action["property"]
            _log(state, f"{_name(state, player_id)} 已秘密提交地产 (🏠)。")
            if all(record["selection"] is not None for record in state["players"].values()):
                _settle_sales(state)
            # The room event stream is shared: the selected property must stay private.
            return [{"type": "for_sale:submitted", "payload": {"player_id": player_id}}], None
        if action["turn"] != state["turn"]:
            return [], "stale turn"
        if action_type == "bid":
            amount = action["amount"]
            if amount <= state["high_bid"]:
                return [], "bid must exceed the current highest bid"
            if amount > player["cash"] + player["bid"]:
                return [], "insufficient cash"
            player["cash"] -= amount - player["bid"]
            player["bid"] = amount
            state.update(high_bid=amount, high_bidder=player_id)
            _log(state, f"{_name(state, player_id)} 出价 {amount} 千元 (🪙)。")
            event = {"type": "for_sale:bid", "payload": {"player_id": player_id, "amount": amount}}
        else:
            player["passed"] = True
            state["active_players"].remove(player_id)
            property_value = state["market_properties"].pop(0)
            _award_property(state, player_id, property_value, player["bid"] // 2)
            event = {"type": "for_sale:passed", "payload": copy.deepcopy(state["buy_results"][-1])}
        _advance_auction(state, player_id)
        return [event], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own = state["players"].get(viewer_id, {})
        escrow = _escrow(state, viewer_id)
        finished = state["game_over"]
        view = {
            "game_id": ForSaleGame.game_id, "you": viewer_id,
            "phase": state["phase"], "stage": state["stage"], "round": state["round"],
            "stage_round": state["stage_round"], "rounds_per_stage": state["rounds_per_stage"],
            "turn": state["turn"], "current_turn": state["current_turn"],
            "start_player": state["start_player"], "game_over": finished, "winner": state["winner"],
            "config": {}, "market_properties": state["market_properties"],
            "market_checks": state["market_checks"], "high_bid": state["high_bid"],
            "high_bidder": state["high_bidder"], "active_players": state["active_players"],
            "next_ready": state["next_ready"], "your_properties": own.get("properties", []),
            "your_checks": own.get("checks", []), "your_cash": own.get("cash"),
            "your_bid": escrow, "your_selection": own.get("selection"),
            "min_bid": state["high_bid"] + 1, "max_bid": own.get("cash", 0) + escrow,
            "legal_actions": ForSaleGame.get_legal_actions(state, viewer_id),
            "round_summary": state["round_summary"], "final_results": state["final_results"],
            "history": state.get("history", []),
            "auction_results": state["buy_results"] if state["phase"] == "buy" else [],
            "log": state["log"],
            "players": [{
                "player_id": pid, "name": _name(state, pid),
                "seat": state["player_meta"][pid].get("seat", 0),
                "is_bot": bool(state["player_meta"][pid].get("is_bot")),
                "bid": state["players"][pid]["bid"], "passed": state["players"][pid]["passed"],
                "submitted": state["players"][pid]["selection"] is not None,
                "property_count": len(state["players"][pid]["properties"]),
                "check_count": len(state["players"][pid]["checks"]),
                "cash": state["players"][pid]["cash"] if finished or pid == viewer_id else None,
                "total": state["players"][pid]["cash"] + sum(state["players"][pid]["checks"])
                if finished or pid == viewer_id else None,
            } for pid in state["turn_order"]],
        }
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        # Strategy receives exactly the same information as this player's browser.
        return _choose_bot_action(ForSaleGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    from game.for_sale_ai import choose_action

    return choose_action(view)
