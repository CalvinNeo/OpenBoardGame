import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory

import app
from game.six_nimmt import SixNimmtGame as Game
from tests.test_room_session import DummySio


class SixNimmtIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        self.original_tasks = asyncio.all_tasks()

    async def asyncTearDown(self):
        tasks = asyncio.all_tasks() - self.original_tasks - {asyncio.current_task()}
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def create_room(self, bots=False):
        await app.on_room_create("s0", {"name": "Alex", "game_type": "six_nimmt",
            "config": {"selection_timeout_sec": 0, "row_choice_timeout_sec": 0}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        if bots:
            await app.on_room_add_bot("s0", {"name": "Risk Bot"})
        else:
            await app.on_room_join("s1", {"name": "River", "room_id": room.room_id})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def wait_for_bots(self, room):
        for attempt in range(150):
            await asyncio.sleep(0.02)
            if not room.bot_running:
                return
        self.fail("Bot scheduler did not settle")

    async def test_broadcast_reconnect_and_saved_choices_remain_private(self):
        room = await self.create_room()
        player = room.players[0]
        chosen = room.game_state["players"][player.player_id]["hand"][0]
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": {"type": "select_card", "value": chosen["value"]}})
        updates = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        for entry in updates:
            payload = entry["payload"]
            self.assertEqual(payload["view"]["selected_card"], chosen if entry["to"] == "s0" else None)
            self.assertNotIn(chosen["value"], payload["view"]["seen_cards"])
            self.assertEqual(payload["events"], [{"type": "six_nimmt:select", "payload": {"player_id": player.player_id}}])
        saved = copy.deepcopy(Game.serialize(room.game_state))
        restored = Game.deserialize(saved)
        self.assertEqual(Game.get_public_view(restored, player.player_id)["selected_card"], chosen)
        await app.disconnect("s0")
        app.sio.emits.clear()
        await app.on_room_reconnect("back0", {"room_id": room.room_id, "player_id": player.player_id,
                                             "reconnect_token": player.reconnect_token})
        view = next(entry["payload"]["view"] for entry in app.sio.emits
                    if entry["event"] == "game:state" and entry["to"] == "back0")
        self.assertEqual(view["selected_card"], chosen)
        self.assertEqual(view["legal_actions"], [])

    async def test_scheduler_uses_strategy_without_leaking_or_skipping_human_review(self):
        room = await self.create_room(bots=True)
        await self.wait_for_bots(room)
        bot = room.players[1]
        self.assertIsNotNone(room.game_state["players"][bot.player_id]["selected_card"])
        events = [event for entry in app.sio.emits if entry["event"] == "game:state"
                  for event in entry["payload"]["events"]]
        bot_events = [event for event in events if event["type"] == "bot:action"]
        self.assertTrue(bot_events)
        self.assertTrue(all(event["payload"]["action"] == {"type": "select_card"} for event in bot_events))
        human = room.players[0]
        action = Game.bot_move(room.game_state, human.player_id)
        await app.on_game_action("s0", {"action": action})
        await self.wait_for_bots(room)
        if room.game_state["phase"] == "row_choice":
            await app.on_game_action("s0", {"action": Game.bot_move(room.game_state, human.player_id)})
            await self.wait_for_bots(room)
        self.assertEqual(room.game_state["phase"], "turn_summary")
        self.assertTrue(room.game_state["summary_ack"].get(bot.player_id))
        self.assertNotIn(human.player_id, room.game_state["summary_ack"])
        await app.on_game_action("s0", {"action": {"type": "ack_turn_summary"}})
        await self.wait_for_bots(room)
        self.assertEqual((room.game_state["phase"], room.game_state["turn"]), ("selection", 2))

    async def test_public_bot_action_sanitizes_values(self):
        action = {"type": "select_card", "value": 55}
        self.assertEqual(app._public_bot_action("six_nimmt", action), {"type": "select_card"})
        self.assertEqual(action, {"type": "select_card", "value": 55})


if __name__ == "__main__":
    unittest.main()
