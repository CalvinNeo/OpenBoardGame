import unittest

from game.twelve_rivers import (
    TwelveRiversGame as Game,
    _current_river_space,
    board_spaces,
    current_actor,
    markaya_full,
    score_game,
    space_cost,
)
from game.twelve_rivers_data import (
    ALPACA_CARDS,
    ALPACA_SLOTS,
    BANNER,
    COLOR_MOST_POINTS,
    DOWNSTREAM,
    EARTH,
    FAIRY_KINDS,
    FAIRY_PER_KIND,
    FIRE,
    INSTRUMENT,
    LANTERN,
    LIGHT,
    MARKAYA_TILES,
    NET,
    PEARL_COUNTS,
    PEARL_POINTS,
    RAINBOW,
    SEA_ID,
    STARTING_MARKAYA,
    STRETCH_BY_ID,
    STRETCH_ORDER,
    STRETCHES,
    SUPPLIES,
    SUPPLY_KINDS,
    SUPPLY_PER_KIND,
    TOTAL_PEARLS,
    TOTAL_ROUNDS,
    VILLAGE_IDS,
    WATER,
    WIND,
    active_river_count,
    is_stretch_active,
)


def make_state(count=3, seed="t"):
    return Game.init_game({"seed": seed}, [
        {"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": True} for i in range(count)])


def act(state, action_type, pid=None, **fields):
    pid = pid or current_actor(state)
    action = {"type": action_type, "revision": state["revision"], **fields}
    events, error = Game.apply_action(state, pid, action)
    if error:
        raise AssertionError((action_type, pid, fields, error))
    return events


def hand_total(state, pid):
    return sum(state["players"][pid]["hand"].values())


def place(state, pid, space, **extra):
    """Place a marker, topping the hand up so the printed cost is always payable."""
    player = state["players"][pid]
    cost = space_cost(space)
    fields = {"space": space}
    if cost > 0:
        player["hand"][BANNER] = max(player["hand"][BANNER], cost)
        fields["pay"] = {BANNER: cost}
    fields.update(extra)
    act(state, "place_marker", pid=pid, **fields)


def free_river_space(state, prefix=None):
    """Cheapest free river space, so helper placements never need to pay."""
    count = len(state["seat_order"])
    spaces = [s for s in board_spaces(count)
              if "#" in s and s not in state["placements"]
              and (prefix is None or s.startswith(prefix))]
    spaces.sort(key=lambda s: (space_cost(s), s))
    return spaces[0]


def bare_state(count=2, seed="score"):
    state = make_state(count, seed=seed)
    for pid in state["seat_order"]:
        state["players"][pid]["markaya"] = []
        state["players"][pid]["alpaca"] = []
        state["players"][pid]["alpaca_cards"] = []
        state["players"][pid]["fairies"] = dict.fromkeys(FAIRY_KINDS, 0)
        state["players"][pid]["hand"] = dict.fromkeys(SUPPLY_KINDS, 0)
    return state


def add_tile(state, pid, tile_id, pearls):
    tile = next(t for t in MARKAYA_TILES + STARTING_MARKAYA if t["id"] == tile_id)
    entry = {"tile": tile_id, "spots": []}
    for index, color in enumerate(tile["spots"]):
        entry["spots"].append({"color": color, "pearl": pearls[index] if index < len(pearls) else None})
    state["players"][pid]["markaya"].append(entry)
    return entry


