import asyncio
import copy
import json
import random
import unittest
from unittest.mock import patch

from game.texas_holdem import RANKS, SUITS, TexasHoldemGame as Game
from game.texas_holdem_ai import _estimate_equity, choose_action


def cards(*labels):
    return [{"rank": int(label[:-1]), "suit": label[-1]} for label in labels]


def new_game(count=2, config=None, seed=17):
    players = [{"player_id": f"p{index}", "name": f"Player {index}",
                "seat": index, "is_bot": index != 0} for index in range(count)]
    with patch("game.texas_holdem.random.shuffle", side_effect=random.Random(seed).shuffle):
        return Game.init_game(config or {}, players)


def set_cards(state, hole, board):
    known = {(card["rank"], card["suit"]) for card in hole + board}
    deck = [{"rank": rank, "suit": suit} for suit in SUITS for rank in RANKS
            if (rank, suit) not in known]
    state["players"]["p0"]["hole"] = hole
    state["community_cards"] = board
    for pid in state["turn_order"][1:]:
        state["players"][pid]["hole"] = [deck.pop(), deck.pop()]
    state["deck"] = deck


def river_state(hole=None, board=None, bet=0, count=2):
    state = new_game(count)
    state.update(phase="river", current_turn="p0", dealer_index=1,
                 current_bet=bet, min_raise=max(10, bet), acted_since_raise=[])
    for pid, player in state["players"].items():
        current = bet if pid != "p0" else 0
        player.update(chips=1000 - current, current_bet=current, total_bet=100 + current, status="active")
    set_cards(state, hole or cards("14S", "13S"), board or cards("12S", "11S", "10S", "2H", "3D"))
    return state


