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


class GuandanExactDiagnosticsTests(unittest.TestCase):
    def test_completed_reference_is_applied_but_not_a_changed_move(self):
        diagnostic = bench.Diagnostics()
        reference = {"type": "play", "card_ids": [1, 2]}
        diagnostic.add({"elapsed_ms": 30.0, "action": {"type": "play", "card_ids": [2, 1]},
                        "explain": {"method": "exact_endgame", "method_details": {"exact_endgame": {
                            "status": "complete", "applied": True, "reference": reference,
                            "reason": "no_supported_change", "elapsed_ms": 12.0,
                            "completed_worlds": 8, "reused_worlds": 7, "nodes": 53}}}})
        report = diagnostic.report()["exact_endgame"]
        self.assertEqual(report["attempted"], 1)
        self.assertEqual(report["applied"], 1)
        self.assertEqual(report["actual_changes"], 0)
        self.assertEqual(report["completion_rate"], 1.0)
        self.assertEqual(report["completed_worlds"], 8)
        self.assertEqual(report["reused_worlds"], 7)
        self.assertEqual(report["nodes"], 53)
        self.assertEqual(report["latency_ms"]["mean"], 12.0)

    def test_incomplete_and_skipped_are_not_applied_or_scored_as_changes(self):
        diagnostic = bench.Diagnostics()
        for status, reason in (("complete", "confirmed_change"), ("incomplete", "deadline"),
                               ("skipped", "outside_exact_scope")):
            diagnostic.add({"elapsed_ms": 20.0, "action": {"type": "pass"},
                            "explain": {"method_details": {"exact_endgame": {
                                "status": status, "applied": status == "complete", "reason": reason,
                                "reference": {"type": "play", "card_ids": [1]}, "changed": True}}}})
        report = diagnostic.report()
        exact = report["exact_endgame"]
        self.assertEqual(exact["attempted"], 2)
        self.assertEqual(exact["completion_rate"], 0.5)
        self.assertEqual(exact["applied"], 1)
        self.assertEqual(exact["actual_changes"], 1)
        self.assertEqual(exact["statuses"], {"complete": 1, "incomplete": 1, "skipped": 1})
        self.assertEqual(report["trick_boundary"]["attempted"], 0)
        self.assertIsNone(report["trick_boundary"]["completion_rate"])

    def test_absent_exact_panel_does_not_invent_a_completion_rate(self):
        diagnostic = bench.Diagnostics()
        diagnostic.add({"elapsed_ms": 2.0, "action": {"type": "pass"}, "explain": {}})
        exact = diagnostic.report()["exact_endgame"]
        self.assertEqual(exact["attempted"], 0)
        self.assertIsNone(exact["completion_rate"])
        self.assertIsNone(exact["latency_ms"]["mean"])


if __name__ == "__main__":
    unittest.main()
