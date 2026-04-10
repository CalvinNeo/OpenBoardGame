import unittest

from game import guandan


class GuandanMemoriesTests(unittest.TestCase):
    def _make_players(self):
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
            {"player_id": "p2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "p3", "name": "Carol", "seat": 2, "is_bot": False},
            {"player_id": "p4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]

    def _pick_cards(self, labels):
        deck = guandan._full_deck()
        picked = []
        for label in labels:
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    picked.append(deck.pop(idx))
                    break
            else:
                raise AssertionError(f"missing card {label}")
        return picked

    def _build_state_with_trick_history(self):
        state = guandan.GuandanGame.init_game({}, self._make_players())
        state["phase"] = "playing"
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "p1"
        state["current_trick"] = None
        state["pass_count"] = 0
        state["trick_plays"] = {}
        state["finish_order"] = []
        state["tribute"] = None

        p1_cards = self._pick_cards(["♠️4", "♣️10"])
        p2_cards = self._pick_cards(["♠️5", "♦️10"])
        p3_cards = self._pick_cards(["♠️6", "♥️10"])
        p4_cards = self._pick_cards(["♠️7", "♣️9"])

        state["players"]["p1"]["hand"] = p1_cards
        state["players"]["p2"]["hand"] = p2_cards
        state["players"]["p3"]["hand"] = p3_cards
        state["players"]["p4"]["hand"] = p4_cards
        state["round_memories"] = []
        guandan._start_round_memory(state)

        for player_id, card in (("p1", p1_cards[0]), ("p2", p2_cards[0]), ("p3", p3_cards[0]), ("p4", p4_cards[0])):
            _, error = guandan.GuandanGame.apply_action(state, player_id, {"type": "play", "card_ids": [card["id"]]})
            self.assertIsNone(error)
        for player_id in ("p1", "p2", "p3"):
            _, error = guandan.GuandanGame.apply_action(state, player_id, {"type": "pass"})
            self.assertIsNone(error)
        return state

    def test_round_memory_tracks_plays_and_passes(self):
        state = self._build_state_with_trick_history()
        round_entry = state["round_memories"][-1]
        self.assertEqual(round_entry["round_number"], 1)
        self.assertEqual(len(round_entry["tricks"]), 1)

        trick = round_entry["tricks"][0]
        self.assertEqual(trick["leader_id"], "p1")
        self.assertEqual(trick["winner_id"], "p4")
        self.assertEqual(trick["status"], "completed")
        self.assertEqual([action["type"] for action in trick["actions"]], ["play", "play", "play", "play", "pass", "pass", "pass"])
        self.assertEqual(trick["actions"][0]["cards"][0]["label"], "♠️4")
        self.assertEqual(state["current_turn"], "p4")

    def test_build_memories_html_uses_names_and_round_blocks(self):
        state = self._build_state_with_trick_history()
        html = guandan.build_memories_html(state, "room42")

        self.assertIn("Download Memories", html)
        self.assertIn("Round 1", html)
        self.assertIn("Opening Hands", html)
        self.assertIn("Trick 1", html)
        self.assertIn("Alice", html)
        self.assertIn("Bot 2", html)
        self.assertIn("Pass", html)
        self.assertIn("♠️4", html)
        self.assertIn("gd-mem-cascade", html)
        self.assertNotIn("Player ID", html)

    def test_guandan_class_exposes_download_memories(self):
        state = self._build_state_with_trick_history()
        html = guandan.GuandanGame.download_memories(state, "room42")
        self.assertIn("Download Memories", html)
        self.assertIn("Round 1", html)


if __name__ == "__main__":
    unittest.main()
