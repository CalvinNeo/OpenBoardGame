import copy
import unittest

from game import guandan
from tests.guandan_history_fixtures import FIXTURES, replay_fixture


class GuandanHistoryFixtureTests(unittest.TestCase):
    def test_every_replayed_prefix_has_unique_card_zones_and_no_future_history(self):
        all_card_ids = {card["id"] for card in guandan._full_deck()}
        for case, fixture in FIXTURES.items():
            for before_action in range(1, len(fixture["actions"]) + 2):
                with self.subTest(case=case, before_action=before_action):
                    state = replay_fixture(case, before_action)
                    hand_ids = [
                        card["id"]
                        for player in state["players"].values()
                        for card in player["hand"]
                    ]
                    seen_ids = state["seen_cards"]
                    self.assertEqual(len(hand_ids), len(set(hand_ids)))
                    self.assertEqual(len(seen_ids), len(set(seen_ids)))
                    self.assertFalse(set(hand_ids) & set(seen_ids))
                    self.assertEqual(set(hand_ids) | set(seen_ids), all_card_ids)
                    current_ids = (state.get("current_trick") or {}).get("cards", [])
                    self.assertLessEqual(set(current_ids), set(seen_ids))
                    for cards in state["trick_plays"].values():
                        if isinstance(cards, list):
                            self.assertLessEqual(
                                {card["id"] for card in cards}, set(seen_ids)
                            )

                    public_view = guandan.GuandanGame.get_public_view(state, "bot4")
                    history = public_view["round_history"]
                    actual_actions = [
                        (action["player_id"], tuple(action.get("cards", [])))
                        for entry in history
                        for trick in entry["tricks"]
                        for action in trick["actions"]
                    ]
                    expected_actions = list(fixture["actions"][:before_action - 1])
                    self.assertEqual(actual_actions, expected_actions)
                    self.assertTrue(all("initial_hands" not in entry for entry in history))
                    self.assertEqual(state["bot_explain"], {})
                    self.assertEqual(state["bot_explain_history"], {})
                    if before_action <= len(fixture["actions"]):
                        self.assertEqual(
                            state["current_turn"], fixture["actions"][before_action - 1][0]
                        )

    def test_replay_rejects_invalid_action_boundaries(self):
        for boundary in (0, len(FIXTURES["72c"]["actions"]) + 2):
            with self.subTest(boundary=boundary):
                with self.assertRaises(ValueError):
                    replay_fixture("72c", boundary)


class GuandanPublicHistoryDecisionTests(unittest.TestCase):
    def _choose(self, case, before_action):
        # Exercise the actual bounded heuristic fallback used in these saves.
        # Excluding sampled search makes policy regressions deterministic.
        state = replay_fixture(
            case,
            before_action,
            config={
                "bot_mode": "heuristic",
                "bot_endgame_threshold": 0,
                "bot_think_time_ms": 2000,
            },
        )
        player_id = state["current_turn"]
        action = guandan.GuandanGame.bot_move(state, player_id)
        self.assertIsNotNone(action)
        _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), player_id, action)
        self.assertIsNone(error)
        hand_map = guandan._map_hand_by_id(state["players"][player_id]["hand"])
        cards = [hand_map[card_id] for card_id in action.get("card_ids", [])]
        combo = guandan._evaluate_combo(cards, state["level_rank"], state["config"])
        return state, action, cards, combo

    def test_72c_last_defender_contests_second_unanswered_pair_with_a_pair(self):
        state, action, cards, combo = self._choose("72c", 31)
        self.assertEqual(state["current_turn"], "bot4")
        self.assertEqual(len(state["players"]["calvin"]["hand"]), 13)
        self.assertEqual(action["type"], "play")
        self.assertEqual(combo["type"], "pair")
        self.assertFalse(any(guandan._is_wild(card, state["level_rank"]) for card in cards))

    def test_72c_last_defender_contests_third_unanswered_pair(self):
        state, action, _cards, combo = self._choose("72c", 35)
        self.assertEqual(state["current_turn"], "bot4")
        self.assertEqual(len(state["players"]["calvin"]["hand"]), 11)
        self.assertEqual(action["type"], "play")
        self.assertEqual(combo["type"], "pair")

    def test_7a5_waits_for_teammate_to_answer_a_new_small_joker(self):
        state, action, _cards, _combo = self._choose("7a5", 15)
        self.assertEqual(state["current_turn"], "bot2")
        self.assertEqual(state["trick_plays"]["bot4"], "pass")
        # Bot 4 passed the earlier ace, before Calvin raised to a small joker.
        self.assertEqual(state["current_trick"]["combo"]["rank_value"], 90)
        self.assertEqual(action["type"], "pass")

    def test_7a5_leads_joker_instead_of_feeding_revealed_pair_lane(self):
        state, action, cards, combo = self._choose("7a5", 49)
        self.assertEqual(state["current_turn"], "bot4")
        self.assertIsNone(state["current_trick"])
        self.assertEqual(len(state["players"]["calvin"]["hand"]), 4)
        self.assertEqual(action["type"], "play")
        self.assertEqual(combo["type"], "single")
        self.assertIn(cards[0].get("joker"), ("small", "big"))


if __name__ == "__main__":
    unittest.main()
