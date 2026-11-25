import asyncio
import copy
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import app
from game import RummikubGame
from tests.test_room_session import DummySio


class RummikubRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio = app.sio
        self.original_data_dir = app.DATA_DIR
        self.original_rooms = dict(app.ROOMS)
        self.original_sessions = dict(app.SESSIONS)
        self.directory = TemporaryDirectory()
        app.sio = DummySio()
        app.DATA_DIR = self.directory.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("sid0", {"name": "Alice", "game_type": "rummikub"})
        self.room_id = app.SESSIONS["sid0"]["room_id"]
        self.room = app.ROOMS[self.room_id]
        await app.on_room_join("sid1", {"room_id": self.room_id, "name": "Bob"})
        self.first = self.room.players[0].player_id
        self.second = self.room.players[1].player_id
        await app.on_room_ready("sid0", {"ready": True})
        await app.on_room_ready("sid1", {"ready": True})
        await app.on_room_start("sid0", {"config": {"rounds": 2, "seed": 7, "joker_rule": "free"}})
        self.assertEqual(self.room.status, "in_game")

    async def asyncTearDown(self):
        await asyncio.sleep(0)
        app.sio = self.original_sio
        app.DATA_DIR = self.original_data_dir
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.directory.cleanup()

    async def test_player_specific_views_and_trial_broadcast(self):
        self.assertEqual(self.room.game_state["config"]["joker_rule"], "free")
        tile = self.room.game_state["players"][self.first]["hand"][0]
        await app.on_game_action("sid0", {"action": {"type": "preview", "turn": 1, "table": [[tile]]}})
        self.assertEqual(self.room.game_state["draft"], [[tile]])
        for socket_id, player_id in (("sid0", self.first), ("sid1", self.second)):
            payload = [entry["payload"] for entry in app.sio.emits if entry["event"] == "game:state" and entry["to"] == socket_id][-1]
            self.assertEqual(payload["game_type"], "rummikub")
            self.assertEqual(payload["view"]["joker_rule"], "free")
            self.assertEqual(payload["view"]["draft"], [[tile]])
            for player in payload["view"]["players"]:
                self.assertEqual(player["hand"] is not None, player["player_id"] == player_id)

    async def test_rejected_action_does_not_change_version_or_state(self):
        before = copy.deepcopy(self.room.game_state)
        version = self.room.state_version
        for sid, action in (("sid1", {"type": "draw", "turn": 1}),
                            ("sid0", {"type": "commit", "turn": 1, "table": []}),
                            ("sid0", {"type": "preview", "turn": 1, "table": [["fake"]]})):
            await app.on_game_action(sid, {"action": action})
            self.assertEqual(self.room.game_state, before)
            self.assertEqual(self.room.state_version, version)

    async def test_save_and_authenticated_reconnect_preserve_trial(self):
        self.room.auto_save = True
        tile = self.room.game_state["players"][self.first]["hand"][0]
        await app.on_game_action("sid0", {"action": {"type": "preview", "turn": 1, "table": [[tile]]}})
        self.assertTrue(list(Path(self.directory.name, self.room_id).glob("*.save")))
        saved = app._load_latest_save(self.room_id)
        self.assertEqual(RummikubGame.deserialize(saved["game_state"]), self.room.game_state)
        before = copy.deepcopy(self.room.game_state)
        player = self.room.players[0]
        await app.on_room_reconnect("reconnected", {"room_id": self.room_id, "player_id": self.first,
                                                   "reconnect_token": player.reconnect_token})
        self.assertEqual(self.room.game_state, before)
        payload = [entry["payload"] for entry in app.sio.emits if entry["event"] == "game:state" and entry["to"] == "reconnected"][-1]
        self.assertEqual(payload["view"]["draft"], [[tile]])
        self.assertEqual(payload["view"]["players"][0]["hand"], before["players"][self.first]["hand"])

    async def test_draw_advances_once_and_rejects_replay(self):
        action = {"type": "draw", "turn": 1}
        await app.on_game_action("sid0", {"action": action})
        self.assertEqual(self.room.game_state["turn"], 2)
        self.assertEqual(len(self.room.game_state["players"][self.first]["hand"]), 15)
        version = self.room.state_version
        await app.on_game_action("sid0", {"action": action})
        self.assertEqual(self.room.state_version, version)


if __name__ == "__main__":
    unittest.main()
