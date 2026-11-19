import copy
import json
import random
import unittest
from collections import Counter

from jsonschema import Draft7Validator

from game import ForNorthwoodGame, get_game
from game.for_northwood import response_wins
from game.for_northwood_data import ACTION_SCHEMA, CARDS, CHARACTERS, CONFIG_SCHEMA, STARS, SUITS


def fresh(config=None):
    return ForNorthwoodGame.init_game(config, [{"player_id": "envoy", "name": "Envoy", "seat": 0}])


def arranged(character="jack_claws", hand=None, deck_top=None, score=None, discard=None, target=4):
    state = fresh()
    state["current_fief"] = target
    state["fiefs"][target]["ruler"] = "king_leaves"
    state["phase"] = "before_trick"
    state["hand"] = list(hand if hand is not None else ["claws_2", "flowers_3", "eyes_4", "leaves_5"])
    state["score"] = list(score or [])
    state["discard"] = list(discard or [])
    used = state["hand"] + state["score"] + state["discard"]
    remaining = [card for card in CARDS if card not in used and card not in (deck_top or [])]
    state["deck"] = remaining + list(reversed(deck_top or []))
    state["active_allies"][0]["character"] = character
    return state


class NorthwoodTestCase(unittest.TestCase):
    def act(self, state, action_type, **fields):
        events, error = ForNorthwoodGame.apply_action(state, "envoy", {"type": action_type, **fields})
        self.assertIsNone(error, (action_type, fields, error))
        self.assertTrue(events)

    def reject(self, state, action_type, player_id="envoy", **fields):
        before = copy.deepcopy(state)
        events, error = ForNorthwoodGame.apply_action(state, player_id, {"type": action_type, **fields})
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def ability(self, state):
        self.act(state, "use_ability", slot=0)

    def assert_cards_conserved(self, state):
        all_cards = state["hand"] + state["deck"] + state["score"] + state["discard"]
        self.assertEqual(Counter(all_cards), Counter(list(CARDS)))


class NorthwoodSetupTests(NorthwoodTestCase):
    def test_registration_and_catalog(self):
        definition = get_game("for_northwood")
        self.assertIs(definition.module, ForNorthwoodGame)
        self.assertEqual(definition.name_zh, "为了北境森林")
        self.assertEqual((definition.min_players, definition.max_players), (1, 1))
        self.assertEqual(definition.turn_mode, "turn")
        self.assertEqual(len(CARDS), 32)
        self.assertEqual(len(CHARACTERS), 24)
        self.assertEqual(sum(STARS), 20)

    def test_introductory_deal_and_characters(self):
        state = fresh()
        self.assertEqual(state["phase"], "choose_fief")
        self.assertEqual(len(state["hand"]), 8)
        self.assertEqual(len(state["deck"]), 24)
        self.assertEqual(set(state["allies"]), {f"jack_{suit}" for suit in SUITS})
        self.assertEqual({fief["ruler"] for fief in state["fiefs"]}, {
            f"{rank}_{suit}" for rank in ("queen", "king") for suit in SUITS
        })
        self.assert_cards_conserved(state)

    def test_standard_uses_unique_balanced_characters(self):
        for seed in range(12):
            with self.subTest(seed=seed):
                random.seed(seed)
                state = fresh({"setup": "standard"})
                characters = state["allies"] + [fief["ruler"] for fief in state["fiefs"]]
                self.assertEqual(len(set(characters)), 12)
                self.assertEqual(Counter(CHARACTERS[character]["suit"] for character in state["allies"]), Counter(list(SUITS)))
                self.assertEqual(Counter(CHARACTERS[fief["ruler"]]["suit"] for fief in state["fiefs"]), Counter({suit: 2 for suit in SUITS}))

    def test_config_and_player_count_validation(self):
        for config in ({"setup": "invented"}, {"goal": 17}, {"unknown": True}, {"goal": True}):
            self.assertFalse(Draft7Validator(CONFIG_SCHEMA).is_valid(config))
            with self.assertRaises(ValueError):
                fresh(config)
        for count in (0, 2):
            with self.assertRaises(ValueError):
                ForNorthwoodGame.init_game({}, [{"player_id": str(index)} for index in range(count)])

    def test_bad_actions_never_mutate(self):
        state = fresh()
        self.reject(state, "choose_fief", fief=-1)
        self.reject(state, "choose_fief", fief=True)
        self.reject(state, "choose_fief", fief=8)
        self.reject(state, "choose_fief", fief=4, extra=True)
        self.reject(state, "choose_fief", player_id="stranger", fief=4)
        self.reject(state, "reveal")
        self.reject(state, "use_ability", slot=0)
        self.assertFalse(Draft7Validator(ACTION_SCHEMA).is_valid({"type": "ability_cards", "cards": ["eyes_1", "eyes_1"]}))


