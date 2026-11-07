import copy
import itertools
import json
import math
import random
import time
import unittest
from unittest.mock import patch

from game.felix import FelixGame as Game, _build_card_set, _cat_score, _resolve_dogs
from game.felix_ai import (
    BIG_DOG, SMALL_DOG, CARD_VALUES, _bag_statistics, _card_value, _knowledge,
    _sack_moments, _sack_score, choose_action,
)


def new_game(count=4, seed=1):
    players = [{"player_id": f"p{seat}", "name": f"Player {seat}", "seat": seat, "is_bot": True}
               for seat in range(count)]
    with patch("game.felix.random", random.Random(seed)):
        return Game.init_game({}, players)


def apply(state, player_id, action):
    events, error = Game.apply_action(state, player_id, action)
    if error:
        raise AssertionError((player_id, action, error))
    return events


def reach_auction(state):
    while state["phase"] == "choose_card":
        player_id = state["current_turn"]
        apply(state, player_id, {"type": "choose_card", "card_id": state["players"][player_id]["hand"][0]["id"]})


def table_state(values, phase="auction", mice=15, bid=0, rewards=(2, 4, 6)):
    state = new_game(len(values))
    state.update(phase=phase, current_turn="p0", start_player="p0", current_bid=bid,
                 active_players=["p0"] if phase == "last_chance" else ["p0", "p1"], table_slots=[])
    state["players"]["p0"]["mice"] = mice
    state["players"]["p1"]["round_bid"] = bid
    for index, value in enumerate(values):
        player_id = f"p{index}"
        cards = _build_card_set(state["players"][player_id]["color"])
        card = next(card for card in cards if _card_value(card) == value)
        state["table_slots"].append({"index": index, "source": "player", "player_id": player_id,
                                     "face_up": True, "card": card})
    for mouse_card, reward in zip(state["mouse_cards"], rewards):
        mouse_card["mice"] = reward
    return state


def final_round_state(values, totals, bid=0, reward=6):
    state = table_state(values, bid=bid, rewards=(0, 0, reward))
    state["round"] = 9
    state["history"] = [
        {"round": number, "result": "no_sale",
         "passes": [{"player_id": owner, "reward": 0} for owner in state["players"]]}
        for number in range(1, 9)
    ]
    for index, total in enumerate(totals):
        remaining = total - 15
        cards = []
        while remaining:
            value = next(value for value in (15, 11, 8, 5, 3, -8, -5)
                         if (0 < value <= remaining) or (remaining <= value < 0))
            cards.append({"kind": "cat", "value": value})
            remaining -= value
        state["history"][index].update(
            result="won", winner=f"p{index}", paid=0, won_cards=cards,
            passes=[{"player_id": owner, "reward": 0} for owner in state["players"] if owner != f"p{index}"],
        )
    return state


