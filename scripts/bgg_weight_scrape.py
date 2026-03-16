#!/usr/bin/env python3
"""
Scrape BGG Weight (averageweight) from a list of game URLs.

Usage:
  python scripts/bgg_weight_scrape.py
  python scripts/bgg_weight_scrape.py --out weights.json
"""

import argparse
import json
import re
import sys
from typing import Any, Dict, Optional

try:
    import cloudscraper
except ImportError:  # pragma: no cover - optional dependency
    cloudscraper = None  # type: ignore[assignment]

GAME_URLS = {
    "abraca_what": "https://boardgamegeek.com/boardgame/163930/abracadawhat",
    "fang_niao": "https://boardgamegeek.com/boardgame/245476/cubirds",
    "cyber_pictures": "https://boardgamegeek.com/boardgame/284108/pictures",
    "gold_rush": "https://boardgamegeek.com/boardgame/290/gold-digger",
    "draw_guess": "https://boardgamegeek.com/boardgame/46213/telestrations",
    "aidixit": "https://boardgamegeek.com/boardgame/39856/dixit",
    "flip7": "https://boardgamegeek.com/boardgame/420087/flip-7",
    "perfect_mismatch": "https://boardgamegeek.com/boardgame/424482/perfect-mismatch",
}


def _find_averageweight(obj: Any) -> Optional[float]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ("averageweight", "averageWeight"):
                if isinstance(value, dict) and "value" in value:
                    return _safe_float(value["value"])
                return _safe_float(value)
            found = _find_averageweight(value)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_averageweight(item)
            if found is not None:
                return found
    return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_from_html(html: str) -> Optional[float]:
    match = re.search(r'"averageweight"\s*:\s*([0-9.]+)', html)
    if match:
        return _safe_float(match.group(1))
    match = re.search(r"averageweight\s*:\s*([0-9.]+)", html)
    if match:
        return _safe_float(match.group(1))
    return None


def _fetch_html(url: str, timeout: int) -> str:
    if cloudscraper:
        scraper = cloudscraper.create_scraper()
        resp = scraper.get(url, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    raise RuntimeError("cloudscraper is required to bypass BGG protections. Install with: pip install cloudscraper")


def scrape_weights(timeout_sec: int) -> Dict[str, Optional[float]]:
    results: Dict[str, Optional[float]] = {}
    for game_id, url in GAME_URLS.items():
        weight: Optional[float] = None
        try:
            html = _fetch_html(url, timeout_sec)
            weight = _extract_from_html(html)
        except Exception:
            weight = None
        results[game_id] = weight
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape BGG averageweight values.")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds.")
    parser.add_argument("--out", type=str, default="", help="Write JSON output to a file.")
    args = parser.parse_args()

    if cloudscraper is None:
        print("cloudscraper is required. Install with: pip install cloudscraper", file=sys.stderr)
        return 1
    results = scrape_weights(args.timeout)
    payload = json.dumps(results, indent=2, sort_keys=True)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(payload + "\n")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
