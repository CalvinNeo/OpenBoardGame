"""Purpose-built bot policy for 似帽非帽 / That's Not a Hat.

The interesting decision in this game is not "which card do I play" but "do I
still remember what is under this face-down gift, and can I sell the answer".
A generic first-legal bot cannot express that, so the policy here models the two
things a human actually does at the table:

1. Fading memory. Every card is revealed to the whole table exactly once, and
   that reveal is recorded in the game state's reveal log. A bot recalls the
   object with a probability that decays with the number of actions since the
   reveal, scaled by a per-bot skill drawn at setup. Card positions are public,
   so the only uncertainty a bot carries is the object itself.

2. Calibrated trust. As the receiver the bot compares the announced object
   against what it remembers. A confident match is usually accepted, a
   confident mismatch is usually refused, and a blank memory mostly accepts
   because refusing blind is a coin flip that also risks a penalty.

When the memory fails the bot bluffs with a uniformly random object, which is
exactly the confident nonsense the physical game rewards.

The policy is a pure function of the authoritative state and never mutates it.
"""
import random
from typing import Dict, Optional

from game.not_a_hat_data import ITEM_KEYS


# Probability that a remembered object is still available, per action elapsed.
RECALL_DECAY = 0.986
# A card revealed one or two actions ago has barely had time to blur.
FRESH_RECALL_BONUS = 0.2
FRESH_RECALL_AGE = 1
RECALL_FLOOR = 0.05
RECALL_CEILING = 0.97
DEFAULT_SKILL = 0.72

# Receiver behaviour when the memory does resolve.
ACCEPT_ON_CONFIDENT_MATCH = 0.90
REFUSE_ON_CONFIDENT_MISMATCH = 0.86
# Receiver behaviour when the memory is blank: mostly trust, sometimes gamble.
REFUSE_ON_BLANK_MEMORY = 0.18

GIVE_DELAY_MS = (700, 1300)
RECEIVE_DELAY_MS = (600, 1100)
ACK_DELAY_MS = (250, 600)


def _recall_probability(skill: float, age: int) -> float:
    if age <= FRESH_RECALL_AGE:
        return min(RECALL_CEILING, skill + FRESH_RECALL_BONUS)
    return max(RECALL_FLOOR, min(RECALL_CEILING, skill * (RECALL_DECAY ** (age - 1))))


def _recalls(state: Dict, bot_id: str, card: Dict) -> bool:
    """Does this bot still remember the object printed on this card?"""
    seen = state.get("reveal_seq", {}).get(str(card["id"]))
    if seen is None:
        return False
    age = max(0, int(state.get("seq", 0)) - int(seen))
    skill = float(state.get("bot_skill", {}).get(bot_id, DEFAULT_SKILL))
    return random.random() < _recall_probability(skill, age)


def _card_being_offered(state: Dict) -> Optional[Dict]:
    pending = state.get("pending")
    if pending is not None:
        return pending
    giver = state.get("giver")
    if not giver:
        return None
    stack = state["players"][giver]["stack"]
    return stack[0] if stack else None


def _choose_give(state: Dict, bot_id: str) -> Optional[Dict]:
    card = _card_being_offered(state)
    if card is None:
        return None
    item = card["item"] if _recalls(state, bot_id, card) else random.choice(ITEM_KEYS)
    return {"type": "give", "item": item, "delay_ms": random.randint(*GIVE_DELAY_MS)}


def _choose_receive(state: Dict, bot_id: str) -> Optional[Dict]:
    card = state.get("in_transit")
    if card is None:
        return None
    announced = state.get("announced")
    if _recalls(state, bot_id, card):
        if announced == card["item"]:
            action = "accept" if random.random() < ACCEPT_ON_CONFIDENT_MATCH else "refuse"
        else:
            action = "refuse" if random.random() < REFUSE_ON_CONFIDENT_MISMATCH else "accept"
    else:
        action = "refuse" if random.random() < REFUSE_ON_BLANK_MEMORY else "accept"
    return {"type": action, "delay_ms": random.randint(*RECEIVE_DELAY_MS)}


def choose_action(state: Dict, bot_id: str) -> Optional[Dict]:
    """Return the bot's next action, or None when it has nothing legal to do."""
    if state.get("game_over"):
        return None
    if bot_id not in state.get("players", {}):
        return None

    phase = state.get("phase")
    if phase == "memorize":
        if bot_id in state.get("ready", []):
            return None
        return {"type": "ready", "delay_ms": random.randint(*ACK_DELAY_MS)}
    if phase == "review":
        if bot_id in state.get("ready", []):
            return None
        return {"type": "continue", "delay_ms": random.randint(*ACK_DELAY_MS)}
    if phase == "giving":
        return _choose_give(state, bot_id) if bot_id == state.get("giver") else None
    if phase == "receiving":
        return _choose_receive(state, bot_id) if bot_id == state.get("receiver") else None
    return None


__all__ = ["choose_action"]
