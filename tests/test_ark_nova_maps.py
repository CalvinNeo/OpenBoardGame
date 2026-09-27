from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import unittest

from jsonschema import Draft7Validator

from game import ark_nova as rules
from game.ark_nova_maps import MAPS, map_cells, map_rewards, enclosure_capacity
from game.definitions import ARK_NOVA_ACTION_SCHEMA, ARK_NOVA_CONFIG_SCHEMA


ROOT = Path(__file__).resolve().parents[1]


class ArkNovaMapsTests(unittest.TestCase):
    def make_state(self, map_id="map0", second="map0"):
        state = rules.ArkNovaGame.init_game({"seed": 17, "map_mode": "choose"}, [
            {"player_id": "a", "name": "Alice", "seat": 0},
            {"player_id": "b", "name": "Bob", "seat": 1},
        ])
        for pid, chosen in (("a", map_id), ("b", second)):
            self.act(state, pid, {"type": "choose_map", "map_id": chosen})
        for pid in ("a", "b"):
            self.act(state, pid, {"type": "keep_initial_cards", "card_ids": state["players"][pid]["hand"][:4]})
        return state

    def act(self, state, pid, action):
        self.assertFalse(list(Draft7Validator(ARK_NOVA_ACTION_SCHEMA).iter_errors(action)))
        events, error = rules.ArkNovaGame.apply_action(state, pid, action)
        self.assertIsNone(error, (action, error))
        return events

    def building(self, player, cells, size=1, occupied=False):
        building = {"id": f"tile-{len(player['map']['buildings'])}", "building_type": "standard_enclosure",
                    "cells": cells, "size": size, "capacity": size, "used_capacity": 0,
                    "occupied": occupied, "occupied_by": []}
        player["map"]["buildings"].append(building)
        player["map"]["occupancy"].update({cell: building["id"] for cell in cells})
        return building

    def test_default_and_legacy_config_keep_everyone_on_map_zero(self):
        for config in ({}, {"map_id": "map0"}, {"map_mode": "map0"}):
            state = rules.ArkNovaGame.init_game(config, [{"player_id": "a"}, {"player_id": "b"}])
            self.assertEqual(state["phase"], "setup")
            self.assertEqual([p["map"]["id"] for p in state["players"].values()], ["map0", "map0"])
            self.assertEqual(rules.ArkNovaGame.get_legal_actions(state, "a"), ["keep_initial_cards"])
            self.assertIsNotNone(rules.ArkNovaGame.apply_action(state, "a", {"type": "choose_map", "map_id": "map3a"})[1])

    def test_selection_is_independent_atomic_and_blocks_setup(self):
        state = rules.ArkNovaGame.init_game({"map_mode": "choose"}, [{"player_id": "a"}, {"player_id": "b"}])
        before = copy.deepcopy(state)
        for action in ({"type": "choose_map", "map_id": "map99"}, {"type": "choose_map", "map_id": []},
                       {"type": "keep_initial_cards", "card_ids": state["players"]["a"]["hand"][:4]}):
            self.assertIsNotNone(rules.ArkNovaGame.apply_action(state, "a", action)[1])
            self.assertEqual(state, before)
        self.assertEqual(rules.ArkNovaGame.get_public_view(state, "a")["your_hand"], [])
        self.act(state, "b", {"type": "choose_map", "map_id": "map3a"})
        self.assertEqual(rules.ArkNovaGame.get_legal_actions(state, "b"), [])
        self.assertEqual(state["players"]["a"]["map"]["id"], "map0")
        self.act(state, "a", {"type": "choose_map", "map_id": "map3a"})
        self.assertEqual(state["phase"], "setup")
        self.assertEqual(len(rules.ArkNovaGame.get_public_view(state, "a")["your_hand"]), 8)
        self.assertIsNotNone(rules.ArkNovaGame.apply_action(state, "a", {"type": "choose_map", "map_id": "map1a"})[1])

    def test_config_rejects_unknown_modes(self):
        self.assertTrue(list(Draft7Validator(ARK_NOVA_CONFIG_SCHEMA).iter_errors({"map_mode": "random"})))
        with self.assertRaises(ValueError):
            rules.ArkNovaGame.init_game({"map_mode": "random"}, [{"player_id": "a"}, {"player_id": "b"}])

    def test_serialization_preserves_pending_selection_and_map_views(self):
        state = rules.ArkNovaGame.init_game({"map_mode": "choose"}, [{"player_id": "a"}, {"player_id": "b"}])
        self.act(state, "a", {"type": "choose_map", "map_id": "map3a"})
        state = rules.ArkNovaGame.deserialize(json.loads(json.dumps(rules.ArkNovaGame.serialize(state))))
        self.assertEqual(state["map_selection_pending"], ["b"])
        self.act(state, "b", {"type": "choose_map", "map_id": "map6a"})
        for pid, expected in (("a", "map3a"), ("b", "map6a")):
            view = rules.ArkNovaGame.get_public_view(state, pid)
            self.assertEqual(view["map_definition"]["id"], expected)
            self.assertEqual(set(view["map_definitions"]), {"map3a", "map6a"})
            self.assertEqual(len(view["map_options"]), 7)
        spectator = rules.ArkNovaGame.get_public_view(state, "observer")
        self.assertEqual(spectator["your_hand"], [])
        self.assertEqual(spectator["legal_actions"], [])

    def test_legacy_save_without_map_selection_still_loads(self):
        state = self.make_state()
        state.pop("map_selection_pending")
        state["config"] = {}
        loaded = rules.ArkNovaGame.deserialize(json.loads(json.dumps(state)))
        self.assertEqual(rules.ArkNovaGame.get_public_view(loaded, "a")["map_definition"]["id"], "map0")

    def test_all_map_sources_generate_current_artifacts_and_share_geometry(self):
        spec = importlib.util.spec_from_file_location("map_generator", ROOT / "scripts/gen_arknova_map_svg.py")
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        for map_id in MAPS:
            with self.subTest(map_id=map_id):
                source = json.loads((ROOT / f"designs/ark_nova/{map_id}.source.json").read_text(encoding="utf-8"))
                data = generator.expand_config(source)
                self.assertEqual(data, MAPS[map_id])
                self.assertEqual(generator.render_svg(data), (ROOT / f"static/assets/ark_nova/{map_id}.svg").read_text(encoding="utf-8"))
                self.assertEqual(len(data["cells"]), 58)
                self.assertEqual(len(data["conservation_rewards"]), 7)
                self.assertEqual([c["neighbors"] for c in data["cells"]], [c["neighbors"] for c in MAPS["map0"]["cells"]])
                if map_id != "map0":
                    self.assertNotEqual(data["terrain"], MAPS["map0"]["terrain"])

    def test_silver_lake_printed_bonuses_and_build_ii(self):
        state = self.make_state("map3a")
        player = state["players"]["a"]
        cells = map_cells(player)
        money_cells = {cell for cell, data in cells.items() if data.get("placement_bonus", {}).get("type") == "money"}
        self.assertEqual(money_cells, set("E1 D2 F2 D3 F3 C3 C4 F4 D5 F5 E5".split()))
        spec = {"building_type": "standard_enclosure", "size": 1, "cells": ["E1"]}
        self.assertIn("Build II", rules._validate_building_placement(state, "a", spec))
        player["action_cards"]["build"]["upgraded"] = True
        before = player["money"]
        rules._place_building(state, "a", spec, [], free=True)
        self.assertEqual(player["money"], before + 2)
        rules._apply_placement_bonus(state, "a", "E1", [])
        self.assertEqual(player["money"], before + 2)

    def test_player_specific_terrain_and_derived_metrics(self):
        state = self.make_state("map3a", "map0")
        spec = {"building_type": "standard_enclosure", "size": 1, "cells": ["A1"]}
        self.assertIsNone(rules._validate_building_placement(state, "a", spec))
        self.assertIn("buildable", rules._validate_building_placement(state, "b", spec))
        self.assertNotEqual(rules._adjacent_terrain(["D3"], "water", state["players"]["a"]),
                            rules._adjacent_terrain(["D3"], "water", state["players"]["b"]))
        for player in state["players"].values():
            rules._update_derived_metrics(player)

    def test_outdoor_area_capacity_and_releasing_use_effective_size(self):
        state = self.make_state("map2a")
        player = state["players"]["a"]
        building = self.building(player, ["G4"])
        ordinary = self.building(player, ["I1"])
        self.assertEqual(enclosure_capacity(player, building), 3)
        self.assertEqual(enclosure_capacity(player, ordinary), 1)
        card = {"enclosure_options": [{"type": "standard", "required_spaces": 3}], "placement": {}}
        self.assertIsNone(rules._enclosure_for_animal(player, card, building["id"])[2])
        building["occupied"] = True
        self.assertEqual(rules._standard_enclosures_to_empty(player, card), [building])
        building["building_type"] = "petting_zoo"
        self.assertEqual(enclosure_capacity(player, building), 1)

    def test_observation_tower_rewards_only_newly_occupied_standard_enclosure(self):
        state = self.make_state("map1a")
        player = state["players"]["a"]
        building = self.building(player, ["G3", "H3"], 2)
        card = next(c for c in rules.ANIMAL_CARDS.values() if not c["play"].get("conditions")
                    and c["enclosure_options"][0]["type"] == "standard"
                    and c["enclosure_options"][0]["required_spaces"] <= 2 and not any(c.get("placement", {}).get("adjacent_to", {}).values()))
        player["hand"] = [card["id"]]
        player["money"] = 100
        refs, _ = rules._play_animal_card(state, "a", {"card_id": card["id"], "enclosure_id": building["id"]}, 1, 5, [])
        self.assertTrue(any(ref.get("source") == "map:observation_tower" for ref in refs))
        self.assertTrue(building["occupied"])

    def test_restaurant_counts_spaces_including_empty_enclosures(self):
        state = self.make_state("map5a")
        player = state["players"]["a"]
        self.building(player, ["D3", "D4"], 2)
        self.building(player, ["I1"])
        self.assertEqual(rules._map_income(player), 2)
        money = player["money"]
        rules._run_core_effect(state, {"type": "core", "operation": "zoo_income", "player_id": "a"}, [])
        self.assertEqual(player["money"] - money, rules._appeal_income(player["appeal"]) + 2)

    def test_research_reduces_one_icon_and_stacks_with_another_waiver(self):
        state = self.make_state("map6a")
        player = state["players"]["a"]
        card = copy.deepcopy(rules.ANIMAL_CARDS["401"])
        card["play"]["conditions"] = [{"kind": "tag_count", "tag": "predator", "minimum": 3}]
        player["tags"]["predator"] = 2
        self.assertFalse(rules._card_conditions_met(player, card))
        self.building(player, ["A6"])
        self.assertTrue(rules._card_conditions_met(player, card))
        player["tags"]["predator"] = 1
        self.assertFalse(rules._card_conditions_met(player, card))
        self.assertTrue(rules._card_conditions_met(player, card, ignore_count=1))
        card["enclosure_options"] = [{"type": "standard", "required_spaces": 1}]
        card["placement"] = {"adjacent_to": {"water": 2}}
        self.assertIsNotNone(rules._enclosure_for_animal(player, card, player["map"]["buildings"][0]["id"])[2])

    def test_harbor_can_be_used_only_once_and_never_during_breaks(self):
        state = self.make_state("map4a")
        player = state["players"]["a"]
        self.building(player, ["A6"])
        money = player["money"]
        order = copy.deepcopy(player["action_cards"])
        sold = player["hand"][0]
        self.act(state, "a", {"type": "use_harbor", "card_id": sold})
        player = state["players"]["a"]
        self.assertEqual(player["money"], money + 3)
        self.assertEqual(player["action_cards"], order)
        self.assertEqual(state["current_player"], "a")
        self.assertIn(sold, state["discard"])
        before = copy.deepcopy(state)
        self.assertIsNotNone(rules.ArkNovaGame.apply_action(state, "a", {"type": "use_harbor", "card_id": player["hand"][0]})[1])
        self.assertEqual(before, state)
        player["map"].pop("harbor_used")
        state["resolving_break"] = True
        self.assertNotIn("use_harbor", rules.ArkNovaGame.get_legal_actions(state, "a"))

    def test_harbor_is_offered_after_action_and_skip_finishes_turn(self):
        state = self.make_state("map4a")
        self.building(state["players"]["a"], ["A6"])
        self.act(state, "a", {"type": "gain_x", "action_card": "cards"})
        pending = state["pending_choice"]
        self.assertEqual(pending["type"], "map_harbor")
        self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": []})
        self.assertEqual(state["current_player"], "b")
        self.assertNotIn("harbor_used", state["players"]["a"]["map"])

    def test_harbor_sale_can_fund_a_second_animal_during_the_same_action(self):
        state = self.make_state("map4a")
        player = state["players"]["a"]
        self.building(player, ["A6"], 5)
        card = next(c for c in rules.ANIMAL_CARDS.values() if not c["play"].get("conditions")
                    and c["enclosure_options"][0]["type"] == "standard"
                    and not any(c.get("placement", {}).get("adjacent_to", {}).values()))
        player["hand"] = [card["id"], "201"]
        player["money"] = rules._animal_cost(player, card) - 3
        state["card_sequence"] = {"player_id": "a", "action": "animals", "strength": 5, "level": 1,
                                  "maximum": 2, "played": 1, "planned": [], "interactive": True,
                                  "x_tokens": 0, "after": [], "sizes": ["large"]}
        rules._resume_if_clear(state, [])
        self.assertEqual(state["pending_choice"]["type"], "continue_cards")
        self.assertEqual(state["pending_choice"]["options"], [])
        self.act(state, "a", {"type": "use_harbor", "card_id": "201"})
        pending = state["pending_choice"]
        self.assertEqual(pending["type"], "continue_cards")
        self.assertTrue(any(option["value"]["card_id"] == card["id"] for option in pending["options"]))
        self.assertEqual(state["card_sequence"]["played"], 1)
        self.assertEqual(state["current_player"], "a")

    def test_conservation_rewards_belong_to_selected_map(self):
        state = self.make_state("map3a")
        player = state["players"]["a"]
        self.assertIn("determination", map_rewards(player))
        with self.assertRaises(ValueError):
            rules._claim_map_reward(state, "a", "conservation_1_income", [])
        rules._claim_map_reward(state, "a", "determination", [])
        self.assertIsNone(state["pending_choice"])
        self.assertEqual(state["after_action_core_effects"][0]["choice"]["type"], "map_extra_action")
        self.act(state, "a", {"type": "gain_x", "action_card": "cards"})
        pending = state["pending_choice"]
        self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": "sponsors"})
        self.assertEqual(state["forced_action"]["action"], "sponsors")
        self.assertEqual(state["current_player"], "a")

    def test_last_worker_bonus_applies_once_and_uses_selected_map(self):
        state = self.make_state("map6a", "map0")
        for player in state["players"].values():
            player["association_workers_total"] = 4
        rules._check_map_worker_rewards(state, [])
        self.assertEqual(state["players"]["a"]["conservation"], 2)
        self.assertEqual(state["players"]["b"]["conservation"], 0)
        rules._check_map_worker_rewards(state, [])
        self.assertEqual(state["players"]["a"]["conservation"], 2)

    def test_free_special_enclosure_waives_card_upgrade_but_respects_map_spaces(self):
        state = self.make_state("map5a")
        rules._claim_map_reward(state, "a", "special_enclosure", [])
        pending = state["pending_choice"]
        self.assertEqual(pending["type"], "map_special_enclosure")
        self.assertEqual([option["value"] for option in pending["options"]], sorted(rules.SPECIAL_ENCLOSURES))
        self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": "large_bird_aviary"})
        pending = state["pending_choice"]
        self.assertEqual(pending["building_type"], "large_bird_aviary")
        self.assertFalse(state["players"]["a"]["action_cards"]["build"]["upgraded"])
        restricted = ["G2", "H1", "H2", "I1", "I2"]
        before = copy.deepcopy(state)
        self.assertIn("Build II", rules.ArkNovaGame.apply_action(state, "a", {
            "type": "resolve_choice", "choice_id": pending["choice_id"], "selection": {"cells": restricted},
        })[1])
        self.assertEqual(state, before)
        cells = rules._find_placement(state, "a", "large_bird_aviary", 5)
        money = state["players"]["a"]["money"]
        self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": {"cells": cells}})
        self.assertEqual(state["players"]["a"]["map"]["buildings"][0]["building_type"], "large_bird_aviary")
        self.assertEqual(state["players"]["a"]["money"], money)

    def test_research_map_moves_two_cards_after_action_and_again_at_break(self):
        state = self.make_state("map6a")
        rules._claim_map_reward(state, "a", "action_to_slot_income", [])
        self.assertIsNone(state["pending_choice"])
        self.act(state, "a", {"type": "gain_x", "action_card": "cards"})
        for action_id in ("animals", "build"):
            pending = state["pending_choice"]
            self.assertEqual(pending["type"], "action_to_slot")
            self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": action_id})
            self.assertEqual(state["players"]["a"]["action_cards"][action_id]["slot"], 1)
        self.assertEqual(state["current_player"], "b")
        state["resolving_break"] = True
        state["effect_queue"] = [{"type": "core", "operation": "map_income", "player_id": "a", "reward_id": "action_to_slot_income"}]
        rules._run_effect_queue(state, [])
        for action_id in ("sponsors", "association"):
            pending = state["pending_choice"]
            self.assertEqual(pending["type"], "action_to_slot")
            self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": action_id})
            self.assertEqual(state["players"]["a"]["action_cards"][action_id]["slot"], 1)
        self.assertIsNone(state["pending_choice"])

    def test_observation_sponsor_reward_recurs_at_break(self):
        state = self.make_state("map1a")
        player = state["players"]["a"]
        player["hand"] = list(rules.SPONSOR_CARDS)
        player["money"] = 100
        reward_id = next(key for key, reward in map_rewards(player).items() if reward["type"] == "sponsor")
        rules._claim_map_reward(state, "a", reward_id, [])
        pending = state["pending_choice"]
        self.assertEqual(pending["type"], "play_sponsor_for_money")
        self.act(state, "a", {"type": "resolve_choice", "choice_id": pending["choice_id"], "selection": []})
        state["resolving_break"] = True
        rules._run_core_effect(state, {"type": "core", "operation": "map_income", "player_id": "a", "reward_id": reward_id}, [])
        self.assertEqual(state["pending_choice"]["type"], "play_sponsor_for_money")

    def test_ai_selects_map_and_finds_legal_building_on_every_map(self):
        state = rules.ArkNovaGame.init_game({"map_mode": "choose"}, [{"player_id": "a"}, {"player_id": "b"}])
        self.act(state, "a", rules.ArkNovaGame.bot_move(state, "a"))
        for map_id in MAPS:
            with self.subTest(map_id=map_id):
                state = self.make_state(map_id)
                cells = rules._find_placement(state, "a", "standard_enclosure", 2)
                self.assertIsNotNone(cells)
                self.assertIsNone(rules._validate_building_placement(state, "a", {"building_type": "standard_enclosure", "size": 2, "cells": cells}))


if __name__ == "__main__":
    unittest.main()
