"""Strategic bot for Witch's Brew.

The three decisions that decide this game are which five roles to keep, which
role to lead with, and whether to claim the full action or settle for the favor.
Everything else follows from one resource valuation, so the module is built
around `resource_prices` and `role_value`.

The claim-or-favor call is the interesting one. A full action can be stolen by
any later responder who still holds the same role, and a stolen claimant gets
nothing at all, while the favor is guaranteed. So the bot claims only when

    P(no later responder holds the role) * full_value > favor_value

which reproduces the strategy the rulebook implies: claiming early is risky and
claiming late is safe.
"""

from typing import Dict, List, Optional, Sequence, Tuple

INGREDIENTS = ("red", "green", "white")
STACKS = ("copper", "iron", "silver")
STACK_ROLE = {"copper": "wizard", "iron": "witch", "silver": "druid"}
ROLE_STACK = {role: stack for stack, role in STACK_ROLE.items()}
ROLE_COLOR = {"wolf_keeper": "red", "snake_hunter": "white", "herb_collector": "green"}
SPELL_COLOR = {"herba": "green", "lupus": "red", "serpens": "white"}
SPELL_STACK = {"magus": "copper", "sanatio": "silver", "strix": "iron"}

# A vial is a guaranteed point at the end, gold only converts through other
# roles, and a loose ingredient is worth least because it still needs a spender.
BASE_PRICES = {"red": 0.40, "green": 0.40, "white": 0.40, "gold": 0.42, "vial": 1.0}

# How likely a player who holds the role is to claim the full action. The last
# player to answer has nobody left to fear and always claims, and the appetite
# decays for everyone standing earlier in the order.
CLAIM_DECAY = 0.7

# The ingredient that completes a cauldron is worth far more than a loose one,
# but only while the cauldron is actually within reach.
PRICE_CEILING = 1.2
MAX_DEFICIT = 3


def _amount(value) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _player(view: Dict, player_id: str) -> Dict:
    for entry in view.get("players") or []:
        if entry.get("player_id") == player_id:
            return entry
    return {"player_id": player_id, "resources": {}, "played_roles": [], "hand_count": 0}


def _cauldron_top(view: Dict, stack: str) -> Optional[Dict]:
    cards = (view.get("cauldrons") or {}).get(stack) or []
    return cards[0] if cards else None


def _shelf_top(view: Dict, stack: str) -> Optional[Dict]:
    cards = (view.get("shelves") or {}).get(stack) or []
    return cards[0] if cards else None


def _cost_total(cost: Dict) -> int:
    return sum(_amount(cost.get(color)) for color in INGREDIENTS)


def _spend(resources: Dict, cost: Dict, prices: Dict) -> float:
    return sum(_amount(cost.get(color)) * prices[color] for color in INGREDIENTS) + _amount(cost.get("gold")) * prices["gold"]


def _affordable(resources: Dict, cost: Dict) -> bool:
    return all(_amount(resources.get(key)) >= _amount(value) for key, value in cost.items())


def resource_prices(view: Dict, player: Dict) -> Dict[str, float]:
    """Value one unit of each resource for this player, on the current board."""
    prices = dict(BASE_PRICES)
    resources = player.get("resources") or {}
    for stack in STACKS:
        card = _cauldron_top(view, stack)
        if not card:
            continue
        cost = card.get("cost") or {}
        deficit = {color: max(0, _amount(cost.get(color)) - _amount(resources.get(color))) for color in INGREDIENTS}
        missing = sum(deficit.values())
        if not missing or missing > MAX_DEFICIT:
            continue
        urgency = min(PRICE_CEILING, _amount(card.get("vp")) / (missing + 1))
        for color, need in deficit.items():
            if need:
                prices[color] = max(prices[color], urgency)
    return prices


def _shelf_gain(view: Dict, stack: str, gain: float) -> float:
    """Points bought by pushing `gain` more units onto the top shelf card."""
    card = _shelf_top(view, stack)
    if not card or gain <= 0:
        return 0.0
    threshold = max(1, _amount(card.get("threshold")))
    return _amount(card.get("vp")) * min(1.0, gain / threshold)


