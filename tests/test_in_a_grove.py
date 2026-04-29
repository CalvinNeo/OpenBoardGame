import unittest

from game.in_a_grove import (
    InAGroveGame,
    _build_round_summary,
    _determine_murderer_index,
    _finish_game,
    _pick_next_first_player,
)


def _tile(label, value):
    return {"id": f"tile_{label}", "label": str(label), "value": value}


class InAGroveGameTests(unittest.TestCase):
    def test_murderer_is_lowest_when_five_is_present(self):
        suspects = [_tile("7", 7), _tile("5", 5), _tile("3", 3)]
        self.assertEqual(_determine_murderer_index(suspects), 2)

    def test_murderer_is_highest_when_five_is_absent(self):
        suspects = [_tile("2", 2), _tile("X", None), _tile("8", 8)]
        self.assertEqual(_determine_murderer_index(suspects), 2)

    def test_two_player_setup_has_public_alibi_and_two_private_alibis(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
            ],
        )
        self.assertIsNotNone(state["public_alibi"])
        self.assertEqual(len(state["suspects"]), 3)
        self.assertEqual(len(state["removed_tiles"]), 2)
        for player in ("a", "b"):
            self.assertIsNotNone(state["players"][player]["own_tile"])
            self.assertIsNotNone(state["players"][player]["passed_tile"])

    def test_innocent_top_chip_takes_full_stack(self):
        state = {
            "turn_order": ["a", "b", "c"],
            "first_player": "a",
            "round": 1,
            "players": {
                "a": {"hand_count": 6, "penalty_count": 0},
                "b": {"hand_count": 6, "penalty_count": 0},
                "c": {"hand_count": 6, "penalty_count": 0},
            },
            "suspects": [
                {"tile": _tile("2", 2), "stack": ["a", "b"]},
                {"tile": _tile("6", 6), "stack": ["c"]},
                {"tile": _tile("5", 5), "stack": []},
            ],
            "victim": _tile("X", None),
        }
        murderer_index = _determine_murderer_index([entry["tile"] for entry in state["suspects"]])
        self.assertEqual(murderer_index, 0)
        penalty_gains = {"a": 0, "b": 0, "c": 1}
        summary = _build_round_summary(state, murderer_index, penalty_gains)
        self.assertEqual(summary["suspects"][1]["penalty_receiver"], "c")
        self.assertEqual(summary["suspects"][1]["penalty_count"], 1)
        self.assertEqual(summary["suspects"][2]["penalty_receiver"], None)

    def test_next_first_player_breaks_ties_clockwise_from_current_first(self):
        state = {"turn_order": ["a", "b", "c", "d"], "first_player": "c"}
        gains = {"a": 2, "b": 0, "c": 2, "d": 1}
        self.assertEqual(_pick_next_first_player(state, gains), "a")

    def test_first_player_can_peek_swap_and_bet(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
                {"player_id": "c", "name": "C", "seat": 2},
            ],
        )
        state["first_player"] = "a"
        state["current_turn"] = "a"
        state["phase"] = "peek"
        state["turn_context"] = {"viewed_indexes": [], "can_swap": True, "acted_count": 0}
        state["blocked_suspect_index"] = None

        events, error = InAGroveGame.apply_action(
            state,
            "a",
            {"type": "peek_suspects", "suspect_indexes": [0, 1]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "swap_or_bet")
        self.assertEqual(events[0]["type"], "in_a_grove:peek")

        events, error = InAGroveGame.apply_action(
            state,
            "a",
            {"type": "skip_swap"},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "bet")
        self.assertEqual(events[0]["type"], "in_a_grove:skip_swap")

        hand_before = state["players"]["a"]["hand_count"]
        events, error = InAGroveGame.apply_action(
            state,
            "a",
            {"type": "place_bet", "suspect_index": 2},
        )
        self.assertIsNone(error)
        self.assertEqual(state["players"]["a"]["hand_count"], hand_before - 1)
        self.assertEqual(state["blocked_suspect_index"], 2)
        self.assertEqual(events[0]["type"], "in_a_grove:bet")

    def test_round_end_waits_for_all_players_before_next_round(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
            ],
        )
        state["round"] = 1
        state["turn_order"] = ["a", "b"]
        state["first_player"] = "a"
        state["current_turn"] = "b"
        state["phase"] = "bet"
        state["turn_context"] = {"viewed_indexes": [], "can_swap": False, "acted_count": 1}
        state["suspects"] = [
            {"tile": _tile("2", 2), "stack": ["a"]},
            {"tile": _tile("7", 7), "stack": []},
            {"tile": _tile("X", None), "stack": []},
        ]
        state["victim"] = _tile("5", 5)
        state["players"]["a"]["hand_count"] = 6
        state["players"]["b"]["hand_count"] = 7

        events, error = InAGroveGame.apply_action(state, "b", {"type": "place_bet", "suspect_index": 1})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertIn("in_a_grove:reveal", [evt["type"] for evt in events])
        self.assertEqual(InAGroveGame.get_legal_actions(state, "a"), ["next_round"])
        self.assertEqual(InAGroveGame.get_legal_actions(state, "b"), ["next_round"])

        events, error = InAGroveGame.apply_action(state, "a", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertTrue(state["players"]["a"]["round_ready"])
        self.assertEqual(state["phase"], "round_end")

        prev_round = state["round"]
        events, error = InAGroveGame.apply_action(state, "b", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["round"], prev_round + 1)
        self.assertEqual(state["phase"], "peek")
        self.assertFalse(state["players"]["a"]["round_ready"])
        self.assertFalse(state["players"]["b"]["round_ready"])
        self.assertTrue(any(evt["type"] == "in_a_grove:next_round" for evt in events))

    def test_bot_immediately_confirms_next_round(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
                {"player_id": "p2", "name": "P2", "seat": 1},
            ],
        )
        state["phase"] = "round_end"
        state["current_turn"] = None
        state["players"]["bot"]["round_ready"] = False
        state["players"]["p2"]["round_ready"] = False
        action = InAGroveGame.bot_move(state, "bot")
        self.assertEqual(action["type"], "next_round")

    def test_final_round_still_waits_before_game_over(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
            ],
        )
        state["round"] = 1
        state["turn_order"] = ["a", "b"]
        state["first_player"] = "a"
        state["current_turn"] = "b"
        state["phase"] = "bet"
        state["turn_context"] = {"viewed_indexes": [], "can_swap": False, "acted_count": 1}
        state["suspects"] = [
            {"tile": _tile("2", 2), "stack": ["a"]},
            {"tile": _tile("7", 7), "stack": []},
            {"tile": _tile("X", None), "stack": []},
        ]
        state["victim"] = _tile("5", 5)
        state["players"]["a"]["hand_count"] = 0
        state["players"]["b"]["hand_count"] = 1

        _, error = InAGroveGame.apply_action(state, "b", {"type": "place_bet", "suspect_index": 1})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertFalse(state["game_over"])
        self.assertTrue(state["pending_game_over"])

        _, error = InAGroveGame.apply_action(state, "a", {"type": "next_round"})
        self.assertIsNone(error)
        events, error = InAGroveGame.apply_action(state, "b", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "game_over")
        self.assertTrue(state["game_over"])
        self.assertTrue(any(evt["type"] == "in_a_grove:game_over" for evt in events))

    def test_public_view_keeps_victim_hidden_at_round_end(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
            ],
        )
        state["phase"] = "round_end"
        state["victim"] = _tile("6", 6)
        view = InAGroveGame.get_public_view(state, "a")
        self.assertTrue(view["victim_hidden"])
        self.assertNotIn("victim_label", view)

    def test_game_over_view_includes_final_ranking(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
                {"player_id": "c", "name": "C", "seat": 2},
            ],
        )
        state["players"]["a"]["penalty_count"] = 3
        state["players"]["b"]["penalty_count"] = 1
        state["players"]["c"]["penalty_count"] = 1
        _finish_game(state)
        view = InAGroveGame.get_public_view(state, "a")
        self.assertEqual([entry["player_id"] for entry in view["final_ranking"]], ["b", "c", "a"])

    def test_first_player_at_last_seat_does_not_skip_other_players(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "p1", "name": "P1", "seat": 0},
                {"player_id": "p2", "name": "P2", "seat": 1},
                {"player_id": "p3", "name": "P3", "seat": 2},
            ],
        )
        state["first_player"] = "p3"
        state["current_turn"] = "p3"
        state["phase"] = "bet"
        state["turn_context"] = {"viewed_indexes": [], "can_swap": False, "acted_count": 0}

        _, error = InAGroveGame.apply_action(state, "p3", {"type": "place_bet", "suspect_index": 0})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "peek")
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["turn_context"]["acted_count"], 1)


if __name__ == "__main__":
    unittest.main()
