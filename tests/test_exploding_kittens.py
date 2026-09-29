import copy
import json
import unittest
from collections import Counter
from itertools import count

from jsonschema import Draft7Validator
from game.exploding_kittens import ExplodingKittensGame as Game, CARD_TYPES, ACTION_SCHEMA


CARD_SEQUENCE = count()


def cards(*kinds):
    return [{"id": "fixture-{}".format(next(CARD_SEQUENCE)), "kind": kind} for kind in kinds]


def make_state(count=3, seed=145):
    state = Game.init_game({"seed": seed}, [
        {"player_id": "p{}".format(i), "name": "Player {}".format(i), "seat": i}
        for i in range(count)
    ])
    state["current_turn"] = "p0"
    return state


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], **fields}


def apply(state, player, kind, **fields):
    events, error = Game.apply_action(state, player, action(state, kind, **fields))
    if error:
        raise AssertionError((kind, player, error))
    return events


def settle(state):
    while state["phase"] == "reaction":
        player = next(p for p in state["turn_order"] if "pass" in Game.get_legal_actions(state, p))
        apply(state, player, "pass")


def play(state, player, kind, count=1, **fields):
    selected = [c["id"] for c in state["players"][player]["hand"] if c["kind"] == kind][:count]
    if len(selected) != count:
        raise AssertionError("missing test cards")
    return apply(state, player, "play", card_ids=selected, **fields)


