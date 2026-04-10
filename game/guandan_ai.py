import copy
import math
import random
import time
from typing import Dict, List, Optional, Tuple

BOMB_TYPES = ("bomb", "straight_flush", "heavenly")

_CORE = None


def call(core, name: str, *args, **kwargs):
    global _CORE
    prev = _CORE
    _CORE = core
    try:
        return globals()[name](*args, **kwargs)
    finally:
        _CORE = prev


def _proxy(name: str):
    def wrapped(*args, **kwargs):
        if _CORE is None:
            raise RuntimeError(f"guandan_ai.{name} called without core binding")
        return getattr(_CORE, name)(*args, **kwargs)

    wrapped.__name__ = name
    return wrapped


class _GuandanGameProxy:
    def __getattr__(self, name: str):
        if _CORE is None:
            raise RuntimeError("guandan_ai.GuandanGame accessed without core binding")
        return getattr(_CORE.GuandanGame, name)


GuandanGame = _GuandanGameProxy()
_map_hand_by_id = _proxy("_map_hand_by_id")
_card_label = _proxy("_card_label")
_remove_cards = _proxy("_remove_cards")
_single_order_value = _proxy("_single_order_value")
_point_order_value = _proxy("_point_order_value")
_is_joker = _proxy("_is_joker")
_is_wild = _proxy("_is_wild")
_evaluate_combo = _proxy("_evaluate_combo")
_team_of = _proxy("_team_of")
_teammate_of = _proxy("_teammate_of")
_best_response_play_score = _proxy("_best_response_play_score")
_best_takeover_opportunity = _proxy("_best_takeover_opportunity")
_takeover_opportunity_score = _proxy("_takeover_opportunity_score")
_response_material_cost = _proxy("_response_material_cost")
_control_group_break_penalty = _proxy("_control_group_break_penalty")
_group_fragment_penalty = _proxy("_group_fragment_penalty")
_shape_transition_score = _proxy("_shape_transition_score")
_play_structure_delta = _proxy("_play_structure_delta")
_rank_count_map = _proxy("_rank_count_map")
_cards_use_special_material = _proxy("_cards_use_special_material")
_hand_info = _proxy("_hand_info")
_rank_strength = _proxy("_rank_strength")
_list_hint_options = _proxy("_list_hint_options")
_list_single_options = _proxy("_list_single_options")
_list_rank_group_options = _proxy("_list_rank_group_options")
_list_full_house_options = _proxy("_list_full_house_options")
_list_straight_options = _proxy("_list_straight_options")
_list_three_pairs_options = _proxy("_list_three_pairs_options")
_list_steel_plate_options = _proxy("_list_steel_plate_options")
_rank_response_options = _proxy("_rank_response_options")
_rank_lead_options = _proxy("_rank_lead_options")
_choose_lead_play = _proxy("_choose_lead_play")
_can_play_all = _proxy("_can_play_all")
_minimal_bomb_response = _proxy("_minimal_bomb_response")
_find_bomb_candidates = _proxy("_find_bomb_candidates")
_compare_combos = _proxy("_compare_combos")
_combo_value = _proxy("_combo_value")
_lead_option_score = _proxy("_lead_option_score")
_max_tribute_cards = _proxy("_max_tribute_cards")
_eligible_return_cards = _proxy("_eligible_return_cards")
_full_deck = _proxy("_full_deck")
_hypergeom_hit_probability = _proxy("_hypergeom_hit_probability")
_bomb_tier = _proxy("_bomb_tier")


def _teammate_future_control_probability(state: Dict, player_id: str) -> float:
    current_trick = state.get("current_trick")
    if not current_trick:
        return 0.0
    teammate = _teammate_of(state, player_id)
    if not teammate or state["players"][teammate]["finished"]:
        return 0.0
    if teammate in (state.get("trick_plays") or {}):
        return 0.0
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return 0.0
    combo = current_trick.get("combo") or {}
    if combo.get("type") != "single":
        return 0.0
    threshold = combo.get("rank_value", 0)
    if threshold != 70:
        return 0.0

    level_rank = state["level_rank"]
    known_ids = set(state.get("seen_cards", []) or [])
    known_ids.update(card["id"] for card in state["players"].get(player_id, {}).get("hand", []))
    known_ids.update((current_trick.get("cards") or []))

    full = _full_deck()
    unknown_cards = [card for card in full if card["id"] not in known_ids]
    target_hits = [card for card in unknown_cards if _single_order_value(card, level_rank) > threshold]
    if not target_hits:
        return 0.0

    teammate_count = len(state["players"][teammate]["hand"])
    return _hypergeom_hit_probability(len(unknown_cards), len(target_hits), teammate_count)


def _teammate_lead_context(state: Dict, player_id: str) -> Optional[str]:
    current_trick = state.get("current_trick")
    if not current_trick:
        return None
    teammate = _teammate_of(state, player_id)
    if not teammate:
        return None
    if current_trick.get("player_id") != teammate:
        return None
    return teammate


def _teammate_protect_bonus(state: Dict, player_id: str) -> float:
    teammate = _teammate_lead_context(state, player_id)
    if not teammate:
        return 0.0
    active_counts = [
        len(state["players"][pid]["hand"])
        for pid in state["turn_order"]
        if not state["players"][pid]["finished"]
    ]
    teammate_left = len(state["players"][teammate]["hand"])
    opp_counts = [
        len(state["players"][pid]["hand"])
        for pid in state["turn_order"]
        if _team_of(state, pid) != _team_of(state, player_id) and not state["players"][pid]["finished"]
    ]
    bonus = 4.0
    if active_counts and min(active_counts) >= 10:
        bonus += 4.0
    elif teammate_left >= 8:
        bonus += 2.5
    if opp_counts and min(opp_counts) >= 8:
        bonus += 1.5
    return bonus


def _combo_numeric_value(combo: Dict) -> int:
    if combo.get("type") in ("straight", "three_pairs", "steel_plate"):
        return combo.get("high_value", 0)
    return combo.get("rank_value", 0)


