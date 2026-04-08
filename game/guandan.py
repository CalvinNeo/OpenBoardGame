import random
from typing import Dict, List, Optional, Tuple

SUITS = ["spades", "hearts", "clubs", "diamonds"]
SUIT_LABELS = {"spades": "S", "hearts": "H", "clubs": "C", "diamonds": "D"}
SUIT_EMOJI = {"spades": "♠️", "hearts": "♥️", "clubs": "♣️", "diamonds": "♦️"}
RANKS = list(range(2, 15))
RANK_LABELS = {11: "J", 12: "Q", 13: "K", 14: "A"}

DEFAULT_CONFIG = {
    "hard_bomb_beats_soft": False,
    "require_partner_not_last_for_a": False,
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
    if card.get("rank") == level_rank and card.get("suit") == "hearts":
        return 80
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
    info = _hand_info(hand, level_rank)
    strength = _rank_strength(level_rank)
    partner = _teammate_of(state, bot_id)
    partner_left = len(state["players"][partner]["hand"]) if partner else 99
    opp_left = min(
        len(state["players"][pid]["hand"])
        for pid in state["turn_order"]
        if _team_of(state, pid) != _team_of(state, bot_id) and not state["players"][pid]["finished"]
    )

    candidates: List[Tuple[float, List[int]]] = []

    straight = _find_straight_to_beat(hand, level_rank, threshold=0)
    if straight:
        candidates.append((50.0, straight))
    three_pairs = _find_three_pairs_to_beat(hand, level_rank, threshold=0)
    if three_pairs:
        candidates.append((48.0, three_pairs))
    steel = _find_steel_plate_to_beat(hand, level_rank, threshold=0)
    if steel:
        candidates.append((47.0, steel))

    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        built = _build_of_rank(rank, 3, info)
        if built:
            triple_cards = built[0]
            pair_cards = _find_lowest_pair(built[1], exclude_rank=rank, level_rank=level_rank)
            if pair_cards:
                candidates.append((45.0, triple_cards + pair_cards))
            break

    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        built = _build_of_rank(rank, 3, info)
        if built:
            candidates.append((30.0, built[0]))
            break

    for rank in _ranks_sorted_by_strength(level_rank, ascending=True):
        built = _build_of_rank(rank, 2, info)
        if built:
            candidates.append((25.0, built[0]))
            break

    singles = sorted(hand, key=lambda c: _single_order_value(c, level_rank))
    if singles:
        candidates.append((20.0, [singles[0]["id"]]))

    bombs = _find_bomb_candidates(hand, level_rank)
    for bomb in bombs:
        penalty = 20.0
        if opp_left <= 2:
            penalty = 5.0
        candidates.append((10.0 - penalty + bomb["tier"], bomb["cards"]))
        break

    if not candidates:
        return [singles[0]["id"]] if singles else []

    def score(entry: Tuple[float, List[int]]) -> float:
        base, cards = entry
        wild_penalty = sum(
            1 for card in cards if any(card == wid for wid in info["wild_cards"])
        )
        size_bonus = len(cards) * 2.0
        partner_bonus = 5.0 if partner_left <= 3 else 0.0
        opp_bonus = 3.0 if opp_left <= 2 else 0.0
        return base + size_bonus - wild_penalty * 3 + partner_bonus + opp_bonus

    candidates.sort(key=score, reverse=True)
    return candidates[0][1]


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
    dealer_team = state["dealer_team"]
    winning_team = _team_of(state, order[0])
    if winning_team != dealer_team:
        state["dealer_team"] = winning_team
    else:
        second_team = _team_of(state, order[1])
        third_team = _team_of(state, order[2])
        if second_team == dealer_team:
            delta = 3
        elif third_team == dealer_team:
            delta = 2
        else:
            delta = 1
        state["teams"][dealer_team]["level"] = min(14, state["teams"][dealer_team]["level"] + delta)
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


def _advance_to_round_end(state: Dict) -> None:
    _apply_round_result(state)
    state["last_round_summary"] = _summarize_round(state)
    state["phase"] = "round_end"
    _check_game_over(state)


def _start_next_round(state: Dict) -> None:
    state["round_number"] += 1
    head = state["finish_order"][0] if state["finish_order"] else None
    _deal_round(state, first_round=False, start_player=head)
    _setup_tribute(state)


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
                    state["tribute"] = None
                    state["phase"] = "playing"
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
                        }
                    )
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
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
            trick_plays_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "cards": [_card_label(card) for card in cards],
                }
            )

        tribute_view = None
        tribute = state.get("tribute")
        if tribute:
            tribute_view = {
                "type": tribute.get("type"),
                "stage": tribute.get("stage"),
                "payers": tribute.get("payers", []),
                "receivers": tribute.get("receivers", []),
                "tribute_cards": {pid: _card_label(card) for pid, card in tribute.get("tribute_cards", {}).items()},
                "return_cards": {pid: _card_label(card) for pid, card in tribute.get("return_cards", {}).items()},
            }

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
            "finish_order": state.get("finish_order"),
            "players": players_view,
            "legal_actions": GuandanGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "tribute": tribute_view,
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

        hand = state["players"][bot_id]["hand"]
        current_trick = state.get("current_trick")
        current_combo = current_trick["combo"] if current_trick else None
        config = state.get("config", {})

        teammate = _teammate_of(state, bot_id)
        if current_trick and teammate == current_trick.get("player_id"):
            if _can_play_all(hand, state["level_rank"], config, current_combo):
                return {"type": "play", "card_ids": [card["id"] for card in hand]}
            if "pass" in legal:
                return {"type": "pass"}

        if current_combo:
            combo_type = current_combo["type"]
            threshold = current_combo.get("rank_value", 0)
            high_threshold = current_combo.get("high_value", 0)
            if combo_type == "single":
                cards = _find_single_to_beat(hand, state["level_rank"], threshold)
            elif combo_type == "pair":
                cards = _find_pair_to_beat(hand, state["level_rank"], threshold)
            elif combo_type == "three":
                cards = _find_three_to_beat(hand, state["level_rank"], threshold)
            elif combo_type == "full_house":
                cards = _find_full_house_to_beat(hand, state["level_rank"], threshold)
            elif combo_type == "straight":
                cards = _find_straight_to_beat(hand, state["level_rank"], high_threshold)
            elif combo_type == "three_pairs":
                cards = _find_three_pairs_to_beat(hand, state["level_rank"], high_threshold)
            elif combo_type == "steel_plate":
                cards = _find_steel_plate_to_beat(hand, state["level_rank"], high_threshold)
            else:
                cards = None
            if cards:
                return {"type": "play", "card_ids": cards}
            bomb = _pick_bomb_to_beat(hand, state["level_rank"], current_combo, config)
            if bomb:
                return {"type": "play", "card_ids": bomb}
            if "pass" in legal:
                return {"type": "pass"}
            return None

        lead_cards = _choose_lead_play(hand, state["level_rank"], config, state, bot_id)
        if lead_cards:
            return {"type": "play", "card_ids": lead_cards}
        if hand:
            return {"type": "play", "card_ids": [hand[0]["id"]]}
        return None
