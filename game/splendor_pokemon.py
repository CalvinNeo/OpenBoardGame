import random
from typing import Dict, List, Optional, Tuple

from game.pokemon_splendor_data import MASTER_COLOR, REGULAR_COLORS, TIER_DECKS, TIER_LABELS, TOKEN_COLORS

DEFAULT_CONFIG = {
    "target_score": 18,
}

TOKEN_COUNTS = {
    2: 4,
    3: 5,
    4: 7,
}

MASTER_COUNT = 5


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _clone_card(card: Dict) -> Dict:
    return {
        "id": card.get("id"),
        "name": card.get("name"),
        "name_en": card.get("name_en"),
        "tier": card.get("tier"),
        "tier_label": card.get("tier_label") or TIER_LABELS.get(card.get("tier")),
        "points": int(card.get("points", 0)),
        "bonus": card.get("bonus"),
        "cost": dict(card.get("cost", {})),
        "evolution_targets": list(card.get("evolution_targets", [])),
        "evolution_requirements": dict(card.get("evolution_requirements", {})),
    }


def _build_deck(tier: str) -> List[Dict]:
    deck = [_clone_card(card) for card in TIER_DECKS.get(tier, [])]
    random.shuffle(deck)
    return deck


def _draw_card(deck: List[Dict]) -> Optional[Dict]:
    if not deck:
        return None
    return deck.pop()


def _total_tokens(tokens: Dict[str, int]) -> int:
    return sum(int(tokens.get(color, 0)) for color in TOKEN_COLORS)


def _player_bonus(player: Dict) -> Dict[str, int]:
    return {color: int(player["bonuses"].get(color, 0)) for color in REGULAR_COLORS}


def _required_cost(card: Dict, bonuses: Dict[str, int]) -> Tuple[Dict[str, int], int]:
    required = {}
    for color in REGULAR_COLORS:
        base = int(card.get("cost", {}).get(color, 0))
        discount = int(bonuses.get(color, 0))
        required[color] = max(0, base - discount)
    master_required = int(card.get("cost", {}).get(MASTER_COLOR, 0))
    return required, master_required


def _can_afford(card: Dict, bonuses: Dict[str, int], tokens: Dict[str, int]) -> bool:
    required, master_required = _required_cost(card, bonuses)
    master_tokens = int(tokens.get(MASTER_COLOR, 0))
    if master_tokens < master_required:
        return False
    remaining_master = master_tokens - master_required
    colored_paid = sum(min(required[color], int(tokens.get(color, 0))) for color in REGULAR_COLORS)
    remaining = sum(required.values()) - colored_paid
    return remaining <= remaining_master


def _auto_payment(card: Dict, bonuses: Dict[str, int], tokens: Dict[str, int]) -> Optional[Dict[str, int]]:
    required, master_required = _required_cost(card, bonuses)
    payment = {color: 0 for color in TOKEN_COLORS}
    master_tokens = int(tokens.get(MASTER_COLOR, 0))
    if master_tokens < master_required:
        return None

    for color in REGULAR_COLORS:
        pay = min(required[color], int(tokens.get(color, 0)))
        payment[color] = pay
    remaining_regular = sum(required.values()) - sum(payment[color] for color in REGULAR_COLORS)
    remaining_master = master_tokens - master_required
    if remaining_regular > remaining_master:
        return None
    payment[MASTER_COLOR] = master_required + remaining_regular
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


def _validate_payment(card: Dict, bonuses: Dict[str, int], tokens: Dict[str, int], payment: Optional[Dict]) -> Tuple[Optional[Dict], Optional[str]]:
    required, master_required = _required_cost(card, bonuses)
    normalized = _normalize_payment(payment)

    for color in REGULAR_COLORS:
        if normalized[color] > int(tokens.get(color, 0)):
            return None, "insufficient tokens"
        if normalized[color] > required[color]:
            return None, "overpaying with colored tokens"

    if normalized[MASTER_COLOR] > int(tokens.get(MASTER_COLOR, 0)):
        return None, "insufficient master balls"
    if normalized[MASTER_COLOR] < master_required:
        return None, "master ball payment mismatch"

    colored_paid = sum(normalized[color] for color in REGULAR_COLORS)
    remaining_regular = sum(required.values()) - colored_paid
    if remaining_regular < 0:
        return None, "payment exceeds cost"

    if normalized[MASTER_COLOR] != master_required + remaining_regular:
        return None, "master ball payment mismatch"
    return normalized, None


