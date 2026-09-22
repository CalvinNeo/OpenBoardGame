import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.cryptid import CryptidGame as Game
from tests.test_room_session import DummySio


class CryptidIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.sio.get_environ = lambda _sid: {}
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def room(self, count=3):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "cryptid", "config": {"seed": "private-puzzle-seed", "advanced": True}})
        rid = app.SESSIONS["s0"]["room_id"]
        for i in range(1, count):
            await app.on_room_join(f"s{i}", {"name": f"Explorer {i}", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_room_privacy(self):
        game = next(item for item in await app.api_list_games() if item["game_id"] == "cryptid")
        self.assertEqual((game["name_zh"], game["min_players"], game["max_players"]), ("诡影寻踪", 3, 5))
        room = await self.room()
        self.assertEqual((room.status, room.game_state["phase"]), ("in_game", "initial_clues"))
        for message in app.sio.emits:
            self.assertNotIn("private-puzzle-seed", json.dumps(message))
            if message["event"] == "game:state":
                view = message["payload"]["view"]
                self.assertNotIn("solution", view)
                self.assertNotIn("clues", view)
                self.assertEqual(view["my_clue"], room.game_state["clues"][view["you"]])

    async def test_two_players_cannot_start(self):
        room = await self.room(2)
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)

    async def test_private_notes_never_appear_in_other_messages(self):
        room = await self.room()
        notes = {"text": "my_private_notes_sentinel", "cells": {"A1": "candidate"}, "clues": {}}
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": {"type": "update_notes", "notes": notes}})
        updates = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for message in updates:
            self.assertNotIn(notes["text"], json.dumps(message["payload"]["events"]))
            self.assertEqual(notes["text"] in json.dumps(message), message["to"] == "s0")
        self.assertEqual(app._public_bot_action("cryptid", {"type": "update_notes", "notes": notes}), {"type": "update_notes"})
        self.assertEqual(room.game_state["phase"], "initial_clues")

    async def test_skip_schema_validation_cannot_bypass_engine(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {"type": "search", "cell_id": room.game_state["solution"], "override": True}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(message["event"] == "system:error" for message in app.sio.emits))

    async def test_reconnect_preserves_clue_notes_and_review_barrier(self):
        room = await self.room()
        state = room.game_state
        for pid in state["turn_order"]:
            events, error = Game.apply_action(state, pid, Game.bot_move(state, pid))
            self.assertIsNone(error)
        for player in room.players[:-1]:
            self.assertIsNone(Game.apply_action(state, player.player_id, {"type": "next_round"})[1])
        before = copy.deepcopy(state)
        player = room.players[-1]
        await app.disconnect(player.socket_id)
        self.assertEqual(state, before)
        app.sio.emits.clear()
        await app.on_room_reconnect("new", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        message = next(m for m in app.sio.emits if m["event"] == "game:state" and m["to"] == "new")
        self.assertEqual(message["payload"]["view"]["my_clue"], before["clues"][player.player_id])
        self.assertEqual(state["phase"], "round_end")
        await app.on_game_action("new", {"action": {"type": "next_round"}})
        self.assertEqual((state["phase"], state["initial_pass"]), ("initial_clues", 2))

    async def test_bot_scheduler_plays_and_waits_for_human_review(self):
        room = await self.room()
        human, first_bot, second_bot = room.players
        state = room.game_state
        for player in (first_bot, second_bot):
            player.is_bot = True
            state["players"][player.player_id]["is_bot"] = True
        state["turn_order"] = [first_bot.player_id, second_bot.player_id, human.player_id]
        state["current_turn"] = first_bot.player_id
        await app._maybe_run_bots(room)
        for _ in range(200):
            if not room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(state["current_turn"], human.player_id)
        self.assertEqual(sum(bool(m["cube"]) for m in state["markers"].values()), 2)
        await app.on_game_action("s0", {"action": Game.bot_move(state, human.player_id)})
        for _ in range(200):
            if not room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(set(state["next_ready"]), {first_bot.player_id, second_bot.player_id})


if __name__ == "__main__":
    unittest.main()
