import random
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "target_wins": 2,
}

CARD_ROSE = "rose"
CARD_SKULL = "skull"


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        for key, value in config.items():
            cfg[key] = value
    return cfg


def _active_player_ids(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if not state["players"][pid]["eliminated"]]


def _total_pile_count(state: Dict) -> int:
    return sum(len(state["players"][pid]["pile"]) for pid in _active_player_ids(state))


def _all_have_played(state: Dict) -> bool:
    for pid in _active_player_ids(state):
        if len(state["players"][pid]["pile"]) == 0:
            return False
    return True


def _advance_turn(state: Dict) -> None:
    order = _active_player_ids(state)
    if not order:
        state["current_turn"] = None
        return
    current = state["current_turn"]
    if current not in order:
        state["current_turn"] = order[0]
        return
    idx = order.index(current)
    state["current_turn"] = order[(idx + 1) % len(order)]


def _next_bidding_player(state: Dict, current_pid: str) -> Optional[str]:
    order = _active_player_ids(state)
    passed = set(state["passed"])
    if len(order) - len(passed) <= 1:
        return None
    if current_pid not in order:
        for pid in order:
            if pid not in passed:
                return pid
        return None
    idx = order.index(current_pid)
    for offset in range(1, len(order) + 1):
        pid = order[(idx + offset) % len(order)]
        if pid not in passed:
            return pid
    return None


def _next_active_player(state: Dict, current_pid: str) -> Optional[str]:
    order = _active_player_ids(state)
    if not order:
        return None
    if current_pid not in order:
        return order[0]
    idx = order.index(current_pid)
    return order[(idx + 1) % len(order)]


def _remove_random_card(state: Dict, player_id: str) -> Optional[str]:
    pdata = state["players"][player_id]
    combined = pdata["hand"] + pdata["pile"]
    if not combined:
        return None
    idx = random.randrange(len(combined))
    if idx < len(pdata["hand"]):
        return pdata["hand"].pop(idx)
    idx -= len(pdata["hand"])
    return pdata["pile"].pop(idx)


