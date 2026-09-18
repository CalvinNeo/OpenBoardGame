import copy
import hashlib
import random
import secrets
from typing import Dict, List, Optional, Tuple


EEL_COUNT = 51
SNAKE_COUNT = 17
TOTAL_TOKENS = EEL_COUNT + SNAKE_COUNT
WINNING_SCORE = 20
OUTBREAK_THRESHOLDS = {2: 6, 3: 7, 4: 9, 5: 11, 6: 13, 7: 15, 8: 17}


def _new_private_seed() -> str:
    return secrets.token_hex(32)


def _token_kind(token_id: str) -> str:
    return "snake" if token_id.startswith("snake-") else "eel"


def _all_tokens() -> List[str]:
    return [f"eel-{index:03d}" for index in range(1, EEL_COUNT + 1)] + [
        f"snake-{index:03d}" for index in range(1, SNAKE_COUNT + 1)
    ]


def _shuffle_tokens(tokens: List[str], rng_seed: str, shuffle_index: int) -> List[str]:
    """Return a deterministic shuffle without exposing or mutating global RNG state."""
    digest = hashlib.sha256(f"{rng_seed}:shuffle:{shuffle_index}".encode("utf-8")).digest()
    shuffled = sorted(tokens)
    random.Random(int.from_bytes(digest, "big")).shuffle(shuffled)
    return shuffled


def _shuffle_bag(state: Dict, tokens: List[str]) -> None:
    state["shuffle_index"] = int(state.get("shuffle_index", 0)) + 1
    state["bag"] = _shuffle_tokens(tokens, state["rng_seed"], state["shuffle_index"])


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: (int(item.get("seat", 0)), str(item.get("player_id"))))


def _is_bot(state: Dict, player_id: str) -> bool:
    return bool(state.get("player_meta", {}).get(player_id, {}).get("is_bot"))


def _player_name(state: Dict, player_id: str) -> str:
    return str(state.get("player_meta", {}).get(player_id, {}).get("name") or player_id)


def _human_ids(state: Dict) -> List[str]:
    return [player_id for player_id in state["turn_order"] if not _is_bot(state, player_id)]


def _active_ids(state: Dict) -> List[str]:
    return [
        player_id
        for player_id in state["turn_order"]
        if state["players"][player_id].get("status") == "active"
    ]


def _clockwise_from(state: Dict, first_player_id: str, allowed_ids: List[str]) -> List[str]:
    order = state["turn_order"]
    allowed = set(allowed_ids)
    if not allowed:
        return []
    try:
        start = order.index(first_player_id)
    except ValueError:
        start = 0
    rotated = order[start:] + order[:start]
    result = [player_id for player_id in rotated if player_id in allowed]
    if result:
        return result
    return [player_id for player_id in order if player_id in allowed]


def _next_active_after(state: Dict, player_id: str) -> Optional[str]:
    active = set(_active_ids(state))
    if not active:
        return None
    order = state["turn_order"]
    try:
        index = order.index(player_id)
    except ValueError:
        index = -1
    for offset in range(1, len(order) + 1):
        candidate = order[(index + offset) % len(order)]
        if candidate in active:
            return candidate
    return None


def _bag_counts(tokens: List[str]) -> Dict[str, int]:
    snakes = sum(1 for token_id in tokens if _token_kind(token_id) == "snake")
    return {"total": len(tokens), "eels": len(tokens) - snakes, "snakes": snakes}


def _record(state: Dict, events: List[Dict], event_type: str, message: str, **payload: object) -> None:
    sequence = int(state.get("activity_sequence", 0)) + 1
    state["activity_sequence"] = sequence
    item = {
        "sequence": sequence,
        "type": event_type,
        "message": message,
        **copy.deepcopy(payload),
    }
    state.setdefault("activity", []).append(item)
    state["activity"] = state["activity"][-80:]
    events.append({"type": f"wriggle_roulette:{event_type}", "payload": copy.deepcopy(payload)})


