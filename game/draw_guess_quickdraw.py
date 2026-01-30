import base64
import difflib
import io
import os
import random
import re
import shutil
import time
import urllib.parse
import urllib.request
from typing import Dict, List, Optional

from game.draw_guess_prompts import (
    CHINESE_TO_QUICKDRAW,
    DEFAULT_PROMPTS_BY_LANGUAGE,
    DEFAULT_PROMPTS_EN,
    ENGLISH_ALIAS_OVERRIDES,
)
from game.draw_guess_templates import CANVAS_HEIGHT, CANVAS_WIDTH

try:
    from quickdraw import QuickDrawData, QuickDrawDataGroup
    from PIL import Image, ImageOps
except Exception:  # pragma: no cover - optional dependency
    QuickDrawData = None
    QuickDrawDataGroup = None
    Image = None
    ImageOps = None

try:
    import argostranslate.translate as argos_translate
except Exception:  # pragma: no cover - optional dependency
    argos_translate = None

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
_QUICKDRAW_OFFLINE_LOGGED = False
CV_IMAGE_SIZE = 32
CV_SAMPLES_PER_CATEGORY = 6
CV_MAX_CANDIDATES = 80
CV_PIXEL_THRESHOLD = 220
_CV_SAMPLE_CACHE: Dict[str, List[List[int]]] = {}

_DEFAULT_LANGUAGE = "zh"

DEFAULT_QUICKDRAW_BINARY_URL = "https://storage.googleapis.com/quickdraw_dataset/full/binary/"
_QUICKDRAW_STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def _log_quickdraw_request_start(label: str) -> float:
    print(f"[quickdraw] request start: {label}", flush=True)
    return time.monotonic()


def _log_quickdraw_request_end(label: str, start: float) -> None:
    duration = time.monotonic() - start
    print(f"[quickdraw] request done: {label} in {duration:.2f}s", flush=True)


def _quickdraw_request_label(
    label: str,
    prompt: Optional[str],
    translation: Optional[str] = None,
    query: Optional[str] = None,
) -> str:
    mode = "offline" if not _QUICKDRAW_ALLOW_NETWORK else "online"
    parts = [f"mode: {mode}"]
    prompt_label = None
    if isinstance(prompt, str):
        prompt_label = " ".join(prompt.strip().split()) or None
    if prompt_label:
        parts.append(f"prompt: {prompt_label}")
    translation_label = None
    if prompt_label and not _looks_like_english(prompt_label):
        if isinstance(translation, str):
            translation_label = " ".join(translation.strip().split()) or None
        if not translation_label:
            translated = _translate_to_english(prompt_label)
            if isinstance(translated, str):
                translation_label = " ".join(translated.strip().split()) or None
        if translation_label:
            parts.append(f"translation: {translation_label}")
        else:
            parts.append("translation: unavailable")
    query_label = None
    if isinstance(query, str):
        query_label = " ".join(query.strip().split()) or None
    if query_label and (prompt_label is None or query_label != prompt_label):
        parts.append(f"query: {query_label}")
    return f"{label} ({', '.join(parts)})"


def _normalize_language(value: Optional[str]) -> str:
    if value in ("en", "zh"):
        return value
    return _DEFAULT_LANGUAGE


def clone_prompt_entry(entry: Dict) -> Dict:
    return {
        "text": entry.get("text"),
        "quickdraw": entry.get("quickdraw"),
    }


def _looks_like_english(value: str) -> bool:
    if not value:
        return False
    return all(ord(ch) < 128 for ch in value)


def _translate_to_english(text: str) -> Optional[str]:
    if not isinstance(text, str):
        return None
    stripped = text.strip()
    if not stripped or argos_translate is None:
        return None
    try:
        languages = argos_translate.get_installed_languages()
    except Exception:
        return None
    if not languages:
        return None

    def _find_lang(prefix: str) -> Optional[object]:
        for lang in languages:
            code = getattr(lang, "code", "")
            if isinstance(code, str) and code.lower().startswith(prefix):
                return lang
        return None

    source_lang = _find_lang("zh")
    target_lang = _find_lang("en")
    if not source_lang or not target_lang:
        return None
    try:
        translation = source_lang.get_translation(target_lang).translate(stripped)
    except Exception:
        return None
    if not isinstance(translation, str):
        return None
    translation = translation.strip()
    return translation or None


