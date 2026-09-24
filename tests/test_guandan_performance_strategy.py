import copy
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids


class GuandanPerformanceStrategyTests(unittest.TestCase):
    def make_state(self, labels):
        players = [{"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
                   for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))]
        state = guandan.GuandanGame.init_game({"bot_mode": "heuristic"}, players)
        deck = guandan._full_deck()
        own = set(pick_card_ids(deck, labels))
        state["players"]["bot"]["hand"] = [c for c in deck if c["id"] in own]
        rest = [c for c in deck if c["id"] not in own]
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = rest[:27]
            del rest[:27]
        state.update(current_turn="bot", level_rank=2, current_trick=None,
                     round_memories=[], seen_cards=[c["id"] for c in rest],
                     known_card_owners={}, pass_limits={}, trick_plays={},
                     visible_card_id=None, _ai_eval_cache={})
        return state

    def test_more_time_restores_full_response_scoring_and_deferred_candidates(self):
        for budget, bounded, expected_count in ((0.3, True, 3), (3.0, False, 7)):
            with self.subTest(budget=budget):
                state = self.make_state(["♠️4", "♠️6", "♠️8", "♠️10", "♠️Q", "♠️A"])
                state["config"]["bot_heuristic_bounded_hand_threshold"] = 1
                state["config"]["bot_heuristic_deep_candidate_limit"] = 4
                state["current_trick"] = {"player_id": "opp", "cards": [],
                                          "combo": {"type": "single", "size": 1, "rank_value": 50}}
                options = [[c["id"]] for c in state["players"]["bot"]["hand"]]
                modes = []

                def quick(_state, _pid, cards):
                    return -100.0 if cards is None else -options.index(cards)

                def detailed(_state, _pid, cards, _depth):
                    modes.append(guandan_ai._bounded_finalist_scoring())
                    return {"total": 100.0 if cards == options[-1] else 0.0}

                with (
                    mock.patch.object(guandan_ai.time, "perf_counter", return_value=100.0),
                    mock.patch.object(guandan_ai, "_can_play_all", return_value=False),
                    mock.patch.object(guandan_ai, "_list_hint_options", return_value=options),
                    mock.patch.object(guandan_ai, "_rank_response_options", side_effect=lambda _s, _p, opts: opts),
                    mock.patch.object(guandan_ai, "_filter_overbomb_options", side_effect=lambda _s, _p, opts: opts),
                    mock.patch.object(guandan_ai, "_quick_candidate_score", side_effect=quick),
                    mock.patch.object(guandan_ai, "_bot_score_components", side_effect=detailed),
                ):
                    chosen = guandan_ai.call(guandan, "_bot_select_play", state, "bot", 2,
                                              deadline=100.0 + budget)
                self.assertEqual(modes, [bounded] * expected_count)
                self.assertEqual(state["_ai_eval_cache"]["heuristic_anytime"]["bounded_scoring"], bounded)
                if not bounded:
                    self.assertEqual(chosen, options[-1])

    def test_large_hand_keeps_straight_flushes_in_full_decomposition(self):
        labels = ["♦️4", "♥️8", "♦️K", "♣️5", "♠️8", "♠️J", "♥️3", "♠️A",
                  "♦️9", "♥️9", "♠️9", "♠️Q", "♣️3", "♠️6", "♠️K", "♠️3",
                  "🃏S", "♠️10", "♣️6", "♦️2", "♥️5", "♠️2", "♦️6"]
        hand = self.make_state(labels)["players"]["bot"]["hand"]
        fast = guandan_ai.call(guandan, "_fast_hand_decomposition_summary", hand, 2)
        detailed = guandan_ai.call(guandan, "_global_hand_decomposition_summary", hand, 2)
        self.assertEqual(len(hand), 23)
        self.assertEqual(fast["bomb_turns"], 0)
        self.assertGreaterEqual(detailed["bomb_turns"], 1)
        self.assertLess(detailed["turns"], fast["turns"])
        self.assertIn("straight_flush", detailed["plan_types"])

    def test_full_scoring_keeps_completed_result_when_another_candidate_will_not_fit(self):
        state = self.make_state(["♠️4", "♠️6", "♠️8", "♠️10"])
        state["current_trick"] = {"player_id": "opp", "cards": [],
                                  "combo": {"type": "single", "size": 1, "rank_value": 50}}
        options = [[c["id"]] for c in state["players"]["bot"]["hand"]]
        clock = [100.0]
        evaluated = []

        def detailed(_state, _pid, cards, _depth):
            evaluated.append(cards)
            clock[0] += 0.6
            return {"total": 10.0 if cards == options[1] else 0.0}

        with (
            mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]),
            mock.patch.object(guandan_ai, "_list_hint_options", return_value=options),
            mock.patch.object(guandan_ai, "_rank_response_options", return_value=options),
            mock.patch.object(guandan_ai, "_filter_overbomb_options", return_value=options),
            mock.patch.object(guandan_ai, "_quick_candidate_score",
                              side_effect=lambda _s, _p, c: -100 if c is None else -options.index(c)),
            mock.patch.object(guandan_ai, "_bot_score_components", side_effect=detailed),
        ):
            chosen = guandan_ai.call(guandan, "_bot_select_play", state, "bot", 2, deadline=102.5)
        self.assertEqual(evaluated, [options[0], None, options[1]])
        self.assertEqual(chosen, options[1])
        status = state["_ai_eval_cache"]["heuristic_anytime"]
        self.assertEqual(status["stop_reason"], "candidate_time_guard")
        self.assertFalse(status["hard_deadline_reached"])

    def test_candidate_cache_reuses_exact_work_and_cannot_share_mutable_results(self):
        hand = self.make_state(["♠️4", "♣️4", "♠️5", "♠️6", "♠️7", "♠️8"])["players"]["bot"]["hand"]
        original = guandan_ai._compute_decomposition_candidates

        def probe():
            expected = guandan_ai._decomposition_candidates(hand, 2)
            duplicate = guandan_ai._decomposition_candidates(hand, 2)
            self.assertEqual(duplicate, expected)
            duplicate[0][0].clear()
            duplicate[0][1]["type"] = "corrupted"
            self.assertEqual(guandan_ai._decomposition_candidates(hand, 2), expected)
            changed = copy.deepcopy(hand)
            changed[0]["rank"] = 9
            guandan_ai._decomposition_candidates(changed, 2)
            guandan_ai._decomposition_candidates(hand, 5)

        with (
            mock.patch.object(guandan_ai, "_compute_decomposition_candidates", wraps=original) as compute,
            mock.patch.object(guandan_ai, "_cache_probe", probe, create=True),
        ):
            guandan_ai.call(guandan, "_cache_probe")
            self.assertEqual(compute.call_count, 3)
            guandan_ai.call(guandan, "_cache_probe")
            self.assertEqual(compute.call_count, 6)
        self.assertFalse(hasattr(guandan_ai._CORE_LOCAL, "decomposition_candidates"))

    def test_bomb_followup_uses_residual_plan_without_restarting_lead_search(self):
        state = self.make_state(["♠️6", "♥️6", "♣️6", "♦️6", "♠️8", "♣️8", "♠️J"])
        hand = state["players"]["bot"]["hand"]
        bomb = [c["id"] for c in hand if c["rank"] == 6]
        remaining = [c for c in hand if c["id"] not in bomb]
        combo = guandan._evaluate_combo([c for c in hand if c["id"] in bomb], 2, {})
        original = guandan_ai._decomposition_candidates
        residuals = []

        def candidates(cards, level):
            residuals.append({c["id"] for c in cards})
            return original(cards, level)

        with (
            mock.patch.object(guandan_ai, "_choose_lead_play",
                              side_effect=AssertionError("Do not start another full lead search")),
            mock.patch.object(guandan_ai, "_decomposition_candidates", side_effect=candidates),
        ):
            result = guandan_ai.call(guandan, "_bomb_followup_upgrade_metrics",
                                     state, "bot", bomb, combo, remaining)
        self.assertIn({c["id"] for c in remaining}, residuals)
        self.assertGreaterEqual(result["score"], 0.0)
        self.assertEqual(result["turn_gain"], 0.0)

    def test_timeout_fallback_does_not_poison_complete_hand_or_candidate_caches(self):
        hand = self.make_state(["♠️6", "♥️6", "♣️6", "♦️6", "♠️8", "♣️8", "♠️J"])["players"]["bot"]["hand"]
        features = {"hand": hand, "remaining": hand[1:]}
        with (
            mock.patch.dict(guandan_ai._HAND_STRUCTURE_CACHE, {}, clear=True),
            mock.patch.dict(guandan_ai._HAND_STRENGTH_CACHE, {}, clear=True),
            mock.patch.dict(guandan_ai._HAND_TURNS_CACHE, {}, clear=True),
        ):
            with mock.patch.object(guandan_ai, "_deadline_expired", return_value=True):
                guandan_ai.call(guandan, "_candidate_hand_strength", features, 2)
                guandan_ai.call(guandan, "_candidate_remaining_strength", features, 2)
                guandan_ai.call(guandan, "_estimated_turns_to_finish", hand, 2)
            self.assertEqual(guandan_ai._HAND_STRUCTURE_CACHE, {})
            self.assertEqual(guandan_ai._HAND_STRENGTH_CACHE, {})
            self.assertEqual(guandan_ai._HAND_TURNS_CACHE, {})
            self.assertNotIn("hand_strength", features)
            self.assertNotIn("remaining_strength", features)
            guandan_ai.call(guandan, "_candidate_hand_strength", features, 2)
            guandan_ai.call(guandan, "_estimated_turns_to_finish", hand, 2)
            self.assertIn("hand_strength", features)
            self.assertTrue(guandan_ai._HAND_STRENGTH_CACHE)
            self.assertTrue(guandan_ai._HAND_TURNS_CACHE)

    def test_rollout_compares_takeover_even_when_teammate_leads(self):
        state = self.make_state(["♠️4", "♠️8", "♠️A"])
        state["current_trick"] = {"player_id": "mate", "cards": [],
                                  "combo": {"type": "single", "size": 1, "rank_value": 50}}
        option = [state["players"]["bot"]["hand"][-1]["id"]]
        for pass_score, expected in ((0.0, {"type": "play", "card_ids": option}),
                                     (20.0, {"type": "pass"})):
            with (
                self.subTest(pass_score=pass_score),
                mock.patch.object(guandan_ai, "_list_hint_options", return_value=[option]),
                mock.patch.object(guandan_ai, "_filter_overbomb_options", return_value=[option]),
                mock.patch.object(guandan_ai, "_quick_candidate_score",
                                  side_effect=lambda _s, _p, cards: pass_score if cards is None else 10.0),
            ):
                self.assertEqual(guandan._rollout_policy_action(state, "bot"), expected)

    def test_global_decomposition_rechecks_deadline_after_baseline_comparison(self):
        hand = self.make_state(["♠️4"])["players"]["bot"]["hand"]
        expired = [False]

        def late_baseline(cards, level):
            expired[0] = True
            return guandan_ai._fast_hand_decomposition_summary(cards, level)

        with (
            mock.patch.dict(guandan_ai._HAND_GLOBAL_DECOMP_CACHE, {}, clear=True),
            mock.patch.dict(guandan_ai._HAND_DECOMP_CACHE, {}, clear=True),
            mock.patch.object(guandan_ai, "_deadline_expired", side_effect=lambda: expired[0]),
        ):
            with mock.patch.object(guandan_ai, "_hand_decomposition_summary", side_effect=late_baseline):
                guandan_ai.call(guandan, "_global_hand_decomposition_summary", hand, 2)
            self.assertEqual(guandan_ai._HAND_GLOBAL_DECOMP_CACHE, {})
            expired[0] = False
            guandan_ai.call(guandan, "_global_hand_decomposition_summary", hand, 2)
            self.assertTrue(guandan_ai._HAND_GLOBAL_DECOMP_CACHE)


if __name__ == "__main__":
    unittest.main()
