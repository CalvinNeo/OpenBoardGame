import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from game.red_doors import RedDoorsGame as Game, _review
from tests.test_room_session import DummySio


class RedDoorsIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.sio.get_environ = lambda _sid: {}
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def room(self, count=4):
        await app.on_room_create("s0", {"name": "Explorer 0", "game_type": "red_doors", "config": {"seed": "secret-102"}})
        rid = app.SESSIONS["s0"]["room_id"]
        for i in range(1, count):
            await app.on_room_join(f"s{i}", {"name": f"Explorer {i}", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        await asyncio.sleep(0)
        return room

    async def test_catalog_and_room_start_hide_seed(self):
        entry = next(g for g in await app.api_list_games() if g["game_id"] == "red_doors")
        self.assertEqual((entry["min_players"], entry["max_players"]), (4, 6))
        self.assertEqual(entry["name_zh"], "红色的门和杀人鬼的钥匙")
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        for emitted in app.sio.emits:
            if emitted["event"] == "room:state":
                self.assertNotIn("seed", emitted["payload"]["game_config"])
            if emitted["event"] == "game:state":
                self.assertNotIn("seed", emitted["payload"]["view"])

    async def test_player_limits(self):
        room = await self.room(3)
        self.assertEqual(room.status, "lobby")
        for i in range(3, 6):
            await app.on_room_join(f"s{i}", {"name": f"Explorer {i}", "room_id": room.room_id})
        await app.on_room_join("extra", {"name": "Extra", "room_id": room.room_id})
        self.assertEqual(len(room.players), 6)
        self.assertNotIn("extra", app.SESSIONS)

    async def test_socket_private_peek_and_shared_events_are_redacted(self):
        room = await self.room()
        state = room.game_state
        card = next(c for c in state["cards"].values() if c["kind"] == "killer_key")
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": {"type": "open_door", "door_id": card["ref"], "board_epoch": state["board_epoch"], "turn_id": state["turn_id"]}})
        updates = [e for e in app.sio.emits if e["event"] == "game:state"]
        self.assertEqual(len(updates), 4)
        for update in updates:
            payload = update["payload"]
            view = payload["view"]
            if update["to"] == "s0":
                self.assertEqual(view["private"]["kind"], "killer_key")
            else:
                self.assertEqual(view["phase"], "resolving")
                self.assertIsNone(view["private"])
                self.assertTrue(all(d["known_kind"] is None for d in view["doors"]))
            self.assertEqual(payload["events"], [{"type": "red_doors:update", "payload": {"actor": room.players[0].player_id}}])
        for action in ({"type": "resolve_door", "choice": "return"}, {"type": "resolve_door", "choice": "use"}, {"type": "choose_target", "target_id": "secret"}):
            self.assertEqual(app._public_bot_action("red_doors", action), {"type": "resolve"})

    async def test_skip_validation_cannot_change_state(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {"type": "open_door", "door_id": "killer_key:0", "turn_id": True, "board_epoch": 1}})
        self.assertEqual(before, room.game_state)
        self.assertTrue(any(e["event"] == "system:error" for e in app.sio.emits))

    async def test_disconnect_reconnect_restores_private_card_and_review_votes(self):
        room = await self.room()
        state = room.game_state
        card = next(c for c in state["cards"].values() if c["kind"] == "killer_key")
        await app.on_game_action("s0", {"action": {"type": "open_door", "door_id": card["ref"], "board_epoch": 1, "turn_id": 1}})
        player = room.players[0]
        await app.disconnect("s0")
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        payload = next(e["payload"] for e in app.sio.emits if e["event"] == "game:state" and e["to"] == "s-new")
        self.assertEqual(payload["view"]["private"]["kind"], "killer_key")
        _review(state, "all_dead", [])
        rid = state["review_id"]
        for i in range(1, 4):
            await app.on_game_action(f"s{i}", {"action": {"type": "next_round", "review_id": rid}})
        self.assertEqual(state["phase"], "round_end")
        await app.on_game_action("s-new", {"action": {"type": "next_round", "review_id": rid}})
        self.assertEqual((state["round"], state["phase"]), (2, "choose_door"))

    async def test_bot_loop_confirms_dead_bots_without_confirming_human(self):
        room = await self.room()
        state = room.game_state
        for player in room.players[1:]:
            player.is_bot = True
            state["players"][player.player_id]["is_bot"] = True
            state["players"][player.player_id]["alive"] = False
        _review(state, "all_dead", [])
        # Exercise the actual server scheduler while eliminating its cosmetic delay.
        async def no_delay(_seconds):
            return None
        tasks = []
        create_task = asyncio.create_task
        def capture(coroutine):
            task = create_task(coroutine)
            tasks.append(task)
            return task
        with patch("app.asyncio.sleep", new=no_delay), patch("app.asyncio.create_task", side_effect=capture):
            await app._maybe_run_bots(room)
            await asyncio.gather(*tasks)
        self.assertEqual(set(state["ready"]), {p.player_id for p in room.players[1:]})
        self.assertEqual((room.status, state["phase"], state["game_over"]), ("in_game", "round_end", False))


if __name__ == "__main__":
    unittest.main()