class NorthwoodDialogueTests(NorthwoodTestCase):
    def test_trick_comparison(self):
        self.assertTrue(response_wins("claws_3", "claws_4", "leaves"))
        self.assertFalse(response_wins("claws_4", "claws_3", "leaves"))
        self.assertTrue(response_wins("eyes_8", "leaves_1", "leaves"))
        self.assertFalse(response_wins("leaves_1", "eyes_8", "leaves"))
        self.assertFalse(response_wins("claws_1", "eyes_8", "leaves"))

    def test_follow_suit_is_server_validated(self):
        state = arranged(hand=["eyes_2", "leaves_8"], deck_top=["eyes_5"])
        self.act(state, "reveal")
        self.assertEqual(ForNorthwoodGame.get_public_view(state, "envoy")["legal_cards"], ["eyes_2"])
        self.reject(state, "play", card="leaves_8")
        self.reject(state, "play", card="eyes_3")
        self.reject(state, "use_ability", slot=0)
        self.act(state, "play", card="eyes_2")
        self.assertEqual(state["discard"][-2:], ["eyes_5", "eyes_2"])
        self.assertEqual(state["score"], [])
        self.assertEqual(state["phase"], "trick_review")
        self.assertEqual(state["deck"][-1] in state["hand"], False)

    def test_won_trick_scores_only_response_and_pauses(self):
        state = arranged(hand=["claws_8", "eyes_2"], deck_top=["claws_3"])
        self.act(state, "reveal")
        self.act(state, "play", card="claws_8")
        self.assertEqual(state["score"], ["claws_8"])
        self.assertEqual(state["discard"], ["claws_3"])
        self.assertEqual(state["phase"], "trick_review")
        self.reject(state, "reveal")
        self.act(state, "next_trick")
        self.assertEqual(state["phase"], "before_trick")
        self.assertEqual(state["trick"], 2)
        self.assertIsNone(state["statement"])

    def test_ability_limit_and_exhaustion(self):
        state = arranged("queen_eyes")
        self.ability(state)
        self.assertTrue(state["active_allies"][0]["exhausted"])
        self.reject(state, "use_ability", slot=1)
        self.act(state, "reveal")
        self.act(state, "play", card=ForNorthwoodGame.get_public_view(state, "envoy")["legal_cards"][0])
        self.act(state, "next_trick")
        self.assertIn("use_ability", ForNorthwoodGame.get_legal_actions(state, "envoy"))
        self.reject(state, "use_ability", slot=0)

    def test_empty_hand_ends_visit_without_extra_ability(self):
        state = arranged(hand=["claws_1"], deck_top=["claws_8"], target=0)
        self.act(state, "reveal")
        self.act(state, "play", card="claws_1")
        self.assertEqual(state["phase"], "visit_review")
        self.assertEqual(state["fiefs"][0]["status"], "friendly")
        self.assertEqual(state["stars"], 4)
        self.reject(state, "use_ability", slot=0)
        self.assertFalse(state["game_over"])
        self.act(state, "next_round")
        self.assertEqual(state["phase"], "choose_fief")
        self.assertEqual(len(state["hand"]), 8)
        self.assertTrue(all(not ally["exhausted"] for ally in state["active_allies"]))
        self.assert_cards_conserved(state)

    def test_empty_deck_ends_visit_even_with_cards_left(self):
        state = arranged(hand=["eyes_8", "flowers_5"], target=0)
        state["deck"] = ["eyes_1"]
        self.act(state, "reveal")
        self.act(state, "play", card="eyes_8")
        self.assertEqual(state["phase"], "visit_review")
        self.assertEqual(state["fiefs"][0]["status"], "lost")
        self.assertEqual(state["stars"], 0)

    def test_complete_eight_visits_and_final_pause(self):
        for seed in range(6):
            with self.subTest(seed=seed):
                random.seed(seed)
                state = fresh({"setup": "standard"})
                steps = 0
                final_review_seen = False
                while not state["game_over"]:
                    if len(state["history"]) == 8:
                        final_review_seen = True
                        self.assertEqual(state["phase"], "visit_review")
                    action = ForNorthwoodGame.bot_move(state, "envoy")
                    self.assertIsNotNone(action)
                    self.assertTrue(Draft7Validator(ACTION_SCHEMA).is_valid(action), action)
                    self.act(state, **{"action_type": action.pop("type"), **action})
                    self.assert_cards_conserved(state)
                    steps += 1
                    self.assertLess(steps, 500)
                self.assertTrue(final_review_seen)
                self.assertEqual(len(state["history"]), 8)
                self.assertTrue(all(fief["status"] != "unvisited" for fief in state["fiefs"]))
                self.assertEqual(state["winner"], ["envoy"] if state["stars"] >= 16 else [])
                self.assertEqual(state["scores"], {"envoy": state["stars"]})
                self.assertEqual(ForNorthwoodGame.get_legal_actions(state, "envoy"), [])


