"""Room protocol coverage for the cooperative Spirit Island game."""

import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game import get_game
from game.spirit_island import SpiritIslandGame as Game
from tests.test_room_session import DummySio


class SpiritIslandIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def room(self, count=2):
        await app.on_room_create("s0", {
            "name": "守护者 Alice", "game_type": "spirit_island",
            "config": {"seed": "spirit-private-test-seed"},
        })
        rid = app.SESSIONS["s0"]["room_id"]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {
                "name": f"Guardian {index}", "room_id": rid,
            })
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_solo_room(self):
        entry = next(item for item in await app.api_list_games()
                     if item["game_id"] == "spirit_island")
        self.assertEqual((entry["min_players"], entry["max_players"]), (1, 4))
        self.assertEqual(entry["name_zh"], "灵迹岛")
        self.assertIn("cooperative", [tag["id"] for tag in entry["tags"]])
        room = await self.room(1)
        self.assertEqual((room.status, room.game_state["phase"]),
                         ("in_game", "choose_spirit"))

    async def test_room_rejects_fifth_player(self):
        room = await self.room(4)
        await app.on_room_join("extra", {"name": "Extra", "room_id": room.room_id})
        self.assertEqual(len(room.players), 4)
        self.assertNotIn("extra", app.SESSIONS)

    async def test_broadcast_never_exposes_seed_or_future_decks(self):
        await self.room()
        self.assertNotIn("spirit-private-test-seed", json.dumps(app.sio.emits))
        for emission in app.sio.emits:
            if emission["event"] == "game:state":
                view = emission["payload"]["view"]
                self.assertNotIn("seed", view)
                self.assertNotIn("invader_deck", view)
                self.assertNotIn("fear_deck", view)

    async def test_socket_action_and_bad_action_are_atomic(self):
        room = await self.room()
        player = room.players[0]
        options = Game.get_public_view(room.game_state, player.player_id)["action_options"]
        self.assertTrue(options)
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True,
                                        "action": {"type": "choose_spirit", "spirit_id": "invalid"}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(e["event"] == "system:error" for e in app.sio.emits))
        await app.on_game_action("s0", {"action": options[0]["action"]})
        self.assertNotEqual(room.game_state, before)
        self.assertEqual(room.state_version, 2)

    async def test_disconnect_reconnect_preserves_view_and_save(self):
        room = await self.room()
        player = room.players[0]
        option = Game.get_public_view(room.game_state, player.player_id)["action_options"][0]
        await app.on_game_action("s0", {"action": option["action"]})
        expected = Game.get_public_view(room.game_state, player.player_id)
        definition = get_game("spirit_island")
        restored = definition.deserialize(json.loads(json.dumps(definition.serialize(room.game_state))))
        self.assertEqual(Game.get_public_view(restored, player.player_id), expected)
        await app.disconnect("s0")
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        update = next(e["payload"] for e in app.sio.emits
                      if e["event"] == "game:state" and e["to"] == "s-new")
        self.assertEqual(update["view"], expected)


if __name__ == "__main__":
    unittest.main()