def _pick_quickdraw_word(translation: str) -> Optional[str]:
    if not isinstance(translation, str):
        return None
    tokens = re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", translation.lower())
    if not tokens:
        return None
    if len(tokens) == 1:
        return tokens[0]
    candidates = [token for token in tokens if token not in _QUICKDRAW_STOP_WORDS]
    choices = candidates or tokens
    return random.choice(choices)


def _normalize_name(value: str) -> str:
    return " ".join(value.replace("-", " ").strip().casefold().split())


def quickdraw_alias_for_text(text: str, language: str) -> Optional[str]:
    if not isinstance(text, str):
        return None
    stripped = text.strip()
    if not stripped:
        return None
    alias = CHINESE_TO_QUICKDRAW.get(stripped)
    if alias:
        return alias
    if not _looks_like_english(stripped):
        translated = _translate_to_english(stripped)
        if translated:
            picked = _pick_quickdraw_word(translated)
            if picked:
                stripped = picked
            else:
                stripped = translated
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
            quickdraw = quickdraw_alias_for_text(text, language)
        return {"text": text, "quickdraw": quickdraw}
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        return {"text": text, "quickdraw": quickdraw_alias_for_text(text, language)}
    return None


def normalize_prompt_pool(prompt_pool: Optional[List], language: str) -> List[Dict]:
    entries = []
    if isinstance(prompt_pool, list):
        for item in prompt_pool:
            entry = _coerce_prompt_entry(item, language)
            if entry:
                entries.append(entry)
    if entries:
        return entries
    defaults = DEFAULT_PROMPTS_BY_LANGUAGE.get(language, DEFAULT_PROMPTS_EN)
    return [clone_prompt_entry(entry) for entry in defaults]


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


def _set_quickdraw_offline(label: Optional[str] = None, error: Optional[Exception] = None) -> None:
    global _QUICKDRAW_ALLOW_NETWORK, _QUICKDRAW_NAME_MAP, _QUICKDRAW_CACHE_NAMES, _QUICKDRAW_OFFLINE_LOGGED
    if not _QUICKDRAW_ALLOW_NETWORK:
        return
    _QUICKDRAW_ALLOW_NETWORK = False
    _QUICKDRAW_CACHE_NAMES = None
    _QUICKDRAW_NAME_MAP = _quickdraw_cache_name_map()
    details = []
    if label:
        details.append(f"request: {label}")
    if error is not None:
        error_msg = " ".join(str(error).split())
        error_label = type(error).__name__
        if error_msg:
            error_label = f"{error_label}: {error_msg}"
        details.append(f"error: {error_label}")
    if details:
        print(f"[quickdraw] offline: {', '.join(details)}", flush=True)
    else:
        print("[quickdraw] offline: network disabled", flush=True)
    _QUICKDRAW_OFFLINE_LOGGED = True


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
    entries = normalize_prompt_pool(prompt_pool, language)
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


def _get_quickdraw_name_map(
    prompt: Optional[str] = None,
    translation: Optional[str] = None,
    query: Optional[str] = None,
) -> Dict[str, str]:
    global _QUICKDRAW_NAME_MAP, _QUICKDRAW_OFFLINE_LOGGED
    if _QUICKDRAW_NAME_MAP is not None:
        return _QUICKDRAW_NAME_MAP
    if not QUICKDRAW_AVAILABLE:
        _QUICKDRAW_NAME_MAP = {}
        return _QUICKDRAW_NAME_MAP
    _ensure_quickdraw_cache_dir()
    if not _QUICKDRAW_ALLOW_NETWORK:
        if not _QUICKDRAW_OFFLINE_LOGGED:
            print("[quickdraw] offline: using cached category names", flush=True)
            _QUICKDRAW_OFFLINE_LOGGED = True
        _QUICKDRAW_NAME_MAP = _quickdraw_cache_name_map()
        return _QUICKDRAW_NAME_MAP
    label = _quickdraw_request_label("QuickDrawData names", prompt, translation, query)
    start_time = _log_quickdraw_request_start(label)
    try:
        data = QuickDrawData(
            recognized=True,
            max_drawings=QUICKDRAW_MAX_DRAWINGS,
            refresh_data=False,
            jit_loading=True,
            print_messages=False,
            cache_dir=QUICKDRAW_CACHE_DIR,
        )
    except Exception as exc:
        _set_quickdraw_offline(label, exc)
        return _QUICKDRAW_NAME_MAP or {}
    finally:
        _log_quickdraw_request_end(label, start_time)
    _QUICKDRAW_NAME_MAP = {_normalize_name(name): name for name in data.drawing_names}
    return _QUICKDRAW_NAME_MAP


