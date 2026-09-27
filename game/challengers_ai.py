"""A deterministic local opponent using only the same view as its player.

Drafting evaluates whole decks and their synergies, including bench congestion.
No hidden market order, opponent offers, future trophies, or RNG is consulted.
"""

from collections import Counter
from itertools import combinations
from typing import Dict, List, Optional


def _card_value(card: Dict, cards: List[Dict], round_number: int) -> float:
    counts = Counter(c["kind"] for c in cards)
    sets = Counter(c["set"] for c in cards)
    powers = Counter(c["power"] for c in cards)
    effect = card["effect"]
    value = float(card["power"])
    bonuses = {
        "hermit": 2 * (0.35 if sets["city"] else 1),
        "jester": 3 * min(0.9, (powers[1] - 1) * 0.28),
        "stable_boy": powers[3] * 0.48,
        "mascot": min(5, len(sets)) * 0.65,
        "teenager": max(0, sets["haunted"] - 1) * 0.48,
        "mime": 3.0, "merman": min(3, max(0, sets["shipwreck"] - 1) * 0.85),
        "lifeguard": 0.6, "gangster": 1.15, "knight": min(2.8, round_number * 0.4),
        "skeleton": 0.5, "treasure": 1.0, "illusionist": 1.9,
        "prince": 2.0, "rescue_pod": 1.8 if round_number < 7 else 0.25,
        "reporter": 0.65, "juggler": 1.25, "sailor": 1.3, "clairvoyant": 0.85,
        "navigator": 0.4, "ghost": 3.0, "submarine": -1.8,
        "villain": 0.1, "ufo": 2.1 if round_number < 7 else 1.25,
        "hologram": -0.8, "siren": 0.45, "comic_character": 0.5,
        "butler": 0.75 + max(0, len(counts) - 5) * 0.65,
        "sorcerer": 0.35 + max(0, len(counts) - 5) * 0.3,
        "movie_star": min(2, counts["newcomer"]) * (0.9 + counts["makeup_artist"] * 0.65),
        "necromancer": min(3, powers[2]) * 0.75,
        "vampire": 2.4 if any(c["level"] == "B" for c in cards) else 0,
        "fan_bus": 0.9 if round_number <= 7 else 0,
        "pyrotechnician": 0.5 if round_number <= 7 else 0,
        "clown": 1.1 if round_number <= 7 else 0,
        "heroine": 1.8 if round_number <= 7 else 0,
    }
    value += bonuses.get(effect, 0)
    # Each bench supporter boosts the portion of the deck drawn after it.
    value += 0.5 * counts["ai"] if card["power"] == 2 else 0
    value += 0.65 * counts["makeup_artist"] if card["power"] == 1 else 0
    value += 0.45 * counts["vendor"] if card["set"] == "funfair" else 0
    value += 0.45 * counts["band"] if card["set"] == "space" else 0
    value += 0.45 * counts["blacksmith"] if card["set"] == "city" else 0
    value += 0.3 * counts["director"] if card["set"] == "studio" else 0
    value += 0.28 * (counts["bard"] + counts["cook"])
    return max(0.1, value)


def deck_value(cards: List[Dict], round_number: int) -> float:
    if not cards:
        return -100.0
    names = Counter(c["kind"] for c in cards)
    cleaners = sum(c["effect"] == "butler" for c in cards) + 0.4 * sum(c["effect"] == "sorcerer" for c in cards)
    self_clearing = 0.35 * sum(c["effect"] in ("prince", "rescue_pod") for c in cards)
    # A seventh kind is playable if it holds the last flag; beyond that risk grows quickly.
    capacity = 6.0 + min(2.1, cleaners * 0.65) + min(0.6, self_clearing)
    congestion = max(0, len(names) - capacity)
    values = [_card_value(c, cards, round_number) for c in cards]
    return sum(values) + sum(min(3, count - 1) * 0.6 for count in names.values()) - congestion * 5 - congestion ** 2 * 4


def trim_deck(cards: List[Dict], round_number: int) -> List[Dict]:
    """Remove weak name groups until another cut costs more than it helps."""
    remaining = list(cards)
    while len(remaining) > 1:
        baseline = deck_value(remaining, round_number)
        best_score, best = baseline, remaining
        for kind in sorted({c["kind"] for c in remaining}):
            candidate = [c for c in remaining if c["kind"] != kind]
            value = deck_value(candidate, round_number)
            if value > best_score + 0.15:
                best_score, best = value, candidate
        if best is remaining:
            break
        remaining = best
    return remaining


def _draft_score(card: Dict, view: Dict) -> float:
    cards = view["deck"] + [card]
    kept = trim_deck(cards, view["round"])
    value = deck_value(kept, view["round"])
    value += 0.7 if card["effect"] == "clones" and view["round"] <= 7 else 0
    value += 0.4 if card["effect"] in ("shapeshifter", "scifi_geek") else 0
    # A second copy in the same offer is a real opportunity this round.
    if view["picks_left"] > 1:
        value += 1.5 * any(c["kind"] == card["kind"] and c["id"] != card.get("id") for c in view["offer"])
    return value