class CatalogTests(unittest.TestCase):
    def test_component_counts(self):
        self.assertEqual(TOTAL_PEARLS, 65)
        self.assertEqual(sum(PEARL_COUNTS.values()), 65)
        self.assertEqual(len(SUPPLY_KINDS) * SUPPLY_PER_KIND, 50)
        self.assertEqual(len(FAIRY_KINDS) * FAIRY_PER_KIND, 25)
        self.assertEqual(len(MARKAYA_TILES), 26)
        self.assertEqual(len(STARTING_MARKAYA), 4)
        self.assertEqual(len(ALPACA_CARDS), 5)

    def test_pearl_values_rise_with_rarity(self):
        self.assertEqual([PEARL_POINTS[c] for c in ("green", "blue", "pink", "purple", "white")],
                         [1, 2, 3, 4, 5])
        self.assertEqual(PEARL_COUNTS["green"], 17)
        self.assertEqual(PEARL_COUNTS["white"], 9)

    def test_board_topology(self):
        rows = {}
        for stretch in STRETCHES:
            rows.setdefault(stretch["row"], []).append(stretch)
        self.assertEqual(sorted(rows), [1, 2, 3, 4, 5])
        self.assertEqual([len(rows[r]) for r in (1, 2, 3, 4, 5)], [12, 6, 3, 2, 1])
        self.assertEqual([rows[r][0]["cost"] for r in (1, 2, 3, 4, 5)], [3, 2, 1, 0, -1])
        for row in (1, 2, 3, 4, 5):
            for stretch in rows[row]:
                self.assertEqual(stretch["slots"], row)

    def test_rivers_converge_and_reach_the_sea(self):
        self.assertEqual(DOWNSTREAM["r5s1"], SEA_ID)
        for stretch in STRETCHES:
            if stretch["row"] == 5:
                continue
            target = STRETCH_BY_ID[DOWNSTREAM[stretch["id"]]]
            self.assertEqual(target["row"], stretch["row"] + 1)
            self.assertTrue(set(stretch["rivers"]).issubset(set(target["rivers"])))
        # Every river ends up in the single final stretch.
        self.assertEqual(set(STRETCH_BY_ID["r5s1"]["rivers"]), set(range(1, 13)))

    def test_resolution_order_is_top_down_left_to_right(self):
        self.assertEqual(STRETCH_ORDER[:12], tuple(f"r1s{i}" for i in range(1, 13)))
        self.assertEqual(STRETCH_ORDER[-1], "r5s1")

    def test_active_rivers_scale_with_players(self):
        self.assertEqual(active_river_count(2), 6)
        self.assertEqual(active_river_count(3), 9)
        self.assertEqual(active_river_count(4), 12)
        self.assertTrue(is_stretch_active("r1s6", 2))
        self.assertFalse(is_stretch_active("r1s7", 2))
        self.assertTrue(is_stretch_active("r1s12", 4))

    def test_village_costs(self):
        self.assertEqual([space_cost(v) for v in VILLAGE_IDS], [2, 1, 0, 0, 0, 0])
        self.assertEqual(space_cost(SEA_ID), 0)
        self.assertEqual(space_cost("r1s1#1"), 3)
        self.assertEqual(space_cost("r5s1#1"), -1)

    def test_board_spaces_exclude_inactive_rivers(self):
        def expected(count):
            total = 1 + 6
            for stretch in STRETCHES:
                if is_stretch_active(stretch["id"], count):
                    total += stretch["slots"]
            return total
        for count in (2, 3, 4):
            self.assertEqual(len(board_spaces(count)), expected(count))
        self.assertLess(len(board_spaces(2)), len(board_spaces(4)))
        self.assertFalse(any(s.startswith("r1s7") for s in board_spaces(2)))


class SetupTests(unittest.TestCase):
    def test_initial_state(self):
        state = make_state(3)
        self.assertEqual(state["round"], 1)
        self.assertEqual(state["phase"], "exploration")
        self.assertEqual(len(state["track"]), 9)
        self.assertEqual(len(state["markaya_display"]), 6)
        self.assertEqual(len(state["supply_display"]), 3)
        for pid in state["seat_order"]:
            self.assertEqual(hand_total(state, pid), 6)
            self.assertEqual(len(state["players"][pid]["markaya"]), 1)
            self.assertEqual(len(state["players"][pid]["alpaca"]), 0)

    def test_first_round_pearls_only_on_active_rivers(self):
        state = make_state(2)
        for index in range(1, 7):
            self.assertEqual(len(state["pools"][f"r1s{index}"]), 1)
        for index in range(7, 13):
            self.assertEqual(state["pools"][f"r1s{index}"], [])

    def test_first_round_fairies_match_player_count(self):
        for count in (2, 3, 4):
            state = make_state(count, seed=f"f{count}")
            placed = sum(len(stack) for stack in state["fairy_spots"].values())
            self.assertEqual(placed, count)

    def test_bag_holds_every_pearl_not_yet_dealt(self):
        state = make_state(4)
        on_board = sum(len(p) for p in state["pools"].values()) + len(state["sea"])
        self.assertEqual(len(state["bag"]) + on_board, TOTAL_PEARLS)


