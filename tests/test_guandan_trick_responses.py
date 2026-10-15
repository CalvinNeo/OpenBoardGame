import copy
import itertools
import random
import unittest
from unittest import mock

from game import guandan, guandan_trick as trick
from tests.test_guandan_trick_boundary import make_state, pair, play


class CountOnlyHand(list):
    def __iter__(self):
        raise AssertionError("read another player's hand")

    def __getitem__(self, index):
        raise AssertionError("read another player's card")


class TrickResponsePolicyTests(unittest.TestCase):
    def teammate_single(self, own, opponent, mate=(3, 4, 7), other=(9, 11)):
        state = make_state({"bot": list(own), "opp": list(opponent),
                            "mate": list(mate), "opp2": list(other)})
        state["current_turn"] = "mate"
        cards = [state["players"]["mate"]["hand"][0]["id"]]
        for actor, action in (("mate", play(cards)), ("opp2", {"type": "pass"})):
            _, error = guandan.GuandanGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        return state

    def ranks(self, state, action):
        by_id = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        return sorted(by_id[card_id]["rank"] for card_id in action.get("card_ids", []))

    def test_block_one_card_enemy_even_when_teammate_owns_top_play(self):
        state = self.teammate_single([14, 5], [6])
        before = copy.deepcopy(state)
        for seed in range(12):
            action = trick.response_action(state, "bot", random.Random(seed))
            self.assertEqual(self.ranks(state, action), [14])
        self.assertEqual(state, before)

    def test_keep_stronger_control_when_cheaper_card_blocks_public_pool(self):
        state = self.teammate_single([2, 14, 5], [6])
        action = trick.response_action(state, "bot", random.Random(0))
        self.assertEqual(self.ranks(state, action), [14])

    def test_do_not_overtake_teammates_already_safe_single(self):
        state = self.teammate_single([2, 5], [6], mate=[14, 4, 7])
        for seed in range(12):
            self.assertEqual(trick.response_action(state, "bot", random.Random(seed)), {"type": "pass"})

    def test_do_not_overtake_teammate_with_an_ineffective_defence(self):
        state = self.teammate_single([5, 4], [6], mate=[3, 7, 8])
        target_card = state["players"]["opp"]["hand"][0]
        state["known_card_owners"] = {target_card["id"]: "opp"}
        self.assertEqual(trick.response_action(state, "bot", random.Random(0)), {"type": "pass"})

    def test_short_enemy_pair_is_blocked_without_reading_its_faces(self):
        state = make_state({"bot": [14, 14, 5, 5, 8], "opp": [6, 6],
                            "mate": [3, 3, 4, 7], "opp2": [9, 11]})
        state["current_turn"] = "mate"
        guandan.GuandanGame.apply_action(state, "mate", play(pair(state, "mate", 3)))
        guandan.GuandanGame.apply_action(state, "opp2", {"type": "pass"})
        self.assertEqual(self.ranks(state, trick.response_action(state, "bot", random.Random(0))), [14, 14])

    def test_one_card_enemy_cannot_finish_against_a_pair(self):
        state = make_state({"bot": [14, 14, 8], "opp": [6],
                            "mate": [3, 3, 4, 7], "opp2": [9, 11]})
        state["current_turn"] = "mate"
        guandan.GuandanGame.apply_action(state, "mate", play(pair(state, "mate", 3)))
        guandan.GuandanGame.apply_action(state, "opp2", {"type": "pass"})
        self.assertEqual(trick.response_action(state, "bot", random.Random(0)), {"type": "pass"})

    def test_short_threat_is_ignored_after_its_response_window_closes(self):
        state = self.teammate_single([14, 5], [6])
        state["pass_count"] = guandan._trick_passes_needed(state) - 1
        self.assertEqual(trick.response_action(state, "bot", random.Random(0)), {"type": "pass"})

    def test_last_defender_does_not_randomly_concede_a_one_card_leader(self):
        state = make_state({"bot": [14, 5], "opp": [3, 6], "mate": [4, 7], "opp2": [9, 11]})
        state["current_turn"] = "opp"
        low = state["players"]["opp"]["hand"][0]["id"]
        for actor, action in (("opp", play([low])), ("mate", {"type": "pass"}),
                              ("opp2", {"type": "pass"})):
            _, error = guandan.GuandanGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        refusing_rng = mock.Mock()
        refusing_rng.random.return_value = 1.0
        self.assertEqual(self.ranks(state, trick.response_action(state, "bot", refusing_rng)), [14])

    def test_open_teammate_window_does_not_force_every_short_enemy_takeover(self):
        state = make_state({"bot": [14, 5], "opp": [6, 8, 10], "mate": [4, 7], "opp2": [3, 9]})
        state["current_turn"] = "opp2"
        low = state["players"]["opp2"]["hand"][0]["id"]
        guandan.GuandanGame.apply_action(state, "opp2", play([low]))
        refusing_rng = mock.Mock()
        refusing_rng.random.return_value = 1.0
        self.assertEqual(trick.response_action(state, "bot", refusing_rng), {"type": "pass"})

    def test_cheap_teammate_relay_requires_a_public_return_control(self):
        state = self.teammate_single([4, 8], [6, 10, 12], mate=[3, 14, 7, 9], other=[5, 11, 13])
        willing_rng = mock.Mock()
        willing_rng.random.return_value = 0.0
        self.assertEqual(trick.response_action(state, "bot", willing_rng), {"type": "pass"})
        known_ace = next(card for card in state["players"]["mate"]["hand"] if card["rank"] == 14)
        state["known_card_owners"] = {known_ace["id"]: "mate"}
        self.assertEqual(self.ranks(state, trick.response_action(state, "bot", willing_rng)), [4])

    def test_cheap_relay_does_not_break_a_pair(self):
        state = self.teammate_single([4, 4], [6, 10, 12], mate=[3, 14, 7, 9], other=[5, 11, 13])
        known_ace = next(card for card in state["players"]["mate"]["hand"] if card["rank"] == 14)
        state["known_card_owners"] = {known_ace["id"]: "mate"}
        self.assertEqual(trick.response_action(state, "bot", random.Random(0)), {"type": "pass"})

    def test_cheap_relay_does_not_break_a_natural_straight(self):
        state = self.teammate_single([4, 5, 6, 7, 8, 2], [6, 10, 12],
                                    mate=[3, 14, 7, 9], other=[5, 11, 13])
        known_ace = next(card for card in state["players"]["mate"]["hand"] if card["rank"] == 14)
        state["known_card_owners"] = {known_ace["id"]: "mate"}
        willing_rng = mock.Mock()
        willing_rng.random.return_value = 0.0
        self.assertEqual(trick.response_action(state, "bot", willing_rng), {"type": "pass"})

    def test_short_hand_risk_matches_exhaustive_public_physical_hands(self):
        for level in (2, 7, 14):
            state = make_state({"bot": [3, 10], "opp": [5, 5], "mate": [6, 8], "opp2": [9, 12]})
            state["level_rank"] = level
            deck = guandan._full_deck()
            pool = [card for card in deck if card["rank"] == 5 and card["suit"] in ("spades", "clubs")]
            pool += [card for card in deck if guandan._is_wild(card, level) or card.get("joker")]
            own = {card["id"] for card in state["players"]["bot"]["hand"]}
            state["seen_cards"] = [card["id"] for card in deck if card["id"] not in own | {card["id"] for card in pool}]
            for count in (1, 2):
                state["players"]["opp"]["hand"] = CountOnlyHand([None] * count)
                for locked_count in range(count + 1):
                    with self.subTest(level=level, count=count, locked=locked_count):
                        locked = pool[:locked_count]
                        available = pool[locked_count:]
                        state["known_card_owners"] = {card["id"]: "opp" for card in locked}
                        profile = trick._short_finish_profile(state, "bot", "opp")
                        hands = [locked + list(cards) for cards in itertools.combinations(available, count - locked_count)]
                        for threshold in (49, 60, 80, 90, 100):
                            combo = {"type": "single" if count == 1 else "pair", "size": count,
                                     "rank_value": threshold}
                            hits = sum(guandan._can_play_all(hand, level, state["config"], combo) for hand in hands)
                            self.assertAlmostEqual(trick._short_finish_risk(profile, combo), hits / len(hands))

    def test_critical_response_never_reads_other_players_sampled_hands(self):
        state = self.teammate_single([14, 5], [6])
        expected = trick.response_action(state, "bot", random.Random(0))
        for actor, player in state["players"].items():
            if actor != "bot":
                player["hand"] = CountOnlyHand(player["hand"])
        self.assertEqual(trick.response_action(state, "bot", random.Random(0)), expected)

    def test_every_sampled_reply_remains_legal(self):
        for seed in range(10):
            state = self.teammate_single([14, 5], [6])
            action = trick.response_action(state, "bot", random.Random(seed))
            _, error = guandan.GuandanGame.apply_action(state, "bot", action)
            self.assertIsNone(error)


