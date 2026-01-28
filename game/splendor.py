import random
from typing import Dict, List, Optional, Tuple

from game.splendor_data import COLORS, NOBLES, TIER_DECKS, TOKEN_COLORS

DEFAULT_CONFIG = {
    "target_score": 15,
}

TOKEN_COUNTS = {
    2: 4,
    3: 5,
    4: 7,
}

GOLD_COUNT = 5


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _clone_card(card: Dict) -> Dict:
    return {
        "id": card["id"],
        "tier": card["tier"],
        "points": int(card["points"]),
        "bonus": card["bonus"],
        "cost": dict(card.get("cost", {})),
    }


def _clone_noble(noble: Dict) -> Dict:
    return {
        "id": noble["id"],
        "points": int(noble["points"]),
        "requirement": dict(noble.get("requirement", {})),
    }


def _build_deck(tier: str) -> List[Dict]:
    deck = [_clone_card(card) for card in TIER_DECKS[tier]]
    random.shuffle(deck)
    return deck


def _draw_card(deck: List[Dict]) -> Optional[Dict]:
    if not deck:
        return None
    return deck.pop()


def _total_tokens(tokens: Dict[str, int]) -> int:
    return sum(int(tokens.get(color, 0)) for color in TOKEN_COLORS)


def _player_bonus(player: Dict) -> Dict[str, int]:
    return {color: int(player["bonuses"].get(color, 0)) for color in COLORS}


def _required_cost(card: Dict, bonuses: Dict[str, int]) -> Dict[str, int]:
    required = {}
    for color in COLORS:
        base = int(card.get("cost", {}).get(color, 0))
        discount = int(bonuses.get(color, 0))
        required[color] = max(0, base - discount)
    return required


def _can_afford(required: Dict[str, int], tokens: Dict[str, int]) -> bool:
    total = sum(required.values())
    colored = sum(min(required[color], int(tokens.get(color, 0))) for color in COLORS)
    gold_needed = total - colored
    return int(tokens.get("gold", 0)) >= gold_needed


def _auto_payment(required: Dict[str, int], tokens: Dict[str, int]) -> Optional[Dict[str, int]]:
    payment = {}
    total = 0
    for color in COLORS:
        pay = min(required[color], int(tokens.get(color, 0)))
        payment[color] = pay
        total += pay
    remaining = sum(required.values()) - total
    if remaining > int(tokens.get("gold", 0)):
        return None
    payment["gold"] = remaining
    return payment


def _normalize_payment(payment: Optional[Dict]) -> Dict[str, int]:
    normalized = {color: 0 for color in TOKEN_COLORS}
    if not isinstance(payment, dict):
        return normalized
    for color in TOKEN_COLORS:
        value = payment.get(color, 0)
        if isinstance(value, int) and value > 0:
            normalized[color] = value
    return normalized


def _validate_payment(required: Dict[str, int], tokens: Dict[str, int], payment: Optional[Dict]) -> Tuple[Optional[Dict], Optional[str]]:
    normalized = _normalize_payment(payment)
    for color in COLORS:
        if normalized[color] > int(tokens.get(color, 0)):
            return None, "insufficient tokens"
        if normalized[color] > required[color]:
            return None, "overpaying with colored tokens"
    if normalized["gold"] > int(tokens.get("gold", 0)):
        return None, "insufficient gold"
    colored_paid = sum(normalized[color] for color in COLORS)
    remaining = sum(required.values()) - colored_paid
    if remaining < 0:
        return None, "payment exceeds cost"
    if normalized["gold"] != remaining:
        return None, "gold payment mismatch"
    return normalized, None


def _apply_payment(tokens_supply: Dict[str, int], player_tokens: Dict[str, int], payment: Dict[str, int]) -> None:
    for color in TOKEN_COLORS:
        count = int(payment.get(color, 0))
        if count <= 0:
            continue
        player_tokens[color] -= count
        tokens_supply[color] += count


