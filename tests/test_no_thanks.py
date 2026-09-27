import copy
import json
import unittest

from jsonschema import Draft7Validator

from game.no_thanks import (
    ACTION_SCHEMA, CONFIG_SCHEMA, CARD_VALUES, NoThanksGame as Game,
    card_points, card_runs, starting_chips, take_delta,
)
from game.no_thanks_ai import choose_action


def make_state(count=3, rounds=1, seed=128):
    return Game.init_game({"rounds": rounds, "seed": seed}, [
        {"player_id": "p{}".format(i), "name": "Player {}".format(i + 1), "seat": i, "is_bot": i > 0}
        for i in range(count)
    ])


def offer(card=30, chips=11, pot=0, own_cards=None, opponent_cards=None):
    state = make_state()
    state.update(current_card=card, current_turn="p0", pot=pot)
    state["players"]["p0"].update(chips=chips, cards=own_cards or [])
    state["players"]["p1"]["cards"] = opponent_cards or []
    return state


class NoThanksRuleTests(unittest.TestCase):
    def assert_conserved(self, state):
        cards = list(state["deck"]) + list(state["removed_cards"])
        if state["current_card"] is not None:
            cards.append(state["current_card"])
        for player in state["players"].values():
            cards.extend(player["cards"])
        self.assertEqual(sorted(cards), list(CARD_VALUES))
        self.assertEqual(sum(p["chips"] for p in state["players"].values()) + state["pot"],
                         starting_chips(len(state["players"])) * len(state["players"]))

    def test_setup_for_every_supported_count(self):
        for count, chips in [(3, 11), (4, 11), (5, 11), (6, 9), (7, 7)]:
            with self.subTest(count=count):
                state = make_state(count)
                self.assertEqual(len(state["deck"]), 23)
                self.assertEqual(len(state["removed_cards"]), 9)
                self.assertEqual({p["chips"] for p in state["players"].values()}, {chips})
                self.assertIn(state["current_turn"], state["turn_order"])
                self.assert_conserved(state)

    def test_seeded_setup_is_reproducible_and_seat_ordered(self):
        players = [{"player_id": str(i), "seat": i} for i in [2, 0, 1]]
        state = Game.init_game({"seed": "test"}, players)
        self.assertEqual(state, Game.init_game({"seed": "test"}, list(reversed(players))))
        self.assertEqual(state["turn_order"], ["0", "1", "2"])

    def test_invalid_setup(self):
        for count in [0, 2, 8]:
            with self.assertRaises(ValueError):
                make_state(count)
        for cfg in [{"rounds": True}, {"rounds": 0}, {"rounds": 6}, {"rounds": "2"}, {"rounds": 1.5},
                    {"seed": False}, {"seed": []}, {"seed": ""}, {"unknown": 1}, []]:
            with self.subTest(config=cfg), self.assertRaises(ValueError):
                Game.init_game(cfg, [{"player_id": str(i)} for i in range(3)])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "same"}] * 3)

    def test_pass_transfers_exactly_one_chip_and_wraps(self):
        state = make_state()
        state["current_turn"] = "p2"
        current_card, deck = state["current_card"], state["deck"][:]
        events, error = Game.apply_action(state, "p2", {"type": "pass"})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p2"]["chips"], 10)
        self.assertEqual((state["pot"], state["current_turn"]), (1, "p0"))
        self.assertEqual((state["current_card"], state["deck"]), (current_card, deck))
        self.assertEqual(events[0]["type"], "no_thanks:pass")
        self.assert_conserved(state)

    def test_take_collects_pot_and_retains_turn(self):
        state = make_state()
        player_id = state["current_turn"]
        for _ in range(3):
            Game.apply_action(state, state["current_turn"], {"type": "pass"})
        card, next_card = state["current_card"], state["deck"][-1]
        _, error = Game.apply_action(state, player_id, {"type": "take"})
        self.assertIsNone(error)
        self.assertEqual(state["players"][player_id]["chips"], 13)
        self.assertEqual(state["players"][player_id]["cards"], [card])
        self.assertEqual((state["current_turn"], state["current_card"], state["pot"]), (player_id, next_card, 0))
        Game.apply_action(state, player_id, {"type": "take"})
        self.assertEqual(state["current_turn"], player_id)
        self.assert_conserved(state)

    def test_no_chips_requires_take(self):
        state = offer(chips=0)
        before = copy.deepcopy(state)
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["take"])
        self.assertIsNotNone(Game.apply_action(state, "p0", {"type": "pass"})[1])
        self.assertEqual(state, before)
        self.assertIsNone(Game.apply_action(state, "p0", {"type": "take"})[1])

    def test_runs_bridge_and_negative_score(self):
        self.assertEqual(card_runs([17, 14, 8, 15, 13]), [[8], [13, 14, 15], [17]])
        self.assertEqual(card_points([8, 13, 14, 15, 17]), 38)
        self.assertEqual(take_delta([8, 13, 14, 15, 17], 16), -17)
        self.assertEqual(take_delta([5, 6], 4, 3), -4)
        self.assertEqual(take_delta([5, 6], 7, 2), -2)
        self.assertEqual(take_delta([], 35, 40), -5)
        state = offer(card=3, chips=11)
        Game.apply_action(state, "p0", {"type": "take"})
        self.assertEqual(Game.get_public_view(state, "p0")["players"][0]["net_score"], -8)

    def test_invalid_actions_never_mutate_state(self):
        state = offer()
        invalid = [None, [], {}, {"type": []}, {"type": True}, {"type": "pay"},
                   {"type": "take", "amount": 2}, {"type": "next_round"}]
        for player_id, action in [("p0", a) for a in invalid] + [("visitor", {"type": "take"}), ("p1", {"type": "take"})]:
            with self.subTest(player=player_id, action=action):
                before = copy.deepcopy(state)
                events, error = Game.apply_action(state, player_id, action)
                self.assertTrue(error)
                self.assertEqual(events, [])
                self.assertEqual(state, before)

    def test_end_scores_once_and_keeps_final_cards(self):
        state = make_state()
        for _ in range(24):
            self.assertIsNone(Game.apply_action(state, state["current_turn"], {"type": "take"})[1])
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertIsNone(state["current_card"])
        self.assertIsNone(state["current_turn"])
        self.assertEqual(len(state["score_history"]), 1)
        self.assertEqual(sum(len(p["cards"]) for p in state["players"].values()), 24)
        self.assertEqual(len(state["winner_ids"]), 2)
        for pid in state["winner_ids"]:
            self.assertEqual(state["players"][pid]["total_score"], -11)
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, "p0", {"type": "take"})[1])
        self.assertIsNotNone(Game.apply_action(state, "p0", {"type": "next_round"})[1])
        self.assertEqual(state, before)
        self.assert_conserved(state)

    def test_next_round_requires_every_player_and_preserves_totals(self):
        state = make_state(rounds=2)
        starter = state["start_player"]
        for _ in range(24):
            Game.apply_action(state, state["current_turn"], {"type": "take"})
        self.assertEqual(state["phase"], "round_summary")
        totals = {pid: p["total_score"] for pid, p in state["players"].items()}
        summary = copy.deepcopy(state["round_summary"])
        for pid in ["p0", "p0", "p1"]:
            self.assertIsNone(Game.apply_action(state, pid, {"type": "next_round"})[1])
            self.assertEqual(state["phase"], "round_summary")
            self.assertEqual(state["round_summary"], summary)
        self.assertEqual(state["next_round_ready"], ["p0", "p1"])
        Game.apply_action(state, "p2", {"type": "next_round"})
        self.assertEqual((state["phase"], state["round_number"]), ("playing", 2))
        self.assertEqual(state["start_player"], state["turn_order"][(state["turn_order"].index(starter) + 1) % 3])
        self.assertEqual({pid: p["total_score"] for pid, p in state["players"].items()}, totals)
        self.assertTrue(all(p["cards"] == [] and p["chips"] == 11 for p in state["players"].values()))
        self.assertEqual(state["score_history"], [summary])
        self.assertEqual(state["next_round_ready"], [])
        self.assert_conserved(state)
        for _ in range(24):
            Game.apply_action(state, state["current_turn"], {"type": "take"})
        self.assertTrue(state["game_over"])
        for pid, p in state["players"].items():
            self.assertEqual(p["total_score"], sum(next(row["round_score"] for row in r["players"] if row["player_id"] == pid)
                                                   for r in state["score_history"]))

    def test_private_views_and_public_event_boundary(self):
        state = make_state()
        for viewer in ["p0", "p1", "p2", "visitor"]:
            view = Game.get_public_view(state, viewer)
            for player in view["players"]:
                self.assertEqual(player["chips"], 11 if player["player_id"] == viewer else None)
                self.assertEqual(player["net_score"], -11 if player["player_id"] == viewer else None)
            for key in ("deck", "removed_cards", "base_seed", "seed", "player_meta"):
                self.assertNotIn(key, view)
            self.assertNotIn("seed", view["config"])
            if viewer == "visitor":
                self.assertIsNone(view["your_chips"])
                self.assertIsNone(view["take_delta"])
                self.assertEqual(view["legal_actions"], [])
        events, _ = Game.apply_action(state, state["current_turn"], {"type": "pass"})
        for forbidden in ("chips", "deck", "seed", "removed_cards"):
            self.assertNotIn(forbidden, json.dumps(events))
        for _ in range(24):
            Game.apply_action(state, state["current_turn"], {"type": "take"})
        final = Game.get_public_view(state, "visitor")
        self.assertTrue(all(p["chips"] is not None and p["net_score"] is not None for p in final["players"]))
        self.assertNotIn("removed_cards", final)

    def test_serialization_and_views_are_detached(self):
        state = make_state(rounds=2)
        Game.apply_action(state, state["current_turn"], {"type": "pass"})
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(restored, state)
        Game.get_public_view(state, "p0")["players"][0]["cards"].append(99)
        Game.serialize(state)["deck"].clear()
        self.assertEqual(restored, state)
        for _ in range(24):
            for item in [state, restored]:
                Game.apply_action(item, item["current_turn"], {"type": "take"})
        Game.apply_action(state, "p1", {"type": "next_round"})
        checkpoint = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        for item in [state, checkpoint]:
            for pid in ["p0", "p2"]:
                Game.apply_action(item, pid, {"type": "next_round"})
        self.assertEqual(state, checkpoint)

    def test_action_and_configuration_schemas(self):
        for kind in ("take", "pass", "next_round"):
            self.assertTrue(Draft7Validator(ACTION_SCHEMA).is_valid({"type": kind}))
        self.assertFalse(Draft7Validator(ACTION_SCHEMA).is_valid({"type": "take", "chips": 5}))
        self.assertFalse(Draft7Validator(CONFIG_SCHEMA).is_valid({"rounds": True}))
        self.assertTrue(Draft7Validator(CONFIG_SCHEMA).is_valid({"rounds": 5}))

    def test_all_bot_games_complete_and_conserve_cards_and_chips(self):
        for count in range(3, 8):
            for seed in range(5):
                state = make_state(count=count, rounds=3, seed=seed)
                for _ in range(4500):
                    self.assert_conserved(state)
                    if state["game_over"]:
                        break
                    if state["phase"] == "round_summary":
                        actor = next(pid for pid in state["turn_order"] if pid not in state["next_round_ready"])
                    else:
                        actor = state["current_turn"]
                    before = copy.deepcopy(state)
                    action = Game.bot_move(state, actor)
                    self.assertEqual(state, before)
                    self.assertIsNotNone(action)
                    action.pop("delay_ms", None)
                    self.assertTrue(Draft7Validator(ACTION_SCHEMA).is_valid(action))
                    self.assertIsNone(Game.apply_action(state, actor, action)[1])
                self.assertTrue(state["game_over"], (count, seed))
                self.assertTrue(state["winner_ids"])
                self.assertLessEqual(len(state["history"]), 60)


