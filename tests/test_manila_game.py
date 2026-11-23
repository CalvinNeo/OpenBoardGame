import copy
import itertools
import unittest

from jsonschema import Draft7Validator

from game.definitions import MANILA_ACTION_SCHEMA
from game.manila import CARGO_LIST, ManilaGame as Game, _finalize_game, _init_boat, _resolve_round


def make_setup_state():
    state = Game.init_game({}, [
        {"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat}
        for seat in range(3)
    ])
    state.update(phase="harbormaster_position", current_player="p0", harbormaster="p0")
    state["cargo_slots"] = ["nutmeg", "silk", "ginseng"]
    return state


class ManilaStartingPositionTests(unittest.TestCase):
    def test_accepts_every_legal_starting_position_combination(self):
        combinations = 0
        for positions in itertools.product(range(6), repeat=3):
            if sum(positions) != 9:
                continue
            with self.subTest(positions=positions):
                state = make_setup_state()
                action = {"type": "set_positions", "positions": list(positions)}
                self.assertTrue(Draft7Validator(MANILA_ACTION_SCHEMA).is_valid(action))
                _, error = Game.apply_action(state, "p0", action)
                self.assertIsNone(error)
                self.assertEqual(state["phase"], "placement")
                self.assertEqual([state["boats"][cargo]["position"] for cargo in state["cargo_slots"]], list(positions))
                combinations += 1
        self.assertEqual(combinations, 25)

    def test_rejects_out_of_range_starts_even_when_sum_is_nine(self):
        for positions in ([9, 0, 0], [6, 3, 0], [-1, 5, 5], [13, -4, 0]):
            with self.subTest(positions=positions):
                state = make_setup_state()
                original = copy.deepcopy(state)
                action = {"type": "set_positions", "positions": positions}
                self.assertFalse(Draft7Validator(MANILA_ACTION_SCHEMA).is_valid(action))
                _, error = Game.apply_action(state, "p0", action)
                self.assertIsNotNone(error)
                self.assertEqual(state, original)

    def test_rejects_in_range_starts_that_do_not_sum_to_nine(self):
        for positions in ([0, 0, 0], [5, 5, 5], [3, 3, 2]):
            state = make_setup_state()
            original = copy.deepcopy(state)
            _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": positions})
            self.assertEqual(error, "positions must sum to 9")
            self.assertEqual(state, original)

    def test_rejects_non_integer_and_malformed_starts_without_mutation(self):
        for positions in (["0", 4, 5], [0.5, 3.5, 5], [True, 3, 5], [None, 4, 5], [0, 9], None):
            with self.subTest(positions=positions):
                state = make_setup_state()
                original = copy.deepcopy(state)
                _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": positions})
                self.assertIsNotNone(error)
                self.assertEqual(state, original)

    def test_bot_starts_remain_legal_for_concentrated_stock_holdings(self):
        for cargo_id in ("nutmeg", "silk", "ginseng", "jade"):
            state = make_setup_state()
            state["players"]["p0"]["stocks"] = dict.fromkeys(state["price_track"], 0)
            state["players"]["p0"]["stocks"][cargo_id] = 5
            state["price_track"][cargo_id] = 20
            state["phase"] = "harbormaster_cargo"
            _, error = Game.apply_action(state, "p0", Game.bot_move(state, "p0"))
            self.assertIsNone(error)
            action = Game.bot_move(state, "p0")
            self.assertEqual(sum(action["positions"]), 9)
            self.assertTrue(all(0 <= position <= 5 for position in action["positions"]))
            self.assertEqual(action["positions"][state["cargo_slots"].index(cargo_id)], 5)
            _, error = Game.apply_action(state, "p0", action)
            self.assertIsNone(error)

    def test_starting_limit_does_not_restrict_pilot_movement(self):
        state = make_setup_state()
        _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": [0, 4, 5]})
        self.assertIsNone(error)
        state.update(phase="pilot", placement_round=3, pending_pilots=["small"])
        state["board"]["pilots"]["small"] = "p0"
        _, error = Game.apply_action(state, "p0", {
            "type": "pilot_move", "size": "small", "cargo": "ginseng", "delta": 1,
        })
        self.assertIsNone(error)
        self.assertGreater(state["boats"]["ginseng"]["position"], 5)

    def test_deserialization_preserves_existing_voyage_positions(self):
        state = make_setup_state()
        _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": [0, 4, 5]})
        self.assertIsNone(error)
        state["boats"]["ginseng"]["position"] = 9
        restored = Game.deserialize(copy.deepcopy(Game.serialize(state)))
        self.assertEqual(restored["boats"]["ginseng"]["position"], 9)


class ManilaFinalScoreTests(unittest.TestCase):
    def make_score_state(self, loan_repay=15):
        state = make_setup_state()
        state["config"]["loan_repay"] = loan_repay
        state["price_track"] = {"nutmeg": 5, "silk": 10, "ginseng": 30, "jade": 0}
        for player in state["players"].values():
            player.update(cash=0, stocks=dict.fromkeys(CARGO_LIST, 0), pledged=dict.fromkeys(CARGO_LIST, 0))
        state["players"]["p0"].update(cash=20, stocks={"nutmeg": 2, "silk": 1, "ginseng": 1, "jade": 1})
        state["players"]["p0"]["pledged"]["jade"] = 1
        state["players"]["p1"].update(cash=5, stocks={"nutmeg": 0, "silk": 0, "ginseng": 2, "jade": 0})
        state["players"]["p1"]["pledged"]["nutmeg"] = 1
        state["players"]["p2"].update(cash=-2, pledged={"nutmeg": 0, "silk": 2, "ginseng": 0, "jade": 0})
        return state

    def test_all_viewers_see_every_final_score_and_calculation(self):
        state = self.make_score_state()
        _finalize_game(state)
        original = copy.deepcopy(state)
        for viewer_id in ("p0", "p1", "p2", "visitor"):
            with self.subTest(viewer=viewer_id):
                players = {player["player_id"]: player for player in Game.get_public_view(state, viewer_id)["players"]}
                score = players["p0"]["score_breakdown"]
                self.assertEqual(score, {
                    "cash": 20,
                    "stocks": {
                        "nutmeg": {"count": 2, "price": 5, "value": 10},
                        "silk": {"count": 1, "price": 10, "value": 10},
                        "ginseng": {"count": 1, "price": 30, "value": 30},
                        "jade": {"count": 1, "price": 0, "value": 0},
                    },
                    "stock_value": 50, "pledged_count": 1, "loan_repay": 15, "debt": 15, "total": 55,
                })
                self.assertEqual(players["p1"]["score_breakdown"]["total"], 50)
                self.assertEqual(players["p2"]["score_breakdown"]["total"], -32)
                self.assertEqual(state["winner"], ["p0"])
                score["stocks"]["nutmeg"]["count"] = 100
                self.assertEqual(state, original)

    def test_custom_repayment_and_tied_winners_use_same_calculation(self):
        state = self.make_score_state(loan_repay=13)
        state["players"]["p1"]["cash"] = 10
        _finalize_game(state)
        self.assertEqual(state["winner"], ["p0", "p1"])
        for player in Game.get_public_view(state, "visitor")["players"]:
            score = player["score_breakdown"]
            self.assertEqual(score["loan_repay"], 13)
            self.assertEqual(score["debt"], score["pledged_count"] * 13)
            self.assertEqual(score["total"], score["cash"] + score["stock_value"] - score["debt"])
        self.assertEqual(Game.get_public_view(state, "p1")["players"][0]["score_breakdown"]["total"], 57)

    def test_hidden_stocks_and_scores_remain_private_until_game_over(self):
        state = self.make_score_state()
        for phase in ("placement", "round_end"):
            state["phase"] = phase
            for viewer_id in ("p0", "visitor"):
                for player in Game.get_public_view(state, viewer_id)["players"]:
                    self.assertNotIn("score_breakdown", player)
                    if player["player_id"] == viewer_id:
                        self.assertIn("stocks", player)
                    else:
                        self.assertNotIn("stocks", player)
                        self.assertNotIn("pledged", player)

    def test_terminal_legacy_save_generates_scores_without_stored_breakdown(self):
        state = self.make_score_state()
        state.update(game_over=True, phase="game_over", winner=["p0"])
        state = Game.deserialize(copy.deepcopy(Game.serialize(state)))
        self.assertEqual(Game.get_public_view(state, "visitor")["players"][0]["score_breakdown"]["total"], 55)

    def test_scores_use_updated_prices_after_final_voyage(self):
        state = self.make_score_state()
        state["phase"] = "placement"
        state["price_track"]["ginseng"] = 20
        state["boats"] = {cargo_id: _init_boat(cargo_id, 0) for cargo_id in state["cargo_slots"]}
        state["boats"]["ginseng"].update(position=13, arrived=True)
        _resolve_round(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(Game.get_public_view(state, "visitor")["players"][1]["score_breakdown"]["stocks"]["ginseng"]["price"], 30)

    def test_terminal_state_cannot_be_changed_by_pledging(self):
        state = self.make_score_state()
        _finalize_game(state)
        original = copy.deepcopy(state)
        _, error = Game.apply_action(state, "p0", {"type": "pledge_stock", "cargo": "silk"})
        self.assertEqual(error, "game over")
        self.assertEqual(state, original)

    def test_final_score_does_not_add_voyage_income_twice(self):
        state = self.make_score_state()
        state["round_ledger"]["p0"] = {"earn": {"Ship Silk": 500}, "spend": {"Bid": 300}}
        _finalize_game(state)
        self.assertEqual(Game.get_public_view(state, "visitor")["players"][0]["score_breakdown"]["total"], 55)

    def test_new_game_hides_opponent_scores_again(self):
        state = self.make_score_state()
        _finalize_game(state)
        _, error = Game.apply_action(state, "p0", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        for player in Game.get_public_view(state, "visitor")["players"]:
            self.assertNotIn("score_breakdown", player)
            self.assertNotIn("stocks", player)

    def test_zero_assets_show_zero_total_without_inventing_stock_value(self):
        state = self.make_score_state()
        state["players"]["p2"].update(cash=0, pledged=dict.fromkeys(CARGO_LIST, 0))
        _finalize_game(state)
        score = Game.get_public_view(state, "visitor")["players"][2]["score_breakdown"]
        self.assertEqual(score["total"], 0)
        self.assertEqual(score["stock_value"], 0)
        self.assertEqual(score["debt"], 0)


if __name__ == "__main__":
    unittest.main()
