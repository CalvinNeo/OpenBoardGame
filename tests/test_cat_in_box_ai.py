import copy
import random
import unittest
from collections import Counter
from unittest.mock import patch

from jsonschema import Draft7Validator

from game import get_game
from game.ai_metadata import STRATEGIC_AI_GAME_IDS
from game.cat_in_box import COLORS, CatInBoxGame as Game
from game.cat_in_box_ai import _chance_of_any, _unseen_counts, _win_probability, choose_action


def _players(count):
    return [
        {"player_id": f"p{index}", "name": f"Player {index}", "seat": index, "is_bot": True}
        for index in range(count)
    ]


def _position(hand, trick=(), bid=1, won=0):
    state = Game.init_game({}, _players(3))
    state.update({
        "phase": "trick",
        "current_turn": "p2",
        "round_start_player": "p2",
        "current_trick": [
            {"player_id": player_id, "value": value, "color": color}
            for player_id, value, color in trick
        ],
        "lead_color": trick[0][2] if trick else None,
    })
    for player in state["players"].values():
        player.update({"hand": [], "bid": 1, "discarded": True})
    state["players"]["p2"].update({"hand": list(hand), "bid": bid, "tricks_won": won})
    for player_id, value, color in trick:
        state["board"][COLORS.index(color)][value - 1] = player_id
    return state


