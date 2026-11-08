import copy
import random
import unittest
from collections import Counter
from itertools import combinations
from math import comb

from game.ai_metadata import STRATEGIC_AI_GAME_IDS
from game.celestia import CelestiaGame as Game, EQUIPMENT_FOR_HAZARD, _hazard_counts_from_dice
from game.celestia_ai import _cover_probability, _dice_outcomes, choose_action


def _hand(*kinds):
    return [
        {
            "id": f"card_{index}",
            "kind": kind,
            "category": "equipment" if kind in EQUIPMENT_FOR_HAZARD.values() else "wild" if kind == "turbo" else "power",
        }
        for index, kind in enumerate(kinds)
    ]


def _state(phase="passenger_choice", city=4, dice=("blank", "blank"), hand=(), count=3):
    state = Game.init_game({}, [dict(player_id=f"p{index + 1}", name=f"Player {index + 1}", seat=index) for index in range(count)])
    state.update(phase=phase, current_city=city, captain="p1", pending_passenger="p2", dice_results=list(dice))
    state["hazard_counts"] = _hazard_counts_from_dice(list(dice))
    for player in state["players"].values():
        player["hand"] = []
        player["treasures"] = []
    state["players"]["p1"]["hand"] = _hand(*hand)
    return state


def _telescope():
    return {"id": "telescope", "kind": "telescope", "points": 0, "city": 1}


