import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from fastapi import HTTPException
from game.las_vegas import LasVegasGame as Game
from tests.test_room_session import DummySio


class LasVegasIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def room(self, count=2, config=None):
        await app.on_room_create("s0", {
            "name": "Player 0", "game_type": "las_vegas", "config": config or {},
        })
        rid = app.SESSIONS["s0"]["room_id"]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {"name": f"Player {index}", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        # Let the initially empty bot scheduler finish before changing a seat to a bot.
        await asyncio.sleep(0)
        self.assertEqual(room.status, "in_game")
        return room

    def updates(self):
        return [item for item in app.sio.emits if item["event"] == "game:state"]

    async def reach_round_end(self, room):
        for _ in range(150):
            if room.game_state["phase"] == "round_end":
                return
            progressed = False
            for player in room.players:
                if room.game_state["phase"] == "round_end":
                    return
                action = Game.bot_move(room.game_state, player.player_id)
                if action:
                    await app.on_game_action(player.socket_id, {"action": action})
                    progressed = True
            self.assertTrue(progressed)
        self.fail("A round did not finish within its maximum possible number of turns")

    async def test_catalog_and_start(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == Game.game_id)
        self.assertEqual((entry["min_players"], entry["max_players"]), (2, 5))
        self.assertEqual(entry["name_zh"], "拉斯维加斯")
        self.assertTrue(entry["tags"])
        self.assertIsNotNone(entry["dev_order"])
        room = await self.room()
        self.assertEqual(room.game_state["round"], 1)
        self.assertEqual(len(self.updates()), 2)
        for item in self.updates():
            self.assertNotIn("banknote_deck", item["payload"]["view"])
            self.assertNotIn("deck", item["payload"]["view"])

    async def test_round_review_waits_for_disconnected_player(self):
        room = await self.room()
        await self.reach_round_end(room)
        player = room.players[1]
        await app.disconnect("s1")
        await app.on_game_action("s0", {"action": {"type": "next_round", "round": 1}})
        self.assertEqual(room.game_state["phase"], "round_end")
        app.sio.emits.clear()
        await app.on_room_reconnect("back1", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        view = next(item["payload"]["view"] for item in self.updates() if item["to"] == "back1")
        self.assertEqual(view["phase"], "round_end")
        self.assertEqual(view["next_ready"], [room.players[0].player_id])
        await app.on_game_action("back1", {"action": {"type": "next_round", "round": 1}})
        self.assertEqual(room.game_state["round"], 2)
        self.assertNotEqual(room.game_state["phase"], "round_end")

    async def test_roll_broadcast_and_reconnect_preserve_the_same_dice(self):
        room = await self.room(config={"neutral_dice": True})
        state = room.game_state
        player = next(player for player in room.players if player.player_id == state["current_turn"])
        action = {"type": "roll", "round": 1, "turn": 1}
        app.sio.emits.clear()
        await app.on_game_action(player.socket_id, {"action": action})
        rolled = copy.deepcopy(state["roll"])
        self.assertEqual(len(rolled["own"]), 8)
        self.assertEqual(len(rolled["neutral"]), 4)
        self.assertEqual(len(self.updates()), 2)
        self.assertTrue(all(item["payload"]["view"]["roll"] == rolled for item in self.updates()))
        await app.disconnect(player.socket_id)
        app.sio.emits.clear()
        await app.on_room_reconnect("back", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        view = next(item["payload"]["view"] for item in self.updates() if item["to"] == "back")
        self.assertEqual(view["roll"], rolled)
        self.assertEqual(view["legal_actions"], ["place"])
        before = copy.deepcopy(state)
        await app.on_game_action("back", {"action": action, "skip_validation": True})
        self.assertEqual(state, before)

    async def test_schema_bypass_out_of_turn_and_stale_actions_do_not_mutate(self):
        room = await self.room()
        state = room.game_state
        actor = next(player for player in room.players if player.player_id == state["current_turn"])
        other = next(player for player in room.players if player is not actor)
        valid = {"type": "roll", "round": 1, "turn": 1}
        invalid = [{**valid, "turn": True}, {**valid, "turn": 1.0}, {**valid, "round": "1"},
                   {**valid, "round": 2}, {**valid, "turn": 2}, {**valid, "extra": 1}]
        for action in invalid:
            with self.subTest(action=action):
                before = copy.deepcopy(state)
                app.sio.emits.clear()
                await app.on_game_action(actor.socket_id, {"action": action, "skip_validation": True})
                self.assertEqual(state, before)
                self.assertFalse(self.updates())
        before = copy.deepcopy(state)
        await app.on_game_action(other.socket_id, {"action": valid})
        self.assertEqual(state, before)
        await app.on_game_action(actor.socket_id, {"action": valid})
        placement = {"type": "place", "round": 1, "turn": 1, "face": state["roll"]["own"][0]}
        await app.on_game_action(actor.socket_id, {"action": placement})
        before = copy.deepcopy(state)
        await app.on_game_action(actor.socket_id, {"action": placement, "skip_validation": True})
        self.assertEqual(state, before)

    async def test_bot_scheduler_acts_then_stops_at_a_human_turn(self):
        room = await self.room()
        actor = next(player for player in room.players if player.player_id == room.game_state["current_turn"])
        actor.is_bot = True
        app.sio.emits.clear()
        tasks = []
        with patch.object(app.asyncio, "create_task", side_effect=tasks.append):
            await app._maybe_run_bots(room)
        self.assertEqual(len(tasks), 1)
        await tasks[0]
        self.assertEqual(room.game_state["phase"], "roll")
        self.assertNotEqual(room.game_state["current_turn"], actor.player_id)
        self.assertLess(room.game_state["players"][actor.player_id]["remaining"], 8)
        events = [event for item in self.updates() for event in item["payload"]["events"]]
        self.assertTrue(any(event["type"] == "bot:action" for event in events))
        self.assertFalse(room.bot_running)

    async def test_four_rounds_keep_room_active_until_every_final_confirmation(self):
        room = await self.room()
        for number in range(1, 5):
            await self.reach_round_end(room)
            self.assertEqual(room.game_state["round"], number)
            await app.on_game_action("s0", {"action": {"type": "next_round", "round": number}})
            self.assertEqual(room.status, "in_game")
            self.assertFalse(room.game_state["game_over"])
            self.assertEqual(room.game_state["phase"], "round_end")
            await app.on_game_action("s1", {"action": {"type": "next_round", "round": number}})
        self.assertEqual(room.status, "game_over")
        self.assertTrue(room.game_state["winner"])
        final = self.updates()[-2:]
        for item in final:
            self.assertTrue(item["payload"]["view"]["game_over"])
            self.assertTrue(all(player["total"] is not None for player in item["payload"]["view"]["players"]))

    async def test_live_save_cannot_export_or_clone_and_cold_restore_recovers(self):
        room = await self.room()
        room.auto_save = True
        app._save_room_state(room)
        with self.assertRaises(HTTPException) as raised:
            await app.download_room_save(room.room_id)
        self.assertEqual(raised.exception.status_code, 403)
        before = set(app.ROOMS)
        await app.on_room_load("outsider", {"source_room_id": room.room_id})
        self.assertEqual(set(app.ROOMS), before)
        self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in app.sio.emits if item["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, room.game_state)
        self.assertTrue(app._has_live_private_save(room.room_id, "las_vegas"))
        with self.assertRaises(HTTPException):
            await app.download_room_save(room.room_id)


if __name__ == "__main__":
    unittest.main()
