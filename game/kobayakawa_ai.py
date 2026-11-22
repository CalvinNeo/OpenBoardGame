from itertools import combinations
from math import comb
from typing import Dict, Optional, Tuple


FUTURE_FIGHT_PROBABILITY = 0.65


def _combination_count(available: int, selected: int) -> int:
    return comb(available, selected) if 0 <= selected <= available else 0


def _showdown_equity(hand: int, center: int, unseen: Tuple[int, ...], opponents: int,
                     tie_share: float = 1.0) -> float:
    if opponents == 0:
        return 1.0
    total = _combination_count(len(unseen), opponents)
    if not total:
        return 0.0
    higher_beaten = sum(hand < card < hand + center for card in unseen)
    lower = sum(card < hand for card in unseen)
    lower_unbeaten = sum(hand - center <= card < hand for card in unseen)
    wins = (
        _combination_count(higher_beaten, opponents)
        + _combination_count(lower, opponents)
        - _combination_count(lower_unbeaten, opponents)
    )
    ties = (
        (_combination_count(higher_beaten, opponents - 1) if hand + center in unseen else 0)
        + (_combination_count(lower_unbeaten - 1, opponents - 1) if hand - center in unseen else 0)
    )
    return (wins + tie_share * ties) / total


def _outcome_value(view: Dict, balances: Dict[str, int], pot: int, winner: Optional[str]) -> float:
    balances = dict(balances)
    if winner is not None:
        balances[winner] += pot + view.get("round_reward", 0)
    config = view.get("config", {})
    end_mode = config.get("end_mode", "rounds")
    terminal = (
        view.get("final_round", False) and winner is not None
    ) or (end_mode == "bankrupt" and any(tokens <= 0 for tokens in balances.values()))
    terminal = terminal or sum(tokens > 0 for tokens in balances.values()) <= 1
    if terminal:
        leaders = [player_id for player_id, tokens in balances.items() if tokens == max(balances.values())]
        return 1.0 / len(leaders) if view["you"] in leaders else 0.0
    reserve = view.get("reserve", 0) - (view.get("round_reward", 0) if winner is not None else 0)
    total = sum(balances.values()) + reserve + (pot if winner is None else 0)
    return balances[view["you"]] / total if total else 0.0


def _betting_model(view: Dict) -> Tuple[float, Tuple[float, ...], Tuple[float, ...]]:
    players = view["players"]
    balances = {player["player_id"]: player["tokens"] for player in players}
    coefficients = [0.0] * len(players)
    tie_coefficients = [0.0] * len(players)
    if balances[view["you"]] <= 0:
        return 0.0, tuple(coefficients), tuple(tie_coefficients)
    stake = 2 if view.get("final_round", False) else 1
    order = [player["player_id"] for player in players]
    start = order.index(view["start_player"]) if view.get("start_player") in order else 0
    ranks = {player_id: index for index, player_id in enumerate(order[start:] + order[:start])}
    committed = [player["player_id"] for player in players
                 if player["player_id"] != view["you"] and player.get("bet_choice") == "fight"]
    pending = [player["player_id"] for player in players
               if player["player_id"] != view["you"] and player.get("bet_choice") is None
               and player["tokens"] > 0]
    baseline = 0.0
    for count in range(len(pending) + 1):
        probability = FUTURE_FIGHT_PROBABILITY ** count * (1 - FUTURE_FIGHT_PROBABILITY) ** (len(pending) - count)
        for future_fighters in combinations(pending, count):
            opponents = committed + list(future_fighters)
            future_balances = dict(balances)
            for player_id in future_fighters:
                future_balances[player_id] -= min(stake, future_balances[player_id])
            pot = view.get("pot", 0) + sum(min(stake, balances[player_id]) for player_id in future_fighters)
            if opponents:
                pass_value = sum(_outcome_value(view, future_balances, pot, player_id)
                                 for player_id in opponents) / len(opponents)
            else:
                pass_value = _outcome_value(view, future_balances, pot, None)
            cost = min(stake, future_balances[view["you"]])
            future_balances[view["you"]] -= cost
            win_value = _outcome_value(view, future_balances, pot + cost, view["you"])
            lose_value = (
                sum(_outcome_value(view, future_balances, pot + cost, player_id)
                    for player_id in opponents) / len(opponents)
                if opponents else win_value
            )
            baseline += probability * (lose_value - pass_value)
            coefficients[len(opponents)] += probability * (win_value - lose_value)
            tie_share = sum(ranks[view["you"]] < ranks[player_id] for player_id in opponents) / len(opponents) if opponents else 0
            tie_coefficients[len(opponents)] += probability * (win_value - lose_value) * tie_share
    return baseline, tuple(coefficients), tuple(tie_coefficients)


def _fight_gain(hand: int, center: int, unseen: Tuple[int, ...],
                model: Tuple[float, Tuple[float, ...], Tuple[float, ...]]) -> float:
    baseline, coefficients, tie_coefficients = model
    value = baseline
    for count, coefficient in enumerate(coefficients):
        if coefficient:
            strict = _showdown_equity(hand, center, unseen, count, 0.0)
            tied = _showdown_equity(hand, center, unseen, count, 1.0) - strict
            value += coefficient * strict + tie_coefficients[count] * tied
    return value


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if not view.get("game_over") and "next_round" in legal:
        return {"type": "next_round", "round": view["round"], "review_id": view.get("review_id", 0)}
    if view.get("game_over") or not legal or view.get("current_turn") != view.get("you"):
        return None
    if len(legal) == 1:
        return {"type": legal[0]}
    hand = view.get("your_hand")
    center = view.get("kobayakawa")
    if hand is None or center is None:
        return None
    drawn = view.get("your_drawn")
    known = set(view.get("discard_pile", [])) | {hand, center, drawn}
    unseen = tuple(card for card in range(1, 16) if card not in known)
    model = _betting_model(view)
    if "fight" in legal:
        gain = _fight_gain(hand, center, unseen, model)
        return {"type": "fight" if gain >= -1e-12 else "pass"}
    if "keep_drawn" in legal and drawn is not None:
        keep_gain = _fight_gain(drawn, center, unseen, model)
        discard_gain = _fight_gain(hand, center, unseen, model)
        return {"type": "keep_drawn" if keep_gain > discard_gain + 1e-12 else "discard_drawn"}
    if "draw_card" not in legal or not view.get("deck_count") or not unseen:
        return None
    draw_gains = []
    replace_gains = []
    for candidate in unseen:
        remaining = tuple(card for card in unseen if card != candidate)
        draw_gains.append(max(_fight_gain(hand, center, remaining, model),
                              _fight_gain(candidate, center, remaining, model)))
        replace_gains.append(_fight_gain(hand, candidate, remaining, model))
    draw_value = (sum(max(0.0, gain) for gain in draw_gains), sum(draw_gains))
    replace_value = (sum(max(0.0, gain) for gain in replace_gains), sum(replace_gains))
    return {"type": "replace_kobayakawa" if replace_value > draw_value else "draw_card"}
