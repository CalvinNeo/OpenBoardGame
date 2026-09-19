import copy
import itertools
import json
import random
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from game import guandan
from scripts import benchmark_guandan as bench


class GuandanBenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.initial = bench.make_deal(guandan, 123, 7)

    def test_deal_seed_does_not_change_global_randomness(self):
        before = random.getstate()
        self.assertEqual(self.initial, bench.make_deal(guandan, 123, 7))
        self.assertEqual(before, random.getstate())
        self.assertNotEqual(self.initial, bench.make_deal(guandan, 124, 7))
        self.assertEqual(self.initial["level_rank"], 7)
        self.assertEqual(self.initial["round_memories"][0]["level_rank"], 7)

    def test_public_observation_is_invariant_to_hidden_hand_permutation(self):
        actor = self.initial["current_turn"]
        other = [pid for pid in self.initial["turn_order"] if pid != actor]
        changed = copy.deepcopy(self.initial)
        for first, second in zip(other, other[1:]):
            changed["players"][first]["hand"], changed["players"][second]["hand"] = (
                changed["players"][second]["hand"], changed["players"][first]["hand"],
            )
        changed["round_memories"][0]["initial_hands"] = {"SECRET": [1, 2, 3]}
        changed["round_memories"][0]["final_hands"] = {"SECRET": [4]}
        changed["bot_explain"]["SECRET"] = {"cards": [1]}
        changed["_ai_eval_cache"] = {"SECRET": 4}
        changed["new_private_field"] = "SECRET"
        first = bench.policy_observation(guandan, self.initial, actor, 9, "public")
        second = bench.policy_observation(guandan, changed, actor, 9, "public")
        self.assertEqual(first, second)
        self.assertNotIn("SECRET", json.dumps(second))
        self.assertEqual(first["players"][actor]["hand"], self.initial["players"][actor]["hand"])
        cards = [card["id"] for data in first["players"].values() for card in data["hand"]]
        self.assertEqual(len(cards), len(set(cards)))
        self.assertEqual(len(cards), 108)

    def test_public_cards_and_known_owners_survive_masking(self):
        state = copy.deepcopy(self.initial)
        first = state["current_turn"]
        card = state["players"][first]["hand"][0]
        _, error = guandan.GuandanGame.apply_action(state, first, {"type": "play", "card_ids": [card["id"]]})
        self.assertIsNone(error)
        actor = state["current_turn"]
        view = bench.policy_observation(guandan, state, actor, 100, "public")
        held = {card["id"] for data in view["players"].values() for card in data["hand"]}
        self.assertNotIn(card["id"], held)
        exposed = state["visible_card_id"]
        if exposed not in state["seen_cards"]:
            self.assertIn(exposed, [card["id"] for card in view["players"][first]["hand"]])
        self.assertEqual(view["round_memories"][0]["tricks"], state["round_memories"][0]["tricks"])
        self.assertTrue(view["round_memories"][0]["tricks"])

    def test_outcomes_match_all_finish_orders_and_are_zero_sum(self):
        for order in itertools.permutations(self.initial["turn_order"]):
            state = {**self.initial, "finish_order": list(order)}
            a = bench.round_outcome(state, "A")
            b = bench.round_outcome(state, "B")
            winner = state["player_teams"][order[0]]
            partner_position = next(index for index, pid in enumerate(order[1:], 2)
                                    if state["player_teams"][pid] == winner)
            self.assertEqual(abs(a["net_points"]), 5 - partner_position)
            self.assertEqual(a["net_points"], -b["net_points"])
            self.assertEqual(a["win"] + b["win"], 1)

    def test_pair_statistics_do_not_treat_mirrored_games_as_independent(self):
        records = []
        for index in range(10):
            for team, win, points, ranks in (("A", 1, 3, [1, 2]), ("B", 0, -3, [3, 4])):
                records.append({"pair_index": index, "candidate_team": team, "win": win,
                                "net_points": points, "candidate_ranks": ranks,
                                "deal_seed": index, "level": 7, "deal_sha256": str(index)})
        result = bench.summarize(records)
        self.assertEqual(result["pairs"], 10)
        self.assertEqual(result["win_rate"]["mean"], 0.5)
        self.assertEqual(result["net_points_per_game"]["mean"], 0)
        self.assertEqual(result["verdict"], "inconclusive")
        self.assertGreater(result["win_rate"]["ci95"][1], 0.5)
        with self.assertRaises(ValueError):
            bench.summarize(records[:-1])
        records[0]["deal_sha256"] = "different deal"
        with self.assertRaises(ValueError):
            bench.summarize(records)

    def test_small_sample_all_wins_is_not_evidence_of_improvement(self):
        bound = bench.bounded_mean([3.0], -3, 3)
        self.assertLess(bound["ci95"][0], 0)
        self.assertIsNone(bound["standard_error"])
        self.assertGreater(bench.bounded_mean([1.0] * 1000, -3, 3)["ci95"][0], 0)

    def test_internal_random_instances_are_seeded(self):
        first, second = bench._SeededRandom(123), bench._SeededRandom(123)
        self.assertEqual([first.Random().random() for _ in range(3)],
                         [second.Random().random() for _ in range(3)])
        self.assertEqual(first.Random(77).random(), random.Random(77).random())

    def test_bootstrap_is_repeatable_and_preserves_conservative_interval(self):
        values = [-0.5, 0, 0.5, 1] * 25
        before = random.getstate()
        first = bench.paired_metric(values, -3, 3)
        second = bench.paired_metric(values, -3, 3)
        self.assertEqual(first, second)
        self.assertEqual(before, random.getstate())
        self.assertEqual(first["ci_method"], "paired_percentile_bootstrap_5000")
        self.assertGreater(first["ci95"][0], first["conservative_ci95"][0])
        self.assertLess(first["ci95"][1], first["conservative_ci95"][1])
        self.assertLessEqual(first["ci95"][0], first["mean"])
        self.assertGreaterEqual(first["ci95"][1], first["mean"])
        constant = bench.paired_metric([0.5] * 30, -3, 3)
        self.assertLess(constant["ci95"][0], 0)
        self.assertEqual(constant["ci95"], constant["conservative_ci95"])

    def test_search_policy_replays_with_fixed_clock_in_isolated_workers(self):
        state = copy.deepcopy(self.initial)
        cards = guandan._full_deck()
        for seat, pid in enumerate(state["turn_order"]):
            state["players"][pid]["hand"] = [cards[seat * 3 + offset] for offset in range(3)]
        held = {card["id"] for player in state["players"].values() for card in player["hand"]}
        state.update(current_turn="p0", visible_card_id=None, known_card_owners={},
                     seen_cards=[card["id"] for card in cards if card["id"] not in held])
        guandan._start_round_memory(state)
        view = bench.policy_observation(guandan, state, "p0", 2, "public")
        config = {"bot_think_time_ms": 2000, "bot_minimax_depth": 2, "bot_minimax_width": 2,
                  "bot_minimax_particles": 2}
        actions = []
        for _ in range(2):
            with bench.PolicyWorker(bench.REPO_ROOT, "auto", config, "fixed", 20) as worker:
                result = worker.choose(view, "p0", 88)
                actions.append(result["action"])
                self.assertEqual(result["explain"]["method"], "minimax")
                _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), "p0", result["action"])
                self.assertIsNone(error)
        self.assertEqual(actions[0], actions[1])

    def test_identical_seeded_policies_have_identical_mirrored_trajectories(self):
        actor = self.initial["current_turn"]
        view = bench.policy_observation(guandan, self.initial, actor, 4, "public")
        for _ in range(2):
            with bench.PolicyWorker(bench.REPO_ROOT, "random", {}, "fixed", 10) as first, \
                 bench.PolicyWorker(bench.REPO_ROOT, "random", {}, "fixed", 10) as second:
                a = first.choose(view, actor, 7)
                b = second.choose(view, actor, 7)
                self.assertEqual(a["action"], b["action"])

        class SimpleWorker:
            def choose(self, state, player_id, seed):
                action = bench.simple_action(guandan, state, player_id, "random", random.Random(seed))
                return {"action": action, "elapsed_ms": 0}

        workers = {side: SimpleWorker() for side in ("candidate", "baseline")}
        diagnostics = {side: bench.Diagnostics() for side in workers}
        a = bench.play_round(guandan, self.initial, workers, "A", 456, "public", 600, diagnostics)
        b = bench.play_round(guandan, self.initial, workers, "B", 456, "public", 600, diagnostics)
        self.assertEqual(a["trajectory_sha256"], b["trajectory_sha256"])
        self.assertEqual(a["net_points"], -b["net_points"])
        self.assertEqual(a["win"] + b["win"], 1)

    def test_invalid_actions_and_truncation_fail_instead_of_becoming_losses(self):
        worker = mock.Mock()
        worker.choose.return_value = {"action": {"type": "play", "card_ids": [-1]}, "elapsed_ms": 0}
        workers = {side: worker for side in ("candidate", "baseline")}
        diagnostics = {side: bench.Diagnostics() for side in workers}
        with self.assertRaisesRegex(ValueError, "illegal action"):
            bench.play_round(guandan, self.initial, workers, "A", 4, "public", 600, diagnostics)
        actor = self.initial["current_turn"]
        card = self.initial["players"][actor]["hand"][0]["id"]
        worker.choose.return_value = {"action": {"type": "play", "card_ids": [card]}, "elapsed_ms": 0}
        with self.assertRaisesRegex(RuntimeError, "exceeded"):
            bench.play_round(guandan, self.initial, workers, "A", 4, "public", 1, diagnostics)

    def test_failed_run_writes_failure_report_without_a_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "failed.json"
            args = bench.build_parser().parse_args([
                "run", "--candidate", "greedy", "--baseline", "greedy", "--pairs", "1",
                "--max-actions", "1", "--output", str(output), "--quiet",
            ])
            report = bench.run_benchmark(guandan, args)
            self.assertEqual(report["status"], "failed")
            self.assertNotIn("summary", report)
            self.assertIn("exceeded", report["failure"]["error"])
            self.assertEqual(json.loads(output.read_text())["status"], "failed")