def _eligible_nobles(state: Dict, player_id: str) -> List[Dict]:
    player = state["players"][player_id]
    bonuses = _player_bonus(player)
    eligible = []
    for noble in state["nobles"]:
        req = noble.get("requirement", {})
        if all(bonuses.get(color, 0) >= int(req.get(color, 0)) for color in COLORS):
            eligible.append(noble)
    return eligible


def _award_noble(state: Dict, player_id: str, noble: Dict) -> None:
    if noble not in state["nobles"]:
        return
    state["nobles"].remove(noble)
    player = state["players"][player_id]
    player["nobles"].append(noble)
    player["score"] += int(noble.get("points", 0))


def _end_turn(state: Dict, player_id: str) -> None:
    if state["final_round"]["active"]:
        pass
    elif state["players"][player_id]["score"] >= int(state["config"]["target_score"]):
        state["final_round"]["active"] = True
        state["final_round"]["triggered_by"] = player_id

    order = state["turn_order"]
    idx = order.index(state["current_turn"])
    next_player = order[(idx + 1) % len(order)]
    if state["final_round"]["active"] and next_player == state["final_round"]["triggered_by"]:
        _finish_game(state)
        return
    state["current_turn"] = next_player
    state["phase"] = "turn"
    state["pending_nobles"] = []


def _finish_game(state: Dict) -> None:
    scores = {pid: pdata["score"] for pid, pdata in state["players"].items()}
    max_score = max(scores.values()) if scores else 0
    contenders = [pid for pid, score in scores.items() if score == max_score]
    if len(contenders) > 1:
        min_cards = min(len(state["players"][pid]["purchased"]) for pid in contenders)
        contenders = [pid for pid in contenders if len(state["players"][pid]["purchased"]) == min_cards]
    state["winner"] = contenders
    state["game_over"] = True
    state["phase"] = "game_over"


