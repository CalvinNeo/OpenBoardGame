import copy
import math
import random
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
_evaluate_combo = _proxy("_evaluate_combo")
_team_of = _proxy("_team_of")
_teammate_of = _proxy("_teammate_of")
_hand_strength_score = _proxy("_hand_strength_score")
_estimated_turns_to_finish = _proxy("_estimated_turns_to_finish")
_control_card_score = _proxy("_control_card_score")
_team_finish_score = _proxy("_team_finish_score")
_best_response_play_score = _proxy("_best_response_play_score")
_best_takeover_opportunity = _proxy("_best_takeover_opportunity")
_takeover_opportunity_score = _proxy("_takeover_opportunity_score")
_response_material_cost = _proxy("_response_material_cost")
_bot_estimate_opponent_can_beat = _proxy("_bot_estimate_opponent_can_beat")
_control_group_break_penalty = _proxy("_control_group_break_penalty")
_group_fragment_penalty = _proxy("_group_fragment_penalty")
_shape_transition_score = _proxy("_shape_transition_score")
_cards_use_special_material = _proxy("_cards_use_special_material")
_lead_low_single_trap_penalty = _proxy("_lead_low_single_trap_penalty")
_lead_low_single_escape_bonus = _proxy("_lead_low_single_escape_bonus")
_list_hint_options = _proxy("_list_hint_options")
_rank_response_options = _proxy("_rank_response_options")
_rank_lead_options = _proxy("_rank_lead_options")
_choose_lead_play = _proxy("_choose_lead_play")
_can_play_all = _proxy("_can_play_all")
_minimal_bomb_response = _proxy("_minimal_bomb_response")
_single_lock_bonus = _proxy("_single_lock_bonus")
_find_bomb_candidates = _proxy("_find_bomb_candidates")
_compare_combos = _proxy("_compare_combos")
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
    bonus = 6.0
    if active_counts and min(active_counts) >= 10:
        bonus += 8.0
    elif teammate_left >= 8:
        bonus += 4.0
    if opp_counts and min(opp_counts) >= 8:
        bonus += 2.0
    return bonus


def _combo_numeric_value(combo: Dict) -> int:
    if combo.get("type") in ("straight", "three_pairs", "steel_plate"):
        return combo.get("high_value", 0)
    return combo.get("rank_value", 0)


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
    penalty = _teammate_protect_bonus(state, player_id) * 0.85
    lead_strength = _teammate_lead_strength(state, player_id)
    penalty += lead_strength
    if combo["type"] not in BOMB_TYPES and _breaks_bomb_shape(hand, cards, state["level_rank"]):
        penalty += 18.0 if lead_strength >= 8.0 else 10.0
    if combo["type"] in BOMB_TYPES:
        penalty += 8.0 + _bomb_tier(combo) * 2.5
        if current_combo.get("type") not in BOMB_TYPES:
            penalty += 4.0
    response_cost = _response_material_cost(state, player_id, cards, combo)
    if response_cost > 0:
        penalty += response_cost * (0.9 if lead_strength >= 8.0 else 0.55)
    if combo.get("type") == current_combo.get("type"):
        margin = max(0.0, _combo_numeric_value(combo) - _combo_numeric_value(current_combo))
        if lead_strength >= 8.0:
            penalty += max(0.0, 4.5 - margin * 1.8)
    if (
        combo.get("type") in ("pair", "three", "full_house")
        and _combo_numeric_value(combo) >= _point_order_value(14, state["level_rank"])
        and lead_strength >= 8.0
    ):
        penalty += 4.5
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
    rng.shuffle(unknown_ids)

    idx = 0
    for pid in det["turn_order"]:
        if pid == perspective_id:
            continue
        count = len(det["players"][pid]["hand"])
        assigned = unknown_ids[idx : idx + count]
        idx += count
        if len(assigned) < count:
            # fallback: keep existing cards if not enough unknowns
            continue
        det["players"][pid]["hand"] = [id_to_card[cid] for cid in assigned]
    return det


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
        if not state.get("current_trick"):
            cards = _choose_lead_play(
                state["players"][player_id]["hand"],
                state["level_rank"],
                state.get("config", {}),
                state,
                player_id,
            )
        else:
            cards = _suggest_hint_cards(state, player_id)
        if cards:
            return {"type": "play", "card_ids": cards}
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
    top_action = ranked_plays[0] if ranked_plays else None
    if top_action is None or not _is_obvious_low_single_response(state, bot_id, top_action.get("card_ids", []) or []):
        return None

    cfg = state.get("config", {})
    top_heuristic = heuristic_values.get(_mcts_action_key(top_action), -999.0)
    pass_action = next((action for action in candidates if action.get("type") == "pass"), None)
    pass_heuristic = heuristic_values.get(_mcts_action_key(pass_action), -999.0) if pass_action else -999.0
    if pass_action and top_heuristic < pass_heuristic + cfg.get("bot_mcts_obvious_response_margin", 2.25):
        return None

    ordered = [top_action]
    seen = {_mcts_action_key(top_action)}
    for action in ranked_actions:
        key = _mcts_action_key(action)
        if key in seen:
            continue
        ordered.append(action)
        seen.add(key)

    scored: List[Tuple[Dict, float, int, Dict[str, float]]] = []
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
                },
            )
        )
    return scored


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
            win_rate = 1.0
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
        for action in candidates:
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
) -> Tuple[Optional[Dict], List[Tuple[Dict, float, int, Dict[str, float]]]]:
    scored = _CORE._mcts_score_actions(state, bot_id, sims, depth, width, tree_ply, reply_width, risk_lambda)
    if not scored:
        return None, []
    return scored[0][0], scored


