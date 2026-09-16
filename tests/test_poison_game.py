import copy
import unittest
from collections import Counter

from game.poison import (
    CAULDRON_LIMIT,
    EXPECTED_CARD_IDS,
    POTION_COLORS,
    PoisonGame,
    _all_cards_in_state,
    _assert_card_conservation,
    _build_deck,
    _derive_cauldron_color,
    _finish_round,
    _legal_cauldron_indices,
    _resolve_play,
    _score_round,
)


def make_players(count=3, bot_ids=None):
    bots = set(bot_ids or [])
    return [
        {
            "player_id": f"p{index}",
            "name": f"Player {index}",
            "seat": index,
            "is_bot": f"p{index}" in bots,
        }
        for index in range(count)
    ]


def card(card_id):
    return next(item for item in _build_deck() if item["id"] == card_id)


def rig_state(state, hands=None, cauldrons=None, captured=None, removed=None, current_turn="p0"):
    all_cards = {item["id"]: item for item in _all_cards_in_state(state)}
    self_used = set()

    def claim(card_ids):
        result = []
        for card_id in card_ids or []:
            if card_id in self_used:
                raise AssertionError(f"card used twice in fixture: {card_id}")
            self_used.add(card_id)
            result.append(all_cards[card_id])
        return result

    for pdata in state["players"].values():
        pdata["hand"] = []
        pdata["captured"] = []
        pdata["round_score"] = None
        pdata["round_breakdown"] = None
    state["cauldrons"] = [{"cards": []}, {"cards": []}, {"cards": []}]
    state["removed_hand"] = []

    for player_id, card_ids in (hands or {}).items():
        state["players"][player_id]["hand"] = claim(card_ids)
    for player_id, card_ids in (captured or {}).items():
        state["players"][player_id]["captured"] = claim(card_ids)
    for index, card_ids in enumerate(cauldrons or []):
        state["cauldrons"][index]["cards"] = claim(card_ids)
    state["removed_hand"] = claim(removed or [])

    remaining = [item for card_id, item in all_cards.items() if card_id not in self_used]
    sink = next((pid for pid in state["turn_order"] if pid != current_turn), current_turn)
    state["players"][sink]["hand"].extend(remaining)
    state["phase"] = "playing"
    state["game_over"] = False
    state["current_turn"] = current_turn
    state["round_summary"] = None
    state["next_round_ready"] = []
    state["rematch_ready"] = []
    _assert_card_conservation(state)
    return state


class PoisonDeckTests(unittest.TestCase):
    def test_card_catalog_is_exact(self):
        deck = _build_deck()
        self.assertEqual(len(deck), 50)
        self.assertEqual(len({item["id"] for item in deck}), 50)
        self.assertEqual({item["id"] for item in deck}, EXPECTED_CARD_IDS)

        for color in POTION_COLORS:
            cards = [item for item in deck if item["color"] == color]
            self.assertEqual(len(cards), 14)
            self.assertEqual(Counter(item["value"] for item in cards), {1: 3, 2: 3, 4: 2, 5: 3, 7: 3})
        poison_cards = [item for item in deck if item["kind"] == "poison"]
        self.assertEqual(len(poison_cards), 8)
        self.assertEqual({item["value"] for item in poison_cards}, {4})

    def test_player_limits_are_enforced(self):
        with self.assertRaisesRegex(ValueError, "3 to 6"):
            PoisonGame.init_game({"seed": 1}, make_players(2))
        with self.assertRaisesRegex(ValueError, "3 to 6"):
            PoisonGame.init_game({"seed": 1}, make_players(7))

    def test_deal_counts_for_every_player_count(self):
        expected = {
            3: ([12, 13, 13], 12),
            4: ([12, 12, 13, 13], 0),
            5: ([10, 10, 10, 10, 10], 0),
            6: ([8, 8, 8, 8, 9, 9], 0),
        }
        for count, (hand_counts, removed_count) in expected.items():
            with self.subTest(players=count):
                state = PoisonGame.init_game({"seed": "deal-test"}, make_players(count))
                self.assertEqual(sorted(len(pdata["hand"]) for pdata in state["players"].values()), hand_counts)
                self.assertEqual(len(state["removed_hand"]), removed_count)
                self.assertEqual(state["start_player_id"], state["current_turn"])
                self.assertEqual(state["start_player_id"], state["turn_order"][(state["turn_order"].index(state["dealer_id"]) + 1) % count])
                _assert_card_conservation(state)

    def test_seed_makes_setup_deterministic(self):
        first = PoisonGame.init_game({"seed": "same"}, make_players(4))
        second = PoisonGame.init_game({"seed": "same"}, make_players(4))
        self.assertEqual(first["dealer_id"], second["dealer_id"])
        for player_id in first["turn_order"]:
            self.assertEqual(
                [card["id"] for card in first["players"][player_id]["hand"]],
                [card["id"] for card in second["players"][player_id]["hand"]],
            )


