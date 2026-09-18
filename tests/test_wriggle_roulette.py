import copy
import unittest
from unittest.mock import patch

from game.wriggle_roulette import TOTAL_TOKENS, WriggleRouletteGame


def _players(*, bots=()):
    return [
        {
            "player_id": player_id,
            "name": f"Player {index}",
            "seat": index,
            "is_bot": player_id in bots,
        }
        for index, player_id in enumerate(("p1", "p2"), start=1)
    ]


def _new_state(*, bots=()):
    with patch("game.wriggle_roulette._new_private_seed", return_value="test-private-seed"):
        return WriggleRouletteGame.init_game({}, _players(bots=bots))


def _set_next_draws(state, token_ids):
    wanted = list(token_ids)
    state["bag"] = [token_id for token_id in state["bag"] if token_id not in wanted]
    state["bag"].extend(reversed(wanted))


def _take_eel_into_round(state, player_id):
    index = next(index for index, token_id in enumerate(state["bag"]) if token_id.startswith("eel-"))
    state["players"][player_id]["round_eels"].append(state["bag"].pop(index))


def _grab_for_current(state, count):
    player_id = state["current_player_id"]
    events, error = WriggleRouletteGame.apply_action(
        state,
        player_id,
        {"type": "grab", "count": count, "cycle_no": state["cycle_no"]},
    )
    return player_id, events, error


