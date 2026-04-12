import argparse
import copy
import json
import math
import os
import random
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from game import guandan

try:
    import torch
    import torch.nn.functional as F
    from torch import nn
    from torch.utils.data import DataLoader, Dataset
except ImportError:  # pragma: no cover - optional runtime dependency
    torch = None
    F = None
    nn = None
    DataLoader = None
    Dataset = object


TRAIN_COMBO_TYPES = (
    "none",
    "single",
    "pair",
    "three",
    "full_house",
    "straight",
    "three_pairs",
    "steel_plate",
    "bomb",
    "straight_flush",
    "heavenly",
    "pass",
)
PLAN_TYPES = (
    "none",
    "single",
    "pair",
    "three",
    "full_house",
    "straight",
    "three_pairs",
    "steel_plate",
    "bomb",
    "straight_flush",
)
HEURISTIC_COMPONENT_KEYS = (
    "team_finish",
    "turn_efficiency",
    "structure_credit",
    "hand_strength",
    "hand_pressure",
    "control_stock",
    "play_cards",
    "shape_value",
    "plan_alignment",
    "control_break_penalty",
    "response_material",
    "special_response_overuse",
    "single_lock",
    "cheap_clean_single_takeover",
    "bomb_bonus",
    "critical_bomb_takeover",
    "opp_block",
    "opp_risk",
    "deny_short_lead",
    "seize_tempo",
    "lead_plan",
    "lead_overreach",
    "low_single_trap",
    "shed_low_single",
    "keep_initiative_shape",
    "pass_opportunity_cost",
    "pass_structure_concession",
    "pass_lane_concession",
    "protect_teammate",
    "avoid_overtrick",
)
MAX_STATE_SCALE = 6.0
MAX_ACTION_SCALE = 6.0
DEFAULT_CANDIDATE_LIMIT = 12
DEFAULT_POLICY_TARGET_SOURCE = "search"
POLICY_TARGET_BLEND = 0.35
PASS_SAMPLE_WEIGHT = 0.82
NON_PASS_SAMPLE_BONUS = 0.1
COMPLEX_COMBO_BONUS = 0.08
MULTI_CARD_COMBO_BONUS = 0.06
MAX_MARGIN_BONUS = 0.24
DEFAULT_REANALYSIS_CANDIDATE_CAP = 6
DEFAULT_REANALYSIS_MCTS_SIMS = 10
DEFAULT_REANALYSIS_MCTS_DEPTH = 5
DEFAULT_REANALYSIS_MCTS_TREE_PLY = 1
DEFAULT_REANALYSIS_MCTS_REPLY_WIDTH = 1
DEFAULT_REANALYSIS_MCTS_RISK_LAMBDA = 0.18
DEFAULT_REANALYSIS_MINIMAX_DEPTH = 3
DEFAULT_REANALYSIS_MINIMAX_WIDTH = 6
DEFAULT_SELF_PLAY_POLICY = "search"
DEFAULT_MODEL_SEARCH_SIMS = 24
DEFAULT_MODEL_SEARCH_DEPTH = 6
DEFAULT_MODEL_SEARCH_C_PUCT = 1.2
DEFAULT_MODEL_SEARCH_DIRICHLET_ALPHA = 0.3
DEFAULT_MODEL_SEARCH_DIRICHLET_EPSILON = 0.20
DEFAULT_MODEL_SEARCH_TEMPERATURE = 0.85
DEFAULT_TRAIN_CONFIG = {
    "bot_search_depth": 3,
    "bot_mcts_sims": 20,
    "bot_mcts_depth": 6,
    "bot_mcts_tree_ply": 1,
    "bot_mcts_reply_width": 1,
    "bot_mcts_root_width": 4,
    "bot_mcts_time_ms": 35,
    "bot_minimax_depth": 3,
    "bot_minimax_width": 6,
    "bot_minimax_time_ms": 25,
    "bot_think_time_ms": 60,
    "bot_endgame_threshold": 14,
}