class ContinuationPolicyTests(unittest.TestCase):
    def test_continuation_never_accesses_other_hands(self):
        state = make_state({'bot': [3, 3, 14, 5], 'opp': [4, 6, 9],
                            'mate': [7, 8, 10], 'opp2': [12, 13, 11]})
        for step in range(80):
            if state['phase'] != 'playing':
                break
            actor = state['current_turn']
            protected = copy.deepcopy(state)
            before = copy.deepcopy(state)
            for player, data in protected['players'].items():
                if player != actor:
                    data['hand'] = CountOnlyHand(data['hand'])
            action = trick.continuation_action(protected, actor)
            self.assertEqual(action, trick.continuation_action(state, actor))
            self.assertEqual(state, before)
            _, error = guandan.GuandanGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        self.assertNotEqual(state['phase'], 'playing')

    def test_continuation_after_teammate_was_overcalled_uses_public_cache_key(self):
        state = make_state({'bot': [14, 5], 'opp': [9, 11], 'mate': [3, 7, 8], 'opp2': [4, 6, 10]})
        state['current_turn'] = 'mate'
        for actor in ('mate', 'opp2'):
            action = play([state['players'][actor]['hand'][0]['id']])
            _, error = guandan.GuandanGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        for actor, data in state['players'].items():
            if actor != 'bot':
                data['hand'] = CountOnlyHand(data['hand'])
        action = trick.continuation_action(state, 'bot')
        self.assertIn(action['type'], ('play', 'pass'))

    def test_actor_view_has_no_saved_private_or_sampled_fields(self):
        state = make_state({'bot': [3, 8], 'opp': [4, 6], 'mate': [7, 9], 'opp2': [11, 12]})
        state['private_field'] = 'hidden'
        state['_ai_eval_cache'] = {'private': 'hidden'}
        state['round_memories'][0]['initial_hands'] = {'opp': 'hidden'}

        original = trick.ai.call

        def policy(core, name, view, actor, *args):
            if name != '_bot_select_play':
                return original(core, name, view, actor, *args)
            self.assertFalse(view['_ai_sampled_world'])
            self.assertNotIn('private_field', view)
            self.assertEqual(view['_ai_eval_cache'], {})
            self.assertNotIn('initial_hands', view['round_memories'][0])
            self.assertEqual(view['players']['opp']['hand'], [None, None])
            self.assertEqual(view['config']['bot_trick_boundary_mode'], 'off')
            return [view['players'][actor]['hand'][0]['id']]

        with mock.patch.object(trick.ai, 'call', side_effect=policy):
            trick.continuation_action(state, 'bot')

    def test_continuation_matches_public_heuristic_and_reuses_exact_observations(self):
        state = make_state({'bot': [3, 3, 14, 5], 'opp': [4, 6, 9],
                            'mate': [7, 8, 10], 'opp2': [12, 13, 11]})
        state.pop('_ai_sampled_world')
        state['config']['bot_trick_boundary_mode'] = 'off'
        expected = guandan.GuandanGame.bot_move(copy.deepcopy(state), 'bot')
        cache = {}
        self.assertEqual(trick.continuation_action(state, 'bot', cache), expected)
        with mock.patch.object(guandan.GuandanGame, 'get_legal_actions',
                               side_effect=AssertionError('cached continuation was recomputed')):
            repeated = trick.continuation_action(state, 'bot', cache)
        self.assertEqual(repeated, expected)
        repeated['card_ids'].append(-1)
        self.assertEqual(trick.continuation_action(state, 'bot', cache), expected)

    def test_closed_trick_is_not_a_terminal_rollout_leaf(self):
        state = make_state({'bot': [3, 3, 5], 'opp': [14], 'mate': [7, 9], 'opp2': [13]})
        before = copy.deepcopy(state)
        plan = trick.trace_plan(state, 'bot', play(pair(state, 'bot', 3)), random.Random(0),
                                trick.TrickBudget(), 80, {}, finish_round=True)
        self.assertEqual(plan.boundary, 'round_settled')
        self.assertGreater(len(plan.actions), 4)
        self.assertTrue(plan.finish_order)
        self.assertIsNone(plan.next_leader)
        self.assertIn(plan.value, (-300.0, -200.0, -100.0, 100.0, 200.0, 300.0))
        self.assertEqual(state, before)

    def test_terminal_rollout_does_not_use_residual_race(self):
        state = make_state({'bot': [3, 3, 5], 'opp': [14], 'mate': [7, 9], 'opp2': [13]})
        with mock.patch.object(trick, 'resource_plan', side_effect=AssertionError('nonterminal race')):
            trick.trace_plan(state, 'bot', play(pair(state, 'bot', 3)), random.Random(0),
                             trick.TrickBudget(), 80, {}, finish_round=True)

    def test_rollout_limit_cannot_publish_a_partial_round(self):
        state = make_state({'bot': [3, 3, 5], 'opp': [14], 'mate': [7, 9], 'opp2': [13]})
        with self.assertRaisesRegex(trick.IncompleteTrick, 'action_limit'):
            trick.trace_plan(state, 'bot', play(pair(state, 'bot', 3)), random.Random(0),
                             trick.TrickBudget(), 2, {}, finish_round=True)

    def test_full_hands_skip_unaffordable_terminal_search(self):
        state = make_state({'bot': [3] * 4 + [5] * 4 + [8], 'opp': [4] * 4 + [6] * 4,
                            'mate': [7] * 4 + [9] * 4, 'opp2': [10] * 4 + [11] * 4})
        state['config']['bot_trick_boundary_mode'] = 'shadow'
        scored = [(pair(state, 'bot', 3), 10.0, {}), (pair(state, 'bot', 5), 9.0, {})]
        with mock.patch.object(trick, 'public_worlds', side_effect=AssertionError('oversized rollout')):
            panel = trick.compare_leads(state, 'bot', scored)
        self.assertEqual(panel['status'], 'skipped')
        self.assertFalse(panel['applied'])


