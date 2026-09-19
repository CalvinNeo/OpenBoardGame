from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from tests import test_ark_nova_game as fixtures


class ArkNovaBreakRegressions(unittest.TestCase):
    def setUp(self):
        self.helper = fixtures.ArkNovaGameTests()
        self.state = self.helper.make_state()
        for player in self.state['players'].values():
            player['hand'] = []

    @property
    def player(self):
        return self.state['players']['p1']

    def act(self, action, player_id='p1'):
        events, error = rules.ArkNovaGame.apply_action(self.state, player_id, action)
        self.assertIsNone(error, action)
        return events

    def choose(self, selection):
        pending = self.state['pending_choice']
        self.assertIsNotNone(pending)
        return self.act({
            'type': 'resolve_choice', 'choice_id': pending['choice_id'],
            'selection': selection,
        }, pending['player_id'])

    def choose_effect(self, predicate):
        pending = self.state['pending_choice']
        self.assertEqual(pending['type'], 'effect_order')
        self.choose(next(i for i, ref in enumerate(pending['_effects']) if predicate(ref)))

    def start_break(self, player_id='p1', **options):
        self.state['break_position'] = self.state['break_limit'] - 1
        self.act({'type': 'sponsors', 'mode': 'break', **options}, player_id)

    def test_science_lab_leaves_gap_until_all_of_its_owners_income_finishes(self):
        self.player['played_sponsors'] = ['201']
        for player in self.state['players'].values():
            player['claimed_map_rewards'] = ['card_income']
            player['reputation'] = 0
        self.start_break(choose_effect_order=True)
        self.choose_effect(lambda ref: ref.get('card_id') == '201')
        first = self.state['display'][0]
        deck_before = list(self.state['deck'])
        self.choose('display:' + first)

        self.assertIsNone(self.state['display'][0])
        self.assertEqual(self.state['deck'], deck_before)
        self.choose_effect(lambda ref: ref.get('operation') == 'map_income')
        self.assertEqual([item['value'] for item in self.state['pending_choice']['options']], ['deck'])
        self.choose('deck')

        self.assertTrue(all(self.state['display']))
        self.assertEqual(self.state['pending_choice']['player_id'], 'p2')
        self.choose_effect(lambda ref: ref.get('operation') == 'map_income')
        refreshed_first = self.state['display'][0]
        self.assertNotEqual(refreshed_first, first)
        self.assertIn('display:' + refreshed_first,
                      [item['value'] for item in self.state['pending_choice']['options']])
        self.choose('deck')
        self.assertIsNone(self.state['pending_choice'])
        self.assertNotIn('resolving_break', self.state)

    def test_all_players_discard_before_break_reveals_new_display_cards(self):
        for player_id, card_ids in [('p1', ['201', '202', '203', '204']),
                                    ('p2', ['205', '206', '207', '208'])]:
            for card_id in card_ids:
                self.helper.add_hand_card(self.state, player_id, card_id)
        rules._refill_display(self.state)
        display_before = list(self.state['display'])
        deck_before = list(self.state['deck'])
        self.start_break()

        self.assertEqual(self.state['pending_choice']['type'], 'discard_cards')
        self.assertEqual(self.state['display'], display_before)
        self.assertEqual(self.state['deck'], deck_before)
        self.choose('204')
        self.assertEqual(self.state['pending_choice']['player_id'], 'p2')
        self.assertEqual(self.state['display'], display_before)
        self.assertEqual(self.state['deck'], deck_before)
        self.choose('208')

        self.assertEqual(self.state['display'][:4], display_before[2:])
        self.assertEqual(len(self.state['deck']), len(deck_before) - 2)
        self.assertTrue(set(display_before[:2]).issubset(self.state['discard']))
        self.assertIsNone(self.state['pending_choice'])
        self.assertEqual(self.state['current_player'], 'p2')

    def test_map_enclosure_reward_can_be_declined_without_losing_future_income(self):
        before = copy.deepcopy(self.player['map'])
        rules._queue_choice(self.state, {
            'choice_id': 'map-reward', 'type': 'choose_map_reward', 'player_id': 'p1',
            'options': [{'value': 'enclosure_2_income'}], 'min': 1, 'max': 1,
        })
        self.choose('enclosure_2_income')
        self.assertEqual(self.state['pending_choice']['type'], 'place_free_enclosure')
        self.assertTrue(self.state['pending_choice']['allow_skip'])
        self.choose([])
        self.assertEqual(self.player['map'], before)
        self.assertIn('enclosure_2_income', self.player['claimed_map_rewards'])

        self.start_break()
        self.assertEqual(self.state['pending_choice']['type'], 'place_free_enclosure')
        self.choose([])
        self.assertEqual(self.player['map'], before)
        self.assertNotIn('resolving_break', self.state)
        self.assertEqual(self.state['current_player'], 'p2')

    def test_conservation_bonus_enclosure_can_be_declined(self):
        before = copy.deepcopy(self.player['map'])
        self.state['bonus_tokens']['5'] = ['enclosure_3']
        self.player['conservation'] = 4
        self.player['milestones_resolved'] = [2]
        rules._apply_rewards(self.state, 'p1', {'conservation': 1}, [], 'regression')
        self.choose({'kind': 'token', 'token_id': 'enclosure_3'})
        self.assertEqual(self.state['pending_choice']['type'], 'place_free_enclosure')
        self.choose([])
        self.assertEqual(self.player['map'], before)
        self.assertEqual(self.state['bonus_tokens']['5'], [])
        self.assertIsNone(self.state['pending_choice'])


if __name__ == '__main__':
    unittest.main()
