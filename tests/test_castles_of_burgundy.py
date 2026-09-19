import copy
import json
import unittest
from collections import Counter

from game.castles_of_burgundy import (
    CastlesOfBurgundyGame as Game, can_place, final_breakdown, knowledge,
    legal_options, worker_cost, _finish, _new_phase, _order,
)
from game.castles_of_burgundy_data import (
    BLACK_KNOWLEDGE, BUILDINGS, KINDS, KNOWLEDGE_BUILDINGS, make_estate, make_supply,
)


class BurgundyTests(unittest.TestCase):
    def setUp(self):
        self.state = self.new_game()
        self.pid = self.state['current_turn']
        self.p = self.state['players'][self.pid]
        self.serial = 0

    @staticmethod
    def new_game(n=2, seed=97):
        return Game.init_game({'seed': seed}, [
            {'player_id': str(i), 'name': f'Player {i}', 'seat': i, 'is_bot': True}
            for i in range(n)])

    def tile(self, kind, **extra):
        self.serial += 1
        return {'id': f'test-{self.serial}', 'kind': kind, **extra}

    def tech(self, *numbers):
        cells = [c for c in self.p['estate'] if c['kind'] == 'knowledge']
        for c, n in zip(cells, numbers):
            c['tile'] = self.tile('knowledge', number=n)

    def apply(self, action, pid=None):
        events, error = Game.apply_action(self.state, pid or self.pid, action)
        self.assertIsNone(error, (action, error))
        self.assertTrue(events)
        self.p = self.state['players'][self.pid]

    def reject(self, action, pid=None):
        before = copy.deepcopy(self.state)
        _, error = Game.apply_action(self.state, pid or self.pid, action)
        self.assertIsNotNone(error)
        self.assertEqual(before, self.state)

    def place_at(self, tile, cell):
        self.p['storage'].append(tile)
        self.state['pending'] = {'kind': 'city_hall'}
        self.apply({'type': 'place', 'tile': tile['id'], 'cell': cell})

    def test_setup_board_supply_and_private_information(self):
        estate = make_estate()
        self.assertEqual(len(estate), 37)
        self.assertEqual(Counter(c['kind'] for c in estate), {
            'castle': 4, 'ship': 6, 'mine': 3, 'knowledge': 6, 'building': 12, 'animal': 6})
        self.assertEqual(sorted(Counter(c['region'] for c in estate if c['kind'] == 'building').values()), [1,3,3,5])
        self.assertEqual((estate[18]['q'],estate[18]['r'],estate[18]['number']), (0,0,6))
        for cell in estate:
            for n in cell['neighbors']:
                self.assertIn(cell['id'], estate[n]['neighbors'])
        supply = make_supply()
        self.assertEqual(sum(map(len,supply.values())),164)
        self.assertEqual(len(supply['black']),40)
        self.assertEqual({t['number'] for t in supply['black'] if t['kind']=='knowledge'}, BLACK_KNOWLEDGE)
        for n in (2,3,4):
            state=self.new_game(n)
            self.assertEqual([len(d['tiles']) for d in state['depots'][1:]], [n]*6)
            self.assertEqual(len(state['depots'][0]['tiles']), {2:2,3:5,4:8}[n])
            self.assertEqual(sorted(p['workers'] for p in state['players'].values()), list(range(1,n+1)))
            self.assertTrue(all(sum(p['goods'])==3 and p['silver']==1 for p in state['players'].values()))
            self.assertEqual(sum(len(d['goods']) for d in state['depots']),1)
        view=Game.get_public_view(self.state,'spectator')
        self.assertEqual(view['options'],[])
        for key in ('seed','supply','goods_supply','player_meta'):
            self.assertNotIn(key,view)
        view['players'][0]['estate'][18]['tile']['id']='changed'
        self.assertNotEqual(self.p['estate'][18]['tile']['id'],'changed')

    def test_three_player_alternating_castle_mine_and_goods_persist(self):
        s=self.new_game(3)
        self.assertIn('castle',[t['kind'] for t in s['depots'][6]['tiles']])
        s['depots'][2]['goods']=[2,4]
        s['stage']=2
        _new_phase(s)
        self.assertIn('mine',[t['kind'] for t in s['depots'][6]['tiles']])
        self.assertNotIn('castle',[t['kind'] for t in s['depots'][6]['tiles']])
        self.assertEqual(s['depots'][2]['goods'],[2,4])
        s['stage']=3
        _new_phase(s)
        self.assertIn('castle',[t['kind'] for t in s['depots'][6]['tiles']])

    def test_worker_wrap_and_all_adjustment_knowledge(self):
        self.p['dice']=[1,6]
        self.assertEqual(worker_cost(self.p,0,6,'take'),1)
        self.assertEqual(worker_cost(self.p,1,3,'take'),3)
        self.tech(8,9,10,11,12)
        self.assertEqual(worker_cost(self.p,1,3,'sell'),2)
        self.assertEqual(worker_cost(self.p,1,3,'take'),1)
        for kind in KINDS:
            self.assertEqual(worker_cost(self.p,0,6,'place',kind),0)
            self.assertEqual(worker_cost(self.p,1,3,'place',kind),1)
        self.assertEqual(worker_cost(self.p,0,6,'sell'),1)

    def test_take_full_storage_requires_explicit_replacement(self):
        self.p['storage']=[self.tile('mine') for _ in range(3)]
        depot=self.state['depots'][1]
        tile=depot['tiles'][0]
        self.p['dice'][0]=1
        action={'type':'take','die':0,'depot':1,'tile':tile['id']}
        self.reject(action)
        removed=self.p['storage'][1]['id']
        self.apply({**action,'discard':removed})
        self.assertEqual(len(self.p['storage']),3)
        self.assertNotIn(removed,[t['id'] for t in self.p['storage']])
        self.assertTrue(self.p['used'][0])
        self.assertIn(tile['id'],[t['id'] for t in self.p['storage']])

    def test_illegal_requests_are_atomic_and_strictly_typed(self):
        for action in ({'type':'workers','die':True},{'type':'workers','die':-1},
                       {'type':'workers','die':'0'},{'type':'workers','die':0,'extra':1},
                       {'type':'end_turn'},{'type':'next_round'},{'type':'workers'},
                       {'type':'place','die':0,'tile':'missing','cell':18}):
            self.reject(action)
        self.reject({'type':'workers','die':0},'spectator')
        other=next(p for p in self.state['players'] if p!=self.pid)
        self.reject({'type':'workers','die':0},other)
        self.apply({'type':'workers','die':0})
        self.reject({'type':'workers','die':0})

    def test_placement_adjacency_colour_and_duplicate_city(self):
        tile=self.tile('building',building='bank')
        self.assertFalse(can_place(self.p,tile,self.p['estate'][8]))
        self.assertFalse(can_place(self.p,tile,self.p['estate'][19]))
        self.assertTrue(can_place(self.p,tile,self.p['estate'][25]))
        self.place_at(tile,25)
        self.assertFalse(can_place(self.p,self.tile('building',building='bank'),self.p['estate'][26]))
        self.tech(1)
        self.assertTrue(can_place(self.p,self.tile('building',building='bank'),self.p['estate'][26]))

    def test_bank_boarding_house_watchtower_and_single_region(self):
        for building, resource, amount in (('bank','silver',2),('boarding_house','workers',4),('watchtower','score',4)):
            self.setUp()
            before=self.p[resource]
            self.place_at(self.tile('building',building=building),25)
            self.assertEqual(self.p[resource],before+amount)
        self.setUp()
        self.place_at(self.tile('building',building='watchtower'),11)
        self.assertEqual(self.p['score'],15)  # 4 + one-hex region 1 + phase A 10
        self.assertIn(11,self.p['completed'])

    def test_each_building_choice_filter_and_castle_chain(self):
        for building, allowed in (('workshop',{'building'}),('church',{'castle','mine','knowledge'}),('market',{'ship','animal'})):
            self.setUp()
            self.place_at(self.tile('building',building=building),25)
            self.assertEqual(self.state['pending']['kind'],building)
            takes=[o['action'] for o in legal_options(self.state,self.pid) if o['action']['type']=='take']
            self.assertTrue(takes)
            for action in takes:
                self.assertNotIn('die',action)
                tile=next(t for t in self.state['depots'][action['depot']]['tiles'] if t['id']==action['tile'])
                self.assertIn(tile['kind'],allowed)
            self.reject({'type':'workers','die':0})
            self.apply({'type':'skip_bonus'})
        self.setUp()
        # Link the upper castle region to the initial castle for this fixture.
        self.p['estate'][11]['tile']=self.tile('building',building='bank')
        self.place_at(self.tile('castle'),6)
        self.assertEqual(self.state['pending']['kind'],'castle')
        city=self.tile('building',building='city_hall')
        bank=self.tile('building',building='bank')
        self.p['storage']=[city,bank]
        self.apply({'type':'place','tile':city['id'],'cell':25})
        self.assertEqual(self.state['pending']['kind'],'city_hall')
        before=self.p['silver']
        self.apply({'type':'place','tile':bank['id'],'cell':26})
        self.assertIsNone(self.state['pending'])
        self.assertEqual(self.p['silver'],before+2)
        self.assertEqual(self.p['used'],[False,False])

    def test_sale_and_warehouse_knowledge_three_four(self):
        self.tech(3,4)
        self.p['goods']=[0,3,0,0,0,0]
        self.p['dice'][0]=2
        silver, workers=self.p['silver'],self.p['workers']
        self.apply({'type':'sell','die':0,'goods':2})
        self.assertEqual(self.p['score'],6)
        self.assertEqual(self.p['silver'],silver+2)
        self.assertEqual(self.p['workers'],workers+1)
        self.assertEqual(self.p['sold'],[0,3,0,0,0,0])
        self.p['goods'][0]=2
        self.place_at(self.tile('building',building='warehouse'),25)
        self.apply({'type':'sell','goods':1})
        self.assertEqual(self.p['score'],10)
        self.assertFalse(self.p['used'][1])

    def test_workers_knowledge_thirteen_fourteen(self):
        self.tech(13,14)
        silver, workers=self.p['silver'],self.p['workers']
        self.apply({'type':'workers','die':0})
        self.assertEqual((self.p['silver'],self.p['workers']),(silver+1,workers+4))
        self.place_at(self.tile('building',building='boarding_house'),25)
        self.assertEqual((self.p['silver'],self.p['workers']),(silver+1,workers+8))

    def test_purchase_once_even_after_dice_and_knowledge_six(self):
        self.tech(6)
        self.p['silver']=10
        self.apply({'type':'workers','die':0})
        self.apply({'type':'workers','die':1})
        tile=self.state['depots'][2]['tiles'][0]
        self.apply({'type':'buy','depot':2,'tile':tile['id']})
        self.assertEqual(self.p['silver'],8)
        self.assertEqual(self.state['current_turn'],self.pid)
        tile=self.state['depots'][0]['tiles'][0]
        self.reject({'type':'buy','depot':0,'tile':tile['id']})
        self.apply({'type':'end_turn'})

    def test_ship_goods_selection_capacity_and_delayed_order(self):
        old=list(self.state['turn_order'])
        self.p['goods']=[2,0,0,0,0,0]
        self.state['depots'][3]['goods']=[1,2,2,3,4]
        self.place_at(self.tile('ship'),19)
        self.assertEqual(self.p['ships'],1)
        self.assertEqual(self.state['turn_order'],old)
        self.reject({'type':'ship_goods','depots':[3],'goods':[1,2,3,4]})
        self.reject({'type':'ship_goods','depots':[3],'goods':[2,3]})
        self.apply({'type':'ship_goods','depots':[3],'goods':[3,1,2]})
        self.assertEqual(self.p['goods'],[3,2,1,0,0,0])
        self.assertEqual(self.state['depots'][3]['goods'],[4])
        self.assertEqual(_order(self.state)[0],self.pid)

    def test_knowledge_five_only_adjacent_depots_and_forced_same_type(self):
        self.tech(5)
        self.p['goods']=[1,1,1,0,0,0]
        self.state['depots'][1]['goods']=[1,4]
        self.state['depots'][6]['goods']=[2,5]
        self.state['pending']={'kind':'ship'}
        self.reject({'type':'ship_goods','depots':[1,3],'goods':[]})
        self.apply({'type':'ship_goods','depots':[6,1],'goods':[2,1]})
        self.assertEqual(self.p['goods'],[2,2,1,0,0,0])
        self.assertEqual(self.state['depots'][1]['goods'],[4])
        self.assertEqual(self.state['depots'][6]['goods'],[5])

    def test_livestock_rescores_matching_region_with_knowledge_seven(self):
        self.tech(7)
        for index,count,animal in ((0,4,'cow'),(4,3,'cow'),(5,4,'sheep')):
            self.p['estate'][index]['tile']=self.tile('animal',animal=animal,count=count)
        self.p['estate'][27]['tile']=self.tile('animal',animal='cow',count=4)
        self.p['estate'][15]['tile']=self.tile('ship')
        self.place_at(self.tile('animal',animal='cow',count=2),9)
        self.assertEqual(self.p['score'],12)  # 4+3+2 plus 3 tile bonuses; excludes other pasture and sheep

    def test_region_phase_and_colour_first_second(self):
        for idx,pid in enumerate(self.state['players']):
            p=self.state['players'][pid]
            for c in p['estate']:
                if c['kind']=='ship' and c['id']!=19:
                    c['tile']=self.tile('ship')
            self.pid=pid; self.p=p
            self.state['current_turn']=pid
            self.state['stage']=3
            self.place_at(self.tile('ship'),19)
            self.assertEqual(self.p['score'],6+6+(5 if idx==0 else 2))
        self.assertEqual(len(self.state['bonuses']['ship']),2)

    def test_round_gate_income_and_readiness_are_idempotent(self):
        self.tech(2)
        for c in self.p['estate']:
            if c['kind']=='mine': c['tile']=self.tile('mine')
        self.state['round']=5
        before={pid:(p['silver'],p['workers']) for pid,p in self.state['players'].items()}
        for pid in self.state['turn_order']:
            self.state['players'][pid]['used']=[True,True]
            self.apply({'type':'end_turn'},pid)
        self.assertEqual(self.state['phase'],'round_end')
        self.assertEqual(self.state['players'][self.pid]['silver'],before[self.pid][0]+3)
        self.assertEqual(self.state['players'][self.pid]['workers'],before[self.pid][1]+3)
        self.assertEqual(self.state['review']['income'][self.pid],{'silver':3,'workers':3})
        order=self.state['turn_order']
        self.apply({'type':'next_round'},order[0])
        self.reject({'type':'next_round'},order[0])
        self.assertEqual(self.state['stage'],1)
        self.apply({'type':'next_round'},order[1])
        self.assertEqual((self.state['stage'],self.state['round'],self.state['phase']),(2,1,'turn'))
        self.assertTrue(all(p['used']==[False,False] for p in self.state['players'].values()))

    def test_knowledge_fifteen_through_twenty_six_final_scoring(self):
        self.p['sold']=[3,2,0,1,0,0]
        self.p['bonus_tiles']=[{'kind':'ship','points':5},{'kind':'mine','points':2}]
        for number,building in KNOWLEDGE_BUILDINGS.items():
            self.tech(number)
            self.p['estate'][11]['tile']=self.tile('building',building=building)
            self.p['estate'][25]['tile']=self.tile('building',building=building)
            self.assertEqual(final_breakdown(self.p)['knowledge'],8,(number,building))
        self.tech(15,24,25,26)
        for index,animal in ((0,'cow'),(4,'cow'),(5,'sheep'),(9,'pig')):
            self.p['estate'][index]['tile']=self.tile('animal',animal=animal,count=4)
        self.assertEqual(final_breakdown(self.p)['knowledge'],9+12+6+4)
        self.p['silver']=7; self.p['workers']=5; self.p['goods']=[2,0,3,0,0,0]
        self.assertEqual({k:v for k,v in final_breakdown(self.p).items() if k!='knowledge_details'},
                         {'goods':5,'silver':7,'workers':2,'knowledge':31})

    def test_final_tie_break_more_empty_then_later_order(self):
        order=self.state['turn_order']
        for p in self.state['players'].values():
            p['silver']=0; p['workers']=0; p['goods']=[0]*6
        self.state['players'][order[1]]['estate'][11]['tile']=self.tile('building',building='bank')
        _finish(self.state)
        self.assertEqual(self.state['winner'],[order[0]])
        self.state['players'][order[1]]['estate'][11]['tile']=None
        _finish(self.state)
        self.assertEqual(self.state['winner'],[order[1]])

    def test_save_resume_isolated_and_deterministic(self):
        payload=Game.serialize(self.state)
        restored=Game.deserialize(json.loads(json.dumps(payload)))
        for _ in range(25):
            for state in (self.state,restored):
                pid=next(pid for pid in state['players'] if Game.get_legal_actions(state,pid))
                a=Game.bot_move(state,pid)
                self.assertIsNone(Game.apply_action(state,pid,a)[1])
        self.assertEqual(self.state,restored)
        payload['players'][self.pid]['silver']=999
        self.assertNotEqual(self.state['players'][self.pid]['silver'],999)

    def test_all_bots_finish_multiple_player_counts_and_seeds(self):
        for n in (2,3,4):
            for seed in (3,97,204):
                with self.subTest(players=n,seed=seed):
                    state=self.new_game(n,seed)
                    for step in range(900):
                        if state['game_over']: break
                        actor=next((pid for pid in state['players'] if Game.get_legal_actions(state,pid)),None)
                        self.assertIsNotNone(actor)
                        action=Game.bot_move(state,actor)
                        self.assertIsNone(Game.apply_action(state,actor,action)[1])
                        for p in state['players'].values():
                            self.assertGreaterEqual(min(p['silver'],p['workers'],p['score']),0)
                            self.assertLessEqual(len(p['storage']),3)
                            self.assertLessEqual(sum(bool(g) for g in p['goods']),3)
                    self.assertTrue(state['game_over'])
                    self.assertEqual((state['stage'],state['round']),(5,5))
                    self.assertEqual(len(state['winner']),1)
                    self.assertEqual(Game.get_legal_actions(state,state['winner'][0]),[])


if __name__=='__main__':
    unittest.main()
