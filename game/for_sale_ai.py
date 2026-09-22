"""For Sale decisions from a player's public view, with no access to live state.

Public purchases and revealed sales are a perfect-memory notebook. Opponents'
simultaneous selections and the deck order are never inputs to the policy.
"""

import hashlib
import json
import math
import random
from collections import Counter
from functools import lru_cache
from typing import Dict, List, Optional


CHECK_VALUES = tuple(value for value in (0, *range(2, 16)) for _ in range(2))
SALE_SAMPLES = 64


def _random_source(view: Dict) -> random.Random:
    # A local stable seed makes reconnects, tests and repeated calls consistent.
    data = {key: view.get(key) for key in (
        "you", "stage", "round", "turn", "your_cash", "your_bid", "your_properties",
        "market_properties", "market_checks", "history", "auction_results", "high_bid",
    )}
    digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


@lru_cache(maxsize=256)
def _check_expectations(pool: tuple, count: int) -> tuple:
    """Exact expectations of sorted checks sampled without replacement."""
    size = len(pool)
    if size < count:
        return _check_expectations(CHECK_VALUES, count)
    denominator = math.comb(size, count)
    values = [0.0] * count
    for threshold in range(1, 16):
        below = sum(value < threshold for value in pool)
        probability = 0.0
        for rank in range(count):
            if rank <= below and 0 <= count - rank <= size - below:
                probability += (math.comb(below, rank) * math.comb(size - below, count - rank)
                                / denominator)
            values[rank] += probability
    return tuple(values)


def _return_for(card: int, owner: str, hands: Dict, checks: List,
                policies: Optional[Dict] = None) -> float:
    ranks = [1.0]
    for pid, hand in hands.items():
        if pid == owner:
            continue
        weights = policies[pid] if policies else [1.0 / len(hand)] * len(hand)
        lower = sum(weight for other, weight in zip(hand, weights) if other < card)
        next_ranks = [0.0] * (len(ranks) + 1)
        for rank, chance in enumerate(ranks):
            next_ranks[rank] += chance * (1 - lower)
            next_ranks[rank + 1] += chance * lower
        ranks = next_ranks
    return sum(chance * value for chance, value in zip(ranks, checks))


def _public_knowledge(view: Dict, rng: random.Random) -> tuple:
    ids = [player["player_id"] for player in view["players"]]
    hands = {pid: [] for pid in ids}
    wealth = {pid: 18 if len(ids) < 5 else 14 for pid in ids}
    used = set()
    pool = list(CHECK_VALUES)
    styles = {pid: [0.4, 0.15, 0.15] for pid in ids}
    for result in view.get("history", []):
        rows = result.get("rows", [])
        if result.get("stage") == "buy":
            for row in rows:
                pid, card = row["player_id"], row["property"]
                if pid in hands:
                    hands[pid].append(card)
                    wealth[pid] -= row["paid"]
                    used.add(card)
        elif result.get("stage") == "sell":
            checks = sorted(row["check"] for row in rows)
            quality = (checks[-1] + checks[-1] - checks[0]) / 30 if checks[-1] != checks[0] else 0
            for row in rows:
                pid, card = row["player_id"], row["property"]
                if pid not in hands:
                    continue
                hand = sorted(hands[pid])
                if card in hand:
                    index = hand.index(card)
                    targets = [round(quality * (len(hand) - 1)), len(hand) - 1, 0]
                    # Learn broad habits from already revealed choices, with smoothing.
                    for style, target in enumerate(targets):
                        styles[pid][style] += math.exp(-1.7 * abs(index - target))
                    hands[pid].remove(card)
                used.add(card)
                wealth[pid] += row["check"]
                if row["check"] in pool:
                    pool.remove(row["check"])
    hands[view["you"]] = sorted(view["your_properties"])
    used.update(view["your_properties"])
    # Old saves can lack a notebook. Sample only publicly possible cards in that case.
    unseen = [card for card in range(1, 31) if card not in used]
    rng.shuffle(unseen)
    for player in view["players"]:
        pid = player["player_id"]
        missing = max(0, player["property_count"] - len(hands[pid]))
        hands[pid].extend(unseen.pop() for _ in range(min(missing, len(unseen))))
        hands[pid].sort()
    for check in view["market_checks"]:
        if check in pool:
            pool.remove(check)
    wealth[view["you"]] = view["your_cash"] + sum(view["your_checks"])
    return hands, wealth, tuple(sorted(pool)), styles