class NorthwoodClawsTests(NorthwoodTestCase):
    def test_jack_refills_and_respects_empty_deck(self):
        state = arranged("jack_claws")
        self.ability(state)
        self.assertEqual(len(state["hand"]), 8)
        self.assert_cards_conserved(state)
        state = arranged("jack_claws")
        state["deck"] = ["eyes_8"]
        self.ability(state)
        self.assertEqual(state["phase"], "visit_review")
        self.assertEqual(len(state["hand"]), 5)

    def test_queen_draws_all_three_tops(self):
        state = arranged("queen_claws", deck_top=["claws_8"], score=["flowers_8"], discard=["eyes_8"])
        self.ability(state)
        self.assertEqual(state["hand"][-3:], ["claws_8", "eyes_8", "flowers_8"])
        self.assertEqual(len(state["score"]), 0)
        self.assert_cards_conserved(state)

    def test_king_scores_every_tied_maximum_in_chosen_order(self):
        state = arranged("king_claws", hand=["claws_8", "eyes_8", "leaves_1"])
        self.ability(state)
        self.reject(state, "ability_cards", cards=["claws_8"])
        self.act(state, "ability_cards", cards=["eyes_8", "claws_8"])
        self.assertEqual(state["score"], ["eyes_8", "claws_8"])
        self.assertEqual(state["hand"], ["leaves_1"])
        self.assert_cards_conserved(state)

    def test_prince_draws_at_least_one_and_stops_on_trump(self):
        state = arranged("prince_claws", deck_top=["claws_1", "eyes_1", "leaves_1"])
        self.ability(state)
        self.assertEqual(state["hand"][-1], "claws_1")
        self.assertEqual(state["pending"]["kind"], "draw_until")
        self.act(state, "ability_decision", decision="draw")
        self.act(state, "ability_decision", decision="draw")
        self.assertEqual(state["hand"][-3:], ["claws_1", "eyes_1", "leaves_1"])
        self.assertEqual(state["phase"], "before_trick")
        state = arranged("prince_claws", deck_top=["eyes_1"])
        self.ability(state)
        self.act(state, "ability_decision", decision="stop")
        self.assertEqual(state["hand"][-1], "eyes_1")

    def test_lady_discards_one_tied_lowest(self):
        state = arranged("lady_claws", hand=["claws_2", "eyes_2", "flowers_8"])
        self.ability(state)
        self.reject(state, "ability_cards", cards=["flowers_8"])
        self.act(state, "ability_cards", cards=["eyes_2"])
        self.assertEqual(len(state["hand"]), 4)
        self.assertEqual(state["discard"][-1], "eyes_2")
        self.assert_cards_conserved(state)

    def test_baron_searches_all_matching_values_and_forgets_order(self):
        state = arranged("baron_claws", hand=["claws_3", "eyes_6"])
        state["known_top"] = list(reversed(state["deck"][-3:]))
        self.ability(state)
        self.act(state, "ability_cards", cards=["claws_3"])
        self.assertEqual(sum(CARDS[card]["value"] == 3 for card in state["hand"]), 4)
        self.assertEqual(state["known_top"], [])
        self.assert_cards_conserved(state)