def _prepare_cycle(state: Dict, requested_leader_id: str) -> None:
    active = _active_ids(state)
    if not active:
        raise AssertionError("cannot prepare a cycle without active players")
    if requested_leader_id not in active:
        requested_leader_id = _next_active_after(state, requested_leader_id) or active[0]
    order = _clockwise_from(state, requested_leader_id, active)
    state["cycle_no"] = int(state.get("cycle_no", 0)) + 1
    state["cycle_order"] = order
    state["choice_index"] = 0
    state["current_player_id"] = order[0]
    state["pending_hands"] = {}
    state["pending_next_leader_id"] = None
    state["review_ready"] = []
    state["review_required"] = []
    state["last_reveal"] = None
    state["phase"] = "choosing"
    state["cycle_public_bag"] = _bag_counts(state["bag"])


def _advance_after_reveal(state: Dict) -> None:
    leader = state.get("pending_next_leader_id")
    if not isinstance(leader, str):
        raise AssertionError("next cycle leader is missing")
    _prepare_cycle(state, leader)


def _round_summary(state: Dict, reason: str, busted_ids: List[str]) -> Dict:
    return {
        "round_no": int(state["round_no"]),
        "reason": reason,
        "outbreak": reason == "outbreak",
        "outbreak_threshold": int(state["outbreak_threshold"]),
        "busted_ids": list(busted_ids),
        "next_start_player_id": state.get("next_round_start_player_id"),
        "players": [
            {
                "player_id": player_id,
                "round_points": int(state["players"][player_id].get("round_bank_delta", 0)),
                "total_score": int(state["players"][player_id].get("score", 0)),
                "exit_wave": state["players"][player_id].get("exit_wave"),
                "busted": bool(state["players"][player_id].get("busted")),
            }
            for player_id in state["turn_order"]
        ],
    }


def _collect_all_tokens(state: Dict) -> List[str]:
    tokens = list(state.get("bag", []))
    tokens.extend(state.get("center_snakes", []))
    for player_id in state["turn_order"]:
        tokens.extend(state["players"][player_id].get("round_eels", []))
    for hand in state.get("pending_hands", {}).values():
        tokens.extend(hand.get("token_ids", []))
    if len(tokens) != TOTAL_TOKENS or len(set(tokens)) != TOTAL_TOKENS or set(tokens) != set(_all_tokens()):
        raise AssertionError("eel and snake pieces are not conserved")
    return tokens


def _finish_round(state: Dict, reason: str, busted_ids: List[str], events: List[Dict]) -> None:
    for player_id in state["turn_order"]:
        player = state["players"][player_id]
        if player.get("status") == "active":
            player["status"] = "round_done"
            if player.get("exit_wave") is None:
                player["exit_wave"] = int(state["cycle_no"])

    state["round_summary"] = _round_summary(state, reason, busted_ids)
    tokens = _collect_all_tokens(state)
    state["center_snakes"] = []
    state["pending_hands"] = {}
    for player_id in state["turn_order"]:
        state["players"][player_id]["round_eels"] = []
    _shuffle_bag(state, tokens)
    state["current_player_id"] = None
    state["cycle_order"] = []
    state["choice_index"] = 0
    state["pending_next_leader_id"] = None

    _record(
        state,
        events,
        "round_end",
        f"Round {state['round_no']} ended: {'snake outbreak' if reason == 'outbreak' else 'everyone banked' }.",
        round_no=state["round_no"],
        reason=reason,
        busted_ids=list(busted_ids),
    )

    if any(int(state["players"][player_id]["score"]) >= WINNING_SCORE for player_id in state["turn_order"]):
        highest_score = max(int(state["players"][player_id]["score"]) for player_id in state["turn_order"])
        finalists = [
            player_id
            for player_id in state["turn_order"]
            if int(state["players"][player_id]["score"]) == highest_score
        ]
        latest_exit = max(int(state["players"][player_id].get("exit_wave") or 0) for player_id in finalists)
        state["winner_ids"] = [
            player_id
            for player_id in finalists
            if int(state["players"][player_id].get("exit_wave") or 0) == latest_exit
        ]
        state["game_over"] = True
        state["phase"] = "game_over"
        state["review_required"] = _human_ids(state)
        state["review_ready"] = [
            player_id for player_id in state["turn_order"] if _is_bot(state, player_id)
        ]
        state["rematch_ready"] = list(state["review_ready"])
        _record(
            state,
            events,
            "game_over",
            "The highest haul wins.",
            winner_ids=list(state["winner_ids"]),
            winning_score=highest_score,
        )
        return

    state["phase"] = "round_review"
    state["review_required"] = _human_ids(state)
    state["review_ready"] = [
        player_id for player_id in state["turn_order"] if _is_bot(state, player_id)
    ]
    if not state["review_required"]:
        _start_next_round(state)