def _bench_value(card: Dict, bench: List[Dict]) -> float:
    effect = card["effect"]
    value = {"makeup_artist": 7, "vendor": 6, "band": 5, "ai": 5,
             "blacksmith": 4, "bard": 6, "cook": 5, "director": 4}.get(effect, 0)
    value += 1.3 if card["set"] == "haunted" else 0
    value += 1.0 if card["power"] == 3 else 0
    # A singleton actually frees one of the six seats.
    value -= 3 if sum(c["kind"] == card["kind"] for c in bench) == 1 else 0
    return value


def _resolve(view: Dict) -> List[str]:
    choice = view["choice"]
    cards = choice["cards"]
    kind = choice["kind"]
    if kind == "extra_pick":
        before = deck_value(trim_deck(view["deck"], view["round"]), view["round"])
        best, best_score = [], before
        # Decks are small; enumerate the one- or two-card payment explicitly.
        for payment in combinations(cards, choice["max"]):
            removed = {c["id"] for c in payment}
            remaining = [c for c in view["deck"] if c["id"] not in removed]
            for offered in view["offer"]:
                candidate = trim_deck(remaining + [offered], view["round"])
                score = deck_value(candidate, view["round"])
                if score > best_score + 0.2:
                    best_score, best = score, [c["id"] for c in payment]
        return best
    match = next((m for m in view["matches"] if view["you"] in m["seats"]), None)
    lane = match["lanes"].get(view["you"], {}) if match else {}
    known = lane.get("bench", []) + lane.get("field", []) + cards
    strength = lambda c: _card_value(c, known, view["round"])
    if kind == "exhaust":
        target_lane = match["lanes"].get(choice["target"], {}) if match else {}
        bench = target_lane.get("bench", cards)
        if choice["target"] != view["you"]:
            target = max(cards, key=lambda c: (_bench_value(c, bench), c["id"]))
            return [target["id"]] if _bench_value(target, bench) > 0 or choice["min"] else []
        selected = []
        remaining = list(bench)
        for _ in range(choice["max"]):
            options = [c for c in cards if c["id"] not in selected]
            target = min(options, key=lambda c: (_bench_value(c, remaining), c["id"]))
            if _bench_value(target, remaining) > 0 and len(selected) >= choice["min"]:
                break
            selected.append(target["id"])
            remaining = [c for c in remaining if c["id"] != target["id"]]
        return selected
    if kind == "recover":
        return [c["id"] for c in sorted(cards, key=lambda c: (-strength(c), c["id"]))[:choice["max"]]]
    if kind == "bottom":
        return [min(cards, key=lambda c: (strength(c), c["id"]))["id"]]
    if kind in ("top", "split", "order"):
        # Put aura cards in play early; bench cleaners should arrive later.
        def tempo(card: Dict) -> float:
            support = card["effect"] in ("makeup_artist", "vendor", "band", "ai", "blacksmith", "cook", "bard", "director")
            return strength(card) + (3 if support and lane.get("draw_count", 0) > 4 else 0)
        ordered = sorted(cards, key=lambda c: (-tempo(c), c["id"]))
        return [c["id"] for c in ordered[:choice["max"]]]
    raise ValueError(f"Unknown Challengers choice: {kind}")


def choose_action(view: Dict) -> Optional[Dict]:
    legal = view.get("legal_actions", [])
    if not legal:
        return None
    action = {"round": view["round"], "revision": view["revision"]}
    if "next_round" in legal:
        return {**action, "type": "next_round"}
    if "resolve" in legal:
        return {**action, "type": "resolve", "card_ids": _resolve(view)}
    if "choose_level" in legal:
        scores = {}
        baseline = deck_value(trim_deck(view["deck"], view["round"]), view["round"])
        for level, picks in view["level_options"].items():
            gains = sorted((_draft_score({**c, "id": "estimate"}, view) - baseline
                            for c in view["catalog"].values() if c["level"] == level and c["set"] in view["sets"]), reverse=True)
            # Five candidates plus a redraw tends to find a top-quartile card.
            scores[level] = sum(gains[:max(3, len(gains) // 4)]) / max(3, len(gains) // 4) * (1 + 0.55 * (picks - 1))
        return {**action, "type": "choose_level", "level": max(scores, key=scores.get)}
    if "pick" in legal:
        best = max(view["offer"], key=lambda c: (_draft_score(c, view), c["id"]))
        if "redraw" in legal:
            possible = sorted((_draft_score({**c, "id": "estimate"}, view) for c in view["catalog"].values()
                               if c["level"] == view["level"] and c["set"] in view["sets"]))
            threshold = possible[int(len(possible) * 0.72)] if possible else 0
            if _draft_score(best, view) + 0.4 < threshold:
                return {**action, "type": "redraw"}
        return {**action, "type": "pick", "card_id": best["id"]}
    if "ready" in legal:
        keep = {c["id"] for c in trim_deck(view["deck"], view["round"])}
        return {**action, "type": "ready", "remove_ids": [c["id"] for c in view["deck"] if c["id"] not in keep]}
    if "reveal" in legal:
        return {**action, "type": "reveal"}
    raise ValueError(f"Unhandled Challengers action: {legal}")
