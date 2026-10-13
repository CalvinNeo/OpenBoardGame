import copy
import json
import unittest
from collections import Counter

from game.night_of_the_ninja import CARDS, PHASES, NightOfTheNinjaGame as Game
from game.night_of_the_ninja import _score, _start_reveal, _next_card


def make_state(n=4, seed=146):
    return Game.init_game({'seed': seed}, [{'player_id': f'p{i}', 'name': f'Ninja {i}', 'seat': i} for i in range(n)])


def action(s, kind, **kw):
    return {'type': kind, 'game_token': s['game_token'], 'window_id': s['window_id'], **kw}


def apply(s, pid, kind, **kw):
    events, error = Game.apply_action(s, pid, action(s, kind, **kw))
    if error:
        raise AssertionError((kind, kw, error))
    return events


def activate(s, card, actor='p0', hands=None):
    for p in s['players'].values():
        p['hand'], p['packet'] = [], []
    for pid, hand in (hands or {}).items():
        s['players'][pid]['hand'] = hand[:]
    entry = {'player_id': actor, 'card_id': card, 'status': 'queued', 'recovered': False}
    s.update(table=[entry], queue=[entry], night_index=PHASES.index(CARDS[card]['phase']), submissions={})
    _next_card(s)


def house(s, pid, clan, rank):
    s['players'][pid].update(house={'clan': clan, 'rank': rank}, remembered_house={'clan': clan, 'rank': rank})


