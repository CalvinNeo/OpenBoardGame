from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from game.ark_nova_ai import choose_ark_nova_action
from tests import test_ark_nova_rule_regressions as fixtures


class ArkNovaActionOrderRegressions(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.ArkNovaRuleRegressions()
        self.h.setUp()

    def test_impossible_second_animal_restores_the_entire_multiplier_action(self):
        h = self.h
        building = h.building(1)
        h.hand('473')
        h.player['action_cards']['animals']['multiplier_tokens'] = 1
        h.helper.set_slot(h.state, 'p1', 'animals', 5)
        before = copy.deepcopy(h.state)
        h.act({'type': 'animals', 'plays': [{'card_id': '473', 'enclosure_id': building['id']}],
               'use_multiplier_tokens': 1})
        self.assertEqual(h.state['pending_choice']['type'], 'discard_cards')
        self.assertEqual(h.state['pending_choice']['min'], 0)
        events = h.choose([])
        self.assertEqual(events[0]['type'], 'ark_nova:turn_undone')
        self.assertEqual(h.state['players'], before['players'])
        self.assertEqual(h.state['deck'], before['deck'])
        self.assertNotIn('forced_action', h.state)
        self.assertNotIn('multiplier_action', h.state)
        self.assertIsNone(h.state['pending_choice'])
        self.assertTrue(h.state['multiplier_failed_actions'])
        action = choose_ark_nova_action(h.state, 'p1')
        self.assertIsNotNone(action)
        h.act(action)

    def test_impossible_repeated_association_returns_workers_and_all_rewards(self):
        h = self.h
        h.helper.set_slot(h.state, 'p1', 'association', 2)
        h.player['action_cards']['association']['multiplier_tokens'] = 1
        before = copy.deepcopy(h.state)
        events = h.act({'type': 'association', 'tasks': [{'task': 'reputation'}],
                       'use_multiplier_tokens': 1})
        self.assertEqual(events[0]['type'], 'ark_nova:turn_undone')
        self.assertEqual(h.state['players'], before['players'])
        self.assertEqual(h.state['association_supply'], before['association_supply'])

    def test_possible_repeated_build_still_executes_twice_and_spends_one_token(self):
        h = self.h
        h.helper.set_slot(h.state, 'p1', 'build', 3)
        h.player['action_cards']['build']['multiplier_tokens'] = 1
        money = h.player['money']
        h.act({'type': 'build', 'buildings': [{'building_type': 'standard_enclosure', 'size': 1, 'cells': ['A3']}],
               'use_multiplier_tokens': 1})
        self.assertTrue(h.state['forced_action']['from_multiplier'])
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {'type': 'gain_x', 'action_card': 'build'})
        self.assertIsNotNone(error)
        cells = rules._find_placement(h.state, 'p1', 'pavilion', 1)
        h.act({'type': 'build', 'buildings': [{'building_type': 'pavilion', 'cells': cells}]})
        h.finish_choices()
        self.assertEqual(len(h.player['map']['buildings']), 2)
        self.assertEqual(h.player['money'], money - 4)
        self.assertEqual(h.player['action_cards']['build']['slot'], 1)
        self.assertFalse(h.player['action_cards']['build'].get('multiplier_tokens'))
        self.assertNotIn('_multiplier_start', h.state)
        self.assertEqual(h.state['current_player'], 'p2')

    def prepare_cards_and_clever(self):
        h = self.h
        building = h.building(4)
        h.hand('453')
        h.player['money'] = 100
        h.player['played_sponsors'] = ['214']
        h.player['partner_zoos'] = ['africa']
        rules._recompute_tags(h.player)
        h.animal_action([{'card_id': '453', 'enclosure_id': building['id']}], choose_effect_order=True)
        refs = h.state['pending_choice']['_effects']
        h.choose(next(i for i, ref in enumerate(refs) if ref.get('ability_id') == 'action_cards'))
        h.choose('cards')
        self.assertIsNone(h.state.get('pending_choice'))
        self.assertEqual(h.state['forced_action']['action'], 'cards')

    def test_extra_cards_finishes_before_the_remaining_clever_effect(self):
        h = self.h
        self.prepare_cards_and_clever()
        h.act({'type': 'cards'})
        if h.state['pending_choice']['type'] == 'discard_cards':
            h.choose(h.state['pending_choice']['options'][0]['value'])
        self.assertEqual(h.state['pending_choice']['type'], 'move_action_card')
        self.assertEqual(h.player['action_cards']['cards']['slot'], 1)
        h.choose('sponsors:1')
        self.assertEqual(h.player['action_cards']['sponsors']['slot'], 1)
        self.assertEqual(h.player['action_cards']['cards']['slot'], 2)
        self.assertEqual(h.state['current_player'], 'p2')
        self.assertNotIn('suspended_actions', h.state)

    def test_skipping_extra_action_resumes_the_remaining_effect_once(self):
        h = self.h
        self.prepare_cards_and_clever()
        old_slot = h.player['action_cards']['cards']['slot']
        h.act({'type': 'skip_extra_action'})
        self.assertEqual(h.player['action_cards']['cards']['slot'], old_slot)
        self.assertEqual(h.state['pending_choice']['type'], 'move_action_card')
        h.choose('sponsors:1')
        self.assertEqual(h.state['current_player'], 'p2')
        self.assertNotIn('suspended_actions', h.state)

    def test_hypnosis_cannot_play_a_sponsor_disqualified_by_animal_appeal(self):
        h = self.h
        building = h.building(1)
        h.hand('485', '222')
        h.player.update(money=100, appeal=24, x_tokens=2, partner_zoos=['europe'])
        rules._recompute_tags(h.player)
        h.state['players']['p2']['appeal'] = 30
        h.helper.set_slot(h.state, 'p2', 'sponsors', 3)
        h.animal_action([{'card_id': '485', 'enclosure_id': building['id']}], choose_effect_order=True)
        refs = h.state['pending_choice']['_effects']
        h.choose(next(i for i, ref in enumerate(refs) if ref.get('ability_id') == 'hypnosis'))
        h.choose('appeal:p2')
        self.assertEqual(h.player['appeal'], 26)
        self.assertEqual(h.player['action_cards']['animals']['slot'], 1)
        h.choose('sponsors')
        before = copy.deepcopy(h.state)
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {'type': 'sponsors', 'card_ids': ['222'], 'x_tokens': 2})
        self.assertIsNotNone(error)
        self.assertEqual(h.state, before)
        h.act({'type': 'skip_extra_action'})
        self.assertEqual(h.state['current_player'], 'p2')

    def test_hypnotized_build_ii_allows_marked_cells_but_sponsors_does_not(self):
        h = self.h
        building = rules._place_building(h.state, 'p1', {'building_type': 'standard_enclosure', 'size': 1, 'cells': ['I3']}, [], free=True)
        rules._place_building(h.state, 'p1', {'building_type': 'pavilion', 'cells': ['H4']}, [], free=True)
        h.player['action_cards']['build']['upgraded'] = False
        h.hand('485')
        h.player.update(money=100, appeal=5, partner_zoos=['europe'])
        rules._recompute_tags(h.player)
        h.state['players']['p2']['appeal'] = 6
        h.helper.set_slot(h.state, 'p2', 'build', 3)
        h.state['players']['p2']['action_cards']['build']['upgraded'] = True
        h.animal_action([{'card_id': '485', 'enclosure_id': building['id']}], choose_effect_order=True)
        refs = h.state['pending_choice']['_effects']
        h.choose(next(i for i, ref in enumerate(refs) if ref.get('ability_id') == 'hypnosis'))
        h.choose('appeal:p2')
        h.choose('build')
        comparison = copy.deepcopy(h.state)
        comparison['players']['p1']['_action_level_overrides'] = {'sponsors': 2}
        self.assertEqual(rules._validate_building_placement(comparison, 'p1', {'building_type': 'pavilion', 'cells': ['H3']}),
                         'Build II is required for a marked space')
        h.act({'type': 'build', 'buildings': [{'building_type': 'pavilion', 'cells': ['H3']}]})
        self.assertIn('H3', h.player['map']['occupancy'])
        self.assertFalse(h.player['action_cards']['build']['upgraded'])
        self.assertNotIn('_action_level_overrides', h.player)
