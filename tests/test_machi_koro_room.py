import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game import MachiKoroGame
from game.machi_koro import _effect, _new_card
from tests.test_room_session import DummySio


class MachiKoroRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio = app.sio
        self.original_dir = app.DATA_DIR
        self.original_rooms = dict(app.ROOMS)
        self.original_sessions = dict(app.SESSIONS)
        self.temp_dir = TemporaryDirectory()
        app.sio = DummySio()
        app.DATA_DIR = self.temp_dir.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("first", {"name": "First", "game_type": "machi_koro"})
        self.room_id = app.SESSIONS["first"]["room_id"]
        self.room = app.ROOMS[self.room_id]
        await app.on_room_join("second", {"name": "Second", "room_id": self.room_id})
        await app.on_room_ready("second", {"ready": True})

    async def asyncTearDown(self):
        await asyncio.sleep(0)
        app.sio = self.original_sio
        app.DATA_DIR = self.original_dir
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.temp_dir.cleanup()

    async def start(self, edition="all"):
        await app.on_room_start("first", {"config": {"edition": edition, "market": "all", "seed": 17}})
        self.assertEqual(self.room.status, "in_game")

    async def test_config_start_and_legal_roll(self):
        await self.start("harbor")
        self.assertEqual(self.room.game_state["config"]["edition"], "harbor")
        self.assertEqual(len(self.room.game_state["landmark_ids"]), 6)
        await app.on_game_action("first", {"action": {"type": "roll", "dice": 1}})
        self.assertTrue(self.room.game_state["dice"])
        self.assertEqual(self.room.state_version, 2)

    async def test_seed_and_deck_are_not_broadcast(self):
        await self.start()
        app.sio.emits.clear()
        await app._emit_room_state(self.room)
        await app._emit_game_state(self.room, [])
        events = {entry["event"] for entry in app.sio.emits}
        self.assertTrue({"room:state", "game:state"} <= events)
        for entry in app.sio.emits:
            payload = entry["payload"]
            if entry["event"] == "room:state":
                self.assertNotIn("seed", payload["game_config"])
            if entry["event"] == "game:state":
                self.assertFalse({"seed", "deck", "roll_serial"} & payload["view"].keys())

    async def test_out_of_turn_bad_schema_and_unaffordable_build_are_atomic(self):
        await self.start()
        before = copy.deepcopy(self.room.game_state)
        for sid, action in (("second", {"type": "roll", "dice": 1}),
                            ("first", {"type": "roll", "dice": 2}),
                            ("first", {"type": "roll", "dice": 1, "extra": True})):
            await app.on_game_action(sid, {"action": action})
            self.assertEqual(before, self.room.game_state)
            self.assertEqual(self.room.state_version, 1)

    async def test_reconnect_and_save_restore_pending_trade(self):
        await self.start()
        state = self.room.game_state
        first = self.room.players[0]
        card = _new_card(state, "business_center")
        state["players"][first.player_id]["cards"].append(card)
        _effect(state, first.player_id, card)
        before = copy.deepcopy(state)
        await app.on_room_reconnect("reconnected", {"room_id": self.room_id, "player_id": first.player_id,
                                                    "reconnect_token": first.reconnect_token})
        self.assertEqual(app.SESSIONS["reconnected"]["player_id"], first.player_id)
        self.assertEqual(before, self.room.game_state)
        self.room.auto_save = True
        app._save_room_state(self.room)
        saved = app._load_latest_save(self.room_id)
        self.assertEqual(MachiKoroGame.deserialize(saved["game_state"]), before)
        await app.on_game_action("reconnected", {"action": {"type": "choose", "choice": 0}})
        self.assertIsNone(self.room.game_state["pending"])

    async def test_catalog_bot_and_five_seats(self):
        catalog = {entry["game_id"]: entry for entry in await app.api_list_games()}
        self.assertTrue(catalog["machi_koro"]["has_strategic_ai"])
        for _ in range(3):
            await app.on_room_add_bot("first", {})
        self.assertEqual(len(self.room.players), 5)
        await app.on_room_add_bot("first", {})
        self.assertEqual(len(self.room.players), 5)
        await self.start()
        bot_id = self.room.players[-1].player_id
        self.room.game_state["current_turn"] = bot_id
        self.assertIsNotNone(MachiKoroGame.bot_move(self.room.game_state, bot_id))


if __name__ == "__main__":
    unittest.main()
