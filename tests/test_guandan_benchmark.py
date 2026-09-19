import copy
import itertools
import json
import random
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

    def test_frozen_worker_is_independent_of_live_policy_and_checks_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "baseline"
            bench.snapshot_policy(bench.REPO_ROOT, root)
            source = root / "game/guandan.py"
            # Install a distinct tiny policy before sealing a test fixture.
            source.write_text(source.read_text() + '\nGuandanGame.bot_move = staticmethod(lambda state, bot_id: {"type": "pass"})\n')
            with self.assertRaisesRegex(ValueError, "checksum"):
                bench.source_identity(root)
            manifest = root / "manifest.json"
            manifest.unlink()
            identity = bench.source_identity(root)
            manifest.write_text(json.dumps(identity))
            with bench.PolicyWorker(root, "heuristic", {}, "fixed", 10) as worker:
                result = worker.choose(self.initial, self.initial["current_turn"], 77)
            self.assertEqual(result["action"], {"type": "pass"})
            self.assertNotEqual(bench.source_identity(bench.REPO_ROOT)["source_sha256"], identity["source_sha256"])

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


if __name__ == "__main__":
    unittest.main()
