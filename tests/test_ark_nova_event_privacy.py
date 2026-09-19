from __future__ import annotations

import copy
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import app
from game.ark_nova import ArkNovaGame
from game.ark_nova_effects import EffectContext, execute_ability
from game.ark_nova_events import filter_ark_nova_events


class ArkNovaEventPrivacyTests(unittest.IsolatedAsyncioTestCase):
    def make_room(self) -> app.Room:
        players = [app.Player(f"p{i}", f"Player {i}", i, f"sid{i}") for i in range(3)]
        state = ArkNovaGame.init_game(
            {"seed": 173},
            [{"player_id": player.player_id, "seat": player.seat} for player in players],
        )
        for player in players:
            _, error = ArkNovaGame.apply_action(state, player.player_id, {
                "type": "keep_initial_cards",
                "card_ids": state["players"][player.player_id]["hand"][:4],
            })
            self.assertIsNone(error)
        return app.Room("privacy", game_type="ark_nova", status="in_game", players=players, game_state=state)

    async def emit_events(self, room, events):
        before = copy.deepcopy(events)
        emit = AsyncMock()
        with patch.object(app.sio, "emit", emit):
            await app._emit_game_state(room, events)
        self.assertEqual(events, before)
        self.assertEqual(emit.await_count, 3)
        return {
            call.kwargs["to"]: call.args[1]["events"]
            for call in emit.await_args_list
        }

    def set_cards_slot(self, state, slot=3, upgraded=False):
        cards = state["players"]["p0"]["action_cards"]
        other = next(card for card in cards.values() if card["slot"] == slot)
        other["slot"], cards["cards"]["slot"] = cards["cards"]["slot"], slot
        cards["cards"]["upgraded"] = upgraded

    async def test_cards_i_draw_identities_are_sent_only_to_owner(self):
        room = self.make_room()
        self.set_cards_slot(room.game_state)
        events, error = ArkNovaGame.apply_action(room.game_state, "p0", {"type": "cards"})
        self.assertIsNone(error)
        sent = await self.emit_events(room, events)
        own = next(event["payload"] for event in sent["sid0"] if event["type"] == "ark_nova:cards")
        self.assertTrue(own["drawn"])
        for sid in ["sid1", "sid2"]:
            public = next(event["payload"] for event in sent[sid] if event["type"] == "ark_nova:cards")
            self.assertNotIn("drawn", public)
            self.assertEqual(public["draw_count"], len(own["drawn"]))
        self.assertEqual(sent["sid0"], events)

    async def test_cards_ii_keeps_display_acquisition_public_and_deck_draw_private(self):
        room = self.make_room()
        state = room.game_state
        self.set_cards_slot(state, upgraded=True)
        market_card = state["display"][0]
        events, error = ArkNovaGame.apply_action(state, "p0", {"type": "cards", "choose_card_sources": True})
        self.assertIsNone(error)
        first = True
        while (state.get("pending_choice") or {}).get("type") == "draw_card":
            pending = state["pending_choice"]
            more, error = ArkNovaGame.apply_action(state, "p0", {
                "type": "resolve_choice", "choice_id": pending["choice_id"],
                "selection": f"display:{market_card}" if first else "deck",
            })
            self.assertIsNone(error)
            events.extend(more)
            first = False
        sent = await self.emit_events(room, events)
        own = next(event["payload"] for event in sent["sid0"] if event["type"] == "ark_nova:cards")
        self.assertTrue(own["drawn"])
        public = next(event["payload"] for event in sent["sid1"] if event["type"] == "ark_nova:cards")
        self.assertEqual(public["market_cards"], [market_card])
        self.assertNotIn("drawn", public)
        self.assertEqual(public["draw_count"], len(own["drawn"]))

    async def test_effect_draws_tucked_cards_and_final_cards_are_private(self):
        room = self.make_room()
        state = room.game_state
        context = EffectContext(state, "p0", card_id="401")
        events = execute_ability("sprint", context, {"draw_count": 2}).events
        tucked = state["players"]["p0"]["hand"][0]
        events += execute_ability("pouch", context, {"maximum_cards": 1}, {"card_ids": [tucked]}).events
        final_card = state["final_deck"][-1]
        events += execute_ability("resistance", context, choice={"card_ids": [final_card]}).events
        base_project = state["unused_base_projects"][0]
        events += execute_ability("assertion", context, choice={"card_ids": [base_project]}).events
        sent = await self.emit_events(room, events)
        self.assertEqual(sent["sid0"], events)
        for sid in ["sid1", "sid2"]:
            by_type = {event["type"]: event for event in sent[sid]}
            self.assertNotIn("card_ids", by_type["cards_drawn"])
            self.assertEqual(by_type["cards_drawn"]["count"], 2)
            self.assertNotIn("card_ids", by_type["cards_tucked"])
            self.assertEqual(by_type["cards_tucked"]["count"], 1)
            self.assertNotIn("card_id", by_type["final_scoring_card_kept"])
            self.assertNotIn("card_id", by_type["base_project_taken"])

    async def test_pilfered_card_is_known_to_both_participants_but_not_third_player(self):
        room = self.make_room()
        state = room.game_state
        state["pending_choice"] = {
            "choice_id": "test-pilfer", "type": "pilfering", "player_id": "p1",
            "attacker_id": "p0", "criterion": "appeal", "min": 1, "max": 1,
            "options": [{"value": "card", "label": "Give a random card"}],
        }
        state["phase"] = "pending_choice"
        events, error = ArkNovaGame.apply_action(state, "p1", {
            "type": "resolve_choice", "choice_id": "test-pilfer", "selection": "card",
        })
        self.assertIsNone(error)
        sent = await self.emit_events(room, events)
        own = next(event["payload"] for event in sent["sid0"] if event["type"] == "ark_nova:pilfering")
        victim = next(event["payload"] for event in sent["sid1"] if event["type"] == "ark_nova:pilfering")
        observer = next(event["payload"] for event in sent["sid2"] if event["type"] == "ark_nova:pilfering")
        self.assertTrue(own["card_id"])
        self.assertEqual(victim["card_id"], own["card_id"])
        self.assertNotIn("card_id", observer)
        self.assertEqual(observer["card_count"], 1)

    async def test_bot_private_choices_and_future_plays_are_not_broadcast(self):
        room = self.make_room()
        actions = [
            {"type": "keep_initial_cards", "card_ids": ["401", "402", "403", "404"]},
            {"type": "resolve_choice", "choice_id": "private-choice", "selection": "005"},
            {"type": "animals", "plays": [{"card_id": "401"}, {"card_id": "402"}], "continue_action": True},
            {"type": "sponsors", "card_ids": ["201", "202"]},
            {"type": "cards", "discard_ids": ["403"]},
        ]
        events = [{"type": "bot:action", "payload": {"player_id": "p0", "name": "Bot", "action": action}} for action in actions]
        events.append({"type": "ark_nova:animal", "payload": {"player_id": "p0", "card_id": "401"}})
        sent = await self.emit_events(room, events)
        self.assertEqual(sent["sid0"], events)
        for sid in ["sid1", "sid2"]:
            for action, event in zip(actions, sent[sid]):
                self.assertEqual(event["payload"]["action"], {"type": action["type"]})
                self.assertEqual(app._public_bot_action("ark_nova", action), {"type": action["type"]})
            self.assertEqual(sent[sid][-1], events[-1])

    async def test_public_reveals_display_and_discards_remain_visible(self):
        room = self.make_room()
        events = [
            {"type": "display_cards_taken", "player_id": "p0", "card_ids": ["401"]},
            {"type": "discard_card_taken", "player_id": "p0", "card_id": "402"},
            {"type": "cards_revealed_and_discarded", "player_id": "p0", "card_ids": ["403"]},
            {"type": "revealed_cards_kept", "player_id": "p0", "kept": ["404"], "discarded": ["405"]},
            {"type": "animal_fetched", "player_id": "p0", "card_id": "406"},
            {"type": "cards_sold", "player_id": "p0", "card_ids": ["407"]},
            {"type": "ark_nova:discard", "payload": {"player_id": "p0", "card_ids": ["408"]}},
            {"type": "ark_nova:break", "payload": {"discarded_display": ["409", "410"]}},
        ]
        sent = await self.emit_events(room, events)
        for received in sent.values():
            self.assertEqual(received, events)

    async def test_multiplier_rollback_snapshot_never_enters_public_payload(self):
        room = self.make_room()
        state = room.game_state
        state["players"]["p0"]["action_cards"]["sponsors"]["multiplier_tokens"] = 2
        events, error = ArkNovaGame.apply_action(state, "p0", {
            "type": "sponsors", "mode": "break", "use_multiplier_tokens": 2,
        })
        self.assertIsNone(error)
        self.assertIn("_multiplier_start", state)
        self.assertTrue(state["forced_action"]["from_multiplier"])
        state["_multiplier_start"]["privacy_marker"] = "private-multiplier-snapshot"
        before = copy.deepcopy(events)
        emit = AsyncMock()
        with patch.object(app.sio, "emit", emit):
            await app._emit_game_state(room, events)
        self.assertEqual(emit.await_count, 3)
        for call in emit.await_args_list:
            payload = json.dumps(call.args[1])
            self.assertNotIn("private-multiplier-snapshot", payload)
            self.assertNotIn("_multiplier_start", payload)
            self.assertNotIn("_multiplier_first_action", payload)
        self.assertEqual(events, before)

    def test_diagnostic_effect_reference_does_not_reveal_pending_candidates(self):
        events = [{"type": "ark_nova:effect_unavailable", "payload": {"effect_ref": {
            "player_id": "p0", "card_id": "401", "metadata": {
                "pending_choice": {"options": [{"card_id": "secret"}], "metadata": {"candidates": ["secret"]}},
            },
        }}}]
        original = copy.deepcopy(events)
        self.assertEqual(filter_ark_nova_events(events, "p0"), events)
        filtered = filter_ark_nova_events(events, "p1")
        self.assertNotIn("metadata", filtered[0]["payload"]["effect_ref"])
        self.assertEqual(events, original)

    async def test_other_games_event_payloads_are_unchanged(self):
        room = self.make_room()
        room.game_type = "cabo"
        events = [{"type": "cards_drawn", "player_id": "p0", "card_ids": ["private-by-other-rules"]}]
        module = SimpleNamespace(get_public_view=lambda state, player_id: {"you": player_id})
        with patch.object(app, "_get_game_definition", return_value=SimpleNamespace(module=module)):
            sent = await self.emit_events(room, events)
        for received in sent.values():
            self.assertEqual(received, events)


if __name__ == "__main__":
    unittest.main()
