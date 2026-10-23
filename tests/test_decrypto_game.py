import unittest

from jsonschema import ValidationError, validate

from game import decrypto, get_game


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
    def test_next_round_action_schema(self):
        schema = get_game("decrypto").action_schema
        validate({"type": "next_round"}, schema)
        with self.assertRaises(ValidationError):
            validate({"type": "next_round", "player_id": "p2"}, schema)

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
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["teams"]["white"]["miscommunications"], 0)
        self.assertEqual(state["teams"]["black"]["miscommunications"], 1)
        self.assertEqual(state["teams"]["white"]["intercepts"], 0)
        self.assertEqual(state["teams"]["black"]["intercepts"], 0)
        summary = state["last_round_summary"]["teams"]
        self.assertIsNone(summary["white"]["intercept_correct"])
        self.assertIsNone(summary["black"]["intercept_correct"])
        self.assertEqual(state["teams"]["white"]["history"][0]["clues_by"], white_encryptor)
        self.assertEqual(state["teams"]["black"]["history"][0]["clues_by"], black_encryptor)

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
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "round_end")

        view = decrypto.DecryptoGame.get_public_view(state, white_decrypter)
        summary = view["last_round_summary"]["teams"]
        self.assertTrue(summary["white"]["decrypt_correct"])
        self.assertFalse(summary["white"]["intercept_correct"])
        self.assertEqual(summary["white"]["intercept_by"], black_decrypter)
        self.assertFalse(summary["black"]["decrypt_correct"])
        self.assertTrue(summary["black"]["intercept_correct"])
        self.assertEqual(summary["black"]["intercept_by"], white_decrypter)
        self.assertIsNone(view["teams"]["black"]["keywords"])

    def make_round_end_state(self):
        state = decrypto.DecryptoGame.init_game(None, _make_players())
        for team_id in decrypto.TEAM_IDS:
            data = state["round_data"][team_id]
            data.update({
                "code": [1, 2, 3],
                "clues": ["first", "second", "third"],
                "clues_by": decrypto._current_encryptor(state, team_id),
                "decrypt_guess": [1, 2, 3],
                "decrypt_by": _non_encryptor(state, team_id),
            })
        decrypto._resolve_round(state)
        return state

    def test_next_round_waits_for_every_player_and_rotates_once(self):
        state = self.make_round_end_state()
        old_codes = {team_id: list(state["round_data"][team_id]["code"]) for team_id in decrypto.TEAM_IDS}
        for player in _make_players()[:-1]:
            player_id = player["player_id"]
            self.assertEqual(decrypto.DecryptoGame.get_legal_actions(state, player_id), ["next_round"])
            events, error = decrypto.DecryptoGame.apply_action(state, player_id, {"type": "next_round"})
            self.assertIsNone(error)
            self.assertEqual(events[0]["type"], "decrypto:next_ready")
            self.assertEqual(state["round"], 1)
            self.assertEqual(state["phase"], "round_end")
            self.assertEqual(decrypto.DecryptoGame.get_legal_actions(state, player_id), [])
            self.assertEqual(state["teams"]["white"]["encryptor_index"], 0)
            self.assertEqual(state["round_data"]["white"]["code"], old_codes["white"])
        events, error = decrypto.DecryptoGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertEqual(events, [])
        self.assertIsNone(error)
        self.assertEqual(state["next_round_ready"], ["p1", "p2", "p3"])
        view = decrypto.DecryptoGame.get_public_view(state, "p4")
        self.assertEqual(view["next_round_ready"], ["p1", "p2", "p3"])
        self.assertEqual(view["last_round_summary"]["round"], 1)
        events, error = decrypto.DecryptoGame.apply_action(state, "p4", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(events[-1]["type"], "decrypto:next_round")
        self.assertEqual(state["phase"], "encryption")
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["next_round_ready"], [])
        self.assertEqual(decrypto._current_encryptor(state, "white"), "p2")
        self.assertEqual(decrypto._current_encryptor(state, "black"), "p4")
        self.assertEqual(state["teams"]["white"]["history"][0]["clues_by"], "p1")
        self.assertEqual(len(state["round_history"]), 1)

    def test_round_confirmation_rejects_spectators_and_wrong_actions(self):
        state = self.make_round_end_state()
        self.assertEqual(decrypto.DecryptoGame.get_legal_actions(state, "spectator"), [])
        for player_id, action in [("spectator", "next_round"), ("p1", "submit_clues"), ("p2", "submit_decrypt")]:
            with self.subTest(player_id=player_id, action=action):
                _, error = decrypto.DecryptoGame.apply_action(state, player_id, {"type": action})
                self.assertIsNotNone(error)
                self.assertEqual(state["next_round_ready"], [])
        decrypto._start_round(state, increment_round=True)
        _, error = decrypto.DecryptoGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertIsNotNone(error)

    def test_bots_confirm_without_skipping_human_review(self):
        state = self.make_round_end_state()
        for player_id in ["p2", "p3", "p4"]:
            state["player_meta"][player_id]["is_bot"] = True
            action = decrypto.DecryptoGame.bot_move(state, player_id)
            self.assertEqual(action, {"type": "next_round"})
            _, error = decrypto.DecryptoGame.apply_action(state, player_id, action)
            self.assertIsNone(error)
            self.assertIsNone(decrypto.DecryptoGame.bot_move(state, player_id))
        self.assertEqual(state["phase"], "round_end")
        _, error = decrypto.DecryptoGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["round"], 2)

    def test_round_confirmation_survives_save_and_reload(self):
        state = self.make_round_end_state()
        decrypto.DecryptoGame.apply_action(state, "p1", {"type": "next_round"})
        restored = decrypto.DecryptoGame.deserialize(decrypto.DecryptoGame.serialize(state))
        self.assertEqual(restored["next_round_ready"], ["p1"])
        self.assertEqual(restored["phase"], "round_end")
        self.assertEqual(restored["teams"]["white"]["history"][0]["clues_by"], "p1")
        for player_id in ["p2", "p3", "p4"]:
            _, error = decrypto.DecryptoGame.apply_action(restored, player_id, {"type": "next_round"})
            self.assertIsNone(error)
        self.assertEqual(restored["round"], 2)

    def test_game_over_does_not_offer_next_round(self):
        state = self.make_round_end_state()
        state["config"]["max_rounds"] = 2
        decrypto._start_round(state, increment_round=True)
        decrypto._resolve_round(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(decrypto.DecryptoGame.get_legal_actions(state, "p1"), [])
        self.assertIsNone(decrypto.DecryptoGame.bot_move(state, "p2"))
        _, error = decrypto.DecryptoGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertEqual(error, "game over")

    def test_legacy_history_recovers_authors_without_revealing_keywords(self):
        state = self.make_round_end_state()
        for team in state["teams"].values():
            team["history"][0].pop("clues_by")
        state["round_history"][0]["teams"]["white"]["clues_by"] = "p2"
        view = decrypto.DecryptoGame.get_public_view(state, "spectator")
        self.assertEqual(view["teams"]["white"]["history"][0]["clues_by"], "p2")
        self.assertEqual(view["teams"]["black"]["history"][0]["clues_by"], "p3")
        self.assertEqual(view["teams"]["white"]["history_by_keyword"], {"1": ["first"], "2": ["second"], "3": ["third"], "4": []})
        for team in view["teams"].values():
            self.assertIsNone(team["keywords"])
        self.assertNotIn("clues_by", state["teams"]["white"]["history"][0])
        state.pop("round_history")
        view = decrypto.DecryptoGame.get_public_view(state, "p1")
        self.assertEqual(view["teams"]["white"]["history"][0]["clues_by"], "p1")

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

    def test_round_and_final_reviews_never_reveal_opponent_keywords(self):
        state = self.make_round_end_state()
        state["teams"]["white"]["keywords"] = ["white_secret_1", "white_secret_2", "white_secret_3", "white_secret_4"]
        state["teams"]["black"]["keywords"] = ["black_secret_1", "black_secret_2", "black_secret_3", "black_secret_4"]
        for game_over in [False, True]:
            state["game_over"] = game_over
            state["phase"] = "game_over" if game_over else "round_end"
            for viewer_id, own_team in [("p1", "white"), ("p3", "black"), ("observer", None)]:
                with self.subTest(game_over=game_over, viewer_id=viewer_id):
                    view = decrypto.DecryptoGame.get_public_view(state, viewer_id)
                    for team_id, team in state["teams"].items():
                        if team_id == own_team:
                            self.assertEqual(view["teams"][team_id]["keywords"], team["keywords"])
                        else:
                            self.assertIsNone(view["teams"][team_id]["keywords"])
                            for keyword in team["keywords"]:
                                self.assertNotIn(keyword, str(view))
                    self.assertEqual(view["last_round_summary"]["teams"]["black"]["clues"], ["first", "second", "third"])
                    self.assertEqual(view["last_round_summary"]["teams"]["black"]["code"], [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
