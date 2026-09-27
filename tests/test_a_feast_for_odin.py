import copy
import json
import unittest

from game.a_feast_for_odin import (
    AFeastForOdinGame as Game, _begin_income, _breed, _finish_feast, _finish_game,
    _gain, _settle, _start_round, board_bonuses, board_income, feast_plan,
    legal_moves, new_board, occupied_cells, placement_error, score_breakdown,
)
from game.a_feast_for_odin_data import ACTIONS, BOARDS, GOODS, OCCUPATIONS, SHIPS, SPECIALS, effect
from game.a_feast_for_odin_ai import choose_move


def new_game(n=2, seed=126, rounds=7):
    return Game.init_game({"seed": seed, "rounds": rounds}, [{"player_id": f"p{i}", "name": f"Viking {i}", "seat": i} for i in range(n)])


def act(state, pid, kind, **kwargs):
    move = {"type": kind, **kwargs, "revision": state["revision"]}
    _, error = Game.apply_action(state, pid, move)
    if error:
        raise AssertionError((error, move))
    return move


def pending_state(kind, **kwargs):
    s = new_game()
    s["current_turn"] = "p0"
    s["active"] = {"space": "hunt1", "action": "hunt1", "used": True, "gains": {}}
    s["occupied"]["hunt1"] = {"player_id": "p0", "workers": 3, "round": 1, "action": "hunt1"}
    s["players"]["p0"]["workers"] = 3
    s["pending"] = [effect(kind, main=True, **kwargs)]
    _settle(s)
    return s


