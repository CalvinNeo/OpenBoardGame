import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import FIXTURES, pick_card_ids, replay_fixture


class GuandanControlPlanSearchTests(unittest.TestCase):
    def action(self, state, labels):
        return {"type": "play", "card_ids": pick_card_ids(state["players"]["bot2"]["hand"], labels)}

    def call(self, name, *args):
        return guandan_ai.call(guandan, name, *args)

    def status(self, reference, proposal, before, after):
        return {"completed_depth": 5, "root_values": [
            {"action": reference, "world_values": before},
            {"action": proposal, "world_values": after},
        ]}

    def custom_hand(self, state, labels):
        # Build from a fresh canonical deck.  Fixture hands contain only cards
        # still in play, so searching them first can make this helper depend on
        # the replay prefix and can leave duplicate physical IDs in the state.
        available = list(guandan._full_deck())
        selected = []
        for label in labels:
            card = next((card for card in available
                         if card not in selected and guandan._card_label(card) == label), None)
            self.assertIsNotNone(card, label)
            selected.append(card)
        selected_ids = {card["id"] for card in selected}
        displaced_ids = set()
        for pid in state["turn_order"]:
            old_hand = state["players"][pid]["hand"]
            kept = []
            for card in old_hand:
                if card["id"] in selected_ids:
                    continue
                if pid == "bot2":
                    displaced_ids.add(card["id"])
                kept.append(card)
            state["players"][pid]["hand"] = kept
        state["players"]["bot2"]["hand"] = selected
        seen_ids = (set(state.get("seen_cards", [])) - selected_ids) | displaced_ids
        state["seen_cards"] = sorted(seen_ids)
        return selected

    def test_saved_game_replays_to_recorded_finish(self):
        state = replay_fixture("964", len(FIXTURES["964"]["actions"]) + 1)
        self.assertEqual(state["finish_order"], ["z", "bot4", "bot2", "calvin"])

    def test_saved_overbomb_frontier_keeps_natural_same_tier_bomb(self):
        for step in (11, 23):
            with self.subTest(step=step):
                state = replay_fixture("964", step)
                hand = state["players"]["bot4"]["hand"]
                hand_map = guandan._map_hand_by_id(hand)

                frontier = self.call("_bomb_response_frontier", state, "bot4", 3)
                frontier_labels = {
                    tuple(sorted(guandan._card_label(hand_map[card_id]) for card_id in cards))
                    for cards in frontier
                }
                self.assertIn(tuple(sorted(["♦️7", "♠️7", "♦️7", "♥️2"])), frontier_labels)
                self.assertIn(tuple(sorted(["♠️9", "♥️9", "♣️9", "♦️9"])), frontier_labels)

                actions = guandan._candidate_actions(state, "bot4", 8)
                action_labels = {
                    tuple(sorted(guandan._card_label(hand_map[card_id]) for card_id in action["card_ids"]))
                    for action in actions
                    if action.get("type") == "play"
                }
                self.assertIn(tuple(sorted(["♠️9", "♥️9", "♣️9", "♦️9"])), action_labels)

    def test_forced_actions_skip_scoring_determinization_and_search(self):
        for step in (63, 67, 71, 73, 75, 77, 79, 83, 85, 87, 89, 95):
            with self.subTest(step=step):
                state = replay_fixture("964", step)
                actor = state["current_turn"]
                with (
                    mock.patch.object(guandan, "_heuristic_best_action", side_effect=AssertionError("forced scoring")),
                    mock.patch.object(guandan, "_determinize_state", side_effect=AssertionError("forced sampling")),
                    mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("forced search")),
                ):
                    action = guandan.GuandanGame.bot_move(state, actor)
                _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), actor, action)
                self.assertIsNone(error)
                explain = state["bot_explain"][actor]
                self.assertTrue(explain["method_details"]["forced_action"])
                self.assertEqual(explain["score_model"], "none")
                self.assertIsNone(explain["chosen"]["score"])
                self.assertEqual(len(state["bot_explain_history"][actor]), 1)
                self.assertNotIn("_ai_eval_cache", state)

    def test_sampled_small_gain_cannot_spend_wild_control_reserve(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [20.0, 20.0, 20.0], [22.0, 19.0, 25.0])
        self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertIn("wild_control_reserve", decision["plan_risks"])
        self.assertEqual(decision["reason"], "preserve_control_plan")

    def test_incomplete_terminal_search_cannot_spend_extra_wild_resource(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [20.0, 20.0, 20.0], [27.0, 27.0, 27.0])
        status["terminal_attempt"] = {
            "status": "incomplete", "requested_worlds": 12, "completed_worlds": 6,
        }
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2",
                                       reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertIn("incomplete_control_reserve", decision["plan_risks"])
        self.assertEqual(decision["reason"], "preserve_control_plan")

    def test_tied_terminal_fallback_guard_is_narrow_to_extra_special_cards(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        wildcard_proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, wildcard_proposal, [20.0, 20.0, 20.0], [22.0, 22.0, 22.0])
        status.update(
            stop_reason="deadline",
            terminal_attempt={"status": "complete", "tie_break_candidates": 2},
        )
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2",
                                       reference, wildcard_proposal, status))
        self.assertIn(
            "incomplete_control_reserve",
            state["_ai_eval_cache"]["minimax_override"]["plan_risks"],
        )

        natural_proposal = self.action(state, ("♠️J",))
        natural_status = self.status(reference, natural_proposal, [20.0, 20.0, 20.0],
                                     [22.0, 22.0, 22.0])
        natural_status.update(
            stop_reason="deadline",
            terminal_attempt={"status": "complete", "tie_break_candidates": 2},
        )
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2",
                                      reference, natural_proposal, natural_status))

    def test_pair81_four_kings_to_five_card_wild_bomb_needs_stronger_incomplete_evidence(self):
        state = replay_fixture("964", 65)
        hand = self.custom_hand(state, ["♠️K", "♥️K", "♣️K", "♦️K", "♥️2", "♠️3"])
        reference = {"type": "play", "card_ids": [card["id"] for card in hand[:4]]}
        proposal = {"type": "play", "card_ids": [card["id"] for card in hand[:5]]}
        status = self.status(reference, proposal, [20.0] * 3, [27.0] * 3)
        status["terminal_attempt"] = {
            "status": "complete", "requested_worlds": 12, "completed_worlds": 12,
            "tie_break_candidates": 2,
        }
        status.update(stop_reason="deadline", terminal_complete=False)
        with (mock.patch.object(guandan_ai, "_retained_bomb_override_is_unsafe", return_value=False),
              mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={})):
            self.assertEqual(self.call("_minimax_incomplete_resource_risk", state, "bot2",
                                       reference, proposal, status), 3.0)
            self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2",
                                       reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertEqual(decision["required_gain"], 8.5)
        self.assertEqual(decision["reason"], "preserve_control_plan")

    def test_pair74_two_jokers_instead_of_natural_five_card_run_are_guarded(self):
        state = replay_fixture("964", 65)
        hand = self.custom_hand(state, ["🃏S", "🃏S", "♠️A", "♣️2", "♣️3", "♦️4", "♠️5"])
        reference = {"type": "play", "card_ids": [card["id"] for card in hand[2:]]}
        proposal = {"type": "play", "card_ids": [card["id"] for card in hand[:2]]}
        state["current_trick"] = None
        status = self.status(reference, proposal, [20.0] * 3, [21.0] * 3)
        status.update(terminal_attempt={
            "status": "incomplete", "requested_worlds": 12, "completed_worlds": 6,
        }, terminal_complete=False)
        with (mock.patch.object(guandan_ai, "_retained_bomb_override_is_unsafe", return_value=False),
              mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={})):
            self.assertEqual(self.call("_minimax_incomplete_resource_risk", state, "bot2",
                                       reference, proposal, status), 4.0)
            self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2",
                                       reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertEqual(decision["required_gain"], 9.5)
        self.assertEqual(decision["reason"], "preserve_control_plan")

    def test_special_card_immediate_finish_bypasses_incomplete_resource_guard(self):
        state = replay_fixture("964", 65)
        hand = self.custom_hand(state, ["♠️K", "♥️K", "♣️K", "♥️2"])
        proposal = {"type": "play", "card_ids": [card["id"] for card in hand]}
        reference = {"type": "pass"}
        status = self.status(reference, proposal, [20.0, 20.0], [20.0, 20.0])
        status["terminal_attempt"] = {
            "status": "incomplete", "requested_worlds": 12, "completed_worlds": 3,
        }
        with (mock.patch.object(guandan_ai, "_retained_bomb_override_is_unsafe", return_value=False),
              mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={})):
            self.assertEqual(self.call("_minimax_incomplete_resource_risk", state, "bot2",
                                       reference, proposal, status), 0.0)
            self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2",
                                      reference, proposal, status))
        self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["reason"], "immediate_finish")

    def test_complete_terminal_worlds_can_spend_special_resource_on_dominant_gain(self):
        state = replay_fixture("964", 65)
        hand = self.custom_hand(state, ["♠️J", "♥️2", "♣️Q"])
        reference = {"type": "play", "card_ids": [hand[0]["id"]]}
        proposal = {"type": "play", "card_ids": [hand[0]["id"], hand[1]["id"]]}
        status = self.status(reference, proposal, [-100.0] * 3, [100.0] * 3)
        status.update(terminal_complete=True, terminal_attempt={
            "status": "complete", "requested_worlds": 12, "completed_worlds": 12,
        })
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertEqual(self.call("_minimax_incomplete_resource_risk", state, "bot2",
                                       reference, proposal, status), 0.0)
            self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2",
                                      reference, proposal, status))
        decision = state["_ai_eval_cache"]["minimax_override"]
        self.assertTrue(decision["sampled_dominance"])

    def test_normal_depth_limited_gain_does_not_trigger_incomplete_resource_prior(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [20.0] * 3, [21.0] * 3)
        status.update(stop_reason="depth_limit", terminal_attempt={
            "status": "complete", "requested_worlds": 12, "completed_worlds": 12,
        })
        with mock.patch.object(guandan_ai, "_minimax_plan_risks", return_value={}):
            self.assertEqual(self.call("_minimax_incomplete_resource_risk", state, "bot2",
                                       reference, proposal, status), 0.0)
            self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2",
                                      reference, proposal, status))
        self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["reason"], "search_preference")

    def test_consistent_large_search_gain_can_spend_wild(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [-100.0] * 3, [100.0] * 3)
        self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))
        self.assertEqual(state["_ai_eval_cache"]["minimax_override"]["reason"], "supported_plan_change")

    def test_one_favorable_world_does_not_justify_breaking_control(self):
        state = replay_fixture("964", 65)
        reference = {"type": "pass"}
        proposal = self.action(state, ("♠️J", "♥️2"))
        status = self.status(reference, proposal, [-100.0], [100.0])
        self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))

    def test_wild_response_leaving_one_complete_group_is_allowed(self):
        state = replay_fixture("964", 65)
        hand = state["players"]["bot2"]["hand"]
        removed = [card for card in hand if card["rank"] == 14 or guandan._card_label(card) == "♣️2"]
        state["seen_cards"].extend(card["id"] for card in removed)
        state["players"]["bot2"]["hand"] = [card for card in hand if card not in removed]
        proposal = self.action(state, ("♠️J", "♥️2"))
        self.assertEqual(self.call("_minimax_plan_risks", state, "bot2", {"type": "pass"}, proposal), {})

    def test_short_enemy_takeover_is_not_abandoned_for_tiny_sample_gain(self):
        state = replay_fixture("964", 61)
        reference = self.action(state, ("♠️K", "♣️K", "♦️K", "♥️2"))
        proposal = {"type": "pass"}
        status = self.status(reference, proposal, [20.0] * 3, [22.0] * 3)
        self.assertFalse(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))
        self.assertIn("keep_takeover", state["_ai_eval_cache"]["minimax_override"]["plan_risks"])

    def test_public_strong_group_protection_ignores_hidden_allocations(self):
        state = replay_fixture("964", 69)
        reference = self.action(state, ("♠️K", "♣️K", "♦️K"))
        proposal = self.action(state, ("♥️A",))
        expected = self.call("_minimax_plan_risks", state, "bot2", reference, proposal)
        self.assertIn("cash_unbeaten_group", expected)
        opponents = [pid for pid in state["turn_order"] if pid != "bot2"]
        cards = [card for pid in opponents for card in state["players"][pid]["hand"]]
        rng = random.Random(19)
        for _ in range(5):
            changed = copy.deepcopy(state)
            rng.shuffle(cards)
            offset = 0
            for actor in opponents:
                count = len(changed["players"][actor]["hand"])
                changed["players"][actor]["hand"] = cards[offset:offset + count]
                offset += count
            self.assertEqual(self.call("_minimax_plan_risks", changed, "bot2", reference, proposal), expected)

    def test_public_strong_group_is_not_an_unconditional_single_ban(self):
        state = replay_fixture("964", 69)
        reference = self.action(state, ("♠️K", "♣️K", "♦️K"))
        proposal = self.action(state, ("♥️A",))
        status = self.status(reference, proposal, [-100.0] * 3, [100.0] * 3)
        self.assertTrue(self.call("_should_accept_minimax_override", state, "bot2", reference, proposal, status))

    def test_saved_strong_group_leads_before_vulnerable_single(self):
        state = replay_fixture("964", 69)
        rng = random.Random(7)
        with mock.patch.object(guandan_ai.random, "Random", return_value=rng):
            action = guandan.GuandanGame.bot_move(state, "bot2")
        hand = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
        self.assertCountEqual([guandan._card_label(hand[card_id]) for card_id in action["card_ids"]],
                              ["♠️K", "♣️K", "♦️K"])
        explain = state["bot_explain"]["bot2"]
        search = explain["search"]
        # The search may now agree with the public-information baseline;
        # either path must preserve the strong grouped lead asserted above.
        self.assertIn(search["decision"]["reason"], ("agreement", "preserve_control_plan"))
        # Depth now counts decisions, with compulsory passes compressed and
        # short-hand control transfers extended separately. Raw old ply counts
        # are no longer comparable, especially under a wall-clock deadline.
        if search.get("terminal_complete"):
            self.assertIsNone(search["completed_depth"])
            self.assertEqual(search["terminal_attempt"]["status"], "complete")
            self.assertEqual(search["terminal_attempt"]["completed_worlds"], 12)
        else:
            self.assertGreaterEqual(search["completed_depth"], 1)
        self.assertTrue(explain["method_details"]["minimax_forced_passes_free"])
        self.assertEqual(explain["method_details"]["minimax_control_extension_plies"], 2)
        self.assertEqual(sum(record["selected"] for record in search["candidates"]), 1)
        for record in search["candidates"]:
            self.assertEqual(record["samples"], 12)
            self.assertEqual(record["mean"], sum(record["world_values"]) / 12)
        self.assertAlmostEqual(explain["chosen"]["score"], sum(explain["chosen"]["components"].values()))

    def test_saved_level_two_response_keeps_the_wildcard_plan(self):
        state = replay_fixture("964", 65)
        hand_before = copy.deepcopy(state["players"]["bot2"]["hand"])
        with mock.patch.object(guandan_ai.random, "Random", return_value=random.Random(7)):
            action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(action, {"type": "pass"})
        explain = state["bot_explain"]["bot2"]
        self.assertEqual(explain["chosen"]["cards"], ["Pass"])
        # Removing duplicated response costs makes the value margin small
        # enough to search, even though policy deductions favor passing.
        gate = explain["method_details"]["heuristic_search_gate"]
        self.assertFalse(gate["confident"])
        self.assertEqual(gate["reason"], "ambiguous_heuristic")
        self.assertTrue(gate["blacklist_separated"])
        self.assertGreaterEqual(gate["decision_score_gap"], gate["required_gap"])
        self.assertLess(gate["value_score_gap"], gate["required_gap"])
        self.assertEqual(gate["score_gap"], min(gate["decision_score_gap"],
                                               gate["value_score_gap"]))

        search = explain["search"]
        self.assertEqual(search["method"], "minimax")
        decision = search["decision"]
        self.assertEqual(decision["reference"], ["Pass"])
        self.assertCountEqual(decision["proposal"], ["♠️J", "♥️2"])
        self.assertFalse(decision["accepted"])
        self.assertEqual(decision["reason"], "preserve_control_plan")
        self.assertGreater(decision["plan_risks"]["wild_control_reserve"], 0.0)
        self.assertGreater(decision["plan_risks"]["incomplete_control_reserve"], 0.0)
        self.assertFalse(decision["terminal_complete"])
        self.assertFalse(decision["sampled_dominance"])
        self.assertGreater(decision["paired_gain"], decision["required_gain"])
        self.assertLess(decision["paired_gain_lower"], decision["required_gain"])

        # The legal chosen pass must leave the entire planned hand, including
        # its level-rank heart wildcard, available for the following trick.
        self.assertTrue(any(guandan._is_wild(card, state["level_rank"])
                            for card in hand_before))
        _, error = guandan.GuandanGame.apply_action(state, "bot2", action)
        self.assertIsNone(error)
        self.assertEqual(state["players"]["bot2"]["hand"], hand_before)


