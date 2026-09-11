import itertools
import random
import unittest
from contextlib import ExitStack
from unittest import mock

from game import guandan, guandan_ai


class GuandanMctsLayerTests(unittest.TestCase):
    """Deterministic search scheduling tests; no wall-clock timing assertions."""

    def _search(self, evaluate, *, sims=27, depth=2, tree_ply=1, clock=None):
        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        state["config"]["bot_mcts_early_stop_gap"] = 9999.0
        actions = [
            {"type": "play", "card_ids": [11]},
            {"type": "play", "card_ids": [22]},
            {"type": "pass"},
        ]
        worlds = []
        visits = []

        def determinize(_state, _bot, _rng, _deadline):
            world = {"world": len(worlds), "phase": "playing"}
            worlds.append(world)
            return world

        def apply_action(target, _bot, action):
            target["branch"] = action.get("card_ids", ["pass"])[0]
            return [], None

        def tree_value(target, _bot, ply, _width, rollout_depth):
            visit = (ply + rollout_depth, target["world"], target["branch"])
            visits.append(visit)
            return evaluate(*visit)

        with ExitStack() as stack:
            for name, value in (
                ("_candidate_actions", actions),
                ("_mcts_budget", (sims, depth, tree_ply, 2)),
                ("_mcts_obvious_response_scores", None),
                ("_mcts_high_single_bomb_scores", None),
            ):
                stack.enter_context(mock.patch.object(guandan, name, return_value=value))
            stack.enter_context(mock.patch.object(
                guandan_ai, "_mcts_high_single_joker_scores", return_value=None
            ))
            stack.enter_context(mock.patch.object(
                guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts
            ))
            stack.enter_context(mock.patch.object(
                guandan, "_mcts_root_heuristic_value",
                side_effect=lambda _s, _p, action, _d: 1.0 if action == actions[0] else 0.0,
            ))
            stack.enter_context(mock.patch.object(
                guandan, "_determinize_state", side_effect=determinize
            ))
            stack.enter_context(mock.patch.object(
                guandan.GuandanGame, "apply_action", side_effect=apply_action
            ))
            stack.enter_context(mock.patch.object(
                guandan, "_mcts_reply_tree_value", side_effect=tree_value
            ))
            if clock is not None:
                stack.enter_context(mock.patch.object(
                    guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]
                ))
            picked, scored = guandan._mcts_pick_action(
                state, "bot", sims, depth, 3, tree_ply, 2, 0.28,
                deadline=10.0 if clock is not None else None,
            )
        return picked, scored, state["_ai_eval_cache"]["mcts_anytime"], visits, worlds

    def test_all_candidates_share_worlds_and_advance_one_depth_at_a_time(self):
        _picked, scored, status, visits, worlds = self._search(
            lambda depth, world, _branch: depth * 100.0 + world
        )
        self.assertEqual(visits, list(itertools.product(range(3), range(3), (11, 22, "pass"))))
        self.assertEqual(len(worlds), 3)
        self.assertTrue(all("branch" not in world for world in worlds))
        self.assertEqual(status["completed_depth"], 2)
        self.assertEqual(status["target_depth"], 2)
        self.assertEqual(status["completed_rounds"], 3)
        self.assertEqual(status["attempted"], 27)
        for _action, _score, count, stats in scored:
            self.assertEqual(count, 3)
            self.assertEqual(stats["depth"], 2)
            self.assertEqual(stats["tree_ply"], 1)
            self.assertEqual(stats["avg"], 201.0)  # No depth-zero/one samples mixed in.

    def test_timeout_keeps_completed_layer_not_heuristic_or_partial_layer(self):
        for signal in ("deadline", "exception"):
            with self.subTest(signal=signal):
                clock = [0.0]

                def evaluate(depth, world, branch):
                    if depth == 2 and world == 2 and branch == "pass":
                        if signal == "exception":
                            raise guandan_ai._MctsSearchInterrupted
                        clock[0] = 11.0
                    if depth == 1:
                        return 40.0 if branch == 22 else 0.0
                    return 1000.0 if branch == 11 else 0.0

                picked, scored, status, _visits, _worlds = self._search(
                    evaluate, clock=clock
                )
                self.assertEqual(picked, {"type": "play", "card_ids": [22]})
                self.assertEqual(status["completed_depth"], 1)
                self.assertEqual(status["interrupted_depth"], 2)
                self.assertEqual(status["completed_rounds"], 3)
                self.assertTrue(status["deadline_limited"])
                self.assertFalse(status["fallback_to_reference"])
                self.assertTrue(all(item[3]["depth"] == 1 for item in scored))
                self.assertEqual(scored[0][3]["avg"], 40.0)

    def test_visit_budget_cannot_publish_only_part_of_deeper_world_panel(self):
        def evaluate(depth, _world, branch):
            if depth == 0:
                return 40.0 if branch == 22 else 0.0
            return 1000.0 if branch == 11 else 0.0

        picked, scored, status, visits, _worlds = self._search(evaluate, sims=15)
        self.assertEqual(len(visits), 15)
        self.assertEqual(picked, {"type": "play", "card_ids": [22]})
        self.assertEqual(status["completed_depth"], 0)
        self.assertEqual(status["interrupted_depth"], 1)
        self.assertEqual(status["stop_reason"], "visit_budget")
        self.assertFalse(status["fallback_to_reference"])
        self.assertTrue(all(item[2] == 3 and item[3]["depth"] == 0 for item in scored))

    def test_complete_deeper_layer_can_reverse_shallow_choice_to_pass(self):
        def evaluate(depth, _world, branch):
            if depth == 0:
                return 1000.0 if branch == 11 else 0.0
            return 40.0 if branch == "pass" else -40.0

        picked, scored, status, visits, _worlds = self._search(
            evaluate, sims=18, depth=1
        )
        self.assertEqual(picked, {"type": "pass"})
        self.assertEqual(status["completed_depth"], 1)
        self.assertEqual(visits.count((1, 2, "pass")), 1)
        self.assertEqual(scored[0][3]["avg"], 40.0)

    def test_insufficient_worlds_keep_reference_even_when_panel_finishes(self):
        picked, scored, status, _visits, _worlds = self._search(
            lambda _d, _w, branch: 1000.0 if branch == 22 else 0.0,
            sims=6,
        )
        self.assertEqual(picked, {"type": "play", "card_ids": [11]})
        self.assertTrue(status["fallback_to_reference"])
        self.assertEqual(status["completed_depth"], 0)
        self.assertTrue(all(item[2] == 2 for item in scored))

    def test_timeout_in_first_comparison_keeps_zero_sample_reference(self):
        clock = [0.0]

        def evaluate(_depth, _world, branch):
            if branch == "pass":
                clock[0] = 11.0
            return 1000.0 if branch == 22 else 0.0

        picked, scored, status, _visits, _worlds = self._search(evaluate, clock=clock)
        self.assertEqual(picked, {"type": "play", "card_ids": [11]})
        self.assertTrue(all(item[2] == 0 for item in scored))
        self.assertIsNone(status["completed_depth"])
        self.assertEqual(status["completed_rounds"], 0)
        self.assertTrue(status["fallback_to_reference"])

    def test_zero_depth_configuration_does_not_start_deeper_search(self):
        _picked, scored, status, visits, _worlds = self._search(
            lambda _d, _w, _b: 0.0, depth=0, sims=12
        )
        self.assertTrue(all(depth == 0 for depth, _world, _branch in visits))
        self.assertTrue(all(item[2] == 4 for item in scored))
        self.assertEqual(status["completed_depth"], 0)
        self.assertEqual(status["target_depth"], 0)


