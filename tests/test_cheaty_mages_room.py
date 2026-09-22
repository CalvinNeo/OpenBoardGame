import asyncio
import copy
import random
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from fastapi import HTTPException
from game.cheaty_mages import CheatyMagesGame as Game
from tests.test_room_session import DummySio


class CheatyMagesRoomTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def make_room(self, count=3):
        await app.on_room_create("s0", {
            "name": "Mage 0", "game_type": "cheaty_mages", "config": {},
        })
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {
                "name": f"Mage {index}", "room_id": room.room_id,
            })
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        await asyncio.sleep(0)
        return room

    @staticmethod
    def state_updates():
        return [item for item in app.sio.emits if item["event"] == "game:state"]

    @staticmethod
    def legal_move(room, player_id, action_type):
        view = Game.get_public_view(room.game_state, player_id)
        return next(move for move in view["legal_moves"] if move["type"] == action_type)

    @staticmethod
    def acting_player(room):
        return next(player for player in room.players
                    if player.player_id == room.game_state["current_turn"])

    def assert_private_events_are_redacted(self, value):
        if isinstance(value, dict):
            self.assertFalse(set(value) & {
                "slots", "card_id", "cards", "hand", "your_hand", "bets", "your_bets",
            })
            for child in value.values():
                self.assert_private_events_are_redacted(child)
        elif isinstance(value, list):
            for child in value:
                self.assert_private_events_are_redacted(child)

    async def finish_first_contest(self, room):
        for _ in range(20):
            phase = room.game_state["phase"]
            if phase == "round_end":
                return
            self.assertIn(phase, ("betting", "casting"))
            action_type = "bet" if phase == "betting" else "pass"
            player = next(player for player in room.players
                          if action_type in Game.get_legal_actions(room.game_state, player.player_id))
            action = self.legal_move(room, player.player_id, action_type)
            await app.on_game_action(player.socket_id, {"action": action})
            await asyncio.sleep(0)
        self.fail("The first contest did not reach its review phase")

    async def test_catalog_and_valid_player_counts_start(self):
        entry = next(item for item in await app.api_list_games()
                     if item["game_id"] == "cheaty_mages")
        self.assertEqual((entry["min_players"], entry["max_players"], entry["name_zh"]),
                         (3, 6, "诈赌巫师"))
        self.assertEqual(app._get_game_definition("cheaty_mages").turn_mode, "turn")
        for count, hand_count in ((3, 8), (4, 8), (5, 6), (6, 5)):
            with self.subTest(count=count):
                app.ROOMS.clear()
                app.SESSIONS.clear()
                room = await self.make_room(count)
                self.assertEqual(room.status, "in_game")
                self.assertEqual(room.game_state["phase"], "betting")
                view = Game.get_public_view(room.game_state, room.players[0].player_id)
                self.assertEqual(len(view["fighters"]), 5)
                self.assertEqual(len(view["your_hand"]), hand_count)

    async def test_room_cannot_start_with_fewer_than_three_players(self):
        room = await self.make_room(2)
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)

    async def test_each_broadcast_only_contains_recipient_hand_and_bet(self):
        room = await self.make_room()
        player = self.acting_player(room)
        action = self.legal_move(room, player.player_id, "bet")
        app.sio.emits.clear()
        await app.on_game_action(player.socket_id, {"action": action})
        updates = self.state_updates()
        self.assertEqual({item["to"] for item in updates}, {"s0", "s1", "s2"})
        for item in updates:
            view = item["payload"]["view"]
            recipient = app.SESSIONS[item["to"]]["player_id"]
            self.assertEqual(view["you"], recipient)
            self.assertEqual(len(view["your_hand"]), 8)
            if recipient == player.player_id:
                self.assertEqual(view["your_bets"], action["slots"])
            else:
                self.assertFalse(view["your_bets"])
            self.assertFalse(set(view) & {"deck", "judge_deck", "fighter_deck", "bets"})
            for row in view["players"]:
                self.assertFalse(set(row) & {"hand", "slots", "knowledge"})
                if row["player_id"] != recipient:
                    self.assertIsNone(row["bets"])
            self.assert_private_events_are_redacted(item["payload"]["events"])

    async def test_reconnection_restores_secret_choice_without_allowing_replay(self):
        room = await self.make_room()
        player = self.acting_player(room)
        original = Game.get_public_view(room.game_state, player.player_id)
        action = self.legal_move(room, player.player_id, "bet")
        await app.on_game_action(player.socket_id, {"action": action})
        await app.disconnect(player.socket_id)
        app.sio.emits.clear()
        await app.on_room_reconnect("back0", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        view = next(item["payload"]["view"] for item in self.state_updates()
                    if item["to"] == "back0")
        self.assertEqual(view["your_hand"], original["your_hand"])
        self.assertEqual(view["your_bets"], action["slots"])
        self.assertNotIn("bet", view["legal_actions"])
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("back0", {"action": action, "skip_validation": True})
        self.assertEqual(room.game_state, before)

    async def test_hidden_spell_and_peek_broadcast_only_reveal_authorized_cards(self):
        rng = random.Random(1)
        with patch("game.cheaty_mages.random.shuffle", rng.shuffle), \
                patch("game.cheaty_mages.random.choice", rng.choice):
            room = await self.make_room()
        while room.game_state["phase"] == "betting":
            player = self.acting_player(room)
            await app.on_game_action(player.socket_id, {
                "action": self.legal_move(room, player.player_id, "bet"),
            })
            await asyncio.sleep(0)
        owner = self.acting_player(room)
        view = Game.get_public_view(room.game_state, owner.player_id)
        hidden_cards = {card["id"] for card in view["your_hand"]
                        if card["kind"] == "enchant" and not card.get("face_up")}
        cast = next(move for move in view["legal_moves"]
                    if move["type"] == "cast" and move["card_id"] in hidden_cards)
        app.sio.emits.clear()
        await app.on_game_action(owner.socket_id, {"action": cast})
        await asyncio.sleep(0)
        for item in self.state_updates():
            fighter = item["payload"]["view"]["fighters"][cast["target"] - 1]
            card = fighter["spells"][0]["card"]
            if item["to"] == owner.socket_id:
                self.assertEqual(card["id"], cast["card_id"])
            else:
                self.assertIsNone(card)
            self.assert_private_events_are_redacted(item["payload"]["events"])
        peeker = self.acting_player(room)
        peek = next(move for move in Game.get_public_view(room.game_state, peeker.player_id)["legal_moves"]
                    if move["type"] == "peek" and move["target"] == cast["target"])
        app.sio.emits.clear()
        await app.on_game_action(peeker.socket_id, {"action": peek})
        for item in self.state_updates():
            fighter = item["payload"]["view"]["fighters"][cast["target"] - 1]
            card = fighter["spells"][0]["card"]
            if item["to"] in (owner.socket_id, peeker.socket_id):
                self.assertEqual(card["id"], cast["card_id"])
            else:
                self.assertIsNone(card)
            self.assert_private_events_are_redacted(item["payload"]["events"])
        await app.disconnect(peeker.socket_id)
        app.sio.emits.clear()
        await app.on_room_reconnect("peek-back", {
            "room_id": room.room_id, "player_id": peeker.player_id,
            "reconnect_token": peeker.reconnect_token,
        })
        view = next(item["payload"]["view"] for item in self.state_updates()
                    if item["to"] == "peek-back")
        self.assertEqual(view["fighters"][cast["target"] - 1]["spells"][0]["card"]["id"],
                         cast["card_id"])

    async def test_invalid_bets_and_stale_requests_cannot_bypass_validation(self):
        room = await self.make_room()
        player = self.acting_player(room)
        valid = self.legal_move(room, player.player_id, "bet")
        invalid = [
            {**valid, "slots": []}, {**valid, "slots": [1, 1]},
            {**valid, "slots": [1, 2, 3, 4]}, {**valid, "slots": [0]},
            {**valid, "slots": [6]}, {**valid, "slots": [True]},
            {**valid, "slots": ["1"]}, {**valid, "slots": [1.5]},
            {**valid, "round": valid["round"] + 1},
            {**valid, "turn": valid["turn"] + 1},
        ]
        for action in invalid:
            with self.subTest(action=action):
                before = copy.deepcopy(room.game_state)
                app.sio.emits.clear()
                await app.on_game_action(player.socket_id, {"action": action, "skip_validation": True})
                self.assertEqual(room.game_state, before)
                self.assertFalse(self.state_updates())

    async def test_bot_bet_event_reveals_only_action_type(self):
        room = await self.make_room()
        player = self.acting_player(room)
        player.is_bot = True
        app.sio.emits.clear()
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app._maybe_run_bots(room)
        self.assertEqual(len(runners), 1)
        await runners[0]
        updates = self.state_updates()
        self.assertEqual(len(updates), 3)
        for item in updates:
            event = next(event for event in item["payload"]["events"]
                         if event["type"] == "bot:action")
            self.assertEqual(event["payload"]["action"], {"type": "bet"})
            self.assert_private_events_are_redacted(item["payload"]["events"])
            if item["to"] != player.socket_id:
                self.assertFalse(item["payload"]["view"]["your_bets"])
        for action_type in ("cast", "peek", "discard", "refill", "next_round", "pass"):
            self.assertEqual(app._public_bot_action("cheaty_mages", {
                "type": action_type, "card_id": "secret", "slots": [1, 2],
                "target": "private", "cards": ["another-secret"],
            }), {"type": action_type})

    async def test_round_review_waits_for_disconnected_player(self):
        room = await self.make_room()
        await self.finish_first_contest(room)
        round_number = room.game_state["round"]
        await app.disconnect("s1")
        for index in (0, 2):
            player = room.players[index]
            await app.on_game_action(player.socket_id, {
                "action": self.legal_move(room, player.player_id, "next_round"),
            })
            await asyncio.sleep(0)
        self.assertEqual(room.game_state["phase"], "round_end")
        self.assertEqual(len(room.game_state["next_ready"]), 2)
        player = room.players[1]
        await app.on_room_reconnect("back1", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        await app.on_game_action("back1", {
            "action": self.legal_move(room, player.player_id, "next_round"),
        })
        self.assertNotEqual(room.game_state["phase"], "round_end")
        self.assertEqual(room.game_state["phase"], "refill")
        for _ in room.players:
            player = self.acting_player(room)
            await app.on_game_action(player.socket_id, {
                "action": self.legal_move(room, player.player_id, "discard"),
            })
            await asyncio.sleep(0)
        self.assertEqual(room.game_state["phase"], "betting")
        self.assertEqual(room.game_state["round"], round_number + 1)

    async def test_live_saves_cannot_export_or_clone_and_cold_restore_keeps_secrets(self):
        room = await self.make_room()
        player = self.acting_player(room)
        action = self.legal_move(room, player.player_id, "bet")
        await app.on_game_action(player.socket_id, {"action": action})
        room.auto_save = True
        app._save_room_state(room)
        with self.assertRaises(HTTPException) as raised:
            await app.download_room_save(room.room_id)
        self.assertEqual(raised.exception.status_code, 403)
        before = set(app.ROOMS)
        await app.on_room_load("outsider", {"source_room_id": room.room_id})
        self.assertEqual(set(app.ROOMS), before)
        self.assertFalse(app.sio.emits[-1]["payload"]["ok"])
        app.ROOMS.clear()
        app.sio.emits.clear()
        await app.on_room_load("restore", {"source_room_id": room.room_id})
        result = next(item["payload"] for item in app.sio.emits
                      if item["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, room.game_state)
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id)["your_bets"],
                         action["slots"])
        self.assertTrue(app._has_live_private_save(room.room_id, "cheaty_mages"))
        with self.assertRaises(HTTPException) as raised:
            await app.download_room_save(room.room_id)
        self.assertEqual(raised.exception.status_code, 403)
        self.assertFalse(Game.get_public_view(restored.game_state, None)["your_hand"])
        self.assertFalse(Game.get_public_view(restored.game_state, None)["your_bets"])

    async def test_second_cold_restore_protects_every_ancestor_save(self):
        original = await self.make_room()
        original.auto_save = True
        app._save_room_state(original)
        original_id = original.room_id
        app.ROOMS.clear()
        await app.on_room_load("restore1", {
            "source_room_id": original_id, "auto_save": True,
        })
        first_restore = next(iter(app.ROOMS.values()))
        self.assertEqual(first_restore.source_room_ids, [original_id])
        app._save_room_state(first_restore)
        first_restore_id = first_restore.room_id
        app.ROOMS.clear()
        await app.on_room_load("restore2", {"source_room_id": first_restore_id})
        second_restore = next(iter(app.ROOMS.values()))
        self.assertEqual(second_restore.game_state, original.game_state)
        self.assertEqual(set(second_restore.source_room_ids), {original_id, first_restore_id})
        for source_id in (original_id, first_restore_id):
            with self.subTest(source_id=source_id):
                self.assertTrue(app._has_live_private_save(source_id, "cheaty_mages"))
                with self.assertRaises(HTTPException) as raised:
                    await app.download_room_save(source_id)
                self.assertEqual(raised.exception.status_code, 403)
                before = set(app.ROOMS)
                app.sio.emits.clear()
                await app.on_room_load("outsider", {"source_room_id": source_id})
                self.assertEqual(set(app.ROOMS), before)
                self.assertFalse(app.sio.emits[-1]["payload"]["ok"])


if __name__ == "__main__":
    unittest.main()
