import asyncio
import unittest
from tempfile import TemporaryDirectory

import app
from game.celestia import CelestiaGame as Game
from tests.test_room_session import DummySio


class CelestiaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.directory = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.directory.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = "game_over"
            await self._wait_bots(room)
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.directory.cleanup()

    async def _wait_bots(self, room):
        for _ in range(300):
            if not room.bot_running:
                return
            await asyncio.sleep(0.01)
        self.fail("Celestia bots did not finish their actions")

    async def _room(self):
        await app.on_room_create("human", {"name": "Captain", "game_type": "celestia"})
        await app.on_room_add_bot("human", {})
        await app.on_room_add_bot("human", {})
        room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
        players = [dict(player_id=player.player_id, name=player.name, seat=player.seat, is_bot=player.is_bot) for player in room.players]
        room.game_state = Game.init_game({}, players)
        room.status = "in_game"
        return room

    async def test_catalog_exposes_strategic_ai(self):
        entry = next(game for game in await app.api_list_games() if game["game_id"] == "celestia")
        self.assertTrue(entry["has_strategic_ai"])

    async def test_bots_wait_for_human_before_starting_next_journey(self):
        room = await self._room()
        state = room.game_state
        human_id = room.players[0].player_id
        state.update(phase="journey_end", journey_end_captain=human_id, next_ready=[])
        for player in state["players"].values():
            player["on_ship"] = False
        await app._maybe_run_bots(room)
        await self._wait_bots(room)
        self.assertEqual(state["phase"], "journey_end")
        self.assertEqual(state["journey_no"], 1)
        self.assertEqual(set(state["next_ready"]), {player.player_id for player in room.players if player.is_bot})
        self.assertIsNone(Game.apply_action(state, human_id, {"type": "next_journey"})[1])
        self.assertEqual(state["journey_no"], 2)
        self.assertEqual(state["phase"], "roll")

    async def test_all_bots_pass_special_window_without_repeating_pass(self):
        room = await self._room()
        state = room.game_state
        state.update(phase="ejection_window", current_city=8, special_passes=[])
        state["treasure_decks"][8] = []
        state["treasure_decks"][9] = []
        for player in room.players:
            state["players"][player.player_id]["hand"] = (
                [{"id": player.player_id, "kind": "ejection", "category": "power"}] if player.is_bot else []
            )
        await app._maybe_run_bots(room)
        await self._wait_bots(room)
        self.assertEqual(state["phase"], "captain_action")
        self.assertEqual(state["captain"], room.players[0].player_id)
        self.assertEqual(room.state_version, 2)
        self.assertFalse(any(emit["event"] == "error" for emit in app.sio.emits))


if __name__ == "__main__":
    unittest.main()
