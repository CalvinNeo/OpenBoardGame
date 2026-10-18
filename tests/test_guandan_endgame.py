import copy
import itertools
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai, guandan_endgame, guandan_trick
from game.guandan_endgame import EndgameSolver, IncompleteEndgame
from tests.guandan_history_fixtures import pick_card_ids
from tests.test_guandan_trick_boundary import make_state, pair, play


def legal_actions(state):
    actor = state["current_turn"]
    hand = state["players"][actor]["hand"]
    current = state.get("current_trick")
    actions = []
    for size in range(1, len(hand) + 1):
        for cards in itertools.combinations(hand, size):
            combo = guandan._evaluate_play_combo(state, list(cards))
            if combo and (not current or guandan._compare_combos(
                    current["combo"], combo, state["level_rank"], state["config"])):
                actions.append(play([card["id"] for card in cards]))
    if current:
        actions.append({"type": "pass"})
    return actions


def reference_value(state, observer, cache):
    if state.get("game_over"):
        return 1000.0 if state["winner_team"] == state["player_teams"][observer] else -1000.0
    if state["phase"] == "round_end":
        order = state["finish_order"]
        winning = state["player_teams"][order[0]]
        partner = next(rank for rank, actor in enumerate(order[1:], 2)
                       if state["player_teams"][actor] == winning)
        magnitude = {2: 300.0, 3: 200.0, 4: 100.0}[partner]
        return magnitude if winning == state["player_teams"][observer] else -magnitude
    current = state.get("current_trick")
    key = (tuple(tuple(sorted(card["id"] for card in state["players"][actor]["hand"]))
                 for actor in state["turn_order"]), state["current_turn"],
           current["player_id"] if current else None,
           tuple(sorted(current["combo"].items())) if current else None,
           state["pass_count"], tuple(state["finish_order"]))
    if key in cache:
        return cache[key]
    actor = state["current_turn"]
    values = []
    for action in legal_actions(state):
        child = guandan._clone_search_state(state)
        _, error = guandan.GuandanGame.apply_action(child, actor, action)
        if error is not None:
            raise AssertionError(error)
        values.append(reference_value(child, observer, cache))
    value = (max if state["player_teams"][actor] == state["player_teams"][observer] else min)(values)
    cache[key] = value
    return value


