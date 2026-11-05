import asyncio
import unittest
from tempfile import TemporaryDirectory

import app
from game.incan_gold import IncanGoldGame as Game
from tests.test_room_session import DummySio


class IncanGoldIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_and_bot_event_privacy(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == "incan_gold")
        self.assertTrue(entry["has_strategic_ai"])
        self.assertEqual(app._public_bot_action("incan_gold", {"type": "decide", "choice": "leave"}), {"type": "decide"})

    async def test_bots_wait_for_human_round_confirmation(self):
        previous_sio, previous_data = app.sio, app.DATA_DIR
        previous_rooms, previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        with TemporaryDirectory() as directory:
            try:
                app.sio, app.DATA_DIR = DummySio(), directory
                app.ROOMS.clear()
                app.SESSIONS.clear()
                await app.on_room_create("human", {"name": "Explorer", "game_type": "incan_gold"})
                await app.on_room_add_bot("human", {})
                await app.on_room_add_bot("human", {})
                room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
                players = [dict(player_id=player.player_id, name=player.name, seat=player.seat, is_bot=player.is_bot) for player in room.players]
                room.game_state = Game.init_game({}, players)
                room.status = "in_game"
                for player in room.players:
                    Game.apply_action(room.game_state, player.player_id, {"type": "decide", "choice": "leave"})
                await app._maybe_run_bots(room)
                for _ in range(300):
                    if not room.bot_running:
                        break
                    await asyncio.sleep(0.01)
                self.assertFalse(room.bot_running)
                self.assertEqual(room.game_state["phase"], "round_end")
                self.assertEqual(room.game_state["current_round"], 1)
                self.assertEqual(len(room.game_state["next_round_ready"]), 2)
                self.assertIsNone(Game.apply_action(room.game_state, room.players[0].player_id, {"type": "next_round"})[1])
                self.assertEqual(room.game_state["current_round"], 2)
            finally:
                app.sio, app.DATA_DIR = previous_sio, previous_data
                app.ROOMS.clear()
                app.ROOMS.update(previous_rooms)
                app.SESSIONS.clear()
                app.SESSIONS.update(previous_sessions)


if __name__ == "__main__":
    unittest.main()