def _format_duration(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _progress(message: str) -> None:
    stamp = time.strftime("%H:%M:%S")
    print(f"[{stamp}] {message}", file=sys.stderr, flush=True)


def _one_hot(value: str, choices: Sequence[str]) -> List[float]:
    return [1.0 if value == choice else 0.0 for choice in choices]


def _clip_scale(value: float, scale: float) -> float:
    if scale <= 0:
        return 0.0
    clipped = max(-scale, min(scale, value))
    return clipped / scale


def _norm_count(value: int, maximum: int) -> float:
    if maximum <= 0:
        return 0.0
    return max(0.0, min(1.0, value / float(maximum)))


def _action_key(action: Dict) -> Tuple:
    action_type = action.get("type")
    if action_type == "play":
        return ("play", tuple(sorted(action.get("card_ids") or [])))
    if action_type in ("tribute_select", "return_select"):
        return (action_type, action.get("card_id"))
    return (action_type,)


def _sanitize_action(action: Optional[Dict]) -> Optional[Dict]:
    if not action:
        return None
    action_type = action.get("type")
    if action_type == "play":
        return {"type": "play", "card_ids": list(action.get("card_ids") or [])}
    if action_type == "pass":
        return {"type": "pass"}
    if action_type == "tribute_select":
        return {"type": "tribute_select", "card_id": action.get("card_id")}
    if action_type == "return_select":
        return {"type": "return_select", "card_id": action.get("card_id")}
    if action_type == "next_round":
        return {"type": "next_round"}
    if action_type == "play_again":
        return {"type": "play_again"}
    return action


def _relative_order(state: Dict, player_id: str) -> Tuple[str, str, str, str]:
    order = state.get("turn_order") or []
    if player_id not in order:
        raise ValueError(f"unknown player_id {player_id}")
    idx = order.index(player_id)
    self_id = order[idx]
    next_id = order[(idx + 1) % len(order)]
    teammate_id = guandan._teammate_of(state, player_id)
    prev_id = order[(idx - 1) % len(order)]
    return self_id, next_id, teammate_id, prev_id


def _relation_to_player(state: Dict, player_id: str, target_id: Optional[str]) -> str:
    if not target_id:
        return "none"
    self_id, next_id, teammate_id, prev_id = _relative_order(state, player_id)
    if target_id == self_id:
        return "self"
    if target_id == next_id:
        return "next"
    if target_id == teammate_id:
        return "teammate"
    if target_id == prev_id:
        return "prev"
    return "none"


def _rank_hist(cards: List[Dict], level_rank: int) -> List[float]:
    counts = [0.0] * 13
    for card in cards:
        if guandan._is_joker(card) or guandan._is_wild(card, level_rank):
            continue
        rank = card.get("rank")
        if isinstance(rank, int) and 2 <= rank <= 14:
            counts[rank - 2] += 1.0
    return [value / 8.0 for value in counts]


def _special_hist(cards: List[Dict], level_rank: int) -> List[float]:
    wild = 0
    small = 0
    big = 0
    for card in cards:
        if guandan._is_wild(card, level_rank):
            wild += 1
        elif card.get("joker") == "small":
            small += 1
        elif card.get("joker") == "big":
            big += 1
    return [_norm_count(wild, 4), _norm_count(small, 2), _norm_count(big, 2)]


def _suit_hist(cards: List[Dict]) -> List[float]:
    suits = {"spades": 0, "hearts": 0, "clubs": 0, "diamonds": 0}
    for card in cards:
        suit = card.get("suit")
        if suit in suits:
            suits[suit] += 1
    return [_norm_count(suits[suit], 14) for suit in ("spades", "hearts", "clubs", "diamonds")]


def _seen_cards(state: Dict) -> List[Dict]:
    seen_ids = set(state.get("seen_cards") or [])
    if not seen_ids:
        return []
    deck = {card["id"]: card for card in guandan._full_deck()}
    return [deck[cid] for cid in seen_ids if cid in deck]


def _current_trick_cards(state: Dict) -> List[Dict]:
    current = state.get("current_trick")
    if not current:
        return []
    deck = {card["id"]: card for card in guandan._full_deck()}
    return [deck[cid] for cid in current.get("cards") or [] if cid in deck]


def _state_feature_vector(state: Dict, player_id: str) -> List[float]:
    if player_id not in state.get("players", {}):
        raise ValueError(f"player {player_id} not found")

    hand = state["players"][player_id]["hand"]
    level_rank = state.get("level_rank", 2)
    legal = guandan.GuandanGame.get_legal_actions(state, player_id)
    current_trick = state.get("current_trick") or {}
    current_combo = current_trick.get("combo") or {}
    teammate_id = guandan._teammate_of(state, player_id)
    self_id, next_id, _, prev_id = _relative_order(state, player_id)

    features: List[float] = [
        _norm_count(state.get("round_number", 1), 12),
        _norm_count(level_rank, 14),
        1.0 if guandan._team_of(state, player_id) == state.get("dealer_team") else 0.0,
        1.0 if current_trick else 0.0,
        1.0 if "play" in legal else 0.0,
        1.0 if "pass" in legal else 0.0,
        1.0 if state.get("current_turn") == player_id else 0.0,
        1.0 if state.get("phase") == "playing" else 0.0,
        _norm_count(len(state["players"][self_id]["hand"]), 27),
        _norm_count(len(state["players"][next_id]["hand"]), 27),
        _norm_count(len(state["players"][teammate_id]["hand"]) if teammate_id else 0, 27),
        _norm_count(len(state["players"][prev_id]["hand"]), 27),
        1.0 if state["players"][self_id]["finished"] else 0.0,
        1.0 if state["players"][next_id]["finished"] else 0.0,
        1.0 if teammate_id and state["players"][teammate_id]["finished"] else 0.0,
        1.0 if state["players"][prev_id]["finished"] else 0.0,
    ]
    features.extend(_one_hot(_relation_to_player(state, player_id, current_trick.get("player_id")), ("none", "self", "next", "teammate", "prev")))
    features.extend(_one_hot(current_combo.get("type", "none"), TRAIN_COMBO_TYPES[:-1]))
    features.extend(
        [
            _norm_count(current_combo.get("size", 0), 8),
            _norm_count(current_combo.get("rank_value", 0), 100),
            _norm_count(current_combo.get("high_value", 0), 20),
            1.0 if current_combo.get("uses_wild") else 0.0,
        ]
    )
    features.extend(_rank_hist(hand, level_rank))
    features.extend(_special_hist(hand, level_rank))
    features.extend(_suit_hist(hand))
    features.extend(_rank_hist(_seen_cards(state), level_rank))
    features.extend(_special_hist(_seen_cards(state), level_rank))

    summary = guandan._hand_decomposition_summary(hand, level_rank)
    features.extend(
        [
            _norm_count(int(summary.get("turns", 0.0) * 10), 100),
            _norm_count(int(summary.get("singles", 0.0) * 10), 100),
            _norm_count(int(summary.get("low_singles", 0.0) * 10), 100),
            _norm_count(int(summary.get("control_singles", 0.0) * 10), 100),
            _norm_count(int(summary.get("group_turns", 0.0) * 10), 100),
            _norm_count(int(summary.get("bomb_turns", 0.0) * 10), 40),
            _norm_count(int(summary.get("grouped_cards", 0.0) * 10), 270),
            _norm_count(int(summary.get("special_material_turns", 0.0) * 10), 60),
            _norm_count(int(summary.get("top_combo_size", 0.0) * 10), 80),
            _clip_scale(float(summary.get("score", 0.0)), 60.0),
        ]
    )
    top_plan = (summary.get("plan_types") or ("none",))[0]
    features.extend(_one_hot(top_plan, PLAN_TYPES))

    active_opponents = [
        pid
        for pid in state.get("turn_order", [])
        if guandan._team_of(state, pid) != guandan._team_of(state, player_id) and not state["players"][pid]["finished"]
    ]
    opponent_min = min((len(state["players"][pid]["hand"]) for pid in active_opponents), default=0)
    opponent_max = max((len(state["players"][pid]["hand"]) for pid in active_opponents), default=0)
    teammate_count = len(state["players"][teammate_id]["hand"]) if teammate_id else 0
    features.extend(
        [
            _norm_count(teammate_count, 27),
            _norm_count(opponent_min, 27),
            _norm_count(opponent_max, 27),
            _clip_scale(guandan._evaluate_state_for_bot(state, player_id), 80.0),
        ]
    )
    return features


def _action_feature_vector(state: Dict, player_id: str, action: Dict, depth: int = 3) -> List[float]:
    action = _sanitize_action(action) or {"type": "pass"}
    hand = state["players"][player_id]["hand"]
    hand_map = guandan._map_hand_by_id(hand)
    level_rank = state.get("level_rank", 2)
    cards = action.get("card_ids") or []
    combo_type = "pass"
    combo = {
        "type": "pass",
        "size": 0,
        "rank_value": 0,
        "high_value": 0,
        "tier": 0,
        "uses_wild": False,
    }
    play_cards: List[Dict] = []
    if action.get("type") == "play":
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        actual_combo = guandan._evaluate_combo(play_cards, level_rank, state.get("config", {}))
        if actual_combo:
            combo = actual_combo
            combo_type = actual_combo.get("type", "none")
        else:
            combo_type = "none"

    components = guandan._bot_score_components(state, player_id, cards if action.get("type") == "play" else None, depth)
    features: List[float] = []
    features.extend(_one_hot(combo_type if action.get("type") == "play" else "pass", TRAIN_COMBO_TYPES))
    features.extend(
        [
            1.0 if action.get("type") == "pass" else 0.0,
            _norm_count(combo.get("size", len(cards)), 8),
            _norm_count(combo.get("rank_value", 0), 100),
            _norm_count(combo.get("high_value", 0), 20),
            _norm_count(combo.get("tier", 0), 8),
            1.0 if combo.get("uses_wild") else 0.0,
            1.0 if guandan._cards_use_special_material(play_cards, level_rank) else 0.0,
        ]
    )
    features.extend(_rank_hist(play_cards, level_rank))
    features.extend(_special_hist(play_cards, level_rank))
    features.extend(_suit_hist(play_cards))
    features.append(_clip_scale(components.get("total", 0.0), 100.0))
    for key in HEURISTIC_COMPONENT_KEYS:
        features.append(_clip_scale(float(components.get(key, 0.0)), 30.0))
    return features


def _action_label(state: Dict, player_id: str, action: Dict) -> str:
    action = _sanitize_action(action) or {"type": "pass"}
    if action.get("type") == "pass":
        return "Pass"
    if action.get("type") == "play":
        hand_map = guandan._map_hand_by_id(state["players"][player_id]["hand"])
        labels = [guandan._card_label(hand_map[cid]) for cid in action.get("card_ids") or [] if cid in hand_map]
        return " ".join(labels) if labels else "Play"
    if action.get("type") == "tribute_select":
        hand_map = guandan._map_hand_by_id(state["players"][player_id]["hand"])
        card = hand_map.get(action.get("card_id"))
        return f"Tribute {guandan._card_label(card) if card else '?'}"
    if action.get("type") == "return_select":
        hand_map = guandan._map_hand_by_id(state["players"][player_id]["hand"])
        card = hand_map.get(action.get("card_id"))
        return f"Return {guandan._card_label(card) if card else '?'}"
    return str(action.get("type") or "action")


def _one_hot_index(size: int, index: int) -> List[float]:
    target = [0.0] * size
    if 0 <= index < size:
        target[index] = 1.0
    return target


def _score_candidate_for_target(state: Dict, player_id: str, action: Dict, depth: int) -> Tuple[float, str, int]:
    action = _sanitize_action(action) or {"type": "pass"}
    if action.get("type") == "pass":
        components = guandan._bot_score_components(state, player_id, None, depth)
        return float(components.get("total", 0.0)), "pass", 0
    cards = list(action.get("card_ids") or [])
    hand_map = guandan._map_hand_by_id(state["players"][player_id]["hand"])
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = guandan._evaluate_combo(play_cards, state.get("level_rank", 2), state.get("config", {})) or {}
    components = guandan._bot_score_components(state, player_id, cards, depth)
    return (
        float(components.get("total", 0.0)),
        str(combo.get("type") or "none"),
        int(combo.get("size", len(cards))),
    )


def _normalized_score_distribution(scores: Sequence[float]) -> List[float]:
    if not scores:
        return []
    if len(scores) == 1:
        return [1.0]
    mean = sum(scores) / len(scores)
    variance = sum((score - mean) ** 2 for score in scores) / len(scores)
    scale = max(1.0, math.sqrt(max(0.0, variance)))
    normalized = [(score - mean) / scale for score in scores]
    max_value = max(normalized)
    exp_values = [math.exp(value - max_value) for value in normalized]
    total = sum(exp_values) or 1.0
    return [value / total for value in exp_values]


def _build_policy_target(chosen_index: int, scores: Sequence[float], teacher: str) -> List[float]:
    if teacher == "random":
        size = len(scores)
        return [1.0 / size] * size if size else []
    else:
        soft = _normalized_score_distribution(scores)
    if soft:
        return soft
    return _one_hot_index(len(scores), chosen_index)


def _normalize_policy(values: Sequence[float]) -> List[float]:
    items = [max(0.0, float(value)) for value in values]
    total = sum(items)
    if total > 1e-9:
        return [value / total for value in items]
    return []


def _softmax(values: Sequence[float], temperature: float = 1.0) -> List[float]:
    if not values:
        return []
    if len(values) == 1:
        return [1.0]
    safe_temp = max(1e-6, float(temperature))
    scaled = [float(value) / safe_temp for value in values]
    top = max(scaled)
    exp_values = [math.exp(value - top) for value in scaled]
    total = sum(exp_values) or 1.0
    return [value / total for value in exp_values]


def _sample_from_distribution(weights: Sequence[float], rng: random.Random) -> int:
    if not weights:
        return 0
    total = sum(max(0.0, float(weight)) for weight in weights)
    if total <= 1e-9:
        return 0
    pick = rng.random() * total
    cumulative = 0.0
    for idx, weight in enumerate(weights):
        cumulative += max(0.0, float(weight))
        if pick <= cumulative:
            return idx
    return max(0, len(weights) - 1)


def _sample_dirichlet(alpha: float, size: int, rng: random.Random) -> List[float]:
    if size <= 0:
        return []
    safe_alpha = max(1e-3, float(alpha))
    draws = [rng.gammavariate(safe_alpha, 1.0) for _ in range(size)]
    return _normalize_policy(draws) or [1.0 / size] * size


def _sample_weight_for_example(
    chosen_action: Dict,
    chosen_score: float,
    sorted_scores: Sequence[float],
    chosen_combo_type: str,
    chosen_combo_size: int,
) -> float:
    action = _sanitize_action(chosen_action) or {"type": "pass"}
    weight = 1.0
    if action.get("type") == "pass":
        weight *= PASS_SAMPLE_WEIGHT
    else:
        weight += NON_PASS_SAMPLE_BONUS
        if chosen_combo_size >= 2:
            weight += MULTI_CARD_COMBO_BONUS
        if chosen_combo_type not in ("single", "pair", "three", "pass", "none"):
            weight += COMPLEX_COMBO_BONUS
    if len(sorted_scores) >= 2:
        margin = max(0.0, float(chosen_score) - float(sorted_scores[1]))
        weight += min(MAX_MARGIN_BONUS, margin / 20.0)
    return max(0.5, min(1.8, weight))


def _terminal_team_value(state: Dict, player_id: str) -> Optional[float]:
    finish_order = list((state.get("last_round_summary") or {}).get("finish_order") or state.get("finish_order") or [])
    if len(finish_order) == 4:
        return _team_finish_value(finish_order, guandan._team_of(state, player_id), state)
    winner_team = state.get("winner_team")
    if winner_team:
        return 1.0 if winner_team == guandan._team_of(state, player_id) else -1.0
    return None


def _advance_to_model_decision(state: Dict, fallback_rng: random.Random, step_cap: int = 12) -> Tuple[Dict, bool]:
    current = copy.deepcopy(state)
    for _ in range(max(1, step_cap)):
        terminal = _terminal_team_value(current, current.get("current_turn") or (current.get("turn_order") or [None])[0])
        if terminal is not None:
            return current, True
        acting_id = current.get("current_turn")
        if not acting_id:
            break
        legal = guandan.GuandanGame.get_legal_actions(current, acting_id)
        if not legal:
            break
        if current.get("phase") == "playing" and ("play" in legal or "pass" in legal):
            return current, False
        action = _auto_progress_action(current, acting_id)
        if action is None:
            action = _teacher_action(
                current,
                acting_id,
                "random",
                fallback_rng,
                model=None,
                candidate_limit=DEFAULT_CANDIDATE_LIMIT,
            )
        if action is None:
            break
        _, err = guandan.GuandanGame.apply_action(current, acting_id, _sanitize_action(action))
        if err:
            break
    return current, _terminal_team_value(current, current.get("current_turn") or (current.get("turn_order") or [None])[0]) is not None


def _leaf_model_value(
    model: "GuandanPolicyValueNet",
    state: Dict,
    root_player_id: str,
    device: str,
    candidate_limit: int,
) -> float:
    terminal = _terminal_team_value(state, root_player_id)
    if terminal is not None:
        return terminal
    acting_id = state.get("current_turn")
    if not acting_id:
        return 0.0
    actions = guandan._candidate_actions(state, acting_id, candidate_limit)
    if not actions:
        return 0.0
    try:
        _, state_value = evaluate_actions(model, state, acting_id, actions, device=device)
    except Exception:
        return 0.0
    acting_team = guandan._team_of(state, acting_id)
    root_team = guandan._team_of(state, root_player_id)
    return float(state_value if acting_team == root_team else -state_value)


def _rollout_model_policy_action(
    model: "GuandanPolicyValueNet",
    state: Dict,
    player_id: str,
    device: str,
    candidate_limit: int,
    temperature: float,
    rng: random.Random,
) -> Optional[Dict]:
    actions = guandan._candidate_actions(state, player_id, candidate_limit)
    if not actions:
        return None
    scored, _state_value = evaluate_actions(model, state, player_id, actions, device=device)
    if not scored:
        return None
    if temperature <= 1e-6:
        best_action, _ = max(scored, key=lambda item: item[1])
        return _sanitize_action(best_action)
    probs = _softmax([score for _, score in scored], temperature=temperature)
    chosen_idx = _sample_from_distribution(probs, rng)
    return _sanitize_action(scored[chosen_idx][0])


def _model_rollout_value(
    model: "GuandanPolicyValueNet",
    state: Dict,
    root_player_id: str,
    device: str,
    candidate_limit: int,
    depth: int,
    temperature: float,
    rng: random.Random,
) -> float:
    current, terminal = _advance_to_model_decision(state, rng)
    if terminal:
        return _terminal_team_value(current, root_player_id) or 0.0
    if depth <= 0:
        return _leaf_model_value(model, current, root_player_id, device, candidate_limit)
    acting_id = current.get("current_turn")
    if not acting_id:
        return _leaf_model_value(model, current, root_player_id, device, candidate_limit)
    action = _rollout_model_policy_action(
        model,
        current,
        acting_id,
        device=device,
        candidate_limit=candidate_limit,
        temperature=temperature,
        rng=rng,
    )
    if action is None:
        return _leaf_model_value(model, current, root_player_id, device, candidate_limit)
    nxt = copy.deepcopy(current)
    _, err = guandan.GuandanGame.apply_action(nxt, acting_id, action)
    if err:
        return _leaf_model_value(model, current, root_player_id, device, candidate_limit)
    return _model_rollout_value(
        model,
        nxt,
        root_player_id,
        device=device,
        candidate_limit=candidate_limit,
        depth=depth - 1,
        temperature=temperature,
        rng=rng,
    )


@dataclass
class SearchDecision:
    action: Dict
    candidates: List[Dict]
    policy_target: List[float]
    target_scores: List[float]
    metadata: Dict[str, object] = field(default_factory=dict)


def _model_search_decision(
    model: "GuandanPolicyValueNet",
    state: Dict,
    player_id: str,
    device: str = "cpu",
    candidate_limit: int = DEFAULT_CANDIDATE_LIMIT,
    sims: int = DEFAULT_MODEL_SEARCH_SIMS,
    depth: int = DEFAULT_MODEL_SEARCH_DEPTH,
    c_puct: float = DEFAULT_MODEL_SEARCH_C_PUCT,
    dirichlet_alpha: float = DEFAULT_MODEL_SEARCH_DIRICHLET_ALPHA,
    dirichlet_epsilon: float = DEFAULT_MODEL_SEARCH_DIRICHLET_EPSILON,
    rollout_temperature: float = DEFAULT_MODEL_SEARCH_TEMPERATURE,
    rng: Optional[random.Random] = None,
) -> Optional[SearchDecision]:
    if model is None:
        return None
    actions = [dict(item) for item in guandan._candidate_actions(state, player_id, candidate_limit)]
    if not actions:
        return None
    if len(actions) == 1:
        only = dict(actions[0])
        return SearchDecision(
            action=only,
            candidates=[only],
            policy_target=[1.0],
            target_scores=[1.0],
            metadata={"source": "model_search", "sims": 0, "depth": 0, "single_candidate": True},
        )

    search_rng = rng or random.Random()
    scored, root_state_value = evaluate_actions(model, state, player_id, actions, device=device)
    if not scored:
        return None
    logits = [float(score) for _action, score in scored]
    priors = _softmax(logits, temperature=1.0)
    if len(priors) > 1 and dirichlet_epsilon > 1e-6:
        noise = _sample_dirichlet(dirichlet_alpha, len(priors), search_rng)
        priors = [
            (1.0 - dirichlet_epsilon) * prior + dirichlet_epsilon * sample
            for prior, sample in zip(priors, noise)
        ]
        priors = _normalize_policy(priors) or priors

    visits = [0] * len(actions)
    total_values = [0.0] * len(actions)
    total_sq = [0.0] * len(actions)
    for _ in range(max(1, sims)):
        total_visit_count = sum(visits)
        best_idx = 0
        best_score = None
        root_scale = math.sqrt(max(1.0, float(total_visit_count + 1)))
        for idx, prior in enumerate(priors):
            q_value = total_values[idx] / visits[idx] if visits[idx] else 0.0
            u_value = float(c_puct) * float(prior) * root_scale / float(1 + visits[idx])
            score = q_value + u_value
            if best_score is None or score > best_score:
                best_score = score
                best_idx = idx
        nxt = copy.deepcopy(state)
        _, err = guandan.GuandanGame.apply_action(nxt, player_id, _sanitize_action(actions[best_idx]))
        if err:
            visits[best_idx] += 1
            continue
        value = _model_rollout_value(
            model,
            nxt,
            player_id,
            device=device,
            candidate_limit=candidate_limit,
            depth=max(0, depth - 1),
            temperature=rollout_temperature,
            rng=search_rng,
        )
        visits[best_idx] += 1
        total_values[best_idx] += value
        total_sq[best_idx] += value * value

    visit_target = _normalize_policy(visits) or priors
    avg_scores = [
        (total_values[idx] / visits[idx]) if visits[idx] else float(root_state_value)
        for idx in range(len(actions))
    ]
    chosen_idx = max(range(len(actions)), key=lambda idx: (visit_target[idx], avg_scores[idx]))
    per_action = []
    for idx, action in enumerate(actions):
        visit_count = visits[idx]
        avg = avg_scores[idx]
        variance = (total_sq[idx] / visit_count - avg * avg) if visit_count else 0.0
        per_action.append(
            {
                "label": _action_label(state, player_id, action),
                "prior": priors[idx],
                "visit_prob": visit_target[idx],
                "visits": visit_count,
                "avg_value": avg,
                "std": math.sqrt(max(0.0, variance)),
            }
        )
    return SearchDecision(
        action=_sanitize_action(actions[chosen_idx]) or {"type": "pass"},
        candidates=[dict(item) for item in actions],
        policy_target=visit_target,
        target_scores=avg_scores,
        metadata={
            "source": "model_search",
            "sims": max(1, sims),
            "depth": max(1, depth),
            "c_puct": float(c_puct),
            "dirichlet_alpha": float(dirichlet_alpha),
            "dirichlet_epsilon": float(dirichlet_epsilon),
            "rollout_temperature": float(rollout_temperature),
            "root_state_value": float(root_state_value),
            "search_actions": per_action,
        },
    )


def _heuristic_policy_scores(
    state: Dict,
    player_id: str,
    candidates: Sequence[Dict],
    depth: int,
) -> Tuple[List[float], str, Dict[str, object]]:
    scores = []
    for action in candidates:
        score, _, _ = _score_candidate_for_target(state, player_id, action, depth)
        scores.append(score)
    return scores, "heuristic", {"candidate_count": len(candidates)}


def _minimax_policy_scores(
    state: Dict,
    player_id: str,
    candidates: Sequence[Dict],
    depth: int,
    width: int,
) -> Tuple[List[float], str, Dict[str, object]]:
    heuristic_scores, _, _ = _heuristic_policy_scores(state, player_id, candidates, depth)
    score_map = {}
    search_depth = max(1, depth)
    search_width = max(2, width)
    for action in candidates:
        nxt = copy.deepcopy(state)
        _, err = guandan.GuandanGame.apply_action(nxt, player_id, action)
        if err:
            continue
        score_map[_action_key(action)] = guandan._minimax_value(
            nxt,
            player_id,
            search_depth - 1,
            -1e9,
            1e9,
            search_width,
            deadline=None,
        )
    if not score_map:
        return heuristic_scores, "heuristic", {"candidate_count": len(candidates), "fallback": "minimax_empty"}
    scores = [float(score_map.get(_action_key(action), heuristic_scores[idx])) for idx, action in enumerate(candidates)]
    return scores, "minimax", {"candidate_count": len(candidates), "depth": search_depth, "width": search_width}


def _mcts_policy_scores(
    state: Dict,
    player_id: str,
    candidates: Sequence[Dict],
    heuristic_scores: Sequence[float],
    sims: int,
    depth: int,
    tree_ply: int,
    reply_width: int,
    risk_lambda: float,
) -> Tuple[List[float], str, Dict[str, object]]:
    try:
        scored = guandan._mcts_score_actions(
            state,
            player_id,
            sims=max(2, sims),
            depth=max(2, depth),
            width=max(2, len(candidates)),
            tree_ply=max(0, tree_ply),
            reply_width=max(1, reply_width),
            risk_lambda=risk_lambda,
            deadline=None,
        )
    except Exception:
        return list(heuristic_scores), "heuristic", {"candidate_count": len(candidates), "fallback": "mcts_error"}

    if not scored:
        return list(heuristic_scores), "heuristic", {"candidate_count": len(candidates), "fallback": "mcts_empty"}

    score_map = {}
    positive_rollouts = 0
    for action, score, count, stats in scored:
        score_map[_action_key(action)] = float((stats or {}).get("adjusted", score))
        if count > 0 or (stats or {}).get("fast_path"):
            positive_rollouts += 1
    scores = [float(score_map.get(_action_key(action), heuristic_scores[idx])) for idx, action in enumerate(candidates)]
    source = "mcts" if positive_rollouts > 0 else "heuristic"
    meta = {
        "candidate_count": len(candidates),
        "sims": max(2, sims),
        "depth": max(2, depth),
        "tree_ply": max(0, tree_ply),
        "reply_width": max(1, reply_width),
        "risk_lambda": risk_lambda,
    }
    if source != "mcts":
        meta["fallback"] = "mcts_no_rollouts"
    return scores, source, meta


def _policy_target_scores(
    state: Dict,
    player_id: str,
    candidates: Sequence[Dict],
    depth: int,
    policy_target_source: str = "heuristic",
    reanalysis_candidate_cap: int = DEFAULT_REANALYSIS_CANDIDATE_CAP,
    reanalysis_mcts_sims: int = DEFAULT_REANALYSIS_MCTS_SIMS,
    reanalysis_mcts_depth: int = DEFAULT_REANALYSIS_MCTS_DEPTH,
    reanalysis_mcts_tree_ply: int = DEFAULT_REANALYSIS_MCTS_TREE_PLY,
    reanalysis_mcts_reply_width: int = DEFAULT_REANALYSIS_MCTS_REPLY_WIDTH,
    reanalysis_mcts_risk_lambda: float = DEFAULT_REANALYSIS_MCTS_RISK_LAMBDA,
    reanalysis_minimax_depth: int = DEFAULT_REANALYSIS_MINIMAX_DEPTH,
    reanalysis_minimax_width: int = DEFAULT_REANALYSIS_MINIMAX_WIDTH,
) -> Tuple[List[float], str, Dict[str, object]]:
    heuristic_scores, _, heuristic_meta = _heuristic_policy_scores(state, player_id, candidates, depth)
    source = (policy_target_source or "heuristic").strip().lower()
    if source != "search" or len(candidates) <= 1:
        return heuristic_scores, "heuristic", heuristic_meta

    candidate_cap = max(2, reanalysis_candidate_cap)
    if len(candidates) > candidate_cap:
        meta = dict(heuristic_meta)
        meta["fallback"] = "candidate_cap"
        meta["candidate_cap"] = candidate_cap
        return heuristic_scores, "heuristic", meta

    total_left = sum(len(state["players"][pid]["hand"]) for pid in state.get("turn_order", []))
    endgame_threshold = int((state.get("config") or {}).get("bot_endgame_threshold", DEFAULT_TRAIN_CONFIG["bot_endgame_threshold"]))
    if total_left <= endgame_threshold:
        return _minimax_policy_scores(
            state,
            player_id,
            candidates,
            depth=max(1, reanalysis_minimax_depth),
            width=max(2, reanalysis_minimax_width),
        )

    if guandan._should_use_mcts(state, player_id, min(candidate_cap, len(candidates))):
        return _mcts_policy_scores(
            state,
            player_id,
            candidates,
            heuristic_scores,
            sims=reanalysis_mcts_sims,
            depth=reanalysis_mcts_depth,
            tree_ply=reanalysis_mcts_tree_ply,
            reply_width=reanalysis_mcts_reply_width,
            risk_lambda=reanalysis_mcts_risk_lambda,
        )

    meta = dict(heuristic_meta)
    meta["fallback"] = "mcts_gate"
    return heuristic_scores, "heuristic", meta


@dataclass
class DecisionExample:
    state_features: List[float]
    action_features: List[List[float]]
    action_labels: List[str]
    chosen_index: int
    policy_target: List[float]
    outcome: float
    sample_weight: float
    player_id: str
    team: str
    round_number: int
    teacher: str
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)

    @staticmethod
    def from_dict(payload: Dict[str, object]) -> "DecisionExample":
        return DecisionExample(
            state_features=list(payload["state_features"]),
            action_features=[list(item) for item in payload["action_features"]],
            action_labels=list(payload["action_labels"]),
            chosen_index=int(payload["chosen_index"]),
            policy_target=list(payload.get("policy_target") or _one_hot_index(len(payload["action_labels"]), int(payload["chosen_index"]))),
            outcome=float(payload["outcome"]),
            sample_weight=float(payload.get("sample_weight", 1.0)),
            player_id=str(payload["player_id"]),
            team=str(payload["team"]),
            round_number=int(payload["round_number"]),
            teacher=str(payload["teacher"]),
            metadata=dict(payload.get("metadata") or {}),
        )