class CelestiaAiTests(unittest.TestCase):
    def setUp(self):
        self.addCleanup(random.setstate, random.getstate())
        random.seed(74)

    def test_catalog_marks_the_policy_as_strategic(self):
        self.assertIn(Game.game_id, STRATEGIC_AI_GAME_IDS)

    def test_dice_distribution_includes_both_blank_faces(self):
        for count in range(5):
            with self.subTest(dice=count):
                outcomes = dict(_dice_outcomes(count))
                self.assertAlmostEqual(sum(outcomes.values()), 1.0)
                self.assertAlmostEqual(outcomes[(0, 0, 0, 0)], (1 / 3) ** count)
                self.assertAlmostEqual(sum(sum(hazards) * chance for hazards, chance in outcomes.items()), count * 2 / 3)

    def test_cover_probability_matches_exhaustive_hands_without_replacement(self):
        population = (2, 1, 1, 1, 1, 1)
        deck = [kind for kind, count in enumerate(population) for _ in range(count)]
        for size in range(len(deck) + 1):
            for hazards in ((0, 0, 0, 0), (1, 0, 0, 0), (2, 1, 0, 0), (1, 1, 1, 1), (0, 0, 0, 3)):
                with self.subTest(size=size, hazards=hazards):
                    successful = 0
                    for indexes in combinations(range(len(deck)), size):
                        counts = Counter(deck[index] for index in indexes)
                        missing = sum(max(0, need - counts[kind]) for kind, need in enumerate(hazards))
                        successful += missing <= counts[4]
                    expected = successful / comb(len(deck), size)
                    self.assertAlmostEqual(_cover_probability(hazards, size, population), expected)

    def test_passenger_stays_on_safe_late_leg_with_equipment_for_next_captaincy(self):
        state = _state(city=5, dice=("blank",) * 3)
        state["players"]["p2"]["hand"] = _hand("compass", "lightning_rod", "foghorn", "cannon", "turbo", "turbo", "turbo")
        self.assertEqual(Game.bot_move(state, "p2"), {"type": "passenger_choice", "choice": "stay"})

    def test_passenger_leaves_when_empty_captain_cannot_cover_hazards(self):
        state = _state(dice=("pirate", "cloud"))
        self.assertEqual(Game.bot_move(state, "p2"), {"type": "passenger_choice", "choice": "leave"})

    def test_passenger_accounts_for_public_captain_hand_size(self):
        state = _state(city=8, dice=("pirate", "pirate"))
        self.assertEqual(Game.bot_move(state, "p2")["choice"], "leave")
        state["players"]["p1"]["hand"] = _hand(*(["compass"] * 20))
        self.assertEqual(Game.bot_move(state, "p2")["choice"], "stay")

    def test_passenger_leaves_when_final_city_will_run_out_before_their_seat(self):
        state = _state(city=8, dice=("blank",) * 4)
        state["treasure_decks"][9] = state["treasure_decks"][9][:1]
        self.assertEqual(Game.bot_move(state, "p2")["choice"], "leave")

    def test_passenger_does_not_bank_an_empty_city(self):
        state = _state(city=8, dice=("pirate", "pirate"))
        state["treasure_decks"][8] = []
        state["players"]["p1"]["hand"] = _hand("compass", "compass", "compass", "compass")
        self.assertEqual(Game.bot_move(state, "p2")["choice"], "stay")

    def test_solo_captain_banks_with_empty_hand_before_city_five(self):
        state = _state(phase="roll", city=2)
        for player_id in ("p2", "p3"):
            state["players"][player_id]["on_ship"] = False
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "solo_leave"})

    def test_solo_captain_continues_with_strong_hand_after_city_five(self):
        state = _state(phase="roll", city=5, hand=("compass", "lightning_rod", "foghorn", "cannon", "turbo", "turbo"))
        for player_id in ("p2", "p3"):
            state["players"][player_id]["on_ship"] = False
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "roll_dice"})

    def test_captain_must_spend_normal_equipment_before_telescope_or_failure(self):
        state = _state(phase="captain_action", city=1, dice=("cloud", "blank"), hand=("compass", "turbo"))
        state["players"]["p1"]["treasures"] = [_telescope()]
        action = Game.bot_move(state, "p1")
        self.assertEqual(action, {"type": "captain_resolve", "method": "cards"})
        self.assertIsNone(Game.apply_action(state, "p1", action)[1])
        self.assertEqual([card["kind"] for card in state["players"]["p1"]["hand"]], ["turbo"])
        self.assertEqual(state["players"]["p1"]["treasures"], [_telescope()])

    def test_captain_preserves_multiple_turbos_on_unprofitable_early_leg(self):
        state = _state(phase="captain_action", city=1, dice=("cloud", "cloud"), hand=("turbo", "turbo"))
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "captain_fail"})

    def test_captain_uses_telescope_instead_of_multiple_turbos(self):
        state = _state(phase="captain_action", city=5, dice=("cloud", "cloud"), hand=("turbo", "turbo"))
        state["players"]["p1"]["treasures"] = [_telescope()]
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "captain_resolve", "method": "telescope", "treasure_id": "telescope"})

    def test_captain_uses_one_turbo_instead_of_telescope(self):
        state = _state(phase="captain_action", city=8, dice=("cloud", "blank", "blank", "blank"), hand=("turbo",))
        state["players"]["p1"]["treasures"] = [_telescope()]
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "captain_resolve", "method": "cards"})

    def test_captain_uses_telescope_when_equipment_is_insufficient(self):
        state = _state(phase="captain_action", city=8, dice=("pirate",) * 4)
        state["players"]["p1"]["treasures"] = [_telescope()]
        self.assertEqual(Game.bot_move(state, "p1")["method"], "telescope")

    def test_alternative_route_rerolls_only_uncovered_dice(self):
        state = _state(phase="reroll_window", dice=("pirate", "cloud"), hand=("compass", "alternative_route"))
        action = Game.bot_move(state, "p1")
        self.assertEqual(action, {"type": "play_power", "card_id": "card_1", "dice_indexes": [0]})
        self.assertIsNone(Game.apply_action(state, "p1", action)[1])

    def test_alternative_route_handles_duplicate_hazards(self):
        state = _state(phase="reroll_window", dice=("cloud", "cloud"), hand=("compass", "alternative_route"))
        self.assertEqual(Game.bot_move(state, "p1")["dice_indexes"], [0])

    def test_captain_does_not_waste_reroll_cards_on_a_safe_flight(self):
        state = _state(phase="reroll_window", hand=("alternative_route", "wind_gust"))
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "pass_special"})

    def test_wind_gust_can_deny_rivals_final_city_treasure(self):
        state = _state(phase="reroll_window", city=8, dice=("blank",) * 4, count=2)
        state["players"]["p2"]["hand"] = _hand("wind_gust")
        self.assertEqual(Game.bot_move(state, "p2"), {"type": "play_power", "card_id": "card_0"})

    def test_ejection_can_rescue_its_owner_from_a_doomed_flight(self):
        state = _state(phase="ejection_window", dice=("pirate", "pirate"))
        state["players"]["p2"]["hand"] = _hand("ejection")
        action = Game.bot_move(state, "p2")
        self.assertEqual(action, {"type": "play_power", "card_id": "card_0", "target_player_id": "p2"})
        self.assertIsNone(Game.apply_action(state, "p2", action)[1])
        self.assertFalse(state["players"]["p2"]["on_ship"])
        self.assertEqual(len(state["players"]["p2"]["treasures"]), 1)

    def test_captain_does_not_eject_and_reward_a_rival_before_certain_crash(self):
        state = _state(phase="ejection_window", dice=("pirate", "pirate"), hand=("ejection",))
        self.assertEqual(Game.bot_move(state, "p1"), {"type": "pass_special"})

    def test_ejection_can_deny_a_rival_the_final_city(self):
        state = _state(phase="ejection_window", city=8, dice=("blank",) * 4, hand=("ejection",))
        action = Game.bot_move(state, "p1")
        self.assertEqual(action["type"], "play_power")
        self.assertIn(action["target_player_id"], ("p2", "p3"))

    def test_jetpack_compares_treasure_with_reserve_value(self):
        for city, expected in ((1, False), (2, True), (5, True)):
            with self.subTest(city=city):
                state = _state(phase="jetpack_window", city=city, hand=("jetpack",))
                state["jetpack_pending"] = ["p1"]
                self.assertEqual(Game.bot_move(state, "p1"), {"type": "jetpack_decision", "use": expected})

    def test_jetpack_is_saved_when_city_has_no_treasure(self):
        state = _state(phase="jetpack_window", city=5, hand=("jetpack",))
        state["jetpack_pending"] = ["p1"]
        state["treasure_decks"][5] = []
        self.assertFalse(Game.bot_move(state, "p1")["use"])

    def test_jetpack_can_secure_target_score_even_in_first_city(self):
        state = _state(phase="jetpack_window", city=1, hand=("jetpack",))
        state["jetpack_pending"] = ["p1"]
        state["players"]["p1"]["treasures"] = [{"id": "score", "city": 7, "kind": "points", "points": 49}]
        self.assertTrue(Game.bot_move(state, "p1")["use"])

    def test_hidden_hands_scores_and_deck_order_do_not_change_decisions(self):
        for phase in ("passenger_choice", "reroll_window", "ejection_window", "captain_action"):
            with self.subTest(phase=phase):
                state = _state(phase=phase, city=8, dice=("pirate", "blank", "blank", "blank"), hand=("turbo", "ejection", "alternative_route"))
                state["players"]["p2"]["hand"] = _hand("compass", "wind_gust", "ejection")
                state["players"]["p3"]["hand"] = _hand("foghorn", "foghorn", "foghorn")
                for player_id in state["turn_order"]:
                    state["players"][player_id]["treasures"] = [{"id": player_id, "city": 2, "kind": "points", "points": 3}]
                bot_id = "p2" if phase == "passenger_choice" else "p1"
                altered = copy.deepcopy(state)
                altered["action_deck"].reverse()
                altered["action_discard"] = _hand("cannon", "turbo", "jetpack")
                for deck in altered["treasure_decks"].values():
                    deck.reverse()
                for player_id, player in altered["players"].items():
                    if player_id != bot_id:
                        player["hand"] = _hand(*(["cannon"] * len(player["hand"])))
                        player["treasures"][0]["points"] = 99
                self.assertEqual(Game.get_public_view(state, bot_id), Game.get_public_view(altered, bot_id))
                self.assertEqual(Game.bot_move(state, bot_id), Game.bot_move(altered, bot_id))

    def test_decisions_are_deterministic_and_preserve_state_and_game_rng(self):
        for phase in ("roll", "reroll_window", "ejection_window", "captain_action"):
            with self.subTest(phase=phase):
                state = _state(phase=phase, dice=("pirate", "cloud"), hand=("compass", "turbo", "ejection", "alternative_route", "wind_gust"))
                before = copy.deepcopy(state)
                rng_before = random.getstate()
                first = Game.bot_move(state, "p1")
                self.assertEqual(first, Game.bot_move(state, "p1"))
                self.assertEqual(state, before)
                self.assertEqual(random.getstate(), rng_before)

    def test_inactive_unknown_finished_or_already_ready_players_do_not_act(self):
        state = _state(phase="roll")
        self.assertIsNone(Game.bot_move(state, "missing"))
        self.assertIsNone(Game.bot_move(state, "p2"))
        state.update(phase="journey_end", next_ready=["p1"])
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertEqual(Game.bot_move(state, "p2"), {"type": "next_journey"})
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p2"))
        self.assertIsNone(choose_action({"legal_actions": []}))

    def test_all_player_counts_finish_with_legal_actions(self):
        for count in range(2, 7):
            for seed in (74, 1820):
                with self.subTest(players=count, seed=seed):
                    random.seed(seed + count)
                    players = [dict(player_id=f"p{index + 1}", name=f"Player {index + 1}", seat=index) for index in range(count)]
                    state = Game.init_game({}, players)
                    for step in range(3000):
                        if state["game_over"]:
                            break
                        for player_id in state["turn_order"]:
                            action = Game.bot_move(state, player_id)
                            if action:
                                self.assertIn(action["type"], Game.get_legal_actions(state, player_id))
                                _, error = Game.apply_action(state, player_id, action)
                                self.assertIsNone(error, (step, state["phase"], player_id, action))
                                break
                        else:
                            self.fail(f"Bots stalled in {state['phase']}")
                    self.assertTrue(state["game_over"])
                    self.assertTrue(state["winner"])


if __name__ == "__main__":
    unittest.main()
