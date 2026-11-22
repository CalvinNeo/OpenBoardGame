import copy
import json
import unittest

from game import get_game
from game.thats_life import ThatsLifeGame, move_options, score_tiles
from game.thats_life_ai import choose_action


def players(count=2):
    return [{"player_id": "player-{}".format(index), "name": "Player {}".format(index + 1),
             "seat": index, "is_bot": False} for index in range(count)]


def tile(value, identifier=None):
    return {"id": identifier or "value-{}".format(value), "kind": "lucky" if value == 0 else "points", "value": value}


class ThatsLifeTests(unittest.TestCase):
    def setUp(self):
        self.state = ThatsLifeGame.init_game({"seed": 7}, players())
        self.actor = self.state["current_turn"]

    def move(self, piece_id):
        return ThatsLifeGame.apply_action(self.state, self.actor, {"type": "move", "piece_id": piece_id})

    def prepare(self, die=2):
        self.state.update(phase="move", die=die)
        return self.state["pieces"][0]

    def test_registration_and_pawn_counts(self):
        definition = get_game("thats_life")
        self.assertEqual((definition.min_players, definition.max_players), (2, 6))
        for count in range(2, 7):
            state = ThatsLifeGame.init_game({}, players(count))
            self.assertEqual(len([piece for piece in state["pieces"] if piece["kind"] == "pawn"]),
                             count * (3 if count <= 4 else 2))
            guards = [piece for piece in state["pieces"] if piece["kind"] == "guard"]
            self.assertEqual(len(guards), 8)
            protected = {piece["position"] for piece in guards}
            self.assertEqual(protected, {entry["id"] for entry in state["track"]
                                         if entry["kind"] == "lucky" or entry["value"] in (7, 8)})

    def test_standard_track_composition(self):
        values = [entry["value"] for entry in self.state["track"][1:-1]]
        self.assertEqual(values, list(range(-1, -9, -1)) + [0] * 6 + list(range(8, 0, -1)) + list(range(-1, -11, -1)))
        self.assertEqual(len(set(entry["id"] for entry in self.state["track"])), 34)

    def test_random_setup_deterministic_and_different(self):
        first = ThatsLifeGame.init_game({"seed": "test", "setup": "random"}, players())
        second = ThatsLifeGame.init_game({"seed": "test", "setup": "random"}, players())
        self.assertEqual(first, second)
        self.assertNotEqual(first["track"], self.state["track"])
        self.assertEqual(sorted(entry["value"] for entry in first["track"]), sorted(entry["value"] for entry in self.state["track"]))

    def test_invalid_config_and_player_counts(self):
        for config in ({"rounds": True}, {"rounds": 0}, {"rounds": 4}, {"setup": []},
                       {"seed": True}, {"seed": ""}, {"unknown": 1}, []):
            with self.subTest(config=config), self.assertRaises(ValueError):
                ThatsLifeGame.init_game(config, players())
        for count in (0, 1, 7):
            with self.assertRaises(ValueError):
                ThatsLifeGame.init_game({}, players(count))
        with self.assertRaises(ValueError):
            ThatsLifeGame.init_game({}, [players()[0]] * 2)

    def test_roll_then_move_and_seed_privacy(self):
        self.assertEqual(ThatsLifeGame.get_legal_actions(self.state, self.actor), ["roll"])
        events, error = ThatsLifeGame.apply_action(self.state, self.actor, {"type": "roll"})
        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["die"], self.state["die"])
        self.assertIn(self.state["die"], range(1, 7))
        self.assertEqual(ThatsLifeGame.get_legal_actions(self.state, self.actor), ["move"])
        self.assertEqual(len(move_options(self.state, self.actor)), 3)
        view = ThatsLifeGame.get_public_view(self.state, self.actor)
        self.assertNotIn("base_seed", view)
        self.assertNotIn("seed", view["config"])
        spectator = ThatsLifeGame.get_public_view(self.state, "spectator")
        self.assertEqual(spectator["move_options"], [])
        self.assertEqual(spectator["legal_actions"], [])

    def test_last_departure_collects_source_and_closes_gap(self):
        piece = self.prepare()
        piece["position"] = "tile-0"
        events, error = self.move(piece["id"])
        self.assertIsNone(error)
        self.assertEqual(piece["position"], "tile-2")
        self.assertEqual(self.state["players"][self.actor]["tiles"], [tile(-1, "tile-0")])
        self.assertNotIn("tile-0", [entry["id"] for entry in self.state["track"]])
        self.assertEqual(events[0]["payload"]["collect"]["value"], -1)
        self.state.update(current_turn=self.actor, phase="move", die=1)
        option = next(option for option in move_options(self.state, self.actor) if option["piece_id"] == self.state["pieces"][1]["id"])
        self.assertEqual(option["to"], "tile-1")

    def test_shared_source_is_not_collected(self):
        for other_id in (self.actor, "player-1"):
            with self.subTest(other_id=other_id):
                self.setUp()
                piece = self.prepare()
                piece["position"] = "tile-0"
                other = next(candidate for candidate in self.state["pieces"]
                             if candidate["owner"] == other_id and candidate["id"] != piece["id"])
                other["position"] = "tile-0"
                self.assertIsNone(self.move(piece["id"])[1])
                self.assertEqual(self.state["players"][self.actor]["tiles"], [])

    def test_guard_requires_pawn_not_other_guard(self):
        self.prepare()
        guards = [piece for piece in self.state["pieces"] if piece["kind"] == "guard"]
        self.assertFalse(any(option["piece_id"] == guards[0]["id"] for option in move_options(self.state, self.actor)))
        guards[1]["position"] = guards[0]["position"]
        self.assertFalse(any(option["piece_id"] == guards[0]["id"] for option in move_options(self.state, self.actor)))
        self.state["pieces"][3]["position"] = guards[0]["position"]
        self.assertTrue(any(option["piece_id"] == guards[0]["id"] for option in move_options(self.state, self.actor)))
        self.assertIsNone(self.move(guards[0]["id"])[1])
        self.assertEqual(self.state["players"][self.actor]["tiles"], [])

    def test_guard_prevents_collection(self):
        piece = self.prepare()
        guard = next(candidate for candidate in self.state["pieces"] if candidate["kind"] == "guard")
        piece["position"] = guard["position"]
        self.assertIsNone(self.move(piece["id"])[1])
        self.assertEqual(self.state["players"][self.actor]["tiles"], [])

    def test_finish_clamps_and_finished_players_are_skipped(self):
        piece = self.prepare(6)
        for other in self.state["pieces"]:
            if other["owner"] == "player-1":
                other["position"] = "finish"
        piece["position"] = "tile-31"
        self.assertIsNone(self.move(piece["id"])[1])
        self.assertEqual(piece["position"], "finish")
        self.assertEqual(self.state["current_turn"], self.actor)
        self.state.update(phase="move", die=1)
        self.assertNotIn(piece["id"], [option["piece_id"] for option in move_options(self.state, self.actor)])

    def test_lucky_conversion_largest_first_and_extras_zero(self):
        result = score_tiles([tile(-3), tile(-8), tile(5), tile(0)])
        self.assertEqual(result["score"], 10)
        self.assertEqual(result["converted_ids"], ["value--8"])
        self.assertEqual(score_tiles([tile(0), tile(0), tile(5)])["score"], 5)
        self.assertEqual(score_tiles([tile(-3), tile(-8), tile(0), tile(0, "lucky-2")])["score"], 11)

    def test_rejected_actions_are_atomic(self):
        for action in ({}, [], {"type": []}, {"type": "move", "piece_id": "pawn-0-0"},
                       {"type": "roll", "extra": 1}, {"type": "next_round"}):
            before = copy.deepcopy(self.state)
            self.assertIsNotNone(ThatsLifeGame.apply_action(self.state, self.actor, action)[1])
            self.assertEqual(before, self.state)
        self.prepare()
        for identifier in ([], {}, None, "guard-0", "pawn-1-0", "missing"):
            before = copy.deepcopy(self.state)
            self.assertIsNotNone(self.move(identifier)[1])
            self.assertEqual(before, self.state)
        self.assertIsNotNone(ThatsLifeGame.apply_action(self.state, "spectator", {"type": "move", "piece_id": "pawn-0-0"})[1])

    def test_save_load_and_public_view_are_independent(self):
        self.prepare()
        payload = json.loads(json.dumps(ThatsLifeGame.serialize(self.state)))
        restored = ThatsLifeGame.deserialize(payload)
        action = {"type": "move", "piece_id": "pawn-0-0"}
        self.assertEqual(ThatsLifeGame.apply_action(self.state, self.actor, action), ThatsLifeGame.apply_action(restored, self.actor, action))
        self.assertEqual(self.state, restored)
        public = ThatsLifeGame.get_public_view(self.state, self.actor)
        public["track"].clear()
        public["players"][0]["tiles"].append(tile(8))
        self.assertEqual(len(self.state["track"]), 34)
        self.assertEqual(self.state["players"][self.actor]["tiles"], [])

    def test_round_pause_and_tiebreak(self):
        self.state = ThatsLifeGame.init_game({"rounds": 2, "seed": 10}, players())
        self.prepare(6)
        for piece in self.state["pieces"]:
            if piece["kind"] == "pawn":
                piece["position"] = "finish"
        self.state["pieces"][0]["position"] = "tile-31"
        self.assertIsNone(self.move("pawn-0-0")[1])
        self.assertEqual(self.state["phase"], "round_summary")
        self.assertEqual(self.state["round_number"], 1)
        self.assertIsNone(ThatsLifeGame.apply_action(self.state, self.actor, {"type": "next_round"})[1])
        before = copy.deepcopy(self.state)
        self.assertEqual(ThatsLifeGame.apply_action(self.state, self.actor, {"type": "next_round"}), ([], None))
        self.assertEqual(before, self.state)
        self.assertIsNone(ThatsLifeGame.apply_action(self.state, "player-1", {"type": "next_round"})[1])
        self.assertEqual(self.state["round_number"], 2)
        self.assertEqual(self.state["current_turn"], "player-1")

    def test_final_score_and_lucky_tiebreak(self):
        self.prepare(6)
        for piece in self.state["pieces"]:
            if piece["kind"] == "pawn":
                piece["position"] = "finish"
        self.state["pieces"][0]["position"] = "start"
        self.state["track"] = [self.state["track"][0], self.state["track"][-1]]
        self.state["players"][self.actor]["tiles"] = [tile(5)]
        self.state["players"]["player-1"]["tiles"] = [tile(5), tile(0)]
        self.assertIsNone(self.move("pawn-0-0")[1])
        self.assertEqual(self.state["winner_ids"], [self.actor])
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["phase"], "game_over")
        self.assertEqual(ThatsLifeGame.get_legal_actions(self.state, self.actor), [])

    def test_seeded_full_games_ai_and_tile_conservation(self):
        for count in range(2, 7):
            for setup in ("standard", "random"):
                with self.subTest(count=count, setup=setup):
                    state = ThatsLifeGame.init_game({"seed": count, "setup": setup, "rounds": 2}, players(count))
                    for step in range(4000):
                        if state["game_over"]:
                            break
                        actor = state["current_turn"] or next(player_id for player_id in state["turn_order"] if player_id not in state["ready"])
                        action = choose_action(ThatsLifeGame.get_public_view(state, actor))
                        self.assertIsNotNone(action)
                        self.assertIsNone(ThatsLifeGame.apply_action(state, actor, action)[1])
                        all_tiles = state["track"][1:-1] + [entry for player in state["players"].values() for entry in player["tiles"]]
                        self.assertEqual(len(all_tiles), 32)
                        self.assertEqual(len({entry["id"] for entry in all_tiles}), 32)
                        positions = {entry["id"] for entry in state["track"]}
                        self.assertTrue(all(piece["position"] in positions for piece in state["pieces"]))
                    self.assertTrue(state["game_over"], step)
                    self.assertEqual(len(state["score_history"]), 2)


if __name__ == "__main__":
    unittest.main()