class GuandanEndgameTests(unittest.TestCase):
    def assert_exact(self, state, observer="bot"):
        before = copy.deepcopy(state)
        actions = legal_actions(state)
        solver = EndgameSolver(guandan, state, observer)
        values = solver.root_values(actions)
        cache = {}
        for action, value in zip(actions, values):
            child = guandan._clone_search_state(state)
            _, error = guandan.GuandanGame.apply_action(child, state["current_turn"], action)
            self.assertIsNone(error)
            self.assertEqual(value, reference_value(child, observer, cache), action)
        self.assertEqual(state, before)
        self.assertEqual(solver.root_values(list(reversed(actions))), list(reversed(values)))
        return solver

    def test_random_small_games_and_mid_tricks_match_rule_engine(self):
        for seed in range(24):
            with self.subTest(seed=seed):
                state = make_state({"bot": [3], "opp": [4], "mate": [5], "opp2": [6]})
                rng = random.Random(seed)
                deck = guandan._full_deck()
                rng.shuffle(deck)
                count = 2 if seed % 3 == 0 else 1
                for actor in state["turn_order"]:
                    state["players"][actor]["hand"], deck = deck[:count], deck[count:]
                level = (2, 7, 13, 14)[seed % 4]
                state["level_rank"] = level
                for team in state["teams"].values():
                    team["level"] = level
                state["config"]["require_partner_not_last_for_a"] = bool(seed % 2)
                for _ in range(seed % 4):
                    action = rng.choice(legal_actions(state))
                    _, error = guandan.GuandanGame.apply_action(state, state["current_turn"], action)
                    self.assertIsNone(error)
                    if state["phase"] != "playing":
                        break
                if state["phase"] == "playing":
                    self.assert_exact(state, state["current_turn"])

    def test_finished_leader_waits_for_last_pass_then_partner_inherits(self):
        state = make_state({"bot": [3, 3], "opp": [14], "mate": [4, 7], "opp2": [13]})
        guandan.GuandanGame.apply_action(state, "bot", play(pair(state, "bot", 3)))
        guandan.GuandanGame.apply_action(state, "opp", {"type": "pass"})
        guandan.GuandanGame.apply_action(state, "mate", {"type": "pass"})
        solver = self.assert_exact(state)
        child = solver.transition(solver.initial, solver.action_move({"type": "pass"}))
        self.assertEqual(solver.order[child[1]], "mate")
        self.assertEqual(child[2:5], (-1, -1, 0))

    def test_legal_routes_and_transitions_match_engine_in_larger_random_hands(self):
        for seed in range(24):
            rng = random.Random(500 + seed)
            state = make_state({"bot": [3], "opp": [4], "mate": [5], "opp2": [6]})
            deck = guandan._full_deck()
            rng.shuffle(deck)
            for actor in state["turn_order"]:
                count = rng.randint(2, 6)
                state["players"][actor]["hand"], deck = deck[:count], deck[count:]
            state["level_rank"] = (2, 7, 14)[seed % 3]
            for _ in range(seed % 8):
                action = rng.choice(legal_actions(state))
                _, error = guandan.GuandanGame.apply_action(state, state["current_turn"], action)
                self.assertIsNone(error)
                if state["phase"] != "playing":
                    break
            if state["phase"] != "playing":
                continue
            actor = state["current_turn"]
            solver = EndgameSolver(guandan, state, actor)
            expected_moves = {solver.action_move(action) for action in legal_actions(state)}
            actual_moves = {solver.action_move(action) for action in solver.root_actions()}
            self.assertEqual(actual_moves, expected_moves)
            for action in solver.root_actions():
                with self.subTest(seed=seed, action=action):
                    node = solver.transition(solver.initial, solver.action_move(action))
                    child = guandan._clone_search_state(state)
                    _, error = guandan.GuandanGame.apply_action(child, actor, action)
                    self.assertIsNone(error)
                    if child["phase"] != "playing":
                        self.assertEqual(solver.terminal(node[5]), reference_value(child, actor, {}))
                        continue
                    self.assertEqual(solver.order[node[1]], child["current_turn"])
                    self.assertEqual(node[4], child["pass_count"])
                    self.assertEqual([solver.order[index] for index in node[5]], child["finish_order"])
                    for index, player in enumerate(solver.order):
                        remaining_ids = {card["id"] for card in child["players"][player]["hand"]}
                        remaining_mask = sum(1 << offset for offset, card in enumerate(solver.cards[index])
                                             if card["id"] in remaining_ids)
                        self.assertEqual(node[0][index], solver.canonical_masks[index][remaining_mask])
                    current = child.get("current_trick")
                    self.assertEqual(node[3] >= 0, bool(current))
                    if current:
                        self.assertEqual(solver.order[node[2]], current["player_id"])
                        for field in guandan_endgame.COMBO_FIELDS:
                            self.assertEqual(solver.combos[node[3]].get(field), current["combo"].get(field))

    def test_existing_opposing_finishers_and_game_over_values(self):
        for level, required in itertools.product((2, 12, 13, 14), (False, True)):
            with self.subTest(level=level, required=required):
                state = make_state({"bot": [3], "opp": [4, 6], "mate": [5, 7], "opp2": [8]})
                state["level_rank"] = level
                for team in state["teams"].values():
                    team["level"] = level
                state["config"]["require_partner_not_last_for_a"] = required
                guandan.GuandanGame.apply_action(state, "bot", play([state["players"]["bot"]["hand"][0]["id"]]))
                guandan.GuandanGame.apply_action(state, "opp", {"type": "pass"})
                guandan.GuandanGame.apply_action(state, "mate", {"type": "pass"})
                guandan.GuandanGame.apply_action(state, "opp2", play([state["players"]["opp2"]["hand"][0]["id"]]))
                self.assertEqual(state["finish_order"], ["bot", "opp2"])
                self.assert_exact(state)

    def test_match_reward_requires_the_winning_dealer_to_have_played_a(self):
        for level, dealer, required in itertools.product((11, 13, 14), ("A", "B"), (False, True)):
            state = make_state({"bot": [3], "opp": [4], "mate": [5], "opp2": [6]})
            state["dealer_team"] = dealer
            state["level_rank"] = level
            for team in state["teams"].values():
                team["level"] = level
            state["config"]["require_partner_not_last_for_a"] = required
            solver = EndgameSolver(guandan, state, "bot")
            for order in itertools.permutations(range(4)):
                winning = solver.teams[order[0]]
                partner_rank = next(rank for rank, actor in enumerate(order[1:], 2)
                                    if solver.teams[actor] == winning)
                magnitude = {2: 300.0, 3: 200.0, 4: 100.0}[partner_rank]
                if level == 14 and winning == dealer and (not required or partner_rank != 4):
                    magnitude = 1000.0
                expected = magnitude if winning == "A" else -magnitude
                with self.subTest(level=level, dealer=dealer, required=required, order=order):
                    self.assertEqual(solver.terminal(order), expected)
                    settled = guandan._clone_search_state(state)
                    settled["finish_order"] = [solver.order[index] for index in order]
                    guandan._advance_to_round_end(settled)
                    self.assertEqual(reference_value(settled, "bot", {}), expected)

    def test_ace_low_grouped_runs_are_complete_endgame_routes(self):
        for ranks, kind, high in (([14, 14, 2, 2, 3, 3], "three_pairs", 3),
                                  ([14, 14, 14, 2, 2, 2], "steel_plate", 2)):
            with self.subTest(kind=kind):
                state = make_state({"bot": ranks, "opp": [4], "mate": [5], "opp2": [6]})
                state["level_rank"] = 7
                action = play([card["id"] for card in state["players"]["bot"]["hand"]])
                solver = EndgameSolver(guandan, state, "bot")
                move = solver.action_move(action)
                self.assertEqual(solver.combos[move[1]]["type"], kind)
                self.assertEqual(solver.combos[move[1]]["high_value"], high)
                self.assertIn(move, [solver.action_move(candidate) for candidate in solver.root_actions()])
                child = guandan._clone_search_state(state)
                _, error = guandan.GuandanGame.apply_action(child, "bot", action)
                self.assertIsNone(error)
                self.assertEqual(solver.root_values([action]), [reference_value(child, "bot", {})])

    def test_double_down_and_guaranteed_first_place_are_terminal_rewards(self):
        state = make_state({"bot": [4, 4, 3], "opp": [14], "mate": [7, 9], "opp2": [13]})
        solver = self.assert_exact(state)
        self.assertGreaterEqual(solver.root_values([play(pair(state, "bot", 4))])[0], 100.0)
        state = make_state({"bot": [3, 3], "opp": [14], "mate": [4], "opp2": [13]})
        solver = self.assert_exact(state)
        self.assertEqual(solver.root_values([play(pair(state, "bot", 3))]), [300.0])

    def test_three_card_hands_and_bomb_choices_match_full_rule_search(self):
        for ranks in (
                {"bot": [4, 4, 3], "opp": [5, 5, 8], "mate": [6, 6, 9], "opp2": [7, 7, 10]},
                {"bot": [5, 5, 5], "opp": [4, 8], "mate": [6, 6, 9], "opp2": [7, 10]},
                {"bot": [4, 4, 4, 4, 8], "opp": [3, 6], "mate": [5, 5], "opp2": [7, 9]}):
            with self.subTest(ranks=ranks):
                self.assert_exact(make_state(ranks))

    def test_straight_flush_and_heavenly_ordering_match_legal_root_routes(self):
        state = make_state({"bot": [4, 5, 6, 7, 8], "opp": [9], "mate": [10], "opp2": [11]})
        state["players"]["bot"]["hand"] = [card for card in guandan._full_deck()
                                              if card["suit"] == "spades" and 4 <= (card["rank"] or 0) <= 8][:5]
        current = {"type": "bomb", "size": 5, "tier": 2, "rank_value": 60, "uses_wild": False}
        state["current_trick"] = {"player_id": "opp2", "cards": [], "combo": current}
        solver = self.assert_exact(state)
        self.assertTrue(any(len(action.get("card_ids") or []) == 5 for action in solver.root_actions()))
        state["current_trick"]["combo"] = {**current, "size": 6, "tier": 4}
        self.assertEqual(self.assert_exact(state).root_actions(), [{"type": "pass"}])
        state["players"]["bot"]["hand"] = [card for card in guandan._full_deck() if card.get("joker")]
        solver = self.assert_exact(state)
        self.assertTrue(any(len(action.get("card_ids") or []) == 4 for action in solver.root_actions()))

    def test_transposition_bounds_are_not_treated_as_exact_values(self):
        state = make_state({"bot": [4, 4, 3], "opp": [5, 5, 8],
                            "mate": [6, 6, 9], "opp2": [7, 7, 10]})
        actions = legal_actions(state)
        expected = EndgameSolver(guandan, state, "bot").root_values(actions)
        for alpha, beta in ((-1.0, 1.0), (100.0, 101.0), (-201.0, -200.0)):
            solver = EndgameSolver(guandan, state, "bot")
            for action in reversed(actions):
                child = solver.transition(solver.initial, solver.action_move(action))
                solver.value(child, alpha, beta)
            self.assertEqual(solver.root_values(actions), expected)

    def test_duplicate_deck_copies_are_equivalent_but_invalid_ids_rejected(self):
        state = make_state({"bot": [4, 4], "opp": [5], "mate": [6], "opp2": [7]})
        copies = [card for card in guandan._full_deck() if card["rank"] == 4 and card["suit"] == "spades"]
        state["players"]["bot"]["hand"] = copies
        solver = self.assert_exact(state)
        singles = [action for action in solver.root_actions() if len(action.get("card_ids", [])) == 1]
        self.assertEqual(len(singles), 1)
        for action in (play([copies[0]["id"]] * 2), play([copies[0]["id"], -1]),
                       play([]), {"type": "pass"}, {"type": "other"}):
            with self.subTest(action=action), self.assertRaises(ValueError):
                solver.root_values([action])

    def test_rank_equivalent_cards_merge_only_without_a_straight_flush_route(self):
        state = make_state({"bot": [4, 4, 4, 7], "opp": [5], "mate": [6], "opp2": [8]})
        solver = self.assert_exact(state)
        four_ids = {card["id"] for card in state["players"]["bot"]["hand"] if card["rank"] == 4}
        singles = [action for action in solver.root_actions()
                   if len(action.get("card_ids") or []) == 1 and action["card_ids"][0] in four_ids]
        self.assertEqual(len(singles), 1)
        state = make_state({"bot": [4, 4, 5, 6, 7, 8], "opp": [9], "mate": [10], "opp2": [11]})
        solver = self.assert_exact(state)
        four_ids = {card["id"] for card in state["players"]["bot"]["hand"] if card["rank"] == 4}
        singles = [action for action in solver.root_actions()
                   if len(action.get("card_ids") or []) == 1 and action["card_ids"][0] in four_ids]
        self.assertEqual(len(singles), 2)

    def test_level_wildcard_does_not_merge_with_ordinary_level_card(self):
        state = make_state({"bot": [2, 3, 3], "opp": [4], "mate": [5], "opp2": [6]})
        wildcard = next(card for card in guandan._full_deck() if card["rank"] == 2 and card["suit"] == "hearts")
        state["players"]["bot"]["hand"].append(wildcard)
        solver = self.assert_exact(state)
        natural = next(card for card in state["players"]["bot"]["hand"]
                       if card["rank"] == 2 and card["suit"] != "hearts")
        wild_move = solver.action_move(play([wildcard["id"]]))
        natural_move = solver.action_move(play([natural["id"]]))
        self.assertNotEqual(solver.transition(solver.initial, wild_move)[0],
                            solver.transition(solver.initial, natural_move)[0])

    def test_large_but_grouped_hand_has_complete_root_coverage(self):
        state = make_state({"bot": [4] * 6 + [6] * 6 + [8], "opp": [9], "mate": [10], "opp2": [11]})
        solver = EndgameSolver(guandan, state, "bot")
        self.assertEqual({solver.action_move(action) for action in solver.root_actions()},
                         {solver.action_move(action) for action in legal_actions(state)})
        self.assertLess(len(solver.canonical_masks[0].cache), 8192)

    def test_unbounded_physical_subsets_still_abort_atomically(self):
        state = make_state({"bot": [3], "opp": [4], "mate": [5], "opp2": [6]})
        hand = [card for card in guandan._full_deck() if card["suit"] == "spades" and card["id"] < 54]
        hand.append(next(card for card in guandan._full_deck() if card["suit"] == "hearts" and card["rank"] == 2))
        deck = [card for card in guandan._full_deck() if card["id"] not in {chosen["id"] for chosen in hand}]
        state["players"]["bot"]["hand"] = hand
        for index, actor in enumerate(("opp", "mate", "opp2")):
            state["players"][actor]["hand"] = [deck[index]]
        with self.assertRaisesRegex(IncompleteEndgame, "hand_limit"):
            EndgameSolver(guandan, state, "bot")

    def test_wild_six_card_reply_uses_steel_plate_interpretation(self):
        state = make_state({"bot": [5, 5, 6, 6, 7, 7], "opp": [8], "mate": [9], "opp2": [10]})
        labels = ["♠️5", "♥️5", "♣️6", "♦️6", "♥️2", "♥️2"]
        deck = guandan._full_deck()
        hand = []
        for label in labels:
            card = next(card for card in deck if guandan._card_label(card) == label)
            deck.remove(card)
            hand.append(card)
        state["players"]["bot"]["hand"] = hand
        current = []
        for rank in (3, 3, 3, 4, 4, 4):
            card = next(card for card in deck if card["rank"] == rank)
            deck.remove(card)
            current.append(card)
        state["current_trick"] = {"player_id": "opp2", "cards": [card["id"] for card in current],
                                  "combo": guandan._evaluate_combo(current, 2, state["config"])}
        solver = self.assert_exact(state)
        move = solver.action_move(play([card["id"] for card in hand]))
        self.assertEqual(solver.combos[move[1]]["type"], "steel_plate")

    def test_bomb_ordering_and_hard_soft_tie_use_rule_engine(self):
        for hard in (False, True):
            state = make_state({"bot": [6, 6, 6, 6, 8], "opp": [9], "mate": [10], "opp2": [11]})
            state["config"]["hard_bomb_beats_soft"] = hard
            current = {"type": "bomb", "size": 4, "tier": 1, "rank_value": guandan._point_order_value(6, 2),
                       "uses_wild": True}
            state["current_trick"] = {"player_id": "opp2", "combo": current, "cards": []}
            solver = self.assert_exact(state)
            actions = solver.root_actions()
            has_bomb = any(len(action.get("card_ids", [])) == 4 for action in actions)
            self.assertEqual(has_bomb, hard)
        state["current_trick"]["combo"] = {"type": "heavenly", "size": 4, "tier": 9}
        self.assertEqual(self.assert_exact(state).root_actions(), [{"type": "pass"}])

    def test_deadline_and_node_limit_never_return_partial_panel(self):
        state = make_state({"bot": [3, 3, 8], "opp": [4, 4], "mate": [5, 9], "opp2": [6, 7]})
        with mock.patch("game.guandan_endgame.time.perf_counter", return_value=10.0):
            with self.assertRaisesRegex(IncompleteEndgame, "deadline"):
                EndgameSolver(guandan, state, "bot", deadline=10.0)
        solver = EndgameSolver(guandan, state, "bot", node_limit=1)
        actions = solver.root_actions()
        with self.assertRaisesRegex(IncompleteEndgame, "node_limit"):
            solver.root_values(actions)
        solver.node_limit = 500000
        self.assertEqual(solver.root_values(actions), EndgameSolver(guandan, state, "bot").root_values(actions))
        solver.deadline = 10.0
        with mock.patch("game.guandan_endgame.time.perf_counter", return_value=10.0):
            with self.assertRaisesRegex(IncompleteEndgame, "deadline"):
                solver.root_values(actions)


