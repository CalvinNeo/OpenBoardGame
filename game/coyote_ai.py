from collections import Counter
from functools import lru_cache
from math import exp
from typing import Dict, Optional, Tuple

from game.coyote import NUMBER_CARD_COUNTS, SPECIAL_CARD_COUNTS, _evaluate_total


CARD_COUNTS = {str(value): count for value, count in NUMBER_CARD_COUNTS.items()}
CARD_COUNTS.update({"Max->0": SPECIAL_CARD_COUNTS["max_zero"],
                    "?": SPECIAL_CARD_COUNTS["mystery"],
                    "x2": SPECIAL_CARD_COUNTS["double"]})


def _card(label: str) -> Dict:
    special = {"Max->0": "max_zero", "?": "mystery", "x2": "double"}
    return {"type": special[label]} if label in special else {"type": "number", "value": int(label)}


def _remaining(visible: Tuple[str, ...]) -> Counter:
    remaining = Counter(CARD_COUNTS)
    remaining.subtract(visible)
    return +remaining


def _total(cards: Tuple[str, ...], drawn: Optional[str] = None) -> int:
    players = {str(index): {"card": _card(label), "eliminated": False}
               for index, label in enumerate(cards)}
    return _evaluate_total({"turn_order": list(players), "players": players,
                            "deck": [_card(drawn)] if drawn is not None else []})["total"]


@lru_cache(maxsize=4096)
def total_distribution(visible: Tuple[str, ...]) -> Tuple[Tuple[int, float], ...]:
    remaining = _remaining(visible)
    unseen_count = sum(remaining.values())
    outcomes = Counter()
    for hidden, copies in remaining.items():
        cards = visible + (hidden,)
        if "?" not in cards:
            outcomes[_total(cards)] += copies / unseen_count
            continue
        for drawn, draw_copies in remaining.items():
            available = draw_copies - int(drawn == hidden)
            if available:
                outcomes[_total(cards, drawn)] += copies * available / (unseen_count * (unseen_count - 1))
    return tuple(sorted(outcomes.items()))


def _survival(distribution: Tuple[Tuple[int, float], ...], bid: int) -> float:
    return sum(probability for total, probability in distribution if total >= bid)


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if "next_round" in legal:
        return {"type": "next_round"}
    if "bid" not in legal:
        return None
    players = [player for player in view["players"] if not player["eliminated"]]
    own_index = next(index for index, player in enumerate(players) if player["player_id"] == view["you"])
    own = players[own_index]
    following = players[(own_index + 1) % len(players)]
    visible = tuple(sorted(player["card"] for player in players if player is not own))
    distribution = total_distribution(visible)
    last_bid = view.get("last_bid")
    minimum = last_bid + 1 if last_bid is not None else 1
    limit = view["config"]["max_penalties"]
    own_cost = 1 / (limit - own["penalties"])
    opponent_value = 0.55 / ((len(players) - 1) * (limit - following["penalties"]))
    remaining = _remaining(visible)
    hypotheses = []
    for hidden, copies in remaining.items():
        hypothetical_visible = list(visible)
        hypothetical_visible.remove(following["card"])
        hypothetical_visible.append(hidden)
        opponent_distribution = total_distribution(tuple(sorted(hypothetical_visible)))
        conditional = Counter()
        cards = visible + (hidden,)
        if "?" in cards:
            for drawn, draw_copies in remaining.items():
                available = draw_copies - int(drawn == hidden)
                if available:
                    conditional[_total(cards, drawn)] += available / (sum(remaining.values()) - 1)
        else:
            conditional[_total(cards)] = 1.0
        hypotheses.append((copies / sum(remaining.values()), opponent_distribution, tuple(conditional.items())))

    def bid_value(bid: int) -> float:
        value = 0.0
        for probability, opponent_distribution, conditional in hypotheses:
            opponent_belief = _survival(opponent_distribution, bid)
            call_probability = 0.06 + 0.88 / (1 + exp(12 * (opponent_belief - 0.52)))
            truth = _survival(conditional, bid)
            showdown = truth * opponent_value - (1 - truth) * own_cost
            continuation = -own_cost * (0.08 + 0.12 * (1 - truth))
            value += probability * (call_probability * showdown + (1 - call_probability) * continuation)
        return value

    candidates = {minimum}
    candidates.update(total for total, probability in distribution if total >= minimum)
    best_bid = max(sorted(candidates), key=bid_value)
    if "challenge" in legal:
        bidder = next(player for player in players if player["player_id"] == view["last_bidder"])
        truth = _survival(distribution, last_bid)
        challenge_value = ((1 - truth) * 0.55 / ((len(players) - 1) * (limit - bidder["penalties"]))
                           - truth * own_cost)
        if challenge_value >= bid_value(best_bid):
            return {"type": "challenge"}
    return {"type": "bid", "bid": best_bid}