def decision_feature_dims() -> Tuple[int, int]:
    players = [
        {"player_id": "p0", "name": "P0", "seat": 0, "is_bot": True},
        {"player_id": "p1", "name": "P1", "seat": 1, "is_bot": True},
        {"player_id": "p2", "name": "P2", "seat": 2, "is_bot": True},
        {"player_id": "p3", "name": "P3", "seat": 3, "is_bot": True},
    ]
    state = guandan.GuandanGame.init_game(DEFAULT_TRAIN_CONFIG, players)
    player_id = state["current_turn"]
    candidates = guandan._candidate_actions(state, player_id, DEFAULT_CANDIDATE_LIMIT)
    if not candidates:
        raise RuntimeError("unable to infer Guandan NN feature dimensions")
    return len(_state_feature_vector(state, player_id)), len(_action_feature_vector(state, player_id, candidates[0]))


def _team_finish_value(order: List[str], team: str, state: Dict) -> float:
    team_positions = [idx + 1 for idx, pid in enumerate(order) if guandan._team_of(state, pid) == team]
    team_positions.sort()
    mapping = {
        (1, 2): 8.0,
        (1, 3): 5.0,
        (1, 4): 2.0,
        (2, 3): 1.0,
        (2, 4): -2.0,
        (3, 4): -6.0,
    }
    return mapping.get(tuple(team_positions), 0.0) / 8.0


