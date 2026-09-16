import copy
import unittest

from game.hot_streak import (
    CARD_INSTANCES,
    CATALOG,
    HotStreakGame,
    RACER_IDS,
    _assign_dq_group,
    _evaluate_final_side_bet,
    _evaluate_latched_side_bet,
    _finish_race,
    _fold_and_reshuffle,
    _move_racer,
    _move_to_star,
    _resolve_all_card,
    _resolve_single_card,
    _swerve_racer,
)


def make_players(count: int, *, bots: bool = False):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": bots,
        }
        for index in range(count)
    ]


def make_state(count: int = 3, *, seed: int = 17):
    return HotStreakGame.init_game({"seed": seed}, make_players(count))


def take_all_tickets(state):
    while state["phase"] == "betting":
        player_id = state["draft_sequence"][state["draft_cursor"]]
        stack_id = next(stack for stack, tickets in state["ticket_stacks"].items() if tickets)
        action = {"type": "draft_ticket", "stack_id": stack_id, "mode": "safe"}
        pick_number = state["draft_counts"][player_id] + 1
        if state["race_number"] == 3 and pick_number == 2:
            action["double_bet_id"] = state["players"][player_id]["bets"][0]["bet_id"]
        _, error = HotStreakGame.apply_action(state, player_id, action)
        if error:
            raise AssertionError(error)


def submit_all_cards(state):
    required = 2 if len(state["turn_order"]) == 2 else 1
    for player_id in state["turn_order"]:
        cards = state["players"][player_id]["hand"][:required]
        _, error = HotStreakGame.apply_action(
            state,
            player_id,
            {"type": "submit_race_cards", "card_ids": cards},
        )
        if error:
            raise AssertionError(error)


class HotStreakCatalogTests(unittest.TestCase):
    def test_catalog_card_counts(self):
        self.assertEqual(CATALOG["catalog_status"], "prototype")
        self.assertTrue(CATALOG["unverified"])
        self.assertEqual(len(CARD_INSTANCES), 53)
        starters = [card for card in CARD_INSTANCES if card.split(":", 1)[0].endswith("_start")]
        self.assertEqual(len(starters), 4)
        self.assertEqual(len(CATALOG["side_bets"]), 12)
        self.assertEqual(set(CATALOG["ticket_stacks"]), set(RACER_IDS) | {"yes", "no"})

    def test_all_player_counts_initialize_with_eighteen_card_plan(self):
        base_counts = {2: 14, 3: 15, 4: 14, 5: 13, 6: 12, 7: 11, 8: 10}
        for count, expected_base in base_counts.items():
            with self.subTest(count=count):
                state = make_state(count, seed=count)
                hand_size = 4 if count == 2 else 3
                self.assertEqual(len(state["base_race_card_ids"]), expected_base)
                self.assertTrue(all(len(player["hand"]) == hand_size for player in state["players"].values()))
                self.assertEqual(
                    expected_base + count * (2 if count == 2 else 1),
                    18,
                )

    def test_snake_draft_sequences(self):
        state = make_state(4)
        rotated = state["draft_sequence"][:4]
        self.assertEqual(state["draft_sequence"], rotated + list(reversed(rotated)))

        two_player = make_state(2)
        rotated_two = two_player["draft_sequence"][:2]
        self.assertEqual(
            two_player["draft_sequence"],
            rotated_two + list(reversed(rotated_two)) + rotated_two,
        )


