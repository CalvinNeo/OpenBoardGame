import base64
import copy
import hashlib
import json
import math
import random
import secrets
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.memories import (
    build_html_document,
    esc,
    format_bool,
    format_timestamp,
    render_image,
    render_kv_table,
    render_table,
    section,
)


DEFAULT_CONFIG = {"word_column": 1}
ROUND_COUNTS = {4: 8, 5: 10, 6: 6, 7: 7, 8: 8}
SLOT_IDS = tuple("ABCDEFG")

MAX_STROKES = 100
MAX_POINTS_PER_STROKE = 300
MAX_TOTAL_POINTS = 4000

_WORD_CARDS_CACHE: Optional[List[Dict]] = None


def _word_cards_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "subtext_words.json"


def _clean_word(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _word_key(value: object) -> str:
    return "".join(_clean_word(value).casefold().split())


def _load_word_cards() -> List[Dict]:
    global _WORD_CARDS_CACHE
    if _WORD_CARDS_CACHE is not None:
        return copy.deepcopy(_WORD_CARDS_CACHE)

    try:
        with _word_cards_path().open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"unable to load Subtext word pack: {exc}") from exc

    raw_cards = payload.get("cards") if isinstance(payload, dict) else None
    if not isinstance(raw_cards, list):
        raise ValueError("Subtext word pack must contain a cards list")

    cards: List[Dict] = []
    card_ids = set()
    seen_by_column = {str(column): set() for column in range(1, 6)}
    for raw_card in raw_cards:
        if not isinstance(raw_card, dict):
            raise ValueError("Subtext word cards must be objects")
        card_id = raw_card.get("id")
        raw_words = raw_card.get("words")
        if not isinstance(card_id, str) or not card_id.strip() or card_id in card_ids:
            raise ValueError("Subtext word card ids must be unique non-empty strings")
        if not isinstance(raw_words, dict):
            raise ValueError(f"Subtext card {card_id} is missing words")
        words: Dict[str, Dict[str, str]] = {}
        for column in range(1, 6):
            key = str(column)
            raw_entry = raw_words.get(key)
            if isinstance(raw_entry, str):
                text = _clean_word(raw_entry)
                template = ""
            elif isinstance(raw_entry, dict):
                text = _clean_word(raw_entry.get("text"))
                template = _clean_word(raw_entry.get("bot_template"))
            else:
                text = ""
                template = ""
            normalized = _word_key(text)
            if not text:
                raise ValueError(f"Subtext card {card_id} has no word in column {column}")
            if normalized in seen_by_column[key]:
                raise ValueError(f"duplicate Subtext word in column {column}: {text}")
            seen_by_column[key].add(normalized)
            words[key] = {"text": text, "bot_template": template}
        card_ids.add(card_id)
        cards.append({"id": card_id, "words": words})

    if len(cards) < 56:
        raise ValueError("Subtext word pack needs at least 56 complete cards")
    _WORD_CARDS_CACHE = cards
    return copy.deepcopy(cards)


def _merge_config(config: Optional[Dict]) -> Tuple[Dict, str]:
    column = DEFAULT_CONFIG["word_column"]
    seed: object = secrets.token_hex(16)
    if isinstance(config, dict):
        raw_column = config.get("word_column", column)
        if isinstance(raw_column, int) and not isinstance(raw_column, bool) and 1 <= raw_column <= 5:
            column = raw_column
        raw_seed = config.get("seed")
        if isinstance(raw_seed, (str, int)) and not isinstance(raw_seed, bool):
            if str(raw_seed).strip():
                seed = raw_seed
    return {"word_column": column}, str(seed)


def _next_rng(state: Dict, purpose: str) -> random.Random:
    counter = int(state.get("rng_counter", 0))
    material = f"{state.get('rng_seed', '')}|{state.get('game_index', 1)}|{counter}|{purpose}"
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    state["rng_counter"] = counter + 1
    return random.Random(int.from_bytes(digest[:16], "big"))


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    meta = state.get("player_meta", {}).get(player_id, {})
    return str(meta.get("name") or player_id)


