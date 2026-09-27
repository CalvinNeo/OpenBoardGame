import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.no_thanks import NoThanksGame as Game
from tests.test_room_session import DummySio


class NoThanksIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
        for _ in range(200):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(0.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def room(self, bots=False, rounds=1):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "no_thanks", "config": {"rounds": rounds, "seed": 128}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in (1, 2):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join("s{}".format(i), {"room_id": room.room_id, "name": "Player {}".format(i)})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def wait_bots(self, room):
        for _ in range(800):
            if not room.bot_running:
                return
            await asyncio.sleep(0.01)
        self.fail("bot runner did not return to a human")

    async def test_catalog_start_and_per_player_broadcast(self):
        entry = next(g for g in await app.api_list_games() if g["game_id"] == "no_thanks")
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]), ("不了不了", 3, 7))
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        app.sio.emits.clear()
        await app.on_game_action(actor.socket_id, {"action": {"type": "pass"}})
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for message in updates:
            view = message["payload"]["view"]
            self.assertEqual(view["pot"], 1)
            self.assertEqual(sum(p["chips"] is not None for p in view["players"]), 1)
            self.assertNotIn("deck", view)

    async def test_room_minimum_and_maximum(self):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "no_thanks"})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        room.players[0].ready = True
        await app.on_room_start("s0", {})
        self.assertEqual(room.status, "lobby")
        for _ in range(7):
            await app.on_room_add_bot("s0", {})
        self.assertEqual(len(room.players), 7)

    async def test_reconnect_and_saved_room_preserve_offer_and_secrets(self):
        room = await self.room(rounds=2)
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        await app.on_game_action(actor.socket_id, {"action": {"type": "pass"}})
        before = copy.deepcopy(room.game_state)
        player = room.players[0]
        await app.disconnect("s0")
        await app.on_room_reconnect("new", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertEqual(room.game_state, before)
        message = next(m for m in app.sio.emits if m["event"] == "game:state" and m["to"] == "new")
        self.assertEqual(message["payload"]["view"], Game.get_public_view(before, player.player_id))
        room.auto_save = True
        app._save_room_state(room)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        response = next(m["payload"] for m in app.sio.emits if m["event"] == "room:load_result" and m["to"] == "loader")
        self.assertTrue(response["ok"])
        restored = app.ROOMS[response["room_id"]]
        self.assertEqual(restored.game_state, json.loads(json.dumps(before)))

    async def test_schema_bypass_does_not_allow_extra_fields(self):
        room = await self.room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        before = copy.deepcopy(room.game_state)
        await app.on_game_action(actor.socket_id, {"skip_validation": True, "action": {"type": "take", "chips": 999}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(m["event"] == "system:error" for m in app.sio.emits))

    async def test_bots_play_and_confirm_but_wait_for_human_review(self):
        room = await self.room(bots=True, rounds=2)
        await self.wait_bots(room)
        human = room.players[0]
        self.assertEqual(room.game_state["current_turn"], human.player_id)
        # Let the human take every remaining card to reach a real scored round.
        while room.game_state["phase"] == "playing":
            await app.on_game_action("s0", {"action": {"type": "take"}})
        await self.wait_bots(room)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "round_summary")
        self.assertEqual(set(room.game_state["next_round_ready"]), {p.player_id for p in room.players if p.is_bot})
        await app.on_game_action("s0", {"action": {"type": "next_round"}})
        await self.wait_bots(room)
        self.assertEqual(room.game_state["round_number"], 2)
        while room.game_state["phase"] == "playing":
            await app.on_game_action("s0", {"action": {"type": "take"}})
        self.assertEqual(room.status, "game_over")
        self.assertEqual(len(room.game_state["score_history"]), 2)


if __name__ == "__main__":
    unittest.main()
