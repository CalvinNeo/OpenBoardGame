import asyncio
import copy
import json
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

import app
from game.dnd_starter_set import DndStarterSetGame as Game
from tests.test_dnd_starter_set import action
from tests.test_room_session import DummySio


class BorderlandsIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio,self.old_data=app.sio,app.DATA_DIR
        self.old_rooms,self.old_sessions=dict(app.ROOMS),dict(app.SESSIONS)
        self.temp=TemporaryDirectory();app.sio=DummySio();app.DATA_DIR=self.temp.name
        app.ROOMS.clear();app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():room.status='game_over'
        for _ in range(100):
            if not any(r.bot_running for r in app.ROOMS.values()):break
            await asyncio.sleep(.01)
        app.sio,app.DATA_DIR=self.old_sio,self.old_data
        app.ROOMS.clear();app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear();app.SESSIONS.update(self.old_sessions);self.temp.cleanup()

    async def make_room(self,bots=False):
        await app.on_room_create('s0',{'name':'DM','game_type':Game.game_id,'config':{'seed':157}})
        room=app.ROOMS[app.SESSIONS['s0']['room_id']]
        for i in (1,2):
            if bots:await app.on_room_add_bot('s0',{})
            else:await app.on_room_join(f's{i}',{'room_id':room.room_id,'name':f'冒险者{i}'})
        for p in room.players:p.ready=True
        with patch.object(app,'_maybe_run_bots',new_callable=AsyncMock):await app.on_room_start('s0',{})
        self.assertEqual(room.status,'in_game')
        room.auto_save=True;app._save_room_state(room)
        return room

    async def send(self,room,sid,kind,**fields):
        await app.on_game_action(sid,{'action':action(room.game_state,kind,**fields)})

    async def setup_characters(self,room):
        for i,cls in ((1,'fighter'),(2,'wizard')):
            await self.send(room,f's{i}','choose',class_id=cls,species='human',background='sage')
            await self.send(room,f's{i}','ready')
        await self.send(room,'s0','ready')

    async def test_catalog_private_broadcast_and_skip_schema(self):
        row=next(r for r in await app.api_list_games() if r['game_id']==Game.game_id)
        self.assertEqual((row['min_players'],row['max_players']),(3,5));self.assertIn('边陲英雄',row['name_zh'])
        room=await self.make_room();await self.setup_characters(room)
        app.sio.emits.clear();await self.send(room,'s0','note',text='DM_PRIVATE_157')
        updates=[e for e in app.sio.emits if e['event']=='game:state'];self.assertEqual(len(updates),3)
        for message in updates:
            raw=json.dumps(message['payload'],ensure_ascii=False)
            self.assertEqual('DM_PRIVATE_157' in raw,message['to']=='s0')
            self.assertNotIn('seed',message['payload']['view'])
        before=copy.deepcopy(room.game_state)
        await app.on_game_action('s1',{'action':action(room.game_state,'adjust_hp',target=room.players[1].player_id,delta=100,reason='unauthorized'),'skip_validation':True})
        self.assertEqual(before,room.game_state)
        await app._emit_room_state(room);self.assertNotIn('seed',app.sio.emits[-1]['payload']['game_config'])
        self.assertEqual(app._public_bot_action(Game.game_id,action(room.game_state,'note',text='secret')),{'type':'note'})

    async def test_private_save_cold_authenticated_reconnect(self):
        room=await self.make_room();await self.setup_characters(room);await self.send(room,'s0','note',text='DM_PRIVATE_157')
        pid=room.players[1].player_id;token=room.players[1].reconnect_token
        expected=copy.deepcopy(room.game_state);rid=room.room_id
        for cold in (False,True):
            if cold:app.ROOMS.clear();app.SESSIONS.clear()
            with self.assertRaises(app.HTTPException) as caught:await app.download_room_save(rid)
            self.assertEqual(caught.exception.status_code,403)
            await app.on_room_load('outsider',{'source_room_id':rid});self.assertFalse(app.sio.emits[-1]['payload']['ok'])
        await app.on_room_reconnect('bad',{'room_id':rid,'player_id':pid,'reconnect_token':'wrong'});self.assertEqual(app.ROOMS,{})
        with patch.object(app,'_maybe_run_bots',new_callable=AsyncMock):
            await app.on_room_reconnect('restored',{'room_id':rid,'player_id':pid,'reconnect_token':token})
        self.assertEqual(expected,app.ROOMS[rid].game_state)
        msg=[e for e in app.sio.emits if e['event']=='game:state' and e['to']=='restored'][-1]
        self.assertNotIn('DM_PRIVATE_157',json.dumps(msg['payload']))

    async def test_bot_runner_waits_for_dm_review(self):
        room=await self.make_room(bots=True);await app._maybe_run_bots(room)
        for _ in range(200):
            if not room.bot_running:break
            await asyncio.sleep(.01)
        self.assertEqual(len(room.game_state['ready']),2)
        await self.send(room,'s0','ready');self.assertEqual(room.game_state['phase'],'exploration')
        await self.send(room,'s0','travel',scene='tavern')
        await self.send(room,'s0','resolve',outcome='peace',reason='旅人愿意合作')
        for _ in range(200):
            if not room.bot_running:break
            await asyncio.sleep(.01)
        self.assertEqual(room.game_state['phase'],'encounter_review');self.assertEqual(len(room.game_state['ready']),2)
        await self.send(room,'s0','next_round');self.assertEqual(room.game_state['phase'],'exploration')
        self.assertEqual(room.game_state['gold'],60)


if __name__=='__main__':unittest.main()
