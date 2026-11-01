import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from game.chromino import ChrominoGame as Game, legal_placements
from tests.test_room_session import DummySio


class ChrominoIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
        for attempt in range(300):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(0.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, count=2, bot=False):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "chromino", "config": {}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        if bot:
            await app.on_room_add_bot("s0", {})
        else:
            for index in range(1, count):
                await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Guest {index}"})
        for player in room.players:
            player.ready = True
        with patch("game.chromino.random.randrange", return_value=0), patch(
            "game.chromino.random.choice", return_value="chameleon_0"
        ), patch("game.chromino.random.shuffle"):
            await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_solo_start(self):
        game = next(game for game in await app.api_list_games() if game["game_id"] == "chromino")
        self.assertEqual((game["name_zh"], game["min_players"], game["max_players"]), ("缤纷多米诺", 1, 8))
        self.assertEqual([tag["id"] for tag in game["tags"]], ["filler", "abstract"])
        room = await self.make_room(count=1)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)
        self.assertEqual(len(room.game_state["bag"]), 71)

    async def test_eight_players_can_start_and_ninth_cannot_join(self):
        room = await self.make_room(count=8)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(len(room.game_state["players"]), 8)
        self.assertEqual(len(room.game_state["bag"]), 15)
        await app.on_room_join("s9", {"room_id": room.room_id, "name": "Extra"})
        self.assertEqual(len(room.players), 8)
        self.assertTrue(any(message["event"] == "system:error" and message["to"] == "s9" for message in app.sio.emits))

    async def test_action_broadcast_has_individual_private_hands(self):
        room = await self.make_room()
        current_id = room.game_state["current_turn"]
        move = legal_placements(room.game_state, current_id)[0]
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": move})
        updates = [message for message in app.sio.emits if message["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        self.assertEqual(room.game_state["ply"], 1)
        self.assertTrue(all(len(message["payload"]["view"]["placed_tiles"]) == 2 for message in updates))
        for message in updates:
            viewer = room.players[int(message["to"][1:])].player_id
            view = message["payload"]["view"]
            self.assertEqual([tile["tile_id"] for tile in view["hand"]], room.game_state["players"][viewer]["hand"])
            self.assertNotIn("bag", view)
        own = next(message["payload"]["view"] for message in updates if message["to"] == "s0")
        self.assertEqual(own["legal_placements"], [])

    async def test_bot_takes_legal_turn_and_waits_for_human(self):
        room = await self.make_room(bot=True)
        await app.on_game_action("s0", {"action": legal_placements(room.game_state, room.players[0].player_id)[0]})
        for attempt in range(400):
            if not room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(room.game_state["ply"], 2)
        self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)

    async def test_reconnect_json_and_room_save_load_preserve_state(self):
        room = await self.make_room()
        human = room.players[0]
        await app.on_game_action("s0", {"action": legal_placements(room.game_state, human.player_id)[0]})
        before = copy.deepcopy(room.game_state)
        await app.disconnect("s0")
        await app.on_room_reconnect("new", {
            "room_id": room.room_id, "player_id": human.player_id, "reconnect_token": human.reconnect_token,
        })
        self.assertEqual(room.game_state, before)
        update = next(message for message in app.sio.emits if message["event"] == "game:state" and message["to"] == "new")
        self.assertEqual(update["payload"]["view"], Game.get_public_view(before, human.player_id))
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(before))))
        self.assertEqual(restored, before)
        room.auto_save = True
        app._save_room_state(room)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        response = next(message["payload"] for message in app.sio.emits if message["event"] == "room:load_result" and message["to"] == "loader")
        self.assertTrue(response["ok"])
        self.assertEqual(app.ROOMS[response["room_id"]].game_state, before)

    async def test_disabled_schema_validation_cannot_allow_invalid_placement(self):
        room = await self.make_room()
        before = copy.deepcopy(room.game_state)
        action = legal_placements(room.game_state, room.players[0].player_id)[0]
        await app.on_game_action("s0", {"skip_validation": True, "action": {**action, "x": True}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(message["event"] == "system:error" for message in app.sio.emits))

    async def test_game_over_transitions_room_and_preserves_final_board(self):
        room = await self.make_room(count=1)
        player_id = room.players[0].player_id
        action = next(move for move in legal_placements(room.game_state, player_id) if not move["tile_id"].startswith("chameleon"))
        room.game_state["players"][player_id]["hand"] = [action["tile_id"]]
        await app.on_game_action("s0", {"action": action})
        self.assertEqual(room.status, "game_over")
        self.assertEqual(room.game_state["winner"], [player_id])
        self.assertEqual(len(room.game_state["board"]), 6)
        final = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"action": action})
        self.assertEqual(room.game_state, final)


if __name__ == "__main__":
    unittest.main()
