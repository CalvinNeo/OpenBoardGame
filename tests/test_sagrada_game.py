"""Classic Sagrada regression tests, using the same actions as human clients."""

import copy
import unittest
from collections import Counter

from game import sagrada
from game.sagrada import SagradaGame
from game.sagrada_reference_data import (
    COLORS,
    OBJECTIVE_CATALOG,
    PATTERN_CATALOG,
    TOOL_CATALOG,
)


class SagradaGameTests(unittest.TestCase):
    @staticmethod
    def players(count=2, bots=False):
        return [
            {
                "player_id": f"p{index + 1}",
                "name": f"Player {index + 1}",
                "seat": index,
                "is_bot": bots,
            }
            for index in range(count)
        ]

    def apply(self, state, player_id, action):
        action = {"revision": state["revision"], **action}
        _, error = SagradaGame.apply_action(state, player_id, action)
        self.assertIsNone(error, f"{player_id}: {action!r}: {error}")
        return SagradaGame.get_public_view(state, player_id)

    def rejected_unchanged(self, state, player_id, action):
        before = copy.deepcopy(SagradaGame.serialize(state))
        if isinstance(action, dict):
            action = {"revision": state["revision"], **action}
        _, error = SagradaGame.apply_action(state, player_id, action)
        self.assertIsNotNone(error, f"Unexpected accepted action: {action!r}")
        self.assertEqual(SagradaGame.serialize(state), before)
        return error

    @staticmethod
    def occupied(grid):
        return [cell["die"] for row in grid for cell in row if cell.get("die")]

    @staticmethod
    def empty_grid():
        return [[{"restriction": None, "die": None} for _ in range(5)] for _ in range(4)]

    @staticmethod
    def die(identifier, color="red", value=1):
        return {"id": identifier, "color": color, "value": value}

    def started(self, count=2, seed=7):
        state = SagradaGame.init_game({"seed": seed}, self.players(count))
        for player in self.players(count):
            pid = player["player_id"]
            view = SagradaGame.get_public_view(state, pid)
            choices = view["patterns"]
            self.assertEqual(len(choices), 4)
            self.apply(state, pid, {"type": "choose_pattern", "pattern_id": choices[0]["id"]})
        return state

    def fixture(self, tool_id, second_turn=False):
        state = self.started()
        pid = state["current_turn"]
        state["players"][pid]["grid"] = self.empty_grid()
        state["players"][pid]["favor_tokens"] = 20
        state["tools"] = [{"id": tool_id, "uses": 0, "tokens": 0}]
        state["pool"] = [
            self.die("fixture-red", "red", 3),
            self.die("fixture-blue", "blue", 5),
            self.die("fixture-green", "green", 2),
            self.die("fixture-yellow", "yellow", 6),
            self.die("fixture-purple", "purple", 1),
        ]
        state["round_track"] = [[self.die("track-red", "red", 4)]]
        if second_turn:
            state["draft_index"] = len(state["turn_order"]) * 2 - 1
            state["current_turn"] = pid
        state["turn_state"] = {"drafted": False, "tool_used": False}
        return state, pid

    def use_tool(self, state, pid, tool_id, **parameters):
        return self.apply(state, pid, {"type": "use_tool", "tool_id": tool_id, **parameters})

    @staticmethod
    def dice_in_state(state):
        dice = list(state["bag"]) + list(state["pool"])
        dice.extend(die for round_dice in state["round_track"] for die in round_dice)
        for player in state["players"].values():
            dice.extend(cell["die"] for row in player["grid"] for cell in row if cell["die"])
        if state.get("pending_tool") and state["pending_tool"].get("die"):
            dice.append(state["pending_tool"]["die"])
        return dice

    def test_setup_rejects_unsupported_player_counts_and_duplicate_ids(self):
        for count in (0, 1, 5):
            with self.subTest(count=count):
                with self.assertRaises(ValueError):
                    SagradaGame.init_game({}, self.players(count))
        players = self.players()
        players[1]["player_id"] = players[0]["player_id"]
        with self.assertRaises(ValueError):
            SagradaGame.init_game({}, players)

    def test_reference_contains_all_classic_cards_and_real_double_sided_pairs(self):
        self.assertEqual(len(PATTERN_CATALOG), 24)
        self.assertEqual(len(TOOL_CATALOG), 12)
        self.assertEqual(len(OBJECTIVE_CATALOG), 10)
        pairs = Counter(pattern["card_id"] for pattern in PATTERN_CATALOG)
        self.assertEqual(sorted(pairs.values()), [2] * 12)
        for pattern in PATTERN_CATALOG:
            self.assertIn(pattern["difficulty"], (3, 4, 5, 6))
            self.assertEqual([len(row) for row in pattern["restrictions"]], [5] * 4)
        names = {pattern["name"]: pattern for pattern in PATTERN_CATALOG}
        self.assertEqual(names["Sun's Glory"]["card_id"], names["Firelight"]["card_id"])
        self.assertEqual(names["Shadow Thief"]["restrictions"][3][3], {"value": 4})

    def test_setup_is_seeded_and_serialization_round_trips(self):
        first = SagradaGame.init_game({"seed": 161}, self.players())
        second = SagradaGame.init_game({"seed": 161}, self.players())
        self.assertEqual(SagradaGame.serialize(first), SagradaGame.serialize(second))
        restored = SagradaGame.deserialize(copy.deepcopy(SagradaGame.serialize(first)))
        for player in self.players():
            pid = player["player_id"]
            self.assertEqual(
                SagradaGame.get_public_view(restored, pid),
                SagradaGame.get_public_view(first, pid),
            )

    def test_private_objectives_are_hidden_from_opponents_and_spectators(self):
        state = SagradaGame.init_game({"seed": 81}, self.players(4))
        dealt = []
        for player in self.players(4):
            pid = player["player_id"]
            view = SagradaGame.get_public_view(state, pid)
            own = next(row for row in view["players"] if row["player_id"] == pid)
            self.assertIn(own["private_color"], COLORS)
            dealt.append(own["private_color"])
            for opponent in view["players"]:
                if opponent["player_id"] != pid:
                    self.assertIsNone(opponent.get("private_color"))
                    self.assertIsNone(opponent.get("private_score"))
        self.assertEqual(len(set(dealt)), 4)
        spectator = SagradaGame.get_public_view(state, "spectator")
        self.assertFalse(spectator["legal_actions"])
        self.assertTrue(all(player.get("private_color") is None for player in spectator["players"]))

    def test_public_view_is_detached_from_authoritative_state(self):
        state = SagradaGame.init_game({"seed": 15}, self.players())
        before = copy.deepcopy(SagradaGame.serialize(state))
        view = SagradaGame.get_public_view(state, "p1")
        view["players"].clear()
        view["objectives"].clear()
        self.assertEqual(SagradaGame.serialize(state), before)

    def test_unknown_actor_and_malformed_actions_leave_state_unchanged(self):
        state = SagradaGame.init_game({"seed": 7}, self.players())
        self.rejected_unchanged(state, "spectator", {"type": "next_round"})
        for action in (None, [], {}, {"type": "not_a_sagrada_action"}):
            with self.subTest(action=action):
                self.rejected_unchanged(state, "p1", action)

    def test_setup_deals_two_physical_cards_and_favors_follow_selected_difficulty(self):
        state = SagradaGame.init_game({"seed": 901}, self.players(4))
        dealt_card_ids = []
        for player in self.players(4):
            pid = player["player_id"]
            view = SagradaGame.get_public_view(state, pid)
            choices = view["patterns"]
            self.assertEqual(len(choices), 4)
            cards = Counter(choice["card_id"] for choice in choices)
            self.assertEqual(sorted(cards.values()), [2, 2])
            dealt_card_ids.extend(cards)
            selected = max(choices, key=lambda choice: choice["difficulty"])
            self.apply(state, pid, {"type": "choose_pattern", "pattern_id": selected["id"]})
            own = next(p for p in SagradaGame.get_public_view(state, pid)["players"] if p["player_id"] == pid)
            self.assertEqual(own["favor_tokens"], selected["difficulty"])
        self.assertEqual(len(set(dealt_card_ids)), 8)
        self.assertEqual(len(state["pool"]), 9)
        self.assertEqual(Counter(d["color"] for d in self.dice_in_state(state)), Counter({c: 18 for c in COLORS}))

    def test_cannot_select_another_players_pattern_or_select_twice(self):
        state = SagradaGame.init_game({"seed": 3}, self.players())
        first = SagradaGame.get_public_view(state, "p1")["patterns"][0]["id"]
        second = SagradaGame.get_public_view(state, "p2")["patterns"][0]["id"]
        self.rejected_unchanged(state, "p1", {"type": "choose_pattern", "pattern_id": second})
        self.apply(state, "p1", {"type": "choose_pattern", "pattern_id": first})
        self.rejected_unchanged(state, "p1", {"type": "choose_pattern", "pattern_id": first})

    def test_all_ten_public_objectives_use_classic_scoring(self):
        grid = self.empty_grid()
        for row in range(4):
            for col in range(5):
                grid[row][col]["die"] = self.die(f"d{row}-{col}", COLORS[(row + col) % 5], (row + col) % 6 + 1)
        expected = {
            "color_rows": 24, "shade_rows": 20,
            "color_columns": 25, "shade_columns": 20,
            "light_shades": 6, "medium_shades": 6, "deep_shades": 6,
            "shade_variety": 15, "color_variety": 16, "color_diagonals": 18,
        }
        for objective in OBJECTIVE_CATALOG:
            with self.subTest(objective=objective["id"]):
                self.assertEqual(sagrada._objective_score(grid, objective), expected[objective["id"]])

    def test_incomplete_rows_and_columns_never_score_variety(self):
        grid = self.empty_grid()
        for col, color in enumerate(COLORS):
            grid[0][col]["die"] = self.die(f"d{col}", color, col + 1)
        objectives = {objective["id"]: objective for objective in OBJECTIVE_CATALOG}
        self.assertEqual(sagrada._objective_score(grid, objectives["color_rows"]), 6)
        grid[0][4]["die"] = None
        self.assertEqual(sagrada._objective_score(grid, objectives["color_rows"]), 0)
        self.assertEqual(sagrada._objective_score(grid, objectives["shade_rows"]), 0)
        self.assertEqual(sagrada._objective_score(grid, objectives["color_columns"]), 0)
        self.assertEqual(sagrada._objective_score(grid, objectives["shade_columns"]), 0)

    def test_color_diagonals_count_each_die_once_and_exclude_orthogonal_only(self):
        grid = self.empty_grid()
        for row, col in ((0, 0), (1, 1), (2, 2), (3, 3), (0, 4)):
            grid[row][col]["die"] = self.die(f"{row}-{col}")
        objective = next(o for o in OBJECTIVE_CATALOG if o["id"] == "color_diagonals")
        self.assertEqual(sagrada._objective_score(grid, objective), 4)
        grid = self.empty_grid()
        grid[0][0]["die"] = self.die("a")
        grid[0][1]["die"] = self.die("b")
        self.assertEqual(sagrada._objective_score(grid, objective), 0)

    def final_scoring_fixture(self):
        state = self.started()
        state.update(round=10, phase="round_end", current_turn=None, ready=[], objectives=[])
        for index, pid in enumerate(state["turn_order"]):
            state["players"][pid].update(
                grid=self.empty_grid(), favor_tokens=0, private_color=COLORS[index]
            )
        return state

    def finish_fixture(self, state):
        for pid in state["turn_order"]:
            self.apply(state, pid, {"type": "next_round"})
        self.assertTrue(state["game_over"])

    def test_final_score_adds_private_shade_values_and_favors_and_deducts_empty_cells(self):
        state = self.final_scoring_fixture()
        pid = state["turn_order"][0]
        player = state["players"][pid]
        color = player["private_color"]
        player["grid"][0][0]["die"] = self.die("one", color, 6)
        player["grid"][1][1]["die"] = self.die("two", color, 2)
        player["grid"][0][1]["die"] = self.die("other", "blue", 1)
        player["favor_tokens"] = 3
        self.finish_fixture(state)
        result = next(p for p in SagradaGame.get_public_view(state, pid)["players"] if p["player_id"] == pid)
        self.assertEqual(result["private_score"], 8)
        self.assertEqual(result["score"], 8 + 3 - 17)

    def test_ties_are_broken_by_private_objective_before_remaining_favors(self):
        state = self.final_scoring_fixture()
        first, second = state["turn_order"]
        state["players"][first]["grid"][0][0]["die"] = self.die("one", state["players"][first]["private_color"], 6)
        state["players"][second]["grid"][0][0]["die"] = self.die("two", state["players"][second]["private_color"], 5)
        state["players"][second]["favor_tokens"] = 1
        self.finish_fixture(state)
        self.assertEqual(state["winner"], [first])

    def test_ties_with_equal_private_scores_use_remaining_favors(self):
        state = self.final_scoring_fixture()
        first, second = state["turn_order"]
        for pid in (first, second):
            state["players"][pid]["grid"][0][0]["die"] = self.die(pid, state["players"][pid]["private_color"], 6)
        state["players"][first]["grid"][1][1]["die"] = self.die("extra", "blue", 1)
        state["players"][second]["favor_tokens"] = 1
        self.finish_fixture(state)
        self.assertEqual(state["winner"], [second])

    def test_remaining_ties_use_reverse_clockwise_player_order_in_final_round(self):
        state = self.final_scoring_fixture()
        state["round_order"] = list(reversed(state["turn_order"]))
        expected = state["round_order"][-1]
        self.finish_fixture(state)
        self.assertEqual(state["winner"], [expected])

    def test_stale_revision_and_mutating_another_players_turn_are_rejected(self):
        state = self.started()
        pid = state["current_turn"]
        other = next(player for player in state["turn_order"] if player != pid)
        self.rejected_unchanged(state, pid, {"type": "end_turn", "revision": state["revision"] - 1})
        self.rejected_unchanged(state, other, {"type": "end_turn"})

    def test_missing_or_duplicate_revision_cannot_consume_two_consecutive_turns(self):
        state = self.started()
        while state["draft_index"] < len(state["turn_order"]) - 1:
            self.apply(state, state["current_turn"], {"type": "end_turn"})
        pid = state["current_turn"]
        before = copy.deepcopy(SagradaGame.serialize(state))
        _, error = SagradaGame.apply_action(state, pid, {"type": "end_turn"})
        self.assertIsNotNone(error)
        self.assertEqual(SagradaGame.serialize(state), before)
        action = {"type": "end_turn", "revision": state["revision"]}
        self.apply(state, pid, action)
        self.assertEqual(state["current_turn"], pid, "The last player acts twice consecutively in snake order")
        self.rejected_unchanged(state, pid, action)

    def test_invalid_cells_unknown_dice_and_extra_action_fields_are_atomic(self):
        state = self.started()
        pid = state["current_turn"]
        die_id = state["pool"][0]["id"]
        for row, col in ((-1, 0), (4, 0), (0, 5), (False, 0), (0, "1")):
            with self.subTest(row=row, col=col):
                self.rejected_unchanged(state, pid, {"type": "place_die", "die_id": die_id, "row": row, "col": col})
        self.rejected_unchanged(state, pid, {"type": "place_die", "die_id": "not-in-pool", "row": 0, "col": 0})
        self.rejected_unchanged(state, pid, {"type": "end_turn", "unexpected": True})

    def test_placement_enforces_edge_contact_window_and_orthogonal_rules(self):
        grid = self.empty_grid()
        die = self.die("a", "red", 3)
        self.assertTrue(sagrada._placement_error(grid, die, 1, 1))
        self.assertFalse(sagrada._placement_error(grid, die, 0, 0))
        grid[0][0]["die"] = self.die("old", "red", 3)
        self.assertFalse(sagrada._placement_error(grid, die, 1, 1))
        self.assertTrue(sagrada._placement_error(grid, die, 0, 1))
        self.assertTrue(sagrada._placement_error(grid, die, 3, 4))
        grid[1][1]["restriction"] = {"color": "blue"}
        self.assertTrue(sagrada._placement_error(grid, die, 1, 1))
        self.assertFalse(sagrada._placement_error(grid, die, 1, 1, ignore_color=True))
        grid[1][1]["restriction"] = {"value": 5}
        self.assertTrue(sagrada._placement_error(grid, die, 1, 1))
        self.assertFalse(sagrada._placement_error(grid, die, 1, 1, ignore_value=True))

    def test_pass_keeps_all_pool_dice_and_round_waits_for_every_player(self):
        state = self.started()
        dice = copy.deepcopy(state["pool"])
        first_player = state["current_turn"]
        next_player = state["turn_order"][(state["turn_order"].index(first_player) + 1) % 2]
        for _ in range(4):
            self.apply(state, state["current_turn"], {"type": "end_turn"})
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round_track"][-1], dice)
        self.apply(state, "p1", {"type": "next_round"})
        self.assertEqual(state["phase"], "round_end")
        self.rejected_unchanged(state, "p1", {"type": "next_round"})
        self.apply(state, "p2", {"type": "next_round"})
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["current_turn"], next_player)

    def test_tool_cannot_be_used_twice_in_a_turn_or_without_favors(self):
        state, pid = self.fixture("grinding_stone")
        self.use_tool(state, pid, "grinding_stone", die_id="fixture-red", row=0, col=0)
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "grinding_stone", "die_id": "fixture-blue", "row": 1, "col": 1})
        state, pid = self.fixture("grinding_stone")
        state["players"][pid]["favor_tokens"] = 0
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "grinding_stone", "die_id": "fixture-red", "row": 0, "col": 0})

    def test_grozing_pliers_increments_and_cannot_wrap(self):
        state, pid = self.fixture("grozing_pliers")
        state["pool"][0]["value"] = 1
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "grozing_pliers", "die_id": "fixture-red", "delta": -1, "row": 0, "col": 0})
        self.use_tool(state, pid, "grozing_pliers", die_id="fixture-red", delta=1, row=0, col=0)
        self.assertEqual(state["players"][pid]["grid"][0][0]["die"]["value"], 2)
        self.assertEqual(state["players"][pid]["favor_tokens"], 19)
        self.assertEqual(state["tools"][0]["uses"], 1)
        self.assertEqual(state["tools"][0]["tokens"], 1)

    def test_grinding_stone_flips_to_opposite_face(self):
        state, pid = self.fixture("grinding_stone")
        self.use_tool(state, pid, "grinding_stone", die_id="fixture-blue", row=0, col=0)
        self.assertEqual(state["players"][pid]["grid"][0][0]["die"]["value"], 2)

    def test_already_used_tool_costs_two_favors(self):
        state, pid = self.fixture("grinding_stone")
        state["tools"][0].update(uses=1, tokens=1)
        self.use_tool(state, pid, "grinding_stone", die_id="fixture-blue", row=0, col=0)
        self.assertEqual(state["players"][pid]["favor_tokens"], 18)
        self.assertEqual(state["tools"][0]["tokens"], 3)

    def test_tool_use_resets_each_turn_but_shared_cost_survives_new_rounds(self):
        state, pid = self.fixture("grinding_stone")
        self.use_tool(state, pid, "grinding_stone", die_id="fixture-red", row=0, col=0)
        self.apply(state, pid, {"type": "end_turn"})
        while state["current_turn"] != pid:
            self.apply(state, state["current_turn"], {"type": "end_turn"})
        self.assertFalse(state["turn_state"]["tool_used"])
        self.use_tool(state, pid, "grinding_stone", die_id="fixture-blue", row=1, col=1)
        self.assertEqual(state["players"][pid]["favor_tokens"], 17)
        self.apply(state, pid, {"type": "end_turn"})
        for player_id in state["turn_order"]:
            self.apply(state, player_id, {"type": "next_round"})
        view = SagradaGame.get_public_view(state, pid)
        tool = next(tool for tool in view["tools"] if tool["id"] == "grinding_stone")
        self.assertEqual(tool["uses"], 2)
        self.assertEqual(tool["cost"], 2)
        self.assertEqual(state["tools"][0]["tokens"], 3)

    def test_eglomise_and_copper_ignore_only_the_corresponding_window_requirement(self):
        for tool_id, restriction in (
            ("eglomise_brush", {"color": "blue"}),
            ("copper_foil_burnisher", {"value": 5}),
        ):
            with self.subTest(tool=tool_id):
                state, pid = self.fixture(tool_id)
                grid = state["players"][pid]["grid"]
                grid[0][0]["die"] = self.die("anchor", "blue", 1)
                grid[0][1]["die"] = self.die("moved", "red", 3)
                grid[1][1]["restriction"] = restriction
                grid[1][2]["die"] = self.die("blocker", "red", 6)
                moves = [{"from_row": 0, "from_col": 1, "to_row": 1, "to_col": 1}]
                self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": tool_id, "moves": moves})
                state["players"][pid]["grid"][1][2]["die"] = None
                self.use_tool(state, pid, tool_id, moves=moves)
                self.assertIsNone(state["players"][pid]["grid"][0][1]["die"])
                self.assertEqual(state["players"][pid]["grid"][1][1]["die"]["id"], "moved")

    def test_lathekin_moves_two_distinct_dice_in_order_and_rejects_partial_failure_atomically(self):
        state, pid = self.fixture("lathekin")
        grid = state["players"][pid]["grid"]
        grid[0][0]["die"] = self.die("anchor", "blue", 1)
        grid[0][1]["die"] = self.die("one", "red", 3)
        grid[1][1]["die"] = self.die("two", "green", 4)
        first = {"from_row": 0, "from_col": 1, "to_row": 1, "to_col": 0}
        invalid_second = {"from_row": 1, "from_col": 1, "to_row": 0, "to_col": 0}
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "lathekin", "moves": [first, invalid_second]})
        repeated = {"from_row": 1, "from_col": 0, "to_row": 0, "to_col": 1}
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "lathekin", "moves": [first, repeated]})
        second = {"from_row": 1, "from_col": 1, "to_row": 2, "to_col": 0}
        self.use_tool(state, pid, "lathekin", moves=[first, second])
        grid = state["players"][pid]["grid"]
        self.assertEqual(grid[1][0]["die"]["id"], "one")
        self.assertEqual(grid[2][0]["die"]["id"], "two")

    def test_lathekin_cannot_swap_two_dice(self):
        state, pid = self.fixture("lathekin")
        grid = state["players"][pid]["grid"]
        grid[0][0]["die"] = self.die("one", "red", 3)
        grid[1][1]["die"] = self.die("two", "green", 4)
        self.rejected_unchanged(state, pid, {
            "type": "use_tool", "tool_id": "lathekin", "moves": [
                {"from_row": 0, "from_col": 0, "to_row": 1, "to_col": 1},
                {"from_row": 1, "from_col": 1, "to_row": 0, "to_col": 0},
            ],
        })

    def test_tap_wheel_moves_only_one_matching_track_color(self):
        state, pid = self.fixture("tap_wheel")
        grid = state["players"][pid]["grid"]
        grid[0][0]["die"] = self.die("anchor", "blue", 1)
        grid[0][1]["die"] = self.die("one", "red", 3)
        grid[1][2]["die"] = self.die("two", "red", 5)
        moves = [
            {"from_row": 0, "from_col": 1, "to_row": 1, "to_col": 0},
            {"from_row": 1, "from_col": 2, "to_row": 2, "to_col": 1},
        ]
        grid[1][2]["die"]["color"] = "green"
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "tap_wheel", "moves": moves})
        state["players"][pid]["grid"][1][2]["die"]["color"] = "red"
        state["round_track"][0][0]["color"] = "yellow"
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "tap_wheel", "moves": moves})
        state["round_track"][0][0]["color"] = "red"
        self.use_tool(state, pid, "tap_wheel", moves=moves)
        self.assertEqual(state["players"][pid]["grid"][2][1]["die"]["id"], "two")

    def test_lens_cutter_swaps_dice_with_round_track(self):
        state, pid = self.fixture("lens_cutter")
        self.use_tool(state, pid, "lens_cutter", die_id="fixture-blue", track_die_id="track-red", row=0, col=0)
        self.assertEqual(state["players"][pid]["grid"][0][0]["die"]["id"], "track-red")
        self.assertEqual(state["round_track"][0][0]["id"], "fixture-blue")

    def test_cork_backed_straightedge_requires_an_isolated_destination(self):
        state, pid = self.fixture("cork_backed_straightedge")
        state["players"][pid]["grid"][0][0]["die"] = self.die("anchor", "yellow", 1)
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "cork_backed_straightedge", "die_id": "fixture-red", "row": 1, "col": 1})
        self.use_tool(state, pid, "cork_backed_straightedge", die_id="fixture-red", row=2, col=3)
        self.assertEqual(state["players"][pid]["grid"][2][3]["die"]["id"], "fixture-red")

    def test_random_tools_reveal_pending_die_before_choosing_placement(self):
        for tool_id in ("flux_brush", "flux_remover"):
            with self.subTest(tool=tool_id):
                state, pid = self.fixture(tool_id)
                view = self.use_tool(state, pid, tool_id, die_id="fixture-red")
                pending = view["pending_tool"]
                self.assertEqual(pending["tool_id"], tool_id)
                self.assertIn(pending["die"]["color"], COLORS)
                if tool_id == "flux_brush":
                    self.assertEqual(pending["die"]["color"], "red")
                    self.assertIn(pending["die"]["value"], range(1, 7))
                self.rejected_unchanged(state, pid, {"type": "end_turn"})
                self.apply(state, pid, {"type": "resolve_tool", "row": 0, "col": 0, **({"value": 6} if tool_id == "flux_remover" else {})})
                placed = state["players"][pid]["grid"][0][0]["die"]
                self.assertEqual(placed["color"], pending["die"]["color"])
                if tool_id == "flux_remover":
                    self.assertEqual(placed["value"], 6)

    def test_random_tool_return_is_only_legal_if_pending_die_cannot_be_placed(self):
        state, pid = self.fixture("flux_brush")
        self.use_tool(state, pid, "flux_brush", die_id="fixture-red")
        self.rejected_unchanged(state, pid, {"type": "resolve_tool", "return_die": True})
        for row in range(4):
            for col in range(5):
                state["players"][pid]["grid"][row][col]["die"] = self.die(f"filled-{row}-{col}", "blue", 2)
        self.apply(state, pid, {"type": "resolve_tool", "return_die": True})
        self.assertTrue(any(d["id"] == "fixture-red" for d in state["pool"]))
        self.assertIsNone(state.get("pending_tool"))
        self.rejected_unchanged(state, pid, {"type": "place_die", "die_id": "fixture-blue", "row": 0, "col": 0})

    def test_flux_remover_conserves_ids_and_can_draw_back_the_returned_die(self):
        state, pid = self.fixture("flux_remover")
        state["bag"] = []
        before = Counter(d["id"] for d in self.dice_in_state(state))
        self.use_tool(state, pid, "flux_remover", die_id="fixture-red")
        self.assertEqual(state["pending_tool"]["die"]["id"], "fixture-red")
        self.assertEqual(Counter(d["id"] for d in self.dice_in_state(state)), before)
        self.apply(state, pid, {"type": "resolve_tool", "row": 0, "col": 0, "value": 4})
        self.assertEqual(Counter(d["id"] for d in self.dice_in_state(state)), before)

    def test_tenth_round_stays_visible_until_every_player_continues(self):
        state = self.final_scoring_fixture()
        self.apply(state, "p1", {"type": "next_round"})
        self.assertFalse(state["game_over"])
        self.assertEqual(state["phase"], "round_end")
        self.apply(state, "p2", {"type": "next_round"})
        self.assertTrue(state["game_over"])

    def test_flux_remover_does_not_force_returned_die_into_the_next_round(self):
        returned_die_was_left_in_bag = False
        for seed in range(12):
            state = self.started(seed=seed)
            pid = state["current_turn"]
            state["players"][pid]["grid"] = self.empty_grid()
            state["players"][pid]["favor_tokens"] = 3
            state["tools"] = [{"id": "flux_remover", "uses": 0, "tokens": 0}]
            returned_id = state["pool"][0]["id"]
            self.use_tool(state, pid, "flux_remover", die_id=returned_id)
            if state["pending_tool"]["die"]["id"] == returned_id:
                continue
            self.apply(state, pid, {"type": "resolve_tool", "row": 0, "col": 0, "value": 1})
            while state["phase"] == "drafting":
                self.apply(state, state["current_turn"], {"type": "end_turn"})
            for player_id in state["turn_order"]:
                self.apply(state, player_id, {"type": "next_round"})
            if returned_id not in {die["id"] for die in state["pool"]}:
                returned_die_was_left_in_bag = True
                break
        self.assertTrue(returned_die_was_left_in_bag, "A returned die must be mixed into the bag, not automatically drawn next round")

    def test_glazing_hammer_only_works_on_second_turn_before_drafting(self):
        state, pid = self.fixture("glazing_hammer")
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "glazing_hammer"})
        state, pid = self.fixture("glazing_hammer", second_turn=True)
        previous = [(d["id"], d["color"]) for d in state["pool"]]
        self.use_tool(state, pid, "glazing_hammer")
        self.assertEqual([(d["id"], d["color"]) for d in state["pool"]], previous)
        self.assertTrue(all(d["value"] in range(1, 7) for d in state["pool"]))

    def test_tap_wheel_allows_one_die_and_movement_can_precede_normal_draft(self):
        state, pid = self.fixture("tap_wheel")
        grid = state["players"][pid]["grid"]
        grid[0][0]["die"] = self.die("anchor", "blue", 1)
        grid[0][1]["die"] = self.die("one", "red", 3)
        self.use_tool(state, pid, "tap_wheel", moves=[
            {"from_row": 0, "from_col": 1, "to_row": 1, "to_col": 1},
        ])
        self.apply(state, pid, {"type": "place_die", "die_id": "fixture-green", "row": 2, "col": 2})
        self.assertEqual(len(self.occupied(state["players"][pid]["grid"])), 3)

    def test_running_pliers_can_end_first_turn_without_normal_draft_and_skips_second(self):
        state, pid = self.fixture("running_pliers")
        self.use_tool(state, pid, "running_pliers", die_id="fixture-red", row=0, col=0)
        self.assertEqual(len(self.occupied(state["players"][pid]["grid"])), 1)
        self.assertNotEqual(state["current_turn"], pid)
        self.assertIn(pid, state["skip_second"])
        for _ in range(2):
            self.apply(state, state["current_turn"], {"type": "end_turn"})
        self.assertEqual(state["phase"], "round_end")

    def test_running_pliers_can_follow_normal_draft_but_not_second_turn(self):
        state, pid = self.fixture("running_pliers")
        self.apply(state, pid, {"type": "place_die", "die_id": "fixture-red", "row": 0, "col": 0})
        self.use_tool(state, pid, "running_pliers", die_id="fixture-blue", row=1, col=1)
        self.assertEqual(len(self.occupied(state["players"][pid]["grid"])), 2)
        state, pid = self.fixture("running_pliers", second_turn=True)
        self.rejected_unchanged(state, pid, {"type": "use_tool", "tool_id": "running_pliers", "die_id": "fixture-red", "row": 0, "col": 0})

    def test_bots_finish_ten_rounds_and_preserve_every_physical_die(self):
        for count in (2, 3, 4):
            with self.subTest(players=count):
                state = SagradaGame.init_game({"seed": 173}, self.players(count, bots=True))
                initial = Counter(d["id"] for d in self.dice_in_state(state))
                for _ in range(500):
                    view = SagradaGame.get_public_view(state, "p1")
                    if view["game_over"]:
                        break
                    if view["phase"] == "round_end":
                        for player in self.players(count):
                            pid = player["player_id"]
                            if "next_round" in SagradaGame.get_legal_actions(state, pid):
                                self.apply(state, pid, {"type": "next_round"})
                    else:
                        if view["phase"] == "pattern_select":
                            pid = next(player["player_id"] for player in self.players(count) if SagradaGame.get_legal_actions(state, player["player_id"]))
                        else:
                            pid = view["current_turn"]
                        before = copy.deepcopy(SagradaGame.serialize(state))
                        action = SagradaGame.bot_move(state, pid)
                        self.assertEqual(SagradaGame.serialize(state), before, "Bot search mutated state")
                        self.assertIsNotNone(action)
                        # The room scheduler consumes presentation timing before
                        # submitting the bot's normal game action.
                        action.pop("delay_ms", None)
                        self.apply(state, pid, action)
                    self.assertEqual(Counter(d["id"] for d in self.dice_in_state(state)), initial)
                self.assertTrue(state["game_over"])
                self.assertEqual(state["round"], 10)
                self.assertEqual(len(state["winner"]), 1)


if __name__ == "__main__":
    unittest.main()