class ContinuationRootTests(unittest.TestCase):
    def follow_state(self):
        state = make_state({'bot': [6, 6, 9, 13, 13], 'opp': [3, 3, 8],
                            'mate': [7, 7, 12], 'opp2': [4, 4, 10]})
        state['current_turn'] = 'opp2'
        _, error = guandan.GuandanGame.apply_action(state, 'opp2', play(pair(state, 'opp2', 4)))
        self.assertIsNone(error)
        self.assertEqual(state['current_turn'], 'bot')
        state['config'].update(bot_trick_boundary_mode='replace', bot_trick_boundary_time_ms=10000)
        return state

    def test_follow_panel_compares_pass_with_legal_replies(self):
        state = self.follow_state()
        before = copy.deepcopy(state)
        scored = [(pair(state, 'bot', 6), 10.0, {}), (None, 9.0, {}),
                  (pair(state, 'bot', 13), 8.0, {})]
        panel = trick.compare_leads(state, 'bot', scored)
        self.assertEqual(panel['status'], 'complete')
        self.assertEqual(panel['root'], 'follow')
        self.assertIn({'type': 'pass'}, [entry['action'] for entry in panel['candidates']])
        for entry in panel['candidates']:
            self.assertTrue(all(plan['boundary'] == 'round_settled' for plan in entry['plans']))
        self.assertEqual(state, before)

    def test_selected_pass_is_not_confused_with_absent_override(self):
        state = self.follow_state()
        state.pop('_ai_sampled_world')
        cards = pair(state, 'bot', 6)
        panel = {'mode': 'replace', 'status': 'complete', 'applied': True,
                 'selected': {'type': 'pass'}, 'candidates': [
                     {'action': play(cards), 'value': 100.0},
                     {'action': {'type': 'pass'}, 'value': 100.0},
                 ]}
        with mock.patch.object(trick, 'compare_leads', return_value=panel) as compare:
            action = guandan.GuandanGame.bot_move(state, 'bot')
        self.assertEqual(compare.call_count, 1)
        self.assertEqual(action, {'type': 'pass'})
        explanation = state['bot_explain']['bot']
        self.assertEqual(explanation['score_model'], 'trick_boundary')
        self.assertEqual(explanation['chosen']['cards'], ['Pass'])
        self.assertEqual(explanation['chosen']['components'], {'trick_boundary_team_value': 100.0})

    def test_partial_follow_panel_keeps_original_action_and_units(self):
        state = self.follow_state()
        state.pop('_ai_sampled_world')
        baseline = copy.deepcopy(state)
        baseline['config']['bot_trick_boundary_mode'] = 'off'
        expected = guandan.GuandanGame.bot_move(baseline, 'bot')
        panel = {'status': 'incomplete', 'applied': False, 'candidates': [
            {'action': {'type': 'pass'}, 'value': 10000.0},
        ]}
        with mock.patch.object(trick, 'compare_leads', return_value=panel):
            action = guandan.GuandanGame.bot_move(state, 'bot')
        self.assertEqual(action, expected)
        self.assertEqual(state['bot_explain']['bot']['score_model'], 'heuristic')

    def test_pass_survives_a_narrow_panel_even_with_a_low_prior(self):
        state = self.follow_state()
        scored = [(pair(state, 'bot', 6), 10.0, {}), (pair(state, 'bot', 13), 9.0, {}),
                  (None, -100.0, {})]
        finalists = trick._panel_candidates(state, 'bot', scored, 2, trick.TrickBudget())
        self.assertEqual([entry[0] for entry in finalists], [scored[0][0], None])

    def test_pass_is_not_introduced_when_defense_pruning_removed_it(self):
        state = self.follow_state()
        scored = [(pair(state, 'bot', 6), 10.0, {}), (pair(state, 'bot', 13), 9.0, {})]
        finalists = trick._panel_candidates(state, 'bot', scored, 4, trick.TrickBudget())
        self.assertTrue(all(entry[0] is not None for entry in finalists))

    def test_distinct_routes_precede_extra_copies_of_the_same_pair(self):
        state = make_state({'bot': [6, 6, 6, 6, 9], 'opp': [3, 8],
                            'mate': [7, 12], 'opp2': [4, 10]})
        sixes = [card['id'] for card in state['players']['bot']['hand'] if card['rank'] == 6]
        single = [state['players']['bot']['hand'][-1]['id']]
        scored = [(sixes[:2], 10.0, {}), (sixes[1:3], 9.0, {}),
                  (sixes[2:], 8.0, {}), (single, 7.0, {}), (sixes, 6.0, {})]
        finalists = trick._panel_candidates(state, 'bot', scored, 3, trick.TrickBudget())
        self.assertEqual([entry[0] for entry in finalists], [sixes[:2], single, sixes])

    def test_identical_faces_from_other_deck_do_not_fill_a_panel(self):
        state = make_state({'bot': [6, 6, 6, 6, 9], 'opp': [3, 8],
                            'mate': [7, 12], 'opp2': [4, 10]})
        sixes = [card for card in guandan._full_deck() if card['rank'] == 6 and card['suit'] == 'spades']
        state['players']['bot']['hand'] = sixes
        scored = [([sixes[0]['id']], 10.0, {}), ([sixes[1]['id']], 9.0, {})]
        finalists = trick._panel_candidates(state, 'bot', scored, 4, trick.TrickBudget())
        self.assertEqual(finalists, scored[:1])

    def test_candidates_distinguish_jokers_and_sort_mixed_faces(self):
        state = make_state({'bot': [6, 6, 6, 6, 9], 'opp': [3, 8],
                            'mate': [7, 12], 'opp2': [4, 10]})
        jokers = [card for card in guandan._full_deck() if card.get('joker')]
        sixes = pair(state, 'bot', 6)
        state['players']['bot']['hand'].extend(jokers)
        scored = [(sixes, 10.0, {})] + [([card['id']], 9.0, {}) for card in jokers]
        scored.append(([card['id'] for card in jokers], 8.0, {}))
        finalists = trick._panel_candidates(state, 'bot', scored, 8, trick.TrickBudget())
        self.assertEqual(len(finalists), 4)
        self.assertEqual(len([entry for entry in finalists if len(entry[0]) == 1]), 2)


if __name__ == "__main__":
    unittest.main()
