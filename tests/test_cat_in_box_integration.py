import random
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.cat_in_box import CatInBoxGame as Game
from tests.test_room_session import DummySio


class CatInBoxIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.random_state = random.getstate()
        random.seed(26)
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
        random.setstate(self.random_state)
        self.temp.cleanup()

    async def make_room(self):
        await app.on_room_create("human", {"name": "Alice", "game_type": Game.game_id})
        room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
        for index in range(2):
            await app.on_room_add_bot("human", {"room_id": room.room_id})
        for player in room.players:
            player.ready = True
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_start("human", {})
        self.assertEqual(room.status, "in_game")
        self.assertEqual(sum(player.is_bot for player in room.players), 2)
        return room

    async def run_bots(self, room):
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app._maybe_run_bots(room)
        with patch.object(app.asyncio, "sleep", new_callable=AsyncMock):
            for runner in runners:
                await runner
        self.assertFalse(room.bot_running)

    async def test_catalog_marks_cat_in_box_as_strategic(self):
        entry = next(game for game in await app.api_list_games() if game["game_id"] == Game.game_id)
        self.assertTrue(entry["has_strategic_ai"])
        self.assertEqual((entry["min_players"], entry["max_players"]), (2, 5))

    async def test_bot_discard_events_do_not_reveal_cards(self):
        room = await self.make_room()
        app.sio.emits.clear()
        await self.run_bots(room)
        self.assertEqual(room.game_state["phase"], "discard")
        self.assertEqual(sum(player["discarded"] for player in room.game_state["players"].values()), 2)
        updates = [message for message in app.sio.emits if message["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        for message in updates:
            self.assertEqual(message["to"], "human")
            payload = message["payload"]
            self.assertEqual(len(payload["view"]["hand"]), 10)
            self.assertTrue(all("hand" not in player for player in payload["view"]["players"]))
            activity = next(event for event in payload["events"] if event["type"] == "bot:action")
            self.assertEqual(activity["payload"]["action"], {"type": "discard"})
            discard = next(event for event in payload["events"] if event["type"] == "cat_in_box:discard")
            self.assertEqual(set(discard["payload"]), {"player_id"})

    async def test_public_bid_and_play_actions_remain_visible(self):
        for action in (
            {"type": "bid", "bid": 2},
            {"type": "play_card", "card_value": 4, "color": "red"},
        ):
            self.assertEqual(app._public_bot_action(Game.game_id, action), action)
        discard = {"type": "discard", "card_value": 5}
        self.assertEqual(app._public_bot_action(Game.game_id, discard), {"type": "discard"})
        self.assertEqual(discard, {"type": "discard", "card_value": 5})

    async def test_human_and_bots_finish_all_rounds(self):
        room = await self.make_room()
        human_id = app.SESSIONS["human"]["player_id"]
        for step in range(100):
            await self.run_bots(room)
            if room.status == "game_over":
                break
            action = Game.bot_move(room.game_state, human_id)
            self.assertIsNotNone(action, (step, room.game_state["phase"]))
            with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
                await app.on_game_action("human", {"action": action})
        self.assertEqual(room.status, "game_over")
        self.assertEqual(room.game_state["round"], 3)
        self.assertTrue(room.game_state["winners"])
        self.assertFalse(any(message["event"] == "system:error" for message in app.sio.emits))
        kinds = {
            event["payload"]["action"]["type"]
            for message in app.sio.emits if message["event"] == "game:state"
            for event in message["payload"]["events"] if event["type"] == "bot:action"
        }
        self.assertEqual(kinds, {"discard", "bid", "play_card"})


if __name__ == "__main__":
    unittest.main()
