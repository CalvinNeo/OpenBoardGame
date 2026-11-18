"""Rules, scoring and bot coverage for 工厂乐翻天 (Factory Funner)."""
import random
import unittest

from jsonschema import Draft7Validator

from game import get_game
from game.factory_funner import (
    ACTION_SCHEMA,
    BOARD_SIZE,
    CONFIG_SCHEMA,
    DEFAULT_ROUNDS,
    FactoryFunnerGame,
    MACHINES_BY_ID,
    board_money,
    machine_breakdown,
)


def make_players(count=2):
    return [
        {"player_id": f"p{index + 1}", "name": f"P{index + 1}", "seat": index}
        for index in range(count)
    ]


def fresh(config=None, count=2):
    return FactoryFunnerGame.init_game(config, make_players(count))


def resume_placing(state, *player_ids):
    """A solo round flips to review after one action; reopen it for the test."""
    state["phase"] = "placing"
    for player_id in player_ids:
        state["players"][player_id]["acted"] = False


def place(state, player_id, row, col, rotation=0):
    return FactoryFunnerGame.apply_action(
        state, player_id,
        {"type": "place_machine", "row": row, "col": col, "rotation": rotation},
    )


class RegistrationTests(unittest.TestCase):
    def test_registered_definition(self):
        definition = get_game("factory_funner")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.name_zh, "工厂乐翻天")
        self.assertEqual(definition.turn_mode, "simultaneous")
        self.assertEqual((definition.min_players, definition.max_players), (1, 6))

    def test_action_schema_accepts_every_emitted_action(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        self.assertTrue(validator.is_valid({"type": "place_machine", "row": 0, "col": 5, "rotation": 270}))
        self.assertTrue(validator.is_valid({"type": "pass_machine"}))
        self.assertTrue(validator.is_valid({"type": "next_round"}))
        self.assertFalse(validator.is_valid({"type": "place_machine", "row": 0, "col": 0, "rotation": 45}))
        self.assertFalse(validator.is_valid({"type": "place_machine", "row": 0, "col": BOARD_SIZE}))
        self.assertFalse(validator.is_valid({"type": "unknown"}))

    def test_config_schema_bounds_rounds(self):
        validator = Draft7Validator(CONFIG_SCHEMA)
        self.assertTrue(validator.is_valid({}))
        self.assertTrue(validator.is_valid({"rounds": 8}))
        self.assertFalse(validator.is_valid({"rounds": 1}))
        self.assertFalse(validator.is_valid({"rounds": 99}))


class SetupTests(unittest.TestCase):
    def test_default_rounds_and_board(self):
        state = fresh()
        self.assertEqual(state["total_rounds"], DEFAULT_ROUNDS)
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["phase"], "placing")
        for player in state["players"].values():
            self.assertEqual(len(player["board"]), BOARD_SIZE)
            self.assertTrue(all(len(row) == BOARD_SIZE for row in player["board"]))
            self.assertTrue(all(cell is None for row in player["board"] for cell in row))
            self.assertEqual(player["money"], 0)

    def test_rounds_are_clamped(self):
        self.assertEqual(fresh({"rounds": 1})["total_rounds"], 6)
        self.assertEqual(fresh({"rounds": 500})["total_rounds"], 20)

    def test_deck_covers_every_round(self):
        state = fresh({"rounds": 20})
        self.assertEqual(len(state["deck"]), 20)
        self.assertTrue(all(machine_id in MACHINES_BY_ID for machine_id in state["deck"]))

    def test_solo_room_is_supported(self):
        state = fresh(count=1)
        self.assertEqual(len(state["players"]), 1)
        self.assertEqual(FactoryFunnerGame.get_legal_actions(state, "p1"),
                         ["place_machine", "pass_machine"])


