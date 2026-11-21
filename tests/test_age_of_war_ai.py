import copy
import random
import unittest

from game.age_of_war import AgeOfWarGame, CASTLES, CASTLE_ORDER, _castle_lines, _match_line
from game.age_of_war_ai import _capture_probability, _cost, _line_key, _outcomes, _target_value


class AgeOfWarAiTests(unittest.TestCase):
    def make_state(self, count=2):
        return AgeOfWarGame.init_game({}, [{"player_id": f"p{index}"} for index in range(count)])

    def test_roll_before_committing_and_do_not_mutate_state(self):
        state = self.make_state()
        before = copy.deepcopy(state)
        self.assertEqual(AgeOfWarGame.bot_move(state, "p0"), {"type": "roll"})
        self.assertEqual(state, before)
        self.assertIsNone(AgeOfWarGame.bot_move(state, "p1"))
        self.assertIsNone(AgeOfWarGame.bot_move(state, "spectator"))
        state["game_over"] = True
        self.assertIsNone(AgeOfWarGame.bot_move(state, "p0"))

    def test_outcomes_cover_all_ordered_rolls(self):
        for count in range(8):
            outcomes = _outcomes(count)
            self.assertAlmostEqual(sum(weight for _, weight in outcomes), 1)
            self.assertTrue(all(sum(dice) == count for dice, _ in outcomes))
            self.assertAlmostEqual(sum(weight * (6 ** count) for _, weight in outcomes), 6 ** count)

    def test_matching_cost_agrees_with_server_for_every_castle_line(self):
        requirements = {tuple(sorted(requirement.items())) for castle in CASTLES.values()
                        for line in castle["battle_lines"] for requirement in line}
        for dice, _ in _outcomes(7):
            pool = [face for face, count in zip(("I1", "I2", "I3", "A", "C", "D"), dice) for _ in range(count)]
            for requirement in requirements:
                line = [dict(requirement)]
                match = _match_line(pool, line)
                self.assertEqual(_cost(_line_key(line), dice), None if match is None else len(match))

    def test_probability_matches_closed_form_and_insufficient_dice(self):
        archery = (0, 1, 0, 0)
        self.assertAlmostEqual(_capture_probability((archery,), 1), 1 / 6)
        self.assertAlmostEqual(_capture_probability((archery,), 2), 1 - (5 / 6) ** 3)
        self.assertEqual(_capture_probability((archery, archery), 1), 0)
        self.assertEqual(_capture_probability((), 0), 1)

    def test_fill_scarce_line_instead_of_first_fillable(self):
        state = self.make_state()
        state.update(phase="assign", dice_pool=["I3", "A", "A"], dice_remaining=3,
                     target_lines=[{"requirements": [{"type": "infantry", "sum": 3}]},
                                   {"requirements": [{"type": "archery", "count": 2}]}])
        self.assertEqual(AgeOfWarGame.bot_move(state, "p0"), {"type": "fill_line", "line_index": 1})

    def test_discard_when_no_line_matches(self):
        state = self.make_state()
        state.update(phase="assign", dice_pool=["I1"], dice_remaining=1,
                     target={"type": "central", "castle_id": "inuyama"}, target_lines=_castle_lines("inuyama", False))
        action = AgeOfWarGame.bot_move(state, "p0")
        self.assertEqual(action, {"type": "discard_die", "die_index": 0})
        self.assertIsNone(AgeOfWarGame.apply_action(state, "p0", action)[1])

    def test_clan_completion_increases_target_value(self):
        state = self.make_state()
        before = _target_value(state, "p0", "marugame", None)
        state["central_castles"].remove("matsuyama")
        state["players"]["p0"]["castles"] = ["matsuyama"]
        self.assertGreater(_target_value(state, "p0", "marugame", None), before)

    def test_target_selection_uses_visible_roll_and_avoids_locked_castles(self):
        state = self.make_state()
        state["central_castles"] = ["odani", "inuyama"]
        state["dice_pool"] = ["I3", "I3", "I2", "I2", "C", "C", "C"]
        state["players"]["p1"]["castles"] = ["kumamoto"]
        state["players"]["p1"]["locked_clans"] = ["shimazu"]
        before = copy.deepcopy(state)
        action = AgeOfWarGame.bot_move(state, "p0")
        self.assertEqual(action["castle_id"], "odani")
        self.assertEqual(state, before)
        self.assertEqual(action, AgeOfWarGame.bot_move(state, "p0"))

    def test_can_attack_opponent_to_complete_clan(self):
        state = self.make_state()
        state["players"]["p0"]["castles"] = ["marugame"]
        state["players"]["p1"]["castles"] = ["matsuyama"]
        state["central_castles"] = [castle for castle in CASTLE_ORDER if castle not in {"marugame", "matsuyama"}]
        state["dice_pool"] = ["D", "C", "C", "I3", "I3", "I3", "I3"]
        action = AgeOfWarGame.bot_move(state, "p0")
        self.assertEqual(action, {"type": "select_target", "target_type": "player", "castle_id": "matsuyama", "defender_id": "p1"})

    def test_seeded_bot_games_finish_with_legal_actions_and_survive_reload(self):
        random_state = random.getstate()
        try:
            for count in (2, 4, 6):
                random.seed(800 + count)
                state = self.make_state(count)
                for step in range(6000):
                    if state["game_over"]:
                        break
                    player_id = state["current_player"]
                    action = AgeOfWarGame.bot_move(state, player_id)
                    self.assertIsNotNone(action)
                    self.assertIn(action["type"], AgeOfWarGame.get_legal_actions(state, player_id))
                    self.assertIsNone(AgeOfWarGame.apply_action(state, player_id, action)[1])
                    if step % 17 == 0:
                        state = AgeOfWarGame.deserialize(copy.deepcopy(AgeOfWarGame.serialize(state)))
                self.assertTrue(state["game_over"], f"{count} players did not finish")
                self.assertTrue(state["winner"])
        finally:
            random.setstate(random_state)


if __name__ == "__main__":
    unittest.main()
