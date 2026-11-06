import copy
import random
import unittest
from unittest.mock import patch

from game.ai_metadata import STRATEGIC_AI_GAME_IDS
from game.wriggle_roulette import WriggleRouletteGame as Game
from game.wriggle_roulette_ai import _rollout, _round_value, choose_action


def _state(count=2, seed="ai-tests"):
    players = [
        {"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat, "is_bot": True}
        for seat in range(count)
    ]
    with patch("game.wriggle_roulette._new_private_seed", return_value=seed):
        return Game.init_game({}, players)


def _solo_view(*, score=0, saved=0, rival_score=0, danger=1, eels=20, snakes=5):
    state = _state()
    player_id = state["current_player_id"]
    view = Game.get_public_view(state, player_id)
    for player in view["players"]:
        if player["player_id"] == player_id:
            player.update(score=score, round_eels=saved)
        else:
            player.update(score=rival_score, status="withdrawn", exit_wave=1)
    view.update(cycle_no=2, bag_count=eels + snakes, bag_eels=eels, bag_snakes=snakes,
                center_snakes=view["outbreak_threshold"] - danger)
    return view


class WriggleRouletteAiTests(unittest.TestCase):
    def test_catalog_marks_the_rollout_policy_as_strategic(self):
        self.assertIn(Game.game_id, STRATEGIC_AI_GAME_IDS)

    def test_low_risk_play_does_not_bank_at_the_old_five_eel_limit(self):
        state = _state()
        view = Game.get_public_view(state, state["current_player_id"])
        for player in view["players"]:
            player["round_eels"] = 5
        view.update(bag_eels=41, bag_count=58)
        self.assertGreater(choose_action(view)["count"], 0)

    def test_solo_draws_one_at_a_time_even_with_a_large_saved_haul(self):
        view = _solo_view(saved=8, danger=2)
        self.assertEqual(choose_action(view)["count"], 1)

    def test_solo_banks_when_last_snake_risk_outweighs_gain(self):
        view = _solo_view(saved=6, danger=1)
        self.assertEqual(choose_action(view)["count"], 0)

    def test_solo_chases_a_finished_opponent_instead_of_banking_a_loss(self):
        view = _solo_view(score=10, saved=9, rival_score=21)
        self.assertEqual(choose_action(view)["count"], 1)

    def test_solo_banks_a_winning_tie_with_later_exit(self):
        view = _solo_view(score=14, saved=7, rival_score=21)
        self.assertEqual(choose_action(view)["count"], 0)

    def test_solo_protects_a_winning_score(self):
        view = _solo_view(score=18, saved=2, rival_score=19, danger=4)
        self.assertEqual(choose_action(view)["count"], 0)

    def test_empty_or_snake_only_bags_bank(self):
        for snakes in (0, 5):
            with self.subTest(snakes=snakes):
                view = Game.get_public_view(_state(), "p0")
                view.update(legal_actions=["grab"], bag_count=snakes, bag_eels=0, bag_snakes=snakes)
                self.assertEqual(choose_action(view)["count"], 0)

    def test_illegal_phase_or_player_has_no_action(self):
        state = _state()
        other = next(player_id for player_id in state["turn_order"] if player_id != state["current_player_id"])
        self.assertIsNone(Game.bot_move(state, other))
        self.assertIsNone(Game.bot_move(state, "missing"))
        state["phase"] = "round_review"
        self.assertIsNone(Game.bot_move(state, state["current_player_id"]))
        self.assertIsNone(choose_action({"legal_actions": []}))

    def test_hidden_pending_choices_tokens_and_seed_do_not_affect_decision(self):
        for count in (2, 4, 8):
            with self.subTest(count=count):
                state = _state(count)
                first = state["current_player_id"]
                _, error = Game.apply_action(state, first, {"type": "grab", "count": 1, "cycle_no": 1})
                self.assertIsNone(error)
                altered = copy.deepcopy(state)
                altered["pending_hands"][first]["token_ids"].extend(altered["bag"].pop() for _ in range(3))
                altered["pending_hands"][first]["requested_count"] = 4
                altered["bag"].reverse()
                altered["rng_seed"] = "different-private-seed"
                altered["shuffle_index"] += 5
                player_id = state["current_player_id"]
                self.assertEqual(Game.get_public_view(state, player_id), Game.get_public_view(altered, player_id))
                self.assertEqual(Game.bot_move(state, player_id), Game.bot_move(altered, player_id))

    def test_policy_is_deterministic_and_does_not_mutate_state_or_global_rng(self):
        state = _state(4)
        before = copy.deepcopy(state)
        rng_before = random.getstate()
        first = Game.bot_move(state, state["current_player_id"])
        second = Game.bot_move(state, state["current_player_id"])
        self.assertEqual(first, second)
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), rng_before)

    def test_rollout_busts_every_tied_largest_hand(self):
        with patch("game.wriggle_roulette_ai._model_count", return_value=1), \
                patch("game.wriggle_roulette_ai._round_value", return_value=0.5) as evaluate:
            _rollout([15, 15], [5, 5], [0, 0], [0, 1], [1, 1], 1, 2,
                     0, 1, 6, 20, [1, 1], 0)
        evaluate.assert_called_once_with([15, 15], [2, 2], 0, 20)

    def test_rollout_banks_smaller_hand_including_its_new_eels_on_outbreak(self):
        with patch("game.wriggle_roulette_ai._model_count", return_value=2):
            value = _rollout([15, 18], [4, 8], [0, 0], [0, 1], [1, 1, 0], 1, 2,
                             0, 1, 6, 20, [1, 1], 0)
        self.assertEqual(value, 1.0)

    def test_rollout_uses_actual_not_requested_hand_size_when_bag_runs_out(self):
        with patch("game.wriggle_roulette_ai._model_count", return_value=2):
            value = _rollout([19, 19], [1, 1], [0, 0], [0, 1], [1], 1, 2,
                             1, 6, 6, 20, [1, 1], 0)
        self.assertEqual(value, 1.0)

    def test_rollout_continues_after_bot_withdraws_and_returns_its_eels(self):
        requests = []

        def model(scores, hauls, active, player, eels, snakes, danger, maximum, winning_score, profile):
            requests.append((tuple(active), eels))
            return 1 if hauls[player] < 2 else 0

        with patch("game.wriggle_roulette_ai._model_count", side_effect=model):
            value = _rollout([19, 18], [1, 0], [0, 0], [0, 1], [0], 2, 2,
                             0, 0, 6, 20, [1, 1], 0)
        self.assertEqual(value, 0.0)
        self.assertIn(((1,), 1), requests)

    def test_rollout_rotates_to_last_active_actor_after_reveal(self):
        with patch("game.wriggle_roulette_ai._model_count", side_effect=[1, 1, 0, 0, 0]) as model:
            _rollout([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 2], [0] * 6, 3, 1,
                     0, 1, 4, 20, [1, 1, 1], 0)
        self.assertEqual([call.args[3] for call in model.call_args_list], [1, 2, 2, 0, 1])

    def test_rollout_skips_withdrawn_last_actor_when_rotating(self):
        with patch("game.wriggle_roulette_ai._model_count", side_effect=[1, 0, 0, 0]) as model:
            _rollout([0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 1, 2], [0] * 6, 3, 1,
                     0, 1, 4, 20, [1, 1, 1], 0)
        self.assertEqual([call.args[3] for call in model.call_args_list], [1, 2, 0, 1])

    def test_public_locked_flags_reconstruct_cycle_order(self):
        for count in (2, 4, 8):
            state = _state(count)
            expected = [state["turn_order"].index(player_id) for player_id in state["cycle_order"]]
            for _ in range(count):
                with self.subTest(count=count, choice=state["choice_index"]):
                    with patch("game.wriggle_roulette_ai._rollout", return_value=0.5) as rollout:
                        action = Game.bot_move(state, state["current_player_id"])
                    self.assertEqual(rollout.call_args.args[3], expected)
                    _, error = Game.apply_action(state, state["current_player_id"], action)
                    self.assertIsNone(error)

    def test_round_value_respects_terminal_score_exit_wave_and_shared_wins(self):
        self.assertEqual(_round_value([20, 20], [2, 3], 0, 20), 0.0)
        self.assertEqual(_round_value([20, 20], [2, 3], 1, 20), 1.0)
        self.assertEqual(_round_value([20, 20], [3, 3], 0, 20), 0.5)
        self.assertEqual(_round_value([21, 20], [2, 3], 0, 20), 1.0)

    def test_all_supported_player_counts_finish_with_legal_actions(self):
        for count in range(2, 9):
            with self.subTest(count=count):
                state = _state(count)
                for _ in range(2000):
                    if state["game_over"]:
                        break
                    player_id = state["current_player_id"]
                    action = Game.bot_move(state, player_id)
                    self.assertIsNotNone(action)
                    _, error = Game.apply_action(state, player_id, action)
                    self.assertIsNone(error)
                self.assertTrue(state["game_over"])
                self.assertTrue(state["winner_ids"])


if __name__ == "__main__":
    unittest.main()
