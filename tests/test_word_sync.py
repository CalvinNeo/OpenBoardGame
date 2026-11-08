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
        for count in (2, 4, 6, 8, 10):
            with self.subTest(count=count):
                state = Game.init_game({}, list(reversed(players(count))))
                self.assertEqual(state["turn_order"], [f"p{index}" for index in range(count)])
                self.assertEqual(state["mode"], "team")
                self.assertEqual([team["player_ids"] for team in state["teams"]],
                                 [[f"p{index}", f"p{index + 1}"] for index in range(0, count, 2)])
        for count in (0, 1, 3, 5, 7, 9, 11):
            with self.subTest(count=count), self.assertRaises(ValueError):
                Game.init_game({}, players(count))

    def test_free_for_all_takes_every_count_from_two_to_ten(self):
        for count in range(2, 11):
            with self.subTest(count=count):
                state = Game.init_game({"mode": "free_for_all"}, players(count))
                self.assertEqual(state["mode"], "free_for_all")
                self.assertEqual(state["config"], {"mode": "free_for_all"})
                self.assertEqual([team["player_ids"] for team in state["teams"]],
                                 [[f"p{index}"] for index in range(count)])
        for count in (0, 1, 11):
            with self.subTest(count=count), self.assertRaises(ValueError):
                Game.init_game({"mode": "free_for_all"}, players(count))

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
        for config in (None, [], {"seed": 1}, {"rounds": 3}, {"mode": "solo"}, {"mode": True},
                       {"mode": "team", "rounds": 2}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                Game.init_game(config, players())
        for config in ({}, {"mode": "team"}):
            with self.subTest(config=config):
                self.assertEqual(Game.init_game(config, players())["mode"], "team")

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

    def test_used_words_are_burned_without_a_round_cap(self):
        self.state = Game.init_game({}, players(2))
        for round_number in range(1, 26):
            self.guess([f"词{round_number}", f"星{round_number}"])
            self.assertEqual(self.state["round"], round_number)
            self.next_round()
            self.assert_rejected("p0", action(self.state, "submit_word", word=f"  词{round_number} "))
        self.guess(["月亮", "月亮"])
        self.assertEqual(self.state["teams"][0]["matched_round"], 26)
        self.assertEqual(len(Game.get_public_view(self.state, "p0")["used_words"]), 51)

    def test_used_words_block_every_player_and_normalised_variants(self):
        self.guess(["apple", "banana", "海", "山"])
        self.next_round()
        for player_id in ("p0", "p1", "p2", "p3"):
            self.assertEqual(Game.get_public_view(self.state, player_id)["used_words"],
                             ["apple", "banana", "海", "山"])
        for player_id in ("p0", "p2"):
            for word in ("apple", "APPLE", "  Apple  ", "ＡＰＰＬＥ", "banana", "海", "山"):
                with self.subTest(player_id=player_id, word=word):
                    self.assert_rejected(player_id, action(self.state, "submit_word", word=word))
        self.assertEqual(Game.apply_action(self.state, "p0", action(self.state, "submit_word", word="apple"))[1],
                         "That word was already used in an earlier round. Pick a new one.")
        self.play("p0", word="樱桃")
        self.assertEqual(self.state["pending"], {"p0": "樱桃"})

    def test_same_round_duplicates_stay_legal_and_still_match(self):
        self.guess(["海", "海", "海", "山"])
        self.assertEqual([team["matched_round"] for team in self.state["teams"]], [1, None])
        self.assertEqual(self.state["teams"][1]["history"][0]["words"], ["海", "山"])
        self.assertEqual(Game.get_public_view(self.state, "p0")["used_words"], ["海", "山"])
        self.assertEqual(Game.deserialize(Game.serialize(self.state)), self.state)

    def test_version_one_saves_may_repeat_words_while_version_two_rejects_them(self):
        self.state = Game.init_game({}, players(2))
        self.guess(["月亮", "星星"])
        self.next_round()
        self.guess(["海", "山"])
        self.assertEqual(Game.init_game({}, players(2))["version"], 2)
        legacy = copy.deepcopy(self.state)
        legacy["version"] = 1
        legacy["teams"][0]["history"][1]["words"] = ["月亮", "星星"]
        self.assertEqual(Game.deserialize(legacy), legacy)
        with self.assertRaises(ValueError):
            Game.deserialize({**legacy, "version": 2})

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
        for key, value in (("game_id", "other"), ("version", 3), ("version", True), ("players", {}), ("teams", []),
                           ("round", 0), ("window_id", 1), ("revision", True), ("phase", "other"),
                           ("game_token", "bad"), ("game_over", True), ("winner", ["p0"]),
                           ("pending", {"outsider": "word"}), ("next_ready", ["p0"]),
                           ("turn_order", ["p1", "p0", "p2", "p3"]), ("mode", "free_for_all"),
                           ("mode", "solo"), ("config", {"mode": "free_for_all"})):
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
        self.assertNotIn(move["word"], ["super-secret", "星星", "海", "山"])
        self.assertEqual(move["word"], "月亮")
        other = Game.bot_move(self.state, "p1")
        self.assertEqual(move["word"], other["word"])

    def test_all_bot_games_finish_for_every_supported_count(self):
        for mode, counts in Game.player_counts_by_mode.items():
            for count in counts:
                with self.subTest(mode=mode, count=count):
                    state = Game.init_game({"mode": mode}, players(count))
                    for step in range(4 * count):
                        if state["game_over"]:
                            break
                        for player_id in state["turn_order"]:
                            move = Game.bot_move(state, player_id)
                            if move:
                                self.assertIsNone(Game.apply_action(state, player_id, move)[1])
                    self.assertTrue(state["game_over"])
                    self.assertLessEqual(state["round"], 2)
                    self.assertIsNone(Game.bot_move(state, "p0"))
                    self.assertEqual(Game.deserialize(Game.serialize(state)), state)
                    if mode == "team":
                        self.assertEqual(state["round"], 2)
                        self.assertEqual(state["winner"], state["turn_order"])

    def test_free_for_all_collision_ends_the_game_immediately(self):
        self.state = Game.init_game({"mode": "free_for_all"}, players(5))
        for player_id, word in (("p0", "月亮"), ("p1", "海"), ("p2", " ＭＯＯＮ "), ("p3", "moon")):
            self.play(player_id, word=word)
        self.assertEqual(self.state["phase"], "guess")
        self.assertNotIn("月亮", json.dumps(Game.get_public_view(self.state, "p4"), ensure_ascii=False))
        self.play("p4", word="山")
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["phase"], "game_over")
        self.assertEqual(self.state["winner"], ["p2", "p3"])
        self.assertEqual(self.state["winning_team_ids"], ["team-3", "team-4"])
        self.assertEqual([team["matched_round"] for team in self.state["teams"]], [None, None, 1, 1, None])
        self.assertEqual([team["history"][0]["words"] for team in self.state["teams"]],
                         [["月亮"], ["海"], ["MOON"], ["moon"], ["山"]])
        self.assertEqual([team["history"][0]["matched"] for team in self.state["teams"]],
                         [False, False, True, True, False])
        standings = Game.get_public_view(self.state, "p0")["standings"]
        self.assertEqual([(row["team_id"], row["rounds"], row["rank"]) for row in standings],
                         [("team-3", 1, 1), ("team-4", 1, 1), ("team-1", None, None),
                          ("team-2", None, None), ("team-5", None, None)])
        self.assert_rejected("p0", action(self.state, "next_round"))

    def test_free_for_all_without_a_collision_starts_another_round(self):
        self.state = Game.init_game({"mode": "free_for_all"}, players(3))
        self.guess(["a", "b", "c"])
        self.assertEqual((self.state["phase"], self.state["game_over"]), ("reveal", False))
        self.assertEqual([row["rank"] for row in Game.get_public_view(self.state, "p0")["standings"]],
                         [None, None, None])
        self.next_round()
        self.assertEqual((self.state["round"], self.state["phase"]), (2, "guess"))
        self.guess(["海岸", "海岸", "山"])
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["winner"], ["p0", "p1"])
        self.assertEqual([len(team["history"]) for team in self.state["teams"]], [2, 2, 2])

    def test_free_for_all_ten_players_keep_seat_order_in_the_standings(self):
        self.state = Game.init_game({"mode": "free_for_all"}, players(10))
        self.guess(["a", "b", "c", "d", "e", "f", "g", "h", "i", "i"])
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["winner"], ["p8", "p9"])
        self.assertEqual([row["team_id"] for row in Game.get_public_view(self.state, "p0")["standings"]],
                         ["team-9", "team-10", "team-1", "team-2", "team-3", "team-4",
                          "team-5", "team-6", "team-7", "team-8"])

    def test_free_for_all_two_players_cannot_reuse_words_across_rounds(self):
        self.state = Game.init_game({"mode": "free_for_all"}, players(2))
        self.guess(["月亮", "星星"])
        self.assertFalse(self.state["game_over"])
        self.next_round()
        for word in ("月亮", "星星", "  月亮 ", "　星星　"):
            with self.subTest(word=word):
                self.assert_rejected("p0", action(self.state, "submit_word", word=word))
        self.guess(["海", "山"])
        self.assertFalse(self.state["game_over"])
        self.assertEqual(Game.get_public_view(self.state, "p0")["used_words"], ["月亮", "星星", "海", "山"])
        self.next_round()
        self.guess(["河", "河"])
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["winner"], ["p0", "p1"])
        self.assertEqual(self.state["teams"][0]["matched_round"], 3)

    def test_free_for_all_saves_roundtrip_and_reject_tampering(self):
        self.state = Game.init_game({"mode": "free_for_all"}, players(4))
        snapshots = [copy.deepcopy(self.state)]
        self.play("p0", word="one")
        snapshots.append(copy.deepcopy(self.state))
        self.guess(["b", "c", "d"])
        snapshots.append(copy.deepcopy(self.state))
        self.next_round()
        snapshots.append(copy.deepcopy(self.state))
        self.guess(["x", "x", "y", "z"])
        snapshots.append(copy.deepcopy(self.state))
        self.assertEqual(self.state["winner"], ["p0", "p1"])
        for snapshot in snapshots:
            with self.subTest(phase=snapshot["phase"], round=snapshot["round"]):
                encoded = json.loads(json.dumps(Game.serialize(snapshot)))
                self.assertEqual(Game.deserialize(encoded), snapshot)
        for mutate in (lambda state: state["teams"][2]["history"][1].__setitem__("words", ["c"]),
                       lambda state: state["teams"][0].__setitem__("matched_round", 1),
                       lambda state: state["teams"][2]["history"][1].__setitem__("matched", True),
                       lambda state: state["teams"][0]["history"].pop(),
                       lambda state: state.__setitem__("mode", "team"),
                       lambda state: state.__setitem__("game_over", False),
                       lambda state: state.__setitem__("winning_team_ids", ["team-1"]),
                       lambda state: state.__setitem__("winner", ["p0", "p1", "p2"]),
                       lambda state: state.__setitem__("revision", 3)):
            damaged = copy.deepcopy(self.state)
            mutate(damaged)
            with self.subTest(mutate=mutate.__name__ if hasattr(mutate, "__name__") else mutate):
                with self.assertRaises(ValueError):
                    Game.deserialize(damaged)

    def test_free_for_all_bots_only_use_public_words(self):
        self.state = Game.init_game({"mode": "free_for_all"}, players(4))
        baseline = [Game.bot_move(self.state, player_id) for player_id in ("p1", "p2")]
        self.play("p0", word="super-secret")
        self.assertEqual(baseline, [Game.bot_move(self.state, player_id) for player_id in ("p1", "p2")])
        self.state = Game.init_game({"mode": "free_for_all"}, players(3))
        self.guess(["zebra", "apple", "mango"])
        self.next_round()
        self.assertEqual([Game.bot_move(self.state, player_id)["word"] for player_id in ("p0", "p1", "p2")],
                         ["月亮", "月亮", "月亮"])


if __name__ == "__main__":
    unittest.main()
