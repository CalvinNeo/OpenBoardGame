import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

import app


class DummySio:
    def __init__(self):
        self.emits = []
        self.entered = []
        self.left = []

    async def emit(self, event, payload, to=None):
        self.emits.append({"event": event, "payload": payload, "to": to})

    async def enter_room(self, sid, room_id):
        self.entered.append((sid, room_id))

    async def leave_room(self, sid, room_id):
        self.left.append((sid, room_id))


class RoomSessionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._original_sio = app.sio
        app.sio = DummySio()
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio = self._original_sio
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def _create_room(self, sid, name, game_type="cabo"):
        await app.on_room_create(sid, {"name": name, "game_type": game_type})
        return app.SESSIONS[sid]["room_id"]

    async def test_create_cleans_previous_lobby_session(self):
        sid = "sid-1"
        room_id_first = await self._create_room(sid, "Alice")
        self.assertIn(room_id_first, app.ROOMS)

        room_id_second = await self._create_room(sid, "Alice")

        self.assertIn(room_id_second, app.ROOMS)
        self.assertNotIn(room_id_first, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid]["room_id"], room_id_second)

    async def test_join_cleans_previous_lobby_session(self):
        sid_owner = "sid-owner"
        room_id_a = await self._create_room(sid_owner, "Alice")
        sid_host = "sid-host"
        room_id_b = await self._create_room(sid_host, "Bob")

        await app.on_room_join(sid_owner, {"room_id": room_id_b, "name": "Alice"})

        self.assertNotIn(room_id_a, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid_owner]["room_id"], room_id_b)
        self.assertEqual(len(app.ROOMS[room_id_b].players), 2)

    async def test_invalid_create_does_not_clear_existing_session(self):
        sid = "sid-1"
        room_id = await self._create_room(sid, "Alice")

        await app.on_room_create(sid, {"game_type": "cabo"})

        self.assertIn(room_id, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid]["room_id"], room_id)

    async def test_reconnect_cleans_previous_session(self):
        sid_old = "sid-old"
        room_id_old = await self._create_room(sid_old, "Alice")

        sid_host = "sid-host"
        room_id_new = await self._create_room(sid_host, "Bob")
        target_player = app.ROOMS[room_id_new].players[0]
        target_player.connected = False
        target_player.socket_id = None

        await app.on_room_reconnect(
            sid_old,
            {
                "room_id": room_id_new,
                "player_id": target_player.player_id,
                "reconnect_token": target_player.reconnect_token,
            },
        )

        self.assertNotIn(room_id_old, app.ROOMS)
        self.assertEqual(app.SESSIONS[sid_old]["room_id"], room_id_new)
        self.assertTrue(target_player.connected)
        self.assertEqual(target_player.socket_id, sid_old)

    async def test_reconnect_marks_in_game_player_offline(self):
        sid_old = "sid-old"
        room_id_old = await self._create_room(sid_old, "Alice")
        old_room = app.ROOMS[room_id_old]
        old_room.status = "in_game"
        old_room.game_state = {"started": True}
        old_player = old_room.players[0]

        sid_host = "sid-host"
        room_id_new = await self._create_room(sid_host, "Bob")
        target_player = app.ROOMS[room_id_new].players[0]
        target_player.connected = False
        target_player.socket_id = None

        await app.on_room_reconnect(
            sid_old,
            {
                "room_id": room_id_new,
                "player_id": target_player.player_id,
                "reconnect_token": target_player.reconnect_token,
            },
        )

        self.assertIn(room_id_old, app.ROOMS)
        self.assertFalse(old_player.connected)
        self.assertIsNone(old_player.socket_id)
        self.assertEqual(app.SESSIONS[sid_old]["room_id"], room_id_new)

    async def test_reconnect_allows_loaded_room(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice")
        room = app.ROOMS[room_id]
        room.source_room_id = "source-room"
        player = room.players[0]
        player.connected = False
        player.socket_id = None
        app.SESSIONS.pop(sid_owner, None)

        sid_new = "sid-new"
        await app.on_room_reconnect(
            sid_new,
            {
                "room_id": room_id,
                "player_id": player.player_id,
                "reconnect_token": player.reconnect_token,
            },
        )

        self.assertTrue(player.connected)
        self.assertEqual(player.socket_id, sid_new)
        self.assertEqual(app.SESSIONS[sid_new]["room_id"], room_id)

    async def test_claim_seat_rejects_second_claim(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice")
        room = app.ROOMS[room_id]
        room.source_room_id = "source-room"
        player = room.players[0]
        player.connected = False
        player.socket_id = None
        player.seat_claimed = False
        app.SESSIONS.pop(sid_owner, None)

        sid_claim = "sid-claim"
        await app.on_room_claim_seat(
            sid_claim,
            {"room_id": room_id, "seat": 0, "name": "Alice"},
        )

        first_result = next(
            event for event in reversed(app.sio.emits) if event["event"] == "room:claim_result"
        )
        self.assertTrue(first_result["payload"]["ok"])

        sid_again = "sid-again"
        await app.on_room_claim_seat(
            sid_again,
            {"room_id": room_id, "seat": 0, "name": "Bob"},
        )

        second_result = next(
            event for event in reversed(app.sio.emits) if event["event"] == "room:claim_result"
        )
        self.assertFalse(second_result["payload"]["ok"])
        self.assertEqual(second_result["payload"]["message"], "seat already claimed")

    async def test_move_seat_swaps_order(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice")
        sid_bob = "sid-bob"
        await app.on_room_join(sid_bob, {"room_id": room_id, "name": "Bob"})

        await app.on_room_move_seat(sid_bob, {"direction": "up"})

        room = app.ROOMS[room_id]
        alice = next(player for player in room.players if player.name == "Alice")
        bob = next(player for player in room.players if player.name == "Bob")
        self.assertEqual(bob.seat, 0)
        self.assertEqual(alice.seat, 1)
        self.assertEqual(room.players[0].player_id, bob.player_id)
        self.assertEqual(room.players[1].player_id, alice.player_id)

    async def test_reopen_moves_players_to_new_room(self):
        sid_owner = "sid-owner"
        room_id = await self._create_room(sid_owner, "Alice", game_type="gold_rush")
        sid_bob = "sid-bob"
        await app.on_room_join(sid_bob, {"room_id": room_id, "name": "Bob"})
        room = app.ROOMS[room_id]
        room.status = "in_game"
        room.game_state = {"config": {"mode": "classic"}}
        old_players = {p.name: (p.player_id, p.reconnect_token) for p in room.players}

        await app.on_room_reopen(sid_owner, {})

        new_room_id = app.SESSIONS[sid_owner]["room_id"]
        self.assertNotEqual(new_room_id, room_id)
        self.assertNotIn(room_id, app.ROOMS)
        self.assertIn(new_room_id, app.ROOMS)
        new_room = app.ROOMS[new_room_id]
        self.assertEqual(new_room.status, "in_game")
        self.assertEqual(new_room.game_type, "gold_rush")
        self.assertEqual(new_room.game_state["config"]["mode"], "classic")
        ordered = sorted(new_room.players, key=lambda p: p.seat)
        self.assertEqual([p.name for p in ordered], ["Alice", "Bob"])
        for player in new_room.players:
            old_player_id, old_token = old_players[player.name]
            self.assertEqual(player.player_id, old_player_id)
            self.assertEqual(player.reconnect_token, old_token)

        self.assertEqual(app.SESSIONS[sid_bob]["room_id"], new_room_id)
        self.assertIn((sid_owner, room_id), app.sio.left)
        self.assertIn((sid_bob, room_id), app.sio.left)
        self.assertIn((sid_owner, new_room_id), app.sio.entered)
        self.assertIn((sid_bob, new_room_id), app.sio.entered)

    async def test_auto_save_allows_in_game_enable(self):
        sid = "sid-owner"
        room_id = await self._create_room(sid, "Alice")
        room = app.ROOMS[room_id]
        room.status = "in_game"
        room.game_state = {"started": True}
        app.sio.emits.clear()

        await app.on_room_auto_save(sid, {"auto_save": True})

        self.assertTrue(room.auto_save)
        self.assertFalse(any(event["event"] == "system:error" for event in app.sio.emits))

    async def test_auto_save_cannot_disable_after_enabled(self):
        sid = "sid-owner"
        room_id = await self._create_room(sid, "Alice")
        room = app.ROOMS[room_id]
        room.auto_save = True
        app.sio.emits.clear()

        await app.on_room_auto_save(sid, {"auto_save": False})

        self.assertTrue(room.auto_save)
        errors = [event for event in app.sio.emits if event["event"] == "system:error"]
        self.assertTrue(errors)
        self.assertEqual(errors[-1]["payload"]["message"], "auto-save already enabled")

    async def test_guandan_checkpoint_api_lists_supported_files(self):
        with TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "alpha.pt").write_text("x", encoding="utf-8")
            (root / "beta.pth").write_text("x", encoding="utf-8")
            (root / "notes.txt").write_text("x", encoding="utf-8")
            original_dir = app.GUANDAN_CHECKPOINT_DIR
            try:
                app.GUANDAN_CHECKPOINT_DIR = root
                payload = await app.guandan_checkpoints()
            finally:
                app.GUANDAN_CHECKPOINT_DIR = original_dir

        self.assertEqual(
            payload,
            {
                "checkpoints": [
                    {"label": "alpha.pt", "path": "alpha.pt"},
                    {"label": "beta.pth", "path": "beta.pth"},
                ]
            },
        )