class GuandanShortRunnerTests(unittest.TestCase):
    def state(self):
        return replay_fixture("bb7780", 61, {"bot_mode": "heuristic", "bot_trick_boundary_mode": "off"})

    def qualified(self, state):
        return guandan_ai.call(guandan, "_short_runner_has_natural_teammate_overtake", state, "bot2")

    def relay_state(self):
        state = self.state()
        for actor, labels in (("bot2", ("♥️8", "♦️8", "♦️8", "♣️9", "♥️9")),
                              ("z", ("♣️10", "♠️10", "♣️10", "♠️Q", "♣️Q")),
                              ("bot4", ("♣️4", "♦️4", "♣️4", "♦️4", "♥️4")),
                              ("bot2", ()), ("z", ())):
            action = {"type": "play", "card_ids": pick_card_ids(state["players"][actor]["hand"], labels)} \
                if labels else {"type": "pass"}
            _, error = guandan.GuandanGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        return state

    def test_short_runner_sets_up_second_place_before_long_partner(self):
        state = self.state()
        action = guandan.GuandanGame.bot_move(state, "bot2")
        hand = state["players"]["bot2"]["hand"]
        self.assertEqual(set(action["card_ids"]), set(pick_card_ids(hand, ("♥️8", "♦️8", "♦️8", "♣️9", "♥️9"))))
        self.assertEqual(state["bot_explain"]["bot2"]["method"], "heuristic")
        self.assertEqual(guandan_ai.call(guandan, "_teammate_protect_bonus", state, "bot2"), 0.0)

    def test_runner_setup_uses_only_own_cards_and_public_counts(self):
        state = self.state()
        self.assertTrue(self.qualified(state))
        for actor, data in state["players"].items():
            if actor != "bot2":
                data["hand"] = [None] * len(data["hand"])
        state["_ai_eval_cache"] = {}
        self.assertTrue(self.qualified(state))

    def test_no_urgency_or_short_partner_keeps_protection(self):
        for mutate in (lambda state: state.update(finish_order=[]),
                       lambda state: state["players"]["bot4"].update(hand=[None] * 2)):
            state = self.state()
            mutate(state)
            self.assertFalse(self.qualified(state))
            self.assertGreater(guandan_ai.call(guandan, "_teammate_protect_bonus", state, "bot2"), 0.0)

    def test_wild_spending_bomb_break_and_unstructured_tail_do_not_qualify(self):
        groups = (("♥️8", "♦️8", "♥️2", "♣️9", "♥️9", "♦️J"),
                  ("♥️8", "♦️8", "♦️8", "♣️8", "♣️9", "♥️9"),
                  ("♥️8", "♦️8", "♦️8", "♣️9", "♥️9", "♦️J", "♦️Q"))
        for labels in groups:
            state = self.state()
            deck = guandan._full_deck()
            selected = set(pick_card_ids(deck, labels))
            state["players"]["bot2"]["hand"] = [card for card in deck if card["id"] in selected]
            state["_ai_eval_cache"] = {}
            with self.subTest(labels=labels):
                self.assertFalse(self.qualified(state))

    def test_public_guaranteed_single_relay_secures_second_place(self):
        state = self.relay_state()
        action = guandan.GuandanGame.bot_move(state, "bot4")
        expected = pick_card_ids(state["players"]["bot4"]["hand"], ("♣️5",))
        self.assertEqual(action["card_ids"], expected)
        components = state["bot_explain"]["bot4"]["chosen"]["components"]
        self.assertGreaterEqual(components["lead_teammate_finish"], 100.0)
        self.assertNotIn("lead_closeout_reply", components)
        _, error = guandan.GuandanGame.apply_action(state, "bot4", action)
        self.assertIsNone(error)
        action = guandan.GuandanGame.bot_move(state, "bot2")
        _, error = guandan.GuandanGame.apply_action(state, "bot2", action)
        self.assertIsNone(error)
        self.assertEqual(state["finish_order"][:2], ["calvin", "bot2"])

    def test_auto_continuation_sets_up_and_completes_second_place_relay(self):
        state = replay_fixture("bb7780", 61, {
            "bot_mode": "auto", "bot_think_time_ms": 6000,
            "bot_trick_boundary_mode": "off", "bot_search_use_remaining_budget": False,
        })
        real_random = random.Random
        expected = (
            ("bot2", ("♥️8", "♦️8", "♦️8", "♣️9", "♥️9")),
            ("z", ("♣️10", "♠️10", "♣️10", "♠️Q", "♣️Q")),
            ("bot4", ("♣️4", "♦️4", "♣️4", "♦️4", "♥️4")),
            ("bot2", ()), ("z", ()), ("bot4", ("♣️5",)), ("bot2", ("♦️J",)),
        )
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            for actor, labels in expected:
                with self.subTest(actor=actor, labels=labels):
                    self.assertEqual(state["current_turn"], actor)
                    hand = state["players"][actor]["hand"]
                    wanted = {"type": "play", "card_ids": pick_card_ids(hand, labels)} \
                        if labels else {"type": "pass"}
                    action = wanted if actor == "z" else guandan.GuandanGame.bot_move(state, actor)
                    self.assertEqual(action["type"], wanted["type"])
                    self.assertEqual(set(action.get("card_ids", [])), set(wanted.get("card_ids", [])))
                    _, error = guandan.GuandanGame.apply_action(state, actor, action)
                    self.assertIsNone(error)
        self.assertEqual(state["finish_order"][:2], ["calvin", "bot2"])

    def test_single_relay_proof_uses_public_pool_and_response_order(self):
        state = self.relay_state()
        for actor, data in state["players"].items():
            if actor != "bot4":
                data["hand"] = [None] * len(data["hand"])
        state["_ai_eval_cache"] = {}
        for label, expected in (("♣️5", 100.0), ("♦️Q", 0.0)):
            cards = pick_card_ids(state["players"]["bot4"]["hand"], (label,))
            combo = guandan_ai.call(guandan, "_action_combo", state, "bot4", {"type": "play", "card_ids": cards})
            self.assertEqual(guandan_ai.call(guandan, "_lead_teammate_finish_bonus",
                                            state, "bot4", cards, combo), expected)
            with mock.patch.object(guandan_ai, "_next_active_after", return_value="z"):
                self.assertEqual(guandan_ai.call(guandan, "_lead_teammate_finish_bonus",
                                                state, "bot4", cards, combo), 0.0)


if __name__ == "__main__":
    unittest.main()
