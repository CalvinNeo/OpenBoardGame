import copy
import unittest
from unittest import mock

from game import guandan


class GuandanRulesTests(unittest.TestCase):
    PLAYERS = [
        {"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat}
        for seat in range(4)
    ]

    def setUp(self):
        self.state = guandan.GuandanGame.init_game({}, self.PLAYERS)

    @staticmethod
    def cards(ranks):
        deck = guandan._full_deck()
        selected = []
        for rank in ranks:
            card = next(card for card in deck if card.get("rank") == rank
                        and card.get("suit") != "hearts")
            selected.append(card)
            deck.remove(card)
        return selected

    def test_low_ace_sequences_allow_natural_and_wild_cards(self):
        wilds = [card for card in guandan._full_deck()
                 if card.get("rank") == 7 and card.get("suit") == "hearts"]
        for ranks, combo_type, high in (
            ([14, 14, 2, 2, 3, 3], "three_pairs", 3),
            ([14, 14, 14, 2, 2, 2], "steel_plate", 2),
        ):
            natural = self.cards(ranks)
            for wild_count in range(3):
                hand = natural[:6 - wild_count] + wilds[:wild_count]
                with self.subTest(combo_type=combo_type, wild_count=wild_count):
                    combo = guandan._evaluate_combo(hand, 7, {})
                    self.assertEqual(combo["type"], combo_type)
                    self.assertEqual(combo["high_value"], high)

    def test_sequence_generators_cover_both_ace_endpoints_and_thresholds(self):
        for ranks, combo_type, high in (
            ([14, 14, 2, 2, 3, 3], "three_pairs", 3),
            ([12, 12, 13, 13, 14, 14], "three_pairs", 14),
            ([14, 14, 14, 2, 2, 2], "steel_plate", 2),
            ([13, 13, 13, 14, 14, 14], "steel_plate", 14),
        ):
            hand = self.cards(ranks)
            expected = {card["id"] for card in hand}
            finder = getattr(guandan, f"_find_{combo_type}_to_beat")
            lister = getattr(guandan, f"_list_{combo_type}_options")
            with self.subTest(combo_type=combo_type, high=high):
                self.assertEqual(set(finder(hand, 7, high - 1)), expected)
                self.assertIn(expected, [set(cards) for cards in lister(hand, 7, high - 1)])
                self.assertIsNone(finder(hand, 7, high))
                self.assertEqual(lister(hand, 7, high), [])

    def test_sequence_comparison_uses_low_ace_rank_and_natural_level_position(self):
        for low, next_ranks in (
            ([14, 14, 2, 2, 3, 3], [2, 2, 3, 3, 4, 4]),
            ([14, 14, 14, 2, 2, 2], [2, 2, 2, 3, 3, 3]),
        ):
            for level in (2, 3, 7, 14):
                lower = guandan._evaluate_combo(self.cards(low), level, {})
                higher = guandan._evaluate_combo(self.cards(next_ranks), level, {})
                with self.subTest(low=low, level=level):
                    self.assertTrue(guandan._compare_combos(lower, higher, level, {}))
                    self.assertFalse(guandan._compare_combos(higher, lower, level, {}))

    def test_sequences_do_not_wrap_across_ace(self):
        for ranks in ([13, 13, 14, 14, 2, 2], [12, 12, 12, 14, 14, 14]):
            self.assertIsNone(guandan._evaluate_combo(self.cards(ranks), 7, {}))

    def test_low_ace_sequences_are_playable_and_available_as_hints(self):
        for ranks, combo_type in (
            ([14, 14, 2, 2, 3, 3], "three_pairs"),
            ([14, 14, 14, 2, 2, 2], "steel_plate"),
        ):
            state = copy.deepcopy(self.state)
            hand = self.cards(ranks)
            state.update(current_turn="p0", level_rank=7)
            state["players"]["p0"]["hand"] = hand
            ids = [card["id"] for card in hand]
            with self.subTest(combo_type=combo_type):
                self.assertIn(set(ids), [set(option) for option in guandan._list_hint_options(state, "p0")])
                _, error = guandan.GuandanGame.apply_action(state, "p0", {"type": "play", "card_ids": ids})
                self.assertIsNone(error)
                self.assertEqual(state["current_trick"]["combo"]["type"], combo_type)
                self.assertEqual(state["finish_order"], ["p0"])

    def test_double_tribute_is_waived_for_split_big_jokers_and_head_leads(self):
        deck = guandan._full_deck()
        big = [card for card in deck if card.get("joker") == "big"]
        rest = [card for card in deck if card.get("joker") != "big"]
        # The two tribute payers receive one big joker each after the deal.
        arranged = [rest.pop(0), big[0], rest.pop(0), big[1]] + rest
        self.state["finish_order"] = ["p0", "p2", "p1", "p3"]
        with mock.patch.object(guandan, "_build_deck", return_value=arranged):
            guandan._start_next_round(self.state)
        self.assertEqual(self.state["phase"], "playing")
        self.assertIsNone(self.state["tribute"])
        self.assertEqual(self.state["current_turn"], "p0")
        memory = self.state["round_memories"][-1]["tribute"]
        self.assertEqual(memory["status"], "waived")
        self.assertEqual(memory["payers"], ["p1", "p3"])

    def test_single_tribute_only_counts_last_players_big_jokers(self):
        deck = guandan._full_deck()
        big = [card for card in deck if card.get("joker") == "big"]
        for last_has_both in (False, True):
            state = copy.deepcopy(self.state)
            state.update(round_number=2, finish_order=["p0", "p1", "p2", "p3"])
            state["players"]["p3"]["hand"] = big if last_has_both else big[:1]
            state["players"]["p1"]["hand"] = [] if last_has_both else big[1:]
            guandan._setup_tribute(state)
            with self.subTest(last_has_both=last_has_both):
                self.assertEqual(state["phase"], "playing" if last_has_both else "tribute")

    def test_double_tribute_also_waives_when_one_payer_holds_both_jokers(self):
        self.state.update(round_number=2, finish_order=["p0", "p2", "p1", "p3"])
        for pid in ("p1", "p3"):
            self.state["players"][pid]["hand"] = []
        self.state["players"]["p3"]["hand"] = [
            card for card in guandan._full_deck() if card.get("joker") == "big"
        ]
        guandan._setup_tribute(self.state)
        self.assertEqual(self.state["phase"], "playing")
        self.assertIsNone(self.state["tribute"])

    def test_reaching_ace_does_not_finish_the_match(self):
        for level, order in (
            (11, ["p0", "p2", "p1", "p3"]),
            (12, ["p0", "p1", "p2", "p3"]),
            (13, ["p0", "p1", "p3", "p2"]),
        ):
            state = copy.deepcopy(self.state)
            state.update(dealer_team="A", level_rank=level, finish_order=order)
            state["teams"]["A"]["level"] = level
            guandan._advance_to_round_end(state)
            with self.subTest(level=level):
                self.assertEqual(state["teams"]["A"]["level"], 14)
                self.assertFalse(state["game_over"])
                self.assertIsNone(state["winner_team"])
                self.assertEqual(state["phase"], "round_end")

    def test_ace_dealer_win_finishes_the_match(self):
        self.state.update(dealer_team="A", level_rank=14, finish_order=["p0", "p2"])
        self.state["teams"]["A"]["level"] = 14
        guandan._advance_to_round_end(self.state)
        self.assertTrue(self.state["game_over"])
        self.assertEqual(self.state["winner_team"], "A")
        self.assertEqual(self.state["phase"], "game_over")

    def test_non_dealer_already_at_ace_must_first_take_the_deal(self):
        self.state.update(dealer_team="B", level_rank=7, finish_order=["p0", "p2"])
        self.state["teams"]["A"]["level"] = 14
        self.state["teams"]["B"]["level"] = 7
        guandan._advance_to_round_end(self.state)
        self.assertFalse(self.state["game_over"])
        self.assertEqual(self.state["dealer_team"], "A")
        self.assertEqual(self.state["level_rank"], 14)

    def test_ace_dealer_losing_does_not_win(self):
        self.state.update(dealer_team="A", level_rank=14, finish_order=["p1", "p3"])
        self.state["teams"]["A"]["level"] = 14
        guandan._advance_to_round_end(self.state)
        self.assertFalse(self.state["game_over"])
        self.assertEqual(self.state["dealer_team"], "B")

    def test_partner_last_requirement_remains_configurable_at_ace(self):
        for require_partner in (False, True):
            state = copy.deepcopy(self.state)
            state.update(dealer_team="A", level_rank=14, finish_order=["p0", "p1", "p3", "p2"])
            state["teams"]["A"]["level"] = 14
            state["config"]["require_partner_not_last_for_a"] = require_partner
            guandan._advance_to_round_end(state)
            with self.subTest(require_partner=require_partner):
                self.assertEqual(state["game_over"], not require_partner)
                self.assertEqual(state["phase"], "round_end" if require_partner else "game_over")


if __name__ == "__main__":
    unittest.main()
