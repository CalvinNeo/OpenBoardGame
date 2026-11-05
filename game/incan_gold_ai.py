import hashlib
import json
import math
import random
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Tuple


ROLLOUTS = 256


@dataclass(frozen=True)
class Position:
    deck: Tuple[int, ...]
    seen: Tuple[int, ...]
    remainders: Tuple[int, ...]
    artifacts: int
    artifact_value: int
    hands: Tuple[int, ...]
    scores: Tuple[int, ...]
    artifact_counts: Tuple[int, ...]
    active: Tuple[int, ...]
    hero: int
    rounds_left: int


def _leave_distribution(probabilities: List[float]) -> List[float]:
    distribution = [1.0]
    for probability in probabilities:
        updated = [0.0] * (len(distribution) + 1)
        for count, weight in enumerate(distribution):
            updated[count] += weight * (1.0 - probability)
            updated[count + 1] += weight * probability
        distribution = updated
    return distribution


def _position(view: Dict, treasure_values: List[int], hazard_types: List[str]) -> Position:
    remaining = Counter(treasure_values)
    for card in view["path"]:
        if card["type"] == "treasure":
            remaining[card["value"]] -= 1
    deck = [value for value, count in sorted(remaining.items()) for _ in range(max(0, count))]
    seen = tuple(view["hazard_counts"].get(hazard, 0) for hazard in hazard_types)
    for index, hazard in enumerate(hazard_types):
        deck.extend([-(index + 1)] * max(0, 3 - view["removed_hazards"].get(hazard, 0) - seen[index]))
    deck.extend([0] * max(0, view["deck_count"] - len(deck)))
    players = view["players"]
    return Position(
        tuple(deck), seen,
        tuple(card.get("remainder", 0) for card in view["path"] if card["type"] == "treasure"),
        sum(card["value"] for card in view["path"] if card["type"] == "artifact"),
        5 if view["round"] <= 3 else 10,
        tuple(player["hand_gems"] for player in players),
        tuple(player["banked_gems"] + player["artifact_points"] for player in players),
        tuple(player["artifact_count"] for player in players),
        tuple(index for index, player in enumerate(players) if player["status"] == "in_cave"),
        next(index for index, player in enumerate(players) if player["player_id"] == view["you"]),
        max(0, view.get("max_rounds", 5) - view["round"]),
    )


def _utility(scores: List[int], artifact_counts: List[int], hero: int, rounds_left: int) -> float:
    if rounds_left:
        temperature = 8.0 * math.sqrt(rounds_left)
        highest = max(scores)
        chances = [math.exp((score - highest) / temperature) for score in scores]
        return scores[hero] + 12.0 / rounds_left * chances[hero] / sum(chances)
    ranking = [(score, count) for score, count in zip(scores, artifact_counts)]
    best = max(ranking)
    victory = 1.0 / ranking.count(best) if ranking[hero] == best else 0.0
    return 1000.0 * victory + scores[hero] * 0.001


def _probabilities(
    active: List[int], hands: List[int], scores: List[int], artifact_counts: List[int],
    remainders: List[int], artifacts: int, gain: float, bust: float,
    profiles: List[float], rounds_left: int,
) -> Dict[int, float]:
    population = len(active)
    loot = sum(remainders) / population + artifacts / population
    probabilities = {}
    for player in active:
        if hands[player] + sum(remainders) + artifacts == 0:
            probabilities[player] = 0.0
            continue
        if population == 1:
            incentive = bust * (hands[player] + loot) - gain
        else:
            incentive = bust * (hands[player] + loot) + 0.5 * loot - profiles[player] * gain
        if rounds_left == 0:
            opponents = [index for index in range(len(scores)) if index != player]
            best_banked = max((scores[index], artifact_counts[index]) for index in opponents)
            best_return = (scores[player] + hands[player] + sum(remainders) + artifacts,
                           artifact_counts[player] + int(artifacts > 0))
            if best_return < best_banked:
                probabilities[player] = 0.0
                continue
            if population == 1 and (scores[player] + hands[player] + int(loot), best_return[1]) > best_banked:
                probabilities[player] = 1.0
                continue
        scale = max(0.4, 0.6 * gain)
        probabilities[player] = 1.0 / (1.0 + math.exp(-max(-25.0, min(25.0, incentive / scale))))
    return probabilities


