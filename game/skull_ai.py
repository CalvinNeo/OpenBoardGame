"""Deterministic decision policy for :mod:`game.skull`.

The policy only consumes the filtered player view.  It uses the card counts,
hand composition, and public piles to estimate how many roses are available,
then chooses a conservative bid.  It never uses the module-level random
source, which keeps bot turns reproducible after reconnects and in tests.
"""

from typing import Dict, List, Optional, Tuple


CARD_ROSE = "rose"
CARD_SKULL = "skull"


def _me(view: Dict) -> Optional[Dict]:
    return next((player for player in view.get("players", [])
                 if player.get("player_id") == view.get("you")), None)


def _your_pile(view: Dict) -> List[str]:
    """Return the bot's own pile when the private adapter supplies it.

    The normal browser view intentionally hides every pile.  ``SkullGame`` may
    add ``_your_pile`` for its in-process bot, because the bot already knows
    which cards it played.  Supporting both names keeps this policy compatible
    with saved rooms and lightweight tests.
    """
    pile = view.get("_your_pile", view.get("your_pile", view.get("own_pile", [])))
    return list(pile) if isinstance(pile, (list, tuple)) else []


def _players_with_piles(view: Dict, exclude: Optional[str] = None) -> List[Dict]:
    return [player for player in view.get("players", [])
            if not player.get("eliminated")
            and player.get("player_id") != exclude
            and int(player.get("pile_count", 0)) > 0]


def _expected_roses(view: Dict) -> float:
    """Estimate roses in the played piles from public counts.

    A player's skull is equally likely to be in any of their remaining cards
    when its location is unknown.  For our own hand we know whether the skull
    is still available, so the estimate is exact for our pile whenever the
    skull remains in hand.
    """
    own = _me(view)
    expected = 0.0
    for player in view.get("players", []):
        pile = max(0, int(player.get("pile_count", 0)))
        if not pile:
            continue
        hand = max(0, int(player.get("hand_count", 0)))
        if own and player.get("player_id") == own.get("player_id"):
            hand_cards = list(view.get("hand") or [])
            known_pile = _your_pile(view)
            if known_pile:
                expected += sum(card == CARD_ROSE for card in known_pile)
            elif CARD_SKULL in hand_cards:
                expected += float(pile)  # our skull is still in hand
            else:
                # If the skull is absent from our hand, it is either in the
                # pile or was already removed.  Keep a mild uncertainty for
                # games restored from an older save.
                expected += max(0.0, pile - 1.0)
            continue
        total = pile + hand
        skull_probability = 1.0 / total if total else 0.25
        expected += pile * (1.0 - skull_probability)
    return expected


def _safe_bid(view: Dict, maximum: int) -> int:
    """Return a modest integer bid, always within the legal range."""
    if maximum <= 0:
        return 1
    estimate = _expected_roses(view)
    own = _me(view)
    hand = list(view.get("hand") or [])
    # The bidder must reveal its own pile first.  If our skull is already in
    # that pile, the number of roses above it is a hard upper bound: a larger
    # bid will eventually hit the skull.  A skull kept in hand is safe for
    # this round, so it is a small positive signal instead.
    own_pile = _your_pile(view)
    if own_pile and CARD_SKULL in own_pile:
        safe_prefix = 0
        for card in reversed(own_pile):
            if card != CARD_ROSE:
                break
            safe_prefix += 1
        estimate = min(estimate, float(safe_prefix))
    elif own and CARD_SKULL in hand:
        estimate += 0.35
    # Round down to avoid claiming an uncertain top card.  A minimum bid is
    # required by the rules whenever a pile exists.
    return max(1, min(maximum, int(estimate + 0.15)))