class ExplodingKittensTests(unittest.TestCase):
    def test_setup_counts_and_private_openings(self):
        for n in range(2, 6):
            s = make_state(n)
            for player in s["players"].values():
                self.assertEqual(len(player["hand"]), 8)
                self.assertEqual(Counter(c["kind"] for c in player["hand"])["defuse"], 1)
                self.assertNotIn("exploding_kitten", [c["kind"] for c in player["hand"]])
            counts = Counter(c["kind"] for c in s["deck"])
            self.assertEqual(counts["exploding_kitten"], n - 1)
            self.assertEqual(counts["defuse"], 2 if n <= 3 else 6 - n)
            pool = s["deck"] + s["removed"] + [c for p in s["players"].values() for c in p["hand"]]
            self.assertEqual(Counter(c["kind"] for c in pool), Counter({k: v["count"] for k, v in CARD_TYPES.items()}))
            self.assertEqual(len({c["id"] for c in pool}), 56)

    def test_bad_configuration_and_player_counts(self):
        players = [{"player_id": "p{}".format(i)} for i in range(6)]
        for n in (0, 1, 6):
            with self.assertRaises(ValueError):
                Game.init_game({}, players[:n])
        for config in ({"rounds": 2}, {"seed": True}, {"seed": []}, {"seed": ""}, []):
            with self.assertRaises(ValueError):
                Game.init_game(config, players[:2])
        with self.assertRaises(ValueError):
            Game.init_game({}, [players[0], players[0]])

    def test_draw_is_private_and_ends_only_one_turn(self):
        s = make_state()
        s["deck"] = cards("skip", "attack", "exploding_kitten")
        s["under_attack"], s["turns_left"] = True, 2
        events = apply(s, "p0", "draw")
        self.assertEqual((s["current_turn"], s["turns_left"]), ("p0", 1))
        self.assertNotIn("skip", json.dumps(events))
        apply(s, "p0", "draw")
        self.assertEqual((s["current_turn"], s["turns_left"], s["under_attack"]), ("p1", 1, False))

    def test_attack_stacks_and_keeps_debt_flag_on_last_turn(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("attack")
        s["players"]["p1"]["hand"] = cards("skip", "attack")
        s["players"]["p2"]["hand"] = cards("attack")
        play(s, "p0", "attack"); settle(s)
        self.assertEqual((s["current_turn"], s["turns_left"]), ("p1", 2))
        play(s, "p1", "skip"); settle(s)
        self.assertEqual((s["current_turn"], s["turns_left"], s["under_attack"]), ("p1", 1, True))
        play(s, "p1", "attack"); settle(s)
        self.assertEqual((s["current_turn"], s["turns_left"]), ("p2", 3))
        play(s, "p2", "attack"); settle(s)
        self.assertEqual((s["current_turn"], s["turns_left"]), ("p0", 5))

    def test_nope_chain_resets_confirmations_and_preserves_discard(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("attack", "nope")
        s["players"]["p1"]["hand"] = cards("nope")
        play(s, "p0", "attack")
        apply(s, "p2", "pass")
        stale = action(s, "pass")
        apply(s, "p1", "nope")
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, "p2", stale)[1])
        self.assertEqual(s, before)
        self.assertEqual(s["pending"]["passed"], ["p1"])
        apply(s, "p0", "nope")
        settle(s)
        self.assertEqual((s["current_turn"], s["turns_left"]), ("p1", 2))
        self.assertEqual([c["kind"] for c in s["discard"]], ["attack", "nope", "nope"])

    def test_odd_nope_cancels_without_refund(self):
        s = make_state(2)
        s["players"]["p0"]["hand"] = cards("skip")
        s["players"]["p1"]["hand"] = cards("nope")
        play(s, "p0", "skip"); apply(s, "p1", "nope"); settle(s)
        self.assertEqual(s["current_turn"], "p0")
        self.assertEqual(s["phase"], "playing")
        self.assertEqual(s["players"]["p0"]["hand"], [])

    def test_same_window_concurrent_passes_and_duplicate_rejection(self):
        s = make_state(4)
        s["players"]["p0"]["hand"] = cards("skip")
        play(s, "p0", "skip")
        request = action(s, "pass")
        for pid in ("p1", "p2"):
            self.assertIsNone(Game.apply_action(s, pid, request)[1])
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, "p1", request)[1])
        self.assertEqual(s, before)
        self.assertIsNone(Game.apply_action(s, "p3", request)[1])
        self.assertEqual(s["current_turn"], "p1")

    def test_self_nope_and_already_passed_player_can_react(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("skip", "nope")
        s["players"]["p1"]["hand"] = cards("nope")
        play(s, "p0", "skip")
        apply(s, "p1", "pass"); apply(s, "p1", "nope")
        apply(s, "p0", "nope"); settle(s)
        self.assertEqual(s["current_turn"], "p1")

    def test_future_is_private_paused_and_invalidated_on_deck_change(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("see_future", "shuffle")
        s["deck"] = cards("exploding_kitten", "attack")
        play(s, "p0", "see_future"); settle(s)
        self.assertEqual(s["phase"], "future")
        self.assertEqual(len(Game.get_public_view(s, "p0")["future"]), 2)
        for who in ("p1", "spectator"):
            self.assertEqual(Game.get_public_view(s, who)["future"], [])
            self.assertEqual(Game.get_legal_actions(s, who), [])
        apply(s, "p0", "continue")
        self.assertEqual(len(Game.get_public_view(s, "p0")["future"]), 2)
        play(s, "p0", "shuffle"); settle(s)
        self.assertEqual(s["future"], {})

    def test_noped_future_never_reveals_cards(self):
        s = make_state(2)
        s["players"]["p0"]["hand"] = cards("see_future")
        s["players"]["p1"]["hand"] = cards("nope")
        play(s, "p0", "see_future"); apply(s, "p1", "nope"); settle(s)
        self.assertEqual(s["future"], {})
        self.assertEqual(s["phase"], "playing")

    def test_favor_target_chooses_and_transfer_stays_private(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("favor")
        s["players"]["p1"]["hand"] = cards("defuse", "tacocat")
        selected = s["players"]["p1"]["hand"][0]
        play(s, "p0", "favor", target_id="p1"); settle(s)
        self.assertEqual(Game.get_legal_actions(s, "p0"), [])
        self.assertEqual(Game.get_legal_actions(s, "p1"), ["give"])
        events = apply(s, "p1", "give", card_id=selected["id"])
        self.assertEqual(s["players"]["p0"]["hand"], [selected])
        self.assertNotIn(selected["id"], json.dumps(events))
        self.assertNotIn("defuse", json.dumps(events))
        self.assertEqual(s["current_turn"], "p0")

    def test_pairs_support_function_cards_and_triple_hit_or_miss(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("skip", "skip", "tacocat", "tacocat", "tacocat", "nope", "nope", "nope")
        s["players"]["p1"]["hand"] = cards("beard_cat")
        s["players"]["p2"]["hand"] = cards("defuse", "attack")
        play(s, "p0", "skip", 2, target_id="p1"); settle(s)
        self.assertEqual(s["players"]["p1"]["hand"], [])
        self.assertEqual(s["current_turn"], "p0")
        play(s, "p0", "tacocat", 3, target_id="p2", requested_kind="defuse"); settle(s)
        self.assertIn("defuse", [c["kind"] for c in s["players"]["p0"]["hand"]])
        play(s, "p0", "nope", 3, target_id="p2", requested_kind="defuse"); settle(s)
        self.assertEqual(s["history"][-1]["type"], "missed")

    def test_nope_cancels_entire_combo(self):
        s = make_state(2)
        s["players"]["p0"]["hand"] = cards("defuse", "defuse")
        s["players"]["p1"]["hand"] = cards("nope", "attack")
        play(s, "p0", "defuse", 2, target_id="p1")
        apply(s, "p1", "nope"); settle(s)
        self.assertEqual(s["players"]["p0"]["hand"], [])
        self.assertEqual(len(s["players"]["p1"]["hand"]), 1)

    def test_defuse_secret_insertion_preserves_order_and_attack_debt(self):
        for position in range(4):
            s = make_state()
            s["players"]["p0"]["hand"] = cards("defuse")
            s["deck"] = cards("exploding_kitten", "skip", "attack", "favor")
            s["turns_left"], s["under_attack"] = 2, True
            bomb, rest = s["deck"][0], s["deck"][1:]
            apply(s, "p0", "draw")
            self.assertEqual(s["phase"], "defuse")
            self.assertNotIn("nope", Game.get_legal_actions(s, "p1"))
            apply(s, "p0", "defuse")
            self.assertEqual(s["phase"], "reinsert")
            events = apply(s, "p0", "reinsert", position=position)
            expected = list(rest); expected.insert(position, bomb)
            self.assertEqual(s["deck"], expected)
            self.assertEqual((s["current_turn"], s["turns_left"]), ("p0", 1))
            self.assertNotIn("position", json.dumps(events))
            self.assertNotIn("position", json.dumps(Game.get_public_view(s, "p1")))

    def test_defuse_into_empty_deck(self):
        s = make_state(2)
        s["players"]["p0"]["hand"] = cards("defuse")
        s["deck"] = cards("exploding_kitten")
        apply(s, "p0", "draw"); apply(s, "p0", "defuse"); apply(s, "p0", "reinsert", position=0)
        self.assertEqual(s["deck"][0]["kind"], "exploding_kitten")
        self.assertEqual(s["current_turn"], "p1")

    def test_elimination_waits_for_all_including_eliminated_and_then_skips_dead(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("nope", "attack")
        s["deck"] = cards("exploding_kitten", "tacocat", "exploding_kitten")
        s["under_attack"], s["turns_left"] = True, 4
        apply(s, "p0", "draw")
        self.assertEqual((s["phase"], s["current_turn"], s["turns_left"]), ("elimination_review", "p1", 1))
        apply(s, "p1", "next_round"); apply(s, "p2", "next_round")
        self.assertEqual(s["phase"], "elimination_review")
        apply(s, "p0", "next_round")
        self.assertEqual(Game.get_legal_actions(s, "p0"), [])
        apply(s, "p1", "draw")
        s["players"]["p2"]["hand"] = []
        apply(s, "p2", "draw")
        self.assertTrue(s["game_over"])
        self.assertEqual(s["winner_ids"], ["p1"])
        self.assertIsNone(s["current_turn"])
        for pid in s["turn_order"]:
            self.assertEqual(Game.get_legal_actions(s, pid), [])

    def test_bad_actions_never_mutate_even_without_schema(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("skip", "attack", "tacocat")
        ids = [c["id"] for c in s["players"]["p0"]["hand"]]
        bad = [None, {}, action(s, "draw", position=1), action(s, "play", card_ids=[]),
               action(s, "play", card_ids=[ids[0], ids[0]]), action(s, "play", card_ids=ids[:2], target_id="p1"),
               action(s, "play", card_ids=[ids[2]]), action(s, "play", card_ids=["missing"]),
               action(s, "play", card_ids=[[]]), action(s, "draw", game_token="old"),
               action(s, "draw", window_id=True)]
        for request in bad:
            before = copy.deepcopy(s)
            self.assertIsNotNone(Game.apply_action(s, "p0", request)[1])
            self.assertEqual(s, before)
        for who in ("p1", "visitor"):
            before = copy.deepcopy(s)
            self.assertIsNotNone(Game.apply_action(s, who, action(s, "draw"))[1])
            self.assertEqual(s, before)

    def test_invalid_targets_requests_and_reinsert_positions(self):
        s = make_state()
        s["players"]["p0"]["hand"] = cards("tacocat", "tacocat", "tacocat")
        s["players"]["p1"]["alive"] = False
        s["players"]["p2"]["hand"] = []
        for target in ("p0", "p1", "p2", "visitor", [], None):
            before = copy.deepcopy(s)
            ids = [c["id"] for c in s["players"]["p0"]["hand"]]
            self.assertIsNotNone(Game.apply_action(s, "p0", action(s, "play", card_ids=ids, target_id=target, requested_kind="defuse"))[1])
            self.assertEqual(s, before)
        s["players"]["p0"]["hand"] = cards("defuse")
        s["deck"] = cards("exploding_kitten", "skip")
        apply(s, "p0", "draw"); apply(s, "p0", "defuse")
        for position in (-1, 2, True, "0", None):
            before = copy.deepcopy(s)
            self.assertIsNotNone(Game.apply_action(s, "p0", action(s, "reinsert", position=position))[1])
            self.assertEqual(s, before)

    def test_public_views_are_detached_and_do_not_leak_secrets(self):
        s = make_state()
        for pid in ("p0", "p1", "visitor"):
            view = Game.get_public_view(s, pid)
            for field in ("deck", "seed", "rng_counter", "removed", "player_meta"):
                self.assertNotIn(field, view)
            for other in s["turn_order"]:
                if other != pid:
                    for card in s["players"][other]["hand"]:
                        self.assertNotIn(card["id"], json.dumps(view))
            if pid == "visitor":
                self.assertEqual(view["hand"], [])
            view["players"][0]["alive"] = False
            self.assertTrue(s["players"]["p0"]["alive"])

    def test_roundtrip_every_real_phase_schema_and_card_conservation(self):
        phases = set()
        for n in range(2, 6):
            for seed in range(8):
                s = make_state(n, seed)
                for _ in range(1800):
                    phases.add(s["phase"])
                    s = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
                    if s["game_over"]:
                        break
                    for pid in s["turn_order"]:
                        move = Game.bot_move(s, pid)
                        if move:
                            Draft7Validator(ACTION_SCHEMA).validate(move)
                            self.assertIsNone(Game.apply_action(s, pid, move)[1])
                            break
                    else:
                        self.fail("bot stall at " + s["phase"])
                self.assertTrue(s["game_over"], (n, seed))
        self.assertTrue({"playing", "reaction", "future", "favor", "defuse", "reinsert", "elimination_review", "game_over"} <= phases, phases)

    def test_bot_ignores_hidden_deck_and_opponents_hands(self):
        s = make_state()
        before = Game.bot_move(s, "p0")
        s["deck"].reverse(); s["seed"] = "different"
        for pid in ("p1", "p2"):
            for card in s["players"][pid]["hand"]:
                card["kind"] = "nope"
        self.assertEqual(Game.bot_move(s, "p0"), before)

    def test_stale_draw_cannot_run_twice_in_attack(self):
        s = make_state()
        s["deck"] = cards("skip", "attack")
        s["turns_left"], s["under_attack"] = 2, True
        request = action(s, "draw")
        self.assertIsNone(Game.apply_action(s, "p0", request)[1])
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, "p0", request)[1])
        self.assertEqual(s, before)


if __name__ == "__main__":
    unittest.main()