class GuandanPublicExactTests(unittest.TestCase):
    def setUp(self):
        self.state = make_state({"bot": [4, 4, 13, 13, 9], "opp": [10, 10, 3],
                                 "mate": [6, 6, 8], "opp2": [7, 7, 11]})
        self.state.pop("_ai_sampled_world")
        self.state["config"].update(bot_mode="auto", bot_exact_endgame_enabled=True,
                                     bot_exact_endgame_public_only=False,
                                     bot_exact_endgame_worlds=4, bot_exact_endgame_time_ms=10000)
        self.reference = play(pair(self.state, "bot", 4))
        self.proposal = play(pair(self.state, "bot", 13))

    def panel(self, confirmation_gain=100.0, fail_confirmation=False):
        phases = []

        def worlds(state, observer, count, budget, phase):
            phases.append(phase)
            return [{"phase": phase, "index": index} for index in range(count)]

        class FakeSolver:
            nodes = 7
            hits = 2

            def __init__(solver, rules, world, observer, deadline, node_limit):
                solver.world = world

            def root_actions(solver):
                return [self.reference, self.proposal]

            def root_values(solver, actions):
                if fail_confirmation and solver.world["phase"] == "exact_confirmation":
                    raise IncompleteEndgame("deadline")
                gain = 100.0 if solver.world["phase"] == "exact_selection" else confirmation_gain
                return [gain if action == self.proposal else 0.0 for action in actions]

        with mock.patch.object(guandan_trick, "public_worlds", side_effect=worlds), \
                mock.patch.object(guandan_endgame, "_world_key", side_effect=lambda world: (world["phase"], world["index"])), \
                mock.patch.object(guandan_endgame, "EndgameSolver", FakeSolver):
            panel = guandan_endgame.compare_actions(guandan, self.state, "bot", self.reference)
        self.assertEqual(phases, ["exact_selection", "exact_confirmation"])
        return panel

    def test_independent_confirmation_is_required_before_override(self):
        panel = self.panel()
        self.assertEqual(panel["status"], "complete")
        self.assertTrue(panel["applied"])
        self.assertEqual(panel["selected"], self.proposal)
        self.assertEqual(panel["completed_worlds"], 8)
        self.assertTrue(panel["verification"]["passed"])
        for confirmation_gain in (0.0, -100.0):
            panel = self.panel(confirmation_gain)
            self.assertEqual(panel["status"], "complete")
            self.assertTrue(panel["applied"])
            self.assertFalse(panel["changed"])
            self.assertFalse(panel["verification"]["passed"])
            self.assertEqual(panel["selected"], self.reference)

    def test_partial_confirmation_is_diagnostic_only(self):
        panel = self.panel(fail_confirmation=True)
        self.assertEqual(panel["status"], "incomplete")
        self.assertEqual(panel["reason"], "deadline")
        self.assertFalse(panel["applied"])
        self.assertNotIn("selected", panel)
        self.assertEqual(panel["nodes"], 35)
        self.assertEqual(panel["completed_worlds"], 4)

    def test_hidden_faces_and_private_memory_do_not_affect_panel(self):
        baseline = guandan_endgame.compare_actions(guandan, self.state, "bot", self.reference)
        changed = copy.deepcopy(self.state)
        for actor in ("opp", "mate", "opp2"):
            changed["players"][actor]["hand"] = [None] * len(changed["players"][actor]["hand"])
        changed["round_memories"][0]["initial_hands"] = {"secret": object()}
        changed["round_memories"][0]["final_hands"] = {"secret": object()}
        changed["bot_explain"] = {"secret": object()}
        panel = guandan_endgame.compare_actions(guandan, changed, "bot", self.reference)
        baseline.pop("elapsed_ms")
        panel.pop("elapsed_ms")
        self.assertEqual(baseline["status"], "complete")
        self.assertEqual(panel, baseline)

    def test_outside_scope_skips_before_sampling(self):
        self.state["config"]["bot_exact_endgame_max_cards"] = 4
        with mock.patch.object(guandan_trick, "public_worlds", side_effect=AssertionError("out of scope")):
            panel = guandan_endgame.compare_actions(guandan, self.state, "bot", self.reference)
        self.assertEqual(panel["status"], "skipped")

    def test_validated_auto_terminal_comparison_is_default(self):
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_mode"], "auto")
        self.assertTrue(guandan.DEFAULT_CONFIG["bot_exact_endgame_enabled"])
        self.assertTrue(guandan.DEFAULT_CONFIG["bot_exact_endgame_public_only"])
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_exact_endgame_max_cards"], 24)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_exact_endgame_time_ms"], 2500)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_exact_endgame_node_limit"], 500000)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_minimax_exact_time_ms"], 1200)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_minimax_particles"], 12)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_think_time_ms"], 6000)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_think_overrun_ratio"], 0.0)
        self.assertEqual(guandan.DEFAULT_CONFIG["bot_trick_boundary_mode"], "off")

    def test_auto_uses_confirmed_action_without_legacy_units_or_post_rewrite(self):
        panel = self.panel()
        with mock.patch.object(guandan, "_heuristic_best_action", return_value=self.reference), \
                mock.patch.object(guandan_endgame, "compare_actions", return_value=panel), \
                mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("legacy search")), \
                mock.patch.object(guandan, "_prefer_bomb_closeout_upgrade", side_effect=AssertionError("rewrite")):
            action = guandan.GuandanGame.bot_move(self.state, "bot")
        self.assertEqual(action, self.proposal)
        explanation = self.state["bot_explain"]["bot"]
        self.assertEqual(explanation["method"], "exact_endgame")
        self.assertEqual(explanation["score_model"], "sampled_terminal")
        self.assertEqual(explanation["chosen"]["components"], {"sampled_terminal_team_value": 100.0})

    def test_incomplete_panel_falls_back_to_existing_auto_search(self):
        panel = self.panel(fail_confirmation=True)
        with mock.patch.object(guandan, "_heuristic_best_action", return_value=self.reference), \
                mock.patch.object(guandan_endgame, "compare_actions", return_value=panel), \
                mock.patch.object(guandan, "_public_endgame_closeout_action", return_value=None), \
                mock.patch.object(guandan, "_minimax_pick_action", return_value=self.reference) as minimax:
            action = guandan.GuandanGame.bot_move(self.state, "bot")
        self.assertEqual(minimax.call_count, 1)
        self.assertEqual(action, self.reference)
        self.assertEqual(self.state["bot_explain"]["bot"]["method_details"]["exact_endgame"]["status"], "incomplete")

    def test_completed_reference_is_not_replaced_by_a_second_search(self):
        panel = self.panel(confirmation_gain=0.0)
        with mock.patch.object(guandan, "_heuristic_best_action", return_value=self.reference), \
                mock.patch.object(guandan_endgame, "compare_actions", return_value=panel), \
                mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("second search")):
            action = guandan.GuandanGame.bot_move(self.state, "bot")
        self.assertEqual(action, self.reference)
        self.assertEqual(self.state["bot_explain"]["bot"]["method"], "exact_endgame")