class WriggleRouletteGameTests(unittest.TestCase):
    def test_initial_state_and_public_view_keep_private_randomness_hidden(self):
        state = _new_state()
        self.assertEqual(len(state["bag"]), TOTAL_TOKENS)
        self.assertEqual(state["outbreak_threshold"], 6)
        self.assertEqual(state["phase"], "choosing")

        first = state["current_player_id"]
        other = next(player_id for player_id in state["turn_order"] if player_id != first)
        _, events, error = _grab_for_current(state, 2)
        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"], {"player_id": first, "cycle_no": 1})

        first_view = WriggleRouletteGame.get_public_view(state, first)
        other_view = WriggleRouletteGame.get_public_view(state, other)
        self.assertEqual(first_view["your_pending_count"], 2)
        self.assertIsNone(other_view["your_pending_count"])
        self.assertEqual(first_view["bag_count"], TOTAL_TOKENS)
        self.assertEqual(other_view["bag_count"], TOTAL_TOKENS)
        self.assertNotIn("bag", first_view)
        self.assertNotIn("rng_seed", first_view)
        self.assertNotIn("token_ids", repr(first_view))

    def test_all_hands_reveal_together_and_require_active_humans(self):
        state = _new_state()
        _set_next_draws(state, ["eel-01", "snake-01", "eel-02"])
        first, _, error = _grab_for_current(state, 2)
        self.assertIsNone(error)
        second, events, error = _grab_for_current(state, 1)
        self.assertIsNone(error)
        self.assertNotEqual(first, second)
        self.assertEqual(state["phase"], "reveal_review")
        self.assertEqual({row["player_id"] for row in state["last_reveal"]["results"]}, {"p1", "p2"})
        self.assertEqual(sum(row["actual_count"] for row in state["last_reveal"]["results"]), 3)
        self.assertTrue(any(event["type"] == "wriggle_roulette:reveal" for event in events))
        self.assertEqual(set(state["review_required"]), {"p1", "p2"})

    def test_zero_banks_eels_and_withdrawn_player_does_not_block_review(self):
        state = _new_state()
        order = list(state["cycle_order"])
        _set_next_draws(state, ["eel-01", "eel-02"])
        _grab_for_current(state, 1)
        _grab_for_current(state, 1)
        for player_id in order:
            events, error = WriggleRouletteGame.apply_action(
                state,
                player_id,
                {"type": "ready_reveal", "cycle_no": state["cycle_no"]},
            )
            self.assertIsNone(error)
        withdrawing = state["current_player_id"]
        continuing = next(player_id for player_id in state["turn_order"] if player_id != withdrawing)
        _set_next_draws(state, ["eel-03"])
        _grab_for_current(state, 0)
        self.assertEqual(state["current_player_id"], continuing)
        _grab_for_current(state, 1)

        self.assertEqual(state["players"][withdrawing]["score"], 1)
        self.assertEqual(state["players"][withdrawing]["status"], "withdrawn")
        self.assertEqual(state["review_required"], [continuing])
        self.assertEqual(WriggleRouletteGame.get_legal_actions(state, withdrawing), [])
        self.assertEqual(WriggleRouletteGame.get_legal_actions(state, continuing), ["ready_reveal"])

    def test_outbreak_busts_every_player_tied_for_largest_hand(self):
        state = _new_state()
        _set_next_draws(
            state,
            ["snake-01", "snake-02", "snake-03", "snake-04", "snake-05", "snake-06"],
        )
        _grab_for_current(state, 3)
        _grab_for_current(state, 3)

        self.assertEqual(state["phase"], "round_review")
        self.assertEqual(set(state["round_summary"]["busted_ids"]), {"p1", "p2"})
        self.assertEqual([state["players"][pid]["score"] for pid in state["turn_order"]], [0, 0])
        self.assertEqual(len(state["bag"]), TOTAL_TOKENS)
        self.assertEqual(state["last_reveal"]["center_snakes_after"], 6)

    def test_outbreak_only_busts_largest_hand_and_other_player_scores(self):
        state = _new_state()
        first, second = state["cycle_order"]
        _set_next_draws(
            state,
            [
                "snake-01",
                "snake-02",
                "snake-03",
                "snake-04",
                "snake-05",
                "snake-06",
                "eel-01",
            ],
        )
        _grab_for_current(state, 4)
        _grab_for_current(state, 3)

        self.assertEqual(state["round_summary"]["busted_ids"], [first])
        self.assertEqual(state["players"][first]["score"], 0)
        self.assertEqual(state["players"][second]["score"], 1)

    def test_final_score_tie_is_broken_by_later_exit_wave(self):
        state = _new_state()
        early, late = state["cycle_order"]
        state["players"][early]["score"] = 19
        state["players"][late]["score"] = 18
        _take_eel_into_round(state, early)
        _take_eel_into_round(state, late)
        _set_next_draws(state, ["eel-51"])

        _grab_for_current(state, 0)
        _grab_for_current(state, 1)
        self.assertEqual(state["phase"], "reveal_review")
        self.assertEqual(state["review_required"], [late])
        _, error = WriggleRouletteGame.apply_action(
            state,
            late,
            {"type": "ready_reveal", "cycle_no": state["cycle_no"]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["current_player_id"], late)
        _grab_for_current(state, 0)

        self.assertEqual(state["players"][early]["score"], 20)
        self.assertEqual(state["players"][late]["score"], 20)
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["winner_ids"], [late])

    def test_stale_cycle_action_is_rejected_without_mutation(self):
        state = _new_state()
        before = copy.deepcopy(state)
        _, error = WriggleRouletteGame.apply_action(
            state,
            state["current_player_id"],
            {"type": "grab", "count": 2, "cycle_no": 99},
        )
        self.assertEqual(error, "that grab belongs to an old cycle")
        self.assertEqual(state, before)

    def test_round_review_waits_for_every_human_and_uses_final_actor_as_starter(self):
        state = _new_state()
        next_starter = state["cycle_order"][-1]
        _set_next_draws(
            state,
            ["snake-01", "snake-02", "snake-03", "snake-04", "snake-05", "snake-06"],
        )
        _grab_for_current(state, 3)
        _grab_for_current(state, 3)
        self.assertEqual(state["phase"], "round_review")

        first_ready = state["turn_order"][0]
        _, error = WriggleRouletteGame.apply_action(
            state,
            first_ready,
            {"type": "next_round", "round_no": 1},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_review")
        second_ready = state["turn_order"][1]
        _, error = WriggleRouletteGame.apply_action(
            state,
            second_ready,
            {"type": "next_round", "round_no": 1},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "choosing")
        self.assertEqual(state["round_no"], 2)
        self.assertEqual(state["current_player_id"], next_starter)

    def test_two_bot_game_reaches_a_winner_without_review_deadlock(self):
        state = _new_state(bots=("p1", "p2"))
        for _ in range(1000):
            if state["game_over"]:
                break
            bot_id = state["current_player_id"]
            action = WriggleRouletteGame.bot_move(state, bot_id)
            self.assertIsNotNone(action)
            action.pop("delay_ms", None)
            _, error = WriggleRouletteGame.apply_action(state, bot_id, action)
            self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertTrue(state["winner_ids"])

    def test_bot_choice_uses_public_counts_not_hidden_bag_order(self):
        state = _new_state(bots=("p1", "p2"))
        bot_id = state["current_player_id"]
        reordered = copy.deepcopy(state)
        reordered["bag"] = list(reversed(reordered["bag"]))
        self.assertEqual(
            WriggleRouletteGame.bot_move(state, bot_id),
            WriggleRouletteGame.bot_move(reordered, bot_id),
        )

    def test_serialization_round_trip_and_invalid_payload(self):
        state = _new_state()
        restored = WriggleRouletteGame.deserialize(WriggleRouletteGame.serialize(state))
        self.assertEqual(restored, state)
        restored["bag"].pop()
        with self.assertRaises(ValueError):
            WriggleRouletteGame.deserialize(restored)


if __name__ == "__main__":
    unittest.main()