def _resolve_cycle(state: Dict, events: List[Dict]) -> None:
    participants = list(state["cycle_order"])
    hands = state["pending_hands"]
    last_actor_id = participants[-1]
    state["next_round_start_player_id"] = last_actor_id
    result_rows = []
    hand_snakes = 0
    for player_id in participants:
        tokens = list(hands[player_id]["token_ids"])
        eels = sum(1 for token_id in tokens if _token_kind(token_id) == "eel")
        snakes = len(tokens) - eels
        hand_snakes += snakes
        result_rows.append(
            {
                "player_id": player_id,
                "actual_count": len(tokens),
                "eels": eels,
                "snakes": snakes,
                "withdrew": len(tokens) == 0,
                "busted": False,
                "banked": 0,
            }
        )

    outbreak_snakes = len(state["center_snakes"]) + hand_snakes
    outbreak = outbreak_snakes >= int(state["outbreak_threshold"])
    if outbreak:
        largest_hand = max(row["actual_count"] for row in result_rows)
        busted_ids = [row["player_id"] for row in result_rows if row["actual_count"] == largest_hand]
        for row in result_rows:
            player_id = row["player_id"]
            player = state["players"][player_id]
            player["status"] = "round_done"
            player["exit_wave"] = int(state["cycle_no"])
            if player_id in busted_ids:
                player["busted"] = True
                row["busted"] = True
                continue
            banked = len(player["round_eels"]) + int(row["eels"])
            player["score"] += banked
            player["round_bank_delta"] += banked
            row["banked"] = banked
        state["last_reveal"] = {
            "round_no": int(state["round_no"]),
            "cycle_no": int(state["cycle_no"]),
            "outcome": "outbreak",
            "center_snakes_before": len(state["center_snakes"]),
            "center_snakes_after": outbreak_snakes,
            "outbreak_threshold": int(state["outbreak_threshold"]),
            "results": result_rows,
        }
        _record(
            state,
            events,
            "reveal",
            f"The reveal reached {outbreak_snakes} snakes and caused an outbreak.",
            round_no=state["round_no"],
            cycle_no=state["cycle_no"],
            outbreak=True,
            results=copy.deepcopy(result_rows),
        )
        _finish_round(state, "outbreak", busted_ids, events)
        return

    returned_eels: List[str] = []
    for row in result_rows:
        player_id = row["player_id"]
        player = state["players"][player_id]
        tokens = list(hands[player_id]["token_ids"])
        if not tokens:
            banked = len(player["round_eels"])
            player["score"] += banked
            player["round_bank_delta"] += banked
            returned_eels.extend(player["round_eels"])
            player["round_eels"] = []
            player["status"] = "withdrawn"
            player["exit_wave"] = int(state["cycle_no"])
            row["banked"] = banked
            continue
        for token_id in tokens:
            if _token_kind(token_id) == "eel":
                player["round_eels"].append(token_id)
            else:
                state["center_snakes"].append(token_id)

    state["pending_hands"] = {}
    if returned_eels:
        _shuffle_bag(state, list(state["bag"]) + returned_eels)
    state["last_reveal"] = {
        "round_no": int(state["round_no"]),
        "cycle_no": int(state["cycle_no"]),
        "outcome": "continue" if _active_ids(state) else "all_withdrew",
        "center_snakes_before": outbreak_snakes - hand_snakes,
        "center_snakes_after": len(state["center_snakes"]),
        "outbreak_threshold": int(state["outbreak_threshold"]),
        "results": result_rows,
    }
    _record(
        state,
        events,
        "reveal",
        "Everyone revealed their haul.",
        round_no=state["round_no"],
        cycle_no=state["cycle_no"],
        outbreak=False,
        results=copy.deepcopy(result_rows),
    )

    if not _active_ids(state):
        _finish_round(state, "all_withdrew", [], events)
        return

    next_leader = last_actor_id if last_actor_id in _active_ids(state) else _next_active_after(state, last_actor_id)
    if next_leader is None:
        raise AssertionError("next cycle leader is missing")
    state["pending_next_leader_id"] = next_leader
    state["phase"] = "reveal_review"
    state["current_player_id"] = None
    required = [player_id for player_id in _active_ids(state) if not _is_bot(state, player_id)]
    state["review_required"] = required
    state["review_ready"] = [player_id for player_id in _active_ids(state) if _is_bot(state, player_id)]
    if not required:
        _advance_after_reveal(state)


