import random
import time
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG: Dict = {"flip_reveal_delay_ms": 1000, "flip_wait_ms": 3000, "deck_mode": "base"}
BOT_RING_REACTION_MIN_MS = 600
BOT_RING_REACTION_MAX_MS = 1200

FRUITS = ["banana", "strawberry", "cherry", "lemon"]
FRUIT_CARD_DISTRIBUTION = {
    1: 5,
    2: 3,
    3: 3,
    4: 2,
    5: 1,
}
EXTENDED_SINGLE_FRUIT_DISTRIBUTION = {
    1: 3,
    2: 2,
    3: 2,
    4: 1,
    5: 1,
}
EXTENDED_MIXED_COUNTS = [(1, 2), (2, 2), (1, 3), (1, 4), (2, 3), (3, 2)]
DECK_MODE_BASE = "base"
DECK_MODE_EXTENDED = "extended"


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _now_ms() -> int:
    return int(time.time() * 1000)


def _single_card(fruit: str, count: int) -> Dict:
    return {"fruit": fruit, "count": count}


def _mixed_card(entries: List[Tuple[str, int]]) -> Dict:
    return {"fruits": [{"fruit": fruit, "count": count} for fruit, count in entries]}


def _build_base_deck() -> List[Dict]:
    deck: List[Dict] = []
    for fruit in FRUITS:
        for count, copies in FRUIT_CARD_DISTRIBUTION.items():
            for _ in range(copies):
                deck.append(_single_card(fruit, count))
    random.shuffle(deck)
    return deck


def _build_extended_deck() -> List[Dict]:
    deck: List[Dict] = []
    for fruit in FRUITS:
        for count, copies in EXTENDED_SINGLE_FRUIT_DISTRIBUTION.items():
            for _ in range(copies):
                deck.append(_single_card(fruit, count))
    for idx, fruit_a in enumerate(FRUITS):
        for fruit_b in FRUITS[idx + 1 :]:
            for count_a, count_b in EXTENDED_MIXED_COUNTS:
                deck.append(_mixed_card([(fruit_a, count_a), (fruit_b, count_b)]))
    random.shuffle(deck)
    return deck


def _build_deck(deck_mode: str) -> List[Dict]:
    if deck_mode == DECK_MODE_EXTENDED:
        return _build_extended_deck()
    return _build_base_deck()


def _deal_cards(deck: List[Dict], player_ids: List[str]) -> Dict[str, List[Dict]]:
    hands = {pid: [] for pid in player_ids}
    if not player_ids:
        return hands
    idx = 0
    while deck:
        pid = player_ids[idx % len(player_ids)]
        hands[pid].append(deck.pop())
        idx += 1
    return hands


def _active_player_ids(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if not state["players"][pid]["eliminated"]]


def _next_turn(state: Dict, current_pid: Optional[str]) -> Optional[str]:
    order = state["turn_order"]
    if not order:
        return None
    start_idx = order.index(current_pid) if current_pid in order else -1
    for offset in range(1, len(order) + 1):
        pid = order[(start_idx + offset) % len(order)]
        pdata = state["players"][pid]
        if pdata["eliminated"]:
            continue
        if pdata["hand"]:
            return pid
    return None


def _ensure_current_turn(state: Dict) -> None:
    current = state.get("current_turn")
    if current and not state["players"][current]["eliminated"] and state["players"][current]["hand"]:
        return
    state["current_turn"] = _next_turn(state, current)


def _top_card(state: Dict, player_id: str) -> Optional[Dict]:
    pile = state["players"][player_id]["pile"]
    if not pile:
        return None
    return pile[-1]


def _card_entries(card: Optional[Dict]) -> List[Tuple[str, int]]:
    if not card:
        return []
    entries: List[Tuple[str, int]] = []
    fruits = card.get("fruits")
    if isinstance(fruits, list):
        for item in fruits:
            if not isinstance(item, dict):
                continue
            fruit = item.get("fruit")
            if fruit not in FRUITS:
                continue
            count = int(item.get("count", 0))
            if count <= 0:
                continue
            entries.append((fruit, count))
        return entries
    fruit = card.get("fruit")
    if fruit in FRUITS:
        count = int(card.get("count", 0))
        if count > 0:
            entries.append((fruit, count))
    return entries


