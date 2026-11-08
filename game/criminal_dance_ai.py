"""Deduction and card selection using only the acting player's visible view."""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from game.criminal_dance import (
    BASE_CARD_COUNTS,
    CARD_ACCOMPLICE,
    CARD_ALIBI,
    CARD_CHIEF,
    CARD_CIVILIAN,
    CARD_CRIMINAL,
    CARD_DETECTIVE,
    CARD_DOG,
    CARD_INFO_CONTROL,
    CARD_RUMOR,
    CARD_TRADE,
    CARD_WITNESS,
    _detective_is_active,
)


MOVEMENT_CARDS = {CARD_INFO_CONTROL, CARD_RUMOR, CARD_TRADE}
TARGETED_CARDS = {CARD_DETECTIVE, CARD_DOG, CARD_WITNESS, CARD_TRADE, CARD_CHIEF}


@dataclass
class Knowledge:
    criminal: Dict[str, float]
    hands: Dict[str, Counter] = field(default_factory=dict)
    alibis: Set[str] = field(default_factory=set)


def _normalize(knowledge: Knowledge, counts: Dict[str, int]) -> None:
    for player_id in knowledge.criminal:
        if counts.get(player_id, 0) <= 0 or (
            player_id in knowledge.hands and not knowledge.hands[player_id][CARD_CRIMINAL]
        ):
            knowledge.criminal[player_id] = 0.0
    total = sum(knowledge.criminal.values())
    if total <= 0:
        knowledge.criminal = {
            player_id: float(counts.get(player_id, 0))
            if player_id not in knowledge.hands or knowledge.hands[player_id][CARD_CRIMINAL] else 0.0
            for player_id in knowledge.criminal
        }
        total = sum(knowledge.criminal.values())
    if total:
        knowledge.criminal = {player_id: weight / total for player_id, weight in knowledge.criminal.items()}


def _observe(knowledge: Knowledge, clues: List[Dict], counts: Dict[str, int]) -> None:
    for clue in clues:
        holder = clue.get("criminal_holder_player_id")
        target = clue.get("target_player_id")
        if target in knowledge.criminal and "card_types" in clue:
            hand = Counter(clue["card_types"])
            knowledge.hands[target] = hand
            counts[target] = sum(hand.values())
            knowledge.alibis.discard(target)
            if hand[CARD_CRIMINAL]:
                holder = target
            else:
                knowledge.criminal[target] = 0.0
        if holder in knowledge.criminal:
            knowledge.criminal = {player_id: float(player_id == holder) for player_id in knowledge.criminal}
    _normalize(knowledge, counts)


def _pass_distribution(
    probabilities: Dict[str, float], counts: Dict[str, int], order: List[str], direction: int
) -> Tuple[Dict[str, float], Dict[str, int]]:
    moved = dict.fromkeys(order, 0.0)
    next_counts = dict(counts)
    for index, player_id in enumerate(order):
        count = counts[player_id]
        if not count:
            continue
        recipient = order[(index + direction) % len(order)]
        transfer = probabilities[player_id] / count
        moved[player_id] += probabilities[player_id] - transfer
        moved[recipient] += transfer
        next_counts[player_id] -= 1
        next_counts[recipient] += 1
    return moved, next_counts


def _replay_play(knowledge: Knowledge, entry: Dict, counts: Dict[str, int], order: List[str], config: Dict) -> None:
    actor = entry["player_id"]
    card_type = entry["card"]["type"]
    target = entry.get("target_player_id")
    counts[actor] = max(0, counts[actor] - 1)
    if actor in knowledge.hands:
        if knowledge.hands[actor][card_type]:
            knowledge.hands[actor][card_type] -= 1
        else:
            knowledge.hands.pop(actor)
    if card_type == CARD_ALIBI:
        knowledge.alibis.discard(actor)
    _normalize(knowledge, counts)

    if card_type in (CARD_INFO_CONTROL, CARD_RUMOR):
        direction = 1 if card_type == CARD_INFO_CONTROL else -1
        knowledge.criminal, moved_counts = _pass_distribution(knowledge.criminal, counts, order, direction)
        counts.update(moved_counts)
        knowledge.hands.clear()
        knowledge.alibis.clear()
    elif card_type == CARD_TRADE and entry.get("trade_completed") is not False:
        if target in counts and counts[actor] and counts[target]:
            outgoing = knowledge.criminal[actor] / counts[actor]
            incoming = knowledge.criminal[target] / counts[target]
            knowledge.criminal[actor] += incoming - outgoing
            knowledge.criminal[target] += outgoing - incoming
            for participant in (actor, target):
                knowledge.hands.pop(participant, None)
                knowledge.alibis.discard(participant)
        elif target is None:
            knowledge.criminal = {player_id: float(counts[player_id]) for player_id in order}
            knowledge.hands.clear()
            knowledge.alibis.clear()
    elif card_type == CARD_DETECTIVE and target in counts:
        result = entry.get("detective_result")
        if result in ("caught", "alibi"):
            knowledge.criminal = {player_id: float(player_id == target) for player_id in order}
            if result == "alibi":
                knowledge.alibis.add(target)
        elif result == "clear":
            knowledge.criminal[target] = 0.0
    elif card_type == CARD_DOG and target in counts:
        revealed = entry.get("dog_reveal")
        if revealed == CARD_CRIMINAL:
            knowledge.criminal = {player_id: float(player_id == target) for player_id in order}
        elif revealed:
            knowledge.criminal[target] *= 1.0 - 1.0 / max(1, counts[target])
            if revealed == CARD_ALIBI:
                knowledge.alibis.add(target)
            if config.get("dog_fail_behavior") == "give_to_target":
                counts[target] += 1
                if target in knowledge.hands:
                    knowledge.hands[target][CARD_DOG] += 1
    _normalize(knowledge, counts)


