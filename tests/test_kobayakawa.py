import json
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
        self.assertEqual(state["next_start_player"], "p1")
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round"], 1)
        for player_id in state["players"]:
            self.assertIsNone(KobayakawaGame.apply_action(
                state, player_id, {"type": "next_round", "round": 1})[1])
        self.assertEqual(state["start_player"], "p1")
        self.assertEqual(state["phase"], "action")
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["pot"], 2)

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

    def test_bonus_strength_is_not_tokens_and_settlement_waits_for_everyone(self):
        state = KobayakawaGame.init_game({"end_mode": "rounds"}, _players(3))
        state.update(phase="betting", start_player="p0", current_turn="p0", kobayakawa=3)
        state["players"]["p0"]["hand"] = 2
        state["players"]["p1"]["hand"] = 4
        state["players"]["p2"]["hand"] = 9
        for player_id, action in (("p0", "fight"), ("p1", "fight"), ("p2", "pass")):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": action})[1])
        summary = state["last_round_summary"]
        self.assertEqual(summary["winner"], "p0")
        self.assertEqual(summary["fighters"][0]["final_score"], 5)
        self.assertEqual(summary["tokens"][0], {
            "player_id": "p0", "before": 4, "paid": 1, "received": 2, "after": 5,
        })
        self.assertEqual(state["players"]["p0"]["tokens"], 5)
        self.assertEqual(state["phase"], "round_end")
        self.assertIsNone(state["current_turn"])
        self.assertEqual(state["round"], 1)
        self.assertEqual(KobayakawaGame.get_legal_actions(state, "spectator"), [])
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "fight"})[1], "only next_round allowed")
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "next_round", "round": 0})[1], "round changed")
        for player_id in ("p1", "p0"):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": "next_round", "round": 1})[1])
            self.assertEqual(state["phase"], "round_end")
            self.assertEqual(KobayakawaGame.get_legal_actions(state, player_id), [])
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "next_round", "round": 1})[1], "already ready")
        restored = KobayakawaGame.deserialize(json.loads(json.dumps(KobayakawaGame.serialize(state))))
        self.assertEqual(restored["round_ready"], ["p1", "p0"])
        self.assertIsNone(KobayakawaGame.apply_action(restored, "p2", {"type": "next_round", "round": 1})[1])
        self.assertEqual(restored["phase"], "action")
        self.assertEqual(restored["round"], 2)
        self.assertEqual(restored["round_ready"], [])

    def test_last_token_winner_receives_pot_before_bankruptcy_check(self):
        state = KobayakawaGame.init_game({"starting_tokens": 1}, _players(3))
        state.update(phase="betting", start_player="p0", current_turn="p0")
        for player_id, action in (("p0", "fight"), ("p1", "pass"), ("p2", "pass")):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": action})[1])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["players"]["p0"]["tokens"], 1)
        self.assertEqual(state["last_round_summary"]["tokens"][0], {
            "player_id": "p0", "before": 1, "paid": 1, "received": 1, "after": 1,
        })

    def test_legacy_state_settlement_includes_carried_pot_and_keeps_passed_hands_private(self):
        state = KobayakawaGame.init_game({"end_mode": "rounds"}, _players(3))
        state.pop("round_ready")
        state.update(phase="betting", start_player="p0", current_turn="p0", pot=3, kobayakawa=3)
        state["players"]["p0"].update(tokens=1, hand=2)
        state["players"]["p1"]["hand"] = 4
        state["players"]["p2"]["hand"] = 9
        for player_id, action in (("p0", "fight"), ("p1", "fight"), ("p2", "pass")):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": action})[1])
        summary = state["last_round_summary"]
        self.assertEqual(summary["tokens"][0], {
            "player_id": "p0", "before": 1, "paid": 1, "received": 5, "after": 5,
        })
        self.assertEqual(state["pot"], 0)
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["phase"], "round_end")
        for viewer_id in ("p0", "p1", "p2", "spectator"):
            view = KobayakawaGame.get_public_view(state, viewer_id)
            self.assertEqual(view["last_round_summary"], summary)
            self.assertNotIn("deck", view)
            self.assertTrue(all("hand" not in player and "drawn_card" not in player for player in view["players"]))
            self.assertEqual({fighter["player_id"] for fighter in summary["fighters"]}, {"p0", "p1"})

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
