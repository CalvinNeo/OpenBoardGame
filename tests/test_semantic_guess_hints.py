import json
import sqlite3
import unittest
from unittest.mock import patch

from jsonschema import Draft7Validator

from game import semantic_guess


def _players(count=2):
    return [{"player_id": f"p{i}", "name": f"P{i}", "seat": i}
            for i in range(count)]


class _Random:
    def choice(self, values):
        return values[0]

    def sample(self, values, count):
        return list(values)[:count]


class _Store:
    mode = "indexed"

    def __init__(self, scores):
        self.scores = scores
        self.calls = []

    def similarity(self, left, right):
        self.calls.append((left, right))
        score = self.scores.get(left)
        if isinstance(score, Exception):
            raise score
        return score


class SemanticGuessHintsTests(unittest.TestCase):
    def setUp(self):
        self.store = _Store({})
        self.pool = ["secret"]
        self.patches = [
            patch.object(semantic_guess, "get_store", return_value=self.store),
            patch.object(semantic_guess, "_word_pool", side_effect=lambda: list(self.pool)),
            patch.object(semantic_guess.random, "SystemRandom", return_value=_Random()),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_disabled_hints_do_not_calculate_any_similarities(self):
        self.pool = ["secret", "first", "second"]
        self.store.scores = {"first": 0.49, "second": 0.52}
        for config in (None, {}, {"starting_hints": False}):
            with self.subTest(config=config):
                state = semantic_guess.init_game(config, _players())
                self.assertFalse(state["config"]["starting_hints"])
                self.assertEqual(state["starting_hints"], [])
                self.assertEqual(semantic_guess.get_public_view(state, "p0")["starting_hints"], [])
        self.assertEqual(self.store.calls, [])

    def test_hints_choose_two_highest_actual_positive_scores(self):
        self.pool = ["secret", "negative", "high", "above", "below", "distant"]
        self.store.scores = {
            "negative": -0.499,
            "high": 0.95,
            "above": 0.5137,
            "below": 0.4761,
            "distant": 0.3,
        }
        state = semantic_guess.init_game({"starting_hints": True}, _players())
        self.assertEqual(state["starting_hints"], [
            {"word": "high", "similarity": 0.95},
            {"word": "above", "similarity": 0.5137},
        ])
        self.assertTrue(state["config"]["starting_hints"])
        self.assertEqual(state["secret_word"], "secret")
        self.assertEqual(state["guesses"], [])
        self.assertEqual(state["guessed_word_keys"], [])
        self.assertEqual(state["turn_number"], 1)
        self.assertEqual(state["current_turn_player_id"], "p0")
        self.assertFalse(state["game_over"])

    def test_full_pool_scan_excludes_secret_and_normalized_duplicates(self):
        candidates = [f"candidate-{i:04d}" for i in range(600)]
        self.pool = ["secret", " ＳＥＣＲＥＴ "]
        for word in candidates:
            self.pool.extend((word, word.upper()))
        self.store.scores = {word: 0.1 for word in candidates}
        self.store.scores[candidates[298]] = 0.48
        self.store.scores[candidates[299]] = 0.51
        self.store.scores[candidates[300]] = 0.5
        state = semantic_guess.init_game({"starting_hints": True}, _players())
        self.assertEqual(len(self.store.calls), 600)
        compared = [semantic_guess._normalize_word(word) for word, _ in self.store.calls]
        self.assertEqual(len(set(compared)), 600)
        self.assertNotIn("secret", compared)
        self.assertTrue(all(secret == "secret" for _, secret in self.store.calls))
        self.assertEqual(state["starting_hints"], [
            {"word": candidates[299], "similarity": 0.51},
            {"word": candidates[300], "similarity": 0.5},
        ])

    def test_large_custom_pool_keeps_a_bounded_scan(self):
        candidates = [f"candidate-{i:04d}" for i in range(1300)]
        self.pool = ["secret", *candidates]
        self.store.scores = {word: 0.1 for word in candidates}
        self.store.scores[candidates[998]] = 0.7
        self.store.scores[candidates[999]] = 0.65
        self.store.scores[candidates[1000]] = 0.9
        state = semantic_guess.init_game({"starting_hints": True}, _players())
        self.assertEqual(len(self.store.calls), 1000)
        self.assertEqual(state["starting_hints"], [
            {"word": candidates[998], "similarity": 0.7},
            {"word": candidates[999], "similarity": 0.65},
        ])
        self.assertNotIn(candidates[1000], [word for word, _ in self.store.calls])

    def test_all_negative_scores_fall_back_to_least_negative(self):
        self.pool = ["secret", "far", "near", "less-near"]
        self.store.scores = {"far": -0.9, "near": -0.1, "less-near": -0.3}
        state = semantic_guess.init_game({"starting_hints": True}, _players(1))
        self.assertEqual(state["starting_hints"], [
            {"word": "near", "similarity": -0.1},
            {"word": "less-near", "similarity": -0.3},
        ])

    def test_a_single_positive_clue_is_not_padded_with_negative_score(self):
        self.pool = ["secret", "positive", "negative"]
        self.store.scores = {"positive": 0.08, "negative": -0.01}
        state = semantic_guess.init_game({"starting_hints": True}, _players(1))
        self.assertEqual(state["starting_hints"], [{"word": "positive", "similarity": 0.08}])

    def test_tiny_pool_and_missing_vectors_return_only_available_hints(self):
        state = semantic_guess.init_game({"starting_hints": True}, _players(1))
        self.assertEqual(state["starting_hints"], [])
        self.assertEqual(self.store.calls, [])
        self.pool = ["secret", "only", "missing", "removed", "malformed"]
        self.store.scores = {
            "only": 0.33,
            "missing": None,
            "removed": LookupError("missing vector"),
            "malformed": ValueError("invalid vector"),
        }
        state = semantic_guess.init_game({"starting_hints": True}, _players(1))
        self.assertEqual(state["starting_hints"], [{"word": "only", "similarity": 0.33}])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["turn_number"], 1)

    def test_nonfinite_scores_are_not_exposed_as_hints(self):
        self.pool = ["secret", "nan", "positive-inf", "negative-inf", "valid"]
        self.store.scores = {
            "nan": float("nan"),
            "positive-inf": float("inf"),
            "negative-inf": -float("inf"),
            "valid": 0.42,
        }
        state = semantic_guess.init_game({"starting_hints": True}, _players())
        self.assertEqual(state["starting_hints"], [{"word": "valid", "similarity": 0.42}])
        json.dumps(state, allow_nan=False)

    def test_database_failure_is_reported_instead_of_silently_skipping_hints(self):
        self.pool = ["secret", "first"]
        self.store.scores = {"first": sqlite3.OperationalError("disk I/O error")}
        with self.assertRaisesRegex(ValueError, "语义词库暂不可用"):
            semantic_guess.init_game({"starting_hints": True}, _players())

    def test_riichi_and_restored_views_share_hints_without_recomputing_or_revealing_answer(self):
        self.pool = ["secret", "first", "second"]
        self.store.scores = {"first": 0.49, "second": 0.52}
        state = semantic_guess.init_game({"starting_hints": True}, _players())
        initial_hints = [dict(row) for row in state["starting_hints"]]
        calls_after_start = list(self.store.calls)
        action = {"type": "declare_riichi", "game_token": state["game_token"],
                  "turn_number": state["turn_number"]}
        self.assertIsNone(semantic_guess.apply_action(state, "p0", action)[1])
        restored = semantic_guess.deserialize(json.loads(json.dumps(semantic_guess.serialize(state))))
        for saved_state in (state, restored):
            for viewer in ("p0", "p1", "spectator"):
                with self.subTest(viewer=viewer, restored=saved_state is restored):
                    view = semantic_guess.get_public_view(saved_state, viewer)
                    self.assertEqual(view["starting_hints"], initial_hints)
                    self.assertNotIn("secret_word", view)
                    self.assertEqual(view["config"], {"starting_hints": True})
                    self.assertEqual(view["guesses"], [])
                    self.assertEqual(view["turn_number"], 1)
                    view["starting_hints"][0]["word"] = "client mutation"
                    self.assertEqual(saved_state["starting_hints"], initial_hints)
        self.assertEqual(self.store.calls, calls_after_start)
        self.assertTrue(restored["players"]["p0"]["riichi"])

    def test_public_config_only_exposes_hint_option(self):
        state = semantic_guess.init_game({"starting_hints": True, "seed": "private"}, _players())
        self.assertEqual(semantic_guess.get_public_view(state, "p0")["config"], {"starting_hints": True})

    def test_old_saved_games_without_hints_remain_readable(self):
        state = semantic_guess.init_game({}, _players())
        state.pop("starting_hints", None)
        state["config"].pop("starting_hints", None)
        restored = semantic_guess.deserialize(json.loads(json.dumps(state)))
        self.assertEqual(semantic_guess.get_public_view(restored, "p0")["starting_hints"], [])
        self.assertEqual(self.store.calls, [])

    def test_starting_hints_config_requires_a_boolean(self):
        validator = Draft7Validator(semantic_guess.CONFIG_SCHEMA)
        for value in (True, False):
            self.assertTrue(validator.is_valid({"starting_hints": value}))
        for value in ("false", "true", 0, 1, None, [], {}):
            with self.subTest(value=value):
                self.assertFalse(validator.is_valid({"starting_hints": value}))
                with self.assertRaises(ValueError):
                    semantic_guess.init_game({"starting_hints": value}, _players())


if __name__ == "__main__":
    unittest.main()
