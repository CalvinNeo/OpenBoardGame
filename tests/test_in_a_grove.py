import unittest
from unittest.mock import patch
from copy import deepcopy

from game.in_a_grove import (
    InAGroveGame,
    _build_round_summary,
    _build_tiles,
    _final_ranking,
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

    def test_two_player_setup_has_one_private_alibi_and_no_exchange(self):
        state = InAGroveGame.init_game(
            None,
            [
                {"player_id": "a", "name": "A", "seat": 0},
                {"player_id": "b", "name": "B", "seat": 1},
            ],
        )
        self.assertIsNotNone(state["public_alibi"])
        self.assertEqual(len(state["suspects"]), 3)
        self.assertEqual(len(state["removed_tiles"]), 0)
        for player in ("a", "b"):
            self.assertIsNotNone(state["players"][player]["own_tile"])
            self.assertIsNone(state["players"][player]["passed_tile"])
            self.assertEqual(len(InAGroveGame.get_public_view(state, player)["your_tiles"]), 1)

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
        state = {
            "turn_order": ["a", "b", "c", "d"], "first_player": "c",
            "players": {pid: {"penalty_count": count} for pid, count in [("a", 2), ("b", 0), ("c", 3), ("d", 2)]},
        }
        self.assertEqual(_pick_next_first_player(state), "d")

    def test_first_player_inspects_then_accuses_without_tampering(self):
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
        self.assertEqual(state["phase"], "bet")
        self.assertEqual(state["unseen_suspect_index"], 2)
        self.assertEqual(events[0]["type"], "in_a_grove:peek")

        self.assertEqual(InAGroveGame.get_legal_actions(state, "a"), ["place_bet"])
        _, error = InAGroveGame.apply_action(state, "a", {"type": "swap_with_victim", "suspect_index": 0})
        self.assertEqual(error, "invalid action")

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
        state["first_player"] = "a"
        state["players"]["a"]["penalty_count"] = 3
        state["players"]["b"]["penalty_count"] = 1
        state["players"]["c"]["penalty_count"] = 1
        _finish_game(state)
        view = InAGroveGame.get_public_view(state, "a")
        self.assertEqual([entry["player_id"] for entry in view["final_ranking"]], ["b", "c", "a"])
        self.assertEqual(view["winner_ids"], ["b"])

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


    def make_state(self, count=3):
        with patch("game.in_a_grove.random.shuffle", lambda tiles: None):
            state = InAGroveGame.init_game(None, [
                {"player_id": chr(97 + index), "name": chr(65 + index), "seat": index}
                for index in range(count)
            ])
        state["first_player"] = "a"
        state["current_turn"] = "a"
        return state

    def test_player_count_uses_all_numbers_and_only_required_x_tiles(self):
        for count in range(2, 6):
            with self.subTest(players=count):
                tiles = _build_tiles(count)
                self.assertEqual(sorted(tile["value"] for tile in tiles if tile["value"]), list(range(2, 9)))
                self.assertEqual(sum(tile["label"] == "X" for tile in tiles), max(0, count - 3))
                state = self.make_state(count)
                self.assertEqual(state["removed_tiles"], [])
                self.assertEqual(state["public_alibi"] is not None, count == 2)

    def test_multiplayer_alibis_are_passed_clockwise(self):
        state = self.make_state(4)
        for index, pid in enumerate(state["turn_order"]):
            previous = state["turn_order"][(index - 1) % 4]
            self.assertEqual(state["players"][pid]["passed_tile"], state["players"][previous]["own_tile"])

    def test_private_peek_does_not_reveal_to_other_players(self):
        state = self.make_state()
        InAGroveGame.apply_action(state, "a", {"type": "peek_suspects", "suspect_indexes": [0, 2]})
        own = InAGroveGame.get_public_view(state, "a")
        other = InAGroveGame.get_public_view(state, "b")
        self.assertIsNotNone(own["suspects"][0]["label"])
        self.assertIsNone(own["suspects"][1]["label"])
        self.assertTrue(all(suspect["label"] is None for suspect in other["suspects"]))
        self.assertEqual(other["unseen_suspect_index"], 1)

    def test_unseen_marker_is_independent_of_previous_accusation(self):
        state = self.make_state()
        InAGroveGame.apply_action(state, "a", {"type": "peek_suspects", "suspect_indexes": [0, 1]})
        InAGroveGame.apply_action(state, "a", {"type": "place_bet", "suspect_index": 0})
        self.assertEqual(state["unseen_suspect_index"], 2)
        self.assertEqual(state["blocked_suspect_index"], 0)
        _, error = InAGroveGame.apply_action(state, "b", {"type": "peek_suspects", "suspect_indexes": [0, 1]})
        self.assertEqual(error, "cannot inspect blocked suspect")
        _, error = InAGroveGame.apply_action(state, "b", {"type": "peek_suspects", "suspect_indexes": [1, 2]})
        self.assertIsNone(error)
        _, error = InAGroveGame.apply_action(state, "b", {"type": "place_bet", "suspect_index": 0})
        self.assertIsNone(error)
        self.assertEqual(state["suspects"][0]["stack"], ["a", "b"])
        self.assertEqual(state["unseen_suspect_index"], 2)

    def test_invalid_peeks_and_out_of_turn_moves_leave_state_unchanged(self):
        for indexes in ([0], [0, 0], [0, 3], [True, 2], [0.0, 2], ["0", 2]):
            state = self.make_state()
            before = deepcopy(state)
            _, error = InAGroveGame.apply_action(state, "a", {"type": "peek_suspects", "suspect_indexes": indexes})
            self.assertIsNotNone(error)
            self.assertEqual(state, before)
        _, error = InAGroveGame.apply_action(state, "b", {"type": "peek_suspects", "suspect_indexes": [0, 1]})
        self.assertEqual(error, "not your turn")

    def test_settlement_tracks_whole_stack_and_own_color_tiebreaker(self):
        state = self.make_state()
        state["phase"] = "bet"
        state["current_turn"] = "c"
        state["turn_context"]["acted_count"] = 2
        state["suspects"] = [
            {"tile": _tile("2", 2), "stack": ["a", "b"]},
            {"tile": _tile("8", 8), "stack": []},
            {"tile": _tile("4", 4), "stack": []},
        ]
        InAGroveGame.apply_action(state, "c", {"type": "place_bet", "suspect_index": 0})
        self.assertEqual(state["players"]["c"]["penalty_count"], 3)
        self.assertEqual(state["players"]["c"]["own_penalty_count"], 1)
        self.assertEqual(state["players"]["a"]["penalty_count"], 0)
        self.assertEqual(state["players"]["b"]["penalty_count"], 0)

    def test_five_penalties_ends_game_after_everyone_reviews(self):
        for previous_penalties in (3, 4):
            state = self.make_state(2)
            state["phase"] = "bet"
            state["current_turn"] = "b"
            state["turn_context"]["acted_count"] = 1
            state["players"]["a"]["penalty_count"] = previous_penalties
            state["suspects"] = [
                {"tile": _tile("2", 2), "stack": ["a"]},
                {"tile": _tile("8", 8), "stack": []},
                {"tile": _tile("4", 4), "stack": []},
            ]
            InAGroveGame.apply_action(state, "b", {"type": "place_bet", "suspect_index": 1})
            self.assertEqual(state["pending_game_over"], previous_penalties == 4)
            self.assertFalse(state["game_over"])
            self.assertEqual(state["phase"], "round_end")
            InAGroveGame.apply_action(state, "a", {"type": "next_round"})
            self.assertEqual(state["phase"], "round_end")
            InAGroveGame.apply_action(state, "b", {"type": "next_round"})
            self.assertEqual(state["game_over"], previous_penalties == 4)

    def test_next_first_uses_total_penalties_and_excludes_previous_first(self):
        state = self.make_state(4)
        for pid, total in [("a", 4), ("b", 1), ("c", 3), ("d", 2)]:
            state["players"][pid]["penalty_count"] = total
        self.assertEqual(_pick_next_first_player(state), "c")

    def test_two_player_first_alternates_even_when_previous_first_has_more_penalties(self):
        state = self.make_state(2)
        state["players"]["a"]["penalty_count"] = 4
        self.assertEqual(_pick_next_first_player(state), "b")
        state["first_player"] = "b"
        self.assertEqual(_pick_next_first_player(state), "a")

    def test_ranking_uses_own_color_then_clockwise_order(self):
        state = self.make_state(4)
        state["first_player"] = "c"
        for pdata in state["players"].values():
            pdata["penalty_count"] = 2
            pdata["own_penalty_count"] = 1
        state["players"]["b"]["own_penalty_count"] = 0
        self.assertEqual([entry["player_id"] for entry in _final_ranking(state)], ["b", "d", "a", "c"])

    def test_summary_never_leaks_hidden_victim_including_older_saves(self):
        state = self.make_state()
        summary = _build_round_summary(state, 0, {"a": 0, "b": 0, "c": 0})
        self.assertNotIn("victim_label", summary)
        summary["victim_label"] = "8"
        state["last_round_summary"] = summary
        self.assertNotIn("victim_label", InAGroveGame.get_public_view(state, "a")["last_round_summary"])
        self.assertEqual(summary["victim_label"], "8")  # Redaction does not mutate a saved state.

    def test_previous_summary_does_not_emit_another_reveal_mid_round(self):
        state = self.make_state()
        state["last_round_summary"] = {"round": 0}
        InAGroveGame.apply_action(state, "a", {"type": "peek_suspects", "suspect_indexes": [0, 1]})
        events, error = InAGroveGame.apply_action(state, "a", {"type": "place_bet", "suspect_index": 0})
        self.assertIsNone(error)
        self.assertNotIn("in_a_grove:reveal", [event["type"] for event in events])

    def test_all_player_counts_complete_seven_rounds_with_correct_accusations(self):
        for count in range(2, 6):
            state = self.make_state(count)
            for round_number in range(1, 8):
                self.assertEqual(state["round"], round_number)
                murderer = _determine_murderer_index([suspect["tile"] for suspect in state["suspects"]])
                acted = []
                while state["phase"] != "round_end":
                    pid = state["current_turn"]
                    indexes = [index for index in range(3) if index != state["blocked_suspect_index"]][:2]
                    _, error = InAGroveGame.apply_action(state, pid, {"type": "peek_suspects", "suspect_indexes": indexes})
                    self.assertIsNone(error)
                    _, error = InAGroveGame.apply_action(state, pid, {"type": "place_bet", "suspect_index": murderer})
                    self.assertIsNone(error)
                    acted.append(pid)
                self.assertEqual(len(set(acted)), count)
                for pdata in state["players"].values():
                    self.assertEqual(pdata["penalty_count"], 0)
                    self.assertEqual(pdata["hand_count"], 7 - round_number)
                for pid in state["turn_order"]:
                    _, error = InAGroveGame.apply_action(state, pid, {"type": "next_round"})
                    self.assertIsNone(error)
            self.assertTrue(state["game_over"])
            self.assertEqual(len(state["winner_ids"]), 1)


if __name__ == "__main__":
    unittest.main()
