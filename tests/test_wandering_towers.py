import unittest

from game.wandering_towers import PLAYER_SETUP, WanderingTowersGame


class WanderingTowersInitTests(unittest.TestCase):
    def test_two_player_init_places_all_wizards_on_board(self):
        players = [
            {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
            {"player_id": "p2", "name": "Bot 2", "seat": 1, "is_bot": True},
        ]

        state = WanderingTowersGame.init_game({}, players)
        view = WanderingTowersGame.get_public_view(state, "p1")

        expected_wizards = PLAYER_SETUP[2]["wizards"]
        visible_counts = {
            pid: sum(1 for wizard in view["wizards"] if wizard["owner_id"] == pid and wizard["visible"])
            for pid in ("p1", "p2")
        }

        self.assertEqual(visible_counts["p1"], expected_wizards)
        self.assertEqual(visible_counts["p2"], expected_wizards)
        self.assertEqual(sum(visible_counts.values()), expected_wizards * 2)


if __name__ == "__main__":
    unittest.main()