class PoisonRuleTests(unittest.TestCase):
    def test_cauldron_color_ignores_poison(self):
        self.assertIsNone(_derive_cauldron_color([]))
        self.assertIsNone(_derive_cauldron_color([card("poison-toxic-4-01")]))
        self.assertEqual(
            _derive_cauldron_color([card("poison-toxic-4-01"), card("poison-red-2-01")]),
            "red",
        )
        with self.assertRaisesRegex(ValueError, "multiple potion colors"):
            _derive_cauldron_color([card("poison-red-1-01"), card("poison-blue-1-01")])

    def test_legal_targets_assign_and_lock_colors(self):
        state = {
            "cauldrons": [
                {"cards": [card("poison-red-1-01")]},
                {"cards": [card("poison-toxic-4-01")]},
                {"cards": []},
            ]
        }
        self.assertEqual(_legal_cauldron_indices(state, card("poison-red-7-01")), [0])
        self.assertEqual(_legal_cauldron_indices(state, card("poison-blue-7-01")), [1, 2])
        self.assertEqual(_legal_cauldron_indices(state, card("poison-toxic-4-02")), [0, 1, 2])

    def test_exactly_thirteen_is_safe_but_more_overflows(self):
        stack = [card("poison-red-7-01"), card("poison-red-4-01")]
        safe_stack, safe_capture, safe_total = _resolve_play(stack, card("poison-red-2-01"))
        self.assertEqual(safe_total, CAULDRON_LIMIT)
        self.assertEqual(len(safe_stack), 3)
        self.assertEqual(safe_capture, [])

        overflow_stack, captured, displayed_total = _resolve_play(stack, card("poison-red-5-01"))
        self.assertEqual([item["id"] for item in overflow_stack], ["poison-red-5-01"])
        self.assertEqual([item["id"] for item in captured], ["poison-red-7-01", "poison-red-4-01"])
        self.assertEqual(displayed_total, 5)

    def test_poison_overflow_releases_old_color(self):
        state = PoisonGame.init_game({"seed": 9}, make_players(3))
        rig_state(
            state,
            hands={"p0": ["poison-toxic-4-01"]},
            cauldrons=[["poison-red-7-01", "poison-red-4-01"], [], []],
        )

        events, error = PoisonGame.apply_action(
            state,
            "p0",
            {"type": "play_card", "card_id": "poison-toxic-4-01", "cauldron_index": 0},
        )

        self.assertIsNone(error)
        self.assertEqual([event["type"] for event in events[:2]], ["poison:play", "poison:overflow"])
        self.assertEqual(len(state["players"]["p0"]["captured"]), 2)
        self.assertEqual([item["id"] for item in state["cauldrons"][0]["cards"]], ["poison-toxic-4-01"])
        self.assertIsNone(_derive_cauldron_color(state["cauldrons"][0]["cards"]))
        self.assertIn(0, _legal_cauldron_indices(state, card("poison-blue-1-01")))
        _assert_card_conservation(state)

    def test_illegal_action_does_not_mutate_state(self):
        state = PoisonGame.init_game({"seed": 11}, make_players(3))
        rig_state(
            state,
            hands={"p0": ["poison-blue-1-01"]},
            cauldrons=[["poison-red-1-01"], ["poison-blue-2-01"], []],
        )
        before = copy.deepcopy(state)

        events, error = PoisonGame.apply_action(
            state,
            "p0",
            {"type": "play_card", "card_id": "poison-blue-1-01", "cauldron_index": 0},
        )

        self.assertEqual(events, [])
        self.assertEqual(error, "illegal cauldron for that potion")
        self.assertEqual(state, before)

    def test_turn_skips_players_with_empty_hands(self):
        state = PoisonGame.init_game({"seed": 13}, make_players(3))
        rig_state(
            state,
            hands={
                "p0": ["poison-red-1-01"],
                "p2": ["poison-purple-1-01"],
            },
        )
        remaining = list(state["players"]["p1"]["hand"])
        state["players"]["p1"]["hand"] = []
        state["players"]["p2"]["hand"] = [card("poison-purple-1-01")] + remaining
        _assert_card_conservation(state)

        _, error = PoisonGame.apply_action(
            state,
            "p0",
            {"type": "play_card", "card_id": "poison-red-1-01", "cauldron_index": 0},
        )

        self.assertIsNone(error)
        self.assertEqual(state["current_turn"], "p2")