class ExplorationTests(unittest.TestCase):
    def test_cost_must_be_paid_exactly(self):
        state = make_state(2)
        pid = current_actor(state)
        events, error = Game.apply_action(state, pid, {
            "type": "place_marker", "space": "r1s1#1", "revision": state["revision"]})
        self.assertIn("costs 3", error)
        events, error = Game.apply_action(state, pid, {
            "type": "place_marker", "space": "r1s1#1", "pay": {"banner": 1},
            "revision": state["revision"]})
        self.assertIn("costs 3", error)

    def test_free_and_gaining_spaces(self):
        state = make_state(2)
        pid = current_actor(state)
        before = hand_total(state, pid)
        act(state, "place_marker", pid=pid, space="r4s1#1")
        self.assertEqual(hand_total(state, pid), before)
        pid = current_actor(state)
        before = hand_total(state, pid)
        act(state, "place_marker", pid=pid, space="r5s1#1")
        self.assertEqual(hand_total(state, pid), before + 1)

    def test_fire_fairy_reduces_cost(self):
        state = make_state(2)
        pid = current_actor(state)
        state["players"][pid]["fairies"][FIRE] = 1
        state["players"][pid]["hand"] = dict.fromkeys(SUPPLY_KINDS, 0)
        state["players"][pid]["hand"][BANNER] = 2
        act(state, "place_marker", pid=pid, space="r1s1#1", pay={"banner": 2}, fire=1)
        self.assertEqual(state["players"][pid]["fairies"][FIRE], 0)
        self.assertEqual(state["players"][pid]["hand"][BANNER], 0)

    def test_wind_fairy_ignores_cost(self):
        state = make_state(2)
        pid = current_actor(state)
        state["players"][pid]["fairies"][WIND] = 1
        state["players"][pid]["hand"] = dict.fromkeys(SUPPLY_KINDS, 0)
        act(state, "place_marker", pid=pid, space="r1s1#1", wind=True)
        self.assertEqual(state["players"][pid]["fairies"][WIND], 0)
        self.assertIn("r1s1#1", state["placements"])

    def test_placing_next_to_a_fairy_takes_every_fairy_there(self):
        state = make_state(3)
        state["fairy_spots"]["stump1"] = [FIRE, WATER]
        pid = current_actor(state)
        state["players"][pid]["hand"] = dict.fromkeys(SUPPLY_KINDS, 0)
        state["players"][pid]["hand"][BANNER] = 3
        act(state, "place_marker", pid=pid, space="r2s1#1", pay={"banner": 2})
        self.assertEqual(state["fairy_spots"]["stump1"], [])
        self.assertEqual(state["players"][pid]["fairies"][FIRE], 1)
        self.assertEqual(state["players"][pid]["fairies"][WATER], 1)

    def test_marker_leaves_the_track_when_placed(self):
        state = make_state(2)
        first = state["track"][0]
        act(state, "place_marker", pid=first["pid"], space="r4s1#1")
        self.assertNotIn(first, state["track"])
        self.assertEqual(state["placements"]["r4s1#1"]["pid"], first["pid"])

    def test_banner_pair_moves_a_marker_to_the_front(self):
        state = make_state(3)
        pid = current_actor(state)
        state["players"][pid]["hand"][BANNER] = 2
        act(state, "place_marker", pid=pid, space="r4s1#1", pairs=[{"kind": BANNER}])
        self.assertEqual(state["track"][0]["pid"], pid)

    def test_lantern_pair_takes_a_fairy(self):
        state = make_state(3)
        pid = current_actor(state)
        state["players"][pid]["hand"][LANTERN] = 2
        state["fairy_spots"]["stump2"] = [EARTH]
        act(state, "place_marker", pid=pid, space="r4s1#1",
            pairs=[{"kind": LANTERN, "spot": "stump2"}])
        self.assertEqual(state["players"][pid]["fairies"][EARTH], 1)

    def test_supplies_pair_repositions_a_placed_marker(self):
        state = make_state(3)
        first = current_actor(state)
        act(state, "place_marker", pid=first, space="r4s1#1")
        second = current_actor(state)
        act(state, "place_marker", pid=second, space="r4s2#1")
        third = current_actor(state)
        state["players"][third]["hand"][SUPPLIES] = 2
        state["players"][third]["hand"] = dict.fromkeys(SUPPLY_KINDS, 0)
        state["players"][third]["hand"][SUPPLIES] = 2
        act(state, "place_marker", pid=third, space="r4s1#2",
            pairs=[{"kind": SUPPLIES, "from": "r4s1#2", "to": "r3s1#1"}])
        self.assertNotIn("r4s1#2", state["placements"])
        self.assertEqual(state["placements"]["r3s1#1"]["pid"], third)

    def test_cannot_place_on_an_occupied_space(self):
        state = make_state(2)
        pid = current_actor(state)
        act(state, "place_marker", pid=pid, space="r4s1#1")
        pid = current_actor(state)
        events, error = Game.apply_action(state, pid, {
            "type": "place_marker", "space": "r4s1#1", "revision": state["revision"]})
        self.assertIn("already taken", error)

    def test_cannot_place_on_an_inactive_river(self):
        state = make_state(2)
        pid = current_actor(state)
        events, error = Game.apply_action(state, pid, {
            "type": "place_marker", "space": "r1s9#1", "revision": state["revision"]})
        self.assertIn("not in play", error)


