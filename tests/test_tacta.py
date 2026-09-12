import math
import unittest

from game.registry import get_game
from game.tacta import (
    CATALOG,
    SUITS,
    TEMPLATES,
    TactaGame,
    _template_connectors,
    calculate_scores,
    enumerate_legal_placements,
)


def players(count=2):
    return [
        {"player_id": f"p{index}", "name": f"Player {index + 1}", "seat": index, "is_bot": False}
        for index in range(count)
    ]


def action_for(candidate, revision):
    return {
        "type": "place_card",
        "deck_end": candidate["deck_end"],
        "face": candidate["face"],
        "source_connector_id": candidate["source_connector_id"],
        "target_card_id": candidate["target_card_id"],
        "target_connector_id": candidate["target_connector_id"],
        "symmetry_index": candidate["symmetry_index"],
        "board_revision": revision,
    }


class TactaCatalogTests(unittest.TestCase):
    def test_catalog_has_complete_original_compatible_set(self):
        self.assertEqual(CATALOG["catalog_status"], "original-compatible-set")
        self.assertEqual(len(CATALOG["templates"]), 18)
        self.assertEqual(
            {(template["suit"], template["value"]) for template in CATALOG["templates"]},
            {(suit, value) for suit in SUITS for value in range(1, 7)},
        )
        for template in CATALOG["templates"]:
            self.assertEqual(
                template["value"],
                sum(connector["dots"] for connector in template["connectors"]),
            )
            for connector in template["connectors"]:
                self.assertIn(connector["slot"], CATALOG["slots"])

    def test_back_face_mirrors_connector_geometry(self):
        front = _template_connectors("circle_1", "front")
        back = _template_connectors("circle_1", "back")
        width = CATALOG["card_size"]["width"]
        self.assertEqual(len(front), len(back))
        for front_connector, back_connector in zip(front, back):
            self.assertEqual(front_connector["connector_id"], back_connector["connector_id"])
            for front_point, back_point in zip(front_connector["polygon"], back_connector["polygon"]):
                self.assertAlmostEqual(front_point[0] + back_point[0], width)
                self.assertAlmostEqual(front_point[1], back_point[1])


