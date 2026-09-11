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
from typing import Dict, Optional
from urllib.request import Request, urlopen

GAME_URLS = {
    "abraca_what": "https://boardgamegeek.com/boardgame/163930/abracadawhat",
    "fang_niao": "https://boardgamegeek.com/boardgame/245476/cubirds",
    "cyber_pictures": "https://boardgamegeek.com/boardgame/284108/pictures",
    "gold_rush": "https://boardgamegeek.com/boardgame/290/gold-digger",
    "draw_guess": "https://boardgamegeek.com/boardgame/46213/telestrations",
    "aidixit": "https://boardgamegeek.com/boardgame/39856/dixit",
    "flip7": "https://boardgamegeek.com/boardgame/420087/flip-7",
    "perfect_mismatch": "https://boardgamegeek.com/boardgame/424482/perfect-mismatch",
    "age_of_war": "https://boardgamegeek.com/boardgame/28086/age-of-war",
    "wandering_towers": "https://boardgamegeek.com/boardgame/355483/wandering-towers",
    "tagiron": "https://boardgamegeek.com/boardgame/227466/break-the-code",
    "dumb_questions": "https://boardgamegeek.com/boardgame/423792/dumb-questions-to-ask-your-friends",
    "rebel_princess": "https://boardgamegeek.com/boardgame/381249/rebel-princess",
    "witchs_brew": "https://boardgamegeek.com/boardgame/34084/witchs-brew",
    # word_decode is intentionally omitted: BGG has no entry for it as of 2026-09-12.
}

BGG_DYNAMIC_INFO_URL = "https://api.geekdo.com/api/dynamicinfo?objecttype=thing&objectid={object_id}"


def _safe_float(value: object) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_object_id(game_url: str) -> str:
    match = re.search(r"/boardgame/(\d+)(?:/|$)", game_url)
    if not match:
        raise ValueError(f"invalid BGG game URL: {game_url}")
    return match.group(1)


def _fetch_weight(game_url: str, timeout: int) -> Optional[float]:
    object_id = _extract_object_id(game_url)
    request = Request(
        BGG_DYNAMIC_INFO_URL.format(object_id=object_id),
        headers={"Accept": "application/json", "User-Agent": "OpenBoardGame weight lookup"},
    )
    with urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))

    stats = payload.get("item", {}).get("stats", {})
    weight = _safe_float(stats.get("avgweight"))
    num_weights = _safe_float(stats.get("numweights"))
    if weight is None or not num_weights:
        return None
    return weight


def scrape_weights(timeout_sec: int) -> Dict[str, Optional[float]]:
    results: Dict[str, Optional[float]] = {}
    for game_id, url in GAME_URLS.items():
        weight: Optional[float] = None
        try:
            weight = _fetch_weight(url, timeout_sec)
        except Exception:
            weight = None
        results[game_id] = weight
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape BGG averageweight values.")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout in seconds.")
    parser.add_argument("--out", type=str, default="", help="Write JSON output to a file.")
    args = parser.parse_args()

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
