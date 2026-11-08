import random
import unittest

from jsonschema import Draft7Validator

import game.definitions  # noqa: F401  (registers every game)
from game.registry import get_game
from game.witch_cauldron import (
    ACTION_SCHEMA,
    CATALOG,
    INGREDIENT_COUNTS,
    SAFE_DIFF,
    SPECIAL_COUNTS,
    WitchCauldronGame,
    build_deck,
    evaluate_cauldron,
)


def players(count):
    return [{"player_id": f"p{index}", "name": f"P{index}", "seat": index} for index in range(count)]


def new_game(count, seed=7):
    return WitchCauldronGame.init_game({"seed": seed}, players(count))


def pot(*cards):
    return [{"card": card, "face_up": True, "by": "p0", "seq": index} for index, card in enumerate(cards)]


def setup(state):
    """Everyone keeps the first hand card as the soup base."""
    for pid in list(state["turn_order"]):
        if "setup_pick" in WitchCauldronGame.get_legal_actions(state, pid):
            card = state["players"][pid]["hand"][0]
            WitchCauldronGame.apply_action(state, pid, {"type": "setup_pick", "round": state["round"], "card_id": card})


def play_random(state, rng):
    for _ in range(4000):
        if state["game_over"]:
            return
        movers = [pid for pid in state["turn_order"] if WitchCauldronGame.get_legal_actions(state, pid)]
        if not movers:
            raise AssertionError(f"deadlock at {state['stage']}")
        pid = rng.choice(movers)
        legal = WitchCauldronGame.get_legal_actions(state, pid)
        view = WitchCauldronGame.get_public_view(state, pid)
        kind = legal[0]
        if kind == "draft_pick":
            action = {"type": kind, "round": state["round"], "card_id": rng.choice(view["display"])["instance"]}
        elif kind == "play_card":
            targets = [p["player_id"] for p in view["players"] if p["alive"] and not p["sealed"]]
            card = rng.choice(view["hand"])
            target = rng.choice(targets) if targets else None
            face_up = bool(card.get("must_reveal") or (card.get("reveal_to_others") and target != pid)) or rng.random() < 0.5
            action = {"type": kind, "round": state["round"], "card_id": card["instance"],
                      "target": target, "face_up": face_up, "peek": None}
        elif kind == "add_card":
            me = next(p for p in view["players"] if p["player_id"] == pid)
            card = None if me["sealed"] or rng.random() < 0.4 else rng.choice(view["hand"])["instance"]
            action = {"type": kind, "round": state["round"], "card_id": card}
        elif kind == "swap":
            others = [p["player_id"] for p in view["players"] if p["alive"] and p["player_id"] != pid]
            action = {"type": kind, "round": state["round"],
                      "partner": rng.choice(others) if others and rng.random() < 0.3 else None}
        elif kind == "drink":
            me = next(p for p in view["players"] if p["player_id"] == pid)
            forced = any(entry["card"] and entry["card"]["id"] == "oath" for entry in me["cauldron"])
            action = {"type": kind, "round": state["round"],
                      "drink": True if forced or me["refused"] else rng.random() < 0.75}
        elif kind == "chameleon":
            action = {"type": kind, "round": state["round"], "color": rng.choice(["red", "blue"])}
        elif kind == "setup_pick":
            action = {"type": kind, "round": state["round"], "card_id": rng.choice(view["hand"])["instance"]}
        else:
            action = {"type": "next_round", "round": state["round"]}
        _, error = WitchCauldronGame.apply_action(state, pid, action)
        if error:
            raise AssertionError(f"rejected {action}: {error}")
    raise AssertionError("game did not terminate")


