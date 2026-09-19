import copy
import json
import unittest

from game.gaia_project import (
    GaiaProjectGame as Game, _active_techs, _board, _capacity, _counts, _final_score,
    _gain, _metric, _neighbors, _pay, _power_value, _research, _start_round,
    action_options, build_cost, charge_power, distance, income_sources,
)
from game.gaia_project_data import ADVANCED, BOOSTERS, BUILDINGS, FACTIONS, FINALS, ROUND_TILES, TECHS, TRACKS


def players(count=2):
    return [dict(player_id=chr(97+i), name=f'Player {i+1}', seat=i) for i in range(count)]


def hex_at(q, r, planet=None, owner=None, building='mine'):
    key = f'{q}:{r}'
    return dict(id=key, q=q, r=r, sector='1', planet=planet,
                buildings={owner: building} if owner else {}, satellites=[],
                federations={}, gaiaformer=None)


def position(factions=('terrans', 'xenos')):
    state = Game.init_game({'seed': 96}, players(len(factions)))
    for pid, faction in zip(state['seat_order'], factions):
        _, error = Game.apply_action(state, pid, {'type': 'choose_faction', 'faction': faction})
        assert error is None, error
    state.update(phase='action', round=1, current_turn='a', main_done=False,
                 round_start_vp={pid:10 for pid in state['players']})
    state['round_tiles'][0] = 'research'
    for i, pid in enumerate(state['seat_order']):
        p = state['players'][pid]
        p.update(credits=30, ore=15, knowledge=15, qic=10, power=[4, 4, 8], booster=list(BOOSTERS)[i])
    state['board'] = {h['id']: h for h in [hex_at(0,0,'terra','a'), hex_at(1,0,'swamp'),
                      hex_at(2,0,'desert','b'), hex_at(0,1,'gaia'), hex_at(1,1,'transdim'),
                      hex_at(2,1), hex_at(3,0), hex_at(3,1), hex_at(0,2), hex_at(1,2)]}
    return state