class HotStreakActionTests(unittest.TestCase):
    def test_only_current_player_can_draft(self):
        state = make_state(3)
        current = state["draft_sequence"][0]
        other = next(player_id for player_id in state["turn_order"] if player_id != current)
        _, error = HotStreakGame.apply_action(
            state,
            other,
            {"type": "draft_ticket", "stack_id": "blaze", "mode": "safe"},
        )
        self.assertEqual(error, "invalid action")

    def test_secret_submission_and_public_view(self):
        state = make_state(3)
        take_all_tickets(state)
        first, second = state["turn_order"][:2]
        first_card = state["players"][first]["hand"][0]
        events, error = HotStreakGame.apply_action(
            state,
            first,
            {"type": "submit_race_cards", "card_ids": [first_card]},
        )
        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"], {"player_id": first, "count": 1})
        other_view = HotStreakGame.get_public_view(state, second)
        self.assertNotIn(first_card, repr(other_view["players"]))
        self.assertNotIn(first_card, repr(other_view.get("your_submitted_cards")))
        own_view = HotStreakGame.get_public_view(state, first)
        self.assertEqual(own_view["your_submitted_cards"][0]["instance_id"], first_card)

    def test_two_player_requires_two_cards(self):
        state = make_state(2)
        take_all_tickets(state)
        player_id = state["turn_order"][0]
        _, error = HotStreakGame.apply_action(
            state,
            player_id,
            {"type": "submit_race_cards", "card_ids": state["players"][player_id]["hand"][:1]},
        )
        self.assertIn("exactly 2", error)

    def test_public_view_omits_future_deck_burn_and_rng(self):
        state = make_state(3)
        take_all_tickets(state)
        submit_all_cards(state)
        view = HotStreakGame.get_public_view(state, state["turn_order"][0])
        for private_key in (
            "draw_pile",
            "burned_card_ids",
            "race_card_ids",
            "side_bet_deck",
            "rng_seed",
            "rng_counter",
            "unused_card_ids",
        ):
            self.assertNotIn(private_key, view)

    def test_stale_race_step_is_rejected(self):
        state = make_state(3)
        take_all_tickets(state)
        submit_all_cards(state)
        _, error = HotStreakGame.apply_action(
            state,
            state["turn_order"][0],
            {"type": "advance_race", "expected_step_index": 1},
        )
        self.assertEqual(error, "stale race step")

    def test_duplicate_race_step_only_advances_once(self):
        state = make_state(3)
        take_all_tickets(state)
        submit_all_cards(state)
        actor = state["turn_order"][0]
        events, error = HotStreakGame.apply_action(
            state,
            actor,
            {"type": "advance_race", "expected_step_index": 0},
        )
        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"]["remaining"], 2)
        _, error = HotStreakGame.apply_action(
            state,
            actor,
            {"type": "advance_race", "expected_step_index": 0},
        )
        self.assertEqual(error, "stale race step")
        self.assertEqual(state["countdown"], 2)

    def test_third_race_double_is_required_and_marks_one_bet(self):
        state = make_state(3)
        state["race_number"] = 3
        state["draft_cursor"] = 0
        state["draft_counts"] = {player_id: 0 for player_id in state["turn_order"]}
        player_id = state["draft_sequence"][0]
        _, error = HotStreakGame.apply_action(
            state,
            player_id,
            {"type": "draft_ticket", "stack_id": "blaze", "mode": "safe"},
        )
        self.assertIsNone(error)
        while state["phase"] == "betting" and state["draft_sequence"][state["draft_cursor"]] != player_id:
            drafter = state["draft_sequence"][state["draft_cursor"]]
            stack_id = next(stack for stack, tickets in state["ticket_stacks"].items() if tickets)
            action = {"type": "draft_ticket", "stack_id": stack_id, "mode": "safe"}
            if state["draft_counts"][drafter] + 1 == 2:
                action["double_bet_id"] = state["players"][drafter]["bets"][0]["bet_id"]
            _, error = HotStreakGame.apply_action(
                state,
                drafter,
                action,
            )
            self.assertIsNone(error)
        first_bet_id = state["players"][player_id]["bets"][0]["bet_id"]
        _, error = HotStreakGame.apply_action(
            state,
            player_id,
            {"type": "draft_ticket", "stack_id": "yes", "mode": "risky"},
        )
        self.assertEqual(error, "choose a bet to double")
        _, error = HotStreakGame.apply_action(
            state,
            player_id,
            {
                "type": "draft_ticket",
                "stack_id": "yes",
                "mode": "risky",
                "double_bet_id": first_bet_id,
            },
        )
        self.assertIsNone(error)
        self.assertTrue(state["players"][player_id]["bets"][0]["doubled"])