def _candidate_actions_for_decision(state: Dict, player_id: str, limit: int, include_action: Optional[Dict]) -> List[Dict]:
    actions = [dict(item) for item in guandan._candidate_actions(state, player_id, limit)]
    if include_action:
        action_key = _action_key(include_action)
        if all(_action_key(action) != action_key for action in actions):
            actions.append(dict(include_action))
    deduped: List[Dict] = []
    seen = set()
    for action in actions:
        key = _action_key(action)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(action)
    return deduped


def build_decision_example(
    state: Dict,
    player_id: str,
    chosen_action: Dict,
    teacher: str = "bot",
    candidate_limit: int = DEFAULT_CANDIDATE_LIMIT,
    depth: int = 3,
    candidate_actions_override: Optional[Sequence[Dict]] = None,
    policy_target_override: Optional[Sequence[float]] = None,
    target_scores_override: Optional[Sequence[float]] = None,
    target_source_override: Optional[str] = None,
    target_meta_override: Optional[Dict[str, object]] = None,
    policy_target_source: str = "heuristic",
    reanalysis_candidate_cap: int = DEFAULT_REANALYSIS_CANDIDATE_CAP,
    reanalysis_mcts_sims: int = DEFAULT_REANALYSIS_MCTS_SIMS,
    reanalysis_mcts_depth: int = DEFAULT_REANALYSIS_MCTS_DEPTH,
    reanalysis_mcts_tree_ply: int = DEFAULT_REANALYSIS_MCTS_TREE_PLY,
    reanalysis_mcts_reply_width: int = DEFAULT_REANALYSIS_MCTS_REPLY_WIDTH,
    reanalysis_mcts_risk_lambda: float = DEFAULT_REANALYSIS_MCTS_RISK_LAMBDA,
    reanalysis_minimax_depth: int = DEFAULT_REANALYSIS_MINIMAX_DEPTH,
    reanalysis_minimax_width: int = DEFAULT_REANALYSIS_MINIMAX_WIDTH,
) -> DecisionExample:
    chosen_action = _sanitize_action(chosen_action)
    if not chosen_action:
        raise ValueError("chosen_action is required")
    state_features = _state_feature_vector(state, player_id)
    if candidate_actions_override is not None:
        candidates = [dict(item) for item in candidate_actions_override]
        if all(_action_key(item) != _action_key(chosen_action) for item in candidates):
            candidates.append(dict(chosen_action))
    else:
        candidates = _candidate_actions_for_decision(state, player_id, candidate_limit, chosen_action)
    chosen_key = _action_key(chosen_action)
    chosen_index = -1
    action_features: List[List[float]] = []
    action_labels: List[str] = []
    candidate_scores: List[float] = []
    candidate_combo_types: List[str] = []
    candidate_combo_sizes: List[int] = []
    for idx, action in enumerate(candidates):
        if _action_key(action) == chosen_key and chosen_index < 0:
            chosen_index = idx
        action_features.append(_action_feature_vector(state, player_id, action, depth=depth))
        action_labels.append(_action_label(state, player_id, action))
        raw_score, combo_type, combo_size = _score_candidate_for_target(state, player_id, action, depth)
        candidate_scores.append(raw_score)
        candidate_combo_types.append(combo_type)
        candidate_combo_sizes.append(combo_size)
    if chosen_index < 0:
        raise RuntimeError("chosen action not found in candidate set")
    if target_scores_override is not None:
        target_scores = [float(score) for score in target_scores_override]
        target_source = str(target_source_override or "override")
        target_meta = dict(target_meta_override or {})
    else:
        target_scores, target_source, target_meta = _policy_target_scores(
            state,
            player_id,
            candidates,
            depth=depth,
            policy_target_source=policy_target_source,
            reanalysis_candidate_cap=reanalysis_candidate_cap,
            reanalysis_mcts_sims=reanalysis_mcts_sims,
            reanalysis_mcts_depth=reanalysis_mcts_depth,
            reanalysis_mcts_tree_ply=reanalysis_mcts_tree_ply,
            reanalysis_mcts_reply_width=reanalysis_mcts_reply_width,
            reanalysis_mcts_risk_lambda=reanalysis_mcts_risk_lambda,
            reanalysis_minimax_depth=reanalysis_minimax_depth,
            reanalysis_minimax_width=reanalysis_minimax_width,
        )
    if len(target_scores) != len(candidate_scores):
        target_scores = list(candidate_scores)
        target_source = "heuristic"
        target_meta = {"fallback": "score_len_mismatch", "candidate_count": len(candidates)}
    chosen_score = target_scores[chosen_index]
    sorted_scores = sorted(target_scores, reverse=True)
    if policy_target_override is not None and len(policy_target_override) == len(candidates):
        policy_target = _normalize_policy(policy_target_override) or _build_policy_target(chosen_index, target_scores, teacher)
    else:
        policy_target = _build_policy_target(chosen_index, target_scores, teacher)
    sample_weight = _sample_weight_for_example(
        chosen_action,
        chosen_score,
        sorted_scores,
        candidate_combo_types[chosen_index],
        candidate_combo_sizes[chosen_index],
    )
    return DecisionExample(
        state_features=state_features,
        action_features=action_features,
        action_labels=action_labels,
        chosen_index=chosen_index,
        policy_target=policy_target,
        outcome=0.0,
        sample_weight=sample_weight,
        player_id=player_id,
        team=guandan._team_of(state, player_id),
        round_number=state.get("round_number", 1),
        teacher=teacher,
        metadata={
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "current_trick_type": ((state.get("current_trick") or {}).get("combo") or {}).get("type"),
            "candidate_scores": candidate_scores,
            "target_scores": target_scores,
            "chosen_score": chosen_score,
            "policy_target_source": target_source,
            "policy_target_meta": target_meta,
        },
    )


