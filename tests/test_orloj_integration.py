import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game.orloj import OrlojGame as Game
from tests.test_room_session import DummySio


class OrlojIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.saved = app.sio, app.DATA_DIR, dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            task = getattr(room, "bot_task", None)
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        app.sio, app.DATA_DIR, rooms, sessions = self.saved
        app.ROOMS.clear()
        app.ROOMS.update(rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(sessions)
        self.temp.cleanup()

    async def room(self):
        await app.on_room_create("s0", {"name": "Clockmaker", "game_type": "orloj", "config": {"seed": 125}})
        rid = app.SESSIONS["s0"]["room_id"]
        await app.on_room_join("s1", {"name": "Painter", "room_id": rid})
        room = app.ROOMS[rid]
        for p in room.players:
            p.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_socket_start_seed_hiding_and_schema_actions(self):
        catalog = await app.api_list_games()
        game = next(g for g in catalog if g["game_id"] == "orloj")
        self.assertEqual((game["name_zh"], game["min_players"], game["max_players"]), ("布拉格天文钟", 2, 4))
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        for event in app.sio.emits:
            if event["event"] == "room:state":
                self.assertNotIn("seed", event["payload"]["game_config"])
        actor = room.game_state["current_turn"]
        sid = next(p.socket_id for p in room.players if p.player_id == actor)
        move = Game.bot_move(room.game_state, actor)
        app.sio.emits.clear()
        await app.on_game_action(sid, {"action": move})
        updates = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        for e in updates:
            self.assertNotIn("seed", e["payload"]["view"])
            self.assertNotIn("workshop_deck", e["payload"]["view"])
        before = copy.deepcopy(room.game_state)
        await app.on_game_action(sid, {"action": move})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(e["event"] == "system:error" for e in app.sio.emits))
        self.assertEqual(app._public_bot_action("orloj", move), {"type": move["type"]})

    async def test_reconnect_and_round_review_all_ready(self):
        room = await self.room()
        state = room.game_state
        state.update(phase="turn", current_turn=room.players[0].player_id, pending=[], main_done=True,
                     call_pending=True, rooster=0)
        actor = room.players[0].player_id
        move = next(m for m in Game.get_public_view(state, actor)["moves"] if m["type"] == "end_turn")
        await app.on_game_action("s0", {"action": move})
        self.assertEqual(state["phase"], "round_end")
        await app.on_game_action("s0", {"action": Game.bot_move(state, actor)})
        other = room.players[1]
        await app.disconnect("s1")
        self.assertEqual(state["phase"], "round_end")
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {"room_id": room.room_id, "player_id": other.player_id,
                                              "reconnect_token": other.reconnect_token})
        views = [e["payload"]["view"] for e in app.sio.emits if e["event"] == "game:state" and e["to"] == "s-new"]
        self.assertEqual(views[-1]["phase"], "round_end")
        await app.on_game_action("s-new", {"action": Game.bot_move(state, other.player_id)})
        self.assertEqual(state["phase"], "turn")

    async def test_room_save_round_trip(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        saved = Game.serialize(room.game_state)
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(e["payload"] for e in app.sio.emits if e["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        self.assertEqual(app.ROOMS[result["room_id"]].game_state, saved)

    async def test_generic_bot_dispatch_reaches_human_turn(self):
        room = await self.room()
        bot = room.players[1]
        bot.is_bot = True
        room.game_state.update(phase="turn", current_turn=bot.player_id, main_done=False, pending=[])
        await app._maybe_run_bots(room)
        for _ in range(150):
            await asyncio.sleep(.02)
            if not room.bot_running:
                break
        if getattr(room, "bot_task", None) and not room.bot_task.done():
            await asyncio.wait_for(room.bot_task, 10)
        self.assertGreater(room.game_state["players"][bot.player_id]["turns"], 0)
        self.assertIn(room.game_state["phase"], ("turn", "round_end"))
        if room.game_state["phase"] == "turn":
            self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)


if __name__ == "__main__":
    unittest.main()
