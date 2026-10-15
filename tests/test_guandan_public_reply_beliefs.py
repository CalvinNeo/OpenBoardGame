import copy
import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.test_guandan_trick_boundary import make_state, pair, play
from tests.test_guandan_trick_responses import CountOnlyHand


class GuandanPublicReplyBeliefTests(unittest.TestCase):
    @staticmethod
    def _take(deck, labels):
        cards = []
        for label in labels:
            card = next(card for card in deck if guandan._card_label(card) == label)
            deck.remove(card)
            cards.append(card)
        return cards

    def _case(self, lead, pool_labels, hand_count, level_rank=2):
        deck = guandan._full_deck()
        own = self._take(deck, lead)
        pool = self._take(deck, pool_labels)
        state = {
            "level_rank": level_rank, "config": {}, "round_memories": [], "pass_limits": {},
            "current_trick": None, "seen_cards": [card["id"] for card in deck],
            "players": {
                "observer": {"hand": own},
                "opponent": {"hand": pool[:hand_count], "finished": False},
                "other": {"hand": pool[hand_count:]},
            },
        }
        return state, guandan._evaluate_combo(own, level_rank, {}), pool

    @staticmethod
    def _history(state, rank, combo_type="pair"):
        state["round_memories"] = [{"tricks": [{"actions": [{
            "player_id": "opponent", "type": "play", "combo_type": combo_type,
            "cards": [{"rank": rank, "suit": "clubs", "joker": None, "is_wild": False}
                      for _ in range(3 if combo_type == "three" else 2)],
        }]}]}]

    def _belief(self, state, combo):
        return guandan_ai.call(guandan, "_public_reply_belief", state, "observer", "opponent", combo)

    def _same_type(self, state, combo, pool):
        total, ranks, wilds, _jokers = guandan_ai.call(
            guandan, "_lead_unknown_pool_profile", state, "observer"
        )
        return guandan_ai.call(
            guandan, "_opponent_same_type_reply_probability", state, "opponent", combo,
            total, ranks, wilds, pool,
        )

    def test_voluntary_pass_is_one_soft_update_not_impossibility(self):
        state, combo, pool = self._case(["♠️A"], ["🃏B", "♠️3", "♣️4"], 1)
        before = self._belief(state, combo)["same_type"]
        state["pass_limits"] = {"opponent": {"single": combo["rank_value"] - 1}}
        after = self._belief(state, combo)
        self.assertAlmostEqual(before, 1 / 3)
        self.assertGreater(after["same_type"], 0.0)
        self.assertLess(after["same_type"], before)
        self.assertAlmostEqual(after["same_type"], before / (2 - before))
        self.assertEqual(after["same_type"], self._same_type(state, combo, pool))
        self.assertTrue(after["same_type_possible"])
        # The legacy boolean remains unchanged; the new path does not use it.
        self.assertFalse(guandan_ai.call(guandan, "_bot_estimate_opponent_can_beat", state, "opponent", combo))
        with mock.patch.object(guandan_ai, "_bot_estimate_opponent_can_beat", side_effect=AssertionError("legacy bool")):
            self.assertEqual(self._belief(state, combo), after)

    def test_pass_does_not_weaken_a_physically_certain_single_reply(self):
        state, combo, _pool = self._case(["♠️K"], ["🃏B", "♠️A", "♥️2"], 1)
        state["pass_limits"] = {"opponent": {"single": combo["rank_value"]}}
        self.assertEqual(self._belief(state, combo)["same_type"], 1.0)

    def test_revealed_rank_cap_preserves_positive_physical_prior(self):
        state, combo, _pool = self._case(["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♠️3", "♣️4", "♦️6"], 2)
        before = self._belief(state, combo)["same_type"]
        self._history(state, 13)
        after = self._belief(state, combo)
        self.assertGreater(after["same_type"], 0.0)
        self.assertLess(after["same_type"], before)
        self.assertTrue(after["same_type_possible"])

    def test_joker_pair_probability_matches_exhaustive_small_pool_hands(self):
        for pool_labels in (
            ["🃏B", "🃏B", "🃏S", "🃏S", "♠️4"],
            ["🃏B", "🃏B", "♥️2", "♠️3", "♣️4"],
            ["🃏B", "🃏S", "♥️2", "♠️3", "♣️4"],
        ):
            for hand_count in range(1, 6):
                state, combo, pool = self._case(["♠️2", "♣️2"], pool_labels, hand_count)
                hands = list(itertools.combinations(pool, hand_count))
                hits = 0
                for hand in hands:
                    for pair in itertools.combinations(hand, 2):
                        reply = guandan._evaluate_combo(list(pair), 2, {})
                        if reply and guandan._compare_combos(combo, reply, 2, {}):
                            hits += 1
                            break
                with self.subTest(pool=pool_labels, count=hand_count):
                    self.assertAlmostEqual(self._belief(state, combo)["same_type"], hits / len(hands))

    def test_level_pair_control_does_not_erase_bomb_risk(self):
        state, combo, _pool = self._case(
            ["♠️2", "♣️2"], ["🃏B", "🃏S", "♠️K", "♣️K", "♥️K", "♦️K"], 4
        )
        belief = self._belief(state, combo)
        self.assertFalse(belief["same_type_possible"])
        self.assertEqual(belief["same_type"], 0.0)
        self.assertTrue(belief["bomb_possible"])
        self.assertGreater(belief["bomb"], 0.0)
        self.assertAlmostEqual(belief["any"], belief["bomb"])

    def test_one_of_each_joker_is_neither_joker_pair_nor_heavenly(self):
        for hand_count in (1, 2, 3, 4):
            state, combo, _pool = self._case(["♠️2", "♣️2"], ["🃏B", "🃏S", "♠️3", "♣️4"], hand_count)
            belief = self._belief(state, combo)
            self.assertEqual(belief["same_type"], 0.0)
            self.assertEqual(belief["bomb"], 0.0)
            self.assertEqual(belief["any"], 0.0)
            self.assertFalse(belief["bomb_possible"])

    def test_bomb_support_accepts_wild_bombs_and_straight_flushes(self):
        for pool in (
            ["♠️K", "♣️K", "♥️K", "♥️2"],
            ["♠️8", "♠️9", "♠️10", "♠️J", "♥️2"],
            ["🃏B", "🃏B", "🃏S", "🃏S"],
        ):
            state, combo, _pool = self._case(["♠️2", "♣️2"], pool, len(pool))
            self.assertTrue(self._belief(state, combo)["bomb_possible"])

    def test_physical_straight_flush_and_wild_bomb_keep_positive_risk(self):
        cases = (
            (["♠️3", "♠️4", "♠️5", "♠️6", "♠️7", "♦️8", "♥️10"], 5),
            (["♠️K", "♣️K", "♦️K", "♥️2", "♠️3", "♣️4"], 4),
        )
        for pool, hand_count in cases:
            state, combo, _pool = self._case(["♣️2", "♦️2"], pool, hand_count)
            belief = self._belief(state, combo)
            self.assertEqual(belief["same_type"], 0.0)
            self.assertGreater(belief["bomb"], 0.0)
            self.assertGreater(belief["any"], 0.0)

    def _response_score_case(self):
        players = [{"player_id": f"p{index}", "seat": index, "name": f"P{index}"} for index in range(4)]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        own = self._take(deck, ["♠️2", "♣️2", "♠️8", "♣️8", "♠️4", "♣️4"])
        target = self._take(deck, ["♠️K", "♣️K", "♥️K", "♦️K"])
        teammate = self._take(deck, ["🃏S", "♥️3"])
        other = self._take(deck, ["🃏B", "♦️5"])
        lead = self._take(deck, ["♠️3", "♣️3"])
        for pid, hand in zip(state["turn_order"], (own, target, teammate, other)):
            state["players"][pid].update(hand=hand, finished=False, finish_rank=None)
        state.update(
            phase="playing", level_rank=2, current_turn="p0", finish_order=[],
            round_memories=[], pass_limits={}, known_card_owners={},
            seen_cards=[card["id"] for card in deck + lead],
            current_trick={"player_id": "p3", "cards": [card["id"] for card in lead],
                           "combo": guandan._evaluate_combo(lead, 2, {})},
            trick_plays={"p3": lead}, _ai_eval_cache={},
        )
        return state, own

    def test_ordinary_score_keeps_bomb_risk_after_joker_pairs_are_publicly_excluded(self):
        state, own = self._response_score_case()
        candidate = own[:2]
        combo = guandan._evaluate_combo(candidate, 2, {})
        belief = guandan_ai.call(guandan, "_public_reply_belief", state, "p0", "p1", combo)
        self.assertEqual(belief["same_type"], 0.0)
        self.assertGreater(belief["bomb"], 0.0)
        components = guandan._bot_score_components(state, "p0", [card["id"] for card in candidate], 1)
        self.assertLess(components.get("opp_risk", 0.0), 0.0)
        self.assertGreater(components["opp_risk"], -6.0)
        self.assertEqual(components.get("opp_block", 0.0), 0.0)

    def test_lead_does_not_reward_reply_control_twice(self):
        state, own = self._response_score_case()
        state["current_trick"] = None
        with mock.patch.object(guandan_ai, "_public_reply_belief", wraps=guandan_ai._public_reply_belief) as belief:
            components = guandan._bot_score_components(state, "p0", [card["id"] for card in own[:2]], 1)
        self.assertEqual(components.get("opp_block", 0.0), 0.0)
        self.assertEqual(components["opp_risk"], -6.0)
        for invocation in belief.call_args_list:
            target = invocation.args[2]
            self.assertEqual(len(state["players"][target]["hand"]), 2)

    def test_response_does_not_turn_voluntary_pass_into_proved_control(self):
        state, own = self._response_score_case()
        state["pass_limits"] = {pid: {"pair": 3} for pid in ("p1", "p3")}
        candidate = own[2:4]  # Pair 8; unseen kings can still form a higher pair.
        combo = guandan._evaluate_combo(candidate, 2, {})
        for opponent in ("p1", "p3"):
            belief = guandan_ai.call(guandan, "_public_reply_belief", state, "p0", opponent, combo)
            self.assertTrue(belief["same_type_possible"])
            self.assertGreater(belief["same_type"], 0.0)
        with mock.patch.object(guandan_ai, "_public_reply_belief", side_effect=AssertionError("unused reply sampling")):
            components = guandan._bot_score_components(state, "p0", [card["id"] for card in candidate], 1)
        self.assertEqual(components.get("opp_block", 0.0), 0.0)
        self.assertEqual(components["opp_risk"], -6.0)

    def test_rank_cap_does_not_eliminate_natural_bomb_risk(self):
        state, combo, _pool = self._case(
            ["♠️2", "♣️2"], ["♠️K", "♣️K", "♥️K", "♦️K", "♠️3", "♣️4"], 4
        )
        before = self._belief(state, combo)["bomb"]
        self._history(state, 13, "three")
        after = self._belief(state, combo)["bomb"]
        self.assertGreater(after, 0.0)
        self.assertLess(after, before)

    def test_enemy_card_faces_and_allocations_do_not_change_belief(self):
        state, combo, pool = self._case(["♠️2", "♣️2"], ["🃏B", "🃏B", "♠️3", "♣️4", "♦️6"], 2)
        original = self._belief(state, combo)
        changed = copy.deepcopy(state)
        changed["players"]["opponent"]["hand"] = pool[-2:]
        changed["players"]["other"]["hand"] = pool[:-2]
        self.assertEqual(self._belief(changed, combo), original)
        changed["players"]["opponent"]["hand"] = [object(), object()]
        changed["players"]["other"]["hand"] = [object(), object(), object()]
        self.assertEqual(self._belief(changed, combo), original)

    def test_new_publicly_seen_joker_invalidates_control_belief(self):
        state, combo, pool = self._case(["♠️2", "♣️2"], ["♠️3", "♣️4", "🃏B", "🃏B", "♦️6"], 2)
        self.assertGreater(self._belief(state, combo)["same_type"], 0.0)
        state["seen_cards"].append(pool[2]["id"])
        state["players"]["other"]["hand"].remove(pool[2])
        self.assertEqual(self._belief(state, combo)["same_type"], 0.0)

    def test_no_history_keeps_six_card_sample_even_when_it_misses(self):
        state, combo, _pool = self._case(
            ["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5"], 6
        )
        for sampled in (0.0, 0.375):
            with mock.patch.object(guandan_ai, "_short_hand_structured_reply_breakdown",
                                   return_value={"same_type": sampled, "bomb": 0.0}) as sample:
                self.assertEqual(self._belief(state, combo)["same_type"], sampled)
                sample.assert_called_once()

    def test_soft_history_mixes_six_card_sample_with_one_analytic_prior(self):
        state, combo, _pool = self._case(
            ["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5"], 6
        )
        self._history(state, 13)
        with mock.patch.object(guandan_ai, "_short_hand_structured_reply_breakdown",
                               return_value={"same_type": 0.0, "bomb": 0.0}) as sample:
            belief = self._belief(state, combo)
            self.assertGreater(belief["same_type"], 0.0)
            self.assertTrue(belief["same_type_possible"])
            sample.assert_called_once()