def _spell_value(view: Dict, player: Dict, prices: Dict) -> float:
    """Points from resolving the current spell as the Warlock's full action."""
    spell = view.get("spell")
    resources = player.get("resources") or {}
    if spell == "copia":
        return 3.0 * max(prices[color] for color in INGREDIENTS)
    if spell == "optio":
        best = 0.0
        for stack in STACKS:
            card = _cauldron_top(view, stack)
            if card and _affordable(resources, card.get("cost") or {}):
                best = max(best, _amount(card.get("vp")) - _spend(resources, card.get("cost") or {}, prices))
        return max(0.0, best)
    if spell in SPELL_COLOR:
        color = SPELL_COLOR[spell]
        if _amount(resources.get(color)) < 1:
            return 0.0
        return 2.0 * prices["vial"] - prices[color]
    if spell in SPELL_STACK:
        card = _cauldron_top(view, SPELL_STACK[spell])
        if not card:
            return 0.0
        needed = _cost_total(card.get("cost") or {})
        owned = sum(_amount(resources.get(color)) for color in INGREDIENTS)
        if owned < needed:
            return 0.0
        return max(0.0, _amount(card.get("vp")) - needed * min(prices[color] for color in INGREDIENTS))
    return 0.0


def _cauldron_value(view: Dict, player: Dict, stack: str, strength: str, prices: Dict) -> float:
    card = _cauldron_top(view, stack)
    if not card:
        return 0.0
    cost = {color: _amount((card.get("cost") or {}).get(color)) for color in INGREDIENTS}
    if strength != "full":
        cost["gold"] = 2
    resources = player.get("resources") or {}
    if not _affordable(resources, cost):
        return 0.0
    return max(0.0, _amount(card.get("vp")) - _spend(resources, cost, prices))


def _raid_value(view: Dict, player: Dict, unit: str, prices: Dict, strength: str) -> Tuple[float, float]:
    """Cutpurse and Begging Monk: what the raid collects, and what the favor saves."""
    price = prices["gold"] if unit == "gold" else min(prices[color] for color in INGREDIENTS)
    divisor = 3 if unit == "gold" else 4
    favor_players = set(view.get("favor_players") or [])
    stolen = 0.0
    protected = 0.0
    for entry in view.get("players") or []:
        if entry.get("player_id") == player.get("player_id"):
            continue
        resources = entry.get("resources") or {}
        if unit == "gold":
            holding = _amount(resources.get("gold"))
        else:
            holding = sum(_amount(resources.get(color)) for color in INGREDIENTS)
        loss = holding // divisor
        if entry.get("player_id") in favor_players:
            loss = max(0, loss - 1)
        stolen += loss
        protected += 1.0 if holding // divisor > 0 else 0.0
    stack = "gold_shelf" if unit == "gold" else "ingredient_shelf"
    if strength == "full":
        return _shelf_gain(view, stack, stolen), 0.0
    # The favor only matters when somebody else actually runs the raid, and the
    # starter is always the fallback claimant, so it is close to certain.
    return 0.0, protected * price


def role_value(view: Dict, player: Dict, role: str, strength: str, prices: Dict) -> float:
    """Points this player expects from resolving `role` at `strength`."""
    resources = player.get("resources") or {}
    full = strength == "full"
    if role in ROLE_COLOR:
        return (3 if full else 1) * prices[ROLE_COLOR[role]]
    if role == "alchemist":
        owned = [color for color in INGREDIENTS if _amount(resources.get(color)) > 0]
        if not owned:
            return 0.0
        cheapest = min(prices[color] for color in owned)
        return max(0.0, (5 if full else 2) * prices["gold"] - cheapest)
    if role == "fortune_teller":
        if _amount(resources.get("gold")) < 1:
            return 0.0
        return max(0.0, (2 if full else 1) * prices["vial"] - prices["gold"])
    if role == "assistant":
        if _amount(resources.get("gold")) < 1:
            return 0.0
        return max(0.0, (3 if full else 1) * max(prices[color] for color in INGREDIENTS) - prices["gold"])
    if role in ROLE_STACK:
        return _cauldron_value(view, player, ROLE_STACK[role], strength, prices)
    if role == "warlock":
        return _spell_value(view, player, prices) if full else prices["gold"]
    if role == "cutpurse":
        full_value, favor_value = _raid_value(view, player, "gold", prices, strength)
        return full_value if full else favor_value
    if role == "begging_monk":
        full_value, favor_value = _raid_value(view, player, "ingredients", prices, strength)
        return full_value if full else favor_value
    return 0.0


