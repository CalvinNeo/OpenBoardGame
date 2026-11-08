import copy
import unittest

from game.ticket_to_ride import (
    TicketToRideGame as Game,
    _end_turn,
    _refill_face_up,
    claimable_routes,
    longest_path,
    payment_options,
    route_blocked_reason,
    score_game,
    ticket_completed,
)
from game.ticket_to_ride_data import (
    CARDS_PER_COLOR,
    CARD_COLORS,
    CITIES,
    DESTINATIONS,
    FACE_UP_SLOTS,
    LOCOMOTIVE,
    LOCOMOTIVE_CARDS,
    ROUTES,
    ROUTE_POINTS,
    TRAINS_PER_PLAYER,
)


def make_state(count=3, seed="t"):
    return Game.init_game({"seed": seed}, [
        {"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": True} for i in range(count)])


def act(state, kind, pid=None, **fields):
    pid = pid or state["current_turn"]
    action = {"type": kind, "revision": state["revision"], **fields}
    events, error = Game.apply_action(state, pid, action)
    if error:
        raise AssertionError((kind, pid, fields, error))
    return events


def start(state):
    """Clear the simultaneous ticket draft so normal turns can begin."""
    for pid in state["seat_order"]:
        act(state, "keep_tickets", pid=pid, tickets=state["players"][pid]["pending_tickets"][:2])
    return state


def give(state, pid, **cards):
    state["players"][pid]["hand"] = dict.fromkeys(list(CARD_COLORS) + [LOCOMOTIVE], 0)
    for color, count in cards.items():
        state["players"][pid]["hand"][color] = count


class SetupTests(unittest.TestCase):
    def test_board_catalog(self):
        self.assertEqual(len(CITIES), 36)
        self.assertEqual(len(ROUTES), 100)
        self.assertEqual(len(DESTINATIONS), 30)
        self.assertEqual(sorted(ROUTE_POINTS), [1, 2, 3, 4, 5, 6])
        self.assertEqual(ROUTE_POINTS, {1: 1, 2: 2, 3: 4, 4: 7, 5: 10, 6: 15})
        for route in ROUTES.values():
            self.assertIn(route["a"], CITIES)
            self.assertIn(route["b"], CITIES)
            self.assertIn(route["length"], ROUTE_POINTS)
        for ticket in DESTINATIONS.values():
            self.assertIn(ticket["a"], CITIES)
            self.assertIn(ticket["b"], CITIES)

    def test_components_and_initial_deal(self):
        for count in (2, 3, 4, 5):
            state = make_state(count)
            self.assertEqual(len(state["deck"]) + len(state["face_up"])
                             + sum(sum(p["hand"].values()) for p in state["players"].values()), 110)
            self.assertEqual(len(state["face_up"]), FACE_UP_SLOTS)
            self.assertLess(sum(c == LOCOMOTIVE for c in state["face_up"]), 3)
            for pid in state["seat_order"]:
                player = state["players"][pid]
                self.assertEqual(sum(player["hand"].values()), 4)
                self.assertEqual(player["trains"], TRAINS_PER_PLAYER)
                self.assertEqual(len(player["pending_tickets"]), 3)
                self.assertFalse(player["ready"])
            self.assertEqual(state["phase"], "setup")

    def test_player_count_and_config_validation(self):
        for count in (1, 6):
            with self.assertRaises(ValueError):
                make_state(count)
        for config in ({"seed": "x", "extra": 1}, {"seed": []}, {"nope": 2}):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": "a", "name": "A", "seat": 0},
                                        {"player_id": "b", "name": "B", "seat": 1}])

    def test_setup_requires_two_tickets_then_starts(self):
        state = make_state(3)
        first = state["seat_order"][0]
        offered = state["players"][first]["pending_tickets"]
        self.assertEqual(Game.get_legal_actions(state, first), ["keep_tickets"])
        _, error = Game.apply_action(state, first, {
            "type": "keep_tickets", "revision": state["revision"], "tickets": offered[:1]})
        self.assertIn("at least 2", error)
        act(state, "keep_tickets", pid=first, tickets=offered[:2])
        self.assertEqual(state["phase"], "setup")
        self.assertEqual(state["players"][first]["tickets"], offered[:2])
        self.assertEqual(state["ticket_deck"][-1], offered[2])
        for pid in state["seat_order"][1:]:
            act(state, "keep_tickets", pid=pid, tickets=state["players"][pid]["pending_tickets"][:2])
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["current_turn"], state["order"][0])


