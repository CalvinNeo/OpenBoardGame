"""Deterministic round rollouts using only the player's public view."""

import hashlib
import math
import random
from typing import Dict, List, Optional


ROLLOUT_SAMPLES = 96


def _solo_count(
    scores: List[int],
    hauls: List[int],
    player: int,
    eels: int,
    snakes: int,
    danger: int,
    winning_score: int,
) -> int:
    """One-at-a-time draws dominate larger hands when nobody else is active."""
    if not eels:
        return 0
    rival_score = max(score for index, score in enumerate(scores) if index != player)
    total_score = scores[player] + hauls[player]
    if total_score >= max(winning_score, rival_score):
        return 0
    if rival_score >= winning_score or danger > 1:
        return 1
    return int(eels > snakes * hauls[player])


def _model_count(
    scores: List[int],
    hauls: List[int],
    active: List[int],
    player: int,
    eels: int,
    snakes: int,
    danger: int,
    maximum: int,
    winning_score: int,
    profile: int,
) -> int:
    if len(active) == 1:
        return _solo_count(scores, hauls, player, eels, snakes, danger, winning_score)
    if not eels:
        return 0
    saved = hauls[player]
    bank_target, opening, followup = ((4, 3, 2), (5, 4, 3), (8, maximum, maximum - 1))[profile]
    rival_score = max(score for index, score in enumerate(scores) if index != player)
    if rival_score >= winning_score and scores[player] + saved < rival_score:
        bank_target = max(bank_target, rival_score - scores[player] + 1)
    if saved >= bank_target or (saved >= 3 and danger <= 2 and rival_score < winning_score):
        return 0
    if danger <= 1:
        return 1
    if snakes / max(1, eels + snakes) >= 0.34:
        return 2
    return min(maximum, opening if not saved else followup)


def _round_value(scores: List[int], exits: List[int], player: int, winning_score: int) -> float:
    highest = max(scores)
    if highest >= winning_score:
        latest = max(exits[index] for index, score in enumerate(scores) if score == highest)
        winners = [index for index, score in enumerate(scores) if score == highest and exits[index] == latest]
        return 1.0 / len(winners) if player in winners else 0.0
    weights = [math.exp((score - highest) / 6.0) for score in scores]
    return weights[player] / sum(weights)


def _rollout(
    initial_scores: List[int],
    initial_hauls: List[int],
    initial_exits: List[int],
    initial_order: List[int],
    initial_bag: List[int],
    initial_danger: int,
    initial_cycle: int,
    player: int,
    count: int,
    maximum: int,
    winning_score: int,
    profiles: List[int],
    seed: int,
) -> float:
    scores = initial_scores.copy()
    hauls = initial_hauls.copy()
    exits = initial_exits.copy()
    order = initial_order.copy()
    bag = initial_bag.copy()
    danger = initial_danger
    cycle = initial_cycle
    rng = random.Random(seed)
    while order:
        snakes = sum(bag)
        eels = len(bag) - snakes
        requests = {
            actor: count if actor == player and cycle == initial_cycle else _model_count(
                scores, hauls, order, actor, eels, snakes, danger, maximum, winning_score, profiles[actor]
            )
            for actor in order
        }
        hands = {}
        drawn_snakes = 0
        for actor in order:
            actual = min(requests[actor], len(bag))
            hand_snakes = sum(bag.pop() for _ in range(actual))
            hands[actor] = (actual, actual - hand_snakes)
            drawn_snakes += hand_snakes
        if drawn_snakes >= danger:
            largest = max(hand[0] for hand in hands.values())
            for actor in order:
                if hands[actor][0] < largest:
                    scores[actor] += hauls[actor] + hands[actor][1]
                exits[actor] = cycle
            break
        danger -= drawn_snakes
        returned = 0
        continuing = []
        for actor in order:
            actual, drawn_eels = hands[actor]
            if actual:
                hauls[actor] += drawn_eels
                continuing.append(actor)
            else:
                scores[actor] += hauls[actor]
                exits[actor] = cycle
                returned += hauls[actor]
                hauls[actor] = 0
        if returned:
            bag.extend([0] * returned)
            rng.shuffle(bag)
        if continuing and continuing[-1] == order[-1]:
            continuing = continuing[-1:] + continuing[:-1]
        order = continuing
        cycle += 1
    return _round_value(scores, exits, player, winning_score)


def choose_action(view: Dict) -> Optional[Dict]:
    if "grab" not in view.get("legal_actions", []):
        return None
    players = view["players"]
    player = next(index for index, item in enumerate(players) if item["player_id"] == view["you"])
    scores = [int(item["score"]) for item in players]
    hauls = [int(item["round_eels"]) for item in players]
    exits = [int(item.get("exit_wave") or 0) for item in players]
    active = [index for index, item in enumerate(players) if item["status"] == "active"]
    position = active.index(player)
    rotated = active[position:] + active[:position]
    order = [index for index in rotated if players[index]["locked"]] + [
        index for index in rotated if not players[index]["locked"]
    ]
    maximum = int(view["grab_max"])
    eels = int(view["bag_eels"])
    snakes = int(view["bag_snakes"])
    danger = int(view["outbreak_threshold"]) - int(view["center_snakes"])
    winning_score = int(view["winning_score"])
    if len(active) == 1:
        chosen = _solo_count(scores, hauls, player, eels, snakes, danger, winning_score)
    elif not eels:
        chosen = 0
    else:
        public_key = (
            view["you"], view["round_no"], view["cycle_no"], scores, hauls, exits, order, eels, snakes, danger
        )
        digest = hashlib.sha256(repr(public_key).encode("utf-8")).digest()
        rng = random.Random(int.from_bytes(digest, "big"))
        candidates = range(min(maximum, eels + snakes) + 1)
        values = [0.0 for _ in candidates]
        for _ in range(ROLLOUT_SAMPLES):
            bag = [0] * eels + [1] * snakes
            rng.shuffle(bag)
            profiles = [rng.randrange(3) for _ in players]
            rollout_seed = rng.getrandbits(64)
            for count in candidates:
                values[count] += _rollout(
                    scores, hauls, exits, order, bag, danger, int(view["cycle_no"]), player, count,
                    maximum, winning_score, profiles, rollout_seed,
                )
        chosen = max(candidates, key=lambda count: values[count])
    return {"type": "grab", "count": chosen, "cycle_no": view["cycle_no"], "delay_ms": 450}
