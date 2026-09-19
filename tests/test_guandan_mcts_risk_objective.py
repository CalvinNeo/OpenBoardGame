import contextlib
import unittest
from unittest import mock

from game import guandan


class GuandanMctsRiskObjectiveTests(unittest.TestCase):
    def _run_search(self, risk_lambda, *, halving=4, early_stop_gap=999.0, confidence_z=1.64):
        players = [{"player_id": f"p{seat}", "name": f"P{seat}", "seat": seat}
                   for seat in range(4)]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        for pid, ranks in zip(state["turn_order"], ((3, 5, 7), (8,), (9,), (10,))):
            hand = []
            for rank in ranks:
                index = next(index for index, card in enumerate(deck)
                             if card.get("rank") == rank and card.get("suit") == "clubs")
                hand.append(deck.pop(index))
            state["players"][pid].update(hand=hand, finished=False, finish_rank=None)
        state.update(
            phase="playing", level_rank=2, current_turn="p0", current_trick=None,
            trick_plays={}, pass_count=0, finish_order=[], round_memories=[],
            seen_cards=[card["id"] for card in deck], known_card_owners={}, visible_card_id=None,
        )
        state["config"].update(
            bot_mcts_early_stop_gap=early_stop_gap,
            bot_mcts_early_stop_stable_rounds=1,
            bot_mcts_successive_halving_min_rounds=halving,
            bot_mcts_confidence_z=confidence_z,
        )
        actions = [{"type": "play", "card_ids": [card["id"]]}
                   for card in state["players"]["p0"]["hand"]]
        priors = {action["card_ids"][0]: value for action, value in zip(actions, (30.0, 10.0, 0.0))}
        sample_index = [0]

        def determinize(source, _player_id, _rng, *_args):
            particle = guandan._clone_search_state(source)
            particle["sample_index"] = sample_index[0]
            sample_index[0] += 1
            return particle

        def leaf_value(child, *_args):
            card_id = child["current_trick"]["cards"][0]
            if card_id == actions[0]["card_ids"][0]:
                return 0.0  # Heuristic reference, deliberately weak in search.
            if card_id == actions[1]["card_ids"][0]:
                return 100.0 if child["sample_index"] % 2 else 0.0
            return 40.0  # Lower mean, higher risk-adjusted value than action 1.

        with contextlib.ExitStack() as stack:
            patches = (
                ("_candidate_actions", {"return_value": actions}),
                ("_filter_overbomb_actions", {"side_effect": lambda _state, _pid, choices: choices}),
                ("_mcts_root_heuristic_value", {"side_effect": lambda _state, _pid, action, _depth:
                                             priors[action["card_ids"][0]]}),
                ("_mcts_obvious_response_scores", {"return_value": None}),
                ("_mcts_high_single_bomb_scores", {"return_value": None}),
                ("_mcts_budget", {"return_value": (600, 0, 0, 1)}),
                ("_determinize_state", {"side_effect": determinize}),
                ("_mcts_reply_tree_value", {"side_effect": leaf_value}),
            )
            for name, kwargs in patches:
                stack.enter_context(mock.patch.object(guandan, name, **kwargs))
            # Keep real cloning and legal engine actions; control only candidate
            # priors/world outcomes to isolate the search's decision objective.
            picked, scores = guandan._mcts_pick_action(
                state, "p0", sims=600, depth=0, width=3, tree_ply=0,
                reply_width=1, risk_lambda=risk_lambda,
            )
        return actions, picked, scores, state["_ai_eval_cache"]["mcts_anytime"]

    def test_halving_does_not_discard_the_better_risk_adjusted_action(self):
        actions, picked, scores, _status = self._run_search(0.28)
        self.assertEqual(picked, actions[2])
        by_action = {tuple(action["card_ids"]): (score, stats) for action, score, _count, stats in scores}
        risky, safe = [by_action[tuple(actions[index]["card_ids"])] for index in (1, 2)]
        self.assertGreater(risky[1]["avg"], safe[1]["avg"])
        self.assertLess(risky[0], safe[0])
        self.assertEqual(scores[0][1], max(score for _action, score, _count, _stats in scores))
        no_halving_actions, no_halving_pick, _scores, _status = self._run_search(0.28, halving=10000)
        self.assertEqual(no_halving_pick, no_halving_actions[2])

    def test_early_stop_retains_uncertainty_in_the_estimated_risk_penalty(self):
        actions, picked, scores, status = self._run_search(0.28, early_stop_gap=0.0, confidence_z=0.0)
        self.assertEqual(picked, actions[2])
        # Even removing mean-estimation uncertainty must not pretend that the
        # risk penalty is exact after a handful of different sampled worlds.
        self.assertEqual(status["stop_reason"], "visit_budget")
        self.assertEqual(status["attempted"], status["target"])
        self.assertGreater(min(count for _action, _score, count, _stats in scores), 4)

    def test_zero_risk_keeps_mean_based_halving_and_early_stopping(self):
        actions, picked, scores, status = self._run_search(0.0, early_stop_gap=0.0, confidence_z=0.0)
        self.assertEqual(picked, actions[1])
        self.assertEqual(status["stop_reason"], "confidence")
        self.assertLess(status["attempted"], status["target"])
        self.assertEqual(scores[0][1], max(score for _action, score, _count, _stats in scores))
        actions, picked, scores, _status = self._run_search(0.0)
        self.assertEqual(picked, actions[1])
        counts = {tuple(action["card_ids"]): count for action, _score, count, _stats in scores}
        self.assertGreater(counts[tuple(actions[1]["card_ids"])], counts[tuple(actions[2]["card_ids"])])


if __name__ == "__main__":
    unittest.main()