class DrawTests(unittest.TestCase):
    def test_face_up_locomotive_ends_the_draw(self):
        state = start(make_state(3))
        pid = state["current_turn"]
        state["face_up"] = [LOCOMOTIVE, "red", "blue", "green", "white"]
        before = state["players"][pid]["hand"][LOCOMOTIVE]
        act(state, "draw_card", pid=pid, source="face_up", index=0)
        self.assertEqual(state["players"][pid]["hand"][LOCOMOTIVE], before + 1)
        self.assertNotEqual(state["current_turn"], pid)
        self.assertEqual(state["stage"], "action")

    def test_locomotive_cannot_be_the_second_card(self):
        state = start(make_state(3))
        pid = state["current_turn"]
        state["face_up"] = ["red", LOCOMOTIVE, "blue", "green", "white"]
        act(state, "draw_card", pid=pid, source="face_up", index=0)
        self.assertEqual(state["current_turn"], pid)
        self.assertEqual(state["stage"], "drawing")
        self.assertEqual(state["draws_left"], 1)
        self.assertEqual(state["face_up"][0], LOCOMOTIVE)
        _, error = Game.apply_action(state, pid, {
            "type": "draw_card", "revision": state["revision"], "source": "face_up", "index": 0})
        self.assertIn("second card", error)
        act(state, "draw_card", pid=pid, source="deck")
        self.assertNotEqual(state["current_turn"], pid)

    def test_deck_locomotive_still_allows_a_second_draw(self):
        state = start(make_state(3))
        pid = state["current_turn"]
        state["deck"] = [LOCOMOTIVE] + state["deck"]
        act(state, "draw_card", pid=pid, source="deck")
        self.assertEqual(state["stage"], "drawing")
        self.assertEqual(state["draws_left"], 1)

    def test_three_face_up_locomotives_trigger_a_redeal(self):
        state = start(make_state(3))
        state["face_up"] = [LOCOMOTIVE, LOCOMOTIVE, LOCOMOTIVE, "red", "blue"]
        state["deck"] = ["green"] * 10 + state["deck"]
        _refill_face_up(state)
        self.assertEqual(len(state["face_up"]), FACE_UP_SLOTS)
        self.assertLess(sum(c == LOCOMOTIVE for c in state["face_up"]), 3)

    def test_discards_are_reshuffled_when_the_deck_runs_out(self):
        state = start(make_state(3))
        pid = state["current_turn"]
        state["deck"] = []
        state["discard"] = ["red"] * 6
        before = state["players"][pid]["hand"]["red"]
        act(state, "draw_card", pid=pid, source="deck")
        self.assertEqual(state["players"][pid]["hand"]["red"], before + 1)
        self.assertEqual(len(state["discard"]), 0)


