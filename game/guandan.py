import copy
import math
import random
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game import guandan_ai as _guandan_ai
from game.memories import build_html_document, esc, format_bool, format_timestamp, render_kv_table, render_table, section

SUITS = ["spades", "hearts", "clubs", "diamonds"]
SUIT_LABELS = {"spades": "S", "hearts": "H", "clubs": "C", "diamonds": "D"}
SUIT_EMOJI = {"spades": "♠️", "hearts": "♥️", "clubs": "♣️", "diamonds": "♦️"}
RANKS = list(range(2, 15))
RANK_LABELS = {11: "J", 12: "Q", 13: "K", 14: "A"}
BOMB_TYPES = ("bomb", "straight_flush", "heavenly")

DEFAULT_CONFIG = {
    "hard_bomb_beats_soft": False,
    "require_partner_not_last_for_a": False,
    "bot_mode": "auto",
    "bot_nn_checkpoint": "assets/guandan/checkpoints/guandan_nn.pt",
    "bot_nn_candidate_limit": 12,
    "bot_nn_temperature": 0.0,
    "bot_search_depth": 4,
    "bot_mcts_sims": 96,
    "bot_mcts_depth": 8,
    "bot_mcts_tree_ply": 2,
    "bot_mcts_reply_width": 2,
    "bot_mcts_root_width": 5,
    "bot_mcts_risk_lambda": 0.28,
    "bot_mcts_early_stop_min_rounds": 4,
    "bot_mcts_early_stop_gap": 7.5,
    "bot_mcts_early_stop_stable_rounds": 2,
    "bot_mcts_obvious_response_margin": 2.25,
    "bot_mcts_override_margin": 5.5,
    "bot_mcts_structure_guard_margin": 2.5,
    "bot_determinize_samples": 3,
    "bot_rollout_heuristic_depth": 2,
    "bot_endgame_threshold": 24,
    "bot_minimax_depth": 5,
    "bot_minimax_width": 8,
    "bot_think_time_ms": 320,
    "bot_mcts_time_ms": 220,
    "bot_minimax_time_ms": 180,
}

_NN_CHECKPOINT_ROOT = Path(__file__).resolve().parent.parent
_NN_MODEL_CACHE: Dict[str, Dict[str, object]] = {}

STRAIGHT_SEQUENCES: List[Tuple[List[int], int]] = []
STRAIGHT_SEQUENCES.append(([14, 2, 3, 4, 5], 5))
for start in range(2, 11):
    seq = list(range(start, start + 5))
    STRAIGHT_SEQUENCES.append((seq, start + 4))


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _resolve_nn_checkpoint_path(checkpoint: Optional[str]) -> Path:
    raw = str(checkpoint or DEFAULT_CONFIG["bot_nn_checkpoint"]).strip()
    if not raw:
        raw = DEFAULT_CONFIG["bot_nn_checkpoint"]
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = _NN_CHECKPOINT_ROOT / candidate
    return candidate


def _load_nn_policy_model(checkpoint: Optional[str]) -> Tuple[Optional[object], Optional[str], str]:
    resolved = _resolve_nn_checkpoint_path(checkpoint)
    resolved_str = str(resolved)
    if not resolved.exists():
        return None, f"checkpoint not found: {resolved_str}", resolved_str
    try:
        mtime = resolved.stat().st_mtime
    except OSError as exc:
        return None, str(exc), resolved_str

    cached = _NN_MODEL_CACHE.get(resolved_str)
    if cached and cached.get("mtime") == mtime:
        return cached.get("model"), None, resolved_str

    try:
        from game import guandan_nn_train as _guandan_nn_train

        model, _payload = _guandan_nn_train.load_checkpoint(resolved_str, device="cpu")
        model.eval()
    except Exception as exc:
        return None, str(exc), resolved_str

    _NN_MODEL_CACHE[resolved_str] = {"mtime": mtime, "model": model}
    return model, None, resolved_str


def _build_deck() -> List[Dict]:
    deck: List[Dict] = []
    card_id = 0
    for _ in range(2):
        for suit in SUITS:
            for rank in RANKS:
                deck.append(
                    {
                        "id": card_id,
                        "rank": rank,
                        "suit": suit,
                        "joker": None,
                    }
                )
                card_id += 1
        deck.append({"id": card_id, "rank": None, "suit": None, "joker": "big"})
        card_id += 1
        deck.append({"id": card_id, "rank": None, "suit": None, "joker": "small"})
        card_id += 1
    random.shuffle(deck)
    return deck


def _full_deck() -> List[Dict]:
    deck: List[Dict] = []
    card_id = 0
    for _ in range(2):
        for suit in SUITS:
            for rank in RANKS:
                deck.append(
                    {
                        "id": card_id,
                        "rank": rank,
                        "suit": suit,
                        "joker": None,
                    }
                )
                card_id += 1
        deck.append({"id": card_id, "rank": None, "suit": None, "joker": "big"})
        card_id += 1
        deck.append({"id": card_id, "rank": None, "suit": None, "joker": "small"})
        card_id += 1
    return deck


def _rank_label(rank: int) -> str:
    return RANK_LABELS.get(rank, str(rank))


def _card_label(card: Dict) -> str:
    joker = card.get("joker")
    if joker == "big":
        return "🃏B"
    if joker == "small":
        return "🃏S"
    rank = card.get("rank")
    suit = card.get("suit")
    suit_label = SUIT_EMOJI.get(suit) or SUIT_LABELS.get(suit, "?")
    return f"{suit_label}{_rank_label(rank)}"


def _is_joker(card: Dict) -> bool:
    return card.get("joker") in ("big", "small")


def _is_wild(card: Dict, level_rank: int) -> bool:
    if _is_joker(card):
        return False
    return card.get("suit") == "hearts" and card.get("rank") == level_rank


def _base_rank_order(level_rank: int) -> List[int]:
    order = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    if level_rank in order:
        order.remove(level_rank)
    return order


def _point_order_value(rank: int, level_rank: int, joker: Optional[str] = None) -> int:
    if joker == "big":
        return 100
    if joker == "small":
        return 90
    if rank == level_rank:
        return 80
    base = _base_rank_order(level_rank)
    return 60 - base.index(rank)


def _single_order_value(card: Dict, level_rank: int) -> int:
    joker = card.get("joker")
    if joker == "big":
        return 100
    if joker == "small":
        return 90
    if card.get("rank") == level_rank:
        return 70
    base = _base_rank_order(level_rank)
    return 60 - base.index(card.get("rank"))


def _card_sort_key(card: Dict, level_rank: int) -> Tuple[int, int, int]:
    suit = card.get("suit")
    suit_idx = SUITS.index(suit) if suit in SUITS else len(SUITS)
    rank = card.get("rank") or 0
    return (-_single_order_value(card, level_rank), suit_idx, -rank)


def _memory_card(card: Dict, level_rank: int) -> Dict:
    return {
        "label": _card_label(card),
        "rank": card.get("rank"),
        "suit": card.get("suit"),
        "joker": card.get("joker"),
        "is_wild": _is_wild(card, level_rank),
    }


def _memory_hand(hand: List[Dict], level_rank: int) -> List[Dict]:
    ordered = sorted(hand, key=lambda card: _card_sort_key(card, level_rank))
    return [_memory_card(card, level_rank) for card in ordered]


def _memory_hand_map(state: Dict) -> Dict[str, List[Dict]]:
    level_rank = state.get("level_rank", 2)
    return {pid: _memory_hand(state["players"][pid]["hand"], level_rank) for pid in state.get("turn_order", [])}


def _memory_visible_card(state: Dict) -> Optional[Dict]:
    visible_card_id = state.get("visible_card_id")
    if visible_card_id is None:
        return None
    for card in _full_deck():
        if card["id"] == visible_card_id:
            return _memory_card(card, state.get("level_rank", 2))
    return None


def _current_round_memory(state: Dict) -> Optional[Dict]:
    memories = state.get("round_memories") or []
    if not memories:
        return None
    return memories[-1]


def _start_round_memory(state: Dict) -> Dict:
    entry = {
        "round_number": state.get("round_number", 1),
        "dealer_team": state.get("dealer_team"),
        "level_rank": state.get("level_rank"),
        "team_levels_start": {team: data.get("level") for team, data in state.get("teams", {}).items()},
        "start_player": state.get("current_turn"),
        "visible_card": _memory_visible_card(state),
        "initial_hands": _memory_hand_map(state),
        "tribute": None,
        "tricks": [],
        "finish_order": [],
        "status": "in_progress",
    }
    memories = state.setdefault("round_memories", [])
    if memories and memories[-1].get("round_number") == entry["round_number"]:
        memories[-1] = entry
    else:
        memories.append(entry)
    return entry


def _ensure_round_memories(state: Dict) -> List[Dict]:
    memories = state.setdefault("round_memories", [])
    if not memories:
        _start_round_memory(state)
    return memories


def _ensure_open_trick_memory(state: Dict, leader_id: Optional[str]) -> Dict:
    round_entry = _current_round_memory(state)
    if round_entry is None:
        _ensure_round_memories(state)
        round_entry = _current_round_memory(state)
    tricks = round_entry.setdefault("tricks", [])
    if tricks and tricks[-1].get("status") == "in_progress":
        return tricks[-1]
    trick = {
        "index": len(tricks) + 1,
        "leader_id": leader_id,
        "actions": [],
        "winner_id": None,
        "status": "in_progress",
    }
    tricks.append(trick)
    return trick


def _close_open_trick_memory(state: Dict, winner_id: Optional[str], status: str = "completed") -> None:
    round_entry = _current_round_memory(state)
    if round_entry is None:
        return
    tricks = round_entry.get("tricks") or []
    if not tricks:
        return
    trick = tricks[-1]
    if trick.get("status") != "in_progress":
        return
    trick["winner_id"] = winner_id
    trick["status"] = status


def _snapshot_tribute_memory(tribute: Dict, level_rank: int) -> Dict:
    def map_cards(card_map: Dict[str, Dict]) -> Dict[str, Dict]:
        return {pid: _memory_card(card, level_rank) for pid, card in (card_map or {}).items()}

    return {
        "type": tribute.get("type"),
        "stage": tribute.get("stage"),
        "payers": list(tribute.get("payers", [])),
        "receivers": list(tribute.get("receivers", [])),
        "tribute_cards": map_cards(tribute.get("tribute_cards", {})),
        "return_cards": map_cards(tribute.get("return_cards", {})),
        "assignments": dict(tribute.get("assignments", {})),
    }


def _set_round_tribute_memory(state: Dict, payload: Optional[Dict]) -> None:
    round_entry = _current_round_memory(state)
    if round_entry is None:
        _ensure_round_memories(state)
        round_entry = _current_round_memory(state)
    round_entry["tribute"] = payload


def _update_round_memory_result(state: Dict, status: str = "completed") -> None:
    round_entry = _current_round_memory(state)
    if round_entry is None:
        return
    round_entry["finish_order"] = list(state.get("finish_order", []))
    round_entry["team_levels_after"] = {team: data.get("level") for team, data in state.get("teams", {}).items()}
    round_entry["dealer_team_after"] = state.get("dealer_team")
    round_entry["status"] = status


def _sorted_rank_candidates(level_rank: int) -> List[int]:
    ranks = list(RANKS)
    ranks.sort(key=lambda r: _point_order_value(r, level_rank), reverse=True)
    return ranks


def _active_players(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if not state["players"][pid]["finished"]]


def _next_active_player(state: Dict, current_pid: str) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    if current_pid not in order:
        return order[0]
    idx = order.index(current_pid)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if not state["players"][pid]["finished"]:
            return pid
    return None


def _team_of(state: Dict, player_id: str) -> str:
    return state["player_teams"][player_id]


def _teammate_of(state: Dict, player_id: str) -> Optional[str]:
    team = _team_of(state, player_id)
    for pid in state["teams"][team]["players"]:
        if pid != player_id:
            return pid
    return None


def _map_hand_by_id(hand: List[Dict]) -> Dict[int, Dict]:
    return {card["id"]: card for card in hand}


def _remove_cards(hand: List[Dict], card_ids: List[int]) -> List[Dict]:
    remaining = []
    remove_set = set(card_ids)
    for card in hand:
        if card["id"] in remove_set:
            continue
        remaining.append(card)
    return remaining


