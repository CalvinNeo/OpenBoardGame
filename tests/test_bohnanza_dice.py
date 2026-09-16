import copy
import unittest
from collections import Counter

from game.bohnanza_dice import (
    BEAN_IDS,
    CARD_BY_ID,
    CATALOG,
    DIE_TEMPLATES,
    EXPECTED_CARD_IDS,
    ORDER_LIBRARY,
    BohnanzaDiceGame,
    _advance_player_orders,
    _assert_card_conservation,
    _assert_dice_conservation,
    _finish_game,
    advance_orders,
    matches_order,
)


def make_players(count=2, bot_ids=None):
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


def put_card(state, player_id, field, card_id):
    old_card_id = state["players"][player_id][field]
    if old_card_id == card_id:
        return
    if card_id in state["draw_deck"]:
        index = state["draw_deck"].index(card_id)
        state["draw_deck"][index] = old_card_id
    else:
        found = False
        for other_state in state["players"].values():
            for other_field in ("top_card_id", "cover_card_id"):
                if other_state[other_field] == card_id:
                    other_state[other_field] = old_card_id
                    found = True
                    break
            if found:
                break
            coins = other_state["single_coin_card_ids"]
            if card_id in coins:
                coins[coins.index(card_id)] = old_card_id
                found = True
                break
        if not found:
            raise AssertionError(f"card not found: {card_id}")
    state["players"][player_id][field] = card_id
    _assert_card_conservation(state)


def give_coin_cards(state, player_id, count):
    for _ in range(count):
        state["players"][player_id]["single_coin_card_ids"].append(state["draw_deck"].pop())
    _assert_card_conservation(state)


def settle_harvest_queue(state):
    while state.get("harvest_queue"):
        player_id = state["harvest_queue"][0]
        events, error = BohnanzaDiceGame.apply_action(state, player_id, {"type": "keep_growing"})
        if error:
            raise AssertionError(error)
        if not events:
            raise AssertionError("queue action emitted no event")


class BohnanzaDiceCatalogTests(unittest.TestCase):
    def test_catalog_is_fixed_complete_and_progressively_harder(self):
        self.assertEqual(CATALOG["catalog_id"], "original-compatible-v1")
        self.assertEqual(CATALOG["catalog_status"], "original-compatible")
        self.assertEqual(len(CARD_BY_ID), 55)
        self.assertEqual(set(CARD_BY_ID), EXPECTED_CARD_IDS)
        self.assertEqual(len(ORDER_LIBRARY), 55)

        signatures = set()
        for card in CARD_BY_ID.values():
            orders = card["orders_bottom_to_top"]
            self.assertEqual(len(orders), 5)
            probabilities = [order["first_roll_probability"] for order in orders]
            self.assertEqual(probabilities, sorted(probabilities, reverse=True))
            signature = tuple(order["id"] for order in orders)
            self.assertNotIn(signature, signatures)
            signatures.add(signature)

    def test_dice_templates_match_the_2022_five_die_edition(self):
        self.assertEqual(Counter(DIE_TEMPLATES["dark"]), {"blue": 1, "garden": 1, "stink": 2, "soy": 2})
        self.assertEqual(Counter(DIE_TEMPLATES["light"]), {"stink": 1, "red": 1, "blue": 2, "green": 2})
        total_faces = Counter(DIE_TEMPLATES["dark"] * 2 + DIE_TEMPLATES["light"] * 3)
        self.assertEqual(total_faces, {"blue": 8, "stink": 7, "green": 6, "soy": 4, "red": 3, "garden": 2})
        self.assertEqual(set(total_faces), set(BEAN_IDS))

    def test_matching_supports_and_or_and_distinct_dice(self):
        order = {
            "alternatives": [
                {"slots": [{"allowed": ["green"]}, {"allowed": ["green"]}]},
                {"slots": [{"allowed": ["soy"]}, {"allowed": ["soy"]}]},
            ]
        }
        self.assertTrue(matches_order(["green", "green"], order))
        self.assertTrue(matches_order(["soy", "soy", "blue"], order))
        self.assertFalse(matches_order(["green", "soy"], order))

        flex = {
            "alternatives": [
                {
                    "slots": [
                        {"allowed": ["soy", "green"]},
                        {"allowed": ["garden", "red"]},
                        {"allowed": ["garden", "red"]},
                    ]
                }
            ]
        }
        self.assertTrue(matches_order(["soy", "red", "garden"], flex))
        self.assertFalse(matches_order(["soy", "red"], flex))

    def test_advance_orders_reuses_dice_between_orders_but_stops_on_first_failure(self):
        easy = {"alternatives": [{"slots": [{"allowed": ["blue"]}]}]}
        pair = {"alternatives": [{"slots": [{"allowed": ["blue"]}, {"allowed": ["stink"]}]}]}
        red = {"alternatives": [{"slots": [{"allowed": ["red"]}]}]}
        card = {"orders_bottom_to_top": [easy, pair, red, easy, easy]}
        self.assertEqual(advance_orders(card, 0, ["blue", "stink"]), 2)
        self.assertEqual(advance_orders(card, 2, ["blue", "stink"]), 2)


