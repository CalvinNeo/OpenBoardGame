import json
import math
import re
from dataclasses import dataclass
from itertools import permutations
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional, Tuple


_CJK_RE = re.compile(r"[\u4e00-\u9fff]")
_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")

_ALPHA = 1.0
_BETA = 1.5
_GAMMA = 0.5
_TOP_N = 50
_CONFIDENCE_THRESHOLD = 0.1

_WORD_MODEL: Optional["WordVectorModel"] = None

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


class WordVectorModel:
    def __init__(self, vocabulary: List[str]) -> None:
        self.vocabulary = list(vocabulary)
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


def _assets_dir() -> Path:
    return Path(__file__).resolve().parent / "assets"


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


def _get_model() -> WordVectorModel:
    global _WORD_MODEL
    if _WORD_MODEL is None:
        _WORD_MODEL = WordVectorModel(_load_vocabulary())
    return _WORD_MODEL


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
    model: WordVectorModel,
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
            fallback_pool = [
                word
                for word in model.vocabulary
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

    centroid_vectors: Dict[int, Optional[Dict[str, float]]] = {}
    all_vectors: List[Dict[str, float]] = []
    for slot in range(1, 5):
        vectors = [model.vector(clue) for clue in history_by_slot.get(slot, [])]
        all_vectors.extend(vectors)
        centroid_vectors[slot] = _average_vectors(vectors)

    global_centroid = _average_vectors(all_vectors)
    for slot in range(1, 5):
        if centroid_vectors[slot] is None:
            centroid_vectors[slot] = global_centroid

    scores: List[List[float]] = []
    for clue in clues:
        if not isinstance(clue, str):
            return None
        clue_vec = model.vector(clue)
        row: List[float] = []
        for slot in range(1, 5):
            centroid = centroid_vectors.get(slot)
            if centroid is None:
                row.append(0.0)
            else:
                row.append(_cosine(clue_vec, centroid))
        scores.append(row)

    guess = _best_unique_assignment(scores)
    if not guess:
        return None
    return guess


_BOT_STRATEGIES: Dict[str, BotStrategy] = {
    "native": BotStrategy(
        strategy_id="native",
        label="native",
        description="Offline heuristic using character n-grams and cosine similarity.",
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
