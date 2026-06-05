import copy
import random
from typing import Dict, List, Optional, Tuple

from game.century_spice_road_data import MERCHANT_CARDS, POINT_CARDS, SPICE_EMOJI, SPICE_TYPES, STARTER_CARDS


DEFAULT_CONFIG = {"seed": None}
HAND_LIMIT = 10


def _merge_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if isinstance(config, dict):
        merged.update(config)
    return merged


def _seed_to_int(seed_value: Optional[object]) -> int:
    if seed_value is None:
        return random.randrange(1, 2**31 - 1)
    if isinstance(seed_value, bool):
        return 1 if seed_value else 0
    if isinstance(seed_value, int):
        return seed_value
    total = 0
    for char in str(seed_value):
        total = (total * 131 + ord(char)) % (2**31 - 1)
    return total or 1


def _blank_spices() -> Dict[str, int]:
    return {color: 0 for color in SPICE_TYPES}


def _normalize_counts(value: Optional[Dict]) -> Dict[str, int]:
    counts = _blank_spices()
    if isinstance(value, dict):
        for color in SPICE_TYPES:
            counts[color] = max(0, int(value.get(color, 0)))
    return counts


def _total_spices(counts: Dict[str, int]) -> int:
    return sum(int(counts.get(color, 0)) for color in SPICE_TYPES)


def _can_pay(spices: Dict[str, int], cost: Dict[str, int]) -> bool:
    return all(int(spices.get(color, 0)) >= int(cost.get(color, 0)) for color in SPICE_TYPES)


def _apply_delta(spices: Dict[str, int], delta: Dict[str, int]) -> None:
    for color in SPICE_TYPES:
        spices[color] = int(spices.get(color, 0)) + int(delta.get(color, 0))
        if spices[color] < 0:
            raise ValueError(f"negative spice count: {color}")


def _pay_cost(spices: Dict[str, int], cost: Dict[str, int]) -> None:
    if not _can_pay(spices, cost):
        raise ValueError("cannot pay cost")
    for color in SPICE_TYPES:
        spices[color] = int(spices.get(color, 0)) - int(cost.get(color, 0))


def _copy_card(card: Dict) -> Dict:
    return copy.deepcopy(card)


def _build_card_maps() -> Tuple[Dict[str, Dict], Dict[str, Dict]]:
    merchants = {card["id"]: _copy_card(card) for card in STARTER_CARDS + MERCHANT_CARDS}
    points = {card["id"]: _copy_card(card) for card in POINT_CARDS}
    return merchants, points


MERCHANT_BY_ID, POINT_BY_ID = _build_card_maps()


def _spice_label(counts: Dict[str, int]) -> str:
    parts = []
    for color in SPICE_TYPES:
        amount = int(counts.get(color, 0))
        if amount:
            parts.append(f"{SPICE_EMOJI[color]}x{amount}")
    return " ".join(parts) if parts else "-"


def _merchant_label(card: Dict) -> str:
    ctype = card.get("type")
    if ctype == "spice":
        return f"Gain {_spice_label(card.get('gain', {}))}"
    if ctype == "upgrade":
        return f"Upgrade up to {int(card.get('upgrade_steps', 0))}"
    if ctype == "trade":
        return f"{_spice_label(card.get('cost', {}))} -> {_spice_label(card.get('gain', {}))}"
    return card.get("id", "-")


def _merchant_view(card: Optional[Dict]) -> Optional[Dict]:
    if not card:
        return None
    view = _copy_card(card)
    view["label"] = _merchant_label(view)
    return view


def _point_view(card: Optional[Dict]) -> Optional[Dict]:
    if not card:
        return None
    view = _copy_card(card)
    view["label"] = f"{int(view.get('points', 0))} VP / {_spice_label(view.get('cost', {}))}"
    return view


def _draw(deck: List[Dict]) -> Optional[Dict]:
    if not deck:
        return None
    return deck.pop()


def _refill_market(market: List[Dict], deck: List[Dict], size: int) -> None:
    while len(market) < size and deck:
        market.append({"card": _draw(deck), "spices": _blank_spices()})


def _refill_points(market: List[Dict], deck: List[Dict], size: int) -> None:
    while len(market) < size and deck:
        market.append(_draw(deck))


def _next_player(state: Dict, current_id: str) -> str:
    order = state.get("turn_order", [])
    index = order.index(current_id)
    return order[(index + 1) % len(order)]


def _previous_player(state: Dict, current_id: str) -> str:
    order = state.get("turn_order", [])
    index = order.index(current_id)
    return order[(index - 1) % len(order)]


def _card_limit(player_count: int) -> int:
    return 6 if player_count <= 3 else 5