class WitchCauldronRulesTests(unittest.TestCase):
    def test_definition_is_registered(self):
        definition = get_game("witch_cauldron")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.name, "Witch's Cauldron")
        self.assertEqual(definition.name_zh, "女巫坩埚")
        self.assertEqual((definition.min_players, definition.max_players), (2, 7))
        self.assertTrue(Draft7Validator(definition.action_schema).is_valid(
            {"type": "draft_pick", "round": 1, "card_id": "r1.0"}))

    def test_deck_matches_published_totals(self):
        deck = build_deck()
        self.assertEqual(len(deck), 72)
        self.assertEqual(len(set(deck)), 72)
        self.assertEqual(sum(INGREDIENT_COUNTS.values()), 56)
        self.assertEqual(sum(SPECIAL_COUNTS.values()), 16)

    def test_setup_keeps_one_card_and_opens_a_soup_base(self):
        state = new_game(4)
        self.assertEqual(state["stage"], "setup")
        for pid in state["turn_order"]:
            self.assertEqual(len(state["players"][pid]["hand"]), 2)
        setup(state)
        self.assertEqual(state["stage"], "draft")
        for pid in state["turn_order"]:
            self.assertEqual(len(state["players"][pid]["hand"]), 1)
            self.assertEqual(len(state["players"][pid]["cauldron"]), 1)
            self.assertTrue(state["players"][pid]["cauldron"][0]["face_up"])

    def test_circles_and_target_depend_on_player_count(self):
        for count in (2, 3, 4, 5):
            state = new_game(count)
            self.assertEqual(state["circles"], 4)
            view = WitchCauldronGame.get_public_view(state, "p0")
            self.assertEqual(view["target"], 7)
        for count in (6, 7):
            state = new_game(count)
            self.assertEqual(state["circles"], 3)
            self.assertEqual(WitchCauldronGame.get_public_view(state, "p0")["target"], 5)

    def test_draft_reveals_players_plus_one_and_discards_the_leftover(self):
        state = new_game(4)
        setup(state)
        self.assertEqual(len(state["display"]), 5)
        for _ in range(4):
            pid = state["circle_order"][state["turn_index"]]
            card = state["display"][0]
            WitchCauldronGame.apply_action(state, pid, {"type": "draft_pick", "round": 1, "card_id": card})
        self.assertEqual(state["stage"], "play")
        self.assertEqual(state["display"], [])
        self.assertEqual(state["discard"][-1], card if False else state["discard"][-1])
        self.assertEqual(len(state["discard"]), 1)

    def test_four_and_five_must_be_face_up_in_a_rival_cauldron(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["hand"] = ["r4.0"]
        state["players"]["p0"]["cauldron"] = []
        state["stage"] = "play"
        state["circle_order"] = ["p0", "p1", "p2"]
        state["turn_index"] = 0
        _, error = WitchCauldronGame.apply_action(
            state, "p0", {"type": "play_card", "round": 1, "card_id": "r4.0", "target": "p1", "face_up": False, "peek": None})
        self.assertEqual(error, "this card must be face up in another player's cauldron")
        _, error = WitchCauldronGame.apply_action(
            state, "p0", {"type": "play_card", "round": 1, "card_id": "r4.0", "target": "p0", "face_up": False, "peek": None})
        self.assertIsNone(error)
        self.assertFalse(state["players"]["p0"]["cauldron"][0]["face_up"])

    def test_special_cards_must_always_be_face_up(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["hand"] = ["lid.0"]
        state["stage"] = "play"
        state["circle_order"] = ["p0", "p1", "p2"]
        state["turn_index"] = 0
        _, error = WitchCauldronGame.apply_action(
            state, "p0", {"type": "play_card", "round": 1, "card_id": "lid.0", "target": "p0", "face_up": False, "peek": None})
        self.assertEqual(error, "this card must be played face up")

    def test_lid_seals_a_cauldron(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["hand"] = ["lid.0"]
        state["stage"] = "play"
        state["circle_order"] = ["p0", "p1", "p2"]
        state["turn_index"] = 0
        WitchCauldronGame.apply_action(
            state, "p0", {"type": "play_card", "round": 1, "card_id": "lid.0", "target": "p1", "face_up": True, "peek": None})
        state["players"]["p1"]["hand"] = ["r1.0"]
        _, error = WitchCauldronGame.apply_action(
            state, "p1", {"type": "play_card", "round": 1, "card_id": "r1.0", "target": "p1", "face_up": True, "peek": None})
        self.assertEqual(error, "that cauldron is sealed by the lid")
        self.assertTrue(WitchCauldronGame.get_public_view(state, "p0")["players"][1]["sealed"])

    def test_refusal_is_once_per_game(self):
        state = new_game(3)
        setup(state)
        for pid in state["turn_order"]:
            state["players"][pid]["cauldron"] = pot("r1.0")
        state["stage"] = "drink"
        state["pending_drink"] = {}
        WitchCauldronGame.apply_action(state, "p0", {"type": "drink", "round": 1, "drink": False})
        self.assertTrue(state["players"]["p0"]["refused"])
        WitchCauldronGame.apply_action(state, "p1", {"type": "drink", "round": 1, "drink": True})
        WitchCauldronGame.apply_action(state, "p2", {"type": "drink", "round": 1, "drink": True})
        self.assertEqual(state["stage"], "scoring")
        self.assertEqual(state["players"]["p0"]["cauldron"], [])
        self.assertEqual(state["players"]["p0"]["total"], 0)
        self.assertEqual(state["players"]["p1"]["total"], 1)

        again = new_game(3)
        setup(again)
        again["players"]["p0"]["refused"] = True
        again["stage"] = "drink"
        again["pending_drink"] = {}
        _, error = WitchCauldronGame.apply_action(again, "p0", {"type": "drink", "round": 1, "drink": False})
        self.assertEqual(error, "you already used your refusal")

    def test_blood_oath_forbids_refusing(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["cauldron"] = pot("r1.0", "oath.0")
        state["stage"] = "drink"
        state["pending_drink"] = {}
        _, error = WitchCauldronGame.apply_action(state, "p0", {"type": "drink", "round": 1, "drink": False})
        self.assertEqual(error, "the Blood Oath forces you to drink")

    def test_tendril_peek_is_private(self):
        state = new_game(3)
        setup(state)
        state["players"]["p1"]["cauldron"] = [{"card": "r5.0", "face_up": False, "by": "p1", "seq": 0}]
        state["players"]["p0"]["hand"] = ["tendril.0"]
        state["stage"] = "play"
        state["circle_order"] = ["p0", "p1", "p2"]
        state["turn_index"] = 0
        WitchCauldronGame.apply_action(
            state, "p0", {"type": "play_card", "round": 1, "card_id": "tendril.0", "target": "p1", "face_up": True, "peek": 0})
        owner_view = WitchCauldronGame.get_public_view(state, "p0")
        rival_view = WitchCauldronGame.get_public_view(state, "p1")
        target = next(p for p in owner_view["players"] if p["player_id"] == "p1")
        self.assertEqual(target["cauldron"][0]["card"]["id"], "r5")
        hidden = next(p for p in rival_view["players"] if p["player_id"] == "p1")
        self.assertIsNone(hidden["cauldron"][0]["card"])

    def test_swap_needs_both_sides_to_agree(self):
        state = new_game(3)
        setup(state)
        for pid in state["turn_order"]:
            state["players"][pid]["cauldron"] = pot("r1.0" if pid == "p0" else "b1.0")
        state["stage"] = "swap"
        state["pending_swap"] = {}
        WitchCauldronGame.apply_action(state, "p0", {"type": "swap", "round": 1, "partner": "p1"})
        WitchCauldronGame.apply_action(state, "p1", {"type": "swap", "round": 1, "partner": "p2"})
        self.assertEqual(state["stage"], "swap")
        WitchCauldronGame.apply_action(state, "p2", {"type": "swap", "round": 1, "partner": None})
        self.assertEqual(state["stage"], "drink")
        self.assertEqual(state["players"]["p0"]["cauldron"][0]["card"], "r1.0")

        state = new_game(3)
        setup(state)
        for pid in state["turn_order"]:
            state["players"][pid]["cauldron"] = pot("r1.0" if pid == "p0" else "b1.0")
        state["stage"] = "swap"
        state["pending_swap"] = {}
        WitchCauldronGame.apply_action(state, "p0", {"type": "swap", "round": 1, "partner": "p1"})
        WitchCauldronGame.apply_action(state, "p1", {"type": "swap", "round": 1, "partner": "p0"})
        WitchCauldronGame.apply_action(state, "p2", {"type": "swap", "round": 1, "partner": None})
        self.assertEqual(state["players"]["p0"]["cauldron"][0]["card"], "b1.0")
        self.assertEqual(state["players"]["p1"]["cauldron"][0]["card"], "r1.0")

    def test_ouroboros_passes_cauldrons_clockwise_before_drinking(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["cauldron"] = pot("r1.0", "ouroboros.0")
        state["players"]["p1"]["cauldron"] = pot("b1.0")
        state["players"]["p2"]["cauldron"] = pot("r2.0", "ouroboros.1")
        state["stage"] = "swap"
        state["pending_swap"] = {}
        for pid in state["turn_order"]:
            WitchCauldronGame.apply_action(state, pid, {"type": "swap", "round": 1, "partner": None})
        self.assertEqual(state["stage"], "drink")
        self.assertEqual(state["players"]["p0"]["cauldron"][0]["card"], "r2.0")
        self.assertEqual(state["players"]["p2"]["cauldron"][0]["card"], "r1.0")
        self.assertEqual(state["players"]["p1"]["cauldron"][0]["card"], "b1.0")

    def test_one_marker_each_keeps_a_witch_alive(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["cauldron"] = pot("r5.0", "r5.1", "b1.0")
        state["players"]["p1"]["cauldron"] = pot("b5.0", "b5.1", "r1.0")
        state["players"]["p2"]["cauldron"] = pot("r1.1", "b1.1")
        state["stage"] = "drink"
        state["pending_drink"] = {}
        for pid in state["turn_order"]:
            WitchCauldronGame.apply_action(state, pid, {"type": "drink", "round": 1, "drink": True})
        self.assertEqual(state["stage"], "scoring")
        self.assertEqual(state["players"]["p0"]["explosions"], 1)
        self.assertEqual(state["players"]["p1"]["poisons"], 1)
        self.assertTrue(all(state["players"][pid]["alive"] for pid in state["turn_order"]))

    def test_two_markers_of_one_kind_eliminate(self):
        state = new_game(3)
        setup(state)
        state["players"]["p0"]["explosions"] = 1
        state["players"]["p0"]["cauldron"] = pot("r5.0", "r5.1", "b1.0")
        state["players"]["p1"]["cauldron"] = pot("r1.1", "b1.1")
        state["players"]["p2"]["cauldron"] = pot("r1.2", "b1.2")
        state["stage"] = "drink"
        state["pending_drink"] = {}
        for pid in state["turn_order"]:
            WitchCauldronGame.apply_action(state, pid, {"type": "drink", "round": 1, "drink": True})
        self.assertEqual(state["players"]["p0"]["explosions"], 2)
        self.assertFalse(state["players"]["p0"]["alive"])
        self.assertTrue(state["players"]["p1"]["alive"])

    def test_survivor_wins_when_everyone_else_is_out(self):
        state = new_game(2)
        setup(state)
        state["players"]["p0"]["explosions"] = 1
        state["players"]["p0"]["cauldron"] = pot("r5.0", "r5.1", "b1.0")
        state["players"]["p1"]["cauldron"] = pot("r1.0", "b1.0")
        state["stage"] = "drink"
        state["pending_drink"] = {}
        for pid in state["turn_order"]:
            WitchCauldronGame.apply_action(state, pid, {"type": "drink", "round": 1, "drink": True})
        self.assertEqual(state["stage"], "scoring")
        for pid in state["turn_order"]:
            WitchCauldronGame.apply_action(state, pid, {"type": "next_round", "round": 1})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p1"])


class WitchCauldronScoringTests(unittest.TestCase):
    def test_perfect_soup_scores_every_ingredient(self):
        result = evaluate_cauldron(pot("r4.0", "n0.0", "b2.0", "b2.1"))
        self.assertEqual((result["red"], result["blue"], result["diff"]), (4, 4, 0))
        self.assertEqual(result["outcome"], "perfect")
        self.assertEqual(result["points"], 4)

    def test_safe_soups_score_their_own_colour_plus_neutral(self):
        red = evaluate_cauldron(pot("r3.0", "r4.0", "n0.0", "b2.0", "b2.1"))
        self.assertEqual(red["outcome"], "safe_red")
        self.assertEqual(red["diff"], SAFE_DIFF)
        self.assertEqual(red["points"], 3)
        blue = evaluate_cauldron(pot("b3.0", "b4.0", "n0.0", "r2.0", "r2.1"))
        self.assertEqual(blue["outcome"], "safe_blue")
        self.assertEqual(blue["points"], 3)

    def test_difference_of_four_explodes_or_poisons(self):
        self.assertEqual(evaluate_cauldron(pot("r5.0", "r4.0", "n0.0", "b2.0", "b2.1"))["outcome"], "explode")
        self.assertEqual(evaluate_cauldron(pot("b5.0", "b4.0", "n0.0", "r2.0", "r2.1"))["outcome"], "poison")

    def test_dragon_scale_and_leviathan_oil(self):
        saved = evaluate_cauldron(pot("r5.0", "r4.0", "n0.0", "b2.0", "b2.1", "fire_scale.0"))
        self.assertEqual(saved["outcome"], "safe_red")
        lethal = evaluate_cauldron(pot("b2.0", "b2.1", "r1.0", "fire_scale.0"))
        self.assertEqual(lethal["outcome"], "poison")
        rescued = evaluate_cauldron(pot("b5.0", "b4.0", "n0.0", "r2.0", "r2.1", "leviathan_oil.0"))
        self.assertEqual(rescued["outcome"], "safe_blue")
        burst = evaluate_cauldron(pot("r2.0", "r2.1", "b1.0", "leviathan_oil.0"))
        self.assertEqual(burst["outcome"], "explode")

    def test_the_two_scales_cancel_each_other(self):
        result = evaluate_cauldron(pot("b2.0", "b2.1", "r1.0", "fire_scale.0", "leviathan_oil.0"))
        self.assertEqual(result["outcome"], "safe_blue")

    def test_colour_negator_flips_the_soup_but_spares_a_perfect_one(self):
        flipped = evaluate_cauldron(pot("r3.0", "r4.0", "n0.0", "b2.0", "b2.1", "negator.0"))
        self.assertEqual(flipped["soup"], "blue")
        self.assertEqual(flipped["outcome"], "safe_blue")
        self.assertEqual(flipped["points"], 3)
        perfect = evaluate_cauldron(pot("r4.0", "n0.0", "b2.0", "b2.1", "negator.0"))
        self.assertEqual(perfect["outcome"], "perfect")

    def test_chameleon_tail_can_balance_a_soup(self):
        result = evaluate_cauldron(pot("r3.0", "n0.0", "b2.0", "b2.1", "chameleon.0"), "blue")
        self.assertEqual(result["blue"], 3)
        self.assertEqual(result["outcome"], "perfect")

    def test_special_cards_never_score(self):
        result = evaluate_cauldron(pot("r2.0", "r2.1", "b1.0", "lid.0", "oath.0"))
        self.assertEqual(result["points"], 2)


class WitchCauldronFlowTests(unittest.TestCase):
    def test_random_games_finish_for_every_player_count(self):
        for count in range(2, 8):
            for seed in range(6):
                with self.subTest(count=count, seed=seed):
                    state = new_game(count, seed=seed * 31 + count)
                    play_random(state, random.Random(seed))
                    self.assertTrue(state["game_over"])
                    self.assertIn(state["stage"], ("game_over",))

    def test_cards_are_conserved_and_saves_round_trip(self):
        state = new_game(5, seed=99)
        rng = random.Random(4)
        for _ in range(400):
            if state["game_over"]:
                break
            movers = [pid for pid in state["turn_order"] if WitchCauldronGame.get_legal_actions(state, pid)]
            pid = rng.choice(movers)
            legal = WitchCauldronGame.get_legal_actions(state, pid)
            view = WitchCauldronGame.get_public_view(state, pid)
            if legal[0] == "draft_pick":
                action = {"type": "draft_pick", "round": state["round"], "card_id": view["display"][0]["instance"]}
            elif legal[0] == "play_card":
                card = view["hand"][0]
                target = next((p["player_id"] for p in view["players"] if p["alive"] and not p["sealed"]), None)
                action = {"type": "play_card", "round": state["round"], "card_id": card["instance"], "target": target,
                          "face_up": True, "peek": None}
            elif legal[0] == "add_card":
                me = next(p for p in view["players"] if p["player_id"] == pid)
                action = {"type": "add_card", "round": state["round"],
                          "card_id": None if me["sealed"] else (view["hand"][0]["instance"] if view["hand"] else None)}
            elif legal[0] == "swap":
                action = {"type": "swap", "round": state["round"], "partner": None}
            elif legal[0] == "drink":
                action = {"type": "drink", "round": state["round"], "drink": True}
            elif legal[0] == "chameleon":
                action = {"type": "chameleon", "round": state["round"], "color": "red"}
            elif legal[0] == "setup_pick":
                action = {"type": "setup_pick", "round": state["round"], "card_id": view["hand"][0]["instance"]}
            else:
                action = {"type": "next_round", "round": state["round"]}
            WitchCauldronGame.apply_action(state, pid, action)
            WitchCauldronGame.deserialize(WitchCauldronGame.serialize(state))
        seen = list(state["deck"]) + list(state["discard"]) + list(state["display"])
        for pdata in state["players"].values():
            seen += pdata["hand"] + pdata["score_pile"] + [entry["card"] for entry in pdata["cauldron"]]
        self.assertEqual(sorted(seen), sorted(build_deck()))

    def test_view_hides_other_hands_and_face_down_cards(self):
        state = new_game(4)
        view = WitchCauldronGame.get_public_view(state, "p0")
        self.assertEqual(len(view["hand"]), 2)
        other = WitchCauldronGame.get_public_view(state, "p1")
        self.assertEqual(len(other["hand"]), 2)
        self.assertNotIn("deck", view)
        self.assertNotIn("rng_state", view)
        self.assertNotIn("discard", view)
        state["players"]["p1"]["cauldron"] = [{"card": "r5.0", "face_up": False, "by": "p1", "seq": 0}]
        hidden = WitchCauldronGame.get_public_view(state, "p0")
        self.assertIsNone(next(p for p in hidden["players"] if p["player_id"] == "p1")["cauldron"][0]["card"])

    def test_action_schema_rejects_unknown_fields(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        self.assertTrue(validator.is_valid({"type": "next_round", "round": 1}))
        self.assertFalse(validator.is_valid({"type": "next_round", "round": 1, "bogus": 1}))
        self.assertFalse(validator.is_valid({"type": "draft_pick", "round": 1}))

    def test_stale_round_is_rejected(self):
        state = new_game(3)
        _, error = WitchCauldronGame.apply_action(state, "p0", {"type": "setup_pick", "round": 9, "card_id": state["players"]["p0"]["hand"][0]})
        self.assertEqual(error, "stale round")

    def test_catalog_exposes_every_card(self):
        self.assertEqual(len(CATALOG), 20)
        for card in CATALOG.values():
            self.assertIn("name_zh", card)
            self.assertIn("icon", card)


if __name__ == "__main__":
    unittest.main()
