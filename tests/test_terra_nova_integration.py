"""Terra Nova registration, Socket.IO validation, and reconnect coverage."""

import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game import get_game
from game.terra_nova import TerraNovaGame as Game
from tests.test_room_session import DummySio


class TerraNovaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms = dict(app.ROOMS)
        self.previous_sessions = dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.sio.get_environ = lambda _sid: {}
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def make_room(self, count=2):
        await app.on_room_create("s0", {
            "name": "拓荒者 Alice", "game_type": "terra_nova",
            "config": {"seed": 106921},
        })
        rid = app.SESSIONS["s0"]["room_id"]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {
                "name": f"Settler {index}", "room_id": rid,
            })
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_two_player_start(self):
        entry = next(item for item in await app.api_list_games()
                     if item["game_id"] == "terra_nova")
        self.assertEqual((entry["min_players"], entry["max_players"]), (2, 4))
        self.assertEqual(entry["name_zh"], "神秘小地")
        self.assertIn("euro", [tag["id"] for tag in entry["tags"]])
        room = await self.make_room()
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "choose_faction")

    async def test_solo_cannot_start(self):
        room = await self.make_room(1)
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)

    async def test_fifth_player_cannot_join(self):
        room = await self.make_room(4)
        await app.on_room_join("extra", {"name": "Extra", "room_id": room.room_id})
        self.assertEqual(len(room.players), 4)
        self.assertNotIn("extra", app.SESSIONS)

    async def test_seed_not_in_broadcasts(self):
        await self.make_room()
        self.assertNotIn("106921", json.dumps(app.sio.emits))
        for emission in app.sio.emits:
            if emission["event"] == "game:state":
                self.assertNotIn("seed", emission["payload"]["view"])

    async def test_socket_actions_validate_and_update(self):
        room = await self.make_room()
        pid = room.game_state["current_turn"]
        seat = next(index for index, p in enumerate(room.players) if p.player_id == pid)
        options = Game.get_public_view(room.game_state, pid)["action_options"]
        self.assertTrue(options)
        before = copy.deepcopy(room.game_state)
        bad = dict(options[0]["action"], faction="does-not-exist", faction_id="does-not-exist")
        await app.on_game_action(f"s{seat}", {"skip_validation": True, "action": bad})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(e["event"] == "system:error" for e in app.sio.emits))
        await app.on_game_action(f"s{seat}", {"action": options[0]["action"]})
        self.assertNotEqual(room.game_state, before)
        self.assertEqual(room.state_version, 2)

    async def test_reconnect_and_json_save_preserve_choices(self):
        room = await self.make_room()
        player = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        seat = room.players.index(player)
        option = Game.get_public_view(room.game_state, player.player_id)["action_options"][0]
        await app.on_game_action(f"s{seat}", {"action": option["action"]})
        expected = Game.get_public_view(room.game_state, player.player_id)
        definition = get_game("terra_nova")
        restored = definition.deserialize(json.loads(json.dumps(definition.serialize(room.game_state))))
        self.assertEqual(Game.get_public_view(restored, player.player_id), expected)
        await app.disconnect(f"s{seat}")
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        update = next(e["payload"] for e in app.sio.emits
                      if e["event"] == "game:state" and e["to"] == "s-new")
        self.assertEqual(update["view"], expected)
