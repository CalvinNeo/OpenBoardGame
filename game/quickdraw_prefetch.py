import argparse
import sys
from typing import List

from game import draw_guess
from game.draw_guess_prompts import DEFAULT_PROMPTS_BY_LANGUAGE

LANGUAGES = ("en", "zh")


def _prompt_pool_for_language(language: str) -> List[dict]:
    if language == "all":
        prompt_pool: List[dict] = []
        for lang in LANGUAGES:
            prompt_pool.extend(DEFAULT_PROMPTS_BY_LANGUAGE.get(lang, []))
        return prompt_pool
    return list(DEFAULT_PROMPTS_BY_LANGUAGE.get(language, []))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prefetch QuickDraw .bin files for Draw & Guess prompts.",
    )
    parser.add_argument(
        "--language",
        choices=("en", "zh", "all"),
        default="all",
        help="Prompt language to prefetch (default: all).",
    )
    args = parser.parse_args()

    if not draw_guess.QUICKDRAW_AVAILABLE:
        print("QuickDraw is unavailable (missing quickdraw/Pillow).", file=sys.stderr)
        print("Bins can still be downloaded, but bots will need the library at runtime.", file=sys.stderr)

    prompt_pool = _prompt_pool_for_language(args.language)
    if not prompt_pool:
        print("No prompts found for the selected language.", file=sys.stderr)
        return 1

    language = args.language if args.language in LANGUAGES else "en"
    categories = draw_guess.quickdraw_categories_for_prompts(prompt_pool, language)
    if not categories:
        print("No QuickDraw categories resolved from prompts.", file=sys.stderr)
        return 1

    results = draw_guess.prefetch_quickdraw_bins(categories)
    if not results:
        print("No bins were downloaded (offline or cache-only).", file=sys.stderr)
        return 1

    downloaded = [name for name, status in results.items() if status == "downloaded"]
    cached = [name for name, status in results.items() if status == "cached"]
    failed = [name for name, status in results.items() if status == "failed"]
    offline = [name for name, status in results.items() if status == "offline"]

    print(f"QuickDraw cache dir: {draw_guess.QUICKDRAW_CACHE_DIR}")
    print(f"Categories: {len(results)} (downloaded={len(downloaded)}, cached={len(cached)})")
    if offline:
        print("Offline categories:", ", ".join(sorted(offline)))
    if failed:
        print("Failed categories:", ", ".join(sorted(failed)))
    return 0 if not failed and not offline else 1


if __name__ == "__main__":
    raise SystemExit(main())
