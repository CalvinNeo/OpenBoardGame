import copy
import json
import unittest
from unittest.mock import patch

from game.the_crew import (TheCrewGame as Game, HELPER, build_deck, resolve_trick,
                           legal_cards, communication_options, _start_trick, _preflight,
                           _planet_order, _special_result, _finish_attempt, _start_draft,
                           _draw_compatible_tasks)
from game.the_crew_ai import choose_action
from game.the_crew_data import SEA_TASKS, SEA_BY_ID, PLANET_MISSIONS, SEA_MISSIONS, task_text
from game.the_crew_tasks import evaluate_task


def make_state(count=3, **config):
    return Game.init_game({"seed": 139, **config}, [
        {"player_id": f"p{i}", "name": f"Crew {i}", "seat": i, "is_bot": False} for i in range(count)
    ])


def action(state, kind, **fields):
    return {"type": kind, **fields, **{key: state[key] for key in ("game_token", "attempt_id", "step")}}


def card(value):
    suit, number = value.split("_")
    return {"id": value, "suit": suit, "rank": int(number)}


def trick(number, winner="p0", cards=("blue_9", "blue_1", "blue_2"), leader="p0"):
    order = ["p0", "p1", "p2"]
    start = order.index(leader)
    order = order[start:] + order[:start]
    return {"number": number, "winner": winner,
            "plays": [{"player_id": p, "card": card(c)} for p, c in zip(order, cards)]}


def bot_step(state):
    for pid in state["humans"]:
        move = choose_action(Game.get_public_view(state, pid))
        if move:
            events, error = Game.apply_action(state, pid, move)
            if error: raise AssertionError((state["phase"], pid, move, error))
            return events
    raise AssertionError(("deadlock", state["phase"], state["current_turn"]))


def to_phase(state, phase):
    for _ in range(250):
        if state["phase"] == phase: return
        bot_step(state)
    raise AssertionError((phase, state["phase"]))


