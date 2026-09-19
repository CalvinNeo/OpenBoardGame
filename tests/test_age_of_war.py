import copy
import unittest

from jsonschema import Draft7Validator

from game.age_of_war import AgeOfWarGame, CASTLE_ORDER
from game.definitions import AGE_OF_WAR_ACTION_SCHEMA


class AgeOfWarDiceSelectionTests(unittest.TestCase):
    def make_state(self, dice, requirements=None):
        state = AgeOfWarGame.init_game({}, [{"player_id": "a"}, {"player_id": "b"}])
        state.update(
            {
                "phase": "assign",
                "target": {"type": "central", "castle_id": CASTLE_ORDER[0]},
                "target_lines": [
                    {"requirements": requirements or [{"type": "infantry", "sum": 3}], "bonus": False},
                    {"requirements": [{"type": "infantry", "sum": 99}], "bonus": False},
                ],
                "dice_pool": list(dice),
                "dice_remaining": len(dice),
            }
        )
        return state

    def assert_selection_rejected(self, state, selection):
        before = copy.deepcopy(state)
        events, error = AgeOfWarGame.apply_action(
            state, "a", {"type": "fill_line", "line_index": 0, "die_indices": selection}
        )
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_action_schema_accepts_explicit_dice_and_automatic_fallback(self):
        validator = Draft7Validator(AGE_OF_WAR_ACTION_SCHEMA)
        actions = [
            ({"type": "fill_line", "line_index": 0, "die_indices": [2]}, [2]),
            ({"type": "fill_line", "line_index": 0, "die_indices": [0, 1]}, [0, 1]),
            ({"type": "fill_line", "line_index": 0}, [2]),
        ]
        for action, expected_indices in actions:
            with self.subTest(action=action):
                self.assertEqual(list(validator.iter_errors(action)), [])
                state = self.make_state(["I1", "I2", "I3", "A"])

                events, error = AgeOfWarGame.apply_action(state, "a", action)

                self.assertIsNone(error)
                self.assertEqual(events[0]["payload"]["dice_used"], expected_indices)

    def test_action_schema_rejects_invalid_dice_selection_shapes(self):
        validator = Draft7Validator(AGE_OF_WAR_ACTION_SCHEMA)
        invalid_selections = [
            None,
            "2",
            2,
            {"index": 2},
            (2,),
            [],
            [True],
            [1.5],
            ["2"],
            [[2]],
            [2, 2],
            [-1],
            [7],
            list(range(8)),
        ]
        for selection in invalid_selections:
            with self.subTest(selection=selection):
                action = {"type": "fill_line", "line_index": 0, "die_indices": selection}
                self.assertFalse(validator.is_valid(action))

    def test_player_can_choose_single_three_sword_die(self):
        state = self.make_state(["I1", "I2", "I3", "A"])

        events, error = AgeOfWarGame.apply_action(
            state, "a", {"type": "fill_line", "line_index": 0, "die_indices": [2]}
        )

        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["dice_used"], [2])
        self.assertEqual(state["dice_remaining"], 3)
        self.assertEqual(state["dice_pool"], [])
        self.assertEqual(state["filled_lines"], [0])
        self.assertEqual(state["phase"], "roll")

    def test_player_can_choose_two_sword_dice_instead(self):
        state = self.make_state(["I1", "I2", "I3", "A"])

        events, error = AgeOfWarGame.apply_action(
            state, "a", {"type": "fill_line", "line_index": 0, "die_indices": [1, 0]}
        )

        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["dice_used"], [0, 1])
        self.assertEqual(state["dice_remaining"], 2)
        self.assertEqual(state["filled_lines"], [0])

    def test_infantry_can_exceed_required_swords(self):
        state = self.make_state(["I2", "I3", "A"], [{"type": "infantry", "sum": 4}])

        events, error = AgeOfWarGame.apply_action(
            state, "a", {"type": "fill_line", "line_index": 0, "die_indices": [0, 1]}
        )

        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["dice_used"], [0, 1])
        self.assertEqual(state["dice_remaining"], 1)

    def test_mixed_line_uses_exact_selected_dice(self):
        requirements = [
            {"type": "infantry", "sum": 3},
            {"type": "archery", "count": 1},
            {"type": "cavalry", "count": 1},
        ]
        state = self.make_state(["I1", "I2", "I3", "A", "A", "C", "D"], requirements)

        events, error = AgeOfWarGame.apply_action(
            state, "a", {"type": "fill_line", "line_index": 0, "die_indices": [5, 4, 2]}
        )

        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["dice_used"], [2, 4, 5])
        self.assertEqual(state["dice_remaining"], 4)

    def test_invalid_indices_and_container_types_leave_state_unchanged(self):
        invalid_selections = [
            None,
            "2",
            2,
            {"index": 2},
            (2,),
            [True],
            [False, 1],
            [2.0],
            ["2"],
            [[2]],
            [2, 2],
            [-1],
            [4],
        ]
        for selection in invalid_selections:
            with self.subTest(selection=selection):
                self.assert_selection_rejected(self.make_state(["I1", "I2", "I3", "A"]), selection)

    def test_insufficient_or_unrelated_dice_leave_state_unchanged(self):
        for selection in [[], [0], [1], [3], [2, 3]]:
            with self.subTest(selection=selection):
                self.assert_selection_rejected(self.make_state(["I1", "I2", "I3", "A"]), selection)

    def test_mixed_line_requires_exact_non_infantry_counts(self):
        requirements = [
            {"type": "infantry", "sum": 3},
            {"type": "archery", "count": 1},
            {"type": "cavalry", "count": 1},
        ]
        for selection in [[0, 1], [0, 3], [0, 1, 2, 3], [0, 1, 3, 4]]:
            with self.subTest(selection=selection):
                state = self.make_state(["I3", "A", "A", "C", "D"], requirements)
                self.assert_selection_rejected(state, selection)

    def test_non_infantry_line_rejects_extra_sword_dice(self):
        state = self.make_state(["A", "I3", "C"], [{"type": "archery", "count": 1}])
        self.assert_selection_rejected(state, [0, 1])

    def test_missing_selection_keeps_automatic_minimum_dice_match(self):
        state = self.make_state(["I1", "I2", "I3", "A"])

        events, error = AgeOfWarGame.apply_action(state, "a", {"type": "fill_line", "line_index": 0})

        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["dice_used"], [2])
        self.assertEqual(state["dice_remaining"], 3)

    def test_bot_action_remains_compatible_with_automatic_selection(self):
        state = self.make_state(["I1", "I2", "I3", "A"])
        action = AgeOfWarGame.bot_move(state, "a")

        self.assertEqual(action, {"type": "fill_line", "line_index": 0})
        events, error = AgeOfWarGame.apply_action(state, "a", action)

        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["dice_used"], [2])

    def test_public_view_suggests_minimum_dice_and_no_unfillable_selection(self):
        state = self.make_state(["I1", "I2", "I3", "A"])
        before = copy.deepcopy(state)

        lines = AgeOfWarGame.get_public_view(state, "a")["target_lines"]

        self.assertTrue(lines[0]["can_fill"])
        self.assertEqual(lines[0]["suggested_dice"], [2])
        self.assertFalse(lines[1]["can_fill"])
        self.assertEqual(lines[1]["suggested_dice"], [])
        self.assertEqual(state, before)

    def test_public_view_does_not_suggest_dice_for_filled_lines_or_other_phases(self):
        for phase, filled_lines in [("assign", [0]), ("roll", []), ("select_target", [])]:
            with self.subTest(phase=phase, filled_lines=filled_lines):
                state = self.make_state(["I1", "I2", "I3", "A"])
                state["phase"] = phase
                state["filled_lines"] = filled_lines

                line = AgeOfWarGame.get_public_view(state, "a")["target_lines"][0]

                self.assertFalse(line["can_fill"])
                self.assertEqual(line["suggested_dice"], [])


if __name__ == "__main__":
    unittest.main()
