import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.bomb_busters_help import get_mission_catalog, get_mission_help
from tests.test_room_session import DummySio


class BombBustersMissionCatalogTests(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_has_public_bilingual_summaries_for_every_mission(self):
        for count in (2, 3, 4, 5):
            catalog = await app.bomb_busters_mission_catalog(count)
            self.assertEqual(catalog, get_mission_catalog(count))
            self.assertEqual([mission["id"] for mission in catalog["missions"]], list(range(1, 67)))
            for mission in catalog["missions"]:
                self.assertEqual(set(mission), {"id", "title", "summary", "rules", "supported", "min_players", "audio_companion"})
                for language in ("zh", "en"):
                    self.assertTrue(mission["title"][language])
                    self.assertTrue(mission["summary"][language])
                    self.assertTrue(mission["rules"][language])
                self.assertEqual(mission["supported"], get_mission_help(mission["id"], count)["supported"])

    async def test_invalid_counts_and_catalog_mutation(self):
        for count in (1, 6, True, "3", None):
            with self.subTest(count=count), self.assertRaises(app.HTTPException):
                await app.bomb_busters_mission_catalog(count)
        catalog = get_mission_catalog()
        catalog["missions"][0]["title"]["en"] = "changed"
        self.assertNotEqual(get_mission_catalog()["missions"][0]["title"]["en"], "changed")


class BombBustersMissionPickerRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        self.bots = patch.object(app, "_maybe_run_bots", new_callable=AsyncMock)
        self.bots.start()
        await app.on_room_create("host", {"name": "Host", "game_type": "bomb_busters", "auto_save": True})
        self.room = app.ROOMS[app.SESSIONS["host"]["room_id"]]
        self.room.auto_save = True
        await app.on_room_join("guest", {"name": "Guest", "room_id": self.room.room_id})
        for player in self.room.players:
            player.ready = True

    async def asyncTearDown(self):
        self.bots.stop()
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    def payload(self, mission=1):
        return {"room_id": self.room.room_id, "status": self.room.status,
                "state_version": self.room.state_version, "mission_id": mission}

    async def test_lobby_start_restart_and_private_views_preserve_room_identity(self):
        identities = [(player.player_id, player.seat, player.reconnect_token) for player in self.room.players]
        self.assertEqual(self.room.host_player_id, app.SESSIONS["host"]["player_id"])
        self.assertEqual(await app.on_bomb_busters_select_mission("host", self.payload(1)), {"ok": True})
        original = self.room.game_state
        version = self.room.state_version
        app.sio.emits.clear()
        self.assertEqual(await app.on_bomb_busters_select_mission("host", self.payload(46)), {"ok": True})
        self.assertEqual(self.room.game_state["mission_id"], 46)
        self.assertNotEqual(original["rng_seed"], self.room.game_state["rng_seed"])
        self.assertEqual(self.room.state_version, version + 1)
        self.assertEqual(self.room.game_config, {"mission_id": 46})
        self.assertEqual(identities, [(player.player_id, player.seat, player.reconnect_token) for player in self.room.players])
        views = [message for message in app.sio.emits if message["event"] == "game:state"]
        self.assertEqual(len(views), 2)
        for message in views:
            public = message["payload"]["view"]
            self.assertNotIn("rng_seed", public)
            for rack in public["racks"]:
                if rack["owner_id"] != public["you"]:
                    for wire in rack["slots"]:
                        self.assertNotIn("blue_value", wire)

    async def test_rejects_non_host_invalid_and_unsupported_missions_atomically(self):
        for sid, mission in (("guest", 1), ("missing", 1), ("host", 0), ("host", 67), ("host", True), ("host", "1"), ("host", 34), ("host", 65)):
            with self.subTest(sid=sid, mission=mission):
                before = copy.deepcopy(self.room.game_state)
                version = self.room.state_version
                result = await app.on_bomb_busters_select_mission(sid, self.payload(mission))
                self.assertFalse(result["ok"])
                self.assertEqual(before, self.room.game_state)
                self.assertEqual(version, self.room.state_version)

    async def test_ready_stale_room_and_duplicate_requests_are_rejected(self):
        self.room.players[1].ready = False
        self.assertFalse((await app.on_bomb_busters_select_mission("host", self.payload()))["ok"])
        self.room.players[1].ready = True
        stale_lobby = self.payload()
        await app.on_bomb_busters_select_mission("host", self.payload())
        self.assertFalse((await app.on_bomb_busters_select_mission("host", stale_lobby))["ok"])
        stale = self.payload(9)
        await app.on_bomb_busters_select_mission("host", stale)
        before = copy.deepcopy(self.room.game_state)
        for payload in (stale, {**self.payload(), "room_id": "different"}, {**self.payload(), "state_version": None}):
            self.assertFalse((await app.on_bomb_busters_select_mission("host", payload))["ok"])
            self.assertEqual(before, self.room.game_state)

    async def test_host_transfer_and_saved_mission_restore(self):
        await app.on_bomb_busters_select_mission("host", self.payload(9))
        host = self.room.players[0]
        app._detach_room_player(self.room, host, preserve_seat=True)
        self.assertEqual(self.room.host_player_id, host.player_id)
        host.connected = True
        host.socket_id = "host"
        app._detach_room_player(self.room, host)
        self.assertEqual(self.room.host_player_id, app.SESSIONS["guest"]["player_id"])
        self.assertEqual(await app.on_bomb_busters_select_mission("guest", self.payload(22)), {"ok": True})
        guest = self.room.players[1]
        credentials = {"room_id": self.room.room_id, "player_id": guest.player_id, "reconnect_token": guest.reconnect_token}
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_reconnect("restored", credentials)
        restored = app.ROOMS[self.room.room_id]
        self.assertEqual(restored.game_state["mission_id"], 22)
        self.assertEqual(restored.host_player_id, guest.player_id)

    async def test_result_can_restart_and_old_rooms_keep_a_stable_host(self):
        await app.on_bomb_busters_select_mission("host", self.payload(1))
        self.room.host_player_id = None
        await app._emit_room_state(self.room)
        self.assertEqual(app.sio.emits[-1]["payload"]["host_player_id"], self.room.players[0].player_id)
        self.room.players[0].seat = 1
        self.room.players[1].seat = 0
        await app._emit_room_state(self.room)
        self.assertEqual(self.room.host_player_id, self.room.players[0].player_id)
        self.room.status = "game_over"
        self.assertEqual(await app.on_bomb_busters_select_mission("host", self.payload(9)), {"ok": True})
        self.assertEqual(self.room.status, "in_game")
        self.assertEqual(self.room.game_state["mission_id"], 9)
