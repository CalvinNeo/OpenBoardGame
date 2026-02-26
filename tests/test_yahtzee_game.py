import unittest

from game.yahtzee import YahtzeeGame


def _players(count):
    return [
        {
            "player_id": f"p{idx}",
            "name": f"P{idx}",
            "seat": idx,
            "is_bot": False,
        }
        for idx in range(count)
    ]


class YahtzeeGameTests(unittest.TestCase):
    def test_upper_scoring_counts_faces(self):
        state = YahtzeeGame.init_game({}, _players(1))
        pid = state["current_player"]
        state["dice"] = [2, 2, 2, 5, 6]
        state["roll_count"] = 1

        _, error = YahtzeeGame.apply_action(state, pid, {"type": "score", "category": "twos"})

        self.assertIsNone(error)
        self.assertEqual(state["players"][pid]["score_sheet"]["twos"], 6)

    def test_small_straight_allows_duplicates(self):
        state = YahtzeeGame.init_game({}, _players(1))
        pid = state["current_player"]
        state["dice"] = [1, 2, 2, 3, 4]
        state["roll_count"] = 1

        _, error = YahtzeeGame.apply_action(state, pid, {"type": "score", "category": "small_straight"})

        self.assertIsNone(error)
        self.assertEqual(state["players"][pid]["score_sheet"]["small_straight"], 30)

    def test_joker_forced_upper_awards_bonus(self):
        state = YahtzeeGame.init_game({}, _players(1))
        pid = state["current_player"]
        sheet = state["players"][pid]["score_sheet"]
        sheet["yahtzee"] = 50
        state["dice"] = [4, 4, 4, 4, 4]
        state["roll_count"] = 1

        _, error = YahtzeeGame.apply_action(state, pid, {"type": "score", "category": "fours"})

        self.assertIsNone(error)
        self.assertEqual(sheet["fours"], 20)
        self.assertEqual(state["players"][pid]["yahtzee_bonus"], 100)

    def test_joker_allows_lower_choice_scoring(self):
        state = YahtzeeGame.init_game({}, _players(1))
        pid = state["current_player"]
        sheet = state["players"][pid]["score_sheet"]
        sheet["yahtzee"] = 50
        sheet["twos"] = 4
        state["dice"] = [2, 2, 2, 2, 2]
        state["roll_count"] = 1

        _, error = YahtzeeGame.apply_action(state, pid, {"type": "score", "category": "small_straight"})

        self.assertIsNone(error)
        self.assertEqual(sheet["small_straight"], 30)
        self.assertEqual(state["players"][pid]["yahtzee_bonus"], 100)

    def test_joker_forced_zero_when_lower_filled(self):
        state = YahtzeeGame.init_game({}, _players(1))
        pid = state["current_player"]
        sheet = state["players"][pid]["score_sheet"]
        sheet["yahtzee"] = 50
        sheet["twos"] = 6
        for category in [
            "three_kind",
            "four_kind",
            "full_house",
            "small_straight",
            "large_straight",
            "chance",
        ]:
            sheet[category] = 0
        state["dice"] = [2, 2, 2, 2, 2]
        state["roll_count"] = 1

        _, error = YahtzeeGame.apply_action(state, pid, {"type": "score", "category": "ones"})

        self.assertIsNone(error)
        self.assertEqual(sheet["ones"], 0)
        self.assertEqual(state["players"][pid]["yahtzee_bonus"], 100)

    def test_no_bonus_when_yahtzee_scored_zero(self):
        state = YahtzeeGame.init_game({}, _players(1))
        pid = state["current_player"]
        sheet = state["players"][pid]["score_sheet"]
        sheet["yahtzee"] = 0
        state["dice"] = [3, 3, 3, 3, 3]
        state["roll_count"] = 1

        _, error = YahtzeeGame.apply_action(state, pid, {"type": "score", "category": "chance"})

        self.assertIsNone(error)
        self.assertEqual(state["players"][pid]["yahtzee_bonus"], 0)


if __name__ == "__main__":
    unittest.main()
