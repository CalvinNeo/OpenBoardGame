import copy
import random
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import FIXTURES, pick_card_ids, replay_fixture


class GuandanWildAllocationTests(unittest.TestCase):
    @staticmethod
    def call(name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    @staticmethod
    def hand(labels):
        deck = guandan._full_deck()
        ids = set(pick_card_ids(deck, labels))
        return [card for card in deck if card['id'] in ids]

    def test_bomb_target_pays_for_every_wildcard(self):
        hand = self.hand(('♠️K', '♥️K', '♣️K', '♥️2', '♥️2'))
        bombs = [c for c in self.call('_wild_structure_ranked_candidates', hand, 2)
                 if c['kind'] == 'bomb']
        self.assertEqual({(c['target_size'], c['needed_wilds']) for c in bombs}, {(4, 1), (5, 2)})
        self.assertEqual(self.call('_wild_structure_potential', hand, 2), max(c['score'] for c in bombs))

    def test_two_wildcards_can_create_a_bomb_from_a_pair(self):
        hand = self.hand(('♠️9', '♥️9', '♥️2', '♥️2'))
        candidate = self.call('_wild_structure_ranked_candidates', hand, 2)[0]
        self.assertEqual((candidate['kind'], candidate['needed_wilds'], candidate['target_size']),
                         ('bomb', 2, 4))
        self.assertEqual(guandan._evaluate_combo(hand, 2, {})['type'], 'bomb')

    def test_overlapping_straights_cannot_spend_the_same_support_twice(self):
        hand = self.hand(('♦️A', '♠️3', '♥️4', '♣️5', '♦️6', '♥️2', '♥️2'))
        candidates = self.call('_wild_structure_ranked_candidates', hand, 2)
        self.assertGreater(len(candidates), 1)
        self.assertEqual(self.call('_wild_structure_potential', hand, 2),
                         max(c['score'] for c in candidates))

    def test_disjoint_triples_can_use_one_wildcard_each(self):
        hand = self.hand(('♠️3', '♥️3', '♣️3', '♠️K', '♥️K', '♣️K', '♥️2', '♥️2'))
        candidates = self.call('_wild_structure_ranked_candidates', hand, 2)
        scores = sorted([c['score'] for c in candidates
                         if c['kind'] == 'bomb' and c['needed_wilds'] == 1], reverse=True)
        self.assertAlmostEqual(self.call('_wild_structure_potential', hand, 2), scores[0] + 0.72 * scores[1])

    def test_straight_flushes_cannot_reuse_suited_cards_with_duplicate_ranks(self):
        hand = self.hand(('♠️10', '♠️J', '♠️Q', '♠️K',
                          '♣️10', '♥️J', '♣️Q', '♦️K', '♥️2', '♥️2'))
        candidates = self.call('_wild_structure_ranked_candidates', hand, 2)
        flush_scores = [c['score'] for c in candidates if c['kind'] == 'straight_flush']
        run_scores = [c['score'] for c in candidates if c['kind'] == 'straight']
        self.assertGreater(len(flush_scores), 1)
        # The four spades can support only one flush. The other suits can
        # independently support an ordinary run with the second wildcard.
        self.assertAlmostEqual(self.call('_wild_structure_potential', hand, 2),
                               max(flush_scores) + 0.72 * max(run_scores))

    def test_small_run_has_less_option_value_than_large_run_and_new_bomb(self):
        small = self.hand(('♦️A', '♠️3', '♥️4', '♣️5', '♥️2'))
        high = self.hand(('♦️10', '♠️J', '♥️Q', '♣️K', '♥️2'))
        bomb = self.hand(('♠️9', '♥️9', '♣️9', '♥️2'))
        values = [self.call('_wild_structure_potential', hand, 2) for hand in (small, high, bomb)]
        self.assertLess(values[0], values[1])
        self.assertLess(values[1], values[2])
        self.assertEqual(values[0], self.call('_wild_structure_potential', small + self.hand(('🃏B',)), 2))

    def test_small_run_does_not_borrow_a_bigger_runs_value(self):
        hand = self.hand(('♦️A', '♠️3', '♥️4', '♣️5', '♦️6', '♥️2', '♠️K', '♥️K', '♣️K'))
        penalties = []
        for labels in (('♦️A', '♠️3', '♥️4', '♣️5', '♥️2'),
                       ('♠️3', '♥️4', '♣️5', '♦️6', '♥️2')):
            ids = pick_card_ids(hand, labels)
            played = [c for c in hand if c['id'] in ids]
            combo = guandan._evaluate_combo(played, 2, {})
            penalties.append(self.call('_route_wild_misuse_penalty', hand, ids, combo, 2, played))
        self.assertGreater(penalties[0], penalties[1])
        self.assertGreater(penalties[1], 0)

    def test_shared_wildcard_is_not_an_independent_entry_for_small_run(self):
        state = replay_fixture('c94', 36)
        penalty = self.call('_stranded_wild_run_pass_penalty', state, 'bot2')
        self.assertGreater(penalty, 0)
        # Swap in a physically distinct big joker as an independent entry.
        own = state['players']['bot2']['hand']
        enemy = state['players']['calvin']['hand']
        own_index = next(i for i, c in enumerate(own) if c.get('rank') == 10)
        enemy_index = next(i for i, c in enumerate(enemy) if c.get('joker') == 'big')
        own[own_index], enemy[enemy_index] = enemy[enemy_index], own[own_index]
        state['_ai_eval_cache'] = {}
        self.assertLess(self.call('_stranded_wild_run_pass_penalty', state, 'bot2'), penalty)
        state['current_trick'] = None
        self.assertEqual(self.call('_stranded_wild_run_pass_penalty', state, 'bot2'), 0)

    def test_wild_run_is_allowed_as_the_final_hand(self):
        state = replay_fixture('c94', 36, {'bot_mode': 'heuristic'})
        hand = state['players']['bot2']['hand']
        ids = pick_card_ids(hand, ('♦️A', '♥️2', '♦️3', '♠️4', '♠️5'))
        state['players']['bot2']['hand'] = [c for c in hand if c['id'] in ids]
        state['seen_cards'].extend(c['id'] for c in hand if c['id'] not in ids)
        state.update(current_trick=None, pass_count=0, trick_plays={})
        action = guandan.GuandanGame.bot_move(state, 'bot2')
        self.assertEqual(set(action['card_ids']), set(ids))

    def test_saved_round_and_wheel_break_are_reproducible(self):
        self.assertEqual(len(FIXTURES['c94']['actions']), 71)
        state = replay_fixture('c94', 52)
        ids = pick_card_ids(state['players']['bot2']['hand'], ('♦️A', '♥️2', '♦️3', '♠️4', '♠️5'))
        combo = self.call('_action_combo', state, 'bot2', {'type': 'play', 'card_ids': ids})
        self.assertEqual((combo['type'], combo['high_value']), ('straight', 5))
        later = replay_fixture('c94', 56)
        self.assertFalse(any(c.get('rank') == 14 for c in later['players']['bot2']['hand']))
        final = replay_fixture('c94', 72)
        self.assertEqual(final['finish_order'], ['calvin', 'z', 'bot2', 'bot4'])

    def test_saved_single_response_can_abandon_small_run_and_keep_wild_bomb(self):
        state = replay_fixture('c94', 36, {'bot_mode': 'heuristic'})
        action = guandan.GuandanGame.bot_move(state, 'bot2')
        hand = state['players']['bot2']['hand']
        self.assertEqual(action['card_ids'], pick_card_ids(hand, ('♠️5',)))
        remaining = guandan._remove_cards(hand, action['card_ids'])
        bomb = pick_card_ids(remaining, ('♠️K', '♥️K', '♦️K', '♥️2'))
        self.assertEqual(guandan._evaluate_combo([c for c in remaining if c['id'] in bomb], 2, {})['type'], 'bomb')

    def test_saved_triple_response_sheds_a_whole_set(self):
        state = replay_fixture('c94', 62, {'bot_mode': 'heuristic'})
        action = guandan.GuandanGame.bot_move(state, 'bot4')
        self.assertEqual(action['type'], 'play')
        combo = self.call('_action_combo', state, 'bot4', action)
        self.assertEqual(combo['type'], 'three')
        self.assertFalse(combo['uses_wild'])

    def test_root_scores_do_not_change_when_hidden_cards_are_redistributed(self):
        for step, labels in ((36, ('♠️10',)), (38, ('🃏B',)), (62, ('♣️K', '♦️K', '♥️K'))):
            state = replay_fixture('c94', step)
            player = state['current_turn']
            ids = pick_card_ids(state['players'][player]['hand'], labels)
            public = guandan.GuandanGame.get_public_view(state, player)
            expected = guandan._bot_score_components(state, player, ids, 2)
            for seed in (7, 19):
                changed = copy.deepcopy(state)
                targets = [pid for pid in state['turn_order'] if pid != player]
                pool = sum((changed['players'][pid]['hand'] for pid in targets), [])
                random.Random(seed).shuffle(pool)
                for pid in targets:
                    count = len(changed['players'][pid]['hand'])
                    changed['players'][pid]['hand'], pool = pool[:count], pool[count:]
                changed['_ai_eval_cache'] = {}
                self.assertEqual(guandan.GuandanGame.get_public_view(changed, player), public)
                with self.subTest(step=step, seed=seed):
                    self.assertEqual(guandan._bot_score_components(changed, player, ids, 2), expected)


if __name__ == '__main__':
    unittest.main()
