import copy
import random
import unittest
from unittest.mock import patch

from jsonschema import Draft7Validator

from game.coyote import CoyoteGame as Game, _evaluate_total
from game.coyote_ai import CARD_COUNTS, _card, choose_action, total_distribution
from game.definitions import COYOTE_ACTION_SCHEMA


def make_state(count=3):
    players = [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index,
                "is_bot": index > 0} for index in range(count)]
    return Game.init_game({}, players)


class CoyoteAiTests(unittest.TestCase):
    def test_exact_distribution_matches_physical_card_enumeration(self):
        for visible in [("20", "Max->0"), ("10", "?"), ("10", "Max->0", "?"),
                        ("-10", "x2"), ("?", "x2", "Max->0")]:
            with self.subTest(visible=visible):
                pool = [label for label, count in CARD_COUNTS.items() for _ in range(count)]
                for label in visible:
                    pool.remove(label)
                expected = {}
                for hidden_index, hidden in enumerate(pool):
                    cards = visible + (hidden,)
                    draws = [label for index, label in enumerate(pool) if index != hidden_index] if "?" in cards else [None]
                    for drawn in draws:
                        state = make_state(len(cards))
                        for player, label in zip(state["players"].values(), cards):
                            player["card"] = _card(label)
                        state["deck"] = [_card(drawn)] if drawn is not None else []
                        total = _evaluate_total(state)["total"]
                        expected[total] = expected.get(total, 0) + 1 / (len(pool) * len(draws))
                actual = dict(total_distribution(tuple(sorted(visible))))
                self.assertEqual(actual.keys(), expected.keys())
                self.assertAlmostEqual(sum(actual.values()), 1)
                for total, probability in expected.items():
                    self.assertAlmostEqual(actual[total], probability)

    def test_strategy_never_reads_own_card_or_deck(self):
        state = make_state()
        state["players"]["p1"]["card"] = _card("5")
        state["players"]["p2"]["card"] = _card("10")
        state["last_bid"] = 19
        state["last_bidder"] = "p2"
        original = copy.deepcopy(state)
        actions = []
        for hidden in CARD_COUNTS:
            state["players"]["p0"]["card"] = _card(hidden)
            state["deck"] = [_card("20"), _card("-10")]
            before = copy.deepcopy(state)
            actions.append(Game.bot_move(state, "p0"))
            self.assertEqual(state, before)
            state["deck"].reverse()
            self.assertEqual(Game.bot_move(state, "p0"), actions[-1])
        self.assertTrue(all(action == actions[0] for action in actions))
        self.assertEqual(Game.get_public_view(original, "p0")["players"][0]["card"], None)

    def test_calls_certain_overbid_and_raises_safe_bid(self):
        state = make_state()
        state["players"]["p1"]["card"] = _card("10")
        state["players"]["p2"]["card"] = _card("15")
        state["last_bidder"] = "p2"
        state["last_bid"] = 1000
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "challenge"})
        state["last_bid"] = 1
        self.assertEqual(Game.bot_move(state, "p0")["type"], "bid")

    def test_handles_all_player_counts_and_complete_games(self):
        generator = random.Random(731)
        with patch("game.coyote.random.shuffle", generator.shuffle):
            for count in [2, 3, 6, 10]:
                state = make_state(count)
                for step in range(1200):
                    if state["game_over"]:
                        break
                    actor = next(player_id for player_id in state["players"] if Game.get_legal_actions(state, player_id))
                    action = Game.bot_move(state, actor)
                    Draft7Validator(COYOTE_ACTION_SCHEMA).validate(action)
                    self.assertIn(action["type"], Game.get_legal_actions(state, actor))
                    _, error = Game.apply_action(state, actor, action)
                    self.assertIsNone(error, (count, step, action))
                self.assertTrue(state["game_over"], count)
                self.assertEqual(sum(not player["eliminated"] for player in state["players"].values()), 1)

    def test_seat_rotation_and_spectator_data_do_not_change_decision(self):
        state = make_state(6)
        labels = ["20", "?", "Max->0", "x2", "5", "-5"]
        for player, label in zip(state["players"].values(), labels):
            player["card"] = _card(label)
        state["current_turn"] = "p3"
        state["last_bidder"] = "p2"
        state["last_bid"] = 10
        view = Game.get_public_view(state, "p3")
        action = choose_action(view)
        rotated = copy.deepcopy(view)
        rotated["players"] = view["players"][3:] + view["players"][:3]
        self.assertEqual(choose_action(rotated), action)
        view["your_card"] = "20"
        view["last_round_summary"] = {"cards": [{"player_id": "p3", "card": "20"}]}
        self.assertEqual(choose_action(view), action)

    def test_out_of_turn_and_spectator_have_no_action(self):
        state = make_state()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "spectator"))
        self.assertIsNone(choose_action({"legal_actions": []}))