class PlacementTests(unittest.TestCase):
    def test_isolated_machine_scores_base_minus_ports(self):
        state = fresh(count=1)
        # m03: base 4, one input and one output, nothing adjacent.
        state["current_machine"] = "m03"
        events, error = place(state, "p1", 2, 2)
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["money"], 4 - 2 - 1)
        self.assertEqual(state["players"]["p1"]["last"]["delta"], 1)
        self.assertEqual(machine_breakdown(state["players"]["p1"]["board"], 2, 2)["matched"], 0)

    def test_link_pays_both_machines_and_is_retroactive(self):
        state = fresh(count=1)
        board = state["players"]["p1"]["board"]
        state["current_machine"] = "m03"      # N input blue, S output blue
        place(state, "p1", 2, 2)
        self.assertEqual(state["players"]["p1"]["money"], 1)

        resume_placing(state, "p1")
        state["current_machine"] = "m28"      # N input blue, W output red
        events, error = place(state, "p1", 3, 2)
        self.assertIsNone(error)
        # The older machine gains its link without being touched again.
        self.assertEqual(machine_breakdown(board, 2, 2)["matched"], 1)
        self.assertEqual(machine_breakdown(board, 2, 2)["score"], 4 + 1 - 2)
        self.assertEqual(machine_breakdown(board, 3, 2)["matched"], 1)
        self.assertEqual(machine_breakdown(board, 3, 2)["score"], 5 + 1 - 1)
        self.assertEqual(state["players"]["p1"]["money"], 8)
        self.assertEqual(state["players"]["p1"]["last"]["delta"], 7)

    def test_mismatched_colours_do_not_link(self):
        state = fresh(count=1)
        board = state["players"]["p1"]["board"]
        state["current_machine"] = "m03"      # S output blue
        place(state, "p1", 2, 2)
        resume_placing(state, "p1")
        state["current_machine"] = "m13"      # E input green
        place(state, "p1", 3, 2, rotation=270)  # rotate so its input faces north
        self.assertEqual(machine_breakdown(board, 2, 2)["matched"], 0)
        self.assertEqual(machine_breakdown(board, 3, 2)["matched"], 0)

    def test_rotation_moves_ports_clockwise(self):
        state = fresh(count=1)
        board = state["players"]["p1"]["board"]
        state["current_machine"] = "m03"
        place(state, "p1", 0, 0, rotation=90)
        # m03 has ports on north (input) and south (output); rotated 90° they
        # become east (input) and west (output).
        info = machine_breakdown(board, 0, 0)
        self.assertEqual(info["unfed"], 1)
        self.assertEqual(info["unused"], 1)

    def test_illegal_placements_are_rejected(self):
        state = fresh(count=1)
        state["current_machine"] = "m03"
        place(state, "p1", 0, 0)
        state["phase"] = "placing"
        state["players"]["p1"]["acted"] = False
        self.assertEqual(place(state, "p1", 0, 0)[1], "cell already holds a machine")
        self.assertEqual(place(state, "p1", -1, 0)[1], "cell is outside the factory")
        self.assertEqual(place(state, "p1", 0, BOARD_SIZE)[1], "cell is outside the factory")
        self.assertEqual(place(state, "p1", 1, 1, rotation=45)[1], "invalid rotation")
        self.assertEqual(place(state, "p1", "a", 1)[1], "invalid cell")

    def test_a_player_may_only_act_once_per_round(self):
        state = fresh(count=1)
        place(state, "p1", 0, 0)
        state["phase"] = "placing"
        self.assertEqual(place(state, "p1", 1, 1)[1], "already acted this round")

    def test_pass_is_always_available_while_placing(self):
        state = fresh(count=1)
        events, error = FactoryFunnerGame.apply_action(state, "p1", {"type": "pass_machine"})
        self.assertIsNone(error)
        self.assertTrue(state["players"]["p1"]["acted"])
        self.assertEqual(state["players"]["p1"]["money"], 0)
        self.assertEqual(state["players"]["p1"]["last"]["action"], "pass")


