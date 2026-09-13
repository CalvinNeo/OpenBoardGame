from dataclasses import dataclass
from itertools import combinations
from typing import Callable, Dict, List, Optional, Sequence, Tuple


RequiredCostFn = Callable[[Dict, Dict[str, int]], Tuple[Dict[str, int], int]]


@dataclass(frozen=True)
class SplendorAiRules:
    regular_colors: Tuple[str, ...]
    wild_color: str
    market_tiers: Tuple[str, ...]
    reservable_tiers: Tuple[str, ...]
    owned_cards_key: str
    tier_values: Dict[str, float]
    allow_partial_distinct_take: bool
    required_cost: RequiredCostFn


def _tokens_copy(tokens: Dict[str, int], rules: SplendorAiRules) -> Dict[str, int]:
    colors = rules.regular_colors + (rules.wild_color,)
    return {color: int(tokens.get(color, 0)) for color in colors}


def _bonuses_copy(bonuses: Dict[str, int], rules: SplendorAiRules) -> Dict[str, int]:
    return {color: int(bonuses.get(color, 0)) for color in rules.regular_colors}


def _requirements(card: Dict, bonuses: Dict[str, int], rules: SplendorAiRules) -> Tuple[Dict[str, int], int]:
    colored, fixed_wild = rules.required_cost(card, bonuses)
    normalized = {color: max(0, int(colored.get(color, 0))) for color in rules.regular_colors}
    return normalized, max(0, int(fixed_wild))


def _card_gap(card: Dict, bonuses: Dict[str, int], tokens: Dict[str, int], rules: SplendorAiRules) -> int:
    required, fixed_wild = _requirements(card, bonuses, rules)
    wild_tokens = int(tokens.get(rules.wild_color, 0))
    fixed_gap = max(0, fixed_wild - wild_tokens)
    flexible_wild = max(0, wild_tokens - fixed_wild)
    colored_gap = sum(
        max(0, required[color] - int(tokens.get(color, 0)))
        for color in rules.regular_colors
    )
    return fixed_gap + max(0, colored_gap - flexible_wild)


def _payment_for_card(
    card: Dict,
    bonuses: Dict[str, int],
    tokens: Dict[str, int],
    rules: SplendorAiRules,
) -> Optional[Dict[str, int]]:
    required, fixed_wild = _requirements(card, bonuses, rules)
    wild_tokens = int(tokens.get(rules.wild_color, 0))
    if wild_tokens < fixed_wild:
        return None

    payment = {color: 0 for color in rules.regular_colors + (rules.wild_color,)}
    for color in rules.regular_colors:
        payment[color] = min(required[color], int(tokens.get(color, 0)))
    regular_shortfall = sum(required.values()) - sum(payment[color] for color in rules.regular_colors)
    if regular_shortfall > wild_tokens - fixed_wild:
        return None
    payment[rules.wild_color] = fixed_wild + regular_shortfall
    return payment


def _tier_value(card: Dict, tier: Optional[str], rules: SplendorAiRules) -> float:
    if tier is not None and tier in rules.tier_values:
        return float(rules.tier_values[tier])
    raw_tier = card.get("tier")
    if isinstance(raw_tier, int):
        return float(raw_tier)
    return float(rules.tier_values.get(str(raw_tier), 0.0))


def _known_cards(state: Dict, player: Dict, rules: SplendorAiRules) -> List[Dict]:
    entries: List[Dict] = []
    for tier in rules.market_tiers:
        for index, card in enumerate(state.get("market", {}).get(tier, [])):
            entries.append({"card": card, "source": "market", "tier": tier, "index": index})
    for index, card in enumerate(player.get("reserved", [])):
        entries.append({"card": card, "source": "reserved", "tier": None, "index": index})
    return entries


