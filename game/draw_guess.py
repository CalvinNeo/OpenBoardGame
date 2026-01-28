import base64
import difflib
import io
import os
import random
import shutil
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Tuple

from game.draw_guess_prompts import (
    CHINESE_TO_QUICKDRAW,
    DEFAULT_PROMPTS_BY_LANGUAGE,
    DEFAULT_PROMPTS_EN,
    ENGLISH_ALIAS_OVERRIDES,
)
from game.draw_guess_templates import (
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    _bot_svg_for_prompt,
    _salt_prompt,
)

try:
    from quickdraw import QuickDrawData, QuickDrawDataGroup
    from PIL import Image
except Exception:  # pragma: no cover - optional dependency
    QuickDrawData = None
    QuickDrawDataGroup = None
    Image = None

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
QUICKDRAW_CACHE_DIR = (
    os.environ.get("OPENBOARDGAME_QUICKDRAW_CACHE_DIR")
    or os.environ.get("QUICKDRAW_CACHE_DIR")
    or os.path.join(PROJECT_ROOT, ".quickdraw_cache")
)
QUICKDRAW_BINARY_URL = (
    os.environ.get("OPENBOARDGAME_QUICKDRAW_BINARY_URL") or os.environ.get("QUICKDRAW_BINARY_URL")
)
QUICKDRAW_TIMEOUT = os.environ.get("OPENBOARDGAME_QUICKDRAW_TIMEOUT") or os.environ.get("QUICKDRAW_TIMEOUT")
DEFAULT_QUICKDRAW_TIMEOUT = (5.0, 30.0)
QUICKDRAW_REQUEST_TIMEOUT = DEFAULT_QUICKDRAW_TIMEOUT
if QUICKDRAW_TIMEOUT:
    raw_timeout = QUICKDRAW_TIMEOUT.strip().lower()
    if raw_timeout in ("0", "off", "false", "no"):
        QUICKDRAW_REQUEST_TIMEOUT = None
    elif "," in raw_timeout:
        part1, part2 = raw_timeout.split(",", 1)
        try:
            connect_timeout = float(part1.strip())
            read_timeout = float(part2.strip())
        except ValueError:
            pass
        else:
            if connect_timeout > 0 and read_timeout > 0:
                QUICKDRAW_REQUEST_TIMEOUT = (connect_timeout, read_timeout)
    else:
        try:
            value_timeout = float(raw_timeout)
        except ValueError:
            pass
        else:
            if value_timeout > 0:
                QUICKDRAW_REQUEST_TIMEOUT = value_timeout
            else:
                QUICKDRAW_REQUEST_TIMEOUT = None
QUICKDRAW_OFFLINE = (
    (os.environ.get("OPENBOARDGAME_QUICKDRAW_OFFLINE") or os.environ.get("QUICKDRAW_OFFLINE") or "")
    .strip()
    .lower()
    in ("1", "true", "yes", "on")
)

if QuickDrawDataGroup is not None and (QUICKDRAW_BINARY_URL or QUICKDRAW_REQUEST_TIMEOUT):
    try:
        import quickdraw.data as quickdraw_data

        if QUICKDRAW_BINARY_URL:
            quickdraw_data.BINARY_URL = QUICKDRAW_BINARY_URL.rstrip("/") + "/"
        if QUICKDRAW_REQUEST_TIMEOUT is not None:
            import requests

            def _quickdraw_get(url, **kwargs):
                if "timeout" not in kwargs:
                    kwargs["timeout"] = QUICKDRAW_REQUEST_TIMEOUT
                return requests.get(url, **kwargs)

            quickdraw_data.get = _quickdraw_get
    except Exception:
        pass

QUICKDRAW_AVAILABLE = QuickDrawData is not None and QuickDrawDataGroup is not None and Image is not None
QUICKDRAW_MAX_DRAWINGS = 400
_QUICKDRAW_NAME_MAP: Optional[Dict[str, str]] = None
_QUICKDRAW_GROUPS: Dict[str, QuickDrawDataGroup] = {}
_QUICKDRAW_CACHE_READY = False
_QUICKDRAW_CACHE_NAMES: Optional[List[str]] = None
_QUICKDRAW_ALLOW_NETWORK = not QUICKDRAW_OFFLINE

DEFAULT_CONFIG = {
    "language": "en",
    "prompt_pool": None,
}

