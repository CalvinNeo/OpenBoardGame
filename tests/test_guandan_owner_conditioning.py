import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests import test_guandan_public_reply_beliefs as reply_fixtures
from tests.test_guandan_trick_responses import CountOnlyHand
from tests import test_guandan_hand_routes as route_fixtures


class GuandanOwnerConditioningTests(unittest.TestCase):
    def case(self, lead, pool, count, level=2):
        return reply_fixtures.GuandanPublicReplyBeliefTests()._case(lead, pool, count, level)

    def probability(self, state, combo, pool):
        return guandan_ai.call(
            guandan, "_owner_conditioned_same_type_reply_probability",
            state, "opponent", combo, pool,
        )

    def belief(self, state, combo):
        return guandan_ai.call(guandan, "_public_reply_belief", state, "observer", "opponent", combo)

    def exhaustive(self, state, combo, pool):
        owners = {str(cid): owner for cid, owner in state["known_card_owners"].items()}
        available = [card for card in pool if owners.get(str(card["id"]), "opponent") == "opponent"]
        locked = [card for card in available if owners.get(str(card["id"])) == "opponent"]
        free = [card for card in available if card not in locked]
        draws = len(state["players"]["opponent"]["hand"]) - len(locked)
        hits = total = 0
        for drawn in itertools.combinations(free, draws):
            hand = locked + list(drawn)
            total += 1
            # Independent physical subset oracle, not the AI candidate list.
            replies = (guandan._evaluate_combo_for_type(list(cards), state["level_rank"], {}, combo["type"])
                       for cards in itertools.combinations(hand, combo["size"]))
            hits += any(reply and reply["type"] == combo["type"]
                        and guandan._compare_combos(combo, reply, state["level_rank"], {})
                        for reply in replies)
        return hits / total

    def test_known_other_owner_excludes_the_only_single_reply(self):
        state, combo, pool = self.case(["♠️A"], ["🃏B", "♠️3", "♣️4"], 1)
        self.assertAlmostEqual(self.belief(state, combo)["same_type"], 1 / 3)
        state["known_card_owners"] = {pool[0]["id"]: "other"}
        belief = self.belief(state, combo)
        self.assertEqual(belief["same_type"], 0.0)
        self.assertFalse(belief["same_type_possible"])

    def test_known_target_reply_survives_contradictory_voluntary_pass(self):
        state, combo, pool = self.case(["♠️A"], ["🃏B", "♠️3", "♣️4"], 1)
        state["known_card_owners"] = {str(pool[0]["id"]): "opponent"}
        state["pass_limits"] = {"opponent": {"single": 1}}
        self.assertEqual(self.belief(state, combo)["same_type"], 1.0)

    def test_locked_low_card_consumes_a_draw_slot(self):
        state, combo, pool = self.case(["♠️A"], ["🃏B", "♠️3", "♣️4", "♦️5"], 2)
        state["known_card_owners"] = {pool[1]["id"]: "opponent"}
        self.assertAlmostEqual(self.probability(state, combo, pool), 1 / 3)
        self.assertAlmostEqual(self.belief(state, combo)["same_type"], 1 / 3)

    def test_fractional_conditional_reply_keeps_a_soft_pass_update(self):
        state, combo, pool = self.case(["♠️A"], ["🃏B", "♠️3", "♣️4", "♦️5"], 2)
        state["known_card_owners"] = {pool[1]["id"]: "opponent"}
        state["pass_limits"] = {"opponent": {"single": combo["rank_value"]}}
        self.assertAlmostEqual(self.probability(state, combo, pool), 1 / 3)
        self.assertAlmostEqual(self.belief(state, combo)["same_type"], 1 / 5)

    def test_publicly_known_pair_overrides_inferred_rank_cap_and_pass(self):
        state, combo, pool = self.case(["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♦️3", "♠️4"], 2)
        state["known_card_owners"] = {card["id"]: "opponent" for card in pool[:2]}
        reply_fixtures.GuandanPublicReplyBeliefTests()._history(state, 13)
        state["pass_limits"] = {"opponent": {"pair": 1}}
        self.assertEqual(self.belief(state, combo)["same_type"], 1.0)

    def test_known_junk_prevents_a_two_card_enemy_from_holding_a_pair(self):
        state, combo, pool = self.case(["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♦️3", "♠️4"], 2)
        state["known_card_owners"] = {pool[2]["id"]: "opponent"}
        self.assertEqual(self.probability(state, combo, pool), 0.0)
        self.assertEqual(self.belief(state, combo)["same_type"], 0.0)

    def test_conditional_grouped_probabilities_match_independent_subsets(self):
        cases = (
            (["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♥️2", "♠️3", "♣️4", "♦️5"], 3),
            (["♠️Q", "♣️Q", "♦️Q"], ["♠️K", "♣️K", "♦️K", "♥️2", "♠️3", "♣️4"], 4),
            (["♠️Q", "♣️Q", "♦️Q", "♣️5", "♦️5"],
             ["♠️K", "♣️K", "♦️K", "🃏B", "🃏B", "♥️2", "♠️3"], 6),
            (["♠️3", "♣️4", "♦️5", "♠️6", "♣️7"],
             ["♠️8", "♣️9", "♦️10", "♠️J", "♣️Q", "♥️2", "♦️3"], 6),
            (["♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5"],
             ["♠️8", "♣️8", "♠️9", "♣️9", "♠️10", "♣️10", "♥️2", "♦️3"], 6),
            (["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4"],
             ["♠️8", "♣️8", "♦️8", "♠️9", "♣️9", "♦️9", "♥️2", "♦️5"], 6),
        )
        for lead, labels, count in cases:
            for owner in ("opponent", "other"):
                with self.subTest(lead=lead, owner=owner):
                    state, combo, pool = self.case(lead, labels, count)
                    state["known_card_owners"] = {pool[0]["id"]: owner}
                    self.assertAlmostEqual(self.probability(state, combo, pool),
                                           self.exhaustive(state, combo, pool))

    def test_owner_change_invalidates_exact_group_cache(self):
        state, combo, pool = self.case(["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♦️3"], 2)
        state["known_card_owners"] = {pool[0]["id"]: "other"}
        self.assertEqual(self.probability(state, combo, pool), 0.0)
        state["known_card_owners"] = {pool[0]["id"]: "opponent"}
        self.assertAlmostEqual(self.probability(state, combo, pool), 0.5)

    def test_hidden_faces_are_never_read(self):
        state, combo, pool = self.case(["♠️Q", "♣️Q"], ["♠️K", "♣️K", "♦️3", "♠️4"], 2)
        state["known_card_owners"] = {pool[0]["id"]: "opponent"}
        expected = self.belief(state, combo)
        for pid in ("opponent", "other"):
            state["players"][pid]["hand"] = CountOnlyHand([object()] * len(state["players"][pid]["hand"]))
        self.assertEqual(self.belief(state, combo), expected)

    def test_inconsistent_public_metadata_does_not_fabricate_certainty(self):
        state, combo, pool = self.case(["♠️A"], ["🃏B", "♠️3", "♣️4"], 1)
        state["known_card_owners"] = {card["id"]: "opponent" for card in pool[:2]}
        self.assertIsNone(self.probability(state, combo, pool))

    def test_six_card_sampler_keeps_owner_locks_and_refreshes_cache(self):
        state, combo, pool = self.case(["♠️Q", "♣️Q"],
                                     ["♠️K", "♣️K", "♦️K", "♠️3", "♣️4", "♦️5", "♣️6", "♠️8"], 6)
        state["known_card_owners"] = {pool[0]["id"]: "opponent", pool[1]["id"]: "other"}
        observed = []

        def record(hand, *_args):
            observed.append({card["id"] for card in hand})
            return False

        with mock.patch.object(guandan_ai, "_short_hand_has_structured_shape", return_value=True), \
                mock.patch.object(guandan_ai, "_short_hand_singleton_pressure_weight", return_value=1.0), \
                mock.patch.object(guandan_ai, "_hand_has_same_type_beat", side_effect=record), \
                mock.patch.object(guandan_ai, "_hand_has_bomb_beat", return_value=False):
            for target, other in ((0, 1), (1, 0)):
                state["known_card_owners"] = {pool[target]["id"]: "opponent", pool[other]["id"]: "other"}
                observed.clear()
                guandan_ai.call(guandan, "_short_hand_structured_reply_breakdown",
                                state, "opponent", combo, pool, accepted_target=16)
                self.assertEqual(len(observed), 16)
                self.assertTrue(all(pool[target]["id"] in ids and pool[other]["id"] not in ids
                                    for ids in observed))

    def test_route_model_does_not_feed_a_publicly_known_enemy_pair(self):
        state = route_fixtures.GuandanHandRouteTests().make_state(
            ["♠️Q", "♣️Q", "♠️3", "♣️3"],
            [["♠️K", "♣️K"], ["♠️4", "♣️5"], ["♦️6"]],
        )
        hand = state["players"]["bot"]["hand"]
        combo = guandan._evaluate_combo(hand[:2], 2, {})
        enemy = state["players"]["opp"]["hand"]
        state["known_card_owners"] = {card["id"]: "opp" for card in enemy}
        profile, _weight = guandan_ai.call(guandan, "_hand_route_reply_model", state, "bot")
        # Evaluate the closure inside a bound core context.
        with mock.patch.object(guandan_ai._CORE_LOCAL, "value", guandan, create=True):
            same, _bomb, finish, _mate_finish, _continuing = profile(combo)
        self.assertEqual(same, 1.0)
        self.assertEqual(finish, 1.0)

    def test_route_bombs_respect_public_flush_rank_and_wild_overbombs(self):
        cases = (
            (["♠️A", "♥️A", "♣️A", "♦️A"],
             ["♣️4", "♣️5", "♣️6", "♣️7", "♣️8"]),
            (["♠️K", "♥️K", "♣️K", "♦️K"],
             ["♠️A", "♥️A", "♣️A", "♦️A"]),
            (["♠️Q", "♥️Q", "♣️Q", "♦️Q"],
             ["♠️K", "♣️K", "♦️K", "♥️2"]),
        )
        for lead, reply in cases:
            with self.subTest(lead=lead, reply=reply):
                state = route_fixtures.GuandanHandRouteTests().make_state(
                    lead + ["♠️3"], [reply, ["♦️9"], ["♦️10"]],
                )
                combo = guandan._evaluate_combo(state["players"]["bot"]["hand"][:4], 2, {})
                enemy = state["players"]["opp"]["hand"]
                reply_combo = guandan._evaluate_combo(enemy, 2, {})
                self.assertTrue(guandan._compare_combos(combo, reply_combo, 2, {}))
                state["known_card_owners"] = {card["id"]: "opp" for card in enemy}
                for pid in ("opp", "mate", "opp2"):
                    state["players"][pid]["hand"] = CountOnlyHand(
                        [object()] * len(state["players"][pid]["hand"]),
                    )
                profile, _weight = guandan_ai.call(guandan, "_hand_route_reply_model", state, "bot")
                with mock.patch.object(guandan_ai._CORE_LOCAL, "value", guandan, create=True):
                    _same, bomb, _finish, _mate_finish, _continuing = profile(combo)
                self.assertEqual(bomb, 1.0)

    def test_existing_route_panel_invalidates_when_public_owner_changes(self):
        fixture = route_fixtures.GuandanHandRouteTests()
        state = fixture.make_state(
            ["♠️Q", "♣️Q", "♠️3", "♣️3"],
            [["♠️K", "♣️K"], ["♠️4", "♣️5"], ["♦️6"]],
        )
        self.assertTrue(fixture.prepare(state))
        self.assertTrue(guandan_ai.call(guandan, "_current_hand_routes", state, "bot"))
        card_id = state["players"]["opp"]["hand"][0]["id"]
        state["known_card_owners"] = {card_id: "opp"}
        self.assertFalse(guandan_ai.call(guandan, "_current_hand_routes", state, "bot"))
        self.assertTrue(fixture.prepare(state))
        state["known_card_owners"] = {str(card_id): "opp"}
        self.assertTrue(guandan_ai.call(guandan, "_current_hand_routes", state, "bot"))
        state["known_card_owners"] = {card_id: "mate"}
        self.assertFalse(guandan_ai.call(guandan, "_current_hand_routes", state, "bot"))


if __name__ == "__main__":
    unittest.main()
