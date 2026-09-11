from __future__ import annotations

import inspect
import unittest

from game import ark_nova_effects as effects


ACTION_IDS = ("animals", "build", "cards", "association", "sponsors")


def player_state() -> dict:
    return {
        "money": 20,
        "appeal": 0,
        "conservation": 0,
        "reputation": 0,
        "x_tokens": 0,
        "hand": [],
        "final_cards": [],
        "played_animals": [],
        "animal_records": [],
        "played_sponsors": [],
        "supported_projects": [],
        "action_cards": {
            action_id: {"slot": slot, "upgraded": False}
            for slot, action_id in enumerate(ACTION_IDS, start=1)
        },
        "map": {"buildings": [], "occupancy": {}, "conditions": {}},
        "available_workers": 1,
        "association_workers_total": 1,
        "association_workers_max": 4,
        "partner_zoos": [],
        "universities": [],
        "tags": {},
        "metrics": {},
    }


def game_state() -> dict:
    return {
        "players": {"p1": player_state(), "p2": player_state()},
        "turn_order": ["p1", "p2"],
        "current_player": "p1",
        "deck": [],
        "display": [],
        "discard": [],
        "final_deck": [],
        "projects": [],
        "project_slots": {},
        "blocked_project_slots": [],
        "break_position": 0,
        "break_limit": 15,
        "pending_choice": None,
    }


def context(state: dict, card_id: str = "", timing: str = "immediate", **metadata) -> effects.EffectContext:
    return effects.EffectContext(
        state=state,
        player_id="p1",
        card_id=card_id,
        timing=timing,
        metadata=metadata,
    )


class ArkNovaEffectCoverageTests(unittest.TestCase):
    def test_all_catalog_entries_have_executable_registry_coverage(self) -> None:
        report = effects.validate_registry_coverage()
        self.assertTrue(report["complete"])
        self.assertEqual(
            report["counts"],
            {
                "abilities": 45,
                "animal_cards": 128,
                "animal_ability_instances": 126,
                "sponsor_cards": 64,
                "sponsor_effects": 130,
                "conservation_projects": 32,
                "final_scoring_cards": 11,
                "action_cards": 5,
            },
        )

    def test_runtime_rules_do_not_parse_localized_card_text(self) -> None:
        source = inspect.getsource(effects)
        self.assertNotIn('["text_zh"]', source)
        self.assertNotIn("get(\"text_zh\"", source)

    def test_every_registered_effect_smoke_dispatches(self) -> None:
        for ability_id in effects.ABILITY_REGISTRY:
            result = effects.execute_ability(ability_id, context(game_state(), "401"), {})
            self.assertIsInstance(result, effects.EffectResult, ability_id)
        for card in effects.SPONSOR_CARDS:
            for index, effect in enumerate(card["effects"]):
                result = effects.execute_sponsor_effect(
                    card["id"], index, context(game_state(), card["id"], effect["timing"])
                )
                self.assertIsInstance(result, effects.EffectResult, effect["id"])
        for card_id in effects.CONSERVATION_PROJECT_REGISTRY:
            evaluation = effects.evaluate_conservation_project(card_id, context(game_state(), card_id))
            self.assertEqual(evaluation["card_id"], card_id)
        for card_id in effects.FINAL_SCORING_REGISTRY:
            self.assertIsInstance(effects.score_final_card(card_id, context(game_state(), card_id, "endgame")), int)


