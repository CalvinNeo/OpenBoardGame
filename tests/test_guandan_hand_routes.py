import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanHandRouteTests(unittest.TestCase):
    OPENING = [
        "🃏B", "🃏B", "♥️2", "♠️2", "♠️A", "♦️A", "♣️K", "♦️K",
        "♣️Q", "♥️Q", "♣️10", "♦️10", "♣️9", "♦️9", "♥️8", "♥️8",
        "♦️7", "♠️7", "♣️6", "♦️6", "♠️5", "♣️5", "♠️4", "♠️4",
        "♥️4", "♥️3", "♦️3",
    ]

    def make_state(self, own, others=None, level=2):
        players = [{"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
                   for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()

        def take(labels):
            cards = []
            for label in labels:
                card = next(c for c in deck if guandan._card_label(c) == label)
                deck.remove(card)
                cards.append(card)
            return cards

        state["players"]["bot"]["hand"] = take(own)
        for pid, labels in zip(("opp", "mate", "opp2"), others or (None, None, None)):
            if labels is None:
                cards = deck[:min(27, len(deck))]
                del deck[:len(cards)]
            else:
                cards = take(labels)
            state["players"][pid].update(hand=cards, finished=not cards, finish_rank=None)
        state.update(phase="playing", level_rank=level, current_turn="bot",
                     current_trick=None, trick_plays={}, pass_count=0,
                     finish_order=[], round_memories=[], pass_limits={},
                     seen_cards=[c["id"] for c in deck], known_card_owners={},
                     visible_card_id=None, _ai_eval_cache={})
        state["config"].update(bot_mode="heuristic", bot_search_depth=2, bot_think_time_ms=2000)
        return state

    def prepare(self, state, deadline=None):
        options = guandan._list_hint_options(state, "bot")
        guandan_ai.call(guandan, "_prepare_hand_route_scores", state, "bot", options, deadline)
        return state["_ai_eval_cache"].get("hand_routes", {})

    def cards(self, state, ranks):
        available = list(state["players"]["bot"]["hand"])
        result = []
        for rank in ranks:
            card = next(c for c in available if c.get("rank") == rank
                        and not guandan._is_wild(c, state["level_rank"]))
            available.remove(card)
            result.append(card["id"])
        return result

    def test_opening_compares_the_same_complete_cover_in_both_orders(self):
        state = self.make_state(self.OPENING)
        panel = self.prepare(state)
        low = panel[guandan._cards_key(self.cards(state, [5, 5, 6, 6, 7, 7]))]
        high = panel[guandan._cards_key(self.cards(state, [8, 8, 9, 9, 10, 10]))]
        self.assertEqual(low["turns"], 6)
        self.assertEqual(high["turns"], 6)
        self.assertLess(low["entry_risk"], high["entry_risk"])
        action = guandan.GuandanGame.bot_move(state, "bot")
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        self.assertEqual(sorted(hand[cid]["rank"] for cid in action["card_ids"]),
                         [5, 5, 6, 6, 7, 7])
        route = state["bot_explain"]["bot"]["method_details"]["hand_route"]
        self.assertEqual(route["turns"], 6)
        explanation = state["bot_explain"]["bot"]
        self.assertAlmostEqual(explanation["chosen"]["score"],
                               sum(explanation["chosen"]["components"].values()))

    def test_two_run_finish_blocks_opponents_who_could_finish_on_the_reply(self):
        state = self.make_state([
            "♠️5", "♣️5", "♣️6", "♦️6", "♠️7", "♦️7",
            "♥️8", "♥️8", "♣️9", "♦️9", "♣️10", "♦️10",
        ], [
            ["♣️7", "♥️7", "♠️8", "♣️8", "♠️9", "♥️9"],
            ["♥️3", "♦️3", "♠️4", "♣️4"],
            ["♠️Q", "♦️Q", "♠️K", "♥️K", "♠️A", "♥️A"],
        ])
        panel = self.prepare(state)
        low = panel[guandan._cards_key(self.cards(state, [5, 5, 6, 6, 7, 7]))]
        high = panel[guandan._cards_key(self.cards(state, [8, 8, 9, 9, 10, 10]))]
        self.assertEqual(low["turns"], 2)
        self.assertEqual(high["turns"], 2)
        self.assertLess(high["cost"], low["cost"])

    def test_joker_then_wild_full_house_finishes_before_actual_opponents(self):
        state = self.make_state(
            ["🃏B", "♥️2", "♦️7", "♠️7", "♣️6", "♦️6"],
            [
                ["♠️2", "♣️2", "♠️A", "♣️A", "♦️A", "♠️6", "♣️6"],
                ["♥️Q", "♥️9", "♥️9", "♣️7", "♦️7", "♥️3"],
                ["🃏S", "♥️A", "♥️A", "♣️A", "♥️5"],
            ],
        )
        original = copy.deepcopy(state)
        action = guandan.GuandanGame.bot_move(state, "bot")
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        self.assertEqual([hand[cid].get("joker") for cid in action["card_ids"]], ["big"])
        _, error = guandan.GuandanGame.apply_action(state, "bot", action)
        self.assertIsNone(error)
        for pid in ("opp", "mate", "opp2"):
            self.assertEqual(state["current_turn"], pid)
            self.assertEqual(guandan._list_hint_options(state, pid), [])
            _, error = guandan.GuandanGame.apply_action(state, pid, {"type": "pass"})
            self.assertIsNone(error)
        finish = {"type": "play", "card_ids": [c["id"] for c in state["players"]["bot"]["hand"]]}
        _, error = guandan.GuandanGame.apply_action(state, "bot", finish)
        self.assertIsNone(error)
        self.assertEqual(state["players"]["bot"]["finish_rank"], 1)
        # The decision's prior can use only the public pool, not this referee's hands.
        shuffled = copy.deepcopy(original)
        pool = sum((shuffled["players"][pid]["hand"] for pid in ("opp", "mate", "opp2")), [])
        random.Random(18).shuffle(pool)
        for pid in ("opp", "mate", "opp2"):
            count = len(shuffled["players"][pid]["hand"])
            shuffled["players"][pid]["hand"] = pool[:count]
            del pool[:count]
        self.assertEqual(self.prepare(original), self.prepare(shuffled))

    def test_every_cover_uses_each_physical_card_once_including_both_wilds(self):
        state = self.make_state([
            "♥️2", "♥️2", "♠️3", "♣️3", "♠️4", "♥️4", "♣️4",
            "♠️5", "♣️5", "♥️6", "♣️6", "♥️7", "♣️7",
            "♥️9", "♥️10", "♥️J", "♥️Q", "♥️K",
        ])
        panel = self.prepare(state)
        self.assertTrue(panel)
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        for route in panel.values():
            used = [cid for group in route["groups"] for cid in group]
            self.assertEqual(len(used), len(set(used)))
            self.assertEqual(set(used), set(hand))
            self.assertIn(set(route["cards"]), [set(group) for group in route["groups"]])
            for group in route["groups"]:
                self.assertIsNotNone(guandan._evaluate_combo([hand[cid] for cid in group], 2, {}))

    def test_one_high_pair_cannot_recover_every_low_pair(self):
        state = self.make_state([
            "♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5", "♠️A", "♣️A",
        ])
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        combos = [guandan._evaluate_combo([hand[cid] for cid in self.cards(state, [rank, rank])],
                                         2, {}) for rank in (3, 4, 5, 14)]
        # Controlled reply model: opponents can always beat low pairs and can
        # never beat AA; replying leaves them cards. AA covers one loss only.
        threshold = (combos[-1]["rank_value"] + combos[-2]["rank_value"]) / 2

        def replies(combo):
            ordinary = float(combo["rank_value"] < threshold)
            return ordinary, 0.0, 0.0, 0.0, ordinary

        costs = guandan_ai.call(guandan, "_hand_route_plan_costs", combos, replies, 1.0, 2, {})
        self.assertAlmostEqual(costs[guandan_ai._hand_route_key(combos[0])], 1.0)

    def test_opponent_finishing_reply_cannot_be_recovered(self):
        state = self.make_state(["♠️3", "♣️3", "♠️A", "♣️A"])
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        combos = [guandan._evaluate_combo([hand[cid] for cid in self.cards(state, [rank, rank])],
                                         2, {}) for rank in (3, 14)]
        threshold = (combos[0]["rank_value"] + combos[1]["rank_value"]) / 2

        def replies(combo):
            finish = float(combo["rank_value"] < threshold)
            return finish, 0.0, finish, 0.0, 0.0

        costs = guandan_ai.call(guandan, "_hand_route_plan_costs", combos, replies, 1.0, 2, {})
        self.assertGreater(costs[guandan_ai._hand_route_key(combos[0])], 0.0)
        self.assertEqual(costs[guandan_ai._hand_route_key(combos[1])], 0.0)

    def test_planner_never_reads_other_players_card_faces(self):
        class CountsOnly(list):
            def __iter__(self):
                raise AssertionError("hidden hand iterated")

            def __getitem__(self, key):
                raise AssertionError("hidden card inspected")

        state = self.make_state(self.OPENING)
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = CountsOnly(state["players"][pid]["hand"])
        self.assertTrue(self.prepare(state))

    def test_deadline_does_not_publish_an_incomplete_candidate_panel(self):
        state = self.make_state(self.OPENING)
        options = guandan._list_hint_options(state, "bot")
        ticks = iter([0.0, 0.0, 0.0, 2.0])
        with mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: next(ticks, 2.0)):
            guandan_ai.call(guandan, "_prepare_hand_route_scores", state, "bot", options, 1.0)
        self.assertNotIn("hand_routes", state["_ai_eval_cache"])
        self.assertFalse(state["_ai_eval_cache"]["hand_route_status"]["complete"])
        self.assertTrue(self.prepare(state))

    def test_changed_public_counts_recompute_and_search_children_drop_routes(self):
        state = self.make_state(self.OPENING)
        self.prepare(state)
        before_key = state["_ai_eval_cache"]["hand_route_key"]
        # No hidden face changed; the new public card count must still invalidate.
        state["players"]["mate"]["hand"].append(state["players"]["opp"]["hand"].pop())
        self.prepare(state)
        self.assertNotEqual(before_key, state["_ai_eval_cache"]["hand_route_key"])
        child = guandan._clone_search_state(state, preserve_eval_cache=True)
        self.assertNotIn("hand_routes", child["_ai_eval_cache"])
        self.assertNotIn("hand_route_key", child["_ai_eval_cache"])

    def test_changed_hand_cannot_reuse_a_route_for_a_still_legal_action(self):
        state = self.make_state(self.OPENING)
        self.prepare(state)
        # Both runs still exist, but their former full-hand cover is stale.
        state["players"]["bot"]["hand"].pop(0)
        scored = [(self.cards(state, ranks), score, {"total": score})
                  for ranks, score in (([5, 5, 6, 6, 7, 7], 10.0),
                                       ([8, 8, 9, 9, 10, 10], 12.0))]
        original = copy.deepcopy(scored)
        guandan_ai.call(guandan, "_apply_hand_route_order", state, "bot", scored)
        self.assertEqual(scored, original)

    def test_expired_refresh_discards_old_routes_and_finalist_scores(self):
        state = self.make_state(self.OPENING)
        self.prepare(state)
        state["_ai_eval_cache"]["heuristic_scored_candidates"] = {"old": "scores"}
        state["players"]["mate"]["hand"].append(state["players"]["opp"]["hand"].pop())
        with mock.patch.object(guandan_ai.time, "perf_counter", return_value=2.0):
            self.prepare(state, deadline=1.0)
        for name in ("hand_routes", "hand_route_key", "hand_route_context",
                     "heuristic_scored_candidates"):
            self.assertNotIn(name, state["_ai_eval_cache"])
        self.assertFalse(state["_ai_eval_cache"]["hand_route_status"]["complete"])


if __name__ == "__main__":
    unittest.main()
