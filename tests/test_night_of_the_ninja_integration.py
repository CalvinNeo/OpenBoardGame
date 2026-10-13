import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.night_of_the_ninja import NightOfTheNinjaGame as Game
from tests.test_night_of_the_ninja import action
from tests.test_room_session import DummySio


class NinjaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():
            room.status = 'game_over'
        for _ in range(300):
            if not any(r.bot_running for r in app.ROOMS.values()):
                break
            await asyncio.sleep(.01)
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear()
        app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, bots=False):
        await app.on_room_create('s0', {'name':'Alice', 'game_type':'night_of_the_ninja', 'config':{'seed':146}})
        room = app.ROOMS[app.SESSIONS['s0']['room_id']]
        for i in range(1,4):
            if bots:
                await app.on_room_add_bot('s0', {})
            else:
                await app.on_room_join(f's{i}', {'room_id':room.room_id, 'name':f'Ninja {i}'})
        for p in room.players:
            p.ready = True
        with patch.object(app, '_maybe_run_bots', new_callable=AsyncMock):
            await app.on_room_start('s0', {})
        self.assertEqual(room.status, 'in_game')
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_draft_broadcast_and_seed_privacy(self):
        row = next(r for r in await app.api_list_games() if r['game_id'] == Game.game_id)
        self.assertEqual((row['name_zh'], row['min_players'], row['max_players']), ('忍者杀',4,11))
        room = await self.make_room()
        s, pid = room.game_state, room.players[0].player_id
        chosen = s['players'][pid]['packet'][0]
        app.sio.emits.clear()
        await app.on_game_action('s0', {'action':action(s,'draft',card_id=chosen)})
        updates = [e for e in app.sio.emits if e['event'] == 'game:state']
        self.assertEqual(len(updates),4)
        for message in updates:
            view = message['payload']['view']
            self.assertNotIn('seed', view)
            self.assertTrue(all(p['house'] is None for p in view['players']))
            self.assertNotIn('card_id', json.dumps(message['payload']['events']))
            self.assertEqual(view['submitted'], [pid])
        await app._emit_room_state(room)
        self.assertNotIn('seed', app.sio.emits[-1]['payload']['game_config'])
        self.assertEqual(app._public_bot_action(Game.game_id, action(s,'draft',card_id=chosen)), {'type':'draft'})

    async def test_schema_bypass_and_stale_requests_still_rejected(self):
        room = await self.make_room()
        s = room.game_state
        pid = room.players[0].player_id
        for skip in [False,True]:
            for kw in [{'game_token':'old'}, {'window_id':True}, {'choice':'kill'}, {'card_id':'missing'}]:
                a = action(s,'draft',card_id=s['players'][pid]['packet'][0])
                a.update(kw)
                before = copy.deepcopy(s)
                await app.on_game_action('s0', {'action':a,'skip_validation':skip})
                self.assertEqual(before,s)
                self.assertEqual(app.sio.emits[-1]['event'],'system:error')

    async def test_private_save_protection_and_cold_reconnect(self):
        room = await self.make_room()
        player = room.players[0]
        expected = Game.get_public_view(room.game_state, player.player_id)
        for cold in [False,True]:
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code,403)
            await app.on_room_load('outsider', {'source_room_id':room.room_id})
            self.assertFalse(app.sio.emits[-1]['payload']['ok'])
        credentials = {'room_id':room.room_id, 'player_id':player.player_id, 'reconnect_token':player.reconnect_token}
        await app.on_room_reconnect('invalid', {**credentials,'reconnect_token':'wrong'})
        self.assertEqual(app.ROOMS,{})
        with patch.object(app,'_maybe_run_bots',new_callable=AsyncMock):
            await app.on_room_reconnect('restored',credentials)
        restored = app.ROOMS[room.room_id]
        self.assertEqual(expected,Game.get_public_view(restored.game_state,player.player_id))

    async def test_hot_reconnect_preserves_seat_and_revokes_old_socket(self):
        room = await self.make_room()
        player = room.players[0]
        before = Game.get_public_view(room.game_state,player.player_id)
        await app.on_room_reconnect('replacement', {'room_id':room.room_id, 'player_id':player.player_id,'reconnect_token':player.reconnect_token})
        self.assertNotIn('s0',app.SESSIONS)
        self.assertEqual(player.socket_id,'replacement')
        self.assertEqual(before,Game.get_public_view(room.game_state,player.player_id))

    async def test_bot_runner_submits_only_bots_and_waits_for_human(self):
        room = await self.make_room(bots=True)
        await app._maybe_run_bots(room)
        for _ in range(500):
            if not room.bot_running:
                break
            await asyncio.sleep(.01)
        self.assertFalse(room.bot_running)
        self.assertEqual(room.game_state['phase'],'draft')
        self.assertEqual(set(room.game_state['submissions']), {p.player_id for p in room.players if p.is_bot})
        self.assertEqual(Game.get_legal_actions(room.game_state, room.players[0].player_id), ['draft'])


if __name__ == '__main__':
    unittest.main()
