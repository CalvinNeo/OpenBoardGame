import copy
import json
import random
import unittest
from collections import Counter
from unittest.mock import patch

from game import get_game
from game.love_letter import CARDS, LoveLetterGame as Game


def players(count=3):
    return [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index}
            for index in range(count)]


class LoveLetterTests(unittest.TestCase):
    def fixture(self, hands, deck=None):
        state = Game.init_game({}, players(len(hands)))
        state.update(current_turn="p0", start_player="p0", turn=1, phase="play",
                     deck=[1, 2, 4, 5] if deck is None else list(deck), reserve=2, removed=[])
        for index, hand in enumerate(hands):
            state["players"][f"p{index}"].update(hand=list(hand), alive=bool(hand), discards=[],
                                                 protected=False, eliminated_by=None, tokens=0)
        return state

    def play(self, state, card, target=None, guess=None, actor=None):
        action = {"type": "play_card", "card": card, "round": state["round"], "turn": state["turn"]}
        if target is not None:
            action["target"] = target
        if guess is not None:
            action["guess"] = guess
        events, error = Game.apply_action(state, actor or state["current_turn"], action)
        self.assertIsNone(error)
        return events

    def assert_conserved(self, state):
        cards = state["deck"] + state["removed"]
        if state["reserve"] is not None:
            cards += [state["reserve"]]
        for player in state["players"].values():
            cards += player["hand"] + player["discards"]
        self.assertEqual(Counter(cards), Counter({rank: card["count"] for rank, card in CARDS.items()}))

    def test_registration_setup_and_card_conservation(self):
        self.assertEqual(get_game("love_letter").name_zh, "情书")
        for count, goal in [(2, 7), (3, 5), (4, 4)]:
            state = Game.init_game({}, players(count))
            self.assertEqual(state["token_goal"], goal)
            self.assertEqual(len(state["removed"]), 3 if count == 2 else 0)
            self.assertEqual(len(state["deck"]), 16 - 1 - len(state["removed"]) - count - 1)
            self.assertEqual(len(state["players"][state["current_turn"]]["hand"]), 2)
            self.assert_conserved(state)

    def test_bad_configuration_and_players(self):
        for config in [{"seed": 1}, {"tokens": 1}, [], False]:
            with self.assertRaises(ValueError):
                Game.init_game(config, players())
        for count in [0, 1, 5]:
            with self.assertRaises(ValueError):
                Game.init_game({}, players(count))
        with self.assertRaises(ValueError):
            Game.init_game({}, [players()[0], players()[0]])

    def test_guard_hit_and_miss(self):
        state = self.fixture([[1, 8], [6], [5]])
        self.play(state, 1, "p1", 6)
        self.assertFalse(state["players"]["p1"]["alive"])
        self.assertEqual(state["players"]["p1"]["discards"], [6])
        self.assertEqual(state["current_turn"], "p2")
        state = self.fixture([[1, 8], [6], [5]])
        self.play(state, 1, "p1", 4)
        self.assertTrue(state["players"]["p1"]["alive"])

    def test_priest_is_private_and_historical_after_target_turn(self):
        state = self.fixture([[2, 8], [4], [6]])
        events = self.play(state, 2, "p2")
        own = Game.get_public_view(state, "p0")
        other = Game.get_public_view(state, "p1")
        self.assertEqual(own["private_notes"][0]["card"], 6)
        self.assertTrue(own["private_notes"][0]["current"])
        self.assertEqual(other["private_notes"], [])
        self.assertEqual(Game.get_public_view(state, "spectator")["your_hand"], [])
        self.assertNotIn("hand", other["players"][2])
        self.assertEqual(other["players"][2]["revealed_hand"], [])
        self.assertNotIn("private_notes", json.dumps(events))
        self.play(state, 4)
        self.assertFalse(Game.get_public_view(state, "p0")["private_notes"][0]["current"])

    def test_baron_lower_hand_loses_and_only_participants_see_comparison(self):
        state = self.fixture([[3, 4], [2], [6]])
        self.play(state, 3, "p2")
        self.assertFalse(state["players"]["p0"]["alive"])
        self.assertEqual(state["players"]["p0"]["discards"], [3, 4])
        self.assertEqual(Game.get_public_view(state, "p2")["private_notes"][0]["card"], 4)
        self.assertEqual(Game.get_public_view(state, "p1")["private_notes"], [])
        self.assertEqual(state["current_turn"], "p1")

    def test_baron_win_and_tie(self):
        for mine, theirs, survives in [(8, 2, False), (5, 5, True)]:
            state = self.fixture([[3, mine], [theirs], [6]])
            self.play(state, 3, "p1")
            self.assertEqual(state["players"]["p1"]["alive"], survives)
            self.assertTrue(state["players"]["p0"]["alive"])

    def test_handmaid_expires_at_start_of_own_turn(self):
        state = self.fixture([[4, 8], [7], [6]], [2, 1, 1, 2])
        self.play(state, 4)
        self.assertTrue(state["players"]["p0"]["protected"])
        self.play(state, 7)
        self.assertNotIn("p0", Game.get_public_view(state, "p2")["targets"]["1"])
        self.play(state, 1, "p1", 8)
        self.assertEqual(state["current_turn"], "p0")
        self.assertFalse(state["players"]["p0"]["protected"])

    def test_no_targets_discards_without_effect(self):
        for card in [1, 2, 3, 6]:
            state = self.fixture([[card, 8], [4], [5]])
            state["players"]["p1"]["protected"] = True
            state["players"]["p2"]["protected"] = True
            self.play(state, card)
            self.assertEqual(state["players"]["p0"]["hand"], [8])
            self.assertTrue(all(player["alive"] for player in state["players"].values()))

    def test_prince_can_target_self_and_must_when_others_protected(self):
        state = self.fixture([[5, 1], [4], [6]], [2, 3, 7])
        for pid in ["p1", "p2"]:
            state["players"][pid]["protected"] = True
        self.assertEqual(Game.get_public_view(state, "p0")["targets"]["5"], ["p0"])
        self.play(state, 5, "p0")
        self.assertEqual(state["players"]["p0"]["hand"], [7])
        self.assertEqual(state["players"]["p0"]["discards"], [5, 1])

    def test_prince_discards_princess_without_replacement(self):
        state = self.fixture([[5, 6], [4], [8]], [2, 3, 7])
        self.play(state, 5, "p2")
        self.assertEqual(state["players"]["p2"]["hand"], [])
        self.assertEqual(state["players"]["p2"]["discards"], [8])
        self.assertFalse(state["players"]["p2"]["alive"])
        self.assertEqual(len(state["deck"]), 2)  # Only the next player's normal draw.

    def test_prince_uses_reserve_then_round_ends(self):
        state = self.fixture([[5, 8], [6], [4]], [])
        state["reserve"] = 7
        self.play(state, 5, "p1")
        self.assertEqual(state["players"]["p1"]["hand"], [7])
        self.assertIsNone(state["reserve"])
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round_summary"]["winners"], ["p0"])

    def test_king_swaps_remaining_cards_privately(self):
        state = self.fixture([[6, 1], [4], [8]])
        self.play(state, 6, "p2")
        self.assertEqual(state["players"]["p0"]["hand"], [8])
        self.assertEqual(state["players"]["p2"]["hand"], [1])
        self.assertEqual(Game.get_public_view(state, "p0")["private_notes"][0]["card"], 1)
        self.assertEqual(Game.get_public_view(state, "p1")["private_notes"], [])

    def test_countess_forced_or_voluntary_never_announces_reason(self):
        for other in [1, 5, 6]:
            state = self.fixture([[7, other], [4], [8]])
            legal = Game.get_public_view(state, "p0")["playable_cards"]
            self.assertEqual(legal, [7] if other in [5, 6] else [1, 7])
            self.play(state, 7)
            self.assertEqual(state["players"]["p0"]["hand"], [other])
            self.assertNotIn("forced", json.dumps(state["log"]))

    def test_princess_play_eliminates_owner_and_reveals_other_card(self):
        state = self.fixture([[8, 5], [4], [6]])
        self.play(state, 8)
        self.assertFalse(state["players"]["p0"]["alive"])
        self.assertEqual(state["players"]["p0"]["discards"], [8, 5])

    def test_last_survivor_wins_immediately(self):
        state = self.fixture([[1, 7], [8]])
        self.play(state, 1, "p1", 8)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round_summary"]["reason"], "last_survivor")
        self.assertEqual(state["players"]["p0"]["tokens"], 1)
        self.assertEqual(len(state["deck"]), 4)

    def test_last_draw_still_resolves_effect_before_scoring(self):
        state = self.fixture([[1, 4], [8], [7]], [])
        self.play(state, 1, "p1", 8)
        self.assertEqual(state["round_summary"]["winners"], ["p2"])
        self.assertEqual(state["round_summary"]["reason"], "highest_card")

    def test_tie_uses_discard_total_then_shares_token(self):
        state = self.fixture([[7, 5], [5], [4]], [])
        state["players"]["p1"]["discards"] = [1, 6]
        self.play(state, 7)
        self.assertEqual(state["round_summary"]["winners"], ["p0", "p1"])
        self.assertEqual(state["round_summary"]["reason"], "shared_win")
        self.assertEqual(state["players"]["p1"]["tokens"], 1)
        state = self.fixture([[7, 5], [5], [4]], [])
        state["players"]["p1"]["discards"] = [1]
        self.play(state, 7)
        self.assertEqual(state["round_summary"]["winners"], ["p0"])
        self.assertEqual(state["round_summary"]["reason"], "discard_total")

    def test_round_waits_for_every_seat_including_eliminated_and_rejects_repeat(self):
        state = self.fixture([[1, 7], [8]])
        self.play(state, 1, "p1", 8)
        action = {"type": "next_round", "round": 1}
        self.assertIsNone(Game.apply_action(state, "p0", action)[1])
        snapshot = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, "p0", action)[1])
        self.assertEqual(state, snapshot)
        self.assertEqual(Game.get_legal_actions(state, "p1"), ["next_round"])
        self.assertIsNone(Game.apply_action(state, "p1", action)[1])
        self.assertEqual((state["phase"], state["round"], state["current_turn"]), ("play", 2, "p0"))
        self.assertTrue(all(player["alive"] for player in state["players"].values()))
        self.assertEqual(state["players"]["p0"]["tokens"], 1)
        self.assert_conserved(state)
        self.assertIsNotNone(Game.apply_action(state, "p1", action)[1])

    def test_match_end_has_no_further_actions(self):
        state = self.fixture([[1, 7], [8]])
        state["players"]["p0"]["tokens"] = 6
        self.play(state, 1, "p1", 8)
        self.assertEqual(state["winner"], ["p0"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(Game.get_legal_actions(state, "p0"), [])
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_invalid_actions_do_not_mutate(self):
        state = self.fixture([[1, 7], [4], [8]])
        state["players"]["p2"]["protected"] = True
        valid = {"type": "play_card", "card": 1, "target": "p1", "guess": 4, "round": 1, "turn": 1}
        bad = [None, [], {}, {**valid, "guess": 1}, {**valid, "guess": True},
               {**valid, "card": 1.0}, {**valid, "turn": 0}, {**valid, "turn": 2},
               {**valid, "round": 2}, {**valid, "target": "p2"}, {**valid, "target": "p0"},
               {**valid, "target": "unknown"}, {**valid, "card": 8}, {**valid, "extra": "x"},
               {**valid, "card": 7}, {key: value for key, value in valid.items() if key != "guess"}]
        for action in bad:
            before = copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state, "p0", action)[1], action)
            self.assertEqual(state, before)
        for actor in ["p1", "stranger"]:
            self.assertIsNotNone(Game.apply_action(state, actor, valid)[1])
        for royal in [5, 6]:
            state["players"]["p0"]["hand"] = [royal, 7]
            before = copy.deepcopy(state)
            action = {"type": "play_card", "round": 1, "turn": 1, "card": royal, "target": "p1"}
            self.assertIsNotNone(Game.apply_action(state, "p0", action)[1])
            self.assertEqual(state, before)

    def test_views_and_serialization_are_isolated_and_json_roundtrip(self):
        state = self.fixture([[2, 8], [4], [6]])
        self.play(state, 2, "p2")
        before = copy.deepcopy(state)
        view = Game.get_public_view(state, "p0")
        self.assertFalse({"deck", "reserve", "player_meta"} & set(view))
        view["your_hand"].clear()
        view["players"][0]["discards"].clear()
        view["private_notes"][0]["card"] = 1
        self.assertEqual(state, before)
        saved = json.loads(json.dumps(Game.serialize(state)))
        restored = Game.deserialize(saved)
        self.assertEqual(restored, state)
        self.assertEqual(Game.get_public_view(restored, "p0"), Game.get_public_view(state, "p0"))
        restored["players"]["p0"]["hand"].clear()
        self.assertEqual(state, before)

    def test_bot_does_not_use_hidden_hands_or_deck_order(self):
        state = self.fixture([[1, 8], [5], [6]])
        variant = copy.deepcopy(state)
        variant["players"]["p1"]["hand"], variant["players"]["p2"]["hand"] = [6], [5]
        variant["deck"].reverse()
        variant["reserve"] = 7
        self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(variant, "p0"))
        self.assertEqual(Game.bot_move(state, "p0"), Game.bot_move(variant, "p0"))

    def test_bots_complete_matches_and_conserve_every_card(self):
        for count in [2, 3, 4]:
            for seed in range(6):
                rng = random.Random(seed)
                with patch("game.love_letter.random.shuffle", rng.shuffle), patch("game.love_letter.random.choice", rng.choice):
                    state = Game.init_game({}, players(count))
                    for _ in range(1200):
                        self.assert_conserved(state)
                        if state["game_over"]:
                            break
                        actor = next(pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid))
                        action = Game.bot_move(state, actor)
                        self.assertIsNotNone(action)
                        self.assertIsNone(Game.apply_action(state, actor, action)[1])
                    self.assertTrue(state["game_over"], (count, seed))


if __name__ == "__main__":
    unittest.main()
