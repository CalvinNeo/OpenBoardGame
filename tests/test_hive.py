import copy
import json
import random
import unittest

from jsonschema import Draft7Validator

from game.hive import (
    ACTION_SCHEMA, CONFIG_SCHEMA, HiveGame as Game, PIECE_COUNTS,
    board_from_state, can_slide, cell_key, is_connected, legal_moves,
    movement_targets, neighbors, placement_targets, position_key, simulate_move,
)
from game.hive_ai import choose_move


def make_state(config=None):
    return Game.init_game(config or {}, [
        {"player_id": "w", "name": "Willow", "seat": 0},
        {"player_id": "b", "name": "Bramble", "seat": 1, "is_bot": True},
    ])


def put(state, owner, kind, cell):
    player = state["players"][owner]
    number = PIECE_COUNTS[kind] - player["reserve"][kind] + 1
    assert number <= PIECE_COUNTS[kind]
    piece_id = f"{player['color']}-{kind}-{number}"
    state["board"].setdefault(cell_key(cell), []).append(piece_id)
    player["reserve"][kind] -= 1
    return piece_id


def tactical_state():
    """White can fill the black Queen's last gap by moving its ant."""
    state = make_state()
    put(state, "b", "queen", (0, 0))
    put(state, "w", "queen", (-1, 1))
    put(state, "b", "ant", (0, 1))
    put(state, "b", "spider", (-1, 0))
    put(state, "w", "spider", (0, -1))
    put(state, "w", "grasshopper", (1, -1))
    put(state, "w", "ant", (-2, 1))
    state["players"]["w"]["turns"] = 4
    state["players"]["b"]["turns"] = 4
    state["ply"] = 8
    return state


