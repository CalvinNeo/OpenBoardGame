from __future__ import annotations

import random
from collections import Counter
from typing import Dict, List, Optional, Tuple


SYMBOL_ORDER = [
    "bird_blue",
    "jaguar_yellow",
    "chameleon_purple",
    "snake_green",
    "human_pink",
    "bear_red",
]

DEFAULT_CONFIG: Dict = {
    "mode": "standard",
    "deadly_shortcut": False,
    "curse_of_temple": False,
}

WHEELS: List[Dict] = [
    {"id": "W1", "window_size": 1, "victory_points": 5},
    {"id": "W2", "window_size": 2, "victory_points": 4},
    {"id": "W3", "window_size": 3, "victory_points": 3},
    {"id": "W4", "window_size": 4, "victory_points": 3},
    {"id": "W5", "window_size": 5, "victory_points": 2},
    {"id": "W6", "window_size": 7, "victory_points": 2},
    {"id": "W7", "window_size": 10, "victory_points": 1},
]
WHEEL_BY_ID = {wheel["id"]: wheel for wheel in WHEELS}
MIN_WHEEL_ID = "W1"


def _normalize_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if isinstance(config, dict):
        merged.update(config)
    mode = merged.get("mode")
    if mode not in ("standard", "intro", "x_race"):
        mode = "standard"
    return {
        "mode": mode,
        "deadly_shortcut": bool(merged.get("deadly_shortcut", False)),
        "curse_of_temple": bool(merged.get("curse_of_temple", False)),
    }


def _active_symbols(mode: str) -> List[str]:
    if mode == "intro":
        return list(SYMBOL_ORDER[:-1])
    return list(SYMBOL_ORDER)


def _max_symbol_value(mode: str) -> int:
    return 8 if mode == "x_race" else 7


def _max_sum_for_mode(mode: str) -> int:
    return 24 if mode == "x_race" else 21


def _round_limit(player_count: int) -> int:
    if player_count <= 2:
        return 10
    if player_count == 3:
        return 9
    return 8


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: item.get("seat", 0))


def _build_stone(symbol: str, value: int, index: int) -> Dict:
    return {"id": f"{symbol}:{value}:{index}", "symbol": symbol, "value": int(value)}


def _build_logs_and_piles(active_symbols: List[str], max_value: int, player_ids: List[str]) -> Dict:
    logs: List[Dict] = []
    piles: Dict[str, List[Dict]] = {symbol: [] for symbol in active_symbols}
    out_of_game: Dict[str, Dict] = {}
    neutral_count = max(0, 4 - len(player_ids))

    for log_index in range(4):
        owner = player_ids[log_index] if log_index < len(player_ids) else None
        logs.append({"log_id": f"log_{log_index + 1}", "owner_player_id": owner, "slots": {}})

    for symbol in active_symbols:
        stones = [_build_stone(symbol, value, idx) for idx, value in enumerate(range(max_value + 1))]
        random.shuffle(stones)
        for log in logs:
            log["slots"][symbol] = stones.pop()
        out_of_game[symbol] = stones.pop()
        piles[symbol] = stones
        random.shuffle(piles[symbol])

    return {
        "logs": logs,
        "symbol_draw_piles": piles,
        "out_of_game_stones": out_of_game,
        "neutral_log_count": neutral_count,
    }


def _new_stack_order_map(player_ids: List[str]) -> Tuple[Dict[str, int], int]:
    shuffled = list(player_ids)
    random.shuffle(shuffled)
    order: Dict[str, int] = {}
    current = len(shuffled)
    for player_id in shuffled:
        order[player_id] = current
        current -= 1
    return order, len(shuffled) + 1


def _lagging_order(state: Dict) -> List[str]:
    player_ids = list(state["players"].keys())
    return sorted(
        player_ids,
        key=lambda pid: (
            int(state["players"][pid]["score"]),
            -int(state["players"][pid]["stack_order"]),
        ),
    )


def _leading_order(state: Dict) -> List[str]:
    player_ids = list(state["players"].keys())
    return sorted(
        player_ids,
        key=lambda pid: (
            -int(state["players"][pid]["score"]),
            int(state["players"][pid]["stack_order"]),
        ),
    )


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    meta = state.get("player_meta", {}).get(player_id, {})
    return meta.get("name") or player_id


