from __future__ import annotations

import itertools
import random
from typing import Dict, List, Optional, Tuple


COLORS = ("dark", "light")
COLOR_ORDER = {"dark": 0, "light": 1}
VALUES = tuple(range(12))
DEFAULT_CONFIG: Dict = {"mode": "standard"}
MAX_PUBLIC_LOG = 80


def _normalize_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if isinstance(config, dict):
        merged.update(config)
    mode = merged.get("mode")
    if mode not in ("standard", "advanced"):
        mode = DEFAULT_CONFIG["mode"]
    return {"mode": mode}


def _tile_id(color: str, value: Optional[int], is_dash: bool) -> str:
    if is_dash:
        return f"{color}-dash"
    return f"{color}-{int(value)}"


def _build_tile(color: str, value: Optional[int], is_dash: bool) -> Dict:
    return {
        "id": _tile_id(color, value, is_dash),
        "color": color,
        "value": None if is_dash else int(value),
        "is_dash": bool(is_dash),
    }


def _build_deck(mode: str) -> List[Dict]:
    deck: List[Dict] = []
    for color in COLORS:
        for value in VALUES:
            deck.append(_build_tile(color, value, False))
        if mode == "advanced":
            deck.append(_build_tile(color, None, True))
    random.shuffle(deck)
    return deck


def _tile_sort_key(tile: Dict) -> Tuple[int, int]:
    if tile.get("is_dash"):
        raise ValueError("dash tiles do not have numeric order")
    return int(tile.get("value", 0)), COLOR_ORDER.get(tile.get("color"), 99)


def _tile_label(tile: Optional[Dict]) -> str:
    if not isinstance(tile, dict):
        return "-"
    icon = "⚫" if tile.get("color") == "dark" else "⚪"
    if tile.get("is_dash"):
        return f"{icon}━"
    return f"{icon}{int(tile.get('value', 0))}"


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: item.get("seat", 0))


def _initial_tile_count(player_count: int) -> int:
    if player_count == 4:
        return 3
    return 4


def _rack_tiles(rack: List[Dict]) -> List[Dict]:
    return [entry["tile"] for entry in rack if isinstance(entry, dict) and isinstance(entry.get("tile"), dict)]


def _tiles_valid_with_fixed_numbers(tiles: List[Dict]) -> bool:
    numeric_tiles = [tile for tile in tiles if isinstance(tile, dict) and not tile.get("is_dash")]
    keys = [_tile_sort_key(tile) for tile in numeric_tiles]
    return keys == sorted(keys)


def _valid_insert_indices(rack: List[Dict], tile: Dict) -> List[int]:
    indices: List[int] = []
    for insert_index in range(len(rack) + 1):
        candidate = list(_rack_tiles(rack))
        candidate.insert(insert_index, tile)
        if _tiles_valid_with_fixed_numbers(candidate):
            indices.append(insert_index)
    return indices


def _build_rack_from_tiles(tiles: List[Dict], revealed: bool = False) -> List[Dict]:
    return [{"tile": dict(tile), "revealed": bool(revealed)} for tile in tiles]


def _append_public_log(state: Dict, message: str, kind: str = "info") -> None:
    log_entries = state.setdefault("public_log", [])
    log_entries.append({"kind": kind, "message": message})
    if len(log_entries) > MAX_PUBLIC_LOG:
        del log_entries[:-MAX_PUBLIC_LOG]


def _active_player_ids(state: Dict) -> List[str]:
    return [player_id for player_id in state.get("turn_order", []) if not state["players"][player_id]["eliminated"]]


def _first_active_player_id(state: Dict) -> Optional[str]:
    active = _active_player_ids(state)
    return active[0] if active else None


def _advance_to_next_active_player(state: Dict) -> Optional[str]:
    active = _active_player_ids(state)
    if not active:
        return None
    current = state.get("current_turn")
    if current not in active:
        return active[0]
    order = state.get("turn_order", [])
    current_index = order.index(current)
    for offset in range(1, len(order) + 1):
        candidate = order[(current_index + offset) % len(order)]
        if candidate in active:
            return candidate
    return None


