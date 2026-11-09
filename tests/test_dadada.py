"""Unit tests for 哒哒哒 / DADADA -- designs/task192.md §8."""
import copy
import random
import unittest

from jsonschema import Draft7Validator

import game.definitions  # noqa: F401  (registers every game)
from game.registry import get_game
from game.dadada import (
    ACTION_SCHEMA,
    STAGE_CREATE,
    STAGE_GAME_OVER,
    STAGE_GUESS,
    STAGE_REVEAL,
    STAGE_SPEAK,
    DadadaGame,
    _revealed_sound_ids,
    _unassigned,
)
from game.dadada_data import (
    ACTION_VALIDATOR,
    CANDIDATES,
    CONFIG_VALIDATOR,
    CREATION_IMAGES,
    IMAGE_IDS,
    MAX_WORD_LENGTH,
    PICTURES,
    SAY_WHAT_LIMIT,
    SOUNDS_IN_PLAY,
    SYLLABLES,
)


def make_players(count, prefix="p"):
    return [{"player_id": f"{prefix}{index}", "name": f"P{index}", "seat": index}
            for index in range(count)]


def new_game(count=4, seed=1):
    return DadadaGame.init_game({"seed": seed}, make_players(count))


def ids(state):
    return list(state["turn_order"])


def legal(state, player_id):
    return DadadaGame.get_legal_actions(state, player_id)


def act(state, player_id, action):
    events, error = DadadaGame.apply_action(state, player_id, action)
    assert error is None, f"unexpected error: {error} for {action}"
    return events


def sort_creation(state):
    """Drive the whole Creation phase, one picture per seat."""
    guard = 0
    while state["stage"] == STAGE_CREATE and guard < 200:
        guard += 1
        current = state["turn_order"][state["turn_index"]]
        images = _unassigned(state)
        act(state, current, {"type": "propose", "turn": state["turn"],
                             "image": images[0], "sound": _revealed_sound_ids(state)[0]})
    assert state["stage"] != STAGE_CREATE, "creation never finished"


def play_round(state, word_length=1, guess_target=True):
    """Run one full Communication round and return its result."""
    communicator = state["communicator"]
    sounds = _revealed_sound_ids(state)
    target = state["candidates"][0]
    act(state, communicator, {"type": "speak", "turn": state["turn"], "target": target,
                              "word": [sounds[0]] * word_length})
    for pid in ids(state):
        if pid == communicator:
            continue
        pick = target if guess_target else next(
            image for image in state["candidates"] if image != target)
        act(state, pid, {"type": "guess", "turn": state["turn"], "image": pick})
    return state["result"]


def finish_round(state):
    for pid in ids(state):
        if "continue" in legal(state, pid):
            act(state, pid, {"type": "continue", "turn": state["turn"]})


