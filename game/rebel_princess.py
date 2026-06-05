import random
from typing import Dict, List, Optional, Tuple


SUITS = ["queen", "fairy", "pet", "prince"]
SUIT_LABELS = {
    "queen": "Queen",
    "fairy": "Fairy",
    "pet": "Pet",
    "prince": "Prince",
}

ROUND_CARDS = [
    {
        "id": "once_upon_a_time",
        "letter": "A",
        "name": "Once Upon a Time...",
        "summary": "No extra rule.",
        "pass": [{"count": 3, "direction": "right"}],
    },
    {
        "id": "invitation",
        "letter": "B",
        "name": "Invitation",
        "summary": "No extra rule.",
        "pass": [{"count": 3, "direction": "right"}],
    },
    {
        "id": "masquerade_ball",
        "letter": "C",
        "name": "Masquerade Ball",
        "summary": "Only the leader's card is face up until the trick resolves.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "royal_decree",
        "letter": "D",
        "name": "Royal Decree",
        "summary": "Queens always win the trick.",
        "pass": [{"count": 3, "direction": "right"}],
    },
    {
        "id": "musical_chairs",
        "letter": "E",
        "name": "Musical Chairs",
        "summary": "After each trick, everyone passes 1 card right.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "pets_revenge",
        "letter": "F",
        "name": "Pets' Revenge",
        "summary": "Pets are worth 1 proposal at scoring; the frog is worth 6.",
        "pass": [{"count": 1, "direction": "left"}, {"count": 1, "direction": "right"}],
    },
    {
        "id": "late_to_the_ball",
        "letter": "G",
        "name": "Late to the Ball",
        "summary": "Each player sets aside 1 hidden card to play in the last trick.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "poisoned_apple",
        "letter": "H",
        "name": "Poisoned Apple",
        "summary": "Void cards win; ties among void cards go to the later play.",
        "pass": [{"count": 2, "direction": "right"}],
    },
    {
        "id": "crystal_clear",
        "letter": "I",
        "name": "Crystal Clear",
        "summary": "Each player reveals all cards of one chosen suit.",
        "pass": [{"count": 2, "direction": "right"}],
    },
    {
        "id": "upside_down",
        "letter": "J",
        "name": "Upside Down",
        "summary": "Each 6 in a trick reverses rank order for that trick.",
        "pass": [{"count": 2, "direction": "right"}],
    },
    {
        "id": "dancing_queens",
        "letter": "K",
        "name": "Dancing Queens",
        "summary": "Queens pair with princes for extra proposals.",
        "pass": [{"count": 2, "direction": "right"}],
    },
    {
        "id": "prince_always_rings_twice",
        "letter": "L",
        "name": "The Prince Always Rings Twice",
        "summary": "Each trick has two play cycles; sum lead-suit ranks.",
        "pass": [{"count": 1, "direction": "left"}, {"count": 1, "direction": "right"}],
    },
    {
        "id": "wedding_gift",
        "letter": "M",
        "name": "Wedding Gift",
        "summary": "Before each trick, each player places 1 hidden gift card; the trick winner takes them.",
        "pass": [{"count": 1, "direction": "left"}, {"count": 1, "direction": "right"}],
    },
    {
        "id": "after_party",
        "letter": "N",
        "name": "After-party",
        "summary": "Split your hand in half and play one half, then the other.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "bathroom_break",
        "letter": "O",
        "name": "Bathroom Break",
        "summary": "Princes are worth 2 proposals except for the current score leader(s).",
        "pass": [{"count": 2, "direction": "right"}],
    },
    {
        "id": "single_fairy",
        "letter": "P",
        "name": "Single Fairy",
        "summary": "Each fairy you win subtracts 1 proposal.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "blind_mans_bluff",
        "letter": "Q",
        "name": "Blind Man's Bluff",
        "summary": "Split your hand; after the first half, pass the second half right.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "midnight_makeover",
        "letter": "R",
        "name": "Midnight Makeover",
        "summary": "Fairies are wild and can follow any suit.",
        "pass": [{"count": 3, "direction": "right"}],
    },
    {
        "id": "pass_the_bouquet",
        "letter": "S",
        "name": "Pass the Bouquet!",
        "summary": "Each newly played suit becomes the required suit.",
        "pass": [{"count": 3, "direction": "right"}],
    },
    {
        "id": "haggle_with_the_hag",
        "letter": "T",
        "name": "Haggle with the Hag",
        "summary": "The trick winner may swap 1 hand card with 1 trick card not played by them.",
        "pass": [{"count": 1, "direction": "right"}],
    },
    {
        "id": "odds_and_evens",
        "letter": "U",
        "name": "Odds and Evens",
        "summary": "Follow the lead parity if possible, while still prioritizing suit.",
        "pass": [{"count": 2, "direction": "right"}],
    },
]

ROUND_BY_ID = {card["id"]: card for card in ROUND_CARDS}

