import json
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT_DIR / "game" / "dev_order.json"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from game import list_games


def first_commit_timestamp(path: str) -> int:
    result = subprocess.run(
        ["git", "log", "--diff-filter=A", "--follow", "--format=%ct", "--", path],
        cwd=ROOT_DIR,
        capture_output=True,
        check=True,
        text=True,
    )
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return int(lines[-1]) if lines else 0


def build_dev_order() -> dict[str, int]:
    rows: list[tuple[int, str]] = []
    for definition in list_games():
        module_name = getattr(definition.module, "__module__", "")
        module_path = f"{module_name.replace('.', '/')}.py"
        timestamp = first_commit_timestamp(module_path)
        rows.append((timestamp, definition.game_id))
    rows.sort(key=lambda row: (row[0], row[1]))
    return {game_id: index for index, (_, game_id) in enumerate(rows, start=1)}


def main() -> None:
    dev_order = build_dev_order()
    OUTPUT_PATH.write_text(
        json.dumps(dev_order, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(dev_order)} game orders to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
