import re
import unittest
from collections import defaultdict
from pathlib import Path


GAME_SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "static" / "games"
TOP_LEVEL_FUNCTION_RE = re.compile(r"^function\s+([A-Za-z_$][\w$]*)\s*\(")


class FrontendScriptNameTests(unittest.TestCase):
    def test_top_level_game_helpers_have_unique_names(self):
        declarations = defaultdict(list)
        for script_path in sorted(GAME_SCRIPTS_DIR.glob("*.js")):
            for line_number, line in enumerate(
                script_path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                match = TOP_LEVEL_FUNCTION_RE.match(line)
                if match:
                    declarations[match.group(1)].append(
                        f"{script_path.name}:{line_number}"
                    )

        duplicates = {
            name: locations
            for name, locations in declarations.items()
            if len(locations) > 1
        }
        self.assertEqual(
            duplicates,
            {},
            "Top-level game helpers share the browser global scope: "
            f"{duplicates}",
        )


if __name__ == "__main__":
    unittest.main()