class NorthwoodFlowersTests(NorthwoodTestCase):
    def test_jack_discards_current_trumps_and_can_end_visit(self):
        state = arranged("jack_flowers", hand=["leaves_2", "leaves_7"], target=0)
        self.ability(state)
        self.act(state, "ability_cards", cards=["leaves_7", "leaves_2"])
        self.assertEqual(state["discard"], ["leaves_7", "leaves_2"])
        self.assertEqual(state["phase"], "visit_review")
        self.assertEqual(state["stars"], 4)

    def test_queen_changes_score_and_next_statement(self):
        state = arranged("queen_flowers", score=["flowers_7", "claws_1"])
        self.ability(state)
        self.assertEqual(state["score"], ["flowers_7"])
        self.assertEqual(state["known_top"], ["claws_1"])
        self.act(state, "reveal")
        self.assertEqual(state["statement"], "claws_1")
        self.assertEqual(state["known_top"], [])

    def test_king_requires_exactly_two_summing_nine(self):
        state = arranged("king_flowers", hand=["eyes_1", "claws_8", "eyes_8", "flowers_4"])
        self.ability(state)
        self.reject(state, "ability_cards", cards=["eyes_1", "flowers_4"])
        self.act(state, "ability_cards", cards=["claws_8", "eyes_1"])
        self.assertEqual(state["discard"], ["claws_8", "eyes_1"])
        state = arranged("king_flowers", hand=["eyes_2", "claws_4"])
        self.ability(state)
        self.assertEqual(state["phase"], "before_trick")
        self.assertTrue(state["active_allies"][0]["exhausted"])

    def test_prince_keeps_one_of_each_value(self):
        state = arranged("prince_flowers", hand=["eyes_2", "claws_2", "leaves_2", "eyes_4", "claws_4", "flowers_8"])
        self.ability(state)
        self.reject(state, "ability_cards", cards=["eyes_2", "claws_2", "leaves_2"])
        self.act(state, "ability_cards", cards=["eyes_2", "claws_4", "claws_2"])
        self.assertEqual(set(state["hand"]), {"leaves_2", "eyes_4", "flowers_8"})
        self.assert_cards_conserved(state)

    def test_lady_discards_current_hand_size(self):
        state = arranged("lady_flowers", hand=["eyes_3", "claws_2", "leaves_3"])
        self.ability(state)
        self.reject(state, "ability_cards", cards=["claws_2"])
        self.act(state, "ability_cards", cards=["leaves_3"])
        self.assertEqual(state["discard"], ["leaves_3"])

    def test_baron_discards_every_low_card_in_order(self):
        state = arranged("baron_flowers", hand=["eyes_1", "claws_2", "leaves_3", "flowers_4"])
        self.ability(state)
        self.act(state, "ability_cards", cards=["leaves_3", "claws_2", "eyes_1"])
        self.assertEqual(state["hand"], ["flowers_4"])
        self.assertEqual(state["discard"][-1], "eyes_1")
        self.assert_cards_conserved(state)


