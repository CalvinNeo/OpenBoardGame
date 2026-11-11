"""Rules tests for 大家来找茬 (find_diff), the independent-progress time trial.

The generated picture pairs live in .find_diff/ and are not part of the repo, so
these tests install a synthetic level pool instead of depending on real assets.
Design: designs/task194.md.
"""
import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from game import find_diff
from game.find_diff import (
    FindDiffGame,
    MISS_COOLDOWN_MS,
    STAGE_GAME_OVER,
    STAGE_RACING,
    STAGE_RESULTS,
)

SCENE_W, SCENE_H = 240, 180
PATCH_W, PATCH_H = 26, 20


def write_scene(directory: Path, scene_id: str, diffs: int):
    """A clean picture plus an edited one, and the boxes that differ.

    Real files are required: a round picture is composited from them, and the
    whole point of the regression test below is to inspect the result.
    """
    base = Image.new("RGB", (SCENE_W, SCENE_H), (30, 60, 90))
    ImageDraw.Draw(base).rectangle([4, 150, 40, 176], fill=(200, 120, 40))
    edited = base.copy()
    pen = ImageDraw.Draw(edited)
    boxes = []
    for j in range(diffs):
        x0 = 8 + 44 * j
        y0 = 8 + 32 * j
        x1 = x0 + PATCH_W
        y1 = y0 + PATCH_H
        pen.rectangle([x0, y0, x1, y1], fill=(20, 200, 120))
        boxes.append([x0 / SCENE_W, y0 / SCENE_H, (x1 + 1) / SCENE_W, (y1 + 1) / SCENE_H])
    base.save(directory / f"{scene_id}_a.jpg", quality=95, subsampling=0)
    edited.save(directory / f"{scene_id}_b.jpg", quality=95, subsampling=0)
    return boxes


def fake_levels(directory: Path, count=8, diffs=5):
    levels = []
    for i in range(count):
        scene_id = f"scene{i}"
        boxes = write_scene(directory, scene_id, diffs)
        levels.append({
            "id": scene_id,
            "title": f"Scene {i}",
            "a": f"{scene_id}_a.jpg",
            "b": f"{scene_id}_b.jpg",
            "diffs": [
                {"name": f"obj{j}", "kind": "flip", "box": boxes[j]}
                for j in range(diffs)
            ],
        })
    return levels


class FindDiffTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="find_diff_test_"))
        self._saved_dir = find_diff.IMAGE_DIR
        find_diff.IMAGE_DIR = self.tmp
        self._saved_cache = find_diff._LEVEL_CACHE
        find_diff._LEVEL_CACHE = fake_levels(self.tmp)
        self._saved_now = find_diff._now_ms
        self.clock = 5_000_000
        find_diff._now_ms = lambda: self.clock
        self.players = [
            {"player_id": "p1", "name": "Ann", "seat": 0, "is_bot": False},
            {"player_id": "p2", "name": "Bob", "seat": 1, "is_bot": False},
        ]

    def tearDown(self):
        find_diff._LEVEL_CACHE = self._saved_cache
        find_diff._now_ms = self._saved_now
        find_diff.IMAGE_DIR = self._saved_dir
        shutil.rmtree(self.tmp, ignore_errors=True)

    def new_state(self, config=None):
        cfg = {"levels": 3, "diffs": 3, "total_seconds": 600}
        cfg.update(config or {})
        return FindDiffGame.init_game(cfg, self.players)

    def centre(self, box):
        return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)

    def slot_box(self, state, pid, slot_index):
        runner = state["players"][pid]
        level = find_diff._runner_level(state, runner)
        slot = find_diff._slots(state, level["id"])[slot_index]
        return level["diffs"][slot]["box"]

    def hit_slot(self, state, pid, slot_index, expect_error=None):
        runner = state["players"][pid]
        box = self.slot_box(state, pid, slot_index)
        x, y = self.centre(box)
        events, error = FindDiffGame.apply_action(state, pid, {
            "type": "guess", "level": runner["index"] + 1, "x": x, "y": y,
        })
        self.assertEqual(error, expect_error, f"unexpected error for {pid} slot {slot_index}")
        return events

    def clear_level(self, state, pid):
        for slot_index in range(state["config"]["diffs"]):
            self.hit_slot(state, pid, slot_index)

    def finish_player(self, state, pid):
        for _ in range(len(state["run"])):
            self.clear_level(state, pid)
            self.clock += 1000

    # ---- setup ---------------------------------------------------------

    def test_init_requires_generated_levels(self):
        find_diff._LEVEL_CACHE = []
        with self.assertRaises(ValueError):
            FindDiffGame.init_game({}, self.players)

    def test_race_draws_a_random_subset(self):
        state = self.new_state()
        self.assertEqual(len(state["run"]), 3)
        self.assertEqual(len(set(state["run"])), 3)
        self.assertTrue(set(state["run"]).issubset(set(state["level_pool"])))
        for level_id in state["run"]:
            level = state["levels"][level_id]
            slots = state["plan"][level_id]
            self.assertEqual(len(slots), 3)
            self.assertEqual(len(set(slots)), 3)
            self.assertTrue(all(0 <= s < len(level["diffs"]) for s in slots))
        # two games should not be dealt the same hand every time
        runs = {tuple(FindDiffGame.init_game({"levels": 3, "diffs": 3}, self.players)["run"])
                for _ in range(12)}
        self.assertGreater(len(runs), 1)

    def test_level_count_is_capped_by_the_pool(self):
        state = self.new_state({"levels": 12})
        self.assertEqual(len(state["run"]), 8)

    # ---- privacy -------------------------------------------------------

    def test_view_never_leaks_the_plan(self):
        state = self.new_state()
        view = FindDiffGame.get_public_view(state, "p1")
        blob = repr(view)
        level = find_diff._runner_level(state, state["players"]["p1"])
        for slot in state["plan"][level["id"]]:
            self.assertNotIn(repr(level["diffs"][slot]["box"]), blob)
        self.assertNotIn("plan", view)
        self.assertNotIn("diffs", view["you"]["level"])
        self.assertEqual(view["you"]["found"], [])
        self.assertEqual(view["you"]["remaining"], 3)

    def test_other_players_marks_are_not_exposed(self):
        state = self.new_state()
        self.hit_slot(state, "p1", 0)
        view = FindDiffGame.get_public_view(state, "p2")
        blob = repr(view)
        box = self.slot_box(state, "p1", 0)
        self.assertNotIn(repr(box), blob)
        # Bob only learns how far Ann got, as a count
        ann = next(p for p in view["players"] if p["player_id"] == "p1")
        self.assertEqual(ann["found"], 1)
        self.assertEqual(ann["level_found"], 1)
        self.assertNotIn("box", repr(ann))


    # ---- round pictures ------------------------------------------------

    def _round_pair(self, level_id, slots):
        urls = find_diff.build_round_images(
            next(lv for lv in find_diff._LEVEL_CACHE if lv["id"] == level_id), slots)
        rounds = self.tmp / find_diff.ROUNDS_DIRNAME
        a = Image.open(rounds / urls["a_url"].rsplit("/", 1)[1]).convert("RGB")
        b = Image.open(rounds / urls["b_url"].rsplit("/", 1)[1]).convert("RGB")
        return a, b

    def test_round_picture_shows_only_the_selected_differences(self):
        """Regression: the source B carries all five differences.

        Showing it untouched put differences on screen that the round does not
        count, so tapping a real, visible difference was punished.
        """
        level = find_diff._LEVEL_CACHE[0]
        slots = [0, 2, 4]
        a, b = self._round_pair(level["id"], slots)
        self.assertEqual(a.size, b.size)
        unused = [i for i in range(len(level["diffs"])) if i not in slots]
        self.assertTrue(unused, "this test needs some differences left out")

        for index in unused:
            x0, y0, x1, y1 = level["diffs"][index]["box"]
            box = (int(x0 * SCENE_W), int(y0 * SCENE_H),
                   int(x1 * SCENE_W), int(y1 * SCENE_H))
            self.assertEqual(
                a.crop(box).tobytes(), b.crop(box).tobytes(),
                f"unused difference {index} is still visible on the round picture",
            )

        for index in slots:
            x0, y0, x1, y1 = level["diffs"][index]["box"]
            box = (int(x0 * SCENE_W), int(y0 * SCENE_H),
                   int(x1 * SCENE_W), int(y1 * SCENE_H))
            self.assertNotEqual(
                a.crop(box).tobytes(), b.crop(box).tobytes(),
                f"selected difference {index} did not make it into the round picture",
            )

    def test_round_pictures_are_identical_outside_the_selected_boxes(self):
        level = find_diff._LEVEL_CACHE[1]
        slots = [1, 3]
        a, b = self._round_pair(level["id"], slots)
        # Black out the boxes themselves, then the rest of the pair must match.
        mask = Image.new("L", a.size, 0)
        pen = ImageDraw.Draw(mask)
        for index in slots:
            x0, y0, x1, y1 = level["diffs"][index]["box"]
            pen.rectangle([
                int(x0 * SCENE_W) - find_diff.ROUND_PASTE_PAD - 2,
                int(y0 * SCENE_H) - find_diff.ROUND_PASTE_PAD - 2,
                int(x1 * SCENE_W) + find_diff.ROUND_PASTE_PAD + 2,
                int(y1 * SCENE_H) + find_diff.ROUND_PASTE_PAD + 2,
            ], fill=255)
        blank = Image.new("RGB", a.size, (0, 0, 0))
        clean_a = a.copy()
        clean_b = b.copy()
        clean_a.paste(blank, (0, 0), mask)
        clean_b.paste(blank, (0, 0), mask)
        self.assertEqual(clean_a.tobytes(), clean_b.tobytes())

    def test_round_pictures_are_reused_across_races(self):
        level = find_diff._LEVEL_CACHE[0]
        first = find_diff.build_round_images(level, [0, 1, 2])
        stamp = (self.tmp / find_diff.ROUNDS_DIRNAME / first["b_url"].rsplit("/", 1)[1]).stat().st_mtime_ns
        second = find_diff.build_round_images(level, [0, 1, 2])
        self.assertEqual(first, second)
        again = (self.tmp / find_diff.ROUNDS_DIRNAME / second["b_url"].rsplit("/", 1)[1]).stat().st_mtime_ns
        self.assertEqual(stamp, again, "a cached round picture should not be rebuilt")

    def test_view_uses_the_round_pictures_not_the_source_pair(self):
        state = self.new_state()
        view = FindDiffGame.get_public_view(state, "p1")
        urls = view["you"]["level"]
        self.assertIn("/rounds/", urls["a_url"])
        self.assertIn("/rounds/", urls["b_url"])
        self.assertNotEqual(urls["b_url"], "/static/find_diff/" + state["level"]["b"]
                            if "level" in state else "")
        level = find_diff._runner_level(state, state["players"]["p1"])
        self.assertEqual(urls["a_url"], state["images"][level["id"]]["a_url"])
        self.assertEqual(urls["b_url"], state["images"][level["id"]]["b_url"])
        self.assertEqual(len(state["plan"][level["id"]]), 3)

    def test_review_uses_the_round_pictures(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.finish_player(state, "p2")
        view = FindDiffGame.get_public_view(state, "p1")
        for entry in view["review"]:
            self.assertIn("/rounds/", entry["a_url"])
            self.assertIn("/rounds/", entry["b_url"])
            self.assertEqual(len(entry["diffs"]), 3)


    # ---- racing --------------------------------------------------------

    def test_a_hit_only_advances_the_player_who_clicked(self):
        state = self.new_state()
        self.hit_slot(state, "p1", 0)
        self.assertEqual(len(state["players"]["p1"]["found"]), 1)
        self.assertEqual(state["players"]["p2"]["found"], [])
        self.assertEqual(state["players"]["p2"]["index"], 0)
        self.assertEqual(state["stage"], STAGE_RACING)

    def test_clearing_a_level_moves_to_the_next_picture(self):
        state = self.new_state()
        self.clear_level(state, "p1")
        self.assertEqual(state["players"]["p1"]["index"], 1)
        self.assertEqual(state["players"]["p1"]["found"], [])
        self.assertEqual(len(state["players"]["p1"]["splits"]), 1)
        self.assertEqual(state["players"]["p1"]["finished_ms"], None)

    def test_players_run_independently(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.assertIsNotNone(state["players"]["p1"]["finished_ms"])
        self.assertIsNone(state["players"]["p2"]["finished_ms"])
        self.assertEqual(state["stage"], STAGE_RACING)
        self.assertEqual(FindDiffGame.get_legal_actions(state, "p1"), [])
        self.assertEqual(FindDiffGame.get_legal_actions(state, "p2"), ["guess"])

    def test_finishing_records_the_elapsed_time(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        runner = state["players"]["p1"]
        # finish_player advances the clock between levels, not after the last one,
        # so three levels cost two seconds here.
        self.assertEqual(runner["finished_ms"] - state["started_ms"], 2000)
        view = FindDiffGame.get_public_view(state, "p1")
        self.assertTrue(view["you"]["finished"])
        self.assertEqual(view["you"]["elapsed_ms"], 2000)
        self.assertIsNone(view["you"]["level"])

    def test_race_ends_when_everybody_finishes(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.finish_player(state, "p2")
        self.assertEqual(state["stage"], STAGE_RESULTS)
        self.assertIsNone(state["pending_timeout"])
        self.assertEqual(len(state["ranking"]), 2)
        self.assertTrue(all(row["finished"] for row in state["ranking"]))

    def test_clicking_an_already_found_spot_is_free(self):
        state = self.new_state()
        self.hit_slot(state, "p1", 0)
        before = state["players"]["p1"]["misses"]
        self.hit_slot(state, "p1", 0)
        self.assertEqual(state["players"]["p1"]["misses"], before)
        self.assertEqual(len(state["players"]["p1"]["found"]), 1)

    def test_miss_costs_no_points_and_only_locks_you(self):
        state = self.new_state()
        events = self.hit_slot(state, "p1", 0, expect_error=None) if False else None
        _, error = FindDiffGame.apply_action(state, "p1", {
            "type": "guess", "level": 1, "x": 0.985, "y": 0.985,
        })
        self.assertIsNone(error)
        runner = state["players"]["p1"]
        self.assertEqual(runner["misses"], 1)
        self.assertEqual(runner["found"], [])
        self.assertEqual(runner["cooldown_until"], self.clock + MISS_COOLDOWN_MS)
        self.assertEqual(FindDiffGame.get_legal_actions(state, "p1"), [])
        _, error = FindDiffGame.apply_action(state, "p1", {
            "type": "guess", "level": 1, "x": 0.5, "y": 0.5,
        })
        self.assertEqual(error, "locked out after a miss")
        self.clock += MISS_COOLDOWN_MS + 1
        self.assertEqual(FindDiffGame.get_legal_actions(state, "p1"), ["guess"])

    def test_stale_level_is_rejected(self):
        state = self.new_state()
        self.clear_level(state, "p1")
        _, error = FindDiffGame.apply_action(state, "p1", {
            "type": "guess", "level": 1, "x": 0.5, "y": 0.5,
        })
        self.assertEqual(error, "stale level")

    def test_guess_after_the_deadline_closes_the_race(self):
        state = self.new_state()
        self.clock += 601_000
        _, error = FindDiffGame.apply_action(state, "p1", {
            "type": "guess", "level": 1, "x": 0.5, "y": 0.5,
        })
        self.assertIsNone(error)
        self.assertEqual(state["stage"], STAGE_RESULTS)

    def test_timeout_ranks_unfinished_players_by_progress(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.hit_slot(state, "p2", 0)
        self.clock += 601_000
        events = FindDiffGame.resolve_timeout(state, self.clock)
        self.assertTrue(events)
        self.assertEqual(state["stage"], STAGE_RESULTS)
        ranking = state["ranking"]
        self.assertEqual(ranking[0]["player_id"], "p1")
        self.assertTrue(ranking[0]["finished"])
        self.assertEqual(ranking[0]["place"], 1)
        self.assertFalse(ranking[1]["finished"])
        self.assertEqual(ranking[1]["found"], 1)
        self.assertEqual(ranking[1]["place"], 2)

    def test_unfinished_players_are_ordered_by_how_much_they_found(self):
        state = self.new_state()
        self.clear_level(state, "p1")
        self.hit_slot(state, "p2", 0)
        self.clock += 601_000
        FindDiffGame.resolve_timeout(state, self.clock)
        ranking = state["ranking"]
        self.assertEqual(ranking[0]["player_id"], "p1")
        self.assertEqual(ranking[0]["found"], 3)
        self.assertEqual(ranking[1]["found"], 1)

    def test_players_with_the_same_time_share_a_place(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        # rewind Bob's clock effect by finishing him at the same total offset
        state["players"]["p2"]["finished_ms"] = state["players"]["p1"]["finished_ms"]
        state["players"]["p2"]["index"] = len(state["run"])
        state["players"]["p2"]["splits"] = list(state["players"]["p1"]["splits"])
        rows = find_diff._rank_rows(state)
        self.assertEqual(rows[0]["place"], rows[1]["place"])
        self.assertEqual({rows[0]["player_id"], rows[1]["player_id"]}, {"p1", "p2"})

    # ---- wrap up -------------------------------------------------------

    def test_everyone_must_continue_before_game_over(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.finish_player(state, "p2")
        FindDiffGame.apply_action(state, "p1", {"type": "continue"})
        self.assertEqual(state["stage"], STAGE_RESULTS)
        FindDiffGame.apply_action(state, "p2", {"type": "continue"})
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winners"], ["p1"])
        view = FindDiffGame.get_public_view(state, "p1")
        self.assertEqual(view["legal_actions"], ["play_again"])
        self.assertEqual(len(view["review"]), 3)
        self.assertEqual(len(view["review"][0]["diffs"]), 3)

    def test_play_again_deals_a_fresh_race(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.finish_player(state, "p2")
        for pid in ("p1", "p2"):
            FindDiffGame.apply_action(state, pid, {"type": "continue"})
        old_run = list(state["run"])
        for pid in ("p1", "p2"):
            FindDiffGame.apply_action(state, pid, {"type": "play_again"})
        self.assertEqual(state["stage"], STAGE_RACING)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["players"]["p1"]["index"], 0)
        self.assertIsNone(state["players"]["p1"]["finished_ms"])
        self.assertEqual(len(state["run"]), len(old_run))
        self.assertIsNotNone(state["pending_timeout"])

    def test_serialize_roundtrip(self):
        state = self.new_state()
        self.hit_slot(state, "p1", 0)
        restored = FindDiffGame.deserialize(FindDiffGame.serialize(state))
        self.assertEqual(restored["run"], state["run"])
        self.assertEqual(restored["plan"], state["plan"])
        self.assertEqual(restored["players"]["p1"]["found"], state["players"]["p1"]["found"])
        with self.assertRaises(ValueError):
            FindDiffGame.deserialize({"game_id": "other"})

    def test_bot_targets_an_open_difference_on_its_own_level(self):
        state = self.new_state()
        move = FindDiffGame.bot_move(state, "p1")
        self.assertEqual(move["type"], "guess")
        self.assertEqual(move["level"], 1)
        box = self.slot_box(state, "p1", 0)
        hit = any(
            box[0] <= move["x"] <= box[2] and box[1] <= move["y"] <= box[3]
            for box in [self.slot_box(state, "p1", i) for i in range(3)]
        )
        self.assertTrue(hit or 0 <= move["x"] <= 1)

    def test_bot_continues_at_the_results_stage(self):
        state = self.new_state()
        self.finish_player(state, "p1")
        self.finish_player(state, "p2")
        self.assertEqual(FindDiffGame.bot_move(state, "p2"), {"type": "continue"})

    def test_unknown_player_and_bad_schema_are_rejected(self):
        state = self.new_state()
        _, error = FindDiffGame.apply_action(state, "ghost", {
            "type": "guess", "level": 1, "x": 0.5, "y": 0.5,
        })
        self.assertEqual(error, "player not found")
        self.assertEqual(FindDiffGame.get_legal_actions(state, "ghost"), [])
        _, error = FindDiffGame.apply_action(state, "p1", {"type": "guess", "level": 1})
        self.assertEqual(error, "invalid action schema")


if __name__ == "__main__":
    unittest.main()
