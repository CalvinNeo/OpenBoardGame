import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.test_guandan_retained_bomb import make_retained_bomb_state


class GuandanRetainedBombMctsGuardTests(unittest.TestCase):
    def _state(self):
        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["phase"] = "playing"
        state["current_turn"] = "bot"
        state["level_rank"] = 2
        deck = guandan._full_deck()
        bomb = [card for card in deck if card.get("rank") == 9][:4]
        ordinary = next(card for card in deck if card.get("rank") == 12)
        lead = next(card for card in deck if card.get("rank") == 10)
        held_ids = {card["id"] for card in bomb + [ordinary, lead]}
        deck = [card for card in deck if card["id"] not in held_ids]
        state["players"]["bot"]["hand"] = bomb + [ordinary]
        for player_id, count in (("opp", 4), ("mate", 12), ("opp2", 12)):
            state["players"][player_id]["hand"] = deck[:count]
            del deck[:count]
        state["current_trick"] = {
            "player_id": "opp",
            "cards": [lead["id"]],
            "combo": guandan._evaluate_combo([lead], 2, state["config"]),
        }
        state["seen_cards"] = [lead["id"]]
        return state, {"type": "play", "card_ids": [card["id"] for card in bomb]}

    def _accepts(self, state, action, profile):
        # The candidate has an overwhelming score advantage. The tactical guard
        # must therefore enforce its evidence requirement, not win a score tie.
        scored = [(None, 0.0, {}), (action["card_ids"], 100.0, {})]
        with (
            mock.patch.object(
                guandan_ai, "_get_cached_heuristic_scored_candidates", return_value=scored
            ),
            mock.patch.object(
                guandan_ai, "_retained_bomb_takeover_profile", return_value=profile
            ),
        ):
            return guandan._should_accept_mcts_override(
                state, "bot", {"type": "pass"}, action, 4
            )

    def test_shallow_search_cannot_spend_control_against_retained_tail_bomb(self):
        state, action = self._state()
        state["_ai_eval_cache"] = {
            "mcts_anytime": {"completed_depth": 0, "completed_rounds": 1}
        }
        self.assertFalse(self._accepts(
            state, action, {"risk": 0.94, "safe_closeout": 0.0}
        ))

    def test_saved_four_card_tail_blocks_every_unsafe_bomb_override(self):
        state = make_retained_bomb_state(4)
        for rank, size in ((11, 4), (11, 6), (14, 5)):
            with self.subTest(rank=rank, size=size):
                cards = [
                    card["id"] for card in state["players"]["bot2"]["hand"]
                    if card.get("rank") == rank
                ][:size]
                action = {"type": "play", "card_ids": cards}
                scored = [(None, 0.0, {}), (cards, 100.0, {})]
                with mock.patch.object(
                    guandan_ai,
                    "_get_cached_heuristic_scored_candidates",
                    return_value=scored,
                ):
                    self.assertFalse(guandan._should_accept_mcts_override(
                        state, "bot2", {"type": "pass"}, action, 4
                    ))

    def test_more_sampled_worlds_do_not_prove_the_retained_bomb_is_covered(self):
        state, action = self._state()
        state["_ai_eval_cache"] = {
            "mcts_anytime": {"completed_depth": 8, "completed_rounds": 100}
        }
        self.assertFalse(self._accepts(
            state, action, {"risk": 0.8, "safe_closeout": 0.0}
        ))

    def test_bomb_that_finishes_now_remains_allowed(self):
        state, action = self._state()
        state["players"]["bot"]["hand"] = [
            card for card in state["players"]["bot"]["hand"]
            if card["id"] in action["card_ids"]
        ]
        self.assertTrue(self._accepts(
            state, action, {"risk": 0.9, "safe_closeout": 0.0}
        ))

    def test_reliable_control_closeout_remains_allowed(self):
        state, action = self._state()
        self.assertTrue(self._accepts(
            state, action, {"risk": 0.04, "safe_closeout": 0.96}
        ))

    def test_weak_tail_bomb_evidence_does_not_ban_bombing(self):
        state, action = self._state()
        self.assertTrue(self._accepts(
            state, action, {"risk": 0.2, "safe_closeout": 0.0}
        ))

    def test_ordinary_response_is_unaffected(self):
        state, _action = self._state()
        ordinary = next(
            card for card in state["players"]["bot"]["hand"]
            if card.get("rank") == 12
        )
        action = {"type": "play", "card_ids": [ordinary["id"]]}
        self.assertTrue(self._accepts(
            state, action, {"risk": 0.95, "safe_closeout": 0.0}
        ))


class GuandanRetainedBombMinimaxGuardTests(unittest.TestCase):
    def _endgame_state(self):
        state = make_retained_bomb_state(4)
        state["config"]["bot_mode"] = "auto"
        # Keep a consistent card pool while moving this same tail-bomb threat
        # into auto mode's <= 24-card minimax branch.
        for pid in ("calvin", "bot4"):
            hand = state["players"][pid]["hand"]
            state["seen_cards"].extend(card["id"] for card in hand[2:])
            state["players"][pid]["hand"] = hand[:2]
        cards = [
            card["id"] for card in state["players"]["bot2"]["hand"]
            if card.get("rank") == 11
        ][:4]
        return state, {"type": "play", "card_ids": cards}

    def test_minimax_cannot_replace_pass_with_unsafe_four_jack_bomb(self):
        state, bomb = self._endgame_state()
        with (
            mock.patch.object(
                guandan, "_heuristic_best_action", return_value={"type": "pass"}
            ),
            mock.patch.object(
                guandan, "_minimax_pick_action", return_value=bomb
            ) as search,
        ):
            action = guandan.GuandanGame.bot_move(state, "bot2")
        search.assert_called_once()
        self.assertEqual(action, {"type": "pass"})
        self.assertEqual(state["bot_explain"]["bot2"]["method"], "heuristic")

    def test_minimax_pass_remains_a_valid_search_override(self):
        state, bomb = self._endgame_state()
        with (
            mock.patch.object(guandan, "_heuristic_best_action", return_value=bomb),
            mock.patch.object(
                guandan, "_minimax_pick_action", return_value={"type": "pass"}
            ) as search,
        ):
            action = guandan.GuandanGame.bot_move(state, "bot2")
        search.assert_called_once()
        self.assertEqual(action, {"type": "pass"})
        self.assertEqual(state["bot_explain"]["bot2"]["method"], "minimax")


if __name__ == "__main__":
    unittest.main()
