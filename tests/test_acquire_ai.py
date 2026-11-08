import copy
import unittest
from unittest.mock import AsyncMock, patch

from jsonschema import Draft7Validator

import app
from game.acquire import AcquireGame, BANK_SHARES, CHAIN_IDS, _can_end_game, _recount_chain_sizes
from game.acquire_ai import _equities, _position
from game.definitions import ACQUIRE_ACTION_SCHEMA
from tests.test_room_session import DummySio


def make_state(count: int = 3, seed: int = 1) -> dict:
    players = [
        {"player_id": f"p{index}", "name": f"Player {index}", "seat": index, "is_bot": True}
        for index in range(count)
    ]
    state = AcquireGame.init_game({"seed": seed}, players)
    state.update(
        board={}, draw_pile=[], turn_order=[player["player_id"] for player in players],
        current_turn="p0", current_turn_index=0, turn_stage="play_tile",
    )
    for index, player_id in enumerate(state["turn_order"]):
        state["players"][player_id]["hand"] = [f"{index + 7}I"]
    return state


def set_chain(state: dict, chain_id: str, tiles: list, holdings: tuple = ()) -> None:
    state["board"].update({tile: chain_id for tile in tiles})
    state["chains"][chain_id]["active"] = True
    for player_id, shares in zip(state["turn_order"], holdings):
        state["players"][player_id]["stocks"][chain_id] = shares
    _recount_chain_sizes(state)


def merger_state(holdings: tuple = (6, 0, 0), acquiring: tuple = (0, 2, 1)) -> dict:
    state = make_state()
    set_chain(state, "worldwide", ["5D", "5E"], holdings)
    set_chain(state, "festival", ["7D", "7E", "8E"], acquiring)
    state["players"]["p0"]["hand"] = ["6D"]
    _, error = AcquireGame.apply_action(state, "p0", {"type": "play_tile", "tile": "6D"})
    if error:
        raise AssertionError(error)
    return state