class HotStreakMovementTests(unittest.TestCase):
    def setUp(self):
        self.state = make_state(3)
        self.state["phase"] = "racing"
        for racer in self.state["racers"].values():
            racer.update(
                {
                    "status": "active",
                    "position": 5,
                    "facing": "forward",
                    "fallen": False,
                    "rank_start": None,
                    "rank_end": None,
                    "payout_rank": None,
                    "dq_reason": None,
                }
            )
        for lane, racer_id in enumerate(RACER_IDS):
            self.state["racers"][racer_id]["lane"] = lane
        self.state["podium_groups"] = []
        self.state["dq_history"] = []
        self.state["finish_history"] = []
        self.state["race_log"] = []

    def test_facing_and_negative_movement(self):
        racer = self.state["racers"]["blaze"]
        racer["facing"] = "backward"
        _move_racer(self.state, "blaze", 2)
        self.assertEqual(racer["position"], 3)
        _move_racer(self.state, "blaze", -2)
        self.assertEqual(racer["position"], 5)

    def test_fallen_racer_crawls_one(self):
        racer = self.state["racers"]["blaze"]
        racer["fallen"] = True
        _move_racer(self.state, "blaze", 3)
        self.assertEqual(racer["position"], 6)

    def test_star_respects_facing_and_fallen_crawl(self):
        racer = self.state["racers"]["blaze"]
        racer["position"] = 5
        racer["facing"] = "backward"
        _move_to_star(self.state, "blaze")
        self.assertEqual(racer["position"], 4)
        racer.update({"position": 5, "fallen": True})
        _move_to_star(self.state, "blaze")
        self.assertEqual(racer["position"], 4)

    def test_second_fall_and_track_edges_disqualify(self):
        racer = self.state["racers"]["blaze"]
        racer["fallen"] = True
        _resolve_single_card(self.state, "blaze", [{"type": "fall"}])
        self.assertEqual(racer["dq_reason"], "knockout")

        dash = self.state["racers"]["dash"]
        dash.update({"position": 0, "facing": "backward"})
        _move_racer(self.state, "dash", 1)
        self.assertEqual(dash["dq_reason"], "back_out")

    def test_swerve_is_relative_and_can_leave_track(self):
        blaze = self.state["racers"]["blaze"]
        blaze.update({"lane": 1, "facing": "backward"})
        _swerve_racer(self.state, "blaze")
        self.assertEqual(blaze["lane"], 0)
        _swerve_racer(self.state, "blaze")
        self.assertEqual(blaze["dq_reason"], "side_out")

    def test_recover_resets_facing_before_moving(self):
        racer = self.state["racers"]["blaze"]
        racer["fallen"] = True
        racer["facing"] = "backward"
        _resolve_single_card(
            self.state,
            "blaze",
            [{"type": "recover"}, {"type": "move", "distance": 2}],
        )
        self.assertEqual(racer["position"], 7)
        self.assertEqual(racer["facing"], "forward")
        self.assertFalse(racer["fallen"])

    def test_collision_knocks_down_then_knocks_out(self):
        self.state["racers"]["dash"].update({"lane": 0, "position": 6})
        _move_racer(self.state, "blaze", 1)
        self.assertTrue(self.state["racers"]["dash"]["fallen"])
        self.state["racers"]["blaze"]["position"] = 5
        _move_racer(self.state, "blaze", 1)
        self.assertEqual(self.state["racers"]["dash"]["status"], "dq")
        self.assertEqual(self.state["racers"]["dash"]["dq_reason"], "knockout")

    def test_finish_happens_before_a_later_swerve(self):
        racer = self.state["racers"]["blaze"]
        racer["position"] = 12
        _resolve_single_card(
            self.state,
            "blaze",
            [{"type": "move", "distance": 1}, {"type": "swerve"}],
        )
        self.assertEqual(racer["status"], "finished")
        self.assertEqual(racer["lane"], 0)

    def test_all_racer_card_has_no_collisions_and_cannot_finish(self):
        self.state["racers"]["blaze"].update({"lane": 0, "position": 11})
        self.state["racers"]["dash"].update({"lane": 0, "position": 12})
        _resolve_all_card(self.state, [{"type": "move", "distance": 3}])
        self.assertEqual(self.state["racers"]["blaze"]["position"], 12)
        self.assertEqual(self.state["racers"]["dash"]["position"], 12)
        self.assertFalse(self.state["racers"]["dash"]["fallen"])
        self.assertEqual(self.state["racers"]["blaze"]["status"], "active")

    def test_simultaneous_dq_uses_worst_rank_for_payout(self):
        _assign_dq_group(self.state, ["blaze", "dash"], "folded_out")
        self.assertEqual(self.state["racers"]["blaze"]["rank_start"], 3)
        self.assertEqual(self.state["racers"]["blaze"]["rank_end"], 4)
        self.assertEqual(self.state["racers"]["dash"]["payout_rank"], 4)

    def test_fold_disqualifies_every_racer_behind_new_edge_together(self):
        self.state["race_card_ids"] = list(CARD_INSTANCES)[:18]
        self.state["racers"]["blaze"]["position"] = 2
        self.state["racers"]["dash"]["position"] = 2
        self.state["racers"]["ripple"]["position"] = 6
        self.state["racers"]["comet"]["position"] = 6
        result = _fold_and_reshuffle(self.state)
        self.assertTrue(result["continued"])
        self.assertEqual(set(result["dq_ids"]), {"blaze", "dash"})
        self.assertEqual(self.state["racers"]["blaze"]["rank_start"], 3)
        self.assertEqual(self.state["racers"]["dash"]["rank_end"], 4)
        self.assertEqual(len(self.state["draw_pile"]), 15)


