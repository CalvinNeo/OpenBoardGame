import json
import math
import os
import re
from dataclasses import dataclass
from itertools import chain, permutations
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple

try:
    import jieba
except Exception:  # pragma: no cover - optional dependency
    jieba = None


_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")

_EMBEDDING_CONFIG_FILENAME = "decrypto_embeddings_config.json"
_DEFAULT_EMBEDDING_FILENAMES = (
    "decrypto_vectors.vec",
    "decrypto_vectors.txt",
    "decrypto_vectors.jsonl",
    "decrypto_vectors.json",
)
_EMBEDDING_PATH_KEYS = ("OPENBOARDGAME_DECRYPTO_EMBEDDINGS", "DECRYPTO_EMBEDDINGS")
_EMBEDDING_MAX_WORDS_KEYS = (
    "OPENBOARDGAME_DECRYPTO_EMBEDDINGS_MAX_WORDS",
    "DECRYPTO_EMBEDDINGS_MAX_WORDS",
)
_EMBEDDING_CJK_ONLY_KEYS = (
    "OPENBOARDGAME_DECRYPTO_EMBEDDINGS_CJK_ONLY",
    "DECRYPTO_EMBEDDINGS_CJK_ONLY",
)

_ALPHA = 1.0
_BETA = 1.5
_GAMMA = 0.5
_TOP_N = 50
_CONFIDENCE_THRESHOLD = 0.1

_WORD_MODEL: Optional["BaseVectorModel"] = None
_MODEL_MODE: Optional[str] = None

DEFAULT_BOT_STRATEGY_ID = "native"


@dataclass(frozen=True)
class BotStrategy:
    strategy_id: str
    label: str
    description: str
    pick_encryptor_clues: Callable[[List[str], List[int], List[str], List[Dict]], Optional[List[str]]]
    pick_decrypt_guess: Callable[[List[str], List[str], List[Dict]], Optional[List[int]]]
    pick_intercept_guess: Callable[[List[str], List[Dict]], Optional[List[int]]]


def _normalize_text(value: Optional[str]) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().casefold().split())


def _contains_cjk(text: str) -> bool:
    return bool(_CJK_RE.search(text or ""))


def _get_env_value(keys: Iterable[str]) -> Optional[str]:
    for key in keys:
        raw = os.environ.get(key)
        if isinstance(raw, str):
            cleaned = raw.strip()
            if cleaned:
                return cleaned
    return None