class GitPolicySourceTests(unittest.TestCase):
    """Small synthetic Git fixtures: never copy the real baseline source files."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "game").mkdir()
        (self.root / "game/guandan.py").write_text('''\
from game import guandan_ai as _guandan_ai
from game import memories
DEFAULT_CONFIG = {"bot_think_time_ms": 40}
class GuandanGame:
    @staticmethod
    def bot_move(state, player_id):
        if state.get("request_missing"):
            from game import worktree_only
        return {"type": "pass", "fixture_version": _guandan_ai.VALUE + memories.VALUE}
''')
        (self.root / "game/guandan_ai.py").write_text('VALUE = "old-ai/"\n')
        (self.root / "game/memories.py").write_text('VALUE = "old-memory"\n')
        self.git("init", "-q")
        self.commit()
        self.revision = bench.resolve_revision(self.root, "HEAD")
        self.identity = bench.source_identity(self.root, self.revision)
        (self.root / "game/guandan_ai.py").write_text('VALUE = "new-ai/"\n')
        (self.root / "game/memories.py").write_text('VALUE = "new-memory"\n')
        (self.root / "game/worktree_only.py").write_text('VALUE = "leak"\n')
        self.state = {"config": {}}

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), *args], capture_output=True,
                              text=True, check=True).stdout.strip()

    def commit(self):
        self.git("add", "game")
        self.git("-c", "user.name=Benchmark Test", "-c", "user.email=benchmark@example.invalid",
                 "commit", "--no-gpg-sign", "-qm", "fixture")

    def test_git_blob_workers_ignore_worktree_edits_without_checkout_or_copies(self):
        before = {name: (self.root / name).read_bytes() for name in bench.RUNTIME_FILES}
        status = self.git("status", "--porcelain")
        with bench.PolicyWorker(self.root, "auto", {}, "fixed", 10, self.revision,
                                self.identity) as frozen, \
             bench.PolicyWorker(self.root, "auto", {}, "fixed", 10) as live:
            self.assertEqual(frozen.choose(self.state, "p0", 1)["action"]["fixture_version"],
                             "old-ai/old-memory")
            self.assertEqual(live.choose(self.state, "p0", 1)["action"]["fixture_version"],
                             "new-ai/new-memory")
            self.assertEqual(frozen.identity, self.identity)
            self.assertEqual(live.identity["kind"], "worktree")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.revision)
        self.assertEqual(self.git("status", "--porcelain"), status)
        self.assertEqual({name: (self.root / name).read_bytes() for name in bench.RUNTIME_FILES}, before)
        self.assertFalse(list(self.root.rglob("__pycache__")))

    def test_resolved_commit_stays_pinned_after_branch_moves(self):
        self.commit()
        self.assertNotEqual(bench.resolve_revision(self.root, "HEAD"), self.revision)
        self.assertEqual(bench.source_identity(self.root, self.revision), self.identity)
        with bench.PolicyWorker(self.root, "auto", {}, "fixed", 10, self.revision) as frozen:
            self.assertEqual(frozen.choose(self.state, "p0", 1)["action"]["fixture_version"],
                             "old-ai/old-memory")

    def test_uncaptured_imports_never_fall_back_to_worktree(self):
        for revision in (self.revision, None):
            with self.subTest(revision=revision), \
                 bench.PolicyWorker(self.root, "auto", {}, "fixed", 10, revision) as worker:
                with self.assertRaisesRegex(RuntimeError, "policy dependency not captured: game.worktree_only"):
                    worker.choose({**self.state, "request_missing": True}, "p0", 1)

    def test_worker_rejects_source_change_before_game(self):
        expected = bench.source_identity(self.root)
        (self.root / "game/guandan_ai.py").write_text('VALUE = "changed-again/"\n')
        with self.assertRaisesRegex(RuntimeError, "source changed before loading"):
            bench.PolicyWorker(self.root, "auto", {}, "fixed", 10, expected_identity=expected)

    def test_unresolved_or_invalid_refs_fail_explicitly(self):
        with self.assertRaisesRegex(ValueError, "resolved full commit"):
            bench.source_identity(self.root, "HEAD")
        with self.assertRaises(ValueError):
            bench.resolve_revision(self.root, "missing-branch")


if __name__ == "__main__":
    unittest.main()