class NinjaTests(unittest.TestCase):
    def test_setup_and_full_deck(self):
        self.assertEqual(len(CARDS), 33)
        for n in range(4, 12):
            s = make_state(n)
            self.assertEqual(Counter(p['house']['clan'] for p in s['players'].values()),
                             Counter({'crane': n//2, 'lotus': n//2, **({'ronin': 1} if n%2 else {})}))
            self.assertEqual(sum(len(p['packet']) for p in s['players'].values()) + len(s['undealt']), 33)
        for n in [0, 3, 12]:
            with self.assertRaises(ValueError):
                make_state(n)

    def test_draft_is_simultaneous_and_passes_left(self):
        s = make_state()
        old = copy.deepcopy(s)
        window = s['window_id']
        packets = {pid: p['packet'][:] for pid, p in s['players'].items()}
        for pid in s['turn_order']:
            apply(s, pid, 'draft', card_id=packets[pid][0])
            if pid != 'p3':
                self.assertEqual(s['window_id'], window)
                self.assertEqual(s['players'][pid]['packet'], packets[pid])
        for i in range(4):
            self.assertEqual(s['players'][f'p{(i+1)%4}']['packet'], packets[f'p{i}'][1:])
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, 'p0', action(old, 'draft', card_id=packets['p0'][0]))[1])
        self.assertEqual(before, s)
        for pid in s['turn_order']:
            apply(s, pid, 'draft', card_id=s['players'][pid]['packet'][0])
        self.assertEqual(len(s['discard']), 4)
        self.assertTrue(all(len(p['hand']) == 2 for p in s['players'].values()))
        self.assertEqual(s['phase'], 'reveal')

    def test_reveal_order_and_optional_skip(self):
        s = make_state()
        for p in s['players'].values():
            p['hand'] = []
        s['players']['p0']['hand'] = ['spy_6', 'spy_1']
        s['players']['p1']['hand'] = ['spy_3']
        _start_reveal(s)
        for pid, cards in [('p0', ['spy_6', 'spy_1']), ('p1', []), ('p2', []), ('p3', [])]:
            apply(s, pid, 'reveal', card_ids=cards)
        self.assertEqual(s['active']['card_id'], 'spy_1')
        self.assertEqual(s['queue'][0]['card_id'], 'spy_6')
        self.assertIn('spy_3', s['players']['p1']['hand'])

    def test_private_spy_and_mystic(self):
        for card in ['spy_1', 'mystic_1']:
            s = make_state()
            activate(s, card, hands={'p1': ['mastermind']})
            apply(s, 'p0', 'target', targets=['p1'])
            v = Game.get_public_view(s, 'p0')
            self.assertEqual(v['pending']['observations'][0]['house'], s['players']['p1']['house'])
            if card == 'mystic_1':
                self.assertEqual(v['pending']['seen_card'], 'mastermind')
            for viewer in ['p1', 'p2', 'guest']:
                self.assertIsNone(Game.get_public_view(s, viewer)['pending'])
            apply(s, 'p0', 'decide', choice='continue')

    def test_shapeshifter_keep_and_swap_have_same_public_effect(self):
        s = make_state()
        activate(s, 'shapeshifter_1')
        apply(s, 'p0', 'target', targets=['p1', 'p2'])
        s2 = copy.deepcopy(s)
        previous = copy.deepcopy(s['players']['p1']['house'])
        apply(s, 'p0', 'decide', choice='swap')
        apply(s2, 'p0', 'decide', choice='keep')
        for viewer in ['p1', 'p2', 'p3', 'guest']:
            self.assertEqual(Game.get_public_view(s, viewer), Game.get_public_view(s2, viewer))
        self.assertEqual(Game.get_public_view(s, 'p1')['your_house'], previous)
        self.assertTrue(Game.get_public_view(s, 'p1')['house_uncertain'])
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(Game.get_public_view(s, 'p1'), Game.get_public_view(restored, 'p1'))

    def test_troublemaker_can_reveal(self):
        s = make_state()
        activate(s, 'troublemaker_3')
        apply(s, 'p0', 'target', targets=['p1'])
        self.assertIsNone(Game.get_public_view(s, 'p2')['players'][1]['house'])
        apply(s, 'p0', 'decide', choice='reveal')
        self.assertEqual(Game.get_public_view(s, 'p2')['players'][1]['house'], s['players']['p1']['house'])

    def test_shinobi_spare_and_reaction_choices(self):
        for reaction in ['accept', 'mirror_monk', 'martyr']:
            s = make_state()
            activate(s, 'shinobi_1', hands={'p1': ['mirror_monk', 'martyr']})
            apply(s, 'p0', 'target', targets=['p1'])
            self.assertEqual(s['phase'], 'decide')
            apply(s, 'p0', 'decide', choice='kill')
            self.assertEqual(s['current_turn'], 'p1')
            apply(s, 'p1', 'react', choice=reaction)
            self.assertEqual(s['players']['p1']['alive'], reaction == 'mirror_monk')
            self.assertEqual(s['players']['p0']['alive'], reaction != 'mirror_monk')
            self.assertEqual(len(s['players']['p1']['honor']), int(reaction == 'martyr'))
        s = make_state()
        activate(s, 'shinobi_1')
        apply(s, 'p0', 'target', targets=['p1'])
        apply(s, 'p0', 'decide', choice='spare')
        self.assertTrue(s['players']['p1']['alive'])

    def test_judge_ignores_reactions_and_skips_dead_queued_actor(self):
        s = make_state()
        activate(s, 'judge_6', hands={'p1': ['mirror_monk', 'martyr']})
        queued = {'player_id': 'p1', 'card_id': 'spy_3', 'status': 'queued'}
        s['table'].append(queued)
        s['queue'].append(queued)
        apply(s, 'p0', 'target', targets=['p1'])
        self.assertFalse(s['players']['p1']['alive'])
        self.assertTrue(s['players']['p0']['revealed'])
        self.assertEqual(queued['status'], 'cancelled')
        self.assertEqual(s['players']['p1']['honor'], [])

    def test_blind_assassin_cannot_leak_missing_reaction(self):
        s = make_state()
        activate(s, 'blind_assassin_1')
        apply(s, 'p0', 'target', targets=['p1'])
        self.assertEqual(s['phase'], 'react')
        self.assertEqual(Game.get_legal_actions(s, 'p1'), ['react'])
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, 'p1', action(s, 'react', choice='mirror_monk'))[1])
        self.assertEqual(before, s)

    def test_gravedigger_immediate_and_hold(self):
        for choice in ['play', 'hold']:
            s = make_state()
            s['discard'] = ['shinobi_1', 'mastermind']
            activate(s, 'gravedigger_2')
            self.assertCountEqual(s['pending']['options'], s['discard'])
            self.assertIsNone(Game.get_public_view(s, 'p1')['pending'])
            apply(s, 'p0', 'decide', choice=choice, card_id='shinobi_1')
            self.assertNotIn('shinobi_1', s['discard'])
            if choice == 'play':
                self.assertEqual(s['active']['card_id'], 'shinobi_1')
                self.assertEqual(s['night_index'], 2)
            else:
                self.assertIn('shinobi_1', s['players']['p0']['hand'])
        s = make_state()
        s['discard'] = []
        activate(s, 'gravedigger_2')
        apply(s, 'p0', 'decide', choice='continue')

    def test_spirit_merchant_and_thief(self):
        s = make_state()
        s['players']['p0']['honor'] = [2]
        s['players']['p1']['honor'] = [4, 3]
        activate(s, 'spirit_merchant_4')
        apply(s, 'p0', 'target', targets=['p1'], mode='honor', token_index=0)
        self.assertEqual(Game.get_public_view(s, 'p0')['pending']['seen_honor'], 4)
        apply(s, 'p0', 'decide', choice='swap', own_index=0, token_index=1)
        self.assertEqual(s['players']['p0']['honor'], [3])
        self.assertEqual(s['players']['p1']['honor'], [4, 2])
        activate(s, 'thief_5')
        self.assertEqual(Game.get_public_view(s, 'p0')['targets'], ['p1'])
        apply(s, 'p0', 'target', targets=['p1'], token_index=0)
        self.assertEqual(s['players']['p0']['honor'], [3, 4])
        self.assertTrue(s['players']['p0']['revealed'])
        self.assertFalse(s['game_over'])

    def test_rank_tie_and_dead_team_award(self):
        s = make_state()
        for pid, clan, rank in [('p0','crane',1),('p1','crane',2),('p2','lotus',1),('p3','lotus',2)]:
            house(s,pid,clan,rank)
        s['players']['p3']['alive'] = False
        s['submissions'] = {}
        _score(s)
        self.assertEqual(s['round_summary']['winning_clan'], 'crane')
        s['players']['p1']['alive'] = False
        _score(s)
        self.assertEqual(s['round_summary']['reason'], 'tie')
        self.assertEqual(s['round_summary']['awarded'], ['p0', 'p2'])
        s['players']['p2']['alive'] = False
        _score(s)
        self.assertIn('p1', s['round_summary']['awarded'])

    def test_mastermind_ronin_and_highest_score_winner(self):
        s = make_state(5)
        for i, (clan, rank) in enumerate([('ronin',0),('crane',1),('crane',2),('lotus',1),('lotus',2)]):
            house(s, f'p{i}', clan, rank)
        s['players']['p0']['hand'] = ['mastermind']
        s['night_index'] = 5
        _start_reveal(s)
        for pid in s['turn_order']:
            apply(s, pid, 'mastermind', reveal=pid == 'p0')
        self.assertEqual(s['round_summary']['awarded'], ['p0'])
        self.assertEqual(s['round_summary']['winning_clan'], 'ronin')
        s['players']['p0']['honor'] = [4, 4, 4]
        s['players']['p1']['honor'] = [4, 4, 4, 4]
        s['players']['p2']['honor'] = [4, 4, 4, 4]
        s['submissions'] = {'p0': True}
        _score(s)
        self.assertEqual(s['winner'], ['p1','p2'])

    def test_everyone_must_confirm_round_end(self):
        s = make_state()
        s['submissions'] = {}
        _score(s)
        for pid in s['turn_order'][:-1]:
            apply(s, pid, 'next_round')
            self.assertEqual(s['round'], 1)
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, 'p0', action(s, 'next_round'))[1])
        self.assertEqual(before, s)
        apply(s, 'p3', 'next_round')
        self.assertEqual(s['round'], 2)
        self.assertEqual(s['phase'], 'draft')

    def test_invalid_actions_atomic_and_public_view_detached(self):
        s = make_state()
        valid = action(s, 'draft', card_id=s['players']['p0']['packet'][0])
        for extra in [{'window_id': True}, {'window_id': -1}, {'game_token': 'old'}, {'targets': []}, {'card_id': 'missing'}]:
            before = copy.deepcopy(s)
            self.assertIsNotNone(Game.apply_action(s, 'p0', {**valid, **extra})[1])
            self.assertEqual(s, before)
        v = Game.get_public_view(s, 'p0')
        v['packet'].clear()
        self.assertEqual(len(s['players']['p0']['packet']), 3)
        guest = Game.get_public_view(s, 'guest')
        self.assertEqual(guest['hand'], [])
        self.assertEqual(guest['packet'], [])
        self.assertTrue(all(p['house'] is None for p in guest['players']))
        self.assertNotIn('seed', guest)

    def test_full_bot_games_and_json_roundtrips(self):
        for n in range(4,12):
            for seed in range(3):
                s = make_state(n, seed)
                for step in range(3000):
                    # Reconnect/restore every step, including shared active/table objects.
                    s = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
                    inventory = s['undealt'] + s['discard'] + [e['card_id'] for e in s['table']]
                    inventory += [c for p in s['players'].values() for c in p['hand'] + p['packet']]
                    self.assertEqual(Counter(inventory), Counter(CARDS.keys()))
                    if s['game_over']:
                        break
                    for pid in s['turn_order']:
                        move = Game.bot_move(s, pid)
                        if move:
                            self.assertIsNone(Game.apply_action(s,pid,move)[1], (s['phase'],move))
                            break
                    else:
                        self.fail(f'Deadlock: {s["phase"]}')
                self.assertTrue(s['game_over'], (n,seed))


if __name__ == '__main__':
    unittest.main()