def _start_next_round(state: Dict) -> None:
    state["round_no"] = int(state["round_no"]) + 1
    state["round_start_player_id"] = state["next_round_start_player_id"]
    state["round_summary"] = None
    state["last_reveal"] = None
    state["review_ready"] = []
    state["review_required"] = []
    state["rematch_ready"] = []
    for player_id in state["turn_order"]:
        state["players"][player_id].update(
            {
                "round_eels": [],
                "round_bank_delta": 0,
                "status": "active",
                "exit_wave": None,
                "busted": False,
            }
        )
    _prepare_cycle(state, state["round_start_player_id"])


def _initial_state(players: List[Dict], game_index: int = 1) -> Dict:
    ordered = _ordered_players(players)
    if not (2 <= len(ordered) <= 8):
        raise ValueError("Wriggle Roulette requires 2 to 8 players")
    player_ids = [str(player.get("player_id")) for player in ordered]
    if any(not player_id or player_id == "None" for player_id in player_ids):
        raise ValueError("every Wriggle Roulette player needs an ID")
    if len(player_ids) != len(set(player_ids)):
        raise ValueError("Wriggle Roulette player IDs must be unique")

    seed = _new_private_seed()
    start_digest = hashlib.sha256(f"{seed}:starting-player".encode("utf-8")).digest()
    start_player_id = player_ids[int.from_bytes(start_digest, "big") % len(player_ids)]
    state = {
        "version": 1,
        "game_id": "wriggle_roulette",
        "game_index": int(game_index),
        "config": {},
        "rng_seed": seed,
        "shuffle_index": 0,
        "turn_order": player_ids,
        "player_meta": {str(player["player_id"]): copy.deepcopy(player) for player in ordered},
        "players": {
            player_id: {
                "score": 0,
                "round_eels": [],
                "round_bank_delta": 0,
                "status": "active",
                "exit_wave": None,
                "busted": False,
            }
            for player_id in player_ids
        },
        "outbreak_threshold": OUTBREAK_THRESHOLDS[len(player_ids)],
        "round_no": 1,
        "cycle_no": 0,
        "round_start_player_id": start_player_id,
        "next_round_start_player_id": start_player_id,
        "phase": "choosing",
        "current_player_id": None,
        "cycle_order": [],
        "choice_index": 0,
        "pending_hands": {},
        "pending_next_leader_id": None,
        "center_snakes": [],
        "cycle_public_bag": {"total": TOTAL_TOKENS, "eels": EEL_COUNT, "snakes": SNAKE_COUNT},
        "last_reveal": None,
        "round_summary": None,
        "review_ready": [],
        "review_required": [],
        "rematch_ready": [],
        "game_over": False,
        "winner_ids": [],
        "activity": [],
        "activity_sequence": 0,
    }
    _shuffle_bag(state, _all_tokens())
    _prepare_cycle(state, start_player_id)
    _assert_state(state)
    return state


def _assert_state(state: Dict) -> None:
    if state.get("game_id") != "wriggle_roulette":
        raise AssertionError("wrong game ID")
    order = state.get("turn_order", [])
    if not (2 <= len(order) <= 8) or len(order) != len(set(order)):
        raise AssertionError("invalid player order")
    if state.get("phase") not in {"choosing", "reveal_review", "round_review", "game_over"}:
        raise AssertionError("invalid phase")
    if not isinstance(state.get("rng_seed"), str) or not state["rng_seed"]:
        raise AssertionError("private random seed is missing")
    if int(state.get("outbreak_threshold", 0)) != OUTBREAK_THRESHOLDS[len(order)]:
        raise AssertionError("invalid outbreak threshold")
    tokens = list(state.get("bag", [])) + list(state.get("center_snakes", []))
    for player_id in order:
        player = state.get("players", {}).get(player_id)
        if not isinstance(player, dict):
            raise AssertionError("player state is missing")
        if int(player.get("score", -1)) < 0:
            raise AssertionError("scores cannot be negative")
        tokens.extend(player.get("round_eels", []))
    for hand in state.get("pending_hands", {}).values():
        tokens.extend(hand.get("token_ids", []))
    if len(tokens) != TOTAL_TOKENS or len(set(tokens)) != TOTAL_TOKENS or set(tokens) != set(_all_tokens()):
        raise AssertionError("eel and snake pieces are not conserved")
    if any(_token_kind(token_id) != "snake" for token_id in state.get("center_snakes", [])):
        raise AssertionError("only snakes may be in the center")
    if any(
        _token_kind(token_id) != "eel"
        for player_id in order
        for token_id in state["players"][player_id].get("round_eels", [])
    ):
        raise AssertionError("only eels may be held between cycles")
    if state.get("phase") == "choosing":
        cycle_order = state.get("cycle_order", [])
        index = int(state.get("choice_index", -1))
        if not cycle_order or not (0 <= index < len(cycle_order)):
            raise AssertionError("invalid choosing cursor")
        if state.get("current_player_id") != cycle_order[index]:
            raise AssertionError("choosing cursor does not match current player")