class AcquireAiTests(unittest.TestCase):
    def assert_valid_action(self, state: dict, player_id: str = "p0") -> dict:
        before = copy.deepcopy(state)
        action = AcquireGame.bot_move(state, player_id)
        self.assertIsInstance(action, dict)
        self.assertEqual(action, AcquireGame.bot_move(state, player_id))
        self.assertEqual(state, before)
        Draft7Validator(ACQUIRE_ACTION_SCHEMA).validate(action)
        _, error = AcquireGame.apply_action(copy.deepcopy(state), player_id, action)
        self.assertIsNone(error, (player_id, action, error))
        return action

    def test_places_founding_tile_instead_of_first_legal_tile(self):
        state = make_state()
        state["board"] = {"1A": "orphan"}
        state["players"]["p0"]["hand"] = ["12I", "1B"]
        self.assertEqual(self.assert_valid_action(state), {"type": "play_tile", "tile": "1B"})

    def test_places_orphan_next_to_own_future_founding_tile(self):
        state = make_state()
        state["board"] = {"1A": "orphan"}
        state["players"]["p0"]["hand"] = ["12I", "5D", "5E"]
        self.assertIn(self.assert_valid_action(state)["tile"], ["5D", "5E"])

    def test_expands_own_investment_instead_of_opponents_chain(self):
        state = make_state()
        set_chain(state, "worldwide", ["1A", "1B"], (5, 0, 0))
        set_chain(state, "festival", ["6A", "6B"], (0, 5, 0))
        state["players"]["p0"]["hand"] = ["6C", "1C"]
        self.assertEqual(self.assert_valid_action(state)["tile"], "1C")

    def test_founds_chain_with_retained_investment(self):
        state = make_state()
        state["board"] = {"1A": "orphan"}
        state["players"]["p0"]["hand"] = ["1B"]
        state["players"]["p0"]["stocks"]["tower"] = 12
        _recount_chain_sizes(state)
        _, error = AcquireGame.apply_action(state, "p0", {"type": "play_tile", "tile": "1B"})
        self.assertIsNone(error)
        self.assertEqual(self.assert_valid_action(state), {"type": "choose_chain", "chain_id": "tower"})

    def test_buys_three_shares_of_one_chain_to_take_majority(self):
        state = make_state()
        set_chain(state, "worldwide", ["1A", "1B"], (2, 4, 1))
        state["turn_stage"] = "buy"
        self.assertEqual(self.assert_valid_action(state)["chain_ids"], ["worldwide"] * 3)

    def test_contests_majority_instead_of_buying_only_cheapest_stock(self):
        state = make_state()
        set_chain(state, "worldwide", ["1A", "1B"], (0, 10, 0))
        set_chain(state, "continental", ["6A", "6B"], (3, 4, 1))
        state["turn_stage"] = "buy"
        self.assertGreaterEqual(self.assert_valid_action(state)["chain_ids"].count("continental"), 2)

    def test_keeps_cash_when_stock_cannot_earn_growth_or_bonus(self):
        state = make_state()
        set_chain(state, "worldwide", [f"{column}A" for column in range(1, 12)], (0, 10, 10))
        state["turn_stage"] = "buy"
        self.assertEqual(self.assert_valid_action(state), {"type": "buy_stocks", "chain_ids": [], "declare_end": False})

    def test_purchase_respects_budget_and_bank_inventory(self):
        state = make_state()
        set_chain(state, "worldwide", ["1A", "1B"], (12, 12, 0))
        state["turn_stage"] = "buy"
        for money, expected in [(0, []), (199, []), (200, ["worldwide"]), (6000, ["worldwide"])]:
            with self.subTest(money=money):
                state["players"]["p0"]["money"] = money
                self.assertEqual(self.assert_valid_action(state)["chain_ids"], expected)

    def test_buys_majority_then_declares_winning_end(self):
        state = make_state(2)
        set_chain(state, "worldwide", [f"{column}A" for column in range(1, 12)], (0, 1))
        state["players"]["p0"]["money"] = 9000
        state["turn_stage"] = "buy"
        values = _equities(_position(AcquireGame.get_public_view(state, "p0")))
        self.assertLess(values["p0"], values["p1"])
        action = self.assert_valid_action(state)
        self.assertTrue(action["declare_end"])
        self.assertEqual(action["chain_ids"], ["worldwide"] * 2)
        _, error = AcquireGame.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p0"])

    def test_does_not_declare_losing_end_despite_cash_lead(self):
        state = make_state(2)
        set_chain(state, "worldwide", [f"{column}A" for column in range(1, 12)], (1, 24))
        state["players"]["p0"]["money"] = 10000
        state["turn_stage"] = "buy"
        self.assertTrue(_can_end_game(state))
        self.assertEqual(self.assert_valid_action(state), {"type": "buy_stocks", "chain_ids": [], "declare_end": False})

    def test_legacy_end_turn_handles_shared_win(self):
        state = make_state(2)
        set_chain(state, "worldwide", [f"{column}A" for column in range(1, 12)])
        state["turn_stage"] = "end_turn"
        self.assertEqual(self.assert_valid_action(state), {"type": "end_turn", "declare_end": True})

    def test_acquirer_choice_accounts_for_investments_and_share_shortage(self):
        state = make_state()
        set_chain(state, "worldwide", ["5D", "5E"], (20, 0, 0))
        set_chain(state, "festival", ["7D", "7E"], (0, 25, 0))
        state["players"]["p0"]["hand"] = ["6D"]
        _, error = AcquireGame.apply_action(state, "p0", {"type": "play_tile", "tile": "6D"})
        self.assertIsNone(error)
        self.assertEqual(state["pending"]["choice"], "acquirer")
        self.assertEqual(self.assert_valid_action(state), {"type": "choose_chain", "chain_id": "worldwide"})

    def test_trades_for_profitable_survivor_majority(self):
        state = merger_state()
        self.assertEqual(self.assert_valid_action(state), {"type": "dispose_stock", "sell": 0, "trade": 3, "hold": 0})

    def test_sells_instead_of_exchanging_two_expensive_shares_for_one(self):
        state = make_state()
        set_chain(state, "worldwide", [f"{column}{row}" for row in "AB" for column in range(1, 6)], (2, 10, 5))
        set_chain(state, "festival", [f"{column}A" for column in range(7, 13)] + [f"{column}B" for column in range(7, 12)], (0, 8, 7))
        state["players"]["p0"]["money"] = 0
        state["players"]["p0"]["hand"] = ["6A"]
        _, error = AcquireGame.apply_action(state, "p0", {"type": "play_tile", "tile": "6A"})
        self.assertIsNone(error)
        self.assertEqual(self.assert_valid_action(state), {"type": "dispose_stock", "sell": 2, "trade": 0, "hold": 0})

    def test_holds_small_speculative_position_when_revival_is_valuable(self):
        state = merger_state((3, 0, 0), (0, 13, 12))
        action = self.assert_valid_action(state)
        self.assertGreater(action["hold"], 0)
        self.assertGreater(action["sell"], 0)
        self.assertEqual(action["trade"], 0)

    def test_disposal_respects_limited_and_exhausted_survivor_stock(self):
        for acquiring, available in [((0, 12, 12), 1), ((0, 13, 12), 0)]:
            with self.subTest(available=available):
                state = merger_state((6, 0, 0), acquiring)
                action = self.assert_valid_action(state)
                self.assertLessEqual(action["trade"], available)
                self.assertEqual(action["sell"] + action["hold"] + 2 * action["trade"], 6)

    def test_shareholder_acts_during_another_players_turn(self):
        state = merger_state((0, 2, 0), (0, 0, 1))
        self.assertEqual(state["current_turn"], "p0")
        self.assertEqual(AcquireGame.get_legal_actions(state, "p0"), [])
        self.assertIsNone(AcquireGame.bot_move(state, "p0"))
        action = self.assert_valid_action(state, "p1")
        self.assertEqual(action["type"], "dispose_stock")
        _, error = AcquireGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        self.assertIsNone(state["pending"])
        self.assertEqual(state["turn_stage"], "buy")
        self.assertEqual(state["current_turn"], "p0")

    def test_tied_defunct_order_and_all_disposals_complete(self):
        state = make_state()
        set_chain(state, "worldwide", ["5D", "5E"], (4, 1, 0))
        set_chain(state, "festival", ["7D", "7E"], (0, 4, 1))
        set_chain(state, "american", ["6A", "6B", "6C"], (1, 1, 0))
        state["players"]["p0"]["hand"] = ["6D"]
        _, error = AcquireGame.apply_action(state, "p0", {"type": "play_tile", "tile": "6D"})
        self.assertIsNone(error)
        self.assertEqual(state["pending"]["choice"], "defunct")
        for step in range(12):
            if state["pending"] is None:
                break
            actor = next(player_id for player_id in state["turn_order"] if AcquireGame.get_legal_actions(state, player_id))
            action = self.assert_valid_action(state, actor)
            _, error = AcquireGame.apply_action(state, actor, action)
            self.assertIsNone(error, step)
        self.assertIsNone(state["pending"])
        self.assertEqual(state["chains"]["american"]["size"], 8)
        self.assertEqual(state["turn_stage"], "buy")

    def test_decisions_ignore_opponents_hands_draw_order_and_seed(self):
        players = [{"player_id": f"p{index}", "name": str(index), "seat": index} for index in range(3)]
        original = AcquireGame.init_game({"seed": 11}, players)
        actor = original["current_turn"]
        changed = copy.deepcopy(original)
        opponents = [player_id for player_id in original["turn_order"] if player_id != actor]
        hidden = list(original["draw_pile"])
        for player_id in opponents:
            hidden.extend(original["players"][player_id]["hand"])
        hidden.reverse()
        for player_id in opponents:
            changed["players"][player_id]["hand"], hidden = hidden[:6], hidden[6:]
        changed["draw_pile"] = hidden
        changed["config"]["seed"] = 999
        for stage in ("play_tile", "buy"):
            with self.subTest(stage=stage):
                original["turn_stage"] = changed["turn_stage"] = stage
                self.assertEqual(AcquireGame.get_public_view(original, actor), AcquireGame.get_public_view(changed, actor))
                self.assertEqual(self.assert_valid_action(original, actor), self.assert_valid_action(changed, actor))

    def test_serialized_merger_resumes_with_same_decision(self):
        state = merger_state()
        restored = AcquireGame.deserialize(AcquireGame.serialize(state))
        self.assertEqual(self.assert_valid_action(state), self.assert_valid_action(restored))

    def test_unknown_inactive_and_finished_players_do_not_act(self):
        state = make_state()
        self.assertIsNone(AcquireGame.bot_move(state, "unknown"))
        self.assertIsNone(AcquireGame.bot_move(state, "p1"))
        state["game_over"] = True
        self.assertIsNone(AcquireGame.bot_move(state, "p0"))

    def test_empty_hand_advances_to_buy_without_skipping_other_players(self):
        state = make_state()
        state["players"]["p0"]["hand"] = []
        self.assertEqual(AcquireGame.get_public_view(state, "p0")["turn_stage"], "buy")
        self.assertEqual(AcquireGame.get_legal_actions(state, "p0"), ["buy_stocks"])
        action = self.assert_valid_action(state)
        _, error = AcquireGame.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["turn_stage"], "play_tile")

    def test_empty_next_hand_can_still_buy(self):
        state = make_state()
        state["turn_stage"] = "buy"
        state["players"]["p1"]["hand"] = []
        _, error = AcquireGame.apply_action(state, "p0", {"type": "buy_stocks", "chain_ids": [], "declare_end": False})
        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["turn_stage"], "buy")
        self.assertFalse(state["game_over"])

    def test_exhausted_board_finishes_without_optional_end_condition(self):
        state = make_state()
        set_chain(state, "worldwide", ["1A", "1B"], (4, 3, 0))
        state["turn_stage"] = "buy"
        for player in state["players"].values():
            player["hand"] = []
        self.assertFalse(_can_end_game(state))
        expected = _equities(_position(AcquireGame.get_public_view(state, "p0")))
        events, error = AcquireGame.apply_action(state, "p0", {"type": "buy_stocks", "chain_ids": [], "declare_end": False})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual({player_id: player["money"] for player_id, player in state["players"].items()}, expected)
        self.assertEqual(len([event for event in events if event["type"] == "acquire:game_over"]), 1)

    def test_buying_cannot_skip_a_playable_tile(self):
        state = make_state()
        before = copy.deepcopy(state)
        _, error = AcquireGame.apply_action(state, "p0", {"type": "buy_stocks", "chain_ids": [], "declare_end": False})
        self.assertEqual(error, "cannot buy stocks now")
        self.assertEqual(state, before)

    def test_saved_dead_only_hand_can_buy_then_finish_without_looping(self):
        state = make_state(2)
        set_chain(state, "worldwide", [f"{column}{row}" for row in "ABC" for column in range(1, 6)], (5, 0))
        set_chain(state, "festival", [f"{column}{row}" for row in "ABC" for column in range(7, 11)], (0, 5))
        state["players"]["p0"]["hand"] = ["6A"]
        state["players"]["p1"]["hand"] = ["6B"]
        before = copy.deepcopy(state)
        view = AcquireGame.get_public_view(state, "p0")
        self.assertEqual(view["turn_stage"], "buy")
        self.assertEqual(AcquireGame.get_legal_actions(state, "p0"), ["buy_stocks"])
        self.assertEqual(state, before)
        self.assert_valid_action(state)
        events, error = AcquireGame.apply_action(state, "p0", {"type": "buy_stocks", "chain_ids": [], "declare_end": False})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(events[-1]["type"], "acquire:game_over")

    def test_drawing_replacement_tile_does_not_end_game_early(self):
        state = make_state(2)
        state["turn_stage"] = "buy"
        state["draw_pile"] = ["2A"]
        for player in state["players"].values():
            player["hand"] = []
        _, error = AcquireGame.apply_action(state, "p0", {"type": "buy_stocks", "chain_ids": [], "declare_end": False})
        self.assertIsNone(error)
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["players"]["p1"]["hand"], ["2A"])
        self.assertEqual(state["turn_stage"], "play_tile")

    def test_full_bot_games_finish_with_legal_actions_and_conserved_stocks(self):
        validator = Draft7Validator(ACQUIRE_ACTION_SCHEMA)
        action_types = set()
        for count in range(2, 7):
            for seed in range(5):
                with self.subTest(players=count, seed=seed):
                    players = [{"player_id": f"p{index}", "name": str(index), "seat": index} for index in range(count)]
                    state = AcquireGame.init_game({"seed": seed}, players)
                    for step in range(600):
                        if state["game_over"]:
                            break
                        actors = [player_id for player_id in state["turn_order"] if AcquireGame.get_legal_actions(state, player_id)]
                        self.assertEqual(len(actors), 1, (step, state["pending"]))
                        actor = actors[0]
                        before = copy.deepcopy(state)
                        action = AcquireGame.bot_move(state, actor)
                        self.assertEqual(state, before)
                        self.assertIsNotNone(action, (step, actor, state["turn_stage"]))
                        validator.validate(action)
                        action_types.add(action["type"])
                        _, error = AcquireGame.apply_action(state, actor, action)
                        self.assertIsNone(error, (step, actor, action, error))
                        self.assertTrue(all(player["money"] >= 0 for player in state["players"].values()))
                        if not state["game_over"]:
                            for chain_id in CHAIN_IDS:
                                held = sum(player["stocks"][chain_id] for player in state["players"].values())
                                self.assertLessEqual(held, BANK_SHARES)
                                if not state["pending"]:
                                    self.assertEqual(state["chains"][chain_id]["available_shares"] + held, BANK_SHARES)
                    self.assertTrue(state["game_over"], (count, seed, state["turn_stage"]))
                    self.assertTrue(state["winner"])
        self.assertTrue({"play_tile", "choose_chain", "dispose_stock", "buy_stocks"} <= action_types)