class NorthwoodEyesTests(NorthwoodTestCase):
    def test_jack_can_discard_drawn_cards_in_either_order(self):
        state = arranged("jack_eyes", deck_top=["eyes_8", "claws_8"])
        original = list(state["hand"])
        self.ability(state)
        self.reject(state, "reveal")
        self.act(state, "ability_cards", cards=["claws_8", "eyes_8"])
        self.assertEqual(state["hand"], original)
        self.assertEqual(state["discard"], ["claws_8", "eyes_8"])
        self.assert_cards_conserved(state)

    def test_queen_preserves_deck_and_remembers_three_in_order(self):
        state = arranged("queen_eyes", deck_top=["claws_1", "eyes_1", "flowers_1"])
        before = list(state["deck"])
        self.ability(state)
        self.assertEqual(state["deck"], before)
        self.assertEqual(state["known_top"], ["claws_1", "eyes_1", "flowers_1"])
        self.act(state, "reveal")
        self.assertEqual(state["known_top"], ["eyes_1", "flowers_1"])

    def test_king_names_suit_before_drawing_and_discards_all_of_it(self):
        state = arranged("king_eyes", hand=["flowers_1", "claws_4"], deck_top=["flowers_8", "eyes_1"])
        before = list(state["hand"])
        self.ability(state)
        self.assertEqual(state["hand"], before)
        self.act(state, "ability_suit", suit="flowers")
        self.act(state, "ability_cards", cards=["flowers_8", "flowers_1"])
        self.assertEqual(set(state["hand"]), {"claws_4", "eyes_1"})
        self.assert_cards_conserved(state)

    def test_prince_repeats_for_other_exhausted_allies_plus_self(self):
        state = arranged("prince_eyes", deck_top=["eyes_8", "claws_8", "flowers_8"])
        state["active_allies"][1]["exhausted"] = True
        state["active_allies"][2]["exhausted"] = True
        self.ability(state)
        self.assertEqual(state["pending"]["remaining"], 3)
        for count in (3, 2, 1):
            self.assertEqual(state["pending"]["remaining"], count)
            self.act(state, "ability_cards", cards=[state["hand"][-1]])
        self.assertEqual(state["phase"], "before_trick")
        self.assert_cards_conserved(state)

    def test_lady_discards_any_combination_of_equal_total(self):
        state = arranged("lady_eyes", hand=["claws_1", "eyes_2", "flowers_3", "leaves_8"], deck_top=["flowers_2", "eyes_4"])
        self.ability(state)
        self.assertEqual(state["pending"]["total"], 6)
        self.reject(state, "ability_cards", cards=["leaves_8"])
        self.act(state, "ability_cards", cards=["eyes_2", "flowers_3", "claws_1"])
        self.assertEqual(set(state["hand"]), {"leaves_8", "flowers_2", "eyes_4"})
        self.assert_cards_conserved(state)

    def test_baron_even_last_response_draws_before_empty_hand_check(self):
        state = arranged("baron_eyes", hand=["eyes_2"], deck_top=["eyes_8", "claws_8"])
        self.ability(state)
        self.act(state, "reveal")
        self.act(state, "play", card="eyes_2")
        self.assertEqual(state["hand"], ["claws_8"])
        self.assertEqual(state["phase"], "trick_review")
        self.assertFalse(state["parity_effect"])

    def test_baron_odd_forces_discard_even_if_deck_became_empty(self):
        state = arranged("baron_eyes", hand=["eyes_3", "claws_5"])
        state["deck"] = ["eyes_8"]
        self.ability(state)
        self.act(state, "reveal")
        self.act(state, "play", card="eyes_3")
        self.assertEqual(state["phase"], "ability")
        self.assertEqual(state["pending"]["kind"], "parity_discard")
        self.act(state, "ability_cards", cards=["claws_5"])
        self.assertEqual(state["phase"], "visit_review")


