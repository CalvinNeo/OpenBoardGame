import copy
import json
import unittest
from unittest.mock import patch

from jsonschema import Draft7Validator

from game.ponzi_scheme import PonziSchemeGame as Game, _settle, _refill_market, industry_points, wealth_points
from game.ponzi_scheme_data import ACTION_SCHEMA, INDUSTRIES, INDUSTRY_SUPPLY, LUXURIES, build_cards


class PonziSchemeTests(unittest.TestCase):
    def make_game(self, count=3, **config):
        return Game.init_game({"seed": 100, **config}, [
            {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": i > 0}
            for i in range(count)])

    def act(self, state, pid, action):
        self.assertTrue(Draft7Validator(ACTION_SCHEMA).is_valid(action), action)
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error, (pid, action, error))
        self.assertTrue(events)
        return events

    def reject(self, state, pid, action):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, action)
        self.assertTrue(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def trading(self, **config):
        state = self.make_game(**config)
        state.update(phase="trading", round=2)
        for player in state["players"].values():
            player["cash"] = 100
            player["industries"]["grain"] = 1
        state["supply"]["grain"] -= 3
        return state

    def card(self, principal, remaining=None):
        card = next(card for card in build_cards() if card["principal"] == principal)
        if remaining is not None:
            card["remaining"] = remaining
        return card

    def prepare_crash(self):
        state = self.make_game()
        state.update(phase="market_remove", start_player="p1", current_turn="p1", round=2)
        values = [9, 10, 11, 12, 13, 65, 66, 67, 68]
        state["market"] = [self.card(value) for value in values]
        state["deck"] = [card for card in build_cards() if card["principal"] not in values]
        return state

    def test_manifest_matches_components_and_rulebook_examples(self):
        cards = build_cards()
        self.assertEqual([card["principal"] for card in cards], list(range(9, 81)))
        self.assertEqual(len({card["id"] for card in cards}), 72)
        self.assertEqual(sum(card["starting"] for card in cards), 9)
        self.assertEqual(sum(card["bear"] for card in cards), 16)
        self.assertEqual(sum(not card["bear"] and not card["starting"] for card in cards), 47)
        self.assertEqual([(self.card(n)["period"], self.card(n)["interest"]) for n in (9, 25, 72)], [(5, 8), (4, 27), (3, 128)])
        self.assertEqual([(spec["cost"], spec["points"]) for spec in LUXURIES.values()], [(30, 1), (56, 2), (78, 3), (96, 4)])

    def test_setup_zero_assets_sorted_market_and_determinism(self):
        for count in (3, 4, 5):
            state = self.make_game(count)
            self.assertEqual(state, self.make_game(count))
            self.assertEqual([card["principal"] for card in state["market"]], list(range(9, 18)))
            self.assertEqual(len(state["deck"]), 63)
            self.assertEqual(state["supply"], dict.fromkeys(INDUSTRIES, 15))
            self.assertTrue(all(player["cash"] == 0 and not player["debts"] for player in state["players"].values()))
            self.assertEqual(state["current_turn"], "p0")

    def test_invalid_setup(self):
        for count in (0, 1, 2, 6):
            with self.assertRaises(ValueError):
                self.make_game(count)
        for config in ({"advanced": 1}, {"seed": True}, {"seed": 1.0}, {"unknown": 1}, {"first_round_trading": "yes"}):
            with self.assertRaises(ValueError):
                self.make_game(**config)
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "same"}] * 3)

    def test_funding_takes_matching_row_and_schedules_once(self):
        state = self.make_game()
        self.reject(state, "p0", {"type": "fund", "industry": "grain", "card_id": "fund-17"})
        self.act(state, "p0", {"type": "fund", "industry": "grain", "card_id": "fund-9"})
        self.assertEqual(state["players"]["p0"]["cash"], 9)
        self.assertEqual(state["players"]["p0"]["debts"], [self.card(9, 5)])
        self.assertEqual(state["players"]["p0"]["industries"]["grain"], 1)
        self.assertEqual(state["supply"]["grain"], 14)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(len(state["market"]), 9)
        self.assertEqual(state["market"], sorted(state["market"], key=lambda card: card["principal"]))

    def test_second_and_third_industry_require_their_own_rows(self):
        for previous in (1, 2):
            state = self.make_game()
            state["players"]["p0"]["industries"]["estate"] = previous
            self.reject(state, "p0", {"type": "fund", "industry": "estate", "card_id": "fund-9"})
            selected = state["market"][previous * 3]
            self.act(state, "p0", {"type": "fund", "industry": "estate", "card_id": selected["id"]})
            self.assertEqual(state["players"]["p0"]["cash"], selected["principal"])

    def test_cannot_fund_fourth_industry_or_empty_supply(self):
        state = self.make_game()
        state["players"]["p0"]["industries"]["transport"] = 4
        state["supply"]["media"] = 0
        for industry in ("transport", "media"):
            self.reject(state, "p0", {"type": "fund", "industry": industry, "card_id": "fund-9"})
        for industry in INDUSTRIES:
            state["supply"][industry] = 0
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["pass"])

    def test_default_first_round_skips_trading_and_rotates_marker(self):
        state = self.make_game()
        for pid in state["turn_order"]:
            self.act(state, pid, {"type": "pass"})
        self.assertEqual((state["phase"], state["start_player"], state["current_turn"]), ("market_remove", "p1", "p1"))

    def test_optional_first_round_trading_and_player_order(self):
        state = self.make_game(first_round_trading=True)
        for phase in ("funding", "trading"):
            for pid in state["turn_order"]:
                self.assertEqual((state["phase"], state["current_turn"]), (phase, pid))
                self.act(state, pid, {"type": "pass"})
        self.assertEqual((state["phase"], state["current_turn"]), ("market_remove", "p1"))

    def test_offer_validates_common_industry_cash_and_whole_number(self):
        state = self.trading()
        for action in (
            {"type": "offer_trade", "target": "p0", "industry": "grain", "amount": 10},
            {"type": "offer_trade", "target": "outsider", "industry": "grain", "amount": 10},
            {"type": "offer_trade", "target": "p1", "industry": "media", "amount": 10},
            *[{"type": "offer_trade", "target": "p1", "industry": "grain", "amount": value} for value in (-1, 101, True, 1.0, "2")],
        ):
            self.reject(state, "p0", action)

    def test_sell_transfers_cash_and_industry_above_funding_limit(self):
        state = self.trading()
        state["players"]["p0"]["industries"]["grain"] = 3
        state["players"]["p1"]["cash"] = 20
        state["players"]["p1"]["debts"] = [self.card(25, 4)]
        self.act(state, "p0", {"type": "offer_trade", "target": "p1", "industry": "grain", "amount": 30})
        self.assertEqual(state["players"]["p0"]["cash"], 70)
        self.assertEqual((state["phase"], state["current_turn"]), ("trade_response", "p1"))
        self.act(state, "p1", {"type": "respond_trade", "response": "sell"})
        self.assertEqual((state["players"]["p0"]["cash"], state["players"]["p1"]["cash"]), (70, 50))
        self.assertEqual(state["players"]["p0"]["industries"]["grain"], 4)
        self.assertEqual(state["players"]["p1"]["industries"]["grain"], 0)
        self.assertEqual(state["players"]["p1"]["debts"], [self.card(25, 4)])
        self.assertIsNone(state["offer"])

    def test_counterbuy_returns_escrow_plus_equal_payment_and_resumes_initiator_order(self):
        state = self.trading()
        total = sum(player["cash"] for player in state["players"].values())
        self.act(state, "p0", {"type": "offer_trade", "target": "p2", "industry": "grain", "amount": 30})
        self.assertEqual(sum(player["cash"] for player in state["players"].values()) + state["offer"]["amount"], total)
        self.act(state, "p2", {"type": "respond_trade", "response": "buy"})
        self.assertEqual((state["players"]["p0"]["cash"], state["players"]["p2"]["cash"]), (130, 70))
        self.assertEqual(state["players"]["p2"]["industries"]["grain"], 2)
        self.assertEqual(sum(player["cash"] for player in state["players"].values()), total)
        self.assertEqual((state["phase"], state["current_turn"]), ("trading", "p1"))

    def test_zero_price_works_both_directions(self):
        for response in ("buy", "sell"):
            state = self.trading()
            for player in state["players"].values():
                player["cash"] = 0
            self.act(state, "p0", {"type": "offer_trade", "target": "p1", "industry": "grain", "amount": 0})
            self.act(state, "p1", {"type": "respond_trade", "response": response})
            buyer = "p1" if response == "buy" else "p0"
            self.assertEqual(state["players"][buyer]["industries"]["grain"], 2)
            self.assertTrue(all(player["cash"] == 0 for player in state["players"].values()))

    def test_trade_cannot_be_refused_repriced_or_answered_by_another_player(self):
        state = self.trading()
        state["players"]["p1"]["cash"] = 5
        self.act(state, "p0", {"type": "offer_trade", "target": "p1", "industry": "grain", "amount": 10})
        self.reject(state, "p1", {"type": "respond_trade", "response": "buy"})
        self.reject(state, "p1", {"type": "pass"})
        self.reject(state, "p2", {"type": "respond_trade", "response": "sell"})
        self.reject(state, "p1", {"type": "respond_trade", "response": "sell", "amount": 5})
        self.act(state, "p1", {"type": "respond_trade", "response": "sell"})
        self.reject(state, "p1", {"type": "respond_trade", "response": "sell"})

    def test_luxury_consumes_trading_opportunity_and_is_unique(self):
        state = self.trading(advanced=True)
        self.act(state, "p0", {"type": "buy_luxury", "luxury": "jewels"})
        self.assertEqual(state["players"]["p0"]["cash"], 70)
        self.assertEqual(state["players"]["p0"]["luxuries"], ["jewels"])
        self.assertEqual(state["current_turn"], "p1")
        self.reject(state, "p1", {"type": "buy_luxury", "luxury": "jewels"})
        state["players"]["p1"]["cash"] = 55
        self.reject(state, "p1", {"type": "buy_luxury", "luxury": "car"})
        self.reject(self.trading(), "p0", {"type": "buy_luxury", "luxury": "jewels"})

    def test_market_removal_by_new_starter_and_start_cards_leave_game(self):
        state = self.make_game()
        for pid in state["turn_order"]:
            self.act(state, pid, {"type": "pass"})
        self.reject(state, "p0", {"type": "remove_fund", "card_id": "fund-9"})
        self.act(state, "p1", {"type": "remove_fund", "card_id": "fund-9"})
        self.assertEqual(state["removed"], [self.card(9)])
        self.assertFalse(state["discard"])
        self.assertEqual(state["phase"], "round_end")

    def test_normal_removed_cards_go_to_discard_and_empty_deck_recycles(self):
        state = self.make_game()
        state.update(phase="market_remove")
        state["market"][0] = self.card(25)
        state["deck"] = [card for card in state["deck"] if card["principal"] != 25]
        state["market"].sort(key=lambda card: card["principal"])
        self.act(state, "p0", {"type": "remove_fund", "card_id": "fund-25"})
        self.assertEqual(state["discard"], [self.card(25)])
        state["deck"] = []
        state["market"].pop()
        _refill_market(state)
        self.assertFalse(state["discard"])
        self.assertIn(self.card(25), state["market"])

    def test_bears_only_checked_after_marker_removal(self):
        state = self.prepare_crash()
        state.update(phase="funding", current_turn="p0")
        self.act(state, "p0", {"type": "fund", "industry": "grain", "card_id": "fund-9"})
        self.assertEqual(state["phase"], "funding")
        self.assertFalse(state["crashed"])

    def test_crash_forces_largest_industry_tie_choice_and_new_starter_order(self):
        state = self.prepare_crash()
        state["players"]["p1"]["industries"].update(grain=2, media=2, transport=1)
        state["players"]["p0"]["industries"].update(estate=1)
        self.act(state, "p1", {"type": "remove_fund", "card_id": "fund-9"})
        self.assertEqual((state["phase"], state["current_turn"]), ("crash_discard", "p1"))
        self.assertEqual(Game.get_public_view(state, "p1")["crash_choices"], ["grain", "media"])
        self.reject(state, "p1", {"type": "discard_industry", "industry": "transport"})
        stock = state["supply"]["grain"]
        self.act(state, "p1", {"type": "discard_industry", "industry": "grain"})
        self.assertEqual(state["supply"]["grain"], stock + 1)
        self.assertEqual(state["current_turn"], "p0")  # Empty p2 is skipped.
        self.act(state, "p0", {"type": "discard_industry", "industry": "estate"})
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["last_round"]["steps"], 2)

    def test_crash_restock_does_not_crash_recursively(self):
        state = self.prepare_crash()
        with patch("game.ponzi_scheme._shuffle", lambda *_: None):
            self.act(state, "p1", {"type": "remove_fund", "card_id": "fund-9"})
        self.assertGreaterEqual(sum(card["bear"] for card in state["market"]), 3)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["wheel_steps"], 2)
        self.assertEqual(sum("触发市场崩盘" in note for note in state["round_notes"]), 1)

    def test_normal_interest_resets_debts_and_never_reissues_principal(self):
        state = self.make_game()
        player = state["players"]["p0"]
        player.update(cash=100, debts=[self.card(9, 1)])
        _settle(state)
        self.assertEqual((player["cash"], player["debts"][0]["remaining"]), (92, 5))
        for _ in range(5):
            _settle(state)
        self.assertEqual((player["cash"], player["debts"][0]["remaining"]), (84, 5))
        self.assertEqual(len(player["debts"]), 1)

    def test_crash_crossing_due_point_matches_rulebook_example(self):
        state = self.make_game()
        state["crashed"] = True
        player = state["players"]["p0"]
        player.update(cash=200, debts=[self.card(80, 1), self.card(25, 2), self.card(9, 3)])
        _settle(state)
        self.assertEqual(player["cash"], 200 - 144 - 27)
        self.assertEqual([card["remaining"] for card in player["debts"]], [3, 4, 1])
        self.assertEqual(state["last_round"]["payments"][0]["due"], 171)

    def test_everyone_resolves_interest_before_any_final_score(self):
        state = self.make_game()
        for pid, cash in (("p0", 0), ("p1", 10), ("p2", 7)):
            state["players"][pid].update(cash=cash, debts=[self.card(9, 1)])
        _settle(state)
        self.assertEqual([state["players"][pid]["bankrupt"] for pid in state["turn_order"]], [True, False, True])
        self.assertEqual(state["players"]["p1"]["cash"], 2)
        self.assertEqual(state["winner"], ["p1"])
        self.assertEqual(state["phase"], "game_over")

    def test_exact_cash_pays_successfully_and_wealth_is_after_payment(self):
        state = self.make_game()
        state["players"]["p0"].update(cash=8, debts=[self.card(9, 1)])
        state["players"]["p1"].update(cash=30, debts=[self.card(9, 1)])
        state["players"]["p2"].update(cash=0, debts=[self.card(9, 1)])
        _settle(state)
        self.assertFalse(state["players"]["p0"]["bankrupt"])
        self.assertEqual(state["players"]["p0"]["cash"], 0)
        self.assertEqual(state["results"][1]["wealth_points"], 0)

    def test_all_bankrupt_has_no_winner(self):
        state = self.make_game()
        for player in state["players"].values():
            player["debts"] = [self.card(80, 1)]
        _settle(state)
        self.assertEqual(state["winner"], [])
        self.assertTrue(all(result["total"] is None for result in state["results"]))

    def test_scoring_thresholds_and_industry_growth(self):
        self.assertEqual([industry_points(n) for n in range(8)], [0, 1, 3, 6, 10, 15, 21, 28])
        self.assertEqual([wealth_points(n) for n in (0, 29, 30, 55, 56, 77, 78, 95, 96, 160)], [0, 0, 1, 1, 2, 2, 3, 3, 4, 4])

    def test_rulebook_final_score_and_highest_fund_tiebreak(self):
        state = self.make_game()
        for pid, highest in (("p0", 62), ("p1", 45)):
            player = state["players"][pid]
            player.update(cash=160, debts=[self.card(highest, 5)])
            player["industries"].update(transport=3, media=2, estate=1)
        state["players"]["p2"].update(debts=[self.card(80, 1)])
        _settle(state)
        self.assertEqual([result["total"] for result in state["results"]], [14, 14, None])
        self.assertEqual(state["winner"], ["p0"])

    def test_equal_survivors_share_win_and_bankrupt_cannot_win(self):
        state = self.make_game()
        state["players"]["p2"]["industries"]["grain"] = 10
        state["players"]["p2"]["debts"] = [self.card(80, 1)]
        _settle(state)
        self.assertEqual(state["winner"], ["p0", "p1"])

    def test_advanced_scores_luxuries_and_no_cash_bonus(self):
        state = self.make_game(advanced=True)
        state["players"]["p0"].update(cash=200, luxuries=["car", "penthouse"])
        state["players"]["p1"]["cash"] = 1000
        state["players"]["p2"]["debts"] = [self.card(80, 1)]
        _settle(state)
        self.assertEqual(state["results"][0]["total"], 6)
        self.assertTrue(all(result["wealth_points"] == 0 for result in state["results"]))
        self.assertEqual(state["winner"], ["p0"])

    def test_round_review_waits_for_each_seat_including_bots(self):
        state = self.make_game()
        state["start_player"] = "p1"
        _settle(state)
        self.act(state, "p0", {"type": "next_round"})
        self.assertEqual(state["phase"], "round_end")
        self.reject(state, "p0", {"type": "next_round"})
        self.reject(state, "outsider", {"type": "next_round"})
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "next_round"})
        self.act(state, "p1", {"type": "next_round"})
        self.assertEqual(state["round"], 1)
        self.act(state, "p2", {"type": "next_round"})
        self.assertEqual((state["round"], state["phase"], state["current_turn"]), (2, "funding", "p1"))
        self.assertEqual(state["next_ready"], [])
        self.assertEqual(state["last_round"]["round"], 1)

    def test_private_cash_offer_history_seed_and_events_do_not_leak(self):
        state = self.trading()
        state["players"]["p0"]["cash"] = 987654
        state["players"]["p1"]["cash"] = 888888
        events = self.act(state, "p0", {"type": "offer_trade", "target": "p1", "industry": "grain", "amount": 7331})
        for viewer in ("p2", "spectator"):
            view = Game.get_public_view(state, viewer)
            self.assertNotIn("amount", view["offer"])
            self.assertNotIn("seed", view)
            self.assertNotIn("deck", view)
            self.assertNotIn("7331", json.dumps(view))
            self.assertNotIn("888888", json.dumps(view))
            self.assertEqual(view["private_trades"], [])
        self.assertEqual(Game.get_public_view(state, "p0")["offer"]["amount"], 7331)
        self.assertEqual(Game.get_public_view(state, "p1")["offer"]["amount"], 7331)
        self.assertNotIn("7331", json.dumps(events))
        self.act(state, "p1", {"type": "respond_trade", "response": "sell"})
        self.assertEqual(len(Game.get_public_view(state, "p0")["private_trades"]), 1)
        self.assertEqual(Game.get_public_view(state, "p2")["private_trades"], [])
        self.assertNotIn("7331", json.dumps(Game.get_public_view(state, "p2")))

    def test_public_views_are_detached_and_only_reveal_own_cash(self):
        state = self.trading()
        view = Game.get_public_view(state, "p0")
        self.assertEqual([player["cash"] for player in view["players"]], [100, None, None])
        view["market"][0]["principal"] = -1
        view["players"][0]["industries"]["grain"] = 100
        self.assertEqual(state["market"][0]["principal"], 9)
        self.assertEqual(state["players"]["p0"]["industries"]["grain"], 1)

    def test_bot_is_invariant_to_hidden_cash_and_deck_order(self):
        state = self.trading()
        expected = Game.bot_move(state, "p0")
        alternative = copy.deepcopy(state)
        alternative["players"]["p1"]["cash"] = 0
        alternative["players"]["p2"]["cash"] = 99999
        alternative["deck"].reverse()
        alternative["seed"] = "different-private-seed"
        self.assertEqual(Game.bot_move(alternative, "p0"), expected)
        self.assertIsNone(Game.bot_move(state, "p1"))

    def test_save_restore_inflight_offer_and_independent_serialization(self):
        state = self.trading()
        self.act(state, "p0", {"type": "offer_trade", "target": "p1", "industry": "grain", "amount": 37})
        payload = Game.serialize(state)
        restored = Game.deserialize(json.loads(json.dumps(payload)))
        self.assertEqual(restored, state)
        self.act(restored, "p1", {"type": "respond_trade", "response": "buy"})
        self.assertIsNotNone(state["offer"])
        self.act(state, "p1", {"type": "respond_trade", "response": "buy"})
        self.assertEqual(restored, state)
        self.assertIsNotNone(payload["offer"])

    def test_restore_preserves_shuffle_sequence_and_round_confirmations(self):
        state = self.prepare_crash()
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        for game in (state, restored):
            self.act(game, "p1", {"type": "remove_fund", "card_id": "fund-9"})
            self.act(game, "p0", {"type": "next_round"})
        self.assertEqual(state, restored)
        again = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(again["next_ready"], ["p0"])

    def test_malformed_out_of_turn_and_unknown_actions_are_atomic(self):
        state = self.make_game()
        for action in (None, [], {}, {"type": "hack"}, {"type": "pass", "cash": 999}, {"type": "fund", "industry": "grain"}):
            self.reject(state, "p0", action)
        self.reject(state, "p1", {"type": "pass"})
        self.reject(state, "outsider", {"type": "pass"})

    def test_full_bot_games_preserve_cards_industries_cash_and_finish(self):
        for count in (3, 4, 5):
            for advanced in (False, True):
                for seed in (1, 11, 100):
                    with self.subTest(count=count, advanced=advanced, seed=seed):
                        state = self.make_game(count, advanced=advanced, seed=seed)
                        for _ in range(700):
                            cards = state["market"] + state["deck"] + state["discard"] + state["removed"]
                            for player in state["players"].values():
                                cards += player["debts"]
                                self.assertGreaterEqual(player["cash"], 0)
                            self.assertEqual(len(cards), 72)
                            self.assertEqual(len({card["id"] for card in cards}), 72)
                            for industry in INDUSTRIES:
                                self.assertEqual(state["supply"][industry] + sum(player["industries"][industry] for player in state["players"].values()), INDUSTRY_SUPPLY)
                            if state["game_over"]:
                                break
                            pid = next((pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid)), None)
                            self.assertIsNotNone(pid, state["phase"])
                            self.act(state, pid, Game.bot_move(state, pid))
                        self.assertTrue(state["game_over"])
                        self.assertTrue(any(player["bankrupt"] for player in state["players"].values()))


if __name__ == "__main__":
    unittest.main()