def _match_quickdraw_category(
    prompt: str,
    log_prompt: Optional[str] = None,
    log_translation: Optional[str] = None,
    log_query: Optional[str] = None,
) -> Optional[str]:
    if not QUICKDRAW_AVAILABLE:
        return None
    normalized = _normalize_name(prompt or "")
    if not normalized:
        return None
    query_label = log_query or prompt
    name_map = _get_quickdraw_name_map(log_prompt or prompt, log_translation, query_label)
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


def _get_quickdraw_group(
    category: str,
    prompt: Optional[str] = None,
    translation: Optional[str] = None,
    query: Optional[str] = None,
) -> Optional[QuickDrawDataGroup]:
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
    label = _quickdraw_request_label(f"QuickDrawDataGroup {category}", prompt, translation, query)
    start_time = _log_quickdraw_request_start(label)
    try:
        group = QuickDrawDataGroup(
            category,
            recognized=True,
            max_drawings=QUICKDRAW_MAX_DRAWINGS,
            refresh_data=False,
            print_messages=False,
            cache_dir=QUICKDRAW_CACHE_DIR,
        )
    except Exception as exc:
        _set_quickdraw_offline(label, exc)
        return None
    finally:
        _log_quickdraw_request_end(label, start_time)
    _QUICKDRAW_GROUPS[category] = group
    return group


def _quickdraw_to_data_url(
    category: str,
    rng: random.Random,
    prompt: Optional[str] = None,
    translation: Optional[str] = None,
    query: Optional[str] = None,
) -> Optional[str]:
    group = _get_quickdraw_group(category, prompt, translation, query)
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


def quickdraw_image_for_prompt(
    prompt_text: str,
    prompt_quickdraw: Optional[str],
    rng: random.Random,
) -> Optional[str]:
    if not QUICKDRAW_AVAILABLE:
        return None
    log_prompt = None
    if isinstance(prompt_text, str) and prompt_text.strip():
        log_prompt = prompt_text
    elif isinstance(prompt_quickdraw, str) and prompt_quickdraw.strip():
        log_prompt = prompt_quickdraw
    log_translation = None
    if isinstance(log_prompt, str) and log_prompt and not _looks_like_english(log_prompt):
        translated = _translate_to_english(log_prompt)
        if translated:
            log_translation = translated
    log_query = None
    if isinstance(prompt_quickdraw, str) and prompt_quickdraw.strip():
        log_query = prompt_quickdraw.strip()
    elif isinstance(prompt_text, str) and prompt_text.strip() and _looks_like_english(prompt_text):
        log_query = prompt_text.strip()
    category = None
    if prompt_quickdraw:
        category = _match_quickdraw_category(
            prompt_quickdraw,
            log_prompt=log_prompt,
            log_translation=log_translation,
            log_query=log_query,
        )
    if not category and prompt_text:
        category = _match_quickdraw_category(
            prompt_text,
            log_prompt=log_prompt,
            log_translation=log_translation,
            log_query=log_query,
        )
    if not category:
        name_map = _get_quickdraw_name_map(log_prompt, log_translation, log_query)
        if name_map:
            category = rng.choice(list(name_map.values()))
    if category:
        return _quickdraw_to_data_url(category, rng, log_prompt, log_translation, log_query)
    return None


def _cv_image_from_data_url(image_data: str) -> Optional["Image.Image"]:
    if Image is None or not isinstance(image_data, str):
        return None
    if not image_data.startswith("data:image/"):
        return None
    header, _, encoded = image_data.partition(",")
    if not encoded or "base64" not in header:
        return None
    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return None
    try:
        image = Image.open(io.BytesIO(raw))
    except Exception:
        return None
    try:
        if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
            background = Image.new("RGBA", image.size, (255, 255, 255, 255))
            image = Image.alpha_composite(background, image.convert("RGBA")).convert("RGB")
        else:
            image = image.convert("RGB")
    except Exception:
        return None
    return image


def _cv_image_signature(image: "Image.Image") -> Optional[List[int]]:
    if Image is None or ImageOps is None:
        return None
    try:
        gray = image.convert("L")
        inverted = ImageOps.invert(gray)
        bbox = inverted.getbbox()
        if not bbox:
            return None
        cropped = gray.crop(bbox)
        side = max(cropped.width, cropped.height)
        if side <= 0:
            return None
        square = Image.new("L", (side, side), color=255)
        square.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2))
        resized = square.resize((CV_IMAGE_SIZE, CV_IMAGE_SIZE))
    except Exception:
        return None
    pixels = list(resized.getdata())
    return [1 if value < CV_PIXEL_THRESHOLD else 0 for value in pixels]


