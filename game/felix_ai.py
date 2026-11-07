"""Information-set Felix policy: exact sack moments and bounded auction rollouts."""

import hashlib
import itertools
import json
import math
import random
from functools import lru_cache
from typing import Dict, List, Optional, Sequence, Tuple

from game.felix import CARD_SPECS


BIG_DOG = 100
SMALL_DOG = 101
CAT_VALUES = tuple(value for _, kind, value in CARD_SPECS if kind == "cat")
CARD_VALUES = (*CAT_VALUES, 0, BIG_DOG, SMALL_DOG)
CHOICE_SAMPLES = 32


def _card_value(card: Dict) -> int:
    if card.get("kind") == "big_dog":
        return BIG_DOG
    if card.get("kind") == "small_dog":
        return SMALL_DOG
    return int(card.get("value") or 0)


def _sack_score(values: Sequence[int]) -> int:
    cats = [value for value in values if value in CAT_VALUES]
    dogs = [value for value in values if value in (BIG_DOG, SMALL_DOG)]
    total = sum(cats)
    if len(dogs) != 1 or not cats:
        return total
    target = min(cats)
    if dogs[0] == BIG_DOG and max(cats) > 0:
        target = max(cats)
    return total - target


@lru_cache(maxsize=2048)
def _restricted_pool(pool: Tuple[int, ...], allowed: Tuple[int, ...]) -> Tuple[float, float]:
    matching = [value for value in pool if value in allowed]
    return len(matching) / len(pool), sum(matching) / len(pool)


def _restricted_moments(pools: Tuple[Tuple[int, ...], ...], allowed: Tuple[int, ...]) -> Tuple[float, float]:
    probability = 1.0
    conditional_total = 0.0
    for pool in pools:
        chance, weighted_value = _restricted_pool(pool, allowed)
        if not chance:
            return 0.0, 0.0
        probability *= chance
        conditional_total += weighted_value / chance
    return probability, probability * conditional_total


@lru_cache(maxsize=8192)
def _sack_moments(pools: Tuple[Tuple[int, ...], ...]) -> Tuple[float, float]:
    """Compute E[T-R] and its deviation; R exists only with exactly one dog."""
    if all(len(pool) == 1 for pool in pools):
        return float(_sack_score([pool[0] for pool in pools])), 0.0
    total_mean = 0.0
    total_variance = 0.0
    for pool in pools:
        mean = sum(value for value in pool if value in CAT_VALUES) / len(pool)
        second = sum(value * value for value in pool if value in CAT_VALUES) / len(pool)
        total_mean += mean
        total_variance += second - mean * mean
    removed_mean = 0.0
    removed_second = 0.0
    cross_moment = 0.0
    for index, pool in enumerate(pools):
        others = pools[:index] + pools[index + 1:]
        for dog in (BIG_DOG, SMALL_DOG):
            dog_chance = pool.count(dog) / len(pool)
            if not dog_chance:
                continue
            for target in CAT_VALUES:
                if dog == SMALL_DOG:
                    allowed = (0,) + tuple(value for value in CAT_VALUES if value >= target)
                elif target > 0:
                    allowed = (0,) + tuple(value for value in CAT_VALUES if value <= target)
                else:
                    allowed = (0,) + tuple(value for value in CAT_VALUES if target <= value < 0)
                without_target = tuple(value for value in allowed if value != target)
                chance, weighted_total = _restricted_moments(others, allowed)
                excluded_chance, excluded_total = _restricted_moments(others, without_target)
                target_chance = dog_chance * (chance - excluded_chance)
                removed_mean += target * target_chance
                removed_second += target * target * target_chance
                cross_moment += dog_chance * target * (weighted_total - excluded_total)
    mean = total_mean - removed_mean
    second = total_variance + total_mean * total_mean - 2 * cross_moment + removed_second
    return mean, math.sqrt(max(0.0, second - mean * mean))


def _bag_statistics(pools: Sequence[Tuple[int, ...]]) -> Tuple[float, float]:
    return _sack_moments(tuple(sorted(tuple(sorted(pool)) for pool in pools)))