def _check_elimination(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    if len(pdata["hand"]) + len(pdata["pile"]) == 0:
        pdata["eliminated"] = True
        return True
    return False


def _collect_piles(state: Dict) -> None:
    for pdata in state["players"].values():
        if not pdata["pile"]:
            continue
        if pdata["eliminated"]:
            pdata["pile"] = []
            continue
        pdata["hand"].extend(pdata["pile"])
        pdata["pile"] = []


def _prune_eliminated(state: Dict) -> None:
    state["turn_order"] = [
        pid for pid in state["turn_order"] if not state["players"][pid]["eliminated"]
    ]


def _check_game_over(state: Dict) -> bool:
    target = int(state["config"]["target_wins"])
    for pid in _active_player_ids(state):
        if state["players"][pid]["rounds_won"] >= target:
            state["game_over"] = True
            state["winner"] = pid
            state["phase"] = "game_over"
            return True
    active = _active_player_ids(state)
    if len(active) <= 1:
        state["game_over"] = True
        state["winner"] = active[0] if active else None
        state["phase"] = "game_over"
        return True
    return False


def _start_next_round(state: Dict, start_player: Optional[str]) -> None:
    if not state["turn_order"]:
        state["current_turn"] = None
        return
    if start_player not in state["turn_order"]:
        start_player = state["turn_order"][0]
    state["round"] += 1
    state["phase"] = "playing"
    state["current_bid"] = None
    state["bidder"] = None
    state["passed"] = []
    state["reveal"] = None
    state["current_turn"] = start_player


class SkullGame:
    game_id = "skull"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        player_ids = [p["player_id"] for p in players]
        player_meta = {p["player_id"]: p for p in players}

        state_players = {}
        for pid in player_ids:
            state_players[pid] = {
                "hand": [CARD_ROSE, CARD_ROSE, CARD_ROSE, CARD_SKULL],
                "pile": [],
                "rounds_won": 0,
                "eliminated": False,
            }

        return {
            "players": state_players,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "phase": "playing",
            "current_bid": None,
            "bidder": None,
            "passed": [],
            "reveal": None,
            "round": 1,
            "config": cfg,
            "player_meta": player_meta,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        pdata = state["players"].get(player_id)
        if not pdata or pdata["eliminated"]:
            return []

        phase = state["phase"]
        if phase == "playing":
            if player_id != state["current_turn"]:
                return []
            actions = []
            if pdata["hand"]:
                actions.append("play_card")
            if _all_have_played(state) and _total_pile_count(state) > 0:
                actions.append("start_bid")
            return actions

        if phase == "bidding":
            if player_id != state["current_turn"]:
                return []
            actions = ["pass_bid"]
            if _total_pile_count(state) > int(state["current_bid"]):
                actions.append("raise_bid")
            return actions

        if phase == "reveal":
            if player_id != state["bidder"]:
                return []
            if _total_pile_count(state) <= 0:
                return []
            return ["reveal_card"]

        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata or pdata["eliminated"]:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []

        if state["phase"] == "playing":
            if player_id != state["current_turn"]:
                return [], "not your turn"

            if action_type == "play_card":
                card_type = action.get("card_type")
                if card_type not in (CARD_ROSE, CARD_SKULL):
                    return [], "invalid card_type"
                if card_type not in pdata["hand"]:
                    return [], "card not in hand"
                pdata["hand"].remove(card_type)
                pdata["pile"].append(card_type)
                events.append({"type": "skull:play_card", "payload": {"player_id": player_id}})
                _advance_turn(state)
                return events, None

            if action_type == "start_bid":
                if not _all_have_played(state):
                    return [], "all players must play before bidding"
                bid = action.get("bid")
                if not isinstance(bid, int):
                    return [], "invalid bid"
                total = _total_pile_count(state)
                if bid < 1 or bid > total:
                    return [], "bid out of range"
                state["phase"] = "bidding"
                state["current_bid"] = bid
                state["bidder"] = player_id
                state["passed"] = []
                state["current_turn"] = _next_bidding_player(state, player_id)
                events.append({"type": "skull:start_bid", "payload": {"player_id": player_id, "bid": bid}})
                return events, None

            return [], "invalid action for phase"

        if state["phase"] == "bidding":
            if player_id != state["current_turn"]:
                return [], "not your turn"

            if action_type == "pass_bid":
                if player_id not in state["passed"]:
                    state["passed"].append(player_id)
                events.append({"type": "skull:pass_bid", "payload": {"player_id": player_id}})
            elif action_type == "raise_bid":
                bid = action.get("bid")
                if not isinstance(bid, int):
                    return [], "invalid bid"
                total = _total_pile_count(state)
                if bid <= int(state["current_bid"]) or bid > total:
                    return [], "bid out of range"
                state["current_bid"] = bid
                state["bidder"] = player_id
                events.append({"type": "skull:raise_bid", "payload": {"player_id": player_id, "bid": bid}})
            else:
                return [], "invalid action for phase"

            remaining = [pid for pid in _active_player_ids(state) if pid not in state["passed"]]
            if len(remaining) <= 1:
                bidder = remaining[0] if remaining else state["bidder"]
                state["phase"] = "reveal"
                state["bidder"] = bidder
                state["current_turn"] = bidder
                state["reveal"] = {"roses_revealed": 0, "last_card": None}
                events.append(
                    {
                        "type": "skull:bid_end",
                        "payload": {"bidder": bidder, "bid": state["current_bid"]},
                    }
                )
            else:
                state["current_turn"] = _next_bidding_player(state, player_id)
            return events, None

        if state["phase"] == "reveal":
            if player_id != state["bidder"]:
                return [], "not bidder"
            if action_type != "reveal_card":
                return [], "must reveal"
            target_id = action.get("target_player_id")
            if target_id not in state["players"]:
                return [], "invalid target"
            if state["players"][target_id]["eliminated"]:
                return [], "target eliminated"
            if not state["players"][target_id]["pile"]:
                return [], "target pile empty"
            if state["players"][player_id]["pile"] and target_id != player_id:
                return [], "must reveal own pile first"

            card = state["players"][target_id]["pile"].pop()
            reveal = state.get("reveal") or {"roses_revealed": 0, "last_card": None}
            reveal["last_card"] = {"player_id": target_id, "card": card}
            if card == CARD_ROSE:
                reveal["roses_revealed"] = int(reveal.get("roses_revealed", 0)) + 1
            state["reveal"] = reveal
            events.append(
                {"type": "skull:reveal", "payload": {"player_id": target_id, "card": card}}
            )

            if card == CARD_SKULL:
                lost_card = _remove_random_card(state, player_id)
                eliminated = _check_elimination(state, player_id)
                summary = {
                    "result": "fail",
                    "bidder": player_id,
                    "bid": state["current_bid"],
                    "skull_owner": target_id,
                    "lost_card": lost_card,
                    "eliminated": [player_id] if eliminated else [],
                }
                state["last_round_summary"] = summary
                _collect_piles(state)
                _prune_eliminated(state)
                if _check_game_over(state):
                    return events, None
                next_player = _next_bidding_player({
                    **state,
                    "passed": [],
                }, player_id)
                _start_next_round(state, next_player)
                return events, None

            if int(reveal["roses_revealed"]) >= int(state["current_bid"]):
                state["players"][player_id]["rounds_won"] += 1
                summary = {
                    "result": "success",
                    "bidder": player_id,
                    "bid": state["current_bid"],
                    "roses_revealed": reveal["roses_revealed"],
                }
                state["last_round_summary"] = summary
                _collect_piles(state)
                _prune_eliminated(state)
                if _check_game_over(state):
                    return events, None
                _start_next_round(state, player_id)
                return events, None

            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = _active_player_ids(state)
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": len(pdata["hand"]),
                    "pile_count": len(pdata["pile"]),
                    "rounds_won": pdata["rounds_won"],
                    "eliminated": pdata["eliminated"],
                }
            )

        reveal = state.get("reveal") or {"roses_revealed": 0, "last_card": None}

        return {
            "game_id": SkullGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "current_turn": state["current_turn"],
            "players": players_view,
            "hand": state["players"].get(viewer_id, {}).get("hand", []),
            "current_bid": state["current_bid"],
            "bidder": state["bidder"],
            "passed": state.get("passed", []),
            "roses_revealed": reveal.get("roses_revealed", 0),
            "last_reveal": reveal.get("last_card"),
            "legal_actions": SkullGame.get_legal_actions(state, viewer_id),
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "config": {"target_wins": state["config"]["target_wins"]},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata["eliminated"]:
            return None

        phase = state["phase"]
        if phase == "playing":
            if bot_id != state["current_turn"]:
                return None
            can_bid = _all_have_played(state) and _total_pile_count(state) > 0
            if can_bid and random.random() < 0.2:
                total = _total_pile_count(state)
                bid = random.randint(1, total)
                return {"type": "start_bid", "bid": bid}
            if pdata["hand"]:
                card = random.choice(pdata["hand"])
                return {"type": "play_card", "card_type": card}
            return None

        if phase == "bidding":
            if bot_id != state["current_turn"]:
                return None
            total = _total_pile_count(state)
            if total <= int(state["current_bid"]):
                return {"type": "pass_bid"}
            if random.random() < 0.4:
                return {"type": "pass_bid"}
            bid = random.randint(int(state["current_bid"]) + 1, total)
            return {"type": "raise_bid", "bid": bid}

        if phase == "reveal":
            if bot_id != state.get("bidder"):
                return None
            own_pile = state["players"][bot_id]["pile"]
            if own_pile:
                return {"type": "reveal_card", "target_player_id": bot_id}
            candidates = [
                pid
                for pid, pdata in state["players"].items()
                if not pdata["eliminated"] and pdata["pile"]
            ]
            if not candidates:
                return None
            target = random.choice(candidates)
            return {"type": "reveal_card", "target_player_id": target}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