class BohnanzaDiceSetupAndPrivacyTests(unittest.TestCase):
    def test_player_limits_and_deterministic_setup(self):
        with self.assertRaisesRegex(ValueError, "2 to 5"):
            BohnanzaDiceGame.init_game({"seed": 1}, make_players(1))
        with self.assertRaisesRegex(ValueError, "2 to 5"):
            BohnanzaDiceGame.init_game({"seed": 1}, make_players(6))

        first = BohnanzaDiceGame.init_game({"seed": "same"}, make_players(5))
        second = BohnanzaDiceGame.init_game({"seed": "same"}, make_players(5))
        self.assertEqual(first["active_player_id"], second["active_player_id"])
        self.assertEqual(first["draw_deck"], second["draw_deck"])
        self.assertEqual(first["players"], second["players"])
        self.assertEqual(len(first["draw_deck"]), 45)
        _assert_card_conservation(first)
        _assert_dice_conservation(first)

    def test_public_view_exposes_cards_but_hides_seed_and_deck_order(self):
        state = BohnanzaDiceGame.init_game({"seed": "private"}, make_players(2))
        view = BohnanzaDiceGame.get_public_view(state, "p0")
        self.assertNotIn("base_seed", view)
        self.assertNotIn("rng_counter", view)
        self.assertNotIn("draw_deck", view)
        self.assertEqual(view["draw_deck_count"], 51)
        self.assertEqual(len(view["players"][0]["top_card"]["orders_bottom_to_top"]), 5)
        self.assertEqual(view["catalog"]["catalog_status"], "original-compatible")

    def test_serialize_round_trip_is_independent_and_validated(self):
        state = BohnanzaDiceGame.init_game({"seed": 7}, make_players(2))
        payload = BohnanzaDiceGame.serialize(state)
        payload["turn_number"] = 4
        self.assertEqual(state["turn_number"], 1)
        restored = BohnanzaDiceGame.deserialize(payload)
        self.assertEqual(restored["turn_number"], 4)
        _assert_card_conservation(restored)
        with self.assertRaisesRegex(ValueError, "different"):
            bad = copy.deepcopy(payload)
            bad["config"]["catalog_id"] = "other"
            BohnanzaDiceGame.deserialize(bad)