def _parse_int(value: Optional[object]) -> Optional[int]:
    if value is None:
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def _parse_bool(value: Optional[object], default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if not isinstance(value, str):
        return default
    normalized = value.strip().lower()
    if normalized in ("1", "true", "yes", "on"):
        return True
    if normalized in ("0", "false", "no", "off"):
        return False
    return default


def _tokenize(text: str) -> List[str]:
    if not isinstance(text, str):
        return []
    cleaned = text.strip().casefold()
    if not cleaned:
        return []
    cjk_chars = [ch for ch in cleaned if _CJK_RE.match(ch)]
    if cjk_chars:
        bigrams = [cjk_chars[i] + cjk_chars[i + 1] for i in range(len(cjk_chars) - 1)]
        return cjk_chars + bigrams
    return _TOKEN_RE.findall(cleaned)


def _vectorize(tokens: Iterable[str]) -> Dict[str, float]:
    vec: Dict[str, float] = {}
    for token in tokens:
        if not token:
            continue
        vec[token] = vec.get(token, 0.0) + 1.0
    return vec


def _cosine(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    dot = 0.0
    for key, val in vec_a.items():
        other = vec_b.get(key)
        if other:
            dot += val * other
    if dot <= 0.0:
        return 0.0
    norm_a = math.sqrt(sum(val * val for val in vec_a.values()))
    norm_b = math.sqrt(sum(val * val for val in vec_b.values()))
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _cosine_dense(vec_a: List[float], vec_b: List[float]) -> float:
    if not vec_a or not vec_b:
        return 0.0
    dot = 0.0
    for left, right in zip(vec_a, vec_b):
        dot += left * right
    if dot <= 0.0:
        return 0.0
    norm_a = math.sqrt(sum(val * val for val in vec_a))
    norm_b = math.sqrt(sum(val * val for val in vec_b))
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _average_dense_vectors(vectors: List[List[float]]) -> Optional[List[float]]:
    if not vectors:
        return None
    length = len(vectors[0])
    if length <= 0:
        return None
    avg = [0.0 for _ in range(length)]
    count = 0
    for vec in vectors:
        if not vec:
            continue
        count += 1
        for idx, val in enumerate(vec):
            avg[idx] += val
    if count <= 0:
        return None
    for idx in range(length):
        avg[idx] /= float(count)
    return avg


def _greedy_cjk_segment(text: str, vocab: set, max_len: int) -> List[str]:
    if not text:
        return []
    if not vocab or max_len <= 1:
        return [ch for ch in text if _CJK_RE.match(ch)]
    tokens: List[str] = []
    idx = 0
    length = len(text)
    while idx < length:
        char = text[idx]
        if char.isspace():
            idx += 1
            continue
        match = None
        upper = min(length, idx + max_len)
        for end in range(upper, idx, -1):
            candidate = text[idx:end]
            if candidate in vocab:
                match = candidate
                break
        if match:
            tokens.append(match)
            idx += len(match)
        else:
            if _CJK_RE.match(char):
                tokens.append(char)
            idx += 1
    return tokens


class BaseVectorModel:
    vocabulary: List[str]
    fallback_vocabulary: List[str]

    def vector(self, text: str) -> Optional[object]:
        raise NotImplementedError

    def similarity(self, text_a: str, text_b: str) -> float:
        raise NotImplementedError

    def top_similar(self, target: str, top_n: int) -> List[Tuple[float, str]]:
        raise NotImplementedError

    def average_vectors(self, vectors: List[object]) -> Optional[object]:
        raise NotImplementedError

    def cosine_vectors(self, vec_a: object, vec_b: object) -> float:
        raise NotImplementedError

    def zero_vector(self) -> Optional[object]:
        raise NotImplementedError


class WordVectorModel(BaseVectorModel):
    def __init__(self, vectors: Dict[str, List[float]], fallback_vocabulary: Optional[List[str]] = None) -> None:
        self.vectors = dict(vectors)
        self.vocabulary = list(vectors.keys())
        self.fallback_vocabulary = list(fallback_vocabulary or [])
        self._norms: Dict[str, float] = {}
        for word, vec in vectors.items():
            self._norms[word] = math.sqrt(sum(val * val for val in vec))
        self._vector_cache: Dict[str, Tuple[Optional[List[float]], float]] = {}
        self._top_cache: Dict[str, List[Tuple[float, str]]] = {}
        self._cjk_vocab = {word for word in self.vectors if _contains_cjk(word)}
        self._max_cjk_len = max((len(word) for word in self._cjk_vocab), default=1)
        self._dim = len(next(iter(self.vectors.values()))) if self.vectors else 0

    def _segment_text(self, text: str) -> List[str]:
        cleaned = text.strip()
        if not cleaned:
            return []
        if _contains_cjk(cleaned):
            if jieba is not None:
                try:
                    tokens = [token.strip() for token in jieba.lcut(cleaned) if token.strip()]
                    if tokens:
                        return tokens
                except Exception:
                    pass
            return _greedy_cjk_segment(cleaned, self._cjk_vocab, self._max_cjk_len)
        return _TOKEN_RE.findall(cleaned.casefold())

    def _vector_with_norm(self, text: str) -> Tuple[Optional[List[float]], float]:
        if not isinstance(text, str):
            return None, 0.0
        cleaned = text.strip()
        if not cleaned:
            return None, 0.0
        if cleaned in self.vectors:
            return self.vectors[cleaned], self._norms.get(cleaned, 0.0)
        cache_key = _normalize_text(cleaned)
        cached = self._vector_cache.get(cache_key)
        if cached is not None:
            return cached
        tokens = self._segment_text(cleaned)
        vectors = [self.vectors[token] for token in tokens if token in self.vectors]
        if not vectors:
            self._vector_cache[cache_key] = (None, 0.0)
            return None, 0.0
        avg = _average_dense_vectors(vectors)
        if not avg:
            self._vector_cache[cache_key] = (None, 0.0)
            return None, 0.0
        norm = math.sqrt(sum(val * val for val in avg))
        self._vector_cache[cache_key] = (avg, norm)
        return avg, norm

    def vector(self, text: str) -> Optional[List[float]]:
        vec, _ = self._vector_with_norm(text)
        return vec

    def similarity(self, text_a: str, text_b: str) -> float:
        vec_a, norm_a = self._vector_with_norm(text_a)
        vec_b, norm_b = self._vector_with_norm(text_b)
        if not vec_a or not vec_b or norm_a <= 0.0 or norm_b <= 0.0:
            return 0.0
        dot = 0.0
        for left, right in zip(vec_a, vec_b):
            dot += left * right
        return dot / (norm_a * norm_b)

    def top_similar(self, target: str, top_n: int) -> List[Tuple[float, str]]:
        cache_key = _normalize_text(target)
        cached = self._top_cache.get(cache_key)
        if cached is not None:
            return cached[:top_n]
        target_vec, target_norm = self._vector_with_norm(target)
        if not target_vec or target_norm <= 0.0:
            return []
        scores: List[Tuple[float, str]] = []
        for word, vec in self.vectors.items():
            norm = self._norms.get(word, 0.0)
            if norm <= 0.0:
                continue
            dot = 0.0
            for left, right in zip(target_vec, vec):
                dot += left * right
            score = dot / (target_norm * norm)
            scores.append((score, word))
        scores.sort(key=lambda item: (-item[0], item[1]))
        if top_n:
            scores = scores[:top_n]
        self._top_cache[cache_key] = scores
        return scores[:top_n]

    def average_vectors(self, vectors: List[List[float]]) -> Optional[List[float]]:
        return _average_dense_vectors(vectors)

    def cosine_vectors(self, vec_a: List[float], vec_b: List[float]) -> float:
        return _cosine_dense(vec_a, vec_b)

    def zero_vector(self) -> Optional[List[float]]:
        if self._dim <= 0:
            return None
        return [0.0 for _ in range(self._dim)]


class NgramVectorModel(BaseVectorModel):
    def __init__(self, vocabulary: List[str]) -> None:
        self.vocabulary = list(vocabulary)
        self.fallback_vocabulary = list(self.vocabulary)
        self._vec_cache: Dict[str, Dict[str, float]] = {}
        for word in self.vocabulary:
            self._vec_cache[word] = _vectorize(_tokenize(word))

    def vector(self, text: str) -> Dict[str, float]:
        if text in self._vec_cache:
            return self._vec_cache[text]
        vec = _vectorize(_tokenize(text))
        self._vec_cache[text] = vec
        return vec

    def similarity(self, text_a: str, text_b: str) -> float:
        return _cosine(self.vector(text_a), self.vector(text_b))

    def top_similar(self, target: str, top_n: int) -> List[Tuple[float, str]]:
        scores: List[Tuple[float, str]] = []
        for word in self.vocabulary:
            scores.append((self.similarity(word, target), word))
        scores.sort(key=lambda item: (-item[0], item[1]))
        return scores[:top_n]

    def average_vectors(self, vectors: List[Dict[str, float]]) -> Optional[Dict[str, float]]:
        return _average_vectors(vectors)

    def cosine_vectors(self, vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
        return _cosine(vec_a, vec_b)

    def zero_vector(self) -> Dict[str, float]:
        return {}


def _assets_dir() -> Path:
    return Path(__file__).resolve().parent / "assets"


def _load_embedding_config() -> Dict[str, object]:
    config: Dict[str, object] = {"path": None, "max_words": None, "cjk_only": True}
    config_path = _assets_dir() / _EMBEDDING_CONFIG_FILENAME
    if config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                raw_path = data.get("path")
                if isinstance(raw_path, str) and raw_path.strip():
                    config["path"] = raw_path.strip()
                config["max_words"] = _parse_int(data.get("max_words"))
                config["cjk_only"] = _parse_bool(data.get("cjk_only"), default=True)
        except Exception:
            pass

    env_path = _get_env_value(_EMBEDDING_PATH_KEYS)
    if env_path:
        config["path"] = env_path
    env_max_words = _get_env_value(_EMBEDDING_MAX_WORDS_KEYS)
    if env_max_words:
        config["max_words"] = _parse_int(env_max_words)
    env_cjk_only = _get_env_value(_EMBEDDING_CJK_ONLY_KEYS)
    if env_cjk_only:
        config["cjk_only"] = _parse_bool(env_cjk_only, default=True)

    if not config.get("path"):
        assets_dir = _assets_dir()
        for filename in _DEFAULT_EMBEDDING_FILENAMES:
            candidate = assets_dir / filename
            if candidate.exists():
                config["path"] = str(candidate)
                break

    raw_path = config.get("path")
    if isinstance(raw_path, str) and raw_path.strip():
        resolved = Path(raw_path)
        if not resolved.is_absolute():
            resolved = _assets_dir() / resolved
        config["path"] = resolved
    else:
        config["path"] = None
    return config


def _load_embeddings_text(
    path: Path,
    max_words: Optional[int],
    cjk_only: bool,
) -> Dict[str, List[float]]:
    vectors: Dict[str, List[float]] = {}
    dim: Optional[int] = None
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            first = handle.readline()
            first_parts = first.strip().split()
            if len(first_parts) == 2 and all(part.isdigit() for part in first_parts):
                lines = handle
            else:
                lines = chain([first], handle)
            for line in lines:
                if not isinstance(line, str):
                    continue
                parts = line.strip().split()
                if len(parts) < 3:
                    continue
                word = parts[0].lstrip("\ufeff")
                if cjk_only and not _contains_cjk(word):
                    continue
                try:
                    vec = [float(val) for val in parts[1:]]
                except ValueError:
                    continue
                if dim is None:
                    dim = len(vec)
                if len(vec) != dim:
                    continue
                if word in vectors:
                    continue
                vectors[word] = vec
                if max_words and len(vectors) >= max_words:
                    break
    except Exception:
        return {}
    return vectors


def _load_embeddings_json(
    path: Path,
    max_words: Optional[int],
    cjk_only: bool,
) -> Dict[str, List[float]]:
    vectors: Dict[str, List[float]] = {}
    dim: Optional[int] = None

    def _add_vector(word: str, vec: object) -> None:
        nonlocal dim
        if not isinstance(word, str) or not word.strip():
            return
        word = word.lstrip("\ufeff")
        if cjk_only and not _contains_cjk(word):
            return
        if not isinstance(vec, list) or not vec:
            return
        try:
            cleaned = [float(val) for val in vec]
        except (TypeError, ValueError):
            return
        if dim is None:
            dim = len(cleaned)
        if len(cleaned) != dim:
            return
        if word in vectors:
            return
        vectors[word] = cleaned

    try:
        if path.suffix.lower() == ".jsonl":
            with path.open("r", encoding="utf-8", errors="ignore") as handle:
                for line in handle:
                    if max_words and len(vectors) >= max_words:
                        break
                    try:
                        data = json.loads(line)
                    except ValueError:
                        continue
                    if isinstance(data, dict):
                        _add_vector(data.get("word"), data.get("vector"))
        else:
            with path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict) and "vectors" in data and isinstance(data["vectors"], dict):
                data = data["vectors"]
            if isinstance(data, dict):
                for word, vec in data.items():
                    _add_vector(word, vec)
                    if max_words and len(vectors) >= max_words:
                        break
            elif isinstance(data, list):
                for entry in data:
                    if max_words and len(vectors) >= max_words:
                        break
                    if isinstance(entry, dict):
                        _add_vector(entry.get("word"), entry.get("vector"))
                    elif isinstance(entry, list) and len(entry) == 2:
                        _add_vector(entry[0], entry[1])
    except Exception:
        return {}
    return vectors


def _load_embeddings() -> Optional[Dict[str, List[float]]]:
    config = _load_embedding_config()
    path = config.get("path")
    if not isinstance(path, Path) or not path.exists():
        return None
    max_words = _parse_int(config.get("max_words"))
    cjk_only = _parse_bool(config.get("cjk_only"), default=True)
    if path.suffix.lower() in (".json", ".jsonl"):
        vectors = _load_embeddings_json(path, max_words, cjk_only)
    else:
        vectors = _load_embeddings_text(path, max_words, cjk_only)
    if not vectors:
        return None
    return vectors


def _load_word_pack_index() -> List[Dict]:
    path = _assets_dir() / "decrypto_word_packs.json"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        return []
    return [entry for entry in data if isinstance(entry, dict)]


def _load_words_from_pack(path: Path) -> List[str]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        words = data.get("words", [])
    else:
        words = data
    if not isinstance(words, list):
        return []
    result: List[str] = []
    for word in words:
        if not isinstance(word, str):
            continue
        cleaned = " ".join(word.strip().split())
        if cleaned:
            result.append(cleaned)
    return result


def _load_vocabulary() -> List[str]:
    packs = _load_word_pack_index()
    if not packs:
        return []
    vocab: List[str] = []
    base_dir = _assets_dir()
    for pack in packs:
        raw_path = pack.get("path")
        if not isinstance(raw_path, str) or not raw_path.strip():
            continue
        pack_path = Path(raw_path)
        if not pack_path.is_absolute():
            pack_path = base_dir / pack_path
        vocab.extend(_load_words_from_pack(pack_path))
    deduped: List[str] = []
    seen = set()
    for word in vocab:
        key = _normalize_text(word)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(word)
    return deduped


def _get_model() -> BaseVectorModel:
    global _WORD_MODEL
    global _MODEL_MODE
    if _WORD_MODEL is None:
        embeddings = _load_embeddings()
        if embeddings:
            _WORD_MODEL = WordVectorModel(embeddings, fallback_vocabulary=_load_vocabulary())
            _MODEL_MODE = "embeddings"
        else:
            _WORD_MODEL = NgramVectorModel(_load_vocabulary())
            _MODEL_MODE = "fallback"
    return _WORD_MODEL


def get_model_mode() -> str:
    if _WORD_MODEL is None:
        _get_model()
    return _MODEL_MODE or "fallback"


def _history_by_slot(history: List[Dict]) -> Dict[int, List[str]]:
    mapping: Dict[int, List[str]] = {1: [], 2: [], 3: [], 4: []}
    for entry in history:
        code = entry.get("code") or []
        clues = entry.get("clues") or []
        if not isinstance(code, list) or not isinstance(clues, list):
            continue
        for idx, number in enumerate(code):
            if idx >= len(clues):
                continue
            if number in mapping:
                clue = clues[idx]
                if isinstance(clue, str) and clue.strip():
                    mapping[number].append(clue)
    return mapping


def _average_vectors(vectors: List[Dict[str, float]]) -> Optional[Dict[str, float]]:
    if not vectors:
        return None
    avg: Dict[str, float] = {}
    for vec in vectors:
        for token, val in vec.items():
            avg[token] = avg.get(token, 0.0) + val
    count = float(len(vectors))
    for token in list(avg.keys()):
        avg[token] = avg[token] / count
    return avg


def _best_unique_assignment(scores: List[List[float]]) -> Optional[List[int]]:
    if len(scores) != 3 or any(len(row) != 4 for row in scores):
        return None
    best_perm: Optional[Tuple[int, int, int]] = None
    best_score = None
    for perm in permutations(range(4), 3):
        total = scores[0][perm[0]] + scores[1][perm[1]] + scores[2][perm[2]]
        if best_score is None or total > best_score:
            best_score = total
            best_perm = perm
    if best_perm is None:
        return None
    return [idx + 1 for idx in best_perm]


def _is_disallowed_clue(word: str, target: str, keywords: List[str], used: set) -> bool:
    normalized = _normalize_text(word)
    if not normalized or normalized in used:
        return True
    if normalized == _normalize_text(target):
        return True
    for kw in keywords:
        if normalized == _normalize_text(kw):
            return True
    if target and (target in word or word in target):
        return True
    return False


def _score_candidate(
    model: BaseVectorModel,
    candidate: str,
    target: str,
    other_keywords: List[str],
    history_clues: List[str],
) -> float:
    sim_target = model.similarity(candidate, target)
    sim_other = 0.0
    if other_keywords:
        sim_other = max(model.similarity(candidate, other) for other in other_keywords)
    sim_history = 0.0
    if history_clues:
        sims = [model.similarity(candidate, clue) for clue in history_clues]
        sim_history = sum(sims) / float(len(sims)) if sims else 0.0
    return (sim_target * _ALPHA) - (sim_other * _BETA) - (sim_history * _GAMMA)


def _native_pick_encryptor_clues(
    keywords: List[str],
    code: List[int],
    used_clues: List[str],
    history: List[Dict],
) -> Optional[List[str]]:
    """Select clues for encryptor role using the native vector-space heuristic."""
    if not isinstance(keywords, list) or len(keywords) != 4:
        return None
    if not isinstance(code, list) or len(code) != 3:
        return None
    model = _get_model()
    used = {_normalize_text(item) for item in used_clues or [] if isinstance(item, str)}
    history_by_slot = _history_by_slot(history or [])
    chosen: List[str] = []

    for number in code:
        if not isinstance(number, int) or number < 1 or number > 4:
            return None
        target = keywords[number - 1]
        if not isinstance(target, str) or not target.strip():
            return None
        target_is_cjk = _contains_cjk(target)
        other_keywords = [kw for idx, kw in enumerate(keywords) if idx != number - 1]
        candidates = model.top_similar(target, _TOP_N) if model.vocabulary else []
        best_word = None
        best_score = None

        for _, word in candidates:
            if not isinstance(word, str) or not word.strip():
                continue
            if target_is_cjk and not _contains_cjk(word):
                continue
            if _is_disallowed_clue(word, target, keywords, used):
                continue
            if word in chosen:
                continue
            score = _score_candidate(
                model, word, target, other_keywords, history_by_slot.get(number, [])
            )
            if best_score is None or score > best_score:
                best_score = score
                best_word = word

        if best_word is None:
            fallback_vocab = (
                model.fallback_vocabulary if getattr(model, "fallback_vocabulary", None) else model.vocabulary
            )
            fallback_pool = [
                word
                for word in fallback_vocab
                if isinstance(word, str)
                and word.strip()
                and (not target_is_cjk or _contains_cjk(word))
                and not _is_disallowed_clue(word, target, keywords, used)
                and word not in chosen
            ]
            fallback_pool.sort()
            if not fallback_pool:
                return None
            best_word = fallback_pool[0]

        chosen.append(best_word)
        used.add(_normalize_text(best_word))

    return chosen


def _native_pick_decrypt_guess(
    clues: List[str],
    keywords: List[str],
    history: List[Dict],
) -> Optional[List[int]]:
    """Select decrypt guess for teammate role (native)."""
    if not isinstance(clues, list) or len(clues) != 3:
        return None
    if not isinstance(keywords, list) or len(keywords) != 4:
        return None
    model = _get_model()
    scores: List[List[float]] = []
    for clue in clues:
        if not isinstance(clue, str):
            return None
        row = [model.similarity(clue, kw) for kw in keywords]
        scores.append(row)

    guess = _best_unique_assignment(scores)
    if not guess:
        return None

    # Confidence check: if any clue is too ambiguous, keep deterministic but allow.
    for row in scores:
        ordered = sorted(row, reverse=True)
        if len(ordered) >= 2 and (ordered[0] - ordered[1]) < _CONFIDENCE_THRESHOLD:
            break

    return guess


def _native_pick_intercept_guess(
    clues: List[str],
    opponent_history: List[Dict],
) -> Optional[List[int]]:
    """Select intercept guess for opponent role using centroid clustering (native)."""
    if not isinstance(clues, list) or len(clues) != 3:
        return None
    model = _get_model()
    history_by_slot = _history_by_slot(opponent_history or [])

    centroid_vectors: Dict[int, Optional[object]] = {}
    all_vectors: List[object] = []
    for slot in range(1, 5):
        vectors: List[object] = []
        for clue in history_by_slot.get(slot, []):
            vec = model.vector(clue)
            if vec:
                vectors.append(vec)
        all_vectors.extend(vectors)
        centroid_vectors[slot] = model.average_vectors(vectors)

    global_centroid = model.average_vectors(all_vectors)
    for slot in range(1, 5):
        if centroid_vectors[slot] is None:
            centroid_vectors[slot] = global_centroid or model.zero_vector()

    scores: List[List[float]] = []
    for clue in clues:
        if not isinstance(clue, str):
            return None
        clue_vec = model.vector(clue)
        row: List[float] = []
        for slot in range(1, 5):
            centroid = centroid_vectors.get(slot)
            if centroid is None or not clue_vec:
                row.append(0.0)
            else:
                row.append(model.cosine_vectors(clue_vec, centroid))
        scores.append(row)

    guess = _best_unique_assignment(scores)
    if not guess:
        return None
    return guess


_BOT_STRATEGIES: Dict[str, BotStrategy] = {
    "native": BotStrategy(
        strategy_id="native",
        label="native",
        description="Vector-space model with offline embeddings (fallbacks to n-gram similarity when missing).",
        pick_encryptor_clues=_native_pick_encryptor_clues,
        pick_decrypt_guess=_native_pick_decrypt_guess,
        pick_intercept_guess=_native_pick_intercept_guess,
    )
}


def get_bot_strategies() -> List[Dict]:
    strategies = []
    for strategy in _BOT_STRATEGIES.values():
        strategies.append(
            {
                "strategy_id": strategy.strategy_id,
                "label": strategy.label,
                "description": strategy.description,
            }
        )
    strategies.sort(key=lambda item: item["strategy_id"])
    return strategies


def normalize_bot_strategy_id(strategy_id: Optional[str]) -> str:
    if isinstance(strategy_id, str):
        normalized = strategy_id.strip()
        if normalized in _BOT_STRATEGIES:
            return normalized
    return DEFAULT_BOT_STRATEGY_ID


def _resolve_strategy(strategy_id: Optional[str]) -> BotStrategy:
    resolved = normalize_bot_strategy_id(strategy_id)
    return _BOT_STRATEGIES[resolved]


def pick_encryptor_clues(
    keywords: List[str],
    code: List[int],
    used_clues: List[str],
    history: List[Dict],
    strategy_id: Optional[str] = None,
) -> Optional[List[str]]:
    """Select clues for encryptor role using a chosen bot strategy."""
    strategy = _resolve_strategy(strategy_id)
    return strategy.pick_encryptor_clues(keywords, code, used_clues, history)


def pick_decrypt_guess(
    clues: List[str],
    keywords: List[str],
    history: List[Dict],
    strategy_id: Optional[str] = None,
) -> Optional[List[int]]:
    """Select decrypt guess for teammate role using a chosen bot strategy."""
    strategy = _resolve_strategy(strategy_id)
    return strategy.pick_decrypt_guess(clues, keywords, history)


def pick_intercept_guess(
    clues: List[str],
    opponent_history: List[Dict],
    strategy_id: Optional[str] = None,
) -> Optional[List[int]]:
    """Select intercept guess for opponent role using a chosen bot strategy."""
    strategy = _resolve_strategy(strategy_id)
    return strategy.pick_intercept_guess(clues, opponent_history)
