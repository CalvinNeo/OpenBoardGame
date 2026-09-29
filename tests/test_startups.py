import copy
import json
import unittest
from collections import Counter

from jsonschema import validate

from game.startups import (
    ACTION_SCHEMA, COMPANIES, COMPANY_IDS, StartupsGame as Game,
    _finish_round, build_deck, draw_cost,
)
from game.startups_ai import choose_action


def action(state, kind, **fields):
    return {"type": kind, **{key: state[key] for key in ("game_token", "round_number", "turn_number")}, **fields}


def make_state(count=3, rounds=1, seed=136):
    return Game.init_game({"rounds": rounds, "seed": seed}, [
        {"player_id": f"p{i}", "name": f"Investor {i}", "seat": i, "is_bot": True}
        for i in range(count)
    ])


def card(company, index=0):
    return {"id": f"{company}_{index}", "company": company}


class StartupsTests(unittest.TestCase):
    def apply(self, state, kind, pid=None, **fields):
        events, error = Game.apply_action(state, pid or state["current_turn"], action(state, kind, **fields))
        self.assertIsNone(error)
        return events

    def invalid(self, state, pid, payload):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, payload)
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def settlement(self):
        state = make_state()
        for player in state["players"].values():
            player.update(hand=[], portfolio=[], capital=10, last_turn=0)
        return state

    def test_deck_setup_and_all_player_counts(self):
        deck = build_deck()
        self.assertEqual(len(deck), 45)
        self.assertEqual(len({c["id"] for c in deck}), 45)
        self.assertEqual(Counter(c["company"] for c in deck), {c["id"]: c["supply"] for c in COMPANIES})
        for count in range(3, 8):
            state = make_state(count)
            self.assertEqual(len(state["removed_cards"]), 5)
            self.assertEqual(len(state["deck"]), 40 - 3 * count)
            self.assertEqual(state["market"], [])
            for p in state["players"].values():
                self.assertEqual((len(p["hand"]), p["capital"]), (3, 10))
            self.assertEqual(state["deck"], make_state(count)["deck"])

    def test_invalid_configuration_and_duplicate_players(self):
        for count in (2, 8):
            with self.assertRaises(ValueError):
                make_state(count)
        players = [{"player_id": str(i)} for i in range(3)]
        for cfg in ({"rounds": True}, {"rounds": 2}, {"rounds": "4"}, {"seed": []}, {"seed": True}, {"seed": ""}, {"extra": 1}, []):
            with self.assertRaises(ValueError):
                Game.init_game(cfg, players)
        with self.assertRaises(ValueError):
            Game.init_game({}, players[:2] + [players[0]])

    def test_draw_charges_each_card_and_exempts_only_marker_companies(self):
        state = make_state(); pid = state["current_turn"]
        state["market"] = [{"card": card("giraffe", i), "coins": i} for i in range(2)] + [{"card": card("bowwow"), "coins": 2}]
        state["anti_monopoly"]["bowwow"] = pid
        self.assertEqual(draw_cost(state, pid), 2)
        events = self.apply(state, "draw")
        self.assertEqual(state["players"][pid]["capital"], 8)
        self.assertEqual([entry["coins"] for entry in state["market"]], [1, 2, 2])
        self.assertEqual(len(state["players"][pid]["hand"]), 4)
        self.assertEqual(state["phase"], "place")
        self.assertEqual(set(events[0]["payload"]), {"type", "player_id", "turn_number", "cost"})

    def test_insufficient_capital_cannot_draw_and_all_exempt_is_free(self):
        state = make_state(); pid = state["current_turn"]
        state["players"][pid]["capital"] = 0
        state["market"] = [{"card": card("giraffe"), "coins": 0}]
        self.invalid(state, pid, action(state, "draw"))
        self.assertEqual(Game.get_legal_actions(state, pid), ["take_market"])
        state["anti_monopoly"]["giraffe"] = pid
        self.assertEqual(Game.get_legal_actions(state, pid), ["draw"])
        self.apply(state, "draw")
        self.assertEqual(state["players"][pid]["capital"], 0)

    def test_market_coins_and_same_company_discard_prohibition(self):
        state = make_state(); pid = state["current_turn"]
        state["players"][pid]["hand"] = [card("giraffe", 1), card("bowwow", 1), card("octo", 1)]
        state["market"] = [{"card": card("giraffe"), "coins": 4}]
        self.apply(state, "take_market", card_id="giraffe_0")
        self.assertEqual(state["players"][pid]["capital"], 14)
        self.assertFalse(state["market"])
        for index in (0, 1):
            self.invalid(state, pid, action(state, "discard", card_id=f"giraffe_{index}"))
        self.apply(state, "discard", card_id="bowwow_1")
        self.assertEqual(state["market"], [{"card": card("bowwow", 1), "coins": 0}])
        self.assertEqual(len(state["players"][pid]["hand"]), 3)

    def test_blocked_market_card_rejected_even_when_another_is_available(self):
        state = make_state(); pid = state["current_turn"]
        state["market"] = [{"card": card(c), "coins": 1} for c in ("giraffe", "octo")]
        state["anti_monopoly"]["giraffe"] = pid
        self.assertIn("take_market", Game.get_legal_actions(state, pid))
        self.invalid(state, pid, action(state, "take_market", card_id="giraffe_0"))
        self.assertEqual(Game.get_public_view(state, pid)["legal_market_ids"], ["octo_0"])

    def test_all_hand_cards_same_as_market_source_must_invest(self):
        state = make_state(); pid = state["current_turn"]
        state["players"][pid]["hand"] = [card("giraffe", i) for i in range(1, 4)]
        state["market"] = [{"card": card("giraffe"), "coins": 0}]
        self.apply(state, "take_market", card_id="giraffe_0")
        self.assertEqual(Game.get_legal_actions(state, pid), ["invest"])
        self.apply(state, "invest", card_id="giraffe_2")

    def test_first_investment_tie_retention_and_strict_marker_transfer(self):
        state = self.settlement()
        for pid, index in (("p0", 0), ("p1", 1), ("p1", 2)):
            state.update(phase="place", current_turn=pid)
            state["players"][pid]["hand"] = [card("giraffe", index)]
            self.apply(state, "invest", card_id=f"giraffe_{index}")
            self.assertEqual(state["anti_monopoly"]["giraffe"], "p1" if index == 2 else "p0")

    def test_last_draw_waits_for_placement_then_reveals_every_hand(self):
        state = make_state(); pid = state["current_turn"]
        state["deck"] = [card("giraffe", 99)]
        self.apply(state, "draw")
        self.assertFalse(state["game_over"])
        self.assertEqual(state["phase"], "place")
        self.assertIsNone(Game.get_public_view(state, "spectator")["players"][0]["hand"])
        self.apply(state, "discard", card_id="giraffe_99")
        self.assertTrue(state["game_over"])
        self.assertIsNone(state["current_turn"])
        self.assertEqual(len(state["score_history"]), 1)
        view = Game.get_public_view(state, "spectator")
        self.assertTrue(view["hands_revealed"])
        self.assertTrue(all(len(p["hand"]) == 3 for p in view["players"]))
        self.assertEqual(sum(sum(p["shares"].values()) for p in view["players"]), 9)

    def test_pay_one_receive_three_debt_and_no_company_order_dependency(self):
        state = self.settlement()
        state["players"]["p0"].update(portfolio=[card("giraffe", i) for i in range(3)], hand=[card("octo")], capital=0)
        state["players"]["p1"].update(portfolio=[card("giraffe", 3)] + [card("octo", i) for i in range(1, 3)], capital=0)
        state["players"]["p2"].update(hand=[card("giraffe", 4)], capital=0)
        _finish_round(state)
        self.assertEqual([state["players"][pid]["round_score"] for pid in state["turn_order"]], [5, 2, -1])
        self.assertEqual(state["players"]["p0"]["income_chips"], 2)
        self.assertEqual(state["players"]["p0"]["paid_chips"], 1)
        self.assertEqual(state["winner_ids"], ["p0"])

    def test_tied_majority_pays_nobody_regardless_of_marker(self):
        state = self.settlement()
        for i, pid in enumerate(state["turn_order"]):
            state["players"][pid]["hand"] = [card("giraffe", i)]
        state["anti_monopoly"]["giraffe"] = "p0"
        _finish_round(state)
        row = state["round_summary"]["companies"][0]
        self.assertIsNone(row["winner_id"])
        self.assertEqual(row["payments"], [])
        self.assertEqual([p["round_score"] for p in state["players"].values()], [10, 10, 10])

    def test_hand_can_overturn_public_majority_and_market_is_ignored(self):
        state = self.settlement()
        state["players"]["p0"]["portfolio"] = [card("giraffe")]
        state["players"]["p1"]["hand"] = [card("giraffe", 1), card("giraffe", 2)]
        state["market"] = [{"card": card("giraffe", 3), "coins": 9}]
        state["anti_monopoly"]["giraffe"] = "p0"
        _finish_round(state)
        self.assertEqual([p["round_score"] for p in state["players"].values()], [9, 13, 10])
        self.assertEqual(state["round_summary"]["companies"][0]["winner_id"], "p1")

    def test_round_tiebreak_income_then_most_recent_turn(self):
        state = self.settlement()
        state["players"]["p0"].update(hand=[card("giraffe", 0), card("giraffe", 1)], capital=7, last_turn=1)
        state["players"]["p1"].update(hand=[card("giraffe", 2)], capital=11, last_turn=3)
        state["players"]["p2"].update(capital=10, last_turn=2)
        _finish_round(state)
        self.assertEqual(state["round_summary"]["ranking"], ["p0", "p1", "p2"])

    def test_round_readiness_idempotence_and_last_place_starts(self):
        state = make_state(rounds=4)
        _finish_round(state)
        self.assertEqual(state["phase"], "round_review")
        ranking = state["round_summary"]["ranking"]
        self.assertEqual([state["players"][pid]["match_points"] for pid in ranking], [2, 1, -1])
        old = action(state, "next_round")
        self.apply(state, "next_round", "p0")
        before = copy.deepcopy(state)
        self.assertEqual(Game.apply_action(state, "p0", old), ([], None))
        self.assertEqual(state, before)
        self.apply(state, "next_round", "p1")
        self.assertEqual(state["round_number"], 1)
        self.apply(state, "next_round", "p2")
        self.assertEqual(state["round_number"], 2)
        self.assertEqual(state["current_turn"], ranking[-1])
        self.assertTrue(all(p["capital"] == 10 for p in state["players"].values()))
        self.assertEqual(len(state["score_history"]), 1)
        self.invalid(state, "p0", old)

    def test_middle_places_receive_zero_points_and_match_tiebreak(self):
        state = make_state(count=5, rounds=4)
        for i, player in enumerate(state["players"].values()):
            player.update(hand=[], portfolio=[], capital=20 - i)
        _finish_round(state)
        self.assertEqual([p["match_points"] for p in state["players"].values()], [2, 1, 0, 0, -1])
        state = self.settlement()
        state["config"]["rounds"] = 4; state["round_number"] = 4
        state["players"]["p0"].update(match_points=0, firsts=1, seconds=0, capital=10)
        state["players"]["p1"].update(match_points=1, firsts=2, seconds=0, capital=9)
        state["players"]["p2"].update(match_points=3, firsts=1, seconds=2, capital=8)
        _finish_round(state)
        self.assertEqual([p["match_points"] for p in state["players"].values()], [2, 2, 2])
        self.assertEqual(state["final_ranking"], ["p1", "p0", "p2"])

    def test_invalid_and_stale_actions_leave_state_unchanged(self):
        state = make_state(); pid = state["current_turn"]
        payload = action(state, "draw")
        invalid = [None, [], {}, {**payload, "extra": True}, {**payload, "round_number": True},
                   {**payload, "turn_number": "1"}, {**payload, "game_token": "old"},
                   action(state, "invest", card_id="giraffe_0"), action(state, "take_market", card_id=[])]
        for item in invalid:
            self.invalid(state, pid, item)
        self.invalid(state, "unknown", payload)
        other = next(p for p in state["players"] if p != pid)
        self.invalid(state, other, payload)
        self.apply(state, "draw")
        self.invalid(state, pid, payload)
        self.invalid(state, pid, action(state, "invest", card_id="absent"))
        self.apply(state, "invest", card_id=state["players"][pid]["hand"][0]["id"])
        self.invalid(state, state["current_turn"], payload)

    def test_private_views_events_and_returned_objects_are_isolated(self):
        state = make_state(); pid = state["current_turn"]
        other = next(p for p in state["players"] if p != pid)
        for viewer in (pid, other, "spectator"):
            view = Game.get_public_view(state, viewer)
            self.assertTrue(all(p["hand"] is None for p in view["players"]))
            self.assertNotIn("seed", view["config"])
            for key in ("deck", "removed_cards", "base_seed", "player_meta"):
                self.assertNotIn(key, view)
            self.assertEqual(len(view["hand"]), 0 if viewer == "spectator" else 3)
        view = Game.get_public_view(state, pid); view["hand"][0]["company"] = "changed"
        self.assertNotEqual(state["players"][pid]["hand"][0]["company"], "changed")
        events = self.apply(state, "draw")
        self.assertNotIn("card", json.dumps(events))

    def test_serialization_and_view_only_bot_cannot_use_secrets(self):
        state = make_state(); pid = state["current_turn"]
        self.apply(state, "draw")
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(state, restored)
        original = choose_action(Game.get_public_view(state, pid))
        restored["deck"].reverse(); restored["removed_cards"].reverse(); restored["base_seed"] = "different"
        for other in restored["players"]:
            if other != pid:
                restored["players"][other]["hand"] = [card("hippo", i) for i in range(3)]
        self.assertEqual(original, choose_action(Game.get_public_view(restored, pid)))
        restored["players"][pid]["capital"] += 1
        self.assertNotEqual(state, restored)

    def test_bots_finish_all_player_counts_and_preserve_cards_and_capital(self):
        for count in range(3, 8):
            for rounds in (1, 4):
                for seed in range(5):
                    state = make_state(count, rounds, seed)
                    for step in range(1800):
                        if state["game_over"]:
                            break
                        pid = state["current_turn"] or next(p for p in state["turn_order"] if p not in state["ready"])
                        payload = Game.bot_move(state, pid)
                        self.assertIsNotNone(payload)
                        payload.pop("delay_ms")
                        if seed == 0:
                            validate(payload, ACTION_SCHEMA)
                        events, error = Game.apply_action(state, pid, payload)
                        self.assertIsNone(error, payload)
                        cards = state["deck"] + state["removed_cards"] + [entry["card"] for entry in state["market"]]
                        for player in state["players"].values():
                            cards += player["hand"] + player["portfolio"]
                        self.assertEqual(len(cards), 45)
                        self.assertEqual(len({c["id"] for c in cards}), 45)
                        self.assertEqual(sum(p["capital"] for p in state["players"].values()) + sum(entry["coins"] for entry in state["market"]), count * 10)
                    self.assertTrue(state["game_over"], (count, rounds, seed, state["phase"]))
                    self.assertEqual(len(state["score_history"]), rounds)
                    self.assertEqual(len(state["winner_ids"]), 1)


if __name__ == "__main__":
    unittest.main()