class NorthwoodLeavesTests(NorthwoodTestCase):
    def test_jack_swaps_only_nearby_neutral_rulers_without_wrapping(self):
        state = arranged("jack_leaves", target=0)
        state["fiefs"][1]["status"] = "friendly"
        state["fiefs"][2]["ruler"] = "queen_flowers"
        original = state["fiefs"][0]["ruler"]
        self.ability(state)
        self.assertEqual(state["pending"]["fiefs"], [2])
        self.reject(state, "ability_fief", fief=7)
        self.act(state, "ability_fief", fief=2)
        self.assertEqual(state["fiefs"][0]["ruler"], "queen_flowers")
        self.assertEqual(state["fiefs"][2]["ruler"], original)
        self.assertEqual(state["current_fief"], 0)
        self.assertEqual(ForNorthwoodGame.get_public_view(state, "envoy")["trump"], "flowers")

    def test_queen_copies_ruler_ability_not_its_exhaustion(self):
        state = arranged("queen_leaves", score=["flowers_1"])
        state["fiefs"][4]["ruler"] = "queen_flowers"
        self.ability(state)
        self.assertEqual(state["score"], [])
        self.assertEqual(state["deck"][-1], "flowers_1")
        self.assertTrue(state["active_allies"][0]["exhausted"])

    def test_queen_can_copy_multistep_draw_and_discard(self):
        state = arranged("queen_leaves")
        state["fiefs"][4]["ruler"] = "jack_eyes"
        original = list(state["hand"])
        self.ability(state)
        self.assertEqual(state["pending"]["kind"], "discard_two")
        self.act(state, "ability_cards", cards=state["hand"][-2:])
        self.assertEqual(state["hand"], original)

    def test_king_must_exchange_with_an_original_hand_card(self):
        state = arranged("king_leaves", deck_top=["claws_8"])
        self.ability(state)
        self.assertEqual(state["pending"]["revealed"], "claws_8")
        self.reject(state, "ability_cards", cards=["claws_8"])
        self.act(state, "ability_cards", cards=["eyes_4"])
        self.assertIn("claws_8", state["hand"])
        self.assertEqual(state["known_top"][0], "eyes_4")
        self.act(state, "reveal")
        self.assertEqual(state["statement"], "eyes_4")
        self.assert_cards_conserved(state)

    def test_prince_moves_visit_to_nearest_unvisited_in_each_direction(self):
        state = arranged("prince_leaves", target=4)
        state["fiefs"][3]["status"] = "lost"
        state["fiefs"][2]["status"] = "friendly"
        state["fiefs"][5]["status"] = "friendly"
        self.ability(state)
        self.assertEqual(state["pending"]["fiefs"], [1, 6])
        self.reject(state, "ability_fief", fief=7)
        self.act(state, "ability_fief", fief=1)
        self.assertEqual(state["current_fief"], 1)
        self.assertEqual(state["fiefs"][4]["status"], "unvisited")

    def test_lady_draws_and_must_refresh_another_exhausted_ally(self):
        state = arranged("lady_leaves", deck_top=["claws_8"])
        state["active_allies"][2]["exhausted"] = True
        self.ability(state)
        self.assertEqual(state["hand"][-1], "claws_8")
        self.assertEqual(state["pending"]["slots"], [2])
        self.reject(state, "ability_ally", slot=0)
        self.act(state, "ability_ally", slot=2)
        self.assertFalse(state["active_allies"][2]["exhausted"])
        self.assertTrue(state["active_allies"][0]["exhausted"])

    def test_baron_optional_two_stage_same_value_swaps(self):
        state = arranged("baron_leaves", hand=["eyes_3", "claws_2"], discard=["flowers_3"], score=["leaves_2"])
        self.ability(state)
        self.reject(state, "ability_cards", cards=["claws_2"])
        self.act(state, "ability_cards", cards=["eyes_3"])
        self.assertEqual(state["pending"]["pile"], "score")
        self.act(state, "ability_cards", cards=["claws_2"])
        self.assertEqual(set(state["hand"]), {"flowers_3", "leaves_2"})
        self.assertEqual(state["score"], ["claws_2"])
        self.assertEqual(state["discard"], ["eyes_3"])
        self.assert_cards_conserved(state)
        state = arranged("baron_leaves", discard=["flowers_3"], score=["leaves_4"])
        original = list(state["hand"])
        self.ability(state)
        self.act(state, "ability_decision", decision="skip")
        self.act(state, "ability_decision", decision="skip")
        self.assertEqual(state["hand"], original)


