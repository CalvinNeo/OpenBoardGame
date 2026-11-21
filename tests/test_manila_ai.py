import copy
import itertools
import random
import unittest
from unittest.mock import patch

from game.manila import CARGO_LIST, ManilaGame as Game, _init_boat, _maybe_start_pilot_phase
from game.manila_ai import _count_distribution, _plan, _probabilities, _round_value, _voyage


def make_state(count=3, phase="placement", positions=(8, 8, 8)):
    generator_state = random.getstate()
    random.seed(51)
    try:
        state = Game.init_game({}, [
            {"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat, "is_bot": True}
            for seat in range(count)
        ])
    finally:
        random.setstate(generator_state)
    state.update(phase=phase, current_player="p0", harbormaster="p0", placement_round=3)
    state["cargo_slots"] = CARGO_LIST[:3]
    state["boats"] = {cargo_id: _init_boat(cargo_id, position)
                      for cargo_id, position in zip(state["cargo_slots"], positions)}
    for player in state["players"].values():
        player["stocks"] = dict.fromkeys(CARGO_LIST, 0)
    return state


class ManilaAiTests(unittest.TestCase):
    def test_voyage_matches_exhaustive_dice(self):
        for position, rolls, pirates in itertools.product(range(14), (1, 2, 3), (False, True)):
            successes, plunders = 0, 0
            for dice in itertools.product(range(1, 7), repeat=rolls):
                current = position
                for index, die in enumerate(dice):
                    current += die
                    if current > 13:
                        successes += 1
                        break
                    if current == 13 and index == rolls - 1:
                        if pirates:
                            plunders += 1
                        else:
                            successes += 1
                        break
            with self.subTest(position=position, rolls=rolls, pirates=pirates):
                success, plunder = _voyage(position, rolls, pirates)
                self.assertAlmostEqual(success, successes / 6 ** rolls)
                self.assertAlmostEqual(plunder, plunders / 6 ** rolls)

    def test_count_distribution(self):
        self.assertEqual(_count_distribution([1.0, 0.0, 0.5]), [0.0, 0.5, 0.5, 0.0])

    def test_certain_port_income_is_not_confused_with_all_arriving(self):
        state = make_state(positions=(13, 0, 0))
        state["boats"]["nutmeg"]["arrived"] = True
        state["board"]["port"]["A"] = "p0"
        self.assertEqual(_round_value(state, "p0"), 6)
        state["board"]["port"] = {"A": None, "B": None, "C": "p0"}
        self.assertEqual(_round_value(state, "p0"), 0)

    def test_marginal_crew_income_does_not_count_existing_workers_twice(self):
        state = make_state()
        boat = state["boats"]["ginseng"]
        boat.update(arrived=True, seats=["p0", "p1", None, None])
        self.assertEqual(_round_value(state, "p0"), 18)
        boat["seats"][2] = "p0"
        self.assertEqual(_round_value(state, "p0"), 24)

    def test_invests_in_ship_that_can_actually_arrive(self):
        state = make_state(positions=(12, 0, 0))
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["location"], {"type": "ship", "cargo": "nutmeg", "seat": 0})

    def test_avoids_splitting_own_ship_income(self):
        state = make_state(positions=(12, 12, 0))
        state["boats"]["nutmeg"]["seats"][0] = "p0"
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["location"]["cargo"], "silk")

    def test_avoids_guaranteed_insurance_losses(self):
        state = make_state(positions=(0, 0, 0))
        for area in ("port", "shipyard"):
            state["board"][area] = dict.fromkeys(("A", "B", "C"), "p1")
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})

    def test_takes_safe_insurance_instead_of_negative_investments(self):
        state = make_state(positions=(13, 13, 13))
        for boat in state["boats"].values():
            boat.update(arrived=True, seats=["p1"] * boat["capacity"])
        state["board"]["port"] = dict.fromkeys(("A", "B", "C"), "p1")
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["location"], {"type": "insurance"})

    def test_auction_keeps_cash_and_does_not_borrow(self):
        state = make_state(phase="auction")
        state["players"]["p0"].update(cash=8, stocks=dict.fromkeys(CARGO_LIST, 5))
        state["auction"]["highest_bid"] = 8
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass_bid"})

    def test_auction_is_deterministic_and_bids_for_valuable_control(self):
        state = make_state(phase="auction")
        state["auction"]["highest_bid"] = 0
        with patch("random.random", side_effect=AssertionError("random policy")):
            self.assertEqual(Game.bot_move(state, "p0"), {"type": "bid", "amount": 1})

    def test_buying_preserves_worker_budget(self):
        state = make_state(phase="harbormaster_buy")
        state["players"]["p0"]["cash"] = 5
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "skip_buy"})

    def test_does_not_buy_zero_value_stock_on_last_round(self):
        state = make_state(phase="harbormaster_buy")
        state["price_track"]["nutmeg"] = 20
        state["stock_bank"] = dict.fromkeys(CARGO_LIST, 0)
        state["stock_bank"]["silk"] = 1
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "skip_buy"})

    def test_cargo_and_positions_support_own_stocks(self):
        state = make_state(phase="harbormaster_cargo")
        state["placement_round"] = 1
        state["price_track"]["silk"] = 10
        state["players"]["p0"]["stocks"]["silk"] = 4
        cargo, positions, _, _ = _plan(state, "p0")
        self.assertIn("silk", cargo)
        self.assertEqual(sum(positions), 9)
        self.assertEqual(positions[cargo.index("silk")], max(positions))

    def test_pilot_can_sabotage_opponent_instead_of_helping(self):
        state = make_state(phase="pilot", positions=(7, 0, 0))
        state["boats"]["nutmeg"]["seats"][0] = "p1"
        state["board"]["pilots"]["small"] = "p0"
        state["pending_pilots"] = ["small"]
        action = Game.bot_move(state, "p0")
        self.assertEqual(action, {"type": "pilot_move", "size": "small", "cargo": "nutmeg", "delta": -1})

    def test_pilot_protects_own_ship_from_pirates(self):
        state = make_state(phase="pilot", positions=(12, 0, 0))
        state["boats"]["nutmeg"]["seats"][0] = "p0"
        state["board"]["pirates"]["captain"] = "p1"
        state["board"]["pilots"]["small"] = "p0"
        state["pending_pilots"] = ["small"]
        self.assertEqual(Game.bot_move(state, "p0")["delta"], 1)

    def test_big_pilot_can_split_to_improve_two_ships(self):
        state = make_state(phase="pilot", positions=(7, 11, 0))
        state["boats"]["nutmeg"]["seats"] = ["p0", "p1", "p2"]
        state["boats"]["silk"]["seats"][0] = "p0"
        state["board"]["pilots"]["big"] = "p0"
        state["pending_pilots"] = ["big"]
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["type"], "pilot_split")
        self.assertEqual((action["delta_a"], action["delta_b"]), (1, 1))

    def test_skips_pilot_phase_when_every_ship_has_arrived(self):
        state = make_state(positions=(13, 13, 13))
        for boat in state["boats"].values():
            boat["arrived"] = True
        state["board"]["pilots"]["small"] = "p0"
        self.assertFalse(_maybe_start_pilot_phase(state))

    def test_skips_remaining_pilot_when_big_pilot_docks_last_ship(self):
        state = make_state(phase="pilot", positions=(12, 13, 13))
        for cargo_id in ("silk", "ginseng"):
            state["boats"][cargo_id]["arrived"] = True
        state["board"]["pilots"] = {"big": "p0", "small": "p1"}
        state["pending_pilots"] = ["big", "small"]
        _, error = Game.apply_action(state, "p0", {
            "type": "pilot_move", "size": "big", "cargo": "nutmeg", "delta": 2,
        })
        self.assertIsNone(error)
        self.assertNotEqual(state["phase"], "pilot")
        self.assertEqual(state["pending_pilots"], [])

    def test_can_fund_profitable_investment_without_pledging_valuable_stock(self):
        state = make_state(positions=(13, 13, 0))
        state["boats"]["nutmeg"]["arrived"] = True
        state["boats"]["silk"]["arrived"] = True
        state["players"]["p0"]["cash"] = 0
        state["players"]["p0"]["stocks"].update(jade=1, silk=1)
        state["price_track"]["silk"] = 20
        action = Game.bot_move(state, "p0")
        self.assertEqual(action, {"type": "pledge_stock", "cargo": "jade"})
        _, error = Game.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(Game.bot_move(state, "p0")["type"], "place_worker")

    def test_declines_loan_when_forfeited_stock_and_interest_cost_too_much(self):
        state = make_state(positions=(13, 13, 0))
        state["boats"]["nutmeg"]["arrived"] = True
        state["boats"]["silk"]["arrived"] = True
        state["players"]["p0"]["cash"] = 0
        state["players"]["p0"]["stocks"]["jade"] = 1
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})

    def test_legacy_outstanding_bid_can_still_be_paid(self):
        state = make_state(phase="harbormaster_pay")
        state["harbormaster_bid"] = 8
        state["players"]["p0"]["cash"] = 0
        state["players"]["p0"]["stocks"]["silk"] = 1
        action = Game.bot_move(state, "p0")
        self.assertEqual(action, {"type": "pledge_stock", "cargo": "silk"})
        _, error = Game.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "harbormaster_buy")

    def test_pirate_boards_best_marginal_share(self):
        state = make_state(phase="pirate", positions=(13, 13, 13))
        state.update(pirate_day=2, pirate_targets=list(state["cargo_slots"]), pirate_pending=["p0"], placement_round=2)
        state["board"]["pirates"]["captain"] = "p0"
        state["boats"]["nutmeg"]["seats"] = ["p1", "p2", None]
        action = Game.bot_move(state, "p0")
        self.assertEqual(action, {"type": "pirate_action", "mode": "board", "cargo": "ginseng"})

    def test_pirate_routes_plunder_to_own_shipyard(self):
        state = make_state(phase="pirate", positions=(13, 0, 0))
        state.update(pirate_day=3, pirate_targets=["nutmeg"], pirate_pending=["p0"])
        state["board"]["pirates"]["captain"] = "p0"
        state["board"]["shipyard"]["C"] = "p0"
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["result"], "shipyard")

    def test_pirate_routing_respects_stocks_and_insurance(self):
        state = make_state(phase="pirate", positions=(13, 0, 0))
        state.update(pirate_day=3, pirate_targets=["nutmeg"], pirate_pending=["p0"])
        state["board"]["pirates"]["captain"] = "p0"
        state["board"]["insurance"] = "p0"
        state["players"]["p0"]["stocks"]["nutmeg"] = 2
        self.assertEqual(Game.bot_move(state, "p0")["result"], "port")

    def test_pirate_forecast_uses_only_remaining_rolls(self):
        state = make_state(phase="pirate", positions=(13, 0, 0))
        state.update(pirate_day=2, placement_round=2)
        self.assertEqual(_probabilities(state)["silk"], (0.0, 0.0))

    def test_policy_does_not_mutate_state_or_consume_game_randomness(self):
        for phase in ("auction", "harbormaster_buy", "harbormaster_cargo", "harbormaster_position", "placement"):
            state = make_state(phase=phase)
            original = copy.deepcopy(state)
            generator_state = random.getstate()
            Game.bot_move(state, "p0")
            self.assertEqual(state, original)
            self.assertEqual(random.getstate(), generator_state)

    def test_opponent_hidden_cards_and_deck_do_not_affect_policy(self):
        for phase in ("auction", "harbormaster_buy", "harbormaster_cargo", "harbormaster_position", "placement", "pilot", "pirate"):
            state = make_state(phase=phase, positions=(13, 8, 9))
            state["board"]["pilots"]["small"] = "p0"
            state["pending_pilots"] = ["small"]
            state.update(pirate_day=3, pirate_targets=["nutmeg"], pirate_pending=["p0"])
            action = Game.bot_move(state, "p0")
            for player_id in ("p1", "p2"):
                state["players"][player_id]["stocks"] = dict.fromkeys(CARGO_LIST, 100)
                state["players"][player_id]["pledged"] = dict.fromkeys(CARGO_LIST, 100)
            state["stock_deck"].reverse()
            self.assertEqual(Game.bot_move(state, "p0"), action)

    def test_waiting_and_finished_players_do_not_act(self):
        state = make_state()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "missing"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_seeded_games_finish_with_legal_actions_and_serialization(self):
        generator_state = random.getstate()
        try:
            for count in (3, 4, 5):
                random.seed(5100 + count)
                state = Game.init_game({}, [
                    {"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat, "is_bot": True}
                    for seat in range(count)
                ])
                for step in range(2500):
                    if state["game_over"]:
                        break
                    player_id = state["current_player"]
                    if state["phase"] == "round_end":
                        player_id = next(player_id for player_id in state["turn_order"]
                                         if not state["players"][player_id]["round_ready"])
                    action = Game.bot_move(state, player_id)
                    self.assertIsNotNone(action, (count, step, state["phase"]))
                    _, error = Game.apply_action(state, player_id, action)
                    self.assertIsNone(error, (count, step, action))
                    if step % 20 == 0:
                        state = Game.deserialize(copy.deepcopy(Game.serialize(state)))
                self.assertTrue(state["game_over"], count)
        finally:
            random.setstate(generator_state)


if __name__ == "__main__":
    unittest.main()
