import copy
import json
import random
import unittest
from collections import Counter
from unittest.mock import patch

from game.las_vegas import (
    BANKNOTES, NEUTRAL_ID, TOTAL_ROUNDS, LasVegasGame as Game,
    _casino_result, _finish_game, _settle_round, _start_round,
)


def players(count=3):
    return [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index,
             "is_bot": True} for index in range(count)]


class LasVegasTests(unittest.TestCase):
    def setUp(self):
        source = random.Random(113)
        for name in ("shuffle", "choice", "randint"):
            patcher = patch(f"game.las_vegas.random.{name}", side_effect=getattr(source, name))
            patcher.start()
            self.addCleanup(patcher.stop)

    def game(self, count=3, neutral=False):
        return Game.init_game({"neutral_dice": neutral}, players(count))

    def act(self, state, kind, actor=None, **fields):
        action = {"type": kind, "round": state["round"], **fields}
        if kind in ("roll", "place"):
            action["turn"] = state["turn"]
        events, error = Game.apply_action(state, actor or state["current_turn"], action)
        self.assertIsNone(error, (action, error))
        return events

    def confirm_all(self, state):
        for pid in state["turn_order"]:
            self.act(state, "next_round", pid)

    def assert_rejected(self, state, actor, action):
        snapshot = copy.deepcopy(state)
        events, error = Game.apply_action(state, actor, action)
        self.assertIsNotNone(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, snapshot)

    def assert_conserved(self, state):
        notes = list(state["banknote_deck"])
        if state["phase"] in ("roll", "place"):
            for casino in state["casinos"]:
                notes.extend(casino["banknotes"])
        for player in state["players"].values():
            notes.extend(player["banknotes"])
        self.assertEqual(Counter(notes), Counter(BANKNOTES))
        for pid, player in state["players"].items():
            placed = sum(casino["dice"].get(pid, 0) for casino in state["casinos"])
            self.assertEqual(player["remaining"] + placed, 8)
        neutral_placed = sum(casino["neutral_dice"] for casino in state["casinos"])
        neutral_held = sum(player["neutral_remaining"] for player in state["players"].values())
        self.assertEqual(neutral_placed + neutral_held, 8 if state["config"]["neutral_dice"] else 0)

    @staticmethod
    def casino(notes, dice, neutral=0, face=1):
        return {"face": face, "banknotes": list(notes), "dice": dict(dice), "neutral_dice": neutral}

    def force_roll(self, state, own, neutral=(), actor="p0"):
        state.update(phase="place", current_turn=actor,
                     roll={"own": list(own), "neutral": list(neutral)})
        state["players"][actor].update(remaining=len(own), neutral_remaining=len(neutral))

    def test_component_distribution_setup_and_all_player_counts(self):
        self.assertEqual(TOTAL_ROUNDS, 4)
        expected = {10000: 6, 20000: 8, 30000: 8, 40000: 6, 50000: 6,
                    60000: 5, 70000: 5, 80000: 5, 90000: 5}
        self.assertEqual(Counter(BANKNOTES), expected)
        self.assertEqual(len(BANKNOTES), 54)
        for count in range(2, 6):
            with self.subTest(count=count):
                state = self.game(count)
                self.assertEqual((state["phase"], state["round"], state["turn"]), ("roll", 1, 1))
                self.assertEqual(state["current_turn"], state["start_player"])
                self.assertEqual([casino["face"] for casino in state["casinos"]], list(range(1, 7)))
                for casino in state["casinos"]:
                    self.assertGreaterEqual(sum(casino["banknotes"]), 50000)
                    self.assertEqual(casino["banknotes"], sorted(casino["banknotes"], reverse=True))
                self.assertEqual(state["roll"], {"own": [], "neutral": []})
                self.assert_conserved(state)

    def test_first_player_is_random_and_seat_order_metadata_are_copied(self):
        roster = players()
        roster[0]["seat"], roster[2]["seat"] = 3, 0
        with patch("game.las_vegas.random.choice", return_value="p2"):
            state = Game.init_game(None, roster)
        self.assertEqual(state["turn_order"], ["p2", "p1", "p0"])
        self.assertEqual(state["start_player"], "p2")
        roster[0]["name"] = "Changed"
        self.assertEqual(state["player_meta"]["p0"]["name"], "Player 0")

    def test_casino_funding_draws_from_the_top_until_the_threshold(self):
        state = self.game(2)
        state["banknote_deck"] = [10000, 10000, 30000, 90000, 20000, 20000, 20000,
                                  50000, 40000, 30000, 60000, 80000]
        _start_round(state)
        self.assertEqual([casino["banknotes"] for casino in state["casinos"]],
                         [[30000, 10000, 10000], [90000], [20000, 20000, 20000],
                          [50000], [40000, 30000], [60000]])
        self.assertEqual(state["banknote_deck"], [80000])

    def test_bad_configuration_and_roster_are_rejected(self):
        for config in [[], False, 2, {"seed": 1}, {"neutral_dice": 1},
                       {"neutral_dice": "true"}, {"neutral_dice": None}, {"unknown": True}]:
            with self.subTest(config=config), self.assertRaises(ValueError):
                Game.init_game(config, players())
        for count in (0, 1, 6):
            with self.subTest(count=count), self.assertRaises(ValueError):
                self.game(count)
        with self.assertRaises(ValueError):
            self.game(5, neutral=True)
        for roster in [None, [{}, {}], [players()[0]] * 2,
                       [{"player_id": ""}, players()[1]],
                       [{"player_id": 1}, players()[1]],
                       [{"player_id": "p0", "seat": True}, players()[1]]]:
            with self.subTest(roster=roster), self.assertRaises(ValueError):
                Game.init_game({}, roster)

    def test_roll_uses_every_remaining_die_and_cannot_be_repeated(self):
        state = self.game(2, neutral=True)
        actor = state["current_turn"]
        state["players"][actor].update(remaining=3, neutral_remaining=2)
        with patch("game.las_vegas.random.randint", side_effect=[1, 3, 3, 3, 6]):
            self.act(state, "roll")
        self.assertEqual(state["phase"], "place")
        self.assertEqual(Counter(state["roll"]["own"]), Counter([1, 3, 3]))
        self.assertEqual(Counter(state["roll"]["neutral"]), Counter([3, 6]))
        self.assertEqual(Game.get_legal_actions(state, actor), ["place"])
        self.assert_rejected(state, actor, {"type": "roll", "round": 1, "turn": 1})

    def test_place_commits_all_matching_own_and_white_dice(self):
        state = self.game(2, neutral=True)
        self.force_roll(state, [1, 3, 3], [3, 6])
        state["casinos"][2]["dice"]["p0"] = 2
        self.act(state, "place", face=3)
        self.assertEqual(state["casinos"][2]["dice"]["p0"], 4)
        self.assertEqual(state["casinos"][2]["neutral_dice"], 1)
        self.assertEqual((state["players"]["p0"]["remaining"],
                          state["players"]["p0"]["neutral_remaining"]), (1, 1))
        self.assertEqual(state["roll"], {"own": [], "neutral": []})
        self.assertEqual((state["phase"], state["current_turn"], state["turn"]), ("roll", "p1", 2))

    def test_neutral_only_face_can_be_placed_and_absent_face_is_rejected(self):
        state = self.game(2, neutral=True)
        self.force_roll(state, [1], [6, 6])
        self.assert_rejected(state, "p0", {"type": "place", "round": 1, "turn": 1, "face": 2})
        self.act(state, "place", face=6)
        self.assertEqual(state["casinos"][5]["neutral_dice"], 2)
        self.assertEqual(state["casinos"][5]["dice"].get("p0", 0), 0)
        self.assertEqual(state["players"]["p0"]["remaining"], 1)
        self.assertEqual(state["players"]["p0"]["neutral_remaining"], 0)

    def test_exhausted_players_are_skipped_and_last_player_takes_consecutive_turns(self):
        state = self.game()
        state["players"]["p1"]["remaining"] = 0
        self.force_roll(state, [1, 2])
        self.act(state, "place", face=1)
        self.assertEqual(state["current_turn"], "p2")
        state["players"]["p0"]["remaining"] = 0
        self.force_roll(state, [3, 4], actor="p2")
        self.act(state, "place", face=3)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(Game.get_legal_actions(state, "p0"), [])

    def test_last_die_settles_immediately_and_preserves_the_final_board(self):
        state = self.game(2)
        state["players"]["p1"]["remaining"] = 0
        self.force_roll(state, [4])
        final_banknotes = copy.deepcopy(state["casinos"][3]["banknotes"])
        self.act(state, "place", face=4)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["casinos"][3]["dice"]["p0"], 1)
        self.assertEqual(state["players"]["p0"]["remaining"], 0)
        self.assertEqual(state["players"]["p0"]["banknotes"], [max(final_banknotes)])
        self.assertEqual(state["round_summary"]["casinos"][3]["banknotes"], final_banknotes)
        self.assertEqual(state["next_ready"], [])
        self.assert_rejected(state, "p0", {"type": "place", "round": 1, "turn": 1, "face": 4})

    def test_all_tied_count_groups_cancel_before_one_note_per_survivor(self):
        casino = self.casino([10000, 30000, 80000], {"p0": 5, "p1": 3, "p2": 3, "p3": 1})
        snapshot = copy.deepcopy(casino)
        result = _casino_result(casino)
        self.assertEqual(set(result["tied_players"]), {"p1", "p2"})
        self.assertEqual(result["payouts"], [{"player_id": "p0", "amount": 80000, "dice": 5},
                                             {"player_id": "p3", "amount": 30000, "dice": 1}])
        self.assertEqual(result["returned"], [10000])
        self.assertEqual(casino, snapshot)
        result = _casino_result(self.casino([90000, 50000], {"p0": 2, "p1": 1, "p2": 2, "p3": 1}))
        self.assertEqual(set(result["tied_players"]), {"p0", "p1", "p2", "p3"})
        self.assertEqual(result["payouts"], [])
        self.assertEqual(result["returned"], [90000, 50000])

    def test_no_dice_never_wins_and_insufficient_notes_leave_lower_players_empty(self):
        result = _casino_result(self.casino([70000], {"p0": 5, "p1": 2, "p2": 1, "p3": 0}))
        self.assertEqual(result["payouts"], [{"player_id": "p0", "amount": 70000, "dice": 5}])
        self.assertEqual(result["tied_players"], [])
        self.assertEqual(result["returned"], [])
        result = _casino_result(self.casino([20000, 30000], {"p0": 0, "p1": 0}))
        self.assertEqual(result["payouts"], [])
        self.assertEqual(result["tied_players"], [])
        self.assertEqual(result["returned"], [30000, 20000])

    def test_neutral_dice_are_one_participant_in_ties_and_payouts(self):
        result = _casino_result(self.casino([90000, 50000], {"p0": 4, "p1": 2}, neutral=4))
        self.assertEqual(set(result["tied_players"]), {"p0", NEUTRAL_ID})
        self.assertEqual(result["payouts"], [{"player_id": "p1", "amount": 90000, "dice": 2}])
        result = _casino_result(self.casino([90000, 50000], {"p0": 2}, neutral=4))
        self.assertEqual(result["payouts"], [{"player_id": NEUTRAL_ID, "amount": 90000, "dice": 4},
                                             {"player_id": "p0", "amount": 50000, "dice": 2}])

    def test_round_settlement_returns_unused_and_neutral_money_to_deck_bottom(self):
        state = self.game(2, neutral=True)
        state["banknote_deck"] = [10000, 20000]
        state["casinos"] = [
            self.casino([90000, 40000, 30000], {"p0": 2}, neutral=3, face=1),
            self.casino([70000, 60000], {"p0": 1, "p1": 1}, face=2),
            *[self.casino([], {}, face=face) for face in range(3, 7)],
        ]
        _settle_round(state)
        self.assertEqual(state["players"]["p0"]["banknotes"], [40000])
        self.assertEqual(state["players"]["p1"]["banknotes"], [])
        self.assertEqual(state["banknote_deck"], [10000, 20000, 90000, 30000, 70000, 60000])
        self.assertEqual(state["round_summary"]["neutral_returned"], 90000)
        self.assertEqual(state["round_summary"]["casinos"][0]["banknotes"], [90000, 40000, 30000])
        self.assertEqual(state["casinos"][0]["dice"]["p0"], 2)
        self.assertEqual((state["phase"], state["current_turn"]), ("round_end", None))

    def test_neutral_distribution_and_three_player_preplaced_dice(self):
        for count, per_player, preplaced in [(2, 4, 0), (3, 2, 2), (4, 2, 0)]:
            with self.subTest(count=count):
                state = self.game(count, neutral=True)
                self.assertTrue(all(player["neutral_remaining"] == per_player
                                    for player in state["players"].values()))
                self.assertEqual(sum(casino["neutral_dice"] for casino in state["casinos"]), preplaced)
                self.assert_conserved(state)

    def test_round_end_requires_every_player_and_rotates_the_starter(self):
        state = self.game()
        original_starter, turn = state["start_player"], state["turn"]
        _settle_round(state)
        summary = copy.deepcopy(state["round_summary"])
        self.act(state, "next_round", "p0")
        self.assert_rejected(state, "p0", {"type": "next_round", "round": 1})
        self.assertEqual(state["phase"], "round_end")
        self.act(state, "next_round", "p1")
        self.assertEqual(state["round_summary"], summary)
        self.act(state, "next_round", "p2")
        expected = state["turn_order"][(state["turn_order"].index(original_starter) + 1) % 3]
        self.assertEqual((state["round"], state["phase"], state["start_player"]), (2, "roll", expected))
        self.assertEqual(state["current_turn"], expected)
        self.assertGreaterEqual(state["turn"], turn)
        self.assertEqual(state["next_ready"], [])
        self.assertIsNone(state["round_summary"])
        self.assert_rejected(state, "p2", {"type": "next_round", "round": 1})
        self.assert_conserved(state)

    def test_fourth_round_pauses_before_final_scores_and_uses_banknote_count_tiebreak(self):
        state = self.game()
        state["round"] = 4
        for casino in state["casinos"]:
            casino["dice"] = {}
        state["players"]["p0"]["banknotes"] = [90000]
        state["players"]["p1"]["banknotes"] = [50000, 40000]
        state["players"]["p2"]["banknotes"] = [80000]
        _settle_round(state)
        for pid in ["p0", "p1"]:
            self.act(state, "next_round", pid)
            self.assertFalse(state["game_over"])
            self.assertEqual(state["final_results"], [])
        self.act(state, "next_round", "p2")
        self.assertEqual((state["phase"], state["round"]), ("game_over", 4))
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])
        self.assertEqual(state["final_results"], [
            {"player_id": "p1", "total": 90000, "banknote_count": 2, "rank": 1},
            {"player_id": "p0", "total": 90000, "banknote_count": 1, "rank": 2},
            {"player_id": "p2", "total": 80000, "banknote_count": 1, "rank": 3},
        ])

    def test_equal_amount_and_note_count_share_the_win_and_final_actions_stop(self):
        state = self.game()
        state["players"]["p0"]["banknotes"] = [50000, 40000]
        state["players"]["p1"]["banknotes"] = [70000, 20000]
        state["players"]["p2"]["banknotes"] = [80000]
        _finish_game(state)
        self.assertEqual(state["winner"], ["p0", "p1"])
        self.assertEqual([row["rank"] for row in state["final_results"]], [1, 1, 3])
        self.assertTrue(all(row["total"] is not None for row in Game.get_public_view(state, "spectator")["players"]))
        for pid in state["turn_order"]:
            self.assertEqual(Game.get_legal_actions(state, pid), [])
            self.assertIsNone(Game.bot_move(state, pid))
            self.assert_rejected(state, pid, {"type": "next_round", "round": state["round"]})

    def test_malformed_stale_out_of_turn_and_replayed_actions_do_not_mutate(self):
        state = self.game()
        actor = state["current_turn"]
        valid = {"type": "roll", "round": 1, "turn": 1}
        invalid = [None, False, [], "roll", {}, {"type": "cheat"},
                   {**valid, "extra": 1}, {**valid, "face": 1},
                   {**valid, "round": 2}, {**valid, "turn": 2}]
        for key in valid:
            candidate = dict(valid)
            del candidate[key]
            invalid.append(candidate)
        for key in ("round", "turn"):
            invalid.extend({**valid, key: value} for value in [True, False, 1.0, "1", 0, -1, None, [], {}])
        for action in invalid:
            with self.subTest(action=action):
                self.assert_rejected(state, actor, action)
        other = next(pid for pid in state["turn_order"] if pid != actor)
        for pid in [other, "spectator", None, []]:
            self.assert_rejected(state, pid, valid)
        self.act(state, "roll")
        self.assert_rejected(state, actor, valid)
        placement = {"type": "place", "round": 1, "turn": 1, "face": state["roll"]["own"][0]}
        for value in [True, 1.0, "1", 0, 7, None, [], {}]:
            self.assert_rejected(state, actor, {**placement, "face": value})
        self.act(state, "place", face=placement["face"])
        self.assert_rejected(state, actor, placement)

    def test_private_banknotes_deck_and_total_are_hidden_from_others(self):
        state = self.game()
        state["players"]["p0"]["banknotes"] = [10000, 20000]
        state["players"]["p1"]["banknotes"] = [70000, 90000]
        view = Game.get_public_view(state, "p0")
        self.assertEqual((view["your_banknotes"], view["your_total"]), ([10000, 20000], 30000))
        self.assertEqual(view["players"][0]["total"], 30000)
        self.assertIsNone(view["players"][1]["total"])
        self.assertEqual(view["players"][1]["banknote_count"], 2)
        self.assertTrue(all("banknotes" not in player for player in view["players"]))
        for key in ["banknote_deck", "player_meta", "rng_state", "seed"]:
            self.assertNotIn(key, view)
        altered = copy.deepcopy(state)
        altered["players"]["p1"]["banknotes"] = [10000, 20000]
        altered["banknote_deck"].reverse()
        self.assertEqual(Game.get_public_view(altered, "p0"), view)
        spectator = Game.get_public_view(state, "spectator")
        self.assertEqual(spectator["your_banknotes"], [])
        self.assertIsNone(spectator["your_total"])
        self.assertEqual(spectator["legal_actions"], [])
        self.assertTrue(all(player["total"] is None for player in spectator["players"]))

    def test_views_and_serialization_are_independent_deep_copies(self):
        state = self.game()
        _settle_round(state)
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, "p0")
        view["players"][0]["name"] = "Changed"
        view["casinos"][0]["banknotes"].clear()
        view["round_summary"]["casinos"][0]["dice"]["p0"] = 99
        view["next_ready"].append("p0")
        view["your_banknotes"].append(99999)
        view["log"].clear()
        self.assertEqual(state, before)
        saved = Game.serialize(state)
        self.assertEqual(Game.deserialize(json.loads(json.dumps(saved))), state)
        saved["banknote_deck"].clear()
        saved["players"]["p0"]["banknotes"].append(99999)
        self.assertEqual(state, before)
        payload = Game.serialize(state)
        restored = Game.deserialize(payload)
        restored["casinos"].clear()
        restored["player_meta"]["p0"]["name"] = "Changed"
        self.assertEqual(payload, before)

    def test_bot_receives_only_public_view_and_confirms_only_itself(self):
        state = self.game()
        actor = state["current_turn"]
        public = Game.get_public_view(state, actor)
        with patch("game.las_vegas._choose_bot_action", return_value=None) as choose:
            Game.bot_move(state, actor)
        choose.assert_called_once_with(public)
        _settle_round(state)
        before = copy.deepcopy(state)
        action = Game.bot_move(state, "p0")
        self.assertEqual(state, before)
        self.assertEqual(action, {"type": "next_round", "round": 1})
        self.assertIsNone(Game.apply_action(state, "p0", action)[1])
        self.assertEqual(state["next_ready"], ["p0"])
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_bot_cannot_use_hidden_money_or_future_notes_to_choose_placement(self):
        state = self.game()
        self.force_roll(state, [1, 2, 2, 3])
        state["players"]["p1"]["banknotes"] = [10000, 20000]
        state["players"]["p2"]["banknotes"] = [30000]
        action = Game.bot_move(state, "p0")
        altered = copy.deepcopy(state)
        altered["banknote_deck"].reverse()
        altered["players"]["p1"]["banknotes"] = [90000, 90000]
        altered["players"]["p2"]["banknotes"] = [10000]
        self.assertEqual(Game.bot_move(altered, "p0"), action)

    def test_all_supported_player_counts_and_variants_finish_and_conserve_components(self):
        for count, neutral in [(2, False), (3, False), (4, False), (5, False),
                               (2, True), (3, True), (4, True)]:
            with self.subTest(count=count, neutral=neutral):
                state = self.game(count, neutral=neutral)
                pauses, actions, starters = set(), 0, {}
                while not state["game_over"] and actions < 1000:
                    progressed = False
                    starters.setdefault(state["round"], state["start_player"])
                    for pid in state["turn_order"]:
                        if state["phase"] == "round_end":
                            pauses.add(state["round"])
                        action = Game.bot_move(state, pid)
                        if action is None:
                            continue
                        before = copy.deepcopy(state)
                        self.assertEqual(Game.bot_move(state, pid), action)
                        self.assertEqual(state, before)
                        events, error = Game.apply_action(state, pid, action)
                        self.assertIsNone(error, action)
                        self.assertTrue(events)
                        self.assert_conserved(state)
                        progressed = True
                        actions += 1
                    self.assertTrue(progressed or state["game_over"])
                self.assertTrue(state["game_over"])
                self.assertEqual(pauses, {1, 2, 3, 4})
                self.assertEqual(state["round"], 4)
                self.assertTrue(state["winner"])
                self.assertEqual(len(state["final_results"]), count)
                for number in range(2, 5):
                    expected = (state["turn_order"].index(starters[number - 1]) + 1) % count
                    self.assertEqual(starters[number], state["turn_order"][expected])


if __name__ == "__main__":
    unittest.main()
