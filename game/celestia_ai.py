from collections import Counter
from functools import lru_cache
from itertools import combinations
from math import comb, exp
from typing import Dict, List, Optional, Tuple

from game.celestia import (
    ACTION_CARD_COUNTS,
    CITY_COUNT,
    EQUIPMENT_FOR_HAZARD,
    HAZARD_ORDER,
    TREASURE_VALUES_BY_CITY,
    _required_dice_for_destination,
)


EQUIPMENT = tuple(EQUIPMENT_FOR_HAZARD[hazard] for hazard in HAZARD_ORDER)
RESERVE_VALUES = {
    "equipment": 0.45,
    "turbo": 1.5,
    "telescope": 2.75,
    "jetpack": 2.5,
    "alternative_route": 1.1,
    "ejection": 1.0,
    "wind_gust": 0.65,
}


@lru_cache(maxsize=5)
def _dice_outcomes(count: int) -> Tuple:
    outcomes = {(0, 0, 0, 0): 1.0}
    for _ in range(count):
        following = Counter()
        for hazards, probability in outcomes.items():
            following[hazards] += probability / 3
            for index in range(len(HAZARD_ORDER)):
                changed = list(hazards)
                changed[index] += 1
                following[tuple(changed)] += probability / 6
        outcomes = following
    return tuple(outcomes.items())


@lru_cache(maxsize=4096)
def _cover_probability(hazards: Tuple[int, ...], hand_size: int, population: Tuple[int, ...]) -> float:
    if not any(hazards):
        return 1.0
    total = sum(population)
    hand_size = min(max(0, hand_size), total)
    if hand_size < sum(hazards):
        return 0.0
    turbo_count = population[4]
    other_count = total - turbo_count
    possibilities = {(0, 0): 1}
    for need, available in zip(hazards, population):
        if not need:
            continue
        other_count -= available
        following = Counter()
        for (drawn, missing), weight in possibilities.items():
            for taken in range(min(available, hand_size - drawn) + 1):
                deficit = missing + max(0, need - taken)
                if deficit <= turbo_count:
                    following[drawn + taken, deficit] += weight * comb(available, taken)
        possibilities = following
    covered = 0
    for (drawn, missing), weight in possibilities.items():
        remaining = hand_size - drawn
        for turbos in range(missing, min(turbo_count, remaining) + 1):
            ordinary = remaining - turbos
            if ordinary <= other_count:
                covered += weight * comb(turbo_count, turbos) * comb(other_count, ordinary)
    return covered / comb(total, hand_size)


def _payment(hand: Tuple[int, ...], hazards: Tuple[int, ...]) -> Optional[Tuple[Tuple[int, ...], float]]:
    remaining = list(hand)
    cost = 0.0
    for index, need in enumerate(hazards):
        ordinary = min(remaining[index], need)
        remaining[index] -= ordinary
        remaining[4] -= need - ordinary
        cost += ordinary * RESERVE_VALUES["equipment"] + (need - ordinary) * RESERVE_VALUES["turbo"]
    return (tuple(remaining), cost) if remaining[4] >= 0 else None