def _rollout(position: Position, deck: List[int], choices: List[List[float]], profiles: List[float], leave: bool) -> float:
    hands = list(position.hands)
    scores = list(position.scores)
    artifact_counts = list(position.artifact_counts)
    active = list(position.active)
    seen = list(position.seen)
    leftovers = list(position.remainders)
    artifacts = position.artifacts
    hazard_counts = [deck.count(-index - 1) for index in range(len(seen))]
    gains = [0] + [sum(card // count for card in deck if card > 0) for count in range(1, len(hands) + 1)]

    for step in range(len(deck) + 1):
        remaining = len(deck) - step
        if not active or not remaining:
            for player in active:
                scores[player] += hands[player]
            break
        population = len(active)
        danger = sum(count for count, revealed in zip(hazard_counts, seen) if revealed)
        gain = gains[population] / remaining
        if population == 1:
            gain += deck[step:].count(0) * position.artifact_value / remaining
        probabilities = _probabilities(active, hands, scores, artifact_counts, leftovers, artifacts,
                                       gain, danger / remaining, profiles, position.rounds_left)
        leaving = [player for player in active if
                   (leave if step == 0 and player == position.hero else choices[step][player] < probabilities[player])]
        if leaving:
            share = sum(value // len(leaving) for value in leftovers)
            leftovers = [value % len(leaving) for value in leftovers]
            for player in leaving:
                scores[player] += hands[player] + share
                if len(leaving) == 1 and artifacts:
                    scores[player] += artifacts
                    artifact_counts[player] += 1
            artifacts = 0
            active = [player for player in active if player not in leaving]
        if not active:
            break
        card = deck[step]
        if card < 0:
            hazard = -card - 1
            hazard_counts[hazard] -= 1
            if seen[hazard]:
                break
            seen[hazard] += 1
        elif card == 0:
            artifacts += position.artifact_value
        else:
            share, remainder = divmod(card, len(active))
            for player in active:
                hands[player] += share
            leftovers.append(remainder)
            for count in range(1, len(gains)):
                gains[count] -= card // count
    return _utility(scores, artifact_counts, position.hero, position.rounds_left)


def choose_decision(view: Dict, treasure_values: List[int], hazard_types: List[str]) -> str:
    position = _position(view, treasure_values, hazard_types)
    if position.rounds_left == 0 and len(position.active) == 1:
        hero = position.hero
        guaranteed = (position.scores[hero] + position.hands[hero] + sum(position.remainders) + position.artifacts,
                      position.artifact_counts[hero] + int(position.artifacts > 0))
        opponents = [(score, count) for index, (score, count) in
                     enumerate(zip(position.scores, position.artifact_counts)) if index != hero]
        if guaranteed > max(opponents):
            return "leave"
    seed_data = (position.deck, position.seen, position.remainders, position.artifacts,
                 position.hands, position.scores, position.artifact_counts, position.active,
                 view["round"], view["you"])
    seed = int.from_bytes(hashlib.sha256(json.dumps(seed_data).encode()).digest()[:8], "big")
    source = random.Random(seed)
    leave_total = 0.0
    continue_total = 0.0
    for _ in range(ROLLOUTS):
        deck = list(position.deck)
        source.shuffle(deck)
        choices = [[source.random() for _ in position.hands] for _ in deck]
        profiles = [source.choice((0.75, 1.0, 1.5, 2.0)) for _ in position.hands]
        profiles[position.hero] = 1.2
        leave_total += _rollout(position, deck, choices, profiles, True)
        continue_total += _rollout(position, deck, choices, profiles, False)
    return "leave" if leave_total > continue_total + 1e-9 else "continue"