def _score_player(player: Dict) -> int:
    score = sum(int(card.get("points", 0)) for card in player.get("claimed_points", []))
    score += int(player.get("gold", 0)) * 3
    score += int(player.get("silver", 0))
    score += sum(int(player.get("spices", {}).get(color, 0)) for color in ["red", "green", "brown"])
    return score


def _update_scores(state: Dict) -> None:
    for player in state.get("players", {}).values():
        player["score"] = _score_player(player)


def _winners(state: Dict) -> List[str]:
    scores = {pid: _score_player(player) for pid, player in state.get("players", {}).items()}
    if not scores:
        return []
    high = max(scores.values())
    tied = {pid for pid, score in scores.items() if score == high}
    final = state.get("last_actor") or _previous_player(state, state.get("first_player"))
    order = state.get("turn_order", [])
    start = order.index(final)
    for offset in range(len(order)):
        pid = order[(start - offset) % len(order)]
        if pid in tied:
            return [pid]
    return sorted(tied)


def _maybe_finish_pending_turn(state: Dict) -> None:
    if state.get("phase") == "discard":
        return
    _update_scores(state)
    if state.get("end_triggered") and state.get("last_actor") == state.get("final_player"):
        state["phase"] = "game_over"
        state["game_over"] = True
        state["winner"] = _winners(state)
        return
    state["current_turn"] = _next_player(state, state["last_actor"])
    state["phase"] = "turn"


def _finish_action_or_discard(state: Dict, player_id: str) -> None:
    player = state["players"][player_id]
    total = _total_spices(player["spices"])
    state["last_actor"] = player_id
    if total > HAND_LIMIT:
        state["phase"] = "discard"
        state["discard_player"] = player_id
        state["discard_needed"] = total - HAND_LIMIT
        state["current_turn"] = player_id
        return
    state["discard_player"] = None
    state["discard_needed"] = 0
    _maybe_finish_pending_turn(state)


def _check_end_trigger(state: Dict, player_id: str) -> None:
    if state.get("end_triggered"):
        return
    limit = _card_limit(len(state.get("turn_order", [])))
    if len(state["players"][player_id].get("claimed_points", [])) >= limit:
        state["end_triggered"] = True
        state["end_trigger_player"] = player_id
        state["final_player"] = _previous_player(state, state["first_player"])


