import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.deception import DeceptionGame as Game
from tests.test_room_session import DummySio


class DeceptionIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio, self.old_data = app.sio, app.DATA_DIR
        self.old_rooms, self.old_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear(); app.SESSIONS.clear()

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.old_sio, self.old_data
        app.ROOMS.clear(); app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear(); app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def make_room(self, count=6, **config):
        await app.on_room_create('s0', {'name': 'Alice', 'game_type': 'deception',
                                       'config': {'seed': 134, **config}, 'auto_save': True})
        room = app.ROOMS[app.SESSIONS['s0']['room_id']]
        for i in range(1, count):
            await app.on_room_join(f's{i}', {'room_id': room.room_id, 'name': f'Player {i}'})
        for player in room.players: player.ready = True
        await app.on_room_start('s0', {})
        self.assertEqual(room.status, 'in_game')
        return room

    async def act(self, room, role, kind, **fields):
        pid = next(p for p, value in room.game_state['roles'].items() if value == role)
        player = next(p for p in room.players if p.player_id == pid)
        start = len(app.sio.emits)
        await app.on_game_action(player.socket_id, {'action': {
            'type': kind, 'case_token': room.game_state['case_token'], 'round': room.game_state['round'], **fields}})
        emitted = app.sio.emits[start:]
        self.assertFalse([e for e in emitted if e['event'] == 'system:error'])
        return emitted

    async def choose_crime(self, room):
        pid = next(p for p, role in room.game_state['roles'].items() if role == 'murderer')
        hand = room.game_state['hands'][pid]
        return await self.act(room, 'murderer', 'choose_crime', means_id=hand['means'][0], clue_id=hand['clues'][0])

    async def test_catalog_and_start(self):
        catalog = await app.api_list_games()
        row = next(r for r in catalog if r['game_id'] == 'deception')
        self.assertEqual((row['name_zh'], row['min_players'], row['max_players']), ('犯罪现场', 4, 12))
        self.assertIn('bluffing', {tag['id'] for tag in row['tags']})
        for count in (4, 6, 12):
            room = await self.make_room(count)
            self.assertEqual(len(room.game_state['roles']), count)

    async def test_broadcast_secrets_and_room_seed_hidden(self):
        room = await self.make_room(accomplice=True, witness=True)
        emitted = await self.choose_crime(room)
        payloads = [e['payload'] for e in emitted if e['event'] == 'game:state']
        self.assertEqual(len(payloads), 6)
        for payload in payloads:
            view = payload['view']
            self.assertNotIn('seed', view['config'])
            if view['private']['role'] in ('investigator', 'witness'):
                self.assertNotIn('solution', view['private'])
            self.assertEqual(payload['events'][0]['payload'], {'type': 'crime_selected', 'round': 1})
        await app._emit_room_state(room)
        self.assertNotIn('seed', app.sio.emits[-1]['payload']['game_config'])

    async def test_schema_bypass_still_rejects_illegal_action_atomically(self):
        room = await self.make_room()
        state = room.game_state
        pid = next(p for p, role in state['roles'].items() if role == 'investigator')
        actor = next(p for p in room.players if p.player_id == pid)
        for skip in (False, True):
            before = copy.deepcopy(state)
            await app.on_game_action(actor.socket_id, {'skip_validation': skip, 'action': {
                'type': 'choose_crime', 'case_token': state['case_token'], 'round': 1,
                'means_id': state['hands'][pid]['means'][0], 'clue_id': state['hands'][pid]['clues'][0]}})
            self.assertEqual(state, before)
            self.assertEqual(app.sio.emits[-1]['event'], 'system:error')

    async def test_bot_events_and_thinking_status_hide_secret_actor(self):
        room = await self.make_room()
        murderer = next(p for p, role in room.game_state['roles'].items() if role == 'murderer')
        room.bot_running = True; room.bot_player_id = murderer; room.bot_started_at_ms = 100
        await app._emit_game_state(room, [{'type': 'bot:action', 'payload': {'player_id': murderer, 'action': {'type': 'choose_crime'}}},
                                          {'type': 'deception:update', 'payload': {'type': 'crime_selected'}}])
        self.assertEqual(app.sio.emits[-1]['payload']['events'], [{'type': 'deception:update', 'payload': {'type': 'crime_selected'}}])
        for payload in (app.sio.emits[-1]['payload']['bot_status'], app._bot_status_payload(room)):
            self.assertEqual(payload, {'running': False, 'player_id': None, 'started_at_ms': None})
        await app._emit_bot_progress(room)
        self.assertIsNone(app.sio.emits[-1]['payload']['bot_status']['player_id'])
        self.assertEqual(app._public_bot_action('deception', {'type': 'choose_crime', 'means_id': 'secret'}), {'type': 'choose_crime'})

    async def test_active_save_download_and_clone_blocked_in_memory_and_after_cold_restart(self):
        room = await self.make_room(); await self.choose_crime(room)
        room.auto_save = True; app._save_room_state(room)
        for cold in (False, True):
            if cold: app.ROOMS.clear()
            with self.assertRaises(app.HTTPException) as caught:
                await app.download_room_save(room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load('outsider', {'source_room_id': room.room_id})
            self.assertFalse(app.sio.emits[-1]['payload']['ok'])
            self.assertNotIn('outsider', app.SESSIONS)

    async def test_completed_save_available_and_winner_broadcast(self):
        room = await self.make_room(); await self.choose_crime(room)
        s = room.game_state['solution']
        await self.act(room, 'investigator', 'accuse', target_id=s['player_id'], means_id=s['means_id'], clue_id=s['clue_id'])
        self.assertEqual(room.status, 'game_over')
        room.auto_save = True; app._save_room_state(room)
        response = await app.download_room_save(room.room_id)
        self.assertTrue(str(response.path).endswith('.save'))
        view = Game.get_public_view(room.game_state, room.players[0].player_id)
        self.assertEqual(view['solution'], s)
        self.assertTrue(all(p['role'] for p in view['players']))

    async def test_save_roundtrip_preserves_each_private_view(self):
        room = await self.make_room(accomplice=True, witness=True); await self.choose_crime(room)
        room.auto_save = True; app._save_room_state(room)
        loaded = app._load_latest_save(room.room_id)['game_state']
        restored = Game.deserialize(loaded)
        for player in room.players:
            self.assertEqual(Game.get_public_view(restored, player.player_id), Game.get_public_view(room.game_state, player.player_id))

    async def test_room_rejects_advanced_roles_below_six(self):
        await app.on_room_create('host', {'name': 'Host', 'game_type': 'deception'})
        room = app.ROOMS[app.SESSIONS['host']['room_id']]
        for i in range(3): await app.on_room_join(f's{i}', {'room_id': room.room_id, 'name': str(i)})
        for player in room.players: player.ready = True
        await app.on_room_start('host', {'config': {'accomplice': True, 'witness': True}})
        self.assertEqual(room.status, 'lobby')
        self.assertIsNone(room.game_state)
        self.assertEqual(app.sio.emits[-1]['event'], 'system:error')

    async def test_cold_reconnect_restores_only_the_authenticated_original_seat(self):
        room = await self.make_room(accomplice=True, witness=True)
        await self.choose_crime(room)
        player = next(p for p in room.players if room.game_state["roles"][p.player_id] == "investigator")
        expected = Game.get_public_view(room.game_state, player.player_id)
        room.auto_save = True; app._save_room_state(room)
        app.ROOMS.clear(); app.SESSIONS.clear()
        credentials = {"room_id": room.room_id, "player_id": player.player_id,
                       "reconnect_token": player.reconnect_token}
        await app.on_room_reconnect("bad", {**credentials, "reconnect_token": "wrong"})
        self.assertEqual(app.ROOMS, {})
        self.assertNotIn("bad", app.SESSIONS)
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock) as resume:
            await app.on_room_reconnect("recovered", credentials)
            resume.assert_awaited_once()
        restored = app.ROOMS[room.room_id]
        self.assertEqual(restored.status, "in_game")
        self.assertEqual(Game.get_public_view(restored.game_state, player.player_id), expected)
        self.assertEqual([p.socket_id for p in restored.players if p.connected], ["recovered"])
        self.assertTrue(all(p.seat_claimed for p in restored.players))
        self.assertNotIn("solution", expected["private"])
        self.assertEqual(app.SESSIONS["recovered"]["player_id"], player.player_id)
        self.assertTrue(app._has_unfinished_deception_save(room.room_id))

    async def test_cold_restore_rejects_other_games_and_unsafe_ids(self):
        self.assertIsNone(app._restore_deception_for_reconnect("../outside", "pid", "token"))
        self.assertIsNone(app._restore_deception_for_reconnect("safe", "pid", []))
        with patch.object(app, "_load_latest_save", return_value={"game_type": "cabo"}):
            self.assertIsNone(app._restore_deception_for_reconnect("safe", "pid", "token"))
        self.assertEqual(app.ROOMS, {})
