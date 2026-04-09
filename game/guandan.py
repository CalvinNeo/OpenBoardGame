import copy
import math
import random
from typing import Dict, List, Optional, Tuple

SUITS = ["spades", "hearts", "clubs", "diamonds"]
SUIT_LABELS = {"spades": "S", "hearts": "H", "clubs": "C", "diamonds": "D"}
SUIT_EMOJI = {"spades": "♠️", "hearts": "♥️", "clubs": "♣️", "diamonds": "♦️"}
RANKS = list(range(2, 15))
RANK_LABELS = {11: "J", 12: "Q", 13: "K", 14: "A"}
BOMB_TYPES = ("bomb", "straight_flush", "heavenly")

DEFAULT_CONFIG = {
    "hard_bomb_beats_soft": False,
    "require_partner_not_last_for_a": False,
    "bot_search_depth": 4,
    "bot_mcts_sims": 220,
    "bot_mcts_depth": 12,
    "bot_endgame_threshold": 24,
    "bot_minimax_depth": 6,
    "bot_minimax_width": 10,
}

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


def _find_lowest_pair(info: Dict, exclude_rank: Optional[int], level_rank: int) -> Optional[List[int]]:
    strength = _rank_strength(level_rank)
    ranks_sorted = _ranks_sorted_by_strength(level_rank, ascending=True)
    for rank in ranks_sorted:
        if exclude_rank is not None and rank == exclude_rank:
            continue
        normals = list(info["normals_by_rank"].get(rank, []))
        wilds = list(info["wild_cards"])
        if len(normals) >= 2:
            return normals[:2]
        if len(normals) == 1 and len(wilds) >= 1:
            return [normals[0], wilds[0]]
        if len(normals) == 0 and len(wilds) >= 2:
            return wilds[:2]
    if len(info.get("jokers_big", [])) >= 2:
        return info["jokers_big"][:2]
    if len(info.get("jokers_small", [])) >= 2:
        return info["jokers_small"][:2]
    return None


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
    if _can_play_all(hand, level_rank, config, None):
        return [card["id"] for card in hand]
    options: List[List[int]] = []
    options.extend(_list_single_options(hand, level_rank, 0))
    options.extend(_list_rank_group_options(hand, level_rank, 0, 2))
    options.extend(_list_rank_group_options(hand, level_rank, 0, 3))
    options.extend(_list_full_house_options(hand, level_rank, 0))
    options.extend(_list_straight_options(hand, level_rank, 0))
    options.extend(_list_three_pairs_options(hand, level_rank, 0))
    options.extend(_list_steel_plate_options(hand, level_rank, 0))
    options.extend(_list_bomb_options(hand, level_rank, None, config))
    ranked = _rank_lead_options(state, bot_id, _dedupe_card_sets(options))
    return ranked[0] if ranked else []


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
        pair_cards = _find_lowest_pair(info, exclude_rank=triple_rank, level_rank=level_rank)
        if pair_cards:
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
    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, state["level_rank"], state.get("config", {}))
    if not combo:
        return -999.0
    if len(cards) == len(hand):
        return 1000.0

    base_by_type = {
        "straight": 64.0,
        "three_pairs": 62.0,
        "steel_plate": 61.0,
        "full_house": 58.0,
        "three": 46.0,
        "pair": 38.0,
        "single": 20.0,
        "bomb": 6.0,
        "straight_flush": 4.0,
        "heavenly": 2.0,
    }
    base = base_by_type.get(combo["type"], 10.0)
    structure_delta = _play_structure_delta(hand, cards, state["level_rank"])
    remaining = _remove_cards(hand, cards)
    remaining_strength = _hand_strength_score(remaining, state["level_rank"])

    score = base
    score += len(cards) * 1.2
    score -= structure_delta * 2.6
    score += remaining_strength * 0.18

    if combo["type"] == "single":
        score -= _single_order_value(play_cards[0], state["level_rank"]) * 0.12
    else:
        score -= _combo_value(combo) * 0.03

    if combo["type"] in BOMB_TYPES:
        score -= 14.0 + _bomb_tier(combo) * 2.0

    teammate = _teammate_of(state, player_id)
    partner_left = len(state["players"][teammate]["hand"]) if teammate else 99
    active_opponents = [
        pid
        for pid in state["turn_order"]
        if _team_of(state, pid) != _team_of(state, player_id) and not state["players"][pid]["finished"]
    ]
    opp_left = (
        min(len(state["players"][pid]["hand"]) for pid in active_opponents)
        if active_opponents
        else 0
    )
    if opp_left <= 2 and combo["type"] != "single":
        score += 2.5
    if partner_left <= 3 and combo["type"] in ("pair", "three", "full_house", "straight", "three_pairs", "steel_plate"):
        score += 1.5
    return score