def infer_knowledge(view: Dict) -> Knowledge:
    players = view["players"]
    order = [player["player_id"] for player in players]
    own = next(player for player in players if player["player_id"] == view["you"])
    current_counts = {player["player_id"]: player["hand_count"] for player in players}
    history = view.get("played", [])
    counts = dict(history[0].get("hand_counts_before", current_counts)) if history else dict(current_counts)
    knowledge = Knowledge({player_id: 1.0 for player_id in order})
    clues_by_turn = defaultdict(list)
    for clue in own.get("private_clues", []):
        clues_by_turn[clue["turn"]].append(clue)
    _observe(knowledge, clues_by_turn[0], counts)
    for turn, entry in enumerate(history, 1):
        counts.update(entry.get("hand_counts_before", {}))
        _replay_play(knowledge, entry, counts, order, view["config"])
        _observe(knowledge, clues_by_turn[turn], counts)
    counts.update(current_counts)
    _observe(knowledge, [{
        "target_player_id": view["you"],
        "card_types": [card["type"] for card in own["hand"]],
    }], counts)
    return knowledge


def _alibi_probability(view: Dict, knowledge: Knowledge, target: str, count: int) -> float:
    if count <= 1:
        return 0.0
    if target in knowledge.hands:
        return float(knowledge.hands[target][CARD_ALIBI] > 0)
    if target in knowledge.alibis:
        return 1.0
    unseen = Counter(BASE_CARD_COUNTS)
    if not view["config"].get("enable_boy", True):
        unseen.pop("boy", None)
    if view["config"].get("enable_chief"):
        unseen[CARD_CHIEF] = 1
    unseen[CARD_CIVILIAN] += max(0, len(view["players"]) * 4 - sum(unseen.values()))
    unseen.subtract(card["type"] for card in view["discard"])
    for hand in knowledge.hands.values():
        unseen.subtract(hand)
    available = sum(max(0, amount) for amount in unseen.values())
    alibis = max(0, unseen[CARD_ALIBI])
    no_alibi = 1.0
    for offset in range(count - 1):
        remaining = max(1, available - 1 - offset)
        no_alibi *= max(0.0, 1.0 - alibis / remaining)
    return 1.0 - no_alibi


def _escape_pressure(probabilities: Dict[str, float], counts: Dict[str, int], viewer: str) -> float:
    return sum(weight for player_id, weight in probabilities.items() if player_id != viewer and counts[player_id] == 1)


def _keep_value(card_type: str, hand: Counter, accomplice: bool) -> float:
    if card_type == CARD_CRIMINAL:
        return 45.0 if not accomplice else 20.0
    if card_type == CARD_ALIBI and hand[CARD_CRIMINAL] and hand[CARD_ALIBI] == 1:
        return 35.0
    if card_type in (CARD_DETECTIVE, CARD_DOG):
        return 2.0 if hand[CARD_CRIMINAL] or accomplice else 18.0
    if card_type == CARD_WITNESS:
        return 8.0
    if card_type == CARD_ACCOMPLICE and not accomplice and not hand[CARD_CRIMINAL]:
        return 12.0
    return 3.0 if card_type in MOVEMENT_CARDS else 0.0


def _trade_score(
    view: Dict, knowledge: Knowledge, own: Dict, counts: Dict[str, int], target: str, given: Optional[Dict]
) -> Tuple[float, Dict[str, float]]:
    probabilities = dict(knowledge.criminal)
    if given is None:
        return 8.0, probabilities
    viewer = view["you"]
    hand = Counter(card["type"] for card in own["hand"])
    accomplice = own["is_accomplice"]
    known = knowledge.hands.get(target)
    incoming_value = (
        sum(_keep_value(card_type, hand, accomplice) * amount for card_type, amount in known.items()) / counts[target]
        if known is not None else 8.0
    )
    score = 6.0 + 0.5 * (incoming_value - _keep_value(given["type"], hand, accomplice))
    if given["type"] == CARD_CRIMINAL:
        probabilities = {player_id: float(player_id == target) for player_id in probabilities}
        score += 30.0 / counts[target] if accomplice else -25.0
    elif hand[CARD_CRIMINAL]:
        score += 12.0
    else:
        incoming = probabilities[target] / counts[target]
        probabilities[target] -= incoming
        probabilities[viewer] = incoming
        score += 45.0 * incoming / max(1, counts[viewer] - 1)
    return score, probabilities