def _apply_payment(tokens_supply: Dict[str, int], player_tokens: Dict[str, int], payment: Dict[str, int]) -> None:
    for color in TOKEN_COLORS:
        count = int(payment.get(color, 0))
        if count <= 0:
            continue
        player_tokens[color] -= count
        tokens_supply[color] += count


def _auto_discard_for_gain(tokens: Dict[str, int], gain: Dict[str, int]) -> Optional[Dict[str, int]]:
    total = _total_tokens(tokens) + sum(int(gain.get(color, 0)) for color in TOKEN_COLORS)
    excess = total - 10
    if excess <= 0:
        return None
    available = {color: int(tokens.get(color, 0)) + int(gain.get(color, 0)) for color in TOKEN_COLORS}
    discard = {color: 0 for color in TOKEN_COLORS}
    remaining = excess
    ordered = sorted(TOKEN_COLORS, key=lambda c: available.get(c, 0), reverse=True)
    for color in ordered:
        if remaining <= 0:
            break
        amount = min(available.get(color, 0), remaining)
        if amount > 0:
            discard[color] = amount
            remaining -= amount
    return discard


def _validate_discard_for_gain(tokens: Dict[str, int], gain: Dict[str, int], discard: Optional[Dict]) -> Tuple[Optional[Dict], Optional[str]]:
    required = _total_tokens(tokens) + sum(int(gain.get(color, 0)) for color in TOKEN_COLORS) - 10
    if required <= 0:
        return {color: 0 for color in TOKEN_COLORS}, None
    normalized = _normalize_payment(discard)
    if sum(normalized.values()) != required:
        return None, f"must discard {required} tokens"
    for color in TOKEN_COLORS:
        available = int(tokens.get(color, 0)) + int(gain.get(color, 0))
        if normalized[color] > available:
            return None, "cannot discard more than you have"
    return normalized, None


def _evolution_requirements_met(card: Dict, bonuses: Dict[str, int]) -> bool:
    requirements = card.get("evolution_requirements", {})
    for color, required in requirements.items():
        if bonuses.get(color, 0) < int(required):
            return False
    return True


def _available_evolutions(state: Dict, player_id: str) -> List[Dict]:
    player = state["players"][player_id]
    bonuses = _player_bonus(player)
    options = []
    for base_card in player["captured"]:
        targets = base_card.get("evolution_targets", [])
        if not targets:
            continue
        if not _evolution_requirements_met(base_card, bonuses):
            continue
        for tier, cards in state["market"].items():
            for idx, card in enumerate(cards):
                if card.get("name_en") in targets:
                    options.append(
                        {
                            "base_id": base_card["id"],
                            "target_id": card["id"],
                            "source": "market",
                            "tier": tier,
                            "index": idx,
                        }
                    )
        for idx, card in enumerate(player["reserved"]):
            if card.get("name_en") in targets:
                options.append(
                    {
                        "base_id": base_card["id"],
                        "target_id": card["id"],
                        "source": "reserved",
                        "reserved_index": idx,
                    }
                )
    return options


def _find_card_in_market(state: Dict, card_id: str) -> Optional[Tuple[str, int, Dict]]:
    for tier, cards in state["market"].items():
        for idx, card in enumerate(cards):
            if card.get("id") == card_id:
                return tier, idx, card
    return None


def _advance_after_evolution(state: Dict, player_id: str) -> None:
    player = state["players"][player_id]
    if _total_tokens(player["tokens"]) > 10:
        state["phase"] = "discard_tokens"
        return
    _end_turn(state, player_id)


def _advance_after_main_action(state: Dict, player_id: str) -> None:
    if _available_evolutions(state, player_id):
        state["phase"] = "evolution"
        return
    _advance_after_evolution(state, player_id)


def _end_turn(state: Dict, player_id: str) -> None:
    if state["final_round"]["active"]:
        pass
    elif state["players"][player_id]["score"] >= int(state["config"]["target_score"]):
        state["final_round"]["active"] = True
        state["final_round"]["triggered_by"] = player_id

    order = state["turn_order"]
    last_player = order[-1] if order else None
    if state["final_round"]["active"] and player_id == last_player:
        _finish_game(state)
        return

    idx = order.index(state["current_turn"])
    next_player = order[(idx + 1) % len(order)]
    state["current_turn"] = next_player
    state["phase"] = "turn"