def _evaluate_straight(
    ranks: List[int], wild_count: int
) -> Optional[int]:
    if len(ranks) != len(set(ranks)):
        return None
    best_high = None
    ranks_set = set(ranks)
    for seq, high_value in STRAIGHT_SEQUENCES:
        seq_set = set(seq)
        if not ranks_set.issubset(seq_set):
            continue
        missing = len(seq_set - ranks_set)
        if missing <= wild_count:
            if best_high is None or high_value > best_high:
                best_high = high_value
    return best_high


def _evaluate_three_pairs(
    ranks: List[int], wild_count: int
) -> Optional[int]:
    counts: Dict[int, int] = {}
    for rank in ranks:
        counts[rank] = counts.get(rank, 0) + 1
        if counts[rank] > 2:
            return None
    ranks_set = set(ranks)
    for start in range(12, 1, -1):
        seq = {start, start + 1, start + 2}
        if not ranks_set.issubset(seq):
            continue
        missing = 0
        for rank in seq:
            missing += 2 - counts.get(rank, 0)
        if missing <= wild_count:
            return start + 2
    return None


def _evaluate_steel_plate(
    ranks: List[int], wild_count: int
) -> Optional[int]:
    counts: Dict[int, int] = {}
    for rank in ranks:
        counts[rank] = counts.get(rank, 0) + 1
        if counts[rank] > 3:
            return None
    ranks_set = set(ranks)
    for start in range(13, 1, -1):
        seq = {start, start + 1}
        if not ranks_set.issubset(seq):
            continue
        missing = 0
        for rank in seq:
            missing += 3 - counts.get(rank, 0)
        if missing <= wild_count:
            return start + 1
    return None


def _pair_possible(
    exclude_rank: int,
    normal_counts: Dict[int, int],
    wild_count: int,
    joker_counts: Dict[str, int],
) -> bool:
    if wild_count >= 2:
        return True
    for rank, count in normal_counts.items():
        if rank == exclude_rank:
            continue
        if count + wild_count >= 2:
            return True
    if joker_counts.get("big", 0) >= 2:
        return True
    if joker_counts.get("small", 0) >= 2:
        return True
    return False


def _evaluate_combo(cards: List[Dict], level_rank: int, config: Dict) -> Optional[Dict]:
    if not cards:
        return None
    size = len(cards)
    jokers = [card for card in cards if _is_joker(card)]
    wilds = [card for card in cards if _is_wild(card, level_rank)]
    normals = [card for card in cards if not _is_joker(card) and not _is_wild(card, level_rank)]

    joker_types = [card["joker"] for card in jokers]
    joker_counts = {"big": joker_types.count("big"), "small": joker_types.count("small")}
    normal_ranks = [card["rank"] for card in normals]
    wild_count = len(wilds)

    if size == 4 and joker_counts.get("big") == 2 and joker_counts.get("small") == 2:
        return {
            "type": "heavenly",
            "size": 4,
            "tier": 7,
            "rank_value": 0,
            "uses_wild": False,
        }

    if size == 5 and not jokers:
        suit = None
        for card in normals:
            if suit is None:
                suit = card["suit"]
            elif suit != card["suit"]:
                suit = None
                break
        if suit is not None or not normals:
            high_value = _evaluate_straight(normal_ranks, wild_count)
            if high_value is not None:
                return {
                    "type": "straight_flush",
                    "size": 5,
                    "tier": 3,
                    "high_value": high_value,
                    "uses_wild": wild_count > 0,
                }

    if size >= 4 and not jokers:
        distinct_ranks = set(normal_ranks)
        if len(distinct_ranks) <= 1:
            rank = None
            if distinct_ranks:
                rank = next(iter(distinct_ranks))
            else:
                rank = _sorted_rank_candidates(level_rank)[0]
            if size <= 5:
                tier = size - 3
            else:
                tier = size - 2
            return {
                "type": "bomb",
                "size": size,
                "tier": tier,
                "rank": rank,
                "rank_value": _point_order_value(rank, level_rank),
                "uses_wild": wild_count > 0,
            }

    if size == 1:
        card = cards[0]
        return {
            "type": "single",
            "size": 1,
            "rank_value": _single_order_value(card, level_rank),
            "label": _card_label(card),
        }

    if size == 2:
        if jokers:
            if len(jokers) == 2 and joker_counts.get("big") == 2:
                return {
                    "type": "pair",
                    "size": 2,
                    "rank_value": _point_order_value(0, level_rank, joker="big"),
                    "rank": "big",
                    "uses_wild": False,
                }
            if len(jokers) == 2 and joker_counts.get("small") == 2:
                return {
                    "type": "pair",
                    "size": 2,
                    "rank_value": _point_order_value(0, level_rank, joker="small"),
                    "rank": "small",
                    "uses_wild": False,
                }
            return None
        distinct_ranks = set(normal_ranks)
        if len(distinct_ranks) > 1:
            return None
        required = 2 - len(normals)
        if required <= wild_count:
            if distinct_ranks:
                rank = next(iter(distinct_ranks))
            else:
                rank = _sorted_rank_candidates(level_rank)[0]
            return {
                "type": "pair",
                "size": 2,
                "rank": rank,
                "rank_value": _point_order_value(rank, level_rank),
                "uses_wild": wild_count > 0,
            }
        return None

    if size == 3:
        if jokers:
            return None
        distinct_ranks = set(normal_ranks)
        if len(distinct_ranks) > 1:
            return None
        required = 3 - len(normals)
        if required <= wild_count:
            if distinct_ranks:
                rank = next(iter(distinct_ranks))
            else:
                rank = _sorted_rank_candidates(level_rank)[0]
            return {
                "type": "three",
                "size": 3,
                "rank": rank,
                "rank_value": _point_order_value(rank, level_rank),
                "uses_wild": wild_count > 0,
            }
        return None

    if size == 5:
        if jokers and joker_counts.get("big", 0) + joker_counts.get("small", 0) >= 3:
            return None
        normal_counts: Dict[int, int] = {}
        for rank in normal_ranks:
            normal_counts[rank] = normal_counts.get(rank, 0) + 1
        for triple_rank in _sorted_rank_candidates(level_rank):
            normal_count = normal_counts.get(triple_rank, 0)
            required = max(0, 3 - normal_count)
            if required > wild_count:
                continue
            remaining_wild = wild_count - required
            if _pair_possible(triple_rank, normal_counts, remaining_wild, joker_counts):
                return {
                    "type": "full_house",
                    "size": 5,
                    "rank": triple_rank,
                    "rank_value": _point_order_value(triple_rank, level_rank),
                    "uses_wild": wild_count > 0,
                }
        high_value = _evaluate_straight(normal_ranks, wild_count)
        if high_value is not None and not jokers:
            return {
                "type": "straight",
                "size": 5,
                "high_value": high_value,
                "uses_wild": wild_count > 0,
            }
        return None

    if size == 6:
        if jokers:
            return None
        high_value = _evaluate_three_pairs(normal_ranks, wild_count)
        if high_value is not None:
            return {
                "type": "three_pairs",
                "size": 6,
                "high_value": high_value,
                "uses_wild": wild_count > 0,
            }
        high_value = _evaluate_steel_plate(normal_ranks, wild_count)
        if high_value is not None:
            return {
                "type": "steel_plate",
                "size": 6,
                "high_value": high_value,
                "uses_wild": wild_count > 0,
            }
        return None

    return None


def _bomb_tier(combo: Dict) -> int:
    if combo["type"] == "heavenly":
        return 7
    if combo["type"] == "straight_flush":
        return 3
    return combo.get("tier", 0)


def _compare_combos(current: Dict, challenger: Dict, level_rank: int, config: Dict) -> bool:
    current_bomb = current["type"] in ("bomb", "straight_flush", "heavenly")
    challenger_bomb = challenger["type"] in ("bomb", "straight_flush", "heavenly")

    if not current_bomb and challenger_bomb:
        return True
    if current_bomb and not challenger_bomb:
        return False
    if current_bomb and challenger_bomb:
        current_tier = _bomb_tier(current)
        challenger_tier = _bomb_tier(challenger)
        if challenger_tier != current_tier:
            return challenger_tier > current_tier
        if challenger["type"] == "straight_flush":
            return challenger["high_value"] > current["high_value"]
        if challenger["type"] == "heavenly":
            return False
        if challenger["rank_value"] != current["rank_value"]:
            return challenger["rank_value"] > current["rank_value"]
        if config.get("hard_bomb_beats_soft"):
            if challenger.get("uses_wild") != current.get("uses_wild"):
                return not challenger.get("uses_wild")
        return False

    if challenger["type"] != current["type"] or challenger["size"] != current["size"]:
        return False

    if challenger["type"] in ("straight", "three_pairs", "steel_plate"):
        return challenger["high_value"] > current["high_value"]
    return challenger["rank_value"] > current["rank_value"]


def _tribute_order_value(card: Dict, level_rank: int) -> int:
    if _is_wild(card, level_rank):
        return -1
    return _single_order_value(card, level_rank)


def _max_tribute_cards(hand: List[Dict], level_rank: int) -> List[Dict]:
    candidates = [card for card in hand if not _is_wild(card, level_rank)]
    if not candidates:
        return hand[:]
    max_value = max(_single_order_value(card, level_rank) for card in candidates)
    return [card for card in candidates if _single_order_value(card, level_rank) == max_value]


def _eligible_return_cards(hand: List[Dict]) -> List[Dict]:
    eligible = []
    for card in hand:
        joker = card.get("joker")
        if joker:
            continue
        if card.get("rank") is not None and card.get("rank") <= 10:
            eligible.append(card)
    if eligible:
        return eligible
    return hand[:]


def _hand_info(hand: List[Dict], level_rank: int) -> Dict:
    wild_cards: List[int] = []
    jokers_big: List[int] = []
    jokers_small: List[int] = []
    normals_by_rank: Dict[int, List[int]] = {}
    normals_by_suit: Dict[str, Dict[int, List[int]]] = {suit: {} for suit in SUITS}
    for card in hand:
        card_id = card["id"]
        if _is_wild(card, level_rank):
            wild_cards.append(card_id)
            continue
        joker = card.get("joker")
        if joker == "big":
            jokers_big.append(card_id)
            continue
        if joker == "small":
            jokers_small.append(card_id)
            continue
        rank = card.get("rank")
        suit = card.get("suit")
        normals_by_rank.setdefault(rank, []).append(card_id)
        normals_by_suit.setdefault(suit, {}).setdefault(rank, []).append(card_id)
    return {
        "wild_cards": wild_cards,
        "jokers_big": jokers_big,
        "jokers_small": jokers_small,
        "normals_by_rank": normals_by_rank,
        "normals_by_suit": normals_by_suit,
    }


def _rank_strength(level_rank: int) -> Dict[int, int]:
    return {rank: _point_order_value(rank, level_rank) for rank in RANKS}


def _ranks_sorted_by_strength(level_rank: int, ascending: bool = True) -> List[int]:
    strength = _rank_strength(level_rank)
    return sorted(RANKS, key=lambda r: strength[r], reverse=not ascending)


def _take_from_list(source: List[int], count: int) -> Tuple[List[int], List[int]]:
    taken = source[:count]
    remaining = source[count:]
    return taken, remaining


def _build_of_rank(rank: int, count: int, info: Dict) -> Optional[Tuple[List[int], List[int]]]:
    normals = list(info["normals_by_rank"].get(rank, []))
    wilds = list(info["wild_cards"])
    take_norm = min(len(normals), count)
    selected = normals[:take_norm]
    remaining_normals = normals[take_norm:]
    needed = count - take_norm
    if needed > len(wilds):
        return None
    selected += wilds[:needed]
    remaining_wilds = wilds[needed:]
    info_copy = {**info, "wild_cards": remaining_wilds}
    if remaining_normals:
        ranks = dict(info_copy["normals_by_rank"])
        ranks[rank] = remaining_normals
        info_copy["normals_by_rank"] = ranks
    else:
        ranks = dict(info_copy["normals_by_rank"])
        ranks.pop(rank, None)
        info_copy["normals_by_rank"] = ranks
    return selected, info_copy


def _find_single_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    candidates = []
    for card in hand:
        value = _single_order_value(card, level_rank)
        if value > threshold:
            candidates.append((value, card["id"], _is_wild(card, level_rank), _is_joker(card)))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[2], item[3]))
    return [candidates[0][1]]