def _bonus_value(
    state: Dict,
    player: Dict,
    color: Optional[str],
    rules: SplendorAiRules,
    bonuses: Optional[Dict[str, int]] = None,
) -> float:
    if color not in rules.regular_colors:
        return 0.0
    current = bonuses or _bonuses_copy(player.get("bonuses", {}), rules)
    value = 1.0

    for noble in state.get("nobles", []):
        requirement = noble.get("requirement", {})
        if int(requirement.get(color, 0)) <= int(current.get(color, 0)):
            continue
        remaining = sum(
            max(0, int(requirement.get(candidate, 0)) - int(current.get(candidate, 0)))
            for candidate in rules.regular_colors
        )
        value += 2.8 / max(1, remaining)

    for entry in _known_cards(state, player, rules):
        card = entry["card"]
        raw_cost = int(card.get("cost", {}).get(color, 0))
        if raw_cost <= int(current.get(color, 0)):
            continue
        points = int(card.get("points", 0))
        value += min(0.32, 0.045 * raw_cost) * (1.0 + points * 0.12)

    for card in player.get(rules.owned_cards_key, []):
        requirement = card.get("evolution_requirements", {})
        if int(requirement.get(color, 0)) <= int(current.get(color, 0)):
            continue
        remaining = sum(
            max(0, int(requirement.get(candidate, 0)) - int(current.get(candidate, 0)))
            for candidate in rules.regular_colors
        )
        value += 2.4 / max(1, remaining)

    return min(5.0, value)


def _goal_priority(
    state: Dict,
    player: Dict,
    entry: Dict,
    rules: SplendorAiRules,
    tokens: Optional[Dict[str, int]] = None,
    bonuses: Optional[Dict[str, int]] = None,
) -> float:
    card = entry["card"]
    current_tokens = tokens or _tokens_copy(player.get("tokens", {}), rules)
    current_bonuses = bonuses or _bonuses_copy(player.get("bonuses", {}), rules)
    gap = _card_gap(card, current_bonuses, current_tokens, rules)
    required, fixed_wild = _requirements(card, current_bonuses, rules)
    effective_cost = sum(required.values()) + fixed_wild
    points = int(card.get("points", 0))
    bonus_value = _bonus_value(state, player, card.get("bonus"), rules, current_bonuses)
    tier_value = _tier_value(card, entry.get("tier"), rules)
    chain_value = 1.5 if card.get("evolution_targets") else 0.0
    commitment = 3.0 if entry.get("source") == "reserved" else 0.0
    value = 4.0 + points * 5.0 + bonus_value * 2.4 + tier_value * 0.7 + chain_value + commitment
    return value / (1.0 + gap * 0.72) - effective_cost * 0.04


def _portfolio_score(
    state: Dict,
    player: Dict,
    rules: SplendorAiRules,
    tokens: Optional[Dict[str, int]] = None,
    bonuses: Optional[Dict[str, int]] = None,
    exclude_card_id: Optional[str] = None,
) -> float:
    priorities = []
    for entry in _known_cards(state, player, rules):
        card = entry["card"]
        if exclude_card_id is not None and card.get("id") == exclude_card_id:
            continue
        priorities.append(_goal_priority(state, player, entry, rules, tokens, bonuses))
    priorities.sort(reverse=True)
    weights = (1.0, 0.55, 0.30, 0.16, 0.08)
    return sum(value * weights[index] for index, value in enumerate(priorities[: len(weights)]))


def _best_goal(state: Dict, player: Dict, rules: SplendorAiRules) -> Optional[Dict]:
    entries = _known_cards(state, player, rules)
    if not entries:
        return None
    return min(
        entries,
        key=lambda entry: (
            -_goal_priority(state, player, entry, rules),
            str(entry["card"].get("id", "")),
        ),
    )


