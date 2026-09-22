import copy
import json
import random
import unittest
from collections import Counter
from unittest.mock import patch

from game.for_sale import CHECKS, PROPERTIES, ForSaleGame as Game


def players(count=3):
    return [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index,
             "is_bot": True} for index in range(count)]


class ForSaleTests(unittest.TestCase):
    def setUp(self):
        source = random.Random(112)
        self.shuffle = patch("game.for_sale.random.shuffle", side_effect=source.shuffle)
        self.choice = patch("game.for_sale.random.choice", side_effect=source.choice)
        self.shuffle.start()
        self.choice.start()
        self.addCleanup(self.shuffle.stop)
        self.addCleanup(self.choice.stop)

    def buy_fixture(self, market=(3, 17, 29)):
        state = Game.init_game({}, players())
        state.update(current_turn="p0", start_player="p0", market_properties=list(market))
        return state

    def sell_fixture(self, checks=(0, 8, 8)):
        state = Game.init_game({}, players())
        state.update(phase="sell", stage="sell", stage_round=1, round=9,
                     current_turn=None, active_players=[], market_properties=[],
                     market_checks=list(checks))
        for player, properties in zip(state["players"].values(), [[4, 24], [7, 30], [12, 27]]):
            player["properties"] = properties
        return state

    def act(self, state, action_type, actor=None, **fields):
        action = {"type": action_type, "round": state["round"], **fields}
        if action_type in ("bid", "pass"):
            action["turn"] = state["turn"]
        events, error = Game.apply_action(state, actor or state["current_turn"], action)
        self.assertIsNone(error, (actor, action, error))
        return events

    def confirm_all(self, state):
        for pid in state["turn_order"]:
            self.act(state, "next_round", pid)

    def assert_rejected(self, state, actor, action):
        snapshot = copy.deepcopy(state)
        events, error = Game.apply_action(state, actor, action)
        self.assertIsNotNone(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, snapshot, action)

    def assert_conserved(self, state):
        properties = state["property_deck"] + state["removed_properties"] + state["market_properties"]
        checks = state["check_deck"] + state["removed_checks"]
        if state["phase"] == "sell":
            checks += state["market_checks"]
        for player in state["players"].values():
            properties += player["properties"] + player["sold_properties"]
            checks += player["checks"]
            self.assertGreaterEqual(player["cash"], 0)
        self.assertEqual(Counter(properties), Counter(PROPERTIES))
        self.assertEqual(Counter(checks), Counter(CHECKS))

    def test_decks_starting_cash_removals_and_round_counts(self):
        self.assertEqual(len(CHECKS), 30)
        self.assertEqual(Counter(CHECKS), Counter({value: 2 for value in [0, *range(2, 16)]}))
        for count, cash, removed, rounds in [(3, 18, 6, 8), (4, 18, 2, 7),
                                             (5, 14, 0, 6), (6, 14, 0, 5)]:
            with self.subTest(count=count):
                state = Game.init_game({}, players(count))
                self.assertEqual((state["round"], state["stage_round"], state["turn"]), (1, 1, 1))
                self.assertEqual(state["rounds_per_stage"], rounds)
                self.assertEqual(len(state["removed_properties"]), removed)
                self.assertEqual(len(state["removed_checks"]), removed)
                self.assertEqual(len(state["property_deck"]), 30 - removed - count)
                self.assertEqual(len(state["check_deck"]), 30 - removed)
                self.assertEqual(len(state["market_properties"]), count)
                self.assertEqual(state["market_properties"], sorted(state["market_properties"]))
                self.assertTrue(all(player["cash"] == cash for player in state["players"].values()))
                self.assertEqual(state["current_turn"], state["start_player"])
                self.assert_conserved(state)

    def test_shuffle_is_independent_and_starter_is_random(self):
        with patch("game.for_sale.random.shuffle") as shuffle, \
                patch("game.for_sale.random.choice", return_value="p2") as choose:
            state = Game.init_game(None, players())
        self.assertEqual(shuffle.call_count, 2)
        self.assertIsNot(shuffle.call_args_list[0].args[0], shuffle.call_args_list[1].args[0])
        choose.assert_called_once_with(["p0", "p1", "p2"])
        self.assertEqual(state["start_player"], "p2")

    def test_seat_order_and_metadata_are_copied(self):
        roster = players()
        roster[0]["seat"], roster[2]["seat"] = 7, 0
        state = Game.init_game({}, roster)
        self.assertEqual(state["turn_order"], ["p2", "p1", "p0"])
        roster[0]["name"] = "Changed"
        self.assertEqual(state["player_meta"]["p0"]["name"], "Player 0")

    def test_rejects_bad_configuration_and_roster(self):
        for config in [{"seed": 1}, {"expansion": True}, [], False, 3]:
            with self.subTest(config=config), self.assertRaises(ValueError):
                Game.init_game(config, players())
        for count in [0, 1, 2, 7]:
            with self.subTest(count=count), self.assertRaises(ValueError):
                Game.init_game({}, players(count))
        for roster in [None, [players()[0]] * 3, [{}, {}, {}],
                       [{"player_id": ""}, *players(2)],
                       [{"player_id": 1}, *players(2)],
                       [{"player_id": "p3", "seat": True}, *players(2)]]:
            with self.subTest(roster=roster), self.assertRaises(ValueError):
                Game.init_game({}, roster)

    def test_bidding_charges_only_the_increase(self):
        state = self.buy_fixture()
        for amount in [3, 4, 5, 6]:
            self.act(state, "bid", amount=amount)
        self.assertEqual(state["players"]["p0"]["cash"], 12)
        self.assertEqual(state["players"]["p0"]["bid"], 6)
        self.assertEqual(state["high_bid"], 6)
        self.assertEqual(state["high_bidder"], "p0")
        view = Game.get_public_view(state, "p0")
        self.assertEqual((view["your_cash"], view["your_bid"], view["min_bid"], view["max_bid"]),
                         (12, 6, 7, 18))
        self.assertEqual(state["turn"], 5)

    def test_bid_can_use_cash_plus_existing_escrow(self):
        state = self.buy_fixture()
        self.act(state, "bid", amount=13)
        self.act(state, "bid", amount=14)
        self.act(state, "pass")
        self.assertEqual(Game.get_public_view(state, "p0")["max_bid"], 18)
        self.act(state, "bid", amount=18)
        self.assertEqual(state["players"]["p0"]["cash"], 0)
        self.assertEqual(Game.get_legal_actions(state, "p1"), ["pass"])

    def test_odd_pass_refunds_floor_and_charges_ceil(self):
        state = self.buy_fixture()
        self.act(state, "bid", amount=3)
        self.act(state, "bid", amount=4)
        self.act(state, "pass")
        self.act(state, "pass")
        self.assertEqual(state["players"]["p0"]["cash"], 16)
        self.assertEqual(state["players"]["p1"]["cash"], 14)
        self.assertEqual(state["players"]["p2"]["cash"], 18)
        self.assertEqual(state["round_summary"]["rows"], [
            {"player_id": "p2", "property": 3, "bid": 0, "paid": 0, "refund": 0},
            {"player_id": "p0", "property": 17, "bid": 3, "paid": 2, "refund": 1},
            {"player_id": "p1", "property": 29, "bid": 4, "paid": 4, "refund": 0},
        ])
        self.assertEqual(state["round_summary"]["winner"], "p1")
        self.assertEqual(state["market_properties"], [])
        self.assertIsNone(state["current_turn"])
        self.assertEqual(Game.get_public_view(state, "p0")["your_bid"], 0)

    def test_one_unit_bid_receives_no_refund(self):
        state = self.buy_fixture()
        self.act(state, "bid", amount=1)
        self.act(state, "bid", amount=2)
        self.act(state, "pass")
        self.act(state, "pass")
        self.assertEqual(state["players"]["p0"]["cash"], 17)
        row = state["round_summary"]["rows"][1]
        self.assertEqual((row["paid"], row["refund"]), (1, 0))

    def test_unbid_pass_is_free_and_last_player_gets_highest(self):
        state = self.buy_fixture()
        self.act(state, "pass")
        self.assertEqual(state["players"]["p0"]["properties"], [3])
        self.assertEqual(state["market_properties"], [17, 29])
        self.assertEqual(Game.get_legal_actions(state, "p0"), [])
        self.act(state, "pass")
        self.assertEqual(state["players"]["p2"]["properties"], [29])
        self.assertTrue(all(player["cash"] == 18 for player in state["players"].values()))
        self.assertEqual(state["round_summary"]["winner"], "p2")
        self.confirm_all(state)
        self.assertEqual((state["current_turn"], state["start_player"]), ("p2", "p2"))

    def test_passed_players_are_skipped_and_have_no_escrow(self):
        state = self.buy_fixture()
        self.act(state, "bid", amount=3)
        self.act(state, "bid", amount=4)
        self.act(state, "bid", amount=5)
        self.act(state, "pass")
        view = Game.get_public_view(state, "p0")
        self.assertEqual((view["your_bid"], view["max_bid"]), (0, 16))
        self.assertEqual(view["players"][0]["bid"], 3)
        self.assertEqual(state["active_players"], ["p1", "p2"])
        self.act(state, "bid", amount=6)
        self.act(state, "bid", amount=7)
        self.assertEqual(state["current_turn"], "p1")

    def test_no_cash_still_allows_free_pass(self):
        state = self.buy_fixture()
        state["players"]["p0"]["cash"] = 0
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["pass"])
        self.act(state, "pass")
        self.assertEqual(state["players"]["p0"]["properties"], [3])

    def test_round_end_waits_for_all_seats_and_rejects_repeated_ready(self):
        state = self.buy_fixture()
        self.act(state, "pass")
        self.act(state, "pass")
        old_turn, old_summary = state["turn"], copy.deepcopy(state["round_summary"])
        self.act(state, "next_round", "p0")
        self.assertEqual(state["phase"], "round_end")
        self.assert_rejected(state, "p0", {"type": "next_round", "round": 1})
        self.assertEqual(Game.get_legal_actions(state, "p1"), ["next_round"])
        self.act(state, "next_round", "p1")
        self.assertEqual(state["round_summary"], old_summary)
        self.act(state, "next_round", "p2")
        self.assertEqual((state["phase"], state["round"], state["stage_round"]), ("buy", 2, 2))
        self.assertEqual(state["turn"], old_turn)
        self.assertIsNone(state["round_summary"])
        self.assertEqual(state["next_ready"], [])
        self.assert_rejected(state, "p2", {"type": "next_round", "round": 1})

    def test_all_buy_rounds_transition_only_after_every_confirmation(self):
        state = Game.init_game({}, players())
        for round_number in range(1, 9):
            self.assertEqual((state["stage"], state["stage_round"]), ("buy", round_number))
            self.act(state, "pass")
            self.act(state, "pass")
            self.assertEqual(state["phase"], "round_end")
            self.assert_conserved(state)
            for pid in ["p0", "p1"]:
                self.act(state, "next_round", pid)
                self.assertEqual(state["stage"], "buy")
            self.act(state, "next_round", "p2")
        self.assertEqual((state["phase"], state["round"], state["stage_round"]), ("sell", 9, 1))
        self.assertEqual(state["turn"], 17)
        self.assertEqual(state["property_deck"], [])
        self.assertTrue(all(len(player["properties"]) == 8 for player in state["players"].values()))
        self.assertTrue(all(Game.get_legal_actions(state, pid) == ["sell"] for pid in state["turn_order"]))
        self.assert_conserved(state)

    def test_sales_are_secret_and_only_resolve_when_everyone_submits(self):
        state = self.sell_fixture()
        events = self.act(state, "sell", "p1", property=30)
        self.assertEqual(events, [{"type": "for_sale:submitted", "payload": {"player_id": "p1"}}])
        self.assertEqual(state["players"]["p1"]["properties"], [7, 30])
        self.assertEqual(state["players"]["p1"]["checks"], [])
        self.assertIsNone(state["round_summary"])
        self.assertEqual(Game.get_public_view(state, "p1")["your_selection"], 30)
        self.assertIsNone(Game.get_public_view(state, "p0")["your_selection"])
        self.assertNotIn("30", state["log"][-1]["text"])
        self.assertEqual(Game.get_legal_actions(state, "p1"), [])
        self.act(state, "sell", "p0", property=4)
        self.assertEqual(state["phase"], "sell")
        self.act(state, "sell", "p2", property=12)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round_summary"]["rows"], [
            {"player_id": "p0", "property": 4, "check": 0},
            {"player_id": "p2", "property": 12, "check": 8},
            {"player_id": "p1", "property": 30, "check": 8},
        ])
        self.assertIsNone(state["round_summary"]["winner"])
        self.assertEqual(state["players"]["p1"]["properties"], [7])
        self.assertEqual(state["players"]["p1"]["checks"], [8])
        self.assertEqual(state["players"]["p1"]["sold_properties"], [30])
        self.assertEqual(state["turn"], 1)

    def test_sale_cannot_be_changed_replayed_or_use_another_players_card(self):
        state = self.sell_fixture()
        self.assert_rejected(state, "p0", {"type": "sell", "round": 9, "property": 30})
        self.act(state, "sell", "p0", property=24)
        for value in [4, 24]:
            self.assert_rejected(state, "p0", {"type": "sell", "round": 9, "property": value})

    def test_sale_round_advances_and_clears_submissions_after_all_ready(self):
        state = self.sell_fixture()
        for pid, value in [("p0", 4), ("p1", 7), ("p2", 12)]:
            self.act(state, "sell", pid, property=value)
        self.confirm_all(state)
        self.assertEqual((state["phase"], state["round"], state["stage_round"]), ("sell", 10, 2))
        self.assertTrue(all(player["selection"] is None for player in state["players"].values()))
        self.assert_rejected(state, "p0", {"type": "sell", "round": 9, "property": 24})

    def final_fixture(self, cash, held_checks):
        state = self.sell_fixture((0, 0, 2))
        state["stage_round"] = state["rounds_per_stage"]
        for index, value in enumerate([3, 1, 2]):
            state["players"][f"p{index}"].update(properties=[value], cash=cash[index], checks=held_checks[index])
        for pid, value in [("p0", 3), ("p1", 1), ("p2", 2)]:
            self.act(state, "sell", pid, property=value)
        return state

    def test_final_round_also_requires_all_ready_before_showing_scores(self):
        state = self.final_fixture([3, 4, 3], [[5], [6], [7]])
        self.assertEqual(state["phase"], "round_end")
        self.assertFalse(state["game_over"])
        self.assertEqual(state["final_results"], [])
        self.assertEqual(state["winner"], [])
        self.act(state, "next_round", "p0")
        self.act(state, "next_round", "p1")
        self.assertFalse(state["game_over"])
        self.assertIsNone(Game.get_public_view(state, "p0")["players"][1]["cash"])
        self.act(state, "next_round", "p2")
        self.assertEqual(state["phase"], "game_over")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])
        self.assertEqual(state["final_results"], [
            {"player_id": "p1", "cash": 4, "checks": 6, "total": 10, "rank": 1},
            {"player_id": "p0", "cash": 3, "checks": 7, "total": 10, "rank": 2},
            {"player_id": "p2", "cash": 3, "checks": 7, "total": 10, "rank": 2},
        ])
        for record in Game.get_public_view(state, "spectator")["players"]:
            self.assertIsNotNone(record["cash"])
            self.assertEqual(record["total"], 10)

    def test_equal_total_and_cash_share_the_win(self):
        state = self.final_fixture([4, 4, 2], [[4], [6], [8]])
        self.confirm_all(state)
        self.assertEqual(state["winner"], ["p0", "p1"])
        self.assertEqual([row["rank"] for row in state["final_results"]], [1, 1, 3])

    def test_finished_game_rejects_all_actions_without_mutation(self):
        state = self.final_fixture([4, 4, 2], [[4], [6], [8]])
        self.confirm_all(state)
        for pid in state["turn_order"]:
            self.assertEqual(Game.get_legal_actions(state, pid), [])
            self.assertIsNone(Game.bot_move(state, pid))
            for action in [{"type": "next_round", "round": 9},
                           {"type": "sell", "round": 9, "property": 3},
                           {"type": "pass", "round": 9, "turn": 1},
                           {"type": "bid", "round": 9, "turn": 1, "amount": 1}]:
                self.assert_rejected(state, pid, action)

    def test_unknown_player_and_out_of_turn_actions_do_not_mutate(self):
        state = self.buy_fixture()
        for actor in ["p1", "spectator", None, []]:
            self.assert_rejected(state, actor, {"type": "bid", "round": 1, "turn": 1, "amount": 1})
        self.assert_rejected(state, "p0", {"type": "sell", "round": 1, "property": 3})
        self.assert_rejected(state, "p0", {"type": "next_round", "round": 1})

    def test_malformed_unknown_and_noninteger_actions_do_not_mutate(self):
        state = self.buy_fixture()
        valid = {"type": "bid", "round": 1, "turn": 1, "amount": 1}
        actions = [None, [], False, "bid", {}, {"type": "cheat"},
                   {**valid, "extra": 1}, {**valid, "property": 4},
                   {"type": "pass", "round": 1, "turn": 1, "amount": 1}]
        for key in valid:
            candidate = dict(valid)
            del candidate[key]
            actions.append(candidate)
        for key in ["round", "turn", "amount"]:
            for value in [True, False, "1", 1.0, 1.5, None, [], {}, -1, 0]:
                actions.append({**valid, key: value})
        for action in actions:
            with self.subTest(action=action):
                self.assert_rejected(state, "p0", action)
        state = self.sell_fixture()
        for value in [True, "4", 4.0, 0, 31]:
            self.assert_rejected(state, "p0", {"type": "sell", "round": 9, "property": value})
        self.assert_rejected(state, "p0", {"type": "sell", "round": 9, "property": 4, "turn": 1})

    def test_bid_limits_and_stale_round_or_turn_do_not_mutate(self):
        state = self.buy_fixture()
        for fields in [{"round": 2}, {"turn": 2}, {"amount": 19}]:
            self.assert_rejected(state, "p0", {"type": "bid", "round": 1, "turn": 1, "amount": 1, **fields})
        self.act(state, "bid", amount=3)
        for amount in [1, 3, 19]:
            self.assert_rejected(state, "p1", {"type": "bid", "round": 1, "turn": 2, "amount": amount})
        self.assert_rejected(state, "p1", {"type": "pass", "round": 2, "turn": 2})
        self.assert_rejected(state, "p1", {"type": "pass", "round": 1, "turn": 1})
        self.act(state, "bid", amount=4)
        self.act(state, "bid", amount=5)
        self.assert_rejected(state, "p0", {"type": "bid", "round": 1, "turn": 1, "amount": 6})

    def test_other_players_secrets_and_future_decks_are_absent(self):
        state = self.sell_fixture()
        state["players"]["p1"].update(selection=30, checks=[3, 15], cash=7)
        state["players"]["p0"].update(checks=[2], cash=9)
        view = Game.get_public_view(state, "p0")
        expected_keys = {"game_id", "you", "phase", "stage", "round", "stage_round",
                         "rounds_per_stage", "turn", "current_turn", "start_player", "game_over",
                         "winner", "config", "market_properties", "market_checks", "high_bid",
                         "high_bidder", "active_players", "next_ready", "your_properties",
                         "your_checks", "your_cash", "your_bid", "your_selection", "min_bid",
                         "max_bid", "legal_actions", "players", "round_summary", "final_results", "log",
                         "history", "auction_results"}
        self.assertEqual(set(view), expected_keys)
        self.assertEqual((view["your_cash"], view["your_checks"]), (9, [2]))
        self.assertEqual((view["players"][0]["cash"], view["players"][0]["total"]), (9, 11))
        self.assertIsNone(view["players"][1]["cash"])
        self.assertIsNone(view["players"][1]["total"])
        self.assertTrue(view["players"][1]["submitted"])
        altered = copy.deepcopy(state)
        altered["players"]["p1"].update(properties=[1, 23], selection=23, checks=[0, 2], cash=3)
        altered["property_deck"].reverse()
        altered["check_deck"].reverse()
        altered["removed_properties"] = [20, 21]
        altered["removed_checks"] = [2, 2]
        self.assertEqual(Game.get_public_view(altered, "p0"), view)

    def test_spectator_has_no_private_hand_cash_or_actions(self):
        view = Game.get_public_view(self.sell_fixture(), "spectator")
        self.assertEqual(view["your_properties"], [])
        self.assertEqual(view["your_checks"], [])
        self.assertIsNone(view["your_cash"])
        self.assertIsNone(view["your_selection"])
        self.assertEqual(view["legal_actions"], [])
        self.assertTrue(all(player["cash"] is None and player["total"] is None for player in view["players"]))

    def test_public_views_and_save_payloads_are_deep_copies(self):
        state = self.buy_fixture()
        self.act(state, "pass")
        self.act(state, "pass")
        snapshot = copy.deepcopy(state)
        view = Game.get_public_view(state, "p0")
        view["your_properties"].append(99)
        view["players"][0]["name"] = "Changed"
        view["round_summary"]["rows"][0]["paid"] = 99
        view["log"][0]["text"] = "Changed"
        view["active_players"].clear()
        view["next_ready"].append("p0")
        self.assertEqual(state, snapshot)
        saved = Game.serialize(state)
        self.assertEqual(Game.deserialize(json.loads(json.dumps(saved))), state)
        saved["players"]["p0"]["properties"].clear()
        saved["property_deck"].clear()
        saved["player_meta"]["p0"]["name"] = "Changed"
        self.assertEqual(state, snapshot)
        payload = Game.serialize(state)
        restored = Game.deserialize(payload)
        restored["players"]["p0"]["properties"].clear()
        restored["removed_properties"].clear()
        self.assertEqual(payload, snapshot)

    def test_bot_receives_only_its_public_view_and_confirms_only_itself(self):
        state = self.buy_fixture()
        public = Game.get_public_view(state, "p0")
        with patch("game.for_sale._choose_bot_action", return_value=None) as choose:
            Game.bot_move(state, "p0")
        choose.assert_called_once_with(public)
        self.act(state, "pass")
        self.act(state, "pass")
        snapshot = copy.deepcopy(state)
        action = Game.bot_move(state, "p0")
        self.assertEqual(state, snapshot)
        self.assertIsNone(Game.apply_action(state, "p0", action)[1])
        self.assertEqual(state["next_ready"], ["p0"])
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_bot_sale_uses_public_check_spread_and_ignores_hidden_cards(self):
        state = self.sell_fixture((7, 7, 7))
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["property"], 4)
        state["market_checks"] = [0, 7, 15]
        action = Game.bot_move(state, "p0")
        self.assertEqual(action["property"], 24)
        altered = copy.deepcopy(state)
        altered["players"]["p1"].update(properties=[1, 2], selection=2)
        altered["property_deck"].reverse()
        altered["check_deck"].reverse()
        self.assertEqual(Game.bot_move(altered, "p0"), action)

    def test_three_to_six_player_bots_finish_and_conserve_all_cards(self):
        for count in range(3, 7):
            for seed in [3, 112, 604]:
                with self.subTest(count=count, seed=seed):
                    source = random.Random(seed)
                    with patch("game.for_sale.random.shuffle", side_effect=source.shuffle), \
                            patch("game.for_sale.random.choice", side_effect=source.choice):
                        state = Game.init_game({}, players(count))
                    actions = 0
                    pauses = set()
                    while not state["game_over"] and actions < 2000:
                        progressed = False
                        for pid in state["turn_order"]:
                            if state["phase"] == "round_end":
                                pauses.add(state["round"])
                            action = Game.bot_move(state, pid)
                            if action is None:
                                continue
                            snapshot = copy.deepcopy(state)
                            self.assertEqual(Game.bot_move(state, pid), action)
                            self.assertEqual(state, snapshot)
                            events, error = Game.apply_action(state, pid, action)
                            self.assertIsNone(error, action)
                            self.assertTrue(events)
                            self.assert_conserved(state)
                            progressed = True
                            actions += 1
                        self.assertTrue(progressed or state["game_over"])
                    self.assertTrue(state["game_over"])
                    self.assertLess(actions, 2000)
                    self.assertEqual(len(pauses), state["rounds_per_stage"] * 2)
                    self.assertEqual(state["round"], state["rounds_per_stage"] * 2)
                    self.assertTrue(state["winner"])
                    self.assertEqual(len(state["final_results"]), count)
                    self.assertTrue(all(not player["properties"] for player in state["players"].values()))
                    self.assertTrue(all(len(player["checks"]) == state["rounds_per_stage"]
                                        for player in state["players"].values()))


if __name__ == "__main__":
    unittest.main()
