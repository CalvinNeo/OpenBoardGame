import unittest

from scripts import benchmark_guandan as bench


class GuandanBenchmarkDiagnosticsTests(unittest.TestCase):
    def test_empty_diagnostics_have_no_invented_rates(self):
        report = bench.Diagnostics().report()
        self.assertEqual(report["decisions"], 0)
        self.assertIsNone(report["over_budget_rate"])
        self.assertIsNone(report["trick_boundary"]["completion_rate"])
        self.assertEqual(report["trick_boundary"]["applied"], 0)
        self.assertTrue(all(value is None for value in report["latency_ms"].values()))

    def test_latency_and_budget_metrics_use_observed_wall_time(self):
        diagnostics = bench.Diagnostics()
        for elapsed in range(1, 101):
            diagnostics.add({"elapsed_ms": elapsed, "action": {"type": "pass"},
                             "explain": {"timing": {"budget_ms": 90}}})
        report = diagnostics.report()
        self.assertEqual(report["latency_ms"], {"mean": 50.5, "p50": 50, "p95": 95, "p99": 99, "max": 100})
        self.assertEqual(report["budgeted_decisions"], 100)
        self.assertEqual(report["over_budget"], 10)
        self.assertEqual(report["over_budget_rate"], 0.1)

    def test_shadow_proposals_and_applied_changes_are_separate(self):
        diagnostics = bench.Diagnostics()
        reference = {"type": "play", "card_ids": [2, 1]}
        proposal = {"type": "play", "card_ids": [3, 4]}
        cases = [
            ({"status": "disabled"}, reference),
            ({"status": "incomplete", "reason": "deadline", "elapsed_ms": 250,
              "applied": True, "reference": reference, "proposed": proposal}, proposal),
            ({"status": "complete", "applied": False, "elapsed_ms": 100,
              "reference": reference, "proposed": proposal}, reference),
            ({"status": "complete", "applied": True, "elapsed_ms": 120,
              "reference": reference, "proposed": {"type": "play", "card_ids": [1, 2]}},
             {"type": "play", "card_ids": [1, 2]}),
            ({"status": "complete", "applied": True, "elapsed_ms": 150,
              "reference": reference, "proposed": proposal}, proposal),
        ]
        for panel, action in cases:
            diagnostics.add({"elapsed_ms": 600, "action": action,
                             "explain": {"method_details": {"trick_boundary": panel}}})
        report = diagnostics.report()["trick_boundary"]
        self.assertEqual(report["attempted"], 4)
        self.assertEqual(report["completion_rate"], 0.75)
        self.assertEqual(report["applied"], 2)
        self.assertEqual(report["proposed_changes"], 2)
        self.assertEqual(report["actual_changes"], 1)
        self.assertEqual(report["reasons"], {"deadline": 1})
        self.assertEqual(report["latency_ms"]["max"], 250)

    def test_legacy_explanations_need_no_new_fields(self):
        diagnostics = bench.Diagnostics()
        diagnostics.add({"elapsed_ms": 20, "action": {"type": "pass"}, "explain": {"method": "heuristic"}})
        report = diagnostics.report()
        self.assertEqual(report["methods"], {"heuristic": 1})
        self.assertEqual(report["actions"], {"pass": 1})
        self.assertEqual(report["trick_boundary"]["attempted"], 0)
        self.assertIsNone(report["over_budget_rate"])


if __name__ == "__main__":
    unittest.main()
