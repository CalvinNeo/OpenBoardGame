import random
from typing import Dict, List, Optional, Tuple


TILE_SPECS = [
    {"id": "2", "label": "2", "value": 2},
    {"id": "3", "label": "3", "value": 3},
    {"id": "4", "label": "4", "value": 4},
    {"id": "5", "label": "5", "value": 5},
    {"id": "6", "label": "6", "value": 6},
    {"id": "7", "label": "7", "value": 7},
    {"id": "8", "label": "8", "value": 8},
    {"id": "x1", "label": "X", "value": None},
    {"id": "x2", "label": "X", "value": None},
]


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: item.get("seat", 0))


def _build_tiles() -> List[Dict]:
    tiles = [dict(spec) for spec in TILE_SPECS]
    random.shuffle(tiles)
    return tiles


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name") or player_id


def _next_player_id(turn_order: List[str], player_id: str) -> Optional[str]:
    if player_id not in turn_order:
        return turn_order[0] if turn_order else None
    idx = turn_order.index(player_id)
    return turn_order[(idx + 1) % len(turn_order)]


def _previous_player_id(turn_order: List[str], player_id: str) -> Optional[str]:
    if player_id not in turn_order:
        return turn_order[0] if turn_order else None
    idx = turn_order.index(player_id)
    return turn_order[(idx - 1) % len(turn_order)]


def _valid_suspect_indexes(indexes: object) -> Optional[List[int]]:
    if not isinstance(indexes, list) or len(indexes) != 2:
        return None
    parsed: List[int] = []
    for value in indexes:
        if not isinstance(value, int) or value < 0 or value > 2:
            return None
        parsed.append(value)
    if len(set(parsed)) != 2:
        return None
    return parsed


def _determine_murderer_index(suspects: List[Dict]) -> int:
    numeric = []
    for index, tile in enumerate(suspects):
        value = tile.get("value")
        if isinstance(value, int):
            numeric.append((index, value))
    if not numeric:
        raise ValueError("at least one numeric suspect is required")
    if any(value == 5 for _, value in numeric):
        return min(numeric, key=lambda item: item[1])[0]
    return max(numeric, key=lambda item: item[1])[0]


def _pick_next_first_player(state: Dict, penalty_gains: Dict[str, int]) -> str:
    turn_order = list(state["turn_order"])
    current_first = state["first_player"]
    max_gain = max((int(penalty_gains.get(pid, 0)) for pid in turn_order), default=0)
    tied = {pid for pid in turn_order if int(penalty_gains.get(pid, 0)) == max_gain}
    start_idx = turn_order.index(current_first) if current_first in turn_order else -1
    for offset in range(len(turn_order)):
        pid = turn_order[(start_idx + offset + 1) % len(turn_order)]
        if pid in tied:
            return pid
    return current_first


def _final_ranking(state: Dict) -> List[Dict]:
    ranked_ids = sorted(
        state["turn_order"],
        key=lambda pid: (
            int(state["players"][pid]["penalty_count"]),
            state["player_meta"][pid].get("seat", 0),
        ),
    )
    return [
        {
            "player_id": pid,
            "penalty_count": int(state["players"][pid]["penalty_count"]),
        }
        for pid in ranked_ids
    ]


def _finish_game(state: Dict) -> None:
    ranking = _final_ranking(state)
    min_penalty = ranking[0]["penalty_count"] if ranking else 0
    winners = [entry["player_id"] for entry in ranking if entry["penalty_count"] == min_penalty]
    state["phase"] = "game_over"
    state["game_over"] = True
    state["winner_ids"] = winners
    state["final_ranking"] = ranking
    state["current_turn"] = None
    state["pending_next_first_player"] = None


