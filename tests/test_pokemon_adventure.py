import copy
import json
import random
import unittest
from collections import Counter

from jsonschema import Draft7Validator

from game.pokemon_adventure import (
    ACTION_SCHEMA,
    CARD_BY_ID,
    CARD_SPECS,
    PokemonAdventureGame,
    _begin_scoring,
    _build_deck,
    _rng_state,
)


def players(count=2):
    return [
        {"player_id": f"p{index + 1}", "name": f"Trainer {index + 1}", "seat": index, "is_bot": False}
        for index in range(count)
    ]


def force_card(state, destination, card_id):
    for container in [state["deck"], state["discard"], *[data["hand"] for data in state["players"].values()]]:
        if card_id in container:
            source_slot = container.index(card_id)
            old_card = destination[0][destination[1]]
            container[source_slot] = old_card
            destination[0][destination[1]] = card_id
            return
    raise AssertionError(f"missing card {card_id}")


def put_hand(state, player_id, card_ids):
    for slot, card_id in enumerate(card_ids):
        force_card(state, (state["players"][player_id]["hand"], slot), card_id)


def ready_state(count=2, seed=7, config=None):
    state = PokemonAdventureGame.init_game({"seed": seed, **(config or {})}, players(count))
    for player_id in state["turn_order"]:
        events, error = PokemonAdventureGame.apply_action(state, player_id, {"type": "initial_reveal", "slot": 0})
        if error:
            raise AssertionError(error)
    state["current_turn"] = "p1"
    return state


def draw_card(state, species, player_id="p1", source="deck"):
    card_id = next(card_id for card_id in CARD_BY_ID if CARD_BY_ID[card_id]["species"] == species)
    pile = state["deck"] if source == "deck" else state["discard"]
    force_card(state, (pile, len(pile) - 1), card_id)
    state["phase"] = "turn"
    state["current_turn"] = player_id
    events, error = PokemonAdventureGame.apply_action(state, player_id, {"type": f"draw_{source}"})
    if error:
        raise AssertionError(error)
    return card_id, events


def card_inventory(state):
    cards = list(state["deck"]) + list(state["discard"])
    for player in state["players"].values():
        cards.extend(player["hand"])
    if state["drawn"]:
        cards.append(state["drawn"]["card"])
    return Counter(cards)


