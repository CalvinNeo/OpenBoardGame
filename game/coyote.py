import random
from typing import Dict, List, Optional, Tuple

CARD_NUMBER = "number"
CARD_MAX_ZERO = "max_zero"
CARD_MYSTERY = "mystery"
CARD_DOUBLE = "double"

DEFAULT_CONFIG = {
    "max_penalties": 3,
}

NUMBER_CARD_COUNTS = {
    0: 4,
    1: 4,
    2: 4,
    3: 4,
    4: 4,
    5: 4,
    10: 3,
    15: 2,
    20: 1,
    -5: 2,
    -10: 1,
}

SPECIAL_CARD_COUNTS = {
    CARD_MAX_ZERO: 1,
    CARD_MYSTERY: 1,
    CARD_DOUBLE: 1,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck() -> List[Dict]:
    deck: List[Dict] = []
    for value, count in NUMBER_CARD_COUNTS.items():
        for _ in range(count):
            deck.append({"type": CARD_NUMBER, "value": value})
    for card_type, count in SPECIAL_CARD_COUNTS.items():
        for _ in range(count):
            deck.append({"type": card_type})
    random.shuffle(deck)
    return deck


def _card_label(card: Optional[Dict]) -> Optional[str]:
    if not card:
        return None
    card_type = card.get("type")
    if card_type == CARD_NUMBER:
        return str(card.get("value"))
    if card_type == CARD_MAX_ZERO:
        return "Max->0"
    if card_type == CARD_MYSTERY:
        return "?"
    if card_type == CARD_DOUBLE:
        return "x2"
    return None


def _active_player_ids(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if not state["players"][pid]["eliminated"]]


def _advance_turn(state: Dict) -> None:
    order = state["turn_order"]
    active = _active_player_ids(state)
    if not active:
        state["current_turn"] = None
        return
    current = state["current_turn"]
    if current not in active:
        state["current_turn"] = active[0]
        return
    idx = order.index(current)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if not state["players"][pid]["eliminated"]:
            state["current_turn"] = pid
            return


def _next_active_after(state: Dict, player_id: str) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    if player_id not in order:
        return _active_player_ids(state)[0] if _active_player_ids(state) else None
    idx = order.index(player_id)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if not state["players"][pid]["eliminated"]:
            return pid
    return None


def _apply_max_zero(
    numeric_values: List[int],
    total: int,
    count: int,
    applied: List[int],
) -> int:
    for _ in range(count):
        max_positive = max((value for value in numeric_values if value > 0), default=None)
        if max_positive is None:
            break
        total -= max_positive
        numeric_values.remove(max_positive)
        applied.append(max_positive)
    return total


def _evaluate_total(state: Dict) -> Dict:
    deck = list(state.get("deck", []))
    cards: List[Dict] = []
    for pid in _active_player_ids(state):
        card = state["players"][pid].get("card")
        if card:
            cards.append(card)

    numeric_values = [card["value"] for card in cards if card.get("type") == CARD_NUMBER]
    total = sum(numeric_values)
    max_zero_applied: List[int] = []

    max_zero_count = sum(1 for card in cards if card.get("type") == CARD_MAX_ZERO)
    total = _apply_max_zero(numeric_values, total, max_zero_count, max_zero_applied)

    x2_count = sum(1 for card in cards if card.get("type") == CARD_DOUBLE)
    mystery_queue = sum(1 for card in cards if card.get("type") == CARD_MYSTERY)
    drawn_cards: List[Dict] = []

    while mystery_queue > 0:
        mystery_queue -= 1
        if not deck:
            deck = _build_deck()
        drawn = deck.pop()
        drawn_cards.append(drawn)
        drawn_type = drawn.get("type")
        if drawn_type == CARD_NUMBER:
            value = int(drawn.get("value", 0))
            total += value
            numeric_values.append(value)
        elif drawn_type == CARD_MAX_ZERO:
            total = _apply_max_zero(numeric_values, total, 1, max_zero_applied)
        elif drawn_type == CARD_MYSTERY:
            mystery_queue += 1
        elif drawn_type == CARD_DOUBLE:
            x2_count += 1

    total *= 2 ** x2_count

    return {
        "total": total,
        "drawn_cards": drawn_cards,
        "max_zero_applied": max_zero_applied,
        "x2_count": x2_count,
    }


def _start_new_round(state: Dict, start_player: Optional[str]) -> None:
    deck = _build_deck()
    for pid, pdata in state["players"].items():
        if pdata["eliminated"]:
            pdata["card"] = None
        else:
            pdata["card"] = deck.pop()
    state["deck"] = deck
    active = _active_player_ids(state)
    if not active:
        state["current_turn"] = None
    elif start_player in active:
        state["current_turn"] = start_player
    else:
        state["current_turn"] = active[0]
    state["phase"] = "bidding"
    state["last_bid"] = None
    state["last_bidder"] = None
    state["round"] += 1


def _check_game_over(state: Dict) -> bool:
    active = _active_player_ids(state)
    if len(active) <= 1:
        state["game_over"] = True
        state["phase"] = "game_over"
        state["winner"] = active[0] if active else None
        return True
    return False


class CoyoteGame:
    game_id = "coyote"
    min_players = 2
    max_players = 10

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        deck = _build_deck()
        if len(deck) < len(players):
            raise ValueError("deck too small for player count")
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "card": deck.pop(),
                "penalties": 0,
                "eliminated": False,
            }

        return {
            "deck": deck,
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "bidding",
            "last_bid": None,
            "last_bidder": None,
            "round": 1,
            "config": cfg,
            "player_meta": player_meta,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata or pdata["eliminated"]:
            return []
        if player_id != state.get("current_turn"):
            return []
        if state.get("last_bid") is None:
            return ["bid"]
        return ["bid", "challenge"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata or pdata["eliminated"]:
            return [], "unknown player"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "bid":
            bid = action.get("bid")
            if not isinstance(bid, int):
                return [], "invalid bid"
            if bid < 1:
                return [], "bid must be positive"
            last_bid = state.get("last_bid")
            if last_bid is not None and bid <= int(last_bid):
                return [], "bid must be higher"
            state["last_bid"] = bid
            state["last_bidder"] = player_id
            events.append({"type": "coyote:bid", "payload": {"player_id": player_id, "bid": bid}})
            _advance_turn(state)
            return events, None

        if action_type == "challenge":
            if state.get("last_bid") is None or state.get("last_bidder") is None:
                return [], "no bid to challenge"
            result = _evaluate_total(state)
            total = int(result["total"])
            last_bid = int(state["last_bid"])
            challenger = player_id
            bidder = state["last_bidder"]
            challenge_success = total < last_bid
            loser = bidder if challenge_success else challenger
            state["players"][loser]["penalties"] += 1
            eliminated = []
            if state["players"][loser]["penalties"] >= int(state["config"]["max_penalties"]):
                state["players"][loser]["eliminated"] = True
                eliminated.append(loser)

            summary_cards = [
                {"player_id": pid, "card": _card_label(pdata.get("card"))}
                for pid, pdata in state["players"].items()
                if pdata.get("card") is not None
            ]
            summary = {
                "bid": last_bid,
                "bidder": bidder,
                "challenger": challenger,
                "actual_total": total,
                "success": challenge_success,
                "loser": loser,
                "penalties": {
                    pid: state["players"][pid]["penalties"] for pid in state["players"].keys()
                },
                "eliminated": eliminated,
                "cards": summary_cards,
                "mystery_draws": [_card_label(card) for card in result["drawn_cards"]],
                "max_zero_applied": result["max_zero_applied"],
                "x2_count": result["x2_count"],
            }
            state["last_round_summary"] = summary

            events.append(
                {
                    "type": "coyote:challenge",
                    "payload": {
                        "challenger": challenger,
                        "bidder": bidder,
                        "bid": last_bid,
                        "total": total,
                        "loser": loser,
                    },
                }
            )

            if _check_game_over(state):
                return events, None

            if state["players"][loser]["eliminated"]:
                start_player = _next_active_after(state, loser)
            else:
                start_player = loser
            _start_new_round(state, start_player)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            card_hidden = bool(pid == viewer_id and not state.get("game_over") and not pdata["eliminated"])
            card_label = None
            if not card_hidden:
                card_label = _card_label(pdata.get("card"))
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "penalties": pdata["penalties"],
                    "eliminated": pdata["eliminated"],
                    "card": card_label,
                    "card_hidden": card_hidden,
                }
            )

        return {
            "game_id": CoyoteGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "current_turn": state["current_turn"],
            "last_bid": state.get("last_bid"),
            "last_bidder": state.get("last_bidder"),
            "players": players_view,
            "legal_actions": CoyoteGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": {"max_penalties": state["config"]["max_penalties"]},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata["eliminated"]:
            return None
        if bot_id != state.get("current_turn"):
            return None

        last_bid = state.get("last_bid")
        min_bid = int(last_bid) + 1 if last_bid is not None else 1
        if last_bid is None:
            guess = random.randint(min_bid, min_bid + 5)
            return {"type": "bid", "bid": guess}
        if random.random() < 0.25:
            return {"type": "challenge"}
        raise_by = random.randint(1, 3)
        return {"type": "bid", "bid": min_bid + raise_by - 1}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