def _score_action(view: Dict, knowledge: Knowledge, own: Dict, card: Dict, target: Optional[str], given: Optional[Dict]) -> float:
    viewer = view["you"]
    counts = {player["player_id"]: player["hand_count"] for player in view["players"]}
    hand = Counter(item["type"] for item in own["hand"])
    remaining = hand.copy()
    remaining[card["type"]] -= 1
    criminal = bool(hand[CARD_CRIMINAL])
    accomplice = own["is_accomplice"]
    ally = criminal or accomplice
    probability = knowledge.criminal.get(target, 0.0)
    probabilities = dict(knowledge.criminal)
    next_counts = dict(counts)
    next_counts[viewer] -= 1
    card_type = card["type"]
    score = 10.0
    if card_type == CARD_CRIMINAL:
        return 1000.0
    if card_type in (CARD_DOG, CARD_WITNESS, CARD_TRADE) and target is None:
        return score
    if card_type == CARD_DETECTIVE:
        if _detective_is_active(view, counts[viewer]):
            success = probability * (1.0 - _alibi_probability(view, knowledge, target, counts[target]))
            score = 12.0 - 100.0 * success if ally else 95.0 * success - 14.0 * (1.0 - success)
            probabilities[target] = max(0.0, probability - success)
        else:
            score = -15.0 if view["config"]["detective_activation_rule"] == "hand_leq_3" else 12.0
    elif card_type == CARD_DOG:
        success = probability / counts[target]
        score = 12.0 - 100.0 * success if ally else 115.0 * success - 16.0 * (1.0 - success)
        probabilities[target] = max(0.0, probability - success)
        if view["config"]["dog_fail_behavior"] == "give_to_target" and criminal:
            score -= 18.0 / max(1, counts[viewer] - 1)
    elif card_type == CARD_WITNESS:
        uncertainty = 4.0 * probability * (1.0 - probability)
        future_capture = not ally and bool(remaining[CARD_DETECTIVE] or remaining[CARD_DOG])
        score = 6.0 + (26.0 if future_capture else 6.0) * uncertainty
        if target in knowledge.hands or counts[viewer] == 1:
            score = 2.0
    elif card_type == CARD_ALIBI:
        if criminal and hand[CARD_ALIBI] == 1 and counts[viewer] > 2:
            score = -45.0
    elif card_type == CARD_ACCOMPLICE:
        if not ally:
            score = 14.0 + 50.0 * sum(
                weight / max(1, counts[player_id]) ** 1.5 for player_id, weight in probabilities.items()
            )
        ally = True
    elif card_type == CARD_CHIEF:
        score = 6.0 + (-8.0 if ally else 8.0) * probability
    elif card_type == CARD_TRADE:
        score, probabilities = _trade_score(view, knowledge, own, counts, target, given)
    elif card_type in (CARD_INFO_CONTROL, CARD_RUMOR):
        direction = 1 if card_type == CARD_INFO_CONTROL else -1
        probabilities, next_counts = _pass_distribution(probabilities, next_counts, list(counts), direction)
        score = 8.0
        if criminal and not accomplice:
            score -= 50.0 * (1.0 - probabilities[viewer])
        if accomplice:
            score += 25.0 * _escape_pressure(probabilities, next_counts, viewer)
    if not ally:
        score -= 45.0 * _escape_pressure(probabilities, next_counts, viewer)
    if criminal and card_type not in MOVEMENT_CARDS:
        other_cards = [kind for kind, amount in remaining.items() if amount > 0 and kind != CARD_CRIMINAL]
        if other_cards and all(kind in MOVEMENT_CARDS for kind in other_cards):
            score -= 40.0
    return score


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if "play_again" in legal:
        return {"type": "play_again", "delay_ms": 500}
    if "play_card" not in legal:
        return None
    viewer = view["you"]
    own = next(player for player in view["players"] if player["player_id"] == viewer)
    opponents = [player for player in view["players"] if player["player_id"] != viewer]
    knowledge = infer_knowledge(view)
    candidates = []
    for card in view["playable_cards"]:
        card_type = card["type"]
        targets = [None]
        if card_type in TARGETED_CARDS:
            targets = [
                player["player_id"] for player in opponents
                if player["hand_count"] or card_type in (CARD_DETECTIVE, CARD_CHIEF)
                or (card_type == CARD_TRADE and len(own["hand"]) == 1)
            ]
            if card_type in (CARD_DOG, CARD_WITNESS, CARD_TRADE) and not any(player["hand_count"] for player in opponents):
                targets = [None]
        gifts = [None]
        if card_type == CARD_TRADE and targets != [None]:
            gifts = [item for item in own["hand"] if item["id"] != card["id"]] or [None]
        for target in targets:
            for given in gifts:
                action = {"type": "play_card", "card_id": card["id"], "delay_ms": 350}
                if target is not None:
                    action["target_player_id"] = target
                if given is not None:
                    action["your_card_id"] = given["id"]
                candidates.append((_score_action(view, knowledge, own, card, target, given), action))
    return max(candidates, key=lambda candidate: candidate[0])[1] if candidates else None