def _rank_lead_options(state: Dict, player_id: str, options: List[List[int]]) -> List[List[int]]:
    if not options:
        return []
    hand = state["players"][player_id]["hand"]
    hand_map = _map_hand_by_id(hand)
    scored: List[Tuple[float, str, List[int]]] = []
    for cards in options:
        combo_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = _evaluate_combo(combo_cards, state["level_rank"], state.get("config", {}))
        if not combo:
            continue
        score = _lead_option_score(state, player_id, cards)
        scored.append((score, combo["type"], cards))
    if not scored:
        return options

    best_by_type: Dict[str, Tuple[float, str, List[int]]] = {}
    for entry in scored:
        score, combo_type, _ = entry
        existing = best_by_type.get(combo_type)
        if existing is None or score > existing[0]:
            best_by_type[combo_type] = entry

    ranked: List[List[int]] = []
    seen = set()
    for _, _, cards in sorted(best_by_type.values(), key=lambda item: item[0], reverse=True):
        key = _cards_key(cards)
        if key in seen:
            continue
        seen.add(key)
        ranked.append(cards)
    for _, _, cards in sorted(scored, key=lambda item: item[0], reverse=True):
        key = _cards_key(cards)
        if key in seen:
            continue
        seen.add(key)
        ranked.append(cards)
    return ranked


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


def _predict_finish_order(state: Dict, adjusted_counts: Dict[str, int]) -> List[str]:
    finished = list(state.get("finish_order", []) or [])
    remaining = [pid for pid in state["turn_order"] if pid not in finished]
    order_index = {pid: idx for idx, pid in enumerate(state["turn_order"])}
    remaining.sort(key=lambda pid: (adjusted_counts.get(pid, len(state["players"][pid]["hand"])), order_index[pid]))
    return finished + remaining


def _team_finish_score(state: Dict, bot_id: str, bot_remaining: int) -> float:
    counts = {pid: len(state["players"][pid]["hand"]) for pid in state["turn_order"]}
    counts[bot_id] = bot_remaining
    predicted = _predict_finish_order(state, counts)
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


def _hand_strength_score(hand: List[Dict], level_rank: int) -> float:
    if not hand:
        return 0.0
    info = _hand_info(hand, level_rank)
    counts = [len(cards) for cards in info["normals_by_rank"].values()]
    pair_ranks = sum(1 for count in counts if count >= 2)
    triple_ranks = sum(1 for count in counts if count >= 3)
    quad_ranks = sum(1 for count in counts if count >= 4)
    singles = sum(1 for count in counts if count == 1)
    wild_count = len(info["wild_cards"])
    joker_big = len(info["jokers_big"])
    joker_small = len(info["jokers_small"])

    score = 0.0
    score += pair_ranks * 0.8
    score += triple_ranks * 1.4
    score += quad_ranks * 1.9
    score -= singles * 0.35
    score += wild_count * 0.5
    score += joker_big * 1.8 + joker_small * 1.2

    if triple_ranks >= 1 and (pair_ranks >= 2 or triple_ranks >= 2):
        score += 1.2
    if pair_ranks >= 3:
        score += 1.0
    if triple_ranks >= 2:
        score += 1.6

    max_run = _longest_run(list(info["normals_by_rank"].keys()))
    if max_run >= 5:
        score += 1.4
    elif max_run == 4 and wild_count >= 1:
        score += 0.9
    elif max_run == 3 and wild_count >= 2:
        score += 0.6

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
    score += min(6.0, turn_savings * 0.55)

    bombs = _find_bomb_candidates(hand, level_rank)
    if bombs:
        bomb_score = 0.0
        for bomb in bombs:
            tier = bomb.get("tier", 0)
            bomb_score += 0.8 + 0.45 * tier
        score += min(4.0, bomb_score)
    return score


