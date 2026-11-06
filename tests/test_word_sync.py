import copy
import json
import unittest
from unittest.mock import patch

from game.word_sync import WordSyncGame as Game, normalize_word


def players(count=4):
    return [{"player_id": f"p{index}", "name": f"Player {index + 1}", "seat": index}
            for index in range(count)]


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], **fields}


class WordSyncTests(unittest.TestCase):
    def setUp(self):
        self.state = Game.init_game({}, players())

    def play(self, player_id, kind="submit_word", **fields):
        events, error = Game.apply_action(self.state, player_id, action(self.state, kind, **fields))
        self.assertIsNone(error)
        return events

    def guess(self, words):
        active = [player_id for player_id in self.state["turn_order"]
                  if "submit_word" in Game.get_legal_actions(self.state, player_id)]
        self.assertEqual(len(active), len(words))
        for player_id, word in zip(active, words):
            self.play(player_id, word=word)

    def next_round(self):
        for player_id in self.state["turn_order"]:
            self.play(player_id, "next_round")

    def assert_rejected(self, player_id, payload):
        before = copy.deepcopy(self.state)
        events, error = Game.apply_action(self.state, player_id, payload)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(before, self.state)

    def test_player_counts_and_seat_pairing(self):
        for count in (2, 4, 6, 8):
            with self.subTest(count=count):
                state = Game.init_game({}, list(reversed(players(count))))
                self.assertEqual(state["turn_order"], [f"p{index}" for index in range(count)])
                self.assertEqual([team["player_ids"] for team in state["teams"]],
                                 [[f"p{index}", f"p{index + 1}"] for index in range(0, count, 2)])
        for count in (0, 1, 3, 5, 7, 9, 10):
            with self.subTest(count=count), self.assertRaises(ValueError):
                Game.init_game({}, players(count))

    def test_invalid_rosters_and_configs(self):
        invalid = [None, {}, [None, None],
                   [{"player_id": "same"}, {"player_id": "same"}],
                   [{"player_id": "p0", "seat": 0}, {"player_id": "p1", "seat": 0}],
                   [{"player_id": "p0", "seat": True}, {"player_id": "p1"}],
                   [{"player_id": "p0", "seat": -1}, {"player_id": "p1"}],
                   [{"player_id": 123}, {"player_id": "p1"}],
                   [{"player_id": ""}, {"player_id": "p1"}]]
        for roster in invalid:
            with self.subTest(roster=roster), self.assertRaises(ValueError):
                Game.init_game({}, roster)
        for config in (None, [], {"seed": 1}, {"rounds": 3}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                Game.init_game(config, players())

    def test_word_normalization(self):
        for raw, cleaned in (("  ＡＰＰＬＥ  ", "APPLE"), ("月亮　", "月亮"),
                             ("ice   cream", "ice cream"), ("e\u0301", "é"), ("123", "123")):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_word(raw), cleaned)
        self.assertEqual(normalize_word("词" * 24), "词" * 24)
        self.assertEqual(normalize_word("𠮷" * 24), "𠮷" * 24)
        for raw in (None, 1, [], "", "  ", "!?", "🌙", "词" * 25, "  " * 49,
                    "ice\ncream", "a\tb", "a\x00b", "word\u200b", "word\u202e", "\ud800"):
            with self.subTest(raw=repr(raw)), self.assertRaises(ValueError):
                normalize_word(raw)

    def test_private_submissions_do_not_leak_to_teammates_or_events(self):
        events = self.play("p0", word="hidden-guess-001")
        self.assertNotIn("hidden-guess-001", json.dumps(events))
        for viewer in ("p1", "p2", "p3", "spectator"):
            with self.subTest(viewer=viewer):
                view = Game.get_public_view(self.state, viewer)
                self.assertNotIn("hidden-guess-001", json.dumps(view))
                self.assertIsNone(view["your_word"])
                self.assertTrue(view["players"][0]["submitted"])
                self.assertNotIn("pending", view)
        own = Game.get_public_view(self.state, "p0")
        self.assertEqual(own["your_word"], "hidden-guess-001")
        self.assertEqual(own["legal_actions"], [])
        self.assertEqual(Game.get_public_view(self.state, "spectator")["legal_actions"], [])
        self.assertIsNone(Game.get_public_view(self.state, "spectator")["your_team_id"])

    def test_locked_pair_stays_hidden_until_every_team_submits(self):
        self.play("p0", word="月亮")
        self.play("p1", word="月亮")
        self.play("p2", word="山")
        self.assertEqual(self.state["phase"], "guess")
        self.assertEqual(self.state["teams"][0]["history"], [])
        self.assertIsNone(self.state["teams"][0]["matched_round"])
        self.assertNotIn("月亮", json.dumps(Game.get_public_view(self.state, "p3"), ensure_ascii=False))
        self.play("p3", word="海")
        self.assertEqual(self.state["phase"], "reveal")
        self.assertEqual(self.state["teams"][0]["matched_round"], 1)
        self.assertEqual(self.state["pending"], {})
        self.assertEqual(self.state["teams"][1]["history"][0]["words"], ["山", "海"])

    def test_unanimous_review_includes_completed_teams(self):
        self.guess(["月亮", "月亮", "山", "海"])
        for player_id in ("p2", "p3", "p0"):
            self.play(player_id, "next_round")
        self.assertEqual(self.state["phase"], "reveal")
        self.assertEqual(self.state["round"], 1)
        self.assert_rejected("p2", action(self.state, "next_round"))
        self.play("p1", "next_round")
        self.assertEqual((self.state["phase"], self.state["round"]), ("guess", 2))
        self.assertEqual(self.state["next_ready"], [])
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), [])
        self.assertEqual(Game.get_legal_actions(self.state, "p2"), ["submit_word"])
        self.assert_rejected("p0", action(self.state, "submit_word", word="finished"))
        self.guess(["海岸", "海岸"])
        self.assertTrue(self.state["game_over"])
        self.assertEqual([len(team["history"]) for team in self.state["teams"]], [1, 2])

    def test_ranking_and_equal_round_ties_ignore_submission_speed(self):
        self.state = Game.init_game({}, players(8))
        for player_id, word in (("p6", "a"), ("p7", "a"), ("p0", "b"), ("p1", "b"),
                                ("p2", "mountain"), ("p3", "water"), ("p4", "red"), ("p5", "blue")):
            self.play(player_id, word=word)
        self.next_round()
        self.guess(["river", "river", "green", "yellow"])
        self.next_round()
        self.guess(["forest", "forest"])
        self.assertEqual(self.state["winning_team_ids"], ["team-1", "team-4"])
        self.assertEqual(self.state["winner"], ["p0", "p1", "p6", "p7"])
        standings = Game.get_public_view(self.state, "p0")["standings"]
        self.assertEqual([(row["team_id"], row["rounds"], row["rank"]) for row in standings],
                         [("team-1", 1, 1), ("team-4", 1, 1), ("team-2", 2, 3), ("team-3", 3, 4)])

    def test_two_player_cooperation_and_casefold_matching(self):
        self.state = Game.init_game({}, players(2))
        self.guess(["  ＡＰＰＬＥ ", "apple"])
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["phase"], "game_over")
        self.assertEqual(self.state["winner"], ["p0", "p1"])
        self.assertEqual(self.state["teams"][0]["history"][0]["words"], ["APPLE", "apple"])
        self.assert_rejected("p0", action(self.state, "next_round"))
        self.state = Game.init_game({}, players(2))
        self.guess(["Straße", "STRASSE"])
        self.assertTrue(self.state["game_over"])

    def test_synonyms_punctuation_and_traditional_text_are_not_equal(self):
        self.state = Game.init_game({}, players(6))
        self.guess(["汽车", "轿车", "猫", "貓", "hello!", "hello"])
        self.assertFalse(self.state["game_over"])
        self.assertTrue(all(team["matched_round"] is None for team in self.state["teams"]))

    def test_repeated_words_and_no_arbitrary_round_cap(self):
        self.state = Game.init_game({}, players(2))
        for round_number in range(1, 26):
            self.guess(["月亮", "星星"])
            self.assertEqual(self.state["round"], round_number)
            self.next_round()
        self.guess(["月亮", "月亮"])
        self.assertEqual(self.state["teams"][0]["matched_round"], 26)

    def test_illegal_requests_preserve_state(self):
        valid = action(self.state, "submit_word", word="test")
        malformed = [None, [], "bad", {}, {**valid, "type": "reveal"}, {**valid, "word": 3},
                     {**valid, "word": ""}, {**valid, "word": "x" * 25}, {**valid, "word": "\u200bword"},
                     {**valid, "window_id": True}, {**valid, "window_id": 0.0},
                     {**valid, "window_id": -1}, {**valid, "game_token": "other"},
                     {**valid, "extra": "field"}, {key: value for key, value in valid.items() if key != "word"},
                     action(self.state, "next_round"), action(self.state, "next_round", word="test")]
        for payload in malformed:
            with self.subTest(payload=payload):
                self.assert_rejected("p0", payload)
        self.assert_rejected("spectator", valid)
        self.play("p0", word="first")
        self.assert_rejected("p0", action(self.state, "submit_word", word="second"))

    def test_stale_phase_and_cross_game_actions_are_rejected(self):
        stale = action(self.state, "submit_word", word="old")
        self.guess(["a", "b", "c", "d"])
        self.assert_rejected("p0", stale)
        self.next_round()
        self.assert_rejected("p0", stale)
        other = Game.init_game({}, players())
        self.assert_rejected("p0", action(other, "submit_word", word="new-game"))

    def test_views_and_serialization_are_isolated_copies(self):
        self.play("p0", word="private")
        before = copy.deepcopy(self.state)
        view = Game.get_public_view(self.state, "p0")
        view["players"][0]["name"] = "changed"
        view["teams"][0]["player_ids"].append("outsider")
        snapshot = Game.serialize(self.state)
        snapshot["pending"]["p0"] = "changed"
        self.assertEqual(self.state, before)

    def test_save_roundtrip_all_phases(self):
        snapshots = [copy.deepcopy(self.state)]
        self.play("p0", word="secret")
        snapshots.append(copy.deepcopy(self.state))
        for player_id, word in (("p1", "secret"), ("p2", "a"), ("p3", "b")):
            self.play(player_id, word=word)
        snapshots.append(copy.deepcopy(self.state))
        self.play("p0", "next_round")
        snapshots.append(copy.deepcopy(self.state))
        for player_id in ("p1", "p2", "p3"):
            self.play(player_id, "next_round")
        snapshots.append(copy.deepcopy(self.state))
        self.guess(["c", "c"])
        snapshots.append(copy.deepcopy(self.state))
        for snapshot in snapshots:
            with self.subTest(phase=snapshot["phase"], revision=snapshot["revision"]):
                encoded = json.loads(json.dumps(Game.serialize(snapshot)))
                restored = Game.deserialize(encoded)
                self.assertEqual(restored, snapshot)
                restored["players"]["p0"]["name"] = "altered"
                self.assertNotEqual(restored, encoded)

    def test_corrupt_saves_are_rejected(self):
        for key, value in (("game_id", "other"), ("version", 2), ("version", True), ("players", {}), ("teams", []),
                           ("round", 0), ("window_id", 1), ("revision", True), ("phase", "other"),
                           ("game_token", "bad"), ("game_over", True), ("winner", ["p0"]),
                           ("pending", {"outsider": "word"}), ("next_ready", ["p0"]),
                           ("turn_order", ["p1", "p0", "p2", "p3"])):
            with self.subTest(key=key), self.assertRaises(ValueError):
                Game.deserialize({**self.state, key: value})
        self.guess(["same", "same", "a", "b"])
        for key, value in (("matched_round", 2), ("player_ids", ["p0", "p3"]),
                           ("history", [{"round": 1, "words": ["a", "b"], "matched": True}])):
            damaged = copy.deepcopy(self.state)
            damaged["teams"][0][key] = value
            with self.subTest(team_key=key), self.assertRaises(ValueError):
                Game.deserialize(damaged)

    def test_bots_only_use_their_public_view(self):
        baseline = Game.bot_move(self.state, "p1")
        self.play("p0", word="super-secret")
        self.assertEqual(baseline, Game.bot_move(self.state, "p1"))
        self.play("p1", word="星星")
        self.play("p2", word="海")
        self.play("p3", word="山")
        self.next_round()
        public = Game.get_public_view(self.state, "p0")
        with patch.object(Game, "get_public_view", return_value=public) as get_view:
            move = Game.bot_move({}, "p0")
            get_view.assert_called_once_with({}, "p0")
        self.assertIn(move["word"], ["super-secret", "星星"])
        other = Game.bot_move(self.state, "p1")
        self.assertEqual(move["word"], other["word"])

    def test_all_bot_games_finish_for_every_supported_count(self):
        for count in Game.supported_player_counts:
            state = Game.init_game({}, players(count))
            for step in range(4 * count):
                if state["game_over"]:
                    break
                for player_id in state["turn_order"]:
                    move = Game.bot_move(state, player_id)
                    if move:
                        self.assertIsNone(Game.apply_action(state, player_id, move)[1])
            with self.subTest(count=count):
                self.assertTrue(state["game_over"])
                self.assertEqual(state["round"], 2)
                self.assertEqual(state["winner"], state["turn_order"])
                self.assertIsNone(Game.bot_move(state, "p0"))
                self.assertEqual(Game.deserialize(Game.serialize(state)), state)


if __name__ == "__main__":
    unittest.main()
