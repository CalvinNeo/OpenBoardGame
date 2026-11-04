"""Information-fair policy for Poison.

The Poison bot only needs the same private information a player has: its own
hand and captured pile plus the public cauldrons.  Keeping the policy on a
server-built view makes it safe to call from room automation and prevents
future changes to the full game state from exposing opponents' hands.
"""

from collections import Counter
from math import comb
from typing import Dict, List, Optional, Tuple


CAULDRON_LIMIT = 13
POTION_COLORS = ("red", "blue", "purple")
POTION_VALUE_COUNTS = {1: 3, 2: 3, 4: 2, 5: 3, 7: 3}
POISON_COUNT = 8


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
        return 0.10 if player_count <= 4 else 0.05
    if count == 3:
        return 0.32 if player_count <= 4 else 0.20
    if count == 4:
        return 0.58 if player_count <= 4 else 0.42
    return 0.74 if player_count <= 4 else 0.60


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


def _card_key(card: Dict) -> Tuple[str, str, int]:
    return (
        str(card.get("kind", "")),
        str(card.get("color", "")),
        int(card.get("value", 0)),
    )


def _card_catalog() -> Counter:
    catalog: Counter = Counter()
    for color in POTION_COLORS:
        for value, count in POTION_VALUE_COUNTS.items():
            catalog[("potion", color, value)] = count
    catalog[("poison", "poison", 4)] = POISON_COUNT
    return catalog


def _next_player_hand_count(view: Dict) -> int:
    """Return the next public hand size, skipping players with no cards."""

    players = view.get("players", [])
    if not isinstance(players, list) or not players:
        return 0
    current_id = view.get("current_turn")
    current_index = next(
        (index for index, player in enumerate(players)
         if isinstance(player, dict) and player.get("player_id") == current_id),
        -1,
    )
    for offset in range(1, len(players) + 1):
        player = players[(current_index + offset) % len(players)]
        if not isinstance(player, dict):
            continue
        hand_count = int(player.get("hand_count", 0) or 0)
        if hand_count > 0:
            return hand_count
    return 0


def _known_card_counts(view: Dict) -> Counter:
    known: Counter = Counter()
    cards: List[Dict] = []
    cards.extend(view.get("your_hand", []))
    cards.extend(view.get("_your_captured", []))
    for cauldron in view.get("cauldrons", []):
        if isinstance(cauldron, dict):
            cards.extend(cauldron.get("cards", []))
    for card in cards:
        if isinstance(card, dict):
            known[_card_key(card)] += 1
    return known


def _card_can_play_safely(card: Tuple[str, str, int], cauldrons: List[Dict]) -> bool:
    kind, color, value = card
    for cauldron in cauldrons:
        total = int(cauldron.get("total", 0) or 0)
        derived_color = cauldron.get("derived_color")
        if kind == "poison" or derived_color in (None, color):
            if total + value <= CAULDRON_LIMIT:
                return True
    return False


def _next_player_forced_probability(view: Dict, cauldrons: List[Dict]) -> float:
    """Estimate the chance the next hand has no safe card.

    Opponent cards stay hidden.  Treating the unknown catalog as a random pool
    gives the bot a useful one-ply pressure signal without reading private
    state.  Known own cards, captured cards, and cards in the public cauldrons
    are removed from that pool.
    """

    hand_count = _next_player_hand_count(view)
    if hand_count <= 0:
        return 0.0
    remaining = _card_catalog()
    for key, count in _known_card_counts(view).items():
        remaining[key] = max(0, int(remaining.get(key, 0)) - count)
    total = sum(remaining.values())
    if total <= 0:
        return 0.0
    unsafe = sum(
        count for key, count in remaining.items()
        if not _card_can_play_safely(key, cauldrons)
    )
    hand_count = min(hand_count, total)
    if unsafe < hand_count:
        return 0.0
    return comb(unsafe, hand_count) / comb(total, hand_count)


def _candidate_score(card: Dict, cauldron: Dict, outcome: Dict,
                     hand: Dict[str, Dict], view: Optional[Dict] = None) -> Tuple:
    """Rank one legal placement from the bot's point of view.

    Capturing cards is always worse than leaving a cauldron intact.  Among
    safe placements, avoid filling a cauldron so far that the bot's remaining
    cards of that colour immediately force an overflow.  The final fields are
    stable tie breakers, so repeated calls on the same view produce the same
    action without touching global randomness.
    """

    view = view or {}
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

    candidate_cauldrons = [
        {
            "total": int(item.get("total", 0) or 0),
            "derived_color": item.get("derived_color"),
        }
        for item in view.get("cauldrons", [])
        if isinstance(item, dict)
    ]
    if 0 <= int(cauldron.get("index", -1)) < len(candidate_cauldrons):
        candidate_index = int(cauldron["index"])
        candidate_cauldrons[candidate_index] = {
            "total": new_total,
            "derived_color": derived_color,
        }
    next_player_pressure = _next_player_forced_probability(view, candidate_cauldrons)

    # Push a safe cauldron toward 13.  This puts the next player under
    # pressure and is especially valuable for a poison card: a poison at 13
    # leaves no legal non-overflowing move for the next player.  The pressure
    # check still comes first so a color with several large cards in hand is
    # not locked into an unavoidable self-overflow.
    slack = max(0, CAULDRON_LIMIT - new_total)
    return (
        0,
        pressure,
        -next_player_pressure,
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

