import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.mall_of_horror import MallOfHorrorGame as Game
from game.mall_of_horror_ai import choose_action
from tests.test_room_session import DummySio


class MallOfHorrorIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self):
        await app.on_room_create("s0", {"name":"Survivor", "game_type":"mall_of_horror", "config":{"seed":140}, "auto_save":True})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in (1, 2):
            await app.on_room_join(f"s{i}", {"room_id":room.room_id, "name":f"Survivor {i}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_and_private_broadcasts(self):
        row = next(g for g in await app.api_list_games() if g["game_id"] == "mall_of_horror")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("僵尸商场", 3, 6))
        self.assertEqual({t["id"] for t in row["tags"]}, {"ameritrash", "bluffing"})
        room = await self.make_room()
        state = room.game_state
        pid = state["current_turn"]
        player = next(p for p in room.players if p.player_id == pid)
        app.sio.emits.clear()
        await app.on_game_action(player.socket_id, {"action": choose_action(Game.get_public_view(state, pid))})
        messages = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for message in messages:
            view = message["payload"]["view"]
            who = next(p.player_id for p in room.players if p.socket_id == message["to"])
            self.assertEqual([c["id"] for c in view["hand"]], [c["id"] for c in state["players"][who]["hand"]])
            self.assertNotIn("deck", view)
            self.assertNotIn("seed", view)
            self.assertEqual(message["payload"]["events"], [])
        await app._emit_room_state(room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])
        self.assertEqual(app._public_bot_action("mall_of_horror", {"type":"vote", "target_id":"secret"}), {"type":"vote"})

    async def test_action_validation_cannot_be_bypassed(self):
        room = await self.make_room()
        state = room.game_state
        move = choose_action(Game.get_public_view(state, state["current_turn"]))
        for skip in (False, True):
            before = copy.deepcopy(state)
            await app.on_game_action("s0", {"skip_validation":skip, "action":{**move, "character_id":[]}})
            self.assertEqual(state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_active_save_protection_and_authenticated_cold_reconnect(self):
        room = await self.make_room()
        player = room.players[0]
        expected = Game.get_public_view(room.game_state, player.player_id)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id":room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        credentials = {"room_id":room.room_id, "player_id":player.player_id, "reconnect_token":player.reconnect_token}
        await app.on_room_reconnect("bad", {**credentials, "reconnect_token":"wrong"})
        self.assertEqual(app.ROOMS, {})
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock) as bots:
            await app.on_room_reconnect("restored", credentials)
            bots.assert_awaited_once()
        restored = app.ROOMS[room.room_id]
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id), expected)
        self.assertEqual([p.socket_id for p in restored.players if p.connected], ["restored"])
