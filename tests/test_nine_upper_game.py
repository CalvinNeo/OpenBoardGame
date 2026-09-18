import re
import unittest
from pathlib import Path

from jsonschema import Draft7Validator

import app
from game.nine_upper import NineUpperGame, _load_terms
from game.registry import get_game


ROOT = Path(__file__).resolve().parents[1]


def make_players(count: int = 4, bots: bool = False) -> list[dict]:
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": bots,
        }
        for index in range(count)
    ]


class NineUpperGameTests(unittest.TestCase):
    def setUp(self) -> None:
        self.state = NineUpperGame.init_game({"seed": "nine-upper-tests"}, make_players())

    def choose_difficulty(self, difficulty: int = 2) -> None:
        events, error = NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "select_difficulty", "difficulty": difficulty},
        )
        self.assertIsNone(error)
        self.assertTrue(events)

    def submit_statements(self) -> None:
        for player_id in self.state["turn_order"]:
            if player_id == self.state["thinker_id"]:
                continue
            text = self.state["definition"] if player_id == self.state["honest_id"] else f"Bluff from {player_id}"
            events, error = NineUpperGame.apply_action(
                self.state,
                player_id,
                {"type": "submit_statement", "statement": text},
            )
            self.assertIsNone(error)
            self.assertTrue(events)

    def test_term_pack_has_balanced_original_content(self) -> None:
        terms = _load_terms()
        self.assertEqual(len(terms), 60)
        for difficulty in (1, 2, 3):
            self.assertGreaterEqual(
                sum(1 for term in terms if term["difficulty"] == difficulty),
                18,
            )
        self.assertEqual(len({term["id"] for term in terms}), len(terms))
        self.assertTrue(all(term["definition"] for term in terms))

    def test_registration_and_schemas(self) -> None:
        definition = get_game("nine_upper")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.name_zh, "瞎掰王")
        self.assertEqual((definition.min_players, definition.max_players), (3, 9))
        self.assertEqual(definition.turn_mode, "simultaneous")

        action_validator = Draft7Validator(definition.action_schema)
        valid_actions = [
            {"type": "select_difficulty", "difficulty": 3},
            {"type": "submit_statement", "statement": "一本正经的解释"},
            {"type": "skip_term"},
            {"type": "choose_honest", "player_id": "p2"},
            {"type": "next_round"},
            {"type": "play_again"},
        ]
        for action in valid_actions:
            with self.subTest(action=action["type"]):
                self.assertEqual(list(action_validator.iter_errors(action)), [])
        self.assertTrue(
            list(action_validator.iter_errors({"type": "select_difficulty", "difficulty": 4}))
        )

        config_validator = Draft7Validator(definition.config_schema)
        self.assertEqual(
            list(config_validator.iter_errors({"rounds_per_thinker": 2, "seed": "demo"})),
            [],
        )
        self.assertTrue(list(config_validator.iter_errors({"rounds_per_thinker": 3})))

    def test_private_role_and_definition_are_isolated(self) -> None:
        thinker_id = self.state["thinker_id"]
        honest_id = self.state["honest_id"]
        bluffer_id = next(
            player_id
            for player_id in self.state["turn_order"]
            if player_id not in (thinker_id, honest_id)
        )
        self.choose_difficulty(1)

        thinker_view = NineUpperGame.get_public_view(self.state, thinker_id)
        honest_view = NineUpperGame.get_public_view(self.state, honest_id)
        bluffer_view = NineUpperGame.get_public_view(self.state, bluffer_id)

        self.assertEqual(thinker_view["your_role"], "thinker")
        self.assertEqual(honest_view["your_role"], "honest")
        self.assertEqual(bluffer_view["your_role"], "bluffer")
        self.assertIsNone(thinker_view["your_definition"])
        self.assertEqual(honest_view["your_definition"], self.state["definition"])
        self.assertIsNone(bluffer_view["your_definition"])
        self.assertNotIn("honest_id", thinker_view)
        self.assertEqual(thinker_view["category_options"], [self.state["category"]])

    def test_statements_stay_hidden_until_everyone_submits(self) -> None:
        self.choose_difficulty(2)
        answerers = [
            player_id for player_id in self.state["turn_order"] if player_id != self.state["thinker_id"]
        ]
        NineUpperGame.apply_action(
            self.state,
            answerers[0],
            {"type": "submit_statement", "statement": "first secret statement"},
        )
        thinker_view = NineUpperGame.get_public_view(self.state, self.state["thinker_id"])
        other_view = NineUpperGame.get_public_view(self.state, answerers[1])
        self.assertEqual(thinker_view["statements"], [])
        self.assertEqual(other_view["statements"], [])

        for player_id in answerers[1:]:
            NineUpperGame.apply_action(
                self.state,
                player_id,
                {"type": "submit_statement", "statement": f"statement {player_id}"},
            )
        self.assertEqual(self.state["phase"], "guessing")
        thinker_view = NineUpperGame.get_public_view(self.state, self.state["thinker_id"])
        self.assertEqual(len(thinker_view["statements"]), len(answerers))
        self.assertTrue(all("player_id" in item and "text" in item for item in thinker_view["statements"]))
        for player_id in self.state["turn_order"]:
            self.assertNotIn("skip_term", NineUpperGame.get_legal_actions(self.state, player_id))
        _, error = NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "skip_term"},
        )
        self.assertEqual(error, "invalid action")

    def test_any_player_can_skip_known_term_before_statements_are_revealed(self) -> None:
        self.choose_difficulty(2)
        original_term_id = self.state["term_id"]
        original_thinker_id = self.state["thinker_id"]
        original_honest_id = self.state["honest_id"]
        answerer_id = next(
            player_id
            for player_id in self.state["turn_order"]
            if player_id != original_thinker_id
        )
        _, error = NineUpperGame.apply_action(
            self.state,
            answerer_id,
            {"type": "submit_statement", "statement": "This statement should be cleared"},
        )
        self.assertIsNone(error)
        for player_id in self.state["turn_order"]:
            self.assertIn("skip_term", NineUpperGame.get_legal_actions(self.state, player_id))

        events, error = NineUpperGame.apply_action(
            self.state,
            answerer_id,
            {"type": "skip_term"},
        )

        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "nine_upper:term_skipped")
        self.assertEqual(self.state["phase"], "statements")
        self.assertEqual(self.state["difficulty"], 2)
        self.assertEqual(self.state["thinker_id"], original_thinker_id)
        self.assertEqual(self.state["honest_id"], original_honest_id)
        self.assertNotEqual(self.state["term_id"], original_term_id)
        self.assertIn(original_term_id, self.state["skipped_term_ids"])
        self.assertEqual(self.state["statements"], {})
        view = NineUpperGame.get_public_view(self.state, answerer_id)
        self.assertEqual(view["skipped_term_count"], 1)
        self.assertIsNone(view["your_statement"])

    def test_skipped_term_stays_retired_after_play_again_and_deck_refill(self) -> None:
        self.choose_difficulty(3)
        skipped_term_id = self.state["term_id"]
        _, error = NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "skip_term"},
        )
        self.assertIsNone(error)

        self.state["phase"] = "game_over"
        self.state["game_over"] = True
        _, error = NineUpperGame.apply_action(
            self.state,
            self.state["turn_order"][0],
            {"type": "play_again"},
        )
        self.assertIsNone(error)
        self.assertIn(skipped_term_id, self.state["skipped_term_ids"])
        self.assertTrue(
            all(
                skipped_term_id not in deck
                for deck in self.state["term_decks"].values()
            )
        )

        self.state["term_decks"]["3"] = [skipped_term_id]
        _, error = NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "select_difficulty", "difficulty": 3},
        )
        self.assertIsNone(error)
        self.assertNotEqual(self.state["term_id"], skipped_term_id)

    def test_correct_choice_scores_thinker_and_honest(self) -> None:
        self.choose_difficulty(3)
        self.submit_statements()
        thinker_id = self.state["thinker_id"]
        honest_id = self.state["honest_id"]
        events, error = NineUpperGame.apply_action(
            self.state,
            thinker_id,
            {"type": "choose_honest", "player_id": honest_id},
        )
        self.assertIsNone(error)
        self.assertTrue(events)
        summary = self.state["last_round_summary"]
        self.assertTrue(summary["correct"])
        self.assertEqual(summary["round_points"][thinker_id], 3)
        self.assertEqual(summary["round_points"][honest_id], 3)
        self.assertEqual(self.state["phase"], "round_result")
        self.assertEqual(summary["definition"], self.state["definition"])

    def test_wrong_choice_rewards_only_selected_bluffer(self) -> None:
        self.choose_difficulty(2)
        self.submit_statements()
        bluffer_id = next(
            player_id
            for player_id in self.state["turn_order"]
            if player_id not in (self.state["thinker_id"], self.state["honest_id"])
        )
        NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "choose_honest", "player_id": bluffer_id},
        )
        summary = self.state["last_round_summary"]
        self.assertFalse(summary["correct"])
        self.assertEqual(summary["round_points"][bluffer_id], 2)
        self.assertEqual(
            sum(summary["round_points"].values()),
            2,
        )

    def test_everyone_must_confirm_before_next_round(self) -> None:
        self.choose_difficulty(1)
        self.submit_statements()
        NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "choose_honest", "player_id": self.state["honest_id"]},
        )
        first_thinker = self.state["thinker_id"]
        for player_id in self.state["turn_order"][:-1]:
            _, error = NineUpperGame.apply_action(self.state, player_id, {"type": "next_round"})
            self.assertIsNone(error)
            self.assertEqual(self.state["phase"], "round_result")
        _, error = NineUpperGame.apply_action(
            self.state,
            self.state["turn_order"][-1],
            {"type": "next_round"},
        )
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "difficulty_selection")
        self.assertEqual(self.state["round"], 2)
        old_index = self.state["turn_order"].index(first_thinker)
        self.assertEqual(
            self.state["thinker_id"],
            self.state["turn_order"][(old_index + 1) % len(self.state["turn_order"])],
        )

    def test_last_round_game_over_and_play_again(self) -> None:
        self.state["round"] = self.state["total_rounds"]
        self.choose_difficulty(1)
        self.submit_statements()
        NineUpperGame.apply_action(
            self.state,
            self.state["thinker_id"],
            {"type": "choose_honest", "player_id": self.state["honest_id"]},
        )
        self.assertEqual(self.state["phase"], "game_over")
        self.assertTrue(self.state["winner_ids"])
        previous_index = self.state["game_index"]
        _, error = NineUpperGame.apply_action(
            self.state,
            self.state["turn_order"][0],
            {"type": "play_again"},
        )
        self.assertIsNone(error)
        self.assertEqual(self.state["game_index"], previous_index + 1)
        self.assertEqual(self.state["phase"], "difficulty_selection")
        self.assertTrue(all(player["score"] == 0 for player in self.state["players"].values()))

    def test_all_bot_flow_reaches_second_round(self) -> None:
        state = NineUpperGame.init_game({"seed": "bot-flow"}, make_players(bots=True))
        guard = 0
        while state["round"] == 1 and guard < 30:
            guard += 1
            moved = False
            for player_id in state["turn_order"]:
                action = NineUpperGame.bot_move(state, player_id)
                if not action:
                    continue
                action.pop("delay_ms", None)
                _, error = NineUpperGame.apply_action(state, player_id, action)
                self.assertIsNone(error)
                moved = True
            self.assertTrue(moved)
        self.assertEqual(state["round"], 2)

    def test_long_nine_player_game_uses_unique_terms(self) -> None:
        state = NineUpperGame.init_game(
            {"seed": "long-game", "rounds_per_thinker": 2},
            make_players(9),
        )
        thinkers = []
        for round_number in range(1, state["total_rounds"] + 1):
            thinkers.append(state["thinker_id"])
            _, error = NineUpperGame.apply_action(
                state,
                state["thinker_id"],
                {"type": "select_difficulty", "difficulty": 3},
            )
            self.assertIsNone(error)
            self.assertEqual(state["category_options"], [])
            for player_id in state["turn_order"]:
                if player_id == state["thinker_id"]:
                    continue
                _, error = NineUpperGame.apply_action(
                    state,
                    player_id,
                    {"type": "submit_statement", "statement": f"story {round_number} {player_id}"},
                )
                self.assertIsNone(error)
            _, error = NineUpperGame.apply_action(
                state,
                state["thinker_id"],
                {"type": "choose_honest", "player_id": state["honest_id"]},
            )
            self.assertIsNone(error)
            if round_number < state["total_rounds"]:
                for player_id in state["turn_order"]:
                    _, error = NineUpperGame.apply_action(state, player_id, {"type": "next_round"})
                    self.assertIsNone(error)

        self.assertTrue(state["game_over"])
        self.assertEqual(len(state["used_term_ids"]), 18)
        self.assertEqual(len(set(state["used_term_ids"])), 18)
        self.assertTrue(all(thinkers.count(player_id) == 2 for player_id in state["turn_order"]))

    def test_bot_event_action_redacts_private_payload(self) -> None:
        action = {"type": "submit_statement", "statement": "secret"}
        self.assertEqual(
            app._public_bot_action("nine_upper", action),
            {"type": "submit_statement"},
        )

    def test_frontend_assets_are_wired_before_dispatch(self) -> None:
        index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script_match = re.search(r'<script src="(/static/games/nine_upper\.js\?v=[^"]+)"', index)
        app_match = re.search(r'<script src="(/static/app\.js\?v=[^"]+)"', index)
        self.assertIsNotNone(script_match)
        self.assertIsNotNone(app_match)
        self.assertLess(index.index(script_match.group(0)), index.index(app_match.group(0)))
        self.assertIn('id="nineUpperPanel"', index)

        app_script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        shared_script = (ROOT / "static" / "games" / "shared.js").read_text(encoding="utf-8")
        game_script = (ROOT / "static" / "games" / "nine_upper.js").read_text(encoding="utf-8")
        self.assertIn('gameType === "nine_upper"', app_script)
        self.assertIn("renderNineUpperGameState(data)", app_script)
        self.assertIn("clearNineUpperState", shared_script)
        self.assertIn("function renderNineUpperGameState", game_script)
        self.assertIn("function showNineUpperHeaderActions", game_script)


if __name__ == "__main__":
    unittest.main()