class GuandanExactSettledTests(unittest.TestCase):
    def state(self, level=14, require_partner=False):
        state = make_state({"bot": [4, 4, 9], "opp": [3], "mate": [5, 8], "opp2": [7, 10]})
        state["dealer_team"] = "B"
        state["level_rank"] = level
        for team in state["teams"].values():
            team["level"] = level
        state["config"].update(bot_mode="auto", bot_exact_endgame_enabled=True,
                               bot_exact_endgame_public_only=False,
                               require_partner_not_last_for_a=require_partner)
        state["current_turn"] = "opp"
        _, error = guandan.GuandanGame.apply_action(state, "opp", play([state["players"]["opp"]["hand"][0]["id"]]))
        self.assertIsNone(error)
        state["current_turn"] = "bot"
        state.pop("_ai_sampled_world")
        return state

    def test_publicly_settled_match_does_not_block_existing_policy(self):
        state = self.state()
        for actor in ("opp", "mate", "opp2"):
            state["players"][actor]["hand"] = [None] * len(state["players"][actor]["hand"])
        with mock.patch.object(guandan_trick, "public_worlds", side_effect=AssertionError("settled")):
            result = guandan_endgame.compare_actions(guandan, state, "bot", {"type": "pass"})
        self.assertEqual(result["status"], "skipped")
        self.assertEqual(result["reason"], "settled_team_value")
        self.assertFalse(result["applied"])

    def test_upgrade_points_and_partner_requirement_still_need_comparison(self):
        for level, require_partner in ((2, False), (13, True), (14, True)):
            with self.subTest(level=level, require_partner=require_partner):
                state = self.state(level, require_partner)
                with mock.patch.object(guandan_trick, "public_worlds", side_effect=guandan_trick.IncompleteTrick("probe")) as sampler:
                    result = guandan_endgame.compare_actions(guandan, state, "bot", {"type": "pass"})
                self.assertEqual(sampler.call_count, 1)
                self.assertEqual(result["reason"], "probe")


