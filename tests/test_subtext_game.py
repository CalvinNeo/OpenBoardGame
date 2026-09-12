import re
import unittest
from pathlib import Path

import app
from jsonschema import Draft7Validator
from game.registry import get_game
from game.subtext import (
    MAX_POINTS_PER_STROKE,
    ROUND_COUNTS,
    SubtextGame,
    _load_word_cards,
)

ROOT = Path(__file__).resolve().parents[1]


def make_players(count=4, bots=False):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": bots,
        }
        for index in range(count)
    ]


def simple_drawing(offset=0.0):
    return [
        [[0.1 + offset, 0.1], [0.4 + offset, 0.5], [0.7 + offset, 0.2]],
        [[0.2, 0.8], [0.8, 0.8]],
    ]


class SubtextGameTests(unittest.TestCase):
    def setUp(self):
        self.state = SubtextGame.init_game({"word_column": 1, "seed": "test-seed"}, make_players())

    def submit_all_drawings(self, state=None):
        state = state or self.state
        for index, player_id in enumerate(state["turn_order"]):
            events, error = SubtextGame.apply_action(
                state,
                player_id,
                {"type": "submit_drawing", "drawing": simple_drawing(index * 0.01)},
            )
            self.assertIsNone(error)
            self.assertTrue(events)
        self.assertEqual(state["phase"], "guessing")

    def submit_votes(self, choices, state=None):
        state = state or self.state
        for player_id in state["turn_order"]:
            events, error = SubtextGame.apply_action(
                state,
                player_id,
                {"type": "submit_guess", "slot_id": choices[player_id]},
            )
            self.assertIsNone(error)
            self.assertTrue(events)

    def test_word_pack_and_round_counts(self):
        self.assertGreaterEqual(len(_load_word_cards()), 56)
        for player_count, expected_rounds in ROUND_COUNTS.items():
            state = SubtextGame.init_game(
                {"word_column": 5, "seed": player_count},
                make_players(player_count),
            )
            self.assertEqual(state["total_rounds"], expected_rounds)
            self.assertEqual(state["config"]["word_column"], 5)
            assignments = state["secret_assignments"]
            words = [entry["word"] for entry in assignments.values()]
            target = state["target_word"]
            self.assertEqual(words.count(target), 2)

    def test_registration_and_action_schemas(self):
        definition = get_game("subtext")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.name, "Subtext")
        self.assertEqual((definition.min_players, definition.max_players), (4, 8))
        self.assertEqual(definition.turn_mode, "simultaneous")
        action_validator = Draft7Validator(definition.action_schema)
        valid_actions = [
            {"type": "submit_drawing", "drawing": simple_drawing()},
            {"type": "submit_guess", "slot_id": "G"},
            {"type": "next_round"},
            {"type": "play_again"},
        ]
        for action in valid_actions:
            with self.subTest(action=action["type"]):
                self.assertEqual(list(action_validator.iter_errors(action)), [])
        self.assertTrue(list(action_validator.iter_errors({"type": "submit_guess", "slot_id": "H"})))
        config_validator = Draft7Validator(definition.config_schema)
        self.assertEqual(list(config_validator.iter_errors({"word_column": 5, "seed": "demo"})), [])
        self.assertTrue(list(config_validator.iter_errors({"word_column": 6})))

    def test_drawing_phase_keeps_other_secrets_private(self):
        viewer = self.state["turn_order"][0]
        other = self.state["turn_order"][1]
        view = SubtextGame.get_public_view(self.state, viewer)
        self.assertEqual(view["your_word"], self.state["secret_assignments"][viewer]["word"])
        for forbidden in (
            "partner_id",
            "target_word",
            "secret_assignments",
            "word_deck",
            "rng_seed",
            "slot_by_player",
        ):
            self.assertNotIn(forbidden, view)

        SubtextGame.apply_action(
            self.state,
            other,
            {"type": "submit_drawing", "drawing": simple_drawing()},
        )
        view = SubtextGame.get_public_view(self.state, viewer)
        self.assertNotIn("candidates", view)
        self.assertNotIn("dealer_drawing", view)
        self.assertNotIn("drawings", view)

    def test_guessing_hides_authors_partner_and_votes(self):
        self.submit_all_drawings()
        viewer = next(pid for pid in self.state["turn_order"] if pid != self.state["dealer_id"])
        view = SubtextGame.get_public_view(self.state, viewer)
        self.assertEqual(len(view["candidates"]), len(self.state["turn_order"]) - 1)
        self.assertEqual(sum(1 for card in view["candidates"] if card["is_yours"]), 1)
        for card in view["candidates"]:
            self.assertNotIn("player_id", card)
        self.assertNotIn("partner_id", view)
        self.assertNotIn("votes", view)

        first_slot = view["candidates"][0]["slot_id"]
        SubtextGame.apply_action(
            self.state,
            viewer,
            {"type": "submit_guess", "slot_id": first_slot},
        )
        other_view = SubtextGame.get_public_view(self.state, self.state["dealer_id"])
        self.assertNotIn("your_guess", other_view)
        self.assertNotIn("votes", other_view)

    def test_scoring_when_dealer_partner_and_outsider_are_correct(self):
        self.submit_all_drawings()
        dealer = self.state["dealer_id"]
        partner = self.state["partner_id"]
        outsiders = [pid for pid in self.state["turn_order"] if pid not in (dealer, partner)]
        partner_slot = self.state["slot_by_player"][partner]
        wrong_slot = next(slot for slot in self.state["slot_by_player"].values() if slot != partner_slot)
        choices = {pid: wrong_slot for pid in self.state["turn_order"]}
        choices[dealer] = partner_slot
        choices[partner] = partner_slot
        choices[outsiders[0]] = partner_slot
        self.submit_votes(choices)

        summary = self.state["last_round_summary"]
        self.assertEqual(summary["wrong_count"], 1)
        self.assertEqual(summary["round_points"][dealer], 1)
        self.assertEqual(summary["round_points"][partner], 1)
        self.assertEqual(summary["round_points"][outsiders[0]], 2)
        self.assertEqual(summary["round_points"][outsiders[1]], 0)

    def test_all_correct_gives_only_outsiders_one_point(self):
        self.submit_all_drawings()
        partner_slot = self.state["slot_by_player"][self.state["partner_id"]]
        self.submit_votes({pid: partner_slot for pid in self.state["turn_order"]})
        summary = self.state["last_round_summary"]
        self.assertEqual(summary["wrong_count"], 0)
        self.assertEqual(summary["round_points"][self.state["dealer_id"]], 0)
        self.assertEqual(summary["round_points"][self.state["partner_id"]], 0)
        outsiders = [
            pid
            for pid in self.state["turn_order"]
            if pid not in (self.state["dealer_id"], self.state["partner_id"])
        ]
        self.assertTrue(all(summary["round_points"][pid] == 1 for pid in outsiders))

    def test_all_wrong_scores_zero(self):
        self.submit_all_drawings()
        partner_slot = self.state["slot_by_player"][self.state["partner_id"]]
        wrong_slot = next(slot for slot in self.state["slot_by_player"].values() if slot != partner_slot)
        self.submit_votes({pid: wrong_slot for pid in self.state["turn_order"]})
        summary = self.state["last_round_summary"]
        self.assertEqual(summary["wrong_count"], len(self.state["turn_order"]))
        self.assertTrue(all(points == 0 for points in summary["round_points"].values()))

    def test_partner_miss_zeroes_both_shared_word_players(self):
        self.submit_all_drawings()
        dealer = self.state["dealer_id"]
        partner = self.state["partner_id"]
        outsider = next(pid for pid in self.state["turn_order"] if pid not in (dealer, partner))
        partner_slot = self.state["slot_by_player"][partner]
        wrong_slot = next(slot for slot in self.state["slot_by_player"].values() if slot != partner_slot)
        choices = {pid: wrong_slot for pid in self.state["turn_order"]}
        choices[dealer] = partner_slot
        choices[outsider] = partner_slot
        self.submit_votes(choices)
        points = self.state["last_round_summary"]["round_points"]
        self.assertEqual(points[dealer], 0)
        self.assertEqual(points[partner], 0)
        self.assertGreater(points[outsider], 0)

    def test_round_result_reveals_details_and_waits_for_everyone(self):
        self.submit_all_drawings()
        partner_slot = self.state["slot_by_player"][self.state["partner_id"]]
        self.submit_votes({pid: partner_slot for pid in self.state["turn_order"]})
        self.assertEqual(self.state["phase"], "round_result")
        view = SubtextGame.get_public_view(self.state, self.state["turn_order"][0])
        self.assertEqual(view["last_round_summary"]["partner_id"], self.state["partner_id"])
        self.assertIn("player_id", view["last_round_summary"]["slots"][0])

        old_dealer = self.state["dealer_id"]
        for player_id in self.state["turn_order"][:-1]:
            _, error = SubtextGame.apply_action(self.state, player_id, {"type": "next_round"})
            self.assertIsNone(error)
            self.assertEqual(self.state["phase"], "round_result")
        _, error = SubtextGame.apply_action(
            self.state,
            self.state["turn_order"][-1],
            {"type": "next_round"},
        )
        self.assertIsNone(error)
        self.assertEqual(self.state["phase"], "drawing")
        self.assertEqual(self.state["round"], 2)
        expected_index = (self.state["turn_order"].index(old_dealer) + 1) % len(self.state["turn_order"])
        self.assertEqual(self.state["dealer_id"], self.state["turn_order"][expected_index])

    def test_rejects_invalid_and_duplicate_drawing(self):
        player_id = self.state["turn_order"][0]
        _, error = SubtextGame.apply_action(
            self.state,
            player_id,
            {"type": "submit_drawing", "drawing": [[[1.1, 0.2]]]},
        )
        self.assertIn("between 0 and 1", error)
        _, error = SubtextGame.apply_action(
            self.state,
            player_id,
            {"type": "submit_drawing", "drawing": [[]]},
        )
        self.assertIn("at least one point", error)
        oversized = [[[0.1, 0.1]] * (MAX_POINTS_PER_STROKE + 1)]
        _, error = SubtextGame.apply_action(
            self.state,
            player_id,
            {"type": "submit_drawing", "drawing": oversized},
        )
        self.assertIn("at most", error)

        _, error = SubtextGame.apply_action(
            self.state,
            player_id,
            {"type": "submit_drawing", "drawing": simple_drawing()},
        )
        self.assertIsNone(error)
        _, error = SubtextGame.apply_action(
            self.state,
            player_id,
            {"type": "submit_drawing", "drawing": simple_drawing()},
        )
        self.assertEqual(error, "invalid action")

    def test_last_round_game_over_ties_and_play_again(self):
        self.state["round"] = self.state["total_rounds"]
        self.submit_all_drawings()
        partner_slot = self.state["slot_by_player"][self.state["partner_id"]]
        self.submit_votes({pid: partner_slot for pid in self.state["turn_order"]})
        self.assertEqual(self.state["phase"], "game_over")
        self.assertTrue(self.state["game_over"])
        self.assertTrue(self.state["winner_ids"])
        previous_index = self.state["game_index"]

        _, error = SubtextGame.apply_action(
            self.state,
            self.state["turn_order"][0],
            {"type": "play_again"},
        )
        self.assertIsNone(error)
        self.assertEqual(self.state["game_index"], previous_index + 1)
        self.assertEqual(self.state["phase"], "drawing")
        self.assertTrue(all(player["score"] == 0 for player in self.state["players"].values()))
        self.assertEqual(self.state["round_history"], [])

    def test_seed_reproduces_dealer_partner_and_word_assignments(self):
        repeated = SubtextGame.init_game(
            {"word_column": 1, "seed": "test-seed"},
            make_players(),
        )
        self.assertEqual(self.state["dealer_id"], repeated["dealer_id"])
        self.assertEqual(self.state["partner_id"], repeated["partner_id"])
        self.assertEqual(self.state["secret_assignments"], repeated["secret_assignments"])
        self.assertEqual(self.state["word_deck"], repeated["word_deck"])

    def test_eight_player_game_consumes_56_unique_cards_and_finishes(self):
        state = SubtextGame.init_game({"seed": "full-game"}, make_players(8))
        dealers = []
        for round_number in range(1, state["total_rounds"] + 1):
            dealers.append(state["dealer_id"])
            for player_id in state["turn_order"]:
                _, error = SubtextGame.apply_action(
                    state,
                    player_id,
                    {"type": "submit_drawing", "drawing": simple_drawing()},
                )
                self.assertIsNone(error)
            partner_slot = state["slot_by_player"][state["partner_id"]]
            for player_id in state["turn_order"]:
                _, error = SubtextGame.apply_action(
                    state,
                    player_id,
                    {"type": "submit_guess", "slot_id": partner_slot},
                )
                self.assertIsNone(error)
            if round_number < state["total_rounds"]:
                for player_id in state["turn_order"]:
                    _, error = SubtextGame.apply_action(state, player_id, {"type": "next_round"})
                    self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(len(state["used_card_ids"]), 56)
        self.assertEqual(len(set(state["used_card_ids"])), 56)
        self.assertEqual(set(dealers), set(state["turn_order"]))

    def test_memories_include_only_completed_rounds(self):
        assigned_words = {entry["word"] for entry in self.state["secret_assignments"].values()}
        html = SubtextGame.download_memories(self.state, "ROOM1")
        self.assertIn("No completed rounds yet", html)
        self.assertIn("Round in progress", html)
        for word in assigned_words:
            self.assertNotIn(word, html)

        self.submit_all_drawings()
        target = self.state["target_word"]
        partner_slot = self.state["slot_by_player"][self.state["partner_id"]]
        self.submit_votes({pid: partner_slot for pid in self.state["turn_order"]})
        html = SubtextGame.download_memories(self.state, "ROOM1")
        self.assertIn(target, html)
        self.assertIn("Partner Slot", html)
        self.assertIn("data:image/svg+xml;base64", html)

        for player_id in self.state["turn_order"]:
            SubtextGame.apply_action(self.state, player_id, {"type": "next_round"})
        new_secret_words = {
            entry["word"] for entry in self.state["secret_assignments"].values()
        }
        html = SubtextGame.download_memories(self.state, "ROOM1")
        for word in new_secret_words:
            self.assertNotIn(word, html)

    def test_bot_moves_use_legal_public_flow(self):
        state = SubtextGame.init_game({"seed": "bots"}, make_players(bots=True))
        guard = 0
        while state["phase"] in ("drawing", "guessing", "round_result") and guard < 20:
            guard += 1
            moved = False
            for player_id in state["turn_order"]:
                action = SubtextGame.bot_move(state, player_id)
                if not action:
                    continue
                action.pop("delay_ms", None)
                _, error = SubtextGame.apply_action(state, player_id, action)
                self.assertIsNone(error)
                moved = True
            if state["round"] > 1:
                break
            self.assertTrue(moved)
        self.assertEqual(state["round"], 2)

    def test_bot_event_action_redacts_private_payload(self):
        drawing_action = {"type": "submit_drawing", "drawing": simple_drawing()}
        guess_action = {"type": "submit_guess", "slot_id": "A"}
        self.assertEqual(app._public_bot_action("subtext", drawing_action), {"type": "submit_drawing"})
        self.assertEqual(app._public_bot_action("subtext", guess_action), {"type": "submit_guess"})
        self.assertIs(app._public_bot_action("cabo", guess_action), guess_action)

    def test_frontend_assets_are_wired_before_dispatch(self):
        index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script_match = re.search(r'<script src="(/static/games/subtext\.js\?v=[^"]+)"', index)
        app_match = re.search(r'<script src="(/static/app\.js\?v=[^"]+)"', index)
        self.assertIsNotNone(script_match)
        self.assertIsNotNone(app_match)
        self.assertLess(index.index(script_match.group(0)), index.index(app_match.group(0)))
        self.assertIn('id="subtextPanel"', index)
        self.assertIn('id="subtextWordColumnSelect"', index)

        app_script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        shared_script = (ROOT / "static" / "games" / "shared.js").read_text(encoding="utf-8")
        game_script = (ROOT / "static" / "games" / "subtext.js").read_text(encoding="utf-8")
        self.assertIn('gameType === "subtext"', app_script)
        self.assertIn("renderSubtextGameState(data)", app_script)
        self.assertIn('currentGameType === "subtext"', shared_script)
        self.assertIn("window.renderSubtextGameState = renderGameState", game_script)
        self.assertIn("window.showSubtextHeaderActions = showHeaderActions", game_script)


if __name__ == "__main__":
    unittest.main()
