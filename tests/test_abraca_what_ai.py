import copy
import random
import unittest
from itertools import combinations
from math import comb
from unittest.mock import patch

from game.abraca_what import AbracaWhatGame as Game, CARD_TO_SPELL, SPELL_COUNTS
from game.abraca_what_ai import _TurnPlanner, choose_action


def make_view(unseen, hand_size=1, health=(6, 6, 6), can_stop=False, minimum=0, secret_pool=0):
    return {
        "you": "p0",
        "current_turn": "p0",
        "phase": "wait_goon" if can_stop else "wait_use",
        "game_over": False,
        "players": [
            {
                "player_id": f"p{index}",
                "hp": hp,
                "score": 0,
                "secret_count": 0,
                "hand": [{"hidden": True} for _ in range(hand_size)] if index == 0 else [],
                **({"secret_cards": []} if index == 0 else {}),
            }
            for index, hp in enumerate(health)
        ],
        "discard_counts": [total - unseen.get(spell, 0) for spell, total in enumerate(SPELL_COUNTS)],
        "deck_count": max(0, sum(unseen.values()) - hand_size - secret_pool),
        "secret_pool_count": secret_pool,
        "turn_spells": [],
        "last_action": None,
        "legal_actions": ["cast_spell", "end_turn"] if can_stop else ["cast_spell"],
        "allowed_spells": list(range(minimum, len(SPELL_COUNTS))),
        "config": {"target_score": 8},
    }


def make_state(player_count=3):
    with patch("game.abraca_what._build_deck", return_value=list(range(len(CARD_TO_SPELL)))):
        return Game.init_game({}, [
            {"player_id": f"p{index}", "seat": index, "is_bot": True}
            for index in range(player_count)
        ])


