import json
import math
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.draw_guess_templates import _bot_svg_for_prompt, _salt_prompt
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

DEFAULT_CONFIG = {
    "draw_total": 20,
    "guess_total": 10,
    "draw_time_sec": 3,
    "skip_reveal_sec": 2,
}

DRAW_TIME_OPTIONS = (1, 1.5, 2, 2.5, 3, 4)

_PROMPT_POOL_CACHE: Optional[List[str]] = None
_PROMPT_BAG: List[str] = []


def _prompt_pool_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "blitz_sketch_words.json"


def _normalize_int(value: object, minimum: int) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < minimum:
        return None
    return parsed


def _normalize_draw_time(value: object) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed):
        return None
    for allowed in DRAW_TIME_OPTIONS:
        if abs(parsed - allowed) < 1e-6:
            return allowed
    return None


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = dict(DEFAULT_CONFIG)
    if not isinstance(config, dict):
        return cfg
    draw_total = _normalize_int(config.get("draw_total"), 1)
    if draw_total is not None:
        cfg["draw_total"] = draw_total
    guess_total = _normalize_int(config.get("guess_total"), 1)
    if guess_total is not None:
        cfg["guess_total"] = guess_total
    draw_time_sec = _normalize_draw_time(config.get("draw_time_sec"))
    if draw_time_sec is not None:
        cfg["draw_time_sec"] = draw_time_sec
    skip_reveal_sec = _normalize_int(config.get("skip_reveal_sec"), 0)
    if skip_reveal_sec is not None:
        cfg["skip_reveal_sec"] = skip_reveal_sec
    if cfg["guess_total"] > cfg["draw_total"]:
        cfg["guess_total"] = cfg["draw_total"]
    return cfg


def _load_prompt_pool() -> List[str]:
    global _PROMPT_POOL_CACHE
    if _PROMPT_POOL_CACHE is not None:
        return list(_PROMPT_POOL_CACHE)
    pool: List[str] = []
    path = _prompt_pool_path()
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            data = data.get("words") or data.get("prompts") or data.get("items")
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, str):
                    continue
                cleaned = " ".join(item.strip().split())
                if cleaned:
                    pool.append(cleaned)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"[blitz_sketch] failed to load prompts: {exc}", flush=True)
    if not pool:
        pool = ["苹果", "雨伞", "香蕉", "鱼", "花", "云"]
    _PROMPT_POOL_CACHE = pool
    return list(pool)


def _draw_prompt_choices(prompt_pool: List[str], count: int) -> List[str]:
    if count <= 0:
        return []
    global _PROMPT_BAG
    if not _PROMPT_BAG:
        _PROMPT_BAG = list(prompt_pool)
        random.shuffle(_PROMPT_BAG)
    choices: List[str] = []
    while len(choices) < count:
        if not _PROMPT_BAG:
            _PROMPT_BAG = list(prompt_pool)
            random.shuffle(_PROMPT_BAG)
        take = min(count - len(choices), len(_PROMPT_BAG))
        start = len(_PROMPT_BAG) - take
        choices.extend(_PROMPT_BAG[start:])
        del _PROMPT_BAG[start:]
    return choices


def _normalize_text(value: Optional[str]) -> str:
    if not isinstance(value, str):
        return ""
    return "".join(value.strip().split())


def _is_correct_guess(guess: str, answer: str) -> bool:
    return _normalize_text(guess) == _normalize_text(answer)


def _guess_order(draw_total: int, guess_total: int) -> List[int]:
    order = list(range(draw_total))
    random.shuffle(order)
    return order[: min(guess_total, draw_total)]


def _player_draw_done(pdata: Dict, draw_total: int) -> bool:
    return pdata.get("draw_index", 0) >= draw_total


def _player_guess_done(pdata: Dict, guess_total: int) -> bool:
    return pdata.get("guess_index", 0) >= guess_total


def _clear_expired_reveal(pdata: Dict) -> None:
    reveal = pdata.get("reveal")
    if not isinstance(reveal, dict):
        return
    until_ms = reveal.get("until_ms")
    if not isinstance(until_ms, (int, float)):
        return
    if until_ms <= time.time() * 1000:
        pdata["reveal"] = None