def _finish_game(state: Dict) -> None:
    scores = {pid: pdata["score"] for pid, pdata in state["players"].items()}
    max_score = max(scores.values()) if scores else 0
    contenders = [pid for pid, score in scores.items() if score == max_score]
    if len(contenders) > 1:
        max_evolved = max(len(state["players"][pid]["evolved"]) for pid in contenders)
        contenders = [pid for pid in contenders if len(state["players"][pid]["evolved"]) == max_evolved]
    state["winner"] = contenders
    state["game_over"] = True
    state["phase"] = "game_over"


class PokemonSplendorGame:
    game_id = "splendor_pokemon"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if len(players) < PokemonSplendorGame.min_players or len(players) > PokemonSplendorGame.max_players:
            raise ValueError("invalid player count")
        cfg = _merge_config(config)

        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        if player_ids:
            start_index = random.randrange(len(player_ids))
            turn_order = player_ids[start_index:] + player_ids[:start_index]
        else:
            turn_order = []

        decks = {
            "lv1": _build_deck("lv1"),
            "lv2": _build_deck("lv2"),
            "lv3": _build_deck("lv3"),
            "rare": _build_deck("rare"),
            "legendary": _build_deck("legendary"),
        }

        market = {"lv1": [], "lv2": [], "lv3": [], "rare": [], "legendary": []}
        for tier in ["lv1", "lv2", "lv3"]:
            while len(market[tier]) < 4 and decks[tier]:
                card = _draw_card(decks[tier])
                if card:
                    market[tier].append(card)
        for tier in ["rare", "legendary"]:
            if decks[tier]:
                card = _draw_card(decks[tier])
                if card:
                    market[tier].append(card)

        token_count = TOKEN_COUNTS.get(len(players), 7)
        tokens_supply = {color: token_count for color in REGULAR_COLORS}
        tokens_supply[MASTER_COLOR] = MASTER_COUNT

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "tokens": {color: 0 for color in TOKEN_COLORS},
                "bonuses": {color: 0 for color in REGULAR_COLORS},
                "reserved": [],
                "captured": [],
                "evolved": [],
                "score": 0,
            }

        starting_player = turn_order[0] if turn_order else None

        return {
            "players": state_players,
            "turn_order": turn_order,
            "current_turn": starting_player,
            "phase": "turn",
            "market": market,
            "decks": decks,
            "tokens_supply": tokens_supply,
            "final_round": {"active": False, "triggered_by": None},
            "winner": [],
            "game_over": False,
            "config": cfg,
            "player_meta": player_meta,
            "starting_player": starting_player,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id != state.get("current_turn"):
            return []

        player = state["players"][player_id]
        phase = state.get("phase")

        if phase == "discard_tokens":
            return ["discard_tokens"] if _total_tokens(player["tokens"]) > 10 else []

        if phase == "evolution":
            actions = ["skip_evolution"]
            if _available_evolutions(state, player_id):
                actions.append("evolve")
            return actions

        if phase != "turn":
            return []

        actions = []
        available_colors = [color for color in REGULAR_COLORS if state["tokens_supply"].get(color, 0) > 0]
        if available_colors:
            actions.append("take_tokens")
        if any(state["tokens_supply"].get(color, 0) >= 4 for color in REGULAR_COLORS):
            actions.append("take_tokens_same")

        if len(player["reserved"]) < 3:
            if any(state["market"][tier] for tier in ["lv1", "lv2", "lv3"]):
                actions.append("reserve_market")
            if any(state["decks"][tier] for tier in ["lv1", "lv2", "lv3"]):
                actions.append("reserve_deck")

        bonuses = _player_bonus(player)
        if any(_can_afford(card, bonuses, player["tokens"]) for tier in state["market"] for card in state["market"][tier]):
            actions.append("buy_market")
        if any(_can_afford(card, bonuses, player["tokens"]) for card in player["reserved"]):
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
            _end_turn(state, player_id)
            return events, None

        if phase == "evolution":
            if action_type == "skip_evolution":
                _advance_after_evolution(state, player_id)
                return events, None
            if action_type != "evolve":
                return [], "must evolve or skip"

            base_id = action.get("base_id")
            target_id = action.get("target_id")
            if not isinstance(base_id, str) or not isinstance(target_id, str):
                return [], "invalid evolution"
            base_card = next((card for card in player["captured"] if card.get("id") == base_id), None)
            if not base_card:
                return [], "base card not found"

            bonuses = _player_bonus(player)
            if not base_card.get("evolution_targets"):
                return [], "card cannot evolve"
            if not _evolution_requirements_met(base_card, bonuses):
                return [], "evolution requirements not met"

            target_location = _find_card_in_market(state, target_id)
            target_card = None
            target_source = None
            if target_location:
                tier, idx, card = target_location
                if card.get("name_en") in base_card.get("evolution_targets", []):
                    target_card = card
                    target_source = ("market", tier, idx)
            if not target_card:
                for idx, card in enumerate(player["reserved"]):
                    if card.get("id") == target_id and card.get("name_en") in base_card.get("evolution_targets", []):
                        target_card = card
                        target_source = ("reserved", idx)
                        break

            if not target_card:
                return [], "target card not available"

            player["captured"] = [card for card in player["captured"] if card.get("id") != base_id]
            player["evolved"].append(base_card)
            if base_card.get("bonus") in REGULAR_COLORS:
                player["bonuses"][base_card["bonus"]] -= 1
            player["score"] -= int(base_card.get("points", 0))

            if target_source[0] == "market":
                tier, idx = target_source[1], target_source[2]
                state["market"][tier].pop(idx)
                refill = _draw_card(state["decks"][tier])
                if refill:
                    state["market"][tier].append(refill)
            else:
                reserved_idx = target_source[1]
                player["reserved"].pop(reserved_idx)

            player["captured"].append(target_card)
            if target_card.get("bonus") in REGULAR_COLORS:
                player["bonuses"][target_card["bonus"]] += 1
            player["score"] += int(target_card.get("points", 0))

            _advance_after_evolution(state, player_id)
            return events, None

        if phase != "turn":
            return [], "invalid phase"

        if action_type == "take_tokens":
            colors = action.get("colors")
            if not isinstance(colors, list):
                return [], "invalid colors"
            unique_colors = [c for c in colors if isinstance(c, str)]
            if len(unique_colors) != len(colors):
                return [], "invalid colors"
            available_colors = [color for color in REGULAR_COLORS if state["tokens_supply"].get(color, 0) > 0]
            if not available_colors:
                return [], "no tokens available"
            required_count = min(3, len(available_colors))
            if len(colors) != required_count or len(set(colors)) != len(colors):
                return [], "must take distinct colors"
            if any(color not in available_colors for color in colors):
                return [], "invalid color"
            if len(available_colors) < 3 and set(colors) != set(available_colors):
                return [], "must take all available colors"

            gain = {color: 0 for color in TOKEN_COLORS}
            for color in colors:
                gain[color] += 1
            discard, error = _validate_discard_for_gain(player["tokens"], gain, action.get("discard"))
            if error or discard is None:
                return [], error or "invalid discard"
            for color in colors:
                state["tokens_supply"][color] -= 1
                player["tokens"][color] += 1
            if sum(discard.values()) > 0:
                for color in TOKEN_COLORS:
                    player["tokens"][color] -= discard[color]
                    state["tokens_supply"][color] += discard[color]

            _advance_after_main_action(state, player_id)
            return events, None

        if action_type == "take_tokens_same":
            color = action.get("color")
            if color not in REGULAR_COLORS:
                return [], "invalid color"
            if state["tokens_supply"].get(color, 0) < 4:
                return [], "not enough tokens in supply"
            gain = {token: 0 for token in TOKEN_COLORS}
            gain[color] = 2
            discard, error = _validate_discard_for_gain(player["tokens"], gain, action.get("discard"))
            if error or discard is None:
                return [], error or "invalid discard"
            state["tokens_supply"][color] -= 2
            player["tokens"][color] += 2
            if sum(discard.values()) > 0:
                for token in TOKEN_COLORS:
                    player["tokens"][token] -= discard[token]
                    state["tokens_supply"][token] += discard[token]

            _advance_after_main_action(state, player_id)
            return events, None

        if action_type == "reserve_market":
            tier = action.get("tier")
            index = action.get("index")
            if tier not in ["lv1", "lv2", "lv3"]:
                return [], "invalid tier"
            if not isinstance(index, int) or index < 0 or index >= len(state["market"][tier]):
                return [], "invalid card index"
            if len(player["reserved"]) >= 3:
                return [], "reserve limit reached"
            master_gain = 1 if state["tokens_supply"].get(MASTER_COLOR, 0) > 0 else 0
            gain = {color: 0 for color in TOKEN_COLORS}
            gain[MASTER_COLOR] = master_gain
            discard, error = _validate_discard_for_gain(player["tokens"], gain, action.get("discard"))
            if error or discard is None:
                return [], error or "invalid discard"
            card = state["market"][tier].pop(index)
            player["reserved"].append(card)
            refill = _draw_card(state["decks"][tier])
            if refill:
                state["market"][tier].append(refill)
            if master_gain > 0:
                state["tokens_supply"][MASTER_COLOR] -= 1
                player["tokens"][MASTER_COLOR] += 1
            if sum(discard.values()) > 0:
                for color in TOKEN_COLORS:
                    player["tokens"][color] -= discard[color]
                    state["tokens_supply"][color] += discard[color]

            _advance_after_main_action(state, player_id)
            return events, None

        if action_type == "reserve_deck":
            tier = action.get("tier")
            if tier not in ["lv1", "lv2", "lv3"]:
                return [], "invalid tier"
            if len(player["reserved"]) >= 3:
                return [], "reserve limit reached"
            master_gain = 1 if state["tokens_supply"].get(MASTER_COLOR, 0) > 0 else 0
            gain = {color: 0 for color in TOKEN_COLORS}
            gain[MASTER_COLOR] = master_gain
            discard, error = _validate_discard_for_gain(player["tokens"], gain, action.get("discard"))
            if error or discard is None:
                return [], error or "invalid discard"
            card = _draw_card(state["decks"][tier])
            if not card:
                return [], "deck empty"
            player["reserved"].append(card)
            if master_gain > 0:
                state["tokens_supply"][MASTER_COLOR] -= 1
                player["tokens"][MASTER_COLOR] += 1
            if sum(discard.values()) > 0:
                for color in TOKEN_COLORS:
                    player["tokens"][color] -= discard[color]
                    state["tokens_supply"][color] += discard[color]

            _advance_after_main_action(state, player_id)
            return events, None

        if action_type == "buy_market":
            tier = action.get("tier")
            index = action.get("index")
            if tier not in state["market"]:
                return [], "invalid tier"
            if not isinstance(index, int) or index < 0 or index >= len(state["market"][tier]):
                return [], "invalid card index"
            card = state["market"][tier][index]
            bonuses = _player_bonus(player)
            payment = action.get("payment")
            if payment is None:
                payment = _auto_payment(card, bonuses, player["tokens"])
            normalized, error = _validate_payment(card, bonuses, player["tokens"], payment)
            if error or not normalized:
                return [], error or "cannot afford"
            _apply_payment(state["tokens_supply"], player["tokens"], normalized)
            state["market"][tier].pop(index)
            refill = _draw_card(state["decks"][tier])
            if refill:
                state["market"][tier].append(refill)
            player["captured"].append(card)
            if card.get("bonus") in REGULAR_COLORS:
                player["bonuses"][card["bonus"]] += 1
            player["score"] += int(card.get("points", 0))

            _advance_after_main_action(state, player_id)
            return events, None

        if action_type == "buy_reserved":
            index = action.get("reserved_index")
            if not isinstance(index, int) or index < 0 or index >= len(player["reserved"]):
                return [], "invalid reserved card"
            card = player["reserved"][index]
            bonuses = _player_bonus(player)
            payment = action.get("payment")
            if payment is None:
                payment = _auto_payment(card, bonuses, player["tokens"])
            normalized, error = _validate_payment(card, bonuses, player["tokens"], payment)
            if error or not normalized:
                return [], error or "cannot afford"
            _apply_payment(state["tokens_supply"], player["tokens"], normalized)
            player["reserved"].pop(index)
            player["captured"].append(card)
            if card.get("bonus") in REGULAR_COLORS:
                player["bonuses"][card["bonus"]] += 1
            player["score"] += int(card.get("points", 0))

            _advance_after_main_action(state, player_id)
            return events, None

        return [], "unknown action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        def card_view(card: Dict) -> Dict:
            return {
                "id": card.get("id"),
                "name": card.get("name"),
                "name_en": card.get("name_en"),
                "tier": card.get("tier"),
                "tier_label": card.get("tier_label"),
                "points": int(card.get("points", 0)),
                "bonus": card.get("bonus"),
                "cost": dict(card.get("cost", {})),
                "evolution": {
                    "targets": list(card.get("evolution_targets", [])),
                    "requirements": dict(card.get("evolution_requirements", {})),
                },
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
                    "captured_count": len(pdata["captured"]),
                    "evolved_count": len(pdata["evolved"]),
                    "captured": [card_view(card) for card in pdata["captured"]],
                }
            )

        viewer = state["players"].get(viewer_id)
        viewer_bonuses = _player_bonus(viewer) if viewer else {color: 0 for color in REGULAR_COLORS}
        viewer_tokens = viewer["tokens"] if viewer else {color: 0 for color in TOKEN_COLORS}

        market_view = {}
        for tier, cards in state["market"].items():
            tier_cards = []
            for card in cards:
                view = card_view(card)
                view["affordable"] = _can_afford(card, viewer_bonuses, viewer_tokens)
                tier_cards.append(view)
            market_view[tier] = tier_cards

        reserved_view = []
        if viewer:
            for card in viewer["reserved"]:
                view = card_view(card)
                view["affordable"] = _can_afford(card, viewer_bonuses, viewer_tokens)
                reserved_view.append(view)

        evolution_options = []
        if viewer:
            evolution_options = _available_evolutions(state, viewer_id)

        return {
            "you": viewer_id,
            "phase": state["phase"],
            "current_turn": state["current_turn"],
            "players": players_view,
            "market": market_view,
            "your_reserved": reserved_view,
            "tokens_supply": dict(state["tokens_supply"]),
            "final_round": dict(state["final_round"]),
            "winner": list(state.get("winner", [])),
            "game_over": state.get("game_over", False),
            "legal_actions": PokemonSplendorGame.get_legal_actions(state, viewer_id),
            "starting_player": state.get("starting_player"),
            "evolution_options": evolution_options,
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

        if phase == "evolution":
            options = _available_evolutions(state, bot_id)
            if options:
                choice = options[0]
                return {"type": "evolve", "base_id": choice["base_id"], "target_id": choice["target_id"]}
            return {"type": "skip_evolution"}

        if phase != "turn":
            return None

        bonuses = _player_bonus(player)
        affordable_market = []
        for tier, cards in state["market"].items():
            for idx, card in enumerate(cards):
                if _can_afford(card, bonuses, player["tokens"]):
                    affordable_market.append((card, tier, idx))

        affordable_reserved = []
        for idx, card in enumerate(player["reserved"]):
            if _can_afford(card, bonuses, player["tokens"]):
                affordable_reserved.append((card, idx))

        if affordable_market or affordable_reserved:
            if affordable_market:
                best = max(affordable_market, key=lambda item: (item[0]["points"], item[0]["tier"]))
                return {"type": "buy_market", "tier": best[1], "index": best[2]}
            best = max(affordable_reserved, key=lambda item: (item[0]["points"], item[0]["tier"]))
            return {"type": "buy_reserved", "reserved_index": best[1]}

        if len(player["reserved"]) < 3:
            for tier in ["lv3", "lv2", "lv1"]:
                if state["market"][tier]:
                    gain = {color: 0 for color in TOKEN_COLORS}
                    if state["tokens_supply"].get(MASTER_COLOR, 0) > 0:
                        gain[MASTER_COLOR] = 1
                    discard = _auto_discard_for_gain(player["tokens"], gain)
                    action = {"type": "reserve_market", "tier": tier, "index": 0}
                    if discard:
                        action["discard"] = discard
                    return action
            for tier in ["lv3", "lv2", "lv1"]:
                if state["decks"][tier]:
                    gain = {color: 0 for color in TOKEN_COLORS}
                    if state["tokens_supply"].get(MASTER_COLOR, 0) > 0:
                        gain[MASTER_COLOR] = 1
                    discard = _auto_discard_for_gain(player["tokens"], gain)
                    action = {"type": "reserve_deck", "tier": tier}
                    if discard:
                        action["discard"] = discard
                    return action

        available = [color for color in REGULAR_COLORS if state["tokens_supply"].get(color, 0) > 0]
        if available:
            pick_count = min(3, len(available))
            pick = sorted(available, key=lambda c: state["tokens_supply"].get(c, 0), reverse=True)[:pick_count]
            gain = {color: 0 for color in TOKEN_COLORS}
            for color in pick:
                gain[color] += 1
            discard = _auto_discard_for_gain(player["tokens"], gain)
            action = {"type": "take_tokens", "colors": pick}
            if discard:
                action["discard"] = discard
            return action

        for color in REGULAR_COLORS:
            if state["tokens_supply"].get(color, 0) >= 4:
                gain = {token: 0 for token in TOKEN_COLORS}
                gain[color] = 2
                discard = _auto_discard_for_gain(player["tokens"], gain)
                action = {"type": "take_tokens_same", "color": color}
                if discard:
                    action["discard"] = discard
                return action

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
