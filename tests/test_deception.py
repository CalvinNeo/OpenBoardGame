import copy
import json
import unittest
from unittest.mock import patch

from game.deception import DeceptionGame as Game
from game.deception_data import CLUES, LOCATIONS, MEANS, SCENES


class DeceptionTests(unittest.TestCase):
    def game(self, count=6, **config):
        return Game.init_game({'seed': 134, **config}, [
            {'player_id': f'p{i}', 'name': f'Player {i}', 'seat': i, 'is_bot': True}
            for i in range(count)])

    def role(self, state, role):
        return next(pid for pid in state['order'] if state['roles'][pid] == role)

    def action(self, state, pid, kind, **fields):
        events, error = Game.apply_action(state, pid, {
            'type': kind, 'case_token': state['case_token'], 'round': state['round'], **fields})
        self.assertIsNone(error, (kind, fields, error))
        return events

    def reject(self, state, pid, kind, **fields):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, {
            'type': kind, 'case_token': state['case_token'], 'round': state['round'], **fields})
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def select_crime(self, state):
        murderer = self.role(state, 'murderer')
        hand = state['hands'][murderer]
        return self.action(state, murderer, 'choose_crime', means_id=hand['means'][0], clue_id=hand['clues'][0])

    def evidence(self, state):
        self.select_crime(state)
        self.action(state, state['forensic_id'], 'choose_location', tile_id=LOCATIONS[0]['id'])

    def discussion(self, state):
        self.evidence(state)
        for tile in state['scenes']:
            self.action(state, state['forensic_id'], 'place_marker', tile_id=tile['id'], option=2)
        self.assertEqual(state['phase'], 'discussion')

    def presentations(self, state):
        self.action(state, state['forensic_id'], 'start_presentations')
        for pid in state['presentation_order']:
            self.assertEqual(state['current_turn'], pid)
            self.action(state, pid, 'end_presentation')

    def solve(self, state):
        solution = state['solution']
        actor = self.role(state, 'investigator')
        return self.action(state, actor, 'accuse', target_id=solution['player_id'],
                           means_id=solution['means_id'], clue_id=solution['clue_id'])

    def test_every_player_count_and_difficulty_deals_unique_cards(self):
        for count in range(4, 13):
            for cards in (3, 4, 5):
                state = self.game(count, cards_per_type=cards)
                self.assertEqual(list(state['roles'].values()).count('forensic'), 1)
                self.assertEqual(list(state['roles'].values()).count('murderer'), 1)
                for kind in ('means', 'clues'):
                    dealt = [c for hand in state['hands'].values() for c in hand[kind]]
                    self.assertEqual(len(dealt), (count - 1) * cards)
                    self.assertEqual(len(set(dealt)), len(dealt))
                self.assertFalse(state['badges'][state['forensic_id']])

    def test_data_has_capacity_unique_ids_and_six_options(self):
        for deck in (MEANS, CLUES):
            self.assertGreaterEqual(len(deck), 55)
            self.assertEqual(len({c['id'] for c in deck}), len(deck))
            self.assertEqual(len({c['zh'] for c in deck}), len(deck))
        self.assertTrue(all(len(t['options']) == 6 for t in LOCATIONS + SCENES))

    def test_configuration_rejects_invalid_values(self):
        for config in ({'cards_per_type': True}, {'cards_per_type': 6}, {'witness': True},
                       {'accomplice': 'yes'}, {'seed': []}, {'seed': False}, {'seed': ''}, {'unknown': 1}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.game(**config)
        for count in (3, 13):
            with self.assertRaises(ValueError): self.game(count)
        for count in (4, 5):
            with self.assertRaises(ValueError): self.game(count, accomplice=True)
        state = self.game(6, accomplice=True, witness=True)
        self.assertEqual(set(state['roles'].values()), {'forensic', 'murderer', 'accomplice', 'witness', 'investigator'})

    def test_secret_crime_only_from_murderers_own_cards_and_private_event(self):
        state = self.game()
        murderer, investigator = self.role(state, 'murderer'), self.role(state, 'investigator')
        hand = state['hands'][murderer]
        self.reject(state, investigator, 'choose_crime', means_id=hand['means'][0], clue_id=hand['clues'][0])
        self.reject(state, murderer, 'choose_crime', means_id=state['hands'][investigator]['means'][0], clue_id=hand['clues'][0])
        events = self.select_crime(state)
        self.assertNotIn(murderer, json.dumps(events))
        self.assertNotIn(hand['means'][0], json.dumps(events))
        self.assertEqual(state['phase'], 'scene_setup')
        self.reject(state, murderer, 'choose_crime', means_id=hand['means'][0], clue_id=hand['clues'][0])

    def test_views_do_not_leak_roles_answers_seed_or_deck(self):
        state = self.game(accomplice=True, witness=True)
        self.select_crime(state)
        for pid in state['order'] + ['spectator']:
            view = Game.get_public_view(state, pid)
            self.assertNotIn('seed', view['config'])
            self.assertNotIn('roles', view)
            self.assertNotIn('scene_deck', view)
            self.assertIsNone(view['solution'])
            self.assertTrue(all(p['role'] is None for p in view['players'] if p['player_id'] != state['forensic_id']))
            role = state['roles'].get(pid)
            if role in ('murderer', 'accomplice', 'forensic'):
                self.assertEqual(view['private']['solution'], state['solution'])
            elif role:
                self.assertNotIn('solution', view['private'])
                self.assertNotIn('allies', view['private'])
            else:
                self.assertIsNone(view['private'])
                self.assertEqual(view['legal_actions'], [])
        witness = Game.get_public_view(state, self.role(state, 'witness'))['private']
        self.assertEqual(witness['suspects'], [pid for pid in state['order'] if state['roles'][pid] in ('murderer', 'accomplice')])
        self.assertEqual(set(witness), {'role', 'suspects'})

    def test_views_are_independent_copies(self):
        state = self.game(); self.discussion(state); before = copy.deepcopy(state)
        view = Game.get_public_view(state, state['forensic_id'])
        view['private']['solution']['means_id'] = 'changed'
        view['scenes'][0]['options'][0]['zh'] = 'changed'
        view['players'][0]['name'] = 'changed'
        view['history'].clear()
        self.assertEqual(state, before)

    def test_location_is_private_until_chosen_and_fixed(self):
        state = self.game(); self.select_crime(state)
        self.assertEqual(len(Game.get_public_view(state, state['forensic_id'])['locations']), 4)
        self.assertEqual(Game.get_public_view(state, self.role(state, 'investigator'))['locations'], [])
        self.reject(state, state['forensic_id'], 'choose_location', tile_id='invalid')
        self.action(state, state['forensic_id'], 'choose_location', tile_id=LOCATIONS[1]['id'])
        self.assertEqual(len(state['scenes']), 6)
        self.assertEqual(state['scenes'][1]['id'], LOCATIONS[1]['id'])
        self.reject(state, state['forensic_id'], 'choose_location', tile_id=LOCATIONS[0]['id'])

    def test_markers_any_order_are_locked_and_phase_waits_for_six(self):
        state = self.game(); self.evidence(state); forensic = state['forensic_id']
        self.reject(state, forensic, 'start_presentations')
        for index, tile in enumerate(reversed(state['scenes'])):
            self.action(state, forensic, 'place_marker', tile_id=tile['id'], option=index)
            self.reject(state, forensic, 'place_marker', tile_id=tile['id'], option=(index + 1) % 6)
            self.assertEqual(state['phase'], 'discussion' if index == 5 else 'evidence')
        self.assertEqual([e['option'] for e in state['history'] if e['type'] == 'marker'], list(range(6)))

    def test_forensic_never_chats_others_need_first_marker(self):
        state = self.game(); self.evidence(state)
        actor = self.role(state, 'investigator')
        self.reject(state, actor, 'discuss', text='before the evidence')
        self.action(state, state['forensic_id'], 'place_marker', tile_id='cause', option=0)
        self.action(state, actor, 'discuss', text='  Something sharp?  ')
        self.assertEqual(state['history'][-1]['text'], 'Something sharp?')
        self.reject(state, state['forensic_id'], 'discuss', text='hint')
        for text in ('', '   ', 'x' * 301, 42): self.reject(state, actor, 'discuss', text=text)
        for index in range(125): self.action(state, actor, 'discuss', text=str(index))
        self.assertEqual(sum(e['type'] == 'message' for e in state['history']), 120)
        self.assertTrue(any(e['type'] == 'marker' for e in state['history']))

    def test_presentation_order_includes_spent_badges_and_only_speaker_chats(self):
        state = self.game(); self.discussion(state)
        self.action(state, state['forensic_id'], 'start_presentations')
        for pid in state['presentation_order']:
            self.assertEqual(state['current_turn'], pid)
            other = next(p for p in state['presentation_order'] if p != pid)
            self.reject(state, other, 'end_presentation')
            self.reject(state, other, 'discuss', text='interrupt')
            state['badges'][pid] = False
            self.action(state, pid, 'discuss', text='my theory')
            self.action(state, pid, 'end_presentation')
        self.assertEqual(state['phase'], 'round_review')

    def test_every_seat_must_confirm_next_round(self):
        state = self.game(); self.discussion(state); self.presentations(state)
        for pid in state['order'][:-1]:
            self.action(state, pid, 'next_round')
            self.assertEqual(state['round'], 1)
        self.reject(state, state['order'][0], 'next_round')
        self.reject(state, 'spectator', 'next_round')
        self.action(state, state['order'][-1], 'next_round')
        self.assertEqual((state['round'], state['phase']), (2, 'evidence'))
        self.assertEqual(state['next_round_ready'], [])

    def test_replacement_private_draw_locks_fixed_tiles_and_preserves_others(self):
        state = self.game(); self.discussion(state); self.presentations(state)
        for pid in state['order']: self.action(state, pid, 'next_round')
        forensic, replacement = state['forensic_id'], state['replacement']
        self.assertIsNotNone(Game.get_public_view(state, forensic)['replacement'])
        self.assertIsNone(Game.get_public_view(state, self.role(state, 'investigator'))['replacement'])
        before = copy.deepcopy(state['scenes'])
        for tile in before[:2]:
            self.reject(state, forensic, 'replace_scene', tile_id=replacement, replace_id=tile['id'], option=0)
        self.reject(state, forensic, 'replace_scene', tile_id='wrong', replace_id=before[2]['id'], option=0)
        self.action(state, forensic, 'replace_scene', tile_id=replacement, replace_id=before[2]['id'], option=4)
        self.assertEqual(state['scenes'][:2] + state['scenes'][3:], before[:2] + before[3:])
        self.assertEqual(state['discarded_scenes'][0], {**before[2], 'round': 1})
        self.assertEqual(state['phase'], 'discussion')
        self.reject(state, forensic, 'place_marker', tile_id=before[2]['id'], option=1)

    def test_three_round_timeout_and_no_extra_confirmation_at_end(self):
        state = self.game(); self.discussion(state)
        for round_number in (1, 2, 3):
            self.presentations(state)
            if round_number < 3:
                for pid in state['order']: self.action(state, pid, 'next_round')
                self.action(state, state['forensic_id'], 'replace_scene', tile_id=state['replacement'], replace_id=state['scenes'][2]['id'], option=1)
        self.assertEqual((state['phase'], state['winner_team'], state['end_reason']), ('game_over', 'murderer', 'three_rounds'))
        self.assertTrue(all(p['role'] for p in Game.get_public_view(state, 'spectator')['players']))
        self.assertEqual(Game.get_public_view(state, 'spectator')['solution'], state['solution'])

    def test_accusation_requires_two_cards_of_another_player(self):
        state = self.game(); self.select_crime(state)
        actor = self.role(state, 'investigator'); solution = state['solution']; hand = state['hands'][actor]
        self.reject(state, actor, 'accuse', target_id=actor, means_id=hand['means'][0], clue_id=hand['clues'][0])
        self.reject(state, actor, 'accuse', target_id=solution['player_id'], means_id=solution['means_id'], clue_id=hand['clues'][0])
        self.reject(state, state['forensic_id'], 'accuse', target_id=solution['player_id'], means_id=solution['means_id'], clue_id=solution['clue_id'])

    def test_wrong_accusation_costs_once_with_no_partial_feedback(self):
        state = self.game(); self.discussion(state)
        actor = self.role(state, 'investigator'); s = state['solution']
        wrong = state['hands'][s['player_id']]['clues'][1]
        events = self.action(state, actor, 'accuse', target_id=s['player_id'], means_id=s['means_id'], clue_id=wrong)
        self.assertFalse(state['badges'][actor])
        self.assertFalse(events[0]['payload']['correct'])
        self.assertEqual(set(events[0]['payload']), {'type', 'round', 'player_id', 'target_id', 'means_id', 'clue_id', 'correct'})
        self.reject(state, actor, 'accuse', target_id=s['player_id'], means_id=s['means_id'], clue_id=s['clue_id'])
        self.action(state, actor, 'discuss', text='I can still discuss')

    def test_accusation_can_interrupt_another_presentation(self):
        state = self.game(); self.discussion(state)
        self.action(state, state['forensic_id'], 'start_presentations')
        self.solve(state)
        self.assertEqual(state['winner_team'], 'investigators')
        self.assertIsNone(state['current_turn'])

    def test_all_badges_exhausted_ends_case(self):
        state = self.game(); self.discussion(state)
        for pid in state['presentation_order']:
            target = next(p for p in state['presentation_order'] if p != pid)
            hand = state['hands'][target]
            self.action(state, pid, 'accuse', target_id=target, means_id=hand['means'][1], clue_id=hand['clues'][1])
        self.assertEqual(state['end_reason'], 'badges_exhausted')

    def test_witness_reversal_keeps_witness_and_accomplice_secret(self):
        state = self.game(accomplice=True, witness=True); self.select_crime(state); self.solve(state)
        self.assertEqual(state['phase'], 'reversal')
        self.assertFalse(state['game_over'])
        public = Game.get_public_view(state, 'spectator')
        self.assertEqual({p['role'] for p in public['players']}, {None, 'forensic', 'murderer'})
        self.assertIsNotNone(public['solution'])
        self.reject(state, self.role(state, 'accomplice'), 'identify_witness', target_id=self.role(state, 'witness'))
        self.reject(state, self.role(state, 'witness'), 'discuss', text='I object')
        self.action(state, self.role(state, 'accomplice'), 'discuss', text='My guess is…')

    def test_both_witness_reversal_outcomes_and_winners(self):
        for correct in (True, False):
            state = self.game(accomplice=True, witness=True); self.select_crime(state); self.solve(state)
            target = self.role(state, 'witness' if correct else 'investigator')
            self.action(state, self.role(state, 'murderer'), 'identify_witness', target_id=target)
            self.assertEqual(state['winner_team'], 'murderer' if correct else 'investigators')
            self.assertEqual(len(state['winner_ids']), 2 if correct else 4)
            self.assertEqual(state['witness_guess'], target)

    def test_stale_unknown_or_malformed_requests_are_atomic(self):
        state = self.game(); self.evidence(state)
        actor = state['forensic_id']
        valid = {'type': 'place_marker', 'case_token': state['case_token'], 'round': 1, 'tile_id': 'cause', 'option': 1}
        bad = [None, [], {}, {**valid, 'type': []}, {**valid, 'option': True}, {**valid, 'option': -1},
               {**valid, 'option': 6}, {**valid, 'tile_id': []}, {**valid, 'tile_id': 'unknown'},
               {**valid, 'round': 2}, {**valid, 'round': True}, {**valid, 'case_token': 'old'},
               {**valid, 'cheat': True}, {k: v for k, v in valid.items() if k != 'round'}]
        for action in bad:
            with self.subTest(action=action):
                before = copy.deepcopy(state)
                self.assertTrue(Game.apply_action(state, actor, action)[1])
                self.assertEqual(state, before)

    def test_json_roundtrip_at_each_stage(self):
        state = self.game(accomplice=True, witness=True)
        for _ in range(160):
            saved = json.loads(json.dumps(Game.serialize(state)))
            restored = Game.deserialize(saved)
            self.assertEqual(restored, state)
            for pid in state['order']:
                self.assertEqual(Game.get_public_view(restored, pid), Game.get_public_view(state, pid))
            if state['game_over']: break
            for pid in state['order']:
                action = Game.bot_move(state, pid)
                if action:
                    action.pop('delay_ms'); self.assertIsNone(Game.apply_action(state, pid, action)[1]); break
            else: self.fail('bots stuck')
        self.assertTrue(state['game_over'])

    def test_bot_receives_only_authorized_view(self):
        state = self.game(); self.discussion(state); pid = self.role(state, 'investigator')
        with patch('game.deception_ai.choose_action', return_value=None) as chooser:
            self.assertIsNone(Game.bot_move(state, pid))
        self.assertEqual(chooser.call_args.args[0], Game.get_public_view(state, pid))
        self.assertNotIn('solution', chooser.call_args.args[0]['private'])

    def test_bots_complete_all_supported_counts_and_role_modes(self):
        for count, roles in ((4, False), (5, False), (6, True), (8, True), (12, True)):
            for seed in range(3):
                with self.subTest(count=count, seed=seed):
                    state = self.game(count, seed=seed, accomplice=roles, witness=roles, cards_per_type=5)
                    for _ in range(200):
                        if state['game_over']: break
                        for pid in state['order']:
                            action = Game.bot_move(state, pid)
                            if action:
                                action.pop('delay_ms'); self.assertIsNone(Game.apply_action(state, pid, action)[1]); break
                        else: self.fail(('bots stuck', state['phase']))
                    self.assertTrue(state['game_over'])