class GaiaProjectTests(unittest.TestCase):
    def act(self, state, action, pid='a'):
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error, (action, error))
        return events

    def reject(self, state, action, pid='a'):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNotNone(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, before, 'Rejected actions must be atomic')

    def test_component_counts_and_deterministic_setup(self):
        self.assertEqual([len(x) for x in (FACTIONS, TECHS, ADVANCED, BOOSTERS, ROUND_TILES, FINALS)], [14,9,15,10,10,6])
        first=Game.init_game({'seed':'test'}, players(4))
        self.assertEqual(first, Game.init_game({'seed':'test'}, players(4)))
        self.assertEqual(len(first['booster_market']), 7)
        self.assertEqual(sum(first['federation_supply'].values()), 17)

    def test_standard_maps_have_connected_unique_hexes(self):
        for count, total in [(2,133),(3,190),(4,190)]:
            state=Game.init_game({'seed':0}, players(count))
            self.assertEqual(len(state['board']),total)
            neighbors=_neighbors(state)
            seen, queue=set(),[next(iter(neighbors))]
            while queue:
                key=queue.pop()
                if key not in seen:
                    seen.add(key);queue.extend(neighbors[key])
            self.assertEqual(len(seen),total)
            for key, linked in neighbors.items():
                self.assertTrue(all(distance(state['board'][key],state['board'][n])==1 for n in linked))
                for n in linked:
                    planet=state['board'][key]['planet']
                    if planet not in (None,'gaia','transdim'):
                        self.assertNotEqual(planet,state['board'][n]['planet'])

    def test_faction_color_exclusion_and_start_rewards(self):
        state=Game.init_game({'seed':0},players())
        self.act(state,{'type':'choose_faction','faction':'geodens'})
        self.assertEqual(state['players']['a']['ore'],6)
        self.reject(state,{'type':'choose_faction','faction':'bal_taks'},'b')
        self.act(state,{'type':'choose_faction','faction':'xenos'},'b')
        self.assertEqual(state['players']['b']['qic'],2)

    def test_xenos_third_mine_and_ivits_last_institute(self):
        state=Game.init_game({'seed':1},players(3))
        for pid,f in zip('abc',['xenos','terrans','ivits']):
            self.act(state,{'type':'choose_faction','faction':f},pid)
        self.assertEqual(state['setup_queue'],['a','b','b','a','a','c'])
        while state['phase']=='placement':
            pid=state['current_turn']; before=copy.deepcopy(state['players'])
            self.act(state,action_options(state,pid)[0]['action'],pid)
            self.assertEqual(state['pending'],[])
            self.assertEqual(state['players'],before)
        self.assertEqual(_counts(state,'a')['mine'],3)
        self.assertEqual(_counts(state,'c')['institute'],1)
        self.assertEqual(state['current_turn'],'c')

    def test_public_and_serialized_views_do_not_alias_state(self):
        s=position(); view=Game.get_public_view(s,'spectator')
        self.assertEqual(view['options'],[])
        self.assertFalse(view['can_federate'])
        view['board'].clear(); self.assertTrue(s['board'])
        restored=Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(restored,s)
        restored['players']['a']['ore']=0
        self.assertEqual(s['players']['a']['ore'],15)
        self.reject(s,{'type':'pass','booster':s['booster_market'][0]},'spectator')

    def test_malformed_actions_and_out_of_turn_cannot_mutate(self):
        s=position()
        for action in [None,{}, {'type':'convert','conversion':'power_ore','count':-3},
                       {'type':'burn','count':True},{'type':'build','hex':'unknown'},
                       {'type':'research','track':'bad'},{'type':'end_turn','extra':1}]:
            self.reject(s,action)
        self.reject(s,{'type':'research','track':'ai'},'b')

    def test_build_pays_full_terraform_cost_and_rejects_partial(self):
        s=position(); s['players']['a']['research']['terraforming']=0
        self.assertEqual(build_cost(s,'a','1:0')['cost'],{'credits':2,'ore':4,'qic':0})
        s['players']['a']['ore']=3
        self.reject(s,{'type':'build','hex':'1:0'})
        s['players']['a']['ore']=4
        self.act(s,{'type':'build','hex':'1:0'})
        self.assertEqual(s['players']['a']['ore'],0)
        self.assertEqual(s['board']['1:0']['planet'],'swamp')

    def test_source_must_pay_and_use_atomic_build(self):
        s=position(); s['players']['a']['booster']='terraform'
        self.act(s,{'type':'build','hex':'1:0','source':'booster_terraform'})
        self.assertEqual(s['players']['a']['ore'],14)
        self.assertIn('booster',s['players']['a']['used_special'])
        self.reject(s,{'type':'power_action','action':'terraform_1'})

    def test_range_qic_cost_and_gaia_fee(self):
        s=position(); h=hex_at(6,0,'gaia');s['board'][h['id']]=h
        self.assertEqual(build_cost(s,'a',h['id'])['cost']['qic'],4)
        h['gaiaformer']='a'
        self.assertEqual(build_cost(s,'a',h['id'])['cost']['qic'],0)
        h['gaiaformer']='b'
        self.reject(s,{'type':'build','hex':h['id']})

    def test_mine_inventory_and_cohabiting_lantids(self):
        s=position(('lantids','xenos')); s['board']['0:0']['buildings']['a']='institute'
        self.act(s,{'type':'build','hex':'2:0'})
        self.assertEqual(s['players']['a']['ore'],14)
        self.assertEqual(s['players']['a']['knowledge'],15)
        self.assertEqual(_metric(s,'a','types'),1)
        s.update(main_done=False,pending=[])
        self.reject(s,{'type':'upgrade','hex':'2:0','building':'trading_station'})

    def test_upgrade_discount_and_tech_prompt(self):
        s=position(); self.act(s,{'type':'upgrade','hex':'0:0','building':'trading_station'})
        self.assertEqual(s['players']['a']['credits'],27)
        s.update(main_done=False,pending=[])
        self.act(s,{'type':'upgrade','hex':'0:0','building':'lab'})
        self.assertEqual(s['pending'][0]['kind'],'tech')
        self.reject(s,{'type':'convert','conversion':'ore_credits'})

    def test_free_actions_before_and_after_but_only_one_main(self):
        s=position(); self.act(s,{'type':'convert','conversion':'power_ore'})
        self.assertFalse(s['main_done'])
        self.act(s,{'type':'research','track':'ai'})
        self.assertTrue(s['main_done'])
        self.act(s,{'type':'convert','conversion':'ore_credits'})
        self.reject(s,{'type':'research','track':'science'})
        self.act(s,{'type':'end_turn'})
        self.assertEqual(s['current_turn'],'b')

    def test_charge_cycle_brainstone_and_burn(self):
        s=position(('taklons','xenos'));p=s['players']['a'];p.update(power=[1,1,0],brain=0)
        self.assertEqual(charge_power(p,3),3)
        self.assertEqual(p['power'],[0,2,0]);self.assertEqual(p['brain'],2)
        _pay(s,'a',{'power':3});self.assertEqual(p['brain'],0)
        self.act(s,{'type':'burn','count':1})
        self.assertEqual(s['players']['a']['power'],[0,0,1])

    def test_nevlas_batch_spending_and_itars_burning(self):
        s=position(('nevlas','xenos'));s['board']['0:0']['buildings']['a']='institute'
        p=s['players']['a'];p.update(power=[0,0,3],ore=0)
        self.act(s,{'type':'convert','conversion':'power_ore','count':2})
        self.assertEqual(s['players']['a']['power'],[3,0,0]);self.assertEqual(s['players']['a']['ore'],2)
        s=position(('itars','xenos'));self.act(s,{'type':'burn','count':2})
        self.assertEqual(s['players']['a']['gaia_power'],2)

    def test_leech_uses_recipient_structure_and_blocks_actor(self):
        s=position();s['board']['2:0']['buildings']['b']='institute'
        self.act(s,{'type':'build','hex':'1:0'})
        self.assertEqual(s['pending'][0]['value'],3)
        self.reject(s,{'type':'end_turn'})
        self.act(s,{'type':'leech','accept':True},'b')
        self.assertEqual(s['players']['b']['vp'],8)
        self.assertEqual(s['pending'],[])

    def test_passed_player_still_charges_with_capacity_and_vp_limits(self):
        s=position();s['passed']=['b'];s['players']['b'].update(vp=0,power=[0,1,9])
        s['board']['2:0']['buildings']['b']='institute'
        self.act(s,{'type':'build','hex':'1:0'})
        self.act(s,{'type':'leech','accept':True},'b')
        self.assertEqual(s['players']['b']['power'],[0,0,10])
        self.assertEqual(s['players']['b']['vp'],0)

    def test_gaia_project_finishes_after_income_and_is_reserved(self):
        s=position();self.act(s,{'type':'gaiaform','hex':'1:1','power_tokens':[4,2,0]})
        p=s['players']['a'];self.assertEqual(p['gaia_power'],6);self.assertEqual(p['gaiaformers'],0)
        s['pending']=[];_start_round(s)
        while s['phase']=='income':
            pid=s['current_turn'];self.act(s,{'type':'income','index':0},pid)
        self.assertEqual(s['board']['1:1']['planet'],'gaia')
        self.assertEqual(s['players']['a']['gaia_power'],0)
        self.assertEqual(s['players']['a']['power'][1],8)
        s.update(current_turn='a',main_done=False)
        self.act(s,{'type':'build','hex':'1:1'})
        self.assertEqual(s['players']['a']['gaiaformers'],1)
        self.assertIsNone(s['board']['1:1']['gaiaformer'])

    def test_power_gaia_payment_cannot_use_gaia_bowl(self):
        s=position();p=s['players']['a'];p.update(power=[0,0,0],gaia_power=10)
        self.reject(s,{'type':'gaiaform','hex':'1:1'})

    def test_research_exclusive_top_and_separate_advanced_token_cost(self):
        s=position();p=s['players']['a'];p['research']['science']=4
        self.reject(s,{'type':'research','track':'science'})
        p['federations']=[dict(token='ore',green=True,source='board')]
        self.act(s,{'type':'research','track':'science'})
        self.assertFalse(s['players']['a']['federations'][0]['green'])
        s.update(current_turn='b',main_done=False);s['players']['b']['research']['science']=4
        s['players']['b']['federations']=[dict(token='ore',green=True,source='board')]
        self.reject(s,{'type':'research','track':'science'},'b')

    def test_advanced_cover_removes_effect_and_free_research_needs_second_token(self):
        s=position();p=s['players']['a'];p['techs']=['structure_power'];p['research']['science']=4
        p['federations']=[dict(token='ore',green=True,source='board')]
        s['advanced_market']['science']='mine_vp';s['pending']=[dict(kind='tech',player_id='a')]
        self.act(s,{'type':'choose_tech','tile':'mine_vp','cover':'structure_power'})
        self.assertNotIn('structure_power',_active_techs(s['players']['a']))
        self.reject(s,{'type':'choose_track','track':'science'})
        self.act(s,{'type':'choose_track','track':'ai'})
        self.assertEqual(s['players']['a']['research']['ai'],1)

    def test_standard_tech_track_and_no_duplicate_after_covering(self):
        s=position();s['pending']=[dict(kind='tech',player_id='a')]
        tile=s['tech_market'][0]
        self.act(s,{'type':'choose_tech','tile':tile})
        self.reject(s,{'type':'choose_track','track':'science'})
        self.act(s,{'type':'choose_track','track':'terraforming'})
        s['pending']=[dict(kind='tech',player_id='a')];s['players']['a']['covered']=[tile]
        self.reject(s,{'type':'choose_tech','tile':tile})

    def test_income_third_mine_and_top_science_replaces_income(self):
        s=position();s['board']['0:1']['buildings']['a']='mine';s['board']['1:0']['buildings']['a']='mine'
        self.assertEqual(sum(x['gain'].get('ore',0) for x in income_sources(s,'a')),4) # base 1, 3 mines 2, booster 1
        s['players']['a']['research']['science']=5
        self.assertEqual(sum(x['gain'].get('knowledge',0) for x in income_sources(s,'a')),2)
        _gain(s,'a',{'ore':100,'knowledge':100,'credits':100})
        self.assertEqual([s['players']['a'][k] for k in ('ore','knowledge','credits')],[15,15,30])

    def test_bescods_and_nevlas_income_and_bescods_upgrade_tree(self):
        s=position(('bescods','xenos'));s['board']['0:0']['buildings']['a']='trading_station'
        self.act(s,{'type':'upgrade','hex':'0:0','building':'academy_knowledge'})
        s=position(('nevlas','xenos'));s['board']['0:0']['buildings']['a']='lab'
        sources=income_sources(s,'a')
        self.assertEqual(sum(x['gain'].get('charge',0) for x in sources),2)
        self.assertEqual(sum(x['gain'].get('knowledge',0) for x in sources),3) # base, science, booster

    def test_gleens_qic_replacement_and_gaia_fee(self):
        s=position(('gleens','terrans'));s['players']['a']['ore']=0
        _gain(s,'a',{'qic':2});self.assertEqual(s['players']['a']['ore'],2)
        self.assertEqual(build_cost(s,'a','0:1')['cost']['ore'],2)
        s['board']['0:0']['buildings']['a']='academy_qic'
        _gain(s,'a',{'qic':1});self.assertEqual(s['players']['a']['qic'],11)

    def test_bal_taks_gaiaformer_conversion_and_navigation_gate(self):
        s=position(('bal_taks','xenos'));self.reject(s,{'type':'research','track':'navigation'})
        self.act(s,{'type':'convert','conversion':'bal_taks_qic'})
        self.assertEqual(s['players']['a']['gaiaformers_held'],1)
        self.assertEqual(s['players']['a']['gaiaformers'],0)
        s['board']['0:0']['buildings']['a']='institute'
        self.act(s,{'type':'research','track':'navigation'})

    def test_geodens_only_new_planet_type_earns_knowledge(self):
        s=position(('geodens','xenos'));s['board']['0:0']['buildings']['a']='institute';s['players']['a']['knowledge']=0
        self.act(s,{'type':'build','hex':'1:0'})
        self.assertEqual(s['players']['a']['knowledge'],3)
        s.update(main_done=False,pending=[]);s['board']['0:1']['planet']='swamp';s['players']['a']['ore']=15
        self.act(s,{'type':'build','hex':'0:1'})
        self.assertEqual(s['players']['a']['knowledge'],3)

    def test_terrans_and_itars_gaia_decisions(self):
        s=position();s['board']['0:0']['buildings']['a']='institute';s['players']['a'].update(gaia_power=4,knowledge=0)
        _start_round(s)
        while s['phase']=='income':self.act(s,{'type':'income','index':0},s['current_turn'])
        self.assertEqual(s['phase'],'gaia');before=s['players']['a']['knowledge']
        self.act(s,{'type':'terrans_convert','resource':'knowledge'})
        self.assertEqual(s['players']['a']['knowledge'],before+1)
        self.act(s,{'type':'gaia_finish'})
        self.assertEqual(s['players']['a']['gaia_power'],0)
        s=position(('itars','xenos'));s['board']['0:0']['buildings']['a']='institute';s['players']['a']['gaia_power']=8
        _start_round(s)
        while s['phase']=='income':self.act(s,{'type':'income','index':0},s['current_turn'])
        self.act(s,{'type':'itars_tech'})
        self.assertEqual(s['players']['a']['gaia_power'],4)
        self.assertEqual(s['pending'][0]['kind'],'tech')

    def test_ambas_swap_preserves_federation_and_firaks_is_repeatable(self):
        s=position(('ambas','xenos'));s['board']['0:0']['buildings']['a']='institute';s['board']['0:0']['federations']['a']=0
        s['board']['1:0']['buildings']['a']='mine'
        self.act(s,{'type':'special','action':'ambas','hex':'1:0'})
        self.assertEqual(s['board']['0:0']['federations']['a'],0);self.assertFalse(s['pending'])
        s=position(('firaks','xenos'));s['board']['0:0']['buildings']['a']='institute';s['board']['1:0']['buildings']['a']='lab'
        self.act(s,{'type':'special','action':'firaks','hex':'1:0'})
        self.assertNotIn('firaks',s['players']['a']['used_special']);self.assertEqual(s['pending'][0]['kind'],'track')

    def test_pass_cannot_keep_booster_and_round_requires_every_ack(self):
        s=position();s['booster_market']=['tokens_ore','terraform','range']
        self.reject(s,{'type':'pass','booster':s['players']['a']['booster']})
        self.act(s,{'type':'pass','booster':'range'})
        self.reject(s,{'type':'convert','conversion':'ore_credits'})
        self.act(s,{'type':'pass','booster':'terraform'},'b')
        self.assertEqual(s['phase'],'round_end');self.assertEqual(s['round'],1)
        self.act(s,{'type':'next_round'})
        self.assertEqual(s['round'],1);self.reject(s,{'type':'next_round'})
        self.act(s,{'type':'next_round'},'b')
        self.assertEqual(s['round'],2)

    def test_final_scores_ties_and_neutral_competitor(self):
        s=position();s['final_tiles']=['buildings','types'];s['players']['b']['research']={t:0 for t in TRACKS}
        s['players']['a']['research']={t:0 for t in TRACKS}
        for p in s['players'].values():p.update(credits=1,ore=1,knowledge=1,vp=10)
        _final_score(s)
        self.assertEqual(s['scores']['a']['objectives']['buildings']['vp'],9)
        self.assertEqual(s['scores']['a']['total'],29)
        self.assertEqual(s['winner'],['a','b'])

    def test_last_round_does_not_run_income_or_complete_projects(self):
        s=position();s['round']=6;s['board']['1:1']['gaiaformer']='a'
        self.act(s,{'type':'pass'});self.act(s,{'type':'pass'},'b')
        self.assertTrue(s['game_over']);self.assertEqual(s['round'],6)
        self.assertEqual(s['board']['1:1']['planet'],'transdim')
        self.reject(s,{'type':'next_round'})

    def federation_position(self, faction='terrans'):
        s=position((faction,'xenos' if faction!='xenos' else 'terrans'))
        cells=[hex_at(0,0,'terra','a','institute'),hex_at(1,0),hex_at(2,0,'swamp','a','academy_knowledge'),
               hex_at(3,0,'desert','a','mine'),hex_at(0,1),hex_at(1,1),hex_at(2,1)]
        s['board']={h['id']:h for h in cells};s['federation_supply']['ore']=3
        return s

    def test_federation_connected_minimal_cost_and_green_token(self):
        s=self.federation_position()
        self.act(s,{'type':'federation','hexes':['0:0','1:0','2:0'],'token':'ore'})
        self.assertEqual(s['players']['a']['power'][0],3)
        self.assertTrue(s['players']['a']['federations'][0]['green'])
        self.assertIn('a',s['board']['3:0']['federations'])
        self.assertEqual(_metric(s,'a','federated'),3)

    def test_federation_disconnected_excess_or_gaia_payment_rejected(self):
        s=self.federation_position()
        self.reject(s,{'type':'federation','hexes':['0:0','2:0','3:0'],'token':'ore'})
        self.reject(s,{'type':'federation','hexes':['0:0','1:0','2:0','0:1'],'token':'ore'})
        s['players']['a'].update(power=[0,0,0],gaia_power=20)
        self.reject(s,{'type':'federation','hexes':['0:0','1:0','2:0'],'token':'ore'})

    def test_federation_can_cross_opponent_satellite_and_space_station(self):
        s=self.federation_position();s['board']['1:0']['satellites']=['b'];s['board']['1:0']['buildings']={'b':'station'}
        self.act(s,{'type':'federation','hexes':['0:0','1:0','2:0'],'token':'ore'})
        self.assertEqual(s['board']['1:0']['satellites'],['b','a'])

    def test_ivits_satellites_cost_qic_and_growth_uses_same_federation(self):
        s=self.federation_position('ivits')
        self.act(s,{'type':'federation','hexes':['0:0','1:0','2:0'],'token':'ore'})
        self.assertEqual(s['players']['a']['qic'],9);self.assertEqual(s['players']['a']['power'],[4,4,8])
        s.update(main_done=False)
        self.reject(s,{'type':'federation','hexes':['0:0'],'token':'ore'})

    def test_twelve_vp_token_is_gray(self):
        s=self.federation_position();s['federation_supply']['points']=3
        self.act(s,{'type':'federation','hexes':['0:0','1:0','2:0'],'token':'points'})
        self.assertFalse(s['players']['a']['federations'][0]['green'])

    def test_bot_full_games_and_save_resume(self):
        for count in (2,3,4):
            s=Game.init_game({'seed':96+count},players(count))
            for step in range(1600):
                if s['game_over']:break
                for pid in s['turn_order']:
                    action=Game.bot_move(s,pid)
                    if action:
                        self.act(s,action,pid);break
                else:self.fail(f'Bot deadlock: {s["phase"]}')
                if step%29==0:
                    s=Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
            self.assertTrue(s['game_over']);self.assertEqual(s['round'],6)
            self.assertTrue(s['winner'])


if __name__=='__main__':
    unittest.main()
