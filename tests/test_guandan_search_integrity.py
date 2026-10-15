import contextlib
import copy
import random
import time
import unittest
from unittest import mock

from game import guandan, guandan_ai, guandan_endgame
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture
from tests.test_guandan_endgame import legal_actions, reference_value
from tests.test_guandan_trick_boundary import make_state, pair, play


class GuandanSearchIntegrityTests(unittest.TestCase):
    def _state(self, ranks_by_player):
        players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat}
                   for seat in range(4)]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        for pid, ranks in zip(state["turn_order"], ranks_by_player):
            hand = []
            for rank in ranks:
                index = next(index for index, card in enumerate(deck)
                             if card.get("rank") == rank and card.get("suit") == "clubs")
                hand.append(deck.pop(index))
            state["players"][pid].update(hand=hand, finished=False, finish_rank=None)
        state.update(
            phase="playing", level_rank=2, current_turn="p0", current_trick=None,
            trick_plays={}, pass_count=0, finish_order=[], round_memories=[],
            seen_cards=[card["id"] for card in deck], known_card_owners={},
            visible_card_id=None, _ai_eval_cache={},
        )
        state["config"]["bot_determinize_samples"] = 1
        return state

    def test_determinization_recomputes_hidden_hand_dependent_lead_scores(self):
        state = self._state([[8, 9, 10], [3], [5], [14]])
        cards = [state["players"]["p0"]["hand"][0]["id"]]
        original = guandan_ai.call(guandan, "_lead_option_score", state, "p0", cards)
        guandan._list_hint_options(state, "p0")
        # Seed 0 changes the next opponent's last card while preserving the
        # acting hand, public card pool and every player's remaining count.
        particle = guandan._determinize_state(state, "p0", random.Random(0))
        fresh = copy.deepcopy(particle)
        fresh["_ai_eval_cache"] = {}
        expected = guandan_ai.call(guandan, "_lead_option_score", fresh, "p0", cards)
        self.assertNotEqual(original, expected)
        self.assertIn("candidate_features", particle["_ai_eval_cache"])
        self.assertIn("legal_action_options", particle["_ai_eval_cache"])
        self.assertAlmostEqual(
            guandan_ai.call(guandan, "_lead_option_score", particle, "p0", cards), expected,
        )

    def test_cheap_lead_cache_does_not_survive_a_changed_acting_hand(self):
        state = self._state([[3, 6, 6, 10], [3], [9], [5]])
        cards = [state["players"]["p0"]["hand"][0]["id"]]
        original = guandan_ai.call(guandan, "_lead_cheap_option_score", state, "p0", cards)
        particle = guandan._clone_search_state(state, preserve_eval_cache=True)
        own = particle["players"]["p0"]["hand"]
        other = particle["players"]["p1"]["hand"]
        own[-1], other[0] = other[0], own[-1]
        fresh = copy.deepcopy(particle)
        fresh["_ai_eval_cache"] = {}
        expected = guandan_ai.call(guandan, "_lead_cheap_option_score", fresh, "p0", cards)
        self.assertNotEqual(original, expected)
        self.assertAlmostEqual(
            guandan_ai.call(guandan, "_lead_cheap_option_score", particle, "p0", cards), expected,
        )

    def _minimax_fixture(self):
        state = self._state([[3, 10, 6, 6], [9], [4], [5]])
        hand = state["players"]["p0"]["hand"]
        actions = [
            {"type": "play", "card_ids": [hand[0]["id"]]},
            {"type": "play", "card_ids": [hand[1]["id"]]},
            {"type": "play", "card_ids": [card["id"] for card in hand[2:]]},
        ]
        return state, actions

    def _search_patches(self, actions, evaluator):
        stack = contextlib.ExitStack()
        stack.enter_context(mock.patch.object(guandan, "_candidate_actions", return_value=actions))
        stack.enter_context(mock.patch.object(
            guandan, "_filter_overbomb_actions", side_effect=lambda _state, _pid, choices: choices,
        ))
        stack.enter_context(mock.patch.object(guandan_ai, "_public_endgame_closeout_action", return_value=None))
        stack.enter_context(mock.patch.object(guandan_ai, "_forced_endgame_control_relay_action", return_value=None))
        stack.enter_context(mock.patch.object(guandan_ai, "_minimax_root_lead_single_penalty", return_value=0.0))
        stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", return_value=0.0))
        stack.enter_context(mock.patch.object(guandan_ai, "_minimax_value", side_effect=evaluator))
        return stack

    def test_completed_search_winner_is_not_replaced_by_a_higher_single(self):
        state, actions = self._minimax_fixture()

        def evaluate(child, *_args, **_kwargs):
            return 300.0 if child["current_trick"]["cards"] == actions[0]["card_ids"] else -300.0

        with self._search_patches(actions, evaluate):
            chosen = guandan._minimax_pick_action(state, "p0", depth=1, width=3)
        self.assertEqual(chosen, actions[0])
        self.assertEqual(state["_ai_eval_cache"]["minimax_anytime"]["completed_depth"], 1)

    def test_interrupted_deeper_search_keeps_last_completed_winner(self):
        state, actions = self._minimax_fixture()
        clock = [0.0]

        def evaluate(child, _bot_id, depth, *_args, **_kwargs):
            if depth > 0:
                clock[0] = 2.0
            return 300.0 if child["current_trick"]["cards"] == actions[0]["card_ids"] else -300.0

        with self._search_patches(actions, evaluate), mock.patch.object(
            guandan_ai.time, "perf_counter", side_effect=lambda: clock[0],
        ):
            chosen = guandan._minimax_pick_action(state, "p0", depth=2, width=3, deadline=1.0)
        self.assertEqual(chosen, actions[0])
        status = state["_ai_eval_cache"]["minimax_anytime"]
        self.assertEqual(status["completed_depth"], 1)
        self.assertEqual(status["interrupted_depth"], 2)

    def test_no_completed_search_keeps_defensive_legal_fallback(self):
        state, actions = self._minimax_fixture()
        clock = [0.0]

        def evaluate(*_args, **_kwargs):
            clock[0] = 2.0
            return 300.0

        with self._search_patches(actions, evaluate), mock.patch.object(
            guandan_ai.time, "perf_counter", side_effect=lambda: clock[0],
        ):
            chosen = guandan._minimax_pick_action(state, "p0", depth=2, width=3, deadline=1.0)
        self.assertEqual(chosen, actions[1])
        status = state["_ai_eval_cache"]["minimax_anytime"]
        self.assertIsNone(status["completed_depth"])
        self.assertTrue(status["deadline_limited"])
        _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), "p0", chosen)
        self.assertIsNone(error)


