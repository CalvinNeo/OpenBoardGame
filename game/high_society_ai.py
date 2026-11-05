from itertools import combinations
from math import prod
from typing import Dict, List, Optional, Sequence, Tuple


def _remaining_auctions(view: Dict) -> float:
    markers = max(0, 4 - view.get("end_marker_revealed_count", 0))
    return max(0.0, markers * (view.get("status_deck_count", 0) + 1) / (markers + 1) - 1)


def _multiplier(cards: List[Dict]) -> float:
    return 2.0 ** sum(card["type"] == "prestige" for card in cards) / (
        2 if any(card["id"] == "scandale" for card in cards) else 1
    )


def _projected_status(cards: List[Dict], pending_faux_pas: bool, future_luxury: float) -> float:
    base = sum(card.get("value", 0) for card in cards if card["type"] == "luxury")
    if any(card["id"] == "passe" for card in cards):
        base -= 5
    base += future_luxury
    if pending_faux_pas:
        base -= min(5.5, future_luxury)
    return base * _multiplier(cards)


def _after_card(player: Dict, card: Dict) -> Tuple[List[Dict], bool]:
    cards = list(player.get("status_cards", []))
    pending = bool(player.get("pending_faux_pas"))
    if card["type"] == "luxury" and pending:
        return [owned for owned in cards if owned["id"] != "faux_pas"], False
    if card["id"] == "faux_pas":
        luxuries = [owned for owned in cards if owned["type"] == "luxury"]
        if luxuries:
            discarded = min(luxuries, key=lambda owned: owned["value"])
            return [owned for owned in cards if owned["id"] != discarded["id"]], False
        return cards + [card], True
    return cards + [card], pending


def _cheapest_raise(hand: List[int], minimum: int) -> Optional[List[int]]:
    candidates = (
        choice
        for count in range(1, len(hand) + 1)
        for choice in combinations(sorted(hand), count)
        if sum(choice) > minimum
    )
    best = min(candidates, key=lambda choice: (
        sum(choice), len(choice), sum(1 / value for value in choice), choice
    ), default=None)
    return list(best) if best is not None else None


def _cash_estimates(player: Dict, money_values: Sequence[int]) -> List[int]:
    available = list(money_values)
    for value in player.get("table_money", []):
        available.remove(value)
    return [sum(choice) for choice in combinations(available, player["hand_count"])]


def choose_action(view: Dict, money_values: Sequence[int]) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    player = next((item for item in view.get("players", []) if item["player_id"] == view.get("you")), None)
    if view.get("game_over") or player is None or not legal:
        return None
    if "next_round" in legal:
        return {"type": "next_round"}
    cards = player.get("status_cards", [])
    if "choose_faux_pas_discard" in legal:
        luxuries = [card for card in cards if card["type"] == "luxury"]
        chosen = min(luxuries, key=lambda card: (card["value"], card["id"]), default=None)
        return {"type": "choose_faux_pas_discard", "card_id": chosen["id"]} if chosen else None
    if "pass" not in legal:
        return None
    fallback = {"type": "pass"}
    if "bid" not in legal or not view.get("current_status"):
        return fallback
    hand = view.get("your_hand_money", [])
    table_total = player.get("table_total", 0)
    bid = _cheapest_raise(hand, view.get("current_high_bid", 0) - table_total)
    if not bid:
        return fallback

    remaining = _remaining_auctions(view)
    future_luxury = remaining * (10 / 16) * 5.5 / len(view["players"])
    current_score = _projected_status(cards, player.get("pending_faux_pas", False), future_luxury)
    gained_cards, pending = _after_card(player, view["current_status"])
    gained_score = _projected_status(gained_cards, pending, future_luxury)
    scale = _multiplier(cards)
    disgrace = view["phase"] == "disgrace_auction"
    improvement = (current_score - gained_score if disgrace else gained_score - current_score) / scale
    if improvement <= 0:
        return fallback

    opponents = [opponent for opponent in view["players"] if opponent["player_id"] != view["you"]]
    estimates = [(_cash_estimates(opponent, money_values), opponent.get("table_total", 0)) for opponent in opponents]
    initial_cash = sum(money_values)
    future_spending = remaining * initial_cash / len(view["players"]) * 0.18

    def survival(cash: int, others_pay: bool = False) -> float:
        probabilities = []
        for totals, committed in estimates:
            lower_probability = 0.0
            for total in totals:
                total += 0 if others_pay else committed
                spending = min(total * 0.65, future_spending)
                if spending > 0:
                    lower_probability += max(0.0, min(1.0, (cash - total + spending) / spending))
                else:
                    lower_probability += float(total < cash)
            probabilities.append(1.0 - lower_probability / len(totals))
        return 1.0 - prod(probabilities)

    cash = sum(hand) + table_total
    total_bid = table_total + sum(bid)
    baseline = 12.0 + current_score / scale
    pass_value = survival(cash, others_pay=disgrace) * (baseline - improvement if disgrace else baseline)
    bid_value = survival(cash - total_bid) * (baseline if disgrace else baseline + improvement)
    price_per_status = initial_cash / (45.0 + remaining * 1.5)
    bid_value -= total_bid / price_per_status
    if bid_value <= pass_value + 1e-9:
        return fallback
    return {"type": "bid", "money_values": bid}
