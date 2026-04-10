import random
import unittest
from unittest import mock

from game import guandan


class GuandanBotBombAvoidanceTests(unittest.TestCase):
    def _make_state(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"

        deck = guandan._full_deck()
        big = next(card for card in deck if card.get("joker") == "big")
        small = next(card for card in deck if card.get("joker") == "small")
        nines = [card for card in deck if card.get("rank") == 9 and not card.get("joker")][:4]

        state["players"]["bot"]["hand"] = [big] + nines
        for pid in state["players"]:
            if pid != "bot":
                state["players"][pid]["hand"] = []

        combo = guandan._evaluate_combo([small], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [small["id"]],
            "combo": combo,
        }
        return state, big

    def _make_pass_state(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0
        state["config"]["bot_mcts_depth"] = 0
        state["config"]["bot_mcts_sims"] = 10

        deck = guandan._full_deck()
        big = next(card for card in deck if card.get("joker") == "big")
        bomb_cards = [card for card in deck if card.get("rank") == 9 and not card.get("joker")][:4]
        combo = guandan._evaluate_combo(bomb_cards, state["level_rank"], state.get("config", {}))
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [card["id"] for card in bomb_cards],
            "combo": combo,
        }
        state["players"]["bot"]["hand"] = [big]

        used = {big["id"], *(card["id"] for card in bomb_cards)}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 5]
            idx += 5
        return state

    def _combo_type(self, state, cards):
        hand_map = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        combo_cards = [hand_map[cid] for cid in cards if cid in hand_map]
        combo = guandan._evaluate_combo(combo_cards, state["level_rank"], state.get("config", {}))
        return combo["type"] if combo else None

    def test_filter_overbomb_options_prefers_non_bomb(self):
        state, _ = self._make_state()
        options = guandan._list_hint_options(state, "bot")
        types = [self._combo_type(state, cards) for cards in options]
        self.assertIn("bomb", types)
        self.assertIn("single", types)

        filtered = guandan._filter_overbomb_options(state, "bot", options)
        filtered_types = [self._combo_type(state, cards) for cards in filtered]
        self.assertIn("single", filtered_types)
        self.assertNotIn("bomb", filtered_types)

    def test_filter_overbomb_actions_removes_bomb_plays(self):
        state, _ = self._make_state()
        actions = guandan._candidate_actions(state, "bot", 20)
        filtered = guandan._filter_overbomb_actions(state, "bot", actions)
        play_actions = [action for action in filtered if action.get("type") == "play"]
        self.assertTrue(play_actions)
        for action in play_actions:
            combo_type = self._combo_type(state, action.get("card_ids", []))
            self.assertNotEqual(combo_type, "bomb")

    def test_bot_select_play_avoids_bomb(self):
        state, big = self._make_state()
        chosen = guandan._bot_select_play(state, "bot", depth=3)
        self.assertEqual(chosen, [big["id"]])

    def test_lead_candidates_prune_early_bomb_when_strong_shapes_exist(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot"]["hand"] = [
            pick_label(label)
            for label in [
                "♠️2",
                "♦️2",
                "♠️K",
                "♦️J",
                "♦️10",
                "♠️9",
                "♠️9",
                "♣️9",
                "♥️6",
                "♦️6",
                "♠️5",
                "♣️5",
                "♦️5",
                "♦️5",
                "♠️4",
                "♣️4",
                "♠️3",
                "♥️3",
            ]
        ]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 18]
            idx += 18

        actions = guandan._candidate_actions(state, "bot", 6)
        play_actions = [action for action in actions if action.get("type") == "play"]
        play_types = [self._combo_type(state, action.get("card_ids", [])) for action in play_actions]
        self.assertNotIn("bomb", play_types)

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "play")
        self.assertNotEqual(self._combo_type(state, action.get("card_ids", [])), "bomb")

    def test_mcts_explain_includes_mcts_score(self):
        state, big = self._make_state()
        action = {"type": "play", "card_ids": [big["id"]]}
        method_scores = [
            (
                action,
                1.25,
                5,
                {"avg": 1.25, "adjusted": 1.1, "std": 0.5, "win_rate": 0.6, "min": 0.2, "max": 2.0},
            )
        ]
        explain = guandan._build_bot_explain(
            state,
            "bot",
            [big["id"]],
            "mcts",
            depth=3,
            method_scores=method_scores,
            method_meta={"sims_per_action": 5, "depth": 3, "candidates": 1},
        )
        self.assertEqual(explain.get("score_model"), "mcts")
        self.assertIn("mcts_avg", explain.get("chosen", {}).get("components", {}))
        self.assertAlmostEqual(explain["chosen"]["components"]["mcts_avg"], 1.25)
        self.assertIn("mcts_adjusted", explain.get("chosen", {}).get("components", {}))
        self.assertAlmostEqual(explain["chosen"]["components"]["mcts_adjusted"], 1.1)
        self.assertIn("mcts_win_rate", explain.get("chosen", {}).get("components", {}))
        self.assertIn("hand", explain)
        self.assertNotIn("🃏B", explain.get("hand", []))

    def test_mcts_pick_action_uses_risk_adjusted_score(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"

        action_a = {"type": "play", "card_ids": [11]}
        action_b = {"type": "play", "card_ids": [22]}
        values = {
            (11,): [10.0, 10.0, 10.0, -10.0],
            (22,): [4.0, 4.0, 4.0, 4.0],
        }
        counters = {(11,): 0, (22,): 0}

        def fake_apply_action(target_state, _player_id, action):
            target_state["branch"] = tuple(action.get("card_ids", []))
            return [], None

        def fake_tree_value(target_state, _bot_id, _ply, _width, _rollout_depth, alpha=-1e9, beta=1e9):
            del alpha, beta
            branch = target_state["branch"]
            idx = counters[branch]
            counters[branch] += 1
            return values[branch][idx]

        with mock.patch.object(guandan, "_candidate_actions", return_value=[action_a, action_b]):
            with mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts):
                with mock.patch.object(guandan, "_mcts_root_heuristic_value", return_value=0.0):
                    with mock.patch.object(guandan, "_determinize_state", side_effect=lambda s, _p, _r: {}):
                        with mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=fake_apply_action):
                            with mock.patch.object(guandan, "_mcts_reply_tree_value", side_effect=fake_tree_value):
                                picked, scored = guandan._mcts_pick_action(
                                    state,
                                    "bot",
                                    sims=8,
                                    depth=4,
                                    width=2,
                                    tree_ply=2,
                                    reply_width=2,
                                    risk_lambda=0.35,
                                )

        self.assertEqual(picked, action_b)
        stats = {tuple(item[0]["card_ids"]): item[3] for item in scored}
        self.assertGreater(stats[(11,)]["avg"], stats[(22,)]["avg"])
        self.assertLess(stats[(11,)]["adjusted"], stats[(22,)]["adjusted"])

    def test_mcts_single_candidate_short_circuits_rollout(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        only_action = {"type": "play", "card_ids": [11]}

        with mock.patch.object(guandan, "_candidate_actions", return_value=[only_action]):
            with mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts):
                with mock.patch.object(guandan, "_mcts_root_heuristic_value", return_value=3.5):
                    with mock.patch.object(guandan, "_mcts_reply_tree_value") as reply_tree:
                        picked, scored = guandan._mcts_pick_action(
                            state,
                            "bot",
                            sims=80,
                            depth=8,
                            width=4,
                            tree_ply=2,
                            reply_width=2,
                            risk_lambda=0.28,
                        )

        self.assertEqual(picked, only_action)
        self.assertEqual(scored[0][2], 0)
        self.assertEqual(scored[0][3]["depth"], 0)
        reply_tree.assert_not_called()

    def test_mcts_obvious_low_single_response_skips_rollout(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        lead = pick_label("♠️3")
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [lead["id"]],
            "combo": guandan._evaluate_combo([lead], state["level_rank"], state.get("config", {})),
        }
        state["players"]["bot"]["hand"] = [pick_label(label) for label in ["♠️4", "♣️7", "♦️9", "♠️J"]]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 4]
            idx += 4

        with mock.patch.object(guandan, "_mcts_reply_tree_value") as reply_tree:
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        labels = [guandan._card_label(hand_map[cid]) for cid in action.get("card_ids", [])]
        self.assertEqual(labels, ["♠️4"])
        reply_tree.assert_not_called()

    def test_mcts_root_early_stop_reduces_simulations_when_gap_is_large(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_mcts_early_stop_min_rounds"] = 2
        state["config"]["bot_mcts_early_stop_gap"] = 4.0
        state["config"]["bot_mcts_early_stop_stable_rounds"] = 2

        action_a = {"type": "play", "card_ids": [11]}
        action_b = {"type": "play", "card_ids": [22]}

        def fake_apply_action(target_state, _player_id, action):
            target_state["branch"] = tuple(action.get("card_ids", []))
            return [], None

        def fake_tree_value(target_state, _bot_id, _ply, _width, _rollout_depth, alpha=-1e9, beta=1e9):
            del alpha, beta, _bot_id, _ply, _width, _rollout_depth
            return 10.0 if target_state["branch"] == (11,) else 0.0

        with mock.patch.object(guandan, "_candidate_actions", return_value=[action_a, action_b]):
            with mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts):
                with mock.patch.object(guandan, "_mcts_root_heuristic_value", return_value=0.0):
                    with mock.patch.object(guandan, "_mcts_obvious_response_scores", return_value=None):
                        with mock.patch.object(guandan, "_mcts_budget", return_value=(40, 4, 1, 2)):
                            with mock.patch.object(guandan, "_determinize_state", side_effect=lambda s, _p, _r: {}):
                                with mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=fake_apply_action):
                                    with mock.patch.object(guandan, "_mcts_reply_tree_value", side_effect=fake_tree_value) as reply_tree:
                                        picked, scored = guandan._mcts_pick_action(
                                            state,
                                            "bot",
                                            sims=40,
                                            depth=4,
                                            width=2,
                                            tree_ply=2,
                                            reply_width=2,
                                            risk_lambda=0.28,
                                        )

        self.assertEqual(picked, action_a)
        self.assertLess(reply_tree.call_count, 40)
        self.assertLess(scored[0][2], 20)

    def test_mcts_pass_does_not_fallback(self):
        state = self._make_pass_state()
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "pass")
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "mcts")
        self.assertEqual(explain.get("chosen", {}).get("cards"), ["Pass"])

    def test_evaluate_state_prefers_stronger_hand(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None

        deck = guandan._full_deck()
        weak = [
            next(card for card in deck if card.get("rank") == 3 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 7 and card.get("suit") == "clubs"),
            next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "diamonds"),
            next(card for card in deck if card.get("rank") == 11 and card.get("suit") == "spades"),
        ]
        strong = [card for card in deck if card.get("rank") == 6 and not card.get("joker")][:3]
        strong += [card for card in deck if card.get("rank") == 8 and not card.get("joker")][:2]

        state["players"]["bot"]["hand"] = weak
        weak_score = guandan._evaluate_state_for_bot(state, "bot")
        state["players"]["bot"]["hand"] = strong
        strong_score = guandan._evaluate_state_for_bot(state, "bot")
        self.assertGreater(strong_score, weak_score)

    def test_estimated_turns_to_finish_prefers_connected_groups(self):
        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        structured = [pick_label(label) for label in ["♠️3", "♥️3", "♠️4", "♥️4", "♠️5", "♥️5"]]
        weak = [pick_label(label) for label in ["♣️6", "♦️8", "♠️10", "♥️J", "♣️K", "♦️A"]]

        structured_turns = guandan._estimated_turns_to_finish(structured, 2)
        weak_turns = guandan._estimated_turns_to_finish(weak, 2)
        self.assertLess(structured_turns, weak_turns)

    def test_team_finish_score_uses_effective_turns_not_only_card_count(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bot_hand = [pick_label(label) for label in ["♠️3", "♥️3", "♣️3", "♠️4", "♥️4", "♣️4"]]
        opp_hand = [pick_label(label) for label in ["♦️5", "♠️7", "♥️9", "♣️J", "♦️K"]]
        mate_hand = [pick_label(label) for label in ["♣️6", "♦️8", "♠️10", "♥️Q", "♣️A", "♦️6", "♠️8", "♥️10", "♣️Q", "♦️A"]]
        opp2_hand = [pick_label(label) for label in ["♠️5", "♥️7", "♣️9", "♦️J", "♠️K", "♥️6", "♣️8", "♦️10", "♠️Q"]]

        state["players"]["bot"]["hand"] = bot_hand
        state["players"]["opp"]["hand"] = opp_hand
        state["players"]["mate"]["hand"] = mate_hand
        state["players"]["opp2"]["hand"] = opp2_hand

        bot_turns = guandan._estimated_turns_to_finish(bot_hand, state["level_rank"])
        opp_turns = guandan._estimated_turns_to_finish(opp_hand, state["level_rank"])
        self.assertLess(bot_turns, opp_turns)

        score = guandan._team_finish_score(state, "bot", len(bot_hand), bot_hand=bot_hand)
        self.assertGreater(score, 0.0)

    def test_structure_penalty_breaks_pair(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        pair_hand = [
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "clubs"),
            next(card for card in deck if card.get("rank") == 11 and card.get("suit") == "diamonds"),
            next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "spades"),
        ]
        no_pair_hand = [
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 7 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "clubs"),
            next(card for card in deck if card.get("rank") == 11 and card.get("suit") == "diamonds"),
            next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "spades"),
        ]
        state["players"]["bot"]["hand"] = pair_hand
        pair_score = guandan._evaluate_state_for_bot(state, "bot")
        state["players"]["bot"]["hand"] = no_pair_hand
        no_pair_score = guandan._evaluate_state_for_bot(state, "bot")
        self.assertGreater(pair_score, no_pair_score)

    def test_mcts_small_joker_scenario_prefers_play_over_pass(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0
        state["config"]["bot_mcts_depth"] = 0
        state["config"]["bot_mcts_sims"] = 20

        labels = [
            "🃏S",
            "♥️A",
            "♠️Q",
            "♥️Q",
            "♦️J",
            "♣️J",
            "♣️10",
            "♣️10",
            "♦️10",
            "♦️9",
            "♠️8",
            "♠️8",
            "♣️7",
            "♦️6",
            "♠️6",
            "♥️5",
            "♦️5",
            "♥️4",
            "♥️4",
            "♠️3",
            "♥️3",
            "♣️3",
            "♦️3",
        ]
        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [pick_label(label) for label in labels]
        state["players"]["bot"]["hand"] = hand
        small = pick_label("🃏S")

        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 23]
            idx += 23

        combo = guandan._evaluate_combo([small], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [small["id"]],
            "combo": combo,
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "play")
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "mcts")
        top_cards = [entry.get("cards") for entry in explain.get("top", [])]
        self.assertEqual(explain.get("chosen", {}).get("cards"), ["♠️3", "♥️3", "♣️3", "♦️3"])
        self.assertIn(["Pass"], top_cards)

    def test_mcts_does_not_lead_small_ace_subset_from_six_aces_when_other_shapes_exist(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        deck = guandan._full_deck()

        labels = [
            "♠️A",
            "♥️A",
            "♣️A",
            "♦️A",
            "♠️A",
            "♥️A",
            "♠️K",
            "♥️K",
            "♠️Q",
            "♥️Q",
            "♠️J",
            "♥️J",
            "♠️10",
            "♥️10",
        ]

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot"]["hand"] = [pick_label(label) for label in labels]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 10]
            idx += 10

        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "play")
        explain = state.get("bot_explain", {}).get("bot", {})
        chosen_cards = explain.get("chosen", {}).get("cards", [])

        def is_small_ace_subset(cards):
            return 0 < len(cards) < 4 and all(isinstance(card, str) and card.endswith("A") for card in cards)

        self.assertFalse(is_small_ace_subset(chosen_cards))

    def test_near_endgame_mcts_does_not_crash_when_rollout_eliminates_all_opponents(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["finish_order"] = ["zhu"]
        state["players"]["zhu"]["finished"] = True
        state["players"]["zhu"]["finish_rank"] = 1
        state["current_turn"] = "bot2"
        state["pass_count"] = 0
        state["trick_plays"] = {}

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["calvin"]["hand"] = [pick_label(label) for label in ["♣️2", "♦️9", "♥️9", "♠️9"]]
        state["players"]["bot2"]["hand"] = [
            pick_label(label)
            for label in ["♥️K", "♥️J", "♠️10", "♦️10", "♠️10", "♥️9", "♠️8", "♦️8", "♣️7", "♥️7", "♠️4", "♣️4"]
        ]
        state["players"]["bot4"]["hand"] = [
            pick_label(label)
            for label in ["🃏S", "♣️10", "♦️7", "♦️7", "♠️7", "♥️6", "♠️5", "♠️4", "♦️3"]
        ]
        trick_cards = [pick_label(label) for label in ["♦️A", "♣️A", "♥️A"]]
        state["current_trick"] = {
            "player_id": "calvin",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"]["calvin"] = trick_cards

        action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(action.get("type"), "pass")
        _, error = guandan.GuandanGame.apply_action(state, "bot2", action)
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "bot4")

        next_action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertIsNotNone(next_action)
        self.assertEqual(next_action.get("type"), "pass")

    def test_minimal_bomb_used_when_only_bombs_available(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        deck = guandan._full_deck()

        threes = [card for card in deck if card.get("rank") == 3 and not card.get("joker")][:4]
        kings = [card for card in deck if card.get("rank") == 13 and not card.get("joker")][:4]
        state["players"]["bot"]["hand"] = threes + kings

        used = {c["id"] for c in state["players"]["bot"]["hand"]}
        remaining = [c for c in deck if c["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 23]
            idx += 23

        big = next(card for card in remaining if card.get("joker") == "big")
        combo = guandan._evaluate_combo([big], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [big["id"]],
            "combo": combo,
        }

        options = guandan._list_hint_options(state, "bot")
        filtered = guandan._filter_overbomb_options(state, "bot", options)
        self.assertEqual(filtered, [[card["id"] for card in threes]])

    def test_heart_level_single_not_higher(self):
        deck = guandan._full_deck()
        heart_two = next(card for card in deck if card.get("rank") == 2 and card.get("suit") == "hearts")
        spade_two = next(card for card in deck if card.get("rank") == 2 and card.get("suit") == "spades")
        level_rank = 2
        config = guandan._merge_config(None)

        current = guandan._evaluate_combo([spade_two], level_rank, config)
        challenger = guandan._evaluate_combo([heart_two], level_rank, config)

        self.assertFalse(guandan._compare_combos(current, challenger, level_rank, config))
        self.assertFalse(guandan._compare_combos(challenger, current, level_rank, config))

    def test_opponent_lead_prefers_cheap_takeover_over_pass(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        deck = guandan._full_deck()

        four = next(card for card in deck if card.get("rank") == 4 and card.get("suit") == "spades")
        five = next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades")
        six = next(card for card in deck if card.get("rank") == 6 and card.get("suit") == "spades")
        nine = next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "clubs")
        jack = next(card for card in deck if card.get("rank") == 11 and card.get("suit") == "diamonds")
        king = next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "hearts")

        state["players"]["bot"]["hand"] = [five, six, nine, jack, king]
        used = {card["id"] for card in state["players"]["bot"]["hand"]} | {four["id"]}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 5]
            idx += 5

        combo = guandan._evaluate_combo([four], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {"player_id": "opp", "cards": [four["id"]], "combo": combo}

        pass_score = guandan._bot_score_play(state, "bot", None, depth=3)
        play_score = guandan._bot_score_play(state, "bot", [five["id"]], depth=3)

        self.assertGreater(play_score, pass_score)
        self.assertEqual(guandan._bot_select_play(state, "bot", depth=3), [five["id"]])

    def test_low_single_prefers_lone_level_single_lock_over_pass(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["level_rank"] = 2
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        four = pick_label("♠️4")
        two = pick_label("♠️2")
        state["players"]["bot"]["hand"] = [
            two,
            pick_label("♠️7"),
            pick_label("♥️7"),
            pick_label("♠️9"),
            pick_label("♥️9"),
            pick_label("♣️J"),
            pick_label("♦️J"),
        ]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 7]
            idx += 7

        state["current_trick"] = {
            "player_id": "opp",
            "cards": [four["id"]],
            "combo": guandan._evaluate_combo([four], state["level_rank"], state.get("config", {})),
        }

        pass_score = guandan._bot_score_components(state, "bot", None, depth=4)
        play_score = guandan._bot_score_components(state, "bot", [two["id"]], depth=4)
        self.assertIn("single_lock", play_score)
        self.assertGreater(play_score["single_lock"], 0.0)
        self.assertGreater(play_score["total"], pass_score["total"])

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        self.assertEqual(action.get("card_ids"), [two["id"]])

    def test_teammate_lead_can_still_prefer_pass(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        deck = guandan._full_deck()

        four = next(card for card in deck if card.get("rank") == 4 and card.get("suit") == "spades")
        five = next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades")
        nine = next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "clubs")
        jack = next(card for card in deck if card.get("rank") == 11 and card.get("suit") == "diamonds")
        king = next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "hearts")

        state["players"]["bot"]["hand"] = [five, nine, jack, king]
        used = {card["id"] for card in state["players"]["bot"]["hand"]} | {four["id"]}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 5]
            idx += 5

        combo = guandan._evaluate_combo([four], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {"player_id": "mate", "cards": [four["id"]], "combo": combo}

        pass_score = guandan._bot_score_play(state, "bot", None, depth=3)
        play_score = guandan._bot_score_play(state, "bot", [five["id"]], depth=3)

        self.assertGreater(pass_score, play_score)

    def test_mcts_does_not_bomb_teammate_early_when_only_bomb_can_beat(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bomb_labels = ["♠️5", "♥️5", "♣️5", "♦️5"]
        filler_labels = ["♣️3", "♦️3", "♠️4", "♣️6", "♠️6", "♥️8", "♣️8", "♠️9", "♣️9", "♣️J", "♥️K", "♣️2", "♥️2", "♦️2"]
        state["players"]["bot"]["hand"] = [pick_label(label) for label in bomb_labels + filler_labels]

        small_joker = pick_label("🃏S")
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 14]
            idx += 14

        state["current_trick"] = {
            "player_id": "mate",
            "cards": [small_joker["id"]],
            "combo": guandan._evaluate_combo([small_joker], state["level_rank"], state.get("config", {})),
        }

        pass_score = guandan._bot_score_play(state, "bot", None, depth=4)
        bomb_ids = [card["id"] for card in state["players"]["bot"]["hand"] if guandan._card_label(card) in set(bomb_labels)]
        bomb_score = guandan._bot_score_play(state, "bot", bomb_ids, depth=4)
        self.assertGreater(pass_score, bomb_score)

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "pass")

    def test_lead_candidates_prioritize_combo_over_single(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        deck = guandan._full_deck()

        hand = [
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "clubs"),
            next(card for card in deck if card.get("rank") == 7 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 7 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "spades"),
        ]
        state["players"]["bot"]["hand"] = hand
        used = {card["id"] for card in hand}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 6]
            idx += 6

        actions = guandan._candidate_actions(state, "bot", 3)
        self.assertTrue(actions)
        first = actions[0]
        self.assertEqual(first.get("type"), "play")
        combo = guandan._evaluate_combo(
            [card for card in hand if card["id"] in first.get("card_ids", [])],
            state["level_rank"],
            state.get("config", {}),
        )
        self.assertEqual(combo["type"], "full_house")

    def test_rollout_lead_prefers_combo_over_first_single_hint(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        deck = guandan._full_deck()

        hand = [
            next(card for card in deck if card.get("rank") == 6 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 6 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 6 and card.get("suit") == "clubs"),
            next(card for card in deck if card.get("rank") == 8 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 8 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 12 and card.get("suit") == "spades"),
        ]
        state["players"]["bot"]["hand"] = hand
        used = {card["id"] for card in hand}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 6]
            idx += 6

        action = guandan._rollout_policy_action(state, "bot")
        self.assertEqual(action.get("type"), "play")
        combo = guandan._evaluate_combo(
            [card for card in hand if card["id"] in action.get("card_ids", [])],
            state["level_rank"],
            state.get("config", {}),
        )
        self.assertEqual(combo["type"], "full_house")

    def test_lead_candidates_prune_weak_low_single_that_breaks_pair(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None
        deck = guandan._full_deck()

        labels = [
            "♣️K",
            "♠️K",
            "♥️K",
            "♦️10",
            "♥️10",
            "♥️9",
            "♠️9",
            "♥️8",
            "♣️8",
            "♦️8",
            "♦️4",
            "♥️4",
            "♠️3",
            "♥️3",
            "♣️3",
        ]

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [pick_label(label) for label in labels]
        state["players"]["bot"]["hand"] = hand
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 9]
            idx += 9

        hand_map = guandan._map_hand_by_id(hand)
        actions = guandan._candidate_actions(state, "bot", 10)
        play_labels = []
        for action in actions:
            if action.get("type") != "play":
                continue
            play_labels.append([guandan._card_label(hand_map[cid]) for cid in action.get("card_ids", [])])

        self.assertNotIn(["♥️4"], play_labels)
        self.assertNotIn(["♦️4"], play_labels)
        self.assertIn(["♦️4", "♥️4"], play_labels)

    def test_shape_transition_penalizes_breaking_pair_for_single(self):
        deck = guandan._full_deck()
        level_rank = 2
        hand = [
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades"),
            next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "hearts"),
            next(card for card in deck if card.get("rank") == 7 and card.get("suit") == "clubs"),
            next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "diamonds"),
        ]
        break_pair = guandan._shape_transition_score(hand, [hand[0]["id"]], level_rank)
        consume_single = guandan._shape_transition_score(hand, [hand[2]["id"]], level_rank)
        self.assertGreater(consume_single, break_pair)

    def test_opponent_lead_more_willing_to_takeover_now(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        deck = guandan._full_deck()

        four = next(card for card in deck if card.get("rank") == 4 and card.get("suit") == "spades")
        five = next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades")
        five_pair = next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "hearts")
        ace = next(card for card in deck if card.get("rank") == 14 and card.get("suit") == "clubs")
        king = next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "diamonds")
        state["players"]["bot"]["hand"] = [five, five_pair, ace, king]
        used = {card["id"] for card in state["players"]["bot"]["hand"]} | {four["id"]}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 4]
            idx += 4

        combo = guandan._evaluate_combo([four], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {"player_id": "opp", "cards": [four["id"]], "combo": combo}

        pass_components = guandan._bot_score_components(state, "bot", None, depth=4)
        play_components = guandan._bot_score_components(state, "bot", [ace["id"]], depth=4)
        self.assertIn("pass_opportunity_cost", pass_components)
        self.assertIn("seize_tempo", play_components)
        self.assertGreater(play_components["total"], pass_components["total"])

    def test_mcts_pair_response_prefers_natural_pair_over_pass_and_small_jokers(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot"]["hand"] = [
            pick_label(label)
            for label in ["🃏S", "🃏S", "♠️Q", "♥️Q", "♠️6", "♥️6", "♣️5", "♦️5", "♣️4", "♦️4"]
        ]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 10]
            idx += 10

        pair_eight = [pick_label("♠️8"), pick_label("♥️8")]
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [card["id"] for card in pair_eight],
            "combo": guandan._evaluate_combo(pair_eight, state["level_rank"], state.get("config", {})),
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, ["♠️Q", "♥️Q"])

    def test_mcts_preserves_bomb_against_small_joker_when_pass_is_better(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot"]["hand"] = [
            pick_label(label)
            for label in ["♠️9", "♥️9", "♣️9", "♦️9", "♠️A", "♥️A", "♠️K", "♥️K", "♠️Q", "♥️Q"]
        ]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 10]
            idx += 10

        small_joker = pick_label("🃏S")
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [small_joker["id"]],
            "combo": guandan._evaluate_combo([small_joker], state["level_rank"], state.get("config", {})),
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "pass")
        chosen = state.get("bot_explain", {}).get("bot", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, ["Pass"])

    def test_passes_on_level_single_when_teammate_might_hold_unseen_joker(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp2", "name": "Opp2", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp", "name": "Opp", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["level_rank"] = 2
        state["dealer_team"] = "A"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        lead_card = pick_label("♣️2")
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [lead_card["id"]],
            "combo": guandan._evaluate_combo([lead_card], state["level_rank"], state.get("config", {})),
        }
        bomb_labels = ["♠️5", "♥️5", "♣️5", "♦️5"]
        filler_labels = ["♠️A", "♣️K", "♠️10", "♣️8", "♣️7", "♠️6", "♣️4", "♥️3"]
        state["players"]["bot"]["hand"] = [pick_label(label) for label in bomb_labels + filler_labels]
        state["players"]["mate"]["hand"] = [
            pick_label(label)
            for label in ["♠️Q", "♣️J", "♥️9", "♣️9", "♦️8", "♠️7", "♥️6", "♣️6", "♦️4", "♠️3", "♦️3", "♥️4"]
        ]
        state["players"]["opp"]["hand"] += [
            pick_label(label)
            for label in ["♠️K", "♥️Q", "♣️10", "♦️10", "♥️8", "♠️8", "♦️7", "♥️7", "♠️4", "♣️4", "♦️4"]
        ]
        state["players"]["opp2"]["hand"] = [pick_label("🃏B"), pick_label("🃏S")] + deck[:10]

        bomb_ids = [card["id"] for card in state["players"]["bot"]["hand"] if guandan._card_label(card) in set(bomb_labels)]
        teammate_prob = guandan._teammate_future_control_probability(state, "bot")
        pass_score = guandan._bot_score_play(state, "bot", None, depth=4)
        bomb_score = guandan._bot_score_play(state, "bot", bomb_ids, depth=4)

        self.assertGreater(teammate_prob, 0.2)
        self.assertGreater(pass_score, bomb_score)

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "pass")

    def test_mcts_prefers_natural_three_pairs_over_wild_structure_break(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot"]["hand"] = [
            pick_label(label)
            for label in ["♠️8", "♥️8", "♣️8", "♠️9", "♠️10", "♦️10", "♠️J", "♥️J", "♠️Q", "♥️Q", "♥️2"]
        ]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 10]
            idx += 10

        trick_cards = [
            pick_label("♠️7"),
            pick_label("♥️7"),
            pick_label("♠️8"),
            pick_label("♥️8"),
            pick_label("♣️9"),
            pick_label("♦️9"),
        ]
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, ["♠️10", "♦️10", "♠️J", "♥️J", "♠️Q", "♥️Q"])

    def test_small_hand_leads_low_single_before_pairs(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["current_trick"] = None

        deck = guandan._full_deck()
        labels = ["♠️A", "♥️A", "♠️J", "♥️J", "♠️4"]
        hand = []
        for label in labels:
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    hand.append(deck.pop(idx))
                    break
        state["players"]["bot"]["hand"] = hand
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 5]
            idx += 5

        chosen = guandan._choose_lead_play(hand, state["level_rank"], state.get("config", {}), state, "bot")
        hand_map = guandan._map_hand_by_id(hand)
        labels = [guandan._card_label(hand_map[cid]) for cid in chosen]
        self.assertEqual(labels, ["♠️4"])
