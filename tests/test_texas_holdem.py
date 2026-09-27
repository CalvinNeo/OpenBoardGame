import copy
import unittest

from game.texas_holdem import TexasHoldemGame


class TexasHoldemReadyTests(unittest.TestCase):
    def setUp(self):
        self.players = [
            {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": i == 2}
            for i in range(3)
        ]
        self.state = TexasHoldemGame.init_game({}, self.players)
        while self.state["phase"] != "hand_end":
            self.act(self.state["current_turn"], "fold")

    def act(self, player_id, action_type):
        events, error = TexasHoldemGame.apply_action(self.state, player_id, {"type": action_type})
        self.assertIsNone(error)
        return events

    def test_result_stays_until_every_player_is_ready(self):
        summary = copy.deepcopy(self.state["last_hand_summary"])
        dealer = self.state["dealer_index"]
        hole_cards = {pid: copy.deepcopy(data["hole"]) for pid, data in self.state["players"].items()}
        for pid in ["p0", "p2"]:
            self.act(pid, "next_hand")
            self.assertEqual(self.state["phase"], "hand_end")
            self.assertEqual(self.state["last_hand_summary"], summary)
            self.assertEqual(self.state["dealer_index"], dealer)
            self.assertEqual(self.state["hand_number"], 1)
            self.assertEqual({pid: data["hole"] for pid, data in self.state["players"].items()}, hole_cards)
        self.assertEqual(TexasHoldemGame.get_public_view(self.state, "p1")["next_hand_ready"], ["p0", "p2"])
        self.act("p1", "next_hand")
        self.assertEqual(self.state["phase"], "preflop")
        self.assertEqual(self.state["hand_number"], 2)
        self.assertEqual(self.state["dealer_index"], (dealer + 1) % 3)
        self.assertEqual(self.state["next_hand_ready"], [])
        self.assertIsNone(self.state["last_hand_summary"])

    def test_duplicate_ready_is_idempotent_and_not_legal_again(self):
        self.act("p0", "next_hand")
        self.assertNotIn("next_hand", TexasHoldemGame.get_legal_actions(self.state, "p0"))
        before = copy.deepcopy(self.state)
        self.assertEqual(self.act("p0", "next_hand"), [])
        self.assertEqual(self.state, before)

    def test_bot_readies_once_and_waits_for_humans(self):
        self.assertEqual(TexasHoldemGame.bot_move(self.state, "p2"), {"type": "next_hand"})
        self.act("p2", "next_hand")
        self.assertIsNone(TexasHoldemGame.bot_move(self.state, "p2"))
        self.assertEqual(self.state["phase"], "hand_end")

    def test_busted_player_can_review_and_sit_out(self):
        self.state["players"]["p0"]["chips"] = 0
        self.act("p1", "next_hand")
        self.act("p2", "next_hand")
        self.assertEqual(self.state["phase"], "hand_end")
        self.assertIn("rebuy", TexasHoldemGame.get_legal_actions(self.state, "p0"))
        self.act("p0", "next_hand")
        self.assertEqual(self.state["players"]["p0"]["status"], "out")
        self.assertEqual(self.state["hand_number"], 2)

    def test_rebuy_does_not_skip_review(self):
        self.state["players"]["p0"]["chips"] = 0
        self.state["players"]["p2"]["chips"] = 0
        self.assertNotIn("next_hand", TexasHoldemGame.get_legal_actions(self.state, "p1"))
        _, error = TexasHoldemGame.apply_action(self.state, "p1", {"type": "next_hand"})
        self.assertEqual(error, "need at least 2 players with chips")
        self.assertEqual(TexasHoldemGame.bot_move(self.state, "p2"), {"type": "rebuy"})
        self.act("p2", "rebuy")
        self.assertEqual(self.state["phase"], "hand_end")
        self.assertEqual(self.state["next_hand_ready"], [])
        self.assertEqual(self.state["players"]["p2"]["chips"], 1000)
        self.assertIn("next_hand", TexasHoldemGame.get_legal_actions(self.state, "p0"))

    def test_saved_states_without_readiness_and_spectators(self):
        self.state.pop("next_hand_ready")
        restored = TexasHoldemGame.deserialize(copy.deepcopy(TexasHoldemGame.serialize(self.state)))
        self.assertEqual(TexasHoldemGame.get_public_view(restored, "p0")["next_hand_ready"], [])
        self.state = restored
        self.act("p0", "next_hand")
        view = TexasHoldemGame.get_public_view(self.state, "spectator")
        self.assertEqual(view["legal_actions"], [])
        self.assertEqual(view["next_hand_ready"], ["p0"])
        _, error = TexasHoldemGame.apply_action(self.state, "spectator", {"type": "next_hand"})
        self.assertEqual(error, "unknown player")


if __name__ == "__main__":
    unittest.main()
