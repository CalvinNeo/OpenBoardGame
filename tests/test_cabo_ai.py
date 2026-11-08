import copy
import json
import random
import unittest
from unittest.mock import AsyncMock, patch

from jsonschema import Draft7Validator

import app
from game.cabo import CHOICE_VALUES, CaboGame
from game.cabo_ai import choose_action
from game.definitions import CABO_ACTION_SCHEMA
from tests.test_room_session import DummySio


def _card(value):
    return None if value is None else {"value": value, "choice": CHOICE_VALUES.get(value)}


def _make_state(count=2, config=None):
    return CaboGame.init_game(config, [
        {"player_id": f"p{seat}", "name": f"Bot {seat}", "seat": seat, "is_bot": True}
        for seat in range(count)
    ])


def _set_hand(state, player_id, values, known=()):
    state["players"][player_id]["hand"] = [_card(value) for value in values]
    state["players"][player_id]["public_known"] = [False] * len(values)
    for knowledge in state["knowledge"].values():
        knowledge[player_id] = [False] * len(values)
    for slot in known:
        state["knowledge"]["p0"][player_id][slot] = True


class CaboAiTests(unittest.TestCase):
    def setUp(self):
        self.addCleanup(random.setstate, random.getstate())
        random.seed(17)
        self.state = _make_state()
        self.state["phase"] = "turn"
        self.state["current_turn"] = "p0"
        self.validator = Draft7Validator(CABO_ACTION_SCHEMA)

    def _move(self):
        before = copy.deepcopy(self.state)
        action = CaboGame.bot_move(self.state, "p0")
        self.assertEqual(self.state, before)
        self.assertIsNotNone(action)
        payload = {key: value for key, value in action.items() if key != "delay_ms"}
        self.validator.validate(payload)
        self.assertIn(action["type"], CaboGame.get_legal_actions(self.state, "p0"))
        return action

    def _draw(self, value):
        self.state["phase"] = "drawn"
        self.state["last_drawn"] = _card(value)
        return self._move()

    def _choice(self, choice):
        self.state["phase"] = "choice_pending"
        self.state["pending_choice"] = {"type": choice}
        return self._move()

    def test_initial_peek_is_deterministic_and_ignores_card_values(self):
        self.state["phase"] = "initial_peek"
        action = self._move()
        _set_hand(self.state, "p0", [13, 13, 0, 0])
        self.assertEqual(self._move(), action)
        self.assertEqual(action, {"type": "initial_peek", "slots": [0, 1]})
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertIsNone(CaboGame.bot_move(self.state, "p0"))
        self.assertEqual(CaboGame.bot_move(self.state, "p1")["type"], "initial_peek")

    def test_inactive_unknown_ready_and_finished_players_do_not_act(self):
        self.assertIsNone(CaboGame.bot_move(self.state, "p1"))
        self.assertIsNone(CaboGame.bot_move(self.state, "missing"))
        self.state["phase"] = "round_end"
        self.state["players"]["p0"]["round_ready"] = True
        self.assertIsNone(CaboGame.bot_move(self.state, "p0"))
        self.state["players"]["p0"]["round_ready"] = False
        self.assertEqual(self._move(), {"type": "next_round", "delay_ms": 300})
        self.state["game_over"] = True
        self.assertIsNone(CaboGame.bot_move(self.state, "p0"))

    def test_replaces_highest_known_card_with_low_draw(self):
        _set_hand(self.state, "p0", [2, 12, 3, 1], range(4))
        self.assertEqual(self._draw(0), {"type": "replace_card", "slot": 1})

    def test_replaces_unknown_card_instead_of_known_low_cards(self):
        _set_hand(self.state, "p0", [0, 1, 12, 13], [0, 1])
        self.assertEqual(self._draw(2), {"type": "replace_card", "slot": 2})

    def test_uses_publicly_revealed_cards(self):
        _set_hand(self.state, "p0", [13, 1, None, None], [1])
        self.state["players"]["p0"]["public_known"][0] = True
        self.assertEqual(self._draw(0), {"type": "replace_card", "slot": 0})

    def test_discards_bad_draw_instead_of_worsening_hand(self):
        _set_hand(self.state, "p0", [0, 1, 2, 3], range(4))
        self.assertEqual(self._draw(13), {"type": "discard_drawn"})

    def test_takes_good_discard_instead_of_blind_draw(self):
        _set_hand(self.state, "p0", [13, 2, 4, 1], range(4))
        self.state["discard"] = [_card(0)]
        self.assertEqual(self._move(), {"type": "draw_discard", "slot": 0})

    def test_rejects_bad_discard(self):
        _set_hand(self.state, "p0", [4, 5, 6, 9], range(4))
        self.state["discard"] = [_card(13)]
        self.assertEqual(self._move(), {"type": "draw_deck"})

    def test_matches_only_known_cards_and_prefers_larger_savings(self):
        _set_hand(self.state, "p0", [2, 2, 7, 7], range(4))
        self.assertEqual(self._draw(13), {"type": "attempt_match", "slots": [2, 3]})
        _set_hand(self.state, "p0", [2, 2, 7, 7], [0, 1])
        self.assertEqual(self._draw(13), {"type": "attempt_match", "slots": [0, 1]})
        _set_hand(self.state, "p0", [2, 2, 7, 7], [0])
        self.assertEqual(self._draw(13), {"type": "discard_drawn"})

    def test_matches_at_most_four_cards_and_supports_added_slots(self):
        _set_hand(self.state, "p0", [None, 6, 6, 6, 6, 6], range(1, 6))
        action = self._draw(13)
        self.assertEqual(action, {"type": "attempt_match", "slots": [1, 2, 3, 4]})
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(self.state["players"]["p0"]["hand"][5], _card(6))
        self.state["current_turn"] = "p0"
        self.assertEqual(self._draw(0), {"type": "replace_card", "slot": 5})

    def test_peeks_unknown_occupied_slot(self):
        _set_hand(self.state, "p0", [1, 2, 9, None], [0, 1])
        self.assertEqual(self._choice("peek"), {
            "type": "use_choice_action", "choice_type": "peek", "target": {"slot": 2},
        })

    def test_spies_only_unknown_opponent_cards(self):
        _set_hand(self.state, "p1", [None, 5, 0, None], [1])
        self.assertEqual(self._choice("spy"), {
            "type": "use_choice_action", "choice_type": "spy",
            "target": {"player_id": "p1", "slot": 2},
        })

    def test_swaps_known_high_card_for_known_low_card(self):
        _set_hand(self.state, "p0", [0, 10, None, None], [0, 1])
        _set_hand(self.state, "p1", [1, 12, None, None], [0, 1])
        self.assertEqual(self._choice("swap"), {
            "type": "use_choice_action", "choice_type": "swap",
            "target": {"player_id": "p1", "slot": 0, "self_slot": 1},
        })

    def test_direct_skill_competes_with_replacement(self):
        _set_hand(self.state, "p0", [0, 10, None, None], [0, 1])
        _set_hand(self.state, "p1", [1, 12, None, None], [0, 1])
        action = self._draw(11)
        self.assertEqual(action["type"], "use_choice_action")
        self.assertEqual(action["choice_type"], "swap")
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(self.state["current_turn"], "p1")
        self.assertEqual(self.state["players"]["p0"]["hand"][1], _card(1))

    def test_skips_unhelpful_skills(self):
        _set_hand(self.state, "p0", [0, 1, 2, 3], range(4))
        _set_hand(self.state, "p1", [10, 11, 12, 13], range(4))
        for choice in ("peek", "spy", "swap"):
            with self.subTest(choice=choice):
                self.assertEqual(self._choice(choice), {"type": "skip_choice"})

    def test_skips_information_skills_on_final_turn(self):
        self.state["cabo_called_by"] = "p1"
        for choice in ("peek", "spy"):
            with self.subTest(choice=choice):
                self.assertEqual(self._choice(choice), {"type": "skip_choice"})

    def test_skips_skills_without_targets(self):
        _set_hand(self.state, "p0", [None] * 4)
        _set_hand(self.state, "p1", [None] * 4)
        for choice in ("peek", "spy", "swap"):
            with self.subTest(choice=choice):
                self.assertEqual(self._choice(choice), {"type": "skip_choice"})

    def test_calls_cabo_with_zero_or_empty_hand(self):
        for values, known in (([0, None, None, None], [0]), ([None] * 4, [])):
            with self.subTest(values=values):
                _set_hand(self.state, "p0", values, known)
                self.assertEqual(self._move(), {"type": "call_cabo"})

    def test_call_estimates_opponents_final_turn(self):
        _set_hand(self.state, "p0", [0, 1, None, None], [0, 1])
        _set_hand(self.state, "p1", [10, 11, 12, 13], range(4))
        self.assertEqual(self._move(), {"type": "call_cabo"})
        _set_hand(self.state, "p1", [0, None, None, None], [0])
        self.assertNotEqual(self._move()["type"], "call_cabo")

    def test_does_not_call_prematurely_with_high_hand(self):
        _set_hand(self.state, "p0", [8, 10, 11, 13], range(4))
        self.state["discard"] = [_card(13)]
        self.assertEqual(self._move(), {"type": "draw_deck"})

    def test_calls_to_end_long_round_but_never_calls_twice(self):
        _set_hand(self.state, "p0", [8, 10, 11, 13], range(4))
        self.state["turn_count"] = 48
        self.assertEqual(self._move(), {"type": "call_cabo"})
        self.state["cabo_called_by"] = "p1"
        self.assertNotEqual(self._move()["type"], "call_cabo")

    def test_preserves_and_calls_completed_shooting_moon(self):
        self.state["config"]["shooting_moon"] = True
        _set_hand(self.state, "p0", [12, 12, 13, 13], range(4))
        self.assertEqual(self._move(), {"type": "call_cabo"})
        self.assertEqual(self._draw(0), {"type": "discard_drawn"})
        self.state["cabo_called_by"] = "p1"
        self.assertEqual(self._draw(11), {"type": "discard_drawn"})

    def test_completes_shooting_moon_when_enabled(self):
        self.state["config"]["shooting_moon"] = True
        _set_hand(self.state, "p0", [12, 12, 13, 0], range(4))
        self.assertEqual(self._draw(13), {"type": "replace_card", "slot": 3})
        self.state["config"]["shooting_moon"] = False
        self.assertEqual(self._draw(13), {"type": "attempt_match", "slots": [0, 1]})

    def test_custom_deck_counts_change_unknown_card_estimates(self):
        _set_hand(self.state, "p0", [0, 1, 13, 13], [0, 1])
        self.state["config"]["deck_counts"] = {
            str(value): 30 if value == 13 else 1 for value in range(14)
        }
        self.assertEqual(self._draw(9), {"type": "replace_card", "slot": 2})
        self.state["config"]["deck_counts"] = {
            str(value): 30 if value == 0 else 1 for value in range(14)
        }
        self.assertEqual(self._draw(9)["type"], "use_choice_action")

    def test_hidden_information_does_not_change_actions(self):
        _set_hand(self.state, "p0", [1, 2, 13, 13], [0, 1])
        _set_hand(self.state, "p1", [0, 0, 0, 0])
        for phase, choice in (("turn", None), ("drawn", None), ("choice_pending", "spy")):
            with self.subTest(phase=phase):
                self.state["phase"] = phase
                self.state["last_drawn"] = _card(13) if phase == "drawn" else None
                self.state["pending_choice"] = {"type": choice} if choice else None
                expected = self._move()
                changed = copy.deepcopy(self.state)
                changed["players"]["p0"]["hand"][2:] = [_card(0), _card(0)]
                changed["players"]["p1"]["hand"] = [_card(13)] * 4
                changed["deck"].reverse()
                changed["discard"] = [_card(0), _card(13), changed["discard"][-1]]
                changed["knowledge"]["p1"]["p0"] = [True] * 4
                changed["bot_memory"] = {"p1": {"0": 13, "1": 13}}
                self.assertEqual(CaboGame.bot_move(changed, "p0"), expected)

    def test_policy_receives_only_filtered_view_and_own_memory(self):
        self.state["bot_memory"] = {"p0": {"0": 3}, "p1": {"0": 13}}
        with patch("game.cabo_ai.choose_action", wraps=choose_action) as policy:
            self._move()
        view = policy.call_args.args[0]
        for private_field in ("deck", "discard", "knowledge", "bot_memory"):
            self.assertNotIn(private_field, view)
        self.assertEqual(view["config"]["deck_counts"], self.state["config"]["deck_counts"])
        self.assertEqual(view["players"][0]["hand"][0]["value"], 3)
        self.assertTrue(all(card["value"] is None for card in view["players"][1]["hand"]))

    def test_replacement_remembers_seen_draw_without_public_leak(self):
        _set_hand(self.state, "p0", [13, 4, 2, 1], range(4))
        action = self._draw(0)
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(self.state["bot_memory"]["p0"], {"0": 0})
        for viewer_id in ("p0", "p1", "spectator"):
            view = CaboGame.get_public_view(self.state, viewer_id)
            self.assertNotIn("bot_memory", view)
            self.assertIsNone(view["players"][0]["hand"][0]["value"])
        self.state["current_turn"] = "p0"
        self.assertEqual(self._draw(3), {"type": "replace_card", "slot": 1})

    def test_failed_match_remembers_drawn_card_in_new_or_empty_slot(self):
        for values, expected_slot in (([1, 2, 3, 4], 4), ([1, 2, None, 4], 2)):
            with self.subTest(values=values):
                self.state = _make_state()
                _set_hand(self.state, "p0", values)
                self.state["phase"] = "drawn"
                self.state["last_drawn"] = _card(0)
                _, error = CaboGame.apply_action(
                    self.state, "p0", {"type": "attempt_match", "slots": [0, 1]}
                )
                self.assertIsNone(error)
                self.assertEqual(self.state["bot_memory"]["p0"], {str(expected_slot): 0})
                self.state["current_turn"] = "p0"
                with patch("game.cabo_ai.choose_action", wraps=choose_action) as policy:
                    self._draw(13)
                self.assertEqual(policy.call_args.args[0]["players"][0]["hand"][expected_slot]["value"], 0)

    def test_swap_clears_memory_for_both_changed_slots(self):
        self.state["bot_memory"] = {"p0": {"0": 1}, "p1": {"1": 2}}
        self.state["phase"] = "choice_pending"
        self.state["pending_choice"] = {"type": "swap"}
        _, error = CaboGame.apply_action(self.state, "p0", {
            "type": "use_choice_action", "choice_type": "swap",
            "target": {"player_id": "p1", "slot": 1, "self_slot": 0},
        })
        self.assertIsNone(error)
        self.assertEqual(self.state["bot_memory"], {"p0": {}, "p1": {}})

    def test_discard_replacement_and_successful_match_clear_stale_memory(self):
        _set_hand(self.state, "p0", [4, 4, 1, 2], range(4))
        self.state["bot_memory"] = {"p0": {"0": 4, "1": 4}}
        self.state["discard"] = [_card(4)]
        _, error = CaboGame.apply_action(self.state, "p0", {"type": "draw_discard", "slot": 0})
        self.assertIsNone(error)
        self.assertEqual(self.state["bot_memory"]["p0"], {"1": 4})
        self.state["current_turn"] = "p0"
        action = self._draw(13)
        self.assertEqual(action, {"type": "attempt_match", "slots": [0, 1]})
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(self.state["bot_memory"]["p0"], {})

    def test_memory_and_turn_count_survive_json_round_trip_then_reset(self):
        _set_hand(self.state, "p0", [13, 4, 2, 1], range(4))
        action = self._draw(0)
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(self.state["turn_count"], 1)
        restored = CaboGame.deserialize(json.loads(json.dumps(CaboGame.serialize(self.state))))
        self.assertEqual(restored["bot_memory"], self.state["bot_memory"])
        self.assertEqual(CaboGame.bot_move(restored, "p1"), CaboGame.bot_move(self.state, "p1"))
        CaboGame.start_new_round(restored)
        self.assertNotIn("bot_memory", restored)
        self.assertEqual(restored["turn_count"], 0)

    def test_legacy_state_without_memory_or_turn_count_still_works(self):
        self.state.pop("turn_count")
        action = self._move()
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        if self.state["phase"] == "drawn":
            _, error = CaboGame.apply_action(self.state, "p0", self._move())
            self.assertIsNone(error)
        self.assertIn("turn_count", self.state)

    def test_exhausted_deck_uses_discard_or_call_and_can_reshuffle(self):
        _set_hand(self.state, "p0", [13, 2, 4, 1], range(4))
        self.state["deck"] = []
        self.state["discard"] = [_card(0)]
        self.assertEqual(self._move(), {"type": "draw_discard", "slot": 0})
        _set_hand(self.state, "p0", [None] * 4)
        self.assertEqual(self._move(), {"type": "call_cabo"})
        _set_hand(self.state, "p0", [4, 5, 6, 9], range(4))
        self.state["discard"] = [_card(0), _card(1), _card(13)]
        action = self._move()
        self.assertEqual(action, {"type": "draw_deck"})
        _, error = CaboGame.apply_action(self.state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "drawn")

    def test_full_bot_games_finish_for_all_player_counts(self):
        for count in range(2, 6):
            for seed in range(3):
                with self.subTest(count=count, seed=seed):
                    random.seed(seed)
                    config = {"target_score": 60, "shooting_moon": seed == 1, "score_reset": seed == 1}
                    if seed == 2:
                        config["deck_counts"] = {
                            str(value): 6 if value in (2, 5, 8, 11) else 0 for value in range(14)
                        }
                    state = _make_state(count, config)
                    for step in range(5000):
                        if state["game_over"]:
                            break
                        actor = next(
                            (player_id for player_id in state["turn_order"]
                             if CaboGame.get_legal_actions(state, player_id)),
                            None,
                        )
                        self.assertIsNotNone(actor, (count, seed, step, state["phase"]))
                        before = copy.deepcopy(state)
                        action = CaboGame.bot_move(state, actor)
                        self.assertEqual(state, before)
                        self.assertIsNotNone(action)
                        payload = {key: value for key, value in action.items() if key != "delay_ms"}
                        self.validator.validate(payload)
                        events, error = CaboGame.apply_action(state, actor, payload)
                        self.assertIsNone(error, (count, seed, step, actor, payload, error))
                        self.assertNotIn("game:match_fail", [event["type"] for event in events])
                    self.assertTrue(state["game_over"], (count, seed, state["phase"], state["round"]))
                    self.assertGreater(state["round"], 1)


