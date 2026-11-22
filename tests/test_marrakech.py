import copy
import json
import unittest
from unittest.mock import patch

from game import get_game
from game.marrakech import DIE_FACES, MarrakechGame, advance_assam, calculate_scores, connected_area, legal_placements


def fresh(count=2, seed=17):
    return MarrakechGame.init_game({"seed": seed}, [
        {"player_id": f"p{index}", "name": f"Merchant {index}", "seat": index}
        for index in range(count)
    ])


def rug(owner="p1", color="teal", rug_id=99):
    return {"owner": owner, "color": color, "rug_id": rug_id}


class MarrakechTests(unittest.TestCase):
    def apply(self, state, action, player=None):
        events, error = MarrakechGame.apply_action(state, player or state["current_turn"], action)
        self.assertIsNone(error)
        self.assertTrue(events)

    def reject(self, state, action, player=None):
        before = copy.deepcopy(state)
        events, error = MarrakechGame.apply_action(state, player or state["current_turn"], action)
        self.assertTrue(error)
        self.assertFalse(events)
        self.assertEqual(state, before)

    def test_registration_and_setup(self):
        self.assertIs(get_game("marrakech").module, MarrakechGame)
        for count, supply in ((2, 24), (3, 15), (4, 12)):
            state = fresh(count)
            self.assertEqual(state, fresh(count))
            self.assertEqual(sum(player["coins"] for player in state["players"].values()), count * 30)
            self.assertTrue(all(len(player["rugs"]) == supply for player in state["players"].values()))
            colors = [color for player in state["players"].values() for color in player["colors"]]
            self.assertEqual(len(set(colors)), 4 if count == 2 else count)
        for player in fresh()["players"].values():
            self.assertEqual([player["rugs"].count(color) for color in player["colors"]], [12, 12])
        for count in (0, 1, 5):
            with self.assertRaises(ValueError):
                fresh(count)
        for config in ({"seed": True}, {"seed": []}, {"steps": 4}):
            with self.assertRaises(ValueError):
                MarrakechGame.init_game(config, [{"player_id": "p0"}, {"player_id": "p1"}])

    def test_direction_lock_and_invalid_action_atomicity(self):
        state = fresh()
        for action in (None, {}, {"type": "roll"}, {"type": "orient", "direction": True},
                       {"type": "orient", "direction": 2}, {"type": "orient", "direction": -1},
                       {"type": "orient", "direction": "0"}, {"type": "orient", "direction": 4},
                       {"type": "orient", "direction": 1, "roll": 4}):
            self.reject(state, action)
        self.reject(state, {"type": "orient", "direction": 1}, "p1")
        self.apply(state, {"type": "orient", "direction": 1})
        self.assertEqual(state["assam"]["direction"], 1)
        self.assertEqual(state["phase"], "roll")
        self.reject(state, {"type": "orient", "direction": 0})
        self.reject(state, {"type": "roll", "steps": 4})
        self.apply(state, {"type": "roll"})
        self.assertIn(state["last_roll"], DIE_FACES)
        self.assertEqual(state["phase"], "place")

    def test_edge_routes(self):
        for first in (0, 2, 4):
            for source, target in ((first, first + 1), (first + 1, first)):
                cases = (
                    ({"x": source, "y": 0, "direction": 0}, {"x": target, "y": 0, "direction": 2}),
                    ({"x": 0, "y": source, "direction": 3}, {"x": 0, "y": target, "direction": 1}),
                    ({"x": source + 1, "y": 6, "direction": 2}, {"x": target + 1, "y": 6, "direction": 0}),
                    ({"x": 6, "y": source + 1, "direction": 1}, {"x": 6, "y": target + 1, "direction": 3}),
                )
                for start, expected in cases:
                    self.assertEqual(advance_assam(start, 1)[0], expected)
        for start, expected in (
            ({"x": 6, "y": 0, "direction": 0}, {"x": 6, "y": 0, "direction": 3}),
            ({"x": 6, "y": 0, "direction": 1}, {"x": 6, "y": 0, "direction": 2}),
            ({"x": 0, "y": 6, "direction": 2}, {"x": 0, "y": 6, "direction": 1}),
            ({"x": 0, "y": 6, "direction": 3}, {"x": 0, "y": 6, "direction": 0}),
        ):
            self.assertEqual(advance_assam(start, 1)[0], expected)
        destination, path = advance_assam({"x": 0, "y": 0, "direction": 0}, 3)
        self.assertEqual(destination, {"x": 1, "y": 2, "direction": 2})
        self.assertEqual(len(path), 3)

    def test_movement_bounds_and_no_mutation(self):
        for column in range(7):
            for row in range(7):
                for direction in range(4):
                    original = {"x": column, "y": row, "direction": direction}
                    destination, path = advance_assam(original, 4)
                    self.assertEqual(original, {"x": column, "y": row, "direction": direction})
                    self.assertEqual(destination, path[-1])
                    self.assertTrue(all(0 <= point["x"] < 7 and 0 <= point["y"] < 7 for point in path))

    def test_placement_constraints_and_identity(self):
        state = fresh()
        state["phase"] = "place"
        for cells in (None, [], [[3, 3], [3, 2]], [[0, 0], [1, 0]], [[3, 2], [4, 1]],
                      [[True, 2], [2, 2]], [[-1, 3], [0, 3]], [[3, 2], [3, 2]]):
            self.reject(state, {"type": "place", "cells": cells})
        state["board"][2][3] = rug()
        state["board"][2][4] = rug()
        self.reject(state, {"type": "place", "cells": [[3, 2], [4, 2]]})
        state["board"][2][4] = rug(rug_id=100)
        self.assertIn([[3, 2], [4, 2]], legal_placements(state))
        color = state["players"]["p0"]["rugs"][0]
        self.apply(state, {"type": "place", "cells": [[4, 2], [3, 2]]})
        self.assertEqual(state["board"][2][3], state["board"][2][4])
        self.assertEqual(state["board"][2][3]["color"], color)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["turn_number"], 2)
        self.assertEqual(len(state["players"]["p0"]["rugs"]), 23)

    def test_connectivity_is_by_color_not_owner_or_diagonal(self):
        state = fresh()
        for column, row in ((3, 2), (4, 2), (4, 1)):
            state["board"][row][column] = rug(rug_id=column + row)
        state["board"][1][2] = rug()
        state["board"][2][2] = rug(color="violet")
        self.assertEqual(len(connected_area(state, 3, 2)), 3)
        self.assertEqual(connected_area(state, 0, 0), [])

    def test_landing_payment_bankruptcy_and_exact_zero(self):
        for coins, expected_out in ((3, False), (2, True)):
            state = fresh(3)
            state["phase"] = "roll"
            state["players"]["p0"]["coins"] = coins
            for column in (2, 3, 4):
                state["board"][2][column] = rug(color="gold")
            with patch("game.marrakech.random.Random") as generator:
                generator.return_value.choice.return_value = 1
                self.apply(state, {"type": "roll"})
            self.assertEqual(state["players"]["p0"]["coins"], 0)
            self.assertEqual(state["players"]["p1"]["coins"], 30 + min(coins, 3))
            self.assertEqual(state["players"]["p0"]["eliminated"], expected_out)
            self.assertEqual(state["phase"], "orient" if expected_out else "place")

    def test_no_fee_for_own_or_eliminated_rugs_or_passed_squares(self):
        for owner, eliminated in (("p0", False), ("p1", True)):
            state = fresh(3)
            state["phase"] = "roll"
            state["players"][owner]["eliminated"] = eliminated
            state["board"][2][3] = rug(owner=owner)
            with patch("game.marrakech.random.Random") as generator:
                generator.return_value.choice.return_value = 1
                self.apply(state, {"type": "roll"})
            self.assertEqual(state["players"]["p0"]["coins"], 30)
        state = fresh()
        state["phase"] = "roll"
        state["board"][2][3] = rug()
        with patch("game.marrakech.random.Random") as generator:
            generator.return_value.choice.return_value = 2
            self.apply(state, {"type": "roll"})
        self.assertEqual(state["players"]["p0"]["coins"], 30)

    def test_last_survivor_wins(self):
        state = fresh()
        state["phase"] = "roll"
        state["players"]["p0"]["coins"] = 0
        state["board"][2][3] = rug()
        with patch("game.marrakech.random.Random") as generator:
            generator.return_value.choice.return_value = 1
            self.apply(state, {"type": "roll"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])

    def test_final_scoring_coin_tiebreak_and_shared_win(self):
        for opponent_coins, winner in ((30, ["p0"]), (31, ["p1"]), (29, ["p0"])):
            state = fresh()
            state["phase"] = "place"
            state["players"]["p0"]["rugs"] = ["coral"]
            state["players"]["p1"]["rugs"] = []
            state["players"]["p1"]["coins"] = opponent_coins
            state["board"][0][0] = rug()
            self.apply(state, {"type": "place", "cells": [[3, 2], [4, 2]]})
            self.assertTrue(state["game_over"])
            self.assertEqual(state["winner"], winner)
            self.assertEqual(calculate_scores(state)["p0"]["visible"], 2)
        state = fresh()
        state["phase"] = "place"
        state["players"]["p0"]["rugs"] = ["coral"]
        state["players"]["p1"]["rugs"] = []
        state["board"][0][0] = rug()
        state["board"][0][1] = rug()
        self.apply(state, {"type": "place", "cells": [[3, 2], [4, 2]]})
        self.assertEqual(state["winner"], ["p0", "p1"])
        self.assertEqual(MarrakechGame.get_legal_actions(state, "p0"), [])

    def test_private_stack_and_seed_and_detached_view(self):
        state = fresh()
        view = MarrakechGame.get_public_view(state, "observer")
        self.assertEqual(view["legal_actions"], [])
        self.assertEqual(view["legal_placements"], [])
        self.assertNotIn("seed", view)
        self.assertTrue(all("rugs" not in player for player in view["players"]))
        self.assertEqual(view["next_color"], state["players"]["p0"]["rugs"][0])
        view["board"][0][0] = rug()
        view["players"][0]["colors"].clear()
        self.assertIsNone(state["board"][0][0])
        self.assertEqual(len(state["players"]["p0"]["colors"]), 2)

    def test_full_bot_games_save_load_and_no_ai_mutation(self):
        for count in (2, 3, 4):
            state = fresh(count)
            for action_number in range(500):
                if state["game_over"]:
                    break
                if action_number % 11 == 0:
                    state = MarrakechGame.deserialize(json.loads(json.dumps(MarrakechGame.serialize(state))))
                before = copy.deepcopy(state)
                action = MarrakechGame.bot_move(state, state["current_turn"])
                self.assertEqual(state, before)
                self.assertIsNotNone(action)
                self.apply(state, action)
                self.assertEqual(sum(player["coins"] for player in state["players"].values()), count * 30)
            self.assertTrue(state["game_over"])
            self.assertTrue(state["winner"])
            self.assertIsNone(MarrakechGame.bot_move(state, "p0"))

    def test_ai_avoids_certain_fee(self):
        state = fresh()
        for row in range(3):
            state["board"][row][3] = rug()
        action = MarrakechGame.bot_move(state, "p0")
        self.assertNotEqual(action["direction"], 0)


if __name__ == "__main__":
    unittest.main()