def _knowledge(view: Dict) -> Tuple[Dict, Dict, Dict, bool]:
    players = view["players"]
    colors = {player["player_id"]: player["color"] for player in players}
    colors[None] = "dummy"
    used = {color: set() for color in colors.values()}
    cash = {player["player_id"]: 15 for player in players}
    scores = dict.fromkeys(cash, 0)
    history = view.get("history", [])
    for result in history:
        for card in result.get("won_cards", []) + result.get("removed_cards", []):
            if card.get("color") in used:
                used[card["color"]].add(_card_value(card))
        for passed in result.get("passes", []):
            if passed["player_id"] in cash:
                cash[passed["player_id"]] += passed["reward"]
        winner = result.get("winner")
        if winner in cash:
            cash[winner] -= result.get("paid", 0)
            scores[winner] += sum(card.get("value", 0) for card in result.get("won_cards", [])
                                  if card.get("kind") == "cat")
    for passed in view.get("round_passes", []):
        if passed["player_id"] in cash:
            cash[passed["player_id"]] += passed["reward"]
    completed_rounds = {result.get("round") for result in history}
    complete_history = all(
        {passed["player_id"] for passed in result.get("passes", [])}
        == set(cash) - ({result["winner"]} if result.get("winner") in cash else set())
        for result in history
    )
    passed_players = {player["player_id"] for player in players if player.get("passed")}
    recorded_passes = {passed["player_id"] for passed in view.get("round_passes", [])}
    complete = (completed_rounds == set(range(1, view.get("round", 1)))
                and complete_history and passed_players == recorded_passes)
    own = next(player for player in players if player["player_id"] == view["you"])
    if not complete:
        total_mice = 15 * len(players) + {3: 21, 4: 27, 5: 33}[len(players)]
        opponents_mice = total_mice - view.get("bank_mice", 0) - own["mice"]
        opponents_mice -= sum(card.get("mice", 0) for card in view.get("mouse_cards", []))
        for player in players:
            cash[player["player_id"]] = max(player.get("round_bid", 0), round(opponents_mice / (len(players) - 1)))
    cash[view["you"]] = own["mice"]
    pools = {owner: tuple(value for value in CARD_VALUES if value not in used[color]) or CARD_VALUES
             for owner, color in colors.items()}
    return pools, cash, scores, complete


def _owners(view: Dict) -> List[Optional[str]]:
    if view["phase"] != "choose_card":
        return [slot.get("player_id") for slot in view.get("table_slots", [])]
    order = list(view.get("turn_order") or [player["player_id"] for player in view["players"]])
    start = order.index(view["start_player"])
    order = order[start:] + order[:start]
    return ([None] if len(order) == 3 else []) + order


def _known_pools(view: Dict, owners: List[Optional[str]], pools: Dict) -> List[Tuple[int, ...]]:
    visible = {slot.get("player_id"): slot["card"] for slot in view.get("table_slots", [])
               if slot.get("face_up") and slot.get("card")}
    if view.get("your_chosen_card"):
        visible[view["you"]] = view["your_chosen_card"]
    return [(_card_value(visible[owner]),) if owner in visible else pools[owner] for owner in owners]


def _rewards(view: Dict) -> List[int]:
    return [int(card["mice"]) for card in sorted(view.get("mouse_cards", []), key=lambda card: card["value"])
            if card.get("mice", 0) > 0]


def _spend_cost(cash: int, amount: int, round_number: int) -> float:
    scarcity = max(0, 8 - cash + amount) - max(0, 8 - cash)
    return amount + 0.3 * max(0, 9 - round_number) / 8 * scarcity


def _bid_limit(mean: float, deviation: float, cash: int, round_number: int,
               reward: int, active_count: int) -> int:
    value = mean - (0.18 + 0.04 * max(0, active_count - 2)) * deviation - reward
    limit = max(0, min(cash, math.floor(value + 1e-9)))
    while limit and _spend_cost(cash, limit, round_number) > value + 1e-9:
        limit -= 1
    return limit


def _utility(cash: Dict, scores: Dict, own: str, round_number: int, complete: bool) -> float:
    totals = {owner: cash[owner] + score for owner, score in scores.items()}
    opponents = [owner for owner in totals if owner != own]
    if round_number == 9 and complete:
        ranking = {owner: (totals[owner], scores[owner]) for owner in totals}
        best = max(ranking.values())
        winners = [owner for owner in ranking if ranking[owner] == best]
        win_credit = 1 / len(winners) if own in winners else 0.0
        beaten = sum(ranking[own] > ranking[owner] for owner in opponents)
        return 100 * win_credit + beaten / len(opponents) + 0.001 * (totals[own] - max(totals[owner] for owner in opponents))
    liquidity = 0.3 * max(0, 9 - round_number) / 8 * min(8, cash[own])
    return totals[own] - sum(totals[owner] for owner in opponents) / len(opponents) + liquidity


