import copy
import json
import random
import unittest
from unittest.mock import patch

from game.the_gang import TheGangGame as Game
from game.the_gang_ai import choose_bot_rank


def make_state() -> dict:
    with patch("game.the_gang.random.shuffle", lambda deck: None):
        return Game.init_game({}, [
            {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": i > 0}
            for i in range(4)
        ])


def cards(text: str, revealed: bool = False) -> list:
    ranks = {"A": 14, "K": 13, "Q": 12, "J": 11, "T": 10}
    return [{"rank": ranks[code[0]] if code[0] in ranks else int(code[0]),
             "suit": code[1], "revealed": revealed} for code in text.split()]


def set_hands(state: dict, board: str, hands: list, public: bool = False) -> None:
    state["community_cards"] = cards(board)
    for pid, hand in zip(state["turn_order"], hands):
        state["players"][pid]["hole"] = cards(hand, public)


def settle_bots(state: dict) -> list:
    """Follow the room scheduler's first-actionable-bot order, with a hard bound."""
    actions = []
    for _ in range(35):
        for pid in state["turn_order"]:
            if not state["player_meta"][pid]["is_bot"]:
                continue
            action = Game.bot_move(state, pid)
            if action:
                _, error = Game.apply_action(state, pid, action)
                if error:
                    raise AssertionError(error)
                actions.append((pid, action))
                break
        else:
            return actions
    raise AssertionError("Bots did not settle; possible ranking loop")


class TheGangRankingTests(unittest.TestCase):
    def test_human_can_move_immediately_with_three_bots(self):
        state = make_state()
        self.assertIn("move_rank", Game.get_public_view(state, "p0")["legal_actions"])
        _, error = Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p0", "to_index": 3})
        self.assertIsNone(error)
        self.assertEqual(state["ranking"], ["p1", "p2", "p3", "p0"])
        self.assertEqual(state["phase"], "preflop")

    def test_move_requires_new_reveal_confirmations_on_each_street(self):
        for phase in ("preflop", "flop", "turn"):
            with self.subTest(phase=phase):
                state = make_state()
                state["phase"] = phase
                for player in state["players"].values():
                    player["reveal_ready"] = True
                Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p0", "to_index": 2})
                self.assertTrue(all(not player["reveal_ready"] for player in state["players"].values()))
                Game.apply_action(state, "p1", {"type": "reveal_next"})
                self.assertEqual(state["phase"], phase)

    def test_noop_move_preserves_confirmations(self):
        state = make_state()
        state["players"]["p1"]["reveal_ready"] = True
        events, error = Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p0", "to_index": 0})
        self.assertIsNone(error)
        self.assertEqual(events, [])
        self.assertTrue(state["players"]["p1"]["reveal_ready"])

    def test_river_move_cancels_all_ready_and_lock(self):
        state = make_state()
        state["phase"] = "river"
        state["lock_at_ms"] = 9000
        for player in state["players"].values():
            player["ready"] = True
        with patch("game.the_gang._now_ms", return_value=1000):
            _, error = Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p0", "to_index": 3})
        self.assertIsNone(error)
        self.assertIsNone(state["lock_at_ms"])
        self.assertTrue(all(not player["ready"] for player in state["players"].values()))

    def test_spectators_and_showdown_cannot_reorder(self):
        state = make_state()
        before = copy.deepcopy(state)
        _, error = Game.apply_action(state, "visitor", {"type": "move_rank", "player_id": "p0", "to_index": 3})
        self.assertIsNotNone(error)
        self.assertEqual(state, before)
        state["phase"] = "showdown"
        before = copy.deepcopy(state)
        _, error = Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p0", "to_index": 3})
        self.assertIsNotNone(error)
        self.assertEqual(state, before)


class TheGangBotTests(unittest.TestCase):
    def test_preflop_strong_and_weak_hands_take_different_positions(self):
        state = make_state()
        set_hands(state, "", ["KH QC", "AS AH", "7D 2C", "9H 8H"])
        for bot, target in [("p1", 0), ("p2", 3)]:
            with self.subTest(bot=bot):
                action = Game.bot_move(state, bot)
                self.assertEqual((action["type"], action["player_id"], action["to_index"]), ("move_rank", bot, target))

    def test_flop_and_turn_reassess_current_made_hand(self):
        state = make_state()
        state["phase"] = "flop"
        set_hands(state, "2S 2H 2D", ["KS QC", "AS AH", "7D 9C", "2C 8H"])
        self.assertEqual(choose_bot_rank(Game.get_public_view(state, "p3")), 0)
        state["phase"] = "turn"
        set_hands(state, "TH JH QH 2C", ["KS QC", "AS AD", "7D 9C", "KH AH"])
        self.assertEqual(choose_bot_rank(Game.get_public_view(state, "p3")), 0)

    def test_revealed_hands_use_kickers_and_exact_ties(self):
        state = make_state()
        state["phase"] = "river"
        set_hands(state, "KS KH TD 8C 2S", ["AS QD", "AH 9C", "7D 6C", "5S 4H"], public=True)
        state["ranking"] = ["p1", "p3", "p0", "p2"]
        self.assertEqual(choose_bot_rank(Game.get_public_view(state, "p1")), 1)
        # Everyone plays the board: there is no reason to keep fighting for first.
        set_hands(state, "AS KS QS JS TS", ["2H 3H", "4H 5H", "6H 7H", "8H 9H"])
        for pid in state["turn_order"]:
            self.assertEqual(choose_bot_rank(Game.get_public_view(state, pid)), state["ranking"].index(pid))

    def test_bot_search_cannot_read_hidden_hands_or_deck_and_does_not_mutate(self):
        state = make_state()
        state["phase"] = "river"
        set_hands(state, "2S 4H 8D JS KC", ["AS AH", "KH KD", "7D 9C", "6H 5H"])
        before = copy.deepcopy(state)
        random_before = random.getstate()
        expected = Game.bot_move(state, "p1")
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), random_before)
        altered = copy.deepcopy(state)
        for pid, hand in [("p0", "QS QH"), ("p2", "3C 3D"), ("p3", "TC TH")]:
            altered["players"][pid]["hole"] = cards(hand)
        altered["deck"] = cards("AS AD AC AH")
        altered["discard"] = cards("9S 9D")
        altered["hand_cache"] = {"p0": {"score": (99,)}}
        altered["odds_cache"] = {"p1": 0.0}
        self.assertEqual(Game.bot_move(altered, "p1"), expected)

    def test_bots_place_then_ready_and_yield_to_human_corrections(self):
        state = make_state()
        set_hands(state, "", ["KH QC", "AS AH", "7D 2C", "9H 8H"])
        actions = settle_bots(state)
        self.assertTrue(any(action["type"] == "move_rank" for _, action in actions))
        self.assertEqual(state["phase"], "preflop")
        self.assertFalse(state["players"]["p0"]["reveal_ready"])
        self.assertTrue(all(state["players"][pid]["reveal_ready"] for pid in ("p1", "p2", "p3")))
        Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p1", "to_index": 3})
        human_order = list(state["ranking"])
        self.assertTrue(all(action["type"] == "reveal_next" for _, action in settle_bots(state)))
        self.assertEqual(state["ranking"], human_order)
        # No private estimates or memory leak into any recipient's view.
        self.assertNotIn("bot_ranked", Game.get_public_view(state, "p0"))

    def test_human_placement_of_an_unmoved_bot_is_respected(self):
        state = make_state()
        set_hands(state, "", ["KH QC", "AS AH", "7D 2C", "9H 8H"])
        Game.apply_action(state, "p0", {"type": "move_rank", "player_id": "p1", "to_index": 3})
        self.assertEqual(Game.bot_move(state, "p1")["type"], "reveal_next")

    def test_new_cards_and_mulligan_reset_bot_decisions(self):
        state = make_state()
        settle_bots(state)
        self.assertEqual(set(state["bot_ranked"]), {"p1", "p2", "p3"})
        Game.apply_action(state, "p0", {"type": "reveal_next"})
        self.assertEqual(state["phase"], "flop")
        self.assertEqual(state["bot_ranked"], [])
        state = make_state()
        settle_bots(state)
        Game.apply_action(state, "p0", {"type": "mulligan"})
        self.assertEqual(state["bot_ranked"], [])
        self.assertTrue(all(not player["reveal_ready"] for player in state["players"].values()))

    def test_spy_uses_new_public_information_and_cancels_lock(self):
        state = make_state()
        state["phase"] = "river"
        set_hands(state, "2S 4H 8D JS KC", ["AS AH", "KH KD", "7D 9C", "6H 5H"])
        state["bot_ranked"] = ["p1", "p2", "p3"]
        for player in state["players"].values():
            player["ready"] = True
        state["lock_at_ms"] = 9000
        with patch("game.the_gang._now_ms", return_value=1000):
            Game.apply_action(state, "p0", {"type": "spy", "target_player_id": "p2"})
        self.assertEqual(state["bot_ranked"], [])
        self.assertIsNone(state["lock_at_ms"])
        view = Game.get_public_view(state, "p1")
        self.assertEqual(sum(not card.get("hidden") for card in view["players"][2]["hand"]), 1)

    def test_bot_memory_survives_save_and_older_saves_are_supported(self):
        state = make_state()
        settle_bots(state)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertTrue(all(Game.bot_move(restored, pid) is None for pid in ("p1", "p2", "p3")))
        restored.pop("bot_ranked")
        set_hands(restored, "", ["KH QC", "AS AH", "7D 2C", "9H 8H"])
        restored["ranking"] = ["p0", "p1", "p2", "p3"]
        self.assertEqual(Game.bot_move(restored, "p1")["type"], "move_rank")

    def test_all_streets_settle_and_showdown_waits_for_human(self):
        state = make_state()
        for phase in ("preflop", "flop", "turn", "river"):
            self.assertEqual(state["phase"], phase)
            actions = settle_bots(state)
            for pid in ("p1", "p2", "p3"):
                self.assertLessEqual(sum(actor == pid and action["type"] == "move_rank" for actor, action in actions), 1)
            self.assertEqual(state["phase"], phase)
            if phase != "river":
                Game.apply_action(state, "p0", {"type": "reveal_next"})
        with patch("game.the_gang._now_ms", return_value=1000):
            Game.apply_action(state, "p0", {"type": "toggle_ready"})
        with patch("game.the_gang._now_ms", return_value=5000):
            Game.apply_action(state, "p0", {"type": "lock_in"})
        self.assertEqual(state["phase"], "showdown")
        settle_bots(state)
        self.assertEqual(state["phase"], "showdown")
        Game.apply_action(state, "p0", {"type": "next_round"})
        self.assertEqual(state["phase"], "preflop")
        self.assertEqual(state["bot_ranked"], [])


if __name__ == "__main__":
    unittest.main()
