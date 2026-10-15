import copy
import json
import unittest
from unittest.mock import patch

from game.dnd_starter_set import DndStarterSetGame as Game, _begin_turn, _d20, _hurt, _map, _paths
from game.dnd_starter_set_data import SCENES


def action(state, action_type, **fields):
    return dict(type=action_type, game_instance_id=state['game_instance_id'], window_id=state['window_id'], **fields)


def act(state, pid, action_type, **fields):
    events, error = Game.apply_action(state, pid, action(state, action_type, **fields))
    if error:
        raise AssertionError(f'{pid} {action_type}: {error}')
    return events


def make_state(classes=('fighter', 'cleric'), start=True, bots=False):
    players = [{'player_id': 'dm', 'name': '地下城主', 'seat': 0}]
    players += [{'player_id': f'p{i}', 'name': f'冒险者 {i}', 'seat': i+1, 'is_bot': bots} for i in range(len(classes))]
    s = Game.init_game({'seed': 157}, players)
    if start:
        for i, cls in enumerate(classes):
            act(s, f'p{i}', 'choose', class_id=cls, species='human', background='sage')
            act(s, f'p{i}', 'ready')
        act(s, 'dm', 'ready')
    return s


def combat(s, actor='p0'):
    act(s, 'dm', 'travel', scene='trail')
    act(s, 'dm', 'encounter')
    force_turn(s, actor)
    return s


def force_turn(s, uid):
    s['initiative'] = [{'id': uid, 'total': 30}] + [r for r in s['initiative'] if r['id'] != uid]
    s['turn_index'] = 0
    s['phase'] = 'combat'
    _begin_turn(s)


def next_all(s):
    for pid in s['players']:
        act(s, pid, 'next_round')


