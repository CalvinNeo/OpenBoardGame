"""Regression checks for spending controls within a trick, then leading again."""

import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids


OPENING_61559C_IDS = (
    16, 26, 31, 34, 38, 42, 52, 58, 60, 61, 63, 64, 65, 66,
    67, 69, 70, 72, 79, 82, 84, 85, 86, 88, 96, 97, 104,
)


def make_opening_61559c(hidden_seed=None):
    """Keep the saved own hand and public facts; fabricate all hidden hands."""
    players = [
        {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
        for seat, pid in enumerate(("mate", "opp", "bot", "opp2"))
    ]
    state = guandan.GuandanGame.init_game({"bot_mode": "heuristic"}, players)
    deck = guandan._full_deck()
    own = set(OPENING_61559C_IDS)
    state["players"]["bot"]["hand"] = [card for card in deck if card["id"] in own]
    hidden = [card for card in deck if card["id"] not in own]
    if hidden_seed is not None:
        random.Random(hidden_seed).shuffle(hidden)
    for pid in ("mate", "opp", "opp2"):
        state["players"][pid]["hand"] = hidden[:27]
        del hidden[:27]
    state.update(
        game_start_time=0.0, dealer_team="A", level_rank=2,
        phase="playing", current_turn="bot", current_trick=None,
        trick_plays={}, pass_count=0, finish_order=[], round_memories=[],
        pass_limits={}, seen_cards=[], visible_card_id=84,
        known_card_owners={84: "bot"}, _ai_eval_cache={},
    )
    guandan._start_round_memory(state)
    return state


class GuandanTrickValueTests(unittest.TestCase):
    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    def pair(self, rank):
        cards = [card for card in guandan._full_deck()
                 if card.get("rank") == rank][:2]
        return guandan._evaluate_combo(cards, 2, {})

    def route(self, combos, reply):
        return self.call("_hand_route_plan_values", combos, reply, 1.0, 2, {})

    def value(self, routes, combo):
        return routes[guandan_ai._hand_route_key(combo)]

    def test_low_pair_and_recovery_pair_share_one_lead(self):
        low, high = self.pair(4), self.pair(13)
        enemy_value = self.pair(10)["rank_value"]

        def reply(combo):
            ordinary = float(combo.get("rank_value", 0) < enemy_value)
            return ordinary, 0.0, 0.0, 0.0, ordinary

        routes = self.route([low, high], reply)
        self.assertEqual(self.value(routes, low)["lead_turns"], 1.0)
        self.assertEqual(self.value(routes, high)["lead_turns"], 2.0)
        self.assertEqual(self.value(routes, low)["entry_risk"], 0.0)

    def test_unanswered_low_pair_needs_another_lead_for_the_high_pair(self):
        low, high = self.pair(4), self.pair(13)
        routes = self.route([low, high], lambda combo: (0.0,) * 5)
        self.assertEqual(self.value(routes, low)["lead_turns"], 2.0)
        self.assertEqual(self.value(routes, high)["lead_turns"], 2.0)

    def test_enemy_above_the_recovery_pair_prevents_free_reentry(self):
        low, high = self.pair(4), self.pair(13)
        routes = self.route([low, high], lambda combo: (1.0, 0.0, 0.0, 0.0, 1.0))
        self.assertEqual(self.value(routes, low)["lead_turns"], 2.0)
        self.assertGreater(self.value(routes, low)["entry_risk"], 0.0)

    def test_finishing_enemy_reply_cannot_be_recovered(self):
        low, high = self.pair(4), self.pair(13)
        enemy_value = self.pair(10)["rank_value"]

        def reply(combo):
            finish = float(combo.get("rank_value", 0) < enemy_value)
            return finish, 0.0, finish, 0.0, 0.0

        routes = self.route([low, high], reply)
        self.assertEqual(self.value(routes, low)["lead_turns"], 2.0)
        self.assertGreater(self.value(routes, low)["entry_risk"],
                           self.value(routes, high)["entry_risk"])

    def test_one_high_pair_is_consumed_after_one_recovery(self):
        combos = [self.pair(rank) for rank in (3, 4, 5, 13)]
        enemy_value = self.pair(10)["rank_value"]

        def reply(combo):
            ordinary = float(combo.get("rank_value", 0) < enemy_value)
            return ordinary, 0.0, 0.0, 0.0, ordinary

        routes = self.route(combos, reply)
        self.assertEqual(self.value(routes, combos[0])["lead_turns"], 3.0)
        self.assertEqual(self.value(routes, combos[0])["entry_risk"], 1.0)

    def test_saved_opening_does_not_invent_a_two_turn_gain_for_kings(self):
        state = make_opening_61559c()
        hand = state["players"]["bot"]["hand"]
        low = pick_card_ids(hand, ["♣️4", "♥️4"])
        high = pick_card_ids(hand, ["♦️K", "♠️K"])
        options = guandan._list_hint_options(state, "bot")
        self.call("_prepare_hand_route_scores", state, "bot", options)
        self.assertTrue(state["_ai_eval_cache"]["hand_route_status"]["complete"])
        panel = state["_ai_eval_cache"]["hand_routes"]
        low_route = panel[guandan._cards_key(low)]
        high_route = panel[guandan._cards_key(high)]
        self.assertTrue(low_route["exact"] and high_route["exact"])
        self.assertLessEqual(low_route["lead_turns"], high_route["lead_turns"])
        self.assertAlmostEqual(low_route["lead_turns"], high_route["lead_turns"], delta=0.05)
        low_score = guandan._bot_score_components(state, "bot", low, 4)
        high_score = guandan._bot_score_components(state, "bot", high, 4)
        for score in (low_score, high_score):
            self.assertNotIn("lead_turns", score)  # Shape points are not future lead counts.
        self.assertGreater(low_score["total"], high_score["total"])

    def test_saved_opening_does_not_cash_kings_to_improve_a_greedy_partition(self):
        state = make_opening_61559c()
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action["type"], "play")
        ranks = sorted(hand[cid].get("rank") or 99 for cid in action["card_ids"])
        self.assertEqual(ranks, [4, 4])
        explanation = state["bot_explain"]["bot"]
        for entry in explanation["top"]:
            self.assertAlmostEqual(entry["score"], sum(entry["components"].values()), places=2)
            self.assertNotIn("lead_turns", entry["components"])
            route = entry["hand_route"]
            self.assertIn("exact", route)
            self.assertAlmostEqual(
                route["cost"], route["lead_turns"] + 1.6 * route["entry_risk"]
                + route["material_commitment"] + route["control_commitment"], places=3,
            )

    def test_saved_opening_choice_ignores_hidden_hand_allocations(self):
        choices = []
        for seed in (0, 17):
            state = make_opening_61559c(seed)
            action = guandan.GuandanGame.bot_move(state, "bot")
            choices.append(action)
        self.assertEqual(choices[0], choices[1])

    def test_greedy_cover_improvement_is_not_positive_turn_credit(self):
        state = make_opening_61559c()
        hand = state["players"]["bot"]["hand"]
        cards = pick_card_ids(hand, ["♦️K", "♠️K"])
        combo = guandan._evaluate_combo([c for c in hand if c["id"] in cards], 2, {})
        scores = []
        # Both summaries leave the identical nine-group playable cover after
        # the lead. Discovering it late must not reward a worse initial guess.
        for before_turns in (9, 11):
            with mock.patch.object(guandan_ai, "_hand_decomposition_summary", side_effect=[
                {"turns": before_turns, "score": 0.0}, {"turns": 8, "score": 0.0},
            ]), mock.patch.object(guandan_ai, "_plan_alignment_score", return_value=0.0):
                scores.append(guandan._lead_structure_efficiency_bonus(state, "bot", cards, combo))
        self.assertEqual(scores, [0.0, 0.0])


if __name__ == "__main__":
    unittest.main()
