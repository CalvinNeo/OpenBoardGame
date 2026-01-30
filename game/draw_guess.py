import random
from typing import Dict, List, Optional, Tuple

from game.draw_guess_quickdraw import (
    clone_prompt_entry as _clone_prompt_entry,
    normalize_prompt_pool as _normalize_prompt_pool,
    quickdraw_alias_for_text as _quickdraw_alias_for_text,
    quickdraw_guess_from_image as _quickdraw_guess_from_image,
    quickdraw_image_for_prompt as _quickdraw_image_for_prompt,
)
from game.draw_guess_templates import _bot_svg_for_prompt, _salt_prompt

DEFAULT_LANGUAGE = "zh"
GUESS_METHOD_NORMAL = "normal"
GUESS_METHOD_CV = "cv"

DEFAULT_CONFIG = {
    "language": DEFAULT_LANGUAGE,
    "prompt_pool": None,
    "guess_method": GUESS_METHOD_NORMAL,
}

_PROMPT_BAGS: Dict[Tuple[str, Tuple[Tuple[str, Optional[str]], ...]], List[Dict]] = {}


def _normalize_language(value: Optional[str]) -> str:
    if value in ("en", "zh"):
        return value
    return DEFAULT_LANGUAGE


def _normalize_guess_method(value: Optional[str]) -> str:
    if isinstance(value, str):
        normalized = value.strip().casefold()
        if normalized in (GUESS_METHOD_NORMAL, GUESS_METHOD_CV):
            return normalized
    return GUESS_METHOD_NORMAL


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        language = config.get("language")
        if isinstance(language, str):
            cfg["language"] = language
        guess_method = config.get("guess_method")
        if isinstance(guess_method, str):
            cfg["guess_method"] = guess_method
        prompt_pool = config.get("prompt_pool")
        if isinstance(prompt_pool, list) and prompt_pool:
            cfg["prompt_pool"] = prompt_pool
    return cfg


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _prompt_pool_signature(prompt_pool: List[Dict]) -> Tuple[Tuple[str, Optional[str]], ...]:
    signature: List[Tuple[str, Optional[str]]] = []
    for entry in prompt_pool:
        if not isinstance(entry, dict):
            continue
        text = entry.get("text")
        if not isinstance(text, str):
            continue
        text = text.strip()
        if not text:
            continue
        quickdraw = entry.get("quickdraw")
        if isinstance(quickdraw, str):
            quickdraw = quickdraw.strip() or None
        else:
            quickdraw = None
        signature.append((text, quickdraw))
    return tuple(signature)


def _draw_prompt_choices(prompt_pool: List[Dict], count: int, language: str) -> List[Dict]:
    if count <= 0:
        return []
    key = (language, _prompt_pool_signature(prompt_pool))
    bag = _PROMPT_BAGS.get(key)
    if not bag:
        bag = list(prompt_pool)
        random.shuffle(bag)
    choices: List[Dict] = []
    while len(choices) < count:
        if not bag:
            bag = list(prompt_pool)
            random.shuffle(bag)
        take = min(count - len(choices), len(bag))
        start = len(bag) - take
        choices.extend(bag[start:])
        del bag[start:]
    _PROMPT_BAGS[key] = bag
    return choices


def _assign_prompts(prompt_pool: Optional[List[Dict]], player_ids: List[str], language: str) -> Dict[str, Dict]:
    prompts = list(prompt_pool) if prompt_pool else _normalize_prompt_pool(None, language)
    if not prompts:
        prompts = [{"text": "mystery", "quickdraw": None}]
    choices = _draw_prompt_choices(prompts, len(player_ids), language)
    return {pid: _clone_prompt_entry(choices[idx]) for idx, pid in enumerate(player_ids)}


def _book_owner_for_player(state: Dict, player_id: str) -> Optional[str]:
    order = state["turn_order"]
    if player_id not in order:
        return None
    total = len(order)
    if total == 0:
        return None
    idx = order.index(player_id)
    owner_idx = (idx - (state["round"] - 1)) % total
    return order[owner_idx]


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(value.strip().casefold().split())


def _prompt_pool_texts(prompt_pool: Optional[List]) -> List[str]:
    texts: List[str] = []
    if not prompt_pool:
        return texts
    for item in prompt_pool:
        text = None
        if isinstance(item, dict):
            text = item.get("text")
        elif isinstance(item, str):
            text = item
        if isinstance(text, str) and text.strip():
            texts.append(text.strip())
    return texts


def _current_book(state: Dict, player_id: str) -> Optional[Dict]:
    owner_id = _book_owner_for_player(state, player_id)
    if owner_id is None:
        return None
    return state["books"].get(owner_id)


def _current_entry_for_player(state: Dict, player_id: str) -> Optional[Dict]:
    book = _current_book(state, player_id)
    if not book:
        return None
    entries = book.get("entries", [])
    if not entries:
        return None
    return entries[-1]


def _last_text_entry(entries: List[Dict]) -> Optional[str]:
    for entry in reversed(entries):
        if entry.get("type") in ("prompt", "guess"):
            return entry.get("text")
    return None


