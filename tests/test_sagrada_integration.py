import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.sagrada import SagradaGame as Game
from tests.test_room_session import DummySio


class SagradaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "sagrada", "config": {"seed": 162}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        await app.on_room_join("s1", {"room_id": room.room_id, "name": "Bob"})
        for player in room.players:
            player.ready = True
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        room.auto_save = True
        app._save_room_state(room)
        return room

    def next_action(self, room):
        for player in room.players:
            if Game.get_legal_actions(room.game_state, player.player_id):
                action = dict(Game.bot_move(room.game_state, player.player_id))
                action.pop("delay_ms", None)
                return player, action
        self.fail("active game has no available player action")

    async def test_catalog_room_seed_and_bot_payload(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "sagrada")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("圣家族大教堂", 2, 4))
        self.assertIn("abstract", {tag["id"] for tag in row["tags"]})
        room = await self.make_room()
        await app._emit_room_state(room)
        messages = [m for m in app.sio.emits if m["event"] == "room:state"]
        self.assertNotIn("seed", messages[-1]["payload"]["game_config"])
        self.assertEqual(app._public_bot_action("sagrada", {"type": "choose_pattern", "pattern_id": "secret"}), {"type": "choose_pattern"})

    async def test_socket_actions_broadcast_personalized_views_and_finish(self):
        room = await self.make_room()
        for step in range(600):
            if room.game_state["game_over"]:
                break
            player, action = self.next_action(room)
            before_version = room.state_version
            app.sio.emits.clear()
            await app.on_game_action(player.socket_id, {"action": action})
            errors = [m for m in app.sio.emits if m["event"] == "system:error"]
            self.assertEqual(errors, [], (step, action, errors))
            self.assertGreater(room.state_version, before_version)
            messages = [m for m in app.sio.emits if m["event"] == "game:state"]
            self.assertEqual(len(messages), 2)
            for message in messages:
                recipient = next(p for p in room.players if p.socket_id == message["to"])
                self.assertEqual(message["payload"]["view"], Game.get_public_view(room.game_state, recipient.player_id))
        self.assertTrue(room.game_state["game_over"])
        self.assertEqual(room.status, "game_over")
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))

    async def test_invalid_socket_action_is_atomic_even_without_schema_validation(self):
        room = await self.make_room()
        for skip in (False, True):
            before = copy.deepcopy(room.game_state)
            await app.on_game_action("s0", {"skip_validation": skip, "action": {"type": "place_die", "die_id": "missing", "row": True, "col": 0}})
            self.assertEqual(room.game_state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_live_and_cold_private_save_and_authenticated_recovery(self):
        room = await self.make_room()
        player, action = self.next_action(room)
        await app.on_game_action(player.socket_id, {"action": action})
        expected = Game.get_public_view(room.game_state, player.player_id)
        credentials = {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token}
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id": room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        await app.on_room_reconnect("bad", {**credentials, "reconnect_token": "wrong"})
        self.assertEqual(app.ROOMS, {})
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock) as resume:
            await app.on_room_reconnect("replacement", credentials)
            resume.assert_awaited_once()
        restored = app.ROOMS[room.room_id]
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id), expected)
        self.assertEqual([p.socket_id for p in restored.players if p.connected], ["replacement"])

    async def test_hot_reconnect_transfers_seat(self):
        room = await self.make_room()
        player = room.players[0]
        before = Game.get_public_view(room.game_state, player.player_id)
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_reconnect("replacement", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertNotIn("s0", app.SESSIONS)
        self.assertEqual(player.socket_id, "replacement")
        self.assertEqual(Game.get_public_view(room.game_state, player.player_id), before)

    async def test_room_bot_runner_handles_setup_and_round_review(self):
        room = await self.make_room()
        human, bot = room.players
        bot.is_bot = True

        async def run_bots():
            pending = []
            with patch.object(app.asyncio, "create_task", side_effect=pending.append), patch.object(app.asyncio, "sleep", new_callable=AsyncMock):
                await app._maybe_run_bots(room)
                self.assertEqual(len(pending), 1)
                await pending[0]

        await run_bots()
        self.assertNotIn("choose_pattern", Game.get_legal_actions(room.game_state, bot.player_id))
        for _ in range(30):
            if room.game_state["phase"] == "round_end":
                break
            action = dict(Game.bot_move(room.game_state, human.player_id))
            action.pop("delay_ms", None)
            self.assertIsNotNone(action)
            with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
                await app.on_game_action(human.socket_id, {"action": action})
            self.assertNotEqual(app.sio.emits[-1]["event"], "system:error")
            await run_bots()
        self.assertEqual(room.game_state["phase"], "round_end")
        self.assertEqual(Game.get_legal_actions(room.game_state, bot.player_id), [])
        self.assertIn("next_round", Game.get_legal_actions(room.game_state, human.player_id))


if __name__ == "__main__":
    unittest.main()
