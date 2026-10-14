import copy
import unittest

from game import guandan


class GuandanRoundEndTests(unittest.TestCase):
    PLAYERS = [
        {"player_id": "p0", "name": "P0", "seat": 0},
        {"player_id": "p1", "name": "P1", "seat": 1},
        {"player_id": "p2", "name": "P2", "seat": 2},
        {"player_id": "p3", "name": "P3", "seat": 3},
    ]

    def make_state(self):
        state = guandan.GuandanGame.init_game({}, self.PLAYERS)
        deck = guandan._full_deck()

        def card(suit, rank):
            return next(c for c in deck if c["suit"] == suit and c["rank"] == rank)

        state["phase"] = "playing"
        state["current_turn"] = "p0"
        state["current_trick"] = None
        state["pass_count"] = 0
        state["trick_plays"] = {}
        state["finish_order"] = []
        state["players"]["p0"]["hand"] = [card("spades", 3)]
        state["players"]["p1"]["hand"] = [card("hearts", 5), card("clubs", 5)]
        state["players"]["p2"]["hand"] = [card("spades", 4)]
        state["players"]["p3"]["hand"] = [card("diamonds", 6)]
        for player in state["players"].values():
            player["finished"] = False
            player["finish_rank"] = None
        return state

    def test_second_teammate_finish_ends_double_down_without_playing_last_two(self):
        state = self.make_state()

        _, error = guandan.GuandanGame.apply_action(
            state, "p0", {"type": "play", "card_ids": [state["players"]["p0"]["hand"][0]["id"]]},
        )
        self.assertIsNone(error)
        _, error = guandan.GuandanGame.apply_action(state, "p1", {"type": "pass"})
        self.assertIsNone(error)
        _, error = guandan.GuandanGame.apply_action(
            state, "p2", {"type": "play", "card_ids": [state["players"]["p2"]["hand"][0]["id"]]},
        )

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["finish_order"], ["p0", "p2", "p1", "p3"])
        self.assertTrue(state["players"]["p1"]["finished"])
        self.assertTrue(state["players"]["p3"]["finished"])
        self.assertEqual(state["teams"]["A"]["level"], 5)
        self.assertEqual(state["round_memories"][-1]["status"], "completed")

    def test_restored_double_finish_is_settled_before_another_action(self):
        state = self.make_state()
        state["finish_order"] = ["p0", "p2"]
        for rank, player_id in enumerate(state["finish_order"], start=1):
            state["players"][player_id].update(finished=True, finish_rank=rank, hand=[])
        before = copy.deepcopy(state["players"]["p1"]["hand"])

        _, error = guandan.GuandanGame.apply_action(
            state, "p1", {"type": "play", "card_ids": [before[0]["id"]]},
        )

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["finish_order"], ["p0", "p2", "p1", "p3"])
        self.assertEqual(state["players"]["p1"]["hand"], before)

    def play_first_card(self, state, player_id):
        _, error = guandan.GuandanGame.apply_action(
            state, player_id,
            {"type": "play", "card_ids": [state["players"][player_id]["hand"][0]["id"]]},
        )
        self.assertIsNone(error)

    def pass_turn(self, state, player_id):
        _, error = guandan.GuandanGame.apply_action(state, player_id, {"type": "pass"})
        self.assertIsNone(error)

    def test_finished_leader_waits_for_all_three_players_before_teammate_inherits(self):
        state = self.make_state()
        self.play_first_card(state, "p0")
        self.pass_turn(state, "p1")
        self.pass_turn(state, "p2")

        self.assertEqual(state["current_turn"], "p3")
        self.assertEqual(state["current_trick"]["player_id"], "p0")
        self.assertEqual(state["pass_count"], 2)

        self.pass_turn(state, "p3")
        self.assertIsNone(state["current_trick"])
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["finish_order"], ["p0"])
        self.assertEqual(state["phase"], "playing")

    def test_last_responder_can_finish_and_both_remaining_players_may_contest(self):
        state = self.make_state()
        self.play_first_card(state, "p0")
        self.pass_turn(state, "p1")
        self.pass_turn(state, "p2")
        self.play_first_card(state, "p3")

        self.assertEqual(state["finish_order"], ["p0", "p3"])
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["current_trick"]["player_id"], "p3")
        self.assertEqual(state["pass_count"], 0)
        self.pass_turn(state, "p1")
        self.assertEqual(state["current_turn"], "p2")
        self.assertIsNotNone(state["current_trick"])
        self.pass_turn(state, "p2")
        self.assertIsNone(state["current_trick"])
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["phase"], "playing")

    def test_active_overtaker_waits_only_for_other_active_players(self):
        state = self.make_state()
        self.play_first_card(state, "p0")
        self.play_first_card(state, "p1")
        self.pass_turn(state, "p2")
        self.assertIsNotNone(state["current_trick"])
        self.pass_turn(state, "p3")

        self.assertIsNone(state["current_trick"])
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["finish_order"], ["p0"])


if __name__ == "__main__":
    unittest.main()
