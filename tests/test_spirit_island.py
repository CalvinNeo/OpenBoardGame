"""Deterministic rule and state-boundary checks for Spirit Island."""

import copy
import json
import unittest
from collections import Counter

from game.spirit_island import (
    SpiritIslandGame as Game, _add_piece, _check_victory, _defense,
    _destroy, _distance, _elements, _enter_phase, _explore, _fear,
    _pieces, _power_effects, _power_targets, _queue, _run, _sacred,
)
from game.spirit_island_data import (
    BOARD_LAYOUTS, BOARDS, CROSS_BOARD_EDGES, FEAR_CARDS, POWERS, SPIRITS,
)


class SpiritIslandTests(unittest.TestCase):
    def new_game(self, spirits=("river",), seed=105):
        state = Game.init_game({"seed": seed}, [
            {"player_id": f"p{i}", "name": f"Guardian {i}", "seat": i}
            for i in range(len(spirits))
        ])
        for i, spirit in enumerate(spirits):
            self.act(state, f"p{i}", "choose_spirit", spirit_id=spirit)
        return state

    def act(self, state, pid, kind=None, **matches):
        options = Game.get_public_view(state, pid)["action_options"]
        option = next((item for item in options
                       if (kind is None or item["action"]["type"] == kind)
                       and all(item["action"].get(k) == v for k, v in matches.items())), None)
        self.assertIsNotNone(option, (kind, matches, options))
        events, error = Game.apply_action(state, pid, option["action"])
        self.assertIsNone(error, (option, error))
        return events

    def settle(self, state, chooser=None, limit=300):
        """Finish effect choices, never advance a player phase automatically."""
        for _ in range(limit):
            _run(state)
            if state["game_over"] or not state["pending"]:
                return
            pid = state["pending"]["player_id"]
            options = Game.get_public_view(state, pid)["action_options"]
            self.assertTrue(options, state["pending"])
            chosen = chooser(state, options) if chooser else options[0]
            _, error = Game.apply_action(state, pid, chosen["action"])
            self.assertIsNone(error, error)
        self.fail("effect did not terminate")

    def sandbox(self, spirits=("river",)):
        state = self.new_game(spirits)
        state.update(phase="fast", pending=None, effects=[])
        for land in state["lands"].values():
            land["pieces"] = []
            land["blight"] = 0
            land["presence"] = {}
        for i, _ in enumerate(spirits):
            state["lands"]["A1"]["presence"][f"p{i}"] = 2
        # Keep a distant city so a local test does not accidentally end the game.
        _add_piece(state, "A8", "city")
        return state

    def effect(self, state, kind, lid="A4", amount=1, **values):
        _queue(state, [{"kind": kind, "land_id": lid, "player_id": "p0",
                        "amount": amount, **values}])
        self.settle(state)

    def test_component_catalog_is_complete_and_progressions_are_unique(self):
        self.assertEqual(Counter(card["type"] for card in POWERS.values()),
                         {"unique": 16, "minor": 36, "major": 22})
        self.assertEqual(len(FEAR_CARDS), 15)
        progression = [cid for spirit in SPIRITS.values() for cid in spirit["progression"]]
        self.assertEqual(len(progression), 28)
        self.assertEqual(len(set(progression)), 28)
        self.assertTrue(all(cid in POWERS for cid in progression))
        for spirit in SPIRITS.values():
            self.assertEqual(len(spirit["starting_powers"]), 4)
            for cid in spirit["starting_powers"]:
                self.assertEqual(POWERS[cid]["type"], "unique")

    def test_board_components_and_adjacencies(self):
        for bid, board in BOARDS.items():
            lands = {land["id"]: land for land in board["lands"]}
            self.assertEqual(len(lands), 8)
            self.assertEqual(sorted(Counter(land["terrain"] for land in lands.values()).values()), [2]*4)
            self.assertEqual(sum(land["dahan"] for land in lands.values()), 6)
            self.assertEqual(sum(land["blight"] for land in lands.values()), 1)
            self.assertEqual(sum(land["city"] for land in lands.values()), 1)
            self.assertEqual(sum(land["town"] for land in lands.values()), 1)
            for lid, land in lands.items():
                self.assertNotIn(lid, land["adjacent"])
                for other in land["adjacent"]:
                    self.assertIn(lid, lands[other]["adjacent"], (bid, lid, other))

    def test_setup_one_to_four_players_and_official_layouts(self):
        for count in range(1, 5):
            state = self.new_game(tuple(SPIRITS)[:count])
            self.assertEqual(len(state["lands"]), 8*count)
            self.assertEqual(state["blight_remaining"], 5*count+1)
            self.assertEqual(state["fear_pool"], 4*count)
            self.assertEqual(len(state["fear_deck"]), 9)
            self.assertEqual(len(state["invader_deck"]), 11)
            self.assertIsNone(state["invaders"]["ravage"])
            self.assertEqual(state["invaders"]["build"]["stage"], 1)
            self.assertEqual(Counter(card["stage"] for card in state["invader_deck"]), {1:2, 2:4, 3:5})
            self.assertEqual({land["board"] for land in state["lands"].values()}, set(BOARD_LAYOUTS[count]))
            for source, target in CROSS_BOARD_EDGES.get(count, []):
                self.assertEqual(_distance(state, source, target), 1)
                self.assertEqual(_distance(state, target, source), 1)
            self.assertTrue(all(_distance(state, next(iter(state["lands"])), lid) < 99 for lid in state["lands"]))

    def test_invalid_config_player_counts_and_duplicate_players(self):
        for count in (0, 5):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": f"p{i}"} for i in range(count)])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "p0"}, {"player_id": "p0"}])
        with self.assertRaises(ValueError):
            Game.init_game({"unknown": True}, [{"player_id": "p0"}])

    def test_spirits_cannot_be_selected_twice(self):
        state = Game.init_game({}, [{"player_id": "p0"}, {"player_id": "p1"}])
        self.act(state, "p0", "choose_spirit", spirit_id="river")
        options = Game.get_public_view(state, "p1")["action_options"]
        self.assertNotIn("river", [item.get("spirit_id") for item in options])

    def test_rejected_actions_are_atomic(self):
        state = self.new_game()
        for pid, action in [("intruder", {"type": "next_round"}),
                            ("p0", {"type": "next_round"}),
                            ("p0", {"type": "choose", "value": {"arbitrary": True}}),
                            ("p0", None), ("p0", {"type": "__dict__"})]:
            before = copy.deepcopy(state)
            _, error = Game.apply_action(state, pid, action)
            self.assertTrue(error)
            self.assertEqual(state, before)

    def test_public_view_and_saved_state_are_independent(self):
        state = self.new_game()
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, "p0")
        self.assertNotIn("invader_deck", view)
        self.assertNotIn("fear_deck", view)
        self.assertNotIn("seed", view)
        view["lands"][0]["presence"].clear()
        view["players"][0]["hand"].clear()
        saved = Game.serialize(state)
        saved["players"]["p0"]["hand"].clear()
        self.assertEqual(state, before)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(Game.get_public_view(restored, "p0"), Game.get_public_view(state, "p0"))

    def test_river_single_presence_wetland_is_sacred(self):
        state = self.sandbox()
        state["lands"]["A2"]["presence"] = {"p0": 1}
        state["lands"]["A3"]["presence"] = {"p0": 1}
        self.assertTrue(_sacred(state, "p0", "A2"))
        self.assertFalse(_sacred(state, "p0", "A3"))

    def test_earth_sacred_site_defense_is_local_and_additive(self):
        state = self.sandbox(("earth",))
        self.assertEqual(_defense(state, "A1"), 3)
        state["lands"]["A1"]["defend"] = 4
        self.assertEqual(_defense(state, "A1"), 7)
        self.assertEqual(_defense(state, "A2"), 0)

    def test_elements_remain_after_using_card(self):
        state = self.new_game()
        state["players"]["p0"]["played"] = ["flash_floods", "rivers_bounty"]
        before = _elements(state, "p0")
        state["players"]["p0"]["used"] = ["flash_floods"]
        self.assertEqual(_elements(state, "p0"), before)
        self.assertEqual(before["water"], 2)

    def test_fast_power_cannot_be_delayed_to_slow_phase(self):
        state = self.sandbox()
        state["players"]["p0"]["played"] = ["flash_floods", "wash_away"]
        state["phase"] = "slow"
        options = Game.get_public_view(state, "p0")["action_options"]
        playable = {o["action"].get("card_id") for o in options if o["action"]["type"] == "use_power"}
        self.assertNotIn("flash_floods", playable)
        self.assertIn("wash_away", playable)

    def test_lightning_changes_only_as_many_slow_powers_as_air_elements(self):
        state = self.sandbox(("lightning",))
        player = state["players"]["p0"]
        player["played"] = ["shatter_homesteads", "raging_storm"]
        available = lambda: [o for o in Game.get_public_view(state, "p0")["action_options"]
                             if o["action"]["type"] == "use_power"]
        self.assertTrue(available())
        player["fast_used"] = _elements(state, "p0")["air"]
        self.assertFalse(available())

    def test_flash_floods_deals_one_inland_and_two_on_coast(self):
        state = self.sandbox()
        _add_piece(state, "A3", "town")
        _add_piece(state, "A4", "town")
        for lid in ("A3", "A4"):
            _queue(state, _power_effects(state, "p0", "flash_floods", lid))
            self.settle(state)
        self.assertFalse(_pieces(state["lands"]["A3"]))
        self.assertEqual(_pieces(state["lands"]["A4"])[0]["health"], 1)

    def test_raging_storm_deals_one_to_each_invader(self):
        state = self.sandbox()
        for kind in ("explorer", "town", "city"):
            _add_piece(state, "A4", kind)
        _queue(state, _power_effects(state, "p0", "raging_storm", "A4"))
        self.settle(state)
        self.assertEqual({p["type"]: p["health"] for p in _pieces(state["lands"]["A4"])}, {"town": 1, "city": 2})

    def test_river_bounty_checks_dahan_after_gather_and_adds_energy(self):
        state = self.sandbox()
        _add_piece(state, "A1", "dahan", 2)
        _queue(state, _power_effects(state, "p0", "rivers_bounty", "A4"))
        self.settle(state)
        self.assertEqual(len(_pieces(state["lands"]["A4"], ["dahan"])), 3)
        self.assertEqual(state["players"]["p0"]["energy"], 1)

    def test_river_top_innate_replaces_lower_tiers(self):
        state = self.sandbox()
        for kind in ("explorer", "town", "city"):
            _add_piece(state, "A4", kind)
        _queue(state, _power_effects(state, "p0", "river:3", "A4", innate=True))
        self.settle(state)
        remaining = _pieces(state["lands"]["A4"])
        self.assertEqual([(p["type"], p["health"]) for p in remaining], [("city", 1)])
        self.assertFalse(state["pending"])

    def test_progression_major_requires_forgetting_a_power(self):
        state = self.sandbox(("lightning",))
        player = state["players"]["p0"]
        player["progression_index"] = 2
        _queue(state, [{"kind": "gain_power", "player_id": "p0"}])
        _run(state)
        self.assertEqual(state["pending"]["kind"], "forget")
        self.assertIn("powerstorm", player["hand"])
        self.act(state, "p0", "choose", value="powerstorm")
        self.assertNotIn("powerstorm", state["players"]["p0"]["hand"])
        self.assertIn("powerstorm", state["major_discard"])

    def test_progression_exhaustion_draws_four_from_normal_deck(self):
        state = self.sandbox()
        state["players"]["p0"]["progression_index"] = 7
        before = list(state["minor_deck"])
        _queue(state, [{"kind": "gain_power", "player_id": "p0"}])
        _run(state)
        self.assertEqual(state["pending"]["kind"], "gain_type")
        self.act(state, "p0", "choose", value="minor")
        self.assertEqual(state["pending"]["kind"], "gain_card")
        options = Game.get_public_view(state, "p0")["action_options"]
        self.assertEqual(len(options), 4)
        selected = options[0]["action"]["value"]
        self.act(state, "p0", "choose", value=selected)
        self.assertIn(selected, state["players"]["p0"]["hand"])
        self.assertEqual(set(state["minor_discard"]), set(before[:4]) - {selected})

    def test_pending_cascade_resumes_identically_after_json_save(self):
        state = self.sandbox()
        state["lands"]["A4"]["blight"] = 1
        _queue(state, [{"kind": "blight", "land_id": "A4", "player_id": "p0"}])
        _run(state)
        saved = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        action = Game.get_public_view(state, "p0")["action_options"][0]["action"]
        self.assertEqual(Game.apply_action(state, "p0", action), Game.apply_action(saved, "p0", action))
        self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(saved, "p0"))

    def test_ravage_sacrifice_victory_finishes_dahan_counterattack(self):
        state = self.sandbox()
        state["lands"]["A8"]["pieces"] = []
        state["terror_level"] = 3
        state["blight_remaining"] = 1
        _add_piece(state, "A4", "city")
        _add_piece(state, "A4", "dahan", 3)
        self.effect(state, "ravage")
        self.assertTrue(state["game_over"])
        self.assertTrue(state["victory"])

    def test_shadows_may_pay_to_target_dahan_outside_range(self):
        state = self.sandbox(("shadows",))
        state["players"]["p0"]["energy"] = 1
        _add_piece(state, "A7", "dahan")
        card = POWERS["concealing_shadows"]
        choices = _power_targets(state, "p0", card)
        target = next(c for c in choices if c.get("land_id") == "A7")
        self.assertTrue(target["value"]["shadows"])
        state["players"]["p0"]["energy"] = 0
        self.assertFalse(any(c.get("land_id") == "A7" for c in _power_targets(state, "p0", card)))

    def test_fear_pool_thresholds_and_terror_victory(self):
        state = self.sandbox()
        _fear(state, 11)
        self.assertEqual((len(state["earned_fear"]), state["fear_generated"], state["terror_level"]), (2,3,1))
        _fear(state, 1)
        self.assertEqual(state["terror_level"], 2)
        _fear(state, 12)
        self.assertEqual(state["terror_level"], 3)
        _fear(state, 12)
        self.assertTrue(state["game_over"])
        self.assertTrue(state["victory"])

    def test_growth_move_measures_range_from_all_own_presence(self):
        state = self.sandbox()
        state["lands"]["A8"]["presence"]["p0"] = 1
        self.assertGreater(_distance(state, "A1", "A8"), 1)
        _queue(state, [{"kind": "presence", "player_id": "p0", "range": 1}])
        _run(state)
        self.act(state, "p0", "choose", value="move")
        self.act(state, "p0", "choose", value="A1")
        self.act(state, "p0", "choose", value="A8")
        self.assertEqual(state["lands"]["A1"]["presence"]["p0"], 1)
        self.assertEqual(state["lands"]["A8"]["presence"]["p0"], 2)

    def test_paid_repeat_reserves_energy_for_shadows_targeting(self):
        state = self.sandbox(("shadows",))
        cid = "call_to_bloodshed"
        state["phase"] = POWERS[cid]["speed"]
        player = state["players"]["p0"]
        player.update(played=[cid], used=[cid], energy=1,
                      repeat_offers=[{"remaining": 1, "used": [], "paid": True, "limit": 1}])
        _add_piece(state, "A7", "dahan")
        self.assertGreater(_distance(state, "A1", "A7"), POWERS[cid]["range"])
        action = {"type": "repeat_power", "card_id": cid, "offer": 0}
        before = copy.deepcopy(state)
        _, error = Game.apply_action(state, "p0", action)
        self.assertIsNotNone(error)
        self.assertEqual(state, before)
        player["energy"] = 2
        self.act(state, "p0", "repeat_power", card_id=cid)
        self.assertEqual(state["players"]["p0"]["energy"], 1)
        self.act(state, "p0", "choose", value={"land_id": "A7", "shadows": True})
        self.assertEqual(state["players"]["p0"]["energy"], 0)

    def test_threshold_repeat_waits_for_original_action_triggers(self):
        state = self.sandbox()
        state["phase"] = "slow"
        state["players"]["p0"]["extra_elements"] = {"moon": 3, "earth": 3}
        land = state["lands"]["A4"]
        land["blight"] = 1
        land["vengeance"] = [{"player_id": "p0", "adjacent": False}]
        _add_piece(state, "A4", "town")
        _add_piece(state, "A4", "city")
        town = _pieces(land, ["town"])[0]["id"]
        city = _pieces(land, ["city"])[0]["id"]
        _queue(state, [{"kind": "power", "player_id": "p0", "target": "A4",
                        "card_id": "the_land_thrashes_in_furious_pain"}])
        _run(state)
        self.act(state, "p0", "choose", value=town)
        self.act(state, "p0", "choose", value=town)
        self.assertEqual(state["pending"]["kind"], "piece")
        self.assertTrue(state["pending"]["effect"]["no_vengeance"])
        self.act(state, "p0", "choose", value=city)
        self.assertEqual(state["pending"]["kind"], "extra_repeat")
        self.assertEqual(state["action_depth"], 0)
        self.assertEqual(_pieces(state["lands"]["A4"], ["city"])[0]["health"], 2)

    def test_pending_public_action_does_not_alias_server_state(self):
        state = self.sandbox()
        player = state["players"]["p0"]
        player["played"] = ["flash_floods"]
        self.act(state, "p0", "use_power", card_id="flash_floods")
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, "p0")
        view["action_options"][0]["action"]["value"]["land_id"] = "forged"
        self.assertEqual(state, before)

    def test_destroy_buildings_generates_fear_but_remove_does_not(self):
        state = self.sandbox()
        _add_piece(state, "A4", "town")
        self.effect(state, "remove", types=["town"])
        self.assertEqual(state["fear_generated"], 0)
        _add_piece(state, "A4", "city")
        self.effect(state, "destroy", types=["city"])
        self.assertEqual(state["fear_generated"], 2)

    def test_exploration_requires_a_building_or_ocean_source(self):
        state = self.sandbox()
        state["lands"]["A8"]["pieces"] = []
        _add_piece(state, "A5", "explorer")
        _explore(state, {"stage": 3, "terrains": ["mountain", "wetland"]})
        self.assertEqual(len(_pieces(state["lands"]["A1"])), 1)
        self.assertEqual(len(_pieces(state["lands"]["A2"])), 1)
        self.assertEqual(len(_pieces(state["lands"]["A6"])), 0)
        self.assertEqual(len(_pieces(state["lands"]["A5"])), 1)
        _add_piece(state, "A8", "town")
        _explore(state, {"stage": 1, "terrains": ["mountain"]})
        self.assertEqual(len(_pieces(state["lands"]["A6"])), 1)

    def test_coastal_explore_matches_all_and_only_coastal_lands(self):
        state = self.sandbox()
        _explore(state, {"stage": 2, "terrains": ["coastal"]})
        self.assertEqual({lid for lid, land in state["lands"].items()
                          if _pieces(land, ["explorer"])}, {"A1", "A2", "A3"})

    def test_build_city_only_when_towns_outnumber_cities(self):
        state = self.sandbox()
        _add_piece(state, "A1", "explorer")
        _add_piece(state, "A6", "town")
        state["invaders"]["build"] = {"stage": 1, "terrains": ["mountain"]}
        _enter_phase(state, "build")
        self.assertEqual(len(_pieces(state["lands"]["A1"], ["town"])), 1)
        self.assertEqual(len(_pieces(state["lands"]["A6"], ["city"])), 1)
        state["effects"] = []
        _enter_phase(state, "build")
        self.assertEqual(len(_pieces(state["lands"]["A6"], ["town"])), 2)

    def test_ravage_damage_to_land_and_dahan_is_separate(self):
        state = self.sandbox()
        _add_piece(state, "A4", "town")
        _add_piece(state, "A4", "dahan", 2)
        self.effect(state, "ravage")
        self.assertEqual(state["lands"]["A4"]["blight"], 1)
        self.assertEqual(len(_pieces(state["lands"]["A4"], ["dahan"])), 1)
        self.assertEqual(len(_pieces(state["lands"]["A4"])), 0)

    def test_defended_dahan_counterattack_even_when_damage_is_zero(self):
        state = self.sandbox()
        _add_piece(state, "A4", "town")
        _add_piece(state, "A4", "dahan")
        state["lands"]["A4"]["defend"] = 2
        self.effect(state, "ravage")
        self.assertEqual(state["lands"]["A4"]["blight"], 0)
        self.assertEqual(len(_pieces(state["lands"]["A4"], ["dahan"])), 1)
        self.assertFalse(_pieces(state["lands"]["A4"]))

    def test_blight_destroys_one_presence_per_spirit_not_all(self):
        state = self.sandbox(("river", "earth"))
        state["lands"]["A4"]["presence"] = {"p0": 2, "p1": 1}
        self.effect(state, "blight")
        self.assertEqual(state["lands"]["A4"]["presence"], {"p0": 1, "p1": 0})
        self.assertEqual(state["players"]["p0"]["destroyed_presence"], 1)

    def test_blight_cascade_is_explicit_and_has_only_adjacent_targets(self):
        state = self.sandbox()
        state["lands"]["A4"]["blight"] = 1
        _queue(state, [{"kind": "blight", "land_id": "A4", "player_id": "p0"}])
        _run(state)
        self.assertEqual(state["pending"]["kind"], "cascade")
        options = Game.get_public_view(state, "p0")["action_options"]
        self.assertEqual({o["land_id"] for o in options}, set(state["lands"]["A4"]["adjacent"]))
        self.assertEqual(state["lands"]["A4"]["blight"], 2)
        self.settle(state)
        self.assertEqual(sum(land["blight"] for land in state["lands"].values()), 3)

    def test_empty_blight_pool_and_lost_presence_end_game(self):
        state = self.sandbox()
        state["blight_remaining"] = 1
        self.effect(state, "blight")
        self.assertTrue(state["game_over"])
        self.assertFalse(state["victory"])
        state = self.sandbox()
        state["lands"]["A1"]["presence"] = {"p0": 1}
        self.effect(state, "blight", "A1")
        self.assertTrue(state["game_over"])
        self.assertFalse(state["victory"])

    def test_insufficient_invader_cards_loses_only_when_exploration_required(self):
        state = self.sandbox()
        state["invader_deck"] = []
        self.assertFalse(state["game_over"])
        _enter_phase(state, "explore")
        self.assertTrue(state["game_over"])
        self.assertFalse(state["victory"])

    def test_each_terror_level_has_correct_victory_condition(self):
        for level, remaining, won in [(1, "explorer", False), (2, "explorer", True),
                                      (2, "town", False), (3, "town", True), (3, "city", False)]:
            state = self.sandbox()
            state["lands"]["A8"]["pieces"] = []
            _add_piece(state, "A8", remaining)
            state["terror_level"] = level
            _check_victory(state)
            self.assertEqual(state["game_over"], won, (level, remaining))

    def test_round_review_waits_for_every_player_and_clears_temporary_state(self):
        state = self.sandbox(("river", "earth"))
        state["lands"]["A4"].update(defend=9, dahan_protected=True, skip=["build"])
        _enter_phase(state, "round_end")
        self.assertEqual(state["lands"]["A4"]["defend"], 0)
        self.assertFalse(state["lands"]["A4"].get("dahan_protected"))
        self.assertFalse(state["lands"]["A4"]["skip"])
        self.act(state, "p0", "next_round")
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round"], 1)
        self.assertNotIn("next_round", Game.get_legal_actions(state, "p0"))
        self.act(state, "p1", "next_round")
        self.assertEqual((state["phase"], state["round"]), ("growth", 2))

    def test_seeded_bot_games_reach_a_real_terminal_state(self):
        for count in range(1, 5):
            for seed in (19, 105):
                state = Game.init_game({"seed": seed}, [
                    {"player_id": f"p{i}", "name": f"Bot {i}", "seat": i, "is_bot": True}
                    for i in range(count)
                ])
                for step in range(4000):
                    if state["game_over"]:
                        break
                    progressed = False
                    for i in range(count):
                        action = Game.bot_move(state, f"p{i}")
                        if action:
                            _, error = Game.apply_action(state, f"p{i}", action)
                            self.assertIsNone(error, (count, seed, step, action, error))
                            progressed = True
                            break
                    self.assertTrue(progressed, (count, seed, step, state["phase"], state["pending"]))
                self.assertTrue(state["game_over"], (count, seed))
                self.assertIn(state["winner"], ("spirits", "invaders"))


if __name__ == "__main__":
    unittest.main()