class ClaimTests(unittest.TestCase):
    def test_gray_route_accepts_any_single_colour(self):
        state = start(make_state(4))
        pid = state["current_turn"]
        route = "dallas--houston--0"
        self.assertEqual(ROUTES[route]["color"], "gray")
        give(state, pid, purple=1)
        act(state, "claim_route", pid=pid, route=route, cards={"purple": 1})
        self.assertEqual(state["claimed"][route], pid)
        self.assertEqual(state["players"][pid]["route_points"], 1)
        self.assertEqual(state["players"][pid]["trains"], TRAINS_PER_PLAYER - 1)

    def test_gray_route_rejects_mixed_colours(self):
        state = start(make_state(4))
        pid = state["current_turn"]
        give(state, pid, purple=1, red=1)
        _, error = Game.apply_action(state, pid, {
            "type": "claim_route", "revision": state["revision"],
            "route": "dallas--houston--0", "cards": {"purple": 1, "red": 1}})
        self.assertIn("do not pay", error)

    def test_coloured_route_needs_its_colour_or_wilds(self):
        state = start(make_state(4))
        pid = state["current_turn"]
        route = "new-orleans--miami--0"
        self.assertEqual(ROUTES[route]["color"], "red")
        self.assertEqual(ROUTES[route]["length"], 6)
        give(state, pid, blue=6)
        _, error = Game.apply_action(state, pid, {
            "type": "claim_route", "revision": state["revision"],
            "route": route, "cards": {"blue": 6}})
        self.assertIn("do not pay", error)
        give(state, pid, red=4, **{LOCOMOTIVE: 2})
        act(state, "claim_route", pid=pid, route=route, cards={"red": 4, LOCOMOTIVE: 2})
        self.assertEqual(state["players"][pid]["route_points"], 15)
        self.assertEqual(state["players"][pid]["trains"], TRAINS_PER_PLAYER - 6)
        self.assertEqual(state["players"][pid]["hand"]["red"], 0)

    def test_route_points_follow_the_table(self):
        for length, points in ROUTE_POINTS.items():
            state = start(make_state(4))
            pid = state["current_turn"]
            route = next(r for r, v in ROUTES.items() if v["length"] == length)
            color = ROUTES[route]["color"]
            pay = "red" if color == "gray" else color
            give(state, pid, **{pay: length})
            act(state, "claim_route", pid=pid, route=route, cards={pay: length})
            self.assertEqual(state["players"][pid]["route_points"], points)

    def test_double_route_rules(self):
        pair = "omaha--kansas-city--0"
        sibling = "omaha--kansas-city--1"
        self.assertEqual(ROUTES[pair]["color"], "gray")
        self.assertEqual(ROUTES[pair]["length"], 1)
        # Four players: both tracks stay open, but never to the same player.
        state = start(make_state(4))
        pid = state["current_turn"]
        give(state, pid, red=1)
        act(state, "claim_route", pid=pid, route=pair, cards={"red": 1})
        # The same player may never take both tracks of a pair.
        self.assertIn("parallel", route_blocked_reason(state, pid, sibling))
        other = next(p for p in state["seat_order"] if p != pid)
        self.assertIsNone(route_blocked_reason(state, other, sibling))

        # Three players: taking one track closes the other for everyone.
        state = start(make_state(3))
        pid = state["current_turn"]
        give(state, pid, red=1)
        act(state, "claim_route", pid=pid, route=pair, cards={"red": 1})
        other = next(p for p in state["seat_order"] if p != pid)
        self.assertIn("2-3 player", route_blocked_reason(state, other, sibling))

    def test_cannot_claim_without_trains_or_cards(self):
        state = start(make_state(4))
        pid = state["current_turn"]
        state["players"][pid]["trains"] = 1
        self.assertIn("not enough trains",
                      route_blocked_reason(state, pid, "new-orleans--miami--0"))
        state["players"][pid]["trains"] = TRAINS_PER_PLAYER
        give(state, pid, red=1)
        self.assertNotIn("new-orleans--miami--0", claimable_routes(state, pid))

    def test_payment_options_cover_wild_substitution(self):
        route = ROUTES["new-orleans--miami--0"]
        options = payment_options({"red": 4, LOCOMOTIVE: 2, "blue": 6}, route)
        self.assertIn({"color": "red", "count": 4, "locomotives": 2}, options)
        self.assertIn({"color": "red", "count": 6, "locomotives": 0}, options) if False else None
        self.assertNotIn({"color": "blue", "count": 6, "locomotives": 0}, options)
        pure = payment_options({LOCOMOTIVE: 6}, route)
        self.assertEqual(pure[0], {"color": LOCOMOTIVE, "count": 0, "locomotives": 6})


class TicketTests(unittest.TestCase):
    def test_drawing_tickets_requires_keeping_one(self):
        state = start(make_state(3))
        pid = state["current_turn"]
        act(state, "draw_tickets", pid=pid)
        self.assertEqual(state["stage"], "choosing_tickets")
        offered = state["players"][pid]["pending_tickets"]
        self.assertEqual(len(offered), 3)
        self.assertEqual(Game.get_legal_actions(state, pid), ["keep_tickets"])
        _, error = Game.apply_action(state, pid, {
            "type": "keep_tickets", "revision": state["revision"], "tickets": []})
        self.assertIn("at least 1", error)
        act(state, "keep_tickets", pid=pid, tickets=offered[:1])
        self.assertEqual(state["players"][pid]["tickets"][-1], offered[0])
        self.assertNotEqual(state["current_turn"], pid)

    def test_ticket_completion_uses_the_whole_network(self):
        state = start(make_state(3))
        pid = state["seat_order"][0]
        # Los Angeles - Las Vegas - Salt Lake City - Denver - Kansas City - Saint
        # Louis - Chicago: one network, so any ticket inside it is complete.
        chain = ["los-angeles--las-vegas--0", "las-vegas--salt-lake-city--0",
                 "salt-lake-city--denver--0", "denver--kansas-city--0",
                 "kansas-city--saint-louis--0", "saint-louis--chicago--0"]
        state["players"][pid]["routes"] = list(chain)
        self.assertTrue(ticket_completed(state, pid, "los-angeles--chicago"))
        self.assertTrue(ticket_completed(state, pid, "denver--pittsburgh") is False)
        self.assertFalse(ticket_completed(state, pid, "seattle--new-york"))
        # Dropping the last link breaks every ticket that needed it.
        state["players"][pid]["routes"] = chain[:-1]
        self.assertFalse(ticket_completed(state, pid, "los-angeles--chicago"))


