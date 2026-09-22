import copy
import unittest
from tempfile import TemporaryDirectory

import app
from fastapi import HTTPException
from game.boomerang_australia import BoomerangAustraliaGame as Game
from tests.test_room_session import DummySio


class BoomerangAustraliaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
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
            "name": "Traveler 0", "game_type": "boomerang_australia",
            "config": {"seed": 104, "direction_variant": True},
        })
        rid = app.SESSIONS["s0"]["room_id"]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {"name": f"Traveler {index}", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_start_and_private_seed(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == Game.game_id)
        self.assertEqual((entry["min_players"], entry["max_players"]), (2, 4))
        self.assertEqual(entry["name_zh"], "世界巡游（澳洲）")
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "draft")
        for emitted in app.sio.emits:
            if emitted["event"] == "room:state":
                self.assertNotIn("seed", emitted["payload"]["game_config"])
            if emitted["event"] == "game:state":
                view = emitted["payload"]["view"]
                self.assertNotIn("seed", view["config"])
                self.assertEqual(len(view["hand"]), 7)
                self.assertTrue(all("hand" not in player for player in view["players"]))

    async def test_pending_selection_hidden_and_bot_action_sanitized(self):
        room = await self.room()
        actor, other = room.players
        action = Game.bot_move(room.game_state, actor.player_id)
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action})
        updates = [item for item in app.sio.emits if item["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        own = next(item["payload"]["view"] for item in updates if item["to"] == "s0")
        opponent = next(item["payload"]["view"] for item in updates if item["to"] == "s1")
        self.assertEqual(own["pending_card"], action["card_id"])
        self.assertIsNone(opponent["pending_card"])
        self.assertEqual(app._public_bot_action(Game.game_id, action), {"type": "draft_card"})
        self.assertTrue(all("card_id" not in event for item in updates for event in item["payload"]["events"]))
        await app.on_game_action("s1", {"action": Game.bot_move(room.game_state, other.player_id)})
        opponent = Game.get_public_view(room.game_state, other.player_id)
        actor_view = next(player for player in opponent["players"] if player["player_id"] == actor.player_id)
        self.assertIsNone(actor_view["cards"][0])

    async def test_schema_bypass_and_stale_pick_do_not_change_state(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {
            "type": "draft_card", "round": 1, "pick": 1, "card_id": "fake",
        }})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(item["event"] == "system:error" for item in app.sio.emits))
        old_action = Game.bot_move(room.game_state, room.players[0].player_id)
        for index, player in enumerate(room.players):
            await app.on_game_action(f"s{index}", {"action": Game.bot_move(room.game_state, player.player_id)})
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"action": old_action})
        self.assertEqual(room.game_state, before)

    async def test_round_review_waits_for_reconnected_human(self):
        room = await self.room()
        for _ in range(40):
            if room.game_state["phase"] == "round_end":
                break
            for index, player in enumerate(room.players):
                if room.game_state["phase"] == "round_end":
                    break
                action = Game.bot_move(room.game_state, player.player_id)
                if action:
                    await app.on_game_action(f"s{index}", {"action": action})
        self.assertEqual(room.game_state["phase"], "round_end")
        await app.on_game_action("s0", {"action": {"type": "next_round", "round": 1}})
        player = room.players[1]
        await app.disconnect("s1")
        self.assertEqual(room.game_state["phase"], "round_end")
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        view = next(item["payload"]["view"] for item in app.sio.emits
                    if item["event"] == "game:state" and item["to"] == "s-new")
        self.assertEqual(view["phase"], "round_end")
        self.assertIn(room.players[0].player_id, view["next_ready"])
        await app.on_game_action("s-new", {"action": {"type": "next_round", "round": 1}})
        self.assertEqual((room.game_state["round"], room.game_state["phase"]), (2, "draft"))

    async def test_live_save_cannot_export_or_clone_hidden_hands(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        with self.assertRaises(HTTPException) as raised:
            await app.download_room_save(room.room_id)
        self.assertEqual(raised.exception.status_code, 403)
        before = set(app.ROOMS)
        await app.on_room_load("outsider", {"source_room_id": room.room_id})
        self.assertEqual(set(app.ROOMS), before)
        self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        # A cold server can still recover its own stored game normally.
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in app.sio.emits if item["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, room.game_state)
        self.assertTrue(app._has_live_boomerang_save(room.room_id))
        with self.assertRaises(HTTPException):
            await app.download_room_save(room.room_id)


if __name__ == "__main__":
    unittest.main()
