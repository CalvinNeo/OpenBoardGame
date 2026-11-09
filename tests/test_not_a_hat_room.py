import random
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.not_a_hat import NotAHatGame as Game
from tests.test_room_session import DummySio


class NotAHatRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.random_state = random.getstate()
        random.seed(19)
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

    async def make_room(self, bots=2):
        await app.on_room_create("human", {"name": "Alice", "game_type": Game.game_id})
        room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
        for _ in range(bots):
            await app.on_room_add_bot("human", {"room_id": room.room_id})
        for player in room.players:
            player.ready = True
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_start("human", {})
        self.assertEqual(room.status, "in_game")
        return room

    async def run_bots(self, room):
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app._maybe_run_bots(room)
        with patch.object(app.asyncio, "sleep", new_callable=AsyncMock):
            for runner in runners:
                await runner
        self.assertFalse(room.bot_running)

    async def test_catalog_exposes_the_game(self):
        entry = next(game for game in await app.api_list_games() if game["game_id"] == Game.game_id)
        self.assertEqual(entry["name_zh"], "似帽非帽")
        self.assertEqual((entry["min_players"], entry["max_players"]), (3, 8))
        self.assertTrue(entry["has_strategic_ai"])

    async def test_room_starts_in_the_memorize_phase(self):
        room = await self.make_room()
        self.assertEqual(room.game_state["phase"], "memorize")
        human_id = app.SESSIONS["human"]["player_id"]
        view = Game.get_public_view(room.game_state, human_id)
        self.assertEqual(view["legal_actions"], ["ready"])
        self.assertTrue(all(card["face_up"] for player in view["players"] for card in player["stack"]))

    async def test_human_and_bots_reach_game_over(self):
        room = await self.make_room()
        human_id = app.SESSIONS["human"]["player_id"]
        for step in range(400):
            await self.run_bots(room)
            if room.status == "game_over":
                break
            legal = Game.get_legal_actions(room.game_state, human_id)
            if not legal:
                continue
            action = Game.bot_move(room.game_state, human_id)
            self.assertIsNotNone(action, (step, room.game_state["phase"]))
            payload = {key: value for key, value in action.items() if key != "delay_ms"}
            with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
                await app.on_game_action("human", {"action": payload})
        self.assertEqual(room.status, "game_over", room.game_state["phase"])
        self.assertTrue(room.game_state["winners"])
        self.assertFalse(any(m["event"] == "system:error" for m in app.sio.emits))

    async def test_game_state_is_broadcast_per_viewer(self):
        room = await self.make_room()
        app.sio.emits.clear()
        human_id = app.SESSIONS["human"]["player_id"]
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_game_action("human", {"action": {"type": "ready"}})
        states = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertTrue(states)
        human_states = [m for m in states if m["to"] == "human"]
        self.assertTrue(human_states)
        view = human_states[-1]["payload"]["view"]
        self.assertEqual(view["you"], human_id)
        self.assertEqual(view["game_id"], "not_a_hat")

    async def test_invalid_action_is_reported_not_applied(self):
        room = await self.make_room()
        app.sio.emits.clear()
        version = room.state_version
        await app.on_game_action("human", {"action": {"type": "accept"}})
        errors = [m for m in app.sio.emits if m["event"] == "system:error"]
        self.assertTrue(errors)
        self.assertEqual(room.state_version, version)
        self.assertEqual(room.game_state["phase"], "memorize")

    async def test_action_schema_rejects_a_bogus_gift(self):
        room = await self.make_room()
        app.sio.emits.clear()
        await app.on_game_action("human", {"action": {"type": "ready"}})
        app.sio.emits.clear()
        await app.on_game_action("human", {"action": {"type": "give", "item": "unicorn"}})
        errors = [m for m in app.sio.emits if m["event"] == "system:error"]
        self.assertTrue(errors)
        self.assertIn("action", errors[0]["payload"]["message"])

    async def test_save_and_reload_keeps_the_table(self):
        room = await self.make_room()
        await self.run_bots(room)
        snapshot = Game.serialize(room.game_state)
        restored = Game.deserialize(snapshot)
        self.assertEqual(restored["phase"], room.game_state["phase"])
        self.assertEqual(restored["turn_order"], room.game_state["turn_order"])
        self.assertEqual(len(restored["deck"]), len(room.game_state["deck"]))


if __name__ == "__main__":
    unittest.main()
