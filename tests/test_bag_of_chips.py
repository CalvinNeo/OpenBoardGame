import asyncio
import copy
import itertools
import json
import random
import unittest
from collections import Counter
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import HTTPException

import app
from game.bag_of_chips import (
    ACTION_SCHEMA, CATALOG, COLORS, OBJECTIVES, TOTALS, BagOfChipsGame as Game,
    _settle, expected_objectives, objective_value,
)
from game.registry import get_game
from jsonschema import Draft7Validator
from tests.test_room_session import DummySio


def players(count=3):
    return [{"player_id": f"player-{index}", "name": ["Alice", "Bob", "Carol", "Daria", "Evan", "Faye"][index],
             "seat": index} for index in range(count)]


def new_game(count=3, seed=17):
    return Game.init_game({"seed": seed}, players(count))


def action(state, kind, **kwargs):
    return {"type": kind, "round": state["round"], "step": state["step"], **kwargs}


def move_all(state, kind):
    for player_id in state["turn_order"]:
        payload = action(state, kind)
        if kind in ("discard", "place"):
            amount = 2 if kind == "discard" and state["phase"] == 1 else 1
            payload["cards"] = state["players"][player_id]["hand"][:amount]
        events, error = Game.apply_action(state, player_id, payload)
        if error:
            raise AssertionError(error)


def score_fixture(count=3):
    state = new_game(count)
    state["drawn"] = ["yellow"] * 5 + ["orange"] * 4 + ["red"] * 3 + ["green"] * 2
    for player in state["players"].values():
        player.update(negative=23, positive=[1, 25])
    return state


