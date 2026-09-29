import copy
import json
import unittest
from collections import Counter

from game.gloomhaven import GloomhavenGame as Game, CONTEXT, legal_options, paths, line_of_sight
from game.gloomhaven import (_attack, _condition, _end_round, _end_turn, _exhaust, _heal, _hurt,
                             _monster_focus, _monster_turn, _pump, _reveal, _reveal_plans,
                             _start_round, _start_scenario, _draw_modifier)
from game.gloomhaven_data import CARDS, CLASSES
from game.gloomhaven_ai import choose_action


def make_state(count=2, start=True, seed=141, scenario=1, difficulty=0):
    state = Game.init_game({'seed': seed, 'scenario': scenario, 'difficulty': difficulty},
                           [{'player_id': f'p{i}', 'name': f'Mercenary {i}', 'seat': i} for i in range(count)])
    if start:
        for pid in state['turn_order']:
            act(state, pid, 'ready')
    return state


def action(state, kind, **fields):
    return {'type': kind, **fields, **{key: state[key] for key in CONTEXT}}


def act(state, pid, kind, **fields):
    events, error = Game.apply_action(state, pid, action(state, kind, **fields))
    if error:
        raise AssertionError((error, kind, fields, state['phase']))
    return events


def bot_step(state):
    for pid in state['turn_order']:
        move = Game.bot_move(state, pid)
        if move:
            move.pop('delay_ms')
            _, error = Game.apply_action(state, pid, move)
            if error:
                raise AssertionError(error)
            return move
    raise AssertionError(('no bot move', state['phase'], state['current']))


def force_turn(state, hero_id='h1', cards=None):
    h = state['heroes'][hero_id]
    cards = cards or h['hand'][:2]
    for cid in cards:
        for pile in ('hand', 'discard', 'lost', 'played'):
            if cid in h[pile]:
                h[pile].remove(cid)
    h.update(played=cards[:], used=[], plan={'rest': False}, initiative=10, secondary_initiative=20, turns=1)
    for other in state['heroes'].values():
        if other['id'] != hero_id:
            other.update(initiative=99, secondary_initiative=99)
    state.update(phase='acting', queue=[hero_id], queue_index=0, current=hero_id, current_turn=h['owner'], active=None, damage=None)
    return h


def assert_cards(test, state):
    if state['phase'] == 'setup':
        return
    for h in state['heroes'].values():
        test.assertEqual(Counter(h['deck']), Counter(h['hand'] + h['discard'] + h['lost'] + h['played']), h['id'])


