import unittest

from game.compress import CompressGame


def players(count=2):
    return [
        {"player_id": f"p{index}", "name": f"Player {index}", "seat": index, "is_bot": False}
        for index in range(count)
    ]


class CompressGameTests(unittest.TestCase):
    def setUp(self):
        self.state = CompressGame.init_game({}, players())
        self.state["sequence"] = [0, 1, 1]

    def _write_and_hide(self, player_id="p0"):
        for slot, bit in enumerate(self.state["sequence"]):
            events, error = CompressGame.apply_action(
                self.state, player_id, {"type": "write_note", "slot": slot, "bit": bit}
            )
            self.assertIsNone(error)
            self.assertTrue(events)
        events, error = CompressGame.apply_action(self.state, player_id, {"type": "hide_sequence"})
        self.assertIsNone(error)
        self.assertTrue(events)

    def test_private_notes_and_sequence_visibility(self):
        own = CompressGame.get_public_view(self.state, "p0")
        other = CompressGame.get_public_view(self.state, "p1")
        self.assertEqual(len(next(p for p in own["players"] if p["player_id"] == "p0")["notes"]), 8)
        self.assertIsNone(next(p for p in other["players"] if p["player_id"] == "p0").get("notes"))
        self.assertEqual(own["memorize_sequence"], [0, 1, 1])
        self.assertIsNone(other["memorize_sequence"])

    def test_correct_answer_scores_and_requires_next_round_ready(self):
        self._write_and_hide()
        events, error = CompressGame.apply_action(self.state, "p0", {"type": "answer", "bits": "011"})
        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertEqual(self.state["phase"], "round_result")
        self.assertEqual(self.state["players"]["p0"]["score"], 3)
        self.assertEqual(self.state["round_summary"]["expected"], "011")
        _, error = CompressGame.apply_action(self.state, "p1", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "round_result")
        _, error = CompressGame.apply_action(self.state, "p0", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "memorize")
        self.assertEqual(len(self.state["sequence"]), 4)

    def test_wrong_answer_adds_error_and_can_eliminate(self):
        self._write_and_hide()
        _, error = CompressGame.apply_action(self.state, "p0", {"type": "answer", "bits": "000"})
        self.assertIsNone(error)
        self.assertEqual(self.state["players"]["p0"]["errors"], 1)
        self.assertFalse(self.state["players"]["p0"]["eliminated"])

        self.state["phase"] = "answering"
        self.state["current_turn"] = "p0"
        self.state["players"]["p0"]["errors"] = 1
        _, error = CompressGame.apply_action(self.state, "p0", {"type": "answer", "bits": "000"})
        self.assertIsNone(error)
        self.assertTrue(self.state["players"]["p0"]["eliminated"])
        self.assertEqual(self.state["phase"], "game_over")
        self.assertEqual(self.state["winner_ids"], ["p1"])

    def test_serialization_is_independent(self):
        restored = CompressGame.deserialize(CompressGame.serialize(self.state))
        restored["players"]["p0"]["notes"][0]["recorded_bit"] = 1
        self.assertIsNone(self.state["players"]["p0"]["notes"][0]["recorded_bit"])


if __name__ == "__main__":
    unittest.main()
