import unittest
from tempfile import TemporaryDirectory

import app
from tests.test_room_session import DummySio


class EternalDecksIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio = app.sio
        self.previous_data = app.DATA_DIR
        self.previous_rooms = dict(app.ROOMS)
        self.previous_sessions = dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.DATA_DIR = self.temp.name
        app.sio = DummySio()
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio = self.previous_sio
        app.DATA_DIR = self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def room(self, count):
        await app.on_room_create("s0", {"name": "Explorer 0", "game_type": "eternal_decks", "config": {"seed": 99}})
        rid = app.SESSIONS["s0"]["room_id"]
        for i in range(1, count):
            await app.on_room_join(f"s{i}", {"name": f"Explorer {i}", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        return room

    async def test_catalog_reports_supported_counts_and_cooperative_tag(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == "eternal_decks")
        self.assertEqual(entry["player_counts"], [2, 4])
        self.assertEqual(entry["name_zh"], "永恒牌")
        self.assertIn("cooperative", [tag["id"] for tag in entry["tags"]])

    async def test_room_start_and_views_and_private_bot_broadcast(self):
        room = await self.room(2)
        await app.on_room_start("s0", {"room_id": room.room_id})
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "setup")
        room_updates = [emit for emit in app.sio.emits if emit["event"] == "room:state"]
        for update in room_updates:
            self.assertNotIn("seed", update["payload"]["game_config"])
        updates = [emit for emit in app.sio.emits if emit["event"] == "game:state"]
        self.assertTrue(updates)
        for update in updates:
            view = update["payload"]["view"]
            for player in view["players"]:
                self.assertEqual(len(player["hand"]), 3 if player["player_id"] == view["you"] else 0)
        self.assertEqual(app._public_bot_action("eternal_decks", {"type": "give", "card_id": "private-id", "target": "p1"}), {"type": "give"})

    async def test_three_player_room_cannot_start_unverified_setup(self):
        room = await self.room(3)
        await app.on_room_start("s0", {"room_id": room.room_id})
        self.assertEqual(room.status, "lobby")
        errors = [emit for emit in app.sio.emits if emit["event"] == "system:error"]
        self.assertTrue(errors)
        self.assertIn("2 or 4", str(errors[-1]["payload"]))


if __name__ == "__main__":
    unittest.main()