def _new_word_deck(state: Dict) -> None:
    cards = _load_word_cards()
    needed = int(state["total_rounds"]) * (len(state["turn_order"]) - 1)
    if len(cards) < needed:
        raise ValueError(f"Subtext word pack needs {needed} cards for this game")
    state["word_cards"] = {card["id"]: card for card in cards}
    state["word_deck"] = [card["id"] for card in cards]
    _next_rng(state, "word-deck").shuffle(state["word_deck"])
    state["used_card_ids"] = []


def _draw_card_ids(state: Dict, count: int) -> List[str]:
    if len(state.get("word_deck", [])) < count:
        raise ValueError("Subtext word deck was exhausted")
    drawn = [state["word_deck"].pop() for _ in range(count)]
    state["used_card_ids"].extend(drawn)
    return drawn


def _start_round(state: Dict) -> None:
    order = state["turn_order"]
    round_number = int(state["round"])
    dealer_index = (int(state["first_dealer_index"]) + round_number - 1) % len(order)
    dealer_id = order[dealer_index]
    non_dealers = [pid for pid in order if pid != dealer_id]
    card_ids = _draw_card_ids(state, len(order) - 1)
    target_card_id = card_ids[0]
    decoy_card_ids = card_ids[1:]
    partner_id = _next_rng(state, f"partner-{round_number}").choice(non_dealers)
    decoy_players = [pid for pid in non_dealers if pid != partner_id]
    _next_rng(state, f"decoys-{round_number}").shuffle(decoy_card_ids)

    column = str(state["config"]["word_column"])
    target_word = state["word_cards"][target_card_id]["words"][column]["text"]
    assignments = {
        dealer_id: {"card_id": target_card_id, "word": target_word},
        partner_id: {"card_id": target_card_id, "word": target_word},
    }
    for player_id, card_id in zip(decoy_players, decoy_card_ids):
        assignments[player_id] = {
            "card_id": card_id,
            "word": state["word_cards"][card_id]["words"][column]["text"],
        }

    state.update(
        {
            "phase": "drawing",
            "dealer_id": dealer_id,
            "partner_id": partner_id,
            "target_card_id": target_card_id,
            "target_word": target_word,
            "secret_assignments": assignments,
            "drawings": {},
            "slot_order": [],
            "slot_by_player": {},
            "votes": {},
            "next_round_ready": [],
            "last_round_summary": None,
            "game_over": False,
            "winner_ids": [],
        }
    )


def _make_slots(state: Dict) -> None:
    non_dealers = [pid for pid in state["turn_order"] if pid != state["dealer_id"]]
    _next_rng(state, f"slots-{state['round']}").shuffle(non_dealers)
    state["slot_order"] = non_dealers
    state["slot_by_player"] = {
        player_id: SLOT_IDS[index] for index, player_id in enumerate(non_dealers)
    }
    state["phase"] = "guessing"


