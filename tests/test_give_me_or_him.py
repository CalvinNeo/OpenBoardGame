"""Unit tests for 给我！还是他？ (Give Me! Or Him?) -- designs/task190.md §8."""
import copy
import random
import unittest

from jsonschema import Draft7Validator

import game.definitions  # noqa: F401  (registers every game)
from game.registry import get_game
from game.give_me_or_him import (
    ACTION_SCHEMA,
    OUTCOME_LOSE,
    OUTCOME_WIN,
    STAGE_GAME_OVER,
    STAGE_GUESSING,
    STAGE_PLAY,
    STAGE_REVEAL,
    GiveMeOrHimGame,
    build_hint_deck,
    card_number,
    card_target,
    hint_error,
)
from game.give_me_or_him_data import (
    ACTION_VALIDATOR,
    CARDS_PER_NUMBER,
    MAX_HINT_LENGTH,
    STARTING_HAND,
    TEAM_LIVES,
    WORD_BY_ZH,
    WORDS,
)

EMPTY_HINT = "提示词不能为空"
SYMBOL_HINT = "提示词不能只用符号"
LONG_HINT = f"提示词最多 {MAX_HINT_LENGTH} 个字"
BOARD_WORD = "不能直接用场上任何一位玩家的词"
BOARD_CHAR = "不能使用场上词语里出现过的字"
DUPLICATE_HINT = "桌面上已经有相同的提示词了"


def players(count):
    return [{"player_id": f"p{index}", "name": f"P{index}", "seat": index} for index in range(count)]


def new_game(count, seed=7):
    return GiveMeOrHimGame.init_game({"seed": seed}, players(count))


def actor(state):
    return state["turn_order"][state["turn_index"]]


def unsolved(state):
    return [pid for pid in state["turn_order"] if not state["players"][pid]["solved"]]


def hand_card(state, pid, card):
    """Move a card into pid's hand, keeping every other hand intact."""
    for other in state["turn_order"]:
        if card in state["players"][other]["hand"]:
            state["players"][other]["hand"].remove(card)
            state["players"][pid]["hand"].append(card)
            return card
    raise AssertionError(f"{card} is in nobody's hand")


def legal_hint(state, rng=None):
    """A word from the shipped vocabulary that survives every hard check."""
    pool = [word["zh"] for word in WORDS]
    if rng is not None:
        rng.shuffle(pool)
    for candidate in pool:
        if hint_error(state, candidate) is None:
            return candidate
    raise AssertionError("no legal hint word is left")


def play_hint(state, pid, card, target, text):
    return GiveMeOrHimGame.apply_action(
        state, pid, {"type": "give_hint", "turn": state["turn"], "card": card, "target": target, "text": text})


def call_guess(state, pid, target):
    return GiveMeOrHimGame.apply_action(
        state, pid, {"type": "call_guess", "turn": state["turn"], "target": target})


def guess(state, pid, text):
    return GiveMeOrHimGame.apply_action(state, pid, {"type": "guess", "turn": state["turn"], "text": text})


def press_continue(state, pid):
    return GiveMeOrHimGame.apply_action(state, pid, {"type": "continue", "turn": state["turn"]})


def continue_all(state):
    for pid in state["turn_order"]:
        press_continue(state, pid)


def solve(state, pid):
    """The current player names pid, who answers correctly, then the pause is cleared."""
    call_guess(state, actor(state), pid)
    guess(state, pid, state["players"][pid]["word"])
    if state["stage"] == STAGE_REVEAL:
        continue_all(state)


def random_action(state, pid, rng):
    stage = state["stage"]
    if stage == STAGE_GUESSING:
        # The harness may peek at the hidden word here: a purely public guesser
        # would almost never finish, and this driver only checks termination.
        others = [state["players"][other]["word"] for other in unsolved(state) if other != pid]
        text = state["players"][pid]["word"] if rng.random() < 0.5 or not others else rng.choice(others)
        return {"type": "guess", "turn": state["turn"], "text": text}
    if stage == STAGE_REVEAL:
        return {"type": "continue", "turn": state["turn"]}
    kinds = GiveMeOrHimGame.get_legal_actions(state, pid)
    if kinds == ["call_guess"] or (len(kinds) > 1 and rng.random() < 0.4):
        return {"type": "call_guess", "turn": state["turn"], "target": rng.choice(unsolved(state))}
    hand = list(state["players"][pid]["hand"])
    rng.shuffle(hand)
    for card in hand:
        forced, wild = card_target(state, pid, card)
        target = rng.choice(unsolved(state)) if wild else forced
        return {"type": "give_hint", "turn": state["turn"], "card": card, "target": target,
                "text": legal_hint(state, rng)}
    return {"type": "call_guess", "turn": state["turn"], "target": rng.choice(unsolved(state))}