DEFAULT_QUICKDRAW_BINARY_URL = "https://storage.googleapis.com/quickdraw_dataset/full/binary/"


def _normalize_language(value: Optional[str]) -> str:
    if value in ("en", "zh"):
        return value
    return "en"


def _clone_prompt_entry(entry: Dict) -> Dict:
    return {
        "text": entry.get("text"),
        "quickdraw": entry.get("quickdraw"),
    }


def _looks_like_english(value: str) -> bool:
    if not value:
        return False
    return all(ord(ch) < 128 for ch in value)


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        language = config.get("language")
        if isinstance(language, str):
            cfg["language"] = language
        prompt_pool = config.get("prompt_pool")
        if isinstance(prompt_pool, list) and prompt_pool:
            cfg["prompt_pool"] = prompt_pool
    return cfg


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _assign_prompts(prompt_pool: Optional[List[Dict]], player_ids: List[str], language: str) -> Dict[str, Dict]:
    prompts = list(prompt_pool) if prompt_pool else _normalize_prompt_pool(None, language)
    if not prompts:
        prompts = [{"text": "mystery", "quickdraw": None}]
    if len(prompts) >= len(player_ids):
        choices = random.sample(prompts, len(player_ids))
    else:
        choices = [random.choice(prompts) for _ in range(len(player_ids))]
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


def _normalize_name(value: str) -> str:
    return " ".join(value.replace("-", " ").strip().casefold().split())


def _quickdraw_cache_path(category: str) -> str:
    return os.path.join(QUICKDRAW_CACHE_DIR, f"{category}.bin")


def _quickdraw_cache_names() -> List[str]:
    global _QUICKDRAW_CACHE_NAMES
    if _QUICKDRAW_CACHE_NAMES is not None:
        return _QUICKDRAW_CACHE_NAMES
    _ensure_quickdraw_cache_dir()
    try:
        entries = os.listdir(QUICKDRAW_CACHE_DIR)
    except Exception:
        _QUICKDRAW_CACHE_NAMES = []
        return _QUICKDRAW_CACHE_NAMES
    names = []
    for entry in entries:
        if not entry.endswith(".bin"):
            continue
        name, _ = os.path.splitext(entry)
        if name:
            names.append(name)
    _QUICKDRAW_CACHE_NAMES = names
    return _QUICKDRAW_CACHE_NAMES


def _quickdraw_cache_name_map() -> Dict[str, str]:
    return {_normalize_name(name): name for name in _quickdraw_cache_names()}


def _set_quickdraw_offline() -> None:
    global _QUICKDRAW_ALLOW_NETWORK, _QUICKDRAW_NAME_MAP, _QUICKDRAW_CACHE_NAMES
    if not _QUICKDRAW_ALLOW_NETWORK:
        return
    _QUICKDRAW_ALLOW_NETWORK = False
    _QUICKDRAW_CACHE_NAMES = None
    _QUICKDRAW_NAME_MAP = _quickdraw_cache_name_map()


def _quickdraw_alias_for_text(text: str, language: str) -> Optional[str]:
    if not isinstance(text, str):
        return None
    stripped = text.strip()
    if not stripped:
        return None
    alias = CHINESE_TO_QUICKDRAW.get(stripped)
    if alias:
        return alias
    normalized = _normalize_name(stripped)
    override = ENGLISH_ALIAS_OVERRIDES.get(normalized)
    if override:
        return override
    if language == "en" or _looks_like_english(normalized):
        return normalized
    return None


def _coerce_prompt_entry(value: object, language: str) -> Optional[Dict]:
    if isinstance(value, dict):
        text = value.get("text")
        if not isinstance(text, str):
            return None
        text = text.strip()
        if not text:
            return None
        quickdraw = value.get("quickdraw")
        if isinstance(quickdraw, str):
            quickdraw = quickdraw.strip() or None
        else:
            quickdraw = None
        if not quickdraw:
            quickdraw = _quickdraw_alias_for_text(text, language)
        return {"text": text, "quickdraw": quickdraw}
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        return {"text": text, "quickdraw": _quickdraw_alias_for_text(text, language)}
    return None


def _normalize_prompt_pool(prompt_pool: Optional[List], language: str) -> List[Dict]:
    entries = []
    if isinstance(prompt_pool, list):
        for item in prompt_pool:
            entry = _coerce_prompt_entry(item, language)
            if entry:
                entries.append(entry)
    if entries:
        return entries
    defaults = DEFAULT_PROMPTS_BY_LANGUAGE.get(language, DEFAULT_PROMPTS_EN)
    return [_clone_prompt_entry(entry) for entry in defaults]


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


