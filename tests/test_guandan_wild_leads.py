import copy
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanWildLeadTests(unittest.TestCase):
    # Bot 2's opening in 4256cd_85.save. Only its own cards and public counts
    # matter; the other hands below are unrelated to the saved deal.
    OPENING = [
        "🃏B", "♥️2", "♥️A", "♣️K", "♥️K", "♣️K", "♥️K", "♠️K",
        "♦️J", "♠️10", "♠️10", "♦️9", "♥️9", "♥️8", "♥️8", "♠️8",
        "♣️8", "♥️7", "♠️7", "♥️5", "♦️5", "♦️4", "♥️4", "♦️3",
        "♠️3", "♦️3", "♣️3",
    ]
    LOW_HOUSE = ["♦️4", "♥️4", "♥️2", "♥️5", "♦️5"]

    def make_state(self, labels=None, level=2):
        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        hand = []
        for label in labels or self.OPENING:
            card = next(c for c in deck if guandan._card_label(c) == label)
            deck.remove(card)
            hand.append(card)
        state["players"]["bot"]["hand"] = hand
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:27]
            del deck[:27]
        state.update(
            phase="playing", level_rank=level, current_turn="bot",
            current_trick=None, trick_plays={}, pass_count=0, finish_order=[],
            round_memories=[], pass_limits={}, seen_cards=[c["id"] for c in deck],
            known_card_owners={}, visible_card_id=None, _ai_eval_cache={},
        )
        state["config"].update(bot_mode="heuristic", bot_search_depth=4)
        return state

    def select(self, state, labels):
        available = list(state["players"]["bot"]["hand"])
        cards = []
        for label in labels:
            card = next(c for c in available if guandan._card_label(c) == label)
            available.remove(card)
            cards.append(card)
        return [c["id"] for c in cards], guandan._evaluate_combo(
            cards, state["level_rank"], state["config"]
        )

    def call(self, name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    def assert_preserves_wild_and_bombs(self, state, cards):
        hand = state["players"]["bot"]["hand"]
        remaining = guandan._remove_cards(hand, cards)
        self.assertEqual(sum(guandan._is_wild(c, 2) for c in remaining), 1)
        for rank, count in ((3, 4), (8, 4), (13, 5)):
            self.assertEqual(sum(c.get("rank") == rank for c in remaining), count)

    def test_saved_low_house_does_not_get_free_reentry_from_splitting_bombs(self):
        state = self.make_state()
        cards, combo = self.select(state, self.LOW_HOUSE)
        self.assertEqual(combo["type"], "full_house")
        self.assertEqual(combo["rank"], 5)
        self.assertEqual(
            self.call("_lead_same_type_reentry_bonus", state, "bot", cards, combo), 0.0
        )

    def test_clean_higher_house_still_gives_reentry_credit(self):
        state = self.make_state(self.LOW_HOUSE + ["♠️K", "♥️K", "♣️K", "♠️7", "♥️7"])
        cards, combo = self.select(state, self.LOW_HOUSE)
        self.assertGreater(
            self.call("_lead_same_type_reentry_bonus", state, "bot", cards, combo), 0.0
        )

    def test_pair_reentry_also_pays_for_splitting_a_control_triple(self):
        state = self.make_state(["♦️4", "♥️4", "♠️K", "♥️K", "♣️K"])
        cards, combo = self.select(state, ["♦️4", "♥️4"])
        self.assertEqual(
            self.call("_lead_same_type_reentry_bonus", state, "bot", cards, combo), 0.0
        )

    def test_prescore_keeps_bomb_upgrade_ahead_of_spending_wild_on_low_house(self):
        for level in (2, 11):
            with self.subTest(level=level):
                wild = "♥️2" if level == 2 else "♥️J"
                state = self.make_state([wild if c == "♥️2" else c for c in self.OPENING], level)
                pair, _ = self.select(state, ["♦️4", "♥️4"])
                house, _ = self.select(state, [wild if c == "♥️2" else c for c in self.LOW_HOUSE])
                with (
                    mock.patch.object(guandan_ai, "_hand_decomposition_summary", side_effect=AssertionError),
                    mock.patch.object(guandan_ai, "_global_hand_decomposition_summary", side_effect=AssertionError),
                    mock.patch.object(guandan_ai, "_lead_retake_control_bonus", side_effect=AssertionError),
                ):
                    self.assertGreater(
                        self.call("_quick_candidate_score", state, "bot", pair),
                        self.call("_quick_candidate_score", state, "bot", house),
                    )

    def test_expired_budget_preserves_wild_and_bombs_in_saved_opening(self):
        state = self.make_state()
        with mock.patch.object(guandan_ai, "_bot_finalist_score_components", side_effect=AssertionError):
            cards = self.call("_bot_select_play", state, "bot", 4, deadline=0.0)
        self.assert_preserves_wild_and_bombs(state, cards)
        self.assertEqual(state["_ai_eval_cache"]["heuristic_anytime"]["evaluated"], 0)

    def test_normal_budget_preserves_wild_and_bombs_in_saved_opening(self):
        state = self.make_state()
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action["type"], "play")
        self.assert_preserves_wild_and_bombs(state, action["card_ids"])

    def test_wild_full_house_can_still_finish_the_hand(self):
        state = self.make_state(self.LOW_HOUSE)
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action["type"], "play")
        self.assertCountEqual(action["card_ids"], [c["id"] for c in state["players"]["bot"]["hand"]])

    def test_reentry_does_not_depend_on_hidden_opponent_cards(self):
        state = self.make_state()
        cards, combo = self.select(state, self.LOW_HOUSE)
        shuffled = copy.deepcopy(state)
        shuffled["players"]["opp"]["hand"], shuffled["players"]["mate"]["hand"] = (
            shuffled["players"]["mate"]["hand"], shuffled["players"]["opp"]["hand"]
        )
        self.assertEqual(
            self.call("_lead_same_type_reentry_bonus", state, "bot", cards, combo),
            self.call("_lead_same_type_reentry_bonus", shuffled, "bot", cards, combo),
        )


if __name__ == "__main__":
    unittest.main()
