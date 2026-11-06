import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from game.high_society import HighSocietyGame as Game, STATUS_CARDS
from tests.test_room_session import DummySio


class HighSocietyIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio, self.original_data = app.sio, app.DATA_DIR
        self.original_rooms, self.original_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.directory = TemporaryDirectory()
        self.room = None
        app.sio, app.DATA_DIR = DummySio(), self.directory.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        if self.room:
            self.room.status = "lobby"
            await self.wait_for_bots()
        app.sio, app.DATA_DIR = self.original_sio, self.original_data
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.directory.cleanup()

    async def wait_for_bots(self):
        for attempt in range(500):
            if not self.room.bot_running:
                return
            await asyncio.sleep(0.01)
        self.fail("High Society bots did not yield to the human")

    async def make_room(self):
        await app.on_room_create("human", {"name": "Host", "game_type": "high_society"})
        await app.on_room_add_bot("human", {})
        await app.on_room_add_bot("human", {})
        self.room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
        deck = [copy.deepcopy(card) for card in STATUS_CARDS if card["id"] != "luxury_10"]
        deck.append(copy.deepcopy(STATUS_CARDS[9]))
        with patch("game.high_society._build_status_deck", return_value=deck), patch("game.high_society.random.choice", side_effect=lambda players: players[1]):
            await app.on_room_start("human", {})
        await self.wait_for_bots()
        return self.room

    async def test_catalog_exposes_strategic_ai_and_existing_bot_support(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == "high_society")
        self.assertTrue(entry["has_strategic_ai"])
        room = await self.make_room()
        self.assertEqual(room.status, "in_game")
        self.assertEqual(sum(player.is_bot for player in room.players), 2)
        self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)
        self.assertGreater(room.game_state["current_high_bid"], 0)
        bot_events = [event for message in app.sio.emits if message["event"] == "game:state"
                      for event in message["payload"].get("events", []) if event["type"] == "bot:action"]
        self.assertTrue(any(event["payload"]["action"]["type"] == "bid" for event in bot_events))
        human_view = Game.get_public_view(room.game_state, room.players[0].player_id)
        self.assertTrue(all(player["hand_money"] is None for player in human_view["players"]))

    async def test_bots_review_but_do_not_skip_human_confirmation(self):
        room = await self.make_room()
        await app.on_game_action("human", {"action": {"type": "pass"}})
        await self.wait_for_bots()
        self.assertEqual(room.game_state["phase"], "round_summary")
        self.assertEqual(room.game_state["round"], 1)
        self.assertEqual(set(room.game_state["next_ready"]), {player.player_id for player in room.players if player.is_bot})
        await app.on_game_action("human", {"action": {"type": "next_round"}})
        await self.wait_for_bots()
        self.assertEqual(room.game_state["round"], 2)
        self.assertFalse(any(message["event"] == "system:error" for message in app.sio.emits))


if __name__ == "__main__":
    unittest.main()