def _quickdraw_binary_base_url() -> str:
    if QUICKDRAW_BINARY_URL:
        return QUICKDRAW_BINARY_URL.rstrip("/") + "/"
    return DEFAULT_QUICKDRAW_BINARY_URL


def _quickdraw_timeout_value() -> Optional[float]:
    if QUICKDRAW_REQUEST_TIMEOUT is None:
        return None
    if isinstance(QUICKDRAW_REQUEST_TIMEOUT, tuple):
        return max(QUICKDRAW_REQUEST_TIMEOUT)
    try:
        return float(QUICKDRAW_REQUEST_TIMEOUT)
    except (TypeError, ValueError):
        return None


def _download_quickdraw_bin(category: str) -> bool:
    if QUICKDRAW_OFFLINE:
        return False
    _ensure_quickdraw_cache_dir()
    base_url = _quickdraw_binary_base_url()
    encoded = urllib.parse.quote(category)
    url = f"{base_url}{encoded}.bin"
    cache_path = _quickdraw_cache_path(category)
    temp_path = f"{cache_path}.tmp"
    request = urllib.request.Request(url, headers={"User-Agent": "OpenBoardGame/quickdraw-prefetch"})
    timeout = _quickdraw_timeout_value()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response, open(temp_path, "wb") as handle:
            shutil.copyfileobj(response, handle)
        os.replace(temp_path, cache_path)
        return os.path.isfile(cache_path)
    except Exception:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return False


def quickdraw_categories_for_prompts(prompt_pool: Optional[List], language: str) -> List[str]:
    language = _normalize_language(language)
    entries = _normalize_prompt_pool(prompt_pool, language)
    categories: List[str] = []
    seen = set()
    for entry in entries:
        quickdraw = entry.get("quickdraw")
        if not isinstance(quickdraw, str):
            continue
        quickdraw = quickdraw.strip()
        if not quickdraw:
            continue
        normalized = _normalize_name(quickdraw)
        if normalized in seen:
            continue
        seen.add(normalized)
        categories.append(quickdraw)
    return categories


def prefetch_quickdraw_bins(categories: List[str]) -> Dict[str, str]:
    results: Dict[str, str] = {}
    for category in categories:
        if not isinstance(category, str):
            continue
        category = category.strip()
        if not category:
            continue
        cache_path = _quickdraw_cache_path(category)
        if os.path.isfile(cache_path):
            results[category] = "cached"
            continue
        if QUICKDRAW_OFFLINE:
            results[category] = "offline"
            continue
        downloaded = _download_quickdraw_bin(category)
        results[category] = "downloaded" if downloaded else "failed"
    return results


def _get_quickdraw_name_map() -> Dict[str, str]:
    global _QUICKDRAW_NAME_MAP
    if _QUICKDRAW_NAME_MAP is not None:
        return _QUICKDRAW_NAME_MAP
    if not QUICKDRAW_AVAILABLE:
        _QUICKDRAW_NAME_MAP = {}
        return _QUICKDRAW_NAME_MAP
    _ensure_quickdraw_cache_dir()
    if not _QUICKDRAW_ALLOW_NETWORK:
        _QUICKDRAW_NAME_MAP = _quickdraw_cache_name_map()
        return _QUICKDRAW_NAME_MAP
    try:
        data = QuickDrawData(
            recognized=True,
            max_drawings=QUICKDRAW_MAX_DRAWINGS,
            refresh_data=False,
            jit_loading=True,
            print_messages=False,
            cache_dir=QUICKDRAW_CACHE_DIR,
        )
    except Exception:
        _set_quickdraw_offline()
        return _QUICKDRAW_NAME_MAP or {}
    _QUICKDRAW_NAME_MAP = {_normalize_name(name): name for name in data.drawing_names}
    return _QUICKDRAW_NAME_MAP


