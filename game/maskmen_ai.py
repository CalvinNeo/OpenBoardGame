"""Deterministic practice bot. This module receives only a player's public view."""

import math
from typing import Dict, Optional

from game.maskmen import COPIES, MASKS, hand_size, strength_closure


def _at_least(pool: int, copies: int, cards: int, required: int) -> float:
    """Hypergeometric chance a hidden hand contains enough of a given mask."""
    cards = min(cards, pool)
    copies = max(0, min(copies, pool))
    if required > min(copies, cards) or pool <= 0:
        return 0.0
    denominator = math.comb(pool, cards)
    return sum(math.comb(copies, k) * math.comb(pool - copies, cards - k)
               for k in range(required, min(copies, cards) + 1)
               if 0 <= cards - k <= pool - copies) / denominator


def _value(view: Dict, move: Dict) -> float:
    mask, count = move["mask"], move["count"]
    hand = dict(view["your_hand"])
    if count == hand_size(hand):
        return 10000.0
    hand[mask] -= count
    relations = [list(pair) for pair in view["relations"]]
    if move["reason"] == "establish":
        relations.append([mask, view["top"]["mask"]])
    weaker = strength_closure(relations)
    unseen = {m: max(0, COPIES - view["played_counts"][m] - view["your_hand"].get(m, 0)) for m in MASKS}
    pool = sum(unseen.values())
    keep_control = 1.0
    danger = 0.0
    for player in view["players"]:
        if player["player_id"] == view["you"] or player["passed"] or not player["card_count"]:
            continue
        response = 0.0
        finish = 0.0
        for other in MASKS:
            if other == mask or other in weaker[mask]:
                continue
            required = count if mask in weaker[other] else count + 1
            if required > 3:
                continue
            probability = _at_least(pool, unseen[other], player["card_count"], required)
            response += probability
            if required == player["card_count"]:
                finish += probability
        keep_control *= max(0.0, 1.0 - min(1.0, response))
        danger += finish
    groups = sum((n + 2) // 3 for n in hand.values())
    # Prefer shedding weak masks, preserving intact triples, and establishing
    # useful strength for copies still in hand. Never infer secret pass reasons.
    remaining_strength = sum(n * len(weaker[m]) for m, n in hand.items())
    return (count * 3.5 + (1.8 if hand[mask] == 0 else 0.0) - groups * 1.3
            + keep_control * (3.0 + 5.0 / max(1, groups)) + remaining_strength * .16
            - danger * 8.0 - (.8 if hand[mask] == 1 else 0.0))


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if not legal:
        return None
    context = {key: view[key] for key in ("game_token", "season", "bout", "turn_number")}
    for review in ("next_round", "next_season"):
        if review in legal:
            return {"type": review, **context}
    options = view.get("legal_plays", [])
    if not options:
        return {"type": "pass", **context} if "pass" in legal else None
    move = max(options, key=lambda option: (_value(view, option), option["count"], -MASKS.index(option["mask"])))
    # A weak singleton reply which breaks a triple can be worse than preserving
    # the hand for a later lead. Never pass an immediate finish or urgent block.
    opponents = [p for p in view["players"] if p["player_id"] != view["you"] and p["card_count"] and not p["passed"]]
    if ("pass" in legal and move["count"] == 1 and view["your_hand"][move["mask"]] >= 3
            and hand_size(view["your_hand"]) > 3 and opponents
            and all(p["card_count"] > 3 for p in opponents) and _value(view, move) < 0):
        return {"type": "pass", **context}
    return {"type": "play", "mask": move["mask"], "count": move["count"], **context}
