import json
import random
import time
from itertools import combinations
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "mode": "normal",  # novice | normal | expert
    "starting_lives": 3,
    "max_lives": 5,
    "starting_tokens": 2,
    "token_drop_rate": 0.5,
    "round_time_limit_sec": 0,
    "ready_countdown_ms": 3000,
    "odds_samples": 200,
}

SUITS = ["S", "H", "D", "C"]
RANKS = list(range(2, 15))

HAND_TYPE_LABELS = {
    "HIGH_CARD": "High Card",
    "ONE_PAIR": "One Pair",
    "TWO_PAIR": "Two Pair",
    "THREE_KIND": "Three of a Kind",
    "STRAIGHT": "Straight",
    "FLUSH": "Flush",
    "FULL_HOUSE": "Full House",
    "FOUR_KIND": "Four of a Kind",
    "STRAIGHT_FLUSH": "Straight Flush",
}

HAND_TYPE_STRENGTH = {
    "HIGH_CARD": 1,
    "ONE_PAIR": 2,
    "TWO_PAIR": 3,
    "THREE_KIND": 4,
    "STRAIGHT": 5,
    "FLUSH": 6,
    "FULL_HOUSE": 7,
    "FOUR_KIND": 8,
    "STRAIGHT_FLUSH": 9,
}

DEFAULT_MISSIONS = [
    {
        "id": "M001",
        "desc": "赢家必须拥有顺子或更强牌力",
        "type": "winner_min_strength",
        "min_strength": "STRAIGHT",
    },
    {
        "id": "M002",
        "desc": "最后一名必须是高牌 (没有任何对子)",
        "type": "last_hand_type",
        "hand_type": "HIGH_CARD",
    },
    {
        "id": "M003",
        "desc": "第1名和第2名的底牌至少有一张同花色",
        "type": "top_two_share_suit",
    },
]

MISSION_PATH = Path(__file__).with_name("assets").joinpath("gang_missions.json")


def _now_ms() -> int:
    return int(time.time() * 1000)


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    mode = cfg.get("mode", DEFAULT_CONFIG["mode"])
    if mode not in ("novice", "normal", "expert"):
        raise ValueError("mode must be novice, normal, or expert")
    cfg["mode"] = mode

    for int_key in (
        "starting_lives",
        "max_lives",
        "starting_tokens",
        "round_time_limit_sec",
        "ready_countdown_ms",
        "odds_samples",
    ):
        raw = cfg.get(int_key)
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValueError(f"{int_key} must be an integer") from None
        if int_key in ("starting_lives", "max_lives") and value < 1:
            raise ValueError(f"{int_key} must be >= 1")
        if int_key in ("starting_tokens", "round_time_limit_sec", "ready_countdown_ms") and value < 0:
            raise ValueError(f"{int_key} must be >= 0")
        if int_key == "odds_samples" and value < 10:
            raise ValueError("odds_samples must be >= 10")
        cfg[int_key] = value

    raw_rate = cfg.get("token_drop_rate", DEFAULT_CONFIG["token_drop_rate"])
    try:
        token_drop_rate = float(raw_rate)
    except (TypeError, ValueError):
        raise ValueError("token_drop_rate must be a number") from None
    if token_drop_rate < 0 or token_drop_rate > 1:
        raise ValueError("token_drop_rate must be between 0 and 1")
    cfg["token_drop_rate"] = token_drop_rate

    if cfg["starting_lives"] > cfg["max_lives"]:
        cfg["starting_lives"] = cfg["max_lives"]
    return cfg


def _load_missions() -> List[Dict]:
    try:
        with MISSION_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return list(DEFAULT_MISSIONS)
    if not isinstance(data, list):
        return list(DEFAULT_MISSIONS)
    missions = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        if "id" not in entry or "type" not in entry:
            continue
        missions.append(entry)
    return missions or list(DEFAULT_MISSIONS)


MISSIONS = _load_missions()


