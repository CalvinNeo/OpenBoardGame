import copy
import itertools
import random
import unittest

from game.dice_throne import DiceThroneGame as Game
from game.dice_throne_data import HEROES


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

    def test_rerolls_advance_random_stream_only_for_unkept_dice(self):
        initial = self.start()
        player_id = initial["current_player"]
        for action_type in ("end_phase", "roll"):
            _, error = Game.apply_action(initial, player_id, {"type": action_type, "revision": initial["revision"]})
            self.assertIsNone(error)
        hero = initial["players"][player_id]["hero"]
        for kept in itertools.product((False, True), repeat=5):
            if all(kept):
                continue
            with self.subTest(kept=kept):
                state = copy.deepcopy(initial)
                state["kept"] = list(kept)
                expected_rng = random.Random()
                expected_rng.setstate(state["rng_state"])
                for roll_count in (2, 3):
                    expected_dice = copy.deepcopy(state["dice"])
                    for index, is_kept in enumerate(kept):
                        if not is_kept:
                            value = expected_rng.randint(1, 6)
                            expected_dice[index] = {"value": value, "face": HEROES[hero]["dice_faces"][value - 1]}
                    revision = state["revision"]
                    events, error = Game.apply_action(state, player_id, {"type": "roll", "revision": revision})
                    self.assertIsNone(error)
                    self.assertTrue(events)
                    self.assertEqual(state["dice"], expected_dice)
                    self.assertEqual(state["rng_state"], expected_rng.getstate())
                    self.assertEqual(state["rolls"], roll_count)
                    self.assertEqual(state["revision"], revision + 1)
                self.assertNotIn("roll", Game.get_legal_actions(state, player_id))

    def test_all_kept_cannot_spend_roll_until_a_die_is_released(self):
        state = self.start()
        player_id = state["current_player"]
        for action_type in ("end_phase", "roll"):
            _, error = Game.apply_action(state, player_id, {"type": action_type, "revision": state["revision"]})
            self.assertIsNone(error)
        for index in range(5):
            _, error = Game.apply_action(state, player_id, {"type": "toggle_keep", "index": index, "revision": state["revision"]})
            self.assertIsNone(error)
        self.assertNotIn("roll", Game.get_public_view(state, player_id)["legal_actions"])
        self.assertIn("confirm_roll", Game.get_legal_actions(state, player_id))
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, player_id, {"type": "roll", "revision": state["revision"]})
        self.assertEqual(events, [])
        self.assertEqual(error, "action not available")
        self.assertEqual(state, before)
        _, error = Game.apply_action(state, player_id, {"type": "toggle_keep", "index": 2, "revision": state["revision"]})
        self.assertIsNone(error)
        self.assertIn("roll", Game.get_legal_actions(state, player_id))
        _, error = Game.apply_action(state, player_id, {"type": "roll", "revision": state["revision"]})
        self.assertIsNone(error)
        self.assertEqual(state["rolls"], 2)

    def test_reroll_can_legitimately_repeat_the_entire_visible_result(self):
        state = self.start()
        player_id = state["current_player"]
        state["rng_state"] = random.Random(0).getstate()
        for action_type in ("end_phase", "roll"):
            _, error = Game.apply_action(state, player_id, {"type": action_type, "revision": state["revision"]})
            self.assertIsNone(error)
        state["kept"] = [False, True, True, True, True]
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, player_id, {"type": "roll", "revision": state["revision"]})
        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertEqual(state["dice"], before["dice"])
        self.assertNotEqual(state["rng_state"], before["rng_state"])
        self.assertEqual(state["rolls"], before["rolls"] + 1)

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