class CaboAiRoomTests(unittest.IsolatedAsyncioTestCase):
    async def test_room_can_add_bot_and_start_cabo(self):
        with patch.object(app, "sio", DummySio()), patch.object(app, "ROOMS", {}), \
                patch.object(app, "SESSIONS", {}), patch.object(app, "_save_room_state"), \
                patch.object(app, "_maybe_run_bots", AsyncMock()) as run_bots:
            await app.on_room_create("human", {"name": "Human", "game_type": "cabo"})
            room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
            await app.on_room_add_bot("human", {})
            self.assertEqual(len(room.players), 2)
            self.assertTrue(room.players[1].is_bot)
            room.players[0].ready = True
            await app.on_room_start("human", {})
            self.assertEqual(room.status, "in_game")
            self.assertEqual(room.game_state["phase"], "initial_peek")
            run_bots.assert_awaited_once_with(room)

    async def test_scheduler_resolves_skill_and_returns_control_to_human(self):
        state = _make_state()
        state["phase"] = "choice_pending"
        state["pending_choice"] = {"type": "swap"}
        state["current_turn"] = "p1"
        _set_hand(state, "p0", [0, 2, 4, 6], range(4))
        _set_hand(state, "p1", [13, 3, 5, 7])
        state["knowledge"]["p1"]["p1"] = [True] * 4
        state["knowledge"]["p1"]["p0"] = [True] * 4
        room = app.Room("cabo-ai-test", status="in_game", game_state=state)
        room.players = [
            app.Player(player_id, player_id, seat, None, is_bot=player_id == "p1")
            for seat, player_id in enumerate(state["turn_order"])
        ]
        runners = []
        with patch.object(app, "_save_room_state"), \
                patch.object(app, "_emit_game_state", AsyncMock()) as emit_state, \
                patch.object(app, "_emit_bot_progress", AsyncMock()), \
                patch.object(app.asyncio, "sleep", AsyncMock()):
            with patch.object(app.asyncio, "create_task", side_effect=runners.append):
                await app._maybe_run_bots(room)
            self.assertEqual(len(runners), 1)
            await runners[0]
        self.assertFalse(room.bot_running)
        self.assertEqual(state["current_turn"], "p0")
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(state["players"]["p1"]["hand"][0], _card(0))
        self.assertEqual(emit_state.await_count, 1)
        events = emit_state.await_args.args[1]
        self.assertEqual(events[0]["payload"]["action"]["type"], "use_choice_action")

    async def test_skipping_skill_passes_room_action_validation(self):
        with patch.object(app, "sio", DummySio()), patch.object(app, "ROOMS", {}), \
                patch.object(app, "SESSIONS", {}), patch.object(app, "_save_room_state"), \
                patch.object(app, "_maybe_run_bots", AsyncMock()):
            await app.on_room_create("human", {"name": "Human", "game_type": "cabo"})
            room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
            await app.on_room_add_bot("human", {})
            await app.on_room_start("human", {})
            room.game_state["phase"] = "choice_pending"
            room.game_state["pending_choice"] = {"type": "peek"}
            app.sio.emits.clear()
            await app.on_game_action("human", {"action": {"type": "skip_choice"}})
            self.assertEqual(room.game_state["current_turn"], room.players[1].player_id)
            self.assertIsNone(room.game_state["pending_choice"])
            self.assertFalse(any(event["event"] == "error" for event in app.sio.emits))


if __name__ == "__main__":
    unittest.main()
