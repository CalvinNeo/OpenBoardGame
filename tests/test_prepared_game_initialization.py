import asyncio
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app
from tests.test_room_session import DummySio


class PreparedGameInitializationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.rooms_patch = patch.dict(app.ROOMS, {}, clear=True)
        self.rooms_patch.start()
        self.addCleanup(self.rooms_patch.stop)

    @staticmethod
    def make_room():
        room = app.Room(
            "preparing-room", game_type="semantic_guess", state_version=7,
            game_state={"generation": "original"},
            players=[app.Player("p0", "Alice", 0, "sid0", ready=True)],
        )
        app.ROOMS[room.room_id] = room
        return room

    @staticmethod
    def definition(prepare, initialize):
        return SimpleNamespace(module=SimpleNamespace(prepare_game=prepare, init_game=initialize))

    @staticmethod
    async def initialize_and_publish(room, definition):
        # Match the room-start handler's assignment: failed stale checks must
        # leave the currently published game untouched.
        room.game_state = await app._initialize_prepared_game(
            room, definition, {"starting_hints": True}, [{"player_id": "p0", "seat": 0}])
        return room.game_state

    @staticmethod
    def blocking_worker(result):
        loop = asyncio.get_running_loop()
        entered = asyncio.Event()
        release = threading.Event()

        def worker(*_args):
            loop.call_soon_threadsafe(entered.set)
            if not release.wait(timeout=5):
                raise TimeoutError("test did not release initialization worker")
            return result

        return worker, entered, release

    @staticmethod
    async def finish_task(task, release):
        release.set()
        await asyncio.wait_for(asyncio.gather(task, return_exceptions=True), timeout=5)

    async def test_prepare_and_initialize_run_off_event_loop_and_clear_flag(self):
        room = self.make_room()
        event_loop_thread = threading.get_ident()
        calls = []
        result = {"generation": "new", "starting_hints": []}

        def prepare(config):
            calls.append(("prepare", threading.get_ident(), room.game_initializing))
            self.assertTrue(config["starting_hints"])

        def initialize(config, players):
            calls.append(("initialize", threading.get_ident(), room.game_initializing))
            self.assertEqual(players[0]["player_id"], "p0")
            return result

        actual = await self.initialize_and_publish(room, self.definition(prepare, initialize))
        self.assertIs(actual, result)
        self.assertIs(room.game_state, result)
        self.assertEqual([call[0] for call in calls], ["prepare", "initialize"])
        self.assertTrue(all(call[1] != event_loop_thread for call in calls))
        self.assertTrue(all(call[2] for call in calls))
        self.assertFalse(room.game_initializing)

    async def test_changes_during_initialization_reject_stale_state(self):
        def replace_room(room):
            app.ROOMS[room.room_id] = app.Room(room.room_id, game_state={"generation": "replacement"})

        changes = {
            "room": replace_room,
            "roster": lambda room: room.players.append(app.Player("p1", "Bob", 1, "sid1")),
            "seat": lambda room: setattr(room.players[0], "seat", 2),
            "ready": lambda room: setattr(room.players[0], "ready", False),
            "connected": lambda room: setattr(room.players[0], "connected", False),
            "version": lambda room: setattr(room, "state_version", room.state_version + 1),
            "status": lambda room: setattr(room, "status", "game_over"),
            "state": lambda room: setattr(room, "game_state", {"generation": "changed"}),
        }
        for name, mutate in changes.items():
            with self.subTest(change=name):
                room = self.make_room()
                worker, entered, release = self.blocking_worker({"generation": "stale"})
                definition = self.definition(lambda config: None, worker)
                task = asyncio.create_task(self.initialize_and_publish(room, definition))
                try:
                    await asyncio.wait_for(entered.wait(), timeout=3)
                    self.assertTrue(room.game_initializing)
                    mutate(room)
                    expected_state = room.game_state
                    registered_room = app.ROOMS[room.room_id]
                    registered_state = registered_room.game_state
                    release.set()
                    with self.assertRaisesRegex(ValueError, "Room changed"):
                        await asyncio.wait_for(task, timeout=3)
                    self.assertIs(room.game_state, expected_state)
                    self.assertIs(app.ROOMS[room.room_id], registered_room)
                    self.assertIs(registered_room.game_state, registered_state)
                    self.assertFalse(room.game_initializing)
                finally:
                    await self.finish_task(task, release)

    async def test_change_during_preparation_prevents_initialization(self):
        room = self.make_room()
        original = room.game_state
        prepare, entered, release = self.blocking_worker(None)
        initialized = []

        def initialize(config, players):
            initialized.append(True)
            return {"generation": "stale"}

        task = asyncio.create_task(self.initialize_and_publish(room, self.definition(prepare, initialize)))
        try:
            await asyncio.wait_for(entered.wait(), timeout=3)
            room.state_version += 1
            release.set()
            with self.assertRaisesRegex(ValueError, "Room changed"):
                await asyncio.wait_for(task, timeout=3)
            self.assertEqual(initialized, [])
            self.assertIs(room.game_state, original)
            self.assertFalse(room.game_initializing)
        finally:
            await self.finish_task(task, release)

    async def test_duplicate_start_is_rejected_without_unlocking_first_start(self):
        room = self.make_room()
        result = {"generation": "new"}
        initialize, entered, release = self.blocking_worker(result)
        prepare_calls = []
        definition = self.definition(lambda config: prepare_calls.append(config), initialize)
        task = asyncio.create_task(self.initialize_and_publish(room, definition))
        try:
            await asyncio.wait_for(entered.wait(), timeout=3)
            with self.assertRaisesRegex(ValueError, "being prepared"):
                await self.initialize_and_publish(room, definition)
            self.assertEqual(len(prepare_calls), 1)
            self.assertTrue(room.game_initializing)
            release.set()
            self.assertIs(await asyncio.wait_for(task, timeout=3), result)
            self.assertFalse(room.game_initializing)
        finally:
            await self.finish_task(task, release)

    async def test_failure_clears_flag_and_preserves_current_state(self):
        for stage in ("prepare", "initialize"):
            with self.subTest(stage=stage):
                room = self.make_room()
                original = room.game_state

                def fail(*_args):
                    raise OSError("vectors unavailable")

                definition = self.definition(
                    fail if stage == "prepare" else lambda config: None,
                    fail if stage == "initialize" else lambda config, players: {},
                )
                with self.assertRaisesRegex(OSError, "vectors unavailable"):
                    await self.initialize_and_publish(room, definition)
                self.assertIs(room.game_state, original)
                self.assertFalse(room.game_initializing)


class StartupProgressTransportTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.sio = DummySio()
        for item in (patch.dict(app.ROOMS, {}, clear=True), patch.object(app, "sio", self.sio)):
            item.start()
            self.addCleanup(item.stop)
        self.progress_seen = asyncio.Event()
        emit = self.sio.emit

        async def observe(event, payload, to=None):
            await emit(event, payload, to=to)
            if event == "game:initialization" and (payload.get("initialization") or {}).get("progress") == 0.37:
                self.progress_seen.set()

        self.sio.emit = observe
        self.release = threading.Event()
        self.exited = threading.Event()
        self.result = {"secret_word": "private-answer", "generation": "new"}

    def definition(self, fail=False):
        def initialize(config, players, progress_callback):
            try:
                progress_callback("index", 0.37)
                while not self.release.wait(0.01):
                    progress_callback("index", 0.37)
                if fail:
                    raise ValueError("vectors unavailable")
                progress_callback("ready", 1.0)
                return self.result
            finally:
                self.exited.set()

        return SimpleNamespace(module=SimpleNamespace(initialize_game_with_progress=initialize))

    def start(self, room, fail=False):
        return asyncio.create_task(PreparedGameInitializationTests.initialize_and_publish(
            room, self.definition(fail)))

    async def cleanup(self, task):
        self.release.set()
        await asyncio.wait_for(asyncio.gather(task, return_exceptions=True), timeout=3)

    async def test_progress_is_public_bounded_and_reconnectable(self):
        room = PreparedGameInitializationTests.make_room()
        task = self.start(room)
        try:
            await asyncio.wait_for(self.progress_seen.wait(), timeout=3)
            self.assertFalse(task.done())
            self.assertTrue(room.game_initializing)
            self.assertEqual(set(room.initialization), {"id", "stage", "progress"})
            # Connected state can change during a long start; membership stays.
            room.players[0].connected = False
            await app._emit_room_state(room)
            snapshot = self.sio.emits[-1]["payload"]
            self.assertEqual(snapshot["initialization"], room.initialization)
            room.players[0].connected = True
            await app._emit_room_state(room)
            self.release.set()
            self.assertIs(await asyncio.wait_for(task, timeout=3), self.result)
            self.assertIsNone(room.initialization)
            self.assertFalse(room.game_initializing)
            emitted = [row for row in self.sio.emits if row["event"] == "game:initialization"]
            self.assertTrue(all(row["to"] == room.room_id for row in emitted))
            self.assertNotIn("private-answer", str(emitted))
            self.assertIsNone(emitted[-1]["payload"]["initialization"])
            scores = [row["payload"]["initialization"]["progress"] for row in emitted[:-1]]
            self.assertEqual(scores, sorted(scores))
            self.assertEqual(scores[-1], 1.0)
        finally:
            await self.cleanup(task)

    async def test_stale_room_stops_worker_and_clears_progress(self):
        room = PreparedGameInitializationTests.make_room()
        original = room.game_state
        task = self.start(room)
        try:
            await asyncio.wait_for(self.progress_seen.wait(), timeout=3)
            room.state_version += 1
            with self.assertRaisesRegex(ValueError, "Room changed"):
                await asyncio.wait_for(task, timeout=3)
            self.assertTrue(self.exited.is_set())
            self.assertIs(room.game_state, original)
            self.assertFalse(room.game_initializing)
            self.assertIsNone(room.initialization)
            self.assertIsNone(self.sio.emits[-1]["payload"]["initialization"])
        finally:
            await self.cleanup(task)

    async def test_task_cancellation_waits_for_worker_cleanup(self):
        room = PreparedGameInitializationTests.make_room()
        task = self.start(room)
        try:
            await asyncio.wait_for(self.progress_seen.wait(), timeout=3)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await asyncio.wait_for(task, timeout=3)
            self.assertTrue(self.exited.is_set())
            self.assertFalse(room.game_initializing)
            self.assertIsNone(room.initialization)
        finally:
            await self.cleanup(task)

    async def test_failure_clears_progress_and_duplicate_start_does_not_replace_it(self):
        room = PreparedGameInitializationTests.make_room()
        task = self.start(room, fail=True)
        try:
            await asyncio.wait_for(self.progress_seen.wait(), timeout=3)
            progress_id = room.initialization["id"]
            with self.assertRaisesRegex(ValueError, "being prepared"):
                await PreparedGameInitializationTests.initialize_and_publish(room, self.definition())
            self.assertEqual(room.initialization["id"], progress_id)
            self.release.set()
            with self.assertRaisesRegex(ValueError, "vectors unavailable"):
                await asyncio.wait_for(task, timeout=3)
            self.assertFalse(room.game_initializing)
            self.assertIsNone(room.initialization)
        finally:
            await self.cleanup(task)

    async def test_room_change_while_emitting_final_progress_rejects_stale_state(self):
        room = PreparedGameInitializationTests.make_room()
        changed_state = {"generation": "changed-during-final-progress"}
        emit = self.sio.emit

        async def change_on_completion(event, payload, to=None):
            await emit(event, payload, to=to)
            if event == "game:initialization" and payload.get("initialization") is None:
                room.game_state = changed_state
                room.state_version += 1

        self.sio.emit = change_on_completion
        self.release.set()
        task = self.start(room)
        try:
            with self.assertRaisesRegex(ValueError, "Room changed"):
                await asyncio.wait_for(task, timeout=3)
            self.assertIs(room.game_state, changed_state)
            self.assertIsNone(room.initialization)
            self.assertFalse(room.game_initializing)
            self.assertTrue(self.exited.is_set())
        finally:
            await self.cleanup(task)

    async def test_other_rooms_can_initialize_while_this_room_is_busy(self):
        first = PreparedGameInitializationTests.make_room()
        second = app.Room("independent-room", game_type="semantic_guess",
                          players=[app.Player("p0", "Bob", 0, "sid1", ready=True)])
        app.ROOMS[second.room_id] = second
        first_task = self.start(first)
        second_task = None
        try:
            await asyncio.wait_for(self.progress_seen.wait(), timeout=3)
            self.progress_seen.clear()
            second_task = self.start(second)
            await asyncio.wait_for(self.progress_seen.wait(), timeout=3)
            self.assertFalse(first_task.done())
            self.assertFalse(second_task.done())
            self.assertEqual(second.initialization["progress"], 0.37)
            self.assertNotEqual(first.initialization["id"], second.initialization["id"])
            self.release.set()
            await asyncio.wait_for(asyncio.gather(first_task, second_task), timeout=3)
        finally:
            await self.cleanup(first_task)
            if second_task:
                await self.cleanup(second_task)


if __name__ == "__main__":
    unittest.main()
