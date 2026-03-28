import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG = {
    "ring_count": 2,
    "ring_types": ["word", "attribute"],
}

THING_HAND_SIZE = 5
KNOWER_SEED_HAND_SIZE = 5
SEED_CLUE_COUNT = 3

RING_TYPE_LABELS = {
    "word": "词汇",
    "attribute": "属性",
    "context": "情景",
}

_THING_CACHE: Optional[List[Dict[str, str]]] = None
_RULE_CACHE: Optional[Dict[str, List[Dict[str, object]]]] = None


def _asset_path(filename: str) -> Path:
    return Path(__file__).resolve().parent / "assets" / filename


def _normalize_name(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return "".join(part for part in value.strip().split())


def _load_things() -> List[Dict[str, str]]:
    global _THING_CACHE
    if _THING_CACHE is not None:
        return [dict(item) for item in _THING_CACHE]
    raw = json.loads(_asset_path("things_in_rings_things.json").read_text(encoding="utf-8"))
    things: List[Dict[str, str]] = []
    for index, item in enumerate(raw):
        name = _normalize_name(item)
        if not name:
            continue
        things.append({"id": f"thing_{index + 1:03d}", "name": name})
    _THING_CACHE = things
    return [dict(item) for item in things]


def _load_rules() -> Dict[str, List[Dict[str, object]]]:
    global _RULE_CACHE
    if _RULE_CACHE is not None:
        return {key: [dict(entry) for entry in value] for key, value in _RULE_CACHE.items()}
    raw = json.loads(_asset_path("things_in_rings_rules.json").read_text(encoding="utf-8"))
    rules: Dict[str, List[Dict[str, object]]] = {}
    for ring_type, entries in raw.items():
        if ring_type not in RING_TYPE_LABELS or not isinstance(entries, list):
            continue
        cleaned: List[Dict[str, object]] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            rule_id = entry.get("id")
            text = entry.get("text")
            evaluation_mode = entry.get("evaluation_mode")
            if not isinstance(rule_id, str) or not isinstance(text, str):
                continue
            if evaluation_mode not in ("auto", "knower"):
                continue
            cleaned.append(
                {
                    "id": rule_id,
                    "type": ring_type,
                    "text": text.strip(),
                    "evaluation_mode": evaluation_mode,
                    "evaluator": dict(entry.get("evaluator") or {}) if isinstance(entry.get("evaluator"), dict) else {},
                }
            )
        if cleaned:
            rules[ring_type] = cleaned
    _RULE_CACHE = rules
    return {key: [dict(entry) for entry in value] for key, value in rules.items()}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {
        "ring_count": DEFAULT_CONFIG["ring_count"],
        "ring_types": list(DEFAULT_CONFIG["ring_types"]),
    }
    if isinstance(config, dict):
        ring_count = config.get("ring_count")
        if ring_count is not None:
            try:
                cfg["ring_count"] = int(ring_count)
            except (TypeError, ValueError):
                raise ValueError("ring_count must be an integer") from None
        ring_types = config.get("ring_types")
        if ring_types is not None:
            if not isinstance(ring_types, list):
                raise ValueError("ring_types must be a list")
            cfg["ring_types"] = [str(item) for item in ring_types]
    ring_count = cfg["ring_count"]
    if ring_count < 1 or ring_count > 3:
        raise ValueError("ring_count must be between 1 and 3")
    ring_types = [ring_type for ring_type in cfg["ring_types"] if ring_type in RING_TYPE_LABELS]
    if len(ring_types) != ring_count:
        raise ValueError("ring_types length must match ring_count")
    if len(set(ring_types)) != len(ring_types):
        raise ValueError("ring_types must be unique")
    cfg["ring_types"] = ring_types
    return cfg


def _draw_rule(rules_by_type: Dict[str, List[Dict[str, object]]], ring_type: str) -> Dict[str, object]:
    pool = list(rules_by_type.get(ring_type) or [])
    if not pool:
        raise ValueError(f"missing rules for {ring_type}")
    return dict(random.choice(pool))


def _shuffle_things() -> List[Dict[str, str]]:
    deck = _load_things()
    random.shuffle(deck)
    return deck


def _draw_cards(state: Dict, count: int) -> List[Dict[str, str]]:
    drawn: List[Dict[str, str]] = []
    deck = state.get("thing_deck") or []
    while deck and len(drawn) < count:
        drawn.append(deck.pop())
    return drawn


def _finder_order(all_player_ids: List[str], knower_id: str) -> List[str]:
    if knower_id not in all_player_ids:
        return list(all_player_ids)
    index = all_player_ids.index(knower_id)
    rotated = all_player_ids[index + 1 :] + all_player_ids[:index]
    return rotated


def _word_membership(rule: Dict[str, object], thing_card: Dict[str, str]) -> bool:
    evaluator = rule.get("evaluator") or {}
    if not isinstance(evaluator, dict):
        return False
    name = _normalize_name(thing_card.get("name"))
    kind = evaluator.get("kind")
    if kind == "char_count_eq":
        return len(name) == int(evaluator.get("value") or 0)
    if kind == "char_count_gte":
        return len(name) >= int(evaluator.get("value") or 0)
    if kind == "contains":
        needle = _normalize_name(evaluator.get("value"))
        return bool(needle) and needle in name
    if kind == "starts_with":
        prefix = _normalize_name(evaluator.get("value"))
        return bool(prefix) and name.startswith(prefix)
    if kind == "ends_with":
        suffix = _normalize_name(evaluator.get("value"))
        return bool(suffix) and name.endswith(suffix)
    if kind == "has_repeated_char":
        seen = set()
        for char in name:
            if char in seen:
                return True
            seen.add(char)
        return False
    return False


def _auto_memberships(rings: List[Dict[str, object]], thing_card: Dict[str, str]) -> List[Optional[bool]]:
    results: List[Optional[bool]] = []
    for ring in rings:
        if ring.get("evaluation_mode") == "auto":
            results.append(_word_membership(ring, thing_card))
        else:
            results.append(None)
    return results


def _normalize_memberships(memberships: object, ring_count: int) -> Optional[List[bool]]:
    if not isinstance(memberships, list) or len(memberships) != ring_count:
        return None
    normalized: List[bool] = []
    for item in memberships:
        if not isinstance(item, bool):
            return None
        normalized.append(item)
    return normalized


def _memberships_to_zone_id(memberships: List[bool]) -> str:
    return "".join("1" if item else "0" for item in memberships)


def _validate_memberships(
    rings: List[Dict[str, object]], thing_card: Dict[str, str], memberships: List[bool]
) -> Tuple[Optional[List[bool]], Optional[str]]:
    auto = _auto_memberships(rings, thing_card)
    resolved: List[bool] = []
    for index, ring in enumerate(rings):
        value = memberships[index]
        auto_value = auto[index]
        if ring.get("evaluation_mode") == "auto":
            if auto_value is None:
                return None, "missing automatic evaluation"
            if value != auto_value:
                return None, f"ring {index + 1} auto result mismatch"
            resolved.append(auto_value)
        else:
            resolved.append(value)
    return resolved, None


def _zone_definitions(rings: List[Dict[str, object]]) -> List[Dict[str, object]]:
    ring_count = len(rings)
    zones: List[Dict[str, object]] = []
    for value in range(1 << ring_count):
        bits = format(value, f"0{ring_count}b")
        bit_items = []
        positives = []
        negatives = []
        for index, ring in enumerate(rings):
            inside = bits[index] == "1"
            label = RING_TYPE_LABELS.get(ring.get("type"), "?")
            bit_items.append({"ring_index": index, "type": ring.get("type"), "label": label, "inside": inside})
            if inside:
                positives.append(label)
            else:
                negatives.append(label)
        if positives:
            title = " + ".join(positives)
        else:
            title = "环外区域"
        subtitle = "不在任何环内" if not positives else ("排除 " + " / ".join(negatives) if negatives else "命中全部环")
        zones.append({"zone_id": bits, "title": title, "subtitle": subtitle, "bits": bit_items})
    zones.sort(key=lambda item: item["zone_id"])
    return zones


def _next_active_finder(state: Dict, after_player_id: Optional[str] = None) -> Optional[str]:
    order = list(state.get("finder_order") or [])
    if not order:
        return None
    players = state.get("players") or {}
    if after_player_id in order:
        start = (order.index(after_player_id) + 1) % len(order)
    else:
        start = 0
    for offset in range(len(order)):
        pid = order[(start + offset) % len(order)]
        if players.get(pid, {}).get("hand"):
            return pid
    return None


def _build_players(players_meta: List[Dict]) -> Tuple[List[str], Dict[str, Dict], Dict[str, Dict]]:
    ordered = [dict(item) for item in sorted(players_meta, key=lambda item: item.get("seat", 0))]
    order = [item["player_id"] for item in ordered]
    meta = {item["player_id"]: dict(item) for item in ordered}
    players = {
        item["player_id"]: {
            "hand": [],
            "wins": 0,
            "role": "finder",
            "is_bot": bool(item.get("is_bot")),
        }
        for item in ordered
    }
    return order, meta, players


def _start_round(state: Dict, rotate_knower: bool = False, reset_wins: bool = False) -> None:
    order = list(state.get("turn_order") or [])
    if not order:
        raise ValueError("no players")
    if rotate_knower:
        state["knower_index"] = (int(state.get("knower_index", 0)) + 1) % len(order)
    knower_index = int(state.get("knower_index", 0)) % len(order)
    knower_id = order[knower_index]
    state["knower_id"] = knower_id
    state["finder_order"] = _finder_order(order, knower_id)
    if reset_wins:
        for pdata in state.get("players", {}).values():
            pdata["wins"] = 0
    for pid, pdata in state.get("players", {}).items():
        pdata["hand"] = []
        pdata["role"] = "knower" if pid == knower_id else "finder"
    rules_by_type = _load_rules()
    rings = []
    for ring_index, ring_type in enumerate(state["config"]["ring_types"]):
        rule = _draw_rule(rules_by_type, ring_type)
        rule["ring_index"] = ring_index
        rings.append(rule)
    state["rings"] = rings
    state["thing_deck"] = _shuffle_things()
    state["knower_hand"] = _draw_cards(state, KNOWER_SEED_HAND_SIZE)
    state["board_cards"] = []
    state["phase"] = "seed_clues"
    state["current_turn"] = knower_id
    state["pending_judgement"] = None
    state["seed_clues_remaining"] = SEED_CLUE_COUNT
    state["game_over"] = False
    state["winner_player_id"] = None
    state["winner_reason"] = None
    state["last_resolution"] = None
    state["game_start_time"] = time.time()


def _finish_seed_clues(state: Dict) -> None:
    state["knower_hand"] = []
    for pid in state.get("finder_order", []):
        state["players"][pid]["hand"] = _draw_cards(state, THING_HAND_SIZE)
    state["phase"] = "play"
    state["current_turn"] = _next_active_finder(state)
    if state["current_turn"] is None:
        state["phase"] = "game_over"
        state["game_over"] = True
        state["winner_reason"] = "no_active_finders"


def _resolve_play_result(
    state: Dict,
    player_id: str,
    thing_card: Dict[str, str],
    proposed_zone_id: str,
    actual_zone_id: str,
) -> List[Dict]:
    correct = proposed_zone_id == actual_zone_id
    board_entry = {
        "thing_card": dict(thing_card),
        "zone_id": actual_zone_id,
        "source": "play",
        "placed_by": player_id,
        "proposed_zone_id": proposed_zone_id,
        "correct": correct,
    }
    state["board_cards"].append(board_entry)
    drew_replacement = False
    if correct:
        if not state["players"][player_id]["hand"]:
            state["players"][player_id]["wins"] = state["players"][player_id].get("wins", 0) + 1
            state["phase"] = "game_over"
            state["current_turn"] = None
            state["game_over"] = True
            state["winner_player_id"] = player_id
            state["winner_reason"] = "emptied_hand"
        else:
            state["phase"] = "play"
            state["current_turn"] = player_id
    else:
        replacement = _draw_cards(state, 1)
        if replacement:
            state["players"][player_id]["hand"].extend(replacement)
            drew_replacement = True
        state["phase"] = "play"
        state["current_turn"] = _next_active_finder(state, after_player_id=player_id)
        if state["current_turn"] is None:
            state["phase"] = "game_over"
            state["game_over"] = True
            state["winner_reason"] = "no_active_finders"
    state["pending_judgement"] = None
    state["last_resolution"] = {
        "player_id": player_id,
        "thing_name": thing_card.get("name"),
        "proposed_zone_id": proposed_zone_id,
        "actual_zone_id": actual_zone_id,
        "correct": correct,
        "drew_replacement": drew_replacement,
    }
    return [{"type": "things_in_rings:placement_resolved"}]


def _validate_zone_id(zone_id: object, ring_count: int) -> Optional[str]:
    if not isinstance(zone_id, str):
        return None
    if len(zone_id) != ring_count or any(char not in ("0", "1") for char in zone_id):
        return None
    return zone_id


class ThingsInRingsGame:
    game_id = "things_in_rings"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        turn_order, player_meta, state_players = _build_players(players)
        state = {
            "config": cfg,
            "turn_order": turn_order,
            "player_meta": player_meta,
            "players": state_players,
            "knower_index": 0,
            "game_index": 1,
        }
        _start_round(state, rotate_knower=False, reset_wins=True)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        if state.get("game_over"):
            return ["play_again"]
        phase = state.get("phase")
        if phase == "seed_clues" and player_id == state.get("knower_id"):
            return ["submit_seed_clue"]
        if phase == "play" and player_id == state.get("current_turn"):
            return ["submit_play"]
        if phase == "judge" and player_id == state.get("knower_id"):
            return ["judge_play"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "player not found"
        action_type = action.get("type")
        if state.get("game_over"):
            if action_type != "play_again":
                return [], "game over"
            _start_round(state, rotate_knower=True, reset_wins=False)
            state["game_index"] = int(state.get("game_index") or 1) + 1
            return [{"type": "things_in_rings:play_again"}], None

        ring_count = len(state.get("rings") or [])
        if action_type == "submit_seed_clue":
            if state.get("phase") != "seed_clues" or player_id != state.get("knower_id"):
                return [], "cannot seed clues now"
            try:
                hand_index = int(action.get("hand_index"))
            except (TypeError, ValueError):
                return [], "invalid hand_index"
            hand = state.get("knower_hand") or []
            if hand_index < 0 or hand_index >= len(hand):
                return [], "invalid hand_index"
            memberships = _normalize_memberships(action.get("memberships"), ring_count)
            if memberships is None:
                return [], "invalid memberships"
            thing_card = hand.pop(hand_index)
            resolved, error = _validate_memberships(state["rings"], thing_card, memberships)
            if error:
                hand.insert(hand_index, thing_card)
                return [], error
            zone_id = _memberships_to_zone_id(resolved)
            state["board_cards"].append(
                {
                    "thing_card": dict(thing_card),
                    "zone_id": zone_id,
                    "source": "clue",
                    "placed_by": player_id,
                }
            )
            state["seed_clues_remaining"] = max(0, int(state.get("seed_clues_remaining") or 0) - 1)
            events = [{"type": "things_in_rings:seed_clue"}]
            if state["seed_clues_remaining"] == 0:
                _finish_seed_clues(state)
                events.append({"type": "things_in_rings:phase_play"})
            return events, None

        if action_type == "submit_play":
            if state.get("phase") != "play":
                return [], "cannot play now"
            if player_id != state.get("current_turn"):
                return [], "not your turn"
            try:
                hand_index = int(action.get("hand_index"))
            except (TypeError, ValueError):
                return [], "invalid hand_index"
            zone_id = _validate_zone_id(action.get("zone_id"), ring_count)
            if zone_id is None:
                return [], "invalid zone_id"
            hand = state["players"][player_id]["hand"]
            if hand_index < 0 or hand_index >= len(hand):
                return [], "invalid hand_index"
            thing_card = hand.pop(hand_index)
            auto = _auto_memberships(state["rings"], thing_card)
            if all(value is not None for value in auto):
                actual_zone_id = _memberships_to_zone_id([bool(value) for value in auto])
                return _resolve_play_result(state, player_id, thing_card, zone_id, actual_zone_id), None
            state["phase"] = "judge"
            state["current_turn"] = state.get("knower_id")
            state["pending_judgement"] = {
                "player_id": player_id,
                "thing_card": dict(thing_card),
                "proposed_zone_id": zone_id,
                "auto_memberships": auto,
            }
            return [{"type": "things_in_rings:await_judgement"}], None

        if action_type == "judge_play":
            if state.get("phase") != "judge" or player_id != state.get("knower_id"):
                return [], "cannot judge now"
            pending = state.get("pending_judgement")
            if not isinstance(pending, dict):
                return [], "no pending judgement"
            memberships = _normalize_memberships(action.get("memberships"), ring_count)
            if memberships is None:
                return [], "invalid memberships"
            thing_card = pending["thing_card"]
            resolved, error = _validate_memberships(state["rings"], thing_card, memberships)
            if error:
                return [], error
            actual_zone_id = _memberships_to_zone_id(resolved)
            return (
                _resolve_play_result(
                    state,
                    pending["player_id"],
                    thing_card,
                    pending["proposed_zone_id"],
                    actual_zone_id,
                ),
                None,
            )

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        viewer = state.get("players", {}).get(viewer_id, {})
        phase = state.get("phase")
        knower_id = state.get("knower_id")
        game_over = bool(state.get("game_over"))
        show_rules = game_over or viewer_id == knower_id
        rings = []
        for ring in state.get("rings", []):
            rings.append(
                {
                    "ring_index": ring.get("ring_index"),
                    "type": ring.get("type"),
                    "label": RING_TYPE_LABELS.get(ring.get("type"), "?"),
                    "rule_text": ring.get("text") if show_rules else "Hidden Rule",
                    "evaluation_mode": ring.get("evaluation_mode"),
                }
            )
        zones = _zone_definitions(state.get("rings") or [])
        board_cards = list(state.get("board_cards") or [])
        zone_map = {zone["zone_id"]: [] for zone in zones}
        for entry in board_cards:
            zone_map.setdefault(entry["zone_id"], []).append(
                {
                    "thing_name": entry.get("thing_card", {}).get("name"),
                    "source": entry.get("source"),
                    "placed_by": entry.get("placed_by"),
                    "correct": entry.get("correct"),
                }
            )
        for zone in zones:
            zone["cards"] = zone_map.get(zone["zone_id"], [])
        players = []
        for pid in state.get("turn_order", []):
            meta = state.get("player_meta", {}).get(pid, {})
            pdata = state.get("players", {}).get(pid, {})
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "role": pdata.get("role"),
                    "wins": pdata.get("wins", 0),
                    "cards_left": len(pdata.get("hand") or []),
                    "is_current": pid == state.get("current_turn"),
                }
            )
        seed_hand = []
        if viewer_id == knower_id and phase == "seed_clues":
            for card in state.get("knower_hand", []):
                seed_hand.append(
                    {
                        "id": card.get("id"),
                        "name": card.get("name"),
                        "auto_memberships": _auto_memberships(state.get("rings") or [], card),
                    }
                )
        pending_view = None
        pending = state.get("pending_judgement")
        if isinstance(pending, dict):
            pending_view = {
                "player_id": pending.get("player_id"),
                "player_name": state.get("player_meta", {}).get(pending.get("player_id"), {}).get("name"),
                "thing_card": dict(pending.get("thing_card") or {}),
                "proposed_zone_id": pending.get("proposed_zone_id"),
            }
            if viewer_id == knower_id:
                pending_view["auto_memberships"] = list(pending.get("auto_memberships") or [])
        return {
            "phase": phase,
            "game_over": game_over,
            "you": viewer_id,
            "your_role": viewer.get("role"),
            "knower_id": knower_id,
            "knower_name": state.get("player_meta", {}).get(knower_id, {}).get("name"),
            "current_turn": state.get("current_turn"),
            "current_turn_name": state.get("player_meta", {}).get(state.get("current_turn"), {}).get("name"),
            "rings": rings,
            "zones": zones,
            "players": players,
            "your_hand": [dict(card) for card in viewer.get("hand", [])],
            "seed_hand": seed_hand,
            "seed_clues_remaining": state.get("seed_clues_remaining"),
            "pending_judgement": pending_view,
            "winner_player_id": state.get("winner_player_id"),
            "winner_name": state.get("player_meta", {}).get(state.get("winner_player_id"), {}).get("name"),
            "winner_reason": state.get("winner_reason"),
            "last_resolution": dict(state.get("last_resolution") or {}) if state.get("last_resolution") else None,
            "deck_count": len(state.get("thing_deck") or []),
            "game_index": state.get("game_index"),
            "legal_actions": ThingsInRingsGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        pdata = state.get("players", {}).get(bot_id)
        if not pdata or not pdata.get("is_bot") or state.get("game_over"):
            return None
        rings = state.get("rings") or []
        ring_count = len(rings)
        phase = state.get("phase")
        if phase == "seed_clues" and bot_id == state.get("knower_id"):
            hand = state.get("knower_hand") or []
            if not hand:
                return None
            memberships: List[bool] = []
            auto = _auto_memberships(rings, hand[0])
            for value in auto:
                memberships.append(value if value is not None else random.choice([True, False]))
            return {"type": "submit_seed_clue", "hand_index": 0, "memberships": memberships, "delay_ms": 400}
        if phase == "play" and bot_id == state.get("current_turn"):
            hand = pdata.get("hand") or []
            if not hand:
                return None
            zone_count = 1 << ring_count
            guess = format(random.randrange(zone_count), f"0{ring_count}b")
            return {"type": "submit_play", "hand_index": 0, "zone_id": guess, "delay_ms": 500}
        if phase == "judge" and bot_id == state.get("knower_id"):
            pending = state.get("pending_judgement")
            if not isinstance(pending, dict):
                return None
            memberships = []
            auto = list(pending.get("auto_memberships") or [])
            for value in auto:
                memberships.append(value if value is not None else random.choice([True, False]))
            return {"type": "judge_play", "memberships": memberships, "delay_ms": 450}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
