import copy
import unittest
from unittest import mock
from game import guandan, guandan_ai

class ForcedPassHorizonTests(unittest.TestCase):
    def setUp(self):
        self.deck = guandan._full_deck()
        players = [{'player_id': f'p{i}', 'name': f'p{i}', 'seat': i} for i in range(4)]
        self.state = guandan.GuandanGame.init_game({}, players)
        self.state.update(phase='playing', current_turn='p0', current_trick=None,
                          pass_count=0, finish_order=[], round_memories=[], level_rank=2,
                          visible_card_id=None, known_card_owners={}, pass_limits={},
                          trick_plays={}, _ai_sampled_world=True)
        self.used = set()
        for i in range(4):
            self.state['players'][f'p{i}'].update(hand=[], finished=False, finish_rank=None)

    def cards(self, rank, count):
        found = [c for c in self.deck if c.get('rank') == rank and c['id'] not in self.used][:count]
        self.assertEqual(len(found), count)
        self.used.update(c['id'] for c in found)
        return found

    def setup_bomb(self, finish_leader=False):
        bomb = self.cards(14, 4)
        rest = [] if finish_leader else self.cards(3, 2)
        self.state['players']['p0']['hand'] = bomb + rest
        for i in range(1, 4):
            self.state['players'][f'p{i}']['hand'] = self.cards(i + 4, 2)
        self.state['seen_cards'] = [c['id'] for c in self.deck if c['id'] not in self.used]
        self.assertIsNone(guandan.GuandanGame.apply_action(
            self.state, 'p0', {'type': 'play', 'card_ids': [c['id'] for c in bomb]})[1])

    def test_reply_sees_lead_after_three_forced_passes(self):
        self.setup_bomb()
        before = copy.deepcopy(self.state)
        with mock.patch.object(guandan_ai, '_evaluate_state_for_bot',
                               side_effect=lambda s, b: 1.0 if 'p0' in s['finish_order'] else 0.0):
            self.assertEqual(guandan._mcts_reply_tree_value(self.state, 'p0', 1, 10, 0), 1.0)
        self.assertEqual(self.state, before)

    def test_rollout_sees_lead_after_three_forced_passes(self):
        self.setup_bomb()
        with mock.patch.object(guandan_ai, '_evaluate_state_for_bot', return_value=0.0):
            guandan._rollout_value(self.state, 'p0', 1)
        self.assertEqual(self.state['finish_order'][0], 'p0')

    def test_zero_depth_resolves_only_forced_passes_and_inherits_partner_lead(self):
        self.setup_bomb(finish_leader=True)
        leaves = []
        def evaluate(s, b):
            leaves.append(copy.deepcopy(s))
            return 0.0
        with mock.patch.object(guandan_ai, '_evaluate_state_for_bot', side_effect=evaluate):
            guandan._mcts_reply_tree_value(self.state, 'p0', 0, 10, 0)
        self.assertEqual(leaves[-1]['current_turn'], 'p2')
        self.assertIsNone(leaves[-1]['current_trick'])
        self.assertEqual(leaves[-1]['finish_order'], ['p0'])
        self.assertEqual(len(leaves[-1]['players']['p2']['hand']), 2)

    def test_partner_uses_preserved_choice_after_finished_leader(self):
        self.setup_bomb(finish_leader=True)
        with mock.patch.object(guandan_ai, '_evaluate_state_for_bot',
                               side_effect=lambda s, b: 1.0 if 'p2' in s['finish_order'] else 0.0):
            self.assertEqual(guandan._mcts_reply_tree_value(self.state, 'p0', 1, 10, 0), 1.0)

    def test_voluntary_pass_still_spends_one_choice(self):
        lead = self.cards(3, 1)
        self.state['players']['p0']['hand'] = lead + self.cards(4, 2)
        for i in range(1, 4):
            self.state['players'][f'p{i}']['hand'] = self.cards(i + 4, 2)
        self.state['seen_cards'] = [c['id'] for c in self.deck if c['id'] not in self.used]
        self.assertIsNone(guandan.GuandanGame.apply_action(
            self.state, 'p0', {'type': 'play', 'card_ids': [lead[0]['id']]})[1])
        self.assertTrue(guandan._list_hint_options(self.state, 'p1'))
        with mock.patch.object(guandan, '_candidate_actions', return_value=[{'type': 'pass'}]), \
             mock.patch.object(guandan, '_filter_overbomb_actions', side_effect=lambda s, p, a: a), \
             mock.patch.object(guandan_ai, '_evaluate_state_for_bot',
                               side_effect=lambda s, b: float(s['pass_count'])):
            self.assertEqual(guandan._mcts_reply_tree_value(self.state, 'p0', 1, 10, 0), 1.0)
        with mock.patch.object(guandan_ai, '_rollout_policy_action', return_value={'type': 'pass'}), \
             mock.patch.object(guandan_ai, '_evaluate_state_for_bot', return_value=0.0):
            guandan._rollout_value(self.state, 'p0', 1)
        self.assertEqual(self.state['current_turn'], 'p2')
        self.assertEqual(self.state['pass_count'], 1)

    def test_deadline_in_forced_chain_interrupts_without_mutating_root(self):
        self.setup_bomb()
        before = copy.deepcopy(self.state)
        clock = [0.0]
        real_action = guandan.GuandanGame.apply_action
        def apply(s, p, a):
            result = real_action(s, p, a)
            clock[0] = 11.0
            return result
        with mock.patch.object(guandan_ai.time, 'perf_counter', side_effect=lambda: clock[0]), \
             mock.patch.object(guandan.GuandanGame, 'apply_action', side_effect=apply), \
             mock.patch.object(guandan_ai._CORE_LOCAL, 'deadline', 10.0, create=True), \
             mock.patch.object(guandan_ai, '_evaluate_state_for_bot') as evaluate:
            with self.assertRaises(guandan_ai._MctsSearchInterrupted):
                guandan._mcts_reply_tree_value(self.state, 'p0', 1, 10, 0)
            evaluate.assert_not_called()
        self.assertEqual(self.state, before)

    def test_terminal_state_is_not_extended(self):
        self.setup_bomb()
        self.state['phase'] = 'round_end'
        with mock.patch.object(guandan_ai, '_next_actor') as actor, \
             mock.patch.object(guandan_ai, '_evaluate_state_for_bot', return_value=42.0):
            self.assertEqual(guandan._mcts_reply_tree_value(self.state, 'p0', 1, 10, 0), 42.0)
            self.assertEqual(guandan._rollout_value(self.state, 'p0', 1), 42.0)
            actor.assert_not_called()

if __name__ == '__main__':
    unittest.main(verbosity=2)
