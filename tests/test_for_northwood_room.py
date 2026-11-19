import asyncio
import copy
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import app
from game import ForNorthwoodGame
from tests.test_room_session import DummySio


class NorthwoodRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio = app.sio
        self.original_data_dir = app.DATA_DIR
        self.original_rooms = dict(app.ROOMS)
        self.original_sessions = dict(app.SESSIONS)
        self.temp_dir = TemporaryDirectory()
        app.sio = DummySio()
        app.DATA_DIR = self.temp_dir.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("envoy-socket", {"name": "Envoy", "game_type": "for_northwood"})
        self.room_id = app.SESSIONS["envoy-socket"]["room_id"]
        self.room = app.ROOMS[self.room_id]
        self.player_id = self.room.players[0].player_id

    async def asyncTearDown(self):
        await asyncio.sleep(0)
        app.sio = self.original_sio
        app.DATA_DIR = self.original_data_dir
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.temp_dir.cleanup()

    async def start(self, config=None):
        await app.on_room_start("envoy-socket", {"config": config or {}})
        self.assertEqual(self.room.status, "in_game")

    async def act(self, action):
        before = self.room.state_version
        await app.on_game_action("envoy-socket", {"room_id": self.room_id, "action": action})
        self.assertEqual(self.room.state_version, before + 1, app.sio.emits[-3:])

    async def test_one_player_limit_blocks_bot_and_second_human(self):
        await app.on_room_add_bot("envoy-socket", {})
        self.assertEqual(len(self.room.players), 1)
        self.assertTrue(any(entry["event"] == "system:error" and "full" in entry["payload"]["message"] for entry in app.sio.emits))
        await app.on_room_join("second-socket", {"room_id": self.room_id, "name": "Other"})
        self.assertNotIn("second-socket", app.SESSIONS)
        self.assertEqual(len(self.room.players), 1)

    async def test_config_and_state_envelope(self):
        await self.start({"setup": "standard", "goal": 18})
        self.assertEqual(self.room.game_state["config"], {"setup": "standard", "goal": 18})
        payload = [entry["payload"] for entry in app.sio.emits if entry["event"] == "game:state"][-1]
        self.assertEqual(payload["game_type"], "for_northwood")
        self.assertEqual(payload["view"]["player_id"], self.player_id)
        self.assertEqual(len(payload["view"]["hand"]), 8)
        self.assertNotIn("deck", payload["view"])
        self.assertEqual(payload["view"]["phase"], "choose_fief")

    async def test_invalid_schema_and_wrong_phase_do_not_advance(self):
        await self.start()
        state = copy.deepcopy(self.room.game_state)
        version = self.room.state_version
        for action in ({"type": "choose_fief", "fief": 99}, {"type": "play", "card": state["hand"][0]}, {"type": "use_ability", "slot": False}):
            await app.on_game_action("envoy-socket", {"action": action})
            self.assertEqual(self.room.game_state, state)
            self.assertEqual(self.room.state_version, version)

    async def test_reconnect_restores_same_hand_and_pending_ability(self):
        await self.start()
        await self.act({"type": "choose_fief", "fief": 4})
        await self.act({"type": "start_visit"})
        await self.act({"type": "use_ability", "slot": 2})
        before = copy.deepcopy(self.room.game_state)
        player = self.room.players[0]
        await app.on_room_reconnect("new-socket", {
            "room_id": self.room_id,
            "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        self.assertNotIn("envoy-socket", app.SESSIONS)
        self.assertEqual(self.room.game_state, before)
        self.assertEqual(player.socket_id, "new-socket")
        emitted = [entry for entry in app.sio.emits if entry["event"] == "game:state" and entry["to"] == "new-socket"][-1]
        self.assertEqual(emitted["payload"]["view"]["hand"], before["hand"])
        self.assertEqual(emitted["payload"]["view"]["pending"], before["pending"])

    async def test_disk_save_and_authenticated_cold_reconnect_preserve_ability_step(self):
        self.room.auto_save = True
        await self.start()
        await self.act({"type": "choose_fief", "fief": 3})
        await self.act({"type": "start_visit"})
        await self.act({"type": "use_ability", "slot": 2})
        before = copy.deepcopy(self.room.game_state)
        self.assertTrue(list(Path(self.temp_dir.name, self.room_id).glob("*.save")))
        payload = app._load_latest_save(self.room_id)
        self.assertEqual(payload["game_state"], before)
        player = self.room.players[0]
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(self.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("loader", {"source_room_id": self.room_id})
            result = [entry["payload"] for entry in app.sio.emits if entry["event"] == "room:load_result"][-1]
            self.assertFalse(result["ok"])
        await app.on_room_reconnect("wrong-token", {"room_id": self.room_id, "player_id": player.player_id, "reconnect_token": "wrong"})
        self.assertNotIn(self.room_id, app.ROOMS)
        await app.on_room_reconnect("cold-reconnect", {"room_id": self.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        restored = app.ROOMS[self.room_id]
        self.assertEqual(restored.game_state, before)
        self.assertEqual(restored.players[0].player_id, self.player_id)
        self.assertEqual(restored.status, "in_game")
        emitted = [entry for entry in app.sio.emits if entry["event"] == "game:state" and entry["to"] == "cold-reconnect"][-1]
        self.assertEqual(emitted["payload"]["view"]["pending"], before["pending"])

    async def test_completed_disk_save_can_be_downloaded_and_loaded(self):
        self.room.auto_save = True
        await self.start()
        self.room.game_state["game_over"] = True
        self.room.game_state["phase"] = "game_over"
        self.room.status = "game_over"
        app._save_room_state(self.room)
        before = copy.deepcopy(self.room.game_state)
        response = await app.download_room_save(self.room_id)
        self.assertTrue(Path(response.path).is_file())
        await app.on_room_load("loader", {"source_room_id": self.room_id})
        result = [entry["payload"] for entry in app.sio.emits if entry["event"] == "room:load_result"][-1]
        self.assertTrue(result["ok"], result)
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, before)
        self.assertEqual(restored.players[0].player_id, self.player_id)
        self.assertEqual(restored.status, "game_over")

    async def test_complete_game_through_socket_handler(self):
        await self.start()
        steps = 0
        while not self.room.game_state["game_over"]:
            action = ForNorthwoodGame.bot_move(self.room.game_state, self.player_id)
            self.assertIsNotNone(action)
            await self.act(action)
            steps += 1
            self.assertLess(steps, 500)
        self.assertEqual(self.room.status, "game_over")
        self.assertEqual(len(self.room.game_state["history"]), 8)
        self.assertEqual(self.room.game_state["scores"][self.player_id], self.room.game_state["stars"])


if __name__ == "__main__":
    unittest.main()