class NorthwoodPersistenceTests(NorthwoodTestCase):
    def test_seeded_complete_games_with_abilities_and_substitutions(self):
        for seed in range(24):
            with self.subTest(seed=seed):
                random.seed(seed)
                state = fresh({"setup": "standard"})
                steps = 0
                while not state["game_over"]:
                    if state["phase"] == "before_trick" and "use_ability" in ForNorthwoodGame.get_legal_actions(state, "envoy"):
                        choices = [index for index, ally in enumerate(state["active_allies"]) if not ally["exhausted"]]
                        action = {"type": "use_ability", "slot": random.choice(choices)}
                    elif state["phase"] == "prepare" and not state["borrowed"]:
                        guests = [index for index, fief in enumerate(state["fiefs"])
                                  if fief["status"] == "friendly" and not fief["spent"]]
                        action = {"type": "substitute", "slot": 0, "fief": guests[0]} if guests else {"type": "start_visit"}
                    else:
                        action = ForNorthwoodGame.bot_move(state, "envoy")
                    self.assertIsNotNone(action)
                    self.act(state, action.pop("type"), **action)
                    self.assert_cards_conserved(state)
                    self.assertEqual(len({entry["fief"] for entry in state["history"]}), len(state["history"]))
                    self.assertLessEqual(len(state["known_top"]), len(state["deck"]))
                    if state["known_top"]:
                        self.assertEqual(state["known_top"], list(reversed(state["deck"][-len(state["known_top"]):])))
                    steps += 1
                    self.assertLess(steps, 1200)
                self.assertEqual(len(state["history"]), 8)

    def test_substitutes_are_once_only_and_stars_are_retained(self):
        state = fresh()
        state["fiefs"][0].update(status="friendly", ruler="queen_eyes")
        state["stars"] = 4
        self.act(state, "choose_fief", fief=1)
        self.act(state, "substitute", slot=0, fief=0)
        self.reject(state, "substitute", slot=1, fief=0)
        self.act(state, "return_ally", slot=0)
        self.assertEqual(state["borrowed"], [])
        self.act(state, "substitute", slot=2, fief=0)
        self.act(state, "start_visit")
        self.reject(state, "return_ally", slot=2)
        while state["phase"] != "visit_review":
            action = ForNorthwoodGame.bot_move(state, "envoy")
            self.act(state, action.pop("type"), **action)
        self.assertTrue(state["fiefs"][0]["spent"])
        self.assertGreaterEqual(state["stars"], 4)
        self.act(state, "next_round")
        self.assertEqual([ally["character"] for ally in state["active_allies"]], state["allies"])
        self.act(state, "choose_fief", fief=2)
        self.reject(state, "substitute", slot=0, fief=0)

    def test_all_persistent_states_roundtrip_without_shared_references(self):
        states = [fresh(), arranged("jack_eyes"), arranged("prince_claws")]
        self.ability(states[1])
        self.ability(states[2])
        for state in states:
            with self.subTest(phase=state["phase"]):
                payload = ForNorthwoodGame.serialize(state)
                loaded = ForNorthwoodGame.deserialize(json.loads(json.dumps(payload)))
                self.assertEqual(state, loaded)
                action = ForNorthwoodGame.bot_move(loaded, "envoy")
                original = copy.deepcopy(state)
                self.act(loaded, action.pop("type"), **action)
                self.assertEqual(state, original)

    def test_public_views_hide_deck_and_non_owner_private_decisions(self):
        state = arranged("king_leaves", deck_top=["claws_8"])
        self.ability(state)
        state["known_top"] = list(reversed(state["deck"][-3:]))
        owner = ForNorthwoodGame.get_public_view(state, "envoy")
        spectator = ForNorthwoodGame.get_public_view(state, "stranger")
        for public in (owner, spectator):
            self.assertNotIn("deck", public)
            self.assertEqual(public["deck_count"], len(state["deck"]))
        self.assertTrue(owner["pending"])
        self.assertTrue(owner["known_top"])
        self.assertEqual(spectator["hand"], [])
        self.assertEqual(spectator["known_top"], [])
        self.assertIsNone(spectator["pending"])
        self.assertEqual(spectator["legal_actions"], [])
        self.assertEqual(spectator["legal_cards"], [])
        owner["fiefs"][0]["status"] = "lost"
        self.assertNotEqual(state["fiefs"][0]["status"], "lost")

    def test_every_character_finishes_its_ability_with_card_conservation(self):
        for character in CHARACTERS:
            for seed in range(3):
                with self.subTest(character=character, seed=seed):
                    random.seed(seed)
                    state = fresh({"setup": "standard"})
                    state["current_fief"] = 4
                    state["fiefs"][4]["ruler"] = "queen_flowers"
                    state["phase"] = "before_trick"
                    state["active_allies"][0]["character"] = character
                    for slot in (1, 2):
                        state["active_allies"][slot]["exhausted"] = True
                    state["score"] = [state["deck"].pop()]
                    state["discard"] = [state["deck"].pop()]
                    self.ability(state)
                    steps = 0
                    while state["phase"] == "ability":
                        payload = ForNorthwoodGame.serialize(state)
                        state = ForNorthwoodGame.deserialize(json.loads(json.dumps(payload)))
                        action = ForNorthwoodGame.bot_move(state, "envoy")
                        self.assertIsNotNone(action)
                        self.act(state, action.pop("type"), **action)
                        self.assert_cards_conserved(state)
                        steps += 1
                        self.assertLess(steps, 15)
                    self.assert_cards_conserved(state)


if __name__ == "__main__":
    unittest.main()
