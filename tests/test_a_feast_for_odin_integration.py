import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game.a_feast_for_odin import AFeastForOdinGame as Game, _begin_income, _finish_feast
from tests.test_room_session import DummySio


class OdinIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
        await app.on_room_create("s0", {"name": "Viking", "game_type": "a_feast_for_odin",
                                        "config": {"seed": 126, "rounds": 6}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        await app.on_room_join("s1", {"name": "Explorer", "room_id": room.room_id})
        for p in room.players:
            p.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_socket_actions_privacy_and_stale_replay(self):
        catalog = await app.api_list_games()
        entry = next(g for g in catalog if g["game_id"] == Game.game_id)
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]), ("奥丁的盛宴", 1, 4))
        room = await self.room()
        self.assertEqual((room.status, room.game_state["rounds"]), ("in_game", 6))
        for e in app.sio.emits:
            if e["event"] == "room:state":
                self.assertNotIn("seed", e["payload"]["game_config"])
        actor = room.game_state["current_turn"]
        sid = next(p.socket_id for p in room.players if p.player_id == actor)
        move = Game.bot_move(room.game_state, actor)
        app.sio.emits.clear()
        await app.on_game_action(sid, {"action": move})
        updates = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        for e in updates:
            view = e["payload"]["view"]
            for key in ("seed", "_rng", "weapon_deck", "occupation_deck"):
                self.assertNotIn(key, view)
            for p in view["players"]:
                self.assertEqual("hand" in p, p["player_id"] == view["you"])
        before = copy.deepcopy(room.game_state)
        await app.on_game_action(sid, {"action": move})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(e["event"] == "system:error" for e in app.sio.emits))
        self.assertEqual(app._public_bot_action(Game.game_id, move), {"type": move["type"]})

    async def test_reconnect_preserves_round_review_barrier(self):
        room = await self.room()
        state = room.game_state
        state.update(active=None, pending=[], current_turn=None)
        _begin_income(state)
        for pid in state["order"]:
            _finish_feast(state, pid)
        self.assertEqual(state["phase"], "round_end")
        first, other = room.players
        await app.on_game_action("s0", {"action": Game.bot_move(state, first.player_id)})
        await app.disconnect("s1")
        self.assertEqual(state["phase"], "round_end")
        app.sio.emits.clear()
        await app.on_room_reconnect("new", {"room_id": room.room_id, "player_id": other.player_id,
                                            "reconnect_token": other.reconnect_token})
        view = next(e["payload"]["view"] for e in app.sio.emits if e["event"] == "game:state" and e["to"] == "new")
        self.assertEqual(view["phase"], "round_end")
        await app.on_game_action("new", {"action": Game.bot_move(state, other.player_id)})
        self.assertEqual((state["phase"], state["round"]), ("action", 2))

    async def test_saved_room_keeps_round_config_and_hidden_decks(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        saved = Game.serialize(room.game_state)
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(e["payload"] for e in app.sio.emits if e["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, saved)
        self.assertEqual(restored.game_config["rounds"], 6)

    async def test_bot_scheduler_completes_turn_without_stealing_human_turn(self):
        room = await self.room()
        human, bot = room.players
        bot.is_bot = True
        room.game_state["current_turn"] = bot.player_id
        await app._maybe_run_bots(room)
        for _ in range(150):
            await asyncio.sleep(.02)
            if not room.bot_running:
                break
        if getattr(room, "bot_task", None) and not room.bot_task.done():
            await asyncio.wait_for(room.bot_task, 15)
        self.assertGreater(room.game_state["players"][bot.player_id]["turns"], 0)
        self.assertEqual(room.game_state["current_turn"], human.player_id)


if __name__ == "__main__":
    unittest.main()
