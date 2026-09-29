import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanCompleteHeuristicTests(unittest.TestCase):
    # Bot 2's opening server state in 21481a_8.save, with anonymous player IDs.
    OPENING = [
        "♣️2", "♠️2", "♥️2", "♦️2", "♠️A", "♠️A", "♣️A", "♥️A",
        "♠️K", "♣️K", "♦️K", "♠️J", "♦️10", "♥️10", "♦️8", "♣️8",
        "♥️8", "♣️7", "♣️6", "♠️6", "♥️5", "♠️5", "♣️5", "♦️4",
        "♣️3", "♣️3", "♠️3",
    ]
    # Preserve the canonical replay's physical copies as well as card faces;
    # decomposition's existing tie breaks include physical IDs.
    OPENING_IDS = (0, 1, 3, 12, 13, 19, 21, 27, 29, 31, 32, 38, 39, 41, 45,
                   47, 58, 63, 65, 66, 70, 79, 80, 81, 84, 91, 104)
    OTHER_HAND_IDS = {
        "opp": (2, 4, 5, 6, 7, 9, 11, 15, 16, 17, 18, 22, 23, 25, 26, 30,
                33, 34, 35, 37, 40, 43, 48, 50, 88, 94, 102),
        "opp2": (10, 20, 24, 28, 42, 44, 46, 49, 51, 52, 53, 57, 59, 61, 64,
                 67, 69, 71, 72, 78, 83, 87, 89, 92, 93, 99, 106),
        "mate": (8, 14, 36, 54, 55, 56, 60, 62, 68, 73, 74, 75, 76, 77, 82,
                 85, 86, 90, 95, 96, 97, 98, 100, 101, 103, 105, 107),
    }

    def make_state(self):
        players = [{"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
                   for seat, pid in enumerate(("opp", "bot", "opp2", "mate"))]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        own = set(self.OPENING_IDS)
        state["players"]["bot"]["hand"] = [c for c in deck if c["id"] in own]
        self.assertCountEqual([guandan._card_label(c) for c in state["players"]["bot"]["hand"]],
                              self.OPENING)
        for pid, ids in self.OTHER_HAND_IDS.items():
            state["players"][pid]["hand"] = [c for c in deck if c["id"] in ids]
        visible = pick_card_ids(state["players"]["bot"]["hand"], ["♠️5"])[0]
        state.update(phase="playing", dealer_team="B", level_rank=2, current_turn="bot",
                     current_trick=None, trick_plays={}, pass_count=0, finish_order=[],
                     round_memories=[], pass_limits={}, seen_cards=[],
                     known_card_owners={}, visible_card_id=visible)
        guandan._start_round_memory(state)
        return state

    def test_slow_clock_still_scores_every_candidate_and_completes_routes(self):
        clock = [0.0]
        original_score = guandan_ai._bot_finalist_score_components
        original_route = guandan_ai._hand_route_plan_values
        original_store = guandan_ai._store_heuristic_scored_candidates

        def score(*args, **kwargs):
            result = original_score(*args, **kwargs)
            clock[0] += 1.0  # Deliberately exceed the entire six-second budget.
            return result

        def route(*args, **kwargs):
            result = original_route(*args, **kwargs)
            clock[0] += 1.0  # Also exceed the old separate route-panel cutoff.
            return result

        results = []
        for slow in (False, True):
            state = self.make_state()
            clock[0] = 0.0
            scored = []

            def store(current, player, depth, candidates):
                scored[:] = copy.deepcopy(candidates)
                return original_store(current, player, depth, candidates)

            with (
                mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]),
                mock.patch.object(guandan_ai, "_bot_finalist_score_components",
                                  side_effect=score if slow else original_score),
                mock.patch.object(guandan_ai, "_hand_route_plan_values",
                                  side_effect=route if slow else original_route),
                mock.patch.object(guandan_ai, "_store_heuristic_scored_candidates", side_effect=store),
                mock.patch.object(guandan, "_mcts_pick_action", side_effect=AssertionError("late MCTS")),
            ):
                action = guandan.GuandanGame.bot_move(state, "bot")

            with self.subTest(slow=slow):
                details = state["bot_explain"]["bot"]["method_details"]
                self.assertEqual(details["heuristic_candidates_evaluated"], 277)
                self.assertEqual(details["heuristic_candidates_evaluated"], details["heuristic_candidates_total"])
                self.assertEqual(len(scored), 277)
                self.assertEqual(details["heuristic_stop_reason"], "candidates_exhausted")
                self.assertTrue(details["hand_route_status"]["complete"])
                self.assertEqual(state["bot_explain"]["bot"]["chosen"]["cards"], ["♦️4"])
                if slow:
                    self.assertGreater(clock[0], 6.0)
            results.append((action, scored))
        self.assertEqual(results[0], results[1])

    def test_short_response_budget_cannot_reduce_root_scoring(self):
        state = replay_fixture("38c", 3, {
            "bot_think_time_ms": 40, "bot_mode": "heuristic",
        })
        bot_id = state["current_turn"]
        clock = [0.0]
        compared = []
        original = guandan_ai._bot_finalist_score_components

        def score(current, player, cards, depth, bounded=False):
            compared.append((cards, bounded))
            result = original(current, player, cards, depth, bounded=bounded)
            clock[0] += 1.0
            return result

        with (
            mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]),
            mock.patch.object(guandan_ai, "_bot_finalist_score_components", side_effect=score),
        ):
            guandan.GuandanGame.bot_move(state, bot_id)
        explain = state["bot_explain"][bot_id]
        details = explain["method_details"]
        self.assertEqual(len(compared), 38)
        self.assertIn((None, False), compared)
        self.assertFalse(any(bounded for _cards, bounded in compared))
        self.assertEqual(details["heuristic_scoring_mode"], "full")
        self.assertEqual(details["heuristic_candidates_evaluated"], details["heuristic_candidates_total"])
        self.assertEqual(details["heuristic_stop_reason"], "candidates_exhausted")
        self.assertEqual(explain["chosen"]["cards"], ["♣️10", "♦️10"])

    def test_completion_scope_restores_search_deadlines_even_after_errors(self):
        with mock.patch.object(guandan_ai.time, "perf_counter", return_value=10.0):
            self.assertTrue(guandan_ai._deadline_expired(1.0))
            with self.assertRaisesRegex(ValueError, "test failure"):
                with guandan_ai.complete_heuristic_scoring():
                    self.assertFalse(guandan_ai._deadline_expired(1.0))
                    with guandan_ai.complete_heuristic_scoring():
                        self.assertIsNone(guandan_ai._deadline_remaining(1.0))
                    self.assertFalse(guandan_ai._deadline_expired(1.0))
                    raise ValueError("test failure")
            self.assertTrue(guandan_ai._deadline_expired(1.0))

    def test_reused_rank_statistics_match_independent_scans_for_every_generated_play(self):
        rng = random.Random(21481)
        original = guandan_ai._decomposition_local_value
        checked = []

        def compare(hand, cards, combo, level, context=None):
            result = original(hand, cards, combo, level, context)
            self.assertEqual(result, original(hand, cards, combo, level))
            checked.append((tuple(cards), combo["type"]))
            return result

        deck = guandan._full_deck()
        hands = [(level, rng.sample(deck, size))
                 for level in (2, 7, 14) for size in (5, 9, 18, 27)]
        for level in (2, 7, 14):
            wild = next(c for c in deck if guandan._is_wild(c, level))
            hand = rng.sample([c for c in deck if c["id"] != wild["id"]], 26) + [wild]
            hands.append((level, hand))
        with mock.patch.object(guandan_ai, "_decomposition_local_value", side_effect=compare):
            for level, hand in hands:
                saved = copy.deepcopy(hand)
                guandan_ai.call(guandan, "_compute_decomposition_candidates", hand, level)
                self.assertEqual(hand, saved)
        self.assertGreater(len(checked), 100)


if __name__ == "__main__":
    unittest.main()
