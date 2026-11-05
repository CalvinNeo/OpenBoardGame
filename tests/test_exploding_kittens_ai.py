"""Regression tests for Exploding Kittens bot decisions.

The bot receives the same recipient-specific public view as a remote client.
Checks cover legality, liveness, privacy and tactical choices which preserve
defenses or avoid a known kitten.
"""

import copy
import json
import unittest

from jsonschema import Draft7Validator

from game.exploding_kittens import ACTION_SCHEMA, ExplodingKittensGame as Game
from tests.test_exploding_kittens import apply, cards, make_state, play, settle


class ExplodingKittensAITests(unittest.TestCase):
    def assert_valid_bot_action(self, state, player_id, move):
        """Validate and execute a bot action on a detached state copy."""
        self.assertIsInstance(move, dict)
        Draft7Validator(ACTION_SCHEMA).validate(move)
        trial = copy.deepcopy(state)
        events, error = Game.apply_action(trial, player_id, move)
        self.assertIsNone(error, (player_id, move, error))
        self.assertIsInstance(events, list)

    def test_bot_decisions_are_legal_through_every_interactive_phase(self):
        """The bot can answer all private/public pauses without a special case."""
        scenarios = []

        playing = make_state(3, seed=1)
        playing["players"]["p0"]["hand"] = cards("skip")
        playing["current_turn"] = "p0"
        scenarios.append((playing, "p0"))

        reaction = make_state(3, seed=2)
        reaction["players"]["p0"]["hand"] = cards("attack")
        play(reaction, "p0", "attack")
        scenarios.append((reaction, "p1"))

        future = make_state(3, seed=3)
        future["players"]["p0"]["hand"] = cards("see_future")
        future["deck"] = cards("skip", "attack")
        play(future, "p0", "see_future")
        settle(future)
        scenarios.append((future, "p0"))

        defuse = make_state(3, seed=4)
        defuse["players"]["p0"]["hand"] = cards("defuse")
        defuse["deck"] = cards("exploding_kitten", "skip")
        apply(defuse, "p0", "draw")
        scenarios.append((defuse, "p0"))

        reinsert = copy.deepcopy(defuse)
        apply(reinsert, "p0", "defuse")
        scenarios.append((reinsert, "p0"))

        favor = make_state(3, seed=5)
        favor["players"]["p0"]["hand"] = cards("favor")
        favor["players"]["p1"]["hand"] = cards("skip")
        play(favor, "p0", "favor", target_id="p1")
        settle(favor)
        scenarios.append((favor, "p1"))

        review = make_state(3, seed=6)
        review["players"]["p0"]["hand"] = []
        review["deck"] = cards("exploding_kitten", "skip")
        apply(review, "p0", "draw")
        scenarios.append((review, "p0"))

        for state, player_id in scenarios:
            with self.subTest(phase=state["phase"], player=player_id):
                before = copy.deepcopy(state)
                move = Game.bot_move(state, player_id)
                self.assertIsNotNone(move)
                self.assert_valid_bot_action(state, player_id, move)
                # Computing a move must be a pure read of game state.
                self.assertEqual(state, before)

    def test_bot_can_finish_two_to_five_player_games_without_stalling(self):
        """Every supported player count reaches a terminal state with bot play."""
        for player_count in range(2, 6):
            for seed in range(12):
                state = make_state(player_count, seed=seed)
                for step in range(2500):
                    if state["game_over"]:
                        break
                    move = None
                    actor = None
                    # Reactions and elimination reviews may allow more than one
                    # player to answer; choosing in seat order mirrors the server.
                    for pid in state["turn_order"]:
                        candidate = Game.bot_move(state, pid)
                        if candidate is not None:
                            move, actor = candidate, pid
                            break
                    self.assertIsNotNone(move, (player_count, seed, step, state["phase"]))
                    self.assert_valid_bot_action(state, actor, move)
                    events, error = Game.apply_action(state, actor, move)
                    self.assertIsNone(error, (player_count, seed, step, actor, move, error))
                    self.assertIsInstance(events, list)
                self.assertTrue(state["game_over"], (player_count, seed, state["phase"]))
                # A completed game has exactly one winner and no active pending
                # interaction. This catches stale phase/turn state pollution.
                self.assertEqual(len(state["winner_ids"]), 1)
                self.assertIsNone(state["current_turn"])
                self.assertIsNone(state["pending"])
                self.assertIsNone(state["favor"])

    def test_bot_move_does_not_depend_on_hidden_deck_order_or_opponent_cards(self):
        """Equivalent public views produce the same decision despite hidden data."""
        state = make_state(3, seed=77)
        state["players"]["p0"]["hand"] = cards("skip", "attack", "see_future")
        state["deck"] = cards("exploding_kitten", "skip", "attack", "favor")
        state["current_turn"] = "p0"
        altered = copy.deepcopy(state)
        # Preserve card IDs and counts while changing only information p0 cannot
        # see: deck order and the kinds in other players' private hands.
        altered["deck"] = list(reversed(altered["deck"]))
        for pid in altered["turn_order"]:
            if pid == "p0":
                continue
            for card in altered["players"][pid]["hand"]:
                card["kind"] = "nope"
        self.assertEqual(
            Game.get_public_view(state, "p0"), Game.get_public_view(altered, "p0")
        )
        self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(altered, "p0"))

    def test_bot_outputs_are_json_serializable_and_never_leak_private_cards(self):
        state = make_state(3, seed=99)
        for pid in state["turn_order"]:
            move = Game.bot_move(state, pid)
            if move is None:
                continue
            encoded = json.dumps(move)
            self.assertNotIn("deck", encoded)
            self.assertNotIn("seed", encoded)
            # A player action may include only that player's own card ID.
            own_ids = {card["id"] for card in state["players"][pid]["hand"]}
            for other in state["turn_order"]:
                if other == pid:
                    continue
                for card in state["players"][other]["hand"]:
                    self.assertNotIn(card["id"], encoded)
            if "card_ids" in move:
                self.assertTrue(set(move["card_ids"]) <= own_ids)
            if "card_id" in move:
                self.assertIn(move["card_id"], own_ids)

    def test_bot_draws_known_safe_card_without_spending_defense(self):
        state = make_state()
        state["players"]["p0"]["hand"] = cards("defuse", "skip", "attack", "tacocat", "tacocat")
        state["deck"] = cards("favor", "exploding_kitten", "exploding_kitten")
        state["future"]["p0"] = copy.deepcopy(state["deck"])
        state["under_attack"], state["turns_left"] = True, 2
        move = Game.bot_move(state, "p0")
        self.assertEqual(move["type"], "draw")
        self.assert_valid_bot_action(state, "p0", move)

    def test_bot_escapes_known_kitten_before_spending_cards_on_combos(self):
        cases = [
            (("skip", "attack", "tacocat", "tacocat"), 1, "skip"),
            (("skip", "attack"), 3, "attack"),
            (("shuffle",), 1, "shuffle"),
        ]
        for hand_kinds, debt, expected in cases:
            with self.subTest(debt=debt, expected=expected):
                state = make_state()
                state["players"]["p0"]["hand"] = cards(*hand_kinds)
                state["deck"] = cards("exploding_kitten", "skip", "attack", "favor")
                state["future"]["p0"] = copy.deepcopy(state["deck"][:3])
                state["turns_left"], state["under_attack"] = debt, debt > 1
                move = Game.bot_move(state, "p0")
                chosen = next(c for c in state["players"]["p0"]["hand"] if c["id"] == move["card_ids"][0])
                self.assertEqual(chosen["kind"], expected)
                self.assert_valid_bot_action(state, "p0", move)

    def test_bot_scouts_unknown_risk_and_passes_on_attack_debt(self):
        state = make_state()
        state["players"]["p0"]["hand"] = cards("see_future", "skip", "attack")
        state["deck"] = cards("exploding_kitten", "skip", "attack", "favor", "defuse")
        move = Game.bot_move(state, "p0")
        chosen = next(c for c in state["players"]["p0"]["hand"] if c["id"] == move["card_ids"][0])
        self.assertEqual(chosen["kind"], "see_future")
        state["under_attack"], state["turns_left"] = True, 4
        move = Game.bot_move(state, "p0")
        chosen = next(c for c in state["players"]["p0"]["hand"] if c["id"] == move["card_ids"][0])
        self.assertEqual(chosen["kind"], "attack")
        self.assert_valid_bot_action(state, "p0", move)

    def test_bot_reserves_nope_for_attacks_and_valuable_targeted_cards(self):
        state = make_state()
        state["players"]["p0"]["hand"] = cards("favor")
        state["players"]["p1"]["hand"] = cards("nope", "defuse", "tacocat")
        play(state, "p0", "favor", target_id="p1")
        self.assertEqual(Game.bot_move(state, "p1")["type"], "pass")

        state = make_state()
        state["players"]["p0"]["hand"] = cards("tacocat", "tacocat", "tacocat")
        state["players"]["p1"]["hand"] = cards("nope", "defuse", "tacocat")
        play(state, "p0", "tacocat", 3, target_id="p1", requested_kind="defuse")
        self.assertEqual(Game.bot_move(state, "p1")["type"], "nope")

        state = make_state()
        state["players"]["p0"]["hand"] = cards("attack", "nope")
        state["players"]["p1"]["hand"] = cards("nope")
        play(state, "p0", "attack")
        self.assertEqual(Game.bot_move(state, "p1")["type"], "nope")
        apply(state, "p1", "nope")
        self.assertEqual(Game.bot_move(state, "p0")["type"], "nope")
        apply(state, "p2", "pass")
        self.assertIsNone(Game.bot_move(state, "p2"))

    def test_bot_gives_lone_cat_and_keeps_matching_set_and_defenses(self):
        state = make_state()
        state["players"]["p0"]["hand"] = cards("favor")
        state["players"]["p1"]["hand"] = cards("defuse", "nope", "tacocat", "tacocat", "beard_cat")
        expected = state["players"]["p1"]["hand"][-1]
        play(state, "p0", "favor", target_id="p1")
        settle(state)
        move = Game.bot_move(state, "p1")
        self.assertEqual(move["card_id"], expected["id"])
        self.assert_valid_bot_action(state, "p1", move)

    def test_bot_reinsert_protects_remaining_attack_turns(self):
        for debt, expected in ((1, 0), (3, 3)):
            with self.subTest(debt=debt):
                state = make_state()
                state["players"]["p0"]["hand"] = cards("defuse")
                state["deck"] = cards("exploding_kitten", "skip", "attack", "favor")
                state["turns_left"], state["under_attack"] = debt, debt > 1
                apply(state, "p0", "draw")
                apply(state, "p0", "defuse")
                move = Game.bot_move(state, "p0")
                self.assertEqual(move["position"], expected)
                self.assert_valid_bot_action(state, "p0", move)

    def test_bot_preserves_core_defenses_and_nonredundant_function_cards(self):
        state = make_state()
        state["players"]["p0"]["hand"] = cards(
            "defuse", "defuse", "nope", "nope", "skip", "skip", "attack", "attack", "shuffle", "shuffle",
        )
        state["deck"] = cards(*(["tacocat"] * 20))
        self.assertEqual(Game.bot_move(state, "p0")["type"], "draw")

    def test_bot_uses_public_failed_request_evidence_for_combo_target(self):
        state = make_state()
        state["players"]["p0"]["hand"] = cards("tacocat", "tacocat", "tacocat")
        state["deck"] = cards(*(["skip"] * 20))
        state["history"] = [{"number": 1, "type": "missed", "player_id": "p0", "target_id": "p1", "requested_kind": "defuse"}]
        move = Game.bot_move(state, "p0")
        self.assertEqual((len(move["card_ids"]), move["target_id"], move["requested_kind"]), (3, "p2", "defuse"))
        self.assert_valid_bot_action(state, "p0", move)
        state["history"].append({"number": 2, "type": "draw", "player_id": "p1"})
        self.assertEqual(Game.bot_move(state, "p0")["target_id"], "p1")


if __name__ == "__main__":
    unittest.main()
