import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game import ThatsLifeGame
from tests.test_room_session import DummySio


class ThatsLifeRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio = app.sio
        self.original_dir = app.DATA_DIR
        self.original_rooms = dict(app.ROOMS)
        self.original_sessions = dict(app.SESSIONS)
        self.temp_dir = TemporaryDirectory()
        app.sio = DummySio()
        app.DATA_DIR = self.temp_dir.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("first", {"name": "First", "game_type": "thats_life"})
        self.room_id = app.SESSIONS["first"]["room_id"]
        self.room = app.ROOMS[self.room_id]
        await app.on_room_join("second", {"name": "Second", "room_id": self.room_id})
        await app.on_room_ready("second", {"room_id": self.room_id, "ready": True})

    async def asyncTearDown(self):
        await asyncio.sleep(0)
        app.sio = self.original_sio
        app.DATA_DIR = self.original_dir
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.temp_dir.cleanup()

    async def start(self):
        await app.on_room_start("first", {"config": {"setup": "random", "rounds": 2, "seed": 123}})
        self.assertEqual(self.room.status, "in_game", app.sio.emits[-2:])

    async def test_start_roll_move_and_private_seed(self):
        await self.start()
        actor = self.room.game_state["current_turn"]
        self.assertEqual(actor, self.room.players[0].player_id)
        await app.on_game_action("first", {"room_id": self.room_id, "action": {"type": "roll"}})
        self.assertEqual(self.room.game_state["phase"], "move")
        views = [entry["payload"]["view"] for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertTrue(views)
        self.assertTrue(all("base_seed" not in view and "seed" not in view["config"] for view in views))
        before = self.room.state_version
        action = ThatsLifeGame.bot_move(self.room.game_state, actor)
        action.pop("delay_ms")
        await app.on_game_action("first", {"room_id": self.room_id, "action": action})
        self.assertEqual(self.room.state_version, before + 1)
        self.assertEqual(len(self.room.game_state["history"]), 1)
        self.assertEqual(self.room.game_state["current_turn"], self.room.players[1].player_id)

    async def test_out_of_turn_and_invalid_action_do_not_mutate(self):
        await self.start()
        original = copy.deepcopy(self.room.game_state)
        version = self.room.state_version
        for sid, action in (("second", {"type": "roll"}), ("first", {"type": "move", "piece_id": "guard-0"}),
                            ("first", {"type": "roll", "extra": True})):
            await app.on_game_action(sid, {"room_id": self.room_id, "action": action})
            self.assertEqual(original, self.room.game_state)
            self.assertEqual(version, self.room.state_version)

    async def test_reconnect_restores_die_and_save_load(self):
        await self.start()
        await app.on_game_action("first", {"room_id": self.room_id, "action": {"type": "roll"}})
        original = copy.deepcopy(self.room.game_state)
        player = self.room.players[0]
        await app.on_room_reconnect("new-first", {"room_id": self.room_id, "player_id": player.player_id,
                                                  "reconnect_token": player.reconnect_token})
        self.assertEqual(app.SESSIONS["new-first"]["player_id"], player.player_id)
        self.assertEqual(self.room.game_state, original)
        self.room.auto_save = True
        app._save_room_state(self.room)
        saved = app._load_latest_save(self.room_id)
        self.assertEqual(ThatsLifeGame.deserialize(saved["game_state"]), original)

    async def test_bot_room_support(self):
        await app.on_room_add_bot("first", {"room_id": self.room_id})
        self.assertEqual(len(self.room.players), 3)
        self.assertTrue(self.room.players[-1].is_bot)
        await self.start()
        state = self.room.game_state
        bot_id = self.room.players[-1].player_id
        state["current_turn"] = bot_id
        action = ThatsLifeGame.bot_move(state, bot_id)
        self.assertEqual(action["type"], "roll")
        self.assertIsNone(ThatsLifeGame.apply_action(state, bot_id, {"type": "roll"})[1])
        self.assertEqual(ThatsLifeGame.bot_move(state, bot_id)["type"], "move")


if __name__ == "__main__":
    unittest.main()