def _drawing_entry_for_book(book: Optional[Dict]) -> Optional[Dict]:
    if not book:
        return None
    entries = book.get("entries", [])
    if not entries:
        return None
    last_entry = entries[-1]
    if last_entry.get("type") == "drawing":
        return last_entry
    return None


def _drawing_hint_from_book(book: Optional[Dict]) -> Optional[str]:
    if not book:
        return None
    entries = book.get("entries", [])
    if not entries:
        return None
    last_entry = entries[-1]
    if last_entry.get("type") != "drawing":
        return None
    hint = last_entry.get("hint")
    if isinstance(hint, str) and hint.strip():
        return hint.strip()
    if len(entries) > 1:
        return _last_text_entry(entries[:-1])
    return None


def _bot_image_for_prompt(
    prompt_text: str,
    prompt_quickdraw: Optional[str],
    salted_prompt: str,
    rng: random.Random,
) -> str:
    image_data = _quickdraw_image_for_prompt(prompt_text, prompt_quickdraw, rng)
    if image_data:
        return image_data
    return _bot_svg_for_prompt(salted_prompt, rng)


def _bot_guess_normal(hint: Optional[str], prompt_pool: Optional[List], language: str) -> str:
    cleaned = hint.strip() if isinstance(hint, str) else ""
    prompt_texts = _prompt_pool_texts(prompt_pool)
    if not prompt_texts:
        prompt_texts = _prompt_pool_texts(_normalize_prompt_pool(None, language))
    if not cleaned:
        return random.choice(prompt_texts) if prompt_texts else "unknown"
    if random.random() < 0.15 and prompt_texts:
        return random.choice(prompt_texts)
    return cleaned


def _bot_guess_cv(image_data: Optional[str], prompt_pool: Optional[List], language: str) -> Optional[str]:
    if not isinstance(image_data, str) or not image_data.strip():
        return None
    try:
        guess = _quickdraw_guess_from_image(image_data, prompt_pool, language)
    except Exception:
        return None
    if isinstance(guess, str) and guess.strip():
        return guess.strip()
    return None


def _submission_complete(state: Dict) -> bool:
    return len(state["submissions"]) >= len(state["turn_order"])


def _apply_round(state: Dict) -> None:
    phase = state["phase"]
    round_num = state["round"]
    entry_type = "drawing" if phase == "draw" else "guess"

    for player_id in state["turn_order"]:
        submission = state["submissions"].get(player_id)
        if not submission:
            continue
        owner_id = _book_owner_for_player(state, player_id)
        if owner_id is None:
            continue
        book = state["books"].get(owner_id)
        source_text = None
        if entry_type == "drawing" and book and book.get("entries"):
            source_text = book["entries"][-1].get("text")
        entry = {
            "round": round_num,
            "type": entry_type,
            "author_id": player_id,
            "text": submission.get("text"),
            "image_data": submission.get("image_data"),
        }
        if entry_type == "drawing":
            entry["hint"] = source_text.strip() if isinstance(source_text, str) else None
        state["books"][owner_id]["entries"].append(entry)

    state["submissions"] = {}
    if round_num >= state["total_rounds"]:
        state["phase"] = "review"
        state["game_over"] = True
        return

    state["round"] = round_num + 1
    state["phase"] = "guess" if phase == "draw" else "draw"