def _discard_for_gain(
    state: Dict,
    player: Dict,
    gain: Dict[str, int],
    rules: SplendorAiRules,
) -> Dict[str, int]:
    original_tokens = _tokens_copy(player.get("tokens", {}), rules)
    tokens = dict(original_tokens)
    for color, amount in gain.items():
        tokens[color] = int(tokens.get(color, 0)) + int(amount)
    excess = sum(tokens.values()) - 10
    discard = {color: 0 for color in rules.regular_colors + (rules.wild_color,)}

    while excess > 0:
        baseline = _portfolio_score(state, player, rules, tokens=tokens)
        protected_floor = {
            color: original_tokens[color] + int(gain.get(color, 0))
            if int(gain.get(color, 0)) > 0
            else 0
            for color in tokens
        }
        can_preserve_gain = sum(
            max(0, tokens[color] - protected_floor[color])
            for color in tokens
        ) >= excess
        choices = []
        for color_index, color in enumerate(rules.regular_colors + (rules.wild_color,)):
            count = int(tokens.get(color, 0))
            if count <= 0:
                continue
            if can_preserve_gain and count <= protected_floor[color]:
                continue
            candidate_tokens = dict(tokens)
            candidate_tokens[color] -= 1
            loss = baseline - _portfolio_score(state, player, rules, tokens=candidate_tokens)
            if color == rules.wild_color:
                loss += 12.0
            choices.append((loss, -count, color_index, color))
        if not choices:
            break
        _, _, _, chosen = min(choices)
        tokens[chosen] -= 1
        discard[chosen] += 1
        excess -= 1
    return discard


def choose_splendor_discard(state: Dict, player_id: str, rules: SplendorAiRules) -> Optional[Dict]:
    player = state.get("players", {}).get(player_id)
    if not player:
        return None
    excess = sum(_tokens_copy(player.get("tokens", {}), rules).values()) - 10
    if excess <= 0:
        return None
    discard = _discard_for_gain(state, player, {}, rules)
    return {"type": "discard_tokens", "tokens": discard}


def _tokens_after_gain(
    player: Dict,
    gain: Dict[str, int],
    discard: Dict[str, int],
    rules: SplendorAiRules,
) -> Dict[str, int]:
    tokens = _tokens_copy(player.get("tokens", {}), rules)
    for color in tokens:
        tokens[color] += int(gain.get(color, 0))
        tokens[color] -= int(discard.get(color, 0))
    return tokens


def _opponent_block_value(state: Dict, player_id: str, card: Dict, rules: SplendorAiRules) -> float:
    target_score = int(state.get("config", {}).get("target_score", 15))
    points = int(card.get("points", 0))
    best = 0.0
    for opponent_id, opponent in state.get("players", {}).items():
        if opponent_id == player_id:
            continue
        gap = _card_gap(
            card,
            _bonuses_copy(opponent.get("bonuses", {}), rules),
            _tokens_copy(opponent.get("tokens", {}), rules),
            rules,
        )
        score = int(opponent.get("score", 0))
        if gap == 0 and score + points >= target_score:
            best = max(best, 180.0 + points * 8.0)
        elif gap == 0:
            best = max(best, 9.0 + points * 5.0)
        elif gap == 1:
            best = max(best, 3.0 + points * 2.0)
    return best


def _new_noble_points(state: Dict, bonuses: Dict[str, int], rules: SplendorAiRules) -> int:
    eligible = []
    for noble in state.get("nobles", []):
        requirement = noble.get("requirement", {})
        if all(
            int(bonuses.get(color, 0)) >= int(requirement.get(color, 0))
            for color in rules.regular_colors
        ):
            eligible.append(int(noble.get("points", 0)))
    return max(eligible, default=0)


def _evolution_opportunity_value(
    state: Dict,
    player: Dict,
    purchased_card: Dict,
    bonuses: Dict[str, int],
    rules: SplendorAiRules,
) -> float:
    owned_cards = list(player.get(rules.owned_cards_key, [])) + [purchased_card]
    targets_by_name = {
        entry["card"].get("name_en"): entry["card"]
        for entry in _known_cards(state, player, rules)
        if entry["card"].get("name_en")
    }
    best = 0.0
    for base in owned_cards:
        targets = base.get("evolution_targets", [])
        if not targets:
            continue
        requirement = base.get("evolution_requirements", {})
        if not all(
            int(bonuses.get(color, 0)) >= int(requirement.get(color, 0))
            for color in rules.regular_colors
        ):
            continue
        for name in targets:
            target = targets_by_name.get(name)
            if not target:
                continue
            value = (int(target.get("points", 0)) - int(base.get("points", 0))) * 5.0
            value += 2.0 if target.get("evolution_targets") else 0.0
            best = max(best, value)
    return best