class PoisonScoringAndPrivacyTests(unittest.TestCase):
    def test_unique_majority_is_immune_and_ties_are_not(self):
        state = PoisonGame.init_game({"seed": 17}, make_players(3))
        rig_state(
            state,
            captured={
                "p0": [
                    "poison-red-1-01",
                    "poison-red-1-02",
                    "poison-red-1-03",
                    "poison-purple-1-01",
                    "poison-purple-1-02",
                    "poison-toxic-4-01",
                ],
                "p1": [
                    "poison-red-2-01",
                    "poison-red-2-02",
                    "poison-purple-2-01",
                    "poison-purple-2-02",
                ],
            },
        )

        summary = _score_round(state)

        self.assertEqual(summary["immune_by_color"]["red"], "p0")
        self.assertIsNone(summary["immune_by_color"]["purple"])
        self.assertEqual(summary["players"]["p0"]["breakdown"]["red"]["points"], 0)
        self.assertEqual(summary["players"]["p0"]["breakdown"]["purple"]["points"], 2)
        self.assertEqual(summary["players"]["p0"]["breakdown"]["poison"]["points"], 2)
        self.assertEqual(summary["players"]["p0"]["round_score"], 4)
        self.assertEqual(summary["players"]["p1"]["round_score"], 4)

    def test_public_view_hides_hands_captures_removed_cards_and_seed(self):
        state = PoisonGame.init_game({"seed": "private-seed"}, make_players(3))
        state["players"]["p0"]["captured"] = [state["players"]["p0"]["hand"].pop()]
        view = PoisonGame.get_public_view(state, "p0")

        self.assertNotIn("base_seed", view)
        self.assertNotIn("config", view)
        self.assertEqual(view["removed_count"], 12)
        self.assertNotIn("removed_hand", view)
        self.assertNotIn("captured", next(player for player in view["players"] if player["player_id"] == "p0"))
        self.assertNotIn("hand", next(player for player in view["players"] if player["player_id"] == "p1"))
        self.assertEqual(len(view["your_hand"]), len(state["players"]["p0"]["hand"]))
        self.assertIsNone(next(player for player in view["players"] if player["player_id"] == "p0")["round_breakdown"])

    def test_legal_preview_uses_only_visible_outcomes(self):
        state = PoisonGame.init_game({"seed": 19}, make_players(3))
        rig_state(
            state,
            hands={"p0": ["poison-red-5-01"]},
            cauldrons=[["poison-red-7-01", "poison-red-4-01"], [], []],
        )
        view = PoisonGame.get_public_view(state, "p0")
        play = next(item for item in view["legal_plays"] if item["card_id"] == "poison-red-5-01")
        self.assertEqual(play["cauldron_indices"], [0])
        self.assertEqual(play["outcomes"]["0"], {"new_total": 16, "will_overflow": True, "captured_count": 2})