def _teacher_action(
    state: Dict,
    player_id: str,
    teacher: str,
    rng: random.Random,
    model: Optional["GuandanPolicyValueNet"] = None,
    device: str = "cpu",
    candidate_limit: int = DEFAULT_CANDIDATE_LIMIT,
    temperature: float = 0.0,
    teacher_mix: float = 0.0,
) -> Optional[Dict]:
    teacher = teacher.lower()
    if teacher == "mixed":
        if model is None:
            raise ValueError("mixed teacher requires a model")
        if rng.random() < max(0.0, min(1.0, teacher_mix)):
            return _teacher_action(state, player_id, "bot", rng, model=None, device=device, candidate_limit=candidate_limit)
        return _teacher_action(
            state,
            player_id,
            "model",
            rng,
            model=model,
            device=device,
            candidate_limit=candidate_limit,
            temperature=temperature,
        )
    if teacher == "bot":
        return _sanitize_action(guandan.GuandanGame.bot_move(state, player_id))
    if teacher == "heuristic":
        depth = int((state.get("config") or {}).get("bot_search_depth", 3))
        return _sanitize_action(guandan._heuristic_best_action(state, player_id, depth))
    if teacher == "random":
        actions = guandan._candidate_actions(state, player_id, candidate_limit)
        if not actions:
            return None
        return _sanitize_action(rng.choice(actions))
    if teacher == "model":
        if model is None:
            raise ValueError("model teacher requires a model")
        return select_model_action(
            model,
            state,
            player_id,
            device=device,
            candidate_limit=candidate_limit,
            temperature=temperature,
        )[0]
    raise ValueError(f"unknown teacher {teacher}")


def _auto_progress_action(state: Dict, player_id: str) -> Optional[Dict]:
    legal = guandan.GuandanGame.get_legal_actions(state, player_id)
    if not legal:
        return None
    if "tribute_select" in legal:
        hand = state["players"][player_id]["hand"]
        candidates = guandan._max_tribute_cards(hand, state["level_rank"])
        card = min(candidates, key=lambda item: guandan._single_order_value(item, state["level_rank"]))
        return {"type": "tribute_select", "card_id": card["id"]}
    if "return_select" in legal:
        hand = state["players"][player_id]["hand"]
        candidates = guandan._eligible_return_cards(hand)
        card = min(candidates, key=lambda item: guandan._single_order_value(item, state["level_rank"]))
        return {"type": "return_select", "card_id": card["id"]}
    if "next_round" in legal:
        return {"type": "next_round"}
    if "play_again" in legal:
        return {"type": "play_again"}
    return None