class GuandanFinishCoverTests(unittest.TestCase):
    def state(self, dealer_team="A"):
        state = make_state({"bot": [4, 4, 4, 4], "opp": [10], "mate": [5, 5, 9, 3], "opp2": [8]})
        state["dealer_team"] = dealer_team
        state["current_turn"] = "mate"
        for actor, action in (("mate", play(pair(state, "mate", 5))), ("opp2", {"type": "pass"})):
            _, error = guandan.GuandanGame.apply_action(state, actor, action)
            self.assertIsNone(error)
        state.pop("_ai_sampled_world")
        state["config"].update(bot_mode="auto", bot_exact_endgame_enabled=True)
        state["known_card_owners"] = {
            card["id"]: actor for actor in ("opp", "mate", "opp2") for card in state["players"][actor]["hand"]
        }
        return state

    def test_finishing_immediately_can_sacrifice_a_double_finish(self):
        state = self.state()
        finish = play([card["id"] for card in state["players"]["bot"]["hand"]])
        solver = guandan_endgame.EndgameSolver(guandan, state, "bot")
        self.assertEqual(solver.root_values([finish, {"type": "pass"}]), [100.0, 300.0])

    def test_publicly_confirmed_cover_can_delay_an_otherwise_immediate_finish(self):
        state = self.state()
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action, {"type": "pass"})
        explanation = state["bot_explain"]["bot"]
        self.assertEqual(explanation["method"], "exact_endgame")
        self.assertFalse(explanation["method_details"]["forced_action"])
        self.assertEqual(explanation["method_details"]["search_stop_reason"], "exact_finish_comparison")
        panel = explanation["method_details"]["exact_endgame"]
        self.assertEqual(panel["verification"]["reason"], "public_hands_determined")
        self.assertEqual(panel["completed_worlds"], 1)
        self.assertTrue(panel["changed"])
        self.assertEqual(explanation["chosen"]["components"], {"proven_terminal_team_value": 300.0})
        self.assertIn("exact_endgame", explanation["timing"]["stages_ms"])

    def test_uncertain_public_cover_keeps_the_guaranteed_first_finish(self):
        state = self.state()
        state["known_card_owners"] = {}
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(set(action["card_ids"]), {card["id"] for card in state["players"]["bot"]["hand"]})
        panel = state["bot_explain"]["bot"]["method_details"]["exact_endgame"]
        self.assertFalse(panel["changed"])

    def test_incomplete_finish_comparison_keeps_finish_without_shallow_rewrite(self):
        state = self.state()
        expected = play([card["id"] for card in state["players"]["bot"]["hand"]])
        panel = {"status": "incomplete", "applied": False, "reason": "deadline"}
        with mock.patch.object(guandan_endgame, "compare_actions", return_value=panel), \
                mock.patch.object(guandan, "_heuristic_best_action", side_effect=AssertionError("unsafe fallback")), \
                mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("unsafe fallback")):
            self.assertEqual(guandan.GuandanGame.bot_move(state, "bot"), expected)
        explanation = state["bot_explain"]["bot"]
        self.assertTrue(explanation["method_details"]["forced_action"])
        self.assertEqual(explanation["method_details"]["exact_endgame"], panel)
        self.assertTrue(explanation["timing"]["fallback_used"])
        self.assertTrue(explanation["timing"]["deadline_limited"])

    def test_node_limit_fallback_is_not_reported_as_deadline_expiry(self):
        state = self.state()
        panel = {"status": "incomplete", "applied": False, "reason": "node_limit"}
        with mock.patch.object(guandan_endgame, "compare_actions", return_value=panel):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(set(action["card_ids"]), {card["id"] for card in state["players"]["bot"]["hand"]})
        timing = state["bot_explain"]["bot"]["timing"]
        self.assertTrue(timing["fallback_used"])
        self.assertFalse(timing["deadline_limited"])

    def test_forced_pass_never_runs_a_finish_comparison(self):
        state = self.state()
        state["current_turn"] = "opp"
        with mock.patch.object(guandan_endgame, "compare_actions", side_effect=AssertionError("forced pass")):
            self.assertEqual(guandan.GuandanGame.bot_move(state, "opp"), {"type": "pass"})

    def test_disabled_exact_policy_retains_the_existing_finish_fast_path(self):
        state = self.state()
        state["config"]["bot_exact_endgame_enabled"] = False
        with mock.patch.object(guandan_endgame, "compare_actions", side_effect=AssertionError("disabled")):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(set(action["card_ids"]), {card["id"] for card in state["players"]["bot"]["hand"]})
        self.assertTrue(state["bot_explain"]["bot"]["method_details"]["forced_action"])

    def test_guaranteed_match_win_skips_sampling_but_partner_rule_can_require_it(self):
        state = self.state(dealer_team="A")
        state["teams"][state["player_teams"]["bot"]]["level"] = 14
        state["level_rank"] = 14
        expected = play([card["id"] for card in state["players"]["bot"]["hand"]])
        with mock.patch("game.guandan_trick.public_worlds", side_effect=AssertionError("settled match")):
            self.assertEqual(guandan.GuandanGame.bot_move(state, "bot"), expected)
        panel = state["bot_explain"]["bot"]["method_details"]["exact_endgame"]
        self.assertEqual(panel["reason"], "maximal_team_finish")
        state["config"]["require_partner_not_last_for_a"] = True
        self.assertFalse(guandan_endgame._finish_is_maximal(guandan, state, "bot", expected))

    def test_non_dealer_parked_at_a_still_compares_cover(self):
        state = self.state(dealer_team="B")
        state["teams"]["A"]["level"] = 14
        expected = play([card["id"] for card in state["players"]["bot"]["hand"]])
        self.assertFalse(guandan_endgame._finish_is_maximal(guandan, state, "bot", expected))
        self.assertEqual(guandan.GuandanGame.bot_move(state, "bot"), {"type": "pass"})
        panel = state["bot_explain"]["bot"]["method_details"]["exact_endgame"]
        self.assertEqual(panel["reason"], "publicly_proven_change")
        self.assertEqual(panel["paired_gain"], 200.0)

    def test_reaching_a_still_compares_cover_for_a_double_finish(self):
        state = self.state()
        state["teams"]["A"]["level"] = 13
        state["level_rank"] = 13
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action, {"type": "pass"})
        panel = state["bot_explain"]["bot"]["method_details"]["exact_endgame"]
        self.assertEqual(panel["reason"], "publicly_proven_change")
        self.assertEqual(panel["paired_gain"], 200.0)

    def test_partner_first_finish_is_already_maximal_without_reading_hidden_cards(self):
        state = self.state()
        state["finish_order"] = ["mate"]
        state["players"]["mate"].update(hand=[], finished=True, finish_rank=1)
        for actor in ("opp", "opp2"):
            state["players"][actor]["hand"] = [None]
        expected = play([card["id"] for card in state["players"]["bot"]["hand"]])
        with mock.patch("game.guandan_trick.public_worlds", side_effect=AssertionError("settled team")):
            self.assertEqual(guandan.GuandanGame.bot_move(state, "bot"), expected)

    def test_cover_decision_cannot_read_real_hidden_faces(self):
        state = self.state()
        changed = copy.deepcopy(state)
        for actor in ("opp", "mate", "opp2"):
            changed["players"][actor]["hand"] = [None] * len(changed["players"][actor]["hand"])
        self.assertEqual(guandan.GuandanGame.bot_move(changed, "bot"), {"type": "pass"})

    def test_repeated_independent_draws_reuse_exact_values_without_resampling(self):
        state = self.state()
        state["config"]["bot_exact_endgame_worlds"] = 8
        state["config"]["bot_exact_endgame_public_only"] = False
        reference = play([card["id"] for card in state["players"]["bot"]["hand"]])
        with mock.patch.object(guandan_endgame, "_public_hands_determined", return_value=False), \
                mock.patch.object(guandan_endgame, "EndgameSolver", wraps=guandan_endgame.EndgameSolver) as solver:
            panel = guandan_endgame.compare_actions(guandan, state, "bot", reference)
        self.assertEqual(solver.call_count, 1)
        self.assertEqual(panel["completed_worlds"], 16)
        self.assertEqual(panel["distinct_worlds"], 1)
        self.assertEqual(panel["reused_worlds"], 15)
        self.assertTrue(panel["changed"])
        self.assertEqual(len(panel["verification"]["candidates"][0]["world_values"]), 8)

    def test_world_cache_distinguishes_card_ownership_not_hand_list_order(self):
        state = self.state()
        changed = copy.deepcopy(state)
        for actor in changed["turn_order"]:
            changed["players"][actor]["hand"].reverse()
        self.assertEqual(guandan_endgame._world_key(state), guandan_endgame._world_key(changed))
        changed["players"]["opp"]["hand"], changed["players"]["opp2"]["hand"] = (
            changed["players"]["opp2"]["hand"], changed["players"]["opp"]["hand"])
        self.assertNotEqual(guandan_endgame._world_key(state), guandan_endgame._world_key(changed))


