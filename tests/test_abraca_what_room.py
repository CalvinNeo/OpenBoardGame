import copy
import unittest
from unittest.mock import AsyncMock, patch

import app
from game.abraca_what import _finish_round
from tests.test_room_session import DummySio


class AbracaWhatRoomReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.sio_patch = patch.object(app, "sio", DummySio())
        self.sio_patch.start()
        self.save_patch = patch.object(app, "_save_room_state")
        self.save_patch.start()
        self.bots_patch = patch.object(app, "_maybe_run_bots", new_callable=AsyncMock)
        self.bots_patch.start()
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("host", {"name": "Alex", "game_type": "abraca_what"})
        self.room = app.ROOMS[app.SESSIONS["host"]["room_id"]]
        await app.on_room_join("guest", {"room_id": self.room.room_id, "name": "Nova"})
        for player in self.room.players:
            player.ready = True
        await app.on_room_start("host", {"config": {"target_score": 3}})
        self.host = app.SESSIONS["host"]["player_id"]
        self.guest = app.SESSIONS["guest"]["player_id"]
        app.sio.emits.clear()

    async def asyncTearDown(self):
        app.ROOMS.clear()
        app.SESSIONS.clear()
        self.bots_patch.stop()
        self.save_patch.stop()
        self.sio_patch.stop()

    async def test_room_start_cannot_bypass_final_review(self):
        _finish_round(self.room.game_state, "empty_hand", self.host)
        self.room.status = "game_over"
        original = copy.deepcopy(self.room.game_state["round_result"])

        await app.on_room_start("host", {"config": {"target_score": 1}})
        self.assertEqual(self.room.status, "game_over")
        self.assertEqual(self.room.game_state["result_ready"], [self.host])
        self.assertFalse(self.room.game_state["results_confirmed"])
        await app.on_room_start("host", {})
        self.assertEqual(self.room.game_state["round_result"], original)
        self.assertEqual(self.room.game_state["config"]["target_score"], 3)
        self.assertEqual(app.sio.emits[-1]["payload"]["message"], "results already confirmed")

        await app.on_game_action("guest", {"action": {"type": "play_again"}})
        self.assertTrue(self.room.game_state["results_confirmed"])
        self.assertEqual(self.room.status, "game_over")
        self.assertEqual(self.room.game_state["round_result"], original)
        await app.on_game_action("host", {"action": {"type": "play_again"}})
        self.assertEqual(self.room.status, "in_game")
        self.assertFalse(self.room.game_state["game_over"])
        self.assertEqual(self.room.game_state["config"]["target_score"], 3)
        self.assertEqual(self.room.game_state["round"], 1)

    async def test_round_waits_for_guest_and_new_hands_are_private(self):
        self.room.game_state["config"]["target_score"] = 8
        _finish_round(self.room.game_state, "empty_hand", self.host)
        await app.on_game_action("host", {"action": {"type": "start_next_round"}})
        self.assertEqual(self.room.game_state["phase"], "round_end")
        self.assertEqual(self.room.game_state["round"], 1)
        self.assertEqual(self.room.game_state["next_round_ready"], [self.host])
        await app.on_game_action("guest", {"action": {"type": "start_next_round"}})
        self.assertEqual(self.room.game_state["phase"], "wait_use")
        self.assertEqual(self.room.game_state["round"], 2)
        updates = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        for recipient in ("host", "guest"):
            update = next(entry["payload"] for entry in reversed(updates) if entry["to"] == recipient)
            view = update["view"]
            player = next(player for player in view["players"] if player["player_id"] == view["you"])
            self.assertTrue(all(card == {"hidden": True} for card in player["hand"]))
            self.assertEqual(len(view["round_history"]), 1)