PRINCESSES = [
    {"id": "cinderella", "name": "Cinderella", "summary": "Before a trick, invert rank order for that trick."},
    {"id": "snow_white", "name": "Snow White", "summary": "After playing rank 7 or lower, it counts as 0 for the trick."},
    {"id": "little_mermaid", "name": "The Little Mermaid", "summary": "Before a trick, force the leader to lead a chosen suit if possible."},
    {"id": "pocahontas", "name": "Pocahontas", "summary": "After winning a trick, choose another player to lead next."},
    {"id": "sleeping_beauty", "name": "Sleeping Beauty", "summary": "Before a trick, each player gives you 1 card; keep one, randomly return the rest."},
    {"id": "alice", "name": "Alice", "summary": "After winning a frog-free trick, shuffle and redeal all hands."},
    {"id": "mulan", "name": "Mulan", "summary": "Before a trick resolves, swap your played card with another same-suit non-frog hand card."},
    {"id": "scheherazade", "name": "Scheherazade", "summary": "Before a trick, draw 1 random card from a player and optionally swap."},
    {"id": "pea_princess", "name": "The Pea Princess", "summary": "After playing, remaining players must play rank above 5 if possible."},
    {"id": "ice_princess", "name": "The Ice Princess", "summary": "Before a trick, force the leader to play a random card."},
]
PRINCESS_BY_ID = {p["id"]: p for p in PRINCESSES}


def _card_id(suit: str, rank: int) -> str:
    return f"{suit}-{rank}"


def _make_card(suit: str, rank: int) -> Dict:
    return {"id": _card_id(suit, rank), "suit": suit, "rank": rank, "is_frog": suit == "pet" and rank == 8}


def _sort_cards(cards: List[Dict]) -> List[Dict]:
    suit_index = {suit: idx for idx, suit in enumerate(SUITS)}
    return sorted(cards, key=lambda c: (suit_index.get(c.get("suit"), 99), c.get("rank", 0)))


def _build_deck(player_count: int) -> List[Dict]:
    if player_count == 3:
        ranks = range(2, 11)
    elif player_count in (4, 5):
        ranks = range(1, 11)
    elif player_count == 6:
        ranks = range(1, 13)
    else:
        raise ValueError("Rebel Princess supports 3-6 players")
    deck = [_make_card(suit, rank) for suit in SUITS for rank in ranks]
    random.shuffle(deck)
    return deck


def _player_name(state: Dict, player_id: str) -> str:
    return (state.get("player_meta", {}).get(player_id) or {}).get("name") or player_id


def _append_log(state: Dict, message: str) -> None:
    log = state.setdefault("log", [])
    log.append(message)
    if len(log) > 80:
        del log[:-80]


def _next_player(state: Dict, player_id: str) -> Optional[str]:
    order = state.get("turn_order") or []
    if not order:
        return None
    if player_id not in order:
        return order[0]
    return order[(order.index(player_id) + 1) % len(order)]


def _target_player(state: Dict, player_id: str, direction: str) -> str:
    order = state["turn_order"]
    idx = order.index(player_id)
    if direction == "left":
        return order[(idx + 1) % len(order)]
    return order[(idx - 1) % len(order)]


def _find_card(cards: List[Dict], card_id: str) -> Optional[Dict]:
    for card in cards:
        if card.get("id") == card_id:
            return card
    return None


def _remove_card(cards: List[Dict], card_id: str) -> Optional[Dict]:
    for idx, card in enumerate(cards):
        if card.get("id") == card_id:
            return cards.pop(idx)
    return None


def _public_card(card: Optional[Dict]) -> Optional[Dict]:
    if not card:
        return None
    return {"id": card["id"], "suit": card["suit"], "rank": card["rank"], "is_frog": card.get("is_frog", False)}


def _round_card(state: Dict) -> Dict:
    return ROUND_BY_ID[state["round_card_id"]]


def _round_effect(state: Dict) -> str:
    return state.get("round_card_id") or ""


def _pass_requirement(state: Dict) -> int:
    return sum(int(item["count"]) for item in _round_card(state).get("pass", []))


def _deal_new_round(state: Dict, leader_id: Optional[str], round_index: int) -> None:
    order = state["turn_order"]
    deck = _build_deck(len(order))
    for pdata in state["players"].values():
        pdata["hand"] = []
        pdata["won_cards"] = []
        pdata["round_score"] = 0
        pdata["princess_used"] = False
        pdata["passed"] = False
        pdata["ready_next"] = False
        pdata["revealed_suit"] = None
        pdata["reserved_last_card"] = None
        pdata["set_aside"] = []
        pdata["gift_card"] = None
    hand_size = len(deck) // len(order)
    for _ in range(hand_size):
        for pid in order:
            state["players"][pid]["hand"].append(deck.pop())
    for pdata in state["players"].values():
        pdata["hand"] = _sort_cards(pdata["hand"])

    state.update(
        {
            "round": round_index + 1,
            "round_index": round_index,
            "round_card_id": state["round_cards"][round_index],
            "phase": "pass",
            "current_turn": None,
            "leader": leader_id or order[0],
            "current_trick": [],
            "gift_cards": [],
            "tricks_played": 0,
            "princes_sneaked_in": False,
            "lead_suit": None,
            "current_required_suit": None,
            "rank_inversions": 0,
            "forced_lead_suit": None,
            "random_lead": False,
            "pea_constraint": False,
            "last_round_summary": None,
            "pending_haggle": None,
            "pending_pocahontas": None,
            "sleeping_beauty": None,
            "scheherazade": None,
            "round_score_leaders": _score_leaders(state),
        }
    )
    _append_log(state, f"Round {round_index + 1}: {_round_card(state)['name']}.")


def _score_leaders(state: Dict) -> List[str]:
    if not state.get("players"):
        return []
    best = min(pdata.get("score", 0) for pdata in state["players"].values())
    return [pid for pid, pdata in state["players"].items() if pdata.get("score", 0) == best]