def _winner_ids(state: Dict) -> List[str]:
    active = _active_player_ids(state)
    if len(active) == 1:
        return active
    return []


def _finalize_game_if_needed(state: Dict) -> bool:
    winners = _winner_ids(state)
    if not winners:
        return False
    state["game_over"] = True
    state["phase"] = "game_over"
    state["current_turn"] = None
    state["turn_drawn"] = False
    state["winners"] = list(winners)
    names = [_player_name(state, player_id) for player_id in winners]
    _append_public_log(state, f"Game over. Winner: {', '.join(names)}.", "game_over")
    return True


def _player_name(state: Dict, player_id: str) -> str:
    meta = (state.get("player_meta") or {}).get(player_id) or {}
    return meta.get("name") or player_id


def _count_hidden_tiles(pdata: Dict) -> int:
    return sum(1 for entry in pdata.get("rack", []) if not entry.get("revealed"))


def _update_elimination(state: Dict, player_id: str) -> bool:
    pdata = state["players"][player_id]
    eliminated = _count_hidden_tiles(pdata) == 0
    if eliminated and not pdata.get("eliminated"):
        pdata["eliminated"] = True
        _append_public_log(state, f"{_player_name(state, player_id)} has no hidden tiles left and is out.", "eliminated")
    else:
        pdata["eliminated"] = eliminated
    return eliminated


def _needs_setup(state: Dict) -> bool:
    return any(state["players"][player_id].get("setup_tiles") for player_id in state.get("turn_order", []))


def _start_first_turn_if_ready(state: Dict) -> None:
    if state.get("game_over"):
        return
    was_setup = state.get("phase") == "setup"
    if _needs_setup(state):
        state["phase"] = "setup"
        state["current_turn"] = None
        state["turn_drawn"] = False
        return
    if not state.get("current_turn"):
        state["current_turn"] = _first_active_player_id(state)
    state["phase"] = "guess"
    state["turn_drawn"] = False
    if was_setup and state.get("current_turn"):
        _append_public_log(state, f"Turn {state.get('turn_number', 1)}: {_player_name(state, state['current_turn'])}.", "turn")
    _ensure_turn_draw(state)


def _ensure_turn_draw(state: Dict) -> None:
    if state.get("game_over") or state.get("phase") != "guess":
        return
    if state.get("turn_drawn"):
        return
    current_turn = state.get("current_turn")
    if not current_turn:
        return
    pdata = state["players"].get(current_turn)
    if not pdata or pdata.get("eliminated"):
        return
    state["turn_drawn"] = True
    if state.get("draw_pile"):
        pdata["pending_tile"] = state["draw_pile"].pop()
    else:
        pdata["pending_tile"] = None


def _advance_turn(state: Dict) -> None:
    if state.get("game_over"):
        return
    next_player = _advance_to_next_active_player(state)
    if next_player is None:
        return
    state["current_turn"] = next_player
    state["turn_number"] = int(state.get("turn_number", 1)) + 1
    state["phase"] = "guess"
    state["turn_drawn"] = False
    _append_public_log(state, f"Turn {state['turn_number']}: {_player_name(state, next_player)}.", "turn")
    _ensure_turn_draw(state)


def _requires_manual_insert(pdata: Dict, tile: Dict) -> bool:
    if tile.get("is_dash"):
        return True
    return any(entry["tile"].get("is_dash") for entry in pdata.get("rack", []))