class CoyoteRoundReviewTests(unittest.TestCase):
    def reveal(self):
        state = make_state()
        state["players"]["p0"]["card"] = _card("20")
        state["players"]["p1"]["card"] = _card("Max->0")
        state["players"]["p2"]["card"] = _card("?")
        state["deck"] = [_card("10")]
        Game.apply_action(state, "p0", {"type": "bid", "bid": 11})
        _, error = Game.apply_action(state, "p1", {"type": "challenge"})
        self.assertIsNone(error)
        return state

    def test_pause_reveals_cards_and_requires_every_player(self):
        state = self.reveal()
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round"], 1)
        self.assertIsNone(state["current_turn"])
        view = Game.get_public_view(state, "p0")
        self.assertEqual(view["your_card"], "20")
        self.assertEqual(view["last_round_summary"]["mystery_draws"], ["10"])
        self.assertEqual(view["last_round_summary"]["actual_total"], 10)
        self.assertTrue(all(not player["card_hidden"] for player in view["players"]))
        self.assertNotIn("deck", view)
        self.assertEqual(Game.get_legal_actions(state, "spectator"), [])
        self.assertIsNotNone(Game.apply_action(state, "p2", {"type": "bid", "bid": 12})[1])
        for actor in ["p1", "p2"]:
            self.assertEqual(Game.bot_move(state, actor), {"type": "next_round"})
            Game.apply_action(state, actor, {"type": "next_round"})
            self.assertEqual(state["phase"], "round_end")
            self.assertEqual(Game.get_legal_actions(state, actor), [])
        self.assertIsNotNone(Game.apply_action(state, "p1", {"type": "next_round"})[1])
        saved = copy.deepcopy(Game.serialize(state))
        restored = Game.deserialize(saved)
        Game.apply_action(restored, "p0", {"type": "next_round"})
        self.assertEqual(restored["phase"], "bidding")
        self.assertEqual(restored["round"], 2)
        self.assertEqual(restored["current_turn"], "p0")
        self.assertEqual(restored["round_ready"], [])
        next_view = Game.get_public_view(restored, "p0")
        self.assertIsNone(next_view["players"][0]["card"])
        self.assertEqual(next_view["your_card"], "20")
        self.assertTrue(all(player["card"] is not None for player in Game.get_public_view(restored, "spectator")["players"]))

    def test_eliminated_player_reviews_and_next_survivor_opens(self):
        state = make_state()
        state["players"]["p0"]["penalties"] = 2
        Game.apply_action(state, "p0", {"type": "bid", "bid": 1000})
        Game.apply_action(state, "p1", {"type": "challenge"})
        self.assertTrue(state["players"]["p0"]["eliminated"])
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["next_round"])
        for actor in state["players"]:
            Game.apply_action(state, actor, {"type": "next_round"})
        self.assertEqual(state["current_turn"], "p1")
        self.assertIsNone(state["players"]["p0"]["card"])

    def test_final_round_stays_revealed_and_boolean_is_not_bid(self):
        state = make_state(2)
        self.assertIsNotNone(Game.apply_action(state, "p0", {"type": "bid", "bid": True})[1])
        state["players"]["p0"]["penalties"] = 2
        Game.apply_action(state, "p0", {"type": "bid", "bid": 1000})
        Game.apply_action(state, "p1", {"type": "challenge"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], "p1")
        self.assertEqual(Game.get_legal_actions(state, "p1"), [])

    def test_equality_penalizes_challenger(self):
        state = make_state()
        for player in state["players"].values():
            player["card"] = _card("5")
        Game.apply_action(state, "p0", {"type": "bid", "bid": 15})
        Game.apply_action(state, "p1", {"type": "challenge"})
        self.assertEqual(state["last_round_summary"]["loser"], "p1")


if __name__ == "__main__":
    unittest.main()