def _score_buy(
    state: Dict,
    player_id: str,
    player: Dict,
    entry: Dict,
    rules: SplendorAiRules,
) -> Optional[float]:
    card = entry["card"]
    bonuses = _bonuses_copy(player.get("bonuses", {}), rules)
    tokens = _tokens_copy(player.get("tokens", {}), rules)
    payment = _payment_for_card(card, bonuses, tokens, rules)
    if payment is None:
        return None

    new_tokens = dict(tokens)
    for color, amount in payment.items():
        new_tokens[color] -= amount
    new_bonuses = dict(bonuses)
    bonus_color = card.get("bonus")
    if bonus_color in rules.regular_colors:
        new_bonuses[bonus_color] += 1

    card_id = card.get("id")
    before_future = _portfolio_score(state, player, rules, exclude_card_id=card_id)
    after_future = _portfolio_score(
        state,
        player,
        rules,
        tokens=new_tokens,
        bonuses=new_bonuses,
        exclude_card_id=card_id,
    )
    points = int(card.get("points", 0))
    noble_points = _new_noble_points(state, new_bonuses, rules)
    bonus_value = _bonus_value(state, player, bonus_color, rules, bonuses)
    spent = sum(payment.values())
    wild_spent = int(payment.get(rules.wild_color, 0))
    score = 22.0 + points * 22.0 + bonus_value * 5.5 + noble_points * 18.0
    score += (after_future - before_future) * 3.0
    score -= spent * 0.65 + wild_spent * 1.8
    if entry.get("source") == "reserved":
        score += 6.0
    else:
        score += _opponent_block_value(state, player_id, card, rules) * 0.3
    score += _evolution_opportunity_value(state, player, card, new_bonuses, rules) * 2.5

    projected_score = int(player.get("score", 0)) + points + noble_points
    if projected_score >= int(state.get("config", {}).get("target_score", 15)):
        score += 10000.0
    return score


def _take_candidates(
    state: Dict,
    player: Dict,
    legal_actions: Sequence[str],
    rules: SplendorAiRules,
) -> List[Tuple[float, Dict]]:
    legal = set(legal_actions)
    available = [
        color
        for color in rules.regular_colors
        if int(state.get("tokens_supply", {}).get(color, 0)) > 0
    ]
    gains: List[Tuple[Dict, Dict[str, int]]] = []

    if "take_tokens" in legal and available:
        take_count = min(3, len(available)) if rules.allow_partial_distinct_take else 3
        if len(available) >= take_count:
            for colors in combinations(available, take_count):
                gain = {color: 0 for color in rules.regular_colors + (rules.wild_color,)}
                for color in colors:
                    gain[color] = 1
                gains.append(({"type": "take_tokens", "colors": list(colors)}, gain))

    if "take_tokens_same" in legal:
        for color in rules.regular_colors:
            if int(state.get("tokens_supply", {}).get(color, 0)) < 4:
                continue
            gain = {candidate: 0 for candidate in rules.regular_colors + (rules.wild_color,)}
            gain[color] = 2
            gains.append(({"type": "take_tokens_same", "color": color}, gain))

    before_portfolio = _portfolio_score(state, player, rules)
    best_goal = _best_goal(state, player, rules)
    bonuses = _bonuses_copy(player.get("bonuses", {}), rules)
    tokens = _tokens_copy(player.get("tokens", {}), rules)
    before_gap = _card_gap(best_goal["card"], bonuses, tokens, rules) if best_goal else 0
    results = []
    for action, gain in gains:
        discard = _discard_for_gain(state, player, gain, rules)
        after_tokens = _tokens_after_gain(player, gain, discard, rules)
        after_portfolio = _portfolio_score(state, player, rules, tokens=after_tokens)
        after_gap = _card_gap(best_goal["card"], bonuses, after_tokens, rules) if best_goal else 0
        newly_affordable = 0
        for entry in _known_cards(state, player, rules):
            old_gap = _card_gap(entry["card"], bonuses, tokens, rules)
            new_gap = _card_gap(entry["card"], bonuses, after_tokens, rules)
            if old_gap > 0 and new_gap == 0:
                newly_affordable += 1
        discarded = sum(discard.values())
        score = 8.0 + (after_portfolio - before_portfolio) * 3.2
        score += max(0, before_gap - after_gap) * 6.0 + newly_affordable * 7.0
        score -= discarded * 1.4
        if after_portfolio <= before_portfolio + 0.01:
            score -= 10.0
        if discarded:
            action["discard"] = discard
        results.append((score, action))
    return results


