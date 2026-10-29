"""词语雷达：轮流猜一个服务端随机选择的语义暗词。"""

from __future__ import annotations

import asyncio
import random
import secrets
import sqlite3
import time
import unicodedata
from typing import Dict, List, Optional, Tuple

from game.decrypto_ai import _load_vocabulary
from game.semantic_vectors import get_store


MAX_WORD_LENGTH = 80
DEFAULT_CONFIG: Dict = {}

ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {
            "type": {"const": "submit_guess"},
            "word": {"type": "string", "minLength": 1, "maxLength": MAX_WORD_LENGTH},
            "game_token": {"type": "string", "minLength": 16, "maxLength": 128},
            "turn_number": {"type": "integer", "minimum": 1},
        }, "required": ["type", "word", "game_token", "turn_number"], "additionalProperties": False},
        {"type": "object", "properties": {
            "type": {"const": "skip_turn"},
            "game_token": {"type": "string", "minLength": 16, "maxLength": 128},
            "turn_number": {"type": "integer", "minimum": 1},
        }, "required": ["type", "game_token", "turn_number"], "additionalProperties": False},
        {"type": "object", "properties": {
            "type": {"const": "declare_riichi"},
            "game_token": {"type": "string", "minLength": 16, "maxLength": 128},
            "turn_number": {"type": "integer", "minimum": 1},
        }, "required": ["type", "game_token", "turn_number"], "additionalProperties": False},
    ],
}

CONFIG_SCHEMA = {"type": "object", "properties": {
    "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
}, "additionalProperties": False}

_AVAILABLE_WORDS: Optional[List[str]] = None


