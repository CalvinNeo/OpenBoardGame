"""Rules, privacy, persistence and bot tests for 回忆三重奏 (Trio).

Run: python -m unittest tests.test_trio
"""
import unittest

from jsonschema import Draft7Validator

import game.definitions  # noqa: F401  (registers every game)
from game.registry import get_game
from game.trio import (
    ACTION_SCHEMA,
    CONFIG_SCHEMA,
    DECK_SIZE,
    HAND_SIZE,
    MODE_SIMPLE,
    MODE_SPICY,
    STAGE_GAME_OVER,
    STAGE_PLAY,
    STAGE_REVEAL,
    TABLE_SIZE,
    TRIOS_TO_WIN,
    TrioGame,
    build_deck,
    card_number,
    connected,
    connections,
    reveal_points,
)


def players(count):
    return [{"player_id": f"p{index}", "name": f"P{index}", "seat": index} for index in range(count)]


def new_game(count, seed=7, mode=MODE_SIMPLE):
    return TrioGame.init_game({"seed": seed, "mode": mode}, players(count))


def actor(state):
    return state["turn_order"][state["turn_index"]]


def reveal_table(state, pid, index):
    return TrioGame.apply_action(
        state, pid, {"type": "reveal", "turn": state["turn"], "source": "table", "index": index})


def reveal_hand(state, pid, target, end):
    return TrioGame.apply_action(
        state, pid,
        {"type": "reveal", "turn": state["turn"], "source": "hand", "player": target, "end": end})


def press_continue(state, pid):
    return TrioGame.apply_action(state, pid, {"type": "continue", "turn": state["turn"]})


def continue_all(state):
    for pid in state["turn_order"]:
        press_continue(state, pid)


def all_cards(state):
    """Every card still on the board, in no particular order."""
    seen = [card for card in state["table"] if card is not None]
    for pid in state["turn_order"]:
        seen.extend(state["players"][pid]["hand"])
    seen.extend(entry["card"] for entry in state["revealed"])
    return seen


def sort_hands(state):
    for pid in state["turn_order"]:
        state["players"][pid]["hand"].sort(key=lambda item: (card_number(item), item))


def locate(state, card):
    """Where a card sits right now, as ("hand", pid, index) or ("table", None, index)."""
    for pid in state["turn_order"]:
        hand = state["players"][pid]["hand"]
        if card in hand:
            return "hand", pid, hand.index(card)
    return "table", None, state["table"].index(card)


def place(state, number, slots=None):
    """Put the three copies of a number into three table slots and return them.

    Cards are swapped rather than dropped, so the board keeps all 36 of them.
    """
    if slots is None:
        slots = [index for index, card in enumerate(state["table"]) if card is not None][:3]
    slots = list(slots)
    assert len(slots) == 3, "a trio needs three slots"
    assert all(state["table"][slot] is not None for slot in slots), "cannot place into an empty slot"
    copies = [card for card in build_deck() if card_number(card) == number]
    for slot, card in zip(slots, copies):
        kind, pid, index = locate(state, card)
        if kind == "table":
            state["table"][index], state["table"][slot] = state["table"][slot], state["table"][index]
        else:
            state["players"][pid]["hand"][index] = state["table"][slot]
            state["table"][slot] = card
    sort_hands(state)
    return slots


def claim_table_trio(state, pid, number):
    """Let pid reveal three matching table cards and take the trio."""
    slots = place(state, number)
    for slot in slots:
        _, error = reveal_table(state, pid, slot)
        assert error is None, error
    return slots


def seed_trio(state, pid, number):
    """Hand a player a finished trio, taking those three cards off the board."""
    for card in [item for item in build_deck() if card_number(item) == number]:
        kind, owner, index = locate(state, card)
        if kind == "hand":
            state["players"][owner]["hand"].pop(index)
        else:
            state["table"][index] = None
    state["players"][pid]["trios"].append(number)


