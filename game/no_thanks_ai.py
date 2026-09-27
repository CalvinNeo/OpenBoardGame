"""Deterministic No Thanks! policy operating exclusively on a player's view."""

from typing import Dict, List, Optional, Set

from game.no_thanks import CARD_VALUES, take_delta


def _future_discount(cards: List[int], card: int, unseen: Set[int], remaining: int) -> float:
    if not unseen or not remaining:
        return 0.0
    chance = remaining / len(unseen)
    # Future single-gap bridges are useful, but an opponent may take the missing card.
    if card - 1 in unseen and card - 2 in cards:
        return card * chance * 0.35
    if card + 1 in unseen and card + 2 in cards:
        return (card + 2) * chance * 0.35
    return chance * 0.7 if card - 1 in unseen else 0.0


def _acceptable_cost(chips: float, remaining: int, count: int) -> float:
    # Chips buy future refusals; scarcity matters much less at the end of the deck.
    supply_target = min(7.0, 1.5 + remaining / count)
    scarcity = max(0.0, supply_target - chips)
    return (3.0 + scarcity * 2.3) if remaining else 0.0


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if "next_round" in legal:
        return {"type": "next_round"}
    if "take" not in legal:
        return None
    if "pass" not in legal:
        return {"type": "take"}
    players = view["players"]
    own = next(player for player in players if player["player_id"] == view["you"])
    chips, card, pot = own["chips"], view["current_card"], view["pot"]
    remaining = view["deck_count"]
    seen = {card}
    for player in players:
        seen.update(player["cards"])
    unseen = set(CARD_VALUES) - seen
    delta = take_delta(own["cards"], card, pot)
    raw_delta = delta + pot
    # Never gamble away a bridge or lower end that removes existing penalty points.
    if raw_delta < 0:
        return {"type": "take"}

    adjusted = delta - _future_discount(own["cards"], card, unseen, remaining)
    limit = _acceptable_cost(chips, remaining, len(players))
    # A zero-cost extension (or profitable offer) is good even with a healthy reserve.
    willing = raw_delta == 0 or adjusted <= limit
    if not willing:
        return {"type": "pass"}

    # A conservative extra lap can collect opponents' chips. Estimate their reserves
    # only from chip conservation; never inspect their private count or infer the deck.
    opponent_chips = max(0.0, (view["starting_chips"] * len(players) - chips - pot) / (len(players) - 1))
    safe_lap = remaining > 0 and chips >= 5 and opponent_chips >= 4 and pot < len(players) - 1
    if safe_lap:
        for offset in range(1, len(players)):
            opponent = players[(players.index(own) + offset) % len(players)]
            cost = take_delta(opponent["cards"], card, pot + offset)
            cost -= _future_discount(opponent["cards"], card, unseen, remaining)
            if cost <= _acceptable_cost(opponent_chips, remaining, len(players)) + 3:
                safe_lap = False
                break
    return {"type": "pass" if safe_lap else "take"}
