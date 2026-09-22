import copy
import json
import unittest
from collections import Counter
from unittest.mock import patch

from game.boomerang_australia import (
    ACTIVITIES,
    BoomerangAustraliaGame as Game,
    _finish_game,
    activity_points,
    animal_points,
    choose_bot_action,
    collection_points,
)
from game.boomerang_australia_data import ACTIVITY_POINTS, ANIMAL_VALUES, CARDS, COLLECTION_VALUES, REGIONS


def players(count=3):
    return [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": i > 0} for i in range(count)]


def new_game(count=3, seed=104, **config):
    return Game.init_game({"seed": seed, **config}, players(count))


class BoomerangAustraliaTest(unittest.TestCase):
    def apply(self, state, pid, action):
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error, (pid, action, error))
        return events

    def draft_batch(self, state):
        chosen = {pid: state["players"][pid]["hand"][0] for pid in state["turn_order"]}
        for pid in state["turn_order"]:
            self.apply(state, pid, {"type": "draft_card", "card_id": chosen[pid], "round": state["round"], "pick": state["pick"]})
        return chosen

    def draft_round(self, state):
        for _ in range(6):
            self.draft_batch(state)
        self.assertEqual(state["phase"], "choose_activity")

    def score_round(self, state, activities=None):
        for pid in state["turn_order"]:
            self.apply(state, pid, {"type": "choose_activity", "activity": (activities or {}).get(pid), "round": state["round"]})
        self.assertEqual(state["phase"], "round_end")

    def next_round(self, state):
        for pid in state["turn_order"]:
            self.apply(state, pid, {"type": "next_round", "round": state["round"]})

    def assert_rejected_unchanged(self, state, pid, action):
        before = copy.deepcopy(state)
        _, error = Game.apply_action(state, pid, action)
        self.assertIsNotNone(error, action)
        self.assertEqual(state, before)

    def test_card_catalog_has_exact_deck_and_publisher_distributions(self):
        self.assertEqual(len(CARDS), 28)
        self.assertEqual(set(CARDS), set("ABCDEFGHIJKLMNOPQRSTUVWXYZ@#"))
        self.assertEqual(Counter(card["number"] for card in CARDS.values()), Counter({number: 4 for number in range(1, 8)}))
        self.assertEqual(Counter(card["animal"] for card in CARDS.values() if card["animal"]), {"kangaroo": 5, "emu": 5, "wombat": 4, "koala": 3, "platypus": 2})
        self.assertEqual(Counter(card["collection"] for card in CARDS.values() if card["collection"]), {"leaf": 5, "flower": 4, "shell": 3, "souvenir": 1})
        self.assertEqual(Counter(card["activity"] for card in CARDS.values() if card["activity"]), {activity: 6 for activity in ACTIVITIES})
        for region, details in REGIONS.items():
            self.assertEqual(len(details["cards"]), 4)
            self.assertEqual({CARDS[card_id]["region"] for card_id in details["cards"]}, {region})

    def test_configuration_and_player_counts_are_strict(self):
        for config in ({"seed": True}, {"seed": 1.0}, {"direction_variant": "false"}, {"surprise": 1}, []):
            with self.subTest(config=config), self.assertRaises(ValueError):
                Game.init_game(config, players())
        for count in (0, 1, 5):
            with self.assertRaises(ValueError):
                new_game(count)
        with self.assertRaises(ValueError):
            Game.init_game({}, [players(2)[0], players(2)[0]])

    def test_seed_reproducibility_and_stable_seat_order(self):
        first = new_game()
        second = Game.init_game({"seed": 104}, list(reversed(players())))
        self.assertEqual(first, second)
        self.assertNotEqual(first["players"]["p0"]["hand"], new_game(seed=105)["players"]["p0"]["hand"])
        self.assertNotIn("seed", first["config"])

    def test_pending_pick_preserves_hand_and_does_not_reveal_until_everyone_submits(self):
        state = new_game()
        hands = {pid: list(data["hand"]) for pid, data in state["players"].items()}
        action = {"type": "draft_card", "card_id": hands["p0"][0], "round": 1, "pick": 1}
        events = self.apply(state, "p0", action)
        self.assertEqual(events, [])
        self.assertEqual(state["players"]["p0"]["hand"], hands["p0"])
        self.assertEqual(state["players"]["p0"]["cards"], [])
        self.assertEqual(Game.get_public_view(state, "p0")["pending_card"], action["card_id"])
        self.assertIsNone(Game.get_public_view(state, "p1")["pending_card"])
        self.assert_rejected_unchanged(state, "p0", action)
        for pid in ("p1", "p2"):
            self.apply(state, pid, {**action, "card_id": hands[pid][0]})
        self.assertEqual(state["pick"], 2)
        self.assertEqual(state["players"]["p1"]["hand"], hands["p0"][1:])
        self.assertEqual(Game.get_public_view(state, "p1")["players"][0]["cards"], [None])
        self.assertEqual(Game.get_public_view(state, "p0")["players"][0]["cards"][0]["id"], action["card_id"])

    def test_six_batches_pass_last_card_then_automatically_catch(self):
        state = new_game(4)
        for _ in range(5):
            self.draft_batch(state)
        self.assertEqual(state["pick"], 6)
        remaining = {pid: data["hand"][1] for pid, data in state["players"].items()}
        self.draft_batch(state)
        self.assertEqual(state["phase"], "choose_activity")
        for index, pid in enumerate(state["turn_order"]):
            self.assertEqual(len(state["players"][pid]["cards"]), 7)
            self.assertEqual(state["players"][pid]["hand"], [])
            self.assertEqual(state["players"][pid]["cards"][-1], remaining[state["turn_order"][(index - 1) % 4]])
            self.assertTrue(all(card is not None for card in Game.get_public_view(state, "spectator")["players"][index]["cards"]))

    def test_low_player_counts_deal_previous_undealt_cards_first(self):
        for count in (2, 3, 4):
            with self.subTest(count=count):
                state = new_game(count)
                undealt = list(state["undealt"])
                self.draft_round(state)
                self.score_round(state)
                self.next_round(state)
                dealt = [state["players"][pid]["hand"][index] for index in range(7) for pid in state["turn_order"]]
                self.assertEqual(dealt[:len(undealt)], undealt)
                self.assertEqual(set(dealt + state["undealt"]), set(CARDS))
                self.assertEqual(len(dealt + state["undealt"]), 28)
                if count == 3:
                    self.assertEqual([len(set(state["players"][pid]["hand"]) & set(undealt)) for pid in state["turn_order"]], [3, 2, 2])

    def test_direction_variant_is_only_right_in_even_rounds_with_three_or_four(self):
        for count in (2, 3, 4):
            for variant in (False, True):
                state = new_game(count, direction_variant=variant)
                self.assertEqual(Game.get_public_view(state, "p0")["direction"], "left")
                self.draft_round(state)
                self.score_round(state)
                self.next_round(state)
                expected = "right" if variant and count > 2 else "left"
                self.assertEqual(Game.get_public_view(state, "p0")["direction"], expected)
                hands = {pid: list(data["hand"]) for pid, data in state["players"].items()}
                self.draft_batch(state)
                recipient = state["turn_order"][-1 if expected == "right" else 1]
                self.assertEqual(state["players"][recipient]["hand"], hands["p0"][1:])

    def test_collection_threshold_and_all_icon_values(self):
        self.assertEqual(collection_points([]), 0)
        for symbol, value in COLLECTION_VALUES.items():
            self.assertEqual(collection_points([{"collection": symbol}]), value * 2)
        self.assertEqual(collection_points([{"collection": "souvenir"}, {"collection": "flower"}]), 14)
        self.assertEqual(collection_points([{"collection": "souvenir"}, {"collection": "shell"}]), 8)
        self.assertEqual(collection_points([{"collection": "souvenir"}] * 3), 15)

    def test_animals_score_each_pair_including_multiple_pairs(self):
        for animal, value in ANIMAL_VALUES.items():
            for count in range(6):
                self.assertEqual(animal_points([{"animal": animal}] * count), (count // 2) * value)
        self.assertEqual(animal_points([{"animal": animal} for animal in ANIMAL_VALUES]), 0)

    def test_activity_points_match_verified_score_sheet(self):
        self.assertEqual(ACTIVITY_POINTS, (0, 0, 2, 4, 7, 10, 15))
        for count, expected in enumerate((0, 0, 2, 4, 7, 10, 15)):
            self.assertEqual(activity_points(count), expected)

    def test_throw_catch_equal_numbers_score_zero(self):
        state = new_game(2)
        self.draft_round(state)
        state["players"]["p0"]["cards"] = list("AEFGHJB")
        preview = Game.get_public_view(state, "p0")["players"][0]["preview"]
        self.assertEqual(preview["throw_catch"], 0)
        state["players"]["p0"]["cards"][-1] = "#"
        self.assertEqual(Game.get_public_view(state, "p0")["players"][0]["preview"]["throw_catch"], 6)

    def test_regions_award_every_same_round_finisher_before_claiming(self):
        state = new_game(2)
        self.draft_round(state)
        state["players"]["p0"]["visited"] = list("ABC")
        state["players"]["p1"]["visited"] = list("ABD")
        state["players"]["p0"]["cards"] = list("DEFGHIK")
        state["players"]["p1"]["cards"] = list("CJMNOQR")
        previews = Game.get_public_view(state, "p0")["players"]
        self.assertIn("wa", previews[0]["preview"]["new_regions"])
        self.assertIn("wa", previews[1]["preview"]["new_regions"])
        self.score_round(state)
        self.assertEqual(state["region_claims"]["wa"], {"round": 1, "players": ["p0", "p1"]})
        for data in state["players"].values():
            self.assertIn("wa", data["region_bonuses"])
        self.next_round(state)
        self.draft_round(state)
        self.assertNotIn("wa", Game.get_public_view(state, "p0")["players"][0]["preview"]["new_regions"])

    def test_scoring_sites_only_once_and_totals_are_category_sum(self):
        state = new_game(2)
        for _ in range(4):
            self.draft_round(state)
            self.score_round(state)
            for data in state["players"].values():
                expected = len(data["visited"]) + 3 * len(data["region_bonuses"]) + sum(
                    score["throw_catch"] + score["collections"] + score["animals"] + score["activity_score"] for score in data["scores"]
                )
                self.assertEqual(data["total"], expected)
                self.assertEqual(data["total"], sum(score["round_points"] for score in data["scores"]))
                self.assertEqual(len(data["visited"]), len(set(data["visited"])))
            self.next_round(state)

    def test_activity_choices_wait_for_all_and_zero_occupies_activity(self):
        state = new_game(2)
        self.draft_round(state)
        option = next(item for item in Game.get_public_view(state, "p0")["activity_options"] if item["points"] == 0)
        self.apply(state, "p0", {"type": "choose_activity", "activity": option["id"], "round": 1})
        self.assertEqual(state["phase"], "choose_activity")
        self.assertEqual(state["players"]["p0"]["scores"], [])
        self.assertIsNone(Game.get_public_view(state, "p1")["pending_activity"])
        self.assert_rejected_unchanged(state, "p0", {"type": "choose_activity", "activity": None, "round": 1})
        self.apply(state, "p1", {"type": "choose_activity", "activity": None, "round": 1})
        self.assertEqual(state["players"]["p0"]["activities"], {option["id"]: 0})
        self.assertEqual(state["players"]["p1"]["activities"], {})
        self.next_round(state)
        self.draft_round(state)
        self.assert_rejected_unchanged(state, "p0", {"type": "choose_activity", "activity": option["id"], "round": 2})

    def test_every_player_must_confirm_round_end_and_duplicate_is_idempotent(self):
        state = new_game()
        self.draft_round(state)
        self.score_round(state)
        action = {"type": "next_round", "round": 1}
        for pid in ("p1", "p2"):
            self.apply(state, pid, action)
        self.assertEqual(state["phase"], "round_end")
        before = copy.deepcopy(state)
        self.apply(state, "p1", action)
        self.assertEqual(state, before)
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["next_round"])
        self.apply(state, "p0", action)
        self.assertEqual(state["round"], 2)
        self.assert_rejected_unchanged(state, "p0", action)

    def test_fourth_round_review_precedes_game_over(self):
        state = new_game(2)
        for round_no in range(1, 5):
            self.draft_round(state)
            self.score_round(state)
            self.assertFalse(state["game_over"])
            self.assertEqual(state["winner"], [])
            self.apply(state, "p1", {"type": "next_round", "round": round_no})
            self.assertEqual(state["phase"], "round_end")
            self.apply(state, "p0", {"type": "next_round", "round": round_no})
        self.assertEqual(state["phase"], "game_over")
        self.assertTrue(state["winner"])
        self.assertEqual(Game.get_legal_actions(state, "p0"), [])
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assert_rejected_unchanged(state, "p0", {"type": "next_round", "round": 4})

    def test_winner_uses_throw_catch_tiebreak_then_shared_victory(self):
        state = new_game()
        for pid in state["turn_order"]:
            state["players"][pid]["total"] = 100
            state["players"][pid]["scores"] = [{"throw_catch": 4}]
        state["players"]["p0"]["scores"] = [{"throw_catch": 3}]
        _finish_game(state)
        self.assertEqual(state["winner"], ["p1", "p2"])
        state["players"]["p1"]["total"] = 101
        _finish_game(state)
        self.assertEqual(state["winner"], ["p1"])

    def test_illegal_actions_never_mutate_state(self):
        state = new_game()
        valid = {"type": "draft_card", "card_id": state["players"]["p0"]["hand"][0], "round": 1, "pick": 1}
        invalid = [None, [], {}, {**valid, "hidden": 1}, {**valid, "round": True}, {**valid, "round": 1.0}, {**valid, "pick": 1.0}, {**valid, "pick": 2}, {**valid, "round": 2}, {**valid, "card_id": state["players"]["p1"]["hand"][0]}, {**valid, "card_id": "nope"}, {"type": "choose_activity", "activity": None, "round": 1}, {"type": "next_round", "round": 1}]
        for action in invalid:
            with self.subTest(action=action):
                self.assert_rejected_unchanged(state, "p0", action)
        self.assert_rejected_unchanged(state, "unknown", valid)
        self.draft_batch(state)
        self.assert_rejected_unchanged(state, "p0", valid)

    def test_view_whitelist_and_observers_cannot_see_private_state(self):
        state = new_game()
        self.draft_batch(state)
        action = {"type": "draft_card", "card_id": state["players"]["p0"]["hand"][0], "round": 1, "pick": 2}
        before = Game.get_public_view(state, "p1")
        self.apply(state, "p0", action)
        after = Game.get_public_view(state, "p1")
        before["players"][0]["submitted"] = True
        self.assertEqual(before, after)
        for viewer in ("p1", "unknown", None):
            view = Game.get_public_view(state, viewer)
            for key in ("rng_state", "undealt", "pending_cards", "pending_activities", "player_meta"):
                self.assertNotIn(key, view)
            self.assertNotIn("seed", view["config"])
            self.assertIsNone(view["players"][0]["cards"][0])
            self.assertNotIn("hand", view["players"][0])
            self.assertIsNone(view["pending_card"])
            if viewer != "p1":
                self.assertEqual(view["hand"], [])
                self.assertEqual(view["legal_actions"], [])
                self.assertEqual(view["activity_options"], [])

    def test_public_view_and_serialization_do_not_share_mutable_data(self):
        state = new_game()
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, "p0")
        view["hand"][0]["name"] = "changed"
        view["catalog"]["A"]["number"] = 99
        view["players"][0]["visited"].append("A")
        view["regions"]["wa"]["cards"].clear()
        self.assertEqual(state, before)
        self.assertEqual(CARDS["A"]["number"], 1)
        self.assertEqual(len(REGIONS["wa"]["cards"]), 4)
        serialized = Game.serialize(state)
        restored = Game.deserialize(serialized)
        serialized["players"]["p0"]["hand"].clear()
        restored["log"].clear()
        self.assertEqual(state, before)

    def test_json_save_restore_preserves_pending_and_future_shuffle(self):
        state = new_game()
        self.apply(state, "p0", {"type": "draft_card", "card_id": state["players"]["p0"]["hand"][0], "round": 1, "pick": 1})
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(state, restored)
        for _ in range(120):
            if state["game_over"]:
                break
            for pid in state["turn_order"]:
                action = Game.bot_move(state, pid)
                self.assertEqual(action, Game.bot_move(restored, pid))
                if action:
                    self.apply(state, pid, action)
                    self.apply(restored, pid, action)
            self.assertEqual(state, restored)
        self.assertTrue(state["game_over"])

    def test_save_restore_rejects_broken_invariants_without_mutating_payload(self):
        state = new_game()
        broken_states = []
        for mutate in (
            lambda data: data.update(round=0),
            lambda data: data.update(game_over=True),
            lambda data: data.update(rng_state=[]),
            lambda data: data["player_meta"].update(p0=None),
            lambda data: data["player_meta"]["p0"].update(name=[]),
            lambda data: data["player_meta"]["p0"].update(seat=True),
            lambda data: data["player_meta"]["p0"].update(is_bot="false"),
            lambda data: data["players"]["p0"]["hand"].__setitem__(0, "unknown"),
            lambda data: data["players"]["p0"]["hand"].__setitem__(0, data["players"]["p1"]["hand"][0]),
            lambda data: data["players"]["p0"].update(total=99),
            lambda data: data.update(pending_cards={"p0": data["players"]["p1"]["hand"][0]}),
        ):
            broken = copy.deepcopy(state)
            mutate(broken)
            broken_states.append(broken)
        for broken in broken_states:
            before = copy.deepcopy(broken)
            with self.assertRaises(ValueError):
                Game.deserialize(broken)
            self.assertEqual(broken, before)

    def test_save_restore_supports_activity_review_and_game_over_phases(self):
        state = new_game(2)
        for _ in range(4):
            self.draft_round(state)
            self.apply(state, "p0", {"type": "choose_activity", "activity": None, "round": state["round"]})
            state = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
            self.apply(state, "p1", {"type": "choose_activity", "activity": None, "round": state["round"]})
            self.apply(state, "p0", {"type": "next_round", "round": state["round"]})
            state = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
            self.apply(state, "p1", {"type": "next_round", "round": state["round"]})
        self.assertEqual(Game.deserialize(json.loads(json.dumps(Game.serialize(state)))), state)

    def test_bot_decision_function_receives_only_player_view(self):
        state = new_game()
        self.draft_batch(state)
        view = Game.get_public_view(state, "p0")
        expected = choose_bot_action(view)
        with patch("game.boomerang_australia.choose_bot_action", wraps=choose_bot_action) as decision:
            self.assertEqual(Game.bot_move(state, "p0"), expected)
            decision.assert_called_once_with(view)
        altered = copy.deepcopy(state)
        altered["undealt"].reverse()
        altered["players"]["p1"]["hand"].reverse()
        altered["players"]["p1"]["cards"][0] = "#"
        altered["rng_state"] = new_game(seed=777)["rng_state"]
        self.assertEqual(Game.bot_move(altered, "p0"), expected)
        self.assertIsNone(Game.bot_move(state, "spectator"))

    def test_two_three_four_player_bots_complete_many_seeded_games(self):
        for count in (2, 3, 4):
            for seed in range(12):
                with self.subTest(count=count, seed=seed):
                    state = new_game(count, seed, direction_variant=bool(seed % 2))
                    actions = 0
                    while not state["game_over"] and actions < count * 33:
                        progressed = False
                        for pid in state["turn_order"]:
                            action = Game.bot_move(state, pid)
                            if action:
                                self.apply(state, pid, action)
                                actions += 1
                                progressed = True
                        self.assertTrue(progressed)
                    self.assertTrue(state["game_over"])
                    self.assertEqual(actions, count * 32)
                    for data in state["players"].values():
                        self.assertEqual(len(data["scores"]), 4)
                        self.assertGreater(data["total"], 0)


if __name__ == "__main__":
    unittest.main()
