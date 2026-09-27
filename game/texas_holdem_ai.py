"""Texas Hold'em decisions using only the acting player's public view.

Sample unknown cards to estimate showdown equity, then size bets and compare
calls with the pot the player can actually win. No model or external service is
required, and thinking never consumes the game's random source.
"""

import hashlib
import json
import random
from typing import Dict, List, Optional

from game.texas_holdem import RANKS, SUITS, _best_hand


EQUITY_SAMPLES = 128


def _random_source(view: Dict) -> random.Random:
    snapshot = {key: view.get(key) for key in (
        "you", "phase", "hand_number", "current_bet", "community_cards",
        "players", "action_info", "config",
    )}
    digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def _estimate_equity(hole: List[Dict], board: List[Dict], opponents: int,
                     rng: random.Random) -> float:
    """Estimate the share of a showdown pot, including split pots."""
    known = {(card["rank"], card["suit"]) for card in hole + board}
    unseen = [{"rank": rank, "suit": suit} for suit in SUITS for rank in RANKS
              if (rank, suit) not in known]
    missing = 5 - len(board)
    fixed_score = _best_hand(hole + board)[0] if missing == 0 else None
    equity = 0.0
    for _ in range(EQUITY_SAMPLES):
        sample = rng.sample(unseen, missing + 2 * opponents)
        community = board + sample[:missing]
        score = fixed_score or _best_hand(hole + community)[0]
        ties = 1
        for index in range(opponents):
            offset = missing + 2 * index
            other_score = _best_hand(sample[offset:offset + 2] + community)[0]
            if other_score > score:
                break
            if other_score == score:
                ties += 1
        else:
            equity += 1.0 / ties
    return equity / EQUITY_SAMPLES


def _call_price(view: Dict, player: Dict) -> tuple:
    call = min(player["chips"], view["action_info"]["to_call"])
    contribution = player["total_bet"] + call
    # Excess contributions go to side pots this player cannot win. Folded
    # players' contributions still count as money available in the pot.
    pot = call + sum(min(other["total_bet"], contribution) for other in view["players"])
    return call, pot


def _raise_action(view: Dict, player: Dict, opponents: List[Dict],
                  equity: float, pot: int) -> Optional[Dict]:
    legal = view["legal_actions"]
    info = view["action_info"]
    current_bet = view["current_bet"]
    responders = [other for other in opponents if other["status"] == "active" and other["chips"] > 0]
    if not responders:
        return None
    effective_max = max(other["current_bet"] + other["chips"] for other in responders)
    if effective_max <= current_bet:
        return None

    action_type = "bet" if "bet" in legal else "raise" if "raise" in legal else None
    if action_type is None:
        # A stack below the minimum opening bet can still open all-in. Avoid
        # using all_in to bypass a raise that a short opposing shove did not reopen.
        if (current_bet == 0 and "all_in" in legal
                and 0 < player["chips"] < (info["min_bet"] or 0)):
            return {"type": "all_in"}
        return None

    minimum = info["min_bet"] if action_type == "bet" else info["min_raise_to"]
    maximum = info["max_raise_to"]
    big_blind = view["config"]["big_blind"]
    if view["phase"] == "preflop" and current_bet <= big_blind:
        target = 3 * big_blind
    else:
        fraction = 0.75 if equity >= 0.75 else 0.5
        target = current_bet + max(big_blind, round(pot * fraction))
    target = min(maximum, max(minimum, min(target, effective_max)))
    if target == maximum and "all_in" in legal:
        return {"type": "all_in"}
    return {"type": action_type, "amount": target}


def choose_action(view: Dict) -> Optional[Dict]:
    """Choose one legal action without reading or modifying private state."""
    legal = view.get("legal_actions") or []
    if not legal:
        return None
    for action_type in ("rebuy", "next_hand"):
        if action_type in legal:
            return {"type": action_type}
    if view.get("current_turn") != view.get("you"):
        return None

    player = next((other for other in view["players"] if other["player_id"] == view["you"]), None)
    if player is None or player["status"] != "active":
        return None
    opponents = [other for other in view["players"]
                 if other["player_id"] != view["you"] and other["status"] in ("active", "all_in")]
    rng = _random_source(view)
    equity = _estimate_equity(player["hole_cards"], view["community_cards"], len(opponents), rng)
    call, pot = _call_price(view, player)
    big_blind = view["config"]["big_blind"]
    facing_bet = call > 0 and (view["phase"] != "preflop" or view["current_bet"] > big_blind)

    if call and "fold" in legal:
        # Uniform unknown hands overestimate our chances against a large bet.
        # Allow an additional margin for pressure and future streets.
        margin = 0.0
        if facing_bet:
            margin = 0.02 + 0.08 * call / max(1, player["chips"])
            margin += 0.06 * min(1.0, call / (10 * big_blind))
            if view["phase"] != "river":
                margin += 0.06
        if equity < call / max(1, pot) + margin:
            return {"type": "fold"}

    baseline = 1.0 / (len(opponents) + 1)
    raise_threshold = baseline + 0.14
    if facing_bet:
        pressure = call / max(1, pot - call)
        raise_threshold = max(0.58, raise_threshold) + min(0.16, pressure * 0.15)
    value_bet = equity >= raise_threshold
    # Occasional small heads-up bluffs in position, only when nobody has bet
    # and the opponent can still fold. Never bluff into an all-in player.
    bluff = (call == 0 and view["phase"] != "preflop" and len(opponents) == 1
             and opponents[0]["status"] == "active" and player["is_dealer"]
             and rng.random() < 0.04)
    if value_bet or bluff:
        action = _raise_action(view, player, opponents, equity, pot)
        if action:
            return action

    for action_type in ("check", "call", "fold"):
        if action_type in legal:
            return {"type": action_type}
    return None
