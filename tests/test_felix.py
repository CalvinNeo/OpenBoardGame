import random
import unittest

from game.felix import FelixGame, _resolve_dogs


def make_players(count):
    return [
        {"player_id": f"p{idx}", "name": f"Player {idx}", "seat": idx, "is_bot": False}
        for idx in range(count)
    ]


def first_card_id(state, player_id, base_id=None):
    for card in state["players"][player_id]["hand"]:
        if base_id is None or card["base_id"] == base_id:
            return card["id"]
    return state["players"][player_id]["hand"][0]["id"]


def choose_until_auction(state):
    while state["phase"] == "choose_card":
        pid = state["current_turn"]
        events, error = FelixGame.apply_action(state, pid, {"type": "choose_card", "card_id": first_card_id(state, pid)})
        assert error is None, error
        assert events


class FelixGameTests(unittest.TestCase):
    def test_four_player_initialization(self):
        random.seed(1)
        state = FelixGame.init_game({}, make_players(4))

        self.assertEqual(state["phase"], "choose_card")
        self.assertEqual(len(state["players"]), 4)
        self.assertEqual([card["value"] for card in state["mouse_cards"]], [2, 4, 6])
        self.assertEqual(state["bank_mice"], 15)
        for pdata in state["players"].values():
            self.assertEqual(len(pdata["hand"]), 9)
            self.assertEqual(pdata["mice"], 15)

    def test_bid_pass_resolves_to_summary_and_waits_for_next_round(self):
        random.seed(2)
        state = FelixGame.init_game({}, make_players(4))
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["choose_order"] = ["p0", "p1", "p2", "p3"]
        choose_until_auction(state)

        events, error = FelixGame.apply_action(state, "p0", {"type": "bid", "amount": 3})
        self.assertIsNone(error)
        self.assertEqual(state["current_bid"], 3)
        for pid in ["p1", "p2", "p3"]:
            events, error = FelixGame.apply_action(state, pid, {"type": "pass"})
            self.assertIsNone(error)

        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(state["last_round_summary"]["winner"], "p0")
        self.assertEqual(state["players"]["p0"]["mice"], 12)
        self.assertIn("next_round", FelixGame.get_legal_actions(state, "p0"))

    def test_big_dog_removes_highest_positive_cat(self):
        state = {"table_slots": []}
        cards = [
            {"id": "c1", "kind": "cat", "value": 3},
            {"id": "c2", "kind": "cat", "value": 15},
            {"id": "d1", "kind": "big_dog", "value": None},
            {"id": "r1", "kind": "rabbit", "value": 0},
        ]
        for idx, card in enumerate(cards):
            state["table_slots"].append({"index": idx, "card": card})

        remaining, removed = _resolve_dogs(state)

        self.assertEqual({card["id"] for card in removed}, {"d1", "c2"})
        self.assertEqual({card["id"] for card in remaining}, {"c1", "r1"})

    def test_no_sale_keeps_start_player_and_skips_refill(self):
        random.seed(3)
        state = FelixGame.init_game({}, make_players(3))
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["choose_order"] = ["p0", "p1", "p2"]
        choose_until_auction(state)

        for pid in ["p0", "p1"]:
            events, error = FelixGame.apply_action(state, pid, {"type": "pass"})
            self.assertIsNone(error)
        self.assertEqual(state["phase"], "last_chance")

        events, error = FelixGame.apply_action(state, "p2", {"type": "pass"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(state["start_player"], "p0")
        self.assertTrue(state["skip_refill"])

        for pid in ["p0", "p1", "p2"]:
            FelixGame.apply_action(state, pid, {"type": "next_round"})
        self.assertEqual([card["mice"] for card in state["mouse_cards"]], [0, 0])


if __name__ == "__main__":
    unittest.main()