class PoisonRoundFlowTests(unittest.TestCase):
    def _finish_current_round(self, state):
        all_cards = _all_cards_in_state(state)
        trigger = next(item for item in all_cards if item["id"] == "poison-red-1-01")
        for pdata in state["players"].values():
            pdata["hand"] = []
            pdata["captured"] = []
        for cauldron in state["cauldrons"]:
            cauldron["cards"] = []
        state["removed_hand"] = []
        state["players"]["p0"]["hand"] = [trigger]
        remaining = [item for item in all_cards if item["id"] != trigger["id"]]
        state["players"]["p1"]["captured"] = remaining
        state["phase"] = "playing"
        state["game_over"] = False
        state["current_turn"] = "p0"
        _assert_card_conservation(state)
        events, error = PoisonGame.apply_action(
            state,
            "p0",
            {"type": "play_card", "card_id": trigger["id"], "cauldron_index": 0},
        )
        self.assertIsNone(error)
        self.assertIn("poison:round_scored", [event["type"] for event in events])

    def test_round_waits_for_every_player_then_rotates_dealer(self):
        state = PoisonGame.init_game({"seed": 23}, make_players(3))
        old_dealer = state["dealer_id"]
        self._finish_current_round(state)
        self.assertEqual(state["phase"], "round_summary")
        totals = {pid: pdata["total_score"] for pid, pdata in state["players"].items()}

        for player_id in state["turn_order"][:-1]:
            _, error = PoisonGame.apply_action(state, player_id, {"type": "next_round"})
            self.assertIsNone(error)
            self.assertEqual(state["phase"], "round_summary")
        _, error = PoisonGame.apply_action(state, state["turn_order"][-1], {"type": "next_round"})

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["round_number"], 2)
        self.assertEqual(state["dealer_id"], state["turn_order"][(state["turn_order"].index(old_dealer) + 1) % 3])
        self.assertEqual({pid: pdata["total_score"] for pid, pdata in state["players"].items()}, totals)
        _assert_card_conservation(state)

    def test_final_round_finds_all_low_score_winners(self):
        state = PoisonGame.init_game({"seed": 29}, make_players(3))
        state["round_number"] = state["total_rounds"]
        state["players"]["p0"]["total_score"] = 5
        state["players"]["p1"]["total_score"] = 5
        state["players"]["p2"]["total_score"] = 8
        for pdata in state["players"].values():
            pdata["captured"] = []

        _finish_round(state)

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["winner_ids"], ["p0", "p1"])

    def test_rematch_treats_bots_as_ready_and_resets_scores(self):
        state = PoisonGame.init_game({"seed": 31}, make_players(3, bot_ids={"p2"}))
        state["round_number"] = state["total_rounds"]
        state["players"]["p0"]["total_score"] = 3
        state["players"]["p1"]["total_score"] = 4
        state["players"]["p2"]["total_score"] = 5
        _finish_round(state)
        self.assertEqual(state["rematch_ready"], ["p2"])

        PoisonGame.apply_action(state, "p0", {"type": "play_again"})
        self.assertEqual(state["phase"], "game_over")
        events, error = PoisonGame.apply_action(state, "p1", {"type": "play_again"})

        self.assertIsNone(error)
        self.assertIn("poison:round_started", [event["type"] for event in events])
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["round_number"], 1)
        self.assertEqual(state["game_index"], 2)
        self.assertTrue(all(pdata["total_score"] == 0 for pdata in state["players"].values()))
        _assert_card_conservation(state)

    def test_bot_games_reach_game_over_for_every_player_count(self):
        for player_count in range(3, 7):
            with self.subTest(players=player_count):
                bot_ids = {f"p{index}" for index in range(player_count)}
                state = PoisonGame.init_game(
                    {"seed": f"bot-game-{player_count}"},
                    make_players(player_count, bot_ids=bot_ids),
                )
                for _ in range(600):
                    if state["game_over"]:
                        break
                    if state["phase"] == "playing":
                        player_id = state["current_turn"]
                    else:
                        player_id = next(
                            pid for pid in state["turn_order"] if pid not in state["next_round_ready"]
                        )
                    action = PoisonGame.bot_move(state, player_id)
                    self.assertIsNotNone(action)
                    action = {key: value for key, value in action.items() if key != "delay_ms"}
                    _, error = PoisonGame.apply_action(state, player_id, action)
                    self.assertIsNone(error)
                    _assert_card_conservation(state)
                self.assertTrue(state["game_over"])
                self.assertEqual(state["round_number"], player_count)
                self.assertTrue(state["winner_ids"])

    def test_serialization_round_trip_preserves_hidden_state(self):
        state = PoisonGame.init_game({"seed": "save"}, make_players(4))
        payload = PoisonGame.serialize(state)
        restored = PoisonGame.deserialize(copy.deepcopy(payload))
        self.assertEqual(restored, state)
        self.assertEqual(
            PoisonGame.get_public_view(restored, "p0"),
            PoisonGame.get_public_view(state, "p0"),
        )


if __name__ == "__main__":
    unittest.main()
