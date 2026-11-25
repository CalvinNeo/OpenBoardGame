import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game.hot_streak import HotStreakGame
from tests.test_room_session import DummySio


class HotStreakRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio = app.sio
        self.original_data = app.DATA_DIR
        self.original_rooms = dict(app.ROOMS)
        self.original_sessions = dict(app.SESSIONS)
        self.directory = TemporaryDirectory()
        app.sio = DummySio()
        app.DATA_DIR = self.directory.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("alice", {"name": "Alice", "game_type": "hot_streak"})
        self.room_id = app.SESSIONS["alice"]["room_id"]
        self.room = app.ROOMS[self.room_id]
        await app.on_room_join("bob", {"room_id": self.room_id, "name": "Bob"})
        for socket_id in ("alice", "bob"):
            await app.on_room_ready(socket_id, {"ready": True})
        await app.on_room_start("alice", {"config": {}})
        self.room.game_state.update(phase="game_over", game_over=True, race_number=3)
        self.room.status = "game_over"

    async def asyncTearDown(self):
        app.sio = self.original_sio
        app.DATA_DIR = self.original_data
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.directory.cleanup()

    async def test_final_confirmations_broadcast_save_reconnect_and_restart(self):
        self.room.auto_save = True
        version = self.room.state_version
        await app.on_game_action("alice", {"action": {"type": "play_again"}})
        self.assertEqual(self.room.status, "game_over")
        self.assertEqual(self.room.state_version, version + 1)
        views = [entry["payload"]["view"] for entry in app.sio.emits
                 if entry["event"] == "game:state"]
        self.assertEqual(views[-1]["replay_progress"], {"done": 1, "total": 2})

        saved = app._load_latest_save(self.room_id)
        self.assertEqual(saved["room_status"], "game_over")
        self.assertEqual(saved["game_state"]["replay_ready"], self.room.game_state["replay_ready"])
        alice_id = app.SESSIONS["alice"]["player_id"]
        player = next(player for player in self.room.players if player.player_id == alice_id)
        await app.on_room_reconnect("alice-new", {
            "room_id": self.room_id, "player_id": alice_id,
            "reconnect_token": player.reconnect_token,
        })
        view = HotStreakGame.get_public_view(self.room.game_state, alice_id)
        self.assertEqual(view["legal_actions"], [])
        self.assertEqual(view["replay_progress"]["done"], 1)

        before = copy.deepcopy(self.room.game_state)
        version = self.room.state_version
        await app.on_game_action("alice-new", {"action": {"type": "play_again"}})
        self.assertEqual(self.room.game_state, before)
        self.assertEqual(self.room.state_version, version)

        await app.on_game_action("bob", {"action": {"type": "play_again"}})
        self.assertEqual(self.room.status, "in_game")
        self.assertEqual(self.room.game_state["phase"], "betting")
        self.assertEqual(self.room.game_state["game_index"], 2)
        states = [entry["payload"] for entry in app.sio.emits if entry["event"] == "room:state"]
        self.assertEqual(states[-1]["status"], "in_game")
        self.assertTrue(any(entry["event"] == "room:list_update" for entry in app.sio.emits))
