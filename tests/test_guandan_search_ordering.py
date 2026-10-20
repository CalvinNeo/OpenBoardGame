import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanSearchOrderingTests(unittest.TestCase):
    def test_root_quick_response_uses_only_duplicate_family_slot(self):
        state = {"players": {"bot": {"hand": []}, "mate": {"hand": []}}}
        actions = [{"type": "play", "card_ids": [cid]} for cid in (1, 2, 3, 4)]
        passed = {"type": "pass"}

        def combo(_state, _actor, action):
            if action == actions[1]:
                return {"type": "bomb", "size": 4, "rank_value": 55}
            return {"type": "single", "size": 1, "rank_value": 50}

        with mock.patch.object(guandan_ai, "_critical_enemy_closeout_lead", return_value=False), \
             mock.patch.object(guandan_ai, "_teammate_of", return_value="mate"), \
             mock.patch.object(guandan_ai, "_action_combo", side_effect=combo), \
             mock.patch.object(guandan_ai, "_quick_candidate_score",
                               side_effect=lambda _s, _p, cards: float(cards[0])):
            for width, expected in (
                (1, [actions[0], passed]),
                (2, [actions[0], actions[1], passed]),
                (3, [actions[0], actions[1], actions[3], passed]),
            ):
                with self.subTest(width=width):
                    selected = guandan_ai.call(
                        guandan, "_mcts_root_candidate_subset", state, "bot", actions + [passed], width,
                    )
                    self.assertEqual(selected, expected)

    def response_fixture(self):
        players = [{"player_id": f"p{i}", "name": f"p{i}", "seat": i} for i in range(4)]
        with mock.patch.object(guandan, "random", random.Random(235575)):
            state = guandan.GuandanGame.init_game({}, players)
        deck = {card["id"]: card for card in guandan._full_deck()}
        hands = {
            "p0": [77, 15, 102, 9, 12, 68, 101, 62],
            "p1": [47, 43, 98, 45, 83, 95, 69],
            "p2": [105, 106, 26, 81, 54, 46, 2, 22, 71],
            "p3": [67, 91, 44, 5, 29, 51],
        }
        for team in state["teams"].values():
            team["level"] = 14
        for pid, ids in hands.items():
            state["players"][pid].update(hand=[deck[cid] for cid in ids], finished=False, finish_rank=None)
        state.update(
            phase="playing", level_rank=14, current_turn="p0", current_trick=None,
            pass_count=0, trick_plays={}, finish_order=[], round_memories=[],
            known_card_owners={}, visible_card_id=None, _ai_eval_cache={}, _ai_sampled_world=True,
        )
        remaining = {cid for ids in hands.values() for cid in ids}
        state["seen_cards"] = [cid for cid in deck if cid not in remaining]
        self.assertIsNone(guandan.GuandanGame.apply_action(
            state, "p0", {"type": "play", "card_ids": [101, 62]}
        )[1])
        return state

    def test_static_ordering_does_not_change_rollout_response(self):
        # The pair forces three passes, then p0 can lead single 3 (card 68).
        # Static scoring as p1 ranks p1's replies and writes soft penalties.
        # Those ordering-only priors must not leak into the actual rollout.
        values = []
        for alpha, beta in ((-1e9, 1e9), (-1e8, 1e8)):
            with self.subTest(alpha=alpha, beta=beta):
                state = self.response_fixture()
                original = copy.deepcopy(state)
                responses = []
                real_policy = guandan_ai._rollout_policy_action

                def record_policy(frontier, actor):
                    action = real_policy(frontier, actor)
                    if actor == "p1" and (frontier.get("current_trick") or {}).get("cards") == [68]:
                        responses.append(action)
                    return action

                with mock.patch.object(guandan_ai, "_rollout_policy_action", side_effect=record_policy):
                    values.append(guandan._mcts_reply_tree_value(
                        state, "p1", 1, 2, 2, alpha=alpha, beta=beta,
                    ))
                self.assertTrue(responses)
                self.assertTrue(all(action == {"type": "play", "card_ids": [83]}
                                    for action in responses))
                self.assertEqual({k: v for k, v in state.items() if k != "_ai_eval_cache"},
                                 {k: v for k, v in original.items() if k != "_ai_eval_cache"})
        self.assertEqual(values[0], values[1])

    def test_finite_window_preserves_static_order_and_cutoff_bound(self):
        # A finite window must retain the existing static order. The first
        # child can cut off with a fail-soft bound distinct from later leaves.
        for maximize in (True, False):
            with self.subTest(maximize=maximize):
                visits = []
                sign = 1 if maximize else -1

                def apply(state, actor, action):
                    state["branch"] = action["branch"]
                    return [], None

                def evaluate(state, bot):
                    state.setdefault("_ai_eval_cache", {})["ordering_only"] = True
                    return sign * (10 if state["branch"] == 1 else 20)

                def rollout(state, bot, depth):
                    self.assertNotIn("ordering_only", state.get("_ai_eval_cache", {}))
                    visits.append(state["branch"])
                    return sign * (40 if state["branch"] == 1 else 30)

                with mock.patch.object(guandan_ai, "_next_actor", return_value="actor"), \
                     mock.patch.object(guandan_ai, "_team_of", side_effect=lambda s, p: "A" if p == "bot" or maximize else "B"), \
                     mock.patch.object(guandan, "_candidate_actions", return_value=[{"branch": 1}, {"branch": 2}]), \
                     mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda s, p, acts: acts), \
                     mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=apply), \
                     mock.patch.object(guandan_ai, "_evaluate_state_for_bot", side_effect=evaluate), \
                     mock.patch.object(guandan_ai, "_rollout_value", side_effect=rollout):
                    value = guandan._mcts_reply_tree_value(
                        {"phase": "playing"}, "bot", 1, 2, 0,
                        alpha=-1e9 if maximize else -25,
                        beta=25 if maximize else 1e9,
                    )
                self.assertEqual(visits, [2])
                self.assertEqual(value, sign * 30)

    def test_final_open_window_skips_static_ordering_evaluations(self):
        visits = []

        def apply(state, actor, action):
            state["branch"] = action["branch"]
            return [], None

        def rollout(state, bot, depth):
            visits.append(state["branch"])
            return float(state["branch"])

        with mock.patch.object(guandan_ai, "_next_actor", return_value="bot"), \
             mock.patch.object(guandan_ai, "_team_of", return_value="A"), \
             mock.patch.object(guandan, "_candidate_actions", return_value=[{"branch": 1}, {"branch": 2}]), \
             mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda s, p, acts: acts), \
             mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=apply), \
             mock.patch.object(guandan_ai, "_evaluate_state_for_bot", return_value=0.0) as static, \
             mock.patch.object(guandan_ai, "_rollout_value", side_effect=rollout):
            value = guandan._mcts_reply_tree_value({"phase": "playing"}, "bot", 1, 2, 0)
        static.assert_not_called()
        self.assertEqual(visits, [1, 2])
        self.assertEqual(value, 2.0)

    def test_final_rollout_deadline_discards_the_value(self):
        clock = [0.0]

        def apply(state, actor, action):
            return [], None

        def rollout(state, bot, depth):
            clock[0] = 11.0
            return 999.0

        with mock.patch.object(guandan_ai, "_next_actor", return_value="bot"), \
             mock.patch.object(guandan_ai, "_team_of", return_value="A"), \
             mock.patch.object(guandan, "_candidate_actions", return_value=[{"type": "pass"}]), \
             mock.patch.object(guandan, "_filter_overbomb_actions", side_effect=lambda s, p, acts: acts), \
             mock.patch.object(guandan.GuandanGame, "apply_action", side_effect=apply), \
             mock.patch.object(guandan_ai, "_rollout_value", side_effect=rollout), \
             mock.patch.object(guandan_ai, "_evaluate_state_for_bot", return_value=0.0), \
             mock.patch.object(guandan_ai.time, "perf_counter", side_effect=lambda: clock[0]), \
             mock.patch.object(guandan_ai._CORE_LOCAL, "deadline", 10.0, create=True):
            with self.assertRaises(guandan_ai._MctsSearchInterrupted):
                guandan._mcts_reply_tree_value({"phase": "playing"}, "bot", 1, 1, 0)


if __name__ == "__main__":
    unittest.main()
