import random
import unittest
from unittest.mock import patch

from game.istanbul import GOODS, IstanbulGame, WAREHOUSE_GOODS


class IstanbulWarehouseTests(unittest.TestCase):
    def make_state(self, layout, place_id, explicit_good):
        players = [
            {"player_id": "p1", "name": "Merchant", "seat": 0},
            {"player_id": "p2", "name": "Opponent", "seat": 1},
        ]
        with patch("game.istanbul.random", random.Random(0)):
            state = IstanbulGame.init_game({"layout": layout}, players)
        tiles = {tile["place_id"]: tile for tile in state["board"]}
        warehouse = tiles[place_id]
        if explicit_good:
            warehouse["good"] = WAREHOUSE_GOODS[place_id]
        else:
            # Rooms created before this fix have no good field on warehouse tiles.
            warehouse.pop("good", None)
        player = state["players"]["p1"]
        player["capacity"] = 4
        player["goods"] = {color: 1 for color in GOODS}
        fountain_pos = tiles[7]["pos"]
        state["npc"] = {"governor": fountain_pos, "smuggler": fountain_pos}
        state["players"]["p2"]["family_pos"] = fountain_pos
        return state, tiles

    def apply(self, state, action):
        _, error = IstanbulGame.apply_action(state, "p1", action)
        self.assertIsNone(error)

    def move_and_activate(self, state, destination):
        state["players"]["p1"]["merchant_pos"] = state["neighbors"][destination][0]
        self.apply(state, {"type": "move", "path": [destination]})
        self.assertEqual(state["phase"], "assistant")
        self.apply(state, {"type": "assistant", "mode": "drop"})
        self.assertEqual(state["phase"], "action")

    def assert_warehouse_filled(self, state, good):
        expected = {color: 4 if color == good else 1 for color in GOODS}
        self.assertEqual(state["players"]["p1"]["goods"], expected)
        view = IstanbulGame.get_public_view(state, "p1")
        self.assertEqual(view["players"][0]["goods"], expected)
        self.assertEqual(state["current_player"], "p2")
        self.assertEqual(state["phase"], "movement")

    def test_merchant_fills_only_matching_goods_to_capacity(self):
        for layout in ("standard", "random"):
            for place_id, good in WAREHOUSE_GOODS.items():
                for explicit_good in (False, True):
                    with self.subTest(layout=layout, place_id=place_id, explicit_good=explicit_good):
                        state, tiles = self.make_state(layout, place_id, explicit_good)
                        self.move_and_activate(state, tiles[place_id]["pos"])
                        self.apply(state, {"type": "location_action"})
                        self.assert_warehouse_filled(state, good)

    def test_family_fills_only_matching_goods_to_capacity(self):
        for layout in ("standard", "random"):
            for place_id, good in WAREHOUSE_GOODS.items():
                for explicit_good in (False, True):
                    with self.subTest(layout=layout, place_id=place_id, explicit_good=explicit_good):
                        state, tiles = self.make_state(layout, place_id, explicit_good)
                        police_pos = tiles[12]["pos"]
                        warehouse_pos = tiles[place_id]["pos"]
                        self.move_and_activate(state, police_pos)
                        self.apply(state, {"type": "location_action", "destination": warehouse_pos})
                        self.assertEqual(state["players"]["p1"]["merchant_pos"], police_pos)
                        self.assertEqual(state["players"]["p1"]["family_pos"], warehouse_pos)
                        self.assert_warehouse_filled(state, good)


if __name__ == "__main__":
    unittest.main()
