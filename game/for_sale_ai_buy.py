"""Auction planning using public transactions and a caller-owned random source.

The input is a public view, never the authoritative game state. Opponents' cash
and properties are reconstructed from their publicly settled transactions.
"""

import math
import random
from functools import lru_cache
from typing import Dict, List, Tuple


_CHECKS = (0, 0, *[value for value in range(2, 16) for _ in range(2)])
_SAMPLES = 48


@lru_cache(maxsize=4)
def _check_order_values(count: int) -> Tuple[float, ...]:
    """Exact expected cheque at each rank in a random market of this size."""
    denominator = math.comb(len(_CHECKS), count)
    result = []
    for rank in range(1, count + 1):
        expectation = 0.0
        for value in range(15):
            below = sum(check <= value for check in _CHECKS)
            above = len(_CHECKS) - below
            # E[X] = sum(P(X > value)); the rank-th card exceeds value when
            # fewer than rank of the sampled cards are at most value.
            for taken in range(rank):
                if taken <= below and 0 <= count - taken <= above:
                    expectation += math.comb(below, taken) * math.comb(above, count - taken) / denominator
        result.append(expectation)
    return tuple(result)


def _public_accounts(view: Dict) -> Tuple[Dict[str, int], Dict[str, List[int]]]:
    order = [player["player_id"] for player in view["players"]]
    starting_cash = 18 if len(order) <= 4 else 14
    cash = {pid: starting_cash for pid in order}
    properties = {pid: [] for pid in order}
    for summary in view.get("history", []):
        for row in summary.get("rows", []):
            pid = row.get("player_id")
            if pid not in cash:
                continue
            if summary.get("stage") == "buy":
                cash[pid] -= row.get("paid", 0)
                properties[pid].append(row["property"])
            elif summary.get("stage") == "sell" and row.get("property") in properties[pid]:
                properties[pid].remove(row["property"])
    for row in view.get("auction_results", []):
        pid = row.get("player_id")
        if pid in cash:
            cash[pid] -= row.get("paid", 0)
            properties[pid].append(row["property"])
    # Only this player's own balance and cards may override public accounting.
    own = view["you"]
    cash[own] = view["your_cash"] + view["your_bid"]
    properties[own] = list(view["your_properties"])
    return {pid: max(0, amount) for pid, amount in cash.items()}, properties


def _property_values(view: Dict, holdings: Dict[str, List[int]]) -> Dict[str, Dict[int, float]]:
    order_values = _check_order_values(len(holdings))
    known = {card for cards in holdings.values() for card in cards}
    rounds = view["rounds_per_stage"]
    values = {}
    for actor in holdings:
        values[actor] = {}
        for card in view["market_properties"]:
            unseen = [value for value in range(1, 31) if value not in known and value != card]
            unknown_lower = sum(value < card for value in unseen) / len(unseen) if unseen else 0.5
            ranks = [1.0]
            for opponent, cards in holdings.items():
                if opponent == actor:
                    continue
                missing = max(0, rounds - len(cards))
                probability = (sum(value < card for value in cards) + missing * unknown_lower) / rounds
                probability = min(1.0, max(0.0, probability))
                next_ranks = [0.0] * (len(ranks) + 1)
                for rank, weight in enumerate(ranks):
                    next_ranks[rank] += weight * (1 - probability)
                    next_ranks[rank + 1] += weight * probability
                ranks = next_ranks
            values[actor][card] = sum(weight * order_values[rank] for rank, weight in enumerate(ranks))
    return values


def _money_value(cash: int, future_rounds: int) -> float:
    """Cash scores one-for-one, with a diminishing option value before auctions."""
    if not future_rounds:
        return float(cash)
    return cash + 1.2 * future_rounds * math.log1p(cash / future_rounds)


def _bid_limit(cash: int, existing_bid: int, gain: float, future_rounds: int) -> int:
    # Exiting loses ceil(existing_bid / 2). Winning for b therefore costs
    # b - ceil(existing_bid / 2) more than exiting, before future cash value.
    exit_cash = cash - (existing_bid + 1) // 2
    exit_value = _money_value(exit_cash, future_rounds)
    limit = 0
    for bid in range(1, cash + 1):
        if gain + _money_value(cash - bid, future_rounds) + 1e-9 >= exit_value:
            limit = bid
        else:
            break
    return limit