class RoundFlowTests(unittest.TestCase):
    def test_review_starts_once_everyone_acted(self):
        state = fresh()
        self.assertEqual(state["phase"], "placing")
        place(state, "p1", 0, 0)
        self.assertEqual(state["phase"], "placing")
        FactoryFunnerGame.apply_action(state, "p2", {"type": "pass_machine"})
        self.assertEqual(state["phase"], "review")
        self.assertEqual(len(state["round_summary"]), 2)
        self.assertEqual(FactoryFunnerGame.get_legal_actions(state, "p1"), ["next_round"])
        self.assertEqual(FactoryFunnerGame.get_legal_actions(state, "p2"), ["next_round"])

    def test_next_round_requires_everyone(self):
        state = fresh()
        place(state, "p1", 0, 0)
        FactoryFunnerGame.apply_action(state, "p2", {"type": "pass_machine"})
        FactoryFunnerGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertEqual(state["phase"], "review")
        self.assertEqual(state["round"], 1)
        self.assertEqual(FactoryFunnerGame.get_legal_actions(state, "p1"), [])
        FactoryFunnerGame.apply_action(state, "p2", {"type": "next_round"})
        self.assertEqual(state["phase"], "placing")
        self.assertEqual(state["round"], 2)
        self.assertFalse(state["players"]["p1"]["acted"])
        self.assertEqual(state["round_summary"], [])

    def test_next_round_is_rejected_while_placing(self):
        state = fresh()
        self.assertEqual(
            FactoryFunnerGame.apply_action(state, "p1", {"type": "next_round"})[1],
            "round is not finished",
        )

    def test_game_ends_after_the_final_round(self):
        state = fresh({"rounds": 6}, count=2)
        guard = 0
        while not state["game_over"] and guard < 200:
            guard += 1
            if state["phase"] == "placing":
                for pid in ("p1", "p2"):
                    if not state["players"][pid]["acted"]:
                        place(state, pid, guard % BOARD_SIZE, (guard // BOARD_SIZE) % BOARD_SIZE)
            else:
                for pid in ("p1", "p2"):
                    if not state["players"][pid]["ready"]:
                        FactoryFunnerGame.apply_action(state, pid, {"type": "next_round"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["round"], 6)
        self.assertEqual(set(state["scores"]), {"p1", "p2"})
        self.assertTrue(state["winner"])
        self.assertEqual(FactoryFunnerGame.get_legal_actions(state, "p1"), [])

    def test_winner_is_the_richest_player(self):
        state = fresh({"rounds": 6}, count=2)
        state["players"]["p1"]["money"] = 40
        state["players"]["p2"]["money"] = 12
        state["round"] = 6
        state["phase"] = "review"
        state["players"]["p1"]["ready"] = True
        FactoryFunnerGame.apply_action(state, "p2", {"type": "next_round"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])


class PublicViewTests(unittest.TestCase):
    def test_view_exposes_everything_players_need(self):
        state = fresh()
        view = FactoryFunnerGame.get_public_view(state, "p1")
        self.assertEqual(view["game_id"], "factory_funner")
        self.assertEqual(view["you"], "p1")
        self.assertEqual(view["board_size"], BOARD_SIZE)
        self.assertEqual(view["current_machine"], state["current_machine"])
        self.assertIn(state["current_machine"], view["machines"])
        self.assertEqual(view["scoring"], {"match_bonus": 1, "unfed_input_cost": 2, "unused_output_cost": 1})
        self.assertEqual(len(view["players"]), 2)
        self.assertEqual(view["legal_actions"], ["place_machine", "pass_machine"])

    def test_boards_are_public(self):
        state = fresh()
        place(state, "p1", 1, 1)
        view = FactoryFunnerGame.get_public_view(state, "p2")
        opponent = next(player for player in view["players"] if player["player_id"] == "p1")
        self.assertIsNotNone(opponent["board"][1][1])
        self.assertEqual(opponent["board"][1][1]["machine_id"], state["current_machine"])

    def test_serialize_round_trip_keeps_scoring(self):
        state = fresh()
        state["current_machine"] = "m03"
        place(state, "p1", 2, 2)
        restored = FactoryFunnerGame.deserialize(FactoryFunnerGame.serialize(state))
        self.assertEqual(restored["players"]["p1"]["money"], state["players"]["p1"]["money"])
        self.assertEqual(board_money(restored["players"]["p1"]["board"]),
                         board_money(state["players"]["p1"]["board"]))


class BotTests(unittest.TestCase):
    def test_bot_returns_legal_actions(self):
        random.seed(5)
        state = fresh(count=1)
        state["players"]["p1"]["is_bot"] = True
        action = FactoryFunnerGame.bot_move(state, "p1")
        self.assertEqual(action["type"], "place_machine")
        payload = {key: value for key, value in action.items() if key != "delay_ms"}
        self.assertIsNone(FactoryFunnerGame.apply_action(state, "p1", payload)[1])

    def test_bot_finishes_a_full_solo_game(self):
        random.seed(11)
        state = FactoryFunnerGame.init_game({"rounds": 8}, make_players(1))
        steps = 0
        while not state["game_over"] and steps < 400:
            steps += 1
            action = FactoryFunnerGame.bot_move(state, "p1")
            self.assertIsNotNone(action, f"bot stalled in phase {state['phase']}")
            payload = {key: value for key, value in action.items() if key != "delay_ms"}
            self.assertIsNone(FactoryFunnerGame.apply_action(state, "p1", payload)[1])
        self.assertTrue(state["game_over"])
        self.assertGreater(state["players"]["p1"]["money"], 0)

    def test_bot_links_machines_instead_of_scattering(self):
        random.seed(2)
        state = FactoryFunnerGame.init_game({"rounds": 8}, make_players(1))
        state["current_machine"] = "m03"
        place(state, "p1", 2, 2)
        state["phase"] = "placing"
        state["players"]["p1"]["acted"] = False
        state["current_machine"] = "m28"
        action = FactoryFunnerGame.bot_move(state, "p1")
        payload = {key: value for key, value in action.items() if key != "delay_ms"}
        FactoryFunnerGame.apply_action(state, "p1", payload)
        self.assertEqual(machine_breakdown(state["players"]["p1"]["board"], 2, 2)["matched"], 1)

    def test_bot_passes_when_the_board_is_full(self):
        state = fresh(count=1)
        board = state["players"]["p1"]["board"]
        for row in range(BOARD_SIZE):
            for col in range(BOARD_SIZE):
                board[row][col] = {"machine_id": "m01", "rotation": 0, "round": 1}
        state["players"]["p1"]["money"] = board_money(board)
        self.assertEqual(FactoryFunnerGame.get_legal_actions(state, "p1"), ["pass_machine"])
        self.assertEqual(FactoryFunnerGame.bot_move(state, "p1")["type"], "pass_machine")


if __name__ == "__main__":
    unittest.main()
