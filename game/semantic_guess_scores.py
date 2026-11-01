"""Optional relative scores for Semantic Guess; raw cosine stays unchanged."""

from __future__ import annotations

from bisect import bisect_left, bisect_right
import math
from typing import Iterable, List, Optional, Sequence


MAX_NON_WINNING_CLOSENESS = 0.999


def build_score_reference(scores: Iterable[Optional[float]]) -> List[float]:
    """Keep a sorted, JSON-safe reference of valid raw cosine scores.

    Callers supply the already bounded startup sample, excluding the answer.
    Only scalar scores are retained; no vectors or candidate words are needed.
    """
    return sorted(float(score) for score in scores
                  if score is not None and math.isfinite(score) and -1.0 <= score <= 1.0)


def relative_closeness(score: float, reference: Sequence[float], *,
                       correct: bool = False) -> Optional[float]:
    """Return a midrank empirical percentile; reserve 100% for the answer.

    ``reference`` must be sorted, as returned by ``build_score_reference``.
    The reference is fixed for the game, so reconnects and later guesses do
    not move existing results. Equal cosine scores receive equal percentiles.
    Empty or singleton references cannot describe a useful distribution.
    """
    if correct:
        return 1.0
    if len(reference) < 2 or not math.isfinite(score):
        return None
    lower = bisect_left(reference, score)
    upper = bisect_right(reference, score)
    percentile = (lower + upper) / (2.0 * len(reference))
    return min(MAX_NON_WINNING_CLOSENESS, percentile)
