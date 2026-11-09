import copy
import json
import random
import unittest

from jsonschema import Draft7Validator

from game.not_a_hat import (
    PHASE_GIVING,
    PHASE_MEMORIZE,
    PHASE_RECEIVING,
    PHASE_REVIEW,
    NotAHatGame,
)
from game.not_a_hat_data import ACTION_SCHEMA, CONFIG_SCHEMA, ITEM_BY_KEY, ITEM_KEYS


def make_state(count=4, config=None, bots=True):
    return NotAHatGame.init_game(
        config,
        [
            {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": bots}
            for i in range(count)
        ],
    )


def strip_delay(action):
    return {key: value for key, value in action.items() if key != "delay_ms"}


def play_until(state, phase, limit=400):
    for _ in range(limit):
        if state["phase"] == phase:
            return True
        actor = next(
            (pid for pid in state["turn_order"] if NotAHatGame.get_legal_actions(state, pid)),
            None,
        )
        if actor is None:
            return False
        action = strip_delay(NotAHatGame.bot_move(state, actor))
        _, error = NotAHatGame.apply_action(state, actor, action)
        assert error is None, error
    return False


def play_until_own_gift(state, limit=400):
    """Advance until somebody has to announce their own oldest gift."""
    for _ in range(limit):
        if state["phase"] == PHASE_GIVING and state["pending"] is None:
            return True
        actor = next(
            (pid for pid in state["turn_order"] if NotAHatGame.get_legal_actions(state, pid)),
            None,
        )
        if actor is None:
            return False
        action = strip_delay(NotAHatGame.bot_move(state, actor))
        _, error = NotAHatGame.apply_action(state, actor, action)
        assert error is None, error
    return False


def ready_all(state):
    for pid in state["turn_order"]:
        if "ready" in NotAHatGame.get_legal_actions(state, pid):
            NotAHatGame.apply_action(state, pid, {"type": "ready"})


class NotAHatSetupTests(unittest.TestCase):
    def test_deck_matches_the_physical_game(self):
        random.seed(3)
        state = make_state(3)
        self.assertEqual(len(state["deck"]) + 3, 110)
        self.assertEqual(len(ITEM_KEYS), 55)
        self.assertEqual(len(set(ITEM_KEYS)), 55)

    def test_every_starting_gift_is_public_and_recorded(self):
        random.seed(4)
        state = make_state(5)
        for pid, pdata in state["players"].items():
            self.assertEqual(len(pdata["stack"]), 1)
            card = pdata["stack"][0]
            self.assertTrue(card["face_up"])
            self.assertIn(str(card["id"]), state["reveal_seq"])

    def test_expert_mode_deals_two_gifts(self):
        random.seed(5)
        state = make_state(3, {"starting_gifts": 2})
        for pdata in state["players"].values():
            self.assertEqual(len(pdata["stack"]), 2)

    def test_rejects_too_few_players(self):
        with self.assertRaises(ValueError):
            NotAHatGame.init_game({}, [{"player_id": "a", "name": "A", "seat": 0, "is_bot": False}])


class NotAHatFlowTests(unittest.TestCase):
    def setUp(self):
        random.seed(11)
        self.state = make_state(4)

    def test_memorize_gate_blocks_the_first_pass(self):
        self.assertEqual(self.state["phase"], PHASE_MEMORIZE)
        self.assertEqual(NotAHatGame.get_legal_actions(self.state, "p0"), ["ready"])
        _, error = NotAHatGame.apply_action(self.state, "p0", {"type": "give", "item": "hat"})
        self.assertEqual(error, "invalid action")
        NotAHatGame.apply_action(self.state, "p0", {"type": "ready"})
        self.assertEqual(NotAHatGame.get_legal_actions(self.state, "p0"), [])
        self.assertEqual(self.state["phase"], PHASE_MEMORIZE)

    def test_first_pass_draws_a_public_shop_gift(self):
        ready_all(self.state)
        self.assertEqual(self.state["phase"], PHASE_GIVING)
        self.assertEqual(self.state["giver"], self.state["start_player"])
        pending = self.state["pending"]
        self.assertIsNotNone(pending)
        self.assertTrue(pending["face_up"])
        self.assertEqual(self.state["log"][0]["kind"], "shop")

    def test_give_follows_the_arrow_to_a_neighbour(self):
        ready_all(self.state)
        giver = self.state["giver"]
        card = self.state["pending"]
        order = self.state["turn_order"]
        step = -1 if card["dir"] == "left" else 1
        expected = order[(order.index(giver) + step) % len(order)]
        _, error = NotAHatGame.apply_action(self.state, giver, {"type": "give", "item": "hat"})
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], PHASE_RECEIVING)
        self.assertEqual(self.state["receiver"], expected)
        self.assertEqual(self.state["announced"], "hat")
        self.assertFalse(self.state["in_transit"]["face_up"])

    def test_accept_stacks_the_gift_and_hands_over_the_oldest(self):
        ready_all(self.state)
        giver = self.state["giver"]
        NotAHatGame.apply_action(self.state, giver, {"type": "give", "item": "hat"})
        receiver = self.state["receiver"]
        oldest = self.state["players"][receiver]["stack"][0]
        received = self.state["in_transit"]
        NotAHatGame.apply_action(self.state, receiver, {"type": "accept"})
        stack = self.state["players"][receiver]["stack"]
        self.assertEqual(len(stack), 2)
        self.assertEqual(stack[0]["id"], oldest["id"])
        self.assertEqual(stack[1]["id"], received["id"])
        self.assertEqual(self.state["phase"], PHASE_GIVING)
        self.assertEqual(self.state["giver"], receiver)
        # The oldest gift is turned face down before it can be announced.
        self.assertFalse(stack[0]["face_up"])

    def test_unknown_gift_name_is_rejected(self):
        ready_all(self.state)
        giver = self.state["giver"]
        _, error = NotAHatGame.apply_action(self.state, giver, {"type": "give", "item": "teapot"})
        self.assertEqual(error, "unknown gift")

    def test_honest_giver_punishes_the_doubter(self):
        ready_all(self.state)
        giver = self.state["giver"]
        truth = self.state["pending"]["item"]
        NotAHatGame.apply_action(self.state, giver, {"type": "give", "item": truth})
        receiver = self.state["receiver"]
        NotAHatGame.apply_action(self.state, receiver, {"type": "refuse"})
        refusal = self.state["last_refusal"]
        self.assertTrue(refusal["honest"])
        self.assertEqual(refusal["loser"], receiver)
        self.assertEqual(len(self.state["players"][receiver]["penalties"]), 1)
        self.assertEqual(len(self.state["players"][giver]["penalties"]), 0)
        self.assertEqual(self.state["phase"], PHASE_REVIEW)

    def test_caught_bluffer_punishes_the_giver(self):
        ready_all(self.state)
        giver = self.state["giver"]
        truth = self.state["pending"]["item"]
        lie = next(key for key in ITEM_KEYS if key != truth)
        NotAHatGame.apply_action(self.state, giver, {"type": "give", "item": lie})
        receiver = self.state["receiver"]
        NotAHatGame.apply_action(self.state, receiver, {"type": "refuse"})
        refusal = self.state["last_refusal"]
        self.assertFalse(refusal["honest"])
        self.assertEqual(refusal["loser"], giver)
        self.assertEqual(len(self.state["players"][giver]["penalties"]), 1)

    def test_review_pauses_for_every_player_then_restarts_the_chain(self):
        ready_all(self.state)
        giver = self.state["giver"]
        truth = self.state["pending"]["item"]
        NotAHatGame.apply_action(self.state, giver, {"type": "give", "item": truth})
        receiver = self.state["receiver"]
        NotAHatGame.apply_action(self.state, receiver, {"type": "refuse"})
        self.assertEqual(self.state["phase"], PHASE_REVIEW)
        NotAHatGame.apply_action(self.state, "p0", {"type": "continue"})
        NotAHatGame.apply_action(self.state, "p1", {"type": "continue"})
        NotAHatGame.apply_action(self.state, "p2", {"type": "continue"})
        self.assertEqual(self.state["phase"], PHASE_REVIEW)
        NotAHatGame.apply_action(self.state, "p3", {"type": "continue"})
        self.assertEqual(self.state["phase"], PHASE_GIVING)
        self.assertEqual(self.state["giver"], receiver)
        self.assertIsNotNone(self.state["pending"])

    def test_third_penalty_ends_the_game(self):
        state = make_state(3, {"max_penalties": 3})
        ready_all(state)
        # Three players may each absorb two penalties, so the seventh refusal
        # must end the game by pigeonhole.
        for _ in range(8):
            if state["game_over"]:
                break
            play_until(state, PHASE_RECEIVING)
            NotAHatGame.apply_action(state, state["receiver"], {"type": "refuse"})
            for pid in state["turn_order"]:
                if "continue" in NotAHatGame.get_legal_actions(state, pid):
                    NotAHatGame.apply_action(state, pid, {"type": "continue"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        counts = state["scores"]
        best = min(counts.values())
        self.assertEqual(
            sorted(state["winners"]),
            sorted(pid for pid, value in counts.items() if value == best),
        )
        self.assertEqual(
            counts,
            {pid: len(pdata["penalties"]) for pid, pdata in state["players"].items()},
        )


class NotAHatPrivacyTests(unittest.TestCase):
    def test_face_down_gifts_never_leak_their_object(self):
        random.seed(21)
        state = make_state(5)
        ready_all(state)
        play_until(state, PHASE_RECEIVING)
        for viewer in state["turn_order"]:
            view = NotAHatGame.get_public_view(state, viewer)
            for player in view["players"]:
                for card in player["stack"]:
                    if not card["face_up"]:
                        self.assertNotIn("item", card)
            self.assertNotIn("item", view["in_transit"] or {})
            payload = json.dumps(view)
            hidden = [
                card["item"]
                for pdata in state["players"].values()
                for card in pdata["stack"]
                if not card["face_up"]
            ]
            # The object may legitimately appear elsewhere (duplicates, penalties,
            # the shop), so only assert the per-card projection above is strict.

    def test_owner_cannot_read_their_own_face_down_gift(self):
        random.seed(22)
        state = make_state(4)
        ready_all(state)
        self.assertTrue(play_until_own_gift(state))
        giver = state["giver"]
        card = state["players"][giver]["stack"][0]
        self.assertFalse(card["face_up"])
        view = NotAHatGame.get_public_view(state, giver)
        me = next(p for p in view["players"] if p["player_id"] == giver)
        self.assertNotIn("item", me["stack"][0])

    def test_shop_gift_stays_public_while_it_is_announced(self):
        random.seed(23)
        state = make_state(4)
        ready_all(state)
        giver = state["giver"]
        truth = state["pending"]["item"]
        view = NotAHatGame.get_public_view(state, giver)
        self.assertEqual(view["pending"]["item"], truth)

    def test_penalty_cards_are_public(self):
        random.seed(24)
        state = make_state(4)
        ready_all(state)
        play_until(state, PHASE_RECEIVING)
        receiver = state["receiver"]
        NotAHatGame.apply_action(state, receiver, {"type": "refuse"})
        loser = state["last_refusal"]["loser"]
        view = NotAHatGame.get_public_view(state, "p0")
        entry = next(p for p in view["players"] if p["player_id"] == loser)
        self.assertEqual(entry["penalties"], [state["last_refusal"]["actual"]])


class NotAHatBotTests(unittest.TestCase):
    def test_full_bot_games_finish_for_supported_player_counts(self):
        for count in range(3, 9):
            for seed in range(3):
                with self.subTest(count=count, seed=seed):
                    random.seed(seed)
                    state = make_state(count)
                    for _ in range(4000):
                        if state["game_over"]:
                            break
                        actor = next(
                            (pid for pid in state["turn_order"]
                             if NotAHatGame.get_legal_actions(state, pid)),
                            None,
                        )
                        self.assertIsNotNone(actor, (count, seed, state["phase"]))
                        before = copy.deepcopy(state)
                        action = NotAHatGame.bot_move(state, actor)
                        self.assertEqual(state, before, "bot_move mutated the state")
                        self.assertIsNotNone(action)
                        Draft7Validator(ACTION_SCHEMA).validate(strip_delay(action))
                        _, error = NotAHatGame.apply_action(state, actor, strip_delay(action))
                        self.assertIsNone(error, (count, seed, actor, action, error))
                    self.assertTrue(state["game_over"], (count, seed, state["phase"]))

    def test_bot_announces_a_real_object(self):
        random.seed(31)
        state = make_state(4)
        ready_all(state)
        giver = state["giver"]
        action = NotAHatGame.bot_move(state, giver)
        self.assertEqual(action["type"], "give")
        self.assertIn(action["item"], ITEM_BY_KEY)

    def test_bot_remembers_a_freshly_revealed_gift(self):
        random.seed(32)
        state = make_state(4)
        ready_all(state)
        giver = state["giver"]
        state["bot_skill"][giver] = 0.95
        truth = state["pending"]["item"]
        hits = sum(
            1
            for _ in range(60)
            if (lambda a: a["item"] == truth)(NotAHatGame.bot_move(state, giver))
        )
        self.assertGreater(hits, 45, "a fresh reveal should almost always be recalled")

    def test_bot_memory_decays_for_an_old_gift(self):
        random.seed(33)
        state = make_state(4)
        ready_all(state)
        giver = state["giver"]
        state["bot_skill"][giver] = 0.95
        state["pending"] = None
        card = state["players"][giver]["stack"][0]
        state["reveal_seq"][str(card["id"])] = 0
        state["seq"] = 220
        truth = card["item"]
        hits = sum(
            1
            for _ in range(60)
            if (lambda a: a["item"] == truth)(NotAHatGame.bot_move(state, giver))
        )
        self.assertLess(hits, 20, "a long-forgotten gift should rarely be recalled")


class NotAHatSchemaTests(unittest.TestCase):
    def test_action_schema_accepts_every_action_shape(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        for payload in (
            {"type": "ready"},
            {"type": "give", "item": "hat"},
            {"type": "accept"},
            {"type": "refuse"},
            {"type": "continue"},
        ):
            validator.validate(payload)
        for payload in ({"type": "give"}, {"type": "give", "item": 3}, {"type": "nope"}):
            self.assertTrue(list(validator.iter_errors(payload)), payload)

    def test_config_schema_bounds(self):
        validator = Draft7Validator(CONFIG_SCHEMA)
        validator.validate({"max_penalties": 3, "starting_gifts": 2})
        self.assertTrue(list(validator.iter_errors({"max_penalties": 0})))
        self.assertTrue(list(validator.iter_errors({"starting_gifts": 3})))


class NotAHatSerializationTests(unittest.TestCase):
    def test_state_round_trips_through_json(self):
        random.seed(41)
        state = make_state(4)
        ready_all(state)
        play_until(state, PHASE_RECEIVING)
        restored = NotAHatGame.deserialize(json.loads(json.dumps(NotAHatGame.serialize(state))))
        self.assertEqual(restored, state)

    def test_public_view_is_json_serialisable(self):
        random.seed(42)
        state = make_state(6)
        ready_all(state)
        for viewer in state["turn_order"]:
            json.dumps(NotAHatGame.get_public_view(state, viewer))


if __name__ == "__main__":
    unittest.main()