def _build_round_summary(state: Dict, murderer_index: int, penalty_gains: Dict[str, int]) -> Dict:
    suspects = state["suspects"]
    suspect_summaries = []
    for index, suspect in enumerate(suspects):
        stack = list(suspect.get("stack", []))
        receiver = stack[-1] if index != murderer_index and stack else None
        suspect_summaries.append(
            {
                "index": index,
                "label": suspect["tile"]["label"],
                "is_murderer": index == murderer_index,
                "stack": stack,
                "penalty_receiver": receiver,
                "penalty_count": len(stack) if receiver else 0,
            }
        )

    return {
        "round": state["round"],
        "first_player": state["first_player"],
        "murderer_index": murderer_index,
        "murderer_label": suspects[murderer_index]["tile"]["label"],
        "suspects": suspect_summaries,
        "victim_label": state["victim"]["label"],
        "penalty_gains": dict(penalty_gains),
        "hand_counts": {
            pid: int(state["players"][pid]["hand_count"]) for pid in state["turn_order"]
        },
        "penalty_counts": {
            pid: int(state["players"][pid]["penalty_count"]) for pid in state["turn_order"]
        },
    }


def _deal_round(state: Dict, first_player: str) -> None:
    player_ids = list(state["turn_order"])
    tiles = _build_tiles()
    dealt: Dict[str, Dict] = {}
    for player_id in player_ids:
        dealt[player_id] = tiles.pop()

    public_alibi = tiles.pop() if len(player_ids) == 2 else None
    suspects = [{"tile": tiles.pop(), "stack": []} for _ in range(3)]
    victim = tiles.pop()
    removed_tiles = list(tiles)

    for player_id in player_ids:
        left_player = _previous_player_id(player_ids, player_id)
        state["players"][player_id]["own_tile"] = dict(dealt[player_id])
        state["players"][player_id]["passed_tile"] = dict(dealt[left_player]) if left_player else None
        state["players"][player_id]["round_ready"] = False

    state["round"] = int(state.get("round", 0)) + 1
    state["phase"] = "peek"
    state["first_player"] = first_player
    state["current_turn"] = first_player
    state["blocked_suspect_index"] = None
    state["public_alibi"] = public_alibi
    state["suspects"] = suspects
    state["victim"] = victim
    state["removed_tiles"] = removed_tiles
    state["turn_context"] = {
        "viewed_indexes": [],
        "can_swap": True,
        "acted_count": 0,
    }
    state["pending_next_first_player"] = None
    state["pending_game_over"] = False


def _advance_after_bet(state: Dict) -> None:
    turn_order = state["turn_order"]
    acted_count = int(state["turn_context"].get("acted_count", 0))
    if acted_count >= len(turn_order) - 1:
        murderer_index = _determine_murderer_index([entry["tile"] for entry in state["suspects"]])
        penalty_gains = {pid: 0 for pid in turn_order}
        for index, suspect in enumerate(state["suspects"]):
            stack = list(suspect.get("stack", []))
            if index == murderer_index or not stack:
                continue
            receiver = stack[-1]
            gain = len(stack)
            state["players"][receiver]["penalty_count"] += gain
            penalty_gains[receiver] += gain

        state["last_round_summary"] = _build_round_summary(state, murderer_index, penalty_gains)

        hand_zero = [
            pid for pid in turn_order if int(state["players"][pid]["hand_count"]) <= 0
        ]
        penalty_over = [
            pid for pid in turn_order if int(state["players"][pid]["penalty_count"]) >= 8
        ]
        next_first = _pick_next_first_player(state, penalty_gains)
        state["phase"] = "round_end"
        state["current_turn"] = None
        state["pending_next_first_player"] = next_first
        state["pending_game_over"] = bool(hand_zero or penalty_over)
        for pid in turn_order:
            state["players"][pid]["round_ready"] = False
        return

    next_player = _next_player_id(turn_order, state.get("current_turn"))
    state["phase"] = "peek"
    state["current_turn"] = next_player
    state["turn_context"] = {
        "viewed_indexes": [],
        "can_swap": False,
        "acted_count": acted_count + 1,
    }


