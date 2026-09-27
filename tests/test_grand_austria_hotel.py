import copy
import json
import unittest

from game.grand_austria_hotel import GrandAustriaHotelGame as Game, _queue, _settle, _end_round, _final_score, staff_points
from game.grand_austria_hotel_ai import choose_move
from game.grand_austria_hotel_data import EMPERORS, FOOD, GUESTS, ROOMS, STAFF, effect, hire, prepare


def new_game(count=2, seed=12):
    return Game.init_game({"seed": seed}, [{"player_id": str(i), "seat": i, "name": f"Hotel {i}"} for i in range(count)])


def playing(count=2):
    state = new_game(count)
    state.update(phase="turn", pending=[], current_turn="0", slots=[str(i) for i in range(count)] + [str(i) for i in reversed(range(count))],
                 slot=0, done=[], passed=[], dice=[2, 2, 2, 2, 2, 0], turn={"die": False, "recruited": False, "touched": False},
                 round_scores={str(i): 0 for i in range(count)})
    for player in state["players"].values():
        player["rooms"][:3] = [1, 1, 1]
    return state


def act(state, pid, kind, **fields):
    view = Game.get_public_view(state, pid)
    move = next((m for m in view["moves"] if m["type"] == kind and all(m.get(k) == v for k, v in fields.items())), None)
    if move is None:
        raise AssertionError((kind, fields, state["phase"], state["pending"], view["moves"]))
    _, error = Game.apply_action(state, pid, move)
    if error:
        raise AssertionError(error)
    return move


def finish_pending(state):
    for _ in range(250):
        if not state["pending"]:
            return
        pid = state["pending"][0]["owner"]
        move = Game.bot_move(state, pid)
        if not move:
            raise AssertionError(state["pending"])
        _, error = Game.apply_action(state, pid, move)
        if error:
            raise AssertionError(error)
    raise AssertionError("reward chain did not finish")