class TheCrewTests(unittest.TestCase):
    def apply(self, state, pid, kind, **fields):
        events, error = Game.apply_action(state, pid, action(state, kind, **fields))
        self.assertIsNone(error)
        return events

    def reject(self, state, pid, move):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, move)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_deck_deal_and_helper_privacy(self):
        self.assertEqual(len({c["id"] for c in build_deck()}), 40)
        for n in (2, 3, 4, 5):
            s = make_state(n)
            hands = [c for p in s["players"].values() for c in p["hand"]]
            helper = [c for col in s["helper_columns"] for c in col]
            self.assertEqual(len({c["id"] for c in hands + helper}), 40)
            self.assertIn("trump_4", {c["id"] for c in s["players"][s["captain"]]["hand"]})
            v = Game.get_public_view(s, "visitor")
            self.assertEqual(v["hand"], [])
            for key in ("seed", "player_meta", "helper_columns", "predictions", "tricks"): self.assertNotIn(key, v)
            self.assertNotIn("seed", v["config"])
            if n == 2:
                self.assertEqual([len(p["hand"]) for p in s["players"].values()], [13, 13])
                self.assertEqual(len(helper), 14)
                public = json.dumps(v)
                for col in s["helper_columns"]: self.assertNotIn('"id": "' + col[0]["id"] + '"', public)
            self.assertEqual(Game.get_legal_actions(s, "visitor"), [])

    def test_bad_configuration(self):
        for config in ({"edition":3}, {"edition":True}, {"edition":2,"mission":33}, {"mission":0}, {"difficulty":0}, {"extra":1}, {"mode":"bad"}, {"seed":[]}):
            with self.subTest(config=config), self.assertRaises(ValueError): make_state(**config)
        for n in (0, 1, 6):
            with self.assertRaises(ValueError): make_state(n)

    def test_follow_suit_and_trump_winner(self):
        s = make_state()
        for pid, ids in zip(s["humans"], [["blue_1"], ["blue_2", "trump_4"], ["green_9", "trump_1"]]): s["players"][pid]["hand"] = list(map(card, ids))
        _start_trick(s, "p0")
        self.apply(s, "p0", "play", card_id="blue_1")
        self.assertEqual(legal_cards(s, "p1"), ["blue_2"])
        self.reject(s, "p1", action(s, "play", card_id="trump_4"))
        self.apply(s, "p1", "play", card_id="blue_2")
        self.assertEqual(set(legal_cards(s, "p2")), {"green_9", "trump_1"})
        self.assertEqual(resolve_trick(trick(1, cards=("blue_1", "green_9", "pink_9"))["plays"]), "p0")
        self.assertEqual(resolve_trick(trick(1, cards=("trump_1", "trump_4", "trump_3"))["plays"]), "p1")

    def test_helper_uncover_waits_for_end_of_trick(self):
        s = make_state(2)
        s["tasks"] = []
        s["spec"]["special"] = "no_nine"
        s["helper_columns"] = [[card("blue_2"), card("blue_1")]]
        s["players"]["p0"]["hand"] = [card("blue_3")]
        s["players"]["p1"]["hand"] = [card("blue_4")]
        _start_trick(s, HELPER)
        self.apply(s, s["captain"], "play", card_id="blue_1")
        for pid in s["humans"]:
            v = Game.get_public_view(s, pid)
            self.assertEqual(v["helper"], [{"card":None,"covered":True}])
        self.apply(s, "p0", "play", card_id="blue_3")
        self.apply(s, "p1", "play", card_id="blue_4")
        self.assertEqual(s["phase"], "trick_review")
        self.assertEqual(Game.get_public_view(s, "p0")["helper"][0]["card"]["id"], "blue_2")

    def test_communication_high_low_only_and_fixed_markers(self):
        s = make_state()
        s["players"]["p0"]["hand"] = list(map(card, ("blue_2", "blue_5", "blue_9", "green_2", "trump_4")))
        _preflight(s)
        self.assertEqual(communication_options(s, "p0"), [{"card_id":"blue_2","markers":["lowest"]}, {"card_id":"blue_9","markers":["highest"]}, {"card_id":"green_2","markers":["only"]}])
        for cid, marker in (("green_2","highest"), ("trump_4","only"), ("blue_5","lowest")):
            self.reject(s, "p0", action(s, "communicate", card_id=cid, marker=marker))
        self.apply(s, "p1", "ready")
        self.apply(s, "p0", "communicate", card_id="blue_2", marker="lowest")
        self.assertEqual(s["ready"], [])
        self.assertEqual(communication_options(s, "p0"), [])
        _start_trick(s, "p0")
        self.apply(s, "p0", "play", card_id="blue_2")
        self.assertTrue(s["communications"]["p0"][0]["played"])
        self.assertEqual(s["communications"]["p0"][0]["marker"], "lowest")
        self.assertEqual(communication_options(s, "p1"), [])

    def test_delayed_hidden_and_shared_communication(self):
        s = make_state(mission=19)
        _preflight(s)
        self.assertEqual(communication_options(s, "p0"), [])
        s["phase"], s["trick_number"] = "trick_review", 2
        self.assertTrue(communication_options(s, "p0"))
        s["communication"] = "hidden"
        option = communication_options(s, "p0")[0]
        self.apply(s, "p0", "communicate", card_id=option["card_id"], marker=option["markers"][0])
        self.assertEqual(s["communications"]["p0"][0]["marker"], "unknown")
        s["communication"], s["shared_tokens"] = "shared", 1
        self.assertTrue(communication_options(s, "p0"))
        option = communication_options(s, "p0")[0]
        self.apply(s, "p0", "communicate", card_id=option["card_id"], marker=option["markers"][0])
        self.assertEqual(communication_options(s, "p1"), [])

    def test_atomic_secret_distress_exchange_and_retry_penalty(self):
        s = make_state(2)
        to_phase(s, "preflight")
        self.apply(s, "p0", "distress", direction="left")
        self.apply(s, "p1", "distress_vote", yes=True)
        before = copy.deepcopy(s["players"])
        selected = {}
        for actor in s["seats"]:
            hand = [col[-1] for col in s["helper_columns"] if col] if actor == HELPER else s["players"][actor]["hand"]
            selected[actor] = next(c for c in hand if c["suit"] != "trump")["id"]
        for actor in s["seats"][:-1]:
            self.apply(s, actor, "exchange", actor=actor, card_id=selected[actor])
            self.assertEqual(s["players"], before)
            self.assertNotIn("exchange_cards", Game.get_public_view(s, "visitor"))
        self.apply(s, s["captain"], "exchange", actor=HELPER, card_id=selected[HELPER])
        self.assertEqual(s["phase"], "preflight")
        self.assertIn(selected[HELPER], [c["id"] for c in s["players"]["p0"]["hand"]])
        self.assertIn(selected["p0"], [c["id"] for c in s["players"]["p1"]["hand"]])
        self.assertTrue(s["distress_active"])
        _finish_attempt(s, False, "retry")
        self.apply(s, "p0", "next_mission")
        self.assertEqual(s["attempt"], 1)
        self.apply(s, "p1", "next_mission")
        self.assertEqual(s["attempt"], 2)
        self.assertTrue(s["distress_active"])
        _finish_attempt(s, True, "success")
        self.assertEqual(s["result"]["counted_attempts"], 3)

    def test_order_tokens_and_simultaneous_completion(self):
        s = make_state()
        s["tasks"] = [dict(id="a",cards=["blue_1"],owner="p0",status="pending",token=1), dict(id="b",cards=["blue_2"],owner="p0",status="pending",token=2)]
        s["tricks"] = [trick(1)]
        self.assertIsNone(_planet_order(s))
        self.assertEqual(s["completed_order"], ["a", "b"])
        s["completed_order"] = []
        s["tasks"][0].update(status="pending", token=2)
        s["tasks"][1].update(status="pending", token="omega")
        self.assertIsNotNone(_planet_order(s))
        s["tasks"][0]["token"], s["tasks"][1]["token"] = ">", ">>"
        self.assertIsNone(_planet_order(s))

    def test_draft_pass_restriction_and_helper_free_assignment(self):
        for edition in (1, 2):
            s = make_state(edition=edition)
            self.assertEqual("pass_task" in Game.get_legal_actions(s, s["captain"]), edition == 2)
        s = make_state(2, edition=2, mission=17)
        t = next(t for t in s["tasks"] if t.get("captainMaySelect", True))
        self.apply(s, s["captain"], "take_task", actor=HELPER, task_id=t["id"])
        self.assertEqual(t["owner"], None)  # Transaction replaced the original object.
        self.assertEqual(next(x for x in s["tasks"] if x["id"] == t["id"])["owner"], HELPER)

    def test_captain_cannot_take_comparison_task(self):
        s = make_state(edition=2)
        s["tasks"] = [{**copy.deepcopy(SEA_BY_ID["sea_04"]), "owner":None, "status":"pending"}]
        _start_draft(s)
        self.reject(s, s["captain"], action(s,"take_task",actor=s["captain"],task_id="sea_04"))
        self.apply(s, s["captain"], "pass_task")

    def test_secret_predictions_and_only_recent_trick(self):
        s = make_state(edition=2)
        task = next(copy.deepcopy(t) for t in SEA_TASKS if t["kind"] == "predictTricks" and t["reveal"] == "hidden")
        task.update(owner="p0",status="pending")
        s["tasks"] = [task]
        _preflight(s)
        self.apply(s, "p0", "predict", task_id=task["id"], value=2)
        self.assertEqual(Game.get_public_view(s,"p0")["tasks"][0]["prediction"], 2)
        self.assertNotIn("prediction", Game.get_public_view(s,"p1")["tasks"][0])
        self.assertTrue(Game.get_public_view(s,"p1")["tasks"][0]["prediction_locked"])
        _finish_attempt(s, False, "end")
        self.assertEqual(Game.get_public_view(s,"p1")["tasks"][0]["prediction"], 2)

    def test_all_ready_barrier_and_idempotent_ready(self):
        s = make_state()
        to_phase(s, "preflight")
        move = action(s, "ready")
        self.apply(s, "p0", "ready")
        self.assertIsNone(Game.apply_action(s,"p0",move)[1])
        self.assertEqual(s["ready"], ["p0"])
        self.apply(s, "p1", "ready")
        self.assertEqual(s["phase"], "preflight")
        self.apply(s, "p2", "ready")
        self.assertEqual(s["current_turn"], s["captain"])
        self.reject(s,"p0",move)

    def test_invalid_actions_are_atomic(self):
        s = make_state()
        for move in (None, [], {"type":[]}, {"type":"missing"}, action(s,"take_task",task_id=[],actor="p0"), action(s,"take_task",task_id="bad",actor="p0"), {**action(s,"pass_task"),"extra":1}, {**action(s,"pass_task"),"step":True}):
            with self.subTest(move=move): self.reject(s,"p0",move)
        self.reject(s,"visitor",action(s,"pass_task"))

    def test_special_missions_reject_broken_conditions(self):
        for special, tricks, target in (("sick",[trick(1)],"p0"), ("no_nine",[trick(1)],None), ("balance",[trick(1),trick(2)],None), ("ordered_rockets",[trick(1,cards=("trump_2","green_1","pink_1"))],None), ("no_pink_trump_lead",[trick(1,cards=("pink_2","pink_1","green_1"))],None)):
            s = make_state()
            s["spec"]["special"], s["tricks"], s["target"] = special, tricks, target
            self.assertIsNotNone(_special_result(s)[1], special)

    def test_campaign_data_and_difficulty_budget(self):
        self.assertEqual((len(PLANET_MISSIONS),len(SEA_MISSIONS),len(SEA_TASKS),len(SEA_BY_ID)),(50,32,96,96))
        for n in (2,3,4,5):
            for difficulty in (1,5,12,20):
                s = make_state(n,edition=2,mode="custom",difficulty=difficulty)
                self.assertEqual(sum(t["difficulty"][len(s["seats"])-3] for t in s["tasks"]),difficulty)
        for t in SEA_TASKS:
            for count in (3,4,5): self.assertTrue(task_text(t,count))

    def test_every_campaign_mission_reaches_review_in_all_player_counts(self):
        for count in (2,3,4,5):
            for edition, maximum in ((1,50),(2,32)):
                for mission in range(1,maximum+1):
                    with self.subTest(count=count,edition=edition,mission=mission):
                        s = make_state(count,edition=edition,mission=mission,seed=13)
                        to_phase(s,"mission_review")
                        self.assertIsInstance(s["result"]["success"],bool)
                        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
                        self.assertEqual(Game.get_public_view(s,"p0"),Game.get_public_view(restored,"p0"))

    def test_bot_receives_only_its_public_view(self):
        s = make_state()
        pid = s["captain"]
        with patch("game.the_crew_ai.choose_action",return_value=None) as ai:
            Game.bot_move(s,pid)
            self.assertEqual(ai.call_args.args[0],Game.get_public_view(s,pid))

    def test_contradictory_draw_replacement_preserves_cost_and_free_choice(self):
        s = make_state(edition=2)
        draw = [copy.deepcopy(SEA_BY_ID[k]) for k in ("sea_78","sea_79")]
        with patch("game.the_crew._draw_tasks",return_value=draw):
            tasks = _draw_compatible_tasks(s)
            self.assertEqual(tasks[0]["id"],"sea_78")
            self.assertNotEqual(tasks[1]["id"],"sea_79")
            self.assertEqual(sum(t["difficulty"][0] for t in tasks),2)
        s["spec"]["special"] = "free"
        draw = [copy.deepcopy(SEA_BY_ID[k]) for k in ("sea_78","sea_79")]
        with patch("game.the_crew._draw_tasks",return_value=draw):
            self.assertEqual([t["id"] for t in _draw_compatible_tasks(s)],["sea_78","sea_79"])
        s["spec"]["special"] = ""
        draw = [copy.deepcopy(SEA_BY_ID[k]) for k in ("sea_04","sea_05","sea_06")]
        with patch("game.the_crew._draw_tasks",return_value=draw):
            tasks = _draw_compatible_tasks(s)
            self.assertTrue(any(t["captainMaySelect"] for t in tasks))
            self.assertEqual(sum(t["difficulty"][0] for t in tasks),8)

    def test_hidden_decision_and_distribution_do_not_leak_tasks(self):
        s = make_state(mission=20)
        v = Game.get_public_view(s,"p0")
        self.assertTrue(all(t["hidden"] for t in v["tasks"]))
        self.assertTrue(all("cards" not in t for t in v["tasks"]))
        s = make_state(mission=24)
        v = Game.get_public_view(s,"p0")
        self.assertNotIn("hidden",v["tasks"][0])
        self.assertTrue(all(t["hidden"] for t in v["tasks"][1:]))

    def test_tokens_handover_and_custom_completion(self):
        s = make_state(mission=23)
        self.apply(s,s["captain"],"tokens",first=0,second=1)
        self.assertEqual([t["token"] for t in s["tasks"][:2]],[2,1])
        s = make_state(5,mission=25)
        to_phase(s,"preflight")
        t = s["tasks"][0]
        owner = t["owner"]
        target = next(p for p in s["humans"] if p != owner)
        self.apply(s,owner,"handover",task_id=t["id"],player_id=target)
        self.assertTrue(s["handover_used"])
        self.assertNotIn("handover",Game.get_legal_actions(s,target))
        s = make_state(mode="custom")
        _finish_attempt(s,True,"complete")
        for pid in s["humans"]: self.apply(s,pid,"next_mission")
        self.assertTrue(s["game_over"])
        self.assertEqual(s["winner_ids"],s["humans"])

    def test_round_barrier_and_campaign_success_reset_distress(self):
        s = make_state(mission=16)
        to_phase(s,"preflight")
        s["players"]["p0"]["hand"] = [card("blue_1"),card("green_2")]
        s["players"]["p1"]["hand"] = [card("blue_2"),card("green_3")]
        s["players"]["p2"]["hand"] = [card("blue_3"),card("green_4")]
        _start_trick(s,"p0")
        for i in range(3): self.apply(s,f"p{i}","play",card_id=f"blue_{i+1}")
        self.assertEqual(s["phase"],"trick_review")
        for pid in ("p0","p1"):
            self.apply(s,pid,"next_round")
            self.assertEqual(s["phase"],"trick_review")
        self.apply(s,"p2","next_round")
        self.assertEqual((s["phase"],s["current_turn"],s["trick_number"]),("playing","p2",2))
        s["distress_active"] = True
        _finish_attempt(s,True,"complete")
        for pid in s["humans"]: self.apply(s,pid,"next_mission")
        self.assertEqual((s["mission"],s["attempt"],s["distress_active"]),(17,1,False))


