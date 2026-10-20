import copy
import unittest

from game.dice_throne import DiceThroneGame as Game


def make_state():
    return Game.init_game(
        {"seed": 163},
        [
            {"player_id": "p0", "name": "Alice", "seat": 0},
            {"player_id": "p1", "name": "Bot", "seat": 1, "is_bot": True},
        ],
    )


class DiceThroneTests(unittest.TestCase):
    def start(self):
        state = make_state()
        for pid, hero in (("p0", "barbarian"), ("p1", "moon_elf")):
            events, error = Game.apply_action(state, pid, {"type": "choose_hero", "hero": hero, "revision": state["revision"]})
            self.assertIsNone(error)
        return state

    def test_both_players_choose_different_heroes_and_receive_private_hands(self):
        state = self.start()
        self.assertEqual(state["phase"], "main_1")
        self.assertEqual([len(state["players"][pid]["hand"]) for pid in ("p0", "p1")], [4, 4])
        own = Game.get_public_view(state, "p0")
        other = Game.get_public_view(state, "p1")
        self.assertEqual(len(own["your_hand"]), 4)
        self.assertEqual(len(other["your_hand"]), 4)
        self.assertNotEqual(own["your_hand"], other["your_hand"])

    def test_roll_keep_confirm_ability_and_defense_window(self):
        state = self.start()
        pid = state["current_player"]
        rev = state["revision"]
        Game.apply_action(state, pid, {"type": "end_phase", "revision": rev})
        self.assertEqual(state["phase"], "offensive_roll")
        Game.apply_action(state, pid, {"type": "roll", "revision": state["revision"]})
        self.assertEqual(len(state["dice"]), 5)
        Game.apply_action(state, pid, {"type": "toggle_keep", "index": 0, "revision": state["revision"]})
        Game.apply_action(state, pid, {"type": "confirm_roll", "revision": state["revision"]})
        self.assertEqual(state["phase"], "targeting")
        self.assertIn("use_ability", Game.get_legal_actions(state, pid))

    def test_stale_action_is_atomic(self):
        state = self.start()
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, state["current_player"], {"type": "end_phase", "revision": -1})
        self.assertEqual(events, [])
        self.assertEqual(error, "stale revision")
        self.assertEqual(state, before)

    def test_bot_can_progress_to_game_over(self):
        state = Game.init_game(
            {"seed": 164},
            [
                {"player_id": "p0", "name": "A", "seat": 0, "is_bot": True},
                {"player_id": "p1", "name": "B", "seat": 1, "is_bot": True},
            ],
        )
        for _ in range(500):
            if state["game_over"]:
                break
            pid = next(pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid))
            action = Game.bot_move(state, pid)
            self.assertIsNotNone(action)
            action.pop("delay_ms", None)
            _, error = Game.apply_action(state, pid, action)
            self.assertIsNone(error, (state["phase"], pid, action))
        self.assertTrue(state["game_over"])
        self.assertTrue(state["winner"])


if __name__ == "__main__":
    unittest.main()
