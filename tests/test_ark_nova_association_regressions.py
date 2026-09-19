from __future__ import annotations

import copy
import unittest

from jsonschema import Draft7Validator

from game import ark_nova as rules
from game import ark_nova_ai as ai
from game.definitions import ARK_NOVA_ACTION_SCHEMA
from tests import test_ark_nova_game as fixtures


class ArkNovaAssociationRegressions(unittest.TestCase):
    def setUp(self):
        self.helper = fixtures.ArkNovaGameTests()
        self.state = self.helper.make_state()
        self.helper.set_slot(self.state, 'p1', 'association', 5)

    @property
    def player(self):
        return self.state['players']['p1']

    def act(self, action):
        pending = self.state.get('pending_choice')
        player_id = pending['player_id'] if pending else 'p1'
        events, error = rules.ArkNovaGame.apply_action(self.state, player_id, action)
        self.assertIsNone(error, (action, error))
        return events

    def choose(self, value):
        self.act({'type': 'resolve_choice', 'choice_id': self.state['pending_choice']['choice_id'], 'selection': value})

    def finish_choices(self):
        for _ in range(30):
            pending = self.state.get('pending_choice')
            if not pending:
                return
            if pending['type'] == 'effect_order':
                self.choose('all')
            elif pending['type'] == 'conservation_2':
                self.choose({'kind': 'upgrade', 'action': 'cards'})
            elif pending['type'] == 'choose_map_reward':
                self.choose('money_12')
            elif pending['type'] == 'conservation_bonus':
                self.choose({'kind': 'money', 'amount': 5})
            else:
                self.choose(pending['options'][0]['value'])
        self.fail('Association choices did not finish')

    def breeding_scenario(self):
        self.player['played_animals'] = ['473']
        self.player['partner_zoos'] = ['africa']
        self.player['conservation'] = 1
        self.player['reputation'] = 9
        self.player['reputation_milestones_resolved'] = [5, 8]
        self.player['action_cards']['cards']['upgraded'] = False
        rules._recompute_tags(self.player)
        self.helper.add_hand_card(self.state, 'p1', '125')

    def support_breeding(self, reward='money_12', choose_order=True):
        self.act({'type': 'association', 'choose_effect_order': choose_order,
                  'tasks': [{'task': 'support_project', 'project_id': '125', 'slot': 2,
                             **({'reward_id': reward} if reward else {})}]})

    def wildcard_scenario(self, project='103'):
        self.player['played_animals'] = ['473']
        self.player['partner_zoos'] = ['africa', 'europe']
        self.player['universities'] = ['university_science']
        self.player['played_sponsors'] = ['215', '218']
        self.player['conservation'] = 10
        self.player['milestones_resolved'] = [2, 5, 8]
        self.state['final_card_gate_reached'] = True
        for card_id in ('215', '218'):
            self.player['card_tokens'][card_id] = 2
            self.player['active_effects'][card_id] = {'modifier': 'base_project_wild_icon', 'card_id': card_id}
        rules._recompute_tags(self.player)
        self.state['projects'] = [project]
        self.state['dynamic_projects'] = []
        self.state['project_slots'] = {project: []}
        self.state['blocked_project_slots'] = [{'project_id': project, 'position': 1}]

    def test_project_conservation_upgrade_precedes_its_reputation(self):
        self.breeding_scenario()
        self.support_breeding()
        self.assertEqual(self.state['pending_choice']['type'], 'effect_order')
        self.choose(0)
        self.assertEqual(self.state['pending_choice']['type'], 'conservation_2')
        self.assertEqual(self.player['reputation'], 9)
        self.choose({'kind': 'upgrade', 'action': 'cards'})
        self.finish_choices()
        self.assertEqual(self.player['reputation'], 11)
        self.assertEqual(self.player['conservation'], 3)
        self.assertEqual(self.state['current_player'], 'p2')

    def test_map_reward_can_resolve_before_project_rewards(self):
        self.breeding_scenario()
        self.support_breeding('conservation_1_income')
        refs = self.state['pending_choice']['_effects']
        self.choose(next(i for i, ref in enumerate(refs) if ref.get('operation') == 'project_map_reward'))
        self.assertEqual(self.player['conservation'], 2)
        self.assertEqual(self.player['reputation'], 9)
        self.choose({'kind': 'upgrade', 'action': 'cards'})
        self.finish_choices()
        self.assertEqual(self.player['reputation'], 11)
        self.assertEqual(self.player['conservation'], 4)

    def test_default_reward_order_also_waits_for_milestone(self):
        self.breeding_scenario()
        self.support_breeding(choose_order=False)
        self.assertEqual(self.state['pending_choice']['type'], 'conservation_2')
        self.assertEqual(self.player['reputation'], 9)
        self.finish_choices()
        self.assertEqual(self.player['reputation'], 11)

    def test_legacy_unspecified_map_reward_still_prompts(self):
        self.breeding_scenario()
        self.support_breeding(reward=None, choose_order=False)
        self.finish_choices()
        self.assertIn('money_12', self.player['claimed_map_rewards'])
        self.assertEqual(self.state['current_player'], 'p2')

    def test_two_breeding_cards_supply_two_icons_and_spend_one_each(self):
        self.wildcard_scenario()
        action = {'type': 'association', 'tasks': [{'task': 'support_project', 'project_id': '103',
                  'slot': 2, 'wild_token_card_ids': ['215', '218'], 'reward_id': 'money_12'}]}
        self.assertEqual(list(Draft7Validator(ARK_NOVA_ACTION_SCHEMA).iter_errors(action)), [])
        self.act(action)
        self.assertEqual(self.player['card_tokens'], {'215': 1, '218': 1})
        self.assertEqual(self.player['conservation'], 13)
        self.assertEqual(len(self.player['wild_project_uses']), 2)

    def test_duplicate_card_cannot_spend_two_tokens_transactionally(self):
        self.wildcard_scenario()
        before = copy.deepcopy(self.state)
        _, error = rules.ArkNovaGame.apply_action(self.state, 'p1', {'type': 'association', 'tasks': [
            {'task': 'support_project', 'project_id': '103', 'slot': 2,
             'wild_token_card_ids': ['215', '215'], 'reward_id': 'money_12'}]})
        self.assertIn('only one', error)
        self.assertEqual(self.state, before)

    def test_public_eligibility_depends_on_selected_wildcard_count(self):
        self.wildcard_scenario()
        project = rules._project_public_view(self.state, '103', 'p1')
        self.assertNotIn(2, project['eligible_slots'])
        self.assertNotIn(2, project['eligible_slots_by_wild_count']['1'])
        self.assertIn(2, project['eligible_slots_by_wild_count']['2'])
        self.assertEqual(project['available_wild_token_card_ids'], ['215', '218'])

    def test_legacy_single_wildcard_remains_supported(self):
        self.wildcard_scenario('109')
        project = rules._project_public_view(self.state, '109', 'p1')
        self.assertEqual(project['eligible_slots'], [])
        self.assertIn(3, project['eligible_slots_by_wild_count']['1'])
        self.act({'type': 'association', 'tasks': [{'task': 'support_project', 'project_id': '109',
                  'slot': 3, 'wild_token_card_id': '215', 'reward_id': 'money_12'}]})
        self.assertEqual(self.player['card_tokens'], {'215': 1, '218': 2})

    def test_bot_enumerates_combined_wildcard_project(self):
        self.wildcard_scenario()
        candidates = ai._project_tasks(self.state, 'p1')
        self.assertTrue(any(task.get('slot') == 2 and task.get('wild_token_card_ids') == ['215', '218']
                            for task in candidates))

    def test_reputation_at_cards_one_cap_cannot_unlock_donation(self):
        self.player['reputation'] = 9
        self.player['action_cards']['association']['upgraded'] = True
        before = copy.deepcopy(self.state)
        _, error = rules.ArkNovaGame.apply_action(self.state, 'p1', {
            'type': 'association', 'tasks': [{'task': 'reputation'}], 'donate': True})
        self.assertIn('cannot increase', error)
        self.assertEqual(self.state, before)

    def test_reputation_at_fifteen_converts_to_appeal_and_allows_donation(self):
        self.player['reputation'] = 15
        self.player['appeal'] = 20
        self.player['action_cards']['cards']['upgraded'] = True
        self.player['action_cards']['association']['upgraded'] = True
        self.act({'type': 'association', 'tasks': [{'task': 'reputation'}], 'donate': True})
        self.assertEqual(self.player['appeal'], 22)
        self.assertEqual(self.player['conservation'], 1)

    def test_university_worker_can_fund_later_partner_task(self):
        self.player['action_cards']['association']['upgraded'] = True
        self.player['reputation'] = 6
        self.player['reputation_milestones_resolved'] = [5]
        self.player['x_tokens'] = 2
        self.act({'type': 'association', 'x_tokens': 2, 'tasks': [
            {'task': 'university', 'university_id': 'university_reputation'},
            {'task': 'partner_zoo', 'continent': 'africa'}]})
        self.assertEqual(self.player['association_workers_total'], 2)
        self.assertEqual(self.player['available_workers'], 0)
        self.assertIn('africa', self.player['partner_zoos'])

    def test_project_money_reward_can_fund_donation(self):
        self.wildcard_scenario()
        self.player['money'] = 0
        self.player['action_cards']['association']['upgraded'] = True
        self.act({'type': 'association', 'donate': True, 'tasks': [
            {'task': 'support_project', 'project_id': '103', 'slot': 3, 'reward_id': 'money_12'}]})
        self.assertEqual(self.player['money'], 10)
        self.assertEqual(self.player['conservation'], 13)

    def test_has_association_task_checks_real_reputation_and_project_options(self):
        self.player['reputation'] = 9
        self.assertFalse(rules._has_association_task(self.state, 'p1', 2))
        self.player['reputation'] = 15
        self.player['action_cards']['cards']['upgraded'] = True
        self.assertTrue(rules._has_association_task(self.state, 'p1', 2))
        self.player['appeal'] = 113
        self.assertFalse(rules._has_association_task(self.state, 'p1', 2))
        self.wildcard_scenario()
        self.state['association_supply']['partner_zoos'] = []
        self.state['association_supply']['universities'] = []
        self.state['blocked_project_slots'].append({'project_id': '103', 'position': 3})
        self.player['hand'] = []
        self.assertTrue(rules._has_association_task(self.state, 'p1', 5))
        self.player['card_tokens']['218'] = 0
        self.assertFalse(rules._has_association_task(self.state, 'p1', 5))


if __name__ == '__main__':
    unittest.main()
