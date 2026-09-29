import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.skull_king import SkullKingGame as Game
from tests.test_room_session import DummySio
from tests.test_skull_king import action


class SkullKingIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def make_room(self, count=3):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "skull_king",
                                        "config": {"seed": 135}, "auto_save": True})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in range(1, count):
            await app.on_room_join(f"s{i}", {"room_id": room.room_id, "name": f"Captain {i}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_broadcast_and_secret_bid(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "skull_king")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("骷髅王", 2, 8))
        self.assertIn("trick_taking", {tag["id"] for tag in row["tags"]})
        room = await self.make_room()
        player = room.players[0]
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action(room.game_state, "bid", bid=1)})
        messages = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for message in messages:
            payload = message["payload"]
            own = message["to"] == "s0"
            row = next(p for p in payload["view"]["players"] if p["player_id"] == player.player_id)
            self.assertEqual(row["bid"], 1 if own else None)
            self.assertTrue(all("bid" not in event["payload"] for event in payload["events"]))
            self.assertNotIn("seed", payload["view"]["config"])
        await app._emit_room_state(room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])
        self.assertEqual(app._public_bot_action("skull_king", action(room.game_state, "bid", bid=1)), {"type": "bid"})

    async def test_schema_bypass_cannot_change_state(self):
        room = await self.make_room()
        for skip in (True, False):
            before = copy.deepcopy(room.game_state)
            await app.on_game_action("s0", {"skip_validation": skip, "action": action(room.game_state, "bid", bid=True)})
            self.assertEqual(room.game_state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_active_save_is_private_and_authenticated_cold_reconnect_works(self):
        room = await self.make_room()
        player = room.players[0]
        await app.on_game_action("s0", {"action": action(room.game_state, "bid", bid=1)})
        expected = Game.get_public_view(room.game_state, player.player_id)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id": room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        credentials = {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token}
        await app.on_room_reconnect("bad", {**credentials, "reconnect_token": "wrong"})
        self.assertEqual(app.ROOMS, {})
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock) as resume:
            await app.on_room_reconnect("new", credentials)
            resume.assert_awaited_once()
        restored = app.ROOMS[room.room_id]
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id), expected)
        self.assertEqual([p.socket_id for p in restored.players if p.connected], ["new"])
        self.assertTrue(all(p.seat_claimed for p in restored.players))

    async def test_completed_save_can_be_downloaded(self):
        room = await self.make_room()
        while not room.game_state["game_over"]:
            state = room.game_state
            pid = next(pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid))
            move = Game.bot_move(state, pid)
            move.pop("delay_ms")
            self.assertIsNone(Game.apply_action(state, pid, move)[1])
        app._save_room_state(room)
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))

    async def test_invalid_cold_reconnect_is_read_only(self):
        self.assertIsNone(app._restore_skull_king_for_reconnect("../outside", "id", "token"))
        self.assertIsNone(app._restore_skull_king_for_reconnect("safe", "id", []))
        with patch.object(app, "_load_latest_save", return_value={"game_type": "cabo"}):
            self.assertIsNone(app._restore_skull_king_for_reconnect("safe", "id", "token"))
        self.assertEqual(app.ROOMS, {})
