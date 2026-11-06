import copy
import random
import unittest
from unittest.mock import patch

from game.six_nimmt import SixNimmtGame as Game, _bullheads_for_value, _deal_round
from game.six_nimmt_ai import _place, _sample_plays, choose_action


def card(value):
    return {"value": value, "bulls": _bullheads_for_value(value)}


def make_state(count=4):
    players = [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index,
                "is_bot": index > 0} for index in range(count)]
    with patch("game.six_nimmt.random.shuffle", random.Random(12).shuffle):
        return Game.init_game({"selection_timeout_sec": 0, "row_choice_timeout_sec": 0}, players)


class SixNimmtTests(unittest.TestCase):
    def test_deal_and_bullhead_values(self):
        self.assertEqual([_bullheads_for_value(value) for value in [1, 5, 10, 11, 55, 100, 104]],
                         [1, 2, 3, 5, 7, 3, 1])
        for count in [2, 4, 10]:
            state = make_state(count)
            cards = [entry for player in state["players"].values() for entry in player["hand"]]
            cards += [row[0] for row in state["rows"]] + state["deck"]
            self.assertEqual(sorted(entry["value"] for entry in cards), list(range(1, 105)))
            self.assertEqual(state["seen_cards"], sorted(row[0]["value"] for row in state["rows"]))

    def test_selected_cards_stay_private_until_everyone_locks(self):
        state = make_state()
        initial_seen = list(state["seen_cards"])
        chosen = state["players"]["p0"]["hand"][0]
        events, error = Game.apply_action(state, "p0", {"type": "select_card", "value": chosen["value"]})
        self.assertIsNone(error)
        self.assertEqual(events, [{"type": "six_nimmt:select", "payload": {"player_id": "p0"}}])
        self.assertEqual(Game.get_public_view(state, "p0")["selected_card"], chosen)
        for viewer in ["p1", "spectator"]:
            view = Game.get_public_view(state, viewer)
            self.assertIsNone(view["selected_card"])
            self.assertEqual(view["seen_cards"], initial_seen)
            self.assertEqual(view["reveal_order"], [])
            self.assertNotIn("deck", view)
            self.assertNotIn("hand", view["players"][0])
        for player_id in ["p1", "p2", "p3"]:
            action = {"type": "select_card", "value": state["players"][player_id]["hand"][0]["value"]}
            self.assertIsNone(Game.apply_action(state, player_id, action)[1])
        public = Game.get_public_view(state, "p0")
        self.assertIn(chosen["value"], public["seen_cards"])
        self.assertEqual(len(public["reveal_order"]), 4)

    def test_ai_only_receives_public_information(self):
        state = make_state()
        with patch("game.six_nimmt_ai.choose_action", return_value=None) as policy:
            Game.bot_move(state, "p0")
        view = policy.call_args.args[0]
        self.assertNotIn("deck", view)
        self.assertNotIn("pending_plays", view)
        self.assertTrue(all("hand" not in player for player in view["players"]))

    def test_ai_is_deterministic_nonmutating_and_independent_of_hidden_hands(self):
        state = make_state()
        before = copy.deepcopy(state)
        rng_state = random.getstate()
        action = Game.bot_move(state, "p0")
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), rng_state)
        changed = copy.deepcopy(state)
        changed["deck"].reverse()
        changed["players"]["p1"]["hand"], changed["players"]["p2"]["hand"] = (
            changed["players"]["p2"]["hand"], changed["players"]["p1"]["hand"])
        self.assertEqual(action, Game.bot_move(changed, "p0"))
        self.assertEqual(action, Game.bot_move(state, "p0"))
        self.assertIn(action["value"], [entry["value"] for entry in state["players"]["p0"]["hand"]])


    def test_ai_prefers_guaranteed_safe_adjacent_card(self):
        state = make_state(2)
        state["rows"] = [[card(value) for value in row] for row in [[10, 11, 12, 13, 14], [50], [70], [90]]]
        state["players"]["p0"]["hand"] = [card(15), card(51)]
        state["players"]["p1"]["hand"] = [card(100), card(104)]
        state["seen_cards"] = [value for value in range(1, 105) if value not in [15, 51, 100, 104]]
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "select_card", "value": 51})

    def test_ai_considers_earlier_cards_filling_a_row(self):
        state = make_state(2)
        state["rows"] = [[card(value) for value in row] for row in [[10, 11, 12, 13], [50], [70], [90]]]
        state["players"]["p0"]["hand"] = [card(16), card(51)]
        state["players"]["p1"]["hand"] = [card(14)]
        state["seen_cards"] = [value for value in range(1, 105) if value not in [14, 16, 51]]
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "select_card", "value": 51})

    def test_ai_samples_no_public_or_own_cards_and_no_duplicates(self):
        view = Game.get_public_view(make_state(10), "p0")
        rows = [(row["cards"][-1]["value"], len(row["cards"]), row["bulls_total"]) for row in view["rows"]]
        hand = [entry["value"] for entry in view["hand"]]
        known = set(view["seen_cards"]) | set(hand)
        for plays in _sample_plays(view, rows, hand):
            self.assertEqual(len(plays), 9)
            self.assertEqual(len(plays), len(set(plays)))
            self.assertFalse(known.intersection(plays))

    def test_ai_cannot_see_other_locked_cards(self):
        state = make_state()
        Game.apply_action(state, "p1", {"type": "select_card", "value": state["players"]["p1"]["hand"][0]["value"]})
        changed = copy.deepcopy(state)
        changed["players"]["p1"]["selected_card"], changed["players"]["p1"]["hand"][0] = (
            changed["players"]["p1"]["hand"][0], changed["players"]["p1"]["selected_card"])
        self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(changed, "p0"))

    def test_simulator_matches_sixth_card_and_too_small_rules(self):
        rows = [(14, 5, 9), (50, 1, 3), (70, 1, 3), (90, 1, 3)]
        self.assertEqual(_place(rows, 15), 9)
        self.assertEqual(rows[0], (15, 1, 2))
        self.assertEqual(_place(rows, 16), 0)
        self.assertEqual(rows[0], (16, 2, 3))
        self.assertEqual(_place(rows, 1, 2), 3)
        self.assertEqual(rows[2], (1, 1, 1))

    def test_row_choice_minimizes_penalty_and_checks_actor(self):
        state = make_state()
        state["rows"] = [[card(11)], [card(55)], [card(88)], [card(91)]]
        state.update(phase="row_choice", waiting_for={"player_id": "p0", "card": card(1)})
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "choose_row", "row_index": 3})
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "spectator"))

    def test_bots_wait_for_human_summary_ack_and_do_not_ack_twice(self):
        state = make_state()
        state.update(phase="turn_summary", summary_pending={"type": "next_turn"}, pending_timeout=None)
        for player_id in ["p1", "p2", "p3"]:
            action = Game.bot_move(state, player_id)
            self.assertEqual(action, {"type": "ack_turn_summary"})
            self.assertIsNone(Game.apply_action(state, player_id, action)[1])
            self.assertIsNone(Game.bot_move(state, player_id))
            self.assertEqual(Game.get_legal_actions(state, player_id), [])
        self.assertEqual(state["phase"], "turn_summary")
        self.assertIsNone(Game.resolve_timeout(state, 10**15))
        Game.apply_action(state, "p0", {"type": "ack_turn_summary"})
        self.assertEqual((state["phase"], state["turn"]), ("selection", 2))

    def test_new_round_resets_seen_cards_and_old_save_remains_playable(self):
        state = make_state()
        state["seen_cards"] = list(range(1, 105))
        _deal_round(state)
        self.assertEqual(len(state["seen_cards"]), 4)
        state.pop("seen_cards")
        restored = Game.deserialize(copy.deepcopy(Game.serialize(state)))
        action = Game.bot_move(restored, "p0")
        self.assertIsNone(Game.apply_action(restored, "p0", action)[1])

    def test_timeout_events_do_not_disclose_auto_selected_values(self):
        state = make_state()
        state["pending_timeout"] = {"type": "selection", "at_ms": 1}
        events = Game.resolve_timeout(state, 2)
        auto_events = [event for event in events if event["type"] == "six_nimmt:auto_select"]
        self.assertEqual(len(auto_events), 4)
        self.assertTrue(all(set(event["payload"]) == {"player_id"} for event in auto_events))

    def test_ai_finishes_full_rounds_for_two_and_ten_players(self):
        for count in [2, 10]:
            state = make_state(count)
            for step in range(400):
                if state["round"] > 1 or state["game_over"]:
                    break
                moved = False
                for player_id in state["players"]:
                    action = Game.bot_move(state, player_id)
                    if action:
                        self.assertIsNone(Game.apply_action(state, player_id, action)[1])
                        moved = True
                        break
                self.assertTrue(moved, (count, step, state["phase"]))
            else:
                self.fail(f"{count}-player round did not finish")

    def test_ai_does_not_act_after_game_over(self):
        state = make_state()
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))
        self.assertIsNone(choose_action({"legal_actions": []}))

    def test_strategy_bots_complete_a_full_game(self):
        with patch("game.six_nimmt.random.shuffle", random.Random(20261106).shuffle):
            state = make_state(4)
            for step in range(4000):
                if state["game_over"]:
                    break
                for player_id in state["players"]:
                    action = Game.bot_move(state, player_id)
                    if action:
                        self.assertIsNone(Game.apply_action(state, player_id, action)[1])
                        break
                else:
                    self.fail(f"Full game stalled on step {step}")
            else:
                self.fail("Full game never reached the target score")
        scores = [player["score"] for player in state["players"].values()]
        self.assertGreaterEqual(max(scores), 66)
        self.assertTrue(state["winners"])
        self.assertTrue(all(state["players"][winner]["score"] == min(scores) for winner in state["winners"]))


if __name__ == "__main__":
    unittest.main()
