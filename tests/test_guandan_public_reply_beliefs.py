import copy
import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai


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
        self.assertGreater(components.get("opp_block", 0.0), 0.0)

    def test_lead_does_not_reward_reply_control_twice(self):
        state, own = self._response_score_case()
        state["current_trick"] = None
        with mock.patch.object(guandan_ai, "_public_reply_belief", side_effect=AssertionError("duplicate lead belief")):
            components = guandan._bot_score_components(state, "p0", [card["id"] for card in own[:2]], 1)
        self.assertEqual(components.get("opp_block", 0.0), 0.0)
        self.assertEqual(components["opp_risk"], -6.0)

    def test_response_does_not_turn_voluntary_pass_into_proved_control(self):
        state, own = self._response_score_case()
        state["pass_limits"] = {pid: {"pair": 3} for pid in ("p1", "p3")}
        candidate = own[2:4]  # Pair 8; unseen kings can still form a higher pair.
        combo = guandan._evaluate_combo(candidate, 2, {})
        for opponent in ("p1", "p3"):
            belief = guandan_ai.call(guandan, "_public_reply_belief", state, "p0", opponent, combo)
            self.assertTrue(belief["same_type_possible"])
            self.assertGreater(belief["same_type"], 0.0)
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


if __name__ == "__main__":
    unittest.main()