class WriggleRouletteGame:
    game_id = "wriggle_roulette"
    min_players = 2
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        del config
        return _initial_state(players)

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "choosing":
            return ["grab"] if state.get("current_player_id") == player_id else []
        if phase == "reveal_review":
            if player_id in state.get("review_required", []) and player_id not in state.get("review_ready", []):
                return ["ready_reveal"]
            return []
        if phase == "round_review":
            if player_id in state.get("review_required", []) and player_id not in state.get("review_ready", []):
                return ["next_round"]
            return []
        if phase == "game_over":
            if player_id in _human_ids(state) and player_id not in state.get("rematch_ready", []):
                return ["play_again"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            return [], "invalid action"
        action_type = action["type"]
        if action_type not in WriggleRouletteGame.get_legal_actions(state, player_id):
            return [], "action is not legal now"
        events: List[Dict] = []

        if action_type == "grab":
            cycle_no = action.get("cycle_no")
            count = action.get("count")
            maximum = 6 if len(state["turn_order"]) == 2 else 4
            if isinstance(cycle_no, bool) or not isinstance(cycle_no, int) or cycle_no != state.get("cycle_no"):
                return [], "that grab belongs to an old cycle"
            if isinstance(count, bool) or not isinstance(count, int) or not (0 <= count <= maximum):
                return [], f"choose between 0 and {maximum} pieces"
            actual = min(count, len(state["bag"]))
            tokens = [state["bag"].pop() for _ in range(actual)]
            state["pending_hands"][player_id] = {"requested_count": count, "token_ids": tokens}
            _record(
                state,
                events,
                "grab_locked",
                f"{_player_name(state, player_id)} locked a grab.",
                player_id=player_id,
                cycle_no=state["cycle_no"],
            )
            state["choice_index"] += 1
            if state["choice_index"] >= len(state["cycle_order"]):
                _resolve_cycle(state, events)
            else:
                state["current_player_id"] = state["cycle_order"][state["choice_index"]]

        elif action_type == "ready_reveal":
            cycle_no = action.get("cycle_no")
            if isinstance(cycle_no, bool) or not isinstance(cycle_no, int) or cycle_no != state.get("cycle_no"):
                return [], "that confirmation belongs to an old cycle"
            state["review_ready"].append(player_id)
            _record(
                state,
                events,
                "reveal_ready",
                f"{_player_name(state, player_id)} finished reviewing the reveal.",
                player_id=player_id,
                cycle_no=state["cycle_no"],
            )
            if set(state["review_ready"]) >= set(state["review_required"]):
                _advance_after_reveal(state)

        elif action_type == "next_round":
            round_no = action.get("round_no")
            if isinstance(round_no, bool) or not isinstance(round_no, int) or round_no != state.get("round_no"):
                return [], "that confirmation belongs to an old round"
            state["review_ready"].append(player_id)
            _record(
                state,
                events,
                "round_ready",
                f"{_player_name(state, player_id)} is ready for the next round.",
                player_id=player_id,
                round_no=state["round_no"],
            )
            if set(state["review_ready"]) >= set(state["review_required"]):
                _start_next_round(state)

        elif action_type == "play_again":
            state["rematch_ready"].append(player_id)
            _record(
                state,
                events,
                "rematch_ready",
                f"{_player_name(state, player_id)} is ready to play again.",
                player_id=player_id,
            )
            if set(state["rematch_ready"]) >= set(state["turn_order"]):
                players = [copy.deepcopy(state["player_meta"][pid]) for pid in state["turn_order"]]
                game_index = int(state.get("game_index", 1)) + 1
                fresh = _initial_state(players, game_index=game_index)
                state.clear()
                state.update(fresh)
                _record(
                    state,
                    events,
                    "game_started",
                    f"Game {game_index} started.",
                    game_index=game_index,
                )

        _assert_state(state)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        phase = state.get("phase")
        if phase == "choosing":
            bag_counts = copy.deepcopy(state.get("cycle_public_bag", {}))
            bag_hidden = True
        else:
            bag_counts = _bag_counts(state.get("bag", []))
            bag_hidden = False
        pending = state.get("pending_hands", {}).get(viewer_id)
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            meta = state["player_meta"].get(player_id, {})
            players.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name") or player_id,
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "score": int(player.get("score", 0)),
                    "round_eels": len(player.get("round_eels", [])),
                    "round_points": int(player.get("round_bank_delta", 0)),
                    "status": player.get("status"),
                    "exit_wave": player.get("exit_wave"),
                    "busted": bool(player.get("busted")),
                    "locked": player_id in state.get("pending_hands", {}),
                    "ready": player_id in state.get("review_ready", []),
                    "rematch_ready": player_id in state.get("rematch_ready", []),
                }
            )
        maximum = 6 if len(state["turn_order"]) == 2 else 4
        return {
            "game_id": WriggleRouletteGame.game_id,
            "you": viewer_id,
            "game_index": int(state.get("game_index", 1)),
            "round_no": int(state.get("round_no", 1)),
            "cycle_no": int(state.get("cycle_no", 1)),
            "phase": phase,
            "current_player_id": state.get("current_player_id"),
            "round_start_player_id": state.get("round_start_player_id"),
            "outbreak_threshold": int(state.get("outbreak_threshold", 0)),
            "center_snakes": len(state.get("center_snakes", [])),
            "bag_count": int(bag_counts.get("total", 0)),
            "bag_eels": int(bag_counts.get("eels", 0)),
            "bag_snakes": int(bag_counts.get("snakes", 0)),
            "bag_hidden_during_choices": bag_hidden,
            "grab_max": maximum,
            "your_pending_count": pending.get("requested_count") if pending else None,
            "players": players,
            "last_reveal": copy.deepcopy(state.get("last_reveal")),
            "round_summary": copy.deepcopy(state.get("round_summary")),
            "review_ready": list(state.get("review_ready", [])),
            "review_required": list(state.get("review_required", [])),
            "review_progress": {
                "done": len(set(state.get("review_ready", [])) & set(state.get("review_required", []))),
                "total": len(state.get("review_required", [])),
            },
            "game_over": bool(state.get("game_over")),
            "winner_ids": list(state.get("winner_ids", [])),
            "winning_score": WINNING_SCORE,
            "legal_actions": WriggleRouletteGame.get_legal_actions(state, viewer_id),
            "activity": copy.deepcopy(state.get("activity", [])),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if "grab" not in WriggleRouletteGame.get_legal_actions(state, bot_id):
            return None
        player = state["players"][bot_id]
        saved = len(player.get("round_eels", []))
        center = len(state.get("center_snakes", []))
        threshold = int(state.get("outbreak_threshold", 1))
        remaining_danger = threshold - center
        maximum = 6 if len(state["turn_order"]) == 2 else 4
        public_bag = state.get("cycle_public_bag", {})
        total = max(1, int(public_bag.get("total", 0)))
        snake_ratio = int(public_bag.get("snakes", 0)) / total
        if saved >= 5 or (saved >= 3 and remaining_danger <= 2):
            count = 0
        elif remaining_danger <= 1:
            count = 1
        elif snake_ratio >= 0.34:
            count = min(2, maximum)
        elif saved == 0:
            count = min(4, maximum)
        else:
            count = min(3, maximum)
        return {"type": "grab", "count": count, "cycle_no": state["cycle_no"], "delay_ms": 450}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict):
            raise ValueError("invalid Wriggle Roulette save payload")
        state = copy.deepcopy(payload)
        try:
            _assert_state(state)
        except (AssertionError, KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"invalid Wriggle Roulette save payload: {exc}") from exc
        return state