def _insert_pending_tile(state: Dict, player_id: str, insert_index: int, revealed: bool) -> Optional[str]:
    pdata = state["players"].get(player_id)
    if not pdata:
        return "unknown player"
    tile = pdata.get("pending_tile")
    if not isinstance(tile, dict):
        return "no pending tile"
    rack = list(pdata.get("rack", []))
    valid_indices = _valid_insert_indices(rack, tile)
    if insert_index not in valid_indices:
        return "invalid insert position"
    rack.insert(insert_index, {"tile": tile, "revealed": bool(revealed)})
    pdata["rack"] = rack
    pdata["pending_tile"] = None
    if revealed:
        _append_public_log(
            state,
            f"{_player_name(state, player_id)} adds a revealed drawn tile at #{insert_index + 1}: {_tile_label(tile)}.",
            "reveal",
        )
    else:
        _append_public_log(
            state,
            f"{_player_name(state, player_id)} keeps the drawn tile hidden and inserts it at #{insert_index + 1}.",
            "turn",
        )
    _update_elimination(state, player_id)
    return None


def _auto_insert_pending_tile(state: Dict, player_id: str, revealed: bool) -> Optional[str]:
    pdata = state["players"].get(player_id)
    if not pdata:
        return "unknown player"
    tile = pdata.get("pending_tile")
    if not isinstance(tile, dict):
        return "no pending tile"
    valid_indices = _valid_insert_indices(pdata.get("rack", []), tile)
    if len(valid_indices) != 1:
        return "manual insert required"
    return _insert_pending_tile(state, player_id, valid_indices[0], revealed)


def _all_tile_faces(state: Dict) -> List[Dict]:
    faces: List[Dict] = []
    for color in COLORS:
        for value in VALUES:
            faces.append({"color": color, "value": value, "is_dash": False})
        if state.get("config", {}).get("mode") == "advanced":
            faces.append({"color": color, "value": "dash", "is_dash": True})
    return faces


def _declared_tile_from_action(action: Dict, mode: str) -> Optional[Dict]:
    color = action.get("declared_color")
    if color not in COLORS:
        return None
    declared_value = action.get("declared_value")
    if declared_value == "dash":
        if mode != "advanced":
            return None
        return {"color": color, "value": None, "is_dash": True}
    if not isinstance(declared_value, int) or declared_value not in VALUES:
        return None
    return {"color": color, "value": int(declared_value), "is_dash": False}


def _tile_matches_declared(tile: Dict, declared: Dict) -> bool:
    if bool(tile.get("is_dash")) != bool(declared.get("is_dash")):
        return False
    if tile.get("color") != declared.get("color"):
        return False
    if tile.get("is_dash"):
        return True
    return int(tile.get("value", -1)) == int(declared.get("value", -2))


def _legal_setup_orders(tiles: List[Dict]) -> List[Dict]:
    options: List[Dict] = []
    seen: set[Tuple[str, ...]] = set()
    for perm in itertools.permutations(tiles):
        ids = tuple(tile["id"] for tile in perm)
        if ids in seen:
            continue
        seen.add(ids)
        ordered_tiles = list(perm)
        if not _tiles_valid_with_fixed_numbers(ordered_tiles):
            continue
        options.append(
            {
                "ordered_tile_ids": list(ids),
                "preview": "  ".join(_tile_label(tile) for tile in ordered_tiles),
            }
        )
    options.sort(key=lambda item: item["preview"])
    return options


def _insert_options_for_view(rack: List[Dict], tile: Dict) -> List[Dict]:
    options: List[Dict] = []
    labels = [_tile_label(entry["tile"]) for entry in rack]
    tile_label = _tile_label(tile)
    for insert_index in _valid_insert_indices(rack, tile):
        preview_labels = list(labels)
        preview_labels.insert(insert_index, tile_label)
        options.append({"insert_index": insert_index, "preview": "  ".join(preview_labels)})
    return options


