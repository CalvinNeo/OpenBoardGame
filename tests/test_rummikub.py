import copy
import json
import unittest
from collections import Counter

from game.registry import get_game
from game.rummikub import COLORS, TILES, RummikubGame, meld_options


def players(count=2):
    return [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index} for index in range(count)]


def new_game(count=2, **config):
    return RummikubGame.init_game({"seed": 42, **config}, players(count))


def fixture(hands, table=None, opened=False, **config):
    state = new_game(len(hands), **config)
    state["table"] = copy.deepcopy(table or [])
    used = list(tile for meld in state["table"] for tile in meld)
    for pid, hand in zip(state["turn_order"], hands):
        state["players"][pid]["hand"] = list(hand)
        state["players"][pid]["opened"] = opened
        used.extend(hand)
    assert len(used) == len(set(used))
    state["pool"] = [tile for tile in TILES if tile not in used]
    return state


def act(state, kind, pid="p0", **fields):
    return RummikubGame.apply_action(state, pid, {"type": kind, "turn": state["turn"], **fields})[1]


def tile(color, number, duplicate=0):
    return f"{color}_{number}_{duplicate}"


class RummikubTests(unittest.TestCase):
    def test_registry_deal_and_determinism(self):
        self.assertEqual(get_game("rummikub").module, RummikubGame)
        for count in (2, 3, 4):
            state = new_game(count)
            self.assertEqual(state, new_game(count))
            self.assertEqual(len(state["pool"]), 106 - 14 * count)
            self.assertTrue(all(len(player["hand"]) == 14 for player in state["players"].values()))
            self.assertEqual(RummikubGame.deserialize(state), state)

    def test_configuration_and_players(self):
        for config in ({"rounds": 0}, {"rounds": 9}, {"rounds": True}, {"opening": 10},
                       {"joker_rule": "unknown"}, {"joker_rule": True}):
            with self.assertRaises(ValueError):
                RummikubGame.init_game(config, players())
        for count in (1, 5):
            with self.assertRaises(ValueError):
                new_game(count)
        with self.assertRaises(ValueError):
            RummikubGame.init_game({}, [players()[0], players()[0]])

    def test_melds_and_joker_values(self):
        self.assertTrue(meld_options([tile(color, 7) for color in COLORS]))
        self.assertFalse(meld_options([tile("red", 7), tile("red", 7, 1), tile("blue", 7)]))
        self.assertTrue(meld_options([tile("blue", number) for number in range(1, 14)]))
        self.assertFalse(meld_options([tile("red", number) for number in (12, 13, 1)]))
        self.assertFalse(meld_options([tile("red", number) for number in (1, 2, 4)]))
        self.assertFalse(meld_options([tile("red", 1)] * 3))
        self.assertFalse(meld_options(["unknown", "joker_0", "joker_1"]))
        options = meld_options([tile("blue", 12), tile("blue", 13), "joker_0"])
        self.assertEqual([option["points"] for option in options], [36])
        self.assertTrue(meld_options([tile("red", 1), "joker_0", "joker_1"]))

    def test_opening_threshold_multiple_melds_and_atomic_rejection(self):
        low = [tile(color, 9) for color in COLORS[:3]]
        high = [tile(color, 1) for color in COLORS[:3]]
        state = fixture([low + high + [tile("black", 13)], [tile("black", 1)]])
        before = copy.deepcopy(state)
        self.assertIn("30", act(state, "commit", table=[low]))
        self.assertEqual(state, before)
        self.assertIsNone(act(state, "commit", table=[low, high]))
        self.assertTrue(state["players"]["p0"]["opened"])
        self.assertEqual(state["players"]["p0"]["hand"], [tile("black", 13)])
        self.assertEqual(state["turn_index"], 1)

    def test_initial_cannot_borrow_or_extend_table(self):
        old = [tile("red", number) for number in (8, 9, 10)]
        extra = [tile("red", 11)]
        state = fixture([extra, [tile("black", 1)]], [old])
        before = copy.deepcopy(state)
        self.assertIsNotNone(act(state, "preview", table=[old + extra]))
        self.assertIsNotNone(act(state, "commit", table=[old + extra]))
        self.assertEqual(state, before)

    def test_opening_with_joker(self):
        hand = [tile("red", 12), tile("red", 13), "joker_0"]
        state = fixture([hand, [tile("black", 1)]])
        self.assertIsNone(act(state, "commit", table=[hand]))
        self.assertTrue(state["game_over"])

    def test_split_table_and_move_duplicates(self):
        old = [tile("blue", number) for number in range(1, 7)]
        addition = tile("blue", 7)
        state = fixture([[addition, tile("red", 13)], [tile("black", 1)]], [old], opened=True)
        self.assertIsNone(act(state, "commit", table=[old[:3], old[3:] + [addition]]))
        self.assertEqual(len(state["table"]), 2)

    def test_reject_stolen_duplicate_removed_and_table_only(self):
        old = [tile("blue", number) for number in (1, 2, 3)]
        own = tile("blue", 4)
        other = tile("blue", 5)
        state = fixture([[own], [other]], [old], opened=True)
        for table in ([old + [other]], [old + [own, own]], [[old[0], old[1], own]], [old]):
            before = copy.deepcopy(state)
            self.assertIsNotNone(act(state, "commit", table=table))
            self.assertEqual(before, state)

    def test_preview_visibility_reset_and_draw_rollback(self):
        state = new_game()
        own = state["players"]["p0"]["hand"][0]
        self.assertIsNone(act(state, "preview", table=[[own]]))
        self.assertEqual(RummikubGame.get_public_view(state, "p1")["draft"], [[own]])
        self.assertEqual(state["table"], [])
        self.assertIsNone(act(state, "reset"))
        self.assertIsNone(state["draft"])
        self.assertIsNone(act(state, "preview", table=[[own]]))
        self.assertIsNone(act(state, "draw"))
        self.assertIsNone(state["draft"])
        self.assertEqual(len(state["players"]["p0"]["hand"]), 15)
        self.assertEqual(state["table"], [])

    def test_wrong_actor_malformed_stale_are_atomic(self):
        state = new_game()
        before = copy.deepcopy(state)
        for pid, action in [("p1", {"type": "draw", "turn": 1}), ("visitor", {"type": "draw", "turn": 1}),
                            ("p0", {"type": "draw", "turn": 0}), ("p0", {"type": "commit", "turn": 1}),
                            ("p0", {"type": "preview", "turn": 1, "table": [["fake"]]}),
                            ("p0", {"type": "draw", "turn": 1, "extra": 2}), ("p0", [])]:
            self.assertIsNotNone(RummikubGame.apply_action(state, pid, action)[1])
            self.assertEqual(before, state)
        self.assertIsNone(act(state, "draw"))
        before = copy.deepcopy(state)
        self.assertIsNotNone(RummikubGame.apply_action(state, "p1", {"type": "draw", "turn": 1})[1])
        self.assertEqual(before, state)

    def test_joker_replacement_requires_two_rack_tiles(self):
        old = [tile("red", 4), "joker_0", tile("red", 6)]
        replacement = tile("red", 5)
        fresh = [tile("blue", 10), tile("blue", 11)]
        state = fixture([[replacement] + fresh, [tile("black", 1)]], [old], opened=True)
        self.assertIsNone(act(state, "commit", table=[[old[0], replacement, old[2]], fresh + ["joker_0"]]))
        state = fixture([[replacement, tile("blue", 4)], [tile("black", 1)]], [old], opened=True)
        before = copy.deepcopy(state)
        self.assertIsNotNone(act(state, "commit", table=[[old[0], replacement, old[2]], ["joker_0", tile("blue", 4)]]))
        self.assertEqual(before, state)

    def test_joker_cannot_be_taken_from_four_tile_group(self):
        old = [tile(color, 7) for color in COLORS[:3]] + ["joker_0"]
        fresh = [tile("blue", 11), tile("blue", 12)]
        state = fixture([fresh, [tile("black", 1)]], [old], opened=True)
        self.assertIsNotNone(act(state, "commit", table=[old[:3], fresh + ["joker_0"]]))

    def test_joker_rule_defaults_and_legacy_saves_stay_classic(self):
        state = new_game()
        self.assertEqual(state["config"]["joker_rule"], "classic")
        del state["config"]["joker_rule"]
        restored = RummikubGame.deserialize(json.loads(json.dumps(state)))
        self.assertEqual(RummikubGame.get_public_view(restored, "p0")["joker_rule"], "classic")

    def test_free_joker_rule_is_public_and_persists(self):
        state = new_game(joker_rule="free")
        restored = RummikubGame.deserialize(json.loads(json.dumps(RummikubGame.serialize(state))))
        self.assertEqual(restored, state)
        for viewer in ("p0", "p1", "visitor"):
            self.assertEqual(RummikubGame.get_public_view(restored, viewer)["joker_rule"], "free")

    def test_free_joker_can_leave_group_without_replacement(self):
        old = [tile(color, 7) for color in COLORS[:3]] + ["joker_0"]
        fresh = [tile("blue", 11), tile("blue", 12)]
        state = fixture([fresh, [tile("black", 1)]], [old], opened=True, joker_rule="free")
        self.assertIsNone(act(state, "commit", table=[old[:3], fresh + ["joker_0"]]))

    def test_free_joker_needs_no_two_rack_tiles_and_may_change_value(self):
        old = [tile("red", 4), "joker_0", tile("red", 6)]
        extra = tile("red", 7)
        state = fixture([[extra], [tile("black", 1)]], [old], opened=True, joker_rule="free")
        self.assertIsNone(act(state, "commit", table=[[old[0], old[2], extra, "joker_0"]]))
        old = [tile(color, 7) for color in COLORS[:3]] + ["joker_0"]
        run = [tile("blue", number) for number in (9, 10, 11)]
        state = fixture([[tile("blue", 8)], [tile("black", 1)]], [old, run], opened=True, joker_rule="free")
        self.assertIsNone(act(state, "commit", table=[old[:3], run + [tile("blue", 8), "joker_0"]]))

    def test_free_jokers_still_require_opening_and_valid_complete_table(self):
        old = [tile(color, 7) for color in COLORS[:3]] + ["joker_0"]
        fresh = [tile("blue", 11), tile("blue", 12)]
        for opened, layout in ((False, [old[:3], fresh + ["joker_0"]]),
                               (True, [old[:3], fresh]),
                               (True, [old, [fresh[0], "joker_0"]]),
                               (True, [old])):
            state = fixture([fresh, [tile("black", 1)]], [old], opened=opened, joker_rule="free")
            before = copy.deepcopy(state)
            self.assertIsNotNone(act(state, "commit", table=layout))
            self.assertEqual(state, before)

    def test_joker_meld_can_extend_without_retrieval(self):
        old = [tile("blue", 1), "joker_0", tile("blue", 3)]
        state = fixture([[tile("blue", 4)], [tile("black", 1)]], [old], opened=True)
        self.assertIsNone(act(state, "commit", table=[old + [tile("blue", 4)]]))

    def test_privacy_and_detached_views(self):
        state = new_game()
        for viewer in ("p0", "p1", "visitor"):
            view = RummikubGame.get_public_view(state, viewer)
            self.assertFalse({"pool", "round_seeds", "player_meta", "config"} & view.keys())
            for player in view["players"]:
                self.assertEqual(player["hand"] is not None, player["player_id"] == viewer)
            if viewer == "visitor":
                self.assertEqual(view["legal_actions"], [])
        view = RummikubGame.get_public_view(state, "p0")
        view["players"][0]["hand"].clear()
        self.assertEqual(len(state["players"]["p0"]["hand"]), 14)

    def test_score_round_review_and_all_player_ready(self):
        hand = [tile(color, 10) for color in COLORS[:3]]
        state = fixture([hand, ["joker_0", tile("black", 4)]], rounds=2)
        self.assertIsNone(act(state, "commit", table=[hand]))
        self.assertEqual(state["phase"], "round_review")
        self.assertEqual(state["round_result"]["changes"], {"p0": 34, "p1": -34})
        self.assertEqual(RummikubGame.get_public_view(state, "p0")["players"][1]["hand"], ["joker_0", tile("black", 4)])
        self.assertIsNone(act(state, "next_round"))
        self.assertEqual(state["round"], 1)
        self.assertIsNotNone(act(state, "next_round"))
        self.assertIsNone(act(state, "next_round", "p1"))
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["turn_index"], 1)
        self.assertEqual(state["phase"], "play")
        self.assertEqual(state["players"]["p0"]["score"], 34)
        self.assertEqual(RummikubGame.deserialize(json.loads(json.dumps(state))), state)

    def test_empty_pool_blocks_only_after_full_pass_cycle(self):
        state = new_game()
        state["players"]["p1"]["hand"].extend(state["pool"])
        state["pool"] = []
        self.assertIsNone(act(state, "draw"))
        self.assertFalse(state["game_over"])
        self.assertIsNone(act(state, "draw", "p1"))
        self.assertTrue(state["game_over"])
        self.assertTrue(state["round_result"]["blocked"])
        self.assertEqual(sum(state["round_result"]["changes"].values()), 0)
        self.assertEqual(RummikubGame.get_legal_actions(state, "p0"), [])

    def test_persistence_with_incomplete_draft_and_bad_saves(self):
        state = new_game()
        self.assertIsNone(act(state, "preview", table=[[state["players"]["p0"]["hand"][0]]]))
        saved = RummikubGame.serialize(state)
        self.assertEqual(RummikubGame.deserialize(json.loads(json.dumps(saved))), state)
        saved["pool"].pop()
        with self.assertRaises(ValueError):
            RummikubGame.deserialize(saved)
        for field, value in (("version", 99), ("turn_index", 9), ("phase", "bad"), ("ready", ["visitor"])):
            saved = copy.deepcopy(state)
            saved[field] = value
            with self.assertRaises(ValueError):
                RummikubGame.deserialize(saved)

    def test_bot_uses_opening_search_and_extends_table(self):
        hand = [tile(color, 10) for color in COLORS[:3]] + [tile("black", 13)]
        state = fixture([hand, [tile("black", 1)]])
        action = RummikubGame.bot_move(state, "p0")
        self.assertEqual(action["type"], "commit")
        self.assertIsNone(RummikubGame.apply_action(state, "p0", action)[1])
        old = [tile("red", number) for number in (1, 2, 3)]
        state = fixture([[tile("red", 4)], [tile("black", 1)]], [old], opened=True)
        self.assertEqual(RummikubGame.bot_move(state, "p0")["type"], "commit")

    def test_bots_are_hidden_information_invariant(self):
        state = new_game()
        changed = copy.deepcopy(state)
        changed["pool"].reverse()
        changed["players"]["p1"]["hand"].reverse()
        self.assertEqual(RummikubGame.bot_move(state, "p0"), RummikubGame.bot_move(changed, "p0"))

    def test_full_bot_games_conserve_tiles_and_terminate(self):
        for joker_rule in ("classic", "free"):
            for count in (2, 3, 4):
                with self.subTest(joker_rule=joker_rule, players=count):
                    state = RummikubGame.init_game({"seed": count, "rounds": 2, "joker_rule": joker_rule}, players(count))
                    for _ in range(650):
                        if state["game_over"]:
                            break
                        actor = next(pid for pid in state["turn_order"] if RummikubGame.get_legal_actions(state, pid))
                        action = RummikubGame.bot_move(state, actor)
                        self.assertIsNotNone(action)
                        self.assertIsNone(RummikubGame.apply_action(state, actor, action)[1], action)
                        all_tiles = state["pool"] + [tile for meld in state["table"] for tile in meld]
                        all_tiles += [tile for player in state["players"].values() for tile in player["hand"]]
                        self.assertEqual(Counter(all_tiles), Counter(TILES.keys()))
                        self.assertEqual(RummikubGame.deserialize(json.loads(json.dumps(state))), state)
                    self.assertTrue(state["game_over"])
                    self.assertEqual(sum(player["score"] for player in state["players"].values()), 0)


if __name__ == "__main__":
    unittest.main()
