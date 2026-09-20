import copy
import itertools
import unittest
from unittest import mock

from game import gizmos
from scripts import benchmark_gizmos as bench


def make_state(players=2):
    return gizmos.GizmosGame.init_game({"seed": 1}, [
        {"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": True}
        for i in range(players)
    ])


def set_display(state, cards):
    state["display"] = {"1": [], "2": [], "3": []}
    for card in cards:
        state["display"][str(gizmos._card_level(card))].append(card)


class GizmosAITests(unittest.TestCase):
    def test_conversion_payment_guides_bonus_pick(self):
        state = make_state()
        player = state["players"]["p0"]
        player["storage"] = ["red", "red"]
        player["active"] += ["l2_convert_red_up_to_two", "l1_convert_black_to_any"]
        card = "l2_pick_yellow_blue_4"
        set_display(state, [card])
        state["energy_row"] = ["blue", "black"]
        state["phase"] = "bonus_action"
        state["bonus_context"] = {"kind": "pick", "remaining": 1, "allowed_colors": ["blue", "black"]}
        self.assertEqual(gizmos._bot_energy_gap(player, card, "display", state), 1)
        action = gizmos.GizmosGame.bot_move(state, "p0")
        self.assertEqual(action, {"type": "pick_energy", "color": "black"})
        projected = dict(player, storage=player["storage"] + [action["color"]])
        self.assertIsNotNone(gizmos._best_build_plan(state, projected, card, "display"))

    def test_used_converter_and_capacity_cannot_fund_a_build(self):
        state = make_state()
        player = state["players"]["p0"]
        player.update(storage=["black"], storage_limit=1)
        player["active"].append("l1_convert_black_to_any")
        self.assertEqual(gizmos._bot_energy_gap(player, "l1_pick_red_draw_1", "display", state), 0)
        state["used_gizmos_this_turn"] = ["l1_convert_black_to_any"]
        self.assertGreater(gizmos._bot_energy_gap(player, "l1_pick_red_draw_1", "display", state), 0)

    def test_generic_goal_uses_undiscounted_rule_cost(self):
        state = make_state()
        player = state["players"]["p0"]
        player["storage"] = ["red"] * 5
        player["discounts"]["archive"] = 3
        self.assertEqual(gizmos._bot_energy_gap(player, "l3_generic_1", "archive", state), 2)
        self.assertIsNone(gizmos._best_build_plan(state, player, "l3_generic_1", "archive"))

    def test_final_turn_keeps_scoring_energy_instead_of_losing_points_on_build(self):
        state = make_state()
        player = state["players"]["p0"]
        player.update(storage=["black"] * 4, storage_limit=5, extra_awards=["extra_score_storage"], can_file=False, can_research=False)
        state["final_round"] = {"active": True, "triggered_by": "p1"}
        state["energy_row"] = ["blue"]
        set_display(state, ["l2_build_blue_black_vp"])
        self.assertIsNotNone(gizmos._best_build_plan(state, player, "l2_build_blue_black_vp", "display"))
        self.assertEqual(gizmos.GizmosGame.bot_move(state, "p0"), {"type": "pick_energy", "color": "blue"})

    def test_final_turn_values_token_multiplier_above_future_engine(self):
        state = make_state()
        player = state["players"]["p0"]
        player.update(storage=["black"] * 6, storage_limit=6, vp_tokens_total=7, can_research=False)
        state["final_round"] = {"active": True, "triggered_by": "p1"}
        set_display(state, ["l3_archive_vp2_black", "l3_upgrade_extra_tokens"])
        self.assertEqual(gizmos.GizmosGame.bot_move(state, "p0"),
                         {"type": "build_display", "card_id": "l3_upgrade_extra_tokens"})

    def test_final_research_declines_a_build_that_loses_storage_points(self):
        state = make_state()
        player = state["players"]["p0"]
        player.update(storage=["black"] * 4, extra_awards=["extra_score_storage"], can_file=False)
        card = "l2_build_blue_black_vp"
        state.update(phase="research", research_context={"player_id": "p0", "level": 2, "drawn": [card]})
        state["final_round"]["active"] = True
        self.assertEqual(gizmos.GizmosGame.bot_move(state, "p0"),
                         {"type": "resolve_research", "choice": "none", "return_order": [card]})

    def test_final_pick_includes_the_matching_energy_chain(self):
        state = make_state()
        player = state["players"]["p0"]
        player.update(storage=[], extra_awards=["extra_score_storage"], can_file=False, can_research=False)
        player["active"].append("l1_pick_blue_draw_1")
        state["energy_row"] = ["red", "blue"]
        state["final_round"]["active"] = True
        set_display(state, [])
        self.assertEqual(gizmos.GizmosGame.bot_move(state, "p0"), {"type": "pick_energy", "color": "blue"})

    def test_engine_value_declines_with_public_end_game_clock(self):
        state = make_state()
        player = state["players"]["p0"]
        card = "l1_pick_red_draw_1"
        early = gizmos._bot_card_value(player, card, state)
        state["players"]["p1"]["active"] *= 15
        late = gizmos._bot_card_value(player, card, state)
        state["final_round"]["active"] = True
        final = gizmos._bot_card_value(player, card, state)
        self.assertGreater(early, late)
        self.assertGreater(late, final)
        self.assertEqual(final, gizmos._card_def(card)["vp"] * 5)

    def test_file_bonus_still_has_a_legal_action_for_unreachable_cards(self):
        state = make_state()
        state["phase"] = "bonus_action"
        state["bonus_context"] = {"kind": "file"}
        set_display(state, ["l3_generic_1"])
        action = gizmos.GizmosGame.bot_move(state, "p0")
        self.assertEqual(action, {"type": "file_display", "card_id": "l3_generic_1"})
        _, error = gizmos.GizmosGame.apply_action(state, "p0", action)
        self.assertIsNone(error)

    def test_research_expectation_matches_exhaustive_draws(self):
        state = make_state()
        pool = [card["id"] for card in gizmos.LEVEL_1_CARDS[:3]]
        set_display(state, [card["id"] for card in gizmos.LEVEL_1_CARDS if card["id"] not in pool])
        state["players"]["p0"]["research_amount"] = 2
        values = dict(zip(pool, [0.0, 10.0, 20.0]))
        with mock.patch.object(gizmos, "_bot_build_score", side_effect=lambda _s, _p, card, _src: values[card]):
            estimated = gizmos._bot_research_value(state, "p0", 1)
        expected = sum(max(values[card] for card in draw) for draw in itertools.combinations(pool, 2)) / 3
        self.assertAlmostEqual(estimated, expected)

    def test_decision_does_not_see_hidden_order_or_mutate_state(self):
        for seed in (1, 2, 3):
            state = make_state()
            state["players"]["p0"]["storage"] = ["red", "blue", "black"]
            state["rng_seed"] = seed
            original = copy.deepcopy(state)
            action = gizmos.GizmosGame.bot_move(state, "p0")
            hidden = bench.public_state(state, "p0")
            self.assertEqual(action, gizmos.GizmosGame.bot_move(hidden, "p0"))
            self.assertEqual(state, original)

    def test_full_games_finish_with_legal_actions_for_all_player_counts(self):
        for count in (2, 3, 4):
            state = make_state(count)
            for _ in range(700):
                if state["game_over"]:
                    break
                actor = state["current_turn"]
                action = gizmos.GizmosGame.bot_move(state, actor)
                self.assertIsNotNone(action)
                _, error = gizmos.GizmosGame.apply_action(state, actor, action)
                self.assertIsNone(error, (count, action, error))
            self.assertTrue(state["game_over"], count)