def make_public_hands(hands, level=7):
    state = make_state({actor: [3] for actor in hands})
    pool = guandan._full_deck()
    for actor, labels in hands.items():
        identifiers = set(pick_card_ids(pool, labels))
        state["players"][actor]["hand"] = [card for card in pool if card["id"] in identifiers]
        pool = [card for card in pool if card["id"] not in identifiers]
    state.update(level_rank=level, seen_cards=[card["id"] for card in pool], round_memories=[])
    for team in state["teams"].values():
        team["level"] = level
    state.pop("_ai_sampled_world")
    return state


class GuandanPublicProofTests(unittest.TestCase):
    def duel(self):
        state = make_state({"bot": [4, 4, 3], "opp": [5, 6], "mate": [], "opp2": []})
        state.pop("_ai_sampled_world")
        state["finish_order"] = ["mate", "opp2"]
        for rank, actor in enumerate(state["finish_order"], 1):
            state["players"][actor].update(finished=True, finish_rank=rank)
        state["config"]["bot_mode"] = "auto"
        return state

    def test_two_active_hands_are_deduced_without_server_hidden_cards(self):
        state = self.duel()
        state["players"]["opp"]["hand"] = [None, None]
        reference = play([card["id"] for card in state["players"]["bot"]["hand"] if card["rank"] == 3])
        before = copy.deepcopy(state)
        with mock.patch.object(guandan_trick, "public_worlds", wraps=guandan_trick.public_worlds) as sampler:
            panel = guandan_endgame.compare_actions(guandan, state, "bot", reference)
        self.assertEqual(state, before)
        self.assertEqual(sampler.call_count, 1)
        self.assertEqual(sampler.call_args[0][2], 1)
        self.assertEqual(panel["scope"], "public_determined_endgame")
        self.assertEqual(panel["paired_gain"], 100.0)
        self.assertEqual(panel["selected"], play(pair(state, "bot", 4)))
        self.assertEqual(panel["reason"], "publicly_proven_change")

    def test_proven_action_survives_legacy_search_and_explains_exact_value(self):
        state = self.duel()
        with mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("shallow search")):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action, play(pair(state, "bot", 4)))
        explanation = state["bot_explain"]["bot"]
        self.assertEqual(explanation["score_model"], "proven_terminal")
        self.assertEqual(explanation["chosen"]["components"], {"proven_terminal_team_value": 200.0})

    def test_unknown_ownership_skips_before_sampling(self):
        state = make_state({"bot": [4, 4, 3], "opp": [5], "mate": [6], "opp2": [7]})
        state["config"].update(bot_exact_endgame_enabled=True, bot_exact_endgame_public_only=True)
        with mock.patch.object(guandan_trick, "public_worlds", side_effect=AssertionError("uncertain")):
            panel = guandan_endgame.compare_actions(guandan, state, "bot", play(pair(state, "bot", 4)))
        self.assertEqual(panel["reason"], "unresolved_hidden_ownership")
        self.assertFalse(panel["applied"])

    def test_known_owner_aliases_do_not_invent_a_complete_hand(self):
        state = make_state({"bot": [3], "opp": [4, 4], "mate": [5], "opp2": [6]})
        identifier = state["players"]["opp"]["hand"][0]["id"]
        mate_card = state["players"]["mate"]["hand"][0]["id"]
        state["known_card_owners"] = {identifier: "opp", str(identifier): "opp", mate_card: "mate"}
        self.assertFalse(guandan_endgame._public_hands_determined(state, "bot"))
        state["known_card_owners"][state["players"]["opp"]["hand"][1]["id"]] = "opp"
        self.assertTrue(guandan_endgame._public_hands_determined(state, "bot"))
        state["known_card_owners"][str(identifier)] = "opp2"
        self.assertFalse(guandan_endgame._public_hands_determined(state, "bot"))

    def test_inconsistent_public_partition_cannot_produce_a_proof(self):
        state = self.duel()
        state["seen_cards"].pop()
        panel = guandan_endgame.compare_actions(guandan, state, "bot", play(pair(state, "bot", 4)))
        self.assertEqual(panel["status"], "incomplete")
        self.assertEqual(panel["reason"], "inconsistent_public_counts")
        self.assertFalse(panel["applied"])

    def test_observed_duel_saves_a_joker_to_avoid_losing_an_upgrade_point(self):
        state = make_public_hands({
            "bot": ("♠️2", "🃏S", "♦️2", "♥️7", "♠️J", "♣️J", "🃏S", "♥️2", "♦️J", "♣️8"),
            "opp": ("♠️10", "♦️7", "♠️7", "♣️10", "♦️10", "♦️10"),
            "mate": (), "opp2": (),
        })
        state["finish_order"] = ["opp2", "mate"]
        for rank, actor in enumerate(state["finish_order"], 1):
            state["players"][actor].update(finished=True, finish_rank=rank)
        state["current_trick"] = {"player_id": "opp", "cards": [],
                                  "combo": {"type": "single", "size": 1, "rank_value": 70}}
        state["config"].update(bot_exact_endgame_enabled=True, bot_exact_endgame_public_only=True)
        state["players"]["opp"]["hand"] = [None] * 6
        panel = guandan_endgame.compare_actions(guandan, state, "bot", {"type": "pass"})
        self.assertEqual(panel["reason"], "publicly_proven_change")
        self.assertEqual(panel["paired_gain"], 100.0)
        self.assertEqual(panel["scope"], "public_determined_endgame")