class InAGroveGame:
    game_id = "in_a_grove"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered_players = _ordered_players(players)
        player_ids = [player["player_id"] for player in ordered_players]
        player_meta = {player["player_id"]: dict(player) for player in ordered_players}
        state_players = {
            player_id: {
                "hand_count": 7,
                "penalty_count": 0,
                "own_tile": None,
                "passed_tile": None,
                "round_ready": False,
            }
            for player_id in player_ids
        }
        first_player = random.choice(player_ids)
        state = {
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "round": 0,
            "phase": "peek",
            "first_player": first_player,
            "current_turn": first_player,
            "blocked_suspect_index": None,
            "suspects": [],
            "victim": None,
            "public_alibi": None,
            "removed_tiles": [],
            "turn_context": {"viewed_indexes": [], "can_swap": True, "actor_index": 0},
            "last_round_summary": None,
            "game_over": False,
            "winner_ids": [],
            "final_ranking": [],
            "pending_next_first_player": None,
            "pending_game_over": False,
        }
        _deal_round(state, first_player)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        phase = state.get("phase")
        if phase == "round_end":
            pdata = state["players"].get(player_id)
            if not pdata or pdata.get("round_ready"):
                return []
            return ["next_round"]
        if player_id != state.get("current_turn"):
            return []
        if phase == "peek":
            return ["peek_suspects"]
        if phase == "swap_or_bet":
            return ["swap_with_victim", "skip_swap"]
        if phase == "bet":
            return ["place_bet"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        events: List[Dict] = []
        phase = state.get("phase")
        if phase == "round_end":
            if action.get("type") != "next_round":
                return [], "round ended"
            pdata = state["players"].get(player_id)
            if not pdata:
                return [], "unknown player"
            if pdata.get("round_ready"):
                return [], "already ready"
            pdata["round_ready"] = True
            if all(state["players"][pid].get("round_ready") for pid in state["turn_order"]):
                if state.get("pending_game_over"):
                    _finish_game(state)
                    events.append({"type": "in_a_grove:game_over", "payload": {"round": state.get("round")}})
                else:
                    next_first = state.get("pending_next_first_player") or state["first_player"]
                    _deal_round(state, next_first)
                    events.append({"type": "in_a_grove:next_round", "payload": {"round": state["round"]}})
            return events, None
        if player_id != state.get("current_turn"):
            return [], "not your turn"

        action_type = action.get("type")

        if action_type == "peek_suspects":
            if phase != "peek":
                return [], "cannot peek now"
            indexes = _valid_suspect_indexes(action.get("suspect_indexes"))
            if indexes is None:
                return [], "select exactly 2 suspects"
            blocked = state.get("blocked_suspect_index")
            if blocked is not None and blocked in indexes:
                return [], "cannot inspect blocked suspect"
            state["turn_context"]["viewed_indexes"] = indexes
            is_first_player = player_id == state.get("first_player")
            if is_first_player:
                state["phase"] = "swap_or_bet"
                state["turn_context"]["can_swap"] = True
            else:
                state["phase"] = "bet"
                state["turn_context"]["can_swap"] = False
            events.append({"type": "in_a_grove:peek", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "swap_with_victim":
            if phase != "swap_or_bet":
                return [], "cannot swap now"
            suspect_index = action.get("suspect_index")
            if not isinstance(suspect_index, int) or suspect_index not in (0, 1, 2):
                return [], "invalid suspect"
            viewed = list(state["turn_context"].get("viewed_indexes", []))
            if suspect_index not in viewed:
                return [], "can only swap a viewed suspect"
            state["suspects"][suspect_index]["tile"], state["victim"] = (
                state["victim"],
                state["suspects"][suspect_index]["tile"],
            )
            state["turn_context"]["viewed_indexes"] = [
                index for index in viewed if index != suspect_index
            ]
            state["turn_context"]["can_swap"] = False
            state["phase"] = "bet"
            events.append(
                {
                    "type": "in_a_grove:swap",
                    "payload": {"player_id": player_id, "suspect_index": suspect_index},
                }
            )
            return events, None

        if action_type == "skip_swap":
            if phase != "swap_or_bet":
                return [], "cannot skip now"
            state["turn_context"]["can_swap"] = False
            state["phase"] = "bet"
            events.append({"type": "in_a_grove:skip_swap", "payload": {"player_id": player_id}})
            return events, None

        if action_type == "place_bet":
            if phase != "bet":
                return [], "cannot bet now"
            suspect_index = action.get("suspect_index")
            if not isinstance(suspect_index, int) or suspect_index not in (0, 1, 2):
                return [], "invalid suspect"
            if int(state["players"][player_id]["hand_count"]) <= 0:
                return [], "no accusation chips left"
            state["players"][player_id]["hand_count"] -= 1
            state["suspects"][suspect_index]["stack"].append(player_id)
            state["blocked_suspect_index"] = suspect_index
            events.append(
                {
                    "type": "in_a_grove:bet",
                    "payload": {"player_id": player_id, "suspect_index": suspect_index},
                }
            )
            _advance_after_bet(state)
            if state.get("last_round_summary"):
                events.append({"type": "in_a_grove:reveal", "payload": {"round": state["last_round_summary"]["round"]}})
            return events, None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for player_id in state["turn_order"]:
            meta = state["player_meta"][player_id]
            pdata = state["players"][player_id]
            players.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "hand_count": pdata["hand_count"],
                    "penalty_count": pdata["penalty_count"],
                    "round_ready": bool(pdata.get("round_ready")),
                }
            )

        viewed_indexes = []
        if viewer_id == state.get("current_turn"):
            viewed_indexes = list(state.get("turn_context", {}).get("viewed_indexes", []))

        suspects_view = []
        summary = state.get("last_round_summary")
        summary_by_index = {}
        if isinstance(summary, dict):
            for entry in summary.get("suspects", []):
                summary_by_index[entry["index"]] = entry

        for index, suspect in enumerate(state.get("suspects", [])):
            visible_label = None
            if state.get("game_over") or state.get("phase") == "round_end":
                visible_label = suspect["tile"]["label"]
            elif index in viewed_indexes:
                visible_label = suspect["tile"]["label"]
            suspects_view.append(
                {
                    "index": index,
                    "label": visible_label,
                    "stack": list(suspect.get("stack", [])),
                    "blocked": state.get("blocked_suspect_index") == index,
                    "last_round": summary_by_index.get(index),
                }
            )

        your_tiles = []
        own_tile = state["players"][viewer_id].get("own_tile")
        passed_tile = state["players"][viewer_id].get("passed_tile")
        if own_tile:
            your_tiles.append({"source": "your tile", "label": own_tile["label"]})
        if passed_tile:
            your_tiles.append({"source": "passed tile", "label": passed_tile["label"]})

        return {
            "game_id": InAGroveGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "current_turn": state["current_turn"],
            "first_player": state["first_player"],
            "blocked_suspect_index": state.get("blocked_suspect_index"),
            "players": players,
            "suspects": suspects_view,
            "victim_hidden": True,
            "public_alibi": state["public_alibi"]["label"] if state.get("public_alibi") else None,
            "your_tiles": your_tiles,
            "peeked_indexes": viewed_indexes,
            "legal_actions": InAGroveGame.get_legal_actions(state, viewer_id),
            "last_round_summary": summary,
            "winner_ids": list(state.get("winner_ids", [])),
            "final_ranking": list(state.get("final_ranking", [])),
            "game_over": bool(state.get("game_over")),
            "pending_next_first_player": state.get("pending_next_first_player"),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        legal = InAGroveGame.get_legal_actions(state, bot_id)
        if "next_round" in legal:
            return {"type": "next_round", "delay_ms": 0}
        if bot_id != state.get("current_turn"):
            return None
        if "peek_suspects" in legal:
            blocked = state.get("blocked_suspect_index")
            choices = [index for index in range(3) if index != blocked]
            if len(choices) < 2:
                return None
            random.shuffle(choices)
            return {"type": "peek_suspects", "suspect_indexes": choices[:2]}
        if "swap_with_victim" in legal or "skip_swap" in legal:
            viewed = list(state.get("turn_context", {}).get("viewed_indexes", []))
            if viewed and random.random() < 0.4:
                return {"type": "swap_with_victim", "suspect_index": random.choice(viewed)}
            return {"type": "skip_swap"}
        if "place_bet" in legal:
            return {"type": "place_bet", "suspect_index": random.randint(0, 2)}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
