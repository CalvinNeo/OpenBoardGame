"""Keep first-place protection distinct from a recoverable ordinary reply."""

import copy
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture
from tests.test_guandan_history_policy import CountOnlyHand, UnreadableInitialHands


class GuandanBombLeadOrderTests(unittest.TestCase):
    @staticmethod
    def lead_cards(state):
        return pick_card_ids(
            state["players"]["bot2"]["hand"],
            ("♠️3", "♦️3", "♦️3", "♠️4", "♦️4"),
        )

    def test_saved_lead_blocks_a_publicly_supported_finishing_bomb(self):
        for mode in ("heuristic", "auto"):
            with self.subTest(mode=mode):
                state = replay_fixture("2a14d0", 79, {"bot_mode": mode})
                action = guandan.GuandanGame.bot_move(state, "bot2")
                cards = guandan._map_hand_by_id(state["players"]["bot2"]["hand"])
                self.assertEqual([cards[cid]["rank"] for cid in action["card_ids"]], [14] * 4)
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot2", action)[1])

    def test_full_house_would_allow_calvin_to_finish_before_the_ace_response(self):
        state = replay_fixture("2a14d0", 79)
        actions = [
            ("bot2", {"type": "play", "card_ids": self.lead_cards(state)}),
            ("z", {"type": "pass"}),
            ("bot4", {"type": "pass"}),
            ("calvin", {"type": "play", "card_ids": [
                card["id"] for card in state["players"]["calvin"]["hand"]
            ]}),
        ]
        for player, action in actions:
            self.assertIsNone(guandan.GuandanGame.apply_action(state, player, action)[1])
        self.assertEqual(state["finish_order"], ["calvin"])
        self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot2", {
            "type": "play", "card_ids": [
                card["id"] for card in state["players"]["bot2"]["hand"]
            ],
        })[1])
        self.assertEqual(state["finish_order"], ["calvin", "bot2"])

    def test_without_retained_bomb_evidence_full_house_keeps_the_bomb_for_reentry(self):
        state = replay_fixture("2a14d0", 79, {"bot_mode": "heuristic"})
        state["round_memories"] = []
        expected = set(self.lead_cards(state))
        self.assertEqual(set(guandan.GuandanGame.bot_move(state, "bot2")["card_ids"]), expected)

    def test_lead_risk_uses_public_history_without_looking_at_calvins_bomb(self):
        state = replay_fixture("2a14d0", 79)
        cards = self.lead_cards(state)
        expected = guandan_ai.call(guandan, "_retained_bomb_takeover_profile", state, "bot2", cards)
        hidden = copy.deepcopy(state)
        hidden.pop("_ai_eval_cache", None)
        for player, data in hidden["players"].items():
            if player != "bot2":
                data["hand"] = CountOnlyHand(len(data["hand"]))
        for memory in hidden["round_memories"]:
            memory["initial_hands"] = UnreadableInitialHands()
        actual = guandan_ai.call(guandan, "_retained_bomb_takeover_profile", hidden, "bot2", cards)
        self.assertEqual(actual, expected)
        self.assertGreaterEqual(actual["risk"], 0.5)


if __name__ == "__main__":
    unittest.main()
