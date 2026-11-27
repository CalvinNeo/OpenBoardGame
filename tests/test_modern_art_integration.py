import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

import app
from game.modern_art import ModernArtGame as Game
from tests.test_modern_art import action, give
from tests.test_room_session import DummySio


class ModernArtIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("seller", {"name": "Alice", "game_type": "modern_art"})
        self.room = app.ROOMS[app.SESSIONS["seller"]["room_id"]]
        for socket_id, name in (("buyer", "Bob"), ("third", "Carol")):
            await app.on_room_join(socket_id, {"room_id": self.room.room_id, "name": name})
        for player in self.room.players:
            player.ready = True
        await app.on_room_start("seller", {})

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def sealed_bid(self):
        state = self.room.game_state
        player = self.room.players[0]
        card = "lite_metal-sealed-0"
        give(state, player.player_id, card)
        await app.on_game_action("seller", {"action": action(state, "offer", cards=[card])})
        self.assertEqual(state["phase"], "sealed")
        await app.on_game_action("buyer", {"action": action(state, "bid", amount=17)})

    async def test_catalog_and_recipient_views(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "modern_art")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("现代艺术", 3, 5))
        self.assertIn("auction", {tag["id"] for tag in row["tags"]})
        self.assertTrue(row["has_strategic_ai"])
        await self.sealed_bid()
        app.sio.emits.clear()
        await app._emit_game_state(self.room)
        messages = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for entry in messages:
            view = entry["payload"]["view"]
            player_id = app.SESSIONS[entry["to"]]["player_id"]
            self.assertEqual(view["hand"], self.room.game_state["players"][player_id]["hand"])
            self.assertEqual(view["auction"]["bids"], {})
            self.assertEqual(view["your_bid"], 17 if entry["to"] == "buyer" else None)
            self.assertTrue(all(player["cash"] is None for player in view["players"] if player["player_id"] != player_id))
        self.assertEqual(app._public_bot_action("modern_art", {"type": "bid", "amount": 17}), {"type": "bid"})

    async def test_validation_bypass_and_replays(self):
        await self.sealed_bid()
        state = self.room.game_state
        for skip in (False, True):
            for invalid in (action(state, "bid", amount=True), action(state, "bid", amount=101),
                            {**action(state, "bid", amount=1), "game_token": "old-game"}):
                before = copy.deepcopy(state)
                await app.on_game_action("third", {"skip_validation": skip, "action": invalid})
                self.assertEqual(state, before)
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")
        before = copy.deepcopy(state)
        await app.on_game_action("buyer", {"action": action(state, "bid", amount=19)})
        self.assertEqual(state, before)

    async def test_cold_reconnect_and_protected_save(self):
        await self.sealed_bid()
        self.room.auto_save = True
        app._save_room_state(self.room)
        with self.assertRaises(HTTPException) as caught:
            await app.download_room_save(self.room.room_id)
        self.assertEqual(caught.exception.status_code, 403)
        saved = copy.deepcopy(self.room.game_state)
        player = self.room.players[1]
        app.ROOMS.clear()
        app.SESSIONS.clear()
        with self.assertRaises(HTTPException):
            await app.download_room_save(self.room.room_id)
        await app.on_room_load("outsider", {"source_room_id": self.room.room_id})
        self.assertFalse(app.ROOMS)
        with patch.object(app, "_maybe_run_bots", return_value=None):
            await app.on_room_reconnect("wrong", {"room_id": self.room.room_id,
                "player_id": player.player_id, "reconnect_token": "wrong"})
            self.assertFalse(app.ROOMS)
            await app.on_room_reconnect("back", {"room_id": self.room.room_id,
                "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        restored = app.ROOMS[self.room.room_id]
        self.assertEqual(restored.game_state, saved)
        updates = [entry for entry in app.sio.emits if entry["event"] == "game:state" and entry["to"] == "back"]
        self.assertEqual(updates[-1]["payload"]["view"]["your_bid"], 17)
        self.assertEqual(updates[-1]["payload"]["view"]["auction"]["bids"], {})

    async def test_final_confirmation_and_play_again(self):
        state = self.room.game_state
        for _ in range(5000):
            if state["phase"] == "round_end" and state["round"] == 4:
                break
            for player_id in state["turn_order"]:
                move = Game.bot_move(state, player_id)
                if move:
                    self.assertIsNone(Game.apply_action(state, player_id, move)[1])
                    break
        self.assertEqual(state["phase"], "round_end")
        self.assertFalse(state["game_over"])
        for index, player in enumerate(self.room.players):
            await app.on_game_action(player.socket_id, {"action": action(state, "next_round")})
            self.assertEqual(self.room.status, "game_over" if index == 2 else "in_game")
        self.assertEqual(len(state["final_results"]), 3)
        previous_token = state["game_token"]
        await app.on_room_start("seller", {})
        self.assertEqual(self.room.status, "in_game")
        self.assertNotEqual(self.room.game_state["game_token"], previous_token)
        self.assertEqual(self.room.game_state["round"], 1)
