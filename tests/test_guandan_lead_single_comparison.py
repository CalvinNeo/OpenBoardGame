import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanLeadSingleComparisonTests(unittest.TestCase):
    # Bot 4's own opening cards in 3cee7e_10.save. Opponent cards are allocated
    # independently; only their public hand counts belong to this regression.
    OPENING = [
        "🃏S", "♥️2", "♣️2", "♦️2", "♦️2", "♦️A", "♠️A", "♥️A",
        "♥️K", "♥️Q", "♠️Q", "♥️J", "♥️J", "♠️J", "♦️8", "♥️8",
        "♠️8", "♠️8", "♣️7", "♠️7", "♦️7", "♣️7", "♥️7", "♥️6",
        "♦️5", "♠️5", "♥️3",
    ]

    def make_state(self, seed=0, labels=None):
        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("opp", "mate", "opp2", "bot"))
        ]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        hand = []
        for label in labels or self.OPENING:
            card = next(c for c in deck if guandan._card_label(c) == label)
            deck.remove(card)
            hand.append(card)
        state["players"]["bot"]["hand"] = hand
        random.Random(seed).shuffle(deck)
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:27]
            del deck[:27]
        visible = next(c["id"] for c in hand if guandan._card_label(c) == "♠️J")
        state.update(
            phase="playing", level_rank=2, dealer_team="B", current_turn="bot",
            current_trick=None, trick_plays={}, pass_count=0, finish_order=[],
            round_memories=[], pass_limits={}, seen_cards=[],
            known_card_owners={visible: "bot"}, visible_card_id=visible,
            _ai_eval_cache={"heuristic_soft_deadline": 0.5},
        )
        state["config"].update(bot_mode="heuristic", bot_search_depth=4,
                               bot_heuristic_min_lead_deep_candidates=3)
        return state

    def labels(self, state, cards):
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        return [guandan._card_label(hand[cid]) for cid in cards]

    def select_three_finalists(self, state, score=None):
        clock = [0.0]
        evaluated = []
        original = guandan_ai._bot_finalist_score_components

        def finalist(current, player_id, cards, depth, *, bounded):
            evaluated.append(cards)
            result = (score(cards) if score is not None else
                      original(current, player_id, cards, depth, bounded=bounded))
            clock[0] += 0.25
            return result

        with (
            mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]),
            # The saved decision's optional route panel also ran out of time.
            mock.patch.object(guandan_ai, "_prepare_hand_route_scores"),
            mock.patch.object(guandan_ai, "_bot_finalist_score_components", side_effect=finalist),
        ):
            chosen = guandan_ai.call(
                guandan, "_bot_select_play", state, "bot", 4, deadline=10.0
            )
        self.assertEqual(len(evaluated), 3)
        self.assertEqual(state["_ai_eval_cache"]["heuristic_anytime"]["stop_reason"], "soft_deadline")
        return chosen, evaluated

    def test_saved_opening_compares_and_sheds_three_with_three_finalists(self):
        for seed in (0, 19):
            with self.subTest(hidden_deal=seed):
                state = self.make_state(seed)
                chosen, evaluated = self.select_three_finalists(state)
                self.assertIn(["♥️3"], [self.labels(state, cards) for cards in evaluated])
                self.assertEqual(self.labels(state, chosen), ["♥️3"])

    def test_single_challenger_still_needs_to_win_the_detailed_comparison(self):
        state = self.make_state()
        chosen, evaluated = self.select_three_finalists(
            state, score=lambda cards: {"total": 0.0 if len(cards) == 1 else 100.0}
        )
        self.assertIn(["♥️3"], [self.labels(state, cards) for cards in evaluated])
        self.assertEqual(len(chosen), 5)

    def test_low_pair_is_not_promoted_as_a_single_challenger(self):
        state = self.make_state(labels=["♠️3" if c == "♥️6" else c for c in self.OPENING])
        _, evaluated = self.select_three_finalists(
            state, score=lambda cards: {"total": float(len(cards))}
        )
        self.assertTrue(all(len(cards) > 1 for cards in evaluated))

    def test_default_budget_sheds_three(self):
        state = self.make_state()
        state["_ai_eval_cache"] = {}
        action = guandan.GuandanGame.bot_move(state, "bot")
        self.assertEqual(action["type"], "play")
        self.assertEqual(self.labels(state, action["card_ids"]), ["♥️3"])

    def test_natural_straight_material_is_not_promoted_as_an_orphan(self):
        # Replacing the 3 with a 4 connects both singletons into 45678.
        state = self.make_state(labels=["♥️4" if c == "♥️3" else c for c in self.OPENING])
        _, evaluated = self.select_three_finalists(
            state, score=lambda cards: {"total": float(len(cards))}
        )
        self.assertTrue(all(len(cards) > 1 for cards in evaluated))

    def test_short_active_hand_keeps_tactical_candidate_order(self):
        for player_id in ("opp", "mate"):
            with self.subTest(short_player=player_id):
                state = self.make_state()
                hand = state["players"][player_id]["hand"]
                state["seen_cards"] = [card["id"] for card in hand[7:]]
                state["players"][player_id]["hand"] = hand[:7]
                _, evaluated = self.select_three_finalists(
                    state, score=lambda cards: {"total": float(len(cards))}
                )
                self.assertNotIn(["♥️3"], [self.labels(state, cards) for cards in evaluated])


if __name__ == "__main__":
    unittest.main()