def hold_probability(view: Dict, player_id: str, role: str) -> float:
    """Chance that `player_id` still holds `role`, from public information only."""
    if player_id == view.get("you"):
        return 1.0 if role in (view.get("your_hand") or []) else 0.0
    if player_id in set(view.get("round_passed") or []):
        return 0.0
    entry = _player(view, player_id)
    played = list(entry.get("played_roles") or [])
    if role in played:
        return 0.0
    hand = _amount(entry.get("hand_count"))
    if hand <= 0:
        return 0.0
    pool = 12 - len(view.get("disabled_roles") or []) - len(played)
    if pool <= 0:
        return 0.0
    return min(1.0, hand / pool)


def pending_responders(view: Dict) -> List[str]:
    """Players who still answer this role after the current player, in seat order."""
    answered = set(view.get("round_participants") or []) | set(view.get("round_passed") or [])
    starter = view.get("round_starter")
    me = view.get("you")
    order = [entry.get("player_id") for entry in view.get("players") or []]
    return [pid for pid in order if pid and pid not in answered and pid != starter and pid != me]


def claim_tendency(players_after: int) -> float:
    """Chance that a player holding the role claims it, given how many answer later."""
    return CLAIM_DECAY ** max(0, players_after)


def survival_probability(view: Dict, role: str, responders: Optional[Sequence[str]] = None) -> float:
    """Chance that nobody still to answer steals the full action."""
    if responders is None:
        responders = pending_responders(view)
    responders = list(responders)
    chance = 1.0
    for index, player_id in enumerate(responders):
        tendency = claim_tendency(len(responders) - index - 1)
        chance *= 1.0 - hold_probability(view, player_id, role) * tendency
    return chance


def choose_roles(view: Dict, count: int = 5) -> List[str]:
    """Keep the roles with the best full action, breaking ties on the favor."""
    player = _player(view, view.get("you"))
    prices = resource_prices(view, player)
    disabled = set(view.get("disabled_roles") or [])
    scored = []
    for role in (view.get("role_defs") or {}):
        if role in disabled:
            continue
        full = role_value(view, player, role, "full", prices)
        favor = role_value(view, player, role, "favor", prices)
        # The favor is what a contested role still pays, so it breaks ties
        # between roles whose full action looks equally good right now.
        scored.append((full + 0.35 * favor, role))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [role for _, role in scored[:count]]


def choose_lead(view: Dict) -> Optional[str]:
    """Lead with the role whose full action is most likely to survive."""
    player = _player(view, view.get("you"))
    prices = resource_prices(view, player)
    hand = list(view.get("your_hand") or [])
    best = None
    for role in hand:
        value = role_value(view, player, role, "full", prices) * survival_probability(view, role)
        if best is None or value > best[0]:
            best = (value, role)
    return best[1] if best else (hand[0] if hand else None)


def choose_response(view: Dict) -> str:
    """Claim the full action only when it is likely to survive the later players."""
    role = view.get("active_role")
    player = _player(view, view.get("you"))
    prices = resource_prices(view, player)
    full = role_value(view, player, role, "full", prices)
    favor = role_value(view, player, role, "favor", prices)
    survival = survival_probability(view, role)
    return "claim_full" if survival * full > favor else "take_favor"


