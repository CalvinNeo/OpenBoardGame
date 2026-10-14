import copy
import unittest

from game.the_mind import TheMindGame


class TheMindTests(unittest.TestCase):
    def make_state(self, count=2):
        return TheMindGame.init_game(
            {"seed": 147},
            [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i} for i in range(count)],
        )

    def act(self, state, player, kind, **fields):
        action = {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], **fields}
        events, error = TheMindGame.apply_action(state, player, action)
        self.assertIsNone(error, error)
        self.assertTrue(events)

    def focus_to_playing(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, "ready")
        self.assertEqual(state["phase"], "playing")

    def test_player_counts_levels_and_private_views(self):
        for count, level in ((2, 12), (3, 10), (4, 8)):
            state = self.make_state(count)
            self.assertEqual(state["max_level"], level)
            view = TheMindGame.get_public_view(state, "p0")
            self.assertEqual(len(view["hand"]), 1)
            self.assertNotIn("seed", view)
            self.assertNotIn("deck", view)
            self.assertNotIn("hand", view["players"][0])
            self.assertEqual(view["legal_actions"], ["ready"])

    def test_only_lowest_card_can_be_played_and_stale_action_is_rejected(self):
        state = self.make_state()
        self.focus_to_playing(state)
        card = state["players"]["p0"]["hand"][0]
        stale = {"type": "play", "game_token": state["game_token"], "window_id": state["window_id"], "card": card + 1}
        _, error = TheMindGame.apply_action(state, "p0", stale)
        self.assertIn("lowest", error)
        self.assertEqual(state["pile"], [])
        stale["window_id"] -= 1
        _, error = TheMindGame.apply_action(state, "p0", stale | {"card": card})
        self.assertIn("old", error)

    def test_mistake_discards_lower_cards_once_and_requires_refocus(self):
        state = self.make_state()
        state["level"] = 2
        state["players"]["p0"]["hand"] = [80, 90]
        state["players"]["p1"]["hand"] = [20, 30]
        state["phase"] = "playing"
        state["window_id"] += 1
        self.act(state, "p0", "play", card=80)
        self.assertEqual(state["lives"], 1)
        self.assertEqual(state["phase"], "focus")
        self.assertEqual(state["players"]["p1"]["hand"], [])
        self.assertEqual([entry["card"] for entry in state["discarded"]], [20, 30])

    def test_throwing_star_requires_unanimous_vote_and_discards_lowest(self):
        state = self.make_state()
        state["level"] = 2
        state["players"]["p0"]["hand"] = [12, 88]
        state["players"]["p1"]["hand"] = [34, 67]
        state["phase"] = "playing"
        state["window_id"] += 1
        self.act(state, "p0", "request_star")
        self.assertEqual(state["phase"], "star_vote")
        self.act(state, "p1", "vote_star", agree=False)
        self.assertEqual(state["phase"], "focus")
        self.assertEqual(state["stars"], 1)
        self.focus_to_playing(state)
        self.act(state, "p0", "request_star")
        self.act(state, "p1", "vote_star", agree=True)
        self.assertEqual(state["stars"], 0)
        self.assertEqual(state["phase"], "focus")
        self.assertEqual([entry["card"] for entry in state["discarded"]], [12, 34])

    def test_level_reward_and_all_player_review_barrier(self):
        state = self.make_state()
        state["level"] = 2
        state["players"]["p0"]["hand"] = [10]
        state["players"]["p1"]["hand"] = [20]
        state["phase"] = "playing"
        state["window_id"] += 1
        self.act(state, "p0", "play", card=10)
        self.act(state, "p1", "play", card=20)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["stars"], 2)
        self.assertEqual(state["round_summary"]["reward"]["resource"], "stars")
        self.act(state, "p0", "next_round")
        self.assertEqual(state["phase"], "round_end")
        self.act(state, "p1", "next_round")
        self.assertEqual(state["level"], 3)
        self.assertEqual(state["phase"], "focus")

    def test_save_round_trip_preserves_private_state_without_aliases(self):
        state = self.make_state(4)
        saved = TheMindGame.serialize(state)
        restored = TheMindGame.deserialize(saved)
        self.assertEqual(TheMindGame.get_public_view(state, "p0"), TheMindGame.get_public_view(restored, "p0"))
        restored["players"]["p0"]["hand"].append(101)
        self.assertNotEqual(state["players"]["p0"]["hand"], restored["players"]["p0"]["hand"])
        altered = copy.deepcopy(saved)
        altered["players"]["p0"]["hand"] = altered["players"]["p1"]["hand"]
        with self.assertRaises(ValueError):
            TheMindGame.deserialize(altered)


if __name__ == "__main__":
    unittest.main()
