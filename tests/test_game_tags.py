import unittest

from app import api_list_games
from game import list_games
from game.tags import GAME_TAG_BY_ID, GAME_TAG_IDS, GAME_TAGS


class GameTagTests(unittest.IsolatedAsyncioTestCase):
    def test_every_registered_game_has_known_tags(self):
        registered_ids = {game.game_id for game in list_games()}

        self.assertEqual(set(GAME_TAG_IDS), registered_ids)
        for game_id, tag_ids in GAME_TAG_IDS.items():
            self.assertTrue(tag_ids, f"{game_id} has no game tags")
            self.assertEqual(len(tag_ids), len(set(tag_ids)), f"{game_id} has duplicate tags")
            self.assertTrue(
                set(tag_ids).issubset(GAME_TAG_BY_ID),
                f"{game_id} has unknown tags: {set(tag_ids) - set(GAME_TAG_BY_ID)}",
            )

    def test_every_tag_is_used(self):
        used_tags = {tag_id for tag_ids in GAME_TAG_IDS.values() for tag_id in tag_ids}

        self.assertEqual(used_tags, {tag.tag_id for tag in GAME_TAGS})

    async def test_games_api_exposes_ordered_tag_metadata(self):
        payload = await api_list_games()
        games_by_id = {game["game_id"]: game for game in payload}

        self.assertGreater(len(games_by_id["incan_gold"]["tags"]), 1)
        self.assertEqual(
            [tag["id"] for tag in games_by_id["incan_gold"]["tags"]],
            ["filler", "push_your_luck", "ameritrash"],
        )
        for game in payload:
            orders = [tag["order"] for tag in game["tags"]]
            self.assertEqual(orders, sorted(orders))
            self.assertTrue(
                all({"id", "label", "emoji", "description", "order"} <= set(tag) for tag in game["tags"])
            )


if __name__ == "__main__":
    unittest.main()
