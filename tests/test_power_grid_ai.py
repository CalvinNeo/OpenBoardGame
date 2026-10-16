"""Strategic regressions exercised through the public Power Grid bot API."""

import copy
import unittest

from game.power_grid import (
    PowerGridGame as Game,
    _set_phase,
    build_quotes,
    choose_bot_action,
    dispatch_options,
    empty_resources,
    storage_valid,
)


def make_state(count: int = 3) -> dict:
    state = Game.init_game({"seed": 131}, [
        {"player_id": f"p{i}", "name": f"Company {i}", "seat": i, "is_bot": True}
        for i in range(count)
    ])
    state["round"] = 5
    return state


def place_network(state: dict, pid: str, cities: list) -> None:
    for owners in state["cities"].values():
        if pid in owners:
            owners.remove(pid)
    state["players"][pid]["cities"] = list(cities)
    for city in cities:
        state["cities"][city].append(pid)


def endgame_state() -> dict:
    state = make_state()
    state.update(step=3, market=[], deck=[])
    cities = list(state["cities"])
    place_network(state, "p0", cities[:16])
    place_network(state, "p1", cities[:16])
    state["players"]["p0"]["money"] = 100
    # p0 acts after the other companies, so its choice can settle this round.
    _set_phase(state, "building", ["p0"])
    return state