class BohnanzaDiceTurnFlowTests(unittest.TestCase):
    def test_roll_repeat_and_save_flow_are_server_authoritative(self):
        state = BohnanzaDiceGame.init_game({"seed": "flow"}, make_players(2))
        active = state["active_player_id"]
        events, error = BohnanzaDiceGame.apply_action(state, active, {"type": "roll"})
        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertEqual(state["roll_count_this_turn"], 1)
        self.assertEqual(len(state["current_roll_die_ids"]), 5)
        settle_harvest_queue(state)

        _, error = BohnanzaDiceGame.apply_action(state, active, {"type": "repeat_roll"})
        self.assertIsNone(error)
        self.assertTrue(state["repeat_used"])
        self.assertEqual(state["roll_count_this_turn"], 2)
        settle_harvest_queue(state)
        before = copy.deepcopy(state)
        events, error = BohnanzaDiceGame.apply_action(state, active, {"type": "repeat_roll"})
        self.assertEqual(events, [])
        self.assertIsNotNone(error)
        self.assertEqual(state, before)

        save_id = state["current_roll_die_ids"][0]
        roll_sequence_before_save = state["roll_sequence"]
        rng_counter_before_save = state["rng_counter"]
        _, error = BohnanzaDiceGame.apply_action(state, active, {"type": "save_dice", "die_ids": [save_id]})
        self.assertIsNone(error)
        self.assertEqual(next(die for die in state["dice"] if die["id"] == save_id)["zone"], "bean_field")
        self.assertEqual(state["phase"], "await_roll")
        self.assertEqual(state["roll_sequence"], roll_sequence_before_save)
        self.assertEqual(state["rng_counter"], rng_counter_before_save)
        self.assertEqual(state["roll_count_this_turn"], 2)
        self.assertEqual(state["current_roll_die_ids"], [])
        self.assertEqual(BohnanzaDiceGame.get_legal_actions(state, active), ["roll"])
        self.assertEqual(sum(die["zone"] == "cup" for die in state["dice"]), 4)

        _, error = BohnanzaDiceGame.apply_action(state, active, {"type": "roll"})
        self.assertIsNone(error)
        self.assertEqual(state["roll_count_this_turn"], 3)
        self.assertEqual(len(state["current_roll_die_ids"]), 4)

    def test_save_requires_at_least_one_unique_current_die(self):
        state = BohnanzaDiceGame.init_game({"seed": "validation"}, make_players(2))
        active = state["active_player_id"]
        BohnanzaDiceGame.apply_action(state, active, {"type": "roll"})
        settle_harvest_queue(state)
        for die_ids in ([], ["missing"], [state["current_roll_die_ids"][0]] * 2):
            with self.subTest(die_ids=die_ids):
                before = copy.deepcopy(state)
                events, error = BohnanzaDiceGame.apply_action(state, active, {"type": "save_dice", "die_ids": die_ids})
                self.assertEqual(events, [])
                self.assertIsNotNone(error)
                self.assertEqual(state, before)

    def test_saving_all_dice_checks_active_player_then_passes_turn(self):
        state = BohnanzaDiceGame.init_game({"seed": "all-in"}, make_players(3))
        active = state["active_player_id"]
        next_player = state["turn_order"][(state["turn_order"].index(active) + 1) % 3]
        BohnanzaDiceGame.apply_action(state, active, {"type": "roll"})
        settle_harvest_queue(state)
        die_ids = list(state["current_roll_die_ids"])
        _, error = BohnanzaDiceGame.apply_action(state, active, {"type": "save_dice", "die_ids": die_ids})
        self.assertIsNone(error)
        settle_harvest_queue(state)
        self.assertEqual(state["phase"], "await_roll")
        self.assertEqual(state["active_player_id"], next_player)
        self.assertTrue(all(die["zone"] == "cup" and die["face"] is None for die in state["dice"]))

    def test_nonactive_progress_helper_uses_only_the_supplied_roll(self):
        state = BohnanzaDiceGame.init_game({"seed": "context"}, make_players(2))
        inactive = next(pid for pid in state["turn_order"] if pid != state["active_player_id"])
        put_card(state, inactive, "top_card_id", "compatible-001")
        state["players"][inactive]["completed_count"] = 1
        events = []
        gained = _advance_player_orders(state, inactive, ["blue"], events, "current_roll")
        self.assertEqual(gained, 0)
        self.assertEqual(state["players"][inactive]["completed_count"], 1)
        self.assertEqual(events, [])