def _log_for_player(state: Dict, player_id: str) -> Optional[Dict]:
    player_log_id = state["players"][player_id]["log_id"]
    for log in state.get("logs", []):
        if log.get("log_id") == player_log_id:
            return log
    return None


def _actual_sum_for_player(state: Dict, player_id: str, dice_symbols: List[str]) -> int:
    counts = Counter(dice_symbols)
    log = _log_for_player(state, player_id)
    if not log:
        return 0
    total = 0
    for symbol, count in counts.items():
        stone = log["slots"].get(symbol)
        if isinstance(stone, dict):
            total += int(stone.get("value", 0)) * int(count)
    return int(total)


def _set_phase(state: Dict, phase: str, actor: Optional[str]) -> None:
    state["phase"] = phase
    state["current_actor"] = actor


def _apply_score_delta(state: Dict, player_id: str, delta: int) -> None:
    if delta == 0:
        return
    pdata = state["players"][player_id]
    pdata["score"] = int(pdata["score"]) + int(delta)
    pdata["stack_order"] = int(state["next_stack_order"])
    state["next_stack_order"] = int(state["next_stack_order"]) + 1


def _round_index_to_remove_shortcuts(state: Dict) -> int:
    return int(state["max_rounds"]) - 3


def _round_index_to_force_remove_curse(state: Dict) -> int:
    return int(state["max_rounds"]) - 1


def _shortcut_deadline_passed(state: Dict) -> bool:
    return int(state.get("round", 1)) > _round_index_to_remove_shortcuts(state)


def _triggered_shortcut_symbols(state: Dict) -> List[str]:
    if not state["config"].get("deadly_shortcut"):
        return []
    if _shortcut_deadline_passed(state):
        return []
    counts = Counter(state.get("raw_dice_symbols", []))
    triggered: List[str] = []
    for symbol in state.get("active_symbols", []):
        token = state["deadly_shortcut_tokens"].get(symbol)
        if not token:
            continue
        if token.get("removed"):
            continue
        if token.get("taken_by"):
            continue
        if counts.get(symbol, 0) >= 2:
            triggered.append(symbol)
    return triggered


def _advance_shortcut_offer(state: Dict) -> None:
    offer = state.get("shortcut_offer")
    if not isinstance(offer, dict):
        _set_phase(state, "modify_die", state["round_context"]["roller_id"])
        return
    symbols = offer.get("symbols", [])
    order = offer.get("order", [])
    symbol_index = int(offer.get("symbol_index", 0))
    player_index = int(offer.get("player_index", 0)) + 1
    while symbol_index < len(symbols):
        symbol = symbols[symbol_index]
        token = state["deadly_shortcut_tokens"].get(symbol, {})
        if token.get("taken_by") or token.get("removed"):
            symbol_index += 1
            player_index = 0
            continue
        if player_index < len(order):
            offer["symbol_index"] = symbol_index
            offer["player_index"] = player_index
            _set_phase(state, "offer_shortcut_token", order[player_index])
            return
        symbol_index += 1
        player_index = 0
    state["shortcut_offer"] = None
    _set_phase(state, "modify_die", state["round_context"]["roller_id"])


def _legal_exchange_symbols(state: Dict, player_id: str) -> List[str]:
    log = _log_for_player(state, player_id)
    if not log:
        return []
    legal: List[str] = []
    for symbol in state.get("active_symbols", []):
        if symbol not in log["slots"]:
            continue
        if state["symbol_draw_piles"].get(symbol):
            legal.append(symbol)
    return legal


def _guess_order_for_round(state: Dict) -> List[str]:
    return _lagging_order(state)


def _start_round(state: Dict) -> None:
    order = _guess_order_for_round(state)
    roller = order[0] if order else None
    state["dice_symbols"] = []
    state["raw_dice_symbols"] = []
    state["round_context"] = {
        "roller_id": roller,
        "guess_order": order,
        "choose_index": 0,
        "guesses": {},
        "wrong_queue": [],
        "exchange_index": 0,
        "die_modify_used": False,
    }
    state["available_wheel_ids"] = [wheel["id"] for wheel in WHEELS]
    _set_phase(state, "roll_dice", roller)


