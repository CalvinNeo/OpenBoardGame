from __future__ import annotations

import copy
import unittest

from game.ark_nova import (
    ACTION_IDS,
    ArkNovaGame,
    _find_placement,
    _place_building,
    _start_extra_action,
)


class ArkNovaAiTests(unittest.TestCase):
    def make_state(self, seed: int = 17):
        state = ArkNovaGame.init_game(
            {"seed": seed},
            [
                {"player_id": "bot", "seat": 0, "name": "Bot", "is_bot": True},
                {"player_id": "other", "seat": 1, "name": "Other", "is_bot": True},
            ],
        )
        for player_id in ("bot", "other"):
            action = ArkNovaGame.bot_move(state, player_id)
            self.assertIsNotNone(action)
            _, error = ArkNovaGame.apply_action(state, player_id, action)
            self.assertIsNone(error)
        return state

    def set_slot(self, state, action_id: str, slot: int) -> None:
        cards = state["players"]["bot"]["action_cards"]
        other_id = next(value for value in ACTION_IDS if cards[value]["slot"] == slot)
        old_slot = cards[action_id]["slot"]
        cards[other_id]["slot"] = old_slot
        cards[action_id]["slot"] = slot

    def test_bot_search_does_not_mutate_state_and_reports_progress(self) -> None:
        state = self.make_state()
        before = copy.deepcopy(state)
        updates = []

        action = ArkNovaGame.bot_move(
            state,
            "bot",
            progress_callback=lambda stage, progress, detail: updates.append((stage, progress, detail)),
        )

        self.assertEqual(state, before)
        self.assertIsNotNone(action)
        self.assertTrue(updates)
        self.assertEqual(updates[-1][0], "ready")
        candidate = copy.deepcopy(state)
        _, error = ArkNovaGame.apply_action(candidate, "bot", action)
        self.assertIsNone(error)

    def test_bot_plays_a_profitable_animal_when_an_enclosure_is_ready(self) -> None:
        state = self.make_state()
        player = state["players"]["bot"]
        player["hand"] = ["406"]  # high-value animal with appeal, conservation and reputation
        player["money"] = 50
        player["tags"] = {"asia": 3}
        cells = _find_placement(state, "bot", "standard_enclosure", 5)
        self.assertIsNotNone(cells)
        _place_building(
            state,
            "bot",
            {"building_type": "standard_enclosure", "size": 5, "cells": cells},
            [],
            free=True,
        )
        state["pending_choice"] = None
        state["pending_queue"] = []
        state["effect_queue"] = []
        state["deferred_turn_end"] = None
        state["phase"] = "action"
        state["current_player"] = "bot"
        state["current_turn"] = "bot"
        self.set_slot(state, "animals", 5)

        action = ArkNovaGame.bot_move(state, "bot")

        self.assertEqual(action["type"], "animals")
        self.assertEqual(action["plays"][0]["card_id"], "406")
        _, error = ArkNovaGame.apply_action(state, "bot", action)
        self.assertIsNone(error)
        self.assertIn("406", state["players"]["bot"]["played_animals"])

    def test_bot_supports_a_high_value_conservation_project(self) -> None:
        state = self.make_state()
        player = state["players"]["bot"]
        player["hand"] = []
        player["tags"] = {"africa": 5}
        player["available_workers"] = 1
        state["projects"] = ["103"]
        state["project_slots"] = {"103": []}
        state["blocked_project_slots"] = []
        state["current_player"] = "bot"
        state["current_turn"] = "bot"
        state["phase"] = "action"
        self.set_slot(state, "association", 5)

        action = ArkNovaGame.bot_move(state, "bot")

        self.assertEqual(action["type"], "association")
        self.assertEqual(action["tasks"][0]["task"], "support_project")
        self.assertEqual(action["tasks"][0]["project_id"], "103")
        _, error = ArkNovaGame.apply_action(state, "bot", action)
        self.assertIsNone(error)
        self.assertEqual(state["players"]["bot"]["conservation"], 5)

    def test_bot_avoids_animal_whose_forced_association_action_would_deadlock(self) -> None:
        state = self.make_state()
        player = state["players"]["bot"]
        player["hand"] = ["409"]
        player["money"] = 30
        player["partner_zoos"] = ["africa"]
        player["available_workers"] = 0
        player["association_worker_placements"] = [{"task": "reputation"}]
        cells = _find_placement(state, "bot", "standard_enclosure", 2)
        self.assertIsNotNone(cells)
        _place_building(
            state,
            "bot",
            {"building_type": "standard_enclosure", "size": 2, "cells": cells},
            [],
            free=True,
        )
        state["pending_choice"] = None
        state["pending_queue"] = []
        state["effect_queue"] = []
        state["deferred_turn_end"] = None
        state["phase"] = "action"
        state["current_player"] = "bot"
        state["current_turn"] = "bot"
        self.set_slot(state, "association", 2)
        self.set_slot(state, "animals", 5)

        action = ArkNovaGame.bot_move(state, "bot")

        self.assertIsNotNone(action)
        self.assertNotEqual(action["type"], "animals")
        candidate = copy.deepcopy(state)
        _, error = ArkNovaGame.apply_action(candidate, "bot", action)
        self.assertIsNone(error)

    def test_bot_resolves_a_mandatory_free_enclosure_placement(self) -> None:
        state = self.make_state()
        state["pending_choice"] = {
            "choice_id": "ai-free-enclosure",
            "type": "place_free_enclosure",
            "player_id": "bot",
            "size": 3,
            "prompt": "Place a free enclosure",
            "options": [],
            "min": 1,
            "max": 1,
        }
        state["phase"] = "pending_choice"
        before_count = len(state["players"]["bot"]["map"]["buildings"])

        action = ArkNovaGame.bot_move(state, "bot")

        self.assertEqual(action["type"], "resolve_choice")
        self.assertEqual(len(action["selection"]["cells"]), 3)
        _, error = ArkNovaGame.apply_action(state, "bot", action)
        self.assertIsNone(error)
        self.assertEqual(len(state["players"]["bot"]["map"]["buildings"]), before_count + 1)

    def test_bot_finishes_each_card_source_choice_during_a_granted_cards_action(self) -> None:
        state = self.make_state()
        state["players"]["bot"]["action_cards"]["cards"]["upgraded"] = True
        _start_extra_action(state, {
            "player_id": "bot", "action": "cards", "strength": 4,
            "move_after": True, "allow_x_alternative": True, "optional": True,
        }, [])
        _, error = ArkNovaGame.apply_action(state, "bot", {
            "type": "cards", "choose_card_sources": True,
        })
        self.assertIsNone(error)
        self.assertEqual(state["pending_choice"]["type"], "draw_card")
        source_choices = 0
        for _ in range(12):
            pending = state.get("pending_choice")
            if not pending:
                break
            source_choices += int(pending["type"] == "draw_card")
            action = ArkNovaGame.bot_move(state, pending["player_id"])
            self.assertIsNotNone(action)
            self.assertEqual(action["type"], "resolve_choice")
            _, error = ArkNovaGame.apply_action(state, pending["player_id"], action)
            self.assertIsNone(error)
        self.assertGreater(source_choices, 1)
        self.assertIsNone(state.get("pending_choice"))
        self.assertNotIn("forced_action", state)
        self.assertEqual(state["current_player"], "other")


if __name__ == "__main__":
    unittest.main()
