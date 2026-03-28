import unittest

from game.citadels import (
    CitadelsGame,
    _advance_turn_sequence,
    _finish_round,
    _warlord_destroy_targets,
)


def _players(count):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": False,
        }
        for index in range(count)
    ]


class CitadelsGameTests(unittest.TestCase):
    def test_five_player_game_uses_queen_mode(self):
        state = CitadelsGame.init_game({}, _players(5))
        self.assertEqual(state["character_mode"], "queen9")
        self.assertEqual(state["max_rank"], 9)
        self.assertEqual(len(state["draft_state"]["face_up_removed"]), 2)

    def test_two_player_draft_gives_two_roles_each(self):
        state = CitadelsGame.init_game({}, _players(2))
        while state["phase"] == "draft":
            current_player = state["draft_state"]["current_player"]
            rank = min(state["draft_state"]["pool"])
            _, error = CitadelsGame.apply_action(
                state,
                current_player,
                {"type": "draft_character", "rank": rank},
            )
            self.assertIsNone(error)
        self.assertEqual(len(state["players"]["p1"]["chosen_ranks"]), 2)
        self.assertEqual(len(state["players"]["p2"]["chosen_ranks"]), 2)

    def test_queen_gets_bonus_when_adjacent_to_king(self):
        state = CitadelsGame.init_game({}, _players(5))
        state["turn_order"] = ["p1", "p2", "p3", "p4", "p5"]
        for player in state["players"].values():
            player["chosen_ranks"] = []
            player["revealed_ranks"] = []
            player["gold"] = 0
        state["players"]["p2"]["chosen_ranks"] = [4]
        state["players"]["p3"]["chosen_ranks"] = [9]
        state["phase"] = "turn"
        state["turn_rank"] = 9
        state["active_turn"] = None
        state["killed_rank"] = None
        _advance_turn_sequence(state)
        self.assertEqual(state["active_turn"]["player_id"], "p3")
        self.assertEqual(state["players"]["p3"]["gold"], 3)

    def test_queen_bonus_is_deferred_when_king_was_assassinated(self):
        state = CitadelsGame.init_game({}, _players(5))
        state["turn_order"] = ["p1", "p2", "p3", "p4", "p5"]
        for player in state["players"].values():
            player["chosen_ranks"] = []
            player["revealed_ranks"] = []
            player["gold"] = 0
        state["players"]["p2"]["chosen_ranks"] = [4]
        state["players"]["p3"]["chosen_ranks"] = [9]
        state["phase"] = "turn"
        state["turn_rank"] = 9
        state["active_turn"] = None
        state["killed_rank"] = 4
        _advance_turn_sequence(state)
        self.assertEqual(state["players"]["p3"]["gold"], 0)
        self.assertEqual(state["queen_deferred_player_id"], "p3")
        _finish_round(state)
        self.assertEqual(state["players"]["p3"]["gold"], 3)

    def test_warlord_cannot_target_completed_city_with_short_game_config(self):
        state = CitadelsGame.init_game({"winning_city_size": 7}, _players(4))
        for player in state["players"].values():
            player["chosen_ranks"] = []
            player["revealed_ranks"] = []
            player["city"] = []
        state["players"]["p2"]["city"] = [
            {
                "id": f"city_{index}",
                "name_cn": f"District {index}",
                "name_en": f"District {index}",
                "color": "blue",
                "cost": 2,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
            for index in range(7)
        ]
        state["players"]["p1"]["chosen_ranks"] = [8]
        state["active_turn"] = {
            "player_id": "p1",
            "rank": 8,
            "step": "main",
            "collected_tax": False,
            "ability_used": False,
            "builds_used": 0,
            "build_limit": 1,
            "draw_offer": [],
        }
        state["players"]["p1"]["gold"] = 10
        targets = _warlord_destroy_targets(state, "p1")
        self.assertEqual(targets, [])


if __name__ == "__main__":
    unittest.main()