class TactaGameTests(unittest.TestCase):
    def test_registration_and_standard_setup(self):
        definition = get_game("tacta")
        self.assertIsNotNone(definition)
        self.assertEqual((definition.min_players, definition.max_players), (2, 6))
        state = TactaGame.init_game({"seed": 42}, players(3))
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(len(state["placed_cards"]), 1)
        self.assertEqual(len({pdata["color"] for pdata in state["players"].values()}), 3)
        self.assertTrue(all(len(pdata["deck"]) == 18 for pdata in state["players"].values()))
        repeated = TactaGame.init_game({"seed": 42}, players(3))
        self.assertEqual(state["start_player"], repeated["start_player"])
        self.assertEqual(
            [card["card_id"] for card in state["players"]["p0"]["deck"]],
            [card["card_id"] for card in repeated["players"]["p0"]["deck"]],
        )

    def test_server_generates_non_right_angle_placements_and_rejects_stale_preview(self):
        state = TactaGame.init_game({"seed": 7}, players())
        player_id = state["current_turn"]
        candidates = enumerate_legal_placements(state, player_id)
        self.assertTrue(candidates)
        angled = [
            candidate
            for candidate in candidates
            if abs((math.degrees(math.atan2(candidate["matrix"][1], candidate["matrix"][0])) % 90.0)) > 0.1
        ]
        self.assertTrue(angled, "the geometry set must exercise arbitrary-angle snapping")
        deck_size = len(state["players"][player_id]["deck"])
        _, error = TactaGame.apply_action(state, player_id, action_for(angled[0], state["board_revision"] + 1))
        self.assertIn("board changed", error)
        self.assertEqual(len(state["players"][player_id]["deck"]), deck_size)
        events, error = TactaGame.apply_action(state, player_id, action_for(angled[0], state["board_revision"]))
        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "tacta:card_placed")
        self.assertEqual(len(state["placed_cards"]), 2)
        self.assertEqual(sum(state["live_scores"].values()), TEMPLATES[angled[0]["template_id"]]["value"])

    def test_public_view_only_reveals_viewers_deck_ends(self):
        state = TactaGame.init_game({"seed": "privacy"}, players(2))
        view = TactaGame.get_public_view(state, "p0")
        own_ids = {card["card_id"] for card in view["outer_cards"]}
        self.assertEqual(own_ids, {state["players"]["p0"]["deck"][0]["card_id"], state["players"]["p0"]["deck"][-1]["card_id"]})
        opponent_ids = {card["card_id"] for card in state["players"]["p1"]["deck"]}
        self.assertTrue(own_ids.isdisjoint(opponent_ids))
        self.assertNotIn("deck", view["players"][1])
        self.assertNotIn("seed", view)

    def test_covering_connector_removes_its_dots_from_owner_score(self):
        state = TactaGame.init_game({"seed": 3}, players(2))
        player_id = state["current_turn"]
        candidate = enumerate_legal_placements(state, player_id)[0]
        _, error = TactaGame.apply_action(state, player_id, action_for(candidate, 0))
        self.assertIsNone(error)
        placed = state["placed_cards"][-1]
        connector = max(
            _template_connectors(placed["template_id"], placed["face"]),
            key=lambda item: item["dots"],
        )
        before = calculate_scores(state)[player_id]
        placed["covered_connectors"][connector["connector_id"]] = "fixture"
        after = calculate_scores(state)[player_id]
        self.assertEqual(before - after, connector["dots"])

    def test_source_connector_stays_exposed_for_a_cover_chain(self):
        state = TactaGame.init_game({"seed": 1}, players(2))
        first_player = state["current_turn"]
        first = enumerate_legal_placements(state, first_player)[0]
        _, error = TactaGame.apply_action(state, first_player, action_for(first, 0))
        self.assertIsNone(error)
        placed = state["placed_cards"][-1]
        next_candidates = enumerate_legal_placements(state, state["current_turn"])
        stacked = [
            candidate
            for candidate in next_candidates
            if candidate["target_card_id"] == placed["card_id"]
            and candidate["target_connector_id"] == placed["source_connector_id"]
        ]
        self.assertTrue(stacked)

    def test_isolated_placement_is_only_available_without_a_connection(self):
        state = TactaGame.init_game({"seed": 5}, players(2))
        player_id = state["current_turn"]
        _, error = TactaGame.apply_action(
            state,
            player_id,
            {
                "type": "place_isolated",
                "deck_end": "top",
                "face": "front",
                "isolated_slot_id": "iso_0_0",
                "board_revision": 0,
            },
        )
        self.assertEqual(error, "a connected placement is available")
        state["placed_cards"] = []
        events, error = TactaGame.apply_action(
            state,
            player_id,
            {
                "type": "place_isolated",
                "deck_end": "top",
                "face": "front",
                "isolated_slot_id": "iso_0_0",
                "board_revision": 0,
            },
        )
        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "tacta:card_placed")
        self.assertIsNone(state["placed_cards"][0]["parent_card_id"])

    def test_quick_and_invalid_mode_configuration(self):
        state = TactaGame.init_game(
            {"mode": "quick", "active_suits": ["triangle"], "seed": 4},
            players(2),
        )
        self.assertTrue(all(len(pdata["deck"]) == 6 for pdata in state["players"].values()))
        with self.assertRaises(ValueError):
            TactaGame.init_game({"mode": "quick", "active_suits": SUITS}, players(2))
        with self.assertRaises(ValueError):
            TactaGame.init_game({"mode": "sabotage", "active_suits": ["circle"]}, players(2))

    def test_sabotage_passes_simultaneously_and_keeps_printed_owner(self):
        state = TactaGame.init_game(
            {"mode": "sabotage", "active_suits": ["circle", "triangle"], "seed": 9},
            players(3),
        )
        self.assertEqual(state["phase"], "sabotage_choose")
        TactaGame.apply_action(state, "p0", {"type": "choose_pass_suit", "suit": "circle"})
        private_view = TactaGame.get_public_view(state, "p1")
        self.assertIsNone(private_view["your_pass_suit"])
        self.assertNotIn("pass_suit", private_view["players"][0])
        TactaGame.apply_action(state, "p1", {"type": "choose_pass_suit", "suit": "triangle"})
        events, error = TactaGame.apply_action(state, "p2", {"type": "choose_pass_suit", "suit": "circle"})
        self.assertIsNone(error)
        self.assertEqual(events[-1]["type"], "tacta:sabotage_started")
        self.assertEqual(state["phase"], "playing")
        self.assertTrue(all(len(pdata["deck"]) == 12 for pdata in state["players"].values()))
        for player_id, pdata in state["players"].items():
            self.assertTrue(all(card["controller_id"] == player_id for card in pdata["deck"]))
        self.assertTrue(any(card["owner_color"] != state["players"]["p0"]["color"] for card in state["players"]["p0"]["deck"]))

    def test_limited_space_waits_for_every_player_between_rounds(self):
        state = TactaGame.init_game({"mode": "limited_space", "seed": 11}, players(2))
        first_suit = state["suit_schedule"][0]
        while state["phase"] == "playing":
            player_id = state["current_turn"]
            action = TactaGame.bot_move(state, player_id)
            _, error = TactaGame.apply_action(state, player_id, action)
            self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(state["last_round_summary"]["suit"], first_suit)
        final_board_count = len(state["placed_cards"])
        TactaGame.apply_action(state, "p0", {"type": "next_round"})
        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(len(state["placed_cards"]), final_board_count)
        TactaGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["round_index"], 1)
        self.assertEqual(len(state["placed_cards"]), 1)

    def test_serialization_is_detached(self):
        state = TactaGame.init_game({"seed": 2}, players(2))
        payload = TactaGame.serialize(state)
        payload["players"]["p0"]["deck"].clear()
        self.assertEqual(len(state["players"]["p0"]["deck"]), 18)
        restored = TactaGame.deserialize(state)
        restored["placed_cards"].clear()
        self.assertEqual(len(state["placed_cards"]), 1)


if __name__ == "__main__":
    unittest.main()