class _Planner:
    def __init__(self, view: Dict):
        self.view = view
        self.you = view["you"]
        self.city = view["current_city"]
        self.captain = view["captain"]
        self.ship = tuple(view["ship_order"])
        self.players = {player["player_id"]: player for player in view["players"]}
        self.cards = Counter(card["kind"] for card in view["your_hand"])
        self.hand = tuple(self.cards[kind] for kind in EQUIPMENT + ("turbo",))
        self.telescopes = sum(card["kind"] == "telescope" for card in view["your_treasures"])
        self.target = view.get("config", {}).get("target_score", 50)
        self.hazards = tuple(view["hazard_counts"].get(hazard, 0) for hazard in HAZARD_ORDER)
        self.pool = {kind: max(0, count - self.cards[kind]) for kind, count in ACTION_CARD_COUNTS.items()}
        self.population = tuple(self.pool[kind] for kind in EQUIPMENT + ("turbo",)) + (
            sum(self.pool[kind] for kind in ("jetpack", "ejection", "alternative_route", "wind_gust")),
        )
        drawn_points = sum(
            (len(values) - self._remaining(city)) * sum(values) / len(values)
            for city, values in TREASURE_VALUES_BY_CITY.items()
        )
        other_count = sum(player["treasure_count"] for player in view["players"] if player["player_id"] != self.you)
        average = max(0, drawn_points - view["your_score"]) / max(1, other_count)
        self.scores = {
            player_id: view["your_score"] if player_id == self.you else player["treasure_count"] * average
            for player_id, player in self.players.items()
        }
        highest = max(self.scores.values())
        weights = {player_id: exp((score - highest) / 10) for player_id, score in self.scores.items() if player_id != self.you}
        self.weights = {player_id: 0.6 * weight / sum(weights.values()) for player_id, weight in weights.items()}
        self.reserve_scale = 0.15 if highest >= self.target else 1.0
        self.future_values: Dict = {}
        self.rewards: Dict = {}

    def _remaining(self, city: int) -> int:
        return self.view["treasure_counts"].get(str(city), 0)

    def _cost(self, kind: str) -> float:
        return RESERVE_VALUES[kind] * self.reserve_scale

    def _reward(self, city: int, player_id: str, ship: Tuple[str, ...] = ()) -> float:
        if not self._remaining(city):
            return 0.0
        if city == CITY_COUNT and ship and ship.index(player_id) >= self._remaining(city):
            return 0.0
        key = city, player_id
        if key not in self.rewards:
            values = list(TREASURE_VALUES_BY_CITY[city])
            for card in self.view["your_treasures"]:
                if card["city"] == city and card["points"] in values:
                    values.remove(card["points"])
            if not values:
                self.rewards[key] = 0.0
            else:
                rival_score = max((score for rival, score in self.scores.items() if rival != player_id), default=0)
                total = 0.0
                for points in values:
                    total += points if points else self._cost("telescope")
                    if points and self.scores[player_id] + points >= max(self.target, rival_score):
                        total += 4 * self.target
                self.rewards[key] = total / len(values)
        return self.rewards[key]

    def _success(self, captain: str, hazards: Tuple[int, ...], hand: Tuple[int, ...], telescopes: int) -> float:
        if captain == self.you:
            return float(_payment(hand, hazards) is not None or telescopes > 0)
        player = self.players[captain]
        covered = _cover_probability(hazards, player["hand_count"], self.population)
        telescope_chance = 1 - (1 - 9 / sum(map(len, TREASURE_VALUES_BY_CITY.values()))) ** player["treasure_count"]
        return covered + (1 - covered) * telescope_chance

    def _crash_reward(self, city: int, player_id: str) -> float:
        reward = max(0.0, self._reward(city, player_id) - self._cost("jetpack"))
        if player_id == self.you:
            return reward if self.cards["jetpack"] else 0.0
        total = sum(self.population)
        hand_size = min(self.players[player_id]["hand_count"], total)
        without = total - self.pool["jetpack"]
        chance = 1 - comb(without, hand_size) / comb(total, hand_size) if hand_size <= without else 1.0
        return reward * chance

    def _options(self, hand: Tuple[int, ...], hazards: Tuple[int, ...], telescopes: int) -> List[Tuple]:
        normal = all(available >= need for available, need in zip(hand, hazards))
        options = []
        payment = _payment(hand, hazards)
        if payment is not None:
            remaining, cost = payment
            options.append(("cards", remaining, telescopes, cost * self.reserve_scale))
        if telescopes and not normal:
            options.append(("telescope", hand, telescopes - 1, self._cost("telescope")))
        return options

    def _arrival(self, city: int, captain: str, ship: Tuple[str, ...], hand: Tuple[int, ...], telescopes: int, depth: int) -> float:
        next_captain = ship[(ship.index(captain) + 1) % len(ship)]
        return self._future(city + 1, next_captain, ship, hand, telescopes, depth)

    def _leg(self, city: int, captain: str, ship: Tuple[str, ...], hazards: Tuple[int, ...], hand: Tuple[int, ...], telescopes: int, depth: int) -> float:
        crash = self._crash_reward(city, self.you)
        if captain != self.you:
            success = self._success(captain, hazards, hand, telescopes)
            return success * self._arrival(city, captain, ship, hand, telescopes, depth) + (1 - success) * crash
        values = [
            self._arrival(city, captain, ship, remaining, remaining_telescopes, depth) - cost
            for _, remaining, remaining_telescopes, cost in self._options(hand, hazards, telescopes)
        ]
        if not all(available >= need for available, need in zip(hand, hazards)):
            values.append(crash)
        return max(values)

    def _future(self, city: int, captain: str, ship: Tuple[str, ...], hand: Tuple[int, ...], telescopes: int, depth: int) -> float:
        bank = self._reward(city, self.you, ship)
        if city >= CITY_COUNT or depth <= 0:
            return bank
        key = city, captain, ship, hand, telescopes, depth
        if key not in self.future_values:
            expected = 0.0
            for hazards, probability in _dice_outcomes(_required_dice_for_destination(city + 1)):
                value = self._leg(city, captain, ship, hazards, hand, telescopes, depth - 1)
                expected += probability * (max(bank, value) if captain != self.you else value)
            self.future_values[key] = max(bank, expected) if len(ship) == 1 else expected
        return self.future_values[key]

    def _rivals(self, ship: Tuple[str, ...], success: float, before_choices: bool) -> float:
        total = 0.0
        for player_id in ship:
            if player_id == self.you:
                continue
            value = success * self._reward(self.city + 1, player_id, ship) + (1 - success) * self._crash_reward(self.city, player_id)
            if before_choices and player_id != self.captain:
                value = max(value, self._reward(self.city, player_id))
            total += self.weights[player_id] * value
        return total

    def _leg_score(self, hazards: Tuple[int, ...], ship: Tuple[str, ...], before_choices: bool) -> float:
        if self.captain == self.you:
            values = [
                self._arrival(self.city, self.captain, ship, hand, telescopes, 1) - cost
                - self._rivals(ship, 1.0, before_choices)
                for _, hand, telescopes, cost in self._options(self.hand, hazards, self.telescopes)
            ]
            if not all(available >= need for available, need in zip(self.hand, hazards)):
                values.append(self._crash_reward(self.city, self.you) - self._rivals(ship, 0.0, before_choices))
            return max(values)
        value = 0.0
        if self.you in ship:
            value = self._leg(self.city, self.captain, ship, hazards, self.hand, self.telescopes, 1)
            if before_choices and self.captain != self.you:
                value = max(value, self._reward(self.city, self.you))
        success = self._success(self.captain, hazards, self.hand, self.telescopes)
        return value - self._rivals(ship, success, before_choices)

    def _power(self, kind: str, **payload) -> Dict:
        card = next(card for card in self.view["your_hand"] if card["kind"] == kind)
        return {"type": "play_power", "card_id": card["id"], **payload}

    def reroll(self) -> Dict:
        best_action = {"type": "pass_special"}
        best_value = self._leg_score(self.hazards, self.ship, True)
        candidates = []
        dice = self.view["dice_results"]
        if self.captain == self.you and self.cards["alternative_route"]:
            indexes = [index for index, face in enumerate(dice) if face != "blank"]
            for count in range(1, len(indexes) + 1):
                candidates.extend(("alternative_route", selected) for selected in combinations(indexes, count))
        if self.cards["wind_gust"] and "blank" in dice:
            candidates.append(("wind_gust", tuple(index for index, face in enumerate(dice) if face == "blank")))
        values = {}
        for kind, selected in candidates:
            kept = Counter(face for index, face in enumerate(dice) if index not in selected)
            value = -self._cost(kind)
            for rolled, probability in _dice_outcomes(len(selected)):
                hazards = tuple(kept[hazard] + rolled[index] for index, hazard in enumerate(HAZARD_ORDER))
                if hazards not in values:
                    values[hazards] = self._leg_score(hazards, self.ship, True)
                value += probability * values[hazards]
            if value > best_value + 1e-9:
                best_value = value
                payload = {"dice_indexes": list(selected)} if kind == "alternative_route" else {}
                best_action = self._power(kind, **payload)
        return best_action

    def eject(self) -> Dict:
        best_action = {"type": "pass_special"}
        best_value = self._leg_score(self.hazards, self.ship, False)
        for target in self.ship:
            if target == self.captain:
                continue
            ship = tuple(player_id for player_id in self.ship if player_id != target)
            value = self._leg_score(self.hazards, ship, False) - self._cost("ejection")
            reward = self._reward(self.city, target)
            value += reward if target == self.you else -self.weights[target] * reward
            if value > best_value + 1e-9:
                best_value = value
                best_action = self._power("ejection", target_player_id=target)
        return best_action

    def resolve(self) -> Dict:
        candidates = []
        for method, hand, telescopes, cost in self._options(self.hand, self.hazards, self.telescopes):
            value = self._arrival(self.city, self.captain, self.ship, hand, telescopes, 1) - cost
            value -= self._rivals(self.ship, 1.0, False)
            action = {"type": "captain_resolve", "method": method}
            if method == "telescope":
                action["treasure_id"] = next(card["id"] for card in self.view["your_treasures"] if card["kind"] == "telescope")
            candidates.append((value, action))
        if "captain_fail" in self.view["legal_actions"]:
            candidates.append((self._crash_reward(self.city, self.you) - self._rivals(self.ship, 0.0, False), {"type": "captain_fail"}))
        return max(candidates, key=lambda candidate: candidate[0])[1]


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if not legal or view.get("game_over"):
        return None
    phase = view.get("phase")
    if phase == "journey_end":
        return {"type": "next_journey"}
    if phase == "roll" and "solo_leave" not in legal:
        return {"type": "roll_dice"}
    if phase in ("reroll_window", "ejection_window") and view.get("you") in view.get("special_passes", []):
        return None
    planner = _Planner(view)
    if phase == "roll":
        bank = planner._reward(planner.city, planner.you)
        value = sum(
            probability * planner._leg(planner.city, planner.captain, planner.ship, hazards, planner.hand, planner.telescopes, 1)
            for hazards, probability in _dice_outcomes(view["required_dice"])
        )
        return {"type": "solo_leave" if bank > 0 and bank >= value else "roll_dice"}
    if phase == "passenger_choice":
        stay = planner._leg_score(planner.hazards, planner.ship, False)
        ship = tuple(player_id for player_id in planner.ship if player_id != planner.you)
        leave = planner._reward(planner.city, planner.you) + planner._leg_score(planner.hazards, ship, False)
        return {"type": "passenger_choice", "choice": "leave" if leave > stay + 1e-9 else "stay"}
    if phase == "reroll_window":
        return planner.reroll()
    if phase == "ejection_window":
        return planner.eject()
    if phase == "captain_action":
        return planner.resolve()
    if phase == "jetpack_window":
        return {"type": "jetpack_decision", "use": planner._reward(planner.city, planner.you) > planner._cost("jetpack")}
    return None