def _phase_detail(state: Dict, viewer_id: str) -> str:
    phase = state.get("phase")
    current_turn = state.get("current_turn")
    current_name = _player_name(state, current_turn) if current_turn else "-"
    if phase == "setup":
        pdata = state["players"].get(viewer_id) or {}
        if pdata.get("setup_tiles"):
            return "Choose the starting order for your dash tiles."
        waiting = [_player_name(state, player_id) for player_id in state.get("turn_order", []) if state["players"][player_id].get("setup_tiles")]
        if waiting:
            return f"Waiting for setup: {', '.join(waiting)}."
        return "Preparing the game."
    if phase == "guess":
        if viewer_id == current_turn:
            return "Guess one hidden tile."
        return f"Waiting for {current_name}."
    if phase == "choose_continue":
        if viewer_id == current_turn:
            return "Correct guess. Continue or stop."
        return f"{current_name} guessed correctly and is deciding."
    if phase == "choose_self_reveal":
        if viewer_id == current_turn:
            return "No tiles left to draw. Reveal one of your hidden tiles."
        return f"{current_name} must reveal one of their own hidden tiles."
    if phase == "place_pending_hidden":
        if viewer_id == current_turn:
            return "Choose where to insert your hidden drawn tile."
        return f"{current_name} is inserting a hidden drawn tile."
    if phase == "place_pending_revealed":
        if viewer_id == current_turn:
            return "Choose where to insert your revealed drawn tile."
        return f"{current_name} is inserting a revealed drawn tile."
    if phase == "game_over":
        winners = [_player_name(state, player_id) for player_id in state.get("winners", [])]
        if winners:
            return f"Winner: {', '.join(winners)}."
        return "Game over."
    return "-"


def _legal_actions(state: Dict, player_id: str) -> List[str]:
    if state.get("game_over"):
        return []
    pdata = state["players"].get(player_id)
    if not pdata or pdata.get("eliminated"):
        return []
    phase = state.get("phase")
    current_turn = state.get("current_turn")
    if phase == "setup":
        return ["arrange_initial_tiles"] if pdata.get("setup_tiles") else []
    if player_id != current_turn:
        return []
    if phase == "guess":
        return ["guess_tile"]
    if phase == "choose_continue":
        return ["continue_guess", "stop_turn"]
    if phase == "choose_self_reveal":
        return ["reveal_own_tile"]
    if phase in ("place_pending_hidden", "place_pending_revealed"):
        return ["insert_pending_tile"]
    return []


def _build_player_tiles_view(state: Dict, owner_id: str, viewer_id: str) -> List[Dict]:
    pdata = state["players"][owner_id]
    visible_all = bool(state.get("game_over")) or owner_id == viewer_id
    tiles: List[Dict] = []
    for index, entry in enumerate(pdata.get("rack", [])):
        tile = entry["tile"]
        revealed = bool(entry.get("revealed"))
        face_visible = visible_all or revealed
        tiles.append(
            {
                "index": index,
                "revealed": revealed,
                "face_visible": face_visible,
                "label": _tile_label(tile) if face_visible else f"#{index + 1}",
                "color": tile.get("color") if face_visible else None,
                "value": tile.get("value") if face_visible else None,
                "is_dash": bool(tile.get("is_dash")) if face_visible else False,
                "guessable": owner_id != viewer_id and not revealed and not pdata.get("eliminated"),
            }
        )
    return tiles


def _build_public_players_view(state: Dict, viewer_id: str) -> List[Dict]:
    players: List[Dict] = []
    for player_id in state.get("turn_order", []):
        meta = state["player_meta"].get(player_id, {})
        pdata = state["players"][player_id]
        pending_tile = pdata.get("pending_tile")
        pending_visible = bool(state.get("game_over")) or player_id == viewer_id
        players.append(
            {
                "player_id": player_id,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "you": player_id == viewer_id,
                "is_current_turn": player_id == state.get("current_turn"),
                "eliminated": bool(pdata.get("eliminated")),
                "hidden_count": _count_hidden_tiles(pdata),
                "tile_count": len(pdata.get("rack", [])),
                "tiles": _build_player_tiles_view(state, player_id, viewer_id),
                "pending_tile": {
                    "exists": isinstance(pending_tile, dict),
                    "face_visible": bool(isinstance(pending_tile, dict) and pending_visible),
                    "label": _tile_label(pending_tile) if isinstance(pending_tile, dict) and pending_visible else None,
                    "color": pending_tile.get("color") if isinstance(pending_tile, dict) and pending_visible else None,
                    "value": pending_tile.get("value") if isinstance(pending_tile, dict) and pending_visible else None,
                    "is_dash": bool(pending_tile.get("is_dash")) if isinstance(pending_tile, dict) and pending_visible else False,
                },
            }
        )
    return players


