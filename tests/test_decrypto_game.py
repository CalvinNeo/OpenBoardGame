import unittest

from game import decrypto


def _make_players():
    return [
        {"player_id": "p1", "seat": 1, "name": "Alice"},
        {"player_id": "p2", "seat": 2, "name": "Bob"},
        {"player_id": "p3", "seat": 3, "name": "Cara"},
        {"player_id": "p4", "seat": 4, "name": "Dan"},
    ]


def _non_encryptor(state, team_id):
    encryptor = decrypto._current_encryptor(state, team_id)
    for pid in state["teams"][team_id]["player_ids"]:
        if pid != encryptor:
            return pid
    raise AssertionError("No non-encryptor found")


class DecryptoGameTests(unittest.TestCase):
    def test_normalize_guess_and_validate_clues(self):
        self.assertIsNone(decrypto._normalize_guess([1, 1, 2]))
        self.assertIsNone(decrypto._normalize_guess([1, 2]))
        self.assertIsNone(decrypto._normalize_guess([1, 2, 5]))
        self.assertIsNone(decrypto._normalize_guess([True, 2, 3]))
        self.assertEqual(decrypto._normalize_guess([1, 2, 3]), [1, 2, 3])

        self.assertIsNone(decrypto._validate_clues(["", "b", "c"]))
        self.assertIsNone(decrypto._validate_clues(["a", "b"]))
        self.assertEqual(
            decrypto._validate_clues([" alpha ", "beta", " gamma "]),
            ["alpha", "beta", "gamma"],
        )

    def test_init_game_requires_even_players(self):
        with self.assertRaises(ValueError):
            decrypto.DecryptoGame.init_game(None, _make_players()[:-1])

    def test_round_one_resolves_without_intercept(self):
        state = decrypto.DecryptoGame.init_game(None, _make_players())
        state["round_data"]["white"]["code"] = [1, 2, 3]
        state["round_data"]["black"]["code"] = [1, 3, 4]

        white_encryptor = decrypto._current_encryptor(state, "white")
        black_encryptor = decrypto._current_encryptor(state, "black")

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            white_encryptor,
            {"type": "submit_clues", "clues": ["alpha", "beta", "gamma"]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "encryption")
        self.assertTrue(any(event["type"] == "decrypto:clues_submitted" for event in events))

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            black_encryptor,
            {"type": "submit_clues", "clues": ["one", "two", "three"]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "guessing")

        white_decrypter = _non_encryptor(state, "white")
        black_decrypter = _non_encryptor(state, "black")

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            white_decrypter,
            {"type": "submit_decrypt", "guess": [1, 2, 3]},
        )
        self.assertIsNone(error)
        self.assertFalse(any(event["type"] == "decrypto:round_resolved" for event in events))
        self.assertEqual(state["round"], 1)

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            black_decrypter,
            {"type": "submit_decrypt", "guess": [1, 2, 4]},
        )
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "decrypto:round_resolved" for event in events))
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "encryption")
        self.assertEqual(state["teams"]["white"]["miscommunications"], 0)
        self.assertEqual(state["teams"]["black"]["miscommunications"], 1)
        self.assertEqual(state["teams"]["white"]["intercepts"], 0)
        self.assertEqual(state["teams"]["black"]["intercepts"], 0)
        summary = state["last_round_summary"]["teams"]
        self.assertIsNone(summary["white"]["intercept_correct"])
        self.assertIsNone(summary["black"]["intercept_correct"])

    def test_round_two_requires_intercepts(self):
        state = decrypto.DecryptoGame.init_game(None, _make_players())
        state["round"] = 2
        state["phase"] = "guessing"
        state["round_data"] = {
            "white": {
                "code": [1, 2, 3],
                "clues": ["alpha", "beta", "gamma"],
                "clues_by": "p1",
                "decrypt_guess": None,
                "decrypt_by": None,
                "intercept_guess": None,
                "intercept_by": None,
            },
            "black": {
                "code": [4, 3, 2],
                "clues": ["red", "blue", "green"],
                "clues_by": "p3",
                "decrypt_guess": None,
                "decrypt_by": None,
                "intercept_guess": None,
                "intercept_by": None,
            },
        }

        white_decrypter = _non_encryptor(state, "white")
        black_decrypter = _non_encryptor(state, "black")

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            white_decrypter,
            {"type": "submit_decrypt", "guess": [1, 2, 3]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "guessing")

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            black_decrypter,
            {"type": "submit_decrypt", "guess": [4, 3, 2]},
        )
        self.assertIsNone(error)
        self.assertFalse(any(event["type"] == "decrypto:round_resolved" for event in events))
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "guessing")

    def test_round_two_intercept_scoring(self):
        state = decrypto.DecryptoGame.init_game(None, _make_players())
        state["round"] = 2
        state["phase"] = "guessing"
        state["round_data"] = {
            "white": {
                "code": [1, 2, 3],
                "clues": ["alpha", "beta", "gamma"],
                "clues_by": "p1",
                "decrypt_guess": None,
                "decrypt_by": None,
                "intercept_guess": None,
                "intercept_by": None,
            },
            "black": {
                "code": [4, 3, 2],
                "clues": ["red", "blue", "green"],
                "clues_by": "p3",
                "decrypt_guess": None,
                "decrypt_by": None,
                "intercept_guess": None,
                "intercept_by": None,
            },
        }

        white_decrypter = _non_encryptor(state, "white")
        black_decrypter = _non_encryptor(state, "black")

        decrypto.DecryptoGame.apply_action(
            state,
            white_decrypter,
            {"type": "submit_decrypt", "guess": [1, 2, 3]},
        )
        decrypto.DecryptoGame.apply_action(
            state,
            black_decrypter,
            {"type": "submit_decrypt", "guess": [4, 1, 2]},
        )

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            white_decrypter,
            {"type": "submit_intercept", "guess": [4, 3, 2]},
        )
        self.assertIsNone(error)
        self.assertFalse(any(event["type"] == "decrypto:round_resolved" for event in events))

        events, error = decrypto.DecryptoGame.apply_action(
            state,
            black_decrypter,
            {"type": "submit_intercept", "guess": [1, 3, 2]},
        )
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "decrypto:round_resolved" for event in events))
        self.assertEqual(state["teams"]["white"]["intercepts"], 1)
        self.assertEqual(state["teams"]["black"]["intercepts"], 0)
        self.assertEqual(state["teams"]["white"]["miscommunications"], 0)
        self.assertEqual(state["teams"]["black"]["miscommunications"], 1)
        self.assertEqual(state["round"], 3)
        self.assertEqual(state["phase"], "encryption")

    def test_public_view_scopes_keywords_and_code(self):
        state = decrypto.DecryptoGame.init_game(None, _make_players())
        white_encryptor = decrypto._current_encryptor(state, "white")
        white_other = _non_encryptor(state, "white")
        black_other = _non_encryptor(state, "black")

        encryptor_view = decrypto.DecryptoGame.get_public_view(state, white_encryptor)
        self.assertIsNotNone(encryptor_view["current_code"])

        white_view = decrypto.DecryptoGame.get_public_view(state, white_other)
        self.assertIsNone(white_view["current_code"])
        self.assertIsNotNone(white_view["teams"]["white"]["keywords"])
        self.assertIsNone(white_view["teams"]["black"]["keywords"])

        black_view = decrypto.DecryptoGame.get_public_view(state, black_other)
        self.assertIsNone(black_view["teams"]["white"]["keywords"])
        self.assertIsNotNone(black_view["teams"]["black"]["keywords"])


if __name__ == "__main__":
    unittest.main()