class GloomhavenTests(unittest.TestCase):
    def test_setup_solo_two_heroes_and_class_capacities(self):
        s = make_state(1, start=False)
        self.assertEqual([h['owner'] for h in s['heroes'].values()], ['p0', 'p0'])
        act(s, 'p0', 'choose_class', hero_id='h1', class_id='spellweaver')
        act(s, 'p0', 'ready')
        self.assertEqual(s['heroes']['h1']['hp'], 6)
        self.assertEqual(len(s['heroes']['h1']['hand']), 8)
        for cid, spec in CLASSES.items():
            self.assertEqual(sum(c['class_id'] == cid for c in CARDS.values()), spec['hand'])

    def test_setup_controls_and_ready_wait(self):
        s = make_state(start=False)
        self.assertNotIn('configure', Game.get_legal_actions(s, 'p1'))
        act(s, 'p0', 'configure', scenario=2, difficulty=2)
        act(s, 'p0', 'ready')
        self.assertEqual(s['phase'], 'setup')
        self.assertIsNone(Game.bot_move(s, 'p0'))
        act(s, 'p1', 'ready')
        self.assertEqual((s['scenario'], s['difficulty'], s['phase']), (2, 2, 'planning'))

    def test_config_and_input_types(self):
        for cfg in ({'difficulty': True}, {'scenario': 4}, {'seed': []}, {'extra': 1}, []):
            with self.assertRaises(ValueError):
                Game.init_game(cfg, [{'player_id': 'a'}])
        for n in (0, 5):
            with self.assertRaises(ValueError):
                make_state(n)

    def test_plans_hidden_retractable_and_do_not_leak_events(self):
        s = make_state()
        cards = s['heroes']['h1']['hand'][:2]
        events = act(s, 'p0', 'plan', hero_id='h1', cards=cards)
        view = Game.get_public_view(s, 'p1')
        h = view['heroes'][0]
        self.assertEqual((h['hand'], h['played'], h['initiative']), ([], [], None))
        self.assertNotIn(cards[0], json.dumps(events))
        self.assertIsNone(Game.bot_move(s, 'p0'))
        act(s, 'p0', 'undo_plan', hero_id='h1')
        self.assertEqual(len(s['heroes']['h1']['hand']), 10)
        assert_cards(self, s)

    def test_no_hidden_rooms_seeds_or_modifier_order_in_views(self):
        s = make_state()
        for pid in ('p0', 'p1', 'spectator'):
            v = Game.get_public_view(s, pid)
            self.assertTrue(all(c['room'] == 1 for c in v['cells']))
            self.assertTrue(all(m['room'] == 1 for m in v['monsters']))
            self.assertNotIn('seed', v)
            self.assertNotIn('modifier', json.dumps(v))
            self.assertNotIn('obstacles', v['scenarios'][0])
        self.assertEqual(Game.get_public_view(s, 'spectator')['options'], [])

    def test_invalid_actions_atomic_and_stale(self):
        s = make_state()
        good = action(s, 'plan', hero_id='h1', cards=s['heroes']['h1']['hand'][:2])
        for patch in ({'hero_id': 'h2'}, {'cards': ['bad', 'bad']}, {'round': True}, {'revision': -1}, {'unknown': 1}, {'cards': [True, False]}):
            bad = {**good, **patch}
            before = copy.deepcopy(s)
            self.assertIsNotNone(Game.apply_action(s, 'p0', bad)[1])
            self.assertEqual(s, before)
        self.assertIsNone(Game.apply_action(s, 'p0', good)[1])
        self.assertIsNotNone(Game.apply_action(s, 'p0', good)[1])

    def test_top_bottom_and_different_card_constraints(self):
        s = make_state(); force_turn(s, cards=['brute_1', 'brute_2'])
        act(s, 'p0', 'half', hero_id='h1', card='brute_1', half='top', basic=True)
        act(s, 'p0', 'skip', hero_id='h1')
        halves = [o for o in legal_options(s, 'p0') if o['type'] == 'half']
        self.assertTrue(halves)
        self.assertTrue(all(o['half'] == 'bottom' and o['card'] == 'brute_2' for o in halves))
        assert_cards(self, s)

    def test_basic_action_does_not_burn_loss_card(self):
        s = make_state(); force_turn(s, cards=['brute_6', 'brute_2'])
        act(s, 'p0', 'half', hero_id='h1', card='brute_6', half='bottom', basic=True)
        move = next(o for o in legal_options(s, 'p0') if o['type'] == 'move')
        act(s, 'p0', 'move', **{k:v for k,v in move.items() if k != 'type'})
        if s['active']:
            act(s, 'p0', 'skip', hero_id='h1')
        self.assertIn('brute_6', s['heroes']['h1']['discard'])

    def test_attacks_loss_card_and_modifier_damage(self):
        s = make_state(); h = force_turn(s, cards=['brute_6','brute_2'])
        h['pos'] = [1,1]; h['modifier']['draw'] = [0]
        m = s['monsters']['m1_1']; m['hp'] = 20; m['max_hp'] = 20
        act(s,'p0','half',hero_id='h1',card='brute_6',half='top',basic=False)
        act(s,'p0','target',hero_id='h1',target=m['id'])
        self.assertEqual(s['monsters'][m['id']]['hp'], 14)
        self.assertIn('brute_6',s['heroes']['h1']['lost'])
        self.assertEqual(s['heroes']['h1']['xp'],2)
        self.assertEqual(s['last_attack']['target_name'],'强盗守卫 1')

    def test_movement_blockers_friendlies_and_closed_door(self):
        s=make_state();h=s['heroes']['h1'];h['pos']=[0,0]
        options=paths(s,h,5)
        self.assertNotIn((0,1),options)  # allied figure may be crossed, never occupied
        self.assertIn((0,2),options)
        self.assertNotIn((2,1),options)  # enemy
        self.assertNotIn((2,3),options)  # obstacle
        self.assertTrue(all(pos[0]<=4 for pos in options))
        self.assertEqual(distance_for_test([0,0],[1,-1]),1)

    def test_difficult_terrain_cost_and_jump(self):
        s=make_state();h=s['heroes']['h1'];h['pos']=[1,0]
        self.assertNotIn((2,0),paths(s,h,1))
        self.assertIn((2,0),paths(s,h,1,jump=True))
        self.assertNotIn((2,3),paths(s,h,9,jump=True))

    def test_open_door_reveals_and_adds_new_monsters(self):
        s=make_state();h=force_turn(s);h['pos']=[3,1]
        for m in s['monsters'].values():
            if m['room']==1:m['dead']=True
        act(s,'p0','half',hero_id='h1',card=h['played'][0],half='bottom',basic=True)
        act(s,'p0','move',hero_id='h1',q=4,r=1)
        self.assertEqual(s['revealed'],[1,2])
        self.assertTrue(all(m['id'] in s['queue'] for m in s['monsters'].values() if m['room']==2))
        self.assertIn('archer',s['monster_cards'])

    def test_trap_pauses_path_and_can_burn_hand(self):
        s=make_state();h=force_turn(s);h['pos']=[1,2]
        next(c for c in s['cells'] if c['q']==1 and c['r']==1)['terrain']='trap'
        act(s,'p0','half',hero_id='h1',card=h['played'][1],half='bottom',basic=True)
        act(s,'p0','move',hero_id='h1',q=1,r=1)
        self.assertEqual(s['damage']['amount'],2)
        h=s['heroes']['h1'];cid=h['hand'][0]
        act(s,'p0','damage',hero_id='h1',cards=[cid])
        self.assertEqual(s['heroes']['h1']['hp'],10)
        self.assertIn(cid,s['heroes']['h1']['lost'])
        assert_cards(self,s)

    def test_selected_cards_cannot_negate_damage(self):
        s=make_state();h=force_turn(s)
        _hurt(s,h,3,'test')
        self.assertTrue(all(cid not in h['played'] for o in legal_options(s,'p0') for cid in o.get('cards',[])))
        self.assertEqual(legal_options(s,'p1'),[])

    def test_discard_two_negates_even_with_condition(self):
        s=make_state();h=force_turn(s);h['discard']=h['hand'][:2];del h['hand'][:2]
        _condition(h,'poison');_hurt(s,h,4,'test')
        act(s,'p0','damage',hero_id='h1',cards=h['discard'][:])
        self.assertEqual(s['heroes']['h1']['hp'],10)
        self.assertIn('poison',s['heroes']['h1']['conditions'])
        assert_cards(self,s)

    def test_poison_and_wound_healing(self):
        s=make_state();h=s['heroes']['h1'];h['hp']=3
        _condition(h,'poison');_condition(h,'wound');_heal(s,h,4)
        self.assertEqual(h['hp'],3);self.assertEqual(h['conditions'],{})
        _heal(s,h,20);self.assertEqual(h['hp'],10)

    def test_conditions_expire_after_correct_turn(self):
        s=make_state();h=force_turn(s);_condition(h,'strengthen')
        _end_turn(s,h);self.assertIn('strengthen',h['conditions'])
        h['turns']+=1;_end_turn(s,h);self.assertNotIn('strengthen',h['conditions'])
        _condition(h,'wound');h['turns']+=10;_end_turn(s,h);self.assertIn('wound',h['conditions'])

    def test_shield_pierce_poison_and_disadvantage(self):
        s=make_state();h=s['heroes']['h1'];h['pos']=[1,1]
        m=s['monsters']['m1_1'];m['hp']=20;m['shield']=3;_condition(m,'poison')
        h['modifier']['draw']=[2,-1]
        _attack(s,h,m,{'value':3,'range':3,'pierce':2})
        self.assertEqual(s['last_attack']['damage'],2)
        self.assertEqual(s['last_attack']['drawn'],[-1,2])
        self.assertEqual(m['hp'],18)

    def test_attack_modifier_deck_distribution_and_shuffle(self):
        s=make_state();deck=s['heroes']['h1']['modifier']
        self.assertEqual(Counter(deck['draw']),Counter([0]*6+[1]*5+[-1]*5+[2,-2,'miss','double']))
        deck['draw']=['double'];deck['discard']=[0]
        self.assertEqual(_draw_modifier(s,deck),'double');self.assertTrue(deck['shuffle'])
        _end_round(s);self.assertFalse(deck['shuffle']);self.assertEqual(len(deck['draw']),2)

    def test_elements_generated_at_end_and_decay(self):
        s=make_state();h=force_turn(s);h['infusions']=['fire']
        self.assertEqual(s['elements']['fire'],0)
        _end_turn(s,h);self.assertEqual(s['elements']['fire'],2)
        _end_round(s);self.assertEqual(s['elements']['fire'],1)
        _end_round(s);self.assertEqual(s['elements']['fire'],0)

    def test_short_rest_redraw_not_same_and_only_once(self):
        s=make_state();h=s['heroes']['h1'];h['discard']=h['hand'][:4];del h['hand'][:4]
        s['phase']='round_review';act(s,'p0','short_rest',hero_id='h1')
        first=s['heroes']['h1']['rest_pending']['card']
        self.assertNotIn('next_round',Game.get_legal_actions(s,'p0'))
        act(s,'p0','rest_redraw',hero_id='h1');second=s['heroes']['h1']['rest_pending']['card']
        self.assertNotEqual(first,second);act(s,'p0','damage',hero_id='h1',cards=[])
        self.assertNotIn('rest_redraw',Game.get_legal_actions(s,'p0'))
        act(s,'p0','rest_accept',hero_id='h1')
        self.assertEqual(s['heroes']['h1']['lost'],[second]);self.assertEqual(s['heroes']['h1']['hp'],9)
        self.assertNotIn('short_rest',Game.get_legal_actions(s,'p0'));assert_cards(self,s)

    def test_long_rest_heals_and_refreshes_only_spent_item(self):
        s=make_state();h=force_turn(s);h['discard']=h['hand'][:3];del h['hand'][:3]
        h['plan']={'rest':True};h['hp']=4;h['items']={'potion':'lost','boots':'spent'}
        cid=h['discard'][0];act(s,'p0','rest_lose',hero_id='h1',card=cid)
        h=s['heroes']['h1'];self.assertEqual(h['hp'],6);self.assertEqual(h['items'],{'potion':'lost','boots':'ready'})
        self.assertIn(cid,h['lost']);assert_cards(self,s)

    def test_insufficient_cards_exhaust_and_all_fail(self):
        s=make_state()
        for h in s['heroes'].values():
            h['lost']=h['hand'][1:];h['hand']=h['hand'][:1]
        _start_round(s);self.assertEqual(s['phase'],'scenario_review');self.assertFalse(s['result']['won'])
        assert_cards(self,s)

    def test_round_barrier_requires_every_owner_including_exhausted(self):
        s=make_state();s['phase']='round_review';_exhaust(s,s['heroes']['h2'])
        act(s,'p0','next_round');self.assertEqual(s['round'],1)
        self.assertEqual(Game.get_legal_actions(s,'p0'),[])
        act(s,'p1','next_round');self.assertEqual(s['round'],2)

    def test_victory_progress_retry_final_and_resources_reset(self):
        s=make_state()
        for m in s['monsters'].values():m['dead']=True
        _end_round(s);self.assertTrue(s['result']['won'])
        act(s,'p0','continue');self.assertEqual(s['scenario'],1)
        act(s,'p1','continue');self.assertEqual(s['scenario'],2)
        self.assertEqual(s['scenario_attempt'],2);self.assertTrue(all(h['hp']==h['max_hp'] for h in s['heroes'].values()))
        for h in s['heroes'].values():_exhaust(s,h)
        s['phase']='acting';_pump(s)
        for pid in s['turn_order']:act(s,pid,'continue')
        self.assertEqual(s['scenario'],2);self.assertEqual(s['scenario_attempt'],3)
        s['scenario']=3
        for m in s['monsters'].values():m['dead']=True
        _end_round(s);self.assertTrue(s['game_over']);self.assertEqual(s['winner_ids'],['p0','p1'])

    def test_closed_door_blocks_line_of_sight_obstacles_do_not(self):
        s=make_state();self.assertFalse(line_of_sight(s,[3,1],[5,1]))
        s['revealed']=[1,2];next(c for c in s['cells'] if c['terrain']=='door')['open']=True
        self.assertTrue(line_of_sight(s,[3,1],[5,1]))

    def test_monster_focus_and_no_move_card(self):
        s=make_state();h=force_turn(s);h['pos']=[1,1]
        s['heroes']['h2']['pos']=[1,2];s['heroes']['h2']['initiative']=20
        m=s['monsters']['m1_1'];self.assertEqual(_monster_focus(s,m,1)[0]['id'],'h1')
        s['monster_cards']['guard']={'initiative':30,'move':None,'attack':0}
        h['pos']=[0,0];s['heroes']['h2']['pos']=[0,2];before=m['pos'][:]
        _monster_turn(s,m);self.assertEqual(m['pos'],before)

    def test_json_roundtrip_and_public_bot_cannot_see_hidden_decks(self):
        s=make_state();v=Game.get_public_view(s,'p0');expected=choose_action(v)
        changed=copy.deepcopy(s);changed['seed']='unrelated';changed['monster_modifier']['draw'].reverse()
        changed['heroes']['h2']['hand'].reverse()
        self.assertEqual(choose_action(Game.get_public_view(changed,'p0')),expected)
        restored=Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(s,restored)
        bot_step(s);bot_step(restored);self.assertEqual(s,restored)

    def test_initiative_tie_player_precedes_monsters_and_secondary_card_breaks_tie(self):
        s=make_state()
        s['monster_decks']['guard']['draw']=[3]  # initiative 15
        act(s,'p0','plan',hero_id='h1',cards=['brute_1','brute_2'])
        act(s,'p1','plan',hero_id='h2',cards=['tinkerer_2','tinkerer_1'])
        self.assertEqual(s['queue'][0],'h1')
        self.assertTrue(s['queue'].index('m1_1')<s['queue'].index('h2'))
        s=make_state();s['heroes']['h1']['class_id']='scoundrel';s['heroes']['h2']['class_id']='mindthief';_start_scenario(s)
        act(s,'p0','plan',hero_id='h1',cards=['scoundrel_2','scoundrel_1'])
        act(s,'p1','plan',hero_id='h2',cards=['mindthief_4','mindthief_1'])
        self.assertEqual(s['queue'][:2],['h1','h2'])

    def test_recovery_cannot_recover_itself_and_element_consumption_once(self):
        s=make_state();s['heroes']['h1']['class_id']='spellweaver';_start_scenario(s)
        h=force_turn(s,cards=['spellweaver_5','spellweaver_2'])
        lost=h['hand'][:3];h['lost']=lost[:];del h['hand'][:3]
        act(s,'p0','half',hero_id='h1',card='spellweaver_5',half='top',basic=False)
        h=s['heroes']['h1'];self.assertTrue(all(c in h['hand'] for c in lost))
        self.assertEqual(h['lost'],['spellweaver_5']);assert_cards(self,s)
        force_turn(s,cards=['spellweaver_4','spellweaver_2']);s['elements']['fire']=1
        act(s,'p0','half',hero_id='h1',card='spellweaver_4',half='top',basic=False)
        act(s,'p0','consume',hero_id='h1')
        self.assertEqual(s['elements']['fire'],0);self.assertEqual(s['active']['effects'][0]['value'],4)
        self.assertNotIn('consume',Game.get_legal_actions(s,'p0'))

    def test_stunned_monster_cannot_gain_ability_shield(self):
        s=make_state();force_turn(s);m=s['monsters']['m1_1'];_condition(m,'stun')
        s['monster_cards']['guard']={'initiative':30,'move':None,'attack':0,'shield':1}
        _monster_turn(s,m);self.assertEqual(m['round_shield'],0)

    def test_full_standard_series_for_all_player_counts(self):
        for n in (1,2,3,4):
            with self.subTest(players=n):
                s=make_state(n,seed=141,difficulty=1)
                for step in range(1600):
                    if s['game_over']:break
                    bot_step(s);assert_cards(self,s)
                self.assertTrue(s['game_over'])
                self.assertEqual([r['scenario'] for r in s['results']],[1,2,3])
                self.assertTrue(all(r['won'] for r in s['results']))

    def test_all_party_sizes_and_scenarios_finish_with_conserved_cards(self):
        for n in (1,2,3,4):
            for scenario in (1,2,3):
                with self.subTest(players=n,scenario=scenario):
                    s=make_state(n,seed=141+n,scenario=scenario)
                    for step in range(1000):
                        if s['phase'] in ('scenario_review','game_over'):break
                        bot_step(s);assert_cards(self,s)
                    self.assertLess(step,999)
                    self.assertIsNotNone(s['result'])
                    self.assertTrue(s['result']['won'])


def distance_for_test(a,b):
    from game.gloomhaven import distance
    return distance(a,b)


if __name__=='__main__':
    unittest.main()
