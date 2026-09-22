from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from game.ark_nova_ai import choose_ark_nova_action
from tests import test_ark_nova_rule_regressions as fixtures


class ArkNovaAuditRegressions(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.ArkNovaRuleRegressions()
        self.h.setUp()

    def choose_effect(self, predicate):
        pending = self.h.state['pending_choice']
        self.assertEqual(pending['type'], 'effect_order')
        self.h.choose(next(i for i, ref in enumerate(pending['_effects']) if predicate(ref)))

    def offer_bonus(self, token_id):
        h = self.h
        h.player['conservation'] = 4
        h.player['milestones_resolved'] = [2]
        h.state['bonus_tokens']['5'] = [token_id]
        rules._apply_rewards(h.state, 'p1', {'conservation': 1}, [], 'regression')

    def claim_bonus(self, token_id):
        self.offer_bonus(token_id)
        return self.h.choose({'kind': 'token', 'token_id': token_id})

    def enable_small_program(self):
        h = self.h
        h.player.update(money=100, played_sponsors=['228', '219'], partner_zoos=['africa'])
        h.player['active_effects'].update({
            '228': {'modifier': 'small_animal_action_chain'},
            '219': {'modifier': 'ignore_water_rock_rules'},
        })
        h.state['display'] = ['201', '202', '203', '204', '205', '206']

    def test_pilfering_twice_refreshes_resources_and_ai_can_finish(self):
        cases = [
            (0, ['201'], 'card', ['money']),
            (3, ['201'], 'card', ['money']),
            (5, ['201'], 'money', ['card']),
            (8, ['201'], 'money', ['card']),
            (10, ['201'], 'money', ['money', 'card']),
            (0, [], 'money', ['money']),
        ]
        for money, hand, first_choice, expected_options in cases:
            with self.subTest(money=money, hand=hand, first_choice=first_choice):
                self.setUp()
                h = self.h
                enclosure = h.building(3)
                h.hand('458')
                h.player.update(money=100, appeal=0, conservation=0, partner_zoos=['asia'])
                h.player['active_effects']['219'] = {'modifier': 'ignore_water_rock_rules'}
                rules._recompute_tags(h.player)
                h.state['players']['p2'].update(appeal=40, conservation=1, money=money, hand=list(hand))
                h.animal_action([{'card_id': '458', 'enclosure_id': enclosure['id']}], choose_effect_order=True)
                self.choose_effect(lambda ref: ref.get('ability_id') == 'pilfering_2')
                h.choose(h.state['pending_choice']['options'][0]['value'])
                h.choose(first_choice)
                pending = h.state['pending_choice']
                self.assertEqual(pending['type'], 'pilfering')
                self.assertEqual([o['value'] for o in pending['options']], expected_options)
                if expected_options == ['money']:
                    self.assertEqual(pending['options'][0]['label'], f"Give {min(5, money)} money")
                action = choose_ark_nova_action(h.state, 'p2')
                self.assertIsNotNone(action)
                h.act(action, 'p2')
                h.finish_choices()
                self.assertIsNone(h.state['pending_choice'])
                self.assertEqual(h.state['current_player'], 'p2')

    def test_existing_pilfer_choice_is_refreshed_when_loading_a_room(self):
        h = self.h
        h.state['players']['p2'].update(hand=[], money=0)
        h.state['pending_choice'] = {
            'choice_id': 'old-pilfer', 'type': 'pilfering', 'player_id': 'p2', 'attacker_id': 'p1',
            'criterion': 'conservation', 'options': [{'value': 'card', 'label': 'Give a card'}], 'min': 1, 'max': 1,
        }
        view = rules.ArkNovaGame.get_public_view(h.state, 'p2')
        self.assertEqual(view['pending_choice']['options'], [{'value': 'money', 'label': 'Give 0 money'}])
        h.choose('money')
        self.assertIsNone(h.state['pending_choice'])

    def test_repeated_attacks_do_not_spread_beyond_their_fixed_slots(self):
        for ability, card_id, existing_slot in [('venom', '449', 1), ('constriction', '482', 5)]:
            with self.subTest(ability=ability):
                self.setUp()
                h = self.h
                enclosure = h.building(2)
                h.hand(card_id)
                h.player.update(money=100, appeal=0, partner_zoos=['americas'])
                h.player['active_effects']['219'] = {'modifier': 'ignore_water_rock_rules'}
                target = h.state['players']['p2']
                target.update(appeal=40, conservation=0)
                next(c for c in target['action_cards'].values() if c['slot'] == existing_slot)[ability + '_tokens'] = 1
                h.animal_action([{'card_id': card_id, 'enclosure_id': enclosure['id']}], choose_effect_order=True)
                self.choose_effect(lambda ref: ref.get('ability_id') == ability)
                marked = [c['slot'] for c in h.state['players']['p2']['action_cards'].values() if c.get(ability + '_tokens')]
                self.assertEqual(marked, [existing_slot])

    def test_two_attack_tokens_discard_duplicates_in_either_target_slot(self):
        for attack, slots in [('venom', [1, 2]), ('constriction', [4, 5])]:
            for existing in [slots[:1], slots[1:], slots]:
                with self.subTest(attack=attack, existing=existing):
                    self.setUp()
                    h = self.h
                    h.player.update(appeal=0, conservation=0)
                    target = h.state['players']['p2']
                    target.update(appeal=40, conservation=1)
                    for card in target['action_cards'].values():
                        card[attack + '_tokens'] = int(card['slot'] in existing)
                    rules._consume_attack_event(h.state, {
                        'player_id': 'p1', 'attack': attack, 'parameters': {'tokens_per_target': 2},
                    }, [])
                    self.assertEqual(sorted(c['slot'] for c in target['action_cards'].values() if c.get(attack + '_tokens')), slots)

    def test_large_program_accepts_the_browser_placement_without_size(self):
        h = self.h
        h.hand('263')
        h.player['reputation'] = 6
        h.player['action_cards']['sponsors']['upgraded'] = True
        h.helper.set_slot(h.state, 'p1', 'sponsors', 5)
        h.act({'type': 'sponsors', 'card_ids': ['263']})
        self.assertEqual(h.state['pending_choice']['size'], 5)
        cells = rules._find_placement(h.state, 'p1', 'standard_enclosure', 5)
        h.choose({'building_type': 'standard_enclosure', 'cells': cells})
        self.assertTrue(any(b['building_type'] == 'standard_enclosure' and b['size'] == 5
                            for b in h.player['map']['buildings']))
        h.finish_choices()
        self.assertEqual(h.state['current_player'], 'p2')

    def test_large_program_cannot_substitute_a_smaller_free_building(self):
        h = self.h
        h.hand('263')
        h.player['reputation'] = 6
        h.player['action_cards']['sponsors']['upgraded'] = True
        h.helper.set_slot(h.state, 'p1', 'sponsors', 5)
        h.act({'type': 'sponsors', 'card_ids': ['263']})
        before = copy.deepcopy(h.state)
        cells = rules._find_placement(h.state, 'p1', 'standard_enclosure', 1)
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {
            'type': 'resolve_choice', 'selection': {'building_type': 'pavilion', 'size': 1, 'cells': cells},
        })
        self.assertEqual(error, 'building size does not match its cells')
        self.assertEqual(h.state, before)
        h.choose([])
        self.assertEqual(h.player['map']['buildings'], [])

    def test_setup_uses_the_nine_base_game_bonus_tiles(self):
        expected = {'reputation_2', 'money_10', 'enclosure_3', 'multiplier', 'x_tokens_3',
                    'card_3', 'university', 'partner_zoo', 'sponsor'}
        self.assertEqual(set(rules.BONUS_TOKEN_DEFS), expected)
        seen = set()
        for seed in range(12):
            state = rules.ArkNovaGame.init_game({'seed': seed}, [{'player_id': 'p1', 'seat': 0}, {'player_id': 'p2', 'seat': 1}])
            drawn = state['bonus_tokens']['5'] + state['bonus_tokens']['8']
            self.assertEqual(len(set(drawn)), 4)
            self.assertTrue(set(drawn) <= expected)
            seen.update(drawn)
        self.assertEqual(seen, expected)

    def test_old_unclaimed_bonus_tiles_migrate_with_the_pending_choice(self):
        h = self.h
        h.state['schema_version'] = 3
        h.state['bonus_tokens'] = {'5': ['upgrade', 'worker'], '8': ['appeal_5', 'card_2']}
        h.state['pending_choice'] = {
            'choice_id': 'cp5-p1', 'type': 'conservation_bonus', 'player_id': 'p1', 'threshold': 5,
            'options': [{'value': {'kind': 'token', 'token_id': 'upgrade'}, 'label': 'Upgrade'}], 'min': 1, 'max': 1,
        }
        view = rules.ArkNovaGame.get_public_view(h.state, 'p1')
        self.assertEqual(h.state['bonus_tokens'], {'5': ['sponsor', 'university'], '8': ['partner_zoo', 'card_3']})
        self.assertEqual([o['id'] for o in view['bonus_tokens']['5']], ['sponsor', 'university'])
        self.assertEqual(view['pending_choice']['options'][1]['value']['token_id'], 'sponsor')
        h.choose({'kind': 'money', 'amount': 5})
        self.assertIsNone(h.state['pending_choice'])

    def test_three_card_bonus_chooses_each_source_without_refilling_gaps(self):
        h = self.h
        h.hand()
        h.player['reputation'] = 2
        h.state['display'] = ['201', '202', '203', '204', '205', '206']
        h.state['deck'] = ['493', '488']
        action_cards = copy.deepcopy(h.player['action_cards'])
        self.claim_bonus('card_3')
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], ['deck', 'display:201', 'display:202'])
        first_id = h.state['pending_choice']['choice_id']
        h.choose('display:201')
        self.assertNotEqual(h.state['pending_choice']['choice_id'], first_id)
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], ['deck', 'display:202'])
        self.assertIsNone(h.state['display'][0])
        h.choose('deck')
        self.assertEqual(len(h.player['hand']), 2)
        h.choose('display:202')
        self.assertEqual(len(h.player['hand']), 3)
        self.assertTrue({'201', '202'} <= set(h.player['hand']))
        self.assertEqual(h.state['display'][:2], [None, None])
        self.assertIsNone(h.state['pending_choice'])
        self.assertEqual(h.player['action_cards'], action_cards)
        self.assertEqual(h.state['bonus_tokens']['5'], [])

    def test_partner_bonus_uses_supply_icons_and_second_tile_upgrade_without_a_worker(self):
        h = self.h
        h.player.update(partner_zoos=['africa'], available_workers=0)
        self.claim_bonus('partner_zoo')
        h.choose('americas')
        self.assertEqual(h.player['partner_zoos'], ['africa', 'americas'])
        self.assertEqual(h.player['tags']['americas'], 1)
        self.assertNotIn('americas', h.state['association_supply']['partner_zoos'])
        self.assertEqual(h.player['available_workers'], 0)
        self.assertEqual(h.state['pending_choice']['type'], 'upgrade_action')
        h.choose('animals')
        self.assertTrue(h.player['action_cards']['animals']['upgraded'])

    def test_university_bonus_uses_available_tile_and_grants_its_upgrade(self):
        h = self.h
        h.player.update(universities=['university_science'], available_workers=0)
        h.state['association_supply']['universities'] = ['university_hand_limit']
        self.claim_bonus('university')
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], ['university_hand_limit'])
        h.choose('university_hand_limit')
        self.assertEqual(h.player['hand_limit'], 5)
        self.assertEqual(h.player['reputation'], 1)
        self.assertEqual(h.player['tags']['science'], 2)
        self.assertEqual(h.player['available_workers'], 0)
        self.assertEqual(h.state['association_supply']['universities'], [])
        self.assertEqual(h.state['pending_choice']['type'], 'upgrade_action')
        h.choose('cards')
        self.assertTrue(h.player['action_cards']['cards']['upgraded'])

    def test_partner_bonus_cannot_bypass_map_limit_with_borrowed_association_ii(self):
        h = self.h
        h.player['partner_zoos'] = ['africa', 'americas']
        h.player['_action_level_overrides'] = {'association': 2}
        self.offer_bonus('partner_zoo')
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], [{'kind': 'money', 'amount': 5}])
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {
            'type': 'resolve_choice', 'selection': {'kind': 'token', 'token_id': 'partner_zoo'},
        })
        self.assertEqual(error, 'no eligible Association tile is available')
        self.assertEqual(h.state['bonus_tokens']['5'], ['partner_zoo'])
        h.choose({'kind': 'money', 'amount': 5})

    def test_bonus_can_take_third_partner_with_own_upgrade_during_borrowed_association_i(self):
        h = self.h
        h.player['partner_zoos'] = ['africa', 'americas']
        h.player['action_cards']['association']['upgraded'] = True
        h.player['_action_level_overrides'] = {'association': 1}
        workers = h.player['available_workers']
        self.claim_bonus('partner_zoo')
        h.choose('asia')
        self.assertEqual(len(h.player['partner_zoos']), 3)
        self.assertEqual(h.player['available_workers'], workers + 1)

    def test_empty_association_supply_leaves_the_five_money_option(self):
        h = self.h
        h.state['association_supply']['universities'] = []
        self.offer_bonus('university')
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], [{'kind': 'money', 'amount': 5}])
        money = h.player['money']
        h.choose({'kind': 'money', 'amount': 5})
        self.assertEqual(h.player['money'], money + 5)

    def test_paid_sponsor_bonus_uses_card_level_and_only_eligible_hand_cards(self):
        h = self.h
        h.hand('203', '201', '205')
        h.player['money'] = 10
        h.helper.set_slot(h.state, 'p1', 'sponsors', 1)
        h.state['display'] = ['210', '202', '204', '206', '207', '208']
        self.claim_bonus('sponsor')
        self.assertEqual(h.state['pending_choice']['type'], 'play_sponsor_for_money')
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], ['203'])
        before = copy.deepcopy(h.state)
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {'type': 'resolve_choice', 'selection': '210'})
        self.assertIsNotNone(error)
        self.assertEqual(h.state, before)
        h.choose('203')
        self.assertEqual(h.player['money'], 6)
        self.assertIn('203', h.player['played_sponsors'])
        self.assertEqual(h.player['action_cards']['sponsors']['slot'], 1)
        self.assertIsNone(h.state['pending_choice'])

    def test_paid_sponsor_bonus_can_be_declined_or_have_no_affordable_card(self):
        for money in [0, 10]:
            with self.subTest(money=money):
                self.setUp()
                h = self.h
                h.hand('203')
                h.player['money'] = money
                self.claim_bonus('sponsor')
                if money:
                    self.assertEqual(h.state['pending_choice']['min'], 0)
                    h.choose([])
                self.assertIsNone(h.state['pending_choice'])
                self.assertEqual(h.player['hand'], ['203'])
                self.assertEqual(h.player['money'], money)

    def test_ai_can_complete_each_new_bonus_choice(self):
        for token in ['partner_zoo', 'university', 'card_3', 'sponsor']:
            with self.subTest(token=token):
                self.setUp()
                h = self.h
                h.hand('203')
                self.claim_bonus(token)
                for _ in range(10):
                    pending = h.state['pending_choice']
                    if not pending:
                        break
                    action = choose_ark_nova_action(h.state, pending['player_id'])
                    self.assertIsNotNone(action)
                    h.act(action, pending['player_id'])
                self.assertIsNone(h.state['pending_choice'])

    def test_small_program_finishes_before_hippos_extra_sponsors_action(self):
        h = self.h
        enclosure = h.building(2)
        h.hand('430', '211', '445')
        self.enable_small_program()
        h.state['display'][0] = '484'
        h.helper.set_slot(h.state, 'p1', 'sponsors', 4)
        h.animal_action([{'card_id': '430', 'enclosure_id': enclosure['id']}])
        self.assertEqual(h.state['pending_choice']['type'], 'small_animal_program')
        self.assertEqual([o['value'] for o in h.state['pending_choice']['options']], ['skip'])
        self.assertEqual(h.player['action_cards']['animals']['slot'], 5)
        self.assertNotIn('forced_action', h.state)
        h.choose('skip')
        self.assertEqual(h.state['pending_choice']['type'], 'take_small_display')
        self.assertEqual(h.player['action_cards']['animals']['slot'], 5)
        h.choose('484')
        self.assertEqual(h.player['action_cards']['animals']['slot'], 1)
        h.choose('sponsors')
        h.act({'type': 'sponsors', 'card_ids': ['211']})
        cells = rules._find_placement(h.state, 'p1', 'standard_enclosure', 1)
        h.choose({'building_type': 'standard_enclosure', 'cells': cells})
        self.assertEqual(h.player['played_animals'], ['430'])
        self.assertIn('445', h.player['hand'])
        self.assertEqual(h.state['current_player'], 'p2')
        self.assertIsNone(h.state['pending_choice'])

    def test_small_programs_extra_animal_defers_its_own_after_finishing_effect(self):
        h = self.h
        first, extra = h.building(2), h.building(2)
        h.hand('414', '430')
        self.enable_small_program()
        h.state['display'][0] = '484'
        h.animal_action([{'card_id': '414', 'enclosure_id': first['id']}])
        h.choose({'card_id': '430', 'enclosure_id': extra['id']})
        self.assertEqual(h.state['pending_choice']['type'], 'take_small_display')
        self.assertEqual(h.player['action_cards']['animals']['slot'], 5)
        self.assertNotIn('forced_action', h.state)
        h.choose('484')
        self.assertEqual(h.player['action_cards']['animals']['slot'], 1)
        h.choose('sponsors')
        h.act({'type': 'sponsors', 'mode': 'break'})
        self.assertEqual(h.state['current_player'], 'p2')

    def test_old_room_already_waiting_for_small_program_can_finish_its_bonus(self):
        h = self.h
        first, extra = h.building(2), h.building(1)
        h.hand('414', '493')
        self.enable_small_program()
        h.animal_action([{'card_id': '414', 'enclosure_id': first['id']}])
        self.assertEqual(h.state['pending_choice']['type'], 'small_animal_program')
        # Old saves opened this same choice after ending the Animals action.
        h.state.pop('card_sequence')
        rules._defer_turn_end(h.state, 'p1', 'animals', 0, [], resume=False)
        h.state['schema_version'] = 3
        h.choose({'card_id': '493', 'enclosure_id': extra['id']})
        self.assertEqual(h.player['played_animals'], ['414', '493'])
        self.assertEqual(h.state['current_player'], 'p2')
        self.assertIsNone(h.state['pending_choice'])

    def test_each_multiplier_repetition_finishes_its_small_program(self):
        h = self.h
        enclosures = [h.building(size) for size in [2, 1, 1, 1]]
        h.hand('414', '493', '486', '488')
        self.enable_small_program()
        h.player['action_cards']['animals']['multiplier_tokens'] = 1
        h.animal_action([{'card_id': '414', 'enclosure_id': enclosures[0]['id']}], use_multiplier_tokens=1)
        self.assertEqual(h.state['pending_choice']['type'], 'small_animal_program')
        h.choose({'card_id': '493', 'enclosure_id': enclosures[1]['id']})
        self.assertTrue(h.state['forced_action']['from_multiplier'])
        self.assertEqual(h.player['played_animals'], ['414', '493'])
        self.assertEqual(h.player['action_cards']['animals']['slot'], 5)
        h.act({'type': 'animals', 'plays': [{'card_id': '486', 'enclosure_id': enclosures[2]['id']}]})
        self.assertEqual(h.state['pending_choice']['type'], 'small_animal_program')
        h.choose({'card_id': '488', 'enclosure_id': enclosures[3]['id']})
        self.assertEqual(h.player['played_animals'], ['414', '493', '486', '488'])
        self.assertEqual(h.player['action_cards']['animals']['slot'], 1)
        self.assertEqual(h.state['current_player'], 'p2')

    def test_iconic_animal_counts_icons_after_the_chosen_okapi_effect(self):
        h = self.h
        h.zoo_animal('414', h.building(2))
        h.zoo_animal('415', h.building(2))
        enclosure = h.building(5)
        h.hand('436', '210')
        h.player.update(money=100, partner_zoos=['americas'], played_sponsors=['253'])
        h.player['active_effects']['253'] = {'modifier': 'okapi_sponsor_chain', 'card_id': '253'}
        h.player['card_tokens']['253'] = 3
        rules._recompute_tags(h.player)
        h.animal_action([{'card_id': '436', 'enclosure_id': enclosure['id']}], choose_effect_order=True)
        self.choose_effect(lambda ref: ref.get('operation') == 'okapi')
        h.choose('210')
        h.choose('all')
        h.choose([])
        self.assertEqual(sum(p.get('tags', {}).get('americas', 0) for p in h.state['players'].values()), 6)
        events = h.choose('all')
        gain = next(e['amount'] for e in events if e.get('source') == 'ability:iconic_animal' and e.get('track') == 'appeal')
        self.assertEqual(gain, 6)

    def test_icon_counts_still_exclude_the_next_animal_in_the_action(self):
        h = self.h
        enclosure = h.building(3, 'petting_zoo')
        h.hand('525', '526')
        h.player.update(money=100, appeal=0)
        h.animal_action([{'card_id': card_id, 'enclosure_id': enclosure['id']} for card_id in ['525', '526']])
        self.assertEqual(h.player['appeal'], 9)
        self.assertEqual(h.state['current_player'], 'p2')


if __name__ == '__main__':
    unittest.main()
