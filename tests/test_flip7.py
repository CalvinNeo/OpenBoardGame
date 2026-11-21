import copy
import json
import random
import unittest
from unittest.mock import patch

from game.flip7 import (
    ACTION_FLIP_THREE,
    ACTION_FREEZE,
    ACTION_SECOND_CHANCE,
    CARD_ACTION,
    CARD_MODIFIER,
    CARD_NUMBER,
    Flip7Game,
    _build_deck,
    _end_round,
)
from game.flip7_ai import _card_key, _public_draw_pool, choose_move


class Flip7GameTests(unittest.TestCase):
    def _make_state(self):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]
        state = Flip7Game.init_game({}, players)
        state["deck"] = []
        state["discard"] = []
        state["pending_action"] = None
        state["action_queue"] = []
        state["flip7_winner"] = None
        state["phase"] = "playing"
        state["current_turn"] = "p1"
        for pdata in state["players"].values():
            pdata["tableau"] = []
            pdata["status"] = "active"
            pdata["banked"] = False
            pdata["round_score"] = None
            pdata["round_breakdown"] = None
            pdata["round_flips"] = []
            pdata["flip7"] = False
        return state

    def test_bust_skips_to_next_player(self):
        state = self._make_state()
        state["deck"] = [{"type": CARD_NUMBER, "value": 5}]
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 5}]

        events, error = Flip7Game.apply_action(state, "p1", {"type": "flip"})

        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:bust" for evt in events))
        self.assertEqual(state["players"]["p1"]["status"], "out")
        self.assertEqual(state["players"]["p1"]["round_score"], 0)
        self.assertTrue(state["players"]["p1"]["banked"])
        self.assertEqual(state["current_turn"], "p2")
        self.assertEqual(state["phase"], "playing")
        self.assertIsNone(state["last_round_summary"])

    def test_game_ends_when_target_reached_even_with_tie(self):
        state = self._make_state()
        state["config"]["target_score"] = 10
        for pdata in state["players"].values():
            pdata["status"] = "out"
            pdata["banked"] = True
        state["players"]["p1"]["score"] = 10
        state["players"]["p2"]["score"] = 10

        _end_round(state, "all_done")

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertCountEqual(state["winner"], ["p1", "p2"])

    def test_round_waits_for_every_player_to_acknowledge(self):
        state = self._make_state()
        state["deck"] = [
            {"type": CARD_NUMBER, "value": 1},
            {"type": CARD_NUMBER, "value": 2},
        ]

        events, error = Flip7Game.apply_action(state, "p1", {"type": "stay"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:stay" for evt in events))
        self.assertEqual(state["current_turn"], "p2")

        events, error = Flip7Game.apply_action(state, "p2", {"type": "stay"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:round_end" for evt in events))
        self.assertFalse(any(evt["type"] == "flip7:next_round" for evt in events))
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round"], 1)
        self.assertEqual(Flip7Game.get_legal_actions(state, "p1"), ["next_round"])
        self.assertIsNone(Flip7Game.apply_action(state, "p1", {"type": "next_round"})[1])
        self.assertEqual(Flip7Game.get_legal_actions(state, "p1"), [])
        self.assertIsNone(Flip7Game.bot_move(state, "p1"))
        self.assertIsNotNone(Flip7Game.apply_action(state, "p1", {"type": "next_round"})[1])
        self.assertEqual(state["round"], 1)
        restored = Flip7Game.deserialize(json.loads(json.dumps(Flip7Game.serialize(state))))
        self.assertEqual(Flip7Game.get_public_view(restored, "p2")["round_ready"], ["p1"])
        events, error = Flip7Game.apply_action(restored, "p2", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "flip7:next_round" for evt in events))
        state = restored
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["round_ready"], [])

    def test_flip_seven_pauses_and_preserves_all_drawn_cards(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": value} for value in range(6)]
        state["deck"] = [{"type": CARD_NUMBER, "value": 6}]
        events, error = Flip7Game.apply_action(state, "p1", {"type": "flip"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["players"]["p1"]["score"], 36)
        self.assertEqual(state["last_round_summary"]["flips"]["p1"][0]["value"], 6)
        self.assertTrue(any(event["type"] == "flip7:round_end" for event in events))

    def test_public_view_differentiates_zero_bank_from_bust(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 0}]
        Flip7Game.apply_action(state, "p1", {"type": "stay"})
        view = Flip7Game.get_public_view(state, "p1")
        self.assertFalse(view["players"][0]["busted"])
        self.assertEqual(view["players"][0]["round_score"], 0)
        state["players"]["p2"]["tableau"] = [{"type": CARD_NUMBER, "value": 12}]
        state["deck"] = [{"type": CARD_NUMBER, "value": 12}]
        Flip7Game.apply_action(state, "p2", {"type": "flip"})
        self.assertTrue(Flip7Game.get_public_view(state, "p1")["players"][1]["busted"])

    def test_public_potential_score_and_deck_privacy(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [
            {"type": CARD_NUMBER, "value": 12},
            {"type": CARD_MODIFIER, "multiplier": 2},
            {"type": CARD_MODIFIER, "points": 6},
        ]
        view = Flip7Game.get_public_view(state, "p1")
        self.assertEqual(view["players"][0]["potential_score"], 30)
        self.assertNotIn("deck", view)
        self.assertNotIn("discard", view)

    def _set_unseen_cards(self, state, cards):
        visible = list(cards) + state["players"]["p1"]["tableau"]
        state["discard"] = _build_deck()
        for card in visible:
            state["discard"].remove(card)
        state["deck"] = cards

    def test_ai_flips_when_draws_are_safe(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 1}]
        self._set_unseen_cards(state, [{"type": CARD_NUMBER, "value": 12}])
        self.assertEqual(choose_move(state, "p1"), {"type": "flip"})

    def test_ai_banks_when_every_draw_busts(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 12}]
        self._set_unseen_cards(state, [{"type": CARD_NUMBER, "value": 12}])
        self.assertEqual(choose_move(state, "p1"), {"type": "stay"})

    def test_ai_uses_second_chance_and_flip_seven_bonus(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [
            {"type": CARD_NUMBER, "value": value} for value in (1, 2, 3, 4, 5, 12)
        ] + [{"type": CARD_ACTION, "action": ACTION_SECOND_CHANCE}]
        self._set_unseen_cards(state, [{"type": CARD_NUMBER, "value": 12}, {"type": CARD_NUMBER, "value": 6}])
        self.assertEqual(choose_move(state, "p1"), {"type": "flip"})

    def test_ai_ignores_hidden_order_and_does_not_mutate_state(self):
        with patch("random.shuffle"):
            state = Flip7Game.init_game({}, [{"player_id": "p1"}, {"player_id": "p2"}])
        state["pending_action"] = None
        state["action_queue"] = []
        state["phase"] = "playing"
        state["current_turn"] = "p1"
        snapshot = copy.deepcopy(state)
        action = choose_move(state, "p1")
        self.assertEqual(state, snapshot)
        state["deck"].reverse()
        self.assertEqual(choose_move(state, "p1"), action)
        state["deck"] = [{"type": CARD_NUMBER, "value": 0}] * len(state["deck"])
        self.assertEqual(choose_move(state, "p1"), action)
        self.assertIsNone(choose_move(state, "p2"))
        self.assertIsNone(choose_move(state, "spectator"))

    def test_ai_keeps_second_chance_and_gifts_to_trailing_player(self):
        state = self._make_state()
        state["phase"] = "action_target"
        state["pending_action"] = {"actor_id": "p1", "card": {"type": CARD_ACTION, "action": ACTION_SECOND_CHANCE}}
        self.assertEqual(choose_move(state, "p1")["target_player_id"], "p1")
        state["players"]["p1"]["tableau"] = [{"type": CARD_ACTION, "action": ACTION_SECOND_CHANCE}]
        self.assertEqual(choose_move(state, "p1")["target_player_id"], "p2")

    def test_ai_freezes_opponent_with_remaining_upside(self):
        state = self._make_state()
        state["phase"] = "action_target"
        state["pending_action"] = {"actor_id": "p1", "card": {"type": CARD_ACTION, "action": ACTION_FREEZE}}
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 12}]
        state["players"]["p2"]["tableau"] = [{"type": CARD_NUMBER, "value": 1}]
        self.assertEqual(choose_move(state, "p1")["target_player_id"], "p2")
        state["pending_action"]["card"]["action"] = ACTION_FLIP_THREE
        self.assertEqual(choose_move(state, "p1")["target_player_id"], "p1")

    def test_ai_public_pool_matches_remaining_multiset(self):
        random.seed(17)
        state = Flip7Game.init_game({}, [{"player_id": "p1"}, {"player_id": "p2"}])
        self.assertCountEqual([_card_key(card) for card in _public_draw_pool(state)],
                              [_card_key(card) for card in state["deck"]])

    def test_ai_reshuffle_does_not_change_global_rng_or_game_state(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 12}]
        self._set_unseen_cards(state, [{"type": CARD_ACTION, "action": ACTION_FLIP_THREE}])
        snapshot = copy.deepcopy(state)
        random_state = random.getstate()
        self.assertIn(choose_move(state, "p1")["type"], ["flip", "stay"])
        self.assertEqual(random.getstate(), random_state)
        self.assertEqual(state, snapshot)

    def test_ai_empty_deck_does_not_duplicate_discard_cards(self):
        state = self._make_state()
        state["players"]["p1"]["tableau"] = [{"type": CARD_NUMBER, "value": 12}]
        self._set_unseen_cards(state, [])
        apply_action = Flip7Game.apply_action

        def checked_action(simulation, player_id, action, rng=None):
            cards = list(simulation["deck"]) + list(simulation["discard"])
            cards.extend(card for player in simulation["players"].values() for card in player["tableau"])
            if simulation.get("pending_action"):
                cards.append(simulation["pending_action"]["card"])
            cards.extend(entry["card"] for entry in simulation.get("action_queue", []))
            self.assertEqual(len(cards), 94)
            return apply_action(simulation, player_id, action, rng=rng)

        with patch.object(Flip7Game, "apply_action", side_effect=checked_action):
            self.assertIn(choose_move(state, "p1")["type"], ["flip", "stay"])

    def test_all_bot_games_finish_with_legal_moves(self):
        for seed in range(3):
            random.seed(seed)
            state = Flip7Game.init_game({"target_score": 60}, [
                {"player_id": "p1", "is_bot": True}, {"player_id": "p2", "is_bot": True}
            ])
            for _ in range(600):
                if state["game_over"]:
                    break
                for player_id in state["players"]:
                    action = Flip7Game.bot_move(state, player_id)
                    if action:
                        self.assertIn(action["type"], Flip7Game.get_legal_actions(state, player_id))
                        _, error = Flip7Game.apply_action(state, player_id, action)
                        self.assertIsNone(error)
                        break
                else:
                    self.fail("No legal bot move")
            self.assertTrue(state["game_over"])


if __name__ == "__main__":
    unittest.main()
