import unittest

from game.hanabi import HanabiGame, MAX_CLUES, _init_knowledge


class HanabiGameTests(unittest.TestCase):
    def _make_players(self):
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    def test_clue_updates_negative_info(self):
        state = HanabiGame.init_game({}, self._make_players())
        state["current_turn"] = "p1"
        state["players"]["p2"]["hand"] = [
            {"color": "red", "rank": 1},
            {"color": "blue", "rank": 2},
            {"color": "red", "rank": 5},
        ]
        state["players"]["p2"]["knowledge"] = [_init_knowledge() for _ in range(3)]

        events, error = HanabiGame.apply_action(
            state,
            "p1",
            {"type": "give_clue", "target_player_id": "p2", "clue_type": "color", "value": "red"},
        )

        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "hanabi:clue" for evt in events))
        self.assertEqual(state["clue_tokens"], MAX_CLUES - 1)

        matched_0 = state["players"]["p2"]["knowledge"][0]
        matched_2 = state["players"]["p2"]["knowledge"][2]
        unmatched_1 = state["players"]["p2"]["knowledge"][1]

        self.assertEqual(matched_0["known_color"], "red")
        self.assertEqual(matched_2["known_color"], "red")
        self.assertIn("red", unmatched_1["not_colors"])
        self.assertNotIn("red", matched_0["not_colors"])
        self.assertNotIn("red", matched_2["not_colors"])
        self.assertEqual(len(matched_0["not_colors"]), 4)

    def test_discard_forbidden_when_clues_full(self):
        state = HanabiGame.init_game({}, self._make_players())
        state["current_turn"] = "p1"
        state["clue_tokens"] = MAX_CLUES

        events, error = HanabiGame.apply_action(state, "p1", {"type": "discard", "card_index": 0})

        self.assertEqual(events, [])
        self.assertEqual(error, "clue tokens already full")

    def test_final_round_ends_after_other_players_act(self):
        state = HanabiGame.init_game({}, self._make_players())
        state["current_turn"] = "p1"
        state["clue_tokens"] = MAX_CLUES - 1
        state["deck"] = [{"color": "yellow", "rank": 1}]

        events, error = HanabiGame.apply_action(state, "p1", {"type": "discard", "card_index": 0})

        self.assertIsNone(error)
        self.assertEqual(state["final_rounds_remaining"], 1)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "p2")

        state["players"]["p2"]["hand"][0] = {"color": "red", "rank": 1}
        state["tableau"]["red"] = 0
        events, error = HanabiGame.apply_action(state, "p2", {"type": "play", "card_index": 0})

        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["end_reason"], "deck_exhausted")


if __name__ == "__main__":
    unittest.main()
