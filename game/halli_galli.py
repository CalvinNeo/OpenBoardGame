import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG: Dict = {}

FRUITS = ["banana", "strawberry", "cherry", "lemon"]
FRUIT_CARD_DISTRIBUTION = {
    1: 5,
    2: 3,
    3: 3,
    4: 2,
    5: 1,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _build_deck() -> List[Dict]:
    deck: List[Dict] = []
    for fruit in FRUITS:
        for count, copies in FRUIT_CARD_DISTRIBUTION.items():
            for _ in range(copies):
                deck.append({"fruit": fruit, "count": count})
    random.shuffle(deck)
    return deck


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


def _fruit_totals(state: Dict) -> Dict[str, int]:
    totals = {fruit: 0 for fruit in FRUITS}
    for pid in _active_player_ids(state):
        card = _top_card(state, pid)
        if not card:
            continue
        fruit = card.get("fruit")
        if fruit in totals:
            totals[fruit] += int(card.get("count", 0))
    return totals


def _bell_fruits(state: Dict) -> List[str]:
    totals = _fruit_totals(state)
    return [fruit for fruit, total in totals.items() if total == 5]


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
    if not card:
        return None
    fruit = card.get("fruit")
    count = int(card.get("count", 0))
    return {
        "fruit": fruit,
        "count": count,
        "label": f"{count} {fruit}",
    }


class HalliGalliGame:
    game_id = "halli_galli"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        deck = _build_deck()
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
            "winner": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata or pdata.get("eliminated"):
            return []
        actions = ["ring"]
        if player_id == state.get("current_turn") and pdata["hand"]:
            actions.append("flip")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata or pdata.get("eliminated"):
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if action_type == "flip":
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            if not pdata["hand"]:
                return [], "no cards to flip"
            card = pdata["hand"].pop()
            pdata["pile"].append(card)
            state["last_action"] = {
                "type": "flip",
                "player_id": player_id,
                "card": _card_view(card),
            }
            events.append({"type": "halli_galli:flip", "payload": {"player_id": player_id}})
            state["current_turn"] = _next_turn(state, player_id)
            _update_eliminations(state)
            _check_game_over(state)
            return events, None

        if action_type == "ring":
            bell_fruits = _bell_fruits(state)
            if bell_fruits:
                collected = _collect_piles(state, player_id)
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

            given = _apply_false_bell_penalty(state, player_id)
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

        totals = _fruit_totals(state)
        bell_fruits = [fruit for fruit, total in totals.items() if total == 5]

        return {
            "game_id": HalliGalliGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "current_turn": state.get("current_turn"),
            "players": players_view,
            "fruit_totals": totals,
            "bell_fruits": bell_fruits,
            "bell_ready": bool(bell_fruits),
            "legal_actions": HalliGalliGame.get_legal_actions(state, viewer_id),
            "last_action": state.get("last_action"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": dict(state.get("config") or {}),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata.get("eliminated"):
            return None
        if _bell_fruits(state):
            if random.random() < 0.7:
                return {"type": "ring"}
        if bot_id == state.get("current_turn") and pdata["hand"]:
            return {"type": "flip"}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
