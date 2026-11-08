import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from game.dare_words import DareWordsGame as Game
from tests.test_room_session import DummySio


def action(room, kind, **fields):
    state = room.game_state
    return {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], **fields}


class DareWordsRoomTests(unittest.IsolatedAsyncioTestCase):
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

    async def make_room(self, count=3, start=True, config=None):
        await app.on_room_create("s0", {"name": "Alice", "game_type": "dare_words", "config": {}})
        room = app.ROOMS[app.SESSIONS["s0"]["room_id"]]
        for index in range(1, count):
            await app.on_room_join(f"s{index}", {"room_id": room.room_id, "name": f"Player {index + 1}"})
        for player in room.players:
            player.ready = True
        if start:
            await app.on_room_start("s0", {"config": config or {}})
            self.assertEqual(room.status, "in_game")
        return room

    def views(self, event="game:state"):
        return [emit["payload"]["view"] for emit in app.sio.emits if emit["event"] == event]

    async def test_catalog_entry(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "dare_words")
        self.assertEqual(row["name_zh"], "胆敢造词")
        self.assertEqual(row["name"], "Dare to Make Words")
        self.assertEqual(row["player_counts"], list(range(2, 9)))
        self.assertEqual((row["min_players"], row["max_players"]), (2, 8))
        self.assertEqual({tag["id"] for tag in row["tags"]}, {"filler", "creative"})

    async def test_start_applies_deck_config(self):
        room = await self.make_room(config={"deck_size": "short"})
        self.assertEqual(room.game_state["config"], {"deck_size": "short"})
        self.assertEqual(len(room.game_state["deck"]), 60)
        await app._emit_room_state(room)
        payload = app.sio.emits[-1]["payload"]
        self.assertEqual(payload["game_config"], {"deck_size": "short"})
        self.assertEqual(list(payload["player_counts"]), list(range(2, 9)))

        room = await self.make_room(start=False, config=None)
        await app.on_room_start("s0", {"config": {"deck_size": "huge"}})
        self.assertEqual(room.status, "lobby")
        self.assertIsNone(room.game_state)
        self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_table_flow_broadcasts_per_player_views(self):
        room = await self.make_room()
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action(room, "flip")})
        self.assertEqual(len(room.game_state["row"]), 1)
        views = self.views()
        self.assertEqual(len(views), 3)
        self.assertEqual({view["you"] for view in views}, {player.player_id for player in room.players})
        for view in views:
            self.assertEqual(view["row"], room.game_state["row"])
            self.assertEqual(view["phase"], "flipping")

        await app.on_game_action("s1", {"action": action(room, "flip")})
        await app.on_game_action("s2", {"action": action(room, "flip")})
        row = [card["char"] for card in room.game_state["row"]]
        phrase = "".join(row[:3])
        app.sio.emits.clear()
        await app.on_game_action("s0", {"action": action(room, "claim", phrase=phrase)})
        self.assertEqual(room.game_state["phase"], "voting")
        for view in self.views():
            self.assertEqual(view["claim"]["phrase"], phrase)
            self.assertEqual(view["claim"]["votes_cast"], 0)
            self.assertNotIn("votes", view["claim"])

        await app.on_game_action("s1", {"action": action(room, "vote", accept=True)})
        await app.on_game_action("s2", {"action": action(room, "vote", accept=True)})
        self.assertEqual(room.game_state["phase"], "reveal")
        claimer = room.players[0].player_id
        self.assertEqual(room.game_state["players"][claimer]["score"], 3)
        self.assertEqual(room.game_state["row"], [])
        for view in self.views()[-3:]:
            self.assertIsNone(view["claim"])
            self.assertEqual(sorted(view["last_result"]["votes"].values()), [True, True])
            self.assertTrue(view["last_result"]["accepted"])

    async def test_illegal_actions_are_reported_without_state_change(self):
        room = await self.make_room()
        before = len(room.game_state["row"])
        app.sio.emits.clear()
        await app.on_game_action("s1", {"action": action(room, "flip")})
        self.assertEqual(app.sio.emits[-1]["event"], "system:error")
        self.assertEqual(len(room.game_state["row"]), before)
        await app.on_game_action("s0", {"action": action(room, "claim", phrase="的的的")})
        self.assertEqual(app.sio.emits[-1]["event"], "system:error")
        self.assertEqual(room.game_state["phase"], "flipping")

    async def test_bot_takes_the_next_flip(self):
        room = await self.make_room(count=2, start=False)
        await app.on_room_add_bot("s0", {"room_id": room.room_id})
        self.assertEqual(len(room.players), 3)
        self.assertTrue(room.players[-1].is_bot)
        for player in room.players:
            player.ready = True
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app.on_room_start("s0", {"config": {}})
            self.assertEqual(room.status, "in_game")
            await app.on_game_action("s0", {"action": action(room, "flip")})
            self.assertEqual(room.game_state["flipper"], room.players[1].player_id)
            await app.on_game_action("s1", {"action": action(room, "flip")})
            self.assertEqual(room.game_state["flipper"], room.players[2].player_id)
            self.assertEqual(len(room.game_state["row"]), 2)
        self.assertTrue(runners, "bot runner was not scheduled")
        for runner in runners:
            await runner
        self.assertGreaterEqual(len(room.game_state["row"]), 3)
        self.assertEqual(room.status, "in_game")
        self.assertEqual(room.game_state["flipper"], room.players[0].player_id)

    async def test_reconnect_replays_the_current_view(self):
        room = await self.make_room()
        await app.on_game_action("s0", {"action": action(room, "flip")})
        app.sio.emits.clear()
        await app.on_room_reconnect("s1", {
            "room_id": room.room_id,
            "player_id": room.players[1].player_id,
            "reconnect_token": room.players[1].reconnect_token,
        })
        states = [emit for emit in app.sio.emits
                  if emit["event"] == "game:state" and emit["to"] == "s1"]
        self.assertTrue(states)
        self.assertEqual(states[-1]["payload"]["view"]["row"], room.game_state["row"])
        self.assertEqual(states[-1]["payload"]["view"]["you"], room.players[1].player_id)


if __name__ == "__main__":
    unittest.main()
