import copy
import json
import unittest

from jsonschema import Draft7Validator

from game.eternal_decks import EternalDecksGame as Game, field_reason, recipe_matches
from game.eternal_decks_data import ACTION_SCHEMA, ETERNALS, RECIPES, deck_manifest


def number(value, color="red", cid=None):
    return {"id": cid or f"test-{color}-{value}", "kind": "number", "number": value, "colors": color.split("_")}


def rare(cid="rare"):
    return {"id": cid, "kind": "rare", "colors": []}


def ability(eid):
    return {"id": "ability-" + eid, "kind": "ability", "colors": [], "source": eid,
            "ability": ETERNALS[eid]["ability"]}


class EternalDecksTests(unittest.TestCase):
    def make_game(self, count=4, **config):
        return Game.init_game({"seed": 99, **config}, [
            {"player_id": f"p{i}", "name": f"Player {i}", "seat": i} for i in range(count)])

    def start(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, {"type": "ready"})

    def act(self, state, pid, action):
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error, (action, error))
        self.assertTrue(events)

    def reject(self, state, pid, action):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, action)
        self.assertTrue(error, action)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def put_hand(self, state, cards):
        state["players"]["p0"]["hand"] = cards
        state["current_turn"] = "p0"
        state["phase"] = "playing"

    def revive_fixture(self, state, eid, jewel=None):
        for row in state["rows"]:
            if eid in row["sleeping"]:
                row["sleeping"].remove(eid)
        state["revived"].append({"id": eid, "owner": "p0", "jewel": jewel})

    def confirm(self, state):
        for pid in state["turn_order"]:
            self.act(state, pid, {"type": "next_round"})

    def test_deal_and_deterministic_prototype_manifests(self):
        for count, total in ((2, 7), (4, 5)):
            state = self.make_game(count)
            self.assertEqual(state, self.make_game(count))
            for player in state["players"].values():
                self.assertEqual(len(player["hand"]), 3)
                self.assertEqual(len(player["hand"]) + len(player["deck"]), total)
            if count == 2:
                self.assertEqual([card["colors"] for card in state["players"]["p0"]["deck"][-2:]], [["green"], ["green"]])
        self.assertEqual(len(ETERNALS), 9)
        for eid in ETERNALS:
            self.assertEqual(len(deck_manifest(eid)), 8)

    def test_rejects_unverified_counts_and_malformed_configuration(self):
        for count in (1, 3, 5):
            with self.assertRaises(ValueError):
                self.make_game(count)
        for config in ({"stage": "B"}, {"strict_discard": 1}, {"seed": True}):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": "a"}, {"player_id": "b"}])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "a"}, {"player_id": "a"}])

    def test_start_player_change_resets_agreement_and_requires_everyone(self):
        state = self.make_game()
        self.act(state, "p0", {"type": "ready"})
        self.act(state, "p1", {"type": "choose_start", "player_id": "p2"})
        self.assertEqual(state["ready"], [])
        self.start(state)
        self.assertEqual(state["current_turn"], "p2")
        self.reject(state, "p0", {"type": "ready"})

    def test_common_adjacency_and_field_order(self):
        state = self.make_game()
        for row in state["rows"]:
            row["cards"] = [number(4, "red")]
        self.assertEqual(field_reason(state, number(5, "red"), 2), "same_color")
        self.assertEqual(field_reason(state, number(4, "blue"), 2), "same_number")
        self.assertEqual(field_reason(state, number(3, "blue"), 0), "ascending")
        self.assertEqual(field_reason(state, number(5, "blue"), 1), "descending")
        self.assertIsNone(field_reason(state, number(8, "blue"), 0))
        self.assertIsNone(field_reason(state, number(1, "blue"), 1))

    def test_dual_orientation_uses_contact_edges(self):
        state = self.make_game()
        row = state["rows"][2]
        row["cards"] = [number(1, "red")]
        dual = number(3, "red_green")
        self.assertEqual(field_reason(state, dual, 2), "same_color")
        self.assertIsNone(field_reason(state, dual, 2, "rotated"))
        row["cards"].append({**dual, "orientation": "rotated"})
        self.assertEqual(field_reason(state, number(4, "red"), 2), "same_color")
        self.assertIsNone(field_reason(state, number(4, "green"), 2))

    def test_rare_bypasses_placement_but_later_numbers_need_room(self):
        state = self.make_game()
        row = state["rows"][0]
        row["cards"] = [number(9)]
        self.assertIsNone(field_reason(state, rare(), 0))
        row["cards"] += [rare("r1"), rare("r2")]
        self.assertIsNone(field_reason(state, rare("r3"), 0))
        self.assertEqual(field_reason(state, number(8, "blue"), 0), "ascending")
        row["cards"] = [number(4), rare()]
        self.assertEqual(field_reason(state, number(5, "blue"), 0), "ascending")
        self.assertIsNone(field_reason(state, number(6, "blue"), 0))
        row["cards"] = [rare("a"), rare("b")]
        self.assertEqual(field_reason(state, number(2, "blue"), 0), "ascending")
        self.assertIsNone(field_reason(state, number(3, "blue"), 0))
        state["rows"][1]["cards"] = [number(1), rare("a")]
        self.assertIsNone(field_reason(state, rare("b"), 1))
        self.assertEqual(field_reason(state, number(2, "blue"), 1), "descending")

    def test_curses_filter_whole_dual_card_and_allow_river(self):
        state = self.make_game()
        self.revive_fixture(state, "C1")
        card = number(3, "red_green")
        for orientation in ("normal", "rotated"):
            self.assertEqual(field_reason(state, card, 2, orientation), "curse")
        self.assertIsNone(field_reason(state, rare(), 2))
        self.revive_fixture(state, "B3")
        self.assertEqual(field_reason(state, rare(), 2), "curse")
        self.put_hand(state, [card])
        self.act(state, "p0", {"type": "river", "card_id": card["id"]})

    def test_all_recipes_with_wildcards_and_dual_colors(self):
        self.assertTrue(recipe_matches("same_color_3", [number(2, "red_green"), number(3, "green"), rare()]))
        self.assertTrue(recipe_matches("different_color_3", [number(2, "red_green"), number(3, "red"), number(5, "blue")]))
        self.assertFalse(recipe_matches("different_color_3", [number(2, "red"), number(3, "red"), rare()]))
        self.assertTrue(recipe_matches("same_number_3", [number(2), rare("a"), rare("b")]))
        self.assertTrue(recipe_matches("same_number_2", [number(2), number(2, "blue")]))
        self.assertTrue(recipe_matches("one_five_nine", [number(1), rare(), number(9, "blue")]))
        self.assertFalse(recipe_matches("one_five_nine", [number(1), number(1, "blue"), rare()]))
        self.assertTrue(recipe_matches("one_or_nine", [rare()]))
        self.assertTrue(recipe_matches("any_2", [ability("B1"), ability("B2")]))
        self.assertTrue(recipe_matches("any_3", [ability("A1"), rare(), number(2)]))
        self.assertFalse(recipe_matches("same_color_3", [ability("A1"), rare(), rare("b")]))

    def test_revival_appends_deck_and_retains_completed_row_for_review(self):
        state = self.make_game()
        self.put_hand(state, [number(4, "blue")])
        state["rows"][0]["cards"] = [number(1), number(2, "green"), number(3)]
        old_deck = copy.deepcopy(state["players"]["p0"]["deck"])
        eternal_deck = copy.deepcopy(state["eternal_decks"]["A1"])
        self.act(state, "p0", {"type": "place", "card_id": "test-blue-4", "row": 0, "orientation": "normal"})
        self.assertEqual(state["phase"], "revival")
        self.reject(state, "p1", {"type": "revive", "eternal_id": "A1"})
        self.reject(state, "p0", {"type": "revive", "eternal_id": "B1"})
        self.act(state, "p0", {"type": "revive", "eternal_id": "A1"})
        player = state["players"]["p0"]
        self.assertEqual(player["hand"] + player["deck"], old_deck + eternal_deck)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(len(state["review_cards"][0]["cards"]), 4)
        self.assertEqual(state["rows"][0]["cards"], [])
        self.assertEqual(state["rows"][0]["lap"], 2)
        self.assertEqual(field_reason(state, number(1), 0), "curse")

    def test_all_confirm_and_repeated_confirm_cannot_skip_a_player(self):
        state = self.make_game()
        self.start(state)
        for pid in state["turn_order"]:
            self.act(state, pid, {"type": "river", "card_id": state["players"][pid]["hand"][0]["id"]})
        self.assertEqual(state["phase"], "round_end")
        for pid in ("p0", "p1", "p2"):
            self.act(state, pid, {"type": "next_round"})
        self.reject(state, "p0", {"type": "next_round"})
        self.assertEqual(state["phase"], "round_end")
        self.act(state, "p3", {"type": "next_round"})
        self.assertEqual(state["current_turn"], "p0")

    def test_jewel_overflow_clears_once_and_disables_curse(self):
        state = self.make_game()
        self.revive_fixture(state, "A1")
        cards = [number(3), number(5, "blue"), number(7, "green")]
        self.put_hand(state, cards)
        state["river"] = [rare(f"r{i}") for i in range(4)]
        self.act(state, "p0", {"type": "generate", "recipe": "any_3", "target": "A1", "card_ids": [card["id"] for card in cards]})
        self.assertFalse(state["jewels"]["any_3"])
        self.assertEqual(state["river"], [])
        self.assertEqual(len(state["river_rewards"]), 2)
        self.assertEqual(len(state["review_cards"][0]["cards"]), 7)
        self.assertIsNone(field_reason(state, number(1), 0))

    def test_last_river_reward_is_failure_but_fourth_star_wins_tie(self):
        for stars, success in (([], False), (["jewels_1_3", "jewels_4_6", "abilities"], True)):
            state = self.make_game()
            state["stars"] = stars
            self.revive_fixture(state, "A1")
            cards = [number(1), number(5, "green"), number(9, "blue")]
            self.put_hand(state, cards)
            state["river"] = [rare("r1"), rare("r2")]
            state["river_rewards"] = []
            self.act(state, "p0", {"type": "generate", "recipe": "one_five_nine", "target": "A1", "card_ids": [card["id"] for card in cards]})
            self.assertTrue(state["game_over"])
            self.assertEqual(state["result"]["success"], success)

    def test_give_uses_heart_only_sender_refills_and_events_are_private(self):
        state = self.make_game()
        self.start(state)
        cid = state["players"]["p0"]["hand"][0]["id"]
        before_receiver = copy.deepcopy(state["players"]["p1"])
        events, error = Game.apply_action(state, "p0", {"type": "give", "card_id": cid, "target": "p1"})
        self.assertIsNone(error)
        self.assertNotIn(cid, json.dumps(events))
        self.assertEqual(state["hearts"], 2)
        self.assertEqual(len(state["players"]["p0"]["hand"]), 3)
        self.assertEqual(len(state["players"]["p1"]["hand"]), 4)
        self.assertEqual(state["players"]["p1"]["deck"], before_receiver["deck"])
        self.assertNotIn(cid, json.dumps(Game.get_public_view(state, "p2")))

    def test_empty_player_not_defeated_until_their_turn_and_can_be_rescued(self):
        state = self.make_game()
        self.start(state)
        state["players"]["p2"]["hand"] = []
        state["players"]["p2"]["deck"] = []
        self.act(state, "p0", {"type": "river", "card_id": state["players"]["p0"]["hand"][0]["id"]})
        self.assertFalse(state["game_over"])
        self.act(state, "p1", {"type": "give", "card_id": state["players"]["p1"]["hand"][0]["id"], "target": "p2"})
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "p2")

    def test_no_action_loss_at_next_turn(self):
        state = self.make_game()
        self.start(state)
        state["players"]["p1"]["hand"] = []
        self.act(state, "p0", {"type": "river", "card_id": state["players"]["p0"]["hand"][0]["id"]})
        self.assertTrue(state["game_over"])
        self.assertFalse(state["result"]["success"])

    def test_ghost_reveals_only_for_discussion_until_everyone_finishes(self):
        state = self.make_game()
        self.put_hand(state, [ability("B1"), number(3)])
        self.act(state, "p0", {"type": "ability", "card_id": "ability-B1", "options": {}})
        self.assertEqual(len(Game.get_public_view(state, "watcher")["players"][1]["hand"]), 3)
        for pid in ("p0", "p1", "p2"):
            self.act(state, pid, {"type": "end_discussion"})
        self.assertTrue(state["hands_revealed"])
        self.act(state, "p3", {"type": "end_discussion"})
        self.assertFalse(state["hands_revealed"])
        self.assertEqual(Game.get_public_view(state, "watcher")["players"][1]["hand"], [])
        self.assertEqual(state["current_turn"], "p1")

    def test_witch_uses_no_numeric_cards_and_cannot_make_star_recipe(self):
        state = self.make_game()
        self.revive_fixture(state, "A1")
        self.put_hand(state, [ability("B3")])
        self.reject(state, "p0", {"type": "ability", "card_id": "ability-B3", "options": {"recipe": "one_five_nine", "target": "A1"}})
        self.act(state, "p0", {"type": "ability", "card_id": "ability-B3", "options": {"recipe": "same_number_3", "target": "A1"}})
        self.assertEqual(state["river"], [])
        self.assertFalse(state["jewels"]["same_number_3"])
        self.assertEqual(state["revived"][0]["jewel"], "same_number_3")

    def test_medusa_recycles_rare_and_strict_view_only_shows_eligible_target(self):
        state = self.make_game(strict_discard=True)
        state["discard"] = [number(8), rare("discard-rare")]
        self.put_hand(state, [ability("C1")])
        view = Game.get_public_view(state, "p0")
        self.assertEqual([card["id"] for card in view["discard"]], ["discard-rare"])
        self.assertEqual(Game.get_public_view(state, "p1")["discard"], [])
        self.act(state, "p0", {"type": "ability", "card_id": "ability-C1", "options": {"card_id": "discard-rare"}})
        self.assertEqual(len(state["river_rewards"]), 4)
        self.assertEqual(state["river_rewards"][-1]["id"], "discard-rare")

    def test_minotaur_exchanges_existing_card_even_under_witch_curse(self):
        state = self.make_game()
        self.revive_fixture(state, "B3")
        state["rows"][0]["cards"] = [number(4)]
        self.put_hand(state, [ability("C2")])
        self.act(state, "p0", {"type": "ability", "card_id": "ability-C2", "options": {"row": 0, "slot": 0}})
        self.assertTrue(state["rows"][0]["cards"][0]["as_rare"])
        self.assertTrue(any(card["id"] == "test-red-4" for card in state["players"]["p0"]["hand"]))

    def test_kraken_takes_two_without_discarding_overfull_hand(self):
        state = self.make_game()
        self.put_hand(state, [ability("C3"), number(1), number(2)])
        state["river"] = [rare("r1"), rare("r2"), rare("r3")]
        original_deck = copy.deepcopy(state["players"]["p0"]["deck"])
        self.act(state, "p0", {"type": "ability", "card_id": "ability-C3", "options": {"card_ids": ["r2", "r1"]}})
        self.assertEqual(len(state["players"]["p0"]["hand"]), 4)
        self.assertEqual(state["players"]["p0"]["deck"], original_deck)
        self.assertEqual([card["id"] for card in state["river"]], ["r3"])

    def test_skeleton_heart_caps_and_third_a_ability_awards_one_star(self):
        state = self.make_game()
        state["hearts"] = 2
        self.put_hand(state, [ability("B2")])
        self.act(state, "p0", {"type": "ability", "card_id": "ability-B2", "options": {}})
        self.assertEqual(state["hearts"], 3)
        state["stage_cards"] = [ability("A1"), ability("A2")]
        self.put_hand(state, [ability("A3")])
        self.act(state, "p0", {"type": "ability", "card_id": "ability-A3", "options": {}})
        self.assertEqual(state["stars"].count("abilities"), 1)

    def test_fourth_lap_bonuses_and_camp_replaces_field(self):
        for index in range(3):
            state = self.make_game()
            row = state["rows"][index]
            row.update({"sleeping": [], "lap": 4, "cards": [rare(f"r{i}") for i in range(6)]})
            state["hearts"] = 0
            self.put_hand(state, [rare("last")])
            self.act(state, "p0", {"type": "place", "card_id": "last", "row": index, "orientation": "normal"})
            self.assertTrue(row["closed"])
            self.assertEqual(len(row["cards"]), 7)
            if index == 0:
                self.assertEqual(state["phase"], "camp_choice")
                self.reject(state, "p0", {"type": "camp", "row": 0})
                self.act(state, "p0", {"type": "camp", "row": 1})
                self.assertEqual(state["rows"][1]["field"], "camp")
            elif index == 1:
                self.assertEqual(state["hearts"], 3)
            else:
                self.assertIn("bottom_row", state["stars"])
            self.assertEqual(state["phase"], "round_end")

    def test_jewel_groups_use_revival_order_and_ninth_revival_awards_star(self):
        state = self.make_game()
        for eid in ("C1", "A2", "B1", "A1", "B2", "C2", "A3", "B3"):
            self.revive_fixture(state, eid, "any_2" if eid != "C2" else None)
        self.put_hand(state, [number(9)])
        self.act(state, "p0", {"type": "generate", "recipe": "one_or_nine", "target": "C2", "card_ids": ["test-red-9"]})
        self.assertIn("jewels_1_3", state["stars"])
        self.assertIn("jewels_4_6", state["stars"])
        state["phase"] = "revival"
        state["current_turn"] = "p0"
        state["pending_row"] = 2
        self.act(state, "p0", {"type": "revive", "eternal_id": "C3"})
        self.assertIn("all_revived", state["stars"])
        self.assertEqual(len(state["stars"]), 3)

    def test_private_view_has_no_hidden_ids_seed_or_deck_order(self):
        state = self.make_game()
        self.start(state)
        view = Game.get_public_view(state, "p0")
        payload = json.dumps(view)
        self.assertNotIn('"seed"', payload)
        for pid, player in state["players"].items():
            for card in player["deck"] + (player["hand"] if pid != "p0" else []):
                self.assertNotIn(card["id"], payload)
        for deck in state["eternal_decks"].values():
            for card in deck:
                self.assertNotIn(card["id"], payload)
        self.assertEqual(Game.get_public_view(state, "spectator")["moves"], [])
        before = copy.deepcopy(state)
        view["rows"][0]["sleeping"].clear()
        view["players"][0]["hand"].clear()
        self.assertEqual(state, before)

    def test_invalid_actions_are_atomic_and_schema_rejects_boolean_indices(self):
        state = self.make_game()
        self.start(state)
        cid = state["players"]["p0"]["hand"][0]["id"]
        for action in (None, [], {"type": "place", "card_id": cid, "row": True, "orientation": "normal"},
                       {"type": "place", "card_id": cid, "row": 0.0, "orientation": "normal"},
                       {"type": "move_disc", "disc": 0.0, "position": 2, "seq": 1},
                       {"type": "river", "card_id": "stolen"}, {"type": "river", "card_id": cid, "extra": 1},
                       {"type": "generate", "card_ids": [cid, cid], "recipe": "any_2", "target": "A1"}):
            self.reject(state, "p0", action)
        self.reject(state, "p1", {"type": "river", "card_id": cid})
        self.reject(state, "spectator", {"type": "move_disc", "disc": 0, "position": 2, "seq": 1})
        self.put_hand(state, [ability("C2")])
        self.reject(state, "p0", {"type": "ability", "card_id": "ability-C2", "options": {"row": False, "slot": 0}})
        self.reject(state, "p0", {"type": "ability", "card_id": "ability-C2", "options": {"row": 0, "slot": 0.0}})

    def test_discs_are_free_private_to_owner_and_sequence_checked(self):
        state = self.make_game()
        self.start(state)
        count = len(state["log"])
        self.act(state, "p2", {"type": "move_disc", "disc": 1, "position": 25, "seq": 3})
        self.assertEqual(state["current_turn"], "p0")
        self.assertEqual(len(state["log"]), count)
        self.assertEqual(state["players"]["p0"]["discs"][1]["position"], -1)
        self.reject(state, "p2", {"type": "move_disc", "disc": 1, "position": 2, "seq": 2})

    def test_serialization_does_not_alias_and_restores_pending_choice(self):
        state = self.make_game()
        state.update({"phase": "revival", "pending_row": 1, "current_turn": "p0"})
        saved = Game.serialize(state)
        restored = Game.deserialize(json.loads(json.dumps(saved)))
        self.assertEqual(restored, state)
        self.act(restored, "p0", {"type": "revive", "eternal_id": "B1"})
        self.assertEqual(saved, state)
        self.assertNotEqual(restored, state)

    def test_bot_decision_does_not_read_hidden_contents(self):
        state = self.make_game()
        self.start(state)
        action = Game.bot_move(state, "p0")
        for pid, player in state["players"].items():
            player["deck"].reverse()
            if pid != "p0":
                player["hand"] = [rare(f"hidden-{i}") for i in range(3)]
        state["seed"] = "completely changed"
        self.assertEqual(Game.bot_move(state, "p0"), action)

    def test_seeded_bot_games_terminate_and_conserve_every_card(self):
        def all_ids(state):
            piles = [state["river"], state["discard"], state["stage_cards"], state["river_rewards"]]
            piles += list(state["eternal_decks"].values())
            piles += [row["cards"] for row in state["rows"]]
            for player in state["players"].values():
                piles.extend([player["hand"], player["deck"]])
            return [card["id"] for pile in piles for card in pile]
        validator = Draft7Validator(ACTION_SCHEMA)
        for count in (2, 4):
            for seed in (2, 17, 99):
                state = self.make_game(count, seed=seed)
                original = sorted(all_ids(state))
                for step in range(450):
                    if state["game_over"]:
                        break
                    for pid in state["turn_order"]:
                        move = Game.bot_move(state, pid)
                        if move:
                            self.assertTrue(validator.is_valid(move), move)
                            self.act(state, pid, move)
                            self.assertEqual(sorted(all_ids(state)), original)
                            self.assertEqual(len(all_ids(state)), len(set(all_ids(state))))
                            break
                    else:
                        self.fail(f"No bot could act: {state['phase']}")
                self.assertTrue(state["game_over"], (count, seed))


if __name__ == "__main__":
    unittest.main()