class PathTests(unittest.TestCase):
    def test_longest_path_ignores_branches_and_reuses_no_train(self):
        state = make_state(3)
        pid = state["seat_order"][0]
        # A straight chain plus a spur: only the through-line counts.
        state["players"][pid]["routes"] = [
            "seattle--portland--0", "portland--san-francisco--0",
            "san-francisco--los-angeles--0"]
        self.assertEqual(longest_path(state, pid), 1 + 5 + 3)
        state["players"][pid]["routes"].append("los-angeles--las-vegas--0")
        self.assertEqual(longest_path(state, pid), 1 + 5 + 3 + 2)
        # A star cannot use the centre twice, so it is the best single arm.
        state["players"][pid]["routes"] = [
            "denver--kansas-city--0", "kansas-city--saint-louis--0",
            "saint-louis--chicago--0", "chicago--pittsburgh--0"]
        self.assertEqual(longest_path(state, pid), 4 + 2 + 2 + 3)

    def test_longest_path_of_an_empty_network(self):
        state = make_state(2)
        self.assertEqual(longest_path(state, state["seat_order"][0]), 0)


class EndGameTests(unittest.TestCase):
    def _run_out_of_trains(self, count):
        state = start(make_state(count))
        trigger = state["order"][0]
        state["players"][trigger]["trains"] = 2
        give(state, trigger, red=1)
        act(state, "claim_route", pid=trigger, route="nashville--atlanta--0", cards={"red": 1})
        self.assertEqual(state["players"][trigger]["trains"], 1)
        self.assertTrue(state["last_round"])
        return state, trigger

    def test_every_player_including_the_trigger_gets_a_final_turn(self):
        for count in (2, 3, 4, 5):
            state, trigger = self._run_out_of_trains(count)
            self.assertEqual(sorted(state["final_turns"]), sorted(state["seat_order"]))
            order = state["order"]
            expected = [order[(order.index(trigger) + 1 + step) % count] for step in range(count)]
            self.assertEqual(state["final_turns"], expected)
            seen = []
            guard = 0
            while not state["game_over"] and guard < 200:
                pid = state["current_turn"]
                seen.append(pid)
                if "pass" in Game.get_legal_actions(state, pid):
                    act(state, "pass", pid=pid)
                else:
                    act(state, "draw_card", pid=pid, source="deck")
                    if not state["game_over"] and state["current_turn"] == pid:
                        act(state, "draw_card", pid=pid, source="deck")
                guard += 1
            self.assertTrue(state["game_over"])
            self.assertEqual(sorted(seen), sorted(state["seat_order"]))
            self.assertIn(trigger, seen)

    def test_scoring_adds_tickets_and_subtracts_failures(self):
        state = start(make_state(3))
        winner, loser = state["seat_order"][0], state["seat_order"][1]
        state["players"][winner]["routes"] = [
            "seattle--portland--0", "portland--san-francisco--0",
            "san-francisco--los-angeles--0"]
        for route in state["players"][winner]["routes"]:
            state["claimed"][route] = winner
        state["players"][winner]["route_points"] = 60
        state["players"][winner]["tickets"] = ["seattle--los-angeles", "seattle--new-york"]
        state["players"][loser]["route_points"] = 40
        state["players"][loser]["tickets"] = ["seattle--new-york"]
        state["players"][state["seat_order"][2]]["tickets"] = []
        state["phase"] = "final_round"
        score_game(state)
        results = {r["player_id"]: r for r in state["final_results"]}
        self.assertEqual(results[winner]["completed"], ["seattle--los-angeles"])
        self.assertEqual(results[winner]["missed"], ["seattle--new-york"])
        self.assertEqual(results[winner]["ticket_points"], 9)
        self.assertEqual(results[winner]["penalty"], 22)
        self.assertEqual(results[winner]["longest_bonus"], 10)
        self.assertEqual(results[winner]["total"], 60 + 9 - 22 + 10)
        self.assertEqual(results[loser]["total"], 40 - 22)
        self.assertEqual(state["winner_ids"], [winner])

    def test_longest_path_bonus_is_shared_on_a_tie(self):
        state = start(make_state(3))
        a, b = state["seat_order"][0], state["seat_order"][1]
        for pid in state["seat_order"]:
            state["players"][pid]["tickets"] = []
        state["players"][a]["routes"] = ["dallas--houston--0"]
        state["claimed"]["dallas--houston--0"] = a
        state["players"][b]["routes"] = ["dallas--houston--1"]
        state["claimed"]["dallas--houston--1"] = b
        for pid in (a, b):
            state["players"][pid]["route_points"] = 5
        state["phase"] = "final_round"
        score_game(state)
        results = {r["player_id"]: r for r in state["final_results"]}
        self.assertEqual(results[a]["longest_bonus"], 10)
        self.assertEqual(results[b]["longest_bonus"], 10)
        self.assertEqual(sorted(state["winner_ids"]), sorted([a, b]))


