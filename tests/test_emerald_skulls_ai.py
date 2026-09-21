import copy
import unittest

from game.emerald_skulls import EmeraldSkullsGame
from game.emerald_skulls_ai import Position, TurnSearch, choose_move
from tests.test_emerald_skulls_game import make_players


class EmeraldSkullsAITests(unittest.TestCase):
    def make_state(self, count=3, phase="after_roll", board=(), faces=(1, 2, 3), floor=1, cubes=0):
        state = EmeraldSkullsGame.init_game({"seed": "ai-test"}, make_players(count))
        active = state["active_player_id"]
        state.update(phase=phase, minimum_level=floor, chosen_dice_count=len(board) + len(faces))
        state["players"][active]["reroll_cubes"] = cubes
        for die, (face, level) in zip(state["dice"], board):
            die.update(zone="board", face=face, level=level)
        for die, face in zip(state["dice"][len(board):], faces):
            die.update(zone="pool" if face is None else "rolled", face=face)
        return state, active

    def assert_legal_move(self, state, player_id):
        before = copy.deepcopy(state)
        action = EmeraldSkullsGame.bot_move(state, player_id)
        self.assertEqual(state, before, "thinking must not mutate the game or RNG")
        self.assertIsNotNone(action)
        _, error = EmeraldSkullsGame.apply_action(state, player_id, action)
        self.assertIsNone(error, (action, error))
        return action

    def test_search_uses_only_public_information_and_is_repeatable(self):
        state, active = self.make_state(faces=(1, 1, 3, 4, "skull"), cubes=2)
        original = copy.deepcopy(state)
        expected = EmeraldSkullsGame.bot_move(state, active)
        self.assertEqual(state, original)
        state["base_seed"] = "a completely different secret"
        state["rng_counter"] = 987654
        state["config"]["seed"] = "hidden config"
        self.assertEqual(EmeraldSkullsGame.bot_move(state, active), expected)
        self.assertEqual(choose_move(EmeraldSkullsGame.get_public_view(state, active)), expected)

    def test_finishes_a_full_skull_with_last_wild(self):
        board = ((1, 1), (1, 1), (2, 2), (3, 3), (4, 4), (4, 4))
        state, active = self.make_state(board=board, faces=("skull",), floor=4)
        action = self.assert_legal_move(state, active)
        self.assertEqual((action["type"], action["level"]), ("place_dice", 5))
        payout = self.assert_legal_move(state, active)
        self.assertEqual(payout["option_id"], "emerald_skull")
        self.assertEqual(state["turn_result"]["tumbler_gears_paid"], 30)

    def test_banks_a_board_that_will_empty_the_pot(self):
        state, active = self.make_state(phase="post_place", board=((4, 4), (4, 4)), faces=(None,), floor=4)
        other = next(pid for pid in state["turn_order"] if pid != active)
        state["players"][other]["gears"] = state["gear_supply"] - 3
        state["gear_supply"] = 3
        action = self.assert_legal_move(state, active)
        self.assertEqual(action["type"], "chicken_out")
        self.assertTrue(state["game_over"])

    def test_rescues_a_failed_roll_with_a_cube(self):
        state, active = self.make_state(board=((4, 4), (4, 4)), faces=(1,), floor=4, cubes=1)
        action = self.assert_legal_move(state, active)
        self.assertEqual(action["type"], "spend_reroll_cube")
        self.assertEqual(state["players"][active]["reroll_cubes"], 0)

    def test_nose_rescue_uses_an_ordinary_die_and_preserves_floor(self):
        state, active = self.make_state(board=(("skull", 3), (3, 3)), faces=(1,), floor=3)
        action = self.assert_legal_move(state, active)
        self.assertEqual(action["type"], "pick_nose")
        self.assertEqual(action["die_id"], "die-2")
        self.assertEqual(state["minimum_level"], 3)

    def test_purchase_is_affordable_and_deducts_cost(self):
        state, active = self.make_state(phase="buy_dice", faces=())
        state["players"][active]["gears"] = 2
        state["gear_supply"] -= 2
        action = self.assert_legal_move(state, active)
        self.assertLessEqual(action["count"], 4)

    def test_bets_respond_to_board_and_ignore_impossible_jackpots(self):
        state, active = self.make_state(phase="await_roll", board=((1, 1), (4, 4), (4, 4)), faces=(None,), floor=4)
        gambler = next(pid for pid in state["turn_order"] if pid != active)
        action = self.assert_legal_move(state, gambler)
        self.assertEqual(action["bet_id"], "busted_fowl")
        second = self.assert_legal_move(state, gambler)
        self.assertNotIn(second["bet_id"], {"pick_bust", "mad_nargash", "grim_grin", "emerald_skull"})

    def test_betting_search_accounts_for_stack_order_and_pot(self):
        state, active = self.make_state(phase="await_roll", board=((1, 1), (4, 4), (4, 4)), faces=(None,), floor=4)
        gamblers = [pid for pid in state["turn_order"] if pid != active]
        state["players"][active]["gears"] = state["gear_supply"] - 3
        state["gear_supply"] = 3
        # On a failed roll, the earlier Busted Fowl marker takes the whole pot.
        EmeraldSkullsGame.apply_action(state, gamblers[0], {"type": "place_bet", "bet_id": "busted_fowl"})
        self.assertIsNone(EmeraldSkullsGame.bot_move(state, gamblers[1]))

    def test_tumbler_yields_to_bot_bettors_regardless_of_seat_order(self):
        state, active = self.make_state(phase="await_roll", faces=(None, None, None))
        for meta in state["player_meta"].values():
            meta["is_bot"] = True
        self.assertIsNone(EmeraldSkullsGame.bot_move(state, active))
        for pid in state["turn_order"]:
            if pid != active:
                self.assert_legal_move(state, pid)
                self.assert_legal_move(state, pid)
        self.assertEqual(EmeraldSkullsGame.bot_move(state, active)["type"], "roll")

    def test_humans_have_time_to_bet_and_review_is_not_skipped(self):
        state, active = self.make_state(phase="await_roll", faces=(None, None, None))
        state["player_meta"][active]["is_bot"] = True
        self.assertGreaterEqual(EmeraldSkullsGame.bot_move(state, active)["delay_ms"], 4000)
        state["phase"] = "post_place"
        state["dice"][0].update(zone="board", face=1, level=1)
        EmeraldSkullsGame.apply_action(state, active, {"type": "chicken_out"})
        self.assertEqual(state["phase"], "turn_result")
        self.assertIsNone(EmeraldSkullsGame.bot_move(state, active))

    def test_simulated_payout_matches_real_scoring_with_wilds(self):
        board = ((1, 1), (6, 2), (3, 3), (6, 4), (5, 5))
        search = TurnSearch(120)
        position = Position(board, 0, 2, 5, 0, 1)
        _, payout, wins = search.outcome(position, "double_out")
        self.assertEqual(payout["gears"], 13)
        self.assertEqual(payout["reroll_cubes"], 1)
        self.assertEqual(set(wins), {"final_jewel", "empty_hands", "empty_shiny"})

    def test_complete_bot_games_do_not_stall(self):
        for count in (2, 6):
            with self.subTest(players=count):
                players = make_players(count, tuple(f"p{i}" for i in range(1, count + 1)))
                state = EmeraldSkullsGame.init_game({"seed": f"ai-complete-{count}"}, players)
                for step in range(2500):
                    if state["game_over"]:
                        break
                    for player in players:
                        action = EmeraldSkullsGame.bot_move(state, player["player_id"])
                        if action:
                            _, error = EmeraldSkullsGame.apply_action(state, player["player_id"], action)
                            self.assertIsNone(error, (step, action, error))
                            break
                    else:
                        self.fail(f"All bots stalled in {state['phase']}")
                self.assertTrue(state["game_over"], f"Game did not finish after {step} actions")
                self.assertEqual(sum(player["gears"] for player in state["players"].values()), 40 * count)


if __name__ == "__main__":
    unittest.main()
