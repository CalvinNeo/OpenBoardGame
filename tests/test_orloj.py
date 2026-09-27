import copy
import json
import unittest

from game.orloj import (
    OrlojGame as Game, _advance_mastery, _hammer_rewards, _settle,
    available_apostles, construction_cost, group_size, legal_moves, mastery_level,
    payment_options, score_breakdown, sculptor_level, surplus_gold,
)
from game.orloj_ai import choose_move
from game.orloj_data import APOSTLE_SLOTS, BASIC, HAMMER_CELLS, RESOURCES, TRACKS, effect


def new_game(count=2, seed=125):
    state = Game.init_game({"seed": seed}, [{"player_id": f"p{i}", "name": f"Maker {i}", "seat": i} for i in range(count)])
    while state["phase"] == "setup":
        pid = state["current_turn"]
        _, error = Game.apply_action(state, pid, Game.bot_move(state, pid))
        assert error is None, error
    return state


def act(state, pid="p0", kind=None, **fields):
    moves = Game.get_public_view(state, pid)["moves"]
    move = next((m for m in moves if m["type"] == kind and all(m.get(k) == v for k, v in fields.items())), None)
    assert move is not None, (kind, fields, state["pending"], moves[:10])
    _, error = Game.apply_action(state, pid, move)
    assert error is None, error
    accept_benefits(state)
    return move


def accept_benefits(state):
    """Most rule examples take their free rewards; decline cases use apply_action."""
    if state["game_over"]:
        return
    _settle(state)
    while not state["game_over"]:
        pid = state["current_turn"]
        move = next((m for m in Game.get_public_view(state, pid)["moves"] if m["type"] == "accept"), None)
        if move is None:
            break
        assert Game.apply_action(state, pid, move)[1] is None


def pending_state(kind, **fields):
    state = new_game()
    state.update(current_turn="p0", main_done=True, pending=[effect(kind, **fields)])
    return state


