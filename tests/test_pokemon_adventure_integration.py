import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.pokemon_adventure import PokemonAdventureGame as Game, _begin_scoring
from tests.test_room_session import DummySio


class PokemonAdventureIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = "game_over"
        for attempt in range(300):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(0.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, count=2, bots=False):
        await app.on_room_create("s0", {
            "name": "Alice", "game_type": "pokemon_adventure",
            "config": {"seed": 128, "target_tokens": 3},
        })
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in range(1, count):
            if bots:
                await app.on_room_add_bot("s0", {})
            else:
                await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Trainer {index}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    async def wait_bots(self, room):
        for attempt in range(600):
            if not room.bot_running:
                return
            await asyncio.sleep(0.01)
        self.fail("bot runner did not stop for the human")

    async def reveal_players(self, room):
        for player in room.players:
            if not player.is_bot:
                await app.on_game_action(player.socket_id, {"action": {"type": "initial_reveal", "slot": 0}})

    async def test_catalog_and_player_limits(self):
        entry = next(game for game in await app.api_list_games() if game["game_id"] == "pokemon_adventure")
        self.assertEqual((entry["name_zh"], entry["min_players"], entry["max_players"]), ("宝可梦奇遇", 2, 5))
        self.assertTrue(entry["tags"])
        room = await self.make_room(count=5)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["phase"], "initial_reveal")
        await app.on_room_join("extra", {"room_id": room.room_id, "name": "Sixth"})
        self.assertEqual(len(room.players), 5)
        await app.on_room_create("solo", {"name": "Solo", "game_type": "pokemon_adventure"})
        solo = app.ROOMS[app.SESSIONS["solo"]["room_id"]]
        await app.on_room_start("solo", {})
        self.assertEqual(solo.status, "lobby")

    async def test_public_reveal_and_private_draw_broadcast(self):
        room = await self.make_room()
        await self.reveal_players(room)
        actor = next(player for player in room.players if player.player_id == room.game_state["current_turn"])
        app.sio.emits.clear()
        await app.on_game_action(actor.socket_id, {"action": {"type": "draw_deck"}})
        updates = [message for message in app.sio.emits if message["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        for message in updates:
            view = message["payload"]["view"]
            self.assertEqual(sum(card["known"] for player in view["players"] for card in player["hand"]), 2)
            self.assertEqual(view["drawn"]["card"] is not None, message["to"] == actor.socket_id)
            self.assertNotIn("deck", view)
            self.assertNotIn("seed", view["config"])
            self.assertNotIn("card", view["last_action"])

    async def test_schema_bypass_still_rejects_invalid_action_atomically(self):
        room = await self.make_room()
        before = copy.deepcopy(room.game_state)
        for action in ({"type": "initial_reveal", "slot": True}, {"type": "initial_reveal", "slot": 9}, {"type": "initial_reveal", "slot": 0, "card": "pikachu:0"}):
            await app.on_game_action("s0", {"skip_validation": True, "action": action})
            self.assertEqual(room.game_state, before)
        self.assertTrue(any(message["event"] == "system:error" for message in app.sio.emits))

    async def test_reconnect_and_saved_room_preserve_pending_draw(self):
        room = await self.make_room()
        await self.reveal_players(room)
        actor = next(player for player in room.players if player.player_id == room.game_state["current_turn"])
        await app.on_game_action(actor.socket_id, {"action": {"type": "draw_deck"}})
        before = copy.deepcopy(room.game_state)
        await app.disconnect(actor.socket_id)
        await app.on_room_reconnect("restored", {"room_id": room.room_id, "player_id": actor.player_id, "reconnect_token": actor.reconnect_token})
        self.assertEqual(room.game_state, before)
        update = next(message for message in app.sio.emits if message["event"] == "game:state" and message["to"] == "restored")
        self.assertEqual(update["payload"]["view"], Game.get_public_view(before, actor.player_id))
        room.auto_save = True
        app._save_room_state(room)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        response = next(message["payload"] for message in app.sio.emits if message["event"] == "room:load_result" and message["to"] == "loader")
        self.assertTrue(response["ok"])
        self.assertEqual(app.ROOMS[response["room_id"]].game_state, json.loads(json.dumps(before)))

    async def test_round_review_waits_for_all_players(self):
        room = await self.make_room()
        _begin_scoring(room.game_state, "all_revealed", room.players[0].player_id)
        while room.game_state["phase"] == "ditto_choice":
            choice = room.game_state["ditto_choices"][0]
            events, error = Game.apply_action(room.game_state, choice["player_id"], {"type": "choose_ditto", "slot": choice["slot"], "neighbor_slot": choice["neighbors"][0]})
            self.assertIsNone(error)
        await app.on_game_action("s0", {"action": {"type": "next_round"}})
        self.assertEqual(room.game_state["phase"], "round_end")
        self.assertEqual(room.game_state["round"], 1)
        await app.on_game_action("s1", {"action": {"type": "next_round"}})
        self.assertEqual(room.game_state["phase"], "initial_reveal")
        self.assertEqual(room.game_state["round"], 2)

    async def test_bots_take_turns_and_confirm_but_wait_for_human(self):
        room = await self.make_room(bots=True)
        await self.wait_bots(room)
        self.assertEqual(room.game_state["phase"], "initial_reveal")
        self.assertTrue(room.game_state["players"][room.players[1].player_id]["initial_reveal_done"])
        await self.reveal_players(room)
        await self.wait_bots(room)
        self.assertEqual(room.game_state["current_turn"], room.players[0].player_id)
        _begin_scoring(room.game_state, "all_revealed", room.players[0].player_id)
        for player in room.players:
            while Game.get_legal_actions(room.game_state, player.player_id) == ["choose_ditto"]:
                Game.apply_action(room.game_state, player.player_id, Game.bot_move(room.game_state, player.player_id))
        await app._emit_game_state(room)
        await app._maybe_run_bots(room)
        await self.wait_bots(room)
        self.assertEqual(room.game_state["phase"], "round_end")
        self.assertFalse(room.game_state["players"][room.players[0].player_id]["round_ready"])
        self.assertTrue(room.game_state["players"][room.players[1].player_id]["round_ready"])


if __name__ == "__main__":
    unittest.main()
