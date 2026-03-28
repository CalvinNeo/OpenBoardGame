import unittest

from game.citadels import (
    CitadelsGame,
    _advance_turn_sequence,
    _finish_round,
    _public_possible_role_holders,
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

    def test_bot_prefers_architect_in_simple_draft(self):
        state = CitadelsGame.init_game({}, _players(4))
        state["draft_state"]["current_player"] = "p1"
        state["draft_state"]["pool"] = [1, 7]
        state["players"]["p1"]["gold"] = 2
        state["players"]["p1"]["hand"] = [
            {
                "id": "a",
                "name_cn": "庄园",
                "name_en": "Manor",
                "color": "yellow",
                "cost": 3,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            },
            {
                "id": "b",
                "name_cn": "市场",
                "name_en": "Market",
                "color": "green",
                "cost": 2,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            },
        ]
        action = CitadelsGame.bot_move(state, "p1")
        self.assertEqual(action, {"type": "draft_character", "rank": 7})

    def test_bot_chooses_gold_when_two_more_gold_unlocks_good_build(self):
        state = CitadelsGame.init_game({}, _players(4))
        state["phase"] = "turn"
        state["active_turn"] = {
            "player_id": "p1",
            "rank": 4,
            "step": "choose_income",
            "collected_tax": False,
            "ability_used": False,
            "builds_used": 0,
            "build_limit": 1,
            "draw_offer": [],
        }
        state["players"]["p1"]["gold"] = 2
        state["players"]["p1"]["hand"] = [
            {
                "id": "a",
                "name_cn": "城堡",
                "name_en": "Castle",
                "color": "yellow",
                "cost": 4,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            },
            {
                "id": "b",
                "name_cn": "酒馆",
                "name_en": "Tavern",
                "color": "green",
                "cost": 1,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            },
        ]
        action = CitadelsGame.bot_move(state, "p1")
        self.assertEqual(action, {"type": "choose_income", "choice": "gold"})

    def test_bot_keeps_higher_value_card_from_draw_offer(self):
        state = CitadelsGame.init_game({}, _players(4))
        state["phase"] = "turn"
        state["active_turn"] = {
            "player_id": "p1",
            "rank": 4,
            "step": "choose_draw",
            "collected_tax": False,
            "ability_used": False,
            "builds_used": 0,
            "build_limit": 1,
            "draw_offer": [
                {
                    "id": "cheap",
                    "name_cn": "神殿",
                    "name_en": "Temple",
                    "color": "blue",
                    "cost": 1,
                    "text": "",
                    "score_bonus": 0,
                    "protect_from_warlord": False,
                    "counts_as_any_color": False,
                },
                {
                    "id": "expensive",
                    "name_cn": "宫殿",
                    "name_en": "Palace",
                    "color": "yellow",
                    "cost": 5,
                    "text": "",
                    "score_bonus": 0,
                    "protect_from_warlord": False,
                    "counts_as_any_color": False,
                },
            ],
        }
        action = CitadelsGame.bot_move(state, "p1")
        self.assertEqual(action, {"type": "choose_draw", "card_id": "expensive"})

    def test_bot_builds_matching_tax_color_before_collecting_tax(self):
        state = CitadelsGame.init_game({}, _players(4))
        state["phase"] = "turn"
        state["players"]["p1"]["gold"] = 3
        state["players"]["p1"]["city"] = [
            {
                "id": "city_1",
                "name_cn": "庄园",
                "name_en": "Manor",
                "color": "yellow",
                "cost": 3,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
        ]
        state["players"]["p1"]["hand"] = [
            {
                "id": "hand_yellow",
                "name_cn": "城堡",
                "name_en": "Castle",
                "color": "yellow",
                "cost": 3,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
        ]
        state["active_turn"] = {
            "player_id": "p1",
            "rank": 4,
            "step": "main",
            "collected_tax": False,
            "ability_used": False,
            "builds_used": 0,
            "build_limit": 1,
            "draw_offer": [],
        }
        action = CitadelsGame.bot_move(state, "p1")
        self.assertEqual(action, {"type": "build", "card_id": "hand_yellow"})

    def test_bot_warlord_targets_leading_city(self):
        state = CitadelsGame.init_game({"winning_city_size": 8}, _players(4))
        state["phase"] = "turn"
        for player in state["players"].values():
            player["chosen_ranks"] = []
            player["revealed_ranks"] = []
            player["hand"] = []
            player["city"] = []
        state["players"]["p1"]["gold"] = 5
        state["players"]["p2"]["city"] = [
            {
                "id": f"p2_{index}",
                "name_cn": f"P2 {index}",
                "name_en": f"P2 {index}",
                "color": "blue",
                "cost": 3,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
            for index in range(7)
        ]
        state["players"]["p3"]["city"] = [
            {
                "id": "p3_1",
                "name_cn": "P3 1",
                "name_en": "P3 1",
                "color": "green",
                "cost": 1,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
        ]
        state["active_turn"] = {
            "player_id": "p1",
            "rank": 8,
            "step": "main",
            "collected_tax": True,
            "ability_used": False,
            "builds_used": 0,
            "build_limit": 1,
            "draw_offer": [],
        }
        action = CitadelsGame.bot_move(state, "p1")
        self.assertEqual(action["type"], "destroy_district")
        self.assertEqual(action["target_player_id"], "p2")

    def test_public_possible_role_holders_ignores_hidden_true_owner(self):
        state = CitadelsGame.init_game({}, _players(4))
        state["phase"] = "turn"
        state["draft_state"]["face_up_removed"] = []
        for player in state["players"].values():
            player["chosen_ranks"] = []
            player["revealed_ranks"] = []
        state["players"]["p1"]["chosen_ranks"] = [1]
        state["players"]["p2"]["chosen_ranks"] = [4]
        state["players"]["p3"]["chosen_ranks"] = [7]
        state["players"]["p4"]["chosen_ranks"] = [5]
        holders = _public_possible_role_holders(state, "p1", 4)
        self.assertEqual(holders, ["p2", "p3", "p4"])

    def test_bot_assassin_does_not_target_its_own_known_second_role(self):
        state = CitadelsGame.init_game({}, _players(2))
        state["phase"] = "turn"
        state["max_rank"] = 8
        state["turn_order"] = ["p1", "p2"]
        state["draft_state"]["face_up_removed"] = []
        for player in state["players"].values():
            player["revealed_ranks"] = []
            player["city"] = []
        state["players"]["p1"]["chosen_ranks"] = [1, 7]
        state["players"]["p2"]["chosen_ranks"] = [4, 8]
        state["players"]["p2"]["city"] = [
            {
                "id": f"p2_{index}",
                "name_cn": f"P2 {index}",
                "name_en": f"P2 {index}",
                "color": "yellow",
                "cost": 3,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
            for index in range(6)
        ]
        state["active_turn"] = {
            "player_id": "p1",
            "rank": 1,
            "step": "main",
            "collected_tax": False,
            "ability_used": False,
            "builds_used": 0,
            "build_limit": 1,
            "draw_offer": [],
        }
        action = CitadelsGame.bot_move(state, "p1")
        self.assertEqual(action["type"], "use_assassin")
        self.assertNotEqual(action["target_rank"], 7)


if __name__ == "__main__":
    unittest.main()
