import copy
import random
import unittest
from unittest.mock import patch

from game.incan_gold import HAZARD_TYPES, IncanGoldGame as Game
from game.incan_gold_ai import _leave_distribution


def make_state(count=3):
    with patch("game.incan_gold.random.shuffle", lambda deck: None):
        state = Game.init_game({}, [
            {"player_id": f"p{index}", "name": f"Explorer {index}", "seat": index, "is_bot": True}
            for index in range(count)
        ])
    return state


class IncanGoldAiTests(unittest.TestCase):
    def test_safe_treasure_is_worth_continuing_even_with_large_hand(self):
        state = make_state()
        state["path_cards"] = [{"type": "treasure", "value": 17, "remainder": 0}]
        state["players"]["p0"]["hand_gems"] = 25
        self.assertEqual(Game.bot_move(state, "p0"), {"type": "decide", "choice": "continue"})

    def test_protects_large_hand_against_repeated_hazards(self):
        state = make_state()
        for hazard in HAZARD_TYPES[:4]:
            state["hazard_counts"][hazard] = 1
            state["path_cards"].append({"type": "hazard", "hazard": hazard})
            state["deck"].pop()
        state["players"]["p0"]["hand_gems"] = 30
        self.assertEqual(Game.bot_move(state, "p0")["choice"], "leave")

    def test_empty_handed_explorer_can_take_a_risk(self):
        state = make_state()
        state["path_cards"] = []
        for hazard in HAZARD_TYPES[:3]:
            state["hazard_counts"][hazard] = 1
            state["path_cards"].append({"type": "hazard", "hazard": hazard})
        state["deck"] = state["deck"][:-2]
        self.assertEqual(Game.bot_move(state, "p0")["choice"], "continue")

    def test_last_explorer_claims_artifact_and_remainders(self):
        state = make_state()
        state["current_round"] = 4
        state["players"]["p0"]["hand_gems"] = 5
        for player_id in ["p1", "p2"]:
            state["players"][player_id]["status"] = "in_camp"
        state["path_cards"] = [
            {"type": "artifact", "value": 10},
            {"type": "treasure", "value": 17, "remainder": 2},
            {"type": "hazard", "hazard": "snake"},
            {"type": "hazard", "hazard": "spider"},
            {"type": "hazard", "hazard": "fire"},
            {"type": "hazard", "hazard": "mummy"},
        ]
        state["hazard_counts"] = {"snake": 1, "spider": 1, "fire": 1, "mummy": 1}
        state["deck"] = state["deck"][:-5]
        self.assertEqual(Game.bot_move(state, "p0")["choice"], "leave")

    def test_removed_hazards_are_not_counted_as_future_danger(self):
        state = make_state()
        state["path_cards"] = [{"type": "hazard", "hazard": "snake"}]
        state["hazard_counts"] = {"snake": 1}
        state["removed_hazards"]["snake"] = 2
        state["deck"] = state["deck"][:-2]
        state["players"]["p0"]["hand_gems"] = 40
        self.assertEqual(Game.bot_move(state, "p0")["choice"], "continue")

    def test_remainders_are_divided_per_card_and_shared_artifacts_are_discarded(self):
        state = make_state()
        state["path_cards"] = [
            {"type": "treasure", "value": 5, "remainder": 2},
            {"type": "treasure", "value": 4, "remainder": 1},
            {"type": "artifact", "value": 5},
        ]
        state["players"]["p0"]["hand_gems"] = 3
        state["players"]["p1"]["hand_gems"] = 3
        Game.apply_action(state, "p0", {"type": "decide", "choice": "leave"})
        Game.apply_action(state, "p1", {"type": "decide", "choice": "leave"})
        Game.apply_action(state, "p2", {"type": "decide", "choice": "continue"})
        for player_id in ["p0", "p1"]:
            self.assertEqual(state["players"][player_id]["banked_gems"], 4)
            self.assertEqual(state["players"][player_id]["artifact_count"], 0)
        self.assertFalse(any(card["type"] == "artifact" for card in state["path_cards"]))
        self.assertEqual([card["remainder"] for card in state["path_cards"] if card["type"] == "treasure"], [0, 1])

    def test_solo_returner_collects_all_path_loot(self):
        state = make_state()
        state["path_cards"] = [
            {"type": "treasure", "value": 5, "remainder": 2},
            {"type": "artifact", "value": 5},
        ]
        state["players"]["p0"]["hand_gems"] = 3
        Game.apply_action(state, "p0", {"type": "decide", "choice": "leave"})
        Game.apply_action(state, "p1", {"type": "decide", "choice": "continue"})
        Game.apply_action(state, "p2", {"type": "decide", "choice": "continue"})
        self.assertEqual(state["players"]["p0"]["banked_gems"], 5)
        self.assertEqual(state["players"]["p0"]["artifact_points"], 5)
        self.assertEqual(state["players"]["p0"]["artifact_count"], 1)

    def test_old_round_end_save_can_collect_confirmations(self):
        state = make_state()
        state["phase"] = "round_end"
        state.pop("next_round_ready")
        state.pop("last_decisions")
        restored = Game.deserialize(copy.deepcopy(Game.serialize(state)))
        self.assertEqual(Game.get_public_view(restored, "p0")["next_round_ready"], [])
        for player_id in restored["turn_order"]:
            self.assertIsNone(Game.apply_action(restored, player_id, {"type": "next_round"})[1])
        self.assertEqual(restored["current_round"], 2)

    def test_last_card_banks_hand_without_awarding_artifacts(self):
        state = make_state()
        state["deck"] = [{"type": "treasure", "value": 9}]
        for player_id in state["turn_order"]:
            self.assertIsNone(Game.apply_action(state, player_id, {"type": "decide", "choice": "continue"})[1])
        self.assertEqual(state["round_end_reason"], "deck_empty")
        for player in state["players"].values():
            self.assertEqual(player["banked_gems"], 3)
            self.assertEqual(player["artifact_points"], 0)

    def test_hidden_deck_and_pending_decisions_do_not_influence_policy(self):
        state = make_state()
        original = copy.deepcopy(state)
        expected = Game.bot_move(state, "p0")
        self.assertEqual(state, original)
        state["deck"] = [{"type": "treasure", "value": 1000}] * len(state["deck"])
        state["base_deck"] = []
        state["decisions"] = {"p1": "leave", "p2": "leave"}
        self.assertEqual(Game.bot_move(state, "p0"), expected)
        state["decisions"] = {"p1": "continue", "p2": "continue"}
        self.assertEqual(Game.bot_move(state, "p0"), expected)

    def test_ineligible_bots_do_not_move_or_restart(self):
        state = make_state()
        self.assertIsNone(Game.bot_move(state, "missing"))
        state["decisions"]["p0"] = "continue"
        self.assertIsNone(Game.bot_move(state, "p0"))
        state["decisions"] = {}
        state["players"]["p0"]["status"] = "in_camp"
        self.assertIsNone(Game.bot_move(state, "p0"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_opponent_distribution_covers_all_simultaneous_outcomes(self):
        self.assertEqual(_leave_distribution([0.25, 0.5]), [0.375, 0.5, 0.125])

    def test_round_waits_for_every_player_and_rejects_duplicate_confirmation(self):
        state = make_state()
        for player_id in state["turn_order"]:
            self.assertIsNone(Game.apply_action(state, player_id, {"type": "decide", "choice": "leave"})[1])
        self.assertEqual(state["phase"], "round_end")
        for player_id in ["p0", "p1"]:
            self.assertIsNone(Game.apply_action(state, player_id, {"type": "next_round"})[1])
            self.assertEqual(state["current_round"], 1)
            self.assertEqual(Game.get_legal_actions(state, player_id), [])
            self.assertIsNone(Game.bot_move(state, player_id))
        before = copy.deepcopy(state)
        self.assertEqual(Game.apply_action(state, "p0", {"type": "next_round"})[1], "already ready")
        self.assertEqual(state, before)
        self.assertIsNone(Game.apply_action(state, "p2", {"type": "next_round"})[1])
        self.assertEqual(state["current_round"], 2)
        self.assertEqual(state["next_round_ready"], [])
        self.assertEqual(state["last_decisions"], {})

    def test_choices_are_revealed_only_after_everyone_decides(self):
        state = make_state()
        events, error = Game.apply_action(state, "p0", {"type": "decide", "choice": "leave"})
        self.assertIsNone(error)
        self.assertNotIn("choice", events[0]["payload"])
        view = Game.get_public_view(state, "p1")
        self.assertIsNone(view["your_decision"])
        self.assertEqual(view["last_decisions"], {})
        Game.apply_action(state, "p1", {"type": "decide", "choice": "continue"})
        events, error = Game.apply_action(state, "p2", {"type": "decide", "choice": "continue"})
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "incan_gold:decisions" for event in events))
        self.assertEqual(Game.get_public_view(state, "p1")["last_decisions"], {
            "p0": "leave", "p1": "continue", "p2": "continue",
        })

    def test_bot_games_finish_and_rematch_resets(self):
        previous_random = random.getstate()
        try:
            for count in [3, 5, 8]:
                for seed in range(3):
                    with self.subTest(count=count, seed=seed):
                        random.seed(seed)
                        state = make_state(count)
                        for _ in range(500):
                            if state["game_over"]:
                                break
                            moved = False
                            for player_id in state["turn_order"]:
                                action = Game.bot_move(state, player_id)
                                if action:
                                    self.assertIsNone(Game.apply_action(state, player_id, action)[1])
                                    moved = True
                            self.assertTrue(moved)
                        self.assertTrue(state["game_over"])
                        self.assertEqual(state["current_round"], 5)
                        self.assertTrue(state["winner"])
                        self.assertEqual(Game.get_legal_actions(state, "p0"), ["play_again"])
                        self.assertIsNone(Game.apply_action(state, "p0", {"type": "play_again"})[1])
                        self.assertFalse(state["game_over"])
                        self.assertEqual(state["current_round"], 1)
                        self.assertTrue(all(player["banked_gems"] == 0 for player in state["players"].values()))
        finally:
            random.setstate(previous_random)


if __name__ == "__main__":
    unittest.main()