def _next_active_after(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order") or []
    if not order:
        return None
    if player_id not in order:
        return order[0]
    idx = order.index(player_id)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if not state["players"][pid]["finished"]:
            return pid
    return None


def _lead_short_next_opponent_penalty(state: Dict, player_id: str, cards: List[int]) -> float:
    if not cards or state.get("current_trick"):
        return 0.0

    next_pid = _next_active_after(state, player_id)
    if not next_pid or _team_of(state, next_pid) == _team_of(state, player_id):
        return 0.0

    next_left = len(state["players"][next_pid]["hand"])
    if next_left > 2:
        return 0.0

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo or combo.get("type") != "single":
        return 0.0

    rank_value = combo.get("rank_value", 0)
    if rank_value >= 90:
        return 0.0

    pressure = max(0.0, 60.0 - float(rank_value))
    penalty = pressure * (1.45 if next_left <= 1 else 0.75)
    penalty += 6.0 if next_left <= 1 else 2.5

    if rank_value >= 70:
        penalty *= 0.12
    elif rank_value >= 60:
        penalty *= 0.42
    elif rank_value >= 58:
        penalty *= 0.7

    remaining = max(0, len(hand) - len(cards))
    if remaining <= 4:
        penalty *= 0.65
    if remaining <= 2:
        penalty *= 0.7
    return max(0.0, penalty)


def _teammate_lead_strength(state: Dict, player_id: str) -> float:
    teammate = _teammate_lead_context(state, player_id)
    if not teammate:
        return 0.0
    current_combo = (state.get("current_trick") or {}).get("combo") or {}
    combo_type = current_combo.get("type")
    value = _combo_numeric_value(current_combo)
    level_rank = state["level_rank"]
    if combo_type in BOMB_TYPES:
        return 18.0 + _bomb_tier(current_combo) * 2.0
    if combo_type == "single":
        if value >= 90:
            return 16.0
        if value >= 80:
            return 13.0
        if value >= _point_order_value(14, level_rank):
            return 9.0
        return 0.0
    if combo_type in ("pair", "three", "full_house"):
        if value >= _point_order_value(13, level_rank):
            return 11.0 + max(0.0, value - _point_order_value(13, level_rank)) * 2.0
        if value >= _point_order_value(12, level_rank):
            return 6.0
        return 0.0
    if combo_type in ("straight", "three_pairs", "steel_plate"):
        if value >= 13:
            return 10.0
        if value >= 12:
            return 5.0
    return 0.0


def _breaks_bomb_shape(hand: List[Dict], cards: List[int], level_rank: int) -> bool:
    if not cards:
        return False
    selected = set(cards)
    total_by_rank: Dict[int, int] = {}
    used_by_rank: Dict[int, int] = {}
    for card in hand:
        if card.get("joker") in ("big", "small"):
            continue
        if card.get("suit") == "hearts" and card.get("rank") == level_rank:
            continue
        rank = card.get("rank")
        if rank is None:
            continue
        total_by_rank[rank] = total_by_rank.get(rank, 0) + 1
        if card["id"] in selected:
            used_by_rank[rank] = used_by_rank.get(rank, 0) + 1
    for rank, total in total_by_rank.items():
        used = used_by_rank.get(rank, 0)
        if total >= 4 and 0 < used < total:
            return True
    return False


def _teammate_overtrick_penalty(
    state: Dict,
    player_id: str,
    cards: List[int],
    combo: Dict,
    remaining_count: int,
) -> float:
    teammate = _teammate_lead_context(state, player_id)
    if not teammate:
        return 0.0
    hand = state["players"][player_id]["hand"]
    hand_count = len(hand)
    if remaining_count == 0 or len(cards) == hand_count:
        return 0.0
    teammate_left = len(state["players"][teammate]["hand"])
    current_combo = (state.get("current_trick") or {}).get("combo", {})
    penalty = _teammate_protect_bonus(state, player_id) * 0.6
    lead_strength = _teammate_lead_strength(state, player_id)
    penalty += lead_strength * 0.75
    if combo["type"] not in BOMB_TYPES and _breaks_bomb_shape(hand, cards, state["level_rank"]):
        penalty += 18.0 if lead_strength >= 8.0 else 10.0
    if combo["type"] in BOMB_TYPES:
        penalty += 8.0 + _bomb_tier(combo) * 2.5
        if current_combo.get("type") not in BOMB_TYPES:
            penalty += 4.0
    response_cost = _response_material_cost(state, player_id, cards, combo)
    if response_cost > 0:
        penalty += response_cost * (0.65 if lead_strength >= 8.0 else 0.42)
    if combo.get("type") == current_combo.get("type"):
        margin = max(0.0, _combo_numeric_value(combo) - _combo_numeric_value(current_combo))
        if lead_strength >= 8.0:
            penalty += max(0.0, 2.8 - margin * 1.4)
    if (
        combo.get("type") in ("pair", "three", "full_house")
        and _combo_numeric_value(combo) >= _point_order_value(14, state["level_rank"])
        and lead_strength >= 8.0
    ):
        penalty += 3.0
    if teammate_left <= 2:
        penalty -= 7.0
    elif teammate_left <= 4:
        penalty -= 4.0
    if remaining_count <= 2:
        penalty -= 6.0
    return max(0.0, penalty)


def _high_single_bomb_profile(state: Dict, player_id: str) -> Optional[Dict]:
    current_trick = state.get("current_trick")
    if not current_trick:
        return None
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or current_combo.get("rank_value", 0) < 90:
        return None
    hand = state["players"][player_id]["hand"]
    minimal = _minimal_bomb_response(hand, state["level_rank"], current_combo, state.get("config", {}))
    if not minimal:
        return None
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in minimal if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo or combo.get("type") not in BOMB_TYPES:
        return None
    low_bomb_anchor = _point_order_value(3, state["level_rank"])
    if combo.get("type") == "bomb":
        rank_pressure = max(0.0, combo.get("rank_value", low_bomb_anchor) - low_bomb_anchor)
    else:
        rank_pressure = 6.0 + _bomb_tier(combo) * 1.5
    return {
        "cards": minimal,
        "combo": combo,
        "rank_pressure": rank_pressure,
    }


def _critical_pair_three_bomb_bonus(
    state: Dict,
    player_id: str,
    cards: List[int],
    combo: Optional[Dict] = None,
) -> float:
    current_trick = state.get("current_trick")
    if not current_trick or not cards:
        return 0.0
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return 0.0
    current_combo = current_trick.get("combo") or {}
    combo_type = current_combo.get("type")
    if combo_type not in ("pair", "three") or current_combo.get("rank_value", 0) < 80:
        return 0.0

    leader_left = len(state["players"].get(leader, {}).get("hand", []))
    if leader_left > 10:
        return 0.0

    hand = state["players"][player_id]["hand"]
    if combo is None:
        hand_map = _map_hand_by_id(hand)
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo or combo.get("type") not in BOMB_TYPES:
        return 0.0

    minimal = _minimal_bomb_response(hand, state["level_rank"], current_combo, state.get("config", {}))
    if minimal is None or tuple(sorted(minimal)) != tuple(sorted(cards)):
        return 0.0

    low_bomb_anchor = _point_order_value(3, state["level_rank"])
    if combo.get("type") == "bomb":
        rank_pressure = max(0.0, combo.get("rank_value", low_bomb_anchor) - low_bomb_anchor)
    else:
        rank_pressure = 6.0 + _bomb_tier(combo) * 1.8

    bonus = 12.0 + max(0.0, 10 - leader_left) * 1.35
    if combo_type == "pair":
        bonus += 3.0
    else:
        bonus += 4.0
    if leader_left <= 6:
        bonus += 3.0
    return max(0.0, bonus - rank_pressure * 0.95)


def _lead_low_single_escape_bonus(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    if len(cards) != 1 or len(hand) > 6:
        return 0.0
    hand_map = _map_hand_by_id(hand)
    card = hand_map.get(cards[0])
    if not card or _is_joker(card) or _is_wild(card, level_rank):
        return 0.0
    rank = card.get("rank")
    if rank is None:
        return 0.0
    before_count = _rank_count_map(hand, level_rank).get(rank, 0)
    if before_count != 1:
        return 0.0
    value = _single_order_value(card, level_rank)
    if value >= 58:
        return 0.0
    bonus = 3.0 + (58 - value) * 0.55
    if len(hand) <= 5:
        bonus *= 1.2
    return bonus


def _lead_low_single_trap_penalty(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    if len(hand) > 6:
        return 0.0
    remaining = _remove_cards(hand, cards)
    if not remaining:
        return 0.0

    counts = _rank_count_map(remaining, level_rank)
    low_single_burden = 0.0
    control_singles = 0
    strong_pairs = 0
    special_cover = 0

    for rank, count in counts.items():
        value = _point_order_value(rank, level_rank)
        if count == 1 and value < 58:
            low_single_burden += 3.0 + (58 - value) * 0.55
        elif count == 1 and value >= 60:
            control_singles += 1
        elif count >= 2 and value >= 60:
            strong_pairs += 1

    if low_single_burden <= 0.001:
        return 0.0

    for card in remaining:
        if _is_joker(card) or _is_wild(card, level_rank):
            special_cover += 1

    if len(remaining) <= 3:
        low_single_burden *= 1.85
    elif len(remaining) <= 4:
        low_single_burden *= 1.6
    else:
        low_single_burden *= 1.25

    cover = control_singles * 2.5 + strong_pairs * 0.9 + special_cover * 2.2
    return max(0.0, low_single_burden - cover)


def _lead_single_initiative_penalty(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    if len(cards) != 1 or len(hand) <= 8:
        return 0.0
    hand_map = _map_hand_by_id(hand)
    card = hand_map.get(cards[0])
    if not card or _is_joker(card) or _is_wild(card, level_rank):
        return 0.0

    value = _single_order_value(card, level_rank)
    if value >= 60:
        return 0.0

    remaining = _remove_cards(hand, cards)
    if not remaining:
        return 0.0

    decomp = _hand_decomposition_summary(remaining, level_rank)
    plan_types = tuple(decomp.get("plan_types", ()))
    penalty = 1.2 + max(0.0, 58 - value) * 0.16
    if decomp.get("group_turns", 0.0) >= 2:
        penalty += 1.4
    if decomp.get("grouped_cards", 0.0) >= max(6.0, float(len(remaining) - 3)):
        penalty += 0.8
    if decomp.get("turns", float(len(remaining))) <= max(4.0, len(remaining) * 0.42):
        penalty += 0.7
    if plan_types and plan_types[0] in ("full_house", "three_pairs", "steel_plate", "straight", "three"):
        penalty += 0.6

    before_low = sum(1 for entry in hand if _single_order_value(entry, level_rank) < 58)
    after_low = decomp.get("low_singles", 0.0)
    if before_low > 0 and after_low <= before_low - 1:
        penalty -= 1.2
    return max(0.0, penalty)


def _plan_alignment_score(hand: List[Dict], cards: List[int], combo: Dict, level_rank: int) -> float:
    if not hand or not cards:
        return 0.0

    before = _hand_decomposition_summary(hand, level_rank)
    remaining = _remove_cards(hand, cards)
    after = _hand_decomposition_summary(remaining, level_rank) if remaining else _empty_hand_decomposition_summary()
    combo_type = combo.get("type")
    structured_types = {"straight", "three_pairs", "steel_plate", "full_house", "three", "pair"}
    score = 0.0

    plan_types = tuple(before.get("plan_types", ()))
    primary_type = plan_types[0] if plan_types else None
    if primary_type:
        if combo_type == primary_type:
            score += 1.4 if combo_type == "single" else 3.0
            if combo_type in structured_types and before.get("grouped_cards", 0.0) >= max(6.0, float(len(hand) - 4)):
                score += 0.8
        elif primary_type in structured_types and combo_type == "single" and len(hand) >= 9:
            score -= 2.4
        elif primary_type == "pair" and combo_type == "single" and len(hand) >= 7:
            score -= 1.4

    before_turns = before.get("turns", float(len(hand)))
    after_turns = after.get("turns", 0.0)
    projected_turns = after_turns + (0.0 if not remaining else 1.0)
    turn_gain = before_turns - projected_turns
    if turn_gain > 0.01:
        score += min(2.4, turn_gain * 1.2)
    elif turn_gain < -0.01:
        score += max(-1.6, turn_gain * 0.8)

    low_single_delta = before.get("low_singles", 0.0) - after.get("low_singles", 0.0)
    if low_single_delta > 0.01:
        score += min(1.6, low_single_delta * 0.75)
    elif low_single_delta < -0.01:
        score -= min(2.0, abs(low_single_delta) * 1.0)

    if combo_type == "single" and before.get("group_turns", 0.0) >= 2 and after.get("group_turns", 0.0) >= before.get("group_turns", 0.0) and len(hand) >= 10:
        score -= 0.8
    if combo_type in BOMB_TYPES and before.get("bomb_turns", 0.0) > after.get("bomb_turns", 0.0) and before_turns >= 6:
        score -= 0.8
    return score


def _single_lock_bonus(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    current_trick = state.get("current_trick")
    if not current_trick or len(cards) != 1:
        return 0.0
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return 0.0
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or combo.get("type") != "single":
        return 0.0
    if current_combo.get("rank_value", 0) > 54:
        return 0.0

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    card = hand_map.get(cards[0])
    level_rank = state["level_rank"]
    if not card or _is_joker(card) or _is_wild(card, level_rank):
        return 0.0
    if card.get("rank") != level_rank:
        return 0.0

    counts = _rank_count_map(hand, level_rank)
    if counts.get(level_rank, 0) != 1:
        return 0.0

    chosen_value = _single_order_value(card, level_rank)
    threshold = current_combo.get("rank_value", 0)
    for other in hand:
        if other["id"] == card["id"] or _is_joker(other) or _is_wild(other, level_rank):
            continue
        value = _single_order_value(other, level_rank)
        if value <= threshold or value >= chosen_value:
            continue
        if counts.get(other.get("rank"), 0) == 1:
            return 0.0

    active_opponents = [
        pid
        for pid in state["turn_order"]
        if _team_of(state, pid) != _team_of(state, player_id) and not state["players"][pid]["finished"]
    ]
    if not active_opponents:
        return 0.0

    bonus = 4.0
    if len(active_opponents) >= 2:
        bonus += 1.0
    if min(len(state["players"][pid]["hand"]) for pid in active_opponents) <= 5:
        bonus += 1.5
    return bonus


def _takeover_opportunity_score(state: Dict, player_id: str, cards: List[int]) -> float:
    current_trick = state.get("current_trick")
    if not current_trick or not cards:
        return 0.0
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return 0.0
    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo:
        return 0.0
    leader_left = len(state["players"].get(leader, {}).get("hand", []))
    current_combo = current_trick.get("combo", {})

    structure_delta = _play_structure_delta(hand, cards, state["level_rank"])
    score = max(0.0, 3.2 - structure_delta)
    score += max(-4.0, _shape_transition_score(hand, cards, state["level_rank"]) * 0.7)
    material_cost = _response_material_cost(state, player_id, cards, combo)
    score += max(0.0, 6.2 - material_cost) * 0.95
    if material_cost > 7.0:
        score -= (material_cost - 7.0) * 0.45
    if combo["type"] not in BOMB_TYPES:
        score += 0.8
        if combo.get("type") == current_combo.get("type"):
            pressure_bonus = 0.0
            if leader_left <= 14:
                pressure_bonus += 5.0
            if leader_left <= 10:
                pressure_bonus += 4.0
            if leader_left <= 6:
                pressure_bonus += 5.0
            if combo.get("type") in ("full_house", "straight", "three_pairs", "steel_plate"):
                pressure_bonus += 3.0
            if not _cards_use_special_material(play_cards, state["level_rank"]):
                pressure_bonus += 1.5
            else:
                pressure_bonus *= 0.65
            score += pressure_bonus
    else:
        score -= 1.8 + _bomb_tier(combo) * 0.6
        critical_bonus = _critical_pair_three_bomb_bonus(state, player_id, cards, combo)
        if critical_bonus > 0:
            score += critical_bonus
        minimal = _minimal_bomb_response(hand, state["level_rank"], current_combo, state.get("config", {}))
        if (
            minimal is not None
            and tuple(sorted(minimal)) == tuple(sorted(cards))
            and current_combo.get("type") == "single"
            and current_combo.get("rank_value", 0) >= 80
            and leader_left <= 10
        ):
            low_bomb_anchor = _point_order_value(3, state["level_rank"])
            rank_pressure = max(0.0, combo.get("rank_value", low_bomb_anchor) - low_bomb_anchor)
            control_pressure = 6.5 + max(0.0, 10 - leader_left) * 0.9
            if leader_left <= 6:
                control_pressure += 2.5
            score += max(0.0, control_pressure - rank_pressure * 0.9)
        if (
            current_combo.get("type") == "single"
            and current_combo.get("rank_value", 0) >= 90
            and minimal is not None
            and tuple(sorted(minimal)) == tuple(sorted(cards))
        ):
            low_bomb_anchor = _point_order_value(3, state["level_rank"])
            rank_pressure = max(0.0, combo.get("rank_value", 0) - low_bomb_anchor)
            score += max(0.0, 7.5 - rank_pressure * 1.3)
        teammate_control = _teammate_future_control_probability(state, player_id)
        if current_combo.get("type") == "single" and current_combo.get("rank_value", 0) >= 70 and teammate_control > 0:
            score -= teammate_control * (7.5 + _bomb_tier(combo) * 1.8)

    opp_ids = [
        pid
        for pid in state["turn_order"]
        if _team_of(state, pid) != _team_of(state, player_id) and not state["players"][pid]["finished"]
    ]
    likely_blocks = 0
    likely_beats = 0
    for opp in opp_ids:
        if _bot_estimate_opponent_can_beat(state, opp, combo):
            likely_beats += 1
        else:
            likely_blocks += 1
    score += _single_lock_bonus(state, player_id, cards, combo)
    score += likely_blocks * 0.7
    score -= likely_beats * 0.4
    if len(cards) == len(hand):
        score += 10.0
    return max(0.0, score)


def _best_takeover_opportunity(state: Dict, player_id: str) -> float:
    current_trick = state.get("current_trick")
    if not current_trick:
        return 0.0
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return 0.0
    options = _list_hint_options(state, player_id)
    options = _filter_overbomb_options(state, player_id, options)
    options = _rank_response_options(state, player_id, options)
    if not options:
        return 0.0
    return max(_takeover_opportunity_score(state, player_id, cards) for cards in options)


_HAND_DECOMP_CACHE: Dict[Tuple[int, Tuple[str, ...]], Dict[str, float]] = {}
_HAND_DECOMP_CACHE_LIMIT = 4096


def _hand_decomposition_cache_key(hand: List[Dict], level_rank: int) -> Tuple[int, Tuple[str, ...]]:
    return level_rank, tuple(sorted(_card_label(card) for card in hand))


def _empty_hand_decomposition_summary() -> Dict[str, float]:
    return {
        "score": 0.0,
        "turns": 0.0,
        "singles": 0.0,
        "low_singles": 0.0,
        "control_singles": 0.0,
        "group_turns": 0.0,
        "bomb_turns": 0.0,
        "grouped_cards": 0.0,
        "special_material_turns": 0.0,
        "top_combo_size": 0.0,
        "plan_types": (),
    }


def _copy_hand_decomposition_summary(summary: Dict[str, float]) -> Dict[str, float]:
    copied = dict(summary)
    copied["plan_types"] = tuple(summary.get("plan_types", ()))
    return copied


def _decomposition_single_candidates(hand: List[Dict], level_rank: int) -> List[List[int]]:
    all_singles = _list_single_options(hand, level_rank, 0)
    if len(hand) <= 6:
        return all_singles

    counts = _rank_count_map(hand, level_rank)
    hand_map = _map_hand_by_id(hand)
    selected: List[List[int]] = []
    seen = set()

    def add(cards: List[int]) -> None:
        key = tuple(sorted(cards))
        if key in seen:
            return
        seen.add(key)
        selected.append(cards)

    for cards in all_singles[:2]:
        add(cards)
    for cards in all_singles[-2:]:
        add(cards)
    for card in hand:
        rank = card.get("rank")
        if _is_joker(card) or _is_wild(card, level_rank) or (rank is not None and counts.get(rank, 0) == 1):
            add([card["id"]])

    singles_ranked = []
    for cards in selected:
        card = hand_map.get(cards[0])
        if not card:
            continue
        value = _single_order_value(card, level_rank)
        singles_ranked.append((value, _is_joker(card), _is_wild(card, level_rank), cards))
    singles_ranked.sort(key=lambda item: (item[0], item[1], item[2]))
    return [cards for _, _, _, cards in singles_ranked]


def _decomposition_local_value(hand: List[Dict], cards: List[int], combo: Dict, level_rank: int) -> float:
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo_type = combo.get("type")
    type_base = {
        "straight_flush": 13.0,
        "bomb": 9.6,
        "steel_plate": 11.4,
        "three_pairs": 10.9,
        "straight": 10.2,
        "full_house": 9.8,
        "three": 7.1,
        "pair": 4.8,
        "single": 1.1,
    }
    value = type_base.get(combo_type, 3.0)
    value += len(cards) * 1.08
    value -= 4.25
    value += _shape_transition_score(hand, cards, level_rank) * 0.62
    value -= _group_fragment_penalty(hand, cards, level_rank, combo) * 1.05
    value -= _control_group_break_penalty(hand, cards, level_rank) * 0.92

    if combo_type == "single" and play_cards:
        card = play_cards[0]
        single_value = _single_order_value(card, level_rank)
        if single_value >= 90:
            value += 3.0
        elif single_value >= 80:
            value += 2.2
        elif single_value >= 60:
            value += 0.7
        else:
            value -= 1.6 + (58 - single_value) * 0.24
        if not _is_joker(card) and not _is_wild(card, level_rank):
            rank = card.get("rank")
            rank_count = _rank_count_map(hand, level_rank).get(rank, 0)
            if rank_count > 1:
                value -= 2.4 + (rank_count - 2) * 1.1
    else:
        value += min(3.2, _combo_numeric_value(combo) * 0.03)
        if combo_type in ("straight", "three_pairs", "steel_plate", "full_house"):
            value += 1.35
        elif combo_type == "three":
            value += 0.6

    if combo.get("uses_wild"):
        value -= 1.6
    if _cards_use_special_material(play_cards, level_rank):
        value -= 0.45
    if combo_type in BOMB_TYPES:
        value += 1.1 + _bomb_tier(combo) * 0.38
        if combo.get("uses_wild"):
            value -= 0.55
    return value


def _decomposition_candidates(hand: List[Dict], level_rank: int) -> List[Tuple[List[int], Dict, float]]:
    config = {}
    options: List[List[int]] = []
    if hand and _can_play_all(hand, level_rank, config, None):
        options.append([card["id"] for card in hand])

    options.extend([cand["cards"] for cand in _find_bomb_candidates(hand, level_rank)])
    options.extend(_list_steel_plate_options(hand, level_rank, 0))
    options.extend(_list_three_pairs_options(hand, level_rank, 0))
    options.extend(_list_straight_options(hand, level_rank, 0))
    options.extend(_list_full_house_options(hand, level_rank, 0))
    options.extend(_list_rank_group_options(hand, level_rank, 0, 3))
    options.extend(_list_rank_group_options(hand, level_rank, 0, 2))
    options.extend(_decomposition_single_candidates(hand, level_rank))

    hand_map = _map_hand_by_id(hand)
    by_type: Dict[str, List[Tuple[float, int, str, List[int], Dict]]] = {}
    for cards in _CORE._dedupe_card_sets(options):
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(play_cards, level_rank, config)
        if not combo:
            continue
        local_value = _decomposition_local_value(hand, cards, combo, level_rank)
        combo_type = combo.get("type") or "unknown"
        by_type.setdefault(combo_type, []).append(
            (
                local_value,
                len(cards),
                _CORE._cards_key(cards),
                cards,
                combo,
            )
        )

    limits = {
        "straight_flush": 2,
        "bomb": 2,
        "steel_plate": 2,
        "three_pairs": 2,
        "straight": 3,
        "full_house": 3,
        "three": 4,
        "pair": 4,
        "single": 5,
    }
    if len(hand) <= 10:
        limits["single"] = 6
        limits["pair"] = 5

    kept: List[Tuple[List[int], Dict, float]] = []
    for combo_type, entries in by_type.items():
        entries.sort(key=lambda item: (item[0], item[1], item[2]), reverse=True)
        for local_value, _, _, cards, combo in entries[: limits.get(combo_type, 3)]:
            kept.append((cards, combo, local_value))

    priority = {
        "straight_flush": 8,
        "bomb": 7,
        "steel_plate": 6,
        "three_pairs": 6,
        "straight": 5,
        "full_house": 5,
        "three": 4,
        "pair": 3,
        "single": 1,
    }
    kept.sort(
        key=lambda item: (
            priority.get(item[1].get("type") or "", 0),
            item[2],
            len(item[0]),
            _CORE._cards_key(item[0]),
        ),
        reverse=True,
    )
    return kept[: (8 if len(hand) >= 16 else 10)]


def _hand_decomposition_summary(hand: List[Dict], level_rank: int) -> Dict[str, float]:
    if not hand:
        return _empty_hand_decomposition_summary()

    if len(hand) >= 23:
        counts = _rank_count_map(hand, level_rank)
        summary = _empty_hand_decomposition_summary()
        summary["turns"] = float(len(hand))
        summary["singles"] = float(sum(1 for count in counts.values() if count == 1))
        summary["low_singles"] = float(
            sum(1 for rank, count in counts.items() if count == 1 and _point_order_value(rank, level_rank) < 58)
        )
        summary["control_singles"] = float(
            sum(1 for rank, count in counts.items() if count == 1 and _point_order_value(rank, level_rank) >= 60)
        )
        return summary

    cache_key = _hand_decomposition_cache_key(hand, level_rank)
    cached = _HAND_DECOMP_CACHE.get(cache_key)
    if cached is not None:
        return _copy_hand_decomposition_summary(cached)

    priority = {
        "straight_flush": 8,
        "bomb": 7,
        "steel_plate": 6,
        "three_pairs": 6,
        "straight": 5,
        "full_house": 5,
        "three": 4,
        "pair": 3,
        "single": 1,
    }

    def apply_step(
        current_hand: List[Dict],
        cards: List[int],
        combo: Dict,
        child: Dict[str, float],
    ) -> Dict[str, float]:
        hand_map = _map_hand_by_id(current_hand)
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        summary = _copy_hand_decomposition_summary(child)
        combo_type = combo.get("type") or "unknown"
        summary["score"] = child["score"] + _decomposition_local_value(current_hand, cards, combo, level_rank)
        summary["turns"] = child["turns"] + 1.0
        if combo_type == "single":
            summary["singles"] = child["singles"] + 1.0
            single_value = combo.get("rank_value", 0)
            if single_value < 58:
                summary["low_singles"] = child["low_singles"] + 1.0
            elif single_value >= 60:
                summary["control_singles"] = child["control_singles"] + 1.0
        else:
            summary["group_turns"] = child["group_turns"] + 1.0
            summary["grouped_cards"] = child["grouped_cards"] + float(len(cards))
        if combo_type in BOMB_TYPES:
            summary["bomb_turns"] = child["bomb_turns"] + 1.0
        if combo.get("uses_wild") or any(_is_joker(card) for card in play_cards):
            summary["special_material_turns"] = child["special_material_turns"] + 1.0
        summary["top_combo_size"] = max(child["top_combo_size"], float(len(cards)))
        summary["plan_types"] = (combo_type,) + tuple(child.get("plan_types", ()))[:5]
        return summary

    def search(current_hand: List[Dict], ply: int = 0) -> Dict[str, float]:
        if not current_hand:
            return _empty_hand_decomposition_summary()
        candidates = _decomposition_candidates(current_hand, level_rank)
        if not candidates:
            fallback = _empty_hand_decomposition_summary()
            fallback["turns"] = float(len(current_hand))
            fallback["singles"] = float(len(current_hand))
            fallback["low_singles"] = float(
                sum(1 for card in current_hand if _single_order_value(card, level_rank) < 58)
            )
            fallback["control_singles"] = float(
                sum(1 for card in current_hand if _single_order_value(card, level_rank) >= 60)
            )
            fallback["score"] = -4.0 * len(current_hand)
            fallback["top_combo_size"] = 1.0
            fallback["plan_types"] = tuple("single" for _ in current_hand[:6])
            return fallback

        beam = 4 if len(current_hand) >= 12 else 6
        best_choice = None
        best_key = None
        for cards, combo, local_value in candidates[:beam]:
            remaining = _remove_cards(current_hand, cards)
            future = 0.0
            if remaining and ply < 1:
                next_candidates = _decomposition_candidates(remaining, level_rank)
                if next_candidates:
                    future = next_candidates[0][2] * 0.58
            choice_key = (
                local_value + future,
                priority.get(combo.get("type") or "", 0),
                len(cards),
                _combo_numeric_value(combo),
                -float(combo.get("uses_wild", False)),
            )
            if best_key is None or choice_key > best_key:
                best_key = choice_key
                best_choice = (cards, combo, remaining)

        if best_choice is None:
            return _empty_hand_decomposition_summary()

        cards, combo, remaining = best_choice
        child = search(remaining, ply + 1)
        return apply_step(current_hand, cards, combo, child)

    summary = _copy_hand_decomposition_summary(search(hand, 0))
    if len(_HAND_DECOMP_CACHE) >= _HAND_DECOMP_CACHE_LIMIT:
        _HAND_DECOMP_CACHE.clear()
    _HAND_DECOMP_CACHE[cache_key] = _copy_hand_decomposition_summary(summary)
    return summary


def _longest_run(ranks: List[int]) -> int:
    if not ranks:
        return 0
    ranks_sorted = sorted(set(ranks))
    best = 1
    current = 1
    for idx in range(1, len(ranks_sorted)):
        if ranks_sorted[idx] == ranks_sorted[idx - 1] + 1:
            current += 1
        else:
            best = max(best, current)
            current = 1
    return max(best, current)


def _longest_group_run(rank_counts: Dict[int, int], min_count: int) -> int:
    ranks = [rank for rank, count in rank_counts.items() if count >= min_count]
    return _longest_run(ranks)


def _control_card_score(hand: List[Dict], level_rank: int) -> float:
    score = 0.0
    for card in hand:
        joker = card.get("joker")
        if joker == "big":
            score += 2.0
            continue
        if joker == "small":
            score += 1.5
            continue
        value = _single_order_value(card, level_rank)
        if value >= 80:
            score += 1.0
        elif value >= 60:
            score += 0.4
    return score


def _hand_structure_metrics(hand: List[Dict], level_rank: int) -> Dict[str, float]:
    if not hand:
        return {
            "pair_ranks": 0.0,
            "pure_pair_ranks": 0.0,
            "triple_ranks": 0.0,
            "quad_ranks": 0.0,
            "singles": 0.0,
            "wild_count": 0.0,
            "joker_big": 0.0,
            "joker_small": 0.0,
            "low_single_burden": 0.0,
            "grouped_control": 0.0,
            "max_run": 0.0,
            "pair_run": 0.0,
            "triple_run": 0.0,
            "turn_savings": 0.0,
            "shape_synergy": 0.0,
            "bomb_reserve": 0.0,
            "decomp_score": 0.0,
            "decomp_turns": 0.0,
            "decomp_singles": 0.0,
            "decomp_low_singles": 0.0,
            "decomp_grouped_cards": 0.0,
            "decomp_bomb_turns": 0.0,
            "decomp_special_turns": 0.0,
        }

    info = _hand_info(hand, level_rank)
    strength = _rank_strength(level_rank)
    rank_counts = {rank: len(cards) for rank, cards in info["normals_by_rank"].items()}
    counts = list(rank_counts.values())
    pair_ranks = sum(1 for count in counts if count >= 2)
    pure_pair_ranks = sum(1 for count in counts if count == 2)
    triple_ranks = sum(1 for count in counts if count >= 3)
    quad_ranks = sum(1 for count in counts if count >= 4)
    singles = sum(1 for count in counts if count == 1)
    wild_count = len(info["wild_cards"])
    joker_big = len(info["jokers_big"])
    joker_small = len(info["jokers_small"])

    low_single_burden = 0.0
    for rank, count in rank_counts.items():
        if count != 1:
            continue
        low_single_burden += max(0.0, 56 - strength[rank]) * 0.18

    grouped_control = 0.0
    for rank, count in rank_counts.items():
        if count < 2:
            continue
        strength_bonus = max(0.0, strength[rank] - 56)
        if strength_bonus <= 0:
            continue
        grouped_control += strength_bonus * min(count, 4) * 0.18
        if count >= 4:
            grouped_control += 0.7 + strength_bonus * 0.35 + (count - 4) * 0.45

    max_run = _longest_run(list(rank_counts.keys()))
    pair_run = _longest_group_run(rank_counts, 2)
    triple_run = _longest_group_run(rank_counts, 3)

    turn_savings = 0.0
    for count in counts:
        if count >= 4:
            turn_savings += 3.0
        elif count == 3:
            turn_savings += 2.0
        elif count == 2:
            turn_savings += 1.0
    if max_run >= 5:
        turn_savings += 2.5
    elif max_run == 4 and wild_count >= 1:
        turn_savings += 1.5
    elif max_run == 3 and wild_count >= 2:
        turn_savings += 1.0

    shape_synergy = 0.0
    if pure_pair_ranks >= 1 and triple_ranks >= 1:
        shape_synergy += 1.0
    if pair_run >= 3:
        shape_synergy += 2.0 + min(1.0, (pair_run - 3) * 0.5)
    if triple_run >= 2:
        shape_synergy += 1.2 + min(0.8, (triple_run - 2) * 0.4)
    if max_run >= 5:
        shape_synergy += 1.5 + min(1.0, (max_run - 5) * 0.3)

    bomb_reserve = 0.0
    bombs = _find_bomb_candidates(hand, level_rank)
    if bombs:
        reserve_factor = 1.0 + min(0.7, max(0.0, (len(hand) - 6) * 0.07))
        low_bomb_anchor = _point_order_value(3, level_rank)
        for bomb in bombs:
            tier = bomb.get("tier", 0)
            base = 1.2 + 0.8 * tier
            if bomb.get("type") == "bomb":
                rank_pressure = max(0.0, bomb.get("rank_value", low_bomb_anchor) - low_bomb_anchor)
                base += rank_pressure * 0.45
            elif bomb.get("type") == "straight_flush":
                base += 1.0
            elif bomb.get("type") == "heavenly":
                base += 2.0
            bomb_reserve += base * reserve_factor

    decomp = _hand_decomposition_summary(hand, level_rank)

    return {
        "pair_ranks": float(pair_ranks),
        "pure_pair_ranks": float(pure_pair_ranks),
        "triple_ranks": float(triple_ranks),
        "quad_ranks": float(quad_ranks),
        "singles": float(singles),
        "wild_count": float(wild_count),
        "joker_big": float(joker_big),
        "joker_small": float(joker_small),
        "low_single_burden": low_single_burden,
        "grouped_control": grouped_control,
        "max_run": float(max_run),
        "pair_run": float(pair_run),
        "triple_run": float(triple_run),
        "turn_savings": turn_savings,
        "shape_synergy": shape_synergy,
        "bomb_reserve": bomb_reserve,
        "decomp_score": float(decomp.get("score", 0.0)),
        "decomp_turns": float(decomp.get("turns", 0.0)),
        "decomp_singles": float(decomp.get("singles", 0.0)),
        "decomp_low_singles": float(decomp.get("low_singles", 0.0)),
        "decomp_grouped_cards": float(decomp.get("grouped_cards", 0.0)),
        "decomp_bomb_turns": float(decomp.get("bomb_turns", 0.0)),
        "decomp_special_turns": float(decomp.get("special_material_turns", 0.0)),
    }


def _hand_strength_score(hand: List[Dict], level_rank: int) -> float:
    if not hand:
        return 0.0
    metrics = _hand_structure_metrics(hand, level_rank)

    score = 0.0
    score += metrics["pair_ranks"] * 0.8
    score += metrics["triple_ranks"] * 1.4
    score += metrics["quad_ranks"] * 1.9
    score -= metrics["singles"] * 0.35
    score -= min(3.0, metrics["low_single_burden"])
    score += metrics["wild_count"] * 0.7
    score += metrics["joker_big"] * 2.2 + metrics["joker_small"] * 1.5
    if metrics["joker_small"] >= 2:
        score += 2.4
    if metrics["joker_big"] >= 2:
        score += 3.2

    if metrics["triple_ranks"] >= 1 and (metrics["pair_ranks"] >= 2 or metrics["triple_ranks"] >= 2):
        score += 1.2
    if metrics["pair_ranks"] >= 3:
        score += 1.0
    if metrics["triple_ranks"] >= 2:
        score += 1.6
    score += min(2.6, metrics["shape_synergy"] * 0.9)
    score += min(5.5, metrics["grouped_control"])

    if metrics["max_run"] >= 5:
        score += 1.4
    elif metrics["max_run"] == 4 and metrics["wild_count"] >= 1:
        score += 0.9
    elif metrics["max_run"] == 3 and metrics["wild_count"] >= 2:
        score += 0.6
    score += min(6.0, metrics["turn_savings"] * 0.55)
    score += min(7.0, metrics["bomb_reserve"])
    score += min(9.0, metrics["decomp_score"] * 0.42)
    score += min(4.0, max(0.0, len(hand) - metrics["decomp_turns"]) * 0.52)
    score -= metrics["decomp_low_singles"] * 0.55
    score -= max(0.0, metrics["decomp_singles"] - 2.0) * 0.18
    score += min(2.6, metrics["decomp_grouped_cards"] * 0.07)
    score += metrics["decomp_bomb_turns"] * 0.32
    score -= metrics["decomp_special_turns"] * 0.18
    return score


def _estimated_turns_to_finish(hand: List[Dict], level_rank: int) -> float:
    if not hand:
        return 0.0
    metrics = _hand_structure_metrics(hand, level_rank)
    turns = float(len(hand))
    turns -= metrics["turn_savings"]
    turns -= metrics["shape_synergy"]
    turns -= min(1.0, metrics["wild_count"] * 0.22 + metrics["joker_small"] * 0.18 + metrics["joker_big"] * 0.28)
    turns += min(2.4, metrics["low_single_burden"] * 0.12)
    turns -= min(1.2, metrics["grouped_control"] * 0.08)
    decomp_turns = metrics["decomp_turns"]
    if decomp_turns > 0:
        decomp_turns += metrics["decomp_low_singles"] * 0.18
        decomp_turns += metrics["decomp_special_turns"] * 0.08
        turns = min(turns, decomp_turns)
    return max(1.0, turns)


def _predict_finish_order(
    state: Dict,
    adjusted_counts: Dict[str, int],
    adjusted_turns: Optional[Dict[str, float]] = None,
) -> List[str]:
    finished = list(state.get("finish_order", []) or [])
    remaining = [pid for pid in state["turn_order"] if pid not in finished]
    order_index = {pid: idx for idx, pid in enumerate(state["turn_order"])}
    level_rank = state.get("level_rank", 2)

    def predicted_turns(pid: str) -> float:
        if adjusted_turns and pid in adjusted_turns:
            return adjusted_turns[pid]
        return _estimated_turns_to_finish(state["players"][pid]["hand"], level_rank)

    remaining.sort(
        key=lambda pid: (
            predicted_turns(pid),
            adjusted_counts.get(pid, len(state["players"][pid]["hand"])),
            order_index[pid],
        )
    )
    return finished + remaining


def _team_finish_score(
    state: Dict,
    bot_id: str,
    bot_remaining: int,
    bot_hand: Optional[List[Dict]] = None,
) -> float:
    counts = {pid: len(state["players"][pid]["hand"]) for pid in state["turn_order"]}
    counts[bot_id] = bot_remaining
    level_rank = state.get("level_rank", 2)
    turns = {}
    for pid in state["turn_order"]:
        if pid == bot_id and bot_hand is not None:
            turns[pid] = _estimated_turns_to_finish(bot_hand, level_rank)
        else:
            turns[pid] = _estimated_turns_to_finish(state["players"][pid]["hand"], level_rank)
    predicted = _predict_finish_order(state, counts, turns)
    team = _team_of(state, bot_id)
    team_positions = [idx + 1 for idx, pid in enumerate(predicted) if _team_of(state, pid) == team]
    if len(team_positions) < 2:
        return 0.0
    team_positions.sort()
    if team_positions == [1, 2]:
        return 8.0
    if team_positions == [1, 3]:
        return 5.0
    if team_positions == [1, 4]:
        return 2.0
    if team_positions == [2, 3]:
        return 1.0
    if team_positions == [2, 4]:
        return -2.0
    if team_positions == [3, 4]:
        return -6.0
    return 0.0


def _bot_estimate_opponent_can_beat(state: Dict, opponent_id: str, combo: Dict) -> bool:
    combo_type = combo.get("type")
    if combo_type in ("bomb", "straight_flush", "heavenly"):
        return True
    limits = state.get("pass_limits", {}).get(opponent_id, {})
    limit = limits.get(combo_type)
    if limit is None:
        return True
    value = _combo_value(combo)
    return value <= limit


def _hand_state_value_components(state: Dict, bot_id: str, hand: List[Dict]) -> Dict[str, float]:
    level_rank = state["level_rank"]
    remaining = len(hand)
    turns = _estimated_turns_to_finish(hand, level_rank)
    strength = _hand_strength_score(hand, level_rank)
    control = _control_card_score(hand, level_rank)
    components: Dict[str, float] = {
        "team_finish": _team_finish_score(state, bot_id, remaining, bot_hand=hand) * 2.2,
    }
    if remaining == 0:
        components["finished_hand"] = 42.0
        return components
    components["turn_efficiency"] = -turns * 0.34
    structure_credit = max(0.0, remaining - turns)
    if structure_credit > 0.001:
        components["structure_credit"] = structure_credit * 0.75
    if abs(strength) > 0.001:
        components["hand_strength"] = strength * 0.48
    components["hand_pressure"] = -remaining * 0.06
    if control > 0.001:
        components["control_stock"] = min(3.2, control * 0.22)
    return components


def _evaluate_state_for_bot(state: Dict, bot_id: str) -> float:
    if state.get("game_over"):
        return 1000.0 if state.get("winner_team") == _team_of(state, bot_id) else -1000.0
    hand = state["players"][bot_id]["hand"]
    score = sum(_hand_state_value_components(state, bot_id, hand).values())

    teammate = _teammate_of(state, bot_id)
    current_trick = state.get("current_trick")
    if current_trick:
        leader = current_trick.get("player_id")
        if leader is not None:
            if leader == bot_id:
                score += 2.6
            elif _team_of(state, leader) == _team_of(state, bot_id):
                score += max(1.5, _teammate_protect_bonus(state, bot_id) * 0.35)
            else:
                score -= 2.2
                if state.get("current_turn") == bot_id:
                    response_score = _best_response_play_score(state, bot_id, 3, non_bomb_only=True)
                    if response_score is not None and response_score > 0:
                        score -= min(6.5, response_score * 0.7)
                    else:
                        bomb_profile = _high_single_bomb_profile(state, bot_id)
                        opportunity = _best_takeover_opportunity(state, bot_id)
                        if opportunity > 0:
                            score -= min(4.5, opportunity * 1.1)
                        if bomb_profile:
                            rank_pressure = bomb_profile["rank_pressure"]
                            if rank_pressure <= 2.5:
                                score -= 4.5 - rank_pressure * 1.2
                            elif rank_pressure >= 4.0:
                                score += (rank_pressure - 3.5) * 2.0

    if teammate and not state["players"][teammate]["finished"]:
        teammate_remaining = len(state["players"][teammate]["hand"])
        control = _control_card_score(hand, state["level_rank"])
        if teammate_remaining <= 5:
            score += min(3.0, control * 0.4)
        if current_trick and current_trick.get("player_id") == teammate:
            score += 1.5
    return score


def _action_combo(state: Dict, player_id: str, action: Optional[Dict]) -> Optional[Dict]:
    if not action or action.get("type") != "play":
        return None
    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
    if not play_cards:
        return None
    return _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))


def _heuristic_best_action(state: Dict, bot_id: str, depth: int) -> Optional[Dict]:
    legal = GuandanGame.get_legal_actions(state, bot_id)
    if "play" not in legal:
        return None
    chosen = _bot_select_play(state, bot_id, depth)
    if chosen:
        return {"type": "play", "card_ids": chosen}
    if state.get("current_trick") and "pass" in legal:
        return {"type": "pass"}
    return None


def _candidate_actions(state: Dict, player_id: str, limit: int) -> List[Dict]:
    legal = GuandanGame.get_legal_actions(state, player_id)
    if not legal:
        return []
    if "tribute_select" in legal:
        hand = state["players"][player_id]["hand"]
        candidates = _max_tribute_cards(hand, state["level_rank"])
        card = min(candidates, key=lambda c: _single_order_value(c, state["level_rank"]))
        return [{"type": "tribute_select", "card_id": card["id"]}]
    if "return_select" in legal:
        hand = state["players"][player_id]["hand"]
        candidates = _eligible_return_cards(hand)
        card = min(candidates, key=lambda c: _single_order_value(c, state["level_rank"]))
        return [{"type": "return_select", "card_id": card["id"]}]
    if "next_round" in legal:
        return [{"type": "next_round"}]
    if "play_again" in legal:
        return [{"type": "play_again"}]

    actions: List[Dict] = []
    if "play" in legal:
        options = _list_hint_options(state, player_id)
        hand = state["players"][player_id]["hand"]
        current_trick = state.get("current_trick")
        current_combo = current_trick["combo"] if current_trick else None
        if hand and _can_play_all(hand, state["level_rank"], state.get("config", {}), current_combo):
            play_all = [card["id"] for card in hand]
            if play_all not in options:
                options = [play_all] + options
        current_trick = state.get("current_trick")
        if current_trick and current_trick["combo"]["type"] in ("bomb", "straight_flush", "heavenly"):
            minimal = _minimal_bomb_response(
                state["players"][player_id]["hand"],
                state["level_rank"],
                current_trick["combo"],
                state.get("config", {}),
            )
            if minimal:
                options = [minimal]
        elif current_trick:
            options = _rank_response_options(state, player_id, options)
        else:
            options = _rank_lead_options(state, player_id, options)
        for cards in options[:limit]:
            actions.append({"type": "play", "card_ids": cards})
    if "pass" in legal:
        actions.append({"type": "pass"})
    return actions


def _should_use_mcts(state: Dict, bot_id: str, width: int) -> bool:
    legal = GuandanGame.get_legal_actions(state, bot_id)
    if "play" not in legal:
        return False
    current_trick = state.get("current_trick")
    if not current_trick:
        return False
    if _teammate_lead_context(state, bot_id):
        return False

    actions = _candidate_actions(state, bot_id, width)
    actions = _filter_overbomb_actions(state, bot_id, actions)
    play_actions = [action for action in actions if action.get("type") == "play"]
    has_pass = any(action.get("type") == "pass" for action in actions)
    if not play_actions:
        return False

    current_combo = current_trick.get("combo") or {}
    combo_type = current_combo.get("type")
    if combo_type in BOMB_TYPES:
        return True

    has_bomb_response = any((_action_combo(state, bot_id, action) or {}).get("type") in BOMB_TYPES for action in play_actions)
    if len(play_actions) >= 5 and not has_bomb_response and combo_type != "single":
        return False
    if combo_type == "single":
        return current_combo.get("rank_value", 0) >= 70 or has_bomb_response
    if combo_type in ("pair", "three"):
        return has_bomb_response or (has_pass and len(play_actions) <= 2)
    if combo_type in ("full_house", "straight", "three_pairs", "steel_plate"):
        return has_bomb_response or len(play_actions) <= 2
    return False


def _max_combo_value_for_hand(hand: List[Dict], level_rank: int, combo_type: str, config: Dict) -> Optional[int]:
    if combo_type == "single":
        if not hand:
            return None
        return max(_single_order_value(card, level_rank) for card in hand)

    if combo_type == "pair":
        options = _list_rank_group_options(hand, level_rank, 0, 2)
    elif combo_type == "three":
        options = _list_rank_group_options(hand, level_rank, 0, 3)
    elif combo_type == "full_house":
        options = _list_full_house_options(hand, level_rank, 0)
    elif combo_type == "straight":
        options = _list_straight_options(hand, level_rank, 0)
    elif combo_type == "three_pairs":
        options = _list_three_pairs_options(hand, level_rank, 0)
    elif combo_type == "steel_plate":
        options = _list_steel_plate_options(hand, level_rank, 0)
    else:
        return None

    if not options:
        return None
    hand_map = _map_hand_by_id(hand)
    best = None
    for cards in options:
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(play_cards, level_rank, config)
        if not combo or combo.get("type") != combo_type:
            continue
        value = combo.get("high_value") if combo_type in ("straight", "three_pairs", "steel_plate") else combo.get("rank_value")
        if value is None:
            continue
        if best is None or value > best:
            best = value
    return best


def _pass_limit_penalty_for_hand(state: Dict, player_id: str, hand: List[Dict]) -> float:
    limits = state.get("pass_limits", {}).get(player_id, {})
    if not limits:
        return 0.0
    level_rank = state["level_rank"]
    config = state.get("config", {})
    penalty = 0.0
    for combo_type, limit in limits.items():
        max_value = _max_combo_value_for_hand(hand, level_rank, combo_type, config)
        if max_value is None or max_value <= limit:
            continue
        gap = max_value - limit
        if combo_type in ("single", "pair", "three"):
            penalty += 1.2 + min(4.0, gap * 0.14)
        else:
            penalty += 1.8 + min(5.0, gap * 0.22)
    return penalty


def _determinize_state(state: Dict, perspective_id: str, rng: random.Random) -> Dict:
    det = copy.deepcopy(state)
    full = _full_deck()
    id_to_card = {card["id"]: card for card in full}
    known_ids = set(det.get("seen_cards", []) or [])
    if perspective_id in det["players"]:
        known_ids.update(card["id"] for card in det["players"][perspective_id]["hand"])
    if det.get("current_trick"):
        known_ids.update(det["current_trick"].get("cards", []) or [])

    all_ids = set(id_to_card.keys())
    unknown_ids = [cid for cid in all_ids if cid not in known_ids]
    targets = [
        (pid, len(det["players"][pid]["hand"]))
        for pid in det["turn_order"]
        if pid != perspective_id
    ]
    if not targets:
        return det

    sample_count = max(1, int(det.get("config", {}).get("bot_determinize_samples", 3)))
    best_assignment = None
    best_penalty = None
    for _ in range(sample_count):
        sample_unknown = list(unknown_ids)
        rng.shuffle(sample_unknown)
        idx = 0
        assignment: Dict[str, List[Dict]] = {}
        failed = False
        for pid, count in targets:
            assigned = sample_unknown[idx : idx + count]
            idx += count
            if len(assigned) < count:
                failed = True
                break
            assignment[pid] = [id_to_card[cid] for cid in assigned]
        if failed:
            continue
        penalty = 0.0
        for pid, cards in assignment.items():
            penalty += _pass_limit_penalty_for_hand(det, pid, cards)
        if best_penalty is None or penalty < best_penalty:
            best_penalty = penalty
            best_assignment = assignment
            if penalty <= 0.001:
                break

    if best_assignment is None:
        return det
    for pid, cards in best_assignment.items():
        det["players"][pid]["hand"] = cards
    return det


def _should_accept_mcts_override(
    state: Dict,
    bot_id: str,
    heuristic_action: Optional[Dict],
    mcts_action: Optional[Dict],
    depth: int,
) -> bool:
    if not mcts_action:
        return False
    if not heuristic_action:
        return True
    if _mcts_action_key(heuristic_action) == _mcts_action_key(mcts_action):
        return True

    cfg = state.get("config", {})
    override_margin = float(cfg.get("bot_mcts_override_margin", 5.5))
    structure_margin = float(cfg.get("bot_mcts_structure_guard_margin", 2.5))
    heuristic_score = _mcts_root_heuristic_value(state, bot_id, heuristic_action, depth)
    mcts_score = _mcts_root_heuristic_value(state, bot_id, mcts_action, depth)
    if heuristic_score >= mcts_score + override_margin:
        return False

    if heuristic_action.get("type") == "play" and mcts_action.get("type") == "pass":
        current_trick = state.get("current_trick")
        leader = current_trick.get("player_id") if current_trick else None
        if leader is not None and _team_of(state, leader) != _team_of(state, bot_id):
            if heuristic_score >= mcts_score + structure_margin:
                return False
        return True

    if heuristic_action.get("type") != "play" or mcts_action.get("type") != "play":
        return True

    heuristic_combo = _action_combo(state, bot_id, heuristic_action)
    mcts_combo = _action_combo(state, bot_id, mcts_action)
    if not heuristic_combo or not mcts_combo:
        return True

    hand = state["players"][bot_id]["hand"]
    heuristic_cards = heuristic_action.get("card_ids", []) or []
    mcts_cards = mcts_action.get("card_ids", []) or []
    heuristic_fragment = _group_fragment_penalty(hand, heuristic_cards, state["level_rank"], heuristic_combo)
    mcts_fragment = _group_fragment_penalty(hand, mcts_cards, state["level_rank"], mcts_combo)
    heuristic_break = _control_group_break_penalty(hand, heuristic_cards, state["level_rank"])
    mcts_break = _control_group_break_penalty(hand, mcts_cards, state["level_rank"])
    heuristic_shape = _shape_transition_score(hand, heuristic_cards, state["level_rank"])
    mcts_shape = _shape_transition_score(hand, mcts_cards, state["level_rank"])

    if (
        heuristic_score >= mcts_score + structure_margin
        and (
            mcts_fragment > heuristic_fragment + 0.9
            or mcts_break > heuristic_break + 0.6
            or mcts_shape + 1.2 < heuristic_shape
        )
    ):
        return False
    return True


def _next_actor(state: Dict) -> Optional[str]:
    for pid in state["turn_order"]:
        if GuandanGame.get_legal_actions(state, pid):
            return pid
    return None


def _rollout_policy_action(state: Dict, player_id: str) -> Optional[Dict]:
    legal = GuandanGame.get_legal_actions(state, player_id)
    if not legal:
        return None
    if "tribute_select" in legal:
        hand = state["players"][player_id]["hand"]
        candidates = _max_tribute_cards(hand, state["level_rank"])
        card = min(candidates, key=lambda c: _single_order_value(c, state["level_rank"]))
        return {"type": "tribute_select", "card_id": card["id"]}
    if "return_select" in legal:
        hand = state["players"][player_id]["hand"]
        candidates = _eligible_return_cards(hand)
        card = min(candidates, key=lambda c: _single_order_value(c, state["level_rank"]))
        return {"type": "return_select", "card_id": card["id"]}
    if "next_round" in legal:
        return {"type": "next_round"}
    if "play_again" in legal:
        return {"type": "play_again"}
    if "play" in legal:
        if not state.get("current_trick"):
            cards = _choose_lead_play(
                state["players"][player_id]["hand"],
                state["level_rank"],
                state.get("config", {}),
                state,
                player_id,
            )
            if cards:
                return {"type": "play", "card_ids": cards}
        if "pass" in legal and state.get("current_trick"):
            leader = state["current_trick"].get("player_id")
            teammate = _teammate_of(state, player_id)
            if teammate and leader == teammate:
                options = _list_hint_options(state, player_id)
                options = _filter_overbomb_options(state, player_id, options)
                options = _rank_response_options(state, player_id, options)
                if not options:
                    return {"type": "pass"}
                best_cards = options[0]
                pass_score = _bot_score_play(state, player_id, None, 2)
                best_score = _bot_score_play(state, player_id, best_cards, 2)
                hand = state["players"][player_id]["hand"]
                hand_map = _map_hand_by_id(hand)
                play_cards = [hand_map[cid] for cid in best_cards if cid in hand_map]
                best_combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
                strong_lead = _teammate_lead_strength(state, player_id)
                if best_combo and strong_lead >= 6.0 and best_combo.get("type") not in BOMB_TYPES:
                    if _breaks_bomb_shape(hand, best_cards, state["level_rank"]):
                        return {"type": "pass"}
                if best_combo and strong_lead >= 8.0:
                    remaining_count = len(_remove_cards(hand, best_cards))
                    force_pass_penalty = _teammate_overtrick_penalty(
                        state,
                        player_id,
                        best_cards,
                        best_combo,
                        remaining_count,
                    )
                    if pass_score >= best_score - 3.0 or force_pass_penalty >= 14.0:
                        return {"type": "pass"}
                if pass_score >= best_score - 1.0:
                    return {"type": "pass"}
                if random.random() < 0.85:
                    return {"type": "pass"}
        heuristic_depth = max(1, int(state.get("config", {}).get("bot_rollout_heuristic_depth", 2)))
        heuristic_action = _heuristic_best_action(state, player_id, heuristic_depth)
        if heuristic_action:
            return heuristic_action
    if "pass" in legal:
        return {"type": "pass"}
    return None


def _rollout_value(state: Dict, bot_id: str, depth: int) -> float:
    steps = 0
    while steps < depth and not state.get("game_over"):
        actor = _next_actor(state)
        if actor is None:
            break
        action = _rollout_policy_action(state, actor)
        if not action:
            break
        _, err = GuandanGame.apply_action(state, actor, action)
        if err:
            break
        steps += 1
    return _evaluate_state_for_bot(state, bot_id)


def _mcts_reply_tree_value(
    state: Dict,
    bot_id: str,
    ply: int,
    width: int,
    rollout_depth: int,
    alpha: float = -1e9,
    beta: float = 1e9,
) -> float:
    if state.get("game_over"):
        return _evaluate_state_for_bot(state, bot_id)
    actor = _next_actor(state)
    if actor is None:
        return _evaluate_state_for_bot(state, bot_id)
    if ply <= 0:
        return _rollout_value(state, bot_id, rollout_depth)

    actions = _CORE._candidate_actions(state, actor, width)
    actions = _CORE._filter_overbomb_actions(state, actor, actions)
    if not actions:
        return _rollout_value(state, bot_id, rollout_depth)

    maximize = _team_of(state, actor) == _team_of(state, bot_id)
    ordered_children: List[Tuple[float, Dict]] = []
    for action in actions:
        nxt = copy.deepcopy(state)
        _, err = GuandanGame.apply_action(nxt, actor, action)
        if err:
            continue
        ordered_children.append((_evaluate_state_for_bot(nxt, bot_id), nxt))
    if not ordered_children:
        return _rollout_value(state, bot_id, rollout_depth)

    ordered_children.sort(key=lambda item: item[0], reverse=maximize)
    if maximize:
        value = -1e9
        for _, nxt in ordered_children:
            child_value = _CORE._mcts_reply_tree_value(nxt, bot_id, ply - 1, width, rollout_depth, alpha, beta)
            value = max(value, child_value)
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return value

    value = 1e9
    for _, nxt in ordered_children:
        child_value = _CORE._mcts_reply_tree_value(nxt, bot_id, ply - 1, width, rollout_depth, alpha, beta)
        value = min(value, child_value)
        beta = min(beta, value)
        if beta <= alpha:
            break
    return value


def _mcts_root_heuristic_value(state: Dict, bot_id: str, action: Dict, depth: int) -> float:
    base_depth = max(2, min(4, depth if depth > 0 else 2))
    if action.get("type") == "pass":
        return _bot_score_play(state, bot_id, None, base_depth)
    if action.get("type") == "play":
        return _bot_score_play(state, bot_id, action.get("card_ids") or [], base_depth)
    return -999.0


def _mcts_action_key(action: Dict) -> Tuple:
    return (
        action.get("type"),
        tuple(action.get("card_ids", []) or []),
        action.get("card_id"),
    )


def _mcts_budget(
    state: Dict,
    base_sims: int,
    base_depth: int,
    tree_ply: int,
    reply_width: int,
    candidate_count: int,
) -> Tuple[int, int, int, int]:
    if candidate_count <= 1:
        return 0, 0, 0, 1

    total_left = sum(len(state["players"][pid]["hand"]) for pid in state["turn_order"])
    scale = 1.0
    if candidate_count == 2:
        scale *= 0.65
    elif candidate_count <= 4:
        scale *= 0.82

    if not state.get("current_trick"):
        scale *= 0.8
    if total_left >= 70:
        scale *= 0.72
    elif total_left >= 50:
        scale *= 0.82

    if base_sims <= 16:
        sims = base_sims
    else:
        sims = min(base_sims, max(4, int(base_sims * scale)))
    depth = max(4, min(base_depth, 6 if total_left >= 50 else base_depth))
    tree = min(tree_ply, 1 if candidate_count <= 3 else tree_ply, depth)
    width = max(1, min(reply_width, 2 if candidate_count <= 4 else reply_width))
    return sims, depth, tree, width


def _is_obvious_low_single_response(state: Dict, player_id: str, cards: List[int]) -> bool:
    current_trick = state.get("current_trick")
    if not current_trick:
        return False
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or current_combo.get("rank_value", 0) >= 58:
        return False

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo or combo.get("type") != "single" or combo["type"] in BOMB_TYPES:
        return False
    if _cards_use_special_material(play_cards, state["level_rank"]):
        return False
    if _response_material_cost(state, player_id, cards, combo) > 1.4:
        return False
    if _control_group_break_penalty(hand, cards, state["level_rank"]) > 0.6:
        return False
    if _group_fragment_penalty(hand, cards, state["level_rank"], combo) > 0.9:
        return False
    return True


def _is_clean_low_single_response(state: Dict, player_id: str, cards: List[int]) -> bool:
    current_trick = state.get("current_trick")
    if not current_trick:
        return False
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or current_combo.get("rank_value", 0) >= 58:
        return False

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo or combo.get("type") != "single" or combo["type"] in BOMB_TYPES:
        return False
    if _cards_use_special_material(play_cards, state["level_rank"]):
        return False
    if _group_fragment_penalty(hand, cards, state["level_rank"], combo) > 0.01:
        return False
    if _control_group_break_penalty(hand, cards, state["level_rank"]) > 0.01:
        return False
    if _shape_transition_score(hand, cards, state["level_rank"]) < -0.1:
        return False
    return True


def _cheap_clean_single_takeover_bonus(
    state: Dict,
    player_id: str,
    cards: List[int],
    combo: Optional[Dict] = None,
) -> float:
    current_trick = state.get("current_trick")
    if not current_trick or len(cards) != 1:
        return 0.0
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return 0.0
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or current_combo.get("rank_value", 0) >= 55:
        return 0.0
    if not _is_clean_low_single_response(state, player_id, cards):
        return 0.0

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    if len(play_cards) != 1:
        return 0.0
    card = play_cards[0]
    level_rank = state["level_rank"]
    if combo is None:
        combo = _evaluate_combo(play_cards, level_rank, state.get("config", {}))
    if not combo or combo.get("type") != "single":
        return 0.0
    chosen_value = combo.get("rank_value", 0)
    if chosen_value >= 58:
        return 0.0

    margin = chosen_value - current_combo.get("rank_value", 0)
    if margin < 1 or margin > 3:
        return 0.0

    counts = _rank_count_map(hand, level_rank)
    rank = card.get("rank")
    if rank is None or counts.get(rank, 0) != 1:
        return 0.0

    leader_left = len(state["players"].get(leader, {}).get("hand", []))
    bonus = 1.9 + (3 - margin) * 0.55
    if leader_left <= 10:
        bonus += 0.5
    if leader_left <= 6:
        bonus += 0.5
    return bonus


def _mcts_fast_path_scores(
    candidates: List[Dict],
    heuristic_values: Dict[Tuple, float],
    top_action: Dict,
    tag: str,
) -> List[Tuple[Dict, float, int, Dict[str, float]]]:
    top_key = _mcts_action_key(top_action)
    ordered = [top_action]
    seen = {top_key}
    ranked_rest = sorted(candidates, key=lambda item: heuristic_values.get(_mcts_action_key(item), -999.0), reverse=True)
    for action in ranked_rest:
        key = _mcts_action_key(action)
        if key in seen:
            continue
        ordered.append(action)
        seen.add(key)

    scored: List[Tuple[Dict, float, int, Dict[str, float]]] = []
    for action in ordered:
        heuristic = heuristic_values.get(_mcts_action_key(action), -999.0)
        stats = {
            "avg": heuristic,
            "adjusted": heuristic,
            "std": 0.0,
            "win_rate": 1.0 if _mcts_action_key(action) == top_key else 0.0,
            "min": heuristic,
            "max": heuristic,
            "heuristic": heuristic,
            "heuristic_norm": 0.0,
            "depth": 0,
            "tree_ply": 0,
            "reply_width": 1,
            "fast_path": 1.0,
        }
        stats[tag] = 1.0 if _mcts_action_key(action) == top_key else 0.0
        scored.append((action, heuristic, 0, stats))
    return scored


def _mcts_obvious_response_scores(
    state: Dict,
    bot_id: str,
    candidates: List[Dict],
    heuristic_values: Dict[Tuple, float],
) -> Optional[List[Tuple[Dict, float, int, Dict[str, float]]]]:
    current_trick = state.get("current_trick")
    if not current_trick or _teammate_lead_context(state, bot_id):
        return None
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or current_combo.get("rank_value", 0) >= 58:
        return None

    play_actions = [action for action in candidates if action.get("type") == "play"]
    if not play_actions:
        return None
    ranked_actions = sorted(candidates, key=lambda item: heuristic_values.get(_mcts_action_key(item), -999.0), reverse=True)
    ranked_plays = [action for action in ranked_actions if action.get("type") == "play"]
    cfg = state.get("config", {})
    pass_action = next((action for action in candidates if action.get("type") == "pass"), None)
    pass_heuristic = heuristic_values.get(_mcts_action_key(pass_action), -999.0) if pass_action else -999.0
    clean_candidates = [
        action
        for action in ranked_plays
        if _is_clean_low_single_response(state, bot_id, action.get("card_ids", []) or [])
    ]
    if clean_candidates:
        top_clean = clean_candidates[0]
        clean_margin = cfg.get(
            "bot_mcts_clean_response_margin",
            max(0.9, cfg.get("bot_mcts_obvious_response_margin", 2.25) * 0.5),
        )
        clean_heuristic = heuristic_values.get(_mcts_action_key(top_clean), -999.0)
        if not pass_action or clean_heuristic >= pass_heuristic + clean_margin:
            return _mcts_fast_path_scores(candidates, heuristic_values, top_clean, "clean_single_fast_path")

    top_action = ranked_plays[0] if ranked_plays else None
    if top_action is None or not _is_obvious_low_single_response(state, bot_id, top_action.get("card_ids", []) or []):
        return None

    top_heuristic = heuristic_values.get(_mcts_action_key(top_action), -999.0)
    if pass_action and top_heuristic < pass_heuristic + cfg.get("bot_mcts_obvious_response_margin", 2.25):
        return None
    return _mcts_fast_path_scores(candidates, heuristic_values, top_action, "obvious_response_fast_path")


def _mcts_high_single_bomb_scores(
    state: Dict,
    bot_id: str,
    candidates: List[Dict],
    heuristic_values: Dict[Tuple, float],
) -> Optional[List[Tuple[Dict, float, int, Dict[str, float]]]]:
    current_trick = state.get("current_trick")
    if not current_trick or _teammate_lead_context(state, bot_id):
        return None
    current_combo = current_trick.get("combo") or {}
    if current_combo.get("type") != "single" or current_combo.get("rank_value", 0) < 90:
        return None
    if len(candidates) != 2:
        return None

    pass_action = next((action for action in candidates if action.get("type") == "pass"), None)
    play_action = next((action for action in candidates if action.get("type") == "play"), None)
    if not pass_action or not play_action:
        return None

    hand = state["players"][bot_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in play_action.get("card_ids", []) if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo or combo.get("type") not in BOMB_TYPES:
        return None

    pass_heuristic = heuristic_values.get(_mcts_action_key(pass_action), -999.0)
    play_heuristic = heuristic_values.get(_mcts_action_key(play_action), -999.0)
    gap = abs(play_heuristic - pass_heuristic)
    if gap < 6.0:
        return None

    ordered = sorted(candidates, key=lambda action: heuristic_values.get(_mcts_action_key(action), -999.0), reverse=True)
    scored: List[Tuple[Dict, float, int, Dict[str, float]]] = []
    top_action = ordered[0]
    for action in ordered:
        heuristic = heuristic_values.get(_mcts_action_key(action), -999.0)
        scored.append(
            (
                action,
                heuristic,
                0,
                {
                    "avg": heuristic,
                    "adjusted": heuristic,
                    "std": 0.0,
                    "win_rate": 1.0 if action == top_action else 0.0,
                    "min": heuristic,
                    "max": heuristic,
                    "heuristic": heuristic,
                    "heuristic_norm": 0.0,
                    "depth": 0,
                    "tree_ply": 0,
                    "reply_width": 1,
                    "fast_path": 1.0,
                    "high_single_bomb_fast_path": 1.0,
                },
            )
        )
    return scored


def _mcts_finalize_scores(
    candidates: List[Dict],
    samples: Dict[Tuple, Dict[str, float]],
    heuristic_values: Dict[Tuple, float],
    heuristic_center: float,
    heuristic_scale: float,
    heuristic_weight: float,
    risk_lambda: float,
    effective_depth: int,
    effective_tree_ply: int,
    effective_reply_width: int,
) -> List[Tuple[Dict, float, int, Dict[str, float]]]:
    scored: List[Tuple[Dict, float, int, Dict[str, float]]] = []
    for action in candidates:
        key = _mcts_action_key(action)
        sample = samples.get(key, {})
        count = int(sample.get("count", 0))
        heuristic = heuristic_values.get(key, 0.0)
        heuristic_norm = (heuristic - heuristic_center) / heuristic_scale
        if count <= 0:
            avg = heuristic
            std = 0.0
            win_rate = 0.0
            min_val = heuristic
            max_val = heuristic
            adjusted = heuristic
        else:
            total = sample.get("total", 0.0)
            total_sq = sample.get("total_sq", 0.0)
            wins = sample.get("wins", 0.0)
            avg = total / count
            variance = (total_sq / count) - avg * avg
            std = math.sqrt(max(0.0, variance))
            win_rate = wins / count
            min_val = sample.get("min", avg)
            max_val = sample.get("max", avg)
            adjusted = avg - risk_lambda * std + heuristic_norm * heuristic_weight
        stats = {
            "avg": avg,
            "adjusted": adjusted,
            "std": std,
            "win_rate": win_rate,
            "min": min_val,
            "max": max_val,
            "heuristic": heuristic,
            "heuristic_norm": heuristic_norm,
            "depth": effective_depth if count > 0 else 0,
            "tree_ply": effective_tree_ply if count > 0 else 0,
            "reply_width": max(1, effective_reply_width) if count > 0 else 1,
        }
        scored.append((action, adjusted, count, stats))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored


def _mcts_score_actions(
    state: Dict,
    bot_id: str,
    sims: int,
    depth: int,
    width: int,
    tree_ply: int,
    reply_width: int,
    risk_lambda: float,
    deadline: Optional[float] = None,
) -> List[Tuple[Dict, float, int, Dict[str, float]]]:
    legal = GuandanGame.get_legal_actions(state, bot_id)
    if "play" not in legal:
        return []
    candidates = _CORE._candidate_actions(state, bot_id, width)
    candidates = _CORE._filter_overbomb_actions(state, bot_id, candidates)
    if not candidates:
        return []

    effective_sims, effective_depth, effective_tree_ply, effective_reply_width = _CORE._mcts_budget(
        state,
        sims,
        depth,
        tree_ply,
        reply_width,
        len(candidates),
    )
    heuristic_weight = 3.8 if state.get("current_trick") and len(candidates) <= 2 else 2.2
    heuristic_values: Dict[Tuple, float] = {}
    for action in candidates:
        heuristic_values[_mcts_action_key(action)] = _CORE._mcts_root_heuristic_value(state, bot_id, action, depth)
    heuristic_center = sum(heuristic_values.values()) / len(heuristic_values)
    heuristic_scale = max(1.0, max(abs(value - heuristic_center) for value in heuristic_values.values()))

    if len(candidates) == 1:
        only = candidates[0]
        heuristic = heuristic_values[_mcts_action_key(only)]
        return [
            (
                only,
                heuristic,
                0,
                {
                    "avg": heuristic,
                    "adjusted": heuristic,
                    "std": 0.0,
                    "win_rate": 1.0,
                    "min": heuristic,
                    "max": heuristic,
                    "heuristic": heuristic,
                    "heuristic_norm": 0.0,
                    "depth": 0,
                    "tree_ply": 0,
                    "reply_width": 1,
                },
            )
        ]

    obvious_scores = _CORE._mcts_obvious_response_scores(state, bot_id, candidates, heuristic_values)
    if obvious_scores:
        return obvious_scores
    high_single_bomb_scores = _CORE._mcts_high_single_bomb_scores(state, bot_id, candidates, heuristic_values)
    if high_single_bomb_scores:
        return high_single_bomb_scores

    current_combo = (state.get("current_trick") or {}).get("combo") or {}
    has_pass = any(action.get("type") == "pass" for action in candidates)
    has_bomb_response = False
    for action in candidates:
        if action.get("type") != "play":
            continue
        hand = state["players"][bot_id]["hand"]
        hand_map = _map_hand_by_id(hand)
        play_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
        if combo and combo.get("type") in BOMB_TYPES:
            has_bomb_response = True
            break
    if (
        len(candidates) == 2
        and has_pass
        and has_bomb_response
        and current_combo.get("type") == "single"
        and current_combo.get("rank_value", 0) >= 70
    ):
        effective_sims = max(effective_sims, 14)
        heuristic_weight = max(heuristic_weight, 7.0 if current_combo.get("rank_value", 0) >= 90 else 5.0)

    rng = random.Random()
    sims_per = max(1, effective_sims // max(1, len(candidates)))
    effective_tree_ply = max(0, min(effective_tree_ply, effective_depth))
    leaf_rollout_depth = max(0, effective_depth - effective_tree_ply)
    samples: Dict[Tuple, Dict[str, float]] = {
        _mcts_action_key(action): {"count": 0, "total": 0.0, "total_sq": 0.0, "wins": 0.0, "min": None, "max": None}
        for action in candidates
    }
    cfg = state.get("config", {})
    min_rounds = max(1, int(cfg.get("bot_mcts_early_stop_min_rounds", 4)))
    stable_rounds_needed = max(1, int(cfg.get("bot_mcts_early_stop_stable_rounds", 2)))
    early_stop_gap = float(cfg.get("bot_mcts_early_stop_gap", 7.5))
    stable_rounds = 0
    previous_top_key = None
    final_scored: List[Tuple[Dict, float, int, Dict[str, float]]] = []
    for round_idx in range(sims_per):
        if deadline is not None and time.perf_counter() >= deadline:
            break
        for action in candidates:
            if deadline is not None and time.perf_counter() >= deadline:
                break
            key = _mcts_action_key(action)
            det = _CORE._determinize_state(state, bot_id, rng)
            _, err = GuandanGame.apply_action(det, bot_id, action)
            if err:
                continue
            value = _CORE._mcts_reply_tree_value(
                det,
                bot_id,
                effective_tree_ply,
                max(1, effective_reply_width),
                leaf_rollout_depth,
            )
            sample = samples[key]
            sample["count"] += 1
            sample["total"] += value
            sample["total_sq"] += value * value
            if value > 0:
                sample["wins"] += 1
            if sample["min"] is None or value < sample["min"]:
                sample["min"] = value
            if sample["max"] is None or value > sample["max"]:
                sample["max"] = value
        final_scored = _mcts_finalize_scores(
            candidates,
            samples,
            heuristic_values,
            heuristic_center,
            heuristic_scale,
            heuristic_weight,
            risk_lambda,
            effective_depth,
            effective_tree_ply,
            effective_reply_width,
        )
        if round_idx + 1 < min_rounds or len(final_scored) < 2:
            continue
        top_key = _mcts_action_key(final_scored[0][0])
        gap = final_scored[0][1] - final_scored[1][1]
        if gap >= early_stop_gap:
            if top_key == previous_top_key:
                stable_rounds += 1
            else:
                stable_rounds = 1
                previous_top_key = top_key
            if stable_rounds >= stable_rounds_needed:
                break
        else:
            previous_top_key = top_key
            stable_rounds = 0
        if deadline is not None and time.perf_counter() >= deadline:
            break
    if final_scored:
        return final_scored
    return _mcts_finalize_scores(
        candidates,
        samples,
        heuristic_values,
        heuristic_center,
        heuristic_scale,
        heuristic_weight,
        risk_lambda,
        effective_depth,
        effective_tree_ply,
        effective_reply_width,
    )


def _mcts_pick_action(
    state: Dict,
    bot_id: str,
    sims: int,
    depth: int,
    width: int,
    tree_ply: int,
    reply_width: int,
    risk_lambda: float,
    deadline: Optional[float] = None,
) -> Tuple[Optional[Dict], List[Tuple[Dict, float, int, Dict[str, float]]]]:
    scored = _CORE._mcts_score_actions(
        state,
        bot_id,
        sims,
        depth,
        width,
        tree_ply,
        reply_width,
        risk_lambda,
        deadline=deadline,
    )
    if not scored:
        return None, []
    return scored[0][0], scored


def _minimax_value(
    state: Dict,
    bot_id: str,
    depth: int,
    alpha: float,
    beta: float,
    width: int,
    deadline: Optional[float] = None,
) -> float:
    if deadline is not None and time.perf_counter() >= deadline:
        return _evaluate_state_for_bot(state, bot_id)
    if depth <= 0 or state.get("game_over"):
        return _evaluate_state_for_bot(state, bot_id)
    actor = _next_actor(state)
    if actor is None:
        return _evaluate_state_for_bot(state, bot_id)
    actions = _CORE._candidate_actions(state, actor, width)
    if not actions:
        return _evaluate_state_for_bot(state, bot_id)
    maximize = _team_of(state, actor) == _team_of(state, bot_id)
    if maximize:
        value = -1e9
        for action in actions:
            if deadline is not None and time.perf_counter() >= deadline:
                break
            nxt = copy.deepcopy(state)
            _, err = GuandanGame.apply_action(nxt, actor, action)
            if err:
                continue
            value = max(value, _minimax_value(nxt, bot_id, depth - 1, alpha, beta, width, deadline=deadline))
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return value
    value = 1e9
    for action in actions:
        if deadline is not None and time.perf_counter() >= deadline:
            break
        nxt = copy.deepcopy(state)
        _, err = GuandanGame.apply_action(nxt, actor, action)
        if err:
            continue
        value = min(value, _minimax_value(nxt, bot_id, depth - 1, alpha, beta, width, deadline=deadline))
        beta = min(beta, value)
        if beta <= alpha:
            break
    return value


def _minimax_pick_action(
    state: Dict,
    bot_id: str,
    depth: int,
    width: int,
    deadline: Optional[float] = None,
) -> Optional[List[int]]:
    legal = GuandanGame.get_legal_actions(state, bot_id)
    if "play" not in legal:
        return None
    actions = _CORE._candidate_actions(state, bot_id, width)
    actions = _CORE._filter_overbomb_actions(state, bot_id, actions)
    if not actions:
        return None
    best_action = None
    best_value = -1e9
    for action in actions:
        if deadline is not None and time.perf_counter() >= deadline:
            break
        nxt = copy.deepcopy(state)
        _, err = GuandanGame.apply_action(nxt, bot_id, action)
        if err:
            continue
        value = _minimax_value(nxt, bot_id, depth - 1, -1e9, 1e9, width, deadline=deadline)
        if value > best_value:
            best_value = value
            best_action = action
    if best_action and best_action.get("type") == "play":
        return best_action.get("card_ids")
    return None


def _minimal_bomb_response(
    hand: List[Dict], level_rank: int, current_combo: Dict, config: Dict
) -> Optional[List[int]]:
    candidates = _find_bomb_candidates(hand, level_rank)
    for cand in candidates:
        combo = {
            "type": cand["type"],
            "size": len(cand["cards"]),
            "rank_value": cand.get("rank_value", 0),
            "high_value": cand.get("high_value", 0),
            "tier": cand.get("tier", 0),
            "uses_wild": cand.get("uses_wild", False),
        }
        if _compare_combos(current_combo, combo, level_rank, config):
            return cand["cards"]
    return None


def _bot_score_components(
    state: Dict, bot_id: str, cards: Optional[List[int]], depth: int
) -> Dict[str, float]:
    level_rank = state["level_rank"]
    config = state.get("config", {})
    hand = state["players"][bot_id]["hand"]
    current_trick = state.get("current_trick")
    teammate = _teammate_of(state, bot_id)
    if not cards:
        components: Dict[str, float] = _hand_state_value_components(state, bot_id, hand)
        if current_trick and teammate == current_trick.get("player_id"):
            components["protect_teammate"] = _teammate_protect_bonus(state, bot_id)
        elif current_trick and _team_of(state, current_trick.get("player_id")) != _team_of(state, bot_id):
            response_score = _best_response_play_score(state, bot_id, max(2, depth), non_bomb_only=True)
            teammate_control = _teammate_future_control_probability(state, bot_id)
            if response_score is not None and response_score > 0:
                leader_left = len(state["players"].get(current_trick.get("player_id"), {}).get("hand", []))
                pass_cap = 8.5
                if leader_left <= 14:
                    pass_cap += 2.5
                if leader_left <= 10:
                    pass_cap += 2.5
                if leader_left <= 6:
                    pass_cap += 2.5
                components["pass_opportunity_cost"] = -min(pass_cap, response_score * 0.72)
            else:
                bomb_profile = _high_single_bomb_profile(state, bot_id)
                if teammate_control > 0 and current_trick.get("combo", {}).get("type") == "single":
                    components["defer_to_teammate_control"] = teammate_control * 7.0
                leader_left = len(state["players"].get(current_trick.get("player_id"), {}).get("hand", []))
                combo_type = (current_trick.get("combo") or {}).get("type")
                combo_value = (current_trick.get("combo") or {}).get("rank_value", 0)
                if leader_left <= 10 and combo_type in ("pair", "three") and combo_value >= 80:
                    critical_bomb_bonus = 0.0
                    for option in _filter_overbomb_options(state, bot_id, _list_hint_options(state, bot_id)):
                        critical_bomb_bonus = max(
                            critical_bomb_bonus,
                            _critical_pair_three_bomb_bonus(state, bot_id, option),
                        )
                    if critical_bomb_bonus > 0:
                        components["critical_bomb_pass_penalty"] = -min(12.0, critical_bomb_bonus * 0.95)
                opportunity = _best_takeover_opportunity(state, bot_id)
                if opportunity > 0:
                    pass_cap = 6.0
                    if leader_left <= 10 and combo_type in ("single", "pair", "three") and combo_value >= 80:
                        pass_cap += 5.0
                    if leader_left <= 10 and combo_type in ("pair", "three") and combo_value >= 80:
                        pass_cap += 4.0
                    if leader_left <= 6 and combo_type in ("single", "pair", "three") and combo_value >= 80:
                        pass_cap += 3.0
                    components["pass_opportunity_cost"] = -min(pass_cap, opportunity * 1.55)
                if bomb_profile:
                    rank_pressure = bomb_profile["rank_pressure"]
                    if rank_pressure <= 2.5:
                        components["cheap_bomb_pass_penalty"] = -(4.5 - rank_pressure * 1.2)
                    elif rank_pressure >= 4.0:
                        components["preserve_premium_bomb"] = (rank_pressure - 3.5) * 2.0
        components["total"] = sum(components.values())
        return components

    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, level_rank, config)
    if not combo:
        return {"total": -999.0}

    remaining = _remove_cards(hand, cards)
    components: Dict[str, float] = _hand_state_value_components(state, bot_id, remaining)
    components["play_cards"] = len(cards) * 0.6
    shape_score = _shape_transition_score(hand, cards, level_rank)
    if abs(shape_score) > 0.001:
        components["shape_value"] = shape_score
    plan_score = _plan_alignment_score(hand, cards, combo, level_rank)
    if current_trick and combo.get("type") == "single" and _is_clean_low_single_response(state, bot_id, cards):
        plan_score = max(0.8, plan_score)
    if abs(plan_score) > 0.001:
        components["plan_alignment"] = plan_score
    control_break = _control_group_break_penalty(hand, cards, level_rank)
    if control_break > 0.001 and combo["type"] not in BOMB_TYPES:
        components["control_break_penalty"] = -control_break
    if current_trick:
        response_cost = _response_material_cost(state, bot_id, cards, combo)
        if response_cost > 0.001:
            components["response_material"] = -response_cost * 0.55
        lock_bonus = _single_lock_bonus(state, bot_id, cards, combo)
        if lock_bonus > 0.001:
            components["single_lock"] = lock_bonus
        clean_single_bonus = _cheap_clean_single_takeover_bonus(state, bot_id, cards, combo)
        if clean_single_bonus > 0.001:
            components["cheap_clean_single_takeover"] = clean_single_bonus
    if not remaining:
        components["finish_bonus"] = 100.0
    if combo["type"] in BOMB_TYPES:
        base = -1.5
        if current_trick and current_trick.get("combo", {}).get("type") in BOMB_TYPES:
            base = 1.5
        components["bomb_bonus"] = base + _bomb_tier(combo) * 0.35
        critical_bonus = _critical_pair_three_bomb_bonus(state, bot_id, cards, combo)
        if critical_bonus > 0:
            components["critical_bomb_takeover"] = critical_bonus
        if current_trick and (current_trick.get("combo") or {}).get("type") == "single":
            current_rank = current_trick.get("combo", {}).get("rank_value", 0)
            if current_rank >= 90:
                low_bomb_anchor = _point_order_value(3, level_rank)
                if combo.get("type") == "bomb":
                    rank_pressure = max(0.0, combo.get("rank_value", low_bomb_anchor) - low_bomb_anchor)
                else:
                    rank_pressure = 6.0 + _bomb_tier(combo) * 1.5
                minimal = _minimal_bomb_response(hand, level_rank, current_trick.get("combo", {}), config)
                if minimal is not None and tuple(sorted(minimal)) == tuple(sorted(cards)) and rank_pressure <= 2.5:
                    components["cheap_bomb_takeover"] = 4.5 - rank_pressure * 1.2
                elif rank_pressure >= 4.0:
                    components["premium_bomb_spend_penalty"] = -(rank_pressure - 3.5) * 2.0
    if combo.get("uses_wild"):
        components["wild_penalty"] = -2.0

    opp_ids = [
        pid
        for pid in state["turn_order"]
        if _team_of(state, pid) != _team_of(state, bot_id) and not state["players"][pid]["finished"]
    ]
    likely_blocks = 0
    likely_beats = 0
    for opp in opp_ids:
        if _bot_estimate_opponent_can_beat(state, opp, combo):
            likely_beats += 1
        else:
            likely_blocks += 1
    if likely_blocks:
        components["opp_block"] = likely_blocks * 4.0
    if likely_beats:
        components["opp_risk"] = -likely_beats * 3.0

    if current_trick and teammate == current_trick.get("player_id"):
        overtrick_penalty = _teammate_overtrick_penalty(
            state,
            bot_id,
            cards,
            combo,
            len(remaining),
        )
        if overtrick_penalty > 0:
            components["avoid_overtrick"] = -overtrick_penalty
    elif current_trick and _team_of(state, current_trick.get("player_id")) != _team_of(state, bot_id):
        seize = _takeover_opportunity_score(state, bot_id, cards)
        if seize > 0:
            components["seize_tempo"] = seize * 1.25
        leader_left = len(state["players"].get(current_trick.get("player_id"), {}).get("hand", []))
        if combo.get("type") == (current_trick.get("combo") or {}).get("type") and combo.get("type") not in BOMB_TYPES:
            natural_takeover = 0.0
            if leader_left <= 14:
                natural_takeover += 3.5
            if leader_left <= 10:
                natural_takeover += 3.0
            if leader_left <= 6:
                natural_takeover += 4.0
            if natural_takeover > 0 and not _cards_use_special_material(play_cards, level_rank):
                components["deny_short_lead"] = natural_takeover
        if combo["type"] in BOMB_TYPES and current_trick.get("combo", {}).get("type") == "single":
            teammate_control = _teammate_future_control_probability(state, bot_id)
            if teammate_control > 0:
                components["save_bomb_for_teammate"] = -teammate_control * (7.5 + _bomb_tier(combo) * 1.8)

    if not current_trick:
        lead_score = _lead_option_score(state, bot_id, cards)
        if abs(lead_score) > 0.001:
            components["lead_plan"] = lead_score * 0.18
        trap_penalty = _lead_low_single_trap_penalty(hand, cards, level_rank)
        if trap_penalty > 0.001:
            components["low_single_trap"] = -trap_penalty
        escape_bonus = _lead_low_single_escape_bonus(hand, cards, level_rank)
        if escape_bonus > 0.001:
            components["shed_low_single"] = escape_bonus
        initiative_penalty = _lead_single_initiative_penalty(hand, cards, level_rank)
        if initiative_penalty > 0.001:
            components["keep_initiative_shape"] = -initiative_penalty

    if depth >= 2 and remaining:
        lead_cards = _choose_lead_play(remaining, level_rank, config, state, bot_id)
        if lead_cards and len(lead_cards) == len(remaining):
            components["lead_finish_bonus"] = 12.0

    components["total"] = sum(components.values())
    return components


def _bot_score_play(state: Dict, bot_id: str, cards: Optional[List[int]], depth: int) -> float:
    return _bot_score_components(state, bot_id, cards, depth).get("total", -999.0)


def _filter_overbomb_options(state: Dict, player_id: str, options: List[List[int]]) -> List[List[int]]:
    current_trick = state.get("current_trick")
    if not current_trick:
        return options
    if current_trick.get("combo", {}).get("type") in BOMB_TYPES:
        return options
    pdata = state["players"].get(player_id)
    if not pdata:
        return options
    hand = pdata.get("hand", [])
    if not hand:
        return options
    hand_map = _map_hand_by_id(hand)
    level_rank = state["level_rank"]
    config = state.get("config", {})
    filtered: List[List[int]] = []
    bombs: List[List[int]] = []
    has_non_bomb = False
    for cards in options:
        combo_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(combo_cards, level_rank, config)
        if combo and combo["type"] in BOMB_TYPES:
            if len(cards) == len(hand):
                filtered.append(cards)
            else:
                bombs.append(cards)
        else:
            filtered.append(cards)
            if combo:
                has_non_bomb = True
    if has_non_bomb:
        return filtered
    if bombs:
        minimal = None
        candidates = _find_bomb_candidates(hand, level_rank)
        if candidates:
            minimal = candidates[0]["cards"]
        if minimal:
            full_hand = [card["id"] for card in hand]
            keep = [full_hand] if full_hand in bombs and full_hand != minimal else []
            return [minimal] + keep
    return filtered + bombs


def _filter_overbomb_actions(state: Dict, player_id: str, actions: List[Dict]) -> List[Dict]:
    if not actions:
        return actions
    play_actions = [action for action in actions if action.get("type") == "play"]
    if not play_actions:
        return actions
    options = [action.get("card_ids", []) for action in play_actions]
    filtered_options = _filter_overbomb_options(state, player_id, options)
    if len(filtered_options) == len(options):
        return actions
    allowed = {tuple(option) for option in filtered_options}
    filtered: List[Dict] = []
    for action in actions:
        if action.get("type") != "play":
            filtered.append(action)
            continue
        card_ids = tuple(action.get("card_ids", []))
        if card_ids in allowed:
            filtered.append(action)
    return filtered


def _bot_select_play(state: Dict, bot_id: str, depth: int) -> Optional[List[int]]:
    legal = GuandanGame.get_legal_actions(state, bot_id)
    if "play" not in legal:
        return None
    hand = state["players"][bot_id]["hand"]
    current_trick = state.get("current_trick")
    current_combo = current_trick["combo"] if current_trick else None
    if hand and _can_play_all(hand, state["level_rank"], state.get("config", {}), current_combo):
        return [card["id"] for card in hand]
    options = _list_hint_options(state, bot_id)
    current_trick = state.get("current_trick")
    if current_trick and current_trick["combo"]["type"] in ("bomb", "straight_flush", "heavenly"):
        minimal = _minimal_bomb_response(
            state["players"][bot_id]["hand"],
            state["level_rank"],
            current_trick["combo"],
            state.get("config", {}),
        )
        if minimal:
            options = [minimal]
    elif current_trick:
        options = _rank_response_options(state, bot_id, options)
    else:
        options = _rank_lead_options(state, bot_id, options)
    options = _filter_overbomb_options(state, bot_id, options)
    if not options:
        return None
    current_trick = state.get("current_trick")
    candidates: List[Optional[List[int]]] = options[:]
    if current_trick and "pass" in legal:
        candidates.append(None)
    scored = [(cand, _bot_score_play(state, bot_id, cand, depth)) for cand in candidates]
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[0][0]


def _bot_explain_snapshot(state: Dict) -> Dict:
    order = state.get("turn_order") or list(state.get("players", {}).keys())
    players = []
    for pid in order:
        pdata = state["players"].get(pid, {})
        meta = state.get("player_meta", {}).get(pid, {})
        players.append(
            {
                "player_id": pid,
                "name": meta.get("name"),
                "team": _team_of(state, pid),
                "hand_count": len(pdata.get("hand", [])),
                "finished": pdata.get("finished", False),
                "finish_rank": pdata.get("finish_rank"),
            }
        )

    trick_view = None
    current_trick = state.get("current_trick")
    if current_trick:
        combo = current_trick.get("combo") or {}
        trick_view = {
            "player_id": current_trick.get("player_id"),
            "type": combo.get("type"),
            "size": combo.get("size"),
            "rank_value": combo.get("rank_value"),
            "high_value": combo.get("high_value"),
            "cards": list(current_trick.get("cards") or []),
        }

    trick_plays = []
    for pid in order:
        cards = (state.get("trick_plays") or {}).get(pid)
        if not cards:
            continue
        meta = state.get("player_meta", {}).get(pid, {})
        if cards == "pass":
            labels = ["Pass"]
        else:
            labels = [_card_label(card) for card in cards]
        trick_plays.append({"player_id": pid, "name": meta.get("name"), "cards": labels})

    return {
        "phase": state.get("phase"),
        "round_number": state.get("round_number"),
        "dealer_team": state.get("dealer_team"),
        "level_rank": state.get("level_rank"),
        "current_turn": state.get("current_turn"),
        "players": players,
        "current_trick": trick_view,
        "trick_plays": trick_plays,
    }


def _build_bot_explain(
    state: Dict,
    bot_id: str,
    chosen_cards: List[int],
    method: str,
    depth: int,
    method_scores: Optional[List[Tuple[Dict, float, int, Dict[str, float]]]] = None,
    method_meta: Optional[Dict] = None,
    chosen_action_type: str = "play",
) -> Dict:
    hand = state["players"][bot_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    hand_before = sorted(hand, key=lambda c: _single_order_value(c, state["level_rank"]), reverse=True)
    hand_before_labels = [_card_label(card) for card in hand_before]
    decision = _bot_explain_snapshot(state)

    def label_cards(card_ids: List[int]) -> List[str]:
        labels = []
        for cid in card_ids:
            card = hand_map.get(cid)
            labels.append(_card_label(card) if card else str(cid))
        return labels

    def label_action(action_type: str, card_ids: List[int]) -> List[str]:
        if action_type == "pass":
            return ["Pass"]
        return label_cards(card_ids)

    def hand_labels_for(action_type: str) -> List[str]:
        remaining = hand
        if action_type == "play" and chosen_cards:
            remaining = _remove_cards(hand, chosen_cards)
        sorted_hand = sorted(
            remaining, key=lambda c: _single_order_value(c, state["level_rank"]), reverse=True
        )
        return [_card_label(card) for card in sorted_hand]

    if method == "mcts" and method_scores:
        play_scores = [
            (action, score, sims, stats)
            for action, score, sims, stats in method_scores
            if action.get("type") == "play"
        ]
        all_scores = method_scores[:]
        if not play_scores:
            play_scores = all_scores
        chosen_score = None
        chosen_stats = None
        chosen_action_type = chosen_action_type or "play"
        for action, score, _, stats in all_scores:
            if action.get("type") != chosen_action_type:
                continue
            if chosen_action_type == "pass":
                chosen_score = score
                chosen_stats = stats
                break
            if action.get("card_ids") == chosen_cards:
                chosen_score = score
                chosen_stats = stats
                break
        if chosen_score is None and all_scores:
            chosen_score = all_scores[0][1]
            chosen_stats = all_scores[0][3]
        top = []
        for action, score, _, stats in all_scores[:3]:
            cards = action.get("card_ids") or []
            action_type = action.get("type", "play")
            comps = {
                "mcts_avg": stats.get("avg", score) if stats else score,
                "mcts_adjusted": stats.get("adjusted", score) if stats else score,
                "mcts_std": stats.get("std", 0.0) if stats else 0.0,
                "mcts_win_rate": stats.get("win_rate", 0.0) if stats else 0.0,
                "mcts_min": stats.get("min", score) if stats else score,
                "mcts_max": stats.get("max", score) if stats else score,
                "mcts_root_heuristic": stats.get("heuristic", 0.0) if stats else 0.0,
                "mcts_root_heuristic_norm": stats.get("heuristic_norm", 0.0) if stats else 0.0,
            }
            top.append(
                {
                    "cards": label_action(action_type, cards),
                    "score": score,
                    "components": comps,
                }
            )
        chosen_comps = {
            "mcts_avg": chosen_stats.get("avg", chosen_score) if chosen_stats else chosen_score,
            "mcts_adjusted": chosen_stats.get("adjusted", chosen_score) if chosen_stats else chosen_score,
            "mcts_std": chosen_stats.get("std", 0.0) if chosen_stats else 0.0,
            "mcts_win_rate": chosen_stats.get("win_rate", 0.0) if chosen_stats else 0.0,
            "mcts_min": chosen_stats.get("min", chosen_score) if chosen_stats else chosen_score,
            "mcts_max": chosen_stats.get("max", chosen_score) if chosen_stats else chosen_score,
            "mcts_root_heuristic": chosen_stats.get("heuristic", 0.0) if chosen_stats else 0.0,
            "mcts_root_heuristic_norm": chosen_stats.get("heuristic_norm", 0.0) if chosen_stats else 0.0,
        }
        return {
            "method": method,
            "score_model": "mcts",
            "method_details": method_meta or {},
            "chosen": {
                "cards": label_action(chosen_action_type, chosen_cards),
                "score": chosen_score if chosen_score is not None else -999.0,
                "components": chosen_comps,
            },
            "decision": decision,
            "hand_before": hand_before_labels,
            "hand": hand_labels_for(chosen_action_type),
            "top": top,
        }

    options = _list_hint_options(state, bot_id)
    current_trick = state.get("current_trick")
    current_combo = current_trick["combo"] if current_trick else None
    if hand and _can_play_all(hand, state["level_rank"], state.get("config", {}), current_combo):
        play_all = [card["id"] for card in hand]
        if play_all not in options:
            options = [play_all] + options
    if current_trick and current_trick["combo"]["type"] in BOMB_TYPES:
        minimal = _minimal_bomb_response(
            hand,
            state["level_rank"],
            current_trick["combo"],
            state.get("config", {}),
        )
        if minimal:
            options = [minimal]
    elif current_trick:
        options = _rank_response_options(state, bot_id, options)
    else:
        options = _rank_lead_options(state, bot_id, options)
    options = _filter_overbomb_options(state, bot_id, options)

    scored: List[Tuple[List[int], float, Dict[str, float]]] = []
    for cards in options:
        comps = _bot_score_components(state, bot_id, cards, depth)
        scored.append((cards, comps.get("total", -999.0), comps))
    scored.sort(key=lambda item: item[1], reverse=True)
    top = []
    for cards, score, comps in scored[:3]:
        comps_clean = {k: v for k, v in comps.items() if k != "total" and abs(v) > 0.001}
        top.append(
            {
                "cards": label_cards(cards),
                "score": score,
                "components": comps_clean,
            }
        )

    chosen_comps = _bot_score_components(state, bot_id, chosen_cards, depth)
    chosen_clean = {k: v for k, v in chosen_comps.items() if k != "total" and abs(v) > 0.001}
    return {
        "method": method,
        "score_model": "heuristic",
        "chosen": {
            "cards": label_action(chosen_action_type, chosen_cards),
            "score": chosen_comps.get("total", -999.0),
            "components": chosen_clean,
        },
        "decision": decision,
        "hand_before": hand_before_labels,
        "hand": hand_labels_for(chosen_action_type),
        "top": top,
    }


def _suggest_hint_cards(state: Dict, player_id: str) -> Optional[List[int]]:
    options = _list_hint_options(state, player_id)
    if state.get("current_trick"):
        options = _rank_response_options(state, player_id, options)
    return options[0] if options else None