def play_random(state, rng, limit=600):
    for _ in range(limit):
        if state["game_over"]:
            return
        movers = [pid for pid in state["turn_order"] if GiveMeOrHimGame.get_legal_actions(state, pid)]
        if not movers:
            raise AssertionError(f"deadlock at {state['stage']}")
        pid = rng.choice(movers)
        action = random_action(state, pid, rng)
        _, error = GiveMeOrHimGame.apply_action(state, pid, action)
        if error:
            raise AssertionError(f"rejected {action}: {error}")
    raise AssertionError("game did not terminate")


def play_bots(state, limit=600):
    for _ in range(limit):
        if state["game_over"]:
            return
        for pid in state["turn_order"]:
            if not GiveMeOrHimGame.get_legal_actions(state, pid):
                continue
            action = GiveMeOrHimGame.bot_move(state, pid)
            if action is None:
                raise AssertionError(f"bot {pid} stalled at {state['stage']}")
            _, error = GiveMeOrHimGame.apply_action(state, pid, action)
            if error:
                raise AssertionError(f"bot action rejected {action}: {error}")
            break
        else:
            raise AssertionError(f"bots deadlocked at {state['stage']}")
    raise AssertionError("bot game did not terminate")


class GiveMeOrHimRegistrationTests(unittest.TestCase):
    def test_definition_is_registered(self):
        definition = get_game("give_me_or_him")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.game_id, "give_me_or_him")
        self.assertEqual(definition.name, "Give Me! Or Him?")
        self.assertEqual(definition.name_zh, "给我！还是他？")
        self.assertEqual((definition.min_players, definition.max_players), (3, 6))
        self.assertEqual(definition.turn_mode, "turn")
        self.assertTrue(Draft7Validator(definition.action_schema).is_valid(
            {"type": "call_guess", "turn": 1, "target": "p1"}))

    def test_action_schema_accepts_every_dealt_hint_card(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        for count in (3, 4, 5, 6):
            for card in build_hint_deck(count):
                action = {"type": "give_hint", "turn": 1, "card": card, "target": "p1", "text": "zz"}
                self.assertTrue(validator.is_valid(action), f"schema rejects dealt card {card}")

    def test_action_schema_rejects_unknown_fields(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        self.assertFalse(validator.is_valid({"type": "call_guess", "turn": 1, "target": "p1", "bogus": 1}))
        self.assertFalse(validator.is_valid({"type": "give_hint", "turn": 1, "card": "hint-1-0", "target": "p1"}))
        self.assertFalse(validator.is_valid({"type": "continue"}))
        self.assertFalse(validator.is_valid({"type": "play_again", "turn": 1}))

    def test_configuration_is_validated(self):
        definition = get_game("give_me_or_him")
        self.assertTrue(Draft7Validator(definition.config_schema).is_valid({"seed": 3}))
        self.assertFalse(Draft7Validator(definition.config_schema).is_valid({"seed": 3, "bogus": 1}))
        with self.assertRaises(ValueError):
            GiveMeOrHimGame.init_game({"bogus": 1}, players(3))
        with self.assertRaises(ValueError):
            GiveMeOrHimGame.init_game({"seed": 1}, players(2))
        with self.assertRaises(ValueError):
            GiveMeOrHimGame.init_game({"seed": 1}, players(7))


class GiveMeOrHimDealTests(unittest.TestCase):
    def test_hint_deck_holds_three_cards_per_player_number(self):
        for count in (3, 4, 5, 6):
            deck = build_hint_deck(count)
            self.assertEqual(len(deck), 3 * count)
            self.assertEqual(len(set(deck)), 3 * count)
            for number in range(1, count + 1):
                self.assertEqual(sum(1 for card in deck if card_number(card) == number), CARDS_PER_NUMBER)

    def test_setup_deals_the_whole_deck_and_unique_words(self):
        for count in (3, 4, 5, 6):
            with self.subTest(count=count):
                state = new_game(count, seed=count)
                self.assertEqual(state["deck"], [])
                self.assertEqual((state["stage"], state["turn"]), (STAGE_PLAY, 1))
                self.assertEqual((state["lives"], state["lives_max"]), (TEAM_LIVES, TEAM_LIVES))
                for pid in state["turn_order"]:
                    self.assertEqual(len(state["players"][pid]["hand"]), STARTING_HAND)
                    self.assertFalse(state["players"][pid]["solved"])
                    self.assertEqual(state["players"][pid]["wrong"], [])
                    self.assertEqual(state["players"][pid]["hints"], 0)
                dealt = [card for pid in state["turn_order"] for card in state["players"][pid]["hand"]]
                self.assertEqual(sorted(dealt), sorted(build_hint_deck(count)))
                numbers = sorted(state["players"][pid]["number"] for pid in state["turn_order"])
                self.assertEqual(numbers, list(range(1, count + 1)))
                words = [state["players"][pid]["word"] for pid in state["turn_order"]]
                self.assertEqual(len(set(words)), count)
                self.assertTrue(all(word in WORD_BY_ZH for word in words))

    def test_the_same_seed_deals_the_same_game(self):
        self.assertEqual(GiveMeOrHimGame.serialize(new_game(4, seed=5)),
                         GiveMeOrHimGame.serialize(new_game(4, seed=5)))
        self.assertNotEqual(GiveMeOrHimGame.serialize(new_game(4, seed=5)),
                            GiveMeOrHimGame.serialize(new_game(4, seed=6)))

    def test_only_the_current_player_may_act(self):
        state = new_game(4)
        self.assertEqual(actor(state), "p0")
        self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, "p0"), ["give_hint", "call_guess"])
        for pid in ("p1", "p2", "p3"):
            self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, pid), [])
        self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, "nobody"), [])