class HiveRulesTests(unittest.TestCase):
    def assert_rejected(self, state, player, action):
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, player, action)[1])
        self.assertEqual(state, before)

    def test_setup_and_config_validation(self):
        state = make_state()
        self.assertEqual(state["current_turn"], "w")
        self.assertEqual(len(state["pieces"]), 22)
        self.assertEqual(sum(state["players"]["w"]["reserve"].values()), 11)
        self.assertEqual(len(legal_moves(state)), 5)
        for players in ([], [{"player_id": "w"}], [{"player_id": "w"}, {"player_id": "w"}]):
            with self.assertRaises(ValueError):
                Game.init_game({}, players)
        with self.assertRaises(ValueError):
            make_state({"ai_difficulty": "invalid"})
        with self.assertRaises(ValueError):
            make_state({"tournament_opening": "false"})

    def test_first_placements_and_color_restriction(self):
        state = make_state()
        self.assertIsNone(Game.apply_action(state, "w", {"type": "place", "piece": "ant", "to": [0, 0]})[1])
        self.assertEqual({tuple(a["to"]) for a in legal_moves(state)}, set(neighbors((0, 0))))
        Game.apply_action(state, "b", {"type": "place", "piece": "queen", "to": [1, 0]})
        targets = placement_targets(state, board_from_state(state), "w")
        self.assertEqual(targets, {(-1, 0), (0, -1), (-1, 1)})
        self.assert_rejected(state, "w", {"type": "place", "piece": "queen", "to": [0, 1]})

    def test_queen_deadline_and_no_early_movement(self):
        state = make_state()
        for _ in range(6):
            action = next(a for a in legal_moves(state) if a.get("piece") != "queen")
            self.assertFalse(any(a["type"] == "move" for a in legal_moves(state)))
            self.assertIsNone(Game.apply_action(state, state["current_turn"], action)[1])
        self.assertEqual({a.get("piece") for a in legal_moves(state)}, {"queen"})
        self.assert_rejected(state, "w", {"type": "move", "piece_id": "white-beetle-1", "to": [-1, 0]})
        queen = legal_moves(state)[0]
        self.assertIsNone(Game.apply_action(state, "w", queen)[1])

    def test_tournament_opening_applies_to_both_players(self):
        state = make_state({"tournament_opening": True})
        for _ in range(2):
            self.assertFalse(any(a.get("piece") == "queen" for a in legal_moves(state)))
            Game.apply_action(state, state["current_turn"], legal_moves(state)[0])
        self.assertTrue(any(a.get("piece") == "queen" for a in legal_moves(state)))

    def test_queen_spider_and_ant_around_one_hex(self):
        for kind, expected in (
            ("queen", {(0, 1), (1, -1)}),
            ("spider", {(-1, 0)}),
            ("ant", set(neighbors((0, 0))) - {(1, 0)}),
        ):
            with self.subTest(kind=kind):
                state = make_state()
                put(state, "b", "queen", (0, 0))
                put(state, "w", kind, (1, 0))
                self.assertEqual(movement_targets(state, board_from_state(state), (1, 0)), expected)

    def test_sliding_requires_shared_contact_and_open_gate(self):
        self.assertFalse(can_slide({}, (0, 0), (1, 0)))
        self.assertTrue(can_slide({(0, 1): ["a"]}, (0, 0), (1, 0)))
        self.assertFalse(can_slide({(0, 1): ["a"], (1, -1): ["b"]}, (0, 0), (1, 0)))

    def test_bridge_cannot_move_even_if_landing_rejoins_hive(self):
        state = make_state()
        put(state, "w", "queen", (-1, 0))
        bridge = put(state, "w", "ant", (0, 0))
        put(state, "b", "queen", (1, 0))
        self.assertEqual(movement_targets(state, board_from_state(state), (0, 0)), set())
        self.assert_rejected(state, "w", {"type": "move", "piece_id": bridge, "to": [0, 1]})

    def test_grasshopper_jumps_contiguous_line_and_stops_at_first_gap(self):
        state = make_state()
        put(state, "w", "grasshopper", (-1, 0))
        put(state, "w", "queen", (0, 0))
        put(state, "b", "queen", (1, 0))
        self.assertEqual(movement_targets(state, board_from_state(state), (-1, 0)), {(2, 0)})

    def test_ant_cannot_enter_sealed_cavity_but_placement_can(self):
        state = make_state()
        specs = ["queen", "spider", "spider", "grasshopper", "grasshopper", "grasshopper"]
        for cell, kind in zip(neighbors((0, 0)), specs):
            put(state, "w", kind, cell)
        put(state, "w", "ant", (2, 0))
        board = board_from_state(state)
        self.assertNotIn((0, 0), movement_targets(state, board, (2, 0)))
        self.assertIn((0, 0), placement_targets(state, board, "w"))

    def test_beetle_climbs_covers_and_changes_placement_color(self):
        state = make_state()
        put(state, "w", "queen", (0, 0))
        put(state, "b", "queen", (1, 0))
        beetle = put(state, "w", "beetle", (-1, 0))
        self.assertIsNone(Game.apply_action(state, "w", {"type": "move", "piece_id": beetle, "to": [0, 0]})[1])
        self.assertEqual(len(state["board"]["0,0"]), 2)
        self.assert_rejected(state, "b", {"type": "move", "piece_id": "white-queen-1", "to": [0, 1]})
        state["current_turn"] = "w"
        self.assertFalse(any(a.get("piece_id") == "white-queen-1" for a in legal_moves(state)))
        # Enemy beetle on a white stack makes all neighboring placements black.
        put(state, "b", "beetle", (0, 0))
        self.assertNotIn((-1, 1), placement_targets(state, board_from_state(state), "w"))
        self.assertIn((0, -1), placement_targets(state, board_from_state(state), "b"))

    def test_beetle_cannot_be_placed_on_top(self):
        state = make_state()
        put(state, "w", "queen", (0, 0))
        self.assert_rejected(state, "w", {"type": "place", "piece": "beetle", "to": [0, 0]})

    def test_beetle_height_gate_and_descent(self):
        # Crossing from layer two is blocked by two stacks reaching layer two,
        # but not by a single high flank, nor when climbing to layer three.
        board = {(0, 1): ["a", "b"], (1, -1): ["c", "d"]}
        self.assertFalse(can_slide(board, (0, 0), (1, 0), 2))
        self.assertTrue(can_slide(board, (0, 0), (1, 0), 3))
        board[(1, -1)] = ["c"]
        self.assertTrue(can_slide(board, (0, 0), (1, 0), 2))
        state = make_state()
        put(state, "w", "queen", (0, 0))
        beetle = put(state, "w", "beetle", (0, 0))
        put(state, "b", "queen", (1, 0))
        self.assertIn((-1, 0), movement_targets(state, board_from_state(state), (0, 0)))
        self.assertIsNone(Game.apply_action(state, "w", {"type": "move", "piece_id": beetle, "to": [-1, 0]})[1])
        self.assertEqual(state["board"]["0,0"], ["white-queen-1"])

    def test_winning_move_and_covered_queen(self):
        for covered in (False, True):
            state = tactical_state()
            if covered:
                put(state, "w", "beetle", (0, 0))
            action = {"type": "move", "piece_id": "white-ant-1", "to": [1, 0]}
            self.assertIsNone(Game.apply_action(state, "w", action)[1])
            self.assertTrue(state["game_over"])
            self.assertEqual(state["winner"], ["w"])
            self.assert_rejected(state, "b", {"type": "pass"})

    def test_beetle_gate_uses_both_source_and_destination_height(self):
        state = make_state()
        put(state, "w", "queen", (0, 0))
        put(state, "w", "beetle", (0, 0))
        put(state, "b", "queen", (0, 1))
        put(state, "b", "beetle", (0, 1))
        put(state, "w", "grasshopper", (1, -1))
        put(state, "w", "beetle", (1, -1))
        for cell in ((1, 1), (2, 0), (2, -1)):
            put(state, "b", "ant", cell)
        self.assertNotIn((1, 0), movement_targets(state, board_from_state(state), (0, 0)))
        put(state, "b", "spider", (1, 0))
        self.assertNotIn((1, 0), movement_targets(state, board_from_state(state), (0, 0)))
        put(state, "b", "beetle", (1, 0))
        self.assertIn((1, 0), movement_targets(state, board_from_state(state), (0, 0)))

    def test_both_queens_surrounded_draw(self):
        state = make_state()
        put(state, "w", "queen", (0, 0))
        put(state, "b", "queen", (1, 0))
        cells = {(0, -1), (-1, 0), (-1, 1), (1, -1), (2, -1), (2, 0)}
        for cell, kind in zip(sorted(cells), ["spider", "spider", "grasshopper", "grasshopper", "grasshopper", "ant"]):
            put(state, "w", kind, cell)
        put(state, "w", "beetle", (1, 1))
        put(state, "w", "ant", (2, 1))
        # One ant move fills the common final gap at (0, 1).
        action = {"type": "move", "piece_id": "white-ant-2", "to": [0, 1]}
        self.assertIsNone(Game.apply_action(state, "w", action)[1])
        self.assertEqual(state["result_reason"], "both_queens_surrounded")
        self.assertEqual(state["winner"], [])

    def test_self_surround_loses(self):
        state = tactical_state()
        state["current_turn"] = "b"
        # Black's own ant leaves (0, 1) so it cannot self-surround that way;
        # a new black piece can fill the gap only if top colors permit it.
        put(state, "b", "beetle", (1, -1))
        put(state, "b", "beetle", (0, 1))
        action = {"type": "place", "piece": "ant", "to": [1, 0]}
        self.assertIn(action, legal_moves(state))
        self.assertIsNone(Game.apply_action(state, "b", action)[1])
        self.assertEqual(state["winner"], ["w"])

    def test_pass_only_without_any_action(self):
        state = make_state()
        self.assert_rejected(state, "w", {"type": "pass"})
        # Three unplaced-queen ants are covered by the enemy; White has no
        # friendly top surface and is forced to place its queen or pass.
        for cell in ((0, 0), (1, 0)):
            put(state, "w", "ant", cell)
            put(state, "b", "beetle", cell)
        put(state, "b", "queen", (0, 1))
        state["players"]["w"]["turns"] = 3
        self.assertEqual(legal_moves(state), [{"type": "pass"}])
        self.assertEqual(Game.bot_move(state, "w"), {"type": "pass"})
        self.assertIsNone(Game.apply_action(state, "w", {"type": "pass"})[1])
        self.assertEqual(state["current_turn"], "b")
        self.assertFalse(state["game_over"])

    def test_threefold_and_same_kind_identity(self):
        state = make_state()
        put(state, "w", "queen", (0, 0))
        put(state, "b", "queen", (1, 0))
        put(state, "w", "beetle", (-1, 0))
        put(state, "w", "beetle", (-1, 1))
        other = copy.deepcopy(state)
        other["board"]["-1,0"], other["board"]["-1,1"] = other["board"]["-1,1"], other["board"]["-1,0"]
        self.assertEqual(position_key(state), position_key(other))
        self.assertEqual(position_key(state), position_key(json.loads(json.dumps(state, sort_keys=True))))
        action = next(a for a in legal_moves(state) if a["type"] == "move")
        future = simulate_move(state, action)
        state["position_counts"][position_key(future)] = 2
        self.assertIsNone(Game.apply_action(state, "w", action)[1])
        self.assertEqual(state["result_reason"], "threefold_repetition")

    def test_draw_offer_persists_until_response_and_cannot_spam(self):
        state = make_state()
        Game.apply_action(state, "w", {"type": "offer_draw"})
        self.assertIn("accept_draw", Game.get_legal_actions(state, "b"))
        Game.apply_action(state, "b", {"type": "decline_draw"})
        self.assert_rejected(state, "w", {"type": "offer_draw"})
        Game.apply_action(state, "w", legal_moves(state)[0])
        Game.apply_action(state, "b", {"type": "offer_draw"})
        Game.apply_action(state, "b", legal_moves(state)[0])
        self.assertEqual(state["draw_offer"], "b")
        Game.apply_action(state, "w", {"type": "accept_draw"})
        self.assertEqual(state["result_reason"], "draw_agreed")

    def test_move_declines_opponent_draw(self):
        state = make_state()
        Game.apply_action(state, "w", {"type": "offer_draw"})
        Game.apply_action(state, "w", legal_moves(state)[0])
        Game.apply_action(state, "b", legal_moves(state)[0])
        self.assertIsNone(state["draw_offer"])

    def test_invalid_actions_are_atomic_even_without_schema(self):
        state = make_state()
        for action in (None, [], {}, {"type": []}, {"type": "nope"},
                       {"type": "place", "piece": "queen", "to": [True, 0]},
                       {"type": "place", "piece": "queen", "to": [0.0, 0]},
                       {"type": "place", "piece": "queen", "to": [0]},
                       {"type": "place", "piece": "queen", "to": [0, 0], "extra": 1},
                       {"type": "place", "piece": "beetle", "to": [9999, 9999]}):
            self.assert_rejected(state, "w", action)
        self.assert_rejected(state, "visitor", legal_moves(state)[0])
        self.assert_rejected(state, "b", legal_moves(state)[0])

    def test_public_view_serialization_and_schema(self):
        state = tactical_state()
        snapshot = copy.deepcopy(state)
        public = Game.get_public_view(state, "w")
        public["board"][0]["stack"][0]["owner"] = "changed"
        self.assertEqual(state, snapshot)
        self.assertEqual(Game.get_public_view(state, "visitor")["legal_moves"], [])
        self.assertEqual(Game.get_public_view(state, "b")["legal_moves"], [])
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(legal_moves(restored), legal_moves(state))
        Draft7Validator(CONFIG_SCHEMA).validate(state["config"])
        for action in legal_moves(state):
            Draft7Validator(ACTION_SCHEMA).validate(action)

    def test_random_play_preserves_inventory_and_connectivity(self):
        rng = random.Random(121)
        for _ in range(3):
            state = make_state()
            for _ in range(90):
                if state["game_over"]:
                    break
                action = rng.choice(legal_moves(state))
                self.assertIsNone(Game.apply_action(state, state["current_turn"], action)[1])
                board = board_from_state(state)
                self.assertTrue(is_connected(board))
                ids = [pid for stack in board.values() for pid in stack]
                self.assertEqual(len(ids), len(set(ids)))
                self.assertEqual(len(ids) + sum(sum(p["reserve"].values()) for p in state["players"].values()), 22)
                for stack in board.values():
                    self.assertTrue(all(state["pieces"][pid]["kind"] == "beetle" for pid in stack[1:]))