def _end_round_and_advance(state: Dict) -> None:
    if state["config"].get("deadly_shortcut") and int(state["round"]) >= _round_index_to_remove_shortcuts(state):
        for token in state.get("deadly_shortcut_tokens", {}).values():
            if not token.get("taken_by"):
                token["removed"] = True

    if state["config"].get("curse_of_temple"):
        curse_removed = False
        cursed_player_id = state.get("cursed_player_id")
        if cursed_player_id and any(int(p["score"]) >= 13 for p in state["players"].values()):
            state["cursed_player_id"] = None
            curse_removed = True
        if not curse_removed and int(state["round"]) >= _round_index_to_force_remove_curse(state):
            state["cursed_player_id"] = None
            curse_removed = True
        if not curse_removed and state.get("cursed_player_id"):
            leader_order = _leading_order(state)
            state["cursed_player_id"] = leader_order[0] if leader_order else None

    if int(state["round"]) >= int(state["max_rounds"]):
        submit_order = _lagging_order(state)
        state["final_guess_context"] = {"order": submit_order, "index": 0}
        actor = submit_order[0] if submit_order else None
        _set_phase(state, "final_guess_submit", actor)
        return

    state["round"] = int(state["round"]) + 1
    _start_round(state)


def _resolve_round_guesses(state: Dict) -> None:
    context = state["round_context"]
    guess_order: List[str] = list(context.get("guess_order", []))
    guesses: Dict[str, Dict] = context.get("guesses", {})
    wrong_ids: List[str] = []

    for player_id in guess_order:
        entry = guesses.get(player_id)
        if not entry:
            continue
        actual = _actual_sum_for_player(state, player_id, state.get("dice_symbols", []))
        entry["actual_sum"] = actual
        min_value = int(entry["min"])
        max_value = int(entry["max"])
        if min_value <= actual <= max_value:
            entry["result"] = "correct"
        elif actual < min_value:
            entry["result"] = "wrong_low"
            wrong_ids.append(player_id)
        else:
            entry["result"] = "wrong_high"
            wrong_ids.append(player_id)

    other_wrong_count = len(wrong_ids)
    for player_id in guess_order:
        entry = guesses.get(player_id)
        if not entry:
            continue
        wheel = WHEEL_BY_ID[entry["wheel_id"]]
        result = entry["result"]
        delta = 0
        if result == "correct":
            delta = int(wheel["victory_points"])
            if state["config"].get("curse_of_temple") and state.get("cursed_player_id") == player_id:
                delta += max(0, other_wrong_count - 0)
        elif state["config"].get("curse_of_temple") and state.get("cursed_player_id") == player_id:
            delta = -int(wheel["victory_points"])
        _apply_score_delta(state, player_id, delta)
        entry["score_delta"] = int(delta)

        if state["config"].get("curse_of_temple") and not state.get("cursed_player_id"):
            if int(state["players"][player_id]["score"]) >= 7:
                state["cursed_player_id"] = player_id

    summary_entries: List[Dict] = []
    for player_id in guess_order:
        entry = guesses.get(player_id)
        if not entry:
            continue
        summary_entries.append(
            {
                "player_id": player_id,
                "wheel_id": entry.get("wheel_id"),
                "min": entry.get("min"),
                "max": entry.get("max"),
                "result": entry.get("result"),
            }
        )
    state["last_round_summary"] = {
        "round": int(state.get("round", 1)),
        "dice_symbols": list(state.get("dice_symbols", [])),
        "entries": summary_entries,
    }

    context["wrong_queue"] = wrong_ids
    context["exchange_index"] = 0
    if wrong_ids:
        _set_phase(state, "exchange_stones", wrong_ids[0])
        return
    _end_round_and_advance(state)


def _score_normal_final(actual: int, guesses: List[int]) -> int:
    if len(guesses) == 1:
        return 5 if actual in guesses else -2
    if len(guesses) == 2:
        return 2 if actual in guesses else -2
    if len(guesses) == 3:
        return 1 if actual in guesses else -2
    return -2