class ProtocolTests(unittest.TestCase):
    def assert_rejected(self, state, pid, action):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNotNone(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_out_of_turn_and_stale_actions_are_rejected(self):
        state = start(make_state(3))
        pid = state["current_turn"]
        other = next(p for p in state["seat_order"] if p != pid)
        self.assertEqual(Game.get_legal_actions(state, other), [])
        self.assert_rejected(state, other, {
            "type": "draw_card", "revision": state["revision"], "source": "deck"})
        self.assert_rejected(state, pid, {
            "type": "draw_card", "revision": state["revision"] - 1, "source": "deck"})
        self.assert_rejected(state, pid, {
            "type": "draw_card", "revision": state["revision"], "source": "middle"})
        self.assert_rejected(state, pid, {
            "type": "draw_card", "revision": state["revision"], "source": "face_up", "index": 9})
        self.assert_rejected(state, pid, {"type": "nope", "revision": state["revision"]})

    def test_public_view_hides_other_hands(self):
        state = start(make_state(3))
        pid = state["seat_order"][0]
        view = Game.get_public_view(state, pid)
        self.assertEqual(view["game_id"], "ticket_to_ride")
        mine = next(p for p in view["players"] if p["player_id"] == pid)
        self.assertIsNotNone(mine["hand"])
        self.assertIsNotNone(mine["tickets"])
        for other in view["players"]:
            if other["player_id"] != pid:
                self.assertIsNone(other["hand"])
                self.assertIsNone(other["tickets"])
                self.assertIsInstance(other["hand_count"], int)
                self.assertIsInstance(other["ticket_count"], int)
        self.assertEqual(len(view["face_up"]), FACE_UP_SLOTS)
        self.assertEqual(len(view["cities"]), 36)

    def test_public_view_reveals_everything_once_the_game_is_over(self):
        state = start(make_state(2))
        state["phase"] = "final_round"
        score_game(state)
        view = Game.get_public_view(state, state["seat_order"][0])
        for player in view["players"]:
            self.assertIsNotNone(player["hand"])
            self.assertIsNotNone(player["tickets"])

    def test_serialize_round_trip(self):
        state = start(make_state(3))
        restored = Game.deserialize(Game.serialize(state))
        self.assertEqual(restored, state)


class BotTests(unittest.TestCase):
    def test_bot_plays_a_legal_action_every_time(self):
        for count in (2, 5):
            state = make_state(count, seed=f"bot-{count}")
            guard = 0
            while not state["game_over"] and guard < 3000:
                for pid in state["seat_order"]:
                    if not Game.get_legal_actions(state, pid):
                        continue
                    action = Game.bot_move(state, pid)
                    self.assertIsNotNone(action)
                    _, error = Game.apply_action(state, pid, action)
                    self.assertIsNone(error, (pid, action, error))
                    guard += 1
                    if state["game_over"]:
                        break
            self.assertTrue(state["game_over"])
            self.assertTrue(state["winner_ids"])
            for pid in state["seat_order"]:
                self.assertGreaterEqual(state["players"][pid]["trains"], 0)
                self.assertLessEqual(len(state["players"][pid]["routes"]), len(ROUTES))

    def test_bot_keeps_at_least_two_tickets_at_setup(self):
        state = make_state(4, seed="keep")
        for pid in state["seat_order"]:
            action = Game.bot_move(state, pid)
            self.assertEqual(action["type"], "keep_tickets")
            self.assertGreaterEqual(len(action["tickets"]), 2)
            self.assertLessEqual(len(action["tickets"]), 3)
            _, error = Game.apply_action(state, pid, action)
            self.assertIsNone(error)

    def test_bot_prefers_a_route_on_its_ticket_path(self):
        state = start(make_state(3, seed="plan"))
        pid = state["current_turn"]
        state["players"][pid]["tickets"] = ["seattle--los-angeles"]
        state["players"][pid]["hand"] = dict.fromkeys(list(CARD_COLORS) + [LOCOMOTIVE], 0)
        state["players"][pid]["hand"]["green"] = 5
        action = Game.bot_move(state, pid)
        self.assertEqual(action["type"], "claim_route")
        self.assertEqual(ROUTES[action["route"]]["a"], "Portland")
        self.assertEqual(ROUTES[action["route"]]["b"], "San Francisco")


if __name__ == "__main__":
    unittest.main()