class GiveMeOrHimPrivacyTests(unittest.TestCase):
    def test_view_hides_your_own_word_but_shows_everyone_elses(self):
        state = new_game(5)
        for viewer in state["turn_order"]:
            with self.subTest(viewer=viewer):
                view = GiveMeOrHimGame.get_public_view(state, viewer)
                hidden = [entry["player_id"] for entry in view["players"] if entry["word"] is None]
                self.assertEqual(hidden, [viewer])
                for entry in view["players"]:
                    if entry["player_id"] != viewer:
                        self.assertEqual(entry["word"], state["players"][entry["player_id"]]["word"])
                self.assertEqual(view["you"], viewer)
                self.assertEqual(view["your_number"], state["players"][viewer]["number"])
                self.assertEqual([card["id"] for card in view["hand"]], state["players"][viewer]["hand"])
                self.assertNotIn("rng_state", view)
                self.assertNotIn("deck", view)
                self.assertEqual(view["deck_count"], 0)

    def test_a_solved_player_can_read_their_own_word(self):
        state = new_game(4)
        solve(state, "p2")
        self.assertTrue(state["players"]["p2"]["solved"])
        own = next(entry for entry in GiveMeOrHimGame.get_public_view(state, "p2")["players"]
                   if entry["player_id"] == "p2")
        self.assertEqual(own["word"], state["players"]["p2"]["word"])
        rival = next(entry for entry in GiveMeOrHimGame.get_public_view(state, "p0")["players"]
                     if entry["player_id"] == "p2")
        self.assertEqual(rival["word"], state["players"]["p2"]["word"])
        still_hidden = next(entry for entry in GiveMeOrHimGame.get_public_view(state, "p0")["players"]
                            if entry["player_id"] == "p0")
        self.assertIsNone(still_hidden["word"])

    def test_game_over_reveals_every_word_to_everyone(self):
        state = new_game(3)
        for pid in ("p1", "p2", "p0"):
            solve(state, pid)
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        for viewer in state["turn_order"]:
            view = GiveMeOrHimGame.get_public_view(state, viewer)
            for entry in view["players"]:
                self.assertEqual(entry["word"], state["players"][entry["player_id"]]["word"])

    def test_a_wrong_guess_never_leaks_the_word(self):
        state = new_game(4)
        call_guess(state, "p0", "p2")
        guess(state, "p2", state["players"]["p3"]["word"])
        self.assertFalse(state["result"]["correct"])
        self.assertIsNone(state["result"]["word"])
        for viewer in state["turn_order"]:
            view = GiveMeOrHimGame.get_public_view(state, viewer)
            self.assertIsNone(view["result"]["word"])
            own = next(entry for entry in view["players"] if entry["player_id"] == viewer)
            self.assertIsNone(own["word"])

    def test_table_hints_never_name_their_target(self):
        state = new_game(4)
        pid = actor(state)
        card = hand_card(state, pid, "hint-1-0")
        target = "p3"
        text = legal_hint(state)
        _, error = play_hint(state, pid, card, target, text)
        self.assertIsNone(error)
        self.assertEqual(state["table"][-1]["target"], target)
        for viewer in state["turn_order"]:
            view = GiveMeOrHimGame.get_public_view(state, viewer)
            self.assertEqual(len(view["table"]), 1)
            for entry in view["table"]:
                self.assertEqual(set(entry), {"id", "text", "by", "seq"})
                self.assertNotIn(target, entry.values())
            self.assertEqual(view["table"][0]["by"], pid)
            self.assertEqual(view["table"][0]["text"], text)


