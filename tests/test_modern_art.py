import copy
import json
import random
import unittest
from unittest.mock import patch

from game.modern_art import ARTISTS, CARDS, ModernArtGame as Game, _ModernArtPolicy, _choose_bot_action


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "round": state["round"],
            "step": state["step"], **fields}


def make_game(count=3):
    with patch("game.modern_art.random.shuffle", lambda deck: None):
        return Game.init_game({}, [{"player_id": f"player{index}", "name": f"Collector {index}",
                                    "seat": index} for index in range(count)])


def give(state, player_id, *cards):
    for card in cards:
        for player in state["players"].values():
            if card in player["hand"]:
                player["hand"].remove(card)
        if card in state["deck"]:
            state["deck"].remove(card)
        state["players"][player_id]["hand"].append(card)


class ModernArtTests(unittest.TestCase):
    def apply(self, state, player_id, kind, **fields):
        events, error = Game.apply_action(state, player_id, action(state, kind, **fields))
        self.assertIsNone(error, (state["phase"], kind, fields, error))
        return events

    def offer(self, kind, count=3):
        state = make_game(count)
        card = f"lite_metal-{kind}-0"
        give(state, "player0", card)
        self.apply(state, "player0", "offer", cards=[card])
        return state

    def confirm(self, state):
        for player_id in state["turn_order"]:
            self.apply(state, player_id, "next_round")

    def test_catalog_and_deal(self):
        self.assertEqual(len(CARDS), 70)
        self.assertEqual([sum(card["artist"] == artist["id"] for card in CARDS.values())
                          for artist in ARTISTS], [12, 13, 14, 15, 16])
        for count, hand_count in ((3, 10), (4, 9), (5, 8)):
            state = make_game(count)
            self.assertEqual([len(player["hand"]) for player in state["players"].values()], [hand_count] * count)
            self.assertEqual(len(state["deck"]), 70 - count * hand_count)
        for invalid in ([], [{"player_id": "same"}] * 3):
            with self.assertRaises(ValueError):
                Game.init_game({}, invalid)
        with self.assertRaises(ValueError):
            Game.init_game({"seed": 1}, [{"player_id": str(index)} for index in range(3)])

    def test_open_reentry_and_sale_pause(self):
        state = self.offer("open")
        self.apply(state, "player0", "bid", amount=5)
        self.apply(state, "player1", "pass")
        self.apply(state, "player2", "bid", amount=7)
        self.assertIn("bid", Game.get_legal_actions(state, "player1"))
        self.apply(state, "player1", "bid", amount=9)
        self.apply(state, "player0", "pass")
        self.apply(state, "player2", "pass")
        self.assertEqual(state["phase"], "auction_end")
        self.assertEqual(state["players"]["player1"]["cash"], 91)
        self.assertEqual(state["players"]["player0"]["cash"], 109)
        self.apply(state, "player0", "next_round")
        self.assertEqual(state["phase"], "auction_end")
        self.apply(state, "player1", "next_round")
        self.apply(state, "player2", "next_round")
        self.assertEqual(state["current_turn"], "player1")

    def test_open_everyone_declines_free(self):
        state = self.offer("open")
        self.apply(state, "player1", "pass")
        self.apply(state, "player2", "pass")
        self.assertEqual(state["auction"]["buyer"], "player0")
        self.assertEqual(state["auction"]["paid"], 0)

    def test_once_auctioneer_last_and_self_payment(self):
        state = self.offer("once")
        self.apply(state, "player1", "bid", amount=8)
        self.apply(state, "player2", "pass")
        self.assertEqual(state["current_turn"], "player0")
        self.apply(state, "player0", "bid", amount=9)
        self.assertEqual(state["players"]["player0"]["cash"], 91)
        self.assertEqual(state["players"]["player0"]["sales"], 0)

    def test_sealed_privacy_and_tie(self):
        state = self.offer("sealed")
        events = self.apply(state, "player1", "bid", amount=20)
        self.assertNotIn("20", json.dumps(events))
        for viewer in ("player0", "player1", "spectator"):
            view = Game.get_public_view(state, viewer)
            self.assertEqual(view["auction"]["bids"], {})
            self.assertEqual(view["your_bid"], 20 if viewer == "player1" else None)
            self.assertNotIn("deck", view)
            self.assertNotIn("player_meta", view)
            self.assertTrue(all("hand" not in player for player in view["players"]))
        self.apply(state, "player2", "bid", amount=20)
        self.apply(state, "player0", "bid", amount=20)
        self.assertEqual(state["auction"]["buyer"], "player0")
        self.assertEqual(len(Game.get_public_view(state, "spectator")["auction"]["bids"]), 3)

    def test_sealed_tie_after_auctioneer(self):
        state = self.offer("sealed")
        for player_id, amount in (("player2", 10), ("player0", 0), ("player1", 10)):
            self.apply(state, player_id, "bid", amount=amount)
        self.assertEqual(state["auction"]["buyer"], "player1")

    def test_fixed_price_refusal_and_purchase(self):
        state = self.offer("fixed")
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, "player0", action(state, "set_price", amount=101))[1])
        self.assertEqual(before, state)
        self.apply(state, "player0", "set_price", amount=12)
        self.apply(state, "player1", "pass")
        self.apply(state, "player2", "pass")
        self.assertEqual(state["players"]["player0"]["cash"], 88)
        state = self.offer("fixed")
        self.apply(state, "player0", "set_price", amount=0)
        self.apply(state, "player1", "buy")
        self.assertEqual(state["auction"]["buyer"], "player1")

    def test_double_own_pair(self):
        state = make_game()
        cards = ["lite_metal-double-0", "lite_metal-once-0"]
        give(state, "player0", *cards)
        self.apply(state, "player0", "offer", cards=cards)
        self.assertEqual(state["counts"]["lite_metal"], 2)
        self.assertEqual(state["phase"], "once")
        for player_id in ("player1", "player2", "player0"):
            self.apply(state, player_id, "pass")
        self.assertEqual(state["players"]["player0"]["gallery"], cards)

    def test_double_contributor_gets_all_proceeds_and_next_seller(self):
        state = self.offer("double")
        give(state, "player1", "lite_metal-once-0")
        self.apply(state, "player1", "add", card="lite_metal-once-0")
        self.apply(state, "player2", "bid", amount=11)
        self.apply(state, "player0", "pass")
        self.apply(state, "player1", "pass")
        self.assertEqual([state["players"][player_id]["cash"] for player_id in state["turn_order"]], [100, 111, 89])
        self.confirm(state)
        self.assertEqual(state["current_turn"], "player2")

    def test_double_original_seller_pays_contributor(self):
        state = self.offer("double")
        give(state, "player1", "lite_metal-once-0")
        self.apply(state, "player1", "add", card="lite_metal-once-0")
        self.apply(state, "player2", "pass")
        self.apply(state, "player0", "bid", amount=11)
        self.apply(state, "player1", "pass")
        self.assertEqual(state["players"]["player0"]["cash"], 89)
        self.assertEqual(state["players"]["player1"]["cash"], 111)

    def test_last_card_ends_game_before_auction(self):
        state = make_game()
        for player in state["players"].values():
            player["hand"] = []
        state["players"]["player0"]["hand"] = ["lite_metal-open-0"]
        self.apply(state, "player0", "offer", cards=["lite_metal-open-0"])
        self.assertEqual(state["phase"], "round_end")
        self.assertTrue(state["final_results"])
        self.assertEqual(state["players"]["player0"]["gallery"], [])
        self.assertEqual(state["counts"]["lite_metal"], 1)
        self.confirm(state)
        self.assertTrue(state["game_over"])

    def test_unmatched_double_free(self):
        state = self.offer("double")
        self.apply(state, "player1", "pass")
        self.apply(state, "player2", "pass")
        self.assertEqual(state["auction"]["paid"], 0)
        self.assertEqual(state["players"]["player0"]["gallery"], ["lite_metal-double-0"])

    def test_fifth_interrupts_double_without_consuming_companion(self):
        state = make_game()
        state["counts"]["lite_metal"] = 4
        cards = ["lite_metal-double-0", "lite_metal-fixed-0"]
        give(state, "player0", *cards)
        self.apply(state, "player0", "offer", cards=cards)
        self.assertEqual(state["phase"], "round_end")
        self.assertIn(cards[1], state["players"]["player0"]["hand"])
        self.assertIn(cards[0], state["discard"])
        self.assertEqual(state["counts"]["lite_metal"], 5)

    def test_double_fifth_companion_discards_both(self):
        state = self.offer("double")
        state["counts"]["lite_metal"] = 4
        give(state, "player1", "lite_metal-once-0")
        self.apply(state, "player1", "add", card="lite_metal-once-0")
        self.assertEqual(state["phase"], "round_end")
        self.assertIn("lite_metal-once-0", state["discard"])
        self.assertIn("lite_metal-double-0", state["discard"])

    def test_ranking_cumulative_and_deal(self):
        state = make_game()
        state["round"] = 2
        for artist in ARTISTS:
            state["values"][artist["id"]] = [30 if artist["id"] == "krypto" else 10]
            state["counts"][artist["id"]] = 4
        state["players"]["player1"]["gallery"] = ["krypto-open-0", "lite_metal-open-1"]
        give(state, "player0", "yoko-open-0")
        self.apply(state, "player0", "offer", cards=["yoko-open-0"])
        summary = state["round_summary"]
        self.assertEqual(summary["bonuses"], {"lite_metal": 20, "yoko": 30, "christin_p": 10, "karl_gitter": 0, "krypto": 0})
        self.assertEqual(summary["values"]["krypto"], 0)
        self.assertEqual(summary["rows"][1]["income"], 30)
        hands = {player_id: len(player["hand"]) for player_id, player in state["players"].items()}
        self.confirm(state)
        self.assertEqual(state["round"], 3)
        self.assertEqual(state["current_turn"], "player1")
        self.assertEqual([len(state["players"][player_id]["hand"]) - count for player_id, count in hands.items()], [6, 6, 6])

    def test_schema_stale_invalid_and_immutable_public_view(self):
        state = self.offer("once")
        for fields in ({"amount": True}, {"amount": 1.5}, {"amount": -1}, {"amount": 101}, {"amount": 0}):
            before = copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state, "player1", action(state, "bid", **fields))[1])
            self.assertEqual(state, before)
        for key, value in (("step", 999), ("game_token", "old"), ("round", 4)):
            invalid = action(state, "pass")
            invalid[key] = value
            self.assertIsNotNone(Game.apply_action(state, "player1", invalid)[1])
        view = Game.get_public_view(state, "player1")
        view["players"][0]["gallery"].append("invalid")
        self.assertEqual(state["players"]["player0"]["gallery"], [])
        self.assertEqual(Game.get_legal_actions(state, "spectator"), [])

    def test_save_load_all_phases_and_complete_bots(self):
        for count in (3, 4, 5):
            with self.subTest(count=count), patch("game.modern_art.random.shuffle", random.Random(count).shuffle):
                state = Game.init_game({}, [{"player_id": f"player{index}", "seat": index} for index in range(count)])
                for turn in range(5000):
                    restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
                    self.assertEqual(restored, state)
                    for player_id in state["turn_order"]:
                        move = Game.bot_move(state, player_id)
                        if move:
                            self.assertIsNone(Game.apply_action(state, player_id, move)[1])
                            break
                    else:
                        self.fail(f"bot deadlock {state['phase']}")
                    for player in state["players"].values():
                        self.assertGreaterEqual(player["cash"], 0)
                        self.assertEqual(player["cash"], 100 + player["income"] + player["sales"] - player["spent"])
                    if state["game_over"]:
                        break
                self.assertTrue(state["game_over"], turn)
                self.assertEqual(state["round"], 4)
                self.assertEqual(len(state["history"]), 4)
                self.assertEqual(len(state["next_ready"]), count)
                for row in state["final_results"]:
                    self.assertEqual(row["total"], row["initial"] + row["income"] + row["sales"] - row["spent"])

    def test_ai_only_uses_public_view_and_preserves_random_state(self):
        state = self.offer("sealed")
        view = Game.get_public_view(state, "player1")
        before_state, before_view, before_random = copy.deepcopy(state), copy.deepcopy(view), random.getstate()
        chosen = Game.bot_move(state, "player1")
        self.assertEqual(Game.bot_move(state, "player1"), chosen)
        self.assertEqual(_choose_bot_action(view), chosen)
        with patch.object(Game, "get_public_view", return_value=view):
            self.assertEqual(Game.bot_move({"no_authoritative_fields": True}, "player1"), chosen)
        self.assertEqual(state, before_state)
        self.assertEqual(view, before_view)
        self.assertEqual(random.getstate(), before_random)

    def test_ai_cannot_read_other_hands_cash_deck_or_sealed_bids(self):
        state = self.offer("sealed")
        changed = copy.deepcopy(state)
        changed["players"]["player0"]["cash"] = 9999
        changed["players"]["player2"]["cash"] = 0
        changed["players"]["player0"]["hand"].reverse()
        changed["players"]["player2"]["hand"].reverse()
        changed["deck"].reverse()
        changed["auction"]["bids"]["player0"] = 99
        state["auction"]["bids"]["player0"] = 0
        self.assertEqual(Game.bot_move(state, "player1"), Game.bot_move(changed, "player1"))
        first, second = changed["players"]["player0"]["hand"], changed["players"]["player2"]["hand"]
        first[0], second[0] = second[0], first[0]
        self.assertEqual(Game.bot_move(state, "player1"), Game.bot_move(changed, "player1"))

    def test_ai_valuation_zeros_unranked_artist_despite_historical_value(self):
        state = make_game()
        state["values"]["krypto"] = [30, 30, 30]
        policy = _ModernArtPolicy(Game.get_public_view(state, "player0"))
        self.assertEqual(policy.prices([5, 4, 3, 2, 1]), [30, 20, 10, 0, 0])

    def test_ai_ends_season_to_favor_own_gallery_not_opponents(self):
        state = make_game()
        give(state, "player0", "lite_metal-open-0", "yoko-open-0")
        state["players"]["player0"]["hand"] = ["lite_metal-open-0", "yoko-open-0"]
        state["counts"].update(lite_metal=4, yoko=4)
        state["players"]["player0"]["gallery"] = ["lite_metal-sealed-0", "lite_metal-sealed-1", "lite_metal-sealed-2"]
        state["players"]["player1"]["gallery"] = ["yoko-once-0", "yoko-once-1", "yoko-once-2"]
        state["round"] = 4
        self.assertEqual(Game.bot_move(state, "player0")["cards"], ["lite_metal-open-0"])
        own, rival = state["players"]["player0"], state["players"]["player1"]
        own["gallery"], rival["gallery"] = rival["gallery"], own["gallery"]
        self.assertEqual(Game.bot_move(state, "player0")["cards"], ["yoko-open-0"])

    def test_ai_self_purchase_is_more_conservative_than_rival_sale(self):
        state = self.offer("once")
        self.apply(state, "player1", "bid", amount=25)
        self.apply(state, "player2", "pass")
        with patch.object(_ModernArtPolicy, "forecast", return_value=([30.0] * 5, [0.0] * 5)):
            self.assertEqual(Game.bot_move(state, "player0")["type"], "pass")
        state = self.offer("once")
        state["auction"]["high_bid"] = 25
        with patch.object(_ModernArtPolicy, "forecast", return_value=([30.0] * 5, [0.0] * 5)):
            chosen = Game.bot_move(state, "player1")
            self.assertEqual(chosen["type"], "bid")
            self.assertEqual(chosen["amount"], 26)

    def test_ai_uses_minimum_open_bid_and_final_once_bid(self):
        for kind in ("open", "once"):
            state = self.offer(kind)
            if kind == "once":
                self.apply(state, "player1", "bid", amount=5)
                self.apply(state, "player2", "pass")
                actor = "player0"
            else:
                self.apply(state, "player0", "bid", amount=5)
                actor = "player1"
            with patch.object(_ModernArtPolicy, "forecast", return_value=([30.0] * 5, [0.0] * 5)):
                self.assertEqual(Game.bot_move(state, actor)["amount"], 6)

    def test_ai_rejects_valueless_fixed_price_and_seals_zero(self):
        state = self.offer("fixed")
        self.apply(state, "player0", "set_price", amount=1)
        with patch.object(_ModernArtPolicy, "forecast", return_value=([0.0] * 5, [0.0] * 5)):
            self.assertEqual(Game.bot_move(state, "player1")["type"], "pass")
        state = self.offer("sealed")
        with patch.object(_ModernArtPolicy, "forecast", return_value=([0.0] * 5, [0.0] * 5)):
            self.assertEqual(Game.bot_move(state, "player1")["amount"], 0)

    def test_ai_can_refuse_round_ending_double_companion(self):
        state = self.offer("double")
        state["counts"].update(lite_metal=4, yoko=4)
        state["round"] = 4
        give(state, "player1", "lite_metal-once-0")
        state["players"]["player1"]["gallery"] = ["yoko-fixed-0", "yoko-fixed-1", "yoko-fixed-2"]
        state["players"]["player0"]["gallery"] = ["lite_metal-sealed-0", "lite_metal-sealed-1", "lite_metal-sealed-2"]
        self.assertEqual(Game.bot_move(state, "player1")["type"], "pass")

    def test_ai_prices_affordably_and_respects_no_action_states(self):
        state = self.offer("fixed")
        state["players"]["player0"]["cash"] = 3
        chosen = Game.bot_move(state, "player0")
        self.assertEqual(chosen["type"], "set_price")
        self.assertLessEqual(chosen["amount"], 3)
        self.assertIsNone(Game.bot_move(state, "spectator"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "player0"))
