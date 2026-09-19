import contextlib
import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanSearchIntegrityTests(unittest.TestCase):
    def _state(self, ranks_by_player):
        players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat}
                   for seat in range(4)]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        for pid, ranks in zip(state["turn_order"], ranks_by_player):
            hand = []
            for rank in ranks:
                index = next(index for index, card in enumerate(deck)
                             if card.get("rank") == rank and card.get("suit") == "clubs")
                hand.append(deck.pop(index))
            state["players"][pid].update(hand=hand, finished=False, finish_rank=None)
        state.update(
            phase="playing", level_rank=2, current_turn="p0", current_trick=None,
            trick_plays={}, pass_count=0, finish_order=[], round_memories=[],
            seen_cards=[card["id"] for card in deck], known_card_owners={},
            visible_card_id=None, _ai_eval_cache={},
        )
        state["config"]["bot_determinize_samples"] = 1
        return state

    def test_determinization_recomputes_hidden_hand_dependent_lead_scores(self):
        state = self._state([[8, 9, 10], [3], [5], [14]])
        cards = [state["players"]["p0"]["hand"][0]["id"]]
        original = guandan_ai.call(guandan, "_lead_option_score", state, "p0", cards)
        guandan._list_hint_options(state, "p0")
        # Seed 0 changes the next opponent's last card while preserving the
        # acting hand, public card pool and every player's remaining count.
        particle = guandan._determinize_state(state, "p0", random.Random(0))
        fresh = copy.deepcopy(particle)
        fresh["_ai_eval_cache"] = {}
        expected = guandan_ai.call(guandan, "_lead_option_score", fresh, "p0", cards)
        self.assertNotEqual(original, expected)
        self.assertIn("candidate_features", particle["_ai_eval_cache"])
        self.assertIn("legal_action_options", particle["_ai_eval_cache"])
        self.assertAlmostEqual(
            guandan_ai.call(guandan, "_lead_option_score", particle, "p0", cards), expected,
        )

    def test_cheap_lead_cache_does_not_survive_a_changed_acting_hand(self):
        state = self._state([[3, 6, 6, 10], [3], [9], [5]])
        cards = [state["players"]["p0"]["hand"][0]["id"]]
        original = guandan_ai.call(guandan, "_lead_cheap_option_score", state, "p0", cards)
        particle = guandan._clone_search_state(state, preserve_eval_cache=True)
        own = particle["players"]["p0"]["hand"]
        other = particle["players"]["p1"]["hand"]
        own[-1], other[0] = other[0], own[-1]
        fresh = copy.deepcopy(particle)
        fresh["_ai_eval_cache"] = {}
        expected = guandan_ai.call(guandan, "_lead_cheap_option_score", fresh, "p0", cards)
        self.assertNotEqual(original, expected)
        self.assertAlmostEqual(
            guandan_ai.call(guandan, "_lead_cheap_option_score", particle, "p0", cards), expected,
        )

    def _minimax_fixture(self):
        state = self._state([[3, 10, 6, 6], [9], [4], [5]])
        hand = state["players"]["p0"]["hand"]
        actions = [
            {"type": "play", "card_ids": [hand[0]["id"]]},
            {"type": "play", "card_ids": [hand[1]["id"]]},
            {"type": "play", "card_ids": [card["id"] for card in hand[2:]]},
        ]
        return state, actions

    def _search_patches(self, actions, evaluator):
        stack = contextlib.ExitStack()
        stack.enter_context(mock.patch.object(guandan, "_candidate_actions", return_value=actions))
        stack.enter_context(mock.patch.object(
            guandan, "_filter_overbomb_actions", side_effect=lambda _state, _pid, choices: choices,
        ))
        stack.enter_context(mock.patch.object(guandan_ai, "_public_endgame_closeout_action", return_value=None))
        stack.enter_context(mock.patch.object(guandan_ai, "_forced_endgame_control_relay_action", return_value=None))
        stack.enter_context(mock.patch.object(guandan_ai, "_minimax_root_lead_single_penalty", return_value=0.0))
        stack.enter_context(mock.patch.object(guandan_ai, "_quick_candidate_score", return_value=0.0))
        stack.enter_context(mock.patch.object(guandan_ai, "_minimax_value", side_effect=evaluator))
        return stack

    def test_completed_search_winner_is_not_replaced_by_a_higher_single(self):
        state, actions = self._minimax_fixture()

        def evaluate(child, *_args, **_kwargs):
            return 300.0 if child["current_trick"]["cards"] == actions[0]["card_ids"] else -300.0

        with self._search_patches(actions, evaluate):
            chosen = guandan._minimax_pick_action(state, "p0", depth=1, width=3)
        self.assertEqual(chosen, actions[0])
        self.assertEqual(state["_ai_eval_cache"]["minimax_anytime"]["completed_depth"], 1)

    def test_interrupted_deeper_search_keeps_last_completed_winner(self):
        state, actions = self._minimax_fixture()
        clock = [0.0]

        def evaluate(child, _bot_id, depth, *_args, **_kwargs):
            if depth > 0:
                clock[0] = 2.0
            return 300.0 if child["current_trick"]["cards"] == actions[0]["card_ids"] else -300.0

        with self._search_patches(actions, evaluate), mock.patch.object(
            guandan_ai.time, "perf_counter", side_effect=lambda: clock[0],
        ):
            chosen = guandan._minimax_pick_action(state, "p0", depth=2, width=3, deadline=1.0)
        self.assertEqual(chosen, actions[0])
        status = state["_ai_eval_cache"]["minimax_anytime"]
        self.assertEqual(status["completed_depth"], 1)
        self.assertEqual(status["interrupted_depth"], 2)

    def test_no_completed_search_keeps_defensive_legal_fallback(self):
        state, actions = self._minimax_fixture()
        clock = [0.0]

        def evaluate(*_args, **_kwargs):
            clock[0] = 2.0
            return 300.0

        with self._search_patches(actions, evaluate), mock.patch.object(
            guandan_ai.time, "perf_counter", side_effect=lambda: clock[0],
        ):
            chosen = guandan._minimax_pick_action(state, "p0", depth=2, width=3, deadline=1.0)
        self.assertEqual(chosen, actions[1])
        status = state["_ai_eval_cache"]["minimax_anytime"]
        self.assertIsNone(status["completed_depth"])
        self.assertTrue(status["deadline_limited"])
        _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), "p0", chosen)
        self.assertIsNone(error)


if __name__ == "__main__":
    unittest.main()
