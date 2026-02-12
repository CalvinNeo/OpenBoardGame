import unittest

from game.kobayakawa import KobayakawaGame


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


class KobayakawaGameTests(unittest.TestCase):
    def test_replace_moves_old_kobayakawa_to_discard(self):
        state = KobayakawaGame.init_game({}, _players(3))
        current = state["current_turn"]
        state["kobayakawa"] = 10
        state["deck"] = [1, 2, 3]
        state["discard_pile"] = []
        state["players"][current]["drawn_card"] = None

        _, error = KobayakawaGame.apply_action(state, current, {"type": "replace_kobayakawa"})

        self.assertIsNone(error)
        self.assertEqual(state["kobayakawa"], 3)
        self.assertIn(10, state["discard_pile"])

    def test_all_pass_carries_pot_and_rotates_start_player(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state["phase"] = "betting"
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["betting_choices"] = {}
        state["pot"] = 2
        for pid in state["players"]:
            state["players"][pid]["tokens"] = 4

        KobayakawaGame.apply_action(state, "p0", {"type": "pass"})
        KobayakawaGame.apply_action(state, "p1", {"type": "pass"})
        KobayakawaGame.apply_action(state, "p2", {"type": "pass"})

        self.assertEqual(state["last_round_summary"]["result"], "all_pass")
        self.assertEqual(state["pot"], 2)
        self.assertEqual(state["start_player"], "p1")
        self.assertEqual(state["phase"], "action")
        self.assertEqual(state["round"], 2)

    def test_showdown_tiebreaker_uses_raw_hand(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state["phase"] = "betting"
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["betting_choices"] = {}
        state["pot"] = 0
        state["kobayakawa"] = 12
        state["players"]["p0"]["hand"] = 15
        state["players"]["p1"]["hand"] = 3
        state["players"]["p2"]["hand"] = 8
        for pid in state["players"]:
            state["players"][pid]["tokens"] = 4

        KobayakawaGame.apply_action(state, "p0", {"type": "fight"})
        KobayakawaGame.apply_action(state, "p1", {"type": "fight"})
        KobayakawaGame.apply_action(state, "p2", {"type": "pass"})

        summary = state["last_round_summary"]
        self.assertEqual(summary["result"], "showdown")
        self.assertEqual(summary["winner"], "p0")
        self.assertEqual(state["players"]["p0"]["tokens"], 5)
        self.assertEqual(state["start_player"], "p0")

    def test_bankrupt_mode_ends_game_when_player_hits_zero(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state["config"]["end_mode"] = "bankrupt"
        state["phase"] = "betting"
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["betting_choices"] = {}
        state["pot"] = 0
        state["kobayakawa"] = 5
        state["players"]["p0"]["hand"] = 15
        state["players"]["p1"]["hand"] = 2
        state["players"]["p2"]["hand"] = 10
        state["players"]["p0"]["tokens"] = 1
        state["players"]["p1"]["tokens"] = 1
        state["players"]["p2"]["tokens"] = 5

        KobayakawaGame.apply_action(state, "p0", {"type": "fight"})
        KobayakawaGame.apply_action(state, "p1", {"type": "fight"})
        KobayakawaGame.apply_action(state, "p2", {"type": "pass"})

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["winner"], ["p2"])
