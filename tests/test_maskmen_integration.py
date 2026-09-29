import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from fastapi import HTTPException
from game.maskmen import MaskmenGame as Game
from tests.test_maskmen import action
from tests.test_room_session import DummySio


class MaskmenIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
        for _ in range(100):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def room(self, count=3, bots=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "maskmen", "config": {"seed": 137}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in range(1, count):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join(f"s{i}", {"room_id": room.room_id, "name": f"Wrestler {i}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def wait_bots(self, room):
        for _ in range(500):
            if not room.bot_running:
                return
            await asyncio.sleep(.01)
        self.fail("bots did not yield to a human")

    async def test_catalog_start_and_private_broadcast(self):
        entry = next(g for g in await app.api_list_games() if g["game_id"] == "maskmen")
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]), ("面具摔跤手", 2, 6))
        room = await self.room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        move = Game.bot_move(room.game_state, actor.player_id)
        move.pop("delay_ms")
        app.sio.emits.clear()
        await app.on_game_action(actor.socket_id, {"action": move})
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for message in updates:
            view = message["payload"]["view"]
            own = next(p.player_id for p in room.players if p.socket_id == message["to"])
            self.assertEqual(view["your_hand"], room.game_state["players"][own]["hand"])
            self.assertTrue(all("hand" not in p for p in view["players"]))
            self.assertNotIn("seed", view["config"])
            for event in message["payload"]["events"]:
                self.assertNotIn("hand", event["payload"])
        await app._emit_room_state(room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])

    async def test_player_limits(self):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "maskmen"})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        room.players[0].ready = True
        await app.on_room_start("s0", {})
        self.assertEqual(room.status, "lobby")
        for _ in range(7):
            await app.on_room_add_bot("s0", {})
        self.assertEqual(len(room.players), 6)

    async def test_schema_bypass_cannot_accept_forged_count(self):
        room = await self.room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        for skip in (False, True):
            before = copy.deepcopy(room.game_state)
            await app.on_game_action(actor.socket_id, {"skip_validation": skip, "action": action(room.game_state, "play", mask="blue", count=True)})
            self.assertEqual(room.game_state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_active_save_privacy_and_authenticated_cold_reconnect(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        player = room.players[0]
        before = copy.deepcopy(room.game_state)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(HTTPException) as error:
                await app.download_room_save(room.room_id)
            self.assertEqual(error.exception.status_code, 403)
            await app.on_room_load("loader", {"source_room_id": room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        await app.on_room_reconnect("invalid", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": "wrong"})
        self.assertNotIn(room.room_id, app.ROOMS)
        await app.on_room_reconnect("new", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        restored = app.ROOMS[room.room_id]
        self.assertEqual(restored.game_state, before)
        view = next(m["payload"]["view"] for m in reversed(app.sio.emits) if m["event"] == "game:state" and m["to"] == "new")
        self.assertEqual(view, Game.get_public_view(before, player.player_id))

    async def test_real_bot_runner_completes_season_but_waits_for_human(self):
        original = Game.bot_move
        def immediate(state, pid):
            move = original(state, pid)
            if move:
                move.pop("delay_ms", None)
            return move
        with patch.object(Game, "bot_move", side_effect=immediate):
            room = await self.room(count=3, bots=True)
            human = room.players[0]
            for _ in range(220):
                await self.wait_bots(room)
                state = room.game_state
                if state["phase"] == "season_review":
                    break
                move = immediate(state, human.player_id)
                self.assertIsNotNone(move)
                await app.on_game_action("s0", {"action": move})
            self.assertEqual(room.game_state["phase"], "season_review")
            self.assertEqual(room.status, "in_game")
            self.assertEqual(set(room.game_state["ready"]), {p.player_id for p in room.players if p.is_bot})
            before = room.game_state["season"]
            await app.on_game_action("s0", {"action": action(room.game_state, "next_season")})
            await self.wait_bots(room)
            self.assertEqual(room.game_state["season"], before + 1)


if __name__ == "__main__":
    unittest.main()
