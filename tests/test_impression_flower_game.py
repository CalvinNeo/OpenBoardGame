import unittest

from game.impression_flower import ImpressionFlowerGame


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


def _submit_drawings(state):
    for setter_id in list(state["assignments"].keys()):
        events, error = ImpressionFlowerGame.apply_action(
            state,
            setter_id,
            {"type": "submit_drawing", "image_data": f"img-{setter_id}"},
        )
        if error:
            raise AssertionError(error)


class ImpressionFlowerGameTests(unittest.TestCase):
    def test_init_assignments(self):
        players = _players(3)
        state = ImpressionFlowerGame.init_game({}, players)
        self.assertEqual(state["phase"], "draw")
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["guesser_id"], "p0")
        self.assertEqual(len(state["assignments"]), 2)
        self.assertEqual(len(state["decoys"]), 2)
        self.assertNotIn("p0", state["assignments"])

    def test_draw_to_guess_transition(self):
        state = ImpressionFlowerGame.init_game({}, _players(3))
        _submit_drawings(state)
        self.assertEqual(state["phase"], "guess")
        self.assertEqual(len(state["drawing_order"]), 2)
        self.assertEqual(len(state["word_bank"]), 4)

    def test_guess_scoring(self):
        state = ImpressionFlowerGame.init_game({}, _players(3))
        _submit_drawings(state)
        matches = [
            {"drawing_id": setter_id, "word": word}
            for setter_id, word in state["assignments"].items()
        ]
        events, error = ImpressionFlowerGame.apply_action(
            state,
            state["guesser_id"],
            {"type": "submit_matches", "matches": matches},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["players"]["p0"]["score"], 2)
        self.assertEqual(state["players"]["p1"]["score"], 1)
        self.assertEqual(state["players"]["p2"]["score"], 1)

    def test_word_bank_visible_to_setters_during_guess(self):
        state = ImpressionFlowerGame.init_game({}, _players(3))
        _submit_drawings(state)
        setter_id = next(iter(state["assignments"].keys()))
        view = ImpressionFlowerGame.get_public_view(state, setter_id)
        self.assertEqual(view["phase"], "guess")
        self.assertEqual(view["word_bank"], state["word_bank"])

    def test_continue_advances_guesser(self):
        config = {"rounds_per_guesser": 1}
        state = ImpressionFlowerGame.init_game(config, _players(3))
        _submit_drawings(state)
        matches = [
            {"drawing_id": setter_id, "word": word}
            for setter_id, word in state["assignments"].items()
        ]
        events, error = ImpressionFlowerGame.apply_action(
            state,
            state["guesser_id"],
            {"type": "submit_matches", "matches": matches},
        )
        self.assertIsNone(error)
        events, error = ImpressionFlowerGame.apply_action(state, "p0", {"type": "continue_game"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "draw")
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["guesser_id"], "p1")

    def test_end_game(self):
        state = ImpressionFlowerGame.init_game({}, _players(3))
        _submit_drawings(state)
        matches = [
            {"drawing_id": setter_id, "word": word}
            for setter_id, word in state["assignments"].items()
        ]
        ImpressionFlowerGame.apply_action(
            state,
            state["guesser_id"],
            {"type": "submit_matches", "matches": matches},
        )
        events, error = ImpressionFlowerGame.apply_action(state, "p1", {"type": "end_game"})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")

    def test_word_pool_refill(self):
        config = {"word_pool": ["only"], "rounds_per_guesser": 1}
        state = ImpressionFlowerGame.init_game(config, _players(4))
        words = list(state["assignments"].values()) + list(state["decoys"])
        self.assertEqual(len(state["assignments"]), 3)
        self.assertEqual(len(state["decoys"]), 2)
        self.assertTrue(all(word == "only" for word in words))


if __name__ == "__main__":
    unittest.main()