class OrlojRulesTests(unittest.TestCase):
    def test_initialization_and_reproducible_public_setup(self):
        for count in (2, 3, 4):
            a, b = new_game(count), new_game(count)
            self.assertEqual(a, b)
            self.assertEqual(len(a["market"]), 3)
            self.assertEqual(sum(c["built"] for c in a["board"]["months"]), 9 - count)
            self.assertEqual(sum(c["blocked"] for c in a["board"]["months"]), 8 - count)
            self.assertEqual(len(a["scroll_market"]), 3 if count == 2 else 4)
            self.assertTrue(all(p["score"] == 10 for p in a["players"].values()))
        for count in (0, 1, 5):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": str(i)} for i in range(count)])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "same"}, {"player_id": "same"}])
        for config in ({"seed": True}, {"seed": "5"}, {"unknown": 0}, []):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": "a"}, {"player_id": "b"}])

    def test_mastery_levels_and_sculptor_thresholds(self):
        self.assertEqual([mastery_level(n) for n in (0, 3, 4, 6, 7, 9, 10, 12)], [1, 1, 2, 2, 3, 3, 4, 4])
        self.assertEqual([sculptor_level(n) for n in (0, 4, 5, 9, 10, 12)], [1, 1, 2, 2, 3, 3])

    def test_payments_preserve_special_resource_types_and_allow_substitution(self):
        stock = dict.fromkeys(RESOURCES, 0)
        stock.update(wood=1, gold=2, coin=1)
        payments = payment_options(stock, {"gold": 1, "wood": 2})
        self.assertIn({"wood": 1, "gold": 1, "coin": 1}, payments)
        self.assertIn({"wood": 1, "gold": 2}, payments)
        self.assertIn({"gold": 2, "coin": 1}, payments)
        self.assertEqual(payment_options({**stock, "gold": 0}, {"gold": 1}), [])
        self.assertEqual(payment_options({**stock, "coin": 0}, {"coin": 1}), [])
        self.assertEqual(len(payments), len({json.dumps(p, sort_keys=True) for p in payments}))

    def test_clock_direction_capacity_bumping_and_deviation(self):
        s = new_game()
        p = s["players"]["p0"]
        p["deviation"], p["mastery"]["blue"] = 0, 0
        s.update(hand=0, face=0)
        s["clock_workers"][3] = "p1"
        other = s["players"]["p1"]["workers"]
        workers = p["workers"]
        act(s, kind="clock", steps=3, rotate=1, first="outer")
        self.assertEqual((s["hand"], s["face"]), (3, 11))
        self.assertEqual(s["players"]["p0"]["deviation"], 3)
        self.assertEqual(s["players"]["p0"]["workers"], workers - 1)
        self.assertEqual(s["players"]["p1"]["workers"], other + 1)
        self.assertEqual(s["pending"][0]["kind"], "build")

    def test_self_bump_still_requires_available_worker(self):
        s = new_game()
        s["players"]["p0"]["workers"] = 0
        s["clock_workers"][1] = "p0"
        self.assertNotIn("clock", Game.get_legal_actions(s, "p0"))
        s["players"]["p0"]["workers"] = 1
        s["players"]["p0"]["deviation"] = 0
        act(s, kind="clock", steps=1, rotate=0, first="outer")
        self.assertEqual(s["players"]["p0"]["workers"], 1)

    def test_bundles_preserve_sections_and_allow_order_within_one_section(self):
        s = new_game()
        s.update(hand=0, face=0)
        s["players"]["p0"]["deviation"] = 0
        act(s, kind="clock", steps=1, rotate=0, first="inner")
        self.assertEqual(s["pending"][0]["kind"], "bundle")
        self.assertEqual([e["kind"] for e in s["pending"][0]["effects"]], ["mastery", "paid_mastery"])
        act(s, kind="resolve", index=0)
        self.assertEqual(s["pending"][0]["kind"], "paid_mastery")
        act(s, kind="skip")
        self.assertEqual(s["pending"][0]["kind"], "bundle")

    def test_production_wild_gold_and_all_three_unlock_worker(self):
        s = pending_state("produce", resource="iron")
        p = s["players"]["p0"]
        p["production"] = {"paint": 1, "wood": 1, "iron": 2}
        p["resources"] = dict.fromkeys(RESOURCES, 0)
        accept_benefits(s)
        self.assertEqual(s["players"]["p0"]["resources"]["iron"], 2)
        act(s, kind="any_resource", resource="wood")
        self.assertEqual(s["players"]["p0"]["resources"]["wood"], 1)
        s["pending"] = [effect("upgrade")]
        s["players"]["p0"]["production"] = {"paint": 0, "wood": 1, "iron": 1}
        s["players"]["p0"]["production_workers"] = 0
        before = s["players"]["p0"]["workers"]
        act(s, kind="upgrade", track="paint")
        self.assertEqual(s["players"]["p0"]["workers"], before + 1)
        s["players"]["p0"]["production"]["iron"] = 3
        s["pending"] = [effect("produce", resource="iron")]
        accept_benefits(s)
        self.assertEqual(s["players"]["p0"]["resources"]["gold"], 1)

    def test_upgrade_overflow_and_hammer_cap(self):
        s = pending_state("upgrade")
        s["players"]["p0"]["production"]["wood"] = 3
        s["players"]["p0"]["hammer_level"] = 2
        before = copy.deepcopy(s["players"]["p0"])
        self.assertNotIn({"type": "upgrade", "track": "hammer"}, legal_moves(s, "p0"))
        act(s, kind="upgrade", track="wood")
        self.assertEqual(s["players"]["p0"]["score"], before["score"] + 1)
        self.assertEqual(s["players"]["p0"]["resources"]["gold"], before["resources"]["gold"] + 1)

    def test_moon_rewards_and_repairs(self):
        s = pending_state("moon")
        p = s["players"]["p0"]
        p.update(deviation=5)
        p["mastery"]["yellow"] = 10
        p["resources"] = dict.fromkeys(RESOURCES, 0)
        s["moon"] = 11
        accept_benefits(s)
        p = s["players"]["p0"]
        self.assertEqual(s["moon"], 5)
        self.assertEqual(p["deviation"], 2)
        self.assertEqual([p["resources"][r] for r in BASIC], [1, 1, 1])

    def test_optional_fixed_rewards_can_be_declined(self):
        for reward in (effect("moon"), effect("mastery", track="blue"),
                       effect("produce", resource="iron"), effect("gain", items={"gold": 1})):
            with self.subTest(reward=reward):
                s = pending_state(reward["kind"], **{k: v for k, v in reward.items() if k != "kind"})
                s["players"]["p0"]["mastery"]["blue"] = 11
                before = copy.deepcopy(s)
                _settle(s)
                self.assertEqual(s["players"], before["players"])
                self.assertIn("accept", Game.get_legal_actions(s, "p0"))
                move = next(m for m in Game.get_public_view(s, "p0")["moves"] if m["type"] == "skip")
                self.assertIsNone(Game.apply_action(s, "p0", move)[1])
                self.assertEqual(s["players"], before["players"])
                self.assertEqual(s["royals"], before["royals"])
                self.assertEqual(s["moon"], before["moon"])
                self.assertEqual(s["pending"], [])

    def test_pass_moon_can_be_declined_but_rooster_step_is_required(self):
        s = new_game()
        moon, rooster = s["moon"], s["rooster"]
        for kind in ("pass", "skip", "skip"):
            move = next(m for m in Game.get_public_view(s, "p0")["moves"] if m["type"] == kind)
            self.assertIsNone(Game.apply_action(s, "p0", move)[1])
        self.assertEqual(s["moon"], moon)
        self.assertEqual(s["rooster"], rooster - 1)
        self.assertEqual(s["pending"], [])
        self.assertTrue(s["main_done"])

    def test_mastery_rewards_and_first_royal(self):
        s = pending_state("mastery")
        s["players"]["p0"]["mastery"]["blue"] = 3
        act(s, kind="mastery", track="blue")
        self.assertEqual(s["pending"][0]["kind"], "scroll")
        act(s, kind="take_scroll", index=0)
        self.assertEqual(len(s["players"]["p0"]["scrolls"]), 1)
        for pid in s["order"]:
            s["players"][pid]["mastery"]["pink"] = 11
        s["royals"]["pink"] = "scrolls"
        _advance_mastery(s, "p0", "pink")
        _advance_mastery(s, "p1", "pink")
        self.assertEqual(s["players"]["p0"]["royals"], ["scrolls"])
        self.assertEqual(s["players"]["p1"]["royals"], [])
        self.assertEqual(s["players"]["p0"]["score"], 16)

    def test_apostle_capacity_uniqueness_deviation_and_gears(self):
        s = pending_state("apostle")
        p = s["players"]["p0"]
        p.update(warehouse=[], assistant=None, deviation=0)
        s["gears"] = 0
        self.assertEqual(available_apostles(0), (1, 2))
        act(s, kind="take_apostle", steps=1, apostle=11)
        self.assertEqual(s["players"]["p0"]["warehouse"], [11])
        self.assertEqual(s["players"]["p0"]["deviation"], 1)
        self.assertEqual((s["gears"], s["rooster"]), (2, 3))
        s["pending"] = [effect("apostle")]
        s["players"]["p0"]["assistant"] = "scholar"
        self.assertFalse(any(m["type"] == "take_apostle" for m in legal_moves(s, "p0")))
        s["players"]["p0"]["assistant"] = None
        self.assertFalse(any(m.get("apostle") == 11 for m in legal_moves(s, "p0") if m["type"] == "take_apostle"))

    def test_placing_apostle_row_column_and_worker_rewards(self):
        s = new_game()
        p = s["players"]["p0"]
        p.update(warehouse=[11], panel=[5, 1, 2, None] + [None] * 8)
        p["resources"]["paint"] = 1
        before = p["workers"], p["score"]
        act(s, kind="place_apostle", apostle=11, slot=3, payment={"paint": 1})
        self.assertEqual(s["players"]["p0"]["workers"], before[0] + 1)
        self.assertEqual(s["players"]["p0"]["score"], before[1] + 7)
        self.assertEqual(s["pending"][0]["kind"], "produce")
        s["pending"] = []
        s["players"]["p0"]["panel"] = [5] + [None] * 3 + [3] + [None] * 7
        s["players"]["p0"]["warehouse"] = [1]
        s["players"]["p0"]["resources"]["iron"] = 1
        act(s, kind="place_apostle", apostle=1, slot=8, payment={"iron": 1})
        self.assertEqual(s["pending"][0]["kind"], "assistant_moon")

    def test_build_cost_hammer_and_cross_ring_component(self):
        s = pending_state("build")
        s["players"]["p0"]["resources"] = dict.fromkeys(RESOURCES, 10)
        s["players"]["p0"]["deviation"] = 0
        for cells in s["board"].values():
            for cell in cells:
                cell.update(built=False, owner=None)
        s["board"]["months"][11].update(built=True, owner="p0")
        s["board"]["zodiac"][0].update(built=True, owner="p0")
        before = s["players"]["p0"]["score"]
        move = act(s, kind="build", zone="months", slot=0, steps=0)
        self.assertEqual(group_size(s["board"], "months", 0, "p0"), 3)
        self.assertEqual(s["players"]["p0"]["score"] - before, sum(move["payment"].values()) * 2 + 6)
        self.assertEqual(construction_cost("months", 5), {"gold": 1, "wood": 1, "iron": 1})
        self.assertEqual(HAMMER_CELLS[0], (0, 1, 3, 4))

    def test_recovery_removes_ownership_without_unbuilding(self):
        s = pending_state("recover", count=2)
        s["board"]["months"][0].update(built=True, owner="p0")
        s["clock_workers"][3] = "p0"
        workers = s["players"]["p0"]["workers"]
        act(s, kind="recover", zone="months", slot=0)
        act(s, kind="recover", zone="clock", slot=3)
        self.assertEqual(s["players"]["p0"]["workers"], workers + 2)
        self.assertEqual(s["board"]["months"][0]["owner"], None)
        self.assertTrue(s["board"]["months"][0]["built"])

    def test_workshop_shift_slot_unlock_and_seam(self):
        s = pending_state("workshop")
        s["players"]["p0"]["resources"] = dict.fromkeys(RESOURCES, 20)
        s["market"] = ["w01", "w02", "w03"]
        s["workshop_deck"] = ["w04"]
        workers = s["players"]["p0"]["workers"]
        act(s, kind="workshop", index=2, side="right")
        self.assertEqual(s["market"], ["w04", "w01", "w02"])
        self.assertEqual(s["players"]["p0"]["workers"], workers + 1)
        s["pending"] = [effect("workshop")]
        act(s, kind="workshop", index=2, side="left")
        self.assertEqual(s["players"]["p0"]["workers"], workers + 1)
        self.assertEqual([w["card"] for w in s["players"]["p0"]["workshops"]], ["w02", "w03"])

    def test_exhausted_workshop_market_preserves_price_slots(self):
        s = pending_state("workshop")
        s["players"]["p0"]["resources"] = dict.fromkeys(RESOURCES, 20)
        s["market"], s["workshop_deck"] = ["w01", "w02", "w03"], []
        act(s, kind="workshop", index=0, side="right")
        self.assertEqual(s["market"], [None, "w02", "w03"])
        s["pending"] = [effect("workshop")]
        choices = [m for m in legal_moves(s, "p0") if m["type"] == "workshop"]
        self.assertEqual({m["index"] for m in choices}, {1, 2})
        self.assertTrue(all(sum(m["payment"].values()) == 4 - m["index"] for m in choices))
        self.assertIn(Game.bot_move(s, "p0"), Game.get_public_view(s, "p0")["moves"])
        act(s, kind="workshop", index=1, side="right")
        self.assertEqual(s["market"], [None, None, "w03"])
        s["pending"] = [effect("workshop")]
        act(s, kind="workshop", index=2, side="right")
        self.assertEqual(s["market"], [None, None, None])
        s["pending"] = [effect("workshop")]
        self.assertNotIn("workshop", Game.get_legal_actions(s, "p0"))
        self.assertIsNotNone(Game.bot_move(s, "p0"))

    def test_assistant_warehouse_duplicate_and_workshop_capacity(self):
        s = pending_state("assistant")
        p = s["players"]["p0"]
        p.update(warehouse=[], assistant=None, workshops=[{"card": "w01", "assistant": None}])
        p["resources"]["paint"] = 1
        act(s, kind="take_assistant", assistant="scholar")
        act(s, kind="place_assistant", index=0, payment={"paint": 1})
        self.assertEqual(score_breakdown(s, "p0")["assistants"], {"scholar": 6})
        s["pending"] = [effect("assistant")]
        s["assistants"]["scholar"] = 2
        self.assertFalse(any(m.get("assistant") == "scholar" for m in legal_moves(s, "p0")))

    def test_sculptor_force_first_and_cannot_repeat_own_space(self):
        s = pending_state("sculptor")
        s["players"]["p0"]["mastery"]["pink"] = 0
        s["players"]["p0"]["deviation"] = 5
        legal = [m for m in legal_moves(s, "p0") if m["type"] == "sculptor"]
        self.assertEqual(legal, [{"type": "sculptor", "index": 3, "option": "moon"}])
        act(s, kind="sculptor", index=3, option="moon")
        s["pending"] = [effect("sculptor")]
        self.assertFalse(any(m.get("index") == 3 for m in legal_moves(s, "p0") if m["type"] == "sculptor"))

    def test_all_six_hammer_rewards_are_defined(self):
        p = new_game()["players"]["p0"]
        for kind in ("painter", "coin", "rooster", "moon", "mastery", "apostle"):
            p["hammer"] = kind
            p["hammer_level"] = 0
            self.assertEqual(_hammer_rewards(p), [])
            for n in (1, 2):
                p["hammer_level"] = n
                self.assertTrue(_hammer_rewards(p))

    def test_objective_claims_two_player_skips_second_position(self):
        s = new_game()
        s["objectives"], s["claims"] = ["upgrades"], {"upgrades": []}
        for pid in s["order"]:
            s["current_turn"] = pid
            s["players"][pid]["production"] = dict.fromkeys(BASIC, 2)
            act(s, pid, kind="claim", objective="upgrades")
            self.assertNotIn({"type": "claim", "objective": "upgrades"}, legal_moves(s, pid))
        self.assertEqual([r["points"] for r in s["claims"]["upgrades"]], [8, 4])

    def test_rooster_waits_for_all_and_residual_deviation_penalty(self):
        s = new_game()
        s.update(main_done=True, call_pending=True, rooster=0)
        s["players"]["p0"].update(deviation=5, rooster=2)
        s["players"]["p1"].update(deviation=1, rooster=4)
        act(s, kind="end_turn")
        self.assertEqual(s["phase"], "round_end")
        self.assertEqual([r["points"] for r in s["review"]], [-3, 3])
        act(s, kind="next_round")
        self.assertEqual(s["phase"], "round_end")
        self.assertEqual(Game.bot_move(s, "p0"), None)
        act(s, "p1", kind="next_round")
        self.assertEqual((s["phase"], s["current_turn"], s["round"]), ("turn", "p1", 2))

    def test_fourth_call_finishes_equal_turns_and_never_fifth_call(self):
        s = new_game()
        s.update(calls=3, main_done=True, call_pending=True, rooster=0)
        act(s, kind="end_turn")
        act(s, kind="next_round")
        act(s, "p1", kind="next_round")
        self.assertEqual(s["phase"], "turn")
        act(s, "p1", kind="pass")
        while s["pending"]:
            act(s, "p1", kind="skip")
        act(s, "p1", kind="end_turn")
        self.assertTrue(s["game_over"])
        self.assertEqual(s["calls"], 4)
        self.assertEqual([p["turns"] for p in s["players"].values()], [1, 1])

    def test_calendar_completion_and_final_construction_no_worker(self):
        s = pending_state("build")
        for cells in s["board"].values():
            for cell in cells:
                cell.update(built=True, owner=None)
        s["board"]["months"][0]["built"] = False
        s["players"]["p0"]["resources"] = dict.fromkeys(RESOURCES, 5)
        s["players"]["p0"]["hammer_level"] = 0
        act(s, kind="build", zone="months", slot=0, steps=0)
        self.assertEqual(s["finishing"], "calendar")
        s["pending"] = [effect("build")]
        s["players"]["p0"]["workers"] = 0
        before = s["players"]["p0"]["score"]
        act(s, kind="build", zone="final")
        self.assertEqual(s["players"]["p0"]["score"], before + 8)
        self.assertEqual(s["players"]["p0"]["workers"], 0)

    def test_scoring_threshold_ties_caps_and_wild_gold_conversion(self):
        s = new_game(3)
        s["windows"] = {"blue": "apostles", "pink": "upgrades", "yellow": "workshops"}
        for pid in ("p0", "p1"):
            s["players"][pid]["mastery"]["blue"] = 8
            s["players"][pid]["panel"] = list(range(1, 13))
        s["players"]["p2"]["mastery"]["blue"] = 6
        s["players"]["p2"]["panel"] = list(range(1, 13))
        self.assertEqual(score_breakdown(s, "p0")["windows"]["blue"], 15)
        self.assertEqual(score_breakdown(s, "p1")["windows"]["blue"], 15)
        self.assertEqual(score_breakdown(s, "p2")["windows"]["blue"], 0)
        s["players"]["p2"]["mastery"]["blue"] = 7
        self.assertEqual(score_breakdown(s, "p2")["windows"]["blue"], 12)
        self.assertEqual(surplus_gold(dict(paint=2, wood=2, iron=2, coin=3, gold=1)), 4)

    def test_atomic_rejection_stale_boolean_invalid_payment_and_spectator(self):
        s = new_game()
        move = Game.bot_move(s, "p0")
        for action, actor in (({**move, "revision": -1}, "p0"), (move, "p1"), (move, "visitor"),
                              ({**move, "revision": True}, "p0"), ({**move, "payment": {"gold": -2}}, "p0"),
                              (None, "p0"), ({"type": "clock", "steps": float("nan")}, "p0")):
            before = copy.deepcopy(s)
            self.assertIsNotNone(Game.apply_action(s, actor, action)[1])
            self.assertEqual(s, before)
        self.assertIsNone(Game.apply_action(s, "p0", move)[1])
        before = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, "p0", move)[1])
        self.assertEqual(s, before)

    def test_public_view_no_future_decks_and_no_aliases(self):
        s = new_game()
        view = Game.get_public_view(s, "visitor")
        self.assertEqual(view["moves"], [])
        for key in ("seed", "workshop_deck", "scroll_deck"):
            self.assertNotIn(key, view)
        view["players"][0]["resources"]["gold"] = 1000
        self.assertLess(s["players"]["p0"]["resources"]["gold"], 1000)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(s, restored)
        for bad in ({}, {**s, "version": 8}, {**s, "players": {}}):
            with self.assertRaises(ValueError):
                Game.deserialize(bad)


