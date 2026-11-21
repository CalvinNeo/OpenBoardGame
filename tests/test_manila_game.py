import copy
import itertools
import unittest

from jsonschema import Draft7Validator

from game.definitions import MANILA_ACTION_SCHEMA
from game.manila import ManilaGame as Game


def make_setup_state():
    state = Game.init_game({}, [
        {"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat}
        for seat in range(3)
    ])
    state.update(phase="harbormaster_position", current_player="p0", harbormaster="p0")
    state["cargo_slots"] = ["nutmeg", "silk", "ginseng"]
    return state


class ManilaStartingPositionTests(unittest.TestCase):
    def test_accepts_every_legal_starting_position_combination(self):
        combinations = 0
        for positions in itertools.product(range(6), repeat=3):
            if sum(positions) != 9:
                continue
            with self.subTest(positions=positions):
                state = make_setup_state()
                action = {"type": "set_positions", "positions": list(positions)}
                self.assertTrue(Draft7Validator(MANILA_ACTION_SCHEMA).is_valid(action))
                _, error = Game.apply_action(state, "p0", action)
                self.assertIsNone(error)
                self.assertEqual(state["phase"], "placement")
                self.assertEqual([state["boats"][cargo]["position"] for cargo in state["cargo_slots"]], list(positions))
                combinations += 1
        self.assertEqual(combinations, 25)

    def test_rejects_out_of_range_starts_even_when_sum_is_nine(self):
        for positions in ([9, 0, 0], [6, 3, 0], [-1, 5, 5], [13, -4, 0]):
            with self.subTest(positions=positions):
                state = make_setup_state()
                original = copy.deepcopy(state)
                action = {"type": "set_positions", "positions": positions}
                self.assertFalse(Draft7Validator(MANILA_ACTION_SCHEMA).is_valid(action))
                _, error = Game.apply_action(state, "p0", action)
                self.assertIsNotNone(error)
                self.assertEqual(state, original)

    def test_rejects_in_range_starts_that_do_not_sum_to_nine(self):
        for positions in ([0, 0, 0], [5, 5, 5], [3, 3, 2]):
            state = make_setup_state()
            original = copy.deepcopy(state)
            _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": positions})
            self.assertEqual(error, "positions must sum to 9")
            self.assertEqual(state, original)

    def test_rejects_non_integer_and_malformed_starts_without_mutation(self):
        for positions in (["0", 4, 5], [0.5, 3.5, 5], [True, 3, 5], [None, 4, 5], [0, 9], None):
            with self.subTest(positions=positions):
                state = make_setup_state()
                original = copy.deepcopy(state)
                _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": positions})
                self.assertIsNotNone(error)
                self.assertEqual(state, original)

    def test_bot_starts_remain_legal_for_concentrated_stock_holdings(self):
        for cargo_id in ("nutmeg", "silk", "ginseng", "jade"):
            state = make_setup_state()
            state["players"]["p0"]["stocks"] = dict.fromkeys(state["price_track"], 0)
            state["players"]["p0"]["stocks"][cargo_id] = 5
            state["price_track"][cargo_id] = 20
            state["phase"] = "harbormaster_cargo"
            _, error = Game.apply_action(state, "p0", Game.bot_move(state, "p0"))
            self.assertIsNone(error)
            action = Game.bot_move(state, "p0")
            self.assertEqual(sum(action["positions"]), 9)
            self.assertTrue(all(0 <= position <= 5 for position in action["positions"]))
            self.assertEqual(action["positions"][state["cargo_slots"].index(cargo_id)], 5)
            _, error = Game.apply_action(state, "p0", action)
            self.assertIsNone(error)

    def test_starting_limit_does_not_restrict_pilot_movement(self):
        state = make_setup_state()
        _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": [0, 4, 5]})
        self.assertIsNone(error)
        state.update(phase="pilot", placement_round=3, pending_pilots=["small"])
        state["board"]["pilots"]["small"] = "p0"
        _, error = Game.apply_action(state, "p0", {
            "type": "pilot_move", "size": "small", "cargo": "ginseng", "delta": 1,
        })
        self.assertIsNone(error)
        self.assertGreater(state["boats"]["ginseng"]["position"], 5)

    def test_deserialization_preserves_existing_voyage_positions(self):
        state = make_setup_state()
        _, error = Game.apply_action(state, "p0", {"type": "set_positions", "positions": [0, 4, 5]})
        self.assertIsNone(error)
        state["boats"]["ginseng"]["position"] = 9
        restored = Game.deserialize(copy.deepcopy(Game.serialize(state)))
        self.assertEqual(restored["boats"]["ginseng"]["position"], 9)


if __name__ == "__main__":
    unittest.main()