def _gain_ingredients(view: Dict, player: Dict, amount: int) -> Dict[str, int]:
    """Take the colours that are worth most to this player right now."""
    prices = resource_prices(view, player)
    order = sorted(INGREDIENTS, key=lambda color: (-prices[color], color))
    gains = {color: 0 for color in INGREDIENTS}
    for index in range(amount):
        gains[order[index % len(order)]] += 1
    return gains


def _payment(player: Dict, amount: int, prices: Dict) -> Optional[Dict[str, int]]:
    """Spend the cheapest owned ingredients, so the useful ones stay in hand."""
    resources = player.get("resources") or {}
    order = sorted(INGREDIENTS, key=lambda color: (prices[color], color))
    payment = {color: 0 for color in INGREDIENTS}
    remaining = amount
    for color in order:
        take = min(_amount(resources.get(color)), remaining)
        payment[color] = take
        remaining -= take
    return payment if remaining == 0 else None


def _cheapest_owned(player: Dict, prices: Dict, reserved: Dict[str, int]) -> Optional[str]:
    resources = player.get("resources") or {}
    owned = [
        color for color in INGREDIENTS
        if _amount(resources.get(color)) - _amount(reserved.get(color)) > 0
    ]
    if not owned:
        return None
    return min(owned, key=lambda color: (prices[color], color))


def choose_resolution(view: Dict) -> Dict:
    """Build the resolve_action payload for the role this player has to run."""
    pending = view.get("pending_action") or {}
    role = pending.get("role")
    full = pending.get("strength") == "full"
    player = _player(view, view.get("you"))
    resources = player.get("resources") or {}
    prices = resource_prices(view, player)
    skip = {"type": "resolve_action", "skip": True}
    action = {"type": "resolve_action"}

    if role in ROLE_COLOR:
        return action
    if role == "alchemist":
        owned = [color for color in INGREDIENTS if _amount(resources.get(color)) > 0]
        if not owned:
            return skip
        return {**action, "pay_ingredient": min(owned, key=lambda color: (prices[color], color))}
    if role == "fortune_teller":
        return action if _amount(resources.get("gold")) > 0 else skip
    if role == "assistant":
        if _amount(resources.get("gold")) < 1:
            return skip
        return {**action, "gain_ingredients": _gain_ingredients(view, player, 3 if full else 1)}
    if role in ROLE_STACK:
        card = _cauldron_top(view, ROLE_STACK[role])
        if not card:
            return skip
        cost = {color: _amount((card.get("cost") or {}).get(color)) for color in INGREDIENTS}
        if not full:
            cost["gold"] = 2
        if not _affordable(resources, cost):
            return skip
        # One spare ingredient converts into a guaranteed point, which beats
        # holding it, so pay it whenever something is left after the purchase.
        extra = _cheapest_owned(player, prices, cost)
        return {**action, "extra_ingredient": extra} if extra else action
    if role == "warlock":
        if not full:
            return action
        return _spell_resolution(view, player, prices, action, skip)
    if role == "cutpurse":
        return {**action, "augment_gold": _raid_top_up(view, "gold_shelf", "gold", player, prices)}
    if role == "begging_monk":
        return {**action, "augment_ingredients": _raid_top_up_ingredients(view, player, prices)}
    return skip


def _spell_resolution(view: Dict, player: Dict, prices: Dict, action: Dict, skip: Dict) -> Dict:
    resources = player.get("resources") or {}
    spell = view.get("spell")
    if spell == "copia":
        return {**action, "gain_ingredients": _gain_ingredients(view, player, 3)}
    if spell == "optio":
        best = None
        for stack in STACKS:
            card = _cauldron_top(view, stack)
            if not card:
                continue
            cost = card.get("cost") or {}
            if not _affordable(resources, cost):
                continue
            value = _amount(card.get("vp")) - _spend(resources, cost, prices)
            if best is None or value > best[0]:
                best = (value, stack)
        return {**action, "stack": best[1]} if best else skip
    if spell in SPELL_COLOR:
        color = SPELL_COLOR[spell]
        return action if _amount(resources.get(color)) > 0 else skip
    if spell in SPELL_STACK:
        card = _cauldron_top(view, SPELL_STACK[spell])
        if not card:
            return skip
        payment = _payment(player, _cost_total(card.get("cost") or {}), prices)
        return {**action, "payment": payment} if payment is not None else skip
    return skip