class NoThanksAiTests(unittest.TestCase):
    def choose(self, state):
        return choose_action(Game.get_public_view(state, "p0"))

    def test_forced_take(self):
        self.assertEqual(self.choose(offer(chips=0)), {"type": "take"})

    def test_takes_bridge_and_lower_extension(self):
        self.assertEqual(self.choose(offer(card=14, own_cards=[13, 15])), {"type": "take"})
        self.assertEqual(self.choose(offer(card=13, own_cards=[14, 15])), {"type": "take"})

    def test_declines_expensive_disconnected_card(self):
        self.assertEqual(self.choose(offer(card=35)), {"type": "pass"})

    def test_replenishes_scarce_chips(self):
        self.assertEqual(self.choose(offer(card=16, chips=1, pot=8)), {"type": "take"})
        self.assertEqual(self.choose(offer(card=16, chips=11, pot=8)), {"type": "pass"})

    def test_extra_lap_only_without_visible_competition(self):
        self.assertEqual(self.choose(offer(card=25, own_cards=[24])), {"type": "pass"})
        self.assertEqual(self.choose(offer(card=25, own_cards=[24], opponent_cards=[26])), {"type": "take"})
        self.assertEqual(self.choose(offer(card=25, own_cards=[24], pot=3)), {"type": "take"})

    def test_last_card_has_no_future_discount_or_extra_lap(self):
        state = offer(card=25, own_cards=[24])
        state["deck"] = []
        self.assertEqual(self.choose(state), {"type": "take"})
        state = offer(card=16, chips=1, pot=8)
        state["deck"] = []
        self.assertEqual(self.choose(state), {"type": "pass"})

    def test_bot_action_ignores_hidden_state_and_has_no_side_effects(self):
        state = offer(card=25, own_cards=[24])
        other = copy.deepcopy(state)
        other["deck"].reverse()
        other["removed_cards"].reverse()
        other["base_seed"] = "different"
        other["config"]["seed"] = 123456
        other["players"]["p1"]["chips"] = 0
        other["players"]["p2"]["chips"] = 22
        self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(other, "p0"))
        before = copy.deepcopy(state)
        self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(other, "p0"))
        self.assertEqual(before, state)
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "visitor"))


if __name__ == "__main__":
    unittest.main()
