from collections import Counter, defaultdict
from itertools import combinations, permutations
from typing import Dict, List, Optional, Set, Tuple

from game.in_a_grove import TILE_SPECS, _determine_murderer_index, _final_ranking


TILES_BY_LABEL = {tile["label"]: tile for tile in TILE_SPECS}


def _possible_worlds(view: Dict) -> List[Tuple[Tuple[str, ...], int]]:
    """Enumerate equally likely physical deals using only the player's view."""
    pool = [tile["label"] for tile in TILE_SPECS[:7 + max(0, len(view["players"]) - 3)]]
    labels = [suspect.get("label") for suspect in view["suspects"]]
    known = [tile["label"] for tile in view.get("your_tiles", [])]
    known += [label for label in labels if label is not None]
    if view.get("public_alibi") is not None:
        known.append(view["public_alibi"])
    for label in known:
        if label not in pool:
            return []
        pool.remove(label)
    hidden_indexes = [index for index, label in enumerate(labels) if label is None]
    worlds = []
    for assignment in permutations(pool, len(hidden_indexes)):
        suspects = list(labels)
        for index, label in zip(hidden_indexes, assignment):
            suspects[index] = label
        murderer = _determine_murderer_index([TILES_BY_LABEL[label] for label in suspects])
        worlds.append((tuple(suspects), murderer))
    return worlds


def _bet_outcome(view: Dict, bet_index: int, murderer_index: int) -> Tuple[int, bool, bool]:
    players = {player["player_id"]: dict(player) for player in view["players"]}
    own = players[view["you"]]
    starting_penalty = own["penalty_count"]
    own["hand_count"] -= 1
    for index, suspect in enumerate(view["suspects"]):
        stack = list(suspect["stack"])
        if index == bet_index:
            stack.append(view["you"])
        if index == murderer_index or not stack:
            continue
        receiver = stack[-1]
        players[receiver]["penalty_count"] += len(stack)
        players[receiver]["own_penalty_count"] = (
            players[receiver].get("own_penalty_count", 0) + stack.count(receiver)
        )
    last_turn = sum(len(suspect["stack"]) for suspect in view["suspects"]) == len(players) - 1
    game_over = last_turn and any(
        player["hand_count"] <= 0 or player["penalty_count"] >= 5 for player in players.values()
    )
    won = False
    if game_over:
        ranking = _final_ranking({
            "players": players,
            "turn_order": list(players),
            "first_player": view["first_player"],
        })
        won = ranking[0]["player_id"] == view["you"]
    return own["penalty_count"] - starting_penalty, game_over, won


def _bet_costs(view: Dict, possible_murderers: Set[int]) -> List[List[Tuple[int, ...]]]:
    outcomes = [
        [_bet_outcome(view, bet_index, murderer_index) for murderer_index in range(3)]
        for bet_index in range(3)
    ]
    guaranteed_end = all(
        outcomes[bet_index][murderer_index][1]
        for bet_index in range(3) for murderer_index in possible_murderers
    )
    return [
        [
            (
                int(not won) if guaranteed_end else penalty,
                penalty,
                penalty * penalty,
                int(bet_index != murderer_index),
            )
            for murderer_index, (penalty, _, won) in enumerate(bet_outcomes)
        ]
        for bet_index, bet_outcomes in enumerate(outcomes)
    ]


def _best_bet(murderer_counts: Dict[int, int], costs: List[List[Tuple[int, ...]]]) -> Tuple[int, Tuple[int, ...]]:
    scores = [
        tuple(
            sum(multiplicity * bet_costs[murderer][metric] for murderer, multiplicity in murderer_counts.items())
            for metric in range(len(bet_costs[0]))
        )
        for bet_costs in costs
    ]
    best_index = min(range(len(scores)), key=lambda index: scores[index])
    return best_index, scores[best_index]


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if view.get("game_over") or not legal:
        return None
    if "next_round" in legal:
        return {"type": "next_round", "delay_ms": 0}
    if view.get("current_turn") != view.get("you"):
        return None
    if "peek_suspects" not in legal and "place_bet" not in legal:
        return None

    worlds = _possible_worlds(view)
    murderer_counts = Counter(murderer for _, murderer in worlds)
    costs = _bet_costs(view, set(murderer_counts)) if worlds else []
    if "place_bet" in legal:
        if worlds:
            bet_index, _ = _best_bet(murderer_counts, costs)
        else:
            bet_index = min(range(3), key=lambda index: len(view["suspects"][index]["stack"]))
        return {"type": "place_bet", "suspect_index": bet_index}

    available = [
        index for index, suspect in enumerate(view["suspects"])
        if not suspect.get("blocked") and index != view.get("blocked_suspect_index")
    ]
    count = view.get("peek_count", 2)
    choices = list(combinations(available, count))
    if not choices:
        return None
    best_choice = choices[0]
    best_score = None
    for choice in choices:
        observations = defaultdict(Counter)
        for labels, murderer in worlds:
            observations[tuple(labels[index] for index in choice)][murderer] += 1
        score = [0] * 4
        for counts in observations.values():
            _, observation_score = _best_bet(counts, costs)
            score = [total + value for total, value in zip(score, observation_score)]
        if best_score is None or tuple(score) < best_score:
            best_choice = choice
            best_score = tuple(score)
    return {"type": "peek_suspects", "suspect_indexes": list(best_choice)}
