#!/usr/bin/env python3
"""Build the semantic vector byte-offset index without importing the app."""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import sys


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", type=Path)
    parser.add_argument("--index", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    # Load this one standard-library module directly.  Importing
    # ``game.semantic_vectors`` would execute game/__init__.py and eagerly
    # import every game module, defeating the low-memory/offline purpose.
    module_path = root / "game" / "semantic_vectors.py"
    spec = importlib.util.spec_from_file_location("_semantic_vectors_cli", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    IndexedVectorStore = module.IndexedVectorStore
    _embedding_source = module._embedding_source
    _index_path = module._index_path

    source = args.source or _embedding_source()
    index = args.index or _index_path(source)
    store = IndexedVectorStore(source, index)
    store.ensure_ready()
    print(f"indexed {source} -> {index}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
