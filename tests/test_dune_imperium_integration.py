import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.dune_imperium import DuneImperiumGame as Game, legal_moves, _resolve_combat
from tests.test_room_session import DummySio


class DuneImperiumIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = "game_over"
        for _ in range(300):
            if not any(r.bot_running for r in app.ROOMS.values()):
                break
            await asyncio.sleep(.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def room(self, bot=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "dune_imperium", "config": {"seed": 7}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        if bot:
            await app.on_room_add_bot("s0", {})
        else:
            await app.on_room_join("s1", {"room_id": room.room_id, "name": "Bob"})
        for p in room.players:
            p.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_private_views_and_seed_redaction(self):
        catalog = next(g for g in await app.api_list_games() if g["game_id"] == "dune_imperium")
        self.assertEqual((catalog["name_zh"], catalog["min_players"], catalog["max_players"]), ("沙丘：帝国", 2, 4))
        room = await self.room()
        while room.game_state["phase"] in ("leader", "baron"):
            pid = room.game_state["current_turn"]
            index = next(i for i, p in enumerate(room.players) if p.player_id == pid)
            await app.on_game_action("s" + str(index), {"action": Game.bot_move(room.game_state, pid)})
        self.assertEqual(room.game_state["phase"], "agent")
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        for sid in ("s0", "s1"):
            view = next(m["payload"]["view"] for m in reversed(updates) if m["to"] == sid)
            self.assertNotIn("seed", view)
            for p in view["players"]:
                self.assertEqual("hand" in p, p["player_id"] == app.SESSIONS[sid]["player_id"])
        for item in app.sio.emits:
            if item["event"] == "room:state":
                self.assertNotIn("seed", item["payload"]["game_config"])

    async def test_schema_bypass_rejected_and_reconnect_preserves_state(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {"type": "agent", "card": "forged", "space": "wealth"}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(m["event"] == "system:error" for m in app.sio.emits))
        player = room.players[0]
        await app.disconnect("s0")
        await app.on_room_reconnect("reconnected", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertEqual(room.game_state, before)
        update = next(m for m in app.sio.emits if m["event"] == "game:state" and m["to"] == "reconnected")
        self.assertEqual(update["payload"]["view"], Game.get_public_view(before, player.player_id))
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(before))))
        self.assertEqual(restored, before)
        room.auto_save = True
        app._save_room_state(room)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        response = next(m["payload"] for m in app.sio.emits if m["event"] == "room:load_result" and m["to"] == "loader")
        self.assertTrue(response["ok"])
        self.assertEqual(app.ROOMS[response["room_id"]].game_state, before)

    async def test_bot_scheduler_plays_and_confirms_without_skipping_human(self):
        room = await self.room(bot=True)
        human, bot = room.players
        for _ in range(600):
            if not room.bot_running:
                actions = legal_moves(room.game_state, human.player_id)
                if room.game_state["phase"] == "agent" and actions:
                    break
                if actions:
                    await app.on_game_action("s0", {"action": Game.bot_move(room.game_state, human.player_id)})
            await asyncio.sleep(.02)
        self.assertEqual(room.game_state["phase"], "agent")
        self.assertIsNotNone(room.game_state["players"][bot.player_id]["leader"])
        bot_events = [e for m in app.sio.emits if m["event"] == "game:state" for e in m["payload"].get("events", []) if e.get("type") == "bot:action"]
        self.assertTrue(bot_events)
        self.assertTrue(all(set(e["payload"]["action"]) == {"type"} for e in bot_events))
        for p in room.game_state["players"].values():
            p["troops"] = p["swords"] = 0
        _resolve_combat(room.game_state)
        self.assertEqual(room.game_state["phase"], "round_end")
        await app._maybe_run_bots(room)
        for _ in range(200):
            if not room.bot_running:
                break
            await asyncio.sleep(.02)
        self.assertEqual(room.game_state["ready"], [bot.player_id])
        self.assertEqual(room.game_state["round"], 1)
        self.assertEqual(room.game_state["phase"], "round_end")


if __name__ == "__main__":
    unittest.main()
