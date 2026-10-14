import copy
import json
import unittest
from collections import Counter
from unittest.mock import patch

from game.moshimo_yusha import (
    MoshimoYushaGame as Game, CARD_IDS, CHIP_TYPES, _condition_holds,
    _participants, _score_match, bot_from_view,
)


def make_state(count=3, bots=False, seed=151):
    with patch('game.moshimo_yusha.secrets.token_hex', side_effect=[f'token-{i}' for i in range(12)]):
        return Game.init_game({'seed': seed}, [
            {'player_id': f'p{i}', 'name': f'Player {i}', 'seat': i, 'is_bot': bots}
            for i in range(count)
        ])


def action(state, kind, **fields):
    return {'type': kind, 'game_instance_id': state['game_instance_id'],
            'window_id': state['window_id'], **fields}


def apply(state, pid, kind, **fields):
    events, error = Game.apply_action(state, pid, action(state, kind, **fields))
    if error:
        raise AssertionError(error)
    return events


def confirm_all(state):
    for pid in state['turn_order']:
        apply(state, pid, 'next_round')


def prepare(state, discards=None):
    for pid in state['turn_order']:
        apply(state, pid, 'discard', card_ids=(discards or {}).get(pid, [1, 2]))
    confirm_all(state)


def resolve(cards, chips=None):
    state = make_state(len(cards))
    prepare(state, {f'p{i}': [c for c in CARD_IDS if c != cid][:2] for i, cid in enumerate(cards)})
    if chips:
        for pid, values in chips.items():
            state['players'][pid]['chips'].update(values)
    for i, cid in enumerate(cards):
        apply(state, f'p{i}', 'play', card_id=cid)
    return state


