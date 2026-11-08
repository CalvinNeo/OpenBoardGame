import random
import unittest
from collections import Counter
from copy import deepcopy
from unittest.mock import AsyncMock, patch

import app
from game.in_a_grove import InAGroveGame as Game, TILE_SPECS, _determine_murderer_index, _final_ranking
from game.in_a_grove_ai import _bet_outcome, _possible_worlds, choose_action


def _players(count=3):
    return [
        {"player_id": f"p{index}", "name": f"Player {index}", "seat": index, "is_bot": index != 0}
        for index in range(count)
    ]


def _state(count=3, mode="choose_one"):
    with patch("game.in_a_grove.random.shuffle", side_effect=random.Random(72).shuffle):
        state = Game.init_game({"inspection_mode": mode}, _players(count))
    state.update(first_player="p0", current_turn="p0")
    return state


def _view(labels=(None, None, None), alibis=("2", "3"), count=3):
    view = Game.get_public_view(_state(count), "p0")
    view.update(phase="bet", legal_actions=["place_bet"])
    view["your_tiles"] = [{"label": label} for label in alibis]
    view["public_alibi"] = None
    for suspect, label in zip(view["suspects"], labels):
        suspect["label"] = label
    return view


class InAGroveAiTests(unittest.TestCase):
    def test_enumeration_excludes_private_and_public_alibis_for_all_player_counts(self):
        for count, expected in ((2, 60), (3, 60), (4, 120), (5, 210)):
            with self.subTest(players=count):
                view = _view(count=count)
                if count == 2:
                    view["your_tiles"] = [{"label": "2"}]
                    view["public_alibi"] = "3"
                worlds = _possible_worlds(view)
                self.assertEqual(len(worlds), expected)
                for labels, murderer in worlds:
                    self.assertFalse({"2", "3"}.intersection(labels))
                    tiles = [next(tile for tile in TILE_SPECS if tile["label"] == label) for label in labels]
                    self.assertEqual(murderer, _determine_murderer_index(tiles))

    def test_duplicate_x_tiles_keep_physical_deal_multiplicity(self):
        view = _view(count=5)
        worlds = _possible_worlds(view)
        deals = Counter(labels for labels, _ in worlds)
        self.assertEqual(deals[("X", "X", "8")], 2)
        self.assertEqual(deals[("4", "6", "8")], 1)
        self.assertEqual(sum(labels[0] == "X" for labels, _ in worlds), 60)
        for labels, murderer in worlds:
            self.assertNotEqual(labels[murderer], "X")

    def test_known_x_removes_one_copy_not_both(self):
        view = _view(alibis=("2", "X"), count=5)
        worlds = _possible_worlds(view)
        self.assertEqual(len(worlds), 210)
        self.assertTrue(any("X" in labels for labels, _ in worlds))
        self.assertTrue(all(labels.count("X") <= 1 for labels, _ in worlds))
        view["your_tiles"] = [{"label": "X"}, {"label": "X"}]
        self.assertTrue(all("X" not in labels for labels, _ in _possible_worlds(view)))

    def test_chooses_known_eight_when_five_is_an_alibi(self):
        for count in range(2, 6):
            view = _view(("8", None, None), ("5", "3"), count)
            if count == 2:
                view["your_tiles"] = [{"label": "3"}]
                view["public_alibi"] = "5"
            with self.subTest(players=count):
                self.assertEqual(choose_action(view), {"type": "place_bet", "suspect_index": 0})

    def test_five_reverses_order_and_allows_inference_of_unseen_murderer(self):
        cases = [
            (("2", "5", None), ("3", "4"), 0),
            (("5", "8", None), ("6", "7"), 2),
        ]
        for labels, alibis, expected in cases:
            with self.subTest(labels=labels):
                view = _view(labels, alibis)
                self.assertEqual(choose_action(view)["suspect_index"], expected)

    def test_hidden_five_prevents_treating_eight_as_certain(self):
        view = _view(("8", None, None))
        counts = Counter(murderer for _, murderer in _possible_worlds(view))
        self.assertEqual(counts, {0: 6, 1: 3, 2: 3})

    def test_x_is_never_accused_when_a_certain_murderer_is_known(self):
        view = _view(("X", "8", None), ("5", "6"), 5)
        self.assertEqual(choose_action(view)["suspect_index"], 1)

    def test_can_accuse_a_blocked_suspect_without_inspecting_it(self):
        view = _view((None, "2", "3"), ("5", "6"))
        view["blocked_suspect_index"] = 0
        view["suspects"][0].update(blocked=True, stack=["p1", "p2"])
        self.assertEqual(choose_action(view)["suspect_index"], 0)

    def test_stack_risk_can_outweigh_higher_murderer_probability(self):
        view = _view(("8", None, None))
        view["suspects"][0]["stack"] = ["p1"]
        view["suspects"][2]["stack"] = ["p2"]
        self.assertEqual(choose_action(view)["suspect_index"], 1)

    def test_final_chip_prioritizes_winning_over_smallest_expected_penalty(self):
        view = _view(("8", None, None))
        view["first_player"] = "p1"
        view["suspects"][0]["stack"] = ["p1"]
        view["suspects"][2]["stack"] = ["p2"]
        self.assertEqual(choose_action(view)["suspect_index"], 1)
        view["players"][0]["hand_count"] = 1
        self.assertEqual(choose_action(view)["suspect_index"], 0)

    def test_projected_settlement_and_terminal_ranking_match_engine(self):
        for count in range(2, 6):
            for final_chip in (False, True):
                state = _state(count, "both")
                state.update(first_player="p1", phase="bet")
                state["turn_context"].update(acted_count=count - 1, viewed_indexes=[1, 2])
                state["players"]["p0"].update(hand_count=1 if final_chip else 7, penalty_count=3)
                for index, player_id in enumerate(state["turn_order"][1:]):
                    state["suspects"][index % 3]["stack"].append(player_id)
                    state["players"][player_id].update(penalty_count=index, own_penalty_count=index % 2)
                murderer = _determine_murderer_index([suspect["tile"] for suspect in state["suspects"]])
                view = Game.get_public_view(state, "p0")
                before = deepcopy(view)
                for bet in range(3):
                    with self.subTest(players=count, final_chip=final_chip, bet=bet):
                        projected = _bet_outcome(view, bet, murderer)
                        resolved = deepcopy(state)
                        _, error = Game.apply_action(resolved, "p0", {"type": "place_bet", "suspect_index": bet})
                        self.assertIsNone(error)
                        ended = resolved["pending_game_over"]
                        won = ended and _final_ranking(resolved)[0]["player_id"] == "p0"
                        self.assertEqual(projected, (resolved["players"]["p0"]["penalty_count"] - 3, ended, won))
                self.assertEqual(view, before)

    def test_inspection_selects_information_that_reduces_expected_stack_loss(self):
        view = _view(alibis=("2", "5"))
        view.update(phase="peek", legal_actions=["peek_suspects"], blocked_suspect_index=0)
        view["suspects"][0].update(blocked=True, stack=["p1"])
        view["suspects"][2]["stack"] = ["p2"]
        self.assertEqual(choose_action(view), {"type": "peek_suspects", "suspect_indexes": [2]})
        view["suspects"][1]["stack"], view["suspects"][2]["stack"] = ["p2"], []
        self.assertEqual(choose_action(view), {"type": "peek_suspects", "suspect_indexes": [1]})

    def test_both_inspection_modes_respect_blocked_suspects(self):
        for mode, count in (("choose_one", 1), ("both", 2)):
            for blocked in range(3):
                state = _state(mode=mode)
                state["blocked_suspect_index"] = blocked
                action = Game.bot_move(state, "p0")
                with self.subTest(mode=mode, blocked=blocked):
                    self.assertEqual(len(action["suspect_indexes"]), count)
                    self.assertNotIn(blocked, action["suspect_indexes"])
                    _, error = Game.apply_action(state, "p0", action)
                    self.assertIsNone(error)

    def test_hidden_tiles_and_opponent_secrets_do_not_affect_decisions(self):
        for mode in ("choose_one", "both"):
            for phase in ("peek", "bet"):
                state = _state(5, mode)
                if phase == "bet":
                    Game.apply_action(state, "p0", Game.bot_move(state, "p0"))
                changed = deepcopy(state)
                hidden = [index for index in range(3) if index not in state["turn_context"]["viewed_indexes"]]
                changed["suspects"][hidden[0]]["tile"], changed["victim"] = (
                    changed["victim"], changed["suspects"][hidden[0]]["tile"],
                )
                changed["removed_tiles"] = [{"id": "secret", "label": "secret", "value": 999}]
                for player_id in changed["turn_order"][1:]:
                    changed["players"][player_id].update(own_tile={"label": "secret"}, passed_tile={"label": "secret"})
                with self.subTest(mode=mode, phase=phase):
                    self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(changed, "p0"))
                    self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(changed, "p0"))

    def test_decisions_do_not_mutate_state_and_survive_save_restore(self):
        state = _state(5)
        before = deepcopy(state)
        action = Game.bot_move(state, "p0")
        self.assertEqual(state, before)
        restored = Game.deserialize(deepcopy(Game.serialize(state)))
        self.assertEqual(Game.bot_move(restored, "p0"), action)
        Game.apply_action(state, "p0", action)
        before = deepcopy(state)
        action = Game.bot_move(state, "p0")
        self.assertEqual(state, before)
        self.assertEqual(Game.bot_move(Game.deserialize(deepcopy(state)), "p0"), action)

    def test_waiting_finished_and_already_ready_bots_do_not_act(self):
        state = _state()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "unknown"))
        state.update(phase="round_end", current_turn=None)
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "next_round", "delay_ms": 0})
        Game.apply_action(state, "p1", Game.bot_move(state, "p1"))
        self.assertEqual(state["phase"], "round_end")
        self.assertIsNone(Game.bot_move(state, "p1"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_inconsistent_legacy_evidence_has_a_legal_fallback(self):
        view = _view(("2", None, None))
        view["suspects"][0]["stack"] = ["p1"]
        self.assertEqual(_possible_worlds(view), [])
        self.assertEqual(choose_action(view), {"type": "place_bet", "suspect_index": 1})
        view.update(phase="peek", legal_actions=["peek_suspects"], peek_count=2, blocked_suspect_index=0)
        self.assertEqual(choose_action(view), {"type": "peek_suspects", "suspect_indexes": [1, 2]})

    def test_seeded_complete_matches_finish_for_every_player_count_and_mode(self):
        for count in range(2, 6):
            for mode in ("choose_one", "both"):
                for seed in range(4):
                    with self.subTest(players=count, mode=mode, seed=seed), \
                            patch("game.in_a_grove.random.shuffle", side_effect=random.Random(seed).shuffle):
                        state = Game.init_game({"inspection_mode": mode}, _players(count))
                        for _ in range(21 * count + 1):
                            if state["game_over"]:
                                break
                            player_id = state["current_turn"] or next(
                                player for player in state["turn_order"] if not state["players"][player]["round_ready"]
                            )
                            action = Game.bot_move(state, player_id)
                            self.assertIsNotNone(action)
                            self.assertIn(action["type"], Game.get_legal_actions(state, player_id))
                            _, error = Game.apply_action(state, player_id, action)
                            self.assertIsNone(error)
                        self.assertTrue(state["game_over"])
                        self.assertLessEqual(state["round"], 7)
                        self.assertEqual(len(state["winner_ids"]), 1)


class InAGroveAiRoomTests(unittest.IsolatedAsyncioTestCase):
    async def test_scheduler_returns_control_to_human_and_waits_at_round_end(self):
        for mode in ("choose_one", "both"):
            with self.subTest(mode=mode):
                state = _state(mode=mode)
                state.update(first_player="p1", current_turn="p1")
                room = app.Room("in-a-grove-ai-test", game_type="in_a_grove", status="in_game", game_state=state)
                room.players = [
                    app.Player(player["player_id"], player["name"], player["seat"], None, is_bot=player["is_bot"])
                    for player in _players()
                ]
                runners = []
                with patch.object(app, "_save_room_state"), patch.object(app, "_emit_game_state", AsyncMock()) as emit_state, \
                        patch.object(app, "_emit_bot_progress", AsyncMock()), patch.object(app.asyncio, "sleep", AsyncMock()):
                    with patch.object(app.asyncio, "create_task", side_effect=runners.append):
                        await app._maybe_run_bots(room)
                    self.assertEqual(len(runners), 1)
                    await runners.pop()
                    self.assertFalse(room.bot_running)
                    self.assertEqual(state["current_turn"], "p0")
                    self.assertEqual(state["phase"], "peek")
                    self.assertEqual(emit_state.await_count, 4)
                    actions = [
                        event["payload"]["action"]
                        for call in emit_state.await_args_list for event in call.args[1]
                        if event["type"] == "bot:action"
                    ]
                    self.assertEqual([action["type"] for action in actions], ["peek_suspects", "place_bet"] * 2)
                    for action in actions:
                        self.assertLessEqual(set(action), {"type", "suspect_index", "suspect_indexes"})
                    for _ in range(2):
                        _, error = Game.apply_action(state, "p0", Game.bot_move(state, "p0"))
                        self.assertIsNone(error)
                    self.assertEqual(state["phase"], "round_end")
                    with patch.object(app.asyncio, "create_task", side_effect=runners.append):
                        await app._maybe_run_bots(room)
                    await runners.pop()
                    self.assertEqual(state["phase"], "round_end")
                    self.assertEqual(state["round"], 1)
                    self.assertFalse(state["players"]["p0"]["round_ready"])
                    self.assertTrue(all(state["players"][player]["round_ready"] for player in ("p1", "p2")))
                    self.assertEqual(emit_state.await_count, 6)


if __name__ == "__main__":
    unittest.main()
