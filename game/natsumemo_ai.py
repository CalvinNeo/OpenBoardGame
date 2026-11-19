"""Risk-aware summer planning using only the acting player's public view."""

from functools import lru_cache
from itertools import product
from typing import Dict, Optional, Tuple
import random

from game.natsumemo_data import activity_reward, homework_reward


def _die_value(value: int, probabilities: Tuple[float, ...], count: int, values: Tuple[int, ...]) -> float:
    lower = sum(probabilities[:value - 1]) ** (count - 1)
    highest = sum(probabilities[:value]) ** (count - 1)
    return lower * values[0] + (highest - lower) * values[1] + (1 - highest) * values[2]


@lru_cache(maxsize=16)
def _die_strategy(count: int, values: Tuple[int, ...]) -> Tuple[float, ...]:
    weights = [1.0] * 6
    for iteration in range(240):
        probabilities = tuple(weight / sum(weights) for weight in weights)
        utilities = [_die_value(value, probabilities, count, values) for value in range(1, 7)]
        best = max(utilities)
        choices = [index for index, utility in enumerate(utilities) if abs(utility - best) < 1e-9]
        for index in choices:
            weights[index] += 1 / len(choices)
    return tuple(weight / sum(weights) for weight in weights)


@lru_cache(maxsize=256)
def _homework_outcomes(normal_days: int, final_days: int) -> Dict:
    outcomes = {(0, 0): 1.0}
    for week in [1] * normal_days + [4] * final_days:
        updated = {}
        for (pages, mask), probability in outcomes.items():
            for die in range(1, 7):
                reward = homework_reward(week, die)
                title = (2 if week == 4 else 1) if reward["titles"] else 0
                key = (min(30, pages + reward["homework"]), mask | title)
                updated[key] = updated.get(key, 0) + probability / 6
        outcomes = updated
    return outcomes


def _calendar_value(view: Dict, calendar: list, homework: int, titles: set) -> float:
    week = view["week"]
    counts = {1: 0, 4: 0}
    counts[4 if week == 4 else 1] = sum(cell is None for day, cell in enumerate(calendar) if day != 2)
    study_points = 0.0
    if calendar[2] is None:
        companions = sum(player["player_id"] != view["you"] and player["calendar"][week - 1][2] is None
                         for player in view["players"])
        homework += (3 if week == 4 else 2) + (not companions)
        study_points = (2 if week == 4 else 3) + 1.5 if companions else 0
    for future_week in range(week + 1, 5):
        counts[4 if future_week == 4 else 1] += 2
        homework += 3 if future_week == 4 else 2
    expected = study_points + counts[1] * .5 + counts[4] * (5 / 3)
    for (pages, mask), probability in _homework_outcomes(counts[1], counts[4]).items():
        completed = min(30, homework + pages)
        earned = titles | ({"slacker"} if mask & 1 else set()) | ({"super_slacker"} if mask & 2 else set())
        if completed == 30:
            earned = earned | {"prepared"}
        score = -10 * max(0, 25 - completed) + 2 * max(0, completed - 25) + len(earned) ** 2
        expected += probability * score
    return expected


def _plan_value(view: Dict, players: Dict, day: int) -> float:
    card, pid = view["card"], view["you"]
    own, private = players[pid], view["private"]
    calendar = own["calendar"][view["week"] - 1]
    if day not in view["legal_days"]:
        return float("-inf")
    others = [other for other, player in players.items() if other != pid and all(
        cell is None for cell in player["calendar"][view["week"] - 1][day:day + card["days"]])]
    before = _calendar_value(view, calendar, private["homework"], set(own["titles"]))
    occupied = list(calendar)
    occupied[day:day + card["days"]] = [True] * card["days"]
    expected, after_values = 0.0, {}
    for choices in product((False, True), repeat=len(others)):
        attendees = [pid] + [other for other, attend in zip(others, choices) if attend]
        probability = .65 ** sum(choices) * .35 ** (len(others) - sum(choices))
        reward = activity_reward(card, attendees, pid, players)
        if len(attendees) > 1 and card["mechanic"] in ("roll", "choose"):
            values = tuple(card["values"])
            probabilities = _die_strategy(len(attendees), values) if card["mechanic"] == "choose" else (1 / 6,) * 6
            reward["points"] = sum(chance * _die_value(value, probabilities, len(attendees), values)
                                   for value, chance in enumerate(probabilities, 1))
        key = (reward["homework"], tuple(reward["titles"]))
        if key not in after_values:
            after_values[key] = _calendar_value(view, occupied, private["homework"] + reward["homework"],
                                                 set(own["titles"]) | set(reward["titles"]))
        expected += probability * (reward["points"] + 1.5 * reward["hearts"] + after_values[key] - before)
    opportunity = max(0, 5 - view["event_number"]) * .35 * card["days"]
    return expected - opportunity


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view["legal_actions"]
    if not legal:
        return None
    kind = legal[0]
    action = {"type": kind, "game_token": view["game_token"], "step": view["step"]}
    players = {p["player_id"]: p for p in view["players"]}
    own = players[view["you"]]
    if kind == "choose_role":
        action["role"] = own["role"] if own["role"] in view["role_choices"] else view["role_choices"][0]
    elif kind == "propose":
        action["day"] = max(view["legal_days"], key=lambda day: _plan_value(view, players, day))
    elif kind == "respond":
        action["attend"] = _plan_value(view, players, view["proposed_day"]) >= 0
    elif kind == "allocate":
        pending = view["private"]["pending"]
        target = max(pending["recipients"], key=lambda pid: view["private"]["hearts"].get(pid, 0))
        action["hearts"] = {target: pending["amount"]}
    elif kind == "choose_die":
        rng = random.Random(f"{view['game_token']}:{view['step']}:{view['you']}")
        probabilities = _die_strategy(len(view["contest_players"]), tuple(view["card"]["values"]))
        action["value"] = rng.choices(range(1, 7), weights=probabilities)[0]
    return action
