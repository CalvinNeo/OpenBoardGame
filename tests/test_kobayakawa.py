import json
import unittest

from game.kobayakawa import KobayakawaGame, _compute_showdown


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
    def prepare_betting(self, state):
        state.update(phase="betting", start_player="p0", current_turn="p0", betting_choices={}, bets={})

    def confirm_round(self, state):
        round_number = state["round"]
        for player_id in state["players"]:
            self.assertIsNone(KobayakawaGame.apply_action(
                state, player_id, {"type": "next_round", "round": round_number, "review_id": state["review_id"]})[1])

    def test_default_seven_rounds_award_all_eight_reserve_tokens(self):
        state = KobayakawaGame.init_game({}, _players(3))
        self.assertEqual(state["config"]["end_mode"], "rounds")
        self.assertEqual(state["reserve"], 8)
        self.assertEqual(state["pot"], 0)
        for round_number in range(1, 8):
            with self.subTest(round=round_number):
                self.assertEqual(state["round"], round_number)
                self.prepare_betting(state)
                view = KobayakawaGame.get_public_view(state, "p0")
                self.assertEqual(view["fight_cost"], 2 if round_number == 7 else 1)
                self.assertEqual(view["round_reward"], 2 if round_number == 7 else 1)
                for player_id, action in (("p0", "fight"), ("p1", "pass"), ("p2", "pass")):
                    self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": action})[1])
                summary = state["last_round_summary"]
                self.assertEqual(summary["reserve_reward"], 2 if round_number == 7 else 1)
                self.assertEqual(summary["pot"], 2 if round_number == 7 else 1)
                self.assertEqual(summary["reserve_before"] - summary["reserve_after"], summary["reserve_reward"])
                self.assertEqual(sum(player["tokens"] for player in state["players"].values()) + state["pot"] + state["reserve"], 20)
                if round_number < 7:
                    self.assertFalse(state["game_over"])
                    self.confirm_round(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["reserve"], 0)
        self.assertEqual(state["players"]["p0"]["tokens"], 12)
        self.assertEqual(state["winner"], ["p0"])

    def test_final_round_all_in_records_actual_stakes_and_awards_once(self):
        state = KobayakawaGame.init_game({}, _players(3))
        self.prepare_betting(state)
        state.update(round=7, reserve=2, kobayakawa=3)
        state["players"]["p0"].update(tokens=1, hand=2)
        state["players"]["p1"].update(tokens=4, hand=4)
        state["players"]["p2"].update(tokens=4, hand=9)
        self.assertEqual(KobayakawaGame.get_public_view(state, "p0")["fight_cost"], 1)
        self.assertIsNone(KobayakawaGame.apply_action(state, "p0", {"type": "fight"})[1])
        self.assertEqual(state["pot"], 1)
        self.assertFalse(KobayakawaGame.get_public_view(state, "p1")["players"][0]["eliminated"])
        self.assertEqual(KobayakawaGame.get_public_view(state, "p1")["fight_cost"], 2)
        self.assertIsNone(KobayakawaGame.apply_action(state, "p1", {"type": "fight"})[1])
        self.assertEqual(state["pot"], 3)
        restored = KobayakawaGame.deserialize(json.loads(json.dumps(state)))
        self.assertIsNone(KobayakawaGame.apply_action(restored, "p2", {"type": "pass"})[1])
        self.assertTrue(restored["game_over"])
        self.assertEqual(restored["players"]["p0"]["tokens"], 5)
        self.assertEqual(restored["last_round_summary"]["tokens"][0], {
            "player_id": "p0", "before": 1, "paid": 1, "received": 3, "reward": 2, "after": 5,
        })
        self.assertEqual(restored["last_round_summary"]["tokens"][1]["paid"], 2)
        snapshot = json.dumps(restored, sort_keys=True)
        self.assertEqual(KobayakawaGame.apply_action(restored, "p2", {"type": "pass"})[1], "game over")
        self.assertEqual(json.dumps(restored, sort_keys=True), snapshot)

    def test_zero_token_loser_is_skipped_but_can_review(self):
        state = KobayakawaGame.init_game({}, _players(3))
        self.prepare_betting(state)
        state["kobayakawa"] = 3
        state["players"]["p0"].update(tokens=1, hand=4)
        state["players"]["p1"].update(tokens=4, hand=2)
        for player_id, action in (("p0", "fight"), ("p1", "fight"), ("p2", "pass")):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": action})[1])
        self.assertFalse(state["game_over"])
        self.assertEqual(KobayakawaGame.get_legal_actions(state, "p0"), ["next_round"])
        self.confirm_round(state)
        self.assertEqual(state["turn_order"], ["p1", "p2"])
        self.assertEqual(state["start_player"], "p1")
        self.assertIsNone(state["players"]["p0"]["hand"])
        self.assertEqual(KobayakawaGame.get_legal_actions(state, "p0"), [])
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "draw_card"})[1], "player eliminated")
        self.assertIsNone(KobayakawaGame.apply_action(state, "p1", {"type": "replace_kobayakawa"})[1])
        self.assertIsNone(KobayakawaGame.apply_action(state, "p2", {"type": "replace_kobayakawa"})[1])
        self.assertEqual(state["phase"], "betting")
        self.assertEqual(state["current_turn"], "p1")

    def test_tied_strength_uses_rotated_order_not_raw_hand_or_bet_insertion(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state.update(start_player="p1", kobayakawa=12)
        state["players"]["p0"]["hand"] = 15
        state["players"]["p1"]["hand"] = 3
        self.assertEqual(_compute_showdown(state, ["p0", "p1"])[0], "p1")

    def test_old_save_gets_only_remaining_reserve_without_rewriting_history(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state.update(round=4, phase="betting", betting_choices={"p0": "fight"}, pot=1)
        state.pop("reserve")
        state.pop("bets")
        previous_tokens = {pid: player["tokens"] for pid, player in state["players"].items()}
        restored = KobayakawaGame.deserialize(json.loads(json.dumps(state)))
        self.assertEqual(restored["reserve"], 5)
        self.assertEqual(restored["bets"], {"p0": 1})
        self.assertEqual({pid: player["tokens"] for pid, player in restored["players"].items()}, previous_tokens)
        self.assertEqual(KobayakawaGame.deserialize(restored)["reserve"], 5)
        state.update(phase="round_end", last_round_summary={"winner": "p0"})
        self.assertEqual(KobayakawaGame.deserialize(state)["reserve"], 4)

    def test_old_save_skips_an_eliminated_current_player(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state.pop("reserve")
        state.update(current_turn="p0", start_player="p0")
        state["players"]["p0"]["tokens"] = 0
        restored = KobayakawaGame.deserialize(json.loads(json.dumps(state)))
        self.assertEqual(restored["turn_order"], ["p1", "p2"])
        self.assertEqual(restored["current_turn"], "p1")
        self.assertEqual(restored["start_player"], "p1")
        self.assertFalse(restored["game_over"])

    def test_all_pass_redeal_rejects_previous_review_confirmation(self):
        state = KobayakawaGame.init_game({}, _players(3))
        for attempt in range(2):
            self.prepare_betting(state)
            for player_id in ("p0", "p1", "p2"):
                self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": "pass"})[1])
            self.assertEqual(state["round"], 1)
            self.assertEqual(state["reserve"], 8)
            self.assertEqual(state["review_id"], attempt + 1)
            if attempt == 0:
                self.confirm_round(state)
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {
            "type": "next_round", "round": 1, "review_id": 1,
        })[1], "review changed")
        self.assertEqual(state["round_ready"], [])

    def test_legacy_betting_skips_broke_undecided_seat_but_keeps_all_in_fighter(self):
        state = KobayakawaGame.init_game({}, _players(3))
        state.pop("reserve")
        state.pop("bets")
        state.update(phase="betting", current_turn="p2", start_player="p0", pot=1,
                     betting_choices={"p0": "fight", "p1": "pass"})
        state["players"]["p0"]["tokens"] = 0
        state["players"]["p2"]["tokens"] = 0
        restored = KobayakawaGame.deserialize(json.loads(json.dumps(state)))
        self.assertEqual(restored["phase"], "round_end")
        self.assertFalse(restored["game_over"])
        self.assertEqual(restored["last_round_summary"]["winner"], "p0")
        self.assertEqual(restored["players"]["p0"]["tokens"], 2)
        self.assertEqual(restored["reserve"], 7)

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
                state, player_id, {"type": "next_round", "round": 1, "review_id": state["review_id"]})[1])
        self.assertEqual(state["start_player"], "p1")
        self.assertEqual(state["phase"], "action")
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["pot"], 2)
        self.assertEqual(state["reserve"], 8)

    def test_showdown_tiebreaker_uses_round_order(self):
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
        self.assertEqual(state["players"]["p0"]["tokens"], 6)
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
            "player_id": "p0", "before": 4, "paid": 1, "received": 2, "reward": 1, "after": 6,
        })
        self.assertEqual(state["players"]["p0"]["tokens"], 6)
        self.assertEqual(state["phase"], "round_end")
        self.assertIsNone(state["current_turn"])
        self.assertEqual(state["round"], 1)
        self.assertEqual(KobayakawaGame.get_legal_actions(state, "spectator"), [])
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "fight"})[1], "only next_round allowed")
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "next_round", "round": 0})[1], "round changed")
        for player_id in ("p1", "p0"):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": "next_round", "round": 1, "review_id": state["review_id"]})[1])
            self.assertEqual(state["phase"], "round_end")
            self.assertEqual(KobayakawaGame.get_legal_actions(state, player_id), [])
        self.assertEqual(KobayakawaGame.apply_action(state, "p0", {"type": "next_round", "round": 1, "review_id": state["review_id"]})[1], "already ready")
        restored = KobayakawaGame.deserialize(json.loads(json.dumps(KobayakawaGame.serialize(state))))
        self.assertEqual(restored["round_ready"], ["p1", "p0"])
        self.assertIsNone(KobayakawaGame.apply_action(restored, "p2", {"type": "next_round", "round": 1, "review_id": restored["review_id"]})[1])
        self.assertEqual(restored["phase"], "action")
        self.assertEqual(restored["round"], 2)
        self.assertEqual(restored["round_ready"], [])

    def test_last_token_winner_receives_pot_before_bankruptcy_check(self):
        state = KobayakawaGame.init_game({"starting_tokens": 1}, _players(3))
        state.update(phase="betting", start_player="p0", current_turn="p0")
        for player_id, action in (("p0", "fight"), ("p1", "pass"), ("p2", "pass")):
            self.assertIsNone(KobayakawaGame.apply_action(state, player_id, {"type": action})[1])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["players"]["p0"]["tokens"], 2)
        self.assertEqual(state["last_round_summary"]["tokens"][0], {
            "player_id": "p0", "before": 1, "paid": 1, "received": 1, "reward": 1, "after": 2,
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
            "player_id": "p0", "before": 1, "paid": 1, "received": 5, "reward": 1, "after": 6,
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
