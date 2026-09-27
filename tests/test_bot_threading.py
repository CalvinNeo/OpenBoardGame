import asyncio
import contextvars
import threading
import unittest
from unittest.mock import patch

from app import _run_bot_search


class BotThreadingTests(unittest.IsolatedAsyncioTestCase):
    async def test_python38_fallback_uses_worker_and_copies_context(self):
        marker = contextvars.ContextVar("bot_test_marker", default="missing")
        marker.set("room context")
        caller = threading.get_ident()
        def search(value, *, scale):
            return value * scale, marker.get(), threading.get_ident()
        with patch.object(asyncio, "to_thread", None, create=True):
            value, context, worker = await _run_bot_search(search, 3, scale=2)
        self.assertEqual((value, context), (6, "room context"))
        self.assertNotEqual(worker, caller)

    async def test_search_exceptions_reach_scheduler(self):
        def fail():
            raise ValueError("search failed")
        with patch.object(asyncio, "to_thread", None, create=True):
            with self.assertRaisesRegex(ValueError, "search failed"):
                await _run_bot_search(fail)


if __name__ == "__main__":
    unittest.main()