def _minimax_value(state: Dict, bot_id: str, depth: int, alpha: float, beta: float, width: int) -> float:
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
            nxt = copy.deepcopy(state)
            _, err = GuandanGame.apply_action(nxt, actor, action)
            if err:
                continue
            value = max(value, _minimax_value(nxt, bot_id, depth - 1, alpha, beta, width))
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return value
    value = 1e9
    for action in actions:
        nxt = copy.deepcopy(state)
        _, err = GuandanGame.apply_action(nxt, actor, action)
        if err:
            continue
        value = min(value, _minimax_value(nxt, bot_id, depth - 1, alpha, beta, width))
        beta = min(beta, value)
        if beta <= alpha:
            break
    return value


def _minimax_pick_action(state: Dict, bot_id: str, depth: int, width: int) -> Optional[List[int]]:
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
        nxt = copy.deepcopy(state)
        _, err = GuandanGame.apply_action(nxt, bot_id, action)
        if err:
            continue
        value = _minimax_value(nxt, bot_id, depth - 1, -1e9, 1e9, width)
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
                components["pass_opportunity_cost"] = -min(8.5, response_score * 0.72)
            else:
                bomb_profile = _high_single_bomb_profile(state, bot_id)
                if teammate_control > 0 and current_trick.get("combo", {}).get("type") == "single":
                    components["defer_to_teammate_control"] = teammate_control * 7.0
                opportunity = _best_takeover_opportunity(state, bot_id)
                if opportunity > 0:
                    components["pass_opportunity_cost"] = -min(6.0, opportunity * 1.55)
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
    if not remaining:
        components["finish_bonus"] = 100.0
    if combo["type"] in BOMB_TYPES:
        base = -1.5
        if current_trick and current_trick.get("combo", {}).get("type") in BOMB_TYPES:
            base = 1.5
        components["bomb_bonus"] = base + _bomb_tier(combo) * 0.35
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
        if combo["type"] in BOMB_TYPES and current_trick.get("combo", {}).get("type") == "single":
            teammate_control = _teammate_future_control_probability(state, bot_id)
            if teammate_control > 0:
                components["save_bomb_for_teammate"] = -teammate_control * (7.5 + _bomb_tier(combo) * 1.8)

    if not current_trick:
        trap_penalty = _lead_low_single_trap_penalty(hand, cards, level_rank)
        if trap_penalty > 0.001:
            components["low_single_trap"] = -trap_penalty
        escape_bonus = _lead_low_single_escape_bonus(hand, cards, level_rank)
        if escape_bonus > 0.001:
            components["shed_low_single"] = escape_bonus

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