class DadadaRegistrationTests(unittest.TestCase):
    def test_definition_is_registered(self):
        definition = get_game("dadada")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.game_id, "dadada")
        self.assertEqual(definition.name, "DADADA")
        self.assertEqual(definition.name_zh, "哒哒哒")
        self.assertEqual(definition.min_players, 2)
        self.assertEqual(definition.max_players, 6)
        self.assertEqual(definition.turn_mode, "turn")
        self.assertIs(definition.module, DadadaGame)

    def test_action_schema_accepts_real_payloads(self):
        state = new_game()
        sounds = _revealed_sound_ids(state)
        payloads = [
            {"type": "propose", "turn": 1, "image": state["table"][0], "sound": sounds[0]},
            {"type": "speak", "turn": 1, "target": state["table"][0], "word": sounds},
            {"type": "guess", "turn": 1, "image": state["table"][0]},
            {"type": "continue", "turn": 1},
            {"type": "play_again"},
        ]
        validator = Draft7Validator(ACTION_SCHEMA)
        for payload in payloads:
            with self.subTest(payload=payload["type"]):
                self.assertEqual(list(validator.iter_errors(payload)), [])

    def test_action_schema_rejects_unknown_and_missing_fields(self):
        bad = [
            {"type": "propose", "turn": 1, "image": "img-001", "sound": "snd-01", "x": 1},
            {"type": "propose", "turn": 1, "image": "img-001"},
            {"type": "propose", "turn": 1, "image": "img-001", "sound": "new"},
            {"type": "vote", "turn": 1, "approve": True},
            {"type": "speak", "turn": 1, "target": "img-001", "word": []},
            {"type": "speak", "turn": 1, "target": "nope", "word": ["snd-01"]},
            {"type": "guess", "turn": 0, "image": "img-001"},
            {"type": "play_again", "turn": 1},
        ]
        for payload in bad:
            with self.subTest(payload=payload):
                self.assertFalse(ACTION_VALIDATOR.is_valid(payload))

    def test_configuration_is_validated(self):
        self.assertTrue(CONFIG_VALIDATOR.is_valid({}))
        self.assertTrue(CONFIG_VALIDATOR.is_valid({"seed": 5}))
        self.assertTrue(CONFIG_VALIDATOR.is_valid({"seed": "abc"}))
        self.assertFalse(CONFIG_VALIDATOR.is_valid({"seed": 1.5}))
        self.assertFalse(CONFIG_VALIDATOR.is_valid({"other": 1}))
        with self.assertRaises(ValueError):
            DadadaGame.init_game({"nope": 1}, make_players(3))
        with self.assertRaises(ValueError):
            DadadaGame.init_game({}, make_players(1))
        with self.assertRaises(ValueError):
            DadadaGame.init_game({}, make_players(7))

    def test_decks_are_well_formed(self):
        self.assertEqual(len(SYLLABLES), 40)
        self.assertEqual(len(set(SYLLABLES)), 40)
        self.assertGreaterEqual(len(PICTURES), 200)
        self.assertEqual(len({picture["emoji"] for picture in PICTURES}), len(PICTURES))
        self.assertEqual(len(set(IMAGE_IDS)), len(IMAGE_IDS))


