import copy
import unittest

from game.natsumemo import NatsumemoGame as Game
from game.natsumemo_ai import _calendar_value, _die_strategy, _die_value, _homework_outcomes, choose_action
from tests.test_natsumemo import game, start, submit


class NatsumemoAITests(unittest.TestCase):
    def test_homework_distribution_preserves_probability_and_failure_risk(self):
        outcomes = _homework_outcomes(1, 0)
        self.assertAlmostEqual(sum(outcomes.values()), 1)
        self.assertAlmostEqual(sum(pages * chance for (pages, mask), chance in outcomes.items()), 11 / 6)
        self.assertAlmostEqual(outcomes[(0, 1)], 1 / 6)
        self.assertAlmostEqual(sum(_homework_outcomes(6, 6).values()), 1)

    def test_calendar_values_exact_shortfall_and_squared_titles(self):
        state = game()
        state["week"] = 4
        view = Game.get_public_view(state, "p0")
        occupied = [True] * 7
        self.assertEqual(_calendar_value(view, occupied, 24, {"family", "grandchild"}), -6)
        self.assertEqual(_calendar_value(view, occupied, 25, {"family", "grandchild"}), 4)
        self.assertEqual(_calendar_value(view, occupied, 30, {"family", "grandchild"}), 19)
        self.assertEqual(_calendar_value(view, occupied, 30, {"family", "grandchild", "prepared"}), 19)

    def test_roll_expectation_matches_enumeration(self):
        values = (6, 8, 4)
        expected = sum(values[0] if first > second else values[1] if first == second else values[2]
                       for first in range(1, 7) for second in range(1, 7)) / 36
        calculated = sum(_die_value(value, (1 / 6,) * 6, 2, values) for value in range(1, 7)) / 6
        self.assertAlmostEqual(calculated, expected)

    def test_secret_die_strategy_avoids_uniform_play(self):
        for count in range(2, 7):
            strategy = _die_strategy(count, (10, 4, 8))
            self.assertAlmostEqual(sum(strategy), 1)
            self.assertTrue(all(chance > 0 for chance in strategy))
            self.assertGreater(sum(chance * _die_value(value, (1 / 6,) * 6, count, (10, 4, 8))
                                   for value, chance in enumerate(strategy, 1)),
                               sum(_die_value(value, (1 / 6,) * 6, count, (10, 4, 8)) for value in range(1, 7)) / 6)

    def test_proposal_preserves_study_and_rejects_calendar_conflict(self):
        state = game()
        start(state)
        pid = state["speaker"]
        self.assertNotEqual(Game.bot_move(state, pid)["day"], 2)
        state["players"][pid]["calendar"][0] = [True] * 6 + [None]
        self.assertEqual(Game.bot_move(state, pid)["day"], 6)

    def test_final_week_keeps_homework_day_unless_finished(self):
        state = game()
        start(state, "w4_park")
        state["players"]["p0"]["calendar"][3][:6] = [True] * 6
        submit(state, state["speaker"], "propose", day=6)
        self.assertFalse(Game.bot_move(state, "p0")["attend"])
        state["players"]["p0"]["homework"] = 30
        self.assertTrue(Game.bot_move(state, "p0")["attend"])

    def test_other_players_secrets_and_submitted_decisions_do_not_affect_action(self):
        state = game()
        start(state)
        submit(state, state["speaker"], "propose", day=0)
        view = Game.get_public_view(state, "p0")
        before = copy.deepcopy(view)
        expected = choose_action(view)
        self.assertEqual(view, before)
        state["players"]["p1"].update(homework=30, hearts={"p0": 99, "p2": 0})
        state["choices"]["p1"] = False
        self.assertEqual(choose_action(Game.get_public_view(state, "p0")), expected)


if __name__ == "__main__":
    unittest.main()