class PokemonAdventureGameTests(unittest.TestCase):
    def assert_rejected_unchanged(self, state, player_id, action):
        before = copy.deepcopy(state)
        events, error = PokemonAdventureGame.apply_action(state, player_id, action)
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_deck_counts_and_deterministic_initial_state(self):
        deck = _build_deck()
        self.assertEqual(len(deck), 56)
        self.assertEqual(len(set(deck)), 56)
        self.assertEqual(Counter(CARD_BY_ID[card]["species"] for card in deck), {spec["species"]: spec["count"] for spec in CARD_SPECS})
        for count in range(2, 6):
            with self.subTest(count=count):
                state = PokemonAdventureGame.init_game({"seed": 42}, players(count))
                self.assertEqual(state, PokemonAdventureGame.init_game({"seed": 42}, players(count)))
                self.assertEqual(len(state["deck"]), 55 - 6 * count)
                self.assertEqual(len(state["discard"]), 1)
                self.assertEqual(state["phase"], "initial_reveal")
                self.assertTrue(all(not any(player["face_up"]) for player in state["players"].values()))
                self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_invalid_players_and_config_are_rejected(self):
        for count in (0, 1, 6):
            with self.assertRaises(ValueError):
                PokemonAdventureGame.init_game({}, players(count))
        for config in ({"target_tokens": 0}, {"seed": True}, {"target_badges": 2}, []):
            with self.subTest(config=config), self.assertRaises(ValueError):
                PokemonAdventureGame.init_game(config, players())
        duplicates = players()
        duplicates[1]["player_id"] = "p1"
        with self.assertRaises(ValueError):
            PokemonAdventureGame.init_game({}, duplicates)

    def test_initial_reveal_is_simultaneous_once_per_player(self):
        state = PokemonAdventureGame.init_game({"seed": 4}, players())
        events, error = PokemonAdventureGame.apply_action(state, "p2", {"type": "initial_reveal", "slot": 5})
        self.assertIsNone(error)
        self.assertTrue(state["players"]["p2"]["face_up"][5])
        self.assertEqual(events[0]["payload"]["card"]["id"], state["players"]["p2"]["hand"][5])
        self.assertEqual(state["phase"], "initial_reveal")
        self.assert_rejected_unchanged(state, "p2", {"type": "initial_reveal", "slot": 2})
        PokemonAdventureGame.apply_action(state, "p1", {"type": "initial_reveal", "slot": 3})
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(PokemonAdventureGame.get_legal_actions(state, state["current_turn"]), ["draw_deck", "draw_discard"])

    def test_deck_draw_is_private_until_replacement(self):
        state = ready_state()
        old_card = state["players"]["p1"]["hand"][1]
        card_id, events = draw_card(state, "pikachu")
        self.assertEqual(PokemonAdventureGame.get_public_view(state, "p1")["drawn"]["card"]["id"], card_id)
        self.assertIsNone(PokemonAdventureGame.get_public_view(state, "p2")["drawn"]["card"])
        self.assertIsNone(PokemonAdventureGame.get_public_view(state, "spectator")["drawn"]["card"])
        self.assertNotIn("card", events[0]["payload"])
        self.assertNotIn(card_id, json.dumps(events))
        events, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 1})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["hand"][1], card_id)
        self.assertEqual(state["discard"][-1], old_card)
        self.assertTrue(state["players"]["p1"]["face_up"][1])
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_optional_deck_card_can_be_discarded_without_reveal(self):
        state = ready_state()
        card_id, _ = draw_card(state, "ditto")
        before = copy.deepcopy(state["players"]["p1"])
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "discard_drawn"})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"], before)
        self.assertEqual(state["discard"][-1], card_id)
        self.assertEqual(state["current_turn"], "p2")

    def test_discard_draw_must_be_used_even_for_optional_special(self):
        for species in ("jigglypuff", "charizard", "snorlax", "ditto"):
            with self.subTest(species=species):
                state = ready_state()
                card_id, _ = draw_card(state, species, source="discard")
                self.assertEqual(PokemonAdventureGame.get_public_view(state, "p2")["drawn"]["card"]["id"], card_id)
                self.assertNotIn("discard_drawn", PokemonAdventureGame.get_legal_actions(state, "p1"))
                self.assert_rejected_unchanged(state, "p1", {"type": "discard_drawn"})

    def test_mandatory_specials_cannot_be_discarded(self):
        for species in ("zapdos", "mew", "team_rocket"):
            with self.subTest(species=species):
                state = ready_state()
                draw_card(state, species)
                self.assert_rejected_unchanged(state, "p1", {"type": "discard_drawn"})
                if species == "mew":
                    self.assert_rejected_unchanged(state, "p1", {"type": "replace_card", "slot": 1})

    def test_charizard_peek_remains_private_and_survives_swap(self):
        state = ready_state()
        draw_card(state, "charizard")
        PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 1})
        self.assertEqual(state["phase"], "ability")
        self.assert_rejected_unchanged(state, "p1", {"type": "peek_card", "slot": 1})
        secret = state["players"]["p1"]["hand"][2]
        events, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "peek_card", "slot": 2})
        self.assertIsNone(error)
        self.assertNotIn(secret, json.dumps(events))
        own = PokemonAdventureGame.get_public_view(state, "p1")["players"][0]["hand"][2]
        other = PokemonAdventureGame.get_public_view(state, "p2")["players"][0]["hand"][2]
        self.assertEqual(own["card"]["id"], secret)
        self.assertFalse(own["face_up"])
        self.assertTrue(own["known"])
        self.assertIsNone(other["card"])
        draw_card(state, "snorlax")
        PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 3})
        PokemonAdventureGame.apply_action(state, "p1", {"type": "swap_cards", "slots": [2, 4]})
        own = PokemonAdventureGame.get_public_view(state, "p1")["players"][0]["hand"]
        self.assertEqual(own[4]["card"]["id"], secret)
        self.assertFalse(own[4]["face_up"])
        self.assertIsNone(PokemonAdventureGame.get_public_view(state, "p2")["players"][0]["hand"][4]["card"])

    def test_snorlax_moves_face_up_and_face_down_with_cards(self):
        state = ready_state()
        draw_card(state, "snorlax")
        PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 1})
        hand = list(state["players"]["p1"]["hand"])
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "swap_cards", "slots": [1, 5]})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["hand"][5], hand[1])
        self.assertEqual(state["players"]["p1"]["hand"][1], hand[5])
        self.assertTrue(state["players"]["p1"]["face_up"][5])
        self.assertFalse(state["players"]["p1"]["face_up"][1])
        self.assertEqual(state["current_turn"], "p2")

    def test_skipping_optional_ability_finishes_turn(self):
        for species in ("charizard", "snorlax"):
            state = ready_state()
            draw_card(state, species)
            PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 1})
            _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "skip_ability"})
            self.assertIsNone(error)
            self.assertEqual(state["phase"], "turn")
            self.assertIsNone(state["pending_ability"])

    def test_zapdos_passes_same_slot_in_turn_order_without_chaining(self):
        state = ready_state(count=4)
        draw_card(state, "zapdos", player_id="p3")
        originals = {player_id: data["hand"][4] for player_id, data in state["players"].items()}
        _, error = PokemonAdventureGame.apply_action(state, "p3", {"type": "replace_card", "slot": 4})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p3"]["hand"][4], "zapdos:0")
        self.assertEqual(state["players"]["p4"]["hand"][4], originals["p3"])
        self.assertEqual(state["players"]["p1"]["hand"][4], originals["p4"])
        self.assertEqual(state["players"]["p2"]["hand"][4], originals["p1"])
        self.assertEqual(state["discard"][0], originals["p2"])
        self.assertEqual(state["last_action"]["discarded"]["id"], originals["p2"])
        self.assertTrue(all(data["face_up"][4] for data in state["players"].values()))
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(state["current_turn"], "p4")
        self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_mew_steals_only_face_up_card_and_is_placed_on_opponent(self):
        state = ready_state()
        draw_card(state, "mew")
        target = state["players"]["p2"]["hand"][4]
        replaced = state["players"]["p1"]["hand"][2]
        self.assert_rejected_unchanged(state, "p1", {"type": "steal_card", "target_player_id": "p1", "target_slot": 4, "slot": 2})
        self.assert_rejected_unchanged(state, "p1", {"type": "steal_card", "target_player_id": "missing", "target_slot": 4, "slot": 2})
        self.assert_rejected_unchanged(state, "p1", {"type": "steal_card", "target_player_id": "p2", "target_slot": 4, "slot": 2})
        state["players"]["p2"]["face_up"][4] = True
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "steal_card", "target_player_id": "p2", "target_slot": 4, "slot": 2})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p2"]["hand"][4], "mew:0")
        self.assertEqual(state["players"]["p1"]["hand"][2], target)
        self.assertEqual(state["discard"][-1], replaced)
        self.assertTrue(state["players"]["p2"]["face_up"][4])
        self.assertTrue(state["players"]["p1"]["face_up"][2])
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_rocket_both_coin_results_are_deterministic(self):
        for seed, expected in ((1, "meowth"), (0, "pikachu")):
            with self.subTest(coin=expected):
                state = ready_state(count=5)
                draw_card(state, "team_rocket")
                originals = {player_id: data["hand"][3] for player_id, data in state["players"].items()}
                state["rng_state"] = _rng_state(random.Random(seed))
                twin = PokemonAdventureGame.deserialize(json.loads(json.dumps(PokemonAdventureGame.serialize(state))))
                for candidate in (state, twin):
                    _, error = PokemonAdventureGame.apply_action(candidate, "p1", {"type": "replace_card", "slot": 3})
                    self.assertIsNone(error)
                self.assertEqual(state, twin)
                self.assertEqual(state["last_action"]["coin"], expected)
                if expected == "meowth":
                    self.assertEqual(state["players"]["p1"]["hand"][3], "team_rocket:0")
                    self.assertTrue(all(state["players"][player_id]["hand"][3] == card for player_id, card in originals.items() if player_id != "p1"))
                else:
                    self.assertTrue(all(data["face_up"][3] for data in state["players"].values()))
                    self.assertTrue(all(card in state["discard"] for card in originals.values()))
                    self.assertEqual(len(state["last_action"]["changes"]), 5)
                self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_recycling_keeps_discard_top_and_can_resolve_rocket(self):
        state = ready_state(count=5)
        draw_card(state, "team_rocket")
        state["discard"] = state["deck"] + state["discard"]
        state["deck"] = []
        state["rng_state"] = _rng_state(random.Random(0))
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 3})
        self.assertIsNone(error)
        self.assertEqual(state["deck_refills"], 1)
        self.assertEqual(card_inventory(state), Counter(_build_deck()))
        state = ready_state()
        state["discard"] = state["deck"] + state["discard"]
        state["deck"] = []
        old_top = state["discard"][-1]
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "draw_deck"})
        self.assertIsNone(error)
        self.assertEqual(state["discard"], [old_top])
        self.assertEqual(state["deck_refills"], 1)
        self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_sixth_reveal_waits_until_snorlax_ability_is_resolved(self):
        state = ready_state()
        put_hand(state, "p1", ["jigglypuff:0", "eevee:0", "pikachu:0", "bulbasaur:0", "squirtle:0", "vulpix:0"])
        state["players"]["p1"]["face_up"] = [True] * 5 + [False]
        draw_card(state, "snorlax")
        PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 5})
        self.assertEqual(state["phase"], "ability")
        self.assertIsNone(state["last_round_summary"])
        PokemonAdventureGame.apply_action(state, "p1", {"type": "skip_ability"})
        self.assertIn(state["phase"], ("round_end", "ditto_choice"))
        self.assertTrue(all(all(data["face_up"]) for data in state["players"].values()))

    def test_zapdos_can_finish_an_opponent(self):
        for species in ("zapdos",):
            with self.subTest(species=species):
                state = ready_state()
                put_hand(state, "p2", ["jigglypuff:0", "eevee:0", "pikachu:0", "bulbasaur:0", "squirtle:0", "vulpix:0"])
                state["players"]["p2"]["face_up"] = [True] * 5 + [False]
                draw_card(state, species)
                action = {"type": "replace_card", "slot": 5} if species == "zapdos" else {"type": "steal_card", "slot": 1, "target_player_id": "p2", "target_slot": 5}
                _, error = PokemonAdventureGame.apply_action(state, "p1", action)
                self.assertIsNone(error)
                self.assertEqual(state["round_finisher"], "p2")
                self.assertIn(state["phase"], ("ditto_choice", "round_end"))

    def test_charizard_with_no_remaining_hidden_card_scores_immediately(self):
        state = ready_state()
        put_hand(state, "p1", ["jigglypuff:0", "eevee:0", "pikachu:0", "bulbasaur:0", "squirtle:0", "vulpix:0"])
        state["players"]["p1"]["face_up"] = [True] * 5 + [False]
        draw_card(state, "charizard")
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 5})
        self.assertIsNone(error)
        self.assertIsNone(state["pending_ability"])
        self.assertIn(state["phase"], ("ditto_choice", "round_end"))

    def test_ditto_copies_horizontal_neighbor_and_pair_scoring(self):
        state = ready_state()
        put_hand(state, "p1", ["bulbasaur:0", "ditto:0", "pikachu:0", "bulbasaur:1", "pikachu:1", "eevee:0"])
        put_hand(state, "p2", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        _begin_scoring(state, "all_revealed", "p1")
        self.assertEqual(state["phase"], "ditto_choice")
        self.assertEqual(PokemonAdventureGame.get_legal_actions(state, "p1"), ["choose_ditto"])
        self.assertEqual(PokemonAdventureGame.get_legal_actions(state, "p2"), [])
        self.assert_rejected_unchanged(state, "p1", {"type": "choose_ditto", "slot": 1, "neighbor_slot": 4})
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "choose_ditto", "slot": 1, "neighbor_slot": 2})
        self.assertIsNone(error)
        result = state["last_round_summary"]["players"][0]
        self.assertEqual(result["values"], [3, -2, -2, 3, -2, 1])
        self.assertEqual(result["columns"], [0, 0, -1])
        self.assertEqual(result["score"], -1)
        self.assertEqual(state["players"]["p1"]["tokens"], 1)
        self.assertEqual(state["phase"], "round_end")

    def test_ditto_edges_and_mutual_copy_loop_have_defined_scores(self):
        state = ready_state()
        put_hand(state, "p1", ["ditto:0", "ditto:1", "pikachu:0", "eevee:0", "eevee:1", "pikachu:1"])
        put_hand(state, "p2", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        _begin_scoring(state, "all_revealed", "p1")
        self.assertEqual(state["ditto_links"]["p1"]["0"], 1)
        PokemonAdventureGame.apply_action(state, "p1", {"type": "choose_ditto", "slot": 1, "neighbor_slot": 0})
        self.assertEqual(state["last_round_summary"]["players"][0]["values"], [0, 0, -2, 1, 1, -2])

    def test_score_tie_uses_card_values_then_seat(self):
        state = ready_state()
        put_hand(state, "p1", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        put_hand(state, "p2", ["jigglypuff:0", "eevee:0", "bulbasaur:0", "jigglypuff:1", "eevee:1", "bulbasaur:1"])
        _begin_scoring(state, "all_revealed", "p1")
        self.assertEqual(state["last_round_summary"]["winner"], "p1")
        self.assertIsNotNone(state["last_round_summary"]["tie_break"])
        state = ready_state()
        put_hand(state, "p1", ["jigglypuff:0", "eevee:0", "bulbasaur:0", "jigglypuff:1", "eevee:1", "bulbasaur:1"])
        put_hand(state, "p2", ["jigglypuff:2", "eevee:2", "bulbasaur:2", "jigglypuff:3", "eevee:3", "bulbasaur:3"])
        _begin_scoring(state, "all_revealed", "p2")
        self.assertEqual(state["last_round_summary"]["winner"], "p1")

    def test_round_confirmation_waits_for_everyone_and_winner_starts(self):
        state = ready_state()
        put_hand(state, "p1", ["jigglypuff:0", "eevee:0", "bulbasaur:0", "jigglypuff:1", "eevee:1", "bulbasaur:1"])
        put_hand(state, "p2", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        _begin_scoring(state, "all_revealed", "p1")
        summary = copy.deepcopy(state["last_round_summary"])
        PokemonAdventureGame.apply_action(state, "p2", {"type": "next_round"})
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["last_round_summary"], summary)
        self.assertEqual(PokemonAdventureGame.get_legal_actions(state, "p2"), [])
        self.assert_rejected_unchanged(state, "p2", {"type": "next_round"})
        PokemonAdventureGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertEqual(state["phase"], "initial_reveal")
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["players"]["p2"]["tokens"], 1)
        self.assertTrue(all(not player["round_ready"] for player in state["players"].values()))
        self.assertEqual(card_inventory(state), Counter(_build_deck()))

    def test_final_round_preserves_results_and_disables_actions(self):
        state = ready_state(config={"target_tokens": 1})
        put_hand(state, "p1", ["jigglypuff:0", "eevee:0", "bulbasaur:0", "jigglypuff:1", "eevee:1", "bulbasaur:1"])
        put_hand(state, "p2", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        _begin_scoring(state, "all_revealed", "p1")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["winner"], ["p2"])
        self.assertTrue(state["last_round_summary"])
        self.assertEqual(PokemonAdventureGame.get_legal_actions(state, "p1"), [])
        self.assert_rejected_unchanged(state, "p1", {"type": "next_round"})

    def test_unavailable_deck_ends_round_without_advancing(self):
        state = ready_state()
        state["deck"] = []
        state["discard"] = []
        _, error = PokemonAdventureGame.apply_action(state, "p1", {"type": "draw_deck"})
        self.assertIsNone(error)
        self.assertEqual(state["round_end_reason"], "deck_empty")
        self.assertIn(state["phase"], ("ditto_choice", "round_end"))

    def test_malformed_and_out_of_turn_actions_never_mutate_state(self):
        state = ready_state()
        actions = [None, [], {}, {"type": "unknown"}, {"type": "draw_deck", "extra": True},
                   {"type": "replace_card", "slot": -1}, {"type": "replace_card", "slot": 6},
                   {"type": "replace_card", "slot": True}, {"type": "replace_card", "slot": 2.0},
                   {"type": "swap_cards", "slots": [1, 1]}, {"type": "swap_cards", "slots": [1, "2"]}]
        for action in actions:
            with self.subTest(action=action):
                self.assert_rejected_unchanged(state, "p1", action)
        self.assert_rejected_unchanged(state, "p2", {"type": "draw_deck"})
        self.assert_rejected_unchanged(state, "unknown", {"type": "draw_deck"})
        self.assert_rejected_unchanged(state, [], {"type": "draw_deck"})

    def test_public_view_has_no_seed_rng_order_or_unseen_identity(self):
        state = ready_state()
        state["knowledge"]["p1"].append(state["players"]["p1"]["hand"][2])
        for viewer in ("p1", "p2", "spectator"):
            view = PokemonAdventureGame.get_public_view(state, viewer)
            self.assertNotIn("rng_state", view)
            self.assertNotIn("deck", view)
            self.assertNotIn("knowledge", view)
            self.assertNotIn("seed", view["config"])
            for player in view["players"]:
                for card in player["hand"]:
                    if not card["face_up"] and not (viewer == "p1" and player["player_id"] == "p1" and card["slot"] == 2):
                        self.assertIsNone(card["card"])
                        self.assertFalse(card["known"])
        view = PokemonAdventureGame.get_public_view(state, "p1")
        view["players"][0]["hand"][0]["card"]["value"] = 9000
        self.assertNotEqual(PokemonAdventureGame.get_public_view(state, "p1")["players"][0]["hand"][0]["card"]["value"], 9000)

    def test_json_serialization_restores_pending_ability_exactly(self):
        state = ready_state()
        draw_card(state, "charizard")
        PokemonAdventureGame.apply_action(state, "p1", {"type": "replace_card", "slot": 1})
        restored = PokemonAdventureGame.deserialize(json.loads(json.dumps(PokemonAdventureGame.serialize(state))))
        self.assertEqual(restored, state)
        self.assertEqual(PokemonAdventureGame.get_public_view(restored, "p1"), PokemonAdventureGame.get_public_view(state, "p1"))
        for candidate in (state, restored):
            _, error = PokemonAdventureGame.apply_action(candidate, "p1", {"type": "peek_card", "slot": 2})
            self.assertIsNone(error)
        self.assertEqual(restored, state)
        with self.assertRaises(ValueError):
            PokemonAdventureGame.deserialize({"game_id": "pokemon_adventure", "players": {}})

    def test_json_serialization_restores_ditto_and_partial_confirmation(self):
        state = ready_state()
        put_hand(state, "p1", ["bulbasaur:0", "ditto:0", "pikachu:0", "bulbasaur:1", "pikachu:1", "eevee:0"])
        put_hand(state, "p2", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        _begin_scoring(state, "all_revealed", "p1")
        restored = PokemonAdventureGame.deserialize(json.loads(json.dumps(PokemonAdventureGame.serialize(state))))
        self.assertEqual(restored, state)
        PokemonAdventureGame.apply_action(restored, "p1", {"type": "choose_ditto", "slot": 1, "neighbor_slot": 2})
        PokemonAdventureGame.apply_action(restored, "p2", {"type": "next_round"})
        second_restore = PokemonAdventureGame.deserialize(json.loads(json.dumps(PokemonAdventureGame.serialize(restored))))
        self.assertEqual(second_restore, restored)
        self.assertEqual(PokemonAdventureGame.get_legal_actions(second_restore, "p2"), [])
        self.assertEqual(PokemonAdventureGame.get_legal_actions(second_restore, "p1"), ["next_round"])
        PokemonAdventureGame.apply_action(second_restore, "p1", {"type": "next_round"})
        self.assertEqual(second_restore["round"], 2)
        self.assertEqual(second_restore["phase"], "initial_reveal")

    def test_bot_confirmation_waits_for_human(self):
        state = ready_state()
        state["player_meta"]["p2"]["is_bot"] = True
        put_hand(state, "p1", ["jigglypuff:0", "eevee:0", "bulbasaur:0", "jigglypuff:1", "eevee:1", "bulbasaur:1"])
        put_hand(state, "p2", ["squirtle:0", "vulpix:0", "gengar:0", "squirtle:1", "vulpix:1", "gengar:1"])
        _begin_scoring(state, "all_revealed", "p1")
        action = PokemonAdventureGame.bot_move(state, "p2")
        self.assertEqual(action, {"type": "next_round"})
        PokemonAdventureGame.apply_action(state, "p2", action)
        self.assertEqual(state["phase"], "round_end")
        self.assertTrue(state["last_round_summary"])
        self.assertIsNone(PokemonAdventureGame.bot_move(state, "p2"))
        self.assertFalse(state["players"]["p1"]["round_ready"])

    def test_bot_uses_only_visible_information(self):
        state = ready_state()
        draw_card(state, "eevee")
        twin = copy.deepcopy(state)
        for player in twin["players"].values():
            hidden_slots = [slot for slot, face_up in enumerate(player["face_up"]) if not face_up]
            hidden_cards = [player["hand"][slot] for slot in hidden_slots]
            for slot, card_id in zip(hidden_slots, reversed(hidden_cards)):
                player["hand"][slot] = card_id
        twin["deck"].reverse()
        self.assertEqual(PokemonAdventureGame.get_public_view(twin, "p1"), PokemonAdventureGame.get_public_view(state, "p1"))
        self.assertEqual(PokemonAdventureGame.bot_move(twin, "p1"), PokemonAdventureGame.bot_move(state, "p1"))

    def test_bot_complete_games_preserve_cards_and_validate_actions(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        for count in (2, 3, 5):
            for seed in (2, 11):
                with self.subTest(count=count, seed=seed):
                    state = PokemonAdventureGame.init_game({"seed": seed}, players(count))
                    for step in range(2500):
                        if state["game_over"]:
                            break
                        for player_id in state["turn_order"]:
                            action = PokemonAdventureGame.bot_move(state, player_id)
                            if action:
                                self.assertTrue(validator.is_valid(action), action)
                                _, error = PokemonAdventureGame.apply_action(state, player_id, action)
                                self.assertIsNone(error, (state["phase"], action, error))
                                break
                        else:
                            self.fail(f"bot stalled in {state['phase']}")
                        self.assertEqual(card_inventory(state), Counter(_build_deck()))
                    self.assertTrue(state["game_over"], (count, seed, state["phase"], state["round"]))
                    self.assertEqual(state["players"][state["winner"][0]]["tokens"], 3)
                    self.assertLessEqual(state["round"], 2 * count + 1)


if __name__ == "__main__":
    unittest.main()
