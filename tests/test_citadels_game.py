import unittest
import random
from copy import deepcopy

from game.citadels import (
    CitadelsGame,
    _advance_turn_sequence,
    _best_build_plan,
    _best_magician_action,
    _finish_round,
    _public_possible_role_holders,
    _resolve_assassin,
    _resolve_magician_swap,
    _resolve_thief,
    _resolve_warlord_destroy,
    _start_role_turn,
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


def _district(card_id, cost=2, color="green", name=None):
    return {
        "id": card_id, "name_cn": name or card_id, "name_en": card_id,
        "color": color, "cost": cost, "text": "", "score_bonus": 0,
        "protect_from_warlord": False, "counts_as_any_color": False,
    }


class CitadelsGameTests(unittest.TestCase):
    def bot_state(self, rank=7, gold=6):
        state = CitadelsGame.init_game({}, _players(4))
        for player in state["players"].values():
            player.update(hand=[], city=[], chosen_ranks=[], revealed_ranks=[])
        state["phase"] = "turn"
        state["players"]["p1"]["gold"] = gold
        state["players"]["p1"]["chosen_ranks"] = [rank]
        state["active_turn"] = {
            "player_id": "p1", "rank": rank, "step": "main",
            "collected_tax": True, "ability_used": False,
            "builds_used": 0, "build_limit": 3 if rank == 7 else 1,
            "draw_offer": [],
        }
        return state

    def test_architect_plans_three_builds_instead_of_one_expensive_district(self):
        state = self.bot_state()
        state["players"]["p1"]["hand"] = [_district("expensive", 6)] + [
            _district(f"cheap_{index}", 2) for index in range(3)
        ]
        original = deepcopy(state)
        plan = _best_build_plan(state, "p1", 7)
        self.assertEqual({card["id"] for card in plan}, {"cheap_0", "cheap_1", "cheap_2"})
        self.assertEqual(state, original)
        for unused in range(3):
            action = CitadelsGame.bot_move(state, "p1")
            self.assertEqual(action["type"], "build")
            self.assertIsNone(CitadelsGame.apply_action(state, "p1", action)[1])
        self.assertEqual(len(state["players"]["p1"]["city"]), 3)

    def test_build_plan_respects_duplicates_and_remaining_slots(self):
        state = self.bot_state()
        state["players"]["p1"]["city"] = [_district("built", name="duplicate")]
        state["players"]["p1"]["hand"] = [
            _district("old", name="duplicate"), _district("first", name="same"),
            _district("second", name="same"), _district("unique"),
        ]
        self.assertEqual(len(_best_build_plan(state, "p1", 7)), 2)
        state["active_turn"]["builds_used"] = 2
        self.assertEqual(len(_best_build_plan(state, "p1", 7)), 1)
        state["active_turn"]["builds_used"] = 3
        self.assertEqual(_best_build_plan(state, "p1", 7), [])

    def test_architect_takes_gold_to_unlock_last_hand_card(self):
        state = self.bot_state(gold=2)
        state["active_turn"]["step"] = "choose_income"
        state["players"]["p1"]["hand"] = [_district("castle", 4)]
        self.assertEqual(CitadelsGame.bot_move(state, "p1")["choice"], "gold")

    def test_bot_saves_toward_unaffordable_hand_instead_of_drawing_forever(self):
        state = self.bot_state(rank=4, gold=0)
        state["active_turn"]["step"] = "choose_income"
        state["players"]["p1"]["hand"] = [_district("palace", 5)]
        self.assertEqual(CitadelsGame.bot_move(state, "p1")["choice"], "gold")

    def test_income_accounts_for_merchant_bonus_and_tax(self):
        state = self.bot_state(rank=6, gold=1)
        state["active_turn"]["step"] = "choose_income"
        state["players"]["p1"]["city"] = [_district("tax", 2)]
        state["players"]["p1"]["hand"] = [_district("build", 3)]
        self.assertEqual(CitadelsGame.bot_move(state, "p1")["choice"], "cards")

    def test_duplicate_only_hand_draws_instead_of_hoarding_gold(self):
        state = self.bot_state(rank=4)
        state["active_turn"]["step"] = "choose_income"
        state["players"]["p1"]["city"] = [_district("built", name="same")]
        state["players"]["p1"]["hand"] = [_district("duplicate", name="same")]
        self.assertEqual(CitadelsGame.bot_move(state, "p1")["choice"], "cards")

    def test_warlord_never_destroys_own_city(self):
        state = self.bot_state(rank=8)
        state["players"]["p1"]["city"] = [_district("own", 5)]
        self.assertEqual(CitadelsGame.bot_move(state, "p1"), {"type": "end_turn"})

    def test_warlord_reserves_gold_for_building(self):
        state = self.bot_state(rank=8, gold=4)
        state["players"]["p1"]["hand"] = [_district("own_build", 4)]
        state["players"]["p2"]["city"] = [_district("target", 4)]
        self.assertEqual(CitadelsGame.bot_move(state, "p1"), {"type": "build", "card_id": "own_build"})

    def test_magician_redraws_duplicates_without_throwing_away_useful_card(self):
        state = self.bot_state(rank=3, gold=2)
        state["players"]["p1"]["city"] = [_district("built", name="same")]
        state["players"]["p1"]["hand"] = [_district("duplicate", name="same"), _district("useful")]
        self.assertEqual(_best_magician_action(state, "p1"), {"type": "magician_redraw", "card_ids": ["duplicate"]})

    def test_bot_decision_does_not_depend_on_opponent_hand_contents(self):
        state = self.bot_state(rank=3, gold=2)
        state["players"]["p1"]["hand"] = [_district("useful")]
        state["players"]["p2"]["hand"] = [_district("hidden_cheap", 1)]
        action = CitadelsGame.bot_move(state, "p1")
        state["players"]["p2"]["hand"] = [_district("hidden_expensive", 6)]
        self.assertEqual(CitadelsGame.bot_move(state, "p1"), action)

    def test_seeded_bot_games_finish_with_legal_actions_for_all_player_counts(self):
        random_state = random.getstate()
        try:
            for player_count in range(2, 7):
                with self.subTest(players=player_count):
                    random.seed(5300 + player_count)
                    state = CitadelsGame.init_game({"winning_city_size": 7}, _players(player_count))
                    for unused in range(2500):
                        if state["game_over"]:
                            break
                        acting = next(player_id for player_id in state["turn_order"]
                                      if CitadelsGame.get_legal_actions(state, player_id))
                        action = CitadelsGame.bot_move(state, acting)
                        self.assertIsNotNone(action)
                        self.assertIsNone(CitadelsGame.apply_action(state, acting, action)[1], action)
                    self.assertTrue(state["game_over"])
                    self.assertTrue(state["winner_ids"])
        finally:
            random.setstate(random_state)

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
        state["players"]["p1"]["hand"] = []
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

    def test_bot_prefers_new_district_over_duplicate_in_draw_offer(self):
        state = self.bot_state(rank=4)
        state["active_turn"].update(step="choose_draw", draw_offer=[
            _district("duplicate", 5, name="palace"), _district("new", 3, "blue"),
        ])
        state["players"]["p1"]["hand"] = [_district("existing", 5, name="palace")]
        self.assertEqual(CitadelsGame.bot_move(state, "p1"), {"type": "choose_draw", "card_id": "new"})

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

    def test_round_recap_reveals_roles_and_waits_for_every_player(self):
        state = CitadelsGame.init_game({}, _players(2))
        state["phase"] = "turn"
        state["active_turn"] = None
        state["players"]["p1"]["chosen_ranks"] = [1, 4]
        state["players"]["p1"]["revealed_ranks"] = [1, 4]
        state["players"]["p2"]["chosen_ranks"] = [2, 7]
        state["players"]["p2"]["revealed_ranks"] = [2]
        state["killed_rank"] = 7
        state["round_actions"] = {
            "p1": [{"type": "ability", "text": "Assassinated 建筑师.", "role_rank": 1}],
            "p2": [{"type": "income", "text": "Took 💰 2 income.", "role_rank": 2}],
        }

        _finish_round(state)

        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["round"], 1)
        summary = state["last_round_summary"]
        self.assertEqual(summary["round"], 1)
        p2_summary = next(row for row in summary["players"] if row["player_id"] == "p2")
        architect = next(role for role in p2_summary["roles"] if role["rank"] == 7)
        self.assertTrue(architect["assassinated"])
        self.assertFalse(architect["acted"])
        self.assertEqual(CitadelsGame.get_legal_actions(state, "p1"), ["next_round"])
        self.assertEqual(CitadelsGame.get_legal_actions(state, "p2"), ["next_round"])

        events, error = CitadelsGame.apply_action(state, "p1", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual([event["type"] for event in events], ["citadels:next_round_ready"])
        self.assertEqual(CitadelsGame.get_legal_actions(state, "p1"), [])

        events, error = CitadelsGame.apply_action(state, "p2", {"type": "next_round"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "draft")
        self.assertEqual(state["round"], 2)
        self.assertIsNone(state["last_round_summary"])
        self.assertEqual(
            [event["type"] for event in events],
            ["citadels:next_round_ready", "citadels:next_round"],
        )

    def test_recap_interactions_record_both_players_for_emphasis(self):
        state = CitadelsGame.init_game({}, _players(2))
        state["phase"] = "turn"
        state["players"]["p1"]["chosen_ranks"] = [1, 2, 3, 8]
        state["players"]["p2"]["chosen_ranks"] = [7]

        state["active_turn"] = {"player_id": "p1", "rank": 1, "step": "main", "ability_used": False}
        self.assertIsNone(_resolve_assassin(state, 7))
        self.assertEqual(state["round_actions"]["p1"][-1]["emphasis"], ["Player 2"])
        self.assertEqual(state["round_actions"]["p2"][-1]["emphasis"], ["Player 1"])

        state["round_actions"] = {"p1": [], "p2": []}
        state["killed_rank"] = None
        state["active_turn"] = {"player_id": "p1", "rank": 2, "step": "main", "ability_used": False}
        self.assertIsNone(_resolve_thief(state, 7))
        _start_role_turn(state, "p2", 7)
        self.assertEqual(state["round_actions"]["p1"][-1]["emphasis"], ["Player 2"])
        self.assertEqual(state["round_actions"]["p2"][-1]["emphasis"], ["Player 1"])

        state["round_actions"] = {"p1": [], "p2": []}
        state["active_turn"] = {"player_id": "p1", "rank": 3, "step": "main", "ability_used": False}
        self.assertIsNone(_resolve_magician_swap(state, "p2"))
        self.assertEqual(state["round_actions"]["p1"][-1]["emphasis"], ["Player 2"])
        self.assertEqual(state["round_actions"]["p2"][-1]["emphasis"], ["Player 1"])

        state["round_actions"] = {"p1": [], "p2": []}
        state["players"]["p1"]["gold"] = 5
        state["players"]["p2"]["city"] = [
            {
                "id": "target_district",
                "name_cn": "兵营",
                "cost": 3,
                "protect_from_warlord": False,
            }
        ]
        state["active_turn"] = {"player_id": "p1", "rank": 8, "step": "main", "ability_used": False}
        self.assertIsNone(_resolve_warlord_destroy(state, "p2", "target_district"))
        self.assertEqual(state["round_actions"]["p1"][-1]["emphasis"], ["Player 2"])
        self.assertEqual(state["round_actions"]["p2"][-1]["emphasis"], ["Player 1"])

    def test_final_round_keeps_role_and_score_recap(self):
        state = CitadelsGame.init_game({"winning_city_size": 7}, _players(2))
        state["phase"] = "turn"
        state["active_turn"] = None
        state["players"]["p1"]["chosen_ranks"] = [4]
        state["players"]["p1"]["revealed_ranks"] = [4]
        state["players"]["p2"]["chosen_ranks"] = [7]
        state["players"]["p2"]["revealed_ranks"] = [7]
        state["players"]["p1"]["city"] = [
            {
                "id": f"final_{index}",
                "name_cn": f"District {index}",
                "name_en": f"District {index}",
                "color": ["blue", "green", "yellow", "red", "purple", "blue", "green"][index],
                "cost": 2,
                "text": "",
                "score_bonus": 0,
                "protect_from_warlord": False,
                "counts_as_any_color": False,
            }
            for index in range(7)
        ]
        state["first_completed_city_player_id"] = "p1"

        _finish_round(state)

        self.assertEqual(state["phase"], "game_over")
        self.assertTrue(state["game_over"])
        self.assertTrue(state["last_round_summary"]["is_final_round"])
        self.assertIn("p1", state["last_round_summary"]["scores"])
        self.assertEqual(state["last_round_summary"]["winner_ids"], state["winner_ids"])

    def test_bot_confirms_round_recap(self):
        players = _players(2)
        players[1]["is_bot"] = True
        state = CitadelsGame.init_game({}, players)
        state["phase"] = "round_end"
        state["next_round_ready"] = []

        action = CitadelsGame.bot_move(state, "p2")

        self.assertEqual(action, {"type": "next_round", "delay_ms": 450})


if __name__ == "__main__":
    unittest.main()