def _bidder_estimate(view: Dict, total: int) -> float:
    estimate = _expected_roses(view)
    current = int(view.get("current_bid") or 0)
    own = _me(view)
    hand = list(view.get("hand") or [])
    own_pile = _your_pile(view)
    if own_pile and CARD_SKULL in own_pile:
        safe_prefix = 0
        for card in reversed(own_pile):
            if card != CARD_ROSE:
                break
            safe_prefix += 1
        estimate = min(estimate, float(safe_prefix))
    elif own and CARD_SKULL in hand:
        estimate += 0.25
    # A high bid becomes harder to complete because every additional reveal is
    # another chance of encountering a skull.
    estimate -= max(0, current - 1) * 0.08
    return max(0.0, min(float(total), estimate))


def _choose_reveal_target(view: Dict) -> Optional[str]:
    own_id = view.get("you")
    candidates = _players_with_piles(view, own_id)
    if not candidates:
        return None
    # With only public counts available, the chance that an opponent's one
    # skull is in their pile is approximately pile/(pile + hand).  Prefer the
    # pile with the smallest such risk, then the smallest pile so a successful
    # reveal gives the bidder more control over the next target.  Tie-break by
    # seat and id for stable play across reconnects.
    def key(player: Dict) -> Tuple[float, int, int, str]:
        pile = max(1, int(player.get("pile_count", 0)))
        hand = max(0, int(player.get("hand_count", 0)))
        skull_risk = pile / max(1, pile + hand)
        return (skull_risk, pile, int(player.get("seat", 0)), str(player.get("player_id", "")))
    return min(candidates, key=key).get("player_id")


def choose_action(view: Dict) -> Optional[Dict]:
    """Choose one legal Skull action from a player's filtered view."""
    legal = list(view.get("legal_actions") or [])
    if not legal or view.get("game_over"):
        return None
    own = _me(view)
    if own is None:
        return None

    phase = view.get("phase")
    if phase == "playing":
        total = sum(max(0, int(player.get("pile_count", 0)))
                     for player in view.get("players", []))
        if "start_bid" in legal and total:
            # Do not start a bid while our own skull is exposed on top of the
            # pile if a rose can still bury it.  This is the key Skull bluff:
            # play the skull first, then cover it with roses before bidding.
            own_pile = _your_pile(view)
            hand = list(view.get("hand") or [])
            if ("play_card" in legal and own_pile
                    and own_pile[-1] == CARD_SKULL and CARD_ROSE in hand):
                return {"type": "play_card", "card_type": CARD_ROSE}
            return {"type": "start_bid", "bid": _safe_bid(view, total)}
        if "play_card" in legal:
            hand = list(view.get("hand") or [])
            if not hand:
                return None
            # Put a skull down before the roses so later roses bury it.  Once
            # a pile exists, keep its top card safe whenever possible; bidding
            # is only attractive after that top-card risk is covered.
            own_pile = _your_pile(view)
            if not own_pile and CARD_SKULL in hand:
                card = CARD_SKULL
            elif CARD_ROSE in hand:
                card = CARD_ROSE
            else:
                card = CARD_SKULL
            return {"type": "play_card", "card_type": card}
        return None

    if phase == "bidding":
        total = sum(max(0, int(player.get("pile_count", 0)))
                     for player in view.get("players", []))
        current = int(view.get("current_bid") or 0)
        estimate = _bidder_estimate(view, total)
        if "raise_bid" in legal and current < total and estimate > current + 0.35:
            # Raise by a single step: this pressures opponents without making
            # an all-in claim based on uncertain hidden cards.
            return {"type": "raise_bid", "bid": min(total, current + 1)}
        if "pass_bid" in legal:
            return {"type": "pass_bid"}
        if "raise_bid" in legal:
            return {"type": "raise_bid", "bid": min(total, current + 1)}
        return None

    if phase == "reveal" and "reveal_card" in legal:
        own_pile = _your_pile(view)
        own_pile_count = len(own_pile) if own_pile else int(own.get("pile_count", 0))
        target = view.get("you") if own_pile_count else _choose_reveal_target(view)
        return {"type": "reveal_card", "target_player_id": target} if target else None

    return None