class DadadaSetupTests(unittest.TestCase):
    def test_every_sound_is_face_up_from_the_start(self):
        """Online deviation: no face-down reserve, the whole alphabet is visible."""
        state = new_game()
        self.assertEqual(len(state["sounds"]), SOUNDS_IN_PLAY)
        self.assertNotIn("reserve", state)
        view = DadadaGame.get_public_view(state, ids(state)[0])
        self.assertEqual(len(view["sounds"]), SOUNDS_IN_PLAY)
        self.assertTrue(all(sound["syllable"] for sound in view["sounds"]))
        self.assertEqual(len({sound["syllable"] for sound in view["sounds"]}), SOUNDS_IN_PLAY)

    def test_setup_matches_the_published_picture_count(self):
        state = new_game()
        self.assertEqual(state["stage"], STAGE_CREATE)
        self.assertEqual(len(state["table"]), CREATION_IMAGES)
        self.assertEqual(len(set(state["table"])), CREATION_IMAGES)
        self.assertEqual(len(state["placed"]), 0)
        self.assertEqual(state["round"], 0)
        self.assertEqual(state["rounds_total"], 4)

    def test_the_same_seed_deals_the_same_game(self):
        first = new_game(seed=99)
        second = new_game(seed=99)
        self.assertEqual(first["table"], second["table"])
        self.assertEqual(first["sounds"], second["sounds"])

    def test_only_the_current_player_may_propose(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        for pid in ids(state):
            expected = ["propose"] if pid == current else []
            self.assertEqual(legal(state, pid), expected)


class DadadaCreationTests(unittest.TestCase):
    def test_a_proposal_files_the_picture_immediately(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        image = state["table"][0]
        sound = _revealed_sound_ids(state)[0]
        act(state, current, {"type": "propose", "turn": state["turn"],
                             "image": image, "sound": sound})
        self.assertEqual(state["placed"][image], sound)
        self.assertEqual(
            [entry for entry in state["sounds"] if entry["id"] == sound][0]["images"], [image])
        self.assertNotIn(image, _unassigned(state))
        self.assertNotEqual(state["turn_order"][state["turn_index"]], current)

    def test_nobody_has_to_approve(self):
        """Online deviation: filing a picture needs no vote from anyone."""
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        for pid in ids(state):
            if pid != current:
                self.assertEqual(legal(state, pid), [], "a non-turn player must have nothing to do")
        act(state, current, {"type": "propose", "turn": state["turn"],
                             "image": state["table"][0], "sound": _revealed_sound_ids(state)[0]})
        self.assertEqual(len(state["placed"]), 1)

    def test_every_sound_can_be_used_from_turn_one(self):
        state = new_game()
        sounds = _revealed_sound_ids(state)
        for index, sound in enumerate(sounds):
            current = state["turn_order"][state["turn_index"]]
            act(state, current, {"type": "propose", "turn": state["turn"],
                                 "image": state["table"][index], "sound": sound})
        self.assertEqual(len(set(state["placed"].values())), SOUNDS_IN_PLAY)

    def test_an_already_sorted_picture_cannot_be_proposed_again(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        image = state["table"][0]
        sound = _revealed_sound_ids(state)[0]
        act(state, current, {"type": "propose", "turn": state["turn"],
                             "image": image, "sound": sound})
        nxt = state["turn_order"][state["turn_index"]]
        _, error = DadadaGame.apply_action(state, nxt, {
            "type": "propose", "turn": state["turn"], "image": image, "sound": sound})
        self.assertEqual(error, "that picture is already sorted")

    def test_creation_ends_after_every_picture_is_sorted(self):
        state = new_game()
        sort_creation(state)
        self.assertEqual(state["stage"], STAGE_SPEAK)
        self.assertEqual(len(state["placed"]), CREATION_IMAGES)
        self.assertEqual(len(_unassigned(state)), 0)
        self.assertEqual(state["round"], 1)
        self.assertEqual(len(state["candidates"]), CANDIDATES)
        self.assertIsNotNone(state["communicator"])

    def test_creation_takes_one_turn_per_picture(self):
        state = new_game()
        start = state["turn"]
        sort_creation(state)
        # Thirteen pictures, each advancing the seat once.
        self.assertEqual(state["turn"], start + CREATION_IMAGES)


class DadadaCommunicationTests(unittest.TestCase):
    def setUp(self):
        self.state = new_game()
        sort_creation(self.state)

    def test_only_the_communicator_may_speak(self):
        state = self.state
        for pid in ids(state):
            expected = ["speak"] if pid == state["communicator"] else []
            self.assertEqual(legal(state, pid), expected)

    def test_a_word_may_only_use_sounds_from_the_language(self):
        state = self.state
        unused = next(sound for sound in ("snd-40", "snd-39", "snd-38")
                      if sound not in _revealed_sound_ids(state))
        _, error = DadadaGame.apply_action(state, state["communicator"], {
            "type": "speak", "turn": state["turn"], "target": state["candidates"][0],
            "word": [unused]})
        self.assertEqual(error, "you may only use sounds from your language")

    def test_a_word_can_chain_several_syllables(self):
        state = self.state
        sounds = _revealed_sound_ids(state)
        word = [sounds[0], sounds[1], sounds[0]]
        act(state, state["communicator"], {"type": "speak", "turn": state["turn"],
                                           "target": state["candidates"][0], "word": word})
        self.assertEqual(state["word"], word)
        view = DadadaGame.get_public_view(state, ids(state)[0])
        syllables = {sound["id"]: sound["syllable"] for sound in view["sounds"]}
        expected = "-".join(syllables[sound] for sound in word)
        for pid in ids(state):
            view = DadadaGame.get_public_view(state, pid)
            self.assertEqual(view["word"], word)
            self.assertEqual(view["word_label"], expected)
            self.assertEqual(len(view["word_label"].split("-")), 3)

    def test_a_word_longer_than_the_limit_is_refused(self):
        state = self.state
        sounds = _revealed_sound_ids(state)
        payload = {"type": "speak", "turn": state["turn"], "target": state["candidates"][0],
                   "word": [sounds[0]] * (MAX_WORD_LENGTH + 1)}
        self.assertFalse(ACTION_VALIDATOR.is_valid(payload))

    def test_a_target_outside_the_candidates_is_refused(self):
        state = self.state
        stranger = next(image for image in state["image_deck"] if image not in state["candidates"])
        _, error = DadadaGame.apply_action(state, state["communicator"], {
            "type": "speak", "turn": state["turn"], "target": stranger,
            "word": [_revealed_sound_ids(state)[0]]})
        self.assertEqual(error, "that picture is not on the table")

    def test_the_communicator_cannot_guess(self):
        state = self.state
        act(state, state["communicator"], {
            "type": "speak", "turn": state["turn"], "target": state["candidates"][0],
            "word": [_revealed_sound_ids(state)[0]]})
        self.assertEqual(legal(state, state["communicator"]), [])
        other = next(pid for pid in ids(state) if pid != state["communicator"])
        self.assertEqual(legal(state, other), ["guess"])

    def test_a_correct_guess_scores_and_files_the_picture(self):
        state = self.state
        result = play_round(state, guess_target=True)
        self.assertTrue(result["correct"])
        self.assertEqual(state["score"], 1)
        self.assertEqual(state["defined"], [result["target"]])
        self.assertEqual(state["say_what"], [])
        self.assertEqual(state["stage"], STAGE_REVEAL)

    def test_a_wrong_guess_fills_the_say_what_pile(self):
        state = self.state
        result = play_round(state, guess_target=False)
        self.assertFalse(result["correct"])
        self.assertEqual(state["score"], 0)
        self.assertEqual(state["say_what"], [result["target"]])

    def test_a_split_vote_counts_as_a_failure(self):
        state = new_game(count=4, seed=3)
        sort_creation(state)
        communicator = state["communicator"]
        target = state["candidates"][0]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": target, "word": [_revealed_sound_ids(state)[0]]})
        others = [pid for pid in ids(state) if pid != communicator]
        picks = [image for image in state["candidates"] if image != target][:3]
        for pid, pick in zip(others, picks):
            act(state, pid, {"type": "guess", "turn": state["turn"], "image": pick})
        self.assertFalse(state["result"]["correct"])
        self.assertEqual(len(state["result"]["leaders"]), 3)

    def test_a_tied_top_vote_counts_as_a_failure(self):
        state = new_game(count=4, seed=5)
        sort_creation(state)
        communicator = state["communicator"]
        target = state["candidates"][0]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": target, "word": [_revealed_sound_ids(state)[0]]})
        others = [pid for pid in ids(state) if pid != communicator]
        decoy = state["candidates"][1]
        act(state, others[0], {"type": "guess", "turn": state["turn"], "image": target})
        act(state, others[1], {"type": "guess", "turn": state["turn"], "image": decoy})
        act(state, others[2], {"type": "guess", "turn": state["turn"], "image": decoy})
        self.assertFalse(state["result"]["correct"])

    def test_a_guess_may_be_changed_before_everyone_locks_in(self):
        state = self.state
        communicator = state["communicator"]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": state["candidates"][0],
                                  "word": [_revealed_sound_ids(state)[0]]})
        guesser = next(pid for pid in ids(state) if pid != communicator)
        act(state, guesser, {"type": "guess", "turn": state["turn"], "image": state["candidates"][1]})
        act(state, guesser, {"type": "guess", "turn": state["turn"], "image": state["candidates"][0]})
        self.assertEqual(state["guesses"][guesser], state["candidates"][0])
        self.assertEqual(state["stage"], STAGE_GUESS)

    def test_reveal_waits_for_every_player(self):
        state = self.state
        play_round(state)
        for pid in ids(state)[:-1]:
            act(state, pid, {"type": "continue", "turn": state["turn"]})
            self.assertEqual(state["stage"], STAGE_REVEAL)
        act(state, ids(state)[-1], {"type": "continue", "turn": state["turn"]})
        self.assertEqual(state["stage"], STAGE_SPEAK)
        self.assertEqual(state["round"], 2)

    def test_the_game_ends_after_everyone_has_named_once(self):
        state = self.state
        for _ in range(state["rounds_total"]):
            play_round(state, guess_target=True)
            finish_round(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["stage"], STAGE_GAME_OVER)
        self.assertEqual(state["score"], state["rounds_total"])
        self.assertEqual(len(state["say_what"]), 0)

    def test_two_say_what_cards_end_the_game_early(self):
        state = new_game(count=6, seed=11)
        sort_creation(state)
        for _ in range(SAY_WHAT_LIMIT):
            play_round(state, guess_target=False)
            finish_round(state)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["round"], SAY_WHAT_LIMIT)
        self.assertLess(state["round"], state["rounds_total"])

    def test_play_again_needs_the_whole_table(self):
        state = self.state
        for _ in range(state["rounds_total"]):
            play_round(state)
            finish_round(state)
        for pid in ids(state)[:-1]:
            act(state, pid, {"type": "play_again"})
            self.assertTrue(state["game_over"])
        act(state, ids(state)[-1], {"type": "play_again"})
        self.assertFalse(state["game_over"])
        self.assertEqual(state["stage"], STAGE_CREATE)
        self.assertEqual(state["score"], 0)
        self.assertEqual(len(state["table"]), CREATION_IMAGES)
        self.assertEqual(len(state["sounds"]), SOUNDS_IN_PLAY)