def _fruit_totals(state: Dict) -> Dict[str, int]:
    totals = {fruit: 0 for fruit in FRUITS}
    for pid in _active_player_ids(state):
        card = _top_card(state, pid)
        for fruit, count in _card_entries(card):
            totals[fruit] += count
    return totals


def _bell_fruits(state: Dict) -> List[str]:
    totals = _fruit_totals(state)
    return [fruit for fruit, total in totals.items() if total == 5]


def _flip_delay_ms(state: Dict) -> int:
    raw = (state.get("config") or {}).get("flip_reveal_delay_ms", 0)
    try:
        delay = int(raw)
    except (TypeError, ValueError):
        delay = 0
    return max(delay, 0)


def _flip_wait_ms(state: Dict) -> int:
    raw = (state.get("config") or {}).get("flip_wait_ms", 0)
    try:
        delay = int(raw)
    except (TypeError, ValueError):
        delay = 0
    return max(delay, 0)


def _flip_ready_at_ms(state: Dict) -> int:
    raw = state.get("flip_ready_at_ms")
    try:
        ready_at = int(raw)
    except (TypeError, ValueError):
        ready_at = 0
    return max(ready_at, 0)


def _turn_switch_at_ms(state: Dict) -> int:
    raw = state.get("turn_switch_at_ms")
    try:
        switch_at = int(raw)
    except (TypeError, ValueError):
        switch_at = 0
    return max(switch_at, 0)


def _set_turn_switch(state: Dict, now_ms: int, current_pid: str) -> None:
    wait_ms = _flip_wait_ms(state)
    next_pid = _next_turn(state, current_pid)
    switch_at = now_ms + wait_ms if wait_ms > 0 else now_ms
    state["pending_turn"] = next_pid
    state["turn_switch_at_ms"] = switch_at
    state["flip_ready_at_ms"] = switch_at


def _clear_turn_switch(state: Dict) -> None:
    state["pending_turn"] = None
    state["turn_switch_at_ms"] = 0
    state["flip_ready_at_ms"] = 0


def _resolve_pending_turn(state: Dict, now_ms: int) -> bool:
    pending_turn = state.get("pending_turn")
    if not pending_turn:
        return False
    switch_at = _turn_switch_at_ms(state)
    if switch_at and now_ms < switch_at:
        return False
    state["current_turn"] = pending_turn
    _clear_turn_switch(state)
    _ensure_current_turn(state)
    return True


def _ring_window_active(state: Dict, now_ms: int) -> bool:
    pending = state.get("pending_flip")
    if pending:
        return False
    switch_at = _turn_switch_at_ms(state)
    if not switch_at:
        return False
    return now_ms < switch_at


def _closest_fruits(totals: Dict[str, int]) -> List[str]:
    if not totals:
        return []
    diffs = {fruit: abs(total - 5) for fruit, total in totals.items()}
    min_diff = min(diffs.values())
    return [fruit for fruit, diff in diffs.items() if diff == min_diff]


def _resolve_pending_flip(state: Dict, now_ms: int) -> bool:
    pending = state.get("pending_flip")
    if not pending:
        return False
    reveal_at = int(pending.get("reveal_at_ms") or 0)
    if now_ms < reveal_at:
        return False
    player_id = pending.get("player_id")
    card = pending.get("card")
    state["pending_flip"] = None
    if not player_id or not card:
        return True
    pdata = state["players"].get(player_id)
    if not pdata:
        return True
    pdata["pile"].append(card)
    state["last_action"] = {
        "type": "flip",
        "player_id": player_id,
        "card": _card_view(card),
    }
    _set_turn_switch(state, now_ms, player_id)
    _resolve_pending_turn(state, now_ms)
    _update_eliminations(state)
    _check_game_over(state)
    return True


def _add_to_bottom(hand: List[Dict], cards: List[Dict]) -> None:
    if cards:
        hand[:0] = cards