class PublicEndgameTests(unittest.TestCase):
    def state(self, ranks=None):
        state = make_state(ranks or {'bot': [8, 8, 6, 14], 'opp': [9],
                                     'mate': [4, 7], 'opp2': [3, 11, 13]})
        state.pop('_ai_sampled_world')
        state['config']['bot_trick_boundary_mode'] = 'off'
        return state

    def call(self, name, state, *args):
        return guandan_ai.call(guandan, name, state, 'bot', *args)

    def protect(self, state):
        protected = copy.deepcopy(state)
        for actor, data in protected['players'].items():
            if actor != 'bot':
                data['hand'] = CountOnlyHand(data['hand'])
        return protected

    def test_single_distribution_uses_public_pool_and_owner_locks(self):
        state = self.state()
        expected = [(guandan._single_order_value({'rank': rank}, 2), 1 / 6)
                    for rank in (3, 4, 7, 9, 11, 13)]
        self.assertEqual(self.call('_target_single_value_distribution', self.protect(state), 'opp'), expected)
        known = state['players']['opp']['hand'][0]
        state['known_card_owners'] = {str(known['id']): 'opp'}
        self.assertEqual(self.call('_target_single_value_distribution', self.protect(state), 'opp'),
                         [(guandan._single_order_value(known, 2), 1.0)])

    def test_other_owner_locks_are_excluded_from_single_distribution(self):
        state = self.state()
        known = state['players']['opp2']['hand'][-1]
        state['known_card_owners'] = {known['id']: 'opp2'}
        distribution = self.call('_target_single_value_distribution', self.protect(state), 'opp')
        self.assertNotIn(guandan._single_order_value(known, 2), dict(distribution))
        self.assertAlmostEqual(sum(probability for value, probability in distribution), 1.0)

    def test_sampled_single_distribution_remains_exact(self):
        state = self.state()
        state['_ai_sampled_world'] = True
        self.assertEqual(self.call('_target_single_value_distribution', state, 'opp'),
                         [(guandan._single_order_value(state['players']['opp']['hand'][0], 2), 1.0)])
        self.assertEqual(self.call('_target_single_value_distribution', state, 'mate'), [])

    def test_short_enemy_lead_score_does_not_depend_on_hidden_assignment(self):
        state = self.state()
        swapped = copy.deepcopy(state)
        swapped['players']['opp']['hand'][0], swapped['players']['opp2']['hand'][0] = (
            swapped['players']['opp2']['hand'][0], swapped['players']['opp']['hand'][0])
        cards = [next(card['id'] for card in state['players']['bot']['hand'] if card['rank'] == 6)]
        before = copy.deepcopy(state)
        score = self.call('_bot_score_components', state, cards, 4)
        self.assertEqual(self.call('_bot_score_components', swapped, cards, 4), score)
        self.assertEqual(self.call('_bot_score_components', self.protect(before), cards, 4), score)

    def test_public_lead_penalty_is_expected_sampled_penalty_not_one_random_world(self):
        state = self.state()
        cards = [next(card['id'] for card in state['players']['bot']['hand'] if card['rank'] == 6)]
        values = []
        for target in ('opp', 'mate', 'opp2'):
            for card in state['players'][target]['hand']:
                world = copy.deepcopy(state)
                world['_ai_sampled_world'] = True
                world['players']['opp']['hand'] = [card]
                values.append(self.call('_lead_short_next_opponent_penalty', world, cards))
        self.assertGreater(max(values), min(values))
        self.assertAlmostEqual(self.call('_lead_short_next_opponent_penalty', self.protect(state), cards),
                               sum(values) / len(values))

    def test_finish_window_values_do_not_read_enemy_single(self):
        state = self.state()
        card = next(card for card in state['players']['bot']['hand'] if card['rank'] == 6)
        _, error = guandan.GuandanGame.apply_action(state, 'bot', play([card['id']]))
        self.assertIsNone(error)
        swapped = copy.deepcopy(state)
        swapped['players']['opp']['hand'][0], swapped['players']['opp2']['hand'][0] = (
            swapped['players']['opp2']['hand'][0], swapped['players']['opp']['hand'][0])
        for name in ('_single_lead_finish_window_penalty', '_active_lead_escape_window_penalty'):
            self.assertEqual(self.call(name, state), self.call(name, swapped))
            self.assertEqual(self.call(name, state), self.call(name, self.protect(state)))
        self.assertAlmostEqual(self.call('_single_lead_finish_window_penalty', state), 26.0 * 4 / 6)

    def test_short_pair_escape_and_partner_lock_use_public_cards(self):
        state = self.state({'bot': [8, 8, 6, 6, 6, 6, 14], 'opp': [9, 9],
                            'mate': [4, 4, 7], 'opp2': [3, 11, 13]})
        cards = pair(state, 'bot', 8)
        combo = guandan._evaluate_combo([card for card in state['players']['bot']['hand']
                                        if card['id'] in cards], state['level_rank'], state['config'])
        for name in ('_lead_short_escape_window_penalty', '_lead_short_enemy_lock_bonus'):
            self.assertEqual(self.call(name, state, cards, combo),
                             self.call(name, self.protect(state), cards, combo))
        _, error = guandan.GuandanGame.apply_action(state, 'bot', play(cards))
        self.assertIsNone(error)
        self.assertEqual(self.call('_active_lead_escape_window_penalty', state),
                         self.call('_active_lead_escape_window_penalty', self.protect(state)))

    def test_component_cache_ignores_public_hidden_faces_but_not_sampled_faces(self):
        state = self.state()
        swapped = copy.deepcopy(state)
        swapped['players']['opp']['hand'][0], swapped['players']['opp2']['hand'][0] = (
            swapped['players']['opp2']['hand'][0], swapped['players']['opp']['hand'][0])
        cards = pair(state, 'bot', 8)
        self.assertEqual(self.call('_bot_component_cache_key', state, cards, 4),
                         self.call('_bot_component_cache_key', swapped, cards, 4))
        self.assertEqual(self.call('_bot_component_cache_key', state, cards, 4),
                         self.call('_bot_component_cache_key', self.protect(state), cards, 4))
        state['_ai_sampled_world'] = swapped['_ai_sampled_world'] = True
        self.assertNotEqual(self.call('_bot_component_cache_key', state, cards, 4),
                            self.call('_bot_component_cache_key', swapped, cards, 4))

    def test_minimax_single_penalty_does_not_read_hidden_faces(self):
        state = self.state()
        cards = [next(card['id'] for card in state['players']['bot']['hand'] if card['rank'] == 6)]
        swapped = copy.deepcopy(state)
        swapped['players']['opp']['hand'][0], swapped['players']['opp2']['hand'][0] = (
            swapped['players']['opp2']['hand'][0], swapped['players']['opp']['hand'][0])
        penalty = self.call('_minimax_root_lead_single_penalty', state, play(cards))
        self.assertEqual(self.call('_minimax_root_lead_single_penalty', swapped, play(cards)), penalty)
        self.assertEqual(self.call('_minimax_root_lead_single_penalty', self.protect(state), play(cards)),
                         penalty)

    def test_minimax_single_penalty_equals_public_expected_sampled_penalty(self):
        state = self.state()
        cards = [next(card['id'] for card in state['players']['bot']['hand'] if card['rank'] == 6)]
        penalties = []
        for target in ('opp', 'mate', 'opp2'):
            for index in range(len(state['players'][target]['hand'])):
                world = copy.deepcopy(state)
                world['_ai_sampled_world'] = True
                world['players']['opp']['hand'][0], world['players'][target]['hand'][index] = (
                    world['players'][target]['hand'][index], world['players']['opp']['hand'][0])
                penalties.append(self.call('_minimax_root_lead_single_penalty', world, play(cards)))
        self.assertGreater(max(penalties), min(penalties))
        self.assertAlmostEqual(
            self.call('_minimax_root_lead_single_penalty', self.protect(state), play(cards)),
            sum(penalties) / len(penalties))

    def test_minimax_single_penalty_uses_public_known_owner(self):
        state = self.state()
        cards = [next(card['id'] for card in state['players']['bot']['hand'] if card['rank'] == 6)]
        known = state['players']['opp']['hand'][0]
        state['known_card_owners'] = {str(known['id']): 'opp'}
        world = copy.deepcopy(state)
        world['_ai_sampled_world'] = True
        self.assertEqual(
            self.call('_minimax_root_lead_single_penalty', self.protect(state), play(cards)),
            self.call('_minimax_root_lead_single_penalty', world, play(cards)))

    def test_minimax_single_penalty_skips_non_single_actions(self):
        state = self.protect(self.state())
        self.assertEqual(self.call('_minimax_root_lead_single_penalty', state, {'type': 'pass'}), 0.0)
        self.assertEqual(self.call('_minimax_root_lead_single_penalty', state, play(pair(state, 'bot', 8))),
                         0.0)

    def test_better_public_closeout_can_spend_control_only_after_rechecking_both_routes(self):
        state = self.state({'bot': [4, 4, 13, 13, 8], 'opp': [9],
                            'mate': [5, 7], 'opp2': [3, 11]})
        reference = play(pair(state, 'bot', 4))
        proposal = play(pair(state, 'bot', 13))
        status = {'stop_reason': 'public_closeout'}
        with mock.patch.object(guandan_ai, '_minimax_plan_risks', return_value={'same_type_control': 5.0}), \
                mock.patch.object(guandan_ai, '_retained_bomb_override_is_unsafe', return_value=False), \
                mock.patch.object(guandan_ai, '_public_endgame_closeout_action',
                                  return_value=(proposal, 0.9, 0.7)) as closeout:
            self.assertTrue(self.call('_should_accept_minimax_override', state, reference, proposal, status))
        self.assertEqual(closeout.call_args.args[2], [reference, proposal])
        decision = state['_ai_eval_cache']['minimax_override']
        self.assertEqual(decision['reason'], 'public_closeout_control')
        self.assertEqual(decision['hold_probability'], 0.9)

    def test_public_closeout_label_cannot_bypass_other_risks_or_a_failed_recheck(self):
        state = self.state({'bot': [4, 4, 13, 13, 8], 'opp': [9],
                            'mate': [5, 7], 'opp2': [3, 11]})
        reference = play(pair(state, 'bot', 4))
        proposal = play(pair(state, 'bot', 13))
        cases = [({'same_type_control': 5.0}, None, 'public_closeout'),
                 ({'same_type_control': 5.0}, (reference, 0.9, 0.7), 'public_closeout'),
                 ({'same_type_control': 5.0}, (proposal, 0.9, 0.7), 'deadline'),
                 ({'same_type_control': 5.0, 'closeout_reentry': 10.0},
                  (proposal, 0.9, 0.7), 'public_closeout')]
        for risks, checked, reason in cases:
            with self.subTest(risks=risks, reason=reason, checked=checked), \
                    mock.patch.object(guandan_ai, '_minimax_plan_risks', return_value=risks), \
                    mock.patch.object(guandan_ai, '_retained_bomb_override_is_unsafe', return_value=False), \
                    mock.patch.object(guandan_ai, '_public_endgame_closeout_action', return_value=checked):
                self.assertFalse(self.call('_should_accept_minimax_override', state, reference,
                                           proposal, {'stop_reason': reason}))

    def test_public_closeout_without_a_plan_risk_still_requires_rechecking(self):
        state = self.state({'bot': [4, 4, 13, 13, 8], 'opp': [9],
                            'mate': [5, 7], 'opp2': [3, 11]})
        reference = play(pair(state, 'bot', 4))
        proposal = play(pair(state, 'bot', 13))
        for checked, accepted in ((None, False), ((reference, 0.9, 0.7), False),
                                  ((proposal, 0.9, 0.7), True)):
            with self.subTest(checked=checked), \
                    mock.patch.object(guandan_ai, '_minimax_plan_risks', return_value={}), \
                    mock.patch.object(guandan_ai, '_retained_bomb_override_is_unsafe', return_value=False), \
                    mock.patch.object(guandan_ai, '_public_endgame_closeout_action', return_value=checked):
                self.assertEqual(self.call('_should_accept_minimax_override', state, reference,
                                           proposal, {'stop_reason': 'public_closeout'}), accepted)


if __name__ == "__main__":
    unittest.main()