def _build_mission_deck() -> List[int]:
    indices = list(range(len(MISSIONS)))
    random.shuffle(indices)
    return indices


def _draw_mission(state: Dict) -> Optional[Dict]:
    deck = state.get("mission_deck")
    if not deck:
        deck = _build_mission_deck()
        state["mission_deck"] = deck
    idx = deck.pop()
    try:
        return dict(MISSIONS[idx])
    except IndexError:
        return None


def _build_deck() -> List[Dict]:
    return [{"rank": rank, "suit": suit, "revealed": False} for suit in SUITS for rank in RANKS]


def _is_straight(ranks: List[int]) -> Tuple[bool, int]:
    unique = sorted(set(ranks))
    if len(unique) != 5:
        return False, 0
    if unique == [2, 3, 4, 5, 14]:
        return True, 5
    high = max(unique)
    low = min(unique)
    if high - low == 4:
        return True, high
    return False, 0


def _evaluate_five(cards: List[Dict]) -> Tuple[Tuple[int, ...], str, str]:
    ranks = [card["rank"] for card in cards]
    ranks_sorted = sorted(ranks, reverse=True)
    is_flush = len({card["suit"] for card in cards}) == 1
    is_straight, straight_high = _is_straight(ranks)
    counts: Dict[int, int] = {}
    for rank in ranks:
        counts[rank] = counts.get(rank, 0) + 1
    count_values = sorted(counts.values(), reverse=True)

    if is_flush and is_straight:
        hand_type = "STRAIGHT_FLUSH"
        if straight_high == 14 and 10 in ranks:
            hand_name = "Royal Flush"
        else:
            hand_name = HAND_TYPE_LABELS[hand_type]
        score = (HAND_TYPE_STRENGTH[hand_type], straight_high)
        return score, hand_type, hand_name

    if count_values == [4, 1]:
        quad_rank = max(rank for rank, cnt in counts.items() if cnt == 4)
        kicker = max(rank for rank, cnt in counts.items() if cnt == 1)
        hand_type = "FOUR_KIND"
        score = (HAND_TYPE_STRENGTH[hand_type], quad_rank, kicker)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    if count_values == [3, 2]:
        trip_rank = max(rank for rank, cnt in counts.items() if cnt == 3)
        pair_rank = max(rank for rank, cnt in counts.items() if cnt == 2)
        hand_type = "FULL_HOUSE"
        score = (HAND_TYPE_STRENGTH[hand_type], trip_rank, pair_rank)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    if is_flush:
        hand_type = "FLUSH"
        score = (HAND_TYPE_STRENGTH[hand_type], *ranks_sorted)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    if is_straight:
        hand_type = "STRAIGHT"
        score = (HAND_TYPE_STRENGTH[hand_type], straight_high)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    if count_values == [3, 1, 1]:
        trip_rank = max(rank for rank, cnt in counts.items() if cnt == 3)
        kickers = sorted((rank for rank, cnt in counts.items() if cnt == 1), reverse=True)
        hand_type = "THREE_KIND"
        score = (HAND_TYPE_STRENGTH[hand_type], trip_rank, *kickers)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    if count_values == [2, 2, 1]:
        pairs = sorted((rank for rank, cnt in counts.items() if cnt == 2), reverse=True)
        kicker = max(rank for rank, cnt in counts.items() if cnt == 1)
        hand_type = "TWO_PAIR"
        score = (HAND_TYPE_STRENGTH[hand_type], pairs[0], pairs[1], kicker)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    if count_values == [2, 1, 1, 1]:
        pair_rank = max(rank for rank, cnt in counts.items() if cnt == 2)
        kickers = sorted((rank for rank, cnt in counts.items() if cnt == 1), reverse=True)
        hand_type = "ONE_PAIR"
        score = (HAND_TYPE_STRENGTH[hand_type], pair_rank, *kickers)
        return score, hand_type, HAND_TYPE_LABELS[hand_type]

    hand_type = "HIGH_CARD"
    score = (HAND_TYPE_STRENGTH[hand_type], *ranks_sorted)
    return score, hand_type, HAND_TYPE_LABELS[hand_type]


