import unittest

from game.criminal_dance import CARD_CRIMINAL, CARD_DETECTIVE, CriminalDanceGame


def _players(count: int):
    return [
        {
            "player_id": f"p{idx + 1}",
            "name": f"P{idx + 1}",
            "seat": idx,
            "is_bot": False,
        }
        for idx in range(count)
    ]


class CriminalDanceGameTests(unittest.TestCase):
    def test_init_deals_four_cards_each(self):
        state = CriminalDanceGame.init_game({}, _players(3))
        self.assertEqual(3, len(state["player_order"]))
        for pid in state["player_order"]:
            self.assertEqual(4, len(state["players"][pid]["hand"]))
        self.assertIsNotNone(state["current_player_id"])

    def test_criminal_cannot_be_played_if_not_last_card(self):
        state = CriminalDanceGame.init_game({}, _players(3))
        actor = state["current_player_id"]
        state["players"][actor]["hand"] = [
            {"id": "x1", "type": CARD_DETECTIVE},
            {"id": "x2", "type": CARD_CRIMINAL},
        ]
        _, error = CriminalDanceGame.apply_action(
            state,
            actor,
            {"type": "play_card", "card_id": "x2"},
        )
        self.assertEqual("criminal can only be played as last card", error)

    def test_detective_can_end_round(self):
        state = CriminalDanceGame.init_game(
            {
                "detective_activation_rule": "always",
                "scoring_enabled": False,
                "enable_boy": False,
            },
            _players(3),
        )
        actor = state["current_player_id"]
        target = next(pid for pid in state["player_order"] if pid != actor)
        state["players"][actor]["hand"] = [{"id": "d1", "type": CARD_DETECTIVE}]
        state["players"][target]["hand"] = [{"id": "c1", "type": CARD_CRIMINAL}]
        events, error = CriminalDanceGame.apply_action(
            state,
            actor,
            {"type": "play_card", "card_id": "d1", "target_player_id": target},
        )
        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertTrue(state["game_over"])
        self.assertEqual("detective", state["winner_mode"])

    def test_trade_as_last_card_is_allowed(self):
        state = CriminalDanceGame.init_game({}, _players(3))
        actor = state["current_player_id"]
        target = next(pid for pid in state["player_order"] if pid != actor)
        state["players"][actor]["hand"] = [{"id": "t1", "type": "trade"}]
        state["players"][target]["hand"] = [{"id": "c1", "type": "civilian"}]
        _, error = CriminalDanceGame.apply_action(
            state,
            actor,
            {"type": "play_card", "card_id": "t1", "target_player_id": target},
        )
        self.assertIsNone(error)
        self.assertTrue(state["players"][actor]["hand"])

    def test_bot_must_play_first_finder_first(self):
        state = CriminalDanceGame.init_game({}, _players(3))
        actor = state["current_player_id"]
        state["players"][actor]["hand"] = [
            {"id": "f1", "type": "first_finder"},
            {"id": "d1", "type": CARD_DETECTIVE},
        ]
        move = CriminalDanceGame.bot_move(state, actor)
        self.assertIsNotNone(move)
        self.assertEqual("play_card", move["type"])
        self.assertEqual("f1", move["card_id"])


if __name__ == "__main__":
    unittest.main()
