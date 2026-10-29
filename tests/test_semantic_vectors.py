import tempfile
import unittest
from pathlib import Path

from game.semantic_vectors import IndexedVectorStore


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
            self.assertFalse(store.contains("apple"))
            self.assertTrue(store.contains("new"))
            self.assertEqual(store.vector("new"), [0.0, 1.0])


if __name__ == "__main__":
    unittest.main()