class GizmosChainResolutionTests(unittest.TestCase):
    def test_two_bonus_picks_enqueue_each_gizmo_once_per_turn(self):
        state = make_state()
        state["players"]["p0"]["active"].append("l1_pick_red_draw_1")
        state["phase"] = "bonus_action"
        state["base_action_taken"] = True
        state["bonus_context"] = {"kind": "pick", "remaining": 2, "allowed_colors": ["red"]}
        state["energy_row"] = ["red", "red"]
        for _ in range(2):
            _, error = gizmos.GizmosGame.apply_action(state, "p0", {"type": "pick_energy", "color": "red"})
            self.assertIsNone(error)
        self.assertEqual([item["source_card_id"] for item in state["pending_effects"]], ["l1_pick_red_draw_1"])

    def test_bonus_pick_stops_when_storage_fills_or_allowed_row_empties(self):
        for fills_storage in (True, False):
            state = make_state()
            player = state["players"]["p0"]
            player["storage"] = ["black"] * (4 if fills_storage else 0)
            state.update(phase="bonus_action", base_action_taken=True,
                         bonus_context={"kind": "pick", "remaining": 2, "allowed_colors": ["red"]})
            state["energy_bag"] = []
            state["energy_row"] = ["red", "blue"]
            _, error = gizmos.GizmosGame.apply_action(state, "p0", {"type": "pick_energy", "color": "red"})
            self.assertIsNone(error)
            self.assertIsNone(state["bonus_context"])
            self.assertEqual(state["current_turn"], "p1")


class GizmosBenchmarkTests(unittest.TestCase):
    def test_same_policy_seat_rotation_is_exactly_symmetric(self):
        sources, _identity = bench.capture_sources()
        policy = bench.load_policy(sources, "test")
        for count in (2, 3, 4):
            records = [dict(bench.play_game(policy, policy, policy, 23, count, seat), block=0)
                       for seat in range(count)]
            summary = bench.summarize(records, count)
            self.assertEqual(summary["win_rate"]["mean"], 1 / count)
            self.assertEqual(summary["identical_trajectory_blocks"], 1)
            if count == 2:
                self.assertEqual(summary["score_margin_vs_best_opponent"]["mean"], 0)

    def test_summary_rejects_missing_rotations_or_different_deals(self):
        with self.assertRaises(ValueError):
            bench.summarize([{"block": 0, "candidate_seat": 0}], 2)
        rows = [{"block": 0, "candidate_seat": seat, "deal_seed": seat, "initial_sha256": str(seat)} for seat in range(2)]
        with self.assertRaises(ValueError):
            bench.summarize(rows, 2)


if __name__ == "__main__":
    unittest.main()