class ArkNovaAnimalAbilityTests(unittest.TestCase):
    def test_draw_uses_same_deck_top_as_core(self) -> None:
        state = game_state()
        state["deck"] = ["201", "202", "203"]
        result = effects.execute_ability("sprint", context(state, "401"), {"draw_count": 2})
        self.assertEqual(state["players"]["p1"]["hand"], ["203", "202"])
        self.assertEqual(state["deck"], ["201"])
        self.assertEqual(result.events[0]["card_ids"], ["203", "202"])

    def test_x_tokens_are_capped_and_full_throated_activates_worker(self) -> None:
        state = game_state()
        state["players"]["p1"]["x_tokens"] = 4
        effects.execute_ability("inventive", context(state, "414"), {"x_tokens": 3})
        self.assertEqual(state["players"]["p1"]["x_tokens"], 5)

        result = effects.execute_ability("full_throated", context(state, "421"))
        player = state["players"]["p1"]
        self.assertEqual(player["association_workers_total"], 2)
        self.assertEqual(player["available_workers"], 2)
        self.assertEqual(result.events[0]["type"], "worker_hired")

    def test_action_reposition_returns_atomic_core_command(self) -> None:
        state = game_state()
        before = {key: value["slot"] for key, value in state["players"]["p1"]["action_cards"].items()}
        pending = effects.execute_ability("clever", context(state, "405"))
        self.assertFalse(pending.completed)
        result = effects.execute_ability(
            "clever", context(state, "405"), choice={"selected_ids": ["sponsors:1"]}
        )
        after = {key: value["slot"] for key, value in state["players"]["p1"]["action_cards"].items()}
        self.assertEqual(before, after)
        self.assertEqual(result.events[0]["type"], "action_reposition_requested")

    def test_hunter_is_resumable_and_discards_non_kept_cards(self) -> None:
        state = game_state()
        state["deck"] = ["201", "402", "403", "204"]
        first = effects.execute_ability("hunter", context(state, "403"), {"reveal_count": 3})
        self.assertEqual(first.pending_choice["effect_ref"], "ability:hunter")
        candidates = first.pending_choice["metadata"]["candidates"]
        self.assertEqual(candidates, ["204", "403", "402"])
        resumed_context = context(state, "403", pending_choice=first.pending_choice)
        result = effects.execute_ability(
            "hunter", resumed_context, {"reveal_count": 3}, {"selected_ids": ["403"]}
        )
        self.assertTrue(result.completed)
        self.assertEqual(state["players"]["p1"]["hand"], ["403"])
        self.assertEqual(state["discard"], ["204", "402"])

    def test_free_build_and_attacks_resolve_to_structured_core_commands(self) -> None:
        state = game_state()
        pending = effects.execute_ability("posturing", context(state, "501"), {"maximum_buildings": 2})
        self.assertEqual(pending.pending_choice["kind"], "place_free_building")
        result = effects.execute_ability(
            "posturing",
            context(state, "501"),
            {"maximum_buildings": 2},
            {"placements": [{"building_type": "kiosk", "cells": ["h1"]}]},
        )
        self.assertEqual(result.events[0]["type"], "free_build_requested")

        attack = effects.execute_ability("venom", context(state, "449"), {"tokens_per_target": 1})
        self.assertEqual(attack.pending_choice["metadata"]["attack"], "venom")
        resolved = effects.execute_ability(
            "venom",
            context(state, "449"),
            {"tokens_per_target": 1},
            {"assignments": [{"target_player_id": "p2", "action": "animals"}]},
        )
        self.assertEqual(resolved.events[0]["type"], "attack_resolution_requested")


class ArkNovaSponsorEffectTests(unittest.TestCase):
    def test_direct_income_endgame_and_trigger_effects(self) -> None:
        state = game_state()
        effects.execute_sponsor_effect("220", "220-glossary-1", context(state, "220"))
        effects.execute_sponsor_effect("220", "220-printed-1", context(state, "220", "income"))
        self.assertEqual(state["players"]["p1"]["money"], 26)

        state["players"]["p1"]["tags"] = {"science": 6}
        effects.execute_sponsor_effect("201", "201-printed-2", context(state, "201", "endgame"))
        self.assertEqual(state["players"]["p1"]["conservation"], 2)

        registered = effects.execute_sponsor_effect("202", 0, context(state, "202", "passive"))
        self.assertEqual(registered.events[0]["type"], "effect_registered")
        triggered = effects.execute_sponsor_effect(
            "202", 0, context(state, "202", "passive", trigger="own_icon_played", tags=["science"], count=2)
        )
        self.assertEqual(state["players"]["p1"]["reputation"], 2)
        self.assertEqual(triggered.events[0]["amount"], 2)

    def test_no_text_sponsor_still_executes_printed_rewards(self) -> None:
        state = game_state()
        result = effects.execute_card_effects("205", context(state, "205"))
        player = state["players"]["p1"]
        self.assertEqual((player["conservation"], player["reputation"]), (1, 2))
        self.assertEqual(len(result.events), 2)

    def test_unique_building_choice_has_catalog_footprint_and_resumes(self) -> None:
        state = game_state()
        first = effects.execute_sponsor_effect("248", "248-unique-building", context(state, "248"))
        self.assertFalse(first.completed)
        building = first.pending_choice["metadata"]["building"]
        self.assertEqual(building["footprint"]["cell_count"], 4)
        result = effects.execute_sponsor_effect(
            "248",
            "248-unique-building",
            context(state, "248"),
            {"placement": {"anchor": "h1", "rotation": 2}},
        )
        self.assertTrue(result.completed)
        self.assertEqual(result.events[0]["type"], "unique_build_requested")


