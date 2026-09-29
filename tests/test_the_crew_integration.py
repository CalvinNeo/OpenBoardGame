import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.the_crew import TheCrewGame as Game
from tests.test_room_session import DummySio
from tests.test_the_crew import action


class TheCrewIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_lobby(self, edition=1):
        await app.on_room_create("s0", {"name":"Astronaut", "game_type":"the_crew", "config":{"edition":edition,"seed":139}, "auto_save":True})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for i in (1,2): await app.on_room_join(f"s{i}", {"room_id":room.room_id,"name":f"Crew {i}"})
        for p in room.players: p.ready = True
        return room

    async def make_room(self, edition=1):
        room = await self.make_lobby(edition)
        await app.on_room_start("s0", {})
        self.assertEqual(room.status,"in_game")
        self.assertEqual(room.game_state["config"]["edition"],edition)
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_both_editions_and_private_broadcast(self):
        row = next(g for g in await app.api_list_games() if g["game_id"] == "the_crew")
        self.assertEqual((row["name_zh"],row["min_players"],row["max_players"]),("宇航员",2,5))
        self.assertEqual({t["id"] for t in row["tags"]},{"cooperative","trick_taking","puzzle"})
        for edition in (1,2):
            room = await self.make_room(edition)
            s = room.game_state
            pid = s["captain"]
            seat = next(p for p in room.players if p.player_id == pid)
            task_id = Game.get_public_view(s,pid)["task_choices"][pid][0]
            app.sio.emits.clear()
            await app.on_game_action(seat.socket_id, {"action":action(s,"take_task",actor=pid,task_id=task_id)})
            messages = [e for e in app.sio.emits if e["event"] == "game:state"]
            self.assertEqual(len(messages),3)
            for message in messages:
                v = message["payload"]["view"]
                who = next(p.player_id for p in room.players if p.socket_id == message["to"])
                self.assertEqual(v["hand"],s["players"][who]["hand"])
                self.assertNotIn("seed",v["config"])
                self.assertNotIn("tricks",v)
                self.assertEqual(message["payload"]["events"],[])
            await app._emit_room_state(room)
            self.assertNotIn("seed",app.sio.emits[-1]["payload"]["game_config"])
            self.assertEqual(app._public_bot_action("the_crew",{"type":"predict","value":3}),{"type":"predict"})

    async def test_schema_bypass_cannot_mutate(self):
        room = await self.make_room()
        for skip in (False,True):
            before = copy.deepcopy(room.game_state)
            await app.on_game_action("s0", {"skip_validation":skip,"action":action(room.game_state,"take_task",actor=[],task_id="bad")})
            self.assertEqual(before,room.game_state)
            self.assertEqual(app.sio.emits[-1]["event"],"system:error")

    async def test_active_save_protection_and_cold_reconnect(self):
        room = await self.make_room(2)
        player = room.players[0]
        expected = Game.get_public_view(room.game_state,player.player_id)
        for cold in (False,True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught: await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code,403)
            await app.on_room_load("outsider",{"source_room_id":room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        credentials = {"room_id":room.room_id,"player_id":player.player_id,"reconnect_token":player.reconnect_token}
        await app.on_room_reconnect("bad",{**credentials,"reconnect_token":"wrong"})
        self.assertEqual(app.ROOMS,{})
        with patch.object(app,"_maybe_run_bots",new_callable=AsyncMock) as resume:
            await app.on_room_reconnect("restored",credentials)
            resume.assert_awaited_once()
        restored = app.ROOMS[room.room_id]
        self.assertEqual(Game.get_public_view(restored.game_state,player.player_id),expected)
        self.assertEqual([p.socket_id for p in restored.players if p.connected],["restored"])

    async def test_campaign_mission_out_of_range_rejected_at_creation(self):
        await app.on_room_create("bad",{"name":"Crew","game_type":"the_crew","config":{"edition":2,"mission":50}})
        self.assertNotIn("bad",app.SESSIONS)
        self.assertEqual(app.ROOMS,{})

    async def test_only_creator_chooses_mission_even_after_seat_move(self):
        for edition, mission in ((1, 50), (2, 32)):
            room = await self.make_lobby(edition)
            host_id = app.SESSIONS["s0"]["player_id"]
            await app.on_room_move_seat("s1", {"direction": "up"})
            self.assertNotEqual(room.players[0].player_id, host_id)
            self.assertEqual(room.host_player_id, host_id)
            payload = {"room_id": room.room_id, "config": {"mission": mission}}
            await app.on_room_start("s1", payload)
            self.assertEqual(room.status, "lobby")
            self.assertIsNone(room.game_state)
            self.assertIn("host", app.sio.emits[-1]["payload"]["message"])
            await app.on_room_start("s0", payload)
            self.assertEqual(room.game_state["mission"], mission)
            self.assertEqual(room.game_config["edition"], edition)
            self.assertEqual(room.game_config["mission"], mission)
            await app._emit_room_state(room)
            self.assertEqual(app.sio.emits[-1]["payload"]["host_player_id"], host_id)

    async def test_invalid_start_selection_stays_in_lobby(self):
        room = await self.make_lobby(2)
        for config in ({"mission": 33}, {"mission": True}, {"mode": "unknown"}):
            await app.on_room_start("s0", {"room_id": room.room_id, "config": config, "skip_validation": True})
            self.assertEqual(room.status, "lobby")
            self.assertIsNone(room.game_state)
        await app.on_room_start("s0", {"room_id": "other", "config": {"mission": 2}})
        self.assertIsNone(room.game_state)
        await app.on_room_start("s0", {"room_id": room.room_id, "config": {"mission": 2}})
        self.assertEqual(room.game_state["mission"], 2)

    async def test_restart_switches_mission_in_same_room_and_invalidates_old_actions(self):
        for edition in (1, 2):
            room = await self.make_room(edition)
            old = room.game_state
            player_snapshot = copy.deepcopy(room.players)
            room.game_state["journal"] = [{"mission": 1, "success": False}]
            room.game_state["attempt"] = 3
            version = room.state_version
            await app.on_the_crew_restart("s0", {
                "room_id": room.room_id, "game_token": old["game_token"],
                "config": {"mission": 5, "edition": 3 - edition},
            })
            self.assertIs(app.ROOMS[room.room_id], room)
            self.assertEqual(room.players, player_snapshot)
            self.assertEqual(room.state_version, version + 1)
            self.assertEqual(room.game_state["mission"], 5)
            self.assertEqual(room.game_state["config"]["edition"], edition)
            self.assertEqual(room.game_state["attempt"], 1)
            self.assertEqual(room.game_state["journal"], [])
            self.assertNotEqual(room.game_state["game_token"], old["game_token"])
            self.assertNotEqual(room.game_state["seed"], old["seed"])
            before = copy.deepcopy(room.game_state)
            await app.on_game_action("s0", {"action": action(old, "ready")})
            self.assertEqual(room.game_state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_restart_rejects_nonhost_invalid_and_stale_requests_atomically(self):
        room = await self.make_room(2)
        payload = {"room_id": room.room_id, "game_token": room.game_state["game_token"], "config": {"mission": 3}}
        before, version, config = copy.deepcopy(room.game_state), room.state_version, dict(room.game_config)
        rejected = [
            ("s1", payload),
            ("s0", {**payload, "room_id": "other"}),
            ("s0", {**payload, "game_token": "stale"}),
            ("s0", {**payload, "config": {}}),
            ("s0", {**payload, "config": {"mission": 33}}),
            ("s0", {**payload, "config": {"mission": True}}),
            ("s0", {**payload, "config": {"mission": 2, "mode": "unknown"}}),
            ("s0", None),
        ]
        for sid, data in rejected:
            await app.on_the_crew_restart(sid, data)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")
            self.assertEqual(room.game_state, before)
            self.assertEqual(room.game_config, config)
            self.assertEqual(room.state_version, version)
        for sid in ("s0", "s1"):
            await app.on_room_reopen(sid, {"room_id": room.room_id})
            self.assertEqual(room.game_state, before)
        await app.on_the_crew_restart("s0", payload)
        fresh = copy.deepcopy(room.game_state)
        await app.on_the_crew_restart("s0", payload)
        self.assertEqual(room.game_state, fresh)
        self.assertEqual(room.state_version, version + 1)

    async def test_restart_custom_and_finished_campaign(self):
        room = await self.make_room(2)
        room.status = "game_over"
        room.game_state.update(game_over=True, phase="game_over")
        await app.on_room_start("s0", {"config": {"mission": 3}})
        self.assertEqual(room.status, "game_over")
        await app.on_the_crew_restart("s0", {
            "room_id": room.room_id, "game_token": room.game_state["game_token"],
            "config": {"mode": "custom", "mission": 1, "difficulty": 10, "communication": "none"},
        })
        self.assertEqual(room.status, "in_game")
        self.assertFalse(room.game_state["game_over"])
        self.assertEqual(room.game_config["mode"], "custom")
        self.assertEqual(room.game_config["difficulty"], 10)
        self.assertEqual(room.game_config["communication"], "none")

    async def test_latest_restart_and_host_survive_cold_reconnect(self):
        room = await self.make_lobby(2)
        host = room.players[0]
        await app.on_room_move_seat("s1", {"direction": "up"})
        await app.on_room_start("s0", {})
        room.state_version = 50
        room.auto_save = True
        app._save_room_state(room)
        await app.on_the_crew_restart("s0", {
            "room_id": room.room_id, "game_token": room.game_state["game_token"], "config": {"mission": 7},
        })
        self.assertEqual(room.state_version, 51)
        expected = copy.deepcopy(room.game_state)
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_reconnect("restored", {
            "room_id": room.room_id, "player_id": host.player_id, "reconnect_token": host.reconnect_token,
        })
        restored = app.ROOMS[room.room_id]
        self.assertEqual(restored.game_state, expected)
        self.assertEqual(restored.state_version, 51)
        self.assertEqual(restored.host_player_id, host.player_id)
        self.assertEqual(restored.game_state["mission"], 7)

    async def test_host_transfer_on_leave_but_not_temporary_disconnect(self):
        room = await self.make_room()
        host = room.players[0]
        await app.disconnect("s0")
        self.assertEqual(room.host_player_id, host.player_id)
        await app.on_room_reconnect("s0", {
            "room_id": room.room_id, "player_id": host.player_id, "reconnect_token": host.reconnect_token,
        })
        await app._leave_session("s0")
        self.assertEqual(room.host_player_id, room.players[1].player_id)
        await app.on_the_crew_restart("s1", {
            "room_id": room.room_id, "game_token": room.game_state["game_token"], "config": {"mission": 2},
        })
        self.assertEqual(room.game_state["mission"], 2)
