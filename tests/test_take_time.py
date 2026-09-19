import copy
import json
import unittest

from game.take_time import TakeTimeGame, _evaluate
from game.take_time_data import CLOCK_IDS


class TakeTimeTests(unittest.TestCase):
    def make_game(self, count=3, clock="awakening_1", seed=98):
        players = [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": i > 0}
                   for i in range(count)]
        return TakeTimeGame.init_game({"seed": seed, "start_clock": clock}, players)

    def act(self, state, pid, kind, **fields):
        events, error = TakeTimeGame.apply_action(state, pid, {"type": kind, **fields})
        self.assertIsNone(error, error)
        self.assertTrue(events)
        return events

    def ready_all(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, "ready")

    def place(self, state, segment=0, face_up=False):
        pid = state["current_turn"] or state["turn_order"][0]
        card_id = TakeTimeGame.get_public_view(state, pid)["legal_card_ids"][0]
        return self.act(state, pid, "place", card_id=card_id, segment=segment, face_up=face_up)

    def finish_round(self, state):
        if state["phase"] == "discussion":
            self.ready_all(state)
        while state["phase"] == "placement":
            pid = state["current_turn"] or state["turn_order"][0]
            view = TakeTimeGame.get_public_view(state, pid)
            self.place(state, view["legal_segments"][0])

    def confirm_all(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, "next_round")

    def set_board(self, state, piles):
        state["board"] = []
        order = 0
        for pile in piles:
            cards = []
            for value, color in pile:
                order += 1
                cards.append({"id": f"test{order}", "value": value, "color": color,
                              "owner": "p0", "face_up": False, "order": order})
            state["board"].append(cards)

    def test_deals_twelve_unique_cards_and_opaque_ids(self):
        for count in (2, 3, 4):
            with self.subTest(count=count):
                state = self.make_game(count)
                cards = [card for player in state["players"].values() for card in player["hand"] + player["reserve"]]
                self.assertEqual(len(cards), 12)
                self.assertEqual(len({(card["color"], card["value"]) for card in cards}), 12)
                self.assertEqual(len({card["id"] for card in cards}), 12)
                for card in cards:
                    self.assertRegex(card["id"], r"^c[0-9a-f]{32}$")
                for player in state["players"].values():
                    self.assertEqual(len(player["hand"]), 4 if count in (2, 3) else 3)
                    self.assertEqual(len(player["reserve"]), 2 if count == 2 else 0)
                self.assertEqual(TakeTimeGame.get_public_view(state, "p0")["face_up_limit"], count)

    def test_discussion_hides_values_including_own_and_reserve(self):
        state = self.make_game(2)
        for viewer in ("p0", "p1", "observer"):
            view = TakeTimeGame.get_public_view(state, viewer)
            for player in view["players"]:
                self.assertTrue(all(card["value"] is None for card in player["hand"] + player["reserve"]))
            for key in ("seed", "config", "deck", "queue", "rng_state"):
                self.assertNotIn(key, view)
        self.assertEqual(TakeTimeGame.get_legal_actions(state, "observer"), [])

    def test_ready_is_private_irreversible_and_locks_plan(self):
        state = self.make_game()
        self.act(state, "p1", "set_plan", segment=2, target=15)
        self.assertEqual(state["targets"][2], 15)
        self.act(state, "p0", "ready")
        self.assertEqual(state["phase"], "discussion")
        own = TakeTimeGame.get_public_view(state, "p0")
        other = TakeTimeGame.get_public_view(state, "p1")
        self.assertTrue(all(card["value"] is not None for card in own["players"][0]["hand"]))
        self.assertTrue(all(card["value"] is None for card in other["players"][0]["hand"]))
        for pid in state["turn_order"]:
            self.assertNotIn("set_plan", TakeTimeGame.get_legal_actions(state, pid))
        self.assertNotIn("ready", TakeTimeGame.get_legal_actions(state, "p0"))
        self.assertNotIn("place", TakeTimeGame.get_legal_actions(state, "p0"))

    def test_anyone_starts_then_seat_order_and_no_double_play(self):
        state = self.make_game(4)
        self.ready_all(state)
        self.assertIsNone(state["current_turn"])
        for pid in state["turn_order"]:
            self.assertIn("place", TakeTimeGame.get_legal_actions(state, pid))
        card = state["players"]["p2"]["hand"][0]
        self.act(state, "p2", "place", card_id=card["id"], segment=3, face_up=False)
        self.assertEqual(state["current_turn"], "p3")
        self.assertEqual(TakeTimeGame.get_legal_actions(state, "p2"), [])
        self.place(state, 1)
        self.assertEqual(state["current_turn"], "p0")

    def test_two_player_reserves_released_to_both_after_fourth_play(self):
        state = self.make_game(2)
        self.ready_all(state)
        reserves = copy.deepcopy({pid: player["reserve"] for pid, player in state["players"].items()})
        for _ in range(3):
            self.place(state)
        self.assertTrue(all(len(player["reserve"]) == 2 for player in state["players"].values()))
        for player in TakeTimeGame.get_public_view(state, "p0")["players"]:
            self.assertTrue(all(card["value"] is None for card in player["reserve"]))
        self.place(state)
        for pid, player in state["players"].items():
            self.assertEqual(player["reserve"], [])
            self.assertEqual(len(player["hand"]), 4)
            self.assertTrue(all(card in player["hand"] for card in reserves[pid]))
        self.assertTrue(all(card["value"] is None for card in TakeTimeGame.get_public_view(state, "p0")["players"][1]["hand"]))

    def test_facedown_owner_can_review_but_others_and_events_cannot(self):
        state = self.make_game()
        self.ready_all(state)
        card = state["players"]["p0"]["hand"][0]
        events = self.act(state, "p0", "place", card_id=card["id"], segment=3, face_up=False)
        self.assertEqual(TakeTimeGame.get_public_view(state, "p0")["board"][3][0]["value"], card["value"])
        for viewer in ("p1", "observer"):
            public = TakeTimeGame.get_public_view(state, viewer)["board"][3][0]
            self.assertIsNone(public["value"])
            self.assertEqual(public["color"], card["color"])
            self.assertEqual(public["owner"], "p0")
        self.assertNotIn(card["id"], json.dumps(events))
        self.assertTrue(state["log"][-1].endswith("face down"))

    def test_face_up_quota_and_bonus_cap(self):
        state = self.make_game(2)
        self.ready_all(state)
        self.place(state, face_up=True)
        self.place(state, face_up=True)
        pid = state["current_turn"]
        action = {"type": "place", "card_id": state["players"][pid]["hand"][0]["id"], "segment": 1, "face_up": True}
        before = copy.deepcopy(state)
        self.assertIsNotNone(TakeTimeGame.apply_action(state, pid, action)[1])
        self.assertEqual(state, before)
        self.assertIsNotNone(TakeTimeGame.get_public_view(state, "observer")["board"][0][0]["value"])
        self.finish_round(state)
        self.assertEqual(state["bonus"], 1)
        self.assertEqual(TakeTimeGame.get_public_view(state, "p0")["face_up_limit"], 2)
        for expected in (3, 4, 5, 5):
            self.confirm_all(state)
            self.assertEqual(TakeTimeGame.get_public_view(state, "p0")["face_up_limit"], expected)
            self.finish_round(state)
        self.assertEqual(state["bonus"], 3)

    def test_silent_clock_never_allows_face_up_even_with_bonus(self):
        state = self.make_game(clock="silent_night")
        state["bonus"] = 3
        state["attempt_bonus"] = 3
        self.ready_all(state)
        self.assertEqual(TakeTimeGame.get_public_view(state, "p0")["face_up_limit"], 0)
        card = state["players"]["p0"]["hand"][0]
        before = copy.deepcopy(state)
        self.assertIsNotNone(TakeTimeGame.apply_action(state, "p0", {"type": "place", "card_id": card["id"], "segment": 0, "face_up": True})[1])
        self.assertEqual(state, before)

    def test_official_example_allows_equal_totals_and_over_twenty_four(self):
        state = self.make_game()
        self.set_board(state, [ [(3,"solar")], [(8,"lunar")], [(11,"lunar")],
                               [(1,"solar"),(10,"solar")], [(8,"solar"),(12,"solar")],
                               [(11,"solar"),(12,"lunar"),(9,"lunar")] ])
        result = _evaluate(state)
        self.assertTrue(result["success"])
        self.assertEqual([segment["sum"] for segment in result["segments"]], [3, 8, 11, 11, 20, 32])
        state["board"][0][0]["color"] = "lunar"
        self.assertFalse(_evaluate(state)["success"])
        self.assertFalse(_evaluate(state)["segments"][0]["checks"][-1]["passed"])

    def test_standard_cap_and_empty_segments_fail(self):
        state = self.make_game(clock="open_sky")
        self.set_board(state, [[(i,"solar")] for i in range(1, 7)])
        self.assertTrue(_evaluate(state)["success"])
        state["board"][5] = [{"value": 12, "color": "solar"}] * 3
        self.assertFalse(_evaluate(state)["segments"][5]["passed"])
        state["board"][0] = []
        self.assertFalse(_evaluate(state)["segments"][0]["checks"][0]["passed"])

    def test_resolution_checks_are_not_preemptively_enforced(self):
        state = self.make_game()
        self.ready_all(state)
        lunar = next((card for card in state["players"]["p0"]["hand"] if card["color"] == "lunar"), None)
        self.assertIsNotNone(lunar)
        self.act(state, "p0", "place", card_id=lunar["id"], segment=0, face_up=False)
        self.assertEqual(state["phase"], "placement")
        self.assertIsNone(TakeTimeGame.get_public_view(state, "p1")["result"])

    def test_range_includes_endpoints_and_closest_allows_ties(self):
        state = self.make_game(clock="windows")
        self.set_board(state, [[(value,"solar")] for value in (3, 6, 10, 12, 16, 20)])
        self.assertTrue(_evaluate(state)["success"])
        state["board"][1][0]["value"] = 10
        state["board"][4][0]["value"] = 22
        state["board"][5][0]["value"] = 24
        self.assertTrue(_evaluate(state)["success"])
        state["board"][1][0]["value"] = 5
        self.assertFalse(_evaluate(state)["segments"][1]["passed"])
        state = self.make_game(clock="echoes")
        self.set_board(state, [[(value,"solar")] for value in (3, 8, 10, 17, 19, 22)])
        self.assertTrue(_evaluate(state)["success"])
        state["board"][2][0]["value"] = 9
        self.assertFalse(_evaluate(state)["segments"][1]["passed"])

    def test_forced_plays_first_second_and_last(self):
        state = self.make_game(clock="first_and_last")
        self.ready_all(state)
        self.assertEqual(TakeTimeGame.get_public_view(state, "p0")["legal_segments"], [0])
        card = state["players"]["p0"]["hand"][0]
        before = copy.deepcopy(state)
        self.assertIsNotNone(TakeTimeGame.apply_action(state, "p0", {"type":"place", "card_id":card["id"], "segment":1, "face_up":False})[1])
        self.assertEqual(state, before)
        self.place(state, 0)
        self.assertEqual(TakeTimeGame.get_public_view(state, "p1")["legal_segments"], [1])
        self.place(state, 1)
        for _ in range(9):
            self.place(state, 2)
        pid = state["current_turn"]
        self.assertEqual(TakeTimeGame.get_public_view(state, pid)["legal_segments"], [5])
        self.place(state, 5)
        self.assertEqual(state["phase"], "round_end")

    def test_highest_and_lowest_apply_only_to_current_hand(self):
        for clock, extreme in (("high_tide", max), ("low_tide", min)):
            state = self.make_game(2, clock)
            self.ready_all(state)
            view = TakeTimeGame.get_public_view(state, "p0")
            hand = state["players"]["p0"]["hand"]
            expected = extreme(card["value"] for card in hand)
            self.assertEqual(set(view["legal_card_ids"]), {card["id"] for card in hand if card["value"] == expected})
            wrong = next(card for card in hand if card["value"] != expected)
            before = copy.deepcopy(state)
            self.assertIsNotNone(TakeTimeGame.apply_action(state, "p0", {"type":"place", "card_id":wrong["id"], "segment":0, "face_up":False})[1])
            self.assertEqual(state, before)
            for _ in range(4):
                self.place(state)
            hand = state["players"]["p0"]["hand"]
            expected = extreme(card["value"] for card in hand)
            ids = TakeTimeGame.get_public_view(state, "p0")["legal_card_ids"]
            self.assertTrue(all(card["value"] == expected for card in hand if card["id"] in ids))

    def test_movable_hand_finds_valid_rotation_without_sorting_piles(self):
        state = self.make_game(clock="pairs")
        self.act(state, "p0", "set_hand", segment=3)
        self.set_board(state, [[(value,"solar"),(value,"lunar")] for value in (4, 5, 6, 1, 2, 3)])
        before = copy.deepcopy(state["board"])
        result = _evaluate(state)
        self.assertTrue(result["success"])
        self.assertEqual(result["hand_segment"], 3)
        state["hand_segment"] = 0
        self.assertEqual(_evaluate(state)["hand_segment"], 3)
        self.assertEqual(state["board"], before)
        state["clock_id"] = "open_sky"
        self.assertFalse(_evaluate(state)["success"])

    def test_extreme_rules_accept_tied_extremes(self):
        state = self.make_game(clock="orbit")
        self.set_board(state, [[(value,"solar")] for value in (1, 2, 5, 12, 12, 12)])
        self.assertTrue(_evaluate(state)["success"])
        state["board"][0][0]["value"] = 3
        self.assertFalse(_evaluate(state)["segments"][0]["checks"][-1]["passed"])

    def test_difference_uses_differences_not_sums_and_needs_two_cards(self):
        state = self.make_game(clock="differences")
        self.set_board(state, [[(low,"solar"),(high,"lunar")] for low, high in ((8,8),(1,2),(7,9),(1,4),(4,8),(1,6))])
        result = _evaluate(state)
        self.assertTrue(result["success"])
        self.assertEqual([segment["value"] for segment in result["segments"]], list(range(6)))
        self.assertEqual(result["segments"][0]["sum"], 16)
        state["board"][0].pop()
        self.assertFalse(_evaluate(state)["success"])

    def test_all_must_confirm_and_choice_change_resets_confirmation(self):
        state = self.make_game()
        self.finish_round(state)
        board = copy.deepcopy(state["board"])
        self.act(state, "p0", "next_round")
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["board"], board)
        self.assertNotIn("choose_next", TakeTimeGame.get_legal_actions(state, "p0"))
        self.act(state, "p1", "choose_next", choice="skip")
        self.assertEqual(state["next_ready"], [])
        self.act(state, "p0", "next_round")
        self.act(state, "p1", "next_round")
        self.assertEqual(state["phase"], "round_end")
        self.act(state, "p2", "next_round")
        self.assertEqual(state["phase"], "discussion")
        self.assertEqual(state["clock_id"], "open_sky")
        self.assertEqual(state["regrets"], ["awakening_1"])
        self.assertEqual(state["bonus"], 0)

    def test_regrets_are_revisited_and_finish_is_unanimous(self):
        state = self.make_game(clock="differences")
        self.finish_round(state)
        self.act(state, "p0", "choose_next", choice="skip")
        self.confirm_all(state)
        self.assertEqual(state["clock_id"], "differences")
        self.assertEqual(state["regrets"], ["differences"])
        self.assertFalse(state["game_over"])
        self.finish_round(state)
        self.act(state, "p0", "choose_next", choice="finish")
        self.act(state, "p0", "next_round")
        self.assertFalse(state["game_over"])
        self.act(state, "p1", "next_round")
        self.act(state, "p2", "next_round")
        self.assertTrue(state["game_over"])
        self.assertFalse(TakeTimeGame.get_public_view(state, "p0")["journey_complete"])

    def test_successful_last_clock_finishes_after_everyone_reviews(self):
        state = self.make_game(clock="pairs")
        state["queue"] = []
        state["itinerary"] = ["pairs"]
        self.ready_all(state)
        # Real twelve-card valid finish, retain the final card in the actor's hand.
        piles = [[(i,"solar"),(i,"lunar")] for i in range(1, 7)]
        self.set_board(state, piles)
        last = state["board"][5].pop()
        state["placed_count"] = 11
        for player in state["players"].values():
            player["hand"] = []
        state["players"]["p0"]["hand"] = [last]
        state["current_turn"] = "p0"
        self.place(state, 5)
        self.assertTrue(state["result"]["success"])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["completed"], ["pairs"])
        self.confirm_all(state)
        self.assertTrue(state["game_over"])
        self.assertTrue(TakeTimeGame.get_public_view(state, "p0")["journey_complete"])

    def test_invalid_actions_are_atomic_even_when_schema_validation_skipped(self):
        state = self.make_game()
        self.ready_all(state)
        card_id = state["players"]["p0"]["hand"][0]["id"]
        action = {"type":"place", "card_id":card_id, "segment":0, "face_up":False}
        bad_actions = [None, [], {}, {"type":"ready"}, {**action, "segment":True}, {**action, "segment":6},
                       {**action, "segment":-1}, {**action, "segment":"0"}, {**action, "face_up":1},
                       {**action, "extra":True}, {**action, "card_id":"missing"},
                       {**action, "card_id":state["players"]["p1"]["hand"][0]["id"]}]
        for bad in bad_actions:
            before = copy.deepcopy(state)
            events, error = TakeTimeGame.apply_action(state, "p0", bad)
            self.assertIsNotNone(error, bad)
            self.assertEqual(events, [])
            self.assertEqual(state, before)
        before = copy.deepcopy(state)
        self.assertIsNotNone(TakeTimeGame.apply_action(state, "observer", action)[1])
        self.assertEqual(state, before)

    def test_invalid_config_and_player_counts_rejected(self):
        players = [{"player_id":"p0"}, {"player_id":"p1"}]
        for config in ([], {"seed":True}, {"start_clock":"official_40"}, {"unknown":1}):
            with self.assertRaises(ValueError):
                TakeTimeGame.init_game(config, players)
        for count in (0, 1, 5):
            with self.assertRaises(ValueError):
                self.make_game(count)
        with self.assertRaises(ValueError):
            TakeTimeGame.init_game({}, [players[0], players[0]])

    def test_save_reload_is_independent_and_redeals_deterministically(self):
        state = self.make_game(2)
        self.ready_all(state)
        for _ in range(3):
            self.place(state)
        payload = TakeTimeGame.serialize(state)
        loaded = TakeTimeGame.deserialize(json.loads(json.dumps(payload)))
        self.assertEqual(state, loaded)
        loaded["targets"][0] = 35
        self.assertNotEqual(state["targets"], loaded["targets"])
        loaded = TakeTimeGame.deserialize(payload)
        for game in (state, loaded):
            self.finish_round(game)
            self.confirm_all(game)
        self.assertEqual(state, loaded)
        self.assertEqual(self.make_game(), self.make_game())

    def test_bot_does_not_inspect_hidden_cards_or_mutate_state(self):
        for clock in CLOCK_IDS:
            state = self.make_game(2, clock)
            self.ready_all(state)
            before = copy.deepcopy(state)
            action = TakeTimeGame.bot_move(state, "p0")
            self.assertEqual(state, before)
            altered = copy.deepcopy(state)
            for card in altered["players"]["p1"]["hand"]:
                card["value"] = 13 - card["value"]
            for player in altered["players"].values():
                for card in player["reserve"]:
                    card["value"] = 13 - card["value"]
            self.assertEqual(TakeTimeGame.bot_move(altered, "p0"), action)

    def test_bots_leave_time_for_humans_to_discuss(self):
        state = self.make_game()
        self.assertIsNone(TakeTimeGame.bot_move(state, "p1"))
        self.assertIn("set_plan", TakeTimeGame.get_legal_actions(state, "p0"))
        self.act(state, "p0", "ready")
        self.assertEqual(TakeTimeGame.bot_move(state, "p1"), {"type": "ready"})

    def test_every_clock_plays_through_with_two_three_and_four_bots(self):
        for clock in CLOCK_IDS:
            for count in (2, 3, 4):
                with self.subTest(clock=clock, count=count):
                    state = self.make_game(count, clock)
                    self.ready_all(state)
                    for _ in range(12):
                        pid = state["current_turn"] or "p0"
                        action = TakeTimeGame.bot_move(state, pid)
                        self.assertIsNotNone(action)
                        _, error = TakeTimeGame.apply_action(state, pid, action)
                        self.assertIsNone(error)
                    self.assertEqual(state["phase"], "round_end")
                    self.assertEqual(sum(len(cards) for cards in state["board"]), 12)
                    self.assertTrue(all(not player["hand"] and not player["reserve"] for player in state["players"].values()))
                    self.assertTrue(all(card["value"] is not None for cards in TakeTimeGame.get_public_view(state, "observer")["board"] for card in cards))
                    self.assertEqual(TakeTimeGame.bot_move(state, "p1"), {"type":"next_round"})
                    self.act(state, "p1", "next_round")
                    self.assertEqual(state["phase"], "round_end")


if __name__ == "__main__":
    unittest.main()