class AcquireAiRoomTests(unittest.IsolatedAsyncioTestCase):
    async def test_catalog_marks_acquire_as_strategic_ai(self):
        catalog = {entry["game_id"]: entry for entry in await app.api_list_games()}
        self.assertTrue(catalog["acquire"]["has_strategic_ai"])

    async def test_room_can_add_bot_and_start_acquire(self):
        with patch.object(app, "sio", DummySio()), patch.object(app, "ROOMS", {}), patch.object(app, "SESSIONS", {}), \
                patch.object(app, "_save_room_state"), patch.object(app, "_maybe_run_bots", AsyncMock()):
            await app.on_room_create("sid", {"name": "Human", "game_type": "acquire", "config": {"seed": 3}})
            room = app.ROOMS[app.SESSIONS["sid"]["room_id"]]
            await app.on_room_add_bot("sid", {})
            self.assertEqual(len(room.players), 2)
            self.assertTrue(room.players[1].is_bot)
            room.players[0].ready = True
            await app.on_room_start("sid", {})
            self.assertEqual(room.status, "in_game")
            self.assertIsNotNone(room.game_state)
            app._maybe_run_bots.assert_awaited_once_with(room)

    async def test_scheduler_runs_shareholder_bot_then_returns_control_to_human(self):
        state = merger_state((0, 2, 0), (0, 0, 1))
        room = app.Room("acquire-ai-test", game_type="acquire", status="in_game", game_state=state)
        room.players = [
            app.Player(player_id, player_id, index, None, is_bot=player_id == "p1")
            for index, player_id in enumerate(state["turn_order"])
        ]
        runners = []
        with patch.object(app, "_save_room_state"), patch.object(app, "_emit_game_state", AsyncMock()) as emit_state, \
                patch.object(app, "_emit_bot_progress", AsyncMock()), patch.object(app.asyncio, "sleep", AsyncMock()):
            with patch.object(app.asyncio, "create_task", side_effect=runners.append):
                await app._maybe_run_bots(room)
            self.assertEqual(len(runners), 1)
            await runners[0]
        self.assertFalse(room.bot_running)
        self.assertIsNone(state["pending"])
        self.assertEqual(state["current_turn"], "p0")
        self.assertEqual(state["turn_stage"], "buy")
        self.assertEqual(emit_state.await_count, 1)
        events = emit_state.await_args.args[1]
        self.assertTrue(any(event["type"] == "bot:action" for event in events))


if __name__ == "__main__":
    unittest.main()