def _normalize_drawing(value: object) -> Tuple[Optional[List[List[List[float]]]], Optional[str]]:
    if not isinstance(value, list) or not value:
        return None, "drawing must contain at least one stroke"
    if len(value) > MAX_STROKES:
        return None, f"drawing may contain at most {MAX_STROKES} strokes"
    drawing: List[List[List[float]]] = []
    total_points = 0
    for raw_stroke in value:
        if not isinstance(raw_stroke, list) or not raw_stroke:
            return None, "each stroke must contain at least one point"
        if len(raw_stroke) > MAX_POINTS_PER_STROKE:
            return None, f"a stroke may contain at most {MAX_POINTS_PER_STROKE} points"
        stroke: List[List[float]] = []
        for raw_point in raw_stroke:
            if not isinstance(raw_point, (list, tuple)) or len(raw_point) != 2:
                return None, "drawing points must be [x, y] pairs"
            x, y = raw_point
            if (
                isinstance(x, bool)
                or isinstance(y, bool)
                or not isinstance(x, (int, float))
                or not isinstance(y, (int, float))
            ):
                return None, "drawing coordinates must be numbers"
            x_float = float(x)
            y_float = float(y)
            if not math.isfinite(x_float) or not math.isfinite(y_float):
                return None, "drawing coordinates must be finite"
            if not 0.0 <= x_float <= 1.0 or not 0.0 <= y_float <= 1.0:
                return None, "drawing coordinates must be between 0 and 1"
            stroke.append([round(x_float, 5), round(y_float, 5)])
            total_points += 1
            if total_points > MAX_TOTAL_POINTS:
                return None, f"drawing may contain at most {MAX_TOTAL_POINTS} points"
        drawing.append(stroke)
    return drawing, None


def _score_round(state: Dict) -> None:
    order = state["turn_order"]
    dealer_id = state["dealer_id"]
    partner_id = state["partner_id"]
    partner_slot = state["slot_by_player"][partner_id]
    correct = {pid: state["votes"].get(pid) == partner_slot for pid in order}
    correct_count = sum(1 for is_correct in correct.values() if is_correct)
    wrong_count = len(order) - correct_count
    round_points = {pid: 0 for pid in order}

    if correct[dealer_id] and correct[partner_id]:
        round_points[dealer_id] = wrong_count
        round_points[partner_id] = wrong_count
    for pid in order:
        if pid not in (dealer_id, partner_id) and correct[pid]:
            round_points[pid] = wrong_count + 1
    for pid, points in round_points.items():
        state["players"][pid]["score"] += points

    summary = {
        "round": int(state["round"]),
        "dealer_id": dealer_id,
        "dealer_drawing": copy.deepcopy(state["drawings"][dealer_id]),
        "partner_id": partner_id,
        "target_word": state["target_word"],
        "partner_slot": partner_slot,
        "wrong_count": wrong_count,
        "correct_count": correct_count,
        "slots": [
            {
                "slot_id": state["slot_by_player"][pid],
                "player_id": pid,
                "drawing": copy.deepcopy(state["drawings"][pid]),
            }
            for pid in state["slot_order"]
        ],
        "guesses": {
            pid: {"slot_id": state["votes"][pid], "correct": correct[pid]}
            for pid in order
        },
        "round_points": round_points,
        "scores_after_round": {
            pid: int(state["players"][pid]["score"]) for pid in order
        },
    }
    state["last_round_summary"] = summary
    state["round_history"].append(copy.deepcopy(summary))
    state["next_round_ready"] = []

    if int(state["round"]) >= int(state["total_rounds"]):
        high_score = max(player["score"] for player in state["players"].values())
        state["winner_ids"] = [
            pid for pid in order if state["players"][pid]["score"] == high_score
        ]
        state["phase"] = "game_over"
        state["game_over"] = True
        state["game_end_time"] = time.time()
    else:
        state["phase"] = "round_result"


def _public_summary(summary: Optional[Dict]) -> Optional[Dict]:
    return copy.deepcopy(summary) if isinstance(summary, dict) else None


def _reset_for_play_again(state: Dict) -> None:
    state["game_index"] = int(state.get("game_index", 1)) + 1
    state["round"] = 1
    state["round_history"] = []
    state["last_round_summary"] = None
    state["rng_counter"] = 0
    state["game_start_time"] = time.time()
    state["game_end_time"] = None
    for player in state["players"].values():
        player["score"] = 0
    _new_word_deck(state)
    state["first_dealer_index"] = _next_rng(state, "first-dealer").randrange(
        len(state["turn_order"])
    )
    _start_round(state)


