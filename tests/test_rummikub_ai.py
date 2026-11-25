import copy
import itertools
import random
import unittest

from game.rummikub import (
    RummikubGame, TILES, _greedy_layout, _layout_value, _meld_patterns,
    _search_layout, _tile_kind, meld_options, validate_table,
)
from tests.test_rummikub import fixture, new_game, tile


class RummikubAiTests(unittest.TestCase):
    def assert_plays(self, state, expected):
        before = copy.deepcopy(state)
        action = RummikubGame.bot_move(state, "p0")
        self.assertEqual(state, before)
        self.assertEqual(action["type"], "commit", action)
        self.assertIsNone(validate_table(state, "p0", action["table"]))
        played = set(sum(action["table"], [])) & set(state["players"]["p0"]["hand"])
        self.assertTrue(set(expected) <= played, (expected, action))
        self.assertIsNone(RummikubGame.apply_action(state, "p0", action)[1])
        return action

    def test_splits_long_run_to_play_duplicate(self):
        extra = tile("blue", 4, 1)
        old = [tile("blue", number) for number in range(1, 7)]
        self.assert_plays(fixture([[extra], [tile("black", 1)]], [old], opened=True), [extra])

    def test_borrows_four_tile_group_to_form_run(self):
        hand = [tile("blue", 8), tile("blue", 9)]
        old = [tile(color, 7) for color in ("red", "blue", "orange", "black")]
        self.assert_plays(fixture([hand, [tile("black", 1)]], [old], opened=True), hand)

    def test_search_avoids_greedy_extension_that_breaks_rack_meld(self):
        hand = [tile(color, 4) for color in ("red", "blue", "orange")]
        old = [tile("red", number) for number in (1, 2, 3)]
        self.assert_plays(fixture([hand, [tile("black", 1)]], [old], opened=True), hand)

    def test_retrieves_and_immediately_reuses_joker(self):
        hand = [tile("red", 5), tile("blue", 10), tile("blue", 11)]
        old = [tile("red", 4), "joker_0", tile("red", 6)]
        self.assert_plays(fixture([hand, [tile("black", 1)]], [old], opened=True), hand)

    def test_keeps_joker_meld_intact_while_rearranging_other_groups(self):
        locked = [tile("red", 1), "joker_0", tile("red", 3)]
        run = [tile("blue", number) for number in range(1, 7)]
        extra = tile("blue", 4, 1)
        state = fixture([[extra], [tile("black", 1)]], [locked, run], opened=True)
        action = self.assert_plays(state, [extra])
        self.assertIn(set(locked), [set(meld) for meld in action["table"]])

    def test_extends_joker_run_from_both_ends(self):
        hand = [tile("red", 2), tile("red", 6)]
        old = [tile("red", 3), "joker_0", tile("red", 5)]
        self.assert_plays(fixture([hand, [tile("black", 1)]], [old], opened=True), hand)

    def test_table_joker_cannot_be_reused_without_replacement(self):
        old = [tile(color, 7) for color in ("red", "blue", "orange")] + ["joker_0"]
        state = fixture([[tile("blue", 11), tile("blue", 12)], [tile("black", 1)]], [old], opened=True)
        self.assertEqual(RummikubGame.bot_move(state, "p0")["type"], "draw")

    def test_free_rule_ai_reuses_table_joker_without_replacement(self):
        old = [tile(color, 7) for color in ("red", "blue", "orange")] + ["joker_0"]
        hand = [tile("blue", 11), tile("blue", 12)]
        state = fixture([hand, [tile("black", 1)]], [old], opened=True, joker_rule="free")
        self.assert_plays(state, hand)

    def test_free_rule_ai_still_cannot_borrow_before_opening(self):
        old = [tile(color, 7) for color in ("red", "blue", "orange")] + ["joker_0"]
        hand = [tile("blue", 11), tile("blue", 12)]
        state = fixture([hand, [tile("black", 1)]], [old], joker_rule="free")
        self.assertEqual(RummikubGame.bot_move(state, "p0")["type"], "draw")

    def test_opening_does_not_use_public_tiles(self):
        old = [tile(color, 7) for color in ("red", "blue", "orange", "black")]
        state = fixture([[tile("blue", 8), tile("blue", 9)], [tile("black", 1)]], [old])
        self.assertEqual(RummikubGame.bot_move(state, "p0")["type"], "draw")

    def test_duplicate_patterns_include_every_physical_allocation(self):
        hand = [tile("red", number, duplicate) for number in (9, 10, 11) for duplicate in (0, 1)]
        self.assert_plays(fixture([hand, [tile("black", 1)]], opened=True), hand)

    def test_patterns_include_optional_joker_instead_of_available_natural(self):
        hand = [tile("blue", number) for number in (4, 5, 6)] + ["joker_0"]
        expected = {_tile_kind(tile("blue", 4)), 52, _tile_kind(tile("blue", 6))}
        self.assertTrue(any(set(kinds) == expected for kinds, _ in _meld_patterns(hand)))

    def test_all_patterns_are_legal_and_use_highest_joker_value(self):
        by_kind = {_tile_kind(value): value for value in TILES}
        for kinds, points in _meld_patterns(list(TILES)):
            options = meld_options([by_kind[kind] for kind in kinds])
            self.assertTrue(options, kinds)
            self.assertEqual(points, max(option["points"] for option in options), kinds)

    def test_can_open_with_two_jokers(self):
        hand = [tile("red", 13), "joker_0", "joker_1"]
        self.assert_plays(fixture([hand, [tile("black", 1)]]), hand)

    def test_can_extend_two_table_joker_melds(self):
        old = [[tile("red", 3), "joker_0", tile("red", 5)],
               [tile("blue", 8), "joker_1", tile("blue", 10)]]
        hand = [tile("red", 2), tile("blue", 11)]
        self.assert_plays(fixture([hand, [tile("black", 1)]], old, opened=True), hand)

    def test_rack_evaluation_retains_useful_pairs_on_equal_tile_count(self):
        hand = [tile("red", number) for number in (3, 4, 7)] + [tile("blue", 7), tile("black", 13)]
        retain_pair = [[tile("red", 7), tile("blue", 7), tile("black", 13)]]
        break_pair = [[tile("red", 3), tile("blue", 7), tile("black", 13)]]
        self.assertGreater(_layout_value(hand, retain_pair, False), _layout_value(hand, break_pair, False))

    def test_search_budget_exhaustion_preserves_legal_fallback(self):
        hand = [tile(color, 10) for color in ("red", "blue", "orange")]
        state = fixture([hand, [tile("black", 1)]])
        layouts = []
        _search_layout(state, "p0", [], hand, [], layouts.append, limit=0)
        self.assertEqual(layouts, [])
        self.assert_plays(state, hand)

    def test_hidden_tiles_are_not_read_and_action_is_deterministic(self):
        state = new_game(4, seed=9)
        original = copy.deepcopy(state)
        action = RummikubGame.bot_move(state, "p0")
        state["pool"] = ["private"] * len(state["pool"])
        for pid in ("p1", "p2", "p3"):
            state["players"][pid]["hand"] = ["private"] * len(state["players"][pid]["hand"])
        self.assertEqual(RummikubGame.bot_move(state, "p0"), action)
        self.assertEqual(RummikubGame.bot_move(original, "p0"), action)

    def test_search_matches_exhaustive_small_rack_optimum(self):
        rng = random.Random(21)
        universe = [tile(color, number) for color in ("red", "blue", "orange") for number in (8, 9, 10, 11)]
        for _ in range(12):
            hand = rng.sample(universe, 8)
            candidates = []
            for count in range(3, 9):
                for meld in itertools.combinations(hand, count):
                    if meld_options(list(meld)):
                        candidates.append(set(meld))
            possible = {frozenset()}
            for meld in candidates:
                possible.update(used | frozenset(meld) for used in list(possible) if not used & meld)
            expected = max(map(len, possible))
            state = fixture([hand, [tile("black", 1)]], opened=True)
            action = RummikubGame.bot_move(state, "p0")
            actual = len(set(sum(action["table"], [])) & set(hand)) if action["type"] == "commit" else 0
            self.assertEqual(actual, expected, hand)

    def test_search_never_plays_fewer_tiles_than_old_policy_on_same_state(self):
        for count in (2, 3, 4):
            state = new_game(count, seed=count + 40)
            for _ in range(150):
                if state["game_over"]:
                    break
                actor = state["turn_order"][state["turn_index"]]
                hand = set(state["players"][actor]["hand"])
                old = _greedy_layout(state, actor)
                expected = len(set(sum(old, [])) & hand) if validate_table(state, actor, old) is None else 0
                action = RummikubGame.bot_move(state, actor)
                actual = len(set(sum(action.get("table", []), [])) & hand)
                self.assertGreaterEqual(actual, expected)
                self.assertIsNone(RummikubGame.apply_action(state, actor, action)[1])
            self.assertTrue(state["game_over"])


if __name__ == "__main__":
    unittest.main()
