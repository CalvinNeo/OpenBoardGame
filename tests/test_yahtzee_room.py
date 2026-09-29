import unittest
from unittest.mock import AsyncMock, patch

import app
from tests.test_room_session import DummySio


class YahtzeeRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.patches = [
            patch.object(app, "sio", DummySio()),
            patch.object(app, "ROOMS", {}),
            patch.object(app, "SESSIONS", {}),
            patch.object(app, "_save_room_state"),
            patch.object(app, "_maybe_run_bots", AsyncMock()),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    async def make_room(self, config=None):
        await app.on_room_create("sid", {"name": "Player", "game_type": "yahtzee", "config": config or {}})
        room = app.ROOMS[app.SESSIONS["sid"]["room_id"]]
        room.players[0].ready = True
        return room

    async def test_lobby_choice_reaches_game_view_and_reopen(self):
        room = await self.make_room()
        await app.on_room_start("sid", {"config": {"bot_strategy": "dynamic_programming"}})
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["config"]["bot_strategy"], "dynamic_programming")
        emitted = [entry["payload"] for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(emitted[-1]["view"]["config"]["bot_strategy"], "dynamic_programming")
        await app.on_room_reopen("sid", {})
        reopened = app.ROOMS[app.SESSIONS["sid"]["room_id"]]
        self.assertEqual(reopened.game_config["bot_strategy"], "dynamic_programming")
        self.assertEqual(reopened.game_state["config"]["bot_strategy"], "dynamic_programming")

    async def test_classic_can_override_creation_choice(self):
        room = await self.make_room({"bot_strategy": "dynamic_programming"})
        await app.on_room_start("sid", {"config": {"bot_strategy": "classic"}})
        self.assertEqual(room.game_state["config"]["bot_strategy"], "classic")

    async def test_missing_choice_remains_classic(self):
        room = await self.make_room()
        await app.on_room_start("sid", {})
        self.assertEqual(room.game_state["config"]["bot_strategy"], "classic")

    async def test_invalid_choice_does_not_start_game(self):
        room = await self.make_room()
        await app.on_room_start("sid", {"config": {"bot_strategy": "invalid"}})
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)
        self.assertTrue(any(entry["event"] == "system:error" for entry in app.sio.emits))


if __name__ == "__main__":
    unittest.main()
