"""Build the bundled Yahtzee table using a C++17 compiler, then gzip it.

Run from any directory: python3 scripts/build_yahtzee_policy.py
Only Python's standard library and a compiler are needed for this offline step.
The server needs neither a compiler nor extra Python dependencies.
"""

import argparse
import gzip
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from game.yahtzee import CATEGORY_ORDER, _calculate_possible_scores
from game.yahtzee_ai import (
    ALL_CATEGORIES, TABLE_MAGIC, TABLE_PATH, TABLE_SIZE, YAHTZEE_BIT,
    _dice_graph, _sheet_for_state,
)


def write_solver_input(path: Path) -> None:
    _, children, keeps, rolls = _dice_graph()
    with path.open("w", encoding="utf-8") as output:
        def row(values):
            output.write(" ".join(map(str, values)) + "\n")

        for hand in children:
            row(hand)
        for hand in keeps:
            row((len(hand),) + hand)
        sheet = _sheet_for_state(ALL_CATEGORIES, False)
        for dice in rolls:
            scores, _, _ = _calculate_possible_scores(list(dice), sheet)
            row(scores[cat] for cat in CATEGORY_ORDER)
        row(dice[0] - 1 if len(set(dice)) == 1 else -1 for dice in rolls)
        for mask in range(1, ALL_CATEGORIES + 1):
            if mask & YAHTZEE_BIT:
                continue
            sheet = _sheet_for_state(mask, True)
            for face in range(1, 7):
                scores, allowed, _ = _calculate_possible_scores([face] * 5, sheet)
                row([sum(1 << CATEGORY_ORDER.index(cat) for cat in allowed)]
                    + [scores.get(cat, 0) for cat in CATEGORY_ORDER])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=TABLE_PATH)
    parser.add_argument("--compiler", default=os.environ.get("CXX", "c++"))
    args = parser.parse_args()
    if not shutil.which(args.compiler):
        parser.error("A C++17 compiler is required to regenerate the table")
    with tempfile.TemporaryDirectory(prefix="yahtzee-policy-") as scratch:
        directory = Path(scratch)
        inputs, raw, executable = (directory / name for name in ("input.txt", "values.bin", "solver"))
        write_solver_input(inputs)
        subprocess.run([args.compiler, "-O3", "-std=c++17", str(Path(__file__).with_name("yahtzee_policy_solver.cpp")),
                        "-o", str(executable)], check=True)
        subprocess.run([str(executable), str(inputs), str(raw)], check=True)
        values = array("f")
        values.frombytes(raw.read_bytes())
        if len(values) != TABLE_SIZE:
            raise ValueError("Solver returned the wrong table size")
        opening = float(values[(ALL_CATEGORIES * 64) * 2])
        if sys.byteorder != "little":
            values.byteswap()
        payload = TABLE_MAGIC + values.tobytes()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # A fixed timestamp and empty embedded filename make the asset reproducible.
        with args.output.open("wb") as target:
            with gzip.GzipFile(filename="", mode="wb", fileobj=target, mtime=0) as compressed:
                compressed.write(payload)
        metadata = {
            "format": TABLE_MAGIC.decode("ascii"),
            "categories": CATEGORY_ORDER,
            "entries": TABLE_SIZE,
            "sha256_uncompressed": hashlib.sha256(payload).hexdigest(),
            "opening_expected_score": opening,
            "objective": "maximum expected final score under game/yahtzee.py rules",
        }
        args.output.with_suffix("").with_suffix(".json").write_text(
            json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.output} ({args.output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
