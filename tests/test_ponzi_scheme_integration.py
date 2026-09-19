import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.ponzi_scheme import PonziSchemeGame as Game, _settle
from tests.test_room_session import DummySio


class PonziSchemeIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def room(self, count=3):
        await app.on_room_create("s0", {"name": "Investor 0", "game_type": "ponzi_scheme", "config": {"seed": "private-seed", "advanced": True}})
        rid = app.SESSIONS["s0"]["room_id"]
        for i in range(1, count):
            await app.on_room_join(f"s{i}", {"name": f"Investor {i}", "room_id": rid})
        room = app.ROOMS[rid]
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def test_catalog_and_three_player_room_start(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == "ponzi_scheme")
        self.assertEqual((entry["min_players"], entry["max_players"], entry["name_zh"]), (3, 5, "庞氏骗局"))
        self.assertIn("bluffing", [tag["id"] for tag in entry["tags"]])
        room = await self.room()
        self.assertEqual((room.status, room.game_state["phase"]), ("in_game", "funding"))
        self.assertTrue(room.game_state["config"]["advanced"])
        for emitted in app.sio.emits:
            if emitted["event"] == "room:state":
                self.assertNotIn("seed", emitted["payload"]["game_config"])
            if emitted["event"] == "game:state":
                view = emitted["payload"]["view"]
                self.assertNotIn("seed", view)
                for player in view["players"]:
                    self.assertEqual(player["cash"], 0 if player["player_id"] == view["you"] else None)

    async def test_room_rejects_too_few_and_too_many_players(self):
        room = await self.room(2)
        self.assertEqual(room.status, "lobby")
        for i in range(2, 5):
            await app.on_room_join(f"s{i}", {"name": f"Investor {i}", "room_id": room.room_id})
        await app.on_room_join("extra", {"name": "Extra", "room_id": room.room_id})
        self.assertEqual(len(room.players), 5)
        self.assertNotIn("extra", app.SESSIONS)

    async def test_socket_trade_hides_amount_from_third_player_and_bot_broadcast(self):
        room = await self.room()
        state = room.game_state
        state.update(phase="trading", round=2)
        for player in state["players"].values():
            player["cash"] = 98765
            player["industries"]["grain"] = 1
        target = room.players[1].player_id
        action = {"type": "offer_trade", "target": target, "industry": "grain", "amount": 7331}
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action})
        updates = [emitted for emitted in app.sio.emits if emitted["event"] == "game:state"]
        self.assertEqual(len(updates), 3)
        for emitted in updates:
            payload = emitted["payload"]
            if emitted["to"] == "s2":
                self.assertNotIn("7331", json.dumps(payload))
            else:
                self.assertEqual(payload["view"]["offer"]["amount"], 7331)
            self.assertNotIn("7331", json.dumps(payload["events"]))
        self.assertEqual(app._public_bot_action("ponzi_scheme", action), {"type": "offer_trade"})

    async def test_skip_schema_flag_cannot_bypass_game_validation(self):
        room = await self.room()
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"skip_validation": True, "action": {"type": "fund", "card_id": "fund-80", "industry": "grain"}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(emitted["event"] == "system:error" for emitted in app.sio.emits))

    async def test_disconnect_reconnect_retains_review_and_private_cash(self):
        room = await self.room()
        room.game_state["players"][room.players[0].player_id]["cash"] = 12345
        _settle(room.game_state)
        await app.on_game_action("s0", {"action": {"type": "next_round"}})
        await app.on_game_action("s1", {"action": {"type": "next_round"}})
        player = room.players[2]
        await app.disconnect("s2")
        self.assertEqual(room.game_state["phase"], "round_end")
        app.sio.emits.clear()
        await app.on_room_reconnect("s-new", {"room_id": room.room_id, "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        update = next(emitted["payload"] for emitted in app.sio.emits if emitted["event"] == "game:state" and emitted["to"] == "s-new")
        self.assertEqual(update["view"]["phase"], "round_end")
        self.assertNotIn("12345", json.dumps(update))
        await app.on_game_action("s-new", {"action": {"type": "next_round"}})
        self.assertEqual((room.game_state["round"], room.game_state["phase"]), (2, "funding"))


if __name__ == "__main__":
    unittest.main()