def _build_review(state: Dict) -> Dict:
    order = state.get("turn_order", [])
    player_meta = state.get("player_meta", {})
    review_players = []
    for pid in order:
        pdata = state.get("players", {}).get(pid, {})
        meta = player_meta.get(pid, {})
        drawings_view = []
        drawings = pdata.get("drawings", []) or []
        guess_order = pdata.get("guess_order") or []
        guesses = pdata.get("guesses") or {}
        guess_set = set(guess_order)
        for idx, entry in enumerate(drawings):
            guess_entry = guesses.get(idx) if isinstance(guesses, dict) else None
            drawings_view.append(
                {
                    "index": idx,
                    "prompt": entry.get("prompt"),
                    "image_data": entry.get("image_data"),
                    "guessed": idx in guess_set,
                    "guess_text": guess_entry.get("guess") if isinstance(guess_entry, dict) else None,
                    "correct": guess_entry.get("correct") if isinstance(guess_entry, dict) else None,
                }
            )
        review_players.append(
            {
                "player_id": pid,
                "name": meta.get("name"),
                "seat": meta.get("seat"),
                "is_bot": meta.get("is_bot"),
                "score": pdata.get("score", 0),
                "drawings": drawings_view,
            }
        )
    return {"players": review_players}


class BlitzSketchGame:
    game_id = "blitz_sketch"
    min_players = 1
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        draw_total = cfg["draw_total"]
        prompt_pool = _load_prompt_pool()
        order = [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]
        player_meta = {p["player_id"]: p for p in players}
        players_state = {}
        for pid in order:
            prompts = _draw_prompt_choices(prompt_pool, draw_total)
            drawings = [{"prompt": prompt, "image_data": None} for prompt in prompts]
            players_state[pid] = {
                "draw_index": 0,
                "drawings": drawings,
                "guess_order": [],
                "guess_index": 0,
                "guesses": {},
                "score": 0,
                "feedback": None,
                "reveal": None,
            }
        return {
            "players": players_state,
            "turn_order": order,
            "phase": "draw",
            "config": cfg,
            "prompt_pool": prompt_pool,
            "player_meta": player_meta,
            "game_over": False,
            "game_start_time": time.time(),
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        pdata = state["players"][player_id]
        _clear_expired_reveal(pdata)
        phase = state.get("phase")
        cfg = state.get("config", DEFAULT_CONFIG)
        draw_total = cfg.get("draw_total", DEFAULT_CONFIG["draw_total"])
        guess_total = min(
            cfg.get("guess_total", DEFAULT_CONFIG["guess_total"]),
            draw_total,
        )
        if phase == "draw":
            if _player_draw_done(pdata, draw_total):
                return []
            return ["submit_drawing"]
        if phase == "guess":
            if _player_guess_done(pdata, guess_total):
                return []
            reveal = pdata.get("reveal")
            if isinstance(reveal, dict):
                until_ms = reveal.get("until_ms")
                if isinstance(until_ms, (int, float)) and until_ms > time.time() * 1000:
                    return []
            return ["submit_guess", "skip_guess"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        pdata = state["players"][player_id]
        _clear_expired_reveal(pdata)
        phase = state.get("phase")
        cfg = state.get("config", DEFAULT_CONFIG)
        draw_total = cfg.get("draw_total", DEFAULT_CONFIG["draw_total"])
        guess_total = min(
            cfg.get("guess_total", DEFAULT_CONFIG["guess_total"]),
            draw_total,
        )
        action_type = action.get("type")
        if phase == "draw":
            if action_type != "submit_drawing":
                return [], "invalid action"
            if _player_draw_done(pdata, draw_total):
                return [], "drawing complete"
            image_data = action.get("image_data")
            if not isinstance(image_data, str) or not image_data.strip():
                return [], "image_data required"
            index = pdata.get("draw_index", 0)
            if not isinstance(index, int) or index < 0:
                index = 0
            if index >= draw_total:
                return [], "drawing complete"
            drawings = pdata.get("drawings", [])
            if index < len(drawings):
                drawings[index]["image_data"] = image_data
            pdata["draw_index"] = index + 1
            if all(_player_draw_done(p, draw_total) for p in state["players"].values()):
                state["phase"] = "guess"
                for pid, pdata_local in state["players"].items():
                    order = _guess_order(draw_total, guess_total)
                    pdata_local["guess_order"] = order
                    pdata_local["guess_index"] = 0
                    pdata_local["guesses"] = {}
                    pdata_local["feedback"] = None
                    pdata_local["reveal"] = None
            return [], None

        if phase == "guess":
            reveal = pdata.get("reveal")
            if isinstance(reveal, dict):
                until_ms = reveal.get("until_ms")
                if isinstance(until_ms, (int, float)) and until_ms > time.time() * 1000:
                    return [], "reveal in progress"
            if _player_guess_done(pdata, guess_total):
                return [], "guessing complete"
            order = pdata.get("guess_order") or []
            if not order:
                return [], "guess order missing"
            idx_pos = pdata.get("guess_index", 0)
            if not isinstance(idx_pos, int) or idx_pos < 0:
                idx_pos = 0
            if idx_pos >= len(order):
                return [], "guessing complete"
            prompt_index = order[idx_pos]
            drawings = pdata.get("drawings", [])
            answer = ""
            image_data = None
            if 0 <= prompt_index < len(drawings):
                entry = drawings[prompt_index]
                answer = entry.get("prompt") or ""
                image_data = entry.get("image_data")
            if action_type == "submit_guess":
                text = action.get("text")
                if not isinstance(text, str) or not text.strip():
                    return [], "text required"
                cleaned = text.strip()
                if _is_correct_guess(cleaned, answer):
                    pdata["guesses"][prompt_index] = {"guess": cleaned, "correct": True}
                    pdata["score"] = pdata.get("score", 0) + 1
                    pdata["guess_index"] = idx_pos + 1
                    pdata["feedback"] = {"type": "correct", "message": "回答正确！", "at": time.time()}
                else:
                    pdata["feedback"] = {"type": "wrong", "message": "不对哦", "at": time.time()}
                if all(_player_guess_done(p, guess_total) for p in state["players"].values()):
                    state["phase"] = "review"
                    state["game_over"] = True
                return [], None
            if action_type == "skip_guess":
                pdata["guesses"][prompt_index] = {"guess": None, "correct": False}
                pdata["guess_index"] = idx_pos + 1
                reveal_sec = cfg.get("skip_reveal_sec", DEFAULT_CONFIG["skip_reveal_sec"])
                until_ms = time.time() * 1000 + max(0, reveal_sec) * 1000
                pdata["reveal"] = {
                    "prompt_index": prompt_index,
                    "answer": answer,
                    "image_data": image_data,
                    "until_ms": until_ms,
                }
                pdata["feedback"] = None
                if all(_player_guess_done(p, guess_total) for p in state["players"].values()):
                    state["phase"] = "review"
                    state["game_over"] = True
                return [], None
            return [], "invalid action"
        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_meta = state.get("player_meta", {})
        order = state.get("turn_order", [])
        cfg = state.get("config", DEFAULT_CONFIG)
        draw_total = cfg.get("draw_total", DEFAULT_CONFIG["draw_total"])
        guess_total_cfg = cfg.get("guess_total", DEFAULT_CONFIG["guess_total"])
        players_view = []
        for pid in order:
            pdata = state.get("players", {}).get(pid, {})
            draw_index = pdata.get("draw_index", 0)
            guess_index = pdata.get("guess_index", 0)
            guess_total = len(pdata.get("guess_order") or []) or min(guess_total_cfg, draw_total)
            meta = player_meta.get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "draw_count": min(draw_index, draw_total),
                    "draw_total": draw_total,
                    "guess_count": min(guess_index, guess_total),
                    "guess_total": guess_total,
                    "score": pdata.get("score", 0),
                }
            )

        you_data = state.get("players", {}).get(viewer_id)
        draw_prompt = None
        draw_index = None
        guess_index = None
        current_image = None
        current_prompt_index = None
        feedback = None
        reveal = None
        guess_total = min(guess_total_cfg, draw_total)
        if you_data:
            _clear_expired_reveal(you_data)
            draw_index = you_data.get("draw_index", 0)
            if draw_index is not None and draw_index < draw_total:
                drawings = you_data.get("drawings", [])
                if 0 <= draw_index < len(drawings):
                    draw_prompt = drawings[draw_index].get("prompt")
            guess_index = you_data.get("guess_index", 0)
            order_list = you_data.get("guess_order") or []
            if order_list:
                guess_total = len(order_list)
            if order_list and isinstance(guess_index, int) and guess_index < len(order_list):
                current_prompt_index = order_list[guess_index]
                drawings = you_data.get("drawings", [])
                if 0 <= current_prompt_index < len(drawings):
                    current_image = drawings[current_prompt_index].get("image_data")
            feedback = you_data.get("feedback")
            reveal = you_data.get("reveal")

        review = None
        if state.get("phase") == "review":
            review = _build_review(state)

        return {
            "game_id": BlitzSketchGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "game_over": state.get("game_over"),
            "draw_total": draw_total,
            "guess_total": guess_total,
            "draw_time_sec": cfg.get("draw_time_sec", DEFAULT_CONFIG["draw_time_sec"]),
            "skip_reveal_sec": cfg.get("skip_reveal_sec", DEFAULT_CONFIG["skip_reveal_sec"]),
            "draw_index": draw_index,
            "draw_prompt": draw_prompt,
            "guess_index": guess_index,
            "current_image": current_image,
            "current_prompt_index": current_prompt_index,
            "score": you_data.get("score", 0) if you_data else 0,
            "feedback": feedback,
            "reveal": reveal,
            "players": players_view,
            "review": review,
            "legal_actions": BlitzSketchGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        if not BlitzSketchGame.get_legal_actions(state, bot_id):
            return None
        pdata = state["players"][bot_id]
        phase = state.get("phase")
        if phase == "draw":
            draw_total = state.get("config", DEFAULT_CONFIG).get("draw_total", DEFAULT_CONFIG["draw_total"])
            index = pdata.get("draw_index", 0)
            if not isinstance(index, int) or index < 0 or index >= draw_total:
                return None
            drawings = pdata.get("drawings", [])
            prompt = drawings[index].get("prompt") if index < len(drawings) else ""
            salted = _salt_prompt(prompt or "mystery")
            rng = random.Random(salted)
            image_data = _bot_svg_for_prompt(prompt or "mystery", rng)
            return {"type": "submit_drawing", "image_data": image_data}
        if phase == "guess":
            order = pdata.get("guess_order") or []
            idx_pos = pdata.get("guess_index", 0)
            if not order or not isinstance(idx_pos, int) or idx_pos >= len(order):
                return None
            prompt_index = order[idx_pos]
            drawings = pdata.get("drawings", [])
            answer = drawings[prompt_index].get("prompt") if 0 <= prompt_index < len(drawings) else ""
            if answer:
                return {"type": "submit_guess", "text": answer}
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


def _format_guess_text(entry: Optional[Dict]) -> str:
    if not isinstance(entry, dict):
        return "-"
    guess = entry.get("guess")
    if guess is None:
        return "跳过"
    if isinstance(guess, str) and guess.strip():
        return guess
    return "-"


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    game_id = BlitzSketchGame.game_id
    status_label = "Game Over" if state.get("game_over") else "In Progress"
    header = [
        "<h1>Download Memories</h1>",
        f"<div class=\"meta\">Game: {esc(game_id, '-')} · Room: {esc(room_id, '-')}</div>",
        f"<div class=\"meta\">Status: {esc(status_label, status_label)}</div>",
    ]
    start_time = format_timestamp(state.get("game_start_time"))
    if start_time != "-":
        header.append(f"<div class=\"meta\">Game Start: {esc(start_time, start_time)}</div>")
    header.append(f"<div class=\"meta\">Generated: {esc(format_timestamp(time.time()), '-')}</div>")

    player_meta = state.get("player_meta", {})
    order = state.get("turn_order", [])
    player_rows: List[List[str]] = []
    for pid in order:
        meta = player_meta.get(pid, {})
        player_rows.append(
            [
                esc(pid, "-"),
                esc(meta.get("name"), "-"),
                esc(meta.get("seat"), "-"),
                format_bool(meta.get("is_bot")),
            ]
        )
    players_section = section(
        "Players",
        render_table(["Player ID", "Name", "Seat", "Bot"], player_rows, empty_message="No players"),
    )

    cfg = state.get("config", DEFAULT_CONFIG)
    config_rows = [
        ("Draw Total", esc(cfg.get("draw_total"), "-")),
        ("Guess Total", esc(cfg.get("guess_total"), "-")),
        ("Draw Time (sec)", esc(cfg.get("draw_time_sec"), "-")),
        ("Skip Reveal (sec)", esc(cfg.get("skip_reveal_sec"), "-")),
    ]
    config_section = section("Config", render_kv_table(config_rows))

    review = _build_review(state)
    review_blocks: List[str] = []
    for player in review.get("players", []):
        name = player.get("name") or player.get("player_id") or "Player"
        score = player.get("score", 0)
        drawings = player.get("drawings", [])
        cells: List[str] = []
        for entry in drawings:
            guessed = entry.get("guessed")
            guess_entry = None
            if guessed:
                guess_entry = {
                    "guess": entry.get("guess_text"),
                    "correct": entry.get("correct"),
                }
            guess_label = ""
            if guessed:
                guess_label = f"<div class=\"small\">猜测: {esc(_format_guess_text(guess_entry), '-')}</div>"
            cell = (
                "<div class=\"matrix-cell\">"
                f"{render_image(entry.get('image_data'), alt='drawing', class_name='matrix-image')}"
                f"<div class=\"small\">词语: {esc(entry.get('prompt'), '-')}</div>"
                f"{guess_label}"
                "</div>"
            )
            cells.append(cell)
        grid_html = f"<div class=\"blitz-matrix\">{''.join(cells)}</div>"
        review_blocks.append(
            f"<div class=\"card\"><h3>{esc(name, 'Player')}"
            f"<span class=\"badge\">Score {esc(score, '0')}</span></h3>{grid_html}</div>"
        )

    review_section = section("Review", "".join(review_blocks) if review_blocks else "<div class=\"muted\">No drawings</div>")

    extra_style = """
.blitz-matrix {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.matrix-image {
  width: 100%;
  height: auto;
  display: block;
}
@media (max-width: 720px) {
  .blitz-matrix {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
"""

    body = "".join(header) + players_section + config_section + review_section
    return build_html_document("Download Memories", body, extra_style=extra_style)


download_memories = build_memories_html