def _reserve_candidates(
    state: Dict,
    player_id: str,
    player: Dict,
    legal_actions: Sequence[str],
    rules: SplendorAiRules,
) -> List[Tuple[float, Dict]]:
    if "reserve_market" not in set(legal_actions) or len(player.get("reserved", [])) >= 3:
        return []
    bonuses = _bonuses_copy(player.get("bonuses", {}), rules)
    tokens = _tokens_copy(player.get("tokens", {}), rules)
    before_portfolio = _portfolio_score(state, player, rules)
    results = []
    for tier in rules.reservable_tiers:
        for index, card in enumerate(state.get("market", {}).get(tier, [])):
            gain = {color: 0 for color in rules.regular_colors + (rules.wild_color,)}
            if int(state.get("tokens_supply", {}).get(rules.wild_color, 0)) > 0:
                gain[rules.wild_color] = 1
            discard = _discard_for_gain(state, player, gain, rules)
            after_tokens = _tokens_after_gain(player, gain, discard, rules)
            token_progress = _portfolio_score(state, player, rules, tokens=after_tokens) - before_portfolio
            entry = {"card": card, "source": "reserved", "tier": tier, "index": index}
            self_value = _goal_priority(state, player, entry, rules, after_tokens, bonuses)
            gap = _card_gap(card, bonuses, after_tokens, rules)
            block = _opponent_block_value(state, player_id, card, rules)
            score = 3.0 + self_value * 1.35 + token_progress * 3.0 + block
            score -= len(player.get("reserved", [])) * 6.0 + max(0, gap - 4) * 1.5
            if int(card.get("points", 0)) >= 3 and gap <= 4:
                score += 7.0
            if gap <= 2:
                score += 4.0
            action = {"type": "reserve_market", "tier": tier, "index": index}
            if sum(discard.values()) > 0:
                action["discard"] = discard
            results.append((score, action))
    return results


def _blind_reserve_action(state: Dict, player: Dict, rules: SplendorAiRules) -> Optional[Dict]:
    tiers = [tier for tier in rules.reservable_tiers if state.get("decks", {}).get(tier)]
    if not tiers:
        return None
    bonus_count = sum(int(player.get("bonuses", {}).get(color, 0)) for color in rules.regular_colors)
    target_index = 0 if bonus_count < 4 else (1 if bonus_count < 8 else 2)
    target_index = min(target_index, len(rules.reservable_tiers) - 1)
    preferred = rules.reservable_tiers[target_index]
    tier = preferred if preferred in tiers else tiers[0]
    gain = {color: 0 for color in rules.regular_colors + (rules.wild_color,)}
    if int(state.get("tokens_supply", {}).get(rules.wild_color, 0)) > 0:
        gain[rules.wild_color] = 1
    discard = _discard_for_gain(state, player, gain, rules)
    action = {"type": "reserve_deck", "tier": tier}
    if sum(discard.values()) > 0:
        action["discard"] = discard
    return action


def _action_key(action: Dict) -> str:
    parts = [str(action.get("type", "")), str(action.get("tier", ""))]
    parts.append(f"{int(action.get('index', action.get('reserved_index', -1))):04d}")
    parts.extend(str(color) for color in action.get("colors", []))
    parts.append(str(action.get("color", "")))
    return "|".join(parts)