class OrlojAITests(unittest.TestCase):
    def assert_invariants(self, s):
        for pid, p in s["players"].items():
            self.assertTrue(all(type(v) is int and v >= 0 for v in p["resources"].values()))
            self.assertLessEqual(p["deviation"], 5)
            self.assertGreaterEqual(p["deviation"], 0)
            self.assertLessEqual(len(p["warehouse"]) + int(p["assistant"] is not None), 2)
            pieces = [n for n in p["panel"] + p["warehouse"] if n is not None]
            self.assertEqual(len(pieces), len(set(pieces)))
            locked = 3 - p["production_workers"] + 3 - len(p["market_workers"])
            locked += sum(p["panel"][i] is None for i, slot in enumerate(APOSTLE_SLOTS) if slot["reward"] == "worker")
            workers = p["workers"] + s["clock_workers"].count(pid) + locked
            workers += sum(c["owner"] == pid for cells in s["board"].values() for c in cells)
            workers += sum(c["player_id"] == pid for claims in s["claims"].values() for c in claims)
            self.assertEqual(workers, 14 if len(s["order"]) == 2 else 13)

    def test_ai_public_only_deterministic_and_immutable(self):
        s = new_game()
        view = Game.get_public_view(s, "p0")
        before = copy.deepcopy(view)
        self.assertIn(choose_move(view), view["moves"])
        self.assertEqual(view, before)
        other = copy.deepcopy(s)
        other["seed"] += 1
        other["workshop_deck"].reverse()
        other["scroll_deck"].reverse()
        self.assertEqual(Game.bot_move(s, "p0"), Game.bot_move(other, "p0"))
        self.assertIsNone(Game.bot_move(s, "visitor"))

    def test_full_ai_games_multiplayer_seeds_rounds_and_conservation(self):
        for count in (2, 3, 4):
            for seed in (3, 17, 125):
                with self.subTest(players=count, seed=seed):
                    s = new_game(count, seed)
                    for step in range(2200):
                        self.assert_invariants(s)
                        if s["game_over"]:
                            break
                        pid = next((pid for pid in s["order"] if Game.get_legal_actions(s, pid)), None)
                        self.assertIsNotNone(pid)
                        action = Game.bot_move(s, pid)
                        self.assertIsNotNone(action)
                        self.assertIsNone(Game.apply_action(s, pid, action)[1])
                    self.assertTrue(s["game_over"], (s["phase"], s["pending"]))
                    self.assertEqual(len({p["turns"] for p in s["players"].values()}), 1)
                    self.assertTrue(s["result"]["winners"])


if __name__ == "__main__":
    unittest.main()