class DadadaPrivacyTests(unittest.TestCase):
    def setUp(self):
        self.state = new_game()
        sort_creation(self.state)

    def test_nobody_sees_the_target_before_the_communicator_speaks(self):
        state = self.state
        for pid in ids(state):
            self.assertIsNone(DadadaGame.get_public_view(state, pid)["target"])

    def test_only_the_communicator_sees_the_target_while_guessing(self):
        state = self.state
        communicator = state["communicator"]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": state["candidates"][0],
                                  "word": [_revealed_sound_ids(state)[0]]})
        for pid in ids(state):
            view = DadadaGame.get_public_view(state, pid)
            if pid == communicator:
                self.assertEqual(view["target"]["id"], state["candidates"][0])
            else:
                self.assertIsNone(view["target"])

    def test_guesses_stay_hidden_until_the_round_is_scored(self):
        state = self.state
        communicator = state["communicator"]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": state["candidates"][0],
                                  "word": [_revealed_sound_ids(state)[0]]})
        guesser = next(pid for pid in ids(state) if pid != communicator)
        act(state, guesser, {"type": "guess", "turn": state["turn"], "image": state["candidates"][1]})
        for pid in ids(state):
            view = DadadaGame.get_public_view(state, pid)
            self.assertEqual(view["guesses"], {})
            self.assertEqual(view["your_guess"], state["candidates"][1] if pid == guesser else None)

    def test_the_reveal_opens_the_target_and_every_guess(self):
        state = self.state
        play_round(state)
        for pid in ids(state):
            view = DadadaGame.get_public_view(state, pid)
            self.assertIsNotNone(view["target"])
            self.assertEqual(len(view["guesses"]), state["player_count"] - 1)
            self.assertIsNotNone(view["result"])

    def test_the_word_is_public_once_spoken(self):
        state = self.state
        communicator = state["communicator"]
        sounds = _revealed_sound_ids(state)
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": state["candidates"][0], "word": [sounds[0], sounds[0]]})
        for pid in ids(state):
            view = DadadaGame.get_public_view(state, pid)
            self.assertEqual(view["word"], [sounds[0], sounds[0]])
            self.assertEqual(len(view["word_label"].split("-")), 2)


