"""Information-fair policy for Poison.

The Poison bot only needs the same private information a player has: its own
hand plus the public cauldrons.  Keeping the policy on the public view makes it
safe to call from room automation and prevents future changes to the full game
state from accidentally exposing opponents' hands to the bot.
"""

from collections import Counter
from typing import Dict, List, Optional, Tuple


CAULDRON_LIMIT = 13
POTION_COLORS = ("red", "blue", "purple")
POTION_COPIES_PER_COLOR = 14


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


def _captured_by_color(view: Dict) -> Counter:
    """Return the bot's own captured-card counts when available.

    The normal public view deliberately hides captured card identities.  The
    server supplies ``_your_captured`` only to the bot's policy, so this data
    never crosses the Socket.IO boundary.  Keeping the fallback empty makes
    the policy compatible with callers that only have a public view.
    """

    cards = view.get("_your_captured", view.get("your_captured", []))
    return Counter(
        card.get("color")
        for card in cards
        if isinstance(card, dict) and card.get("kind") == "potion"
        and card.get("color") in POTION_COLORS
    )


def _player_count(view: Dict) -> int:
    players = view.get("players", [])
    count = len(players) if isinstance(players, list) else 0
    return max(3, min(6, count or 3))


def _immunity_confidence(count: int, player_count: int) -> float:
    """Estimate how likely this count is to be a unique majority.

    Opponent captures are hidden by the rules, so this is intentionally a
    conservative estimate.  It only discounts a color once the bot has at
    least two cards, and becomes strong at four cards where a unique majority
    is common in a three-to-four-player game.
    """

    if count <= 1:
        return 0.0
    if count == 2:
        return 0.18 if player_count <= 4 else 0.10
    if count == 3:
        return 0.48 if player_count <= 4 else 0.32
    if count == 4:
        return 0.78 if player_count <= 4 else 0.58
    return 0.90 if player_count <= 4 else 0.76


def _estimated_round_score(counts: Counter, player_count: int) -> float:
    """Estimate penalty for a captured pile, including majority immunity."""

    score = 2 * int(counts.get("poison", 0))
    for color in POTION_COLORS:
        count = int(counts.get(color, 0))
        score += count * (1.0 - _immunity_confidence(count, player_count))
    return score


def _captured_delta(cauldron_cards: List[Dict], view: Dict) -> float:
    """Estimate the round-score change if this cauldron is captured."""

    before = _captured_by_color(view)
    after = Counter(before)
    for card in cauldron_cards:
        if card.get("kind") == "poison":
            after["poison"] += 1
        elif card.get("color") in POTION_COLORS:
            after[card["color"]] += 1
    return _estimated_round_score(after, _player_count(view)) - _estimated_round_score(
        before, _player_count(view)
    )


def _candidate_score(card: Dict, cauldron: Dict, outcome: Dict,
                     hand: Dict[str, Dict], view: Dict) -> Tuple:
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
        poison_count = sum(1 for item in cauldron_cards if item.get("kind") == "poison")
        # Prefer the least costly overflow when every legal placement is
        # forced to capture.  The estimate discounts potion cards when they
        # would give the bot a likely unique majority, while poison cards
        # always remain worth two points and are never immune.
        return (
            1,
            _captured_delta(cauldron_cards, view),
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

    # Push a safe cauldron toward 13.  This puts the next player under
    # pressure and is especially valuable for a poison card: a poison at 13
    # leaves no legal non-overflowing move for the next player.  The pressure
    # check still comes first so a color with several large cards in hand is
    # not locked into an unavoidable self-overflow.
    slack = max(0, CAULDRON_LIMIT - new_total)
    poison_pressure = 0 if card.get("kind") == "poison" else 0
    return (
        0,
        pressure,
        poison_pressure,
        slack,
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
            score = _candidate_score(card, cauldron, outcome, hand, view)
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