def scripted_pair(count=3, start=0):
    """A deal where some player holds two identical cards at the bottom."""
    for seed in range(start, start + 800):
        state = new_game(count, seed=seed)
        for pid in state["turn_order"]:
            hand = state["players"][pid]["hand"]
            if card_number(hand[0]) == card_number(hand[1]):
                return state, pid
    raise AssertionError("no deal with a matching pair at the bottom")


class TrioRegistrationTests(unittest.TestCase):
    def test_definition_is_registered(self):
        definition = get_game("trio")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.game_id, "trio")
        self.assertEqual(definition.name, "Trio")
        self.assertEqual(definition.name_zh, "回忆三重奏")
        self.assertEqual((definition.min_players, definition.max_players), (3, 6))
        self.assertEqual(definition.turn_mode, "turn")

    def test_action_schema_accepts_both_reveal_shapes(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        self.assertTrue(validator.is_valid(
            {"type": "reveal", "turn": 2, "source": "table", "index": 4}))
        self.assertTrue(validator.is_valid(
            {"type": "reveal", "turn": 2, "source": "hand", "player": "p1", "end": "low"}))
        self.assertTrue(validator.is_valid({"type": "continue", "turn": 2}))
        self.assertTrue(validator.is_valid({"type": "play_again"}))

    def test_action_schema_rejects_malformed_payloads(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        self.assertFalse(validator.is_valid({"type": "reveal", "turn": 2}))
        self.assertFalse(validator.is_valid(
            {"type": "reveal", "turn": 2, "source": "hand", "player": "p1", "end": "middle"}))
        self.assertFalse(validator.is_valid(
            {"type": "reveal", "turn": 2, "source": "table", "index": -1}))
        self.assertFalse(validator.is_valid(
            {"type": "reveal", "turn": 2, "source": "table", "index": 1, "extra": 1}))
        self.assertFalse(validator.is_valid({"type": "nope"}))

    def test_configuration_is_validated(self):
        validator = Draft7Validator(CONFIG_SCHEMA)
        self.assertTrue(validator.is_valid({"seed": 3, "mode": MODE_SPICY}))
        self.assertFalse(validator.is_valid({"mode": "team"}))
        self.assertFalse(validator.is_valid({"seed": 3, "bogus": 1}))
        with self.assertRaises(ValueError):
            TrioGame.init_game({"bogus": 1}, players(3))
        with self.assertRaises(ValueError):
            TrioGame.init_game({"seed": 1}, players(2))
        with self.assertRaises(ValueError):
            TrioGame.init_game({"seed": 1}, players(7))

    def test_bot_marker_is_registered(self):
        from game.ai_metadata import STRATEGIC_AI_GAME_IDS

        self.assertIn("trio", STRATEGIC_AI_GAME_IDS)


class TrioSetupTests(unittest.TestCase):
    def test_deck_is_three_copies_of_twelve_numbers(self):
        deck = build_deck()
        self.assertEqual(len(deck), DECK_SIZE)
        self.assertEqual(len(set(deck)), DECK_SIZE)
        for number in range(1, 13):
            self.assertEqual(sum(1 for card in deck if card_number(card) == number), 3)

    def test_deal_matches_the_official_table(self):
        for count in (3, 4, 5, 6):
            with self.subTest(players=count):
                state = new_game(count)
                self.assertEqual(len(state["table"]), TABLE_SIZE[count])
                for pid in state["turn_order"]:
                    self.assertEqual(len(state["players"][pid]["hand"]), HAND_SIZE[count])
                self.assertEqual(len(all_cards(state)), DECK_SIZE)

    def test_hands_are_sorted_low_to_high(self):
        state = new_game(5)
        for pid in state["turn_order"]:
            numbers = [card_number(card) for card in state["players"][pid]["hand"]]
            self.assertEqual(numbers, sorted(numbers))

    def test_links_follow_the_difference_and_sum_of_seven(self):
        self.assertEqual(connections(1), [6, 8])
        self.assertEqual(connections(2), [5, 9])
        self.assertEqual(connections(3), [4, 10])
        self.assertEqual(connections(5), [2, 12])
        self.assertTrue(connected(3, 10))
        self.assertTrue(connected(2, 5))
        self.assertFalse(connected(1, 2))

    def test_seeded_games_are_reproducible(self):
        first = new_game(4, seed=99)
        second = new_game(4, seed=99)
        self.assertEqual(first["table"], second["table"])
        for pid in first["turn_order"]:
            self.assertEqual(first["players"][pid]["hand"], second["players"][pid]["hand"])


class TrioRevealTests(unittest.TestCase):
    def setUp(self):
        self.state = new_game(3, seed=11)
        self.me = actor(self.state)

    def test_only_the_current_player_may_reveal(self):
        other = [pid for pid in self.state["turn_order"] if pid != self.me][0]
        self.assertEqual(TrioGame.get_legal_actions(self.state, other), [])
        _, error = reveal_table(self.state, other, 0)
        self.assertIsNotNone(error)

    def test_first_reveal_always_keeps_the_turn(self):
        _, error = reveal_table(self.state, self.me, 0)
        self.assertIsNone(error)
        self.assertEqual(self.state["stage"], STAGE_PLAY)
        self.assertEqual(len(self.state["revealed"]), 1)
        self.assertEqual(actor(self.state), self.me)

    def test_a_mismatch_ends_the_turn_and_restores_every_card(self):
        before = {pid: list(self.state["players"][pid]["hand"]) for pid in self.state["turn_order"]}
        table_before = list(self.state["table"])
        first = card_number(self.state["table"][0])
        mismatch = next(
            index for index, card in enumerate(self.state["table"])
            if card_number(card) != first
        )
        reveal_table(self.state, self.me, 0)
        _, error = reveal_table(self.state, self.me, mismatch)
        self.assertIsNone(error)
        self.assertEqual(self.state["revealed"], [])
        self.assertEqual(self.state["table"], table_before)
        for pid in self.state["turn_order"]:
            self.assertEqual(self.state["players"][pid]["hand"], before[pid])
        self.assertNotEqual(actor(self.state), self.me)
        self.assertFalse(self.state["last_result"]["success"])

    def test_three_matching_table_cards_claim_a_trio(self):
        slots = claim_table_trio(self.state, self.me, 8)
        self.assertEqual(self.state["stage"], STAGE_REVEAL)
        self.assertEqual(self.state["players"][self.me]["trios"], [8])
        self.assertEqual(self.state["revealed"], [])
        for slot in slots:
            self.assertIsNone(self.state["table"][slot])
        self.assertTrue(self.state["last_result"]["success"])
        self.assertEqual(len(all_cards(self.state)), DECK_SIZE - 3)

    def test_a_turn_never_exceeds_three_reveals(self):
        slots = place(self.state, 8)
        for slot in slots[:2]:
            reveal_table(self.state, self.me, slot)
        reveal_table(self.state, self.me, slots[2])
        self.assertEqual(self.state["stage"], STAGE_REVEAL)
        _, error = reveal_table(self.state, self.me, 0)
        self.assertIsNotNone(error)

    def test_the_same_table_card_cannot_be_flipped_twice_in_one_turn(self):
        reveal_table(self.state, self.me, 0)
        _, error = reveal_table(self.state, self.me, 0)
        self.assertIsNotNone(error)
        self.assertEqual(len(self.state["revealed"]), 1)

    def test_a_hand_reveal_takes_the_lowest_card(self):
        target = self.state["turn_order"][1]
        hand = list(self.state["players"][target]["hand"])
        _, error = reveal_hand(self.state, self.me, target, "low")
        self.assertIsNone(error)
        self.assertEqual(self.state["revealed"][0]["card"], hand[0])
        self.assertEqual(self.state["revealed"][0]["end"], "low")
        self.assertNotIn(hand[0], self.state["players"][target]["hand"])
        self.assertEqual(len(self.state["players"][target]["hand"]), len(hand) - 1)

    def test_a_hand_reveal_takes_the_highest_card(self):
        target = self.state["turn_order"][1]
        hand = list(self.state["players"][target]["hand"])
        _, error = reveal_hand(self.state, self.me, target, "high")
        self.assertIsNone(error)
        self.assertEqual(self.state["revealed"][0]["card"], hand[-1])
        self.assertEqual(self.state["revealed"][0]["end"], "high")
        self.assertNotIn(hand[-1], self.state["players"][target]["hand"])
        self.assertEqual(len(self.state["players"][target]["hand"]), len(hand) - 1)

    def test_a_player_may_reveal_their_own_hand(self):
        hand = list(self.state["players"][self.me]["hand"])
        _, error = reveal_hand(self.state, self.me, self.me, "low")
        self.assertIsNone(error)
        self.assertEqual(self.state["revealed"][0]["card"], hand[0])

    def test_the_same_end_can_be_asked_twice(self):
        state, holder = scripted_pair(3)
        me = actor(state)
        hand = list(state["players"][holder]["hand"])
        reveal_hand(state, me, holder, "low")
        reveal_hand(state, me, holder, "low")
        self.assertEqual([entry["card"] for entry in state["revealed"]], [hand[0], hand[1]])
        self.assertEqual(state["stage"], STAGE_PLAY)

    def test_a_failed_hand_reveal_puts_cards_back_in_order(self):
        target = self.state["turn_order"][1]
        before = list(self.state["players"][target]["hand"])
        table_before = list(self.state["table"])
        reveal_hand(self.state, self.me, target, "low")
        reveal_hand(self.state, self.me, target, "high")
        reveal_table(self.state, self.me, 0)
        self.assertFalse(self.state["last_result"]["success"])
        self.assertEqual(self.state["players"][target]["hand"], before)
        self.assertEqual(self.state["table"], table_before)
        self.assertEqual(len(all_cards(self.state)), DECK_SIZE)

    def test_the_high_end_of_a_single_card_hand_is_refused(self):
        target = self.state["turn_order"][1]
        self.state["players"][target]["hand"] = self.state["players"][target]["hand"][:1]
        keys = {(point["source"], point.get("player"), point.get("end"))
                for point in reveal_points(self.state)}
        self.assertIn(("hand", target, "low"), keys)
        self.assertNotIn(("hand", target, "high"), keys)
        _, error = reveal_hand(self.state, self.me, target, "high")
        self.assertIsNotNone(error)

    def test_an_emptied_table_slot_cannot_be_flipped(self):
        slots = claim_table_trio(self.state, self.me, 8)
        continue_all(self.state)
        nxt = actor(self.state)
        self.assertNotEqual(nxt, self.me)
        _, error = reveal_table(self.state, nxt, slots[0])
        self.assertIsNotNone(error)

    def test_stale_turn_numbers_are_rejected(self):
        _, error = TrioGame.apply_action(
            self.state, self.me,
            {"type": "reveal", "turn": self.state["turn"] + 5, "source": "table", "index": 0})
        self.assertEqual(error, "stale turn")

    def test_every_reveal_point_is_offered_to_the_current_player(self):
        points = reveal_points(self.state)
        table_points = [point for point in points if point["source"] == "table"]
        self.assertEqual(len(table_points), TABLE_SIZE[3])
        for pid in self.state["turn_order"]:
            ends = {point.get("end") for point in points if point.get("player") == pid}
            self.assertEqual(ends, {"low", "high"})


class TrioWinTests(unittest.TestCase):
    def test_three_trios_win_in_simple_mode(self):
        state = new_game(3, seed=5, mode=MODE_SIMPLE)
        pid = actor(state)
        seed_trio(state, pid, 2)
        seed_trio(state, pid, 5)
        claim_table_trio(state, pid, 8)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        self.assertEqual(state["winner"], pid)
        self.assertEqual(state["players"][pid]["trios"], [2, 5, 8])

    def test_two_trios_do_not_win_in_simple_mode(self):
        state = new_game(3, seed=5, mode=MODE_SIMPLE)
        pid = actor(state)
        seed_trio(state, pid, 2)
        claim_table_trio(state, pid, 8)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["stage"], STAGE_REVEAL)

    def test_the_trio_of_sevens_wins_immediately(self):
        state = new_game(4, seed=5, mode=MODE_SIMPLE)
        pid = actor(state)
        claim_table_trio(state, pid, 7)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], pid)
        self.assertEqual(state["players"][pid]["trios"], [7])

    def test_two_unlinked_trios_do_not_win_in_spicy_mode(self):
        state = new_game(3, seed=5, mode=MODE_SPICY)
        pid = actor(state)
        seed_trio(state, pid, 1)
        claim_table_trio(state, pid, 3)
        self.assertFalse(state["game_over"])
        self.assertEqual(len(state["players"][pid]["trios"]), 2)

    def test_two_linked_trios_win_in_spicy_mode(self):
        state = new_game(3, seed=5, mode=MODE_SPICY)
        pid = actor(state)
        seed_trio(state, pid, 1)
        claim_table_trio(state, pid, 8)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], pid)

    def test_spicy_mode_needs_a_link_not_a_third_trio(self):
        state = new_game(3, seed=5, mode=MODE_SPICY)
        pid = actor(state)
        seed_trio(state, pid, 1)
        seed_trio(state, pid, 3)
        claim_table_trio(state, pid, 9)
        self.assertFalse(state["game_over"])

    def test_mode_sets_the_trio_target(self):
        self.assertEqual(TRIOS_TO_WIN[MODE_SIMPLE], 3)
        self.assertEqual(TRIOS_TO_WIN[MODE_SPICY], 2)


