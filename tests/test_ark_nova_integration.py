from __future__ import annotations

import re
import unittest
from pathlib import Path

from jsonschema import Draft7Validator

import app
from game import get_game


ROOT = Path(__file__).resolve().parents[1]


class ArkNovaIntegrationTests(unittest.TestCase):
    def test_frontend_assets_are_loaded_before_the_main_dispatcher(self) -> None:
        index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        ark_script = re.search(r'<script src="(/static/games/ark_nova\.js\?v=[^"]+)"', index)
        app_script = re.search(r'<script src="(/static/app\.js\?v=[^"]+)"', index)
        room_script = re.search(r'<script src="(/static/room\.js\?v=[^"]+)"', index)
        ark_style = re.search(r'<link rel="stylesheet" href="(/static/ark_nova\.css\?v=[^"]+)"', index)

        self.assertIsNotNone(ark_script)
        self.assertIsNotNone(app_script)
        self.assertIsNotNone(room_script)
        self.assertIsNotNone(ark_style)
        self.assertLess(index.index(ark_script.group(0)), index.index(app_script.group(0)))
        self.assertLess(index.index(app_script.group(0)), index.index(room_script.group(0)))

    def test_main_frontend_dispatches_and_toggles_ark_nova(self) -> None:
        app_script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn('gameType === "ark_nova"', app_script)
        self.assertIn("renderArkNovaGameState(data)", app_script)
        self.assertIn('arkNovaPanel.classList.toggle("hidden", !showArkNova)', app_script)

    def test_ark_nova_script_exposes_renderer_and_uses_mounted_map_asset(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn('window.renderArkNovaGameState = renderArkNovaGameState', script)
        self.assertIn('window.showArkNovaHeaderActions = showArkNovaHeaderActions', script)
        self.assertIn('"/static/assets/ark_nova/map0.svg?v=map0_v2"', script)
        self.assertIn('data-arkn-command="map-info"', script)
        self.assertIn('id="arkNovaMapXStorage"', script)
        self.assertTrue((ROOT / "static" / "assets" / "ark_nova" / "map0.svg").is_file())

    def test_hand_card_body_never_opens_details(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn('const isHandCard = options.zone === "hand";', script)
        self.assertIn("Use the information button for card details.", script)
        self.assertIn('class="arkn-card-info" data-arkn-card-info=', script)

    def test_discard_choices_are_made_from_the_hand(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn('!== "discard_cards"', script)
        self.assertIn('id="arkNovaHandChoice"', script)
        self.assertIn('data-arkn-pending-card-index=', script)
        self.assertIn("Choose directly from your cards below.", script)

    def test_registry_accepts_actions_emitted_by_the_frontend(self) -> None:
        definition = get_game("ark_nova")
        self.assertIsNotNone(definition)
        validator = Draft7Validator(definition.action_schema)
        examples = [
            {"type": "keep_initial_cards", "card_ids": ["201", "401", "402", "101"]},
            {"type": "cards", "mode": "draw", "x_tokens": 1, "market_card_ids": ["401"]},
            {
                "type": "build",
                "x_tokens": 0,
                "buildings": [{"building_type": "standard_enclosure", "size": 2, "cells": ["A1", "A2"]}],
            },
            {"type": "animals", "plays": [{"card_id": "401", "enclosure_id": "standard_enclosure-1", "source": "hand"}]},
            {"type": "association", "tasks": [{"task": "reputation"}], "donate": False},
            {"type": "sponsors", "mode": "play", "card_ids": ["201"]},
            {"type": "gain_x", "action_card": "build"},
            {"type": "resolve_choice", "choice_id": "choice-1", "selection": {"cells": ["A1"]}},
        ]
        for action in examples:
            with self.subTest(action=action["type"]):
                self.assertEqual(list(validator.iter_errors(action)), [])


class _SocketRecorder:
    def __init__(self) -> None:
        self.emits = []

    async def emit(self, event, payload, to=None) -> None:
        self.emits.append({"event": event, "payload": payload, "to": to})

    async def enter_room(self, _sid, _room_id) -> None:
        return None

    async def leave_room(self, _sid, _room_id) -> None:
        return None


class ArkNovaRoomIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.original_sio = app.sio
        app.sio = _SocketRecorder()
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def asyncTearDown(self) -> None:
        app.sio = self.original_sio
        app.ROOMS.clear()
        app.SESSIONS.clear()

    async def test_start_emits_a_renderable_private_view(self) -> None:
        sid = "ark-nova-browser"
        await app.on_room_create(sid, {"name": "Keeper", "game_type": "ark_nova"})
        room_id = app.SESSIONS[sid]["room_id"]
        await app.on_room_add_bot(sid, {"name": "Bot"})
        await app.on_room_start(sid, {"config": {"map_id": "map0", "seed": 11}})

        room = app.ROOMS[room_id]
        self.assertEqual(room.status, "in_game")
        messages = [
            item for item in app.sio.emits
            if item["event"] == "game:state" and item["to"] == sid
        ]
        self.assertTrue(messages)
        payload = messages[-1]["payload"]
        self.assertEqual(payload["game_type"], "ark_nova")
        self.assertEqual(payload["view"]["game_id"], "ark_nova")
        self.assertEqual(payload["view"]["phase"], "setup")
        self.assertEqual(len(payload["view"]["display"]), 6)
        self.assertEqual(len(payload["view"]["your_hand"]), 8)
        self.assertEqual(payload["view"]["map_definition"]["id"], "map0")


if __name__ == "__main__":
    unittest.main()