class AbracaWhatAiTests(unittest.TestCase):
    def test_card_counting_uses_only_visible_cards_and_own_secrets(self):
        state = make_state()
        state["players"]["p0"]["secret_cards"].append(state["secret_pool"].pop())
        state["players"]["p1"]["secret_cards"].append(state["secret_pool"].pop())
        state["discard"].append(state["deck"].pop())
        planner = _TurnPlanner(Game.get_public_view(state, "p0"), SPELL_COUNTS)
        hidden = state["deck"] + state["secret_pool"] + state["players"]["p0"]["hand"]
        hidden += state["players"]["p1"]["secret_cards"]
        self.assertEqual(planner.unseen, tuple(
            sum(CARD_TO_SPELL[card] == spell for card in hidden) for spell in range(8)
        ))

    def test_first_cast_probability_is_hypergeometric(self):
        planner = _TurnPlanner(make_view({5: 2, 6: 3, 7: 3}, hand_size=3), SPELL_COUNTS)
        required = (0, 0, 0, 0, 0, 0, 0, 1)
        self.assertAlmostEqual(
            planner._weight(required) / planner._weight(planner.initial_casts),
            1 - comb(5, 3) / comb(8, 3),
        )

    def test_repeated_cast_conditions_on_previous_success(self):
        view = make_view({5: 2, 6: 3, 7: 2}, hand_size=2, can_stop=True, minimum=7)
        view["turn_spells"] = [7]
        planner = _TurnPlanner(view, SPELL_COUNTS)
        required = (0, 0, 0, 0, 0, 0, 0, 2)
        self.assertAlmostEqual(planner._weight(required) / planner._weight(planner.initial_casts), 16 / 46)
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "end_turn"})

    def test_multiple_successes_match_enumerated_hidden_hands(self):
        view = make_view({0: 1, 1: 1, 2: 2, 3: 4}, hand_size=2, can_stop=True, minimum=2)
        view["turn_spells"] = [1, 2]
        planner = _TurnPlanner(view, SPELL_COUNTS)
        pool = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3]
        hands = [hand for hand in combinations(pool, 4) if hand.count(1) >= 1 and hand.count(2) >= 1]
        for spell in range(2, 8):
            required = list(planner.initial_casts)
            required[spell] += 1
            expected = sum(hand.count(spell) >= required[spell] for hand in hands) / len(hands)
            self.assertAlmostEqual(planner._weight(tuple(required)) / planner._weight(planner.initial_casts), expected)

    def test_legacy_save_can_use_last_success_without_turn_history(self):
        view = make_view({5: 2, 6: 3, 7: 2}, hand_size=2, can_stop=True, minimum=7)
        view.pop("turn_spells")
        view["last_action"] = {"player_id": "p0", "spell_type": 7, "success": True}
        planner = _TurnPlanner(view, SPELL_COUNTS)
        self.assertEqual(planner.initial_casts[-1], 1)
        self.assertEqual(planner.hand_size, 3)

    def test_forced_cast_avoids_impossible_spells(self):
        self.assertEqual(choose_action(make_view({7: 8}, hand_size=5), SPELL_COUNTS), {
            "type": "cast_spell", "spell_type": 7,
        })

    def test_stop_instead_of_guessing_an_exhausted_spell(self):
        view = make_view({5: 3}, hand_size=2, can_stop=True, minimum=6)
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "end_turn"})

    def test_continues_guaranteed_chain_in_ascending_order(self):
        view = make_view({5: 1, 6: 1, 7: 1}, hand_size=3, can_stop=True, minimum=5)
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "cast_spell", "spell_type": 5})

    def test_prefers_lethal_right_neighbor_spell_over_healing(self):
        view = make_view({6: 1, 7: 1}, hand_size=2, health=(4, 1, 6))
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "cast_spell", "spell_type": 6})

    def test_recognizes_left_neighbor_target(self):
        view = make_view({5: 1, 6: 1}, hand_size=2, health=(6, 6, 1))
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "cast_spell", "spell_type": 5})

    def test_two_player_lightning_damages_opponent_only_once(self):
        planner = _TurnPlanner(make_view({4: 1, 7: 1}, hand_size=2, health=(6, 2)), SPELL_COUNTS)
        required = (0, 0, 0, 0, 1, 0, 0, 0)
        with patch.object(planner, "_search", return_value=0.0) as search:
            planner._success_value(4, required, planner.health)
        search.assert_called_once_with(required, (6, 1), 4)

    def test_low_health_prefers_certain_healing_to_risky_dragon(self):
        view = make_view({0: 1, 7: 8}, hand_size=3, health=(1, 6, 6), can_stop=True)
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "cast_spell", "spell_type": 7})

    def test_owl_collects_secret_before_emptying_hand(self):
        view = make_view({3: 4, 7: 1}, hand_size=4, secret_pool=1)
        self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": "cast_spell", "spell_type": 3})

    def test_round_evaluation_uses_secret_bonus_and_gain_tiebreak(self):
        view = make_view({6: 1}, health=(6, 1, 6))
        view["players"][0].update(score=5, secret_count=1)
        view["players"][2].update(score=7, secret_count=4)
        planner = _TurnPlanner(view, SPELL_COUNTS)
        self.assertLess(planner._round_value("kill", (0,) * 8, (6, 0, 6)), -20)
        view["players"][2]["secret_count"] = 0
        planner = _TurnPlanner(view, SPELL_COUNTS)
        self.assertGreater(planner._round_value("kill", (0,) * 8, (6, 0, 6)), 20)

    def test_forced_phase_actions(self):
        for phase, action_type in (
            ("wait_dice", "roll_dice"),
            ("wait_see", "take_secret"),
            ("wait_draw", "end_turn"),
            ("round_end", "start_next_round"),
        ):
            with self.subTest(phase=phase):
                view = make_view({7: 1})
                view.update(phase=phase, legal_actions=[action_type], allowed_spells=[])
                self.assertEqual(choose_action(view, SPELL_COUNTS), {"type": action_type})

    def test_no_action_for_other_player_spectator_or_finished_game(self):
        state = make_state()
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "spectator"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, "p0"))

    def test_hidden_card_permutations_do_not_change_decisions(self):
        state = make_state()
        state["players"]["p1"]["secret_cards"].append(state["secret_pool"].pop())
        view = Game.get_public_view(state, "p0")
        action = Game.bot_move(state, "p0")
        rng = random.Random(98)
        for _ in range(12):
            variant = copy.deepcopy(state)
            zones = [variant["players"]["p0"]["hand"], variant["deck"], variant["secret_pool"],
                     variant["players"]["p1"]["secret_cards"]]
            cards = [card for zone in zones for card in zone]
            rng.shuffle(cards)
            offset = 0
            for zone in zones:
                length = len(zone)
                zone[:] = cards[offset:offset + length]
                offset += length
            self.assertEqual(Game.get_public_view(variant, "p0"), view)
            self.assertEqual(Game.bot_move(variant, "p0"), action)

    def test_search_does_not_mutate_state_or_random_generator(self):
        state = make_state()
        original = copy.deepcopy(state)
        random_state = random.getstate()
        action = Game.bot_move(state, "p0")
        self.assertEqual(Game.bot_move(state, "p0"), action)
        self.assertEqual(state, original)
        self.assertEqual(random.getstate(), random_state)

    def test_public_turn_history_records_success_and_resets(self):
        state = make_state()
        for spell in (3, 3):
            self.assertIsNone(Game.apply_action(state, "p0", {"type": "cast_spell", "spell_type": spell})[1])
            self.assertIsNone(Game.apply_action(state, "p0", {"type": "take_secret"})[1])
        view = Game.get_public_view(state, "p0")
        self.assertEqual(view["turn_spells"], [3, 3])
        view["turn_spells"].append(7)
        self.assertEqual(state["turn_spells"], [3, 3])
        self.assertIsNone(Game.apply_action(state, "p0", {"type": "end_turn"})[1])
        self.assertEqual(state["turn_spells"], [])

    def test_miscast_does_not_add_successful_turn_history(self):
        state = make_state()
        for action in (
            {"type": "cast_spell", "spell_type": 3},
            {"type": "take_secret"},
            {"type": "cast_spell", "spell_type": 7},
        ):
            self.assertIsNone(Game.apply_action(state, "p0", action)[1])
        self.assertEqual(state["phase"], "wait_draw")
        self.assertEqual(state["turn_spells"], [3])

    def test_round_end_and_new_round_clear_turn_history(self):
        state = make_state()
        for _ in range(4):
            self.assertIsNone(Game.apply_action(state, "p0", {"type": "cast_spell", "spell_type": 3})[1])
            self.assertIsNone(Game.apply_action(state, "p0", {"type": "take_secret"})[1])
        self.assertIsNone(Game.apply_action(state, "p0", {"type": "cast_spell", "spell_type": 4})[1])
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["turn_spells"], [])
        self.assertIsNone(Game.apply_action(state, "p0", {"type": "start_next_round"})[1])
        self.assertEqual(state["round"], 2)
        self.assertEqual(Game.get_public_view(state, "p1")["turn_spells"], [])

    def test_bots_finish_seeded_games_with_two_to_five_players(self):
        random_state = random.getstate()
        try:
            for player_count in range(2, 6):
                for seed in range(3):
                    with self.subTest(players=player_count, seed=seed):
                        random.seed(seed)
                        state = Game.init_game({}, [
                            {"player_id": f"p{index}", "seat": index, "is_bot": True}
                            for index in range(player_count)
                        ])
                        for _ in range(1500):
                            if state["game_over"]:
                                break
                            player_id = state["current_turn"]
                            action = Game.bot_move(state, player_id)
                            self.assertIsNotNone(action)
                            self.assertIn(action["type"], Game._legal_actions(state, player_id))
                            if action["type"] == "cast_spell":
                                self.assertIn(action["spell_type"], Game._allowed_spells(state, player_id))
                            self.assertIsNone(Game.apply_action(state, player_id, action)[1])
                        self.assertTrue(state["game_over"])
                        self.assertTrue(state["winner"])
        finally:
            random.setstate(random_state)


if __name__ == "__main__":
    unittest.main()