def _cv_signature_distance(left: List[int], right: List[int]) -> int:
    return sum(abs(a - b) for a, b in zip(left, right))


def _cv_prompt_candidates(prompt_pool: Optional[List], language: str) -> Dict[str, Dict[str, List[str]]]:
    candidates: Dict[str, Dict[str, List[str]]] = {}
    for entry in normalize_prompt_pool(prompt_pool, language):
        text = entry.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        quickdraw = entry.get("quickdraw")
        if isinstance(quickdraw, str):
            quickdraw = quickdraw.strip() or None
        else:
            quickdraw = None
        if not quickdraw:
            quickdraw = quickdraw_alias_for_text(text, language)
        if not quickdraw:
            continue
        normalized = _normalize_name(quickdraw)
        bucket = candidates.get(normalized)
        if not bucket:
            bucket = {"category": quickdraw, "texts": []}
            candidates[normalized] = bucket
        cleaned_text = text.strip()
        if cleaned_text not in bucket["texts"]:
            bucket["texts"].append(cleaned_text)
    return candidates


def _cv_candidate_list(
    candidates: Dict[str, Dict[str, List[str]]],
    rng: random.Random,
) -> List[Dict[str, List[str]]]:
    if not candidates:
        return []
    cached_names = _quickdraw_cache_names()
    if cached_names:
        cached_map = {_normalize_name(name): name for name in cached_names}
        cached_candidates = []
        for key, value in candidates.items():
            cached_name = cached_map.get(key)
            if cached_name:
                cached_candidates.append({"category": cached_name, "texts": value["texts"]})
        if cached_candidates:
            candidates_list = cached_candidates
        else:
            candidates_list = [{"category": item["category"], "texts": item["texts"]} for item in candidates.values()]
    else:
        candidates_list = [{"category": item["category"], "texts": item["texts"]} for item in candidates.values()]
    if len(candidates_list) > CV_MAX_CANDIDATES:
        rng.shuffle(candidates_list)
        return candidates_list[:CV_MAX_CANDIDATES]
    return candidates_list


def _cv_sample_signatures(category: str, rng: random.Random) -> Optional[List[List[int]]]:
    cached = _CV_SAMPLE_CACHE.get(category)
    if cached and len(cached) >= CV_SAMPLES_PER_CATEGORY:
        return cached
    group = _get_quickdraw_group(category)
    if not group or group.drawing_count == 0:
        return cached if cached else None
    try:
        sample_count = min(CV_SAMPLES_PER_CATEGORY, group.drawing_count)
        if group.drawing_count <= sample_count:
            indices = list(range(group.drawing_count))
        else:
            indices = rng.sample(range(group.drawing_count), k=sample_count)
    except Exception:
        return None
    signatures = list(cached) if cached else []
    for idx in indices:
        if len(signatures) >= sample_count:
            break
        try:
            drawing = group.get_drawing(idx)
            image = drawing.get_image(stroke_width=3)
            image = image.convert("RGB")
        except Exception:
            continue
        signature = _cv_image_signature(image)
        if signature:
            signatures.append(signature)
    if not signatures:
        return None
    _CV_SAMPLE_CACHE[category] = signatures[:sample_count]
    return _CV_SAMPLE_CACHE[category]


def quickdraw_guess_from_image(
    image_data: str,
    prompt_pool: Optional[List],
    language: str,
) -> Optional[str]:
    if not QUICKDRAW_AVAILABLE:
        return None
    try:
        image = _cv_image_from_data_url(image_data)
        if not image:
            return None
        signature = _cv_image_signature(image)
        if not signature:
            return None
        rng = random.Random()
        candidates = _cv_prompt_candidates(prompt_pool, _normalize_language(language))
        candidate_list = _cv_candidate_list(candidates, rng)
        if not candidate_list:
            return None
        best_distance = None
        best_texts = None
        for candidate in candidate_list:
            category = candidate["category"]
            samples = _cv_sample_signatures(category, rng)
            if not samples:
                continue
            min_distance = None
            for sample in samples:
                distance = _cv_signature_distance(signature, sample)
                if min_distance is None or distance < min_distance:
                    min_distance = distance
            if min_distance is None:
                continue
            if best_distance is None or min_distance < best_distance:
                best_distance = min_distance
                best_texts = candidate["texts"]
        if not best_texts:
            return None
        return rng.choice(best_texts)
    except Exception:
        return None