class HotStreakLifecycleTests(unittest.TestCase):
    def _side_bet_state(self, side_bet_id):
        state = make_state(3)
        state["phase"] = "racing"
        state["current_side_bet_id"] = side_bet_id
        state["side_bet_tracker"] = {
            "latched": False,
            "result": None,
            "resolved": False,
            "evidence": None,
        }
        state["podium_groups"] = []
        state["dq_history"] = []
        state["finish_history"] = []
        state["race_log"] = []
        for lane, racer_id in enumerate(RACER_IDS):
            state["racers"][racer_id].update(
                {
                    "lane": lane,
                    "position": 5,
                    "facing": "forward",
                    "fallen": False,
                    "status": "active",
                    "rank_start": None,
                    "rank_end": None,
                    "payout_rank": None,
                    "dq_reason": None,
                }
            )
        return state

    def test_all_twelve_side_bets_have_positive_and_negative_paths(self):
        for side_bet in CATALOG["side_bets"]:
            side_bet_id = side_bet["id"]
            predicate = side_bet["predicate"]
            with self.subTest(side_bet=side_bet_id, result=True):
                state = self._side_bet_state(side_bet_id)
                if predicate == "racer_bottom_two":
                    state["racers"][side_bet["racer_id"]]["payout_rank"] = 3
                    _evaluate_final_side_bet(state)
                elif predicate == "two_fallen":
                    state["racers"]["blaze"]["fallen"] = True
                    state["racers"]["dash"]["fallen"] = True
                    _evaluate_latched_side_bet(state)
                elif predicate == "two_at_finish":
                    state["racers"]["blaze"]["position"] = 12
                    state["racers"]["dash"]["position"] = 12
                    _evaluate_latched_side_bet(state)
                elif predicate == "any_dq":
                    _assign_dq_group(state, ["blaze"], "side_out")
                elif predicate == "fallen_final_stretch":
                    state["racers"]["blaze"].update({"position": 10, "fallen": True})
                    _move_racer(state, "blaze", 3)
                elif predicate == "empty_stretch_first":
                    state["racers"]["blaze"]["position"] = 12
                    _move_racer(state, "blaze", 1)
                elif predicate == "any_out_of_bounds":
                    _assign_dq_group(state, ["blaze"], "back_out")
                elif predicate == "shared_space":
                    state["racers"]["dash"].update({"lane": 0, "position": 5})
                    _evaluate_latched_side_bet(state)
                elif predicate == "any_knockout":
                    _assign_dq_group(state, ["blaze"], "knockout")
                self.assertTrue(state["side_bet_tracker"]["result"])
                self.assertTrue(state["side_bet_tracker"]["resolved"])

            with self.subTest(side_bet=side_bet_id, result=False):
                state = self._side_bet_state(side_bet_id)
                if predicate == "racer_bottom_two":
                    state["racers"][side_bet["racer_id"]]["payout_rank"] = 2
                _evaluate_final_side_bet(state)
                self.assertFalse(state["side_bet_tracker"]["result"])
                self.assertTrue(state["side_bet_tracker"]["resolved"])

    def test_doubled_risky_loss_is_signed_and_money_stops_at_zero(self):
        state = self._side_bet_state("two_fallen")
        state["side_bet_tracker"].update({"result": False, "resolved": True})
        for rank, racer_id in enumerate(RACER_IDS, start=1):
            state["racers"][racer_id].update(
                {
                    "status": "finished",
                    "rank_start": rank,
                    "rank_end": rank,
                    "payout_rank": rank,
                }
            )
        player_id = state["turn_order"][0]
        state["players"][player_id]["money"] = 3
        state["players"][player_id]["bets"] = [
            {
                "bet_id": "test-double",
                "category": "side",
                "target": "yes",
                "tier": 1,
                "mode": "risky",
                "payout": {"correct": 15, "incorrect": -5},
                "doubled": True,
            }
        ]
        _finish_race(state)
        payout = state["last_race_summary"]["payouts"][player_id]
        self.assertEqual(payout["net"], -10)
        self.assertEqual(payout["money_after"], 0)

    def test_all_bot_game_reaches_game_over(self):
        for player_count in (2, 3, 8):
            with self.subTest(player_count=player_count):
                state = HotStreakGame.init_game(
                    {"seed": 20 + player_count},
                    make_players(player_count, bots=True),
                )
                action_count = 0
                while not state["game_over"] and action_count < 800:
                    move = None
                    actor = None
                    for player_id in state["turn_order"]:
                        candidate = HotStreakGame.bot_move(state, player_id)
                        if candidate:
                            actor = player_id
                            move = dict(candidate)
                            move.pop("delay_ms", None)
                            break
                    self.assertIsNotNone(move, state["phase"])
                    _, error = HotStreakGame.apply_action(state, actor, move)
                    self.assertIsNone(error)
                    action_count += 1
                self.assertTrue(state["game_over"])
                self.assertEqual(state["race_number"], 3)
                self.assertTrue(state["winner_ids"])
                self.assertEqual(len(state["race_history"]), 3)

    def test_round_result_waits_for_every_player(self):
        state = make_state(3)
        state["phase"] = "race_result"
        state["race_card_ids"] = list(CARD_INSTANCES)[:18]
        first, second, third = state["turn_order"]
        HotStreakGame.apply_action(state, first, {"type": "next_round"})
        HotStreakGame.apply_action(state, second, {"type": "next_round"})
        self.assertEqual(state["phase"], "race_result")
        HotStreakGame.apply_action(state, third, {"type": "next_round"})
        self.assertEqual(state["phase"], "betting")
        self.assertEqual(state["race_number"], 2)

    def test_serialize_round_trip_keeps_future_deterministic(self):
        left = make_state(3, seed=99)
        right = HotStreakGame.deserialize(copy.deepcopy(HotStreakGame.serialize(left)))
        take_all_tickets(left)
        take_all_tickets(right)
        submit_all_cards(left)
        submit_all_cards(right)
        self.assertEqual(left["draw_pile"], right["draw_pile"])
        self.assertEqual(left["burned_card_ids"], right["burned_card_ids"])


if __name__ == "__main__":
    unittest.main()
