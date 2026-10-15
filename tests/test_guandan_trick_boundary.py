"""Event, resource, information, and score ownership checks for trick plans."""

import copy
import random
import time
import unittest
from unittest import mock

from game import guandan, guandan_ai, guandan_trick as trick
from tests.test_guandan_trick_value import make_opening_61559c


def make_state(ranks):
    players = [{"player_id": pid, "name": pid, "seat": seat} for seat, pid in enumerate(ranks)]
    state = guandan.GuandanGame.init_game({"bot_mode": "heuristic"}, players)
    deck = guandan._full_deck()
    pool = list(deck)
    for pid, wanted in ranks.items():
        hand = []
        for rank in wanted:
            card = next(c for c in pool if c["rank"] == rank and c["suit"] != "hearts")
            pool.remove(card)
            hand.append(card)
        state["players"][pid].update(hand=hand, finished=False, finish_rank=None)
    state.update(phase="playing", current_turn="bot", current_trick=None, finish_order=[],
                 seen_cards=[c["id"] for c in pool], known_card_owners={}, visible_card_id=None,
                 pass_count=0, trick_plays={}, round_memories=[], game_start_time=0.0,
                 _ai_sampled_world=True, _ai_eval_cache={})
    guandan._start_round_memory(state)
    return state


def pair(state, pid, rank):
    return [c["id"] for c in state["players"][pid]["hand"] if c["rank"] == rank][:2]


def play(cards):
    return {"type": "play", "card_ids": cards}


class TrickBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.state = make_state({"bot": [4, 4, 13, 13, 9], "opp": [10, 10, 3],
                                 "mate": [6, 6, 8], "opp2": [7, 7, 11]})

    def trace(self, action, responses=None, state=None, limit=40):
        world = state or self.state
        if responses is None:
            policy = lambda state, actor, rng: {"type": "pass"}
        else:
            policy = mock.Mock(side_effect=responses)
        with mock.patch.object(trick, "response_action", side_effect=policy):
            return trick.trace_plan(world, "bot", action, random.Random(0), trick.TrickBudget(), limit, {})

    def test_unanswered_low_pair_keeps_recovery_in_remaining_hand(self):
        before = copy.deepcopy(self.state)
        low, high = pair(self.state, "bot", 4), pair(self.state, "bot", 13)
        plan = self.trace(play(low))
        self.assertEqual(plan.boundary, "trick_closed")
        self.assertEqual(plan.next_leader, "bot")
        self.assertEqual(plan.consumed["bot"], low)
        self.assertTrue(set(high) <= set(plan.remaining["bot"]))
        self.assertEqual(self.state, before)

    def test_low_pair_then_kings_consume_both_in_one_trick(self):
        low, high = pair(self.state, "bot", 4), pair(self.state, "bot", 13)
        responses = [play(pair(self.state, "opp", 10)), {"type": "pass"}, {"type": "pass"},
                     play(high), {"type": "pass"}, {"type": "pass"}, {"type": "pass"}]
        plan = self.trace(play(low), responses)
        first_high = self.trace(play(high))
        self.assertEqual(plan.boundary, "trick_closed")
        self.assertEqual(plan.next_leader, "bot")
        self.assertEqual(set(plan.consumed["bot"]), set(low + high))
        self.assertEqual(len(plan.remaining["bot"]), 1)
        self.assertEqual(len(first_high.remaining["bot"]), 3)
        self.assertGreater(plan.value, first_high.value)

    def test_higher_pair_can_take_back_after_kings_are_spent(self):
        state = make_state({"bot": [4, 4, 13, 13, 9], "opp": [10, 10, 3],
                            "mate": [6, 6, 8], "opp2": [14, 14, 11]})
        low, high = pair(state, "bot", 4), pair(state, "bot", 13)
        responses = [play(pair(state, "opp", 10)), {"type": "pass"}, {"type": "pass"},
                     play(high), {"type": "pass"}, {"type": "pass"}, play(pair(state, "opp2", 14)),
                     {"type": "pass"}, {"type": "pass"}, {"type": "pass"}]
        plan = self.trace(play(low), responses, state)
        self.assertEqual(plan.winner, "opp2")
        self.assertEqual(plan.next_leader, "opp2")
        self.assertEqual(set(plan.consumed["bot"]), set(low + high))

    def test_finishing_reply_keeps_first_place_even_if_kings_take_back_the_trick(self):
        state = make_state({"bot": [4, 4, 13, 13, 9], "opp": [10, 10],
                            "mate": [6, 6, 8], "opp2": [7, 7, 11]})
        responses = [play(pair(state, "opp", 10)), {"type": "pass"}, {"type": "pass"},
                     play(pair(state, "bot", 13)), {"type": "pass"}, {"type": "pass"}]
        plan = self.trace(play(pair(state, "bot", 4)), responses, state)
        self.assertEqual(plan.boundary, "trick_closed")
        self.assertEqual(plan.finish_order, ["opp"])
        self.assertTrue(plan.opponent_finished)
        self.assertEqual(plan.winner, "bot")
        self.assertEqual(plan.next_leader, "bot")
        self.assertFalse(set(pair(state, "bot", 13)) & set(plan.remaining["bot"]))
        self.assertLess(plan.value, -99.0)

    def test_teammate_takes_trick_and_receives_next_lead(self):
        state = make_state({"bot": [4, 4, 13, 13, 9], "opp": [10, 10, 3],
                            "mate": [12, 12, 8], "opp2": [7, 7, 11]})
        responses = [{"type": "pass"}, play(pair(state, "mate", 12)), {"type": "pass"},
                     {"type": "pass"}, {"type": "pass"}]
        plan = self.trace(play(pair(state, "bot", 4)), responses, state)
        self.assertEqual(plan.next_leader, "mate")
        self.assertEqual(plan.consumed["bot"], pair(state, "bot", 4))

    def test_first_finisher_needs_all_three_responses_before_partner_inherits(self):
        self.state["players"]["bot"]["hand"] = self.state["players"]["bot"]["hand"][:2]
        plan = self.trace(play(pair(self.state, "bot", 4)))
        self.assertEqual(plan.boundary, "trick_closed")
        self.assertEqual(plan.finish_order, ["bot"])
        self.assertEqual(plan.next_leader, "mate")
        self.assertEqual(plan.winner, "bot")
        self.assertEqual(len(plan.actions), 4)

    def test_closed_trick_values_certain_next_lead_finish(self):
        state = make_state({"bot": [4, 4, 3], "opp": [14],
                            "mate": [4, 6, 8, 10, 12], "opp2": [13]})
        before = copy.deepcopy(state)
        cards = pair(state, "bot", 4)
        plan = trick.trace_plan(state, "bot", play(cards), random.Random(0), trick.TrickBudget(), 40, {})
        self.assertEqual(plan.boundary, "trick_closed")
        self.assertEqual(plan.next_leader, "bot")
        self.assertEqual(plan.finish_order, [])
        self.assertEqual(plan.consumed["bot"], cards)
        self.assertEqual(len(plan.remaining["bot"]), 1)
        self.assertGreaterEqual(plan.value, 100.0)
        self.assertLessEqual(plan.value, 300.0)
        self.assertEqual(state, before)

    def test_immediate_finish_value_matches_rule_successor_for_every_actor(self):
        for actor in self.state["turn_order"]:
            for finish_hand in ([3], [3, 3], [3, 3, 3, 8, 8], [3, 3, 3, 3]):
                with self.subTest(actor=actor, hand=finish_hand):
                    ranks = {pid: [5, 7, 9, 11, 13] for pid in self.state["turn_order"]}
                    ranks[actor] = finish_hand
                    state = make_state(ranks)
                    state["current_turn"] = actor
                    before = copy.deepcopy(state)
                    successor = copy.deepcopy(state)
                    cards = [card["id"] for card in successor["players"][actor]["hand"]]
                    _, error = guandan.GuandanGame.apply_action(successor, actor, play(cards))
                    self.assertIsNone(error)
                    self.assertEqual(successor["finish_order"], [actor])
                    plans = {}
                    values = {}
                    for observer in state["turn_order"]:
                        value = trick.team_value(state, observer, trick.TrickBudget(), plans)
                        expected = trick.team_value(successor, observer, trick.TrickBudget(), plans)
                        self.assertAlmostEqual(value, expected)
                        if guandan._team_of(state, observer) == guandan._team_of(state, actor):
                            self.assertGreaterEqual(value, 100.0)
                            self.assertLessEqual(value, 300.0)
                        else:
                            self.assertGreaterEqual(value, -300.0)
                            self.assertLessEqual(value, -100.0)
                        values[observer] = value
                    self.assertAlmostEqual(values["bot"], values["mate"])
                    self.assertAlmostEqual(values["bot"], -values["opp"])
                    self.assertEqual(state, before)

    def test_immediate_finish_preserves_existing_places_and_terminal_rules(self):
        cases = ((["mate"], "bot"), (["opp"], "opp2"),
                 (["opp", "mate"], "bot"), (["mate", "opp"], "bot"))
        for prefix, actor in cases:
            for level in (2, 13):
                for require_partner in (False, True):
                    with self.subTest(prefix=prefix, actor=actor, level=level,
                                      require_partner=require_partner):
                        state = make_state({"bot": [4, 4], "opp": [6], "mate": [3], "opp2": [9]})
                        state["config"]["require_partner_not_last_for_a"] = require_partner
                        state["level_rank"] = level
                        for team in state["teams"].values():
                            team["level"] = level
                        state.update(finish_order=list(prefix), current_turn=actor)
                        for rank, player in enumerate(prefix, 1):
                            state["seen_cards"].extend(card["id"] for card in state["players"][player]["hand"])
                            state["players"][player].update(hand=[], finished=True, finish_rank=rank)
                        before = copy.deepcopy(state)
                        successor = copy.deepcopy(state)
                        cards = [card["id"] for card in successor["players"][actor]["hand"]]
                        _, error = guandan.GuandanGame.apply_action(successor, actor, play(cards))
                        self.assertIsNone(error)
                        self.assertIn(successor["phase"], ("round_end", "game_over"))
                        with mock.patch.object(trick, "resource_plan",
                                               side_effect=AssertionError("settled result was estimated")):
                            value = trick.team_value(state, "bot", trick.TrickBudget(), {})
                        self.assertEqual(value, guandan._evaluate_state_for_bot(successor, "bot"))
                        self.assertEqual(state, before)

    def test_immediate_finish_projection_requires_legal_reply(self):
        for rank, can_finish in ((3, False), (2, True)):
            with self.subTest(rank=rank):
                state = make_state({"bot": [rank], "opp": [14, 5],
                                    "mate": [4, 6, 8, 10, 12], "opp2": [13]})
                state["current_turn"] = "opp"
                ace = next(card["id"] for card in state["players"]["opp"]["hand"] if card["rank"] == 14)
                for actor, action in (("opp", play([ace])), ("mate", {"type": "pass"}),
                                      ("opp2", {"type": "pass"})):
                    _, error = guandan.GuandanGame.apply_action(state, actor, action)
                    self.assertIsNone(error)
                before = copy.deepcopy(state)
                apply_action = guandan.GuandanGame.apply_action
                with mock.patch.object(guandan.GuandanGame, "apply_action", wraps=apply_action) as apply:
                    value = trick.team_value(state, "bot", trick.TrickBudget(), {})
                if can_finish:
                    self.assertGreaterEqual(value, 100.0)
                    self.assertLessEqual(value, 300.0)
                    self.assertGreaterEqual(apply.call_count, 1)
                    successor = apply.call_args_list[0].args[0]
                    self.assertEqual(successor["finish_order"], ["bot"])
                    self.assertIsNotNone(successor["current_trick"])
                    self.assertEqual(successor["current_turn"], "opp")
                else:
                    self.assertEqual(apply.call_args_list[0].args[2], {"type": "pass"})
                    self.assertLess(value, 100.0)
                self.assertEqual(state, before)

    def test_non_acting_players_cannot_claim_immediate_finish(self):
        state = make_state({"bot": [3], "opp": [7, 9],
                            "mate": [4, 6, 8, 10, 12], "opp2": [13]})
        state["current_turn"] = "opp"
        before = copy.deepcopy(state)
        with mock.patch.object(guandan.GuandanGame, "apply_action",
                               side_effect=AssertionError("projected a non-acting player's finish")):
            trick.team_value(state, "bot", trick.TrickBudget(), {})
        self.assertEqual(state, before)

    def test_consecutive_legal_finishes_use_exact_terminal_result(self):
        state = make_state({"bot": [3], "opp": [5], "mate": [7], "opp2": [9]})
        before = copy.deepcopy(state)
        successor = copy.deepcopy(state)
        for actor in ("bot", "opp", "mate"):
            cards = [card["id"] for card in successor["players"][actor]["hand"]]
            _, error = guandan.GuandanGame.apply_action(successor, actor, play(cards))
            self.assertIsNone(error)
        self.assertEqual(successor["phase"], "round_end")
        with mock.patch.object(trick, "resource_plan", side_effect=AssertionError("settled race")):
            value = trick.team_value(state, "bot", trick.TrickBudget(), {})
        self.assertEqual(value, guandan._evaluate_state_for_bot(successor, "bot"))
        self.assertEqual(value, 200.0)
        self.assertEqual(state, before)

    def test_immediate_finish_projection_respects_deadline(self):
        state = make_state({"bot": [3], "opp": [14],
                            "mate": [4, 6, 8, 10, 12], "opp2": [13]})
        before = copy.deepcopy(state)
        clock = [0.0]
        apply_action = guandan.GuandanGame.apply_action

        def finish(*args, **kwargs):
            result = apply_action(*args, **kwargs)
            clock[0] = 1.0
            return result

        with mock.patch.object(trick.time, "perf_counter", side_effect=lambda: clock[0]), \
                mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=finish):
            with self.assertRaisesRegex(trick.IncompleteTrick, "deadline"):
                trick.team_value(state, "bot", trick.TrickBudget(1.0), {})
        self.assertEqual(state, before)

    def test_rejected_immediate_finish_does_not_publish_value(self):
        state = make_state({"bot": [3], "opp": [14],
                            "mate": [4, 6, 8, 10, 12], "opp2": [13]})
        before = copy.deepcopy(state)
        with mock.patch.object(guandan.GuandanGame, "apply_action", return_value=([], "rejected")):
            with self.assertRaisesRegex(trick.IncompleteTrick, "illegal_immediate_finish: rejected"):
                trick.team_value(state, "bot", trick.TrickBudget(), {})
        self.assertEqual(state, before)

    def test_action_limit_never_produces_a_boundary_value(self):
        with mock.patch.object(trick, "team_value", side_effect=AssertionError("cutoff was scored")):
            with self.assertRaisesRegex(trick.IncompleteTrick, "action_limit"):
                self.trace(play(pair(self.state, "bot", 4)), limit=1)

    def test_deadline_never_publishes_an_estimate(self):
        with self.assertRaisesRegex(trick.IncompleteTrick, "deadline"):
            trick.trace_plan(self.state, "bot", play(pair(self.state, "bot", 4)), random.Random(0),
                             trick.TrickBudget(time.perf_counter() - 1), 40, {})

    def test_whole_team_value_is_identical_for_partners_and_zero_sum(self):
        for prefix in ([], ["bot"], ["opp"], ["bot", "opp"], ["bot", "mate"]):
            state = copy.deepcopy(self.state)
            state["finish_order"] = prefix
            for pid in prefix:
                state["players"][pid].update(hand=[], finished=True)
            plans = {}
            values = {pid: trick.team_value(state, pid, trick.TrickBudget(), plans) for pid in state["turn_order"]}
            self.assertAlmostEqual(values["bot"], values["mate"])
            self.assertAlmostEqual(values["opp"], values["opp2"])
            self.assertAlmostEqual(values["bot"], -values["opp"])
        self.assertEqual(values["bot"], 300.0)

    def test_wildcard_committed_to_straight_cannot_also_make_bomb(self):
        deck = guandan._full_deck()
        wanted = [(3, "spades"), (4, "clubs"), (5, "diamonds"), (6, "spades"),
                  (9, "spades"), (9, "clubs"), (9, "diamonds"), (2, "hearts")]
        hand = [next(c for c in deck if (c["rank"], c["suit"]) == face) for face in wanted]
        wild = hand[-1]["id"]
        plan = trick.resource_plan(hand, 2, trick.TrickBudget())
        consumed = [cid for group in plan["groups"] for cid in group["cards"]]
        self.assertCountEqual(consumed, [c["id"] for c in hand])
        self.assertEqual(consumed.count(wild), 1)
        # The chosen feasible cover need not be optimal or choose either use,
        # but it cannot reserve this wildcard for both potential structures.
        self.assertLessEqual(sum(wild in group["cards"] for group in plan["groups"]), 1)
        for ids in ([c["id"] for c in hand[:4]] + [wild], [c["id"] for c in hand[4:]]):
            remaining = [c for c in hand if c["id"] not in ids]
            residual = trick.resource_plan(remaining, 2, trick.TrickBudget())
            self.assertFalse(set(ids) & {cid for g in residual["groups"] for cid in g["cards"]})

    def test_response_policy_uses_no_other_players_sampled_cards(self):
        state = copy.deepcopy(self.state)
        guandan.GuandanGame.apply_action(state, "bot", play(pair(state, "bot", 4)))
        modified = copy.deepcopy(state)
        modified["players"]["mate"]["hand"], modified["players"]["opp2"]["hand"] = (
            modified["players"]["opp2"]["hand"], modified["players"]["mate"]["hand"])
        for seed in range(10):
            self.assertEqual(trick.response_action(state, "opp", random.Random(seed)),
                             trick.response_action(modified, "opp", random.Random(seed)))

    def test_public_worlds_ignore_hidden_allocations_and_keep_physical_partition(self):
        first = make_opening_61559c(0)
        second = make_opening_61559c(17)
        worlds = trick.public_worlds(first, "bot", 4, trick.TrickBudget())
        other = trick.public_worlds(second, "bot", 4, trick.TrickBudget())
        self.assertEqual([trick.world_id(w) for w in worlds], [trick.world_id(w) for w in other])
        for world in worlds:
            cards = [c["id"] for data in world["players"].values() for c in data["hand"]]
            self.assertEqual(len(cards), len(set(cards)))
            self.assertEqual(sorted(cards), list(range(108)))
            self.assertEqual(world["players"]["bot"]["hand"], first["players"]["bot"]["hand"])

    def test_sampler_failure_cannot_fall_back_to_real_hidden_hands(self):
        def fail_sample(source, observer, rng, deadline=None):
            self.assertFalse(source.get("_ai_sampled_world"))
            for pid, pdata in source["players"].items():
                if pid != observer:
                    self.assertTrue(all(c is None for c in pdata["hand"]))
            return source
        with mock.patch.object(guandan_ai, "_determinize_state", side_effect=fail_sample):
            with self.assertRaisesRegex(trick.IncompleteTrick, "unsampled_world"):
                trick.public_worlds(self.state, "bot", 4, trick.TrickBudget())

    def test_excess_known_owners_are_rejected_instead_of_reassigned(self):
        state = copy.deepcopy(self.state)
        state["known_card_owners"] = {
            c["id"]: "opp" for pid in ("opp", "mate") for c in state["players"][pid]["hand"]
        }
        with self.assertRaisesRegex(trick.IncompleteTrick, "too_many_known_cards"):
            trick.public_worlds(state, "bot", 4, trick.TrickBudget())

    def panel_input(self):
        return [(pair(self.state, "bot", rank), score,
                 {"lead_reentry": score, "total": score}) for rank, score in ((4, 100), (13, 99))]

    def test_shadow_panel_is_paired_and_does_not_mutate_old_scores(self):
        self.state["config"].update(bot_trick_boundary_mode="shadow", bot_trick_boundary_time_ms=10000)
        scored = self.panel_input()
        before = copy.deepcopy(scored)
        panel = trick.compare_leads(self.state, "bot", scored)
        self.assertEqual(panel["status"], "complete")
        self.assertEqual(panel["policy"], "actor_local_heuristic_v1")
        self.assertEqual(panel["value_model"], "terminal_round_v1")
        self.assertEqual(panel["comparison"], "independent_confirmation_v1")
        self.assertFalse(panel["applied"])
        ids = [[p["world"] for p in row["plans"]] for row in panel["candidates"]]
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(scored, before)
        self.assertIn("ranking", panel)

    def test_partial_panel_can_never_mix_new_and_old_scores(self):
        self.state["config"].update(bot_trick_boundary_mode="replace", bot_trick_boundary_time_ms=10000)
        scored = self.panel_input()
        before = copy.deepcopy(scored)
        original = trick.trace_plan
        calls = []
        def interrupted(*args, **kwargs):
            calls.append(1)
            if len(calls) == 5:
                raise trick.IncompleteTrick("test_cutoff")
            return original(*args, **kwargs)
        with mock.patch.object(trick, "trace_plan", side_effect=interrupted):
            panel = trick.compare_leads(self.state, "bot", scored)
        self.assertEqual(panel["status"], "incomplete")
        self.assertFalse(panel["applied"])
        self.assertEqual(len(panel["candidates"]), 1)
        self.assertNotIn("ranking", panel)
        self.assertEqual(scored, before)

    def test_replace_integrates_one_value_without_legacy_terms_or_posthoc_upgrade(self):
        state = copy.deepcopy(self.state)
        state.pop("_ai_sampled_world")
        state["config"]["bot_trick_boundary_mode"] = "replace"
        low, high = pair(state, "bot", 4), pair(state, "bot", 13)
        panel = {"mode": "replace", "status": "complete", "applied": True,
                 "selected": play(high), "candidates": [
                     {"action": play(low), "value": -20.0},
                     {"action": play(high), "value": 10.0},
                 ]}
        with mock.patch.object(trick, "compare_leads", return_value=panel), mock.patch.object(
            guandan, "_prefer_bomb_closeout_upgrade", side_effect=AssertionError("legacy posthoc rewrite"),
        ):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action, play(high))
        explanation = state["bot_explain"]["bot"]
        self.assertEqual(explanation["score_model"], "trick_boundary")
        for row in explanation["top"]:
            self.assertEqual(set(row["components"]), {"trick_boundary_team_value"})
            self.assertAlmostEqual(row["score"], sum(row["components"].values()))

    def test_auto_cannot_mix_boundary_units_into_existing_search_guards(self):
        self.state["config"].update(bot_mode="auto", bot_trick_boundary_mode="replace",
                                    bot_trick_boundary_time_ms=10000)
        panel = trick.compare_leads(self.state, "bot", self.panel_input())
        self.assertEqual(panel["status"], "complete")
        self.assertFalse(panel["applied"])
        self.assertEqual(panel["selected"], panel["reference"])

    def test_shadow_runs_after_auto_search_and_cannot_replace_its_choice(self):
        state = copy.deepcopy(self.state)
        state.pop("_ai_sampled_world")
        state["config"].update(bot_mode="auto", bot_endgame_threshold=0,
                               bot_trick_boundary_mode="replace", bot_think_time_ms=100)
        low, high = pair(state, "bot", 4), pair(state, "bot", 13)
        events, now = [], [0.0]

        def search(*args, **kwargs):
            events.append("search")
            self.assertGreater(kwargs["deadline"], now[0])
            now[0] = 0.02
            return play(high), [(play(high), 12.0, 1, {"depth": 1})]

        def shadow(shadow_state, *args, **kwargs):
            events.append("shadow")
            self.assertEqual(events, ["search", "shadow"])
            self.assertEqual(shadow_state["config"]["bot_trick_boundary_mode"], "shadow")
            self.assertAlmostEqual(kwargs["deadline"], 0.1)
            # Even using every remaining millisecond cannot starve search or
            # rewrite its already-selected action with the shadow proposal.
            now[0] = kwargs["deadline"]
            return {"mode": "shadow", "status": "complete", "applied": False,
                    "proposed": play(low), "candidates": []}

        with mock.patch.object(guandan.time, "perf_counter", side_effect=lambda: now[0]), \
                mock.patch.object(guandan, "_should_use_mcts", return_value=True), \
                mock.patch.object(guandan, "_mcts_pick_action", side_effect=search), \
                mock.patch.object(guandan, "_should_accept_mcts_override", return_value=True), \
                mock.patch.object(guandan, "_prefer_bomb_closeout_upgrade", side_effect=lambda s, p, c: c), \
                mock.patch.object(trick, "compare_leads", side_effect=shadow):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(events, ["search", "shadow"])
        self.assertEqual(action, play(high))
        explanation = state["bot_explain"]["bot"]
        panel = explanation["method_details"]["trick_boundary"]
        self.assertEqual(explanation["method"], "mcts")
        self.assertNotEqual(explanation["score_model"], "trick_boundary")
        self.assertEqual(panel["actual_action"], action)
        self.assertEqual(panel["requested_mode"], "replace")

    def test_tied_legacy_reference_stays_actual_choice_with_same_paired_values(self):
        self.state["config"].update(bot_trick_boundary_mode="shadow", bot_trick_boundary_time_ms=10000)
        scored = self.panel_input()
        scored[1] = (scored[1][0], scored[0][1], scored[1][2])
        first = trick.compare_leads(self.state, "bot", scored)
        second = trick.compare_leads(self.state, "bot", list(reversed(scored)))
        self.assertEqual(first["reference"], play(scored[0][0]))
        self.assertEqual(second["reference"], play(scored[1][0]))
        def values(panel):
            return {tuple(row["action"]["card_ids"]): row["world_values"] for row in panel["candidates"]}
        self.assertEqual(values(first), values(second))


if __name__ == "__main__":
    unittest.main()