class ArkNovaProjectAndScoringTests(unittest.TestCase):
    def test_base_project_uses_typed_metric_and_blocked_slots(self) -> None:
        state = game_state()
        state["players"]["p1"]["tags"] = {
            "bird": 1,
            "herbivore": 1,
            "predator": 1,
            "primate": 1,
        }
        state["blocked_project_slots"] = [{"project_id": "101", "position": 2}]
        evaluation = effects.evaluate_conservation_project("101", context(state, "101"))
        self.assertEqual(evaluation["eligible_slots"], [3])

    def test_release_requires_exact_occupied_enclosure_size(self) -> None:
        state = game_state()
        player = state["players"]["p1"]
        player.update(
            {
                "appeal": 20,
                "played_animals": ["401"],
                "animal_records": [
                    {"card_id": "401", "enclosure_id": "enc-5", "enclosure_size": 5}
                ],
                "tags": {"predator": 2, "africa": 1},
                "tucked_cards": {"401": ["202"]},
                "map": {
                    "buildings": [
                        {
                            "id": "enc-5",
                            "type": "standard_enclosure",
                            "size": 5,
                            "occupied": True,
                            "occupied_by": ["401"],
                            "used_capacity": 5,
                        }
                    ],
                    "conditions": {},
                },
            }
        )
        evaluation = effects.evaluate_conservation_project("116", context(state, "116"))
        self.assertEqual(evaluation["eligible_slots"], [1])
        result = effects.support_conservation_project(
            "116", context(state, "116"), slot_position=1, animal_id="401"
        )
        self.assertNotIn("401", player["played_animals"])
        self.assertNotIn("401", player["hand"])
        self.assertEqual(player["released_animals"][0]["card_id"], "401")
        self.assertEqual(player["appeal"], 14)
        self.assertEqual(player["conservation"], 5)
        self.assertEqual(player["reputation"], 1)
        self.assertFalse(player["map"]["buildings"][0]["occupied"])
        self.assertEqual(player["map"]["buildings"][0]["used_capacity"], 0)
        self.assertEqual(state["discard"], ["202"])
        self.assertTrue(any(event["type"] == "animal_released" for event in result.events))

        wrong_size = game_state()
        wrong_size["players"]["p1"].update(
            {
                "played_animals": ["401"],
                "animal_records": [
                    {"card_id": "401", "enclosure_id": "enc-4", "enclosure_size": 4}
                ],
                "tags": {"predator": 2, "africa": 1},
            }
        )
        self.assertEqual(
            effects.evaluate_conservation_project("116", context(wrong_size, "116"))["eligible_slots"],
            [2],
        )

    def test_breeding_requires_matching_animal_and_partner_zoo(self) -> None:
        state = game_state()
        player = state["players"]["p1"]
        player["played_animals"] = ["494"]
        player["partner_zoos"] = ["africa"]
        eligible = effects.evaluate_conservation_project("123", context(state, "123"))
        self.assertEqual(eligible["eligible_slots"], [1, 2, 3])
        player["partner_zoos"] = ["asia"]
        self.assertFalse(effects.evaluate_conservation_project("123", context(state, "123"))["eligible"])

    def test_all_final_scoring_rule_shapes_execute(self) -> None:
        state = game_state()
        player = state["players"]["p1"]
        player["played_animals"] = ["401", "402"]
        self.assertEqual(effects.score_final_card("001", context(state, "001", "endgame")), 2)

        player["map"]["conditions"] = {
            "all_water_spaces_connected": True,
            "all_rock_spaces_connected": True,
            "all_buildable_border_spaces_covered": False,
            "all_buildable_spaces_covered": True,
        }
        self.assertEqual(effects.score_final_card("004", context(state, "004", "endgame")), 3)

        player["tags"] = {tag: 2 for tag in effects.ANIMAL_TAGS}
        state["players"]["p2"]["tags"] = {tag: 1 for tag in effects.ANIMAL_TAGS}
        self.assertEqual(effects.score_final_card("009", context(state, "009", "endgame")), 4)

    def test_action_card_faces_are_available_without_text_interpretation(self) -> None:
        animals = effects.get_action_rule("animals", "II", 5)
        self.assertEqual(animals["maximum_cards_by_strength"]["5"], 2)
        self.assertEqual(animals["strength_5_bonus"], {"reputation": 1})
        with self.assertRaises(ValueError):
            effects.get_action_rule("animals", "III", 5)


if __name__ == "__main__":
    unittest.main()