def _best_hand(cards: List[Dict]) -> Tuple[Tuple[int, ...], Dict]:
    best_score: Optional[Tuple[int, ...]] = None
    best_detail: Optional[Dict] = None
    for combo in combinations(cards, 5):
        score, hand_type, hand_name = _evaluate_five(list(combo))
        if best_score is None or score > best_score:
            best_score = score
            best_detail = {
                "hand_type": hand_type,
                "hand_name": hand_name,
                "score": score,
                "cards": list(combo),
            }
    if best_score is None or best_detail is None:
        return (0,), {"hand_type": "HIGH_CARD", "hand_name": "High Card", "score": (0,), "cards": []}
    return best_score, best_detail


def _estimate_win_odds(hole: List[Dict], community: List[Dict], player_count: int, samples: int) -> Optional[float]:
    if player_count <= 1:
        return 1.0
    if len(hole) < 2:
        return None
    known = {(card["rank"], card["suit"]) for card in hole + community}
    deck = [
        {"rank": rank, "suit": suit}
        for suit in SUITS
        for rank in RANKS
        if (rank, suit) not in known
    ]
    need_community = max(0, 5 - len(community))
    draw_count = need_community + (player_count - 1) * 2
    if draw_count > len(deck):
        return None
    win_score = 0.0
    for _ in range(samples):
        drawn = random.sample(deck, draw_count)
        community_extra = drawn[:need_community]
        opp_cards = drawn[need_community:]
        full_community = community + community_extra
        player_score, _ = _best_hand(hole + full_community)
        best_score = player_score
        tied = 1
        for idx in range(player_count - 1):
            opp_hole = [opp_cards[idx * 2], opp_cards[idx * 2 + 1]]
            opp_score, _ = _best_hand(opp_hole + full_community)
            if opp_score > best_score:
                best_score = opp_score
                tied = 1
            elif opp_score == best_score:
                tied += 1
        if player_score == best_score:
            win_score += 1.0 / tied
    return win_score / samples if samples > 0 else None


def _card_view(card: Dict) -> Dict:
    return {"rank": card["rank"], "suit": card["suit"]}


def _deal_hole_cards(state: Dict) -> None:
    deck = state.get("deck", [])
    for pid in state.get("turn_order", []):
        hand = [deck.pop(), deck.pop()]
        for card in hand:
            card["revealed"] = False
        state["players"][pid]["hole"] = hand


def _deal_community(state: Dict, count: int) -> None:
    deck = state.get("deck", [])
    cards = state.setdefault("community_cards", [])
    for _ in range(count):
        if deck:
            cards.append(deck.pop())


