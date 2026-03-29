import unittest

from game.scout import ScoutGame, _build_active_set


def _players(count: int):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": False,
        }
        for index in range(count)
    ]


def _card(low: int, high: int, face_up: int = 0):
    return {
        "id": f"{low}-{high}",
        "values": [low, high],
        "face_up": face_up,
    }


class ScoutGameTests(unittest.TestCase):
    def test_round_one_start_player_holds_one_two(self):
        state = ScoutGame.init_game({"seed": "start-player"}, _players(4))

        start_player = state["start_player"]
        self.assertIsNotNone(start_player)
        self.assertTrue(any(card["id"] == "1-2" for card in state["players"][start_player]["pending_hand"]))

    def test_ready_hand_flip_reverses_order_and_faces(self):
        state = ScoutGame.init_game({"seed": "flip"}, _players(2))
        state["players"]["p1"]["pending_hand"] = [
            _card(1, 7, 0),
            _card(2, 9, 1),
        ]

        events, error = ScoutGame.apply_action(state, "p1", {"type": "ready_hand", "flip": True})
        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "scout:ready_hand")
        hand = state["players"]["p1"]["hand"]
        self.assertEqual([card["id"] for card in hand], ["2-9", "1-7"])
        self.assertEqual([card["face_up"] for card in hand], [0, 1])

    def test_scout_and_show_keeps_turn_then_show_ends_round_on_empty_hand(self):
        state = ScoutGame.init_game({"seed": "scout-show"}, _players(3))
        state["phase"] = "playing"
        state["current_turn"] = "p2"
        state["start_player"] = "p1"
        state["players"]["p1"]["hand_ready"] = True
        state["players"]["p2"]["hand_ready"] = True
        state["players"]["p3"]["hand_ready"] = True
        state["players"]["p1"]["hand"] = [_card(1, 4, 0)]
        state["players"]["p2"]["hand"] = [_card(4, 8, 0), _card(1, 6, 1)]
        state["players"]["p3"]["hand"] = [_card(1, 3, 0)]
        state["active_set"] = _build_active_set("p1", [_card(2, 5, 1), _card(3, 5, 1)])

        events, error = ScoutGame.apply_action(
            state,
            "p2",
            {
                "type": "scout_and_show",
                "take_side": "left",
                "insert_index": 1,
                "insert_face": "b",
            },
        )

        self.assertIsNone(error)
        self.assertEqual(events[-1]["type"], "scout:scout_and_show")
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["pending_scout_and_show_player"], "p2")
        self.assertFalse(state["players"]["p2"]["scout_and_show_available"])
        self.assertEqual([card["id"] for card in state["players"]["p2"]["hand"]], ["4-8", "2-5", "1-6"])

        events, error = ScoutGame.apply_action(
            state,
            "p2",
            {
                "type": "show",
                "start_index": 0,
                "end_index": 2,
            },
        )

        self.assertIsNone(error)
        self.assertEqual(events[-1]["type"], "scout:show")
        self.assertEqual(state["last_round_summary"]["winner"], "p2")
        self.assertEqual(state["last_round_summary"]["reason"], "empty_hand")
        p1_summary = next(row for row in state["last_round_summary"]["players"] if row["player_id"] == "p1")
        p2_summary = next(row for row in state["last_round_summary"]["players"] if row["player_id"] == "p2")
        self.assertEqual(p1_summary["scout_points"], 1)
        self.assertEqual(p2_summary["captured_count"], 1)
        self.assertEqual(state["players"]["p2"]["score"], 1)
        self.assertEqual(state["phase"], "choose_orientation")
        self.assertEqual(state["round"], 2)

    def test_scout_and_show_can_finish_turn_without_show(self):
        state = ScoutGame.init_game({"seed": "scout-finish"}, _players(3))
        state["phase"] = "playing"
        state["current_turn"] = "p2"
        state["start_player"] = "p1"
        for pid in ("p1", "p2", "p3"):
            state["players"][pid]["hand_ready"] = True
        state["players"]["p1"]["hand"] = [_card(1, 4, 0)]
        state["players"]["p2"]["hand"] = [_card(4, 8, 0), _card(1, 6, 1)]
        state["players"]["p3"]["hand"] = [_card(1, 3, 0)]
        state["active_set"] = _build_active_set("p1", [_card(2, 5, 1), _card(3, 5, 1)])

        _, error = ScoutGame.apply_action(
            state,
            "p2",
            {
                "type": "scout_and_show",
                "take_side": "left",
                "insert_index": 1,
                "insert_face": "b",
            },
        )

        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["pending_scout_and_show_player"], "p2")

        events, error = ScoutGame.apply_action(state, "p2", {"type": "finish_scout_and_show"})

        self.assertIsNone(error)
        self.assertEqual(events[-1]["type"], "scout:finish_scout_and_show")
        self.assertIsNone(state["pending_scout_and_show_player"])
        self.assertEqual(state["current_turn"], "p3")
        self.assertEqual(state["active_set"]["owner_player_id"], "p1")
        self.assertEqual(len(state["active_set"]["cards"]), 1)

    def test_base_round_ends_when_turn_returns_to_active_owner(self):
        state = ScoutGame.init_game({"seed": "owner-return"}, _players(3))
        state["phase"] = "playing"
        state["current_turn"] = "p2"
        state["start_player"] = "p1"
        for pid in ("p1", "p2", "p3"):
            state["players"][pid]["hand_ready"] = True
        state["players"]["p1"]["hand"] = [_card(1, 4, 0)]
        state["players"]["p2"]["hand"] = [_card(1, 2, 0)]
        state["players"]["p3"]["hand"] = [_card(1, 3, 0)]
        state["active_set"] = _build_active_set(
            "p1",
            [_card(1, 8, 1), _card(2, 8, 1), _card(3, 8, 1)],
        )

        _, error = ScoutGame.apply_action(
            state,
            "p2",
            {"type": "scout", "take_side": "left", "insert_index": 0, "insert_face": "a"},
        )
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p3")
        self.assertEqual(len(state["active_set"]["cards"]), 2)

        _, error = ScoutGame.apply_action(
            state,
            "p3",
            {"type": "scout", "take_side": "left", "insert_index": 0, "insert_face": "a"},
        )
        self.assertIsNone(error)
        self.assertEqual(state["last_round_summary"]["winner"], "p1")
        self.assertEqual(state["last_round_summary"]["reason"], "returned_to_owner")
        self.assertEqual(state["phase"], "choose_orientation")
        self.assertEqual(state["round"], 2)

    def test_duel_round_ends_when_last_scout_token_is_spent_without_show(self):
        state = ScoutGame.init_game({"seed": "duel-end"}, _players(2))
        state["phase"] = "playing"
        state["current_turn"] = "p1"
        state["start_player"] = "p1"
        for pid in ("p1", "p2"):
            state["players"][pid]["hand_ready"] = True
        state["players"]["p1"]["hand"] = [_card(1, 4, 0), _card(3, 5, 0)]
        state["players"]["p1"]["scout_tokens_left"] = 1
        state["players"]["p2"]["hand"] = [_card(2, 4, 0)]
        state["active_set"] = _build_active_set("p2", [_card(1, 9, 1), _card(2, 9, 1)])

        _, error = ScoutGame.apply_action(
            state,
            "p1",
            {"type": "scout", "take_side": "left", "insert_index": 1, "insert_face": "b"},
        )

        self.assertIsNone(error)
        self.assertEqual(state["last_round_summary"]["winner"], "p1")
        self.assertEqual(state["last_round_summary"]["reason"], "no_tokens_no_show")
        self.assertEqual(state["phase"], "choose_orientation")
        self.assertEqual(state["round"], 2)


if __name__ == "__main__":
    unittest.main()
