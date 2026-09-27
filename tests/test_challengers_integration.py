import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

from fastapi import HTTPException

import app
from game.challengers import ChallengersGame as Game
from tests.test_room_session import DummySio


class ChallengersIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous = app.sio, app.DATA_DIR, dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        # Do not leave server bot tasks running after restoring shared test globals.
        for room in app.ROOMS.values():
            task = getattr(room, "bot_task", None)
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        app.sio, app.DATA_DIR, rooms, sessions = self.previous
        app.ROOMS.clear()
        app.ROOMS.update(rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(sessions)
        self.temp.cleanup()

    async def room(self, count=2, bots=0):
        await app.on_room_create("s0", {"name": "Captain", "game_type": "challengers", "config": {"seed": 124}})
        rid = app.SESSIONS["s0"]["room_id"]
        for i in range(1, count):
            await app.on_room_join(f"s{i}", {"name": f"Player {i}", "room_id": rid})
        for _ in range(bots):
            await app.on_room_add_bot("s0", {"room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_solo_start(self):
        entry = next(game for game in await app.api_list_games() if game["game_id"] == "challengers")
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]), ("冠军挑战者", 1, 8))
        room = await self.room(1)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(len(room.game_state["players"]), 2)
        for emitted in app.sio.emits:
            if emitted["event"] == "room:state":
                self.assertNotIn("seed", emitted["payload"]["game_config"])
            elif emitted["event"] == "game:state":
                self.assertNotIn("rng", emitted["payload"]["view"])

    async def test_socket_action_and_private_broadcast(self):
        room = await self.room(3)
        pid = room.players[0].player_id
        uid = room.game_state["players"][pid]["offer"][0]
        candidate = {"type": "pick", "round": 1, "revision": room.game_state["players"][pid]["revision"], "card_id": uid}
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": candidate})
        updates = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        self.assertEqual(app._public_bot_action("challengers", candidate), {"type": "pick"})
        for update in updates:
            self.assertEqual(update["payload"]["events"], [])
            if update["to"] != "s0":
                self.assertNotIn(uid, [c["id"] for c in update["payload"]["view"]["deck"]])
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"action": candidate, "skip_validation": True})
        self.assertEqual(before, room.game_state)
        self.assertTrue(any(e["event"] == "system:error" for e in app.sio.emits))

    async def test_reconnect_preserves_round_review(self):
        room = await self.room()
        for _ in range(160):
            if room.game_state["phase"] == "round_end":
                break
            for i, player in enumerate(room.players):
                if room.game_state["phase"] == "round_end":
                    break
                candidate = Game.bot_move(room.game_state, player.player_id)
                if candidate:
                    await app.on_game_action(f"s{i}", {"action": candidate})
        self.assertEqual(room.game_state["phase"], "round_end")
        await app.on_game_action("s0", {"action": Game.bot_move(room.game_state, room.players[0].player_id)})
        second = room.players[1]
        await app.disconnect("s1")
        self.assertEqual(room.game_state["round"], 1)
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {"room_id": room.room_id, "player_id": second.player_id, "reconnect_token": second.reconnect_token})
        views = [e["payload"]["view"] for e in app.sio.emits if e["event"] == "game:state" and e["to"] == "s-new"]
        self.assertEqual(views[-1]["phase"], "round_end")
        await app.on_game_action("s-new", {"action": Game.bot_move(room.game_state, second.player_id)})
        self.assertEqual(room.game_state["round"], 2)

    async def test_live_save_private_and_cold_restore_validated(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        with self.assertRaises(HTTPException) as denied:
            await app.download_room_save(room.room_id)
        self.assertEqual(denied.exception.status_code, 403)
        before = set(app.ROOMS)
        await app.on_room_load("outsider", {"source_room_id": room.room_id})
        self.assertEqual(set(app.ROOMS), before)
        self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(e["payload"] for e in app.sio.emits if e["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        self.assertEqual(app.ROOMS[result["room_id"]].game_state, room.game_state)

    async def test_bot_scheduler_waits_for_human_reveal_and_reconnect(self):
        room = await self.room(count=1, bots=1)
        human, bot = room.players

        async def settled():
            async def wait():
                while room.bot_running:
                    await asyncio.sleep(0.02)
            await asyncio.wait_for(wait(), timeout=8)

        await settled()
        for _ in range(60):
            if "reveal_for_bot" in Game.get_legal_actions(room.game_state, human.player_id):
                break
            candidate = Game.bot_move(room.game_state, human.player_id)
            self.assertIsNotNone(candidate)
            await app.on_game_action("s0", {"action": candidate})
            await settled()
        self.assertEqual(Game.get_legal_actions(room.game_state, human.player_id), ["reveal_for_bot"])
        before = copy.deepcopy(room.game_state)
        await app._maybe_run_bots(room)
        await settled()
        self.assertEqual(room.game_state, before)
        self.assertIsNone(Game.bot_move(room.game_state, bot.player_id))
        await app.disconnect("s0")
        await app.on_room_reconnect("s-new", {"room_id": room.room_id, "player_id": human.player_id,
                                            "reconnect_token": human.reconnect_token})
        await settled()
        views = [e["payload"]["view"] for e in app.sio.emits if e["event"] == "game:state" and e["to"] == "s-new"]
        self.assertEqual(views[-1]["legal_actions"], ["reveal_for_bot"])
        self.assertEqual(room.game_state, before)
        top = before["matches"][0]["lanes"][bot.player_id]["draw"][0]
        await app.on_game_action("s-new", {"action": Game.bot_move(room.game_state, human.player_id)})
        await settled()
        self.assertIn(top, [entry["id"] for entry in room.game_state["matches"][0]["lanes"][bot.player_id]["field"]])


if __name__ == "__main__":
    unittest.main()