def _opponent_limits(view: Dict, cash: Dict[str, int], stakes: Dict[str, int],
                     values: Dict[str, Dict[int, float]], rng: random.Random) -> Dict[str, int]:
    market = view["market_properties"]
    remaining = view["rounds_per_stage"] - view["stage_round"] + 1
    order_values = _check_order_values(len(view["players"]))
    ordinary_spread = max(1.0, order_values[-1] - order_values[0])
    limits = {}
    for pid in view["active_players"]:
        gain = values[pid][market[-1]] - values[pid][market[0]]
        if pid == view["you"]:
            limits[pid] = _bid_limit(cash[pid], stakes[pid], gain, remaining - 1)
            continue
        # Sample persistent willingness once per auction. Increasing the limit
        # with every simulated raise would create an unrealistic sunk-cost spiral.
        willingness = rng.triangular(0.72, 1.35, 1.0)
        marginal_limit = _bid_limit(cash[pid], stakes[pid], gain * willingness, remaining - 1)
        average_budget = cash[pid] / remaining
        quality = 0.75 + 0.25 * values[pid][market[-1]] / (sum(_CHECKS) / len(_CHECKS))
        allocation = average_budget * (0.45 + 1.15 * gain / ordinary_spread) * quality
        # A public existing commitment raises the plausible budget; money lost
        # on a withdrawal cannot be recovered just by changing plans now.
        planned_limit = math.floor(allocation * willingness + (stakes[pid] + 1) // 2)
        limits[pid] = min(cash[pid], marginal_limit, max(stakes[pid], planned_limit))
    return limits


def _rollout(view: Dict, first_bid: int, cash: Dict[str, int], initial_stakes: Dict[str, int],
             values: Dict[str, Dict[int, float]], limits: Dict[str, int]) -> float:
    order = [player["player_id"] for player in view["players"]]
    active = list(view["active_players"])
    market = list(view["market_properties"])
    stakes = dict(initial_stakes)
    own = view["you"]
    actor = own
    high = view["high_bid"]
    future_rounds = view["rounds_per_stage"] - view["stage_round"]
    awarded = {}
    paid = {}
    first = True
    while len(active) > 1:
        if first:
            bid = first_bid
            first = False
        else:
            gain = values[actor][market[-1]] - values[actor][market[0]]
            local_limit = _bid_limit(cash[actor], initial_stakes[actor], gain, future_rounds)
            bid = high + 1 if high + 1 <= min(limits[actor], local_limit) else 0
        if bid:
            stakes[actor] = bid
            high = bid
        else:
            awarded[actor] = market.pop(0)
            paid[actor] = (stakes[actor] + 1) // 2
            active.remove(actor)
        if len(active) == 1:
            winner = active[0]
            awarded[winner] = market.pop()
            paid[winner] = stakes[winner]
            break
        index = order.index(actor)
        actor = next(order[(index + offset) % len(order)] for offset in range(1, len(order) + 1)
                     if order[(index + offset) % len(order)] in active)
    return values[own][awarded[own]] + _money_value(cash[own] - paid[own], future_rounds)


def choose_bid(view: Dict, rng: random.Random) -> Dict:
    """Choose pass, a minimal raise, or a useful preemptive raise from a view."""
    action = {"type": "pass", "round": view["round"], "turn": view["turn"]}
    if "bid" not in view["legal_actions"]:
        return action
    cash, holdings = _public_accounts(view)
    stakes = {player["player_id"]: player["bid"] for player in view["players"]}
    values = _property_values(view, holdings)
    market = view["market_properties"]
    own = view["you"]
    future_rounds = view["rounds_per_stage"] - view["stage_round"]
    gain = values[own][market[-1]] - values[own][market[0]]
    ceiling = _bid_limit(cash[own], stakes[own], gain, future_rounds)
    minimum = view["min_bid"]
    if minimum > ceiling:
        return action
    # Higher opening bids can discourage rivals before they accumulate deposits.
    # Only compare a few meaningful prices, all within the marginal value limit.
    prices = sorted({minimum, min(minimum + 1, ceiling), (minimum + ceiling) // 2, ceiling})
    candidates = [0] + prices
    scores = {price: 0.0 for price in candidates}
    for _ in range(_SAMPLES):
        limits = _opponent_limits(view, cash, stakes, values, rng)
        for price in candidates:
            scores[price] += _rollout(view, price, cash, stakes, values, limits)
    best = 0
    for price in prices:
        # Equal values prefer passing, then the cheaper bid.
        if scores[price] > scores[best] + 1e-7:
            best = price
    if best:
        action.update(type="bid", amount=best)
    return action
