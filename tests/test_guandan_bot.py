import copy
import random
import unittest
from unittest import mock

from game import guandan


class GuandanBotBombAvoidanceTests(unittest.TestCase):
    def _make_single_response_state(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_mode"] = "heuristic"

        deck = guandan._full_deck()
        low = next(card for card in deck if guandan._card_label(card) == "♣️5")
        high = next(card for card in deck if guandan._card_label(card) == "♣️7")
        lead = next(card for card in deck if guandan._card_label(card) == "♣️6")

        state["players"]["bot"]["hand"] = [low, high]
        state["players"]["opp"]["hand"] = [lead]
        state["players"]["mate"]["hand"] = []
        state["players"]["opp2"]["hand"] = []
        combo = guandan._evaluate_combo([lead], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [lead["id"]],
            "combo": combo,
        }
        return state, low, high

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

    def _make_full_house_candidate_state(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "bot3", "name": "Bot 3", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        trick_cards = [pick_label(label) for label in ["♦️3", "♦️3", "♥️3", "♠️4", "♥️4"]]
        state["players"]["bot4"]["hand"] = [
            pick_label(label)
            for label in [
                "♦️2",
                "♦️2",
                "♣️2",
                "♦️A",
                "♣️A",
                "♠️A",
                "♣️K",
                "♦️Q",
                "♠️J",
                "♣️10",
                "♥️10",
                "♥️10",
                "♦️9",
                "♦️9",
                "♠️9",
                "♣️8",
                "♠️8",
                "♦️7",
                "♠️6",
                "♠️5",
                "♦️5",
                "♥️5",
                "♥️4",
                "♦️4",
                "♠️3",
                "♣️3",
                "♣️3",
            ]
        ]

        combo = guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {}))
        state["current_trick"] = {
            "player_id": "bot3",
            "cards": [card["id"] for card in trick_cards],
            "combo": combo,
        }
        state["trick_plays"] = {"bot3": trick_cards}

        for pid, count in (("calvin", 27), ("bot2", 27), ("bot3", 16)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]
        return state

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

    def test_filter_overbomb_options_keeps_bomb_when_all_responses_break_structure(self):
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

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot"]["hand"] = [
            pick_label(label)
            for label in ["♠️7", "♥️7", "♣️7", "♦️7", "♠️8", "♥️8", "♣️8", "♠️A"]
        ]
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:8]
            del deck[:8]

        trick_cards = [pick_label("♠️6"), pick_label("♥️6")]
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }

        options = guandan._list_hint_options(state, "bot")
        filtered = guandan._filter_overbomb_options(state, "bot", options)
        filtered_types = [self._combo_type(state, cards) for cards in filtered]
        self.assertIn("pair", filtered_types)
        self.assertIn("bomb", filtered_types)

    def test_filter_overbomb_options_keeps_bomb_for_three_pairs_that_break_triples(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot3"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot3"]["hand"] = [
            pick_label(label)
            for label in [
                "♦️2",
                "♣️2",
                "♦️A",
                "♠️A",
                "♠️A",
                "♣️A",
                "♦️K",
                "♦️Q",
                "♣️Q",
                "♠️Q",
                "♠️J",
                "♣️J",
                "♦️J",
                "♥️J",
                "♠️9",
                "♠️9",
                "♦️9",
                "♦️8",
                "♣️8",
                "♥️8",
                "♠️7",
                "♠️7",
            ]
        ]
        trick_cards = [pick_label(label) for label in ["♥️3", "♠️3", "♦️4", "♣️4", "♥️5", "♠️5"]]
        state["current_trick"] = {
            "player_id": "calvin",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }
        for pid, count in (("calvin", 18), ("zhu", 9), ("bot4", 19)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        options = guandan._list_hint_options(state, "bot3")
        filtered = guandan._filter_overbomb_options(state, "bot3", options)
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        filtered_labels = {
            tuple(sorted(guandan._card_label(hand_map[cid]) for cid in cards))
            for cards in filtered
        }

        self.assertIn(tuple(sorted(["♠️7", "♠️7", "♦️8", "♣️8", "♠️9", "♠️9"])), filtered_labels)
        self.assertIn(tuple(sorted(["♦️J", "♣️J", "♥️J", "♠️J"])), filtered_labels)

    def test_natural_level_card_remains_available_as_single_with_heart_level_wild(self):
        deck = guandan._full_deck()
        club_two = next(card for card in deck if guandan._card_label(card) == "♣️2")
        heart_two = next(card for card in deck if guandan._card_label(card) == "♥️2")

        single_combo = guandan._evaluate_combo([club_two], 2, {})
        pair_combo = guandan._evaluate_combo([club_two, heart_two], 2, {})
        single_options = guandan._list_single_options([club_two, heart_two], 2, 0)

        self.assertEqual(single_combo.get("type"), "single")
        self.assertEqual(single_combo.get("rank_value"), guandan._single_order_value(club_two, 2))
        self.assertEqual(pair_combo.get("type"), "pair")
        self.assertIn([club_two["id"]], single_options)

    def test_full_house_options_enumerate_multiple_pair_choices(self):
        state = self._make_full_house_candidate_state()
        hand = state["players"]["bot4"]["hand"]
        hand_map = guandan._map_hand_by_id(hand)
        options = guandan._list_full_house_options(hand, state["level_rank"], 0)
        label_sets = {
            tuple(sorted(guandan._card_label(hand_map[cid]) for cid in cards))
            for cards in options
        }

        self.assertIn(tuple(sorted(["♦️9", "♦️9", "♠️9", "♥️4", "♦️4"])), label_sets)
        self.assertIn(tuple(sorted(["♦️9", "♦️9", "♠️9", "♠️3", "♣️3"])), label_sets)

    def test_candidate_actions_include_better_full_house_response(self):
        state = self._make_full_house_candidate_state()
        actions = guandan._candidate_actions(state, "bot4", 12)
        hand = state["players"]["bot4"]["hand"]
        hand_map = guandan._map_hand_by_id(hand)
        play_label_sets = {
            tuple(sorted(guandan._card_label(hand_map[cid]) for cid in action.get("card_ids", [])))
            for action in actions
            if action.get("type") == "play"
        }

        self.assertIn(tuple(sorted(["♦️9", "♦️9", "♠️9", "♥️4", "♦️4"])), play_label_sets)

    def test_filter_overbomb_actions_removes_bomb_plays(self):
        state, _ = self._make_state()
        actions = guandan._candidate_actions(state, "bot", 20)
        filtered = guandan._filter_overbomb_actions(state, "bot", actions)
        play_actions = [action for action in filtered if action.get("type") == "play"]
        self.assertTrue(play_actions)
        for action in play_actions:
            combo_type = self._combo_type(state, action.get("card_ids", []))
            self.assertNotEqual(combo_type, "bomb")

    def test_determinize_state_prefers_assignments_consistent_with_pass_limits(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["config"]["bot_determinize_samples"] = 4

        deck = guandan._full_deck()
        bot_card = next(card for card in deck if guandan._card_label(card) == "♣️5")
        low_single = next(card for card in deck if guandan._card_label(card) == "♣️3")
        high_single = next(card for card in deck if guandan._card_label(card) == "♠️A")
        filler_a = next(card for card in deck if guandan._card_label(card) == "♦️7")
        filler_b = next(card for card in deck if guandan._card_label(card) == "♥️9")

        state["players"]["bot"]["hand"] = [bot_card]
        state["players"]["opp"]["hand"] = [filler_a]
        state["players"]["mate"]["hand"] = []
        state["players"]["opp2"]["hand"] = [filler_b]
        state["seen_cards"] = [
            card["id"]
            for card in guandan._full_deck()
            if card["id"] not in {low_single["id"], high_single["id"], bot_card["id"]}
        ]
        state["pass_limits"] = {
            "opp": {"single": guandan._single_order_value(low_single, state["level_rank"])},
        }

        det = guandan._determinize_state(state, "bot", random.Random(0))
        opp_labels = [guandan._card_label(card) for card in det["players"]["opp"]["hand"]]
        opp2_labels = [guandan._card_label(card) for card in det["players"]["opp2"]["hand"]]

        self.assertEqual(opp_labels, ["♣️3"])
        self.assertEqual(opp2_labels, ["♠️A"])

    def test_public_revealed_rank_caps_reduce_same_rank_reply_probability(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["level_rank"] = 2

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bot_hand = [pick_label(label) for label in ["♠️8", "♥️8", "♣️8", "♠️10", "♥️10", "♣️A"]]
        state["players"]["bot"]["hand"] = bot_hand
        state["players"]["opp"]["hand"] = deck[:6]
        state["players"]["mate"]["hand"] = deck[6:14]
        state["players"]["opp2"]["hand"] = deck[14:22]
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "opp",
                                "type": "play",
                                "combo_type": "full_house",
                                "cards": [
                                    {"label": "♠️K", "rank": 13, "suit": "spades", "joker": None, "is_wild": False},
                                    {"label": "♥️K", "rank": 13, "suit": "hearts", "joker": None, "is_wild": False},
                                    {"label": "♣️K", "rank": 13, "suit": "clubs", "joker": None, "is_wild": False},
                                    {"label": "♠️4", "rank": 4, "suit": "spades", "joker": None, "is_wild": False},
                                    {"label": "♥️4", "rank": 4, "suit": "hearts", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 6,
                            }
                        ]
                    }
                ],
            }
        ]

        combo = guandan._evaluate_combo(bot_hand[:5], state["level_rank"], state.get("config", {}))
        unknown_total, rank_counts, wild_count, joker_counts = guandan._guandan_ai.call(
            guandan, "_lead_unknown_pool_profile", state, "bot"
        )
        with_caps = guandan._guandan_ai.call(
            guandan, "_opponent_same_type_reply_probability", state, "opp", combo, unknown_total, rank_counts, wild_count
        )
        with_bomb_caps = guandan._guandan_ai.call(
            guandan, "_opponent_bomb_reply_probability", state, "opp", combo, unknown_total, rank_counts, joker_counts
        )

        state_no_history = guandan.GuandanGame.init_game({}, players)
        state_no_history["phase"] = "playing"
        state_no_history["level_rank"] = 2
        state_no_history["players"]["bot"]["hand"] = bot_hand
        state_no_history["players"]["opp"]["hand"] = state["players"]["opp"]["hand"]
        state_no_history["players"]["mate"]["hand"] = state["players"]["mate"]["hand"]
        state_no_history["players"]["opp2"]["hand"] = state["players"]["opp2"]["hand"]
        baseline_unknown_total, baseline_rank_counts, baseline_wild_count, baseline_joker_counts = guandan._guandan_ai.call(
            guandan, "_lead_unknown_pool_profile", state_no_history, "bot"
        )
        baseline_same = guandan._guandan_ai.call(
            guandan,
            "_opponent_same_type_reply_probability",
            state_no_history,
            "opp",
            combo,
            baseline_unknown_total,
            baseline_rank_counts,
            baseline_wild_count,
        )
        baseline_bomb = guandan._guandan_ai.call(
            guandan,
            "_opponent_bomb_reply_probability",
            state_no_history,
            "opp",
            combo,
            baseline_unknown_total,
            baseline_rank_counts,
            baseline_joker_counts,
        )

        self.assertLess(with_caps, baseline_same)
        self.assertLess(with_bomb_caps, baseline_bomb)

    def test_six_card_structured_prior_boosts_full_house_reply_probability(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["config"]["bot_short_hand_structured_samples"] = 400
        state["config"]["bot_short_hand_structured_max_attempts"] = 6000

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        played = []
        for label in [
            "♠️3", "♦️3", "♦️7", "♥️7", "♥️J", "♦️J", "♥️Q", "♥️Q", "♣️K", "♠️K", "♣️3", "♠️3", "♥️3", "♥️2",
            "♣️5", "♠️5", "♦️2", "♦️2",
            "♦️3", "♦️4", "♥️5", "♦️6", "♥️7",
            "♠️6", "♦️7", "♦️8", "♦️9", "♣️10", "♠️7", "♥️8", "♥️9", "♥️10", "♥️J", "♥️2", "♦️Q", "♠️Q", "♠️Q",
            "♥️3", "♠️5", "♥️8", "♣️9", "🃏B",
            "♣️6", "♥️9", "♠️10", "♥️K", "♠️2", "🃏S",
        ]:
            played.append(pick_label(label))

        state["seen_cards"] = [card["id"] for card in played]
        state["players"]["bot4"]["hand"] = [
            pick_label(label)
            for label in [
                "♥️A", "♣️A", "♣️A", "♦️K", "♠️K", "♣️Q", "♣️J", "♠️J",
                "♥️10", "♦️10", "♦️8", "♠️8", "♣️8", "♣️6", "♣️4", "♥️4", "♣️4",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:6]
        state["players"]["bot3"]["hand"] = deck[6:23]
        state["players"]["zhu"]["hand"] = deck[23:43]
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♥️J", "rank": 11, "suit": "hearts", "joker": None, "is_wild": False},
                                    {"label": "♦️J", "rank": 11, "suit": "diamonds", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 25,
                            }
                        ],
                    },
                    {
                        "actions": [
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♦️2", "rank": 2, "suit": "diamonds", "joker": None, "is_wild": False},
                                    {"label": "♦️2", "rank": 2, "suit": "diamonds", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 23,
                            }
                        ],
                    },
                ],
            }
        ]

        need = {"♦️8", "♠️8", "♣️8", "♥️10", "♦️10"}
        combo_cards = [card for card in state["players"]["bot4"]["hand"] if guandan._card_label(card) in need]
        combo = guandan._evaluate_combo(combo_cards, state["level_rank"], state.get("config", {}))

        unknown_cards = guandan._guandan_ai.call(guandan, "_lead_unknown_pool_cards", state, "bot4")
        unknown_total, rank_counts, wild_count, joker_counts = guandan._guandan_ai.call(
            guandan, "_lead_unknown_pool_profile", state, "bot4"
        )

        baseline_same = guandan._guandan_ai.call(
            guandan,
            "_opponent_same_type_reply_probability",
            state,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            wild_count,
        )
        baseline_bomb = guandan._guandan_ai.call(
            guandan,
            "_opponent_bomb_reply_probability",
            state,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            joker_counts,
        )
        structured_same = guandan._guandan_ai.call(
            guandan,
            "_opponent_same_type_reply_probability",
            state,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            wild_count,
            unknown_cards,
        )
        structured_bomb = guandan._guandan_ai.call(
            guandan,
            "_opponent_bomb_reply_probability",
            state,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            joker_counts,
            unknown_cards,
        )

        baseline_any = 1.0 - (1.0 - baseline_same) * (1.0 - baseline_bomb)
        structured_any = 1.0 - (1.0 - structured_same) * (1.0 - structured_bomb)

        self.assertGreater(structured_any, baseline_any)
        self.assertGreater(structured_any, 0.02)

    def test_single_pass_signal_further_boosts_six_card_structured_reply_probability(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["config"]["bot_short_hand_structured_samples"] = 400
        state["config"]["bot_short_hand_structured_max_attempts"] = 6000

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        played = []
        for label in [
            "♠️3", "♦️3", "♦️7", "♥️7", "♥️J", "♦️J", "♥️Q", "♥️Q", "♣️K", "♠️K", "♣️3", "♠️3", "♥️3", "♥️2",
            "♣️5", "♠️5", "♦️2", "♦️2",
            "♦️3", "♦️4", "♥️5", "♦️6", "♥️7",
            "♠️6", "♦️7", "♦️8", "♦️9", "♣️10", "♠️7", "♥️8", "♥️9", "♥️10", "♥️J", "♥️2", "♦️Q", "♠️Q", "♠️Q",
            "♥️3", "♠️5", "♥️8", "♣️9", "🃏B",
            "♣️6", "♥️9", "♠️10", "♥️K", "♠️2", "🃏S",
        ]:
            played.append(pick_label(label))

        state["seen_cards"] = [card["id"] for card in played]
        state["players"]["bot4"]["hand"] = [
            pick_label(label)
            for label in [
                "♥️A", "♣️A", "♣️A", "♦️K", "♠️K", "♣️Q", "♣️J", "♠️J",
                "♥️10", "♦️10", "♦️8", "♠️8", "♣️8", "♣️6", "♣️4", "♥️4", "♣️4",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:6]
        state["players"]["bot3"]["hand"] = deck[6:23]
        state["players"]["zhu"]["hand"] = deck[23:43]
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♥️J", "rank": 11, "suit": "hearts", "joker": None, "is_wild": False},
                                    {"label": "♦️J", "rank": 11, "suit": "diamonds", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 25,
                            }
                        ],
                    },
                    {
                        "actions": [
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♦️2", "rank": 2, "suit": "diamonds", "joker": None, "is_wild": False},
                                    {"label": "♦️2", "rank": 2, "suit": "diamonds", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 23,
                            }
                        ],
                    },
                    {
                        "actions": [
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "single",
                                "cards": [{"label": "♥️3", "rank": 3, "suit": "hearts", "joker": None, "is_wild": False}],
                                "hand_count_after": 8,
                            },
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "single",
                                "cards": [{"label": "🃏B", "rank": None, "suit": None, "joker": "big", "is_wild": False}],
                                "hand_count_after": 7,
                            },
                        ],
                    },
                    {
                        "actions": [
                            {
                                "player_id": "calvin",
                                "type": "play",
                                "combo_type": "single",
                                "cards": [{"label": "♣️6", "rank": 6, "suit": "clubs", "joker": None, "is_wild": False}],
                                "hand_count_after": 6,
                            },
                            {"player_id": "calvin", "type": "pass"},
                        ],
                    },
                ],
            }
        ]

        need = {"♦️8", "♠️8", "♣️8", "♥️10", "♦️10"}
        combo_cards = [card for card in state["players"]["bot4"]["hand"] if guandan._card_label(card) in need]
        combo = guandan._evaluate_combo(combo_cards, state["level_rank"], state.get("config", {}))

        unknown_cards = guandan._guandan_ai.call(guandan, "_lead_unknown_pool_cards", state, "bot4")
        unknown_total, rank_counts, wild_count, joker_counts = guandan._guandan_ai.call(
            guandan, "_lead_unknown_pool_profile", state, "bot4"
        )

        without_pass = copy.deepcopy(state)
        without_pass["pass_limits"] = {}
        structured_same_without = guandan._guandan_ai.call(
            guandan,
            "_opponent_same_type_reply_probability",
            without_pass,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            wild_count,
            unknown_cards,
        )
        structured_bomb_without = guandan._guandan_ai.call(
            guandan,
            "_opponent_bomb_reply_probability",
            without_pass,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            joker_counts,
            unknown_cards,
        )

        state["pass_limits"] = {"calvin": {"single": 90}}
        structured_same_with = guandan._guandan_ai.call(
            guandan,
            "_opponent_same_type_reply_probability",
            state,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            wild_count,
            unknown_cards,
        )
        structured_bomb_with = guandan._guandan_ai.call(
            guandan,
            "_opponent_bomb_reply_probability",
            state,
            "calvin",
            combo,
            unknown_total,
            rank_counts,
            joker_counts,
            unknown_cards,
        )

        any_without = 1.0 - (1.0 - structured_same_without) * (1.0 - structured_bomb_without)
        any_with = 1.0 - (1.0 - structured_same_with) * (1.0 - structured_bomb_with)

        self.assertGreater(any_with, any_without)

    def test_rollout_policy_uses_heuristic_action(self):
        state, big = self._make_state()
        action = guandan._rollout_policy_action(state, "bot")
        self.assertEqual(action, {"type": "play", "card_ids": [big["id"]]})

    def test_heuristic_best_action_falls_back_from_illegal_response(self):
        state, low, high = self._make_single_response_state()
        with mock.patch.object(guandan, "_bot_select_play", return_value=[low["id"]]):
            action = guandan._heuristic_best_action(state, "bot", depth=3)
        self.assertEqual(action, {"type": "play", "card_ids": [high["id"]]})

    def test_bot_move_nn_mode_falls_back_from_illegal_action(self):
        state, low, high = self._make_single_response_state()
        state["config"]["bot_mode"] = "nn"
        invalid_nn_action = {"type": "play", "card_ids": [low["id"]]}
        with mock.patch.object(guandan, "_nn_pick_action", return_value=(invalid_nn_action, None, {"candidates": 1})):
            action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action, {"type": "play", "card_ids": [high["id"]]})

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

    def test_mcts_low_single_response_prefers_clean_singleton_over_split_pair(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "bot3", "name": "Bot 3", "seat": 2, "is_bot": True},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot3"
        state["dealer_team"] = "A"
        state["round_number"] = 1
        state["level_rank"] = 2

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot3"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏B",
                "🃏B",
                "🃏S",
                "♠️2",
                "♥️2",
                "♣️A",
                "♠️K",
                "♠️K",
                "♥️Q",
                "♣️Q",
                "♣️J",
                "♥️10",
                "♣️10",
                "♠️10",
                "♦️6",
                "♣️6",
                "♥️4",
                "♠️4",
                "♥️4",
                "♦️4",
            ]
        ]
        lead = pick_label("♣️4")
        combo = guandan._evaluate_combo([lead], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {"player_id": "bot2", "cards": [lead["id"]], "combo": combo}
        state["trick_plays"] = {"bot2": [lead]}

        for pid, count in (("calvin", 16), ("bot2", 18), ("bot4", 25)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot3")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "single")
        self.assertIn(chosen_labels[0], {"♠️2", "♣️A", "♣️J"})
        self.assertEqual(
            guandan._group_fragment_penalty(
                state["players"]["bot3"]["hand"], action.get("card_ids", []), state["level_rank"], chosen_combo
            ),
            0.0,
        )
        explain = state.get("bot_explain", {}).get("bot3", {})
        self.assertEqual(explain.get("method"), "heuristic")
        self.assertEqual(explain.get("chosen", {}).get("cards"), chosen_labels)

    def test_bot_move_skips_mcts_on_lead_position(self):
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
            for label in ["♠️A", "♥️A", "♣️K", "♦️K", "♠️Q", "♥️Q", "♣️J", "♦️10", "♠️9", "♥️8"]
        ]
        for pid, count in (("opp", 18), ("mate", 18), ("opp2", 18)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        with mock.patch.object(guandan, "_mcts_pick_action", side_effect=AssertionError("mcts should not run on lead")):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "heuristic")

    def test_lead_with_dense_combo_hand_does_not_dump_low_single(self):
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
                "♠️3",
                "♥️3",
                "♣️3",
            ]
        ]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 14]
            idx += 14

        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "play")

        hand_map = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))

        self.assertIsNotNone(chosen_combo)
        self.assertNotEqual(chosen_combo.get("type"), "single")
        self.assertNotEqual(chosen_labels, ["♦️4"])

    def test_lead_prefers_natural_full_house_over_wild_three_pairs_when_reentry_exists(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "bot3", "name": "Bot 3", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "B"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["current_trick"] = None

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot4"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏S",
                "♥️2",
                "♥️A",
                "♠️K",
                "♥️K",
                "♣️K",
                "♠️Q",
                "♦️J",
                "♥️10",
                "♥️10",
                "♠️10",
                "♠️10",
                "♦️10",
                "♠️9",
                "♥️9",
                "♦️9",
                "♠️8",
                "♠️7",
                "♦️7",
                "♣️6",
                "♦️6",
                "♠️6",
                "♠️5",
                "♣️4",
                "♥️4",
                "♠️3",
                "♣️3",
            ]
        ]
        for pid in ("calvin", "bot2", "bot3"):
            state["players"][pid]["hand"] = deck[:27]
            del deck[:27]

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot4")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot4"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))

        self.assertEqual(chosen_combo.get("type"), "full_house")
        self.assertFalse(chosen_combo.get("uses_wild"))
        self.assertEqual(chosen_labels, ["♣️6", "♦️6", "♠️6", "♠️3", "♣️3"])

        def ids_for(labels):
            ids = []
            used = set()
            for label in labels:
                for card in state["players"]["bot4"]["hand"]:
                    if card["id"] in used:
                        continue
                    if guandan._card_label(card) == label:
                        ids.append(card["id"])
                        used.add(card["id"])
                        break
            return ids

        natural_full_house = ids_for(["♣️6", "♦️6", "♠️6", "♠️3", "♣️3"])
        wild_three_pairs = ids_for(["♠️3", "♣️3", "♣️4", "♥️4", "♠️5", "♥️2"])
        self.assertGreater(
            guandan._lead_option_score(state, "bot4", natural_full_house),
            guandan._lead_option_score(state, "bot4", wild_three_pairs),
        )

    def test_followup_lead_avoids_wild_full_house_and_keeps_opening_clean(self):
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
        state["level_rank"] = 2

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "🃏S",
                "♥️2",
                "♥️A",
                "♠️K",
                "♥️K",
                "♣️K",
                "♠️Q",
                "♦️J",
                "♥️10",
                "♥️10",
                "♠️10",
                "♠️10",
                "♦️10",
                "♠️9",
                "♥️9",
                "♦️9",
                "♠️8",
                "♠️7",
                "♦️7",
                "♣️6",
                "♦️6",
                "♠️6",
                "♠️5",
                "♣️4",
                "♥️4",
                "♠️3",
                "♣️3",
            ]
        ]
        remove_labels = ["♣️6", "♦️6", "♠️6", "♠️3", "♣️3"]
        remove_ids = []
        used = set()
        for label in remove_labels:
            for card in hand:
                if card["id"] in used:
                    continue
                if guandan._card_label(card) == label:
                    remove_ids.append(card["id"])
                    used.add(card["id"])
                    break
        remaining = guandan._remove_cards(hand, remove_ids)
        state["players"]["bot"]["hand"] = remaining

        chosen = guandan._choose_lead_play(remaining, state["level_rank"], state.get("config", {}), state, "bot")
        hand_map = guandan._map_hand_by_id(remaining)
        chosen_cards = [hand_map[cid] for cid in chosen if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))

        self.assertIn(chosen_combo.get("type"), ("single", "pair", "full_house"))
        self.assertFalse(chosen_combo.get("uses_wild"))
        self.assertNotIn("♥️2", chosen_labels)

    def test_lead_teammate_support_bonus_prefers_low_clean_single_over_high_control(self):
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
        state["level_rank"] = 2

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bot_hand = [
            pick_label(label)
            for label in ["♠️4", "♠️A", "♥️A", "♠️K", "♥️Q", "♣️Q", "♦️9", "♣️9"]
        ]
        mate_hand = [
            pick_label(label)
            for label in ["♠️6", "♥️6", "♣️6", "♠️7", "♥️7", "♣️7"]
        ]
        opp_hand = [pick_label(label) for label in ["♠️3", "♥️5", "♣️8", "♦️10", "♣️J", "♦️K", "♠️9", "♥️J"]]
        opp2_hand = [pick_label(label) for label in ["♥️3", "♣️5", "♦️8", "♣️10", "♥️J", "♣️K", "♦️9", "♠️J"]]
        state["players"]["bot"]["hand"] = bot_hand
        state["players"]["mate"]["hand"] = mate_hand
        state["players"]["opp"]["hand"] = opp_hand
        state["players"]["opp2"]["hand"] = opp2_hand

        low_single = [next(card["id"] for card in bot_hand if guandan._card_label(card) == "♠️4")]
        high_single = [next(card["id"] for card in bot_hand if guandan._card_label(card) == "♠️A")]
        low_combo = guandan._evaluate_combo([next(card for card in bot_hand if guandan._card_label(card) == "♠️4")], 2, {})
        high_combo = guandan._evaluate_combo([next(card for card in bot_hand if guandan._card_label(card) == "♠️A")], 2, {})

        self.assertGreater(
            guandan._lead_teammate_support_bonus(state, "bot", low_single, low_combo),
            guandan._lead_teammate_support_bonus(state, "bot", high_single, high_combo),
        )

    def test_teammate_history_support_prefers_pair_lane_after_public_pair_three_plays(self):
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
        state["level_rank"] = 2

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bot_hand = [pick_label(label) for label in ["♠️4", "♠️5", "♥️5", "♣️K", "♦️Q", "♣️9", "♦️8"]]
        state["players"]["bot"]["hand"] = bot_hand
        state["players"]["mate"]["hand"] = [pick_label(label) for label in ["♠️7", "♥️7", "♣️7", "♠️8", "♥️8"]]
        state["players"]["opp"]["hand"] = [pick_label(label) for label in ["♣️3", "♦️4", "♠️6", "♥️9", "♣️J", "♦️K", "♣️A", "♠️10"]]
        state["players"]["opp2"]["hand"] = [pick_label(label) for label in ["♥️3", "♣️4", "♦️6", "♣️8", "♥️10", "♠️J", "♥️Q", "♦️A"]]
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "mate",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♠️9", "rank": 9, "suit": "spades", "joker": None, "is_wild": False},
                                    {"label": "♥️9", "rank": 9, "suit": "hearts", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 8,
                            },
                            {
                                "player_id": "mate",
                                "type": "play",
                                "combo_type": "three",
                                "cards": [
                                    {"label": "♠️7", "rank": 7, "suit": "spades", "joker": None, "is_wild": False},
                                    {"label": "♥️7", "rank": 7, "suit": "hearts", "joker": None, "is_wild": False},
                                    {"label": "♣️7", "rank": 7, "suit": "clubs", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 5,
                            },
                        ]
                    }
                ],
            }
        ]

        low_single = [next(card["id"] for card in bot_hand if guandan._card_label(card) == "♠️4")]
        low_pair = [card["id"] for card in bot_hand if guandan._card_label(card) in ("♠️5", "♥️5")]
        low_single_combo = guandan._evaluate_combo([next(card for card in bot_hand if guandan._card_label(card) == "♠️4")], 2, {})
        low_pair_combo = guandan._evaluate_combo([card for card in bot_hand if guandan._card_label(card) in ("♠️5", "♥️5")], 2, {})

        self.assertGreater(
            guandan._lead_teammate_support_bonus(state, "bot", low_pair, low_pair_combo),
            guandan._lead_teammate_support_bonus(state, "bot", low_single, low_single_combo),
        )

    def test_teammate_history_support_prefers_single_lane_after_public_single_plays(self):
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
        state["level_rank"] = 2

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bot_hand = [pick_label(label) for label in ["♠️4", "♠️5", "♥️5", "♣️K", "♦️Q", "♣️9", "♦️8"]]
        state["players"]["bot"]["hand"] = bot_hand
        state["players"]["mate"]["hand"] = [pick_label(label) for label in ["♠️A", "♥️A", "♣️A", "♠️K", "♥️K"]]
        state["players"]["opp"]["hand"] = [pick_label(label) for label in ["♣️3", "♦️4", "♠️6", "♥️9", "♣️10", "♦️J", "♣️Q", "♠️10"]]
        state["players"]["opp2"]["hand"] = [pick_label(label) for label in ["♥️3", "♣️6", "♦️7", "♣️8", "♥️10", "♠️J", "♥️Q", "♦️J"]]
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "mate",
                                "type": "play",
                                "combo_type": "single",
                                "cards": [
                                    {"label": "♠️4", "rank": 4, "suit": "spades", "joker": None, "is_wild": False}
                                ],
                                "hand_count_after": 8,
                            },
                            {
                                "player_id": "mate",
                                "type": "play",
                                "combo_type": "single",
                                "cards": [
                                    {"label": "♠️A", "rank": 14, "suit": "spades", "joker": None, "is_wild": False}
                                ],
                                "hand_count_after": 6,
                            },
                        ]
                    }
                ],
            }
        ]

        low_single = [next(card["id"] for card in bot_hand if guandan._card_label(card) == "♠️4")]
        low_pair = [card["id"] for card in bot_hand if guandan._card_label(card) in ("♠️5", "♥️5")]
        low_single_combo = guandan._evaluate_combo([next(card for card in bot_hand if guandan._card_label(card) == "♠️4")], 2, {})
        low_pair_combo = guandan._evaluate_combo([card for card in bot_hand if guandan._card_label(card) in ("♠️5", "♥️5")], 2, {})

        self.assertGreater(
            guandan._lead_teammate_support_bonus(state, "bot", low_single, low_single_combo),
            guandan._lead_teammate_support_bonus(state, "bot", low_pair, low_pair_combo),
        )

    def test_opening_prefers_low_natural_pair_over_wild_full_house_when_all_hands_are_deep(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "bot3", "name": "Bot 3", "seat": 2, "is_bot": True},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot3"
        state["current_trick"] = None
        state["config"]["bot_mode"] = "heuristic"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "♠️2", "♠️2", "♣️2", "♥️2", "♣️A", "♥️K", "♠️K", "♥️Q", "♠️Q", "♣️10", "♦️10",
                "♥️9", "♥️9", "♥️8", "♣️7", "♠️6", "♣️6", "♦️5", "♥️5", "♠️4", "♣️4", "♣️4", "♠️4",
                "♠️3", "♦️3", "♣️3", "♦️3",
            ]
        ]
        state["players"]["bot3"]["hand"] = hand
        for pid in ("calvin", "bot2", "bot4"):
            state["players"][pid]["hand"] = deck[:27]
            del deck[:27]

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot3")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "pair")
        self.assertEqual(chosen_labels, ["♦️5", "♥️5"])

    def test_bot_move_rejects_bad_mcts_override_when_heuristic_structure_is_better(self):
        state, big = self._make_state()
        state["config"]["bot_endgame_threshold"] = 0
        bomb_cards = [card for card in state["players"]["bot"]["hand"] if card.get("rank") == 9][:4]
        bad_action = {"type": "play", "card_ids": [card["id"] for card in bomb_cards]}
        bad_scores = [
            (
                bad_action,
                99.0,
                4,
                {"avg": 99.0, "adjusted": 99.0, "std": 0.0, "win_rate": 1.0, "min": 99.0, "max": 99.0},
            )
        ]

        with mock.patch.object(guandan, "_mcts_pick_action", return_value=(bad_action, bad_scores)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        self.assertEqual(action.get("card_ids"), [big["id"]])
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "heuristic")
        self.assertEqual(explain.get("chosen", {}).get("cards"), [guandan._card_label(big)])

    def test_bot_move_ignores_zero_sample_mcts_override(self):
        state, big = self._make_state()
        state["config"]["bot_endgame_threshold"] = 0
        fake_scores = [
            (
                {"type": "pass"},
                99.0,
                0,
                {
                    "avg": 99.0,
                    "adjusted": 99.0,
                    "std": 0.0,
                    "win_rate": 0.0,
                    "min": 99.0,
                    "max": 99.0,
                    "heuristic": 99.0,
                    "heuristic_norm": 0.0,
                    "depth": 0,
                    "tree_ply": 0,
                    "reply_width": 1,
                },
            )
        ]

        with mock.patch.object(guandan, "_mcts_pick_action", return_value=({"type": "pass"}, fake_scores)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        self.assertEqual(action.get("card_ids"), [big["id"]])
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "heuristic")

    def test_bot_move_records_explain_history_and_public_view_exposes_it(self):
        state, big = self._make_state()
        state["config"]["bot_mode"] = "heuristic"

        action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action, {"type": "play", "card_ids": [big["id"]]})
        history = state.get("bot_explain_history", {}).get("bot", [])
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].get("round_number"), state.get("round_number"))
        self.assertEqual(history[0].get("action_type"), "play")
        self.assertEqual(history[0].get("card_ids"), [big["id"]])
        self.assertEqual(history[0].get("explain", {}).get("chosen", {}).get("cards"), ["🃏B"])

        view = guandan.GuandanGame.get_public_view(state, "bot")
        public_history = view.get("bot_explain_history", {}).get("bot", [])
        self.assertEqual(len(public_history), 1)
        self.assertEqual(public_history[0].get("action_type"), "play")
        self.assertEqual(public_history[0].get("explain", {}).get("chosen", {}).get("cards"), ["🃏B"])

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
        self.assertIn("hand_before", explain)
        self.assertIn("🃏B", explain.get("hand_before", []))
        self.assertEqual(explain.get("decision", {}).get("current_turn"), "bot")
        self.assertEqual(explain.get("decision", {}).get("phase"), "playing")
        self.assertEqual(explain.get("decision", {}).get("level_rank"), state["level_rank"])

    def test_nn_explain_includes_nn_scores(self):
        state, big = self._make_state()
        action = {"type": "play", "card_ids": [big["id"]]}
        method_scores = [
            (
                action,
                2.5,
                0,
                {"logit": 2.5, "policy_prob": 0.8, "state_value": 0.35},
            )
        ]

        explain = guandan._build_bot_explain(
            state,
            "bot",
            [big["id"]],
            "nn",
            depth=3,
            method_scores=method_scores,
            method_meta={"candidates": 1, "checkpoint": "guandan_nn.pt"},
        )

        self.assertEqual(explain.get("score_model"), "nn")
        self.assertAlmostEqual(explain["chosen"]["components"]["nn_logit"], 2.5)
        self.assertAlmostEqual(explain["chosen"]["components"]["nn_policy_prob"], 0.8)
        self.assertAlmostEqual(explain["chosen"]["components"]["nn_state_value"], 0.35)

    def test_bot_move_uses_nn_mode_when_configured(self):
        state, big = self._make_state()
        state["config"]["bot_mode"] = "nn"
        nn_action = {"type": "play", "card_ids": [big["id"]]}
        nn_scores = [
            (
                nn_action,
                1.75,
                0,
                {"logit": 1.75, "policy_prob": 0.9, "state_value": 0.2},
            )
        ]

        with mock.patch.object(guandan, "_nn_pick_action", return_value=(nn_action, nn_scores, {"candidates": 1})):
            with mock.patch.object(guandan, "_mcts_pick_action", side_effect=AssertionError("mcts should not run in nn mode")):
                with mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("minimax should not run in nn mode")):
                    action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action, nn_action)
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "nn")
        self.assertEqual(explain.get("score_model"), "nn")
        self.assertEqual(explain.get("chosen", {}).get("cards"), [guandan._card_label(big)])

    def test_bot_move_nn_mode_falls_back_to_heuristic(self):
        state, big = self._make_state()
        state["config"]["bot_mode"] = "nn"
        heuristic_action = {"type": "play", "card_ids": [big["id"]]}

        with mock.patch.object(guandan, "_nn_pick_action", return_value=(None, None, {"error": "missing checkpoint"})):
            with mock.patch.object(guandan, "_heuristic_best_action", return_value=heuristic_action):
                with mock.patch.object(guandan, "_mcts_pick_action", side_effect=AssertionError("mcts should not run in nn fallback")):
                    with mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("minimax should not run in nn fallback")):
                        action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action, heuristic_action)
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "heuristic")

    def test_bot_move_heuristic_mode_skips_search(self):
        state, big = self._make_state()
        state["config"]["bot_mode"] = "heuristic"
        heuristic_action = {"type": "play", "card_ids": [big["id"]]}
        state["config"]["bot_endgame_threshold"] = 99

        with mock.patch.object(guandan, "_heuristic_best_action", return_value=heuristic_action):
            with mock.patch.object(guandan, "_mcts_pick_action", side_effect=AssertionError("mcts should not run in heuristic mode")):
                with mock.patch.object(guandan, "_minimax_pick_action", side_effect=AssertionError("minimax should not run in heuristic mode")):
                    action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action, heuristic_action)
        explain = state.get("bot_explain", {}).get("bot", {})
        self.assertEqual(explain.get("method"), "heuristic")

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

    def test_mcts_past_deadline_returns_heuristic_without_rollout(self):
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

        def heuristic_value(_state, _bot, action, _depth):
            return 5.0 if action == action_a else 1.0

        with mock.patch.object(guandan, "_candidate_actions", return_value=[action_a, action_b]):
            with mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda _s, _p, acts: acts):
                with mock.patch.object(guandan, "_mcts_root_heuristic_value", side_effect=heuristic_value):
                    with mock.patch.object(guandan, "_mcts_reply_tree_value") as reply_tree:
                        picked, scored = guandan._mcts_pick_action(
                            state,
                            "bot",
                            sims=40,
                            depth=6,
                            width=2,
                            tree_ply=2,
                            reply_width=2,
                            risk_lambda=0.28,
                            deadline=0.0,
                        )

        self.assertEqual(picked, action_a)
        self.assertEqual(scored[0][0], action_a)
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
        self.assertEqual(explain.get("method"), "heuristic")
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

    def test_heuristic_low_single_response_prefers_clean_singleton_over_split_pair(self):
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
        four = next(card for card in deck if card.get("rank") == 4 and card.get("suit") == "spades")
        five_a = next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "spades")
        five_b = next(card for card in deck if card.get("rank") == 5 and card.get("suit") == "hearts")
        six = next(card for card in deck if card.get("rank") == 6 and card.get("suit") == "spades")
        nine = next(card for card in deck if card.get("rank") == 9 and card.get("suit") == "clubs")
        jack = next(card for card in deck if card.get("rank") == 11 and card.get("suit") == "diamonds")
        king = next(card for card in deck if card.get("rank") == 13 and card.get("suit") == "hearts")

        state["players"]["bot"]["hand"] = [five_a, five_b, six, nine, jack, king]
        used = {card["id"] for card in state["players"]["bot"]["hand"]} | {four["id"]}
        remaining = [card for card in deck if card["id"] not in used]
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = remaining[idx : idx + 6]
            idx += 6

        combo = guandan._evaluate_combo([four], state["level_rank"], state.get("config", {}))
        state["current_trick"] = {"player_id": "opp", "cards": [four["id"]], "combo": combo}

        split_score = guandan._bot_score_components(state, "bot", [five_a["id"]], depth=3)
        clean_score = guandan._bot_score_components(state, "bot", [six["id"]], depth=3)
        self.assertLess(split_score.get("plan_alignment", 0.0), 0.0)
        self.assertGreater(clean_score.get("total", -999.0), split_score.get("total", -999.0))

        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "play")
        self.assertEqual(action.get("card_ids"), [six["id"]])
        self.assertEqual(guandan._bot_select_play(state, "bot", depth=3), [six["id"]])

    def test_single_response_raises_gate_for_immediate_one_card_opponent(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": False},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["config"]["bot_mode"] = "heuristic"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        bot_hand = [
            pick_label(label)
            for label in ["♥️A", "♣️A", "♠️A", "♣️Q", "♣️J", "♠️J", "♣️6", "♣️4", "♥️4", "♠️4"]
        ]
        state["players"]["bot4"]["hand"] = bot_hand
        state["players"]["calvin"]["hand"] = [pick_label("♦️K")]
        state["players"]["bot3"]["hand"] = deck[:9]
        del deck[:9]
        state["players"]["zhu"]["hand"] = deck[:11]
        del deck[:11]

        lead = pick_label("♦️4")
        state["current_trick"] = {
            "player_id": "zhu",
            "cards": [lead["id"]],
            "combo": guandan._evaluate_combo([lead], state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"] = {"zhu": [lead]}

        hand_map = {guandan._card_label(card): card for card in bot_hand}
        low_response = [hand_map["♣️6"]["id"]]
        high_response = [hand_map["♣️Q"]["id"]]
        low_score = guandan._bot_score_components(state, "bot4", low_response, depth=3)
        high_score = guandan._bot_score_components(state, "bot4", high_response, depth=3)

        self.assertGreater(
            high_score.get("block_next_closeout", 0.0),
            low_score.get("block_next_closeout", 0.0),
        )
        self.assertGreater(high_score.get("total", -999.0), low_score.get("total", -999.0))

        action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(action.get("type"), "play")
        self.assertEqual(action.get("card_ids"), high_response)

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

    def test_strong_teammate_pair_not_overtricked_by_split_ace_bomb(self):
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

        hand = [
            pick_label(label)
            for label in ["♦️A", "♥️A", "♠️A", "♣️A", "♥️K", "♦️K", "♠️K", "♥️Q", "♠️Q", "♦️J", "♠️J", "♠️10", "♠️8", "♥️6", "♥️6"]
        ]
        teammate_pair = [pick_label("♠️K"), pick_label("♣️K")]
        state["players"]["bot"]["hand"] = hand
        idx = 0
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[idx : idx + 15]
            idx += 15

        state["current_trick"] = {
            "player_id": "mate",
            "cards": [card["id"] for card in teammate_pair],
            "combo": guandan._evaluate_combo(teammate_pair, state["level_rank"], state.get("config", {})),
        }

        aa_ids = [card["id"] for card in hand if guandan._card_label(card) in ("♦️A", "♥️A")]
        pass_score = guandan._bot_score_components(state, "bot", None, depth=4)
        play_score = guandan._bot_score_components(state, "bot", aa_ids, depth=4)
        self.assertIn("avoid_overtrick", play_score)
        self.assertGreater(pass_score["total"], play_score["total"])

        rollout_action = guandan._rollout_policy_action(state, "bot")
        self.assertEqual(rollout_action, {"type": "pass"})

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "pass")

    def test_teammate_high_single_protect_bonus_is_bounded(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "🃏B",
                "♦️2",
                "♠️2",
                "♣️2",
                "♥️A",
                "♠️A",
                "♠️A",
                "♣️A",
                "♣️A",
                "♣️Q",
                "♦️Q",
                "♠️J",
                "♦️J",
                "♥️J",
                "♣️10",
                "♠️9",
                "♣️9",
                "♠️8",
                "♣️8",
                "♣️7",
                "♥️5",
                "♠️5",
                "♠️5",
                "♦️4",
                "♥️4",
                "♦️3",
                "♥️3",
            ]
        ]
        state["players"]["bot4"]["hand"] = hand
        for pid, count in (("calvin", 20), ("bot2", 26), ("zhu", 27)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        full_deck = guandan._full_deck()
        lead_card = next(card for card in full_deck if guandan._card_label(card) == "♥️K")
        prior_card = next(card for card in full_deck if guandan._card_label(card) == "♦️Q")
        state["current_trick"] = {
            "player_id": "bot2",
            "cards": [lead_card["id"]],
            "combo": guandan._evaluate_combo([lead_card], state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"] = {"calvin": [prior_card], "bot2": [lead_card], "zhu": []}

        pass_score = guandan._bot_score_components(state, "bot4", None, depth=2)
        big_joker = next(card["id"] for card in hand if guandan._card_label(card) == "🃏B")
        joker_score = guandan._bot_score_components(state, "bot4", [big_joker], depth=2)

        self.assertLess(pass_score.get("protect_teammate", 0.0), 12.0)
        self.assertLess(joker_score.get("avoid_overtrick", 0.0), 20.0)
        self.assertGreater(pass_score["total"], joker_score["total"])

        action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(action.get("type"), "pass")

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

    def test_mcts_bombs_small_joker_when_seen_cards_remove_all_larger_overbombs(self):
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

        bomb_labels = ["♠️9", "♥️9", "♣️9", "♦️9"]
        tail_labels = ["♠️A", "♥️A", "♠️K", "♥️K", "♠️Q", "♥️Q"]
        state["players"]["bot"]["hand"] = [pick_label(label) for label in bomb_labels + tail_labels]
        state["seen_cards"] = [
            pick_label(label)["id"]
            for label in [
                "🃏B",
                "♠️10",
                "♥️10",
                "♣️10",
                "♦️10",
                "♠️J",
                "♥️J",
                "♣️J",
                "♦️J",
                "♣️Q",
                "♦️Q",
                "♣️K",
                "♦️K",
                "♦️A",
                "♠️2",
                "♥️2",
                "♣️2",
                "♦️2",
            ]
        ]
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:8]
            del deck[:8]

        small_joker = pick_label("🃏S")
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [small_joker["id"]],
            "combo": guandan._evaluate_combo([small_joker], state["level_rank"], state.get("config", {})),
        }
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "opp",
                                "type": "play",
                                "combo_type": "single",
                                "cards": [{"label": "♦️A", "rank": 14, "suit": "diamonds", "joker": None, "is_wild": False}],
                                "hand_count_after": 9,
                            },
                            {
                                "player_id": "opp2",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♣️K", "rank": 13, "suit": "clubs", "joker": None, "is_wild": False},
                                    {"label": "♦️K", "rank": 13, "suit": "diamonds", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 8,
                            },
                        ]
                    }
                ],
            }
        ]

        bomb_ids = [card["id"] for card in state["players"]["bot"]["hand"] if guandan._card_label(card) in set(bomb_labels)]
        pass_score = guandan._bot_score_play(state, "bot", None, depth=4)
        bomb_score = guandan._bot_score_play(state, "bot", bomb_ids, depth=4)
        self.assertGreater(bomb_score, pass_score)

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot")

        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, bomb_labels)

    def test_mcts_preserves_bomb_against_small_joker_when_tail_is_low_three_pairs_and_history_is_structured(self):
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

        bomb_labels = ["♠️9", "♥️9", "♣️9", "♦️9"]
        tail_labels = ["♠️3", "♥️3", "♠️4", "♥️4", "♠️5", "♥️5", "♣️6"]
        state["players"]["bot"]["hand"] = [pick_label(label) for label in bomb_labels + tail_labels]
        state["seen_cards"] = [pick_label("♦️A")["id"]]
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:8]
            del deck[:8]

        small_joker = pick_label("🃏S")
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [small_joker["id"]],
            "combo": guandan._evaluate_combo([small_joker], state["level_rank"], state.get("config", {})),
        }
        state["round_memories"] = [
            {
                "round_number": 1,
                "tricks": [
                    {
                        "actions": [
                            {
                                "player_id": "opp2",
                                "type": "play",
                                "combo_type": "pair",
                                "cards": [
                                    {"label": "♠️6", "rank": 6, "suit": "spades", "joker": None, "is_wild": False},
                                    {"label": "♥️6", "rank": 6, "suit": "hearts", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 8,
                            },
                            {
                                "player_id": "opp2",
                                "type": "play",
                                "combo_type": "three",
                                "cards": [
                                    {"label": "♠️7", "rank": 7, "suit": "spades", "joker": None, "is_wild": False},
                                    {"label": "♥️7", "rank": 7, "suit": "hearts", "joker": None, "is_wild": False},
                                    {"label": "♣️7", "rank": 7, "suit": "clubs", "joker": None, "is_wild": False},
                                ],
                                "hand_count_after": 5,
                            },
                        ]
                    }
                ],
            }
        ]

        bomb_ids = [card["id"] for card in state["players"]["bot"]["hand"] if guandan._card_label(card) in set(bomb_labels)]
        pass_score = guandan._bot_score_play(state, "bot", None, depth=4)
        bomb_score = guandan._bot_score_play(state, "bot", bomb_ids, depth=4)
        self.assertGreater(pass_score, bomb_score)

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

    def test_response_does_not_pass_when_opponent_sits_between_bot_and_teammate(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "B"
        state["level_rank"] = 2
        state["current_turn"] = "bot3"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot3"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏S",
                "♥️A",
                "♠️A",
                "♣️K",
                "♦️K",
                "♦️Q",
                "♣️Q",
                "♦️J",
                "♥️J",
                "♠️J",
                "♥️J",
                "♦️J",
                "♥️10",
                "♥️10",
                "♠️10",
                "♥️4",
                "♣️4",
                "♣️4",
                "♣️3",
                "♠️3",
                "♣️3",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:19]
        del deck[:19]
        state["players"]["zhu"]["hand"] = deck[:21]
        del deck[:21]
        state["players"]["bot4"]["hand"] = deck[:10]
        del deck[:10]

        lead = pick_label("♦️6")
        state["current_trick"] = {
            "player_id": "calvin",
            "cards": [lead["id"]],
            "combo": guandan._evaluate_combo([lead], state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"] = {"calvin": [lead]}

        pass_components = guandan._bot_score_components(state, "bot3", None, depth=3)
        self.assertIn("pass_lane_concession", pass_components)

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot3")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "single")

    def test_single_response_does_not_spend_wild_or_joker_when_natural_control_pass_is_available(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot2"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot2"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏S",
                "♦️2",
                "♥️2",
                "♣️2",
                "♣️A",
                "♠️A",
                "♠️A",
                "♦️A",
                "♦️A",
                "♣️K",
                "♦️K",
                "♠️K",
                "♥️K",
                "♣️Q",
                "♠️J",
                "♣️J",
                "♦️9",
                "♠️8",
                "♥️8",
                "♣️8",
                "♦️7",
                "♣️4",
                "♦️4",
                "♦️3",
                "♣️3",
                "♥️3",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:25]
        del deck[:25]
        state["players"]["zhu"]["hand"] = deck[:26]
        del deck[:26]
        state["players"]["bot3"]["hand"] = deck[:26]
        del deck[:26]

        lead = pick_label("♦️Q")
        state["current_trick"] = {
            "player_id": "calvin",
            "cards": [lead["id"]],
            "combo": guandan._evaluate_combo([lead], state["level_rank"], state.get("config", {})),
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot2")

        explain = state.get("bot_explain", {}).get("bot2", {})
        chosen = explain.get("chosen", {}).get("cards", [])
        self.assertNotIn(chosen, (["♥️2"], ["🃏S"]))
        if action.get("type") == "play":
            hand_map = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
            chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
            self.assertFalse(any(card.get("joker") == "small" for card in chosen_cards))
            self.assertFalse(any(guandan._is_wild(card, state["level_rank"]) for card in chosen_cards))

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

    def test_opponent_short_three_pairs_prefers_natural_takeover_over_pass(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "🃏S",
                "♦️A",
                "♠️K",
                "♣️K",
                "♣️Q",
                "♠️Q",
                "♦️J",
                "♥️J",
                "♠️J",
                "♥️10",
                "♣️10",
                "♣️10",
                "♣️8",
                "♠️7",
                "♦️7",
                "♥️7",
                "♠️7",
                "♠️6",
                "♦️5",
                "♠️5",
                "♥️5",
                "♠️4",
            ]
        ]
        trick_cards = [pick_label(label) for label in ["♣️9", "♥️9", "♦️10", "♠️10", "♣️J", "♥️J"]]
        state["players"]["bot4"]["hand"] = hand
        for pid, count in (("calvin", 22), ("bot3", 20), ("zhu", 14)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]
        state["current_trick"] = {
            "player_id": "zhu",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"] = {"zhu": trick_cards}

        action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot4", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, ["♦️J", "♥️J", "♣️Q", "♠️Q", "♠️K", "♣️K"])

    def test_opponent_short_pair_of_level_prefers_minimal_bomb_over_pass(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "♦️A",
                "♠️K",
                "♣️K",
                "♣️Q",
                "♠️Q",
                "♦️J",
                "♥️J",
                "♠️J",
                "♥️10",
                "♣️10",
                "♣️10",
                "♣️8",
                "♠️7",
                "♦️7",
                "♥️7",
                "♠️7",
                "♠️6",
                "♦️5",
                "♠️5",
                "♥️5",
                "♠️4",
            ]
        ]
        trick_cards = [pick_label(label) for label in ["♠️2", "♣️2"]]
        state["players"]["bot4"]["hand"] = hand
        for pid, count in (("calvin", 22), ("bot3", 20), ("zhu", 10)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]
        state["current_trick"] = {
            "player_id": "zhu",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"] = {"zhu": trick_cards}

        self.assertIsNone(guandan._best_response_play_score(state, "bot4", 2, non_bomb_only=True))
        bomb_ids = guandan._filter_overbomb_options(state, "bot4", guandan._list_hint_options(state, "bot4"))[0]
        self.assertGreater(
            guandan._bot_score_play(state, "bot4", bomb_ids, depth=2),
            guandan._bot_score_play(state, "bot4", None, depth=2),
        )

        action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot4", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, ["♠️7", "♦️7", "♥️7", "♠️7"])

    def test_low_clean_single_response_prefers_takeover_over_pass(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 2
        state["dealer_team"] = "A"
        state["level_rank"] = 5
        state["current_turn"] = "bot4"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "♣️5",
                "♣️K",
                "♥️K",
                "♠️Q",
                "♥️Q",
                "♦️Q",
                "♥️J",
                "♠️J",
                "♦️J",
                "♥️J",
                "♦️6",
                "♠️4",
                "♥️4",
                "♥️4",
                "♥️3",
                "♣️2",
            ]
        ]
        trick_cards = [pick_label("♠️4")]
        state["players"]["bot4"]["hand"] = hand
        for pid, count in (("calvin", 17), ("bot3", 22), ("zhu", 17)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]
        state["current_trick"] = {
            "player_id": "zhu",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }
        state["trick_plays"] = {"zhu": trick_cards}

        six_id = next(card["id"] for card in hand if guandan._card_label(card) == "♦️6")
        six_comps = guandan._bot_score_components(state, "bot4", [six_id], 2)
        self.assertGreater(six_comps.get("cheap_clean_single_takeover", 0.0), 0.0)
        self.assertGreater(
            guandan._bot_score_play(state, "bot4", [six_id], depth=2),
            guandan._bot_score_play(state, "bot4", None, depth=2),
        )

        action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot4", {}).get("chosen", {}).get("cards", [])
        self.assertEqual(chosen, ["♦️6"])

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

    def test_midgame_single_lead_prefers_low_orphan_over_overlap_run_bonus(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "bot3", "name": "Bot 3", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "B"
        state["level_rank"] = 2
        state["current_turn"] = "bot2"
        state["current_trick"] = None
        state["config"]["bot_mode"] = "heuristic"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "♣️2",
                "♠️K",
                "♥️K",
                "♠️Q",
                "♥️Q",
                "♣️Q",
                "♠️J",
                "♥️J",
                "♣️J",
                "♦️J",
                "♦️7",
                "♥️6",
                "♦️6",
                "♠️6",
                "♥️5",
                "♠️5",
                "♣️4",
                "♥️4",
                "♣️3",
            ]
        ]
        state["players"]["bot2"]["hand"] = hand
        for pid, count in (("calvin", 19), ("bot3", 27), ("bot4", 27)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        hand_map = guandan._map_hand_by_id(hand)
        club_three = [next(card["id"] for card in hand if guandan._card_label(card) == "♣️3")]
        diamond_seven = [next(card["id"] for card in hand if guandan._card_label(card) == "♦️7")]
        self.assertGreater(
            guandan._bot_score_play(state, "bot2", club_three, depth=2),
            guandan._bot_score_play(state, "bot2", diamond_seven, depth=2),
        )

    def test_minimax_lead_avoids_feeding_low_single_to_immediate_short_opponent(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot4"
        state["current_trick"] = None
        state["finish_order"] = ["zhu"]
        state["players"]["zhu"]["finished"] = True
        state["players"]["zhu"]["finish_rank"] = 1
        state["config"]["bot_endgame_threshold"] = 999
        state["config"]["bot_minimax_depth"] = 5
        state["config"]["bot_minimax_width"] = 8

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot4"]["hand"] = [
            pick_label(label)
            for label in ["♣️2", "♦️2", "♠️2", "♣️2", "♣️Q", "♥️J", "♦️10", "♦️7", "♠️5", "♥️4"]
        ]
        state["players"]["calvin"]["hand"] = [pick_label("♠️A")]
        state["players"]["bot2"]["hand"] = [
            pick_label(label) for label in ["♠️K", "♥️K", "♣️J", "♦️6", "♣️5"]
        ]
        state["players"]["zhu"]["hand"] = []

        actions = guandan._candidate_actions(state, "bot4", 12)
        hand_map = guandan._map_hand_by_id(state["players"]["bot4"]["hand"])
        play_labels = [
            [guandan._card_label(hand_map[cid]) for cid in action.get("card_ids", [])]
            for action in actions
            if action.get("type") == "play"
        ]
        self.assertIn(["♣️Q"], play_labels)
        self.assertNotIn(["♥️4"], play_labels)
        self.assertNotIn(["♠️5"], play_labels)
        self.assertNotIn(["♦️7"], play_labels)

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot4")

        self.assertEqual(action.get("type"), "play")
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        self.assertEqual(chosen_labels, ["♣️Q"])

    def test_endgame_response_blocks_one_card_opponent_with_big_joker(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["current_turn"] = "bot"
        state["level_rank"] = 2
        state["config"]["bot_mode"] = "heuristic"
        state["config"]["bot_endgame_threshold"] = 0

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        big = next(deck.pop(idx) for idx, card in enumerate(deck) if card.get("joker") == "big")
        lead_ace = pick_label("♠️A")
        state["players"]["bot"]["hand"] = [
            big,
            pick_label("♠️K"),
            pick_label("♥️K"),
            pick_label("♣️K"),
            pick_label("♠️7"),
            pick_label("♥️7"),
            pick_label("♣️5"),
        ]
        state["players"]["opp"]["hand"] = [pick_label("♣️3")]
        state["players"]["mate"]["hand"] = [pick_label("♣️Q"), pick_label("♦️Q"), pick_label("♠️6")]
        state["players"]["opp2"]["hand"] = [pick_label("♣️4"), pick_label("♦️4"), pick_label("♠️4")]
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [lead_ace["id"]],
            "combo": guandan._evaluate_combo([lead_ace], state["level_rank"], state.get("config", {})),
        }

        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action, {"type": "play", "card_ids": [big["id"]]})

    def test_endgame_lead_avoids_exposed_single_after_forcing_control(self):
        players = [
            {"player_id": "bot", "name": "Bot", "seat": 0, "is_bot": True},
            {"player_id": "opp", "name": "Opp", "seat": 1, "is_bot": False},
            {"player_id": "mate", "name": "Mate", "seat": 2, "is_bot": False},
            {"player_id": "opp2", "name": "Opp2", "seat": 3, "is_bot": False},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["current_turn"] = "bot"
        state["level_rank"] = 2
        state["config"]["bot_mode"] = "auto"
        state["config"]["bot_endgame_threshold"] = 999
        state["config"]["bot_minimax_depth"] = 5
        state["config"]["bot_minimax_width"] = 10

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        big = next(deck.pop(idx) for idx, card in enumerate(deck) if card.get("joker") == "big")
        state["players"]["bot"]["hand"] = [
            big,
            pick_label("♠️K"),
            pick_label("♥️K"),
            pick_label("♣️K"),
            pick_label("♠️7"),
            pick_label("♥️7"),
            pick_label("♣️5"),
        ]
        state["players"]["opp"]["hand"] = [pick_label("♠️A")]
        state["players"]["mate"]["hand"] = [pick_label("♣️Q"), pick_label("♦️Q"), pick_label("♠️6")]
        state["players"]["opp2"]["hand"] = [pick_label("♣️4"), pick_label("♦️4"), pick_label("♠️4")]
        state["current_trick"] = None

        hand_map = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action.get("type"), "play")
        chosen_labels = [guandan._card_label(hand_map[cid]) for cid in action.get("card_ids", [])]
        self.assertNotEqual(chosen_labels, ["♣️5"])
        self.assertIn(chosen_labels, (["♠️7", "♥️7"], ["♠️K", "♥️K", "♣️K", "♠️7", "♥️7"], ["♠️K", "♥️K", "♣️K"]))

    def test_lead_prefers_lower_steel_plate_when_two_steel_plates_exist(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "B"
        state["level_rank"] = 2
        state["current_turn"] = "bot3"
        state["current_trick"] = None

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot3"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏S",
                "♦️J",
                "♥️J",
                "♠️J",
                "♥️J",
                "♦️J",
                "♥️10",
                "♥️10",
                "♠️10",
                "♥️4",
                "♣️4",
                "♣️4",
                "♣️3",
                "♠️3",
                "♣️3",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:7]
        del deck[:7]
        state["players"]["zhu"]["hand"] = deck[:20]
        del deck[:20]
        state["players"]["bot4"]["hand"] = deck[:10]
        del deck[:10]

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot3")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "steel_plate")
        self.assertEqual(chosen_labels, ["♣️3", "♠️3", "♣️3", "♥️4", "♣️4", "♣️4"])

    def test_opening_values_hard_to_answer_steel_plate_over_small_three(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot2"
        state["current_trick"] = None
        state["config"]["bot_mode"] = "heuristic"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "🃏S",
                "♥️A",
                "♠️K",
                "♦️K",
                "♣️Q",
                "♦️J",
                "♠️J",
                "♥️10",
                "♠️10",
                "♦️7",
                "♠️7",
                "♦️7",
                "♣️7",
                "♦️6",
                "♣️6",
                "♦️6",
                "♥️5",
                "♣️5",
                "♦️5",
                "♥️4",
                "♠️4",
                "♦️4",
            ]
        ]
        state["players"]["bot2"]["hand"] = hand
        for pid, count in (("calvin", 25), ("zhu", 26), ("bot4", 27)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot2")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(hand)
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "steel_plate")
        self.assertIn(
            chosen_labels,
            [
                ["♥️4", "♠️4", "♦️4", "♥️5", "♣️5", "♦️5"],
                ["♥️5", "♣️5", "♦️5", "♦️6", "♣️6", "♦️6"],
            ],
        )

    def test_lead_avoids_high_wild_straight_and_prefers_three_pairs(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 2
        state["dealer_team"] = "A"
        state["level_rank"] = 5
        state["current_turn"] = "bot3"
        state["current_trick"] = None

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        state["players"]["bot3"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏S",
                "♥️5",
                "♣️5",
                "♦️5",
                "♣️5",
                "♣️A",
                "♠️K",
                "♦️Q",
                "♣️Q",
                "♣️Q",
                "♦️Q",
                "♥️Q",
                "♥️J",
                "♦️10",
                "♦️8",
                "♦️7",
                "♣️7",
                "♠️7",
                "♥️7",
                "♦️6",
                "♠️6",
                "♠️4",
                "♠️4",
                "♠️3",
                "♥️3",
                "♣️2",
                "♣️2",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:27]
        del deck[:27]
        state["players"]["bot2"]["hand"] = deck[:27]
        del deck[:27]
        state["players"]["zhu"]["hand"] = deck[:27]
        del deck[:27]

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot3")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_labels = [guandan._card_label(card) for card in chosen_cards]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "three_pairs")
        self.assertEqual(chosen_labels, ["♣️2", "♣️2", "♠️3", "♥️3", "♠️4", "♠️4"])

    def test_full_house_response_avoids_spending_wild_when_natural_response_exists(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 2
        state["dealer_team"] = "A"
        state["level_rank"] = 5
        state["current_turn"] = "bot2"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        def pick_rank_suit(rank, suit):
            for idx, card in enumerate(deck):
                if card.get("rank") == rank and card.get("suit") == suit:
                    return deck.pop(idx)
            raise AssertionError((rank, suit))

        trick_cards = [
            pick_rank_suit(8, "spades"),
            pick_rank_suit(8, "clubs"),
            pick_rank_suit(8, "diamonds"),
            pick_rank_suit(2, "diamonds"),
            pick_rank_suit(2, "diamonds"),
        ]
        state["players"]["bot2"]["hand"] = [
            pick_label(label)
            for label in [
                "♥️5",
                "♦️5",
                "♦️A",
                "♦️A",
                "♥️A",
                "♠️A",
                "♠️K",
                "♥️K",
                "♠️Q",
                "♦️J",
                "♥️J",
                "♠️10",
                "♠️9",
                "♣️9",
                "♣️8",
                "♠️7",
                "♦️7",
                "♣️7",
                "♥️6",
                "♣️4",
                "♦️3",
                "♠️3",
                "♦️3",
                "♠️2",
                "♥️2",
                "♥️2",
                "♠️2",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:18]
        del deck[:18]
        state["players"]["zhu"]["hand"] = deck[:27]
        del deck[:27]
        state["players"]["bot3"]["hand"] = deck[:16]
        del deck[:16]
        state["current_trick"] = {
            "player_id": "calvin",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot2")

        self.assertEqual(action.get("type"), "play")
        chosen = state.get("bot_explain", {}).get("bot2", {}).get("chosen", {}).get("cards", [])
        self.assertNotIn("♥️5", chosen)
        hand_map = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(combo.get("type"), "full_house")
        self.assertFalse(combo.get("uses_wild"))

    def test_three_response_does_not_pass_when_lane_to_teammate_is_opened_for_opponent(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot3", "name": "Bot 3", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 2
        state["dealer_team"] = "A"
        state["level_rank"] = 5
        state["current_turn"] = "bot3"

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        def pick_rank_suit(rank, suit):
            for idx, card in enumerate(deck):
                if card.get("rank") == rank and card.get("suit") == suit:
                    return deck.pop(idx)
            raise AssertionError((rank, suit))

        trick_cards = [
            pick_rank_suit(3, "clubs"),
            pick_rank_suit(3, "clubs"),
            pick_rank_suit(3, "hearts"),
        ]
        state["players"]["bot3"]["hand"] = [
            pick_label(label)
            for label in [
                "🃏S",
                "♥️5",
                "♣️5",
                "♦️5",
                "♣️5",
                "♣️Q",
                "♣️Q",
                "♦️Q",
                "♥️Q",
                "♦️8",
                "♦️7",
                "♣️7",
                "♠️7",
                "♥️7",
                "♦️6",
                "♠️6",
            ]
        ]
        state["players"]["calvin"]["hand"] = deck[:13]
        del deck[:13]
        state["players"]["bot2"]["hand"] = deck[:15]
        del deck[:15]
        state["players"]["zhu"]["hand"] = deck[:22]
        del deck[:22]
        state["current_trick"] = {
            "player_id": "zhu",
            "cards": [card["id"] for card in trick_cards],
            "combo": guandan._evaluate_combo(trick_cards, state["level_rank"], state.get("config", {})),
        }

        real_random = random.Random
        with mock.patch.object(guandan.random, "Random", side_effect=lambda *args, **kwargs: real_random(0)):
            action = guandan.GuandanGame.bot_move(state, "bot3")

        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(state["players"]["bot3"]["hand"])
        chosen_cards = [hand_map[cid] for cid in action.get("card_ids", []) if cid in hand_map]
        chosen_combo = guandan._evaluate_combo(chosen_cards, state["level_rank"], state.get("config", {}))
        self.assertEqual(chosen_combo.get("type"), "three")

    def test_midgame_lead_prefers_structured_straight_over_high_single(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "A"
        state["level_rank"] = 2
        state["current_turn"] = "bot2"
        state["config"]["bot_endgame_threshold"] = 0
        state["current_trick"] = None

        deck = guandan._full_deck()

        def pick_label(label):
            for idx, card in enumerate(deck):
                if guandan._card_label(card) == label:
                    return deck.pop(idx)
            raise AssertionError(f"missing card {label}")

        hand = [
            pick_label(label)
            for label in [
                "🃏B",
                "🃏S",
                "♦️2",
                "♣️2",
                "♥️A",
                "♦️A",
                "♠️J",
                "♠️9",
                "♣️8",
                "♣️7",
                "♣️6",
                "♥️6",
                "♦️6",
                "♦️5",
                "♦️5",
                "♣️5",
                "♦️4",
                "♠️3",
            ]
        ]
        state["players"]["bot2"]["hand"] = hand
        state["players"]["calvin"]["hand"] = []
        state["players"]["calvin"]["finished"] = True
        state["players"]["calvin"]["finish_rank"] = 1
        state["finish_order"] = ["calvin"]
        for pid, count in (("zhu", 15), ("bot4", 17)):
            state["players"][pid]["hand"] = deck[:count]
            del deck[:count]

        action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(action.get("type"), "play")
        hand_map = guandan._map_hand_by_id(hand)
        labels = [guandan._card_label(hand_map[cid]) for cid in action.get("card_ids", [])]
        self.assertEqual(labels, ["♦️5", "♣️6", "♣️7", "♣️8", "♠️9"])