def collect_bootstrap_examples(
    episodes: int,
    teacher: str = "bot",
    seed: int = 0,
    candidate_limit: int = DEFAULT_CANDIDATE_LIMIT,
    model: Optional["GuandanPolicyValueNet"] = None,
    device: str = "cpu",
    rounds_per_episode: int = 1,
    teacher_mix: float = 0.2,
    temperature: float = 0.0,
    config_overrides: Optional[Dict] = None,
    verbose: bool = False,
    progress_label: str = "bootstrap",
    policy_target_source: str = "heuristic",
    reanalysis_candidate_cap: int = DEFAULT_REANALYSIS_CANDIDATE_CAP,
    reanalysis_mcts_sims: int = DEFAULT_REANALYSIS_MCTS_SIMS,
    reanalysis_mcts_depth: int = DEFAULT_REANALYSIS_MCTS_DEPTH,
    reanalysis_mcts_tree_ply: int = DEFAULT_REANALYSIS_MCTS_TREE_PLY,
    reanalysis_mcts_reply_width: int = DEFAULT_REANALYSIS_MCTS_REPLY_WIDTH,
    reanalysis_mcts_risk_lambda: float = DEFAULT_REANALYSIS_MCTS_RISK_LAMBDA,
    reanalysis_minimax_depth: int = DEFAULT_REANALYSIS_MINIMAX_DEPTH,
    reanalysis_minimax_width: int = DEFAULT_REANALYSIS_MINIMAX_WIDTH,
    model_search_sims: int = DEFAULT_MODEL_SEARCH_SIMS,
    model_search_depth: int = DEFAULT_MODEL_SEARCH_DEPTH,
    model_search_c_puct: float = DEFAULT_MODEL_SEARCH_C_PUCT,
    model_search_dirichlet_alpha: float = DEFAULT_MODEL_SEARCH_DIRICHLET_ALPHA,
    model_search_dirichlet_epsilon: float = DEFAULT_MODEL_SEARCH_DIRICHLET_EPSILON,
    model_search_rollout_temperature: float = DEFAULT_MODEL_SEARCH_TEMPERATURE,
) -> List[DecisionExample]:
    rng = random.Random(seed)
    examples: List[DecisionExample] = []
    started_at = time.perf_counter()

    if verbose and episodes > 0:
        _progress(
            f"{progress_label}: start episodes={episodes} teacher={teacher} rounds={rounds_per_episode}"
        )

    for episode_idx in range(episodes):
        players = [
            {"player_id": f"bot{seat}", "name": f"Bot {seat + 1}", "seat": seat, "is_bot": True}
            for seat in range(4)
        ]
        config = {**DEFAULT_TRAIN_CONFIG, **(config_overrides or {})}
        state = guandan.GuandanGame.init_game(config, players)
        round_examples: List[DecisionExample] = []
        rounds_finished = 0
        step_count = 0
        max_steps = 600

        while rounds_finished < rounds_per_episode and step_count < max_steps:
            step_count += 1
            acting_id = state.get("current_turn")
            if not acting_id:
                acting_id = state.get("turn_order", [None])[0]
            if not acting_id:
                break

            legal = guandan.GuandanGame.get_legal_actions(state, acting_id)
            if not legal:
                break

            if state.get("phase") == "playing" and ("play" in legal or "pass" in legal):
                search_decision: Optional[SearchDecision] = None
                if teacher == "model_search":
                    search_decision = _model_search_decision(
                        model,
                        state,
                        acting_id,
                        device=device,
                        candidate_limit=candidate_limit,
                        sims=model_search_sims,
                        depth=model_search_depth,
                        c_puct=model_search_c_puct,
                        dirichlet_alpha=model_search_dirichlet_alpha,
                        dirichlet_epsilon=model_search_dirichlet_epsilon,
                        rollout_temperature=model_search_rollout_temperature,
                        rng=rng,
                    )
                    action = search_decision.action if search_decision else None
                else:
                    action = _teacher_action(
                        state,
                        acting_id,
                        teacher,
                        rng,
                        model=model,
                        device=device,
                        candidate_limit=candidate_limit,
                        temperature=temperature,
                        teacher_mix=teacher_mix,
                    )
                if action is None:
                    break
                if action.get("type") in ("play", "pass"):
                    round_examples.append(
                        build_decision_example(
                            state,
                            acting_id,
                            action,
                            teacher=teacher,
                            candidate_limit=candidate_limit,
                            depth=int(config.get("bot_search_depth", 3)),
                            candidate_actions_override=search_decision.candidates if search_decision else None,
                            policy_target_override=search_decision.policy_target if search_decision else None,
                            target_scores_override=search_decision.target_scores if search_decision else None,
                            target_source_override=(search_decision.metadata or {}).get("source") if search_decision else None,
                            target_meta_override=search_decision.metadata if search_decision else None,
                            policy_target_source=policy_target_source,
                            reanalysis_candidate_cap=reanalysis_candidate_cap,
                            reanalysis_mcts_sims=reanalysis_mcts_sims,
                            reanalysis_mcts_depth=reanalysis_mcts_depth,
                            reanalysis_mcts_tree_ply=reanalysis_mcts_tree_ply,
                            reanalysis_mcts_reply_width=reanalysis_mcts_reply_width,
                            reanalysis_mcts_risk_lambda=reanalysis_mcts_risk_lambda,
                            reanalysis_minimax_depth=reanalysis_minimax_depth,
                            reanalysis_minimax_width=reanalysis_minimax_width,
                        )
                    )
            else:
                action = _auto_progress_action(state, acting_id)
                if action is None:
                    action = _teacher_action(
                        state,
                        acting_id,
                        "bot",
                        rng,
                        model=None,
                        candidate_limit=candidate_limit,
                    )
            if action is None:
                break

            _, err = guandan.GuandanGame.apply_action(state, acting_id, _sanitize_action(action))
            if err:
                raise RuntimeError(f"failed to apply action during data collection: {err}")

            if state.get("phase") == "round_end":
                finish_order = list((state.get("last_round_summary") or {}).get("finish_order") or state.get("finish_order") or [])
                for item in round_examples:
                    item.outcome = _team_finish_value(finish_order, item.team, state)
                    item.metadata["episode"] = episode_idx
                    item.metadata["round_finish_order"] = finish_order
                    examples.append(item)
                round_examples = []
                rounds_finished += 1
                if rounds_finished < rounds_per_episode:
                    next_round_player = state.get("turn_order", [None])[0]
                    if next_round_player:
                        _, err = guandan.GuandanGame.apply_action(state, next_round_player, {"type": "next_round"})
                        if err:
                            raise RuntimeError(f"failed to start next round during data collection: {err}")
        if round_examples:
            fallback_order = list(state.get("finish_order") or [])
            if len(fallback_order) == 4:
                for item in round_examples:
                    item.outcome = _team_finish_value(fallback_order, item.team, state)
                    item.metadata["episode"] = episode_idx
                    item.metadata["round_finish_order"] = fallback_order
                    examples.append(item)
        if verbose:
            done = episode_idx + 1
            elapsed = time.perf_counter() - started_at
            avg = elapsed / done
            eta = avg * max(0, episodes - done)
            _progress(
                f"{progress_label}: episode {done}/{episodes} "
                f"({done / max(1, episodes) * 100:.0f}%) "
                f"examples={len(examples)} elapsed={_format_duration(elapsed)} eta={_format_duration(eta)}"
            )
    if verbose and episodes > 0:
        total_elapsed = time.perf_counter() - started_at
        _progress(
            f"{progress_label}: done episodes={episodes} examples={len(examples)} "
            f"elapsed={_format_duration(total_elapsed)}"
        )
    return examples


def save_examples_jsonl(path: str, examples: Sequence[DecisionExample]) -> None:
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        for example in examples:
            handle.write(json.dumps(example.to_dict(), ensure_ascii=False) + "\n")


def load_examples_jsonl(path: str) -> List[DecisionExample]:
    examples: List[DecisionExample] = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            examples.append(DecisionExample.from_dict(json.loads(line)))
    return examples


def _cache_path(path: str) -> str:
    return os.path.abspath(path)


def _try_load_cached_examples(
    path: str,
    loaded_paths: set,
    verbose: bool = False,
    label: str = "cache",
) -> Tuple[Optional[List[DecisionExample]], bool, str]:
    resolved = _cache_path(path)
    if resolved in loaded_paths:
        if verbose:
            _progress(f"{label}: skip already loaded {resolved}")
        return [], True, resolved
    if not os.path.exists(resolved):
        return None, False, resolved
    examples = load_examples_jsonl(resolved)
    loaded_paths.add(resolved)
    if verbose:
        _progress(f"{label}: loaded {resolved} examples={len(examples)}")
    return examples, True, resolved


def _save_cached_examples(
    path: str,
    examples: Sequence[DecisionExample],
    verbose: bool = False,
    label: str = "cache",
) -> str:
    resolved = _cache_path(path)
    save_examples_jsonl(resolved, examples)
    if verbose:
        _progress(f"{label}: saved {resolved} examples={len(examples)}")
    return resolved


def _self_play_cache_path(root: str, iteration_index: int) -> str:
    return os.path.join(root, f"self_play_iter_{iteration_index + 1:03d}.jsonl")


class DecisionDatasetBase(Dataset):
    def __init__(self, examples: Sequence[DecisionExample]):
        self.examples = list(examples)

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> DecisionExample:
        return self.examples[index]


def collate_examples(batch: Sequence[DecisionExample]):
    if torch is None:
        raise RuntimeError("torch is required to collate training batches")
    if not batch:
        raise ValueError("empty batch")
    max_actions = max(len(item.action_features) for item in batch)
    state_dim = len(batch[0].state_features)
    action_dim = len(batch[0].action_features[0])
    states = torch.zeros(len(batch), state_dim, dtype=torch.float32)
    actions = torch.zeros(len(batch), max_actions, action_dim, dtype=torch.float32)
    mask = torch.zeros(len(batch), max_actions, dtype=torch.bool)
    chosen = torch.zeros(len(batch), dtype=torch.long)
    policy_target = torch.zeros(len(batch), max_actions, dtype=torch.float32)
    outcomes = torch.zeros(len(batch), dtype=torch.float32)
    sample_weight = torch.ones(len(batch), dtype=torch.float32)

    for row, item in enumerate(batch):
        states[row] = torch.tensor(item.state_features, dtype=torch.float32)
        chosen[row] = item.chosen_index
        outcomes[row] = item.outcome
        sample_weight[row] = item.sample_weight
        if item.policy_target:
            policy_target[row, : len(item.policy_target)] = torch.tensor(item.policy_target, dtype=torch.float32)
        for col, action_features in enumerate(item.action_features):
            actions[row, col] = torch.tensor(action_features, dtype=torch.float32)
            mask[row, col] = True
    return {
        "state": states,
        "actions": actions,
        "mask": mask,
        "chosen": chosen,
        "policy_target": policy_target,
        "outcome": outcomes,
        "sample_weight": sample_weight,
    }


if torch is None:  # pragma: no cover - exercised only when torch is missing
    class GuandanPolicyValueNet:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("torch is required to build GuandanPolicyValueNet")