class MoshimoYushaTests(unittest.TestCase):
    def assert_conserved(self, state):
        cards = [cid for p in _participants(state).values() for cid in p['hand']]
        cards += [row['card_id'] for row in state['played']]
        cards += list(state['pending_cards'].values())
        if state['phase'] == 'setup_discard':
            cards += [c for pair in state['setup_submissions'].values() for c in pair]
        else:
            cards += state['discarded']
        self.assertEqual(Counter(cards), Counter({cid: len(_participants(state)) for cid in CARD_IDS}))

    def assert_rejected_unchanged(self, state, pid, command):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, command)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(before, state)

    def test_seat_limits_config_and_senate(self):
        for n in range(1, 8):
            state = make_state(n)
            self.assertEqual(len(state['players']), n)
            self.assertEqual(len(state['senators']), max(0, 3-n))
            self.assertEqual(len(state['table_order']), max(3, n))
            self.assert_conserved(state)
            for pid, p in state['senators'].items():
                self.assertEqual(len(p['hand']), 5)
                self.assertEqual(len(state['setup_submissions'][pid]), 2)
                self.assertEqual(Game.get_legal_actions(state, pid), [])
        for count in (0, 8):
            with self.assertRaises(ValueError):
                make_state(count)
        for config in ({'unknown': 1}, {'seed': True}, {'seed': ''}, []):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{'player_id': 'p0'}])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{'player_id': 'p0'}, {'player_id': 'p0'}])

    def test_shared_window_hidden_discards_then_anonymous_review(self):
        state = make_state()
        window = state['window_id']
        commands = [action(state, 'discard', card_ids=pair) for pair in ([1, 2], [3, 4], [6, 7])]
        events, error = Game.apply_action(state, 'p0', commands[0])
        self.assertIsNone(error)
        self.assertEqual(state['window_id'], window)
        other = Game.get_public_view(state, 'p1')
        self.assertEqual(other['discarded'], [])
        self.assertEqual(other['my_submission'], None)
        self.assertEqual(other['submitted'], ['p0'])
        self.assertNotIn('card_ids', json.dumps(events))
        self.assertEqual(Game.get_public_view(state, 'p0')['my_submission'], [1, 2])
        self.assert_rejected_unchanged(state, 'p0', commands[0])
        for i in (1, 2):
            self.assertIsNone(Game.apply_action(state, f'p{i}', commands[i])[1])
        self.assertEqual(state['phase'], 'setup_review')
        self.assertEqual(state['discarded'], [1, 2, 3, 4, 6, 7])
        self.assertEqual(state['window_id'], window+1)
        self.assertTrue(all('player_id' not in c for c in Game.get_public_view(state, 'p0')['discarded']))
        self.assert_rejected_unchanged(state, 'p1', commands[1])
        for pid in ('p0', 'p1'):
            apply(state, pid, 'next_round')
            self.assertEqual(state['phase'], 'setup_review')
        apply(state, 'p2', 'next_round')
        self.assertEqual((state['phase'], state['play_round']), ('playing', 1))
        self.assert_conserved(state)

    def test_invalid_actions_are_atomic(self):
        state = make_state()
        good = action(state, 'discard', card_ids=[1, 2])
        bad = [None, [], {}, {**good, 'window_id': True}, {**good, 'window_id': 1.0},
               {**good, 'game_instance_id': 'old'}, {**good, 'window_id': -1},
               {**good, 'extra': 'bad'}, {**good, 'card_ids': [1, 1]},
               {**good, 'card_ids': [1, 8]}, {**good, 'card_ids': [1, 2.0]},
               {**good, 'card_ids': [1]}, {**good, 'card_ids': [True, 2]},
               action(state, 'play', card_id=1), action(state, 'next_round')]
        for command in bad:
            with self.subTest(command=command):
                self.assert_rejected_unchanged(state, 'p0', command)
        self.assert_rejected_unchanged(state, 'outsider', good)
        prepare(state)
        for cid in (1, '3', 3.0, True):
            self.assert_rejected_unchanged(state, 'p0', action(state, 'play', card_id=cid))

    def test_play_commit_is_private_and_cannot_be_changed(self):
        state = make_state()
        prepare(state)
        events = apply(state, 'p0', 'play', card_id=6)
        view = Game.get_public_view(state, 'p1')
        self.assertIsNone(view['last_resolution'])
        self.assertEqual(view['played'], [])
        self.assertEqual(view['my_submission'], None)
        self.assertNotIn('card_id', json.dumps(events))
        self.assert_rejected_unchanged(state, 'p0', action(state, 'play', card_id=5))
        for pid in ('p1', 'p2'):
            apply(state, pid, 'play', card_id=3)
        self.assertEqual(state['phase'], 'round_review')
        self.assertEqual([r['card_id'] for r in view['played']], [])
        self.assertEqual([r['card_id'] for r in state['last_resolution']['cards']], [6, 3, 3])

    def test_single_and_multiple_resource_roles(self):
        for cid, single_kind, single_amount, multi_kind, multi_amount in [
            (2, 'faith', 2, 'attack', 1), (3, 'gold', 2, 'faith', 1),
            (4, 'gold', 3, 'gold', 1), (5, 'faith', 1, 'faith', 2),
        ]:
            with self.subTest(cid=cid):
                single = resolve([cid, 1, 1])
                self.assertEqual(single['players']['p0']['chips'][single_kind], single_amount)
                self.assertEqual(sum(single['players']['p0']['chips'].values()), single_amount)
                multi = resolve([cid, cid, 1])
                for pid in ('p0', 'p1'):
                    self.assertEqual(multi['players'][pid]['chips'][multi_kind], multi_amount)
                    self.assertEqual(sum(multi['players'][pid]['chips'].values()), multi_amount)

    def test_hero_needs_royal_and_cancels_all_royals(self):
        for cards, gains in [([1, 3, 4], [0]), ([1, 6, 4], [2]),
                             ([1, 1, 6], [1, 1]), ([1, 6, 6], [2])]:
            state = resolve(cards, {'p0': {'gold': 3}, 'p2': {'faith': 2}})
            for i, value in enumerate(gains):
                self.assertEqual(state['players'][f'p{i}']['chips']['attack'], value)
            self.assertEqual(state['players']['p0']['chips']['gold'], 3)
            self.assertEqual(state['players']['p2']['chips']['faith'], 2)
            self.assertEqual(state['last_resolution']['royal_blocked'], 6 in cards)

    def test_royal_collects_earlier_gains_bishop_keeps_every_resource(self):
        state = resolve([6, 4, 5], {'p0': {'gold': 1}, 'p1': {'attack': 2}, 'p2': {'gold': 9, 'attack': 3}})
        self.assertEqual(state['players']['p0']['chips'], {'gold': 4, 'attack': 2, 'faith': 0})
        self.assertEqual(state['players']['p1']['chips'], dict.fromkeys(CHIP_TYPES, 0))
        self.assertEqual(state['players']['p2']['chips'], {'gold': 9, 'attack': 3, 'faith': 1})
        self.assert_conserved(state)

    def test_multiple_royals_keep_own_chips_and_clear_unprotected_only(self):
        state = resolve([6, 6, 4, 5], {f'p{i}': {'gold': i+1, 'attack': 1} for i in range(4)})
        self.assertEqual(state['players']['p0']['chips']['gold'], 1)
        self.assertEqual(state['players']['p1']['chips']['gold'], 2)
        self.assertEqual(state['players']['p2']['chips'], dict.fromkeys(CHIP_TYPES, 0))
        self.assertEqual(state['players']['p3']['chips'], {'gold': 4, 'attack': 1, 'faith': 1})

    def test_lone_jester_passes_simultaneously_with_duplicates_and_private_memory(self):
        state = make_state()
        prepare(state)
        for i, cid in enumerate([7, 3, 4]):
            apply(state, f'p{i}', 'play', card_id=cid)
        self.assertEqual(state['phase'], 'pass_cards')
        self.assertEqual(state['players']['p0']['chips']['gold'], 0)
        before = {pid: p['hand'][:] for pid, p in state['players'].items()}
        window = state['window_id']
        for i, cid in enumerate([3, 4, 5]):
            events = apply(state, f'p{i}', 'pass_card', card_id=cid)
            self.assertNotIn('card_id', json.dumps(events))
            if i < 2:
                self.assertEqual(state['window_id'], window)
                self.assertEqual({pid: p['hand'] for pid, p in state['players'].items()}, before)
                self.assertIsNone(Game.get_public_view(state, 'p2')['my_exchange'])
        self.assertEqual(state['phase'], 'round_review')
        self.assertEqual(state['players']['p0']['hand'].count(5), 2)
        self.assertEqual(state['players']['p2']['hand'].count(4), 1)
        self.assertEqual(Game.get_public_view(state, 'p0')['my_exchange'], {'sent': 3, 'to': 'p1', 'received': 5, 'from': 'p2'})
        spectator = Game.get_public_view(state, 'guest')
        self.assertIsNone(spectator['my_exchange'])
        self.assertEqual(spectator['my_hand'], [])
        self.assertNotIn('received', json.dumps(spectator))
        self.assert_conserved(state)
        Game.deserialize(json.loads(json.dumps(Game.serialize(state))))

    def test_multiple_jesters_gain_gold_without_exchange(self):
        state = resolve([7, 7, 3])
        self.assertEqual(state['phase'], 'round_review')
        for pid in ('p0', 'p1'):
            self.assertEqual(state['players'][pid]['chips']['gold'], 1)
        self.assertEqual(state['pass_memory'], {})

    def test_senate_excluded_from_pass_and_review(self):
        for n in (1, 2):
            state = make_state(n)
            prepare(state)
            # Force a known Senate draw without changing its card conservation.
            for pid in state['senators']:
                old = state['pending_cards'][pid]
                if old == 7:
                    replacement = next(c for c in state['senators'][pid]['hand'] if c != 7)
                    state['senators'][pid]['hand'].remove(replacement)
                    state['senators'][pid]['hand'].append(old)
                    state['pending_cards'][pid] = replacement
            senate_hands = {pid: p['hand'][:] for pid, p in state['senators'].items()}
            for i in range(n):
                apply(state, f'p{i}', 'play', card_id=7 if i == 0 else 3)
            if n == 2:
                self.assertEqual(state['phase'], 'pass_cards')
                apply(state, 'p0', 'pass_card', card_id=4)
                apply(state, 'p1', 'pass_card', card_id=5)
            self.assertEqual(state['phase'], 'round_review')
            self.assertEqual({pid: p['hand'] for pid, p in state['senators'].items()}, senate_hands)
            confirm_all(state)
            self.assertEqual((state['phase'], state['play_round']), ('playing', 2))
            self.assert_conserved(state)

    def test_fourth_round_exchange_changes_final_goal_after_separate_review(self):
        state = make_state()
        prepare(state)
        for cid in (3, 4, 5):
            for pid in state['turn_order']:
                apply(state, pid, 'play', card_id=cid)
            confirm_all(state)
        for i, cid in enumerate([7, 6, 6]):
            apply(state, f'p{i}', 'play', card_id=cid)
        self.assertEqual(state['phase'], 'pass_cards')
        for pid in state['turn_order']:
            apply(state, pid, 'pass_card', card_id=state['players'][pid]['hand'][0])
        self.assertEqual(state['phase'], 'round_review')
        self.assertIsNone(state['last_match_summary'])
        confirm_all(state)
        self.assertEqual(state['phase'], 'game_over')
        self.assertEqual(state['winner_ids'], ['p1'])
        self.assertEqual(state['last_match_summary']['final_cards']['p1']['id'], 6)
        self.assertEqual(state['players']['p2']['chips']['faith'], 3)  # Final Royal does not act.
        self.assertEqual(len(state['round_history']), 4)
        self.assert_conserved(state)

    def test_scoring_conditions_strict_ties_total_attack_and_hero(self):
        state = make_state(1)
        ids = state['table_order']
        for cid, chips in [(3, {'gold': 2}), (4, {'gold': 1, 'faith': 1}), (5, {'faith': 2})]:
            for p in _participants(state).values():
                p['chips'] = dict.fromkeys(CHIP_TYPES, 0)
            state['players']['p0']['chips'].update(chips)
            self.assertTrue(_condition_holds(state, 'p0', cid))
            _participants(state)[ids[1]]['chips'].update(chips)
            self.assertFalse(_condition_holds(state, 'p0', cid))
        self.assertFalse(_condition_holds(state, 'p0', 1))
        self.assertTrue(_condition_holds(state, 'p0', 6))
        state['players']['p0']['chips']['attack'] = 2
        self.assertFalse(_condition_holds(state, 'p0', 2))
        self.assertFalse(_condition_holds(state, 'p0', 6))
        _participants(state)[ids[2]]['chips']['attack'] = 1
        self.assertTrue(_condition_holds(state, 'p0', 2))

    def test_unique_multiple_no_winners_and_jester_fallback(self):
        for cards, winners, gain in [([6, 1, 7], ['p0'], 2), ([6, 6, 7], ['p0', 'p1'], 1),
                                      ([1, 3, 5], [], 0), ([7, 1, 7], ['p0', 'p2'], 1),
                                      ([1, 1, 7], ['p2'], 2)]:
            with self.subTest(cards=cards):
                state = make_state()
                for i, cid in enumerate(cards):
                    state['players'][f'p{i}']['hand'] = [cid]
                _score_match(state)
                self.assertEqual(state['last_match_summary']['winners'], winners)
                self.assertEqual(state['last_match_summary']['victory_points_gained'], gain)
                self.assertEqual(state['game_over'], gain == 2)

    def test_scores_preserved_on_reset_and_overall_highest_shared(self):
        state = make_state()
        for p in state['players'].values():
            p['hand'] = [6]
            p['chips']['gold'] = 5
        _score_match(state)
        self.assertEqual(state['phase'], 'match_review')
        apply(state, 'p0', 'next_round')
        self.assertEqual(state['match_number'], 1)
        for pid in ('p1', 'p2'):
            apply(state, pid, 'next_round')
        self.assertEqual(state['phase'], 'setup_discard')
        self.assertEqual(state['match_number'], 2)
        for p in state['players'].values():
            self.assertEqual(p['score'], 1)
            self.assertEqual(p['hand'], list(CARD_IDS))
            self.assertEqual(sum(p['chips'].values()), 0)
        self.assert_conserved(state)
        for i, p in enumerate(state['players'].values()):
            p['hand'] = [6 if i < 2 else 7]
        _score_match(state)
        self.assertEqual(state['winner_ids'], ['p0', 'p1'])
        self.assertEqual(state['phase'], 'game_over')
        self.assert_rejected_unchanged(state, 'p0', action(state, 'next_round'))

    def test_public_views_are_detached_and_do_not_include_seed_or_other_hands(self):
        state = make_state(1)
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, 'p0')
        for forbidden in ('seed', 'setup_submissions', 'pending_cards', 'pending_passes', 'senators', 'pass_memory'):
            self.assertNotIn(forbidden, view)
        self.assertEqual(view['config'], {})
        self.assertTrue(all('hand' not in p for p in view['players']))
        view['my_hand'].clear()
        view['cards'][0]['name'] = 'changed'
        view['players'][0]['chips']['gold'] = 100
        view['next_round_ready'].append('p0')
        self.assertEqual(before, state)
        self.assertEqual(Game.get_public_view(state, 'guest')['legal_actions'], [])

    def test_bot_uses_only_view_and_confirms_only_own_seat(self):
        state = make_state(3, bots=True)
        state['players']['p0']['is_bot'] = False
        self.assertIsNone(Game.bot_move(state, 'p0'))
        first = Game.bot_move(state, 'p1')
        modified = copy.deepcopy(state)
        modified['players']['p2']['hand'].reverse()
        modified['seed'] = 'changed-secret'
        self.assertEqual(first, Game.bot_move(modified, 'p1'))
        self.assertEqual(first, bot_from_view(Game.get_public_view(state, 'p1')))
        for pid in state['turn_order']:
            apply(state, pid, 'discard', card_ids=[1, 2])
        for pid in ('p1', 'p2'):
            self.assertIsNone(Game.apply_action(state, pid, Game.bot_move(state, pid))[1])
        self.assertEqual(state['phase'], 'setup_review')
        self.assertEqual(state['next_round_ready'], ['p1', 'p2'])
        self.assertEqual(Game.get_legal_actions(state, 'p0'), ['next_round'])

    def test_deserialize_rejects_corruption_and_copies_input(self):
        state = make_state()
        saved = Game.serialize(state)
        restored = Game.deserialize(json.loads(json.dumps(saved)))
        self.assertEqual(state, restored)
        restored['players']['p0']['hand'].pop()
        self.assertEqual(state, saved)
        mutations = [lambda s: s.update(version=1), lambda s: s.update(phase='bad'),
                     lambda s: s['players']['p0']['hand'].pop(),
                     lambda s: s['players']['p0']['chips'].update(gold=-1),
                     lambda s: s.update(next_round_ready=['p0', 'p0']),
                     lambda s: s.update(window_id=True)]
        for mutate in mutations:
            bad = copy.deepcopy(state)
            mutate(bad)
            with self.assertRaises(ValueError):
                Game.deserialize(bad)

    def test_complete_bot_games_with_json_restore_after_every_action(self):
        for count in range(1, 8):
            for seed in (151, 152):
                with self.subTest(count=count, seed=seed):
                    state = make_state(count, bots=True, seed=seed)
                    for step in range(1800):
                        if state['game_over']:
                            break
                        moved = False
                        for pid in state['turn_order']:
                            command = Game.bot_move(state, pid)
                            if command:
                                self.assertIsNone(Game.apply_action(state, pid, command)[1])
                                self.assert_conserved(state)
                                state = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
                                moved = True
                        self.assertTrue(moved, f'Stuck in {state["phase"]}')
                    self.assertTrue(state['game_over'])
                    self.assertTrue(state['winner_ids'])
                    self.assertTrue(all(len(p['hand']) == 1 for p in _participants(state).values()))


if __name__ == '__main__':
    unittest.main()