def _match_quickdraw_category(prompt: str) -> Optional[str]:
    if not QUICKDRAW_AVAILABLE:
        return None
    normalized = _normalize_name(prompt or "")
    if not normalized:
        return None
    name_map = _get_quickdraw_name_map()
    if normalized in name_map:
        return name_map[normalized]
    if normalized.endswith("s") and normalized[:-1] in name_map:
        return name_map[normalized[:-1]]

    tokens = set(normalized.split())
    best_name = None
    best_score = 0
    for key, original in name_map.items():
        if normalized in key or key in normalized:
            score = 2 + len(key)
        else:
            overlap = len(tokens.intersection(key.split()))
            score = overlap
        if score > best_score:
            best_score = score
            best_name = original
    if best_name:
        return best_name

    matches = difflib.get_close_matches(normalized, list(name_map.keys()), n=1, cutoff=0.8)
    if matches:
        return name_map[matches[0]]
    return None


def _get_quickdraw_group(category: str) -> Optional[QuickDrawDataGroup]:
    if not QUICKDRAW_AVAILABLE:
        return None
    if not category:
        return None
    group = _QUICKDRAW_GROUPS.get(category)
    if group is not None:
        return group
    _ensure_quickdraw_cache_dir()
    cache_path = _quickdraw_cache_path(category)
    if not _QUICKDRAW_ALLOW_NETWORK and not os.path.isfile(cache_path):
        return None
    try:
        group = QuickDrawDataGroup(
            category,
            recognized=True,
            max_drawings=QUICKDRAW_MAX_DRAWINGS,
            refresh_data=False,
            print_messages=False,
            cache_dir=QUICKDRAW_CACHE_DIR,
        )
    except Exception:
        _set_quickdraw_offline()
        return None
    _QUICKDRAW_GROUPS[category] = group
    return group


def _quickdraw_to_data_url(category: str, rng: random.Random) -> Optional[str]:
    group = _get_quickdraw_group(category)
    if not group or group.drawing_count == 0:
        return None
    try:
        index = rng.randrange(group.drawing_count)
        drawing = group.get_drawing(index)
        stroke_width = max(2, rng.randint(2, 4))
        image = drawing.get_image(stroke_width=stroke_width)
        image = image.convert("RGB")
    except Exception:
        return None

    angle = rng.uniform(-10.0, 10.0)
    image = image.rotate(angle, expand=True, fillcolor=(255, 255, 255))
    scale = rng.uniform(0.85, 1.15)
    width = max(1, int(image.width * scale))
    height = max(1, int(image.height * scale))
    image = image.resize((width, height))

    canvas = Image.new("RGB", (CANVAS_WIDTH, CANVAS_HEIGHT), color=(255, 255, 255))
    offset_x = (CANVAS_WIDTH - width) // 2 + rng.randint(-30, 30)
    offset_y = (CANVAS_HEIGHT - height) // 2 + rng.randint(-30, 30)
    canvas.paste(image, (offset_x, offset_y))

    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _ensure_quickdraw_cache_dir() -> None:
    global _QUICKDRAW_CACHE_READY
    if _QUICKDRAW_CACHE_READY:
        return
    try:
        os.makedirs(QUICKDRAW_CACHE_DIR, exist_ok=True)
        _QUICKDRAW_CACHE_READY = True
    except Exception:
        return


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
    category = None
    if prompt_quickdraw:
        category = _match_quickdraw_category(prompt_quickdraw)
    if not category and prompt_text:
        category = _match_quickdraw_category(prompt_text)
    if not category and QUICKDRAW_AVAILABLE:
        name_map = _get_quickdraw_name_map()
        if name_map:
            category = rng.choice(list(name_map.values()))
    if category:
        image_data = _quickdraw_to_data_url(category, rng)
        if image_data:
            return image_data
    return _bot_svg_for_prompt(salted_prompt, rng)


def _bot_guess_from_hint(hint: Optional[str], prompt_pool: Optional[List], language: str) -> str:
    cleaned = hint.strip() if isinstance(hint, str) else ""
    prompt_texts = _prompt_pool_texts(prompt_pool)
    if not prompt_texts:
        prompt_texts = _prompt_pool_texts(_normalize_prompt_pool(None, language))
    if not cleaned:
        return random.choice(prompt_texts) if prompt_texts else "unknown"
    if random.random() < 0.15 and prompt_texts:
        return random.choice(prompt_texts)
    return cleaned


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
        prompt_pool = _normalize_prompt_pool(cfg.get("prompt_pool"), language)
        cfg["language"] = language
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
                prompt_quickdraw = _quickdraw_alias_for_text(prompt_text, state.get("language", "en"))
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
            guess = _bot_guess_from_hint(hint, prompt_pool, state.get("language", "en"))
            return {"type": "submit_guess", "text": guess}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
