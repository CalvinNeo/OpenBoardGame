import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.subtext import SubtextGame
from tests.test_room_session import DummySio
from tests.test_subtext_game import simple_drawing


class SubtextRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
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
        self.temp.cleanup()

    async def test_final_ready_broadcast_persistence_reconnect_and_restart(self):
        players = [
            app.Player(f"p{index}", f"Player {index}", index, f"s{index}", reconnect_token=f"token{index}")
            for index in range(4)
        ]
        state = SubtextGame.init_game({"word_column": 2, "seed": "room-ready"}, [
            {"player_id": player.player_id, "name": player.name, "seat": player.seat}
            for player in players
        ])
        state["round"] = state["total_rounds"]
        for player in players:
            _, error = SubtextGame.apply_action(state, player.player_id, {"type": "submit_drawing", "drawing": simple_drawing()})
            self.assertIsNone(error)
        room = app.Room("SUBTEXTREADY", game_type="subtext", status="in_game", players=players, game_state=state, auto_save=True)
        app.ROOMS[room.room_id] = room
        for player in players:
            app.SESSIONS[player.socket_id] = {"room_id": room.room_id, "player_id": player.player_id}
        partner_slot = state["slot_by_player"][state["partner_id"]]
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            for player in players:
                await app.on_game_action(player.socket_id, {"action": {"type": "submit_guess", "slot_id": partner_slot}})
            self.assertEqual(room.status, "game_over")
            summary = copy.deepcopy(room.game_state["last_round_summary"])
            for index, player in enumerate(players[:-1]):
                app.sio.emits.clear()
                if index == 0:
                    await app.on_room_start(player.socket_id, {})
                else:
                    await app.on_game_action(player.socket_id, {"action": {"type": "play_again"}})
                self.assertEqual(room.status, "game_over")
                self.assertEqual(room.game_state["last_round_summary"], summary)
                updates = [event for event in app.sio.emits if event["event"] == "game:state"]
                self.assertEqual({event["to"] for event in updates}, {player.socket_id for player in players})
                for update in updates:
                    self.assertEqual(update["payload"]["room_status"], "game_over")
                    self.assertEqual(update["payload"]["view"]["next_round_progress"], {"done": index + 1, "total": 4})
                saved = app._load_latest_save(room.room_id)
                self.assertEqual(saved["room_status"], "game_over")
                room.game_state = SubtextGame.deserialize(saved["game_state"])
                version = room.state_version
                await app.on_game_action(player.socket_id, {"action": {"type": "play_again"}})
                self.assertEqual(room.state_version, version)
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")

            await app.on_room_reconnect("reconnected", {
                "room_id": room.room_id, "player_id": players[0].player_id,
                "reconnect_token": players[0].reconnect_token,
            })
            update = next(event for event in reversed(app.sio.emits) if event["event"] == "game:state" and event["to"] == "reconnected")
            self.assertEqual(update["payload"]["view"]["legal_actions"], [])
            self.assertEqual(update["payload"]["view"]["next_round_progress"], {"done": 3, "total": 4})
            await app.on_game_action(players[-1].socket_id, {"action": {"type": "play_again"}})
            self.assertEqual(room.status, "in_game")
            self.assertEqual(room.game_state["phase"], "drawing")
            self.assertEqual(room.game_state["round"], 1)
            self.assertEqual(room.game_state["game_index"], 2)
            self.assertEqual(room.game_state["next_round_ready"], [])
            self.assertTrue(all(player["score"] == 0 for player in room.game_state["players"].values()))
            self.assertEqual(app._load_latest_save(room.room_id)["room_status"], "in_game")
