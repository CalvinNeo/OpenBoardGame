import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from game.flip7 import (
    ACTION_FLIP_THREE,
    ACTION_FREEZE,
    ACTION_SECOND_CHANCE,
    CARD_ACTION,
    CARD_MODIFIER,
    CARD_NUMBER,
    MODIFIER_POINTS,
    Flip7Game,
    _eligible_targets,
    _has_second_chance,
    _score_breakdown,
)


def _card_key(card: Dict) -> Tuple:
    return (card.get("type"), card.get("value"), card.get("action"),
            card.get("points"), card.get("multiplier"))


def _public_draw_pool(state: Dict) -> List[Dict]:
    cards = [{"type": CARD_NUMBER, "value": 0}]
    cards.extend({"type": CARD_NUMBER, "value": value}
                 for value in range(1, 13) for _ in range(value))
    cards.extend({"type": CARD_ACTION, "action": action}
                 for action in (ACTION_SECOND_CHANCE, ACTION_FREEZE, ACTION_FLIP_THREE)
                 for _ in range(3))
    cards.extend({"type": CARD_MODIFIER, "points": points} for points in MODIFIER_POINTS)
    cards.append({"type": CARD_MODIFIER, "multiplier": 2})
    visible = list(state.get("discard", []))
    for player in state["players"].values():
        visible.extend(player["tableau"])
    pending = state.get("pending_action")
    if pending:
        visible.append(pending["card"])
    visible.extend(entry["card"] for entry in state.get("action_queue", []))
    known = Counter(_card_key(card) for card in visible)
    pool = []
    for card in cards:
        key = _card_key(card)
        if known[key]:
            known[key] -= 1
        else:
            pool.append(card)
    return pool or list(state.get("discard", []))


def _bank_value(state: Dict, player_id: str) -> float:
    player = state["players"][player_id]
    if player["banked"]:
        return float(player.get("round_score") or 0)
    return float(_score_breakdown(player["tableau"], player.get("flip7", False))["total"])


def _next_gain(state: Dict, player_id: str, pool: List[Dict]) -> float:
    player = state["players"][player_id]
    breakdown = _score_breakdown(player["tableau"], False)
    numbers = set(breakdown["numbers"])
    bank = breakdown["total"]
    shield = _has_second_chance(player)
    multiplier = 2 ** breakdown["x2_count"]
    gain = 0.0
    duplicate_count = sum(card.get("type") == CARD_NUMBER and card.get("value") in numbers
                          for card in pool)
    for card in pool:
        if card["type"] == CARD_NUMBER:
            if card["value"] in numbers:
                gain -= 0 if shield else bank
            else:
                gain += card["value"] * multiplier + (15 if len(numbers) == 6 else 0)
        elif card["type"] == CARD_MODIFIER:
            gain += card.get("points", 0)
            if card.get("multiplier") == 2:
                gain += breakdown["numbers_sum"] * multiplier
        elif card.get("action") == ACTION_SECOND_CHANCE and not shield:
            gain += bank * duplicate_count / max(1, len(pool))
    return gain / max(1, len(pool))


def _utility(state: Dict, player_id: str, round_points: float, starting_score: int) -> float:
    total = starting_score + round_points
    rivals = [player["score"] for other_id, player in state["players"].items()
              if other_id != player_id]
    best_rival = max(rivals, default=0)
    target = int(state["config"]["target_score"])
    if best_rival >= target:
        return (1000 + round_points) if total >= best_rival else round_points * 0.01
    return round_points + (120 if total >= target and total >= best_rival else 0)


def _choose_target(state: Dict, bot_id: str) -> Optional[Dict]:
    pending = state["pending_action"]
    action_type = pending["card"].get("action")
    if action_type == ACTION_FLIP_THREE:
        return {"type": "choose_target", "target_player_id": bot_id}
    targets = _eligible_targets(state, action_type)
    if not targets:
        return None
    pool = _public_draw_pool(state)
    if action_type == ACTION_SECOND_CHANCE:
        target = bot_id if bot_id in targets else min(
            targets, key=lambda player_id: state["players"][player_id]["score"] + _bank_value(state, player_id)
        )
    else:
        def freeze_value(player_id: str) -> float:
            upside = max(0, _next_gain(state, player_id, pool))
            if player_id == bot_id:
                return -upside
            projected = state["players"][player_id]["score"] + _bank_value(state, player_id)
            threat = 1 + projected / max(1, int(state["config"]["target_score"]))
            return upside * threat

        target = max(targets, key=freeze_value)
    return {"type": "choose_target", "target_player_id": target}


def choose_move(state: Dict, bot_id: str) -> Optional[Dict]:
    legal = Flip7Game.get_legal_actions(state, bot_id)
    if not legal:
        return None
    if "next_round" in legal:
        return {"type": "next_round"}
    if "choose_target" in legal:
        return _choose_target(state, bot_id)
    pool = _public_draw_pool(state)
    if not pool:
        return {"type": "stay"}
    starting_score = state["players"][bot_id]["score"]
    bank = _bank_value(state, bot_id)
    stay_value = _utility(state, bot_id, bank, starting_score)
    generator = random.Random(7)
    total_value = 0.0
    samples = 128
    for _ in range(samples):
        simulation = copy.deepcopy({key: value for key, value in state.items() if key != "deck"})
        simulation["deck"] = list(pool)
        generator.shuffle(simulation["deck"])
        action = {"type": "flip"}
        for _ in range(24):
            _, error = Flip7Game.apply_action(simulation, bot_id, action, rng=generator)
            player = simulation["players"][bot_id]
            if error or simulation["phase"] in ("round_end", "game_over") or player["banked"]:
                break
            if simulation["phase"] == "action_target":
                if simulation["pending_action"]["actor_id"] != bot_id:
                    break
                action = _choose_target(simulation, bot_id)
                if action is None:
                    break
            elif _next_gain(simulation, bot_id, _public_draw_pool(simulation)) > 0:
                action = {"type": "flip"}
            else:
                break
        total_value += _utility(simulation, bot_id, _bank_value(simulation, bot_id), starting_score)
    return {"type": "flip" if total_value / samples > stay_value + 0.05 else "stay"}