class GiveMeOrHimHintCardTests(unittest.TestCase):
    def test_a_card_pointing_at_yourself_is_wild(self):
        state = new_game(3)
        pid = actor(state)
        self.assertEqual(state["players"][pid]["number"], 1)
        card = hand_card(state, pid, "hint-1-0")
        self.assertEqual(card_target(state, pid, card), (None, True))
        for target in ("p1", "p2"):
            with self.subTest(target=target):
                fresh = new_game(3)
                fresh_card = hand_card(fresh, pid, "hint-1-0")
                _, error = play_hint(fresh, pid, fresh_card, target, legal_hint(fresh))
                self.assertIsNone(error)
                self.assertEqual(fresh["table"][-1]["target"], target)

    def test_a_card_pointing_at_a_solved_player_is_wild(self):
        state = new_game(4)
        solve(state, "p2")
        pid = actor(state)
        self.assertEqual(pid, "p1")
        card = hand_card(state, pid, "hint-3-0")
        self.assertEqual(card_target(state, pid, card), (None, True))
        _, error = play_hint(state, pid, card, "p3", legal_hint(state))
        self.assertIsNone(error)
        self.assertEqual(state["table"][-1]["target"], "p3")

    def test_a_plain_card_must_be_played_on_its_own_number(self):
        state = new_game(3)
        pid = actor(state)
        card = hand_card(state, pid, "hint-2-0")
        self.assertEqual(card_target(state, pid, card), ("p1", False))
        _, error = play_hint(state, pid, card, "p2", legal_hint(state))
        self.assertEqual(error, "card hint-2-0 must be played on player 2")
        self.assertEqual(state["table"], [])
        self.assertIn(card, state["players"][pid]["hand"])
        _, error = play_hint(state, pid, card, "p1", legal_hint(state))
        self.assertIsNone(error)
        self.assertEqual(state["table"][-1]["target"], "p1")

    def test_a_solved_player_can_neither_be_hinted_nor_called(self):
        state = new_game(4)
        solve(state, "p1")
        pid = actor(state)
        self.assertTrue(state["players"][pid]["solved"])
        card = hand_card(state, pid, "hint-2-0")
        self.assertEqual(card_target(state, pid, card), (None, True))
        _, error = play_hint(state, pid, card, pid, legal_hint(state))
        self.assertEqual(error, "that player already guessed their word")
        _, error = call_guess(state, pid, pid)
        self.assertEqual(error, "that player cannot guess")
        self.assertEqual(state["stage"], STAGE_PLAY)
        self.assertEqual(state["table"], [])

    def test_a_card_from_another_hand_is_refused(self):
        state = new_game(3)
        pid = actor(state)
        foreign = next(card for card in state["players"]["p1"]["hand"]
                       if card not in state["players"][pid]["hand"])
        _, error = play_hint(state, pid, foreign, "p2", legal_hint(state))
        self.assertEqual(error, "card is not in your hand")
        _, error = play_hint(state, pid, state["players"][pid]["hand"][0], "nobody", legal_hint(state))
        self.assertEqual(error, "unknown target")


class GiveMeOrHimHintTextTests(unittest.TestCase):
    def test_hint_error_rejects_blank_and_symbol_only_text(self):
        state = new_game(3)
        self.assertEqual(hint_error(state, ""), EMPTY_HINT)
        self.assertEqual(hint_error(state, "   "), EMPTY_HINT)
        self.assertEqual(hint_error(state, None), EMPTY_HINT)
        self.assertEqual(hint_error(state, "!!!"), SYMBOL_HINT)
        self.assertEqual(hint_error(state, "。。。"), SYMBOL_HINT)
        self.assertEqual(hint_error(state, "——"), SYMBOL_HINT)

    def test_hint_error_rejects_any_player_word(self):
        state = new_game(4)
        for pid in state["turn_order"]:
            word = state["players"][pid]["word"]
            with self.subTest(word=word):
                self.assertEqual(hint_error(state, word), BOARD_WORD)
                self.assertEqual(hint_error(state, word + "！"), BOARD_WORD)
                self.assertEqual(hint_error(state, f" {word} "), BOARD_WORD)

    def test_hint_error_rejects_characters_used_on_the_board(self):
        state = new_game(4)
        for pid in state["turn_order"]:
            for char in state["players"][pid]["word"]:
                with self.subTest(char=char):
                    self.assertEqual(hint_error(state, char), BOARD_CHAR)
                    self.assertEqual(hint_error(state, char + "zz"), BOARD_CHAR)

    def test_hint_error_rejects_a_repeat_of_a_table_hint(self):
        state = new_game(4)
        pid = actor(state)
        text = legal_hint(state)
        _, error = play_hint(state, pid, hand_card(state, pid, "hint-1-0"), "p2", text)
        self.assertIsNone(error)
        self.assertEqual(hint_error(state, text), DUPLICATE_HINT)
        self.assertEqual(hint_error(state, f" {text} "), DUPLICATE_HINT)

    def test_hint_error_enforces_the_twelve_character_limit(self):
        state = new_game(3)
        self.assertEqual(hint_error(state, "z" * (MAX_HINT_LENGTH + 1)), LONG_HINT)
        self.assertIsNone(hint_error(state, "z" * MAX_HINT_LENGTH))

    def test_apply_action_refuses_every_illegal_hint(self):
        state = new_game(4)
        pid = actor(state)
        card = hand_card(state, pid, "hint-1-0")
        word = state["players"]["p2"]["word"]
        cases = [("   ", EMPTY_HINT), ("???", SYMBOL_HINT), (word, BOARD_WORD), (word[0] + "zz", BOARD_CHAR),
                 ("z" * (MAX_HINT_LENGTH + 1), LONG_HINT)]
        for text, expected in cases:
            with self.subTest(text=text):
                _, error = play_hint(state, pid, card, "p3", text)
                self.assertEqual(error, expected)
                self.assertEqual(state["table"], [])
                self.assertIn(card, state["players"][pid]["hand"])
                self.assertEqual(state["turn"], 1)

    def test_apply_action_refuses_a_duplicate_hint(self):
        state = new_game(4)
        pid = actor(state)
        text = legal_hint(state)
        _, error = play_hint(state, pid, hand_card(state, pid, "hint-1-0"), "p2", text)
        self.assertIsNone(error)
        nxt = actor(state)
        card = hand_card(state, nxt, f"hint-{state['players'][nxt]['number']}-0")
        _, error = play_hint(state, nxt, card, "p3", text)
        self.assertEqual(error, DUPLICATE_HINT)
        self.assertEqual(len(state["table"]), 1)

    def test_a_legal_hint_moves_the_card_to_the_table(self):
        state = new_game(4)
        pid = actor(state)
        card = hand_card(state, pid, "hint-1-0")
        hand_before = list(state["players"][pid]["hand"])
        text = legal_hint(state)
        _, error = play_hint(state, pid, card, "p2", text)
        self.assertIsNone(error)
        self.assertEqual(state["players"][pid]["hand"], [item for item in hand_before if item != card])
        entry = state["table"][-1]
        self.assertEqual(entry["card"], card)
        self.assertEqual(entry["by"], pid)
        self.assertEqual(entry["target"], "p2")
        self.assertEqual(entry["text"], text)
        self.assertEqual(state["players"]["p2"]["hints"], 1)
        self.assertEqual(state["players"][pid]["hints"], 0)
        self.assertEqual((state["stage"], state["turn"]), (STAGE_PLAY, 2))
        self.assertEqual(actor(state), "p1")

    def test_hands_are_never_refilled(self):
        state = new_game(3)
        played = 0
        for _ in range(9):
            pid = actor(state)
            hand = state["players"][pid]["hand"]
            if not hand:
                continue
            card = hand[0]
            forced, wild = card_target(state, pid, card)
            target = unsolved(state)[0] if wild else forced
            _, error = play_hint(state, pid, card, target, legal_hint(state))
            self.assertIsNone(error)
            played += 1
        self.assertEqual(played, 9)
        self.assertEqual(len(state["table"]), 9)
        self.assertEqual(state["deck"], [])
        for pid in state["turn_order"]:
            self.assertEqual(state["players"][pid]["hand"], [])
            self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, pid), ["call_guess"] if pid == actor(state) else [])


