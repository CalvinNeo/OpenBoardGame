import copy
import itertools
import json
import unittest

from jsonschema import Draft7Validator

from game import get_game
from game.skull_king import (
    ACTION_SCHEMA, CONFIG_SCHEMA, GHOST_ID, SkullKingGame as Game,
    _begin_trick, _finish_round, _start_round, build_deck, led_suit, legal_card_ids,
    resolve_trick, score_round,
)
from game.skull_king_ai import choose_action


def make_state(count=4, schedule="standard", seed=135):
    return Game.init_game({"schedule": schedule, "seed": seed}, [
        {"player_id": f"p{i}", "name": f"Captain {i + 1}", "seat": i, "is_bot": i > 0}
        for i in range(count)
    ])


def action(state, kind, **fields):
    return {"type": kind, **{key: state[key] for key in ("game_token", "round_number", "trick_number")}, **fields}


def card(card_id):
    return next(card for card in build_deck() if card["id"] == card_id)


def plays(*ids):
    result = []
    for i, value in enumerate(ids):
        card_id, mode = value if isinstance(value, tuple) else (value, None)
        result.append({"player_id": f"p{i}", "card": card(card_id), **({"mode": mode} if mode else {})})
    return result


def bid_all(state, bids=None):
    for i, pid in enumerate(state["turn_order"]):
        _, error = Game.apply_action(state, pid, action(state, "bid", bid=(bids or [0] * 8)[i]))
        assert error is None, error