class BohnanzaDiceHarvestAndEndGameTests(unittest.TestCase):
    def _open_checkpoint(self, state, player_id, completed=3, origin="after_roll", context=None):
        state["players"][player_id]["completed_count"] = completed
        state["decision_origin"] = origin
        state["harvest_queue"] = [player_id]
        state["harvest_contexts"] = {player_id: context}
        state["phase"] = {"after_roll": "harvest_decision", "turn_end": "turn_end_harvest", "final": "final_harvest"}[origin]

    def test_harvest_reward_rotates_cards_and_chain_keeps_queue_head(self):
        state = BohnanzaDiceGame.init_game({"seed": "chain"}, make_players(2))
        player_id = "p1"
        put_card(state, player_id, "cover_card_id", "compatible-001")
        old_top = state["players"][player_id]["top_card_id"]
        old_cover = state["players"][player_id]["cover_card_id"]
        deck_before = len(state["draw_deck"])
        self._open_checkpoint(state, player_id, completed=4, context=["blue", "stink", "green", "red"])

        _, error = BohnanzaDiceGame.apply_action(state, player_id, {"type": "harvest"})

        self.assertIsNone(error)
        pdata = state["players"][player_id]
        self.assertIn(old_top, pdata["single_coin_card_ids"])
        self.assertEqual(len(pdata["single_coin_card_ids"]), 2)
        self.assertEqual(pdata["top_card_id"], old_cover)
        self.assertEqual(pdata["completed_count"], 3)
        self.assertEqual(state["harvest_queue"], [player_id])
        self.assertEqual(len(state["draw_deck"]), deck_before - 2)
        _assert_card_conservation(state)

    def test_keep_growing_only_skips_the_current_checkpoint(self):
        state = BohnanzaDiceGame.init_game({"seed": "keep"}, make_players(2))
        active = state["active_player_id"]
        _, error = BohnanzaDiceGame.apply_action(state, active, {"type": "roll"})
        self.assertIsNone(error)
        settle_harvest_queue(state)
        self._open_checkpoint(state, "p1", completed=3)
        before_player = copy.deepcopy(state["players"]["p1"])
        dice_before = copy.deepcopy(state["dice"])
        roll_sequence_before = state["roll_sequence"]
        roll_count_before = state["roll_count_this_turn"]
        rng_counter_before = state["rng_counter"]
        _, error = BohnanzaDiceGame.apply_action(state, "p1", {"type": "keep_growing"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "after_roll")
        self.assertEqual(state["players"]["p1"], before_player)
        self.assertEqual(state["dice"], dice_before)
        self.assertEqual(state["roll_sequence"], roll_sequence_before)
        self.assertEqual(state["roll_count_this_turn"], roll_count_before)
        self.assertEqual(state["rng_counter"], rng_counter_before)

    def test_deck_shortage_recycles_five_coin_cards_without_losing_cards(self):
        state = BohnanzaDiceGame.init_game({"seed": "recycle"}, make_players(2))
        p0 = state["players"]["p0"]
        p1 = state["players"]["p1"]
        give_coin_cards(state, "p0", 5)
        p1["single_coin_card_ids"].extend(state["draw_deck"])
        state["draw_deck"] = []
        _assert_card_conservation(state)
        self._open_checkpoint(state, "p0", completed=5)

        events, error = BohnanzaDiceGame.apply_action(state, "p0", {"type": "harvest"})

        self.assertIsNone(error)
        self.assertTrue(p0["five_coin_marker"])
        self.assertEqual(len(p0["single_coin_card_ids"]), 3)
        self.assertEqual(len(state["draw_deck"]), 2)
        self.assertIn("bohnanza_dice:cards_recycled", [event["type"] for event in events])
        _assert_card_conservation(state)

    def test_ten_coins_during_roll_banks_dice_and_runs_final_harvest(self):
        state = BohnanzaDiceGame.init_game({"seed": "final"}, make_players(2))
        active = state["active_player_id"]
        BohnanzaDiceGame.apply_action(state, active, {"type": "roll"})
        settle_harvest_queue(state)
        trigger = next(pid for pid in state["turn_order"] if pid != active)
        give_coin_cards(state, trigger, 9)
        self._open_checkpoint(state, trigger, completed=3, origin="after_roll", context=[])

        _, error = BohnanzaDiceGame.apply_action(state, trigger, {"type": "harvest"})

        self.assertIsNone(error)
        self.assertTrue(state["final_phase"])
        self.assertEqual(state["final_trigger"]["player_id"], trigger)
        self.assertTrue(all(die["zone"] == "bean_field" for die in state["dice"]))
        self.assertIn(state["phase"], {"final_harvest", "game_over"})
        while state.get("harvest_queue"):
            head = state["harvest_queue"][0]
            BohnanzaDiceGame.apply_action(state, head, {"type": "keep_growing"})
        self.assertTrue(state["game_over"])
        self.assertIn(trigger, state["winner_ids"])

    def test_final_scoring_allows_ties_and_bots_are_rematch_ready(self):
        state = BohnanzaDiceGame.init_game({"seed": "tie"}, make_players(3, bot_ids={"p2"}))
        give_coin_cards(state, "p0", 5)
        give_coin_cards(state, "p1", 5)
        state["players"]["p0"]["five_coin_marker"] = True
        state["players"]["p1"]["five_coin_marker"] = True
        events = []
        _finish_game(state, events)
        self.assertEqual(state["winner_ids"], ["p0", "p1"])
        self.assertEqual(state["rematch_ready"], ["p2"])

        BohnanzaDiceGame.apply_action(state, "p0", {"type": "play_again"})
        self.assertEqual(state["phase"], "game_over")
        _, error = BohnanzaDiceGame.apply_action(state, "p1", {"type": "play_again"})
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "await_roll")
        self.assertFalse(state["game_over"])
        self.assertTrue(all(player["completed_count"] == 0 for player in state["players"].values()))
        _assert_card_conservation(state)

    def test_bot_can_answer_off_turn_harvest_queue(self):
        state = BohnanzaDiceGame.init_game({"seed": "bot"}, make_players(2, bot_ids={"p1"}))
        self._open_checkpoint(state, "p1", completed=4)
        action = BohnanzaDiceGame.bot_move(state, "p1")
        self.assertEqual(action["type"], "harvest")


if __name__ == "__main__":
    unittest.main()