class GiveMeOrHimGuessTests(unittest.TestCase):
    def test_call_guess_hands_the_marker_to_one_player_only(self):
        state = new_game(4)
        _, error = call_guess(state, "p0", "p2")
        self.assertIsNone(error)
        self.assertEqual(state["stage"], STAGE_GUESSING)
        self.assertEqual(state["guesser"], "p2")
        self.assertEqual(state["caller"], "p0")
        for pid in state["turn_order"]:
            expected = ["guess"] if pid == "p2" else []
            self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, pid), expected)
        _, error = guess(state, "p1", state["players"]["p2"]["word"])
        self.assertEqual(error, "action unavailable in this stage")
        self.assertFalse(state["players"]["p2"]["solved"])
        view = GiveMeOrHimGame.get_public_view(state, "p2")
        self.assertEqual((view["guesser"], view["caller"]), ("p2", "p0"))
        self.assertEqual(view["legal_actions"], ["guess"])

    def test_a_player_may_call_themselves(self):
        state = new_game(3)
        _, error = call_guess(state, "p0", "p0")
        self.assertIsNone(error)
        self.assertEqual(state["guesser"], "p0")
        self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, "p0"), ["guess"])

    def test_a_correct_guess_keeps_the_golden_marker(self):
        state = new_game(4)
        call_guess(state, "p0", "p2")
        _, error = guess(state, "p2", state["players"]["p2"]["word"])
        self.assertIsNone(error)
        self.assertTrue(state["players"]["p2"]["solved"])
        self.assertEqual(state["lives"], TEAM_LIVES)
        self.assertEqual(state["players"]["p2"]["wrong"], [])
        self.assertEqual(state["stage"], STAGE_REVEAL)
        self.assertTrue(state["result"]["correct"])
        self.assertEqual(state["result"]["word"], state["players"]["p2"]["word"])
        self.assertIsNone(state["guesser"])

    def test_guessing_ignores_surrounding_whitespace_and_punctuation(self):
        state = new_game(3)
        word = state["players"]["p1"]["word"]
        call_guess(state, "p0", "p1")
        _, error = guess(state, "p1", f" {word}。")
        self.assertIsNone(error)
        self.assertTrue(state["players"]["p1"]["solved"])

    def test_a_wrong_guess_shatters_a_marker_and_is_remembered(self):
        state = new_game(4)
        call_guess(state, "p0", "p2")
        wrong = state["players"]["p3"]["word"]
        _, error = guess(state, "p2", wrong)
        self.assertIsNone(error)
        self.assertFalse(state["players"]["p2"]["solved"])
        self.assertEqual(state["lives"], TEAM_LIVES - 1)
        self.assertEqual(state["players"]["p2"]["wrong"], [wrong])
        self.assertFalse(state["result"]["correct"])
        self.assertEqual(state["stage"], STAGE_REVEAL)
        continue_all(state)
        call_guess(state, actor(state), "p2")
        guess(state, "p2", wrong)
        self.assertEqual(state["lives"], TEAM_LIVES - 2)
        self.assertEqual(state["players"]["p2"]["wrong"], [wrong, wrong])
        self.assertFalse(state["players"]["p2"]["solved"])


