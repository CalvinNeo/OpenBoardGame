"""Room integration tests for 上山捡菌 (Mushroom Picking).

Run: python -m unittest tests.test_mushroom_picking_integration
"""
import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory

import app
from game.mushroom_picking import MODE_ORDERS, MushroomPickingGame as Game
from tests.test_room_session import DummySio


class MushroomPickingIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
        for _ in range(400):
            if not any(room.bot_running for room in app.ROOMS.values()):
                break
            await asyncio.sleep(0.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, count=2, bot=False, mode=None):
        config = {} if mode is None else {"mode": mode}
        await app.on_room_create("s0", {"name": "Alice", "game_type": "mushroom_picking", "config": config})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        if bot:
            await app.on_room_add_bot("s0", {})
        else:
            for index in range(1, count):
                await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Guest {index}"})
        for player in room.players:
            player.ready = True
        await app.on_room_start("s0", {})
        return room

    @staticmethod
    def current(room):
        return room.game_state["turn_order"][room.game_state["turn_index"]]

    async def draw_and_keep(self, sid, room):
        player_id = self.current(room)
        await app.on_game_action(sid, {"action": {"type": "draw", "turn": room.game_state["turn"]}})
        pending = room.game_state["pending_draw"]
        keep = list(range(min(2, len(pending))))
        await app.on_game_action(sid, {"action": {"type": "keep", "turn": room.game_state["turn"], "keep": keep}})
        return player_id

    async def test_catalog_entry(self):
        game = next(game for game in await app.api_list_games() if game["game_id"] == "mushroom_picking")
        self.assertEqual((game["name_zh"], game["min_players"], game["max_players"]), ("上山捡菌", 2, 4))
        self.assertEqual([tag["id"] for tag in game["tags"]], ["filler", "euro"])
        self.assertTrue(game["has_strategic_ai"])

    async def test_two_player_room_starts_in_basic_mode(self):
        room = await self.make_room(count=2)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["config"]["mode"], "basic")
        self.assertEqual(len(room.game_state["deck"]), 62)
        self.assertEqual(len(room.game_state["players"]), 2)

    async def test_orders_mode_deals_orders(self):
        room = await self.make_room(count=3, mode=MODE_ORDERS)
        self.assertEqual(len(room.game_state["deck"]), 54)
        self.assertEqual(len(room.game_state["order_center"]), 2)
        for player_id in room.game_state["turn_order"]:
            self.assertEqual(len(room.game_state["players"][player_id]["orders"]), 2)

    async def test_views_keep_hands_and_the_drawn_cards_private(self):
        room = await self.make_room(count=2)
        actor = self.current(room)
        actor_sid = next(sid for sid, session in app.SESSIONS.items()
                         if session.get("player_id") == actor)
        app.sio.emits.clear()
        await app.on_game_action(actor_sid, {"action": {"type": "draw", "turn": room.game_state["turn"]}})
        updates = {message["to"]: message["payload"]["view"]
                   for message in app.sio.emits if message["event"] == "game:state"}
        self.assertEqual(len(updates), 2)
        own = updates[actor_sid]
        other_sid = next(sid for sid in updates if sid != actor_sid)
        other = updates[other_sid]
        self.assertEqual(len(own["pending_draw"]), 3)
        self.assertIsNone(other["pending_draw"])
        self.assertEqual(other["pending_count"], 3)
        mine = next(player for player in own["players"] if player["is_you"])
        theirs = next(player for player in other["players"] if player["player_id"] == actor)
        self.assertIsNotNone(mine["hand"])
        self.assertIsNone(theirs["hand"])

    async def test_playing_a_set_broadcasts_the_score(self):
        room = await self.make_room(count=2)
        actor = self.current(room)
        actor_sid = next(sid for sid, session in app.SESSIONS.items()
                         if session.get("player_id") == actor)
        hand = room.game_state["players"][actor]["hand"]
        trio = [card for card in room.game_state["deck"] if card.startswith("qingtou")][:3]
        for card in trio:
            room.game_state["deck"].remove(card)
            hand.append(card)
        app.sio.emits.clear()
        await app.on_game_action(actor_sid, {"action": {
            "type": "play", "turn": room.game_state["turn"], "cards": trio}})
        self.assertEqual(room.game_state["players"][actor]["score"], 12)
        updates = [message for message in app.sio.emits if message["event"] == "game:state"]
        self.assertEqual(len(updates), 2)
        for message in updates:
            view = message["payload"]["view"]
            self.assertEqual(view["last_play"]["points"], 12)
            self.assertEqual(len(view["last_play"]["card_views"]), 3)

    async def test_invalid_action_is_rejected_without_touching_the_state(self):
        room = await self.make_room(count=2)
        before = copy.deepcopy(room.game_state)
        actor_sid = "s0"
        await app.on_game_action(actor_sid, {"action": {
            "type": "take", "turn": room.game_state["turn"], "card": "qingtou#0"}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(message["event"] == "system:error" for message in app.sio.emits))

    async def test_stale_turn_is_rejected(self):
        room = await self.make_room(count=2)
        before = copy.deepcopy(room.game_state)
        await app.on_game_action("s0", {"action": {"type": "draw", "turn": room.game_state["turn"] + 5}})
        self.assertEqual(room.game_state, before)
        self.assertTrue(any(message["event"] == "system:error" for message in app.sio.emits))

    async def test_bot_answers_the_human_turn(self):
        room = await self.make_room(bot=True)
        human = room.players[0].player_id
        self.assertEqual(self.current(room), human)
        await self.draw_and_keep("s0", room)
        for _ in range(600):
            if not room.bot_running and room.game_state["turn_index"] == 0:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(self.current(room), human)
        self.assertEqual(room.game_state["turn"], 3)

    async def test_reconnect_and_room_save_load_preserve_state(self):
        room = await self.make_room(count=2)
        human = room.players[0]
        await self.draw_and_keep("s0", room)
        before = copy.deepcopy(room.game_state)
        await app.disconnect("s0")
        await app.on_room_reconnect("new", {
            "room_id": room.room_id,
            "player_id": human.player_id,
            "reconnect_token": human.reconnect_token,
        })
        self.assertEqual(room.game_state, before)
        update = next(message for message in app.sio.emits
                      if message["event"] == "game:state" and message["to"] == "new")
        self.assertEqual(update["payload"]["view"], Game.get_public_view(before, human.player_id))
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(before))))
        self.assertEqual(restored, before)
        room.auto_save = True
        app._save_room_state(room)
        await app.on_room_load("loader", {"source_room_id": room.room_id})
        response = next(message["payload"] for message in app.sio.emits
                        if message["event"] == "room:load_result" and message["to"] == "loader")
        self.assertTrue(response["ok"])
        self.assertEqual(app.ROOMS[response["room_id"]].game_state, before)

    async def test_four_players_can_start_and_a_fifth_cannot_join(self):
        room = await self.make_room(count=4)
        self.assertEqual(room.status, "in_game")
        await app.on_room_join("s9", {"room_id": room.room_id, "name": "Extra"})
        self.assertEqual(len(room.players), 4)
        self.assertTrue(any(message["event"] == "system:error" and message["to"] == "s9"
                            for message in app.sio.emits))


if __name__ == "__main__":
    unittest.main()