class GuandanBombHandoffTests(unittest.TestCase):
    def state(self):
        state = make_public_hands({
            "bot": ("♠️6", "♦️6", "♦️8", "♦️6", "♥️7", "♣️6", "♠️8"),
            "opp": ("♠️2", "♥️2"),
            "mate": ("♠️Q", "♥️5", "♥️5", "♠️5", "♦️Q", "♣️Q", "♦️4"),
            "opp2": ("♦️7", "♦️3", "♠️K", "♠️7", "♦️K", "♠️3", "♣️10"),
        })
        state["current_trick"] = {"player_id": "opp", "cards": [],
                                  "combo": {"type": "bomb", "size": 4, "tier": 1,
                                            "rank": 3, "rank_value": 50, "uses_wild": True}}
        return state

    def test_guaranteed_bomb_hold_keeps_the_wildcard_for_team_handoff(self):
        state = self.state()
        hand = state["players"]["bot"]["hand"]
        natural = [card["id"] for card in hand if card["rank"] == 6]
        upgraded = natural + pick_card_ids(hand, ("♥️7",))
        solver = guandan_endgame.EndgameSolver(guandan, state, "bot")
        self.assertEqual(solver.root_values([play(natural), play(upgraded)]), [300.0, 200.0])
        protected = copy.deepcopy(state)
        for actor in ("opp", "mate", "opp2"):
            protected["players"][actor]["hand"] = [None] * len(protected["players"][actor]["hand"])
        self.assertEqual(guandan._prefer_bomb_closeout_upgrade(protected, "bot", natural), natural)
        self.assertEqual(guandan_ai.call(guandan, "_bomb_closeout_bases", protected, "bot", upgraded), [])