def choose_splendor_main_action(
    state: Dict,
    player_id: str,
    legal_actions: Sequence[str],
    rules: SplendorAiRules,
) -> Optional[Dict]:
    player = state.get("players", {}).get(player_id)
    if not player:
        return None
    legal = set(legal_actions)
    candidates: List[Tuple[float, Dict]] = []
    bonuses = _bonuses_copy(player.get("bonuses", {}), rules)
    tokens = _tokens_copy(player.get("tokens", {}), rules)

    if "buy_market" in legal:
        for tier in rules.market_tiers:
            for index, card in enumerate(state.get("market", {}).get(tier, [])):
                entry = {"card": card, "source": "market", "tier": tier, "index": index}
                score = _score_buy(state, player_id, player, entry, rules)
                if score is not None:
                    candidates.append((score, {"type": "buy_market", "tier": tier, "index": index}))

    if "buy_reserved" in legal:
        for index, card in enumerate(player.get("reserved", [])):
            if _card_gap(card, bonuses, tokens, rules) != 0:
                continue
            entry = {"card": card, "source": "reserved", "tier": None, "index": index}
            score = _score_buy(state, player_id, player, entry, rules)
            if score is not None:
                candidates.append((score, {"type": "buy_reserved", "reserved_index": index}))

    candidates.extend(_take_candidates(state, player, legal_actions, rules))
    candidates.extend(_reserve_candidates(state, player_id, player, legal_actions, rules))

    if candidates:
        candidates.sort(key=lambda item: (-item[0], _action_key(item[1])))
        return candidates[0][1]

    if "reserve_deck" in legal and len(player.get("reserved", [])) < 3:
        return _blind_reserve_action(state, player, rules)
    return None


def choose_splendor_evolution(
    state: Dict,
    player_id: str,
    options: Sequence[Dict],
    rules: SplendorAiRules,
) -> Dict:
    player = state.get("players", {}).get(player_id)
    if not player or not options:
        return {"type": "skip_evolution"}

    owned_by_id = {
        card.get("id"): card
        for card in player.get(rules.owned_cards_key, [])
    }
    known_by_id = {
        entry["card"].get("id"): entry
        for entry in _known_cards(state, player, rules)
    }
    bonuses = _bonuses_copy(player.get("bonuses", {}), rules)
    scored = []
    for option in options:
        base = owned_by_id.get(option.get("base_id"))
        target_entry = known_by_id.get(option.get("target_id"))
        if not base or not target_entry:
            continue
        target = target_entry["card"]
        new_bonuses = dict(bonuses)
        base_bonus = base.get("bonus")
        target_bonus = target.get("bonus")
        if base_bonus in rules.regular_colors:
            new_bonuses[base_bonus] = max(0, new_bonuses[base_bonus] - 1)
        if target_bonus in rules.regular_colors:
            new_bonuses[target_bonus] += 1
        score = (int(target.get("points", 0)) - int(base.get("points", 0))) * 24.0
        score += (
            _bonus_value(state, player, target_bonus, rules, new_bonuses)
            - _bonus_value(state, player, base_bonus, rules, bonuses)
        ) * 6.0
        score += 6.0 if target.get("evolution_targets") else 0.0
        score += 4.0 if target_entry.get("source") == "reserved" else 0.0
        projected_score = int(player.get("score", 0)) - int(base.get("points", 0)) + int(target.get("points", 0))
        if projected_score >= int(state.get("config", {}).get("target_score", 18)):
            score += 10000.0
        action = {"type": "evolve", "base_id": base["id"], "target_id": target["id"]}
        scored.append((score, action))

    if not scored:
        return {"type": "skip_evolution"}
    scored.sort(key=lambda item: (-item[0], _action_key(item[1])))
    if scored[0][0] <= 0:
        return {"type": "skip_evolution"}
    return scored[0][1]
