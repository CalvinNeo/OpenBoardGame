import copy
import random
import unittest
from itertools import combinations
from unittest.mock import patch

from game.kobayakawa import KobayakawaGame as Game, _compute_showdown
from game.kobayakawa_ai import _showdown_equity, choose_action
from tests.test_kobayakawa import _players


def _state(count: int = 3) -> dict:
    source = random.Random(32)
    with patch("game.kobayakawa.random.choice", side_effect=source.choice), \
            patch("game.kobayakawa.random.shuffle", side_effect=source.shuffle):
        state = Game.init_game({}, _players(count))
    state.update(current_turn="p0", start_player="p0")
    return state


def _view(hand: int, center: int, drawn=None) -> dict:
    state = _state()
    state["players"]["p0"].update(hand=hand, drawn_card=drawn)
    state["kobayakawa"] = center
    return Game.get_public_view(state, "p0")


def _betting_view(hand: int, center: int) -> dict:
    view = _view(hand, center)
    view.update(phase="betting", legal_actions=["fight", "pass"], pot=2)
    for player in view["players"][1:]:
        player.update(bet_choice="fight", tokens=3)
    return view


class KobayakawaAiTests(unittest.TestCase):
    def test_equity_matches_engine_for_all_hands_and_player_counts(self):
        for hand in range(1, 16):
            for center in (1, 5, 9, 12, 15):
                if hand == center:
                    continue
                pool = tuple(card for card in range(1, 16)
                             if card not in (hand, center) and card % 2 != 0)
                for count in range(1, 6):
                    state = {"kobayakawa": center, "players": {"p0": {"hand": hand}}}
                    fighters = [f"p{index}" for index in range(count + 1)]
                    wins, total = 0, 0
                    for cards in combinations(pool, count):
                        for player_id, card in zip(fighters[1:], cards):
                            state["players"][player_id] = {"hand": card}
                        wins += _compute_showdown(state, fighters)[0] == "p0"
                        total += 1
                    with self.subTest(hand=hand, center=center, opponents=count):
                        self.assertAlmostEqual(_showdown_equity(hand, center, pool, count), wins / total)

    def test_equity_uses_raw_hand_to_break_ties(self):
        self.assertEqual(_showdown_equity(3, 12, (15,), 1), 0.0)
        self.assertEqual(_showdown_equity(15, 12, (3,), 1), 1.0)
        self.assertEqual(_showdown_equity(8, 12, (2, 15), 2), 0.0)
        self.assertEqual(_showdown_equity(1, 2, (), 0), 1.0)
        self.assertEqual(_showdown_equity(1, 2, (), 1), 0.0)

    def test_keeps_low_card_when_bonus_beats_larger_draw(self):
        self.assertEqual(choose_action(_view(3, 12, 9)), {"type": "discard_drawn"})
        self.assertEqual(choose_action(_view(9, 12, 3)), {"type": "keep_drawn"})

    def test_keeps_high_card_when_center_is_small(self):
        self.assertEqual(choose_action(_view(3, 1, 15)), {"type": "keep_drawn"})
        self.assertEqual(choose_action(_view(15, 1, 3)), {"type": "discard_drawn"})

    def test_compares_draw_with_replacing_center(self):
        self.assertEqual(choose_action(_view(15, 12)), {"type": "replace_kobayakawa"})
        self.assertEqual(choose_action(_view(1, 2)), {"type": "replace_kobayakawa"})
        self.assertEqual(choose_action(_view(8, 3)), {"type": "draw_card"})

    def test_bets_on_low_bonus_and_passes_weak_hand(self):
        self.assertEqual(choose_action(_betting_view(3, 12)), {"type": "fight"})
        self.assertEqual(choose_action(_betting_view(2, 3)), {"type": "pass"})

    def test_discards_change_equity_without_reintroducing_known_cards(self):
        view = _betting_view(8, 1)
        self.assertEqual(choose_action(view), {"type": "pass"})
        view["discard_pile"] = list(range(9, 16))
        self.assertEqual(choose_action(view), {"type": "fight"})

    def test_carried_pot_changes_betting_value(self):
        view = _betting_view(8, 1)
        self.assertEqual(choose_action(view), {"type": "pass"})
        view["pot"] = 8
        self.assertEqual(choose_action(view), {"type": "fight"})

    def test_last_player_takes_uncontested_pot_with_any_hand(self):
        view = _betting_view(2, 3)
        view["pot"] = 0
        for player in view["players"][1:]:
            player.update(bet_choice="pass", tokens=4)
        self.assertEqual(choose_action(view), {"type": "fight"})
        view["pot"] = 3
        self.assertEqual(choose_action(view), {"type": "fight"})

    def test_zero_token_players_pass_and_are_not_future_fighters(self):
        state = _state()
        state.update(phase="betting", kobayakawa=3)
        state["players"]["p0"].update(tokens=0, hand=2)
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "pass"})
        state["players"]["p0"]["tokens"] = 4
        for player in ("p1", "p2"):
            state["players"][player]["tokens"] = 0
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "fight"})

    def test_final_round_protects_lead_or_chases_possible_win(self):
        view = _betting_view(8, 1)
        view.update(round=7, pot=1)
        view["config"].update(end_mode="rounds", round_limit=7)
        view["players"][0]["tokens"] = 6
        view["players"][1].update(bet_choice="fight", tokens=4)
        view["players"][2].update(bet_choice="pass", tokens=4)
        self.assertEqual(choose_action(view), {"type": "pass"})
        view["players"][0]["tokens"] = 4
        self.assertEqual(choose_action(view), {"type": "fight"})

    def test_busted_fighter_can_still_win_back_their_last_token(self):
        view = _betting_view(3, 4)
        view["players"][0]["tokens"] = 1
        view["discard_pile"] = [1, 2] + list(range(7, 16))
        self.assertEqual(choose_action(view), {"type": "fight"})
        view["discard_pile"] = []
        self.assertEqual(choose_action(view), {"type": "pass"})

    def test_noncurrent_unknown_and_finished_players_do_not_act(self):
        state = _state()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "missing"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))
        self.assertIsNone(choose_action({"legal_actions": []}))

    def test_empty_deck_does_not_produce_rejected_action(self):
        state = _state()
        state["deck"] = []
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_hidden_hands_and_deck_never_affect_policy(self):
        for phase in ("action", "drawn", "betting"):
            for count in range(3, 7):
                with self.subTest(phase=phase, players=count):
                    state = _state(count)
                    if phase == "drawn":
                        Game.apply_action(state, "p0", {"type": "draw_card"})
                    elif phase == "betting":
                        state["phase"] = "betting"
                    original = copy.deepcopy(state)
                    expected = Game.bot_move(state, "p0")
                    self.assertIsNotNone(expected)
                    self.assertEqual(state, original)
                    altered = copy.deepcopy(state)
                    hidden = list(altered["deck"])
                    hidden.extend(altered["players"][player_id]["hand"]
                                  for player_id in altered["turn_order"][1:])
                    random.Random(73).shuffle(hidden)
                    for player_id in altered["turn_order"][1:]:
                        altered["players"][player_id]["hand"] = hidden.pop()
                    altered["deck"] = hidden
                    self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(altered, "p0"))
                    self.assertEqual(Game.bot_move(altered, "p0"), expected)
                    self.assertEqual(choose_action(Game.get_public_view(state, "p0")), expected)

    def test_decisions_do_not_mutate_view_or_random_state(self):
        view = _view(15, 12)
        original = copy.deepcopy(view)
        source_state = random.getstate()
        expected = choose_action(view)
        self.assertEqual(choose_action(view), expected)
        self.assertEqual(view, original)
        self.assertEqual(random.getstate(), source_state)

    def test_complete_games_are_legal_and_conserve_tokens(self):
        for count in range(3, 7):
            for end_mode in ("rounds", "bankrupt"):
                for seed in range(4):
                    with self.subTest(players=count, end_mode=end_mode, seed=seed):
                        source = random.Random(seed)
                        with patch("game.kobayakawa.random.choice", side_effect=source.choice), \
                                patch("game.kobayakawa.random.shuffle", side_effect=source.shuffle):
                            state = Game.init_game({"end_mode": end_mode}, _players(count))
                            for step in range(2000):
                                if state["game_over"]:
                                    break
                                actor = state["current_turn"]
                                action = Game.bot_move(state, actor)
                                self.assertIsNotNone(action)
                                self.assertIn(action["type"], Game.get_legal_actions(state, actor))
                                self.assertIsNone(Game.apply_action(state, actor, action)[1])
                                balances = [player["tokens"] for player in state["players"].values()]
                                self.assertTrue(all(tokens >= 0 for tokens in balances))
                                self.assertEqual(sum(balances) + state["pot"], count * 4)
                            self.assertTrue(state["game_over"])
                            self.assertTrue(state["winner"])
                            if end_mode == "rounds":
                                self.assertEqual(state["round"], 7)


if __name__ == "__main__":
    unittest.main()
