import asyncio
import random
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from game.kobayakawa import KobayakawaGame as Game
from tests.test_room_session import DummySio


class KobayakawaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.directory = TemporaryDirectory()
        self.room = None
        app.sio, app.DATA_DIR = DummySio(), self.directory.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        if self.room:
            self.room.status = "game_over"
            await self.wait_for_bots()
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.directory.cleanup()

    async def wait_for_bots(self):
        for attempt in range(500):
            if not self.room.bot_running:
                return
            await asyncio.sleep(0.01)
        self.fail("Kobayakawa bots did not yield to the human")

    async def test_catalog_and_human_with_two_bots_complete_game(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == Game.game_id)
        self.assertTrue(entry["has_strategic_ai"])
        source = random.Random(32)
        with patch("game.kobayakawa.random.choice", side_effect=source.choice), \
                patch("game.kobayakawa.random.shuffle", side_effect=source.shuffle):
            await app.on_room_create("human", {
                "name": "Host", "game_type": Game.game_id,
                "config": {"end_mode": "rounds", "round_limit": 2},
            })
            await app.on_room_add_bot("human", {})
            await app.on_room_add_bot("human", {})
            self.room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
            self.room.players[0].ready = True
            await app.on_room_start("human", {})
            self.assertEqual(self.room.status, "in_game")
            self.assertEqual(sum(player.is_bot for player in self.room.players), 2)
            for step in range(20):
                await self.wait_for_bots()
                if self.room.status == "game_over":
                    break
                state = self.room.game_state
                human_id = self.room.players[0].player_id
                self.assertEqual(state["current_turn"], human_id)
                action = Game.bot_move(state, human_id)
                self.assertIsNotNone(action)
                await app.on_game_action("human", {"action": action})
            self.assertEqual(self.room.status, "game_over")
            self.assertEqual(self.room.game_state["round"], 2)
        self.assertFalse(any(message["event"] == "system:error" for message in app.sio.emits))
        updates = [message["payload"] for message in app.sio.emits if message["event"] == "game:state"]
        bot_actions = [event["payload"]["action"]["type"] for update in updates
                       for event in update.get("events", []) if event["type"] == "bot:action"]
        self.assertTrue(set(bot_actions) & {"draw_card", "replace_kobayakawa"})
        self.assertTrue(set(bot_actions) & {"fight", "pass"})
        for update in updates:
            self.assertNotIn("deck", update["view"])
            for player in update["view"]["players"]:
                self.assertNotIn("hand", player)
                self.assertNotIn("drawn_card", player)


if __name__ == "__main__":
    unittest.main()