def _after_pass_phase(state: Dict) -> None:
    effect = _round_effect(state)
    if effect == "late_to_the_ball":
        state["phase"] = "reserve_last"
        return
    if effect == "crystal_clear":
        state["phase"] = "reveal_suit"
        return
    if effect in ("after_party", "blind_mans_bluff"):
        state["phase"] = "split_hand"
        return
    _start_trick_phase(state)


def _start_trick_phase(state: Dict) -> None:
    state["phase"] = "trick"
    state["current_turn"] = state.get("leader")
    state["current_trick"] = []
    state["gift_cards"] = []
    state["lead_suit"] = None
    state["current_required_suit"] = None
    state["rank_inversions"] = 0
    state["forced_lead_suit"] = None
    state["random_lead"] = False
    state["pea_constraint"] = False
    if _round_effect(state) == "wedding_gift" and any(state["players"][pid]["hand"] for pid in state["turn_order"]):
        state["phase"] = "gift"
        state["current_turn"] = None
        for pdata in state["players"].values():
            pdata["gift_card"] = None


def _maybe_start_second_half(state: Dict) -> bool:
    effect = _round_effect(state)
    if effect not in ("after_party", "blind_mans_bluff"):
        return False
    if state.get("second_half_started"):
        return False
    if any(state["players"][pid]["hand"] for pid in state["turn_order"]):
        return False
    if effect == "blind_mans_bluff":
        moved = {pid: list(state["players"][pid].get("set_aside") or []) for pid in state["turn_order"]}
        for pid in state["turn_order"]:
            target = _target_player(state, pid, "right")
            state["players"][target]["hand"] = _sort_cards(moved[pid])
            state["players"][pid]["set_aside"] = []
    else:
        for pid in state["turn_order"]:
            state["players"][pid]["hand"] = _sort_cards(state["players"][pid].get("set_aside") or [])
            state["players"][pid]["set_aside"] = []
    state["second_half_started"] = True
    _append_log(state, "Second half starts.")
    _start_trick_phase(state)
    return True


def _finish_round(state: Dict) -> None:
    round_scores = {}
    won_counts = {}
    for pid, pdata in state["players"].items():
        score = _score_cards(state, pid, pdata["won_cards"])
        pdata["round_score"] = score
        pdata["score"] += score
        if score == 0:
            pdata["zero_rounds"] += 1
        round_scores[pid] = score
        won_counts[pid] = len(pdata["won_cards"])
    state["last_round_summary"] = {
        "round": state["round"],
        "round_card": _round_card(state),
        "round_scores": round_scores,
        "total_scores": {pid: pdata["score"] for pid, pdata in state["players"].items()},
        "won_counts": won_counts,
    }
    _append_log(state, f"Round {state['round']} scored.")
    if state["round_index"] >= 4:
        _finish_game(state)
        return
    state["phase"] = "round_pause"
    state["current_turn"] = None
    for pdata in state["players"].values():
        pdata["ready_next"] = False


def _finish_game(state: Dict) -> None:
    state["phase"] = "game_over"
    state["game_over"] = True
    low = min(pdata["score"] for pdata in state["players"].values())
    candidates = [pid for pid, pdata in state["players"].items() if pdata["score"] == low]
    if len(candidates) > 1:
        best_zero = max(state["players"][pid].get("zero_rounds", 0) for pid in candidates)
        candidates = [pid for pid in candidates if state["players"][pid].get("zero_rounds", 0) == best_zero]
    state["winners"] = candidates
    _append_log(state, "Game over.")


def _score_cards(state: Dict, player_id: str, cards: List[Dict]) -> int:
    effect = _round_effect(state)
    if effect == "dancing_queens":
        return _score_dancing_queens(cards)
    score = 0
    for card in cards:
        if card["suit"] == "prince":
            if effect == "bathroom_break" and player_id not in state.get("round_score_leaders", []):
                score += 2
            else:
                score += 1
        if card.get("is_frog"):
            score += 5
        if effect == "pets_revenge" and card["suit"] == "pet":
            score += 1
        if effect == "single_fairy" and card["suit"] == "fairy":
            score -= 1
    return score


def _score_dancing_queens(cards: List[Dict]) -> int:
    score = sum(5 for card in cards if card.get("is_frog"))
    princes = [card["rank"] for card in cards if card["suit"] == "prince"]
    queens = [card["rank"] for card in cards if card["suit"] == "queen"]
    used_princes = []
    used_queens = []
    for pr in list(princes):
        if pr in queens:
            princes.remove(pr)
            queens.remove(pr)
            score += 3
            used_princes.append(pr)
            used_queens.append(pr)
    while princes:
        princes.pop()
        if queens:
            queens.pop()
            score += 2
        else:
            score += 1
    return score


def _is_void_for_lead(state: Dict, player_id: str, leading_suit: str) -> bool:
    hand = state["players"][player_id]["hand"]
    if _round_effect(state) == "midnight_makeover":
        return not any(c["suit"] == leading_suit or c["suit"] == "fairy" for c in hand)
    return not any(c["suit"] == leading_suit for c in hand)