class PowerGridAITests(unittest.TestCase):
    def choose(self, state: dict, pid: str = "p0") -> dict:
        """Check determinism, public-view isolation, and legal application."""
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, pid)
        view_before = copy.deepcopy(view)
        policy_action = choose_bot_action(view)
        self.assertEqual(view, view_before)
        self.assertEqual(policy_action, choose_bot_action(copy.deepcopy(view)))
        action = Game.bot_move(state, pid)
        self.assertIsNotNone(action)
        self.assertEqual(state, before)
        expected = {**policy_action, "round": view["round"]}
        if action["type"] != "next_round":
            expected["revision"] = view["revision"]
        self.assertEqual(action, expected)
        _, error = Game.apply_action(copy.deepcopy(state), pid, action)
        self.assertIsNone(error, action)
        return action

    def apply_bot(self, state: dict, pid: str = "p0") -> dict:
        action = self.choose(state, pid)
        self.assertIsNone(Game.apply_action(state, pid, action)[1])
        return action

    def resource_scenario(self, money: int) -> dict:
        state = make_state()
        place_network(state, "p0", ["flensburg"])
        state["players"]["p0"].update(plants=[10, 13], money=money)
        state["resource_market"]["coal"] = 18
        _set_phase(state, "resources", ["p0"])
        self.assertEqual(build_quotes(state, "p0")[0]["cost"], 14)
        return state

    def test_resources_do_not_fund_load_that_cannot_be_built(self):
        state = self.resource_scenario(money=18)
        # Two coal cost 6, leaving 12. Kiel costs 14, and the existing
        # wind plant already supplies the only city currently connected.
        action = self.choose(state)
        self.assertEqual(action["type"], "done")

    def test_resources_leave_actual_connection_cost_for_productive_expansion(self):
        state = self.resource_scenario(money=20)
        action = self.apply_bot(state)
        self.assertEqual(action["type"], "buy_resources")
        self.assertEqual(state["players"]["p0"]["resources"]["coal"], 2)
        self.assertGreaterEqual(state["players"]["p0"]["money"], 14)
        self.assertEqual(self.choose(state)["type"], "done")
        _set_phase(state, "building", ["p0"])
        self.assertEqual(self.apply_bot(state)["type"], "build")
        player = state["players"]["p0"]
        self.assertEqual(len(player["cities"]), 2)
        self.assertEqual(max(o["powered"] for o in dispatch_options(
            player["plants"], player["resources"], len(player["cities"]))), 2)

    def test_hybrid_can_buy_oil_when_coal_market_is_empty(self):
        state = make_state()
        place_network(state, "p0", ["essen"])
        state["players"]["p0"].update(plants=[5], money=20)
        state["resource_market"]["coal"] = 0
        _set_phase(state, "resources", ["p0"])
        action = self.apply_bot(state)
        self.assertEqual(action["type"], "buy_resources")
        self.assertEqual(state["players"]["p0"]["resources"]["coal"], 0)
        self.assertGreaterEqual(state["players"]["p0"]["resources"]["oil"], 2)
        self.assertTrue(storage_valid([5], state["players"]["p0"]["resources"]))

    def test_power_does_not_burn_fuel_beyond_connected_load(self):
        state = make_state()
        place_network(state, "p0", list(state["cities"])[:5])
        state["players"]["p0"].update(
            plants=[42, 50], resources={**empty_resources(), "coal": 2})
        _set_phase(state, "bureaucracy", ["p0", "p1", "p2"])
        self.apply_bot(state)
        self.assertEqual(state["production"][-1]["powered"], 5)
        self.assertEqual(state["players"]["p0"]["resources"]["coal"], 2)

    def test_power_preserves_expensive_hybrid_fuel(self):
        state = make_state()
        place_network(state, "p0", list(state["cities"])[:4])
        state["players"]["p0"].update(
            plants=[29], resources={**empty_resources(), "coal": 1, "oil": 1})
        state["resource_market"].update(coal=1, oil=23)
        _set_phase(state, "bureaucracy", ["p0", "p1", "p2"])
        self.apply_bot(state)
        self.assertEqual(state["production"][-1]["powered"], 4)
        self.assertEqual(state["players"]["p0"]["resources"]["coal"], 1)
        self.assertEqual(state["players"]["p0"]["resources"]["oil"], 0)

    def test_power_saves_fuel_when_extra_income_cannot_cover_its_value(self):
        state = make_state(count=2)
        place_network(state, "p0", list(state["cities"])[:16])
        state["players"]["p0"].update(
            plants=[36, 37, 44, 50], resources={**empty_resources(), "coal": 3})
        state["resource_market"]["coal"] = 3
        _set_phase(state, "bureaucracy", ["p0", "p1"])
        self.apply_bot(state)
        # Wind supplies 15 cities for 134; one extra city earns only 4,
        # while running plant 36 consumes three coal worth 24.
        self.assertEqual(state["production"][-1]["powered"], 15)
        self.assertEqual(state["players"]["p0"]["resources"]["coal"], 3)

    def test_replacement_keeps_new_plant_and_valid_hybrid_storage(self):
        state = make_state()
        state.update(phase="replace", current_turn="p0", new_plant=50)
        state["players"]["p0"].update(
            plants=[4, 5, 13, 50], resources={**empty_resources(), "coal": 6, "oil": 2})
        before = copy.deepcopy(state["players"]["p0"]["resources"])
        action = self.apply_bot(state)
        player = state["players"]["p0"]
        self.assertNotEqual(action["plant"], 50)
        self.assertEqual(len(player["plants"]), 3)
        self.assertTrue(storage_valid(player["plants"], player["resources"]))
        for resource, amount in player["resources"].items():
            self.assertLessEqual(amount, before[resource])

    def test_replacement_retires_inefficient_plant_at_equal_capacity(self):
        state = make_state()
        state.update(phase="replace", current_turn="p0", new_plant=50)
        state["players"]["p0"].update(
            plants=[20, 25, 44, 50], resources={**empty_resources(), "coal": 4})
        action = self.apply_bot(state)
        self.assertEqual(action["plant"], 20)
        self.assertEqual(state["players"]["p0"]["resources"]["coal"], 4)

    def test_building_does_not_trigger_a_certain_loss_with_unfueled_capacity(self):
        state = endgame_state()
        state["players"]["p0"]["plants"] = [36, 44, 50]
        state["players"]["p1"].update(
            plants=[33, 37, 42], resources={**empty_resources(), "coal": 2})
        # The nominal 18-city capacity is only 11 without coal. The rival
        # can supply 14, so connecting city 17 would immediately lose.
        self.assertEqual(self.apply_bot(state)["type"], "done")
        self.assertFalse(state["game_over"])

    def test_building_finishes_game_when_fueled_network_wins(self):
        state = endgame_state()
        state["players"]["p0"].update(
            plants=[36, 38, 50], resources={**empty_resources(), "coal": 3, "garbage": 3})
        state["players"]["p1"]["plants"] = [33, 37, 44]
        self.assertEqual(self.apply_bot(state)["type"], "build")
        for _ in range(8):
            if state["game_over"]:
                break
            self.apply_bot(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner_ids"], ["p0"])

    def test_auction_bid_does_not_exhaust_cash_needed_for_first_city(self):
        state = make_state()
        state.update(round=1, current_turn="p0")
        state["auction"] = {"plant": 4, "bid": 41, "leader": "p1",
                            "initiator": "p1", "active": ["p0", "p1", "p2"]}
        self.assertEqual(self.choose(state)["type"], "pass")


if __name__ == "__main__":
    unittest.main()
