import copy
import itertools
import math
import unittest

from game import guandan, guandan_ai


class GuandanFourCardBeliefTests(unittest.TestCase):
    def setUp(self):
        self.deck = guandan._full_deck()
        self.state = {
            "level_rank": 2,
            "config": {},
            "players": {f"p{i}": {"hand": self.deck[i * 4:i * 4 + 4], "finished": False}
                        for i in range(4)},
            "turn_order": [f"p{i}" for i in range(4)],
            "round_memories": [],
            "seen_cards": [],
            "known_card_owners": {},
            "current_trick": None,
        }

    def rank(self, rank, count):
        return [card for card in self.deck if card.get("rank") == rank][:count]

    def profile(self, pool, state=None):
        return guandan_ai.call(
            guandan, "_four_card_bomb_finish_profile_from_pool",
            self.state if state is None else state, "p1", pool,
        )

    def history(self, *plays):
        self.state["round_memories"] = [{"tricks": [{"actions": [
            {"player_id": "p1", "type": "play", "combo_type": combo_type,
             "hand_count_after": remaining, "cards": []}
            for combo_type, remaining in plays
        ]}]}]

    def reply(self, profile, cards):
        combo = guandan._evaluate_combo(cards, 2, self.state["config"])
        self.assertIsNotNone(combo)
        return guandan_ai.call(
            guandan, "_four_card_bomb_reply_probability", profile,
            combo, 2, self.state["config"],
        )

    def test_without_history_keeps_exact_uniform_physical_baseline(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        profile = self.profile(pool)
        self.assertTrue(profile["bomb_possible"])
        self.assertFalse(profile["history_supported"])
        self.assertAlmostEqual(profile["physical_probability"], 1 / math.comb(6, 4))
        self.assertEqual(profile["bomb_probability"], profile["physical_probability"])

    def test_physical_count_matches_exhaustive_wildcard_and_joker_hands(self):
        wilds = [card for card in self.deck if guandan._is_wild(card, 2)]
        levels = [card for card in self.deck if card.get("rank") == 2
                  and not guandan._is_wild(card, 2)][:2]
        pool = wilds + levels + self.rank(4, 3) + [card for card in self.deck if card.get("joker")]
        bomb_count = sum(
            bool(combo and combo.get("type") in guandan_ai.BOMB_TYPES)
            for hand in itertools.combinations(pool, 4)
            for combo in [guandan._evaluate_combo(list(hand), 2, {})]
        )
        profile = self.profile(pool)
        self.assertAlmostEqual(profile["physical_probability"], bomb_count / math.comb(len(pool), 4))
        self.assertAlmostEqual(sum(entry["conditional_probability"] for entry in profile["bomb_combos"]), 1.0)

    def test_public_shedding_to_four_raises_retained_bomb_risk(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        self.history(("full_house", 4))
        plain = self.profile(pool)
        self.assertEqual(plain["bomb_probability"], 0.65)
        self.history(("single", 9), ("full_house", 4))
        cleared = self.profile(pool)
        self.assertEqual(cleared["bomb_probability"], 0.85)
        self.assertEqual(plain["physical_probability"], cleared["physical_probability"])

    def test_history_cannot_create_a_physically_impossible_bomb(self):
        self.history(("single", 9), ("full_house", 4))
        profile = self.profile(self.rank(4, 2) + self.rank(6, 2) + self.rank(8, 2))
        self.assertFalse(profile["bomb_possible"])
        self.assertEqual(profile["bomb_probability"], 0.0)
        self.assertEqual(profile["bomb_combos"], ())

    def test_soft_low_bomb_waits_for_ordinary_followup(self):
        wild = next(card for card in self.deck if card.get("rank") == 2 and card.get("suit") == "hearts")
        pool = self.rank(4, 3) + [wild] + self.rank(6, 1) + self.rank(8, 1)
        self.history(("full_house", 4))
        profile = self.profile(pool)
        self.assertEqual(profile["bomb_probability"], 0.65)
        self.assertEqual(self.reply(profile, self.rank(11, 4)), 0.0)
        self.assertEqual(self.reply(profile, self.rank(7, 2)), 0.65)
        self.assertEqual(self.reply(profile, self.rank(3, 5)), 0.0)

    def test_four_jokers_are_a_finishing_bomb_and_beat_large_rank_bombs(self):
        pool = [card for card in self.deck if card.get("joker")]
        profile = self.profile(pool)
        self.assertEqual(profile["physical_probability"], 1.0)
        self.assertEqual(profile["bomb_probability"], 1.0)
        self.assertEqual(self.reply(profile, self.rank(14, 6)), 1.0)
        self.assertEqual(self.reply(profile, pool), 0.0)

    def test_known_owners_limit_support_and_condition_uniform_counts(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        self.state["known_card_owners"] = {pool[0]["id"]: "p3"}
        self.assertFalse(self.profile(pool)["bomb_possible"])
        self.state["known_card_owners"] = {pool[4]["id"]: "p1"}
        self.assertFalse(self.profile(pool)["bomb_possible"])
        self.state["known_card_owners"] = {pool[0]["id"]: "p1"}
        self.assertAlmostEqual(self.profile(pool)["physical_probability"], 1 / math.comb(5, 3))
        self.state["known_card_owners"] = {card["id"]: "p1" for card in pool[:4]}
        self.assertEqual(self.profile(pool)["bomb_probability"], 1.0)

    def test_soft_rank_history_does_not_remove_physical_bomb_support(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        self.history(("pair", 4))
        self.state["round_memories"][0]["tricks"][0]["actions"][0]["cards"] = self.rank(4, 2)
        self.assertTrue(self.profile(pool)["bomb_possible"])
        self.assertEqual(self.profile(pool)["bomb_probability"], 0.65)

    def test_soft_rank_history_reweights_risk_without_changing_physical_count(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        before = self.profile(pool)
        self.history(("three", 12))
        self.state["round_memories"][0]["tricks"][0]["actions"][0]["cards"] = self.rank(4, 3)
        after = self.profile(pool)
        self.assertGreater(after["bomb_probability"], 0.0)
        self.assertLess(after["bomb_probability"], before["bomb_probability"])
        self.assertEqual(after["physical_probability"], before["physical_probability"])

    def test_soft_rank_cap_keeps_high_retained_bomb_risk(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        self.history(("three", 12), ("single", 9), ("full_house", 4))
        self.state["round_memories"][0]["tricks"][0]["actions"][0]["cards"] = self.rank(4, 3)
        profile = self.profile(pool)
        self.assertTrue(profile["bomb_possible"])
        self.assertEqual(profile["bomb_probability"], 0.85)

    def test_public_profile_does_not_read_hidden_faces(self):
        pool = self.rank(4, 4) + self.rank(6, 1) + self.rank(8, 1)
        pool_ids = {card["id"] for card in pool}
        self.state["players"]["p0"]["hand"] = self.rank(10, 3)
        own_ids = {card["id"] for card in self.state["players"]["p0"]["hand"]}
        self.state["seen_cards"] = [card["id"] for card in self.deck
                                    if card["id"] not in pool_ids | own_ids]
        self.history(("full_house", 4))
        before = guandan_ai.call(guandan, "_four_card_bomb_finish_profile", self.state, "p0", "p1")
        changed = copy.deepcopy(self.state)
        changed["_ai_eval_cache"] = {}
        for player_id in ("p1", "p2", "p3"):
            changed["players"][player_id]["hand"] = [{"hidden": True} for _ in range(4)]
        after = guandan_ai.call(guandan, "_four_card_bomb_finish_profile", changed, "p0", "p1")
        self.assertEqual(before, after)

    def test_non_four_card_or_finished_target_has_no_four_card_profile(self):
        pool = self.rank(4, 4)
        self.state["players"]["p1"]["hand"] = pool[:3]
        self.assertFalse(self.profile(pool)["bomb_possible"])
        self.state["players"]["p1"]["hand"] = pool
        self.state["players"]["p1"]["finished"] = True
        self.assertFalse(self.profile(pool)["bomb_possible"])


if __name__ == "__main__":
    unittest.main()