class OdinRulesTests(unittest.TestCase):
    def test_setup_long_short_single_and_invalid(self):
        for rounds in (6, 7):
            for n in range(1, 5):
                s = new_game(n, rounds=rounds)
                self.assertEqual(len(s["mountains"]), 3 if n == 4 else 2)
                for p in s["players"].values():
                    self.assertEqual(p["workers"], 13-rounds)
                    self.assertEqual(sum(p["weapons"].values()), 4)
                    self.assertEqual(p["stock"]["mead"], 1)
                    self.assertEqual(p["stock"]["peas"], 1)
                    self.assertEqual(p["stock"].get("grain", 0), int(rounds == 6))
                    self.assertEqual(len(p["hand"]), 1)
        for config in ({"rounds": 5}, {"seed": True}, {"rounds": "7"}, {"unknown": 1}):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": "p0"}])
        for players in ([], [{"player_id": "p"}]*2, [{"player_id": ""}]):
            with self.assertRaises(ValueError):
                Game.init_game({}, players)

    def test_catalog_points_geometry_and_unique_shapes(self):
        self.assertEqual(len(ACTIONS), 61)
        self.assertEqual(len(BOARDS["home"]["negative"]), 86)
        self.assertEqual(len(BOARDS["stone_house"]["negative"]), 7)
        self.assertEqual(len(BOARDS["long_house"]["negative"]), 15)
        self.assertEqual([len(GOODS[g]["cells"]) for g in SPECIALS], [5, 5, 5, 5, 6, 6, 7, 7, 8, 9, 9, 9, 10, 12, 13])
        for data in BOARDS.values():
            cells = {tuple(c) for c in data["cells"]}
            self.assertTrue({tuple(c) for c in data["negative"]} <= cells)
            self.assertFalse({tuple(c) for c in data["negative"]} & {(s["x"], s["y"]) for s in data["bonuses"]})

    def test_invalid_actions_are_atomic_and_stale_actions_rejected(self):
        s = new_game()
        pid = s["current_turn"]
        before = copy.deepcopy(s)
        for bad in ({"type": "occupy", "space": "forge", "revision": 0},
                    {"type": "pass", "revision": True}, {"type": "pass", "revision": 0, "cheat": 1},
                    {"type": "place", "revision": 0, "good": [], "board": 0, "x": 0, "y": 0, "rotation": 0, "flip": False}):
            self.assertIsNotNone(Game.apply_action(s, pid, bad)[1])
            self.assertEqual(s, before)
        move = act(s, pid, "occupy", space="fish")
        changed = copy.deepcopy(s)
        self.assertIsNotNone(Game.apply_action(s, pid, move)[1])
        self.assertEqual(s, changed)

    def test_worker_spending_occupancy_and_turn_end(self):
        s = new_game()
        pid = s["current_turn"]
        act(s, pid, "occupy", space="mead")
        self.assertEqual(s["players"][pid]["workers"], 4)
        self.assertEqual(s["players"][pid]["stock"]["mead"], 3)
        act(s, pid, "end_turn")
        other = s["current_turn"]
        self.assertNotEqual(pid, other)
        self.assertNotIn({"type": "occupy", "space": "mead"}, legal_moves(s, other))

    def test_third_column_draw_and_fourth_column_before_after(self):
        s = new_game()
        pid = s["current_turn"]
        n = len(s["players"][pid]["hand"])
        act(s, pid, "occupy", space="weekly3")
        self.assertEqual(len(s["players"][pid]["hand"]), n+1)
        for timing in ("before", "after"):
            t = new_game()
            actor = t["current_turn"]
            act(t, actor, "occupy", space="luxury")
            self.assertEqual(t["pending"][0]["kind"], "timing")
            act(t, actor, "timing", option=timing)
            self.assertEqual(t["pending"][0]["kind"], "occupation")
            if timing == "before":
                self.assertEqual(t["players"][actor]["stock"].get("silver", 0), 0)
            else:
                self.assertEqual(t["players"][actor]["stock"]["silver"], 4)

    def test_home_geometry_color_and_income_guard(self):
        s = new_game()
        p = s["players"]["p0"]
        p["stock"].update(oil=3, rune=2, treasure=1)
        self.assertIsNotNone(placement_error(p, 0, "oil", 1, 10))
        act(s, "p0", "place", board=0, good="oil", x=0, y=11, rotation=0, flip=False)
        self.assertEqual(board_income(p["boards"][0]), 0)  # old references are not mutated
        p = s["players"]["p0"]
        self.assertEqual(board_income(p["boards"][0]), 1)
        self.assertIsNotNone(placement_error(p, 0, "oil", 0, 10))
        self.assertIsNone(placement_error(p, 0, "rune", 0, 10))
        self.assertIsNotNone(placement_error(p, 0, "rune", 0, 11))
        self.assertIsNotNone(placement_error(p, 0, "treasure", 11, 0))
        act(s, "p0", "place", board=0, good="rune", x=0, y=10, rotation=0, flip=False)
        self.assertEqual(board_income(s["players"]["p0"]["boards"][0]), 2)

    def test_rotation_mirror_and_house_restrictions(self):
        s = new_game()
        p = s["players"]["p0"]
        p["boards"].append(new_board("long_house"))
        p["stock"].update(peas=3, ore=3, silver=5, oil=3)
        self.assertIsNotNone(placement_error(p, 1, "ore", 0, 0))
        self.assertIsNotNone(placement_error(p, 1, "peas", 3, 0, 1))
        act(s, "p0", "place", board=1, good="peas", x=0, y=0, rotation=0, flip=True)
        p = s["players"]["p0"]
        self.assertIsNotNone(placement_error(p, 1, "peas", 0, 1))
        self.assertIsNone(placement_error(p, 1, "oil", 0, 1))

    def test_bonus_all_eight_neighbors_and_covering_symbol(self):
        b = new_board("home")
        b["tiles"] = [{"good": "silver", "cells": [[0, 4], [1, 4], [1, 5], [0, 6], [1, 6]]}]
        self.assertEqual(board_bonuses(b), {"ore": 1})
        b["tiles"].append({"good": "silver", "cells": [[0, 5]]})
        self.assertEqual(board_bonuses(b), {})

    def test_upgrade_cannot_upgrade_output_twice(self):
        s = pending_state("upgrade", count=2, steps=1)
        p = s["players"]["p0"]
        p["stock"] = {"peas": 1}
        s["pending"][0]["eligible"] = {"peas": 1}
        act(s, "p0", "upgrade", good="peas")
        self.assertEqual(s["players"]["p0"]["stock"], {"peas": 0, "mead": 1})
        self.assertEqual(s["pending"], [])

    def test_overseas_one_per_type_and_cost(self):
        s = pending_state("overseas")
        s["players"]["p0"]["stock"].update(silver=1, oil=3, hide=1)
        s["pending"] = [effect("overseas", main=True)]
        act(s, "p0", "accept")
        act(s, "p0", "upgrade", good="oil")
        self.assertNotIn({"type": "upgrade", "good": "oil"}, legal_moves(s, "p0"))
        act(s, "p0", "upgrade", good="hide")
        self.assertEqual(s["players"]["p0"]["stock"]["oil"], 2)
        self.assertEqual(s["players"]["p0"]["stock"]["silver"], 0)

    def test_mountain_groups_cannot_repeat_strip(self):
        s = pending_state("mountain", counts=[3, 2])
        first = s["mountains"][0]["id"]
        act(s, "p0", "take_mountain", index=first, count=3)
        self.assertFalse(any(m["type"] == "take_mountain" and m["index"] == first for m in legal_moves(s, "p0")))

    def test_dice_compensation_zero_must_succeed_and_arming_lock(self):
        s = pending_state("dice", mode="whale", boost=4, roll=2, rolls=1, sides=12)
        moves = legal_moves(s, "p0")
        self.assertEqual(moves, [{"type": "succeed", "payment": {}}])
        act(s, "p0", "succeed", payment={})
        self.assertEqual(s["players"]["p0"]["stock"]["whale_meat"], 1)
        s = pending_state("dice", mode="whale", boost=1, roll=11, rolls=3, sides=12)
        act(s, "p0", "fail")
        self.assertEqual(s["players"]["p0"]["workers"], 5)
        self.assertEqual(s["occupied"]["hunt1"]["workers"], 1)
        self.assertEqual(s["players"]["p0"]["weapons"]["spear"], 2)

    def test_pillage_boost_rewards_and_payment(self):
        s = pending_state("dice", mode="pillage", boost=2, roll=6, rolls=3, sides=12)
        s["players"]["p0"]["stock"]["stone"] = 1
        s["players"]["p0"]["weapons"]["sword"] = 1
        act(s, "p0", "succeed", good="jewelry", payment={"stone": 1, "sword": 1})
        self.assertEqual(s["players"]["p0"]["stock"]["jewelry"], 1)
        self.assertEqual(s["weapon_discard"], ["sword"])

    def test_buy_ship_capacity_arming_and_emigration(self):
        s = new_game()
        p = s["players"]["p0"]
        p["stock"].update(silver=30, ore=5)
        act(s, "p0", "buy_ship", ship="longship")
        for _ in range(3):
            act(s, "p0", "arm", index=0)
        self.assertNotIn({"type": "arm", "index": 0}, legal_moves(s, "p0"))
        s["current_turn"] = "p0"
        s["pending"] = [effect("emigrate", main=True)]
        s["active"] = {"space": "emigrate2", "action": "emigrate2", "used": False, "gains": {}}
        act(s, "p0", "emigrate", index=0)
        self.assertEqual(s["players"]["p0"]["emigrations"], ["longship"])
        self.assertEqual(s["players"]["p0"]["ships"], [])
        self.assertEqual(s["players"]["p0"]["stock"]["silver"], 21)

    def test_island_flips_and_unclaimed_silver(self):
        s = new_game()
        s["round"] = 3
        s["islands"][1]["owner"] = "p0"
        _start_round(s)
        self.assertEqual(s["islands"][0]["kind"], "bear")
        self.assertEqual([i["silver"] for i in s["islands"]], [0, 0, 2, 2])
        s["round"] = 4
        _start_round(s)
        self.assertEqual(s["islands"][1]["kind"], "faroe")
        self.assertEqual(s["islands"][2]["silver"], 4)

    def test_breeding_pregnant_dam_survives_without_partner(self):
        p = new_game()["players"]["p0"]
        p["stock"] = {"sheep": 4, "cattle": 0, "pregnant_cattle": 1}
        self.assertEqual(_breed(p), {"sheep": "pregnant", "cattle": "birth"})
        self.assertEqual(p["stock"]["sheep"], 3)
        self.assertEqual(p["stock"]["cattle"], 2)
        self.assertEqual(_breed(p), {"sheep": "birth", "cattle": "pregnant"})
        self.assertEqual(p["stock"]["sheep"], 5)

    def test_feast_color_orientation_overhang_and_penalties(self):
        s = new_game()
        _begin_income(s)
        s["players"]["p0"]["stock"] = {"flax": 2, "mead": 1, "silver": 1}
        act(s, "p0", "serve", good="flax", wide=True)
        self.assertFalse(any(m.get("good") == "flax" for m in legal_moves(s, "p0")))
        act(s, "p0", "serve", good="mead", wide=False)
        self.assertIn({"type": "serve", "good": "flax", "wide": False}, legal_moves(s, "p0"))
        self.assertNotIn({"type": "serve", "good": "flax", "wide": True}, legal_moves(s, "p0"))
        act(s, "p0", "finish_feast")
        self.assertEqual(s["players"]["p0"]["penalties"], 2)

    def test_feast_plan_finds_alternating_food_and_does_not_mutate(self):
        p = new_game()["players"]["p0"]
        p["stock"] = {"grain": 1, "mead": 1}
        before = copy.deepcopy(p)
        plan = feast_plan(p, 6)
        self.assertEqual(sum(m["type"] == "serve_gap" for m in plan), 0)
        self.assertEqual({m["good"] for m in plan}, {"grain", "mead"})
        self.assertEqual(p, before)

    def test_round_barriers_bonus_and_final_income_not_double_counted(self):
        s = new_game()
        for _ in range(2):
            act(s, s["current_turn"], "pass")
        self.assertEqual(s["phase"], "prepare")
        act(s, "p0", "ready")
        self.assertEqual(s["phase"], "prepare")
        act(s, "p1", "ready")
        for pid in s["order"]:
            act(s, pid, "auto_feast")
        self.assertEqual(s["phase"], "round_end")
        act(s, "p0", "next_round")
        self.assertEqual(s["round"], 1)
        act(s, "p1", "next_round")
        self.assertEqual(s["round"], 2)
        s["round"] = s["rounds"]
        _begin_income(s)
        for pid in s["order"]:
            _finish_feast(s, pid)
        self.assertEqual(s["phase"], "final_placement")
        for pid in s["order"]:
            act(s, pid, "ready")
        self.assertTrue(s["game_over"])
        self.assertEqual(score_breakdown(s["players"]["p0"])["silver"], s["players"]["p0"]["stock"].get("silver", 0))

    def test_solo_previous_round_blocks_only_one_round(self):
        s = new_game(1)
        act(s, "p0", "occupy", space="fish")
        act(s, "p0", "end_turn")
        s["round"] = 2
        _start_round(s)
        self.assertIn("fish", s["occupied"])
        self.assertNotIn({"type": "occupy", "space": "fish"}, legal_moves(s, "p0"))
        s["round"] = 3
        _start_round(s)
        self.assertNotIn("fish", s["occupied"])

    def test_four_player_imitation_other_player_only(self):
        s = new_game(4)
        pid = s["current_turn"]
        s["imitation"] = [1, 4]
        act(s, pid, "occupy", space="fish")
        act(s, pid, "end_turn")
        other = s["current_turn"]
        self.assertIn({"type": "occupy", "space": "imitate1", "copy": "fish"}, legal_moves(s, other))
        self.assertNotIn({"type": "occupy", "space": "imitate1", "copy": "fish"}, legal_moves(s, pid))

    def test_privacy_detached_views_and_json_roundtrip(self):
        s = new_game()
        view = Game.get_public_view(s, "p0")
        self.assertNotIn("hand", view["players"][1])
        for key in ("seed", "_rng", "weapon_deck", "occupation_deck", "mountain_deck"):
            self.assertNotIn(key, view)
        spectator = Game.get_public_view(s, "visitor")
        self.assertEqual(spectator["moves"], [])
        self.assertFalse(spectator["can_place"])
        self.assertTrue(all("hand" not in p for p in spectator["players"]))
        view["players"][0]["stock"]["silver"] = 999
        self.assertNotEqual(s["players"]["p0"]["stock"].get("silver"), 999)
        saved = Game.serialize(s)
        restored = Game.deserialize(json.loads(json.dumps(saved)))
        self.assertEqual(Game.serialize(restored), saved)
        pid = s["current_turn"]
        self.assertEqual(Game.bot_move(s, pid), Game.bot_move(restored, pid))

    def test_scoring_shared_victory_and_shed_materials(self):
        s = new_game()
        for p in s["players"].values():
            p["stock"] = {"silver": 9, "pregnant_sheep": 1}
            p["boards"].append(new_board("shed"))
            p["boards"][-1]["materials"] = {"wood": 2, "stone": 3}
            p["ships"] = [{"kind": "knarr", "ore": 0}]
            p["emigrations"] = ["longship"]
            p["specials"] = ["crown"]
            p["occupations"] = ["miller:0"]
        score = score_breakdown(s["players"]["p0"])
        self.assertEqual(score["total"], 5+21+8+3+9+2+3-86-1)
        _finish_game(s)
        self.assertEqual(s["result"]["winners"], ["p0", "p1"])


