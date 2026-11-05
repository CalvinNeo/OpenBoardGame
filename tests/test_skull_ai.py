import copy
import json
import random
import unittest

from jsonschema import Draft7Validator

from game.skull import CARD_ROSE, CARD_SKULL, SkullGame
from game.definitions import SKULL_ACTION_SCHEMA


def make_state(count=3):
    return SkullGame.init_game({}, [
        {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": True}
        for i in range(count)
    ])


class SkullAiTests(unittest.TestCase):
    def test_opening_play_buries_skull_before_roses(self):
        state = make_state()
        state["current_turn"] = "p0"
        state["players"]["p0"]["hand"] = [CARD_ROSE, CARD_SKULL]

        action = SkullGame.bot_move(state, "p0")

        self.assertEqual(action, {"type": "play_card", "card_type": CARD_SKULL})
        self.assertEqual(state["players"]["p0"]["pile"], [])

    def test_bot_covers_own_skull_before_starting_bid(self):
        state = make_state()
        state["current_turn"] = "p0"
        state["players"]["p0"]["pile"] = [CARD_SKULL]
        state["players"]["p0"]["hand"] = [CARD_ROSE]
        for pid in state["turn_order"]:
            if pid != "p0":
                state["players"][pid]["pile"] = [CARD_ROSE]

        action = SkullGame.bot_move(state, "p0")

        self.assertEqual(action, {"type": "play_card", "card_type": CARD_ROSE})

    def test_bidding_is_conservative_and_raises_one_step(self):
        state = make_state()
        state["phase"] = "bidding"
        state["current_turn"] = "p0"
        state["current_bid"] = 1
        state["bidder"] = "p1"
        state["players"]["p0"]["hand"] = [CARD_ROSE, CARD_ROSE, CARD_SKULL]
        state["players"]["p0"]["pile"] = [CARD_ROSE]
        for pid in state["turn_order"]:
            state["players"][pid]["pile"] = state["players"][pid]["pile"] or [CARD_ROSE]

        action = SkullGame.bot_move(state, "p0")

        self.assertEqual(action, {"type": "raise_bid", "bid": 2})
        self.assertLessEqual(action["bid"], sum(len(p["pile"]) for p in state["players"].values()))

    def test_reveal_uses_own_pile_then_stable_low_risk_opponent(self):
        state = make_state()
        state["phase"] = "reveal"
        state["bidder"] = "p0"
        state["current_turn"] = "p0"
        state["current_bid"] = 1
        state["players"]["p0"]["pile"] = [CARD_ROSE]
        state["players"]["p1"]["pile"] = [CARD_ROSE, CARD_ROSE]
        state["players"]["p2"]["pile"] = [CARD_ROSE]

        self.assertEqual(
            SkullGame.bot_move(state, "p0"),
            {"type": "reveal_card", "target_player_id": "p0"},
        )

        state["players"]["p0"]["pile"] = []
        state["revealed_cards"] = [{"player_id": "p0", "card": CARD_ROSE}]
        self.assertEqual(
            SkullGame.bot_move(state, "p0"),
            {"type": "reveal_card", "target_player_id": "p2"},
        )

    def test_policy_is_deterministic_and_does_not_mutate_state(self):
        state = make_state()
        state["current_turn"] = "p0"
        before = copy.deepcopy(state)

        first = SkullGame.bot_move(state, "p0")
        second = SkullGame.bot_move(state, "p0")

        self.assertEqual(first, second)
        self.assertEqual(state, before)
        self.assertNotIn("_your_pile", SkullGame.get_public_view(state, "p0"))

    def test_full_bot_games_finish_for_supported_player_counts(self):
        for count in range(3, 7):
            for seed in range(4):
                with self.subTest(count=count, seed=seed):
                    random.seed(seed)
                    state = make_state(count)
                    for step in range(1200):
                        if state["game_over"]:
                            break
                        actor = next(
                            (pid for pid in state["turn_order"]
                             if SkullGame.get_legal_actions(state, pid)),
                            None,
                        )
                        self.assertIsNotNone(actor, (count, seed, step, state["phase"]))
                        before = copy.deepcopy(state)
                        action = SkullGame.bot_move(state, actor)
                        self.assertEqual(state, before)
                        self.assertIsNotNone(action)
                        Draft7Validator(SKULL_ACTION_SCHEMA).validate(action)
                        _, error = SkullGame.apply_action(state, actor, action)
                        self.assertIsNone(error, (count, seed, step, actor, action, error))
                    self.assertTrue(state["game_over"], (count, seed, state["phase"]))

    def test_bot_action_never_leaks_private_cards(self):
        state = make_state()
        state["current_turn"] = "p0"
        state["players"]["p0"]["hand"] = [CARD_ROSE]
        state["players"]["p1"]["hand"] = [CARD_SKULL]
        action = SkullGame.bot_move(state, "p0")
        encoded = json.dumps(action)
        self.assertNotIn(CARD_SKULL, encoded)


if __name__ == "__main__":
    unittest.main()