def _drawing_signature(drawing: object) -> Tuple[float, float, float, float, float, float]:
    points: List[Tuple[float, float]] = []
    stroke_count = 0
    if isinstance(drawing, list):
        for stroke in drawing:
            if not isinstance(stroke, list):
                continue
            stroke_points = []
            for point in stroke:
                if isinstance(point, (list, tuple)) and len(point) == 2:
                    try:
                        x, y = float(point[0]), float(point[1])
                    except (TypeError, ValueError):
                        continue
                    if math.isfinite(x) and math.isfinite(y):
                        stroke_points.append((x, y))
            if stroke_points:
                stroke_count += 1
                points.extend(stroke_points)
    if not points:
        return (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return (
        sum(xs) / len(xs),
        sum(ys) / len(ys),
        max(xs) - min(xs),
        max(ys) - min(ys),
        min(len(points), 500) / 500.0,
        min(stroke_count, 20) / 20.0,
    )


def _signature_distance(left: Tuple[float, ...], right: Tuple[float, ...]) -> float:
    return sum((a - b) ** 2 for a, b in zip(left, right))


def _bot_drawing(word: str, bot_id: str) -> List[List[List[float]]]:
    word_digest = hashlib.sha256(_word_key(word).encode("utf-8")).digest()
    bot_digest = hashlib.sha256(f"{word}|{bot_id}".encode("utf-8")).digest()
    shape = word_digest[0] % 5
    jitter_x = (bot_digest[0] / 255.0 - 0.5) * 0.035
    jitter_y = (bot_digest[1] / 255.0 - 0.5) * 0.035

    def point(x: float, y: float) -> List[float]:
        return [round(min(0.96, max(0.04, x + jitter_x)), 5), round(min(0.96, max(0.04, y + jitter_y)), 5)]

    if shape == 0:
        ring = [point(0.5 + 0.28 * math.cos(index * math.pi / 12), 0.5 + 0.28 * math.sin(index * math.pi / 12)) for index in range(25)]
        return [ring, [point(0.31, 0.69), point(0.69, 0.31)]]
    if shape == 1:
        return [
            [point(0.2, 0.5), point(0.5, 0.2), point(0.8, 0.5), point(0.5, 0.8), point(0.2, 0.5)],
            [point(0.5, 0.2), point(0.5, 0.8)],
        ]
    if shape == 2:
        return [
            [point(0.2, 0.72), point(0.5, 0.25), point(0.8, 0.72), point(0.2, 0.72)],
            [point(0.34, 0.58), point(0.66, 0.58)],
        ]
    if shape == 3:
        wave = [point(0.14 + index * 0.06, 0.5 + 0.2 * math.sin(index * math.pi / 3)) for index in range(13)]
        return [wave]
    spiral = []
    for index in range(32):
        angle = index * math.pi / 5
        radius = 0.03 + index * 0.008
        spiral.append(point(0.5 + radius * math.cos(angle), 0.5 + radius * math.sin(angle)))
    return [spiral]


class SubtextGame:
    game_id = "subtext"
    min_players = 4
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not isinstance(players, list) or not SubtextGame.min_players <= len(players) <= SubtextGame.max_players:
            raise ValueError("Subtext requires 4 to 8 players")
        ordered_players = sorted(players, key=lambda item: item.get("seat", 0))
        order = [player.get("player_id") for player in ordered_players]
        if any(not isinstance(pid, str) or not pid for pid in order) or len(set(order)) != len(order):
            raise ValueError("Subtext players need unique player ids")
        cfg, seed = _merge_config(config)
        player_meta = {player["player_id"]: copy.deepcopy(player) for player in ordered_players}
        state = {
            "game_id": SubtextGame.game_id,
            "game_index": 1,
            "phase": "drawing",
            "config": cfg,
            "rng_seed": seed,
            "rng_counter": 0,
            "turn_order": order,
            "first_dealer_index": 0,
            "dealer_id": None,
            "partner_id": None,
            "round": 1,
            "total_rounds": ROUND_COUNTS[len(order)],
            "players": {
                pid: {
                    "score": 0,
                    "is_bot": bool(player_meta[pid].get("is_bot")),
                }
                for pid in order
            },
            "player_meta": player_meta,
            "secret_assignments": {},
            "drawings": {},
            "slot_order": [],
            "slot_by_player": {},
            "votes": {},
            "next_round_ready": [],
            "last_round_summary": None,
            "round_history": [],
            "winner_ids": [],
            "game_over": False,
            "game_start_time": time.time(),
            "game_end_time": None,
        }
        _new_word_deck(state)
        state["first_dealer_index"] = _next_rng(state, "first-dealer").randrange(len(order))
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "drawing" and player_id not in state.get("drawings", {}):
            return ["submit_drawing"]
        if phase == "guessing" and player_id not in state.get("votes", {}):
            return ["submit_guess"]
        if phase == "round_result" and player_id not in set(state.get("next_round_ready", [])):
            return ["next_round"]
        if phase == "game_over":
            return ["play_again"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        action_type = action.get("type") if isinstance(action, dict) else None
        if action_type not in SubtextGame.get_legal_actions(state, player_id):
            return [], "invalid action"

        if action_type == "submit_drawing":
            drawing, error = _normalize_drawing(action.get("drawing"))
            if error:
                return [], error
            state["drawings"][player_id] = drawing
            events = [{"type": "subtext:drawing_submitted", "payload": {"player_id": player_id}}]
            if len(state["drawings"]) == len(state["turn_order"]):
                _make_slots(state)
                events.append({"type": "subtext:guessing_started"})
            return events, None

        if action_type == "submit_guess":
            slot_id = action.get("slot_id")
            valid_slots = set(state.get("slot_by_player", {}).values())
            if not isinstance(slot_id, str) or slot_id not in valid_slots:
                return [], "invalid candidate slot"
            state["votes"][player_id] = slot_id
            events = [{"type": "subtext:guess_submitted", "payload": {"player_id": player_id}}]
            if len(state["votes"]) == len(state["turn_order"]):
                _score_round(state)
                events.append({"type": "subtext:round_revealed", "payload": {"round": state["round"]}})
            return events, None

        if action_type == "next_round":
            state["next_round_ready"].append(player_id)
            events = [{"type": "subtext:next_round_ready", "payload": {"player_id": player_id}}]
            if len(state["next_round_ready"]) == len(state["turn_order"]):
                state["round"] = int(state["round"]) + 1
                _start_round(state)
                events.append({"type": "subtext:round_started", "payload": {"round": state["round"]}})
            return events, None

        if action_type == "play_again":
            _reset_for_play_again(state)
            return [{"type": "subtext:game_restarted", "payload": {"game_index": state["game_index"]}}], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        order = list(state.get("turn_order", []))
        phase = state.get("phase")
        players = []
        ready = set(state.get("next_round_ready", []))
        for pid in order:
            meta = state.get("player_meta", {}).get(pid, {})
            pdata = state.get("players", {}).get(pid, {})
            players.append(
                {
                    "player_id": pid,
                    "name": meta.get("name") or pid,
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "score": int(pdata.get("score", 0)),
                    "drawing_submitted": pid in state.get("drawings", {}),
                    "guess_submitted": pid in state.get("votes", {}),
                    "next_round_ready": pid in ready,
                }
            )
        view = {
            "game_id": SubtextGame.game_id,
            "you": viewer_id,
            "game_index": int(state.get("game_index", 1)),
            "phase": phase,
            "config": {"word_column": state.get("config", {}).get("word_column", 1)},
            "round": int(state.get("round", 1)),
            "total_rounds": int(state.get("total_rounds", 1)),
            "dealer_id": state.get("dealer_id"),
            "players": players,
            "scores": {pid: int(state["players"][pid].get("score", 0)) for pid in order},
            "drawing_progress": {"done": len(state.get("drawings", {})), "total": len(order)},
            "guess_progress": {"done": len(state.get("votes", {})), "total": len(order)},
            "next_round_progress": {"done": len(ready), "total": len(order)},
            "last_round_summary": None,
            "winner_ids": list(state.get("winner_ids", [])) if phase == "game_over" else [],
            "game_over": bool(state.get("game_over")),
            "legal_actions": SubtextGame.get_legal_actions(state, viewer_id),
        }
        if viewer_id in state.get("secret_assignments", {}) and phase in ("drawing", "guessing"):
            view["your_word"] = state["secret_assignments"][viewer_id]["word"]
        if phase == "drawing":
            view["your_drawing"] = copy.deepcopy(state.get("drawings", {}).get(viewer_id))
        elif phase == "guessing":
            view["dealer_drawing"] = copy.deepcopy(state["drawings"].get(state["dealer_id"]))
            view["candidates"] = [
                {
                    "slot_id": state["slot_by_player"][pid],
                    "drawing": copy.deepcopy(state["drawings"][pid]),
                    "is_yours": pid == viewer_id,
                }
                for pid in state.get("slot_order", [])
            ]
            if viewer_id in state.get("votes", {}):
                view["your_guess"] = state["votes"][viewer_id]
        elif phase in ("round_result", "game_over"):
            view["last_round_summary"] = _public_summary(state.get("last_round_summary"))
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = SubtextGame.get_legal_actions(state, bot_id)
        if not legal:
            return None
        view = SubtextGame.get_public_view(state, bot_id)
        phase = view.get("phase")
        if phase == "drawing":
            return {
                "type": "submit_drawing",
                "drawing": _bot_drawing(str(view.get("your_word") or "mystery"), bot_id),
                "delay_ms": 450,
            }
        if phase == "guessing":
            candidates = view.get("candidates") or []
            if not candidates:
                return None
            dealer_signature = _drawing_signature(view.get("dealer_drawing"))
            ranked = sorted(
                candidates,
                key=lambda candidate: (
                    _signature_distance(dealer_signature, _drawing_signature(candidate.get("drawing"))),
                    str(candidate.get("slot_id")),
                ),
            )
            return {"type": "submit_guess", "slot_id": ranked[0]["slot_id"], "delay_ms": 450}
        if phase == "round_result":
            return {"type": "next_round", "delay_ms": 350}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload

    @staticmethod
    def download_memories(state: Dict, room_id: Optional[str] = None) -> str:
        return build_memories_html(state, room_id)


def _drawing_data_url(drawing: object, width: int = 640, height: int = 480) -> Optional[str]:
    normalized, error = _normalize_drawing(drawing)
    if error or not normalized:
        return None
    paths = []
    for stroke in normalized:
        if not stroke:
            continue
        coordinates = [(point[0] * width, point[1] * height) for point in stroke]
        if len(coordinates) == 1:
            x, y = coordinates[0]
            paths.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.5" fill="#172554" />')
            continue
        commands = [f"M {coordinates[0][0]:.2f} {coordinates[0][1]:.2f}"]
        commands.extend(f"L {x:.2f} {y:.2f}" for x, y in coordinates[1:])
        paths.append(
            f'<path d="{" ".join(commands)}" fill="none" stroke="#172554" '
            'stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />'
        )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}"><rect width="100%" height="100%" fill="#fffdf5" />'
        + "".join(paths)
        + "</svg>"
    )
    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    order = list(state.get("turn_order", []))
    history = [entry for entry in state.get("round_history", []) if isinstance(entry, dict)]
    status = "Game Over" if state.get("game_over") else "In Progress"
    header = (
        "<h1>Subtext Memories</h1>"
        f'<div class="meta">Room: {esc(room_id, "-")} · Status: {esc(status, status)}</div>'
        f'<div class="meta">Started: {esc(format_timestamp(state.get("game_start_time")), "-")}</div>'
        f'<div class="meta">Generated: {esc(format_timestamp(time.time()), "-")}</div>'
    )
    player_rows = []
    for pid in order:
        meta = state.get("player_meta", {}).get(pid, {})
        player_rows.append(
            [
                esc(pid, "-"),
                esc(meta.get("name"), "-"),
                esc(meta.get("seat"), "-"),
                format_bool(meta.get("is_bot")),
                esc(state.get("players", {}).get(pid, {}).get("score", 0), "0"),
            ]
        )
    players_section = section(
        "Players",
        render_table(["Player ID", "Name", "Seat", "Bot", "Score"], player_rows),
    )
    config_section = section(
        "Config",
        render_kv_table(
            [
                ("Word Set", esc(state.get("config", {}).get("word_column"), "1")),
                ("Rounds", esc(state.get("total_rounds"), "-")),
                ("Completed", esc(len(history), "0")),
            ]
        ),
    )
    current_round_section = ""
    if state.get("phase") in ("drawing", "guessing"):
        current_round_section = section(
            "Current Round",
            f'<div class="muted">Round in progress ({esc(state.get("round"), "-")}). '
            "Unrevealed words, drawings, roles, and guesses are intentionally hidden.</div>",
        )
    round_sections = []
    for summary in history:
        dealer_id = summary.get("dealer_id")
        partner_id = summary.get("partner_id")
        facts = render_kv_table(
            [
                ("Target", esc(summary.get("target_word"), "-")),
                ("Dealer", esc(_player_name(state, dealer_id), "-")),
                ("Partner", esc(_player_name(state, partner_id), "-")),
                ("Partner Slot", esc(summary.get("partner_slot"), "-")),
                ("Wrong Guesses", esc(summary.get("wrong_count"), "0")),
            ]
        )
        drawing_cells = [
            '<div class="subtext-memory-drawing">'
            '<div class="small">Dealer · '
            + esc(_player_name(state, dealer_id), "-")
            + "</div>"
            + render_image(_drawing_data_url(summary.get("dealer_drawing")), alt="Dealer drawing")
            + "</div>"
        ]
        for slot in summary.get("slots", []):
            pid = slot.get("player_id")
            badge = " · Partner" if pid == partner_id else ""
            drawing_cells.append(
                '<div class="subtext-memory-drawing">'
                f'<div class="small">{esc(slot.get("slot_id"), "-")} · {esc(_player_name(state, pid), "-")}{badge}</div>'
                + render_image(_drawing_data_url(slot.get("drawing")), alt="Candidate drawing")
                + "</div>"
            )
        guess_rows = []
        guesses = summary.get("guesses", {})
        points = summary.get("round_points", {})
        scores = summary.get("scores_after_round", {})
        for pid in order:
            guess = guesses.get(pid, {})
            guess_rows.append(
                [
                    esc(_player_name(state, pid), "-"),
                    esc(guess.get("slot_id"), "-"),
                    format_bool(guess.get("correct")),
                    esc(points.get(pid, 0), "0"),
                    esc(scores.get(pid, 0), "0"),
                ]
            )
        body = (
            facts
            + '<div class="subtext-memory-grid">'
            + "".join(drawing_cells)
            + "</div>"
            + render_table(["Player", "Guess", "Correct", "Round", "Total"], guess_rows)
        )
        round_sections.append(section(f"Round {summary.get('round', '?')}", body))
    if not round_sections:
        round_sections.append(section("Rounds", '<div class="muted">No completed rounds yet.</div>'))
    extra_style = """
.subtext-memory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin: 12px 0;
}
.subtext-memory-drawing {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 8px;
  background: #fffdf5;
}
.subtext-memory-drawing img {
  width: 100%;
}
"""
    return build_html_document(
        "Subtext Memories",
        header + players_section + config_section + current_round_section + "".join(round_sections),
        extra_style=extra_style,
    )


download_memories = build_memories_html
