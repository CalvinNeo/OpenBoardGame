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

    def test_card_requirements_and_rewards_have_separate_regions(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaCardRequirementsMarkup", script)
        self.assertIn("function arkNovaCardFactsMarkup", script)
        self.assertIn('class="arkn-card-fact-group is-requirement"', script)
        self.assertIn('class="arkn-card-fact-group is-reward"', script)
        self.assertIn("play.strength_required", script)
        self.assertIn(".arkn-card-fact-group.is-requirement", stylesheet)
        self.assertIn(".arkn-card-fact-group.is-reward", stylesheet)

    def test_animal_cards_show_special_enclosure_alternatives(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn('reptile_house: { name: "Reptile House"', script)
        self.assertIn('large_bird_aviary: { name: "Large Bird Aviary"', script)
        self.assertIn("arkNovaAsArray(normalized.enclosure_options)", script)
        self.assertIn('class="arkn-card-enclosure-options"', script)
        self.assertIn('className: `is-enclosure ${type === "standard" ? "is-standard" : "is-special"}`', script)

    def test_continents_use_original_color_text_chips(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaContinentChipMarkup", script)
        self.assertIn('australia: { name: "Australia", className: "is-australia" }', script)
        self.assertIn(".arkn-continent-chip.is-australia", stylesheet)
        self.assertIn("background: #c95151", stylesheet)
        self.assertNotIn('australia: ["🦘", "Australia"]', script)
        self.assertNotIn('europe: ["🏰", "Europe"]', script)

    def test_university_picker_shows_rewards_and_availability(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaUniversityPickerMarkup", script)
        self.assertIn('name="arkNovaUniversity"', script)
        self.assertIn("option.available === false", script)
        self.assertIn("arkNovaUniversityRewardsMarkup", script)
        self.assertIn(".arkn-university-option.is-selected", stylesheet)
        self.assertIn(".arkn-university-option.is-unavailable", stylesheet)

    def test_card_layout_is_wide_and_marks_level_two_cards(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaCardKindLabel", script)
        self.assertIn('level >= 2 ? " (II)" : ""', script)
        self.assertIn("arkNovaCardKindLabel(card)", script)
        self.assertIn("flex: 0 0 176px", stylesheet)
        self.assertIn("flex-basis: min(72vw, 156px)", stylesheet)

    def test_building_picker_uses_fixed_polyhex_pieces(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        for size in range(1, 6):
            self.assertIn(f"standard_enclosure_{size}:", script)
        self.assertIn("function arkNovaFootprintAt", script)
        self.assertIn("function arkNovaPlacementAtAnchor", script)
        self.assertIn("arkNovaSetBuildPreview(cellId, placement ? placement.rotation", script)
        self.assertIn("Choose one anchor hex on Map 0", script)
        self.assertIn("petting_zoo: [[0, 0], [0, -1], [1, -2]]", script)
        self.assertIn("reptile_house: [[0, 0], [0, -1], [1, -1], [2, -2], [2, -1]]", script)
        self.assertIn("large_bird_aviary: [[0, 0], [0, -1], [1, -2], [1, -1], [2, -1]]", script)

    def test_map_and_building_list_select_and_highlight_buildings(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn('cell.addEventListener("click", () => arkNovaHandleMapCell', script)
        self.assertIn('data-arkn-building-id="${arkNovaEscape(id)}"', script)
        self.assertIn("function arkNovaSelectBuilding", script)
        self.assertIn('cell.classList.add("is-building-highlight")', script)
        self.assertIn("function arkNovaRenderMapBuildingLabels", script)
        self.assertIn('return `STD ${arkNovaBuildingSize(building)}`', script)
        self.assertIn(".arkn-building-chip.is-selected", stylesheet)
        self.assertIn(".is-building-highlight .ark-nova-map0-hex", script)

    def test_action_composer_explains_why_submit_is_disabled(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        room_script = (ROOT / "static" / "room.js").read_text(encoding="utf-8")
        self.assertIn("function arkNovaActionUnavailableReason", script)
        self.assertIn("function arkNovaIncompletePlanReason", script)
        self.assertIn("view.action_availability && view.action_availability[actionType]", script)
        self.assertIn('class="arkn-submit-reason" role="status"', script)
        self.assertIn('aria-describedby="${reasonId}"', script)
        self.assertIn(".arkn-submit-reason", stylesheet)
        self.assertIn('currentGameType === "ark_nova"', room_script)
        self.assertIn("window.showArkNovaError(data.message)", room_script)

    def test_animal_map_assignment_validates_enclosure_before_saving(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        issue_check = script.index("const issue = arkNovaAnimalEnclosureIssue(animal, building);")
        assignment = script.index("arkNovaUi.animalEnclosures.set(arkNovaCardId(animal), id);", issue_check)
        self.assertLess(issue_check, assignment)
        self.assertIn("if (issue) arkNovaToast(issue);", script[issue_check:assignment])
        self.assertIn("arkNovaBuildingName(building)", script)
        self.assertIn("window.showArkNovaError = showArkNovaError", script)

    def test_desktop_hand_maps_vertical_wheel_to_horizontal_scroll(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn('hand.addEventListener("wheel", arkNovaHandleHandWheel, { passive: false })', script)
        self.assertIn("function arkNovaHandleHandWheel", script)
        self.assertIn("hand.scrollLeft + event.deltaY", script)
        self.assertIn("@media (min-width: 821px)", stylesheet)
        self.assertIn("#arkNovaPanel #arkNovaHand", stylesheet)

    def test_map_placement_bonus_log_names_the_reward(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn("function arkNovaPlacementBonusText", script)
        self.assertIn('money: `+💰${amount}`', script)
        self.assertIn('appeal: `+🎟${amount}`', script)
        self.assertIn('card: `Choose ${amount} card', script)
        self.assertIn('eventType === "ark_nova:placement_bonus"', script)
        self.assertIn("arkNovaToast(arkNovaPlacementBonusText(payload))", script)

    def test_optional_free_building_uses_map_and_can_be_skipped(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        self.assertIn('"place_free_enclosure", "place_free_building", "place_unique_building"', script)
        self.assertIn("function arkNovaPendingBuildingType", script)
        self.assertIn('{ building_type: arkNovaPendingBuildingType(pending) }', script)
        self.assertIn('pendingType === "place_free_building" ? { skip: true }', script)
        self.assertIn("Choose one anchor hex on Map 0", script)

    def test_pending_choice_is_integrated_into_plan_action(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        heading = script.index('id="arkNovaComposerTitle"')
        pending = script.index('id="arkNovaPending"', heading)
        composer = script.index('id="arkNovaComposer"', pending)
        self.assertLess(heading, pending)
        self.assertLess(pending, composer)
        self.assertEqual(script.count('id="arkNovaPending"'), 1)
        self.assertNotIn('class="arkn-pending arkn-surface"', script)
        self.assertIn('composerSurface.classList.toggle("has-pending", !!pending)', script)
        self.assertIn('container.innerHTML = arkNovaHandDiscardChoice(view)', script)
        self.assertIn("#arkNovaPanel #arkNovaComposer:empty", stylesheet)
        self.assertIn(".arkn-composer-surface.has-pending", stylesheet)

    def test_server_errors_use_the_active_game_type(self) -> None:
        script = (ROOT / "static" / "room.js").read_text(encoding="utf-8")
        self.assertIn('if (currentGameType === "ark_nova"', script)
        self.assertNotIn('if (gameType === "ark_nova"', script)

    def test_mobile_map_has_contextual_rotate_control(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn('id="arkNovaMapRotateButton"', script)
        self.assertIn('class="arkn-composer-rotate"', script)
        self.assertIn("function arkNovaUpdateMapRotateButton", script)
        self.assertIn('button.classList.toggle("is-visible", canRotate)', script)
        self.assertIn("button.arkn-map-rotate-fab.is-visible", stylesheet)
        self.assertIn("button.arkn-composer-rotate", stylesheet)

    def test_rotation_previews_every_orientation_and_rejects_only_on_confirmation(self) -> None:
        script = (ROOT / "static" / "games" / "ark_nova.js").read_text(encoding="utf-8")
        stylesheet = (ROOT / "static" / "ark_nova.css").read_text(encoding="utf-8")
        self.assertIn("function arkNovaFootprintPreviewAt", script)
        self.assertIn("const rotation = allowed[(currentIndex + 1) % allowed.length]", script)
        self.assertNotIn("No other legal orientation fits at this anchor", script)
        self.assertIn("invalid_reason: invalidReason", script)
        self.assertIn("function arkNovaBuildQueueIssue", script)
        self.assertIn("cannot be confirmed", script)
        self.assertIn("is-invalid-draft", script)
        self.assertIn(".arkn-map-draft.is-invalid", stylesheet)

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
