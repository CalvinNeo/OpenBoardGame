from __future__ import annotations

import copy
import unittest

from game.ark_nova import (
    ACTION_IDS,
    ANIMAL_CARDS,
    ArkNovaGame,
    BUILDING_FOOTPRINTS,
    MAP_REWARDS,
    SPONSOR_CARDS,
    _find_placement,
    _matches_footprint,
    _place_building,
    _target_appeal,
)


class ArkNovaGameTests(unittest.TestCase):
    def make_state(self, player_count: int = 2, seed: int = 7):
        players = [
            {"player_id": f"p{index + 1}", "seat": index, "name": f"Player {index + 1}"}
            for index in range(player_count)
        ]
        state = ArkNovaGame.init_game({"seed": seed}, players)
        for player in players:
            player_id = player["player_id"]
            _, error = ArkNovaGame.apply_action(
                state,
                player_id,
                {"type": "keep_initial_cards", "card_ids": list(state["players"][player_id]["hand"][:4])},
            )
            self.assertIsNone(error)
        return state

    def set_turn(self, state, player_id: str) -> None:
        state["current_player"] = player_id
        state["current_turn"] = player_id
        state["phase"] = "action"
        state["pending_choice"] = None
        state["pending_queue"] = []
        state["deferred_turn_end"] = None

    def set_slot(self, state, player_id: str, action_id: str, slot: int) -> None:
        cards = state["players"][player_id]["action_cards"]
        other_id = next(value for value in ACTION_IDS if cards[value]["slot"] == slot)
        old_slot = cards[action_id]["slot"]
        cards[other_id]["slot"] = old_slot
        cards[action_id]["slot"] = slot

    def add_hand_card(self, state, player_id: str, card_id: str) -> None:
        for collection in (state["deck"], state["display"], state["discard"]):
            while card_id in collection:
                collection.remove(card_id)
        state["players"][player_id]["hand"].append(card_id)

    def test_setup_counts_fixed_animals_slot_and_two_player_blocks(self) -> None:
        state = ArkNovaGame.init_game(
            {"seed": 1},
            [{"player_id": "p1", "seat": 0}, {"player_id": "p2", "seat": 1}],
        )
        self.assertEqual(state["break_limit"], 8 + 7)
        self.assertEqual(len(state["deck"]), 190)
        self.assertEqual(len(state["display"]), 6)
        self.assertEqual(len(state["projects"]), 3)
        self.assertEqual(len(state["blocked_project_slots"]), 3)
        self.assertEqual([slot["cost"] for slot in state["association_supply"]["donation_slots"]], [2, 2, 5, 5, 7, 7, 10, 10])
        self.assertEqual(
            [slot["cost"] for slot in state["association_supply"]["donation_slots"] if slot["blocked"]],
            [2, 5, 7],
        )
        for player in state["players"].values():
            self.assertEqual(player["action_cards"]["animals"]["slot"], 1)
            self.assertEqual(sorted(card["slot"] for card in player["action_cards"].values()), [1, 2, 3, 4, 5])
            self.assertEqual(len(player["hand"]), 8)
            self.assertEqual(len(player["final_cards"]), 2)

    def test_initial_hand_selection_is_simultaneous_and_transactional(self) -> None:
        state = ArkNovaGame.init_game(
            {"seed": 2},
            [{"player_id": "p1", "seat": 0}, {"player_id": "p2", "seat": 1}],
        )
        before = copy.deepcopy(state)
        _, error = ArkNovaGame.apply_action(state, "p1", {"type": "keep_initial_cards", "card_ids": state["players"]["p1"]["hand"][:3]})
        self.assertIsNotNone(error)
        self.assertEqual(state, before)
        for player_id in ("p2", "p1"):
            _, error = ArkNovaGame.apply_action(
                state, player_id,
                {"type": "keep_initial_cards", "card_ids": state["players"][player_id]["hand"][:4]},
            )
            self.assertIsNone(error)
        self.assertEqual(state["phase"], "action")
        self.assertEqual(state["current_player"], "p1")

    def test_public_view_hides_other_hands_and_final_cards(self) -> None:
        state = self.make_state()
        view = ArkNovaGame.get_public_view(state, "p1")
        self.assertEqual(len(view["your_hand"]), 4)
        self.assertEqual(len(view["your_final_cards"]), 2)
        encoded_other = view["players"][1]
        self.assertNotIn("hand", encoded_other)
        self.assertNotIn("final_cards", encoded_other)
        self.assertEqual(encoded_other["hand_count"], 4)
        self.assertIn("map", encoded_other)
        self.assertIn("buildings", encoded_other["map"])
        self.assertIn("played_animals", encoded_other)
        self.assertIn("played_sponsors", encoded_other)
        self.assertTrue(all(card and "name" in card for card in view["display"]))

    def test_standard_enclosures_use_their_printed_fixed_shapes(self) -> None:
        matching_cells = {
            1: ["A1"],
            2: ["A1", "B2"],
            3: ["A1", "A2", "B2"],
            4: ["A1", "A2", "B2", "B3"],
            5: ["A1", "A2", "B2", "B3", "C2"],
        }
        for size, cells in matching_cells.items():
            with self.subTest(size=size):
                footprint = BUILDING_FOOTPRINTS[f"standard_enclosure_{size}"]
                self.assertTrue(_matches_footprint(cells, footprint))
                if size >= 3:
                    self.assertFalse(_matches_footprint([f"A{row}" for row in range(1, size + 1)], footprint))

    def test_x_alternative_reorders_action_cards(self) -> None:
        state = self.make_state()
        self.set_slot(state, "p1", "build", 4)
        _, error = ArkNovaGame.apply_action(state, "p1", {"type": "gain_x", "action_card": "build"})
        self.assertIsNone(error)
        player = state["players"]["p1"]
        self.assertEqual(player["x_tokens"], 1)
        self.assertEqual(player["action_cards"]["build"]["slot"], 1)
        self.assertEqual(sorted(card["slot"] for card in player["action_cards"].values()), [1, 2, 3, 4, 5])
        self.assertEqual(state["current_player"], "p2")

    def test_build_validates_fixed_footprint_adjacency_and_rolls_back(self) -> None:
        state = self.make_state()
        self.set_slot(state, "p1", "build", 3)
        cells = _find_placement(state, "p1", "standard_enclosure", 3)
        self.assertIsNotNone(cells)
        _, error = ArkNovaGame.apply_action(
            state, "p1",
            {"type": "build", "buildings": [{"building_type": "standard_enclosure", "size": 3, "cells": cells}]},
        )
        self.assertIsNone(error)
        building = state["players"]["p1"]["map"]["buildings"][0]
        self.assertEqual(building["cells"], cells)
        self.assertEqual(state["players"]["p1"]["money"], 19)

        self.set_turn(state, "p1")
        self.set_slot(state, "p1", "build", 3)
        before = copy.deepcopy(state)
        disconnected = ["A3", "E2", "I1"]
        _, error = ArkNovaGame.apply_action(
            state, "p1",
            {"type": "build", "buildings": [{"building_type": "standard_enclosure", "size": 3, "cells": disconnected}]},
        )
        self.assertIsNotNone(error)
        self.assertEqual(state, before)

    def test_cards_trigger_break_clamps_track_and_awards_x(self) -> None:
        state = self.make_state()
        self.set_slot(state, "p1", "cards", 2)
        state["break_position"] = state["break_limit"] - 1
        state["players"]["p1"]["available_workers"] = 0
        _, error = ArkNovaGame.apply_action(state, "p1", {"type": "cards", "mode": "draw"})
        self.assertIsNone(error)
        self.assertEqual(state["break_position"], 0)
        self.assertEqual(state["break_count"], 1)
        self.assertEqual(state["players"]["p1"]["x_tokens"], 1)
        self.assertEqual(state["players"]["p1"]["available_workers"], 1)

    def test_both_players_can_take_the_same_partner_zoo_type(self) -> None:
        state = self.make_state()
        for player_id in ("p1", "p2"):
            self.set_turn(state, player_id)
            self.set_slot(state, player_id, "association", 3)
            _, error = ArkNovaGame.apply_action(
                state, player_id,
                {"type": "association", "tasks": [{"task": "partner_zoo", "continent": "africa"}]},
            )
            self.assertIsNone(error)
            self.assertIn("africa", state["players"][player_id]["partner_zoos"])

    def test_university_options_expose_rewards_and_live_availability(self) -> None:
        state = self.make_state()
        view = ArkNovaGame.get_public_view(state, "p1")
        options = {item["id"]: item for item in view["association_supply"]["university_options"]}
        self.assertEqual(options["university_science"]["science"], 2)
        self.assertEqual(options["university_reputation"]["reputation"], 1)
        self.assertEqual(options["university_hand_limit"]["hand_limit"], 5)
        self.assertTrue(all(item["available"] for item in options.values()))

        self.set_slot(state, "p1", "association", 4)
        _, error = ArkNovaGame.apply_action(
            state, "p1",
            {"type": "association", "tasks": [{"task": "university", "university_id": "university_science"}]},
        )
        self.assertIsNone(error)
        p1_option = next(
            item for item in ArkNovaGame.get_public_view(state, "p1")["association_supply"]["university_options"]
            if item["id"] == "university_science"
        )
        self.assertTrue(p1_option["owned_by_you"])
        self.assertFalse(p1_option["available"])
        self.assertEqual(p1_option["remaining"], 3)
        p2_option = next(
            item for item in ArkNovaGame.get_public_view(state, "p2")["association_supply"]["university_options"]
            if item["id"] == "university_science"
        )
        self.assertTrue(p2_option["available"])

    def test_two_player_first_donation_costs_two(self) -> None:
        state = self.make_state()
        player = state["players"]["p1"]
        player["action_cards"]["association"]["upgraded"] = True
        self.set_slot(state, "p1", "association", 2)
        before_money = player["money"]
        _, error = ArkNovaGame.apply_action(
            state, "p1",
            {"type": "association", "tasks": [{"task": "reputation"}], "donate": True},
        )
        self.assertIsNone(error)
        player = state["players"]["p1"]
        self.assertEqual(player["money"], before_money - 2)
        occupied = [slot for slot in state["association_supply"]["donation_slots"] if slot["occupied_by"] == "p1"]
        self.assertEqual([slot["cost"] for slot in occupied], [2])

    def test_animal_occupies_enclosure_and_applies_printed_rewards(self) -> None:
        state = self.make_state()
        player = state["players"]["p1"]
        cells = _find_placement(state, "p1", "standard_enclosure", 4)
        events = []
        enclosure = _place_building(
            state, "p1", {"building_type": "standard_enclosure", "size": 4, "cells": cells}, events, free=True,
        )
        self.add_hand_card(state, "p1", "495")
        self.set_slot(state, "p1", "animals", 2)
        before_appeal = player["appeal"]
        _, error = ArkNovaGame.apply_action(
            state, "p1",
            {"type": "animals", "plays": [{"card_id": "495", "enclosure_id": enclosure["id"]}]},
        )
        self.assertIsNone(error)
        player = state["players"]["p1"]
        enclosure = next(item for item in player["map"]["buildings"] if item["id"] == enclosure["id"])
        self.assertIn("495", player["played_animals"])
        self.assertEqual(enclosure["occupied_by"], ["495"])
        self.assertEqual(player["appeal"], before_appeal + ANIMAL_CARDS["495"]["printed_rewards"]["appeal"])

    def test_sponsor_card_updates_icons_without_text_parsing(self) -> None:
        state = self.make_state()
        self.add_hand_card(state, "p1", "223")
        self.set_slot(state, "p1", "sponsors", 3)
        _, error = ArkNovaGame.apply_action(
            state, "p1", {"type": "sponsors", "mode": "play", "card_ids": ["223"]},
        )
        self.assertIsNone(error)
        self.assertIn("223", state["players"]["p1"]["played_sponsors"])
        self.assertEqual(state["players"]["p1"]["tags"]["science"], 2)

    def test_effect_layer_executes_animal_ability(self) -> None:
        state = self.make_state()
        player = state["players"]["p1"]
        cells = _find_placement(state, "p1", "standard_enclosure", 5)
        enclosure = _place_building(
            state, "p1", {"building_type": "standard_enclosure", "size": 5, "cells": cells}, [], free=True,
        )
        self.add_hand_card(state, "p1", "401")
        self.set_slot(state, "p1", "animals", 2)
        player["money"] = 50
        hand_before = len(player["hand"])
        _, error = ArkNovaGame.apply_action(
            state, "p1", {"type": "animals", "plays": [{"card_id": "401", "enclosure_id": enclosure["id"]}]},
        )
        self.assertIsNone(error)
        # One card was played and Sprint drew three.
        self.assertEqual(len(state["players"]["p1"]["hand"]), hand_before + 2)

    def test_final_target_track_formula_matches_rulebook_examples(self) -> None:
        self.assertEqual(_target_appeal(16), 76)
        self.assertEqual(_target_appeal(18), 70)
        self.assertEqual(_target_appeal(20), 64)
        self.assertEqual(_target_appeal(23), 55)
        self.assertEqual(_target_appeal(29), 37)
        self.assertEqual(_target_appeal(41), 1)

    def test_map_rewards_are_complete_and_bonus_tokens_are_shared(self) -> None:
        state = self.make_state()
        self.assertEqual(len(MAP_REWARDS), 7)
        self.assertEqual(len(state["bonus_tokens"]["5"]), 2)
        self.assertEqual(len(state["bonus_tokens"]["8"]), 2)
        view = ArkNovaGame.get_public_view(state, "p1")
        self.assertEqual(len(view["bonus_tokens"]["5"]), 2)

    def test_forced_extra_action_rejects_x_tokens_when_disallowed(self) -> None:
        state = self.make_state()
        state["players"]["p1"]["x_tokens"] = 2
        state["forced_action"] = {
            "player_id": "p1",
            "action": "cards",
            "strength": 3,
            "move_after": False,
            "allow_x_alternative": False,
        }
        before = copy.deepcopy(state)
        _, error = ArkNovaGame.apply_action(
            state,
            "p1",
            {"type": "cards", "mode": "draw", "x_tokens": 1},
        )
        self.assertIn("cannot modify", error or "")
        self.assertEqual(state, before)

    def test_bot_can_complete_setup_and_choose_an_action(self) -> None:
        state = ArkNovaGame.init_game(
            {"seed": 3},
            [{"player_id": "p1", "seat": 0}, {"player_id": "p2", "seat": 1}],
        )
        action = ArkNovaGame.bot_move(state, "p1")
        self.assertEqual(action["type"], "keep_initial_cards")
        for player_id in ("p1", "p2"):
            action = ArkNovaGame.bot_move(state, player_id)
            _, error = ArkNovaGame.apply_action(state, player_id, action)
            self.assertIsNone(error)
        action = ArkNovaGame.bot_move(state, "p1")
        self.assertIn(action["type"], ArkNovaGame.get_legal_actions(state, "p1"))


if __name__ == "__main__":
    unittest.main()