def _find_pair_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    info = _hand_info(hand, level_rank)
    strength = _rank_strength(level_rank)
    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        if strength[rank] <= threshold:
            continue
        built = _build_of_rank(rank, 2, info)
        if built:
            return built[0]
    if len(info["jokers_big"]) >= 2 and 100 > threshold:
        return info["jokers_big"][:2]
    if len(info["jokers_small"]) >= 2 and 90 > threshold:
        return info["jokers_small"][:2]
    return None


def _find_three_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    info = _hand_info(hand, level_rank)
    strength = _rank_strength(level_rank)
    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        if strength[rank] <= threshold:
            continue
        built = _build_of_rank(rank, 3, info)
        if built:
            return built[0]
    return None


def _find_full_house_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    strength = _rank_strength(level_rank)
    base_info = _hand_info(hand, level_rank)
    for triple_rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        if strength[triple_rank] <= threshold:
            continue
        built = _build_of_rank(triple_rank, 3, base_info)
        if not built:
            continue
        triple_cards, info = built
        pair_cards = _find_lowest_pair(info, exclude_rank=triple_rank, level_rank=level_rank)
        if pair_cards:
            return triple_cards + pair_cards
    return None


def _list_pair_choices(info: Dict, exclude_rank: Optional[int], level_rank: int) -> List[List[int]]:
    options: List[List[int]] = []
    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        if exclude_rank is not None and rank == exclude_rank:
            continue
        built = _build_of_rank(rank, 2, info)
        if built:
            options.append(built[0])
    if len(info.get("jokers_big", [])) >= 2:
        options.append(info["jokers_big"][:2])
    if len(info.get("jokers_small", [])) >= 2:
        options.append(info["jokers_small"][:2])
    return _dedupe_card_sets(options)


def _find_lowest_pair(info: Dict, exclude_rank: Optional[int], level_rank: int) -> Optional[List[int]]:
    options = _list_pair_choices(info, exclude_rank, level_rank)
    return options[0] if options else None


def _find_straight_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    info = _hand_info(hand, level_rank)
    for seq, high_value in STRAIGHT_SEQUENCES:
        if high_value <= threshold:
            continue
        needed = []
        wilds = list(info["wild_cards"])
        cards: List[int] = []
        for rank in seq:
            normals = info["normals_by_rank"].get(rank, [])
            if normals:
                cards.append(normals[0])
            else:
                needed.append(rank)
        if len(needed) <= len(wilds):
            cards.extend(wilds[: len(needed)])
            return cards
    return None


def _find_three_pairs_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    info = _hand_info(hand, level_rank)
    for start in range(2, 12):
        high_value = start + 2
        if high_value <= threshold:
            continue
        seq = [start, start + 1, start + 2]
        cards: List[int] = []
        wilds = list(info["wild_cards"])
        needed = 0
        for rank in seq:
            normals = list(info["normals_by_rank"].get(rank, []))
            take = normals[:2]
            cards.extend(take)
            missing = 2 - len(take)
            needed += missing
        if needed <= len(wilds):
            cards.extend(wilds[:needed])
            return cards
    return None


def _find_steel_plate_to_beat(hand: List[Dict], level_rank: int, threshold: int) -> Optional[List[int]]:
    info = _hand_info(hand, level_rank)
    for start in range(2, 14):
        high_value = start + 1
        if high_value <= threshold or start + 1 > 14:
            continue
        seq = [start, start + 1]
        cards: List[int] = []
        wilds = list(info["wild_cards"])
        needed = 0
        for rank in seq:
            normals = list(info["normals_by_rank"].get(rank, []))
            take = normals[:3]
            cards.extend(take)
            missing = 3 - len(take)
            needed += missing
        if needed <= len(wilds):
            cards.extend(wilds[:needed])
            return cards
    return None


def _find_straight_flush_candidates(hand: List[Dict], level_rank: int) -> List[Tuple[int, List[int]]]:
    info = _hand_info(hand, level_rank)
    candidates: List[Tuple[int, List[int]]] = []
    for suit in SUITS:
        suit_map = info["normals_by_suit"].get(suit, {})
        for seq, high_value in STRAIGHT_SEQUENCES:
            cards: List[int] = []
            wilds = list(info["wild_cards"])
            needed = 0
            for rank in seq:
                normals = suit_map.get(rank, [])
                if normals:
                    cards.append(normals[0])
                else:
                    needed += 1
            if needed <= len(wilds):
                cards.extend(wilds[:needed])
                candidates.append((high_value, cards))
    candidates.sort(key=lambda item: item[0])
    return candidates


def _bomb_tier_for_size(size: int) -> int:
    if size <= 5:
        return size - 3
    return size - 2


def _find_bomb_candidates(hand: List[Dict], level_rank: int) -> List[Dict]:
    info = _hand_info(hand, level_rank)
    strength = _rank_strength(level_rank)
    wilds = list(info["wild_cards"])
    candidates: List[Dict] = []

    if len(info["jokers_big"]) >= 2 and len(info["jokers_small"]) >= 2:
        candidates.append(
            {
                "type": "heavenly",
                "tier": 7,
                "rank_value": 0,
                "high_value": 0,
                "cards": info["jokers_big"][:2] + info["jokers_small"][:2],
                "uses_wild": False,
            }
        )

    straight_flushes = _find_straight_flush_candidates(hand, level_rank)
    for high_value, cards in straight_flushes:
        candidates.append(
            {
                "type": "straight_flush",
                "tier": 3,
                "rank_value": 0,
                "high_value": high_value,
                "cards": cards,
                "uses_wild": any(card in wilds for card in cards),
            }
        )

    for rank, card_ids in info["normals_by_rank"].items():
        total = len(card_ids) + len(wilds)
        for size in range(4, min(8, total) + 1):
            tier = _bomb_tier_for_size(size)
            needed = max(0, size - len(card_ids))
            if needed > len(wilds):
                continue
            cards = card_ids[: min(len(card_ids), size)]
            if needed:
                cards = cards + wilds[:needed]
            candidates.append(
                {
                    "type": "bomb",
                    "tier": tier,
                    "rank_value": strength[rank],
                    "high_value": 0,
                    "cards": cards,
                    "uses_wild": needed > 0,
                }
            )
    candidates.sort(key=lambda item: (item["tier"], item["rank_value"], item["high_value"], item["uses_wild"]))
    return candidates


def _pick_bomb_to_beat(hand: List[Dict], level_rank: int, current_combo: Optional[Dict], config: Dict) -> Optional[List[int]]:
    candidates = _find_bomb_candidates(hand, level_rank)
    if not current_combo:
        for cand in candidates:
            if cand["type"] != "heavenly":
                return cand["cards"]
        return candidates[0]["cards"] if candidates else None
    current_type = current_combo["type"]
    if current_type == "heavenly":
        return None
    current_tier = _bomb_tier(current_combo)
    current_rank_value = current_combo.get("rank_value", 0)
    current_high_value = current_combo.get("high_value", 0)
    for cand in candidates:
        if cand["tier"] > current_tier:
            return cand["cards"]
        if cand["tier"] < current_tier:
            continue
        if current_type == "straight_flush":
            if cand["type"] == "straight_flush" and cand["high_value"] > current_high_value:
                return cand["cards"]
            continue
        if cand["type"] == "bomb" and cand["rank_value"] > current_rank_value:
            if config.get("hard_bomb_beats_soft") and cand["rank_value"] == current_rank_value:
                if not cand["uses_wild"]:
                    return cand["cards"]
            return cand["cards"]
    return None


def _can_play_all(hand: List[Dict], level_rank: int, config: Dict, current_combo: Optional[Dict]) -> bool:
    combo = _evaluate_combo(hand, level_rank, config)
    if not combo:
        return False
    if not current_combo:
        return True
    return _compare_combos(current_combo, combo, level_rank, config)


def _choose_lead_play(hand: List[Dict], level_rank: int, config: Dict, state: Dict, bot_id: str) -> List[int]:
    raise RuntimeError("_choose_lead_play should be bound from guandan_ai")


def _cards_key(cards: List[int]) -> str:
    return "-".join(str(cid) for cid in sorted(cards))


def _dedupe_card_sets(options: List[List[int]]) -> List[List[int]]:
    seen = set()
    unique: List[List[int]] = []
    for cards in options:
        key = _cards_key(cards)
        if key in seen:
            continue
        seen.add(key)
        unique.append(cards)
    return unique


def _list_single_options(hand: List[Dict], level_rank: int, threshold: int) -> List[List[int]]:
    candidates = []
    for card in hand:
        value = _single_order_value(card, level_rank)
        if value > threshold:
            candidates.append((value, _is_wild(card, level_rank), _is_joker(card), card["id"]))
    candidates.sort(key=lambda item: (item[0], item[1], item[2]))
    return [[cid] for _, _, _, cid in candidates]


def _list_rank_group_options(
    hand: List[Dict], level_rank: int, threshold: int, size: int
) -> List[List[int]]:
    info = _hand_info(hand, level_rank)
    strength = _rank_strength(level_rank)
    options: List[List[int]] = []
    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        if strength[rank] <= threshold:
            continue
        built = _build_of_rank(rank, size, info)
        if built:
            options.append(built[0])
    if size == 2:
        if len(info["jokers_big"]) >= 2 and 100 > threshold:
            options.append(info["jokers_big"][:2])
        if len(info["jokers_small"]) >= 2 and 90 > threshold:
            options.append(info["jokers_small"][:2])
    return _dedupe_card_sets(options)


def _list_full_house_options(hand: List[Dict], level_rank: int, threshold: int) -> List[List[int]]:
    strength = _rank_strength(level_rank)
    base_info = _hand_info(hand, level_rank)
    options: List[List[int]] = []
    for triple_rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        if strength[triple_rank] <= threshold:
            continue
        built = _build_of_rank(triple_rank, 3, base_info)
        if not built:
            continue
        triple_cards, info = built
        for pair_cards in _list_pair_choices(info, exclude_rank=triple_rank, level_rank=level_rank):
            options.append(triple_cards + pair_cards)
    return _dedupe_card_sets(options)


def _list_straight_options(hand: List[Dict], level_rank: int, threshold: int) -> List[List[int]]:
    info = _hand_info(hand, level_rank)
    options: List[List[int]] = []
    for seq, high_value in STRAIGHT_SEQUENCES:
        if high_value <= threshold:
            continue
        cards: List[int] = []
        wilds = list(info["wild_cards"])
        needed = 0
        for rank in seq:
            normals = list(info["normals_by_rank"].get(rank, []))
            if normals:
                cards.append(normals[0])
            else:
                needed += 1
        if needed <= len(wilds):
            cards.extend(wilds[:needed])
            options.append(cards)
    return _dedupe_card_sets(options)


def _list_three_pairs_options(hand: List[Dict], level_rank: int, threshold: int) -> List[List[int]]:
    info = _hand_info(hand, level_rank)
    options: List[List[int]] = []
    for start in range(2, 14):
        high_value = start + 2
        if high_value <= threshold or start + 2 > 14:
            continue
        seq = [start, start + 1, start + 2]
        cards: List[int] = []
        wilds = list(info["wild_cards"])
        needed = 0
        for rank in seq:
            normals = list(info["normals_by_rank"].get(rank, []))
            take = normals[:2]
            cards.extend(take)
            missing = 2 - len(take)
            needed += missing
        if needed <= len(wilds):
            cards.extend(wilds[:needed])
            options.append(cards)
    return _dedupe_card_sets(options)


def _list_steel_plate_options(hand: List[Dict], level_rank: int, threshold: int) -> List[List[int]]:
    info = _hand_info(hand, level_rank)
    options: List[List[int]] = []
    for start in range(2, 14):
        high_value = start + 1
        if high_value <= threshold or start + 1 > 14:
            continue
        seq = [start, start + 1]
        cards: List[int] = []
        wilds = list(info["wild_cards"])
        needed = 0
        for rank in seq:
            normals = list(info["normals_by_rank"].get(rank, []))
            take = normals[:3]
            cards.extend(take)
            missing = 3 - len(take)
            needed += missing
        if needed <= len(wilds):
            cards.extend(wilds[:needed])
            options.append(cards)
    return _dedupe_card_sets(options)


def _list_bomb_options(
    hand: List[Dict], level_rank: int, current_combo: Optional[Dict], config: Dict
) -> List[List[int]]:
    candidates = _find_bomb_candidates(hand, level_rank)
    if not current_combo:
        return [cand["cards"] for cand in candidates]
    options: List[List[int]] = []
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
            options.append(cand["cards"])
    return _dedupe_card_sets(options)


