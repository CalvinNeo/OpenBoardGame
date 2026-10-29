import tempfile
import sqlite3
import unittest
from pathlib import Path
from unittest.mock import patch

from game.semantic_vectors import IndexedVectorStore, MAX_LINE_BYTES


class SemanticVectorStoreTests(unittest.TestCase):
    def _store(self, directory):
        source = Path(directory) / "vectors.vec"
        index = Path(directory) / "vectors.sqlite3"
        source.write_text("3 2\napple 1 0\npear -1 0\nmoon 0 1\n", encoding="utf-8")
        return source, index, IndexedVectorStore(source, index, cache_entries=2)

    def test_signed_cosine_and_batch_filter(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, store = self._store(directory)
            self.assertEqual(store.filter_words(["apple", "missing", "pear"]), ["apple", "pear"])
            self.assertAlmostEqual(store.similarity("apple", "pear"), -1.0)
            self.assertAlmostEqual(store.similarity("apple", "moon"), 0.0)

    def test_corrupt_index_is_rebuilt(self):
        with tempfile.TemporaryDirectory() as directory:
            source, index, store = self._store(directory)
            store.ensure_ready()
            index.write_bytes(b"not sqlite")
            fresh = IndexedVectorStore(source, index)
            self.assertTrue(fresh.contains("apple"))

    def test_source_signature_change_rebuilds_offsets(self):
        with tempfile.TemporaryDirectory() as directory:
            source, index, store = self._store(directory)
            self.assertEqual(store.vector("apple"), [1.0, 0.0])
            self.assertTrue(store.contains("apple"))
            source.write_text("3 2\nnew 0 1\npear -1 0\n", encoding="utf-8")
            self.assertIsNone(store.vector("apple"))
            self.assertFalse(store.contains("apple"))
            self.assertTrue(store.contains("new"))
            self.assertEqual(store.vector("new"), [0.0, 1.0])

    def test_large_malformed_row_does_not_hide_next_valid_word(self):
        with tempfile.TemporaryDirectory() as directory:
            source, _, store = self._store(directory)
            source.write_bytes(b"2 2\nbad " + b"1 " * MAX_LINE_BYTES + b"\nmoon 0 1\n")
            self.assertFalse(store.contains("bad"))
            self.assertEqual(store.vector("moon"), [0.0, 1.0])

    def test_nonfinite_vectors_are_not_playable(self):
        with tempfile.TemporaryDirectory() as directory:
            source, _, store = self._store(directory)
            source.write_text("3 2\nbad nan 1\nworse inf 0\nmoon 0 1\n", encoding="utf-8")
            self.assertEqual(store.filter_words(["bad", "worse", "moon"]), ["moon"])
            self.assertIsNone(store.vector("bad"))

    def test_lookups_close_database_handles_and_keep_cache_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, store = self._store(directory)
            store.ensure_ready()
            connections = []
            connect = store._connect

            def tracked_connect():
                connection = connect()
                connections.append(connection)
                return connection

            with patch.object(store, "_connect", side_effect=tracked_connect):
                for _ in range(3):
                    for word in ["apple", "pear", "moon"]:
                        self.assertIsNotNone(store.vector(word))
                self.assertTrue(store.contains("apple"))
                self.assertEqual(store.filter_words(["apple", "moon"]), ["apple", "moon"])
            self.assertLessEqual(len(store._cache), 2)
            self.assertTrue(connections)
            for connection in connections:
                with self.assertRaises(sqlite3.ProgrammingError):
                    connection.execute("SELECT 1")


if __name__ == "__main__":
    unittest.main()
