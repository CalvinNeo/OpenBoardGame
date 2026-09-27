import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.hive import HiveGame as Game, legal_moves
from tests.test_room_session import DummySio


class HiveIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = "game_over"
        for _ in range(200):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(0.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def room(self, bot=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "hive", "config": {"ai_difficulty": "easy"}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        if bot:
            await app.on_room_add_bot("s0", {})
        else:
            await app.on_room_join("s1", {"room_id": room.room_id, "name": "Bob"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_two_seats_and_action_broadcast(self):
        game = next(g for g in await app.api_list_games() if g["game_id"] == "hive")
        self.assertEqual((game["name_zh"], game["min_players"], game["max_players"]), ("昆虫棋", 2, 2))
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": legal_moves(room.game_state)[0]})
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        self.assertEqual(room.game_state["ply"], 1)
        self.assertTrue(all(m["payload"]["view"]["board"] for m in updates))
        self.assertEqual(next(m for m in updates if m["to"] == "s0")["payload"]["view"]["legal_moves"], [])

    async def test_bot_takes_one_turn_and_waits_for_human(self):
        room = await self.room(bot=True)
        await app.on_game_action("s0", {"action": legal_moves(room.game_state)[0]})
        for _ in range(400):
            if not room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(room.game_state["ply"], 2)
        self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)

    async def test_reconnect_and_serialized_room_preserve_board(self):
        room = await self.room()
        await app.on_game_action("s0", {"action": legal_moves(room.game_state)[0]})
        before = copy.deepcopy(room.game_state)
        human = room.players[0]
        await app.disconnect("s0")
        await app.on_room_reconnect("new", {"room_id": room.room_id, "player_id": human.player_id, "reconnect_token": human.reconnect_token})
        self.assertEqual(room.game_state, before)
        update = next(m for m in app.sio.emits if m["event"] == "game:state" and m["to"] == "new")
        self.assertEqual(update["payload"]["view"]["board"], Game.get_public_view(before, human.player_id)["board"])
        saved = json.loads(json.dumps(Game.serialize(room.game_state)))
        restored = Game.deserialize(saved)
        self.assertEqual(legal_moves(restored), legal_moves(before))
        room.auto_save = True
        app._save_room_state(room)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        response = next(m["payload"] for m in app.sio.emits if m["event"] == "room:load_result" and m["to"] == "loader")
        self.assertTrue(response["ok"])
        loaded_room = app.ROOMS[response["room_id"]]
        self.assertEqual(loaded_room.game_state, before)
        self.assertEqual(loaded_room.game_config, before["config"])

    async def test_skip_schema_cannot_allow_illegal_move(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {"type": "place", "piece": "queen", "to": [True, 0]}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(m["event"] == "system:error" for m in app.sio.emits))

    async def test_agreed_draw_preserves_final_board(self):
        room = await self.room()
        await app.on_game_action("s0", {"action": legal_moves(room.game_state)[0]})
        before = copy.deepcopy(room.game_state["board"])
        await app.on_game_action("s1", {"action": {"type": "offer_draw"}})
        await app.on_game_action("s0", {"action": {"type": "accept_draw"}})
        self.assertEqual(room.status, "game_over")
        self.assertEqual(room.game_state["board"], before)


if __name__ == "__main__":
    unittest.main()