def _collect_piles(state: Dict, winner_id: str) -> int:
    collected: List[Dict] = []
    for pid in state["turn_order"]:
        pile = state["players"][pid]["pile"]
        if pile:
            collected.extend(pile)
            state["players"][pid]["pile"] = []
    _add_to_bottom(state["players"][winner_id]["hand"], collected)
    return len(collected)


def _apply_false_bell_penalty(state: Dict, player_id: str) -> int:
    giver = state["players"][player_id]
    recipients = [
        pid
        for pid in state["turn_order"]
        if pid != player_id and not state["players"][pid]["eliminated"]
    ]
    given = 0
    for pid in recipients:
        if not giver["hand"]:
            break
        card = giver["hand"].pop()
        _add_to_bottom(state["players"][pid]["hand"], [card])
        given += 1
    return given


def _update_eliminations(state: Dict) -> None:
    for pdata in state["players"].values():
        if pdata["hand"] or pdata["pile"]:
            continue
        pdata["eliminated"] = True


def _check_game_over(state: Dict) -> bool:
    active = _active_player_ids(state)
    if len(active) <= 1:
        state["game_over"] = True
        state["phase"] = "game_over"
        state["winner"] = active[0] if active else None
        state["current_turn"] = None
        return True
    return False


def _card_view(card: Optional[Dict]) -> Optional[Dict]:
    entries = _card_entries(card)
    if not entries:
        return None
    fruits_view = [{"fruit": fruit, "count": count} for fruit, count in entries]
    label = " + ".join([f"{count} {fruit}" for fruit, count in entries])
    view: Dict = {"fruits": fruits_view, "label": label}
    if len(entries) == 1:
        fruit, count = entries[0]
        view["fruit"] = fruit
        view["count"] = count
    return view