class BorderlandsTests(unittest.TestCase):
    def reject(self, s, pid, action_type, **fields):
        before = copy.deepcopy(s)
        events, error = Game.apply_action(s, pid, action(s, action_type, **fields))
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(s, before)

    def test_setup_unique_classes_and_all_ready(self):
        s = make_state(start=False)
        self.reject(s, 'p0', 'ready')
        self.reject(s, 'dm', 'choose', class_id='wizard', species='elf', background='sage')
        act(s, 'p0', 'choose', class_id='fighter', species='dwarf', background='soldier')
        self.assertEqual(s['heroes']['p0']['max_hp'], 13)
        self.reject(s, 'p1', 'choose', class_id='fighter', species='human', background='sage')
        act(s, 'p1', 'choose', class_id='wizard', species='elf', background='sage')
        act(s, 'p0', 'ready'); act(s, 'p1', 'ready')
        self.assertEqual(s['phase'], 'setup')
        self.reject(s, 'p0', 'choose', class_id='rogue', species='elf', background='sage')
        act(s, 'dm', 'ready')
        self.assertEqual(s['phase'], 'exploration')

    def test_dm_cannot_be_bot_and_player_bounds(self):
        for count in (0, 1, 2, 6):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{'player_id': str(i)} for i in range(count)])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{'player_id': str(i), 'seat': i, 'is_bot': True} for i in range(3)])

    def test_private_notes_dc_seed_and_monster_stats(self):
        s = make_state()
        act(s, 'dm', 'note', text='ONLY_DM_SECRET')
        act(s, 'dm', 'request_check', target='p0', ability='perception', kind='check', dc=17, mode=1)
        for viewer in ('p0', 'p1', 'outsider'):
            v = Game.get_public_view(s, viewer)
            self.assertNotIn('ONLY_DM_SECRET', json.dumps(v))
            self.assertNotIn('dm_scene', v)
            self.assertNotIn('seed', v)
            self.assertNotIn('dc', v['pending_check'])
        self.assertEqual(Game.get_public_view(s, 'dm')['pending_check']['dc'], 17)
        act(s, 'dm', 'cancel_check'); combat(s)
        m = Game.get_public_view(s, 'p0')['monsters'][0]
        self.assertNotIn('hp', m); self.assertNotIn('ac', m); self.assertNotIn('damage', m)
        v = Game.get_public_view(s, 'p0'); v['heroes'][0]['hp'] = 500
        self.assertNotEqual(s['heroes']['p0']['hp'], 500)

    def test_permissions_and_malformed_are_atomic(self):
        s = make_state()
        self.reject(s, 'p0', 'travel', scene='trail')
        self.reject(s, 'outsider', 'narrate', text='oops')
        self.reject(s, 'p0', 'adjust_hp', target='p1', delta=10, reason='oops')
        for changes in ({'window_id': True}, {'game_instance_id': 'old'}, {'window_id': 99}, {'extra': 1}):
            before = copy.deepcopy(s)
            _, error = Game.apply_action(s, 'dm', {**action(s, 'note', text='secret'), **changes})
            self.assertTrue(error); self.assertEqual(s, before)
        combat(s)
        self.reject(s, 'p1', 'end_turn')
        self.reject(s, 'p0', 'attack', target='missing', weapon='longsword')
        self.reject(s, 'p0', 'attack', target='m1', weapon='monster')
        self.reject(s, 'p0', 'move', x=True, y=2)

    def test_check_uses_proficiency_and_not_natural_20_autosuccess(self):
        s = make_state(('rogue', 'wizard'))
        act(s, 'dm', 'request_check', target='p0', ability='stealth', kind='check', dc=30, mode=1)
        self.reject(s, 'p1', 'roll_check')
        self.reject(s, 'dm', 'travel', scene='trail')
        with patch('game.dnd_starter_set._die', side_effect=[20, 2]):
            act(s, 'p0', 'roll_check')
        self.assertIn('27 / DC 30，失败', s['history'][-1]['text'])
        self.reject(s, 'dm', 'request_check', target='p0', ability='stealth', kind='save', dc=10, mode=0)

    def test_combat_dm_check_pauses_actions_and_resumes_same_turn(self):
        s = combat(make_state())
        act(s, 'dm', 'request_check', target='p1', ability='wis', kind='save', dc=12, mode=0)
        self.reject(s, 'p0', 'end_turn')
        self.reject(s, 'dm', 'adjust_hp', target='p0', delta=1, reason='wait')
        restored = Game.deserialize(json.loads(json.dumps(s)))
        self.assertEqual(restored, s)
        act(s, 'p1', 'roll_check')
        self.assertEqual(s['current_turn'], 'p0')
        act(s, 'p0', 'end_turn')

    def test_poisoned_check_and_stunned_save(self):
        s = make_state()
        act(s, 'dm', 'condition', target='p0', condition='poisoned', enabled=True)
        act(s, 'dm', 'request_check', target='p0', ability='str', kind='check', dc=10, mode=0)
        with patch('game.dnd_starter_set._die', side_effect=[20, 1]):
            act(s, 'p0', 'roll_check')
        self.assertIn('4 / DC 10，失败', s['history'][-1]['text'])
        act(s, 'dm', 'condition', target='p0', condition='stunned', enabled=True)
        act(s, 'dm', 'request_check', target='p0', ability='str', kind='save', dc=10, mode=0)
        with patch('game.dnd_starter_set._die', return_value=20):
            act(s, 'p0', 'roll_check')
        self.assertIn('失败', s['history'][-1]['text'])

    def test_halfling_luck_rerolls_once(self):
        s = make_state(); h = s['heroes']['p0']; h['species'] = 'halfling'
        with patch('game.dnd_starter_set._die', side_effect=[1, 1]):
            self.assertEqual(_d20(s, h), (1, [1]))
        with patch('game.dnd_starter_set._die', side_effect=[1, 15, 19]):
            self.assertEqual(_d20(s, h, 1), (19, [19, 15]))

    def test_critical_damage_doubles_only_dice_and_action_spent(self):
        s = combat(make_state()); s['heroes']['p0']['pos'] = [6, 2]
        s['monsters']['m1']['hp'] = s['monsters']['m1']['max_hp'] = 40
        with patch('game.dnd_starter_set._die', side_effect=[20, 4, 5]):
            act(s, 'p0', 'attack', target='m1', weapon='longsword')
        self.assertEqual(s['monsters']['m1']['hp'], 28)
        self.reject(s, 'p0', 'attack', target='m1', weapon='longsword')

    def test_natural_one_misses_and_invalid_range_rolls_nothing(self):
        s = combat(make_state()); self.reject(s, 'p0', 'attack', target='m1', weapon='longsword')
        s['heroes']['p0']['pos'] = [6, 2]
        with patch('game.dnd_starter_set._die', return_value=1):
            act(s, 'p0', 'attack', target='m1', weapon='longsword')
        self.assertEqual(s['monsters']['m1']['hp'], 7)

    def test_movement_walls_rough_and_occupancy(self):
        s = combat(make_state()); h = s['heroes']['p0']; s['map'] = _map('fens')
        h['pos'] = [2, 1]; h['move_left'] = 2
        paths = _paths(s, h)
        self.assertEqual(paths[(3, 1)]['cost'], 2)
        self.assertNotIn((4, 1), paths)
        self.reject(s, 'p0', 'move', x=7, y=2)
        act(s, 'p0', 'move', x=3, y=1)
        self.assertEqual(s['heroes']['p0']['move_left'], 0)

    def test_disengage_prevents_opportunity_attack(self):
        for disengage in (False, True):
            s = combat(make_state()); s['heroes']['p0']['pos'] = [6, 2]
            if disengage: act(s, 'p0', 'disengage')
            with patch('game.dnd_starter_set._die', return_value=1):
                act(s, 'p0', 'move', x=5, y=2)
            self.assertEqual(s['monsters']['m1']['reaction'], disengage)
            self.assertEqual(s['heroes']['p0']['pos'], [5, 2])

    def test_downing_opportunity_interrupts_move(self):
        s = combat(make_state()); s['heroes']['p0']['pos']=[6,2];s['heroes']['p0']['hp']=1
        with patch('game.dnd_starter_set._die', side_effect=[20, 2, 2]):
            act(s,'p0','move',x=5,y=2)
        self.assertEqual(s['heroes']['p0']['pos'],[6,2]);self.assertEqual(s['heroes']['p0']['hp'],0)
        self.assertNotEqual(s['actor'],'p0')

    def test_sneak_attack_with_adjacent_ally(self):
        s = combat(make_state(('rogue','fighter'))); s['heroes']['p0']['pos']=[6,2];s['heroes']['p1']['pos']=[7,1]
        s['monsters']['m1']['hp']=s['monsters']['m1']['max_hp']=30
        with patch('game.dnd_starter_set._die', side_effect=[15,3,4]):
            act(s,'p0','attack',target='m1',weapon='shortsword')
        self.assertEqual(s['monsters']['m1']['hp'],20);self.assertTrue(s['heroes']['p0']['sneak_used'])

    def test_round_barrier_includes_dm_and_rejects_duplicates(self):
        s = combat(make_state())
        while s['phase']=='combat': act(s,s['current_turn'],'end_turn')
        self.assertEqual(s['phase'],'round_review'); self.assertEqual(s['round'],1)
        old=action(s,'next_round');act(s,'p0','next_round')
        self.reject(s,'p0','next_round');act(s,'p1','next_round')
        self.assertEqual(s['round'],1);act(s,'dm','next_round');self.assertEqual(s['round'],2)
        before=copy.deepcopy(s);self.assertTrue(Game.apply_action(s,'p0',old)[1]);self.assertEqual(before,s)

    def test_spells_2024_healing_bonus_and_slot_limit(self):
        s = combat(make_state(('cleric','wizard')));s['heroes']['p1']['hp']=1
        with patch('game.dnd_starter_set._die', return_value=2):
            act(s,'p0','cast',spell='healing_word',target='p1',slot=1)
        self.assertEqual(s['heroes']['p1']['hp'],8);self.assertEqual(s['heroes']['p0']['action_left'],1)
        self.assertEqual(s['heroes']['p0']['bonus_left'],0)
        self.reject(s,'p0','cast',spell='guiding_bolt',target='m1',slot=1)
        with patch('game.dnd_starter_set._die', return_value=1):
            act(s,'p0','cast',spell='sacred_flame',target='m1',slot=0)
        self.assertEqual(s['heroes']['p0']['slots'],[1,0])

    def test_spell_resources_not_spent_on_bad_target(self):
        s = combat(make_state(('wizard','cleric')))
        self.reject(s,'p0','cast',spell='cure_wounds',target='p1',slot=1)
        self.reject(s,'p0','cast',spell='magic_missile',target='p1',slot=1)
        self.reject(s,'p0','cast',spell='fire_bolt',target='m1',slot=1)
        self.reject(s,'p0','cast',spell='scorching_ray',target='m1',slot=2)
        with patch('game.dnd_starter_set._die',return_value=1):act(s,'p0','cast',spell='magic_missile',target='m1',slot=1)
        self.assertEqual(s['monsters']['m1']['hp'],1)

    def test_manual_concentration_and_damage_save(self):
        s = make_state(('wizard','cleric'))
        act(s,'p0','cast',spell='sleep',target='p0',slot=1)
        self.assertEqual(s['heroes']['p0']['concentration'],'sleep');self.assertIn('DM 裁定',s['history'][-1]['text'])
        with patch('game.dnd_starter_set._die',return_value=1):act(s,'dm','adjust_hp',target='p0',delta=-1,reason='落石')
        self.assertIsNone(s['heroes']['p0']['concentration'])

    def test_guiding_bolt_survives_caster_end_then_consumed(self):
        s=combat(make_state(('cleric','fighter')));s['monsters']['m1']['hp']=s['monsters']['m1']['max_hp']=50
        with patch('game.dnd_starter_set._die',side_effect=[15,1,1,1,1]):act(s,'p0','cast',spell='guiding_bolt',target='m1',slot=1)
        act(s,'p0','end_turn');self.assertTrue(s['monsters']['m1']['guiding'])
        force_turn(s,'p1')
        with patch('game.dnd_starter_set._die',side_effect=[2,15,1]):act(s,'p1','attack',target='m1',weapon='light_crossbow')
        self.assertIsNone(s['monsters']['m1']['guiding'])

    def test_death_saves_critical_and_healing(self):
        s = combat(make_state());h=s['heroes']['p0'];_hurt(s,h,12)
        self.assertEqual(h['hp'],0);self.assertIn('prone',h['conditions'])
        with patch('game.dnd_starter_set._die',return_value=1):force_turn(s,'p0')
        self.assertEqual(h['death_fail'],2)
        with patch('game.dnd_starter_set._die',return_value=20):force_turn(s,'p0')
        self.assertEqual(h['hp'],1);self.assertEqual(h['death_fail'],0)
        _hurt(s,h,100);self.assertTrue(h['dead'])
        self.reject(s,'dm','adjust_hp',target='p0',delta=10,reason='普通治疗不能复活')

    def test_potion_uses_bonus_stabilize_uses_action(self):
        s=combat(make_state());s['heroes']['p1'].update(hp=0,death_fail=2)
        with patch('game.dnd_starter_set._die',return_value=15):act(s,'p0','stabilize',target='p1')
        self.assertTrue(s['heroes']['p1']['stable']);self.assertEqual(s['heroes']['p0']['action_left'],0)
        with patch('game.dnd_starter_set._die',return_value=1):act(s,'p0','potion',target='p1')
        self.assertEqual(s['heroes']['p1']['hp'],4);self.assertEqual(s['heroes']['p0']['bonus_left'],0)
        self.assertEqual(s['heroes']['p0']['potions'],0)

    def test_rest_levels_and_purchases(self):
        s=make_state();act(s,'dm','level_up');act(s,'dm','level_up');self.reject(s,'dm','level_up')
        self.assertEqual(s['heroes']['p1']['slots'],[4,2])
        s['heroes']['p0']['hp']=1;act(s,'p0','rest',kind='short')
        self.assertEqual(s['heroes']['p0']['hit_dice'],2)
        act(s,'dm','rest',kind='long');self.assertEqual(s['heroes']['p0']['hit_dice'],3)
        self.reject(s,'dm','rest',kind='long');self.reject(s,'p0','rest',kind='long')
        act(s,'dm','travel',scene='market');act(s,'p0','buy_potion');self.assertEqual(s['gold'],0)
        self.reject(s,'p1','buy_potion');act(s,'dm','travel',scene='keep');act(s,'dm','travel',scene='trail')
        self.reject(s,'dm','rest',kind='long')

    def test_defeat_and_victory_pause_before_game_end(self):
        s=combat(make_state())
        for pid in ('p0','p1'):act(s,'dm','adjust_hp',target=pid,delta=-100,reason='测试裁定')
        self.assertEqual(s['phase'],'encounter_review');self.assertFalse(s['game_over'])
        next_all(s);self.assertTrue(s['game_over']);self.assertEqual(s['winner_ids'],[])
        s=make_state();act(s,'dm','travel',scene='tavern');act(s,'dm','resolve',outcome='peace',reason='说服旅人提供情报')
        self.assertEqual(s['gold'],60);next_all(s);self.reject(s,'dm','resolve',outcome='peace',reason='重复奖励')
        act(s,'dm','travel',scene='keep');act(s,'dm','finish',reason='带着新朋友归来');next_all(s)
        self.assertEqual(set(s['winner_ids']),set(s['players']))

    def test_three_regions_return_and_persistent_rewards(self):
        s=make_state()
        for route in ('trail','woods','tamarack','fens','caves','cave_goblin'):
            act(s,'dm','travel',scene=route)
            if SCENES[route]['reward']:
                act(s,'dm','resolve',outcome='peace',reason='谈判与探索成功');next_all(s)
        act(s,'dm','travel',scene='caves');act(s,'dm','travel',scene='keep')
        act(s,'dm','finish',reason='完成边陲探索');next_all(s)
        self.assertEqual(len(s['completed']),5);self.assertEqual(s['phase'],'game_over')

    def test_save_roundtrip_preserves_random_stream_and_validates(self):
        s=combat(make_state());saved=json.loads(json.dumps(Game.serialize(s)));restored=Game.deserialize(saved)
        self.assertEqual(s,restored)
        for pid in ('dm','p0','outsider'):self.assertEqual(Game.get_public_view(s,pid),Game.get_public_view(restored,pid))
        for target in (s,restored):
            act(target,'p0','attack',target='m1',weapon='light_crossbow')
        self.assertEqual(s,restored)
        for field,value in (('version',99),('phase','oops'),('dm','outsider')):
            bad=copy.deepcopy(saved);bad[field]=value
            with self.assertRaises(ValueError):Game.deserialize(bad)

    def test_bots_setup_act_and_wait_for_dm(self):
        for count in (2,3,4):
            s=make_state(tuple(['fighter','cleric','rogue','wizard'][:count]),start=False,bots=True)
            for pid in list(s['players'])[1:]:
                for _ in range(2):
                    command=Game.bot_move(s,pid);self.assertIsNotNone(command)
                    self.assertIsNone(Game.apply_action(s,pid,command)[1])
            act(s,'dm','ready');act(s,'dm','travel',scene='trail');act(s,'dm','encounter')
            for _ in range(100):
                if s['phase']!='combat':break
                if s['current_turn']=='dm':act(s,'dm','end_turn')
                else:
                    command=Game.bot_move(s,s['current_turn']);self.assertIsNotNone(command)
                    self.assertIsNone(Game.apply_action(s,s['current_turn'],command)[1])
                Game.deserialize(json.loads(json.dumps(s)))
            self.assertIn(s['phase'],('round_review','encounter_review'))
            for pid in list(s['players'])[1:]:self.assertIsNone(Game.apply_action(s,pid,Game.bot_move(s,pid))[1])
            self.assertNotIn('dm',s['ready']);self.assertFalse(s['game_over'])


if __name__=='__main__':unittest.main()
