import copy
import asyncio
import json
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from jsonschema import Draft7Validator

import app
from game import get_game
from game.town77 import ACTION_SCHEMA, Town77Game, choose_move, exchange_groups, legal_placements
from tests.test_room_session import DummySio


def fresh(count=2, seed=17):
    return Town77Game.init_game({"seed": seed}, [
        {"player_id": f"neighbor-{index}", "name": f"Neighbor {index + 1}", "seat": index}
        for index in range(count)
    ])


def all_tiles(state):
    return ([tile for row in state["board"] for tile in row if tile is not None]
            + state["bag"] + [tile for pile in state["piles"] for tile in pile]
            + [tile for player in state["players"].values() for tile in player["hand"]])


def ending_state():
    state = fresh()
    state["board"] = [[None] * 7 for _ in range(7)]
    state["board"][0][0] = 0
    state["players"]["neighbor-0"]["hand"] = [8]
    state["players"]["neighbor-1"]["hand"] = [16]
    state["bag"] = [tile for tile in range(49) if tile not in (0, 8, 16)]
    return state


class Town77Tests(unittest.TestCase):
    def apply(self, state, action, player=None):
        events, error = Town77Game.apply_action(state, player or state["current_turn"], action)
        self.assertIsNone(error, (action, error))
        self.assertTrue(events)

    def reject(self, state, action, player=None):
        before = copy.deepcopy(state)
        events, error = Town77Game.apply_action(state, player or state["current_turn"], action)
        self.assertTrue(error, action)
        self.assertFalse(events)
        self.assertEqual(state, before)

    def test_registration_setup_and_conservation(self):
        definition = get_game("town77")
        self.assertIs(definition.module, Town77Game)
        self.assertEqual((definition.min_players, definition.max_players), (1, 5))
        for count in range(1, 6):
            state = fresh(count)
            self.assertEqual(state, fresh(count))
            self.assertEqual(sorted(all_tiles(state)), list(range(49)))
            if count == 1:
                self.assertEqual([len(pile) for pile in state["piles"]], [17, 16, 16])
                self.assertEqual(len(Town77Game.get_public_view(state, "neighbor-0")["hand"]), 3)
            else:
                self.assertEqual(len(state["bag"]), 48 - 4 * count)
                self.assertTrue(all(len(player["hand"]) == 4 for player in state["players"].values()))
                self.assertIsNotNone(state["board"][0][0])
        for count in (0, 6):
            with self.assertRaises(ValueError):
                fresh(count)
        for config in ({"seed": True}, {"seed": "17"}, {"hand": 8}):
            with self.assertRaises(ValueError):
                Town77Game.init_game(config, [{"player_id": "a"}])
        with self.assertRaises(ValueError):
            Town77Game.init_game({}, [{"player_id": "same"}, {"player_id": "same"}])

    def test_full_row_column_constraints_and_adjacency(self):
        board = [[None] * 7 for _ in range(7)]
        self.assertEqual(legal_placements(board, [0]), [{"type": "place", "tile": 0, "x": 0, "y": 0}])
        board[0][0] = 0
        moves = legal_placements(board, list(range(49)))
        self.assertTrue(all((move["x"], move["y"]) in ((1, 0), (0, 1)) for move in moves))
        self.assertTrue(all(move["tile"] // 7 != 0 and move["tile"] % 7 != 0 for move in moves))
        board[0][3] = 8
        candidates = [move["tile"] for move in legal_placements(board, [1, 7, 16]) if (move["x"], move["y"]) == (2, 0)]
        self.assertEqual(candidates, [16])
        board[3][0] = 16
        candidates = [move["tile"] for move in legal_placements(board, [2, 14, 24]) if (move["x"], move["y"]) == (0, 2)]
        self.assertEqual(candidates, [24])

    def test_invalid_actions_are_atomic_even_without_schema(self):
        state = fresh()
        move = legal_placements(state["board"], state["players"][state["current_turn"]]["hand"])[0]
        invalid = [None, [], {}, {"type": []}, {"type": "nope"}, {"type": "pass"},
                   {**move, "tile": True}, {**move, "x": True}, {**move, "x": -1}, {**move, "y": 7},
                   {**move, "x": "1"}, {**move, "extra": 1}, {**move, "tile": 99}]
        for action in invalid:
            self.reject(state, action)
        self.reject(state, move, "neighbor-1")
        self.reject(state, move, "spectator")

    def test_draw_keep_discard_and_permanent_hand_reduction(self):
        state = fresh()
        player_id = state["current_turn"]
        starting = len(state["bag"])
        self.apply(state, legal_placements(state["board"], state["players"][player_id]["hand"])[0])
        self.assertEqual(state["phase"], "discard")
        self.assertEqual(len(state["players"][player_id]["hand"]), 4)
        self.assertEqual(len(state["bag"]), starting - 1)
        self.reject(state, {"type": "discard", "tile": -1})
        self.reject(state, {"type": "discard", "tile": True})
        drawn = state["players"][player_id]["hand"][-1]
        self.apply(state, {"type": "discard", "tile": drawn})
        self.assertEqual(len(state["players"][player_id]["hand"]), 3)
        self.assertEqual(len(state["bag"]), starting)
        self.assertNotIn("tile", state["history"][-1])
        next_player = state["current_turn"]
        self.apply(state, legal_placements(state["board"], state["players"][next_player]["hand"])[0])
        self.apply(state, {"type": "keep"})
        self.assertEqual(len(state["players"][next_player]["hand"]), 4)
        self.assertEqual(sorted(all_tiles(state)), list(range(49)))

    def test_empty_bag_skips_discard_and_last_tile_does_not_draw(self):
        state = fresh()
        state["bag"] = []
        player = state["current_turn"]
        self.apply(state, legal_placements(state["board"], state["players"][player]["hand"])[0])
        self.assertEqual(state["phase"], "place")
        self.assertEqual(state["current_turn"], "neighbor-1")
        state = ending_state()
        size = len(state["bag"])
        self.apply(state, {"type": "place", "tile": 8, "x": 1, "y": 0})
        self.assertEqual(len(state["bag"]), size)
        self.assertTrue(state["players"]["neighbor-0"]["retired"])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "neighbor-1")

    def test_exchange_three_color_or_shape_and_four_choose_three(self):
        self.assertEqual(len(exchange_groups([0, 1, 2, 3])), 4)
        self.assertEqual(exchange_groups([0, 7, 14, 22]), [[0, 7, 14]])
        state = fresh()
        state["board"][0][0] = 48
        state["players"]["neighbor-0"]["hand"] = [0, 1, 2, 3]
        state["players"]["neighbor-1"]["hand"] = [7, 8, 9, 10]
        state["bag"] = [tile for tile in range(49) if tile not in (0, 1, 2, 3, 7, 8, 9, 10, 48)]
        for tiles in ([0, 1], [0, 0, 1], [0, 1, 7], [True, 1, 2], "012", None):
            self.reject(state, {"type": "exchange", "tiles": tiles})
        self.apply(state, {"type": "exchange", "tiles": [2, 0, 1]})
        self.assertEqual(len(state["players"]["neighbor-0"]["hand"]), 4)
        self.assertIn(3, state["players"]["neighbor-0"]["hand"])
        self.assertEqual(state["phase"], "place")
        self.assertEqual(state["turn_number"], 1)
        self.assertEqual(sorted(all_tiles(state)), list(range(49)))
        self.assertEqual(state["history"][-1]["tiles"], [2, 0, 1])

    def test_retire_only_without_placement_and_last_retirement_wins_tie(self):
        state = ending_state()
        self.apply(state, {"type": "place", "tile": 8, "x": 1, "y": 0})
        self.apply(state, {"type": "place", "tile": 16, "x": 2, "y": 0})
        self.assertEqual(state["phase"], "final_review")
        self.assertEqual(state["winner"], ["neighbor-1"])
        self.assertFalse(state["game_over"])
        self.assertEqual(state["ranking"], ["neighbor-1", "neighbor-0"])
        self.apply(state, {"type": "acknowledge"}, "neighbor-0")
        self.assertFalse(state["game_over"])
        self.reject(state, {"type": "acknowledge"}, "neighbor-0")
        self.apply(state, {"type": "acknowledge"}, "neighbor-1")
        self.assertTrue(state["game_over"])
        self.assertTrue(state["results_ready"])
        self.reject(state, {"type": "acknowledge"}, "neighbor-1")
        state = ending_state()
        state["players"]["neighbor-0"]["hand"] = [1]
        self.apply(state, {"type": "pass"})
        self.assertTrue(state["players"]["neighbor-0"]["retired"])
        self.assertEqual(state["current_turn"], "neighbor-1")

    def test_public_view_redacts_shapes_bag_seed_and_future_stack_tops(self):
        state = fresh()
        view = Town77Game.get_public_view(state, "neighbor-0")
        self.assertIsNone(view["players"][1]["hand"])
        self.assertEqual(view["players"][1]["colors"], sorted(tile // 7 for tile in state["players"]["neighbor-1"]["hand"]))
        self.assertFalse({"bag", "seed", "shuffle_number"} & view.keys())
        view["board"][0][0] = 99
        self.assertNotEqual(state["board"][0][0], 99)
        spectator = Town77Game.get_public_view(state, "spectator")
        self.assertEqual(spectator["hand"], [])
        self.assertTrue(all(player["hand"] is None for player in spectator["players"]))
        solo = fresh(1)
        view = Town77Game.get_public_view(solo, "neighbor-0")
        self.assertTrue(all(set(pile) == {"top", "count"} for pile in view["piles"]))

    def test_solo_only_stack_tops_and_correct_final_score(self):
        state = fresh(1)
        before = copy.deepcopy(state)
        hidden = state["piles"][0][0]
        self.reject(state, {"type": "place", "tile": hidden, "x": 0, "y": 0})
        top = state["piles"][1][-1]
        self.apply(state, {"type": "place", "tile": top, "x": 0, "y": 0})
        self.assertEqual(len(state["piles"][1]), len(before["piles"][1]) - 1)
        self.assertEqual(state["phase"], "place")
        for _ in range(60):
            if state["phase"] == "final_review":
                break
            self.apply(state, Town77Game.bot_move(state, "neighbor-0"))
        self.assertEqual(state["phase"], "final_review")
        view = Town77Game.get_public_view(state, "neighbor-0")
        self.assertEqual(view["score"], sum(player["placed"] for player in state["players"].values()))
        self.assertGreater(view["score"], 15)
        self.assertEqual(sorted(all_tiles(state)), list(range(49)))

    def test_save_load_and_ai_observation_invariance(self):
        state = fresh()
        payload = json.loads(json.dumps(Town77Game.serialize(state)))
        restored = Town77Game.deserialize(payload)
        self.assertEqual(state, restored)
        self.assertEqual(Town77Game.bot_move(state, "neighbor-0"), Town77Game.bot_move(restored, "neighbor-0"))
        altered = copy.deepcopy(state)
        altered["seed"] = 999
        altered["bag"].reverse()
        altered["players"]["neighbor-1"]["hand"] = [tile // 7 * 7 + (tile + 1) % 7 for tile in altered["players"]["neighbor-1"]["hand"]]
        self.assertEqual(Town77Game.get_public_view(state, "neighbor-0"), Town77Game.get_public_view(altered, "neighbor-0"))
        self.assertEqual(Town77Game.bot_move(state, "neighbor-0"), Town77Game.bot_move(altered, "neighbor-0"))
        solo = fresh(1)
        altered = copy.deepcopy(solo)
        for pile in altered["piles"]:
            pile[:-1] = reversed(pile[:-1])
        self.assertEqual(Town77Game.bot_move(solo, "neighbor-0"), Town77Game.bot_move(altered, "neighbor-0"))
        restored["bag"].clear()
        self.assertTrue(state["bag"])

    def test_ai_finishes_all_player_counts_with_legal_moves(self):
        for count in range(1, 6):
            for seed in (1, 17, 81):
                state = fresh(count, seed)
                for step in range(250):
                    if state["game_over"]:
                        break
                    player = next(player for player in state["turn_order"] if Town77Game.get_legal_actions(state, player))
                    before = copy.deepcopy(state)
                    move = Town77Game.bot_move(state, player)
                    self.assertEqual(state, before)
                    Draft7Validator(ACTION_SCHEMA).validate(move)
                    self.apply(state, move, player)
                    self.assertEqual(sorted(all_tiles(state)), list(range(49)))
                self.assertTrue(state["game_over"], (count, seed, step))

    def test_ai_reduces_stranded_tiles_and_uses_exchange_to_escape(self):
        state = ending_state()
        state["phase"] = "discard"
        state["players"]["neighbor-0"]["hand"] = [1, 8, 16, 24]
        self.assertEqual(Town77Game.bot_move(state, "neighbor-0"), {"type": "discard", "tile": 1})
        state["phase"] = "place"
        state["players"]["neighbor-0"]["hand"] = [1, 2, 3, 8]
        move = Town77Game.bot_move(state, "neighbor-0")
        self.assertEqual(move, {"type": "exchange", "tiles": [1, 2, 3]})
        self.assertIsNone(choose_move({"legal_actions": []}))

    def test_ai_does_not_loop_when_exchange_cannot_change_dead_hand(self):
        state = ending_state()
        state["players"]["neighbor-0"]["hand"] = [1, 2, 3]
        state["bag"] = []
        self.assertEqual(Town77Game.bot_move(state, "neighbor-0")["type"], "exchange")
        self.apply(state, Town77Game.bot_move(state, "neighbor-0"))
        self.assertEqual(state["history"][-1]["turn"], state["turn_number"])
        self.assertEqual(Town77Game.bot_move(state, "neighbor-0"), {"type": "pass"})


class Town77RoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio = app.sio
        self.previous_dir = app.DATA_DIR
        self.previous_rooms = dict(app.ROOMS)
        self.previous_sessions = dict(app.SESSIONS)
        app.sio = DummySio()
        app.ROOMS.clear()
        app.SESSIONS.clear()
        self.temp = tempfile.TemporaryDirectory()
        app.DATA_DIR = self.temp.name
        for index in range(2):
            await app.on_room_create(f"socket-{index}", {"name": f"Neighbor {index + 1}", "game_type": "town77"})
        self.room = app.ROOMS[app.SESSIONS["socket-0"]["room_id"]]
        await app.on_room_join("socket-1", {"room_id": self.room.room_id, "name": "Neighbor Two"})
        self.room.game_state = Town77Game.init_game({"seed": 17}, [vars(player) for player in self.room.players])
        self.room.status = "in_game"

    async def asyncTearDown(self):
        app.sio = self.previous_sio
        app.DATA_DIR = self.previous_dir
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def test_catalog_and_recipient_specific_views(self):
        entry = next(entry for entry in await app.api_list_games() if entry["game_id"] == "town77")
        self.assertTrue(entry["has_strategic_ai"])
        self.assertEqual((entry["min_players"], entry["max_players"]), (1, 5))
        await app._emit_game_state(self.room)
        messages = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(len(messages), 2)
        for entry in messages:
            player_id = app.SESSIONS[entry["to"]]["player_id"]
            self.assertEqual(entry["payload"]["view"]["hand"], self.room.game_state["players"][player_id]["hand"])
            self.assertTrue(all(player["hand"] is None for player in entry["payload"]["view"]["players"] if player["player_id"] != player_id))
        self.assertEqual(app._public_bot_action("town77", {"type": "discard", "tile": 19}), {"type": "discard"})
        self.room.game_config = {"seed": 17}
        await app._emit_room_state(self.room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])

    async def test_private_save_and_credentialed_cold_reconnect(self):
        self.room.auto_save = True
        app._save_room_state(self.room)
        with self.assertRaises(HTTPException) as caught:
            await app.download_room_save(self.room.room_id)
        self.assertEqual(caught.exception.status_code, 403)
        saved = copy.deepcopy(self.room.game_state)
        player = self.room.players[0]
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_load("outsider", {"source_room_id": self.room.room_id})
        self.assertFalse(app.ROOMS)
        with patch.object(app, "_maybe_run_bots", return_value=None):
            await app.on_room_reconnect("wrong", {"room_id": self.room.room_id, "player_id": player.player_id, "reconnect_token": "wrong"})
            self.assertFalse(app.ROOMS)
            await app.on_room_reconnect("back", {"room_id": self.room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertEqual(app.ROOMS[self.room.room_id].game_state, saved)

    async def test_socket_validation_and_review_gate(self):
        state = self.room.game_state
        current = state["current_turn"]
        sid = next(player.socket_id for player in self.room.players if player.player_id == current)
        before = copy.deepcopy(state)
        move = legal_placements(state["board"], state["players"][current]["hand"])[0]
        for bypass in (False, True):
            await app.on_game_action(sid, {"skip_validation": bypass, "action": {**move, "x": True}})
            self.assertEqual(state, before)
        for _ in range(150):
            if state["phase"] == "final_review":
                break
            current = state["current_turn"]
            action = Town77Game.bot_move(state, current)
            socket_id = next(player.socket_id for player in self.room.players if player.player_id == current)
            await app.on_game_action(socket_id, {"action": action})
        self.assertEqual(self.room.status, "in_game")
        for player in self.room.players:
            await app.on_game_action(player.socket_id, {"action": {"type": "acknowledge"}})
        self.assertTrue(state["game_over"])
        self.assertEqual(self.room.status, "game_over")

    async def test_final_bot_confirmation_updates_room_status(self):
        first, second = self.room.players
        state = Town77Game.init_game({"seed": 17}, [vars(player) for player in self.room.players])
        state["phase"] = "final_review"
        state["current_turn"] = None
        state["ranking"] = [first.player_id, second.player_id]
        state["winner"] = [first.player_id]
        state["acknowledged"] = [first.player_id]
        second.is_bot = True
        self.room.game_state = state
        app.sio.emits.clear()
        await app._maybe_run_bots(self.room)
        for _ in range(100):
            if not self.room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertTrue(state["game_over"])
        self.assertFalse(self.room.bot_running)
        self.assertTrue(any(entry["event"] == "room:state" and entry["payload"]["status"] == "game_over" for entry in app.sio.emits))


if __name__ == "__main__":
    unittest.main()