class TrioPauseTests(unittest.TestCase):
    def test_every_player_must_continue_after_a_trio(self):
        state = new_game(3, seed=11)
        pid = actor(state)
        claim_table_trio(state, pid, 8)
        self.assertEqual(state["stage"], STAGE_REVEAL)
        self.assertEqual(state["turn"], 1)
        press_continue(state, state["turn_order"][0])
        press_continue(state, state["turn_order"][1])
        self.assertEqual(state["stage"], STAGE_REVEAL)
        press_continue(state, state["turn_order"][2])
        self.assertEqual(state["stage"], STAGE_PLAY)
        self.assertEqual(state["turn"], 2)
        self.assertNotEqual(actor(state), pid)

    def test_a_second_continue_from_the_same_player_is_refused(self):
        state = new_game(3, seed=11)
        claim_table_trio(state, actor(state), 8)
        first = state["turn_order"][0]
        press_continue(state, first)
        self.assertEqual(TrioGame.get_legal_actions(state, first), [])
        _, error = press_continue(state, first)
        self.assertIsNotNone(error)

    def test_play_again_needs_everybody(self):
        state = new_game(3, seed=11)
        claim_table_trio(state, actor(state), 7)
        self.assertTrue(state["game_over"])
        for other in state["turn_order"][:-1]:
            TrioGame.apply_action(state, other, {"type": "play_again"})
            self.assertTrue(state["game_over"])
        TrioGame.apply_action(state, state["turn_order"][-1], {"type": "play_again"})
        self.assertFalse(state["game_over"])
        self.assertEqual(state["stage"], STAGE_PLAY)
        self.assertEqual(state["turn"], 1)
        self.assertEqual(len(all_cards(state)), DECK_SIZE)
        for pid in state["turn_order"]:
            self.assertEqual(state["players"][pid]["trios"], [])


