import unittest

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
