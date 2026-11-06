import copy
import random
import unittest
from unittest.mock import patch

from game.high_society import HighSocietyGame as Game, MONEY_VALUES, STATUS_CARDS
from game.high_society_ai import _cash_estimates, _cheapest_raise, _remaining_auctions, choose_action


def make_state(count=3, seed=79):
    generator = random.Random(seed)
    with patch("game.high_society.random.choice", generator.choice), patch("game.high_society.random.shuffle", generator.shuffle):
        state = Game.init_game({}, [
            {"player_id": f"p{index}", "name": f"Player {index}", "seat": index, "is_bot": True}
            for index in range(count)
        ])
    state.update(phase="normal_auction", current_turn="p0", start_player="p0", current_high_bid=0,
                 current_high_bidder=None, end_marker_revealed_count=0, game_over=False)
    set_card(state, "luxury_10")
    return state


def set_card(state, card_id):
    state["current_status"] = copy.deepcopy(next(card for card in STATUS_CARDS if card["id"] == card_id))


class HighSocietyAiTests(unittest.TestCase):
    def test_cheapest_raise_uses_combinations_and_preserves_small_change(self):
        self.assertEqual(_cheapest_raise([1000, 2000, 4000, 6000], 6000), [1000, 6000])
        self.assertEqual(_cheapest_raise([1000, 2000, 3000, 4000], 5000), [2000, 4000])
        self.assertEqual(_cheapest_raise([1000, 2000, 3000], 2000), [3000])
        self.assertIsNone(_cheapest_raise([1000, 2000], 3000))
        self.assertIsNone(_cheapest_raise([], 0))

    def test_combination_only_raise_is_legal_and_applies(self):
        state = make_state()
        state["players"]["p0"]["hand_money"] = [1000, 2000]
        state["players"]["p0"]["table_money"] = [4000]
        state["current_high_bid"] = 6000
        self.assertIn("bid", Game.get_legal_actions(state, "p0"))
        events, error = Game.apply_action(state, "p0", {"type": "bid", "money_values": [1000, 2000]})
        self.assertIsNone(error)
        self.assertEqual(state["current_high_bid"], 7000)
        self.assertEqual(events[0]["payload"]["total"], 7000)

    def test_equal_total_or_empty_hand_cannot_raise(self):
        state = make_state()
        state["players"]["p0"]["hand_money"] = [1000, 2000]
        state["current_high_bid"] = 3000
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["pass"])
        state["players"]["p0"]["hand_money"] = []
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["pass"])

    def test_ai_uses_combination_when_no_single_card_can_raise(self):
        state = make_state()
        state["players"]["p0"]["hand_money"] = [1000, 2000, 3000, 4000]
        state["players"]["p1"]["hand_money"] = []
        state["current_high_bid"] = 4000
        action = Game.bot_move(state, "p0")
        self.assertEqual(action, {"type": "bid", "money_values": [2000, 3000]})
        self.assertIsNone(Game.apply_action(state, "p0", action)[1])

    def test_serialized_state_preserves_bot_choice(self):
        state = make_state()
        restored = Game.deserialize(copy.deepcopy(Game.serialize(state)))
        self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(restored, "p0"))

    def test_values_high_luxury_more_than_low_luxury(self):
        state = make_state()
        state["current_high_bid"] = 4000
        set_card(state, "luxury_1")
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})
        set_card(state, "luxury_10")
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "bid", "money_values": [2000, 3000]})

    def test_existing_table_money_is_added_not_replaced(self):
        state = make_state()
        state["players"]["p0"]["hand_money"].remove(4000)
        state["players"]["p0"]["table_money"] = [4000]
        state["current_high_bid"] = 6000
        action = Game.bot_move(state, "p0")
        self.assertEqual(action, {"type": "bid", "money_values": [3000]})
        self.assertIsNone(Game.apply_action(state, "p0", action)[1])
        self.assertEqual(state["players"]["p0"]["table_money"], [4000, 3000])

    def test_values_prestige_based_on_collection_and_future_auctions(self):
        state = make_state()
        state["end_marker_revealed_count"] = 3
        state["status_deck"] = [copy.deepcopy(STATUS_CARDS[12])]
        set_card(state, "prestige_2")
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})
        state["players"]["p0"]["status_cards"] = [copy.deepcopy(STATUS_CARDS[9])]
        state["players"]["p1"]["hand_money"] = [1000]
        self.assertEqual(Game.bot_move(state, "p0")["type"], "bid")

    def test_pending_faux_pas_does_not_pay_for_wasted_luxury_near_end(self):
        state = make_state()
        state["end_marker_revealed_count"] = 3
        state["status_deck"] = [copy.deepcopy(STATUS_CARDS[12])]
        state["players"]["p0"]["pending_faux_pas"] = True
        state["players"]["p0"]["status_cards"] = [copy.deepcopy(STATUS_CARDS[13])]
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})

    def test_scandale_with_negative_status_can_be_taken_for_free(self):
        state = make_state()
        state.update(phase="disgrace_auction", end_marker_revealed_count=3)
        state["status_deck"] = [copy.deepcopy(STATUS_CARDS[12])]
        state["players"]["p0"]["status_cards"] = [copy.deepcopy(STATUS_CARDS[14])]
        set_card(state, "scandale")
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})

    def test_disgrace_bids_to_protect_a_valuable_collection(self):
        state = make_state()
        state["phase"] = "disgrace_auction"
        state["players"]["p0"]["status_cards"] = copy.deepcopy(STATUS_CARDS[7:10])
        for card_id in ["passe", "scandale", "faux_pas"]:
            with self.subTest(card=card_id):
                set_card(state, card_id)
                self.assertEqual(Game.bot_move(state, "p0")["type"], "bid")

    def test_faux_pas_takes_small_loss_rather_than_overpaying(self):
        state = make_state()
        state.update(phase="disgrace_auction", current_high_bid=8000)
        state["players"]["p0"]["status_cards"] = copy.deepcopy([STATUS_CARDS[0], STATUS_CARDS[9]])
        set_card(state, "faux_pas")
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})

    def test_faux_pas_discards_lowest_luxury_and_nothing_else(self):
        state = make_state()
        state["phase"] = "choose_faux_pas"
        state["players"]["p0"]["status_cards"] = copy.deepcopy([STATUS_CARDS[9], STATUS_CARDS[2], STATUS_CARDS[10], STATUS_CARDS[13]])
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "choose_faux_pas_discard", "card_id": "luxury_3"})
        self.assertIsNone(Game.bot_move(state, "p1"))

    def test_cash_risk_avoids_becoming_tied_for_poorest(self):
        state = make_state()
        state.update(end_marker_revealed_count=3, current_high_bid=1000)
        state["status_deck"] = [copy.deepcopy(STATUS_CARDS[12])]
        state["players"]["p0"]["hand_money"] = [1000, 2000]
        state["players"]["p1"]["hand_money"] = [25000]
        state["players"]["p2"]["hand_money"] = [15000]
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})

    def test_cash_estimates_use_only_count_and_public_commitments(self):
        player = {"hand_count": 2, "table_money": [4000], "hand_money": [999999]}
        self.assertEqual(_cash_estimates(player, [1000, 2000, 3000, 4000]), [3000, 4000, 5000])

    def test_timer_horizon_uses_marker_count_without_deck_order(self):
        self.assertEqual(_remaining_auctions({"status_deck_count": 1, "end_marker_revealed_count": 3}), 0)
        self.assertGreater(_remaining_auctions({"status_deck_count": 10, "end_marker_revealed_count": 1}),
                           _remaining_auctions({"status_deck_count": 10, "end_marker_revealed_count": 3}))

    def test_hidden_hands_and_deck_order_cannot_affect_action(self):
        state = make_state()
        state["players"]["p1"]["hand_money"] = [1000, 2000, 3000, 4000]
        state["players"]["p2"]["hand_money"] = [6000, 8000]
        changed = copy.deepcopy(state)
        changed["players"]["p1"]["hand_money"] = [12000, 15000, 20000, 25000]
        changed["players"]["p2"]["hand_money"] = [1000, 2000]
        changed["status_deck"].reverse()
        self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(changed, "p0"))
        self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(changed, "p0"))

    def test_policy_is_deterministic_and_does_not_mutate_state_or_rng(self):
        state = make_state()
        original = copy.deepcopy(state)
        random_state = random.getstate()
        first = Game.bot_move(state, "p0")
        self.assertEqual(first, Game.bot_move(state, "p0"))
        self.assertEqual(state, original)
        self.assertEqual(random.getstate(), random_state)
        view = Game.get_public_view(state, "p0")
        snapshot = copy.deepcopy(view)
        self.assertEqual(choose_action(view, MONEY_VALUES), first)
        self.assertEqual(view, snapshot)

    def test_waiting_ready_spectator_and_finished_states(self):
        state = make_state()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "spectator"))
        state["phase"] = "round_summary"
        state["next_ready"] = ["p1"]
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "next_round"})
        self.assertIsNone(Game.bot_move(state, "p1"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_seeded_three_to_five_player_games_finish_with_legal_actions(self):
        for population in [3, 4, 5]:
            for seed in range(8):
                with self.subTest(population=population, seed=seed):
                    generator = random.Random(seed)
                    with patch("game.high_society.random.choice", generator.choice), patch("game.high_society.random.shuffle", generator.shuffle):
                        state = Game.init_game({}, [
                            {"player_id": f"p{index}", "name": f"Player {index}", "seat": index, "is_bot": True}
                            for index in range(population)
                        ])
                    for step in range(600):
                        if state["game_over"]:
                            break
                        player_id = next(player_id for player_id in state["turn_order"] if Game.get_legal_actions(state, player_id))
                        action = Game.bot_move(state, player_id)
                        self.assertIsNotNone(action, (seed, step, state["phase"]))
                        self.assertIn(action["type"], Game.get_legal_actions(state, player_id))
                        self.assertIsNone(Game.apply_action(state, player_id, action)[1])
                        for player in state["players"].values():
                            remaining = player["hand_money"] + player["table_money"]
                            self.assertEqual(len(remaining), len(set(remaining)))
                            self.assertTrue(set(remaining).issubset(MONEY_VALUES))
                    self.assertTrue(state["game_over"], (population, seed))
                    self.assertLessEqual(state["round"], 16)


if __name__ == "__main__":
    unittest.main()
