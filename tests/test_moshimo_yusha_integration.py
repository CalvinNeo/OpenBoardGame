import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.moshimo_yusha import MoshimoYushaGame as Game
from tests.test_moshimo_yusha import action
from tests.test_room_session import DummySio


class MoshimoYushaIntegrationTests(unittest.IsolatedAsyncioTestCase):
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

    async def make_room(self, count=3, bots=False):
        await app.on_room_create('s0', {'name': 'Hero', 'game_type': Game.game_id, 'config': {'seed': 151}})
        room = app.ROOMS[app.SESSIONS['s0']['room_id']]
        for i in range(1, count):
            if bots:
                await app.on_room_add_bot('s0', {})
            else:
                await app.on_room_join(f's{i}', {'room_id': room.room_id, 'name': f'Player {i}'})
        for p in room.players:
            p.ready = True
        with patch.object(app, '_maybe_run_bots', new_callable=AsyncMock):
            await app.on_room_start('s0', {})
        self.assertEqual(room.status, 'in_game')
        room.auto_save = True
        app._save_room_state(room)
        return room

    async def test_catalog_and_private_broadcasts(self):
        row = next(r for r in await app.api_list_games() if r['game_id'] == Game.game_id)
        self.assertEqual((row['name_zh'], row['min_players'], row['max_players']), ('如果勇者在的话就好了', 1, 7))
        room = await self.make_room()
        state, pid = room.game_state, room.players[0].player_id
        app.sio.emits.clear()
        await app.on_game_action('s0', {'action': action(state, 'discard', card_ids=[1, 2])})
        updates = [e for e in app.sio.emits if e['event'] == 'game:state']
        self.assertEqual(len(updates), 3)
        for message in updates:
            view = message['payload']['view']
            self.assertNotIn('seed', view)
            self.assertEqual(view['discarded'], [])
            self.assertEqual(view['submitted'], [pid])
            self.assertEqual(view['my_submission'], [1, 2] if view['you'] == pid else None)
            self.assertNotIn('card_ids', json.dumps(message['payload']['events']))
            self.assertTrue(all('hand' not in p for p in view['players']))
        await app._emit_room_state(room)
        self.assertNotIn('seed', app.sio.emits[-1]['payload']['game_config'])
        self.assertEqual(app._public_bot_action(Game.game_id, action(state, 'play', card_id=6)), {'type': 'play'})

    async def test_schema_bypass_and_stale_requests_still_rejected(self):
        room = await self.make_room()
        state = room.game_state
        for skip in (False, True):
            for kw in ({'game_instance_id': 'old'}, {'window_id': True}, {'extra': 1}, {'card_ids': [1, 1]}, {'card_ids': [1, 2.0]}):
                command = {**action(state, 'discard', card_ids=[1, 2]), **kw}
                before = copy.deepcopy(state)
                await app.on_game_action('s0', {'action': command, 'skip_validation': skip})
                self.assertEqual(before, state)
                self.assertEqual(app.sio.emits[-1]['event'], 'system:error')

    async def test_active_saves_protected_and_senate_restores_on_cold_reconnect(self):
        room = await self.make_room(count=1)
        player = room.players[0]
        await app.on_game_action('s0', {'action': action(room.game_state, 'discard', card_ids=[1, 2])})
        await app.on_game_action('s0', {'action': action(room.game_state, 'next_round')})
        expected = Game.get_public_view(room.game_state, player.player_id)
        expected_private = copy.deepcopy(room.game_state)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
                app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load('outsider', {'source_room_id': room.room_id})
            self.assertFalse(app.sio.emits[-1]['payload']['ok'])
        credentials = {'room_id': room.room_id, 'player_id': player.player_id, 'reconnect_token': player.reconnect_token}
        await app.on_room_reconnect('invalid', {**credentials, 'reconnect_token': 'wrong'})
        self.assertEqual(app.ROOMS, {})
        with patch.object(app, '_maybe_run_bots', new_callable=AsyncMock) as resume:
            await app.on_room_reconnect('restored', credentials)
            resume.assert_awaited_once()
        restored = app.ROOMS[room.room_id]
        self.assertEqual(expected, Game.get_public_view(restored.game_state, player.player_id))
        self.assertEqual(expected_private, restored.game_state)
        self.assertEqual(len(restored.players), 1)
        self.assertEqual(len(restored.game_state['senators']), 2)

    async def test_hot_reconnect_preserves_committed_card_and_revokes_old_socket(self):
        room = await self.make_room()
        player = room.players[0]
        await app.on_game_action('s0', {'action': action(room.game_state, 'discard', card_ids=[3, 4])})
        before = Game.get_public_view(room.game_state, player.player_id)
        await app.on_room_reconnect('replacement', {'room_id': room.room_id, 'player_id': player.player_id, 'reconnect_token': player.reconnect_token})
        self.assertNotIn('s0', app.SESSIONS)
        self.assertEqual(player.socket_id, 'replacement')
        self.assertEqual(before, Game.get_public_view(room.game_state, player.player_id))

    async def wait_for_bots(self, room):
        for _ in range(500):
            if not room.bot_running:
                break
            await asyncio.sleep(.01)
        self.assertFalse(room.bot_running)

    async def test_bot_runner_keeps_actions_private_and_waits_for_human_review(self):
        room = await self.make_room(bots=True)
        await app._maybe_run_bots(room)
        await self.wait_for_bots(room)
        state = room.game_state
        bot_ids = {p.player_id for p in room.players if p.is_bot}
        self.assertEqual(state['phase'], 'setup_discard')
        self.assertEqual(set(state['setup_submissions']), bot_ids)
        events = [event for e in app.sio.emits if e['event'] == 'game:state' for event in e['payload']['events']]
        bot_events = [e for e in events if e['type'] == 'bot:action']
        self.assertTrue(bot_events)
        self.assertNotIn('card_ids', json.dumps(bot_events))
        self.assertNotIn('game_instance_id', json.dumps(bot_events))
        await app.on_game_action('s0', {'action': action(state, 'discard', card_ids=[1, 2])})
        await self.wait_for_bots(room)
        self.assertEqual(state['phase'], 'setup_review')
        self.assertEqual(set(state['next_round_ready']), bot_ids)
        self.assertEqual(Game.get_legal_actions(state, room.players[0].player_id), ['next_round'])
        await app.on_game_action('s0', {'action': action(state, 'next_round')})
        await self.wait_for_bots(room)
        self.assertEqual(state['phase'], 'playing')
        self.assertEqual(set(state['pending_cards']), bot_ids)
        self.assertEqual(Game.get_legal_actions(state, room.players[0].player_id), ['play'])


if __name__ == '__main__':
    unittest.main()