class SkullKingRulesTests(unittest.TestCase):
    def test_registration_and_config(self):
        definition = get_game("skull_king")
        self.assertEqual((definition.name_zh, definition.min_players, definition.max_players), ("骷髅王", 2, 8))
        self.assertIsNot(definition.module, get_game("skull").module)
        for cfg in ({}, {"schedule": "quick"}, {"seed": "repeatable"}):
            Draft7Validator(CONFIG_SCHEMA).validate(cfg)
        for cfg in ([], {"schedule": "bad"}, {"seed": True}, {"seed": ""}, {"seed": []}, {"rounds": 1}):
            with self.subTest(cfg=cfg), self.assertRaises(ValueError):
                Game.init_game(cfg, [{"player_id": "a"}, {"player_id": "b"}])
        for count in (0, 1, 9):
            with self.assertRaises(ValueError):
                make_state(count)
        for ids in (("same", "same"), (GHOST_ID, "p0")):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": pid} for pid in ids])

    def test_deck_and_dealing_at_every_player_count(self):
        self.assertEqual(len(build_deck()), 70)
        self.assertEqual(len({card["id"] for card in build_deck()}), 70)
        for count in range(2, 9):
            state = make_state(count)
            for number in range(1, 11):
                state["round_number"] = number
                _start_round(state)
                expected = min(number, 8 if count == 8 else 10)
                self.assertEqual(state["cards_dealt"], expected)
                cards = state["deck"] + state["ghost_hand"]
                for player in state["players"].values():
                    self.assertEqual(len(player["hand"]), expected)
                    cards += player["hand"]
                self.assertEqual(len(cards), 70)
                self.assertEqual(len({card["id"] for card in cards}), 70)
        state = make_state(8, "quick")
        self.assertEqual((state["cards_dealt"], state["total_rounds"]), (5, 5))

    def test_hidden_simultaneous_bids_and_view_copy(self):
        state = make_state()
        events, error = Game.apply_action(state, "p0", action(state, "bid", bid=1))
        self.assertIsNone(error)
        self.assertEqual(events, [{"type": "skull_king:bid_locked", "payload": {"player_id": "p0"}}])
        for viewer in ("p1", "spectator"):
            view = Game.get_public_view(state, viewer)
            self.assertIsNone(view["players"][0]["bid"])
            self.assertTrue(view["players"][0]["bid_locked"])
            self.assertNotIn("base_seed", view)
            self.assertNotIn("seed", view["config"])
            self.assertNotIn("deck", view)
            self.assertTrue(all("hand" not in p for p in view["players"]))
        self.assertEqual(Game.get_public_view(state, "p0")["players"][0]["bid"], 1)
        visitor = Game.get_public_view(state, "visitor")
        self.assertEqual((visitor["hand"], visitor["legal_actions"], visitor["legal_card_ids"]), ([], [], []))
        own = Game.get_public_view(state, "p0")
        own["hand"][0]["id"] = "changed"
        self.assertNotEqual(state["players"]["p0"]["hand"][0]["id"], "changed")
        for pid in ("p1", "p2", "p3"):
            events, error = Game.apply_action(state, pid, action(state, "bid", bid=0))
            self.assertIsNone(error)
        self.assertEqual(events[-1]["payload"]["bids"], {"p0": 1, "p1": 0, "p2": 0, "p3": 0})
        self.assertEqual(state["phase"], "playing")

    def test_follow_suit_special_exceptions_and_character_lead(self):
        state = make_state()
        bid_all(state)
        state["current_turn"] = "p0"
        state["players"]["p0"]["hand"] = [card(cid) for cid in ("green_2", "black_14", "yellow_14", "escape_1", "pirate_1")]
        state["trick"] = plays("escape_2", "green_10", "pirate_2")
        self.assertEqual(led_suit(state["trick"]), "green")
        self.assertEqual(legal_card_ids(state, "p0"), ["green_2", "escape_1", "pirate_1"])
        state["trick"] = plays("escape_2", "pirate_2", "green_10")
        self.assertIsNone(led_suit(state["trick"]))
        self.assertEqual(len(legal_card_ids(state, "p0")), 5)
        state["trick"] = plays("purple_2")
        self.assertEqual(len(legal_card_ids(state, "p0")), 5)
        self.assertEqual(led_suit(plays(("tigress_1", "escape"), "green_10")), "green")
        self.assertIsNone(led_suit(plays(("tigress_1", "pirate"), "green_10")))

    def test_number_ranking_trump_and_all_escapes(self):
        for ids, winner in [
            (("green_2", "green_14", "yellow_14"), "p1"),
            (("green_14", "black_1", "purple_14"), "p1"),
            (("black_2", "black_12", "black_10"), "p1"),
            (("escape_1", "escape_2", ("tigress_1", "escape")), "p0"),
            (("escape_1", "purple_1", "yellow_14"), "p1"),
        ]:
            self.assertEqual(resolve_trick(plays(*ids))["winner_id"], winner)

    def test_character_hierarchy_in_every_order(self):
        for permutation in itertools.permutations(("pirate_1", "skull_king_1", "mermaid_1")):
            result = resolve_trick(plays(*permutation))
            self.assertEqual(result["winning_card_id"], "mermaid_1")
            self.assertEqual(result["bonus"], 40)
        for ids, winning, bonus in [
            (("mermaid_1", "pirate_1", "mermaid_2"), "pirate_1", 40),
            (("pirate_1", "pirate_2", "skull_king_1"), "skull_king_1", 60),
            (("mermaid_1", "mermaid_2", "black_14"), "mermaid_1", 20),
            (("pirate_2", "pirate_1", "green_14"), "pirate_2", 10),
            ((("tigress_1", "pirate"), "skull_king_1", "black_14"), "skull_king_1", 50),
            ((("tigress_1", "escape"), "skull_king_1", "green_14"), "skull_king_1", 10),
            ((("tigress_1", "pirate"), "mermaid_1", "yellow_14"), "tigress_1", 30),
        ]:
            with self.subTest(ids=ids):
                result = resolve_trick(plays(*ids))
                self.assertEqual((result["winning_card_id"], result["bonus"]), (winning, bonus))
        self.assertEqual(resolve_trick(plays("green_14", "yellow_14", "purple_14", "black_14"))["bonus"], 50)

    def test_scoring_examples_and_actual_card_count_for_zero(self):
        for bid, won, dealt, bonus, base, earned in [
            (3, 3, 5, 40, 60, 40), (2, 4, 5, 40, -20, 0), (3, 1, 5, 20, -20, 0),
            (0, 0, 7, 0, 70, 0), (0, 2, 9, 40, -90, 0),
            (0, 0, 8, 0, 80, 0), (0, 1, 8, 0, -80, 0),
        ]:
            result = score_round(bid, won, dealt, bonus)
            self.assertEqual((result["base"], result["bonus"], result["round_score"]), (base, earned, base + earned))

    def test_two_player_ghost_plays_second_or_leads_and_never_peeks(self):
        state = make_state(2, "quick")
        state["round_start"] = "p0"
        state["players"]["p0"]["hand"] = [card("green_14")] * 5
        state["players"]["p1"]["hand"] = [card("green_1")] * 5
        state["ghost_hand"] = [card("yellow_2"), card("yellow_3"), card("yellow_4"), card("tigress_1"), card("pirate_1")]
        bid_all(state)
        self.assertEqual(state["trick_order"], ["p0", GHOST_ID, "p1"])
        Game.apply_action(state, "p0", action(state, "play", card_id="green_14"))
        self.assertEqual(state["trick"][1]["card"]["id"], "pirate_1")
        self.assertEqual(state["current_turn"], "p1")
        Game.apply_action(state, "p1", action(state, "play", card_id="green_1"))
        self.assertEqual(state["trick_result"]["winner_id"], GHOST_ID)
        self.assertEqual(state["ghost_won"], 1)
        for pid in state["turn_order"]:
            Game.apply_action(state, pid, action(state, "next_trick"))
        self.assertEqual(state["trick_order"], [GHOST_ID, "p1", "p0"])
        self.assertEqual(state["trick"][0]["mode"], "escape")
        self.assertEqual(state["current_turn"], "p1")
        view = Game.get_public_view(state, "p0")
        self.assertNotIn("ghost_hand", view)
        self.assertNotIn("hand", view["ghost"])
        self.assertEqual(len(view["players"]), 2)
        state["ghost_hand"] = [card("green_3"), card("black_1")]
        _begin_trick(state, "p0")
        Game.apply_action(state, "p0", action(state, "play", card_id="green_14"))
        self.assertEqual(state["trick"][1]["card"]["id"], "black_1")

    def test_every_player_must_confirm_round_and_trick(self):
        state = make_state(3)
        bid_all(state)
        first = state["round_start"]
        while state["phase"] == "playing":
            pid = state["current_turn"]
            self.assertIsNone(Game.apply_action(state, pid, choose_action(Game.get_public_view(state, pid)))[1])
        self.assertEqual(state["phase"], "round_review")
        summary = copy.deepcopy(state["round_summary"])
        stale = action(state, "next_round")
        for pid in ("p0", "p1"):
            Game.apply_action(state, pid, stale)
        before = copy.deepcopy(state)
        self.assertIsNone(Game.apply_action(state, "p0", stale)[1])
        self.assertEqual(state, before)
        self.assertEqual(state["round_summary"], summary)
        Game.apply_action(state, "p2", stale)
        self.assertEqual((state["round_number"], state["phase"]), (2, "bidding"))
        self.assertNotEqual(state["round_start"], first)
        self.assertIsNotNone(Game.apply_action(state, "p2", stale)[1])
        bid_all(state)
        while state["phase"] == "playing":
            pid = state["current_turn"]
            self.assertIsNone(Game.apply_action(state, pid, choose_action(Game.get_public_view(state, pid)))[1])
        self.assertEqual(state["phase"], "trick_review")
        winner = state["trick_result"]["winner_id"]
        for pid in ("p0", "p1"):
            Game.apply_action(state, pid, action(state, "next_trick"))
        self.assertEqual(state["phase"], "trick_review")
        self.assertEqual(len(state["trick"]), 3)
        Game.apply_action(state, "p2", action(state, "next_trick"))
        self.assertEqual((state["phase"], state["current_turn"], state["trick_number"]), ("playing", winner, 2))

    def test_invalid_actions_are_atomic_even_without_schema(self):
        state = make_state()
        for bad in [None, [], {}, action(state, "unknown"), action(state, "bid", bid=True),
                    action(state, "bid", bid=2), action(state, "bid", bid=-1),
                    action(state, "bid", bid="1"), action(state, "bid", bid=0, mode="pirate"),
                    {**action(state, "bid", bid=0), "round_number": True},
                    {**action(state, "bid", bid=0), "game_token": "old"}]:
            before = copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state, "p0", bad)[1])
            self.assertEqual(state, before)
        bid_all(state)
        state["current_turn"] = "p0"
        state["trick"] = plays("green_1")
        state["players"]["p0"]["hand"] = [card("green_2"), card("black_14"), card("tigress_1")]
        for pid, bad in [
            ("p1", action(state, "play", card_id="green_2")), ("visitor", action(state, "bid", bid=0)),
            ("p0", action(state, "play", card_id="black_14")), ("p0", action(state, "play", card_id=[])),
            ("p0", action(state, "play", card_id="tigress_1")),
            ("p0", action(state, "play", card_id="tigress_1", mode="mermaid")),
            ("p0", action(state, "play", card_id="green_2", mode="escape")),
        ]:
            before = copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state, pid, bad)[1])
            self.assertEqual(state, before)

    def test_serialization_preserves_secret_state_without_aliasing(self):
        state = make_state(2, "quick")
        bid_all(state)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(state, restored)
        move = choose_action(Game.get_public_view(state, state["current_turn"]))
        self.assertEqual(Game.apply_action(state, state["current_turn"], move),
                         Game.apply_action(restored, restored["current_turn"], move))
        self.assertEqual(state, restored)
        restored["players"]["p0"]["hand"].clear()
        self.assertTrue(state["players"]["p0"]["hand"])

    def test_tied_winners_and_end_is_stable(self):
        state = make_state(3)
        state["round_number"] = 10
        for player in state["players"].values():
            player.update(bid=0, won=0, bonus=0)
        _finish_round(state)
        self.assertEqual(state["winner_ids"], ["p0", "p1", "p2"])
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, "p0", action(state, "next_round"))[1])
        self.assertEqual(state, before)

    def test_bots_complete_every_supported_game_and_actions_validate(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        for count, schedule in itertools.product(range(2, 9), ("standard", "quick")):
            state = make_state(count, schedule, seed=count)
            steps = 0
            while not state["game_over"] and steps < 1600:
                pid = next(pid for pid in state["turn_order"] if Game.get_legal_actions(state, pid))
                move = choose_action(Game.get_public_view(state, pid))
                validator.validate(move)
                self.assertIsNone(Game.apply_action(state, pid, move)[1])
                steps += 1
            self.assertTrue(state["game_over"], (count, schedule, steps))
            self.assertEqual(len(state["score_history"]), state["total_rounds"])
            self.assertTrue(state["winner_ids"])
            for pid in state["turn_order"]:
                total = sum(next(row for row in summary["players"] if row["player_id"] == pid)["round_score"]
                            for summary in state["score_history"])
                self.assertEqual(total, state["players"][pid]["total_score"])
            self.assertEqual(sum(p["won"] for p in state["players"].values()) + state["ghost_won"], state["cards_dealt"])
            self.assertTrue(all(not p["hand"] for p in state["players"].values()))

    def test_bot_is_invariant_to_hidden_information(self):
        state = make_state(4, "quick")
        move = Game.bot_move(state, "p0")
        for pid in ("p1", "p2", "p3"):
            state["players"][pid]["hand"].reverse()
            state["players"][pid]["bid"] = 5
        state["deck"].reverse()
        state["base_seed"] = "not available to bot"
        self.assertEqual(Game.bot_move(state, "p0"), move)


if __name__ == "__main__":
    unittest.main()