class CollectionTests(unittest.TestCase):
    def setUp(self):
        self.state = make_state(2, seed="collect")
        self.pid = current_actor(self.state)
        self.state["pools"] = {key: [] for key in STRETCH_ORDER}
        self.state["pools"]["r1s1"] = ["white"]
        place(self.state, self.pid, "r1s1#1")

    def _finish_exploration(self):
        while self.state["phase"] == "exploration":
            pid = current_actor(self.state)
            place(self.state, pid, free_river_space(self.state))

    def test_collection_starts_once_the_track_is_empty(self):
        self._finish_exploration()
        self.assertEqual(self.state["phase"], "collection")
        self.assertEqual(self.state["stage"], "river")
        self.assertEqual(self.state["track"], [])

    def test_take_a_pearl_from_row_one(self):
        self._finish_exploration()
        actor = current_actor(self.state)
        self.assertEqual(actor, self.pid)
        act(self.state, "take_pearl", pid=actor, take=["white"])
        self.assertEqual(self.state["players"][self.pid]["alpaca"], ["white"])
        self.assertEqual(self.state["pools"]["r1s1"], [])

    def test_marker_returns_to_the_back_of_the_track(self):
        self._finish_exploration()
        actor = current_actor(self.state)
        act(self.state, "take_pearl", pid=actor, take=["white"])
        self.assertEqual(self.state["track"][-1]["pid"], self.pid)

    def test_declining_lets_pearls_roll_on(self):
        self._finish_exploration()
        actor = current_actor(self.state)
        act(self.state, "take_pearl", pid=actor, take=[])
        self.assertEqual(self.state["players"][self.pid]["alpaca"], [])
        self.assertEqual(self.state["pools"]["r1s1"], [])

    def test_cannot_take_a_pearl_that_is_not_there(self):
        self._finish_exploration()
        actor = current_actor(self.state)
        events, error = Game.apply_action(self.state, actor, {
            "type": "take_pearl", "take": ["green"], "revision": self.state["revision"]})
        self.assertIn("not available", error)

    def test_alpaca_holds_six_and_then_swaps(self):
        self._finish_exploration()
        self.state["players"][self.pid]["alpaca"] = ["green"] * ALPACA_SLOTS
        actor = current_actor(self.state)
        events, error = Game.apply_action(self.state, actor, {
            "type": "take_pearl", "take": ["white"], "revision": self.state["revision"]})
        self.assertIn("swap out exactly 1", error)
        act(self.state, "take_pearl", pid=actor, take=["white"], swap_out=["green"])
        self.assertEqual(self.state["players"][self.pid]["alpaca"].count("white"), 1)
        self.assertEqual(len(self.state["players"][self.pid]["alpaca"]), ALPACA_SLOTS)

    def test_fishing_net_pair_takes_one_extra(self):
        self._finish_exploration()
        self.state["pools"]["r1s1"] = ["white", "purple"]
        self.state["players"][self.pid]["hand"][NET] = 2
        actor = current_actor(self.state)
        act(self.state, "take_pearl", pid=actor, take=["white", "purple"], net=True)
        self.assertEqual(sorted(self.state["players"][self.pid]["alpaca"]), ["purple", "white"])
        self.assertEqual(self.state["players"][self.pid]["hand"][NET], 0)

    def test_water_fairy_takes_two(self):
        self._finish_exploration()
        self.state["pools"]["r1s1"] = ["white", "purple"]
        self.state["players"][self.pid]["fairies"][WATER] = 1
        actor = current_actor(self.state)
        act(self.state, "take_pearl", pid=actor, take=["white", "purple"], water=True)
        self.assertEqual(len(self.state["players"][self.pid]["alpaca"]), 2)
        self.assertEqual(self.state["players"][self.pid]["fairies"][WATER], 0)

    def test_upstream_marker_resolves_before_a_lower_slot(self):
        state = make_state(2, seed="order")
        first = current_actor(state)
        place(state, first, "r1s1#1")
        second = current_actor(state)
        state["pools"]["r1s1"] = ["white"]
        place(state, second, "r2s1#1")
        third = current_actor(state)
        place(state, third, "r2s1#2")
        while state["phase"] == "exploration":
            place(state, current_actor(state), free_river_space(state))
        self.assertEqual(current_actor(state), first)
        act(state, "take_pearl", pid=first, take=["white"])
        # the pearl is gone, so the next marker in the same river gets nothing
        self.assertEqual(current_actor(state), second)
        act(state, "take_pearl", pid=second, take=[])
        self.assertEqual(current_actor(state), third)


