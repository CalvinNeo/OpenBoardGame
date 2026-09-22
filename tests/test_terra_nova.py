import copy
import json
import unittest
from unittest.mock import patch

from game import terra_nova as game
from game import terra_nova_data as data
from game.terra_nova import TerraNovaGame


class TerraNovaTests(unittest.TestCase):
    def new_game(self, factions=("djinn", "golems"), seed=17):
        players = [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": True} for i in range(len(factions))]
        state = TerraNovaGame.init_game({"seed": seed}, players)
        for faction in factions:
            self.act(state, state["current_turn"], "choose_faction", faction=faction)
        while state["phase"] in ("setup_house", "choose_bonus"):
            pid = state["current_turn"]
            action = TerraNovaGame.bot_move(state, pid)
            self.assertIsNotNone(action)
            self.assertIsNone(TerraNovaGame.apply_action(state, pid, action)[1])
        return state

    def act(self, state, pid, kind, **fields):
        action = {"type": kind, "round": state["round"], **fields}
        result, error = TerraNovaGame.apply_action(state, pid, action)
        self.assertIsNone(error, (action, error, state["phase"]))
        return result

    def fixture(self, faction="djinn", other="golems"):
        state = self.new_game((faction, other))
        pid = state["turn_order"][0]
        state["current_turn"], state["phase"] = pid, "action"
        for player in state["players"].values():
            player["buildings"] = dict.fromkeys(game.BUILDING_LIMITS, 0)
            player["coins"], player["score"], player["sailing"] = 40, 0, 0
            player["power"] = {"I": 0, "II": 0, "III": 8}
            player["towns"], player["special_used"] = [], []
        state["board"], state["bridges"], state["towns"] = [], [], []
        # Remove the temporary sailing bonus to make geometric tests explicit.
        for player in state["players"].values():
            if data.BONUS_TILES[player["bonus_tile"]].get("sailing_bonus"):
                replacement = next(b for b in state["bonus_market"] if not data.BONUS_TILES[b].get("sailing_bonus"))
                state["bonus_market"][player["bonus_tile"]] = state["bonus_market"].pop(replacement)
                player["bonus_tile"] = replacement
        return state, pid, state["turn_order"][1]

    def cell(self, state, cid, row, col, terrain, owner=None, building=None):
        cell = {"id": cid, "row": row, "col": col, "terrain": terrain, "owner": owner, "building": building, "town_id": None}
        state["board"].append(cell)
        if owner:
            state["players"][owner]["buildings"][building] += 1
        return cell

    def options(self, state, pid, kind=None):
        actions = [o["action"] for o in TerraNovaGame.get_public_view(state, pid)["action_options"]]
        return [a for a in actions if a["type"] == kind] if kind else actions

    def test_initial_setup_colors_counts_income_and_seed_privacy(self):
        for factions in (("djinn", "golems"), ("fairies", "goblins", "sun_worshippers"), ("merfolk", "golems", "fairies", "goblins")):
            state = self.new_game(factions)
            self.assertEqual(state["phase"], "action")
            self.assertEqual(len(state["bonus_market"]), 3)
            self.assertEqual(len(state["round_scoring"]), 5)
            for player in state["players"].values():
                self.assertEqual(player["buildings"]["house"], 3 if player["faction"] == "sun_worshippers" else 2)
                self.assertEqual(sum(player["power"].values()), 8)
                self.assertEqual(player["coins"], data.FACTIONS[player["faction"]]["starting_coins"] + player["last_income"]["coins"])
            view = TerraNovaGame.get_public_view(state, "spectator")
            self.assertEqual(view["action_options"], [])
            self.assertNotIn("seed", json.dumps(view))

    def test_color_pair_unavailable_and_setup_does_not_charge(self):
        state = TerraNovaGame.init_game({"seed": 1}, [{"player_id": "a"}, {"player_id": "b"}])
        self.act(state, state["current_turn"], "choose_faction", faction="djinn")
        factions = {a["faction"] for a in self.options(state, state["current_turn"], "choose_faction")}
        self.assertNotIn("merfolk", factions)
        self.act(state, state["current_turn"], "choose_faction", faction="golems")
        while state["phase"] == "setup_house":
            pid = state["current_turn"]
            self.assertIsNone(TerraNovaGame.apply_action(state, pid, self.options(state, pid)[0])[1])
        self.assertTrue(all(p["power"] == {"I": 2, "II": 2, "III": 4} for p in state["players"].values()))

    def test_power_cycles_do_not_burn_or_overflow(self):
        player = {"power": {"I": 2, "II": 2, "III": 4}}
        self.assertEqual(game.charge_power(player, 3), 3)
        self.assertEqual(player["power"], {"I": 0, "II": 3, "III": 5})
        game._spend_power(player, 4)
        self.assertEqual(player["power"], {"I": 4, "II": 3, "III": 1})
        self.assertEqual(game.charge_power(player, 50), 11)
        self.assertEqual(player["power"], {"I": 0, "II": 0, "III": 8})

    def test_paid_transform_and_house_cost(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "wasteland")
        self.act(state, pid, "build_transform", source="paid", cell_id="x1", build=True)
        self.assertEqual(state["players"][pid]["coins"], 24)
        self.assertEqual(state["board"][1]["terrain"], "lake")
        self.assertEqual(state["board"][1]["building"], "house")
        self.assertEqual(state["phase"], "post_action")

    def test_shipping_traverses_only_consecutive_river(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "river")
        self.cell(state, "x2", 0, 2, "river")
        self.cell(state, "x3", 0, 3, "forest")
        self.cell(state, "x4", 0, 4, "desert")
        state["players"][pid]["sailing"] = 1
        self.assertNotIn("x3", game.reachable_cells(state, pid))
        state["players"][pid]["sailing"] = 2
        self.assertIn("x3", game.reachable_cells(state, pid))
        self.assertNotIn("x4", game.reachable_cells(state, pid))

    def test_shipping_bonus_does_not_count_for_final_area(self):
        state, pid, _ = self.fixture()
        bonus = next(bid for bid, b in data.BONUS_TILES.items() if b.get("sailing_bonus"))
        state["players"][pid]["bonus_tile"] = bonus
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "river")
        self.cell(state, "x2", 0, 2, "lake", pid, "house")
        self.assertIn("x2", game.reachable_cells(state, pid, sources=["x0"]))
        self.assertNotIn("x2", game.reachable_cells(state, pid, True, ["x0"]))
        self.assertEqual(max(map(len, game._components(state, pid, True))), 1)

    def test_bridge_adjacency_discounts_upgrade_and_charges_per_building(self):
        state, pid, other = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "river")
        self.cell(state, "x2", 0, 2, "wasteland", other, "palace_left")
        state["bridges"] = [{"id": "test", "cell_ids": ["x0", "x2"], "owner": pid}]
        state["players"][other]["power"] = {"I": 2, "II": 2, "III": 4}
        state["players"][other]["passed"] = True
        self.act(state, pid, "upgrade", cell_id="x0", building="trading_post", source="paid")
        self.assertEqual(state["players"][pid]["coins"], 33)
        self.assertEqual(state["players"][other]["power"], {"I": 1, "II": 3, "III": 4})

    def test_sailing_does_not_discount_or_charge(self):
        state, pid, other = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "river")
        self.cell(state, "x2", 0, 2, "wasteland", other, "house")
        state["players"][pid]["sailing"] = 1
        before = copy.deepcopy(state["players"][other]["power"])
        self.act(state, pid, "upgrade", cell_id="x0", building="trading_post", source="paid")
        self.assertEqual(state["players"][pid]["coins"], 30)
        self.assertEqual(state["players"][other]["power"], before)

    def test_two_spades_freeze_reach_and_limit_one_house(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "forest")
        self.cell(state, "x2", 0, 2, "forest")
        self.cell(state, "x3", 1, 0, "forest")
        self.act(state, pid, "start_terraform", source="spade_2")
        self.assertNotIn("x2", state["pending"]["reachable"])
        self.act(state, pid, "terraform_target", source="spade_2", cell_id="x1", build=True)
        options = self.options(state, pid, "terraform_target")
        self.assertTrue(options)
        self.assertTrue(all(a["cell_id"] != "x2" and not a["build"] for a in options))
        self.act(state, pid, "terraform_target", source="spade_2", cell_id="x3", build=False)
        self.assertEqual(state["phase"], "post_action")
        self.assertEqual(state["players"][pid]["coins"], 36)
        self.assertIn("spade_2", state["power_used"])

    def test_two_spades_can_build_first_hex_after_transforming_both(self):
        state, pid, _ = self.fixture()
        self.cell(state, "home", 0, 0, "lake", pid, "house")
        self.cell(state, "first", 0, 1, "forest")
        self.cell(state, "second", 1, 0, "forest")
        self.cell(state, "untouched", 0, -1, "lake")
        state["round_scoring"][0] = next(t for t, tile in data.ROUND_TILES.items() if tile["event"] == "spade")
        self.act(state, pid, "start_terraform", source="spade_2")
        self.act(state, pid, "terraform_target", source="spade_2", cell_id="first", build=False)
        self.act(state, pid, "terraform_target", source="spade_2", cell_id="second", build=False)
        self.assertEqual(state["phase"], "terraform")
        self.assertEqual(state["pending"]["remaining"], 0)
        self.assertEqual({a["cell_id"] for a in self.options(state, pid, "terraform_build")}, {"first", "second"})
        original = copy.deepcopy(state)
        bad = {"type": "terraform_build", "round": 1, "cell_id": "untouched"}
        self.assertIsNotNone(TerraNovaGame.apply_action(state, pid, bad)[1])
        self.assertEqual(state, original)
        self.act(state, pid, "terraform_build", cell_id="first")
        self.assertEqual(state["phase"], "post_action")
        self.assertEqual(state["players"][pid]["coins"], 36)
        self.assertEqual(state["players"][pid]["score"], 4)
        self.assertEqual(game._cell_map(state)["first"]["building"], "house")
        self.assertIsNone(game._cell_map(state)["second"]["building"])
        self.assertFalse(self.options(state, pid, "terraform_build"))

    def test_two_spades_deferred_house_may_precede_second_transform(self):
        state, pid, _ = self.fixture()
        self.cell(state, "home", 0, 0, "lake", pid, "house")
        self.cell(state, "first", 0, 1, "forest")
        self.cell(state, "second", 1, 0, "forest")
        self.act(state, pid, "start_terraform", source="spade_2")
        self.act(state, pid, "terraform_target", source="spade_2", cell_id="first", build=False)
        self.act(state, pid, "terraform_build", cell_id="first")
        self.assertEqual(state["phase"], "terraform")
        self.assertTrue(all(not a["build"] for a in self.options(state, pid, "terraform_target")))
        self.act(state, pid, "terraform_target", source="spade_2", cell_id="second", build=False)
        self.assertEqual(state["phase"], "post_action")
        self.assertEqual(state["players"][pid]["coins"], 36)

    def test_deferred_two_spade_house_survives_json_save(self):
        state = self.new_game()
        pid = state["current_turn"]
        state["players"][pid]["power"] = {"I": 0, "II": 0, "III": 8}
        state["players"][pid]["coins"] = 40
        before = copy.deepcopy(state)
        self.act(state, pid, "start_terraform", source="spade_2")
        target = next(a for a in self.options(state, pid, "terraform_target") if not a["build"])
        self.assertIsNone(TerraNovaGame.apply_action(state, pid, target)[1])
        targets = [a for a in self.options(state, pid, "terraform_target") if not a["build"]]
        if targets:
            self.assertIsNone(TerraNovaGame.apply_action(state, pid, targets[0])[1])
        self.assertEqual(state["phase"], "terraform")
        self.assertTrue(self.options(state, pid, "terraform_build"))
        restored = TerraNovaGame.deserialize(json.loads(json.dumps(TerraNovaGame.serialize(state))))
        self.assertEqual(restored, state)
        build = self.options(restored, pid, "terraform_build")[0]
        self.assertIsNone(TerraNovaGame.apply_action(restored, pid, build)[1])
        self.assertEqual(restored["players"][pid]["buildings"]["house"], before["players"][pid]["buildings"]["house"] + 1)

    def test_one_spade_top_up_and_two_spades_cannot_top_up(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "wasteland")
        self.act(state, pid, "start_terraform", source="spade_1")
        self.act(state, pid, "terraform_target", source="spade_1", cell_id="x1", build=True)
        self.assertEqual(state["players"][pid]["coins"], 30)
        self.assertEqual(state["players"][pid]["power"]["III"], 4)

    def test_golem_and_goblin_shovel_abilities(self):
        state, pid, _ = self.fixture("golems", "djinn")
        self.cell(state, "x0", 0, 0, "wasteland", pid, "palace_left")
        self.assertEqual(game.spade_cost(state, pid, "lake"), 1)
        state, pid, _ = self.fixture("goblins", "djinn")
        self.cell(state, "x0", 0, 0, "swamp", pid, "house")
        self.cell(state, "x1", 0, 1, "lake")
        state["players"][pid]["power"] = {"I": 4, "II": 0, "III": 4}
        self.act(state, pid, "build_transform", source="paid", cell_id="x1", build=False)
        self.assertEqual(state["players"][pid]["power"], {"I": 2, "II": 2, "III": 4})

    def test_ifrit_power_discount_does_not_discount_exchange(self):
        state, pid, _ = self.fixture("ifrits", "djinn")
        self.cell(state, "x0", 0, 0, "wasteland", pid, "house")
        self.act(state, pid, "power_coins", source="coins")
        self.assertEqual(state["players"][pid]["power"]["III"], 5)
        self.act(state, pid, "exchange_power", amount=2)
        self.assertEqual(state["players"][pid]["power"]["III"], 3)
        self.assertEqual(state["players"][pid]["coins"], 49)

    def test_inventor_power_action_repeat_and_feline_reward(self):
        state, pid, other = self.fixture("inventors", "felines")
        self.cell(state, "x0", 0, 0, "swamp", pid, "palace_left")
        self.cell(state, "x1", 0, 1, "forest")
        self.cell(state, "x2", 1, 0, "desert")
        self.act(state, pid, "build_transform", source="inventor_post", cell_id="x1", build=True)
        self.assertEqual(state["board"][1]["building"], "trading_post")
        self.assertEqual(state["players"][other]["coins"], 42)
        self.assertNotIn("inventor_post", state["players"][pid]["special_used"])
        state["phase"] = "action"
        state["players"][pid]["power"] = {"I": 0, "II": 0, "III": 8}
        self.assertTrue(any(a["source"] == "inventor_post" and a["cell_id"] == "x2" for a in self.options(state, pid, "build_transform")))

    def test_sun_transform_cannot_cross_bridge(self):
        state, pid, _ = self.fixture("sun_worshippers", "djinn")
        self.cell(state, "x0", 0, 0, "desert", pid, "palace_left")
        self.cell(state, "x1", 0, 1, "river")
        self.cell(state, "x2", 0, 2, "forest")
        self.cell(state, "x3", 1, 0, "swamp")
        state["bridges"] = [{"id": "test", "cell_ids": ["x0", "x2"], "owner": pid}]
        options = [a for a in self.options(state, pid, "build_transform") if a["source"] == "desert_transform"]
        self.assertTrue(any(a["cell_id"] == "x3" for a in options))
        self.assertFalse(any(a["cell_id"] == "x2" for a in options))

    def test_town_requires_four_buildings_absorbs_extensions(self):
        state, pid, _ = self.fixture()
        for index, building in enumerate(("palace_left", "trading_post", "house")):
            self.cell(state, f"x{index}", 0, index, "lake", pid, building)
        game._check_towns(state, pid)
        self.assertFalse(state["town_pending"])
        self.cell(state, "x3", 0, 3, "lake", pid, "house")
        game._check_towns(state, pid)
        self.assertEqual(state["phase"], "town_choice")
        tid = next(iter(data.TOWN_TILES))
        self.act(state, pid, "choose_town", town_id=tid)
        self.assertEqual(len(state["towns"]), 1)
        self.assertGreaterEqual(state["players"][pid]["score"], data.TOWN_TILES[tid]["score"] + 4)
        self.cell(state, "x4", 0, 4, "lake", pid, "house")
        game._check_towns(state, pid)
        self.assertIsNotNone(state["board"][-1]["town_id"])
        self.assertFalse(state["town_pending"])

    def test_right_palace_town_threshold_six(self):
        state, pid, _ = self.fixture()
        for index, building in enumerate(("palace_right", "house", "house", "house")):
            self.cell(state, f"x{index}", 0, index, "lake", pid, building)
        game._check_towns(state, pid)
        self.assertEqual(state["phase"], "town_choice")

    def test_merfolk_river_town_is_optional_single_river(self):
        self.check_merfolk_town_return("action")
        self.check_merfolk_town_return("post_action")

    def check_merfolk_town_return(self, phase):
        state, pid, _ = self.fixture("merfolk", "golems")
        state["phase"] = phase
        self.cell(state, "river", 1, 1, "river")
        self.cell(state, "a", 1, 0, "lake", pid, "trading_post")
        self.cell(state, "b", 0, 1, "lake", pid, "house")
        self.cell(state, "c", 1, 2, "lake", pid, "palace_left")
        self.cell(state, "d", 2, 1, "lake", pid, "house")
        game._check_towns(state, pid)
        self.assertEqual(state["phase"], phase)
        self.assertTrue(self.options(state, pid, "found_water_town"))
        self.act(state, pid, "found_water_town", cell_id="river")
        tid = next(iter(data.TOWN_TILES))
        self.act(state, pid, "choose_town", town_id=tid)
        self.assertEqual(state["towns"][0]["river"], "river")
        self.assertEqual(state["phase"], phase)

    def test_pass_post_action_and_all_ready_barrier(self):
        state = self.new_game()
        first = state["current_turn"]
        for pid in list(state["turn_order"]):
            self.assertEqual(state["current_turn"], pid)
            before = copy.deepcopy(state["players"][pid])
            action = self.options(state, pid, "pass")[0]
            self.assertIsNone(TerraNovaGame.apply_action(state, pid, action)[1])
            self.assertEqual(state["phase"], "post_action")
            self.assertNotEqual(state["players"][pid]["bonus_tile"], before["bonus_tile"])
            if state["players"][pid]["power"]["III"]:
                self.act(state, pid, "exchange_power", amount=1)
            self.act(state, pid, "end_turn")
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["start_player"], first)
        self.act(state, state["turn_order"][0], "next_round")
        self.assertEqual(state["round"], 1)
        self.assertEqual(self.options(state, state["turn_order"][0]), [])
        self.act(state, state["turn_order"][1], "next_round")
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["current_turn"], first)

    def test_final_pass_still_gets_market_coins_and_druid_exchange(self):
        state, pid, _ = self.fixture("druids", "djinn")
        self.cell(state, "x0", 0, 0, "forest", pid, "palace_left")
        state["round"] = 5
        bonus = next(iter(state["bonus_market"]))
        state["bonus_market"][bonus]["coins"] = 5
        self.act(state, pid, "pass", bonus_id=bonus)
        self.assertEqual(state["players"][pid]["coins"], 45)
        self.act(state, pid, "druid_exchange", amount=2)
        self.assertEqual(state["players"][pid]["power"]["III"], 2)
        self.assertEqual(state["players"][pid]["score"], 4)

    def test_final_coins_power_and_area_ties(self):
        state, pid, other = self.fixture()
        for index, owner in enumerate((pid, other)):
            self.cell(state, f"x{index}", 0, index * 4, "lake", owner, "house")
            state["players"][owner]["coins"] = 3
            state["players"][owner]["power"] = {"I": 5, "II": 0, "III": 3}
        game._finish_game(state)
        for player in state["players"].values():
            self.assertEqual(player["score"], 12)  # (12+8)/2 area + (3 coins+3 III)/3.
            self.assertEqual(player["coins"], 6)
            self.assertEqual(player["power"]["III"], 0)
        self.assertEqual(set(state["winner"]), {pid, other})

    def test_invalid_actions_are_atomic_and_views_isolated(self):
        state = self.new_game()
        pid, other = state["current_turn"], next(p for p in state["players"] if p != state["current_turn"])
        action = self.options(state, pid, "pass")[0]
        for actor, bad in ((other, action), (pid, {**action, "round": 0}), (pid, {**action, "bonus_id": "missing"}), (pid, {"type": "exchange_power", "round": 1, "amount": True})):
            original = copy.deepcopy(state)
            self.assertIsNotNone(TerraNovaGame.apply_action(state, actor, bad)[1])
            self.assertEqual(state, original)
        original = copy.deepcopy(state)
        view = TerraNovaGame.get_public_view(state, pid)
        view["players"][pid]["power"]["I"] = 999
        view["board"][0]["terrain"] = "fake"
        view["factions"]["djinn"]["name"] = "fake"
        self.assertEqual(state, original)
        self.assertNotEqual(data.FACTIONS["djinn"]["name"], "fake")

    def test_djinn_house_can_build_remotely_once_per_round(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "palace_left")
        self.cell(state, "x1", 0, 5, "lake")
        self.act(state, pid, "build_transform", source="djinn_house", cell_id="x1", build=True)
        self.assertEqual(state["players"][pid]["coins"], 40)
        self.assertEqual(state["board"][1]["building"], "house")
        state["phase"] = "action"
        self.cell(state, "x2", 0, 9, "lake")
        self.assertFalse(any(a["source"] == "djinn_house" for a in self.options(state, pid, "build_transform")))

    def test_fairy_spade_and_native_house_finish_without_second_target(self):
        state, pid, _ = self.fixture("fairies", "djinn")
        self.cell(state, "x0", 0, 0, "forest", pid, "palace_left")
        self.cell(state, "x1", 0, 1, "forest")
        self.cell(state, "x2", 1, 0, "lake")
        self.act(state, pid, "start_terraform", source="fairy_spade")
        self.act(state, pid, "terraform_target", source="fairy_spade", cell_id="x1", build=True)
        self.assertEqual(state["phase"], "post_action")
        self.assertEqual(state["players"][pid]["coins"], 36)
        self.assertEqual(state["players"][pid]["power"]["III"], 6)
        self.assertIn("fairy_spade", state["players"][pid]["special_used"])
        state["phase"] = "action"
        self.assertFalse(any(a["source"] == "fairy_spade" for a in self.options(state, pid, "start_terraform")))

    def test_ifrit_left_palace_free_edge_house_is_not_a_spade(self):
        state, pid, _ = self.fixture("ifrits", "djinn")
        self.cell(state, "x0", 0, 0, "wasteland", pid, "trading_post")
        self.cell(state, "x1", 0, 6, "lake")
        state["round_scoring"][0] = next(t for t, tile in data.ROUND_TILES.items() if tile["event"] == "spade")
        self.act(state, pid, "upgrade", source="paid", cell_id="x0", building="palace_left")
        self.assertEqual(state["phase"], "palace_choice")
        self.act(state, pid, "build_transform", source="ifrit_house", cell_id="x1", build=True)
        self.assertEqual(state["phase"], "post_action")
        self.assertEqual(state["players"][pid]["coins"], 26)
        self.assertEqual(state["players"][pid]["score"], 0)
        self.assertEqual(state["board"][1]["terrain"], "wasteland")

    def test_fixed_income_and_upgraded_building_track(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "lake", pid, "house")
        before = game.income_for_player(state, pid)
        faction = data.FACTIONS["djinn"]
        self.assertEqual(before["coins"], faction["income_coins"] + sum(faction["house_income"][:2]) + data.BONUS_TILES[state["players"][pid]["bonus_tile"]]["income"].get("coins", 0))
        self.act(state, pid, "upgrade", source="paid", cell_id="x0", building="trading_post")
        after = game.income_for_player(state, pid)
        self.assertEqual(after["coins"] - before["coins"], faction["trading_post_income"][0].get("coins", 0) - faction["house_income"][1])
        self.assertEqual(after["power"] - before["power"], faction["trading_post_income"][0].get("power", 0))

    def test_goblin_palace_immediate_power_and_income(self):
        state, pid, _ = self.fixture("goblins", "djinn")
        self.cell(state, "x0", 0, 0, "swamp", pid, "trading_post")
        state["players"][pid]["power"] = {"I": 4, "II": 4, "III": 0}
        self.act(state, pid, "upgrade", source="paid", cell_id="x0", building="palace_left")
        self.assertEqual(state["players"][pid]["power"], {"I": 0, "II": 6, "III": 2})
        bonus = data.BONUS_TILES[state["players"][pid]["bonus_tile"]]["income"]
        self.assertEqual(game.income_for_player(state, pid), {"coins": 7 + bonus.get("coins", 0), "power": 2 + bonus.get("power", 0)})
        self.assertEqual(data.FACTIONS["fairies"]["income_power"], 2)

    def test_druid_palaces_charge_on_pass_and_score_upgrades(self):
        state, pid, _ = self.fixture("druids", "djinn")
        self.cell(state, "x0", 0, 0, "forest", pid, "palace_left")
        self.cell(state, "x1", 0, 4, "forest", pid, "house")
        state["players"][pid]["power"] = {"I": 0, "II": 8, "III": 0}
        self.act(state, pid, "pass", bonus_id=next(iter(state["bonus_market"])))
        self.assertEqual(state["players"][pid]["power"], {"I": 0, "II": 4, "III": 4})
        state, pid, _ = self.fixture("druids", "djinn")
        self.cell(state, "x0", 0, 0, "forest", pid, "palace_right")
        self.cell(state, "x1", 0, 1, "forest", pid, "house")
        state["round_scoring"][0] = next(t for t, tile in data.ROUND_TILES.items() if tile["event"] == "spade")
        self.act(state, pid, "upgrade", source="paid", cell_id="x1", building="trading_post")
        self.assertEqual(state["players"][pid]["score"], 3)

    def test_feline_discount_and_remote_river_pass_points(self):
        for neighbor, expected in ((False, 7), (True, 5)):
            state, pid, other = self.fixture("felines", "djinn")
            self.cell(state, "x0", 0, 0, "desert", pid, "palace_left")
            self.cell(state, "x1", 0, 1, "desert", pid, "house")
            if neighbor:
                self.cell(state, "x2", 0, 2, "lake", other, "house")
            self.act(state, pid, "upgrade", source="paid", cell_id="x1", building="trading_post")
            self.assertEqual(state["players"][pid]["coins"], 40 - expected)
        state, pid, _ = self.fixture("felines", "djinn")
        state["players"][pid]["bonus_tile"] = next(b for b, tile in data.BONUS_TILES.items() if not tile.get("pass_event"))
        self.cell(state, "x0", 0, 0, "desert", pid, "palace_right")
        self.cell(state, "x1", 0, 1, "river")
        self.cell(state, "x2", 0, 2, "desert", pid, "house")
        self.cell(state, "x3", 0, 4, "desert", pid, "house")
        self.assertEqual(game._pass_points(state, pid), 1)

    def test_ifrit_edge_settlements_and_merfolk_free_upgrade(self):
        state, pid, _ = self.fixture("ifrits", "djinn")
        state["players"][pid]["bonus_tile"] = next(b for b, tile in data.BONUS_TILES.items() if not tile.get("pass_event"))
        self.cell(state, "x0", 0, 0, "wasteland", pid, "palace_right")
        self.cell(state, "x1", 0, 1, "wasteland", pid, "house")
        self.cell(state, "x2", 0, 7, "wasteland", pid, "house")
        self.assertEqual(game._pass_points(state, pid), 2)
        state, pid, _ = self.fixture("merfolk", "golems")
        self.cell(state, "x0", 0, 0, "lake", pid, "palace_right")
        self.cell(state, "x1", 0, 1, "lake", pid, "house")
        self.cell(state, "x2", 0, 2, "lake", pid, "house")
        self.act(state, pid, "upgrade", source="merfolk_upgrade", cell_id="x1", building="trading_post")
        self.assertEqual(state["players"][pid]["coins"], 40)
        state["phase"] = "action"
        self.assertFalse(any(a["source"] == "merfolk_upgrade" for a in self.options(state, pid, "upgrade")))

    def test_bridges_only_use_printed_sites_and_three_piece_supply(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        for index in range(1, 5):
            self.cell(state, f"x{index}", 0, index * 2, "forest")
        sites = [{"id": f"bridge{index}", "cell_ids": ["x0", f"x{index}"]} for index in range(1, 5)]
        with patch.object(data, "BRIDGE_SITES", sites):
            bad = {"type": "build_bridge", "round": 1, "source": "paid", "bridge_id": "invented"}
            original = copy.deepcopy(state)
            self.assertIsNotNone(TerraNovaGame.apply_action(state, pid, bad)[1])
            self.assertEqual(state, original)
            for index in range(1, 4):
                state["phase"] = "action"
                self.act(state, pid, "build_bridge", source="paid", bridge_id=f"bridge{index}")
            self.assertEqual(state["players"][pid]["coins"], 10)
            self.assertIn("x3", game.reachable_cells(state, pid))
            state["phase"] = "action"
            self.assertFalse(self.options(state, pid, "build_bridge"))

    def test_all_printed_bridges_connect_land_across_river_on_main_map(self):
        state = self.new_game()
        cells, neighbors = game._cell_map(state), game._neighbors(state)
        self.assertEqual(len(data.BRIDGE_SITES), 25)
        self.assertEqual(len({tuple(sorted(site["cell_ids"])) for site in data.BRIDGE_SITES}), 25)
        for site in data.BRIDGE_SITES:
            a, b = site["cell_ids"]
            self.assertNotEqual(cells[a]["terrain"], "river", site)
            self.assertNotEqual(cells[b]["terrain"], "river", site)
            self.assertNotIn(b, neighbors[a], site)
            self.assertTrue(any(cells[cid]["terrain"] == "river" for cid in neighbors[a] & neighbors[b]), site)
        pid = state["current_turn"]
        # Use the actual printed A5-C5 crossing, which has no direct adjacency.
        for cell in state["board"]:
            cell.update(owner=None, building=None, town_id=None)
        for player in state["players"].values():
            player["buildings"] = dict.fromkeys(game.BUILDING_LIMITS, 0)
        a, b = data.BRIDGE_SITES[0]["cell_ids"]
        cells[a]["terrain"] = data.FACTIONS[state["players"][pid]["faction"]]["terrain"]
        game._build(state, pid, a, "house", setup=True)
        state["players"][pid]["coins"] = 10
        self.act(state, pid, "build_bridge", source="paid", bridge_id=data.BRIDGE_SITES[0]["id"])
        self.assertIn(b, game._adjacency(state)[a])
        self.assertEqual(state["players"][pid]["coins"], 0)
        self.assertEqual(TerraNovaGame.deserialize(TerraNovaGame.serialize(state)), state)

    def test_shared_power_action_is_exclusive_until_new_round(self):
        state, pid, _ = self.fixture()
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.act(state, pid, "power_coins", source="coins")
        state["phase"] = "action"
        self.assertFalse(self.options(state, pid, "power_coins"))
        game._start_round(state)
        state["players"][pid]["power"] = {"I": 0, "II": 0, "III": 8}
        self.assertTrue(self.options(state, pid, "power_coins"))

    def test_empty_house_supply_still_allows_transform_without_building(self):
        state, pid, _ = self.fixture()
        for index in range(8):
            self.cell(state, f"h{index}", 0, index, "lake", pid, "house")
        self.cell(state, "target", 0, 8, "forest")
        options = self.options(state, pid, "build_transform")
        self.assertTrue(options)
        self.assertTrue(all(not action["build"] for action in options))
        self.act(state, pid, "upgrade", source="paid", cell_id="h0", building="trading_post")
        state["phase"] = "action"
        self.assertTrue(any(action["build"] for action in self.options(state, pid, "build_transform")))

    def test_inventors_receive_remote_house_power_even_after_passing(self):
        state, pid, other = self.fixture("djinn", "inventors")
        self.cell(state, "x0", 0, 0, "lake", pid, "house")
        self.cell(state, "x1", 0, 1, "lake")
        self.cell(state, "x2", 0, 7, "swamp", other, "house")
        state["players"][other]["passed"] = True
        state["players"][other]["power"] = {"I": 2, "II": 2, "III": 4}
        self.act(state, pid, "build_transform", source="paid", cell_id="x1", build=True)
        self.assertEqual(state["players"][other]["power"], {"I": 0, "II": 4, "III": 4})

    def test_json_roundtrip_and_malformed_save(self):
        state = self.new_game()
        saved = json.loads(json.dumps(TerraNovaGame.serialize(state)))
        self.assertEqual(TerraNovaGame.deserialize(saved), state)
        bad = copy.deepcopy(saved)
        bad["players"][bad["turn_order"][0]]["power"]["III"] += 1
        with self.assertRaises(ValueError):
            TerraNovaGame.deserialize(bad)
        self.assertEqual(saved, state)

    def test_bots_finish_two_three_four_players_and_all_factions(self):
        games = [
            ("djinn", "golems"),
            ("fairies", "goblins", "sun_worshippers"),
            ("merfolk", "ifrits", "druids", "inventors"),
            ("felines", "djinn"),
        ]
        for factions in games:
            state = self.new_game(factions)
            turns = 0
            while not state["game_over"] and turns < 1800:
                choices = [(pid, TerraNovaGame.bot_move(state, pid)) for pid in state["turn_order"]]
                move = next(((pid, action) for pid, action in choices if action), None)
                self.assertIsNotNone(move, (factions, state["phase"]))
                pid, action = move
                self.assertIsNone(TerraNovaGame.apply_action(state, pid, action)[1], (factions, action))
                turns += 1
                if turns % 40 == 0:
                    state = TerraNovaGame.deserialize(json.loads(json.dumps(TerraNovaGame.serialize(state))))
            self.assertTrue(state["game_over"], (factions, turns, state["phase"]))
            self.assertEqual(state["round"], 5)
            self.assertTrue(state["winner"])
            self.assertEqual(len(state["final_scoring"]), len(factions))
            self.assertTrue(all(p["coins"] >= 0 and sum(p["power"].values()) == 8 for p in state["players"].values()))


if __name__ == "__main__":
    unittest.main()
