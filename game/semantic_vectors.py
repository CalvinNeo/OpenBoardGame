"""Small, disk-backed access layer for the Decrypto word vectors.

The source embedding file is hundreds of megabytes.  This module indexes byte
offsets once and reads only the two rows needed by a similarity calculation.
It deliberately does not call Decrypto's process-wide model loader.
"""

from __future__ import annotations

import os
import math
import sqlite3
import tempfile
import threading
import time
from contextlib import closing, contextmanager
from collections import OrderedDict
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional
import unicodedata


MAX_LINE_BYTES = 64 * 1024
SCHEMA_VERSION = "1"
_BUILD_LOCK = threading.RLock()
_STORES: Dict[str, "IndexedVectorStore"] = {}
_STARTUP_WORK = threading.local()


class StartupProgressError(RuntimeError):
    """A progress consumer cancelled or failed, rather than a bad vector row."""


class StartupWorkBudget:
    """Cooperatively spend at most about a third of one core during startup.

    Charge each small CPU slice against its own wall time.  I/O and queue waits
    can pay for that slice, but unused idle time is never banked for later work.
    Injectable clocks keep the duty-cycle behavior deterministic in tests.
    """

    def __init__(self, progress_callback: Optional[Callable[[str, float], None]] = None,
                 *, cpu_fraction: float = 1 / 3, cpu_quantum: float = 0.005,
                 cpu_clock=None, wall_clock=None, sleep=None) -> None:
        if not 0 < cpu_fraction <= 1 or cpu_quantum <= 0:
            raise ValueError("invalid startup CPU budget")
        self.cpu_fraction = cpu_fraction
        self.cpu_quantum = cpu_quantum
        self.cpu_clock = cpu_clock or time.thread_time
        self.wall_clock = wall_clock or time.monotonic
        self.sleep = sleep or time.sleep
        self.progress_callback = progress_callback
        self.stage = "index"
        self.progress = 0.0
        self._cpu_start = self.cpu_clock()
        self._wall_start = self.wall_clock()
        self._last_report = float("-inf")
        self.interrupted = False

    def _report(self, force: bool = False) -> None:
        now = self.wall_clock()
        if self.progress_callback is None or (not force and now - self._last_report < 0.1):
            return
        self._last_report = now
        try:
            self.progress_callback(self.stage, self.progress)
        except Exception as exc:
            self.interrupted = True
            raise StartupProgressError("semantic startup progress interrupted") from exc

    def checkpoint(self, stage: Optional[str] = None, progress: Optional[float] = None,
                   force: bool = False) -> None:
        changed_stage = stage is not None and stage != self.stage
        if stage is not None:
            self.stage = stage
        if progress is not None:
            self.progress = max(self.progress, min(1.0, max(0.0, float(progress))))
        self._report(force or changed_stage)
        cpu_elapsed = max(0.0, self.cpu_clock() - self._cpu_start)
        if not force and cpu_elapsed < self.cpu_quantum:
            return
        wall_elapsed = max(0.0, self.wall_clock() - self._wall_start)
        delay = max(0.0, cpu_elapsed / self.cpu_fraction - wall_elapsed)
        deadline = self.wall_clock() + delay
        while delay > 0:
            self.sleep(min(delay, 0.05))
            self._report()
            delay = max(0.0, deadline - self.wall_clock())
        self._cpu_start = self.cpu_clock()
        self._wall_start = self.wall_clock()


@contextmanager
def startup_work(progress_callback=None, *, budget: Optional[StartupWorkBudget] = None):
    """Share a budget across nested preparation, index and hint operations."""
    current = getattr(_STARTUP_WORK, "budget", None)
    if current is not None:
        yield current
        return
    active = budget or StartupWorkBudget(progress_callback)
    _STARTUP_WORK.budget = active
    try:
        yield active
        if not active.interrupted:
            active.checkpoint(force=True)
    finally:
        del _STARTUP_WORK.budget


def startup_checkpoint(stage: Optional[str] = None, progress: Optional[float] = None,
                       force: bool = False) -> None:
    budget = getattr(_STARTUP_WORK, "budget", None)
    if budget is not None:
        budget.checkpoint(stage, progress, force)


@contextmanager
def _cooperative_lock(lock):
    """Continue cancellation/progress heartbeats while another reader builds."""
    while not lock.acquire(timeout=0.1):
        startup_checkpoint(force=True)
    try:
        yield
    finally:
        lock.release()


