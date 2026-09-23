import copy
import unittest

from game import guandan
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class CountOnlyHand:
    """Expose the public count while failing on any attempt to inspect cards."""

    def __init__(self, count):
        self.count = count

    def __len__(self):
        return self.count

    def __iter__(self):
        raise AssertionError("Policy inspected another player's hidden cards")

    def __getitem__(self, key):
        raise AssertionError("Policy indexed another player's hidden cards")


class UnreadableInitialHands(dict):
    def get(self, *args, **kwargs):
        raise AssertionError("Policy inspected initial hands")

    def __getitem__(self, key):
        raise AssertionError("Policy indexed initial hands")

    def __iter__(self):
        raise AssertionError("Policy iterated initial hands")

    def items(self):
        raise AssertionError("Policy iterated initial hands")

    def values(self):
        raise AssertionError("Policy iterated initial hands")


class GuandanPublicHistoryPolicyTests(unittest.TestCase):
    def _call(self, name, *args):
        return guandan._guandan_ai.call(guandan, name, *args)

    def _profile(self, state, lane="pair"):
        return self._call("_recent_public_lane_profile", state, "calvin", lane)

    def _pressure(self, state, observer="bot4"):
        return self._call("_enemy_lane_control_pressure", state, observer)

    def _combo(self, state, player_id, labels):
        hand = state["players"][player_id]["hand"]
        chosen_ids = set(pick_card_ids(hand, labels))
        return guandan._evaluate_combo(
            [card for card in hand if card["id"] in chosen_ids],
            state["level_rank"],
            state["config"],
        )

    def _play(self, state, player_id, labels=()):
        action = {"type": "pass"}
        if labels:
            action = {
                "type": "play",
                "card_ids": pick_card_ids(state["players"][player_id]["hand"], labels),
            }
        _, error = guandan.GuandanGame.apply_action(state, player_id, action)
        self.assertIsNone(error)

    def _assert_card_zones(self, state):
        held = [card["id"] for player in state["players"].values() for card in player["hand"]]
        seen = state["seen_cards"]
        self.assertEqual(len(held), len(set(held)))
        self.assertFalse(set(held) & set(seen))
        self.assertEqual(set(held) | set(seen), {card["id"] for card in guandan._full_deck()})

    def _swap_unplayed_cards(self, state, left, left_labels, right, right_labels):
        left_hand = state["players"][left]["hand"]
        right_hand = state["players"][right]["hand"]
        left_ids = set(pick_card_ids(left_hand, left_labels))
        right_ids = set(pick_card_ids(right_hand, right_labels))
        self.assertEqual(len(left_ids), len(right_ids))
        state["players"][left]["hand"] = (
            [card for card in left_hand if card["id"] not in left_ids]
            + [card for card in right_hand if card["id"] in right_ids]
        )
        state["players"][right]["hand"] = (
            [card for card in right_hand if card["id"] not in right_ids]
            + [card for card in left_hand if card["id"] in left_ids]
        )
        # These are alternative private deals consistent with the same plays.
        # Opening hands are not part of the public observation being tested.
        for entry in state["round_memories"]:
            entry.pop("initial_hands", None)
        self._assert_card_zones(state)

    def test_one_unanswered_pair_does_not_establish_control_pressure(self):
        state = replay_fixture("72c", 27)
        profile = self._profile(state)
        self.assertEqual(profile["plays"], 1)
        self.assertEqual(profile["control_streak"], 1)
        self.assertEqual(profile["confidence"], 0)
        self.assertEqual(self._pressure(state), 0)

    def test_repeated_unanswered_leads_raise_pressure_before_a_short_hand(self):
        second = replay_fixture("72c", 31)
        third = replay_fixture("72c", 35)
        self.assertEqual(self._profile(second)["control_streak"], 2)
        self.assertEqual(self._profile(third)["control_streak"], 3)
        self.assertGreater(len(second["players"]["calvin"]["hand"]), 12)
        self.assertGreater(self._pressure(second), 0)
        self.assertGreater(self._pressure(third), self._pressure(second))
        earlier_defender = replay_fixture("72c", 29)
        self.assertGreater(self._pressure(second), self._pressure(earlier_defender, "bot2"))
        self.assertEqual(self._pressure(second, "z"), 0)

    def test_following_pairs_is_preference_evidence_without_lead_control(self):
        state = replay_fixture("7a5", 31)
        profile = self._profile(state)
        self.assertEqual(state["current_trick"]["player_id"], "calvin")
        self.assertEqual(profile["plays"], 2)
        self.assertEqual(profile["leads"], 1)
        self.assertEqual(profile["control_streak"], 0)
        self.assertGreater(profile["confidence"], 0)
        self.assertLess(profile["confidence"], self._profile(replay_fixture("72c", 31))["confidence"])
        self.assertEqual(self._pressure(state, "bot2"), 0)

    def test_losing_the_trick_breaks_control_but_preserves_recent_preference(self):
        state = replay_fixture("72c", 31)
        self._play(state, "bot4", ("♠️K", "♦️K"))
        for player_id in ("calvin", "bot2", "z"):
            self._play(state, player_id)
        self._assert_card_zones(state)
        self.assertEqual(state["round_memories"][0]["tricks"][-1]["winner_id"], "bot4")
        self.assertEqual(self._profile(state)["control_streak"], 0)
        self.assertGreater(self._profile(state)["confidence"], 0)
        self.assertEqual(self._pressure(state), 0)

    def test_changing_lane_breaks_the_old_control_streak(self):
        state = replay_fixture("72c", 37)
        self.assertEqual(state["current_trick"]["combo"]["type"], "straight")
        self.assertEqual(self._profile(state)["control_streak"], 0)
        self.assertEqual(self._profile(state, "straight")["control_streak"], 1)
        self.assertEqual(self._pressure(state, "bot2"), 0)

    def test_missing_past_winners_are_not_assumed_to_match_current_leader(self):
        state = replay_fixture("72c", 31)
        for trick in state["round_memories"][0]["tricks"][:-1]:
            trick.pop("winner_id", None)
            trick.pop("status", None)
        self.assertEqual(self._profile(state)["control_streak"], 1)
        self.assertEqual(self._pressure(state), 0)

    def test_pair_history_expires_after_six_newer_tricks(self):
        state = replay_fixture("7a5", 89)
        tricks = state["round_memories"][0]["tricks"]
        matching_indices = [
            index for index, trick in enumerate(tricks)
            if any(action.get("player_id") == "calvin" and action.get("combo_type") == "pair"
                   for action in trick["actions"])
        ]
        self.assertTrue(matching_indices)
        self.assertLess(max(matching_indices), len(tricks) - 6)
        profile = self._profile(state)
        self.assertEqual(profile["plays"], 0)
        self.assertEqual(profile["confidence"], 0)
        self.assertEqual(profile["control_streak"], 0)

    def test_leading_a_pair_is_penalized_only_with_repeated_recent_evidence(self):
        state = replay_fixture("7a5", 49)
        combo = self._combo(state, "bot4", ("♠️10", "♥️10"))
        self.assertGreater(self._call("_lead_enemy_lane_exposure", state, "bot4", combo), 0)
        # A shorter available history contains only Calvin's last pair follow.
        one_pair = copy.deepcopy(state)
        one_pair["round_memories"][0]["tricks"] = one_pair["round_memories"][0]["tricks"][-2:]
        self.assertEqual(self._profile(one_pair)["plays"], 1)
        self.assertEqual(self._call("_lead_enemy_lane_exposure", one_pair, "bot4", combo), 0)
        no_history = copy.deepcopy(state)
        no_history["round_memories"] = []
        self.assertEqual(self._call("_lead_enemy_lane_exposure", no_history, "bot4", combo), 0)

    def test_a_different_lane_is_not_penalized_by_pair_history(self):
        state = replay_fixture("7a5", 49)
        combo = self._combo(state, "bot4", ("🃏S",))
        self.assertGreater(self._profile(state)["confidence"], 0)
        self.assertEqual(self._call("_lead_enemy_lane_exposure", state, "bot4", combo), 0)

    def test_public_policy_never_reads_hidden_cards_or_opening_hands(self):
        for case, step in (("72c", 31), ("7a5", 49)):
            with self.subTest(case=case):
                state = replay_fixture(case, step)
                labels = ("♠️K", "♦️K") if case == "72c" else ("♠️10", "♥️10")
                combo = self._combo(state, "bot4", labels)
                expected = (
                    self._profile(state),
                    self._pressure(state),
                    self._call("_lead_enemy_lane_exposure", state, "bot4", combo),
                )
                for player_id, player in state["players"].items():
                    if player_id != "bot4":
                        player["hand"] = CountOnlyHand(len(player["hand"]))
                for entry in state["round_memories"]:
                    entry["initial_hands"] = UnreadableInitialHands({"forbidden": object()})
                self.assertEqual(
                    (self._profile(state), self._pressure(state),
                     self._call("_lead_enemy_lane_exposure", state, "bot4", combo)),
                    expected,
                )

    def test_redistributing_hidden_cards_with_identical_public_information_is_invariant(self):
        state = replay_fixture("7a5", 49)
        combo = self._combo(state, "bot4", ("♠️10", "♥️10"))
        expected = self._call("_lead_enemy_lane_exposure", state, "bot4", combo)
        self.assertGreater(expected, 0)
        self._swap_unplayed_cards(state, "calvin", ("♦️A", "♦️A"), "z", ("♥️6", "♣️6"))
        self.assertEqual(self._call("_lead_enemy_lane_exposure", state, "bot4", combo), expected)

    def test_exhausted_public_reply_pool_overrides_a_recent_pair_preference(self):
        state = replay_fixture("7a5", 49)
        # The only unseen level card is one spade 2, and Bot 4 holds one of each
        # joker. A natural AA pair therefore has no higher pair in the pool.
        self._swap_unplayed_cards(state, "bot4", ("♠️10", "♥️10"), "calvin", ("♦️A", "♦️A"))
        combo = self._combo(state, "bot4", ("♦️A", "♦️A"))
        pool = self._call("_lead_unknown_pool_cards", state, "bot4")
        self.assertGreater(self._profile(state)["confidence"], 0)
        self.assertFalse(self._call("_public_pool_supports_same_type_reply", pool, 4, 2, combo))
        self.assertEqual(self._call("_lead_enemy_lane_exposure", state, "bot4", combo), 0)

    def test_finishing_our_hand_has_no_lane_exposure_penalty(self):
        state = replay_fixture("7a5", 49)
        combo = self._combo(state, "bot4", ("♠️10", "♥️10"))
        self.assertGreater(self._call("_lead_enemy_lane_exposure", state, "bot4", combo), 0)
        # Isolate the closeout boundary while keeping every physical card in
        # exactly one zone; the teammate holds the observer's other cards.
        closing_ids = set(pick_card_ids(state["players"]["bot4"]["hand"], ("♠️10", "♥️10")))
        hand = state["players"]["bot4"]["hand"]
        state["players"]["bot4"]["hand"] = [card for card in hand if card["id"] in closing_ids]
        state["players"]["bot2"]["hand"].extend(card for card in hand if card["id"] not in closing_ids)
        self._assert_card_zones(state)
        self.assertEqual(self._call("_lead_enemy_lane_exposure", state, "bot4", combo), 0)

    def test_publicly_locked_low_card_can_make_a_pair_reply_impossible(self):
        deck = guandan._full_deck()
        by_label = {}
        for card in deck:
            by_label.setdefault(guandan._card_label(card), card)
        pair = [by_label["♠️10"], by_label["♥️10"]]
        combo = guandan._evaluate_combo(pair, 2, {})
        higher = [by_label["♠️A"], by_label["♥️A"]]
        low = by_label["♣️3"]
        state = {"level_rank": 2, "config": {},
                 "players": {"opponent": {"hand": CountOnlyHand(2)}}}
        # Both aces exist, but the known 3 occupies one of the two hand slots.
        self.assertEqual(self._call("_history_lane_reply_probability", state, "opponent",
                                    combo, higher + [low], [low]), 0)
        self.assertGreater(self._call("_history_lane_reply_probability", state, "opponent",
                                      combo, higher + [low], []), 0)
        self.assertEqual(self._call("_history_lane_reply_probability", state, "opponent",
                                    combo, higher + [low], higher), 1)

    def test_control_single_relief_respects_public_joker_ownership(self):
        state = replay_fixture("7a5", 49)
        combo = self._combo(state, "bot4", ("🃏S",))
        self.assertTrue(self._call("_history_control_single_is_useful", state, "bot4", combo))
        unseen_big = next(card for card in self._call("_lead_unknown_pool_cards", state, "bot4")
                          if card.get("joker") == "big")
        # Preserve the same public history but reveal where the higher joker is.
        state["known_card_owners"][unseen_big["id"]] = "calvin"
        self.assertFalse(self._call("_history_control_single_is_useful", state, "bot4", combo))

    def test_control_single_relief_does_not_split_a_joker_pair(self):
        state = replay_fixture("7a5", 49)
        self._swap_unplayed_cards(state, "bot4", ("🃏S",), "z", ("🃏B",))
        combo = self._combo(state, "bot4", ("🃏B",))
        self.assertFalse(self._call("_history_control_single_is_useful", state, "bot4", combo))


if __name__ == "__main__":
    unittest.main()