def _shelf_shortfall(view: Dict, stack: str) -> Tuple[int, int]:
    """How many more units the top shelf card needs, and how many are stored."""
    card = _shelf_top(view, stack)
    if not card:
        return 0, 0
    stored = (view.get("shelf_stored") or {}).get(stack) or {}
    if stack == "gold_shelf":
        have = _amount(stored.get("gold"))
    else:
        have = sum(_amount(stored.get(color)) for color in INGREDIENTS)
    return max(0, _amount(card.get("threshold")) - have), have


def _raid_top_up(view: Dict, stack: str, unit: str, player: Dict, prices: Dict) -> int:
    """Add just enough to finish the shelf card, never more."""
    shortfall, _ = _shelf_shortfall(view, stack)
    if shortfall <= 0:
        return 0
    resources = player.get("resources") or {}
    stolen = 0
    divisor = 3
    favor_players = set(view.get("favor_players") or [])
    for entry in view.get("players") or []:
        if entry.get("player_id") == player.get("player_id"):
            continue
        holding = _amount((entry.get("resources") or {}).get(unit))
        loss = holding // divisor
        if entry.get("player_id") in favor_players:
            loss = max(0, loss - 1)
        stolen += loss
    return max(0, min(shortfall - stolen, _amount(resources.get(unit))))


def _raid_top_up_ingredients(view: Dict, player: Dict, prices: Dict) -> Dict[str, int]:
    shortfall, _ = _shelf_shortfall(view, "ingredient_shelf")
    resources = player.get("resources") or {}
    stolen = 0
    favor_players = set(view.get("favor_players") or [])
    for entry in view.get("players") or []:
        if entry.get("player_id") == player.get("player_id"):
            continue
        holding = sum(_amount((entry.get("resources") or {}).get(color)) for color in INGREDIENTS)
        loss = holding // 4
        if entry.get("player_id") in favor_players:
            loss = max(0, loss - 1)
        stolen += loss
    needed = max(0, shortfall - stolen)
    augment = {color: 0 for color in INGREDIENTS}
    if needed <= 0:
        return augment
    order = sorted(INGREDIENTS, key=lambda color: (prices[color], color))
    for color in order:
        take = min(_amount(resources.get(color)), needed)
        augment[color] = take
        needed -= take
    return augment


def choose_loss(view: Dict) -> Dict[str, int]:
    """Give up the ingredients this player needs least."""
    monk = view.get("monk_resolution") or {}
    pending = (monk.get("pending_losses") or [{}])[0]
    amount = _amount(pending.get("amount"))
    player = _player(view, view.get("you"))
    resources = player.get("resources") or {}
    prices = resource_prices(view, player)
    loss = {color: 0 for color in INGREDIENTS}
    remaining = amount
    for color in sorted(INGREDIENTS, key=lambda color: (prices[color], color)):
        take = min(_amount(resources.get(color)), remaining)
        loss[color] = take
        remaining -= take
    return loss


def choose_action(view: Dict, legal: Sequence[str]) -> Optional[Dict]:
    """Dispatch to the decision that matches the viewer's legal actions."""
    if "select_roles" in legal:
        return {"type": "select_roles", "roles": choose_roles(view)}
    if "play_role" in legal:
        role = choose_lead(view)
        return {"type": "play_role", "role": role} if role else None
    if "respond" in legal:
        return {"type": "respond", "response": choose_response(view)}
    if "resolve_action" in legal:
        return choose_resolution(view)
    if "choose_loss" in legal:
        return {"type": "choose_loss", "loss": choose_loss(view)}
    if "next_round" in legal:
        return {"type": "next_round"}
    return None