class DeepSeaTaskTests(unittest.TestCase):
    def result(self, key, tricks, total=4, prediction=None, owner="p0"):
        return evaluate_task(SEA_BY_ID[key],owner,tricks,["p0","p1","p2"],"p1",total,prediction)

    def test_capture_wrong_owner_and_last_trick(self):
        self.assertEqual(self.result("sea_16",[trick(1,cards=("pink_3","pink_1","pink_2"))]),"complete")
        self.assertEqual(self.result("sea_16",[trick(1,"p1",("pink_3","pink_1","pink_2"))]),"failed")
        self.assertEqual(self.result("sea_36",[trick(1,cards=("green_2","green_1","yellow_1"))]),"failed")
        rows = [trick(i,"p1") for i in (1,2,3)] + [trick(4,cards=("green_2","green_1","yellow_1"))]
        self.assertEqual(self.result("sea_36",rows),"complete")

    def test_exact_counts_never_finish_early(self):
        rows = [trick(1,cards=("pink_9","pink_1","yellow_1"))]
        self.assertEqual(self.result("sea_42",rows),"failed")
        rows = [trick(1,cards=("blue_9","pink_1","yellow_1"))]
        self.assertEqual(self.result("sea_42",rows),"pending")
        self.assertEqual(self.result("sea_83",rows),"pending")
        self.assertEqual(self.result("sea_83",rows+[trick(2)]),"failed")
        self.assertEqual(self.result("sea_83",rows+[trick(i,"p1") for i in (2,3,4)]),"complete")

    def test_avoid_and_no_lead(self):
        self.assertEqual(self.result("sea_43",[trick(1,cards=("blue_9","pink_1","yellow_1"))]),"failed")
        self.assertEqual(self.result("sea_57",[trick(1,cards=("trump_4","blue_1","blue_2"))]),"failed")
        self.assertEqual(self.result("sea_60",[trick(1)]),"failed")
        self.assertEqual(self.result("sea_60",[trick(1,"p1",leader="p1")]),"pending")

    def test_win_with_specific_card_must_be_owner_play(self):
        self.assertEqual(self.result("sea_09",[trick(1,cards=("blue_6","blue_1","blue_2"))]),"complete")
        self.assertEqual(self.result("sea_09",[trick(1,cards=("blue_9","blue_6","blue_2"))]),"pending")
        self.assertEqual(self.result("sea_14",[trick(1,cards=("blue_6","pink_6","blue_2"))]),"complete")
        self.assertEqual(self.result("sea_58",[trick(1,cards=("trump_4","pink_7","blue_2"))]),"complete")

    def test_filters_and_inclusive_sums_exclude_trumps(self):
        self.assertEqual(self.result("sea_46",[trick(1,cards=("blue_8","blue_4","yellow_2"))]),"complete")
        self.assertEqual(self.result("sea_46",[trick(1,cards=("trump_4","blue_4","yellow_2"))]),"pending")
        self.assertEqual(self.result("sea_48",[trick(1,cards=("blue_9","blue_8","yellow_6"))]),"complete")
        self.assertEqual(self.result("sea_49",[trick(1,cards=("blue_3","blue_2","yellow_2"))]),"complete")
        self.assertEqual(self.result("sea_50",[trick(1,cards=("blue_9","blue_8","yellow_5"))]),"complete")

    def test_first_last_only_and_consecutive(self):
        self.assertEqual(self.result("sea_79",[trick(1,"p1")]),"failed")
        self.assertEqual(self.result("sea_82",[trick(1)]),"pending")
        self.assertEqual(self.result("sea_82",[trick(1),trick(2)]),"failed")
        self.assertEqual(self.result("sea_81",[trick(1)]),"failed")
        self.assertEqual(self.result("sea_85",[trick(1),trick(2)]),"complete")
        self.assertEqual(self.result("sea_89",[trick(1),trick(2)]),"pending")
        self.assertEqual(self.result("sea_89",[trick(1),trick(2,"p1"),trick(3)]),"failed")
        self.assertEqual(self.result("sea_75",[trick(1),trick(2)]),"failed")

    def test_color_equality_is_positive_and_global_waits(self):
        self.assertEqual(self.result("sea_92",[trick(1)]),"pending")
        rows = [trick(1,cards=("blue_9","pink_1","yellow_2"))]
        self.assertEqual(self.result("sea_92",rows),"pending")
        self.assertEqual(self.result("sea_92",rows+[trick(i,"p1") for i in (2,3,4)]),"complete")
        self.assertEqual(self.result("sea_93",[trick(1,cards=("blue_9","green_1","yellow_2"))]),"complete")

    def test_comparisons_and_predictions_wait_for_end(self):
        self.assertEqual(self.result("sea_01",[trick(1)]),"pending")
        self.assertEqual(self.result("sea_01",[trick(1),trick(2),trick(3,"p1"),trick(4,"p2")]),"complete")
        self.assertEqual(self.result("sea_01",[trick(1),trick(2,"p1"),trick(3,"p1"),trick(4,"p2")]),"failed")
        key = next(t["id"] for t in SEA_TASKS if t["kind"]=="predictTricks")
        self.assertEqual(self.result(key,[trick(1)],prediction=1),"pending")
        self.assertEqual(self.result(key,[trick(1),trick(2)],prediction=1),"failed")

    def test_rank_color_and_submarine_collection_boundaries(self):
        rows = [trick(1,cards=("blue_3","pink_3","green_3"))]
        self.assertEqual(self.result("sea_20",rows),"pending")
        rows += [trick(2,cards=("yellow_3","blue_1","pink_1"))]
        self.assertEqual(self.result("sea_20",rows),"complete")
        self.assertEqual(self.result("sea_37",[trick(1,cards=("blue_9","pink_1","green_1"))]),"pending")
        self.assertEqual(self.result("sea_52",[trick(1,cards=("trump_2","blue_1","pink_1"))]),"failed")
        rows = [trick(1,cards=("trump_1","blue_1","pink_1"))]
        self.assertEqual(self.result("sea_52",rows),"pending")
        rows += [trick(2,"p1",("trump_2","trump_4","trump_3"))]
        self.assertEqual(self.result("sea_52",rows),"complete")

    def test_all_color_collection_and_more_color_allow_zero(self):
        rows = [trick(1,cards=("blue_9","pink_1","yellow_1")),trick(2,cards=("blue_8","green_1","yellow_2"))]
        self.assertEqual(self.result("sea_44",rows),"complete")
        blue = [trick(i,cards=tuple(f"blue_{n}" for n in range(3*i-2,3*i+1))) for i in (1,2,3)]
        self.assertEqual(self.result("sea_45",blue),"complete")
        rows = [trick(1,cards=("pink_9","pink_1","yellow_1"))]+[trick(i,"p1") for i in (2,3,4)]
        self.assertEqual(self.result("sea_96",rows),"complete")

    def test_skip_first_tricks_finishes_only_after_safe_window(self):
        rows = [trick(i,"p1") for i in (1,2,3,4)]
        self.assertEqual(self.result("sea_71",rows[:3],total=8),"pending")
        self.assertEqual(self.result("sea_71",rows,total=8),"complete")
        self.assertEqual(self.result("sea_71",[trick(1)],total=8),"failed")
