import tempfile
import unittest
from unittest import mock

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

    def test_search_policy_targets_can_use_mcts_reanalysis(self):
        state, player_id = self._build_state()
        actions = guandan._candidate_actions(state, player_id, 6)
        self.assertGreaterEqual(len(actions), 2)

        scored = [
            (
                actions[0],
                1.0,
                4,
                {"adjusted": 1.0, "avg": 1.0, "fast_path": 0.0},
            ),
            (
                actions[1],
                3.5,
                4,
                {"adjusted": 3.5, "avg": 3.5, "fast_path": 0.0},
            ),
        ]

        with mock.patch.object(guandan, "_should_use_mcts", return_value=True):
            with mock.patch.object(guandan, "_mcts_score_actions", return_value=scored):
                example = trainer.build_decision_example(
                    state,
                    player_id,
                    actions[0],
                    teacher="heuristic",
                    candidate_limit=6,
                    policy_target_source="search",
                    reanalysis_candidate_cap=6,
                )

        self.assertEqual(example.metadata.get("policy_target_source"), "mcts")
        self.assertEqual(example.metadata.get("target_scores")[:2], [1.0, 3.5])
        self.assertLess(example.policy_target[0], example.policy_target[1])

    def test_decision_example_accepts_policy_override(self):
        state, player_id = self._build_state()
        actions = guandan._candidate_actions(state, player_id, 6)
        self.assertGreaterEqual(len(actions), 2)

        example = trainer.build_decision_example(
            state,
            player_id,
            actions[0],
            teacher="model_search",
            candidate_actions_override=actions[:2],
            policy_target_override=[0.2, 0.8],
            target_scores_override=[1.5, 3.0],
            target_source_override="model_search",
            target_meta_override={"sims": 12},
        )

        self.assertEqual(example.metadata.get("policy_target_source"), "model_search")
        self.assertEqual(example.metadata.get("target_scores"), [1.5, 3.0])
        self.assertAlmostEqual(example.policy_target[0], 0.2, places=5)
        self.assertAlmostEqual(example.policy_target[1], 0.8, places=5)
        self.assertEqual(example.metadata.get("policy_target_meta", {}).get("sims"), 12)

    def test_collect_examples_model_search_uses_search_targets(self):
        def fake_search(_model, state, player_id, **kwargs):
            actions = guandan._candidate_actions(state, player_id, 4)
            if not actions:
                return None
            target = [0.0] * len(actions)
            target[0] = 1.0
            scores = [float(len(actions) - idx) for idx in range(len(actions))]
            return trainer.SearchDecision(
                action=dict(actions[0]),
                candidates=[dict(action) for action in actions],
                policy_target=target,
                target_scores=scores,
                metadata={"source": "model_search", "sims": 5},
            )

        with mock.patch.object(trainer, "_model_search_decision", side_effect=fake_search):
            examples = trainer.collect_bootstrap_examples(
                1,
                teacher="model_search",
                seed=0,
                candidate_limit=4,
                rounds_per_episode=1,
                model=object(),
            )

        self.assertTrue(examples)
        self.assertEqual(examples[0].teacher, "model_search")
        self.assertEqual(examples[0].metadata.get("policy_target_source"), "model_search")
        self.assertAlmostEqual(sum(examples[0].policy_target), 1.0, places=5)
        self.assertEqual(examples[0].metadata.get("policy_target_meta", {}).get("sims"), 5)

    def test_run_training_pipeline_uses_bootstrap_cache_when_present(self):
        state, player_id = self._build_state()
        actions = guandan._candidate_actions(state, player_id, 6)
        example = trainer.build_decision_example(
            state,
            player_id,
            actions[0],
            teacher="heuristic",
            candidate_limit=6,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = f"{tmpdir}/bootstrap.jsonl"
            trainer.save_examples_jsonl(cache_path, [example])
            args = trainer.build_arg_parser().parse_args(
                [
                    "--bootstrap-episodes",
                    "1",
                    "--epochs",
                    "0",
                    "--self-play-iterations",
                    "0",
                    "--bootstrap-cache",
                    cache_path,
                    "--quiet",
                ]
            )
            fake_torch = mock.Mock()
            fake_torch.manual_seed = mock.Mock()
            with mock.patch.object(trainer, "torch", fake_torch):
                with mock.patch.object(trainer, "build_model", return_value=object()):
                    with mock.patch.object(trainer, "collect_bootstrap_examples", side_effect=AssertionError("should use bootstrap cache")):
                        result = trainer.run_training_pipeline(args)

        self.assertEqual(result["example_count"], 1)

    def test_run_training_pipeline_uses_self_play_cache_when_present(self):
        state, player_id = self._build_state()
        actions = guandan._candidate_actions(state, player_id, 6)
        example = trainer.build_decision_example(
            state,
            player_id,
            actions[0],
            teacher="model_search",
            candidate_limit=6,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = trainer._self_play_cache_path(tmpdir, 0)
            trainer.save_examples_jsonl(cache_path, [example])
            args = trainer.build_arg_parser().parse_args(
                [
                    "--bootstrap-episodes",
                    "0",
                    "--epochs",
                    "0",
                    "--self-play-iterations",
                    "1",
                    "--self-play-epochs",
                    "0",
                    "--self-play-cache-dir",
                    tmpdir,
                    "--quiet",
                ]
            )
            fake_torch = mock.Mock()
            fake_torch.manual_seed = mock.Mock()
            with mock.patch.object(trainer, "torch", fake_torch):
                with mock.patch.object(trainer, "build_model", return_value=object()):
                    with mock.patch.object(trainer, "collect_bootstrap_examples", side_effect=AssertionError("should use self-play cache")):
                        result = trainer.run_training_pipeline(args)

        self.assertEqual(result["example_count"], 1)

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
