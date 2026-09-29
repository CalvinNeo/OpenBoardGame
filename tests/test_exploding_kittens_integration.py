import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.exploding_kittens import ExplodingKittensGame as Game
from tests.test_exploding_kittens import action
from tests.test_room_session import DummySio


class ExplodingKittensIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def make_room(self, bots=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "exploding_kittens", "config": {"seed": 145}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in (1, 2):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join("s{}".format(i), {"room_id": room.room_id, "name": "Player {}".format(i)})
        for player in room.players:
            player.ready = True
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_and_private_broadcast(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "exploding_kittens")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("爆炸猫", 2, 5))
        room = await self.make_room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        s = room.game_state
        # Ensure a safe draw while retaining the original full card inventory.
        safe = next(i for i, card in enumerate(s["deck"]) if card["kind"] != "exploding_kitten")
        s["deck"][0], s["deck"][safe] = s["deck"][safe], s["deck"][0]
        secret_card_id = s["deck"][0]["id"]
        app.sio.emits.clear()
        await app.on_game_action(actor.socket_id, {"action": action(s, "draw")})
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for message in updates:
            payload = message["payload"]
            self.assertNotIn("deck", payload["view"])
            if message["to"] != actor.socket_id:
                self.assertNotIn(secret_card_id, json.dumps(payload))
            self.assertNotIn(secret_card_id, json.dumps(payload["events"]))
        await app._emit_room_state(room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])
        for kind, fields in (("reinsert", {"position": 4}), ("give", {"card_id": "secret"})):
            self.assertEqual(app._public_bot_action("exploding_kittens", action(s, kind, **fields)), {"type": kind})

    async def test_validation_bypass_and_stale_requests(self):
        room = await self.make_room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        for skip in (False, True):
            for extra in ({"position": 0}, {"window_id": -1}, {"game_token": "old"}):
                before = copy.deepcopy(room.game_state)
                await app.on_game_action(actor.socket_id, {"skip_validation": skip, "action": action(room.game_state, "draw", **extra)})
                self.assertEqual(room.game_state, before)
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_live_and_cold_save_privacy_and_authenticated_restore(self):
        room = await self.make_room()
        player = room.players[0]
        expected = Game.get_public_view(room.game_state, player.player_id)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id": room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        credentials = {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token}
        await app.on_room_reconnect("bad", {**credentials, "reconnect_token": "wrong"})
        self.assertEqual(app.ROOMS, {})
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_reconnect("restored", credentials)
        restored = app.ROOMS[room.room_id]
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id), expected)
        self.assertEqual([p.socket_id for p in restored.players if p.connected], ["restored"])

    async def test_finished_save_can_be_downloaded(self):
        room = await self.make_room()
        for _ in range(2000):
            if room.game_state["game_over"]:
                break
            for player in room.players:
                move = Game.bot_move(room.game_state, player.player_id)
                if move:
                    self.assertIsNone(Game.apply_action(room.game_state, player.player_id, move)[1])
                    break
        self.assertTrue(room.game_state["game_over"])
        app._save_room_state(room)
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))

    async def test_hot_reconnect_preserves_hand_and_revokes_old_socket(self):
        room = await self.make_room()
        player = room.players[0]
        before = Game.get_public_view(room.game_state, player.player_id)
        await app.on_room_reconnect("replacement", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertNotIn("s0", app.SESSIONS)
        self.assertEqual(player.socket_id, "replacement")
        self.assertEqual(Game.get_public_view(room.game_state, player.player_id), before)

    async def test_real_bot_runner_stops_for_human_reaction(self):
        room = await self.make_room(bots=True)
        human, bot = room.players[:2]
        s = room.game_state
        s["current_turn"] = bot.player_id
        # Move a real attack into the bot hand, retaining all card IDs.
        groups = [s["deck"], *[p["hand"] for p in s["players"].values()]]
        source = next(group for group in groups if any(c["kind"] == "attack" for c in group))
        attack = next(c for c in source if c["kind"] == "attack")
        source.remove(attack)
        s["players"][bot.player_id]["hand"].append(attack)
        Game.apply_action(s, bot.player_id, action(s, "play", card_ids=[attack["id"]]))
        await app._maybe_run_bots(room)
        for _ in range(400):
            if not room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(s["phase"], "reaction")
        self.assertNotIn(human.player_id, s["pending"]["passed"])
        self.assertIn("pass", Game.get_legal_actions(s, human.player_id))


if __name__ == "__main__":
    unittest.main()
