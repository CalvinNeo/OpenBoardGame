import unittest
from unittest.mock import patch

from game.dumb_questions import DumbQuestionsGame


def _players(count: int) -> list[dict]:
    return [
        {"player_id": f"p{index}", "name": f"Player {index}", "seat": index}
        for index in range(count)
    ]


class DumbQuestionsGameTests(unittest.TestCase):
    def test_insert_into_filled_slot_shifts_existing_cards(self):
        placements = {1: "a", 2: "b", 4: "c"}
        from game.dumb_questions import _insert_card_at_slot

        inserted = _insert_card_at_slot(placements, 2, "x")

        self.assertTrue(inserted)
        self.assertEqual(placements, {1: "a", 2: "x", 3: "b", 4: "c"})

    def test_round_flow_scores_guesser_by_target_slot(self):
        with patch("game.dumb_questions.random.randrange", return_value=0), patch(
            "game.dumb_questions.random.shuffle", side_effect=lambda seq: None
        ):
            state = DumbQuestionsGame.init_game(None, _players(3))

        guesser_id = state["guesser_id"]
        answerers = [pid for pid in state["turn_order"] if pid != guesser_id]

        events, error = DumbQuestionsGame.apply_action(state, guesser_id, {"type": "select_category", "category": "player"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "answering")
        self.assertTrue(events)

        for index, player_id in enumerate(answerers, start=1):
            events, error = DumbQuestionsGame.apply_action(
                state,
                player_id,
                {"type": "submit_answer", "answer_text": f"answer {index}"},
            )
            self.assertIsNone(error)
            self.assertTrue(events)

        self.assertEqual(state["phase"], "guessing")

        target_card_id = state["target_card_id"]
        while state["phase"] == "guessing":
            DumbQuestionsGame.apply_action(state, guesser_id, {"type": "reveal_next_card"})
            pending_card_id = state["pending_card_id"]
            self.assertIsNotNone(pending_card_id)
            if pending_card_id == target_card_id:
                slot = 4
            else:
                slot = next(open_slot for open_slot in range(5) if open_slot not in state["placements"] and open_slot != 4)
            DumbQuestionsGame.apply_action(
                state,
                guesser_id,
                {"type": "place_card", "slot": slot, "card_id": pending_card_id},
            )

        self.assertEqual(state["phase"], "reveal")
        self.assertEqual(state["players"][guesser_id]["score"], 4)
        self.assertEqual(state["last_round_summary"]["points"], 4)
        self.assertEqual(state["last_round_summary"]["guessed_slot"], 4)

    def test_public_view_hides_prompt_from_guesser_until_reveal(self):
        with patch("game.dumb_questions.random.randrange", return_value=0), patch(
            "game.dumb_questions.random.shuffle", side_effect=lambda seq: None
        ):
            state = DumbQuestionsGame.init_game(None, _players(3))
        guesser_id = state["guesser_id"]
        answerer_id = next(pid for pid in state["turn_order"] if pid != guesser_id)

        DumbQuestionsGame.apply_action(state, guesser_id, {"type": "select_category", "category": "player"})
        guesser_view = DumbQuestionsGame.get_public_view(state, guesser_id)
        answerer_view = DumbQuestionsGame.get_public_view(state, answerer_id)

        self.assertIsNone(guesser_view["prompt_question"])
        self.assertTrue(answerer_view["prompt_question"])

    def test_game_over_exposes_play_again(self):
        with patch("game.dumb_questions.random.randrange", return_value=0), patch(
            "game.dumb_questions.random.shuffle", side_effect=lambda seq: None
        ):
            state = DumbQuestionsGame.init_game({"rounds_per_guesser": 1}, _players(3))

        state["round"] = state["total_rounds"]
        state["phase"] = "guessing"
        state["pending_card_id"] = None
        state["revealed_count"] = 5
        target_card_id = "player_1"
        state["target_card_id"] = target_card_id
        state["round_cards"] = [{"card_id": f"player_{index}", "question_text": f"Q{index}"} for index in range(1, 6)]
        state["placements"] = {0: "player_2", 1: "player_3", 2: "player_4", 3: "player_5", 4: target_card_id}

        DumbQuestionsGame.apply_action(state, state["guesser_id"], {"type": "place_card", "slot": 4, "card_id": target_card_id})
        state["phase"] = "game_over"
        state["game_over"] = True

        legal = DumbQuestionsGame.get_legal_actions(state, state["guesser_id"])
        self.assertEqual(legal, ["play_again"])

    def test_bot_does_not_submit_answer_twice(self):
        with patch("game.dumb_questions.random.randrange", return_value=0), patch(
            "game.dumb_questions.random.shuffle", side_effect=lambda seq: None
        ):
            state = DumbQuestionsGame.init_game(None, _players(4))

        guesser_id = state["guesser_id"]
        bot_answerer_id = next(pid for pid in state["turn_order"] if pid != guesser_id)
        DumbQuestionsGame.apply_action(state, guesser_id, {"type": "select_category", "category": "player"})
        state["answers"][bot_answerer_id] = "already answered"

        action = DumbQuestionsGame.bot_move(state, bot_answerer_id)
        self.assertIsNone(action)
