import copy
import json
import random
import time
import unittest
from unittest.mock import patch

from game.for_sale import ForSaleGame as Game
from game.for_sale_ai import CHECK_VALUES, _check_expectations, choose_action


def new_game(count=3, seed=112):
    source = random.Random(seed)
    players = [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index,
                "is_bot": True} for index in range(count)]
    with patch("game.for_sale.random.shuffle", side_effect=source.shuffle), \
            patch("game.for_sale.random.choice", side_effect=source.choice):
        return Game.init_game({}, players)


def apply(state, pid, action):
    _, error = Game.apply_action(state, pid, action)
    if error:
        raise AssertionError((pid, action, error))


def reach_selling(state):
    for _ in range(200):
        if state["phase"] == "sell":
            return
        if state["phase"] == "buy":
            apply(state, state["current_turn"], {
                "type": "pass", "round": state["round"], "turn": state["turn"],
            })
        elif state["phase"] == "round_end":
            for pid in state["turn_order"]:
                apply(state, pid, {"type": "next_round", "round": state["round"]})
        else:
            raise AssertionError(state["phase"])
    raise AssertionError("Buying did not finish")


class ForSaleAiTests(unittest.TestCase):
    def remembered_sale(self, hands, checks):
        state = new_game(len(hands))
        count = len(hands[0])
        state.update(phase="sell", stage="sell", stage_round=1, round=count + 1,
                     rounds_per_stage=count, current_turn=None, active_players=[],
                     market_properties=[], market_checks=list(checks), history=[])
        for pid, hand in zip(state["turn_order"], hands):
            state["players"][pid]["properties"] = list(hand)
        for index in range(count):
            rows = [{"player_id": pid, "property": hand[index], "bid": 0,
                     "paid": 0, "refund": 0}
                    for pid, hand in zip(state["turn_order"], hands)]
            state["history"].append({
                "stage": "buy", "stage_round": index + 1, "rows": rows,
                "winner": max(rows, key=lambda row: row["property"])["player_id"],
            })
        return state

    def assert_legal_decision(self, state, pid):
        view = Game.get_public_view(state, pid)
        action = choose_action(view)
        if view["legal_actions"]:
            self.assertIsInstance(action, dict)
            self.assertIn(action["type"], view["legal_actions"])
            apply(copy.deepcopy(state), pid, action)
        else:
            self.assertIsNone(action)
        return action

    def test_future_decks_and_removed_cards_cannot_change_bidding(self):
        for count in range(3, 7):
            with self.subTest(count=count):
                state = new_game(count)
                pid = state["current_turn"]
                altered = copy.deepcopy(state)
                altered["property_deck"].reverse()
                altered["check_deck"].reverse()
                altered["removed_properties"].reverse()
                altered["removed_checks"].reverse()
                for other in state["turn_order"]:
                    if other != pid:
                        altered["players"][other]["cash"] = 0
                view = Game.get_public_view(state, pid)
                self.assertEqual(view, Game.get_public_view(altered, pid))
                self.assertEqual(Game.bot_move(state, pid), Game.bot_move(altered, pid))
                self.assertEqual(Game.bot_move(state, pid), choose_action(view))
                self.assert_legal_decision(state, pid)

    def test_opponent_sealed_choices_and_future_checks_do_not_change_sale(self):
        for count in [3, 6]:
            with self.subTest(count=count):
                state = new_game(count)
                reach_selling(state)
                opponent = state["turn_order"][1]
                hidden_hand = state["players"][opponent]["properties"]
                apply(state, opponent, {
                    "type": "sell", "round": state["round"], "property": hidden_hand[0],
                })
                altered = copy.deepcopy(state)
                altered["players"][opponent]["selection"] = hidden_hand[-1]
                altered["check_deck"].reverse()
                altered["removed_checks"].reverse()
                pid = state["turn_order"][0]
                view = Game.get_public_view(state, pid)
                self.assertEqual(view, Game.get_public_view(altered, pid))
                self.assertEqual(Game.bot_move(state, pid), Game.bot_move(altered, pid))
                self.assertEqual(Game.bot_move(state, pid), choose_action(view))
                self.assert_legal_decision(state, pid)

    def test_decisions_are_pure_deterministic_and_do_not_consume_global_random(self):
        state = new_game(6)
        buying = Game.get_public_view(state, state["current_turn"])
        reach_selling(state)
        selling = Game.get_public_view(state, "p0")
        for view in [buying, selling]:
            with self.subTest(phase=view["phase"]):
                before = copy.deepcopy(view)
                rng_state = random.getstate()
                first = choose_action(view)
                for _ in range(3):
                    self.assertEqual(first, choose_action(json.loads(json.dumps(view))))
                self.assertEqual(view, before)
                self.assertEqual(random.getstate(), rng_state)

    def test_valid_legacy_views_without_history_still_produce_legal_actions(self):
        for count in range(3, 7):
            state = new_game(count)
            for selling in [False, True]:
                if selling:
                    reach_selling(state)
                pid = "p0" if selling else state["current_turn"]
                view = Game.get_public_view(state, pid)
                view.pop("history", None)
                with self.subTest(count=count, phase=view["phase"]):
                    before = copy.deepcopy(view)
                    action = choose_action(view)
                    apply(copy.deepcopy(state), pid, action)
                    self.assertEqual(view, before)
                    self.assertEqual(action, choose_action(view))

    def test_waiting_players_and_spectators_do_not_act(self):
        state = new_game()
        waiting = next(pid for pid in state["turn_order"] if pid != state["current_turn"])
        self.assertIsNone(choose_action(Game.get_public_view(state, waiting)))
        self.assertIsNone(choose_action(Game.get_public_view(state, "spectator")))
        reach_selling(state)
        pid = "p0"
        apply(state, pid, self.assert_legal_decision(state, pid))
        self.assertIsNone(choose_action(Game.get_public_view(state, pid)))

    def test_only_available_property_is_sold_and_exhausted_cash_passes(self):
        state = new_game()
        pid = state["current_turn"]
        state["players"][pid]["cash"] = 0
        action = self.assert_legal_decision(state, pid)
        self.assertEqual(action["type"], "pass")
        reach_selling(state)
        state["players"]["p0"]["properties"] = [30]
        action = self.assert_legal_decision(state, "p0")
        self.assertEqual(action["property"], 30)

    def test_equal_checks_preserve_every_stronger_property(self):
        for checks in [(0, 0, 0), (8, 8, 8), (15, 15, 15)]:
            state = self.remembered_sale([[4, 16, 30], [3, 10, 22], [2, 8, 25]], checks)
            with self.subTest(checks=checks):
                self.assertEqual(self.assert_legal_decision(state, "p0")["property"], 4)

    def test_public_purchases_identify_the_smallest_card_that_beats_every_opponent(self):
        state = self.remembered_sale([[4, 16, 30], [3, 10, 15], [2, 8, 14]], (0, 8, 15))
        self.assertEqual(self.assert_legal_decision(state, "p0")["property"], 16)

    def test_public_sales_lower_the_card_needed_to_win_the_next_market(self):
        state = self.remembered_sale([[4, 16, 30], [3, 10, 22], [2, 8, 25]], (0, 8, 15))
        for pid, card in zip(state["turn_order"], [4, 22, 25]):
            apply(state, pid, {"type": "sell", "round": state["round"], "property": card})
        for pid in state["turn_order"]:
            apply(state, pid, {"type": "next_round", "round": state["round"]})
        state["market_checks"] = [0, 8, 15]
        self.assertEqual(Game.get_public_view(state, "p0")["your_properties"], [16, 30])
        self.assertEqual(self.assert_legal_decision(state, "p0")["property"], 16)

    def test_check_order_expectations_preserve_total_value_and_duplicate_zeros(self):
        pool = tuple(sorted(CHECK_VALUES))
        self.assertEqual(pool.count(0), 2)
        for count in [3, 6]:
            expected = _check_expectations(pool, count)
            self.assertEqual(len(expected), count)
            self.assertEqual(tuple(sorted(expected)), expected)
            self.assertAlmostEqual(sum(expected), count * sum(CHECK_VALUES) / 30, places=10)
        self.assertEqual(_check_expectations((0, 0, 2), 3), (0, 0, 2))
        first, second = _check_expectations((0, 0, 15), 2)
        self.assertEqual(first, 0)
        self.assertAlmostEqual(second, 10, places=12)

    def test_history_only_appends_completed_rounds_and_is_a_deep_copy(self):
        state = new_game()
        self.assertEqual(Game.get_public_view(state, "p0")["history"], [])
        apply(state, state["current_turn"], {
            "type": "pass", "round": state["round"], "turn": state["turn"],
        })
        self.assertEqual(Game.get_public_view(state, "p0")["history"], [])
        apply(state, state["current_turn"], {
            "type": "pass", "round": state["round"], "turn": state["turn"],
        })
        view = Game.get_public_view(state, "p0")
        self.assertEqual(view["history"], [view["round_summary"]])
        view["history"][0]["rows"][0]["property"] = 99
        self.assertNotEqual(Game.get_public_view(state, "p0")["history"], view["history"])
        reach_selling(state)
        before = copy.deepcopy(Game.get_public_view(state, "p0")["history"])
        for index, pid in enumerate(state["turn_order"]):
            apply(state, pid, {
                "type": "sell", "round": state["round"],
                "property": state["players"][pid]["properties"][0],
            })
            current = Game.get_public_view(state, "p0")
            if index < len(state["turn_order"]) - 1:
                self.assertEqual(current["history"], before)
            else:
                self.assertEqual(current["history"], before + [current["round_summary"]])

    def test_representative_six_player_decisions_have_a_bounded_runtime(self):
        state = new_game(6)
        views = [Game.get_public_view(state, state["current_turn"])]
        reach_selling(state)
        views.extend(Game.get_public_view(state, pid) for pid in state["turn_order"])
        start = time.perf_counter()
        for view in views:
            self.assertIsNotNone(choose_action(view))
        # Deliberately generous for shared CI machines; benchmark reports actual latency.
        self.assertLess(time.perf_counter() - start, 15.0)


if __name__ == "__main__":
    unittest.main()
