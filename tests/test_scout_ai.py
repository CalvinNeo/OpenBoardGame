import copy
import unittest

from game.scout import ScoutGame, _build_active_set, _classify_cards, _enumerate_show_moves
from game.scout_ai import _combos, _hand_cost


def _cards(values):
    return [{"id": f"test-{index}-{value}", "values": [value, 10 if value != 10 else 1], "face_up": 0}
            for index, value in enumerate(values)]


def _state(hand, active=None, count=4):
    players = [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index}
               for index in range(count)]
    state = ScoutGame.init_game({"seed": 17}, players)
    state["phase"] = "playing"
    state["current_turn"] = "p0"
    for player in state["players"].values():
        player["hand_ready"] = True
        player["hand"] = _cards([1, 4, 6, 3, 8, 2, 5])
    state["players"]["p0"]["hand"] = _cards(hand)
    state["active_set"] = _build_active_set("p1", _cards(active)) if active else None
    return state


class ScoutAiTests(unittest.TestCase):
    def test_weak_single_before_strong_pair(self):
        for active in (None, [2]):
            with self.subTest(active=active):
                state = _state([3, 9, 9], active)
                self.assertEqual(ScoutGame.bot_move(state, "p0"),
                                 {"type": "show", "start_index": 0, "end_index": 0})

    def test_cheapest_single_that_beats_table(self):
        state = _state([9, 4, 1, 7], [3])
        self.assertEqual(ScoutGame.bot_move(state, "p0"),
                         {"type": "show", "start_index": 1, "end_index": 1})

    def test_preserves_pair_instead_of_splitting_it(self):
        state = _state([9, 9, 4, 1], [3])
        action = ScoutGame.bot_move(state, "p0")
        self.assertEqual(action, {"type": "show", "start_index": 2, "end_index": 2})

    def test_removal_connects_remaining_cards(self):
        state = _state([4, 9, 9, 4], [3])
        self.assertEqual(ScoutGame.bot_move(state, "p0"),
                         {"type": "show", "start_index": 1, "end_index": 2})

    def test_always_takes_immediate_empty_hand(self):
        for count in range(2, 6):
            with self.subTest(count=count):
                state = _state([4, 5, 6], [8], count)
                self.assertEqual(ScoutGame.bot_move(state, "p0"),
                                 {"type": "show", "start_index": 0, "end_index": 2})

    def test_scout_and_show_can_finish_hand(self):
        state = _state([4, 6], [5, 5])
        action = ScoutGame.bot_move(state, "p0")
        self.assertEqual(action["type"], "scout_and_show")
        _, error = ScoutGame.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p0")
        followup = ScoutGame.bot_move(state, "p0")
        self.assertEqual(followup, {"type": "show", "start_index": 0, "end_index": 2})
        _, error = ScoutGame.apply_action(state, "p0", followup)
        self.assertIsNone(error)
        self.assertEqual(state["last_round_summary"]["winner"], "p0")

    def test_pending_scout_and_show_can_finish_without_show(self):
        state = _state([1, 3], [9, 9, 9])
        state["pending_scout_and_show_player"] = "p0"
        self.assertEqual(ScoutGame.bot_move(state, "p0"), {"type": "finish_scout_and_show"})

    def test_does_not_scout_when_it_hands_round_to_owner(self):
        state = _state([1, 4, 9], [8, 8])
        state["active_set"]["owner_player_id"] = "p1"
        action = ScoutGame.bot_move(state, "p0")
        self.assertEqual(action["type"], "scout_and_show")

    def test_scout_inserts_bridge_without_wasting_scout_and_show(self):
        state = _state([4, 6, 1], [5, 5, 5, 5])
        self.assertEqual(ScoutGame.bot_move(state, "p0"),
                         {"type": "scout", "take_side": "left", "insert_index": 1, "insert_face": "a"})

    def test_plays_strong_combo_when_it_can_lock_round(self):
        state = _state([9, 9, 9, 9, 1, 3], [2])
        state["players"]["p0"]["scout_and_show_available"] = False
        self.assertEqual(ScoutGame.bot_move(state, "p0"),
                         {"type": "show", "start_index": 0, "end_index": 3})

    def test_orientation_uses_complete_hand_structure(self):
        state = _state([9, 9])
        state["phase"] = "choose_orientation"
        state["players"]["p0"]["hand_ready"] = False
        state["players"]["p0"]["pending_hand"] = [
            {"id": "1-9", "values": [1, 9], "face_up": 1},
            {"id": "5-9", "values": [5, 9], "face_up": 1},
        ]
        snapshot = copy.deepcopy(state)
        self.assertEqual(ScoutGame.bot_move(state, "p0"), {"type": "ready_hand", "flip": False})
        self.assertEqual(state, snapshot)
        for card in state["players"]["p0"]["pending_hand"]:
            card["face_up"] = 1 - card["face_up"]
        self.assertEqual(ScoutGame.bot_move(state, "p0"), {"type": "ready_hand", "flip": True})

    def test_duel_respects_scout_tokens(self):
        state = _state([4, 9], [3], 2)
        state["players"]["p0"]["scout_tokens_left"] = 0
        self.assertEqual(ScoutGame.bot_move(state, "p0")["type"], "show")

    def test_duel_last_scout_without_show_ends_round(self):
        state = _state([1, 4, 7], [9, 9, 9], 2)
        state["players"]["p0"]["scout_tokens_left"] = 1
        action = ScoutGame.bot_move(state, "p0")
        self.assertEqual(action["type"], "scout")
        _, error = ScoutGame.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(state["last_round_summary"]["winner"], "p0")
        self.assertEqual(state["last_round_summary"]["reason"], "no_tokens_no_show")

    def test_hidden_information_and_state_are_not_used_or_mutated(self):
        state = _state([1, 4, 9, 9], [8, 8])
        snapshot = copy.deepcopy(state)
        expected = ScoutGame.bot_move(state, "p0")
        self.assertEqual(state, snapshot)
        for player_id, player in state["players"].items():
            if player_id != "p0":
                player["hand"] = [None] * len(player["hand"])
            player["pending_hand"] = None
        state["round_decks"] = None
        self.assertEqual(ScoutGame.bot_move(state, "p0"), expected)

    def test_ignores_inactive_players(self):
        state = _state([2, 7])
        self.assertIsNone(ScoutGame.bot_move(state, "p1"))
        self.assertIsNone(ScoutGame.bot_move(state, "unknown"))
        state["game_over"] = True
        self.assertIsNone(ScoutGame.bot_move(state, "p0"))

    def test_combo_enumerator_matches_rules(self):
        for values in ([1], [3, 3, 3, 2], [7, 6, 5, 4, 8], [1, 2, 3, 2, 2, 9]):
            hand = _cards(values)
            expected = {(move["start_index"], move["end_index"] + 1) for move in _enumerate_show_moves(hand, None)}
            actual = {(start, end) for start, end, _ in _combos(tuple(values))}
            self.assertEqual(actual, expected)
            for start, end, combo in _combos(tuple(values)):
                classified = _classify_cards(hand[start:end])
                self.assertEqual(combo[0], classified["length"])
                self.assertEqual(combo[2], classified["rank_value"])

    def test_hand_cost_rewards_connected_and_strong_reserves(self):
        self.assertLess(_hand_cost((8, 8), 10), _hand_cost((1, 5), 10))
        self.assertLess(_hand_cost((8, 8), 10), _hand_cost((2, 2), 10))
        self.assertEqual(_hand_cost((), 10), 0)

    def test_seeded_games_finish_with_legal_actions_for_all_player_counts(self):
        for count in range(2, 6):
            with self.subTest(count=count):
                players = [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index}
                           for index in range(count)]
                state = ScoutGame.init_game({"seed": 20261119}, players)
                for _ in range(1000):
                    if state.get("game_over"):
                        break
                    if state["phase"] == "choose_orientation":
                        player_id = next(player_id for player_id, player in state["players"].items()
                                         if not player["hand_ready"])
                    else:
                        player_id = state["current_turn"]
                    action = ScoutGame.bot_move(state, player_id)
                    self.assertIsNotNone(action)
                    self.assertIn(action["type"], ScoutGame.get_legal_actions(state, player_id))
                    _, error = ScoutGame.apply_action(state, player_id, action)
                    self.assertIsNone(error, (player_id, action, error))
                else:
                    self.fail("Scout game did not finish within 1000 actions")


if __name__ == "__main__":
    unittest.main()