def _list_hint_options(state: Dict, player_id: str) -> List[List[int]]:
    legal = GuandanGame.get_legal_actions(state, player_id)
    if "play" not in legal:
        return []
    pdata = state["players"].get(player_id)
    if not pdata:
        return []
    hand = pdata.get("hand", [])
    if not hand:
        return []
    current_trick = state.get("current_trick")
    level_rank = state["level_rank"]
    config = state.get("config", {})
    options: List[List[int]] = []
    if current_trick:
        combo = current_trick["combo"]
        combo_type = combo["type"]
        threshold = combo.get("rank_value", 0)
        high_threshold = combo.get("high_value", 0)
        if combo_type == "single":
            options = _list_single_options(hand, level_rank, threshold)
        elif combo_type == "pair":
            options = _list_rank_group_options(hand, level_rank, threshold, 2)
        elif combo_type == "three":
            options = _list_rank_group_options(hand, level_rank, threshold, 3)
        elif combo_type == "full_house":
            options = _list_full_house_options(hand, level_rank, threshold)
        elif combo_type == "straight":
            options = _list_straight_options(hand, level_rank, high_threshold)
        elif combo_type == "three_pairs":
            options = _list_three_pairs_options(hand, level_rank, high_threshold)
        elif combo_type == "steel_plate":
            options = _list_steel_plate_options(hand, level_rank, high_threshold)
        options += _list_bomb_options(hand, level_rank, combo, config)
    else:
        options.extend(_list_single_options(hand, level_rank, 0))
        options.extend(_list_rank_group_options(hand, level_rank, 0, 2))
        options.extend(_list_rank_group_options(hand, level_rank, 0, 3))
        options.extend(_list_full_house_options(hand, level_rank, 0))
        options.extend(_list_straight_options(hand, level_rank, 0))
        options.extend(_list_three_pairs_options(hand, level_rank, 0))
        options.extend(_list_steel_plate_options(hand, level_rank, 0))
        options.extend(_list_bomb_options(hand, level_rank, None, config))
    return _dedupe_card_sets(options)


def _combo_value(combo: Dict) -> int:
    if combo["type"] in ("straight", "three_pairs", "steel_plate"):
        return combo.get("high_value", 0)
    return combo.get("rank_value", 0)


def _lead_option_score(state: Dict, player_id: str, cards: List[int]) -> float:
    raise RuntimeError("_lead_option_score should be bound from guandan_ai")


def _rank_lead_options(state: Dict, player_id: str, options: List[List[int]]) -> List[List[int]]:
    raise RuntimeError("_rank_lead_options should be bound from guandan_ai")