class VillageTests(unittest.TestCase):
    def _to_village(self, count=2, seed="vill", village_markers=1):
        state = make_state(count, seed=seed)
        placed = 0
        while state["phase"] == "exploration":
            pid = current_actor(state)
            if placed < village_markers:
                free = next(v for v in VILLAGE_IDS if v not in state["placements"])
                place(state, pid, free)
                placed += 1
            else:
                place(state, pid, free_river_space(state))
        # clear the river and sea stages
        while state["stage"] in ("river", "sea"):
            actor = current_actor(state)
            if actor is None:
                break
            if state["stage"] == "river":
                act(state, "take_pearl", pid=actor, take=[])
            else:
                act(state, "take_sea_pearls", pid=actor, take=[])
        return state

    def test_befriend_takes_a_markaya_and_grants_cards(self):
        state = self._to_village()
        self.assertEqual(state["stage"], "village")
        actor = current_actor(state)
        before = hand_total(state, actor)
        display = list(state["markaya_display"])
        index = next(i for i, tile in enumerate(display)
                     if next(t for t in MARKAYA_TILES if t["id"] == tile)["cards"] > 0)
        cards = next(t for t in MARKAYA_TILES if t["id"] == display[index])["cards"]
        act(state, "befriend", pid=actor, index=index)
        self.assertEqual(len(state["players"][actor]["markaya"]), 2)
        self.assertEqual(hand_total(state, actor), before + cards)
        self.assertEqual(len(state["markaya_display"]), 5)

    def test_instrument_pair_moves_right_and_takes_again(self):
        state = self._to_village(count=2, seed="instr")
        actor = current_actor(state)
        state["players"][actor]["hand"][INSTRUMENT] = 2
        act(state, "befriend", pid=actor, index=0, instrument=True)
        self.assertEqual(len(state["players"][actor]["markaya"]), 2)
        self.assertEqual(state["players"][actor]["hand"][INSTRUMENT], 0)
        # same marker, one space further right
        occupied = [v for v in VILLAGE_IDS if v in state["placements"]]
        self.assertEqual(len(occupied), 1)
        act(state, "befriend", pid=actor, index=0)
        self.assertEqual(len(state["players"][actor]["markaya"]), 3)