class GiveMeOrHimFlowTests(unittest.TestCase):
    def test_reveal_waits_for_every_player_before_the_turn_moves_on(self):
        state = new_game(4)
        call_guess(state, "p0", "p2")
        guess(state, "p2", state["players"]["p2"]["word"])
        self.assertEqual(state["stage"], STAGE_REVEAL)
        for pid in ("p0", "p1", "p2"):
            press_continue(state, pid)
            self.assertEqual(state["stage"], STAGE_REVEAL)
            self.assertEqual((state["turn"], state["turn_index"]), (1, 0))
            self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, pid), [])
        self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, "p3"), ["continue"])
        press_continue(state, "p3")
        self.assertEqual(state["stage"], STAGE_PLAY)
        self.assertEqual(state["turn"], 2)
        self.assertEqual(actor(state), "p1")
        self.assertEqual(state["continue_ready"], [])
        self.assertIsNone(state["guesser"])
        self.assertIsNone(state["caller"])

    def test_a_hint_turn_passes_to_the_next_seat(self):
        state = new_game(3)
        for expected in ("p1", "p2", "p0"):
            pid = actor(state)
            card = state["players"][pid]["hand"][0]
            forced, wild = card_target(state, pid, card)
            target = unsolved(state)[0] if wild else forced
            _, error = play_hint(state, pid, card, target, legal_hint(state))
            self.assertIsNone(error)
            self.assertEqual(actor(state), expected)
        self.assertEqual(state["turn"], 4)

    def test_stale_and_out_of_turn_actions_are_rejected(self):
        state = new_game(3)
        _, error = GiveMeOrHimGame.apply_action(state, "p0", {"type": "call_guess", "turn": 9, "target": "p1"})
        self.assertEqual(error, "stale turn")
        _, error = GiveMeOrHimGame.apply_action(state, "p1", {"type": "call_guess", "turn": 1, "target": "p2"})
        self.assertEqual(error, "action unavailable in this stage")
        _, error = GiveMeOrHimGame.apply_action(state, "nobody", {"type": "call_guess", "turn": 1, "target": "p1"})
        self.assertEqual(error, "player not found")
        _, error = GiveMeOrHimGame.apply_action(state, "p0", {"type": "nope", "turn": 1})
        self.assertEqual(error, "invalid action schema")
        _, error = GiveMeOrHimGame.apply_action(state, "p0", "call_guess")
        self.assertEqual(error, "invalid action schema")

    def test_everyone_guessing_their_word_wins_the_game(self):
        state = new_game(3)
        for pid in ("p1", "p2", "p0"):
            solve(state, pid)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        self.assertEqual(state["outcome"], OUTCOME_WIN)
        self.assertEqual(state["lives"], TEAM_LIVES)
        self.assertTrue(all(state["players"][pid]["solved"] for pid in state["turn_order"]))
        for pid in state["turn_order"]:
            self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, pid), ["play_again"])

    def test_three_shattered_markers_lose_the_game(self):
        state = new_game(3)
        for _ in range(TEAM_LIVES):
            caller = actor(state)
            target = next(pid for pid in state["turn_order"] if pid != caller)
            call_guess(state, caller, target)
            wrong = next(state["players"][pid]["word"] for pid in state["turn_order"] if pid != target)
            guess(state, target, wrong)
            if state["stage"] == STAGE_REVEAL:
                continue_all(state)
        self.assertEqual(state["lives"], 0)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        self.assertEqual(state["outcome"], OUTCOME_LOSE)
        self.assertTrue(any(not state["players"][pid]["solved"] for pid in state["turn_order"]))

    def test_play_again_needs_the_whole_table(self):
        state = new_game(3)
        for pid in ("p1", "p2", "p0"):
            solve(state, pid)
        for pid in ("p0", "p1"):
            _, error = GiveMeOrHimGame.apply_action(state, pid, {"type": "play_again"})
            self.assertIsNone(error)
            self.assertTrue(state["game_over"])
            self.assertEqual(GiveMeOrHimGame.get_legal_actions(state, pid), [])
        _, error = GiveMeOrHimGame.apply_action(state, "p2", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["stage"], STAGE_PLAY)
        self.assertEqual((state["turn"], state["lives"]), (1, TEAM_LIVES))
        self.assertEqual(state["table"], [])
        self.assertEqual(state["rematch_ready"], [])
        for pid in state["turn_order"]:
            self.assertEqual(len(state["players"][pid]["hand"]), STARTING_HAND)
            self.assertFalse(state["players"][pid]["solved"])