class HiveAITests(unittest.TestCase):
    def test_takes_immediate_win_for_every_level_without_mutation(self):
        for level in ("easy", "normal", "hard"):
            state = tactical_state()
            state["config"]["ai_difficulty"] = level
            before = copy.deepcopy(state)
            action = Game.bot_move(state, "w")
            self.assertEqual(state, before)
            self.assertIn(action, legal_moves(state))
            self.assertEqual(simulate_move(state, action)["winner"], ["w"])

    def test_defends_against_one_turn_loss(self):
        state = tactical_state()
        state["current_turn"] = "b"
        state["config"]["ai_difficulty"] = "easy"
        action = choose_move(state, "b")
        child = simulate_move(state, action)
        self.assertFalse(child["game_over"] and child["winner"] == ["w"])
        for reply in legal_moves(child):
            self.assertNotEqual(simulate_move(child, reply)["winner"], ["w"])

    def test_bot_waits_and_handles_draw_requests(self):
        state = make_state()
        self.assertIsNone(choose_move(state, "b"))
        self.assertIsNone(choose_move(state, "visitor"))
        Game.apply_action(state, "w", {"type": "offer_draw"})
        self.assertEqual(choose_move(state, "b"), {"type": "accept_draw"})

    def test_deterministic_easy_self_play_and_progress(self):
        state = make_state({"ai_difficulty": "easy"})
        calls = []
        first = Game.bot_move(state, "w", progress_callback=lambda *args: calls.append(args))
        self.assertEqual(first, Game.bot_move(state, "w"))
        self.assertTrue(calls)
        for _ in range(65):
            if state["game_over"]:
                break
            before = copy.deepcopy(state)
            action = Game.bot_move(state, state["current_turn"])
            self.assertEqual(state, before)
            self.assertIn(action, legal_moves(state))
            self.assertIsNone(Game.apply_action(state, state["current_turn"], action)[1])
        self.assertGreater(state["ply"], 10)


if __name__ == "__main__":
    unittest.main()