@contextmanager
def _index_lock(path: Path):
    """Serialize index replacement across workers and processes when possible."""
    lock_path = Path(str(path) + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open("a+b")
    try:
        try:
            import fcntl
            while True:
                try:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    time.sleep(0.05)
                    startup_checkpoint()
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
            with closing(sqlite3.connect(str(self.index), timeout=2)) as db:
                metadata = dict(db.execute("SELECT key,value FROM metadata"))
                db.execute("SELECT 1 FROM vectors LIMIT 1").fetchone()
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
        with _cooperative_lock(self._lock):
            if (self._ready and signature == self._ready_signature
                    and index_signature == self._ready_index_signature):
                return self
        with _cooperative_lock(self._lock), _cooperative_lock(_BUILD_LOCK), _index_lock(self.index):
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
            self._cache.clear()
            if not self._valid_index():
                self._build_index()
            # Opening the database here catches partial/corrupt indexes early.
            with closing(self._connect()) as db:
                db.execute("SELECT 1 FROM metadata LIMIT 1").fetchone()
            self._ready = True
            self._ready_signature = signature
            index_stat = self.index.stat()
            self._ready_index_signature = (index_stat.st_size, index_stat.st_mtime_ns)
            return self

    def _build_index(self) -> None:
        # The offline CLI uses this same conservative default, even without a
        # game-start progress callback or an enclosing startup budget.
        with startup_work():
            self._build_index_throttled()

    def _build_index_throttled(self) -> None:
        stat = self.source.stat()
        startup_checkpoint("index", 0.0)
        self.index.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=self.index.name + ".", suffix=".tmp", dir=str(self.index.parent))
        os.close(fd)
        tmp = Path(tmp_name)
        count = 0
        malformed = 0
        dimension = 0
        db = None
        try:
            db = sqlite3.connect(str(tmp), timeout=30)
            db.execute("PRAGMA journal_mode=OFF")
            db.execute("PRAGMA synchronous=OFF")
            db.execute("PRAGMA cache_size=-2048")
            db.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID")
            db.execute("CREATE TABLE vectors (word TEXT PRIMARY KEY, offset INTEGER NOT NULL, length INTEGER NOT NULL) WITHOUT ROWID")
            with self.source.open("rb") as handle:
                header = handle.readline(MAX_LINE_BYTES + 1)
                if len(header) > MAX_LINE_BYTES:
                    raise ValueError("embedding header is too long")
                try:
                    header_parts = header.decode("utf-8").strip().split()
                    if len(header_parts) >= 2:
                        dimension = int(header_parts[1])
                except (UnicodeDecodeError, ValueError):
                    malformed += 1
                batch = []
                while True:
                    offset = handle.tell()
                    startup_checkpoint("index", 0.75 * offset / max(1, stat.st_size))
                    line = handle.readline(MAX_LINE_BYTES + 1)
                    if not line:
                        break
                    if len(line) > MAX_LINE_BYTES:
                        malformed += 1
                        # Drain malformed rows in bounded chunks, never allocate
                        # an arbitrarily large line on the low-memory host.
                        while line and not line.endswith(b"\n"):
                            line = handle.readline(MAX_LINE_BYTES + 1)
                            startup_checkpoint("index", 0.75 * handle.tell() / max(1, stat.st_size))
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
                        if not all(math.isfinite(value) for value in values):
                            malformed += 1
                            continue
                        if dimension and len(values) != dimension:
                            malformed += 1
                            continue
                    except (UnicodeDecodeError, ValueError, OverflowError):
                        malformed += 1
                        continue
                    batch.append((word, offset, len(line)))
                    if len(batch) >= 128:
                        db.executemany("INSERT OR IGNORE INTO vectors(word,offset,length) VALUES(?,?,?)", batch)
                        count += len(batch)
                        batch.clear()
                        startup_checkpoint()
                if batch:
                    db.executemany("INSERT OR IGNORE INTO vectors(word,offset,length) VALUES(?,?,?)", batch)
                    count += len(batch)
                    startup_checkpoint()
            # No full index scan at the end: SQLite counts successful inserts,
            # including duplicate suppression, without additional row reads.
            count = db.total_changes
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
            startup_checkpoint()
            db.close()
            os.replace(str(tmp), str(self.index))
            startup_checkpoint("index", 0.75)
        finally:
            if db is not None:
                db.close()
            try:
                tmp.unlink()
            except FileNotFoundError:
                pass

    def _lookup(self, key: str) -> Optional[tuple[int, int]]:
        self.ensure_ready()
        try:
            with closing(self._connect()) as db:
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
        normalized = {}
        for position, word in enumerate(candidates, 1):
            key = _norm(word)
            if key:
                normalized[key] = word
            startup_checkpoint("vocabulary", 0.77 + 0.02 * position / len(candidates))
        if not normalized:
            return []
        try:
            with closing(self._connect()) as db:
                found = set()
                keys = list(normalized)
                # Keep below SQLite's default variable limit for larger packs.
                for start in range(0, len(keys), 128):
                    chunk = keys[start:start + 128]
                    placeholders = ",".join("?" for _ in chunk)
                    rows = db.execute(
                        f"SELECT word FROM vectors WHERE word IN ({placeholders})",
                        tuple(chunk),
                    )
                    found.update(row[0] for row in rows)
                    startup_checkpoint("vocabulary", 0.79 + 0.04 * min(start + 128, len(keys)) / len(keys))
        except sqlite3.Error:
            self._ready = False
            self._ready_signature = None
            self._ready_index_signature = None
            raise
        result = []
        for position, word in enumerate(candidates, 1):
            if _norm(word) in found:
                result.append(word)
            startup_checkpoint("vocabulary", 0.83 + 0.02 * position / len(candidates))
        return result

    def vector(self, word: str) -> Optional[List[float]]:
        key = _norm(word)
        if not key:
            return None
        self.ensure_ready()
        with self._lock:
            cached = self._cache.get(key)
            if cached is not None:
                self._cache.move_to_end(key)
                return list(cached)
        location = self._lookup(key)
        if location is None:
            return None
        offset, length = location
        if offset < 0 or not 0 < length <= MAX_LINE_BYTES:
            return None
        with self.source.open("rb") as handle:
            handle.seek(offset)
            line = handle.read(length)
        try:
            parts = line.decode("utf-8").strip().split()
            values = [float(value) for value in parts[1:]]
        except (UnicodeDecodeError, ValueError, IndexError, OverflowError):
            return None
        if (not parts or _norm(parts[0]) != key or not values
                or not all(math.isfinite(value) for value in values)):
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
    with _cooperative_lock(_BUILD_LOCK):
        store = _STORES.get(key)
        if store is None:
            store = IndexedVectorStore(source)
            _STORES[key] = store
        return store


__all__ = ["IndexedVectorStore", "get_store", "MAX_LINE_BYTES", "StartupWorkBudget",
           "StartupProgressError", "startup_work", "startup_checkpoint"]