class GiveMeOrHimSaveTests(unittest.TestCase):
    def test_saves_round_trip_at_every_stage(self):
        state = new_game(4, seed=21)
        snapshots = [copy.deepcopy(state)]
        pid = actor(state)
        play_hint(state, pid, hand_card(state, pid, "hint-1-0"), "p2", legal_hint(state))
        snapshots.append(copy.deepcopy(state))
        call_guess(state, actor(state), "p3")
        snapshots.append(copy.deepcopy(state))
        guess(state, "p3", state["players"]["p3"]["word"])
        snapshots.append(copy.deepcopy(state))
        continue_all(state)
        for pid in ("p2", "p1", "p0"):
            solve(state, pid)
        snapshots.append(copy.deepcopy(state))
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        for index, snapshot in enumerate(snapshots):
            with self.subTest(snapshot=index):
                restored = GiveMeOrHimGame.deserialize(GiveMeOrHimGame.serialize(snapshot))
                self.assertEqual(restored, snapshot)
                self.assertEqual(GiveMeOrHimGame.get_public_view(restored, "p0"),
                                 GiveMeOrHimGame.get_public_view(snapshot, "p0"))

    def test_a_restored_game_keeps_playing(self):
        state = new_game(3, seed=13)
        pid = actor(state)
        play_hint(state, pid, hand_card(state, pid, "hint-1-0"), "p2", legal_hint(state))
        resumed = GiveMeOrHimGame.deserialize(GiveMeOrHimGame.serialize(state))
        self.assertEqual(resumed, state)
        nxt = actor(resumed)
        card = resumed["players"][nxt]["hand"][0]
        forced, wild = card_target(resumed, nxt, card)
        _, error = play_hint(resumed, nxt, card, forced or unsolved(resumed)[0], legal_hint(resumed))
        self.assertIsNone(error)
        self.assertEqual(len(resumed["table"]), 2)

    def test_deserialize_rejects_a_shortened_turn_order(self):
        state = new_game(4)
        payload = GiveMeOrHimGame.serialize(state)
        payload["turn_order"] = payload["turn_order"][:-1]
        with self.assertRaises(ValueError):
            GiveMeOrHimGame.deserialize(payload)

    def test_deserialize_rejects_a_missing_card(self):
        state = new_game(4)
        payload = GiveMeOrHimGame.serialize(state)
        payload["players"]["p0"]["hand"].pop()
        with self.assertRaises(ValueError):
            GiveMeOrHimGame.deserialize(payload)

    def test_deserialize_rejects_other_tampered_payloads(self):
        state = new_game(4)
        mutations = {
            "version": lambda payload: payload.update({"version": 2}),
            "game_id": lambda payload: payload.update({"game_id": "other"}),
            "stage": lambda payload: payload.update({"stage": "nope"}),
            "game_over": lambda payload: payload.update({"game_over": True}),
            "lives": lambda payload: payload.update({"lives": 7}),
            "lives_max": lambda payload: payload.update({"lives_max": 5}),
            "turn": lambda payload: payload.update({"turn": 0}),
            "turn_index": lambda payload: payload.update({"turn_index": 9}),
            "outcome": lambda payload: payload.update({"outcome": "draw"}),
            "player_count": lambda payload: payload.update({"player_count": 5}),
            "missing_player": lambda payload: payload["players"].pop("p1"),
            "number": lambda payload: payload["players"]["p0"].update({"number": 9}),
            "duplicate_number": lambda payload: payload["players"]["p0"].update({"number": 2}),
            "empty_word": lambda payload: payload["players"]["p0"].update({"word": ""}),
            "solved": lambda payload: payload["players"]["p0"].update({"solved": "yes"}),
            "hints": lambda payload: payload["players"]["p0"].update({"hints": -1}),
            "duplicate_card": lambda payload: payload["table"].append(
                {"card": payload["players"]["p0"]["hand"][0], "by": "p0", "target": "p1", "text": "zz", "seq": 0}),
            "table_target": lambda payload: payload["table"].append(
                {"card": "hint-1-0", "by": "p0", "target": "nobody", "text": "zz", "seq": 0}),
            "log": lambda payload: payload.update({"log": [1, 2]}),
            "rng_state": lambda payload: payload.update({"rng_state": "nope"}),
        }
        for name, mutate in mutations.items():
            with self.subTest(mutation=name):
                payload = GiveMeOrHimGame.serialize(state)
                mutate(payload)
                with self.assertRaises(ValueError):
                    GiveMeOrHimGame.deserialize(payload)


