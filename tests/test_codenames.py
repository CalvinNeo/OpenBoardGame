import copy
import json
import random
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

import app
from game.codenames import CodenamesGame as Game, _vocabulary
from tests.test_room_session import DummySio


def players(count=4):
    names = ["Alex", "Morgan", "Jamie", "Riley", "Casey", "Sam", "Robin", "Taylor"]
    return [{"player_id": f"person-{index}", "name": names[index % len(names)], "seat": index} for index in range(count)]


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "revision": state["revision"], **fields}


def start_game(count=4, language="zh"):
    state = Game.init_game({}, players(count))
    state["language"] = language
    with patch("game.codenames.secrets.SystemRandom", return_value=random.Random(41)):
        events, error = Game.apply_action(state, state["host"], action(state, "begin"))
    if error:
        raise AssertionError(error)
    return state


def actor(state, role, team=None):
    team = team or state["active_team"]
    return next(player_id for player_id, member in state["players"].items() if member["team"] == team and member["role"] == role)


class CodenamesTests(unittest.TestCase):
    def setUp(self):
        self.state = start_game()

    def play(self, player_id, kind, **fields):
        events, error = Game.apply_action(self.state, player_id, action(self.state, kind, **fields))
        self.assertIsNone(error)
        self.assertTrue(events)

    def clue(self, number=2):
        self.play(actor(self.state, "spymaster"), "clue", word="联想", number=number)

    def guess(self, identity):
        index = next(index for index, card in enumerate(self.state["board"]) if card["identity"] == identity and not card["revealed"])
        self.play(actor(self.state, "operative"), "guess", index=index)

    def rejected(self, player_id, payload):
        before = copy.deepcopy(self.state)
        events, error = Game.apply_action(self.state, player_id, payload)
        self.assertEqual(events, [])
        self.assertTrue(error)
        self.assertEqual(self.state, before)

    def test_player_counts_seats_and_setup(self):
        for count in range(4, 9):
            state = Game.init_game({}, list(reversed(players(count))))
            self.assertEqual(list(state["players"]), [member["player_id"] for member in players(count)])
            self.assertEqual(state["phase"], "setup")
            self.assertEqual(state["board"], [])
            self.assertTrue(Game.get_public_view(state, state["host"])["teams_valid"])
            self.assertEqual(Game.deserialize(Game.serialize(state)), state)
        for count in (0, 1, 2, 3, 9):
            with self.assertRaises(ValueError):
                Game.init_game({}, players(count))
        with self.assertRaises(ValueError):
            Game.init_game({}, [players()[0]] * 4)
        with self.assertRaises(ValueError):
            Game.init_game({"seed": 123}, players())

    def test_role_and_host_validation(self):
        self.state = Game.init_game({}, players())
        self.rejected("person-2", action(self.state, "choose_role", team="red", role="spymaster"))
        self.rejected("person-2", action(self.state, "begin"))
        self.rejected("person-2", action(self.state, "language", language="en"))
        self.play("person-0", "choose_role", team="blue", role="operative")
        self.rejected("person-0", action(self.state, "begin"))
        self.play("person-2", "choose_role", team="red", role="spymaster")
        self.rejected("person-0", action(self.state, "begin"))
        self.play("person-0", "choose_role", team="red", role="operative")
        self.play("person-0", "language", language="en")
        self.play("person-0", "begin")
        self.assertTrue(all(card["word"].isascii() for card in self.state["board"]))
        self.rejected("person-0", action(self.state, "choose_role", team="blue", role="operative"))

    def test_board_distribution_and_vocabulary(self):
        for language in ("zh", "en"):
            state = start_game(language=language)
            self.assertEqual(len({card["word"] for card in state["board"]}), 25)
            first = state["starting_team"]
            self.assertEqual(sum(card["identity"] == first for card in state["board"]), 9)
            self.assertEqual(sum(card["identity"] == "neutral" for card in state["board"]), 7)
            self.assertEqual(sum(card["identity"] == "assassin" for card in state["board"]), 1)
            self.assertEqual(len({entry[language] for entry in _vocabulary()}), len(_vocabulary()))

    def test_hidden_key_and_detached_views(self):
        for viewer in ("visitor", "person-2", "person-3"):
            view = Game.get_public_view(self.state, viewer)
            self.assertTrue(all(card["identity"] is None for card in view["board"]))
            self.assertNotIn("tags", json.dumps(view))
            view["board"][0]["word"] = "mutated"
            self.assertNotEqual(self.state["board"][0]["word"], "mutated")
        for viewer in ("person-0", "person-1"):
            self.assertTrue(all(card["identity"] is not None for card in Game.get_public_view(self.state, viewer)["board"]))
        self.clue()
        self.guess("neutral")
        view = Game.get_public_view(self.state, "visitor")
        self.assertEqual(sum(card["identity"] is not None for card in view["board"]), 1)

    def test_clue_rules_and_stale_actions(self):
        master = actor(self.state, "spymaster")
        word = self.state["board"][0]["word"]
        for clue in ("", "two words", "123", "hello!", "\n", "a" * 33, word, word[:1], "新" + word, "测\u200b试"):
            self.rejected(master, action(self.state, "clue", word=clue, number=1))
        for number in (True, 1.5, -1, 10, "1"):
            self.rejected(master, action(self.state, "clue", word="联想", number=number))
        stale = action(self.state, "clue", word="联想", number=1)
        self.clue()
        self.rejected(master, stale)
        self.rejected(master, {**stale, "game_token": "different-game"})
        self.rejected("visitor", action(self.state, "guess", index=0))
        self.rejected(master, action(self.state, "guess", index=0))
        operative = actor(self.state, "operative")
        self.rejected(operative, action(self.state, "guess", index=True))
        self.rejected(operative, action(self.state, "guess", index=0, word="extra"))

    def test_guess_count_and_next_round_barrier(self):
        self.clue(1)
        operative = actor(self.state, "operative")
        self.rejected(operative, action(self.state, "end_turn"))
        team = self.state["active_team"]
        self.guess(team)
        self.assertEqual(self.state["phase"], "guess")
        self.guess(team)
        self.assertEqual(self.state["phase"], "turn_end")
        for player_id in list(self.state["players"])[:-1]:
            self.play(player_id, "next_round")
            self.assertEqual(self.state["active_team"], team)
            self.assertEqual(self.state["phase"], "turn_end")
        self.rejected("person-0", action(self.state, "next_round"))
        self.play("person-3", "next_round")
        self.assertNotEqual(self.state["active_team"], team)
        self.assertEqual(self.state["turn"], 2)
        self.assertIsNone(self.state["clue"])

    def test_neutral_opponent_and_voluntary_end(self):
        for identity in ("neutral", "red", "blue"):
            self.state = start_game()
            self.clue()
            team = self.state["active_team"]
            before = Game.get_public_view(self.state, "visitor")["remaining"]
            self.guess(identity)
            self.assertEqual(self.state["phase"], "guess" if identity == team else "turn_end")
            after = Game.get_public_view(self.state, "visitor")["remaining"]
            if identity in before:
                self.assertEqual(after[identity], before[identity] - 1)
            if identity == team:
                self.play(actor(self.state, "operative"), "end_turn")
                self.assertEqual(self.state["phase"], "turn_end")

    def test_zero_and_unlimited(self):
        for number in (0, "unlimited"):
            self.state = start_game()
            self.clue(number)
            self.assertIsNone(self.state["guess_limit"])
            for count in range(3):
                self.guess(self.state["active_team"])
            self.assertEqual(self.state["phase"], "guess")

    def test_assassin_result_and_confirmation_gate(self):
        self.clue()
        losing = self.state["active_team"]
        self.guess("assassin")
        self.assertNotEqual(self.state["winning_team"], losing)
        self.assertFalse(self.state["game_over"])
        self.assertEqual(self.state["phase"], "result")
        self.assertTrue(all(card["identity"] for card in Game.get_public_view(self.state, "visitor")["board"]))
        self.assertEqual(Game.deserialize(Game.serialize(self.state)), self.state)
        for player_id in self.state["players"]:
            self.play(player_id, "confirm_result")
        self.assertTrue(self.state["game_over"])
        self.assertEqual(Game.get_legal_actions(self.state, "person-0"), [])
        self.assertEqual(Game.deserialize(Game.serialize(self.state)), self.state)

    def test_last_agent_wins_even_for_opponent(self):
        for winning in ("red", "blue"):
            self.state = start_game()
            self.clue("unlimited")
            cards = [card for card in self.state["board"] if card["identity"] == winning]
            for card in cards[:-1]:
                card["revealed"] = True
            self.guess(winning)
            self.assertEqual(self.state["winning_team"], winning)
            self.assertEqual(self.state["end_reason"], "all_agents")

    def test_serialization_phases_and_invalid_saves(self):
        self.assertEqual(Game.deserialize(Game.serialize(self.state)), self.state)
        self.clue()
        self.assertEqual(Game.deserialize(Game.serialize(self.state)), self.state)
        self.guess("neutral")
        self.assertEqual(Game.deserialize(Game.serialize(self.state)), self.state)
        payload = Game.serialize(self.state)
        for key, value in (("version", 2), ("config", {"seed": 42}), ("phase", "other"), ("revision", True), ("confirmations", ["outsider"]), ("game_over", True), ("clue", {"word": "x", "number": True}), ("history", [{"type": "guess"}])):
            with self.subTest(key=key), self.assertRaises(ValueError):
                Game.deserialize({**payload, key: value})
        for key, value in (("word", "not-in-deck"), ("identity", "assassin"), ("revealed", 1)):
            corrupted = copy.deepcopy(payload)
            corrupted["board"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                Game.deserialize(corrupted)

    def test_revealed_word_is_available_as_clue(self):
        self.clue()
        self.guess("neutral")
        word = next(card["word"] for card in self.state["board"] if card["revealed"])
        for player_id in self.state["players"]:
            self.play(player_id, "next_round")
        self.play(actor(self.state, "spymaster"), "clue", word=word, number=1)
        self.assertEqual(self.state["clue"]["word"], word)

    def test_validation_cannot_be_bypassed_and_repeated_guess_is_rejected(self):
        self.clue()
        operative = actor(self.state, "operative")
        self.guess(self.state["active_team"])
        revealed = next(index for index, card in enumerate(self.state["board"]) if card["revealed"])
        self.rejected(operative, action(self.state, "guess", index=revealed))
        other = next(player_id for player_id, member in self.state["players"].items() if member["team"] != self.state["active_team"] and member["role"] == "operative")
        self.rejected(other, action(self.state, "guess", index=0))

    def test_bot_operative_cannot_see_key(self):
        self.clue()
        operative = actor(self.state, "operative")
        alternative = copy.deepcopy(self.state)
        identities = [card["identity"] for card in alternative["board"]][::-1]
        for card, identity in zip(alternative["board"], identities):
            card["identity"] = identity
        with patch("game.codenames.secrets.choice", side_effect=lambda choices: choices[0]):
            self.assertEqual(Game.bot_move(self.state, operative), Game.bot_move(alternative, operative))

    def test_bot_games_complete_and_roundtrip(self):
        for language in ("zh", "en"):
            state = start_game(8, language)
            for step in range(800):
                self.assertEqual(Game.deserialize(Game.serialize(state)), state)
                if state["game_over"]:
                    break
                moved = False
                for player_id in state["players"]:
                    move = Game.bot_move(state, player_id)
                    if move:
                        events, error = Game.apply_action(state, player_id, move)
                        self.assertIsNone(error)
                        moved = True
                        break
                self.assertTrue(moved)
            self.assertTrue(state["game_over"])


class CodenamesIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.original_sio, self.original_data = app.sio, app.DATA_DIR
        self.original_rooms, self.original_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("alex", {"name": "Alex", "game_type": "codenames"})
        self.room = app.ROOMS[app.SESSIONS["alex"]["room_id"]]
        for socket_id, name in (("morgan", "Morgan"), ("jamie", "Jamie"), ("riley", "Riley")):
            await app.on_room_join(socket_id, {"room_id": self.room.room_id, "name": name})
        for member in self.room.players:
            member.ready = True
        await app.on_room_start("alex", {})
        state = self.room.game_state
        await app.on_game_action("alex", {"action": action(state, "begin")})

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.original_sio, self.original_data
        app.ROOMS.clear()
        app.ROOMS.update(self.original_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.original_sessions)
        self.temp.cleanup()

    async def test_catalog_and_private_recipient_views(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "codenames")
        self.assertEqual((row["name_zh"], row["min_players"], row["max_players"]), ("行动代号", 4, 8))
        self.assertTrue(row["has_strategic_ai"])
        self.assertIn("creative", {tag["id"] for tag in row["tags"]})
        app.sio.emits.clear()
        await app._emit_game_state(self.room)
        messages = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(len(messages), 4)
        for message in messages:
            visible = message["to"] in ("alex", "morgan")
            self.assertTrue(all((card["identity"] is not None) == visible for card in message["payload"]["view"]["board"]))

    async def test_active_save_download_and_load_are_blocked(self):
        self.room.auto_save = True
        app._save_room_state(self.room)
        for cold in (False, True):
            if cold:
                app.ROOMS.clear()
            with self.assertRaises(HTTPException) as caught:
                await app.download_room_save(self.room.room_id)
            self.assertEqual(caught.exception.status_code, 403)
            await app.on_room_load("outsider", {"source_room_id": self.room.room_id})
            self.assertFalse(app.sio.emits[-1]["payload"]["ok"])

    async def test_cold_reconnect_preserves_role_and_auth(self):
        self.room.auto_save = True
        app._save_room_state(self.room)
        member = self.room.players[2]
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_reconnect("wrong", {"room_id": self.room.room_id, "player_id": member.player_id, "reconnect_token": "wrong"})
        self.assertNotIn("wrong", app.SESSIONS)
        await app.on_room_reconnect("restored", {"room_id": self.room.room_id, "player_id": member.player_id, "reconnect_token": member.reconnect_token})
        self.assertEqual(app.SESSIONS["restored"]["player_id"], member.player_id)
        messages = [entry for entry in app.sio.emits if entry["event"] == "game:state" and entry["to"] == "restored"]
        self.assertTrue(all(card["identity"] is None for card in messages[-1]["payload"]["view"]["board"]))

    async def test_result_requires_every_confirmation_before_restart(self):
        state = self.room.game_state
        master = actor(state, "spymaster")
        operative = actor(state, "operative")
        master_socket = next(member.socket_id for member in self.room.players if member.player_id == master)
        operative_socket = next(member.socket_id for member in self.room.players if member.player_id == operative)
        await app.on_game_action(master_socket, {"action": action(state, "clue", word="联想", number=1)})
        index = next(index for index, card in enumerate(state["board"]) if card["identity"] == "assassin")
        await app.on_game_action(operative_socket, {"action": action(state, "guess", index=index)})
        self.assertEqual(self.room.status, "in_game")
        token = state["game_token"]
        await app.on_room_start("alex", {})
        self.assertEqual(self.room.game_state["game_token"], token)
        for member in self.room.players:
            await app.on_game_action(member.socket_id, {"action": action(state, "confirm_result")})
        self.assertEqual(self.room.status, "game_over")
        await app.on_room_start("alex", {})
        self.assertEqual(self.room.game_state["phase"], "setup")
        self.assertNotEqual(self.room.game_state["game_token"], token)

    async def test_bot_final_confirmation_notifies_room_controls(self):
        state = self.room.game_state
        master, operative = actor(state, "spymaster"), actor(state, "operative")
        Game.apply_action(state, master, action(state, "clue", word="联想", number=1))
        index = next(index for index, card in enumerate(state["board"]) if card["identity"] == "assassin")
        Game.apply_action(state, operative, action(state, "guess", index=index))
        bot = self.room.players[-1]
        for member in self.room.players[:-1]:
            Game.apply_action(state, member.player_id, action(state, "confirm_result"))
        bot.is_bot = True
        app.sio.emits.clear()
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app._maybe_run_bots(self.room)
        await runners[0]
        self.assertEqual(self.room.status, "game_over")
        notifications = [entry for entry in app.sio.emits if entry["event"] == "room:state"]
        self.assertTrue(any(entry["payload"]["status"] == "game_over" for entry in notifications))

    async def test_server_rejects_wrong_role_even_with_schema_checks_disabled(self):
        before = copy.deepcopy(self.room.game_state)
        for skip in (False, True):
            await app.on_game_action("jamie", {"action": action(self.room.game_state, "clue", word="联想", number=1), "skip_validation": skip})
            self.assertEqual(self.room.game_state, before)


if __name__ == "__main__":
    unittest.main()
