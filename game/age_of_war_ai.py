from functools import lru_cache
from math import factorial
from typing import Dict, List, Optional, Tuple


Line = Tuple[int, int, int, int]
Dice = Tuple[int, ...]


def _line_key(requirements: List[Dict]) -> Line:
    totals = dict.fromkeys(("infantry", "archery", "cavalry", "daimyo"), 0)
    for requirement in requirements:
        kind = requirement["type"]
        totals[kind] += int(requirement.get("sum" if kind == "infantry" else "count", 1))
    return tuple(totals.values())


def _dice_key(pool: List[str]) -> Dice:
    return tuple(pool.count(face) for face in ("I1", "I2", "I3", "A", "C", "D"))


def _cost(line: Line, dice: Dice) -> Optional[int]:
    infantry, archery, cavalry, daimyo = line
    if archery > dice[3] or cavalry > dice[4] or daimyo > dice[5]:
        return None
    used = archery + cavalry + daimyo
    for strength in (3, 2, 1):
        count = min(dice[strength - 1], (max(0, infantry) + strength - 1) // strength)
        infantry -= count * strength
        used += count
    return used if infantry <= 0 else None


@lru_cache(maxsize=8)
def _outcomes(count: int) -> Tuple[Tuple[Dice, float], ...]:
    outcomes = []

    def visit(prefix: Dice, remaining: int) -> None:
        if len(prefix) == 5:
            dice = prefix + (remaining,)
            multiplicity = factorial(count)
            for amount in dice:
                multiplicity //= factorial(amount)
            outcomes.append((dice, multiplicity / (6 ** count)))
            return
        for amount in range(remaining + 1):
            visit(prefix + (amount,), remaining - amount)

    visit((), count)
    return tuple(outcomes)


@lru_cache(maxsize=16384)
def _capture_probability(lines: Tuple[Line, ...], count: int) -> float:
    if not lines:
        return 1.0
    minimum = sum((line[0] + 2) // 3 + sum(line[1:]) for line in lines)
    if count <= 0 or minimum > count:
        return 0.0
    discard = _capture_probability(lines, count - 1)
    continuations = []
    for index, line in enumerate(lines):
        remaining = lines[:index] + lines[index + 1:]
        continuations.append((line, remaining))
    probability = 0.0
    for dice, weight in _outcomes(count):
        best = discard
        for line, remaining in continuations:
            cost = _cost(line, dice)
            if cost is not None:
                best = max(best, _capture_probability(remaining, count - cost))
        probability += weight * best
    return probability


def _best_assignment(lines: List[Dict], filled: List[int], pool: List[str]) -> Tuple[float, Dict]:
    available = [(index, _line_key(line["requirements"])) for index, line in enumerate(lines) if index not in filled]
    keys = tuple(sorted(key for _, key in available))
    count = len(pool)
    best = (_capture_probability(keys, count - 1), 0, -count)
    action = {"type": "discard_die", "die_index": 0}
    dice = _dice_key(pool)
    for index, line in available:
        cost = _cost(line, dice)
        if cost is None:
            continue
        remaining = list(keys)
        remaining.remove(line)
        candidate = (_capture_probability(tuple(remaining), count - cost), 1, -cost)
        if candidate > best:
            best = candidate
            action = {"type": "fill_line", "line_index": index}
    return best[0], action


def _target_value(state: Dict, bot_id: str, castle_id: str, defender_id: Optional[str]) -> float:
    from game.age_of_war import CASTLES, CLANS, _compute_score

    castle = CASTLES[castle_id]
    clan = CLANS[castle["clan"]]
    owned = set(state["players"][bot_id]["castles"])
    clan_castles = set(clan["castle_ids"])
    completes = clan_castles.issubset(owned | {castle_id})
    gain = int(castle["points"])
    if completes:
        gain = int(clan["set_bonus"]) - sum(int(CASTLES[owned_id]["points"]) for owned_id in owned & clan_castles)
    value = gain + 0.35 * len(owned & clan_castles) + (0.5 if completes else 0)
    if defender_id:
        scores = [_compute_score(state, player_id) for player_id in state["players"] if player_id != bot_id]
        leader = _compute_score(state, defender_id) == max(scores, default=0)
        value += int(castle["points"]) * (0.8 if leader else 0.35)
        if not completes:
            value *= 0.45
    elif len(state["central_castles"]) == 1:
        score = _compute_score(state, bot_id) + gain
        rival = max((_compute_score(state, player_id) for player_id in state["players"] if player_id != bot_id), default=0)
        value += 20 if score > rival else 8 if score == rival else -0.9 * value
    return max(0.05, value)


def choose_move(state: Dict, bot_id: str) -> Optional[Dict]:
    from game.age_of_war import _available_targets, _castle_lines

    if state.get("game_over") or bot_id not in state.get("players", {}) or state.get("current_player") != bot_id:
        return None
    phase = state.get("phase")
    if phase == "roll" or (phase == "select_target" and not state.get("dice_pool")):
        return {"type": "roll"}
    if phase == "assign" and state.get("dice_pool"):
        return _best_assignment(state["target_lines"], state.get("filled_lines", []), state["dice_pool"])[1]
    if phase != "select_target":
        return None
    central, opponents = _available_targets(state, bot_id)
    best_value = -1.0
    action = None
    for defender_id, castle_id in [(None, castle_id) for castle_id in central] + opponents:
        lines = _castle_lines(castle_id, defender_id is not None)
        probability, _ = _best_assignment(lines, [], state["dice_pool"])
        value = probability * _target_value(state, bot_id, castle_id, defender_id)
        if value > best_value:
            best_value = value
            action = {"type": "select_target", "target_type": "player" if defender_id else "central", "castle_id": castle_id}
            if defender_id:
                action["defender_id"] = defender_id
    return action
