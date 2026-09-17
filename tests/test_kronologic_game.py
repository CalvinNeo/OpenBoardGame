import copy
import json
import unittest
from pathlib import Path

from game.kronologic import (
    CASES,
    CATALOG,
    CHARACTER_IDS,
    LOCATION_IDS,
    MAX_PRIVATE_CLUES,
    MAX_PUBLIC_CLUES,
    KronologicGame,
    _case_solution,
    _meeting_solutions,
    _query_response,
)


ROOT = Path(__file__).resolve().parent.parent


def _players(count, bots=False):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": bool(bots),
        }
        for index in range(count)
    ]


def _state(count=2, case_id="sealed-score-01", bots=False):
    return KronologicGame.init_game(
        {
            "case_source": "preset",
            "case_id": case_id,
            "difficulty": "any",
            "seed": "test-seed",
        },
        _players(count, bots=bots),
    )


def _force_active(state, player_id="p1"):
    state["active_player_id"] = player_id


def _first_query(case, bonus):
    for time in range(1, 7):
        for location_id in LOCATION_IDS:
            response = _query_response(case, "time", location_id, time)
            if bool(response["bonus_turn"]) is bool(bonus):
                return {
                    "type": "ask",
                    "query_type": "time",
                    "location_id": location_id,
                    "time": time,
                }
    raise AssertionError("query not found")


class KronologicCatalogTests(unittest.TestCase):
    def test_catalog_is_original_and_has_five_unique_cases(self):
        self.assertEqual(CATALOG["catalog_id"], "original-compatible-v1")
        self.assertEqual(CATALOG["catalog_status"], "original-compatible")
        self.assertFalse(CATALOG["commercial_scenarios_included"])
        self.assertEqual(len(CASES), 5)
        self.assertEqual(len({case["case_id"] for case in CASES}), 5)

    def test_paths_move_along_the_original_graph(self):
        edges = {tuple(sorted(edge)) for edge in CATALOG["edges"]}
        for case in CASES:
            self.assertEqual(set(case["paths"]), set(CHARACTER_IDS))
            for path in case["paths"].values():
                self.assertEqual(len(path), 6)
                self.assertTrue(all(location_id in LOCATION_IDS for location_id in path))
                for left, right in zip(path, path[1:]):
                    self.assertNotEqual(left, right)
                    self.assertIn(tuple(sorted((left, right))), edges)

    def test_every_case_has_exactly_one_objective_solution(self):
        for case in CASES:
            with self.subTest(case=case["case_id"]):
                solutions = _meeting_solutions(case, CHARACTER_IDS)
                self.assertEqual(len(solutions), 1)
                self.assertEqual(_case_solution(case), solutions[0])

    def test_query_responses_are_stable_and_truthful(self):
        for case in CASES:
            for time in range(1, 7):
                for location_id in LOCATION_IDS:
                    response_a = _query_response(case, "time", location_id, time)
                    response_b = _query_response(case, "time", location_id, time)
                    occupants = [
                        character_id
                        for character_id in CHARACTER_IDS
                        if case["paths"][character_id][time - 1] == location_id
                    ]
                    self.assertEqual(response_a, response_b)
                    self.assertEqual(response_a["count"], len(occupants))
                    if response_a["private_character_id"] is not None:
                        self.assertIn(response_a["private_character_id"], occupants)

            for character_id in CHARACTER_IDS:
                for location_id in LOCATION_IDS:
                    response = _query_response(case, "character", location_id, character_id)
                    times = [
                        index + 1
                        for index, value in enumerate(case["paths"][character_id])
                        if value == location_id
                    ]
                    self.assertEqual(response["count"], len(times))
                    if response["private_time"] is not None:
                        self.assertIn(response["private_time"], times)


class KronologicFrontendIntegrationTests(unittest.TestCase):
    def test_frontend_assets_are_loaded_before_the_main_dispatcher(self):
        index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        game_script = index.index('/static/games/kronologic.js?v=')
        app_script = index.index('/static/app.js?v=')
        self.assertLess(game_script, app_script)
        for element_id in (
            "kronologicPanel",
            "kronologicConfigBox",
            "kronologicHeaderActions",
            "kronologicHelpModal",
            "kronologicExplainModal",
            "kronologicAccusationModal",
        ):
            self.assertEqual(index.count(f'id="{element_id}"'), 1)

    def test_room_render_and_reset_hooks_are_wired(self):
        shared = (ROOT / "static" / "games" / "shared.js").read_text(encoding="utf-8")
        room = (ROOT / "static" / "room.js").read_text(encoding="utf-8")
        app = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn('currentGameType === "kronologic"', shared)
        self.assertIn("updateKronologicConfigRow();", shared)
        self.assertIn("clearKronologicState();", shared)
        self.assertIn("resetKronologicRoomConfig();", room)
        self.assertIn('gameType === "kronologic"', app)
        self.assertIn("renderKronologicGameState(data);", app)

    def test_bot_action_payload_is_redacted(self):
        from app import _public_bot_action

        private_action = {
            "type": "start_accusation",
            "character_id": "courier",
            "location_id": "backstage",
            "time": 3,
        }
        self.assertEqual(
            _public_bot_action("kronologic", private_action),
            {"type": "start_accusation"},
        )


