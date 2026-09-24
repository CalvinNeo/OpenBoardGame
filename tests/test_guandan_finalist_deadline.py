import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanFinalistDeadlineTests(unittest.TestCase):
    def _run_late_structured_sample(self, completed_prefix: int) -> None:
        players = [
            {"player_id": player_id, "name": player_id, "seat": seat, "is_bot": True}
            for seat, player_id in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        state["phase"] = "playing"
        state["level_rank"] = 2
        state["current_turn"] = "bot"
        state["current_trick"] = None
        state["players"]["bot"]["hand"] = deck[:3]
        unknown_cards = [deck[index] for index in (4, 58, 5, 59, 6, 60)]
        state["players"]["opp"]["hand"] = unknown_cards
        options = [[card["id"]] for card in deck[:3]]
        combo = guandan._evaluate_combo([deck[1]], 2, {})
        clock = [0.0]
        evaluated = []
        original_shape = guandan_ai._short_hand_has_structured_shape

        def slow_shape(hand, level_rank):
            clock[0] = 2.0
            return original_shape(hand, level_rank)

        def finalist(_state, _player_id, cards, _depth, *, bounded):
            evaluated.append(cards)
            if len(evaluated) <= completed_prefix:
                return {"total": 10.0}
            breakdown = guandan_ai._short_hand_structured_reply_breakdown(
                state, "opp", combo, unknown_cards, accepted_target=16, max_attempts=64
            )
            self.assertIsNone(breakdown)
            self.assertFalse(state["_ai_eval_cache"]["short_hand_reply_breakdowns"])
            # Analytic fallbacks can return a nominally complete vector even
            # though sampling crossed the deadline at the end of this score.
            return {"total": 999.0}

        def quick_score(_state, _player_id, cards):
            return 10.0 - options.index(cards)

        with (
            mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]),
            mock.patch.object(guandan, "_list_hint_options", return_value=options),
            # This deadline test supplies its incumbent through quick_score.
            # Route scheduling/fallback is exercised with real hands separately.
            mock.patch.object(guandan_ai, "_prepare_hand_route_scores"),
            mock.patch.object(guandan_ai, "_rank_lead_options", side_effect=lambda _s, _p, cards, **_kw: cards),
            mock.patch.object(guandan_ai, "_filter_overbomb_options", side_effect=lambda _s, _p, cards: cards),
            mock.patch.object(guandan_ai, "_quick_candidate_score", side_effect=quick_score),
            mock.patch.object(guandan_ai, "_bot_finalist_score_components", side_effect=finalist),
            mock.patch.object(guandan_ai, "_short_hand_has_structured_shape", side_effect=slow_shape),
            mock.patch.object(guandan_ai, "_short_hand_singleton_pressure_weight", return_value=1.0),
            mock.patch.object(guandan_ai, "_hand_has_same_type_beat", return_value=False),
            mock.patch.object(guandan_ai, "_hand_has_bomb_beat", return_value=False),
        ):
            chosen = guandan_ai.call(
                guandan, "_bot_select_play", state, "bot", 2, deadline=1.0
            )

        self.assertEqual(chosen, options[0])
        self.assertEqual(len(evaluated), completed_prefix + 1)
        status = state["_ai_eval_cache"]["heuristic_anytime"]
        self.assertEqual(status["evaluated"], completed_prefix)
        self.assertEqual(status["stop_reason"], "hard_deadline")
        self.assertTrue(status["deadline_limited"])
        scored = guandan_ai.call(
            guandan, "_get_cached_heuristic_scored_candidates", state, "bot", 2
        )
        self.assertEqual(len(scored), 1)
        self.assertEqual(scored[0][0], options[0])
        self.assertLess(scored[0][1], 999.0)
        if completed_prefix == 0:
            self.assertIn("anytime_quick_score", scored[0][2])

    def test_late_structured_sample_preserves_completed_finalist(self):
        self._run_late_structured_sample(completed_prefix=1)

    def test_late_first_structured_sample_uses_quick_incumbent(self):
        self._run_late_structured_sample(completed_prefix=0)


if __name__ == "__main__":
    unittest.main()