class OdinAITests(unittest.TestCase):
    def test_bot_uses_only_view_and_keeps_it_unchanged(self):
        s = new_game()
        view = Game.get_public_view(s, s["current_turn"])
        before = copy.deepcopy(view)
        self.assertIn(choose_move(view), view["moves"])
        self.assertEqual(view, before)
        self.assertIsNone(choose_move(Game.get_public_view(s, "watcher")))

    def test_complete_games_and_invariants(self):
        for n, seed in ((1, 3), (2, 17), (3, 126), (4, 31)):
            with self.subTest(players=n, seed=seed):
                s = new_game(n, seed)
                for step in range(2500):
                    if s["game_over"]:
                        break
                    candidates = [s["current_turn"]] if s["phase"] == "action" else s["order"]
                    moved = False
                    for pid in candidates:
                        move = Game.bot_move(s, pid)
                        if move:
                            _, error = Game.apply_action(s, pid, move)
                            self.assertIsNone(error, (step, pid, move, error))
                            moved = True
                            break
                    self.assertTrue(moved, (step, s["phase"], s["pending"]))
                    for pid, p in s["players"].items():
                        self.assertTrue(all(n >= 0 for n in p["stock"].values()))
                        self.assertTrue(all(n >= 0 for n in p["weapons"].values()))
                        spent = sum(o["workers"] for o in s["occupied"].values() if o["player_id"] == pid and o["round"] == s["round"])
                        self.assertEqual(p["workers"]+spent, 12-s["rounds"]+s["round"])
                        self.assertLessEqual(sum(ship["kind"] == "whaler" for ship in p["ships"]), 3)
                        self.assertLessEqual(sum(ship["kind"] != "whaler" for ship in p["ships"]), 4)
                self.assertTrue(s["game_over"], (n, seed, step))
                self.assertEqual(s["round"], 7)
                self.assertEqual(len(s["result"]["scores"]), n)


if __name__ == "__main__":
    unittest.main()
