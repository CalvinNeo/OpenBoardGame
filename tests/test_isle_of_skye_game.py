import unittest
import importlib.util
from collections import defaultdict
from pathlib import Path
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parent.parent / "game" / "isle_of_skye.py"
MODULE_SPEC = importlib.util.spec_from_file_location("isle_of_skye_test_module", MODULE_PATH)
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
assert MODULE_SPEC is not None and MODULE_SPEC.loader is not None
MODULE_SPEC.loader.exec_module(MODULE)
IsleOfSkyeGame = MODULE.IsleOfSkyeGame
_find_legal_placement = MODULE._find_legal_placement
_analyze_territory = MODULE._analyze_territory
_finalize_game = MODULE._finalize_game
_score_scoring_tile = MODULE._score_scoring_tile
TILE_DEFS_BY_ID = MODULE.TILE_DEFS_BY_ID
LANDSCAPE_TILE_IDS = MODULE.LANDSCAPE_TILE_IDS


class IsleOfSkyeGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    @staticmethod
    def _analysis(**overrides):
        analysis = {
            "occupied_coords": set(),
            "components": [],
            "total_icon_counts": defaultdict(int),
            "tiles_with_whisky": set(),
            "connected_whisky_tiles": set(),
            "animals_near_farms": 0,
            "connected_cattle": 0,
            "connected_road_tiles": set(),
            "scrolls": [],
        }
        analysis.update(overrides)
        return analysis

    @staticmethod
    def _component(
        terrain,
        *,
        completed=False,
        tile_count=1,
        icon_counts=None,
        adjacent_lighthouses=0,
        offset=0,
    ):
        return {
            "terrain": terrain,
            "completed": completed,
            "tiles": {(offset + index, 0) for index in range(tile_count)},
            "icon_counts": defaultdict(int, icon_counts or {}),
            "adjacent_lighthouses": adjacent_lighthouses,
        }

    def _score_fixture(self, scoring_tile_id, p1_analysis, p2_analysis, *, gold=(5, 5)):
        state = IsleOfSkyeGame.init_game({"seed": 101}, self._players())
        state["players"]["p1"]["gold"] = gold[0]
        state["players"]["p2"]["gold"] = gold[1]
        results = _score_scoring_tile(
            state,
            scoring_tile_id,
            {"p1": p1_analysis, "p2": p2_analysis},
        )
        return results["p1"]["points"], results["p2"]["points"]

    def test_init_starts_round_with_income_and_drawn_tiles(self):
        state = IsleOfSkyeGame.init_game({"seed": 7}, self._players())

        self.assertEqual(state["phase"], "price_secret")
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["buy_order"], ["p1", "p2"])
        self.assertEqual(state["current_turn"], None)
        self.assertEqual(len(state["bag"]), 67)

        for player_id in ("p1", "p2"):
            player_state = state["players"][player_id]
            self.assertEqual(player_state["gold"], 5)
            self.assertEqual(player_state["score"], 0)
            self.assertEqual(len(player_state["territory"]), 1)
            self.assertEqual(len(player_state["round"]["drawn_tile_ids"]), 3)

    def test_drawn_faces_are_public_but_pricing_and_money_are_hidden(self):
        state = IsleOfSkyeGame.init_game({"seed": 3}, self._players())

        p1_drawn = list(state["players"]["p1"]["round"]["drawn_tile_ids"])
        events, error = IsleOfSkyeGame.apply_action(
            state,
            "p1",
            {
                "type": "submit_prices",
                "discard_tile_id": p1_drawn[2],
                "priced_tiles": [
                    {"tile_id": p1_drawn[0], "price": 1},
                    {"tile_id": p1_drawn[1], "price": 2},
                ],
            },
        )
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "isle_of_skye:submit_prices" for event in events))
        self.assertEqual(state["phase"], "price_secret")

        bob_view = IsleOfSkyeGame.get_public_view(state, "p2")
        alice_public = next(player for player in bob_view["players"] if player["player_id"] == "p1")
        self.assertEqual(alice_public["drawn_tile_ids"], p1_drawn)
        self.assertIsNone(alice_public["discard_tile_id"])
        self.assertEqual(alice_public["prices"], {})
        self.assertEqual(alice_public["sale_tiles"], [])
        self.assertIsNone(alice_public["gold"])
        self.assertIsNone(alice_public["available_gold"])
        self.assertIsNone(alice_public["reserved_gold"])
        bob_private = next(player for player in bob_view["players"] if player["player_id"] == "p2")
        self.assertEqual(bob_private["gold"], 5)

        p2_drawn = list(state["players"]["p2"]["round"]["drawn_tile_ids"])
        events, error = IsleOfSkyeGame.apply_action(
            state,
            "p2",
            {
                "type": "submit_prices",
                "discard_tile_id": p2_drawn[2],
                "priced_tiles": [
                    {"tile_id": p2_drawn[0], "price": 1},
                    {"tile_id": p2_drawn[1], "price": 1},
                ],
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "buy")
        self.assertEqual(state["current_turn"], "p1")

        bob_view = IsleOfSkyeGame.get_public_view(state, "p2")
        alice_public = next(player for player in bob_view["players"] if player["player_id"] == "p1")
        self.assertEqual(len(alice_public["sale_tiles"]), 2)

    def test_buy_pass_then_build_waits_for_every_player_before_next_round(self):
        state = IsleOfSkyeGame.init_game({"seed": 9}, self._players())

        for player_id in ("p1", "p2"):
            drawn = list(state["players"][player_id]["round"]["drawn_tile_ids"])
            events, error = IsleOfSkyeGame.apply_action(
                state,
                player_id,
                {
                    "type": "submit_prices",
                    "discard_tile_id": drawn[2],
                    "priced_tiles": [
                        {"tile_id": drawn[0], "price": 1},
                        {"tile_id": drawn[1], "price": 1},
                    ],
                },
            )
            self.assertIsNone(error)

        events, error = IsleOfSkyeGame.apply_action(state, "p1", {"type": "pass_buy"})
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")

        events, error = IsleOfSkyeGame.apply_action(state, "p2", {"type": "pass_buy"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "build")

        for player_id in ("p1", "p2"):
            while state["phase"] == "build" and not state["players"][player_id]["round"]["build_done"]:
                tile_id = state["players"][player_id]["round"]["build_queue"][0]
                placement = _find_legal_placement(state["players"][player_id], tile_id)
                if placement:
                    events, error = IsleOfSkyeGame.apply_action(
                        state,
                        player_id,
                        {"type": "place_tile", "tile_id": tile_id, **placement},
                    )
                else:
                    events, error = IsleOfSkyeGame.apply_action(
                        state,
                        player_id,
                        {"type": "return_tile", "tile_id": tile_id},
                    )
                self.assertIsNone(error)

        self.assertEqual(state["round"], 1)
        self.assertEqual(state["phase"], "round_review")
        self.assertIsNotNone(state["last_scoring"])

        events, error = IsleOfSkyeGame.apply_action(state, "p1", {"type": "ready_next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_review")
        self.assertEqual(state["ready_player_ids"], ["p1"])

        events, error = IsleOfSkyeGame.apply_action(state, "p2", {"type": "ready_next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "price_secret")

    def test_five_player_game_uses_five_round_track(self):
        players = [
            {"player_id": f"p{index}", "name": f"Player {index}", "seat": index - 1}
            for index in range(1, 6)
        ]
        state = IsleOfSkyeGame.init_game({"seed": 11}, players)
        view = IsleOfSkyeGame.get_public_view(state, "p1")

        self.assertEqual(IsleOfSkyeGame.max_players, 5)
        self.assertEqual(view["round_limit"], 5)
        self.assertEqual(len(state["bag"]), 58)
        self.assertEqual(view["round_track"][2]["active_slots"], ["B", "D"])
        self.assertEqual(view["round_track"][5]["active_slots"], ["A", "B", "C", "D"])
        slot_counts = {slot: 0 for slot in "ABCD"}
        for round_meta in view["round_track"].values():
            for slot in round_meta["active_slots"]:
                slot_counts[slot] += 1
        self.assertEqual(slot_counts, {slot: 3 for slot in "ABCD"})

    def test_catalog_contains_all_reviewed_base_tiles(self):
        self.assertEqual(len(LANDSCAPE_TILE_IDS), 73)
        self.assertEqual(
            TILE_DEFS_BY_ID["restplattchen1-3-2-0-1"]["edges"],
            {"N": "water", "E": "mountain", "S": "mountain", "W": "pasture"},
        )
        self.assertEqual(
            TILE_DEFS_BY_ID["restplattchen1-3-2-0-1"]["road_exits"],
            ["E", "S", "W"],
        )
        scroll_counts = {scroll_type: 0 for scroll_type in MODULE.SCROLL_TYPES}
        for tile_def in TILE_DEFS_BY_ID.values():
            for icon in tile_def["icons"]:
                if icon["type"] == "scroll":
                    scroll_counts[icon["scroll_type"]] += 1
        self.assertEqual(scroll_counts, {scroll_type: 2 for scroll_type in MODULE.SCROLL_TYPES})

    def test_all_sixteen_scoring_tiles_have_formula_fixtures(self):
        component = self._component
        analysis = self._analysis
        cases = [
            (
                "square_plots",
                analysis(occupied_coords={(0, 0), (1, 0), (0, 1), (1, 1)}),
                analysis(occupied_coords={(0, 0), (0, 1), (0, 2)}),
                (2, 0),
                (5, 5),
            ),
            (
                "completionist",
                analysis(
                    components=[
                        component("pasture", completed=True),
                        component("water", completed=True),
                        component("mountain", completed=False),
                    ]
                ),
                analysis(components=[component("pasture", completed=False)]),
                (2, 0),
                (5, 5),
            ),
            (
                "sheepy_sheep",
                analysis(total_icon_counts=defaultdict(int, {"sheep": 4})),
                analysis(total_icon_counts=defaultdict(int, {"sheep": 1})),
                (4, 1),
                (5, 5),
            ),
            (
                "ultra_completionist",
                analysis(
                    components=[
                        component("pasture", completed=True, tile_count=3),
                        component("water", completed=True, tile_count=2),
                        component("mountain", completed=False, tile_count=4),
                    ]
                ),
                analysis(components=[component("pasture", completed=True, tile_count=4)]),
                (3, 3),
                (5, 5),
            ),
            (
                "brochs_in_mountains",
                analysis(
                    components=[
                        component("mountain", icon_counts={"broch": 1}),
                        component("mountain", icon_counts={"broch": 2}),
                        component("mountain", icon_counts={"broch": 4}),
                        component("pasture", icon_counts={"broch": 2}),
                    ]
                ),
                analysis(components=[component("mountain")]),
                (10, 0),
                (5, 5),
            ),
            (
                "buildings_of_three",
                analysis(total_icon_counts=defaultdict(int, {"broch": 2, "farm": 3, "lighthouse": 4})),
                analysis(total_icon_counts=defaultdict(int, {"broch": 1, "farm": 0, "lighthouse": 3})),
                (10, 0),
                (5, 5),
            ),
            (
                "barrels_of_whisky",
                analysis(tiles_with_whisky={(0, 0), (1, 0), (2, 0)}),
                analysis(tiles_with_whisky={(0, 0)}),
                (5, 2),
                (5, 5),
            ),
            (
                "clan_armada",
                analysis(total_icon_counts=defaultdict(int, {"ship": 2})),
                analysis(total_icon_counts=defaultdict(int, {"ship": 2})),
                (5, 5),
                (5, 5),
            ),
            (
                "animals_near_farms",
                analysis(animals_near_farms=3),
                analysis(animals_near_farms=1),
                (3, 1),
                (5, 5),
            ),
            (
                "pot_of_gold",
                analysis(),
                analysis(),
                (5, 2),
                (7, 3),
            ),
            (
                "cattle_on_the_road",
                analysis(connected_cattle=2),
                analysis(connected_cattle=1),
                (4, 2),
                (5, 5),
            ),
            (
                "ships_beware",
                analysis(
                    components=[
                        component("water", icon_counts={"ship": 2}, adjacent_lighthouses=1),
                        component("water", icon_counts={"ship": 1}),
                        component("mountain", icon_counts={"ship": 1}, adjacent_lighthouses=1),
                    ]
                ),
                analysis(
                    components=[
                        component("water", icon_counts={"ship": 1}, adjacent_lighthouses=1),
                        component("water", icon_counts={"ship": 3}, adjacent_lighthouses=2),
                    ]
                ),
                (3, 6),
                (5, 5),
            ),
            (
                "all_roads_lead_to_home",
                analysis(connected_road_tiles={(0, 0), (0, 1), (1, 1), (2, 1)}),
                analysis(connected_road_tiles={(0, 0)}),
                (4, 1),
                (5, 5),
            ),
            (
                "vertical_greatness",
                analysis(occupied_coords={(0, 0), (0, 1), (0, 2), (1, 0), (1, 2), (1, 3), (1, 4)}),
                analysis(occupied_coords={(0, 0), (0, 1)}),
                (6, 0),
                (5, 5),
            ),
            (
                "on_largest_pond",
                analysis(
                    components=[
                        component("water", completed=True, tile_count=3),
                        component("water", completed=True, tile_count=2),
                        component("water", completed=False, tile_count=5),
                    ]
                ),
                analysis(components=[component("water", completed=False, tile_count=4)]),
                (6, 0),
                (5, 5),
            ),
            (
                "mountain_ranges",
                analysis(
                    components=[
                        component("mountain", completed=True),
                        component("mountain", completed=True),
                        component("mountain", completed=False),
                        component("water", completed=True),
                    ]
                ),
                analysis(components=[]),
                (4, 0),
                (5, 5),
            ),
        ]

        self.assertEqual({case[0] for case in cases}, {tile["id"] for tile in MODULE.SCORING_TILE_DEFS})
        for scoring_tile_id, p1_analysis, p2_analysis, expected, gold in cases:
            with self.subTest(scoring_tile_id=scoring_tile_id):
                self.assertEqual(
                    self._score_fixture(scoring_tile_id, p1_analysis, p2_analysis, gold=gold),
                    expected,
                )

    def test_catalog_topology_distinguishes_joined_separate_and_internal_areas(self):
        joined = _analyze_territory(
            {
                "territory": [
                    {"tile_id": "turmplattchen-0-0-1-1-1-0", "x": 0, "y": 0, "rotation": 0, "order": 0}
                ]
            }
        )
        joined_mountains = [component for component in joined["components"] if component["terrain"] == "mountain"]
        self.assertEqual(len(joined_mountains), 1)
        self.assertEqual(joined_mountains[0]["icon_counts"]["broch"], 1)

        separate = _analyze_territory(
            {
                "territory": [
                    {"tile_id": "turmle2", "x": 0, "y": 0, "rotation": 0, "order": 0}
                ]
            }
        )
        self.assertEqual(len([component for component in separate["components"] if component["terrain"] == "water"]), 2)
        internal_mountains = [
            component
            for component in separate["components"]
            if component["terrain"] == "mountain" and component["completed"]
        ]
        self.assertEqual(len(internal_mountains), 1)
        self.assertEqual(internal_mountains[0]["icon_counts"]["broch"], 1)

    def test_all_scroll_formulas_and_completed_area_doubling(self):
        state = IsleOfSkyeGame.init_game({"seed": 103}, self._players())
        state["players"]["p1"]["score"] = 0
        state["players"]["p1"]["gold"] = 9
        state["players"]["p2"]["score"] = 0
        state["players"]["p2"]["gold"] = 0
        p1_analysis = self._analysis(
            total_icon_counts=defaultdict(
                int,
                {"sheep": 5, "ship": 5, "cattle": 3, "broch": 2, "farm": 4, "lighthouse": 1},
            ),
            tiles_with_whisky={(index, 0) for index in range(5)},
            scrolls=[
                {"scroll_type": "per_2_sheep", "doubled": False},
                {"scroll_type": "per_2_whisky_tiles", "doubled": True},
                {"scroll_type": "per_2_ships", "doubled": False},
                {"scroll_type": "per_cattle", "doubled": True},
                {"scroll_type": "per_broch", "doubled": False},
                {"scroll_type": "per_farm", "doubled": True},
                {"scroll_type": "per_lighthouse", "doubled": False},
            ],
        )
        p2_analysis = self._analysis()

        with mock.patch.object(MODULE, "_analyze_territory", side_effect=[p1_analysis, p2_analysis]):
            _finalize_game(state, [])

        self.assertEqual(state["final_scoring"]["p1"]["scroll_points"], 25)
        self.assertEqual(state["final_scoring"]["p1"]["coin_points"], 1)
        self.assertEqual(state["final_scoring"]["p1"]["final_score"], 26)
        self.assertEqual(state["winner"], ["p1"])

    def test_discarded_tiles_are_shuffled_back_into_bag(self):
        state = IsleOfSkyeGame.init_game({"seed": 23}, self._players())
        for player_id in ("p1", "p2"):
            drawn = list(state["players"][player_id]["round"]["drawn_tile_ids"])
            events, error = IsleOfSkyeGame.apply_action(
                state,
                player_id,
                {
                    "type": "submit_prices",
                    "discard_tile_id": drawn[2],
                    "priced_tiles": [
                        {"tile_id": drawn[0], "price": 1},
                        {"tile_id": drawn[1], "price": 1},
                    ],
                },
            )
            self.assertIsNone(error)
        self.assertEqual(state["shuffle_counter"], 1)

    def test_unplaceable_tile_cannot_return_before_placeable_queue_mate(self):
        state = IsleOfSkyeGame.init_game({"seed": 31}, self._players())
        player_state = state["players"]["p1"]
        impossible_tile = "turmplattchen-0-0-2-1-1-0"
        placeable_tile = "turmplattchen-0-0-0-1-0-0"
        self.assertIsNone(_find_legal_placement(player_state, impossible_tile))
        self.assertIsNotNone(_find_legal_placement(player_state, placeable_tile))
        state["phase"] = "build"
        player_state["round"]["build_queue"] = [impossible_tile, placeable_tile]
        player_state["round"]["build_done"] = False

        events, error = IsleOfSkyeGame.apply_action(
            state,
            "p1",
            {"type": "return_tile", "tile_id": impossible_tile},
        )
        self.assertEqual(events, [])
        self.assertEqual(error, "place another queued tile before returning an unplaceable tile")

    def test_final_tie_uses_gold_left_after_conversion(self):
        state = IsleOfSkyeGame.init_game({"seed": 41}, self._players())
        state["players"]["p1"]["score"] = 10
        state["players"]["p2"]["score"] = 10
        state["players"]["p1"]["gold"] = 6
        state["players"]["p2"]["gold"] = 9
        events = []

        _finalize_game(state, events)

        self.assertEqual(state["players"]["p1"]["score"], 11)
        self.assertEqual(state["players"]["p2"]["score"], 11)
        self.assertEqual(state["winner"], ["p2"])

    def test_deserialize_migrates_legacy_round_state(self):
        state = IsleOfSkyeGame.init_game({"seed": 41}, self._players())
        for key in ("round_track_key", "rng_seed", "shuffle_counter", "ready_player_ids"):
            state.pop(key)

        migrated = IsleOfSkyeGame.deserialize(state)

        self.assertEqual(migrated["round_track_key"], "standard")
        self.assertEqual(migrated["rng_seed"], 41)
        self.assertEqual(migrated["shuffle_counter"], 0)
        self.assertEqual(migrated["ready_player_ids"], [])

    def test_final_round_waits_for_every_player_before_final_scoring(self):
        state = IsleOfSkyeGame.init_game({"seed": 43}, self._players())
        state["phase"] = "round_review"
        state["round"] = 6
        state["ready_player_ids"] = []

        events, error = IsleOfSkyeGame.apply_action(state, "p1", {"type": "ready_next_round"})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["phase"], "round_review")

        events, error = IsleOfSkyeGame.apply_action(state, "p2", {"type": "ready_next_round"})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "ended")
        self.assertTrue(any(event["type"] == "isle_of_skye:game_over" for event in events))

    def test_bots_can_finish_a_full_game(self):
        players = [
            {"player_id": "p1", "name": "Bot A", "seat": 0, "is_bot": True},
            {"player_id": "p2", "name": "Bot B", "seat": 1, "is_bot": True},
        ]
        state = IsleOfSkyeGame.init_game({"seed": 5}, players)

        for _ in range(400):
            if state.get("game_over"):
                break
            progressed = False
            for player_id in ("p1", "p2"):
                action = IsleOfSkyeGame.bot_move(state, player_id)
                if not action:
                    continue
                action = dict(action)
                action.pop("delay_ms", None)
                events, error = IsleOfSkyeGame.apply_action(state, player_id, action)
                self.assertIsNone(error)
                progressed = True
                break
            self.assertTrue(progressed, "Bot loop stalled before the game finished.")

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "ended")
        self.assertTrue(state["winner"])
        self.assertIsNotNone(state["final_scoring"])
        for player_id in ("p1", "p2"):
            self.assertIn("final_score", state["final_scoring"][player_id])

    def test_five_bots_can_finish_without_exhausting_the_bag(self):
        players = [
            {"player_id": f"p{index}", "name": f"Bot {index}", "seat": index - 1, "is_bot": True}
            for index in range(1, 6)
        ]
        state = IsleOfSkyeGame.init_game({"seed": 47}, players)

        for _ in range(1000):
            if state.get("game_over"):
                break
            progressed = False
            for player in players:
                player_id = player["player_id"]
                action = IsleOfSkyeGame.bot_move(state, player_id)
                if not action:
                    continue
                action = dict(action)
                action.pop("delay_ms", None)
                events, error = IsleOfSkyeGame.apply_action(state, player_id, action)
                self.assertIsNone(error)
                progressed = True
                break
            self.assertTrue(progressed, "Five-player bot loop stalled before the game finished.")

        self.assertTrue(state["game_over"])
        self.assertEqual(state["round"], 5)
        self.assertGreaterEqual(len(state["bag"]), 0)


if __name__ == "__main__":
    unittest.main()