def _softmax(scores: List[float], temperature: float = 0.7) -> List[float]:
    best = max(scores)
    weights = [math.exp((score - best) / temperature) for score in scores]
    total = sum(weights)
    return [weight / total for weight in weights]


def _sale_policies(hands: Dict, checks: List[int], future: tuple, styles: Dict) -> Dict:
    policies = {pid: [1.0 / len(hand)] * len(hand) for pid, hand in hands.items()}
    costs = {pid: [_return_for(card, pid, hands, future) for card in hand]
             for pid, hand in hands.items()}
    quality = (checks[-1] + checks[-1] - checks[0]) / 30 if checks[-1] != checks[0] else 0
    for _ in range(7):
        updated = {}
        for pid, hand in hands.items():
            scores = [_return_for(card, pid, hands, checks, policies) - cost
                      for card, cost in zip(hand, costs[pid])]
            rational = _softmax(scores)
            target_indices = [round(quality * (len(hand) - 1)), len(hand) - 1, 0]
            total_evidence = sum(styles[pid])
            predictions = [_softmax([-1.5 * abs(index - target) for index in range(len(hand))])
                           for target in target_indices]
            mixture = [sum(weight * prediction[index] for weight, prediction in zip(styles[pid], predictions))
                       / total_evidence for index in range(len(hand))]
            updated[pid] = [0.4 * old + 0.6 * (0.7 * optimal + 0.3 * habit)
                            for old, optimal, habit in zip(policies[pid], rational, mixture)]
        policies = updated
    return policies


def _choose_sale(view: Dict, rng: random.Random) -> int:
    own = sorted(view["your_properties"])
    checks = sorted(view["market_checks"])
    if len(own) == 1 or checks[0] == checks[-1]:
        return own[0]
    hands, wealth, pool, styles = _public_knowledge(view, rng)
    if any(not hand for hand in hands.values()):
        return own[round((checks[-1] - checks[0]) / 15 * (len(own) - 1))]
    you = view["you"]
    future = _check_expectations(pool, len(hands))
    policies = _sale_policies(hands, checks, future, styles)
    opponents = [pid for pid in hands if pid != you]
    # Reuse identical opponent draws for every candidate. Our secret choice cannot
    # influence an opponent's simulated simultaneous submission.
    samples = Counter(tuple(rng.choices(hands[pid], policies[pid])[0] for pid in opponents)
                      for _ in range(SALE_SAMPLES))
    candidates, signatures = [], set()
    for card in own:
        signature = tuple(card > other for pid in opponents for other in hands[pid])
        if signature not in signatures:
            signatures.add(signature)
            candidates.append(card)
    scores = {card: 0.0 for card in candidates}
    for choices, frequency in samples.items():
        picked = dict(zip(opponents, choices))
        for card in candidates:
            selections = {**picked, you: card}
            ranked = sorted(hands, key=selections.get)
            income = dict(zip(ranked, checks))
            remaining = {pid: [value for value in hand if value != selections[pid]]
                         for pid, hand in hands.items()}
            projected = {}
            for pid, hand in remaining.items():
                continuation = sum(_return_for(value, pid, remaining, future) for value in hand)
                projected[pid] = wealth[pid] + income[pid] + continuation
            lead = projected[you] - max(projected[pid] for pid in opponents)
            # Expected wealth dominates; late in the game also contest the leader.
            pressure = 0.35 if len(own) <= 3 else 0.15
            scores[card] += frequency * (projected[you] + pressure * lead)
    return max(candidates, key=lambda card: (scores[card], -card))


def choose_action(view: Dict) -> Optional[Dict]:
    """Choose a legal move without mutating the view or global random state."""
    legal = view["legal_actions"]
    if "next_round" in legal:
        return {"type": "next_round", "round": view["round"]}
    rng = _random_source(view)
    if "sell" in legal:
        return {"type": "sell", "round": view["round"], "property": _choose_sale(view, rng)}
    if "pass" in legal:
        from game.for_sale_ai_buy import choose_bid

        return choose_bid(view, rng)
    return None
