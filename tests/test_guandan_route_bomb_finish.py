import copy
import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests import test_guandan_hand_routes as route_fixtures
from tests.test_guandan_trick_responses import CountOnlyHand


class GuandanRouteBombFinishTests(unittest.TestCase):
    def make_case(self, enemy, lead=None, known=True):
        lead = lead or ["♠️Q", "♥️Q", "♣️Q", "♦️Q"]
        state = route_fixtures.GuandanHandRouteTests().make_state(
            lead + ["♠️3", "♠️4"], [enemy, ["♦️9"], ["♦️10"]],
        )
        if known:
            state["known_card_owners"] = {
                card["id"]: pid for pid in ("opp", "mate", "opp2")
                for card in state["players"][pid]["hand"]
            }
        actual = copy.deepcopy(state)
        hand = state["players"]["bot"]["hand"]
        combo = guandan._evaluate_combo(hand[:len(lead)], 2, {})
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = CountOnlyHand(
                [object()] * len(state["players"][pid]["hand"]),
            )
        return state, actual, combo

    def profile(self, state, combo):
        profile, weight = guandan_ai.call(guandan, "_hand_route_reply_model", state, "bot")
        with mock.patch.object(guandan_ai._CORE_LOCAL, "value", guandan, create=True):
            return profile(combo)

    def test_public_whole_hand_overbomb_is_a_finishing_reply(self):
        cases = (
            ["♠️K", "♥️K", "♣️K", "♦️K"],
            ["♣️4", "♣️5", "♣️6", "♣️7", "♣️8"],
            ["♠️K", "♥️K", "♣️K", "♦️K", "♠️K", "♥️K"],
            ["🃏B", "🃏B", "🃏S", "🃏S"],
        )
        for enemy in cases:
            with self.subTest(enemy=enemy):
                state, actual, combo = self.make_case(enemy)
                same, bomb, finish, _mate, _continuing = self.profile(state, combo)
                self.assertEqual(same, 0.0)
                self.assertEqual(bomb, 1.0)
                self.assertEqual(finish, 1.0)
                # Verify actual game behavior independently of AI estimates.
                for pid, cards in (("bot", actual["players"]["bot"]["hand"][:4]),
                                   ("opp", actual["players"]["opp"]["hand"])):
                    _, error = guandan.GuandanGame.apply_action(
                        actual, pid, {"type": "play", "card_ids": [c["id"] for c in cards]},
                    )
                    self.assertIsNone(error)
                self.assertEqual(actual["finish_order"], ["opp"])

    def test_a_smaller_overbomb_with_leftovers_does_not_finish(self):
        for extras in (["♠️5"], ["♠️5", "♠️6"]):
            state, _actual, combo = self.make_case(
                ["♠️K", "♥️K", "♣️K", "♦️K"] + extras,
            )
            _same, bomb, finish, _mate, _continuing = self.profile(state, combo)
            self.assertEqual(bomb, 1.0)
            self.assertEqual(finish, 0.0)

    def test_whole_hand_bomb_that_cannot_beat_lead_does_not_finish(self):
        state, _actual, combo = self.make_case(["♠️J", "♥️J", "♣️J", "♦️J"])
        _same, bomb, finish, _mate, _continuing = self.profile(state, combo)
        self.assertEqual(bomb, 0.0)
        self.assertEqual(finish, 0.0)

    def test_unequal_size_heavenly_reply_can_finish_against_six_card_bomb(self):
        state, _actual, combo = self.make_case(
            ["🃏B", "🃏B", "🃏S", "🃏S"],
            lead=["♠️Q", "♥️Q", "♣️Q", "♦️Q", "♠️Q", "♥️Q"],
        )
        self.assertEqual(self.profile(state, combo)[2], 1.0)

    def test_uncertain_finishing_bomb_matches_physical_hand_enumeration(self):
        for enemy in (["♠️K", "♥️K", "♣️K", "♦️K"],
                      ["♣️4", "♣️5", "♣️6", "♣️7", "♣️8"]):
            state, _actual, combo = self.make_case(enemy, known=False)
            pool = guandan_ai.call(guandan, "_lead_unknown_pool_cards", state, "bot")
            hit = total = 0
            for drawn in itertools.combinations(pool, len(enemy)):
                reply = guandan._evaluate_combo(list(drawn), 2, {})
                total += 1
                hit += bool(reply and reply["type"] in guandan.BOMB_TYPES
                            and guandan._compare_combos(combo, reply, 2, {}))
            _same, bomb, finish, _mate, _continuing = self.profile(state, combo)
            self.assertGreater(finish, 0.0)
            self.assertAlmostEqual(finish, hit / total)
            self.assertLessEqual(finish, bomb)

    def test_finishing_overbomb_adds_terminal_risk_to_the_route(self):
        state, _actual, combo = self.make_case(["♠️K", "♥️K", "♣️K", "♦️K"])
        hand = state["players"]["bot"]["hand"]
        combos = [combo] + [guandan._evaluate_combo([card], 2, {}) for card in hand[4:]]
        profile, weight = guandan_ai.call(guandan, "_hand_route_reply_model", state, "bot")

        def missing_finish(candidate):
            same, bomb, finish, mate, continuing = profile(candidate)
            return same, bomb, 0.0 if candidate["type"] in guandan.BOMB_TYPES else finish, mate, continuing

        with mock.patch.object(guandan_ai._CORE_LOCAL, "value", guandan, create=True):
            corrected = guandan_ai._hand_route_plan_values(combos, profile, weight, 2, {})
            old = guandan_ai._hand_route_plan_values(combos, missing_finish, weight, 2, {})
        key = guandan_ai._hand_route_key(combo)
        self.assertAlmostEqual(corrected[key]["entry_risk"] - old[key]["entry_risk"], 3.0)
        self.assertAlmostEqual(corrected[key]["cost"] - old[key]["cost"], 4.8)


if __name__ == "__main__":
    unittest.main()
