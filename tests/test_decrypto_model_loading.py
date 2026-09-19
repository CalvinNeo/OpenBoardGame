import json
import sys
import threading
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