class SplendorGame:
    game_id = "splendor"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < SplendorGame.min_players or len(players) > SplendorGame.max_players:
            raise ValueError("invalid player count")
        cfg = _merge_config(config)

        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        decks = {
            "tier1": _build_deck("tier1"),
            "tier2": _build_deck("tier2"),
            "tier3": _build_deck("tier3"),
        }

        market = {"tier1": [], "tier2": [], "tier3": []}
        for tier in market:
            while len(market[tier]) < 4 and decks[tier]:
                card = _draw_card(decks[tier])
                if card:
                    market[tier].append(card)

        noble_pool = [_clone_noble(noble) for noble in NOBLES]
        random.shuffle(noble_pool)
        nobles = noble_pool[: min(len(noble_pool), len(players) + 1)]

        token_count = TOKEN_COUNTS.get(len(players), 7)
        tokens_supply = {color: token_count for color in COLORS}
        tokens_supply["gold"] = GOLD_COUNT

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "tokens": {color: 0 for color in TOKEN_COLORS},
                "bonuses": {color: 0 for color in COLORS},
                "reserved": [],
                "purchased": [],
                "nobles": [],
                "score": 0,
            }

        return {
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "turn",
            "market": market,
            "decks": decks,
            "tokens_supply": tokens_supply,
            "nobles": nobles,
            "final_round": {"active": False, "triggered_by": None},
            "winner": [],
            "game_over": False,
            "config": cfg,
            "player_meta": player_meta,
            "pending_nobles": [],
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []

        phase = state.get("phase")
        player = state["players"][player_id]

        if phase == "discard_tokens":
            return ["discard_tokens"] if _total_tokens(player["tokens"]) > 10 else []

        if phase == "choose_noble":
            return ["choose_noble"]

        if phase != "turn":
            return []

        actions = []
        available_colors = [color for color in COLORS if state["tokens_supply"].get(color, 0) > 0]
        if len(available_colors) >= 3:
            actions.append("take_tokens")
        if any(state["tokens_supply"].get(color, 0) >= 4 for color in COLORS):
            actions.append("take_tokens_same")

        if len(player["reserved"]) < 3:
            if any(state["market"][tier] for tier in state["market"]):
                actions.append("reserve_market")
            if any(state["decks"][tier] for tier in state["decks"]):
                actions.append("reserve_deck")

        bonuses = _player_bonus(player)
        if any(_can_afford(_required_cost(card, bonuses), player["tokens"]) for tier in state["market"] for card in state["market"][tier]):
            actions.append("buy_market")
        if any(_can_afford(_required_cost(card, bonuses), player["tokens"]) for card in player["reserved"]):
            actions.append("buy_reserved")

        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        player = state["players"].get(player_id)
        if not player:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        phase = state.get("phase")
        if phase == "discard_tokens":
            if action_type != "discard_tokens":
                return [], "must discard tokens"
            tokens = _normalize_payment(action.get("tokens"))
            if sum(tokens.values()) <= 0:
                return [], "no tokens selected"
            for color in TOKEN_COLORS:
                if tokens[color] > player["tokens"].get(color, 0):
                    return [], "cannot discard more than you have"
            for color in TOKEN_COLORS:
                player["tokens"][color] -= tokens[color]
                state["tokens_supply"][color] += tokens[color]
            if _total_tokens(player["tokens"]) > 10:
                return events, None
            state["phase"] = "turn"
            eligible = _eligible_nobles(state, player_id)
            if len(eligible) == 1:
                _award_noble(state, player_id, eligible[0])
            elif len(eligible) > 1:
                state["phase"] = "choose_noble"
                state["pending_nobles"] = [noble["id"] for noble in eligible]
                return events, None
            _end_turn(state, player_id)
            return events, None

        if phase == "choose_noble":
            if action_type != "choose_noble":
                return [], "must choose a noble"
            noble_id = action.get("noble_id")
            if not isinstance(noble_id, str):
                return [], "invalid noble"
            choices = [n for n in state["nobles"] if n["id"] in state.get("pending_nobles", [])]
            target = next((n for n in choices if n["id"] == noble_id), None)
            if not target:
                return [], "noble not available"
            _award_noble(state, player_id, target)
            state["pending_nobles"] = []
            _end_turn(state, player_id)
            return events, None

        if phase != "turn":
            return [], "invalid phase"

        if action_type == "take_tokens":
            colors = action.get("colors")
            if not isinstance(colors, list):
                return [], "invalid colors"
            if len(colors) != 3 or len(set(colors)) != 3:
                return [], "must take 3 different colors"
            for color in colors:
                if color not in COLORS:
                    return [], "invalid color"
                if state["tokens_supply"].get(color, 0) <= 0:
                    return [], "token not available"
            for color in colors:
                state["tokens_supply"][color] -= 1
                player["tokens"][color] += 1

        elif action_type == "take_tokens_same":
            color = action.get("color")
            if color not in COLORS:
                return [], "invalid color"
            if state["tokens_supply"].get(color, 0) < 4:
                return [], "not enough tokens in supply"
            state["tokens_supply"][color] -= 2
            player["tokens"][color] += 2

        elif action_type == "reserve_market":
            tier = action.get("tier")
            index = action.get("index")
            if tier not in state["market"]:
                return [], "invalid tier"
            if not isinstance(index, int) or index < 0 or index >= len(state["market"][tier]):
                return [], "invalid card index"
            if len(player["reserved"]) >= 3:
                return [], "reserve limit reached"
            card = state["market"][tier].pop(index)
            player["reserved"].append(card)
            refill = _draw_card(state["decks"][tier])
            if refill:
                state["market"][tier].append(refill)
            if state["tokens_supply"].get("gold", 0) > 0:
                state["tokens_supply"]["gold"] -= 1
                player["tokens"]["gold"] += 1

        elif action_type == "reserve_deck":
            tier = action.get("tier")
            if tier not in state["decks"]:
                return [], "invalid tier"
            if len(player["reserved"]) >= 3:
                return [], "reserve limit reached"
            card = _draw_card(state["decks"][tier])
            if not card:
                return [], "deck empty"
            player["reserved"].append(card)
            if state["tokens_supply"].get("gold", 0) > 0:
                state["tokens_supply"]["gold"] -= 1
                player["tokens"]["gold"] += 1

        elif action_type == "buy_market":
            tier = action.get("tier")
            index = action.get("index")
            if tier not in state["market"]:
                return [], "invalid tier"
            if not isinstance(index, int) or index < 0 or index >= len(state["market"][tier]):
                return [], "invalid card index"
            card = state["market"][tier][index]
            bonuses = _player_bonus(player)
            required = _required_cost(card, bonuses)
            payment = action.get("payment")
            if payment is None:
                payment = _auto_payment(required, player["tokens"])
            normalized, error = _validate_payment(required, player["tokens"], payment)
            if error or not normalized:
                return [], error or "cannot afford"
            _apply_payment(state["tokens_supply"], player["tokens"], normalized)
            state["market"][tier].pop(index)
            refill = _draw_card(state["decks"][tier])
            if refill:
                state["market"][tier].append(refill)
            player["purchased"].append(card)
            player["bonuses"][card["bonus"]] += 1
            player["score"] += int(card.get("points", 0))

        elif action_type == "buy_reserved":
            index = action.get("reserved_index")
            if not isinstance(index, int) or index < 0 or index >= len(player["reserved"]):
                return [], "invalid reserved card"
            card = player["reserved"][index]
            bonuses = _player_bonus(player)
            required = _required_cost(card, bonuses)
            payment = action.get("payment")
            if payment is None:
                payment = _auto_payment(required, player["tokens"])
            normalized, error = _validate_payment(required, player["tokens"], payment)
            if error or not normalized:
                return [], error or "cannot afford"
            _apply_payment(state["tokens_supply"], player["tokens"], normalized)
            player["reserved"].pop(index)
            player["purchased"].append(card)
            player["bonuses"][card["bonus"]] += 1
            player["score"] += int(card.get("points", 0))

        else:
            return [], "unknown action"

        if _total_tokens(player["tokens"]) > 10:
            state["phase"] = "discard_tokens"
            return events, None

        eligible = _eligible_nobles(state, player_id)
        if len(eligible) == 1:
            _award_noble(state, player_id, eligible[0])
        elif len(eligible) > 1:
            state["phase"] = "choose_noble"
            state["pending_nobles"] = [noble["id"] for noble in eligible]
            return events, None

        _end_turn(state, player_id)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        def card_view(card: Dict) -> Dict:
            return {
                "id": card["id"],
                "tier": card["tier"],
                "points": int(card.get("points", 0)),
                "bonus": card["bonus"],
                "cost": dict(card.get("cost", {})),
            }

        def noble_view(noble: Dict) -> Dict:
            return {
                "id": noble["id"],
                "points": int(noble.get("points", 0)),
                "requirement": dict(noble.get("requirement", {})),
            }

        players_view = []
        for pid in state["turn_order"]:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": pdata["score"],
                    "tokens": dict(pdata["tokens"]),
                    "bonuses": dict(pdata["bonuses"]),
                    "reserved_count": len(pdata["reserved"]),
                    "purchased_count": len(pdata["purchased"]),
                    "nobles": [noble["id"] for noble in pdata["nobles"]],
                }
            )

        viewer = state["players"].get(viewer_id)
        viewer_bonuses = _player_bonus(viewer) if viewer else {color: 0 for color in COLORS}
        viewer_tokens = viewer["tokens"] if viewer else {color: 0 for color in TOKEN_COLORS}

        market_view = {}
        for tier, cards in state["market"].items():
            tier_cards = []
            for card in cards:
                view = card_view(card)
                required = _required_cost(card, viewer_bonuses)
                view["affordable"] = _can_afford(required, viewer_tokens)
                tier_cards.append(view)
            market_view[tier] = tier_cards

        nobles_view = []
        if viewer:
            eligible_ids = {noble["id"] for noble in _eligible_nobles(state, viewer_id)}
        else:
            eligible_ids = set()
        for noble in state["nobles"]:
            entry = noble_view(noble)
            entry["eligible"] = noble["id"] in eligible_ids
            nobles_view.append(entry)

        reserved_view = []
        if viewer:
            bonuses = _player_bonus(viewer)
            for card in viewer["reserved"]:
                view = card_view(card)
                required = _required_cost(card, bonuses)
                view["affordable"] = _can_afford(required, viewer_tokens)
                reserved_view.append(view)

        return {
            "you": viewer_id,
            "phase": state["phase"],
            "current_turn": state["current_turn"],
            "players": players_view,
            "market": market_view,
            "nobles": nobles_view,
            "your_reserved": reserved_view,
            "tokens_supply": dict(state["tokens_supply"]),
            "final_round": dict(state["final_round"]),
            "pending_nobles": list(state.get("pending_nobles", [])),
            "winner": list(state.get("winner", [])),
            "legal_actions": SplendorGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "config": {
                "target_score": state["config"]["target_score"],
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id != state.get("current_turn"):
            return None

        phase = state.get("phase")
        player = state["players"][bot_id]

        if phase == "discard_tokens":
            excess = _total_tokens(player["tokens"]) - 10
            if excess <= 0:
                return None
            discard = {color: 0 for color in TOKEN_COLORS}
            ordered = sorted(TOKEN_COLORS, key=lambda c: player["tokens"].get(c, 0), reverse=True)
            remaining = excess
            for color in ordered:
                if remaining <= 0:
                    break
                available = player["tokens"].get(color, 0)
                if available <= 0:
                    continue
                take = min(available, remaining)
                discard[color] = take
                remaining -= take
            return {"type": "discard_tokens", "tokens": discard}

        if phase == "choose_noble":
            choices = state.get("pending_nobles", [])
            if not choices:
                return None
            return {"type": "choose_noble", "noble_id": choices[0]}

        if phase != "turn":
            return None

        bonuses = _player_bonus(player)
        affordable_market = []
        for tier, cards in state["market"].items():
            for idx, card in enumerate(cards):
                if _can_afford(_required_cost(card, bonuses), player["tokens"]):
                    affordable_market.append((card, tier, idx))

        affordable_reserved = []
        for idx, card in enumerate(player["reserved"]):
            if _can_afford(_required_cost(card, bonuses), player["tokens"]):
                affordable_reserved.append((card, idx))

        if affordable_market or affordable_reserved:
            best = None
            if affordable_market:
                best = max(affordable_market, key=lambda item: (item[0]["points"], item[0]["tier"]))
                return {"type": "buy_market", "tier": best[1], "index": best[2]}
            best = max(affordable_reserved, key=lambda item: (item[0]["points"], item[0]["tier"]))
            return {"type": "buy_reserved", "reserved_index": best[1]}

        if len(player["reserved"]) < 3:
            for tier in ["tier3", "tier2", "tier1"]:
                if state["market"][tier]:
                    return {"type": "reserve_market", "tier": tier, "index": 0}
            for tier in ["tier3", "tier2", "tier1"]:
                if state["decks"][tier]:
                    return {"type": "reserve_deck", "tier": tier}

        available = [color for color in COLORS if state["tokens_supply"].get(color, 0) > 0]
        if len(available) >= 3:
            pick = sorted(available, key=lambda c: state["tokens_supply"].get(c, 0), reverse=True)[:3]
            return {"type": "take_tokens", "colors": pick}
        for color in COLORS:
            if state["tokens_supply"].get(color, 0) >= 4:
                return {"type": "take_tokens_same", "color": color}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