def _normalize_word(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(unicodedata.normalize("NFKC", value).strip().casefold().split())


def _load_word_pool() -> List[str]:
    result: List[str] = []
    seen = set()
    for word in _load_vocabulary():
        cleaned = " ".join(word.strip().split()) if isinstance(word, str) else ""
        key = _normalize_word(cleaned)
        if not key or key in seen or len(cleaned) > MAX_WORD_LENGTH:
            continue
        seen.add(key)
        result.append(cleaned)
    return result


def prepare_game(config: Optional[Dict] = None) -> None:
    global _AVAILABLE_WORDS
    store = get_store()
    store.ensure_ready()
    available = store.filter_words(_load_word_pool())
    if not available:
        raise ValueError("semantic word vectors are unavailable")
    _AVAILABLE_WORDS = list(available)


def _word_pool() -> List[str]:
    if _AVAILABLE_WORDS is None:
        prepare_game()
    return list(_AVAILABLE_WORDS or [])


def _merged_config(config: Optional[Dict]) -> Dict:
    return dict(DEFAULT_CONFIG)


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _next_turn(state: Dict) -> None:
    order = state.get("turn_order") or []
    if not order:
        state["current_turn_index"] = 0
        state["current_turn_player_id"] = None
        return
    index = (int(state.get("current_turn_index", 0)) + 1) % len(order)
    state["turn_number"] = int(state.get("turn_number", 1)) + 1
    state["current_turn_index"] = index
    state["current_turn_player_id"] = order[index]


def _similarity(left: str, right: str) -> float:
    try:
        store = get_store()
        if not store.contains(left):
            raise LookupError("missing word")
        score = store.similarity(left, right)
    except LookupError as exc:
        raise ValueError("词语不在语义词库中") from exc
    except (OSError, ValueError, sqlite3.Error) as exc:
        raise ValueError("语义词库暂不可用，请稍后重试") from exc
    if score is None:
        raise ValueError("词语不在语义词库中")
    return max(-1.0, min(1.0, float(score)))


def _validate_guess(state: Dict, player_id: str, action: Dict) -> Tuple[Optional[str], Optional[str]]:
    if not isinstance(action, dict):
        return None, "invalid action"
    if state.get("game_over"):
        return None, "game over"
    if player_id not in state.get("players", {}):
        return None, "unknown player"
    if state.get("phase") != "guessing":
        return None, "game over"
    if state.get("current_turn_player_id") != player_id:
        return None, "not your turn"
    if type(action.get("turn_number")) is not int:
        return None, "invalid turn number"
    if action.get("turn_number") != state.get("turn_number"):
        return None, "turn has changed"
    if not isinstance(action.get("game_token"), str) or action.get("game_token") != state.get("game_token"):
        return None, "game token mismatch"
    action_type = action.get("type")
    if action_type == "declare_riichi":
        if set(action) != {"type", "game_token", "turn_number"}:
            return None, "invalid action"
        if state["players"][player_id].get("riichi"):
            return None, "riichi already declared"
        return None, None
    if action_type == "skip_turn":
        if set(action) != {"type", "game_token", "turn_number"}:
            return None, "invalid action"
        return "", None
    if action_type != "submit_guess" or set(action) != {"type", "word", "game_token", "turn_number"}:
        return None, "invalid action"
    if not isinstance(action.get("word"), str):
        return None, "word required"
    word = _normalize_word(action["word"])
    if not word:
        return None, "word required"
    if len(word) > MAX_WORD_LENGTH:
        return None, "word is too long"
    if word in state.get("guessed_word_keys", []):
        return None, "word already guessed"
    return word, None


def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
    order = _turn_order(players)
    if not 1 <= len(order) <= 10 or len(set(order)) != len(order):
        raise ValueError("1–10 unique players are required")
    pool = _word_pool()
    if not pool:
        raise ValueError("semantic word vectors are unavailable")
    secret = random.SystemRandom().choice(pool)
    return {
        "game_id": "semantic_guess",
        "players": {pid: {"score": 0, "riichi": False} for pid in order},
        "player_meta": {p["player_id"]: dict(p) for p in players},
        "turn_order": order,
        "current_turn_index": 0,
        "turn_number": 1,
        "current_turn_player_id": order[0],
        "phase": "guessing",
        "round_number": 1,
        "round_acted_players": [],
        "round_passed_players": [],
        "guesses": [],
        "guessed_word_keys": [],
        "secret_word": secret,
        "game_token": secrets.token_urlsafe(24),
        "winner_id": None,
        "end_reason": None,
        "game_over": False,
        "config": _merged_config(config),
        "similarity_mode": getattr(get_store(), "mode", "indexed"),
        "game_start_time": time.time(),
    }


def get_legal_actions(state: Dict, player_id: str) -> List[str]:
    if state.get("game_over") or state.get("current_turn_player_id") != player_id:
        return []
    actions = ["submit_guess", "skip_turn"]
    if not state.get("players", {}).get(player_id, {}).get("riichi"):
        actions.append("declare_riichi")
    return actions


def _clear_riichi(state: Dict) -> None:
    for pdata in state.get("players", {}).values():
        if isinstance(pdata, dict):
            pdata["riichi"] = False


def _finish_game(state: Dict, reason: str) -> None:
    state["phase"] = "game_over"
    state["game_over"] = True
    state["current_turn_player_id"] = None
    state["end_reason"] = reason
    _clear_riichi(state)


def _complete_turn(state: Dict, player_id: str, skipped: bool) -> bool:
    order = list(state.get("turn_order") or [])
    acted = state.setdefault("round_acted_players", [])
    passed = state.setdefault("round_passed_players", [])
    if player_id not in acted:
        acted.append(player_id)
    if skipped and player_id not in passed:
        passed.append(player_id)
    _next_turn(state)
    if order and len(set(acted)) >= len(order):
        if len(set(passed)) >= len(order):
            _finish_game(state, "all_passed")
            return True
        state["round_number"] = int(state.get("round_number", 1)) + 1
        acted.clear()
        passed.clear()
        # A riichi lock lasts through the final action in the round.
        _clear_riichi(state)
    return False


def apply_action(state: Dict, player_id: str, action: Dict,
                 similarity_override: Optional[float] = None) -> Tuple[List[Dict], Optional[str]]:
    word, error = _validate_guess(state, player_id, action)
    if error:
        return [], error
    action_type = action.get("type")
    if action_type == "declare_riichi":
        state["players"][player_id]["riichi"] = True
        return [{"type": "semantic_guess:riichi", "payload": {"player_id": player_id}}], None
    if action_type == "skip_turn":
        turn_number = state.get("turn_number")
        state["guesses"].append({"player_id": player_id, "word": None, "similarity": None,
                                  "correct": False, "skipped": True, "turn_number": turn_number})
        ended = _complete_turn(state, player_id, skipped=True)
        return [{"type": "semantic_guess:round_end" if ended else "semantic_guess:skip",
                 "payload": {"player_id": player_id, "end_reason": state.get("end_reason")}}], None
    normalized = _normalize_word(word)
    correct = normalized == _normalize_word(state.get("secret_word"))
    if correct:
        score = 1.0 if similarity_override is None else float(similarity_override)
    else:
        try:
            score = _similarity(word, state["secret_word"]) if similarity_override is None else float(similarity_override)
        except (ValueError, OSError, sqlite3.Error) as exc:
            return [], str(exc)
    entry = {"player_id": player_id, "word": word, "similarity": max(-1.0, min(1.0, score)),
             "correct": correct, "skipped": False, "turn_number": state.get("turn_number")}
    state["guesses"].append(entry)
    state.setdefault("guessed_word_keys", []).append(normalized)
    if correct:
        state["winner_id"] = player_id
        state["players"][player_id]["score"] = state["players"][player_id].get("score", 0) + 1
        _finish_game(state, "correct_guess")
        return [{"type": "semantic_guess:win", "payload": {"player_id": player_id,
                                                              "end_reason": "correct_guess"}}], None
    _complete_turn(state, player_id, skipped=False)
    return [{"type": "semantic_guess:guess", "payload": {"player_id": player_id,
                                                            "similarity": entry["similarity"],
                                                            "end_reason": state.get("end_reason")}}], None


async def apply_action_async(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
    word, error = _validate_guess(state, player_id, action)
    if error:
        return [], error
    if action.get("type") in ("skip_turn", "declare_riichi") or _normalize_word(word) == _normalize_word(state.get("secret_word")):
        return apply_action(state, player_id, action)
    expected = (state.get("current_turn_player_id"), state.get("turn_number"), len(state.get("guesses", [])),
                tuple((pid, bool(data.get("riichi"))) for pid, data in sorted(state.get("players", {}).items())
                      if isinstance(data, dict)))
    try:
        score = await asyncio.to_thread(_similarity, word, state.get("secret_word", ""))
    except (ValueError, OSError, sqlite3.Error) as exc:
        return [], str(exc)
    current = (state.get("current_turn_player_id"), state.get("turn_number"), len(state.get("guesses", [])),
               tuple((pid, bool(data.get("riichi"))) for pid, data in sorted(state.get("players", {}).items())
                     if isinstance(data, dict)))
    if current != expected:
        return [], "game state changed; please try again"
    return apply_action(state, player_id, action, similarity_override=score)


def get_public_view(state: Dict, viewer_id: str) -> Dict:
    meta = state.get("player_meta", {})
    current = state.get("current_turn_player_id")
    players = []
    for pid in state.get("turn_order", []):
        pdata = state.get("players", {}).get(pid, {})
        pmeta = meta.get(pid, {})
        players.append({"player_id": pid, "name": pmeta.get("name", pid), "seat": pmeta.get("seat"),
                        "is_bot": bool(pmeta.get("is_bot")), "score": pdata.get("score", 0),
                        "riichi": bool(pdata.get("riichi")), "is_current": pid == current})
    viewer_riichi = bool(state.get("players", {}).get(viewer_id, {}).get("riichi"))
    guesses = []
    for entry in state.get("guesses", []):
        pid = entry.get("player_id")
        row = dict(entry)
        hidden = bool(not entry.get("skipped") and pid != viewer_id and
                      (bool(state.get("players", {}).get(pid, {}).get("riichi")) or viewer_riichi))
        row["word"] = None if hidden else entry.get("word")
        row["word_hidden"] = hidden
        row["player_name"] = meta.get(pid, {}).get("name", pid)
        row["is_you"] = pid == viewer_id
        guesses.append(row)
    view = {"game_id": "semantic_guess", "you": viewer_id, "phase": state.get("phase"),
            "players": players, "current_turn_player_id": current, "turn_number": state.get("turn_number"),
            "round_number": state.get("round_number", 1), "game_token": state.get("game_token"),
            "guesses": guesses, "legal_actions": get_legal_actions(state, viewer_id),
            "similarity_mode": state.get("similarity_mode", "unknown"), "game_over": bool(state.get("game_over"))}
    if state.get("game_over"):
        winner = state.get("winner_id")
        view.update({"winner_id": winner, "end_reason": state.get("end_reason"),
                     "secret_word": state.get("secret_word"), "winner_name": meta.get(winner, {}).get("name")})
    return view


def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
    if bot_id not in state.get("players", {}) or state.get("game_over") or state.get("current_turn_player_id") != bot_id:
        return None
    guessed = set(state.get("guessed_word_keys", []))
    candidates = [word for word in _word_pool() if _normalize_word(word) not in guessed]
    if not candidates:
        return {"type": "skip_turn", "game_token": state.get("game_token"), "turn_number": state.get("turn_number")}
    return {"type": "submit_guess", "word": random.choice(candidates),
            "game_token": state.get("game_token"), "turn_number": state.get("turn_number")}


def serialize(state: Dict) -> Dict:
    return state


def deserialize(payload: Dict) -> Dict:
    if not isinstance(payload, dict):
        raise ValueError("invalid semantic guess state")
    return payload


class SemanticGuessGame:
    game_id = "semantic_guess"
    min_players = 1
    max_players = 10
    init_game = staticmethod(init_game)
    get_legal_actions = staticmethod(get_legal_actions)
    apply_action = staticmethod(apply_action)
    run_in_worker = True
    prepare_game = staticmethod(prepare_game)
    apply_action_async = staticmethod(apply_action_async)
    get_public_view = staticmethod(get_public_view)
    bot_move = staticmethod(bot_move)
    serialize = staticmethod(serialize)
    deserialize = staticmethod(deserialize)
