import copy
import json
import unittest
from unittest.mock import patch

from game.abraca_what import AbracaWhatGame as Game, CARD_TO_SPELL, _finish_round


def make_state(target=8, bots=()):
    with patch("game.abraca_what._build_deck", return_value=list(range(len(CARD_TO_SPELL)))):
        return Game.init_game({"target_score": target}, [
            {"player_id": f"p{index}", "name": name, "seat": index, "is_bot": index in bots}
            for index, name in enumerate(("Alex", "Nova", "Sage"))
        ])


class AbracaWhatReviewTests(unittest.TestCase):
    def act(self, state, player_id, **action):
        self.assertIsNone(Game.apply_action(state, player_id, action)[1])

    def test_guesses_record_chain_failures_dice_and_turns(self):
        state = make_state()
        state["players"]["p0"]["hand"] = [3, 4, 10]
        for _ in range(2):
            self.act(state, "p0", type="cast_spell", spell_type=2)
            with patch("game.abraca_what.random.randint", return_value=3):
                self.act(state, "p0", type="roll_dice")
        before = copy.deepcopy(state["activity"])
        self.assertIsNotNone(Game.apply_action(state, "p0", {"type": "cast_spell", "spell_type": 1})[1])
        self.assertEqual(state["activity"], before)
        self.act(state, "p0", type="cast_spell", spell_type=7)
        self.act(state, "p0", type="end_turn")
        self.act(state, "p1", type="cast_spell", spell_type=7)
        self.assertEqual([entry["success"] for entry in state["activity"]], [True, True, False, False])
        self.assertEqual([entry["dice"] for entry in state["activity"]], [3, 3, None, None])
        self.assertEqual([entry["turn"] for entry in state["activity"]], [1, 1, 1, 2])
        view = Game.get_public_view(state, "p0")
        self.assertEqual(view["activity"], state["activity"])
        self.assertTrue(all(card == {"hidden": True} for card in view["players"][0]["hand"]))
        self.assertNotIn("secret_cards", view["players"][1])

    def test_failed_dragon_roll_updates_one_guess(self):
        state = make_state()
        self.act(state, "p0", type="cast_spell", spell_type=0)
        with patch("game.abraca_what.random.randint", return_value=2):
            self.act(state, "p0", type="roll_dice")
        self.assertEqual(state["activity"], [{
            "player_id": "p0", "spell_type": 0, "success": False, "dice": 2, "turn": 1,
        }])

    def test_round_waits_for_every_player_and_keeps_revealed_snapshot(self):
        state = make_state()
        self.act(state, "p0", type="cast_spell", spell_type=3)
        self.act(state, "p0", type="take_secret")
        _finish_round(state, "empty_hand", "p0")
        snapshot = copy.deepcopy(state["round_result"])
        self.assertEqual(snapshot["players"]["p0"]["base"], 3)
        self.assertEqual(snapshot["players"]["p0"]["secrets"], 1)
        self.assertEqual(snapshot["players"]["p0"]["total"], 4)
        self.assertEqual(len(snapshot["activity"]), 1)
        self.assertEqual(Game._legal_actions(state, "spectator"), [])
        for player_id in ("p0", "p1"):
            self.act(state, player_id, type="start_next_round")
            self.assertEqual(state["round"], 1)
            self.assertEqual(Game._legal_actions(state, player_id), [])
            self.assertIsNotNone(Game.apply_action(state, player_id, {"type": "start_next_round"})[1])
            self.assertTrue(all("hidden" not in card for card in Game.get_public_view(state, player_id)["players"][0]["hand"]))
        self.act(state, "p2", type="start_next_round")
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["activity"], [])
        self.assertEqual(state["round_history"], [snapshot])
        self.assertEqual(state["next_round_ready"], [])
        self.assertTrue(all(card == {"hidden": True} for card in Game.get_public_view(state, "p0")["players"][0]["hand"]))

    def test_scoring_details_cover_kill_self_death_and_secret_survival(self):
        for reason, expected in (("kill", (4, 0, 2)), ("self_death", (0, 2, 2)), ("empty_hand", (4, 1, 1))):
            with self.subTest(reason=reason):
                state = make_state()
                for player in state["players"].values():
                    player["secret_cards"] = [0]
                if reason == "kill":
                    state["players"]["p1"]["hp"] = 0
                if reason == "self_death":
                    state["players"]["p0"]["hp"] = 0
                _finish_round(state, reason, "p0")
                for index, gain in enumerate(expected):
                    score = state["round_result"]["players"][f"p{index}"]
                    self.assertEqual(score["total"], gain)
                    self.assertEqual(score["base"] + score["secrets"], gain)
                    self.assertEqual(score["score"], gain)

    def test_bots_confirm_automatically_and_save_retains_readiness(self):
        state = make_state(bots=(2,))
        _finish_round(state, "empty_hand", "p0")
        self.assertEqual(state["next_round_ready"], ["p2"])
        self.act(state, "p0", type="start_next_round")
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(restored["next_round_ready"], state["next_round_ready"])
        self.assertEqual(restored["round_history"], state["round_history"])
        self.act(restored, "p1", type="start_next_round")
        self.assertEqual(restored["round"], 2)

    def test_final_results_need_all_confirmations_before_restart(self):
        state = make_state(target=3, bots=(2,))
        _finish_round(state, "empty_hand", "p0")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["result_ready"], ["p2"])
        snapshot = copy.deepcopy(state["round_result"])
        self.act(state, "p0", type="play_again")
        self.assertFalse(state["results_confirmed"])
        self.assertIsNotNone(Game.apply_action(state, "p0", {"type": "play_again"})[1])
        self.assertEqual(state["round_result"], snapshot)
        state = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.act(state, "p1", type="play_again")
        self.assertTrue(state["results_confirmed"])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p0"])
        self.act(state, "p1", type="play_again")
        self.assertFalse(state["game_over"])
        self.assertEqual(state["config"]["target_score"], 3)
        self.assertEqual(state["round"], 1)
        self.assertNotIn("round_history", state)
        self.assertTrue(all(player["score"] == 0 for player in state["players"].values()))

    def test_old_saves_without_history_or_ready_fields_can_continue(self):
        for final in (False, True):
            with self.subTest(final=final):
                state = make_state(target=3 if final else 8, bots=(2,))
                _finish_round(state, "empty_hand", "p0")
                for key in ("activity", "round_history", "next_round_ready", "result_ready", "results_confirmed"):
                    state.pop(key, None)
                action_type = "play_again" if final else "start_next_round"
                self.act(state, "p0", type=action_type)
                self.assertEqual(state["round"], 1)
                self.act(state, "p1", type=action_type)
                self.assertEqual(state["results_confirmed"], final)
                if not final:
                    self.assertEqual(state["round"], 2)

    def test_final_winner_uses_round_gains_among_target_candidates(self):
        state = make_state()
        state["players"]["p0"]["score"] = 5
        state["players"]["p1"]["score"] = 12
        state["players"]["p2"]["hp"] = 0
        _finish_round(state, "kill", "p0", ["p2"])
        self.assertEqual(state["winner"], ["p0"])
        self.assertEqual(state["round_result"]["players"]["p0"]["score"], 8)
        self.assertEqual(state["round_result"]["players"]["p1"]["score"], 13)

    def test_shared_final_winners_and_revealed_hands_survive_save_load(self):
        state = make_state()
        state["players"]["p0"]["score"] = 7
        state["players"]["p1"]["score"] = 7
        state["players"]["p2"]["hp"] = 0
        _finish_round(state, "self_death", "p2", ["p2"])
        self.assertEqual(state["winner"], ["p0", "p1"])
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        for player_id in state["players"]:
            view = Game.get_public_view(restored, player_id)
            self.assertTrue(view["game_over"])
            self.assertEqual(view["winner"], ["p0", "p1"])
            self.assertTrue(all("hidden" not in card for player in view["players"] for card in player["hand"]))
