import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT_DIR / "game" / "dev_order.json"
UPDATED_AT_PATH = ROOT_DIR / "game" / "updated_at.json"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from game import list_games

FRONTEND_SUFFIXES = ("js", "html", "css")
ASSET_ROOTS = ("game/assets", "assets", "static/assets")


def git_lines(args: List[str]) -> List[str]:
    result = subprocess.run(["git", *args], cwd=ROOT_DIR, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def first_commit_timestamp(path: str) -> int:
    result = subprocess.run(
        ["git", "log", "--diff-filter=A", "--format=%ct", "--", path],
        cwd=ROOT_DIR,
        capture_output=True,
        check=True,
        text=True,
    )
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if lines:
        return int(lines[-1])
    abs_path = ROOT_DIR / path
    if abs_path.exists():
        return int(abs_path.stat().st_mtime)
    return int(time.time())


def module_stem(definition) -> str:
    module_name = getattr(definition.module, "__module__", "")
    return module_name.rsplit(".", 1)[-1]


def module_owner(stems: Dict[str, str], file_stem: str) -> Optional[str]:
    """Map a game module file to its game, longest registered stem first.

    `skull_king_ai.py` belongs to skull_king even though `skull` also matches it.
    """
    owner: Optional[str] = None
    owner_length = -1
    for stem, game_id in stems.items():
        if file_stem == stem or file_stem.startswith(f"{stem}_"):
            if len(stem) > owner_length:
                owner, owner_length = game_id, len(stem)
    return owner


def collect_game_paths() -> Dict[str, List[str]]:
    """Group every per-game source file so an update to any of them counts."""
    definitions = list_games()
    stems = {module_stem(definition): definition.game_id for definition in definitions}
    paths: Dict[str, List[str]] = {definition.game_id: [] for definition in definitions}
    for module_path in sorted((ROOT_DIR / "game").glob("*.py")):
        owner = module_owner(stems, module_path.stem)
        if owner:
            paths[owner].append(f"game/{module_path.name}")
    for definition in definitions:
        game_id = definition.game_id
        paths[game_id].extend(
            f"static/games/{game_id}.{suffix}" for suffix in FRONTEND_SUFFIXES
        )
        for root in ASSET_ROOTS:
            paths[game_id].append(f"{root}/{game_id}")
            paths[game_id].append(f"{root}/{game_id}.json")
    return paths


def is_tracked(path: str, tracked: Set[str]) -> bool:
    if path in tracked:
        return True
    prefix = f"{path.rstrip('/')}/"
    return any(entry.startswith(prefix) for entry in tracked)


def last_update_timestamp(paths: List[str], tracked: Set[str]) -> int:
    existing = [path for path in paths if (ROOT_DIR / path).exists()]
    if not existing:
        return 0
    lines = git_lines(["log", "-1", "--format=%ct", "--", *existing])
    committed = int(lines[-1]) if lines else 0
    # A game still being written has no commit yet; its files still count as updates.
    pending = [
        int((ROOT_DIR / path).stat().st_mtime)
        for path in existing
        if not is_tracked(path, tracked)
    ]
    return max([committed, *pending])


def build_dev_order() -> Dict[str, int]:
    rows: List[Tuple[int, str]] = []
    for definition in list_games():
        module_name = getattr(definition.module, "__module__", "")
        module_path = f"{module_name.replace('.', '/')}.py"
        timestamp = first_commit_timestamp(module_path)
        rows.append((timestamp, definition.game_id))
    rows.sort(key=lambda row: (row[0], row[1]))
    return {game_id: index for index, (_, game_id) in enumerate(rows, start=1)}


def build_updated_at() -> Dict[str, int]:
    tracked = set(git_lines(["ls-files"]))
    updated: Dict[str, int] = {}
    for game_id, paths in collect_game_paths().items():
        timestamp = last_update_timestamp(paths, tracked)
        updated[game_id] = timestamp or int(time.time())
    # Newest first keeps the generated file readable as a "recently updated" list.
    return dict(sorted(updated.items(), key=lambda item: (-item[1], item[0])))


def write_json(path: Path, payload: Dict[str, int]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    dev_order = build_dev_order()
    write_json(OUTPUT_PATH, dev_order)
    print(f"Wrote {len(dev_order)} game orders to {OUTPUT_PATH}")
    updated_at = build_updated_at()
    write_json(UPDATED_AT_PATH, updated_at)
    print(f"Wrote {len(updated_at)} game update timestamps to {UPDATED_AT_PATH}")


if __name__ == "__main__":
    main()