class GuandanRetainedTailSamplingTests(unittest.TestCase):
    def state(self):
        state = make_state({"bot": [3], "opp": [4, 4, 9], "mate": [5], "opp2": [6]})
        state["current_turn"] = "opp"
        card = next(card for card in state["players"]["opp"]["hand"] if card["rank"] == 9)
        _, error = guandan.GuandanGame.apply_action(state, "opp", play([card["id"]]))
        self.assertIsNone(error)
        state.pop("_ai_sampled_world")
        state["current_turn"] = "bot"
        state["config"].update(bot_determinize_samples=2, bot_determinize_short_budget_samples=2,
                               bot_determinize_temperature=1.25,
                               bot_determinize_retained_group_odds=1.0,
                               bot_determinize_group_proposal_fraction=0.0)
        return state

    def draw(self, state):
        deck = {card["id"]: card for card in guandan._full_deck()}
        own = {card["id"] for card in state["players"]["bot"]["hand"]}
        unseen = set(deck) - set(state["seen_cards"]) - own
        fours = sorted(identifier for identifier in unseen if deck[identifier]["rank"] == 4)
        five = next(identifier for identifier in unseen if deck[identifier]["rank"] == 5)
        six = next(identifier for identifier in unseen if deck[identifier]["rank"] == 6)
        proposals = iter(([fours[0], five, fours[1], six], [*fours, five, six]))
        generator = mock.Mock()
        generator.shuffle.side_effect = lambda cards: cards.__setitem__(slice(None), next(proposals))
        generator.random.return_value = 0.2
        with mock.patch.object(guandan_ai._CORE_LOCAL, "determinize_sampling_budget", 0.0, create=True), \
                mock.patch.object(guandan_ai, "_pass_limit_penalty_for_hand", return_value=0.0), \
                mock.patch.object(guandan_ai, "_revealed_rank_cap_penalty_for_hand", return_value=0.0), \
                mock.patch.object(guandan_ai, "_public_action_line_penalty_for_hand", return_value=0.0):
            return guandan._determinize_state(state, "bot", generator)

    def test_observed_tail_receives_soft_group_odds_when_configured(self):
        state = self.state()
        before = copy.deepcopy(state)
        ordinary = self.draw(state)
        self.assertEqual([card["rank"] for card in ordinary["players"]["opp"]["hand"]], [4, 5])
        self.assertEqual(state, before)
        state["config"]["bot_determinize_retained_group_odds"] = 16.0
        retained = self.draw(state)
        self.assertEqual([card["rank"] for card in retained["players"]["opp"]["hand"]], [4, 4])

    def test_no_or_stale_public_tail_evidence_does_not_receive_group_odds(self):
        original = self.state()
        original["config"]["bot_determinize_retained_group_odds"] = 16.0
        for stale in (False, True):
            with self.subTest(stale=stale):
                state = copy.deepcopy(original)
                if stale:
                    for trick in state["round_memories"][-1]["tricks"]:
                        for action in trick.get("actions", []):
                            action["hand_count_after"] = 3
                else:
                    state["round_memories"] = []
                world = self.draw(state)
                self.assertEqual([card["rank"] for card in world["players"]["opp"]["hand"]], [4, 5])

    def test_group_odds_never_read_real_hidden_faces(self):
        state = self.state()
        state["config"]["bot_determinize_retained_group_odds"] = 16.0
        expected = self.draw(state)
        for actor in ("opp", "mate", "opp2"):
            state["players"][actor]["hand"] = [None] * len(state["players"][actor]["hand"])
        self.assertEqual(self.draw(state)["players"], expected["players"])

    def test_sampled_partition_locks_and_independent_phases_survive_weighting(self):
        state = self.state()
        state["config"].update(bot_determinize_retained_group_odds=16.0,
                               bot_determinize_samples=16, bot_determinize_short_budget_samples=16)
        locked = state["players"]["opp"]["hand"][0]["id"]
        state["known_card_owners"] = {str(locked): "opp"}
        before = copy.deepcopy(state)
        selection = guandan_trick.public_worlds(state, "bot", 16, guandan_trick.TrickBudget(), "exact_selection")
        confirmation = guandan_trick.public_worlds(state, "bot", 16, guandan_trick.TrickBudget(), "exact_confirmation")
        repeat = guandan_trick.public_worlds(state, "bot", 16, guandan_trick.TrickBudget(), "exact_selection")
        self.assertEqual(state, before)
        self.assertEqual([guandan_endgame._world_key(world) for world in selection],
                         [guandan_endgame._world_key(world) for world in repeat])
        self.assertNotEqual([guandan_endgame._world_key(world) for world in selection],
                            [guandan_endgame._world_key(world) for world in confirmation])
        expected_ids = set(range(108)) - set(state["seen_cards"])
        for world in selection + confirmation:
            identifiers = [card["id"] for data in world["players"].values() for card in data["hand"]]
            self.assertEqual(len(identifiers), len(set(identifiers)))
            self.assertEqual(set(identifiers), expected_ids)
            self.assertIn(locked, [card["id"] for card in world["players"]["opp"]["hand"]])

    def test_exact_sampling_configuration_does_not_leak_into_fallback(self):
        state = self.state()
        state["config"]["bot_exact_endgame_enabled"] = True
        state["config"]["bot_exact_endgame_public_only"] = False
        before = copy.deepcopy(state)
        with mock.patch.object(guandan_trick, "public_worlds", side_effect=guandan_trick.IncompleteTrick("probe")) as sampler:
            result = guandan_endgame.compare_actions(guandan, state, "bot", {"type": "pass"})
        self.assertEqual(result["reason"], "probe")
        config = sampler.call_args[0][0]["config"]
        self.assertEqual(config["bot_determinize_samples"], 64)
        self.assertEqual(config["bot_determinize_short_budget_samples"], 64)
        self.assertEqual(config["bot_determinize_retained_group_odds"], 16.0)
        self.assertEqual(state, before)


if __name__ == "__main__":
    unittest.main()
