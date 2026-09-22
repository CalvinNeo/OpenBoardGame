import json
import os
import sys
import threading
import tracemalloc
import unittest
from array import array
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from game import decrypto, decrypto_ai


class DecryptoModelLoadingTests(unittest.TestCase):
    def test_text_embeddings_keep_precision_with_compact_storage(self):
        values = [index / 301 for index in range(300)]
        with TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.vec"
            path.write_text("2 300\n山 " + " ".join(map(str, values)) + "\n河 " +
                            " ".join(map(str, reversed(values))) + "\n", encoding="utf-8")
            vectors = decrypto_ai._load_embeddings_text(path, 2, True)
        self.assertIsInstance(vectors["山"], array)
        self.assertEqual(list(vectors["山"]), values)
        old_size = sys.getsizeof(values) + sum(sys.getsizeof(value) for value in values)
        self.assertLess(sys.getsizeof(vectors["山"]), old_size / 3)
        model = decrypto_ai.WordVectorModel(vectors)
        reference = decrypto_ai.WordVectorModel({word: list(vec) for word, vec in vectors.items()})
        self.assertEqual(model.top_similar("山", 2), reference.top_similar("山", 2))

    def test_json_embeddings_are_compact_and_respect_word_limit(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.jsonl"
            path.write_text("\n".join(json.dumps({"word": word, "vector": [0.1, 0.2]})
                                      for word in ["山", "河"]), encoding="utf-8")
            vectors = decrypto_ai._load_embeddings_json(path, 1, True)
        self.assertEqual(list(vectors), ["山"])
        self.assertIsInstance(vectors["山"], array)

    def test_missing_or_invalid_limits_keep_safe_defaults(self):
        with TemporaryDirectory() as directory, \
             patch.object(decrypto_ai, "_assets_dir", return_value=Path(directory)), \
             patch.dict(os.environ, {}, clear=True):
            for limits in ({}, {"max_words": 0, "max_vector_mb": "invalid"}):
                with self.subTest(limits=limits):
                    path = Path(directory) / "decrypto_embeddings_config.json"
                    path.write_text(json.dumps(limits), encoding="utf-8")
                    config = decrypto_ai._load_embedding_config()
                    self.assertEqual(config["max_words"], 20000)
                    self.assertEqual(config["max_vector_mb"], 64)
            with patch.dict(os.environ, {"DECRYPTO_EMBEDDINGS_MAX_WORDS": "-1",
                                         "DECRYPTO_EMBEDDINGS_MAX_VECTOR_MB": "0"}):
                config = decrypto_ai._load_embedding_config()
                self.assertEqual(config["max_words"], 20000)
                self.assertEqual(config["max_vector_mb"], 64)

    def test_environment_limits_reach_the_loader(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.vec"
            path.touch()
            settings = {
                "DECRYPTO_EMBEDDINGS": str(path),
                "DECRYPTO_EMBEDDINGS_MAX_WORDS": "123",
                "DECRYPTO_EMBEDDINGS_MAX_VECTOR_MB": "2",
                "DECRYPTO_EMBEDDINGS_CJK_ONLY": "false",
            }
            with patch.dict(os.environ, settings, clear=True), \
                 patch.object(decrypto_ai, "_load_embeddings_text", return_value={"山": [1, 0]}) as loader:
                decrypto_ai._load_embeddings()
            loader.assert_called_once_with(path, 123, False, 2 * 1024 * 1024)

    def test_streaming_loaders_stop_at_vector_budget(self):
        # A legacy 240k-word config must still obey the independent byte limit.
        for suffix, content, loader in [
            (".vec", "4 2\n山 1 0\n山 1 0\n河 0 1\n海 1 1\n", decrypto_ai._load_embeddings_text),
            (".jsonl", "\n".join(json.dumps({"word": word, "vector": [1, 0]})
                                 for word in ["山", "山", "河", "海"]), decrypto_ai._load_embeddings_json),
        ]:
            with self.subTest(suffix=suffix), TemporaryDirectory() as directory:
                path = Path(directory) / ("vectors" + suffix)
                path.write_text(content, encoding="utf-8")
                vectors = loader(path, 240000, True, max_vector_bytes=32)
                self.assertEqual(list(vectors), ["山", "河"])
                self.assertEqual(sum(len(vec) * vec.itemsize for vec in vectors.values()), 32)

    def test_unspecified_word_limit_does_not_load_the_entire_file(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.vec"
            path.write_text("".join(f"词{index} 1 0\n" for index in range(20001)), encoding="utf-8")
            vectors = decrypto_ai._load_embeddings_text(path, None, True)
            self.assertEqual(len(vectors), 20000)

    def test_large_json_is_rejected_before_materializing_python_floats(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "vectors.json"
            path.write_text(json.dumps({"山": [0.1] * 100}), encoding="utf-8")
            with patch.object(decrypto_ai.json, "load") as loader:
                vectors = decrypto_ai._load_embeddings_json(path, 1, True, max_vector_bytes=1024)
            loader.assert_not_called()
            self.assertEqual(vectors, {})

    def test_small_json_formats_keep_their_word_limit(self):
        for content in [
            {"山": [1, 0], "河": [0, 1]},
            {"vectors": {"山": [1, 0], "河": [0, 1]}},
            [{"word": "山", "vector": [1, 0]}, {"word": "河", "vector": [0, 1]}],
            [["山", [1, 0]], ["河", [0, 1]]],
        ]:
            with self.subTest(content=content), TemporaryDirectory() as directory:
                path = Path(directory) / "vectors.json"
                path.write_text(json.dumps(content), encoding="utf-8")
                vectors = decrypto_ai._load_embeddings_json(path, 1, True)
                self.assertEqual(list(vectors), ["山"])

    def test_top_similar_preserves_ranking_and_expanding_requests(self):
        model = decrypto_ai.WordVectorModel({
            "b": [1, 0], "a": [1, 0], "c": [0.8, 0.6],
            "d": [0, 1], "e": [-1, 0], "zero": [0, 0],
        })
        expected = [(1.0, "a"), (1.0, "b"), (0.8, "c"), (0.0, "d"), (-1.0, "e")]
        self.assertEqual(model.top_similar("a", 0), [])
        self.assertEqual(model.top_similar("a", 1), expected[:1])
        self.assertEqual(model.top_similar("a", 5), expected)
        self.assertEqual(model.top_similar("a", 20), expected)
        self.assertEqual(model.top_similar("zero", 5), [])

    def test_top_similar_does_not_allocate_scores_for_the_entire_vocabulary(self):
        model = decrypto_ai.WordVectorModel({f"word{index}": [1, 0] for index in range(20000)})
        tracemalloc.start()
        try:
            results = model.top_similar("word0", 50)
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        self.assertEqual(len(results), 50)
        self.assertLess(peak, 256 * 1024)

    def test_search_cache_is_bounded_and_callers_cannot_modify_it(self):
        model = decrypto_ai.WordVectorModel({"a": [1, 0], "b": [0, 1], "c": [1, 1]})
        expected = model.top_similar("a", 2)
        with patch.object(decrypto_ai, "_MAX_TOP_CACHE_ENTRIES", 2):
            model.top_similar("b", 2)
            model.top_similar("c", 2)
            self.assertEqual(len(model._top_cache), 2)
            self.assertEqual(model.top_similar("a", 2), expected)
            model.top_similar("a", 2).clear()
            self.assertEqual(model.top_similar("a", 2), expected)

    def test_concurrent_rooms_share_the_same_search(self):
        model = decrypto_ai.WordVectorModel({"山": [1, 0], "河": [0, 1]})
        started = threading.Event()
        release = threading.Event()
        original = model._iter_similarities

        def scan(vector, norm):
            started.set()
            self.assertTrue(release.wait(2))
            yield from original(vector, norm)

        with patch.object(model, "_iter_similarities", side_effect=scan) as scanner, \
             ThreadPoolExecutor(max_workers=4) as pool:
            first = pool.submit(model.top_similar, "山", 2)
            self.assertTrue(started.wait(2))
            others = [pool.submit(model.top_similar, "山", 2) for _ in range(3)]
            release.set()
            expected = first.result(timeout=2)
            self.assertTrue(all(task.result(timeout=2) == expected for task in others))
            self.assertEqual(scanner.call_count, 1)

    def test_concurrent_bot_rooms_initialize_only_one_model(self):
        started = threading.Event()
        release = threading.Event()

        def load():
            started.set()
            self.assertTrue(release.wait(2))
            return {"山": array("d", [0.1, 0.2])}

        with patch.object(decrypto_ai, "_WORD_MODEL", None), \
             patch.object(decrypto_ai, "_MODEL_MODE", None), \
             patch.object(decrypto_ai, "_load_embeddings", side_effect=load) as loader, \
             patch.object(decrypto_ai, "_load_vocabulary", return_value=[]), \
             ThreadPoolExecutor(max_workers=4) as pool:
            first = pool.submit(decrypto_ai._get_model)
            self.assertTrue(started.wait(2))
            others = [pool.submit(decrypto_ai._get_model) for _ in range(3)]
            release.set()
            model = first.result(timeout=2)
            self.assertTrue(all(task.result(timeout=2) is model for task in others))
            self.assertEqual(loader.call_count, 1)

    def test_round_resolution_does_not_initialize_a_model(self):
        players = [{"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": i != 0}
                   for i in range(4)]
        state = decrypto.DecryptoGame.init_game({}, players)
        for team in decrypto.TEAM_IDS:
            data = state["round_data"][team]
            data.update(clues=["a", "b", "c"], decrypt_guess=[1, 2, 3], decrypt_by="p1")
        with patch.object(decrypto_ai, "_WORD_MODEL", None), \
             patch.object(decrypto_ai, "_get_model", side_effect=AssertionError("model on event loop")):
            decrypto._apply_round_results(state)
        self.assertEqual(state["last_round_summary"]["round"], 1)


if __name__ == "__main__":
    unittest.main()