class TrioPrivacyTests(unittest.TestCase):
    def setUp(self):
        self.state = new_game(4, seed=3)
        self.me = actor(self.state)
        self.view = TrioGame.get_public_view(self.state, self.me)

    def test_other_hands_are_hidden(self):
        for player in self.view["players"]:
            if player["player_id"] == self.me:
                self.assertIsNotNone(player["hand"])
                self.assertEqual(len(player["hand"]), player["hand_count"])
            else:
                self.assertIsNone(player["hand"])
                self.assertEqual(player["hand_count"], HAND_SIZE[4])

    def test_face_down_table_cards_are_hidden(self):
        for slot in self.view["table"]:
            self.assertFalse(slot["face_up"])
            self.assertIsNone(slot["number"])

    def test_a_flipped_table_card_is_public(self):
        reveal_table(self.state, self.me, 0)
        number = card_number(self.state["table"][0])
        for viewer in self.state["turn_order"]:
            view = TrioGame.get_public_view(self.state, viewer)
            self.assertEqual(view["table"][0]["number"], number)
            self.assertTrue(view["table"][0]["face_up"])
            self.assertEqual(view["revealed"][0]["number"], number)

    def test_a_revealed_hand_card_is_public_but_the_rest_is_not(self):
        target = self.state["turn_order"][1]
        reveal_hand(self.state, self.me, target, "low")
        expected = card_number(self.state["revealed"][0]["card"])
        for viewer in self.state["turn_order"]:
            view = TrioGame.get_public_view(self.state, viewer)
            entry = next(item for item in view["players"] if item["player_id"] == target)
            self.assertEqual(entry["hand_count"], HAND_SIZE[4] - 1)
            if viewer == target:
                self.assertEqual(len(entry["hand"]), HAND_SIZE[4] - 1)
            else:
                self.assertIsNone(entry["hand"])
            self.assertEqual(view["revealed"][0]["number"], expected)

    def test_everything_is_revealed_once_the_game_ends(self):
        claim_table_trio(self.state, self.me, 7)
        self.assertTrue(self.state["game_over"])
        view = TrioGame.get_public_view(self.state, self.state["turn_order"][2])
        for player in view["players"]:
            self.assertIsNotNone(player["hand"])
        for slot in view["table"]:
            if not slot["empty"]:
                self.assertIsNotNone(slot["number"])


