import copy
import unittest
from tempfile import TemporaryDirectory

import app
from fastapi import HTTPException
from game.love_letter import LoveLetterGame as Game
from tests.test_room_session import DummySio


class LoveLetterIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def room(self):
        await app.on_room_create("s0", {"name": "Letter 0", "game_type": "love_letter", "config": {}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in [1, 2]:
            await app.on_room_join(f"s{index}", {"name": f"Letter {index}", "room_id": room.room_id})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_room_start(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == "love_letter")
        self.assertEqual((entry["min_players"], entry["max_players"], entry["name_zh"]), (2, 4, "情书"))
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "play")

    async def test_priest_broadcast_and_reconnection_preserve_privacy(self):
        room = await self.room()
        ids = [player.player_id for player in room.players]
        state = room.game_state
        state.update(current_turn=ids[0], turn=1, deck=[1, 3, 4, 5])
        for pid, hand in zip(ids, [[2, 8], [4], [6]]):
            state["players"][pid]["hand"] = hand
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": {"type": "play_card", "round": 1, "turn": 1, "card": 2, "target": ids[2]}})
        updates = [item for item in app.sio.emits if item["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for update in updates:
            view = update["payload"]["view"]
            self.assertEqual(len(view["private_notes"]), 1 if update["to"] == "s0" else 0)
            self.assertEqual(view["players"][2]["revealed_hand"], [])
            self.assertNotIn("private_notes", update["payload"]["events"][0]["payload"])
        player = room.players[0]
        await app.disconnect("s0")
        app.sio.emits.clear()
        await app.on_room_reconnect("new0", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        view = next(item["payload"]["view"] for item in app.sio.emits if item["event"] == "game:state" and item["to"] == "new0")
        self.assertEqual(view["private_notes"][0]["card"], 6)

    async def test_invalid_action_and_stale_turn_do_not_mutate(self):
        room = await self.room()
        actor = room.game_state["current_turn"]
        sid = next(player.socket_id for player in room.players if player.player_id == actor)
        action = Game.bot_move(room.game_state, actor)
        before = copy.deepcopy(room.game_state)
        await app.on_game_action(sid, {"skip_validation": True, "action": {**action, "turn": 999}})
        self.assertEqual(room.game_state, before)
        await app.on_game_action(sid, {"action": action})
        before = copy.deepcopy(room.game_state)
        await app.on_game_action(sid, {"action": action})
        self.assertEqual(room.game_state, before)

    async def test_round_waits_for_disconnected_eliminated_player(self):
        room = await self.room()
        state = room.game_state
        ids = [player.player_id for player in room.players]
        state.update(current_turn=ids[0], turn=1, deck=[])
        for pid, hand in zip(ids, [[1, 7], [8], [4]]):
            state["players"][pid]["hand"] = hand
        await app.on_game_action("s0", {"action": {"type": "play_card", "round": 1, "turn": 1, "card": 1, "target": ids[1], "guess": 8}})
        for sid in ["s0", "s2"]:
            await app.on_game_action(sid, {"action": {"type": "next_round", "round": 1}})
        await app.disconnect("s1")
        self.assertEqual(state["phase"], "round_end")
        player = room.players[1]
        await app.on_room_reconnect("back1", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        await app.on_game_action("back1", {"action": {"type": "next_round", "round": 1}})
        self.assertEqual((state["phase"], state["round"]), ("play", 2))

    async def test_live_save_cannot_reveal_hands_or_clone_and_cold_restore_works(self):
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
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in app.sio.emits if item["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        self.assertEqual(app.ROOMS[result["room_id"]].game_state, room.game_state)
        self.assertTrue(app._has_live_private_save(room.room_id, "love_letter"))


if __name__ == "__main__":
    unittest.main()
