import copy
import json
import unittest

from game.power_grid import (PowerGridGame as Game, _activate_step3, _discard_low,
                             _finish_building, _finish_game, _finish_round, _next_auction,
                             _purge_obsolete, _set_phase, build_quotes, choose_bot_action,
                             dispatch_options, empty_resources, resource_prices, storage_valid)
from game.power_grid_data import CITIES, EDGES, PLANTS, PLAYER_RULES, REFILL, TOTAL_RESOURCES


def make_state(count=3, seed=131, **config):
    return Game.init_game({"seed": seed, **config}, [
        {"player_id": f"p{i}", "name": f"Company {i}", "seat": i, "is_bot": True} for i in range(count)])


def act(state, kind, pid=None, **fields):
    pid = pid or state["current_turn"]
    action = {"type": kind, "round": state["round"], **fields}
    if kind != "next_round":
        action["revision"] = state["revision"]
    events, error = Game.apply_action(state, pid, action)
    if error:
        raise AssertionError((kind, pid, fields, error))
    return events


class PowerGridTests(unittest.TestCase):
    def assert_rejected(self, state, pid, action):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_catalog_and_setup_for_each_player_count(self):
        self.assertEqual(len(PLANTS), 42)
        self.assertEqual(len(CITIES), 42)
        self.assertEqual(len(EDGES), 83)
        for count, rules in PLAYER_RULES.items():
            s = make_state(count)
            self.assertEqual(len(s["cities"]), rules[0] * 7)
            self.assertEqual(len(s["removed"]), rules[1])
            self.assertEqual((s["plant_limit"], s["step2_threshold"], s["end_threshold"]), rules[2:])
            self.assertEqual(s["market"], list(range(3, 11)))
            self.assertEqual(s["deck"][0], 13)
            self.assertEqual(s["deck"][-1], 99)
            self.assertTrue(all(p["money"] == 50 for p in s["players"].values()))

    def test_configuration_validation(self):
        for count in (1, 7):
            with self.assertRaises(ValueError):
                make_state(count)
        for config in ({"regions": ["north"]}, {"regions": ["north", "north", "west"]},
                       {"regions": ["north", "east", "south"]}, {"regions": "north"},
                       {"regions": [[], "west", "east"]}, {"unknown": 1}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                make_state(**config)
        self.assertEqual(len(make_state(regions=["east", "central", "south"])["cities"]), 21)

    def test_first_round_requires_purchase(self):
        s = make_state()
        self.assertEqual(Game.get_legal_actions(s, s["current_turn"]), ["auction"])
        self.assert_rejected(s, s["current_turn"], {"type": "pass", "round": 1, "revision": 0})

    def test_bid_uses_seats_not_rank(self):
        s = make_state(4)
        s["order"] = ["p0", "p2", "p3", "p1"]
        s["current_turn"] = "p0"
        act(s, "auction", plant=3, amount=3)
        self.assertEqual(s["current_turn"], "p1")
        act(s, "bid", amount=4)
        self.assertEqual(s["current_turn"], "p2")
        act(s, "pass")
        act(s, "pass")
        self.assertEqual(s["current_turn"], "p0")
        act(s, "pass")
        self.assertEqual(s["players"]["p1"]["plants"], [3])
        self.assertEqual(s["players"]["p1"]["money"], 46)
        self.assertEqual(s["current_turn"], "p0")
        self.assertNotIn("p0", s["auction_done"])
        self.assertIn("p1", s["auction_done"])

    def test_passed_bidder_cannot_reenter_same_auction(self):
        s = make_state()
        act(s, "auction", plant=3, amount=3)
        passer = s["current_turn"]
        act(s, "pass")
        self.assertNotIn(passer, s["auction"]["active"])
        self.assert_rejected(s, passer, {"type": "bid", "amount": 5, "round": 1, "revision": s["revision"]})

    def test_future_plant_and_invalid_bid_rejected_atomically(self):
        for number, amount in ((7, 7), (3, 2), (3, 51), (True, 5), (3, 3.5)):
            s = make_state()
            self.assert_rejected(s, s["current_turn"], {"type": "auction", "plant": number, "amount": amount, "round": 1, "revision": 0})

    def test_first_round_resorts_and_reverse_resource_order(self):
        s = make_state(6)
        while s["phase"] == "auction":
            pid = s["current_turn"]
            a = Game.bot_move(s, pid)
            self.assertIsNone(Game.apply_action(s, pid, a)[1])
        self.assertEqual(s["phase"], "resources")
        numbers = [max(s["players"][p]["plants"]) for p in s["order"]]
        self.assertEqual(numbers, sorted(numbers, reverse=True))
        self.assertEqual(s["current_turn"], s["order"][-1])
        self.assertEqual(len(s["purchased"]), 6)

    def test_whole_round_pass_excludes_later_auctions(self):
        s = make_state()
        s["round"] = 2
        first = s["current_turn"]
        act(s, "pass")
        act(s, "auction", plant=3, amount=3)
        self.assertNotIn(first, s["auction"]["active"])

    def test_no_purchase_removes_lowest_plant(self):
        s = make_state()
        s["round"] = 2
        for _ in range(3):
            act(s, "pass")
        self.assertIn(3, s["discarded"])
        self.assertIn(13, s["market"])

    def test_resource_market_prices(self):
        self.assertEqual(resource_prices("coal", 24), [n for n in range(1, 9) for _ in range(3)])
        self.assertEqual(resource_prices("oil", 18)[0], 3)
        self.assertEqual(resource_prices("garbage", 6), [7, 7, 7, 8, 8, 8])
        self.assertEqual(resource_prices("uranium", 2), [14, 16])
        self.assertEqual(resource_prices("coal", 0), [])

    def test_resource_buy_crosses_price_boundary(self):
        s = make_state()
        _set_phase(s, "resources", ["p0", "p1", "p2"])
        s["players"]["p0"]["plants"] = [4]
        act(s, "buy_resources", resources={"coal": 4})
        self.assertEqual(s["players"]["p0"]["money"], 45)
        self.assertEqual(s["resource_market"]["coal"], 20)
        self.assertEqual(s["players"]["p0"]["resources"]["coal"], 4)
        self.assertEqual(s["current_turn"], "p0")

    def test_hybrid_capacity_is_shared(self):
        self.assertTrue(storage_valid([4, 5], {"coal": 6, "oil": 2, "garbage": 0, "uranium": 0}))
        self.assertFalse(storage_valid([4, 5], {"coal": 6, "oil": 3, "garbage": 0, "uranium": 0}))
        self.assertFalse(storage_valid([13], {"coal": 1, "oil": 0, "garbage": 0, "uranium": 0}))
        s = make_state()
        _set_phase(s, "resources", ["p0"])
        s["players"]["p0"]["plants"] = [5]
        for resources in ({"coal": 3, "oil": 2}, {"coal": -1}, {"coal": True}, {"oil": 99}, {"garbage": 1}, {}):
            self.assert_rejected(s, "p0", {"type": "buy_resources", "resources": resources, "round": 1, "revision": 0})

    def test_build_first_and_zero_connection(self):
        s = make_state()
        _set_phase(s, "building", ["p0", "p1", "p2"])
        act(s, "build", city="duisburg")
        self.assertEqual(next(q for q in build_quotes(s, "p0") if q["city"] == "essen")["cost"], 10)
        act(s, "build", city="essen")
        self.assertEqual(s["players"]["p0"]["money"], 30)
        self.assertEqual(s["cities"]["essen"], ["p0"])
        self.assertNotIn("essen", [q["city"] for q in build_quotes(s, "p0")])

    def test_path_through_occupied_city_and_unpurchased_city(self):
        s = make_state()
        s["players"]["p0"]["cities"] = ["duisburg"]
        s["cities"]["duisburg"] = ["p0"]
        s["cities"]["essen"] = ["p1"]
        q = next(q for q in build_quotes(s, "p0") if q["city"] == "aachen")
        self.assertEqual(q["connection"], 11)
        self.assertEqual(q["path"], ["duisburg", "essen", "dusseldorf", "aachen"])
        s["step"] = 2
        q = next(q for q in build_quotes(s, "p0") if q["city"] == "essen")
        self.assertEqual(q["cost"], 15)
        self.assertNotIn("berlin", [q["city"] for q in build_quotes(s, "p0")])

    def test_second_third_slots_and_duplicate_ownership(self):
        s = make_state()
        s["cities"]["essen"] = ["p1", "p2"]
        s["step"] = 2
        self.assertNotIn("essen", [q["city"] for q in build_quotes(s, "p0")])
        s["step"] = 3
        self.assertEqual(next(q for q in build_quotes(s, "p0") if q["city"] == "essen")["cost"], 20)

    def test_step2_waits_until_all_builders_finish(self):
        s = make_state()
        _set_phase(s, "building", ["p0", "p1", "p2"])
        cities = list(s["cities"])[-7:]
        for c in cities:
            s["cities"][c] = ["p0"]
        s["players"]["p0"]["cities"] = cities
        act(s, "done")
        self.assertEqual(s["step"], 1)
        act(s, "done")
        self.assertEqual(s["step"], 1)
        act(s, "done")
        self.assertEqual(s["step"], 2)
        self.assertEqual(s["phase"], "bureaucracy")

    def test_obsolete_plants_remove_recursively(self):
        s = make_state()
        s["players"]["p0"]["cities"] = list(s["cities"])[:8]
        s["deck"] = [11, 12, 13, 14, 15, 16, 99]
        _purge_obsolete(s)
        self.assertTrue(all(n > 8 for n in s["market"]))
        self.assertTrue(set(range(3, 9)) <= set(s["discarded"]))

    def test_step3_draw_during_auction_delayed_until_resources(self):
        s = make_state()
        s["round"] = 2
        s["deck"] = [99, 50, 46]
        _discard_low(s)
        self.assertEqual(s["step"], 1)
        self.assertIn(99, s["market"])
        self.assertTrue(s["step3_pending"])
        s["auction_done"] = list(s["order"])
        s["purchased"] = ["p0"]
        _next_auction(s)
        self.assertEqual(s["step"], 3)
        self.assertEqual(len(s["market"]), 6)
        self.assertEqual(s["phase"], "resources")

    def test_step3_draw_during_building_delayed_until_power(self):
        s = make_state()
        s["phase"] = "building"
        s["deck"] = [99, 50]
        _discard_low(s)
        self.assertEqual(s["step"], 1)
        self.assertNotIn(99, s["market"])
        self.assertEqual(len(s["market"]), 6)
        _finish_building(s)
        self.assertEqual(s["step"], 3)

    def test_step3_draw_during_bureaucracy_waits_for_next_round(self):
        s = make_state()
        s["phase"] = "bureaucracy"
        s["step"] = 2
        s["deck"] = [99]
        _finish_round(s)
        self.assertEqual(s["step"], 2)
        self.assertEqual(s["phase"], "round_end")
        for pid in s["order"][:]:
            act(s, "next_round", pid)
        self.assertEqual(s["step"], 3)
        self.assertEqual(s["round"], 2)

    def test_full_fuel_required_and_hybrid_can_mix(self):
        self.assertEqual(max(o["powered"] for o in dispatch_options([4], {**empty_resources(), "coal": 1}, 10)), 0)
        options = dispatch_options([5, 13], {**empty_resources(), "coal": 1, "oil": 1}, 5)
        best = max(options, key=lambda o: o["powered"])
        self.assertEqual(best["powered"], 2)
        self.assertEqual(best["hybrid_coal"], 1)
        self.assertEqual(best["fuel"], {"coal": 1, "oil": 1, "garbage": 0, "uranium": 0})
        self.assertEqual(max(o["powered"] for o in dispatch_options([50], empty_resources(), 2)), 2)

    def test_power_consumption_payment_and_replay(self):
        s = make_state()
        p = s["players"]["p0"]
        p.update(plants=[5, 13], resources={**empty_resources(), "coal": 1, "oil": 1}, cities=["essen", "duisburg"])
        _set_phase(s, "bureaucracy", ["p0", "p1", "p2"])
        a = {"type": "power", "round": 1, "revision": 0, "plants": [13, 5], "hybrid_coal": 1}
        self.assertIsNone(Game.apply_action(s, "p0", a)[1])
        self.assertEqual(s["players"]["p0"]["money"], 83)
        self.assertEqual(s["players"]["p0"]["resources"], empty_resources())
        self.assert_rejected(s, "p0", a)

    def test_zero_production_is_allowed(self):
        s = make_state()
        _set_phase(s, "bureaucracy", ["p0", "p1"])
        act(s, "power", plants=[], hybrid_coal=0)
        self.assertEqual(s["players"]["p0"]["money"], 60)

    def test_invalid_production_never_changes_state(self):
        s = make_state()
        _set_phase(s, "bureaucracy", ["p0", "p1"])
        s["players"]["p0"]["plants"] = [4, 13]
        for plants, coal in (([4], 0), ([13, 13], 0), ([True], 0), ([13], True), ([50], 0), ("13", 0)):
            self.assert_rejected(s, "p0", {"type": "power", "round": 1, "revision": 0, "plants": plants, "hybrid_coal": coal})

    def test_replacement_cannot_discard_new_and_returns_excess(self):
        s = make_state()
        s.update(phase="replace", current_turn="p0", new_plant=50)
        s["players"]["p0"].update(plants=[4, 5, 13, 50], resources={**empty_resources(), "coal": 6})
        base = {"type": "replace", "round": 1, "revision": 0, "plant": 50, "resources": empty_resources()}
        self.assert_rejected(s, "p0", base)
        self.assert_rejected(s, "p0", {**base, "plant": 4, "resources": {"coal": 6}})
        act(s, "replace", plant=4, resources={"coal": 4})
        self.assertEqual(s["players"]["p0"]["resources"]["coal"], 4)
        self.assertIn(4, s["discarded"])
        self.assertEqual(s["resource_market"]["coal"], 24)

    def test_refill_respects_supply_and_does_not_create_tokens(self):
        s = make_state(5)
        s["resource_market"].update(coal=10, oil=18, garbage=6, uranium=2)
        s["players"]["p0"]["resources"]["coal"] = 12
        s["phase"] = "bureaucracy"
        _finish_round(s)
        self.assertEqual(s["round_summary"]["refill"], {"coal": 2, "oil": 4, "garbage": 3, "uranium": 2})
        self.assertEqual(s["resource_market"]["coal"], 12)

    def test_all_refill_values(self):
        self.assertEqual(REFILL[2], ((3,2,1,1),(4,2,2,1),(3,4,3,1)))
        self.assertEqual(REFILL[6], ((7,5,3,2),(9,6,5,3),(6,7,6,3)))

    def test_round_end_waits_for_everyone_and_rejects_duplicate(self):
        s = make_state()
        s["phase"] = "bureaucracy"
        _finish_round(s)
        act(s, "next_round", "p0")
        self.assertEqual(s["phase"], "round_end")
        self.assert_rejected(s, "p0", {"type": "next_round", "round": 1})
        act(s, "next_round", "p1")
        self.assertEqual(s["round"], 1)
        act(s, "next_round", "p2")
        self.assertEqual(s["round"], 2)
        self.assertEqual(s["phase"], "auction")
        self.assert_rejected(s, "p0", {"type": "next_round", "round": 1})

    def test_final_scoring_uses_fueled_capacity_not_triggering_player(self):
        s = make_state()
        s["players"]["p0"].update(plants=[13], cities=list(s["cities"])[:17], money=999)
        s["players"]["p1"].update(plants=[50], cities=list(s["cities"])[:8], money=4)
        before = [p["money"] for p in s["players"].values()]
        _finish_building(s)
        self.assertEqual(s["winner_ids"], ["p1"])
        self.assertEqual(s["phase"], "game_over")
        self.assertEqual([p["money"] for p in s["players"].values()], before)

    def test_tie_breakers_and_shared_win(self):
        s = make_state()
        for p in s["players"].values():
            p.update(plants=[50], cities=list(s["cities"])[:6], money=50)
        s["players"]["p0"]["money"] = 51
        _finish_game(s)
        self.assertEqual(s["winner_ids"], ["p0"])
        s["players"]["p0"]["money"] = 50
        s["players"]["p1"]["cities"] = list(s["cities"])[:7]
        _finish_game(s)
        self.assertEqual(s["winner_ids"], ["p1"])
        s["players"]["p1"]["cities"] = list(s["cities"])[:6]
        _finish_game(s)
        self.assertEqual(set(s["winner_ids"]), {"p0", "p1", "p2"})

    def test_depleted_step3_market_does_not_refill_forever(self):
        s = make_state()
        s.update(step=3, phase="bureaucracy", deck=[], market=[50])
        _finish_round(s)
        self.assertEqual(s["market"], [])
        for p in s["order"][:]:
            act(s, "next_round", p)
        self.assertEqual(s["phase"], "resources")

    def test_public_view_hides_cash_seed_and_deck_and_is_detached(self):
        s = make_state()
        v = Game.get_public_view(s, "p0")
        self.assertEqual([p["money"] for p in v["players"]], [50, None, None])
        self.assertFalse(set(v) & {"seed", "deck", "removed", "player_meta"})
        self.assertNotIn("seed", v["config"])
        v["players"][0]["resources"]["coal"] = 100
        v["cities"][0]["owners"].append("hacker")
        self.assertEqual(s["players"]["p0"]["resources"]["coal"], 0)
        self.assertEqual(s["cities"][next(iter(s["cities"]))], [])
        spectator = Game.get_public_view(s, "visitor")
        self.assertEqual(spectator["legal_actions"], [])
        self.assertEqual(spectator["build_quotes"], [])
        self.assertTrue(all(p["money"] is None for p in spectator["players"]))

    def test_stale_actions_and_unknown_fields(self):
        s = make_state()
        action = {"type": "auction", "round": 1, "revision": 0, "plant": 3, "amount": 3}
        pid = s["current_turn"]
        self.assert_rejected(s, pid, {**action, "money": 900})
        self.assert_rejected(s, "unknown", action)
        self.assert_rejected(s, pid, {**action, "revision": True})
        self.assertIsNone(Game.apply_action(s, pid, action)[1])
        self.assert_rejected(s, pid, action)

    def test_save_roundtrip_preserves_next_action(self):
        s = make_state()
        a = Game.bot_move(s, s["current_turn"])
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(s, restored)
        self.assertEqual(a, Game.bot_move(restored, restored["current_turn"]))
        restored["deck"].clear()
        self.assertTrue(s["deck"])

    def test_bots_depend_only_on_their_view(self):
        s = make_state()
        pid = s["current_turn"]
        before = Game.bot_move(s, pid)
        s["deck"].reverse()
        s["seed"] = "not public"
        for other, player in s["players"].items():
            if other != pid:
                player["money"] = 999
        self.assertEqual(before, Game.bot_move(s, pid))
        self.assertIsNone(choose_bot_action(Game.get_public_view(s, "viewer")))

    def test_bot_games_reach_final_with_component_conservation(self):
        for count in range(2, 7):
            for seed in (11, 131, 722):
                with self.subTest(count=count, seed=seed):
                    s = make_state(count, seed)
                    for _ in range(2500):
                        if s["game_over"]:
                            break
                        pid = s["current_turn"] or next(p for p in s["order"] if Game.get_legal_actions(s, p))
                        action = Game.bot_move(s, pid)
                        self.assertIsNotNone(action)
                        self.assertIsNone(Game.apply_action(s, pid, action)[1])
                        cards = [n for key in ("market", "deck", "removed", "discarded") for n in s[key] if n != 99]
                        cards += [n for p in s["players"].values() for n in p["plants"]]
                        self.assertEqual(sorted(cards), sorted(PLANTS))
                        for resource, total in TOTAL_RESOURCES.items():
                            stored = sum(p["resources"][resource] for p in s["players"].values())
                            self.assertLessEqual(stored + s["resource_market"][resource], total)
                        for player in s["players"].values():
                            self.assertGreaterEqual(player["money"], 0)
                            self.assertTrue(storage_valid(player["plants"], player["resources"]))
                    self.assertTrue(s["game_over"], (s["round"], s["phase"]))


if __name__ == "__main__":
    unittest.main()