class TrioPersistenceTests(unittest.TestCase):
    def test_round_trip_preserves_the_board(self):
        state = new_game(5, seed=21)
        reveal_table(state, actor(state), 0)
        restored = TrioGame.deserialize(TrioGame.serialize(state))
        self.assertEqual(restored["table"], state["table"])
        self.assertEqual(restored["revealed"], state["revealed"])
        self.assertEqual(restored["turn"], state["turn"])
        for pid in state["turn_order"]:
            self.assertEqual(restored["players"][pid], state["players"][pid])

    def test_round_trip_survives_a_claimed_trio(self):
        state = new_game(3, seed=11)
        pid = actor(state)
        claim_table_trio(state, pid, 8)
        restored = TrioGame.deserialize(TrioGame.serialize(state))
        self.assertEqual(restored["players"][pid]["trios"], [8])

    def test_a_corrupt_payload_is_refused(self):
        state = new_game(3, seed=11)
        broken = TrioGame.serialize(state)
        broken["table"][0] = "nope"
        with self.assertRaises(ValueError):
            TrioGame.deserialize(broken)

    def test_a_duplicated_card_is_refused(self):
        state = new_game(3, seed=11)
        broken = TrioGame.serialize(state)
        broken["players"][broken["turn_order"][0]]["hand"][0] = broken["table"][0]
        with self.assertRaises(ValueError):
            TrioGame.deserialize(broken)

    def test_a_missing_card_is_refused(self):
        state = new_game(3, seed=11)
        broken = TrioGame.serialize(state)
        broken["table"][0] = None
        with self.assertRaises(ValueError):
            TrioGame.deserialize(broken)

    def test_an_unsorted_hand_is_refused(self):
        state = new_game(3, seed=11)
        broken = TrioGame.serialize(state)
        hand = broken["players"][broken["turn_order"][0]]["hand"]
        hand.reverse()
        if hand == sorted(hand, key=lambda card: (card_number(card), card)):
            self.skipTest("this deal happens to be symmetric")
        with self.assertRaises(ValueError):
            TrioGame.deserialize(broken)

    def test_an_unknown_mode_is_refused(self):
        state = new_game(3, seed=11)
        broken = TrioGame.serialize(state)
        broken["config"]["mode"] = "team"
        with self.assertRaises(ValueError):
            TrioGame.deserialize(broken)


