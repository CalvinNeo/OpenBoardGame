from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from tests import test_ark_nova_rule_regressions as fixtures


class ArkNovaEffectAuditRegressions(unittest.TestCase):
    def setUp(self) -> None:
        self.h = fixtures.ArkNovaRuleRegressions()
        self.h.setUp()

    def play_expert(self, card_id: str) -> None:
        h = self.h
        h.hand(card_id)
        h.helper.set_slot(h.state, 'p1', 'sponsors', 5)
        h.act({'type': 'sponsors', 'card_ids': [card_id]})
        self.assertEqual(h.state['pending_choice']['type'], 'place_free_building')

    def start_pilfering(self, own_appeal: int, other_appeal: int,
                       own_conservation: int = 0, other_conservation: int = 0) -> None:
        h = self.h
        enclosure = h.building(3)
        h.hand('458')
        h.player.update(money=100, appeal=own_appeal, conservation=own_conservation,
                        partner_zoos=['asia'])
        h.player['active_effects']['219'] = {'modifier': 'ignore_water_rock_rules'}
        rules._recompute_tags(h.player)
        h.state['players']['p2'].update(appeal=other_appeal, conservation=other_conservation,
                                       hand=[], money=20)
        h.animal_action([{'card_id': '458', 'enclosure_id': enclosure['id']}],
                        choose_effect_order=True)
        pending = h.state['pending_choice']
        self.assertEqual(pending['type'], 'effect_order')
        h.choose(next(i for i, ref in enumerate(pending['_effects'])
                      if ref.get('ability_id') == 'pilfering_2'))

    def test_experts_build_the_printed_type_even_if_payload_names_another(self) -> None:
        for card_id, expected_type in [('210', 'kiosk'), ('211', 'standard_enclosure'),
                                       ('213', 'pavilion')]:
            with self.subTest(card_id=card_id):
                self.setUp()
                self.play_expert(card_id)
                h = self.h
                cells = rules._find_placement(h.state, 'p1', expected_type, 1)
                h.choose({'building_type': 'standard_enclosure', 'cells': cells})
                built = h.player['map']['buildings'][-1]
                self.assertEqual((built['building_type'], built['size']), (expected_type, 1))

    def test_expert_on_europe_accepts_cells_without_type_or_size(self) -> None:
        self.play_expert('211')
        h = self.h
        cells = rules._find_placement(h.state, 'p1', 'standard_enclosure', 1)
        h.choose({'cells': cells})
        built = h.player['map']['buildings'][-1]
        self.assertEqual((built['building_type'], built['size']), ('standard_enclosure', 1))

    def test_experts_cannot_substitute_larger_free_buildings(self) -> None:
        for card_id, building_type, size in [('210', 'petting_zoo', 3),
                                            ('211', 'standard_enclosure', 5),
                                            ('213', 'petting_zoo', 3)]:
            with self.subTest(card_id=card_id):
                self.setUp()
                self.play_expert(card_id)
                h = self.h
                cells = rules._find_placement(h.state, 'p1', building_type, size)
                self.assertIsNotNone(cells)
                before = copy.deepcopy(h.state)
                _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {
                    'type': 'resolve_choice', 'choice_id': h.state['pending_choice']['choice_id'],
                    'selection': {'building_type': building_type, 'size': size, 'cells': cells},
                })
                self.assertIsNotNone(error)
                self.assertEqual(h.state, before)

    def test_expert_free_buildings_remain_optional(self) -> None:
        self.play_expert('211')
        self.h.choose([])
        self.assertFalse(self.h.player['map']['buildings'])
        self.assertIsNone(self.h.state['pending_choice'])

    def test_pilfering_can_choose_self_when_tied_for_appeal(self) -> None:
        self.start_pilfering(20, 20)
        h = self.h
        pending = h.state['pending_choice']
        self.assertEqual(pending['type'], 'resolve_attack')
        self.assertEqual({o['value'] for o in pending['options']}, {'appeal:p1', 'appeal:p2'})
        money = h.player['money']
        h.choose('appeal:p1')
        h.finish_choices()
        self.assertEqual(h.player['money'], money)
        self.assertEqual(h.state['players']['p2']['money'], 20)
        self.assertIsNone(h.state['pending_choice'])

    def test_pilfering_two_can_skip_just_one_tied_criterion(self) -> None:
        for selected_id, criterion in [('appeal:p1|conservation:p2', 'conservation'),
                                       ('appeal:p2|conservation:p1', 'appeal')]:
            with self.subTest(criterion=criterion):
                self.setUp()
                self.start_pilfering(20, 20, 3, 3)
                h = self.h
                money = h.player['money']
                h.choose(selected_id)
                self.assertEqual(h.state['pending_choice']['type'], 'pilfering')
                self.assertEqual(h.state['pending_choice']['criterion'], criterion)
                h.choose('money')
                h.finish_choices()
                self.assertEqual(h.player['money'], money + 5)
                self.assertEqual(h.state['players']['p2']['money'], 15)
                self.assertIsNone(h.state['pending_choice'])

    def test_pilfering_two_can_choose_self_for_both_tied_criteria(self) -> None:
        self.start_pilfering(20, 20, 3, 3)
        h = self.h
        money = h.player['money']
        h.choose('appeal:p1|conservation:p1')
        h.finish_choices()
        self.assertEqual(h.player['money'], money)
        self.assertEqual(h.state['players']['p2']['money'], 20)

    def test_pilfering_has_no_choice_when_self_is_the_only_leader(self) -> None:
        self.start_pilfering(30, 20, 3, 2)
        self.h.finish_choices()
        self.assertIsNone(self.h.state['pending_choice'])
        self.assertEqual(self.h.state['players']['p2']['money'], 20)

    def test_pilfering_cannot_choose_self_when_not_tied(self) -> None:
        self.start_pilfering(10, 20)
        h = self.h
        pending = h.state['pending_choice']
        self.assertEqual([o['value'] for o in pending['options']], ['appeal:p2'])
        before = copy.deepcopy(h.state)
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {
            'type': 'resolve_choice', 'choice_id': pending['choice_id'],
            'selection': 'appeal:p1',
        })
        self.assertIsNotNone(error)
        self.assertEqual(h.state, before)

    def test_pilfering_still_requires_choosing_between_tied_opponents(self) -> None:
        h = self.h
        h.state['players']['p3'] = copy.deepcopy(h.state['players']['p2'])
        h.state['players']['p3'].update(appeal=20, conservation=0, hand=[], money=20)
        h.state['turn_order'].append('p3')
        self.start_pilfering(10, 20)
        pending = h.state['pending_choice']
        self.assertEqual({o['value'] for o in pending['options']}, {'appeal:p2', 'appeal:p3'})
        before = copy.deepcopy(h.state)
        _, error = rules.ArkNovaGame.apply_action(h.state, 'p1', {
            'type': 'resolve_choice', 'choice_id': pending['choice_id'], 'selection': [],
        })
        self.assertIsNotNone(error)
        self.assertEqual(h.state, before)
        h.choose('appeal:p3')
        self.assertEqual(h.state['pending_choice']['player_id'], 'p3')
        h.choose('money')
        h.finish_choices()
        self.assertEqual(h.state['players']['p2']['money'], 20)
        self.assertEqual(h.state['players']['p3']['money'], 15)


if __name__ == '__main__':
    unittest.main()
