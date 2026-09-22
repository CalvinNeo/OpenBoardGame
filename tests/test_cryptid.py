import copy
import json
import random
import unittest
from collections import deque
from unittest.mock import patch

from game.cryptid import CryptidGame as Game, build_board, evaluate_clue, hex_distance, bot_from_view
from game.cryptid_data import TILES, clue_catalog


class CryptidTests(unittest.TestCase):
    def make(self, count=3, advanced=False, seed=103):
        return Game.init_game({"seed": seed, "advanced": advanced}, [
            {"player_id": f"p{i}", "seat": i, "name": f"Explorer {i}"} for i in range(count)])

    def act(self, state, pid, **action):
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error, (pid, action, error))
        return events

    def reject(self, state, pid, action):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, action)
        self.assertTrue(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def acknowledge(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, type="next_round")

    def start(self, state):
        while state["round"] == 0:
            if state["phase"] == "round_end":
                self.acknowledge(state)
            else:
                pid = state["current_turn"]
                self.act(state, pid, **Game.bot_move(state, pid))
        return state

    def test_tiles_catalog_and_structures(self):
        self.assertEqual(sum(len(row) for tile in TILES for row in tile["rows"]), 108)
        for advanced, clue_count, structure_count in ((False, 23, 6), (True, 48, 8)):
            board, layout = build_board(random.Random(103), advanced)
            self.assertEqual(len({c["id"] for c in board}), 108)
            self.assertEqual(sorted(t["tile"] for t in layout), list(range(1, 7)))
            structures = [c["structure"] for c in board if c["structure"]]
            self.assertEqual(len(structures), structure_count)
            self.assertEqual(len({(s["type"], s["color"]) for s in structures}), structure_count)
            catalog = clue_catalog(advanced)
            self.assertEqual(len(catalog), clue_count)
            self.assertEqual(len({c["id"] for c in catalog}), clue_count)

    def test_hex_distance_matches_independent_neighbor_walk(self):
        board, _ = build_board(random.Random(1), False)
        lookup = {(c["col"], c["row"]): c for c in board}
        for start in (board[0], board[5], board[41], board[-1]):
            distances = {start["id"]: 0}
            queue = deque([start])
            while queue:
                cell = queue.popleft()
                col, row = cell["col"], cell["row"]
                diagonal = 1 if col % 2 else -1
                for key in ((col, row - 1), (col, row + 1), (col - 1, row), (col + 1, row),
                            (col - 1, row + diagonal), (col + 1, row + diagonal)):
                    other = lookup.get(key)
                    if other and other["id"] not in distances:
                        distances[other["id"]] = distances[cell["id"]] + 1
                        queue.append(other)
            for target in board:
                self.assertEqual(hex_distance(start, target), distances[target["id"]])
                self.assertEqual(hex_distance(start, target), hex_distance(target, start))

    def test_predicate_boundaries_and_negative_complements(self):
        board, _ = build_board(random.Random(31), True)
        catalog = {c["id"]: c for c in clue_catalog(True)}
        all_cells = {c["id"] for c in board}
        for clue in catalog.values():
            if clue["negative"]:
                self.assertEqual(set(evaluate_clue(board, clue)), all_cells - set(evaluate_clue(board, catalog[clue["id"][4:]])))
        pair = catalog["terrain_forest_water"]
        self.assertEqual(set(evaluate_clue(board, pair)), {c["id"] for c in board if c["terrain"] in ("forest", "water")})
        for kind, distance in (("near_forest", 1), ("animal_bear", 2), ("color_black", 3)):
            clue = catalog[kind]
            self.assertEqual(clue["distance"], distance)
            target_cells = [c for c in board if (c["terrain"] == "forest" if kind == "near_forest" else
                            c["animal"] == "bear" if kind == "animal_bear" else
                            (c["structure"] or {}).get("color") == "black")]
            for cell in board:
                self.assertEqual(cell["id"] in evaluate_clue(board, clue), min(hex_distance(cell, t) for t in target_cells) <= distance)

    def test_generation_unique_irredundant_and_reproducible(self):
        for advanced in (False, True):
            for count in (3, 4, 5):
                for seed in range(20):
                    with self.subTest(advanced=advanced, count=count, seed=seed):
                        state = self.make(count, advanced, seed)
                        matches = [set(values) for values in state["matches"].values()]
                        self.assertEqual(set.intersection(*matches), {state["solution"]})
                        self.assertEqual(len({c["id"] for c in state["clues"].values()}), count)
                        for i in range(count):
                            self.assertGreater(len(set.intersection(*(values for j, values in enumerate(matches) if i != j))), 1)
                            self.assertGreaterEqual(108 - len(matches[i]), 2 * count)
        a, b = self.make(), self.make()
        self.assertEqual(a["board"], b["board"])
        self.assertEqual(a["clues"], b["clues"])
        self.assertNotEqual(a["game_instance_id"], b["game_instance_id"])

    def test_configuration_validation(self):
        for count in (0, 1, 2, 6):
            with self.assertRaises(ValueError):
                self.make(count)
        players = [{"player_id": str(i)} for i in range(3)]
        for config in ({"advanced": 1}, {"advanced": "false"}, {"secret": 12}, {"seed": True}):
            with self.assertRaises(ValueError):
                Game.init_game(config, players)
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "same"}] * 3)

    def test_two_initial_circles_require_every_acknowledgement(self):
        state = self.make(5)
        for initial_pass in (1, 2):
            for pid in state["turn_order"]:
                self.assertEqual(state["current_turn"], pid)
                self.act(state, pid, **Game.bot_move(state, pid))
            self.assertEqual(state["phase"], "round_end")
            for pid in state["turn_order"][:-1]:
                self.act(state, pid, type="next_round")
                before = copy.deepcopy(state)
                self.act(state, pid, type="next_round")
                self.assertEqual(state, before)
            self.assertEqual(state["phase"], "round_end")
            self.act(state, state["turn_order"][-1], type="next_round")
            self.assertEqual(sum(bool(m["cube"]) for m in state["markers"].values()), initial_pass * 5)
        self.assertEqual((state["phase"], state["round"]), ("turn", 1))

    def test_illegal_actions_are_atomic(self):
        state = self.make()
        pid = state["current_turn"]
        other = next(p for p in state["players"] if p != pid)
        valid = Game.get_public_view(state, pid)["placement_cells"][0]
        for actor, action in [
            (pid, {"type": "place_initial_cube", "cell_id": state["solution"]}),
            (other, {"type": "place_initial_cube", "cell_id": valid}),
            ("spectator", {"type": "place_initial_cube", "cell_id": valid}),
            (pid, {"type": "place_initial_cube", "cell_id": "Z99"}),
            (pid, {"type": "place_initial_cube", "cell_id": valid, "ignore": True}),
            (pid, {"type": "search", "cell_id": valid}),
            (pid, {"type": "place_initial_cube", "cell_id": 1}),
        ]:
            self.reject(state, actor, action)

    def test_question_negative_cost_and_no_elimination(self):
        state = self.start(self.make())
        pid = state["current_turn"]
        target = next(p for p in state["players"] if p != pid)
        cell = next(c["id"] for c in state["board"] if not state["markers"][c["id"]]["cube"] and c["id"] not in state["matches"][target])
        self.act(state, pid, type="question", cell_id=cell, target_player_id=target)
        self.assertEqual(state["markers"][cell]["cube"], target)
        self.assertEqual((state["phase"], state["current_turn"]), ("compensate_cube", pid))
        self.reject(state, pid, {"type": "place_compensation_cube", "cell_id": cell})
        self.act(state, pid, **Game.bot_move(state, pid))
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(len(state["players"]), 3)

    def test_question_can_contradict_own_clue_and_existing_disc_blocks_repetition(self):
        state = self.start(self.make())
        pid = state["current_turn"]
        pair = next((c["id"], p) for c in state["board"] for p in state["players"] if p != pid
                    and not state["markers"][c["id"]]["cube"]
                    and c["id"] not in state["matches"][pid] and c["id"] in state["matches"][p])
        cell, target = pair
        self.act(state, pid, type="question", cell_id=cell, target_player_id=target)
        self.assertIn(target, state["markers"][cell]["discs"])
        state.update(current_turn=pid, turn_index=0)
        self.reject(state, pid, {"type": "question", "cell_id": cell, "target_player_id": target})
        self.reject(state, pid, {"type": "question", "cell_id": cell, "target_player_id": pid})

    def test_cube_can_join_other_discs_but_then_locks_space(self):
        state = self.start(self.make())
        pid = state["current_turn"]
        target = state["turn_order"][1]
        cell = next(c for c in state["matches"][pid] if c not in state["matches"][target] and not state["markers"][c]["cube"])
        state["markers"][cell]["discs"] = [pid]
        self.act(state, pid, type="question", cell_id=cell, target_player_id=target)
        self.assertEqual(state["markers"][cell], {"discs": [pid], "cube": target})
        self.assertNotIn(cell, Game.get_public_view(state, pid)["placement_cells"])

    def test_search_stops_at_first_negative_and_requires_compensation(self):
        state = self.start(self.make(5))
        pid = state["current_turn"]
        cell = next(c for c in Game.get_public_view(state, pid)["search_cells"] if c != state["solution"])
        expected = next(i for i, p in enumerate(state["turn_order"]) if cell not in state["matches"][p])
        self.act(state, pid, type="search", cell_id=cell)
        self.assertEqual(len(state["last_action"]["results"]), expected + 1)
        self.assertEqual(state["phase"], "compensate_cube")
        self.assertFalse(state["game_over"])
        for other in state["turn_order"][expected + 1:]:
            self.assertNotIn(other, state["markers"][cell]["discs"])

    def test_extra_disc_preserves_search_and_wins_with_existing_discs(self):
        state = self.start(self.make())
        pid, other = state["turn_order"][:2]
        cell = state["solution"]
        state["markers"][cell]["discs"] = [pid, other]
        self.act(state, pid, type="search", cell_id=cell)
        self.assertEqual(state["phase"], "search_extra_disc")
        self.assertFalse(state["game_over"])
        self.reject(state, pid, {"type": "place_extra_disc", "cell_id": cell})
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(restored, state)
        self.act(state, pid, **Game.bot_move(state, pid))
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], [pid])
        self.assertEqual(len(state["markers"][cell]["discs"]), 3)
        self.assertTrue(state["last_action"]["results"][1]["already_present"])

    def test_empty_extra_disc_set_cannot_deadlock(self):
        state = self.start(self.make())
        pid = state["current_turn"]
        for cell in state["matches"][pid]:
            if not state["markers"][cell]["cube"]:
                state["markers"][cell]["discs"].append(pid)
        self.act(state, pid, type="search", cell_id=state["solution"])
        self.assertTrue(state["game_over"])
        self.assertTrue(any("线上约定" in line for line in state["log"]))

    def test_empty_compensation_set_cannot_deadlock(self):
        state = self.start(self.make())
        pid = state["current_turn"]
        for cell in state["board"]:
            if cell["id"] not in state["matches"][pid] and not state["markers"][cell["id"]]["cube"]:
                state["markers"][cell["id"]]["cube"] = pid
        cell = next(c for c in Game.get_public_view(state, pid)["search_cells"] if c != state["solution"])
        self.act(state, pid, type="search", cell_id=cell)
        self.assertEqual(state["phase"], "turn")
        self.assertTrue(any("线上约定" in line for line in state["log"]))

    def test_hints_require_correct_threshold_and_are_single_use(self):
        for count in (3, 4, 5):
            state = self.start(self.make(count))
            self.assertTrue(state["hint_text"])
            required = 3 if count == 3 else count - 1
            for i, pid in enumerate(state["turn_order"][:required]):
                self.act(state, pid, type="vote_hint", agree=True)
                self.assertEqual(state["hint_revealed"], i + 1 == required)
            self.assertNotIn("vote_hint", Game.get_legal_actions(state, state["turn_order"][0]))
            self.assertEqual(Game.get_public_view(state, "spectator")["hint"], state["hint_text"])

    def test_notes_private_and_validated(self):
        state = self.make()
        before_turn = (state["phase"], state["current_turn"])
        notes = {"text": "private notebook sentinel", "cells": {"A1": "candidate"}, "clues": {"p1": [clue_catalog()[0]["id"]]}}
        events = self.act(state, "p0", type="update_notes", notes=notes)
        self.assertNotIn(notes["text"], json.dumps(events))
        self.assertEqual(Game.get_public_view(state, "p0")["notes"], notes)
        self.assertNotIn(notes["text"], json.dumps(Game.get_public_view(state, "p1")))
        self.assertEqual((state["phase"], state["current_turn"]), before_turn)
        for invalid in ({**notes, "text": "a" * 4001}, {**notes, "cells": {"Z0": "candidate"}},
                        {**notes, "clues": {"p1": ["made_up"]}}, {**notes, "clues": {"intruder": []}}):
            self.reject(state, "p0", {"type": "update_notes", "notes": invalid})

    def test_bots_vote_only_after_human_hint_request(self):
        state = self.start(self.make())
        for pid in ("p1", "p2"):
            state["players"][pid]["is_bot"] = True
            self.assertNotIn("vote_hint", Game.get_legal_actions(state, pid))
        self.act(state, "p0", type="vote_hint", agree=True)
        for pid in ("p1", "p2"):
            action = Game.bot_move(state, pid)
            self.assertEqual(action, {"type": "vote_hint", "agree": True})
            self.act(state, pid, **action)
        self.assertTrue(state["hint_revealed"])

    def test_public_views_do_not_expose_solution_or_other_clues(self):
        state = self.make(5, True)
        for pid in list(state["players"]) + ["spectator"]:
            view = Game.get_public_view(state, pid)
            self.assertFalse({"seed", "solution", "matches", "clues", "revealed_clues"} & set(view))
            self.assertEqual(view["my_clue"], state["clues"].get(pid))
            self.assertEqual(view["my_matches"], state["matches"].get(pid, []))
            if pid == "spectator":
                self.assertEqual(view["legal_actions"], [])
                self.assertIsNone(view["notes"])
            view["board"][0]["terrain"] = "bad"
            self.assertNotEqual(state["board"][0]["terrain"], "bad")

    def test_hint_availability_does_not_leak_hidden_clue_categories(self):
        state = self.start(self.make(5))
        before = Game.get_public_view(state, "p0")
        state["hint_text"] = None
        self.assertEqual(Game.get_public_view(state, "p0"), before)
        for pid in state["turn_order"][:4]:
            self.act(state, pid, type="vote_hint", agree=True)
        self.assertTrue(state["hint_revealed"])
        self.assertIn("没有可用", Game.get_public_view(state, "p0")["hint"])

    def test_save_roundtrip_and_tamper_rejection(self):
        state = self.start(self.make())
        saved = Game.serialize(state)
        restored = Game.deserialize(json.loads(json.dumps(saved)))
        self.assertEqual(restored, state)
        restored["log"].append("changed")
        self.assertNotEqual(restored, state)
        for key, value in (("solution", "Z0"), ("version", 9), ("phase", "bad"), ("next_ready", ["stranger"])):
            invalid = copy.deepcopy(saved)
            invalid[key] = value
            with self.assertRaises(ValueError):
                Game.deserialize(invalid)

    def test_bot_only_receives_player_view(self):
        state = self.start(self.make(5, True))
        pid = state["current_turn"]
        expected = bot_from_view(Game.get_public_view(state, pid))
        changed = copy.deepcopy(state)
        for other in changed["players"]:
            if other != pid:
                changed["clues"][other] = {"secret_sentinel": "wrong"}
                changed["matches"][other] = []
        changed["solution"] = "DO_NOT_READ"
        self.assertEqual(Game.bot_move(changed, pid), expected)

    def test_complete_bot_games_all_modes_and_player_counts(self):
        for advanced in (False, True):
            for count in (3, 4, 5):
                for seed in range(5):
                    state = self.make(count, advanced, seed)
                    for player in state["players"].values():
                        player["is_bot"] = True
                    for _ in range(700):
                        if state["game_over"]:
                            break
                        if state["phase"] == "round_end":
                            pid = next(p for p in state["turn_order"] if p not in state["next_ready"])
                        else:
                            pid = state["current_turn"]
                        action = Game.bot_move(state, pid)
                        self.assertIsNotNone(action)
                        self.act(state, pid, **action)
                    self.assertTrue(state["game_over"], (advanced, count, seed))
                    self.assertEqual(len(state["winner"]), 1)
                    self.assertIn("revealed_clues", Game.get_public_view(state, "spectator"))


if __name__ == "__main__":
    unittest.main()