def _rollout(view: Dict, owners: List[Optional[str]], pools: Dict, world: Tuple[int, ...],
             balances: Dict, scores: Dict, complete: bool) -> float:
    cash = dict(balances)
    cats = dict(scores)
    active = [owner for owner in owners if owner is not None]
    positions = {owner: index for index, owner in enumerate(owners)}
    rewards = _rewards(view)
    revealed = 1
    reward_index = 0
    turn_index = 0
    current_bid = 0
    bids = dict.fromkeys(active, 0)
    limits = {}
    round_number = view["round"]
    while len(active) > 1:
        owner = active[turn_index]
        reward = rewards[reward_index] if reward_index < len(rewards) else 0
        if owner not in limits:
            information = [(world[index],) if index < revealed or index == positions[owner] else pools[other]
                           for index, other in enumerate(owners)]
            mean, deviation = _bag_statistics(information)
            limits[owner] = _bid_limit(mean, deviation, cash[owner], round_number, reward, len(active))
        if current_bid + 1 <= limits[owner]:
            current_bid += 1
            bids[owner] = current_bid
            turn_index = (turn_index + 1) % len(active)
        else:
            cash[owner] += reward
            reward_index += 1
            active.pop(turn_index)
            revealed += 1
            limits = {}
            turn_index %= len(active)
    winner = active[0]
    value = _sack_score(world)
    if current_bid:
        cash[winner] -= bids[winner]
        cats[winner] += value
    else:
        reward = rewards[reward_index] if reward_index < len(rewards) else 0
        if cash[winner] >= 1 and value - reward >= _spend_cost(cash[winner], 1, round_number):
            cash[winner] -= 1
            cats[winner] += value
        else:
            cash[winner] += reward
    return _utility(cash, cats, view["you"], round_number, complete)


def _choose_card(view: Dict, pools: Dict, cash: Dict, scores: Dict, complete: bool) -> Dict:
    hand = view["your_hand"]
    if len(hand) == 1:
        return {"type": "choose_card", "card_id": hand[0]["id"]}
    owners = _owners(view)
    own_index = owners.index(view["you"])
    seed_data = {key: view.get(key) for key in ("you", "round", "start_player", "your_hand", "history")}
    seed = hashlib.sha256(json.dumps(seed_data, sort_keys=True).encode()).digest()
    source = random.Random(int.from_bytes(seed[:8], "big"))
    samples = []
    for owner in owners:
        pool = pools[owner]
        column = list(pool) * (CHOICE_SAMPLES // len(pool))
        column.extend(source.sample(pool, CHOICE_SAMPLES % len(pool)))
        source.shuffle(column)
        samples.append(column)
    worlds = list(zip(*samples))

    def evaluate(card: Dict) -> Tuple[float, int, str]:
        value = _card_value(card)
        total = 0.0
        for world in worlds:
            selected = world[:own_index] + (value,) + world[own_index + 1:]
            total += _rollout(view, owners, pools, selected, cash, scores, complete)
        return total / len(worlds), -max(0, int(card.get("value") or 0)), card["id"]

    chosen = max(hand, key=evaluate)
    return {"type": "choose_card", "card_id": chosen["id"]}


def _last_round_bid(view: Dict, information: List[Tuple[int, ...]], cash: Dict, scores: Dict, reward: int) -> bool:
    own = view["you"]
    opponent = next(owner for owner in view["active_players"] if owner != own)
    opponent_bid = next(player["round_bid"] for player in view["players"] if player["player_id"] == opponent)
    amount = view["current_bid"] + 1
    improvement = 0.0
    for world in itertools.product(*information):
        value = _sack_score(world)
        bid_cash, bid_scores = dict(cash), dict(scores)
        bid_cash[own] -= amount
        bid_cash[opponent] += reward
        bid_scores[own] += value
        pass_cash, pass_scores = dict(cash), dict(scores)
        pass_cash[own] += reward
        if view["current_bid"] or (cash[opponent] >= 1 and value >= 1):
            pass_cash[opponent] -= opponent_bid if view["current_bid"] else 1
            pass_scores[opponent] += value
        improvement += _utility(bid_cash, bid_scores, own, 9, True) - _utility(pass_cash, pass_scores, own, 9, True)
    return improvement > 1e-9


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if view.get("game_over") or not legal:
        return None
    if "next_round" in legal:
        return {"type": "next_round"}
    if "choose_card" in legal and not view.get("your_hand"):
        return None
    if "choose_card" not in legal and "bid" not in legal and "buy_for_one" not in legal:
        return {"type": "pass"} if "pass" in legal else None
    pools, cash, scores, complete = _knowledge(view)
    if "choose_card" in legal:
        return _choose_card(view, pools, cash, scores, complete)
    information = _known_pools(view, _owners(view), pools)
    mean, deviation = _bag_statistics(information)
    rewards = _rewards(view)
    reward = rewards[0] if rewards else 0
    if "buy_for_one" in legal:
        profitable = mean - reward >= _spend_cost(cash[view["you"]], 1, view["round"])
        return {"type": "buy_for_one" if profitable else "pass"}
    if view["round"] == 9 and len(view["active_players"]) == 2 and complete:
        bid = _last_round_bid(view, information, cash, scores, reward)
    else:
        limit = _bid_limit(mean, deviation, cash[view["you"]], view["round"], reward, len(view["active_players"]))
        bid = view["current_bid"] < limit
    return {"type": "bid", "amount": view["current_bid"] + 1} if bid else {"type": "pass"}
