import unittest

from game.turing_machine import TuringMachineGame, _matching_codes_for_conditions


def _players(count: int):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": False,
        }
        for index in range(count)
    ]


class TuringMachineGameTests(unittest.TestCase):
    def test_preset_scenarios_are_unique(self):
        cases = [
            {"preset_id": "calibration-easy-01", "expected_cards": 4},
            {"preset_id": "relay-standard-01", "expected_cards": 5},
            {"preset_id": "circuit-hard-01", "expected_cards": 6},
            {"preset_id": "omega-expert-01", "expected_cards": 6},
        ]
        for case in cases:
            with self.subTest(case=case["preset_id"]):
                state = TuringMachineGame.init_game(
                    {
                        "mode": "simple",
                        "scenario_source": "preset",
                        "preset_id": case["preset_id"],
                    },
                    _players(1),
                )
                conditions = [
                    (card["criterion_id"], card["active_variant"])
                    for card in state["scenario"]["cards"]
                ]
                candidates = _matching_codes_for_conditions(conditions)
                self.assertEqual(len(state["scenario"]["cards"]), case["expected_cards"])
                self.assertEqual(candidates, [tuple(state["scenario"]["solution"])])

    def test_random_seed_is_repeatable(self):
        config = {
            "mode": "simple",
            "scenario_source": "random",
            "difficulty": "hard",
            "seed": "repeatable-seed",
        }
        state_a = TuringMachineGame.init_game(config, _players(1))
        state_b = TuringMachineGame.init_game(config, _players(1))
        self.assertEqual(state_a["scenario"], state_b["scenario"])

    def test_round_advances_after_all_active_players_end(self):
        state = TuringMachineGame.init_game(
            {
                "mode": "simple",
                "scenario_source": "preset",
                "preset_id": "calibration-easy-01",
            },
            _players(2),
        )
        slot = state["scenario"]["cards"][0]["slot"]

        events, error = TuringMachineGame.apply_action(state, "p1", {"type": "set_proposal", "code": [1, 1, 1]})
        self.assertIsNone(error)
        self.assertEqual(events, [])
        _, error = TuringMachineGame.apply_action(state, "p1", {"type": "test_criterion", "slot": slot})
        self.assertIsNone(error)
        _, error = TuringMachineGame.apply_action(state, "p1", {"type": "end_round"})
        self.assertIsNone(error)
        self.assertEqual(state["round"], 1)

        _, error = TuringMachineGame.apply_action(state, "p2", {"type": "end_round"})
        self.assertIsNone(error)
        self.assertEqual(state["round"], 2)
        self.assertIsNone(state["players"]["p1"]["current_round"]["proposal"])
        self.assertFalse(state["players"]["p1"]["current_round"]["ended"])

    def test_wrong_guess_eliminates_and_correct_guess_wins(self):
        state = TuringMachineGame.init_game(
            {
                "mode": "simple",
                "scenario_source": "preset",
                "preset_id": "relay-standard-01",
            },
            _players(2),
        )
        solution = list(state["scenario"]["solution"])
        wrong = [solution[0], solution[1], solution[2]]
        wrong[2] = 1 if wrong[2] != 1 else 2

        _, error = TuringMachineGame.apply_action(state, "p1", {"type": "submit_guess", "code": solution})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["status"], "solved")
        self.assertFalse(state["game_over"])

        _, error = TuringMachineGame.apply_action(state, "p2", {"type": "submit_guess", "code": wrong})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p2"]["status"], "eliminated")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winners"], ["p1"])

    def test_simple_mode_shows_deduction_and_expert_hides_it(self):
        simple_state = TuringMachineGame.init_game(
            {
                "mode": "simple",
                "scenario_source": "preset",
                "preset_id": "relay-standard-02",
            },
            _players(1),
        )
        expert_state = TuringMachineGame.init_game(
            {
                "mode": "expert",
                "scenario_source": "preset",
                "preset_id": "relay-standard-02",
            },
            _players(1),
        )

        simple_view = TuringMachineGame.get_public_view(simple_state, "p1")
        expert_view = TuringMachineGame.get_public_view(expert_state, "p1")

        self.assertIsNotNone(simple_view["deduction"])
        self.assertEqual(simple_view["deduction"]["candidate_count"], 125)
        self.assertIsNone(expert_view["deduction"])

    def test_bot_gives_up_when_it_can_no_longer_tie_best_solver(self):
        state = TuringMachineGame.init_game(
            {
                "mode": "simple",
                "scenario_source": "preset",
                "preset_id": "relay-standard-01",
            },
            _players(2),
        )
        state["players"]["p1"]["status"] = "solved"
        state["players"]["p1"]["question_count"] = 8
        state["players"]["p1"]["solved_at_round"] = 3
        state["players"]["p1"]["solved_at_question_count"] = 8
        state["players"]["p2"]["question_count"] = 9

        action = TuringMachineGame.bot_move(state, "p2")
        self.assertIsNotNone(action)
        self.assertEqual(action["type"], "give_up")


if __name__ == "__main__":
    unittest.main()