class DaVinciCodeGame:
    game_id = "davinci_code"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered = _ordered_players(players)
        normalized = _normalize_config(config)
        deck = _build_deck(normalized["mode"])
        player_meta = {player["player_id"]: player for player in ordered}
        player_ids = [player["player_id"] for player in ordered]
        tiles_per_player = _initial_tile_count(len(player_ids))
        state_players: Dict[str, Dict] = {}
        for player in ordered:
            hand = [deck.pop() for _ in range(tiles_per_player)]
            if normalized["mode"] == "advanced" and any(tile.get("is_dash") for tile in hand):
                state_players[player["player_id"]] = {
                    "rack": [],
                    "setup_tiles": [dict(tile) for tile in hand],
                    "pending_tile": None,
                    "eliminated": False,
                }
            else:
                sorted_hand = sorted(hand, key=_tile_sort_key)
                state_players[player["player_id"]] = {
                    "rack": _build_rack_from_tiles(sorted_hand, revealed=False),
                    "setup_tiles": [],
                    "pending_tile": None,
                    "eliminated": False,
                }
        state = {
            "config": normalized,
            "players": state_players,
            "player_meta": player_meta,
            "turn_order": player_ids,
            "current_turn": player_ids[0] if player_ids else None,
            "turn_number": 1,
            "turn_drawn": False,
            "draw_pile": deck,
            "phase": "setup" if _needs_setup({"players": state_players, "turn_order": player_ids}) else "guess",
            "public_log": [],
            "winners": [],
            "game_over": False,
        }
        _append_public_log(state, f"Game started in {normalized['mode']} mode.", "game")
        if state["phase"] == "setup":
            _append_public_log(state, "Players with dash tiles must choose their starting order.", "setup")
            state["current_turn"] = None
        else:
            _append_public_log(state, f"Turn 1: {_player_name(state, state['current_turn'])}.", "turn")
            _ensure_turn_draw(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        return _legal_actions(state, player_id)

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        pdata = state["players"].get(player_id)
        if not pdata:
            return [], "unknown player"

        action_type = action.get("type")

        if action_type == "arrange_initial_tiles":
            if state.get("phase") != "setup":
                return [], "setup complete"
            setup_tiles = pdata.get("setup_tiles") or []
            if not setup_tiles:
                return [], "no setup required"
            ordered_tile_ids = action.get("ordered_tile_ids")
            if not isinstance(ordered_tile_ids, list) or len(ordered_tile_ids) != len(setup_tiles):
                return [], "invalid setup order"
            tile_by_id = {tile["id"]: tile for tile in setup_tiles}
            if set(ordered_tile_ids) != set(tile_by_id.keys()):
                return [], "invalid setup tiles"
            ordered_tiles = [tile_by_id[tile_id] for tile_id in ordered_tile_ids]
            if not _tiles_valid_with_fixed_numbers(ordered_tiles):
                return [], "invalid setup order"
            pdata["rack"] = _build_rack_from_tiles(ordered_tiles, revealed=False)
            pdata["setup_tiles"] = []
            _append_public_log(state, f"{_player_name(state, player_id)} finished setup.", "setup")
            _start_first_turn_if_ready(state)
            return [], None

        legal_actions = DaVinciCodeGame.get_legal_actions(state, player_id)
        if action_type not in legal_actions:
            return [], "illegal action"

        if action_type == "guess_tile":
            target_player_id = action.get("target_player_id")
            target_index = action.get("target_index")
            declared = _declared_tile_from_action(action, state["config"]["mode"])
            if not isinstance(target_player_id, str) or target_player_id == player_id:
                return [], "invalid target player"
            if not isinstance(target_index, int) or target_index < 0:
                return [], "invalid target index"
            if not declared:
                return [], "invalid guess"
            target = state["players"].get(target_player_id)
            if not target or target.get("eliminated"):
                return [], "invalid target player"
            rack = target.get("rack", [])
            if target_index >= len(rack):
                return [], "invalid target index"
            target_entry = rack[target_index]
            if target_entry.get("revealed"):
                return [], "target tile already revealed"

            declared_label = _tile_label(declared)
            actor_name = _player_name(state, player_id)
            target_name = _player_name(state, target_player_id)
            if _tile_matches_declared(target_entry["tile"], declared):
                target_entry["revealed"] = True
                _append_public_log(
                    state,
                    f"{actor_name} guessed {target_name}'s #{target_index + 1} correctly: {_tile_label(target_entry['tile'])}.",
                    "correct",
                )
                _update_elimination(state, target_player_id)
                if _finalize_game_if_needed(state):
                    return [], None
                state["phase"] = "choose_continue"
                return [], None

            _append_public_log(
                state,
                f"{actor_name} guessed {target_name}'s #{target_index + 1} as {declared_label} and missed.",
                "wrong",
            )
            pending_tile = pdata.get("pending_tile")
            if isinstance(pending_tile, dict):
                if _requires_manual_insert(pdata, pending_tile):
                    state["phase"] = "place_pending_revealed"
                    return [], None
                error = _auto_insert_pending_tile(state, player_id, revealed=True)
                if error:
                    return [], error
                if _finalize_game_if_needed(state):
                    return [], None
                _advance_turn(state)
                return [], None

            state["phase"] = "choose_self_reveal"
            return [], None

        if action_type == "continue_guess":
            state["phase"] = "guess"
            return [], None

        if action_type == "stop_turn":
            pending_tile = pdata.get("pending_tile")
            if isinstance(pending_tile, dict):
                if _requires_manual_insert(pdata, pending_tile):
                    state["phase"] = "place_pending_hidden"
                    return [], None
                error = _auto_insert_pending_tile(state, player_id, revealed=False)
                if error:
                    return [], error
            else:
                _append_public_log(state, f"{_player_name(state, player_id)} stops.", "turn")
            if _finalize_game_if_needed(state):
                return [], None
            _advance_turn(state)
            return [], None

        if action_type == "reveal_own_tile":
            tile_index = action.get("tile_index")
            rack = pdata.get("rack", [])
            if not isinstance(tile_index, int) or tile_index < 0 or tile_index >= len(rack):
                return [], "invalid tile index"
            entry = rack[tile_index]
            if entry.get("revealed"):
                return [], "tile already revealed"
            entry["revealed"] = True
            _append_public_log(
                state,
                f"{_player_name(state, player_id)} reveals their own #{tile_index + 1}: {_tile_label(entry['tile'])}.",
                "reveal",
            )
            _update_elimination(state, player_id)
            if _finalize_game_if_needed(state):
                return [], None
            _advance_turn(state)
            return [], None

        if action_type == "insert_pending_tile":
            insert_index = action.get("insert_index")
            if not isinstance(insert_index, int):
                return [], "invalid insert index"
            revealed = state.get("phase") == "place_pending_revealed"
            error = _insert_pending_tile(state, player_id, insert_index, revealed=revealed)
            if error:
                return [], error
            if _finalize_game_if_needed(state):
                return [], None
            _advance_turn(state)
            return [], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        pdata = state["players"].get(viewer_id)
        setup_tiles = pdata.get("setup_tiles") if pdata else []
        pending_tile = pdata.get("pending_tile") if pdata else None
        phase = state.get("phase")
        view = {
            "phase": phase,
            "mode": (state.get("config") or {}).get("mode"),
            "you": viewer_id,
            "current_turn": state.get("current_turn"),
            "current_turn_name": _player_name(state, state.get("current_turn")) if state.get("current_turn") else None,
            "turn_number": int(state.get("turn_number", 1)),
            "draw_pile_count": len(state.get("draw_pile", [])),
            "players": _build_public_players_view(state, viewer_id),
            "public_log": list(state.get("public_log", [])),
            "winners": list(state.get("winners", [])),
            "winner_names": [_player_name(state, player_id) for player_id in state.get("winners", [])],
            "legal_actions": DaVinciCodeGame.get_legal_actions(state, viewer_id),
            "phase_detail": _phase_detail(state, viewer_id),
            "guess_palette": _all_tile_faces(state),
            "setup_tiles": [
                {"id": tile["id"], "label": _tile_label(tile), "color": tile["color"], "value": tile["value"], "is_dash": bool(tile["is_dash"])}
                for tile in setup_tiles
            ]
            if isinstance(setup_tiles, list)
            else [],
            "setup_options": _legal_setup_orders(setup_tiles) if isinstance(setup_tiles, list) and setup_tiles else [],
            "pending_insert_options": _insert_options_for_view(pdata.get("rack", []), pending_tile)
            if pdata and isinstance(pending_tile, dict) and phase in ("place_pending_hidden", "place_pending_revealed")
            else [],
            "reveal_options": [
                {
                    "tile_index": index,
                    "label": _tile_label(entry["tile"]),
                }
                for index, entry in enumerate((pdata or {}).get("rack", []))
                if not entry.get("revealed")
            ]
            if phase == "choose_self_reveal" and pdata
            else [],
        }
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        pdata = state["players"].get(bot_id)
        if not pdata or pdata.get("eliminated"):
            return None
        phase = state.get("phase")
        if phase == "setup":
            options = _legal_setup_orders(pdata.get("setup_tiles") or [])
            if options:
                return {"type": "arrange_initial_tiles", "ordered_tile_ids": options[0]["ordered_tile_ids"]}
            return None
        if bot_id != state.get("current_turn"):
            return None
        if phase == "guess":
            targets = []
            for player_id in state.get("turn_order", []):
                if player_id == bot_id:
                    continue
                target = state["players"][player_id]
                if target.get("eliminated"):
                    continue
                for entry in target.get("rack", []):
                    if not entry.get("revealed"):
                        targets.append(player_id)
                        break
            if not targets:
                return None
            target_player_id = random.choice(targets)
            target_rack = state["players"][target_player_id]["rack"]
            unrevealed = [index for index, entry in enumerate(target_rack) if not entry.get("revealed")]
            if not unrevealed:
                return None
            target_index = random.choice(unrevealed)
            face = random.choice(_all_tile_faces(state))
            return {
                "type": "guess_tile",
                "target_player_id": target_player_id,
                "target_index": target_index,
                "declared_color": face["color"],
                "declared_value": "dash" if face["is_dash"] else int(face["value"]),
            }
        if phase == "choose_continue":
            if random.random() < 0.45:
                return {"type": "continue_guess"}
            return {"type": "stop_turn"}
        if phase == "choose_self_reveal":
            for index, entry in enumerate(pdata.get("rack", [])):
                if not entry.get("revealed"):
                    return {"type": "reveal_own_tile", "tile_index": index}
            return None
        if phase in ("place_pending_hidden", "place_pending_revealed"):
            tile = pdata.get("pending_tile")
            if not isinstance(tile, dict):
                return None
            options = _valid_insert_indices(pdata.get("rack", []), tile)
            if not options:
                return None
            return {"type": "insert_pending_tile", "insert_index": options[0]}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
