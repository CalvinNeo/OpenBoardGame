import random
import time
from itertools import combinations
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "starting_chips": 1000,
    "small_blind": 5,
    "big_blind": 10,
}

SUITS = ["S", "H", "D", "C"]
RANKS = list(range(2, 15))

SUIT_EMOJI = {
    "S": "\u2660\ufe0f",
    "H": "\u2665\ufe0f",
    "D": "\u2666\ufe0f",
    "C": "\u2663\ufe0f",
}

RANK_LABELS = {
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
}

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


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    for key in ("starting_chips", "small_blind", "big_blind"):
        raw = cfg.get(key)
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be an integer") from None
        if value < 1:
            raise ValueError(f"{key} must be >= 1") from None
        cfg[key] = value
    if cfg["small_blind"] > cfg["big_blind"]:
        raise ValueError("small_blind must be <= big_blind")
    if cfg["starting_chips"] < cfg["big_blind"]:
        cfg["starting_chips"] = cfg["big_blind"]
    return cfg


def _build_deck() -> List[Dict]:
    deck = [{"rank": rank, "suit": suit} for suit in SUITS for rank in RANKS]
    random.shuffle(deck)
    return deck


def _card_label(rank: int, suit: str) -> str:
    label = RANK_LABELS.get(rank, str(rank))
    return f"{label}{SUIT_EMOJI.get(suit, '')}"


def _card_view(card: Dict, hidden: bool) -> Dict:
    if hidden:
        return {"hidden": True, "label": "\U0001F0A0"}
    suit = card.get("suit")
    rank = int(card.get("rank", 0))
    return {
        "hidden": False,
        "rank": rank,
        "suit": suit,
        "suit_emoji": SUIT_EMOJI.get(suit),
        "label": _card_label(rank, suit),
        "color": "red" if suit in ("H", "D") else "black",
    }


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
        return (0,), {
            "hand_type": "HIGH_CARD",
            "hand_name": "High Card",
            "score": (0,),
            "cards": [],
        }
    return best_score, best_detail


def _active_players(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if state["players"][pid]["status"] == "active"]


def _players_in_hand(state: Dict) -> List[str]:
    return [
        pid
        for pid in state["turn_order"]
        if state["players"][pid]["status"] in ("active", "all_in")
    ]


def _next_active_index(state: Dict, start_index: int) -> Optional[int]:
    order = state["turn_order"]
    if not order:
        return None
    for offset in range(1, len(order) + 1):
        idx = (start_index + offset) % len(order)
        pid = order[idx]
        if state["players"][pid]["chips"] > 0:
            return idx
    return None