def _play_structure_delta(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    remaining = _remove_cards(hand, cards)
    before = _hand_strength_score(hand, level_rank)
    after = _hand_strength_score(remaining, level_rank)
    return before - after


def _rank_count_map(hand: List[Dict], level_rank: int) -> Dict[int, int]:
    counts: Dict[int, int] = {}
    for card in hand:
        if _is_joker(card) or _is_wild(card, level_rank):
            continue
        rank = card.get("rank")
        if rank is None:
            continue
        counts[rank] = counts.get(rank, 0) + 1
    return counts


def _shape_transition_score(hand: List[Dict], cards: List[int], level_rank: int) -> float:
    remaining = _remove_cards(hand, cards)
    before_counts = _rank_count_map(hand, level_rank)
    after_counts = _rank_count_map(remaining, level_rank)
    before_singletons = sum(1 for count in before_counts.values() if count == 1)
    after_singletons = sum(1 for count in after_counts.values() if count == 1)

    score = 0.0
    singleton_delta = after_singletons - before_singletons
    score -= singleton_delta * 1.3

    for rank, before_count in before_counts.items():
        after_count = after_counts.get(rank, 0)
        if before_count >= 2 and 0 < after_count < before_count:
            score -= 2.2 + 0.4 * (before_count - 1)
        elif before_count >= 2 and after_count == 0:
            score += 1.2 + 0.3 * before_count
        elif before_count == 1 and after_count == 0:
            score += 0.9

    return score


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

    structure_delta = _play_structure_delta(hand, cards, state["level_rank"])
    score = max(0.0, 3.2 - structure_delta)
    score += max(-4.0, _shape_transition_score(hand, cards, state["level_rank"]) * 0.7)
    if combo["type"] not in BOMB_TYPES:
        score += 0.8
    else:
        score -= 1.8 + _bomb_tier(combo) * 0.6

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
    if not options:
        return 0.0
    return max(_takeover_opportunity_score(state, player_id, cards) for cards in options)


def _evaluate_state_for_bot(state: Dict, bot_id: str) -> float:
    if state.get("game_over"):
        return 1000.0 if state.get("winner_team") == _team_of(state, bot_id) else -1000.0
    hand = state["players"][bot_id]["hand"]
    remaining = len(hand)
    score = _team_finish_score(state, bot_id, remaining) * 2.0
    score -= remaining * 0.15
    score += _hand_strength_score(hand, state["level_rank"]) * 0.7

    teammate = _teammate_of(state, bot_id)
    current_trick = state.get("current_trick")
    if current_trick:
        leader = current_trick.get("player_id")
        if leader is not None:
            if leader == bot_id:
                score += 2.6
            elif _team_of(state, leader) == _team_of(state, bot_id):
                score += 1.5
            else:
                score -= 2.2
                if state.get("current_turn") == bot_id:
                    score -= min(5.2, _best_takeover_opportunity(state, bot_id) * 1.4)

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
        if not current_trick:
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
            if teammate and leader == teammate and random.random() < 0.6:
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


def _mcts_score_actions(
    state: Dict, bot_id: str, sims: int, depth: int, width: int
) -> List[Tuple[Dict, float, int, Dict[str, float]]]:
    legal = GuandanGame.get_legal_actions(state, bot_id)
    if "play" not in legal:
        return []
    candidates = _candidate_actions(state, bot_id, width)
    candidates = _filter_overbomb_actions(state, bot_id, candidates)
    if not candidates:
        return []
    rng = random.Random()
    sims_per = max(1, sims // max(1, len(candidates)))
    scored: List[Tuple[Dict, float, int, Dict[str, float]]] = []
    for action in candidates:
        total = 0.0
        total_sq = 0.0
        wins = 0
        min_val = None
        max_val = None
        for _ in range(sims_per):
            det = _determinize_state(state, bot_id, rng)
            _, err = GuandanGame.apply_action(det, bot_id, action)
            if err:
                continue
            value = _rollout_value(det, bot_id, depth)
            total += value
            total_sq += value * value
            if value > 0:
                wins += 1
            if min_val is None or value < min_val:
                min_val = value
            if max_val is None or value > max_val:
                max_val = value
        avg = total / sims_per if sims_per else total
        variance = (total_sq / sims_per) - avg * avg if sims_per else 0.0
        std = math.sqrt(max(0.0, variance))
        win_rate = wins / sims_per if sims_per else 0.0
        stats = {
            "avg": avg,
            "std": std,
            "win_rate": win_rate,
            "min": min_val if min_val is not None else avg,
            "max": max_val if max_val is not None else avg,
        }
        scored.append((action, avg, sims_per, stats))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored


def _mcts_pick_action(
    state: Dict, bot_id: str, sims: int, depth: int, width: int
) -> Tuple[Optional[Dict], List[Tuple[Dict, float, int, Dict[str, float]]]]:
    scored = _mcts_score_actions(state, bot_id, sims, depth, width)
    if not scored:
        return None, []
    return scored[0][0], scored


def _minimax_value(state: Dict, bot_id: str, depth: int, alpha: float, beta: float, width: int) -> float:
    if depth <= 0 or state.get("game_over"):
        return _evaluate_state_for_bot(state, bot_id)
    actor = _next_actor(state)
    if actor is None:
        return _evaluate_state_for_bot(state, bot_id)
    actions = _candidate_actions(state, actor, width)
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
    actions = _candidate_actions(state, bot_id, width)
    actions = _filter_overbomb_actions(state, bot_id, actions)
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
    components: Dict[str, float] = {}

    if not cards:
        if current_trick and teammate == current_trick.get("player_id"):
            components["protect_teammate"] = 6.0
        elif current_trick and _team_of(state, current_trick.get("player_id")) != _team_of(state, bot_id):
            opportunity = _best_takeover_opportunity(state, bot_id)
            if opportunity > 0:
                components["pass_opportunity_cost"] = -min(8.0, opportunity * 1.35)
        components["hand_pressure"] = -len(hand) * 0.2
        components["team_finish"] = _team_finish_score(state, bot_id, len(hand)) * 2.0
        components["total"] = sum(components.values())
        return components

    hand_map = _map_hand_by_id(hand)
    play_cards = [hand_map[cid] for cid in cards if cid in hand_map]
    combo = _evaluate_combo(play_cards, level_rank, config)
    if not combo:
        return {"total": -999.0}

    remaining = _remove_cards(hand, cards)
    components["play_cards"] = len(cards) * 0.6
    shape_score = _shape_transition_score(hand, cards, level_rank)
    if abs(shape_score) > 0.001:
        components["shape_value"] = shape_score
    if not remaining:
        components["finish_bonus"] = 100.0
    if combo["type"] in BOMB_TYPES:
        base = 2.0
        if current_trick and current_trick.get("combo", {}).get("type") in BOMB_TYPES:
            base = 5.0
        components["bomb_bonus"] = base + _bomb_tier(combo)
    if combo.get("uses_wild"):
        components["wild_penalty"] = -1.5

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
        components["avoid_overtrick"] = -5.0
    elif current_trick and _team_of(state, current_trick.get("player_id")) != _team_of(state, bot_id):
        seize = _takeover_opportunity_score(state, bot_id, cards)
        if seize > 0:
            components["seize_tempo"] = seize * 1.25

    components["team_finish"] = _team_finish_score(state, bot_id, len(remaining)) * 2.0

    if depth >= 2 and remaining:
        lead_cards = _choose_lead_play(remaining, level_rank, config, state, bot_id)
        if lead_cards and len(lead_cards) == len(remaining):
            components["lead_finish_bonus"] = 12.0
        components["remaining_penalty"] = -len(remaining) * 0.3

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
    if not current_trick:
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
                "mcts_std": stats.get("std", 0.0) if stats else 0.0,
                "mcts_win_rate": stats.get("win_rate", 0.0) if stats else 0.0,
                "mcts_min": stats.get("min", score) if stats else score,
                "mcts_max": stats.get("max", score) if stats else score,
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
            "mcts_std": chosen_stats.get("std", 0.0) if chosen_stats else 0.0,
            "mcts_win_rate": chosen_stats.get("win_rate", 0.0) if chosen_stats else 0.0,
            "mcts_min": chosen_stats.get("min", chosen_score) if chosen_stats else chosen_score,
            "mcts_max": chosen_stats.get("max", chosen_score) if chosen_stats else chosen_score,
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
    if not current_trick:
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
        "hand": hand_labels_for(chosen_action_type),
        "top": top,
    }


def _suggest_hint_cards(state: Dict, player_id: str) -> Optional[List[int]]:
    options = _list_hint_options(state, player_id)
    return options[0] if options else None


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


def _setup_tribute(state: Dict) -> None:
    tribute_type = _compute_tribute_type(state)
    state["tribute"] = None
    if tribute_type == "none":
        state["phase"] = "playing"
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
    _check_game_over(state)


def _start_next_round(state: Dict) -> None:
    state["round_number"] += 1
    previous_finish = state["finish_order"][:]
    head = previous_finish[0] if previous_finish else None
    _deal_round(state, first_round=False, start_player=head)
    state["finish_order"] = previous_finish
    _setup_tribute(state)
    state["finish_order"] = []


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
            "game_over": False,
            "winner_team": None,
        }
        _deal_round(state, first_round=True, start_player=None)
        if state["current_turn"]:
            state["dealer_team"] = _team_of(state, state["current_turn"])
            state["level_rank"] = state["teams"][state["dealer_team"]]["level"]
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
                    state["tribute"] = None
                    state["phase"] = "playing"
                    if leader:
                        state["current_turn"] = leader
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
            state["pass_count"] += 1
            state.setdefault("trick_plays", {})[player_id] = "pass"
            _record_pass_limit(state, player_id, state["current_trick"]["combo"])
            active_count = len(_active_players(state))
            needed = max(1, active_count - 1)
            if state["pass_count"] >= needed:
                winner = state["current_trick"]["player_id"]
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
        state["current_trick"] = {
            "combo": combo,
            "cards": card_ids,
            "player_id": player_id,
        }
        state["trick_plays"][player_id] = cards
        state["pass_count"] = 0
        if not state["players"][player_id]["hand"]:
            _finish_player(state, player_id)
        if len(state["finish_order"]) >= 3:
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
        hint_cards = hint_options[0] if hint_options else []
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
        total_left = sum(len(state["players"][pid]["hand"]) for pid in state["turn_order"])
        endgame_threshold = config.get("bot_endgame_threshold", 18)
        depth = config.get("bot_search_depth", 2)
        chosen = None
        chosen_action_type = None
        decided = False
        method = "heuristic"
        method_scores = None
        method_meta = None
        if total_left <= endgame_threshold:
            det = _determinize_state(state, bot_id, random.Random())
            chosen = _minimax_pick_action(
                det,
                bot_id,
                config.get("bot_minimax_depth", 4),
                config.get("bot_minimax_width", 6),
            )
            if chosen:
                decided = True
                chosen_action_type = "play"
                method = "minimax"
        if not chosen:
            mcts_action, mcts_scores = _mcts_pick_action(
                state,
                bot_id,
                config.get("bot_mcts_sims", 60),
                config.get("bot_mcts_depth", 8),
                config.get("bot_minimax_width", 6),
            )
            if mcts_action is not None:
                decided = True
                method = "mcts"
                method_scores = mcts_scores
                sims_per_action = mcts_scores[0][2] if mcts_scores else 0
                method_meta = {
                    "sims_per_action": sims_per_action,
                    "depth": config.get("bot_mcts_depth", 8),
                    "candidates": len(mcts_scores),
                }
                if mcts_action.get("type") == "play":
                    chosen = mcts_action.get("card_ids") or []
                    chosen_action_type = "play"
                else:
                    chosen = []
                    chosen_action_type = "pass"
        if not decided:
            chosen = _bot_select_play(state, bot_id, depth)
            if chosen:
                decided = True
                chosen_action_type = "play"
                method = "heuristic"
        if decided:
            explain = _build_bot_explain(
                state,
                bot_id,
                chosen or [],
                method,
                depth,
                method_scores if method == "mcts" else None,
                method_meta if method == "mcts" else None,
                chosen_action_type or "play",
            )
            state.setdefault("bot_explain", {})[bot_id] = explain
            if chosen_action_type == "pass":
                return {"type": "pass"}
            return {"type": "play", "card_ids": chosen}
        if "pass" in legal:
            return {"type": "pass"}
        return None
