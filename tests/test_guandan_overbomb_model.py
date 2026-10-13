import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids


class GuandanOverbombModelTests(unittest.TestCase):
    def case(self, lead, labels, count, config=None):
        deck = guandan._full_deck()
        own_ids = set(pick_card_ids(deck, lead))
        own = [card for card in deck if card["id"] in own_ids]
        deck = [card for card in deck if card["id"] not in own_ids]
        ids = set(pick_card_ids(deck, labels))
        pool = [card for card in deck if card["id"] in ids]
        config = config or {}
        state = {"players": {"opponent": {"hand": pool[:count]}}, "level_rank": 2,
                 "config": config, "known_card_owners": {}, "round_memories": [], "pass_limits": {}}
        return state, guandan._evaluate_combo(own, 2, config), pool

    def profile(self, state, combo, pool):
        return guandan_ai.call(guandan, "_public_overbomb_profile_from_pool", state, "opponent", combo, pool)

    def exhaustive(self, state, combo, pool):
        owners = state["known_card_owners"]
        pool = [card for card in pool if owners.get(card["id"], "opponent") == "opponent"]
        locked = [card for card in pool if owners.get(card["id"]) == "opponent"]
        free = [card for card in pool if card not in locked]
        draws = len(state["players"]["opponent"]["hand"]) - len(locked)
        hits = total = 0
        for drawn in itertools.combinations(free, draws):
            hand = locked + list(drawn)
            total += 1
            replies = (guandan._evaluate_combo(list(cards), 2, state["config"])
                       for size in range(4, len(hand) + 1) for cards in itertools.combinations(hand, size))
            hits += any(reply and guandan._compare_combos(combo, reply, 2, state["config"])
                        for reply in replies)
        return hits / total

    def test_physical_event_union_matches_exhaustive_legal_hands(self):
        cases = [
            # One joker of each kind cannot be a heavenly bomb.
            (["♠️10", "♥️10", "♣️10", "♦️10"], ["🃏B", "🃏S", "♠️3", "♣️4", "♦️7"]),
            (["♠️10", "♥️10", "♣️10", "♦️10"], ["🃏B", "🃏B", "🃏S", "🃏S", "♠️3", "♣️4"]),
            # Soft higher rank; same rank natural beats soft only when configured.
            (["♠️10", "♥️10", "♣️10", "♦️10"], ["♠️K", "♣️K", "♦️K", "♥️2", "♠️3", "♣️4"]),
            (["♠️10", "♥️10", "♣️10", "♥️2"], ["♠️10", "♥️10", "♣️10", "♦️10", "♠️3", "♣️4"]),
            # Overlapping flushes, duplicate physical faces and optional wilds.
            (["♠️10", "♥️10", "♣️10", "♦️10"], ["♦️5", "♦️5", "♦️6", "♦️7", "♦️8", "♦️9", "♥️2", "♠️3"]),
            (["♠️3", "♠️4", "♠️5", "♠️6", "♠️7"], ["♦️4", "♦️5", "♦️6", "♦️7", "♥️2", "♣️K"]),
            # Six of a kind beats a flush, including two wildcard substitutions.
            (["♠️9", "♠️10", "♠️J", "♠️Q", "♠️K"], ["♠️3", "♠️3", "♥️3", "♣️3", "♥️2", "♥️2", "♦️5"]),
            (["♠️10", "♥️10", "♣️10", "♦️10", "♠️10"], ["♦️5", "♦️6", "♦️7", "♦️8", "♥️2", "♣️K"]),
        ]
        for lead, labels in cases:
            for count in range(4, len(labels) + 1):
                for hard_beats_soft in (False, True):
                    with self.subTest(lead=lead, pool=labels, count=count, hard=hard_beats_soft):
                        state, combo, pool = self.case(lead, labels, count, {"hard_bomb_beats_soft": hard_beats_soft})
                        profile = self.profile(state, combo, pool)
                        expected = self.exhaustive(state, combo, pool)
                        self.assertAlmostEqual(profile["probability"], expected)
                        self.assertEqual(profile["possible"], expected > 0)
                        for witness in profile["witnesses"]:
                            reply = guandan._evaluate_combo([card for card in pool if card["id"] in witness], 2, state["config"])
                            self.assertTrue(guandan._compare_combos(combo, reply, 2, state["config"]))

    def test_known_owners_condition_physical_events(self):
        for owner in ("opponent", "other"):
            state, combo, pool = self.case(
                ["♠️10", "♥️10", "♣️10", "♦️10"],
                ["♠️K", "♣️K", "♦️K", "♥️2", "♠️3", "♣️4", "♦️5"], 5,
            )
            wild = next(card for card in pool if guandan._is_wild(card, 2))
            state["known_card_owners"] = {wild["id"]: owner, pool[-1]["id"]: "opponent"}
            self.assertAlmostEqual(self.profile(state, combo, pool)["probability"],
                                   self.exhaustive(state, combo, pool))

    def test_zero_sample_hits_do_not_erase_rare_overbomb_support(self):
        state, combo, pool = self.case(
            ["♠️10", "♥️10", "♣️10", "♦️10"],
            ["♠️K", "♣️K", "♦️K", "♥️2", "♠️3", "♣️4", "♦️5", "♣️6"], 6,
        )
        with mock.patch.object(guandan_ai, "_short_hand_structured_reply_breakdown", return_value={"overbomb": 0.0}):
            probability = guandan_ai.call(guandan, "_opponent_overbomb_reply_probability",
                                          state, "opponent", combo, len(pool), {}, {}, pool)
        self.assertGreater(probability, 0)
        self.assertLessEqual(probability, self.profile(state, combo, pool)["probability"])

    def test_profile_only_call_requires_all_four_jokers(self):
        state, combo, pool = self.case(["♠️10", "♥️10", "♣️10", "♦️10"],
                                      ["🃏B", "🃏S", "♠️3", "♣️4", "♦️5"], 5)
        probability = guandan_ai.call(guandan, "_opponent_overbomb_reply_probability",
                                      state, "opponent", combo, len(pool), {}, {"small": 1, "big": 1})
        self.assertEqual(probability, 0)

    def test_shape_samples_cannot_override_known_card_ownership(self):
        state, combo, pool = self.case(
            ["♠️10", "♥️10", "♣️10", "♦️10"],
            ["♠️K", "♣️K", "♦️K", "♥️2", "♠️3", "♣️4", "♦️5", "♣️6"], 6,
        )
        wild = next(card for card in pool if guandan._is_wild(card, 2))
        for owner in ("opponent", "other"):
            state["known_card_owners"] = {wild["id"]: owner}
            with mock.patch.object(guandan_ai, "_short_hand_structured_reply_breakdown",
                                   side_effect=AssertionError("sampler ignores owner locks")):
                actual = guandan_ai.call(guandan, "_opponent_overbomb_reply_probability",
                                         state, "opponent", combo, len(pool), {}, {}, pool)
            self.assertAlmostEqual(actual, self.exhaustive(state, combo, pool))

    def test_non_bomb_lead_has_no_overbomb_risk_even_with_four_jokers(self):
        for count in (4, 5, 6):
            state, combo, pool = self.case(["♠️10"],
                                          ["🃏B", "🃏B", "🃏S", "🃏S", "♠️3", "♣️4"], count)
            for cards in (None, pool):
                probability = guandan_ai.call(guandan, "_opponent_overbomb_reply_probability",
                                              state, "opponent", combo, len(pool), {},
                                              {"small": 2, "big": 2}, cards)
                self.assertEqual(probability, 0)


if __name__ == "__main__":
    unittest.main()