class GiveMeOrHimRandomGameTests(unittest.TestCase):
    def test_random_games_finish_for_every_player_count(self):
        for count in (3, 4, 5, 6):
            for seed in range(3):
                with self.subTest(count=count, seed=seed):
                    state = new_game(count, seed=seed * 31 + count)
                    play_random(state, random.Random(seed))
                    self.assertTrue(state["game_over"])
                    self.assertEqual(state["stage"], STAGE_GAME_OVER)
                    self.assertIsNotNone(state["outcome"])
                    self.assertIn(state["outcome"], (OUTCOME_WIN, OUTCOME_LOSE))
                    GiveMeOrHimGame.deserialize(GiveMeOrHimGame.serialize(state))

    def test_cards_are_conserved_and_hands_only_shrink(self):
        state = new_game(5, seed=99)
        before = {pid: len(state["players"][pid]["hand"]) for pid in state["turn_order"]}
        play_random(state, random.Random(5))
        seen = list(state["deck"]) + [entry["card"] for entry in state["table"]]
        for pid in state["turn_order"]:
            seen += state["players"][pid]["hand"]
            self.assertLessEqual(len(state["players"][pid]["hand"]), before[pid])
        self.assertEqual(sorted(seen), sorted(build_hint_deck(5)))
        self.assertEqual(len(set(seen)), len(seen))
        self.assertEqual(state["deck"], [])

    def test_the_log_never_grows_without_bound(self):
        state = new_game(6, seed=17)
        play_random(state, random.Random(2))
        self.assertLessEqual(len(state["log"]), 60)
        self.assertTrue(all(isinstance(line, str) for line in state["log"]))


class GiveMeOrHimBotTests(unittest.TestCase):
    def assert_bot_action(self, state, bot_id):
        legal = GiveMeOrHimGame.get_legal_actions(state, bot_id)
        self.assertTrue(legal, f"{bot_id} has nothing to do at {state['stage']}")
        action = GiveMeOrHimGame.bot_move(state, bot_id)
        self.assertIsNotNone(action, f"bot_move returned None at {state['stage']}")
        self.assertIn(action["type"], legal)
        self.assertTrue(ACTION_VALIDATOR.is_valid(action), f"schema rejects {action}")
        _, error = GiveMeOrHimGame.apply_action(state, bot_id, action)
        self.assertIsNone(error, f"apply_action rejected {action}: {error}")
        return action

    def test_bot_moves_in_the_play_stage(self):
        state = new_game(4)
        bot = actor(state)
        action = GiveMeOrHimGame.bot_move(state, bot)
        self.assertIsNotNone(action)
        self.assertIn(action["type"], GiveMeOrHimGame.get_legal_actions(state, bot))
        self.assertTrue(ACTION_VALIDATOR.is_valid(action), f"schema rejects {action}")
        if action["type"] == "give_hint":
            self.assertIn(action["card"], state["players"][bot]["hand"])
            self.assertIsNone(hint_error(state, action["text"]))
        _, error = GiveMeOrHimGame.apply_action(state, bot, action)
        self.assertIsNone(error, f"apply_action rejected {action}: {error}")
        self.assertEqual((state["stage"], state["turn"]), (STAGE_PLAY, 2))
        if action["type"] == "give_hint":
            self.assertEqual(state["table"][-1]["text"], action["text"])

    def test_bot_moves_in_the_guessing_stage(self):
        state = new_game(4)
        call_guess(state, "p0", "p2")
        action = self.assert_bot_action(state, "p2")
        self.assertEqual(action["type"], "guess")
        self.assertIn(action["text"], {state["players"][pid]["word"] for pid in unsolved(state)})

    def test_bot_moves_in_the_reveal_stage(self):
        state = new_game(4)
        call_guess(state, "p0", "p2")
        guess(state, "p2", state["players"]["p2"]["word"])
        self.assertEqual(state["stage"], STAGE_REVEAL)
        action = self.assert_bot_action(state, "p1")
        self.assertEqual(action, {"type": "continue", "turn": 1})
        self.assertEqual(state["continue_ready"], ["p1"])

    def test_bot_moves_in_the_game_over_stage(self):
        state = new_game(3)
        for pid in ("p1", "p2", "p0"):
            solve(state, pid)
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        action = self.assert_bot_action(state, "p1")
        self.assertEqual(action, {"type": "play_again"})
        self.assertEqual(state["rematch_ready"], ["p1"])
        self.assertIsNone(GiveMeOrHimGame.bot_move(state, "p1"))

    def test_bot_has_no_move_when_it_is_not_its_turn(self):
        state = new_game(4)
        self.assertIsNone(GiveMeOrHimGame.bot_move(state, "p1"))
        call_guess(state, "p0", "p2")
        self.assertIsNone(GiveMeOrHimGame.bot_move(state, "p1"))

    def test_bot_does_not_always_answer_its_own_word(self):
        hits = 0
        for seed in range(12):
            state = new_game(4, seed=seed)
            call_guess(state, "p0", "p2")
            action = GiveMeOrHimGame.bot_move(state, "p2")
            hits += action["text"] == state["players"]["p2"]["word"]
        self.assertLessEqual(hits, 6, "the bot looks like it is reading its own hidden word")

    def test_all_bot_games_run_to_the_end(self):
        for count in (3, 4, 5, 6):
            with self.subTest(count=count):
                state = new_game(count, seed=200 + count)
                play_bots(state)
                self.assertTrue(state["game_over"])
                self.assertIsNotNone(state["outcome"])
                self.assertIn(state["outcome"], (OUTCOME_WIN, OUTCOME_LOSE))
                GiveMeOrHimGame.deserialize(GiveMeOrHimGame.serialize(state))


if __name__ == "__main__":
    unittest.main()
