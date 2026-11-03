"""Information-fair policy for Poison.

The Poison bot only needs the same private information a player has: its own
hand plus the public cauldrons.  Keeping the policy on the public view makes it
safe to call from room automation and prevents future changes to the full game
state from accidentally exposing opponents' hands to the bot.
"""

from typing import Dict, List, Optional, Tuple


CAULDRON_LIMIT = 13


def _card_penalty(card: Dict) -> int:
    """Return the score penalty for a captured card."""

    return 2 if card.get("kind") == "poison" else 1


def _player_hand(view: Dict) -> Dict[str, Dict]:
    return {
        card.get("id"): card
        for card in view.get("your_hand", [])
        if isinstance(card, dict) and isinstance(card.get("id"), str)
    }


def _cauldron_by_index(view: Dict) -> Dict[int, Dict]:
    result: Dict[int, Dict] = {}
    for cauldron in view.get("cauldrons", []):
        if not isinstance(cauldron, dict):
            continue
        index = cauldron.get("index")
        if isinstance(index, bool) or not isinstance(index, int):
            continue
        result[index] = cauldron
    return result


def _candidate_score(card: Dict, cauldron: Dict, outcome: Dict,
                     hand: Dict[str, Dict]) -> Tuple:
    """Rank one legal placement from the bot's point of view.

    Capturing cards is always worse than leaving a cauldron intact.  Among
    safe placements, avoid filling a cauldron so far that the bot's remaining
    cards of that colour immediately force an overflow.  The final fields are
    stable tie breakers, so repeated calls on the same view produce the same
    action without touching global randomness.
    """

    cauldron_cards = [card for card in cauldron.get("cards", []) if isinstance(card, dict)]
    new_total = int(outcome.get("new_total", cauldron.get("total", 0)))
    overflow = bool(outcome.get("will_overflow", new_total > CAULDRON_LIMIT))
    card_color = card.get("color")

    if overflow:
        captured_penalty = sum(_card_penalty(item) for item in cauldron_cards)
        poison_count = sum(1 for item in cauldron_cards if item.get("kind") == "poison")
        # Prefer the least costly overflow when every legal placement is
        # forced to capture.  Poison cards are worth two points and therefore
        # receive a separate tie breaker after the total penalty.
        return (
            1,
            captured_penalty,
            poison_count,
            len(cauldron_cards),
            new_total,
            str(card.get("id", "")),
            int(cauldron.get("index", 0)),
        )

    # A coloured potion locks the cauldron to its colour.  Estimate pressure
    # from the bot's remaining cards of that colour: a placement is safer when
    # those cards can still be played without immediately overflowing.
    derived_color = cauldron.get("derived_color") or (
        card_color if card.get("kind") == "potion" else None
    )
    pressure = 0
    if derived_color:
        for remaining in hand.values():
            if remaining.get("id") == card.get("id"):
                continue
            if remaining.get("kind") == "potion" and remaining.get("color") == derived_color:
                pressure += max(0, new_total + int(remaining.get("value", 0)) - CAULDRON_LIMIT)

    # Low totals leave room for later cards.  Preserve a higher-valued card
    # when all other considerations are equal, since it is more likely to be
    # useful for a deliberate overflow later in the round.
    return (
        0,
        pressure,
        new_total,
        -int(card.get("value", 0)),
        str(card.get("id", "")),
        int(cauldron.get("index", 0)),
    )


def choose_action(view: Dict) -> Optional[Dict]:
    """Choose a legal Poison action using only a player's public view."""

    legal_actions = view.get("legal_actions", [])
    if "next_round" in legal_actions:
        return {"type": "next_round"}
    if "play_again" in legal_actions:
        return {"type": "play_again"}
    if "play_card" not in legal_actions:
        return None

    hand = _player_hand(view)
    cauldrons = _cauldron_by_index(view)
    candidates: List[Tuple[Tuple, Dict]] = []
    for play in view.get("legal_plays", []):
        if not isinstance(play, dict):
            continue
        card_id = play.get("card_id")
        card = hand.get(card_id)
        if card is None:
            continue
        outcomes = play.get("outcomes", {})
        for raw_index in play.get("cauldron_indices", []):
            if isinstance(raw_index, bool) or not isinstance(raw_index, int):
                continue
            cauldron = cauldrons.get(raw_index, {"index": raw_index, "cards": [], "total": 0})
            outcome = outcomes.get(str(raw_index), {}) if isinstance(outcomes, dict) else {}
            score = _candidate_score(card, cauldron, outcome, hand)
            candidates.append(
                (
                    score,
                    {
                        "type": "play_card",
                        "card_id": card_id,
                        "cauldron_index": raw_index,
                    },
                )
            )
    if not candidates:
        return None
    return min(candidates, key=lambda candidate: candidate[0])[1]

