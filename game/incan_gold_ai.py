from collections import Counter
from functools import lru_cache
from math import exp
from typing import Dict, List, Tuple


def _leave_distribution(probabilities: List[float]) -> List[float]:
    distribution = [1.0]
    for probability in probabilities:
        updated = [0.0] * (len(distribution) + 1)
        for count, weight in enumerate(distribution):
            updated[count] += weight * (1.0 - probability)
            updated[count + 1] += weight * probability
        distribution = updated
    return distribution


def choose_decision(view: Dict, treasure_values: List[int], hazard_types: List[str]) -> str:
    players = [player for player in view["players"] if player["status"] == "in_cave"]
    explorer = next(player for player in players if player["player_id"] == view["you"])
    treasures = Counter(treasure_values)
    for card in view["path"]:
        if card["type"] == "treasure":
            treasures[card["value"]] -= 1
    values = tuple(sorted(value for value, count in treasures.items() if count > 0))
    counts = tuple(treasures[value] for value in values)
    seen = tuple(view["hazard_counts"].get(hazard, 0) for hazard in hazard_types)
    hazards = tuple(
        max(0, 3 - view["removed_hazards"].get(hazard, 0) - seen[index])
        for index, hazard in enumerate(hazard_types)
    )
    artifact_left = max(0, view["deck_count"] - sum(counts) - sum(hazards))
    artifact_value = 5 if view["round"] <= 3 else 10
    remainders = tuple(card.get("remainder", 0) for card in view["path"] if card["type"] == "treasure")
    artifact_points = sum(card["value"] for card in view["path"] if card["type"] == "artifact")
    population = len(players)
    deck_count = max(1, view["deck_count"])
    bust_probability = sum(count for count, revealed in zip(hazards, seen) if revealed) / deck_count
    treasure_gain = sum(value // population * count for value, count in zip(values, counts)) / deck_count

    probabilities = []
    for player in players:
        if player["player_id"] == view["you"]:
            continue
        payout = player["hand_gems"] + sum(remainders) / population + artifact_points / population
        incentive = bust_probability * payout - treasure_gain
        scale = max(1.0, treasure_gain + 0.5)
        probability = 1.0 / (1.0 + exp(-max(-20.0, min(20.0, incentive / scale))))
        probabilities.append(min(0.95, max(0.05, probability)))
    distribution = _leave_distribution(probabilities)
    average_leave = sum(probabilities) / len(probabilities) if probabilities else 0.0
    hand = explorer["hand_gems"]

    @lru_cache(maxsize=None)
    def return_value(gems: int, leftovers: Tuple[int, ...], artifacts: int, active: int) -> float:
        future_distribution = _leave_distribution([average_leave] * (active - 1))
        return gems + sum(
            weight * (sum(remainder // (leavers + 1) for remainder in leftovers)
                      + (artifacts if leavers == 0 else 0))
            for leavers, weight in enumerate(future_distribution)
        )

    @lru_cache(maxsize=None)
    def explore(
        treasure_counts: Tuple[int, ...], hazard_counts: Tuple[int, ...],
        revealed: Tuple[int, ...], artifacts_left: int, gems: int,
        leftovers: Tuple[int, ...], artifacts: int, active: int, depth: int,
    ) -> float:
        total = sum(treasure_counts) + sum(hazard_counts) + artifacts_left
        if total == 0:
            return float(gems)

        def after_draw(next_treasures, next_hazards, next_seen, next_artifacts, next_gems, next_leftovers, next_points):
            if total == 1:
                return float(next_gems)
            leave = return_value(next_gems, next_leftovers, next_points, active)
            if depth <= 1:
                return leave
            continuation = explore(
                next_treasures, next_hazards, next_seen, next_artifacts, next_gems,
                next_leftovers, next_points, active, depth - 1,
            )
            return max(leave, continuation)

        result = 0.0
        for index, count in enumerate(treasure_counts):
            if count <= 0:
                continue
            remaining = list(treasure_counts)
            remaining[index] -= 1
            value = values[index]
            result += count * after_draw(
                tuple(remaining), hazard_counts, revealed, artifacts_left,
                gems + value // active, leftovers + (value % active,), artifacts,
            )
        for index, count in enumerate(hazard_counts):
            if count <= 0 or revealed[index]:
                continue
            remaining = list(hazard_counts)
            remaining[index] -= 1
            next_seen = list(revealed)
            next_seen[index] += 1
            result += count * after_draw(
                treasure_counts, tuple(remaining), tuple(next_seen), artifacts_left,
                gems, leftovers, artifacts,
            )
        if artifacts_left:
            result += artifacts_left * after_draw(
                treasure_counts, hazard_counts, revealed, artifacts_left - 1,
                gems, leftovers, artifacts + artifact_value,
            )
        return result / total

    leave_value = 0.0
    continue_value = 0.0
    for leavers, weight in enumerate(distribution):
        leave_value += weight * (
            hand + sum(remainder // (leavers + 1) for remainder in remainders)
            + (artifact_points if leavers == 0 else 0)
        )
        leftovers = tuple(remainder % leavers for remainder in remainders) if leavers else remainders
        continue_value += weight * explore(
            counts, hazards, seen, artifact_left, hand, leftovers,
            0 if leavers else artifact_points, population - leavers, 2,
        )
    return "leave" if leave_value > continue_value + 1e-9 else "continue"
