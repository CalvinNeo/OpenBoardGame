"""Room-level integration tests for 哒哒哒 / DADADA -- designs/task192.md §8."""
import random
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.dadada import DadadaGame as Game
from tests.test_room_session import DummySio


class DadadaRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.random_state = random.getstate()
        random.seed(23)
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

    async def make_room(self, bots=3):
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
        entry = next(game for game in await app.api_list_games() if game["game_id"] == "dadada")
        self.assertEqual(entry["name_zh"], "哒哒哒")
        self.assertEqual((entry["min_players"], entry["max_players"]), (2, 6))
        self.assertFalse(entry["has_strategic_ai"])

    async def test_room_starts_in_creation(self):
        room = await self.make_room()
        human_id = app.SESSIONS["human"]["player_id"]
        view = Game.get_public_view(room.game_state, human_id)
        self.assertEqual(view["stage"], "create")
        self.assertEqual(len(view["table"]), 13)
        self.assertEqual(len(view["sounds"]), 5)

    async def test_human_and_bots_reach_game_over(self):
        """The whole table, human included, must be able to finish a game."""
        for bots in (1, 2, 3):
            with self.subTest(bots=bots):
                app.ROOMS.clear()
                app.SESSIONS.clear()
                room = await self.make_room(bots=bots)
                human_id = app.SESSIONS["human"]["player_id"]
                for step in range(600):
                    await self.run_bots(room)
                    if room.status == "game_over":
                        break
                    legal = Game.get_legal_actions(room.game_state, human_id)
                    if not legal:
                        continue
                    action = Game.bot_move(room.game_state, human_id)
                    self.assertIsNotNone(action, (step, room.game_state["stage"]))
                    payload = {key: value for key, value in action.items() if key != "delay_ms"}
                    with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
                        await app.on_game_action("human", {"action": payload})
                self.assertEqual(room.status, "game_over", room.game_state["stage"])
                self.assertFalse(any(m["event"] == "system:error" for m in app.sio.emits))

    async def test_a_stalled_guess_round_is_reported(self):
        """Guard the failure mode where one guesser never locks a picture in."""
        room = await self.make_room(bots=3)
        human_id = app.SESSIONS["human"]["player_id"]
        for _ in range(600):
            await self.run_bots(room)
            if room.game_state["stage"] == "guess":
                break
            legal = Game.get_legal_actions(room.game_state, human_id)
            if not legal:
                continue
            action = Game.bot_move(room.game_state, human_id)
            if action is None:
                continue
            payload = {key: value for key, value in action.items() if key != "delay_ms"}
            with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
                await app.on_game_action("human", {"action": payload})
        self.assertEqual(room.game_state["stage"], "guess")
        # Every bot that is allowed to guess must actually have guessed once the
        # human has, otherwise the round can never resolve.
        await self.run_bots(room)
        state = room.game_state
        guessers = [pid for pid in state["turn_order"] if pid != state["communicator"]]
        missing = [pid for pid in guessers
                   if pid != human_id and pid not in state["guesses"]]
        self.assertEqual(missing, [], f"bots never guessed: {missing}")

    async def test_game_state_is_broadcast_per_viewer(self):
        room = await self.make_room()
        app.sio.emits.clear()
        human_id = app.SESSIONS["human"]["player_id"]
        action = Game.bot_move(room.game_state, human_id)
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_game_action("human", {"action": action})
        states = [m for m in app.sio.emits if m["event"] == "game:state"]
        self.assertTrue(states)
        human_states = [m for m in states if m["to"] == "human"]
        self.assertTrue(human_states)
        view = human_states[-1]["payload"]["view"]
        self.assertEqual(view["you"], human_id)
        self.assertEqual(view["game_id"], "dadada")

    async def test_invalid_action_is_reported_not_applied(self):
        room = await self.make_room()
        app.sio.emits.clear()
        version = room.state_version
        await app.on_game_action("human", {"action": {"type": "continue", "turn": 1}})
        errors = [m for m in app.sio.emits if m["event"] == "system:error"]
        self.assertTrue(errors)
        self.assertEqual(room.state_version, version)
        self.assertEqual(room.game_state["stage"], "create")

    async def test_save_and_reload_keeps_the_language(self):
        room = await self.make_room()
        await self.run_bots(room)
        snapshot = Game.serialize(room.game_state)
        restored = Game.deserialize(snapshot)
        self.assertEqual(restored["stage"], room.game_state["stage"])
        self.assertEqual(restored["turn_order"], room.game_state["turn_order"])
        self.assertEqual(restored["sounds"], room.game_state["sounds"])
        self.assertEqual(restored["table"], room.game_state["table"])


if __name__ == "__main__":
    unittest.main()
