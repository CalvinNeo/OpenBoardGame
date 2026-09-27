"""Ranking decisions made from one player's visible cards only."""

import random
from functools import lru_cache
from typing import Dict, List, Tuple

from game.the_gang import RANKS, SUITS, _best_hand


Card = Tuple[int, str]
BOT_RANK_SAMPLES = 256


def _visible_cards(cards: List[Dict]) -> Tuple[Card, ...]:
    return tuple(sorted(
        (card["rank"], card["suit"])
        for card in cards
        if not card.get("hidden") and "rank" in card and "suit" in card
    ))


def _starting_hand_score(cards: List[Dict]) -> float:
    """A preflop prior: pairs, high cards, suitedness and connected ranks.

    Compare starting-hand quality rather than random future made hands, which
    would pull even very weak starting hands toward the middle of the ranking.
    Later streets always use the actual poker evaluator, including kickers.
    """
    high, low = sorted((card["rank"] for card in cards), reverse=True)
    if high == low:
        return 30 + 2 * high
    gap = high - low - 1
    score = 2 * high + low - min(gap, 4)
    score += 3 if cards[0]["suit"] == cards[1]["suit"] else 0
    score += 2 if high == 14 else 0
    score += 2 if gap == 0 and high <= 10 else 0
    return score


@lru_cache(maxsize=1024)
def _rank_losses(
    hole: Tuple[Card, ...],
    community: Tuple[Card, ...],
    opponents: Tuple[Tuple[Card, ...], ...],
) -> Tuple[float, ...]:
    """Expected placement error; tied hands can occupy any of their slots.

    Before the flop, compare the quality of sampled starting hands.
    On later streets, compare the hands the visible board currently makes.
    Never sample from the actual deck or read another player's private hand.
    """
    known = set(hole + community)
    for cards in opponents:
        known.update(cards)
    unseen = [(rank, suit) for suit in SUITS for rank in RANKS if (rank, suit) not in known]
    cards_by_id = {card: {"rank": card[0], "suit": card[1]} for card in known.union(unseen)}
    draw_count = sum(2 - len(cards) for cards in opponents)
    rng = random.Random(repr((hole, community, opponents)))
    sample_count = BOT_RANK_SAMPLES if draw_count else 1
    losses = [0.0] * (len(opponents) + 1)
    board = [cards_by_id[card] for card in community]
    own_cards = [cards_by_id[card] for card in hole]
    known_hands = [[cards_by_id[card] for card in cards] for cards in opponents]
    own_score = _best_hand(own_cards + board)[0] if board else _starting_hand_score(own_cards)

    for _ in range(sample_count):
        drawn = [cards_by_id[card] for card in rng.sample(unseen, draw_count)]
        offset = 0
        stronger, tied = 0, 0
        for known_hand in known_hands:
            missing = 2 - len(known_hand)
            hand = known_hand + drawn[offset:offset + missing]
            offset += missing
            other_score = _best_hand(hand + board)[0] if board else _starting_hand_score(hand)
            stronger += other_score > own_score
            tied += other_score == own_score
        for index in range(len(losses)):
            distance = max(stronger - index, index - stronger - tied, 0)
            losses[index] += distance * distance
    return tuple(loss / sample_count for loss in losses)


def choose_bot_rank(view: Dict) -> int:
    """Choose a rank using the same information the bot's client could see."""
    bot_id = view["you"]
    current_index = view["ranking"].index(bot_id)
    players = view.get("players", [])
    own = next((player for player in players if player["player_id"] == bot_id), None)
    if not own:
        return current_index
    hole = _visible_cards(own.get("hand", []))
    if len(hole) != 2:
        return current_index
    community = _visible_cards(view.get("community_cards", []))
    opponents = tuple(sorted(
        _visible_cards(player.get("hand", [])) for player in players if player["player_id"] != bot_id
    ))
    losses = _rank_losses(hole, community, opponents)
    best_index = min(range(len(losses)), key=lambda index: (losses[index], abs(index - current_index)))
    # Avoid moving the crew for sampling noise or an equally good tied position.
    return current_index if losses[current_index] <= losses[best_index] + 0.05 else best_index
