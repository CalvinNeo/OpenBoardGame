import copy
import unittest
from collections import Counter
from unittest.mock import patch

from game.dare_words import (
    BOT_PHRASES,
    DECK_CHARACTERS,
    SHORT_DECK_CHARACTERS,
    DareWordsGame as Game,
    validate_phrase,
)


def players(count=3):
    return [{"player_id": f"p{index}", "name": f"Player {index + 1}", "seat": index}
            for index in range(count)]


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], **fields}


class DareWordsTests(unittest.TestCase):
    def setUp(self):
        patcher = patch("game.dare_words.random.shuffle", new=lambda sequence: None)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.state = Game.init_game({}, players(3))

    def play(self, player_id, kind, **fields):
        events, error = Game.apply_action(self.state, player_id, action(self.state, kind, **fields))
        self.assertIsNone(error, error)
        return events

    def reject(self, player_id, payload):
        before = copy.deepcopy(self.state)
        events, error = Game.apply_action(self.state, player_id, payload)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(before, self.state)
        return error

    def flip(self, times=1):
        for _ in range(times):
            flipper = self.state["flipper"]
            self.play(flipper, "flip")

    def vote_all(self, accept):
        claimer = self.state["claim"]["player_id"]
        for player_id in self.state["turn_order"]:
            if player_id == claimer:
                continue
            self.play(player_id, "vote", accept=accept)

    def next_round(self):
        for player_id in list(self.state["turn_order"]):
            if "next_round" in Game.get_legal_actions(self.state, player_id):
                self.play(player_id, "next_round")

    # --- setup -------------------------------------------------------------

    def test_player_counts_and_deck_sizes(self):
        for count in range(2, 9):
            with self.subTest(count=count):
                state = Game.init_game({}, players(count))
                self.assertEqual(len(state["deck"]), 100)
                self.assertEqual(state["flipper"], "p0")
                self.assertEqual(state["phase"], "flipping")
        for count in (0, 1, 9, 10):
            with self.subTest(count=count), self.assertRaises(ValueError):
                Game.init_game({}, players(count))
        short = Game.init_game({"deck_size": "short"}, players(2))
        self.assertEqual(len(short["deck"]), 60)
        self.assertEqual(short["config"], {"deck_size": "short"})
        with self.assertRaises(ValueError):
            Game.init_game({"deck_size": "tiny"}, players(2))
        with self.assertRaises(ValueError):
            Game.init_game({"deck_size": "full", "extra": 1}, players(2))

    def test_deck_composition_supports_bot_vocabulary(self):
        counts = Counter(DECK_CHARACTERS)
        self.assertEqual(len(DECK_CHARACTERS), 100)
        self.assertEqual(len(SHORT_DECK_CHARACTERS), 60)
        short_counts = Counter(SHORT_DECK_CHARACTERS)
        self.assertTrue(all(short_counts[char] <= counts[char] for char in short_counts))
        for phrase in BOT_PHRASES:
            with self.subTest(phrase=phrase):
                self.assertGreaterEqual(len(phrase), 3)
                for char, needed in Counter(phrase).items():
                    self.assertGreaterEqual(counts[char], needed)

    # --- flipping ----------------------------------------------------------

    def test_flip_rotates_and_grows_the_row(self):
        self.assertEqual(self.state["flipper"], "p0")
        self.play("p0", "flip")
        self.assertEqual([card["char"] for card in self.state["row"]], ["的"])
        self.assertEqual(self.state["flipper"], "p1")
        self.play("p1", "flip")
        self.play("p2", "flip")
        self.assertEqual([card["char"] for card in self.state["row"]], ["的", "的", "了"])
        self.assertEqual(self.state["flipper"], "p0")
        self.assertEqual(self.state["flips"], 3)
        self.assertEqual(len(self.state["deck"]), 97)

    def test_only_the_flipper_may_flip(self):
        self.assertEqual(Game.get_legal_actions(self.state, "p1"), [])
        self.assertIn("flip", Game.get_legal_actions(self.state, "p0"))
        self.reject("p1", action(self.state, "flip"))

    def test_stale_window_is_rejected(self):
        stale = action(self.state, "flip")
        self.play("p0", "flip")
        self.assertEqual(Game.apply_action(self.state, "p1", stale)[1],
                         "This action belongs to an old game or round.")

    # --- claiming ----------------------------------------------------------

    def test_claim_requires_three_characters_from_the_table(self):
        self.flip(3)  # 的 的 了
        self.assertEqual([card["char"] for card in self.state["row"]], ["的", "的", "了"])
        self.assertIn("claim", Game.get_legal_actions(self.state, "p0"))
        self.assertEqual(self.reject("p0", action(self.state, "claim", phrase="的的")),
                         "至少要用 3 个字。")
        self.assertIn("不在桌面上", self.reject("p0", action(self.state, "claim", phrase="的天上")))
        self.assertIn("不够用", self.reject("p0", action(self.state, "claim", phrase="的的的")))
        self.assertEqual(self.reject("p0", action(self.state, "claim", phrase="的,了")),
                         "只能用汉字，不能加标点、字母或数字。")
        self.assertEqual(self.reject("p0", action(self.state, "claim", phrase="的a了")),
                         "只能用汉字，不能加标点、字母或数字。")
        self.assertEqual(self.state["phase"], "flipping")

    def test_successful_claim_moves_to_voting(self):
        self.flip(3)
        self.play("p1", "claim", phrase=" 的 了 的 ")
        self.assertEqual(self.state["phase"], "voting")
        self.assertEqual(self.state["claim"]["phrase"], "的了的")
        self.assertEqual(len(self.state["claim"]["card_ids"]), 3)
        self.assertEqual(self.state["claim"]["votes"], {})
        self.assertEqual(Game.get_legal_actions(self.state, "p1"), [])
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), ["vote"])

    def test_claim_hidden_until_three_cards_are_on_the_table(self):
        self.assertEqual(Game.get_legal_actions(self.state, "p1"), [])
        self.flip(2)
        self.assertEqual(self.state["flipper"], "p2")
        self.assertEqual(Game.get_legal_actions(self.state, "p2"), ["flip"])
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), [])
        self.flip(1)
        self.assertEqual(self.state["flipper"], "p0")
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), ["flip", "claim"])
        self.assertEqual(Game.get_legal_actions(self.state, "p1"), ["claim"])

    def test_duplicate_cards_are_consumed_once_each(self):
        self.flip(3)
        self.assertIsNotNone(validate_phrase(self.state, "的的")[1])
        self.assertIsNotNone(validate_phrase(self.state, "的的的")[1])
        card_ids, error = validate_phrase(self.state, "的了的")
        self.assertIsNone(error)
        self.assertEqual(len(set(card_ids)), 3)

    # --- voting ------------------------------------------------------------

    def test_majority_accept_awards_the_used_cards(self):
        self.flip(3)
        row_before = len(self.state["row"])
        self.play("p0", "claim", phrase="的了的")
        self.play("p1", "vote", accept=True)
        self.assertEqual(self.state["phase"], "voting")
        self.play("p2", "vote", accept=True)
        self.assertEqual(self.state["phase"], "reveal")
        self.assertEqual(self.state["players"]["p0"]["score"], 3)
        self.assertEqual(len(self.state["row"]), row_before - 3)
        result = self.state["last_result"]
        self.assertTrue(result["accepted"])
        self.assertEqual(result["accepts"], ["p1", "p2"])
        self.assertEqual(result["cards"], 3)
        self.assertEqual(self.state["history"], [result])

    def test_rejection_keeps_cards_and_blocks_the_claimer(self):
        self.flip(3)
        row_before = len(self.state["row"])
        self.play("p0", "claim", phrase="的了的")
        self.play("p1", "vote", accept=False)
        self.play("p2", "vote", accept=False)
        self.assertEqual(self.state["phase"], "reveal")
        self.assertEqual(self.state["players"]["p0"]["score"], 0)
        self.assertEqual(len(self.state["row"]), row_before)
        self.assertNotIn("claim", Game.get_legal_actions(self.state, "p0"))
        self.next_round()
        self.assertEqual(self.state["phase"], "flipping")
        self.assertNotIn("claim", Game.get_legal_actions(self.state, "p0"))
        self.flip(1)
        self.assertIn("claim", Game.get_legal_actions(self.state, "p0"))

    def test_tie_is_a_rejection(self):
        state = Game.init_game({}, players(5))
        for _ in range(3):
            Game.apply_action(state, state["flipper"], action(state, "flip"))
        Game.apply_action(state, "p0", action(state, "claim", phrase="的了的"))
        for player_id, accept in (("p1", True), ("p2", False), ("p3", True), ("p4", False)):
            Game.apply_action(state, player_id, action(state, "vote", accept=accept))
        self.assertEqual(state["phase"], "reveal")
        self.assertFalse(state["last_result"]["accepted"])
        self.assertEqual(state["players"]["p0"]["score"], 0)
        self.assertEqual(len(state["row"]), 3)

    def test_votes_share_one_window(self):
        self.flip(3)
        self.play("p0", "claim", phrase="的了的")
        window = self.state["window_id"]
        self.play("p1", "vote", accept=True)
        self.assertEqual(self.state["window_id"], window)
        self.play("p2", "vote", accept=True)
        self.assertEqual(self.state["window_id"], window + 1)

    def test_players_cannot_vote_twice_or_vote_for_themselves(self):
        self.flip(3)
        self.play("p0", "claim", phrase="的了的")
        self.play("p1", "vote", accept=True)
        self.assertEqual(Game.get_legal_actions(self.state, "p1"), [])
        self.reject("p1", action(self.state, "vote", accept=False))
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), [])

    # --- reveal and end ----------------------------------------------------

    def test_next_round_needs_every_player(self):
        self.flip(3)
        self.play("p0", "claim", phrase="的了的")
        self.vote_all(True)
        self.assertEqual(self.state["phase"], "reveal")
        self.play("p0", "next_round")
        self.assertEqual(self.state["phase"], "reveal")
        self.assertEqual(self.state["ready"], ["p0"])
        self.play("p1", "next_round")
        self.play("p2", "next_round")
        self.assertEqual(self.state["phase"], "flipping")
        self.assertEqual(self.state["round"], 2)
        self.assertEqual(self.state["ready"], [])

    def test_game_ends_when_the_table_cannot_grow(self):
        self.state["deck"] = []
        self.state["row"] = []
        self.state["flips"] = 100
        self.state["next_card_id"] = 101
        self.assertIn("finish_game", Game.get_legal_actions(self.state, "p0"))
        self.play("p1", "finish_game")
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["phase"], "game_over")
        self.assertEqual(self.state["winner"], ["p0", "p1", "p2"])
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), ["play_again"])

    def test_play_again_keeps_config_and_resets_scores(self):
        state = Game.init_game({"deck_size": "short"}, players(3))
        state["deck"] = []
        state["row"] = []
        Game.apply_action(state, "p0", action(state, "finish_game"))
        Game.apply_action(state, "p0", action(state, "play_again"))
        self.assertFalse(state["game_over"])
        self.assertEqual(state["config"], {"deck_size": "short"})
        self.assertEqual(len(state["deck"]), 60)
        self.assertEqual([player["score"] for player in state["players"].values()], [0, 0, 0])
        self.assertEqual(state["phase"], "flipping")

    # --- views -------------------------------------------------------------

    def test_view_hides_votes_until_resolution(self):
        self.flip(3)
        self.play("p0", "claim", phrase="的了的")
        self.play("p1", "vote", accept=True)
        view = Game.get_public_view(self.state, "p2")
        self.assertEqual(view["claim"]["votes_cast"], 1)
        self.assertEqual(view["claim"]["votes_needed"], 2)
        self.assertIsNone(view["claim"]["your_vote"])
        self.assertNotIn("votes", view["claim"])
        own = Game.get_public_view(self.state, "p1")
        self.assertTrue(own["claim"]["your_vote"])
        self.play("p2", "vote", accept=False)
        resolved = Game.get_public_view(self.state, "p0")
        self.assertIsNone(resolved["claim"])
        self.assertEqual(resolved["last_result"]["votes"], {"p1": True, "p2": False})

    def test_view_reports_row_deck_and_players(self):
        self.flip(2)
        view = Game.get_public_view(self.state, "p1")
        self.assertEqual(len(view["row"]), 2)
        self.assertEqual(view["deck_remaining"], 98)
        self.assertEqual(view["deck_total"], 100)
        self.assertEqual(view["flipper"], "p2")
        self.assertEqual(view["min_chars"], 3)
        self.assertEqual([player["player_id"] for player in view["players"]], ["p0", "p1", "p2"])
        self.assertTrue(next(player for player in view["players"] if player["player_id"] == "p1")["is_you"])
        self.assertTrue(next(player for player in view["players"] if player["player_id"] == "p2")["is_flipper"])

    # --- bots --------------------------------------------------------------

    def test_bot_moves_are_legal_and_in_vocabulary(self):
        state = Game.init_game({}, [
            {"player_id": f"p{index}", "name": f"Bot {index}", "seat": index, "is_bot": True}
            for index in range(3)
        ])
        for _ in range(400):
            if state["game_over"]:
                break
            moved = False
            for player_id in state["turn_order"]:
                move = Game.bot_move(state, player_id)
                if not move:
                    continue
                self.assertIn(move["type"], Game.get_legal_actions(state, player_id))
                payload = {key: value for key, value in move.items() if key != "delay_ms"}
                if payload["type"] == "claim":
                    self.assertIsNone(validate_phrase(state, payload["phrase"])[1])
                events, error = Game.apply_action(state, player_id, payload)
                self.assertIsNone(error, error)
                moved = True
                break
            self.assertTrue(moved, "bots stalled")
        self.assertTrue(state["game_over"])
        self.assertTrue(state["winner"])
        self.assertTrue(all(len(entry["phrase"]) >= 3 for entry in state["history"]))

    def test_bot_does_not_answer_after_the_game(self):
        self.state["deck"] = []
        self.state["row"] = []
        self.play("p0", "finish_game")
        self.assertIsNone(Game.bot_move(self.state, "p0"))

    # --- saves -------------------------------------------------------------

    def test_save_roundtrip_and_tamper_checks(self):
        self.flip(4)
        self.play("p0", "claim", phrase="的了的")
        self.vote_all(True)
        self.next_round()
        self.flip(1)
        blob = Game.serialize(self.state)
        restored = Game.deserialize(blob)
        self.assertEqual(restored, self.state)

        for mutate in (
            lambda payload: payload.update(deck=payload["deck"][:-1]),
            lambda payload: payload.update(row=payload["row"] + [{"card_id": 99, "char": "龙"}]),
            lambda payload: payload["players"]["p0"].update(score=payload["players"]["p0"]["score"] + 1),
            lambda payload: payload.update(phase="voting"),
            lambda payload: payload.update(next_card_id=payload["next_card_id"] + 1),
            lambda payload: payload.update(winner=["p0"]),
        ):
            with self.subTest(mutate=mutate):
                payload = copy.deepcopy(blob)
                mutate(payload)
                with self.assertRaises(ValueError):
                    Game.deserialize(payload)

    def test_deserialize_rejects_foreign_payloads(self):
        with self.assertRaises(ValueError):
            Game.deserialize({"game_id": "word_sync", "version": 1})
        with self.assertRaises(ValueError):
            Game.deserialize({})


if __name__ == "__main__":
    unittest.main()
