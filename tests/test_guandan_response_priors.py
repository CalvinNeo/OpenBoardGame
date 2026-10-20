import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanResponsePriorTests(unittest.TestCase):
    def fixture(self, ranks=(7, 9, 9, 11)):
        players = [{"player_id": f"p{i}", "name": f"p{i}", "seat": i} for i in range(4)]
        with mock.patch.object(guandan, "random", random.Random(0)):
            state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()

        def take(rank):
            card = next(card for card in deck if card.get("rank") == rank)
            deck.remove(card)
            return card

        hand = [take(rank) for rank in ranks]
        lead = take(6)
        state.update(
            phase="playing", level_rank=2, current_turn="p0", finish_order=[],
            round_memories=[], pass_limits={}, known_card_owners={}, visible_card_id=None,
            _ai_eval_cache={"bounded_response_ranking": True},
            current_trick={"player_id": "p3", "cards": [lead["id"]],
                           "combo": guandan._evaluate_combo([lead], 2, {})},
            trick_plays={"p3": [lead]}, pass_count=0,
        )
        state["players"]["p0"]["hand"] = hand
        for pid in ("p1", "p2", "p3"):
            state["players"][pid]["hand"] = deck[:15]
            del deck[:15]
        state["seen_cards"] = [lead["id"]] + [card["id"] for card in deck]
        return state

    def call(self, name, state, *args):
        return guandan_ai.call(guandan, name, state, "p0", *args)

    def test_bounded_ranking_publishes_prior_to_existing_quick_cache(self):
        state = self.fixture()
        options = guandan._list_hint_options(state, "p0")
        before = {tuple(cards): self.call("_quick_candidate_score", state, cards)
                  for cards in options}
        ranked = self.call("_rank_response_options", state, options)
        penalized = [cards for cards in ranked
                     if self.call("_response_soft_pruning_penalty", state, cards) > 0]
        self.assertTrue(penalized)
        for cards in penalized:
            expected = before[tuple(cards)] - self.call("_response_soft_pruning_penalty", state, cards)
            self.assertAlmostEqual(self.call("_quick_candidate_score", state, cards), expected)
        # Ranking is allowed to populate caches but not to drift when repeated.
        self.assertEqual(self.call("_rank_response_options", state, options), ranked)
        for cards in penalized:
            fresh = copy.deepcopy(state)
            fresh["_ai_eval_cache"].pop("shared_response_tactical_components", None)
            self.assertEqual(self.call("_quick_candidate_score", state, cards),
                             self.call("_quick_candidate_score", fresh, cards))

    def test_overbomb_filter_publishes_prior_to_existing_quick_cache(self):
        state = self.fixture((7, 13, 13, 13, 13, 8))
        options = guandan._list_hint_options(state, "p0")
        ranked = self.call("_rank_response_options", state, options)
        bomb = next(cards for cards in ranked if len(cards) == 4)
        before = self.call("_quick_candidate_score", state, bomb)
        self.call("_filter_overbomb_options", state, ranked)
        penalty = self.call("_overbomb_soft_pruning_penalty", state, bomb)
        self.assertGreater(penalty, 0)
        self.assertAlmostEqual(self.call("_quick_candidate_score", state, bomb), before - penalty)

    def test_completed_detail_recomputes_when_response_prior_changes(self):
        state = self.fixture()
        cards = [next(card["id"] for card in state["players"]["p0"]["hand"]
                      if card["rank"] == 9)]
        before = self.call("_bot_score_components", state, cards, 1)
        self.assertNotIn("anytime_partial", before)
        self.assertEqual(before.get("soft_candidate_prior", 0), 0)
        self.call("_rank_response_options", state, guandan._list_hint_options(state, "p0"))
        after = self.call("_bot_score_components", state, cards, 1)
        self.assertEqual(after["soft_candidate_prior"], -10)
        self.assertAlmostEqual(after["total"], before["total"] - 10)
        self.assertEqual(self.call("_bot_score_components", state, cards, 1), after)

    def test_pass_component_cache_depends_on_response_priors(self):
        state = self.fixture()
        # Pass can depend on any response's score through its opportunity cost,
        # so the whole player's prior panel belongs to its cache identity.
        with mock.patch.object(guandan_ai, "_compute_bot_score_components",
                               side_effect=[{"total": 7.0}, {"total": 3.0}]) as compute:
            self.assertEqual(self.call("_bot_score_components", state, None, 1)["total"], 7)
            self.call("_rank_response_options", state, guandan._list_hint_options(state, "p0"))
            self.assertEqual(self.call("_bot_score_components", state, None, 1)["total"], 3)
            self.assertEqual(self.call("_bot_score_components", state, None, 1)["total"], 3)
            self.assertEqual(compute.call_count, 2)


if __name__ == "__main__":
    unittest.main()