class DeliveryTests(unittest.TestCase):
    def _to_deliver(self, seed="deliver"):
        state = make_state(2, seed=seed)
        while state["phase"] == "exploration":
            pid = current_actor(state)
            free = next(v for v in VILLAGE_IDS if v not in state["placements"])
            place(state, pid, free)
        while state["stage"] in ("river", "sea", "village"):
            actor = current_actor(state)
            if actor is None:
                break
            if state["stage"] == "river":
                act(state, "take_pearl", pid=actor, take=[])
            elif state["stage"] == "sea":
                act(state, "take_sea_pearls", pid=actor, take=[])
            else:
                act(state, "befriend", pid=actor, index=0)
        return state

    def test_delivery_respects_spot_colour(self):
        state = self._to_deliver()
        self.assertEqual(state["stage"], "deliver")
        pid = state["seat_order"][0]
        entry = state["players"][pid]["markaya"][0]
        wrong = next(i for i, spot in enumerate(entry["spots"])
                     if spot["color"] not in (RAINBOW, "green"))
        state["players"][pid]["alpaca"] = ["green"]
        events, error = Game.apply_action(state, pid, {
            "type": "deliver", "moves": [{"tile": 0, "spot": wrong, "pearl": 0}],
            "revision": state["revision"]})
        self.assertIn("does not match", error)

    def test_rainbow_spot_accepts_any_colour(self):
        state = self._to_deliver(seed="rainbow")
        pid = state["seat_order"][0]
        entry = state["players"][pid]["markaya"][0]
        entry["spots"][0]["color"] = RAINBOW
        state["players"][pid]["alpaca"] = ["white"]
        act(state, "deliver", pid=pid, moves=[{"tile": 0, "spot": 0, "pearl": 0}])
        spot = state["players"][pid]["markaya"][0]["spots"][0]
        self.assertEqual(spot["pearl"], "white")
        self.assertEqual(state["players"][pid]["alpaca"], [])

    def test_light_fairy_turns_a_spot_into_a_rainbow(self):
        state = self._to_deliver(seed="light")
        pid = state["seat_order"][0]
        entry = state["players"][pid]["markaya"][0]
        entry["spots"][0]["color"] = "purple"
        state["players"][pid]["alpaca"] = ["white"]
        state["players"][pid]["fairies"][LIGHT] = 1
        act(state, "deliver", pid=pid,
            moves=[{"tile": 0, "spot": 0, "pearl": 0, "light": True}])
        spot = state["players"][pid]["markaya"][0]["spots"][0]
        self.assertEqual(spot["pearl"], "white")
        self.assertEqual(spot["color"], RAINBOW)
        self.assertEqual(state["players"][pid]["fairies"][LIGHT], 0)

    def test_earth_fairy_moves_pearls_from_the_alpaca(self):
        state = self._to_deliver(seed="earth")
        pid = state["seat_order"][0]
        entry = state["players"][pid]["markaya"][0]
        entry["spots"][0]["color"] = "green"
        state["players"][pid]["alpaca"] = ["green"]
        state["players"][pid]["fairies"][EARTH] = 1
        act(state, "use_fairy", pid=pid, kind="earth",
            moves=[{"tile": 0, "spot": 0, "pearl": 0}])
        self.assertEqual(state["players"][pid]["markaya"][0]["spots"][0]["pearl"], "green")
        self.assertEqual(state["players"][pid]["fairies"][EARTH], 0)

    def test_round_ends_only_when_everyone_has_delivered(self):
        state = self._to_deliver(seed="roundend")
        first, second = state["seat_order"][0], state["seat_order"][1]
        act(state, "deliver", pid=first, moves=[])
        self.assertEqual(state["phase"], "collection")
        act(state, "deliver", pid=second, moves=[])
        self.assertEqual(state["phase"], "round_end")


