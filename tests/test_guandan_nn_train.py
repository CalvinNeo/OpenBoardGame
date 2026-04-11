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
        self.assertEqual(len(example.policy_target), len(example.action_features))
        self.assertAlmostEqual(sum(example.policy_target), 1.0, places=5)
        self.assertGreater(example.sample_weight, 0.0)

    def test_decision_example_from_dict_supports_legacy_payload(self):
        payload = {
            "state_features": [0.1, 0.2],
            "action_features": [[0.3], [0.4]],
            "action_labels": ["A", "B"],
            "chosen_index": 1,
            "outcome": 0.5,
            "player_id": "p0",
            "team": "A",
            "round_number": 1,
            "teacher": "heuristic",
            "metadata": {},
        }

        example = trainer.DecisionExample.from_dict(payload)

        self.assertEqual(example.policy_target, [0.0, 1.0])
        self.assertEqual(example.sample_weight, 1.0)

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
            self.assertEqual(len(example.policy_target), len(example.action_features))
            self.assertAlmostEqual(sum(example.policy_target), 1.0, places=5)
            self.assertGreater(example.sample_weight, 0.0)

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
        self.assertEqual(tuple(batch["policy_target"].shape), (2, len(example.action_features)))
        self.assertEqual(tuple(batch["sample_weight"].shape), (2,))


if __name__ == "__main__":
    unittest.main()