class TrioBotTests(unittest.TestCase):
    def _play_bot_game(self, count, mode, seed, limit=1500):
        state = new_game(count, seed=seed, mode=mode)
        for _ in range(limit):
            if state["game_over"]:
                return state
            movers = [pid for pid in state["turn_order"] if TrioGame.get_legal_actions(state, pid)]
            self.assertTrue(movers, f"deadlock at stage {state['stage']}")
            for pid in movers:
                action = TrioGame.bot_move(state, pid)
                if action is None:
                    continue
                _, error = TrioGame.apply_action(state, pid, action)
                self.assertIsNone(error, f"bot produced an illegal action: {error}")
        self.fail("bot game did not terminate")

    def test_bot_games_finish_for_every_player_count_and_mode(self):
        for count in (3, 4, 5, 6):
            for mode in (MODE_SIMPLE, MODE_SPICY):
                with self.subTest(players=count, mode=mode):
                    state = self._play_bot_game(count, mode, seed=count * 10 + len(mode))
                    self.assertTrue(state["game_over"])

    def test_bot_wins_are_reachable_and_legal(self):
        winners = 0
        for seed in range(8):
            state = self._play_bot_game(4, MODE_SIMPLE, seed=seed)
            if state["winner"]:
                winners += 1
                self.assertIn(state["winner"], state["turn_order"])
                trios = state["players"][state["winner"]]["trios"]
                self.assertTrue(len(trios) >= 3 or 7 in trios)
        self.assertGreater(winners, 0, "no bot ever won, the policy is not functional")

    def test_bot_opening_move_is_always_legal(self):
        state = new_game(3, seed=17)
        state["history"] = []
        state["revealed"] = []
        pid = actor(state)
        action = TrioGame.bot_move(state, pid)
        self.assertIsNotNone(action)
        self.assertEqual(action["type"], "reveal")
        keys = {
            ("table", point.get("index")) if point["source"] == "table"
            else ("hand", point.get("player"), point.get("end"))
            for point in reveal_points(state)
        }
        if action["source"] == "table":
            self.assertIn(("table", action["index"]), keys)
        else:
            self.assertIn(("hand", action["player"], action["end"]), keys)

    def test_bot_finishes_a_trio_it_can_see(self):
        """Two matching cards already face up means the third one is next."""
        state = new_game(3, seed=23)
        pid = actor(state)
        slots = place(state, 4)
        reveal_table(state, pid, slots[0])
        reveal_table(state, pid, slots[1])
        self.assertEqual(state["revealed"][0]["number"], 4)
        self.assertEqual(state["stage"], STAGE_PLAY)
        action = TrioGame.bot_move(state, pid)
        self.assertIsNotNone(action)
        self.assertEqual(action["source"], "table")
        self.assertEqual(action["index"], slots[2])

    def test_bot_waits_for_its_turn(self):
        state = new_game(3, seed=13)
        current = actor(state)
        for pid in state["turn_order"]:
            if pid != current:
                self.assertIsNone(TrioGame.bot_move(state, pid))

    def test_bot_presses_continue_during_the_pause(self):
        state = new_game(3, seed=11)
        claim_table_trio(state, actor(state), 8)
        self.assertEqual(state["stage"], STAGE_REVEAL)
        for pid in state["turn_order"]:
            self.assertEqual(TrioGame.bot_move(state, pid), {"type": "continue", "turn": state["turn"]})


if __name__ == "__main__":
    unittest.main()
