import copy
import unittest

from game.emerald_skulls import DICE_COSTS, EmeraldSkullsGame


def make_players(count=3, bot_ids=()):
    return [
        {
            "player_id": f"p{index}",
            "name": f"Player {index}",
            "seat": index,
            "is_bot": f"p{index}" in set(bot_ids),
        }
        for index in range(1, count + 1)
    ]


class EmeraldSkullsGameTests(unittest.TestCase):
    def make_state(self, count=3, seed="emerald-test", bot_ids=()):
        return EmeraldSkullsGame.init_game({"seed": seed}, make_players(count, bot_ids))

    def give_gears(self, state, player_id, amount):
        state["players"][player_id]["gears"] += amount
        state["gear_supply"] -= amount

    def act(self, state, player_id, action):
        events, error = EmeraldSkullsGame.apply_action(state, player_id, action)
        self.assertIsNone(error, error)
        return events

    def buy_and_roll(self, state, count=3):
        active = state["active_player_id"]
        cost = DICE_COSTS[count]
        if cost:
            self.give_gears(state, active, cost)
        self.act(state, active, {"type": "buy_dice", "count": count})
        self.act(state, active, {"type": "roll"})
        return active

    @staticmethod
    def set_rolled_faces(state, faces):
        rolled = [die for die in state["dice"] if die["zone"] == "rolled"]
        if len(rolled) != len(faces):
            raise AssertionError(f"expected {len(rolled)} faces, got {len(faces)}")
        for die, face in zip(rolled, faces):
            die["face"] = face
        return [die["die_id"] for die in rolled]

    def test_player_limits_and_seed_are_deterministic(self):
        first = self.make_state(6, seed="same")
        second = self.make_state(6, seed="same")
        self.assertEqual(first["active_player_id"], second["active_player_id"])
        self.assertEqual(first["gear_supply"], 240)
        self.assertEqual(len(first["dice"]), 7)
        with self.assertRaises(ValueError):
            EmeraldSkullsGame.init_game({}, make_players(1))
        with self.assertRaises(ValueError):
            EmeraldSkullsGame.init_game({}, make_players(7))

    def test_buy_dice_costs_and_balance_limit(self):
        state = self.make_state()
        active = state["active_player_id"]
        _, error = EmeraldSkullsGame.apply_action(state, active, {"type": "buy_dice", "count": 4})
        self.assertEqual(error, "not enough gears")
        self.give_gears(state, active, 3)
        before_supply = state["gear_supply"]
        self.act(state, active, {"type": "buy_dice", "count": 5})
        self.assertEqual(state["players"][active]["gears"], 0)
        self.assertEqual(state["gear_supply"], before_supply + 3)
        self.assertEqual(len([die for die in state["dice"] if die["zone"] == "pool"]), 5)
        self.assertEqual(state["phase"], "await_roll")

    def test_bets_are_ordered_limited_and_allow_the_same_location(self):
        state = self.make_state(4)
        active = state["active_player_id"]
        gamblers = [pid for pid in state["turn_order"] if pid != active]
        self.assertNotIn("place_bet", EmeraldSkullsGame.get_legal_actions(state, gamblers[0]))
        self.assertEqual(EmeraldSkullsGame.get_public_view(state, gamblers[0])["available_bet_ids"], [])
        self.act(state, active, {"type": "buy_dice", "count": 3})
        self.act(state, gamblers[0], {"type": "place_bet", "bet_id": "pick_bust"})
        self.act(state, gamblers[0], {"type": "place_bet", "bet_id": "pick_bust"})
        self.act(state, gamblers[1], {"type": "place_bet", "bet_id": "pick_bust"})
        self.assertEqual(
            [bet["player_id"] for bet in state["bet_stacks"]["pick_bust"]],
            [gamblers[0], gamblers[0], gamblers[1]],
        )
        _, error = EmeraldSkullsGame.apply_action(
            state, gamblers[2], {"type": "place_bet", "bet_id": "pick_bust"}
        )
        self.assertIsNotNone(error)
        _, error = EmeraldSkullsGame.apply_action(
            state, active, {"type": "place_bet", "bet_id": "final_jewel"}
        )
        self.assertIsNotNone(error)

    def test_placement_uses_one_level_and_respects_capacity_and_floor(self):
        state = self.make_state()
        active = self.buy_and_roll(state, 5)
        die_ids = self.set_rolled_faces(state, [3, 3, "skull", 4, 5])
        _, error = EmeraldSkullsGame.apply_action(
            state,
            active,
            {"type": "place_dice", "level": 3, "die_ids": [die_ids[0], die_ids[3]]},
        )
        self.assertIsNotNone(error)
        self.act(
            state,
            active,
            {"type": "place_dice", "level": 3, "die_ids": die_ids[:3]},
        )
        self.assertEqual(state["minimum_level"], 3)
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        remaining = self.set_rolled_faces(state, [2, 4])
        _, error = EmeraldSkullsGame.apply_action(
            state, active, {"type": "place_dice", "level": 2, "die_ids": [remaining[0]]}
        )
        self.assertIsNotNone(error)

        state = self.make_state()
        active = self.buy_and_roll(state, 3)
        eyes = self.set_rolled_faces(state, [4, 4, 4])
        _, error = EmeraldSkullsGame.apply_action(
            state, active, {"type": "place_dice", "level": 4, "die_ids": eyes}
        )
        self.assertIsNotNone(error)
        self.act(state, active, {"type": "place_dice", "level": 4, "die_ids": eyes[:2]})

    def test_bot_limits_placement_to_the_level_capacity(self):
        state = self.make_state(2, bot_ids=("p1", "p2"))
        active = self.buy_and_roll(state, 3)
        self.set_rolled_faces(state, [4, 4, 4])
        move = EmeraldSkullsGame.bot_move(state, active)
        self.assertEqual(move["type"], "place_dice")
        self.assertEqual(move["level"], 4)
        self.assertEqual(len(move["die_ids"]), 2)
        self.act(state, active, move)

    def test_reroll_cube_adds_a_die_and_nose_pick_keeps_floor(self):
        state = self.make_state()
        active = state["active_player_id"]
        self.give_gears(state, active, 0)
        state["players"][active]["reroll_cubes"] = 1
        self.act(state, active, {"type": "buy_dice", "count": 3})
        self.act(state, active, {"type": "roll"})
        self.act(state, active, {"type": "spend_reroll_cube"})
        self.assertEqual(state["players"][active]["reroll_cubes"], 0)
        self.assertEqual(len([die for die in state["dice"] if die["zone"] == "pool"]), 4)

        state = self.make_state()
        active = self.buy_and_roll(state, 3)
        die_ids = self.set_rolled_faces(state, [3, 1, 1])
        self.act(state, active, {"type": "place_dice", "level": 3, "die_ids": [die_ids[0]]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        self.set_rolled_faces(state, [1, 2])
        self.act(state, active, {"type": "pick_nose", "die_id": die_ids[0]})
        self.assertEqual(state["nose_picks"], 1)
        self.assertEqual(state["minimum_level"], 3)
        self.assertEqual(len([die for die in state["dice"] if die["zone"] == "pool"]), 3)

    def test_chicken_gem_run_double_and_bust_outcomes(self):
        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [1, 2, 3])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": [dice[0]]})
        self.act(state, active, {"type": "chicken_out"})
        self.assertEqual(state["result"], "chicken_out")
        self.assertEqual(state["phase"], "turn_result")

        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [5, 1, 1])
        self.act(state, active, {"type": "place_dice", "level": 5, "die_ids": [dice[0]]})
        self.assertEqual(state["result"], "gem_out")

        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [1, 1, 1])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": dice})
        self.assertEqual(state["result"], "run_out")
        self.assertEqual(state["phase"], "choose_payout")

        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [1, 1, 5])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": dice[:2]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        last = self.set_rolled_faces(state, [5])
        self.act(state, active, {"type": "place_dice", "level": 5, "die_ids": last})
        self.assertEqual(state["result"], "double_out")

        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [4, 1, 1])
        self.act(state, active, {"type": "place_dice", "level": 4, "die_ids": [dice[0]]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        self.set_rolled_faces(state, [1, 2])
        self.assertEqual(state["result"], "bust_out")

    def test_jackpot_choices_and_wild_standard_scoring(self):
        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, ["skull", "skull", "skull"])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": dice[:2]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        final_die = self.set_rolled_faces(state, ["skull"])
        self.act(state, active, {"type": "place_dice", "level": 5, "die_ids": final_die})
        option_ids = {option["option_id"] for option in state["payout_options"]}
        self.assertEqual(option_ids, {"standard", "mad_nargash"})
        self.act(state, active, {"type": "choose_payout", "option_id": "mad_nargash"})
        self.assertEqual(state["turn_result"]["tumbler_gears_paid"], 15)

        state = self.make_state()
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [1, 1, 1])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": dice})
        options = {option["option_id"]: option for option in state["payout_options"]}
        self.assertEqual(options["standard"]["gears"], 3)
        self.assertEqual(options["grim_grin"]["gears"], 9)

    def test_full_skull_unlocks_thirty_gear_jackpot(self):
        state = self.make_state()
        active = self.buy_and_roll(state, 7)
        dice = self.set_rolled_faces(state, [1, 1, 1, 3, 4, 4, 5])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": dice[:3]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        remaining = self.set_rolled_faces(state, [3, 4, 4, 5])
        self.act(state, active, {"type": "place_dice", "level": 3, "die_ids": [remaining[0]]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        remaining = self.set_rolled_faces(state, [4, 4, 5])
        self.act(state, active, {"type": "place_dice", "level": 4, "die_ids": remaining[:2]})
        self.act(state, active, {"type": "continue_roll"})
        self.act(state, active, {"type": "roll"})
        remaining = self.set_rolled_faces(state, [5])
        self.act(state, active, {"type": "place_dice", "level": 5, "die_ids": remaining})
        options = {option["option_id"]: option for option in state["payout_options"]}
        self.assertEqual(state["result"], "double_out")
        self.assertEqual(options["emerald_skull"]["gears"], 30)

    def test_bet_payouts_follow_stack_order(self):
        state = self.make_state(3)
        active = state["active_player_id"]
        gamblers = [pid for pid in state["turn_order"] if pid != active]
        self.act(state, active, {"type": "buy_dice", "count": 3})
        for pid in gamblers:
            self.act(state, pid, {"type": "place_bet", "bet_id": "busted_fowl"})
        self.act(state, active, {"type": "roll"})
        dice = self.set_rolled_faces(state, [1, 2, 3])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": [dice[0]]})
        self.act(state, active, {"type": "chicken_out"})
        awards = state["turn_result"]["bet_awards"]
        self.assertEqual([award["paid"] for award in awards], [5, 3])
        self.assertEqual(state["players"][gamblers[0]]["gears"], 5)
        self.assertEqual(state["players"][gamblers[1]]["gears"], 3)

    def test_all_standard_bet_conditions(self):
        def winning_bets(result, placements=(), nose_picks=0):
            state = self.make_state()
            for die in state["dice"]:
                die.update({"face": None, "zone": "supply", "level": None})
            for die, (face, level) in zip(state["dice"], placements):
                die.update({"face": face, "zone": "board", "level": level})
            state["result"] = result
            state["nose_picks"] = nose_picks
            view = EmeraldSkullsGame.get_public_view(state, state["turn_order"][0])
            return {bet["bet_id"] for bet in view["betting_options"] if bet["won"]}

        self.assertEqual(winning_bets("bust_out"), {"busted_fowl"})
        self.assertEqual(
            winning_bets("bust_out", nose_picks=1),
            {"pick_bust", "busted_fowl"},
        )
        self.assertEqual(winning_bets("chicken_out", [(1, 1)]), {"busted_fowl"})
        self.assertEqual(winning_bets("gem_out", [(5, 5)]), {"final_jewel"})
        self.assertEqual(
            winning_bets("gem_out", [("skull", 5)]),
            {"mad_nargash", "final_jewel"},
        )
        self.assertEqual(
            winning_bets("run_out", [(1, 1), (2, 2)]),
            {"grim_grin", "empty_hands"},
        )
        self.assertEqual(
            winning_bets(
                "double_out",
                [(1, 1), (1, 1), (2, 2), (3, 3), (4, 4), (4, 4), (5, 5)],
            ),
            {"emerald_skull", "final_jewel", "empty_hands", "empty_shiny"},
        )

    def test_supply_exhaustion_ends_immediately(self):
        state = self.make_state(2)
        active = self.buy_and_roll(state)
        other = next(pid for pid in state["turn_order"] if pid != active)
        reserve = state["gear_supply"] - 1
        state["gear_supply"] = 1
        state["players"][other]["gears"] += reserve
        dice = self.set_rolled_faces(state, [5, 1, 1])
        self.act(state, active, {"type": "place_dice", "level": 5, "die_ids": [dice[0]]})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["gear_supply"], 0)
        self.assertEqual(state["turn_result"]["tumbler_gears_paid"], 1)
        self.assertEqual(state["winner_ids"], [other])

    def test_every_human_must_review_before_next_turn(self):
        state = self.make_state(3, bot_ids=("p3",))
        active = self.buy_and_roll(state)
        dice = self.set_rolled_faces(state, [1, 2, 3])
        self.act(state, active, {"type": "place_dice", "level": 1, "die_ids": [dice[0]]})
        self.act(state, active, {"type": "chicken_out"})
        self.assertIn("p3", state["review_ready"])
        humans = [pid for pid in state["turn_order"] if pid != "p3"]
        prior_active = state["active_player_id"]
        self.act(state, humans[0], {"type": "next_turn"})
        self.assertEqual(state["phase"], "turn_result")
        self.act(state, humans[1], {"type": "next_turn"})
        self.assertEqual(state["phase"], "buy_dice")
        self.assertNotEqual(state["active_player_id"], prior_active)

    def test_public_view_hides_rng_and_save_round_trip_validates(self):
        state = self.make_state()
        viewer = state["turn_order"][0]
        view = EmeraldSkullsGame.get_public_view(state, viewer)
        self.assertNotIn("base_seed", view)
        self.assertNotIn("rng_counter", view)
        restored = EmeraldSkullsGame.deserialize(EmeraldSkullsGame.serialize(state))
        self.assertEqual(restored, state)
        broken = copy.deepcopy(state)
        broken["dice"].pop()
        with self.assertRaises(ValueError):
            EmeraldSkullsGame.deserialize(broken)


if __name__ == "__main__":
    unittest.main()
