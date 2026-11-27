import copy
import json
import unittest
from collections import Counter
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

import app
from tests.test_room_session import DummySio

from game import get_game
from game.bohnanza import BEANS, BohnanzaGame as Game, bean_kind, harvest_value


def make_state(count=3, seed=123):
    return Game.init_game({"seed": seed}, [
        {"player_id": f"farmer{index}", "name": ["Alice", "Bao", "Clara", "Diego", "Eve"][index], "seat": index}
        for index in range(count)
    ])


class BohnanzaTests(unittest.TestCase):
    def apply(self, state, player, kind, **fields):
        events, error = Game.apply_action(state, player, {"type": kind, **fields})
        self.assertIsNone(error, (kind, fields, error))
        self.assertTrue(events)

    def reject(self, state, player, action):
        original = copy.deepcopy(state)
        events, error = Game.apply_action(state, player, action)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(state, original)

    def conserved(self, state):
        cards = list(state["deck"]) + state["discard"] + state["market"]
        for player in state["players"].values():
            cards += player["hand"] + player["gold"] + player["pending"]
            for field in player["fields"]:
                cards += field
                self.assertLessEqual(len({bean_kind(card) for card in field}), 1)
        self.assertEqual(len(cards), 104)
        self.assertEqual(len(set(cards)), 104)
        self.assertEqual(Counter(bean_kind(card) for card in cards),
                         Counter({bean["id"]: bean["count"] for bean in BEANS}))

    def test_setup_registration_and_conservation(self):
        self.assertIs(get_game("bohnanza").module, Game)
        for count in (3, 4, 5):
            state = make_state(count)
            self.assertEqual(state, make_state(count))
            self.assertEqual(len(state["deck"]), 104 - count * 5)
            for player in state["players"].values():
                self.assertEqual(len(player["hand"]), 5)
                self.assertEqual(len(player["fields"]), 3 if count == 3 else 2)
            self.conserved(state)

    def test_invalid_setup(self):
        for count in (0, 1, 2, 6):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": str(index)} for index in range(count)])
        for config in ([], {"seed": []}, {"seed": True}, {"unknown": 1}):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": str(index)} for index in range(3)])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "same"}] * 3)

    def test_beanometers_including_garden(self):
        self.assertEqual([harvest_value("garden", count) for count in range(5)], [0, 0, 2, 3, 3])
        for bean in BEANS:
            for value, threshold in enumerate(bean["thresholds"], 1):
                if threshold is not None:
                    self.assertEqual(harvest_value(bean["id"], threshold), value)
        self.assertEqual(harvest_value("blue", 3), 0)

    def test_order_first_mandatory_second_optional_and_no_third(self):
        state = make_state()
        player = state["players"]["farmer0"]
        self.reject(state, "farmer0", {"type": "reveal"})
        self.reject(state, "farmer0", {"type": "plant", "field": 0, "card": player["hand"][1]})
        self.apply(state, "farmer0", "plant", field=0, card=player["hand"][0])
        self.assertIn("reveal", Game.get_legal_actions(state, "farmer0"))
        self.apply(state, "farmer0", "plant", field=1, card=player["hand"][0])
        self.assertNotIn("plant", Game.get_legal_actions(state, "farmer0"))
        self.apply(state, "farmer0", "reveal")
        self.assertEqual(len(state["market"]), 2)
        self.conserved(state)

    def test_same_bean_can_be_split_and_mixed_crops_rejected(self):
        state = make_state()
        state["players"]["farmer0"]["hand"] = ["blue:0", "blue:1", "red:0"]
        self.apply(state, "farmer0", "plant", field=0, card="blue:0")
        self.apply(state, "farmer0", "plant", field=1, card="blue:1")
        state.update(phase="plant_traded")
        state["players"]["farmer0"]["pending"] = ["red:1"]
        self.reject(state, "farmer0", {"type": "plant", "card": "red:1", "field": 0})

    def test_protection_and_harvest_accounting_at_any_time(self):
        state = make_state()
        player = state["players"]["farmer1"]
        player["fields"] = [["blue:0"], ["red:0", "red:1", "red:2"], []]
        self.reject(state, "farmer1", {"type": "harvest", "field": 0})
        self.apply(state, "farmer1", "harvest", field=1)
        self.assertEqual(len(player["gold"]), 2)
        self.assertEqual(state["discard"], ["red:2"])
        self.apply(state, "farmer1", "harvest", field=0)
        self.assertEqual(state["discard"], ["red:2", "blue:0"])

    def trade_state(self):
        state = make_state()
        state["phase"] = "trade"
        state["players"]["farmer0"]["hand"] = ["blue:0", "red:0", "blue:1"]
        state["players"]["farmer1"]["hand"] = ["soy:0", "red:1", "soy:1"]
        state["market"] = ["green:0", "chili:0"]
        return state

    def test_trade_consent_order_and_exact_duplicate_payment(self):
        state = self.trade_state()
        before = copy.deepcopy(state["players"])
        self.apply(state, "farmer0", "offer", target="farmer1", give=["green:0", "blue:1"], want=["soy"])
        self.assertEqual(before, state["players"])
        self.apply(state, "farmer1", "accept", give=["soy:1"])
        self.assertEqual(state["players"]["farmer1"]["hand"], ["soy:0", "red:1"])
        self.assertEqual(state["players"]["farmer0"]["hand"], ["blue:0", "red:0"])
        self.assertEqual(state["players"]["farmer0"]["pending"], ["soy:1"])
        self.assertEqual(state["players"]["farmer1"]["pending"], ["green:0", "blue:1"])
        self.assertEqual(state["market"], ["chili:0"])
        self.reject(state, "farmer1", {"type": "offer", "target": "farmer0", "give": ["green:0"], "want": []})

    def test_gifts_requests_rejection_and_cancel(self):
        state = self.trade_state()
        self.apply(state, "farmer1", "offer", target="farmer0", give=["soy:0"], want=[])
        self.apply(state, "farmer0", "reject")
        self.assertIn("soy:0", state["players"]["farmer1"]["hand"])
        self.apply(state, "farmer1", "offer", target="farmer0", give=[], want=["green"])
        self.apply(state, "farmer1", "cancel")
        self.apply(state, "farmer1", "offer", target="farmer0", give=[], want=["green"])
        self.apply(state, "farmer0", "accept", give=["green:0"])
        self.assertEqual(state["players"]["farmer1"]["pending"], ["green:0"])

    def test_invalid_trades_atomic_and_unaffordable_not_leaked(self):
        state = self.trade_state()
        for action in [
            {"type": "offer", "target": "farmer2", "give": [], "want": []},
            {"type": "offer", "target": "farmer0", "give": ["soy:0", "soy:0"], "want": []},
            {"type": "offer", "target": "farmer0", "give": ["green:0"], "want": []},
            {"type": "offer", "target": "farmer0", "give": [[1]], "want": []},
            {"type": "offer", "target": "farmer0", "give": [], "want": [[1]]},
            {"type": "offer", "target": "farmer2", "give": ["soy:0"], "want": []},
        ]:
            self.reject(state, "farmer1", action)
        self.apply(state, "farmer0", "offer", target="farmer1", give=["blue:0"], want=["garden"])
        self.reject(state, "farmer1", {"type": "accept"})
        self.reject(state, "farmer1", {"type": "accept", "give": ["soy:0"]})
        self.reject(state, "farmer2", {"type": "accept"})
        self.reject(state, "farmer0", {"type": "finish_trade"})

    def test_plant_traded_in_any_order_waits_for_everyone(self):
        state = self.trade_state()
        self.apply(state, "farmer0", "offer", target="farmer1", give=["green:0"], want=["soy"])
        self.apply(state, "farmer1", "accept")
        self.apply(state, "farmer0", "finish_trade")
        self.apply(state, "farmer0", "plant", card="chili:0", field=0)
        self.apply(state, "farmer0", "plant", card="soy:0", field=1)
        self.assertEqual(state["phase"], "plant_traded")
        self.apply(state, "farmer1", "plant", card="green:0", field=0)
        self.assertEqual(state["phase"], "draw")
        hand = list(state["players"]["farmer0"]["hand"])
        cards = state["deck"][:3]
        self.apply(state, "farmer0", "end_turn")
        self.assertEqual(state["players"]["farmer0"]["hand"], hand + cards)

    def test_third_exhaustion_during_reveal_finishes_planting(self):
        state = make_state()
        state.update(phase="reveal", exhaustions=2, deck=["garden:0"])
        self.apply(state, "farmer0", "reveal")
        self.assertEqual(state["market"], ["garden:0"])
        self.assertFalse(state["game_over"])
        self.apply(state, "farmer0", "finish_trade")
        self.apply(state, "farmer0", "plant", card="garden:0", field=0)
        self.assertEqual(state["phase"], "final_review")
        self.assertFalse(state["game_over"])
        self.assertEqual(state["final_fields"]["farmer0"][0], ["garden:0"])

    def test_third_exhaustion_during_draw_and_tiebreak(self):
        state = make_state()
        state.update(phase="draw", exhaustions=2, deck=["blue:0"])
        state["players"]["farmer0"]["fields"] = [["garden:0", "garden:1"], [], []]
        state["players"]["farmer2"]["fields"] = [["garden:2", "garden:3"], [], []]
        self.apply(state, "farmer0", "end_turn")
        self.assertEqual(state["phase"], "final_review")
        self.assertEqual(len(state["players"]["farmer0"]["gold"]), 2)
        self.assertEqual(state["winner_ids"], ["farmer2"])
        for player_id in state["turn_order"]:
            self.apply(state, player_id, "confirm")
        self.assertTrue(state["game_over"])
        self.assertEqual(Game.get_legal_actions(state, "farmer0"), ["play_again"])

    def test_simultaneous_confirmations_accept_review_revision(self):
        state = make_state()
        state.update(phase="draw", exhaustions=2, deck=["blue:0"])
        self.apply(state, "farmer0", "end_turn")
        revision = state["revision"]
        for player_id in state["turn_order"]:
            self.apply(state, player_id, "confirm", revision=revision)
        self.assertTrue(state["game_over"])

    def test_reshuffle_at_exact_exhaustion_and_gold_stays_out(self):
        state = make_state()
        state.update(phase="reveal", deck=["blue:0"], discard=["red:0", "red:1", "red:2"])
        self.apply(state, "farmer0", "reveal")
        self.assertEqual(state["exhaustions"], 1)
        self.assertEqual(len(state["market"]), 2)
        self.assertEqual(len(state["deck"]), 2)
        self.assertEqual(state["discard"], [])

    def test_round_pause_requires_every_player(self):
        state = make_state()
        state.update(phase="draw", current_turn="farmer2", turn_number=3)
        self.apply(state, "farmer2", "end_turn")
        self.assertEqual(state["phase"], "round_summary")
        snapshot = copy.deepcopy(state["players"])
        self.apply(state, "farmer0", "next_round")
        self.apply(state, "farmer1", "next_round")
        self.assertEqual(state["phase"], "round_summary")
        self.apply(state, "farmer2", "next_round")
        self.assertEqual(state["phase"], "plant_hand")
        self.assertEqual(state["players"], snapshot)

    def test_privacy_spectator_and_serialization(self):
        state = make_state()
        state["players"]["farmer0"]["gold"] = ["red:0"]
        for viewer in ["farmer0", "farmer1", "visitor"]:
            view = Game.get_public_view(state, viewer)
            self.assertNotIn("seed", view)
            self.assertNotIn("deck", view)
            for player in view["players"]:
                if player["player_id"] != viewer:
                    self.assertEqual(player["hand"], [])
                    self.assertIsNone(player["gold"])
        self.assertEqual(Game.get_legal_actions(state, "visitor"), [])
        loaded = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(state, loaded)
        loaded["players"]["farmer0"]["hand"].clear()
        self.assertTrue(state["players"]["farmer0"]["hand"])

    def test_validation_revision_and_types(self):
        state = make_state()
        for action in (None, [], {}, {"type": []}, {"type": "reveal", "revision": True},
                       {"type": "reveal", "revision": 1}, {"type": "plant", "field": True, "card": "blue:0"},
                       {"type": "plant", "field": 99, "card": "blue:0"}, {"type": "harvest", "extra": 1}):
            self.reject(state, "farmer0", action)

    def test_bot_does_not_depend_on_opponent_private_information(self):
        state = self.trade_state()
        self.apply(state, "farmer0", "offer", target="farmer1", give=["green:0"], want=["soy"])
        action = Game.bot_move(state, "farmer1")
        state["deck"].reverse()
        state["players"]["farmer0"]["hand"] = ["garden:5"] * 30
        state["players"]["farmer0"]["gold"] = ["red:7"] * 20
        self.assertEqual(action, Game.bot_move(state, "farmer1"))

    def test_seeded_bot_games_finish_with_conservation_and_save_load(self):
        for count, seed in [(3, 7), (4, 12), (5, 88)]:
            state = make_state(count, seed)
            for step in range(2500):
                if state["game_over"]:
                    break
                moved = False
                for player_id in state["turn_order"]:
                    action = Game.bot_move(state, player_id)
                    if action:
                        self.apply(state, player_id, **{"kind": action.pop("type"), **action})
                        self.conserved(state)
                        moved = True
                        break
                self.assertTrue(moved, (count, state["phase"]))
                if step % 100 == 0:
                    state = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
            self.assertTrue(state["game_over"], (count, state["phase"]))
            self.assertEqual(state["exhaustions"], 3)
            self.conserved(state)


class BohnanzaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.previous_sio, self.previous_data = app.sio, app.DATA_DIR
        self.previous_rooms, self.previous_sessions = dict(app.ROOMS), dict(app.SESSIONS)
        self.temp = TemporaryDirectory()
        app.sio, app.DATA_DIR = DummySio(), self.temp.name
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_create("alice", {"name": "Alice", "game_type": "bohnanza"})
        self.room = app.ROOMS[app.SESSIONS["alice"]["room_id"]]
        for socket_id, name in (("bao", "Bao"), ("clara", "Clara")):
            await app.on_room_join(socket_id, {"room_id": self.room.room_id, "name": name})
        for player in self.room.players:
            player.ready = True
        await app.on_room_start("alice", {})

    async def asyncTearDown(self):
        app.sio, app.DATA_DIR = self.previous_sio, self.previous_data
        app.ROOMS.clear()
        app.ROOMS.update(self.previous_rooms)
        app.SESSIONS.clear()
        app.SESSIONS.update(self.previous_sessions)
        self.temp.cleanup()

    async def test_catalog_private_views_and_bot_progress_redaction(self):
        row = next(row for row in await app.api_list_games() if row["game_id"] == "bohnanza")
        self.assertEqual((row["min_players"], row["max_players"]), (3, 5))
        self.assertTrue(row["has_strategic_ai"])
        app.sio.emits.clear()
        await app._emit_game_state(self.room)
        messages = [entry for entry in app.sio.emits if entry["event"] == "game:state"]
        self.assertEqual(len(messages), 3)
        for entry in messages:
            viewer = app.SESSIONS[entry["to"]]["player_id"]
            for player in entry["payload"]["view"]["players"]:
                self.assertEqual(bool(player["hand"]), player["player_id"] == viewer)
                if player["player_id"] != viewer:
                    self.assertIsNone(player["gold"])
        self.assertEqual(app._public_bot_action("bohnanza", {"type": "plant", "card": "red:0", "field": 1}), {"type": "plant"})

    async def test_room_state_does_not_publish_seed(self):
        self.room.game_config = {"seed": "private-seed"}
        app.sio.emits.clear()
        await app._emit_room_state(self.room)
        state = next(entry["payload"] for entry in app.sio.emits if entry["event"] == "room:state")
        self.assertNotIn("seed", state["game_config"])

    async def test_schema_bypass_cannot_skip_order_or_ownership(self):
        state = self.room.game_state
        player_id = self.room.players[0].player_id
        for skip in (False, True):
            for invalid in ({"type": "plant", "card": state["players"][player_id]["hand"][1], "field": 0},
                            {"type": "plant", "card": state["players"][player_id]["hand"][0], "field": True},
                            {"type": "reveal"}, {"type": "harvest", "field": 9}):
                before = copy.deepcopy(state)
                await app.on_game_action("alice", {"skip_validation": skip, "action": invalid})
                self.assertEqual(state, before)
                self.assertEqual(app.sio.emits[-1]["event"], "system:error")

    async def test_cold_reconnect_and_protected_save(self):
        self.room.auto_save = True
        app._save_room_state(self.room)
        with self.assertRaises(HTTPException) as caught:
            await app.download_room_save(self.room.room_id)
        self.assertEqual(caught.exception.status_code, 403)
        saved = copy.deepcopy(self.room.game_state)
        player = self.room.players[1]
        app.ROOMS.clear()
        app.SESSIONS.clear()
        await app.on_room_load("outsider", {"source_room_id": self.room.room_id})
        self.assertFalse(app.ROOMS)
        with patch.object(app, "_maybe_run_bots", return_value=None):
            await app.on_room_reconnect("wrong", {"room_id": self.room.room_id,
                "player_id": player.player_id, "reconnect_token": "wrong"})
            self.assertFalse(app.ROOMS)
            await app.on_room_reconnect("back", {"room_id": self.room.room_id,
                "player_id": player.player_id, "reconnect_token": player.reconnect_token})
        restored = app.ROOMS[self.room.room_id]
        self.assertEqual(restored.game_state, saved)

    async def test_final_confirmation_gates_play_again(self):
        state = self.room.game_state
        state.update(phase="draw", exhaustions=2, deck=["blue:0"])
        await app.on_game_action("alice", {"action": {"type": "end_turn"}})
        self.assertEqual(state["phase"], "final_review")
        self.assertEqual(self.room.status, "in_game")
        before = copy.deepcopy(state)
        await app.on_room_start("alice", {})
        self.assertEqual(state, before)
        for socket_id in ("alice", "bao", "clara"):
            await app.on_game_action(socket_id, {"action": {"type": "confirm"}})
        self.assertEqual(self.room.status, "game_over")
        revision = state["revision"]
        await app.on_game_action("alice", {"action": {"type": "play_again", "revision": revision}})
        self.assertEqual(self.room.status, "in_game")
        self.assertEqual(self.room.game_state["phase"], "plant_hand")
        self.assertGreater(self.room.game_state["revision"], revision)

    async def test_last_bot_confirmation_broadcasts_final_room_status(self):
        state = self.room.game_state
        state.update(phase="draw", exhaustions=2, deck=["blue:0"])
        with patch.object(app, "_maybe_run_bots", new_callable=AsyncMock):
            await app.on_game_action("alice", {"action": {"type": "end_turn"}})
            for socket_id in ("alice", "bao"):
                await app.on_game_action(socket_id, {"action": {"type": "confirm"}})
        await app.asyncio.sleep(0)
        self.room.players[-1].is_bot = True
        app.sio.emits.clear()
        runners = []
        with patch.object(app.asyncio, "create_task", side_effect=runners.append):
            await app._maybe_run_bots(self.room)
        with patch.object(app.asyncio, "sleep", new_callable=AsyncMock):
            for runner in runners:
                await runner
        states = [entry["payload"] for entry in app.sio.emits if entry["event"] == "room:state"]
        self.assertEqual(states[-1]["status"], "game_over")
        self.assertTrue(any(entry["event"] == "room:list_update" for entry in app.sio.emits))



if __name__ == "__main__":
    unittest.main()
