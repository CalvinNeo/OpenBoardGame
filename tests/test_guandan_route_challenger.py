"""Boundaries for replacing a lead with a better order of the same cover."""

import copy
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids


class GuandanRouteChallengerTests(unittest.TestCase):
    def make_state(self, labels):
        players = [{"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
                   for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        own = set(pick_card_ids(deck, labels))
        state["players"]["bot"]["hand"] = [card for card in deck if card["id"] in own]
        deck = [card for card in deck if card["id"] not in own]
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:14]
            del deck[:14]
        state.update(
            phase="playing", current_turn="bot", current_trick=None,
            level_rank=2, finish_order=[], trick_plays={}, pass_count=0,
            seen_cards=[card["id"] for card in deck], known_card_owners={},
            visible_card_id=None, round_memories=[], pass_limits={}, _ai_eval_cache={},
        )
        return state

    def setUp(self):
        self.state = self.make_state([
            "♣️K", "♠️K", "♥️K", "♦️10", "♥️10", "♥️9", "♠️9",
            "♥️8", "♣️8", "♦️8", "♦️4", "♠️3", "♥️3", "♣️3",
        ])
        self.hand = self.state["players"]["bot"]["hand"]
        guandan_ai.call(guandan, "_prepare_hand_route_scores", self.state, "bot",
                        guandan._list_hint_options(self.state, "bot"), None)
        self.panel = self.state["_ai_eval_cache"]["hand_routes"]
        self.single = pick_card_ids(self.hand, ["♦️4"])
        self.three = pick_card_ids(self.hand, ["♥️8", "♣️8", "♦️8"])
        self.house = pick_card_ids(self.hand, ["♠️3", "♥️3", "♣️3", "♥️9", "♠️9"])

    def route(self, cards):
        return self.panel[guandan._cards_key(cards)]

    def reconcile(self, candidates):
        # These are finalist priors, before the route reconciles their order.
        scored = [(cards, value, {"prior": value, "total": value})
                  for cards, value in candidates]
        guandan_ai.call(guandan, "_apply_hand_route_order", self.state, "bot", scored)
        for _cards, score, components in scored:
            self.assertAlmostEqual(score, sum(value for name, value in components.items()
                                             if name != "total"))
        return scored

    def test_same_cover_recovers_through_the_full_house_before_losing_the_lead(self):
        single, house = self.route(self.single), self.route(self.house)
        self.assertEqual(single["order_group"][1], house["order_group"][1])
        self.assertLess(house["entry_risk"], single["entry_risk"])
        self.assertLess(house["cost"], single["cost"] - 0.05)
        scored = self.reconcile([(self.single, 10.0), (self.house, 1.0)])
        chosen = max(scored, key=lambda entry: entry[1])
        self.assertEqual(chosen[0], self.house)
        self.assertGreater(chosen[2]["hand_route_cross_order"], 0.0)

    def test_equivalent_routes_keep_the_existing_tactical_preference(self):
        # The triple and full house have the same recovery cost. More cards
        # and floating-point noise must not reverse an established preference.
        self.assertAlmostEqual(self.route(self.three)["cost"],
                               self.route(self.house)["cost"], places=12)
        scored = self.reconcile([
            (self.single, 10.0), (self.three, 2.0), (self.house, 1.0),
        ])
        self.assertEqual(max(scored, key=lambda entry: entry[1])[0], self.three)
        self.assertEqual(sum("hand_route_cross_order" in entry[2] for entry in scored), 1)

    def test_different_cover_cannot_borrow_the_incumbent_score(self):
        other_house = pick_card_ids(
            self.hand, ["♠️3", "♥️3", "♣️3", "♦️10", "♥️10"],
        )
        # Both full houses are executable, but moving the pair changes the
        # physical allocation. Their cost estimates do not prove dominance.
        self.assertLess(self.route(other_house)["cost"], self.route(self.single)["cost"])
        self.assertNotEqual(self.route(other_house)["order_group"][1],
                            self.route(self.single)["order_group"][1])
        scored = self.reconcile([(self.single, 10.0), (other_house, 1.0)])
        self.assertEqual(max(scored, key=lambda entry: entry[1])[0], self.single)
        self.assertFalse(any("hand_route_cross_order" in entry[2] for entry in scored))

    def test_personal_route_cannot_replace_a_race_partial_score_or_bomb_decision(self):
        for boundary in ("finished_race", "partial_incumbent", "partial_challenger", "bomb"):
            with self.subTest(boundary=boundary):
                state = copy.deepcopy(self.state)
                incumbent, challenger = self.single, self.house
                if boundary == "finished_race":
                    opponent = state["players"]["opp"]
                    state["seen_cards"].extend(card["id"] for card in opponent["hand"])
                    opponent.update(hand=[], finished=True, finish_rank=1)
                    state["finish_order"] = ["opp"]
                elif boundary == "bomb":
                    state = self.make_state([
                        "♠️3", "♣️3", "♥️3", "♦️3", "♠️5", "♣️5",
                        "♠️9", "♣️9", "♠️K",
                    ])
                    hand = state["players"]["bot"]["hand"]
                    incumbent = pick_card_ids(hand, ["♠️3", "♣️3", "♥️3", "♦️3"])
                    challenger = pick_card_ids(hand, ["♠️5", "♣️5"])
                state["_ai_eval_cache"] = {}
                guandan_ai.call(guandan, "_prepare_hand_route_scores", state, "bot",
                                guandan._list_hint_options(state, "bot"), None)
                panel = state["_ai_eval_cache"]["hand_routes"]
                before = panel[guandan._cards_key(incumbent)]
                after = panel[guandan._cards_key(challenger)]
                # Make each boundary non-vacuous: the actual route would
                # otherwise favor the alternative from this physical cover.
                self.assertEqual(before["order_group"][1], after["order_group"][1])
                self.assertLess(after["cost"], before["cost"] - 0.05)
                scored = [(incumbent, 10.0, {"prior": 10.0, "total": 10.0}),
                          (challenger, 1.0, {"prior": 1.0, "total": 1.0})]
                if boundary == "partial_incumbent":
                    scored[0][2]["anytime_partial"] = 1.0
                    scored[0][2]["prior"] -= 1.0
                elif boundary == "partial_challenger":
                    scored[1][2]["anytime_partial"] = 1.0
                    scored[1][2]["prior"] -= 1.0
                guandan_ai.call(guandan, "_apply_hand_route_order", state, "bot", scored)
                self.assertEqual(max(scored, key=lambda entry: entry[1])[0], incumbent)
                self.assertFalse(any("hand_route_cross_order" in entry[2] for entry in scored))


if __name__ == "__main__":
    unittest.main()