class GuandanMctsSubtreeTests(unittest.TestCase):
    def test_pruned_subtree_matches_exhaustive_minimax(self):
        rng = random.Random(19)
        for case in range(8):
            with self.subTest(case=case), ExitStack() as stack:
                # A binary depth-four tree, with deliberately unrelated shallow
                # ordering scores. Only depth-four values define the answer.
                scores = {node: rng.uniform(-100.0, 100.0) for node in range(1, 32)}

                def exhaustive(node, depth):
                    if depth == 4:
                        return scores[node]
                    children = [exhaustive(node * 2 + offset, depth + 1) for offset in (0, 1)]
                    return max(children) if depth % 2 == 0 else min(children)

                stack.enter_context(mock.patch.object(
                    guandan_ai, "_next_actor",
                    side_effect=lambda s: "bot" if s["depth"] % 2 == 0 else "opp",
                ))
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_team_of", side_effect=lambda _s, pid: pid
                ))
                stack.enter_context(mock.patch.object(
                    guandan, "_candidate_actions",
                    return_value=[{"offset": 0}, {"offset": 1}],
                ))
                stack.enter_context(mock.patch.object(
                    guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts
                ))

                def apply_action(target, _actor, action):
                    target["node"] = target["node"] * 2 + action["offset"]
                    target["depth"] += 1
                    return [], None

                stack.enter_context(mock.patch.object(
                    guandan.GuandanGame, "apply_action", side_effect=apply_action
                ))
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_evaluate_state_for_bot", side_effect=lambda s, _b: scores[s["node"]]
                ))
                state = {"node": 1, "depth": 0, "phase": "playing"}
                value = guandan._mcts_reply_tree_value(state, "bot", 4, 2, 0)
                self.assertEqual(value, exhaustive(1, 0))
                self.assertEqual(state, {"node": 1, "depth": 0, "phase": "playing"})

    def test_completed_descendants_replace_static_ordering_values(self):
        for maximize, shallow, leaf in ((True, 10.0, -50.0), (False, -10.0, 50.0)):
            with self.subTest(maximize=maximize), ExitStack() as stack:
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_next_actor", return_value="actor"
                ))
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_team_of",
                    side_effect=lambda _s, pid: "A" if pid == "bot" or maximize else "B",
                ))
                stack.enter_context(mock.patch.object(
                    guandan, "_candidate_actions", return_value=[{"type": "pass"}]
                ))
                stack.enter_context(mock.patch.object(
                    guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts
                ))

                def apply_action(target, _actor, _action):
                    target["step"] += 1
                    return [], None

                stack.enter_context(mock.patch.object(
                    guandan.GuandanGame, "apply_action", side_effect=apply_action
                ))
                stack.enter_context(mock.patch.object(
                    guandan_ai, "_evaluate_state_for_bot",
                    side_effect=lambda s, _b: shallow if s["step"] == 1 else leaf,
                ))
                value = guandan._mcts_reply_tree_value(
                    {"phase": "playing", "step": 0}, "bot", 2, 1, 0
                )
                self.assertEqual(value, leaf)

    def test_deadline_during_candidate_generation_is_interruption_not_sentinel(self):
        clock = [0.0]

        def candidates(_state, _actor, _width):
            clock[0] = 11.0
            return [{"type": "pass"}]

        with mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]), \
             mock.patch.object(guandan_ai, "_next_actor", return_value="bot"), \
             mock.patch.object(guandan, "_candidate_actions", side_effect=candidates), \
             mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts):
            with self.assertRaises(guandan_ai._MctsSearchInterrupted):
                # Bind the production thread-local deadline without changing the
                # legacy float-returning subtree API used by the root scheduler.
                with mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", 10.0, create=True):
                    guandan._mcts_reply_tree_value({"phase": "playing"}, "bot", 1, 1, 0)

    def test_leaf_evaluation_crossing_deadline_is_not_complete(self):
        clock = [0.0]

        def evaluate(_state, _bot):
            clock[0] = 11.0
            return 999.0

        with mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]), \
             mock.patch.object(guandan_ai, "_evaluate_state_for_bot", side_effect=evaluate), \
             mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", 10.0, create=True):
            with self.assertRaises(guandan_ai._MctsSearchInterrupted):
                guandan._mcts_reply_tree_value({"phase": "round_end"}, "bot", 1, 1, 0)

    def test_round_end_is_a_leaf_for_subtree_and_rollout(self):
        with mock.patch.object(guandan_ai, "_next_actor") as next_actor, \
             mock.patch.object(guandan_ai, "_evaluate_state_for_bot", return_value=42.0):
            state = {"phase": "round_end", "round_number": 1}
            self.assertEqual(guandan._mcts_reply_tree_value(state, "bot", 3, 2, 4), 42.0)
            self.assertEqual(guandan._rollout_value(state, "bot", 4), 42.0)
            self.assertEqual(state["round_number"], 1)
            next_actor.assert_not_called()

    def test_rollout_policy_interruption_does_not_turn_into_leaf_score(self):
        clock = [0.0]

        def policy(_state, _actor):
            clock[0] = 11.0
            return None

        with mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]), \
             mock.patch.object(guandan_ai, "_next_actor", return_value="bot"), \
             mock.patch.object(guandan_ai, "_rollout_policy_action", side_effect=policy), \
             mock.patch.object(guandan_ai, "_evaluate_state_for_bot") as evaluate, \
             mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", 10.0, create=True):
            with self.assertRaises(guandan_ai._MctsSearchInterrupted):
                guandan._rollout_value({"phase": "playing"}, "bot", 1)
            evaluate.assert_not_called()
