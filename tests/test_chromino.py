import copy
import json
import random
import unittest
from unittest.mock import patch

from jsonschema import validate

from game.chromino import (
    ACTION_SCHEMA, COLORS, DIRECTIONS, ROTATIONS, TILES, WILD,
    ChrominoGame as Game, cell_key, legal_placements, placement_error, tile_cells,
)


def make_state(count=2):
    players = [
        {"player_id": f"p{index}", "name": f"Player {index + 1}", "seat": index, "is_bot": True}
        for index in range(count)
    ]
    with patch("game.chromino.random.randrange", return_value=0), patch(
        "game.chromino.random.choice", return_value="chameleon_0"
    ), patch("game.chromino.random.shuffle"):
        return Game.init_game({}, players)


def position(hands, cells, bag=None):
    state = make_state(len(hands))
    state["board"] = {
        cell_key(cell_x, cell_y): {"color": color, "tile_id": "fixture"}
        for cell_x, cell_y, color in cells
    }
    state["placed_tiles"] = []
    state["bag"] = list(bag or [])
    for index, hand in enumerate(hands):
        state["players"][f"p{index}"]["hand"] = list(hand)
    return state


def red_position(hands, bag=None):
    return position(hands, [(-1, 0, "red"), (0, 0, "red"), (1, 0, "red")], bag)