class GuandanMinimaxTerminalTests(unittest.TestCase):
    def worlds(self):
        state = make_state({"bot": [4, 4, 3], "opp": [5, 6], "mate": [7], "opp2": [8]})
        state["config"]["bot_minimax_exact_time_ms"] = 10000
        other = copy.deepcopy(state)
        other["players"]["opp"]["hand"][0], other["players"]["mate"]["hand"][0] = (
            other["players"]["mate"]["hand"][0], other["players"]["opp"]["hand"][0])
        return [state, other]

    def evaluate(self, worlds, actions):
        return guandan_ai.call(guandan, "_minimax_terminal_root_values", worlds, "bot", actions,
                               time.perf_counter() + 30)

    def test_complete_worlds_match_rule_engine_terminal_values(self):
        worlds = self.worlds()
        actions = legal_actions(worlds[0])
        before = copy.deepcopy(worlds)
        values, result = self.evaluate(worlds, actions)
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["completed_worlds"], 2)
        for action, column in zip(actions, values):
            for world, value in zip(worlds, column):
                child = copy.deepcopy(world)
                _, error = guandan.GuandanGame.apply_action(child, "bot", action)
                self.assertIsNone(error)
                self.assertEqual(value, reference_value(child, "bot", {}))
        self.assertEqual(worlds, before)

    def test_interrupt_after_one_world_does_not_publish_partial_values(self):
        worlds = self.worlds()
        actions = legal_actions(worlds[0])
        solver = mock.Mock(nodes=7)
        solver.root_values.side_effect = [[100.0] * len(actions), guandan_endgame.IncompleteEndgame("deadline")]
        with mock.patch.object(guandan_endgame, "EndgameSolver", return_value=solver):
            values, result = self.evaluate(worlds, actions)
        self.assertIsNone(values)
        self.assertEqual(result["status"], "incomplete")
        self.assertEqual(result["completed_worlds"], 1)
        self.assertEqual(result["nodes"], 14)

    def test_unsampled_server_hands_cannot_enter_terminal_search(self):
        worlds = self.worlds()
        worlds[1].pop("_ai_sampled_world")
        with mock.patch.object(guandan_endgame, "EndgameSolver", side_effect=AssertionError("hidden hands")):
            values, result = self.evaluate(worlds, legal_actions(worlds[0]))
        self.assertIsNone(values)
        self.assertEqual(result["reason"], "unsampled_world")

    def test_node_budget_interrupts_without_values(self):
        worlds = self.worlds()
        worlds[0]["config"]["bot_exact_endgame_node_limit"] = 1
        values, result = self.evaluate(worlds, legal_actions(worlds[0]))
        self.assertIsNone(values)
        self.assertEqual(result["reason"], "node_limit")

    def test_terminal_sample_dominance_is_not_rejected_as_variance(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        status = {"terminal_complete": True, "root_values": [
            {"action": reference, "world_values": [100.0, 100.0, 100.0]},
            {"action": proposal, "world_values": [300.0, 100.0, 100.0]},
        ]}
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertTrue(guandan._should_accept_minimax_override(state, "p0", reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertLess(decision["paired_gain_lower"], 0.0)
        self.assertTrue(decision["sampled_dominance"])

    def test_completed_terminal_panel_bypasses_shallow_leaf_values(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        with fixture._search_patches(actions, mock.Mock(side_effect=AssertionError("shallow leaf"))), \
                mock.patch.object(guandan, "_determinize_state", side_effect=lambda *args: copy.deepcopy(state)), \
                mock.patch.object(guandan_ai, "_minimax_terminal_root_values", return_value=(
                    [[-100.0] * 3, [100.0] * 3, [300.0] * 3], {"status": "complete"})), \
                mock.patch.object(guandan_ai, "_minimax_root_lead_single_penalty", return_value=0), \
                mock.patch.object(guandan_ai, "_quick_candidate_score", return_value=0):
            action = guandan._minimax_pick_action(state, "p0", 5, 3, public_state=copy.deepcopy(state),
                                                 incumbent_action=actions[0])
        self.assertEqual(action, actions[2])
        result = state["_ai_eval_cache"]["minimax_anytime"]
        self.assertTrue(result["terminal_complete"])
        self.assertIsNone(result["completed_depth"])
        self.assertEqual(result["stop_reason"], "sampled_terminal")

    def test_terminal_ties_retain_search_preference_among_equivalent_roots(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()

        def evaluate(child, *args, **kwargs):
            cards = child["current_trick"]["cards"]
            return 100.0 if cards == actions[2]["card_ids"] else 20.0 if cards == actions[1]["card_ids"] else 0.0

        with fixture._search_patches(actions, evaluate), \
                mock.patch.object(guandan, "_determinize_state", side_effect=lambda *args: copy.deepcopy(state)), \
                mock.patch.object(guandan_ai, "_minimax_terminal_root_values", return_value=(
                    [[100.0] * 3, [100.0] * 3, [0.0] * 3], {"status": "complete"})), \
                mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            action = guandan._minimax_pick_action(state, "p0", 1, 3, public_state=copy.deepcopy(state),
                                                 incumbent_action=actions[0])
        self.assertEqual(action, actions[1])
        result = state["_ai_eval_cache"]["minimax_anytime"]
        self.assertEqual(result["terminal_attempt"]["tie_break_candidates"], 2)
        self.assertEqual(result["completed_depth"], 1)
        self.assertFalse(result.get("terminal_complete", False))


class GuandanMinimaxTieTests(unittest.TestCase):
    def test_short_partner_relay_single_survives_critical_root_width(self):
        state = replay_fixture("bb7780", 60)
        hand = state["players"]["bot4"]["hand"]
        groups = (("♣️7", "♥️7", "♦️7", "♣️3", "♥️3"),
                  ("♣️7", "♥️7", "♦️7"), ("♣️3", "♥️3"), ("♣️5",))
        actions = [{"type": "play", "card_ids": pick_card_ids(hand, labels)} for labels in groups]
        subset = guandan_ai.call(guandan, "_mcts_root_candidate_subset", state, "bot4", actions, 3)
        self.assertEqual(len(subset), 3)
        self.assertEqual(subset[0], actions[0])
        self.assertIn(actions[-1], subset)
        # The same public counts must select the same root families without
        # inspecting the partner's or enemy's actual cards.
        protected = copy.deepcopy(state)
        for actor, data in protected["players"].items():
            if actor != "bot4":
                data["hand"] = [None] * len(data["hand"])
        self.assertEqual(guandan_ai.call(guandan, "_mcts_root_candidate_subset",
                                        protected, "bot4", actions, 3), subset)

    def test_relay_reservation_does_not_displace_the_favorite_with_one_slot(self):
        state = replay_fixture("bb7780", 60)
        hand = state["players"]["bot4"]["hand"]
        actions = [{"type": "play", "card_ids": pick_card_ids(hand, labels)}
                   for labels in (("♣️7", "♥️7", "♦️7"), ("♣️5",))]
        self.assertEqual(guandan_ai.call(guandan, "_mcts_root_candidate_subset",
                                        state, "bot4", actions, 1), actions[:1])

    def test_equal_terminal_values_preserve_incumbent_in_every_root_order(self):
        fixture = GuandanSearchIntegrityTests()
        original, actions = fixture._minimax_fixture()
        incumbent = actions[2]
        for value in (-300.0, 0.0, 300.0):
            for order in (actions, list(reversed(actions)), [actions[1], actions[0], incumbent]):
                with self.subTest(value=value, order=order):
                    state = copy.deepcopy(original)
                    state["config"]["bot_search_use_remaining_budget"] = False
                    with fixture._search_patches(order, lambda *args, **kwargs: value):
                        chosen = guandan._minimax_pick_action(
                            state, "p0", 1, 3, incumbent_action=incumbent,
                        )
                    self.assertEqual(chosen, incumbent)

    def test_completed_search_needs_a_gain_even_without_a_named_plan_risk(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        for after, accepted in (([-300.0] * 3, False), ([-301.0] * 3, False),
                                ([-280.0] * 3, True)):
            status = {"completed_depth": 3, "root_values": [
                {"action": reference, "world_values": [-300.0] * 3},
                {"action": proposal, "world_values": after},
            ]}
            with self.subTest(after=after), \
                    mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
                self.assertEqual(guandan._should_accept_minimax_override(
                    state, "p0", reference, proposal, status,
                ), accepted)
                decision = state["_ai_eval_cache"]["minimax_override"]
                self.assertEqual(decision["reason"], "search_preference" if accepted else "no_search_gain")

    def test_equal_adjusted_values_do_not_override_for_a_raw_gain(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        status = {"completed_depth": 3, "root_values": [
            {"action": reference, "world_values": [0.0] * 3, "lead_penalty": 0.0},
            {"action": proposal, "world_values": [5.0] * 3, "lead_penalty": 5.0},
        ]}
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertFalse(guandan._should_accept_minimax_override(
                state, "p0", reference, proposal, status,
            ))

    def test_shallow_fallback_keeps_existing_positive_gain_rule_without_plan_risk(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        for gain in (0.5576764941, 2.4456033597, 3.9935764342, 5.49):
            status = {"completed_depth": 3, "root_values": [
                {"action": reference, "world_values": [200.0] * 3},
                {"action": proposal, "world_values": [200.0 + gain] * 3},
            ]}
            with self.subTest(gain=gain), \
                    mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
                self.assertTrue(guandan._should_accept_minimax_override(
                    state, "p0", reference, proposal, status,
                ))
                decision = state["_ai_eval_cache"]["minimax_override"]
                self.assertEqual(decision["reason"], "search_preference")
                self.assertAlmostEqual(decision["paired_gain_lower"], gain)
                self.assertEqual(decision["required_gain"], 0.0)

    def test_noisy_mixed_terminal_gains_preserve_reference(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        status = {"terminal_complete": True, "root_values": [
            {"action": reference, "world_values": [0.0] * 3},
            {"action": proposal, "world_values": [-100.0, 100.0, 100.0]},
        ]}
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertFalse(guandan._should_accept_minimax_override(
                state, "p0", reference, proposal, status,
            ))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertGreater(decision["paired_gain"], 0.0)
        self.assertLess(decision["paired_gain_lower"], 0.0)

    def test_ordinary_search_rejects_incomplete_or_nonfinite_evidence(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        for before, after in (([0.0], [100.0]), ([0.0, 0.0], [100.0]),
                              ([], []), ([0.0] * 3, [float("nan")] * 3),
                              ([0.0] * 3, [float("inf")] * 3)):
            status = {"completed_depth": 3, "root_values": [
                {"action": reference, "world_values": before},
                {"action": proposal, "world_values": after},
            ]}
            with self.subTest(before=before, after=after), \
                    mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
                self.assertFalse(guandan._should_accept_minimax_override(
                    state, "p0", reference, proposal, status,
                ))

    def test_consistent_gain_accounts_for_root_penalty_before_threshold(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        for penalty, accepted in ((0.0, True), (8.0, False)):
            status = {"completed_depth": 3, "root_values": [
                {"action": reference, "world_values": [100.0, -100.0, 50.0]},
                {"action": proposal, "world_values": [108.0, -92.0, 58.0],
                 "lead_penalty": penalty},
            ]}
            with self.subTest(penalty=penalty), \
                    mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
                self.assertEqual(guandan._should_accept_minimax_override(
                    state, "p0", reference, proposal, status,
                ), accepted)

    def test_unfinished_root_panel_cannot_override_without_a_plan_risk(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        records = [{"action": reference, "world_values": [-100.0] * 3},
                   {"action": proposal, "world_values": [100.0] * 3}]
        for status in ({}, {"completed_depth": None, "root_values": records},
                       {"completed_depth": 3, "root_values": records[1:]}):
            with self.subTest(status=status), \
                    mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
                self.assertFalse(guandan._should_accept_minimax_override(
                    state, "p0", reference, proposal, status,
                ))
                self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["reason"],
                                 "incomplete_search_comparison")

    def test_public_shortcut_labels_require_rechecking_the_actual_action(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        for reason, helper in (("forced_relay", "_forced_endgame_control_relay_action"),
                               ("teammate_control_defer", "_deferred_teammate_bomb_pass")):
            for checked, accepted in ((None, False), (reference, False), (proposal, True)):
                with self.subTest(reason=reason, checked=checked), \
                        mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}), \
                        mock.patch.object(guandan_ai, helper, return_value=checked) as shortcut:
                    self.assertEqual(guandan._should_accept_minimax_override(
                        state, "p0", reference, proposal, {"stop_reason": reason},
                    ), accepted)
                    self.assertEqual(shortcut.call_args.args, (state, "p0", [reference, proposal]))

    def test_auto_final_action_respects_the_paired_gain_guard(self):
        fixture = GuandanSearchIntegrityTests()
        original, actions = fixture._minimax_fixture()
        reference, proposal = actions[:2]
        for values, accepted in (([-100.0, 100.0, 100.0], False), ([100.0, 100.0, 300.0], True)):
            state = copy.deepcopy(original)
            state["config"].update(bot_mode="auto", bot_exact_endgame_enabled=False,
                                   bot_trick_boundary_mode="off")

            def search(sampled, *args, **kwargs):
                sampled.setdefault("_ai_eval_cache", {})["minimax_anytime"] = {
                    "terminal_complete": True, "root_values": [
                        {"action": reference, "world_values": [100.0] * 3},
                        {"action": proposal, "world_values": values},
                    ],
                }
                return proposal

            with self.subTest(values=values), \
                    mock.patch.object(guandan, "_heuristic_best_action", return_value=reference), \
                    mock.patch.object(guandan, "_determinize_state", side_effect=lambda *args, **kwargs: copy.deepcopy(state)), \
                    mock.patch.object(guandan, "_minimax_pick_action", side_effect=search), \
                    mock.patch.object(guandan_ai, "_public_endgame_closeout_action", return_value=None), \
                    mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}), \
                    mock.patch.object(guandan_ai, "_retained_bomb_override_is_unsafe", return_value=False), \
                    mock.patch.object(guandan, "_build_bot_explain", return_value={}) as explain:
                self.assertEqual(guandan.GuandanGame.bot_move(state, "p0"),
                                 proposal if accepted else reference)
                self.assertEqual(explain.call_args.args[3], "minimax" if accepted else "heuristic")
                self.assertEqual(explain.call_args.args[6]["minimax_override"]["accepted"], accepted)

    def test_recorded_losing_tie_cannot_break_teammate_pass(self):
        state = replay_fixture("bb7780", 67)
        self.assertEqual(state["current_turn"], "bot2")
        self.assertEqual(state["current_trick"]["player_id"], "bot4")
        reference = {"type": "pass"}
        proposal = {"type": "play", "card_ids": pick_card_ids(
            state["players"]["bot2"]["hand"], ("♣️9", "♥️9"),
        )}
        status = {"completed_depth": 5, "root_values": [
            {"action": reference, "world_values": [-300.0] * 3},
            {"action": proposal, "world_values": [-300.0] * 3},
        ]}
        self.assertFalse(guandan._should_accept_minimax_override(
            state, "bot2", reference, proposal, status,
        ))
        self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["paired_gain"], 0.0)


class GuandanTeammateSearchGuardTests(unittest.TestCase):
    def setUp(self):
        self.state = make_state({"bot": [13, 13, 5, 7], "opp": [6, 6, 8],
                                 "mate": [9, 9, 3, 4, 14], "opp2": [10, 12]})
        self.state.pop("_ai_sampled_world")
        self.state["current_turn"] = "mate"
        _, error = guandan.GuandanGame.apply_action(self.state, "mate", play(pair(self.state, "mate", 9)))
        self.assertIsNone(error)
        _, error = guandan.GuandanGame.apply_action(self.state, "opp2", {"type": "pass"})
        self.assertIsNone(error)
        self.reference = {"type": "pass"}
        self.proposal = play(pair(self.state, "bot", 13))

    def status(self, before, after):
        return {"completed_depth": 4, "root_values": [
            {"action": self.reference, "world_values": before},
            {"action": self.proposal, "world_values": after},
        ]}

    def accept(self, status, state=None):
        return guandan._should_accept_minimax_override(
            state or self.state, "bot", self.reference, self.proposal, status,
        )

    def test_small_noisy_gain_cannot_override_teammate_pass(self):
        status = self.status([-245.27, -23.06, -245.27], [-245.72, -19.32, -245.72])
        self.assertFalse(self.accept(status))
        decision = self.state["_ai_eval_cache"]["minimax_override"]
        self.assertIn("teammate_control", decision["plan_risks"])
        self.assertEqual(decision["reason"], "preserve_control_plan")

    def test_consistent_terminal_gain_can_overtake_teammate(self):
        self.assertTrue(self.accept(self.status([-100.0] * 3, [100.0] * 3)))
        self.assertEqual(self.state["_ai_eval_cache"]["minimax_override"]["reason"], "supported_plan_change")

    def test_immediate_finish_is_not_blocked_but_grouped_tail_needs_evidence(self):
        state = copy.deepcopy(self.state)
        state["players"]["bot"]["hand"] = [card for card in state["players"]["bot"]["hand"]
                                              if card["rank"] == 13]
        self.assertTrue(self.accept({}, state))
        state = copy.deepcopy(self.state)
        state["players"]["bot"]["hand"] = [card for card in state["players"]["bot"]["hand"]
                                              if card["rank"] != 7]
        self.assertFalse(self.accept({}, state))
        self.assertTrue(self.accept(self.status([-100.0] * 3, [100.0] * 3), state))

    def test_hidden_faces_do_not_control_team_guard(self):
        status = self.status([20.0] * 3, [21.0] * 3)
        self.assertFalse(self.accept(status))
        expected = self.state["_ai_eval_cache"]["minimax_override"]["plan_risks"]
        state = copy.deepcopy(self.state)
        for actor in ("opp", "mate", "opp2"):
            state["players"][actor]["hand"] = [None] * len(state["players"][actor]["hand"])
        state["_ai_eval_cache"] = {}
        self.assertFalse(self.accept(status, state))
        self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["plan_risks"], expected)

    def test_single_world_and_incomplete_comparison_preserve_pass(self):
        for status in ({}, self.status([0.0], [100.0]), self.status([0.0, 0.0], [100.0])):
            with self.subTest(status=status):
                self.assertFalse(self.accept(status))


class GuandanMinimaxReferenceTests(unittest.TestCase):
    def test_paired_variance_is_anchored_to_incumbent_not_search_order(self):
        fixture = GuandanSearchIntegrityTests()
        state, actions = fixture._minimax_fixture()
        reference = actions[2]
        world_index = [0]

        def evaluate(child, *args, **kwargs):
            root = child["current_trick"]["cards"]
            index = world_index[0] // len(actions)
            world_index[0] += 1
            if root == reference["card_ids"]:
                return (50.0, 150.0, 250.0)[index]
            return (100.0, 100.0, 100.0)[index]

        state["config"].update(bot_minimax_particles=3, bot_minimax_risk_lambda=0.12,
                              bot_search_use_remaining_budget=False)
        with fixture._search_patches(actions, evaluate), \
                mock.patch.object(guandan, "_determinize_state", side_effect=lambda *args: copy.deepcopy(state)), \
                mock.patch.object(guandan_ai, "_quick_candidate_score", side_effect=lambda state, bot, cards: 0.0):
            guandan._minimax_pick_action(state, "p0", 1, 3, incumbent_action=reference,
                                         public_state=copy.deepcopy(state))
        records = state["_ai_eval_cache"]["minimax_anytime"]["root_values"]
        incumbent = next(record for record in records if record["action"] == reference)
        self.assertEqual(incumbent["paired_std"], 0.0)
        self.assertEqual(incumbent["value"], incumbent["mean"])
        for record in records:
            if record["action"] != reference:
                self.assertGreater(record["paired_std"], 0.0)

    def test_risk_ranking_is_invariant_to_search_order(self):
        fixture = GuandanSearchIntegrityTests()
        original, actions = fixture._minimax_fixture()
        reference = actions[2]
        outcomes = {tuple(actions[0]["card_ids"]): [5.0, 3.0, 4.0],
                    tuple(actions[1]["card_ids"]): [10.0, -2.0, 4.0],
                    tuple(reference["card_ids"]): [0.0, 0.0, 0.0]}
        for ordered in (actions, list(reversed(actions)), [actions[1], actions[0], reference]):
            state = copy.deepcopy(original)
            state["config"].update(bot_minimax_particles=3, bot_minimax_risk_lambda=0.12,
                                  bot_search_use_remaining_budget=False)
            calls = [0]

            def evaluate(child, *args, **kwargs):
                index = calls[0] // len(actions)
                calls[0] += 1
                return outcomes[tuple(child["current_trick"]["cards"])][index]

            with self.subTest(order=ordered), fixture._search_patches(ordered, evaluate), \
                    mock.patch.object(guandan, "_determinize_state", side_effect=lambda *args: copy.deepcopy(state)):
                chosen = guandan._minimax_pick_action(state, "p0", 1, 3, incumbent_action=reference,
                                                      public_state=copy.deepcopy(state))
            self.assertEqual(chosen, actions[0])


if __name__ == "__main__":
    unittest.main()
