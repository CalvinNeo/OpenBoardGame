import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game import CockroachPokerGame
from tests.test_room_session import DummySio


class CockroachPokerRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio = app.sio
        self.original_data = app.DATA_DIR
        self.original_rooms = dict(app.ROOMS)
        self.original_sessions = dict(app.SESSIONS)
        self.directory = TemporaryDirectory()
        app.sio = DummySio()
        app.DATA_DIR = self.directory.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("alice", {"name": "Alice", "game_type": "cockroach_poker"})
        self.room_id = app.SESSIONS["alice"]["room_id"]
        self.room = app.ROOMS[self.room_id]
        for socket_id, name in (("bob", "Bob"), ("carol", "Carol")):
            await app.on_room_join(socket_id, {"room_id": self.room_id, "name": name})
        self.sockets = {app.SESSIONS[socket_id]["player_id"]: socket_id for socket_id in ("alice", "bob", "carol")}
        for socket_id in self.sockets.values():
            await app.on_room_ready(socket_id, {"ready": True})
        await app.on_room_start("alice", {"config": {}})
        self.assertEqual(self.room.status, "in_game")

    async def asyncTearDown(self):
        await asyncio.sleep(0)
        app.sio = self.original_sio
        app.DATA_DIR = self.original_data
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.directory.cleanup()

    async def act(self, actor, action_type, **fields):
        await app.on_game_action(self.sockets[actor], {"action": {
            "type": action_type, "revision": self.room.game_state["revision"], **fields
        }})

    async def offer(self):
        state = self.room.game_state
        sender = state["active_player"]
        receiver = next(player_id for player_id in state["turn_order"] if player_id != sender)
        card = copy.deepcopy(state["players"][sender]["hand"][0])
        await self.act(sender, "offer", card=card["id"], target=receiver, claim=card["kind"])
        return sender, receiver, card

    def latest_view(self, socket_id):
        return [entry["payload"]["view"] for entry in app.sio.emits
                if entry["event"] == "game:state" and entry["to"] == socket_id][-1]

    async def test_broadcast_only_authorized_hand_and_private_peek(self):
        sender, receiver, card = await self.offer()
        for actor, socket_id in self.sockets.items():
            view = self.latest_view(socket_id)
            self.assertEqual(view["hand"], self.room.game_state["players"][actor]["hand"])
            self.assertEqual(view["pending"]["card"], card if actor == sender else None)
        await self.act(receiver, "peek")
        self.assertEqual(self.latest_view(self.sockets[receiver])["pending"]["card"], card)
        third = next(actor for actor in self.sockets if actor not in (sender, receiver))
        self.assertIsNone(self.latest_view(self.sockets[third])["pending"]["card"])

    async def test_invalid_action_replay_does_not_change_room_version(self):
        sender, receiver, _ = await self.offer()
        before = copy.deepcopy(self.room.game_state)
        version = self.room.state_version
        await self.act(sender, "judge", believe=True)
        await self.act(receiver, "judge", believe="true")
        self.assertEqual(self.room.state_version, version)
        self.assertEqual(self.room.game_state, before)

    async def test_save_reconnect_during_peek_keeps_private_state(self):
        self.room.auto_save = True
        _, receiver, card = await self.offer()
        await self.act(receiver, "peek")
        saved = app._load_latest_save(self.room_id)
        self.assertEqual(CockroachPokerGame.deserialize(saved["game_state"]), self.room.game_state)
        player = next(player for player in self.room.players if player.player_id == receiver)
        await app.on_room_reconnect("new-socket", {"room_id": self.room_id, "player_id": receiver,
                                                     "reconnect_token": player.reconnect_token})
        view = self.latest_view("new-socket")
        self.assertEqual(view["phase"], "pass")
        self.assertEqual(view["pending"]["card"], card)
        self.assertEqual(view["legal_actions"], ["pass"])

    async def test_room_stays_active_until_everyone_confirms_final_result(self):
        sender = self.room.game_state["active_player"]
        self.room.game_state["players"][sender]["hand"] = self.room.game_state["players"][sender]["hand"][:1]
        _, receiver, _ = await self.offer()
        await self.act(receiver, "judge", believe=True)
        self.assertEqual(self.room.status, "in_game")
        for actor in self.room.game_state["turn_order"][:-1]:
            await self.act(actor, "confirm")
            self.assertEqual(self.room.status, "in_game")
        await self.act(self.room.game_state["turn_order"][-1], "confirm")
        self.assertEqual(self.room.status, "game_over")

    async def test_bot_runner_uses_real_game_actions(self):
        state = self.room.game_state
        sender, receiver, _ = await self.offer()
        bot = next(player for player in self.room.players if player.player_id == receiver)
        bot.is_bot = True
        await app._maybe_run_bots(self.room)
        for _ in range(200):
            if not self.room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(self.room.bot_running)
        self.assertGreater(state["revision"], 1)
        self.assertNotEqual(state["phase"], "pass")

    async def test_bot_final_confirmation_broadcasts_room_status(self):
        state = self.room.game_state
        sender = state["active_player"]
        state["players"][sender]["hand"] = state["players"][sender]["hand"][:1]
        _, receiver, _ = await self.offer()
        await self.act(receiver, "judge", believe=True)
        last = state["turn_order"][-1]
        for actor in state["turn_order"][:-1]:
            await self.act(actor, "confirm")
        for _ in range(100):
            if not self.room.bot_running:
                break
            await asyncio.sleep(0.01)
        next(player for player in self.room.players if player.player_id == last).is_bot = True
        app.sio.emits.clear()
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app._maybe_run_bots(self.room)
        with patch.object(app.asyncio, "sleep", new_callable=AsyncMock):
            for runner in runners:
                await runner
        states = [entry["payload"] for entry in app.sio.emits if entry["event"] == "room:state"]
        self.assertEqual(states[-1]["status"], "game_over")
        self.assertTrue(any(entry["event"] == "room:list_update" for entry in app.sio.emits))

    async def test_bot_activity_does_not_disclose_private_card_id(self):
        private = {"type": "offer", "card": "private-card-id", "claim": "rat", "target": "other", "revision": 4}
        self.assertEqual(app._public_bot_action("cockroach_poker", private), {"type": "offer"})
