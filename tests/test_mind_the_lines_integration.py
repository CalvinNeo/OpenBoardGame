"""Room, privacy, and timer integration for Mind the Lines."""

import asyncio
import copy
import json
import time
import unittest
from tempfile import TemporaryDirectory

import app
from game.mind_the_lines import MindTheLinesGame as Game
from tests.test_room_session import DummySio


class MindTheLinesIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        self.room_number = 0
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = "game_over"
        for _ in range(300):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(0.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, count=4, bots=False, config=None, start=True):
        self.room_number += 1
        prefix = f"mind-{self.room_number}"
        room_config = {"seed": 132, "difficulty": "easy", "draw_seconds": 0}
        room_config.update(config or {})
        await app.on_room_create(f"{prefix}-0", {
            "name": "Alice", "game_type": "mind_the_lines", "config": room_config,
        })
        self.assertIn(f"{prefix}-0", app.SESSIONS)
        room = app.ROOMS[app.SESSIONS[f"{prefix}-0"]["room_id"]]
        for index in range(1, count):
            if bots:
                await app.on_room_add_bot(f"{prefix}-0", {})
            else:
                await app.on_room_join(f"{prefix}-{index}", {
                    "room_id": room.room_id, "name": f"Artist {index}",
                })
        for player in room.players:
            player.ready = True
        if start:
            await app.on_room_start(f"{prefix}-0", {})
        return room

    def view(self, room, player):
        player_id = player if isinstance(player, str) else player.player_id
        return Game.get_public_view(room.game_state, player_id)

    async def action(self, room, player, kind, **fields):
        action = {"type": kind, "round_token": room.game_state["round_token"], **fields}
        start = len(app.sio.emits)
        await app.on_game_action(player.socket_id, {"action": action})
        errors = [item["payload"] for item in app.sio.emits[start:] if item["event"] == "system:error"]
        self.assertEqual(errors, [], action)

    async def begin_drawing(self, room):
        for player in room.players:
            await self.action(room, player, "ready")
        self.assertEqual(room.game_state["phase"], "drawing")

    async def submit_all(self, room):
        for player in room.players:
            drawing = self.view(room, player)["your_drawing"]
            await self.action(room, player, "submit_drawing", segments=[0, 1],
                              side=0, rotation=0, seq=drawing["seq"] + 1)
        self.assertEqual(room.game_state["phase"], "oracle")

    async def finish_round_without_errors(self, room):
        real_ids = {word["id"] for player in room.players
                    for word in self.view(room, player)["your_words"]}
        while room.game_state["phase"] == "oracle":
            player = next(player for player in room.players
                          if player.player_id == room.game_state["current_turn"])
            view = self.view(room, player)
            card = next(card for card in view["cards"]
                        if card["id"] not in real_ids and not card.get("eliminated_by"))
            await self.action(room, player, "eliminate", card_id=card["id"], revision=view["revision"])
        self.assertEqual(room.game_state["phase"], "round_result")
        self.assertEqual(room.game_state["errors"], 0)

    async def wait_bots(self, room):
        for _ in range(1000):
            if not room.bot_running:
                return
            await asyncio.sleep(0.01)
        self.fail("bot runner did not return control to the human")

    async def wait_phase(self, room, phase):
        for _ in range(200):
            if room.game_state["phase"] == phase:
                return
            await asyncio.sleep(0.01)
        self.fail(f"expected {phase}, got {room.game_state['phase']}")

    @staticmethod
    def without_clock(view):
        result = copy.deepcopy(view)
        result.pop("server_now_ms", None)
        return result

    async def test_catalog_and_every_supported_player_count(self):
        entry = next(game for game in await app.api_list_games()
                     if game["game_id"] == "mind_the_lines")
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]),
                         ("出神入画", 2, 8))
        self.assertIn("cooperative", {tag["id"] for tag in entry["tags"]})
        self.assertIn("creative", {tag["id"] for tag in entry["tags"]})
        for count in range(2, 9):
            with self.subTest(players=count):
                room = await self.make_room(count)
                self.assertEqual(room.status, "in_game")
                self.assertEqual(room.game_state["phase"], "ready")
                view = self.view(room, room.players[0])
                self.assertEqual(len(view["players"]), count)
                self.assertEqual(view["words_per_player"], 2 if count <= 3 else 1)
                self.assertEqual(len(view["your_words"]), view["words_per_player"])

    async def test_room_rejects_single_player_and_ninth_seat(self):
        alone = await self.make_room(1)
        self.assertEqual(alone.status, "lobby")
        self.assertIsNone(alone.game_state)
        full = await self.make_room(8, start=False)
        app.sio.emits.clear()
        await app.on_room_join("ninth", {"room_id": full.room_id, "name": "Ninth"})
        self.assertEqual(len(full.players), 8)
        self.assertNotIn("ninth", app.SESSIONS)
        self.assertTrue(any(item["event"] == "system:error" for item in app.sio.emits))

    async def test_invalid_configuration_is_rejected_before_room_creation(self):
        for config in ({"difficulty": "impossible"}, {"draw_seconds": 1}, {"seed": []}):
            with self.subTest(config=config):
                app.sio.emits.clear()
                await app.on_room_create("invalid", {
                    "name": "Alice", "game_type": "mind_the_lines", "config": config,
                })
                self.assertNotIn("invalid", app.SESSIONS)
                self.assertTrue(any(item["event"] == "system:error" for item in app.sio.emits))
        self.assertEqual(app.ROOMS, {})

    async def test_schema_and_bypass_reject_bad_drawings_atomically(self):
        room = await self.make_room()
        await self.begin_drawing(room)
        player = room.players[0]
        base = {"type": "save_drawing", "round_token": room.game_state["round_token"],
                "segments": [0], "side": 0, "rotation": 0, "seq": 1}
        bad_actions = [
            {key: value for key, value in base.items() if key != "round_token"},
            {**base, "segments": [-1]},
            {**base, "segments": [999999]},
            {**base, "side": 2},
            {**base, "rotation": 45},
            {**base, "seq": True},
            {**base, "segments": [[0, 0, 100, 100]]},
        ]
        for skip_validation in (False, True):
            for action in bad_actions:
                with self.subTest(skip=skip_validation, action=action):
                    before = copy.deepcopy(room.game_state)
                    version = room.state_version
                    app.sio.emits.clear()
                    await app.on_game_action(player.socket_id, {
                        "action": action, "skip_validation": skip_validation,
                    })
                    self.assertEqual(room.game_state, before)
                    self.assertEqual(room.state_version, version)
                    self.assertTrue(any(item["event"] == "system:error" for item in app.sio.emits))

    async def test_broadcast_hides_seed_foreign_words_and_drafts(self):
        room = await self.make_room()
        room_updates = [item["payload"] for item in app.sio.emits if item["event"] == "room:state"]
        self.assertTrue(room_updates)
        self.assertTrue(all("seed" not in item["game_config"] for item in room_updates))
        self.assertEqual(room.game_config["seed"], 132)
        await self.begin_drawing(room)
        artist = room.players[0]
        words = {player.player_id: self.view(room, player)["your_words"] for player in room.players}
        app.sio.emits.clear()
        await self.action(room, artist, "save_drawing", segments=[0, 2, 4], side=1, rotation=1, seq=1)
        updates = [item for item in app.sio.emits if item["event"] == "game:state"]
        self.assertEqual(len(updates), len(room.players))
        for message in updates:
            view = message["payload"]["view"]
            viewer = next(player for player in room.players if player.socket_id == message["to"])
            self.assertEqual(view["your_words"], words[viewer.player_id])
            self.assertFalse(view.get("drawings"))
            self.assertFalse(view.get("cards"))
            self.assertNotIn("seed", view)
            self.assertNotIn("seed", view["config"])
            self.assertNotIn("deck", view)
            serialized = json.dumps(view, ensure_ascii=False)
            for other in room.players:
                if other.player_id != viewer.player_id:
                    for word in words[other.player_id]:
                        self.assertNotIn(json.dumps(word["id"]), serialized)
            for public_player in view["players"]:
                self.assertNotIn("words", public_player)
                self.assertNotIn("drawing", public_player)
            if viewer.player_id == artist.player_id:
                self.assertEqual(view["your_drawing"]["segments"], [0, 2, 4])
            else:
                self.assertEqual(view["your_drawing"]["segments"], [])
            events = json.dumps(message["payload"]["events"], ensure_ascii=False)
            self.assertNotIn('"segments"', events)
            for private_words in words.values():
                for word in private_words:
                    self.assertNotIn(json.dumps(word["id"]), events)
        self.assertEqual(app._public_bot_action("mind_the_lines", {
            "type": "submit_drawing", "segments": [0, 2], "round_token": "secret", "seq": 4,
        }), {"type": "submit_drawing"})
        spectator = self.view(room, "not-a-player")
        self.assertFalse(spectator.get("your_words"))
        self.assertFalse(spectator.get("your_board"))
        self.assertFalse(spectator.get("your_drawing"))
        self.assertEqual(spectator["legal_actions"], [])

    async def test_oracle_does_not_reveal_word_owners_until_settlement(self):
        room = await self.make_room()
        await self.begin_drawing(room)
        await self.submit_all(room)
        player = next(player for player in room.players if player.player_id == room.game_state["current_turn"])
        view = self.view(room, player)
        self.assertEqual(len(view["drawings"]), 4)
        self.assertEqual(len(view["cards"]), 8)
        card = next(card for card in view["cards"] if card["id"] == view["your_words"][0]["id"])
        app.sio.emits.clear()
        await self.action(room, player, "eliminate", card_id=card["id"], revision=view["revision"])
        for message in app.sio.emits:
            if message["event"] != "game:state":
                continue
            view = message["payload"]["view"]
            self.assertEqual(view["phase"], "oracle")
            self.assertEqual(view["errors"], 0)
            self.assertTrue(all(card.get("owner_id") is None for card in view["cards"]))
            self.assertTrue(all(not drawing.get("words") for drawing in view["drawings"]))
            events = json.dumps(message["payload"]["events"])
            self.assertNotIn("owner_id", events)
            self.assertNotIn("correct", events)

    async def test_reconnect_preserves_latest_draft_and_owner_view(self):
        room = await self.make_room(config={"draw_seconds": 120})
        await self.begin_drawing(room)
        player = room.players[0]
        await self.action(room, player, "save_drawing", segments=[1, 3, 5], side=1, rotation=3, seq=7)
        before = copy.deepcopy(room.game_state)
        expected = self.without_clock(self.view(room, player))
        old_socket = player.socket_id
        await app.disconnect(old_socket)
        app.sio.emits.clear()
        await app.on_room_reconnect("reconnected", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        self.assertEqual(room.game_state, before)
        update = next(item for item in app.sio.emits
                      if item["event"] == "game:state" and item["to"] == "reconnected")
        self.assertEqual(self.without_clock(update["payload"]["view"]), expected)
        self.assertEqual(update["payload"]["view"]["your_drawing"]["seq"], 7)

    async def test_active_save_protection_and_cold_restore_preserve_drafts(self):
        room = await self.make_room(config={"draw_seconds": 120})
        await self.begin_drawing(room)
        await self.action(room, room.players[0], "save_drawing", segments=[2, 4], side=0, rotation=2, seq=2)
        room.auto_save = True
        app._save_room_state(room)
        with self.assertRaises(app.HTTPException) as error:
            await app.download_room_save(room.room_id)
        self.assertEqual(error.exception.status_code, 403)
        await app.on_room_load("clone", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in reversed(app.sio.emits)
                      if item["event"] == "room:load_result" and item["to"] == "clone")
        self.assertFalse(result["ok"])
        serialized = json.loads(json.dumps(Game.serialize(room.game_state)))
        restored_state = Game.deserialize(copy.deepcopy(serialized))
        self.assertEqual(restored_state, room.game_state)
        app.ROOMS.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in reversed(app.sio.emits)
                      if item["event"] == "room:load_result" and item["to"] == "restore")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, restored_state)
        self.assertEqual(restored.game_state["deadline_ms"], room.game_state["deadline_ms"])
        with self.assertRaises(app.HTTPException) as error:
            await app.download_room_save(room.room_id)
        self.assertEqual(error.exception.status_code, 403)
        await app.on_room_load("second-clone", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in reversed(app.sio.emits)
                      if item["event"] == "room:load_result" and item["to"] == "second-clone")
        self.assertFalse(result["ok"])

    async def test_next_round_waits_for_every_human_including_disconnected(self):
        room = await self.make_room()
        await self.begin_drawing(room)
        await self.submit_all(room)
        await self.finish_round_without_errors(room)
        old_token = room.game_state["round_token"]
        disconnected = room.players[-1]
        await app.disconnect(disconnected.socket_id)
        for player in room.players[:-1]:
            await self.action(room, player, "next_round")
        self.assertEqual(room.game_state["phase"], "round_result")
        self.assertEqual(room.game_state["round"], 1)
        await app.on_room_reconnect("last-confirmation", {
            "room_id": room.room_id, "player_id": disconnected.player_id,
            "reconnect_token": disconnected.reconnect_token,
        })
        await self.action(room, disconnected, "next_round")
        self.assertEqual(room.game_state["round"], 2)
        self.assertEqual(room.game_state["phase"], "ready")
        self.assertNotEqual(room.game_state["round_token"], old_token)
        before = copy.deepcopy(room.game_state)
        app.sio.emits.clear()
        await app.on_game_action(room.players[0].socket_id, {
            "action": {"type": "ready", "round_token": old_token},
        })
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(item["event"] == "system:error" for item in app.sio.emits))

    async def test_bots_advance_phases_and_only_confirm_their_own_seats(self):
        room = await self.make_room(bots=True)
        human = room.players[0]
        await self.wait_bots(room)
        self.assertEqual(room.game_state["phase"], "ready")
        await self.action(room, human, "ready")
        await self.wait_bots(room)
        self.assertEqual(room.game_state["phase"], "drawing")
        await self.action(room, human, "submit_drawing", segments=[0, 1], side=0, rotation=0, seq=1)
        for _ in range(5):
            await self.wait_bots(room)
            if room.game_state["phase"] == "round_result":
                break
            self.assertEqual(room.game_state["phase"], "oracle")
            self.assertEqual(room.game_state["current_turn"], human.player_id)
            view = self.view(room, human)
            card = next(card for card in view["cards"] if not card.get("eliminated_by"))
            await self.action(room, human, "eliminate", card_id=card["id"], revision=view["revision"])
        await self.wait_bots(room)
        self.assertEqual(room.game_state["phase"], "round_result")
        view = self.view(room, human)
        ready_ids = {player["player_id"] for player in view["players"] if player["next_round_ready"]}
        self.assertEqual(ready_ids, {player.player_id for player in room.players if player.is_bot})
        self.assertEqual(view["round"], 1)
        await self.action(room, human, "next_round")
        await self.wait_bots(room)
        self.assertEqual(room.game_state["round"], 2)
        self.assertEqual(room.game_state["phase"], "ready")
        bot_events = [event for item in app.sio.emits if item["event"] == "game:state"
                      for event in item["payload"]["events"] if event["type"] == "bot:action"]
        self.assertTrue(bot_events)
        self.assertTrue(all(set(event["payload"]["action"]) == {"type"} for event in bot_events))

    async def test_server_timeout_locks_disconnected_latest_draft_without_client_action(self):
        room = await self.make_room(config={"draw_seconds": 120})
        await self.begin_drawing(room)
        artist = room.players[0]
        await self.action(room, artist, "save_drawing", segments=[0, 3], side=1, rotation=1, seq=3)
        await app.disconnect(artist.socket_id)
        room.game_state["deadline_ms"] = int(time.time() * 1000) + 40
        before_version = room.state_version
        app.sio.emits.clear()
        await app._emit_game_state(room)
        await self.wait_phase(room, "oracle")
        self.assertGreater(room.state_version, before_version)
        view = self.view(room, room.players[1])
        drawing = next(drawing for drawing in view["drawings"] if drawing["player_id"] == artist.player_id)
        self.assertEqual(drawing["segments"], [0, 3])
        self.assertEqual((drawing["side"], drawing["rotation"]), (1, 1))
        updates = [item for item in app.sio.emits
                   if item["event"] == "game:state" and item["payload"]["view"]["phase"] == "oracle"]
        self.assertEqual(len(updates), 3)
        self.assertTrue(all(item["payload"]["view"]["deadline_ms"] is None for item in updates))

    async def test_human_autosaves_do_not_starve_bot_drawing_submission(self):
        room = await self.make_room(count=2, bots=True)
        human, bot = room.players
        await self.wait_bots(room)
        await self.action(room, human, "ready")
        stop_at = time.monotonic() + 2.2
        sequence = 0
        while time.monotonic() < stop_at:
            sequence += 1
            await self.action(room, human, "save_drawing", segments=[sequence % 10],
                              side=0, rotation=0, seq=sequence)
            await asyncio.sleep(0.1)
        view = self.view(room, bot)
        self.assertEqual(view["phase"], "drawing")
        self.assertTrue(next(player["submitted"] for player in view["players"]
                             if player["player_id"] == bot.player_id))
        self.assertTrue(view["your_drawing"]["segments"])

    async def test_expired_timer_after_early_submission_does_not_reapply_transition(self):
        room = await self.make_room(config={"draw_seconds": 120})
        await self.begin_drawing(room)
        room.game_state["deadline_ms"] = int(time.time() * 1000) + 400
        await app._emit_game_state(room)
        await self.submit_all(room)
        before = copy.deepcopy(room.game_state)
        before_version = room.state_version
        await asyncio.sleep(0.45)
        self.assertEqual(room.game_state, before)
        self.assertEqual(room.state_version, before_version)

    async def test_cold_restore_resolves_an_already_expired_drawing_deadline(self):
        room = await self.make_room(config={"draw_seconds": 120})
        await self.begin_drawing(room)
        artist = room.players[0]
        await self.action(room, artist, "save_drawing", segments=[1, 5], side=0, rotation=2, seq=2)
        room.game_state["deadline_ms"] = int(time.time() * 1000) - 1
        room.auto_save = True
        app._save_room_state(room)
        before_version = room.state_version
        app.ROOMS.clear()
        await app.on_room_load("expired-restore", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in reversed(app.sio.emits)
                      if item["event"] == "room:load_result" and item["to"] == "expired-restore")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        await self.wait_phase(restored, "oracle")
        self.assertGreater(restored.state_version, before_version)
        view = self.view(restored, artist)
        drawing = next(drawing for drawing in view["drawings"] if drawing["player_id"] == artist.player_id)
        self.assertEqual(drawing["segments"], [1, 5])
        self.assertEqual(drawing["rotation"], 2)


if __name__ == "__main__":
    unittest.main()
