import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.startups import StartupsGame as Game
from tests.test_room_session import DummySio
from tests.test_startups import action


class StartupsIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear(); app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear(); app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear(); app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "startups", "config": {"seed": 136}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in range(1, 3):
            await app.on_room_join(f"s{i}", {"room_id": room.room_id, "name": f"Investor {i}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_private_broadcast_and_seed_redaction(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "startups")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("初创公司", 3, 7))
        self.assertIn("filler", {tag["id"] for tag in row["tags"]})
        room = await self.make_room()
        pid = room.game_state["current_turn"]
        player = next(player for player in room.players if player.player_id == pid)
        app.sio.emits.clear()
        await app.on_game_action(player.socket_id, {"action": action(room.game_state, "draw")})
        messages = [event for event in app.sio.emits if event["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for message in messages:
            view = message["payload"]["view"]
            self.assertEqual(len(view["hand"]), 4 if message["to"] == player.socket_id else 3)
            self.assertTrue(all(p["hand"] is None for p in view["players"]))
            self.assertNotIn("seed", view["config"])
            for event in message["payload"]["events"]:
                self.assertNotIn("card", event.get("payload", {}))
        await app._emit_room_state(room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])
        self.assertEqual(app._public_bot_action("startups", action(room.game_state, "invest", card_id="secret")), {"type": "invest"})

    async def test_validation_bypass_still_rejects_bad_requests(self):
        room = await self.make_room()
        player = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        for skip in (False, True):
            before = copy.deepcopy(room.game_state)
            bad = {**action(room.game_state, "draw"), "turn_number": True}
            await app.on_game_action(player.socket_id, {"skip_validation": skip, "action": bad})
            self.assertEqual(room.game_state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_live_and_cold_saves_are_private_and_token_restores_seat(self):
        room = await self.make_room()
        player = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        await app.on_game_action(player.socket_id, {"action": action(room.game_state, "draw")})
        expected = Game.get_public_view(room.game_state, player.player_id)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear(); app.SESSIONS.clear()
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

    async def test_finished_save_is_downloadable(self):
        room = await self.make_room()
        while not room.game_state["game_over"]:
            state = room.game_state
            pid = state["current_turn"]
            payload = Game.bot_move(state, pid); payload.pop("delay_ms")
            self.assertIsNone(Game.apply_action(state, pid, payload)[1])
        app._save_room_state(room)
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))

    async def test_hot_reconnect_transfers_current_seat_and_preserves_hand(self):
        room = await self.make_room(); player = room.players[0]
        before = Game.get_public_view(room.game_state, player.player_id)
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_reconnect("replacement", {"room_id": room.room_id,
                "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertNotIn("s0", app.SESSIONS)
        self.assertEqual(player.socket_id, "replacement")
        self.assertEqual(Game.get_public_view(room.game_state, player.player_id), before)


if __name__ == "__main__":
    unittest.main()