class TexasHoldemAiTests(unittest.TestCase):
    def assert_legal_move(self, state, pid="p0"):
        before = copy.deepcopy(state)
        action = Game.bot_move(state, pid)
        self.assertEqual(state, before, "AI thinking must not mutate the live game")
        self.assertIsNotNone(action)
        self.assertIn(action["type"], Game.get_legal_actions(state, pid))
        _, error = Game.apply_action(copy.deepcopy(state), pid, action)
        self.assertIsNone(error, (action, error))
        return action

    def test_premium_preflop_hand_raises(self):
        state = new_game()
        set_cards(state, cards("14S", "14H"), [])
        action = self.assert_legal_move(state)
        self.assertEqual(action, {"type": "raise", "amount": 30})

    def test_weak_preflop_hand_folds_to_large_raise(self):
        state = new_game()
        set_cards(state, cards("7S", "2H"), [])
        state.update(current_bet=300, min_raise=290)
        state["players"]["p1"].update(current_bet=300, total_bet=300, chips=700)
        self.assertEqual(self.assert_legal_move(state), {"type": "fold"})

    def test_nuts_bet_and_raise_with_valid_amounts(self):
        for bet in (0, 100):
            with self.subTest(bet=bet):
                state = river_state(bet=bet)
                action = self.assert_legal_move(state)
                self.assertEqual(action["type"], "raise" if bet else "bet")
                self.assertGreaterEqual(action["amount"], bet + state["min_raise"])
                self.assertLessEqual(action["amount"], state["players"]["p0"]["chips"])

    def test_weak_river_checks_for_free_and_folds_to_bet(self):
        for bet in (0, 300):
            with self.subTest(bet=bet):
                state = river_state(cards("7S", "2H"), cards("14H", "13D", "9C", "5S", "3D"), bet)
                self.assertEqual(self.assert_legal_move(state), {"type": "fold" if bet else "check"})

    def test_draw_calls_a_cheap_bet(self):
        state = river_state(bet=10)
        state["phase"] = "turn"
        set_cards(state, cards("13S", "12S"), cards("14S", "9S", "2D", "4C"))
        self.assertEqual(self.assert_legal_move(state), {"type": "call"})

    def test_short_stack_opens_or_raises_all_in(self):
        for bet, chips in ((0, 5), (0, 30), (10, 25)):
            with self.subTest(bet=bet, chips=chips):
                state = river_state(bet=bet)
                state["players"]["p0"]["chips"] = chips
                self.assertEqual(self.assert_legal_move(state), {"type": "all_in"})

    def test_short_stack_calls_only_available_chips(self):
        state = river_state(bet=100)
        state["players"]["p0"]["chips"] = 25
        action = self.assert_legal_move(state)
        self.assertEqual(action, {"type": "call"})
        _, error = Game.apply_action(state, "p0", action)
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p0"]["status"], "all_in")
        self.assertEqual(state["players"]["p0"]["total_bet"], 125)

    def test_short_opposing_all_in_does_not_reopen_raising(self):
        state = river_state(bet=150, count=3)
        state.update(min_raise=100, acted_since_raise=["p0", "p1"])
        state["players"]["p0"].update(current_bet=100, total_bet=200)
        state["players"]["p1"].update(status="all_in", chips=0)
        self.assertNotIn("raise", Game.get_legal_actions(state, "p0"))
        self.assertEqual(self.assert_legal_move(state), {"type": "call"})

    def test_does_not_bet_into_all_in_opponents(self):
        state = river_state()
        state["players"]["p1"].update(status="all_in", chips=0)
        self.assertEqual(self.assert_legal_move(state), {"type": "check"})

    def test_side_pot_cannot_make_an_unprofitable_call_look_cheap(self):
        state = river_state(count=3, bet=900)
        state["players"]["p0"].update(chips=100, total_bet=0)
        # A 30% chance does not justify paying 100 for a 300 main pot,
        # even though the much larger side pot is displayed on the table.
        with patch("game.texas_holdem_ai._estimate_equity", return_value=0.30):
            self.assertEqual(self.assert_legal_move(state), {"type": "fold"})

    def test_folded_contributions_still_improve_call_odds(self):
        state = river_state(count=3, bet=10)
        state["players"]["p2"].update(status="folded", total_bet=1000)
        state["players"]["p0"]["total_bet"] = 1000
        with patch("game.texas_holdem_ai._estimate_equity", return_value=0.15):
            self.assertEqual(self.assert_legal_move(state), {"type": "call"})

    def test_equity_recognizes_nuts_and_splits_board_royal_flush(self):
        royal = cards("14S", "13S", "12S", "11S", "10S")
        for opponents in (1, 5, 9):
            with self.subTest(opponents=opponents):
                equity = _estimate_equity(cards("2D", "3H"), royal, opponents, random.Random(1))
                self.assertAlmostEqual(equity, 1 / (opponents + 1))
        self.assertEqual(_estimate_equity(royal[:2], royal[2:] + cards("2H", "3D"), 3, random.Random(2)), 1)

    def test_hidden_cards_and_deck_cannot_change_decision(self):
        for state in (new_game(6), river_state(count=6)):
            pid = state["current_turn"]
            altered = copy.deepcopy(state)
            altered["deck"].reverse()
            for other in state["turn_order"]:
                if other != pid:
                    altered["players"][other]["hole"] = [altered["deck"].pop(), altered["deck"].pop()]
            self.assertEqual(Game.get_public_view(state, pid), Game.get_public_view(altered, pid))
            self.assertEqual(Game.bot_move(state, pid), Game.bot_move(altered, pid))

    def test_decisions_are_repeatable_after_save_and_do_not_consume_game_rng(self):
        state = new_game()
        before = copy.deepcopy(state)
        random_state = random.getstate()
        first = Game.bot_move(state, "p0")
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(Game.bot_move(restored, "p0"), first)
        self.assertEqual(choose_action(Game.get_public_view(state, "p0")), first)
        self.assertEqual(random.getstate(), random_state)
        self.assertEqual(state, before)

    def test_waiting_players_spectators_and_finished_games_do_not_act(self):
        state = new_game()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "spectator"))
        state["players"]["p0"]["status"] = "folded"
        self.assertIsNone(Game.bot_move(state, "p0"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_multiple_hands_finish_and_conserve_chips(self):
        for count, chips in ((2, 1000), (6, 120), (10, 20)):
            with self.subTest(count=count, chips=chips):
                state = new_game(count, {"starting_chips": chips})
                total = count * chips
                shuffle = random.Random(31).shuffle
                with patch("game.texas_holdem.random.shuffle", side_effect=shuffle):
                    for _ in range(600):
                        if state["hand_number"] == 4:
                            break
                        pid = state["current_turn"]
                        if state["phase"] == "hand_end":
                            pid = next((pid for pid in state["turn_order"]
                                        if Game.get_legal_actions(state, pid)), None)
                        self.assertIsNotNone(pid, "AI table stalled")
                        action = self.assert_legal_move(state, pid)
                        if action["type"] == "rebuy":
                            total += chips
                        _, error = Game.apply_action(state, pid, action)
                        self.assertIsNone(error)
                        stacks = sum(player["chips"] for player in state["players"].values())
                        pot = sum(player["total_bet"] for player in state["players"].values())
                        self.assertEqual(stacks + (pot if state["phase"] != "hand_end" else 0), total)
                        self.assertTrue(all(player["chips"] >= 0 for player in state["players"].values()))
                    else:
                        self.fail("AI table did not complete three hands")


class TexasHoldemAiRoomTests(unittest.IsolatedAsyncioTestCase):
    async def test_add_bot_play_hand_and_wait_for_human(self):
        import app
        from tests.test_room_session import DummySio

        async def wait_for_bots(room):
            async def finished():
                while room.bot_running:
                    await asyncio.sleep(0.01)
            await asyncio.wait_for(finished(), timeout=15)

        with patch.object(app, "sio", DummySio()), patch.object(app, "ROOMS", {}), \
                patch.object(app, "SESSIONS", {}), patch.object(app, "_save_room_state"), \
                patch("game.texas_holdem.random.shuffle", side_effect=random.Random(17).shuffle):
            await app.on_room_create("human", {"name": "Human", "game_type": "texas_holdem"})
            room = app.ROOMS[app.SESSIONS["human"]["room_id"]]
            human = room.players[0].player_id
            await app.on_room_add_bot("human", {})
            self.assertTrue(room.players[1].is_bot)
            await app.on_room_start("human", {})
            await wait_for_bots(room)
            for _ in range(100):
                if room.game_state["phase"] == "hand_end":
                    break
                self.assertEqual(room.game_state["current_turn"], human)
                legal = Game.get_legal_actions(room.game_state, human)
                action_type = "check" if "check" in legal else "call"
                await app.on_game_action("human", {"action": {"type": action_type}})
                await wait_for_bots(room)
            else:
                self.fail("Human and bot could not finish a hand")
            bot = room.players[1].player_id
            self.assertEqual(room.game_state["hand_number"], 1)
            self.assertNotIn(human, room.game_state["next_hand_ready"])
            events = [event for item in app.sio.emits if item["event"] == "game:state"
                      for event in item["payload"].get("events", [])]
            self.assertTrue(any(event["type"] == "bot:action" for event in events))
            if "rebuy" in Game.get_legal_actions(room.game_state, human):
                await app.on_game_action("human", {"action": {"type": "rebuy"}})
                await wait_for_bots(room)
            self.assertEqual(room.game_state["phase"], "hand_end")
            self.assertEqual(room.game_state["next_hand_ready"], [bot])
            await app.on_game_action("human", {"action": {"type": "next_hand"}})
            await wait_for_bots(room)
            self.assertEqual(room.game_state["hand_number"], 2)
            errors = [event for event in app.sio.emits if event["event"] == "system:error"]
            self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
