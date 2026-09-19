import copy
import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanValueBoundsTests(unittest.TestCase):
    def setUp(self):
        players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat}
                   for seat in range(4)]
        self.state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        for seat, pid in enumerate(self.state["turn_order"]):
            self.state["players"][pid].update(hand=[deck[seat]], finished=False, finish_rank=None)
        held = {card["id"] for data in self.state["players"].values() for card in data["hand"]}
        self.state.update(
            phase="playing", current_turn="p0", current_trick=None, trick_plays={},
            pass_count=0, finish_order=[], round_memories=[], level_rank=2,
            visible_card_id=None, known_card_owners={}, pass_limits={},
            seen_cards=[card["id"] for card in deck if card["id"] not in held],
        )

    @staticmethod
    def _set_prefix(state, prefix):
        state["finish_order"] = list(prefix)
        for rank, pid in enumerate(prefix, 1):
            state["players"][pid].update(hand=[], finished=True, finish_rank=rank)

    def _bounds(self, state, player_id):
        return guandan_ai.call(guandan, "_possible_round_value_bounds", state, player_id)

    def test_bounds_match_engine_settlement_for_every_public_prefix_and_level(self):
        orders = list(itertools.permutations(self.state["turn_order"]))
        prefixes = sorted({order[:size] for order in orders for size in range(1, 5)})
        for level in range(2, 15):
            for require_partner in (False, True):
                base = copy.deepcopy(self.state)
                base["config"]["require_partner_not_last_for_a"] = require_partner
                for team in base["teams"].values():
                    team["level"] = level
                outcomes = {}
                for order in orders:
                    settled = copy.deepcopy(base)
                    self._set_prefix(settled, order)
                    guandan._advance_to_round_end(settled)
                    winner = settled["player_teams"][order[0]]
                    if settled["game_over"]:
                        self.assertEqual(settled["winner_team"], winner)
                        points = 1000
                    else:
                        # Score the engine's complete finish order independently
                        # of the helper and _settled_round_value. Keep upgrade
                        # points uncapped when an A-level win is disallowed.
                        teams = [settled["player_teams"][pid] for pid in order]
                        points = 100 * (3 if teams[1] == winner else 2 if teams[2] == winner else 1)
                    outcomes[order] = points if winner == "A" else -points
                for prefix in prefixes:
                    state = copy.deepcopy(base)
                    self._set_prefix(state, prefix)
                    possible = [value for order, value in outcomes.items() if order[:len(prefix)] == prefix]
                    expected = min(possible), max(possible)
                    before = copy.deepcopy(state)
                    with self.subTest(level=level, require_partner=require_partner, prefix=prefix):
                        self.assertEqual(self._bounds(state, "p0"), expected)
                        self.assertEqual(self._bounds(state, "p1"), (-expected[1], -expected[0]))
                        self.assertEqual(state, before)

    def test_known_first_place_keeps_all_shape_scores_within_feasible_outcomes(self):
        for prefix in (("p0",), ("p0", "p1")):
            state = copy.deepcopy(self.state)
            self._set_prefix(state, prefix)
            for player_id in ("p0", "p1"):
                low, high = self._bounds(state, player_id)
                values = []
                for raw in (-10000.0, -100.0, 0.0, 100.0, 10000.0):
                    with mock.patch.object(guandan_ai, "_hand_state_value_components", return_value={"shape": raw}), \
                         mock.patch.object(guandan_ai, "_opponent_finish_pressure_penalty", return_value=0.0), \
                         mock.patch.object(guandan_ai, "_control_card_score", return_value=0.0):
                        value = guandan._evaluate_state_for_bot(state, player_id)
                    self.assertGreaterEqual(value, low)
                    self.assertLessEqual(value, high)
                    values.append(value)
                self.assertEqual(values, sorted(values))
                self.assertGreater(values[1], low)
                self.assertLess(values[-2], high)

    def test_known_match_winner_is_exact_even_before_remaining_places_are_settled(self):
        self._set_prefix(self.state, ("p0",))
        self.state["teams"]["A"]["level"] = 13
        self.state["config"]["require_partner_not_last_for_a"] = False
        for player_id, expected in (("p0", 1000.0), ("p1", -1000.0)):
            self.assertIsNone(guandan_ai.call(guandan, "_settled_round_value", self.state, player_id))
            self.assertEqual(self._bounds(self.state, player_id), (expected, expected))
            self.assertEqual(guandan._evaluate_state_for_bot(self.state, player_id), expected)

    def test_no_first_place_preserves_original_shape_value(self):
        self.assertIsNone(self._bounds(self.state, "p0"))
        for raw in (-350.0, 0.0, 275.0):
            with mock.patch.object(guandan_ai, "_hand_state_value_components", return_value={"shape": raw}), \
                 mock.patch.object(guandan_ai, "_opponent_finish_pressure_penalty", return_value=0.0), \
                 mock.patch.object(guandan_ai, "_control_card_score", return_value=0.0):
                self.assertEqual(guandan._evaluate_state_for_bot(self.state, "p0"), raw)

    def test_shallow_search_secures_one_point_loss_instead_of_delaying_two_point_loss(self):
        state = self.state
        self._set_prefix(state, ("p0", "p3"))
        deck = guandan._full_deck()
        pair = [next(card for card in deck if card.get("rank") == 3 and card.get("suit") == suit)
                for suit in ("spades", "hearts")]
        enemy = next(card for card in deck if card.get("rank") == 4 and card.get("suit") == "spades")
        state["players"]["p1"]["hand"] = pair
        state["players"]["p2"]["hand"] = [enemy]
        held = {card["id"] for card in pair + [enemy]}
        state.update(current_turn="p1", seen_cards=[card["id"] for card in deck if card["id"] not in held])
        pair_action = {"type": "play", "card_ids": [card["id"] for card in pair]}
        single_action = {"type": "play", "card_ids": [pair[0]["id"]]}

        secure = copy.deepcopy(state)
        _, error = guandan.GuandanGame.apply_action(secure, "p1", pair_action)
        self.assertIsNone(error)
        self.assertEqual(secure["finish_order"], ["p0", "p3", "p1", "p2"])
        self.assertEqual(secure["teams"]["A"]["level"], 3)
        self.assertEqual(guandan._evaluate_state_for_bot(secure, "p1"), -100.0)

        delayed = copy.deepcopy(state)
        _, error = guandan.GuandanGame.apply_action(delayed, "p1", single_action)
        self.assertIsNone(error)
        leaf = guandan._evaluate_state_for_bot(delayed, "p1")
        self.assertGreater(leaf, -200.0)
        self.assertLess(leaf, -100.0)
        self.assertEqual(guandan._mcts_reply_tree_value(copy.deepcopy(delayed), "p1", 0, 2, 0), leaf)
        _, error = guandan.GuandanGame.apply_action(delayed, "p2", {"type": "play", "card_ids": [enemy["id"]]})
        self.assertIsNone(error)
        self.assertEqual(delayed["finish_order"], ["p0", "p3", "p2", "p1"])
        self.assertEqual(delayed["teams"]["A"]["level"], 4)
        self.assertEqual(guandan._evaluate_state_for_bot(delayed, "p1"), -200.0)

        chosen = guandan._minimax_pick_action(state, "p1", depth=1, width=8)
        self.assertEqual(chosen, pair_action)
        self.assertEqual(state["_ai_eval_cache"]["minimax_anytime"]["completed_depth"], 1)


if __name__ == "__main__":
    unittest.main()