class DadadaRejectionTests(unittest.TestCase):
    def test_stale_turn_actions_are_rejected(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        _, error = DadadaGame.apply_action(state, current, {
            "type": "propose", "turn": state["turn"] + 5, "image": state["table"][0],
            "sound": _revealed_sound_ids(state)[0]})
        self.assertEqual(error, "stale turn")

    def test_out_of_turn_actions_are_rejected(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        other = next(pid for pid in ids(state) if pid != current)
        _, error = DadadaGame.apply_action(state, other, {
            "type": "propose", "turn": state["turn"], "image": state["table"][0],
            "sound": _revealed_sound_ids(state)[0]})
        self.assertEqual(error, "action unavailable in this stage")

    def test_an_unknown_player_is_rejected(self):
        state = new_game()
        _, error = DadadaGame.apply_action(state, "ghost", {"type": "play_again"})
        self.assertEqual(error, "player not found")
        self.assertEqual(legal(state, "ghost"), [])

    def test_a_malformed_action_is_rejected(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        _, error = DadadaGame.apply_action(state, current, {"type": "propose"})
        self.assertEqual(error, "invalid action schema")
        _, error = DadadaGame.apply_action(state, current, "not a dict")
        self.assertEqual(error, "invalid action schema")

    def test_an_unknown_sound_is_rejected(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        unused = next(sound for sound in ("snd-40", "snd-39", "snd-38")
                      if sound not in _revealed_sound_ids(state))
        _, error = DadadaGame.apply_action(state, current, {
            "type": "propose", "turn": state["turn"], "image": state["table"][0], "sound": unused})
        self.assertEqual(error, "unknown sound card")


class DadadaSaveTests(unittest.TestCase):
    def _stages(self):
        creation = new_game()
        speaking = new_game()
        sort_creation(speaking)
        guessing = new_game()
        sort_creation(guessing)
        act(guessing, guessing["communicator"], {
            "type": "speak", "turn": guessing["turn"], "target": guessing["candidates"][0],
            "word": [_revealed_sound_ids(guessing)[0]]})
        reveal = new_game()
        sort_creation(reveal)
        play_round(reveal)
        over = new_game()
        sort_creation(over)
        for _ in range(over["rounds_total"]):
            play_round(over)
            finish_round(over)
        return {"create": creation, "speak": speaking, "guess": guessing,
                "reveal": reveal, "game_over": over}

    def test_saves_round_trip_at_every_stage(self):
        for name, state in self._stages().items():
            with self.subTest(stage=name):
                restored = DadadaGame.deserialize(DadadaGame.serialize(state))
                self.assertEqual(restored, state)

    def test_a_restored_game_keeps_playing(self):
        state = self._stages()["speak"]
        restored = DadadaGame.deserialize(DadadaGame.serialize(state))
        play_round(restored)
        self.assertEqual(restored["stage"], STAGE_REVEAL)
        self.assertEqual(restored["score"], 1)

    def test_a_tampered_payload_is_refused(self):
        state = self._stages()["speak"]
        for mutate in (
            lambda blob: blob.update({"game_id": "nope"}),
            lambda blob: blob.update({"version": 2}),
            lambda blob: blob.update({"player_count": 9}),
            lambda blob: blob.update({"score": -1}),
            lambda blob: blob.update({"say_what": ["img-001", "img-002", "img-003"]}),
            lambda blob: blob["placed"].update({blob["table"][0]: "snd-40"}),
            lambda blob: blob.update({"table": blob["table"][:3]}),
            lambda blob: blob.update({"guesses": {blob["turn_order"][0]: "img-001"}}),
            lambda blob: blob.update({"rng_state": "broken"}),
            lambda blob: blob.pop("sounds"),
        ):
            with self.subTest(mutate=mutate):
                blob = DadadaGame.serialize(state)
                mutate(blob)
                with self.assertRaises(ValueError):
                    DadadaGame.deserialize(blob)

    def test_a_save_never_shares_state_between_players(self):
        state = self._stages()["guess"]
        blob = DadadaGame.serialize(state)
        blob["players"][ids(state)[0]]["speaks"] = 99
        with self.assertRaises(ValueError):
            DadadaGame.deserialize(blob)


class DadadaBotTests(unittest.TestCase):
    def test_the_bot_acts_at_every_stage(self):
        state = new_game()
        seen = set()
        guard = 0
        while not state["game_over"] and guard < 3000:
            guard += 1
            moved = False
            for pid in ids(state):
                move = DadadaGame.bot_move(state, pid)
                if move is None:
                    continue
                self.assertIn(move["type"], legal(state, pid), f"illegal bot move {move}")
                act(state, pid, move)
                seen.add(state["stage"])
                moved = True
            self.assertTrue(moved or state["game_over"], f"bots stalled at {state['stage']}")
        self.assertTrue(state["game_over"])
        self.assertTrue({STAGE_CREATE, STAGE_SPEAK, STAGE_GUESS, STAGE_REVEAL} <= seen)

    def test_a_bot_that_already_guessed_stops_guessing(self):
        """The room bot runner takes the first bot with a legal action, so a bot
        that keeps re-guessing starves the rest of the table forever."""
        state = new_game()
        sort_creation(state)
        communicator = state["communicator"]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": state["candidates"][0],
                                  "word": [_revealed_sound_ids(state)[0]]})
        guesser = next(pid for pid in ids(state) if pid != communicator)
        act(state, guesser, {"type": "guess", "turn": state["turn"],
                             "image": state["candidates"][1]})
        # The human-facing view still offers "guess" so a pick can be changed...
        self.assertEqual(legal(state, guesser), ["guess"])
        # ...but the bot policy must stay quiet once it has picked.
        self.assertIsNone(DadadaGame.bot_move(state, guesser))
        other = next(pid for pid in ids(state) if pid not in (communicator, guesser))
        self.assertIsNotNone(DadadaGame.bot_move(state, other))

    def test_the_bot_returns_none_when_it_cannot_act(self):
        state = new_game()
        current = state["turn_order"][state["turn_index"]]
        other = next(pid for pid in ids(state) if pid != current)
        self.assertIsNone(DadadaGame.bot_move(state, other))
        self.assertIsNone(DadadaGame.bot_move(state, "ghost"))

    def test_a_bot_never_sees_more_than_a_human(self):
        state = new_game()
        sort_creation(state)
        communicator = state["communicator"]
        act(state, communicator, {"type": "speak", "turn": state["turn"],
                                  "target": state["candidates"][0],
                                  "word": [_revealed_sound_ids(state)[0]]})
        guesser = next(pid for pid in ids(state) if pid != communicator)
        view = DadadaGame.get_public_view(state, guesser)
        self.assertIsNone(view["target"])
        self.assertEqual(view["guesses"], {})

    def test_all_bot_games_finish_for_every_player_count(self):
        for count in range(2, 7):
            with self.subTest(players=count):
                state = DadadaGame.init_game({"seed": count}, [
                    dict(player, is_bot=True) for player in make_players(count)])
                guard = 0
                while not state["game_over"] and guard < 4000:
                    guard += 1
                    for pid in ids(state):
                        move = DadadaGame.bot_move(state, pid)
                        if move is not None:
                            act(state, pid, move)
                self.assertTrue(state["game_over"], f"bot game stalled at {state['stage']}")


class DadadaRandomGameTests(unittest.TestCase):
    def test_random_games_always_terminate(self):
        for count in range(2, 7):
            for seed in range(4):
                with self.subTest(players=count, seed=seed):
                    state = DadadaGame.init_game({"seed": seed}, make_players(count))
                    rng = random.Random(seed)
                    guard = 0
                    while not state["game_over"] and guard < 4000:
                        guard += 1
                        actors = [pid for pid in ids(state) if legal(state, pid)]
                        self.assertTrue(actors, f"deadlock at {state['stage']}")
                        pid = rng.choice(actors)
                        kind = rng.choice(legal(state, pid))
                        turn = state["turn"]
                        if kind == "propose":
                            move = {"type": "propose", "turn": turn,
                                    "image": rng.choice(_unassigned(state)),
                                    "sound": rng.choice(_revealed_sound_ids(state))}
                        elif kind == "speak":
                            sounds = _revealed_sound_ids(state)
                            move = {"type": "speak", "turn": turn,
                                    "target": rng.choice(state["candidates"]),
                                    "word": [rng.choice(sounds) for _ in range(rng.randint(1, 3))]}
                        elif kind == "guess":
                            move = {"type": "guess", "turn": turn,
                                    "image": rng.choice(state["candidates"])}
                        elif kind == "continue":
                            move = {"type": "continue", "turn": turn}
                        else:
                            move = {"type": "play_again"}
                        act(state, pid, move)
                        for viewer in ids(state):
                            DadadaGame.get_public_view(state, viewer)
                    self.assertTrue(state["game_over"])

    def test_pictures_are_conserved(self):
        state = new_game()
        sort_creation(state)
        for _ in range(state["rounds_total"]):
            play_round(state)
            finish_round(state)
        scored = state["defined"] + state["say_what"]
        leftover = [image for image in state["candidates"] if image not in scored]
        seen = (list(state["image_deck"]) + list(state["discard"])
                + list(state["placed"]) + scored + leftover)
        self.assertEqual(sorted(seen), sorted(IMAGE_IDS))
        self.assertEqual(len(seen), len(set(seen)))

    def test_the_log_never_grows_without_bound(self):
        state = new_game()
        sort_creation(state)
        for _ in range(state["rounds_total"]):
            play_round(state)
            finish_round(state)
        self.assertLessEqual(len(state["log"]), 60)

    def test_every_view_is_json_serialisable(self):
        import json
        state = new_game()
        sort_creation(state)
        play_round(state)
        for pid in ids(state):
            json.dumps(DadadaGame.get_public_view(state, pid))
        spectator = DadadaGame.get_public_view(state, "ghost")
        json.dumps(spectator)
        self.assertEqual(spectator["you"], "ghost")
        self.assertEqual(spectator["legal_actions"], [])


if __name__ == "__main__":
    unittest.main()
