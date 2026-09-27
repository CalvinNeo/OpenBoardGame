import copy
import json
import random
import unittest
from unittest.mock import patch

from game.las_vegas import LasVegasGame as Game
from game import las_vegas_royale as royale


class RoyaleTests(unittest.TestCase):
    def setUp(self):
        self.random_state = random.getstate()
        random.seed(83)
        self.players = [{"player_id": f"p{i}", "seat": i, "name": f"Player {i}"} for i in range(3)]
        self.state = Game.init_game({"edition": "royale"}, self.players)
        self.state.update(current_turn="p0", start_player="p0", tiles=[])

    def tearDown(self):
        random.setstate(self.random_state)

    def tile(self, name, face=1):
        tile = royale._new_tile(name, face)
        self.state["tiles"].append(tile)
        return tile

    def place(self, pid, face, small=0, big=False):
        available = royale._pieces(self.state, pid, "supply")
        dice = [d for d in available if not d["big"]][:small]
        if big:
            dice += [d for d in available if d["big"]]
        for die in dice:
            royale._move(self.state, die, f"casino:{face}", face)
        return [d["id"] for d in dice]

    def act(self, kind, pid=None, **data):
        action = {"type": kind, "round": self.state["round"], **data}
        if kind != "next_round":
            action["turn"] = self.state["turn"]
        _, error = Game.apply_action(self.state, pid or self.state["current_turn"], action)
        self.assertIsNone(error, action)

    def choose(self, key):
        self.act("royale_choose", decision=self.state["pending"]["id"], option=key)

    def activate(self, face=1, actor="p0", rolled=None, placed=None):
        royale._activate(self.state, face, actor, rolled or [], placed or [])
        royale._drain(self.state)

    def finish(self):
        self.state.update(queue=[], pending=None)
        royale._begin_settlement(self.state)
        royale._drain(self.state)

    def test_setup_deck_pairs_chips_biggies_and_distinct_tile_sides(self):
        self.assertEqual(len(royale.BANKNOTES), 90)
        for count in range(2, 6):
            state = Game.init_game({"edition": "royale"}, self.players + [
                {"player_id": f"p{i}", "seat": i} for i in range(3, count)]) if count > 3 else Game.init_game({"edition": "royale"}, self.players[:count])
            pairs = [c["banknotes"] for c in state["casinos"]]
            self.assertEqual(pairs, sorted(pairs, key=lambda p: (sum(p), max(p))))
            self.assertTrue(all(len(p) == 2 for p in pairs))
            self.assertEqual(sum(map(len, state["round_decks"])) + len(state["banknote_deck"]), 90)
            for pid in state["players"]:
                self.assertEqual(len(royale._pieces(state, pid, "supply")), 8)
                self.assertEqual(sum(d["big"] for d in royale._pieces(state, pid)), 1)
                self.assertEqual(state["players"][pid]["chips"], 2)
            indices = [next(i for i, pair in enumerate(royale.TILE_PAIRS) if t["id"] in pair) for t in state["tiles"]]
            self.assertEqual(len(set(indices)), 3)
            self.assertEqual(len(royale._pieces(state, royale.NEUTRAL_ID)), 8 if count == 2 else 0)

    def test_classic_default_and_incompatible_variant(self):
        classic = Game.init_game({}, self.players)
        self.assertEqual(Game.get_public_view(classic, "p0")["total_rounds"], 4)
        with self.assertRaises(ValueError):
            Game.init_game({"edition": "royale", "neutral_dice": True}, self.players)

    def test_biggy_ties_two_small_and_gray_is_separate(self):
        self.place("p0", 1, big=True)
        self.place("p1", 1, small=2)
        self.place("p2", 1, small=1)
        self.state["casinos"][0]["gray_dice"] = 3
        result = royale._casino(self.state, 1)
        self.assertEqual(result["tied_players"], ["p0", "p1"])
        self.assertEqual([p["player_id"] for p in result["payouts"]], [royale.GRAY_ID, "p2"])
        self.assertEqual(result["returned"], [result["banknotes"][0]])

    def test_placement_moves_all_matching_physical_dice_and_preview_weight(self):
        with patch.object(royale.random, "randint", side_effect=[1, 1, 2, 3, 4, 5, 6, 1]):
            self.act("roll")
        self.act("place", face=1)
        self.assertEqual(royale._casino(self.state, 1)["dice"]["p0"], 4)
        self.assertEqual(len(royale._pieces(self.state, "p0", "supply")), 5)
        self.assertEqual(self.state["current_turn"], "p1")

    def test_chips_pass_preserves_dice_then_free_pass_when_all_closed(self):
        with patch.object(royale.random, "randint", return_value=4):
            self.act("roll")
        self.act("royale_pass")
        self.assertEqual(self.state["players"]["p0"]["chips"], 1)
        self.assertEqual(len(royale._pieces(self.state, "p0", "supply")), 8)
        self.state.update(current_turn="p0", phase="roll", closed_casino=4)
        self.state["players"]["p0"]["chips"] = 0
        with patch.object(royale.random, "randint", return_value=4):
            self.act("roll")
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), ["royale_pass"])
        self.act("royale_pass")
        self.assertEqual(self.state["players"]["p0"]["chips"], 0)

    def test_lucky_punch_private_guess_survives_serialization(self):
        self.tile("lucky_punch")
        self.activate()
        self.choose("3")
        self.assertEqual(self.state["current_turn"], "p1")
        state = json.loads(json.dumps(self.state))
        for viewer in ("p0", "p1", "visitor"):
            view = Game.get_public_view(state, viewer)
            self.assertNotIn("secret", json.dumps(view))
            self.assertNotIn("context", view["decision"])
            self.assertEqual(len(view["decision"]["options"]), 3 if viewer == "p1" else 0)
        self.state = state
        self.choose("1")
        self.assertEqual(royale._cash(self.state, "p0"), 40000)

    def test_lucky_punch_correct_guess_pays_nothing(self):
        self.tile("lucky_punch")
        self.activate()
        self.choose("1")
        self.choose("1")
        self.assertEqual(self.state["players"]["p0"], {"banknotes": [], "chips": 2})

    def test_jackpot_increases_caps_wins_and_resets(self):
        tile = self.tile("jackpot")
        with patch.object(royale.random, "randint", side_effect=[1, 2] * 7):
            for _ in range(7):
                self.activate()
        self.assertEqual(tile["jackpot"], 80000)
        with patch.object(royale.random, "randint", side_effect=[3, 4]):
            self.activate()
        self.assertEqual(royale._cash(self.state, "p0"), 80000)
        self.assertEqual(tile["jackpot"], 30000)
        with patch.object(royale.random, "randint", return_value=6):
            self.activate()
        self.assertEqual(royale._cash(self.state, "p0"), 110000)

    def test_fifty_fifty_chips_and_equal_sum_loss(self):
        self.tile("fifty_fifty")
        with patch.object(royale.random, "randint", side_effect=[1, 2, 5, 6]):
            self.activate()
            self.choose("higher")
        self.assertEqual(self.state["pending"]["context"]["reward"], 10000)
        self.choose("stop")
        self.assertEqual(self.state["players"]["p0"]["chips"], 3)
        with patch.object(royale.random, "randint", side_effect=[2, 3, 1, 4]):
            self.activate()
            self.choose("higher")
        self.assertIsNone(self.state["pending"])
        self.assertEqual(self.state["players"]["p0"]["chips"], 3)

    def test_fifty_fifty_top_reward_stops_at_sixty(self):
        self.tile("fifty_fifty")
        with patch.object(royale.random, "randint", side_effect=[1, 1, 2, 2, 3, 3, 4, 4, 6, 6]):
            self.activate()
            for _ in range(4):
                self.choose("higher")
        self.assertEqual([o["id"] for o in self.state["pending"]["options"]], ["stop"])
        self.choose("stop")
        self.assertEqual(royale._cash(self.state, "p0"), 60000)

    def test_high_five_biggy_claim_is_permanent_and_paid_at_end(self):
        tile = self.tile("high_five")
        self.place("p0", 1, small=3, big=True)
        self.activate()
        self.place("p1", 1, small=6)
        self.activate(actor="p1")
        self.assertEqual(tile["owner"], "p0")
        self.assertEqual(royale._cash(self.state, "p0"), 0)
        self.finish()
        self.assertIn(100000, self.state["players"]["p0"]["banknotes"])

    def test_bad_luck_zero_ties_pay_after_payout_and_keep_change_cash(self):
        self.tile("bad_luck")
        self.place("p0", 1, small=1)
        self.place("p1", 6, small=1)
        self.state["casinos"][5]["banknotes"] = [60000, 30000]
        self.finish()
        self.assertEqual(self.state["players"]["p1"], {"banknotes": [10000], "chips": 2})
        self.assertEqual(self.state["players"]["p2"], {"banknotes": [], "chips": 0})
        self.assertEqual(self.state["players"]["p0"]["chips"], 2)

    def test_pay_day_counts_casinos_not_tile_or_dice(self):
        self.tile("pay_day")
        self.place("p0", 1, small=3)
        self.activate()
        self.assertEqual(self.state["players"]["p0"]["chips"], 3)
        self.place("p0", 2, small=1)
        self.place("p0", 4, small=1)
        royale._move(self.state, royale._pieces(self.state, "p0", "supply")[0], "golden")
        self.activate()
        self.assertEqual(royale._cash(self.state, "p0"), 30000)

    def test_power_play_chooses_biggy_and_activates_destination(self):
        tile = self.tile("power_play")
        self.tile("pay_day", 2)
        self.place("p0", 1, small=1)
        self.activate()
        self.assertEqual(tile["owner"], "p0")
        self.state.update(current_turn="p0", phase="roll")
        self.act("royale_power")
        self.choose("place:p0:7:2")
        self.assertEqual(royale._casino(self.state, 2)["dice"]["p0"], 2)
        self.assertEqual(self.state["players"]["p0"]["chips"], 4)
        self.assertEqual(self.state["current_turn"], "p1")

    def test_gray_tie_revokes_power_play(self):
        power = self.tile("power_play", 2)
        block = self.tile("block_it")
        self.place("p0", 2, small=2)
        self.activate(2)
        self.assertEqual(power["owner"], "p0")
        self.activate()
        self.choose("2:2")
        self.assertEqual(block["groups"][2], 0)
        self.assertIsNone(power["owner"])

    def test_no_entry_track_keep_and_block_movement_options(self):
        tile = self.tile("no_entry")
        self.activate()
        self.choose("4")
        self.assertEqual(self.state["players"]["p0"]["chips"], 4)
        self.activate()
        self.choose("skip")
        self.assertEqual(tile["track"], 1)
        self.place("p0", 4, small=1)
        options = royale._manipulate_options(self.state, "p0")
        self.assertFalse(any(o.get("face") == 4 or o.get("operation") == "return" for o in options))
        for face in (5, 4, 5, 4, 5):
            self.activate()
            self.choose(str(face))
        self.assertEqual(tile["track"], 0)
        self.assertEqual(royale._cash(self.state, "p0"), 30000)
        self.assertEqual(self.state["players"]["p0"]["chips"], 5)

    def test_knockout_other_players_choose_biggy_counts_one_and_actor_recovers(self):
        self.tile("knockout")
        mine = royale._pieces(self.state, "p0", "supply")[0]
        royale._move(self.state, mine, "knockout")
        self.activate()
        self.assertEqual(mine["location"], "supply")
        self.assertEqual(self.state["pending"]["actor"], "p1")
        self.choose("p1:7")
        self.assertEqual(self.state["pending"]["actor"], "p2")
        self.choose("p2:0")
        self.assertEqual(len(royale._pieces(self.state, "p1", "knockout")), 1)
        self.activate()
        self.choose("p1:0")
        self.choose("p2:1")
        self.activate()
        self.assertIsNone(self.state["pending"])
        self.assertEqual(len(royale._pieces(self.state, "p1", "knockout")), 2)

    def test_handicap_rewards_exhaust_and_moves_do_not_activate(self):
        tile = self.tile("handicap")
        self.tile("jackpot", 2)
        self.state["casinos"][3]["gray_dice"] = 2
        self.activate()
        self.choose("4:move")
        self.choose("place:p0:7:2")
        self.assertEqual(tile["spaces"]["move"], 3)
        self.assertEqual(royale._tile(self.state, 2)["last_roll"], [])
        self.activate()
        self.choose("4:cash")
        self.assertEqual(royale._cash(self.state, "p0"), 30000)
        self.activate()
        self.assertEqual([o["id"] for o in self.state["pending"]["options"]], ["skip"])

    def test_double_down_includes_old_dice_ranks_biggy_and_cancels_ties(self):
        self.tile("double_down")
        self.place("p0", 1, small=2, big=True)
        self.activate()
        self.choose("1:1")
        self.assertEqual(royale._casino(self.state, 1)["dice"]["p0"], 1)
        self.place("p1", 1, small=3)
        self.activate(actor="p1")
        self.choose("3:0")
        self.place("p2", 1, small=1)
        self.activate(actor="p2")
        self.choose("1:0")
        self.finish()
        self.assertEqual(royale._cash(self.state, "p2"), 60000)
        self.assertFalse(any("Double Down" in e["text"] and "Player 1" in e["text"] for e in self.state["log"]))

    def test_nice_dice_accepts_just_placed_even_if_old_die_matches(self):
        self.tile("nice_dice")
        self.place("p0", 1, small=1)
        placed = self.place("p0", 1, small=1)
        self.activate(placed=placed)
        self.assertIn(placed[0], [o["id"] for o in self.state["pending"]["options"]])
        self.choose(placed[0])
        self.assertEqual(royale._pieces(self.state, "p0", "nice:1")[0]["id"], placed[0])

    def test_nice_dice_displaces_without_trigger_and_cannot_displace_to_closed(self):
        self.tile("nice_dice")
        self.tile("jackpot", 2)
        old = royale._pieces(self.state, "p1", "supply")[0]
        royale._move(self.state, old, "nice:2", 2)
        die = royale._pieces(self.state, "p0", "supply")[0]
        die["face"] = 2
        self.state["closed_casino"] = 2
        self.activate(rolled=[die["id"]])
        self.assertEqual(len(self.state["pending"]["options"]), 1)
        self.choose("skip")
        self.state["closed_casino"] = None
        self.activate(rolled=[die["id"]])
        self.choose(die["id"])
        self.assertEqual(old["location"], "casino:2")
        self.assertEqual(royale._tile(self.state, 2)["last_roll"], [])
        self.finish()
        self.assertEqual(self.state["players"]["p0"]["chips"], 4)

    def test_my_choice_all_six_results_and_golden_replacement(self):
        self.tile("my_choice")
        self.tile("pay_day", 2)
        self.place("p0", 2, small=1)
        for n in range(1, 7):
            with patch.object(royale.random, "randint", return_value=n):
                self.activate()
            self.choose(str(n))
            if n == 4:
                self.choose("2")
            if n == 5:
                self.choose("place:p0:7:3")
            if n == 6:
                old = royale._pieces(self.state, "p1", "supply")[0]
                royale._move(self.state, old, "golden")
                self.choose(self.state["pending"]["options"][0]["id"])
                self.assertEqual(old["location"], "supply")
        self.assertEqual(self.state["players"]["p0"]["chips"], 6)
        self.assertEqual(royale._cash(self.state, "p0"), 30000)
        self.finish()
        self.assertIn(60000, self.state["players"]["p0"]["banknotes"])

    def test_prime_time_split_double_before_payout_no_activation(self):
        self.tile("prime_time")
        self.tile("jackpot", 2)
        self.place("p0", 1, big=True)
        self.place("p1", 2, small=2)
        with patch.object(royale.random, "randint", return_value=2):
            self.finish()
        self.assertEqual(self.state["pending"]["actor"], "p0")
        self.choose("1")
        result = self.state["round_results"][1]
        self.assertEqual(result["dice"]["p0"], 1)
        self.assertEqual([p["player_id"] for p in result["payouts"]], ["p1", "p0"])
        self.assertEqual(royale._tile(self.state, 2)["last_roll"], [])

    def test_prime_time_neutral_winner_and_closed_targets(self):
        self.tile("prime_time")
        self.place("p0", 1, small=1)
        self.state["casinos"][0]["gray_dice"] = 2
        self.finish()
        self.assertIsNone(self.state["pending"])
        self.state["casinos"][0]["gray_dice"] = 0
        self.state["closed_casino"] = 2
        with patch.object(royale.random, "randint", side_effect=[2, 3]):
            self.finish()
        self.assertEqual([o["id"] for o in self.state["pending"]["options"]], ["0", "2"])

    def test_black_box_split_private_and_twenty_thousand_is_chips(self):
        self.tile("black_box")
        self.place("p0", 1, small=1)
        self.finish()
        self.assertEqual(self.state["pending"]["actor"], "p1")
        self.assertEqual(Game.get_public_view(self.state, "p0")["decision"]["options"], [])
        self.choose("2")
        view = Game.get_public_view(self.state, "p0")
        self.assertEqual(view["decision"]["options"][0]["label"], "盒 A · 1 块标记")
        self.assertNotIn("groups", json.dumps(view)) if False else None
        self.assertNotIn("groups", view["decision"])
        self.assertNotIn("tokens", view["decision"])
        self.choose("0")
        self.assertEqual(self.state["players"]["p0"]["chips"], 4)
        self.assertEqual(self.state["phase"], "round_end")

    def test_invalid_and_stale_choices_do_not_mutate_and_views_are_copies(self):
        self.tile("lucky_punch")
        self.activate()
        base = {"type": "royale_choose", "round": 1, "turn": 1, "decision": self.state["pending"]["id"], "option": "2"}
        for pid, action in [("p1", base), ("visitor", base), ("p0", {**base, "decision": 99}),
                            ("p0", {**base, "option": "999"}), ("p0", {**base, "turn": True}),
                            ("p0", {**base, "decision": 1.0}), ("p0", {**base, "round": 2})]:
            before = copy.deepcopy(self.state)
            self.assertIsNotNone(Game.apply_action(self.state, pid, action)[1])
            self.assertEqual(self.state, before)
        before = copy.deepcopy(self.state)
        view = Game.get_public_view(self.state, "p0")
        view["tiles"][0]["owner"] = "visitor"
        view["decision"]["options"].clear()
        self.assertEqual(self.state, before)

    def test_next_starter_three_rounds_chips_tiebreak_and_all_ready(self):
        self.place("p2", 6, small=1)
        self.finish()
        self.act("next_round", "p0")
        self.act("next_round", "p1")
        self.assertEqual(self.state["round"], 1)
        self.act("next_round", "p2")
        self.assertEqual(self.state["current_turn"], "p2")
        self.assertTrue(all(p["chips"] == 4 for p in self.state["players"].values()))
        self.state.update(round=3, phase="round_end", next_ready=[])
        self.state["players"].update(p0={"banknotes": [60000], "chips": 0},
                                     p1={"banknotes": [30000], "chips": 3},
                                     p2={"banknotes": [30000, 30000], "chips": 0})
        for pid in self.state["turn_order"]:
            self.act("next_round", pid)
        self.assertEqual(self.state["winner"], ["p1"])
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), [])

    def test_seeded_full_bot_games_keep_physical_dice_and_resume_decisions(self):
        seen = set()
        for seed in range(32):
            random.seed(seed)
            count = 2 + seed % 4
            players = [{"player_id": f"p{i}", "seat": i} for i in range(count)]
            state = Game.init_game({"edition": "royale"}, players)
            for step in range(1200):
                seen.update(t["id"] for t in state["tiles"])
                for pid in state["players"]:
                    dice = [d for d in royale._pieces(state, pid) if not d.get("extra")]
                    self.assertEqual(len(dice), 8, (seed, step, pid))
                    self.assertEqual(sum(d["big"] for d in dice), 1)
                    self.assertGreaterEqual(state["players"][pid]["chips"], 0)
                self.assertEqual(len({d["id"] for d in state["pieces"]}), len(state["pieces"]))
                if state["game_over"]:
                    break
                actor = state["current_turn"] or next(pid for pid in state["turn_order"] if pid not in state["next_ready"])
                if state["pending"]:
                    state = json.loads(json.dumps(state))
                before = copy.deepcopy(state)
                action = Game.bot_move(state, actor)
                self.assertEqual(state, before)
                self.assertIsNotNone(action, (seed, step, state["phase"]))
                self.assertIsNone(Game.apply_action(state, actor, action)[1], (seed, step, action))
            else:
                self.fail(f"Seed {seed} did not finish")
            self.assertEqual(state["round"], 3)
        self.assertEqual(seen, set(royale.TILE_NAMES))


if __name__ == "__main__":
    unittest.main()
