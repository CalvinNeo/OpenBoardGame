import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.colt_express import ColtExpressGame as Game
from tests.test_room_session import DummySio


class ColtExpressIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = "game_over"
        for _ in range(100):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, count=3, bots=False):
        await app.on_room_create("s0", {"name": "Bandit 0", "game_type": Game.game_id,
                                        "config": {"seed": 158}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in range(1, count):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Bandit {index}"})
        for player in room.players:
            player.ready = True
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_start("s0", {})
        if room.game_state:
            room.auto_save = True
            app._save_room_state(room)
        return room

    async def test_catalog_and_supported_player_counts(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == Game.game_id)
        self.assertEqual((entry["min_players"], entry["max_players"]), (3, 6))
        self.assertEqual(entry["name_zh"], "柯尔特快车")
        self.assertIn("ameritrash", [tag["id"] for tag in entry["tags"]])
        room = await self.make_room(count=2)
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)

    async def test_room_hides_hands_seed_and_programmed_actions(self):
        room = await self.make_room()
        self.assertEqual(room.status, "in_game")
        state = room.game_state
        # An actual legal tunnel play must stay hidden in room broadcasts.
        slot = state["schedule"][state["program_index"]]
        slot["kind"] = "tunnel"
        pid = state["current_turn"]
        actor = next(p for p in room.players if p.player_id == pid)
        action = next(a for a in Game.get_legal_actions(state, pid) if a["type"] == "play")
        app.sio.emits.clear()
        await app.on_game_action(actor.socket_id, {"action": action})
        messages = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for message in messages:
            view = message["payload"]["view"]
            self.assertIsNone(view["program"][0]["kind"])
            self.assertNotIn("card_id", view["program"][0])
            self.assertNotIn("seed", view)
            self.assertNotIn("round_cards", view)
            own_ids = {c["id"] for c in state["players"][view["you"]]["hand"]}
            self.assertEqual({c["id"] for c in view["hand"]}, own_ids)
            for player in view["players"]:
                self.assertNotIn("hand", player)
                if player["player_id"] != view["you"]:
                    self.assertTrue(all(l["value"] is None for l in player["loots"] if l["type"] == "purse"))
            self.assertNotIn(action["card_id"], json.dumps(message["payload"].get("events", [])))
        await app._emit_room_state(room)
        room_states = [e for e in app.sio.emits if e["event"] == "room:state"]
        self.assertTrue(all("seed" not in m["payload"]["game_config"] for m in room_states))
        self.assertEqual(app._public_bot_action(Game.game_id, action), {"type": "play"})

    async def test_forged_and_repeated_actions_do_not_mutate_room(self):
        room = await self.make_room()
        actor = next(p for p in room.players if p.player_id == room.game_state["current_turn"])
        action = Game.get_legal_actions(room.game_state, actor.player_id)[0]
        before = copy.deepcopy(room.game_state)
        forged = {**action, "card_id": "another-player-card"}
        await app.on_game_action(actor.socket_id, {"action": forged, "skip_validation": True})
        self.assertEqual(room.game_state, before)
        await app.on_game_action(actor.socket_id, {"action": action})
        after = copy.deepcopy(room.game_state)
        await app.on_game_action(actor.socket_id, {"action": action})
        self.assertEqual(room.game_state, after)

    async def test_active_save_requires_original_reconnect_token(self):
        room = await self.make_room()
        pid, token, rid = room.players[1].player_id, room.players[1].reconnect_token, room.room_id
        expected = copy.deepcopy(room.game_state)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(rid)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id": rid})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        await app.on_room_reconnect("bad", {"room_id": rid, "player_id": pid, "reconnect_token": "wrong"})
        self.assertEqual(app.ROOMS, {})
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_room_reconnect("restored", {"room_id": rid, "player_id": pid, "reconnect_token": token})
        self.assertEqual(app.ROOMS[rid].game_state, expected)
        restored = [e for e in app.sio.emits if e["event"] == "game:state" and e["to"] == "restored"][-1]
        self.assertEqual(restored["payload"]["view"]["you"], pid)

    async def test_bot_runner_stops_at_human_round_review(self):
        room = await self.make_room(bots=True)
        for _ in range(100):
            if room.game_state["phase"] == "round_end":
                break
            pid = room.game_state["current_turn"]
            action = Game.bot_move(room.game_state, pid)
            action.pop("delay_ms", None)
            _, error = Game.apply_action(room.game_state, pid, action)
            self.assertIsNone(error)
        self.assertEqual(room.game_state["phase"], "round_end")
        await app._maybe_run_bots(room)
        for _ in range(250):
            if not room.bot_running:
                break
            await asyncio.sleep(.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(room.game_state["phase"], "round_end")
        self.assertEqual(set(room.game_state["next_ready"]), {p.player_id for p in room.players if p.is_bot})
        action = Game.get_legal_actions(room.game_state, room.players[0].player_id)[0]
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_game_action("s0", {"action": action})
        self.assertEqual(room.game_state["round"], 2)
        self.assertEqual(room.game_state["phase"], "program")


if __name__ == "__main__":
    unittest.main()
