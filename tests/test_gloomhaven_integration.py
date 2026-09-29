import asyncio
import copy
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

import app
from fastapi import HTTPException
from game.gloomhaven import GloomhavenGame as Game
from tests.test_gloomhaven import action
from tests.test_room_session import DummySio


class GloomhavenIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.old_sio,self.old_data=app.sio,app.DATA_DIR
        self.old_rooms,self.old_sessions=dict(app.ROOMS),dict(app.SESSIONS)
        self.temp=TemporaryDirectory()
        app.sio,app.DATA_DIR=DummySio(),self.temp.name
        app.ROOMS.clear();app.SESSIONS.clear()

    async def asyncTearDown(self):
        for room in app.ROOMS.values():room.status='game_over'
        for _ in range(100):
            if not any(room.bot_running for room in app.ROOMS.values()):break
            await asyncio.sleep(.01)
        app.sio,app.DATA_DIR=self.old_sio,self.old_data
        app.ROOMS.clear();app.ROOMS.update(self.old_rooms)
        app.SESSIONS.clear();app.SESSIONS.update(self.old_sessions)
        self.temp.cleanup()

    async def room(self,count=2,bots=False):
        await app.on_room_create('s0',{'name':'Mercenary','game_type':'gloomhaven','config':{'seed':141,'difficulty':0}})
        room=app.ROOMS[app.SESSIONS['s0']['room_id']]
        for i in range(1,count):
            if bots:await app.on_room_add_bot('s0',{})
            else:await app.on_room_join(f's{i}',{'room_id':room.room_id,'name':f'Mercenary {i}'})
        for player in room.players:player.ready=True
        await app.on_room_start('s0',{})
        return room

    async def wait_bots(self,room):
        for _ in range(600):
            if not room.bot_running:return
            await asyncio.sleep(.01)
        self.fail('bot did not yield')

    async def test_catalog_solo_and_private_broadcast(self):
        entry=next(g for g in await app.api_list_games() if g['game_id']=='gloomhaven')
        self.assertEqual((entry['name_zh'],entry['min_players'],entry['max_players']),('幽港迷城',1,4))
        room=await self.room()
        for i,p in enumerate(room.players):
            await app.on_game_action(f's{i}',{'action':action(room.game_state,'ready')})
        pid=room.players[0].player_id
        hand=room.game_state['heroes']['h1']['hand'][:2]
        app.sio.emits.clear()
        await app.on_game_action('s0',{'action':action(room.game_state,'plan',hero_id='h1',cards=hand)})
        messages=[m for m in app.sio.emits if m['event']=='game:state']
        self.assertEqual(len(messages),2)
        for message in messages:
            view=message['payload']['view']
            h=view['heroes'][0]
            self.assertEqual(h['played'],hand if view['you']==pid else [])
            self.assertNotIn('seed',view['config'])
        await app._emit_room_state(room)
        self.assertNotIn('seed',app.sio.emits[-1]['payload']['game_config'])
        self.assertEqual(app._public_bot_action('gloomhaven',{'type':'plan','cards':['a','b']}),{'type':'plan'})

    async def test_one_player_can_start_and_controls_two(self):
        room=await self.room(1)
        self.assertEqual(room.status,'in_game')
        self.assertEqual(len(room.game_state['heroes']),2)
        await app.on_game_action('s0',{'action':action(room.game_state,'ready')})
        self.assertEqual(room.game_state['phase'],'planning')

    async def test_schema_bypass_and_nonowner_are_rejected(self):
        room=await self.room()
        for i in range(2):await app.on_game_action(f's{i}',{'action':action(room.game_state,'ready')})
        for skip in (False,True):
            before=copy.deepcopy(room.game_state)
            await app.on_game_action('s0',{'skip_validation':skip,'action':action(room.game_state,'plan',hero_id='h2',cards=room.game_state['heroes']['h2']['hand'][:2])})
            self.assertEqual(room.game_state,before)
            self.assertEqual(app.sio.emits[-1]['event'],'system:error')

    async def test_active_save_privacy_and_cold_reconnect(self):
        room=await self.room()
        for i in range(2):
            await app.on_game_action(f's{i}',{'action':action(room.game_state,'ready')})
        await app.on_game_action('s0',{'action':action(room.game_state,'plan',hero_id='h1',cards=room.game_state['heroes']['h1']['hand'][:2])})
        room.auto_save=True;app._save_room_state(room)
        before=copy.deepcopy(room.game_state);player=room.players[0]
        for cold in (False,True):
            if cold:app.ROOMS.clear();app.SESSIONS.clear()
            with self.assertRaises(HTTPException) as error:await app.download_room_save(room.room_id)
            self.assertEqual(error.exception.status_code,403)
            await app.on_room_load('loader',{'source_room_id':room.room_id})
            self.assertFalse(app.sio.emits[-1]['payload']['ok'])
        await app.on_room_reconnect('bad',{'room_id':room.room_id,'player_id':player.player_id,'reconnect_token':'wrong'})
        self.assertNotIn(room.room_id,app.ROOMS)
        await app.on_room_reconnect('new',{'room_id':room.room_id,'player_id':player.player_id,'reconnect_token':player.reconnect_token})
        self.assertEqual(app.ROOMS[room.room_id].game_state,before)
        v=next(m['payload']['view'] for m in reversed(app.sio.emits) if m['event']=='game:state' and m['to']=='new')
        self.assertEqual(v,Game.get_public_view(before,player.player_id))

    async def test_bot_runner_reaches_review_and_does_not_confirm_human(self):
        original=Game.bot_move
        def immediate(state,pid):
            a=original(state,pid)
            if a:a.pop('delay_ms',None)
            return a
        with patch.object(Game,'bot_move',side_effect=immediate):
            room=await self.room(count=2,bots=True);human=room.players[0]
            for _ in range(200):
                await self.wait_bots(room)
                if room.game_state['phase']=='round_review':break
                a=immediate(room.game_state,human.player_id)
                self.assertIsNotNone(a)
                await app.on_game_action('s0',{'action':a})
            self.assertEqual(room.game_state['phase'],'round_review')
            self.assertEqual(room.game_state['ready'],[room.players[1].player_id])
            self.assertEqual(room.game_state['round'],1)
            await app.on_game_action('s0',{'action':action(room.game_state,'next_round')})
            await self.wait_bots(room)
            self.assertEqual(room.game_state['round'],2)


if __name__=='__main__':unittest.main()