def _score_shortcut_final(actual: int, guesses: List[int]) -> int:
    if len(guesses) == 1:
        return 10 if actual in guesses else -4
    if len(guesses) == 2:
        return 4 if actual in guesses else -4
    if len(guesses) == 3:
        return 2 if actual in guesses else -4
    return -4


def _resolve_final_guesses(state: Dict) -> None:
    context = state.get("final_guess_context", {})
    order: List[str] = list(context.get("order", []))
    for player_id in order:
        log = _log_for_player(state, player_id)
        if not log:
            continue
        pdata = state["players"][player_id]
        delta = 0
        per_symbol: Dict[str, Dict] = {}
        for symbol in state.get("active_symbols", []):
            actual = int(log["slots"][symbol]["value"])
            if symbol in pdata.get("shortcut_commits", {}):
                guesses = list(pdata["shortcut_commits"][symbol])
                points = _score_shortcut_final(actual, guesses)
                per_symbol[symbol] = {"actual": actual, "guesses": guesses, "points": points, "source": "shortcut"}
            else:
                guesses = list(pdata.get("final_guesses", {}).get(symbol, []))
                points = _score_normal_final(actual, guesses)
                per_symbol[symbol] = {"actual": actual, "guesses": guesses, "points": points, "source": "final"}
            delta += int(points)
        pdata["final_result"] = {"per_symbol": per_symbol, "score_delta": delta}
        _apply_score_delta(state, player_id, delta)

    max_score = max(int(p["score"]) for p in state["players"].values()) if state["players"] else 0
    tied = [pid for pid, pdata in state["players"].items() if int(pdata["score"]) == max_score]
    winner = sorted(tied, key=lambda pid: int(state["players"][pid]["stack_order"]))[0] if tied else None
    state["winner_ids"] = [winner] if winner else []
    state["game_over"] = True
    _set_phase(state, "game_over", None)


def _validate_guess_numbers(values: object, max_value: int) -> Optional[List[int]]:
    if not isinstance(values, list):
        return None
    if len(values) > 3:
        return None
    normalized: List[int] = []
    for item in values:
        if not isinstance(item, int):
            return None
        if item < 0 or item > max_value:
            return None
        normalized.append(int(item))
    if len(set(normalized)) != len(normalized):
        return None
    return normalized


def _build_log_view(state: Dict, log: Dict, viewer_id: str) -> Dict:
    owner_id = log.get("owner_player_id")
    show_all = state.get("game_over") or owner_id is None or owner_id != viewer_id
    slots: List[Dict] = []
    for symbol in state.get("active_symbols", []):
        stone = log["slots"].get(symbol)
        slots.append(
            {
                "symbol": symbol,
                "stone_id": stone.get("id") if isinstance(stone, dict) else None,
                "hidden_from_viewer": not bool(show_all),
                "value": stone.get("value") if isinstance(stone, dict) and show_all else None,
            }
        )
    return {"log_id": log.get("log_id"), "owner_player_id": owner_id, "slots": slots}


def _build_player_view(state: Dict, player_id: str, viewer_id: str) -> Dict:
    meta = state["player_meta"].get(player_id, {})
    pdata = state["players"][player_id]
    show_private = state.get("game_over") or player_id == viewer_id
    return {
        "player_id": player_id,
        "name": meta.get("name"),
        "seat": meta.get("seat"),
        "score": int(pdata["score"]),
        "stack_order": int(pdata["stack_order"]),
        "is_current_actor": player_id == state.get("current_actor"),
        "you": player_id == viewer_id,
        "shortcut_commits": dict(pdata.get("shortcut_commits", {})) if show_private else {},
        "final_guesses": dict(pdata.get("final_guesses", {})) if show_private else {},
        "final_result": dict(pdata.get("final_result", {})) if show_private else {},
    }


