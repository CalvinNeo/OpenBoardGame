import copy
import unittest

from fastapi import HTTPException

from game.bomb_busters import BombBustersGame
from game.bomb_busters_campaign import CHALLENGES
from game.bomb_busters_help import MISSION_HELP, get_mission_help
from game.bomb_busters_missions import AUDIO_MISSIONS, CONSTRAINTS, MISSION_COUNT, get_mission
from tests.test_bomb_busters_game import make_players


class BombBustersMissionHelpTests(unittest.TestCase):
    def test_every_mission_has_bilingual_differences_and_examples(self):
        self.assertEqual(set(MISSION_HELP), set(range(1, MISSION_COUNT + 1)))
        for player_count in range(2, 6):
            for number in range(1, MISSION_COUNT + 1):
                with self.subTest(players=player_count, mission=number):
                    detail = get_mission_help(number, player_count)
                    self.assertEqual(detail["id"], number)
                    self.assertEqual(detail["player_count"], player_count)
                    self.assertEqual(detail["audio_companion"], number in AUDIO_MISSIONS)
                    self.assertEqual([section["id"] for section in detail["sections"]],
                                     ["setup", "difference", "play", "warning", "example"])
                    for field in [detail["title"], *[section["text"] for section in detail["sections"]]]:
                        self.assertEqual(set(field), {"zh", "en"})
                        self.assertRegex(field["zh"], r"[\u4e00-\u9fff]")
                        self.assertTrue(field["en"].strip())
                        self.assertNotIn("；", field["zh"])
                        self.assertNotIn(";", field["en"])

    def test_setup_counts_follow_the_selected_player_count(self):
        for player_count in range(2, 6):
            for number in range(1, MISSION_COUNT + 1):
                with self.subTest(players=player_count, mission=number):
                    detail = get_mission_help(number, player_count)
                    supported = player_count != 2 or number not in (34, 65)
                    self.assertEqual(detail["supported"], supported)
                    self.assertEqual(detail["setup_players"], player_count if supported else 3)
                    setup = get_mission(number, detail["setup_players"])
                    text = detail["sections"][0]["text"]["en"]
                    self.assertIn(f"values 1–{setup['blue_max']}", text)
                    self.assertIn(f"{setup['yellow_count']} from {setup['yellow_pool']} candidates", text)
                    self.assertIn(f"{setup['red_count']} from {setup['red_pool']} candidates", text)
                    if player_count == 2 and number in (11, 13, 27, 29, 40, 46, 51):
                        self.assertIn("Captain places no initial clue", text)
                    if player_count == 2 and number == 43:
                        self.assertIn("Captain draws a random initial clue", text)

    def test_rejects_invalid_missions_and_player_counts(self):
        for number in (0, 67, True, "1", 1.5, None):
            with self.subTest(mission=number), self.assertRaises(ValueError):
                get_mission_help(number)
        for player_count in (1, 6, True, "3", 3.0, None):
            with self.subTest(players=player_count), self.assertRaises(ValueError):
                get_mission_help(1, player_count)

    def test_results_do_not_share_mutable_content(self):
        detail = get_mission_help(57)
        expected = copy.deepcopy(detail)
        detail["title"]["zh"] = "modified"
        detail["sections"][0]["text"]["en"] = "modified"
        detail["constraints"][0]["text"]["zh"] = "modified"
        self.assertEqual(get_mission_help(57), expected)

    def test_constraint_glossary_matches_mission_scope(self):
        for number, count in ((31, 5), (34, 5), (66, 5), (32, 12), (37, 12), (42, 12), (57, 12), (61, 12)):
            detail = get_mission_help(number)
            self.assertEqual(len(detail["constraints"]), count)
            for constraint in detail["constraints"]:
                self.assertEqual(constraint["text"]["en"], CONSTRAINTS[constraint["id"]])
        self.assertEqual(get_mission_help(1)["constraints"], [])

    def test_challenge_reference_matches_public_challenge_numbers(self):
        for number in (55, 60):
            challenges = get_mission_help(number)["challenges"]
            self.assertEqual({challenge["id"] for challenge in challenges}, set(CHALLENGES))
            for challenge in challenges:
                self.assertEqual(challenge["text"]["en"], CHALLENGES[challenge["id"]])
                self.assertRegex(challenge["text"]["zh"], r"[\u4e00-\u9fff]")
        self.assertEqual(get_mission_help(1)["challenges"], [])

    def test_current_help_is_identical_for_viewers_and_leaves_state_unchanged(self):
        state = BombBustersGame.init_game({"mission_id": 34, "seed": "help-privacy"}, make_players(3))
        original = copy.deepcopy(state)
        expected = get_mission_help(34)
        for viewer_id in ("p0", "p1", "p2", "spectator"):
            view = BombBustersGame.get_public_view(state, viewer_id)
            self.assertEqual(view["campaign"]["help"], expected)
        self.assertEqual(state, original)

    def test_old_saves_get_current_help_without_migrating_state(self):
        state = BombBustersGame.init_game({"mission_id": 46, "seed": "old-help"}, make_players(3))
        state["campaign"]["mission"].pop("rules_zh", None)
        restored = BombBustersGame.deserialize(BombBustersGame.serialize(state))
        view = BombBustersGame.get_public_view(restored, "p0")
        self.assertEqual(view["campaign"]["help"], get_mission_help(46))
        self.assertNotIn("help", restored["campaign"]["mission"])


class BombBustersMissionHelpApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_endpoint_returns_only_requested_public_rules(self):
        import app

        detail = await app.bomb_busters_mission_help(66, 5)
        self.assertEqual(detail, get_mission_help(66, 5))
        self.assertNotIn("wires", detail)
        self.assertNotIn("players", detail)

    async def test_endpoint_rejects_out_of_range_requests(self):
        import app

        for number, count in ((0, 3), (67, 3), (1, 1), (1, 6)):
            with self.subTest(mission=number, players=count), self.assertRaises(HTTPException) as caught:
                await app.bomb_busters_mission_help(number, count)
            self.assertEqual(caught.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
