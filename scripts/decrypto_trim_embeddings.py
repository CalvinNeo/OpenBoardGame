import argparse
import gzip
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Callable, Dict, Iterable, Iterator, Optional, Tuple

try:
    from opencc import OpenCC
except Exception:  # pragma: no cover - optional dependency
    OpenCC = None


_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def _contains_cjk(text: str) -> bool:
    return bool(_CJK_RE.search(text or ""))


def _build_traditional_filter(enabled: bool) -> Optional[Callable[[str], bool]]:
    if not enabled:
        return None
    if OpenCC is None:
        raise RuntimeError(
            "Traditional filtering requires OpenCC. "
            "Install with: python -m pip install opencc-python-reimplemented"
        )
    converter = OpenCC("t2s")
    cache: Dict[str, bool] = {}

    def _is_traditional(text: str) -> bool:
        if not text:
            return False
        if text in cache:
            return cache[text]
        if not _contains_cjk(text):
            cache[text] = False
            return False
        simplified = converter.convert(text)
        result = simplified != text
        cache[text] = result
        return result

    return _is_traditional


def _open_text(path: Path) -> Iterator[str]:
    if path.suffix.lower() == ".gz":
        with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                yield line
    else:
        with path.open("r", encoding="utf-8", errors="ignore") as handle:
            for line in handle:
                yield line


def _parse_header(line: str) -> Optional[Tuple[int, int]]:
    parts = line.strip().split()
    if len(parts) != 2:
        return None
    if not all(part.isdigit() for part in parts):
        return None
    return int(parts[0]), int(parts[1])


def _write_config(
    config_path: Path,
    output_path: Path,
    max_words: int,
    cjk_only: bool,
    filter_traditional: bool,
) -> None:
    assets_dir = Path(__file__).resolve().parents[1] / "game" / "assets"
    try:
        relative_path = output_path.resolve().relative_to(assets_dir.resolve())
        config_value = str(relative_path).replace(os.sep, "/")
    except ValueError:
        config_value = str(output_path)
    payload = {
        "path": config_value,
        "max_words": max_words,
        "cjk_only": cjk_only,
        "filter_traditional": filter_traditional,
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _iter_embedding_lines(lines: Iterable[str]) -> Tuple[Optional[Tuple[int, int]], Iterator[str]]:
    iterator = iter(lines)
    try:
        first = next(iterator)
    except StopIteration:
        return None, iter(())
    header = _parse_header(first)
    if header:
        return header, iterator

    def _iter() -> Iterator[str]:
        yield first
        for line in iterator:
            yield line

    return None, _iter()


def _trim_embeddings(
    input_path: Path,
    output_path: Path,
    max_words: int,
    cjk_only: bool,
    filter_traditional: bool,
) -> Tuple[int, int]:
    header, lines = _iter_embedding_lines(_open_text(input_path))
    dim: Optional[int] = header[1] if header else None
    kept = 0
    total = 0
    seen = set()
    is_traditional = _build_traditional_filter(filter_traditional)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as out_handle:
        out_handle.write("0 0\n")
        for line in lines:
            total += 1
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            word = parts[0].lstrip("\ufeff")
            if word in seen:
                continue
            if cjk_only and not _contains_cjk(word):
                continue
            if is_traditional and is_traditional(word):
                continue
            vector = parts[1:]
            if dim is None:
                dim = len(vector)
            if dim <= 0 or len(vector) != dim:
                continue
            seen.add(word)
            out_handle.write(f"{word} {' '.join(vector)}\n")
            kept += 1
            if kept >= max_words:
                break

    if dim is None:
        dim = 0
    with output_path.open("r+", encoding="utf-8") as out_handle:
        out_handle.seek(0)
        out_handle.write(f"{kept} {dim}\n")
    return total, kept


def main() -> int:
    parser = argparse.ArgumentParser(description="Trim Chinese word embeddings for Decrypto bots.")
    parser.add_argument("--input", required=True, help="Path to source embeddings (.vec/.txt/.gz).")
    parser.add_argument(
        "--output",
        default=str(Path("game") / "assets" / "decrypto_vectors.vec"),
        help="Output embeddings path.",
    )
    parser.add_argument(
        "--max-words",
        type=int,
        default=100000,
        help="Max number of words to keep (suggest 50000-100000).",
    )
    parser.add_argument(
        "--cjk-only",
        action="store_true",
        default=True,
        help="Keep only words containing CJK characters (default).",
    )
    parser.add_argument(
        "--no-cjk-only",
        dest="cjk_only",
        action="store_false",
        help="Disable CJK-only filtering.",
    )
    parser.add_argument(
        "--filter-traditional",
        dest="filter_traditional",
        action="store_true",
        default=True,
        help="Filter out traditional Chinese words using OpenCC (default).",
    )
    parser.add_argument(
        "--no-filter-traditional",
        dest="filter_traditional",
        action="store_false",
        help="Disable traditional Chinese filtering.",
    )
    parser.add_argument(
        "--config",
        default=str(Path("game") / "assets" / "decrypto_embeddings_config.json"),
        help="Config output path.",
    )

    args = parser.parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    config_path = Path(args.config)

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 2
    if args.max_words <= 0:
        print("max-words must be > 0", file=sys.stderr)
        return 2

    start = time.time()
    try:
        total, kept = _trim_embeddings(
            input_path,
            output_path,
            args.max_words,
            args.cjk_only,
            args.filter_traditional,
        )
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    _write_config(config_path, output_path, kept, args.cjk_only, args.filter_traditional)
    elapsed = time.time() - start

    print(
        f"Trimmed embeddings to {kept} words (scanned {total} lines) in {elapsed:.1f}s.",
        flush=True,
    )
    print(f"Output: {output_path}", flush=True)
    print(f"Config: {config_path}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