class DrawGuessGame:
    game_id = "draw_guess"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        language = _normalize_language(cfg.get("language"))
        guess_method = _normalize_guess_method(cfg.get("guess_method"))
        prompt_pool = _normalize_prompt_pool(cfg.get("prompt_pool"), language)
        cfg["language"] = language
        cfg["guess_method"] = guess_method
        cfg["prompt_pool"] = prompt_pool
        order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        total_rounds = len(order) if len(order) % 2 == 0 else max(len(order) - 1, 2)

        prompts = _assign_prompts(prompt_pool, order, language)
        books = {}
        for owner_id in order:
            prompt_entry = prompts.get(owner_id, {"text": "mystery", "quickdraw": None})
            books[owner_id] = {
                "owner_id": owner_id,
                "entries": [
                    {
                        "round": 0,
                        "type": "prompt",
                        "author_id": owner_id,
                        "text": prompt_entry.get("text") if prompt_entry else "mystery",
                        "image_data": None,
                        "quickdraw": prompt_entry.get("quickdraw") if prompt_entry else None,
                    }
                ],
            }

        players_state = {pid: {} for pid in order}

        return {
            "players": players_state,
            "turn_order": order,
            "round": 1,
            "total_rounds": total_rounds,
            "phase": "draw",
            "submissions": {},
            "books": books,
            "config": cfg,
            "player_meta": player_meta,
            "prompt_pool": prompt_pool,
            "language": language,
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        if player_id in state.get("submissions", {}):
            return []
        if state["phase"] == "draw":
            return ["submit_drawing"]
        if state["phase"] == "guess":
            return ["submit_guess"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        if player_id in state.get("submissions", {}):
            return [], "already submitted"

        phase = state.get("phase")
        action_type = action.get("type")
        if phase == "draw":
            if action_type != "submit_drawing":
                return [], "invalid action"
            image_data = action.get("image_data")
            if not isinstance(image_data, str) or not image_data.strip():
                return [], "image_data required"
            state["submissions"][player_id] = {
                "type": "drawing",
                "text": None,
                "image_data": image_data,
            }
        elif phase == "guess":
            if action_type != "submit_guess":
                return [], "invalid action"
            text = action.get("text")
            if not isinstance(text, str) or not text.strip():
                return [], "text required"
            state["submissions"][player_id] = {
                "type": "guess",
                "text": text.strip(),
                "image_data": None,
            }
        else:
            return [], "invalid phase"

        if _submission_complete(state):
            _apply_round(state)

        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = state["turn_order"]
        player_map = state.get("player_meta", {})
        players_view = []
        for pid in player_ids:
            meta = player_map.get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "submitted": pid in state.get("submissions", {}),
                }
            )

        current_prompt = None
        current_drawing = None
        if viewer_id in state.get("players", {}):
            owner_id = _book_owner_for_player(state, viewer_id)
            if owner_id is not None:
                book = state["books"].get(owner_id)
                if book and book.get("entries"):
                    last_entry = book["entries"][-1]
                    if state["phase"] == "draw":
                        current_prompt = last_entry.get("text")
                    elif state["phase"] == "guess":
                        current_drawing = last_entry.get("image_data")

        review = None
        if state["phase"] == "review":
            books_view = []
            for owner_id in player_ids:
                meta = player_map.get(owner_id, {})
                book = state["books"].get(owner_id, {})
                entries = []
                for entry in book.get("entries", []):
                    author_meta = player_map.get(entry.get("author_id"), {})
                    entries.append(
                        {
                            "round": entry.get("round"),
                            "type": entry.get("type"),
                            "author_id": entry.get("author_id"),
                            "author_name": author_meta.get("name"),
                            "text": entry.get("text"),
                            "image_data": entry.get("image_data"),
                        }
                    )
                prompt = entries[0].get("text") if entries else None
                final_guess = None
                for entry in reversed(entries):
                    if entry.get("type") == "guess":
                        final_guess = entry.get("text")
                        break
                final_match = False
                if prompt and final_guess:
                    final_match = _normalize_text(prompt) == _normalize_text(final_guess)

                books_view.append(
                    {
                        "owner_id": owner_id,
                        "owner_name": meta.get("name"),
                        "entries": entries,
                        "prompt": prompt,
                        "final_guess": final_guess,
                        "final_match": final_match,
                    }
                )
            review = {"books": books_view}

        return {
            "game_id": DrawGuessGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "total_rounds": state["total_rounds"],
            "submitted": viewer_id in state.get("submissions", {}),
            "players": players_view,
            "current_prompt": current_prompt,
            "current_drawing": current_drawing,
            "review": review,
            "legal_actions": DrawGuessGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        if bot_id in state.get("submissions", {}):
            return None

        if state["phase"] == "draw":
            prompt_entry = _current_entry_for_player(state, bot_id)
            prompt_text = prompt_entry.get("text") if prompt_entry else ""
            prompt_quickdraw = None
            if prompt_entry:
                prompt_quickdraw = prompt_entry.get("quickdraw")
            if not prompt_quickdraw:
                prompt_quickdraw = _quickdraw_alias_for_text(prompt_text, state.get("language", DEFAULT_LANGUAGE))
            salted_base = prompt_text or prompt_quickdraw or ""
            salted_prompt = _salt_prompt(salted_base)
            rng = random.Random(salted_prompt)
            image_data = _bot_image_for_prompt(prompt_text, prompt_quickdraw, salted_prompt, rng)
            return {"type": "submit_drawing", "image_data": image_data}
        if state["phase"] == "guess":
            book = _current_book(state, bot_id)
            drawing_entry = _drawing_entry_for_book(book)
            hint = None
            if drawing_entry:
                hint = drawing_entry.get("hint")
            if not hint:
                hint = _drawing_hint_from_book(book)
            prompt_pool = state.get("prompt_pool")
            language = state.get("language", DEFAULT_LANGUAGE)
            guess_method = _normalize_guess_method(state.get("config", {}).get("guess_method"))
            if guess_method == GUESS_METHOD_CV:
                image_data = drawing_entry.get("image_data") if drawing_entry else None
                guess = _bot_guess_cv(image_data, prompt_pool, language)
                if guess:
                    print(
                        f"[draw_guess] bot_guess method=cv bot_id={bot_id} guess={guess}",
                        flush=True,
                    )
                    return {"type": "submit_guess", "text": guess}
                print(
                    f"[draw_guess] bot_guess method=cv fallback=normal bot_id={bot_id}",
                    flush=True,
                )
            guess = _bot_guess_normal(hint, prompt_pool, language)
            print(
                f"[draw_guess] bot_guess method=normal bot_id={bot_id} guess={guess} hint={hint or ''}",
                flush=True,
            )
            return {"type": "submit_guess", "text": guess}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
