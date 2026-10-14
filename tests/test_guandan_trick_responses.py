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


if __name__ == "__main__":
    unittest.main()
