import unittest
from copy import deepcopy

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
    def _finish_round(self, players=None, config=None):
        state = CriminalDanceGame.init_game(
            config or {"target_score_by_player_count": {3: 50}},
            players or _players(3),
        )
        actor = state["current_player_id"]
        state["players"][actor]["hand"] = [{"id": "criminal_last", "type": CARD_CRIMINAL}]
        _, error = CriminalDanceGame.apply_action(
            state, actor, {"type": "play_card", "card_id": "criminal_last"}
        )
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        return state

    def test_next_round_waits_for_every_human_and_preserves_results(self):
        state = self._finish_round()
        finished_players = deepcopy(state["players"])
        finished_played = deepcopy(state["played"])
        finished_summary = state["last_summary"]
        for player_id in ("p1", "p2"):
            events, error = CriminalDanceGame.apply_action(state, player_id, {"type": "play_again"})
            self.assertIsNone(error)
            self.assertEqual("criminal_dance:round_ready", events[0]["type"])
            self.assertTrue(state["game_over"])
            self.assertEqual(1, state["round_number"])
            self.assertEqual(finished_players, state["players"])
            self.assertEqual(finished_played, state["played"])
            self.assertEqual(finished_summary, state["last_summary"])
            self.assertEqual([], CriminalDanceGame.get_legal_actions(state, player_id))

        state = CriminalDanceGame.deserialize(deepcopy(CriminalDanceGame.serialize(state)))
        view = CriminalDanceGame.get_public_view(state, "p1")
        self.assertEqual(["p1", "p2"], view["round_ready_player_ids"])
        self.assertEqual(["p3"], view["round_waiting_player_ids"])
        self.assertEqual([True, True, False], [player["round_ready"] for player in view["players"]])
        self.assertEqual(["play_again"], CriminalDanceGame.get_legal_actions(state, "p3"))

        events, error = CriminalDanceGame.apply_action(state, "p3", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertEqual("criminal_dance:play_again", events[-1]["type"])
        self.assertFalse(state["game_over"])
        self.assertEqual(2, state["round_number"])
        self.assertEqual([], state["round_ready_player_ids"])
        self.assertEqual([], state["played"])
        for player_id, player in state["players"].items():
            self.assertEqual(4, len(player["hand"]))
            self.assertEqual(finished_players[player_id]["score"], player["score"])

    def test_bots_are_ready_without_skipping_human_review(self):
        players = _players(3)
        players[1]["is_bot"] = True
        players[2]["is_bot"] = True
        state = self._finish_round(players=players)
        view = CriminalDanceGame.get_public_view(state, "p1")
        self.assertEqual(["p2", "p3"], view["round_ready_player_ids"])
        self.assertEqual(["p1"], view["round_waiting_player_ids"])
        self.assertIsNone(CriminalDanceGame.bot_move(state, "p2"))
        self.assertTrue(state["game_over"])

        _, error = CriminalDanceGame.apply_action(state, "p1", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertEqual(2, state["round_number"])

    def test_round_confirmation_rejects_duplicate_and_non_player_actions(self):
        state = self._finish_round()
        CriminalDanceGame.apply_action(state, "p1", {"type": "play_again"})
        snapshot = deepcopy(state)
        for player_id, expected_error in (
            ("p1", "already ready for next round"),
            ("spectator", "player not in game"),
        ):
            events, error = CriminalDanceGame.apply_action(state, player_id, {"type": "play_again"})
            self.assertEqual(expected_error, error)
            self.assertEqual([], events)
            self.assertEqual(snapshot, state)
        self.assertEqual([], CriminalDanceGame.get_legal_actions(state, "spectator"))

    def test_new_match_waits_for_every_human_and_resets_scores(self):
        state = self._finish_round(config={"target_score_by_player_count": {3: 1}})
        self.assertTrue(state["match_over"])
        for player_id in ("p1", "p2"):
            _, error = CriminalDanceGame.apply_action(state, player_id, {"type": "play_again"})
            self.assertIsNone(error)
            self.assertTrue(state["match_over"])
            self.assertTrue(any(player["score"] for player in state["players"].values()))
        _, error = CriminalDanceGame.apply_action(state, "p3", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertFalse(state["match_over"])
        self.assertFalse(state["game_over"])
        self.assertEqual(1, state["round_number"])
        self.assertEqual([0, 0, 0], [player["score"] for player in state["players"].values()])

    def test_older_saved_round_accepts_confirmation(self):
        state = self._finish_round()
        state.pop("round_ready_player_ids")
        restored = CriminalDanceGame.deserialize(deepcopy(state))
        view = CriminalDanceGame.get_public_view(restored, "p1")
        self.assertEqual(["p1", "p2", "p3"], view["round_waiting_player_ids"])
        _, error = CriminalDanceGame.apply_action(restored, "p1", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertEqual(["p1"], restored["round_ready_player_ids"])

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
        state = CriminalDanceGame.init_game({"enable_boy": False}, _players(3))
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