class CenturySpiceRoadGame:
    game_id = "century_spice_road"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < CenturySpiceRoadGame.min_players or len(players) > CenturySpiceRoadGame.max_players:
            raise ValueError("invalid player count")

        merged = _merge_config(config)
        rng = random.Random(_seed_to_int(merged.get("seed")))
        player_ids = [p["player_id"] for p in sorted(players, key=lambda item: item.get("seat", 0))]
        player_meta = {p["player_id"]: p for p in players}

        merchant_deck = [_copy_card(card) for card in MERCHANT_CARDS]
        point_deck = [_copy_card(card) for card in POINT_CARDS]
        rng.shuffle(merchant_deck)
        rng.shuffle(point_deck)

        merchant_market: List[Dict] = []
        point_market: List[Dict] = []
        _refill_market(merchant_market, merchant_deck, 6)
        _refill_points(point_market, point_deck, 5)

        state_players: Dict[str, Dict] = {}
        for index, pid in enumerate(player_ids):
            spices = _blank_spices()
            if index == 0:
                spices["yellow"] = 3
            elif index in (1, 2):
                spices["yellow"] = 4
            else:
                spices["yellow"] = 3
                spices["red"] = 1
            state_players[pid] = {
                "hand": [_copy_card(card) for card in STARTER_CARDS],
                "played_cards": [],
                "spices": spices,
                "claimed_points": [],
                "gold": 0,
                "silver": 0,
                "score": 0,
            }

        state = {
            "config": merged,
            "player_meta": player_meta,
            "players": state_players,
            "turn_order": player_ids,
            "first_player": player_ids[0],
            "current_turn": player_ids[0],
            "phase": "turn",
            "merchant_deck": merchant_deck,
            "merchant_market": merchant_market,
            "point_deck": point_deck,
            "point_market": point_market,
            "gold_remaining": len(player_ids) * 2,
            "silver_remaining": len(player_ids) * 2,
            "end_triggered": False,
            "end_trigger_player": None,
            "final_player": None,
            "last_actor": None,
            "discard_player": None,
            "discard_needed": 0,
            "game_over": False,
            "winner": [],
        }
        _update_scores(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []
        if state.get("phase") == "discard":
            return ["discard"] if player_id == state.get("discard_player") else []
        if state.get("phase") != "turn":
            return []
        player = state["players"].get(player_id)
        if not player:
            return []
        actions = []
        if player.get("hand"):
            actions.append("play")
        if state.get("merchant_market"):
            actions.append("acquire")
        if player.get("played_cards"):
            actions.append("rest")
        if any(_can_pay(player["spices"], card.get("cost", {})) for card in state.get("point_market", [])):
            actions.append("claim")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        player = state["players"][player_id]
        events: List[Dict] = []

        if state.get("phase") == "discard":
            if action_type != "discard":
                return [], "must discard spices"
            if player_id != state.get("discard_player"):
                return [], "not discard player"
            discard = _normalize_counts(action.get("spices"))
            if _total_spices(discard) != int(state.get("discard_needed", 0)):
                return [], "wrong discard amount"
            if not _can_pay(player["spices"], discard):
                return [], "cannot discard missing spices"
            _pay_cost(player["spices"], discard)
            events.append({"type": "century_spice_road:discard", "payload": {"player_id": player_id, "spices": discard}})
            state["phase"] = "turn"
            state["discard_player"] = None
            state["discard_needed"] = 0
            _maybe_finish_pending_turn(state)
            return events, None

        if state.get("phase") != "turn":
            return [], "invalid phase"

        if action_type == "play":
            card_id = action.get("card_id")
            index = next((i for i, card in enumerate(player["hand"]) if card.get("id") == card_id), None)
            if index is None:
                return [], "card not in hand"
            card = player["hand"].pop(index)
            ctype = card.get("type")
            if ctype == "spice":
                _apply_delta(player["spices"], card.get("gain", {}))
            elif ctype == "upgrade":
                upgrades = action.get("upgrades", [])
                if not isinstance(upgrades, list):
                    return [], "invalid upgrades"
                max_steps = int(card.get("upgrade_steps", 0))
                if len(upgrades) > max_steps:
                    return [], "too many upgrades"
                preview = copy.deepcopy(player["spices"])
                for color in upgrades:
                    if color not in SPICE_TYPES[:-1]:
                        return [], "invalid upgrade spice"
                    if int(preview.get(color, 0)) <= 0:
                        return [], "missing spice to upgrade"
                    next_color = SPICE_TYPES[SPICE_TYPES.index(color) + 1]
                    preview[color] -= 1
                    preview[next_color] += 1
                player["spices"] = preview
            elif ctype == "trade":
                times = action.get("times", 1)
                if not isinstance(times, int) or times < 0:
                    return [], "invalid trade times"
                cost = card.get("cost", {})
                gain = card.get("gain", {})
                total_cost = {color: int(cost.get(color, 0)) * times for color in SPICE_TYPES}
                if not _can_pay(player["spices"], total_cost):
                    return [], "cannot pay trade"
                _pay_cost(player["spices"], total_cost)
                _apply_delta(player["spices"], {color: int(gain.get(color, 0)) * times for color in SPICE_TYPES})
            else:
                return [], "invalid card type"
            player["played_cards"].append(card)
            events.append({"type": "century_spice_road:play", "payload": {"player_id": player_id, "card_id": card_id}})

        elif action_type == "acquire":
            index = action.get("index")
            if not isinstance(index, int) or index < 0 or index >= len(state.get("merchant_market", [])):
                return [], "invalid merchant index"
            payments = action.get("payments", [])
            if index == 0:
                payments = []
            if not isinstance(payments, list) or len(payments) != index:
                return [], "invalid payments"
            pay_counts = _blank_spices()
            for offset, color in enumerate(payments):
                if color not in SPICE_TYPES:
                    return [], "invalid payment spice"
                pay_counts[color] += 1
            if not _can_pay(player["spices"], pay_counts):
                return [], "cannot pay merchant cost"
            for color in SPICE_TYPES:
                player["spices"][color] -= pay_counts[color]
            for slot_index, color in enumerate(payments):
                state["merchant_market"][slot_index]["spices"][color] += 1
            slot = state["merchant_market"].pop(index)
            player["hand"].append(slot["card"])
            _apply_delta(player["spices"], slot.get("spices", {}))
            _refill_market(state["merchant_market"], state["merchant_deck"], 6)
            events.append({"type": "century_spice_road:acquire", "payload": {"player_id": player_id, "card_id": slot["card"]["id"], "index": index}})

        elif action_type == "rest":
            if not player.get("played_cards"):
                return [], "no played cards"
            player["hand"].extend(player["played_cards"])
            player["played_cards"] = []
            events.append({"type": "century_spice_road:rest", "payload": {"player_id": player_id}})

        elif action_type == "claim":
            index = action.get("index")
            if not isinstance(index, int) or index < 0 or index >= len(state.get("point_market", [])):
                return [], "invalid point index"
            card = state["point_market"][index]
            if not _can_pay(player["spices"], card.get("cost", {})):
                return [], "cannot pay point card"
            _pay_cost(player["spices"], card.get("cost", {}))
            claimed = state["point_market"].pop(index)
            player["claimed_points"].append(claimed)
            bonus = None
            if int(state.get("gold_remaining", 0)) > 0 and index == 0:
                state["gold_remaining"] -= 1
                player["gold"] += 1
                bonus = "gold"
            elif int(state.get("gold_remaining", 0)) > 0 and int(state.get("silver_remaining", 0)) > 0 and index == 1:
                state["silver_remaining"] -= 1
                player["silver"] += 1
                bonus = "silver"
            elif int(state.get("gold_remaining", 0)) <= 0 and int(state.get("silver_remaining", 0)) > 0 and index == 0:
                state["silver_remaining"] -= 1
                player["silver"] += 1
                bonus = "silver"
            _refill_points(state["point_market"], state["point_deck"], 5)
            _check_end_trigger(state, player_id)
            events.append({"type": "century_spice_road:claim", "payload": {"player_id": player_id, "card_id": claimed["id"], "index": index, "bonus": bonus}})

        else:
            return [], "invalid action"

        _finish_action_or_discard(state, player_id)
        if state.get("game_over"):
            events.append({"type": "century_spice_road:game_over", "payload": {"winner": state.get("winner", [])}})
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = sorted(state.get("player_meta", {}).keys(), key=lambda pid: state["player_meta"][pid].get("seat", 0))
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            is_self = pid == viewer_id
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand": [_merchant_view(card) for card in pdata.get("hand", [])] if is_self else [],
                    "hand_count": len(pdata.get("hand", [])),
                    "played_cards": [_merchant_view(card) for card in pdata.get("played_cards", [])],
                    "spices": {color: int(pdata.get("spices", {}).get(color, 0)) for color in SPICE_TYPES},
                    "claimed_points": [_point_view(card) for card in pdata.get("claimed_points", [])],
                    "gold": int(pdata.get("gold", 0)),
                    "silver": int(pdata.get("silver", 0)),
                    "score": _score_player(pdata),
                }
            )
        return {
            "game_id": CenturySpiceRoadGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "turn_order": list(state.get("turn_order", [])),
            "first_player": state.get("first_player"),
            "spice_types": list(SPICE_TYPES),
            "spice_emoji": dict(SPICE_EMOJI),
            "merchant_market": [
                {"card": _merchant_view(slot.get("card")), "spices": _normalize_counts(slot.get("spices"))}
                for slot in state.get("merchant_market", [])
            ],
            "point_market": [_point_view(card) for card in state.get("point_market", [])],
            "merchant_deck_count": len(state.get("merchant_deck", [])),
            "point_deck_count": len(state.get("point_deck", [])),
            "gold_remaining": int(state.get("gold_remaining", 0)),
            "silver_remaining": int(state.get("silver_remaining", 0)),
            "end_triggered": bool(state.get("end_triggered")),
            "end_trigger_player": state.get("end_trigger_player"),
            "final_player": state.get("final_player"),
            "discard_player": state.get("discard_player"),
            "discard_needed": int(state.get("discard_needed", 0)),
            "players": players_view,
            "legal_actions": CenturySpiceRoadGame.get_legal_actions(state, viewer_id),
            "game_over": bool(state.get("game_over")),
            "winner": list(state.get("winner", [])),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") or bot_id != state.get("current_turn"):
            return None
        player = state["players"].get(bot_id)
        if not player:
            return None
        if state.get("phase") == "discard":
            discard = _blank_spices()
            needed = int(state.get("discard_needed", 0))
            for color in SPICE_TYPES:
                take = min(needed, int(player["spices"].get(color, 0)))
                discard[color] = take
                needed -= take
                if needed <= 0:
                    break
            return {"type": "discard", "spices": discard}
        for i, card in enumerate(state.get("point_market", [])):
            if _can_pay(player["spices"], card.get("cost", {})):
                return {"type": "claim", "index": i}
        if player.get("hand"):
            card = player["hand"][0]
            if card.get("type") == "trade":
                return {"type": "play", "card_id": card["id"], "times": 1 if _can_pay(player["spices"], card.get("cost", {})) else 0}
            return {"type": "play", "card_id": card["id"], "upgrades": []}
        if player.get("played_cards"):
            return {"type": "rest"}
        return {"type": "acquire", "index": 0, "payments": []}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
