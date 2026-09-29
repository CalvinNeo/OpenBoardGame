import copy
import json
import unittest
from collections import Counter

from game.maskmen import (
    MASKS, MaskmenGame as Game, _start_bout,
    championship_winners, hand_size, play_options, strength_closure,
)
from game.maskmen_ai import choose_action


def make_state(count=4, seed=137):
    return Game.init_game({"seed": seed}, [
        {"player_id": f"p{i}", "name": f"Wrestler {i}", "seat": i, "is_bot": i > 0}
        for i in range(count)
    ])


def action(state, kind, **fields):
    return {"type": kind, **fields, **{key: state[key] for key in ("game_token", "season", "bout", "turn_number")}}


def set_hands(state, hands, leader="p0"):
    for i, cards in enumerate(hands):
        state["players"][f"p{i}"]["hand"] = {mask: cards.count(mask) for mask in MASKS}
    _start_bout(state, leader)


def bot_step(state):
    pid = next(pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid))
    move = Game.bot_move(state, pid)
    move.pop("delay_ms")
    events, error = Game.apply_action(state, pid, move)
    if error:
        raise AssertionError((pid, move, error))
    return events


class MaskmenTests(unittest.TestCase):
    def play(self, state, pid, mask, count):
        events, error = Game.apply_action(state, pid, action(state, "play", mask=mask, count=count))
        self.assertIsNone(error)
        return events

    def reject(self, state, pid, move):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, move)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def conserve(self, state):
        for mask in MASKS:
            self.assertEqual(sum(p["hand"][mask] for p in state["players"].values())
                             + state["unused"].count(mask) + state["played_counts"][mask], 10)

    def test_deal_counts_and_seed_repeatability(self):
        for count in range(2, 7):
            state, other = make_state(count), make_state(count)
            self.assertEqual([hand_size(p["hand"]) for p in state["players"].values()], [15 if count <= 4 else 60 // count] * count)
            self.assertEqual(state["players"], other["players"])
            self.assertNotEqual(state["game_token"], other["game_token"])
            self.conserve(state)
            self.assertEqual(state["relations"], [])

    def test_bad_config_and_player_counts(self):
        for count in (0, 1, 7):
            with self.assertRaises(ValueError):
                make_state(count)
        for cfg in ({"seed": True}, {"seed": []}, {"seed": ""}, {"rounds": 1}, []):
            with self.assertRaises(ValueError):
                Game.init_game(cfg, [{"player_id": "p0"}, {"player_id": "p1"}])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "p0"}] * 2)

    def test_undebuted_lead_only_one_and_no_pass(self):
        s = make_state(3)
        set_hands(s, [["orange"] * 3, ["blue"] * 3, ["green"] * 3])
        self.reject(s, "p0", action(s, "pass"))
        self.reject(s, "p0", action(s, "play", mask="orange", count=2))
        self.play(s, "p0", "orange", 1)
        self.assertIn("orange", s["introduced"])

    def test_unknown_exactly_one_more_and_max_three(self):
        s = make_state(4)
        set_hands(s, [["orange", "grey"], ["blue"] * 3, ["green"] * 4, ["pink"] * 4])
        self.play(s, "p0", "orange", 1)
        for size in (1, 3):
            self.reject(s, "p1", action(s, "play", mask="blue", count=size))
        self.play(s, "p1", "blue", 2)
        self.play(s, "p2", "green", 3)
        self.assertEqual(Game.get_legal_actions(s, "p3"), ["pass"])
        self.reject(s, "p3", action(s, "play", mask="pink", count=4))
        self.assertIn("orange", strength_closure(s["relations"])["green"])

    def test_known_strength_requires_equal_count_not_extra(self):
        s = make_state(3)
        set_hands(s, [["orange", "grey"], ["blue"] * 3, ["green"] * 3])
        s["relations"] = [["blue", "orange"]]
        self.play(s, "p0", "orange", 1)
        self.reject(s, "p1", action(s, "play", mask="blue", count=2))
        self.play(s, "p1", "blue", 1)
        self.assertEqual(s["relations"], [["blue", "orange"]])

    def test_same_and_weaker_masks_cannot_follow(self):
        options = play_options({m: 3 for m in MASKS}, list(MASKS), [["blue", "orange"]], {"mask": "blue", "count": 1})
        self.assertNotIn("blue", [p["mask"] for p in options])
        self.assertNotIn("orange", [p["mask"] for p in options])
        self.assertTrue(all(p["count"] == 2 for p in options))

    def test_closure_branch_merge_does_not_order_incomparable_masks(self):
        relations = [["pink", "blue"], ["green", "pink"], ["orange", "pink"]]
        closure = strength_closure(relations)
        self.assertEqual(closure["green"], {"pink", "blue"})
        self.assertNotIn("orange", closure["green"])
        self.assertNotIn("green", closure["orange"])
        options = play_options({"green": 3, "blue": 3}, list(MASKS), relations, {"mask": "orange", "count": 2})
        self.assertEqual(options, [{"mask": "green", "count": 3, "reason": "establish"}])
        relations.append(["green", "orange"])
        self.assertEqual(strength_closure(relations)["green"], {"orange", "pink", "blue"})

    def test_introduced_mask_leads_one_two_or_three(self):
        options = play_options({"blue": 4, "green": 3}, ["blue"], [], None)
        self.assertEqual([(p["mask"], p["count"]) for p in options], [("blue", 1), ("blue", 2), ("blue", 3), ("green", 1)])

    def test_pass_is_permanent_for_bout_and_winner_leads(self):
        s = make_state(3)
        set_hands(s, [["orange", "grey"], ["blue"] * 3, ["green"] * 4])
        self.play(s, "p0", "orange", 1)
        Game.apply_action(s, "p1", action(s, "pass"))
        self.play(s, "p2", "green", 2)
        self.assertEqual(s["current_turn"], "p0")
        self.assertEqual(Game.get_legal_actions(s, "p1"), [])
        Game.apply_action(s, "p0", action(s, "pass"))
        self.assertEqual(s["phase"], "round_review")
        self.assertEqual(s["bout_result"]["next_leader"], "p2")
        self.assertEqual(s["top"]["mask"], "green")

    def test_all_players_confirm_review_duplicate_and_stale_requests(self):
        s = make_state(3)
        set_hands(s, [["orange", "grey"], ["blue"] * 3, ["green"] * 4])
        self.play(s, "p0", "orange", 1)
        Game.apply_action(s, "p1", action(s, "pass"))
        Game.apply_action(s, "p2", action(s, "pass"))
        confirm = action(s, "next_round")
        Game.apply_action(s, "p0", confirm)
        before = copy.deepcopy(s)
        self.assertEqual(Game.apply_action(s, "p0", confirm), ([], None))
        self.assertEqual(s, before)
        Game.apply_action(s, "p1", confirm)
        self.assertEqual(s["phase"], "round_review")
        self.reject(s, "observer", confirm)
        Game.apply_action(s, "p2", confirm)
        self.assertEqual((s["phase"], s["current_turn"], s["bout"]), ("playing", "p0", 2))
        self.assertEqual(s["passed"], [])
        self.assertIsNone(s["top"])
        self.assertIn("orange", s["introduced"])
        self.reject(s, "p0", confirm)

    def test_going_out_does_not_end_season_and_unpassed_player_inherits_lead(self):
        s = make_state(3)
        set_hands(s, [["orange"], ["blue"] * 3, ["green"] * 3])
        self.play(s, "p0", "orange", 1)
        self.assertEqual(s["finish_order"], ["p0"])
        self.assertEqual(s["phase"], "playing")
        Game.apply_action(s, "p1", action(s, "pass"))
        self.assertEqual(s["phase"], "round_review")
        self.assertEqual(s["bout_result"]["next_leader"], "p2")
        self.assertEqual(Game.get_legal_actions(s, "p0"), ["next_round"])

    def test_exact_finish_order_scores_and_season_reset(self):
        s = make_state(4)
        set_hands(s, [["orange"], ["blue"] * 2, ["green"] * 3, ["pink"] * 4])
        self.play(s, "p0", "orange", 1)
        self.play(s, "p1", "blue", 2)
        self.assertEqual((s["phase"], s["current_turn"]), ("playing", "p2"))
        self.play(s, "p2", "green", 3)
        self.assertEqual(s["phase"], "season_review")
        self.assertEqual(s["finish_order"], ["p0", "p1", "p2", "p3"])
        self.assertEqual([s["players"][p]["score"] for p in s["turn_order"]], [2, 1, 0, -1])
        old = action(s, "next_season")
        for pid in s["turn_order"]:
            Game.apply_action(s, pid, old)
        self.assertEqual((s["season"], s["current_turn"], s["bout"]), (2, "p3", 1))
        self.assertEqual(s["relations"], [])
        self.assertEqual(s["introduced"], [])
        self.assertEqual(s["players"]["p0"]["wins"], 1)
        self.conserve(s)
        self.reject(s, "p3", old)

    def test_two_players_first_to_three_no_second_place_plus_one(self):
        s = make_state(2)
        for season in range(1, 4):
            set_hands(s, [["orange"], ["blue"] * 2])
            self.play(s, "p0", "orange", 1)
            self.assertEqual(s["players"]["p1"]["score"], -season)
            if season < 3:
                self.assertFalse(s["game_over"])
                for pid in s["turn_order"]:
                    Game.apply_action(s, pid, action(s, "next_season"))
        self.assertTrue(s["game_over"])
        self.assertEqual(s["winner_ids"], ["p0"])
        self.assertEqual(s["players"]["p0"]["score"], 6)

    def test_scoring_tiebreaks(self):
        s = make_state(4)
        s["finish_order"] = ["p3", "p2", "p1", "p0"]
        s["players"]["p0"].update(score=4, wins=2, last_win=2)
        s["players"]["p1"].update(score=4, wins=1, last_win=4)
        self.assertEqual(championship_winners(s), ["p0"])
        s["players"]["p1"]["wins"] = 2
        self.assertEqual(championship_winners(s), ["p1"])
        for p in s["players"].values():
            p.update(score=0, wins=0, last_win=0)
        self.assertEqual(championship_winners(s), ["p3"])

    def test_illegal_actions_are_atomic_even_without_schema_validation(self):
        s = make_state(3)
        pid = s["current_turn"]
        moves = [None, [], {}, {"type": []}, action(s, "bogus"), action(s, "play", mask=[], count=1),
                 action(s, "play", mask="blue", count=True), action(s, "play", mask="blue", count=-2),
                 action(s, "play", mask="missing", count=1), action(s, "pass", extra=1),
                 {**action(s, "pass"), "season": True}, {**action(s, "pass"), "game_token": "old"}]
        for move in moves:
            self.reject(s, pid, move)
        other = next(p for p in s["turn_order"] if p != pid)
        self.reject(s, other, action(s, "play", mask="blue", count=1))
        option = Game.get_public_view(s, pid)["legal_plays"][0]
        play = action(s, "play", mask=option["mask"], count=option["count"])
        Game.apply_action(s, pid, play)
        self.reject(s, pid, play)

    def test_public_views_do_not_expose_secrets_and_do_not_alias_state(self):
        s = make_state(3)
        before = copy.deepcopy(s)
        view = Game.get_public_view(s, "p0")
        self.assertEqual(view["your_hand"], s["players"]["p0"]["hand"])
        self.assertTrue(all("hand" not in p for p in view["players"]))
        for key in ("unused", "base_seed", "player_meta", "seed"):
            self.assertNotIn(key, view)
        spectator = Game.get_public_view(s, "observer")
        self.assertEqual(spectator["your_hand"], {})
        self.assertEqual(spectator["legal_plays"], [])
        view["your_hand"].clear()
        view["relations"].append(["orange", "blue"])
        self.assertEqual(s, before)

    def test_round_trip_serialization(self):
        s = make_state(4)
        for _ in range(25):
            bot_step(s)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(restored, s)
        for pid in s["turn_order"]:
            self.assertEqual(Game.bot_move(restored, pid), Game.bot_move(s, pid))
        restored["players"]["p0"]["hand"].clear()
        self.assertNotEqual(restored, s)

    def test_ai_takes_immediate_finish_and_never_peeks(self):
        s = make_state(3)
        set_hands(s, [["blue"], ["green"] * 3, ["pink"] * 3])
        move = choose_action(Game.get_public_view(s, "p0"))
        self.assertEqual((move["type"], move["mask"], move["count"]), ("play", "blue", 1))
        s["players"]["p1"]["hand"] = dict(Counter(["orange"] * 3))
        s["unused"] = ["orange"] * len(s["unused"])
        self.assertEqual(move, choose_action(Game.get_public_view(s, "p0")))

    def test_ai_full_matches_every_player_count_and_invariants(self):
        for count in range(2, 7):
            for seed in range(4):
                with self.subTest(count=count, seed=seed):
                    s = make_state(count, seed)
                    for _ in range(1800):
                        self.conserve(s)
                        for mask, descendants in strength_closure(s["relations"]).items():
                            self.assertNotIn(mask, descendants)
                        if s["game_over"]:
                            break
                        self.assertTrue(any(Game.get_legal_actions(s, pid) for pid in s["turn_order"]))
                        bot_step(s)
                    self.assertTrue(s["game_over"])
                    self.assertEqual(len(s["winner_ids"]), 1)
                    self.assertTrue(3 <= s["season"] <= 5 if count == 2 else s["season"] == 4)
                    self.assertTrue(all(not Game.get_legal_actions(s, pid) for pid in s["turn_order"]))


if __name__ == "__main__":
    unittest.main()
