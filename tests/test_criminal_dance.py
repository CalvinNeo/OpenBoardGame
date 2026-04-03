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
        self.assertIn("result", state["played"][-1])
        self.assertIn("Criminal found, no Alibi", state["played"][-1]["result"])

    def test_detective_alibi_block_records_played_result(self):
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
        state["players"][target]["hand"] = [
            {"id": "c1", "type": CARD_CRIMINAL},
            {"id": "a1", "type": "alibi"},
        ]
        _, error = CriminalDanceGame.apply_action(
            state,
            actor,
            {"type": "play_card", "card_id": "d1", "target_player_id": target},
        )
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertIn("result", state["played"][-1])
        self.assertIn("blocked by Alibi", state["played"][-1]["result"])

    def test_trade_as_last_card_has_no_effect(self):
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
        self.assertEqual([], state["players"][actor]["hand"])
        self.assertEqual(1, len(state["players"][target]["hand"]))
        self.assertIn("No effect", state["played"][-1]["result"])

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

    def test_witness_played_shows_target_but_not_identity(self):
        state = CriminalDanceGame.init_game({}, _players(3))
        actor = state["current_player_id"]
        target = next(pid for pid in state["player_order"] if pid != actor)
        actor_name = state["player_meta"][actor]["name"]
        target_name = state["player_meta"][target]["name"]
        state["players"][actor]["hand"] = [{"id": "w1", "type": "witness"}]
        state["players"][target]["hand"] = [{"id": "c1", "type": CARD_CRIMINAL}]

        _, error = CriminalDanceGame.apply_action(
            state,
            actor,
            {"type": "play_card", "card_id": "w1", "target_player_id": target},
        )

        self.assertIsNone(error)
        self.assertIn("result", state["played"][-1])
        self.assertIn(target_name, state["played"][-1]["result"])
        self.assertNotIn(CARD_CRIMINAL, state["played"][-1]["result"])

        actor_view = CriminalDanceGame.get_public_view(state, actor)
        target_view = CriminalDanceGame.get_public_view(state, target)
        actor_private = actor_view["players"][state["player_order"].index(actor)]["private_log"]
        target_private = target_view["players"][state["player_order"].index(target)]["private_log"]
        self.assertTrue(any(target_name in note and CARD_CRIMINAL in note for note in actor_private))
        self.assertEqual([], target_private)

    def test_trade_played_shows_target(self):
        state = CriminalDanceGame.init_game({}, _players(3))
        actor = state["current_player_id"]
        target = next(pid for pid in state["player_order"] if pid != actor)
        target_name = state["player_meta"][target]["name"]
        state["players"][actor]["hand"] = [
            {"id": "t1", "type": "trade"},
            {"id": "x1", "type": "civilian"},
        ]
        state["players"][target]["hand"] = [{"id": "y1", "type": "civilian"}]

        _, error = CriminalDanceGame.apply_action(
            state,
            actor,
            {"type": "play_card", "card_id": "t1", "target_player_id": target, "your_card_id": "x1"},
        )

        self.assertIsNone(error)
        self.assertIn("result", state["played"][-1])
        self.assertIn("Traded with", state["played"][-1]["result"])
        self.assertIn(target_name, state["played"][-1]["result"])


if __name__ == "__main__":
    unittest.main()