def _reset_ready(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["ready"] = False


def _reset_reveal_ready(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["reveal_ready"] = False


def _reveal_ready_all(state: Dict) -> bool:
    return all(pdata.get("reveal_ready") for pdata in state.get("players", {}).values())


def _reset_next_ready(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        pdata["next_ready"] = False


def _next_ready_all(state: Dict) -> bool:
    return all(pdata.get("next_ready") for pdata in state.get("players", {}).values())


def _set_rank_default(state: Dict) -> None:
    state["ranking"] = list(state.get("turn_order", []))


def _update_hand_cache(state: Dict) -> None:
    if state.get("config", {}).get("mode") == "expert":
        state["hand_cache"] = {}
        return
    community = list(state.get("community_cards", []))
    if len(community) < 3:
        state["hand_cache"] = {}
        return
    cache: Dict[str, Dict] = {}
    for pid, pdata in state.get("players", {}).items():
        hole = pdata.get("hole", [])
        if len(hole) < 2:
            continue
        score, detail = _best_hand(hole + community)
        cache[pid] = {
            "hand_type": detail["hand_type"],
            "hand_name": detail["hand_name"],
            "score": score,
            "best_cards": list(detail.get("cards", [])),
        }
    state["hand_cache"] = cache


def _update_odds_cache(state: Dict) -> None:
    config = state.get("config", {})
    if config.get("mode") != "novice":
        state["odds_cache"] = {}
        return
    community = list(state.get("community_cards", []))
    if len(community) < 3:
        state["odds_cache"] = {}
        return
    samples = int(config.get("odds_samples", DEFAULT_CONFIG["odds_samples"]))
    player_count = len(state.get("players", {}))
    odds: Dict[str, Optional[float]] = {}
    for pid, pdata in state.get("players", {}).items():
        hole = pdata.get("hole", [])
        odds[pid] = _estimate_win_odds(hole, community, player_count, samples)
    state["odds_cache"] = odds


def _start_round(state: Dict) -> None:
    state["deck"] = _build_deck()
    random.shuffle(state["deck"])
    state["discard"] = []
    state["community_cards"] = []
    _reset_ready(state)
    _reset_reveal_ready(state)
    _reset_next_ready(state)
    _set_rank_default(state)
    state["lock_at_ms"] = None
    state["river_deadline_ms"] = None
    state["round_tokens_spent"] = False
    state["round_used_tolerance"] = False
    state["round_summary"] = None
    state["phase"] = "preflop"
    _deal_hole_cards(state)

    if state.get("config", {}).get("mode") == "expert":
        state["current_mission"] = _draw_mission(state)
    else:
        state["current_mission"] = None

    _update_hand_cache(state)
    _update_odds_cache(state)


def _rank_groups(scores: Dict[str, Tuple[int, ...]], player_meta: Dict[str, Dict]) -> Tuple[List[List[str]], List[str]]:
    def _seat_key(pid: str) -> int:
        return int(player_meta.get(pid, {}).get("seat", 0))

    sorted_items = sorted(scores.items(), key=lambda item: (item[1], -_seat_key(item[0])), reverse=True)
    groups: List[List[str]] = []
    order: List[str] = []
    last_score: Optional[Tuple[int, ...]] = None
    for pid, score in sorted_items:
        order.append(pid)
        if last_score is None or score != last_score:
            groups.append([pid])
            last_score = score
        else:
            groups[-1].append(pid)
    return groups, order


def _evaluate_prediction(
    predicted: List[str],
    groups: List[List[str]],
    mode: str,
) -> Tuple[bool, bool]:
    if len(predicted) != sum(len(group) for group in groups):
        return False, False
    if len(set(predicted)) != len(predicted):
        return False, False
    index_map = {pid: idx for idx, pid in enumerate(predicted)}
    current = 0
    tolerance_used = False
    for group in groups:
        target_indices = list(range(current, current + len(group)))
        min_target = min(target_indices)
        max_target = max(target_indices)
        for pid in group:
            if pid not in index_map:
                return False, False
            user_pos = index_map[pid]
            if mode == "novice":
                min_valid = min_target - 1
                max_valid = max_target + 1
                if not (min_valid <= user_pos <= max_valid):
                    return False, False
                if user_pos not in target_indices:
                    tolerance_used = True
            else:
                if user_pos not in target_indices:
                    return False, False
        current += len(group)
    return True, tolerance_used


def _mission_passed(state: Dict, order: List[str], hands: Dict[str, Dict]) -> bool:
    mission = state.get("current_mission")
    if not mission:
        return True
    mission_type = mission.get("type")
    if not order:
        return False
    winner = order[0]
    last = order[-1]

    if mission_type == "winner_min_strength":
        minimum = mission.get("min_strength", "STRAIGHT")
        min_strength = HAND_TYPE_STRENGTH.get(minimum, HAND_TYPE_STRENGTH["STRAIGHT"])
        return hands[winner]["score"][0] >= min_strength

    if mission_type == "last_hand_type":
        expected = mission.get("hand_type", "HIGH_CARD")
        return hands[last]["hand_type"] == expected

    if mission_type == "top_two_share_suit":
        if len(order) < 2:
            return False
        first = order[0]
        second = order[1]
        suits_a = {card["suit"] for card in state["players"][first].get("hole", [])}
        suits_b = {card["suit"] for card in state["players"][second].get("hole", [])}
        return bool(suits_a & suits_b)

    return True


def _lock_round(state: Dict) -> None:
    community = list(state.get("community_cards", []))
    scores: Dict[str, Tuple[int, ...]] = {}
    hands: Dict[str, Dict] = {}
    for pid, pdata in state.get("players", {}).items():
        hole = pdata.get("hole", [])
        score, detail = _best_hand(hole + community)
        scores[pid] = score
        hands[pid] = detail

    groups, order = _rank_groups(scores, state.get("player_meta", {}))
    predicted = list(state.get("ranking", []))
    mode = state.get("config", {}).get("mode", "normal")

    strict_ok, _ = _evaluate_prediction(predicted, groups, "normal")
    if mode == "novice":
        ok, tolerance_used = _evaluate_prediction(predicted, groups, "novice")
        state["round_used_tolerance"] = tolerance_used
    else:
        ok = strict_ok
        state["round_used_tolerance"] = False

    mission_ok = True
    if mode == "expert":
        mission_ok = _mission_passed(state, order, hands)

    success = ok and mission_ok
    perfect = success and strict_ok and not state.get("round_tokens_spent") and not state.get("level_failed_once")

    if success:
        level = int(state.get("level", 1))
        if level % 5 == 0:
            state["lives"] = min(state.get("lives", 0) + 1, state.get("max_lives", 5))
        state["level"] = level + 1
        state["level_failed_once"] = False
        if perfect and random.random() < state.get("config", {}).get("token_drop_rate", 0.5):
            state["tokens"] = state.get("tokens", 0) + 1
    else:
        state["lives"] = state.get("lives", 0) - 1
        state["level_failed_once"] = True

    summary_hands = []
    for pid in order:
        detail = hands[pid]
        summary_hands.append(
            {
                "player_id": pid,
                "hand_type": detail["hand_type"],
                "hand_name": detail["hand_name"],
                "best_cards": [_card_view(card) for card in detail.get("cards", [])],
            }
        )

    state["round_summary"] = {
        "success": success,
        "perfect": perfect,
        "mission_success": mission_ok,
        "predicted_order": predicted,
        "actual_groups": groups,
        "actual_order": order,
        "hands": summary_hands,
    }

    state["phase"] = "showdown"
    state["lock_at_ms"] = None
    state["river_deadline_ms"] = None

    if state.get("lives", 0) <= 0:
        state["game_over"] = True
        state["phase"] = "game_over"


def _can_move_rank(state: Dict, mover_id: str, target_id: str, to_index: int) -> bool:
    ranking = list(state.get("ranking", []))
    if target_id not in ranking:
        return False

    try:
        current_index = ranking.index(target_id)
    except ValueError:
        return False
    ranking.pop(current_index)
    if to_index < 0:
        to_index = 0
    if to_index > len(ranking):
        to_index = len(ranking)
    ranking.insert(to_index, target_id)

    return True


def _apply_rank_move(state: Dict, target_id: str, to_index: int) -> None:
    ranking = list(state.get("ranking", []))
    ranking.remove(target_id)
    if to_index < 0:
        to_index = 0
    if to_index > len(ranking):
        to_index = len(ranking)
    ranking.insert(to_index, target_id)
    state["ranking"] = ranking


def _ready_all(state: Dict) -> bool:
    return all(pdata.get("ready") for pdata in state.get("players", {}).values())


def _update_lock_timer(state: Dict) -> None:
    if state.get("phase") != "river":
        state["lock_at_ms"] = None
        return
    if _ready_all(state):
        countdown = int(state.get("config", {}).get("ready_countdown_ms", DEFAULT_CONFIG["ready_countdown_ms"]))
        state["lock_at_ms"] = _now_ms() + countdown
    else:
        state["lock_at_ms"] = None


def _maybe_auto_lock(state: Dict, now_ms: int) -> bool:
    if state.get("phase") != "river":
        return False
    lock_at = state.get("lock_at_ms")
    deadline = state.get("river_deadline_ms")
    if isinstance(lock_at, int) and lock_at > 0 and now_ms >= lock_at:
        _lock_round(state)
        return True
    if isinstance(deadline, int) and deadline > 0 and now_ms >= deadline:
        _lock_round(state)
        return True
    return False


def _reset_game_state(state: Dict) -> None:
    players = list(state.get("player_meta", {}).values())
    players.sort(key=lambda p: p.get("seat", 0))
    fresh_state = TheGangGame.init_game(state.get("config"), players)
    state.clear()
    state.update(fresh_state)


class TheGangGame:
    game_id = "the_gang"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        players_sorted = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in players_sorted]
        player_meta = {p["player_id"]: p for p in players_sorted}
        state_players = {
            pid: {"ready": False, "reveal_ready": False, "next_ready": False, "hole": []} for pid in player_ids
        }

        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "ranking": list(player_ids),
            "config": cfg,
            "level": 1,
            "lives": cfg["starting_lives"],
            "max_lives": cfg["max_lives"],
            "tokens": cfg["starting_tokens"],
            "phase": "preflop",
            "deck": [],
            "discard": [],
            "community_cards": [],
            "lock_at_ms": None,
            "river_deadline_ms": None,
            "round_tokens_spent": False,
            "round_used_tolerance": False,
            "level_failed_once": False,
            "round_summary": None,
            "mission_deck": _build_mission_deck() if cfg["mode"] == "expert" else [],
            "current_mission": None,
            "hand_cache": {},
            "odds_cache": {},
            "game_over": False,
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        actions: List[str] = []
        phase = state.get("phase")
        tokens = state.get("tokens", 0)

        if phase == "preflop":
            if not state["players"][player_id].get("reveal_ready"):
                actions.append("reveal_next")
            if tokens > 0:
                actions.append("mulligan")
        elif phase in ("flop", "turn"):
            if not state["players"][player_id].get("reveal_ready"):
                actions.append("reveal_next")
            actions.append("move_rank")
            if tokens > 0:
                actions.append("spy")
        elif phase == "river":
            actions.append("move_rank")
            actions.append("toggle_ready")
            if tokens > 0:
                actions.append("spy")
            lock_at = state.get("lock_at_ms")
            deadline = state.get("river_deadline_ms")
            now_ms = _now_ms()
            if isinstance(lock_at, int) and lock_at > 0 and now_ms >= lock_at:
                actions.append("lock_in")
            if isinstance(deadline, int) and deadline > 0 and now_ms >= deadline:
                actions.append("lock_in")
        elif phase == "showdown":
            if not state["players"][player_id].get("next_ready"):
                actions.append("next_round")

        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        now_ms = _now_ms()
        events: List[Dict] = []
        if _maybe_auto_lock(state, now_ms):
            events.append({"type": "gang:auto_lock", "payload": {"at_ms": now_ms}})
            if state.get("phase") == "game_over":
                return events, None
            if state.get("phase") == "showdown" and action_type not in ("next_round", "play_again", "lock_in"):
                return events, "round locked"
            if state.get("phase") == "showdown" and action_type == "lock_in":
                return events, None

        if state.get("game_over"):
            if action.get("type") == "play_again":
                _reset_game_state(state)
                events.append({"type": "gang:play_again", "payload": {"player_id": player_id}})
                return events, None
            return [], "game over"

        phase = state.get("phase")

        if action_type == "reveal_next":
            if phase == "preflop":
                pdata = state["players"][player_id]
                if pdata.get("reveal_ready"):
                    return [], "already ready"
                pdata["reveal_ready"] = True
                if not _reveal_ready_all(state):
                    return [], None
                _reset_reveal_ready(state)
                _deal_community(state, 3)
                state["phase"] = "flop"
                _update_hand_cache(state)
                _update_odds_cache(state)
                events.append({"type": "gang:flop", "payload": {}})
                return events, None
            if phase == "flop":
                pdata = state["players"][player_id]
                if pdata.get("reveal_ready"):
                    return [], "already ready"
                pdata["reveal_ready"] = True
                if not _reveal_ready_all(state):
                    return [], None
                _reset_reveal_ready(state)
                _deal_community(state, 1)
                state["phase"] = "turn"
                _update_hand_cache(state)
                _update_odds_cache(state)
                events.append({"type": "gang:turn", "payload": {}})
                return events, None
            if phase == "turn":
                pdata = state["players"][player_id]
                if pdata.get("reveal_ready"):
                    return [], "already ready"
                pdata["reveal_ready"] = True
                if not _reveal_ready_all(state):
                    return [], None
                _reset_reveal_ready(state)
                _deal_community(state, 1)
                state["phase"] = "river"
                _update_hand_cache(state)
                _update_odds_cache(state)
                time_limit = state.get("config", {}).get("round_time_limit_sec", 0)
                if isinstance(time_limit, int) and time_limit > 0:
                    state["river_deadline_ms"] = now_ms + time_limit * 1000
                events.append({"type": "gang:river", "payload": {}})
                return events, None
            return [], "invalid phase"

        if action_type == "move_rank":
            if phase not in ("flop", "turn", "river"):
                return [], "invalid phase"
            target_id = action.get("player_id")
            to_index = action.get("to_index")
            if not isinstance(target_id, str):
                return [], "invalid player_id"
            if not isinstance(to_index, int):
                return [], "invalid to_index"
            if target_id not in state.get("players", {}):
                return [], "unknown target"
            if not _can_move_rank(state, player_id, target_id, to_index):
                return [], "target locked"
            if any(pdata.get("ready") for pdata in state.get("players", {}).values()):
                for pdata in state.get("players", {}).values():
                    pdata["ready"] = False
                _update_lock_timer(state)
            _apply_rank_move(state, target_id, to_index)
            events.append(
                {
                    "type": "gang:move_rank",
                    "payload": {"player_id": player_id, "target_id": target_id, "to_index": to_index},
                }
            )
            return events, None

        if action_type == "toggle_ready":
            if phase != "river":
                return [], "invalid phase"
            pdata = state["players"][player_id]
            pdata["ready"] = not pdata.get("ready")
            _update_lock_timer(state)
            events.append(
                {
                    "type": "gang:ready",
                    "payload": {"player_id": player_id, "ready": pdata["ready"]},
                }
            )
            return events, None

        if action_type == "lock_in":
            if phase != "river":
                return [], "invalid phase"
            lock_at = state.get("lock_at_ms")
            deadline = state.get("river_deadline_ms")
            ready_to_lock = False
            if isinstance(lock_at, int) and lock_at > 0 and now_ms >= lock_at:
                ready_to_lock = True
            if isinstance(deadline, int) and deadline > 0 and now_ms >= deadline:
                ready_to_lock = True
            if not ready_to_lock:
                return [], "not ready"
            _lock_round(state)
            events.append({"type": "gang:lock", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "mulligan":
            if phase != "preflop":
                return [], "invalid phase"
            if state.get("tokens", 0) <= 0:
                return [], "no tokens"
            state["tokens"] = state.get("tokens", 0) - 1
            state["round_tokens_spent"] = True
            _reset_reveal_ready(state)
            for pdata in state.get("players", {}).values():
                for card in pdata.get("hole", []):
                    state.setdefault("discard", []).append(card)
                pdata["hole"] = []
            _deal_hole_cards(state)
            _update_hand_cache(state)
            _update_odds_cache(state)
            events.append({"type": "gang:mulligan", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "spy":
            if phase not in ("flop", "turn", "river"):
                return [], "invalid phase"
            if state.get("tokens", 0) <= 0:
                return [], "no tokens"
            target_id = action.get("target_player_id")
            if not isinstance(target_id, str) or target_id not in state.get("players", {}):
                return [], "invalid target"
            state["tokens"] = state.get("tokens", 0) - 1
            state["round_tokens_spent"] = True
            hand = state["players"][target_id].get("hole", [])
            if not hand:
                return [], "target has no cards"
            unrevealed = [card for card in hand if not card.get("revealed")]
            card = random.choice(unrevealed or hand)
            card["revealed"] = True
            events.append(
                {
                    "type": "gang:spy",
                    "payload": {"player_id": player_id, "target_id": target_id},
                }
            )
            return events, None

        if action_type == "next_round":
            if phase != "showdown":
                return [], "invalid phase"
            if state.get("game_over"):
                return [], "game over"
            pdata = state["players"][player_id]
            if pdata.get("next_ready"):
                return [], None
            pdata["next_ready"] = True
            events.append({"type": "gang:next_ready", "payload": {"player_id": player_id}})
            if not _next_ready_all(state):
                return events, None
            _start_round(state)
            events.append({"type": "gang:next_round", "payload": {"level": state.get("level")}})
            return events, None

        if action_type == "play_again":
            return [], "game not over"

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = list(state.get("turn_order", []))
        players_view = []
        phase = state.get("phase")
        reveal_all = phase in ("showdown", "game_over")
        hand_cache = state.get("hand_cache", {})
        odds_cache = state.get("odds_cache", {})

        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            hand_view = []
            for card in pdata.get("hole", []):
                if reveal_all or pid == viewer_id or card.get("revealed"):
                    hand_view.append(_card_view(card))
                else:
                    hand_view.append({"hidden": True})
            player_entry = {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
            "ready": pdata.get("ready", False),
            "reveal_ready": pdata.get("reveal_ready", False),
            "next_ready": pdata.get("next_ready", False),
            "hand": hand_view,
        }
            if pid == viewer_id:
                if pid in hand_cache:
                    player_entry["hand_hint"] = {
                        "hand_type": hand_cache[pid]["hand_type"],
                        "hand_name": hand_cache[pid]["hand_name"],
                        "best_cards": [
                            _card_view(card) for card in hand_cache[pid].get("best_cards", [])
                        ],
                    }
                if pid in odds_cache and odds_cache[pid] is not None:
                    player_entry["hand_odds"] = odds_cache[pid]
            players_view.append(player_entry)

        summary = state.get("round_summary") if phase in ("showdown", "game_over") else None
        mission = state.get("current_mission")
        mission_view = None
        if mission:
            mission_view = {"id": mission.get("id"), "desc": mission.get("desc")}

        return {
            "game_id": TheGangGame.game_id,
            "you": viewer_id,
            "phase": phase,
            "level": state.get("level"),
            "lives": state.get("lives"),
            "max_lives": state.get("max_lives"),
            "tokens": state.get("tokens"),
            "mode": state.get("config", {}).get("mode"),
            "community_cards": [_card_view(card) for card in state.get("community_cards", [])],
            "ranking": list(state.get("ranking", [])),
            "players": players_view,
            "mission": mission_view,
            "lock_at_ms": state.get("lock_at_ms"),
            "river_deadline_ms": state.get("river_deadline_ms"),
            "server_time_ms": _now_ms(),
            "round_summary": summary,
            "game_over": state.get("game_over", False),
            "config": {
                "mode": state.get("config", {}).get("mode"),
                "round_time_limit_sec": state.get("config", {}).get("round_time_limit_sec", 0),
            },
            "legal_actions": TheGangGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        phase = state.get("phase")

        if phase in ("preflop", "flop", "turn"):
            if state["players"][bot_id].get("reveal_ready"):
                return None
            return {"type": "reveal_next", "delay_ms": random.randint(400, 900)}

        if phase == "river":
            if not state["players"][bot_id].get("ready"):
                return {"type": "toggle_ready", "delay_ms": random.randint(300, 700)}
            return None

        if phase == "showdown":
            if state["players"][bot_id].get("next_ready"):
                return None
            return {"type": "next_round", "delay_ms": random.randint(600, 1200)}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
