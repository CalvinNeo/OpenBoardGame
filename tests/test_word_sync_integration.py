import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.word_sync import WordSyncGame as Game
from tests.test_room_session import DummySio
from tests.test_word_sync import action


class WordSyncIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def make_room(self, count=4, start=True, mode="team"):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "word_sync", "config": {}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Player {index + 1}"})
        for player in room.players:
            player.ready = True
        if start:
            await app.on_room_start("s0", {"config": {"mode": mode}})
            self.assertEqual(room.status, "in_game")
            room.auto_save = True
            app._save_room_state(room)
        return room

    async def test_catalog_and_all_supported_counts(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "word_sync")
        self.assertEqual(row["name_zh"], "同频共词")
        self.assertEqual(row["player_counts"], list(range(2, 11)))
        self.assertEqual((row["min_players"], row["max_players"]), (2, 10))
        self.assertEqual({tag["id"] for tag in row["tags"]}, {"filler", "creative"})
        for mode, counts in Game.player_counts_by_mode.items():
            for count in counts:
                with self.subTest(mode=mode, count=count):
                    app.ROOMS.clear()
                    app.SESSIONS.clear()
                    room = await self.make_room(count, mode=mode)
                    self.assertEqual(room.game_state["mode"], mode)
                    self.assertEqual(len(room.game_state["teams"]), count // 2 if mode == "team" else count)
                    await app._emit_room_state(room)
                    self.assertEqual(list(app.sio.emits[-1]["payload"]["player_counts"]), list(range(2, 11)))

    async def test_team_mode_rejects_odd_counts_while_free_for_all_accepts_them(self):
        for count in (3, 5, 7, 9):
            with self.subTest(count=count):
                app.ROOMS.clear()
                app.SESSIONS.clear()
                room = await self.make_room(count, start=False)
                for payload in ({"skip_validation": True, "config": {"mode": "team"}}, {"config": {"mode": "team"}}):
                    await app.on_room_start("s0", payload)
                    self.assertEqual(room.status, "lobby")
                    self.assertIsNone(room.game_state)
                    self.assertEqual(app.sio.emits[-1]["event"], "system:error")
                await app.on_room_start("s0", {"config": {"mode": "battle_royale"}})
                self.assertEqual(room.status, "lobby")
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")
                await app.on_room_start("s0", {"config": {"mode": "free_for_all"}})
                self.assertEqual(room.status, "in_game")
                self.assertEqual(room.game_state["mode"], "free_for_all")
                self.assertEqual(len(room.game_state["teams"]), count)
                self.assertEqual(room.game_config, {"mode": "free_for_all"})

    async def test_submission_broadcast_only_reveals_owners_word(self):
        room = await self.make_room()
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action(room.game_state, "submit_word", word="private-token-42")})
        messages = [event for event in app.sio.emits if event["event"] == "game:state"]
        self.assertEqual(len(messages), 4)
        for message in messages:
            view = message["payload"]["view"]
            if message["to"] == "s0":
                self.assertEqual(view["your_word"], "private-token-42")
            else:
                self.assertNotIn("private-token-42", json.dumps(message))
            self.assertNotIn("private-token-42", json.dumps(message["payload"]["events"]))
        bot_action = action(room.game_state, "submit_word", word="private-bot-word")
        self.assertEqual(app._public_bot_action("word_sync", bot_action), {"type": "submit_word"})

    async def test_free_for_all_room_flow_reveals_every_word_at_once(self):
        room = await self.make_room(5, mode="free_for_all")
        self.assertEqual(room.game_config, {"mode": "free_for_all"})
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action(room.game_state, "submit_word", word="hidden-ffa-token")})
        messages = [event for event in app.sio.emits if event["event"] == "game:state"]
        self.assertEqual(len(messages), 5)
        for message in messages:
            view = message["payload"]["view"]
            self.assertEqual(view["mode"], "free_for_all")
            self.assertEqual(view["your_word"], "hidden-ffa-token" if message["to"] == "s0" else None)
            self.assertNotIn("hidden-ffa-token", json.dumps(message["payload"]["events"]))
        for index, word in enumerate(("月亮", "海", "moon", "MOON", "山"), start=1):
            await app.on_game_action(f"s{index}", {"action": action(room.game_state, "submit_word", word=word)})
        self.assertEqual(room.status, "game_over")
        self.assertEqual(room.game_state["winner"], [room.players[3].player_id, room.players[4].player_id])
        self.assertEqual(room.game_state["winning_team_ids"], ["team-4", "team-5"])
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))

    async def test_server_validation_cannot_be_bypassed(self):
        room = await self.make_room()
        for skip in (False, True):
            for fields in ({"word": " "}, {"word": 9}, {"word": "bad\u200bword"},
                           {"word": "test", "window_id": True}, {"word": "test", "game_token": "stale"}):
                with self.subTest(skip=skip, fields=fields):
                    before = copy.deepcopy(room.game_state)
                    await app.on_game_action("s0", {"skip_validation": skip, "action": action(room.game_state, "submit_word", **fields)})
                    self.assertEqual(room.game_state, before)
                    self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_used_words_are_rejected_over_the_socket(self):
        for mode in ("team", "free_for_all"):
            with self.subTest(mode=mode):
                app.ROOMS.clear()
                app.SESSIONS.clear()
                room = await self.make_room(4, mode=mode)
                for index, word in enumerate(("月亮", "星星", "山", "海")):
                    await app.on_game_action(f"s{index}", {"action": action(room.game_state, "submit_word", word=word)})
                self.assertEqual(room.game_state["phase"], "reveal")
                for index in range(4):
                    await app.on_game_action(f"s{index}", {"action": action(room.game_state, "next_round")})
                self.assertEqual((room.game_state["round"], room.game_state["phase"]), (2, "guess"))
                states = [event for event in app.sio.emits if event["event"] == "game:state"]
                self.assertEqual(states[-1]["payload"]["view"]["used_words"], ["月亮", "星星", "山", "海"])
                before = copy.deepcopy(room.game_state)
                for skip in (False, True):
                    await app.on_game_action("s0", {"skip_validation": skip,
                                                  "action": action(room.game_state, "submit_word", word="  月亮 ")})
                    self.assertEqual(room.game_state, before)
                    self.assertEqual(app.sio.emits[-1]["event"], "system:error")
                    self.assertIn("already used", app.sio.emits[-1]["payload"]["message"])
                await app.on_game_action("s0", {"action": action(room.game_state, "submit_word", word="河")})
                self.assertEqual(room.game_state["pending"], {room.players[0].player_id: "河"})

    async def test_live_and_cold_save_privacy_and_reconnect(self):
        room = await self.make_room()
        owner = room.players[0]
        await app.on_game_action("s0", {"action": action(room.game_state, "submit_word", word="secret")})
        expected = Game.get_public_view(room.game_state, owner.player_id)
        credentials = {"room_id": room.room_id, "player_id": owner.player_id, "reconnect_token": owner.reconnect_token}
        for cold in (False, True):
            with self.subTest(cold=cold):
                if cold:
                    app.ROOMS.clear()
                    app.SESSIONS.clear()
                with self.assertRaises(app.HTTPException) as caught:
                    await app.download_room_save(room.room_id)
                self.assertEqual(caught.exception.status_code, 403)
                await app.on_room_load("outsider", {"source_room_id": room.room_id})
                self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
                await app.on_room_reconnect("bad", {**credentials, "reconnect_token": "wrong"})
                self.assertNotIn("bad", app.SESSIONS)
                with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock) as resume:
                    await app.on_room_reconnect("new", credentials)
                    resume.assert_awaited_once()
                restored = app.ROOMS[room.room_id]
                self.assertEqual(Game.get_public_view(restored.game_state, owner.player_id), expected)
                self.assertEqual(restored.players[0].socket_id, "new")
                if cold:
                    self.assertEqual([player.socket_id for player in restored.players if player.connected], ["new"])
                else:
                    self.assertNotIn("s0", app.SESSIONS)

    async def test_full_room_flow_and_finished_download(self):
        room = await self.make_room()
        for index, word in enumerate(("月亮", "月亮", "山", "海")):
            await app.on_game_action(f"s{index}", {"action": action(room.game_state, "submit_word", word=word)})
        self.assertEqual(room.game_state["phase"], "reveal")
        for index in range(3):
            await app.on_game_action(f"s{index}", {"action": action(room.game_state, "next_round")})
        self.assertEqual(room.game_state["phase"], "reveal")
        await app.on_game_action("s3", {"action": action(room.game_state, "next_round")})
        self.assertEqual(room.game_state["round"], 2)
        for index in (2, 3):
            await app.on_game_action(f"s{index}", {"action": action(room.game_state, "submit_word", word="海岸")})
        self.assertEqual(room.status, "game_over")
        self.assertEqual(room.game_state["winner"], [player.player_id for player in room.players[:2]])
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith(".save"))
        expected = Game.serialize(room.game_state)
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_load("reader", {"source_room_id": room.room_id})
        result = next(event for event in reversed(app.sio.emits) if event["event"] == "room:load_result")
        self.assertTrue(result["payload"]["ok"])
        restored = app.ROOMS[result["payload"]["room_id"]]
        self.assertEqual(Game.serialize(restored.game_state), expected)


if __name__ == "__main__":
    unittest.main()