def _phase_detail(state: Dict, viewer_id: str) -> str:
    phase = state.get("phase")
    actor_name = _player_name(state, state.get("current_actor"))
    if phase == "roll_dice":
        return f"{actor_name} must roll dice."
    if phase == "offer_shortcut_token":
        symbol = None
        offer = state.get("shortcut_offer") or {}
        symbols = offer.get("symbols") or []
        idx = int(offer.get("symbol_index", 0))
        if 0 <= idx < len(symbols):
            symbol = symbols[idx]
        if viewer_id == state.get("current_actor"):
            return f"Decide whether to take shortcut token for {symbol}."
        return f"{actor_name} is deciding shortcut token for {symbol}."
    if phase == "modify_die":
        if viewer_id == state.get("current_actor"):
            return "Modify one die (or mandatory intro replacements), then confirm."
        return f"{actor_name} may modify dice."
    if phase == "choose_wheels":
        if viewer_id == state.get("current_actor"):
            return "Choose a wheel and submit your range."
        return f"{actor_name} is choosing a wheel."
    if phase == "exchange_stones":
        if viewer_id == state.get("current_actor"):
            return "You guessed wrong. Replace one symbol stone."
        return f"{actor_name} is exchanging a stone."
    if phase == "final_guess_submit":
        if viewer_id == state.get("current_actor"):
            return "Submit final number guesses."
        return f"{actor_name} is submitting final guesses."
    if phase == "game_over":
        winner_names = [_player_name(state, pid) for pid in state.get("winner_ids", [])]
        return f"Game over. Winner: {', '.join(winner_names)}."
    return "-"