class GrandAustriaHotelTests(unittest.TestCase):
    def test_component_counts_and_transcribed_rules(self):
        self.assertEqual(len(GUESTS), 56)
        self.assertEqual(len(STAFF), 48)
        self.assertEqual(len(EMPERORS), 12)
        self.assertEqual(len(ROOMS), 20)
        self.assertEqual(GUESTS["53"]["order"], {"strudel": 1, "wine": 1})
        self.assertEqual(GUESTS["94"]["order"], {"strudel": 2})
        self.assertEqual(GUESTS["52"]["order"], {"wine": 1, "coffee": 1})
        self.assertEqual(STAFF["17"]["cost"], 5)

    def test_initial_setup_reverse_guests_and_three_adjacent_rooms(self):
        state = new_game(3)
        self.assertEqual(state["current_turn"], "2")
        for pid in ("2", "1", "0"):
            self.assertEqual(state["current_turn"], pid)
            act(state, pid, "recruit", slot=0)
            self.assertEqual(state["players"][pid]["money"], 10)
        for pid in ("0", "1", "2"):
            self.assertEqual([m["room"] for m in Game.get_public_view(state, pid)["moves"]], [0])
            for room in (0, 1, 2):
                act(state, pid, "prepare", room=room)
        self.assertEqual(state["phase"], "turn")
        self.assertEqual(sum(state["dice"]), 12)
        self.assertEqual(state["slots"], ["0", "1", "2", "2", "1", "0"])

    def test_die_strength_paid_boost_and_food_ratios(self):
        state = playing()
        state["dice"] = [3, 0, 0, 0, 0, 0]
        act(state, "0", "dice", face=1, boost=True, split=2)
        self.assertEqual(state["dice"][0], 2)
        self.assertEqual(state["players"]["0"]["money"], 9)
        self.assertEqual(state["pending"][0]["items"], {"strudel": 2, "cake": 2})
        act(state, "0", "store_food")
        self.assertNotIn("dice", Game.get_legal_actions(state, "0"))
        self.assertEqual(state["players"]["0"]["kitchen"]["cake"], 3)

    def test_six_uses_its_pool_and_does_not_trigger_other_faces(self):
        state = playing()
        player = state["players"]["0"]
        player["staff"] = ["13", "15", "16", "18", "20"]
        state["dice"] = [6, 1, 1, 1, 1, 2]
        act(state, "0", "dice", face=6, action=4, split=1, boost=False)
        player = state["players"]["0"]
        self.assertEqual((player["money"], player["emperor"], player["score"]), (10, 1, 0))

    def test_kitchen_hand_and_bootblack(self):
        state = playing()
        state["players"]["0"]["staff"] = ["17"]
        state["dice"] = [1, 0, 0, 1, 0, 2]
        act(state, "0", "dice", face=6, action=1, boost=False, split=1)
        self.assertEqual(state["pending"][0]["items"], {"strudel": 2, "cake": 1})
        self.assertEqual(state["players"]["0"]["money"], 10)
        state = playing()
        state["players"]["0"]["staff"] = ["15"]
        act(state, "0", "dice", face=4, boost=True)
        self.assertEqual((state["players"]["0"]["money"], state["players"]["0"]["emperor"]), (12, 3))

    def test_free_new_food_then_paid_kitchen_service_is_capped_at_three(self):
        state = playing()
        p = state["players"]["0"]
        p["cafe"] = [{"id": "58", "served": {}}]
        p["kitchen"] = dict.fromkeys(FOOD, 5)
        _queue(state, "0", [effect("food", items={"wine": 1})])
        act(state, "0", "gain_food", food="wine", guest="58")
        self.assertEqual(state["players"]["0"]["kitchen"]["wine"], 5)
        self.assertEqual(state["players"]["0"]["money"], 10)
        act(state, "0", "serve")
        for key in ("wine", "wine", "coffee"):
            act(state, "0", "serve_item", food=key, guest="58")
        self.assertFalse(state["pending"])
        self.assertEqual(state["players"]["0"]["money"], 9)
        self.assertEqual(state["players"]["0"]["cafe"][0]["served"], {"wine": 3, "coffee": 1})

    def test_adjacency_colors_and_group_rewards(self):
        state = playing()
        p = state["players"]["0"]
        p["cafe"] = [{"id": "65", "served": {"coffee": 1}}]
        options = Game.get_public_view(state, "0")["moves"]
        self.assertEqual([m["room"] for m in options if m["type"] == "check_in"], [0])
        act(state, "0", "check_in", guest="65", room=0)
        self.assertEqual(state["players"]["0"]["score"], 5)
        _queue(state, "0", [prepare(2)])
        rooms = [m["room"] for m in Game.get_public_view(state, "0")["moves"] if m["type"] == "prepare"]
        self.assertIn(5, rooms)
        self.assertNotIn(19, rooms)

    def test_green_guest_any_color_and_repeat_group_after_penalty(self):
        state = playing()
        p = state["players"]["0"]
        p["cafe"] = [{"id": "92", "served": {"strudel": 1}}]
        self.assertEqual(len([m for m in Game.get_public_view(state,"0")["moves"] if m["type"] == "check_in"]), 3)
        act(state, "0", "check_in", guest="92", room=0)
        p = state["players"]["0"]
        p["rooms"][0] = 1
        _queue(state, "0", [effect("occupy")])
        act(state, "0", "occupy", room=0)
        self.assertEqual(state["players"]["0"]["score"], 4)

    def test_staff_one_per_round_and_hire_discount(self):
        state = playing()
        p = state["players"]["0"]
        p["hand"] = ["1"]
        act(state, "0", "dice", face=5, boost=False)
        act(state, "0", "hire", staff="1")
        self.assertEqual(state["players"]["0"]["money"], 8)
        act(state, "0", "use_staff", staff="1")
        act(state, "0", "store_food")
        self.assertNotIn("use_staff", Game.get_legal_actions(state, "0"))

    def test_offer_privacy_return_order_and_no_spurious_card_draw(self):
        state = playing()
        state["staff_deck"] = ["21", "38", "45", "2"]
        _queue(state, "0", [hire(9, offer=True)])
        _settle(state)
        before = len(state["players"]["0"]["hand"])
        other = Game.get_public_view(state, "1")
        self.assertNotIn("cards", other["pending"])
        act(state, "0", "hire", staff="45")
        self.assertEqual(len(state["players"]["0"]["hand"]), before)
        act(state, "0", "return_staff", staff="38")
        act(state, "0", "return_staff", staff="21")
        self.assertEqual(state["staff_deck"], ["2", "38", "21"])

    def test_staff_manager_can_hire_before_room_action(self):
        state = playing()
        p = state["players"]["0"]
        p["staff"] = ["22"]
        p["hand"] = ["11"]
        act(state, "0", "dice", face=3, boost=False, timing="before")
        act(state, "0", "hire", staff="11")
        act(state, "0", "prepare", room=5)
        self.assertEqual(state["players"]["0"]["money"], 5)

    def test_gizia_does_not_consume_or_boost_die_or_trigger_staff(self):
        state = playing()
        state["players"]["0"]["staff"] = ["19"]
        _queue(state, "0", [effect("extra_die")])
        before = list(state["dice"])
        self.assertTrue(all(not m["boost"] for m in Game.get_public_view(state,"0")["moves"] if m["type"] == "bonus_die"))
        act(state, "0", "bonus_die", face=3)
        self.assertEqual(state["dice"], before)
        self.assertEqual(state["players"]["0"]["score"], 0)
        self.assertFalse(state["turn"]["die"])

    def test_every_guest_reward_chain_is_resolvable(self):
        for gid, guest in GUESTS.items():
            with self.subTest(guest=gid):
                state = playing()
                p = state["players"]["0"]
                p["money"] = 20
                p["rooms"] = [1] * 20
                p["cafe"] = [{"id": gid, "served": dict(guest["order"])}]
                options = [m for m in Game.get_public_view(state,"0")["moves"] if m["type"] == "check_in"]
                self.assertTrue(options)
                _, err = Game.apply_action(state, "0", options[0])
                self.assertIsNone(err)
                finish_pending(state)
                self.assertEqual(state["players"]["0"]["completed_guests"], 1)

    def test_gizia_collects_check_in_benefits_before_bonus_action(self):
        state = playing()
        state["dice"] = [0, 0, 0, 0, 0, 1]
        player = state["players"]["0"]
        player.update(money=0, staff=["8", "23"],
                      cafe=[{"id": "97", "served": dict(GUESTS["97"]["order"])}])
        act(state, "0", "check_in", guest="97", room=0)
        self.assertEqual(state["players"]["0"]["money"], 1)
        self.assertEqual(state["players"]["0"]["score"], 8)
        self.assertEqual(state["pending"][0]["kind"], "extra_die")
        act(state, "0", "bonus_die", face=6, action=4, split=1)
        self.assertEqual(state["players"]["0"]["money"], 0)
        self.assertEqual(state["players"]["0"]["emperor"], 1)
        self.assertEqual(state["dice"], [0, 0, 0, 0, 0, 1])

    def test_pass_preserves_slots_rerolls_and_cannot_follow_an_action(self):
        state = playing()
        total = sum(state["dice"])
        act(state,"0","pass")
        self.assertEqual(state["current_turn"],"1")
        self.assertFalse(state["done"])
        act(state,"1","pass")
        self.assertEqual(sum(state["dice"]),total-1)
        self.assertEqual(state["current_turn"],"0")
        act(state,"0","recruit",slot=4)
        self.assertNotIn("pass",Game.get_legal_actions(state,"0"))

    def test_all_passing_exhausts_dice_without_deadlock(self):
        state = playing()
        state["dice"] = [1,0,0,0,0,0]
        act(state,"0","pass")
        act(state,"1","pass")
        self.assertEqual(state["phase"],"round_end")

    def test_round_end_requires_every_seat_and_rotates_start(self):
        state = playing()
        _end_round(state)
        act(state,"0","next_round")
        self.assertEqual(state["round"],1)
        self.assertFalse(Game.get_legal_actions(state,"0"))
        act(state,"1","next_round")
        self.assertEqual((state["round"],state["current_turn"]),(2,"1"))

    def test_emperor_points_retreat_rewards_and_penalties(self):
        state = playing()
        state.update(round=3,emperors=["A1","B2","C1"])
        state["players"]["0"].update(emperor=6,money=19)
        state["players"]["1"].update(emperor=3,money=2)
        _end_round(state)
        self.assertEqual(state["phase"],"round_end")
        a,b = state["players"]["0"],state["players"]["1"]
        self.assertEqual((a["emperor"],a["score"],a["money"]),(3,4,20))
        self.assertEqual((b["emperor"],b["score"],b["money"]),(0,-2,2))
        reward, penalty = Game.get_public_view(state, "watcher")["emperor_review"]
        self.assertEqual((reward["position_before"], reward["position_after_retreat"], reward["track_points"]), (6, 3, 4))
        self.assertEqual(reward["changes"], {"money": 1})  # The 20-krone cap applies.
        self.assertEqual(penalty["changes"], {"score": -5})  # Track points are separate.
        self.assertEqual((reward["outcome"], penalty["outcome"]), ("reward", "penalty"))

    def test_emperor_report_waits_for_choices_and_survives_reconnect(self):
        state = playing()
        state.update(round=3, emperors=["A3", "B1", "C1"])
        state["players"]["0"]["hand"] = ["1", "4", "13"]
        state["players"]["1"]["emperor"] = 4
        _end_round(state)
        self.assertFalse(state["emperor_review"][0]["resolved"])
        act(state, "0", "return_staff", staff="1")
        state = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        public = Game.get_public_view(state, "watcher")
        self.assertNotIn("before", public["emperor_review"][0])
        self.assertNotIn("changes", public["emperor_review"][0])
        self.assertEqual(public["players"][0]["hand"], [])
        act(state, "0", "return_staff", staff="4")
        penalty, neutral = Game.get_public_view(state, "watcher")["emperor_review"]
        self.assertTrue(penalty["resolved"])
        self.assertEqual(penalty["changes"], {"hand": -2})
        self.assertEqual((neutral["outcome"], neutral["track_points"], neutral["changes"]), ("neutral", 3, {}))
        act(state, "0", "next_round")
        act(state, "1", "next_round")
        self.assertEqual(state["emperor_review"], [])

    def test_emperor_report_distinguishes_avoided_penalty(self):
        for decision, changes, avoided in (("avoid_penalty", {"money": -1}, True),
                                          ("accept_penalty", {"money": -3}, False)):
            with self.subTest(decision=decision):
                state = playing()
                state.update(round=3, emperors=["A1", "B1", "C1"])
                state["players"]["0"]["staff"] = ["26"]
                _end_round(state)
                act(state, "0", decision)
                report = state["emperor_review"][0]
                self.assertTrue(report["resolved"])
                self.assertEqual((report["changes"], report["avoided"]), (changes, avoided))

    def test_emperor_report_excludes_final_scoring_and_accepts_old_saves(self):
        state = playing()
        del state["emperor_review"]  # Existing saves predate public emperor reports.
        self.assertEqual(Game.get_public_view(state, "0")["emperor_review"], [])
        state.update(round=7, emperors=["A1", "B1", "C1"])
        state["players"]["0"]["emperor"] = 13
        _end_round(state)
        self.assertEqual(state["emperor_review"][0]["changes"], {"score": 8})
        self.assertEqual(state["emperor_review"][1]["changes"], {"score": -8})
        self.assertGreater(state["players"]["0"]["score"], 9 + 8)

    def test_all_emperor_tiles_both_paths(self):
        for tile in EMPERORS:
            for favored in (True, False):
                with self.subTest(tile=tile,favored=favored):
                    state = playing()
                    stage = "ABC".index(tile[0])
                    state["round"] = (3,5,7)[stage]
                    state["emperors"][stage] = tile
                    for p in state["players"].values():
                        p["emperor"] = 13 if favored else 0
                        p["rooms"] = [1]*10+[2]*10
                        p["staff"] = ["31"]
                        p["cafe"] = [{"id":"58","served":{"wine":1}}]
                    _end_round(state)
                    finish_pending(state)
                    self.assertEqual(state["phase"],"round_end")
                    self.assertTrue(all(p["money"]>=0 for p in state["players"].values()))
                    self.assertTrue(all(row["resolved"] for row in state["emperor_review"]))
                    self.assertEqual(len(state["emperor_review"]), 2)

    def test_conference_manager_and_highest_two_different_floors(self):
        state = playing()
        state["players"]["0"]["staff"] = ["26"]
        _queue(state,"0",[effect("penalty",code="money3")])
        act(state,"0","avoid_penalty")
        self.assertEqual(state["players"]["0"]["money"],9)
        p=state["players"]["0"]
        p["rooms"]=[0]*20
        p["rooms"][19]=p["rooms"][18]=p["rooms"][6]=2
        _queue(state,"0",[effect("penalty",code="occupied2")])
        act(state,"0","accept_penalty")
        act(state,"0","remove_room",room=19)
        self.assertEqual([m["room"] for m in Game.get_public_view(state,"0")["moves"]],[6])
        act(state,"0","remove_room",room=6)
        self.assertEqual(state["players"]["0"]["rooms"][18],2)

    def test_objective_race_three_rewards_and_once_per_player(self):
        state=playing(4)
        state["objectives"]=["105"]
        state["claims"]={"105":[]}
        for i in range(4):
            pid=str(i)
            state["current_turn"]=pid
            state["players"][pid]["money"]=20
            if i<3:
                act(state,pid,"claim",objective="105")
                self.assertEqual(state["players"][pid]["score"],(15,10,5)[i])
            self.assertNotIn("claim",Game.get_legal_actions(state,pid))

    def test_final_scoring_ties_unserved_guests_and_operator(self):
        state=playing()
        for p in state["players"].values():
            p.update(score=5,money=2,emperor=5,rooms=[2]+[0]*19,staff=["41"],cafe=[{"id":"65","served":{}}])
        _final_score(state)
        self.assertEqual(state["result"]["winners"],["0","1"])
        self.assertEqual(state["players"]["0"]["score"],17)
        state["players"]["0"]["emperor"]=13
        self.assertEqual(staff_points(state,"0","41"),26)

    def test_invalid_or_repeated_actions_leave_state_unchanged(self):
        state=playing()
        candidate=Game.get_public_view(state,"0")["moves"][0]
        bad=[None,[],{"type":"dice"},dict(candidate,face=True),dict(candidate,face=1.0),dict(candidate,split=99),dict(candidate,extra="x")]
        for action in bad:
            before=copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state,"0",action)[1])
            self.assertEqual(state,before)
        self.assertIsNone(Game.apply_action(state,"0",candidate)[1])
        before=copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state,"0",candidate)[1])
        self.assertEqual(state,before)
        self.assertIsNotNone(Game.apply_action(state,"spectator",dict(candidate,revision=state["revision"]))[1])

    def test_save_roundtrip_and_private_data_never_affect_current_bot_choice(self):
        state=playing()
        restored=Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(restored,state)
        view=Game.get_public_view(state,"0")
        for private in ("seed","random_index","guest_deck","staff_deck"):
            self.assertNotIn(private,view)
        self.assertEqual(view["players"][1]["hand"],[])
        self.assertFalse(Game.get_public_view(state,"watcher")["moves"])
        move=choose_move(view)
        state["seed"]=-55
        state["guest_deck"].reverse()
        state["staff_deck"].reverse()
        state["players"]["1"]["hand"].reverse()
        self.assertEqual(Game.bot_move(state,"0"),move)
        restored["players"]["0"]["money"]=0
        self.assertEqual(state["players"]["0"]["money"],10)

    def test_seeded_ai_games_all_player_counts_and_save_resume(self):
        for count in (2,3,4):
            for seed in (1,3,17):
                with self.subTest(count=count,seed=seed):
                    state=new_game(count,seed)
                    reviews=set()
                    for step in range(1800):
                        if state["game_over"]:
                            break
                        if state["phase"]=="round_end":
                            reviews.add(state["round"])
                        for pid in state["turn_order"]:
                            move=Game.bot_move(state,pid)
                            if move:
                                self.assertIsNone(Game.apply_action(state,pid,move)[1])
                                break
                        else:
                            self.fail(f"Deadlock: {state['phase']} {state['pending']}")
                        self.assertTrue(all(0<=p["money"]<=20 and 0<=p["emperor"]<=13 for p in state["players"].values()))
                        if step==50:
                            state=Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
                    self.assertTrue(state["game_over"])
                    self.assertEqual(reviews,set(range(1,8)))
                    self.assertTrue(state["result"]["winners"])


if __name__ == "__main__":
    unittest.main()