def _needs_action(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    if pdata["status"] != "active":
        return False
    if pdata["current_bet"] < state["current_bet"]:
        return True
    acted = set(state.get("acted_since_raise") or [])
    return player_id not in acted


def _find_next_to_act(state: Dict, start_pid: Optional[str], include_start: bool) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    if start_pid in order:
        start_index = order.index(start_pid)
    else:
        start_index = -1
    start_offset = 0 if include_start else 1
    for offset in range(start_offset, len(order) + 1):
        idx = (start_index + offset) % len(order)
        pid = order[idx]
        if _needs_action(state, pid):
            return pid
    return None


def _post_blind(state: Dict, player_id: str, amount: int) -> int:
    pdata = state["players"][player_id]
    blind = min(amount, pdata["chips"])
    pdata["chips"] -= blind
    pdata["current_bet"] += blind
    pdata["total_bet"] += blind
    if pdata["chips"] == 0:
        pdata["status"] = "all_in"
    return blind


def _reset_betting_round(state: Dict, first_player: Optional[str]) -> None:
    state["current_bet"] = 0
    state["min_raise"] = state["config"]["big_blind"]
    state["acted_since_raise"] = []
    for pid in state["turn_order"]:
        state["players"][pid]["current_bet"] = 0
    state["current_turn"] = _find_next_to_act(state, first_player, include_start=True)


def _start_hand(state: Dict, advance_dealer: bool) -> None:
    state["hand_number"] += 1
    state["phase"] = "preflop"
    state["community_cards"] = []
    state["deck"] = _build_deck()
    state["last_hand_summary"] = None
    state["current_bet"] = 0
    state["min_raise"] = state["config"]["big_blind"]
    state["acted_since_raise"] = []

    active_pids = [pid for pid in state["turn_order"] if state["players"][pid]["chips"] > 0]
    for pid in state["turn_order"]:
        pdata = state["players"][pid]
        pdata["hole"] = []
        pdata["current_bet"] = 0
        pdata["total_bet"] = 0
        if pid in active_pids:
            pdata["status"] = "active"
        else:
            pdata["status"] = "out"

    if len(active_pids) < 2:
        state["phase"] = "hand_end"
        state["current_turn"] = None
        return

    if state.get("dealer_index") is None:
        dealer_index = state["turn_order"].index(active_pids[0])
    elif advance_dealer:
        next_idx = _next_active_index(state, state["dealer_index"])
        dealer_index = next_idx if next_idx is not None else state["dealer_index"]
    else:
        dealer_index = state["dealer_index"]
    state["dealer_index"] = dealer_index

    if len(active_pids) == 2:
        sb_index = dealer_index
        bb_index = _next_active_index(state, dealer_index)
    else:
        sb_index = _next_active_index(state, dealer_index)
        bb_index = _next_active_index(state, sb_index if sb_index is not None else dealer_index)

    if sb_index is None or bb_index is None:
        state["phase"] = "hand_end"
        state["current_turn"] = None
        return

    state["sb_index"] = sb_index
    state["bb_index"] = bb_index

    for pid in active_pids:
        hole = [state["deck"].pop(), state["deck"].pop()]
        state["players"][pid]["hole"] = hole

    _post_blind(state, state["turn_order"][sb_index], state["config"]["small_blind"])
    _post_blind(state, state["turn_order"][bb_index], state["config"]["big_blind"])

    state["current_bet"] = max(state["players"][pid]["current_bet"] for pid in active_pids)
    state["min_raise"] = state["config"]["big_blind"]
    state["acted_since_raise"] = []

    if len(active_pids) == 2:
        first_to_act = state["turn_order"][sb_index]
    else:
        next_idx = _next_active_index(state, bb_index)
        first_to_act = state["turn_order"][next_idx] if next_idx is not None else state["turn_order"][bb_index]
    state["current_turn"] = _find_next_to_act(state, first_to_act, include_start=True)
    if state["current_turn"] is None:
        _progress_after_action(state)


def _build_pots(state: Dict) -> List[Dict]:
    contribs = {pid: pdata["total_bet"] for pid, pdata in state["players"].items() if pdata["total_bet"] > 0}
    if not contribs:
        return []
    levels = sorted(set(contribs.values()))
    pots: List[Dict] = []
    prev_level = 0
    for level in levels:
        involved = [pid for pid, amount in contribs.items() if amount >= level]
        amount = (level - prev_level) * len(involved)
        eligible = [pid for pid in involved if state["players"][pid]["status"] != "folded"]
        pots.append({"amount": amount, "eligible": eligible})
        prev_level = level
    return pots


def _payout_pots(state: Dict, pots: List[Dict], hand_scores: Dict[str, Dict]) -> Dict[str, int]:
    payouts = {pid: 0 for pid in state["players"]}
    order = state["turn_order"]
    dealer_index = state.get("dealer_index") or 0
    seat_order = [order[(dealer_index + i + 1) % len(order)] for i in range(len(order))]

    for pot in reversed(pots):
        eligible = [pid for pid in pot["eligible"] if pid in hand_scores]
        if not eligible:
            continue
        best_score = max(hand_scores[pid]["score"] for pid in eligible)
        winners = [pid for pid in eligible if hand_scores[pid]["score"] == best_score]
        share = pot["amount"] // len(winners)
        remainder = pot["amount"] % len(winners)
        for pid in winners:
            payouts[pid] += share
        if remainder:
            for pid in seat_order:
                if pid in winners:
                    payouts[pid] += 1
                    remainder -= 1
                    if remainder == 0:
                        break
    return payouts


def _award_by_folds(state: Dict, winner_id: str) -> None:
    pot_total = sum(pdata["total_bet"] for pdata in state["players"].values())
    state["players"][winner_id]["chips"] += pot_total
    state["last_hand_summary"] = {
        "reason": "fold",
        "pot_total": pot_total,
        "payouts": {winner_id: pot_total},
        "winners": [winner_id],
    }
    state["phase"] = "hand_end"
    state["current_turn"] = None


def _resolve_showdown(state: Dict) -> None:
    pots = _build_pots(state)
    hand_scores: Dict[str, Dict] = {}
    for pid in _players_in_hand(state):
        cards = state["players"][pid]["hole"] + state["community_cards"]
        score, detail = _best_hand(cards)
        hand_scores[pid] = {
            "score": score,
            "hand_name": detail["hand_name"],
            "hand_type": detail["hand_type"],
            "cards": detail["cards"],
        }
    payouts = _payout_pots(state, pots, hand_scores)
    for pid, amount in payouts.items():
        if amount:
            state["players"][pid]["chips"] += amount

    winners = [pid for pid, amount in payouts.items() if amount == max(payouts.values(), default=0) and amount > 0]
    state["last_hand_summary"] = {
        "reason": "showdown",
        "pot_total": sum(p["amount"] for p in pots),
        "pots": pots,
        "payouts": payouts,
        "winners": winners,
        "hands": {
            pid: {
                "hand_name": info["hand_name"],
                "hand_type": info["hand_type"],
                "cards": [_card_view(card, False) for card in info["cards"]],
            }
            for pid, info in hand_scores.items()
        },
    }
    state["phase"] = "hand_end"
    state["current_turn"] = None


def _advance_phase(state: Dict) -> None:
    if state["phase"] == "preflop":
        state["community_cards"].extend([state["deck"].pop() for _ in range(3)])
        state["phase"] = "flop"
    elif state["phase"] == "flop":
        state["community_cards"].append(state["deck"].pop())
        state["phase"] = "turn"
    elif state["phase"] == "turn":
        state["community_cards"].append(state["deck"].pop())
        state["phase"] = "river"
    elif state["phase"] == "river":
        state["phase"] = "showdown"
    else:
        return

    if state["phase"] == "showdown":
        _resolve_showdown(state)
        return

    dealer_index = state.get("dealer_index")
    if dealer_index is None:
        state["current_turn"] = None
        return
    order = state["turn_order"]
    first_idx = (dealer_index + 1) % len(order)
    _reset_betting_round(state, order[first_idx])
    if state["current_turn"] is None:
        _progress_after_action(state)


def _progress_after_action(state: Dict) -> None:
    remaining = _players_in_hand(state)
    if len(remaining) == 1:
        _award_by_folds(state, remaining[0])
        return

    if not _active_players(state):
        while len(state["community_cards"]) < 5:
            state["community_cards"].append(state["deck"].pop())
        _resolve_showdown(state)
        return

    next_to_act = _find_next_to_act(state, state.get("current_turn"), include_start=False)
    if next_to_act is None:
        _advance_phase(state)
    else:
        state["current_turn"] = next_to_act


class TexasHoldemGame:
    game_id = "texas_holdem"
    min_players = 2
    max_players = 10

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in ordered]
        player_meta = {p["player_id"]: p for p in ordered}
        state_players: Dict[str, Dict] = {}
        for pid in player_ids:
            state_players[pid] = {
                "chips": cfg["starting_chips"],
                "hole": [],
                "status": "active",
                "current_bet": 0,
                "total_bet": 0,
            }
        state = {
            "config": cfg,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "dealer_index": None,
            "sb_index": None,
            "bb_index": None,
            "current_turn": None,
            "phase": "hand_end",
            "community_cards": [],
            "deck": [],
            "current_bet": 0,
            "min_raise": cfg["big_blind"],
            "acted_since_raise": [],
            "hand_number": 0,
            "last_hand_summary": None,
            "game_over": False,
            "game_start_time": time.time(),
        }
        _start_hand(state, advance_dealer=False)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state["players"]:
            return []
        if state.get("phase") == "hand_end":
            actions = []
            if state["players"][player_id]["chips"] == 0:
                actions.append("rebuy")
            if len([pid for pid in state["turn_order"] if state["players"][pid]["chips"] > 0]) >= 2:
                actions.append("next_hand")
            return actions
        if state.get("current_turn") != player_id:
            return []
        pdata = state["players"][player_id]
        if pdata["status"] != "active":
            return []
        to_call = max(0, state["current_bet"] - pdata["current_bet"])
        acted = set(state.get("acted_since_raise") or [])
        can_raise = player_id not in acted
        actions = ["fold", "all_in"]
        if to_call == 0:
            actions.append("check")
            if can_raise and pdata["chips"] >= state["min_raise"]:
                if state["current_bet"] == 0:
                    actions.append("bet")
                else:
                    actions.append("raise")
        else:
            actions.append("call")
            if can_raise and pdata["chips"] > to_call and pdata["chips"] >= to_call + state["min_raise"]:
                actions.append("raise")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state["players"]:
            return [], "unknown player"
        if state.get("game_over"):
            return [], "game over"

        action_type = action.get("type")
        events: List[Dict] = []

        if state.get("phase") == "hand_end":
            if action_type == "rebuy":
                pdata = state["players"][player_id]
                if pdata["chips"] > 0:
                    return [], "rebuy not needed"
                pdata["chips"] += state["config"]["starting_chips"]
                events.append({"type": "texas_holdem:rebuy", "payload": {"player_id": player_id}})
                return events, None
            if action_type == "next_hand":
                if len([pid for pid in state["turn_order"] if state["players"][pid]["chips"] > 0]) < 2:
                    return [], "need at least 2 players with chips"
                _start_hand(state, advance_dealer=True)
                events.append({"type": "texas_holdem:next_hand", "payload": {"hand": state["hand_number"]}})
                return events, None
            return [], "hand ended"

        legal = TexasHoldemGame.get_legal_actions(state, player_id)
        if action_type not in legal:
            return [], "invalid action"

        pdata = state["players"][player_id]
        to_call = max(0, state["current_bet"] - pdata["current_bet"])
        acted = set(state.get("acted_since_raise") or [])

        if action_type == "fold":
            pdata["status"] = "folded"
            acted.add(player_id)
            state["acted_since_raise"] = list(acted)
            events.append({"type": "texas_holdem:fold", "payload": {"player_id": player_id}})
            _progress_after_action(state)
            return events, None

        if action_type == "check":
            if to_call != 0:
                return [], "cannot check"
            acted.add(player_id)
            state["acted_since_raise"] = list(acted)
            events.append({"type": "texas_holdem:check", "payload": {"player_id": player_id}})
            _progress_after_action(state)
            return events, None

        if action_type == "call":
            if to_call == 0:
                return [], "nothing to call"
            call_amount = min(to_call, pdata["chips"])
            pdata["chips"] -= call_amount
            pdata["current_bet"] += call_amount
            pdata["total_bet"] += call_amount
            if pdata["chips"] == 0:
                pdata["status"] = "all_in"
            acted.add(player_id)
            state["acted_since_raise"] = list(acted)
            events.append({"type": "texas_holdem:call", "payload": {"player_id": player_id, "amount": call_amount}})
            _progress_after_action(state)
            return events, None

        if action_type == "all_in":
            if pdata["chips"] <= 0:
                return [], "no chips"
            all_in_amount = pdata["chips"]
            raise_to = pdata["current_bet"] + all_in_amount
            pdata["chips"] = 0
            pdata["current_bet"] = raise_to
            pdata["total_bet"] += all_in_amount
            pdata["status"] = "all_in"
            if raise_to > state["current_bet"]:
                raise_increment = raise_to - state["current_bet"]
                full_raise = raise_increment >= state["min_raise"]
                state["current_bet"] = raise_to
                if full_raise:
                    state["min_raise"] = raise_increment
                    acted.clear()
                    acted.add(player_id)
                else:
                    acted.add(player_id)
            else:
                acted.add(player_id)
            state["acted_since_raise"] = list(acted)
            events.append({"type": "texas_holdem:all_in", "payload": {"player_id": player_id, "amount": all_in_amount}})
            _progress_after_action(state)
            return events, None

        if action_type in ("bet", "raise"):
            raw_amount = action.get("amount")
            try:
                amount = int(raw_amount)
            except (TypeError, ValueError):
                return [], "invalid amount"
            if amount <= 0:
                return [], "invalid amount"

            raise_to = amount
            max_raise_to = pdata["current_bet"] + pdata["chips"]
            if raise_to > max_raise_to:
                return [], "not enough chips"
            if state["current_bet"] == 0:
                min_bet = state["min_raise"]
                if raise_to < min_bet and raise_to != max_raise_to:
                    return [], "bet too small"
            else:
                min_raise_to = state["current_bet"] + state["min_raise"]
                if raise_to < min_raise_to and raise_to != max_raise_to:
                    return [], "raise too small"

            pay_amount = raise_to - pdata["current_bet"]
            pdata["chips"] -= pay_amount
            pdata["current_bet"] = raise_to
            pdata["total_bet"] += pay_amount
            if pdata["chips"] == 0:
                pdata["status"] = "all_in"

            if raise_to > state["current_bet"]:
                raise_increment = raise_to - state["current_bet"]
                full_raise = raise_increment >= state["min_raise"]
                state["current_bet"] = raise_to
                if full_raise:
                    state["min_raise"] = raise_increment
                    acted.clear()
                    acted.add(player_id)
                else:
                    acted.add(player_id)
            else:
                acted.add(player_id)
            state["acted_since_raise"] = list(acted)
            events.append(
                {
                    "type": "texas_holdem:raise",
                    "payload": {"player_id": player_id, "amount": raise_to},
                }
            )
            _progress_after_action(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        order = sorted(
            state["player_meta"].keys(), key=lambda pid: state["player_meta"][pid].get("seat", 0)
        )
        dealer_id = None
        sb_id = None
        bb_id = None
        if state.get("dealer_index") is not None:
            dealer_id = state["turn_order"][state["dealer_index"]]
        if state.get("sb_index") is not None:
            sb_id = state["turn_order"][state["sb_index"]]
        if state.get("bb_index") is not None:
            bb_id = state["turn_order"][state["bb_index"]]

        reveal_all = state.get("phase") in ("showdown", "hand_end")
        players_view = []
        for pid in order:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            reveal = reveal_all and pdata["status"] != "folded"
            hole_cards = [
                _card_view(card, hidden=not (pid == viewer_id or reveal)) for card in pdata.get("hole", [])
            ]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "chips": pdata.get("chips", 0),
                    "status": pdata.get("status"),
                    "current_bet": pdata.get("current_bet", 0),
                    "total_bet": pdata.get("total_bet", 0),
                    "hole_cards": hole_cards,
                    "is_dealer": pid == dealer_id,
                    "is_sb": pid == sb_id,
                    "is_bb": pid == bb_id,
                }
            )

        to_call = 0
        max_raise_to = None
        min_bet = None
        min_raise_to = None
        if viewer_id in state["players"]:
            pdata = state["players"][viewer_id]
            to_call = max(0, state["current_bet"] - pdata.get("current_bet", 0))
            max_raise_to = pdata.get("current_bet", 0) + pdata.get("chips", 0)
            if state["current_bet"] == 0:
                min_bet = state["min_raise"]
            else:
                min_raise_to = state["current_bet"] + state["min_raise"]

        return {
            "game_id": TexasHoldemGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "hand_number": state.get("hand_number"),
            "current_turn": state.get("current_turn"),
            "dealer_id": dealer_id,
            "sb_id": sb_id,
            "bb_id": bb_id,
            "community_cards": [
                _card_view(card, hidden=False) for card in state.get("community_cards", [])
            ],
            "pot_total": sum(pdata.get("total_bet", 0) for pdata in state["players"].values()),
            "current_bet": state.get("current_bet"),
            "min_raise": state.get("min_raise"),
            "players": players_view,
            "legal_actions": TexasHoldemGame.get_legal_actions(state, viewer_id),
            "action_info": {
                "to_call": to_call,
                "min_bet": min_bet,
                "min_raise_to": min_raise_to,
                "max_raise_to": max_raise_to,
            },
            "last_hand_summary": state.get("last_hand_summary"),
            "config": {
                "starting_chips": state["config"]["starting_chips"],
                "small_blind": state["config"]["small_blind"],
                "big_blind": state["config"]["big_blind"],
            },
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state["players"]:
            return None
        phase = state.get("phase")
        if phase == "hand_end":
            if state["players"][bot_id]["chips"] == 0:
                return {"type": "rebuy"}
            if len([pid for pid in state["turn_order"] if state["players"][pid]["chips"] > 0]) >= 2:
                return {"type": "next_hand"}
            return None
        if state.get("current_turn") != bot_id:
            return None
        legal = TexasHoldemGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        if "check" in legal:
            return {"type": "check"}
        if "call" in legal:
            return {"type": "call"}
        if "fold" in legal:
            return {"type": "fold"}
        return {"type": "all_in"}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