class CatInBoxAiTests(unittest.TestCase):
    def setUp(self):
        self.random_state = random.getstate()
        random.seed(26)
        self.validator = Draft7Validator(get_game(Game.game_id).action_schema)

    def tearDown(self):
        random.setstate(self.random_state)

    def assert_action(self, state, expected=None, player_id="p2"):
        before = copy.deepcopy(state)
        random_state = random.getstate()
        action = Game.bot_move(state, player_id)
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), random_state)
        self.assertIsNotNone(action)
        self.assertEqual(action, Game.bot_move(state, player_id))
        if expected is not None:
            self.assertEqual(action, expected)
        self.validator.validate(action)
        _, error = Game.apply_action(state, player_id, action)
        self.assertIsNone(error)
        return action

    def test_registered_as_strategic_ai(self):
        self.assertIn(Game.game_id, STRATEGIC_AI_GAME_IDS)

    def test_waits_for_own_turn_and_ignores_unknown_players(self):
        state = _position([2, 4])
        self.assertIsNone(Game.bot_move(state, "p0"))
        self.assertIsNone(Game.bot_move(state, "spectator"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p2"))

    def test_discards_an_overcrowded_number(self):
        state = Game.init_game({}, _players(3))
        state["players"]["p2"]["hand"] = [1, 2, 3, 4, 5, 6, 6, 6, 6, 6]
        self.assert_action(state, {"type": "discard", "card_value": 6})
        self.assertIsNone(Game.bot_move(state, "p2"))

    def test_discards_a_duplicate_before_an_uncontested_number(self):
        state = Game.init_game({}, _players(3))
        state["players"]["p2"]["hand"] = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6]
        self.assert_action(state, {"type": "discard", "card_value": 1})

    def test_bid_responds_to_hand_strength(self):
        for hand, expected_bid in (
            ([1, 1, 1, 1, 2, 2, 2, 3, 3], 1),
            ([1, 1, 2, 2, 3, 3, 4, 5, 6], 2),
            ([4, 4, 5, 5, 5, 6, 6, 6, 6], 3),
        ):
            with self.subTest(hand=hand):
                state = _position(hand)
                state["phase"] = "bidding"
                state["players"]["p2"]["bid"] = None
                self.assert_action(state, {"type": "bid", "bid": expected_bid})

    def test_two_players_bid_without_discarding(self):
        state = Game.init_game({}, _players(2))
        action = self.assert_action(state, player_id="p0")
        self.assertEqual(action["type"], "bid")
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_uses_trump_to_complete_bid_on_last_card(self):
        state = _position([2], (("p0", 6, "blue"), ("p1", 5, "yellow")))
        self.assert_action(state, {"type": "play_card", "card_value": 2, "color": "red"})

    def test_takes_trick_with_smallest_sufficient_trump(self):
        state = _position([2, 5], (("p0", 1, "red"), ("p1", 3, "blue")))
        self.assert_action(state, {"type": "play_card", "card_value": 2, "color": "red"})

    def test_takes_base_points_when_bid_is_already_exceeded(self):
        state = _position([2], (("p0", 6, "blue"), ("p1", 5, "yellow")), won=2)
        self.assert_action(state, {"type": "play_card", "card_value": 2, "color": "red"})

    def test_avoids_overtrick_when_bid_already_met(self):
        state = _position([2], (("p0", 6, "blue"), ("p1", 5, "yellow")), won=1)
        state["board"][2][1:4] = ["p2"] * 3
        action = Game.bot_move(state, "p2")
        self.assertNotEqual(action["color"], "red")
        self.assert_action(state, action)
        self.assertEqual(state["last_round_summary"]["tricks"]["p2"], 1)
        self.assertGreaterEqual(state["last_round_summary"]["bonus"]["p2"], 4)

    def test_builds_a_bridge_between_owned_groups(self):
        state = _position([3], (("p0", 6, "red"), ("p1", 5, "blue")), won=1)
        for value in (1, 2, 4, 5):
            state["board"][2][value - 1] = "p2"
        self.assert_action(state, {"type": "play_card", "card_value": 3, "color": "yellow"})
        self.assertEqual(state["last_round_summary"]["bonus"]["p2"], 5)

    def test_does_not_void_the_only_color_for_remaining_card(self):
        state = _position([2, 5], (("p0", 1, "blue"), ("p1", 4, "green")))
        state["players"]["p2"]["color_available"].update({"yellow": False, "green": False})
        state["board"][0][4] = "p0"
        action = Game.bot_move(state, "p2")
        self.assertEqual(action["color"], "blue")
        self.assert_action(state, action)
        self.assertTrue(state["players"]["p2"]["color_available"]["blue"])
        self.assertIsNone(state["paradox_player"])

    def test_sheds_a_number_with_only_one_slot_remaining(self):
        state = _position([1, 5], (("p0", 6, "red"), ("p1", 3, "blue")))
        for row in range(3):
            state["board"][row][0] = "p0"
        self.assert_action(state, {"type": "play_card", "card_value": 1, "color": "green"})

    def test_never_uses_void_colors_or_occupied_slots(self):
        state = _position([2])
        state["players"]["p2"]["color_available"].update({"red": False, "green": False})
        state["board"][1][1] = "p0"
        self.assert_action(state, {"type": "play_card", "card_value": 2, "color": "yellow"})

    def test_no_play_available_returns_none(self):
        state = _position([2])
        for row in state["board"]:
            row[1] = "p0"
        self.assertIsNone(Game.bot_move(state, "p2"))

    def test_policy_receives_only_the_public_view(self):
        state = _position([2, 4])
        view = Game.get_public_view(state, "p2")
        with patch("game.cat_in_box_ai.choose_action", wraps=choose_action) as decision:
            Game.bot_move(state, "p2")
        decision.assert_called_once_with(view)
        self.assertNotIn("deck", view)
        self.assertNotIn("removed_cards", view)
        self.assertTrue(all("hand" not in player for player in view["players"]))

    def test_hidden_cards_do_not_change_decision(self):
        state = _position([1, 3, 5])
        state["players"]["p0"]["hand"] = [1, 2, 3]
        state["players"]["p1"]["hand"] = [4, 5, 6]
        original_view = copy.deepcopy(Game.get_public_view(state, "p2"))
        expected = Game.bot_move(state, "p2")
        state["players"]["p0"]["hand"], state["players"]["p1"]["hand"] = (
            state["players"]["p1"]["hand"], state["players"]["p0"]["hand"]
        )
        state["deck"] = [6, 6, 6]
        state["removed_cards"] = [1, 1, 1]
        self.assertEqual(Game.get_public_view(state, "p2"), original_view)
        self.assertEqual(Game.bot_move(state, "p2"), expected)

    def test_unknown_pool_counts_board_cards_once(self):
        state = _position([2, 2], (("p0", 2, "red"), ("p1", 3, "blue")))
        view = Game.get_public_view(state, "p2")
        unseen = _unseen_counts(view, Counter(view["hand"]))
        self.assertEqual(unseen[2], 2)
        self.assertEqual(unseen[3], 4)
        self.assertEqual(_chance_of_any(Counter({1: 2, 2: 2}), [1], 1), 0.5)
        self.assertEqual(_chance_of_any(Counter({1: 2, 2: 2}), [1], 3), 1.0)

    def test_win_estimate_only_considers_unplayed_opponents_and_available_colors(self):
        state = _position([5, 6], (("p0", 1, "blue"),))
        state["players"]["p0"]["hand"] = [1, 2, 3, 4, 5]
        state["players"]["p1"]["hand"] = [1, 2, 3, 4, 5, 6]
        state["players"]["p1"]["color_available"].update({"red": False, "blue": False})
        view = Game.get_public_view(state, "p2")
        board = copy.deepcopy(view["board"])
        board[1][4] = "p2"
        unseen = _unseen_counts(view, Counter(view["hand"]))
        self.assertEqual(_win_probability(view, 5, "blue", board, unseen), 1.0)
        view["players"][1]["color_available"]["red"] = True
        self.assertLess(_win_probability(view, 5, "blue", board, unseen), 1.0)

    def test_bots_complete_games_for_all_supported_player_counts(self):
        for count in range(2, 6):
            for seed in range(6):
                with self.subTest(count=count, seed=seed):
                    random.seed(100 * count + seed)
                    state = Game.init_game({}, _players(count))
                    for step in range(350):
                        if state["game_over"]:
                            break
                        active = next((
                            player_id for player_id in state["turn_order"]
                            if Game.get_legal_actions(state, player_id)
                        ), None)
                        self.assertIsNotNone(active, (count, seed, step, state["phase"]))
                        self.assert_action(state, player_id=active)
                    self.assertTrue(state["game_over"])
                    self.assertEqual(state["round"], count)
                    self.assertTrue(state["winners"])


if __name__ == "__main__":
    unittest.main()
