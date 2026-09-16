import shutil
import subprocess
import unittest
from pathlib import Path

from game import guandan


class GuandanFindStraightFlushTests(unittest.TestCase):
    def test_frontend_cursor_wraps_after_last_candidate(self):
        script_path = (
            Path(__file__).resolve().parents[1] / "static" / "games" / "guandan.js"
        )
        source = script_path.read_text(encoding="utf-8")
        helpers = source[
            source.index("function guandanOptionKey") : source.index(
                "function getGuandanHintOptions"
            )
        ]
        test_script = helpers + """
const candidates = [
  {key: "1-2-3-4-5", high_value: 6, cards: [1, 2, 3, 4, 5]},
  {key: "6-7-8-9-10", high_value: 7, cards: [6, 7, 8, 9, 10]},
  {key: "1-2-3-4-5", high_value: 8, cards: [1, 2, 3, 4, 5]},
];
let cursor = null;
const indexes = [];
for (let click = 0; click < 7; click += 1) {
  cursor = getGuandanNextSfCursor(candidates, cursor ? cursor.key : "", cursor);
  indexes.push(cursor.index);
}
const actual = indexes.join(",");
if (actual !== "0,1,2,0,1,2,0") {
  throw new Error(`unexpected Find SF cycle: ${actual}`);
}
"""
        javascript_core = Path(
            "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
        )
        node = shutil.which("node")
        if node:
            command = [node, "-e", test_script]
        elif javascript_core.exists():
            command = [str(javascript_core), "-e", test_script]
        else:
            self.skipTest("No JavaScript runtime is available")

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)

    def test_public_candidates_deduplicate_equivalent_wild_selections(self):
        players = [
            {
                "player_id": f"p{seat + 1}",
                "name": f"P{seat + 1}",
                "seat": seat,
                "is_bot": False,
            }
            for seat in range(4)
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["level_rank"] = 2
        deck = guandan._full_deck()
        wilds = [
            card
            for card in deck
            if card.get("suit") == "hearts" and card.get("rank") == 2
        ]
        suited_run = [
            next(
                card
                for card in deck
                if card.get("suit") == "spades" and card.get("rank") == rank
            )
            for rank in (4, 5, 6)
        ]
        hand = wilds + suited_run
        state["players"]["p1"]["hand"] = hand

        view = guandan.GuandanGame.get_public_view(state, "p1")
        target_key = "-".join(
            str(card_id) for card_id in sorted(card["id"] for card in hand)
        )
        matches = [
            candidate
            for candidate in view["sf_candidates"]
            if candidate["key"] == target_key
        ]

        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]["high_value"], 8)
        keys = [candidate["key"] for candidate in view["sf_candidates"]]
        self.assertEqual(len(keys), len(set(keys)))


if __name__ == "__main__":
    unittest.main()