class LostCodeGame:
    game_id = "lost_code"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered = _ordered_players(players)
        cfg = _normalize_config(config)
        mode = cfg["mode"]
        active_symbols = _active_symbols(mode)
        max_value = _max_symbol_value(mode)
        max_sum = _max_sum_for_mode(mode)
        player_ids = [player["player_id"] for player in ordered]
        logs_piles = _build_logs_and_piles(active_symbols, max_value, player_ids)
        stack_order_map, next_stack = _new_stack_order_map(player_ids)
        player_meta = {player["player_id"]: player for player in ordered}

        state_players: Dict[str, Dict] = {}
        for player in ordered:
            pid = player["player_id"]
            state_players[pid] = {
                "log_id": f"log_{player['seat'] + 1}",
                "score": 0,
                "stack_order": int(stack_order_map.get(pid, 0)),
                "shortcut_commits": {},
                "final_guesses": {},
                "final_result": {},
            }

        shortcut_tokens = {
            symbol: {"symbol": symbol, "taken_by": None, "removed": not bool(cfg["deadly_shortcut"])}
            for symbol in active_symbols
        }

        state = {
            "config": cfg,
            "mode": mode,
            "active_symbols": active_symbols,
            "max_symbol_value": max_value,
            "max_sum": max_sum,
            "player_meta": player_meta,
            "players": state_players,
            "logs": logs_piles["logs"],
            "symbol_draw_piles": logs_piles["symbol_draw_piles"],
            "out_of_game_stones": logs_piles["out_of_game_stones"],
            "discarded_stones": [],
            "wheels": [dict(wheel) for wheel in WHEELS],
            "available_wheel_ids": [],
            "deadly_shortcut_tokens": shortcut_tokens,
            "cursed_player_id": None,
            "dice_symbols": [],
            "raw_dice_symbols": [],
            "round": 1,
            "max_rounds": _round_limit(len(player_ids)),
            "phase": "roll_dice",
            "current_actor": None,
            "round_context": {},
            "shortcut_offer": None,
            "final_guess_context": {},
            "winner_ids": [],
            "game_over": False,
            "next_stack_order": next_stack,
            "last_round_summary": {},
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        if player_id != state.get("current_actor"):
            return []
        phase = state.get("phase")
        if phase == "roll_dice":
            return ["roll_dice"]
        if phase == "offer_shortcut_token":
            return ["pass_shortcut", "take_shortcut"]
        if phase == "modify_die":
            if state.get("mode") == "intro" and "bear_red" in state.get("dice_symbols", []):
                return ["modify_die"]
            if state["round_context"].get("die_modify_used"):
                return ["confirm_dice"]
            return ["modify_die", "confirm_dice"]
        if phase == "choose_wheels":
            return ["submit_guess"]
        if phase == "exchange_stones":
            legal_symbols = _legal_exchange_symbols(state, player_id)
            if legal_symbols:
                return ["replace_stone"]
            return ["skip_exchange"]
        if phase == "final_guess_submit":
            return ["submit_final_guesses"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if player_id != state.get("current_actor"):
            return [], "not your turn"
        action_type = action.get("type")
        legal_actions = LostCodeGame.get_legal_actions(state, player_id)
        if action_type not in legal_actions:
            return [], "illegal action"

        if action_type == "roll_dice":
            symbols = list(state.get("active_symbols", []))
            rolled = [random.choice(symbols) for _ in range(3)]
            state["raw_dice_symbols"] = list(rolled)
            state["dice_symbols"] = list(rolled)
            triggered = _triggered_shortcut_symbols(state)
            if triggered:
                order = list(state["round_context"]["guess_order"])
                state["shortcut_offer"] = {
                    "symbols": triggered,
                    "order": order,
                    "symbol_index": 0,
                    "player_index": 0,
                }
                _set_phase(state, "offer_shortcut_token", order[0] if order else None)
                return [], None
            _set_phase(state, "modify_die", state["round_context"]["roller_id"])
            return [], None

        if action_type in ("pass_shortcut", "take_shortcut"):
            offer = state.get("shortcut_offer")
            if not isinstance(offer, dict):
                return [], "shortcut not available"
            symbols = offer.get("symbols", [])
            symbol_index = int(offer.get("symbol_index", 0))
            if symbol_index >= len(symbols):
                return [], "shortcut not available"
            symbol = symbols[symbol_index]
            token = state["deadly_shortcut_tokens"].get(symbol)
            if not token or token.get("removed") or token.get("taken_by"):
                _advance_shortcut_offer(state)
                return [], None

            if action_type == "take_shortcut":
                guesses = _validate_guess_numbers(action.get("guesses"), state["max_symbol_value"])
                if guesses is None or len(guesses) < 1:
                    return [], "invalid guesses"
                pdata = state["players"][player_id]
                if symbol in pdata.get("shortcut_commits", {}):
                    return [], "shortcut already committed"
                pdata["shortcut_commits"][symbol] = guesses
                token["taken_by"] = player_id
            _advance_shortcut_offer(state)
            return [], None

        if action_type == "modify_die":
            try:
                die_index = int(action.get("die_index"))
            except (TypeError, ValueError):
                return [], "invalid die index"
            new_symbol = action.get("symbol")
            if die_index < 0 or die_index >= 3:
                return [], "invalid die index"
            if new_symbol not in state.get("active_symbols", []):
                return [], "invalid symbol"
            current_symbol = state["dice_symbols"][die_index]
            intro_force = state.get("mode") == "intro" and "bear_red" in state.get("dice_symbols", [])
            if intro_force:
                if current_symbol != "bear_red":
                    return [], "must replace bear die first"
                if new_symbol == "bear_red":
                    return [], "intro mode cannot keep bear"
            else:
                if state["round_context"].get("die_modify_used"):
                    return [], "die already modified"
                state["round_context"]["die_modify_used"] = True
            state["dice_symbols"][die_index] = new_symbol
            return [], None

        if action_type == "confirm_dice":
            if state.get("mode") == "intro" and "bear_red" in state.get("dice_symbols", []):
                return [], "must replace all bear dice"
            _set_phase(state, "choose_wheels", state["round_context"]["guess_order"][0])
            return [], None

        if action_type == "submit_guess":
            wheel_id = action.get("wheel_id")
            if wheel_id not in state.get("available_wheel_ids", []):
                return [], "wheel not available"
            try:
                min_value = int(action.get("min"))
                max_value = int(action.get("max"))
            except (TypeError, ValueError):
                return [], "invalid range"
            wheel = WHEEL_BY_ID.get(wheel_id)
            if not wheel:
                return [], "invalid wheel"
            if min_value < 0 or max_value > int(state["max_sum"]) or min_value > max_value:
                return [], "invalid range"
            if max_value - min_value + 1 != int(wheel["window_size"]):
                return [], "range does not match wheel"

            context = state["round_context"]
            context["guesses"][player_id] = {
                "wheel_id": wheel_id,
                "min": min_value,
                "max": max_value,
                "actual_sum": None,
                "result": None,
                "score_delta": 0,
            }
            state["available_wheel_ids"].remove(wheel_id)
            choose_index = int(context.get("choose_index", 0)) + 1
            context["choose_index"] = choose_index
            order = context.get("guess_order", [])
            if choose_index < len(order):
                _set_phase(state, "choose_wheels", order[choose_index])
                return [], None
            _resolve_round_guesses(state)
            return [], None

        if action_type == "replace_stone":
            symbol = action.get("symbol")
            legal = _legal_exchange_symbols(state, player_id)
            if symbol not in legal:
                return [], "invalid replacement symbol"
            log = _log_for_player(state, player_id)
            if not log:
                return [], "missing log"
            old_stone = log["slots"][symbol]
            new_stone = state["symbol_draw_piles"][symbol].pop()
            log["slots"][symbol] = new_stone
            state["discarded_stones"].append(
                {
                    "player_id": player_id,
                    "symbol": symbol,
                    "old_stone": old_stone,
                    "round": int(state["round"]),
                }
            )
            context = state["round_context"]
            context["exchange_index"] = int(context["exchange_index"]) + 1
            wrong_queue = context.get("wrong_queue", [])
            if context["exchange_index"] < len(wrong_queue):
                _set_phase(state, "exchange_stones", wrong_queue[context["exchange_index"]])
                return [], None
            _end_round_and_advance(state)
            return [], None

        if action_type == "skip_exchange":
            legal = _legal_exchange_symbols(state, player_id)
            if legal:
                return [], "must replace a stone"
            context = state["round_context"]
            context["exchange_index"] = int(context["exchange_index"]) + 1
            wrong_queue = context.get("wrong_queue", [])
            if context["exchange_index"] < len(wrong_queue):
                _set_phase(state, "exchange_stones", wrong_queue[context["exchange_index"]])
                return [], None
            _end_round_and_advance(state)
            return [], None

        if action_type == "submit_final_guesses":
            submitted = action.get("guesses")
            if not isinstance(submitted, dict):
                return [], "invalid final guesses"
            pdata = state["players"][player_id]
            final_guesses: Dict[str, List[int]] = {}
            for symbol in state.get("active_symbols", []):
                if symbol in pdata.get("shortcut_commits", {}):
                    continue
                guesses = _validate_guess_numbers(submitted.get(symbol, []), state["max_symbol_value"])
                if guesses is None:
                    return [], f"invalid final guesses for {symbol}"
                final_guesses[symbol] = guesses
            pdata["final_guesses"] = final_guesses
            context = state["final_guess_context"]
            context["index"] = int(context.get("index", 0)) + 1
            order = context.get("order", [])
            if context["index"] < len(order):
                _set_phase(state, "final_guess_submit", order[context["index"]])
                return [], None
            _resolve_final_guesses(state)
            return [], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        guesses_view: Dict[str, Dict] = {}
        context = state.get("round_context", {})
        for player_id, entry in context.get("guesses", {}).items():
            wheel_id = entry.get("wheel_id")
            result = entry.get("result")
            display_result = result
            if not state.get("game_over") and viewer_id == player_id and wheel_id == MIN_WHEEL_ID and result in ("wrong_low", "wrong_high"):
                display_result = "wrong"
            guesses_view[player_id] = {
                "wheel_id": wheel_id,
                "min": entry.get("min"),
                "max": entry.get("max"),
                "result": display_result,
                "score_delta": entry.get("score_delta", 0),
                "actual_sum_visible": bool(state.get("game_over") or viewer_id == player_id),
                "actual_sum": entry.get("actual_sum") if state.get("game_over") or viewer_id == player_id else None,
            }

        logs_view = [_build_log_view(state, log, viewer_id) for log in state.get("logs", [])]
        ordered_meta = _ordered_players(list(state["player_meta"].values()))
        players_view = [_build_player_view(state, item["player_id"], viewer_id) for item in ordered_meta]

        shortcut_offer = state.get("shortcut_offer") or {}
        offer_symbols = shortcut_offer.get("symbols") or []
        offer_symbol_index = int(shortcut_offer.get("symbol_index", 0)) if offer_symbols else -1
        current_offer_symbol = (
            offer_symbols[offer_symbol_index]
            if 0 <= offer_symbol_index < len(offer_symbols)
            else None
        )

        return {
            "game_id": LostCodeGame.game_id,
            "phase": state.get("phase"),
            "phase_detail": _phase_detail(state, viewer_id),
            "you": viewer_id,
            "round": int(state.get("round", 1)),
            "max_rounds": int(state.get("max_rounds", 0)),
            "mode": state.get("mode"),
            "active_symbols": list(state.get("active_symbols", [])),
            "max_symbol_value": int(state.get("max_symbol_value", 7)),
            "max_sum": int(state.get("max_sum", 21)),
            "current_actor": state.get("current_actor"),
            "current_actor_name": _player_name(state, state.get("current_actor")),
            "roller_id": state.get("round_context", {}).get("roller_id"),
            "dice_symbols": list(state.get("dice_symbols", [])),
            "raw_dice_symbols": list(state.get("raw_dice_symbols", [])),
            "players": players_view,
            "logs": logs_view,
            "wheels": [dict(wheel) for wheel in state.get("wheels", [])],
            "available_wheel_ids": list(state.get("available_wheel_ids", [])),
            "guesses": guesses_view,
            "discarded_stones": list(state.get("discarded_stones", [])),
            "draw_pile_counts": {symbol: len(pile) for symbol, pile in state.get("symbol_draw_piles", {}).items()},
            "deadly_shortcut_tokens": dict(state.get("deadly_shortcut_tokens", {})),
            "shortcut_offer": {
                "symbol": current_offer_symbol,
                "symbol_index": offer_symbol_index,
            },
            "cursed_player_id": state.get("cursed_player_id"),
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
            "legal_actions": LostCodeGame.get_legal_actions(state, viewer_id),
            "last_round_summary": dict(state.get("last_round_summary", {})),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = LostCodeGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        phase = state.get("phase")
        if phase == "roll_dice":
            return {"type": "roll_dice"}
        if phase == "offer_shortcut_token":
            offer = state.get("shortcut_offer", {})
            symbols = offer.get("symbols", [])
            symbol_index = int(offer.get("symbol_index", 0))
            symbol = symbols[symbol_index] if 0 <= symbol_index < len(symbols) else None
            if symbol and random.random() < 0.25:
                guess_count = random.randint(1, 3)
                choices = list(range(state["max_symbol_value"] + 1))
                random.shuffle(choices)
                return {"type": "take_shortcut", "guesses": sorted(choices[:guess_count])}
            return {"type": "pass_shortcut"}
        if phase == "modify_die":
            dice = state.get("dice_symbols", [])
            if state.get("mode") == "intro" and "bear_red" in dice:
                idx = dice.index("bear_red")
                options = [s for s in state.get("active_symbols", []) if s != "bear_red"]
                return {"type": "modify_die", "die_index": idx, "symbol": random.choice(options)}
            if state["round_context"].get("die_modify_used") or random.random() < 0.6:
                return {"type": "confirm_dice"}
            idx = random.randint(0, 2)
            return {"type": "modify_die", "die_index": idx, "symbol": random.choice(state.get("active_symbols", []))}
        if phase == "choose_wheels":
            wheel_id = state["available_wheel_ids"][0]
            wheel = WHEEL_BY_ID[wheel_id]
            window = int(wheel["window_size"])
            max_sum = int(state["max_sum"])
            start = random.randint(0, max(0, max_sum - window + 1))
            return {"type": "submit_guess", "wheel_id": wheel_id, "min": start, "max": start + window - 1}
        if phase == "exchange_stones":
            legal_symbols = _legal_exchange_symbols(state, bot_id)
            if legal_symbols:
                return {"type": "replace_stone", "symbol": legal_symbols[0]}
            return {"type": "skip_exchange"}
        if phase == "final_guess_submit":
            pdata = state["players"][bot_id]
            guesses: Dict[str, List[int]] = {}
            for symbol in state.get("active_symbols", []):
                if symbol in pdata.get("shortcut_commits", {}):
                    continue
                guesses[symbol] = [random.randint(0, state["max_symbol_value"])]
            return {"type": "submit_final_guesses", "guesses": guesses}
        return {"type": legal[0]}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
