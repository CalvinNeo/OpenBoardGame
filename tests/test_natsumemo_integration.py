import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.natsumemo import NatsumemoGame as Game
from tests.test_natsumemo import action, finish
from tests.test_room_session import DummySio


class NatsumemoIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
        await app.on_room_create("s0", {"name": "Alice", "game_type": "natsumemo", "config": {"seed": 142}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in range(1, 3):
            await app.on_room_join(f"s{i}", {"room_id": room.room_id, "name": f"Friend {i}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def choose_roles(self, room):
        for index, player in enumerate(room.players):
            await app.on_game_action(player.socket_id, {"action": action(
                room.game_state, "choose_role", role="boy" if index % 2 == 0 else "girl")})

    async def test_catalog_seed_and_bot_log_redaction(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "natsumemo")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("暑假日记", 3, 6))
        self.assertIn("filler", {tag["id"] for tag in row["tags"]})
        room = await self.make_room()
        await app._emit_room_state(room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])
        for kind, fields in (("respond", {"attend": True}), ("allocate", {"hearts": {"secret": 2}}),
                             ("choose_die", {"value": 6})):
            self.assertEqual(app._public_bot_action("natsumemo", action(room.game_state, kind, **fields)), {"type": kind})

    async def test_simultaneous_actions_only_reveal_own_decision(self):
        room = await self.make_room()
        await self.choose_roles(room)
        speaker = next(player for player in room.players if player.player_id == room.game_state["speaker"])
        await app.on_game_action(speaker.socket_id, {"action": action(room.game_state, "propose", day=0)})
        player = room.players[0]
        app.sio.emits.clear()
        await app.on_game_action(player.socket_id, {"action": action(room.game_state, "respond", attend=True)})
        messages = [event for event in app.sio.emits if event["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for message in messages:
            view = message["payload"]["view"]
            self.assertEqual(view["private"]["choice"], True if message["to"] == player.socket_id else None)
            self.assertNotIn("base_seed", view)
            self.assertNotIn("decks", view)
            self.assertIsNone(view["result"])
            self.assertTrue(all("hearts" not in other and "homework" not in other for other in view["players"]))
            self.assertEqual(message["payload"]["events"], [{"type": "natsumemo:updated", "payload": {"phase": "respond"}}])

    async def test_validation_bypass_and_stale_requests_are_atomic(self):
        room = await self.make_room()
        for skip in (False, True):
            for extra in ({"step": True}, {"role": []}, {"game_token": "previous-game"}):
                before = copy.deepcopy(room.game_state)
                bad = {**action(room.game_state, "choose_role", role="boy"), **extra}
                await app.on_game_action("s0", {"skip_validation": skip, "action": bad})
                self.assertEqual(room.game_state, before)
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_active_save_is_private_and_cold_reconnect_restores_diary(self):
        room = await self.make_room()
        await self.choose_roles(room)
        player = room.players[0]
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

    async def test_hot_reconnect_transfers_seat_and_preserves_private_choice(self):
        room = await self.make_room()
        await self.choose_roles(room)
        speaker = next(p for p in room.players if p.player_id == room.game_state["speaker"])
        await app.on_game_action(speaker.socket_id, {"action": action(room.game_state, "propose", day=0)})
        player = room.players[0]
        await app.on_game_action(player.socket_id, {"action": action(room.game_state, "respond", attend=False)})
        before = Game.get_public_view(room.game_state, player.player_id)
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_reconnect("replacement", {"room_id": room.room_id,
                "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertNotIn("s0", app.SESSIONS)
        self.assertEqual(player.socket_id, "replacement")
        self.assertEqual(Game.get_public_view(room.game_state, player.player_id), before)

    async def test_finished_save_is_downloadable(self):
        room = await self.make_room()
        finish(room.game_state)
        app._save_room_state(room)
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))


if __name__ == "__main__":
    unittest.main()