def _play_structure_delta(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    raise RuntimeError("_play_structure_delta should be bound from guandan_ai")


def _rank_count_map(hand: List[Dict], level_rank: int) -> Dict[int, int]:
    raise RuntimeError("_rank_count_map should be bound from guandan_ai")


def _shape_transition_score(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    raise RuntimeError("_shape_transition_score should be bound from guandan_ai")


def _group_fragment_penalty(hand: List[Dict], cards: List[int], level_rank: int, combo: Optional[Dict]) -> float:
    raise RuntimeError("_group_fragment_penalty should be bound from guandan_ai")


def _control_group_break_penalty(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    raise RuntimeError("_control_group_break_penalty should be bound from guandan_ai")


def _cards_use_special_material(play_cards: List[Dict], level_rank: int) -> bool:
    return any(_is_joker(card) or _is_wild(card, level_rank) for card in play_cards)


def _response_value_tolerance(combo_type: str) -> int:
    if combo_type in ("single", "pair", "three", "full_house", "straight", "three_pairs", "steel_plate"):
        return 1
    return 0


def _response_material_cost(
    state: Dict,
    player_id: str,
    cards: List[int],
    combo: Optional[Dict] = None,
    natural_alternative: bool = False,
) -> float:
    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    if not play_cards:
        return 999.0
    level_rank = state["level_rank"]
    config = state.get("config", {})
    if combo is None:
        combo = _evaluate_combo(play_cards, level_rank, config)
    if not combo:
        return 999.0

    current_trick = state.get("current_trick")
    current_combo = current_trick.get("combo") if current_trick else None
    structure_delta = max(0.0, _play_structure_delta(hand, cards, level_rank))
    shape_penalty = max(0.0, -_shape_transition_score(hand, cards, level_rank))
    control_break = _control_group_break_penalty(hand, cards, level_rank)
    fragment_penalty = _group_fragment_penalty(hand, cards, level_rank, combo)

    cost = structure_delta * 1.55
    cost += shape_penalty * 0.8
    cost += control_break * 1.05
    cost += fragment_penalty

    if current_combo and combo["type"] == current_combo.get("type"):
        margin = max(0, _combo_value(combo) - _combo_value(current_combo))
        factor = 0.22 if combo["type"] in ("single", "pair", "three") else 0.16
        cost += margin * factor
        if combo["type"] in ("full_house", "straight", "three_pairs", "steel_plate"):
            if not _cards_use_special_material(play_cards, level_rank):
                cost *= 0.3
                cost = max(0.0, cost - 2.2)
            else:
                cost *= 0.5
                cost = max(0.0, cost - 0.8)

    wild_count = sum(1 for card in play_cards if _is_wild(card, level_rank))
    small_joker_count = sum(1 for card in play_cards if card.get("joker") == "small")
    big_joker_count = sum(1 for card in play_cards if card.get("joker") == "big")

    if wild_count:
        cost += wild_count * 4.5
        if natural_alternative:
            cost += 4.0 + 1.2 * wild_count
    if small_joker_count:
        cost += small_joker_count * 3.5
    if big_joker_count:
        cost += big_joker_count * 4.5
    if combo["type"] == "pair" and small_joker_count == 2:
        cost += 7.0 + (5.5 if natural_alternative else 0.0)
    if combo["type"] == "pair" and big_joker_count == 2:
        cost += 8.5 + (6.0 if natural_alternative else 0.0)

    if combo["type"] in BOMB_TYPES:
        if current_combo and current_combo.get("type") not in BOMB_TYPES:
            minimal = _minimal_bomb_response(hand, level_rank, current_combo, config)
            is_minimal = minimal is not None and tuple(sorted(minimal)) == tuple(sorted(cards))
            if combo["type"] == "bomb":
                low_bomb_anchor = _point_order_value(3, level_rank)
                rank_pressure = max(0.0, combo.get("rank_value", 0) - low_bomb_anchor)
                cost += 10.0 + _bomb_tier(combo) * 2.2 + rank_pressure * 1.2 - (4.0 if is_minimal else 0.0)
                if is_minimal:
                    cost -= max(0.0, 60 - combo.get("rank_value", 0)) * 1.1
            elif combo["type"] == "straight_flush":
                cost += 13.0 + _bomb_tier(combo) * 2.8 - (2.0 if is_minimal else 0.0)
            else:
                cost += 16.0 + _bomb_tier(combo) * 3.2
        else:
            cost += 7.0 + _bomb_tier(combo) * 2.0

    for card in play_cards:
        if _is_joker(card) or _is_wild(card, level_rank):
            continue
        value = _single_order_value(card, level_rank)
        if value >= 80:
            cost += 0.6
        elif value >= 60:
            cost += 0.2
    return cost


def _rank_response_options(state: Dict, player_id: str, options: List[List[int]]) -> List[List[int]]:
    current_trick = state.get("current_trick")
    if not current_trick or not options:
        return options

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    level_rank = state["level_rank"]
    config = state.get("config", {})
    entries = []
    natural_by_type: Dict[str, bool] = {}
    has_natural_full_house = False
    leader = current_trick.get("player_id")
    leader_left = len(state["players"].get(leader, {}).get("hand", [])) if leader else 99
    for cards in _dedupe_card_sets(options):
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(play_cards, level_rank, config)
        if not combo:
            continue
        uses_special = _cards_use_special_material(play_cards, level_rank)
        if combo["type"] == "full_house" and not uses_special:
            has_natural_full_house = True
        entries.append((cards, combo, uses_special))
        if not uses_special:
            natural_by_type[combo["type"]] = True
    if not entries:
        return options

    scored = []
    for cards, combo, uses_special in entries:
        if (
            combo["type"] == "full_house"
            and uses_special
            and leader_left >= 12
            and has_natural_full_house
        ):
            continue
        natural_alt = uses_special and natural_by_type.get(combo["type"], False)
        cost = _response_material_cost(state, player_id, cards, combo, natural_alt)
        scored.append((cards, combo, cost))

    filtered = []
    for cards, combo, cost in scored:
        dominated = False
        tolerance = _response_value_tolerance(combo["type"])
        for other_cards, other_combo, other_cost in scored:
            if other_cards == cards or other_combo["type"] != combo["type"]:
                continue
            other_value = _combo_value(other_combo)
            value = _combo_value(combo)
            if other_value <= value + tolerance and other_cost <= cost - 2.25:
                dominated = True
                break
        if not dominated:
            filtered.append((cards, combo, cost))

    filtered.sort(key=lambda item: (item[2], _combo_value(item[1]), len(item[0]), _cards_key(item[0])))
    return [cards for cards, _, _ in filtered]


def _lead_single_break_penalty(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    raise RuntimeError("_lead_single_break_penalty should be bound from guandan_ai")


def _lead_low_single_escape_bonus(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    raise RuntimeError("_lead_low_single_escape_bonus should be bound from guandan_ai")


def _lead_low_single_trap_penalty(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    raise RuntimeError("_lead_low_single_trap_penalty should be bound from guandan_ai")


def _lead_short_next_opponent_penalty(state: Dict, player_id: str, cards: List[int]) -> float:
    raise RuntimeError("_lead_short_next_opponent_penalty should be bound from guandan_ai")


def _lead_special_material_penalty(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_special_material_penalty should be bound from guandan_ai")


def _lead_same_type_reentry_bonus(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_same_type_reentry_bonus should be bound from guandan_ai")


def _lead_turn_efficiency_bonus(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_turn_efficiency_bonus should be bound from guandan_ai")


def _lead_teammate_support_bonus(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_teammate_support_bonus should be bound from guandan_ai")


def _lead_initiative_retention_bonus(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_initiative_retention_bonus should be bound from guandan_ai")


def _lead_short_opponent_breakup_penalty(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_short_opponent_breakup_penalty should be bound from guandan_ai")


def _lead_structure_overreach_penalty(
    hand: List[Dict],
    cards: List[int],
    combo: Dict,
    level_rank: int,
) -> float:
    raise RuntimeError("_lead_structure_overreach_penalty should be bound from guandan_ai")


def _lead_speculative_followup_penalty(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_speculative_followup_penalty should be bound from guandan_ai")


def _lead_opening_commitment_penalty(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_lead_opening_commitment_penalty should be bound from guandan_ai")


def _should_prune_weak_lead_single(
    state: Dict, player_id: str, cards: List[int], single_score: float, best_non_single_score: Optional[float]
) -> bool:
    raise RuntimeError("_should_prune_weak_lead_single should be bound from guandan_ai")


def _should_prune_wasteful_control_break(
    state: Dict,
    player_id: str,
    cards: List[int],
    combo_type: str,
    score: float,
    best_safe_score: Optional[float],
) -> bool:
    raise RuntimeError("_should_prune_wasteful_control_break should be bound from guandan_ai")


def _should_prune_wasteful_lead_bomb(
    state: Dict,
    player_id: str,
    cards: List[int],
    combo_type: str,
    score: float,
    best_non_bomb_score: Optional[float],
    best_multi_non_bomb_score: Optional[float],
) -> bool:
    raise RuntimeError("_should_prune_wasteful_lead_bomb should be bound from guandan_ai")


def _single_lock_bonus(state: Dict, player_id: str, cards: List[int], combo: Dict) -> float:
    raise RuntimeError("_single_lock_bonus should be bound from guandan_ai")


def _takeover_opportunity_score(state: Dict, player_id: str, cards: List[int]) -> float:
    raise RuntimeError("_takeover_opportunity_score should be bound from guandan_ai")


def _best_takeover_opportunity(state: Dict, player_id: str) -> float:
    raise RuntimeError("_best_takeover_opportunity should be bound from guandan_ai")


def _best_response_play_score(state: Dict, player_id: str, depth: int, non_bomb_only: bool = True) -> Optional[float]:
    current_trick = state.get("current_trick")
    if not current_trick:
        return None
    leader = current_trick.get("player_id")
    if leader is None or _team_of(state, leader) == _team_of(state, player_id):
        return None
    options = _list_hint_options(state, player_id)
    options = _filter_overbomb_options(state, player_id, options)
    options = _rank_response_options(state, player_id, options)
    if not options:
        return None

    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    scored: List[Tuple[float, str]] = []
    for cards in options:
        play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
        if not combo:
            continue
        scored.append((_bot_score_play(state, player_id, cards, depth), combo["type"]))
    if not scored:
        return None

    if non_bomb_only:
        natural = [score for score, combo_type in scored if combo_type not in BOMB_TYPES]
        if natural:
            return max(natural)
        return None
    return max(score for score, _ in scored)


def _hypergeom_hit_probability(total: int, hits: int, draws: int) -> float:
    if total <= 0 or hits <= 0 or draws <= 0:
        return 0.0
    draws = min(draws, total)
    misses = total - hits
    miss_prob = 1.0
    for idx in range(draws):
        denom = total - idx
        if denom <= 0:
            break
        miss_prob *= max(0, misses - idx) / denom
    return max(0.0, min(1.0, 1.0 - miss_prob))


_AI_EXPORTED_FUNCS = (
    "_bot_estimate_opponent_can_beat",
    "_predict_finish_order",
    "_team_finish_score",
    "_control_card_score",
    "_hand_decomposition_summary",
    "_hand_strength_score",
    "_estimated_turns_to_finish",
    "_teammate_future_control_probability",
    "_teammate_lead_context",
    "_teammate_protect_bonus",
    "_teammate_overtrick_penalty",
    "_evaluate_state_for_bot",
    "_action_combo",
    "_heuristic_best_action",
    "_candidate_actions",
    "_should_use_mcts",
    "_determinize_state",
    "_should_accept_mcts_override",
    "_next_actor",
    "_rollout_policy_action",
    "_rollout_value",
    "_mcts_reply_tree_value",
    "_mcts_root_heuristic_value",
    "_mcts_action_key",
    "_mcts_budget",
    "_is_obvious_low_single_response",
    "_mcts_obvious_response_scores",
    "_mcts_high_single_bomb_scores",
    "_mcts_finalize_scores",
    "_mcts_score_actions",
    "_mcts_pick_action",
    "_minimax_value",
    "_minimax_pick_action",
    "_lead_low_single_escape_bonus",
    "_lead_low_single_trap_penalty",
    "_choose_lead_play",
    "_lead_option_score",
    "_rank_lead_options",
    "_play_structure_delta",
    "_rank_count_map",
    "_shape_transition_score",
    "_group_fragment_penalty",
    "_control_group_break_penalty",
    "_lead_single_break_penalty",
    "_should_prune_weak_lead_single",
    "_should_prune_wasteful_control_break",
    "_should_prune_wasteful_lead_bomb",
    "_lead_short_next_opponent_penalty",
    "_lead_structure_overreach_penalty",
    "_lead_special_material_penalty",
    "_lead_same_type_reentry_bonus",
    "_lead_turn_efficiency_bonus",
    "_lead_teammate_support_bonus",
    "_lead_initiative_retention_bonus",
    "_lead_short_opponent_breakup_penalty",
    "_lead_speculative_followup_penalty",
    "_lead_opening_commitment_penalty",
    "_minimal_bomb_response",
    "_single_lock_bonus",
    "_takeover_opportunity_score",
    "_best_takeover_opportunity",
    "_bot_score_components",
    "_bot_score_play",
    "_filter_overbomb_options",
    "_filter_overbomb_actions",
    "_bot_select_play",
    "_build_bot_explain",
    "_suggest_hint_cards",
)


def _bind_ai(name: str):
    def wrapper(*args, **kwargs):
        return _guandan_ai.call(sys.modules[__name__], name, *args, **kwargs)

    wrapper.__name__ = name
    wrapper.__qualname__ = name
    return wrapper


for _ai_name in _AI_EXPORTED_FUNCS:
    globals()[_ai_name] = _bind_ai(_ai_name)

del _ai_name


def _finish_player(state: Dict, player_id: str) -> None:
    pdata = state["players"][player_id]
    if pdata["finished"]:
        return
    pdata["finished"] = True
    state["finish_order"].append(player_id)
    pdata["finish_rank"] = len(state["finish_order"])


def _complete_finish_order(state: Dict) -> None:
    if len(state["finish_order"]) >= 4:
        return
    remaining = [pid for pid in state["turn_order"] if pid not in state["finish_order"]]
    for pid in remaining:
        _finish_player(state, pid)


def _summarize_round(state: Dict) -> Dict:
    order = state["finish_order"]
    summary = {
        "finish_order": order[:],
        "dealer_team": state["dealer_team"],
        "level_rank": state["level_rank"],
        "team_levels": {k: v["level"] for k, v in state["teams"].items()},
    }
    if len(order) >= 4:
        summary["first"] = order[0]
        summary["second"] = order[1]
        summary["third"] = order[2]
        summary["fourth"] = order[3]
    return summary


def _compute_tribute_type(state: Dict) -> str:
    if state.get("round_number", 1) <= 1:
        return "none"
    order = state["finish_order"]
    if len(order) < 4:
        return "none"
    winning_team = _team_of(state, order[0])
    losing_team = "B" if winning_team == "A" else "A"
    third_team = _team_of(state, order[2])
    fourth_team = _team_of(state, order[3])
    if third_team == losing_team and fourth_team == losing_team:
        return "double"
    if fourth_team == losing_team:
        return "single"
    return "none"


def _apply_round_result(state: Dict) -> None:
    _complete_finish_order(state)
    order = state["finish_order"]
    if len(order) < 4:
        return
    winning_team = _team_of(state, order[0])
    state["dealer_team"] = winning_team
    second_team = _team_of(state, order[1])
    third_team = _team_of(state, order[2])
    if second_team == winning_team:
        delta = 3
    elif third_team == winning_team:
        delta = 2
    else:
        delta = 1
    state["teams"][winning_team]["level"] = min(14, state["teams"][winning_team]["level"] + delta)
    state["level_rank"] = state["teams"][state["dealer_team"]]["level"]


def _check_game_over(state: Dict) -> None:
    order = state["finish_order"]
    if len(order) < 4:
        return
    dealer_team = state["dealer_team"]
    winning_team = _team_of(state, order[0])
    if winning_team != dealer_team:
        return
    if state["teams"][dealer_team]["level"] < 14:
        return
    if state["config"].get("require_partner_not_last_for_a"):
        teammate = _teammate_of(state, order[0])
        if teammate and teammate == order[3]:
            return
    state["game_over"] = True
    state["winner_team"] = dealer_team
    state["phase"] = "game_over"


def _deal_round(state: Dict, first_round: bool, start_player: Optional[str]) -> None:
    deck = _build_deck()
    visible_card_id = None
    if first_round and deck:
        visible_card_id = random.choice(deck)["id"]
    hands: Dict[str, List[Dict]] = {pid: [] for pid in state["turn_order"]}
    for idx, card in enumerate(deck):
        pid = state["turn_order"][idx % len(state["turn_order"])]
        hands[pid].append(card)
    for pid in state["turn_order"]:
        state["players"][pid]["hand"] = hands[pid]
        state["players"][pid]["finished"] = False
        state["players"][pid]["finish_rank"] = None
    state["finish_order"] = []
    state["current_trick"] = None
    state["pass_count"] = 0
    state["trick_plays"] = {}
    state["visible_card_id"] = visible_card_id
    state["pass_limits"] = {}
    state["seen_cards"] = []
    state["bot_explain"] = {}
    if first_round and visible_card_id is not None:
        for pid, hand in hands.items():
            if any(card["id"] == visible_card_id for card in hand):
                start_player = pid
                break
    if start_player is None:
        start_player = state["turn_order"][0]
    state["current_turn"] = start_player
    state["level_rank"] = state["teams"][state["dealer_team"]]["level"]
    _start_round_memory(state)


def _setup_tribute(state: Dict) -> None:
    tribute_type = _compute_tribute_type(state)
    state["tribute"] = None
    if tribute_type == "none":
        state["phase"] = "playing"
        _set_round_tribute_memory(state, {"type": "none", "status": "not_required"})
        return
    order = state["finish_order"]
    payers = []
    receivers = []
    if tribute_type == "single":
        payers = [order[3]]
        receivers = [order[0]]
    else:
        payers = [order[2], order[3]]
        receivers = [order[0], order[1]]
    for pid in payers:
        big_count = sum(1 for card in state["players"][pid]["hand"] if card.get("joker") == "big")
        if big_count >= 2:
            state["phase"] = "playing"
            _set_round_tribute_memory(
                state,
                {
                    "type": tribute_type,
                    "status": "waived",
                    "reason": "double_big_joker",
                    "payers": list(payers),
                    "receivers": list(receivers),
                },
            )
            return
    state["tribute"] = {
        "type": tribute_type,
        "stage": "tribute",
        "payers": payers,
        "receivers": receivers,
        "tribute_cards": {},
        "return_cards": {},
        "assignments": {},
    }
    state["phase"] = "tribute"
    _set_round_tribute_memory(state, _snapshot_tribute_memory(state["tribute"], state["level_rank"]))


def _tribute_leader(tribute: Dict, level_rank: int) -> Optional[str]:
    payers = tribute.get("payers", [])
    if not payers:
        return None
    if len(payers) == 1:
        return payers[0]
    tribute_cards = tribute.get("tribute_cards", {})
    ranked = []
    for pid in payers:
        card = tribute_cards.get(pid)
        if card:
            ranked.append((pid, _single_order_value(card, level_rank)))
    if ranked:
        ranked.sort(key=lambda item: item[1], reverse=True)
        return ranked[0][0]
    return payers[0] if payers else None


def _record_seen_cards(state: Dict, card_ids: List[int]) -> None:
    seen = set(state.get("seen_cards", []) or [])
    for cid in card_ids:
        seen.add(cid)
    state["seen_cards"] = list(seen)


def _record_pass_limit(state: Dict, player_id: str, combo: Dict) -> None:
    if combo.get("type") in ("bomb", "straight_flush", "heavenly"):
        return
    combo_type = combo.get("type")
    if combo_type in ("straight", "three_pairs", "steel_plate"):
        value = combo.get("high_value")
    else:
        value = combo.get("rank_value")
    if value is None:
        return
    limits = state.setdefault("pass_limits", {}).setdefault(player_id, {})
    prev = limits.get(combo_type)
    if prev is None or value > prev:
        limits[combo_type] = value


def _advance_to_round_end(state: Dict) -> None:
    _apply_round_result(state)
    state["last_round_summary"] = _summarize_round(state)
    state["phase"] = "round_end"
    _update_round_memory_result(state)
    _check_game_over(state)


def _start_next_round(state: Dict) -> None:
    state["round_number"] += 1
    previous_finish = state["finish_order"][:]
    head = previous_finish[0] if previous_finish else None
    _deal_round(state, first_round=False, start_player=head)
    state["finish_order"] = previous_finish
    _setup_tribute(state)
    state["finish_order"] = []


def _nn_pick_action(state: Dict, bot_id: str) -> Tuple[Optional[Dict], Optional[List[Tuple[Dict, float, int, Dict[str, float]]]], Dict]:
    config = state.get("config", {})
    model, error, resolved_path = _load_nn_policy_model(config.get("bot_nn_checkpoint"))
    if model is None:
        return None, None, {"checkpoint": resolved_path, "error": error or "load failed"}

    try:
        from game import guandan_nn_train as _guandan_nn_train
    except Exception as exc:
        return None, None, {"checkpoint": resolved_path, "error": str(exc)}

    candidate_limit = max(2, int(config.get("bot_nn_candidate_limit", DEFAULT_CONFIG["bot_nn_candidate_limit"])))
    temperature = max(0.0, float(config.get("bot_nn_temperature", DEFAULT_CONFIG["bot_nn_temperature"])))
    actions = _guandan_nn_train.guandan._candidate_actions(state, bot_id, candidate_limit)
    if not actions:
        return None, None, {"checkpoint": resolved_path, "error": "no candidate actions"}

    try:
        scored, state_value = _guandan_nn_train.evaluate_actions(model, state, bot_id, actions, device="cpu")
    except Exception as exc:
        return None, None, {"checkpoint": resolved_path, "error": str(exc)}

    if not scored:
        return None, None, {"checkpoint": resolved_path, "error": "empty nn scores"}

    logits = [score for _, score in scored]
    max_logit = max(logits)
    exp_values = [math.exp(value - max_logit) for value in logits]
    total = sum(exp_values) or 1.0
    probs = [value / total for value in exp_values]
    scored_with_probs = list(zip(scored, probs))
    ranked = sorted(scored_with_probs, key=lambda item: item[0][1], reverse=True)

    chosen_action = None
    if temperature > 1e-6:
        sampled_action, _, _ = _guandan_nn_train.select_model_action(
            model,
            state,
            bot_id,
            device="cpu",
            candidate_limit=candidate_limit,
            temperature=temperature,
        )
        chosen_action = sampled_action
    if chosen_action is None:
        chosen_action = dict(ranked[0][0][0])

    method_scores: List[Tuple[Dict, float, int, Dict[str, float]]] = []
    for (action, score), prob in ranked:
        method_scores.append(
            (
                dict(action),
                score,
                0,
                {
                    "logit": score,
                    "policy_prob": prob,
                    "state_value": state_value,
                },
            )
        )
    method_meta = {
        "candidates": len(actions),
        "checkpoint": Path(resolved_path).name,
        "temperature": temperature,
    }
    return chosen_action, method_scores, method_meta


def _append_bot_explain_history(
    state: Dict,
    bot_id: str,
    explain: Dict,
    action_type: str,
    card_ids: Optional[List[int]] = None,
) -> None:
    history = state.setdefault("bot_explain_history", {})
    entries = history.setdefault(bot_id, [])
    entries.append(
        {
            "round_number": state.get("round_number"),
            "phase": state.get("phase"),
            "action_type": action_type,
            "card_ids": list(card_ids or []),
            "explain": copy.deepcopy(explain),
        }
    )


class GuandanGame:
    game_id = "guandan"
    min_players = 4
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        order = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in order]
        player_meta = {p["player_id"]: p for p in order}
        player_teams = {}
        teams = {
            "A": {"players": [], "level": 2},
            "B": {"players": [], "level": 2},
        }
        for p in order:
            team = "A" if int(p.get("seat", 0)) % 2 == 0 else "B"
            player_teams[p["player_id"]] = team
            teams[team]["players"].append(p["player_id"])

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "hand": [],
                "finished": False,
                "finish_rank": None,
            }

        state = {
            "config": cfg,
            "game_start_time": time.time(),
            "player_meta": player_meta,
            "turn_order": player_ids,
            "players": state_players,
            "player_teams": player_teams,
            "teams": teams,
            "dealer_team": "A",
            "level_rank": 2,
            "round_number": 1,
            "phase": "playing",
            "current_turn": None,
            "current_trick": None,
            "pass_count": 0,
            "trick_plays": {},
            "finish_order": [],
            "last_round_summary": None,
            "visible_card_id": None,
            "tribute": None,
            "bot_explain": {},
            "bot_explain_history": {},
            "round_memories": [],
            "game_over": False,
            "winner_team": None,
        }
        _deal_round(state, first_round=True, start_player=None)
        if state["current_turn"]:
            state["dealer_team"] = _team_of(state, state["current_turn"])
            state["level_rank"] = state["teams"][state["dealer_team"]]["level"]
            _start_round_memory(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return ["play_again"]
        if player_id not in state["players"]:
            return []
        if state["phase"] == "round_end":
            return ["next_round"]
        if state["phase"] == "tribute":
            tribute = state.get("tribute") or {}
            stage = tribute.get("stage")
            if stage == "tribute" and player_id in tribute.get("payers", []):
                if player_id not in tribute.get("tribute_cards", {}):
                    return ["tribute_select"]
            if stage == "return" and player_id in tribute.get("receivers", []):
                if player_id not in tribute.get("return_cards", {}):
                    return ["return_select"]
            return []
        if state["phase"] != "playing":
            return []
        if state["players"][player_id]["finished"]:
            return []
        if player_id != state["current_turn"]:
            return []
        actions = ["play"]
        if state.get("current_trick"):
            actions.append("pass")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        action_type = action.get("type")
        events: List[Dict] = []
        if state.get("game_over"):
            if action_type == "play_again":
                players = [
                    {
                        "player_id": pid,
                        "name": meta.get("name"),
                        "seat": meta.get("seat"),
                        "is_bot": meta.get("is_bot"),
                    }
                    for pid, meta in state["player_meta"].items()
                ]
                new_state = GuandanGame.init_game(state.get("config"), players)
                state.clear()
                state.update(new_state)
                return events, None
            return events, "game over"

        if state["phase"] == "round_end":
            if action_type != "next_round":
                return events, "round over"
            _start_next_round(state)
            return events, None

        if state["phase"] == "tribute":
            tribute = state.get("tribute")
            if not tribute:
                return events, "tribute not active"
            if action_type == "tribute_select":
                if tribute.get("stage") != "tribute":
                    return events, "not accepting tribute"
                if player_id not in tribute.get("payers", []):
                    return events, "not eligible to tribute"
                if player_id in tribute.get("tribute_cards", {}):
                    return events, "tribute already selected"
                card_id = action.get("card_id")
                if not isinstance(card_id, int):
                    return events, "card_id required"
                hand = state["players"][player_id]["hand"]
                hand_map = _map_hand_by_id(hand)
                if card_id not in hand_map:
                    return events, "card not in hand"
                allowed = _max_tribute_cards(hand, state["level_rank"])
                if card_id not in {card["id"] for card in allowed}:
                    return events, "must tribute highest card"
                card = hand_map[card_id]
                state["players"][player_id]["hand"] = _remove_cards(hand, [card_id])
                tribute["tribute_cards"][player_id] = card
                if len(tribute["tribute_cards"]) == len(tribute.get("payers", [])):
                    if tribute["type"] == "single":
                        receiver = tribute["receivers"][0]
                        payer = tribute["payers"][0]
                        tribute["assignments"][receiver] = payer
                        state["players"][receiver]["hand"].append(tribute["tribute_cards"][payer])
                    else:
                        payers = tribute["payers"]
                        cards = [(pid, tribute["tribute_cards"][pid]) for pid in payers]
                        cards.sort(
                            key=lambda item: _single_order_value(item[1], state["level_rank"]),
                            reverse=True,
                        )
                        head = tribute["receivers"][0]
                        second = tribute["receivers"][1]
                        tribute["assignments"][head] = cards[0][0]
                        tribute["assignments"][second] = cards[1][0]
                        state["players"][head]["hand"].append(cards[0][1])
                        state["players"][second]["hand"].append(cards[1][1])
                    tribute["stage"] = "return"
                _set_round_tribute_memory(state, _snapshot_tribute_memory(tribute, state["level_rank"]))
                return events, None
            if action_type == "return_select":
                if tribute.get("stage") != "return":
                    return events, "not accepting returns"
                if player_id not in tribute.get("receivers", []):
                    return events, "not eligible to return"
                if player_id in tribute.get("return_cards", {}):
                    return events, "return already selected"
                card_id = action.get("card_id")
                if not isinstance(card_id, int):
                    return events, "card_id required"
                hand = state["players"][player_id]["hand"]
                hand_map = _map_hand_by_id(hand)
                if card_id not in hand_map:
                    return events, "card not in hand"
                allowed = _eligible_return_cards(hand)
                if card_id not in {card["id"] for card in allowed}:
                    return events, "must return <=10 if possible"
                card = hand_map[card_id]
                state["players"][player_id]["hand"] = _remove_cards(hand, [card_id])
                tribute["return_cards"][player_id] = card
                payer = tribute.get("assignments", {}).get(player_id)
                if payer:
                    state["players"][payer]["hand"].append(card)
                if len(tribute["return_cards"]) == len(tribute.get("receivers", [])):
                    leader = _tribute_leader(tribute, state["level_rank"])
                    tribute_memory = _snapshot_tribute_memory(tribute, state["level_rank"])
                    tribute_memory["status"] = "completed"
                    tribute_memory["leader_id"] = leader
                    _set_round_tribute_memory(state, tribute_memory)
                    state["tribute"] = None
                    state["phase"] = "playing"
                    if leader:
                        state["current_turn"] = leader
                else:
                    _set_round_tribute_memory(state, _snapshot_tribute_memory(tribute, state["level_rank"]))
                return events, None
            return events, "invalid action"

        if state["phase"] != "playing":
            return events, "invalid phase"

        if player_id not in state["players"]:
            return events, "unknown player"
        if state["players"][player_id]["finished"]:
            return events, "player finished"
        if player_id != state["current_turn"]:
            return events, "not your turn"

        if action_type == "pass":
            if not state.get("current_trick"):
                return events, "cannot pass"
            trick_entry = _ensure_open_trick_memory(state, state["current_trick"].get("player_id"))
            trick_entry["actions"].append({"player_id": player_id, "type": "pass"})
            state["pass_count"] += 1
            state.setdefault("trick_plays", {})[player_id] = "pass"
            _record_pass_limit(state, player_id, state["current_trick"]["combo"])
            active_count = len(_active_players(state))
            needed = max(1, active_count - 1)
            if state["pass_count"] >= needed:
                winner = state["current_trick"]["player_id"]
                _close_open_trick_memory(state, winner)
                state["current_trick"] = None
                state["pass_count"] = 0
                state["trick_plays"] = {}
                if len(state["finish_order"]) >= 3:
                    _advance_to_round_end(state)
                    return events, None
                if state["players"][winner]["finished"]:
                    teammate = _teammate_of(state, winner)
                    if teammate and not state["players"][teammate]["finished"]:
                        state["current_turn"] = teammate
                    else:
                        _advance_to_round_end(state)
                        return events, None
                else:
                    state["current_turn"] = winner
            else:
                state["current_turn"] = _next_active_player(state, player_id)
            return events, None

        if action_type != "play":
            return events, "invalid action"

        card_ids = action.get("card_ids")
        if not isinstance(card_ids, list) or not card_ids:
            return events, "card_ids required"
        if len(set(card_ids)) != len(card_ids):
            return events, "duplicate cards"
        hand = state["players"][player_id]["hand"]
        hand_map = _map_hand_by_id(hand)
        if any(cid not in hand_map for cid in card_ids):
            return events, "card not in hand"
        cards = [hand_map[cid] for cid in card_ids]
        combo = _evaluate_combo(cards, state["level_rank"], state["config"])
        if not combo:
            return events, "invalid combo"
        current_trick = state.get("current_trick")
        if current_trick:
            if not _compare_combos(current_trick["combo"], combo, state["level_rank"], state["config"]):
                return events, "combo not strong enough"
        state["players"][player_id]["hand"] = _remove_cards(hand, card_ids)
        _record_seen_cards(state, card_ids)
        trick_entry = _ensure_open_trick_memory(state, player_id if not current_trick else current_trick.get("player_id"))
        trick_entry["actions"].append(
            {
                "player_id": player_id,
                "type": "play",
                "cards": [_memory_card(card, state["level_rank"]) for card in cards],
                "combo_type": combo.get("type"),
                "combo_size": combo.get("size"),
                "hand_count_after": len(state["players"][player_id]["hand"]),
            }
        )
        state["current_trick"] = {
            "combo": combo,
            "cards": card_ids,
            "player_id": player_id,
        }
        state["trick_plays"][player_id] = cards
        state["pass_count"] = 0
        if not state["players"][player_id]["hand"]:
            _finish_player(state, player_id)
            trick_entry["actions"][-1]["finished_rank"] = state["players"][player_id].get("finish_rank")
        if len(state["finish_order"]) >= 3:
            _close_open_trick_memory(state, player_id, status="round_end")
            _advance_to_round_end(state)
            return events, None
        next_player = _next_active_player(state, player_id)
        state["current_turn"] = next_player
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        order = state["turn_order"]
        level_rank = state["level_rank"]
        for pid in order:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            hand = pdata["hand"]
            visible_hand = []
            if pid == viewer_id:
                sorted_hand = sorted(hand, key=lambda c: _single_order_value(c, level_rank), reverse=True)
                for card in sorted_hand:
                    visible_hand.append(
                        {
                            "id": card["id"],
                            "label": _card_label(card),
                            "is_wild": _is_wild(card, level_rank),
                            "is_joker": _is_joker(card),
                            "rank": card.get("rank"),
                            "suit": card.get("suit"),
                            "joker": card.get("joker"),
                        }
                    )
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot", False),
                    "team": _team_of(state, pid),
                    "hand_count": len(hand),
                    "finished": pdata["finished"],
                    "finish_rank": pdata.get("finish_rank"),
                    "hand": visible_hand,
                }
            )

        trick_view = None
        if state.get("current_trick"):
            combo = state["current_trick"]["combo"]
            trick_view = {
                "player_id": state["current_trick"]["player_id"],
                "type": combo["type"],
                "size": combo["size"],
                "rank_value": combo.get("rank_value"),
                "high_value": combo.get("high_value"),
                "cards": state["current_trick"]["cards"],
            }

        trick_plays_view = []
        for pid in order:
            cards = state.get("trick_plays", {}).get(pid)
            if not cards:
                continue
            meta = state["player_meta"].get(pid, {})
            if cards == "pass":
                labels = ["Pass"]
            else:
                labels = [_card_label(card) for card in cards]
            trick_plays_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "cards": labels,
                }
            )

        tribute_view = None
        tribute = state.get("tribute")
        if tribute:
            name_map = {pid: meta.get("name") or pid for pid, meta in state["player_meta"].items()}

            def name_of(pid: str) -> str:
                return name_map.get(pid, pid)

            def map_cards(card_map: Dict[str, Dict]) -> Dict[str, str]:
                return {name_of(pid): _card_label(card) for pid, card in card_map.items()}

            tribute_view = {
                "type": tribute.get("type"),
                "stage": tribute.get("stage"),
                "payers": [name_of(pid) for pid in tribute.get("payers", [])],
                "receivers": [name_of(pid) for pid in tribute.get("receivers", [])],
                "tribute_cards": map_cards(tribute.get("tribute_cards", {})),
                "return_cards": map_cards(tribute.get("return_cards", {})),
            }

        hint_options = _list_hint_options(state, viewer_id)
        hint_cards = _suggest_hint_cards(state, viewer_id) or []
        sf_candidates = []
        if viewer_id in state["players"]:
            hand = state["players"][viewer_id]["hand"]
            for high_value, cards in _find_straight_flush_candidates(hand, level_rank):
                key = "-".join(str(cid) for cid in sorted(cards))
                sf_candidates.append({"key": key, "high_value": high_value, "cards": [c for c in cards]})

        return {
            "game_id": GuandanGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round_number": state.get("round_number"),
            "dealer_team": state.get("dealer_team"),
            "level_rank": state.get("level_rank"),
            "team_levels": {k: v["level"] for k, v in state["teams"].items()},
            "current_turn": state.get("current_turn"),
            "current_trick": trick_view,
            "trick_plays": trick_plays_view,
            "hint_cards": hint_cards or [],
            "hint_options": hint_options,
            "sf_candidates": sf_candidates,
            "finish_order": state.get("finish_order"),
            "players": players_view,
            "legal_actions": GuandanGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "tribute": tribute_view,
            "bot_explain": state.get("bot_explain", {}),
            "bot_explain_history": state.get("bot_explain_history", {}),
            "round_history": _public_round_history(state),
            "game_over": state.get("game_over"),
            "winner_team": state.get("winner_team"),
        }

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

    @staticmethod
    def download_memories(state: Dict, room_id: Optional[str] = None) -> str:
        return build_memories_html(state, room_id)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        legal = GuandanGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "play_again" in legal:
            return {"type": "play_again", "delay_ms": 800}
        if "next_round" in legal:
            return {"type": "next_round", "delay_ms": 500}
        if "tribute_select" in legal:
            hand = state["players"][bot_id]["hand"]
            candidates = _max_tribute_cards(hand, state["level_rank"])
            card = min(candidates, key=lambda c: _single_order_value(c, state["level_rank"]))
            return {"type": "tribute_select", "card_id": card["id"]}
        if "return_select" in legal:
            hand = state["players"][bot_id]["hand"]
            candidates = _eligible_return_cards(hand)
            card = min(candidates, key=lambda c: _single_order_value(c, state["level_rank"]))
            return {"type": "return_select", "card_id": card["id"]}

        if "play" not in legal and "pass" in legal:
            return {"type": "pass"}

        config = state.get("config", {})
        bot_mode = str(config.get("bot_mode", DEFAULT_CONFIG["bot_mode"]) or DEFAULT_CONFIG["bot_mode"]).strip().lower()
        if bot_mode not in {"auto", "heuristic", "nn"}:
            bot_mode = DEFAULT_CONFIG["bot_mode"]
        total_left = sum(len(state["players"][pid]["hand"]) for pid in state["turn_order"])
        endgame_threshold = config.get("bot_endgame_threshold", 18)
        depth = config.get("bot_search_depth", 2)
        search_width = config.get("bot_minimax_width", 6)
        mcts_width = max(2, int(config.get("bot_mcts_root_width", min(search_width, 5))))
        heuristic_action = _heuristic_best_action(state, bot_id, depth)

        def _action_key(action: Optional[Dict]) -> Tuple:
            if not action:
                return ("none",)
            action_type = action.get("type")
            if action_type == "play":
                return ("play", tuple(sorted(action.get("card_ids") or [])))
            if action_type in ("tribute_select", "return_select"):
                return (action_type, action.get("card_id"))
            return (action_type,)

        def _validate_action(action: Optional[Dict]) -> Optional[str]:
            if not action:
                return "missing action"
            trial = copy.deepcopy(state)
            _, err = GuandanGame.apply_action(trial, bot_id, dict(action))
            return err

        def _legalize_action(action: Optional[Dict]) -> Tuple[Optional[Dict], Optional[str]]:
            err = _validate_action(action)
            if err is None:
                return dict(action), None
            seen = {_action_key(action)}
            fallback_candidates: List[Dict] = []
            if heuristic_action:
                fallback_candidates.append(dict(heuristic_action))
            fallback_candidates.extend(
                dict(candidate)
                for candidate in _candidate_actions(
                    state,
                    bot_id,
                    max(16, search_width * 4, mcts_width * 4),
                )
            )
            for candidate in fallback_candidates:
                key = _action_key(candidate)
                if key in seen:
                    continue
                seen.add(key)
                if _validate_action(candidate) is None:
                    return candidate, err
            if state.get("current_trick") and "pass" in legal:
                pass_action = {"type": "pass"}
                if _validate_action(pass_action) is None:
                    return pass_action, err
            return None, err

        think_budget_ms = max(40, int(config.get("bot_think_time_ms", 320)))
        default_mcts_budget_ms = min(think_budget_ms, 220)
        default_minimax_budget_ms = min(think_budget_ms, 180)
        chosen = None
        chosen_action_type = None
        decided = False
        method = "heuristic"
        method_scores = None
        method_meta = None
        if bot_mode == "nn":
            nn_action, nn_scores, nn_meta = _nn_pick_action(state, bot_id)
            if nn_action is not None:
                decided = True
                method = "nn"
                method_scores = nn_scores
                method_meta = nn_meta
                if nn_action.get("type") == "play":
                    chosen = nn_action.get("card_ids") or []
                    chosen_action_type = "play"
                else:
                    chosen = []
                    chosen_action_type = "pass"
        elif bot_mode == "auto":
            if total_left <= endgame_threshold:
                minimax_budget_ms = max(25, int(config.get("bot_minimax_time_ms", default_minimax_budget_ms)))
                deadline = time.perf_counter() + minimax_budget_ms / 1000.0
                det = _determinize_state(state, bot_id, random.Random())
                chosen = _minimax_pick_action(
                    det,
                    bot_id,
                    config.get("bot_minimax_depth", 4),
                    search_width,
                    deadline=deadline,
                )
                if chosen:
                    decided = True
                    chosen_action_type = "play"
                    method = "minimax"
            if not decided and total_left > endgame_threshold and _should_use_mcts(state, bot_id, mcts_width):
                mcts_budget_ms = max(25, int(config.get("bot_mcts_time_ms", default_mcts_budget_ms)))
                deadline = time.perf_counter() + mcts_budget_ms / 1000.0
                mcts_action, mcts_scores = _mcts_pick_action(
                    state,
                    bot_id,
                    config.get("bot_mcts_sims", 60),
                    config.get("bot_mcts_depth", 8),
                    mcts_width,
                    config.get("bot_mcts_tree_ply", 2),
                    config.get("bot_mcts_reply_width", 4),
                    config.get("bot_mcts_risk_lambda", 0.28),
                    deadline=deadline,
                )
                has_real_search = any(count > 0 for _, _, count, _ in (mcts_scores or []))
                has_fast_path = any((stats or {}).get("fast_path") for _, _, _, stats in (mcts_scores or []))
                if not has_real_search and not has_fast_path:
                    mcts_action = None
                    mcts_scores = None
                if mcts_action is not None and _should_accept_mcts_override(
                    state,
                    bot_id,
                    heuristic_action,
                    mcts_action,
                    depth,
                ):
                    decided = True
                    method = "mcts"
                    method_scores = mcts_scores
                    sims_per_action = mcts_scores[0][2] if mcts_scores else 0
                    first_stats = mcts_scores[0][3] if mcts_scores else {}
                    method_meta = {
                        "sims_per_action": sims_per_action,
                        "depth": first_stats.get("depth", config.get("bot_mcts_depth", 8)),
                        "candidates": len(mcts_scores),
                        "tree_ply": first_stats.get("tree_ply", config.get("bot_mcts_tree_ply", 2)),
                        "reply_width": first_stats.get("reply_width", config.get("bot_mcts_reply_width", 4)),
                        "risk_lambda": config.get("bot_mcts_risk_lambda", 0.28),
                    }
                    if mcts_action.get("type") == "play":
                        chosen = mcts_action.get("card_ids") or []
                        chosen_action_type = "play"
                    else:
                        chosen = []
                        chosen_action_type = "pass"
        if not decided:
            if heuristic_action and heuristic_action.get("type") == "play":
                chosen = heuristic_action.get("card_ids") or []
                decided = True
                chosen_action_type = "play"
                method = "heuristic"
            elif heuristic_action and heuristic_action.get("type") == "pass":
                chosen = []
                decided = True
                chosen_action_type = "pass"
                method = "heuristic"
        if decided:
            selected_action = {"type": "pass"} if chosen_action_type == "pass" else {"type": "play", "card_ids": chosen or []}
            legal_action, illegal_err = _legalize_action(selected_action)
            if legal_action is None:
                if "pass" in legal:
                    return {"type": "pass"}
                return None
            if illegal_err is not None:
                method = "heuristic"
                method_scores = None
                method_meta = None
            chosen_action_type = legal_action.get("type", chosen_action_type or "play")
            chosen = list(legal_action.get("card_ids") or [])
            explain = _build_bot_explain(
                state,
                bot_id,
                chosen or [],
                method,
                depth,
                method_scores if method in ("mcts", "nn") else None,
                method_meta if method in ("mcts", "nn") else None,
                chosen_action_type or "play",
            )
            state.setdefault("bot_explain", {})[bot_id] = explain
            _append_bot_explain_history(
                state,
                bot_id,
                explain,
                chosen_action_type or "play",
                chosen,
            )
            if chosen_action_type == "pass":
                return {"type": "pass"}
            return {"type": "play", "card_ids": chosen}
        if "pass" in legal:
            return {"type": "pass"}
        return None


def _memory_card_html(card: Dict) -> str:
    label = esc(card.get("label"), "-")
    classes = ["gd-mem-card"]
    suit = card.get("suit")
    if suit in ("hearts", "diamonds"):
        classes.append("is-red")
    if card.get("joker"):
        classes.append("is-joker")
    if card.get("is_wild"):
        classes.append("is-wild")
    return f'<span class="{" ".join(classes)}">{label}</span>'


def _render_memory_cards_inline(cards: List[Dict]) -> str:
    if not cards:
        return '<span class="muted">-</span>'
    return '<div class="gd-mem-inline-cards">' + "".join(_memory_card_html(card) for card in cards) + "</div>"


def _render_memory_cascade(cards: List[Dict], level_rank: int) -> str:
    if not cards:
        return '<div class="muted">No cards</div>'
    ordered = sorted(cards, key=lambda card: _card_sort_key(card, level_rank))
    groups: List[List[Dict]] = []
    for card in ordered:
        key = (card.get("joker"), card.get("rank"))
        if not groups:
            groups.append([card])
            continue
        prev = groups[-1][0]
        prev_key = (prev.get("joker"), prev.get("rank"))
        if key == prev_key:
            groups[-1].append(card)
        else:
            groups.append([card])
    columns = []
    for group in groups:
        columns.append(
            '<div class="gd-mem-cascade-col">'
            + "".join(_memory_card_html(card) for card in group)
            + "</div>"
        )
    return '<div class="gd-mem-cascade">' + "".join(columns) + "</div>"


def _player_name_for_memory(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name") or player_id


def _player_caption_for_memory(state: Dict, player_id: str) -> str:
    meta = state.get("player_meta", {}).get(player_id, {})
    team = state.get("player_teams", {}).get(player_id, "-")
    seat = meta.get("seat")
    parts = [_player_name_for_memory(state, player_id), f"Team {team}"]
    if seat is not None:
        parts.append(f"Seat {seat}")
    if meta.get("is_bot"):
        parts.append("Bot")
    return " · ".join(parts)


def _fallback_round_memory(state: Dict) -> Dict:
    trick_actions = []
    for pid in state.get("turn_order", []):
        cards = state.get("trick_plays", {}).get(pid)
        if not cards:
            continue
        if cards == "pass":
            trick_actions.append({"player_id": pid, "type": "pass"})
        else:
            combo = _evaluate_combo(cards, state.get("level_rank", 2), state.get("config", {})) or {}
            trick_actions.append(
                {
                    "player_id": pid,
                    "type": "play",
                    "cards": [_memory_card(card, state.get("level_rank", 2)) for card in cards],
                    "combo_type": combo.get("type"),
                    "combo_size": combo.get("size"),
                }
            )
    tricks = []
    if trick_actions:
        tricks.append(
            {
                "index": 1,
                "leader_id": (state.get("current_trick") or {}).get("player_id"),
                "winner_id": (state.get("current_trick") or {}).get("player_id"),
                "status": "in_progress",
                "actions": trick_actions,
            }
        )
    return {
        "round_number": state.get("round_number", 1),
        "dealer_team": state.get("dealer_team"),
        "level_rank": state.get("level_rank"),
        "team_levels_start": {team: data.get("level") for team, data in state.get("teams", {}).items()},
        "start_player": state.get("current_turn"),
        "visible_card": _memory_visible_card(state),
        "initial_hands": _memory_hand_map(state),
        "tribute": None,
        "tricks": tricks,
        "finish_order": list(state.get("finish_order", [])),
        "status": "in_progress",
        "note": "This room started before Guandan memories tracking was available. Earlier actions may be missing.",
    }


def _public_round_history(state: Dict) -> List[Dict]:
    entries = state.get("round_memories") or [_fallback_round_memory(state)]
    history: List[Dict] = []
    for entry in entries:
        tricks: List[Dict] = []
        for trick in entry.get("tricks", []) or []:
            actions: List[Dict] = []
            for action in trick.get("actions", []) or []:
                action_view = {
                    "player_id": action.get("player_id"),
                    "type": action.get("type"),
                }
                if action.get("type") == "play":
                    action_view["cards"] = [card.get("label") for card in action.get("cards", []) or []]
                    action_view["combo_type"] = action.get("combo_type")
                    action_view["combo_size"] = action.get("combo_size")
                if action.get("hand_count_after") is not None:
                    action_view["hand_count_after"] = action.get("hand_count_after")
                if action.get("finished_rank") is not None:
                    action_view["finished_rank"] = action.get("finished_rank")
                actions.append(action_view)
            tricks.append(
                {
                    "index": trick.get("index"),
                    "leader_id": trick.get("leader_id"),
                    "winner_id": trick.get("winner_id"),
                    "status": trick.get("status"),
                    "actions": actions,
                }
            )
        history.append(
            {
                "round_number": entry.get("round_number"),
                "dealer_team": entry.get("dealer_team"),
                "level_rank": entry.get("level_rank"),
                "status": entry.get("status"),
                "tricks": tricks,
            }
        )
    return history


def _render_tribute_memory(state: Dict, tribute: Optional[Dict]) -> str:
    if not tribute:
        return '<div class="muted">No tribute data</div>'
    tribute_type = tribute.get("type")
    status = tribute.get("status") or tribute.get("stage") or "-"
    if tribute_type == "none":
        return '<div class="muted">No tribute this round.</div>'
    if status == "waived":
        return (
            '<div class="muted">'
            f'Tribute waived. Reason: {esc(tribute.get("reason"), "-")}.'
            "</div>"
        )
    assignments = tribute.get("assignments", {}) or {}
    tribute_cards = tribute.get("tribute_cards", {}) or {}
    return_cards = tribute.get("return_cards", {}) or {}
    receivers = tribute.get("receivers", []) or []
    payers = tribute.get("payers", []) or []
    rows: List[List[str]] = []
    if receivers:
        for receiver_id in receivers:
            payer_id = assignments.get(receiver_id)
            rows.append(
                [
                    esc(_player_name_for_memory(state, receiver_id), "-"),
                    esc(_player_name_for_memory(state, payer_id), "-"),
                    _render_memory_cards_inline([tribute_cards[payer_id]]) if payer_id in tribute_cards else "-",
                    _render_memory_cards_inline([return_cards[receiver_id]]) if receiver_id in return_cards else "-",
                ]
            )
    else:
        for payer_id in payers:
            rows.append(
                [
                    esc(_player_name_for_memory(state, payer_id), "-"),
                    "-",
                    _render_memory_cards_inline([tribute_cards[payer_id]]) if payer_id in tribute_cards else "-",
                    "-",
                ]
            )
    meta_lines = [
        f'<div class="small">Type: {esc(tribute_type, "-")} · Status: {esc(status, "-")}</div>'
    ]
    leader_id = tribute.get("leader_id")
    if leader_id:
        meta_lines.append(f'<div class="small">First Lead After Tribute: {esc(_player_name_for_memory(state, leader_id), "-")}</div>')
    return "".join(meta_lines) + render_table(
        ["Receiver", "Payer", "Tribute", "Return"],
        rows,
        empty_message="No tribute actions",
    )


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    game_id = GuandanGame.game_id
    status_label = "Game Over" if state.get("game_over") else "In Progress"
    header = [
        "<h1>Download Memories</h1>",
        f'<div class="meta">Game: {esc(game_id, "-")} · Room: {esc(room_id, "-")}</div>',
        f'<div class="meta">Status: {esc(status_label, status_label)}</div>',
    ]
    start_time = format_timestamp(state.get("game_start_time"))
    if start_time != "-":
        header.append(f'<div class="meta">Game Start: {esc(start_time, start_time)}</div>')
    header.append(f'<div class="meta">Generated: {esc(format_timestamp(time.time()), "-")}</div>')

    order = state.get("turn_order", [])
    player_rows: List[List[str]] = []
    for pid in order:
        meta = state.get("player_meta", {}).get(pid, {})
        player_rows.append(
            [
                esc(meta.get("name"), "-"),
                esc(meta.get("seat"), "-"),
                esc(state.get("player_teams", {}).get(pid), "-"),
                esc(format_bool(meta.get("is_bot"))),
            ]
        )
    players_section = section(
        "Players",
        render_table(["Name", "Seat", "Team", "Bot"], player_rows, empty_message="No players"),
    )

    summary_rows = [
        ("Current Round", esc(state.get("round_number"), "-")),
        ("Dealer Team", esc(state.get("dealer_team"), "-")),
        ("Level", esc(state.get("level_rank"), "-")),
        ("Winner Team", esc(state.get("winner_team"), "-")),
    ]
    overview_section = section("Overview", render_kv_table(summary_rows))

    round_entries = state.get("round_memories") or [_fallback_round_memory(state)]
    round_blocks: List[str] = []
    for entry in round_entries:
        if not isinstance(entry, dict):
            continue
        round_number = entry.get("round_number", "-")
        visible_card = entry.get("visible_card")
        info_rows = [
            ("Dealer Team", esc(entry.get("dealer_team"), "-")),
            ("Level", esc(entry.get("level_rank"), "-")),
            ("Start Player", esc(_player_name_for_memory(state, entry.get("start_player")), "-")),
            ("Status", esc(entry.get("status"), "-")),
        ]
        if visible_card:
            info_rows.append(("Visible Card", _render_memory_cards_inline([visible_card])))
        if entry.get("team_levels_start"):
            levels_start = entry.get("team_levels_start", {})
            info_rows.append(
                ("Team Levels (Start)", esc(f'A {levels_start.get("A", "-")} · B {levels_start.get("B", "-")}', "-"))
            )
        if entry.get("team_levels_after"):
            levels_after = entry.get("team_levels_after", {})
            info_rows.append(
                ("Team Levels (After)", esc(f'A {levels_after.get("A", "-")} · B {levels_after.get("B", "-")}', "-"))
            )
        if entry.get("finish_order"):
            finish_names = " → ".join(_player_name_for_memory(state, pid) for pid in entry.get("finish_order", []))
            info_rows.append(("Finish Order", esc(finish_names, "-")))

        hands_html: List[str] = []
        for pid in order:
            hand_cards = entry.get("initial_hands", {}).get(pid, [])
            hands_html.append(
                '<div class="card">'
                f'<h3>{esc(_player_caption_for_memory(state, pid), "-")}</h3>'
                + _render_memory_cascade(hand_cards, entry.get("level_rank") or state.get("level_rank", 2))
                + "</div>"
            )

        trick_blocks: List[str] = []
        for trick in entry.get("tricks", []) or []:
            action_rows: List[List[str]] = []
            for idx, action in enumerate(trick.get("actions", []) or [], start=1):
                player_name = _player_name_for_memory(state, action.get("player_id"))
                if action.get("type") == "pass":
                    play_html = '<span class="gd-mem-pass">Pass</span>'
                    combo_label = "-"
                else:
                    play_html = _render_memory_cards_inline(action.get("cards", []))
                    combo_label = esc(action.get("combo_type"), "-")
                note_parts = []
                if action.get("finished_rank"):
                    note_parts.append(f'Finished #{action.get("finished_rank")}')
                if action.get("hand_count_after") is not None:
                    note_parts.append(f'Hand Left: {action.get("hand_count_after")}')
                action_rows.append(
                    [
                        esc(idx, "-"),
                        esc(player_name, "-"),
                        play_html,
                        combo_label,
                        esc(" · ".join(note_parts) if note_parts else "-", "-"),
                    ]
                )
            trick_meta = (
                f'<div class="small">Leader: {esc(_player_name_for_memory(state, trick.get("leader_id")), "-")} · '
                f'Winner: {esc(_player_name_for_memory(state, trick.get("winner_id")), "-")} · '
                f'Status: {esc(trick.get("status"), "-")}</div>'
            )
            trick_blocks.append(
                '<div class="card">'
                f'<h3>Trick {esc(trick.get("index"), "-")}</h3>'
                + trick_meta
                + render_table(["Turn", "Player", "Play", "Combo", "Notes"], action_rows, empty_message="No plays")
                + "</div>"
            )

        note_html = ""
        if entry.get("note"):
            note_html = f'<div class="small">{esc(entry.get("note"), "-")}</div>'
        round_blocks.append(
            section(
                f"Round {round_number}",
                note_html
                + render_kv_table(info_rows)
                + section("Opening Hands", '<div class="gd-mem-hand-grid">' + "".join(hands_html) + "</div>")
                + section("Tribute", _render_tribute_memory(state, entry.get("tribute")))
                + section("Tricks", "".join(trick_blocks) if trick_blocks else '<div class="muted">No plays yet</div>'),
            )
        )

    extra_style = """
.gd-mem-hand-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.gd-mem-cascade {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}
.gd-mem-cascade-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gd-mem-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.gd-mem-card.is-red {
  color: #b91c1c;
}
.gd-mem-card.is-joker {
  background: #fef3c7;
}
.gd-mem-card.is-wild {
  outline: 2px solid #fb7185;
}
.gd-mem-inline-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.gd-mem-pass {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #374151;
  font-weight: 600;
}
"""

    body = "\n".join(header) + players_section + overview_section + "".join(round_blocks)
    return build_html_document(f"{game_id} Memories", body, extra_style=extra_style)


download_memories = build_memories_html
