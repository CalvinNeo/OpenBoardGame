import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.power_grid import PowerGridGame as Game
from tests.test_room_session import DummySio


class PowerGridIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def room(self, count=3, bots=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "power_grid", "config": {"seed": 131}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in range(1, count):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join(f"s{i}", {"room_id": room.room_id, "name": f"Company {i}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def wait_bots(self, room):
        for _ in range(1000):
            if not room.bot_running:
                return
            await asyncio.sleep(.01)
        self.fail("bot runner did not return to the human")

    async def test_catalog_minimum_maximum_and_start(self):
        entry = next(g for g in await app.api_list_games() if g["game_id"] == "power_grid")
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]), ("电力公司", 2, 6))
        for count in (2, 6):
            room = await self.room(count)
            self.assertEqual(room.status, "in_game")
            self.assertEqual(room.game_state["phase"], "auction")

    async def test_single_player_cannot_start(self):
        room = await self.room(1)
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)

    async def test_broadcast_private_money_and_hidden_deck(self):
        room = await self.room()
        room_views = [m["payload"] for m in app.sio.emits if m["event"] == "room:state"]
        self.assertTrue(room_views)
        self.assertNotIn("seed", room_views[-1]["game_config"])
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        app.sio.emits.clear()
        action = Game.bot_move(room.game_state, actor.player_id)
        await app.on_game_action(actor.socket_id, {"action": action})
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for message in updates:
            view = message["payload"]["view"]
            self.assertEqual(sum(p["money"] is not None for p in view["players"]), 1)
            self.assertNotIn("deck", view)
            self.assertNotIn("seed", view)
        self.assertEqual(app._public_bot_action("power_grid", {"type": "replace", "resources": {"coal": 1}}), {"type": "replace"})

    async def test_schema_bypass_still_rejects_invalid_action_atomically(self):
        room = await self.room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        before = copy.deepcopy(room.game_state)
        action = Game.bot_move(room.game_state, actor.player_id)
        action["amount"] = -10
        await app.on_game_action(actor.socket_id, {"skip_validation": True, "action": action})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(m["event"] == "system:error" for m in app.sio.emits))

    async def test_reconnect_preserves_auction_and_private_view(self):
        room = await self.room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        await app.on_game_action(actor.socket_id, {"action": Game.bot_move(room.game_state, actor.player_id)})
        before = copy.deepcopy(room.game_state)
        player = room.players[0]
        await app.disconnect("s0")
        await app.on_room_reconnect("new", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertEqual(room.game_state, before)
        message = next(m for m in app.sio.emits if m["event"] == "game:state" and m["to"] == "new")
        self.assertEqual(message["payload"]["view"], Game.get_public_view(before, player.player_id))

    async def test_active_save_download_and_clone_are_blocked(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        with self.assertRaises(app.HTTPException) as cm:
            await app.download_room_save(room.room_id)
        self.assertEqual(cm.exception.status_code, 403)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        result = next(m["payload"] for m in app.sio.emits if m["event"] == "room:load_result" and m["to"] == "loader")
        self.assertFalse(result["ok"])
        before = json.loads(json.dumps(room.game_state))
        app.ROOMS.clear()
        await app.on_room_load("cold", {"source_room_id": room.room_id})
        result = next(m["payload"] for m in app.sio.emits if m["event"] == "room:load_result" and m["to"] == "cold")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, before)
        with self.assertRaises(app.HTTPException):
            await app.download_room_save(room.room_id)

    async def test_bots_wait_for_human_round_confirmation(self):
        room = await self.room(bots=True)
        human = room.players[0]
        for _ in range(100):
            await self.wait_bots(room)
            if room.game_state["phase"] == "round_end":
                break
            self.assertEqual(room.game_state["current_turn"], human.player_id)
            action = Game.bot_move(room.game_state, human.player_id)
            await app.on_game_action("s0", {"action": action})
        await self.wait_bots(room)
        self.assertEqual(room.game_state["phase"], "round_end")
        self.assertEqual(set(room.game_state["next_ready"]), {p.player_id for p in room.players if p.is_bot})
        await app.on_game_action("s0", {"action": {"type": "next_round", "round": 1}})
        await self.wait_bots(room)
        self.assertEqual(room.game_state["round"], 2)


if __name__ == "__main__":
    unittest.main()