def _legal_cards(state: Dict, player_id: str) -> List[Dict]:
    hand = state["players"][player_id]["hand"]
    if not hand:
        return []
    trick = state.get("current_trick") or []
    effect = _round_effect(state)
    if not trick:
        if state.get("random_lead"):
            return hand
        forced = state.get("forced_lead_suit")
        if forced and (forced != "prince" or state.get("princes_sneaked_in")):
            forced_cards = [c for c in hand if c["suit"] == forced]
            if forced_cards:
                return forced_cards
        legal = list(hand)
        if not state.get("princes_sneaked_in") and any(c["suit"] != "prince" for c in hand):
            legal = [c for c in legal if c["suit"] != "prince"]
        return legal

    lead_suit = state["lead_suit"]
    required_suit = state.get("current_required_suit") or lead_suit
    if effect == "midnight_makeover":
        same = [c for c in hand if c["suit"] == required_suit or c["suit"] == "fairy"]
    else:
        same = [c for c in hand if c["suit"] == required_suit]

    if effect == "odds_and_evens" and trick:
        lead_parity = trick[0]["card"]["rank"] % 2
        same_parity_same = [c for c in same if c["rank"] % 2 == lead_parity]
        if same_parity_same:
            return same_parity_same
        if same:
            return same
        same_parity = [c for c in hand if c["rank"] % 2 == lead_parity]
        return same_parity or list(hand)

    legal = same or list(hand)
    if state.get("pea_constraint") and player_id not in [entry["player_id"] for entry in trick]:
        above = [c for c in legal if c["rank"] > 5]
        if above:
            return above
    return legal


def _effective_rank(state: Dict, entry: Dict) -> int:
    if entry.get("snow_zero"):
        return 0
    rank = entry["card"]["rank"]
    inversions = state.get("rank_inversions", 0)
    if _round_effect(state) == "upside_down":
        inversions += sum(1 for item in state.get("current_trick", []) if item["card"]["rank"] == 6)
    return -rank if inversions % 2 else rank


def _determine_winner(state: Dict) -> str:
    trick = state["current_trick"]
    effect = _round_effect(state)
    if effect == "royal_decree":
        queens = [entry for entry in trick if entry["card"]["suit"] == "queen"]
        if queens:
            return max(queens, key=lambda e: (_effective_rank(state, e), e["order"]))["player_id"]
    if effect == "poisoned_apple":
        voids = [entry for entry in trick if entry.get("was_void")]
        if voids:
            return max(voids, key=lambda e: (_effective_rank(state, e), e["order"]))["player_id"]
    if effect == "prince_always_rings_twice":
        lead = state["lead_suit"]
        best = None
        for pid in state["turn_order"]:
            entries = [e for e in trick if e["player_id"] == pid and e["card"]["suit"] == lead]
            total = sum(_effective_rank(state, e) for e in entries)
            high = max([_effective_rank(state, e) for e in entries] or [-999])
            key = (total, high)
            if best is None or key > best[0]:
                best = (key, pid)
        return best[1]
    if effect == "midnight_makeover":
        lead = state["lead_suit"]
        candidates = [e for e in trick if e["card"]["suit"] == lead or e["card"]["suit"] == "fairy"]
        return max(candidates, key=lambda e: (_effective_rank(state, e), e["order"]))["player_id"]
    lead = state.get("current_required_suit") if effect == "pass_the_bouquet" else state["lead_suit"]
    candidates = [e for e in trick if e["card"]["suit"] == lead]
    return max(candidates, key=lambda e: (_effective_rank(state, e), e["order"]))["player_id"]


def _should_resolve_trick(state: Dict) -> bool:
    needed = len(state["turn_order"])
    if _round_effect(state) == "prince_always_rings_twice":
        needed *= 2
    return len(state["current_trick"]) >= needed


def _complete_trick_if_ready(state: Dict, events: List[Dict]) -> None:
    if not _should_resolve_trick(state):
        state["current_turn"] = _next_player(state, state["current_turn"])
        return
    mulan_pid = _mulan_candidate(state)
    if mulan_pid:
        state["phase"] = "mulan"
        state["current_turn"] = mulan_pid
        return
    _resolve_trick(state, events)


def _mulan_candidate(state: Dict) -> Optional[str]:
    for entry in state.get("current_trick", []):
        pid = entry["player_id"]
        pdata = state["players"][pid]
        if pdata["princess"] != "mulan" or pdata.get("princess_used"):
            continue
        suit = entry["card"]["suit"]
        if any(c["suit"] == suit and not c.get("is_frog") for c in pdata["hand"]):
            return pid
    return None


def _resolve_trick(state: Dict, events: List[Dict]) -> None:
    winner = _determine_winner(state)
    won = [entry["card"] for entry in state["current_trick"]] + list(state.get("gift_cards") or [])
    state["players"][winner]["won_cards"].extend(won)
    state["leader"] = winner
    state["tricks_played"] += 1
    events.append({"type": "rebel_princess:trick", "payload": {"winner": winner}})
    _append_log(state, f"{_player_name(state, winner)} wins trick {state['tricks_played']}.")

    if _round_effect(state) == "haggle_with_the_hag" and state["players"][winner]["hand"]:
        exchangeable = [e for e in state["current_trick"] if e["player_id"] != winner]
        if exchangeable:
            state["pending_haggle"] = {"winner": winner, "trick_cards": [e["card"] for e in exchangeable]}
            state["phase"] = "haggle"
            state["current_turn"] = winner
            state["current_trick"] = []
            state["gift_cards"] = []
            return

    if state["players"][winner]["princess"] == "pocahontas" and not state["players"][winner]["princess_used"] and len(state["turn_order"]) > 1:
        state["pending_pocahontas"] = winner
        state["phase"] = "pocahontas"
        state["current_turn"] = winner
        state["current_trick"] = []
        state["gift_cards"] = []
        return

    if state["players"][winner]["princess"] == "alice" and not state["players"][winner]["princess_used"]:
        if not any(card.get("is_frog") for card in won):
            _use_alice(state, winner)

    state["current_trick"] = []
    state["gift_cards"] = []
    if _round_effect(state) == "musical_chairs" and any(state["players"][pid]["hand"] for pid in state["turn_order"]):
        state["phase"] = "trick_pass"
        state["current_turn"] = None
        for pdata in state["players"].values():
            pdata["passed"] = False
        return
    _advance_after_trick(state)