class BagOfChipsTests(unittest.TestCase):
    def test_catalog_registration_and_components(self):
        definition = get_game("bag_of_chips")
        self.assertIs(definition.module, Game)
        self.assertEqual((definition.min_players, definition.max_players), (2, 6))
        self.assertEqual(len(OBJECTIVES), 36)
        self.assertEqual(sum(TOTALS.values()), 25)
        self.assertEqual(len({card["id"] for card in CATALOG["objectives"]}), 36)

    def test_setup_every_player_count_and_seed(self):
        for count in range(2, 7):
            state = new_game(count)
            self.assertEqual(state, new_game(count))
            self.assertEqual(len(state["drawn"]), 5)
            self.assertEqual(Counter(state["bag"] + state["drawn"]), Counter(TOTALS))
            hands = list(itertools.chain.from_iterable(player["hand"] for player in state["players"].values()))
            self.assertEqual(len(hands), count * 6)
            self.assertEqual(len(set(hands)), len(hands))
            self.assertEqual(state["target"], 3 if count == 2 else 4)
        for count in (1, 7):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": str(index)} for index in range(count)])
        for config in (False, [], {"seed": True}, {"edition": "2026"}):
            with self.assertRaises(ValueError):
                Game.init_game(config, players())

    def test_all_objective_families(self):
        counts = {"yellow": 4, "orange": 4, "red": 3, "green": 2, "purple": 1}
        for card_id, last, expected in [(1, "yellow", (True, 1)), (2, "yellow", (False, 0)),
                                        (3, "red", (True, 4)), (6, "red", (False, 0)),
                                        (11, "red", (True, 25)), (12, "red", (False, 0)),
                                        (18, "yellow", (True, 61)), (18, "red", (False, 0)),
                                        (23, "red", (False, 0)), (25, "red", (True, 20)),
                                        (30, "red", (False, 0)), (36, "red", (False, 0))]:
            with self.subTest(card_id=card_id):
                self.assertEqual(objective_value(OBJECTIVES[card_id], counts, last), expected)
        self.assertEqual(objective_value(OBJECTIVES[14], {}, "yellow"), (True, 40))
        self.assertEqual(objective_value(OBJECTIVES[23], {}, "yellow"), (True, 201))
        self.assertEqual(objective_value(OBJECTIVES[30], {"orange": 1}, "orange"), (True, 45))

    def test_phase_flow_private_submissions_and_final_chip(self):
        state = new_game()
        player_id = state["turn_order"][0]
        first = action(state, "discard", cards=state["players"][player_id]["hand"][:2])
        self.assertIsNone(Game.apply_action(state, player_id, first)[1])
        self.assertEqual(len(state["drawn"]), 5)
        self.assertEqual(Game.get_legal_actions(state, player_id), [])
        view = Game.get_public_view(state, state["turn_order"][1])
        opponent = view["players"][0]
        self.assertEqual(opponent["hand"], [])
        self.assertEqual(opponent["discarded"], [])
        self.assertNotIn("bag", view)
        self.assertNotIn("random_state", view)
        for other in state["turn_order"][1:]:
            Game.apply_action(state, other, action(state, "discard", cards=state["players"][other]["hand"][:2]))
        self.assertEqual((state["phase"], len(state["drawn"])), (2, 9))
        move_all(state, "discard")
        self.assertEqual((state["phase"], len(state["drawn"])), (3, 12))
        Game.apply_action(state, player_id, action(state, "place", cards=state["players"][player_id]["hand"][:1]))
        opponent = Game.get_public_view(state, state["turn_order"][1])["players"][0]
        self.assertIsNone(opponent["negative"])
        self.assertEqual(opponent["positive"], [])
        for other in state["turn_order"][1:]:
            Game.apply_action(state, other, action(state, "place", cards=state["players"][other]["hand"][:1]))
        self.assertEqual((state["stage"], len(state["drawn"])), ("reveal", 13))
        self.assertTrue(Game.get_public_view(state, "spectator")["players"][0]["negative"])
        Game.apply_action(state, player_id, action(state, "reveal_last"))
        self.assertEqual(len(state["drawn"]), 13)
        for other in state["turn_order"][1:]:
            Game.apply_action(state, other, action(state, "reveal_last"))
        self.assertEqual(len(state["drawn"]), 14)
        self.assertEqual(state["stage"], "round_over")
        self.assertEqual(len(state["summary"]["rows"]), 3)
        self.assertTrue(all(len(row["cards"]) == 3 for row in state["summary"]["rows"]))

    def test_invalid_actions_are_atomic_even_without_outer_schema(self):
        state = new_game()
        player_id = state["turn_order"][0]
        hand = state["players"][player_id]["hand"]
        invalid = [None, [], {}, action(state, "place", cards=hand[:1]), action(state, "discard", cards=hand[:1]),
                   action(state, "discard", cards=[hand[0], hand[0]]), action(state, "discard", cards=[True, hand[0]]),
                   action(state, "discard", cards=[99, hand[0]]), action(state, "discard", cards=[1.5, hand[0]]),
                   {**action(state, "discard", cards=hand[:2]), "step": state["step"] - 1},
                   {**action(state, "discard", cards=hand[:2]), "extra": "bad"}]
        for payload in invalid:
            with self.subTest(payload=payload):
                before = copy.deepcopy(state)
                self.assertIsNotNone(Game.apply_action(state, player_id, payload)[1])
                self.assertEqual(before, state)
        self.assertIsNotNone(Game.apply_action(state, "outsider", action(state, "discard", cards=hand[:2]))[1])

    def test_replayed_and_stale_actions(self):
        state = new_game()
        player_id = state["turn_order"][0]
        payload = action(state, "discard", cards=state["players"][player_id]["hand"][:2])
        Game.apply_action(state, player_id, payload)
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, player_id, payload)[1])
        self.assertEqual(state, before)
        for other in state["turn_order"][1:]:
            Game.apply_action(state, other, action(state, "discard", cards=state["players"][other]["hand"][:2]))
        self.assertIsNotNone(Game.apply_action(state, player_id, payload)[1])

    def test_public_view_and_serialization_are_detached(self):
        state = new_game()
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, state["turn_order"][0])
        view["players"][0]["hand"][0]["points"] = -100
        payload = Game.serialize(state)
        payload["bag"].clear()
        self.assertEqual(state, before)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        move_all(state, "discard")
        move_all(restored, "discard")
        self.assertEqual(json.dumps(state, sort_keys=True), json.dumps(restored, sort_keys=True))

    def test_scoring_tied_first_and_second(self):
        state = score_fixture()
        _settle(state)
        self.assertEqual([row["awarded"] for row in state["summary"]["rows"]], [2, 2, 2])
        self.assertEqual([row["score"] for row in state["summary"]["rows"]], [-176] * 3)
        state = score_fixture()
        state["players"]["player-0"].update(negative=1, positive=[25, 26])
        _settle(state)
        self.assertEqual([row["awarded"] for row in state["summary"]["rows"]], [2, 1, 1])

    def test_two_player_rewards_and_tie_continues(self):
        state = score_fixture(2)
        for player in state["players"].values():
            player["rewards"] = 2
        _settle(state)
        self.assertEqual([row["awarded"] for row in state["summary"]["rows"]], [1, 1])
        self.assertEqual(state["winners"], [])
        self.assertEqual(state["stage"], "round_over")

    def test_reward_tie_uses_final_score(self):
        state = score_fixture()
        state["players"]["player-0"].update(rewards=2, negative=1, positive=[25, 26])
        state["players"]["player-1"]["rewards"] = 3
        _settle(state)
        self.assertEqual(state["winners"], ["player-0"])
        self.assertEqual(state["stage"], "final_review")

    def test_special_positive_and_negative(self):
        for negative in (True, False):
            state = score_fixture()
            state["drawn"] = ["purple"] * 3 + ["yellow"] * 2 + ["orange"] * 4 + ["red"] * 3 + ["green"] * 2
            state["players"]["player-0"].update(negative=36 if negative else 1,
                                                   positive=[25, 26] if negative else [36, 25])
            _settle(state)
            row = state["summary"]["rows"][0]
            if negative:
                self.assertTrue(row["lost"])
                self.assertEqual(row["awarded"], 0)
                self.assertTrue(all(item["skipped"] and item["points"] == 0 for item in row["cards"][1:]))
                self.assertEqual(state["winners"], [])
            else:
                self.assertEqual(state["winners"], ["player-0"])
                self.assertTrue(state["summary"]["instant"])

    def test_round_pause_and_final_review_gate(self):
        state = score_fixture()
        _settle(state)
        Game.apply_action(state, "player-0", action(state, "next_round"))
        self.assertEqual(state["round"], 1)
        for player_id in ("player-1", "player-2"):
            Game.apply_action(state, player_id, action(state, "next_round"))
        self.assertEqual((state["round"], state["stage"]), (2, "discard"))
        state = score_fixture(2)
        state["players"]["player-0"].update(rewards=2, negative=1, positive=[25, 26])
        _settle(state)
        self.assertEqual(state["stage"], "final_review")
        self.assertFalse(state["game_over"])
        self.assertNotIn("play_again", Game.get_legal_actions(state, "player-0"))
        move_all(state, "confirm_end")
        self.assertTrue(state["game_over"])
        self.assertEqual(Game.get_legal_actions(state, "player-0"), ["play_again"])
        old = action(state, "play_again")
        self.assertIsNone(Game.apply_action(state, "player-0", old)[1])
        self.assertEqual(state["stage"], "discard")
        self.assertEqual(state["history"], [])
        self.assertIsNotNone(Game.apply_action(state, "player-0", old)[1])

    def test_exact_expectations_match_ordered_final_draws(self):
        observed = (4, 3, 2, 2, 1)
        estimates = expected_objectives(observed)
        bag = [color for index, color in enumerate(COLORS) for unused in range(TOTALS[color] - observed[index])]
        for card_id in OBJECTIVES:
            success_sum = 0
            point_sum = 0
            outcomes = 0
            for first_index, second_index in itertools.permutations(range(len(bag)), 2):
                counts = Counter(dict(zip(COLORS, observed)))
                counts.update([bag[first_index], bag[second_index]])
                success, points = objective_value(OBJECTIVES[card_id], counts, bag[second_index])
                success_sum += success
                point_sum += points
                outcomes += 1
            self.assertAlmostEqual(estimates[card_id][0], success_sum / outcomes)
            self.assertAlmostEqual(estimates[card_id][1], point_sum / outcomes)

    def test_bot_does_not_use_unseen_bag_or_other_hands(self):
        state = new_game()
        player_id = "player-0"
        expected = Game.bot_move(state, player_id)
        altered = copy.deepcopy(state)
        random.Random(400).shuffle(altered["bag"])
        altered["players"]["player-1"]["hand"] = list(reversed(altered["players"]["player-1"]["hand"]))
        self.assertEqual(Game.bot_move(altered, player_id), expected)

    def test_bot_games_finish_with_valid_schema_actions(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        for count in (2, 3, 6):
            state = new_game(count)
            for turn in range(300):
                for player_id in state["turn_order"]:
                    payload = Game.bot_move(state, player_id)
                    if payload:
                        self.assertTrue(validator.is_valid(payload), payload)
                        self.assertIsNone(Game.apply_action(state, player_id, payload)[1])
                if state["game_over"]:
                    break
            self.assertTrue(state["game_over"])
            self.assertEqual(len(state["winners"]), 1)


class BagOfChipsIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("alice", {"name": "Alice", "game_type": "bag_of_chips"})
        self.room = app.ROOMS[app.SESSIONS["alice"]["room_id"]]
        await app.on_room_join("bob", {"room_id": self.room.room_id, "name": "Bob"})
        for player in self.room.players:
            player.ready = True
        await app.on_room_start("alice", {"config": {"seed": 17}})

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def test_catalog_views_and_redacted_bot_actions(self):
        catalog = next(row for row in await app.api_list_games() if row["game_id"] == "bag_of_chips")
        self.assertTrue(catalog["has_strategic_ai"])
        self.assertEqual(catalog["name_zh"], "来包洋芋片")
        app.sio.emits.clear()
        await app._emit_game_state(self.room)
        messages = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(len(messages), 2)
        for entry in messages:
            viewer = app.SESSIONS[entry["to"]]["player_id"]
            for player in entry["payload"]["view"]["players"]:
                self.assertEqual(len(player["hand"]), 6 if player["player_id"] == viewer else 0)
        self.assertEqual(app._public_bot_action("bag_of_chips", {"type": "place", "cards": [36]}), {"type": "place"})
        self.room.game_config = {"seed": 17}
        app.sio.emits.clear()
        await app._emit_room_state(self.room)
        self.assertNotIn("seed", app.sio.emits[-1]["payload"]["game_config"])

    async def test_validation_bypass_and_duplicate_submission(self):
        state = self.room.game_state
        player_id = self.room.players[0].player_id
        for skip in (True, False):
            before = copy.deepcopy(state)
            await app.on_game_action("alice", {"skip_validation": skip, "action": action(state, "discard", cards=[True, 7])})
            self.assertEqual(state, before)
            self.assertEqual(app.sio.emits[-1]["event"], "system:error")
        payload = action(state, "discard", cards=state["players"][player_id]["hand"][:2])
        await app.on_game_action("alice", {"action": payload})
        before = copy.deepcopy(state)
        await app.on_game_action("alice", {"action": payload})
        self.assertEqual(state, before)

    async def test_protected_save_and_cold_authenticated_reconnect(self):
        self.room.auto_save = True
        app._save_room_state(self.room)
        with self.assertRaises(HTTPException) as caught:
            await app.download_room_save(self.room.room_id)
        self.assertEqual(caught.exception.status_code, 403)
        player = self.room.players[1]
        saved = json.dumps(self.room.game_state, sort_keys=True)
        app.ROOMS.clear()
        app.SESSIONS.clear()
        with self.assertRaises(HTTPException):
            await app.download_room_save(self.room.room_id)
        await app.on_room_load("outsider", {"source_room_id": self.room.room_id})
        self.assertFalse(app.ROOMS)
        with patch.object(app, "_maybe_run_bots", return_value=None):
            await app.on_room_reconnect("wrong", {"room_id": self.room.room_id,
                "player_id": player.player_id, "reconnect_token": "wrong"})
            self.assertFalse(app.ROOMS)
            await app.on_room_reconnect("back", {"room_id": self.room.room_id,
                "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        self.assertEqual(app.SESSIONS["back"]["player_id"], player.player_id)
        self.assertEqual(json.dumps(app.ROOMS[self.room.room_id].game_state, sort_keys=True), saved)

    async def test_last_bot_confirms_end_updates_room_status(self):
        bot = self.room.players[1]
        bot.is_bot = True
        bot.socket_id = None
        state = self.room.game_state
        first = self.room.players[0].player_id
        state["stage"] = "final_review"
        state["ready"] = [first]
        state["winners"] = [first]
        app.sio.emits.clear()
        await app._maybe_run_bots(self.room)
        for unused in range(100):
            if not self.room.bot_running:
                break
            await asyncio.sleep(0.01)
        self.assertFalse(self.room.bot_running)
        self.assertTrue(state["game_over"])
        self.assertEqual(self.room.status, "game_over")
        updates = [entry["payload"] for entry in app.sio.emits if entry["event"] == "room:state"]
        self.assertTrue(any(payload["status"] == "game_over" for payload in updates))


if __name__ == "__main__":
    unittest.main()
