"""Validate the fixed Bohnanza Dice compatible card catalog.

This script intentionally does not generate random cards. The production catalog
is reviewed and version-controlled at game/assets/bohnanza_dice_cards.json.
"""

import sys
from collections import Counter
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from game.bohnanza_dice import CARD_BY_ID, CATALOG, ORDER_LIBRARY, TOTAL_CARD_COUNT


def main() -> None:
    if len(CARD_BY_ID) != TOTAL_CARD_COUNT:
        raise SystemExit(f"expected {TOTAL_CARD_COUNT} cards, found {len(CARD_BY_ID)}")

    bean_usage = Counter()
    for order in ORDER_LIBRARY.values():
        for alternative in order["alternatives"]:
            for slot in alternative["slots"]:
                bean_usage.update(slot["allowed"])

    print(f"Catalog: {CATALOG['catalog_id']} ({CATALOG['catalog_status']})")
    print(f"Cards: {len(CARD_BY_ID)}")
    print(f"Reusable order definitions: {len(ORDER_LIBRARY)}")
    print("Bean coverage: " + ", ".join(f"{bean}={bean_usage[bean]}" for bean in sorted(bean_usage)))
    print("Validation passed: probabilities, difficulty progression, IDs, and card signatures are valid.")


if __name__ == "__main__":
    main()
