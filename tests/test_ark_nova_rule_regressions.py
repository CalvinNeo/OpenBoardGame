from __future__ import annotations

import copy
import json
import unittest

from game import ark_nova as rules
from game import ark_nova_effects as effects
from game.ark_nova_ai import choose_ark_nova_action
from tests import test_ark_nova_game as fixtures


class ArkNovaRuleRegressions(unittest.TestCase):
    def setUp(self):
        self.helper = fixtures.ArkNovaGameTests()
        self.state = self.helper.make_state()

    @property
    def player(self):
        return self.state['players']['p1']

    def act(self, action, player_id='p1'):
        events, error = rules.ArkNovaGame.apply_action(self.state, player_id, action)
        self.assertIsNone(error, action)
        return events

    def choose(self, value):
        pending = self.state['pending_choice']
        self.assertIsNotNone(pending)
        return self.act({'type': 'resolve_choice', 'choice_id': pending['choice_id'], 'selection': value}, pending['player_id'])

    def finish_choices(self):
        for _ in range(100):
            pending = self.state.get('pending_choice')
            if not pending:
                return
            kind = pending['type']
            if kind == 'effect_order':
                self.choose('all')
            elif pending['min'] == 0:
                self.choose([])
            elif kind == 'place_free_enclosure':
                cells = rules._find_placement(self.state, pending['player_id'], 'standard_enclosure', pending['size'])
                self.choose({'cells': cells})
            else:
                values = [item.get('value', item.get('id')) for item in pending['options']]
                self.choose(values[:pending['min']] if pending['min'] > 1 else values[0])
        self.fail('Choice flow failed to terminate')

    def building(self, size, kind='standard_enclosure'):
        self.player['action_cards']['build']['upgraded'] = True
        cells = rules._find_placement(self.state, 'p1', kind, size)
        self.assertIsNotNone(cells)
        result = rules._place_building(self.state, 'p1', {'building_type': kind, 'size': size, 'cells': cells}, [], free=True)
        # These are pre-existing buildings in a scenario, not a turn being played.
        self.state['pending_choice'] = None
        self.state['pending_queue'] = []
        self.state['effect_queue'] = []
        self.state.pop('after_action_core_effects', None)
        self.state['phase'] = 'action'
        return result

    def zoo_animal(self, card_id, building):
        card = rules.ANIMAL_CARDS[card_id]
        option_type = 'standard' if building['building_type'] == 'standard_enclosure' else building['building_type']
        spaces = next(item['required_spaces'] for item in card['enclosure_options'] if item['type'] == option_type)
        building['occupied_by'].append(card_id)
        building['occupied'] = True
        building['used_capacity'] += spaces
        self.player['played_animals'].append(card_id)
        self.player['animal_records'].append({'card_id': card_id, 'enclosure_id': building['id'],
            'enclosure_type': building['building_type'], 'enclosure_size': building['size'],
            'printed_enclosure_size': rules._printed_standard_enclosure_size(card), 'capacity_used': spaces})
        rules._recompute_tags(self.player)

    def hand(self, *card_ids):
        self.player['hand'] = []
        for card_id in card_ids:
            self.helper.add_hand_card(self.state, 'p1', card_id)

    def animal_action(self, plays, **kwargs):
        self.helper.set_slot(self.state, 'p1', 'animals', 5)
        return self.act({'type': 'animals', 'plays': plays, **kwargs})

    def test_paid_and_free_pavilions_each_gain_one_appeal(self):
        self.act({'type': 'build', 'buildings': [{'building_type': 'pavilion', 'cells': ['A3']}]})
        self.assertEqual(self.player['appeal'], 1)
        self.building(2)
        rules._place_building(self.state, 'p1', {'building_type': 'pavilion', 'cells': ['B3']}, [], free=True)
        self.assertEqual(self.player['appeal'], 2)

    def test_build_two_enclosure_sizes_and_engineer_copy_strength(self):
        self.player['money'] = 100
        self.helper.set_slot(self.state, 'p1', 'build', 5)
        initial = copy.deepcopy(self.state)
        specs = []
        for size in [1, 2]:
            b = self.building(size)
            specs.append({'building_type': 'standard_enclosure', 'size': size, 'cells': b['cells']})
        self.state = initial
        self.player['action_cards']['build']['upgraded'] = True
        self.act({'type': 'build', 'buildings': specs})
        self.assertEqual([b['size'] for b in self.player['map']['buildings']], [1, 2])
        self.assertEqual(self.player['money'], 94)

    def test_large_animal_program_ignores_one_icon_not_the_whole_clause(self):
        lion = rules.ANIMAL_CARDS['402']
        self.player['active_effects']['263'] = {'modifier': 'large_animal_ignore_condition'}
        for icons, expected in [(0, False), (1, False), (2, True), (3, True)]:
            with self.subTest(predators=icons):
                self.player['tags']['predator'] = icons
                self.assertEqual(rules._card_conditions_met(self.player, lion, ignore_count=1), expected)
                self.assertEqual(rules._card_with_context('402', self.player)['conditions_met'], expected)

    def test_archaeologist_repeats_uncovered_bonus_and_covering_still_pays(self):
        self.player['money'] = 0
        for _ in range(2):
            rules._queue_choice(self.state, {'choice_id': 'archaeologist', 'type': 'claim_placement_bonus',
                'player_id': 'p1', 'options': [{'value': 'E3'}], 'min': 1, 'max': 1})
            self.choose('E3')
        self.assertEqual(self.player['money'], 20)
        self.assertNotIn('E3', self.player['map']['claimed_bonuses'])
        self.player['map']['occupancy']['E3'] = 'new-building'
        rules._apply_placement_bonus(self.state, 'p1', 'E3', [])
        self.assertEqual(self.player['money'], 30)
        self.assertIn('E3', self.player['map']['claimed_bonuses'])

    def test_other_players_crossing_waits_for_their_own_turn(self):
        other = self.state['players']['p2']
        other['conservation'] = 20
        other['appeal'] = rules._target_appeal(20) - 1
        rules._apply_rewards(self.state, 'p2', {'appeal': 2}, [], '251')
        self.act({'type': 'gain_x', 'action_card': 'cards'})
        self.assertFalse(self.state['final_round']['active'])
        self.act({'type': 'gain_x', 'action_card': 'cards'}, 'p2')
        self.assertTrue(self.state['final_round']['active'])
        self.assertEqual(self.state['final_round']['triggered_by'], 'p2')

    def test_pilfering_two_has_no_conservation_target_at_zero_points(self):
        self.player['appeal'] = 5
        self.state['players']['p2']['appeal'] = 20
        context = effects.EffectContext(state=self.state, player_id='p1', card_id='458')
        result = effects.execute_ability('pilfering_2', context)
        self.assertIsNotNone(result.pending_choice)
        self.assertNotIn('conservation', json.dumps(result.pending_choice['options']))
        rules._consume_attack_event(self.state, {'player_id': 'p1', 'attack': 'pilfering_2',
            'assignments': [{'target_player_id': 'p2', 'criterion': 'appeal'}]}, [])
        self.assertEqual(self.state['pending_choice']['criterion'], 'appeal')
        self.assertFalse(self.state['pending_queue'])

    def test_break_card_income_options_refresh_between_players(self):
        for player in self.state['players'].values():
            player['hand'] = []
            player['claimed_map_rewards'] = ['card_income']
        self.state['break_triggered_by'] = 'p1'
        rules._resolve_break(self.state, [])
        first = self.state['display'][0]
        self.choose('display:' + first)
        pending = self.state['pending_choice']
        self.assertEqual(pending['player_id'], 'p2')
        values = [item['value'] for item in pending['options']]
        self.assertNotIn('display:' + first, values)
        self.assertIn('display:' + self.state['display'][0], values)
        self.choose('display:' + self.state['display'][0])
        self.assertIsNone(self.state['pending_choice'])

    def test_break_sponsor_income_refills_before_next_player(self):
        for player in self.state['players'].values():
            player['hand'] = []
        self.player['played_sponsors'] = ['201']
        self.state['players']['p2']['claimed_map_rewards'] = ['card_income']
        self.state['break_triggered_by'] = 'p1'
        rules._resolve_break(self.state, [])
        first = self.state['display'][0]
        pending = self.state['pending_choice']
        value = next(item['value'] for item in pending['options'] if first in str(item))
        self.choose(value)
        pending = self.state['pending_choice']
        self.assertEqual(pending['player_id'], 'p2')
        self.assertNotIn(first, str(pending['options']))
        self.assertIn('display:' + self.state['display'][0], str(pending['options']))

    def test_display_stays_hidden_until_every_initial_hand_is_kept(self):
        self.state = rules.ArkNovaGame.init_game({'seed': 7}, [{'player_id': 'p1', 'seat': 0}, {'player_id': 'p2', 'seat': 1}])
        for viewer in ['p1', 'p2', 'spectator']:
            self.assertEqual(rules.ArkNovaGame.get_public_view(self.state, viewer)['display'], [None] * 6)
        self.act({'type': 'keep_initial_cards', 'card_ids': self.player['hand'][:4]})
        self.assertEqual(rules.ArkNovaGame.get_public_view(self.state, 'p1')['display'], [None] * 6)
        self.act({'type': 'keep_initial_cards', 'card_ids': self.state['players']['p2']['hand'][:4]}, 'p2')
        self.assertTrue(all(card and card['id'] for card in rules.ArkNovaGame.get_public_view(self.state, 'p1')['display']))

    def test_venom_rolls_back_an_entire_turn_after_hunter_choice(self):
        enclosure = self.building(2)
        self.hand('404')
        self.player['money'] = 9
        self.player['action_cards']['build']['venom_tokens'] = 1
        self.helper.set_slot(self.state, 'p1', 'animals', 5)
        self.state['deck'] = ['201', '405']
        before = copy.deepcopy(self.state)
        self.animal_action([{'card_id': '404', 'enclosure_id': enclosure['id']}])
        self.assertEqual(self.player['money'], 0)
        self.assertEqual(self.state['pending_choice']['type'], 'keep_revealed_cards')
        events = self.choose('405')
        self.assertTrue(any(event['type'] == 'ark_nova:turn_undone' for event in events))
        self.assertIsNone(self.state['pending_choice'])
        self.assertEqual(self.player, before['players']['p1'])
        self.assertEqual(self.state['deck'], before['deck'])
        self.assertEqual(self.state['current_player'], 'p1')
        self.act({'type': 'gain_x', 'action_card': 'build'})
        self.assertEqual(self.state['current_player'], 'p2')

    def test_first_animals_sale_funds_second_card_before_action_card_moves(self):
        small = self.building(1)
        medium = self.building(2)
        self.hand('473', '419', '201', '202')
        self.player['money'] = 9
        self.animal_action([{'card_id': '473', 'enclosure_id': small['id']},
                            {'card_id': '419', 'enclosure_id': medium['id']}])
        self.assertEqual(self.player['played_animals'], ['473'])
        self.assertEqual(self.player['action_cards']['animals']['slot'], 5)
        self.choose(['201', '202'])
        self.assertEqual(self.player['played_animals'], ['473', '419'])
        self.assertEqual(self.player['money'], 3)
        self.assertEqual(self.player['action_cards']['animals']['slot'], 1)
        self.finish_choices()

    def test_hunter_draw_can_be_chosen_as_second_animal(self):
        first = self.building(2)
        second = self.building(2)
        self.hand('404')
        self.player['money'] = 100
        self.state['deck'] = ['201', '419']
        self.animal_action([{'card_id': '404', 'enclosure_id': first['id']}], continue_action=True)
        self.choose('419')
        self.assertEqual(self.state['pending_choice']['type'], 'continue_cards')
        self.choose({'card_id': '419', 'enclosure_id': second['id']})
        self.assertEqual(self.player['played_animals'], ['404', '419'])
        self.finish_choices()

    def test_sponsor_icons_unlock_next_sponsor_after_draw_choice(self):
        self.hand('201', '205')
        self.player['universities'] = ['university_science']
        rules._recompute_tags(self.player)
        self.helper.set_slot(self.state, 'p1', 'sponsors', 5)
        self.player['action_cards']['sponsors']['upgraded'] = True
        self.player['x_tokens'] = 2
        self.act({'type': 'sponsors', 'card_ids': ['201', '205'], 'x_tokens': 2})
        self.assertEqual(self.player['played_sponsors'], ['201'])
        self.choose('deck')
        self.assertEqual(self.player['played_sponsors'], ['201', '205'])
        self.finish_choices()

    def test_venom_can_resolve_before_the_animals_printed_appeal(self):
        enclosure = self.building(2)
        self.player['active_effects']['219'] = {'modifier': 'ignore_water_rock_rules'}
        self.hand('449')
        self.player['money'] = 100
        self.player['appeal'] = 5
        self.state['players']['p2']['appeal'] = 7
        self.animal_action([{'card_id': '449', 'enclosure_id': enclosure['id']}], choose_effect_order=True)
        pending = self.state['pending_choice']
        self.assertEqual(pending['type'], 'effect_order')
        self.assertEqual(self.player['appeal'], 5)
        index = next(index for index, ref in enumerate(pending['_effects']) if ref.get('ability_id') == 'venom')
        self.choose(index)
        self.assertTrue(any(card.get('venom_tokens') for card in self.state['players']['p2']['action_cards'].values()))
        self.assertEqual(self.player['appeal'], 9)

    def test_after_action_effects_offer_an_order_after_both_animals_finish(self):
        first = self.building(2)
        second = self.building(1)
        self.hand('419', '415')
        self.player['money'] = 100
        self.animal_action([{'card_id': '419', 'enclosure_id': first['id']},
                            {'card_id': '415', 'enclosure_id': second['id']}], choose_effect_order=True)
        pending = self.state['pending_choice']
        self.assertEqual(self.player['played_animals'], ['419', '415'])
        self.assertEqual(self.player['action_cards']['animals']['slot'], 1)
        self.assertEqual(pending['type'], 'effect_order')
        self.assertTrue(all(ref.get('timing') == 'after_action' for ref in pending['_effects']))
        self.finish_choices()

    def test_release_empties_smallest_eligible_tile_not_the_recorded_tile(self):
        larger = self.building(5)
        smaller = self.building(4)
        self.zoo_animal('402', larger)
        self.zoo_animal('473', smaller)
        self.player['appeal'] = 20
        rules._remove_released_animal(self.state, 'p1', '402', [])
        self.assertTrue(rules._building_occupied(larger))
        self.assertFalse(rules._building_occupied(smaller))
        self.assertEqual(self.player['appeal'], 11)
        self.assertIn('402', self.state['discard'])
        self.assertEqual(self.player['animal_records'][0]['enclosure_id'], None)
        _, _, error = rules._enclosure_for_animal(self.player, rules.ANIMAL_CARDS['419'], larger['id'])
        self.assertEqual(error, 'standard enclosure is occupied')

    def test_release_can_remove_special_tokens_instead_of_a_standard_tile(self):
        standard = self.building(3)
        special = self.building(5, 'reptile_house')
        self.zoo_animal('490', standard)
        self.zoo_animal('481', special)
        before_capacity = special['used_capacity']
        rules._remove_released_animal(self.state, 'p1', '490', [])
        self.assertEqual(self.state['pending_choice']['type'], 'release_enclosure')
        self.choose(special['id'])
        buildings = {b['id']: b for b in self.player['map']['buildings']}
        self.assertTrue(rules._building_occupied(buildings[standard['id']]))
        self.assertEqual(buildings[special['id']]['used_capacity'], before_capacity - 2)

    def test_new_reptile_house_can_move_multiple_existing_animals(self):
        large = self.building(3)
        small = self.building(1)
        self.zoo_animal('490', large)
        self.zoo_animal('473', small)
        cells = rules._find_placement(self.state, 'p1', 'reptile_house', 5)
        self.helper.set_slot(self.state, 'p1', 'build', 5)
        self.player['money'] = 100
        self.act({'type': 'build', 'buildings': [{'building_type': 'reptile_house', 'cells': cells}]})
        while self.state['pending_choice']['type'] == 'take_card':
            self.choose('deck')
        self.assertEqual(self.state['pending_choice']['type'], 'move_animals')
        self.choose({'card_id': '490', 'enclosure_id': large['id']})
        self.assertEqual(self.state['pending_choice']['type'], 'move_animals')
        self.choose({'card_id': '473', 'enclosure_id': small['id']})
        self.assertIsNone(self.state['pending_choice'])
        buildings = {b['id']: b for b in self.player['map']['buildings']}
        self.assertFalse(rules._building_occupied(buildings[large['id']]))
        self.assertFalse(rules._building_occupied(buildings[small['id']]))
        house = next(b for b in buildings.values() if b['building_type'] == 'reptile_house')
        self.assertEqual(house['used_capacity'], 2)
        self.assertEqual(set(house['occupied_by']), {'490', '473'})
        self.assertEqual(self.state['current_player'], 'p2')

    def test_bot_can_resolve_new_order_and_migration_choices(self):
        enclosure = self.building(2)
        self.hand('449')
        self.player['active_effects']['219'] = {'modifier': 'ignore_water_rock_rules'}
        self.player['money'] = 100
        self.animal_action([{'card_id': '449', 'enclosure_id': enclosure['id']}], choose_effect_order=True)
        action = choose_ark_nova_action(self.state, 'p1')
        self.assertIsNotNone(action)
        self.act(action)
        self.finish_choices()

    def test_finish_continuation_keeps_unused_capacity_and_advances_turn(self):
        first = self.building(2)
        self.building(2)
        self.hand('404', '419')
        self.player['money'] = 100
        self.state['deck'] = ['201', '202']
        self.animal_action([{'card_id': '404', 'enclosure_id': first['id']}], continue_action=True)
        self.assertEqual(self.state['pending_choice']['type'], 'continue_cards')
        self.choose([])
        self.assertEqual(self.player['played_animals'], ['404'])
        self.assertIn('419', self.player['hand'])
        self.assertEqual(self.state['current_player'], 'p2')

    def test_each_owner_keeps_control_of_their_simultaneous_effect_order(self):
        self.state['choose_effect_order'] = True
        refs = rules._reward_effects('p1', {'money': 1, 'appeal': 1}, 'test')
        refs += rules._reward_effects('p2', {'money': 1, 'appeal': 1}, 'test')
        rules._enqueue_card_effects(self.state, [rules._effect_group('p1', refs)], [])
        first_id = self.state['pending_choice']['choice_id']
        before = self.state['players']['p2']['money']
        self.choose('all')
        self.assertEqual(self.state['pending_choice']['player_id'], 'p2')
        self.assertNotEqual(self.state['pending_choice']['choice_id'], first_id)
        self.assertEqual(self.state['players']['p2']['money'], before)
        self.choose('all')
        self.assertEqual(self.state['players']['p2']['money'], before + 1)

    def test_break_crossing_gives_the_triggering_player_a_final_turn_too(self):
        for player in self.state['players'].values():
            player['hand'] = []
        other = self.state['players']['p2']
        other['conservation'] = 0
        other['appeal'] = rules._target_appeal(1)
        other['claimed_map_rewards'] = ['conservation_1_income']
        self.helper.set_slot(self.state, 'p1', 'sponsors', 5)
        self.state['break_position'] = self.state['break_limit'] - 1
        events = self.act({'type': 'sponsors', 'mode': 'break'})
        self.assertTrue(self.state['final_round']['active'])
        self.assertEqual(self.state['final_round']['triggered_by'], 'p2')
        self.assertEqual(self.state['current_player'], 'p2')
        self.assertEqual(self.state['final_round']['remaining'], ['p1'])
        self.assertTrue(any(event['type'] == 'ark_nova:final_round' and event['payload']['during_break'] for event in events))

    def test_release_tie_is_a_real_choice_and_invalid_choice_is_transactional(self):
        bound = self.building(4)
        first = self.building(2)
        second = self.building(2)
        self.zoo_animal('419', bound)
        self.zoo_animal('473', first)
        self.zoo_animal('477', second)
        rules._remove_released_animal(self.state, 'p1', '419', [])
        self.assertEqual({item['value'] for item in self.state['pending_choice']['options']}, {first['id'], second['id']})
        before = copy.deepcopy(self.state)
        _, error = rules.ArkNovaGame.apply_action(self.state, 'p1', {'type': 'resolve_choice', 'selection': bound['id']})
        self.assertIsNotNone(error)
        self.assertEqual(self.state, before)
        self.choose(second['id'])
        buildings = {b['id']: b for b in self.player['map']['buildings']}
        self.assertTrue(rules._building_occupied(buildings[first['id']]))
        self.assertFalse(rules._building_occupied(buildings[second['id']]))

    def test_release_prefers_terrain_match_then_falls_back_to_size(self):
        wet_cell = next(cell for cell in rules.MAP_CELLS if rules._adjacent_terrain([cell], 'water'))
        self.player['map']['buildings'] = [
            {'id': 'small-dry', 'building_type': 'standard_enclosure', 'size': 4, 'occupied': True, 'cells': []},
            {'id': 'large-wet', 'building_type': 'standard_enclosure', 'size': 5, 'occupied': True, 'cells': [wet_cell]},
        ]
        card = rules.ANIMAL_CARDS['479']
        self.assertEqual([b['id'] for b in rules._standard_enclosures_to_empty(self.player, card)], ['large-wet'])
        self.player['map']['buildings'][1]['cells'] = []
        self.assertEqual([b['id'] for b in rules._standard_enclosures_to_empty(self.player, card)], ['small-dry'])
        self.player['map']['buildings'][0]['size'] = 2
        self.player['map']['buildings'][1]['size'] = 3
        self.assertEqual(rules._standard_enclosures_to_empty(self.player, card), [])

    def test_engineer_copy_costs_money_but_no_extra_strength(self):
        self.player['money'] = 100
        self.helper.set_slot(self.state, 'p1', 'build', 3)
        self.player['action_cards']['build']['upgraded'] = True
        self.player['active_effects']['217'] = {'modifier': 'extra_same_building'}
        initial = copy.deepcopy(self.state)
        specs = []
        for size in [1, 1, 2]:
            b = self.building(size)
            specs.append({'building_type': 'standard_enclosure', 'size': size, 'cells': b['cells']})
        self.state = initial
        self.act({'type': 'build', 'buildings': specs})
        self.assertEqual(len(self.player['map']['buildings']), 3)
        self.assertEqual(self.player['money'], 92)

    def test_declining_migration_closes_the_construction_window(self):
        standard = self.building(3)
        self.zoo_animal('490', standard)
        cells = rules._find_placement(self.state, 'p1', 'reptile_house', 5)
        self.helper.set_slot(self.state, 'p1', 'build', 5)
        self.player['money'] = 100
        self.act({'type': 'build', 'buildings': [{'building_type': 'reptile_house', 'cells': cells}]})
        while self.state['pending_choice']['type'] == 'take_card':
            self.choose('deck')
        pending_id = self.state['pending_choice']['choice_id']
        self.choose([])
        self.assertTrue(rules._building_occupied(self.player['map']['buildings'][0]))
        self.assertFalse(self.state.get('effect_queue'))
        _, error = rules.ArkNovaGame.apply_action(self.state, 'p1', {'type': 'resolve_choice', 'choice_id': pending_id, 'selection': {'card_id': '490', 'enclosure_id': standard['id']}})
        self.assertIsNotNone(error)

    def test_new_action_flags_pass_the_registered_schema(self):
        from jsonschema import Draft7Validator
        from game.definitions import ARK_NOVA_ACTION_SCHEMA
        validator = Draft7Validator(ARK_NOVA_ACTION_SCHEMA)
        for action in [
            {'type': 'animals', 'plays': [{'card_id': '419', 'enclosure_id': 'flock'}], 'continue_action': True, 'choose_effect_order': True},
            {'type': 'sponsors', 'card_ids': ['201'], 'continue_action': True, 'choose_effect_order': True},
            {'type': 'build', 'buildings': [{'building_type': 'pavilion', 'cells': ['A3']}], 'choose_effect_order': True},
        ]:
            with self.subTest(action=action['type']):
                self.assertFalse(list(validator.iter_errors(action)))
