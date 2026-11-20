import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.werewolf import WerewolfGame as Game
from tests.test_room_session import DummySio
from tests.test_werewolf import action


class WerewolfIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
            await asyncio.sleep(.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, bots=False, allow_wolf_self_attack=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "werewolf", "auto_save": True})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in range(1, 6):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Player {index}"})
        for player in room.players:
            player.ready = True
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_start("s0", {})
        self.assertEqual(room.status, "in_game")
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_game_action("s0", {"action": action(room.game_state, "deal", allow_wolf_self_attack=allow_wolf_self_attack)})
        self.assertEqual(room.game_state["phase"], "identity")
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def wait_for_bots(self, room):
        await app._maybe_run_bots(room)
        for _ in range(1000):
            if not room.bot_running:
                break
            await asyncio.sleep(.01)
        self.assertFalse(room.bot_running)

    async def test_debug_bots_progress_and_wait_for_dead_human_at_reviews(self):
        room = await self.make_room(bots=True)
        human = room.players[0].player_id
        bots = {player.player_id for player in room.players if player.is_bot}
        self.assertEqual(len(bots), 5)
        for player, role in zip(room.players, ("villager", "werewolf", "werewolf", "witch", "seer", "villager")):
            room.game_state["players"][player.player_id]["role"] = role
        app.sio.emits.clear()
        await self.wait_for_bots(room)
        self.assertEqual(room.game_state["phase"], "identity")
        self.assertEqual(set(room.game_state["ready"]), bots)
        await app.on_game_action("s0", {"action": action(room.game_state, "ready")})
        await self.wait_for_bots(room)
        self.assertEqual(room.game_state["phase"], "last_words")
        self.assertEqual(room.game_state["current_turn"], human)
        self.assertFalse(room.game_state["players"][human]["alive"])
        await app.on_game_action("s0", {"action": action(room.game_state, "end_speech")})
        await self.wait_for_bots(room)
        self.assertEqual(room.game_state["phase"], "dawn_review")
        self.assertEqual(set(room.game_state["ready"]), bots)
        await app.on_game_action("s0", {"action": action(room.game_state, "next_round")})
        await self.wait_for_bots(room)
        self.assertEqual(room.game_state["phase"], "dusk_review")
        self.assertEqual(set(room.game_state["ready"]), bots)
        self.assertEqual(Game.deserialize(Game.serialize(room.game_state)), room.game_state)
        updates = [message["payload"] for message in app.sio.emits if message["event"] == "game:state"]
        self.assertTrue(updates)
        for payload in updates:
            self.assertEqual(payload["events"], [])
            self.assertIsNone(payload["bot_status"]["player_id"])
            self.assertFalse(payload["bot_status"]["running"])
            self.assertEqual(payload["view"]["wolf_team"], [])
            self.assertEqual(payload["view"]["wolf_votes"], {})
        progress = [message["payload"] for message in app.sio.emits if message["event"] == "game:bot_progress"]
        self.assertTrue(progress)
        for payload in progress:
            self.assertIsNone(payload["bot_status"]["player_id"])
            self.assertFalse(payload["bot_status"]["running"])

    async def test_bot_activity_never_exposes_role_or_targets(self):
        room = await self.make_room()
        room.bot_running = True
        room.bot_player_id = room.players[1].player_id
        room.bot_started_at_ms = 100
        try:
            self.assertEqual(app._bot_status_payload(room), {"running": False, "player_id": None, "started_at_ms": None})
            move = action(room.game_state, "inspect", target=room.players[0].player_id)
            self.assertEqual(app._public_bot_action("werewolf", move), {"type": "inspect"})
            app.sio.emits.clear()
            await app._emit_game_state(room, [{"type": "bot:action", "payload": {"action": move}},
                                               {"type": "public_event"}])
            for message in app.sio.emits:
                self.assertEqual(message["payload"]["events"], [{"type": "public_event"}])
        finally:
            room.bot_running = False

    async def test_catalog_and_per_viewer_private_broadcast(self):
        catalog = next(row for row in await app.api_list_games() if row["game_id"] == "werewolf")
        self.assertEqual((catalog["name_zh"], catalog["min_players"], catalog["max_players"]), ("狼人杀", 6, 16))
        self.assertFalse(catalog["has_strategic_ai"])
        room = await self.make_room()
        for player in room.players:
            await app.on_game_action(player.socket_id, {"action": action(room.game_state, "ready")})
        self.assertEqual(room.game_state["phase"], "night")
        wolf = next(player for player in room.players if room.game_state["players"][player.player_id]["role"] == "werewolf")
        victim = next(player for player in room.players if room.game_state["players"][player.player_id]["role"] == "villager")
        app.sio.emits.clear()
        await app.on_game_action(wolf.socket_id, {"action": action(room.game_state, "wolf_vote", target=victim.player_id)})
        updates = [event for event in app.sio.emits if event["event"] == "game:state"]
        self.assertEqual(len(updates), 6)
        for message in updates:
            payload = message["payload"]
            view = payload["view"]
            self.assertEqual(payload["events"], [])
            self.assertNotIn("night", view)
            self.assertNotIn("night_actors", view)
            self.assertIsNone(view["current_turn"])
            self.assertTrue(all(player["role"] is None for player in view["players"]))
            if view["own"]["role"] != "werewolf":
                self.assertEqual(view["wolf_votes"], {})
                self.assertEqual(view["wolf_team"], [])

    async def test_invalid_actions_stay_rejected_with_schema_bypass(self):
        room = await self.make_room()
        for bypass in (False, True):
            for fields in ({"game_token": "old"}, {"window_id": True}, {"type": "shoot", "target": "missing"}):
                previous = copy.deepcopy(room.game_state)
                payload = {**action(room.game_state, "ready"), **fields}
                await app.on_game_action("s0", {"action": payload, "skip_validation": bypass})
                self.assertEqual(previous, room.game_state)
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_wolf_self_attack_respects_dealt_rule_even_with_schema_bypass(self):
        for allowed in (False, True):
            with self.subTest(allowed=allowed):
                room = await self.make_room(allow_wolf_self_attack=allowed)
                for player in room.players:
                    await app.on_game_action(player.socket_id, {"action": action(room.game_state, "ready")})
                wolf = next(player for player in room.players if room.game_state["players"][player.player_id]["role"] == "werewolf")
                for bypass in (False, True):
                    previous = copy.deepcopy(room.game_state)
                    move = action(room.game_state, "wolf_vote", target=wolf.player_id, allow_wolf_self_attack=not allowed)
                    await app.on_game_action(wolf.socket_id, {"action": move, "skip_validation": bypass})
                    self.assertIs(room.game_state["allow_wolf_self_attack"], allowed)
                    if allowed:
                        self.assertEqual(room.game_state["wolf_votes"], {wolf.player_id: wolf.player_id})
                        room.game_state = previous
                    else:
                        self.assertEqual(room.game_state, previous)
                        self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_live_and_cold_private_save_block_download_and_loading(self):
        room = await self.make_room()
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id": room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])

    async def test_authenticated_cold_reconnect_restores_private_identity(self):
        room = await self.make_room()
        player = room.players[0]
        expected = Game.get_public_view(room.game_state, player.player_id)
        app.ROOMS.clear()
        app.SESSIONS.clear()
        credentials = {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token}
        await app.on_room_reconnect("wrong", {**credentials, "reconnect_token": "wrong"})
        self.assertEqual(app.ROOMS, {})
        await app.on_room_reconnect("restored", credentials)
        restored = app.ROOMS[room.room_id]
        self.assertEqual(expected, Game.get_public_view(restored.game_state, player.player_id))

    async def test_hot_reconnect_revokes_previous_socket(self):
        room = await self.make_room()
        player = room.players[0]
        expected = Game.get_public_view(room.game_state, player.player_id)
        await app.on_room_reconnect("replacement", {"room_id": room.room_id, "player_id": player.player_id,
                                                   "reconnect_token": player.reconnect_token})
        self.assertNotIn("s0", app.SESSIONS)
        self.assertEqual(player.socket_id, "replacement")
        self.assertEqual(expected, Game.get_public_view(room.game_state, player.player_id))


if __name__ == "__main__":
    unittest.main()