class ChrominoTests(unittest.TestCase):
    def assert_rejected(self, state, action, player_id="p0"):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, player_id, action)
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_catalog_contains_all_75_reversal_classes_and_five_chameleons(self):
        regular = [colors for colors in TILES.values() if WILD not in colors]
        self.assertEqual(len(TILES), 80)
        self.assertEqual(len(regular), 75)
        canonical = {min(colors, colors[::-1]) for colors in regular}
        expected = {
            min((left, middle, right), (right, middle, left))
            for left in COLORS for middle in COLORS for right in COLORS
        }
        self.assertEqual(canonical, expected)
        self.assertEqual(len(canonical), 75)
        chameleons = [colors for colors in TILES.values() if WILD in colors]
        self.assertEqual(len(chameleons), 5)
        self.assertTrue(all(colors[1] == WILD and colors[0] != colors[2] for colors in chameleons))

    def test_setup_conserves_tiles_for_one_to_eight_players(self):
        for count in range(1, 9):
            with self.subTest(count=count):
                state = make_state(count)
                owned = [tile_id for player in state["players"].values() for tile_id in player["hand"]]
                owned += state["bag"] + [tile["tile_id"] for tile in state["placed_tiles"]]
                self.assertEqual(len(owned), 80)
                self.assertEqual(set(owned), set(TILES))
                self.assertTrue(all(len(player["hand"]) == 8 for player in state["players"].values()))
                self.assertEqual(len(state["bag"]), 79 - count * 8)
                self.assertEqual(state["board"]["0,0"]["color"], WILD)
        for count in (0, 9):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": str(index)} for index in range(count)])

    def test_random_start_rotates_seat_order_without_shuffling_seats(self):
        with patch("game.chromino.random.randrange", return_value=2):
            state = Game.init_game({}, [{"player_id": str(index), "seat": index} for index in range(4)])
        self.assertEqual(state["turn_order"], ["2", "3", "0", "1"])

    def test_rotation_keeps_middle_cell_fixed_and_preserves_color_order(self):
        tile_id = "tile_red_blue_green"
        for rotation, (delta_x, delta_y) in zip(ROTATIONS, DIRECTIONS):
            self.assertEqual(tile_cells(tile_id, -3, 4, rotation), [
                (-3 - delta_x, 4 - delta_y, "red"), (-3, 4, "blue"),
                (-3 + delta_x, 4 + delta_y, "green"),
            ])

    def test_two_edges_can_touch_the_same_existing_tile(self):
        state = red_position([["tile_red_red_red", "tile_blue_blue_blue"], ["tile_green_green_green"]])
        self.assertIsNone(placement_error(state, "tile_red_red_red", -1, 1, 0))
        events, error = Game.apply_action(state, "p0", {
            "type": "place", "tile_id": "tile_red_red_red", "x": -1, "y": 1, "rotation": 0,
        })
        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "chromino:place")
        self.assertEqual(len(state["board"]), 6)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["ply"], 1)

    def test_rejects_single_diagonal_overlap_and_extra_mismatched_contact(self):
        state = red_position([["tile_red_red_red"], ["tile_blue_blue_blue"]])
        for center_x, center_y in ((2, 1), (3, 1), (0, 0), (0, 2)):
            self.assertIsNotNone(placement_error(state, "tile_red_red_red", center_x, center_y, 0))
        state["board"]["0,2"] = {"color": "blue", "tile_id": "other"}
        self.assertIn("Every", placement_error(state, "tile_red_red_red", 0, 1, 0))

    def test_chameleon_matches_different_colors_on_each_edge(self):
        state = position([["chameleon_0", "tile_blue_blue_blue"]], [
            (-1, -1, "red"), (0, -1, "blue"), (0, 1, "purple"), (1, 1, "yellow"),
        ])
        self.assertIsNone(placement_error(state, "chameleon_0", 0, 0, 0))
        state["board"]["1,1"]["color"] = "green"
        self.assertIsNotNone(placement_error(state, "chameleon_0", 0, 0, 0))

    def test_existing_chameleon_matches_any_color(self):
        state = position([["tile_blue_blue_blue"]], [(-1, 0, WILD), (0, 0, "blue")])
        self.assertIsNone(placement_error(state, "tile_blue_blue_blue", 0, 1, 0))

    def test_enumeration_is_complete_and_every_candidate_valid(self):
        state = make_state()
        moves = legal_placements(state, "p0")
        encoded = {(move["tile_id"], move["x"], move["y"], move["rotation"]) for move in moves}
        brute = set()
        for tile_id in state["players"]["p0"]["hand"]:
            for rotation in ROTATIONS:
                if rotation >= 180 and TILES[tile_id] == TILES[tile_id][::-1]:
                    continue
                for center_x in range(-4, 5):
                    for center_y in range(-3, 4):
                        if placement_error(state, tile_id, center_x, center_y, rotation) is None:
                            brute.add((tile_id, center_x, center_y, rotation))
        self.assertEqual(encoded, brute)
        self.assertEqual(legal_placements(state, "p1"), [])
        for move in moves:
            validate(move, ACTION_SCHEMA)

    def test_no_voluntary_draw_or_pass_while_a_placement_exists(self):
        state = red_position([["tile_red_red_red"], ["tile_blue_blue_blue"]], ["tile_green_green_green"])
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["place"])
        self.assert_rejected(state, {"type": "draw"})
        self.assert_rejected(state, {"type": "pass"})
        self.assert_rejected(state, {"type": "keep"})

    def test_unplayable_draw_is_kept_and_turn_advances_without_leaking_it(self):
        state = red_position([["tile_blue_blue_blue"], ["tile_green_green_green"]], ["tile_purple_purple_purple"])
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["draw"])
        events, error = Game.apply_action(state, "p0", {"type": "draw"})
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(len(state["players"]["p0"]["hand"]), 2)
        self.assertEqual([event["type"] for event in events], ["chromino:draw", "chromino:keep"])
        self.assertNotIn("tile_purple_purple_purple", json.dumps(events))
        self.assertNotIn("tile_purple_purple_purple", json.dumps(Game.get_public_view(state, "p1")))

    def test_drawn_tile_can_be_placed_or_kept_but_not_replaced_with_an_old_tile(self):
        state = red_position([["tile_blue_blue_blue"], ["tile_green_green_green"]], ["tile_red_red_red"])
        Game.apply_action(state, "p0", {"type": "draw"})
        self.assertEqual(state["phase"], "drawn")
        self.assertEqual(state["current_turn"], "p0")
        self.assertEqual(state["ply"], 0)
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["place", "keep"])
        self.assertTrue(all(move["tile_id"] == "tile_red_red_red" for move in legal_placements(state, "p0")))
        self.assert_rejected(state, {"type": "draw"})
        self.assert_rejected(state, {"type": "pass"})
        self.assert_rejected(state, {"type": "place", "tile_id": "tile_blue_blue_blue", "x": 0, "y": 1, "rotation": 0})
        kept = copy.deepcopy(state)
        self.assertIsNone(Game.apply_action(kept, "p0", {"type": "keep"})[1])
        self.assertEqual(len(kept["players"]["p0"]["hand"]), 2)
        self.assertEqual(kept["current_turn"], "p1")
        self.assertIsNone(Game.apply_action(state, "p0", legal_placements(state, "p0")[0])[1])
        self.assertEqual(state["players"]["p0"]["hand"], ["tile_blue_blue_blue"])
        self.assertEqual(state["phase"], "playing")

    def test_last_chameleon_cannot_win_and_must_draw_or_pass(self):
        state = position([["chameleon_0"]], [(-1, 0, "red"), (1, 0, "yellow")], ["tile_blue_blue_blue"])
        self.assertIsNone(placement_error(state, "chameleon_0", 0, 1, 0))
        self.assertEqual(legal_placements(state, "p0"), [])
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["draw"])
        self.assert_rejected(state, {"type": "place", "tile_id": "chameleon_0", "x": 0, "y": 1, "rotation": 0})
        state["bag"] = []
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["pass"])

    def test_keeping_a_playable_last_draw_does_not_trigger_a_false_stalemate(self):
        state = red_position([["tile_blue_blue_blue"]], ["tile_red_red_red"])
        Game.apply_action(state, "p0", {"type": "draw"})
        Game.apply_action(state, "p0", {"type": "keep"})
        self.assertFalse(state["game_over"])
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["place"])
        self.assertEqual(state["empty_turns"], 0)

    def test_only_last_tile_revealed_and_spectators_have_no_private_data(self):
        state = make_state(3)
        state["players"]["p1"]["hand"] = ["tile_red_red_red"]
        own = Game.get_public_view(state, "p0")
        other = Game.get_public_view(state, "p1")
        visitor = Game.get_public_view(state, "visitor")
        self.assertEqual(len(own["hand"]), 8)
        self.assertEqual(other["legal_placements"], [])
        self.assertEqual(visitor["hand"], [])
        self.assertEqual(visitor["legal_actions"], [])
        self.assertEqual(visitor["legal_placements"], [])
        self.assertNotIn("bag", visitor)
        self.assertEqual(visitor["players"][1]["last_tile"]["tile_id"], "tile_red_red_red")
        self.assertTrue(all(player["revealed_hand"] == [] for player in visitor["players"]))
        own["placed_tiles"][0]["colors"][0] = "changed"
        self.assertNotEqual(Game.get_public_view(state, "p0")["placed_tiles"][0]["colors"][0], "changed")

    def test_final_round_finishes_at_last_seat_and_can_have_joint_winners(self):
        state = red_position([
            ["tile_red_red_red"], ["tile_red_red_yellow"], ["tile_blue_blue_blue"],
        ])
        for player_id in ("p0", "p1"):
            move = next(move for move in legal_placements(state, player_id) if move["x"] == -1 and move["y"] == 1 and move["rotation"] == 0) if player_id == "p0" else legal_placements(state, player_id)[0]
            self.assertIsNone(Game.apply_action(state, player_id, move)[1])
            self.assertFalse(state["game_over"])
        self.assertEqual(state["winner"], ["p0", "p1"])
        self.assertEqual(Game.get_legal_actions(state, "p2"), ["pass"])
        Game.apply_action(state, "p2", {"type": "pass"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["result_reason"], "empty_hand")
        self.assertEqual(state["winner"], ["p0", "p1"])
        self.assertEqual([player["turns"] for player in state["players"].values()], [1, 1, 1])

    def test_finish_on_last_seat_does_not_give_earlier_seats_an_extra_turn(self):
        state = red_position([["tile_blue_blue_blue"], ["tile_red_red_red"]])
        Game.apply_action(state, "p0", {"type": "pass"})
        Game.apply_action(state, "p1", legal_placements(state, "p1")[0])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])
        self.assertEqual(state["ply"], 2)

    def test_stalemate_uses_fewest_remaining_and_solo_reports_incomplete(self):
        state = red_position([["tile_blue_blue_blue"], ["tile_green_green_green", "tile_purple_purple_purple"]])
        for player_id in ("p0", "p1"):
            self.assertIsNone(Game.apply_action(state, player_id, {"type": "pass"})[1])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["result_reason"], "blocked")
        self.assertEqual(state["winner"], ["p0"])
        self.assertEqual(len(Game.get_public_view(state, "p0")["players"][1]["revealed_hand"]), 2)
        solo = red_position([["tile_blue_blue_blue"]])
        Game.apply_action(solo, "p0", {"type": "pass"})
        self.assertEqual(solo["winner"], [])

    def test_strict_validation_rejects_malformed_actions_without_mutating(self):
        state = red_position([["tile_red_red_red"], ["tile_blue_blue_blue"]])
        valid = {"type": "place", "tile_id": "tile_red_red_red", "x": 0, "y": 1, "rotation": 0}
        for action in (None, [], {}, {"type": []}, {"type": "invalid"}, {"type": "draw", "extra": True}):
            self.assert_rejected(state, action)
        for field, values in {
            "tile_id": [None, [], {}, "missing", "tile_blue_blue_blue"],
            "x": [True, 0.0, "0", None], "y": [False, 1.0],
            "rotation": [False, 0.0, 45, -90, 360],
        }.items():
            for value in values:
                self.assert_rejected(state, {**valid, field: value})
        self.assert_rejected(state, valid, "p1")
        self.assert_rejected(state, valid, "visitor")
        self.assert_rejected(state, {**valid, "extra": 1})

    def test_json_roundtrip_during_draw_preserves_legality_and_independence(self):
        state = red_position([["tile_blue_blue_blue"], ["tile_green_green_green"]], ["tile_red_red_red"])
        Game.apply_action(state, "p0", {"type": "draw"})
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(restored, state)
        self.assertEqual(legal_placements(restored, "p0"), legal_placements(state, "p0"))
        Game.apply_action(restored, "p0", {"type": "keep"})
        self.assertEqual(state["phase"], "drawn")

    def test_bot_completes_seeded_games_and_preserves_all_tiles(self):
        random_state = random.getstate()
        try:
            for count, seed in ((1, 182), (2, 183), (4, 184), (8, 185)):
                random.seed(seed)
                state = Game.init_game({}, [{"player_id": f"p{index}", "seat": index} for index in range(count)])
                for step in range(500):
                    if state["game_over"]:
                        break
                    player_id = state["current_turn"]
                    before = copy.deepcopy(state)
                    action = Game.bot_move(state, player_id)
                    self.assertIsNotNone(action)
                    self.assertEqual(state, before)
                    self.assertIsNone(Game.apply_action(state, player_id, action)[1])
                    owned = [tile_id for player in state["players"].values() for tile_id in player["hand"]]
                    owned += state["bag"] + [tile["tile_id"] for tile in state["placed_tiles"]]
                    self.assertEqual(len(owned), 80)
                    self.assertEqual(set(owned), set(TILES))
                self.assertTrue(state["game_over"], f"{count} players did not finish in {step} steps")
                self.assertIsNone(Game.bot_move(state, "p0"))
        finally:
            random.setstate(random_state)


if __name__ == "__main__":
    unittest.main()
