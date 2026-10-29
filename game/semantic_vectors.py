"""Small, disk-backed access layer for the Decrypto word vectors.

The source embedding file is hundreds of megabytes.  This module indexes byte
offsets once and reads only the two rows needed by a similarity calculation.
It deliberately does not call Decrypto's process-wide model loader.
"""

from __future__ import annotations

import os
import sqlite3
import tempfile
import threading
from contextlib import contextmanager
from collections import OrderedDict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence
import unicodedata


MAX_LINE_BYTES = 64 * 1024
SCHEMA_VERSION = "1"
_BUILD_LOCK = threading.RLock()
_STORES: Dict[str, "IndexedVectorStore"] = {}


@contextmanager
def _index_lock(path: Path):
    """Serialize index replacement across workers and processes when possible."""
    lock_path = Path(str(path) + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open("a+b")
    try:
        try:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        except (ImportError, OSError):
            pass
        yield
    finally:
        try:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        except (ImportError, OSError):
            pass
        handle.close()


def _norm(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(unicodedata.normalize("NFKC", value).strip().casefold().split())


def _embedding_source() -> Path:
    for name in ("OPENBOARDGAME_DECRYPTO_EMBEDDINGS", "DECRYPTO_EMBEDDINGS"):
        value = os.environ.get(name)
        if value and value.strip():
            return Path(value).expanduser()
    return Path(__file__).resolve().parents[1] / ".decrypto" / "decrypto_vectors.vec"


def _index_path(source: Path) -> Path:
    return Path(str(source) + ".sqlite3")


class IndexedVectorStore:
    mode = "indexed"

    def __init__(self, source: Path | str, index: Path | str | None = None,
                 cache_entries: int = 256) -> None:
        self.source = Path(source).expanduser()
        self.index = Path(index).expanduser() if index else _index_path(self.source)
        self.cache_entries = max(1, int(cache_entries))
        self._cache: OrderedDict[str, List[float]] = OrderedDict()
        self._ready = False
        self._ready_signature: Optional[tuple[int, int]] = None
        self._ready_index_signature: Optional[tuple[int, int]] = None
        self._lock = threading.RLock()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.index), timeout=30)
        connection.execute("PRAGMA query_only=ON")
        connection.execute("PRAGMA cache_size=-2048")
        return connection

    def _valid_index(self) -> bool:
        try:
            if not self.source.is_file() or not self.index.is_file():
                return False
            stat = self.source.stat()
            with sqlite3.connect(str(self.index), timeout=2) as db:
                metadata = dict(db.execute("SELECT key,value FROM metadata"))
                db.execute("SELECT COUNT(*) FROM vectors").fetchone()
                return (
                    metadata.get("schema_version") == SCHEMA_VERSION
                    and int(metadata.get("source_size", "-1")) == stat.st_size
                    and int(metadata.get("source_mtime_ns", "-1")) == stat.st_mtime_ns
                )
        except (OSError, ValueError, sqlite3.Error):
            return False

    def ensure_ready(self) -> "IndexedVectorStore":
        try:
            stat = self.source.stat()
            signature = (stat.st_size, stat.st_mtime_ns)
            index_stat = self.index.stat()
            index_signature = (index_stat.st_size, index_stat.st_mtime_ns)
        except OSError:
            signature = None
            index_signature = None
        with self._lock:
            if (self._ready and signature == self._ready_signature
                    and index_signature == self._ready_index_signature):
                return self
        with self._lock, _BUILD_LOCK, _index_lock(self.index):
            if not self.source.is_file():
                raise FileNotFoundError(str(self.source))
            stat = self.source.stat()
            signature = (stat.st_size, stat.st_mtime_ns)
            try:
                index_stat = self.index.stat()
                index_signature = (index_stat.st_size, index_stat.st_mtime_ns)
            except OSError:
                index_signature = None
            if (self._ready and signature == self._ready_signature
                    and index_signature == self._ready_index_signature):
                return self
            if not self._valid_index():
                self._cache.clear()
                self._build_index()
            # Opening the database here catches partial/corrupt indexes early.
            with self._connect() as db:
                db.execute("SELECT 1 FROM metadata LIMIT 1").fetchone()
            self._ready = True
            self._ready_signature = signature
            index_stat = self.index.stat()
            self._ready_index_signature = (index_stat.st_size, index_stat.st_mtime_ns)
            return self

    def _build_index(self) -> None:
        stat = self.source.stat()
        self.index.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=self.index.name + ".", suffix=".tmp", dir=str(self.index.parent))
        os.close(fd)
        tmp = Path(tmp_name)
        count = 0
        malformed = 0
        dimension = 0
        try:
            db = sqlite3.connect(str(tmp), timeout=30)
            db.execute("PRAGMA journal_mode=OFF")
            db.execute("PRAGMA synchronous=OFF")
            db.execute("PRAGMA cache_size=-2048")
            db.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID")
            db.execute("CREATE TABLE vectors (word TEXT PRIMARY KEY, offset INTEGER NOT NULL, length INTEGER NOT NULL) WITHOUT ROWID")
            with self.source.open("rb") as handle:
                header = handle.readline()
                try:
                    header_parts = header.decode("utf-8").strip().split()
                    if len(header_parts) >= 2:
                        dimension = int(header_parts[1])
                except (UnicodeDecodeError, ValueError):
                    malformed += 1
                batch = []
                while True:
                    offset = handle.tell()
                    line = handle.readline()
                    if not line:
                        break
                    if len(line) > MAX_LINE_BYTES:
                        malformed += 1
                        continue
                    try:
                        text = line.decode("utf-8").strip()
                        parts = text.split()
                        if len(parts) < 2:
                            malformed += 1
                            continue
                        word = _norm(parts[0])
                        if not word:
                            malformed += 1
                            continue
                        values = [float(item) for item in parts[1:]]
                        if dimension and len(values) != dimension:
                            malformed += 1
                            continue
                    except (UnicodeDecodeError, ValueError, OverflowError):
                        malformed += 1
                        continue
                    batch.append((word, offset, len(line)))
                    if len(batch) >= 4000:
                        db.executemany("INSERT OR IGNORE INTO vectors(word,offset,length) VALUES(?,?,?)", batch)
                        count += len(batch)
                        batch.clear()
                if batch:
                    db.executemany("INSERT OR IGNORE INTO vectors(word,offset,length) VALUES(?,?,?)", batch)
                    count += len(batch)
            # count is a row insert estimate; report exact value for diagnostics.
            count = int(db.execute("SELECT COUNT(*) FROM vectors").fetchone()[0])
            metadata = {
                "schema_version": SCHEMA_VERSION,
                "source_path": str(self.source),
                "source_size": str(stat.st_size),
                "source_mtime_ns": str(stat.st_mtime_ns),
                "declared_count": str(header_parts[0]) if 'header_parts' in locals() and header_parts else "",
                "dimension": str(dimension),
                "indexed_words": str(count),
                "malformed_rows": str(malformed),
                "max_line_bytes": str(MAX_LINE_BYTES),
            }
            db.executemany("INSERT INTO metadata(key,value) VALUES(?,?)", metadata.items())
            db.commit()
            db.close()
            os.replace(str(tmp), str(self.index))
        finally:
            try:
                tmp.unlink()
            except FileNotFoundError:
                pass

    def _lookup(self, key: str) -> Optional[tuple[int, int]]:
        self.ensure_ready()
        try:
            with self._connect() as db:
                row = db.execute("SELECT offset,length FROM vectors WHERE word=?", (key,)).fetchone()
                return (int(row[0]), int(row[1])) if row else None
        except sqlite3.Error:
            self._ready = False
            self._ready_signature = None
            self._ready_index_signature = None
            raise

    def contains(self, word: str) -> bool:
        return self._lookup(_norm(word)) is not None

    def filter_words(self, words: Iterable[str]) -> List[str]:
        candidates = list(words)
        if not candidates:
            return []
        self.ensure_ready()
        normalized = {_norm(word): word for word in candidates if _norm(word)}
        if not normalized:
            return []
        try:
            with self._connect() as db:
                found = set()
                keys = list(normalized)
                # Keep below SQLite's default variable limit for larger packs.
                for start in range(0, len(keys), 900):
                    chunk = keys[start:start + 900]
                    placeholders = ",".join("?" for _ in chunk)
                    rows = db.execute(
                        f"SELECT word FROM vectors WHERE word IN ({placeholders})",
                        tuple(chunk),
                    )
                    found.update(row[0] for row in rows)
        except sqlite3.Error:
            self._ready = False
            self._ready_signature = None
            self._ready_index_signature = None
            raise
        return [word for word in candidates if _norm(word) in found]

    def vector(self, word: str) -> Optional[List[float]]:
        key = _norm(word)
        if not key:
            return None
        with self._lock:
            cached = self._cache.get(key)
            if cached is not None:
                self._cache.move_to_end(key)
                return list(cached)
        location = self._lookup(key)
        if location is None:
            return None
        offset, length = location
        with self.source.open("rb") as handle:
            handle.seek(offset)
            line = handle.read(length)
        try:
            parts = line.decode("utf-8").strip().split()
            values = [float(value) for value in parts[1:]]
        except (UnicodeDecodeError, ValueError, IndexError):
            return None
        with self._lock:
            self._cache[key] = values
            self._cache.move_to_end(key)
            while len(self._cache) > self.cache_entries:
                self._cache.popitem(last=False)
        return list(values)

    def similarity(self, left: str, right: str) -> float:
        left_vector = self.vector(left)
        right_vector = self.vector(right)
        if left_vector is None or right_vector is None:
            raise ValueError("vector not found")
        # Reuse the production dense-vector implementation.  Constructing a
        # two-row model keeps the 240k-row model out of this process while
        # preserving its signed cosine behavior.
        from game.decrypto_ai import WordVectorModel
        model = WordVectorModel({"__left__": left_vector, "__right__": right_vector})
        return model.similarity("__left__", "__right__")

    def close(self) -> None:
        with self._lock:
            self._cache.clear()
            self._ready = False
            self._ready_signature = None
            self._ready_index_signature = None


def get_store() -> IndexedVectorStore:
    source = _embedding_source()
    key = str(source.resolve())
    with _BUILD_LOCK:
        store = _STORES.get(key)
        if store is None:
            store = IndexedVectorStore(source)
            _STORES[key] = store
        return store


__all__ = ["IndexedVectorStore", "get_store", "MAX_LINE_BYTES"]