class HalliGalliGame:
    game_id = "halli_galli"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        deck_mode = str(cfg.get("deck_mode") or DECK_MODE_BASE).strip().lower()
        if deck_mode not in (DECK_MODE_BASE, DECK_MODE_EXTENDED):
            raise ValueError("invalid deck_mode")
        cfg["deck_mode"] = deck_mode
        deck = _build_deck(deck_mode)
        dealt = _deal_cards(deck, player_ids)
        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "hand": dealt.get(pid, []),
                "pile": [],
                "eliminated": False,
            }

        return {
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "playing",
            "config": cfg,
            "player_meta": player_meta,
            "last_action": None,
            "last_ring_result": None,
            "pending_flip": None,
            "pending_turn": None,
            "flip_ready_at_ms": 0,
            "turn_switch_at_ms": 0,
            "winner": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        now_ms = _now_ms()
        _resolve_pending_turn(state, now_ms)
        pending = state.get("pending_flip")
        if pending:
            reveal_at = int(pending.get("reveal_at_ms") or 0)
            if now_ms < reveal_at:
                return []
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata or pdata.get("eliminated"):
            return []
        actions: List[str] = []
        if _ring_window_active(state, now_ms):
            actions.append("ring")
        if player_id == state.get("current_turn") and pdata["hand"]:
            if not state.get("pending_turn") and now_ms >= _flip_ready_at_ms(state):
                actions.append("flip")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        now_ms = _now_ms()
        _resolve_pending_turn(state, now_ms)
        _resolve_pending_flip(state, now_ms)
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata or pdata.get("eliminated"):
            return [], "unknown player"

        pending = state.get("pending_flip")
        if pending:
            return [], "flip revealing"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "flip":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if not pdata["hand"]:
                return [], "no cards to flip"
            if state.get("pending_turn"):
                return [], "waiting for next turn"
            if now_ms < _flip_ready_at_ms(state):
                return [], "wait to flip"
            card = pdata["hand"].pop()
            delay_ms = _flip_delay_ms(state)
            if delay_ms <= 0:
                pdata["pile"].append(card)
                state["last_action"] = {
                    "type": "flip",
                    "player_id": player_id,
                    "card": _card_view(card),
                }
                events.append({"type": "halli_galli:flip", "payload": {"player_id": player_id}})
                _set_turn_switch(state, now_ms, player_id)
                _resolve_pending_turn(state, now_ms)
                _update_eliminations(state)
                _check_game_over(state)
                return events, None
            state["pending_flip"] = {
                "player_id": player_id,
                "card": card,
                "reveal_at_ms": now_ms + delay_ms,
            }
            events.append({"type": "halli_galli:flip", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "ring":
            if not _ring_window_active(state, now_ms):
                return [], "ring not allowed"
            bell_fruits = _bell_fruits(state)
            if bell_fruits:
                collected = _collect_piles(state, player_id)
                _clear_turn_switch(state)
                state["last_ring_result"] = {
                    "player_id": player_id,
                    "result": "success",
                    "fruits": bell_fruits,
                }
                state["last_action"] = {
                    "type": "ring",
                    "player_id": player_id,
                    "result": "success",
                    "bell_fruits": bell_fruits,
                    "collected": collected,
                }
                events.append(
                    {
                        "type": "halli_galli:ring_success",
                        "payload": {"player_id": player_id, "collected": collected},
                    }
                )
                _update_eliminations(state)
                if _check_game_over(state):
                    return events, None
                if state["players"][player_id]["hand"]:
                    state["current_turn"] = player_id
                else:
                    _ensure_current_turn(state)
                return events, None

            _clear_turn_switch(state)
            given = _apply_false_bell_penalty(state, player_id)
            totals = _fruit_totals(state)
            closest = _closest_fruits(totals)
            state["last_ring_result"] = {
                "player_id": player_id,
                "result": "false",
                "fruits": closest,
            }
            state["last_action"] = {
                "type": "ring",
                "player_id": player_id,
                "result": "false",
                "penalty_given": given,
            }
            events.append(
                {
                    "type": "halli_galli:ring_false",
                    "payload": {"player_id": player_id, "penalty_given": given},
                }
            )
            _update_eliminations(state)
            if _check_game_over(state):
                return events, None
            _ensure_current_turn(state)
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        now_ms = _now_ms()
        _resolve_pending_turn(state, now_ms)
        player_ids = sorted(
            state["player_meta"].keys(),
            key=lambda pid: state["player_meta"][pid].get("seat", 0),
        )
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            top_card = _card_view(pdata["pile"][-1]) if pdata["pile"] else None
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": len(pdata["hand"]),
                    "pile_count": len(pdata["pile"]),
                    "top_card": top_card,
                    "eliminated": pdata["eliminated"],
                }
            )

        pending = state.get("pending_flip")
        totals = _fruit_totals(state)
        bell_fruits = [fruit for fruit, total in totals.items() if total == 5]
        if pending or not _ring_window_active(state, now_ms):
            bell_fruits = []

        return {
            "game_id": HalliGalliGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "bell_fruits": bell_fruits,
            "bell_ready": bool(bell_fruits),
            "legal_actions": HalliGalliGame.get_legal_actions(state, viewer_id),
            "last_action": state.get("last_action"),
            "last_ring_result": state.get("last_ring_result"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": dict(state.get("config") or {}),
            "flip_ready_at_ms": _flip_ready_at_ms(state),
            "turn_switch_at_ms": _turn_switch_at_ms(state),
            "server_now_ms": _now_ms(),
            "pending_flip": {
                "player_id": pending.get("player_id"),
                "reveal_at_ms": pending.get("reveal_at_ms"),
            }
            if pending
            else None,
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        now_ms = _now_ms()
        _resolve_pending_turn(state, now_ms)
        pending = state.get("pending_flip")
        if pending:
            reveal_at = int(pending.get("reveal_at_ms") or 0)
            if now_ms < reveal_at:
                return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata.get("eliminated"):
            return None
        if _ring_window_active(state, now_ms) and _bell_fruits(state):
            if random.random() < 0.7:
                delay_ms = random.randint(BOT_RING_REACTION_MIN_MS, BOT_RING_REACTION_MAX_MS)
                return {"type": "ring", "delay_ms": delay_ms}
        if bot_id == state.get("current_turn") and pdata["hand"]:
            if state.get("pending_turn") or now_ms < _flip_ready_at_ms(state):
                return None
            return {"type": "flip"}
        return None

    @staticmethod
    def resolve_pending_flip(state: Dict, now_ms: Optional[int] = None) -> bool:
        if now_ms is None:
            now_ms = _now_ms()
        return _resolve_pending_flip(state, now_ms)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