class FelixAITests(unittest.TestCase):
    def assert_decision(self, state, player_id=None):
        player_id = player_id or state["current_turn"]
        before = copy.deepcopy(state)
        global_random = random.getstate()
        action = Game.bot_move(state, player_id)
        self.assertEqual(state, before)
        self.assertEqual(random.getstate(), global_random)
        self.assertEqual(action, Game.bot_move(state, player_id))
        self.assertEqual(action, choose_action(Game.get_public_view(state, player_id)))
        self.assertIn(action["type"], Game.get_legal_actions(state, player_id))
        apply(copy.deepcopy(state), player_id, action)
        return action

    def test_scoring_matches_engine_for_all_four_card_sacks(self):
        for values in itertools.product(CARD_VALUES, repeat=4):
            slots = []
            for index, value in enumerate(values):
                card = next(card for card in _build_card_set(str(index)) if _card_value(card) == value)
                slots.append({"index": index, "card": card})
            remaining, _ = _resolve_dogs({"table_slots": slots})
            self.assertEqual(_sack_score(values), _cat_score(remaining), values)

    def test_exact_moments_match_exhaustive_hidden_card_enumeration(self):
        source = random.Random(41)
        cases = [[CARD_VALUES] * count for count in (3, 4, 5)]
        cases.extend([tuple(source.sample(CARD_VALUES, source.randint(1, 4))) for _ in range(5)]
                     for _ in range(30))
        cases.extend([[(value,)] * 4 for value in CARD_VALUES])
        for pools in cases:
            with self.subTest(pools=pools):
                values = [_sack_score(world) for world in itertools.product(*pools)]
                expected_mean = sum(values) / len(values)
                expected_deviation = math.sqrt(sum((value - expected_mean) ** 2 for value in values) / len(values))
                mean, deviation = _bag_statistics(pools)
                self.assertAlmostEqual(mean, expected_mean, places=9)
                self.assertAlmostEqual(deviation, expected_deviation, places=9)

    def test_last_chance_checks_dogs_and_negative_sacks(self):
        cases = [
            ((-8, -5, 0, 0), "pass"),
            ((15, BIG_DOG, -8, 0), "pass"),
            ((15, SMALL_DOG, -8, 0), "buy_for_one"),
            ((15, BIG_DOG, SMALL_DOG, -8), "buy_for_one"),
            ((0, 0, 0, 0), "pass"),
            ((5, 3, 0, 0), "buy_for_one"),
            ((BIG_DOG, -8, -5, 0), "pass"),
        ]
        for values, expected in cases:
            with self.subTest(values=values):
                state = table_state(values, phase="last_chance", rewards=(0, 0, 0))
                self.assertEqual(self.assert_decision(state)["type"], expected)

    def test_cannot_bid_or_buy_without_cash(self):
        for phase in ("auction", "last_chance"):
            state = table_state((15, 15, 15, 15), phase=phase, mice=0)
            self.assertEqual(self.assert_decision(state), {"type": "pass"})

    def test_card_choice_saves_good_cats_when_unable_to_compete(self):
        for count in (3, 4, 5):
            with self.subTest(count=count):
                state = new_game(count, 12)
                state.update(current_turn="p0", start_player="p0", choose_order=state["turn_order"], choose_index=0)
                hand = _build_card_set(state["players"]["p0"]["color"])
                state["players"]["p0"]["hand"] = [card for card in hand if card["base_id"] in ("cat_-8", "cat_15")]
                state["players"]["p0"]["mice"] = 0
                self.assertEqual(self.assert_decision(state)["card_id"], "red_cat_-8")
                state["players"]["p0"]["mice"] = 40
                self.assertEqual(self.assert_decision(state)["card_id"], "red_cat_15")

    def test_large_profitable_sack_is_not_limited_to_one_third_of_cash(self):
        state = table_state((15, 11, 8, 5), bid=8)
        self.assertEqual(self.assert_decision(state), {"type": "bid", "amount": 9})
        state["current_bid"] = 15
        self.assertEqual(self.assert_decision(state), {"type": "pass"})

    def test_pass_reward_is_an_opportunity_cost(self):
        state = table_state((5, 3, 0, 0), bid=2, rewards=(0, 0, 6))
        self.assertEqual(self.assert_decision(state), {"type": "pass"})
        state["mouse_cards"][-1]["mice"] = 0
        self.assertEqual(self.assert_decision(state), {"type": "bid", "amount": 3})

    def test_liquidity_has_value_before_final_round(self):
        state = table_state((5, 3, 0, 0), mice=6, bid=5, rewards=(2, 0, 0))
        self.assertEqual(self.assert_decision(state), {"type": "pass"})
        state["round"] = 9
        self.assertEqual(self.assert_decision(state), {"type": "bid", "amount": 6})

    def test_final_round_passes_profitable_sack_to_preserve_victory(self):
        state = final_round_state((11, 0, 0, 0), (33, 15, 38, 15), bid=6)
        self.assertEqual(self.assert_decision(state), {"type": "pass"})

    def test_final_round_takes_a_chance_when_safe_pass_cannot_win(self):
        state = final_round_state((0, 0, 0, 15), (30, 38, 15, 30), bid=0)
        state["active_players"] = ["p0", "p3"]
        state["table_slots"][3]["face_up"] = False
        state["history"][0]["removed_cards"] = [
            card for card in _build_card_set("purple") if _card_value(card) not in (-8, 15)
        ]
        self.assertEqual(self.assert_decision(state), {"type": "bid", "amount": 1})
        state["round"] = 8
        self.assertEqual(self.assert_decision(state), {"type": "pass"})

    def test_final_round_respects_cat_score_tiebreak(self):
        state = final_round_state((11, -5, 3, 0), (30, 30, 15, 15), bid=2)
        self.assertEqual(self.assert_decision(state), {"type": "bid", "amount": 3})

    def test_final_round_no_bid_does_not_force_rival_to_buy_a_bad_sack(self):
        state = final_round_state((-8, 0, 0, 0), (30, 30, 15, 15), bid=0)
        self.assertEqual(self.assert_decision(state), {"type": "pass"})

    def test_own_face_down_card_is_known_but_not_public(self):
        state = table_state((15, 0, 0, 0), rewards=(0, 0, 0))
        state["table_slots"][0]["face_up"] = False
        own_view = Game.get_public_view(state, "p0")
        self.assertIsNone(own_view["table_slots"][0]["card"])
        self.assertEqual(_card_value(own_view["your_chosen_card"]), 15)
        self.assertNotEqual(Game.get_public_view(state, "p1")["your_chosen_card"], own_view["your_chosen_card"])
        self.assertIsNone(Game.get_public_view(state, "spectator")["your_chosen_card"])
        self.assertEqual(self.assert_decision(state)["type"], "bid")
        state["table_slots"][0]["card"] = _build_card_set("red")[0]
        self.assertEqual(self.assert_decision(state), {"type": "pass"})

    def test_hidden_state_does_not_change_decisions(self):
        for count in (3, 4, 5):
            state = new_game(count)
            first_player = state["current_turn"]
            apply(state, first_player, {"type": "choose_card", "card_id": state["players"][first_player]["hand"][0]["id"]})
            for phase in ("choose_card", "auction"):
                if phase == "auction":
                    reach_auction(state)
                player_id = state["current_turn"]
                altered = copy.deepcopy(state)
                for owner, player in altered["players"].items():
                    if owner != player_id:
                        player["hand"] = list(reversed(_build_card_set(player["color"])[:len(player["hand"])]))
                        player["mice"] = 999
                        player["chosen_card_id"] = "hidden-choice"
                        player["won_cards"] = [dict(card, value=-8) for card in player["won_cards"]]
                altered["removed_cards"] = []
                altered["dummy_deck"].reverse()
                for slot in altered["table_slots"]:
                    if not slot["face_up"] and slot["player_id"] != player_id:
                        slot["card"] = _build_card_set("hidden")[-1]
                with self.subTest(count=count, phase=phase):
                    self.assertEqual(Game.get_public_view(state, player_id), Game.get_public_view(altered, player_id))
                    self.assertEqual(Game.bot_move(state, player_id), Game.bot_move(altered, player_id))
                    self.assert_decision(state, player_id)

    def test_only_completed_public_rounds_are_remembered(self):
        for count in (3, 4, 5):
            state = new_game(count)
            removed_at_setup = {card["id"] for card in state["removed_cards"]}
            self.assertEqual(Game.get_public_view(state, "p0")["history"], [])
            pools, _, _, complete = _knowledge(Game.get_public_view(state, "p0"))
            self.assertTrue(complete)
            self.assertTrue(all(pool == CARD_VALUES for pool in pools.values()))
            reach_auction(state)
            played = {slot["card"]["id"] for slot in state["table_slots"]}
            first_player = state["current_turn"]
            apply(state, first_player, {"type": "bid", "amount": 1})
            while state["phase"] == "auction":
                self.assertEqual(Game.get_public_view(state, "p0")["history"], [])
                apply(state, state["current_turn"], {"type": "pass"})
            view = Game.get_public_view(state, "p0")
            self.assertEqual(len(view["history"]), 1)
            result = view["history"][0]
            self.assertEqual(result, view["last_round_summary"])
            revealed = result["won_cards"] + result["removed_cards"]
            self.assertEqual({card["id"] for card in revealed}, played)
            self.assertTrue(removed_at_setup.isdisjoint(card["id"] for card in revealed))
            self.assertEqual(len(result["passes"]), count - 1)
            result["passes"][0]["reward"] = 999
            revealed[0]["value"] = 999
            view["last_round_summary"]["paid"] = 999
            self.assertNotEqual(view["history"], Game.get_public_view(state, "p0")["history"])
            self.assertEqual(state["last_round_summary"]["paid"], 1)
            for player_id in state["turn_order"]:
                apply(state, player_id, {"type": "next_round"})
            pools, cash, scores, complete = _knowledge(Game.get_public_view(state, "p0"))
            self.assertTrue(complete)
            self.assertEqual(state["round_passes"], [])
            for player_id, player in state["players"].items():
                self.assertEqual(cash[player_id], player["mice"])
                self.assertEqual(scores[player_id], _cat_score(player["won_cards"]))
            for card in state["history"][0]["won_cards"] + state["history"][0]["removed_cards"]:
                owner = next((player_id for player_id, player in state["players"].items()
                              if player["color"] == card["color"]), None)
                self.assertNotIn(_card_value(card), pools[owner])

    def test_no_sale_history_and_current_passes_reconstruct_cash(self):
        state = new_game(3)
        reach_auction(state)
        while state["phase"] in ("auction", "last_chance"):
            apply(state, state["current_turn"], {"type": "pass"})
            if state["phase"] == "auction":
                _, cash, _, _ = _knowledge(Game.get_public_view(state, state["current_turn"]))
                self.assertEqual(cash, {owner: player["mice"] for owner, player in state["players"].items()})
        self.assertEqual(state["history"], [state["last_round_summary"]])
        self.assertEqual(state["history"][0]["result"], "no_sale")
        self.assertEqual(len(state["history"][0]["removed_cards"]), 4)
        for player_id in state["turn_order"]:
            apply(state, player_id, {"type": "next_round"})
        self.assertEqual([card["mice"] for card in state["mouse_cards"]], [0, 0])
        self.assert_decision(state)

    def test_old_saves_without_history_remain_playable(self):
        state = new_game()
        state.pop("history")
        state.pop("round_passes")
        state["round"] = 4
        self.assert_decision(state)
        reach_auction(state)
        self.assert_decision(state)
        self.assertFalse(_knowledge(Game.get_public_view(state, state["current_turn"]))[-1])

    def test_old_first_round_without_pass_records_uses_estimates(self):
        state = new_game()
        reach_auction(state)
        apply(state, state["current_turn"], {"type": "pass"})
        state.pop("round_passes")
        self.assertFalse(_knowledge(Game.get_public_view(state, state["current_turn"]))[-1])
        self.assert_decision(state)
        while state["phase"] in ("auction", "last_chance"):
            apply(state, state["current_turn"], {"type": "pass"})
        for player_id in state["turn_order"]:
            apply(state, player_id, {"type": "next_round"})
        self.assertFalse(_knowledge(Game.get_public_view(state, state["current_turn"]))[-1])
        self.assert_decision(state)

    def test_non_actor_and_game_over_have_no_move(self):
        state = new_game()
        other = next(owner for owner in state["players"] if owner != state["current_turn"])
        self.assertIsNone(Game.bot_move(state, other))
        self.assertIsNone(Game.bot_move(state, "spectator"))
        state["game_over"] = True
        self.assertIsNone(Game.bot_move(state, state["current_turn"]))

    def test_complete_games_are_legal_and_history_survives_serialization(self):
        for count in (3, 4, 5):
            for seed in (14, 25):
                with self.subTest(count=count, seed=seed):
                    state = new_game(count, seed)
                    for _ in range(1500):
                        if state["game_over"]:
                            break
                        player_id = next(owner for owner in state["turn_order"] if Game.get_legal_actions(state, owner))
                        apply(state, player_id, self.assert_decision(state, player_id))
                    self.assertTrue(state["game_over"])
                    self.assertEqual(len(state["history"]), 9)
                    self.assertTrue(state["winner"])
                    self.assertTrue(all(player["mice"] >= 0 for player in state["players"].values()))
                    self.assertEqual(Game.deserialize(json.loads(json.dumps(Game.serialize(state)))), state)

    def test_representative_choices_have_bounded_latency(self):
        _sack_moments.cache_clear()
        for count in (3, 4, 5):
            state = new_game(count, 62)
            started = time.perf_counter()
            action = Game.bot_move(state, state["current_turn"])
            self.assertLess(time.perf_counter() - started, 0.5)
            self.assertEqual(action["type"], "choose_card")


if __name__ == "__main__":
    unittest.main()
