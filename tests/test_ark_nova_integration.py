from __future__ import annotations

import hashlib
import json
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

    def test_hand_hover_and_selected_states_are_visually_distinct(self) -> None:
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("#arkNovaHand .arkn-card.is-selectable:not(.is-selected):hover", stylesheet)
        self.assertIn("#arkNovaHand .arkn-card-main:hover:not(:disabled)", stylesheet)
        self.assertIn("#arkNovaHand .arkn-card.is-selected", stylesheet)
        self.assertIn("background: linear-gradient(160deg, #fff0ce, #e9b56f);", stylesheet)

    def test_hand_occupies_a_full_row_above_the_event_log(self) -> None:
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn('grid-template-areas:\n    "cards"\n    "log";', stylesheet)
        self.assertIn(".arkn-cards-surface { grid-area: cards; }", stylesheet)
        self.assertIn(".arkn-log-surface { grid-area: log; }", stylesheet)

    def test_discard_choices_are_made_from_the_hand(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn('!== "discard_cards"', script)
        self.assertIn('id="arkNovaHandChoice"', script)
        self.assertIn('data-arkn-pending-card-index=', script)
        self.assertIn("Choose directly from your cards below.", script)

    def test_conservation_project_cards_show_all_support_tiers(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaProjectSupportMarkup", script)
        self.assertIn('class="arkn-project-slot is-${state}"', script)
        self.assertIn("arkNovaProjectRewardMarkup(slot.reward)", script)
        self.assertIn("arkNovaProjectSlotOptionLabel(selectedProject, slot)", script)
        self.assertIn(".arkn-project-support", stylesheet)
        self.assertIn(".arkn-project-slot.is-eligible", stylesheet)

    def test_players_can_inspect_every_public_zoo(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaViewedPlayer", script)
        self.assertIn('data-arkn-view-zoo="${arkNovaEscape(id)}"', script)
        self.assertIn('id="arkNovaViewedZooCards"', script)
        self.assertIn("arkNovaBuildings(viewedPlayer)", script)
        self.assertIn("viewedPlayer.played_animals", script)
        self.assertIn("viewedPlayer.played_sponsors", script)
        self.assertIn(".arkn-player.is-viewed", stylesheet)

    def test_card_placeholders_render_as_emoji_tokens(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn('Money: ["💰", "Money"]', script)
        self.assertIn('Appeal: ["🎟", "Appeal"]', script)
        self.assertIn('ConservationPoint: ["🌿", "Conservation point"]', script)
        self.assertIn("function arkNovaRichText", script)
        self.assertIn("arkNovaRichText(arkNovaCardSummary(card))", script)
        self.assertIn(".arkn-inline-token", stylesheet)

    def test_building_picker_uses_fixed_polyhex_pieces(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        for size in range(1, 6):
            self.assertIn(f"standard_enclosure_{size}:", script)
        self.assertIn("function arkNovaFootprintAt", script)
        self.assertIn("function arkNovaPlacementAtAnchor", script)
        self.assertIn("arkNovaUi.buildCells = placement.cells", script)
        self.assertIn("Choose one anchor hex on Map 0", script)

    def test_mobile_map_has_contextual_rotate_control(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn('id="arkNovaMapRotateButton"', script)
        self.assertIn('class="arkn-composer-rotate"', script)
        self.assertIn("function arkNovaUpdateMapRotateButton", script)
        self.assertIn('button.classList.toggle("is-visible", canRotate)', script)
        self.assertIn("button.arkn-map-rotate-fab.is-visible", stylesheet)
        self.assertIn("button.arkn-composer-rotate", stylesheet)

    def test_card_illustrations_are_wired_to_every_card_type(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        art_dir = ROOT / "static" / "assets" / "ark_nova" / "card_art"
        expected = {
            "predator", "herbivore", "primate", "bird", "reptile", "bear", "petting",
            "science", "habitat", "partnership", "education", "conservation", "scoring",
        }
        for name in expected:
            path = art_dir / f"{name}.webp"
            self.assertTrue(path.is_file(), path)
            self.assertGreater(path.stat().st_size, 10_000, path)
            self.assertIn(f"/{name}.webp", script)
        self.assertIn('type === "conservation_project"', script)
        self.assertIn('type === "final_scoring"', script)
        self.assertIn("aspect-ratio: 16 / 9", stylesheet)
        self.assertIn('detail ? "arkn-detail-art" : "arkn-card-art"', script)

    def test_every_ark_nova_card_has_a_unique_illustration(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        card_data = json.loads(
            (ROOT / "game" / "assets" / "ark_nova" / "cards.json").read_text(encoding="utf-8")
        )
        cards = [
            *card_data["animal_cards"],
            *card_data["sponsor_cards"],
            *card_data["conservation_projects"],
            *card_data["final_scoring_cards"],
        ]
        expected_ids = {str(card["id"]) for card in cards}
        art_dir = ROOT / "static" / "assets" / "ark_nova" / "card_art" / "cards"
        actual_ids = {path.stem for path in art_dir.glob("*.webp")}

        self.assertEqual(len(cards), 235)
        self.assertEqual(actual_ids, expected_ids)
        content_hashes = set()
        for card_id in expected_ids:
            path = art_dir / f"{card_id}.webp"
            self.assertGreater(path.stat().st_size, 5_000, path)
            content_hashes.add(hashlib.sha256(path.read_bytes()).digest())
        self.assertEqual(len(content_hashes), len(cards))
        self.assertIn(
            "`${ARK_NOVA_CARD_ART_BASE}/cards/${encodeURIComponent(id)}.webp`",
            script,
        )
        self.assertIn('document.addEventListener("error", arkNovaHandleCardArtError, true)', script)

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
