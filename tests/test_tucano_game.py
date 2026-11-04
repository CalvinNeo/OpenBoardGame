import copy
import unittest

from game.tucano import TucanoGame


def _players(count):
    return [
        {
            "player_id": f"p{idx}",
            "name": f"P{idx}",
            "seat": idx,
            "is_bot": False,
        }
        for idx in range(count)
    ]


class TucanoGameTests(unittest.TestCase):
    def test_bot_draft_prefers_best_visible_score(self):
        state = TucanoGame.init_game({}, _players(2))
        state["current_turn"] = "p0"
        state["columns"] = [
            [{"id": "a", "type": "fruit", "fruit": "lime"}],
            [{"id": "b", "type": "fruit", "fruit": "papaya"}],
            [{"id": "c", "type": "fruit", "fruit": "fig"}],
        ]

        self.assertEqual(TucanoGame.bot_move(state, "p0"), {"type": "draft_column", "column": 2})

    def test_bot_give_is_deterministic_and_dumps_bad_fruit(self):
        state = TucanoGame.init_game({}, _players(3))
        state.update(current_turn="p0", phase="toucan", pending_toucans=["give"])
        state["players"]["p0"]["face_up"] = {"lime": 1, "fig": 1}
        state["players"]["p1"]["face_up"] = {"fig": 1}
        state["players"]["p2"]["face_up"] = {"lime": 1}

        expected = {"type": "resolve_toucan", "fruit": "lime", "target_player": "p2"}
        self.assertEqual(TucanoGame.bot_move(state, "p0"), expected)
        self.assertEqual(TucanoGame.bot_move(state, "p0"), expected)

    def test_bot_steal_targets_the_largest_visible_swing(self):
        state = TucanoGame.init_game({}, _players(3))
        state.update(current_turn="p0", phase="toucan", pending_toucans=["steal"])
        state["players"]["p0"]["face_up"] = {"fig": 1}
        state["players"]["p1"]["face_up"] = {"fig": 2}
        state["players"]["p2"]["face_up"] = {"lime": 2}

        self.assertEqual(
            TucanoGame.bot_move(state, "p0"),
            {"type": "resolve_toucan", "fruit": "fig", "target_player": "p1"},
        )

    def test_bot_skips_unresolvable_toucan(self):
        state = TucanoGame.init_game({}, _players(2))
        state.update(current_turn="p0", phase="toucan", pending_toucans=["steal"])

        self.assertEqual(TucanoGame.bot_move(state, "p0"), {"type": "skip_toucan"})

    def test_bot_draft_evaluation_is_read_only(self):
        state = TucanoGame.init_game({}, _players(3))
        state.update(current_turn="p0", phase="draft")
        state["players"]["p0"]["face_up"] = {"fig": 2, "lime": 1}
        state["columns"] = [
            [{"id": "a", "type": "fruit", "fruit": "fig"}],
            [{"id": "b", "type": "toucan", "toucan": "flip"}],
            [{"id": "c", "type": "fruit", "fruit": "pineapple"}],
        ]
        before = copy.deepcopy(state)

        action = TucanoGame.bot_move(state, "p0")

        self.assertEqual(state, before)
        self.assertEqual(action, {"type": "draft_column", "column": 0})

    def test_bot_draft_does_not_use_opponent_protected_fruit(self):
        state = TucanoGame.init_game({}, _players(3))
        state.update(current_turn="p0", phase="draft")
        state["players"]["p0"]["face_up"] = {"fig": 1}
        state["players"]["p1"]["face_up"] = {"lime": 1}
        state["players"]["p1"]["protected"] = {"fig": 4}
        state["columns"] = [
            [{"id": "a", "type": "fruit", "fruit": "fig"}],
            [{"id": "b", "type": "fruit", "fruit": "coconut"}],
            [{"id": "c", "type": "fruit", "fruit": "pineapple"}],
        ]
        expected = TucanoGame.bot_move(state, "p0")
        state["players"]["p1"]["protected"] = {"lime": 4}

        self.assertEqual(TucanoGame.bot_move(state, "p0"), expected)

    def test_setup_uses_delayed_toucans(self):
        state = TucanoGame.init_game({}, _players(3))

        self.assertEqual(sum(len(column) for column in state["columns"]), 4)
        self.assertEqual(len(state["deck"]), 66)
        self.assertFalse(any(card["type"] == "toucan" for card in state["deck"][-25:]))

    def test_draft_adds_fruits_and_refreshes_all_columns(self):
        state = TucanoGame.init_game({}, _players(2))
        state["current_turn"] = "p0"
        state["columns"] = [
            [{"id": "a", "type": "fruit", "fruit": "papaya"}],
            [{"id": "b", "type": "fruit", "fruit": "lime"}],
            [{"id": "c", "type": "fruit", "fruit": "fig"}],
        ]
        state["deck"] = [
            {"id": "d", "type": "fruit", "fruit": "banana"},
            {"id": "e", "type": "fruit", "fruit": "fig"},
            {"id": "f", "type": "fruit", "fruit": "coconut"},
        ]

        _, error = TucanoGame.apply_action(state, "p0", {"type": "draft_column", "column": 0})

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p0"]["face_up"]["papaya"], 1)
        self.assertEqual([len(column) for column in state["columns"]], [1, 2, 2])
        self.assertEqual(state["current_turn"], "p1")

    def test_toucan_steal_only_takes_face_up_fruit(self):
        state = TucanoGame.init_game({}, _players(2))
        state["phase"] = "toucan"
        state["current_turn"] = "p0"
        state["pending_toucans"] = ["steal"]
        state["players"]["p1"]["face_up"] = {"banana": 1}
        state["players"]["p1"]["protected"] = {"papaya": 1}
        state["deck"] = []
        state["columns"] = [[{"id": "x", "type": "fruit", "fruit": "fig"}], [], []]

        _, error = TucanoGame.apply_action(
            state,
            "p0",
            {"type": "resolve_toucan", "target_player": "p1", "fruit": "banana"},
        )

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p0"]["face_up"]["banana"], 1)
        self.assertNotIn("banana", state["players"]["p1"]["face_up"])
        self.assertEqual(state["players"]["p1"]["protected"]["papaya"], 1)

    def test_flip_protects_all_face_up_fruit(self):
        state = TucanoGame.init_game({}, _players(2))
        state["phase"] = "toucan"
        state["current_turn"] = "p0"
        state["pending_toucans"] = ["flip"]
        state["players"]["p0"]["face_up"] = {"banana": 2, "lime": 1}
        state["deck"] = []
        state["columns"] = [[{"id": "x", "type": "fruit", "fruit": "fig"}], [], []]

        _, error = TucanoGame.apply_action(state, "p0", {"type": "resolve_toucan"})

        self.assertIsNone(error)
        self.assertEqual(state["players"]["p0"]["face_up"], {})
        self.assertEqual(state["players"]["p0"]["protected"], {"banana": 2, "lime": 1})

    def test_game_ends_when_deck_empty_and_one_column_left(self):
        state = TucanoGame.init_game({}, _players(2))
        state["current_turn"] = "p0"
        state["deck"] = []
        state["columns"] = [
            [{"id": "a", "type": "fruit", "fruit": "papaya"}],
            [{"id": "b", "type": "fruit", "fruit": "fig"}],
            [],
        ]

        _, error = TucanoGame.apply_action(state, "p0", {"type": "draft_column", "column": 0})

        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertIn("p0", state["scores"])


if __name__ == "__main__":
    unittest.main()
