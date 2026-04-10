import unittest

from game import guandan
from game import guandan_nn_train as trainer


class GuandanNNTrainTests(unittest.TestCase):
    def _build_state(self):
        players = [
            {"player_id": "p0", "name": "P0", "seat": 0, "is_bot": True},
            {"player_id": "p1", "name": "P1", "seat": 1, "is_bot": True},
            {"player_id": "p2", "name": "P2", "seat": 2, "is_bot": True},
            {"player_id": "p3", "name": "P3", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game(dict(trainer.DEFAULT_TRAIN_CONFIG), players)
        return state, state["current_turn"]

    def test_decision_feature_dims_match_example(self):
        state, player_id = self._build_state()
        actions = guandan._candidate_actions(state, player_id, 6)
        self.assertTrue(actions)

        example = trainer.build_decision_example(
            state,
            player_id,
            actions[0],
            teacher="heuristic",
            candidate_limit=6,
        )
        state_dim, action_dim = trainer.decision_feature_dims()

        self.assertEqual(len(example.state_features), state_dim)
        self.assertGreaterEqual(len(example.action_features), 1)
        for action_features in example.action_features:
            self.assertEqual(len(action_features), action_dim)

    def test_collect_bootstrap_examples_assigns_outcomes(self):
        examples = trainer.collect_bootstrap_examples(
            1,
            teacher="heuristic",
            seed=0,
            candidate_limit=6,
            rounds_per_episode=1,
        )
        self.assertTrue(examples)
        for example in examples[:10]:
            self.assertGreaterEqual(example.chosen_index, 0)
            self.assertLess(example.chosen_index, len(example.action_features))
            self.assertGreaterEqual(example.outcome, -1.0)
            self.assertLessEqual(example.outcome, 1.0)

    @unittest.skipIf(trainer.torch is None, "torch not installed")
    def test_model_forward_matches_batch_shape(self):
        state, player_id = self._build_state()
        actions = guandan._candidate_actions(state, player_id, 6)
        example = trainer.build_decision_example(
            state,
            player_id,
            actions[0],
            teacher="heuristic",
            candidate_limit=6,
        )
        example.outcome = 0.5
        batch = trainer.collate_examples([example, example])
        model = trainer.build_model(hidden_dim=64, dropout=0.0)
        logits, value = model(batch["state"], batch["actions"], batch["mask"])

        self.assertEqual(tuple(logits.shape), (2, len(example.action_features)))
        self.assertEqual(tuple(value.shape), (2,))


if __name__ == "__main__":
    unittest.main()