class ScoringTests(unittest.TestCase):
    def test_pearl_points_by_colour(self):
        state = bare_state()
        pid = state["seat_order"][0]
        add_tile(state, pid, "start1", ["green", "blue", "pink", "purple"])
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["pearls"], 1 + 2 + 3 + 4)

    def test_alpaca_pearls_score_nothing(self):
        state = bare_state()
        pid = state["seat_order"][0]
        state["players"][pid]["alpaca"] = ["white", "white"]
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["total"], 0)

    def test_full_each_pays_three_per_completed_tile(self):
        state = bare_state()
        pid = state["seat_order"][0]
        add_tile(state, pid, "start1", ["green", "blue", "pink", "purple"])
        add_tile(state, pid, "mk15", ["green", "blue", "pink", "purple"])
        results = {row["player_id"]: row for row in score_game(state)}
        # start1 (3) + mk15 (3) + mk15's own full_each counting both tiles (6)
        self.assertEqual(results[pid]["bonuses"], 3 + 3 + 6)

    def test_colour_most_needs_a_strict_lead(self):
        state = bare_state()
        first, second = state["seat_order"]
        add_tile(state, first, "mk01", ["green", "green", "blue", "white"])
        add_tile(state, second, "mk01", ["green", "green", "blue", "white"])
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[first]["bonuses"], 0)
        self.assertEqual(results[second]["bonuses"], 0)
        # Give the second player one more green elsewhere for a strict lead.
        add_tile(state, second, "mk11", ["green", None, None, None])
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[second]["bonuses"], COLOR_MOST_POINTS["green"])

    def test_introverted_tiles_need_every_spot_filled(self):
        state = bare_state()
        pid = state["seat_order"][0]
        add_tile(state, pid, "mk19", ["green", "blue", None])
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["bonuses"], 0)
        state["players"][pid]["markaya"][0]["spots"][2]["pearl"] = "pink"
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["bonuses"], 8)

    def test_five_different_colours_on_one_tile(self):
        state = bare_state()
        pid = state["seat_order"][0]
        add_tile(state, pid, "mk24", ["green", "blue", "pink", "purple", "white"])
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["bonuses"], 5)

    def test_four_of_a_colour_on_one_tile(self):
        state = bare_state()
        pid = state["seat_order"][0]
        add_tile(state, pid, "mk23", ["green", "green", "green", "green"])
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["bonuses"], 6)

    def test_card_and_fairy_objectives(self):
        state = bare_state()
        first, second = state["seat_order"]
        add_tile(state, first, "mk13", [None, None, None])
        state["players"][first]["hand"][BANNER] = 4
        add_tile(state, second, "mk13", [None, None, None])
        state["players"][second]["hand"][BANNER] = 1
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[first]["bonuses"], 4)
        self.assertEqual(results[second]["bonuses"], 1)

    def test_alpaca_card_is_worth_four(self):
        state = bare_state()
        pid = state["seat_order"][0]
        state["players"][pid]["alpaca_cards"] = ["alp_white"]
        results = {row["player_id"]: row for row in score_game(state)}
        self.assertEqual(results[pid]["alpaca"], 4)


class FullGameTests(unittest.TestCase):
    def _play(self, count, seed):
        state = make_state(count, seed=seed)
        steps = 0
        while not state["game_over"] and steps < 4000:
            steps += 1
            progressed = False
            for pid in state["seat_order"]:
                if not Game.get_legal_actions(state, pid):
                    continue
                action = Game.bot_move(state, pid)
                self.assertIsNotNone(action, f"bot stalled in {state['phase']}/{state['stage']}")
                events, error = Game.apply_action(state, pid, action)
                self.assertIsNone(error, f"{action} -> {error}")
                progressed = True
                break
            self.assertTrue(progressed, f"game stalled in {state['phase']}/{state['stage']}")
        return state, steps

    def test_two_player_game_finishes(self):
        state, _ = self._play(2, "full2")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["round"], TOTAL_ROUNDS)
        self.assertEqual(len(state["final_results"]), 2)
        self.assertTrue(state["winner_ids"])

    def test_three_and_four_player_games_finish(self):
        for count in (3, 4):
            state, _ = self._play(count, f"full{count}")
            self.assertTrue(state["game_over"])
            self.assertEqual(len(state["final_results"]), count)

    def test_every_pearl_is_accounted_for(self):
        state, _ = self._play(4, "conserve")
        held = len(state["bag"]) + len(state["sea"]) + sum(len(p) for p in state["pools"].values())
        for pid in state["seat_order"]:
            player = state["players"][pid]
            held += len(player["alpaca"])
            for entry in player["markaya"]:
                held += sum(1 for spot in entry["spots"] if spot["pearl"])
        self.assertEqual(held, TOTAL_PEARLS)

    def test_ties_share_the_win(self):
        state = bare_state()
        state["phase"] = "round_end"
        state["round"] = TOTAL_ROUNDS
        for pid in state["seat_order"]:
            state["players"][pid]["ready_next"] = True
        from game.twelve_rivers import _start_next_round
        _start_next_round(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(len(state["winner_ids"]), 2)


if __name__ == "__main__":
    unittest.main()