class KronologicGameTests(unittest.TestCase):
    def test_non_current_player_cannot_ask(self):
        state = _state()
        _force_active(state, "p1")
        before = copy.deepcopy(state)
        _, error = KronologicGame.apply_action(state, "p2", _first_query(state["case"], bonus=False))
        self.assertEqual(error, "not your turn")
        self.assertEqual(state, before)

    def test_question_waits_for_every_human_before_advancing(self):
        state = _state()
        _force_active(state, "p1")
        _, error = KronologicGame.apply_action(state, "p1", _first_query(state["case"], bonus=False))
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "clue_review")
        self.assertEqual(state["active_player_id"], "p1")

        _, error = KronologicGame.apply_action(state, "p1", {"type": "ready_next_turn"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "clue_review")

        _, error = KronologicGame.apply_action(state, "p2", {"type": "ready_next_turn"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "investigation")
        self.assertEqual(state["active_player_id"], "p2")

    def test_zero_or_six_query_grants_a_bonus_turn(self):
        state = _state()
        _force_active(state, "p1")
        action = _first_query(state["case"], bonus=True)
        _, error = KronologicGame.apply_action(state, "p1", action)
        self.assertIsNone(error)
        self.assertTrue(state["bonus_turn"])
        self.assertEqual(state["pending_next_player_id"], "p1")
        KronologicGame.apply_action(state, "p1", {"type": "ready_next_turn"})
        KronologicGame.apply_action(state, "p2", {"type": "ready_next_turn"})
        self.assertEqual(state["phase"], "investigation")
        self.assertEqual(state["active_player_id"], "p1")

    def test_private_clue_and_notes_are_only_in_the_owners_view(self):
        state = _state()
        _force_active(state, "p1")
        events, error = KronologicGame.apply_action(state, "p1", _first_query(state["case"], bonus=False))
        self.assertIsNone(error)
        view_one = KronologicGame.get_public_view(state, "p1")
        view_two = KronologicGame.get_public_view(state, "p2")
        self.assertEqual(len(view_one["your_private_clues"]), 1)
        self.assertEqual(view_two["your_private_clues"], [])
        self.assertNotIn("private_character_id", json.dumps(events))
        self.assertNotIn("private_time", json.dumps(events))
        self.assertNotIn("paths", view_one["case"])
        self.assertIsNone(view_one["solution"])

        _, error = KronologicGame.apply_action(
            state,
            "p1",
            {
                "type": "set_note_mark",
                "time": 2,
                "location_id": "archive",
                "character_id": "singer",
                "mark": "possible",
            },
        )
        self.assertIsNone(error)
        view_one = KronologicGame.get_public_view(state, "p1")
        view_two = KronologicGame.get_public_view(state, "p2")
        self.assertEqual(view_one["your_notes"]["marks"]["2|archive|singer"], "possible")
        self.assertNotIn("2|archive|singer", view_two["your_notes"]["marks"])

    def test_wrong_initiator_is_eliminated_and_decliner_continues(self):
        state = _state()
        _force_active(state, "p1")
        solution = _case_solution(state["case"])
        wrong = dict(solution)
        wrong["time"] = 2 if solution["time"] != 2 else 3
        _, error = KronologicGame.apply_action(state, "p1", {"type": "start_accusation", **wrong})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "accusation_collect")
        self.assertIsNone(state["players"]["p1"]["last_accusation_correct"])

        _, error = KronologicGame.apply_action(state, "p2", {"type": "decline_accusation"})
        self.assertIsNone(error)
        self.assertEqual(state["players"]["p1"]["status"], "eliminated")
        self.assertFalse(state["game_over"])
        self.assertEqual(state["phase"], "accusation_review")
        KronologicGame.apply_action(state, "p2", {"type": "ready_next_turn"})
        self.assertEqual(state["phase"], "investigation")
        self.assertEqual(state["active_player_id"], "p2")

    def test_simultaneous_correct_answers_share_the_win(self):
        state = _state()
        _force_active(state, "p1")
        solution = _case_solution(state["case"])
        KronologicGame.apply_action(state, "p1", {"type": "start_accusation", **solution})
        self.assertFalse(state["game_over"])
        KronologicGame.apply_action(state, "p2", {"type": "join_accusation", **solution})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner_ids"], ["p1", "p2"])
        view = KronologicGame.get_public_view(state, "p1")
        self.assertEqual(view["solution"]["answer"], solution)
        self.assertEqual(set(view["solution"]["paths"]), set(CHARACTER_IDS))

    def test_all_wrong_answers_lose_the_case(self):
        state = _state()
        _force_active(state, "p1")
        solution = _case_solution(state["case"])
        wrong_one = dict(solution)
        wrong_one["time"] = 2 if solution["time"] != 2 else 3
        wrong_two = dict(solution)
        wrong_two["location_id"] = next(value for value in LOCATION_IDS if value != solution["location_id"])
        KronologicGame.apply_action(state, "p1", {"type": "start_accusation", **wrong_one})
        KronologicGame.apply_action(state, "p2", {"type": "join_accusation", **wrong_two})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner_ids"], [])
        self.assertTrue(all(data["status"] == "eliminated" for data in state["players"].values()))

    def test_solo_answer_resolves_immediately_and_receives_rating(self):
        state = _state(count=1)
        solution = _case_solution(state["case"])
        _, error = KronologicGame.apply_action(state, "p1", {"type": "start_accusation", **solution})
        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner_ids"], ["p1"])
        self.assertEqual(state["solo_rating"], "gold")

    def test_answer_contents_are_hidden_during_collection(self):
        state = _state()
        _force_active(state, "p1")
        solution = _case_solution(state["case"])
        KronologicGame.apply_action(state, "p1", {"type": "start_accusation", **solution})
        own_view = KronologicGame.get_public_view(state, "p1")
        other_view = KronologicGame.get_public_view(state, "p2")
        self.assertEqual(own_view["your_accusation_response"], solution)
        self.assertIsNone(other_view["your_accusation_response"])
        self.assertNotIn("answer", other_view["accusation"])

    def test_bot_uses_visible_information_and_can_finish_a_solo_case(self):
        state = _state(count=1, bots=True)
        first_action = KronologicGame.bot_move(state, "p1")
        altered = copy.deepcopy(state)
        altered["case"]["paths"]["courier"][5] = "grand_hall"
        self.assertEqual(first_action, KronologicGame.bot_move(altered, "p1"))

        for _ in range(100):
            action = KronologicGame.bot_move(state, "p1")
            self.assertIsNotNone(action)
            action = dict(action)
            action.pop("delay_ms", None)
            _, error = KronologicGame.apply_action(state, "p1", action)
            self.assertIsNone(error)
            if state["game_over"]:
                break
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner_ids"], ["p1"])

    def test_serialize_round_trip_and_tamper_rejection(self):
        state = _state()
        restored = KronologicGame.deserialize(KronologicGame.serialize(state))
        self.assertEqual(restored, state)

        tampered = KronologicGame.serialize(state)
        tampered["case"]["paths"]["archivist"][1] = "grand_hall"
        with self.assertRaises(ValueError):
            KronologicGame.deserialize(tampered)

    def test_history_limits_are_enforced(self):
        state = _state(count=1, bots=True)
        _force_active(state, "p1")
        action = _first_query(state["case"], bonus=False)
        for _ in range(MAX_PUBLIC_CLUES + 8):
            state["phase"] = "investigation"
            state["active_player_id"] = "p1"
            _, error = KronologicGame.apply_action(state, "p1", action)
            self.assertIsNone(error)
        self.assertEqual(len(state["public_clues"]), MAX_PUBLIC_CLUES)
        self.assertEqual(len(state["players"]["p1"]["private_clues"]), MAX_PRIVATE_CLUES)

    def test_play_again_resets_private_state_after_everyone_is_ready(self):
        state = _state()
        solution = _case_solution(state["case"])
        _force_active(state, "p1")
        KronologicGame.apply_action(state, "p1", {"type": "start_accusation", **solution})
        KronologicGame.apply_action(state, "p2", {"type": "join_accusation", **solution})
        self.assertTrue(state["game_over"])
        KronologicGame.apply_action(state, "p1", {"type": "play_again"})
        self.assertTrue(state["game_over"])
        KronologicGame.apply_action(state, "p2", {"type": "play_again"})
        self.assertFalse(state["game_over"])
        self.assertEqual(state["phase"], "investigation")
        self.assertTrue(all(not data["private_clues"] for data in state["players"].values()))


if __name__ == "__main__":
    unittest.main()
