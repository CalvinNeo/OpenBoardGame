import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from fastapi import HTTPException
from game.for_sale import ForSaleGame as Game
from tests.test_room_session import DummySio


class ForSaleIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def room(self):
        await app.on_room_create("s0", {"name": "Seller 0", "game_type": "for_sale", "config": {}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in [1, 2]:
            await app.on_room_join(f"s{index}", {"name": f"Seller {index}", "room_id": room.room_id})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        await asyncio.sleep(0)
        return room

    def reach_selling(self, room):
        state = room.game_state
        for _ in range(100):
            if state["phase"] == "sell":
                return
            if state["phase"] == "buy":
                pid = state["current_turn"]
                action = {"type": "pass", "round": state["round"], "turn": state["turn"]}
            else:
                self.assertEqual(state["phase"], "round_end")
                pid = next(player.player_id for player in room.players
                           if "next_round" in Game.get_legal_actions(state, player.player_id))
                action = {"type": "next_round", "round": state["round"]}
            _, error = Game.apply_action(state, pid, action)
            self.assertIsNone(error)
        self.fail("Buying rounds did not advance to selling")

    def state_updates(self):
        return [item for item in app.sio.emits if item["event"] == "game:state"]

    def assert_no_private_event_fields(self, value):
        if isinstance(value, dict):
            self.assertFalse(set(value) & {"property", "properties", "selection", "hand", "your_selection"})
            for child in value.values():
                self.assert_no_private_event_fields(child)
        elif isinstance(value, list):
            for child in value:
                self.assert_no_private_event_fields(child)

    async def test_catalog_and_room_start(self):
        entry = next(item for item in await app.api_list_games() if item["game_id"] == "for_sale")
        self.assertEqual((entry["min_players"], entry["max_players"], entry["name_zh"]), (3, 6, "地产达人"))
        room = await self.room()
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "buy")
        self.assertEqual(len(room.game_state["market_properties"]), 3)

    async def test_broadcast_has_individual_views_without_other_cash_or_decks(self):
        room = await self.room()
        app.sio.emits.clear()
        await app._emit_game_state(room)
        updates = self.state_updates()
        self.assertEqual({item["to"] for item in updates}, {"s0", "s1", "s2"})
        for item in updates:
            view = item["payload"]["view"]
            self.assertEqual(view["you"], app.SESSIONS[item["to"]]["player_id"])
            self.assertEqual(view["your_cash"], 18)
            self.assertFalse(set(view) & {"property_deck", "check_deck", "removed_properties", "removed_checks", "selections"})
            for player in view["players"]:
                if player["player_id"] != view["you"]:
                    self.assertIsNone(player["cash"])
                    self.assertIsNone(player["total"])

    async def test_sale_is_secret_in_events_and_reconnection_restores_locked_choice(self):
        room = await self.room()
        self.reach_selling(room)
        player = room.players[0]
        selection = Game.get_public_view(room.game_state, player.player_id)["your_properties"][0]
        action = {"type": "sell", "round": room.game_state["round"], "property": selection}
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action})
        updates = self.state_updates()
        self.assertEqual(len(updates), 3)
        for item in updates:
            view = item["payload"]["view"]
            self.assertEqual(view["your_selection"], selection if item["to"] == "s0" else None)
            self.assertIsNone(view["round_summary"])
            self.assertTrue(view["players"][0]["submitted"])
            self.assert_no_private_event_fields(item["payload"]["events"])
        await app.disconnect("s0")
        app.sio.emits.clear()
        await app.on_room_reconnect("back0", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        view = next(item["payload"]["view"] for item in self.state_updates() if item["to"] == "back0")
        self.assertEqual(view["your_selection"], selection)
        self.assertNotIn("sell", view["legal_actions"])
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("back0", {"action": action, "skip_validation": True})
        self.assertEqual(room.game_state, before)
        choices = {player.player_id: selection}
        for index in [1, 2]:
            other = room.players[index]
            choice = Game.get_public_view(room.game_state, other.player_id)["your_properties"][0]
            choices[other.player_id] = choice
            app.sio.emits.clear()
            await app.on_game_action(f"s{index}", {"action": {
                "type": "sell", "round": room.game_state["round"], "property": choice,
            }})
            for item in self.state_updates():
                view = item["payload"]["view"]
                if index == 1:
                    self.assertIsNone(view["round_summary"])
                else:
                    self.assertEqual(view["phase"], "round_end")
                    revealed = {row["player_id"]: row["property"] for row in view["round_summary"]["rows"]}
                    self.assertEqual(revealed, choices)
                    self.assertTrue(all(row["check_count"] == 1 for row in view["players"]))

    async def test_bot_sale_event_hides_property_until_all_players_submit(self):
        room = await self.room()
        self.reach_selling(room)
        room.players[1].is_bot = True
        app.sio.emits.clear()
        tasks = []
        with patch.object(app.asyncio, "create_task", side_effect=tasks.append):
            await app._maybe_run_bots(room)
        self.assertEqual(len(tasks), 1)
        await tasks[0]
        updates = self.state_updates()
        self.assertEqual(len(updates), 3)
        for item in updates:
            events = item["payload"]["events"]
            event = next(event for event in events if event["type"] == "bot:action")
            self.assertEqual(event["payload"]["action"]["type"], "sell")
            self.assert_no_private_event_fields(events)
            view = item["payload"]["view"]
            self.assertIsNone(view["round_summary"])
            if item["to"] != "s1":
                self.assertIsNone(view["your_selection"])
        self.assertEqual(room.game_state["phase"], "sell")

    async def test_invalid_actions_schema_bypass_and_replays_do_not_mutate(self):
        room = await self.room()
        state = room.game_state
        actor = state["current_turn"]
        sid = next(player.socket_id for player in room.players if player.player_id == actor)
        valid = {"type": "bid", "round": state["round"], "turn": state["turn"], "amount": 1}
        invalid = [
            {**valid, "amount": True}, {**valid, "amount": 1.5},
            {**valid, "amount": "1"}, {**valid, "amount": 19},
            {**valid, "amount": 0}, {**valid, "turn": state["turn"] + 1},
            {**valid, "round": state["round"] + 1}, {**valid, "extra": 1},
        ]
        for action in invalid:
            with self.subTest(action=action):
                before = copy.deepcopy(state)
                app.sio.emits.clear()
                await app.on_game_action(sid, {"action": action, "skip_validation": True})
                self.assertEqual(state, before)
                self.assertFalse(self.state_updates())
        other_sid = next(player.socket_id for player in room.players if player.player_id != actor)
        before = copy.deepcopy(state)
        await app.on_game_action(other_sid, {"action": valid})
        self.assertEqual(state, before)
        await app.on_game_action(sid, {"action": valid})
        self.assertNotEqual(state, before)
        before = copy.deepcopy(state)
        await app.on_game_action(sid, {"action": valid, "skip_validation": True})
        self.assertEqual(state, before)

    async def test_round_end_waits_for_disconnected_player_to_reconnect(self):
        room = await self.room()
        state = room.game_state
        while state["phase"] == "buy":
            player = next(player for player in room.players if player.player_id == state["current_turn"])
            await app.on_game_action(player.socket_id, {
                "action": {"type": "pass", "round": state["round"], "turn": state["turn"]},
            })
        self.assertEqual(state["phase"], "round_end")
        round_number = state["round"]
        await app.disconnect("s1")
        for sid in ["s0", "s2"]:
            await app.on_game_action(sid, {"action": {"type": "next_round", "round": round_number}})
        self.assertEqual(state["phase"], "round_end")
        player = room.players[1]
        await app.on_room_reconnect("back1", {
            "room_id": room.room_id, "player_id": player.player_id,
            "reconnect_token": player.reconnect_token,
        })
        await app.on_game_action("back1", {"action": {"type": "next_round", "round": round_number}})
        self.assertEqual((state["phase"], state["round"]), ("buy", round_number + 1))

    async def test_live_save_cannot_export_or_clone_and_cold_restore_preserves_selection(self):
        room = await self.room()
        self.reach_selling(room)
        player = room.players[0]
        choice = Game.get_public_view(room.game_state, player.player_id)["your_properties"][0]
        await app.on_game_action("s0", {"action": {
            "type": "sell", "round": room.game_state["round"], "property": choice,
        }})
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
        result = next(item["payload"] for item in app.sio.emits if item["event"] == "room:load_result")
        self.assertTrue(result["ok"])
        restored = app.ROOMS[result["room_id"]]
        self.assertEqual(restored.game_state, room.game_state)
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id)["your_selection"], choice)
        self.assertTrue(app._has_live_private_save(room.room_id, "for_sale"))
        with self.assertRaises(HTTPException) as raised:
            await app.download_room_save(room.room_id)
        self.assertEqual(raised.exception.status_code, 403)
        before = set(app.ROOMS)
        await app.on_room_load("second-outsider", {"source_room_id": room.room_id})
        self.assertEqual(set(app.ROOMS), before)
        self.assertFalse(app.sio.emits[-1]["payload"]["ok"])


if __name__ == "__main__":
    unittest.main()
