import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game.grand_austria_hotel import GrandAustriaHotelGame as Game, _end_round
from tests.test_room_session import DummySio


class GrandAustriaHotelIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def room(self, bots=False):
        await app.on_room_create("s0", {"name": "Owner", "game_type": Game.game_id, "config": {"seed": 8}})
        rid = app.SESSIONS["s0"]["room_id"]
        if bots:
            await app.on_room_add_bot("s0", {"room_id": rid})
        else:
            await app.on_room_join("s1", {"name": "Guest", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {"room_id": rid})
        return room

    async def test_catalog_room_start_private_views_and_seed(self):
        entry = next(x for x in await app.api_list_games() if x["game_id"] == Game.game_id)
        self.assertEqual(entry["name_zh"], "奥地利大饭店")
        self.assertEqual((entry["min_players"], entry["max_players"]), (2, 4))
        self.assertIn("euro", [tag["id"] for tag in entry["tags"]])
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        views = [item["payload"]["view"] for item in app.sio.emits if item["event"] == "game:state"]
        self.assertTrue(views)
        for view in views:
            self.assertNotIn("seed", view)
            for player in view["players"]:
                self.assertEqual(len(player["hand"]), 6 if player["player_id"] == view["you"] else 0)
        for item in app.sio.emits:
            if item["event"] == "room:state":
                self.assertNotIn("seed", item["payload"]["game_config"])

    async def test_bot_uses_scheduler_and_action_broadcast_is_private(self):
        room = await self.room(bots=True)
        async def wait_for_bot():
            while room.bot_running:
                await asyncio.sleep(0.01)

        await asyncio.wait_for(wait_for_bot(), timeout=5)
        self.assertEqual(room.game_state["phase"], "setup_guest")
        self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)
        self.assertEqual(len(room.game_state["players"][room.players[1].player_id]["cafe"]), 1)
        self.assertEqual(app._public_bot_action(Game.game_id, {"type": "return_staff", "staff": "1", "revision": 12}), {"type": "return_staff"})

    async def test_schema_bypass_still_rejects_invalid_and_stale_actions(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {"type": "recruit", "slot": 0, "revision": 0}})
        self.assertEqual(room.game_state, before)
        pid = room.players[1].player_id
        action = Game.bot_move(room.game_state, pid)
        await app.on_game_action("s1", {"action": action})
        self.assertGreater(room.game_state["revision"], 0)
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s1", {"skip_validation": True, "action": action})
        self.assertEqual(room.game_state, before)

    async def test_disconnected_human_is_not_automatically_confirmed(self):
        room = await self.room()
        state = room.game_state
        state["round_scores"] = {p.player_id: 0 for p in room.players}
        _end_round(state)
        room.players[1].connected = False
        action = Game.bot_move(state, room.players[0].player_id)
        await app.on_game_action("s0", {"action": action})
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round"], 1)
        self.assertEqual(len(state["next_ready"]), 1)


if __name__ == "__main__":
    unittest.main()