else:
    class GuandanPolicyValueNet(nn.Module):
        def __init__(self, state_dim: int, action_dim: int, hidden_dim: int = 192, dropout: float = 0.1):
            super().__init__()
            self.state_dim = state_dim
            self.action_dim = action_dim
            self.hidden_dim = hidden_dim
            self.dropout = dropout
            self.state_encoder = nn.Sequential(
                nn.Linear(state_dim, hidden_dim),
                nn.LayerNorm(hidden_dim),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, hidden_dim),
                nn.GELU(),
            )
            self.action_encoder = nn.Sequential(
                nn.Linear(action_dim, hidden_dim),
                nn.LayerNorm(hidden_dim),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, hidden_dim),
                nn.GELU(),
            )
            self.joint = nn.Sequential(
                nn.Linear(hidden_dim * 3, hidden_dim),
                nn.GELU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim, hidden_dim // 2),
                nn.GELU(),
            )
            self.policy_head = nn.Linear(hidden_dim // 2, 1)
            self.value_head = nn.Sequential(
                nn.Linear(hidden_dim, hidden_dim // 2),
                nn.GELU(),
                nn.Linear(hidden_dim // 2, 1),
            )

        def forward(self, state_tensor, action_tensor, action_mask):
            batch_size, action_count, _ = action_tensor.shape
            state_hidden = self.state_encoder(state_tensor)
            action_hidden = self.action_encoder(action_tensor.view(batch_size * action_count, -1)).view(
                batch_size, action_count, -1
            )
            expanded_state = state_hidden.unsqueeze(1).expand(-1, action_count, -1)
            joint_input = torch.cat(
                [expanded_state, action_hidden, expanded_state * action_hidden],
                dim=-1,
            )
            joint_hidden = self.joint(joint_input)
            logits = self.policy_head(joint_hidden).squeeze(-1)
            logits = logits.masked_fill(~action_mask, -1e9)
            value = torch.tanh(self.value_head(state_hidden).squeeze(-1))
            return logits, value


def build_model(hidden_dim: int = 192, dropout: float = 0.1) -> "GuandanPolicyValueNet":
    if torch is None:
        raise RuntimeError("torch is required to build the Guandan NN model")
    state_dim, action_dim = decision_feature_dims()
    return GuandanPolicyValueNet(state_dim, action_dim, hidden_dim=hidden_dim, dropout=dropout)


@dataclass
class TrainingStats:
    epoch: int
    loss: float
    policy_loss: float
    value_loss: float
    policy_accuracy: float


def _iterate_batches(
    examples: Sequence[DecisionExample],
    batch_size: int,
    shuffle: bool,
):
    if torch is None:
        raise RuntimeError("torch is required to iterate training batches")
    dataset = DecisionDatasetBase(examples)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=shuffle, collate_fn=collate_examples)
    for batch in loader:
        yield batch


def train_model(
    model: "GuandanPolicyValueNet",
    examples: Sequence[DecisionExample],
    epochs: int = 4,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    value_weight: float = 0.35,
    device: str = "cpu",
    seed: int = 0,
    verbose: bool = False,
    progress_label: str = "train",
) -> List[TrainingStats]:
    if torch is None:
        raise RuntimeError("torch is required to train the Guandan NN model")
    if not examples:
        raise ValueError("examples must not be empty")

    torch.manual_seed(seed)
    model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
    history: List[TrainingStats] = []
    started_at = time.perf_counter()

    if verbose and epochs > 0:
        _progress(
            f"{progress_label}: start epochs={epochs} examples={len(examples)} "
            f"batch_size={batch_size} lr={learning_rate:g} device={device}"
        )

    for epoch_idx in range(epochs):
        model.train()
        loss_sum = 0.0
        policy_sum = 0.0
        value_sum = 0.0
        correct = 0
        total = 0
        batch_count = 0

        for batch in _iterate_batches(examples, batch_size=batch_size, shuffle=True):
            batch_count += 1
            states = batch["state"].to(device)
            actions = batch["actions"].to(device)
            mask = batch["mask"].to(device)
            chosen = batch["chosen"].to(device)
            policy_target = batch["policy_target"].to(device)
            outcome = batch["outcome"].to(device)
            sample_weight = batch["sample_weight"].to(device)
            sample_weight_sum = torch.clamp(sample_weight.sum(), min=1e-6)

            optimizer.zero_grad()
            logits, value = model(states, actions, mask)
            hard_policy_loss = F.cross_entropy(logits, chosen, reduction="none")
            log_probs = F.log_softmax(logits, dim=1)
            soft_policy_loss = -(policy_target * log_probs).sum(dim=1)
            combined_policy = (1.0 - POLICY_TARGET_BLEND) * hard_policy_loss + POLICY_TARGET_BLEND * soft_policy_loss
            policy_loss = (combined_policy * sample_weight).sum() / sample_weight_sum
            value_error = F.smooth_l1_loss(value, outcome, reduction="none")
            value_loss = (value_error * sample_weight).sum() / sample_weight_sum
            loss = policy_loss + value_weight * value_loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            loss_sum += float(loss.item())
            policy_sum += float(policy_loss.item())
            value_sum += float(value_loss.item())
            preds = torch.argmax(logits, dim=1)
            correct += int((preds == chosen).sum().item())
            total += int(chosen.numel())

        history.append(
            TrainingStats(
                epoch=epoch_idx + 1,
                loss=loss_sum / max(1, batch_count),
                policy_loss=policy_sum / max(1, batch_count),
                value_loss=value_sum / max(1, batch_count),
                policy_accuracy=correct / max(1, total),
            )
        )
        if verbose:
            stat = history[-1]
            done = epoch_idx + 1
            elapsed = time.perf_counter() - started_at
            avg = elapsed / done
            eta = avg * max(0, epochs - done)
            _progress(
                f"{progress_label}: epoch {done}/{epochs} "
                f"loss={stat.loss:.4f} policy={stat.policy_loss:.4f} "
                f"value={stat.value_loss:.4f} acc={stat.policy_accuracy:.1%} "
                f"elapsed={_format_duration(elapsed)} eta={_format_duration(eta)}"
            )
    if verbose and epochs > 0:
        total_elapsed = time.perf_counter() - started_at
        _progress(f"{progress_label}: done elapsed={_format_duration(total_elapsed)}")
    return history


def evaluate_actions(
    model: "GuandanPolicyValueNet",
    state: Dict,
    player_id: str,
    actions: Sequence[Dict],
    device: str = "cpu",
) -> Tuple[List[Tuple[Dict, float]], float]:
    if torch is None:
        raise RuntimeError("torch is required to score actions with the Guandan NN model")
    if not actions:
        return [], 0.0
    model.eval()
    state_features = _state_feature_vector(state, player_id)
    action_features = [_action_feature_vector(state, player_id, action) for action in actions]
    with torch.no_grad():
        state_tensor = torch.tensor([state_features], dtype=torch.float32, device=device)
        action_tensor = torch.tensor([action_features], dtype=torch.float32, device=device)
        mask = torch.ones((1, len(actions)), dtype=torch.bool, device=device)
        logits, value = model(state_tensor, action_tensor, mask)
        values = logits[0].detach().cpu().tolist()
        state_value = float(value[0].detach().cpu().item())
    return list(zip(actions, values)), state_value


def score_actions(
    model: "GuandanPolicyValueNet",
    state: Dict,
    player_id: str,
    actions: Sequence[Dict],
    device: str = "cpu",
) -> List[Tuple[Dict, float]]:
    scored, _ = evaluate_actions(model, state, player_id, actions, device=device)
    return scored


def select_model_action(
    model: "GuandanPolicyValueNet",
    state: Dict,
    player_id: str,
    device: str = "cpu",
    candidate_limit: int = DEFAULT_CANDIDATE_LIMIT,
    temperature: float = 0.0,
) -> Tuple[Optional[Dict], List[Tuple[str, float]], float]:
    if torch is None:
        raise RuntimeError("torch is required to select model actions")
    actions = guandan._candidate_actions(state, player_id, candidate_limit)
    if not actions:
        return None, [], 0.0
    scored, state_value = evaluate_actions(model, state, player_id, actions, device=device)
    labels = [(_action_label(state, player_id, action), score) for action, score in scored]
    if temperature > 1e-6:
        logits = [score / temperature for _, score in scored]
        max_logit = max(logits)
        exp_values = [math.exp(value - max_logit) for value in logits]
        total = sum(exp_values)
        pick = random.random() * total
        cumulative = 0.0
        for (action, _), weight in zip(scored, exp_values):
            cumulative += weight
            if pick <= cumulative:
                return _sanitize_action(action), labels, state_value
    best_action, _ = max(scored, key=lambda item: item[1])
    return _sanitize_action(best_action), labels, state_value


def save_checkpoint(
    path: str,
    model: "GuandanPolicyValueNet",
    history: Sequence[TrainingStats],
    extra: Optional[Dict[str, object]] = None,
) -> None:
    if torch is None:
        raise RuntimeError("torch is required to save checkpoints")
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    payload = {
        "state_dict": model.state_dict(),
        "state_dim": getattr(model, "state_dim"),
        "action_dim": getattr(model, "action_dim"),
        "hidden_dim": getattr(model, "hidden_dim"),
        "dropout": getattr(model, "dropout"),
        "history": [asdict(item) for item in history],
        "extra": extra or {},
    }
    torch.save(payload, path)


def load_checkpoint(path: str, device: str = "cpu") -> Tuple["GuandanPolicyValueNet", Dict[str, object]]:
    if torch is None:
        raise RuntimeError("torch is required to load checkpoints")
    payload = torch.load(path, map_location=device)
    model = GuandanPolicyValueNet(
        int(payload["state_dim"]),
        int(payload["action_dim"]),
        hidden_dim=int(payload.get("hidden_dim", 192)),
        dropout=float(payload.get("dropout", 0.1)),
    )
    model.load_state_dict(payload["state_dict"])
    model.to(device)
    return model, payload


def run_training_pipeline(args) -> Dict[str, object]:
    if torch is None:
        raise RuntimeError("torch is required to run the Guandan NN training pipeline")

    device = args.device
    verbose = not args.quiet
    random.seed(args.seed)
    torch.manual_seed(args.seed)

    examples: List[DecisionExample] = []
    model: Optional[GuandanPolicyValueNet] = None
    metadata: Dict[str, object] = {}
    loaded_example_paths: set = set()

    if verbose:
        _progress(
            f"training start: device={device} bootstrap={args.bootstrap_episodes} "
            f"epochs={args.epochs} self_play={args.self_play_iterations}x{args.self_play_episodes} "
            f"self_play_policy={args.self_play_policy}"
        )

    if args.load_checkpoint:
        model, payload = load_checkpoint(args.load_checkpoint, device=device)
        metadata["loaded_checkpoint"] = args.load_checkpoint
        metadata["loaded_history"] = payload.get("history", [])
        if verbose:
            _progress(f"loaded checkpoint: {args.load_checkpoint}")

    if args.dataset_in:
        examples.extend(load_examples_jsonl(args.dataset_in))
        loaded_example_paths.add(_cache_path(args.dataset_in))
        if verbose:
            _progress(f"loaded dataset: {args.dataset_in} examples={len(examples)}")

    bootstrap_examples: List[DecisionExample] = []
    bootstrap_cache_hit = False
    if args.bootstrap_cache:
        cached_examples, bootstrap_cache_hit, _resolved = _try_load_cached_examples(
            args.bootstrap_cache,
            loaded_example_paths,
            verbose=verbose,
            label="bootstrap cache",
        )
        if cached_examples is not None:
            bootstrap_examples = cached_examples

    if args.bootstrap_episodes > 0 and not bootstrap_cache_hit:
        bootstrap_teacher = args.teacher if model is None else args.teacher
        bootstrap_examples = collect_bootstrap_examples(
                args.bootstrap_episodes,
                teacher=bootstrap_teacher,
                seed=args.seed,
                candidate_limit=args.candidate_limit,
                model=model,
                device=device,
                rounds_per_episode=args.rounds_per_episode,
                teacher_mix=args.teacher_mix,
                temperature=args.temperature,
                verbose=verbose,
                progress_label="bootstrap",
                policy_target_source=args.policy_target_source,
                reanalysis_candidate_cap=args.reanalysis_candidate_cap,
                reanalysis_mcts_sims=args.reanalysis_mcts_sims,
                reanalysis_mcts_depth=args.reanalysis_mcts_depth,
                reanalysis_mcts_tree_ply=args.reanalysis_mcts_tree_ply,
                reanalysis_mcts_reply_width=args.reanalysis_mcts_reply_width,
                reanalysis_mcts_risk_lambda=args.reanalysis_mcts_risk_lambda,
                reanalysis_minimax_depth=args.reanalysis_minimax_depth,
                reanalysis_minimax_width=args.reanalysis_minimax_width,
                model_search_sims=args.model_search_sims,
                model_search_depth=args.model_search_depth,
                model_search_c_puct=args.model_search_c_puct,
                model_search_dirichlet_alpha=args.model_search_dirichlet_alpha,
                model_search_dirichlet_epsilon=args.model_search_dirichlet_epsilon,
                model_search_rollout_temperature=args.model_search_rollout_temperature,
            )
        if args.bootstrap_cache:
            loaded_example_paths.add(
                _save_cached_examples(
                    args.bootstrap_cache,
                    bootstrap_examples,
                    verbose=verbose,
                    label="bootstrap cache",
                )
            )
    examples.extend(bootstrap_examples)
    if args.bootstrap_episodes > 0 or bootstrap_cache_hit:
        if verbose:
            _progress(f"bootstrap complete: examples={len(examples)}")

    if model is None:
        model = build_model(hidden_dim=args.hidden_dim, dropout=args.dropout)
        if verbose:
            _progress(
                f"built model: hidden_dim={args.hidden_dim} dropout={args.dropout:g}"
            )

    history: List[TrainingStats] = []
    if args.epochs > 0 and examples:
        history.extend(
            train_model(
                model,
                examples,
                epochs=args.epochs,
                batch_size=args.batch_size,
                learning_rate=args.learning_rate,
                value_weight=args.value_weight,
                device=device,
                seed=args.seed,
                verbose=verbose,
                progress_label="train/bootstrap",
            )
        )

    for iteration in range(args.self_play_iterations):
        label = f"self-play {iteration + 1}/{args.self_play_iterations}"
        self_play_teacher = "model_search" if args.self_play_policy == "search" else ("mixed" if args.teacher_mix > 0 else "model")
        new_examples: List[DecisionExample] = []
        self_play_cache_hit = False
        self_play_cache_path = ""
        if args.self_play_cache_dir:
            os.makedirs(args.self_play_cache_dir, exist_ok=True)
            self_play_cache_path = _self_play_cache_path(args.self_play_cache_dir, iteration)
            cached_examples, self_play_cache_hit, _resolved = _try_load_cached_examples(
                self_play_cache_path,
                loaded_example_paths,
                verbose=verbose,
                label=f"{label}/cache",
            )
            if cached_examples is not None:
                new_examples = cached_examples
        if not self_play_cache_hit:
            new_examples = collect_bootstrap_examples(
                args.self_play_episodes,
                teacher=self_play_teacher,
                seed=args.seed + iteration + 1,
                candidate_limit=args.candidate_limit,
                model=model,
                device=device,
                rounds_per_episode=args.rounds_per_episode,
                teacher_mix=args.teacher_mix,
                temperature=args.temperature,
                verbose=verbose,
                progress_label=f"{label}/collect",
                policy_target_source=args.policy_target_source,
                reanalysis_candidate_cap=args.reanalysis_candidate_cap,
                reanalysis_mcts_sims=args.reanalysis_mcts_sims,
                reanalysis_mcts_depth=args.reanalysis_mcts_depth,
                reanalysis_mcts_tree_ply=args.reanalysis_mcts_tree_ply,
                reanalysis_mcts_reply_width=args.reanalysis_mcts_reply_width,
                reanalysis_mcts_risk_lambda=args.reanalysis_mcts_risk_lambda,
                reanalysis_minimax_depth=args.reanalysis_minimax_depth,
                reanalysis_minimax_width=args.reanalysis_minimax_width,
                model_search_sims=args.model_search_sims,
                model_search_depth=args.model_search_depth,
                model_search_c_puct=args.model_search_c_puct,
                model_search_dirichlet_alpha=args.model_search_dirichlet_alpha,
                model_search_dirichlet_epsilon=args.model_search_dirichlet_epsilon,
                model_search_rollout_temperature=args.model_search_rollout_temperature,
            )
            if self_play_cache_path:
                loaded_example_paths.add(
                    _save_cached_examples(
                        self_play_cache_path,
                        new_examples,
                        verbose=verbose,
                        label=f"{label}/cache",
                    )
                )
        examples.extend(new_examples)
        if verbose:
            _progress(f"{label}: collected={len(new_examples)} total_examples={len(examples)}")
        if new_examples and args.self_play_epochs > 0:
            history.extend(
                train_model(
                    model,
                    examples,
                    epochs=args.self_play_epochs,
                    batch_size=args.batch_size,
                    learning_rate=args.learning_rate,
                    value_weight=args.value_weight,
                    device=device,
                    seed=args.seed + iteration + 1,
                    verbose=verbose,
                    progress_label=f"{label}/train",
                )
            )

    if args.dataset_out:
        save_examples_jsonl(args.dataset_out, examples)
        if verbose:
            _progress(f"saved dataset: {args.dataset_out} examples={len(examples)}")
    if args.save_checkpoint:
        save_checkpoint(
            args.save_checkpoint,
            model,
            history,
            extra={
                "example_count": len(examples),
                "args": vars(args),
            },
        )
        if verbose:
            _progress(f"saved checkpoint: {args.save_checkpoint}")
    if verbose:
        _progress(f"training complete: examples={len(examples)} history_points={len(history)}")
    return {
        "example_count": len(examples),
        "history": [asdict(item) for item in history],
    }


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train a small Guandan policy-value network")
    parser.add_argument("--bootstrap-episodes", type=int, default=12)
    parser.add_argument("--teacher", choices=("bot", "heuristic", "random"), default="bot")
    parser.add_argument("--rounds-per-episode", type=int, default=1)
    parser.add_argument("--candidate-limit", type=int, default=DEFAULT_CANDIDATE_LIMIT)
    parser.add_argument("--dataset-in", type=str, default="")
    parser.add_argument("--dataset-out", type=str, default="")
    parser.add_argument("--bootstrap-cache", type=str, default="")
    parser.add_argument("--self-play-cache-dir", type=str, default="")
    parser.add_argument("--load-checkpoint", type=str, default="")
    parser.add_argument("--save-checkpoint", type=str, default="")
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--self-play-iterations", type=int, default=0)
    parser.add_argument("--self-play-episodes", type=int, default=6)
    parser.add_argument("--self-play-epochs", type=int, default=2)
    parser.add_argument("--self-play-policy", choices=("model", "search"), default=DEFAULT_SELF_PLAY_POLICY)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--value-weight", type=float, default=0.35)
    parser.add_argument("--hidden-dim", type=int, default=192)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--teacher-mix", type=float, default=0.25)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--policy-target-source", choices=("heuristic", "search"), default=DEFAULT_POLICY_TARGET_SOURCE)
    parser.add_argument("--reanalysis-candidate-cap", type=int, default=DEFAULT_REANALYSIS_CANDIDATE_CAP)
    parser.add_argument("--reanalysis-mcts-sims", type=int, default=DEFAULT_REANALYSIS_MCTS_SIMS)
    parser.add_argument("--reanalysis-mcts-depth", type=int, default=DEFAULT_REANALYSIS_MCTS_DEPTH)
    parser.add_argument("--reanalysis-mcts-tree-ply", type=int, default=DEFAULT_REANALYSIS_MCTS_TREE_PLY)
    parser.add_argument("--reanalysis-mcts-reply-width", type=int, default=DEFAULT_REANALYSIS_MCTS_REPLY_WIDTH)
    parser.add_argument("--reanalysis-mcts-risk-lambda", type=float, default=DEFAULT_REANALYSIS_MCTS_RISK_LAMBDA)
    parser.add_argument("--reanalysis-minimax-depth", type=int, default=DEFAULT_REANALYSIS_MINIMAX_DEPTH)
    parser.add_argument("--reanalysis-minimax-width", type=int, default=DEFAULT_REANALYSIS_MINIMAX_WIDTH)
    parser.add_argument("--model-search-sims", type=int, default=DEFAULT_MODEL_SEARCH_SIMS)
    parser.add_argument("--model-search-depth", type=int, default=DEFAULT_MODEL_SEARCH_DEPTH)
    parser.add_argument("--model-search-c-puct", type=float, default=DEFAULT_MODEL_SEARCH_C_PUCT)
    parser.add_argument("--model-search-dirichlet-alpha", type=float, default=DEFAULT_MODEL_SEARCH_DIRICHLET_ALPHA)
    parser.add_argument("--model-search-dirichlet-epsilon", type=float, default=DEFAULT_MODEL_SEARCH_DIRICHLET_EPSILON)
    parser.add_argument("--model-search-rollout-temperature", type=float, default=DEFAULT_MODEL_SEARCH_TEMPERATURE)
    parser.add_argument("--quiet", action="store_true")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    result = run_training_pipeline(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