def _advance_after_trick(state: Dict) -> None:
    if _maybe_start_second_half(state):
        return
    if _round_effect(state) == "late_to_the_ball" and all(len(state["players"][pid]["hand"]) == 0 for pid in state["turn_order"]):
        moved = False
        for pid in state["turn_order"]:
            card = state["players"][pid].get("reserved_last_card")
            if card:
                state["players"][pid]["reserved_last_card"] = None
                state["players"][pid]["hand"] = [card]
                moved = True
        if moved:
            _start_trick_phase(state)
            return
    if all(not state["players"][pid]["hand"] for pid in state["turn_order"]):
        _finish_round(state)
        return
    _start_trick_phase(state)


def _use_alice(state: Dict, player_id: str) -> None:
    counts = {pid: len(state["players"][pid]["hand"]) for pid in state["turn_order"]}
    pool = []
    for pid in state["turn_order"]:
        pool.extend(state["players"][pid]["hand"])
        state["players"][pid]["hand"] = []
    random.shuffle(pool)
    for pid in state["turn_order"]:
        state["players"][pid]["hand"] = _sort_cards([pool.pop() for _ in range(counts[pid])])
    state["players"][player_id]["princess_used"] = True
    _append_log(state, f"{_player_name(state, player_id)} uses Alice.")


