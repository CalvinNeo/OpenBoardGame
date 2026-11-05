import hashlib
import json
import random
from typing import Dict, List, Optional, Tuple

from game.six_nimmt import ROW_LIMIT, _bullheads_for_value


SAMPLE_COUNT = 96
Row = Tuple[int, int, int]


def _target(rows: List[Row], value: int) -> Optional[int]:
    eligible = [index for index, row in enumerate(rows) if row[0] < value]
    return max(eligible, key=lambda index: rows[index][0]) if eligible else None


def _take_index(rows: List[Row]) -> int:
    return min(range(len(rows)), key=lambda index: (rows[index][2], rows[index][0], index))


def _place(rows: List[Row], value: int, row_index: Optional[int] = None) -> int:
    target = _target(rows, value)
    if target is None:
        target = _take_index(rows) if row_index is None else row_index
        penalty = rows[target][2]
        rows[target] = (value, 1, _bullheads_for_value(value))
        return penalty
    last, count, bulls = rows[target]
    if count >= ROW_LIMIT:
        rows[target] = (value, 1, _bullheads_for_value(value))
        return bulls
    rows[target] = (value, count + 1, bulls + _bullheads_for_value(value))
    return 0


def _risk(rows: List[Row], value: int, opponents: int) -> float:
    target = _target(rows, value)
    if target is None:
        return float(min(row[2] for row in rows))
    last, count, bulls = rows[target]
    if count >= ROW_LIMIT:
        return float(bulls)
    pressure = min(1.0, opponents * max(0, value - last - 1) / 104)
    return bulls * pressure ** (ROW_LIMIT - count) + (value - last) * 0.002


def _hand_risk(rows: List[Row], hand: List[int], opponents: int) -> float:
    if not hand:
        return 0.0
    return sum(_risk(rows, value, opponents) for value in hand) / len(hand)


def _choose_row(view: Dict, rows: List[Row], hand: List[int]) -> int:
    value = view["waiting_for"]["card"]["value"]
    later = sorted(entry["card"]["value"] for entry in view.get("reveal_order", [])
                   if entry["card"]["value"] > value)
    candidates = []
    for index, row in enumerate(rows):
        future = list(rows)
        _place(future, value, index)
        for other_value in later:
            _place(future, other_value)
        candidates.append((row[2], _hand_risk(future, hand, len(later)), index))
    return min(candidates)[2]


def _sample_plays(view: Dict, rows: List[Row], hand: List[int]) -> List[List[int]]:
    known = set(view.get("seen_cards", [])) | set(hand)
    for row in view.get("rows", []):
        known.update(card["value"] for card in row["cards"])
    known.update(entry["card"]["value"] for entry in view.get("reveal_order", []))
    summary = view.get("last_turn_summary") or {}
    if summary.get("round") == view.get("round"):
        for entry in summary.get("placements", []):
            known.add(entry["card"]["value"])
            known.update(card["value"] for card in entry.get("taken_cards", []))
    unseen = [value for value in range(1, 105) if value not in known]
    counts = [player["hand_count"] + int(bool(player.get("selected")))
              for player in view.get("players", []) if player["player_id"] != view["you"]
              and (player.get("hand_count") or player.get("selected"))]
    seed = json.dumps([view.get("round"), view.get("turn"), rows, hand, sorted(known), counts])
    rng = random.Random(int.from_bytes(hashlib.sha256(seed.encode()).digest()[:8], "big"))
    samples = []
    for sample_index in range(SAMPLE_COUNT):
        pool = rng.sample(unseen, len(unseen))
        plays = []
        for count in counts:
            size = min(count, len(pool))
            if not size:
                break
            hypothetical_hand, pool = pool[:size], pool[size:]
            if sample_index % 4 == 0:
                choice = rng.choice(hypothetical_hand)
            else:
                choice = min(hypothetical_hand, key=lambda value: _risk(rows, value, len(counts))
                             + rng.random() * 2.5)
            plays.append(choice)
        samples.append(plays)
    return samples


def choose_action(view: Dict) -> Optional[Dict]:
    actions = view.get("legal_actions", [])
    if view.get("game_over") or not actions:
        return None
    if "ack_turn_summary" in actions:
        return {"type": "ack_turn_summary"}
    rows = [(row["cards"][-1]["value"], len(row["cards"]), row["bulls_total"])
            for row in view.get("rows", []) if row.get("cards")]
    if len(rows) != 4:
        return None
    hand = sorted(card["value"] for card in view.get("hand", []))
    if "choose_row" in actions and view.get("waiting_for"):
        return {"type": "choose_row", "row_index": _choose_row(view, rows, hand)}
    if "select_card" not in actions or not hand:
        return None
    if len(hand) == 1:
        return {"type": "select_card", "value": hand[0]}
    samples = _sample_plays(view, rows, hand)
    candidates = []
    for value in hand:
        remaining = [card for card in hand if card != value]
        cost = 0.0
        for plays in samples:
            future = list(rows)
            penalty = 0
            for played in sorted(plays + [value]):
                taken = _place(future, played)
                if played == value:
                    penalty = taken
            cost += penalty + 0.025 * penalty ** 2
            cost += 0.18 * _hand_risk(future, remaining, len(plays))
        candidates.append((cost / len(samples), value))
    return {"type": "select_card", "value": min(candidates)[1]}
