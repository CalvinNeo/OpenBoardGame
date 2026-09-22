import copy
import itertools
import random
import unittest
from unittest.mock import patch

from game.for_sale_ai_buy import (
    _bid_limit,
    _check_order_values,
    _money_value,
    _property_values,
    _public_accounts,
    choose_bid,
)


def auction_view(market=(1, 2, 30), count=3):
    cash = 18 if count <= 4 else 14
    removed = {3: 6, 4: 2, 5: 0, 6: 0}[count]
    return {
        "you": "p0", "round": 1, "turn": 1, "stage_round": 1,
        "rounds_per_stage": (30 - removed) // count,
        "players": [{"player_id": f"p{index}", "seat": index, "bid": 0,
                     "passed": False, "cash": None, "total": None}
                    for index in range(count)],
        "your_cash": cash, "your_bid": 0, "your_properties": [],
        "market_properties": list(market), "high_bid": 0,
        "min_bid": 1, "max_bid": cash,
        "active_players": [f"p{index}" for index in range(count)],
        "legal_actions": ["bid", "pass"], "history": [], "auction_results": [],
    }


class ForSaleBuyAITests(unittest.TestCase):
    def test_exact_check_order_expectation_matches_enumeration(self):
        checks = [0, 0, *[value for value in range(2, 16) for _ in range(2)]]
        samples = list(itertools.combinations(checks, 3))
        expected = [sum(sample[rank] for sample in samples) / len(samples) for rank in range(3)]
        for actual, reference in zip(_check_order_values(3), expected):
            self.assertAlmostEqual(actual, reference)
        for count in range(3, 7):
            values = _check_order_values(count)
            self.assertEqual(list(values), sorted(values))
            self.assertAlmostEqual(sum(values) / count, sum(checks) / len(checks))

    def test_existing_escrow_changes_incremental_cost_of_winning(self):
        self.assertEqual(_bid_limit(18, existing_bid=7, gain=5, future_rounds=0), 9)
        self.assertEqual(_bid_limit(18, existing_bid=0, gain=5, future_rounds=0), 5)
        self.assertEqual(_bid_limit(18, existing_bid=8, gain=5, future_rounds=0), 9)

    def test_future_auctions_raise_value_of_retained_cash(self):
        self.assertLess(_bid_limit(18, 0, 7, 7), _bid_limit(18, 0, 7, 0))
        self.assertEqual(_money_value(12, 0), 12)
        scarce_increment = _money_value(2, 7) - _money_value(1, 7)
        ample_increment = _money_value(18, 7) - _money_value(17, 7)
        self.assertGreater(scarce_increment, ample_increment)
        self.assertGreater(ample_increment, 1)

    def test_public_accounts_reconstruct_settlements_and_current_escrow(self):
        view = auction_view()
        view["history"] = [{"stage": "buy", "rows": [
            {"player_id": "p0", "property": 1, "paid": 1},
            {"player_id": "p1", "property": 15, "paid": 3},
            {"player_id": "p2", "property": 30, "paid": 7},
        ]}]
        view["auction_results"] = [{"player_id": "p2", "property": 2, "paid": 2}]
        view["your_properties"] = [1]
        view["your_cash"], view["your_bid"] = 13, 4
        view["players"][0]["bid"] = 4
        view["players"][1]["bid"] = 5
        view["players"][2]["passed"] = True
        cash, properties = _public_accounts(view)
        self.assertEqual(cash, {"p0": 17, "p1": 15, "p2": 9})
        self.assertEqual(properties, {"p0": [1], "p1": [15], "p2": [30, 2]})
        # An active player's bid is a deposit, not an additional settled loss.
        self.assertEqual(cash["p1"], 18 - 3)

    def test_revealed_sales_remove_previously_acquired_properties(self):
        view = auction_view()
        view["history"] = [
            {"stage": "buy", "rows": [{"player_id": "p1", "property": 30, "paid": 4}]},
            {"stage": "sell", "rows": [{"player_id": "p1", "property": 30, "check": 15}]},
        ]
        cash, properties = _public_accounts(view)
        self.assertEqual(properties["p1"], [])
        self.assertEqual(cash["p1"], 14)

    def test_public_opponent_properties_change_rank_value(self):
        view = auction_view((10, 20, 30))
        view["rounds_per_stage"] = 1
        against_high = _property_values(view, {"p0": [], "p1": [21], "p2": [22]})
        against_low = _property_values(view, {"p0": [], "p1": [1], "p2": [2]})
        self.assertAlmostEqual(against_high["p0"][20], _check_order_values(3)[0])
        self.assertAlmostEqual(against_high["p0"][30], _check_order_values(3)[-1])
        self.assertAlmostEqual(against_low["p0"][10], _check_order_values(3)[-1])
        self.assertEqual(against_low["p0"][10], against_low["p0"][30])

    def test_competes_for_large_upgrade_at_a_low_price(self):
        view = auction_view((1, 2, 30))
        action = choose_bid(view, random.Random(112))
        self.assertEqual(action["type"], "bid")
        self.assertGreaterEqual(action["amount"], 1)
        self.assertLessEqual(action["amount"], view["max_bid"])

    def test_passes_when_properties_are_nearly_equivalent(self):
        view = auction_view((28, 29, 30))
        for seed in [1, 112, 2026]:
            self.assertEqual(choose_bid(view, random.Random(seed))["type"], "pass")

    def test_can_choose_a_preemptive_raise(self):
        view = auction_view((1, 20, 30))
        action = choose_bid(view, random.Random(112))
        self.assertEqual(action["type"], "bid")
        self.assertGreater(action["amount"], view["min_bid"])
        self.assertLessEqual(action["amount"], view["max_bid"])

    def test_keeps_cash_value_even_in_the_last_auction(self):
        view = auction_view((28, 29, 30))
        view.update(stage_round=view["rounds_per_stage"], high_bid=7, min_bid=8)
        view["players"][1]["bid"] = 7
        self.assertEqual(choose_bid(view, random.Random(112))["type"], "pass")

    def test_cannot_bid_returns_pass_without_spending_randomness(self):
        view = auction_view()
        view["legal_actions"] = ["pass"]
        source = random.Random(112)
        before = source.getstate()
        self.assertEqual(choose_bid(view, source), {"type": "pass", "round": 1, "turn": 1})
        self.assertEqual(source.getstate(), before)

    def test_decision_does_not_mutate_public_view_or_global_random_state(self):
        view = auction_view()
        original = copy.deepcopy(view)
        global_state = random.getstate()
        action = choose_bid(view, random.Random(112))
        self.assertEqual(view, original)
        self.assertEqual(random.getstate(), global_state)
        self.assertEqual(choose_bid(view, random.Random(112)), action)

    def test_hidden_field_poisoning_does_not_change_decisions(self):
        view = auction_view()
        original = choose_bid(view, random.Random(112))
        altered = copy.deepcopy(view)
        altered.update(property_deck=[30], check_deck=[15], removed_properties=[1], removed_checks=[0])
        for player in altered["players"]:
            player.update(cash=999, total=999, properties=[30], checks=[15], selection=30)
        self.assertEqual(choose_bid(altered, random.Random(112)), original)

    def test_all_candidate_actions_share_the_same_opponent_samples(self):
        view = auction_view()
        with patch("game.for_sale_ai_buy._rollout", return_value=1) as simulate:
            choose_bid(view, random.Random(112))
        calls = simulate.call_args_list
        prices = {call.args[1] for call in calls}
        self.assertGreater(len(prices), 1)
        self.assertEqual(len(calls), 48 * len(prices))
        for offset in range(0, len(calls), len(prices)):
            sample_limits = calls[offset].args[-1]
            self.assertTrue(all(call.args[-1] is sample_limits
                                for call in calls[offset:offset + len(prices)]))

    def test_actions_are_legal_for_three_to_six_players_and_different_markets(self):
        source = random.Random(112)
        for count in range(3, 7):
            for trial in range(12):
                view = auction_view(sorted(source.sample(range(1, 31), count)), count)
                view["your_cash"] = source.randrange(1, view["your_cash"] + 1)
                view["max_bid"] = view["your_cash"]
                view["turn"] = trial + 1
                action = choose_bid(view, random.Random(trial))
                self.assertEqual(action["round"], view["round"])
                self.assertEqual(action["turn"], view["turn"])
                if action["type"] == "bid":
                    self.assertIs(type(action["amount"]), int)
                    self.assertGreaterEqual(action["amount"], view["min_bid"])
                    self.assertLessEqual(action["amount"], view["max_bid"])
                else:
                    self.assertEqual(action["type"], "pass")


if __name__ == "__main__":
    unittest.main()