class RebelPrincessGame:
    game_id = "rebel_princess"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered = sorted(players, key=lambda p: p.get("seat", 0))
        order = [p["player_id"] for p in ordered]
        if len(order) < 3 or len(order) > 6:
            raise ValueError("Rebel Princess supports 3-6 players")
        princesses = [p["id"] for p in PRINCESSES]
        random.shuffle(princesses)
        round_ids = [card["id"] for card in ROUND_CARDS]
        random.shuffle(round_ids)
        selected_rounds = round_ids[:5]
        state = {
            "players": {
                pid: {
                    "hand": [],
                    "won_cards": [],
                    "princess": princesses[idx],
                    "princess_used": False,
                    "passed": False,
                    "ready_next": False,
                    "score": 0,
                    "round_score": 0,
                    "zero_rounds": 0,
                    "revealed_suit": None,
                    "reserved_last_card": None,
                    "set_aside": [],
                    "gift_card": None,
                }
                for idx, pid in enumerate(order)
            },
            "turn_order": order,
            "player_meta": {p["player_id"]: p for p in ordered},
            "round_cards": selected_rounds,
            "round": 1,
            "round_index": 0,
            "round_card_id": selected_rounds[0],
            "phase": "pass",
            "current_turn": None,
            "leader": order[0],
            "current_trick": [],
            "gift_cards": [],
            "tricks_played": 0,
            "princes_sneaked_in": False,
            "game_over": False,
            "winners": [],
            "log": [],
            "config": config or {},
        }
        _deal_new_round(state, order[0], 0)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata:
            return []
        phase = state.get("phase")
        actions: List[str] = []
        if phase == "pass" and not pdata.get("passed"):
            actions.append("pass_cards")
        elif phase in ("reserve_last", "reveal_suit", "split_hand") and not pdata.get("passed"):
            actions.append("setup_choice")
        elif phase in ("gift", "trick_pass", "sleeping_beauty_collect") and not pdata.get("passed"):
            actions.append("choose_card")
        elif phase == "trick" and player_id == state.get("current_turn"):
            actions.append("play_card")
        elif phase == "round_pause" and not pdata.get("ready_next"):
            actions.append("next_round_ready")
        elif phase in ("mulan", "haggle", "pocahontas", "sleeping_beauty_keep", "scheherazade_decide") and player_id == state.get("current_turn"):
            actions.extend(["use_princess", "skip"])
        if phase == "trick" and not state.get("current_trick") and not pdata.get("princess_used"):
            if pdata["princess"] in ("cinderella", "little_mermaid", "sleeping_beauty", "scheherazade", "ice_princess"):
                actions.append("use_princess")
        if phase == "trick" and pdata["princess"] == "pea_princess" and not pdata.get("princess_used"):
            actions.append("use_princess")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        phase = state.get("phase")
        action_type = action.get("type")
        pdata = state["players"][player_id]
        events: List[Dict] = []

        if phase == "pass":
            if action_type != "pass_cards":
                return [], "invalid action"
            card_ids = action.get("card_ids") or []
            if len(card_ids) != _pass_requirement(state) or len(set(card_ids)) != len(card_ids):
                return [], "wrong number of cards"
            chosen = []
            for cid in card_ids:
                card = _remove_card(pdata["hand"], cid)
                if not card:
                    return [], "card not in hand"
                chosen.append(card)
            pdata["pending_pass"] = chosen
            pdata["passed"] = True
            if all(p["passed"] for p in state["players"].values()):
                for pid in state["turn_order"]:
                    out = list(state["players"][pid].pop("pending_pass", []))
                    index = 0
                    for spec in _round_card(state).get("pass", []):
                        for _ in range(int(spec["count"])):
                            target = _target_player(state, pid, spec["direction"])
                            state["players"][target]["hand"].append(out[index])
                            index += 1
                for p in state["players"].values():
                    p["hand"] = _sort_cards(p["hand"])
                    p["passed"] = False
                _after_pass_phase(state)
            return events, None

        if phase in ("reserve_last", "reveal_suit", "split_hand"):
            if action_type != "setup_choice":
                return [], "invalid action"
            if pdata.get("passed"):
                return [], "already submitted"
            if phase == "reserve_last":
                cid = action.get("card_id")
                card = _remove_card(pdata["hand"], cid)
                if not card:
                    return [], "card not in hand"
                pdata["reserved_last_card"] = card
            elif phase == "reveal_suit":
                suit = action.get("suit")
                if suit not in SUITS:
                    return [], "invalid suit"
                pdata["revealed_suit"] = suit
            else:
                card_ids = action.get("card_ids") or []
                expected = len(pdata["hand"]) // 2
                if len(card_ids) != expected or len(set(card_ids)) != expected:
                    return [], "wrong number of cards"
                set_aside = []
                for cid in card_ids:
                    card = _remove_card(pdata["hand"], cid)
                    if not card:
                        return [], "card not in hand"
                    set_aside.append(card)
                pdata["set_aside"] = _sort_cards(set_aside)
            pdata["passed"] = True
            if all(p["passed"] for p in state["players"].values()):
                for p in state["players"].values():
                    p["passed"] = False
                state["second_half_started"] = False
                _start_trick_phase(state)
            return events, None

        if phase in ("gift", "trick_pass", "sleeping_beauty_collect"):
            if action_type != "choose_card":
                return [], "invalid action"
            cid = action.get("card_id")
            card = _remove_card(pdata["hand"], cid)
            if not card:
                return [], "card not in hand"
            if phase == "sleeping_beauty_collect":
                state["sleeping_beauty"]["pool"].append({"from": player_id, "card": card})
                pdata["passed"] = True
                if all(p["passed"] or not p["hand"] for p in state["players"].values()):
                    for p in state["players"].values():
                        p["passed"] = False
                    state["phase"] = "sleeping_beauty_keep"
                    state["current_turn"] = state["sleeping_beauty"]["player"]
                return events, None
            pdata["gift_card"] = card
            pdata["passed"] = True
            if all(p["passed"] or not p["hand"] for p in state["players"].values()):
                if phase == "gift":
                    state["gift_cards"] = [p.pop("gift_card", None) for p in state["players"].values() if p.get("gift_card")]
                    for p in state["players"].values():
                        p["passed"] = False
                    state["phase"] = "trick"
                    state["current_turn"] = state["leader"]
                else:
                    for pid in state["turn_order"]:
                        card = state["players"][pid].pop("gift_card", None)
                        if card:
                            target = _target_player(state, pid, "right")
                            state["players"][target]["hand"].append(card)
                    for p in state["players"].values():
                        p["hand"] = _sort_cards(p["hand"])
                        p["passed"] = False
                    _advance_after_trick(state)
            return events, None

        if phase == "trick":
            if action_type == "use_princess":
                return RebelPrincessGame._use_princess(state, player_id, action)
            if action_type != "play_card":
                return [], "invalid action"
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            legal = _legal_cards(state, player_id)
            cid = action.get("card_id")
            card = _find_card(legal, cid)
            if not card:
                return [], "illegal card"
            if state.get("random_lead") and not state["current_trick"]:
                card = random.choice(pdata["hand"])
            _remove_card(pdata["hand"], card["id"])
            was_void = False
            if state["current_trick"]:
                required = state.get("current_required_suit") or state["lead_suit"]
                was_void = _is_void_for_lead(state, player_id, required)
                if was_void and card["suit"] == "prince":
                    state["princes_sneaked_in"] = True
                if _round_effect(state) == "pass_the_bouquet" and card["suit"] != required:
                    state["current_required_suit"] = card["suit"]
            else:
                state["lead_suit"] = card["suit"]
                state["current_required_suit"] = card["suit"]
                if card["suit"] == "prince":
                    state["princes_sneaked_in"] = True
            entry = {
                "player_id": player_id,
                "card": card,
                "was_void": was_void,
                "order": len(state["current_trick"]),
                "face_down": _round_effect(state) == "masquerade_ball" and bool(state["current_trick"]),
                "snow_zero": False,
            }
            if pdata["princess"] == "snow_white" and not pdata["princess_used"] and card["rank"] <= 7 and action.get("use_snow_white"):
                entry["snow_zero"] = True
                pdata["princess_used"] = True
            state["current_trick"].append(entry)
            if pdata["princess"] == "pea_princess" and not pdata["princess_used"] and action.get("use_pea_princess"):
                state["pea_constraint"] = True
                pdata["princess_used"] = True
            _complete_trick_if_ready(state, events)
            return events, None

        if phase == "mulan":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if action_type == "skip":
                _resolve_trick(state, events)
                return events, None
            if action_type != "use_princess":
                return [], "invalid action"
            cid = action.get("card_id")
            played = next((e for e in state["current_trick"] if e["player_id"] == player_id), None)
            replacement = _find_card(pdata["hand"], cid)
            if not played or not replacement or replacement["suit"] != played["card"]["suit"] or replacement.get("is_frog"):
                return [], "invalid replacement"
            _remove_card(pdata["hand"], cid)
            pdata["hand"].append(played["card"])
            pdata["hand"] = _sort_cards(pdata["hand"])
            played["card"] = replacement
            pdata["princess_used"] = True
            _resolve_trick(state, events)
            return events, None

        if phase == "sleeping_beauty_keep":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            pending = state.get("sleeping_beauty") or {}
            pool = list(pending.get("pool") or [])
            if not pool:
                return [], "no cards"
            keep_id = action.get("keep_card_id") if action_type == "use_princess" else None
            kept_item = None
            rest = []
            for item in pool:
                if keep_id and item["card"]["id"] == keep_id and kept_item is None:
                    kept_item = item
                else:
                    rest.append(item)
            if kept_item is None:
                kept_item = rest.pop(random.randrange(len(rest))) if rest else pool[0]
                rest = [item for item in pool if item is not kept_item]
            pdata["hand"].append(kept_item["card"])
            targets = [pid for pid in state["turn_order"] if pid != player_id]
            random.shuffle(targets)
            cards = [item["card"] for item in rest]
            random.shuffle(cards)
            for idx, card in enumerate(cards):
                state["players"][targets[idx % len(targets)]]["hand"].append(card)
            for p in state["players"].values():
                p["hand"] = _sort_cards(p["hand"])
            state["sleeping_beauty"] = None
            state["phase"] = "trick"
            state["current_turn"] = state["leader"]
            return events, None

        if phase == "scheherazade_decide":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            pending = state.get("scheherazade") or {}
            drawn = pending.get("drawn")
            target = pending.get("target")
            if not drawn or target not in state["players"]:
                return [], "no drawn card"
            give_id = action.get("give_card_id") if action_type == "use_princess" else None
            if give_id:
                give = _remove_card(pdata["hand"], give_id)
                if not give:
                    return [], "card not in hand"
                state["players"][target]["hand"].append(give)
                pdata["hand"].append(drawn)
            else:
                state["players"][target]["hand"].append(drawn)
            pdata["hand"] = _sort_cards(pdata["hand"])
            state["players"][target]["hand"] = _sort_cards(state["players"][target]["hand"])
            pdata["princess_used"] = True
            state["scheherazade"] = None
            state["phase"] = "trick"
            state["current_turn"] = state["leader"]
            return events, None

        if phase == "haggle":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            pending = state.get("pending_haggle") or {}
            if action_type == "skip":
                state["pending_haggle"] = None
                _advance_after_trick(state)
                return events, None
            if action_type != "use_princess":
                return [], "invalid action"
            hand_card = _remove_card(pdata["hand"], action.get("hand_card_id"))
            trick_card = _find_card(pending.get("trick_cards") or [], action.get("trick_card_id"))
            if not hand_card or not trick_card:
                return [], "invalid exchange"
            _remove_card(pending["trick_cards"], trick_card["id"])
            pdata["hand"].append(trick_card)
            pdata["hand"] = _sort_cards(pdata["hand"])
            pdata["won_cards"].append(hand_card)
            state["pending_haggle"] = None
            _advance_after_trick(state)
            return events, None

        if phase == "pocahontas":
            if action_type == "skip":
                state["pending_pocahontas"] = None
                _advance_after_trick(state)
                return events, None
            if action_type != "use_princess":
                return [], "invalid action"
            target = action.get("target_player_id")
            if target not in state["players"] or target == player_id:
                return [], "invalid target"
            state["leader"] = target
            pdata["princess_used"] = True
            state["pending_pocahontas"] = None
            _advance_after_trick(state)
            return events, None

        if phase == "round_pause":
            if action_type != "next_round_ready":
                return [], "invalid action"
            pdata["ready_next"] = True
            if all(p["ready_next"] for p in state["players"].values()):
                _deal_new_round(state, state.get("leader"), state["round_index"] + 1)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def _use_princess(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        pdata = state["players"][player_id]
        if pdata.get("princess_used"):
            return [], "princess already used"
        princess = pdata["princess"]
        if princess == "cinderella":
            if state.get("current_trick"):
                return [], "only before a trick"
            state["rank_inversions"] += 1
        elif princess == "little_mermaid":
            suit = action.get("suit")
            if state.get("current_trick") or suit not in SUITS:
                return [], "invalid suit"
            if suit == "prince" and not state.get("princes_sneaked_in"):
                return [], "princes have not sneaked in"
            state["forced_lead_suit"] = suit
        elif princess == "ice_princess":
            if state.get("current_trick"):
                return [], "only before a trick"
            state["random_lead"] = True
        elif princess == "scheherazade":
            target = action.get("target_player_id")
            if target not in state["players"] or target == player_id or not state["players"][target]["hand"]:
                return [], "invalid target"
            drawn = random.choice(state["players"][target]["hand"])
            _remove_card(state["players"][target]["hand"], drawn["id"])
            state["scheherazade"] = {"player": player_id, "target": target, "drawn": drawn}
            state["phase"] = "scheherazade_decide"
            state["current_turn"] = player_id
            _append_log(state, f"{_player_name(state, player_id)} draws a random card from {_player_name(state, target)}.")
            return [], None
        elif princess == "sleeping_beauty":
            if state.get("current_trick"):
                return [], "only before a trick"
            state["sleeping_beauty"] = {"player": player_id, "pool": []}
            state["phase"] = "sleeping_beauty_collect"
            state["current_turn"] = None
            for p in state["players"].values():
                p["passed"] = False
        elif princess == "pea_princess":
            state["pea_constraint"] = True
        else:
            return [], "princess cannot be used now"
        pdata["princess_used"] = True
        _append_log(state, f"{_player_name(state, player_id)} uses {PRINCESS_BY_ID[princess]['name']}.")
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for pid in state["turn_order"]:
            pdata = state["players"][pid]
            revealed = []
            if pdata.get("revealed_suit"):
                revealed = [_public_card(c) for c in pdata["hand"] if c["suit"] == pdata["revealed_suit"]]
            players.append(
                {
                    "player_id": pid,
                    "name": _player_name(state, pid),
                    "seat": state["player_meta"].get(pid, {}).get("seat"),
                    "hand_count": len(pdata["hand"]),
                    "won_count": len(pdata["won_cards"]),
                    "score": pdata["score"],
                    "round_score": pdata.get("round_score", 0),
                    "zero_rounds": pdata.get("zero_rounds", 0),
                    "princess": PRINCESS_BY_ID[pdata["princess"]],
                    "princess_used": pdata.get("princess_used", False),
                    "passed": pdata.get("passed", False),
                    "ready_next": pdata.get("ready_next", False),
                    "revealed_suit": pdata.get("revealed_suit"),
                    "revealed_cards": revealed,
                }
            )

        trick_view = []
        reveal_all = _should_resolve_trick(state) or state.get("phase") in ("mulan", "haggle", "pocahontas", "round_pause", "game_over")
        for entry in state.get("current_trick", []):
            hidden = entry.get("face_down") and not reveal_all and entry["player_id"] != viewer_id
            trick_view.append(
                {
                    "player_id": entry["player_id"],
                    "name": _player_name(state, entry["player_id"]),
                    "card": None if hidden else _public_card(entry["card"]),
                    "hidden": hidden,
                    "was_void": entry.get("was_void", False),
                    "snow_zero": entry.get("snow_zero", False),
                }
            )

        your = state["players"].get(viewer_id, {})
        legal_cards = [_public_card(c) for c in _legal_cards(state, viewer_id)] if state.get("phase") == "trick" and viewer_id == state.get("current_turn") else []
        pending_haggle = state.get("pending_haggle")
        if pending_haggle and pending_haggle.get("winner") != viewer_id:
            pending_haggle = {"winner": pending_haggle.get("winner"), "trick_cards": []}
        elif pending_haggle:
            pending_haggle = {
                "winner": pending_haggle.get("winner"),
                "trick_cards": [_public_card(c) for c in pending_haggle.get("trick_cards", [])],
            }

        sleeping_pool = []
        sleeping = state.get("sleeping_beauty") or {}
        if sleeping.get("player") == viewer_id:
            sleeping_pool = [
                {"from": item["from"], "card": _public_card(item["card"])}
                for item in sleeping.get("pool", [])
            ]

        scheherazade_drawn = None
        scheherazade = state.get("scheherazade") or {}
        if scheherazade.get("player") == viewer_id and scheherazade.get("drawn"):
            scheherazade_drawn = {
                "target": scheherazade.get("target"),
                "card": _public_card(scheherazade.get("drawn")),
            }

        return {
            "game_id": RebelPrincessGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "round_index": state.get("round_index"),
            "round_card": _round_card(state),
            "round_cards": [ROUND_BY_ID[rid] for rid in state.get("round_cards", [])],
            "current_turn": state.get("current_turn"),
            "leader": state.get("leader"),
            "lead_suit": state.get("lead_suit"),
            "current_required_suit": state.get("current_required_suit"),
            "princes_sneaked_in": state.get("princes_sneaked_in", False),
            "tricks_played": state.get("tricks_played", 0),
            "players": players,
            "hand": [_public_card(c) for c in _sort_cards(list(your.get("hand", [])))],
            "legal_cards": legal_cards,
            "your_princess": PRINCESS_BY_ID[your.get("princess")] if your.get("princess") else None,
            "current_trick": trick_view,
            "gift_count": len(state.get("gift_cards") or []),
            "pass_required": _pass_requirement(state),
            "last_round_summary": state.get("last_round_summary"),
            "pending_haggle": pending_haggle,
            "pending_pocahontas": state.get("pending_pocahontas"),
            "sleeping_beauty_pool": sleeping_pool,
            "scheherazade_drawn": scheherazade_drawn,
            "legal_actions": RebelPrincessGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
            "winners": state.get("winners", []),
            "log": state.get("log", []),
            "suits": list(SUITS),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = RebelPrincessGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        pdata = state["players"][bot_id]
        if "pass_cards" in legal:
            return {"type": "pass_cards", "card_ids": [c["id"] for c in pdata["hand"][: _pass_requirement(state)]]}
        if "setup_choice" in legal:
            if state["phase"] == "reveal_suit":
                return {"type": "setup_choice", "suit": random.choice(SUITS)}
            count = max(1, len(pdata["hand"]) // 2) if state["phase"] == "split_hand" else 1
            key = "card_ids" if state["phase"] == "split_hand" else "card_id"
            ids = [c["id"] for c in pdata["hand"][:count]]
            return {"type": "setup_choice", key: ids if key == "card_ids" else ids[0]}
        if "choose_card" in legal:
            return {"type": "choose_card", "card_id": pdata["hand"][0]["id"]}
        if "play_card" in legal:
            options = _legal_cards(state, bot_id)
            if options:
                return {"type": "play_card", "card_id": random.choice(options)["id"]}
        if "next_round_ready" in legal:
            return {"type": "next_round_ready"}
        if "skip" in legal:
            return {"type": "skip"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
