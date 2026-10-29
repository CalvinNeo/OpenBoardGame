import concurrent.futures
import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from game import semantic_guess, semantic_vectors


class _Clock:
    """Independent CPU and wall clocks; sleeping never advances CPU time."""

    def __init__(self):
        self.cpu = 0.0
        self.wall = 0.0
        self.sleeps = []

    def cpu_time(self):
        return self.cpu

    def wall_time(self):
        return self.wall

    def work(self, seconds):
        self.cpu += seconds
        self.wall += seconds

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.wall += seconds


class _AdvancingClock(_Clock):
    """Account for a small unit of work at each production checkpoint."""

    def cpu_time(self):
        self.work(0.001)
        return self.cpu


class SemanticStartupBudgetTests(unittest.TestCase):
    def make_budget(self, clock, callback=None, **kwargs):
        return semantic_vectors.StartupWorkBudget(
            callback, cpu_clock=clock.cpu_time, wall_clock=clock.wall_time,
            sleep=clock.sleep, **kwargs)

    def test_cpu_work_is_spread_across_three_times_as_much_wall_time(self):
        clock = _Clock()
        budget = self.make_budget(clock)
        for _ in range(20):
            clock.work(0.006)
            budget.checkpoint()
            self.assertAlmostEqual(clock.wall, clock.cpu * 3, places=8)
        self.assertAlmostEqual(sum(clock.sleeps), 0.24, places=8)

    def test_checkpoints_yield_after_a_small_cpu_slice(self):
        clock = _Clock()
        budget = self.make_budget(clock)
        last_sleep_cpu = clock.cpu
        longest_slice = 0.0
        for _ in range(100):
            before = len(clock.sleeps)
            clock.work(0.001)
            budget.checkpoint()
            if len(clock.sleeps) != before:
                longest_slice = max(longest_slice, clock.cpu - last_sleep_cpu)
                last_sleep_cpu = clock.cpu
        budget.checkpoint(force=True)
        self.assertTrue(clock.sleeps)
        self.assertLessEqual(longest_slice, 0.0061)
        self.assertAlmostEqual(clock.wall, clock.cpu * 3, places=8)

    def test_idle_time_does_not_bank_credit_for_future_cpu_bursts(self):
        clock = _Clock()
        budget = self.make_budget(clock)
        clock.wall += 60.0
        clock.work(0.006)
        budget.checkpoint()
        self.assertEqual(clock.sleeps, [])
        # The long wait can cover the current slice, but never the next one.
        clock.work(0.006)
        budget.checkpoint()
        self.assertAlmostEqual(sum(clock.sleeps), 0.012, places=8)

    def test_wall_time_in_other_threads_does_not_count_as_cpu_work(self):
        clock = _Clock()
        budget = self.make_budget(clock)
        clock.wall += 4.0
        budget.checkpoint(force=True)
        self.assertEqual(clock.sleeps, [])
        clock.work(0.002)
        budget.checkpoint(force=True)
        self.assertAlmostEqual(sum(clock.sleeps), 0.004, places=8)

    def test_long_delay_is_split_into_short_cancelable_sleeps(self):
        clock = _Clock()
        budget = self.make_budget(clock)
        clock.work(0.08)
        budget.checkpoint(force=True)
        self.assertAlmostEqual(sum(clock.sleeps), 0.16, places=8)
        self.assertGreater(len(clock.sleeps), 1)
        self.assertTrue(all(0 < delay <= 0.05 for delay in clock.sleeps))

    def test_progress_is_monotonic_and_callback_errors_stop_work(self):
        clock = _Clock()
        reports = []
        budget = self.make_budget(clock, lambda *args: reports.append(args))
        for stage, progress in [("index", 0.3), ("index", 0.1), ("hints", 0.9), ("ready", 1.0)]:
            budget.checkpoint(stage, progress, force=True)
        values = [report[1] for report in reports]
        self.assertEqual(values, sorted(values))
        self.assertEqual(values[-1], 1.0)

        def cancel(*_args):
            raise ValueError("room changed")

        budget = self.make_budget(clock, cancel)
        with self.assertRaises(semantic_vectors.StartupProgressError) as caught:
            budget.checkpoint("index", 0.1, force=True)
        self.assertIsInstance(caught.exception.__cause__, ValueError)

    def test_nested_work_reuses_budget_and_removes_thread_local_on_failure(self):
        clock = _Clock()
        budget = self.make_budget(clock)
        with self.assertRaisesRegex(ValueError, "abort"):
            with semantic_vectors.startup_work(budget=budget):
                clock.work(0.006)
                with semantic_vectors.startup_work():
                    semantic_vectors.startup_checkpoint(force=True)
                raise ValueError("abort")
        self.assertAlmostEqual(sum(clock.sleeps), 0.012, places=8)
        before = list(clock.sleeps)
        clock.work(0.006)
        semantic_vectors.startup_checkpoint(force=True)
        self.assertEqual(clock.sleeps, before)

    def test_concurrent_threads_each_charge_their_own_cpu_budget(self):
        barrier = threading.Barrier(2)

        def work(seconds):
            clock = _Clock()
            budget = self.make_budget(clock)
            with semantic_vectors.startup_work(budget=budget):
                barrier.wait(timeout=3)
                clock.work(seconds)
                semantic_vectors.startup_checkpoint(force=True)
                barrier.wait(timeout=3)
            return clock

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            first = executor.submit(work, 0.006)
            second = executor.submit(work, 0.012)
            first_clock, second_clock = first.result(timeout=5), second.result(timeout=5)
        self.assertAlmostEqual(sum(first_clock.sleeps), 0.012, places=8)
        self.assertAlmostEqual(sum(second_clock.sleeps), 0.024, places=8)


class SemanticStartupIntegrationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.source = self.directory / "vectors.vec"
        self.index = self.directory / "vectors.sqlite3"
        self.words = [f"privateword{i:04d}" for i in range(360)]
        self.source.write_text(
            f"{len(self.words)} 2\n" + "".join(
                f"{word} {1 + i % 7} {i % 11}\n" for i, word in enumerate(self.words)),
            encoding="utf-8")
        self.store = semantic_vectors.IndexedVectorStore(self.source, self.index)
        for item in [
            patch.object(semantic_guess, "get_store", return_value=self.store),
            patch.object(semantic_guess, "_load_vocabulary", return_value=self.words),
            patch.object(semantic_guess, "_AVAILABLE_WORDS", None),
        ]:
            item.start()
            self.addCleanup(item.stop)

    @staticmethod
    def players():
        return [{"player_id": "p0", "name": "Player", "seat": 0}]

    def initialize(self, hints, callback):
        return semantic_guess.SemanticGuessGame.initialize_game_with_progress(
            {"starting_hints": hints}, self.players(), callback)

    def recorded_start(self, hints):
        clock = _AdvancingClock()
        reports = []
        callback = lambda *args: reports.append(args)
        budget = semantic_vectors.StartupWorkBudget(
            callback, cpu_clock=clock.cpu_time, wall_clock=clock.wall_time, sleep=clock.sleep)
        with semantic_vectors.startup_work(budget=budget):
            state = self.initialize(hints, callback)
        return state, reports, clock

    def assert_safe_progress(self, reports):
        self.assertTrue(reports)
        values = [report[1] for report in reports]
        self.assertEqual(values, sorted(values))
        self.assertTrue(all(0.0 <= value <= 1.0 for value in values))
        self.assertEqual(reports[-1][:2], ("ready", 1.0))
        encoded = json.dumps(reports)
        self.assertNotIn("privateword", encoded)
        self.assertNotIn(str(self.directory), encoded)
        self.assertTrue(all(report[0] in {"queued", "index", "vocabulary", "hints", "ready"}
                            for report in reports))

    def test_cold_index_and_hint_sampling_report_real_bounded_progress(self):
        state, reports, clock = self.recorded_start(True)
        self.assert_safe_progress(reports)
        self.assertTrue(self.index.is_file())
        self.assertEqual(len(state["starting_hints"]), 2)
        self.assertTrue(any(stage == "index" and 0 < value < 0.75 for stage, value, *_ in reports))
        self.assertTrue(any(stage == "vocabulary" for stage, *_ in reports))
        self.assertTrue(any(stage == "hints" and 0.85 < value < 1.0 for stage, value, *_ in reports))
        self.assertTrue(clock.sleeps)

    def test_existing_index_is_reused_and_disabled_hints_do_no_cosine_work(self):
        self.store.ensure_ready()
        self.store.close()
        with patch.object(self.store, "_build_index", side_effect=AssertionError("unexpected rebuild")), \
                patch.object(self.store, "similarity", side_effect=AssertionError("unexpected hint scan")):
            state, reports, _clock = self.recorded_start(False)
        self.assert_safe_progress(reports)
        self.assertEqual(state["starting_hints"], [])
        self.assertTrue(any(stage == "index" for stage, *_ in reports))
        self.assertTrue(any(stage == "vocabulary" for stage, *_ in reports))

    def test_preparation_database_errors_are_reported_as_game_errors(self):
        for operation in ("ensure_ready", "filter_words"):
            with self.subTest(operation=operation):
                with patch.object(self.store, operation, side_effect=sqlite3.OperationalError("disk I/O error")):
                    with self.assertRaisesRegex(ValueError, "语义词库暂不可用") as caught:
                        self.initialize(False, lambda *_args: None)
                self.assertIsInstance(caught.exception.__cause__, sqlite3.OperationalError)

    def test_canceled_cold_index_removes_temporary_database_and_unlocks_retry(self):
        reports = []
        clock = _AdvancingClock()

        def cancel(stage, progress, *_args):
            reports.append((stage, progress))
            if stage == "index" and 0 < progress < 0.75:
                raise ValueError("room removed")

        budget = semantic_vectors.StartupWorkBudget(
            cancel, cpu_clock=clock.cpu_time, wall_clock=clock.wall_time, sleep=clock.sleep)
        with semantic_vectors.startup_work(budget=budget):
            with self.assertRaises(semantic_vectors.StartupProgressError):
                self.initialize(True, cancel)
        self.assertFalse(self.index.exists())
        self.assertEqual(list(self.directory.glob("*.tmp")), [])
        # A fresh thread proves RLocks as well as the file lock were released.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            state = executor.submit(self.initialize, False, lambda *_args: None).result(timeout=5)
        self.assertIn(state["secret_word"], self.words)
        self.assertTrue(self.index.is_file())

    def test_large_malformed_rows_still_yield_and_report_file_progress(self):
        self.source.write_bytes(
            b"2 2\nbad " + b"1 " * (semantic_vectors.MAX_LINE_BYTES * 32)
            + b"\nprivateword0000 1 0\n")
        state, reports, clock = self.recorded_start(False)
        self.assert_safe_progress(reports)
        self.assertEqual(state["secret_word"], "privateword0000")
        self.assertTrue(clock.sleeps)
        self.assertTrue(any(stage == "index" and 0 < value < 0.75 for stage, value, *_ in reports))

    def test_waiting_for_shared_index_lock_keeps_cancelable_progress(self):
        self.store.ensure_ready()
        for name, lock in [("store", self.store._lock), ("builder", semantic_vectors._BUILD_LOCK)]:
            with self.subTest(lock=name):
                self.store.close()
                reports = []

                def cancel_on_heartbeat(*args):
                    reports.append(args)
                    if len(reports) >= 2:
                        raise ValueError("room no longer waiting")

                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                    with lock:
                        waiting = executor.submit(self.initialize, False, cancel_on_heartbeat)
                        with self.assertRaises(semantic_vectors.StartupProgressError):
                            waiting.result(timeout=3)
                    state = executor.submit(self.initialize, False, lambda *_args: None).result(timeout=3)
                self.assertGreaterEqual(len(reports), 2)
                self.assertFalse(any(report[0] == "ready" for report in reports))
                self.assertIn(state["secret_word"], self.words)

    def test_concurrent_rooms_prepare_independently_with_a_warm_index(self):
        self.store.ensure_ready()
        first_inside = threading.Event()
        release_first = threading.Event()
        second_inside = threading.Event()
        calls = []
        reports = {"first": [], "second": []}
        calls_lock = threading.Lock()

        def vocabulary():
            with calls_lock:
                calls.append(threading.get_ident())
                ordinal = len(calls)
            if ordinal == 1:
                first_inside.set()
                if not release_first.wait(5):
                    raise TimeoutError("first startup was not released")
            else:
                second_inside.set()
            return self.words

        def callback(name):
            def report(*args):
                reports[name].append(args)
            return report

        with patch.object(semantic_guess, "_load_vocabulary", side_effect=vocabulary):
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                first = executor.submit(self.initialize, False, callback("first"))
                try:
                    self.assertTrue(first_inside.wait(3))
                    second = executor.submit(self.initialize, False, callback("second"))
                    self.assertTrue(second_inside.wait(3))
                    second.result(timeout=3)
                    self.assertFalse(first.done())
                    release_first.set()
                    first.result(timeout=5)
                finally:
                    release_first.set()
        self.assertEqual(len(calls), 2)
        for name in reports:
            self.assert_safe_progress(reports[name])


if __name__ == "__main__":
    unittest.main()
