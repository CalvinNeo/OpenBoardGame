import copy
import time
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanBombCloseoutUpgradeTests(unittest.TestCase):
    def test_legacy_saved_bomb_uses_wild_when_both_routes_take_two_plays(self):
        for mode, threshold in (("heuristic", 0), ("auto", 18), ("auto", 0)):
            with self.subTest(mode=mode, threshold=threshold):
                state = replay_fixture("b0a262", 72, {
                    "bot_mode": mode, "bot_endgame_threshold": threshold,
                    "bot_blacklist_separate_value": False,
                })
                hand = state["players"]["bot4"]["hand"]
                expected = {card["id"] for card in hand if card.get("rank") != 10}
                action = guandan.GuandanGame.bot_move(state, "bot4")
                self.assertEqual(action["type"], "play")
                self.assertEqual(set(action["card_ids"]), expected)
                self.assertEqual(len(action["card_ids"]), 5)
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", action)[1])
                self.assertEqual(state["current_trick"]["combo"]["type"], "bomb")
                self.assertEqual(state["current_trick"]["combo"]["size"], 5)
                self.assertEqual([guandan._card_label(card) for card in
                                  state["players"]["bot4"]["hand"]], ["♦️10"])
                for player in ("calvin", "bot2"):
                    self.assertIsNone(guandan.GuandanGame.apply_action(
                        state, player, {"type": "pass"})[1])
                finish = guandan.GuandanGame.bot_move(state, "bot4")
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", finish)[1])
                self.assertEqual(state["players"]["bot4"]["finish_rank"], 2)

    def test_default_policy_preserves_wild_after_sampled_bomb_comparison(self):
        state = replay_fixture("b0a262", 72, {
            "bot_mode": "auto", "bot_endgame_threshold": 18,
        })
        hand = state["players"]["bot4"]["hand"]
        natural = [card["id"] for card in hand if card.get("rank") == 6]
        world = copy.deepcopy(state)
        world["_ai_sampled_world"] = True
        pool = world["players"]["calvin"]["hand"] + world["players"]["bot2"]["hand"]
        enemy_ids = set(pick_card_ids(pool, ("♠️7", "♥️7", "♥️K")))
        world["players"]["calvin"]["hand"] = [card for card in pool if card["id"] in enemy_ids]
        world["players"]["bot2"]["hand"] = [card for card in pool if card["id"] not in enemy_ids]
        # Fix only the hidden-card particle. Real minimax terminal solving,
        # material-prior publication and final allocation guard still run.
        # In this legal allocation a pair tail secures the better team result.
        with mock.patch.object(guandan, "_determinize_state", side_effect=lambda *a, **k: copy.deepcopy(world)):
            action = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertTrue(state["config"]["bot_blacklist_separate_value"])
        self.assertEqual(set(action["card_ids"]), set(natural))
        explanation = state["bot_explain"]["bot4"]
        self.assertEqual(explanation["method"], "minimax")
        self.assertTrue(explanation["search"]["terminal_complete"])
        rows = {len(row["cards"]): row for row in explanation["search"]["candidates"]}
        self.assertEqual(set(rows[4]["world_values"]), {-100.0})
        self.assertEqual(set(rows[5]["world_values"]), {-200.0})
        self.assertEqual(rows[4]["blacklist_penalty"], 0.0)
        self.assertEqual(rows[5]["blacklist_penalty"], 10.0)
        self.assertNotIn("bomb_closeout_upgrade", explanation["method_details"])
        self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", action)[1])
        self.assertEqual(state["current_trick"]["combo"]["size"], 4)
        for player in ("calvin", "bot2"):
            self.assertIsNone(guandan.GuandanGame.apply_action(state, player, {"type": "pass"})[1])
        tail = state["players"]["bot4"]["hand"]
        self.assertEqual({guandan._card_label(card) for card in tail}, {"♥️2", "♦️10"})
        finish = guandan.GuandanGame.bot_move(state, "bot4")
        self.assertEqual(set(finish["card_ids"]), {card["id"] for card in tail})
        self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", finish)[1])
        self.assertEqual(state["current_trick"]["combo"]["type"], "pair")
        self.assertEqual(state["players"]["bot4"]["finish_rank"], 2)

    def test_quick_and_detailed_scores_prefer_the_stronger_bomb(self):
        state = replay_fixture("b0a262", 72)
        hand = state["players"]["bot4"]["hand"]
        natural = [card["id"] for card in hand if card.get("rank") == 6]
        upgraded = natural + pick_card_ids(hand, ("♥️2",))
        natural_score = guandan._bot_score_components(state, "bot4", natural, 2)
        upgraded_score = guandan._bot_score_components(state, "bot4", upgraded, 2)
        self.assertGreater(upgraded_score["total"], natural_score["total"])
        self.assertAlmostEqual(upgraded_score["total"], sum(
            value for name, value in upgraded_score.items() if name != "total"))
        self.assertGreater(
            guandan_ai.call(guandan, "_quick_candidate_score", state, "bot4", upgraded),
            guandan_ai.call(guandan, "_quick_candidate_score", state, "bot4", natural),
        )
        action = guandan._heuristic_best_action(state, "bot4", 2, deadline=time.perf_counter() - 1)
        self.assertEqual(set(action["card_ids"]), set(upgraded))

    def test_final_selection_cannot_restore_the_smaller_bomb(self):
        for mode, method in (("nn", "nn"), ("auto", "mcts")):
            with self.subTest(mode=mode):
                state = replay_fixture("b0a262", 72, {
                    "bot_mode": mode, "bot_endgame_threshold": 0,
                })
                hand = state["players"]["bot4"]["hand"]
                natural = [card["id"] for card in hand if card.get("rank") == 6]
                proposal = {"type": "play", "card_ids": natural}
                with (
                    mock.patch.object(guandan, "_nn_pick_action", return_value=(proposal, [], {})),
                    mock.patch.object(guandan, "_should_use_mcts", return_value=True),
                    mock.patch.object(guandan, "_mcts_pick_action", return_value=(
                        proposal, [(proposal, 1.0, 1, {})],
                    )),
                    mock.patch.object(guandan, "_should_accept_mcts_override", return_value=True),
                ):
                    action = guandan.GuandanGame.bot_move(state, "bot4")
                self.assertEqual(set(action["card_ids"]), set(natural + pick_card_ids(hand, ("♥️2",))))
                explanation = state["bot_explain"]["bot4"]
                self.assertEqual(explanation["method_details"]["bomb_closeout_upgrade"]["source_method"], method)
                self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot4", action)[1])

    def test_upgrade_uses_the_current_level_and_can_move_both_wilds(self):
        for level, wild in ((2, "♥️2"), (9, "♥️9")):
            for wild_count in (1, 2):
                with self.subTest(level=level, wild_count=wild_count):
                    state = replay_fixture("b0a262", 72)
                    state["level_rank"] = level
                    deck = guandan._full_deck()
                    ids = pick_card_ids(deck, ("♠️6", "♥️6", "♣️6", "♦️6", "♦️10")
                                        + (wild,) * wild_count)
                    hand = [card for card in deck if card["id"] in ids]
                    state["players"]["bot4"]["hand"] = hand
                    natural = [card["id"] for card in hand if card.get("rank") == 6]
                    upgraded = guandan._prefer_bomb_closeout_upgrade(state, "bot4", natural)
                    self.assertEqual(set(upgraded), set(natural + pick_card_ids(hand, (wild,) * wild_count)))
                    self.assertIsNone(guandan.GuandanGame.apply_action(
                        state, "bot4", {"type": "play", "card_ids": upgraded})[1])
                    self.assertEqual(len(state["players"]["bot4"]["hand"]), 1)

    def test_upgrade_preserves_a_necessary_wildcard_or_a_second_bomb(self):
        tails = {
            "multiple_plays": ("♥️2", "♦️10", "♠️J"),
            "wildcard_straight": ("♥️2", "♦️3", "♦️4", "♦️5", "♦️7"),
            "second_bomb": ("♥️2", "♠️8", "♥️8", "♣️8"),
            "immediate_finish": ("♥️2",),
        }
        for name, tail in tails.items():
            with self.subTest(name=name):
                state = replay_fixture("b0a262", 72)
                deck = guandan._full_deck()
                ids = pick_card_ids(deck, ("♠️6", "♥️6", "♣️6", "♦️6") + tail)
                hand = [card for card in deck if card["id"] in ids]
                state["players"]["bot4"]["hand"] = hand
                natural = [card["id"] for card in hand if card.get("rank") == 6]
                self.assertEqual(guandan._prefer_bomb_closeout_upgrade(state, "bot4", natural), natural)
                score = guandan._bot_score_components(state, "bot4", natural + pick_card_ids(hand, ("♥️2",)), 2)
                self.assertNotIn("bomb_closeout_upgrade", score)

    def test_allocation_rule_requires_a_legal_enemy_bomb_response(self):
        for situation in ("teammate", "base_cannot_beat", "heart_two_is_not_wild"):
            with self.subTest(situation=situation):
                state = replay_fixture("b0a262", 72)
                hand = state["players"]["bot4"]["hand"]
                natural = [card["id"] for card in hand if card.get("rank") == 6]
                if situation == "teammate":
                    state["current_trick"]["player_id"] = "bot2"
                elif situation == "base_cannot_beat":
                    state["current_trick"]["combo"]["rank_value"] = guandan._point_order_value(7, 2)
                else:
                    state["level_rank"] = 3
                self.assertEqual(guandan._prefer_bomb_closeout_upgrade(state, "bot4", natural), natural)


if __name__ == "__main__":
    unittest.main()
